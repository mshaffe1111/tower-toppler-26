// TOWERING WATERS: GATEWAY'S DESCENT — CORAL REEF & LAKEBED FREE-SWIM STAGE (`src/subStage.js`)
//
// Pure gameplay simulation (zero DOM/THREE dependencies).
// Gateway swims directly underwater with undulating marine-lizard propulsion through sunlit coral
// gardens, sunken redwood trunks, and kelp forests — shattering Siphon Containment Cages to free
// trapped Sea Turtles & River Otters, firing Hydro-Pulses, riding warm Geyser Vents, and triggering
// Harmonic Echo Shockwaves.
//
// Preserves full `SubStage` property/method compatibility (`this.sub` aliased to `this.swimmer`)
// so `game.js` and `SubRenderer` (`src/subRenderer.js`) interoperate with zero allocations.

const TAU = Math.PI * 2;
const RIDE_TIME = 20;
const INTRO_TIME = 1.1;
const ARRIVE_TIME = 4.6;
const TOWER_LEAD = 5.2;

const FISH_POINTS = { small: 30, big: 200, gold: 800 };
const JELLY_POINTS = 100;
const MINE_SHATTER_POINTS = 150;
const CAGE_RESCUE_POINTS = 350;
const PEARL_POINTS = 400;
const VENT_BOOST_POINTS = 120;
const GROTTO_POINTS = 500;
const PERFECT_BONUS = 750;
const SCHOOL_BONUS = 160;
const HIT_PENALTY = 100;
const MAX_MULT = 4;
const NEAR_MISS_POINTS = 50;
const COMBO_WINDOW = 2.5;
const SONAR_COOLDOWN = 3.2;
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

function removeOrdered(arr, i) {
  for (let k = i; k < arr.length - 1; k++) arr[k] = arr[k + 1];
  arr.pop();
}

export class SubStage {
  constructor(opts = null) {
    this.width = 390;
    this.height = 620;
    this.s = 1;
    this.biome = 'coral_sea';
    this.casual = false;
    this.rideDuration = RIDE_TIME;
    this.active = false;
    this.phase = 'idle'; // idle | intro | ride | arrive | done
    this.sub = this._makeSwimmer();
    this.swimmer = this.sub;
    this.fish = [];
    this.cages = []; // Siphon wildlife cages holding trapped sea turtles & river otters
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
    this.rings = [];
    this.vfx = [];
    this._vfxId = 0;
    this._prevJump = false;
    this._prevFire = false;
    this._prevWhip = false;
    this.tower = { active: false, x: 0, r: 100, targetX: 0, glow: '#38bdf8', name: '' };
    this._resetStats();
    if (
      opts &&
      typeof opts === 'object' &&
      opts.autoStart !== false &&
      (opts.biome !== undefined || opts.fromIdx !== undefined || opts.towerIndex !== undefined)
    ) {
      this.start({
        ...opts,
        towerIndex: opts.towerIndex ?? opts.fromIdx ?? 0,
      });
    }
  }

  _makeSwimmer() {
    return {
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      rx: 32,
      ry: 18,
      stun: 0,
      stunMax: 1,
      invuln: 0,
      spin: 0,
      whipTimer: 0,
      swimCycle: 0,
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
    this.wildlifeFreed = 0;
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
    biome = null,
    healing = 0.65,
    nextTowerName = 'NEXT SPIRE',
    nextGlow = '#38bdf8',
    casual = false,
  } = {}) {
    this.width = Math.max(200, width);
    this.height = Math.max(240, height);
    this.s = this._scaleFor(this.width, this.height);
    this.biome = biome || (towerIndex < 2 ? 'canyon_river' : towerIndex < 4 ? 'alpine_lake' : 'coral_sea');
    this.casual = Boolean(casual);
    this.rideDuration = RIDE_TIME;
    this.towerIndex = Math.max(0, towerIndex | 0);
    this.healing = clamp(Number(healing ?? 0.65) || 0, 0, 1);
    this.nextTowerName = String(nextTowerName || 'NEXT SPIRE').toUpperCase();
    this.nextGlow = nextGlow || '#38bdf8';
    this.difficulty = clamp(this.towerIndex / 6, 0, 1);

    this.active = true;
    this.phase = 'intro';
    this.t = 0;
    this.rideT = 0;
    this.arriveT = 0;
    this.progress = 0;
    this.scroll = 0;
    this.baseSpeed = 96 * this.s;
    this.scrollSpeed = this.baseSpeed;
    this._finished = false;
    this._bannerShown = false;
    this._schoolId = 0;
    this._fishSpeciesSeq = 0;
    this._cageSeq = 0;
    this._prevJump = false;
    this._prevFire = false;
    this._prevWhip = false;

    this.sonarPulse = 0;
    this.sonarCooldown = 0;
    this.ventBoostTimer = 0;

    this.fish.length = 0;
    this.cages.length = 0;
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
    const portrait = this.width / Math.max(1, this.height) < 0.85;
    const swimmer = this.sub;
    Object.assign(swimmer, this._makeSwimmer());
    swimmer.rx = 32 * this.s;
    swimmer.ry = 18 * this.s;
    swimmer.x = -swimmer.rx * 1.4;
    swimmer.y = this.height * 0.48;
    swimmer.prop = 1;
    this.sonarOriginX = this.width * (portrait ? 0.38 : 0.28);
    this.sonarOriginY = swimmer.y;

    const t = this.tower;
    t.active = false;
    t.r = this._towerRadius();
    t.targetX = this.width - t.r * 0.62;
    t.x = this.width + t.r * 1.6;
    t.glow = this.nextGlow;
    t.name = this.nextTowerName;

    this.vents.push(
      {
        x: this.width * 0.62,
        y: this.seabedY,
        width: 56 * this.s,
        phase: 0.4,
        active: true,
        boosted: false,
      },
      {
        x: this.width * 1.22,
        y: this.seabedY,
        width: 60 * this.s,
        phase: 2.1,
        active: true,
        boosted: false,
      }
    );

    // Spawn initial trapped wildlife cage right into view inside safe portrait/desktop framing!
    this._spawnCage(this.width * (portrait ? 0.72 : 0.78), this.height * 0.44);

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

    const d = this.difficulty;
    const allowHazards = !this.casual;
    this._next = {
      school: 0.85,
      big: 2.9 + Math.random() * 1.3,
      cage: 2.4,
      jelly: allowHazards ? 2.4 : Infinity,
      mine: allowHazards ? (this.towerIndex >= 1 ? 3.4 + Math.random() * 1.5 : 4.4) : Infinity,
      clam: 2.6,
      vent: 3.6,
    };
    this._goldAt = Math.random() < 0.68 + this.healing * 0.32 ? rand(6.0, 13.0) : Infinity;
    this._jellyEvery = lerp(3.4, 1.65, d);
    this._mineEvery = lerp(4.8, 2.45, d);
  }

  _scaleFor(w, h) {
    return clamp(Math.sqrt((w * h) / (390 * 620)), 0.8, 1.6);
  }

  _towerRadius() {
    return clamp(this.width * 0.3, 70 * this.s, 190 * this.s);
  }

  _layout() {
    const portrait = this.width / Math.max(1, this.height) < 0.85;
    this.surfaceY = portrait ? this.height * 0.145 : this.height * 0.11;
    this.seabedY = portrait ? this.height * 0.845 : this.height * 0.895;
    this.top = this.surfaceY + 24 * this.s;
    this.bottom = this.seabedY - 18 * this.s;
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
    const swimmer = this.sub;
    swimmer.x *= kx;
    swimmer.y *= ky;
    swimmer.rx *= ks;
    swimmer.ry *= ks;
    for (const f of this.fish) fixXY(f);
    for (const cg of this.cages) fixXY(cg);
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
    this.baseSpeed = 96 * this.s;
    const t = this.tower;
    t.r = this._towerRadius();
    t.targetX = this.width - t.r * 0.62;
    t.x *= kx;
  }

  get results() {
    return {
      fish: this.fishCaught,
      wildlifeFreed: this.wildlifeFreed,
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

    if (this.comboTimer > 0) {
      this.comboTimer -= dt;
      if (this.comboTimer <= 0) {
        this.combo = 0;
        this.mult = 1;
      }
    }

    const dur = this.rideDuration || RIDE_TIME;
    const lead = Math.min(TOWER_LEAD, dur * 0.35);

    if (this.phase === 'intro') {
      if (this.t >= INTRO_TIME) this.phase = 'ride';
    }
    if (this.phase === 'intro' || this.phase === 'ride') {
      this.rideT += dt;
      this.progress = clamp(this.rideT / dur, 0, 1);
      if (!this._bannerShown) {
        this._bannerShown = true;
        const pct = Math.round(this.healing * 100);
        fx.banner?.(
          pct > 0 ? `WATERSHED ${pct}% RESTORED` : 'SUNLIT REEF PASSAGE',
          'GATEWAY FREE-SWIM'
        );
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

    const tw = this.tower;
    const boostK = this.ventBoostTimer > 0 ? 1.26 : 1.0;
    if (tw.active) {
      const remain = tw.x - tw.targetX;
      const ease = clamp(remain / (130 * this.s), 0, 1);
      this.scrollSpeed = this.baseSpeed * Math.max(ease, remain > 1 ? 0.08 : 0);
      tw.x = Math.max(tw.targetX, tw.x - this.scrollSpeed * dt);
    } else {
      this.scrollSpeed = this.baseSpeed * boostK;
    }
    this.scroll += this.scrollSpeed * dt;

    const jumpNow = Boolean(input.jump || input.sonar);
    const jumpEdge = jumpNow && !this._prevJump;
    this._prevJump = jumpNow;

    const whipNow = Boolean(input.whip);
    const whipEdge = whipNow && !this._prevWhip;
    this._prevWhip = whipNow;

    const wantSonar = Boolean(sonarPressed || jumpEdge || whipEdge);

    const fireNow = Boolean(input.fire);
    const fireEdge = fireNow && !this._prevFire;
    this._prevFire = fireNow;
    const wantFire = Boolean(firePressed || fireEdge);

    if (whipEdge) {
      this.sub.whipTimer = 0.42;
      this._whipNearbyCages(fx, sound);
    }

    this._updateSwimmer(dt, input, wantFire, wantSonar, fx, sound);
    this._spawn(dt);
    this._updateVentsAndGrotto(dt, fx, sound);
    this._updateBubbles(dt, fx, sound);
    this._updateCages(dt, fx, sound);
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
    if (this.hits === 0) {
      this.perfect = true;
      this._score(fx, PERFECT_BONUS);
      fx.popup?.(this.sub.x, this.sub.y - 40 * this.s, `PURE TIDE SWIM +${PERFECT_BONUS}`, '#fde047');
      sound?.secret?.();
    }
    fx.banner?.(`SPIRE ${this.towerIndex + 2}`, `ARRIVING: ${this.nextTowerName}`);
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

  _spawnCage(x, y) {
    const s = this.s;
    const animal = (this._cageSeq++ % 2 === 0) ? 'turtle' : 'otter';
    this.cages.push({
      x,
      y,
      baseY: y,
      vx: 0,
      vy: 0,
      r: 25 * s,
      animal, // 'turtle' | 'otter'
      state: 'caged', // 'caged' | 'freed'
      freedT: 0,
      phase: Math.random() * TAU,
      age: 0,
    });
  }

  _freeCage(cg, fx, sound) {
    if (!cg || cg.state !== 'caged') return;
    const s = this.s;
    cg.state = 'freed';
    cg.freedT = 0;
    cg.vx = 135 * s;
    cg.vy = -28 * s;
    this.wildlifeFreed++;
    this.gearsEarned += 2;
    fx.addGear?.(2);
    this.sub.catches++;
    const mult = this._comboHit();
    const pts = CAGE_RESCUE_POINTS * mult;
    this._score(fx, pts);

    const label = cg.animal === 'turtle' ? 'SEA TURTLE FREED!' : 'RIVER OTTER FREED!';
    fx.popup?.(cg.x, cg.y - 26 * s, `${label} +${pts}`, '#5efce8');
    fx.particles?.(cg.x, cg.y, '#5efce8', 18, 145);
    fx.particles?.(cg.x, cg.y, '#fde047', 10, 110);
    this._ring(cg.x, cg.y, cg.r * 0.6, cg.r * 3.8, '#5efce8', 0.65);
    this._vfx('sparkle', cg.x, cg.y, { life: 0.75, size: cg.r * 2.2, color: '#5efce8' });
    fx.shake?.(3.2);
    (sound?.collectStar || sound?.secret || sound?.pickup)?.call(sound);
  }

  _whipNearbyCages(fx, sound) {
    const swimmer = this.sub;
    const reach = 105 * this.s;
    this._ring(swimmer.x, swimmer.y, swimmer.rx * 0.5, reach, '#67e8f9', 0.36);
    for (let i = 0; i < this.cages.length; i++) {
      const cg = this.cages[i];
      if (cg.state === 'caged' && Math.hypot(cg.x - swimmer.x, cg.y - swimmer.y) < reach + cg.r) {
        this._freeCage(cg, fx, sound);
      }
    }
  }

  triggerSonarPing(fx = {}, sound = null) {
    if (this.sonarCooldown > 0) return false;
    fx = fx || {};
    const swimmer = this.sub;
    const s = this.s;
    this.sonarPulse = 1.0;
    this.sonarCooldown = SONAR_COOLDOWN;
    this.sonarOriginX = swimmer.x;
    this.sonarOriginY = swimmer.y;
    swimmer.whipTimer = Math.max(swimmer.whipTimer || 0, 0.38);

    this._ring(swimmer.x, swimmer.y, swimmer.rx * 0.7, 275 * s, '#5efce8', 0.9, false, true);
    this._ring(swimmer.x, swimmer.y, swimmer.rx * 0.4, 180 * s, '#38bdf8', 0.68, false, true);
    this._vfx('sparkle', swimmer.x, swimmer.y, { life: 0.6, size: swimmer.rx * 1.8, color: '#5efce8' });
    fx.shake?.(2.6);
    if (typeof sound?.sonarPing === 'function') sound.sonarPing();
    else if (typeof sound?.boostGate === 'function') sound.boostGate(2);
    else sound?.bubble?.();

    // Repel & encase nearby Siphon Surge Mines
    const maxDist = 285 * s;
    for (let i = 0; i < this.mines.length; i++) {
      const m = this.mines[i];
      const dx = m.x - swimmer.x;
      const dy = m.y - swimmer.y;
      const dist = Math.hypot(dx, dy) || 1;
      if (dist < maxDist) {
        const push = ((maxDist - dist) / maxDist) * 110 * s;
        m.x += (dx / dist) * push;
        m.baseY = clamp(m.baseY + (dy / dist) * push * 0.6, this.top + 20 * s, this.seabedY - 65 * s);
        m.y = m.baseY;
        m.pushVx = (dx / dist) * 140 * s;
        m.frozenTimer = 1.75;
        fx.particles?.(m.x, m.y, '#67e8f9', 8, 85);
      }
    }

    // Shatter Siphon Wildlife Cages within harmonic shockwave radius!
    for (let i = 0; i < this.cages.length; i++) {
      const cg = this.cages[i];
      if (cg.state === 'caged' && Math.hypot(cg.x - swimmer.x, cg.y - swimmer.y) < 235 * s) {
        this._freeCage(cg, fx, sound);
      }
    }

    // Reveal sunken Harmonic Seed Caches
    let revealed = 0;
    for (let i = this.hiddenCaches.length - 1; i >= 0; i--) {
      const hc = this.hiddenCaches[i];
      if (hc.x >= 20 * s && hc.x <= this.width + 95 * s) {
        const rx = clamp(hc.x, 52 * s, this.width - 36 * s);
        const ry = clamp(hc.y, this.top + 40 * s, this.seabedY - 36 * s);
        this._spawnGearBubble(rx, ry, true);
        fx.particles?.(rx, ry, '#fde047', 16, 115);
        fx.popup?.(rx, ry - 18 * s, 'HARMONIC CACHE!', '#fde047');
        removeAt(this.hiddenCaches, i);
        this.cachesRevealed++;
        revealed++;
      }
    }
    if (revealed === 0 && this.cachesRevealed < 3) {
      const rx = clamp(swimmer.x + 135 * s, 68 * s, this.width - 42 * s);
      const ry = clamp(this.seabedY - 48 * s, this.top + 40 * s, this.seabedY - 34 * s);
      this._spawnGearBubble(rx, ry, true);
      fx.particles?.(rx, ry, '#fde047', 16, 115);
      fx.popup?.(rx, ry - 18 * s, 'HARMONIC CACHE!', '#fde047');
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

  _updateSwimmer(dt, input, firePressed, wantSonar, fx, sound) {
    const swimmer = this.sub;
    const pvx = swimmer.vx;
    const pvy = swimmer.vy;
    if (swimmer.whipTimer > 0) swimmer.whipTimer = Math.max(0, swimmer.whipTimer - dt);
    this._moveSwimmer(dt, input, firePressed, wantSonar, fx, sound);
    swimmer.swimCycle += dt * (4.6 + swimmer.prop * 3.8);
    if (dt > 0) {
      const k = 1 - Math.exp(-10 * dt);
      const ax = clamp((swimmer.vx - pvx) / dt, -4000, 4000);
      const ay = clamp((swimmer.vy - pvy) / dt, -4000, 4000);
      swimmer.ax += (ax - swimmer.ax) * k;
      swimmer.ay += (ay - swimmer.ay) * k;
    }
  }

  _moveSwimmer(dt, input, firePressed, wantSonar, fx, sound) {
    const swimmer = this.sub;
    const s = this.s;
    const W = this.width;

    if (swimmer.invuln > 0) swimmer.invuln -= dt;
    if (swimmer.fireCd > 0) swimmer.fireCd -= dt;
    if (swimmer.autoCd > 0) swimmer.autoCd -= dt;

    const portrait = W / Math.max(1, this.height) < 0.85;

    if (this.phase === 'intro') {
      const k = smooth(clamp(this.t / INTRO_TIME, 0, 1));
      const tx = lerp(-swimmer.rx * 1.4, W * (portrait ? 0.38 : 0.28), k);
      swimmer.vx = (tx - swimmer.x) / Math.max(dt, 1e-4);
      swimmer.x = tx;
      swimmer.vy *= 0.9;
      swimmer.y += swimmer.vy * dt;
      swimmer.prop = 1.35;
    } else if (this.phase === 'arrive') {
      const tx = this.tower.x - this.tower.r * 1.4 - swimmer.rx * 0.2;
      const ty = this.surfaceY - swimmer.ry * 0.15;
      const dx = tx - swimmer.x;
      const dy = ty - swimmer.y;
      const maxV = 248 * s;
      const wantVx = clamp(dx * 2.2, -maxV, maxV);
      const wantVy = clamp(dy * 2.4, -maxV, maxV);
      const a = Math.min(1, dt * 4);
      swimmer.vx += (wantVx - swimmer.vx) * a;
      swimmer.vy += (wantVy - swimmer.vy) * a;
      swimmer.x += swimmer.vx * dt;
      swimmer.y += swimmer.vy * dt;
      swimmer.stun = Math.max(0, swimmer.stun - dt);
      swimmer.spin *= Math.exp(-6 * dt);
      swimmer.prop = Math.max(0.25, Math.min(1.25, Math.hypot(dx, dy) / (60 * s)));
      const near = swimmer.y - this.surfaceY < swimmer.ry * 0.9 && Math.abs(dx) < 42 * s;
      if (near && swimmer.surfaced === 0) {
        swimmer.surfaced = 0.001;
        sound?.subSurface?.();
        fx.particles?.(swimmer.x, this.surfaceY, '#e0f7ff', 18, 150);
        fx.particles?.(swimmer.x - swimmer.rx * 0.6, this.surfaceY, '#5efce8', 10, 110);
        this._ring(swimmer.x, this.surfaceY, swimmer.rx * 0.6, swimmer.rx * 2.6, '#e0f7ff', 0.8, true);
        this._vfx('splash', swimmer.x, this.surfaceY, { life: 1.4, size: swimmer.rx, a: swimmer.vy });
        fx.shake?.(2.5);
      }
      if (swimmer.surfaced > 0) {
        swimmer.surfaced = Math.min(1, swimmer.surfaced + dt * 1.6);
        this._foamT = (this._foamT || 0) - dt;
        if (this._foamT <= 0) {
          this._foamT = 0.45;
          this._ring(
            swimmer.x + (Math.random() - 0.5) * swimmer.rx,
            this.surfaceY + 2 * s,
            swimmer.rx * 0.4,
            swimmer.rx * 1.8,
            '#bfe9f5',
            0.7,
            true
          );
        }
      }
      return;
    } else {
      if (swimmer.stun > 0) {
        swimmer.stun -= dt;
        const k = Math.max(0, swimmer.stun / swimmer.stunMax);
        swimmer.spin += dt * TAU * 2.0 * (0.3 + k);
        if (swimmer.stun <= 0) {
          swimmer.stun = 0;
          swimmer.spin = Math.round(swimmer.spin / TAU) * TAU;
        }
        const damp = Math.exp(-2.6 * dt);
        swimmer.vx *= damp;
        swimmer.vy *= damp;
        swimmer.prop = 0.25;
      } else {
        swimmer.spin += (Math.round(swimmer.spin / TAU) * TAU - swimmer.spin) * Math.min(1, dt * 10);
        const rawAx = input.analogX ?? input.axisX ?? 0;
        const rawAy = input.analogY ?? input.axisY ?? 0;
        let ix = Math.abs(rawAx) > 0.04 ? clamp(rawAx, -1, 1) : (input.right ? 1 : 0) - (input.left ? 1 : 0);
        let iy = Math.abs(rawAy) > 0.04 ? clamp(rawAy, -1, 1) : (input.down ? 1 : 0) - (input.up ? 1 : 0);
        const len = Math.hypot(ix, iy);
        if (len > 1) {
          ix /= len;
          iy /= len;
        }
        const boostMult = this.ventBoostTimer > 0 ? 1.36 : 1.0;
        const maxV = 238 * s * boostMult;
        const steering = len > 0.05;
        const reversing = ix * swimmer.vx < 0 || iy * swimmer.vy < 0;
        // Real hydrodynamic water drag (quadratic drag at high speed + buoyant neutral-depth restoration)
        const curSpeed = Math.hypot(swimmer.vx, swimmer.vy);
        const dragFactor = 1.0 + clamp(curSpeed / Math.max(1, maxV), 0, 1.5) * 0.55;
        const k = (steering ? (reversing ? 8.8 : 6.4) : 2.6) * dragFactor;
        const a = 1 - Math.exp(-k * dt);
        // Gentle marine buoyancy + undulating tail-kick surge when gliding underwater
        const midWaterY = (this.top + this.bottom) * 0.48;
        const buoyancyVy = Math.abs(iy) < 0.05
          ? clamp((midWaterY - swimmer.y) * 0.42, -26 * s, 26 * s) + Math.sin(this.t * 2.2) * 10 * s
          : 0;
        const tailSurgeVx = steering && ix >= 0 ? Math.sin(swimmer.swimCycle) * 14 * s : 0;
        const targetVx = ix * maxV + tailSurgeVx + (this.ventBoostTimer > 0 ? 58 * s : 0);
        const targetVy = iy * maxV + buoyancyVy;
        swimmer.vx += (targetVx - swimmer.vx) * a;
        swimmer.vy += (targetVy - swimmer.vy) * a;
        swimmer.prop = 0.82 + Math.max(0, ix) * 0.65 - Math.max(0, -ix) * 0.3 + (this.ventBoostTimer > 0 ? 0.42 : 0);

        if (wantSonar && this.sonarCooldown <= 0) {
          this.triggerSonarPing(fx, sound);
        }

        const heldFire = Boolean(input.fire);
        const tapFire = Boolean(firePressed && (!wantSonar || input.fire));
        if ((tapFire && swimmer.fireCd <= 0) || (heldFire && swimmer.autoCd <= 0 && swimmer.fireCd <= 0)) {
          this._fire(sound);
        }
      }
      swimmer.x += swimmer.vx * dt;
      swimmer.y += swimmer.vy * dt;
    }

    const minX = portrait ? Math.max(swimmer.rx * 1.65, W * 0.22) : Math.max(swimmer.rx * 1.35, W * 0.14);
    const maxX = portrait ? Math.min(W - swimmer.rx * 1.65, W * 0.80) : Math.min(W - swimmer.rx * 1.35, W * 0.86);
    if (this.phase !== 'intro') {
      if (swimmer.x < minX) {
        swimmer.x = minX;
        if (swimmer.vx < 0) swimmer.vx = 0;
      } else if (swimmer.x > maxX) {
        swimmer.x = maxX;
        if (swimmer.vx > 0) swimmer.vx = 0;
      }
    }
    if (swimmer.y < this.top) {
      swimmer.y = this.top;
      if (swimmer.vy < 0) swimmer.vy = 0;
    } else if (swimmer.y > this.bottom) {
      swimmer.y = this.bottom;
      if (swimmer.vy > 0) swimmer.vy = 0;
    }
  }

  _fire(sound) {
    const swimmer = this.sub;
    if (this.bubbles.length >= 9) return;
    swimmer.fireCd = 0.16;
    swimmer.autoCd = 0.28;
    swimmer.shots++;
    const s = this.s;
    this._vfx('muzzle', swimmer.x + swimmer.rx * 1.05, swimmer.y + swimmer.ry * 0.08, {
      life: 0.28,
      size: 8.5 * s,
      color: '#5efce8',
    });
    this.bubbles.push({
      x: swimmer.x + swimmer.rx * 1.05,
      startX: swimmer.x + swimmer.rx * 1.05,
      y: swimmer.y + swimmer.ry * 0.08,
      vx: 360 * s + Math.max(0, swimmer.vx) * 0.4,
      vy: swimmer.vy * 0.12 - 2 * s,
      r: 8.2 * s,
      life: 1.35,
      age: 0,
      seed: Math.random() * TAU,
      isTorpedo: true,
    });
    sound?.bubble?.();
  }

  _updateVentsAndGrotto(dt, fx, sound) {
    const s = this.s;
    const swimmer = this.sub;

    for (let i = this.vents.length - 1; i >= 0; i--) {
      const v = this.vents[i];
      v.x -= this.scrollSpeed * dt;
      v.y = this.seabedY;
      if (
        (this.phase === 'ride' || this.phase === 'intro') &&
        swimmer.stun <= 0 &&
        Math.abs(swimmer.x - v.x) < v.width * 0.62 &&
        swimmer.y > this.surfaceY + (this.seabedY - this.surfaceY) * 0.22
      ) {
        swimmer.vy -= 410 * s * dt;
        swimmer.vx += 260 * s * dt;
        this.ventBoostTimer = 0.38;
        if (!v.boosted) {
          v.boosted = true;
          const mult = this._comboHit();
          const pts = VENT_BOOST_POINTS * mult;
          this._score(fx, pts);
          fx.popup?.(swimmer.x, swimmer.y - 24 * s, `GEYSER SURGE! +${pts}`, '#67e8f9');
          this._vfx('whoosh', swimmer.x, swimmer.y, { life: 0.4, size: swimmer.rx * 0.9, a: 1 });
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
      if (Math.hypot(swimmer.x - wc.x, swimmer.y - wc.y) < wc.r) {
        wc.entered = true;
        wc.active = false;
        this.warpEntered = true;
        this.gearsEarned += 5;
        fx.addGear?.(5);
        fx.onWarpCave?.();
        this._score(fx, GROTTO_POINTS);
        this.sub.catches++;
        this._ring(wc.x, wc.y, 12 * s, 115 * s, '#5efce8', 0.75);
        this._ring(wc.x, wc.y, 8 * s, 85 * s, '#fde047', 0.58);
        this._vfx('sparkle', wc.x, wc.y, { life: 0.8, size: 42 * s, color: '#5efce8' });
        fx.particles?.(wc.x, wc.y, '#5efce8', 20, 145);
        fx.popup?.(swimmer.x, swimmer.y - 26 * s, 'CORAL SANCTUARY! +5 SEEDS & AEGIS', '#5efce8');
        (sound?.collectStar || sound?.secret)?.call(sound);
      }
      if (wc.x < -90 * s) wc.active = false;
    }
  }

  _spawn(_dt) {
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
      n.school = t + rand(2.2, 3.3) - h * 0.45;
      const count = 5 + Math.floor(Math.random() * 3) + Math.round(h * 3);
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
    if (fishOpen && t >= n.cage) {
      n.cage = t + rand(4.2, 5.6);
      const cy = rand(minY + 28 * s, maxY - 18 * s);
      this._spawnCage(W + 52 * s, cy);
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
    for (const cg of this.cages) if (Math.abs(cg.x - x) < dist && Math.abs(cg.y - y) < dist) return true;
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
      state: 'swim',
      bubbled: false,
      bubbleT: 0,
      bubbleR: 0,
      age: 0,
      dir: -1,
      seed: Math.random() * TAU,
    });
  }

  _updateCages(dt, fx, sound) {
    const s = this.s;
    const swimmer = this.sub;
    for (let i = this.cages.length - 1; i >= 0; i--) {
      const cg = this.cages[i];
      cg.age += dt;
      if (cg.state === 'caged') {
        cg.x -= this.scrollSpeed * 0.88 * dt;
        cg.y = cg.baseY + Math.sin(cg.age * 1.9 + cg.phase) * 11 * s;
        // Touching cage directly with Gateway also frees the trapped guardian!
        if (swimmer.stun <= 0 && this._touchesSub(cg.x, cg.y, cg.r * 0.95)) {
          this._freeCage(cg, fx, sound);
        }
        if (cg.x < -80 * s) removeAt(this.cages, i);
      } else {
        cg.freedT += dt;
        cg.x += cg.vx * dt;
        cg.y += cg.vy * dt + Math.sin(cg.freedT * 7.5 + cg.phase) * 32 * s * dt;
        cg.vy *= Math.exp(-1.5 * dt);
        if (cg.x > this.width + 110 * s || cg.freedT > 4.2) {
          removeAt(this.cages, i);
        }
      }
    }
  }

  _updateBubbles(dt, fx, sound) {
    const W = this.width;
    for (let i = this.bubbles.length - 1; i >= 0; i--) {
      const b = this.bubbles[i];
      b.age += dt;
      b.life -= dt;
      b.vx *= Math.exp(-0.20 * dt);
      b.vy -= 3 * this.s * dt;
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
    // 0. Siphon Wildlife Cages (top priority!)
    for (const cg of this.cages) {
      if (cg.state !== 'caged') continue;
      const rr = b.r + cg.r * 1.25;
      const dx = b.x - cg.x;
      const dy = b.y - cg.y;
      if (dx * dx + dy * dy < rr * rr) {
        this._freeCage(cg, fx, sound);
        return true;
      }
    }

    // 1. Reef Fish Schools
    for (const f of this.fish) {
      if (f.state !== 'swim') continue;
      const rr = b.r + f.r * 1.28;
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

    // 3. Siphon Surge Mines
    for (let mi = this.mines.length - 1; mi >= 0; mi--) {
      const m = this.mines[mi];
      const rr = b.r + m.r * 1.35;
      const dx = b.x - m.x;
      const dy = b.y - m.y;
      if (dx * dx + dy * dy < rr * rr) {
        this.minesDestroyed++;
        this.gearsEarned++;
        fx.addGear?.(1);
        const mult = this._comboHit();
        const pts = MINE_SHATTER_POINTS * mult;
        this._score(fx, pts);
        fx.popup?.(m.x, m.y - m.r, `SIPHON SHATTERED! +${pts}`, '#fbbf24');
        fx.particles?.(m.x, m.y, '#67e8f9', 14, 145);
        fx.particles?.(m.x, m.y, '#fb923c', 10, 120);
        this._ring(m.x, m.y, m.r * 0.7, m.r * 4.2, '#67e8f9', 0.55);
        this._vfx('boom', m.x, m.y, { life: 0.55, size: m.r * 2.4, color: '#fb923c' });
        fx.shake?.(4.2);
        (sound?.hitEnemy || sound?.subHit || sound?.jellyZap)?.call(sound);
        removeAt(this.mines, mi);
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

  _updateFish(dt, fx, sound) {
    const s = this.s;
    const swimmer = this.sub;
    const canCatch = swimmer.stun <= 0;
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
          const dx = (f.x - swimmer.x) / (swimmer.rx + f.bubbleR * 0.8);
          const dy = (f.y - swimmer.y) / (swimmer.ry + f.bubbleR * 0.8);
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
                tx: swimmer.x,
                ty: swimmer.y,
              });
              fx.popup?.(f.x, f.y - 18 * s, f.isSonarCache ? `+2 SEEDS! +${pts}` : '+1 SEED!', '#fbbf24');
              fx.particles?.(f.x, f.y, '#fde047', 14, 115);
              (sound?.collectGear || sound?.collect)?.call(sound);
              removeAt(this.fish, i);
              continue;
            }
            if (f.school) caughtSchool = f.school;
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
    const mult = this._comboHit();
    const base = FISH_POINTS[f.type] || 100;
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
      fx.popup?.(f.x, f.y - 22 * this.s, `SUNLIT RAY! +${pts}`, '#fde047');
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
    const label = `${whole ? 'SHOAL ' : ''}+${pts}${mult > 1 ? ` x${mult}` : ''}`;
    fx.popup?.(sx, sy - 20 * this.s, label, mult > 1 ? '#f472b6' : '#86efac');
    fx.particles?.(sx, sy, '#ffffff', 10, 140);
    this._vfx('collect', sx, sy, { life: 0.32, size: 10 * this.s, color: '#a5f3fc', tx: this.sub.x, ty: this.sub.y });
    if (whole) this._vfx('sparkle', sx, sy, { life: 0.7, size: 40 * this.s, color: '#fef9c3' });
    sound?.catchFish?.();
  }

  _stun(hx, hy, fx, sound, kind) {
    const swimmer = this.sub;
    swimmer.stun = 0.95;
    swimmer.stunMax = 0.95;
    swimmer.invuln = 1.8;
    const dx = swimmer.x - hx;
    const dy = swimmer.y - hy;
    const d = Math.hypot(dx, dy) || 1;
    const k = 270 * this.s;
    swimmer.vx = (dx / d) * k;
    swimmer.vy = (dy / d) * k * 0.8;
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
      swimmer.x,
      swimmer.y - 30 * this.s,
      penalty > 0 ? `${kind === 'mine' ? 'SURGE!' : 'STING!'} -${penalty}` : kind === 'mine' ? 'SURGE!' : 'STING!',
      '#fb7185'
    );
    fx.particles?.(swimmer.x, swimmer.y, kind === 'mine' ? '#fb923c' : '#f0abfc', 18, 170);
    fx.particles?.(swimmer.x, swimmer.y, '#ffffff', 8, 120);
    this._ring(hx, hy, 8 * this.s, 70 * this.s, kind === 'mine' ? '#fb923c' : '#f0abfc', 0.55);
    fx.shake?.(kind === 'mine' ? 8 : 5);
    this._vfx(kind === 'mine' ? 'boom' : 'zap', hx, hy, {
      life: 0.5,
      size: 40 * this.s,
      color: kind === 'mine' ? '#fb923c' : '#f0abfc',
    });
    if (kind === 'mine') (sound?.subHit || sound?.jellyZap)?.call(sound);
    else sound?.jellyZap?.();
  }

  _touchesSub(x, y, r) {
    const swimmer = this.sub;
    const dx = (x - swimmer.x) / (swimmer.rx * 0.88 + r);
    const dy = (y - swimmer.y) / (swimmer.ry * 0.85 + r);
    return dx * dx + dy * dy < 1;
  }

  _nearMiss(h, x, y, r, fx, sound) {
    if (h.nearDone) return;
    const swimmer = this.sub;
    if (this.phase !== 'ride' || swimmer.stun > 0 || swimmer.invuln > 0) {
      if (h.nearArmed) h.nearDone = true;
      return;
    }
    const dx = (x - swimmer.x) / (swimmer.rx * 0.88 + r);
    const dy = (y - swimmer.y) / (swimmer.ry * 0.85 + r);
    if (dx * dx + dy * dy < 2.5) h.nearArmed = true;
    if (h.nearArmed && x < swimmer.x - swimmer.rx * 0.6) {
      h.nearDone = true;
      this.nearMisses++;
      swimmer.nearMisses++;
      const mult = this._comboHit();
      const pts = NEAR_MISS_POINTS * mult;
      this._score(fx, pts);
      fx.popup?.(swimmer.x, swimmer.y - 34 * this.s, mult > 1 ? `GLIDE SLIP +${pts} x${mult}` : `GLIDE SLIP +${pts}`, '#67e8f9');
      this._vfx('whoosh', swimmer.x, swimmer.y, { life: 0.45, size: swimmer.rx, a: y < swimmer.y ? -1 : 1 });
      (sound?.nearMiss || sound?.whoosh || sound?.gust)?.call(sound);
    }
  }

  _updateJellies(dt, fx, sound) {
    const s = this.s;
    const swimmer = this.sub;
    const vulnerable = swimmer.invuln <= 0 && (this.phase === 'ride' || this.phase === 'intro');
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
    const swimmer = this.sub;
    const vulnerable = swimmer.invuln <= 0 && (this.phase === 'ride' || this.phase === 'intro');
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
    const swimmer = this.sub;
    for (let i = this.clams.length - 1; i >= 0; i--) {
      const c = this.clams[i];
      c.x -= this.scrollSpeed * dt;
      c.phase += (dt * TAU) / c.period;
      const wave = Math.sin(c.phase);
      const target = wave > 0.1 ? 1 : 0;
      c.open += (target - c.open) * Math.min(1, dt * (target ? 6 : 14));
      if (c.snap > 0) c.snap -= dt;
      if (c.hasPearl && c.open > 0.55 && swimmer.stun <= 0) {
        if (this._touchesSub(c.x, c.y - c.r * 0.35, c.r * 0.55)) {
          c.hasPearl = false;
          this.pearls++;
          this._score(fx, PEARL_POINTS);
          fx.popup?.(c.x, c.y - 34 * s, `TIDAL PEARL +${PEARL_POINTS}`, '#fbcfe8');
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

export { SubStage as ReefSwimStage };
export const SUB_STAGE_TIMING = { RIDE_TIME, INTRO_TIME, ARRIVE_TIME, TOWER_LEAD };
