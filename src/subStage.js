// MK.7 mini-submarine bonus stage: "the ride to the next tower through the sea you just healed".
//
// Pure gameplay logic (no THREE). All gameplay state lives in CSS-pixel screen coordinates
// (x right, y down) so the game's existing particle / popup systems can be fed directly through
// the `fx` callbacks. `SubRenderer` (src/subRenderer.js) reads this object every frame.

const TAU = Math.PI * 2;
const RIDE_TIME = 20; // seconds of auto-scrolling (progress bar 0 -> 1)
const INTRO_TIME = 1.1; // sub glides in from the left
const ARRIVE_TIME = 4.6; // surfacing next to the next tower
const TOWER_LEAD = 5.2; // the next tower starts scrolling in this long before the ride ends

const FISH_POINTS = { small: 25, big: 200, gold: 800 };
const JELLY_POINTS = 100;
const PEARL_POINTS = 400;
const PERFECT_BONUS = 750;
const SCHOOL_BONUS = 150; // whole school caught in one go
const HIT_PENALTY = 100;
const MAX_MULT = 4;

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const rand = (a, b) => a + Math.random() * (b - a);
const smooth = (t) => t * t * (3 - 2 * t);

function removeAt(arr, i) {
  const last = arr.length - 1;
  if (i !== last) arr[i] = arr[last];
  arr.pop();
}

export class SubStage {
  constructor() {
    this.width = 390;
    this.height = 620;
    this.s = 1;
    this.active = false;
    this.phase = 'idle'; // idle | intro | ride | arrive | done
    this.sub = this._makeSub();
    this.fish = [];
    this.jellies = [];
    this.mines = [];
    this.clams = [];
    this.bubbles = [];
    this.rings = []; // shock-wave rings for the renderer: {x,y,r0,r1,life,maxLife,color}
    this.tower = { active: false, x: 0, r: 100, targetX: 0, glow: '#38bdf8', name: '' };
    this._resetStats();
  }

  _makeSub() {
    return {
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      rx: 34, // collision half-length (ellipse)
      ry: 19, // collision half-height
      stun: 0, // > 0 while stunned (no control, spinning)
      stunMax: 1,
      invuln: 0,
      spin: 0, // roll angle in radians for the renderer
      fireCd: 0,
      autoCd: 0,
      surfaced: 0, // 0..1 how far it has broken the surface during arrival
      prop: 0, // propeller speed factor 0..1.5
    };
  }

  _resetStats() {
    this.fishCaught = 0;
    this.pearls = 0;
    this.bonus = 0;
    this.jelliesPopped = 0;
    this.goldCaught = 0;
    this.hits = 0;
    this.perfect = false;
    this.combo = 0;
    this.comboTimer = 0;
    this.mult = 1;
  }

  start({ width = 390, height = 620, towerIndex = 0, healing = 0, nextTowerName = 'NEXT TOWER', nextGlow = '#38bdf8' } = {}) {
    this.width = Math.max(200, width);
    this.height = Math.max(240, height);
    this.s = this._scaleFor(this.width, this.height);
    this.towerIndex = Math.max(0, towerIndex | 0);
    this.healing = clamp(Number(healing) || 0, 0, 1);
    this.nextTowerName = String(nextTowerName || 'NEXT TOWER').toUpperCase();
    this.nextGlow = nextGlow || '#38bdf8';
    // 0 for the first ride, 1 for the last one
    this.difficulty = clamp(this.towerIndex / 6, 0, 1);

    this.active = true;
    this.phase = 'intro';
    this.t = 0;
    this.rideT = 0;
    this.arriveT = 0;
    this.progress = 0;
    this.scroll = 0;
    this.baseSpeed = 92 * this.s;
    this.scrollSpeed = this.baseSpeed;
    this._finished = false;
    this._bannerShown = false;
    this._schoolId = 0;

    this.fish.length = 0;
    this.jellies.length = 0;
    this.mines.length = 0;
    this.clams.length = 0;
    this.bubbles.length = 0;
    this.rings.length = 0;
    this._resetStats();

    this._layout();
    const sub = this.sub;
    Object.assign(sub, this._makeSub());
    sub.rx = 34 * this.s;
    sub.ry = 19 * this.s;
    sub.x = -sub.rx * 2;
    sub.y = this.height * 0.48;
    sub.prop = 1;

    const t = this.tower;
    t.active = false;
    t.r = this._towerRadius();
    t.targetX = this.width - t.r * 0.62;
    t.x = this.width + t.r * 1.6;
    t.glow = this.nextGlow;
    t.name = this.nextTowerName;

    // Spawn schedule (seconds of ride time)
    const d = this.difficulty;
    this._next = {
      school: 0.9,
      big: 3.2 + Math.random() * 1.5,
      jelly: 2.2,
      mine: this.towerIndex >= 2 ? 4.0 + Math.random() * 2 : Infinity,
      clam: 2.6,
    };
    this._goldAt = Math.random() < 0.55 + this.healing * 0.45 ? rand(6.5, 13.5) : Infinity;
    this._jellyEvery = lerp(3.3, 1.55, d);
    this._mineEvery = this.towerIndex >= 2 ? lerp(5.6, 2.5, clamp((this.towerIndex - 2) / 5, 0, 1)) : Infinity;
  }

  _scaleFor(w, h) {
    return clamp(Math.sqrt((w * h) / (390 * 620)), 0.8, 1.6);
  }

  _towerRadius() {
    return clamp(this.width * 0.3, 70 * this.s, 190 * this.s);
  }

  _layout() {
    this.surfaceY = this.height * 0.115;
    this.seabedY = this.height * 0.905;
    this.top = this.surfaceY + 26 * this.s; // highest the sub may go while riding
    this.bottom = this.seabedY - 10 * this.s; // lowest (pearls sit on the seabed just below)
  }

  resize(width, height) {
    if (!width || !height) return;
    const ow = this.width;
    const oh = this.height;
    const os = this.s;
    this.width = Math.max(200, width);
    this.height = Math.max(240, height);
    if (!this.active) {
      this.s = this._scaleFor(this.width, this.height);
      this._layout();
      return;
    }
    const kx = this.width / ow;
    const ky = this.height / oh;
    this.s = this._scaleFor(this.width, this.height);
    const ks = this.s / os;
    this._layout();
    const fixXY = (o) => {
      o.x *= kx;
      o.y *= ky;
      if (o.r) o.r *= ks;
      if (o.baseY !== undefined) o.baseY *= ky;
    };
    const sub = this.sub;
    sub.x *= kx;
    sub.y *= ky;
    sub.rx *= ks;
    sub.ry *= ks;
    for (const f of this.fish) fixXY(f);
    for (const j of this.jellies) fixXY(j);
    for (const m of this.mines) fixXY(m);
    for (const c of this.clams) {
      c.x *= kx;
      c.r *= ks;
      c.y = this.seabedY - 2 * this.s;
    }
    for (const b of this.bubbles) fixXY(b);
    this.rings.length = 0;
    this.baseSpeed = 92 * this.s;
    const t = this.tower;
    t.r = this._towerRadius();
    t.targetX = this.width - t.r * 0.62;
    t.x *= kx;
  }

  get results() {
    return {
      fish: this.fishCaught,
      pearls: this.pearls,
      bonus: this.bonus,
      jellies: this.jelliesPopped,
      gold: this.goldCaught,
      hits: this.hits,
      perfect: this.perfect,
    };
  }

  get finished() {
    return this._finished;
  }

  // ------------------------------------------------------------------ main update
  update(dt, input = {}, firePressed = false, fx = {}) {
    if (!this.active) return this._finished;
    dt = clamp(Number(dt) || 0, 0, 0.05);
    if (this._finished) return true;
    const sound = fx.sound || null;
    this.t += dt;

    // Combo decay
    if (this.comboTimer > 0) {
      this.comboTimer -= dt;
      if (this.comboTimer <= 0) {
        this.combo = 0;
        this.mult = 1;
      }
    }

    // Phases
    if (this.phase === 'intro') {
      if (this.t >= INTRO_TIME) this.phase = 'ride';
    }
    if (this.phase === 'intro' || this.phase === 'ride') {
      this.rideT += dt;
      this.progress = clamp(this.rideT / RIDE_TIME, 0, 1);
      if (!this._bannerShown) {
        this._bannerShown = true;
        const pct = Math.round(this.healing * 100);
        fx.banner?.(`THE SEA IS ${pct}% HEALED`, 'MK.7 MINI-SUBMARINE');
      }
      if (this.rideT >= RIDE_TIME - TOWER_LEAD) this.tower.active = true;
      if (this.rideT >= RIDE_TIME) this._beginArrival(fx, sound);
    } else if (this.phase === 'arrive') {
      this.arriveT += dt;
      this.progress = 1;
      if (this.arriveT >= ARRIVE_TIME) {
        this.phase = 'done';
        this._finished = true;
        return true;
      }
    }

    // World scroll (eases to a stop as the next tower slides into place)
    const tw = this.tower;
    if (tw.active) {
      const remain = tw.x - tw.targetX;
      const ease = clamp(remain / (130 * this.s), 0, 1);
      this.scrollSpeed = this.baseSpeed * Math.max(ease, remain > 1 ? 0.08 : 0);
      tw.x = Math.max(tw.targetX, tw.x - this.scrollSpeed * dt);
    } else {
      this.scrollSpeed = this.baseSpeed;
    }
    this.scroll += this.scrollSpeed * dt;

    this._updateSub(dt, input, firePressed, fx, sound);
    this._spawn(dt);
    this._updateBubbles(dt, fx, sound);
    this._updateFish(dt, fx, sound);
    this._updateJellies(dt, fx, sound);
    this._updateMines(dt, fx, sound);
    this._updateClams(dt, fx, sound);

    for (let i = this.rings.length - 1; i >= 0; i--) {
      const r = this.rings[i];
      r.life -= dt;
      r.x -= this.scrollSpeed * dt * 0.5;
      if (r.life <= 0) removeAt(this.rings, i);
    }
    return false;
  }

  _beginArrival(fx, sound) {
    this.phase = 'arrive';
    this.arriveT = 0;
    this.progress = 1;
    // calm the sea: no more hazards touching you
    if (this.hits === 0) {
      this.perfect = true;
      this._score(fx, PERFECT_BONUS);
      fx.popup?.(this.sub.x, this.sub.y - 40 * this.s, `PERFECT RIDE +${PERFECT_BONUS}`, '#fde047');
      sound?.secret?.();
    }
    fx.banner?.(`TOWER ${this.towerIndex + 2} OF 8`, `ARRIVING: ${this.nextTowerName}`);
  }

  _score(fx, pts) {
    if (!pts) return;
    this.bonus += pts;
    fx.addScore?.(pts);
  }

  _comboHit() {
    this.combo = this.comboTimer > 0 ? this.combo + 1 : 1;
    this.comboTimer = 2.4;
    this.mult = Math.min(MAX_MULT, this.combo);
    return this.mult;
  }

  _ring(x, y, r0, r1, color, life = 0.45) {
    if (this.rings.length > 22) this.rings.shift();
    this.rings.push({ x, y, r0, r1, color, life, maxLife: life });
  }

  // ------------------------------------------------------------------ submarine
  _updateSub(dt, input, firePressed, fx, sound) {
    const sub = this.sub;
    const s = this.s;
    const W = this.width;

    if (sub.invuln > 0) sub.invuln -= dt;
    if (sub.fireCd > 0) sub.fireCd -= dt;
    if (sub.autoCd > 0) sub.autoCd -= dt;

    if (this.phase === 'intro') {
      const k = smooth(clamp(this.t / INTRO_TIME, 0, 1));
      const tx = lerp(-sub.rx * 2, W * 0.26, k);
      sub.vx = (tx - sub.x) / Math.max(dt, 1e-4);
      sub.x = tx;
      sub.vy *= 0.9;
      sub.y += sub.vy * dt;
      sub.prop = 1.3;
    } else if (this.phase === 'arrive') {
      // Autopilot: swim in front of the tower's base and break the surface
      const tx = this.tower.x - this.tower.r * 0.95 - sub.rx * 0.2;
      const ty = this.surfaceY + sub.ry * 0.3;
      const dx = tx - sub.x;
      const dy = ty - sub.y;
      const maxV = 190 * s;
      const wantVx = clamp(dx * 2.2, -maxV, maxV);
      const wantVy = clamp(dy * 2.0, -maxV, maxV);
      const a = Math.min(1, dt * 4);
      sub.vx += (wantVx - sub.vx) * a;
      sub.vy += (wantVy - sub.vy) * a;
      sub.x += sub.vx * dt;
      sub.y += sub.vy * dt;
      sub.stun = Math.max(0, sub.stun - dt);
      sub.spin *= Math.exp(-6 * dt);
      sub.prop = Math.max(0.15, Math.min(1.2, Math.hypot(dx, dy) / (60 * s)));
      const near = sub.y - this.surfaceY < sub.ry * 0.9 && Math.abs(dx) < 40 * s;
      if (near && sub.surfaced === 0) {
        sub.surfaced = 0.001;
        sound?.subSurface?.();
        fx.particles?.(sub.x, this.surfaceY, '#e0f7ff', 18, 150);
        fx.particles?.(sub.x - sub.rx * 0.6, this.surfaceY, '#bae6fd', 10, 110);
        this._ring(sub.x, this.surfaceY, sub.rx * 0.6, sub.rx * 2.6, '#e0f7ff', 0.8);
        fx.shake?.(2);
      }
      if (sub.surfaced > 0) sub.surfaced = Math.min(1, sub.surfaced + dt * 1.6);
      return;
    } else {
      if (sub.stun > 0) {
        sub.stun -= dt;
        const k = Math.max(0, sub.stun / sub.stunMax);
        sub.spin += dt * TAU * 2.2 * (0.3 + k);
        if (sub.stun <= 0) {
          sub.stun = 0;
          // land on the nearest upright orientation
          sub.spin = Math.round(sub.spin / TAU) * TAU;
        }
        const damp = Math.exp(-2.6 * dt);
        sub.vx *= damp;
        sub.vy *= damp;
        sub.prop = 0.2;
      } else {
        sub.spin += (Math.round(sub.spin / TAU) * TAU - sub.spin) * Math.min(1, dt * 10);
        let ix = 0;
        if (input.axisX) ix = clamp(input.axisX, -1, 1);
        else ix = (input.right ? 1 : 0) - (input.left ? 1 : 0);
        let iy = (input.down ? 1 : 0) - (input.up ? 1 : 0);
        if (input.axisY) iy = clamp(input.axisY, -1, 1);
        const len = Math.hypot(ix, iy);
        if (len > 1) {
          ix /= len;
          iy /= len;
        }
        const maxV = 215 * s;
        const a = Math.min(1, dt * 7.5);
        sub.vx += (ix * maxV - sub.vx) * a;
        sub.vy += (iy * maxV - sub.vy) * a;
        sub.prop = 0.75 + Math.max(0, ix) * 0.6 - Math.max(0, -ix) * 0.35;

        // Fire bubbles: tap = instant, hold = auto-repeat
        const held = !!(input.fire || input.jump);
        if ((firePressed && sub.fireCd <= 0) || (held && sub.autoCd <= 0 && sub.fireCd <= 0)) {
          this._fire(sound);
        }
      }
      sub.x += sub.vx * dt;
      sub.y += sub.vy * dt;
    }

    const minX = sub.rx * 0.9;
    const maxX = W - sub.rx * 1.1;
    if (this.phase !== 'intro') {
      if (sub.x < minX) {
        sub.x = minX;
        if (sub.vx < 0) sub.vx = 0;
      } else if (sub.x > maxX) {
        sub.x = maxX;
        if (sub.vx > 0) sub.vx = 0;
      }
    }
    if (sub.y < this.top) {
      sub.y = this.top;
      if (sub.vy < 0) sub.vy = 0;
    } else if (sub.y > this.bottom) {
      sub.y = this.bottom;
      if (sub.vy > 0) sub.vy = 0;
    }
  }

  _fire(sound) {
    const sub = this.sub;
    if (this.bubbles.length >= 9) return;
    sub.fireCd = 0.15;
    sub.autoCd = 0.3;
    const s = this.s;
    this.bubbles.push({
      x: sub.x + sub.rx * 1.05,
      y: sub.y + sub.ry * 0.15,
      vx: 330 * s + Math.max(0, sub.vx) * 0.4,
      vy: sub.vy * 0.15 - 6 * s,
      r: 8 * s,
      life: 1.25,
      age: 0,
      seed: Math.random() * TAU,
    });
    sound?.bubble?.();
  }

  // ------------------------------------------------------------------ spawning
  _spawn(dt) {
    if (this.phase !== 'ride' && this.phase !== 'intro') return;
    const t = this.rideT;
    const n = this._next;
    const fishOpen = t < RIDE_TIME - 3.2;
    const hazardOpen = t < RIDE_TIME - TOWER_LEAD + 0.6;
    const W = this.width;
    const s = this.s;
    const h = this.healing;
    const minY = this.top + 14 * s;
    const maxY = this.seabedY - 70 * s;

    if (fishOpen && t >= n.school) {
      n.school = t + rand(2.4, 3.5) - h * 0.5;
      const count = 5 + Math.floor(Math.random() * 3) + Math.round(h * 3);
      const cy = rand(minY + 20 * s, maxY - 10 * s);
      const id = ++this._schoolId;
      const color = Math.floor(Math.random() * 5);
      const swim = rand(40, 70) * s;
      const ph = Math.random() * TAU;
      for (let k = 0; k < count; k++) {
        const rad = 10 * s * Math.sqrt(k + 0.4) * 1.55;
        const ang = k * 2.39996;
        this._addFish({
          type: 'small',
          x: W + 40 * s + Math.cos(ang) * rad * 1.5,
          oy: Math.sin(ang) * rad * 0.8,
          baseY: cy,
          swim,
          school: id,
          color,
          phase: ph,
          amp: 16 * s,
          freq: 1.9,
          r: 9 * s * rand(0.9, 1.1),
        });
      }
    }
    if (fishOpen && t >= n.big) {
      n.big = t + rand(3.8, 5.4) - h * 0.8;
      this._addFish({
        type: 'big',
        x: W + 60 * s,
        oy: 0,
        baseY: rand(minY + 10 * s, maxY),
        swim: rand(28, 48) * s,
        school: 0,
        color: Math.floor(Math.random() * 3),
        phase: Math.random() * TAU,
        amp: 20 * s,
        freq: 1.1,
        r: 19 * s,
      });
    }
    if (fishOpen && t >= this._goldAt) {
      this._goldAt = Infinity;
      this._addFish({
        type: 'gold',
        x: W + 40 * s,
        oy: 0,
        baseY: rand(minY + 30 * s, maxY - 20 * s),
        swim: 105 * s,
        school: 0,
        color: 0,
        phase: 0,
        amp: 48 * s,
        freq: 3.1,
        r: 12 * s,
      });
    }
    if (hazardOpen && t >= n.jelly) {
      n.jelly = t + this._jellyEvery * rand(0.8, 1.25);
      const y = rand(minY + 20 * s, maxY - 10 * s);
      if (!this._crowded(W + 40 * s, y, 70 * s)) {
        this.jellies.push({
          x: W + 40 * s,
          y,
          baseY: y,
          r: 19 * s * rand(0.9, 1.15),
          drift: rand(4, 22) * s,
          phase: Math.random() * TAU,
          pulse: Math.random() * TAU,
          pulseRate: rand(2.4, 3.2),
          state: 'alive',
          deadT: 0,
          hue: Math.floor(Math.random() * 3),
          age: 0,
        });
      }
    }
    if (hazardOpen && t >= n.mine) {
      n.mine = t + this._mineEvery * rand(0.85, 1.2);
      const floating = this.towerIndex >= 5 && Math.random() < 0.35;
      const y = floating ? rand(minY + 20 * s, maxY) : rand(this.height * 0.32, this.seabedY - 95 * s);
      if (!this._crowded(W + 40 * s, y, 80 * s)) {
        this.mines.push({
          x: W + 40 * s,
          y,
          baseY: y,
          r: 16 * s,
          kind: floating ? 'float' : 'anchored',
          phase: Math.random() * TAU,
          bob: rand(14, 26) * s,
          blink: Math.random(),
          spin: Math.random() * TAU,
        });
      }
    }
    if (t >= n.clam && t < RIDE_TIME - 5.5) {
      n.clam = t + rand(4.2, 5.6);
      this.clams.push({
        x: W + 40 * s,
        y: this.seabedY - 2 * s,
        r: 17 * s,
        phase: Math.random() * TAU,
        period: rand(2.6, 3.4),
        open: 0,
        hasPearl: true,
        snap: 0,
      });
    }
  }

  _crowded(x, y, dist) {
    for (const j of this.jellies) if (Math.abs(j.x - x) < dist && Math.abs(j.y - y) < dist) return true;
    for (const m of this.mines) if (Math.abs(m.x - x) < dist && Math.abs(m.y - y) < dist) return true;
    return false;
  }

  _addFish(o) {
    this.fish.push({
      type: o.type,
      x: o.x,
      y: o.baseY + o.oy,
      oy: o.oy,
      baseY: o.baseY,
      vx: 0,
      vy: 0,
      swim: o.swim, // own speed through the water (leftwards)
      school: o.school,
      color: o.color,
      phase: o.phase,
      amp: o.amp,
      freq: o.freq,
      r: o.r,
      state: 'swim', // swim | bubbled | free
      bubbleT: 0,
      bubbleR: 0,
      age: 0,
      dir: -1, // -1 facing left, +1 facing right
      seed: Math.random() * TAU,
    });
  }

  // ------------------------------------------------------------------ bubbles (player shots)
  _updateBubbles(dt, fx, sound) {
    const W = this.width;
    for (let i = this.bubbles.length - 1; i >= 0; i--) {
      const b = this.bubbles[i];
      b.age += dt;
      b.life -= dt;
      b.vx *= Math.exp(-0.6 * dt);
      b.vy -= 14 * this.s * dt;
      b.x += b.vx * dt;
      b.y += b.vy * dt + Math.sin(b.age * 14 + b.seed) * 0.25 * this.s;
      if (b.life <= 0 || b.x > W + 30 * this.s || b.y < this.surfaceY) {
        if (b.life <= 0) this._ring(b.x, b.y, b.r * 0.5, b.r * 1.8, '#bfefff', 0.25);
        removeAt(this.bubbles, i);
        continue;
      }
      if (this._bubbleHits(b, fx, sound)) removeAt(this.bubbles, i);
    }
  }

  _bubbleHits(b, fx, sound) {
    // fish
    for (const f of this.fish) {
      if (f.state !== 'swim') continue;
      const rr = b.r + f.r * 1.25;
      const dx = b.x - f.x;
      const dy = b.y - f.y;
      if (dx * dx + dy * dy < rr * rr) {
        if (f.school) {
          let k = 0;
          for (const g of this.fish) {
            if (g.school === f.school && g.state === 'swim') this._bubbleFish(g, k++ * 0.05);
          }
        } else {
          this._bubbleFish(f, 0);
        }
        sound?.bubble?.();
        this._ring(f.x, f.y, f.r, f.r * 3, '#bfefff', 0.4);
        return true;
      }
    }
    // jellies (poppable)
    for (const j of this.jellies) {
      if (j.state !== 'alive') continue;
      const rr = b.r + j.r * 1.05;
      const dx = b.x - j.x;
      const dy = b.y - (j.y + j.r * 0.15);
      if (dx * dx + dy * dy < rr * rr) {
        j.state = 'popped';
        j.deadT = 0;
        this.jelliesPopped++;
        const mult = this._comboHit();
        const pts = JELLY_POINTS * mult;
        this._score(fx, pts);
        fx.popup?.(j.x, j.y - j.r, mult > 1 ? `+${pts} x${mult}` : `+${pts}`, '#f0abfc');
        fx.particles?.(j.x, j.y, '#f0abfc', 14, 120);
        fx.particles?.(j.x, j.y, '#ffffff', 6, 80);
        this._ring(j.x, j.y, j.r * 0.6, j.r * 3.2, '#f0abfc', 0.5);
        sound?.jellyZap?.();
        return true;
      }
    }
    // mines are indestructible: bubble bursts harmlessly
    for (const m of this.mines) {
      const rr = b.r + m.r * 1.35;
      const dx = b.x - m.x;
      const dy = b.y - m.y;
      if (dx * dx + dy * dy < rr * rr) {
        fx.particles?.(b.x, b.y, '#e2e8f0', 6, 70);
        this._ring(b.x, b.y, b.r * 0.5, b.r * 2.2, '#e2e8f0', 0.3);
        return true;
      }
    }
    return false;
  }

  _bubbleFish(f, delay) {
    f.state = 'bubbled';
    f.bubbleT = -delay;
    f.bubbleR = f.r * (f.type === 'small' ? 1.75 : 1.5) + 6 * this.s;
  }

  // ------------------------------------------------------------------ fish
  _updateFish(dt, fx, sound) {
    const s = this.s;
    const sub = this.sub;
    const canCatch = sub.stun <= 0;
    let caughtSchool = 0;
    for (let i = this.fish.length - 1; i >= 0; i--) {
      const f = this.fish[i];
      f.age += dt;
      if (f.state === 'swim') {
        const zig = f.type === 'gold' ? Math.sin(f.age * f.freq * 0.5 + 1.3) * 0.5 : 0;
        f.x += (-this.scrollSpeed - f.swim) * dt;
        const ny = f.baseY + f.oy + Math.sin(f.age * f.freq + f.phase) * f.amp * (1 + zig) + Math.sin(f.age * 3.7 + f.seed) * 2 * s;
        f.vy = (ny - f.y) / Math.max(dt, 1e-4);
        f.y = ny;
        // keep schools away from the very top
        if (f.y < this.top) f.y = this.top;
      } else if (f.state === 'bubbled') {
        f.bubbleT += dt;
        if (f.bubbleT < 0) {
          // waiting for the chain reaction to reach this fish
          f.x += (-this.scrollSpeed - f.swim) * dt;
          continue;
        }
        f.x += -this.scrollSpeed * 0.42 * dt + Math.sin(f.bubbleT * 2.2 + f.seed) * 6 * s * dt;
        f.y += -24 * s * dt;
        f.vy = -24 * s;
        if (f.y - f.bubbleR < this.surfaceY) {
          // bubble reached the surface: it pops and the fish gets away
          this._ring(f.x, f.y, f.bubbleR * 0.6, f.bubbleR * 2, '#bfefff', 0.35);
          f.state = 'free';
          f.swim = 160 * s;
        }
        if (canCatch && f.bubbleT > 0.12) {
          const dx = (f.x - sub.x) / (sub.rx + f.bubbleR * 0.8);
          const dy = (f.y - sub.y) / (sub.ry + f.bubbleR * 0.8);
          if (dx * dx + dy * dy < 1) {
            if (f.school) caughtSchool = f.school;
            else {
              this._catchSingle(f, fx, sound);
              removeAt(this.fish, i);
              continue;
            }
          }
        }
      } else {
        // freed fish dart away
        f.x += (-this.scrollSpeed - f.swim) * dt;
        f.y += Math.sin(f.age * 9) * 30 * s * dt;
      }
      if (f.x < -60 * s || f.y < -40 * s) removeAt(this.fish, i);
    }
    if (caughtSchool) this._catchSchool(caughtSchool, fx, sound);
  }

  _catchSingle(f, fx, sound) {
    const mult = this._comboHit();
    const base = FISH_POINTS[f.type] || 100;
    const pts = base * mult;
    this.fishCaught++;
    this._score(fx, pts);
    if (f.type === 'gold') {
      this.goldCaught++;
      fx.popup?.(f.x, f.y - 22 * this.s, `GOLDEN FISH! +${pts}`, '#fde047');
      fx.particles?.(f.x, f.y, '#fde047', 22, 160);
      fx.particles?.(f.x, f.y, '#ffffff', 10, 110);
      this._ring(f.x, f.y, f.bubbleR, f.bubbleR * 4, '#fde047', 0.7);
      fx.shake?.(3);
      sound?.secret?.();
    } else {
      fx.popup?.(f.x, f.y - 18 * this.s, mult > 1 ? `+${pts} x${mult}` : `+${pts}`, mult > 1 ? '#f472b6' : '#86efac');
      fx.particles?.(f.x, f.y, '#a5f3fc', 12, 110);
      this._ring(f.x, f.y, f.bubbleR * 0.8, f.bubbleR * 2.8, '#a5f3fc', 0.45);
      sound?.catchFish?.();
    }
  }

  _catchSchool(id, fx, sound) {
    let n = 0;
    let sx = 0;
    let sy = 0;
    let total = 0;
    let swimmers = 0;
    for (let i = this.fish.length - 1; i >= 0; i--) {
      const f = this.fish[i];
      if (f.school !== id) continue;
      if (f.state === 'bubbled' && f.bubbleT >= 0) {
        n++;
        sx += f.x;
        sy += f.y;
        fx.particles?.(f.x, f.y, '#a5f3fc', 4, 90);
        this._ring(f.x, f.y, f.bubbleR * 0.6, f.bubbleR * 2.2, '#a5f3fc', 0.35);
        removeAt(this.fish, i);
      } else if (f.state !== 'free') swimmers++;
      total++;
    }
    if (!n) return;
    const mult = this._comboHit();
    let pts = FISH_POINTS.small * n * mult;
    const whole = n === total && swimmers === 0 && n >= 4;
    if (whole) pts += SCHOOL_BONUS * mult;
    this.fishCaught += n;
    this._score(fx, pts);
    sx /= n;
    sy /= n;
    const label = `${whole ? 'SCHOOL ' : ''}+${pts}${mult > 1 ? ` x${mult}` : ''}`;
    fx.popup?.(sx, sy - 20 * this.s, label, mult > 1 ? '#f472b6' : '#86efac');
    fx.particles?.(sx, sy, '#ffffff', 10, 140);
    sound?.catchFish?.();
  }

  // ------------------------------------------------------------------ hazards
  _stun(hx, hy, fx, sound, kind) {
    const sub = this.sub;
    sub.stun = 1.0;
    sub.stunMax = 1.0;
    sub.invuln = 1.8;
    const dx = sub.x - hx;
    const dy = sub.y - hy;
    const d = Math.hypot(dx, dy) || 1;
    const k = 280 * this.s;
    sub.vx = (dx / d) * k;
    sub.vy = (dy / d) * k * 0.8;
    this.hits++;
    this.combo = 0;
    this.comboTimer = 0;
    this.mult = 1;
    const penalty = Math.min(HIT_PENALTY, this.bonus);
    if (penalty > 0) {
      this.bonus -= penalty;
      fx.addScore?.(-penalty);
    }
    fx.popup?.(sub.x, sub.y - 30 * this.s, penalty > 0 ? `${kind === 'mine' ? 'BOOM!' : 'ZAP!'} -${penalty}` : kind === 'mine' ? 'BOOM!' : 'ZAP!', '#fb7185');
    fx.particles?.(sub.x, sub.y, kind === 'mine' ? '#fb923c' : '#f0abfc', 18, 170);
    fx.particles?.(sub.x, sub.y, '#ffffff', 8, 120);
    this._ring(hx, hy, 8 * this.s, 70 * this.s, kind === 'mine' ? '#fb923c' : '#f0abfc', 0.55);
    fx.shake?.(kind === 'mine' ? 9 : 6);
    if (kind === 'mine') (sound?.subHit || sound?.jellyZap)?.call(sound);
    else sound?.jellyZap?.();
  }

  _touchesSub(x, y, r) {
    const sub = this.sub;
    const dx = (x - sub.x) / (sub.rx * 0.88 + r);
    const dy = (y - sub.y) / (sub.ry * 0.85 + r);
    return dx * dx + dy * dy < 1;
  }

  _updateJellies(dt, fx, sound) {
    const s = this.s;
    const sub = this.sub;
    const vulnerable = sub.invuln <= 0 && (this.phase === 'ride' || this.phase === 'intro');
    for (let i = this.jellies.length - 1; i >= 0; i--) {
      const j = this.jellies[i];
      j.age += dt;
      if (j.state === 'popped') {
        j.deadT += dt;
        j.x -= this.scrollSpeed * dt;
        if (j.deadT > 0.45) removeAt(this.jellies, i);
        continue;
      }
      j.pulse += dt * j.pulseRate;
      // each contraction gives a little upward thrust; slow sine drift otherwise
      const thrust = Math.max(0, Math.sin(j.pulse)) ** 2;
      j.baseY -= thrust * 16 * s * dt;
      j.baseY += 7 * s * dt; // gentle sinking between pulses
      j.baseY = clamp(j.baseY, this.top, this.seabedY - 60 * s);
      j.x += (-this.scrollSpeed * 0.92 - j.drift) * dt + Math.sin(j.age * 0.7 + j.phase) * 8 * s * dt;
      j.y = j.baseY + Math.sin(j.age * 0.9 + j.phase) * 14 * s;
      if (vulnerable && this._touchesSub(j.x, j.y + j.r * 0.25, j.r * 0.8)) {
        this._stun(j.x, j.y, fx, sound, 'jelly');
      }
      if (j.x < -80 * s) removeAt(this.jellies, i);
    }
  }

  _updateMines(dt, fx, sound) {
    const s = this.s;
    const sub = this.sub;
    const vulnerable = sub.invuln <= 0 && (this.phase === 'ride' || this.phase === 'intro');
    for (let i = this.mines.length - 1; i >= 0; i--) {
      const m = this.mines[i];
      m.phase += dt;
      m.blink = (m.blink + dt * 1.6) % 1;
      m.spin += dt * 0.6;
      m.x -= this.scrollSpeed * dt;
      if (m.kind === 'float') {
        m.x += Math.sin(m.phase * 0.5) * 10 * s * dt;
        m.y = m.baseY + Math.sin(m.phase * 0.7) * m.bob * 1.4;
      } else {
        m.y = m.baseY + Math.sin(m.phase * 0.9) * m.bob;
      }
      if (vulnerable && this._touchesSub(m.x, m.y, m.r * 1.05)) {
        this._stun(m.x, m.y, fx, sound, 'mine');
      }
      if (m.x < -80 * s) removeAt(this.mines, i);
    }
  }

  _updateClams(dt, fx, sound) {
    const s = this.s;
    const sub = this.sub;
    for (let i = this.clams.length - 1; i >= 0; i--) {
      const c = this.clams[i];
      c.x -= this.scrollSpeed * dt;
      c.phase += (dt * TAU) / c.period;
      // open ~45% of the cycle, quick snaps
      const wave = Math.sin(c.phase);
      const target = wave > 0.1 ? 1 : 0;
      c.open += (target - c.open) * Math.min(1, dt * (target ? 6 : 14));
      if (c.snap > 0) c.snap -= dt;
      if (c.hasPearl && c.open > 0.55 && sub.stun <= 0) {
        if (this._touchesSub(c.x, c.y - c.r * 0.35, c.r * 0.55)) {
          c.hasPearl = false;
          this.pearls++;
          this._score(fx, PEARL_POINTS);
          fx.popup?.(c.x, c.y - 34 * s, `PEARL +${PEARL_POINTS}`, '#fbcfe8');
          fx.particles?.(c.x, c.y - c.r * 0.4, '#fdf2f8', 16, 120);
          this._ring(c.x, c.y - c.r * 0.4, c.r * 0.4, c.r * 3, '#fbcfe8', 0.6);
          sound?.collect?.(this.pearls - 1);
        }
      }
      if (c.x < -60 * s) removeAt(this.clams, i);
    }
  }
}

export const SUB_STAGE_TIMING = { RIDE_TIME, INTRO_TIME, ARRIVE_TIME, TOWER_LEAD };
