import { COLS, createTowers } from './levels.js';
import { sound } from './audio.js';
import { makeOriginalTower } from './original.js';
import { settings, towerKey, awardMedals, getGhost, saveGhostIfBest, progress, saveProgress } from './settings.js';

function wrapCol(c) {
  return ((c % COLS) + COLS) % COLS;
}

function approach(v, target, delta) {
  if (v < target) return Math.min(target, v + delta);
  if (v > target) return Math.max(target, v - delta);
  return v;
}

function colDist(a, b) {
  let d = wrapCol(b) - wrapCol(a);
  if (d > COLS / 2) d -= COLS;
  if (d < -COLS / 2) d += COLS;
  return d;
}

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Classic-paced movement tuning (deliberate like the 7800 original, but with modern assists)
const PHYS = {
  walkSpeed: 2.3, // columns / second on the ground (~7s per lap of the tower, like the original)
  airSpeed: 2.9, // a running jump carries a little extra distance
  gravity: 15,
  jumpVy: 6.9, // ~1.6 floors high
  stepVy: 5.7, // auto step-up hop onto the next stair
  maxFall: 11,
  poundVy: -14,
};
const ENEMY_PACE = 0.62; // global enemy speed multiplier (classic, deliberate pace)
const ICE_TOP = 0.72; // a frozen enemy's ice block top, in floors above its centre floor
const REWIND_MAX = 3; // seconds of rewind in the meter
const HISTORY_MAX = 240; // 4s of snapshots at 60fps
const GHOST_HZ = 15;

// How strongly wind gusts push, per mechanic
const GUST_STRENGTH = { blizzard: 0.85, wind: 1.25, storm: 1.4 };

export class TowerTopplerGame {
  constructor(renderer, input, callbacks) {
    this.renderer = renderer;
    this.input = input;
    this.cb = callbacks;

    this.campaignTowers = createTowers();
    this.towers = this.campaignTowers;
    this.runMode = 'campaign'; // campaign | daily | endless
    this.towerProvider = (i) => this.campaignTowers[i] || null;
    this.mode = 'title'; // title | tower | summit | topple | results | submarine | paused | gameover | victory
    this.pausedFrom = null;

    this.towerIndex = 0;
    this.score = 0;
    this.nextExtraLife = 5000;
    this.hiScore = Number(safeGet('tt26_hiscore') || 0);
    this.lives = 3;
    this.time = 0;
    this.timer = 90;
    this.towerTime = 0;
    this.healing = 0;

    this.particles = [];
    this.popups = [];
    this.waterEvents = []; // {col, strength} consumed by the renderer (ripples)
    this.snowballs = [];
    this.ledges = [];
    this.elevators = [];
    this.enemies = [];
    this.checkpoints = [];
    this.secrets = [];
    this.boss = null;
    this.mech = this._freshMech('none');
    this.shake = 0;
    this.flash = 0;
    this.hitStop = 0;
    this.slowMo = 1;
    this.comboCount = 0;
    this.comboTimer = 0;
    this.history = [];
    this.rewindMeter = REWIND_MAX;
    this.rewinding = false;
    this.ghost = null;
    this.summit = null;

    this.player = this._freshPlayer({ col: 0, floor: 0 });
    this.camCol = 0;
    this.camFloor = 2;
    this.camAnchor = 0;
    this.topple = { active: false, progress: 0, duration: 2.6 };

    // Submarine ride: an optional SubStage module (set by main.js) or the built-in fallback
    this.subStageFactory = null;
    this.subStage = null;
    this.sub = { x: 80, y: 220, timer: 0, duration: 14, bubbles: [], fish: [], spawnTimer: 0, fireCooldown: 0 };
  }

  get exitDoor() {
    return this.tower?.doors.find((d) => d.isExit) || null;
  }

  get exitFloor() {
    return this.exitDoor ? this.exitDoor.floor : Math.max(1, (this.tower?.floors || 16) - 2);
  }

  // ORIGINAL (1987) campaign: the classic towers, rules and enemies (see original.js)
  get original() {
    return this.runMode === 'campaign' && this.variant === 'original';
  }

  get classic() {
    return Boolean(settings.classic) || this.original;
  }

  _freshPlayer(spawn) {
    return {
      col: spawn.col + 0.5,
      floor: spawn.floor,
      vx: 0,
      vy: 0,
      facing: 1,
      onGround: true,
      onElevator: null,
      onIce: null,
      invuln: 1.0,
      hidden: false,
      tunnelTimer: 0,
      tunnelTarget: null,
      vaultDoor: null,
      safeCol: spawn.col + 0.5,
      safeFloor: spawn.floor,
      fireCooldown: 0,
      muzzleFlash: 0,
      stepUpCooldown: 0,
      squashX: 1,
      squashY: 1,
      coyoteTimer: 0,
      jumpBufferTimer: 0,
      knockbackTimer: 0,
      landingFloor: spawn.floor,
      doorLock: false,
      teeter: 0,
      stunTimer: 0,
      dropThrough: null,
      bestFloor: spawn.floor,
      autoHop: false,
      // New moves & personality
      chargeHeld: 0,
      charge: 0,
      pound: false,
      hang: null,
      frozenSelf: 0,
      hurtFace: 0,
      idleTime: 0,
      celebrate: 0,
      stepDist: 0,
    };
  }

  _freshMech(kind) {
    return {
      kind,
      waterFloor: -0.62, // world sea level (floors)
      collapseFloor: -2,
      collapseApplied: -2,
      gust: { state: 'idle', t: 5 + Math.random() * 3, dir: 1, strength: GUST_STRENGTH[kind] || 0 },
      lightning: 0,
      lightningTimer: 6,
      darkness: kind === 'dark' ? 1 : kind === 'storm' ? 0.45 : 0,
      lowTimeWarned: false,
    };
  }

  // ---------------------------------------------------------------------------------------
  // Runs, towers & setup
  // ---------------------------------------------------------------------------------------

  // mode: 'campaign' | 'daily' | 'endless'; provider(index) -> tower | null
  // resume: a saved run ({score, lives, nextExtraLife, toppled, healing}) to continue from
  startNewGame({ mode = 'campaign', startTower = 0, provider = null, runSeed = null, resume = null, variant = 'reboot' } = {}) {
    this.runMode = mode;
    this.variant = mode === 'campaign' ? variant : 'reboot';
    this.runSeed = runSeed;
    this.towerProvider = provider || ((i) => this.campaignTowers[i] || null);
    this.score = 0;
    this.nextExtraLife = 5000;
    this.lives = 3;
    this.towerIndex = startTower;
    this.toppledThisRun = 0;
    this.healing = mode === 'campaign' ? Math.min(1, startTower / 8) : 0;
    if (resume) {
      this.score = resume.score || 0;
      this.nextExtraLife = resume.nextExtraLife || 5000;
      this.lives = Math.max(1, resume.lives || 3);
      this.toppledThisRun = resume.toppled || 0;
      this.healing = resume.healing ?? this.healing;
    }
    this.loadTower(this.towerIndex);
    this.mode = 'tower';
    this._saveRun();
    this._syncHud();
  }

  // Save/continue: a run is saved at the start of every campaign / endless tower, so CONTINUE
  // on the title resumes from the start of that tower with the same score and lives.
  _saveRun() {
    if (this.runMode !== 'campaign' && this.runMode !== 'endless') return;
    progress.savedRun = {
      mode: this.runMode,
      variant: this.variant || 'reboot',
      towerIndex: this.towerIndex,
      towerName: this.tower?.name || '',
      score: this.score,
      lives: Number.isFinite(this.lives) ? this.lives : 3,
      nextExtraLife: this.nextExtraLife,
      toppled: this.toppledThisRun || 0,
      healing: this.healing || 0,
      runSeed: this.runSeed ?? null,
      mirror: Boolean(settings.mirror),
      at: Date.now(),
    };
    saveProgress();
  }

  _clearSavedRun() {
    if (this.runMode !== 'campaign' && this.runMode !== 'endless') return;
    if (progress.savedRun?.mode !== this.runMode) return;
    progress.savedRun = null;
    saveProgress();
  }

  _prepareTower(raw) {
    // Deep-ish copy so mirror/augment never mutates the source data
    const t = {
      ...raw,
      ledges: raw.ledges.map((l) => ({ ...l })),
      elevators: raw.elevators.map((e) => ({ ...e })),
      doors: raw.doors.map((d) => ({ ...d })),
      enemies: raw.enemies.map((e) => ({ ...e })),
      spawn: { ...raw.spawn },
      mechanic: raw.mechanic || 'none',
      cacheKey: `${raw.id}|${raw.seed ?? ''}|${settings.mirror ? 'm' : ''}|${raw.original ? 'o' : ''}`,
    };
    if (settings.mirror) {
      const mc = (c) => COLS - 1 - c;
      for (const l of t.ledges) {
        l.col = mc(l.col);
        if (l.type === 'conveyorR') l.type = 'conveyorL';
        else if (l.type === 'conveyorL') l.type = 'conveyorR';
      }
      for (const e of t.elevators) e.col = mc(e.col);
      for (const d of t.doors) d.col = mc(d.col);
      for (const e of t.enemies) {
        e.col = wrapCol(COLS - e.col);
        e.dir = -(e.dir || 1);
      }
      t.spawn.col = mc(t.spawn.col);
      if (raw.secrets) t.secrets = raw.secrets.map((s) => ({ col: mc(s.col), floor: s.floor }));
    }
    return t;
  }

  loadTower(idx) {
    let raw = this.towerProvider(idx);
    if (!raw) return false;
    if (this.original) raw = makeOriginalTower(raw);
    const t = this._prepareTower(raw);
    this.tower = t;
    this.towers = this.runMode === 'campaign' ? this.campaignTowers : [t];
    this.timer = t.timeLimit;
    this.towerTime = 0;
    this.particles = [];
    this.popups = [];
    this.snowballs = [];
    this.shake = 0;
    this.flash = 0;
    this.hitStop = 0;
    this.slowMo = 1;
    this.comboCount = 0;
    this.comboTimer = 0;
    this.hitsTaken = 0;
    this.deathsHere = 0;
    this.history = [];
    this.rewindMeter = REWIND_MAX;
    this.rewinding = false;
    this.summit = null;
    this.topple = { active: false, progress: 0, duration: 2.6 };
    this.mech = this._freshMech(t.mechanic);
    sound.setTowerTheme?.(this.runMode === 'campaign' ? t.id : this.runMode);

    const rand = mulberry32((t.seed ?? t.id) * 7919 + 13);

    this.ledges = t.ledges.map((l) => ({
      ...l,
      crumbling: false,
      crumbleTimer: 0,
      shake: false,
      gone: false,
      respawnTimer: 0,
      collapsed: false,
      retracted: false,
      pistonWarn: false,
    }));

    // Clockwork pistons: every third plain solid ledge (never spawn/doors/checkpoints/exit)
    if (t.mechanic === 'pistons') {
      const doorKeys = new Set(t.doors.map((d) => `${d.col},${d.floor}`));
      let k = 0;
      for (const l of this.ledges) {
        if (l.type !== 'solid' || l.floor === 0 || doorKeys.has(`${l.col},${l.floor}`)) continue;
        if (l.floor >= this.exitFloor) continue;
        if (k++ % 3 === 1) l.piston = { period: 4.2, offset: rand() * 4.2 };
      }
    }

    this.elevators = t.elevators.map((e) => ({ ...e, floor: e.startFloor, dir: 1, recallTarget: null }));
    this.enemies = t.enemies.map((e) => this._makeEnemy(e));
    this.flyerTimer = 5.5;

    // Checkpoint flags roughly every 5 floors on a solid ledge
    this.checkpoints = [];
    if (!this.classic) {
      const wanted = t.checkpoints || [];
      const floors = wanted.length ? wanted : [];
      if (!floors.length) for (let f = 5; f < this.exitFloor - 1; f += 5) floors.push(f);
      for (const f of floors) {
        for (let ff = f; ff < f + 3; ff++) {
          const cand = this.ledges.filter((l) => l.floor === ff && (l.type === 'solid' || l.type === 'ice') && !l.piston);
          if (cand.length) {
            const l = cand[Math.floor(cand.length / 2)];
            this.checkpoints.push({ col: l.col + 0.5, floor: l.floor, active: false });
            break;
          }
        }
      }
    }

    // Secret star-fish: vault towers keep them inside the vaults; otherwise 3 on quiet ledges
    this.secrets = [];
    if (this.original) {
      // the 1987 game had no hidden star-fish
    } else if (t.mechanic === 'vault') {
      for (const d of t.doors) if (d.vault) d.used = false;
    } else if (t.secrets && t.secrets.length) {
      this.secrets = t.secrets.map((s) => ({ col: s.col + 0.5, floor: s.floor, got: false }));
    } else {
      this.secrets = this._autoSecrets(rand);
    }
    if (!this.original) this._populateExtras(rand);
    this.secretsTotal = t.mechanic === 'vault' ? t.doors.filter((d) => d.vault).length : this.secrets.length;
    this.secretsGot = 0;

    // Guardian of the final tower
    this.boss = null;
    if (t.mechanic === 'storm' && this.exitDoor) {
      const d = this.exitDoor;
      this.boss = {
        col: d.col + 0.5,
        baseCol: d.col + 0.5,
        floor: d.floor + 1.0,
        hp: 8,
        maxHp: 8,
        awake: false,
        open: false,
        phaseT: 0,
        shotTimer: 2.5,
        hitFlash: 0,
        dead: false,
        deathT: 0,
      };
    }

    this.player = this._freshPlayer(t.spawn);
    this.player.landingFloor = this._computeLandingFloor(this.player.col, this.player.floor);
    this.camCol = this.player.col;
    this.camAnchor = this.player.floor;
    this.camFloor = Math.max(2, this.player.floor + 1.0);

    // Ghost of your best run on this tower
    this.key = towerKey(this.original ? 'original' : this.runMode, t, settings.mirror);
    this.ghostData = settings.ghosts ? getGhost(this.key) : null;
    this.ghostRec = [];
    this.ghostRecT = 0;
    this.ghost = null;

    const sub = this.runMode === 'campaign' ? `${this.original ? 'ORIGINAL · ' : ''}TOWER ${t.id}` : this.runMode === 'daily' ? 'DAILY TOWER' : `ENDLESS · TOWER ${this.towerIndex + 1}`;
    this.cb.onBanner?.(sub, t.name);
    this.cb.onTowerStart?.(t);
    this._syncHud();
    return true;
  }

  // Towers get busier as you go: extra patrols, spiky fuzzballs guarding staircases and
  // robo-eyes that charge when they spot you. Never on the spawn floor, doors or checkpoints.
  _populateExtras(rand) {
    const diff = this._difficulty();
    // Procedural towers already place their own enemies, so add fewer extras there
    const want = Math.round(this.tower.procedural ? diff * 4 : 1 + diff * 8);
    const t = this.tower;
    const blockedKey = new Set(t.doors.map((d) => `${d.col},${d.floor}`));
    const spawnF = t.spawn.floor;
    const top = this.exitFloor;
    const busy = (col, floor) => this.enemies.some((e) => Math.abs(Math.round(e.baseFloor) - floor) < 1 && Math.abs(colDist(e.col, col)) < 2.2);
    // Ledge runs (contiguous columns on a floor)
    const runs = [];
    const byFloor = new Map();
    for (const l of this.ledges) {
      if (l.type === 'box' || l.piston) continue;
      if (!byFloor.has(l.floor)) byFloor.set(l.floor, new Set());
      byFloor.get(l.floor).add(l.col);
    }
    for (const [floor, cols] of byFloor) {
      if (floor <= spawnF + 1 || floor >= top) continue;
      const seen = new Set();
      for (const c of cols) {
        if (seen.has(c)) continue;
        let a = c;
        while (cols.has((a + COLS - 1) % COLS) && !seen.has((a + COLS - 1) % COLS) && (a + COLS - 1) % COLS !== c) a = (a + COLS - 1) % COLS;
        const run = [];
        let k = a;
        while (cols.has(k) && !seen.has(k)) {
          seen.add(k);
          run.push(k);
          k = (k + 1) % COLS;
        }
        runs.push({ floor, cols: run });
      }
    }
    const safe = (col, floor) =>
      !blockedKey.has(`${col},${floor}`) &&
      !this.checkpoints.some((c) => Math.abs(colDist(c.col, col + 0.5)) < 1.5 && c.floor === floor) &&
      !(this.exitDoor && Math.abs(floor - this.exitDoor.floor) < 1);
    let placed = 0;
    let tries = 0;
    while (placed < want && tries < 80 && runs.length) {
      tries++;
      const r = runs[Math.floor(rand() * runs.length)];
      const useSpiker = diff > 0.1 && (r.cols.length < 3 || rand() < 0.4);
      if (useSpiker) {
        const col = r.cols[Math.floor(rand() * r.cols.length)];
        if (!safe(col, r.floor) || busy(col + 0.5, r.floor)) continue;
        this.enemies.push(this._makeEnemy({ type: 'spiker', col: col + 0.5, floor: r.floor, dir: 1, speed: 0, range: 1.1 + rand() * 0.6, extra: true }));
        placed++;
      } else if (r.cols.length >= 3) {
        const col = r.cols[1 + Math.floor(rand() * (r.cols.length - 2))];
        if (!safe(col, r.floor) || busy(col + 0.5, r.floor)) continue;
        const type = diff > 0.12 && rand() < 0.55 ? 'chaser' : rand() < 0.5 ? 'bouncer' : 'roller';
        this.enemies.push(this._makeEnemy({ type, col: col + 0.5, floor: r.floor, dir: rand() < 0.5 ? -1 : 1, speed: type === 'chaser' ? 1.3 : 1.6, extra: true }));
        placed++;
      }
    }
  }

  _autoSecrets(rand) {
    // Prefer short isolated ledges (dead ends) spread across the lower, middle and upper thirds
    const top = this.exitFloor;
    const runLen = (l) =>
      this.ledges.filter((o) => o.floor === l.floor && o.type !== 'box' && Math.abs(colDist(o.col, l.col)) <= 1).length;
    const out = [];
    for (let band = 0; band < 3; band++) {
      const lo = Math.max(1, Math.floor((top * band) / 3));
      const hi = Math.floor((top * (band + 1)) / 3);
      const cand = this.ledges.filter(
        (l) => l.floor >= lo && l.floor < hi && l.type !== 'box' && !l.piston && l.floor !== this.tower.spawn.floor
      );
      if (!cand.length) continue;
      cand.sort((a, b) => runLen(a) - runLen(b) || a.floor - b.floor);
      const pool = cand.slice(0, Math.max(1, Math.ceil(cand.length / 3)));
      const l = pool[Math.floor(rand() * pool.length)];
      out.push({ col: l.col + 0.5, floor: l.floor, got: false });
    }
    return out;
  }

  // First-time contextual hints (each shown once ever, unless hints are reset)
  _hint(id, text) {
    if (this.runMode === 'title') return;
    progress.hintsSeen = progress.hintsSeen || {};
    if (progress.hintsSeen[id]) return;
    if (this._hintCooldown > 0) return;
    progress.hintsSeen[id] = true;
    saveProgress();
    this._hintCooldown = 4.5;
    this.cb.onHint?.(text);
  }

  _difficulty() {
    // 0 on the first tower -> 1 by the eighth (endless keeps climbing)
    return this.runMode === 'campaign' ? this.towerIndex / 7 : Math.min(1.4, 0.25 + this.towerIndex * 0.12);
  }

  _makeEnemy(e) {
    const diff = this._difficulty();
    return {
      hp: e.type === 'spiker' ? 2 : e.type === 'chaser' ? 3 : 1,
      ...e,
      speed: (e.speed || 1.5) * ENEMY_PACE * (1 + diff * 0.45), // later towers are quicker
      baseFloor: e.floor,
      phase: Math.random() * Math.PI * 2,
      stunTimer: 0,
      dead: false,
      deathTimer: 0,
      fallVy: 0,
      hitFlash: 0,
      cueTimer: Math.random() * 1.5,
    };
  }

  // Classic "flying nasty": appears from around the curve of the tower at Pogo's height and
  // sweeps across toward him. Molecules can be shot; eyes are invulnerable and must be dodged.
  _spawnFlyer() {
    const p = this.player;
    const active = this.enemies.filter((e) => e.spawned && !e.dead && !e.fireball).length;
    if (active >= 2) return;
    const side = Math.random() < 0.5 ? -1 : 1;
    const lvl = this.runMode === 'campaign' ? this.towerIndex : Math.min(7, this.towerIndex + 2);
    const type = lvl >= 2 && Math.random() < 0.35 ? 'eye' : 'molecule';
    const speed = 2.0 + lvl * 0.14;
    this.enemies.push(
      this._makeEnemy({
        type,
        col: wrapCol(p.col + side * 7.2),
        floor: Math.max(0.35, p.floor + 0.35),
        dir: -side,
        speed: speed / ENEMY_PACE,
        amp: 0.18,
        spawned: true,
        travel: 0,
      })
    );
    sound.flyerWarn?.();
  }

  togglePause() {
    if (this.mode === 'tower' || this.mode === 'submarine' || this.mode === 'summit') {
      this.pausedFrom = this.mode;
      this.mode = 'paused';
      this.rewinding = false;
      return true;
    } else if (this.mode === 'paused') {
      this.mode = this.pausedFrom || 'tower';
      return false;
    }
    return false;
  }

  // ---------------------------------------------------------------------------------------
  // Score, effects, HUD
  // ---------------------------------------------------------------------------------------

  addScore(pts) {
    this.score += pts;
    if (this.score > this.hiScore) {
      this.hiScore = this.score;
      safeSet('tt26_hiscore', String(this.hiScore));
    }
    if (this.score >= this.nextExtraLife) {
      this.lives = Math.min(6, this.lives + 1);
      this.nextExtraLife += 5000;
      sound.extraLife();
      if (this.mode === 'submarine') {
        this.addPopup({ x: this.renderer.width * 0.5, y: this.renderer.height * 0.4, text: 'EXTRA LIFE!', color: '#f472b6', maxLife: 1.35 });
      } else {
        this.addPopup({ col: this.player.col, floor: this.player.floor + 1.1, text: 'EXTRA LIFE!', color: '#f472b6', maxLife: 1.35 });
      }
    }
  }

  addShake(amount) {
    if (settings.reducedMotion) return;
    this.shake = Math.min(18, Math.max(this.shake, amount));
  }

  _scoreComboHit(basePts, popupPos, baseColor) {
    this.comboCount = Math.min(4, (this.comboCount || 0) + 1);
    this.comboTimer = 3.2;
    const mult = this.comboCount;
    const pts = basePts * mult;
    this.addScore(pts);
    const label = mult > 1 ? `+${pts} (${mult}x!)` : `+${pts}`;
    this.addPopup({ ...popupPos, text: label, color: mult > 1 ? '#f472b6' : baseColor });
  }

  addPopup({ col = null, floor = null, x = null, y = null, text, color = '#ffffff', maxLife = 0.95 }) {
    this.popups.push({ col, floor, x, y, text, color, life: maxLife, maxLife });
  }

  _colFloorToScreen(col, floor, radiusOffset = 14) {
    if (this.renderer.projectColFloor) {
      return this.renderer.projectColFloor(col, floor, this.camCol, radiusOffset / 40);
    }
    return null;
  }

  _spawnSplashDroplets(x, y) {
    const colors = ['#67e8f9', '#22d3ee', '#a5f3fc', '#e0f2fe'];
    for (let i = 0; i < 24; i++) {
      const life = 0.42 + Math.random() * 0.38;
      this.particles.push({
        x: x + (Math.random() - 0.5) * 26,
        y: y + (Math.random() - 0.5) * 8,
        vx: (Math.random() - 0.5) * 260,
        vy: -(130 + Math.random() * 190),
        gravity: 380,
        size: 3 + Math.random() * 4.5,
        color: colors[i % colors.length],
        life,
        maxLife: life,
      });
    }
  }

  _spawnParticles(x, y, color, count = 10, speed = 90, gravity = 180) {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = (0.3 + Math.random() * 0.7) * speed;
      const life = 0.4 + Math.random() * 0.35;
      this.particles.push({
        x,
        y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s - 25,
        gravity,
        size: 3 + Math.random() * 4,
        color,
        life,
        maxLife: life,
      });
    }
  }

  _burstAt(col, floor, color, count, speed) {
    const pos = this._colFloorToScreen(col, floor, 14);
    if (pos) this._spawnParticles(pos.x, pos.y, color, count, speed);
  }

  _hazardFloor() {
    const m = this.mech;
    if (m.kind === 'flood') return m.waterFloor;
    if (m.kind === 'collapse') return m.collapseFloor;
    return -Infinity;
  }

  _syncHud() {
    const p = this.player;
    const exitDoor = this.exitDoor;
    const exitFloor = this.exitFloor;
    const altitudePct = Math.max(0, Math.min(100, Math.round((p.floor / Math.max(1, exitFloor)) * 100)));

    let dirHint = '▲';
    let actionPrompt = null;
    if ((this.mode === 'tower' || this.mode === 'summit') && this.tower) {
      if (exitDoor) {
        const d = colDist(p.col, exitDoor.col + 0.5);
        if (Math.abs(d) < 0.7) dirHint = '▲';
        else dirHint = d > 0 ? '▶' : '◀';
      }
      if (!p.hidden) {
        const nearDoor =
          (p.onGround || p.coyoteTimer > 0) &&
          this.tower.doors.find((d) => Math.abs(d.floor - p.floor) < 0.5 && Math.abs(colDist(p.col, d.col + 0.5)) < 0.72);
        if (nearDoor) {
          if (nearDoor.isExit) actionPrompt = this.boss && !this.boss.dead ? '🔒 DEFEAT THE GUARDIAN' : '▲ EXIT TOWER!';
          else if (nearDoor.vault) actionPrompt = nearDoor.used ? null : '▲ TRICK DOOR?';
          else actionPrompt = '▲ ENTER PORTAL';
        } else if (p.onElevator) {
          actionPrompt = '▲▼ RIDE LIFT';
        } else {
          const nearEl = this.elevators.find((el) => Math.abs(colDist(p.col, el.col + 0.5)) < 1.15);
          if (nearEl && Math.abs(nearEl.floor - p.floor) > 0.35) actionPrompt = '❄️ CALL LIFT';
        }
      }
    }

    const hz = this._hazardFloor();
    this.cb.onHud?.({
      score: this.score,
      hiScore: this.hiScore,
      lives: settings.assist ? Infinity : this.lives,
      timer: this.timer,
      towerId: this.tower ? this.tower.id : 1,
      towerLabel: this.runMode === 'campaign' ? `T${this.tower?.id ?? 1}` : this.runMode === 'daily' ? 'DAY' : `E${this.towerIndex + 1}`,
      dirHint,
      mode: this.mode,
      altitudePct,
      actionPrompt,
      secrets: { got: this.secretsGot || 0, total: this.secretsTotal || 0 },
      rewind: { frac: this.rewindMeter / REWIND_MAX, enabled: !this.classic, active: this.rewinding, infinite: settings.assist },
      boss: this.boss && this.boss.awake && !this.boss.dead ? { hp: this.boss.hp, max: this.boss.maxHp } : null,
      hazard: Number.isFinite(hz) && hz > -0.5 ? { kind: this.mech.kind, below: Math.max(0, p.floor - hz) } : null,
      ghostAhead: this.ghost && this.ghost.visible ? this.ghost.floor - p.floor : null,
    });
  }

  // ---------------------------------------------------------------------------------------
  // Main update
  // ---------------------------------------------------------------------------------------

  update(dtRaw) {
    const speed = Math.max(0.5, Math.min(1, settings.gameSpeed || 1));
    const clampedDt = Math.min(0.05, dtRaw) * speed * this.slowMo;
    this.time += clampedDt;
    if (this.flash > 0) this.flash = Math.max(0, this.flash - clampedDt * 3.5);
    if (this.mech.lightning > 0) this.mech.lightning = Math.max(0, this.mech.lightning - clampedDt * 3);

    // Hit-stop: freeze the simulation for a few frames on big impacts for extra punch
    if (this.hitStop > 0) {
      this.hitStop = Math.max(0, this.hitStop - clampedDt);
      this.input.clearFrame();
      return;
    }

    if (this.shake > 0) {
      this.shake *= Math.exp(-9 * clampedDt);
      if (this.shake < 0.15) this.shake = 0;
    }
    if (this.comboTimer > 0) {
      this.comboTimer = Math.max(0, this.comboTimer - clampedDt);
      if (this.comboTimer <= 0) this.comboCount = 0;
    }

    for (let i = this.popups.length - 1; i >= 0; i--) {
      const pop = this.popups[i];
      pop.life -= clampedDt;
      if (pop.floor != null) pop.floor += clampedDt * 0.85;
      if (pop.y != null) pop.y -= clampedDt * 34;
      if (pop.life <= 0) this.popups.splice(i, 1);
    }
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx * clampedDt;
      p.y += p.vy * clampedDt;
      p.vy += (p.gravity ?? 180) * clampedDt;
      p.life -= clampedDt;
      if (p.life <= 0) this.particles.splice(i, 1);
    }

    if (this.mode === 'tower') {
      // Rewind (hold R / ⟲ / LB): replay history backwards while the meter lasts
      const wantRewind = this.input.state.rewind && !this.classic && this.history.length > 1 && (settings.assist || this.rewindMeter > 0);
      if (wantRewind) {
        if (!this.rewinding) sound.rewindStart?.();
        this.rewinding = true;
        this._stepRewind(clampedDt);
      } else {
        if (this.rewinding) sound.rewindStop?.();
        this.rewinding = false;
        if (!this.classic) this.rewindMeter = Math.min(REWIND_MAX, this.rewindMeter + clampedDt / 8);
        this._updateTower(clampedDt);
        if (this.mode === 'tower' && !this.classic) this._pushHistory();
      }
      this._updateAudio();
    } else if (this.mode === 'summit') {
      this._updateSummit(clampedDt);
    } else if (this.mode === 'topple') {
      this._updateTopple(clampedDt);
    } else if (this.mode === 'submarine') {
      this._updateSubmarine(clampedDt);
    }

    this.input.clearFrame();
  }

  // ---------------------------------------------------------------------------------------
  // Tower simulation
  // ---------------------------------------------------------------------------------------

  _isSolid(l) {
    return !l.gone && !l.collapsed && !l.retracted;
  }

  _updateTower(dt) {
    const p = this.player;
    const inp = this.input.state;
    this.towerTime += dt;

    // Countdown timer (in flood/collapse towers the timer *is* the rising hazard). With the clock
    // switched off (Options > Gameplay) it still runs internally to pace those hazards, but it never
    // ends a life on its own and isn't shown.
    const clockOn = settings.clock !== false;
    this.timer = Math.max(0, this.timer - dt);
    if (clockOn && this.timer <= 15 && !this.mech.lowTimeWarned) {
      this.mech.lowTimeWarned = true;
      sound.lowTimeWhistle?.();
    }
    if (this.timer > 20) this.mech.lowTimeWarned = false;
    const hazardClock = this.mech.kind === 'flood' || this.mech.kind === 'collapse';
    if (this.timer <= 0 && (clockOn || hazardClock)) {
      this._loseLife(this.mech.kind === 'flood' ? 'SWALLOWED BY THE SEA!' : this.mech.kind === 'collapse' && !clockOn ? 'THE TOWER CAVED IN!' : 'TIME UP!');
      return;
    }

    if (p.emote && p.emote.t > 0) p.emote.t -= dt;
    if (this._hintCooldown > 0) this._hintCooldown -= dt;
    this._checkHints(dt);
    for (const k of ['invuln', 'fireCooldown', 'knockbackTimer', 'muzzleFlash', 'stepUpCooldown', 'stunTimer', 'frozenSelf', 'hurtFace']) {
      if (p[k] > 0) p[k] = Math.max(0, p[k] - dt);
    }
    const stunned = p.stunTimer > 0 || p.frozenSelf > 0;

    const springRate = Math.min(1, dt * 14);
    p.squashX += (1 - p.squashX) * springRate;
    p.squashY += (1 - p.squashY) * springRate;

    this._updateMechanics(dt);
    this._recordGhost(dt);
    this._updateGhost();

    // Tunnel / vault transition
    if (p.hidden) {
      p.tunnelTimer -= dt;
      if (p.tunnelTimer <= 0) {
        if (p.vaultDoor) {
          p.col = p.vaultDoor.col + 0.5;
          p.floor = p.vaultDoor.floor;
          p.vaultDoor = null;
        } else if (p.tunnelTarget) {
          p.col = p.tunnelTarget.col + 0.5;
          p.floor = p.tunnelTarget.floor;
          p.safeCol = p.col;
          p.safeFloor = p.floor;
        }
        p.vx = 0;
        p.vy = 0;
        p.hidden = false;
        p.tunnelTarget = null;
        sound.door();
      }
      this._updateCamera(dt);
      this._syncHud();
      return;
    }

    // Crumbling ledges
    for (const l of this.ledges) {
      if (l.collapsed) continue;
      if (l.crumbling && !l.gone) {
        l.crumbleTimer -= dt;
        if (l.crumbleTimer <= 0) {
          l.gone = true;
          l.crumbling = false;
          l.shake = false;
          l.respawnTimer = 4.0;
          sound.crumble();
          this.addShake(4.5);
          this._burstAt(l.col + 0.5, l.floor, '#f59e0b', 10, 85);
        }
      } else if (l.gone) {
        l.respawnTimer -= dt;
        if (l.respawnTimer <= 0) l.gone = false;
      }
    }

    // Elevators
    for (const el of this.elevators) {
      if (el.recallTarget !== null) {
        const diff = el.recallTarget - el.floor;
        if (Math.abs(diff) < 0.05) {
          el.floor = el.recallTarget;
          el.recallTarget = null;
        } else {
          el.floor += Math.sign(diff) * el.speed * 1.6 * dt;
        }
      } else {
        el.floor += el.dir * el.speed * dt;
        if (el.floor >= el.maxFloor) {
          el.floor = el.maxFloor;
          el.dir = -1;
        } else if (el.floor <= el.minFloor) {
          el.floor = el.minFloor;
          el.dir = 1;
        }
      }
    }

    // Surface under the player
    const underLedge = p.onGround ? this._findLedgeAt(p.col, p.floor) : null;
    const isIce = underLedge && underLedge.type === 'ice';
    const convPush = underLedge ? (underLedge.type === 'conveyorR' ? 1.5 : underLedge.type === 'conveyorL' ? -1.5 : 0) : 0;

    // Horizontal input (analog stick = proportional; digital = full speed)
    const maxSpeed = p.onGround ? PHYS.walkSpeed : PHYS.airSpeed;
    const axis = typeof inp.axisX === 'number' && inp.axisX !== 0 ? inp.axisX : (inp.right ? 1 : 0) - (inp.left ? 1 : 0);
    let targetVx = 0;
    if (!stunned && !p.hang && !p.pound && Math.abs(axis) > 0.05) {
      const mag = Math.min(1, Math.max(0.35, Math.abs(axis)));
      targetVx = Math.sign(axis) * maxSpeed * mag;
      p.facing = Math.sign(axis);
    }
    const anyInput = targetVx !== 0 || inp.jump || inp.fire || inp.up || inp.down;
    p.idleTime = anyInput || !p.onGround ? 0 : p.idleTime + dt;
    if (p.idleTime > 7 && !p.yawned) {
      p.yawned = true;
      sound.pogoYawn?.();
    }
    if (p.idleTime === 0) p.yawned = false;

    if ((p.knockbackTimer || 0) <= 0 && !p.hang) {
      let rate;
      if (isIce && p.onGround) rate = 5.5;
      else if (!p.onGround) rate = targetVx === 0 ? 10 : 24;
      else if (targetVx === 0) rate = 34;
      else if (Math.sign(targetVx) !== Math.sign(p.vx) && Math.abs(p.vx) > 0.2) rate = 52;
      else rate = 26;
      p.vx = approach(p.vx, targetVx, rate * dt);
    }

    // Wind gusts push Pogo (less when planted on the ground)
    const g = this.mech.gust;
    const gustDrift = g.state === 'blow' ? g.dir * g.strength * (p.onGround ? 0.7 : 1) : 0;

    const moveDelta = p.hang ? 0 : (p.vx + (p.onGround ? convPush : 0) + gustDrift) * dt;
    let nextCol = wrapCol(p.col + moveDelta);

    // Edge guard: never walk (or get blown) off a solid ledge straight into the sea.
    p.teeter = Math.max(0, (p.teeter || 0) - dt);
    if (!this.classic && p.onGround && !p.onElevator && underLedge && !isIce && !convPush && moveDelta !== 0) {
      const stillSupported = this._findLedgeAt(nextCol, p.floor);
      if (!stillSupported && this._computeLandingFloor(nextCol, p.floor) <= Math.max(-0.5, this._hazardFloor())) {
        nextCol = p.col;
        p.vx = 0;
        p.teeter = 0.25;
      }
    }

    // Shootable blocks stop you walking through them (and in the Original, so does a stunned
    // sliding cannonball: stunning it only buys time, you still can't get past)
    const blockingBox =
      this.ledges.find(
        (l) => this._isSolid(l) && l.type === 'box' && Math.abs(l.floor - p.floor) < 0.6 && Math.abs(colDist(nextCol, l.col + 0.5)) < 0.52
      ) ||
      (this.original &&
        this.enemies.find(
          (en) =>
            !en.dead &&
            en.type === 'roller' &&
            en.stunTimer > 0 &&
            Math.abs(en.floor - p.floor) < 0.6 &&
            Math.abs(colDist(nextCol, en.col)) < 0.62 &&
            Math.abs(colDist(nextCol, en.col)) < Math.abs(colDist(p.col, en.col))
        ));
    if (!blockingBox) p.col = nextCol;
    else p.vx = 0;

    // Doors (UP): exit, tunnels and secret vaults
    // Smart jump: jumping while standing at a door goes through it (why else jump at a door?)
    const jumpAtDoor =
      this.input.justPressed.jump &&
      !stunned &&
      !p.hidden &&
      (p.onGround || p.coyoteTimer > 0) &&
      this.tower.doors.some((d) => Math.abs(d.floor - p.floor) < 0.5 && Math.abs(colDist(p.col, d.col + 0.5)) < 0.55);
    if (jumpAtDoor) this.input.justPressed.jump = false;
    const upTapped = this.input.consumeJustPressed('up') || jumpAtDoor;
    if (!inp.up) p.doorLock = false;
    if (!stunned && (upTapped || (inp.up && !p.doorLock)) && (p.onGround || p.coyoteTimer > 0)) {
      const door = this.tower.doors.find((d) => Math.abs(d.floor - p.floor) < 0.5 && Math.abs(colDist(p.col, d.col + 0.5)) < 0.72);
      if (door) {
        if (door.isExit) {
          if (this.boss && !this.boss.dead) {
            if (upTapped) {
              this.addPopup({ col: p.col, floor: p.floor + 1.2, text: 'SEALED!', color: '#f472b6' });
              sound.stunEnemy();
            }
          } else {
            this._reachSummit();
            return;
          }
        } else if (door.vault) {
          if (!door.used) {
            door.used = true;
            p.hidden = true;
            p.doorLock = true;
            p.tunnelTimer = 0.9;
            p.vaultDoor = door;
            this.secretsGot += 1;
            this.timer += 10;
            p.emote = { kind: 'joy', t: 1.6 };
            this.addScore(500);
            sound.door();
            sound.secret?.();
            this.cb.onBanner?.('SECRET VAULT!', `★ ${this.secretsGot}/${this.secretsTotal} · +500 · +10s`);
            return;
          }
        } else if (door.decoy) {
          // Edge of Doom's summit: a wrong door slams and throws you back down
          if (upTapped) {
            p.doorLock = true;
            sound.door();
            this.addPopup({ col: p.col, floor: p.floor + 1.2, text: 'WRONG DOOR!', color: '#f87171' });
            this._knockDown(Math.random() < 0.5 ? 1 : -1);
            return;
          }
        } else if (door.targetId) {
          const target = this.tower.doors.find((d) => d.id === door.targetId);
          if (target) {
            p.hidden = true;
            p.doorLock = true;
            p.tunnelTimer = 0.35;
            p.tunnelTarget = target;
            sound.door();
            return;
          }
        }
      }
    }

    // Coyote time & jump buffering
    if (p.onGround) p.coyoteTimer = 0.14;
    else p.coyoteTimer = Math.max(0, p.coyoteTimer - dt);
    if (this.input.consumeJustPressed('jump')) p.jumpBufferTimer = 0.15;
    else p.jumpBufferTimer = Math.max(0, p.jumpBufferTimer - dt);

    // Smart jump on a lift: jumping rides it up instead of hopping off (until it reaches the top)
    const liftRide = p.onElevator && p.onElevator.floor < p.onElevator.maxFloor - 0.01;
    if (liftRide && p.jumpBufferTimer > 0) p.jumpBufferTimer = 0;

    // Jump (also lets go of a ledge hang)
    if (!stunned && p.jumpBufferTimer > 0 && (p.onGround || p.coyoteTimer > 0 || p.hang)) {
      p.hang = null;
      p.vy = PHYS.jumpVy;
      if (targetVx !== 0) p.vx = Math.sign(targetVx) * Math.max(Math.abs(p.vx), PHYS.walkSpeed);
      p.onGround = false;
      p.onElevator = null;
      p.onIce = null;
      p.coyoteTimer = 0;
      p.jumpBufferTimer = 0;
      p.autoHop = false;
      p.squashX = 0.76;
      p.squashY = 1.28;
      sound.jump();
    }

    // Ground pound: DOWN in mid-air slams straight down
    const downTapped = this.input.consumeJustPressed('down');
    if (downTapped && !p.onGround && !p.hang && !stunned && !p.pound && p.floor - p.landingFloor > 0.5) {
      p.pound = true;
      p.vy = PHYS.poundVy;
      p.vx = 0;
      p.squashX = 0.7;
      p.squashY = 1.35;
      sound.jump();
    }

    // Classic auto step-up (+1 floor when walking into an adjacent ledge)
    if (p.onGround && Math.abs(targetVx) > 0 && (p.stepUpCooldown || 0) <= 0) {
      const stepFloor = Math.round(p.floor) + 1;
      const blockedOverhead = this.ledges.some(
        (b) => this._isSolid(b) && Math.abs(b.floor - stepFloor) < 0.25 && Math.abs(colDist(p.col, b.col + 0.5)) < 0.35
      );
      if (!blockedOverhead) {
        const stepLedge = this.ledges.find((l) => {
          if (!this._isSolid(l) || l.type === 'box' || Math.abs(l.floor - stepFloor) > 0.2) return false;
          const dc = colDist(p.col, l.col + 0.5);
          return Math.sign(dc) === p.facing && Math.abs(dc) > 0.14 && Math.abs(dc) <= 0.62;
        });
        if (stepLedge) {
          p.vy = PHYS.stepVy;
          p.onGround = false;
          p.onElevator = null;
          p.onIce = null;
          p.coyoteTimer = 0;
          p.stepUpCooldown = 0.22;
          p.autoHop = true;
          p.squashX = 0.82;
          p.squashY = 1.2;
          sound.stepUp();
        }
      }
    }

    // Variable jump cut (real jumps only)
    if (p.onGround) p.autoHop = false;
    if (!inp.jump && !p.autoHop && !p.onGround && !p.onElevator && !p.pound && p.vy > 3.2) {
      p.vy *= Math.pow(0.85, dt * 60);
    }

    this._updateFire(dt, stunned);

    // ----- Vertical physics -----
    const wasOnGround = p.onGround;
    const prevVy = p.vy;

    if (p.hang) {
      // Hanging from a ledge lip, then pulling up
      p.hang.t -= dt;
      p.vy = 0;
      if (p.hang.t <= 0) {
        const l = p.hang.ledge;
        if (this._isSolid(l)) {
          p.col = wrapCol(l.col + 0.5 - Math.sign(colDist(l.col + 0.5, p.col)) * 0.35);
          p.floor = l.floor;
          p.onGround = true;
          p.squashX = 1.14;
          p.squashY = 0.88;
          this._landedOnLedge(l);
          sound.mantle?.();
        }
        p.hang = null;
      }
    } else if (p.onElevator) {
      const el = p.onElevator;
      if (Math.abs(colDist(p.col, el.col + 0.5)) > 0.65) {
        p.onElevator = null;
        p.onGround = false;
      } else {
        if (inp.up || inp.jump) {
          el.recallTarget = null;
          el.dir = 1;
          el.floor = Math.min(el.maxFloor, el.floor + el.speed * 0.45 * dt);
        } else if (inp.down) {
          el.recallTarget = null;
          el.dir = -1;
          el.floor = Math.max(el.minFloor, el.floor - el.speed * 0.45 * dt);
        }
        p.floor = el.floor;
        p.vy = 0;
        p.onGround = true;
      }
    }

    if (!p.onElevator && !p.hang) {
      const prevFloor = p.floor;
      const maxFall = p.pound ? -PHYS.poundVy : PHYS.maxFall;
      p.vy = Math.max(-maxFall, p.vy - PHYS.gravity * dt);
      p.floor += p.vy * dt;
      p.onGround = false;
      p.onIce = null;

      if (p.dropThrough != null && p.floor < p.dropThrough - 0.3) p.dropThrough = null;
      if (p.vy <= 0) {
        const landed = this._findLedgeLanding(p.col, prevFloor, p.floor, p.dropThrough);
        const iceBlock = landed ? null : this._findIceLanding(p.col, prevFloor, p.floor);
        if (landed) {
          p.floor = landed.floor;
          p.vy = 0;
          p.onGround = true;
          p.dropThrough = null;
          this._landImpact(wasOnGround, prevVy);
          this._landedOnLedge(landed);
          if (p.pound) this._poundShockwave(landed);
        } else if (iceBlock) {
          p.floor = iceBlock.floor + ICE_TOP;
          p.vy = 0;
          p.onGround = true;
          p.onIce = iceBlock;
          p.dropThrough = null;
          this._landImpact(wasOnGround, prevVy);
          if (p.pound) this._poundShockwave(null);
        } else {
          for (const el of this.elevators) {
            if (
              (p.dropThrough == null || el.floor < p.dropThrough - 0.05) &&
              Math.abs(colDist(p.col, el.col + 0.5)) < 0.62 &&
              prevFloor >= el.floor - 0.45 &&
              p.floor <= el.floor + 0.35
            ) {
              p.floor = el.floor;
              p.vy = 0;
              p.onGround = true;
              p.onElevator = el;
              this._landImpact(wasOnGround, prevVy);
              if (p.pound) this._poundShockwave(null);
              break;
            }
          }
        }
      }

      // Ledge assists: small gaps snap up (mantle); bigger ones grab the lip and pull up (hang)
      if (!p.onGround && p.dropThrough == null && !stunned && !p.pound && p.vy <= 1.6) {
        const toward = Math.abs(p.vx) > 0.3 ? Math.sign(p.vx) : p.facing;
        const assist = this.ledges.find((l) => {
          if (!this._isSolid(l) || l.type === 'box') return false;
          const gap = l.floor - p.floor;
          if (gap <= 0 || gap > (this.classic ? 0.3 : 0.62)) return false;
          const dc = colDist(p.col, l.col + 0.5);
          return Math.sign(dc) === toward && Math.abs(dc) < (gap <= 0.3 ? 0.72 : 0.95);
        });
        if (assist) {
          const gap = assist.floor - p.floor;
          if (gap <= 0.3 && Math.abs(p.vx) > 0.3) {
            p.floor = assist.floor;
            p.vy = 0;
            p.onGround = true;
            p.squashX = 1.14;
            p.squashY = 0.88;
            sound.stepUp();
            this._landedOnLedge(assist);
          } else if (gap > 0.3 && p.vy <= 0) {
            p.hang = { ledge: assist, t: 0.2 };
            p.vx = 0;
            p.vy = 0;
            p.floor = assist.floor - 0.45;
            sound.ledgeGrab?.();
          }
        }
      }
    }
    if (p.onGround && p.pound) p.pound = false;

    // Footsteps
    if (p.onGround && Math.abs(p.vx) > 0.4) {
      p.stepDist += Math.abs(p.vx) * dt;
      if (p.stepDist > 0.5) {
        p.stepDist = 0;
        const surf = p.onElevator || p.onIce
          ? 'metal'
          : underLedge
          ? { ice: 'ice', crumble: 'crumble', conveyorR: 'conveyor', conveyorL: 'conveyor' }[underLedge.type] || 'stone'
          : 'stone';
        sound.footstep?.(surf);
      }
    }

    // Drowned / fell into the sea
    const seaLine = this.mech.kind === 'flood' ? this.mech.waterFloor - 0.35 : -0.55;
    if (p.floor < seaLine) {
      this.waterEvents.push({ col: p.col, strength: 1.6 });
      sound.splash();
      this.addShake(10);
      const pos = this._colFloorToScreen(p.col, Math.max(p.floor, this.mech.waterFloor), 14);
      this._spawnSplashDroplets(pos ? pos.x : this.renderer.width * 0.5, pos ? pos.y : this.renderer.height * 0.78);
      this._loseLife(this.mech.kind === 'flood' ? 'DROWNED!' : 'SPLASH!');
      return;
    }

    this._updateSnowballs(dt);
    this._updateEnemies(dt);
    this._updateBoss(dt);
    this._updatePickups();

    p.landingFloor = this._computeLandingFloor(p.col, p.floor);
    this._updateCamera(dt);
    this._syncHud();
  }

  _checkHints(dt) {
    const p = this.player;
    if (this.towerTime > 1.5) this._hint('walk', 'Push the stick to walk round the tower. Walk into a step to climb it.');
    if (p.teeter > 0) this._hint('jump', 'Careful — that\'s the sea! Press JUMP to hop across gaps.');
    if (this.towerTime > 9) this._hint('peek', 'Drag anywhere on the screen to look around the tower and plan your route.');
    const near = this.enemies.find((e) => !e.dead && Math.abs(e.floor - p.floor) < 0.8 && Math.abs(colDist(e.col, p.col)) < 3.5);
    if (near) {
      if (this.original) this._hint('fire-orig', 'Snowballs pop cannonballs and break flashing blocks. Eyes, molecules and robots can\'t be hurt: time your way past.');
      else this._hint('fire', 'Tap FIRE to throw a snowball. Bouncers & molecules pop; rollers just freeze.');
      if (!this.original && (near.type === 'eye' || near.type === 'roller' || near.type === 'chaser')) this._hint('charge', 'Hold FIRE to pack a mega-snowball — it freezes anything into an ice block you can stand on!');
    }
    if (!p.onGround && p.floor - p.landingFloor > 1.6 && this.towerTime > 4) this._hint('pound', 'In mid-air, push ▼ to ground-pound: it stuns enemies and smashes blocks.');
    if (this.hitsTaken > 0 && !this.classic) this._hint('rewind', 'Knocked down? Hold ⏪ REWIND to turn back time a few seconds.');
    if (this.secretsGot > 0) this._hint('star', `Hidden star-fish! Find all ${this.secretsTotal} on a tower for a medal.`);
    if (this.mech.kind === 'pistons') this._hint('m-pistons', 'Clockwork ledges slide into the wall — watch for the red blink!');
    if (this.mech.kind === 'vault') this._hint('m-vault', 'Some doors here are tricks… and some hide secret vaults.');
    if (this.mech.kind === 'blizzard') this._hint('m-blizzard', 'Gusts are coming — streaks of wind warn you which way.');
    if (this.mech.kind === 'collapse') this._hint('m-collapse', 'The tower is crumbling from the bottom up. Keep climbing!');
    if (this.mech.kind === 'flood') this._hint('m-flood', 'The sea is rising. The water IS the clock — climb!');
    if (this.mech.kind === 'dark') this._hint('m-dark', 'Night storm. Your lantern lights the way; lightning shows the rest.');
  }

  _landImpact(wasOnGround, prevVy) {
    const p = this.player;
    if (!wasOnGround && prevVy < -1.2) {
      const impact = Math.min(1, Math.abs(prevVy) / 10);
      p.squashX = 1 + 0.28 * Math.max(0.45, impact);
      p.squashY = 1 - 0.24 * Math.max(0.45, impact);
      if (Math.abs(prevVy) > 3.2 && !p.pound) sound.land(impact);
    }
  }

  _landedOnLedge(l) {
    const p = this.player;
    this._onReachFloor(l.floor);
    if ((l.type === 'solid' || l.type === 'ice') && !l.piston) {
      p.safeCol = l.col + 0.5;
      p.safeFloor = l.floor;
    }
    if (l.type === 'crumble' && !l.crumbling) {
      l.crumbling = true;
      l.shake = true;
      l.crumbleTimer = 0.48;
    }
  }

  _poundShockwave(ledge) {
    const p = this.player;
    p.pound = false;
    p.squashX = 1.45;
    p.squashY = 0.62;
    this.addShake(8);
    this.hitStop = 0.05;
    this.input.haptic(30);
    sound.groundPound?.();
    this._burstAt(p.col, p.floor, '#e0f2fe', 16, 160);
    this._burstAt(p.col, p.floor, this.tower.palette.glow, 10, 120);
    this.mech.poundRing = 0.45; // renderer shockwave ring
    // Stun nearby enemies on the same level
    for (const en of this.enemies) {
      if (en.dead || en.fireball) continue;
      if (Math.abs(en.floor - p.floor) < 0.9 && Math.abs(colDist(p.col, en.col)) < 1.7) {
        en.stunTimer = Math.max(en.stunTimer, 2.4);
        en.hitFlash = 0.18;
        sound.freeze?.();
      }
    }
    // Smash shootable blocks beside you; instantly crack a crumbling ledge you land on
    for (const l of this.ledges) {
      if (l.type === 'box' && this._isSolid(l) && Math.abs(l.floor - p.floor) < 0.6 && Math.abs(colDist(p.col, l.col + 0.5)) < 1.4) {
        l.gone = true;
        l.respawnTimer = 999;
        this._scoreComboHit(50, { col: l.col + 0.5, floor: l.floor + 0.5 }, '#fde047');
      }
    }
    if (ledge && ledge.type === 'crumble') ledge.crumbleTimer = Math.min(ledge.crumbleTimer, 0.08);
  }

  // Fire: tap = snowball immediately; keep holding to charge a piercing mega-snowball
  _updateFire(dt, stunned) {
    const p = this.player;
    const inp = this.input.state;
    const fireTapped = this.input.consumeJustPressed('fire');
    if (stunned) {
      p.chargeHeld = 0;
      p.charge = 0;
      return;
    }
    if (fireTapped && p.fireCooldown <= 0) {
      this._shoot(0);
      p.fireCooldown = 0.22;
      p.chargeHeld = 0;
    }
    if (inp.fire) {
      p.chargeHeld += dt;
      if (p.chargeHeld > 0.28 && !this.original) {
        const prev = p.charge;
        p.charge = Math.min(1, (p.chargeHeld - 0.28) / 0.8);
        sound.chargeLevel?.(p.charge);
        if (prev < 1 && p.charge >= 1) this.input.haptic(12);
      }
    } else {
      if (p.charge > 0.25) {
        this._shoot(p.charge);
        p.fireCooldown = 0.3;
      }
      if (p.chargeHeld > 0) sound.chargeStop?.();
      p.chargeHeld = 0;
      p.charge = 0;
    }
  }

  _shoot(power) {
    const p = this.player;
    p.muzzleFlash = 0.14 + power * 0.1;
    const nearEl = this.elevators.find((el) => Math.abs(colDist(p.col, el.col + 0.5)) < 1.15);
    if (nearEl && Math.abs(nearEl.floor - p.floor) > 0.35) {
      nearEl.recallTarget = Math.max(nearEl.minFloor, Math.min(nearEl.maxFloor, p.floor));
      sound.elevator();
    }
    // Snowballs travel all the way round the tower — dodge your own if it comes back!
    this.snowballs.push({
      col: wrapCol(p.col + p.facing * 0.4),
      floor: p.floor + 0.3,
      dir: p.facing,
      life: power > 0 ? 2.4 : 2.05,
      dist: 0,
      power,
      speed: power > 0 ? 7.2 : 8.5,
      hit: new Set(),
    });
    if (power > 0) {
      sound.chargeRelease?.(power);
      p.vx -= p.facing * 1.2 * power; // recoil
      this.addShake(2 + power * 3);
    } else {
      sound.snowball();
    }
  }

  _freezeTime(base) {
    return base * (this.mech.kind === 'blizzard' ? 1.6 : 1);
  }

  _updateSnowballs(dt) {
    const p = this.player;
    for (let i = this.snowballs.length - 1; i >= 0; i--) {
      const sb = this.snowballs[i];
      const step = sb.speed * dt;
      sb.col = wrapCol(sb.col + sb.dir * step);
      sb.dist += step;
      sb.life -= dt;
      if (sb.life <= 0) {
        this.snowballs.splice(i, 1);
        continue;
      }

      // Icy trail
      sb.trailTimer = (sb.trailTimer || 0) - dt;
      if (sb.trailTimer <= 0) {
        sb.trailTimer = sb.power > 0 ? 0.016 : 0.028;
        const pos = this._colFloorToScreen(sb.col, sb.floor, 14);
        if (pos) {
          const life = 0.22 + Math.random() * 0.14;
          this.particles.push({
            x: pos.x + (Math.random() - 0.5) * 4,
            y: pos.y + (Math.random() - 0.5) * 4,
            vx: -sb.dir * (18 + Math.random() * 20),
            vy: (Math.random() - 0.5) * 18,
            gravity: 28,
            size: (2.5 + Math.random() * 2) * (1 + sb.power),
            color: Math.random() < 0.5 ? '#e0f2fe' : '#67e8f9',
            life,
            maxLife: life,
          });
        }
      }

      // Your own snowball coming back round: brrr!
      if (sb.dist > 11 && !p.hidden && p.invuln <= 0 && Math.abs(colDist(sb.col, p.col)) < 0.4 && Math.abs(sb.floor - (p.floor + 0.3)) < 0.5) {
        p.frozenSelf = 0.9;
        p.vx = 0;
        this.addPopup({ col: p.col, floor: p.floor + 1.1, text: 'BRRR!', color: '#a5f3fc' });
        sound.freeze?.();
        this.addShake(3);
        this.snowballs.splice(i, 1);
        continue;
      }

      // Shootable blocks
      const box = this.ledges.find(
        (l) => this._isSolid(l) && l.type === 'box' && Math.abs(l.floor - sb.floor) < 0.7 && Math.abs(colDist(sb.col, l.col + 0.5)) < 0.5
      );
      if (box) {
        box.gone = true;
        box.respawnTimer = 999;
        this._scoreComboHit(50, { col: box.col + 0.5, floor: box.floor + 0.5 }, '#fde047');
        this.addShake(3.5);
        this._burstAt(box.col + 0.5, box.floor + 0.3, '#bae6fd', 8, 95);
        sound.hitEnemy();
        if (!sb.power) {
          this.snowballs.splice(i, 1);
          continue;
        }
      }

      // Enemies. Normal: bouncing balls & molecules pop, rollers freeze, eyes shrug it off.
      // Charged: pierces and freezes anything solid (frozen enemies become ice platforms!).
      // ORIGINAL rules: only bouncing cannonballs pop; sliding cannonballs are stunned; eyes,
      // molecules and robots can't be hurt at all.
      let consumed = false;
      for (const en of this.enemies) {
        if (en.dead || sb.hit.has(en)) continue;
        if (Math.abs(en.floor - sb.floor) < 0.65 + sb.power * 0.25 && Math.abs(colDist(sb.col, en.col)) < 0.55 + sb.power * 0.2) {
          sb.hit.add(en);
          en.hitFlash = 0.18;
          const immune = en.type === 'robot' || (this.original && (en.type === 'eye' || en.type === 'molecule'));
          if (immune) {
            // the snowball just bursts against it
            this._burstAt(en.col, en.floor + 0.3, '#e0f2fe', 6, 65);
            sound.stunEnemy();
            this.addPopup({ col: en.col, floor: en.floor + 0.9, text: 'IMMUNE', color: '#94a3b8' });
          } else if (!sb.power && (en.type === 'spiker' || en.type === 'chaser')) {
            en.hp -= 1;
            if (en.type === 'chaser') en.stunTimer = Math.max(en.stunTimer, 0.6);
            if (en.hp <= 0) this._popEnemy(en);
            else {
              this._burstAt(en.col, en.floor + 0.3, en.type === 'spiker' ? '#fde047' : '#e2e8f0', 8, 90);
              sound.stunEnemy();
              this.addShake(1.5);
            }
          } else if (en.fireball || (!sb.power && (en.type === 'bouncer' || en.type === 'molecule'))) {
            this._popEnemy(en);
          } else if (sb.power > 0) {
            en.stunTimer = this._freezeTime(3 + sb.power * 3);
            this._scoreComboHit(40, { col: en.col, floor: en.floor + 0.5 }, '#a5f3fc');
            this._burstAt(en.col, en.floor + 0.3, '#a5f3fc', 12, 90);
            sound.freeze?.();
          } else if (en.type === 'roller') {
            en.stunTimer = this._freezeTime(3.2);
            if (!this.original) this._scoreComboHit(25, { col: en.col, floor: en.floor + 0.5 }, '#a5f3fc');
            this.addShake(2.0);
            this._burstAt(en.col, en.floor + 0.3, '#a5f3fc', 9, 80);
            (sound.freeze || sound.stunEnemy).call(sound);
          } else {
            this.addShake(1.0);
            this._burstAt(en.col, en.floor + 0.3, '#e0f2fe', 6, 65);
            sound.stunEnemy();
          }
          if (!sb.power) {
            consumed = true;
            break;
          }
        }
      }
      if (!consumed && this.boss && this.boss.awake && !this.boss.dead) {
        const b = this.boss;
        if (Math.abs(colDist(sb.col, b.col)) < 0.8 && Math.abs(b.floor - sb.floor) < 1.0) {
          if (b.open) this._damageBoss(sb.power > 0 ? 3 : 1);
          else {
            sound.stunEnemy();
            this._burstAt(b.col, b.floor, '#e0f2fe', 6, 60);
          }
          consumed = true;
        }
      }
      if (consumed) this.snowballs.splice(i, 1);
    }
  }

  _popEnemy(en) {
    if (!this.player.emote || this.player.emote.t <= 0) this.player.emote = { kind: 'smug', t: 0.7 };
    en.dead = true;
    en.deathTimer = 0.5;
    const pts = en.fireball ? 75 : en.type === 'molecule' || en.type === 'spiker' ? 150 : en.type === 'chaser' ? 250 : 100;
    const col = en.fireball ? '#fb923c' : en.type === 'molecule' ? '#f472b6' : en.type === 'spiker' ? '#fde047' : en.type === 'chaser' ? '#e2e8f0' : '#fca5a5';
    this._scoreComboHit(pts, { col: en.col, floor: en.floor + 0.5 }, col);
    this.addShake(4.0);
    this.hitStop = Math.max(this.hitStop, 0.045);
    this._burstAt(en.col, en.floor + 0.3, en.fireball ? '#fb923c' : en.type === 'molecule' ? '#f472b6' : '#f87171', 14, 140);
    this._burstAt(en.col, en.floor + 0.3, '#e0f2fe', 8, 90);
    sound.hitEnemy();
  }

  _updateEnemies(dt) {
    const p = this.player;
    this.flyerTimer -= dt;
    if (this.flyerTimer <= 0) {
      const lvl = this.runMode === 'campaign' ? this.towerIndex : this.towerIndex + 2;
      this.flyerTimer = Math.max(4.5, 9 - lvl * 0.55) + Math.random() * 3;
      if ((p.floor > 0.5 || lvl > 0) && !this.original) this._spawnFlyer();
    }
    const hz = this._hazardFloor();

    for (let ei = this.enemies.length - 1; ei >= 0; ei--) {
      const en = this.enemies[ei];
      if (en.hitFlash > 0) en.hitFlash = Math.max(0, en.hitFlash - dt);
      if (en.dead) {
        if (en.deathTimer > 0) en.deathTimer = Math.max(0, en.deathTimer - dt);
        if (en.spawned && en.deathTimer <= 0) this.enemies.splice(ei, 1);
        continue;
      }
      // Rising water / collapse swallows enemies too
      if (en.floor < hz - 0.2) {
        en.dead = true;
        en.deathTimer = 0.3;
        continue;
      }
      if (en.stunTimer > 0) {
        const before = en.stunTimer;
        en.stunTimer = Math.max(0, en.stunTimer - dt);
        if (before > 0 && en.stunTimer === 0) sound.thaw?.();
        continue;
      }

      if (en.type === 'spiker') {
        // Hovers up and down over its step, guarding the staircase
        en.floor = en.baseFloor + 0.25 + (Math.sin(this.time * 1.5 + en.phase) * 0.5 + 0.5) * (en.range || 1.2);
        en.col = en.col + Math.sin(this.time * 2.3 + en.phase) * 0.002;
      } else if (en.type === 'roller' || en.type === 'bouncer' || en.type === 'chaser' || en.type === 'robot') {
        const floorLvl = Math.round(en.baseFloor);
        // Robo-eye: spots Pogo on its floor and charges
        let spd = en.speed;
        if (en.type === 'chaser') {
          const dc = colDist(en.col, p.col);
          const sameFloor = Math.abs(p.floor - floorLvl) < 0.35 && !p.hidden;
          const ahead = Math.sign(dc) === en.dir;
          if (sameFloor && Math.abs(dc) < 4.5 && ahead) {
            if (!en.alert) sound.enemyCue?.('roller', 0, false);
            en.alert = Math.min(1, (en.alert || 0) + dt * 3);
          } else {
            en.alert = Math.max(0, (en.alert || 0) - dt * 1.5);
            if (sameFloor && Math.abs(dc) < 3 && !ahead) {
              en.turnT = (en.turnT || 0) + dt;
              if (en.turnT > 0.7) {
                en.dir *= -1;
                en.turnT = 0;
              }
            }
          }
          spd = en.speed * (1 + (en.alert || 0) * 1.6);
        }
        const support = (c) =>
          this.ledges.find((l) => this._isSolid(l) && l.type !== 'box' && l.floor === floorLvl && Math.abs(colDist(c, l.col + 0.5)) <= 0.52);
        if (en.falling || !support(en.col)) {
          en.falling = true;
          en.fallVy -= PHYS.gravity * dt;
          en.baseFloor += en.fallVy * dt;
          en.floor = en.baseFloor;
          if (en.floor < Math.max(-0.6, hz)) {
            this.waterEvents.push({ col: en.col, strength: 1.0 });
            en.dead = true;
            const pos = this._colFloorToScreen(en.col, Math.max(0, hz), 14);
            if (pos) this._spawnSplashDroplets(pos.x, pos.y);
          }
          continue;
        }
        const nextCol = wrapCol(en.col + en.dir * spd * dt);
        const blocked = this.ledges.some(
          (l) => this._isSolid(l) && l.type === 'box' && l.floor === floorLvl && Math.abs(colDist(nextCol, l.col + 0.5)) < 0.75
        );
        if (blocked || !support(nextCol)) en.dir *= -1;
        else en.col = nextCol;
        en.floor = en.type === 'bouncer' ? floorLvl + Math.abs(Math.sin(this.time * 3.2 + en.phase)) * 0.95 : floorLvl;
      } else {
        en.col = wrapCol(en.col + en.dir * en.speed * dt);
        if (en.type === 'molecule') en.floor = en.baseFloor + Math.sin(this.time * 3 + en.phase) * (en.amp || 0.4);
        else if (en.type === 'eye') en.floor = en.baseFloor + Math.sin(this.time * 1.7 + en.phase) * (en.amp || 0.3);
        else en.floor = en.baseFloor;
        if (en.spawned) {
          const target = p.floor + 0.35;
          en.baseFloor += Math.sign(target - en.baseFloor) * Math.min(Math.abs(target - en.baseFloor), (en.fireball ? 0.9 : 0.5) * dt);
          en.travel += en.speed * dt;
          if (en.travel > 14.5) {
            this.enemies.splice(ei, 1);
            continue;
          }
        }
      }

      // Contact: knocked back down to the ledge below (into the sea if there's none)
      if (p.invuln <= 0 && !p.hidden && Math.abs(en.floor - p.floor) < 0.55 && Math.abs(colDist(en.col, p.col)) < 0.5) {
        this._knockDown(colDist(en.col, p.col) >= 0 ? 1 : -1);
        if (en.fireball) {
          en.dead = true;
          en.deathTimer = 0.3;
        }
      }
    }
  }

  // Ice-block platforms made from frozen enemies
  _findIceLanding(col, prevFloor, nextFloor) {
    if (this.original) return null; // standing on frozen enemies is a Reboot trick
    for (const en of this.enemies) {
      if (en.dead || !(en.stunTimer > 0.05) || en.fireball) continue;
      const top = en.floor + ICE_TOP;
      if (prevFloor >= top - 0.15 && nextFloor <= top + 0.05 && Math.abs(colDist(col, en.col)) < 0.58) return en;
    }
    return null;
  }

  _updateBoss(dt) {
    const b = this.boss;
    if (!b) return;
    const p = this.player;
    if (b.hitFlash > 0) b.hitFlash = Math.max(0, b.hitFlash - dt);
    if (b.dead) {
      b.deathT += dt;
      return;
    }
    if (!b.awake) {
      if (p.floor >= this.exitFloor - 4) {
        b.awake = true;
        this.cb.onBanner?.('THE TOWER AWAKENS', 'Shoot the eye when it opens!');
        sound.bossRoar?.();
        this.addShake(10);
      }
      return;
    }
    b.phaseT += dt;
    const cycle = b.phaseT % 4.2;
    const wasOpen = b.open;
    b.open = cycle > 1.6;
    if (b.open && !wasOpen) sound.bossRoar?.();
    b.col = wrapCol(b.baseCol + Math.sin(b.phaseT * 0.6) * 2.2);
    b.floor = this.exitFloor + 1.0 + Math.sin(b.phaseT * 1.3) * 0.25;
    b.shotTimer -= dt;
    if (b.shotTimer <= 0 && Math.abs(p.floor - b.floor) < 7) {
      b.shotTimer = Math.max(1.4, 2.6 - (b.maxHp - b.hp) * 0.15);
      const dir = colDist(b.col, p.col) >= 0 ? 1 : -1;
      this.enemies.push(
        this._makeEnemy({
          type: 'fireball',
          fireball: true,
          spawned: true,
          travel: 0,
          col: b.col,
          floor: b.floor - 0.3,
          dir,
          speed: 2.9 / ENEMY_PACE,
          amp: 0,
        })
      );
      sound.bossShot?.();
    }
  }

  _damageBoss(dmg) {
    const b = this.boss;
    b.hp = Math.max(0, b.hp - dmg);
    b.hitFlash = 0.25;
    this.addShake(6);
    this.hitStop = 0.06;
    this._burstAt(b.col, b.floor, '#f472b6', 18, 160);
    sound.bossHit?.();
    this.addScore(150 * dmg);
    if (b.hp <= 0) {
      b.dead = true;
      b.deathT = 0;
      this.addScore(2000);
      this.addShake(16);
      this.flash = 0.8;
      this.hitStop = 0.15;
      for (const en of this.enemies) if (en.fireball) en.dead = true;
      this._burstAt(b.col, b.floor, '#fde047', 30, 220);
      this._burstAt(b.col, b.floor, '#ffffff', 20, 160);
      sound.bossDefeat?.();
      this.cb.onBanner?.('GUARDIAN DESTROYED!', 'The exit is open · +2000');
    }
  }

  _updatePickups() {
    const p = this.player;
    for (const s of this.secrets) {
      if (s.got) continue;
      if (Math.abs(colDist(p.col, s.col)) < 0.5 && Math.abs(p.floor - s.floor) < 0.7) {
        s.got = true;
        this.secretsGot += 1;
        this.addScore(300);
        this.addPopup({ col: s.col, floor: s.floor + 1.2, text: `★ ${this.secretsGot}/${this.secretsTotal}`, color: '#fde047', maxLife: 1.2 });
        if (sound.collect) sound.collect(this.secretsGot);
        else sound.extraLife();
        this._burstAt(s.col, s.floor + 0.4, '#fde047', 16, 120);
        if (this.secretsGot === this.secretsTotal) sound.secret?.();
        p.emote = { kind: 'joy', t: 1.3 };
      }
    }
    for (const c of this.checkpoints) {
      if (c.active) continue;
      if (p.onGround && Math.abs(colDist(p.col, c.col)) < 0.9 && Math.abs(p.floor - c.floor) < 0.2) {
        c.active = true;
        this.rewindMeter = REWIND_MAX;
        this.timer += 5;
        p.checkpoint = { col: c.col, floor: c.floor };
        p.emote = { kind: 'thumbs', t: 1.2 };
        sound.checkpoint?.();
        this.addPopup({ col: c.col, floor: c.floor + 1.3, text: 'CHECKPOINT +5s', color: '#86efac', maxLife: 1.3 });
        this._burstAt(c.col, c.floor + 0.6, '#86efac', 14, 110);
      }
    }
  }

  // ---------------------------------------------------------------------------------------
  // Tower mechanics
  // ---------------------------------------------------------------------------------------

  _updateMechanics(dt) {
    const m = this.mech;
    const t = this.tower;
    if (m.poundRing > 0) m.poundRing = Math.max(0, m.poundRing - dt);

    // Rising pressure (flood / collapse) follows the clock, after a short grace period
    const frac = 1 - this.timer / Math.max(1, t.timeLimit);
    const pressure = Math.max(0, (frac - 0.08) / 0.92);
    if (m.kind === 'flood') {
      const target = -0.62 + pressure * (this.exitFloor + 0.4);
      m.waterFloor += (target - m.waterFloor) * Math.min(1, dt * 2);
      if (Math.floor(m.waterFloor * 2) !== m.lastWaterStep) {
        m.lastWaterStep = Math.floor(m.waterFloor * 2);
        if (m.waterFloor > 0) sound.waterRise?.();
      }
    } else if (m.kind === 'collapse') {
      m.collapseFloor = -1 + pressure * (this.exitFloor + 0.5);
      const line = Math.floor(m.collapseFloor - 0.5);
      if (line > m.collapseApplied) {
        for (const l of this.ledges) {
          if (!l.collapsed && l.floor <= line) {
            l.collapsed = true;
            this._burstAt(l.col + 0.5, l.floor, this.tower.palette.ledge, 6, 90);
          }
        }
        m.collapseApplied = line;
        sound.collapseRumble?.();
        this.addShake(5);
      }
    }

    // Pistons
    for (const l of this.ledges) {
      if (!l.piston) continue;
      const ph = ((this.towerTime + l.piston.offset) % l.piston.period) / l.piston.period;
      const wasRetracted = l.retracted;
      l.retracted = ph > 0.68;
      l.pistonWarn = ph > 0.5 && ph <= 0.68;
      l.pistonPhase = ph;
      if (l.retracted !== wasRetracted) {
        const near = Math.abs(l.floor - this.player.floor) < 3 && Math.abs(colDist(this.player.col, l.col + 0.5)) < 4;
        if (near) sound.piston?.();
      }
    }

    // Gusts
    const g = m.gust;
    if (g.strength > 0) {
      g.t -= dt;
      if (g.state === 'idle' && g.t <= 0) {
        g.state = 'warn';
        g.t = 1.2;
        g.dir = Math.random() < 0.5 ? -1 : 1;
        sound.gust?.();
      } else if (g.state === 'warn' && g.t <= 0) {
        g.state = 'blow';
        g.t = 1.6;
      } else if (g.state === 'blow' && g.t <= 0) {
        g.state = 'idle';
        g.t = 6 + Math.random() * 4;
      }
    }

    // Lightning
    if (m.kind === 'dark' || m.kind === 'storm') {
      m.lightningTimer -= dt;
      if (m.lightningTimer <= 0) {
        m.lightningTimer = 6 + Math.random() * 6;
        m.lightning = 1;
        setTimeout(() => sound.thunder?.(), 250 + Math.random() * 600);
      }
    }
  }

  // ---------------------------------------------------------------------------------------
  // Rewind
  // ---------------------------------------------------------------------------------------

  _pushHistory() {
    const p = this.player;
    const snap = {
      p: { ...p, onElevator: p.onElevator ? this.elevators.indexOf(p.onElevator) : -1, onIce: null, hang: p.hang ? { ...p.hang } : null },
      timer: this.timer,
      towerTime: this.towerTime,
      score: this.score,
      camCol: this.camCol,
      camFloor: this.camFloor,
      camAnchor: this.camAnchor,
      enemies: this.enemies.map((e) => ({ ...e })),
      ledges: this.ledges.map((l) => [l.gone, l.crumbling, l.crumbleTimer, l.respawnTimer, l.shake, l.collapsed]),
      elevators: this.elevators.map((e) => [e.floor, e.dir, e.recallTarget]),
      boss: this.boss ? { ...this.boss } : null,
      secrets: this.secrets.map((s) => s.got),
      secretsGot: this.secretsGot,
      vaults: this.tower.doors.map((d) => Boolean(d.used)),
      water: this.mech.waterFloor,
      collapseFloor: this.mech.collapseFloor,
      snowballs: this.snowballs.map((s) => ({ ...s, hit: new Set(s.hit) })),
    };
    this.history.push(snap);
    if (this.history.length > HISTORY_MAX) this.history.shift();
  }

  _stepRewind(dt) {
    if (!settings.assist) this.rewindMeter = Math.max(0, this.rewindMeter - dt);
    // Two snapshots per frame: rewinding plays back at 2x
    let snap = null;
    for (let k = 0; k < 2 && this.history.length > 1; k++) snap = this.history.pop();
    if (!snap) return;
    const p = this.player;
    Object.assign(p, snap.p);
    p.onElevator = snap.p.onElevator >= 0 ? this.elevators[snap.p.onElevator] : null;
    this.timer = snap.timer;
    this.towerTime = snap.towerTime;
    this.score = snap.score;
    this.camCol = snap.camCol;
    this.camFloor = snap.camFloor;
    this.camAnchor = snap.camAnchor;
    this.enemies = snap.enemies;
    snap.ledges.forEach((a, i) => {
      const l = this.ledges[i];
      [l.gone, l.crumbling, l.crumbleTimer, l.respawnTimer, l.shake] = a;
      // Collapsed ledges stay collapsed (collapse is irreversible); rewind can't undo it
    });
    snap.elevators.forEach((a, i) => {
      const e = this.elevators[i];
      [e.floor, e.dir, e.recallTarget] = a;
    });
    if (snap.boss) this.boss = snap.boss;
    snap.secrets.forEach((g, i) => (this.secrets[i].got = g));
    this.secretsGot = snap.secretsGot;
    snap.vaults.forEach((u, i) => (this.tower.doors[i].used = u));
    this.mech.waterFloor = snap.water;
    this.snowballs = snap.snowballs;
    this.player.landingFloor = this._computeLandingFloor(p.col, p.floor);
    this._syncHud();
  }

  // ---------------------------------------------------------------------------------------
  // Ghost (best run) record & playback
  // ---------------------------------------------------------------------------------------

  _recordGhost(dt) {
    if (!this.key) return;
    this.ghostRecT += dt;
    const step = 1 / GHOST_HZ;
    while (this.ghostRecT >= step) {
      this.ghostRecT -= step;
      const p = this.player;
      this.ghostRec.push(Math.round(p.col * 100) / 100, Math.round(p.floor * 100) / 100, p.facing);
    }
  }

  _updateGhost() {
    const g = this.ghostData;
    if (!g || !g.d) {
      this.ghost = null;
      return;
    }
    const idx = this.towerTime * GHOST_HZ;
    const i0 = Math.floor(idx);
    const n = g.d.length / 3;
    if (i0 >= n - 1) {
      this.ghost = { visible: false };
      return;
    }
    const f = idx - i0;
    const a = i0 * 3;
    const b = a + 3;
    const dc = colDist(g.d[a], g.d[b]);
    this.ghost = {
      visible: true,
      col: wrapCol(g.d[a] + dc * f),
      floor: g.d[a + 1] + (g.d[b + 1] - g.d[a + 1]) * f,
      facing: g.d[a + 2],
    };
  }

  // ---------------------------------------------------------------------------------------
  // Audio drive
  // ---------------------------------------------------------------------------------------

  _updateAudio() {
    const p = this.player;
    const height = Math.max(0, Math.min(1, p.floor / Math.max(1, this.exitFloor)));
    let danger = 0;
    for (const en of this.enemies) {
      if (en.dead) continue;
      const d = Math.abs(colDist(en.col, p.col)) + Math.abs(en.floor - p.floor) * 1.5;
      danger = Math.max(danger, 1 - Math.min(1, d / 3));
      // Positional cue: enemies you can hear before you see them
      en.cueTimer = (en.cueTimer || 0) - 1 / 60;
      if (en.cueTimer <= 0 && Math.abs(en.floor - p.floor) < 2.5) {
        en.cueTimer = 1.1 + Math.random() * 0.5;
        const theta = ((colDist(this.camCol, en.col) * Math.PI * 2) / COLS);
        sound.enemyCue?.(en.fireball ? 'boss' : en.type, Math.max(-1, Math.min(1, Math.sin(theta))), Math.abs(theta) > Math.PI * 0.5);
      }
    }
    const nearExit = this.exitDoor && Math.abs(p.floor - this.exitDoor.floor) < 0.6 && Math.abs(colDist(p.col, this.exitDoor.col + 0.5)) < 2.5;
    sound.setIntensity?.({
      height,
      timeLeftFrac: this.timer / Math.max(1, this.tower.timeLimit),
      danger,
      atExit: Boolean(nearExit && !(this.boss && !this.boss.dead)),
      rewinding: this.rewinding,
    });
    const g = this.mech.gust;
    sound.setWind?.(Math.min(1, 0.15 + height * 0.65 + (g.state === 'blow' ? 0.35 : g.state === 'warn' ? 0.15 : 0)));
    const camSpeed = Math.abs(this._camVel || 0);
    sound.setTowerCreak?.(Math.min(1, camSpeed / 3));
    sound.setRain?.(this.mech.kind === 'dark' ? 0.8 : this.mech.kind === 'storm' ? 0.5 : 0);
  }

  // ---------------------------------------------------------------------------------------
  // Hits, deaths, respawn
  // ---------------------------------------------------------------------------------------

  _knockDown(dir) {
    const p = this.player;
    sound.hurt();
    this.addShake(9);
    this.input.haptic(40);
    this.hitStop = 0.08;
    if (!settings.reducedMotion) this.flash = 0.6;
    this.hitsTaken += 1;
    p.invuln = 1.7;
    p.stunTimer = 0.5;
    p.hurtFace = 1.2;
    p.vy = 2.6;
    p.vx = dir * 0.9;
    p.onGround = false;
    p.onElevator = null;
    p.onIce = null;
    p.hang = null;
    p.pound = false;
    p.coyoteTimer = 0;
    p.jumpBufferTimer = 0;
    p.knockbackTimer = 0.5;
    p.dropThrough = Math.round(p.floor);
    p.squashX = 1.25;
    p.squashY = 0.78;
    this.comboCount = 0;
    this.comboTimer = 0;
  }

  _onReachFloor(floor) {
    const p = this.player;
    const f = Math.round(floor);
    if (f > (p.bestFloor || 0)) {
      const gained = f - (p.bestFloor || 0);
      p.bestFloor = f;
      if (this.mode === 'tower') {
        this.addScore(25 * gained);
        sound.climb?.();
        this.addPopup({ col: p.col, floor: f + 1.0, text: `+${25 * gained}`, color: '#a7f3d0', maxLife: 0.7 });
      }
    }
  }

  _computeLandingFloor(col, floor) {
    let best = -0.55;
    for (const l of this.ledges) {
      if (this._isSolid(l) && l.type !== 'box' && l.floor <= floor + 0.12 && Math.abs(colDist(col, l.col + 0.5)) < 0.66) {
        if (l.floor > best) best = l.floor;
      }
    }
    for (const el of this.elevators) {
      if (el.floor <= floor + 0.15 && Math.abs(colDist(col, el.col + 0.5)) < 0.64 && el.floor > best) best = el.floor;
    }
    for (const en of this.enemies) {
      if (en.dead || !(en.stunTimer > 0.05) || en.fireball) continue;
      const top = en.floor + ICE_TOP;
      if (top <= floor + 0.12 && Math.abs(colDist(col, en.col)) < 0.58 && top > best) best = top;
    }
    return best;
  }

  _findLedgeAt(col, floor) {
    return this.ledges.find(
      (l) => this._isSolid(l) && l.type !== 'box' && Math.abs(l.floor - floor) < 0.12 && Math.abs(colDist(col, l.col + 0.5)) < 0.66
    );
  }

  _findLedgeLanding(col, prevFloor, nextFloor, dropThrough = null) {
    return this.ledges.find(
      (l) =>
        this._isSolid(l) &&
        l.type !== 'box' &&
        (dropThrough == null || l.floor < dropThrough - 0.05) &&
        prevFloor >= l.floor - 0.15 &&
        nextFloor <= l.floor + 0.05 &&
        Math.abs(colDist(col, l.col + 0.5)) < 0.66
    );
  }

  _updateCamera(dt) {
    const p = this.player;
    const lead = Math.max(-0.6, Math.min(0.6, p.vx * 0.12));
    // Touch camera: drag the view round the tower (±5 columns) and up/down (−3..+6 floors)
    const look = this.input.look;
    let lookColGoal = 0;
    let lookFloorGoal = 0;
    if (look && look.active) {
      lookColGoal = Math.max(-5, Math.min(5, (-look.dx / Math.max(1, look.w)) * 9));
      lookFloorGoal = Math.max(-3, Math.min(6, (look.dy / Math.max(1, look.h)) * 10));
      this._lookHold = 0.5;
    } else if (this._lookHold > 0) {
      this._lookHold -= dt;
      lookColGoal = this.lookCol || 0;
      lookFloorGoal = this.lookFloor || 0;
    }
    const lk = look && look.active ? 12 : 3.5;
    this.lookCol = (this.lookCol || 0) + (lookColGoal - (this.lookCol || 0)) * Math.min(1, dt * lk);
    this.lookFloor = (this.lookFloor || 0) + (lookFloorGoal - (this.lookFloor || 0)) * Math.min(1, dt * lk);
    const d = colDist(this.camCol, p.col + lead + this.lookCol);
    const move = d * Math.min(1, dt * 9);
    this._camVel = dt > 0 ? move / dt : 0;
    this.camCol = wrapCol(this.camCol + move);

    // Look-around: hold the stick up/down while standing still (not at a door or on a lift)
    const inp = this.input.state;
    const nearDoor = this.tower.doors.some((d) => Math.abs(d.floor - p.floor) < 0.5 && Math.abs(colDist(p.col, d.col + 0.5)) < 0.9);
    const canPeek = p.onGround && !p.onElevator && !nearDoor && Math.abs(p.vx) < 0.2 && !(inp.left || inp.right);
    if (canPeek && (inp.up || inp.down)) this._peekHold = (this._peekHold || 0) + dt;
    else this._peekHold = 0;
    const peekGoal = this._peekHold > 0.3 ? (inp.up ? 3.5 : -3) : 0;
    this.peek = (this.peek || 0) + (peekGoal - (this.peek || 0)) * Math.min(1, dt * 4);
    if (p.onGround || p.hidden || p.hang) this.camAnchor = p.floor;
    let focus = this.camAnchor;
    if (!p.onGround && !p.hidden && !p.hang) {
      if (p.floor < this.camAnchor) focus = p.floor;
      else focus = this.camAnchor + (p.floor - this.camAnchor) * 0.3;
    }
    const targetFloor = Math.max(2, focus + 1.0 + (this.peek || 0) + (this.lookFloor || 0));
    const rate = look && look.active ? 10 : targetFloor < this.camFloor ? 6.5 : 4.5;
    this.camFloor += (targetFloor - this.camFloor) * Math.min(1, dt * rate);
  }

  _respawnSpot() {
    const p = this.player;
    const hz = this._hazardFloor();
    const ok = (col, floor) => {
      if (floor < hz + 1.2) return false;
      const l = this._findLedgeAt(col, floor);
      return Boolean(l);
    };
    if (ok(p.safeCol, p.safeFloor)) return { col: p.safeCol, floor: p.safeFloor };
    if (p.checkpoint && ok(p.checkpoint.col, p.checkpoint.floor)) return p.checkpoint;
    // Lowest solid ledge safely above the hazard
    const cands = this.ledges
      .filter((l) => this._isSolid(l) && (l.type === 'solid' || l.type === 'ice') && l.floor >= hz + 1.2)
      .sort((a, b) => a.floor - b.floor);
    if (cands.length) return { col: cands[0].col + 0.5, floor: cands[0].floor };
    return { col: this.tower.spawn.col + 0.5, floor: this.tower.spawn.floor };
  }

  _loseLife(reason) {
    if (!settings.assist) this.lives -= 1;
    this.deathsHere += 1;
    this.input.haptic(60);
    if (this.lives <= 0) {
      this.mode = 'gameover';
      sound.stopAmbience?.();
      this._clearSavedRun();
      this._syncHud();
      this._recordBest();
      this.cb.onGameOver?.(false, this.score, this.hiScore, this._runSummary());
      return;
    }
    this.cb.onBanner?.(reason, settings.assist ? 'ASSIST MODE' : `${this.lives} ${this.lives === 1 ? 'LIFE' : 'LIVES'} LEFT`);
    if (this.timer <= 0) this.timer = this.tower.timeLimit;

    const spot = this._respawnSpot();
    // Push rising water / collapse back below the respawn point so you get a fair go
    const m = this.mech;
    if (m.kind === 'flood' || m.kind === 'collapse') {
      const span = this.exitFloor + (m.kind === 'flood' ? 0.4 : 0.5);
      const base = m.kind === 'flood' ? -0.62 : -1;
      const wantLevel = Math.min(this._hazardFloor(), spot.floor - 2.5);
      const pressure = Math.max(0, (wantLevel - base) / span);
      const frac = 0.08 + pressure * 0.92;
      this.timer = Math.max(this.timer, this.tower.timeLimit * (1 - frac));
      if (m.kind === 'flood') m.waterFloor = Math.min(m.waterFloor, wantLevel);
    }

    const p = this.player;
    const keep = { bestFloor: p.bestFloor, checkpoint: p.checkpoint, facing: p.facing };
    this.player = this._freshPlayer({ col: spot.col - 0.5, floor: spot.floor });
    Object.assign(this.player, keep);
    this.player.invuln = 1.8;
    this.enemies = this.enemies.filter((e) => !e.spawned);
    this.flyerTimer = 6;
    this.history = [];
    this.camAnchor = this.player.floor;
    this.comboCount = 0;
    this.comboTimer = 0;
    this.player.landingFloor = this._computeLandingFloor(this.player.col, this.player.floor);
    this._syncHud();
  }

  // ---------------------------------------------------------------------------------------
  // Summit → topple → results → ride
  // ---------------------------------------------------------------------------------------

  _reachSummit() {
    this.mode = 'summit';
    this.summit = { t: 0, duration: 1.7 };
    this.rewinding = false;
    const p = this.player;
    p.vx = 0;
    p.celebrate = 1;
    sound.celebrate?.();
    sound.pogoCheer?.();
    this.input.haptic([20, 30, 20, 30, 60]);
    this._burstAt(p.col, p.floor + 1, '#fde047', 26, 200);
    this._burstAt(p.col, p.floor + 1, '#f472b6', 18, 160);
    this.cb.onBanner?.('SUMMIT!', this.tower.name);
  }

  _updateSummit(dt) {
    const s = this.summit;
    s.t += dt;
    this.player.celebrate = 1;
    // Slow-motion swell: real time keeps flowing for the camera pull-back
    this.slowMo = s.t < 1.1 ? 0.55 : 1;
    if (Math.random() < 0.3) this._burstAt(this.player.col + (Math.random() - 0.5) * 2, this.player.floor + 1.5, Math.random() < 0.5 ? '#fde047' : '#a5f3fc', 3, 120);
    this._syncHud();
    if (s.t >= s.duration) {
      this.slowMo = 1;
      this._triggerTowerTopple();
    }
  }

  _triggerTowerTopple() {
    this.mode = 'topple';
    this.topple = { active: true, progress: 0, duration: 2.8 };
    const timeBonus = settings.clock !== false ? Math.ceil(this.timer) * 10 : 0;
    this.towerBonus = 500 + timeBonus;
    this.addScore(this.towerBonus);
    this.addShake(12);
    sound.towerTopple();
    this.input.haptic([30, 40, 60]);
    this.cb.onBanner?.('TOWER TOPPLED!', `+${this.towerBonus} BONUS`);
  }

  _updateTopple(dt) {
    this.topple.progress += dt / this.topple.duration;
    this.shake = settings.reducedMotion ? 0 : Math.max(this.shake, 5 * (1 - this.topple.progress));
    if (Math.random() < 0.45) {
      this._spawnParticles(
        this.renderer.width * (0.3 + Math.random() * 0.4),
        this.renderer.height * (0.25 + Math.random() * 0.45),
        this.tower.palette.ledge,
        4,
        110
      );
    }
    if (this.topple.progress >= 1) this._finishTower();
  }

  _finishTower() {
    const timeTaken = this.towerTime;
    const earned = {
      // Speed medal: climbed within 60% of the tower's time limit (works with the clock off too)
      time: this.towerTime <= this.tower.timeLimit * 0.6,
      nohit: this.hitsTaken === 0 && this.deathsHere === 0,
      secrets: this.secretsTotal > 0 && this.secretsGot >= this.secretsTotal,
    };
    const fresh = awardMedals(this.key, earned, timeTaken);
    let newGhost = false;
    if (this.key) newGhost = saveGhostIfBest(this.key, timeTaken, this.ghostRec);
    this.toppledThisRun = (this.toppledThisRun || 0) + 1;
    progress.towersCleared = (progress.towersCleared || 0) + 1;
    if (this.runMode === 'endless') progress.endlessBestTower = Math.max(progress.endlessBestTower || 0, this.towerIndex + 1);
    saveProgress();
    this.healing = Math.min(1, this.runMode === 'campaign' ? this.tower.id / 8 : (this.towerIndex + 1) / 8);
    sound.medal?.((earned.time ? 1 : 0) + (earned.nohit ? 1 : 0) + (earned.secrets ? 1 : 0));

    this.mode = 'results';
    this.cb.onTowerResults?.({
      mode: this.runMode,
      towerName: this.tower.name,
      towerLabel: this.runMode === 'campaign' ? `TOWER ${this.tower.id}` : this.runMode === 'daily' ? 'DAILY TOWER' : `ENDLESS ${this.towerIndex + 1}`,
      timeTaken,
      timeLeft: this.timer,
      bonus: this.towerBonus,
      score: this.score,
      earned,
      fresh,
      secrets: { got: this.secretsGot, total: this.secretsTotal },
      hits: this.hitsTaken,
      newGhost,
      ghostTime: this.ghostData ? this.ghostData.t : null,
      last: !this.towerProvider(this.towerIndex + 1),
    });
  }

  // Called by the UI when the results card is dismissed
  continueAfterResults() {
    if (this.mode !== 'results') return;
    if (!this.towerProvider(this.towerIndex + 1)) {
      this.mode = 'victory';
      sound.stopAmbience?.();
      this._clearSavedRun();
      this._recordBest();
      this.cb.onGameOver?.(true, this.score, this.hiScore, this._runSummary());
      return;
    }
    this.startSubmarineStage();
  }

  _recordBest() {
    const key = this.runMode;
    progress.bestScores[key] = Math.max(progress.bestScores[key] || 0, this.score);
    if (this.runMode === 'daily' && this.tower) {
      const s = this.tower.seed ?? 0;
      progress.dailyBest[s] = Math.max(progress.dailyBest[s] || 0, this.score);
    }
    saveProgress();
  }

  _runSummary() {
    return {
      mode: this.runMode,
      towers: this.toppledThisRun || 0,
      towerName: this.tower?.name,
      towerIndex: this.towerIndex,
      mirror: settings.mirror,
      classic: settings.classic,
    };
  }

  startSubmarineStage() {
    this.mode = 'submarine';
    this.particles = [];
    this.popups = [];
    this.shake = 0;
    this.comboCount = 0;
    this.comboTimer = 0;
    sound.stopAmbience?.();
    sound.setTowerTheme?.('sub');
    sound.setUnderwater?.(true);
    const next = this.towerProvider(this.towerIndex + 1);
    if (this.subStageFactory) {
      this.subStage = this.subStageFactory();
      this.subStage.start({
        width: this.renderer.width,
        height: this.renderer.height,
        towerIndex: this.towerIndex,
        healing: this.healing,
        nextTowerName: next ? next.name : '',
        nextGlow: next ? next.palette.glow : '#38bdf8',
      });
      this.cb.onBanner?.('THE RIDE', 'Catch fish · avoid jellyfish');
    } else {
      const w = this.renderer.width;
      const h = this.renderer.height;
      this.sub = { x: w * 0.22, y: h * 0.5, timer: 0, duration: 13.5, bubbles: [], fish: [], spawnTimer: 0.4, fireCooldown: 0 };
      this.cb.onBanner?.('BONUS STAGE', 'MK.7 MINI-SUBMARINE');
    }
    this._syncHud();
  }

  _endSubmarine() {
    sound.setUnderwater?.(false);
    this.subStage = null;
    this.towerIndex += 1;
    this.loadTower(this.towerIndex);
    this.mode = 'tower';
    this._saveRun();
  }

  _updateSubmarine(dt) {
    if (this.subStage) {
      const firePressed = this.input.consumeJustPressed('fire') || this.input.consumeJustPressed('jump');
      const fx = {
        addScore: (pts) => this.addScore(pts),
        popup: (x, y, text, color) => this.addPopup({ x, y, text, color }),
        particles: (x, y, color, count, spd) => this._spawnParticles(x, y, color, count, spd),
        shake: (a) => this.addShake(a),
        banner: (sub, title) => this.cb.onBanner?.(sub, title),
        sound,
      };
      const done = this.subStage.update(dt, this.input.state, firePressed, fx);
      this._syncHud();
      if (done) this._endSubmarine();
      return;
    }

    // Built-in fallback ride
    const s = this.sub;
    const inp = this.input.state;
    const w = this.renderer.width;
    const h = this.renderer.height;
    s.timer += dt;
    if (s.timer >= s.duration) {
      this._endSubmarine();
      return;
    }
    const speed = 190;
    if (inp.left) s.x -= speed * dt;
    if (inp.right) s.x += speed * dt;
    if (inp.up) s.y -= speed * dt;
    if (inp.down) s.y += speed * dt;
    s.x = Math.max(36, Math.min(w - 40, s.x));
    s.y = Math.max(54, Math.min(h - 52, s.y));
    if (s.fireCooldown > 0) s.fireCooldown -= dt;
    if ((this.input.consumeJustPressed('fire') || this.input.consumeJustPressed('jump')) && s.fireCooldown <= 0) {
      s.fireCooldown = 0.24;
      s.bubbles.push({ x: s.x + 26, y: s.y, vx: 260 });
      sound.bubble();
    }
    s.spawnTimer -= dt;
    if (s.spawnTimer <= 0) {
      s.spawnTimer = 0.7 + Math.random() * 0.7;
      const colors = ['#fbbf24', '#f472b6', '#4ade80', '#38bdf8'];
      s.fish.push({ x: w + 30, y: 65 + Math.random() * (h - 130), vx: -(75 + Math.random() * 65), color: colors[Math.floor(Math.random() * colors.length)], bubbled: false });
    }
    for (let i = s.bubbles.length - 1; i >= 0; i--) {
      const b = s.bubbles[i];
      b.x += b.vx * dt;
      if (b.x > w + 20) {
        s.bubbles.splice(i, 1);
        continue;
      }
      for (const f of s.fish) {
        if (!f.bubbled && Math.hypot(b.x - f.x, b.y - f.y) < 22) {
          f.bubbled = true;
          f.vx *= 0.35;
          s.bubbles.splice(i, 1);
          sound.stunEnemy();
          break;
        }
      }
    }
    for (let i = s.fish.length - 1; i >= 0; i--) {
      const f = s.fish[i];
      f.x += f.vx * dt;
      if (f.bubbled) {
        f.y -= 18 * dt;
        if (Math.hypot(s.x - f.x, s.y - f.y) < 32) {
          this._scoreComboHit(250, { x: f.x, y: f.y - 12 }, '#4ade80');
          sound.catchFish();
          this._spawnParticles(f.x, f.y, '#a5f3fc', 10, 90);
          s.fish.splice(i, 1);
          continue;
        }
      }
      if (f.x < -40 || f.y < 30) s.fish.splice(i, 1);
    }
  }

  render() {
    const inSub = this.mode === 'submarine' || (this.mode === 'paused' && this.pausedFrom === 'submarine');
    if (inSub) {
      if (this.subStage && this.renderer.renderSubStage) this.renderer.renderSubStage(this);
      else this.renderer.renderSubmarineScene(this);
    } else if (this.tower) {
      this.renderer.renderTowerScene(this);
    }
  }
}

function safeGet(k) {
  try {
    return localStorage.getItem(k);
  } catch (_) {
    return null;
  }
}

function safeSet(k, v) {
  try {
    localStorage.setItem(k, v);
  } catch (_) {}
}
