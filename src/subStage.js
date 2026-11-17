// MK.7 Mini-Submarine / Reboot Manta-Sub Bonus Stage (`src/subStage.js`)
// Ported from `origin/main` (`e42c3da`) + `docs/wip/sub-stage-upgrade.patch`, upgraded with
// Dual-Era 2026 Reboot mechanics (Cryo-Encase Torpedoes, Abyssal Sonar Ping, Hydrothermal Bubble
// Vents, sunken Golden Gear Caches, and Bioluminescent Warp Cavern) alongside pure 1987 Original
// Mode rules.
//
// Pure gameplay logic (no THREE). All gameplay state lives in CSS-pixel screen coordinates
// (x right, y down) so particle/popup systems wire directly through `fx` callbacks, and
// `SubRenderer` (`src/subRenderer.js`) renders this object every frame with zero allocations.

const TAU = Math.PI * 2;
const RIDE_TIME = 20; // Reboot auto-scrolling ride seconds (progress bar 0 -> 1)
const ORIG_RIDE_TIME = 14; // Authentic 1987 Classic submarine duration
const INTRO_TIME = 1.1; // Sub glides in from the left
const ARRIVE_TIME = 5.0; // Surfacing next to the next tower (cinematic over/under shot + tally)
const TOWER_LEAD = 5.2; // Next tower starts scrolling in this long before the ride ends

const FISH_POINTS = { small: 25, big: 200, gold: 800 };
const ORIG_FISH_POINTS = 50;
const JELLY_POINTS = 100;
const MINE_SHATTER_POINTS = 150;
const PEARL_POINTS = 400;
const VENT_BOOST_POINTS = 100;
const WARP_CAVE_POINTS = 500;
const PERFECT_BONUS = 750;
const SCHOOL_BONUS = 150;
const HIT_PENALTY = 100;
const MAX_MULT = 4;
const NEAR_MISS_POINTS = 50;
const COMBO_WINDOW = 2.4;
const SONAR_COOLDOWN = 3.5;
const MAX_VFX = 48;

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const rand = (a, b) => a + Math.random() * (b - a);
const smooth = (t) => t * t * (3 - 2 * t);

function removeAt(arr, i) {
  const last = arr.length - 1;
  if (i !== last) arr[i] = arr[last];
  arr.pop();
}

// Order-preserving removal without allocating temporary splice arrays
function removeOrdered(arr, i) {
  for (let k = i; k < arr.length - 1; k++) arr[k] = arr[k + 1];
  arr.pop();
}

export class SubStage {
  constructor(opts = null) {
    this.width = 390;
    this.height = 620;
    this.s = 1;
    this.era = 'reboot';
    this.casual = false;
    this.rideDuration = RIDE_TIME;
    this.active = false;
    this.phase = 'idle'; // idle | intro | ride | arrive | done
    this.sub = this._makeSub();
    this.fish = [];
    this.jellies = [];
    this.mines = [];
    this.clams = [];
    this.bubbles = [];
    this.vents = [];
    this.hiddenCaches = [];
    this.warpCave = { x: 9999, y: 120, r: 46, active: false, entered: false };
    this.sonarPulse = 0;
    this.sonarCooldown = 0;
    this.sonarOriginX = 0;
    this.sonarOriginY = 0;
    this.ventBoostTimer = 0;
    this.rings = []; // shock-wave rings for the renderer: {x,y,r0,r1,life,maxLife,color,flat}
    this.vfx = []; // one-shot events: {id,kind,x,y,life,maxLife,size,color,a,tx,ty}
    this._vfxId = 0;
    this._prevJump = false;
    this._prevFire = false;
    this.tower = { active: false, x: 0, r: 100, targetX: 0, glow: '#38bdf8', name: '' };
    this._resetStats();
    if (
      opts &&
      typeof opts === 'object' &&
      opts.autoStart !== false &&
      (opts.era !== undefined || opts.fromIdx !== undefined || opts.towerIndex !== undefined)
    ) {
      this.start({
        ...opts,
        towerIndex: opts.towerIndex ?? opts.fromIdx ?? 0,
      });
    }
  }

  _makeSub() {
    return {
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      rx: 34,
      ry: 19,
      stun: 0,
      stunMax: 1,
      invuln: 0,
      spin: 0,
      fireCd: 0,
      autoCd: 0,
      surfaced: 0,
      prop: 0,
      ax: 0,
      ay: 0,
      shots: 0,
      catches: 0,
      nearMisses: 0,
    };
  }

  _resetStats() {
    this.fishCaught = 0;
    this.pearls = 0;
    this.bonus = 0;
    this.jelliesPopped = 0;
    this.minesDestroyed = 0;
    this.gearsEarned = 0;
    this.cachesRevealed = 0;
    this.warpEntered = false;
    this.goldCaught = 0;
    this.hits = 0;
    this.perfect = false;
    this.combo = 0;
    this.comboTimer = 0;
    this.comboTimerMax = COMBO_WINDOW;
    this.comboPulseT = -10;
    this.mult = 1;
    this.nearMisses = 0;
    this.bestCombo = 0;
  }

  start({
    width = 390,
    height = 620,
    towerIndex = 0,
    healing = 0,
    nextTowerName = 'NEXT TOWER',
    nextGlow = '#38bdf8',
    era = 'reboot',
    original = false,
    casual = false,
  } = {}) {
    this.width = Math.max(200, width);
    this.height = Math.max(240, height);
    this.s = this._scaleFor(this.width, this.height);
    this.era = original || era === 'original' ? 'original' : 'reboot';
    this.casual = Boolean(casual);
    this.rideDuration = this.era === 'original' ? ORIG_RIDE_TIME : RIDE_TIME;
    this.towerIndex = Math.max(0, towerIndex | 0);
    this.healing = clamp(Number(healing) || 0, 0, 1);
    this.nextTowerName = String(nextTowerName || 'NEXT TOWER').toUpperCase();
    this.nextGlow = nextGlow || '#38bdf8';
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
    this._fishSpeciesSeq = 0;
    this._prevJump = false;

    this.sonarPulse = 0;
    this.sonarCooldown = 0;
    this.ventBoostTimer = 0;

    this.fish.length = 0;
    this.jellies.length = 0;
    this.mines.length = 0;
    this.clams.length = 0;
    this.bubbles.length = 0;
    this.vents.length = 0;
    this.hiddenCaches.length = 0;
    this.rings.length = 0;
    this.vfx.length = 0;
    this._resetStats();

    this._layout();
    const sub = this.sub;
    Object.assign(sub, this._makeSub());
    sub.rx = 34 * this.s;
    sub.ry = 19 * this.s;
    sub.x = -sub.rx * 2;
    sub.y = this.height * 0.48;
    sub.prop = 1;
    this.sonarOriginX = this.width * 0.26;
    this.sonarOriginY = sub.y;

    const t = this.tower;
    t.active = false;
    t.r = this._towerRadius();
    t.targetX = this.width - t.r * 0.62;
    t.x = this.width + t.r * 1.6;
    t.glow = this.nextGlow;
    t.name = this.nextTowerName;

    const isOrig = this.era === 'original';
    if (!isOrig) {
      this.vents.push(
        {
          x: this.width * 0.62,
          y: this.seabedY,
          width: 54 * this.s,
          phase: 0.4,
          active: true,
          boosted: false,
        },
        {
          x: this.width * 1.18,
          y: this.seabedY,
          width: 58 * this.s,
          phase: 2.1,
          active: true,
          boosted: false,
        }
      );
      this.hiddenCaches.push(
        { x: this.width * 0.72, y: this.seabedY - 46 * this.s },
        { x: this.width * 1.42, y: this.seabedY - 52 * this.s },
        { x: this.width * 2.15, y: this.seabedY - 44 * this.s }
      );
      this.warpCave = {
        x: this.width + 220 * this.s,
        y: Math.max(this.top + 38 * this.s, this.height * 0.24),
        r: 46 * this.s,
        active: true,
        entered: false,
      };
    } else {
      this.warpCave = { x: 9999, y: 120, r: 46, active: false, entered: false };
    }

    const d = this.difficulty;
    const allowHazards = !isOrig && !this.casual;
    this._next = {
      school: 0.85,
      big: isOrig ? Infinity : 3.0 + Math.random() * 1.4,
      jelly: allowHazards ? 2.2 : Infinity,
      mine: allowHazards ? (this.towerIndex >= 1 ? 3.2 + Math.random() * 1.6 : 4.2) : Infinity,
      clam: isOrig ? Infinity : 2.6,
      vent: isOrig ? Infinity : 3.6,
    };
    this._goldAt = !isOrig && Math.random() < 0.6 + this.healing * 0.4 ? rand(6.0, 13.0) : Infinity;
    this._jellyEvery = lerp(3.3, 1.55, d);
    this._mineEvery = lerp(4.8, 2.35, d);
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
    this.top = this.surfaceY + 26 * this.s;
    this.bottom = this.seabedY - 10 * this.s;
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
    for (const v of this.vents) {
      v.x *= kx;
      v.y = this.seabedY;
      v.width *= ks;
    }
    for (const hc of this.hiddenCaches) {
      hc.x *= kx;
      hc.y = this.seabedY - 46 * this.s;
    }
    if (this.warpCave) {
      this.warpCave.x *= kx;
      this.warpCave.y *= ky;
      this.warpCave.r = 46 * this.s;
    }
    for (const b of this.bubbles) fixXY(b);
    this.rings.length = 0;
    this.vfx.length = 0;
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
      minesDestroyed: this.minesDestroyed,
      gearsEarned: this.gearsEarned,
      warpEntered: this.warpEntered,
      cachesRevealed: this.cachesRevealed,
      gold: this.goldCaught,
      hits: this.hits,
      perfect: this.perfect,
      nearMisses: this.nearMisses,
      bestCombo: this.bestCombo,
    };
  }

  get finished() {
    return this._finished;
  }

  get done() {
    return this._finished;
  }

  // ------------------------------------------------------------------ main update
  update(dt, input = {}, firePressed = false, fx = {}, sonarPressed = false) {
    if (!this.active) return this._finished;
    dt = clamp(Number(dt) || 0, 0, 0.05);
    if (this._finished) return true;
    input = input || {};
    fx = fx || {};
    const sound = fx.sound || null;
    this.t += dt;

    if (this.sonarPulse > 0) {
      this.sonarPulse = Math.max(0, this.sonarPulse - dt * 1.12);
    }
    if (this.sonarCooldown > 0) {
      this.sonarCooldown = Math.max(0, this.sonarCooldown - dt);
    }
    if (this.ventBoostTimer > 0) {
      this.ventBoostTimer = Math.max(0, this.ventBoostTimer - dt);
    }

    // Combo decay
    if (this.comboTimer > 0) {
      this.comboTimer -= dt;
      if (this.comboTimer <= 0) {
        this.combo = 0;
        this.mult = 1;
      }
    }

    const dur = this.rideDuration || RIDE_TIME;
    const lead = Math.min(TOWER_LEAD, dur * 0.35);

    // Phases
    if (this.phase === 'intro') {
      if (this.t >= INTRO_TIME) this.phase = 'ride';
    }
    if (this.phase === 'intro' || this.phase === 'ride') {
      this.rideT += dt;
      this.progress = clamp(this.rideT / dur, 0, 1);
      if (!this._bannerShown) {
        this._bannerShown = true;
        if (this.era === 'original') {
          fx.banner?.('BONUS STAGE', 'MK.7 MINI-SUBMARINE');
        } else {
          const pct = Math.round(this.healing * 100);
          fx.banner?.(
            pct > 0 ? `THE SEA IS ${pct}% HEALED` : 'ABYSSAL TRANSIT',
            'ABYSSAL MANTA-SUB MK.7'
          );
        }
      }
      if (this.rideT >= dur - lead) this.tower.active = true;
      if (this.rideT >= dur) this._beginArrival(fx, sound);
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
    const boostK = this.ventBoostTimer > 0 ? 1.24 : 1.0;
    if (tw.active) {
      const remain = tw.x - tw.targetX;
      const ease = clamp(remain / (130 * this.s), 0, 1);
      this.scrollSpeed = this.baseSpeed * Math.max(ease, remain > 1 ? 0.08 : 0);
      tw.x = Math.max(tw.targetX, tw.x - this.scrollSpeed * dt);
    } else {
      this.scrollSpeed = this.baseSpeed * boostK;
    }
    this.scroll += this.scrollSpeed * dt;

    // Detect Sonar Ping & Fire edges (`sonarPressed`, `input.sonar`, `input.jump`, `firePressed`, `input.fire`)
    const jumpNow = Boolean(input.jump || input.sonar);
    const jumpEdge = jumpNow && !this._prevJump;
    this._prevJump = jumpNow;
    const wantSonar = this.era !== 'original' && Boolean(sonarPressed || jumpEdge);

    const fireNow = Boolean(input.fire);
    const fireEdge = fireNow && !this._prevFire;
    this._prevFire = fireNow;
    const wantFire = Boolean(firePressed || fireEdge);

    this._updateSub(dt, input, wantFire, wantSonar, fx, sound);
    this._spawn(dt);
    this._updateVentsAndWarp(dt, fx, sound);
    this._updateBubbles(dt, fx, sound);
    this._updateFish(dt, fx, sound);
    this._updateJellies(dt, fx, sound);
    this._updateMines(dt, fx, sound);
    this._updateClams(dt, fx, sound);

    for (let i = this.rings.length - 1; i >= 0; i--) {
      const r = this.rings[i];
      r.life -= dt;
      r.x -= this.scrollSpeed * dt * (r.isSonar ? 0.2 : 0.5);
      if (r.life <= 0) removeAt(this.rings, i);
    }
    for (let i = this.vfx.length - 1; i >= 0; i--) {
      const e = this.vfx[i];
      e.life -= dt;
      if (e.kind !== 'whoosh' && e.kind !== 'collect') e.x -= this.scrollSpeed * dt * 0.6;
      if (e.life <= 0) removeOrdered(this.vfx, i);
    }
    return false;
  }

  _beginArrival(fx, sound) {
    this.phase = 'arrive';
    this.arriveT = 0;
    this.progress = 1;
    if (this.hits === 0 && this.era !== 'original') {
      this.perfect = true;
      this._score(fx, PERFECT_BONUS);
      fx.popup?.(this.sub.x, this.sub.y - 40 * this.s, `PERFECT RIDE +${PERFECT_BONUS}`, '#fde047');
      sound?.secret?.();
    }
    fx.banner?.(`TOWER ${this.towerIndex + 2}`, `ARRIVING: ${this.nextTowerName}`);
  }

  _score(fx, pts) {
    if (!pts) return;
    this.bonus += pts;
    fx.addScore?.(pts);
  }

  _comboHit() {
    this.combo = this.comboTimer > 0 ? this.combo + 1 : 1;
    this.comboTimer = COMBO_WINDOW;
    this.comboTimerMax = COMBO_WINDOW;
    const prev = this.mult;
    this.mult = Math.min(MAX_MULT, this.combo);
    if (this.mult > prev) this.comboPulseT = this.t;
    if (this.combo > this.bestCombo) this.bestCombo = this.combo;
    return this.mult;
  }

  _vfx(kind, x, y, { life = 0.6, size = 1, color = '#ffffff', a = 0, tx = 0, ty = 0 } = {}) {
    if (this.vfx.length >= MAX_VFX) this.vfx.shift();
    this.vfx.push({ id: ++this._vfxId, kind, x, y, life, maxLife: life, size, color, a, tx, ty });
  }

  _ring(x, y, r0, r1, color, life = 0.45, flat = false, isSonar = false) {
    if (this.rings.length > 22) this.rings.shift();
    this.rings.push({ x, y, r0, r1, color, life, maxLife: life, flat, isSonar });
  }

  triggerSonarPing(fx = {}, sound = null) {
    if (this.era === 'original' || this.sonarCooldown > 0) return false;
    fx = fx || {};
    const sub = this.sub;
    const s = this.s;
    this.sonarPulse = 1.0;
    this.sonarCooldown = SONAR_COOLDOWN;
    this.sonarOriginX = sub.x;
    this.sonarOriginY = sub.y;

    this._ring(sub.x, sub.y, sub.rx * 0.7, 265 * s, '#5efce8', 0.9, false, true);
    this._ring(sub.x, sub.y, sub.rx * 0.4, 175 * s, '#38bdf8', 0.68, false, true);
    this._vfx('sparkle', sub.x, sub.y, { life: 0.6, size: sub.rx * 1.8, color: '#5efce8' });
    fx.shake?.(2.8);
    if (typeof sound?.sonarPing === 'function') sound.sonarPing();
    else if (typeof sound?.boostGate === 'function') sound.boostGate(2);
    else sound?.bubble?.();

    // Repel & cryo-freeze nearby naval mines
    const maxDist = 285 * s;
    for (let i = 0; i < this.mines.length; i++) {
      const m = this.mines[i];
      const dx = m.x - sub.x;
      const dy = m.y - sub.y;
      const dist = Math.hypot(dx, dy) || 1;
      if (dist < maxDist) {
        const push = ((maxDist - dist) / maxDist) * 110 * s;
        m.x += (dx / dist) * push;
        m.baseY = clamp(m.baseY + (dy / dist) * push * 0.6, this.top + 20 * s, this.seabedY - 65 * s);
        m.y = m.baseY;
        m.pushVx = (dx / dist) * 140 * s;
        m.frozenTimer = 1.65;
        fx.particles?.(m.x, m.y, '#67e8f9', 8, 85);
      }
    }

    // Reveal sunken Golden Gear caches within sweep range
    let revealed = 0;
    for (let i = this.hiddenCaches.length - 1; i >= 0; i--) {
      const hc = this.hiddenCaches[i];
      if (hc.x >= 20 * s && hc.x <= this.width + 95 * s) {
        const rx = clamp(hc.x, 52 * s, this.width - 36 * s);
        const ry = clamp(hc.y, this.top + 40 * s, this.seabedY - 36 * s);
        this._spawnGearBubble(rx, ry, true);
        fx.particles?.(rx, ry, '#fde047', 16, 115);
        fx.popup?.(rx, ry - 18 * s, 'SONAR CACHE!', '#fde047');
        removeAt(this.hiddenCaches, i);
        this.cachesRevealed++;
        revealed++;
      }
    }
    if (revealed === 0 && this.cachesRevealed < 3) {
      const rx = clamp(sub.x + 135 * s, 68 * s, this.width - 42 * s);
      const ry = clamp(this.seabedY - 48 * s, this.top + 40 * s, this.seabedY - 34 * s);
      this._spawnGearBubble(rx, ry, true);
      fx.particles?.(rx, ry, '#fde047', 16, 115);
      fx.popup?.(rx, ry - 18 * s, 'SONAR CACHE!', '#fde047');
      this.cachesRevealed++;
    }
    return true;
  }

  _spawnGearBubble(x, y, isSonarCache = false) {
    const s = this.s;
    this.fish.push({
      type: 'gold',
      isGear: true,
      isSonarCache,
      species: 0,
      x,
      y,
      oy: 0,
      baseY: y,
      vx: 0,
      vy: -18 * s,
      swim: 42 * s,
      school: 0,
      color: 0,
      phase: 0,
      amp: 0,
      freq: 1,
      r: 12 * s,
      state: 'bubbled',
      bubbled: true,
      bubbleT: 0.15,
      bubbleR: 22 * s,
      age: 0,
      dir: -1,
      seed: Math.random() * TAU,
    });
  }

  // ------------------------------------------------------------------ submarine
  _updateSub(dt, input, firePressed, wantSonar, fx, sound) {
    const sub = this.sub;
    const pvx = sub.vx;
    const pvy = sub.vy;
    this._moveSub(dt, input, firePressed, wantSonar, fx, sound);
    if (dt > 0) {
      const k = 1 - Math.exp(-10 * dt);
      const ax = clamp((sub.vx - pvx) / dt, -4000, 4000);
      const ay = clamp((sub.vy - pvy) / dt, -4000, 4000);
      sub.ax += (ax - sub.ax) * k;
      sub.ay += (ay - sub.ay) * k;
    }
  }

  _moveSub(dt, input, firePressed, wantSonar, fx, sound) {
    const sub = this.sub;
    const s = this.s;
    const W = this.width;
    const isOrig = this.era === 'original';

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
      const tx = this.tower.x - this.tower.r * 1.4 - sub.rx * 0.2;
      const ty = this.surfaceY - sub.ry * 0.2;
      const dx = tx - sub.x;
      const dy = ty - sub.y;
      const maxV = 240 * s;
      const wantVx = clamp(dx * 2.2, -maxV, maxV);
      const wantVy = clamp(dy * 2.4, -maxV, maxV);
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
        this._ring(sub.x, this.surfaceY, sub.rx * 0.6, sub.rx * 2.6, '#e0f7ff', 0.8, true);
        this._vfx('splash', sub.x, this.surfaceY, { life: 1.4, size: sub.rx, a: sub.vy });
        fx.shake?.(3);
      }
      if (sub.surfaced > 0) {
        sub.surfaced = Math.min(1, sub.surfaced + dt * 1.6);
        this._foamT = (this._foamT || 0) - dt;
        if (this._foamT <= 0) {
          this._foamT = 0.45;
          this._ring(
            sub.x + (Math.random() - 0.5) * sub.rx,
            this.surfaceY + 2 * s,
            sub.rx * 0.4,
            sub.rx * 1.8,
            '#bfe9f5',
            0.7,
            true
          );
        }
      }
      return;
    } else {
      if (sub.stun > 0) {
        sub.stun -= dt;
        const k = Math.max(0, sub.stun / sub.stunMax);
        sub.spin += dt * TAU * 2.2 * (0.3 + k);
        if (sub.stun <= 0) {
          sub.stun = 0;
          sub.spin = Math.round(sub.spin / TAU) * TAU;
        }
        const damp = Math.exp(-2.6 * dt);
        sub.vx *= damp;
        sub.vy *= damp;
        sub.prop = 0.2;
      } else {
        sub.spin += (Math.round(sub.spin / TAU) * TAU - sub.spin) * Math.min(1, dt * 10);
        const rawAx = input.analogX ?? input.axisX ?? 0;
        const rawAy = input.analogY ?? input.axisY ?? 0;
        let ix = Math.abs(rawAx) > 0.04 ? clamp(rawAx, -1, 1) : (input.right ? 1 : 0) - (input.left ? 1 : 0);
        let iy = Math.abs(rawAy) > 0.04 ? clamp(rawAy, -1, 1) : (input.down ? 1 : 0) - (input.up ? 1 : 0);
        const len = Math.hypot(ix, iy);
        if (len > 1) {
          ix /= len;
          iy /= len;
        }
        const boostMult = !isOrig && this.ventBoostTimer > 0 ? 1.32 : 1.0;
        const maxV = 222 * s * boostMult;
        const steering = len > 0.05;
        const reversing = ix * sub.vx < 0 || iy * sub.vy < 0;
        const k = steering ? (reversing ? 9 : 6.2) : 2.8;
        const a = 1 - Math.exp(-k * dt);
        sub.vx += (ix * maxV + (!isOrig && this.ventBoostTimer > 0 ? 55 * s : 0) - sub.vx) * a;
        sub.vy += (iy * maxV - sub.vy) * a;
        sub.prop = 0.75 + Math.max(0, ix) * 0.6 - Math.max(0, -ix) * 0.35 + (this.ventBoostTimer > 0 ? 0.35 : 0);

        if (wantSonar && this.sonarCooldown <= 0) {
          this.triggerSonarPing(fx, sound);
        }

        // Fire: Original enforces 1 active stun bubble; Reboot fires Cryo-Torpedoes
        const heldFire = isOrig ? Boolean(input.fire || input.jump) : Boolean(input.fire);
        const tapFire = Boolean(firePressed && (!wantSonar || input.fire));
        if ((tapFire && sub.fireCd <= 0) || (heldFire && sub.autoCd <= 0 && sub.fireCd <= 0)) {
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
    const isOrig = this.era === 'original';
    if (isOrig && this.bubbles.length >= 1) return;
    if (this.bubbles.length >= 9) return;
    sub.fireCd = isOrig ? 0.22 : 0.16;
    sub.autoCd = 0.3;
    sub.shots++;
    const s = this.s;
    this._vfx('muzzle', sub.x + sub.rx * 1.05, sub.y + sub.ry * 0.15, {
      life: 0.28,
      size: 8 * s,
      color: isOrig ? '#bfefff' : '#5efce8',
    });
    this.bubbles.push({
      x: sub.x + sub.rx * 1.05,
      startX: sub.x + sub.rx * 1.05,
      y: sub.y + sub.ry * 0.15,
      vx: (isOrig ? 295 : 350) * s + Math.max(0, sub.vx) * 0.4,
      vy: sub.vy * 0.12 - (isOrig ? 6 : 2) * s,
      r: (isOrig ? 8.5 : 8.0) * s,
      life: isOrig ? 1.35 : 1.3,
      age: 0,
      seed: Math.random() * TAU,
      isTorpedo: !isOrig,
    });
    sound?.bubble?.();
  }

  // ------------------------------------------------------------------ vents & warp cavern (Reboot)
  _updateVentsAndWarp(dt, fx, sound) {
    if (this.era === 'original') return;
    const s = this.s;
    const sub = this.sub;

    for (let i = this.vents.length - 1; i >= 0; i--) {
      const v = this.vents[i];
      v.x -= this.scrollSpeed * dt;
      v.y = this.seabedY;
      if (
        (this.phase === 'ride' || this.phase === 'intro') &&
        sub.stun <= 0 &&
        Math.abs(sub.x - v.x) < v.width * 0.62 &&
        sub.y > this.surfaceY + (this.seabedY - this.surfaceY) * 0.22
      ) {
        sub.vy -= 410 * s * dt;
        sub.vx += 260 * s * dt;
        this.ventBoostTimer = 0.38;
        if (!v.boosted) {
          v.boosted = true;
          const mult = this._comboHit();
          const pts = VENT_BOOST_POINTS * mult;
          this._score(fx, pts);
          fx.popup?.(sub.x, sub.y - 24 * s, `VENT BOOST! +${pts}`, '#67e8f9');
          this._vfx('whoosh', sub.x, sub.y, { life: 0.4, size: sub.rx * 0.9, a: 1 });
          sound?.bubble?.();
        }
      }
      if (v.x < -v.width - 40 * s) removeAt(this.vents, i);
    }

    for (let i = this.hiddenCaches.length - 1; i >= 0; i--) {
      const hc = this.hiddenCaches[i];
      hc.x -= this.scrollSpeed * 0.72 * dt;
      if (hc.x < -50 * s) removeAt(this.hiddenCaches, i);
    }

    const wc = this.warpCave;
    if (wc && wc.active && !wc.entered && this.rideT >= (this.rideDuration || RIDE_TIME) * 0.52) {
      wc.x -= this.scrollSpeed * 1.04 * dt;
      if (Math.hypot(sub.x - wc.x, sub.y - wc.y) < wc.r) {
        wc.entered = true;
        wc.active = false;
        this.warpEntered = true;
        this.gearsEarned += 5;
        fx.addGear?.(5);
        fx.onWarpCave?.();
        this._score(fx, WARP_CAVE_POINTS);
        this.sub.catches++;
        this._ring(wc.x, wc.y, 12 * s, 115 * s, '#c084fc', 0.75);
        this._ring(wc.x, wc.y, 8 * s, 85 * s, '#5efce8', 0.58);
        this._vfx('sparkle', wc.x, wc.y, { life: 0.8, size: 42 * s, color: '#5efce8' });
        fx.particles?.(wc.x, wc.y, '#c084fc', 20, 145);
        fx.popup?.(sub.x, sub.y - 26 * s, 'WARP CAVERN! +5 GEARS & SHIELD', '#5efce8');
        (sound?.collectStar || sound?.secret)?.call(sound);
      }
      if (wc.x < -90 * s) wc.active = false;
    }
  }

  // ------------------------------------------------------------------ spawning
  _spawn(dt) {
    if (this.phase !== 'ride' && this.phase !== 'intro') return;
    const t = this.rideT;
    const dur = this.rideDuration || RIDE_TIME;
    const lead = Math.min(TOWER_LEAD, dur * 0.35);
    const n = this._next;
    const fishOpen = t < dur - 2.6;
    const hazardOpen = t < dur - lead + 0.6;
    const W = this.width;
    const s = this.s;
    const h = this.healing;
    const minY = this.top + 14 * s;
    const maxY = this.seabedY - 70 * s;

    if (fishOpen && t >= n.school) {
      n.school = t + (this.era === 'original' ? rand(1.8, 2.7) : rand(2.3, 3.4) - h * 0.5);
      const count = this.era === 'original' ? 3 + Math.floor(Math.random() * 3) : 5 + Math.floor(Math.random() * 3) + Math.round(h * 3);
      const cy = rand(minY + 20 * s, maxY - 10 * s);
      const id = ++this._schoolId;
      const color = Math.floor(Math.random() * 5);
      const species = (this._fishSpeciesSeq = (this._fishSpeciesSeq + 1) % 2);
      const swim = rand(40, 70) * s;
      const ph = Math.random() * TAU;
      for (let k = 0; k < count; k++) {
        const rad = 10 * s * Math.sqrt(k + 0.4) * 1.55;
        const ang = k * 2.39996;
        this._addFish({
          type: 'small',
          species,
          x: W + 40 * s + Math.cos(ang) * rad * 1.5,
          oy: Math.sin(ang) * rad * 0.8,
          baseY: cy,
          swim,
          school: id,
          color,
          phase: ph,
          amp: 16 * s,
          freq: 1.9,
          r: 9.5 * s * rand(0.92, 1.12),
        });
      }
    }
    if (fishOpen && t >= n.big) {
      n.big = t + rand(3.6, 5.2) - h * 0.8;
      const species = (this._fishSpeciesSeq = (this._fishSpeciesSeq + 1) % 2);
      this._addFish({
        type: 'big',
        species,
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
        species: 1,
        x: W + 40 * s,
        oy: 0,
        baseY: rand(minY + 30 * s, maxY - 20 * s),
        swim: 105 * s,
        school: 0,
        color: 0,
        phase: 0,
        amp: 46 * s,
        freq: 3.0,
        r: 12.5 * s,
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
      const floating = this.towerIndex >= 4 && Math.random() < 0.32;
      const y = floating ? rand(minY + 20 * s, maxY) : rand(this.height * 0.34, this.seabedY - 92 * s);
      if (!this._crowded(W + 40 * s, y, 80 * s)) {
        this.mines.push({
          x: W + 40 * s,
          y,
          baseY: y,
          r: 16.5 * s,
          kind: floating ? 'float' : 'anchored',
          phase: Math.random() * TAU,
          bob: rand(14, 26) * s,
          blink: Math.random(),
          spin: Math.random() * TAU,
          hp: 1,
          frozenTimer: 0,
          pushVx: 0,
        });
      }
    }
    if (t >= n.clam && t < dur - 5.2) {
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
    if (t >= n.vent && t < dur - 4.5) {
      n.vent = t + rand(3.6, 5.0);
      this.vents.push({
        x: W + 55 * s,
        y: this.seabedY,
        width: rand(48, 64) * s,
        phase: Math.random() * TAU,
        active: true,
        boosted: false,
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
      species: o.species ?? 0,
      isGear: Boolean(o.isGear),
      x: o.x,
      y: o.baseY + o.oy,
      oy: o.oy,
      baseY: o.baseY,
      vx: 0,
      vy: 0,
      swim: o.swim,
      school: o.school,
      color: o.color,
      phase: o.phase,
      amp: o.amp,
      freq: o.freq,
      r: o.r,
      state: 'swim', // swim | bubbled | free
      bubbled: false,
      bubbleT: 0,
      bubbleR: 0,
      age: 0,
      dir: -1,
      seed: Math.random() * TAU,
    });
  }

  // ------------------------------------------------------------------ player shots (Cryo-Torpedoes / Bubbles)
  _updateBubbles(dt, fx, sound) {
    const W = this.width;
    for (let i = this.bubbles.length - 1; i >= 0; i--) {
      const b = this.bubbles[i];
      b.age += dt;
      b.life -= dt;
      b.vx *= Math.exp((b.isTorpedo ? -0.22 : -0.6) * dt);
      b.vy -= (b.isTorpedo ? 3 : 14) * this.s * dt;
      b.x += b.vx * dt;
      b.y += b.vy * dt + Math.sin(b.age * 14 + b.seed) * 0.25 * this.s;
      const origMaxTravel = this.era === 'original' && !b.isTorpedo
        ? b.x - (b.startX ?? b.x) > Math.min(W * 0.72, 360 * this.s)
        : false;
      if (b.life <= 0 || origMaxTravel || b.x > W + 30 * this.s || b.y < this.surfaceY) {
        if (b.life <= 0 || origMaxTravel) this._ring(b.x, b.y, b.r * 0.5, b.r * 1.8, '#bfefff', 0.25);
        removeAt(this.bubbles, i);
        continue;
      }
      if (this._bubbleHits(b, fx, sound)) removeAt(this.bubbles, i);
    }
  }

  _bubbleHits(b, fx, sound) {
    // 1. Fish (encase whole school on Reboot, single fish on 1987 Original)
    for (const f of this.fish) {
      if (f.state !== 'swim') continue;
      const rr = b.r + f.r * 1.28;
      const dx = b.x - f.x;
      const dy = b.y - f.y;
      if (dx * dx + dy * dy < rr * rr) {
        if (f.school && this.era !== 'original') {
          let k = 0;
          for (const g of this.fish) {
            if (g.school === f.school && g.state === 'swim') this._bubbleFish(g, k++ * 0.05);
          }
        } else {
          this._bubbleFish(f, 0);
        }
        sound?.bubble?.();
        this._ring(f.x, f.y, f.r, f.r * 3, '#67e8f9', 0.4);
        this._vfx('sparkle', f.x, f.y, {
          life: 0.55,
          size: f.r * 2.2,
          color: f.type === 'gold' ? '#fde047' : '#a5f3fc',
        });
        return true;
      }
    }

    // 2. Jellyfish
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
        this._vfx('pop', j.x, j.y, { life: 0.6, size: j.r * 1.6, color: '#f0abfc' });
        sound?.jellyZap?.();
        return true;
      }
    }

    // 3. Naval Mines: Reboot Cryo-Torpedo shatters mine for +150 & +1 Gear!
    for (let mi = this.mines.length - 1; mi >= 0; mi--) {
      const m = this.mines[mi];
      const rr = b.r + m.r * 1.35;
      const dx = b.x - m.x;
      const dy = b.y - m.y;
      if (dx * dx + dy * dy < rr * rr) {
        if (b.isTorpedo && this.era !== 'original') {
          this.minesDestroyed++;
          this.gearsEarned++;
          fx.addGear?.(1);
          const mult = this._comboHit();
          const pts = MINE_SHATTER_POINTS * mult;
          this._score(fx, pts);
          fx.popup?.(m.x, m.y - m.r, `MINE SHATTERED! +${pts} +1 GEAR`, '#fbbf24');
          fx.particles?.(m.x, m.y, '#67e8f9', 14, 145);
          fx.particles?.(m.x, m.y, '#fb923c', 10, 120);
          this._ring(m.x, m.y, m.r * 0.7, m.r * 4.2, '#67e8f9', 0.55);
          this._vfx('boom', m.x, m.y, { life: 0.55, size: m.r * 2.4, color: '#fb923c' });
          fx.shake?.(4.5);
          (sound?.hitEnemy || sound?.subHit || sound?.jellyZap)?.call(sound);
          removeAt(this.mines, mi);
        } else {
          fx.particles?.(b.x, b.y, '#e2e8f0', 6, 70);
          this._ring(b.x, b.y, b.r * 0.5, b.r * 2.2, '#e2e8f0', 0.3);
        }
        return true;
      }
    }
    return false;
  }

  _bubbleFish(f, delay) {
    f.state = 'bubbled';
    f.bubbled = delay <= 0;
    f.bubbleT = -delay;
    f.bubbleR = f.r * (f.type === 'small' ? 1.75 : 1.5) + 6 * this.s;
  }

  // ------------------------------------------------------------------ fish & gear bubbles
  _updateFish(dt, fx, sound) {
    const s = this.s;
    const sub = this.sub;
    const canCatch = sub.stun <= 0;
    let caughtSchool = 0;
    for (let i = this.fish.length - 1; i >= 0; i--) {
      const f = this.fish[i];
      f.age += dt;
      if (f.state === 'swim') {
        f.bubbled = false;
        const zig = f.type === 'gold' ? Math.sin(f.age * f.freq * 0.5 + 1.3) * 0.5 : 0;
        f.x += (-this.scrollSpeed - f.swim) * dt;
        const ny =
          f.baseY +
          f.oy +
          Math.sin(f.age * f.freq + f.phase) * f.amp * (1 + zig) +
          Math.sin(f.age * 3.7 + f.seed) * 2 * s;
        f.vy = (ny - f.y) / Math.max(dt, 1e-4);
        f.y = ny;
        if (f.y < this.top) f.y = this.top;
      } else if (f.state === 'bubbled') {
        f.bubbleT += dt;
        if (f.bubbleT < 0) {
          f.bubbled = false;
          f.x += (-this.scrollSpeed - f.swim) * dt;
          continue;
        }
        f.bubbled = true;
        f.x += -this.scrollSpeed * 0.42 * dt + Math.sin(f.bubbleT * 2.2 + f.seed) * 6 * s * dt;
        const rise = (f.isSonarCache ? -16 : -23) * s;
        f.y += rise * dt;
        f.vy = rise;
        if (f.y - f.bubbleR < this.surfaceY) {
          this._ring(f.x, f.y, f.bubbleR * 0.6, f.bubbleR * 2, '#bfefff', 0.35);
          if (f.isGear) {
            removeAt(this.fish, i);
            continue;
          }
          f.state = 'free';
          f.bubbled = false;
          f.swim = 160 * s;
        }
        if (canCatch && f.bubbleT > 0.1) {
          const dx = (f.x - sub.x) / (sub.rx + f.bubbleR * 0.8);
          const dy = (f.y - sub.y) / (sub.ry + f.bubbleR * 0.8);
          if (dx * dx + dy * dy < 1) {
            if (f.isGear) {
              const gAmt = f.isSonarCache ? 2 : 1;
              const pts = f.isSonarCache ? 300 : 150;
              this.gearsEarned += gAmt;
              fx.addGear?.(gAmt);
              this._score(fx, pts);
              this.sub.catches++;
              this._vfx('pop', f.x, f.y, { life: 0.55, size: f.bubbleR, color: '#fde047' });
              this._vfx('collect', f.x, f.y, {
                life: 0.32,
                size: f.r,
                color: '#fde047',
                tx: sub.x,
                ty: sub.y,
              });
              fx.popup?.(f.x, f.y - 18 * s, f.isSonarCache ? `+2 GEARS! +${pts}` : '+1 GEAR!', '#fbbf24');
              fx.particles?.(f.x, f.y, '#fde047', 14, 115);
              (sound?.collectGear || sound?.collect)?.call(sound);
              removeAt(this.fish, i);
              continue;
            }
            if (f.school && this.era !== 'original') caughtSchool = f.school;
            else {
              this._catchSingle(f, fx, sound);
              removeAt(this.fish, i);
              continue;
            }
          }
        }
      } else {
        f.bubbled = false;
        f.x += (-this.scrollSpeed - f.swim) * dt;
        f.y += Math.sin(f.age * 9) * 30 * s * dt;
      }
      if (f.x < -60 * s || f.y < -40 * s) removeAt(this.fish, i);
    }
    if (caughtSchool) this._catchSchool(caughtSchool, fx, sound);
  }

  _catchSingle(f, fx, sound) {
    const isOrig = this.era === 'original';
    const mult = isOrig ? 1 : this._comboHit();
    const base = isOrig ? ORIG_FISH_POINTS : FISH_POINTS[f.type] || 100;
    const pts = base * mult;
    this.fishCaught++;
    this.sub.catches++;
    this._vfx('pop', f.x, f.y, { life: 0.55, size: f.bubbleR, color: f.type === 'gold' ? '#fde047' : '#bdf4ff' });
    this._vfx('collect', f.x, f.y, {
      life: 0.32,
      size: f.r,
      color: f.type === 'gold' ? '#fde047' : '#a5f3fc',
      tx: this.sub.x,
      ty: this.sub.y,
    });
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
        this._vfx('pop', f.x, f.y, { life: 0.5, size: f.bubbleR * 0.8, color: '#bdf4ff' });
        removeAt(this.fish, i);
      } else if (f.state !== 'free') swimmers++;
      total++;
    }
    if (!n) return;
    this.sub.catches++;
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
    this._vfx('collect', sx, sy, { life: 0.32, size: 10 * this.s, color: '#a5f3fc', tx: this.sub.x, ty: this.sub.y });
    if (whole) this._vfx('sparkle', sx, sy, { life: 0.7, size: 40 * this.s, color: '#fef9c3' });
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
    fx.popup?.(
      sub.x,
      sub.y - 30 * this.s,
      penalty > 0 ? `${kind === 'mine' ? 'BOOM!' : 'ZAP!'} -${penalty}` : kind === 'mine' ? 'BOOM!' : 'ZAP!',
      '#fb7185'
    );
    fx.particles?.(sub.x, sub.y, kind === 'mine' ? '#fb923c' : '#f0abfc', 18, 170);
    fx.particles?.(sub.x, sub.y, '#ffffff', 8, 120);
    this._ring(hx, hy, 8 * this.s, 70 * this.s, kind === 'mine' ? '#fb923c' : '#f0abfc', 0.55);
    fx.shake?.(kind === 'mine' ? 9 : 6);
    this._vfx(kind === 'mine' ? 'boom' : 'zap', hx, hy, {
      life: 0.5,
      size: 40 * this.s,
      color: kind === 'mine' ? '#fb923c' : '#f0abfc',
    });
    if (kind === 'mine') (sound?.subHit || sound?.jellyZap)?.call(sound);
    else sound?.jellyZap?.();
  }

  _touchesSub(x, y, r) {
    const sub = this.sub;
    const dx = (x - sub.x) / (sub.rx * 0.88 + r);
    const dy = (y - sub.y) / (sub.ry * 0.85 + r);
    return dx * dx + dy * dy < 1;
  }

  _nearMiss(h, x, y, r, fx, sound) {
    if (h.nearDone) return;
    const sub = this.sub;
    if (this.phase !== 'ride' || sub.stun > 0 || sub.invuln > 0) {
      if (h.nearArmed) h.nearDone = true;
      return;
    }
    const dx = (x - sub.x) / (sub.rx * 0.88 + r);
    const dy = (y - sub.y) / (sub.ry * 0.85 + r);
    if (dx * dx + dy * dy < 2.5) h.nearArmed = true;
    if (h.nearArmed && x < sub.x - sub.rx * 0.6) {
      h.nearDone = true;
      this.nearMisses++;
      sub.nearMisses++;
      const mult = this._comboHit();
      const pts = NEAR_MISS_POINTS * mult;
      this._score(fx, pts);
      fx.popup?.(sub.x, sub.y - 34 * this.s, mult > 1 ? `CLOSE CALL +${pts} x${mult}` : `CLOSE CALL +${pts}`, '#67e8f9');
      this._vfx('whoosh', sub.x, sub.y, { life: 0.45, size: sub.rx, a: y < sub.y ? -1 : 1 });
      (sound?.nearMiss || sound?.whoosh || sound?.gust)?.call(sound);
    }
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
      const thrust = Math.max(0, Math.sin(j.pulse)) ** 2;
      j.baseY -= thrust * 16 * s * dt;
      j.baseY += 7 * s * dt;
      j.baseY = clamp(j.baseY, this.top, this.seabedY - 60 * s);
      j.x += (-this.scrollSpeed * 0.92 - j.drift) * dt + Math.sin(j.age * 0.7 + j.phase) * 8 * s * dt;
      j.y = j.baseY + Math.sin(j.age * 0.9 + j.phase) * 14 * s;
      if (vulnerable && this._touchesSub(j.x, j.y + j.r * 0.25, j.r * 0.8)) {
        j.nearDone = true;
        this._stun(j.x, j.y, fx, sound, 'jelly');
      } else {
        this._nearMiss(j, j.x, j.y + j.r * 0.25, j.r * 0.8, fx, sound);
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
      if (m.frozenTimer > 0) m.frozenTimer = Math.max(0, m.frozenTimer - dt);
      if (m.pushVx) {
        m.x += m.pushVx * dt;
        m.pushVx *= Math.exp(-5 * dt);
        if (Math.abs(m.pushVx) < 1) m.pushVx = 0;
      }
      const speedFactor = m.frozenTimer > 0 ? 0.35 : 1.0;
      m.phase += dt * speedFactor;
      m.blink = (m.blink + dt * 1.6 * speedFactor) % 1;
      m.spin += dt * 0.6 * speedFactor;
      m.x -= this.scrollSpeed * dt;
      if (m.kind === 'float') {
        m.x += Math.sin(m.phase * 0.5) * 10 * s * dt;
        m.y = m.baseY + Math.sin(m.phase * 0.7) * m.bob * 1.4;
      } else {
        m.y = m.baseY + Math.sin(m.phase * 0.9) * m.bob;
      }
      if (vulnerable && (m.frozenTimer || 0) <= 0 && this._touchesSub(m.x, m.y, m.r * 1.05)) {
        m.nearDone = true;
        this._stun(m.x, m.y, fx, sound, 'mine');
      } else {
        this._nearMiss(m, m.x, m.y, m.r * 1.05, fx, sound);
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
          this._vfx('sparkle', c.x, c.y - c.r * 0.4, { life: 0.7, size: c.r * 2.4, color: '#fbcfe8' });
          this.sub.catches++;
          sound?.collect?.(this.pearls - 1);
        }
      }
      if (c.x < -60 * s) removeAt(this.clams, i);
    }
  }
}

export const SUB_STAGE_TIMING = { RIDE_TIME, ORIG_RIDE_TIME, INTRO_TIME, ARRIVE_TIME, TOWER_LEAD };
