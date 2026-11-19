// TOWERING WATERS: GATEWAY'S DESCENT — CANYON UPDRAFT FRILL-GLIDE (`src/glideStage.js`)
// Pure gameplay logic leaf module (zero imports).
//
// Gateway launches from a Spire's summit crown, flaring her iridescent webbed neck & rib frills
// with streaming water-wing ribbons across sunlit canyon gorges, rainbow waterfall mists, and
// golden thermal updraft rings before touching down beside the next Spire.

const TAU = Math.PI * 2;
const RIDE_TIME = 22; // nominal seconds of gliding (progress 0 -> 1); diving/tucking arrives faster
const INTRO_TIME = 2.3; // summit run-up + leap + swoop into level cruise
const ARRIVE_TIME = 3.8; // approach, flare, touch-down on beach beside next monolith, tally
const TOWER_LEAD = 5.4; // next monolith sweeps in from horizon this long before ride ends

const LANTERN_POINTS = 10;
const STRING_BONUS = 100; // whole lantern string caught in one pass
const KITE_POINTS = 200;
const GOLD_POINTS = 600;
const GATE_POINTS = 250;
const GATE_CHAIN_BONUS = 50; // per gate in an unbroken chain
const PERFECT_BONUS = 750;
const HIT_PENALTY = 100;
const NEAR_MISS_POINTS = 50;
const MAX_MULT = 4;
const COMBO_WINDOW = 2.55;
const MAX_VFX = 48;
const FLAP_CD = 0.46; // buoyant, responsive mobile/tablet tap cadence

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

// Sunlit canyon, alpine, bayou, coral & aurora glide themes indexed by watershed act (0-based) or `themeKey`.
export const GLIDE_THEMES = [
  { key: 'canyon_river', label: 'REDWOOD CANYON UPDRAFTS', storm: 0.72, gust: 0.90, gull: 0.95 },
  { key: 'alpine_lake', label: 'ALPENGLOW MIRROR PEAKS', storm: 0.78, gust: 1.05, gull: 0.90 },
  { key: 'mist_bayou', label: 'AMBER BAYOU THERMALS', storm: 0.85, gust: 0.95, gull: 0.85 },
  { key: 'coral_sea', label: 'SUNLIT CORAL TRADEWINDS', storm: 0.75, gust: 1.0, gull: 1.05 },
  { key: 'storm_ocean', label: 'POLAR AURORA TEMPEST', storm: 1.25, gust: 1.25, gull: 0.80 },
  { key: 'dawn', label: 'GOLDEN GORGE FLIGHT', storm: 0.65, gust: 0.8, gull: 1.0 },
  { key: 'day', label: 'HIGH TRADEWINDS', storm: 0.8, gust: 1.0, gull: 1.1 },
  { key: 'sunset', label: 'TWILIGHT UPDRAFT', storm: 0.9, gust: 1.0, gull: 1.15 },
];

const LANTERN_POP = ['#fdba74', '#fde68a', '#7be8ff', '#f9a8d4'];

export class GlideStage {
  constructor() {
    this.width = 390;
    this.height = 620;
    this.s = 1;
    this.active = false;
    this.phase = 'idle'; // idle | intro | ride | arrive | done
    this.duration = RIDE_TIME;
    this.standalone = false;
    this.glider = this._makeGlider();
    this.lanterns = []; // lanterns, star kites, and golden lantern ({ type })
    this.gates = []; // ring gates to thread
    this.thermals = []; // rising warm/bioluminescent updraft columns
    this.thermalSpirals = []; // rising mist spiral data for renderer
    this.fovKick = 0; // 0..1 dive-rush FOV swell cue for renderer
    this.clouds = []; // storm clouds (telegraphed lightning hazard)
    this.gulls = [];
    this.gusts = [];
    this.warnings = []; // edge-of-screen telegraphs ({ y, t, max, kind })
    this.rings = []; // shockwave rings ({ x, y, r0, r1, life, maxLife, color, flat })
    this.vfx = []; // one-shot presentation events ({ id, kind, x, y, life, maxLife, size, color, a, tx, ty })
    this._vfxId = 0;
    this.tower = { active: false, x: 0, r: 100, targetX: 0, depth: 0, glow: '#5efce8', name: '' };
    this.summit = { x: 0, y: 0, r: 60, glow: '#fbbf24' };
    this.theme = GLIDE_THEMES[0];
    this.themeKey = 'canyon_river';
    this._resetStats();
  }

  _makeGlider() {
    return {
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      rx: 26,
      ry: 14,
      stun: 0,
      stunMax: 1,
      invuln: 0,
      spin: 0,
      flapCd: 0,
      flapT: 9,
      lift: 0,
      buffet: 0,
      pitch: 0,
      airspeed: 1,
      speed: 1,
      energy: 0,
      dive: 0,
      ax: 0,
      ay: 0,
      launch: 0,
      landed: 0,
      flare: 0,
      flaps: 0,
      catches: 0,
      nearMisses: 0,
      skims: 0,
    };
  }

  _resetStats() {
    this.lanternsCaught = 0;
    this.kites = 0;
    this.goldCaught = 0;
    this.gatesPassed = 0;
    this.gatesTotal = 0;
    this.strings = 0;
    this.bonus = 0;
    this.gearsEarned = 0;
    this.hits = 0;
    this.perfect = false;
    this.combo = 0;
    this.comboTimer = 0;
    this.comboTimerMax = COMBO_WINDOW;
    this.comboPulseT = -10;
    this.mult = 1;
    this.nearMisses = 0;
    this.bestCombo = 0;
    this.gateChain = 0;
    this.maxGateChain = 0;
    this.hitFourGateChain = false;
    this.thermalTime = 0;
  }

  start({
    width = 390,
    height = 620,
    worldIndex = 0,
    themeKey = null,
    healing = 1,
    nextWorldName = 'NEXT MONOLITH',
    nextGlow = '#5efce8',
    fromGlow = '#fbbf24',
    standalone = false,
  } = {}) {
    this.width = Math.max(200, width);
    this.height = Math.max(240, height);
    this.s = this._scaleFor(this.width, this.height);
    this.worldIndex = clamp(Math.floor(Number(worldIndex) || 0), 0, GLIDE_THEMES.length - 1);
    this.standalone = Boolean(standalone);
    this.healing = clamp(Number(healing ?? 1) || 0, 0, 1);
    this.nextWorldName = String(nextWorldName || 'NEXT MONOLITH').toUpperCase();
    this.nextGlow = nextGlow || '#5efce8';

    const matchedTheme = themeKey ? GLIDE_THEMES.find((th) => th.key === themeKey) : null;
    this.theme = matchedTheme || GLIDE_THEMES[this.worldIndex % GLIDE_THEMES.length] || GLIDE_THEMES[0];
    this.themeKey = this.theme.key;
    this.difficulty = clamp(this.worldIndex / 6, 0, 1);

    this.active = true;
    this.phase = 'intro';
    this.t = 0;
    this.rideT = 0;
    this.arriveT = 0;
    this.progress = 0;
    this.duration = RIDE_TIME;
    this.scroll = 0;
    this.baseSpeed = 114 * this.s;
    this.scrollSpeed = 0;
    this.wind = 0;
    this._finished = false;
    this._bannerShown = false;
    this._cheered = false;
    this._patternId = 0;
    this._flockId = 0;
    this._touchedDown = false;
    this._splashCd = 0;
    this._wasJump = true;
    this._wasFire = true;
    this._flapBuf = 0;

    this.lanterns.length = 0;
    this.gates.length = 0;
    this.thermals.length = 0;
    this.thermalSpirals.length = 0;
    this.fovKick = 0;
    this._spiralSpawnT = 0;
    this.clouds.length = 0;
    this.gulls.length = 0;
    this.gusts.length = 0;
    this.warnings.length = 0;
    this.rings.length = 0;
    this.vfx.length = 0;
    if (this._patterns) this._patterns.clear();
    this._resetStats();

    this._layout();
    const sm = this.summit;
    sm.r = this._summitRadius();
    sm.x = this.width * 0.13;
    sm.y = this.summitY;
    sm.glow = fromGlow || '#fbbf24';

    const g = this.glider;
    Object.assign(g, this._makeGlider());
    g.rx = 26 * this.s;
    g.ry = 14 * this.s;
    g.x = sm.x + sm.r * 0.15;
    g.y = this.summitY - g.ry * 1.4;
    g.speed = 0;

    const t = this.tower;
    t.active = true;
    t.depth = 0;
    t.r = this._towerRadius();
    t.targetX = this.width - t.r * 0.7;
    t.x = this.width * 0.8;
    t.glow = this.nextGlow;
    t.name = this.nextWorldName;

    const d = this.difficulty;
    const th = this.theme;
    this._next = {
      pattern: 0.5,
      thermal: 1.4,
      gate: 1.8,
      kite: 4.2 + Math.random() * 1.5,
      cloud: 5.5 / th.storm,
      gull: 3.6 / th.gull,
      gust: 5.0 / th.gust,
    };
    this._goldAt = Math.random() < 0.78 + this.healing * 0.22 ? rand(7.0, 14.2) : Infinity;
    this._cloudEvery = lerp(8.5, 4.1, d) / th.storm;
    this._gullEvery = lerp(6.2, 3.2, d) / th.gull;
    this._gustEvery = lerp(7.5, 4.1, d) / th.gust;
    this._strikeCharge = lerp(1.35, 1.0, d);
  }

  _scaleFor(w, h) {
    return clamp(Math.sqrt((w * h) / (390 * 620)), 0.8, 1.6);
  }

  _towerRadius() {
    return clamp(this.width * 0.26, 62 * this.s, 170 * this.s);
  }

  _summitRadius() {
    return clamp(this.width * 0.2, 50 * this.s, 130 * this.s);
  }

  _layout() {
    const H = this.height;
    const s = this.s;
    const wide = this.width / H > 1.15;
    this.seaY = H * 0.905;
    // Portrait reserves top 152px for `#hud` + sky bar; Landscape docks sky bar in Right Gutter so center/left sky opens up!
    this.top = wide ? Math.max(H * 0.16, 68) : Math.max(H * 0.19, 152 * Math.min(1.18, s));
    this.bottom = this.seaY - 20 * s;
    this.summitY = Math.max(this.top + 34 * s, H * 0.45);
    this.landY = this.seaY - 26 * s;
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
    const fix = (o) => {
      o.x *= kx;
      o.y *= ky;
      if (o.r) o.r *= ks;
      if (o.baseY !== undefined) o.baseY *= ky;
    };
    const g = this.glider;
    g.x *= kx;
    g.y *= ky;
    g.rx *= ks;
    g.ry *= ks;
    for (const l of this.lanterns) {
      fix(l);
      l.ax *= kx;
      l.ay *= ky;
    }
    for (const gt of this.gates) {
      gt.x *= kx;
      gt.y *= ky;
      gt.r *= ks;
    }
    for (const th of this.thermals) {
      th.x *= kx;
      th.w *= ks;
    }
    this.thermalSpirals.length = 0;
    for (const c of this.clouds) {
      c.x *= kx;
      c.y *= ky;
      c.rx *= ks;
      c.ry *= ks;
      c.strikeX *= ks;
      c.boltW *= ks;
    }
    for (const b of this.gulls) fix(b);
    for (const u of this.gusts) {
      u.x *= kx;
      u.y *= ky;
      u.w *= ks;
      u.h *= ky;
    }
    for (const w of this.warnings) w.y *= ky;
    this.rings.length = 0;
    this.vfx.length = 0;
    this.baseSpeed = 114 * this.s;
    const t = this.tower;
    t.r = this._towerRadius();
    t.targetX = this.width - t.r * 0.7;
    t.x *= kx;
    const sm = this.summit;
    sm.r = this._summitRadius();
    sm.x *= kx;
    sm.y = this.summitY;
  }

  get timeRemaining() {
    return Math.max(0, RIDE_TIME - this.rideT);
  }

  get results() {
    return {
      lanterns: this.lanternsCaught,
      kites: this.kites,
      gold: this.goldCaught,
      gates: this.gatesPassed,
      gatesTotal: this.gatesTotal,
      maxGateChain: this.maxGateChain,
      hitFourGateChain: this.hitFourGateChain,
      strings: this.strings,
      bonus: this.bonus,
      gears: this.gearsEarned,
      hits: this.hits,
      nearMisses: this.nearMisses,
      bestCombo: this.bestCombo,
      perfect: this.perfect,
    };
  }

  get collected() {
    return this.lanternsCaught + this.kites + this.goldCaught;
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

    if (this.comboTimer > 0) {
      this.comboTimer -= dt;
      if (this.comboTimer <= 0) {
        this.combo = 0;
        this.mult = 1;
      }
    }

    const g = this.glider;
    const tw = this.tower;

    if (this.phase === 'intro') {
      if (!this._bannerShown) {
        this._bannerShown = true;
        const subLabel = this.standalone
          ? 'WATERSHED UPDRAFTS'
          : `ACT ${Math.min(5, this.worldIndex + 1)} SUMMIT`;
        fx.banner?.(subLabel, 'CANYON FRILL-GLIDE');
        (sound?.gust)?.call(sound);
      }
      if (this.t >= INTRO_TIME) {
        this.phase = 'ride';
        fx.banner?.(this.theme.label, `NEXT: ${this.nextWorldName}`);
      }
    }

    if (this.phase === 'intro' || this.phase === 'ride') {
      const k = this.phase === 'intro' ? 0 : clamp(g.speed, 0.6, 1.6);
      this.rideT += dt * k;
      this.progress = clamp(this.rideT / RIDE_TIME, 0, 1);
      if (this.rideT >= RIDE_TIME) this._beginArrival(fx, sound);
    } else if (this.phase === 'arrive') {
      this.arriveT += dt;
      this.progress = 1;
      if (this.arriveT >= ARRIVE_TIME) {
        this.phase = 'done';
        this._finished = true;
        sound?.setWind?.(0);
        return true;
      }
    }

    const lead = RIDE_TIME - TOWER_LEAD;
    if (this.phase === 'arrive' || this.rideT >= lead) {
      const k = this.phase === 'arrive' ? 1 : clamp((this.rideT - lead) / TOWER_LEAD, 0, 1);
      tw.depth = Math.max(tw.depth, lerp(0.62, 1, smooth(k)));
    } else {
      tw.depth = 0.62 * clamp(this.rideT / lead, 0, 1);
    }

    if (this.phase === 'intro') {
      const k = smooth(clamp((this.t - 0.75) / 1.3, 0, 1));
      this.scrollSpeed = this.baseSpeed * k;
      tw.x = this.width * 0.8;
    } else if (this.phase === 'arrive' || this.rideT > lead) {
      const near = this.phase === 'arrive' ? 1 : clamp((this.rideT - lead) / TOWER_LEAD, 0, 1);
      const want = lerp(this.width * 0.8, tw.targetX, smooth(near));
      const remain = Math.max(0, tw.x - tw.targetX);
      tw.x = Math.min(tw.x, want);
      const ease =
        this.phase === 'arrive'
          ? clamp(remain / (110 * this.s), 0, 1) * clamp(1 - this.arriveT / 2.2, 0, 1)
          : 1;
      this.scrollSpeed = this.baseSpeed * g.speed * Math.max(ease, this.phase === 'arrive' ? 0 : 0.35);
    } else {
      this.scrollSpeed = this.baseSpeed * g.speed;
    }
    this.scroll += this.scrollSpeed * dt;
    const sm = this.summit;
    sm.x -= this.scrollSpeed * dt;

    this._updateGlider(dt, input, firePressed, fx, sound);

    if (sound?.setWind) {
      let w = 0;
      if (this.phase === 'intro') w = 0.12 + 0.3 * g.launch;
      else if (this.phase === 'ride') {
        w = 0.28 + 0.35 * g.dive + 0.25 * Math.abs(this.wind) + 0.25 * clamp(g.speed - 1, 0, 1);
      } else {
        w = 0.3 * (1 - clamp(this.arriveT / 2.5, 0, 1));
      }
      sound.setWind(clamp(w, 0, 1));
    }

    this._spawn(dt, fx, sound);
    this._updateLanterns(dt, fx, sound);
    this._updateGates(dt, fx, sound);
    this._updateThermals(dt);
    this._updateClouds(dt, fx, sound);
    this._updateGulls(dt, fx, sound);
    this._updateGusts(dt, fx, sound);

    for (let i = this.warnings.length - 1; i >= 0; i--) {
      const w = this.warnings[i];
      w.t -= dt;
      if (w.t <= 0) removeAt(this.warnings, i);
    }
    for (let i = this.rings.length - 1; i >= 0; i--) {
      const r = this.rings[i];
      r.life -= dt;
      r.x -= this.scrollSpeed * dt * 0.5;
      if (r.life <= 0) removeAt(this.rings, i);
    }
    for (let i = this.vfx.length - 1; i >= 0; i--) {
      const e = this.vfx[i];
      e.life -= dt;
      if (e.kind !== 'whoosh' && e.kind !== 'collect' && e.kind !== 'flap') {
        e.x -= this.scrollSpeed * dt * 0.6;
      }
      if (e.life <= 0) removeOrdered(this.vfx, i);
    }
    return false;
  }

  _beginArrival(fx, sound) {
    this.phase = 'arrive';
    this.arriveT = 0;
    this.progress = 1;
    const g = this.glider;
    if (this.hits === 0) {
      this.perfect = true;
      this._score(fx, PERFECT_BONUS);
      fx.popup?.(g.x, g.y - 40 * this.s, `PERFECT FLIGHT +${PERFECT_BONUS}`, '#fde047');
      (sound?.collectStar || sound?.secret)?.call(sound);
    }
    const arriveSub = this.standalone
      ? 'DESTINATION REACHED'
      : `SECTOR ${Math.min(4, this.worldIndex + 2)} LANDFALL`;
    fx.banner?.(arriveSub, `ARRIVING: ${this.nextWorldName}`);
  }

  _score(fx, pts) {
    if (!pts) return;
    this.bonus += pts;
    fx.addScore?.(pts);
  }

  _awardGears(fx, sound, amount = 2) {
    if (!amount || amount <= 0) return;
    this.gearsEarned += amount;
    fx.addGears?.(amount);
    sound?.collectGear?.();
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

  _ring(x, y, r0, r1, color, life = 0.45, flat = false) {
    if (this.rings.length > 22) this.rings.shift();
    this.rings.push({ x, y, r0, r1, color, life, maxLife: life, flat });
  }

  // ------------------------------------------------------------------ glider flight physics
  _updateGlider(dt, input, firePressed, fx, sound) {
    const g = this.glider;
    const pvx = g.vx;
    const pvy = g.vy;
    this._moveGlider(dt, input, firePressed, fx, sound);
    if (dt > 0) {
      const k = 1 - Math.exp(-10 * dt);
      const ax = clamp((g.vx - pvx) / dt, -4000, 4000);
      const ay = clamp((g.vy - pvy) / dt, -4000, 4000);
      g.ax += (ax - g.ax) * k;
      g.ay += (ay - g.ay) * k;
    }
  }

  _moveGlider(dt, input, firePressed, fx, sound) {
    const g = this.glider;
    const s = this.s;
    const W = this.width;
    g.flapT += dt;
    if (g.invuln > 0) g.invuln -= dt;
    if (g.flapCd > 0) g.flapCd -= dt;
    if (this._splashCd > 0) this._splashCd -= dt;

    if (this.phase === 'intro') {
      const t = this.t;
      const sm = this.summit;
      const standY = this.summitY - g.ry * 1.4;
      if (t < 0.75) {
        g.launch = 0;
        const run = smooth(clamp((t - 0.25) / 0.5, 0, 1));
        g.x = sm.x + sm.r * lerp(0.15, 0.62, run);
        g.y = standY;
        g.vx = 0;
        g.vy = 0;
        g.speed = 0;
      } else {
        if (g.launch === 0) {
          g.launch = 0.001;
          g.vx = 150 * s;
          g.vy = -70 * s;
          sound?.jump?.();
          fx.particles?.(g.x, standY + g.ry, '#f8fafc', 8, 80);
          this._vfx('launch', g.x, standY + g.ry, { life: 0.8, size: 30 * s });
        }
        g.launch = Math.min(1, g.launch + dt * 2.2);
        const k = clamp((t - 0.75) / (INTRO_TIME - 0.75), 0, 1);
        const portrait = W / Math.max(1, this.height) < 0.85;
        const wantX = W * (portrait ? 0.36 : 0.28);
        const wantY = this.height * 0.46;
        const ax = (wantX - g.x) * 5 - g.vx * 2.6;
        const sink = 340 * s * (1 - smooth(k)) ** 2;
        const ay = (wantY - g.y) * 4.2 * smooth(k) - g.vy * 2.2 * smooth(k) + sink;
        g.vx += ax * dt;
        g.vy += ay * dt;
        g.x += g.vx * dt;
        g.y += g.vy * dt;
        g.speed = lerp(0.4, 1, smooth(k));
        g.airspeed = lerp(0.85, 1.0, smooth(k));
        g.dive = clamp(g.vy / (260 * s), 0, 1);
        g.pitch = clamp(Math.atan2(g.vy, 240 * s), -0.45, 0.45);
        g.buffet = 0;
        this.fovKick *= Math.exp(-5 * dt);
      }
      return;
    }

    if (this.phase === 'arrive') {
      this._autoLand(dt, fx, sound);
      this.fovKick *= Math.exp(-5 * dt);
      g.buffet *= Math.exp(-6 * dt);
      g.pitch += (clamp(Math.atan2(g.vy, 240 * s), -0.35, 0.35) - g.pitch) * Math.min(1, dt * 6);
      return;
    }

    // ---- active sky ride
    if (g.stun > 0) {
      g.stun -= dt;
      const k = Math.max(0, g.stun / g.stunMax);
      g.spin += dt * TAU * 1.7 * (0.3 + k);
      if (g.stun <= 0) {
        g.stun = 0;
        g.spin = Math.round(g.spin / TAU) * TAU;
      }
      const damp = Math.exp(-2.2 * dt);
      g.vx *= damp;
      g.vy = g.vy * damp + 120 * s * dt;
      g.airspeed += (0.82 - g.airspeed) * Math.min(1, dt * 2.5);
      g.speed += (0.8 - g.speed) * Math.min(1, dt * 2);
      g.dive = 0;
      g.buffet *= Math.exp(-6 * dt);
      g.pitch *= Math.exp(-4 * dt);
      this.fovKick *= Math.exp(-5 * dt);
    } else {
      g.spin += (Math.round(g.spin / TAU) * TAU - g.spin) * Math.min(1, dt * 10);

      // 4-Mode Dual-Compatible Input Adapter (`analogX`/`analogY` + `axisX`/`axisY` + directional/action flags)
      const src = input && typeof input === 'object' && input.state ? input.state : (input || {});
      const jp = input?.justPressed || src?.justPressed || null;
      const ax = Number(src.analogX ?? src.axisX ?? input?.analogX ?? input?.axisX) || 0;
      const ay = Number(src.analogY ?? src.axisY ?? input?.analogY ?? input?.axisY) || 0;
      const jumpNow = Boolean(src.jump);
      const fireNow = Boolean(src.fire);
      const jumpEdge = (jumpNow && !this._wasJump) || Boolean(jp?.jump);
      const fireEdge = (fireNow && !this._wasFire) || Boolean(jp?.fire);
      this._wasJump = jumpNow;
      this._wasFire = fireNow;

      let ix = Math.abs(ax) > 0.04 ? clamp(ax, -1, 1) : (src.right ? 1 : 0) - (src.left ? 1 : 0);
      let iy = Math.abs(ay) > 0.04 ? clamp(ay, -1, 1) : (src.down ? 1 : 0) - (src.up ? 1 : 0);

      const len = Math.hypot(ix, iy);
      if (len > 1) {
        ix /= len;
        iy /= len;
      }

      // Horizontal airspeed tuck (+ix) vs air-brake (-ix) + dive-momentum forward carry
      const maxVx = 205 * s;
      const kx = ix !== 0 ? (ix * g.vx < 0 ? 8.5 : 6.0) : 2.6;
      g.vx += (ix * maxVx + g.dive * 42 * s - g.vx) * (1 - Math.exp(-kx * dt));

      // Real Pitch-Lift Aerodynamic Energy Trade (SM64 Wing Cap / Zelda glider feel, gentle & fair):
      //   - Pitch (+ = nose down, - = nose up) smoothed from vertical input & hold-lift
      //   - Diving accelerates `g.airspeed` via gravity component along flight path & stores zoom energy
      //   - Pulling up converts excess airspeed & stored kinetic energy into soaring upward lift,
      //     bleeding airspeed smoothly down to a forgiving soft-sink floor (never a harsh stall drop!)
      const holdLift = jumpNow || fireNow ? -105 * s : 0;
      const pitchCmd = clamp(iy + (holdLift < 0 ? -0.52 : 0), -1, 1);
      const targetPitch = pitchCmd * 0.56;
      g.pitch += (targetPitch - g.pitch) * (1 - Math.exp(-7.5 * dt));

      const sinPitch = Math.sin(g.pitch);
      const cruiseAirspeed = 1.0 + 0.20 * ix + (g.flapT < 0.6 ? 0.22 * (1 - g.flapT / 0.6) : 0);
      if (sinPitch > 0.02) {
        // Diving: gravity component accelerates airspeed
        g.airspeed += sinPitch * 1.28 * dt;
      } else if (sinPitch < -0.02) {
        // Climbing: kinetic airspeed converts into altitude (soft floor at 0.72 — forgiving stall!)
        g.airspeed -= -sinPitch * 0.96 * dt;
      }
      // Aerodynamic drag relaxes airspeed gently toward cruise trim
      g.airspeed += (cruiseAirspeed - g.airspeed) * (1 - Math.exp(-0.92 * dt));
      g.airspeed = clamp(g.airspeed, 0.72, 1.72);

      const excessAir = Math.max(0, g.airspeed - 0.76);
      const pullingUp = g.pitch < -0.04 || iy < -0.15 || holdLift < 0;
      // Shallow neutral sink keeps zero-input flight gently aloft & completable (splashes <= 1)
      const neutralSink = Math.max(5.5 * s, (11.0 - excessAir * 7.5) * s);
      const diveSink = sinPitch > 0.02 ? sinPitch * 275 * s : 0;
      const aeroClimb = sinPitch < -0.02 ? -(-sinPitch) * (150 + excessAir * 275) * s : 0;
      // Gentle soft-sink near stall floor when nose pulled high with depleted airspeed
      const softStall = g.airspeed < 0.78 && sinPitch < -0.15 ? (0.78 - g.airspeed) * 140 * s : 0;
      let wantVy = neutralSink + diveSink + aeroClimb + softStall + holdLift * 0.72;
      if (pullingUp && g.energy > 0.02) {
        const use = Math.min(g.energy, dt * 1.45);
        g.energy -= use;
        wantVy -= 165 * s * (use / Math.max(dt, 1e-4));
      }
      const ky = iy !== 0 || holdLift < 0 ? 6.0 : 2.8;
      g.vy += (wantVy - g.vy) * (1 - Math.exp(-ky * dt));

      // Rising warm/bioluminescent sea thermals with turbulent wing-frill buffet
      let lift = 0;
      for (const th of this.thermals) {
        const dx = (g.x - th.x) / (th.w * 1.08);
        if (dx > -1 && dx < 1 && g.y > this.top - 12 * s) {
          lift = Math.max(lift, th.str * (1 - dx * dx) * th.fade);
        }
      }
      g.lift += (lift - g.lift) * Math.min(1, dt * 6.5);
      const wantBuffet = lift > 0.02 ? clamp(lift * 0.92 + Math.sin(this.t * 17.5) * 0.16 * lift, 0, 1) : 0;
      g.buffet += (wantBuffet - g.buffet) * Math.min(1, dt * 9.0);
      if (lift > 0.02) {
        const turb = 1 + Math.sin(this.t * 15.0) * 0.10;
        g.vy -= lift * 685 * turb * s * dt;
        g.energy = Math.min(1.4, g.energy + lift * dt * 0.65);
        g.airspeed = Math.min(1.72, g.airspeed + lift * dt * 0.14);
        this.thermalTime += dt;
      }
      if (g.vy < -350 * s) g.vy = -350 * s;

      // Dive builds speed & zoom-climb kinetic energy; pull-up flares wings gracefully
      const diving = clamp((g.vy - 55 * s) / (165 * s), 0, 1);
      const pitchDive = clamp(g.pitch / 0.52, 0, 1);
      g.dive += (Math.max(diving, pitchDive * 0.85) - g.dive) * Math.min(1, dt * 6.0);
      if (g.dive > 0.05) g.energy = Math.min(1.45, g.energy + g.dive * dt * 1.25);
      else g.energy = Math.max(0, g.energy - dt * 0.09);

      const targetFlare = pullingUp ? clamp(0.28 + g.energy * 0.45 + excessAir * 0.25, 0, 0.88) : 0;
      g.flare += (targetFlare - g.flare) * Math.min(1, dt * 7.5);

      const wantSpeed = clamp(
        g.airspeed + g.energy * 0.12 + (g.flapT < 0.6 ? 0.20 * (1 - g.flapT / 0.6) : 0),
        0.72,
        1.65
      );
      g.speed += (wantSpeed - g.speed) * (1 - Math.exp(-4.2 * dt));

      // Dynamic dive-rush FOV swell cue (0..1) when diving fast / high airspeed
      const targetFovKick = clamp((g.airspeed - 1.06) / 0.52 + g.dive * 0.38, 0, 1);
      this.fovKick += (targetFovKick - this.fovKick) * (1 - Math.exp(-5.0 * dt));

      // Wing-flap trigger with 140ms tap buffer: `firePressed` OR `jump`/`fire` edge never drops a tap!
      if (Boolean(firePressed) || jumpEdge || fireEdge) {
        this._flapBuf = 0.14;
      } else if (this._flapBuf > 0) {
        this._flapBuf = Math.max(0, this._flapBuf - dt);
      }
      if (this._flapBuf > 0 && g.flapCd <= 0) {
        this._flapBuf = 0;
        this._flap(fx, sound);
      }
    }

    g.x += g.vx * dt;
    g.y += g.vy * dt;

    const wide = W / this.height > 1.15;
    const portrait = W / this.height < 0.85;
    const minX = portrait ? Math.max(g.rx * 1.8, W * 0.22) : Math.max(g.rx * 1.35, W * 0.14);
    const maxX = wide ? Math.min(W * 0.68, W - g.rx * 2.6) : portrait ? Math.min(W * 0.78, W - g.rx * 1.8) : W - g.rx * 2.2;
    if (g.x < minX) {
      g.x = minX;
      if (g.vx < 0) g.vx = 0;
    } else if (g.x > maxX) {
      g.x = maxX;
      if (g.vx > 0) g.vx = 0;
    }

    if (g.y < this.top) {
      g.y = this.top;
      if (g.vy < 0) g.vy *= 0.2;
    } else if (g.y > this.bottom) {
      g.y = this.bottom;
      if (g.vy > 0) {
        const hard = g.vy > 140 * s;
        g.vy = -Math.max(150 * s, g.vy * 0.75);
        g.speed *= 0.85;
        g.energy = 0;
        if (this._splashCd <= 0) {
          this._splashCd = 0.5;
          g.skims++;
          this.combo = 0;
          this.comboTimer = 0;
          this.mult = 1;
          this._vfx('splash', g.x, this.seaY, { life: 1.3, size: g.rx * (hard ? 1.4 : 1), a: 1 });
          this._ring(g.x, this.seaY, g.rx * 0.5, g.rx * 2.4, '#e0f7ff', 0.7, true);
          fx.particles?.(g.x, this.seaY - 4 * s, '#e0f7ff', 14, 150);
          fx.popup?.(g.x, g.y - 30 * s, 'SPLASH!', '#7dd3fc');
          fx.shake?.(hard ? 4 : 2);
          sound?.splash?.();
        }
      }
    }
  }

  _flap(fx, sound) {
    const g = this.glider;
    const s = this.s;
    g.flapCd = FLAP_CD;
    g.flapT = 0;
    g.flaps++;
    g.vy = Math.min(g.vy - 200 * s, -175 * s);
    g.vx += 40 * s;
    this._vfx('flap', g.x - g.rx * 0.4, g.y + g.ry * 0.5, { life: 0.5, size: g.rx * 1.6 });
    (sound?.glideFlap || sound?.jump)?.call(sound);
  }

  _autoLand(dt, fx, sound) {
    const g = this.glider;
    const s = this.s;
    const tw = this.tower;
    g.stun = Math.max(0, g.stun - dt * 2);
    g.spin += (Math.round(g.spin / TAU) * TAU - g.spin) * Math.min(1, dt * 8);
    g.lift *= Math.exp(-4 * dt);
    g.dive *= Math.exp(-4 * dt);
    const tx = tw.x - tw.r * 1.55;
    const groundY = this.landY - g.ry * 1.4;
    if (g.landed <= 0) {
      const dx = tx - g.x;
      const dist = Math.abs(dx);
      const k = clamp(1 - dist / (this.width * 0.6), 0, 1);
      const wantY = lerp(Math.min(g.y, groundY - 50 * s), groundY, smooth(k));
      const wantVx = clamp(dx * 1.6, -150 * s, 150 * s) + 50 * s * (1 - k);
      g.vx += (wantVx - g.vx) * Math.min(1, dt * 3);
      g.vy += (clamp((wantY - g.y) * 2.4, -160 * s, 160 * s) - g.vy) * Math.min(1, dt * 4);
      g.x += g.vx * dt;
      g.y += g.vy * dt;
      g.flare = smooth(clamp(1 - (groundY - g.y) / (60 * s), 0, 1)) * smooth(k);
      g.speed += (0.6 - g.speed) * Math.min(1, dt * 2);
      if ((g.y >= groundY - 2 * s && dist < 60 * s) || this.arriveT > 2.2) {
        g.landed = 0.001;
        g.y = groundY;
        g.vy = 0;
        g.vx = Math.max(40 * s, Math.min(g.vx, 110 * s));
        this._touchedDown = true;
        sound?.land?.(0.8);
        fx.particles?.(g.x, this.landY, '#fde68a', 12, 110);
        fx.particles?.(g.x, this.landY, '#ffffff', 6, 70);
        this._vfx('dust', g.x, this.landY, { life: 1.1, size: g.rx * 1.6 });
        fx.shake?.(2);
        (sound?.victory || sound?.collectStar)?.call(sound);
      }
    } else {
      g.landed = Math.min(1, g.landed + dt * 1.4);
      g.vx *= Math.exp(-3.2 * dt);
      g.x += g.vx * dt;
      g.y = groundY;
      g.flare = Math.max(0, 1 - g.landed * 1.5);
      if (g.landed > 0.15 && !this._cheered) {
        this._cheered = true;
        g.catches++;
      }
    }
  }

  // ------------------------------------------------------------------ spawning
  _spawn(dt, fx, sound) {
    if (this.phase !== 'ride' && this.phase !== 'intro') return;
    const t = this.rideT;
    const n = this._next;
    const lead = RIDE_TIME - TOWER_LEAD;
    const goodOpen = t < RIDE_TIME - 3.0;
    const gateOpen = t < RIDE_TIME - 2.2;
    const hazardOpen = this.phase === 'ride' && t < lead + 0.4;
    const W = this.width;
    const s = this.s;
    const minY = this.top + 16 * s;
    const maxY = this.bottom - 40 * s;

    if (t >= n.thermal && t < RIDE_TIME - 4) {
      n.thermal = t + rand(3.4, 4.6);
      const w = rand(42, 62) * s;
      const x = W + w + 20 * s;
      this.thermals.push({ x, w, str: rand(0.75, 1.0), fade: 0, age: 0, seed: Math.random() * TAU });
      if (goodOpen && Math.random() < 0.45) this._pattern('column', x, rand(this.height * 0.48, maxY));
    }
    if (goodOpen && t >= n.pattern) {
      n.pattern = t + rand(2.9, 3.7) - this.healing * 0.3;
      const kinds = ['arc', 'valley', 'wave', 'line', 'line'];
      const kind = kinds[Math.floor(Math.random() * kinds.length)];
      const cy = rand(minY + 40 * s, maxY - 30 * s);
      this._pattern(kind, W + 30 * s, cy);
    }
    if (gateOpen && t >= n.gate) {
      n.gate = t + rand(2.75, 3.55);
      const y = rand(minY + 30 * s, maxY - 20 * s);
      if (!this._crowded(W + 50 * s, y, 70 * s)) {
        this.gates.push({
          x: W + 50 * s,
          y,
          r: 34 * s,
          state: 'open',
          t: 0,
          age: 0,
          side: -1,
          seed: Math.random() * TAU,
        });
        this.gatesTotal++;
        if (Math.random() < 0.55) this._pattern('lead', W + 50 * s, y);
      } else {
        n.gate = t + 0.6;
      }
    }
    if (goodOpen && t >= n.kite) {
      n.kite = t + rand(5.0, 6.5);
      const y = rand(minY + 20 * s, maxY - 40 * s);
      this._addLantern({
        type: 'kite',
        x: W + 40 * s,
        y,
        r: 17 * s,
        drift: rand(10, 24) * s,
        amp: 26 * s,
        freq: 1.3,
        pattern: 0,
      });
    }
    if (goodOpen && t >= this._goldAt) {
      this._goldAt = Infinity;
      const y = rand(minY + 30 * s, maxY - 40 * s);
      this._addLantern({
        type: 'gold',
        x: W + 30 * s,
        y,
        r: 12.5 * s,
        drift: 82 * s,
        amp: 44 * s,
        freq: 2.7,
        pattern: 0,
      });
      (sound?.collectStar || sound?.secret)?.call(sound);
    }
    if (hazardOpen && t >= n.cloud) {
      n.cloud = t + this._cloudEvery * rand(0.8, 1.25);
      const y = rand(this.top + 10 * s, this.height * 0.44);
      if (!this._crowded(W + 70 * s, y, 90 * s)) {
        this.clouds.push({
          x: W + 80 * s,
          y,
          rx: rand(52, 66) * s,
          ry: rand(26, 32) * s,
          state: 'idle',
          t: 0,
          next: rand(0.4, 1.1),
          strikeX: 0,
          boltW: 15 * s,
          seed: Math.random() * 1000,
          age: 0,
          strikes: 0,
          bumpT: 0,
        });
      } else {
        n.cloud = t + 0.8;
      }
    }
    if (hazardOpen && t >= n.gull) {
      n.gull = t + this._gullEvery * rand(0.8, 1.25);
      const aimed = Math.random() < 0.65;
      const y = clamp(
        aimed ? this.glider.y + rand(-35, 35) * s : rand(minY + 10 * s, maxY - 10 * s),
        minY,
        maxY
      );
      const count = 3 + Math.floor(Math.random() * (2 + this.difficulty * 3));
      const diag = this.difficulty > 0.25 && Math.random() < 0.35 ? rand(-40, 40) * s : 0;
      const warnT = 0.9;
      this.warnings.push({ y, t: warnT, max: warnT, kind: 'gull' });
      this._flock(y, count, diag, warnT);
    }
    if (hazardOpen && t >= n.gust) {
      n.gust = t + this._gustEvery * rand(0.8, 1.25);
      const h = rand(80, 120) * s;
      const y = rand(minY + h * 0.3, maxY - h * 0.3);
      const dir = y < this.height * 0.5 ? 1 : Math.random() < 0.5 ? -1 : 1;
      this.gusts.push({
        x: W + 30 * s,
        y,
        w: rand(160, 220) * s,
        h,
        dir,
        str: rand(0.8, 1.0),
        t: 0,
        hit: false,
        warned: false,
        seed: Math.random() * 100,
      });
      this.warnings.push({ y, t: 0.9, max: 0.9, kind: dir > 0 ? 'gustDown' : 'gustUp' });
    }
    void dt;
    void fx;
  }

  _crowded(x, y, dist) {
    for (const c of this.clouds) {
      if (Math.abs(c.x - x) < dist + c.rx && Math.abs(c.y - y) < dist) return true;
    }
    for (const g of this.gates) {
      if (Math.abs(g.x - x) < dist && Math.abs(g.y - y) < dist) return true;
    }
    return false;
  }

  _pattern(kind, x0, cy) {
    const s = this.s;
    const id = ++this._patternId;
    const pts = [];
    if (kind === 'arc' || kind === 'valley') {
      const n = 7;
      const R = 74 * s;
      const sign = kind === 'arc' ? -1 : 1;
      for (let k = 0; k < n; k++) {
        const a = Math.PI * (k / (n - 1));
        pts.push([x0 + (1 - Math.cos(a)) * R, cy + sign * Math.sin(a) * R * 0.62]);
      }
    } else if (kind === 'wave') {
      for (let k = 0; k < 9; k++) pts.push([x0 + k * 30 * s, cy + Math.sin(k * 0.85) * 38 * s]);
    } else if (kind === 'line') {
      const slope = rand(-0.55, 0.55);
      for (let k = 0; k < 6; k++) pts.push([x0 + k * 34 * s, cy + k * 34 * s * slope]);
    } else if (kind === 'column') {
      for (let k = 0; k < 6; k++) pts.push([x0 + Math.sin(k * 1.3) * 8 * s, cy - k * 34 * s]);
    } else if (kind === 'lead') {
      for (let k = 0; k < 4; k++) pts.push([x0 - (4 - k) * 30 * s - 10 * s, cy]);
      pts.push([x0 + 36 * s, cy]);
    }
    const lo = this.top + 6 * s;
    const hi = this.bottom - 16 * s;
    for (const [x, y] of pts) {
      this._addLantern({
        type: 'lantern',
        x,
        y: clamp(y, lo, hi),
        r: 10 * s,
        drift: 0,
        amp: 3 * s,
        freq: 1.6,
        pattern: id,
      });
    }
    this._patterns = this._patterns || new Map();
    this._patterns.set(id, { total: pts.length, got: 0, missed: 0 });
    if (this._patterns.size > 24) {
      const first = this._patterns.keys().next().value;
      this._patterns.delete(first);
    }
  }

  _addLantern(o) {
    this.lanterns.push({
      type: o.type,
      x: o.x,
      y: o.y,
      ax: o.x,
      ay: o.y,
      baseY: o.y,
      r: o.r,
      drift: o.drift,
      amp: o.amp,
      freq: o.freq,
      pattern: o.pattern,
      hue: Math.floor(Math.random() * 4),
      phase: Math.random() * TAU,
      age: 0,
      seed: Math.random() * TAU,
      vy: 0,
      pull: 0,
    });
  }

  _flock(y, count, diag, delay) {
    const s = this.s;
    const id = ++this._flockId;
    const speed = rand(120, 170) * s * (0.85 + this.difficulty * 0.35);
    const lead = this.width + 30 * s + delay * (this.scrollSpeed + speed);
    for (let k = 0; k < count; k++) {
      const row = Math.ceil(k / 2);
      const side = k === 0 ? 0 : k % 2 ? -1 : 1;
      this.gulls.push({
        x: lead + row * 30 * s,
        y: y + side * row * 20 * s,
        baseY: y + side * row * 20 * s,
        vx: -speed,
        vy: diag,
        r: 11 * s,
        flock: id,
        phase: Math.random() * TAU,
        flapRate: rand(7.5, 9.5),
        state: 'fly',
        t: 0,
        age: 0,
        seed: Math.random() * TAU,
      });
    }
  }

  // ------------------------------------------------------------------ collectibles
  _touches(x, y, r, grow = 1) {
    const g = this.glider;
    const dx = (x - g.x) / (g.rx * grow + r);
    const dy = (y - (g.y + g.ry * 0.2)) / (g.ry * 1.4 * grow + r);
    return dx * dx + dy * dy < 1;
  }

  _updateLanterns(dt, fx, sound) {
    const s = this.s;
    const g = this.glider;
    const canCatch = g.stun <= 0 && g.launch >= 1 && this.phase !== 'arrive';
    for (let i = this.lanterns.length - 1; i >= 0; i--) {
      const l = this.lanterns[i];
      l.age += dt;
      l.ax -= (this.scrollSpeed + l.drift) * dt;
      if (l.type === 'lantern') {
        l.ay -= 6 * s * dt;
        l.x = l.ax + Math.sin(l.age * 1.1 + l.phase) * 2.5 * s;
        l.y = l.ay + Math.sin(l.age * l.freq + l.phase) * l.amp;
      } else if (l.type === 'kite') {
        l.x = l.ax + Math.sin(l.age * l.freq * 0.5 + l.phase) * 18 * s;
        l.y = l.ay + Math.sin(l.age * l.freq + l.phase) * l.amp;
      } else {
        l.x = l.ax + Math.sin(l.age * 1.7 + l.phase) * 16 * s;
        l.y = l.ay + Math.sin(l.age * l.freq + l.phase) * l.amp * (1 + 0.5 * Math.sin(l.age * 0.9));
      }
      l.y = clamp(l.y, this.top - 6 * s, this.bottom - 6 * s);

      if (canCatch && this._touches(l.x, l.y, l.r, 2.15)) {
        l.pull = Math.min(1, l.pull + dt * 4.5);
        const k = l.pull * Math.min(1, dt * 9.5);
        l.ax += (g.x - l.x) * k;
        l.ay += (g.y - l.y) * k;
        l.x += (g.x - l.x) * k;
        l.y += (g.y - l.y) * k;
      }
      if (canCatch && this._touches(l.x, l.y, l.r, 1.12)) {
        this._collect(l, fx, sound);
        removeAt(this.lanterns, i);
        continue;
      }
      if (l.x < -50 * s || l.y < -60 * s) {
        if (l.pattern) {
          const p = this._patterns?.get(l.pattern);
          if (p) p.missed++;
        }
        removeAt(this.lanterns, i);
      }
    }
  }

  _collect(l, fx, sound) {
    const g = this.glider;
    const s = this.s;
    g.catches++;
    const pat = l.type === 'lantern' && l.pattern ? this._patterns?.get(l.pattern) : null;
    let mult;
    if (pat && pat.got > 0 && this.comboTimer > 0) {
      this.comboTimer = COMBO_WINDOW;
      mult = this.mult;
    } else {
      mult = this._comboHit();
    }

    if (l.type === 'gold') {
      const pts = GOLD_POINTS * mult;
      this.goldCaught++;
      this._score(fx, pts);
      // Next-Gen Golden Lantern reward: +2 Golden Gears into ProgressionManager
      this._awardGears(fx, sound, 2);
      fx.popup?.(l.x, l.y - 24 * s, `GOLDEN LANTERN +${pts} (+2 GEARS)`, '#fde047');
      fx.particles?.(l.x, l.y, '#fde047', 22, 170);
      fx.particles?.(l.x, l.y, '#ffffff', 10, 110);
      this._ring(l.x, l.y, l.r, l.r * 5, '#fde047', 0.75);
      this._vfx('sparkle', l.x, l.y, { life: 0.8, size: l.r * 3.2, color: '#fde047' });
      this._vfx('collect', l.x, l.y, { life: 0.34, size: l.r, color: '#fde047', tx: g.x, ty: g.y });
      fx.shake?.(3);
      (sound?.secret || sound?.collectStar)?.call(sound);
      return;
    }

    if (l.type === 'kite') {
      const pts = KITE_POINTS * mult;
      this.kites++;
      this._score(fx, pts);
      fx.popup?.(
        l.x,
        l.y - 22 * s,
        mult > 1 ? `STAR KITE +${pts} x${mult}` : `STAR KITE +${pts}`,
        '#f9a8d4'
      );
      fx.particles?.(l.x, l.y, '#f9a8d4', 16, 140);
      this._ring(l.x, l.y, l.r * 0.6, l.r * 3.4, '#fbcfe8', 0.55);
      this._vfx('sparkle', l.x, l.y, { life: 0.7, size: l.r * 2.4, color: '#fbcfe8' });
      this._vfx('pop', l.x, l.y, { life: 0.55, size: l.r * 1.6, color: '#f9a8d4' });
      this._vfx('collect', l.x, l.y, { life: 0.32, size: l.r, color: '#fbcfe8', tx: g.x, ty: g.y });
      (sound?.collect || sound?.collectStar || sound?.collectGear)?.call(sound, Math.min(14, this.combo + 2));
      return;
    }

    const pts = LANTERN_POINTS * mult;
    this.lanternsCaught++;
    this._score(fx, pts);
    const col = LANTERN_POP[l.hue % LANTERN_POP.length];
    fx.particles?.(l.x, l.y, col, 7, 95);
    this._ring(l.x, l.y, l.r * 0.5, l.r * 2.6, col, 0.4);
    this._vfx('pop', l.x, l.y, { life: 0.5, size: l.r * 1.4, color: col });
    this._vfx('collect', l.x, l.y, { life: 0.3, size: l.r, color: col, tx: g.x, ty: g.y });
    (sound?.collect || sound?.collectGear)?.call(sound, Math.min(14, this.combo - 1));

    let label = mult > 1 ? `+${pts} x${mult}` : `+${pts}`;
    let color = mult > 1 ? '#f472b6' : '#fde68a';
    const p = l.pattern ? this._patterns?.get(l.pattern) : null;
    let show = true;
    if (p) {
      p.got++;
      show = p.got === 1;
      p.tally = (p.tally || 0) + pts;
      if (p.got === p.total && p.missed === 0 && p.total >= 4) {
        show = true;
        const bonus = STRING_BONUS * mult;
        this.strings++;
        this._score(fx, bonus);
        label = `LANTERN STRING! +${p.tally + bonus}`;
        color = '#fde047';
        this._vfx('sparkle', l.x, l.y, { life: 0.75, size: 40 * s, color: '#fef3c7' });
        this._ring(l.x, l.y, l.r, l.r * 6, '#fde68a', 0.7);
        this._patterns.delete(l.pattern);
      }
    }
    if (show) fx.popup?.(l.x, l.y - 18 * s, label, color);
  }

  // ------------------------------------------------------------------ ring gates
  _updateGates(dt, fx, sound) {
    const s = this.s;
    const g = this.glider;
    for (let i = this.gates.length - 1; i >= 0; i--) {
      const gt = this.gates[i];
      gt.age += dt;
      gt.x -= this.scrollSpeed * dt;
      gt.y += Math.sin(gt.age * 1.3 + gt.seed) * 6 * s * dt;
      if (gt.state !== 'open') gt.t += dt;
      const side = g.x >= gt.x ? 1 : -1;
      const crossed = gt.side < 0 && side > 0;
      gt.side = side;

      if (gt.state === 'open' && crossed && this.phase === 'ride' && g.stun <= 0) {
        const dy = Math.abs(g.y - gt.y);
        if (dy < gt.r * 1.04) {
          gt.state = 'passed';
          gt.t = 0;
          this.gatesPassed++;
          this.gateChain++;
          if (this.gateChain > this.maxGateChain) this.maxGateChain = this.gateChain;
          g.catches++;
          g.speed = Math.min(1.7, g.speed + 0.3);
          const mult = this._comboHit();
          const chain = this.gateChain > 1 ? GATE_CHAIN_BONUS * (this.gateChain - 1) : 0;
          const pts = (GATE_POINTS + chain) * mult;
          this._score(fx, pts);

          const isFourChain = this.gateChain > 0 && this.gateChain % 4 === 0;
          if (isFourChain) {
            this.hitFourGateChain = true;
            this._awardGears(fx, sound, 2);
            fx.popup?.(gt.x, gt.y - gt.r - 14 * s, `GATE x${this.gateChain} +${pts} (+2 GEARS)`, '#fde047');
            fx.particles?.(gt.x, gt.y, '#fde047', 20, 175);
            this._vfx('sparkle', gt.x, gt.y, { life: 0.8, size: gt.r * 1.35, color: '#fde047' });
          } else {
            const label = this.gateChain > 1 ? `GATE x${this.gateChain} +${pts}` : `GATE +${pts}`;
            fx.popup?.(gt.x, gt.y - gt.r - 12 * s, label, '#67e8f9');
            fx.particles?.(gt.x, gt.y, '#a5f3fc', 16, 160);
          }

          this._ring(gt.x, gt.y, gt.r * 0.9, gt.r * 2.6, isFourChain ? '#fde047' : '#a5f3fc', 0.6);
          this._vfx('gate', gt.x, gt.y, { life: 0.7, size: gt.r, color: isFourChain ? '#fde047' : '#a5f3fc' });
          this._vfx('whoosh', g.x, g.y, { life: 0.45, size: g.rx, a: 0 });
          (sound?.ringChime || sound?.boostGate || sound?.collectGear)?.call(
            sound,
            Math.min(10, 4 + this.gateChain * 2)
          );
        } else {
          gt.state = 'missed';
          gt.t = 0;
          this.gateChain = 0;
        }
      }
      if (gt.x < -60 * s || (gt.state !== 'open' && gt.t > 1.5)) removeAt(this.gates, i);
    }
  }

  // ------------------------------------------------------------------ thermals
  _updateThermals(dt) {
    const s = this.s;
    this._spiralSpawnT = (this._spiralSpawnT || 0) - dt;
    for (let i = this.thermals.length - 1; i >= 0; i--) {
      const th = this.thermals[i];
      th.age += dt;
      th.x -= this.scrollSpeed * dt;
      th.fade =
        Math.min(1, th.age * 1.5) * (this.phase === 'arrive' ? Math.max(0, 1 - this.arriveT) : 1);
      if (th.x < -th.w - 40 * s) {
        removeAt(this.thermals, i);
      } else if (this._spiralSpawnT <= 0 && this.thermalSpirals.length < 24 && th.x > -20 * s && th.x < this.width + 80 * s) {
        this.thermalSpirals.push({
          x: th.x,
          y: this.seaY - 12 * s,
          w: th.w,
          phase: Math.random() * TAU,
          life: 1.85,
          maxLife: 1.85,
          riseSpeed: (185 + Math.random() * 65) * s,
        });
      }
    }
    if (this._spiralSpawnT <= 0) this._spiralSpawnT = 0.14;
    for (let i = this.thermalSpirals.length - 1; i >= 0; i--) {
      const sp = this.thermalSpirals[i];
      sp.life -= dt;
      sp.x -= this.scrollSpeed * dt;
      sp.y -= sp.riseSpeed * dt;
      sp.phase += dt * 4.8;
      if (sp.life <= 0 || sp.y < this.top - 40 * s || sp.x < -80 * s) {
        removeAt(this.thermalSpirals, i);
      }
    }
  }

  // ------------------------------------------------------------------ hazards
  _stun(hx, hy, fx, sound, kind) {
    const g = this.glider;
    g.stun = 1.0;
    g.stunMax = 1.0;
    g.invuln = 1.9;
    const dx = g.x - hx;
    const dy = g.y - hy;
    const d = Math.hypot(dx, dy) || 1;
    const k = 240 * this.s;
    g.vx = (dx / d) * k * 0.6;
    g.vy = kind === 'bolt' ? 160 * this.s : (dy / d) * k * 0.7;
    g.energy = 0;
    this.hits++;
    this.combo = 0;
    this.comboTimer = 0;
    this.mult = 1;
    this.gateChain = 0;
    const penalty = Math.min(HIT_PENALTY, this.bonus);
    if (penalty > 0) {
      this.bonus -= penalty;
      fx.addScore?.(-penalty);
    }
    const word = kind === 'bolt' ? 'ZAP!' : 'BONK!';
    fx.popup?.(g.x, g.y - 30 * this.s, penalty > 0 ? `${word} -${penalty}` : word, '#fb7185');
    if (kind === 'bolt') {
      fx.particles?.(g.x, g.y, '#e0e7ff', 18, 190);
      fx.particles?.(g.x, g.y, '#fde047', 10, 130);
      this._vfx('zap', g.x, g.y, { life: 0.5, size: 40 * this.s, color: '#c7d2fe' });
      fx.shake?.(8);
      (sound?.jellyZap || sound?.thunderClap || sound?.thunderCrack || sound?.hurt)?.call(sound);
    } else {
      fx.particles?.(hx, hy, '#f8fafc', 16, 150);
      fx.particles?.(g.x, g.y, '#fda4af', 8, 120);
      this._vfx('feathers', hx, hy, { life: 1.2, size: 26 * this.s, color: '#f8fafc' });
      fx.shake?.(6);
      (sound?.hitEnemy || sound?.hurt)?.call(sound);
    }
    this._ring(hx, hy, 8 * this.s, 66 * this.s, kind === 'bolt' ? '#c7d2fe' : '#fda4af', 0.55);
  }

  _nearMiss(h, x, y, r, fx, sound) {
    if (h.nearDone) return;
    const g = this.glider;
    if (this.phase !== 'ride' || g.stun > 0 || g.invuln > 0) {
      if (h.nearArmed) h.nearDone = true;
      return;
    }
    const dx = (x - g.x) / (g.rx + r);
    const dy = (y - g.y) / (g.ry + r);
    if (dx * dx + dy * dy < 2.6) h.nearArmed = true;
    if (h.nearArmed && x < g.x - g.rx * 0.6) {
      h.nearDone = true;
      this._closeCall(y < g.y ? -1 : 1, fx, sound);
    }
  }

  _closeCall(side, fx, sound) {
    const g = this.glider;
    this.nearMisses++;
    g.nearMisses++;
    const mult = this._comboHit();
    const pts = NEAR_MISS_POINTS * mult;
    this._score(fx, pts);
    fx.popup?.(
      g.x,
      g.y - 34 * this.s,
      mult > 1 ? `CLOSE CALL +${pts} x${mult}` : `CLOSE CALL +${pts}`,
      '#67e8f9'
    );
    this._vfx('whoosh', g.x, g.y, { life: 0.45, size: g.rx, a: side });
    (sound?.glideWhoosh || sound?.gust || sound?.stepUp)?.call(sound);
  }

  _updateClouds(dt, fx, sound) {
    const s = this.s;
    const g = this.glider;
    const vulnerable = g.invuln <= 0 && g.stun <= 0 && this.phase === 'ride';
    for (let i = this.clouds.length - 1; i >= 0; i--) {
      const c = this.clouds[i];
      c.age += dt;
      c.t += dt;
      c.x -= this.scrollSpeed * 0.92 * dt;
      c.y += Math.sin(c.age * 0.6 + c.seed) * 4 * s * dt;
      if (c.bumpT > 0) c.bumpT -= dt;
      const onScreen = c.x > this.width * 0.12 && c.x < this.width * 0.97;

      if (c.state === 'idle') {
        if (c.t >= c.next && onScreen && this.phase === 'ride') {
          c.state = 'charge';
          c.t = 0;
          const lead = clamp((g.x + g.vx * 0.4 - c.x) / c.rx, -0.7, 0.7);
          c.strikeX = lead * c.rx * 0.8;
          c.hitDone = false;
          c.nearDone = false;
          c.nearArmed = false;
          sound?.pistonWarn ? sound.pistonWarn() : sound?.vaultTick?.(false);
        }
      } else if (c.state === 'charge') {
        if (c.t >= this._strikeCharge) {
          c.state = 'strike';
          c.t = 0;
          c.strikes++;
          c.seed = Math.random() * 1000;
          const bx = c.x + c.strikeX;
          this._vfx('bolt', bx, c.y + c.ry * 0.5, {
            life: 0.42,
            size: this.seaY - c.y,
            color: '#e0e7ff',
          });
          this._ring(bx, this.seaY, 6 * s, 48 * s, '#c7d2fe', 0.5, true);
          fx.shake?.(3);
          (sound?.thunderClap || sound?.thunderCrack || sound?.hitEnemy)?.call(sound);
        }
      } else if (c.state === 'strike') {
        const bx = c.x + c.strikeX;
        const inCol =
          Math.abs(g.x - bx) < c.boltW + g.rx * 0.55 && g.y > c.y && g.y < this.seaY + 10 * s;
        if (c.t < 0.3 && vulnerable && inCol && !c.hitDone) {
          c.hitDone = true;
          c.nearDone = true;
          this._stun(bx, g.y, fx, sound, 'bolt');
        } else if (
          c.t < 0.3 &&
          !c.hitDone &&
          !c.nearDone &&
          this.phase === 'ride' &&
          g.stun <= 0 &&
          g.invuln <= 0
        ) {
          const d = Math.abs(g.x - bx);
          if (g.y > c.y && d < c.boltW + g.rx * 2.4) {
            c.nearDone = true;
            this._closeCall(g.x < bx ? 1 : -1, fx, sound);
          }
        }
        if (c.t >= 0.42) {
          c.state = 'cool';
          c.t = 0;
          c.next = rand(1.6, 2.6) - this.difficulty * 0.5;
        }
      } else if (c.state === 'cool') {
        if (c.t >= c.next) {
          c.state = 'idle';
          c.t = 0;
          c.next = 0;
        }
      }

      if (this.phase === 'ride' && g.stun <= 0) {
        const dx = (g.x - c.x) / (c.rx * 0.95 + g.rx * 0.5);
        const dy = (g.y - c.y) / (c.ry * 0.95 + g.ry * 0.5);
        if (dx * dx + dy * dy < 1) {
          g.vy += Math.sin(this.t * 31 + c.seed) * 900 * s * dt;
          g.vx += Math.cos(this.t * 23 + c.seed) * 500 * s * dt;
          g.speed += (0.75 - g.speed) * Math.min(1, dt * 3);
          if (c.bumpT <= 0) {
            c.bumpT = 0.6;
            fx.shake?.(2.5);
            this._vfx('puff', g.x, g.y, { life: 0.7, size: g.rx * 1.4, color: '#94a3b8' });
            (sound?.gust)?.call(sound);
          }
        }
      }
      if (c.x < -c.rx * 1.6) removeAt(this.clouds, i);
    }
  }

  _updateGulls(dt, fx, sound) {
    const s = this.s;
    const g = this.glider;
    const vulnerable = g.invuln <= 0 && g.stun <= 0 && this.phase === 'ride';
    for (let i = this.gulls.length - 1; i >= 0; i--) {
      const b = this.gulls[i];
      b.age += dt;
      b.phase += dt * b.flapRate;
      if (b.state === 'fly') {
        b.x += (b.vx - this.scrollSpeed * 0.15) * dt;
        b.baseY += b.vy * dt;
        b.y = b.baseY + Math.sin(b.age * 2.2 + b.seed) * 6 * s;
        if (vulnerable && this._touchesGull(b)) {
          b.state = 'scatter';
          b.t = 0;
          b.nearDone = true;
          this._stun(b.x, b.y, fx, sound, 'gull');
          b.vx = -60 * s;
          b.vy = -160 * s;
          for (const o of this.gulls) {
            if (o !== b && o.flock === b.flock && o.state === 'fly') {
              o.state = 'scatter';
              o.t = 0;
              o.vy = (o.y < g.y ? -1 : 1) * rand(90, 160) * s;
              o.vx = -rand(140, 220) * s;
            }
          }
        } else {
          this._nearMiss(b, b.x, b.y, b.r, fx, sound);
        }
      } else {
        b.t += dt;
        b.x += (b.vx - this.scrollSpeed * 0.3) * dt;
        b.y += b.vy * dt;
        b.vy *= Math.exp(-0.8 * dt);
        b.phase += dt * 6;
      }
      if (b.x < -60 * s || b.y < -60 * s || b.y > this.height + 60 * s) removeAt(this.gulls, i);
    }
  }

  _touchesGull(b) {
    const g = this.glider;
    const dx = (b.x - g.x) / (g.rx * 0.9 + b.r);
    const dy = (b.y - g.y) / (g.ry * 0.9 + b.r * 0.6);
    return dx * dx + dy * dy < 1;
  }

  _updateGusts(dt, fx, sound) {
    const s = this.s;
    const g = this.glider;
    let wind = 0;
    for (let i = this.gusts.length - 1; i >= 0; i--) {
      const u = this.gusts[i];
      u.t += dt;
      u.x -= (this.scrollSpeed * 1.6 + 60 * s) * dt;
      const inX = g.x > u.x && g.x < u.x + u.w;
      const inY = Math.abs(g.y - u.y) < u.h * 0.5;
      if (inX && inY && this.phase === 'ride') {
        const edge = Math.min(1, (g.x - u.x) / (u.w * 0.25), (u.x + u.w - g.x) / (u.w * 0.25));
        const k = u.str * edge;
        g.vy += u.dir * 520 * s * k * dt;
        g.vx -= 90 * s * k * dt;
        wind = u.dir * k;
        if (!u.hit) {
          u.hit = true;
          fx.shake?.(1.5);
          (sound?.gust)?.call(sound);
          this._vfx('gust', g.x, g.y, { life: 0.8, size: g.rx * 2, a: u.dir });
        }
      }
      if (u.x + u.w < -20 * s) removeAt(this.gusts, i);
    }
    this.wind += (wind - this.wind) * Math.min(1, dt * 6);
  }
}

export { GlideStage as FrillGlideStage };
export const GLIDE_STAGE_TIMING = { RIDE_TIME, INTRO_TIME, ARRIVE_TIME, TOWER_LEAD };
