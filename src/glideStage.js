// THE GLIDE: Pogo's hang-glider ride between worlds (the sky counterpart of the MK.7 sub ride).
//
// Pogo launches off the summit of the world he just finished, glides over the sea through a living
// sky and lands beside the first tower of the next world. Pure gameplay logic (no THREE): all state
// lives in CSS-pixel screen coordinates (x right, y down), exactly like SubStage, so the game's
// particle / popup systems can be fed straight through the `fx` callbacks. `GlideRenderer`
// (src/glideRenderer.js) reads this object every frame.
//
// Flight model (one thumb friendly):
//  * gravity: the glider always sinks slowly; steer up / down to climb or dive (up/down, axisY,
//    or a slide push up = jump held = climb a little)
//  * diving builds speed (faster scroll, faster progress); pulling up after a dive converts that
//    speed back into a zoom climb
//  * warm-air THERMALS (shimmering columns rising off the sea) lift you
//  * FIRE / tap (or a slide push up) = a wing FLAP: a quick lift + forward boost on a cooldown
//  * left / right = slower / faster (air brake vs. tuck), and moves you around the screen
//
// Collect sky lanterns (arcs, waves, strings), star kites, a rare golden lantern; fly through
// ring gates. Hazards: storm clouds with telegraphed lightning, gusts, gull flocks. The sky is
// flavoured by the world you just left (`worldIndex`): dawn, day, snow, sunset, night, after-rain,
// gale, storm, ember.

const TAU = Math.PI * 2;
const RIDE_TIME = 22; // nominal seconds of gliding (progress bar 0 -> 1); faster flight gets there sooner
const INTRO_TIME = 2.3; // run + leap off the summit, swoop down, level off
const ARRIVE_TIME = 5.6; // approach, flare, touch down beside the next tower, tally
const TOWER_LEAD = 5.4; // the next tower comes in from the horizon this long before the ride ends

const LANTERN_POINTS = 25;
const STRING_BONUS = 150; // a whole lantern string in one pass
const KITE_POINTS = 200;
const GOLD_POINTS = 800;
const GATE_POINTS = 300;
const GATE_CHAIN_BONUS = 100; // per gate in an unbroken chain
const PERFECT_BONUS = 750;
const HIT_PENALTY = 100;
const NEAR_MISS_POINTS = 50;
const MAX_MULT = 4;
const COMBO_WINDOW = 2.4;
const MAX_VFX = 48;
const FLAP_CD = 0.62;

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const rand = (a, b) => a + Math.random() * (b - a);
const smooth = (t) => t * t * (3 - 2 * t);

function removeAt(arr, i) {
  const last = arr.length - 1;
  if (i !== last) arr[i] = arr[last];
  arr.pop();
}

// order-preserving removal without the temporary array `splice` allocates
function removeOrdered(arr, i) {
  for (let k = i; k < arr.length - 1; k++) arr[k] = arr[k + 1];
  arr.pop();
}

// One sky per departure world (index = the world you just finished, 0-based). Gameplay knobs only;
// the look lives in GlideRenderer.
export const GLIDE_THEMES = [
  { key: 'dawn', label: 'DAWN FLIGHT', storm: 0.6, gust: 0.8, gull: 1.0 }, // Sunrise Shoals -> Clockwork Keep
  { key: 'day', label: 'BLUE SKY', storm: 0.8, gust: 1.0, gull: 1.1 }, // Clockwork Keep -> Frostbite Spire
  { key: 'snow', label: 'SNOW FLURRIES', storm: 0.7, gust: 1.3, gull: 0.8 }, // Frostbite Spire -> Crumbling Mesa
  { key: 'sunset', label: 'SUNSET RUN', storm: 0.9, gust: 1.0, gull: 1.2 }, // Crumbling Mesa -> Lantern Night
  { key: 'night', label: 'LANTERN NIGHT', storm: 0.9, gust: 0.9, gull: 0.7 }, // Lantern Night -> Rising Tide
  { key: 'rain', label: 'AFTER THE RAIN', storm: 1.0, gust: 1.0, gull: 1.1 }, // Rising Tide -> Gale Plains
  { key: 'gale', label: 'GALE FORCE', storm: 0.9, gust: 2.0, gull: 1.0 }, // Gale Plains -> Stormcrown
  { key: 'storm', label: 'INTO THE STORM', storm: 1.9, gust: 1.3, gull: 0.7 }, // Stormcrown -> Abyss Rise
  { key: 'ember', label: 'EMBER SKY', storm: 1.4, gust: 1.2, gull: 1.0 }, // Abyss Rise -> Edge of Doom
];

export class GlideStage {
  constructor() {
    this.width = 390;
    this.height = 620;
    this.s = 1;
    this.active = false;
    this.phase = 'idle'; // idle | intro | ride | arrive | done
    this.glider = this._makeGlider();
    this.lanterns = []; // lanterns, star kites and the golden lantern ({type})
    this.gates = []; // ring gates to fly through
    this.thermals = []; // rising warm-air columns
    this.clouds = []; // storm clouds (lightning hazard)
    this.gulls = [];
    this.gusts = [];
    this.warnings = []; // edge-of-screen telegraphs for things about to enter ({y, t, max, kind})
    this.rings = []; // shock-wave rings for the renderer: {x,y,r0,r1,life,maxLife,color,flat}
    // One-shot presentation events for the renderer (sparkles, pops, whooshes, splashes...).
    // {id, kind, x, y, life, maxLife, size, color, a, tx, ty}; `id` increases so a renderer can
    // spawn its own effects exactly once per event.
    this.vfx = [];
    this._vfxId = 0;
    this.tower = { active: false, x: 0, r: 100, targetX: 0, depth: 0, glow: '#38bdf8', name: '' };
    this.summit = { x: 0, y: 0, r: 60, glow: '#fbbf24' };
    this.theme = GLIDE_THEMES[0];
    this.themeKey = 'dawn';
    this._resetStats();
  }

  _makeGlider() {
    return {
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      rx: 26, // collision half-length (ellipse)
      ry: 14, // collision half-height
      stun: 0, // > 0 while tumbling after a hit (no control)
      stunMax: 1,
      invuln: 0,
      spin: 0, // roll angle in radians for the renderer (tumble)
      flapCd: 0,
      flapT: 9, // seconds since the last flap (wing stroke animation)
      lift: 0, // 0..1 thermal lift being felt (renderer: wing billow, warm glow)
      speed: 1, // airspeed factor (scroll multiplier)
      energy: 0, // stored dive speed for the zoom climb
      dive: 0, // 0..1 how hard we are diving (renderer: speed lines, tucked pose)
      ax: 0, // smoothed acceleration (px/s^2) for banking / squash in the renderer
      ay: 0,
      launch: 0, // 0..1 intro: standing on the summit -> airborne
      landed: 0, // 0..1 arrival: touch-down progress (0 = flying)
      flare: 0, // 0..1 arrival: pitching up to bleed speed before touch-down
      flaps: 0, // counters the renderer watches to trigger squash / cheer / wobble
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
    this.thermalTime = 0;
  }

  start({ width = 390, height = 620, worldIndex = 0, healing = 1, nextWorldName = 'NEXT WORLD', nextGlow = '#38bdf8', fromGlow = '#fbbf24' } = {}) {
    this.width = Math.max(200, width);
    this.height = Math.max(240, height);
    this.s = this._scaleFor(this.width, this.height);
    this.worldIndex = clamp(Math.floor(Number(worldIndex) || 0), 0, 9);
    this.healing = clamp(Number(healing ?? 1) || 0, 0, 1);
    this.nextWorldName = String(nextWorldName || 'NEXT WORLD').toUpperCase();
    this.nextGlow = nextGlow || '#38bdf8';
    this.theme = GLIDE_THEMES[Math.min(this.worldIndex, GLIDE_THEMES.length - 1)];
    this.themeKey = this.theme.key;
    // 0 for the first glide, 1 for the last one
    this.difficulty = clamp(this.worldIndex / 8, 0, 1);

    this.active = true;
    this.phase = 'intro';
    this.t = 0;
    this.rideT = 0;
    this.arriveT = 0;
    this.progress = 0;
    this.scroll = 0;
    this.baseSpeed = 112 * this.s;
    this.scrollSpeed = 0;
    this.wind = 0; // -1..1 current gust push the renderer can show
    this._finished = false;
    this._bannerShown = false;
    this._patternId = 0;
    this._flockId = 0;
    this._touchedDown = false;
    this._splashCd = 0;

    this.lanterns.length = 0;
    this.gates.length = 0;
    this.thermals.length = 0;
    this.clouds.length = 0;
    this.gulls.length = 0;
    this.gusts.length = 0;
    this.warnings.length = 0;
    this.rings.length = 0;
    this.vfx.length = 0;
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
    t.active = true; // visible on the horizon from the start (depth 0 = far away)
    t.depth = 0;
    t.r = this._towerRadius();
    t.targetX = this.width - t.r * 0.7;
    t.x = this.width * 0.8;
    t.glow = this.nextGlow;
    t.name = this.nextWorldName;

    // Spawn schedule (seconds of nominal ride time)
    const d = this.difficulty;
    const th = this.theme;
    this._next = {
      pattern: 0.5,
      thermal: 1.4,
      gate: 2.8,
      kite: 4.2 + Math.random() * 1.5,
      cloud: 5.5 / th.storm,
      gull: 3.6 / th.gull,
      gust: 5.0 / th.gust,
    };
    this._goldAt = Math.random() < 0.6 + this.healing * 0.4 ? rand(7.5, 14.5) : Infinity;
    this._cloudEvery = lerp(8.5, 3.9, d) / th.storm;
    this._gullEvery = lerp(6.2, 3.1, d) / th.gull;
    this._gustEvery = lerp(7.5, 4.0, d) / th.gust;
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
    this.seaY = H * 0.905; // the sea surface where it crosses the gameplay plane
    this.top = Math.max(H * 0.14, 78 * s * 0.9); // highest the glider may go (HUD above)
    this.bottom = this.seaY - 20 * s; // below this the glider skims the waves
    this.summitY = H * 0.44; // the summit platform of the tower you just topped
    this.landY = this.seaY - 26 * s; // the landing beach beside the next tower
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
    this.baseSpeed = 112 * this.s;
    const t = this.tower;
    t.r = this._towerRadius();
    t.targetX = this.width - t.r * 0.7;
    t.x *= kx;
    const sm = this.summit;
    sm.r = this._summitRadius();
    sm.x *= kx;
    sm.y = this.summitY;
  }

  get results() {
    return {
      lanterns: this.lanternsCaught,
      kites: this.kites,
      gold: this.goldCaught,
      gates: this.gatesPassed,
      gatesTotal: this.gatesTotal,
      strings: this.strings,
      bonus: this.bonus,
      hits: this.hits,
      nearMisses: this.nearMisses,
      bestCombo: this.bestCombo,
      perfect: this.perfect,
    };
  }

  // everything you picked up (like SubStage.fishCaught)
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
    // Phases
    if (this.phase === 'intro') {
      if (!this._bannerShown) {
        this._bannerShown = true;
        fx.banner?.(`WORLD ${this.worldIndex + 1} CLEARED`, 'THE GLIDE');
        (sound?.gust)?.call(sound);
      }
      if (this.t >= INTRO_TIME) {
        this.phase = 'ride';
        fx.banner?.(this.theme.label, `NEXT: ${this.nextWorldName}`);
      }
    }
    if (this.phase === 'intro' || this.phase === 'ride') {
      // nominal ride time advances with airspeed: diving / tucking gets you there sooner
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
        return true;
      }
    }

    // The next tower: far on the horizon, growing as you approach; for the last stretch it sweeps in
    // from the horizon to the landing spot while the scroll eases to a stop
    const lead = RIDE_TIME - TOWER_LEAD;
    if (this.phase === 'arrive' || this.rideT >= lead) {
      const k = this.phase === 'arrive' ? 1 : clamp((this.rideT - lead) / TOWER_LEAD, 0, 1);
      tw.depth = Math.max(tw.depth, lerp(0.62, 1, smooth(k)));
    } else {
      tw.depth = 0.62 * clamp(this.rideT / lead, 0, 1);
    }

    // World scroll
    if (this.phase === 'intro') {
      const k = smooth(clamp((this.t - 0.75) / 1.3, 0, 1));
      this.scrollSpeed = this.baseSpeed * k;
      tw.x = this.width * 0.8;
    } else if (this.phase === 'arrive' || this.rideT > lead) {
      // the tower slides from its horizon spot to the landing spot; the world eases to a stop
      const near = this.phase === 'arrive' ? 1 : clamp((this.rideT - lead) / TOWER_LEAD, 0, 1);
      const want = lerp(this.width * 0.8, tw.targetX, smooth(near));
      const remain = Math.max(0, tw.x - tw.targetX);
      tw.x = Math.min(tw.x, want);
      const ease = this.phase === 'arrive' ? clamp(remain / (110 * this.s), 0, 1) * clamp(1 - this.arriveT / 2.2, 0, 1) : 1;
      this.scrollSpeed = this.baseSpeed * g.speed * Math.max(ease, this.phase === 'arrive' ? 0 : 0.35);
    } else {
      this.scrollSpeed = this.baseSpeed * g.speed;
    }
    this.scroll += this.scrollSpeed * dt;
    const sm = this.summit;
    sm.x -= this.scrollSpeed * dt;

    this._updateGlider(dt, input, firePressed, fx, sound);
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
      if (e.kind !== 'whoosh' && e.kind !== 'collect' && e.kind !== 'flap') e.x -= this.scrollSpeed * dt * 0.6;
      if (e.life <= 0) removeOrdered(this.vfx, i); // keep order (ids ascending)
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
      sound?.secret?.();
    }
    fx.banner?.(`WORLD ${this.worldIndex + 2} OF 10`, `ARRIVING: ${this.nextWorldName}`);
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

  _ring(x, y, r0, r1, color, life = 0.45, flat = false) {
    if (this.rings.length > 22) this.rings.shift();
    this.rings.push({ x, y, r0, r1, color, life, maxLife: life, flat });
  }

  // ------------------------------------------------------------------ glider
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
      // stand on the summit, a three-step run-up, leap, swoop down and level out
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
        // swoop: drop off the edge, then pull out of the dive toward the cruise line
        const wantX = W * 0.27;
        const wantY = this.height * 0.47;
        const ax = (wantX - g.x) * 5 - g.vx * 2.6;
        const sink = 340 * s * (1 - smooth(k)) ** 2;
        const ay = (wantY - g.y) * 4.2 * smooth(k) - g.vy * 2.2 * smooth(k) + sink;
        g.vx += ax * dt;
        g.vy += ay * dt;
        g.x += g.vx * dt;
        g.y += g.vy * dt;
        g.speed = lerp(0.4, 1, smooth(k));
        g.dive = clamp(g.vy / (260 * s), 0, 1);
      }
      return;
    }

    if (this.phase === 'arrive') {
      this._autoLand(dt, fx, sound);
      return;
    }

    // ---- ride
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
      g.vy = g.vy * damp + 120 * s * dt; // tumbling: falls a little
      g.speed += (0.8 - g.speed) * Math.min(1, dt * 2);
      g.dive = 0;
    } else {
      g.spin += (Math.round(g.spin / TAU) * TAU - g.spin) * Math.min(1, dt * 10);
      let ix = 0;
      if (input.axisX) ix = clamp(input.axisX, -1, 1);
      else ix = (input.right ? 1 : 0) - (input.left ? 1 : 0);
      let iy = (input.down ? 1 : 0) - (input.up || input.jump ? 1 : 0);
      if (input.axisY) iy = clamp(input.axisY, -1, 1);
      const len = Math.hypot(ix, iy);
      if (len > 1) {
        ix /= len;
        iy /= len;
      }
      // Horizontal: move around the screen (snappy), and set the airspeed (tuck vs. air-brake)
      const maxVx = 190 * s;
      const kx = ix !== 0 ? (ix * g.vx < 0 ? 8 : 5.5) : 2.6;
      g.vx += (ix * maxVx - g.vx) * (1 - Math.exp(-kx * dt));

      // Vertical: a slow sink you steer against; diving builds speed, pulling up spends it
      const sink = 34 * s;
      const steer = 205 * s;
      let wantVy = sink + iy * steer;
      if (iy < -0.2 && g.energy > 0) {
        // zoom climb: trade stored dive speed for height
        const use = Math.min(g.energy, dt * 1.4);
        g.energy -= use;
        wantVy -= 190 * s * (use / Math.max(dt, 1e-4)) * 0.6;
      }
      const ky = iy !== 0 ? 4.2 : 1.8;
      g.vy += (wantVy - g.vy) * (1 - Math.exp(-ky * dt));

      // thermals
      let lift = 0;
      for (const th of this.thermals) {
        const dx = (g.x - th.x) / th.w;
        if (dx > -1 && dx < 1 && g.y > this.top - 10 * s) lift = Math.max(lift, th.str * (1 - dx * dx) * th.fade);
      }
      g.lift += (lift - g.lift) * Math.min(1, dt * 6);
      if (lift > 0.02) {
        g.vy -= lift * 640 * s * dt;
        this.thermalTime += dt;
      }
      if (g.vy < -330 * s) g.vy = -330 * s;

      // dive -> speed + energy
      const diving = clamp((g.vy - 90 * s) / (190 * s), 0, 1);
      g.dive += (diving - g.dive) * Math.min(1, dt * 5);
      if (diving > 0.05) g.energy = Math.min(1.2, g.energy + diving * dt * 0.9);
      else g.energy = Math.max(0, g.energy - dt * 0.12);
      const wantSpeed = 1 + 0.22 * ix + 0.42 * g.dive + (g.flapT < 0.6 ? 0.25 * (1 - g.flapT / 0.6) : 0);
      g.speed += (wantSpeed - g.speed) * (1 - Math.exp(-2.4 * dt));

      // flap: tap (or a slide push up) = a quick lift + forward boost, on a cooldown
      if (firePressed && g.flapCd <= 0) this._flap(fx, sound);
    }
    g.x += g.vx * dt;
    g.y += g.vy * dt;

    const minX = g.rx * 1.2;
    const maxX = W - g.rx * 2.2;
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
      // skimming the waves: a burst of spray and a bounce back up (breaks your combo)
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

  // Arrival autopilot: line up on the beach left of the tower, descend, flare and touch down
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
      // glide slope toward the touch-down point
      const k = clamp(1 - dist / (this.width * 0.6), 0, 1);
      const wantY = lerp(Math.min(g.y, groundY - 50 * s), groundY, smooth(k));
      const wantVx = clamp(dx * 1.6, -150 * s, 150 * s) + 50 * s * (1 - k);
      g.vx += (wantVx - g.vx) * Math.min(1, dt * 3);
      g.vy += (clamp((wantY - g.y) * 2.4, -160 * s, 160 * s) - g.vy) * Math.min(1, dt * 4);
      g.x += g.vx * dt;
      g.y += g.vy * dt;
      g.flare = smooth(clamp(1 - (groundY - g.y) / (60 * s), 0, 1)) * smooth(k);
      g.speed += (0.6 - g.speed) * Math.min(1, dt * 2);
      if ((g.y >= groundY - 2 * s && dist < 60 * s) || this.arriveT > 3.2) {
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
        sound?.pogoCheer?.();
      }
    } else {
      // run it out on the sand and fold the wing
      g.landed = Math.min(1, g.landed + dt * 1.4);
      g.vx *= Math.exp(-3.2 * dt);
      g.x += g.vx * dt;
      g.y = groundY;
      g.flare = Math.max(0, 1 - g.landed * 1.5);
      if (g.landed > 0.15 && !this._cheered) {
        this._cheered = true;
        g.catches++; // a happy hop in the renderer
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
      // half the thermals carry a rising string of lanterns: ride it up to collect them
      if (goodOpen && Math.random() < 0.6) this._pattern('column', x, rand(this.height * 0.45, maxY));
    }
    if (goodOpen && t >= n.pattern) {
      n.pattern = t + rand(2.4, 3.2) - this.healing * 0.3;
      const kinds = ['arc', 'valley', 'wave', 'line', 'line'];
      const kind = kinds[Math.floor(Math.random() * kinds.length)];
      const cy = rand(minY + 40 * s, maxY - 30 * s);
      this._pattern(kind, W + 30 * s, cy);
    }
    if (goodOpen && t >= n.gate) {
      n.gate = t + rand(4.0, 5.2);
      const y = rand(minY + 30 * s, maxY - 20 * s);
      if (!this._crowded(W + 50 * s, y, 70 * s)) {
        this.gates.push({ x: W + 50 * s, y, r: 34 * s, state: 'open', t: 0, age: 0, side: -1, seed: Math.random() * TAU });
        this.gatesTotal++;
        // a few lanterns lead the way through it
        if (Math.random() < 0.55) this._pattern('lead', W + 50 * s, y);
      } else n.gate = t + 0.6;
    }
    if (goodOpen && t >= n.kite) {
      n.kite = t + rand(5.0, 6.5);
      const y = rand(minY + 20 * s, maxY - 40 * s);
      this._addLantern({ type: 'kite', x: W + 40 * s, y, r: 17 * s, drift: rand(10, 24) * s, amp: 26 * s, freq: 1.3, pattern: 0 });
    }
    if (goodOpen && t >= this._goldAt) {
      this._goldAt = Infinity;
      const y = rand(minY + 30 * s, maxY - 40 * s);
      this._addLantern({ type: 'gold', x: W + 30 * s, y, r: 12 * s, drift: 85 * s, amp: 46 * s, freq: 2.8, pattern: 0 });
      sound?.secret?.();
    }
    if (hazardOpen && t >= n.cloud) {
      n.cloud = t + this._cloudEvery * rand(0.8, 1.25);
      const y = rand(this.top + 10 * s, this.height * 0.42);
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
      } else n.cloud = t + 0.8;
    }
    if (hazardOpen && t >= n.gull) {
      n.gull = t + this._gullEvery * rand(0.8, 1.25);
      const y = rand(minY + 10 * s, maxY - 10 * s);
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
      const dir = y < this.height * 0.5 ? 1 : Math.random() < 0.5 ? -1 : 1; // +1 pushes down, -1 up
      this.gusts.push({ x: W + 30 * s, y, w: rand(160, 220) * s, h, dir, str: rand(0.8, 1.0), t: 0, hit: false, warned: false, seed: Math.random() * 100 });
      this.warnings.push({ y, t: 0.9, max: 0.9, kind: dir > 0 ? 'gustDown' : 'gustUp' });
    }
  }

  _crowded(x, y, dist) {
    for (const c of this.clouds) if (Math.abs(c.x - x) < dist + c.rx && Math.abs(c.y - y) < dist) return true;
    for (const g of this.gates) if (Math.abs(g.x - x) < dist && Math.abs(g.y - y) < dist) return true;
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
      // rising string inside a thermal
      for (let k = 0; k < 6; k++) pts.push([x0 + Math.sin(k * 1.3) * 8 * s, cy - k * 34 * s]);
    } else if (kind === 'lead') {
      for (let k = 0; k < 4; k++) pts.push([x0 - (4 - k) * 30 * s - 10 * s, cy]);
      pts.push([x0 + 36 * s, cy]);
    }
    const lo = this.top + 6 * s;
    const hi = this.bottom - 16 * s;
    for (const [x, y] of pts) {
      this._addLantern({ type: 'lantern', x, y: clamp(y, lo, hi), r: 10 * s, drift: 0, amp: 3 * s, freq: 1.6, pattern: id });
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
      type: o.type, // lantern | kite | gold
      x: o.x,
      y: o.y,
      ax: o.x, // motion anchor
      ay: o.y,
      baseY: o.y,
      r: o.r,
      drift: o.drift, // own speed leftwards (kites, gold)
      amp: o.amp,
      freq: o.freq,
      pattern: o.pattern,
      hue: Math.floor(Math.random() * 4),
      phase: Math.random() * TAU,
      age: 0,
      seed: Math.random() * TAU,
      vy: 0,
      pull: 0, // 0..1 being drawn toward the glider (magnet)
    });
  }

  _flock(y, count, diag, delay) {
    const s = this.s;
    const id = ++this._flockId;
    const speed = rand(120, 170) * s * (0.85 + this.difficulty * 0.35);
    const lead = this.width + 30 * s + (delay * (this.scrollSpeed + speed));
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
        state: 'fly', // fly | scatter
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
        // sky lanterns rise gently and sway
        l.ay -= 6 * s * dt;
        l.x = l.ax + Math.sin(l.age * 1.1 + l.phase) * 2.5 * s;
        l.y = l.ay + Math.sin(l.age * l.freq + l.phase) * l.amp;
      } else if (l.type === 'kite') {
        // figure-eight on the wind
        l.x = l.ax + Math.sin(l.age * l.freq * 0.5 + l.phase) * 18 * s;
        l.y = l.ay + Math.sin(l.age * l.freq + l.phase) * l.amp;
      } else {
        // golden lantern: darts about
        l.x = l.ax + Math.sin(l.age * 1.7 + l.phase) * 16 * s;
        l.y = l.ay + Math.sin(l.age * l.freq + l.phase) * l.amp * (1 + 0.5 * Math.sin(l.age * 0.9));
      }
      l.y = clamp(l.y, this.top - 6 * s, this.bottom - 6 * s);
      // gentle magnet once you're close: catches feel generous
      if (canCatch && this._touches(l.x, l.y, l.r, 1.9)) {
        l.pull = Math.min(1, l.pull + dt * 4);
        const k = l.pull * Math.min(1, dt * 9);
        l.ax += (g.x - l.x) * k;
        l.ay += (g.y - l.y) * k;
        l.x += (g.x - l.x) * k;
        l.y += (g.y - l.y) * k;
      }
      if (canCatch && this._touches(l.x, l.y, l.r)) {
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
    const mult = this._comboHit();
    if (l.type === 'gold') {
      const pts = GOLD_POINTS * mult;
      this.goldCaught++;
      this._score(fx, pts);
      fx.popup?.(l.x, l.y - 24 * s, `GOLDEN LANTERN! +${pts}`, '#fde047');
      fx.particles?.(l.x, l.y, '#fde047', 22, 170);
      fx.particles?.(l.x, l.y, '#ffffff', 10, 110);
      this._ring(l.x, l.y, l.r, l.r * 5, '#fde047', 0.75);
      this._vfx('sparkle', l.x, l.y, { life: 0.8, size: l.r * 3.2, color: '#fde047' });
      this._vfx('collect', l.x, l.y, { life: 0.34, size: l.r, color: '#fde047', tx: g.x, ty: g.y });
      fx.shake?.(3);
      sound?.secret?.();
      return;
    }
    if (l.type === 'kite') {
      const pts = KITE_POINTS * mult;
      this.kites++;
      this._score(fx, pts);
      fx.popup?.(l.x, l.y - 22 * s, mult > 1 ? `STAR KITE +${pts} x${mult}` : `STAR KITE +${pts}`, '#f9a8d4');
      fx.particles?.(l.x, l.y, '#f9a8d4', 16, 140);
      this._ring(l.x, l.y, l.r * 0.6, l.r * 3.4, '#fbcfe8', 0.55);
      this._vfx('sparkle', l.x, l.y, { life: 0.7, size: l.r * 2.4, color: '#fbcfe8' });
      this._vfx('pop', l.x, l.y, { life: 0.55, size: l.r * 1.6, color: '#f9a8d4' });
      this._vfx('collect', l.x, l.y, { life: 0.32, size: l.r, color: '#fbcfe8', tx: g.x, ty: g.y });
      sound?.collect?.(Math.min(14, this.combo + 2));
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
    sound?.collect?.(Math.min(14, this.combo - 1));
    // the whole string?
    let label = mult > 1 ? `+${pts} x${mult}` : `+${pts}`;
    let color = mult > 1 ? '#f472b6' : '#fde68a';
    const p = l.pattern ? this._patterns?.get(l.pattern) : null;
    if (p) {
      p.got++;
      if (p.got === p.total && p.missed === 0 && p.total >= 4) {
        const bonus = STRING_BONUS * mult;
        this.strings++;
        this._score(fx, bonus);
        label = `STRING! +${pts + bonus}`;
        color = '#fde047';
        this._vfx('sparkle', l.x, l.y, { life: 0.75, size: 40 * s, color: '#fef3c7' });
        this._ring(l.x, l.y, l.r, l.r * 6, '#fde68a', 0.7);
        this._patterns.delete(l.pattern);
      }
    }
    fx.popup?.(l.x, l.y - 18 * s, label, color);
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
        // the glider's centre crossed the gate plane this frame
        const dy = Math.abs(g.y - gt.y);
        if (dy < gt.r * 0.92) {
          gt.state = 'passed';
          gt.t = 0;
          this.gatesPassed++;
          this.gateChain++;
          g.catches++;
          g.speed = Math.min(1.7, g.speed + 0.3);
          const mult = this._comboHit();
          const chain = this.gateChain > 1 ? GATE_CHAIN_BONUS * (this.gateChain - 1) : 0;
          const pts = (GATE_POINTS + chain) * mult;
          this._score(fx, pts);
          const label = this.gateChain > 1 ? `GATE x${this.gateChain} +${pts}` : `GATE +${pts}`;
          fx.popup?.(gt.x, gt.y - gt.r - 12 * s, label, '#67e8f9');
          fx.particles?.(gt.x, gt.y, '#a5f3fc', 16, 160);
          this._ring(gt.x, gt.y, gt.r * 0.9, gt.r * 2.6, '#a5f3fc', 0.6);
          this._vfx('gate', gt.x, gt.y, { life: 0.7, size: gt.r, color: '#a5f3fc' });
          this._vfx('whoosh', g.x, g.y, { life: 0.45, size: g.rx, a: 0 });
          (sound?.ringChime || sound?.collect)?.call(sound, Math.min(10, 4 + this.gateChain * 2));
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
    for (let i = this.thermals.length - 1; i >= 0; i--) {
      const th = this.thermals[i];
      th.age += dt;
      th.x -= this.scrollSpeed * dt;
      th.fade = Math.min(1, th.age * 1.5) * (this.phase === 'arrive' ? Math.max(0, 1 - this.arriveT) : 1);
      if (th.x < -th.w - 40 * s) removeAt(this.thermals, i);
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
      (sound?.jellyZap)?.call(sound);
    } else {
      fx.particles?.(hx, hy, '#f8fafc', 16, 150);
      fx.particles?.(g.x, g.y, '#fda4af', 8, 120);
      this._vfx('feathers', hx, hy, { life: 1.2, size: 26 * this.s, color: '#f8fafc' });
      fx.shake?.(6);
      (sound?.hitEnemy || sound?.hurt)?.call(sound);
    }
    this._ring(hx, hy, 8 * this.s, 66 * this.s, kind === 'bolt' ? '#c7d2fe' : '#fda4af', 0.55);
  }

  // Squeezing past a hazard (close, but no touch) is worth a few points and keeps the combo alive.
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
    fx.popup?.(g.x, g.y - 34 * this.s, mult > 1 ? `CLOSE CALL +${pts} x${mult}` : `CLOSE CALL +${pts}`, '#67e8f9');
    this._vfx('whoosh', g.x, g.y, { life: 0.45, size: g.rx, a: side });
    (sound?.nearMiss || sound?.gust)?.call(sound);
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
          // aim roughly where the glider will be (fair: it is telegraphed for > 1s)
          const lead = clamp((g.x + g.vx * 0.4 - c.x) / c.rx, -0.7, 0.7);
          c.strikeX = lead * c.rx * 0.8;
          c.hitDone = false;
          c.nearDone = false;
          c.nearArmed = false;
          (sound?.pistonWarn)?.call(sound);
        }
      } else if (c.state === 'charge') {
        if (c.t >= this._strikeCharge) {
          c.state = 'strike';
          c.t = 0;
          c.strikes++;
          c.seed = Math.random() * 1000; // new bolt shape
          const bx = c.x + c.strikeX;
          this._vfx('bolt', bx, c.y + c.ry * 0.5, { life: 0.42, size: this.seaY - c.y, color: '#e0e7ff' });
          this._ring(bx, this.seaY, 6 * s, 48 * s, '#c7d2fe', 0.5, true);
          fx.shake?.(3);
          (sound?.thunderClap || sound?.hitEnemy)?.call(sound);
        }
      } else if (c.state === 'strike') {
        const bx = c.x + c.strikeX;
        const inCol = Math.abs(g.x - bx) < c.boltW + g.rx * 0.55 && g.y > c.y && g.y < this.seaY + 10 * s;
        if (c.t < 0.3 && vulnerable && inCol && !c.hitDone) {
          c.hitDone = true;
          c.nearDone = true;
          this._stun(bx, g.y, fx, sound, 'bolt');
        } else if (c.t < 0.3 && !c.hitDone && !c.nearDone && this.phase === 'ride' && g.stun <= 0 && g.invuln <= 0) {
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
      // flying into the cloud itself: turbulence (a buffet, no damage)
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
          // the rest of the flock scatters too
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
        b.phase += dt * 6; // panicked flapping
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

const LANTERN_POP = ['#fdba74', '#fde68a', '#fca5a5', '#f9a8d4'];

export const GLIDE_STAGE_TIMING = { RIDE_TIME, INTRO_TIME, ARRIVE_TIME, TOWER_LEAD };
