import {
  COLS,
  getDailySeed,
  createTowers,
  generateProceduralTower,
  createDailyTower,
} from './levels.js';
import { sound } from './audio.js';
import { progression } from './progression.js';
import { GlideStage } from './glideStage.js';
import { PUZZLE_TYPES, makePuzzle, PuzzleRoom } from './puzzleRoom.js';

function wrapCol(c) {
  return ((c % COLS) + COLS) % COLS;
}

function colDist(a, b) {
  let d = wrapCol(b) - wrapCol(a);
  if (d > COLS / 2) d -= COLS;
  if (d < -COLS / 2) d += COLS;
  return d;
}

function wrapAngleRad(a) {
  let r = a % (Math.PI * 2);
  if (r > Math.PI) r -= Math.PI * 2;
  if (r < -Math.PI) r += Math.PI * 2;
  return r;
}

function approach(cur, target, maxDelta) {
  if (cur < target) return Math.min(target, cur + maxDelta);
  if (cur > target) return Math.max(target, cur - maxDelta);
  return target;
}

// --- Sourced 1987 Atari 7800 / Hewson Port Constants (docs/ORIGIN_CLASSIC_AUDIT.md) ---
const PORT_TICK = 1 / 32;
const POGO_VIS_H_ORIGINAL = 1.95;
const SLAB_ROWS_ORIGINAL = 0.65;
const ORIG_WALK_SPEED = 2.0;
const ORIG_SHOT_SPEED = 4.0;
const ORIG_SHOT_LIFE = 0.75; // 3.0 cols horizontal range, +1.0 row rise
const ORIG_FALL_G = 32.0;
const ORIG_MAX_FALL = 16.0;

const ARC_JUMP = [3, 3, 2, 2, 2, 2, 1, 1, 1, 1, 0, 0, 0, 0, -1, -1, -1, -1, -2, -2, -2, -2, -3, -3];
const ARC_CLIMB = [2, 2, 2, 2, 1, 1, 0, 0, -1, -1, -2, -2, -2, -2];
const ARC_TUMBLE = [
  3, 3, 2, 2, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0,
  -1, -1, -2, -2, -2, -2, -3, -3, -3, -3, -3, -3, -3, -3, -3, -3, -4, -4,
];

function arcRows(table, tk) {
  let h = 0;
  const whole = Math.floor(tk);
  for (let i = 0; i < whole; i++) h += table[Math.min(i, table.length - 1)];
  h += table[Math.min(whole, table.length - 1)] * (tk - whole);
  return h / 8;
}

function makeArc(kind, y0, vx, ticks, table) {
  return {
    kind,
    t: 0,
    y0,
    vx,
    ticks,
    table,
    done: false,
    endVy: table[table.length - 1] * 4,
  };
}

const MOLECULE_PERIOD = 600 * PORT_TICK; // 18.75s between screen-space molecules
const MOLECULE_SLOW = 128 * PORT_TICK;   // 4.0s slow drift
const MOLECULE_LIFE = 202 * PORT_TICK;   // 6.3125s total crossing
const MOLECULE_SPAN = 5.5;               // ~11 columns span
const MAX_REAL_ENEMIES = 4;

const PORT_POGO_MASK = [24, 24, 60, 60, 126, 126, 126, ...Array(16).fill(255), 126, 126, 126, 60, 60, 24];

function portTouch(pCol, pFloor, eCol, eFloor) {
  const dy = Math.round((eFloor - pFloor) * 8) + 15;
  if (dy < 0 || dy >= PORT_POGO_MASK.length) return false;
  let dx = Math.floor(pCol * 8) - Math.floor(eCol * 8);
  dx = (((dx + 64) % 128) + 128) % 128 - 64 + 3;
  return dx >= 0 && dx < 9 && ((PORT_POGO_MASK[dy] >> dx) & 1) === 1;
}

export class TowerTopplerGame {
  constructor(renderer, input, callbacks = {}, progressionMgr = progression) {
    this.renderer = renderer;
    this.input = input;
    this.cb = callbacks || {};
    this.prog = progressionMgr || progression;

    const saved = this.prog?.getSettings?.() || {};
    this.era = saved.era === 'original' ? 'original' : 'reboot';
    this.zenMode = Boolean(saved.zenMode);
    this.skinId = saved.skinId || this.prog?.getEquippedSkin?.() || 'default_amphibian';
    this.blasterFxId = saved.blasterFxId || this.prog?.getEquippedBlasterFx?.() || 'standard_cryo';

    // GameMode: 'title' | 'tower' | 'topple' | 'submarine' | 'skimmer' | 'glide' | 'puzzle' | 'vault' | 'paused' | 'gameover' | 'victory'
    this.mode = 'title';
    this.pausedFrom = null;
    this.runType = this.era === 'original' ? 'original_campaign' : 'reboot_campaign';
    this.standaloneMiniGame = false;

    this.towers = createTowers(this.era);
    this.towerIndex = 0;
    this.tower = null;

    this.score = 0;
    this.nextExtraLife = 5000;
    this.hiScore = this.prog?.getHighScore?.(this._scoreBucket()) || 0;
    this.lives = 3;
    this.time = 0;
    this.timer = 95;
    this.timeLimit = 95;
    this.zenElapsed = 0;

    this.shake = 0;
    this.comboCount = 0;
    this.comboTimer = 0;
    this.maxComboHere = 0;

    // Campaign / Run progression state
    this.towersClearedInRun = 0;
    this.runStartedFromTower1 = false;
    this.runDeathsTotal = 0;
    this.runHurtTotal = 0;
    this.sectorFlawlessPending = false;
    this.runStarsEarned = 0;
    this.runGearsStart = this.prog?.getGears?.() || 0;
    this.lastClearStars = null;
    this.nextTowerTimeBonus = 0;
    this.nextTowerShield = false;
    this.nextTowerWarpFloors = 0;
    this.endlessDepth = 0;
    this.endlessSeed = Date.now() >>> 0;
    this._lastCasualMini = null;
    this.dailyMeta = null;
    this.vaultReturnState = null;

    // Per-tower telemetry
    this.towerHurtCount = 0;
    this.towerShotsFired = 0;
    this.towerDeathsHere = 0;
    this.towerEnemiesDestroyed = 0;
    this.towerEnemiesStunned = 0;
    this.towerSwitchesUsed = 0;
    this.towerDoorsUsed = 0;
    this.towerSteamLaunches = 0;
    this.towerRelicCollected = false;
    this.towerTouchedWater = false;
    this.towerVaultCleared = false;
    this.vaultCrackedThisTower = false;
    this.towerStarCollected = false;
    this.maxFloorReached = 0;
    this.visitedElevators = new Set();
    this.stallFloor = 0;
    this.stallTimer = 0;

    // Casual Expedition station & objective state (#112)
    this.workbench = null;
    this.treasureChest = null;
    this.salvagePartsCollected = 0;
    this.salvagePartsTotal = 0;
    this.dynamoCrafted = false;
    this.compassKeysCollected = 0;
    this.compassKeysTotal = 0;
    this.treasureChestOpened = false;
    this.curiosCollectedHere = 0;
    this.curiosTotalHere = 0;
    this._stationHintCooldown = 0;
    this._casualSkipConfirmTimer = 0;

    // 1987 Real-Tower spawner & extras state
    this.spawnPoints = null;
    this.moleculeTimer = MOLECULE_PERIOD;
    this.moleculeDir = 1;
    this.extras = 0;
    this.blocksShot = 0;

    // Rune Chamber & Sky-Glide instances
    this.puzzleData = null;
    this.puzzleDoor = null;
    this.puzzleRoom = null;
    this._standalonePuzzleIdx = -1;
    this.glideStage = null;
    this.glideGoldenOrChain4 = false;

    // Live environmental state (RenderState §2.3)
    this.waterFloor = -0.55;
    this.waterSurgeDelay = 0;
    this.windCurrent = 0;
    this.blackoutFactor = 0;
    this.lightningFlash = 0;
    this._lightningTimer = 0;
    this.switchStates = { red: false, cyan: false, conv: false };
    this.wardrobeSpotlight = false;
    this.cutsceneCam = null;

    this.camCol = 0;
    this.camFloor = 2;

    this.player = this._createDefaultPlayer(0.5, 0);

    this.ledges = [];
    this.elevators = [];
    this.switches = [];
    this.collectibles = [];
    this.enemies = [];
    this.snowballs = [];
    this.particles = [];
    this.popups = [];

    this.topple = {
      active: false,
      progress: 0,
      duration: 2.6,
    };

    this.sub = {
      x: 120,
      y: 220,
      vx: 0,
      vy: 0,
      timer: 0,
      duration: 18,
      sonarPulse: 0,
      sonarCooldown: 0,
      sonarOriginX: 120,
      sonarOriginY: 220,
      ventBoostTimer: 0,
      warpCave: { x: 900, y: 95, active: true, entered: false },
      vents: [],
      hiddenCaches: [],
      shockwaves: [],
      bubbles: [],
      fish: [],
      mines: [],
      spawnTimer: 0.4,
      mineTimer: 2.0,
      ventTimer: 3.4,
      fireCooldown: 0,
      fishCaughtCount: 0,
      minesDestroyed: 0,
    };

    this.skimmer = {
      laneX: 0,
      vx: 0,
      y: 0,
      vy: 0,
      onWater: true,
      speed: 18,
      boostMult: 1,
      boostTimer: 0,
      distance: 0,
      timer: 0,
      duration: 18,
      gates: [],
      ramps: [],
      hazards: [],
      gears: [],
      bolts: [],
      fireCooldown: 0,
      spawnCursor: 0,
    };

    this.vault = {
      activeRing: 0,
      strikes: 0,
      maxStrikes: 3,
      timer: 12.0,
      duration: 12.0,
      status: 'playing',
      statusTimer: 0,
      rings: this._createVaultRings(),
    };
  }

  _createDefaultPlayer(col = 0.5, floor = 0) {
    return {
      col,
      floor,
      vx: 0,
      vy: 0,
      facing: 1,
      onGround: true,
      onElevator: null,
      invuln: 0,
      shield: false,
      hidden: false,
      enteringDoor: 0,
      doorPhase: null, // null | 'enter' | 'transit' | 'exit'
      tunnelTimer: 0,
      tunnelTarget: null,
      safeCol: col,
      safeFloor: floor,
      fireCooldown: 0,
      fireBuffer: 0,
      muzzleFlash: 0,
      squashX: 1,
      squashY: 1,
      landImpact: 0,
      hurtTimer: 0,
      landingFloor: floor,
      skinId: this.skinId || 'default_amphibian',
      blasterFxId: this.blasterFxId || this.prog?.getEquippedBlasterFx?.() || 'standard_cryo',
      coyoteTimer: 0,
      jumpBufferTimer: 0,
      jumpCutEligible: false,
      stepHopActive: false,
      jumpStartCol: col,
      jumpStartFloor: floor,
      knockbackTimer: 0,
      stepUpCooldown: 0,
      arc: null,
      tumbling: false,
      dropThrough: null,
      origHintCooldown: 0,
    };
  }

  _createVaultRings() {
    return [
      { angle: Math.random() * Math.PI * 2, speed: 1.65, targetAngle: 0, tolerance: 0.38, locked: false },
      { angle: Math.random() * Math.PI * 2, speed: -2.35, targetAngle: 0, tolerance: 0.35, locked: false },
      { angle: Math.random() * Math.PI * 2, speed: 3.10, targetAngle: 0, tolerance: 0.32, locked: false },
    ];
  }

  _scoreBucket() {
    if (this.runType === 'endless_casual') return 'casual';
    if (this.runType === 'endless') return 'endless';
    if (this.runType === 'daily') return 'daily';
    return this.era === 'original' ? 'original' : 'reboot';
  }

  _isRealOriginal() {
    return this.era === 'original' && Boolean(this.tower?.real);
  }

  // --- Public API (§3.7) ---

  applySettings(settings = {}) {
    if (!settings || typeof settings !== 'object') return;
    this.prog?.updateSettings?.(settings);

    let eraChanged = false;
    if (settings.era === 'reboot' || settings.era === 'original') {
      if (this.era !== settings.era) {
        this.era = settings.era;
        eraChanged = true;
      }
      this.renderer?.setEra?.(this.era);
      sound?.setEra?.(this.era);
    }

    if (settings.zenMode !== undefined) {
      this.zenMode = Boolean(settings.zenMode);
      sound?.setZenMode?.(this.zenMode);
    }

    if (settings.skinId) {
      this.skinId = settings.skinId;
      if (this.player) this.player.skinId = this.skinId;
      this.renderer?.setSkin?.(this.skinId);
    }

    const nextBlasterFx = settings.blasterFxId || this.prog?.getEquippedBlasterFx?.();
    if (nextBlasterFx) {
      this.blasterFxId = nextBlasterFx;
      if (this.player) this.player.blasterFxId = nextBlasterFx;
      this.renderer?.setBlasterFx?.(nextBlasterFx);
    }

    if (settings.controlMode) {
      this.input?.setControlMode?.(settings.controlMode);
    }
    if (settings.hapticsEnabled !== undefined) {
      this.input?.setHapticsEnabled?.(Boolean(settings.hapticsEnabled));
    }
    if (settings.tiltSensitivity !== undefined) {
      this.input?.setTiltSensitivity?.(Number(settings.tiltSensitivity) || 1.0);
    }
    if (settings.muted !== undefined) {
      sound?.setMuted?.(Boolean(settings.muted));
    }
    if (settings.musicEnabled !== undefined) {
      sound?.setMusicEnabled?.(Boolean(settings.musicEnabled));
    }

    this._emitProgEvent('settings_change', {
      era: this.era,
      controlMode: settings.controlMode || this.input?.controlMode,
      zenMode: this.zenMode,
      skinId: this.skinId,
      blasterFxId: this.blasterFxId,
    });

    if (eraChanged && this.mode === 'title') {
      this.towers = createTowers(this.era);
      this.runType = this.era === 'original' ? 'original_campaign' : 'reboot_campaign';
      this.loadTower(0);
    }

    this.hiScore = this.prog?.getHighScore?.(this._scoreBucket()) || 0;
    this._syncHud();
  }

  startCampaign({ era = this.era, startTowerIdx = 0, zenMode = this.zenMode } = {}) {
    this.era = era === 'original' ? 'original' : 'reboot';
    this.zenMode = Boolean(zenMode);
    this.runType = this.era === 'original' ? 'original_campaign' : 'reboot_campaign';
    this.standaloneMiniGame = false;
    this.dailyMeta = null;
    this.vaultReturnState = null;

    this.skinId = this.prog?.getEquippedSkin?.() || this.skinId || 'default_amphibian';
    this.blasterFxId = this.prog?.getEquippedBlasterFx?.() || this.blasterFxId || 'standard_cryo';

    this.renderer?.setEra?.(this.era);
    this.renderer?.setSkin?.(this.skinId);
    this.renderer?.setBlasterFx?.(this.blasterFxId);
    sound?.setEra?.(this.era);
    sound?.setZenMode?.(this.zenMode);
    sound?.setMiniGameMode?.(null);
    sound?.setWind?.(0);
    sound?.setMusicActive?.(true);

    this.towers = createTowers(this.era);
    this.towerIndex = Math.max(0, Math.min(this.towers.length - 1, Number(startTowerIdx) || 0));

    this._resetRunStats();
    this.runStartedFromTower1 = this.towerIndex === 0;
    this.mode = 'tower';
    this.loadTower(this.towerIndex);
  }

  startNewGame(startTowerIdx = 0) {
    this.startCampaign({ era: this.era, startTowerIdx, zenMode: this.zenMode });
  }

  startEndlessMode({ era = 'reboot', seed = Date.now() } = {}) {
    this.era = era === 'original' ? 'original' : 'reboot';
    this.runType = 'endless';
    this.standaloneMiniGame = false;
    this.dailyMeta = null;
    this.vaultReturnState = null;
    this.endlessDepth = 0;
    this.endlessSeed = (Number(seed) || Date.now()) >>> 0;

    this.skinId = this.prog?.getEquippedSkin?.() || this.skinId || 'default_amphibian';
    this.blasterFxId = this.prog?.getEquippedBlasterFx?.() || this.blasterFxId || 'standard_cryo';

    this.renderer?.setEra?.(this.era);
    this.renderer?.setSkin?.(this.skinId);
    this.renderer?.setBlasterFx?.(this.blasterFxId);
    sound?.setEra?.(this.era);
    sound?.setZenMode?.(this.zenMode);
    sound?.setMiniGameMode?.(null);
    sound?.setWind?.(0);
    sound?.setMusicActive?.(true);

    this._resetRunStats();
    this.mode = 'tower';
    const firstTower = generateProceduralTower({
      seed: (this.endlessSeed + 101) >>> 0,
      index: 1,
      difficulty: 1,
      era: this.era,
    });
    this.loadTower(firstTower);
  }

  startCasualEndlessMode({ seed = Date.now() } = {}) {
    this.era = 'reboot';
    this.zenMode = true;
    this.runType = 'endless_casual';
    this.standaloneMiniGame = false;
    this.dailyMeta = null;
    this.vaultReturnState = null;
    this.endlessDepth = 0;
    this._lastCasualMini = null;
    this.endlessSeed = (Number(seed) || Date.now()) >>> 0;

    this.skinId = this.prog?.getEquippedSkin?.() || this.skinId || 'default_amphibian';
    this.blasterFxId = this.prog?.getEquippedBlasterFx?.() || this.blasterFxId || 'standard_cryo';

    this.renderer?.setEra?.('reboot');
    this.renderer?.setSkin?.(this.skinId);
    this.renderer?.setBlasterFx?.(this.blasterFxId);
    sound?.setEra?.('reboot');
    sound?.setZenMode?.(true);
    sound?.setMiniGameMode?.(null);
    sound?.setWind?.(0);
    sound?.setMusicActive?.(true);

    this._resetRunStats();
    this.mode = 'tower';
    const firstTower = generateProceduralTower({
      seed: (this.endlessSeed + 307) >>> 0,
      index: 1,
      difficulty: 1,
      era: 'reboot',
      casual: true,
    });
    this.loadTower(firstTower);
  }

  startDailyChallenge(date = new Date()) {
    const { seed, dateKey } = getDailySeed(date);
    this.era = 'reboot';
    this.zenMode = false;
    this.runType = 'daily';
    this.standaloneMiniGame = false;
    this.vaultReturnState = null;
    this.dailyMeta = { seed, dateKey, elapsedSec: 0 };

    this.skinId = this.prog?.getEquippedSkin?.() || this.skinId || 'default_amphibian';
    this.blasterFxId = this.prog?.getEquippedBlasterFx?.() || this.blasterFxId || 'standard_cryo';

    this.renderer?.setEra?.('reboot');
    this.renderer?.setSkin?.(this.skinId);
    this.renderer?.setBlasterFx?.(this.blasterFxId);
    sound?.setEra?.('reboot');
    sound?.setZenMode?.(false);
    sound?.setMiniGameMode?.(null);
    sound?.setWind?.(0);
    sound?.setMusicActive?.(true);

    this._resetRunStats();
    this.mode = 'tower';
    const dailyTower = createDailyTower(date);
    this.loadTower(dailyTower);
    this._tryUnlockTrophy('daily_try');
  }

  startMiniGame(type = 'submarine', standalone = true) {
    this.standaloneMiniGame = Boolean(standalone);
    if (this.standaloneMiniGame) {
      this.runType = 'minigame';
      this._resetRunStats();
      this.vaultReturnState = null;
      this.puzzleDoor = null;
      sound?.setEra?.(this.era);
      sound?.setMusicActive?.(true);
    }

    sound?.setWind?.(0);
    this.particles = [];
    this.popups = [];
    this.shake = 0;
    this.comboCount = 0;
    this.comboTimer = 0;
    this.input?.resetState?.();

    if (type === 'skimmer') {
      this._initSkimmerStage();
    } else if (type === 'glide') {
      this._initGlideStage();
    } else if (type === 'puzzle') {
      this._initPuzzleStage(null);
    } else if (type === 'vault') {
      this._initVaultStage();
    } else {
      this._initSubmarineStage();
    }
  }

  _resetRunStats() {
    this.score = 0;
    this.nextExtraLife = 5000;
    this.lives = 3;
    this.towersClearedInRun = 0;
    this.runStartedFromTower1 = false;
    this.runDeathsTotal = 0;
    this.runHurtTotal = 0;
    this.sectorFlawlessPending = false;
    this.runStarsEarned = 0;
    this.runGearsStart = this.prog?.getGears?.() || 0;
    this.lastClearStars = null;
    this.nextTowerTimeBonus = 0;
    this.nextTowerShield = false;
    this.nextTowerWarpFloors = 0;
    this.glideStage = null;
    this.puzzleRoom = null;
    this.puzzleDoor = null;
    this.blasterFxId = this.prog?.getEquippedBlasterFx?.() || this.blasterFxId || 'standard_cryo';
    this.hiScore = this.prog?.getHighScore?.(this._scoreBucket()) || 0;
    this.input?.resetState?.();
  }

  loadTower(idxOrTower) {
    let rawT = null;
    if (typeof idxOrTower === 'number') {
      if (!this.towers || this.towers.length === 0) {
        this.towers = createTowers(this.era);
      }
      const clampedIdx = Math.max(0, Math.min(this.towers.length - 1, idxOrTower));
      this.towerIndex = clampedIdx;
      rawT = this.towers[clampedIdx];
    } else if (idxOrTower && typeof idxOrTower === 'object') {
      rawT = idxOrTower;
    }

    if (!rawT) return;

    // Clone top-level tower & doors so per-run solved/clue state never mutates static blueprints
    const clonedDoors = (rawT.doors || []).map((d) => ({
      ...d,
      isRune: Boolean(d.isRune || d.rune),
      solved: false,
    }));

    const isCasualTower = Boolean(rawT.casual || this.runType === 'endless_casual');
    const t = {
      ...rawT,
      casual: isCasualTower,
      doors: clonedDoors,
      clue: rawT.clue ? { ...rawT.clue } : null,
      workbench: rawT.workbench
        ? { ...rawT.workbench, crafted: Boolean(rawT.workbench.crafted) }
        : null,
      treasureChest: rawT.treasureChest
        ? { ...rawT.treasureChest, opened: Boolean(rawT.treasureChest.opened) }
        : null,
    };

    this.workbench = t.workbench;
    this.treasureChest = t.treasureChest;

    // Build Rune Chamber puzzle & attach exterior architectural clue 4–6 floors away (§3.2.5)
    this.puzzleData = null;
    this.puzzleDoor = null;
    this.puzzleRoom = null;
    this.glideStage = null;

    const runeDoor = t.doors.find((d) => d.isRune);
    if (runeDoor && this.era !== 'original') {
      const pType =
        runeDoor.puzzleType ||
        PUZZLE_TYPES[((t.id || 1) - 1) % PUZZLE_TYPES.length] ||
        'lights';
      const pSeed = runeDoor.puzzleSeed || ((t.id || 1) * 7919 + 17);
      this.puzzleData = makePuzzle({
        type: pType,
        seed: pSeed,
        difficulty: Math.min(0.85, 0.25 + ((t.id || 1) - 1) * 0.08),
        hideTarget: pType === 'lights',
      });
      if (this.puzzleData && this.puzzleData.clue) {
        const exitDoor = t.doors.find((d) => d.isExit);
        const exitF = exitDoor ? exitDoor.floor : Math.max(6, (t.floors || 18) - 2);
        const offsetFloors = 5;
        const goUp = runeDoor.floor + offsetFloors < exitF - 1;
        const clueFloor = goUp ? runeDoor.floor + offsetFloors : Math.max(2, runeDoor.floor - offsetFloors);
        let clueCol = wrapCol(runeDoor.col + 6);
        for (let dc = 0; dc < COLS; dc++) {
          const candCol = wrapCol(clueCol + dc);
          const doorClash = t.doors.some((d) => wrapCol(d.col) === candCol && Math.abs(d.floor - clueFloor) <= 2);
          const elClash = (t.elevators || []).some(
            (e) => wrapCol(e.col) === candCol && clueFloor >= e.minFloor - 1 && clueFloor <= e.maxFloor + 1
          );
          if (!doorClash && !elClash) {
            clueCol = candCol;
            break;
          }
        }
        t.clue = {
          ...this.puzzleData.clue,
          col: clueCol,
          floor: clueFloor,
        };
      }
    }

    this.tower = t;

    const bonusSec = this.nextTowerTimeBonus || 0;
    this.nextTowerTimeBonus = 0;
    this.timeLimit = (t.timeLimit || 95) + bonusSec;
    this.timer = this.timeLimit;
    this.zenElapsed = 0;

    this.particles = [];
    this.popups = [];
    this.snowballs = [];
    this.shake = 0;
    this.comboCount = 0;
    this.comboTimer = 0;
    this.maxComboHere = 0;
    this.topple = { active: false, progress: 0, duration: 2.6 };

    // Per-tower run telemetry
    this.towerHurtCount = 0;
    this.towerShotsFired = 0;
    this.towerDeathsHere = 0;
    this.towerEnemiesDestroyed = 0;
    this.towerEnemiesStunned = 0;
    this.towerSwitchesUsed = 0;
    this.towerDoorsUsed = 0;
    this.towerSteamLaunches = 0;
    this.towerRelicCollected = false;
    this.towerTouchedWater = false;
    this.towerVaultCleared = false;
    this.vaultCrackedThisTower = false;
    this.towerStarCollected = false;
    this.visitedElevators = new Set();
    this.extras = 0;
    this.blocksShot = 0;
    this.moleculeTimer = MOLECULE_PERIOD;
    this.moleculeDir = 1;
    this._stationHintCooldown = 0;
    this._casualSkipConfirmTimer = 0;

    // Environmental state
    const mech = t.mechanics || {};
    const hasSurge = !isCasualTower && (mech.waterRiseRate || 0) > 0;
    this.waterFloor = (mech.waterBaseFloor ?? -0.55) - (hasSurge ? 0.45 : 0);
    this.waterSurgeDelay = hasSurge ? 3.4 : 0;
    this.windCurrent = 0;
    this.blackoutFactor = 0;
    this.lightningFlash = 0;
    this._lightningTimer = mech.lightningInterval > 0 ? mech.lightningInterval * 0.65 : 0;
    this.switchStates = { red: false, cyan: false, conv: false };

    // Clone mutable ledges
    this.ledges = (t.ledges || []).map((l) => ({
      ...l,
      origType: l.type || 'solid',
      type: l.type || 'solid',
      switchGroup: l.switchGroup || null,
      inverted: Boolean(l.inverted),
      phasePeriod: l.phasePeriod || 3.2,
      phaseOffset: l.phaseOffset || 0,
      crumbling: false,
      crumbleTimer: 0,
      shake: false,
      gone: false,
      respawnTimer: 0,
      active: true,
      pistonExt: 1,
      steamActive: false,
      steamWarn: false,
    }));

    this.elevators = (t.elevators || []).map((e) => ({
      ...e,
      startFloor: e.startFloor ?? e.minFloor ?? 0,
      floor: e.startFloor ?? e.minFloor ?? 0,
      dir: 1,
      autoDir: 0,
      idleT: 0,
      dwellTimer: 0,
      boarded: false,
      recallTarget: null,
    }));

    this.switches = (t.switches || []).map((s) => ({
      ...s,
      active: false,
      cooldown: 0,
      _playerInside: false,
    }));

    const ownedRelics = this.prog?.getCollectedRelics?.() || [];
    this.collectibles = (t.collectibles || []).map((c) => ({
      ...c,
      collected: false,
      alreadyOwned: c.type === 'relic' ? ownedRelics.includes(c.relicId || c.id) : false,
    }));

    // Casual Expedition objective counters (#112)
    const missionType = this._getCasualMissionType(t);
    this.salvagePartsCollected = 0;
    this.salvagePartsTotal =
      this.collectibles.filter((c) => c.type === 'salvage_part').length ||
      (missionType === 'tower_repair' ? 3 : 0);
    this.dynamoCrafted = Boolean(t.workbench?.crafted);
    this.compassKeysCollected = 0;
    this.compassKeysTotal =
      this.collectibles.filter((c) => c.type === 'compass_key').length ||
      (missionType === 'treasure_hunt' ? 3 : 0);
    this.treasureChestOpened = Boolean(t.treasureChest?.opened);
    this.curiosCollectedHere = 0;
    this.curiosTotalHere =
      this.collectibles.filter((c) => c.type === 'curio').length ||
      (missionType === 'curio_survey' ? 4 : 0);

    // 1987 Real-Tower 4-enemy window spawner vs Reboot active roster (ZERO enemies on Casual Expeditions!)
    if (isCasualTower) {
      this.spawnPoints = null;
      this.enemies = [];
    } else if (this._isRealOriginal()) {
      this.spawnPoints = (t.enemies || []).map((e, idx) => ({
        ...e,
        spawnKey: e.spawnKey || `${e.col},${e.floor},${idx}`,
        state: 'idle',
      }));
      this.enemies = [];
    } else {
      this.spawnPoints = null;
      this.enemies = (t.enemies || []).map((e, idx) => this._instantiateEnemy(e, idx));
    }

    this._syncDynamicLedges(0, true);

    // Determine spawn point (including optional +2 floor Sub Warp Cave boost in Reboot!)
    let spawnCol = (t.spawn?.col ?? 0) + 0.5;
    let spawnFloor = t.spawn?.floor ?? 0;
    if (this.nextTowerWarpFloors > 0 && !this._isRealOriginal()) {
      const targetF = spawnFloor + this.nextTowerWarpFloors;
      const warpLedge = this.ledges.find(
        (l) => !l.gone && l.active && (l.type === 'solid' || l.type === 'ice') && Math.abs(l.floor - targetF) <= 1
      );
      if (warpLedge) {
        spawnCol = warpLedge.col + 0.5;
        spawnFloor = warpLedge.floor;
      }
    }
    this.nextTowerWarpFloors = 0;

    const grantShield = Boolean(this.nextTowerShield) && !this._isRealOriginal();
    this.nextTowerShield = false;

    if (this.mode !== 'title') {
      this.skinId = this.prog?.getEquippedSkin?.() || this.skinId || 'default_amphibian';
      this.blasterFxId = this.prog?.getEquippedBlasterFx?.() || this.blasterFxId || 'standard_cryo';
      this.renderer?.setSkin?.(this.skinId);
      this.renderer?.setBlasterFx?.(this.blasterFxId);
    }

    this.player = this._createDefaultPlayer(spawnCol, spawnFloor);
    this.player.invuln = this.mode === 'title' ? 0 : 2.0;
    this.player.shield = grantShield;
    this.player.landingFloor = this._computeLandingFloor(this.player.col, this.player.floor);

    if (this.spawnPoints) {
      this._updateRealSpawnPoints();
    }

    this.maxFloorReached = Math.floor(spawnFloor);
    this.stallFloor = spawnFloor;
    this.stallTimer = 0;

    this.camCol = this.player.col;
    this.camFloor = Math.max(2, this.player.floor + (this._isRealOriginal() ? 2.2 : 1.5));

    sound?.setWind?.(0);
    sound?.setMiniGameMode?.(null);
    sound?.setTowerTheme?.(t.id || 1, t.theme || (this.era === 'original' ? 'classic' : 'mist'));

    if (this.mode !== 'title') {
      this._emitProgEvent('tower_start', {
        era: this.era,
        runType: this.runType,
        zenMode: this.zenMode,
        controlMode: this.input?.controlMode,
        towerId: t.id || 1,
        theme: t.theme,
        casual: isCasualTower,
        missionType,
      });
      const sub =
        this.runType === 'daily'
          ? `DAILY CHALLENGE • ${this.dailyMeta?.dateKey || ''}`
          : this.runType === 'endless_casual'
          ? t.subtitle || `CASUAL EXPEDITION • SECTOR ${this.endlessDepth + 1}`
          : this.runType === 'endless'
          ? `ENDLESS ABYSS • SECTOR ${this.endlessDepth + 1}`
          : t.subtitle || `${this.era === 'original' ? 'CLASSIC • ' : ''}TOWER ${t.id}`;
      this.cb.onBanner?.(sub, t.name);
      if (bonusSec > 0) {
        this.addPopup({
          col: this.player.col,
          floor: this.player.floor + 1.2,
          text: `+${bonusSec}s SKIMMER BONUS!`,
          color: '#5efce8',
          maxLife: 1.35,
        });
      }
    }
    this._syncHud();
  }

  _instantiateEnemy(e, idx = 0) {
    const span = !e.kind && e.type === 'robotH' ? this._computeContiguousSpan(e.col, Math.round(e.floor)) : null;
    return {
      ...e,
      spawnCol: e.col,
      spawnFloor: e.floor,
      baseFloor: e.floor,
      speed: e.kspeed != null ? e.kspeed : e.speed ?? 1.8,
      kt: e.kt || 0,
      falling: false,
      fallVy: 0,
      phase: (idx * 1.43) % (Math.PI * 2),
      stunTimer: 0,
      dead: false,
      deathTimer: 0,
      edgePause: 0,
      spanStart: span ? span.startCol : null,
      spanLen: span ? span.length : null,
      spanOffset: span ? span.initialOffset : 0,
    };
  }

  _computeContiguousSpan(col, floor) {
    const hasTile = (c) =>
      this.ledges.some(
        (l) =>
          l.type !== 'box' &&
          l.type !== 'pillar' &&
          l.type !== 'laserGate' &&
          Math.abs(l.floor - floor) < 0.25 &&
          wrapCol(l.col) === wrapCol(c)
      );
    const startTile = Math.floor(wrapCol(col));
    if (!hasTile(startTile)) {
      return { startCol: startTile, length: 3, initialOffset: 1.5 };
    }
    let leftSteps = 0;
    while (leftSteps < COLS - 1 && hasTile(startTile - leftSteps - 1)) {
      leftSteps++;
    }
    let rightSteps = 0;
    while (rightSteps < COLS - 1 - leftSteps && hasTile(startTile + rightSteps + 1)) {
      rightSteps++;
    }
    const spanStart = wrapCol(startTile - leftSteps);
    const length = Math.max(1, leftSteps + 1 + rightSteps);
    const initialOffset = Math.max(0.35, Math.min(length - 0.35, leftSteps + (wrapCol(col) - startTile || 0.5)));
    return { startCol: spanStart, length, initialOffset };
  }

  togglePause() {
    if (
      this.mode === 'tower' ||
      this.mode === 'submarine' ||
      this.mode === 'skimmer' ||
      this.mode === 'glide' ||
      this.mode === 'puzzle' ||
      this.mode === 'vault'
    ) {
      this.pausedFrom = this.mode;
      this.mode = 'paused';
      this.input?.resetState?.();
      sound?.setWind?.(0);
      sound?.setMusicActive?.(false);
      this._syncHud();
      return true;
    }
    if (this.mode === 'paused') {
      this.mode = this.pausedFrom || 'tower';
      this.pausedFrom = null;
      this.input?.resetState?.();
      sound?.setMusicActive?.(true);
      this._syncHud();
      return false;
    }
    return false;
  }

  // --- Scoring, Trophies, Shake & Popups ---

  addScore(pts) {
    if (!pts || pts <= 0) return;
    this.score += Math.floor(pts);
    const bucket = this._scoreBucket();
    this.prog?.recordScore?.(bucket, this.score);
    const savedHi = this.prog?.getHighScore?.(bucket) || 0;
    if (this.score > this.hiScore || savedHi > this.hiScore) {
      this.hiScore = Math.max(this.score, savedHi);
    }

    while (this.score >= this.nextExtraLife) {
      this.nextExtraLife += 5000;
      if (!this.zenMode) {
        this._emitProgEvent('extra_life', { score: this.score, era: this.era });
        this._tryUnlockTrophy('classic_extra_life');
      }
      if (!this.zenMode && this.lives < 6) {
        this.lives = Math.min(6, this.lives + 1);
        sound?.extraLife?.();
        if (this.mode === 'submarine') {
          this.addPopup({ x: this.sub.x, y: this.sub.y - 26, text: 'EXTRA LIFE!', color: '#6bf2ff', maxLife: 1.35 });
        } else if (this.mode === 'tower') {
          this.addPopup({
            col: this.player.col,
            floor: this.player.floor + 1.15,
            text: 'EXTRA LIFE!',
            color: '#6bf2ff',
            maxLife: 1.35,
          });
        }
      }
    }
    this._syncHud();
  }

  _notifyUnlockedTrophy(tr) {
    if (!tr || typeof tr !== 'object' || !tr.id) return;
    if (typeof this.cb.onTrophy === 'function') {
      this.cb.onTrophy(tr);
    } else {
      sound?.trophyUnlock?.();
    }
  }

  _checkMillenniumCapstone() {
    const unlocked = this.prog?.getUnlockedTrophies?.();
    if (Array.isArray(unlocked) && unlocked.length >= 99 && !unlocked.includes('millennium_toppler')) {
      const cap = this.prog?.unlockTrophy?.('millennium_toppler');
      if (cap) this._notifyUnlockedTrophy(cap);
    }
  }

  _flushPendingProgTrophies() {
    const pending = this.prog?.drainPendingTrophies?.();
    if (Array.isArray(pending) && pending.length > 0) {
      for (const tr of pending) {
        this._notifyUnlockedTrophy(tr);
      }
    }
    this._checkMillenniumCapstone();
  }

  _handleProgTrophyReturn(res) {
    if (!res) {
      this._flushPendingProgTrophies();
      return;
    }
    if (Array.isArray(res)) {
      for (const tr of res) this._notifyUnlockedTrophy(tr);
    } else if (typeof res === 'object') {
      if (Array.isArray(res.newlyUnlockedTrophies)) {
        for (const tr of res.newlyUnlockedTrophies) this._notifyUnlockedTrophy(tr);
      } else if (Array.isArray(res.unlockedTrophies)) {
        for (const tr of res.unlockedTrophies) this._notifyUnlockedTrophy(tr);
      } else if (res.id && res.title) {
        this._notifyUnlockedTrophy(res);
      }
    }
    this._flushPendingProgTrophies();
  }

  _emitProgEvent(type, payload = {}) {
    const res = this.prog?.recordGameplayEvent?.(type, payload);
    this._handleProgTrophyReturn(res);
  }

  _tryUnlockTrophy(trophyId) {
    const unlocked = this.prog?.unlockTrophy?.(trophyId);
    if (unlocked) {
      this._notifyUnlockedTrophy(unlocked);
    }
    this._flushPendingProgTrophies();
  }

  _getBlasterTrailColors() {
    const fxId = this.player?.blasterFxId || this.blasterFxId || 'standard_cryo';
    const def = this.prog?.getBlasterFxDef?.(fxId);
    if (def && Array.isArray(def.trailColors) && def.trailColors.length > 0) {
      return def.trailColors;
    }
    switch (fxId) {
      case 'emerald_plasma':
        return ['#6ee7b7', '#34d399'];
      case 'solar_ember':
        return ['#fde68a', '#f97316'];
      case 'amethyst_void':
        return ['#f0abfc', '#a855f7'];
      case 'retro_voxel':
        return ['#fde047', '#38bdf8'];
      case 'diamond_prism':
        return ['#5efce8', '#f472b6', '#fde047'];
      default:
        return ['#e0f2fe', '#67e8f9'];
    }
  }

  _getCasualMissionType(towerObj = this.tower) {
    const raw = towerObj?.casualMission;
    if (!raw) return null;
    if (typeof raw === 'string') return raw;
    if (typeof raw === 'object' && typeof raw.type === 'string') return raw.type;
    return null;
  }

  _buildMissionStatus() {
    const activeMode = this.mode === 'paused' ? this.pausedFrom || 'tower' : this.mode;
    if (activeMode !== 'tower' || !this.tower) return null;
    const mType = this._getCasualMissionType(this.tower);
    if (!mType) return null;

    if (mType === 'tower_repair') {
      if (this.dynamoCrafted || this.tower.workbench?.crafted) {
        return 'DYNAMO READY -> FIX SUMMIT';
      }
      const req = Math.max(1, this.salvagePartsTotal || 3);
      if (this.salvagePartsCollected >= req) {
        return `PARTS ${this.salvagePartsCollected}/${req} -> CRAFT AT WORKBENCH`;
      }
      return `PARTS ${this.salvagePartsCollected}/${req} -> WORKBENCH`;
    }
    if (mType === 'treasure_hunt') {
      if (this.treasureChestOpened || this.tower.treasureChest?.opened) {
        return 'TREASURE CLAIMED -> SUMMIT';
      }
      const req = Math.max(1, this.compassKeysTotal || 3);
      if (this.compassKeysCollected >= req) {
        return `KEYS ${this.compassKeysCollected}/${req} -> OPEN CHEST`;
      }
      return `KEYS ${this.compassKeysCollected}/${req} -> CHEST`;
    }
    if (mType === 'curio_survey') {
      const req = Math.max(1, this.curiosTotalHere || 4);
      if (this.curiosCollectedHere >= req) {
        return `CURIOS ${this.curiosCollectedHere}/${req} -> SUMMIT`;
      }
      return `CURIOS ${this.curiosCollectedHere}/${req}`;
    }
    if (mType === 'puzzle_architect') {
      if (this.towerVaultCleared || this.vaultCrackedThisTower) {
        return 'CHAMBER SOLVED -> SUMMIT';
      }
      return 'PUZZLE SPIRE -> SOLVE RUNE CHAMBER';
    }
    return null;
  }

  _scoreActionHit(basePts, popupPos, baseColor) {
    if (this.era === 'original') {
      this.addScore(basePts);
      this.addPopup({ ...popupPos, text: `+${basePts}`, color: baseColor });
      return;
    }
    this.comboCount = Math.min(4, (this.comboCount || 0) + 1);
    this.comboTimer = 3.2;
    this.maxComboHere = Math.max(this.maxComboHere || 0, this.comboCount);
    const mult = this.comboCount;
    const pts = basePts * mult;
    this.addScore(pts);
    const label = mult > 1 ? `+${pts} (${mult}x!)` : `+${pts}`;
    this.addPopup({
      ...popupPos,
      text: label,
      color: mult > 1 ? '#f472b6' : baseColor,
    });
    if (this.mode === 'tower') {
      if (mult >= 2) this._tryUnlockTrophy('combo_2x');
      if (mult >= 3) this._tryUnlockTrophy('combo_3x');
      if (mult >= 4) this._tryUnlockTrophy('snowball_sniper');
    }
  }

  addShake(amount) {
    this.shake = Math.min(18, Math.max(this.shake, amount));
  }

  addPopup({ col = null, floor = null, x = null, y = null, text, color = '#ffffff', maxLife = 0.95 }) {
    this.popups.push({
      col,
      floor,
      x,
      y,
      text,
      color,
      life: maxLife,
      maxLife,
    });
  }

  _colFloorToScreen(col, floor, radiusOffset = 14) {
    const width = this.renderer?.width || 360;
    const height = this.renderer?.height || 640;
    const centerX = width * 0.5;
    const radius = Math.min(width * 0.33, 132) + radiusOffset;
    const floorPx = this._isRealOriginal() ? 18 : 42;
    const playerScreenY = height * 0.56;
    const a = colDist(this.camCol, col) * ((Math.PI * 2) / COLS);
    if (Math.abs(a) > Math.PI * 0.58) return null;
    return {
      x: centerX + radius * Math.sin(a),
      y: playerScreenY - (floor - this.camFloor) * floorPx,
    };
  }

  _spawnParticles(x, y, color, count = 10, speed = 90, gravity = 180, col = null, floor = null) {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = (0.3 + Math.random() * 0.7) * speed;
      const life = 0.38 + Math.random() * 0.35;
      this.particles.push({
        x,
        y,
        col: col != null ? wrapCol(col + (Math.random() - 0.5) * 0.35) : undefined,
        floor: floor != null ? floor + (Math.random() - 0.5) * 0.25 : undefined,
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

  _spawnSplashDroplets(x, y, col = null, floor = null) {
    const colors = ['#e8f6ff', '#67e8f9', '#22d3ee', '#a5f3fc'];
    for (let i = 0; i < 24; i++) {
      const spread = (Math.random() - 0.5) * 260;
      const upSpeed = -(130 + Math.random() * 190);
      const life = 0.44 + Math.random() * 0.38;
      this.particles.push({
        x: x + (Math.random() - 0.5) * 26,
        y: y + (Math.random() - 0.5) * 8,
        col: col != null ? wrapCol(col + (Math.random() - 0.5) * 0.6) : undefined,
        floor: floor != null ? floor + 0.1 + Math.random() * 0.35 : undefined,
        vx: spread,
        vy: upSpeed,
        gravity: 380,
        size: 3 + Math.random() * 4.5,
        color: colors[i % colors.length],
        life,
        maxLife: life,
      });
    }
  }

  // --- HUD Synchronization (§2.4) ---

  _syncHud() {
    const activeMode = this.mode === 'paused' ? this.pausedFrom || 'tower' : this.mode;
    const exitDoor = this.tower?.doors?.find((d) => d.isExit);
    const exitFloor = exitDoor ? exitDoor.floor : Math.max(1, (this.tower?.floors || 18) - 2);
    const p = this.player;
    const isRealOrig = this._isRealOriginal();

    const altitudePct = Math.max(0, Math.min(100, Math.round((p.floor / Math.max(1, exitFloor)) * 100)));
    const waterPct =
      this.waterFloor > -0.45
        ? Math.max(0, Math.min(100, Math.round(((this.waterFloor + 0.55) / (exitFloor + 0.55)) * 100)))
        : 0;

    let dirHint = '▲';
    let actionPrompt = null;

    if (activeMode === 'tower' && this.tower) {
      if (exitDoor) {
        const d = colDist(p.col, exitDoor.col + 0.5);
        if (Math.abs(d) < 0.7) dirHint = '▲';
        else dirHint = d > 0 ? '▶' : '◀';
      }
      if (!p.hidden && this.mode === 'tower') {
        const missionType = this._getCasualMissionType(this.tower);
        const wb = this.tower.workbench;
        const ch = this.tower.treasureChest;
        const nearWb =
          wb &&
          !wb.crafted &&
          Math.abs(wb.floor - p.floor) < 0.85 &&
          Math.abs(colDist(p.col, wb.col + 0.5)) < 0.92;
        const nearCh =
          ch &&
          !ch.opened &&
          Math.abs(ch.floor - p.floor) < 0.85 &&
          Math.abs(colDist(p.col, ch.col + 0.5)) < 0.92;
        const nearDoor =
          (p.onGround || p.coyoteTimer > 0) &&
          this.tower.doors?.find(
            (d) => Math.abs(d.floor - p.floor) < 0.55 && Math.abs(colDist(p.col, d.col + 0.5)) < 0.74
          );
        if (nearDoor) {
          if (nearDoor.isExit && !isRealOrig) {
            if (missionType === 'tower_repair') {
              actionPrompt =
                this.dynamoCrafted || wb?.crafted
                  ? '▲ INSTALL BEACON DYNAMO!'
                  : 'CRAFT DYNAMO AT WORKBENCH';
            } else if ((this._casualSkipConfirmTimer || 0) > 0) {
              actionPrompt = '▲ PRESS UP AGAIN TO DEPART';
            } else {
              actionPrompt = '▲ TOPPLE TOWER!';
            }
          } else if (nearDoor.isVault) {
            actionPrompt = this.towerVaultCleared ? '✓ VAULT UNLOCKED' : '▲ CRACK VAULT';
          } else if (nearDoor.isRune) {
            actionPrompt = nearDoor.solved ? '✓ RUNE SOLVED' : 'UP • ENTER RUNE CHAMBER';
          } else {
            // Note: on Original Tower 8 summit, real exit 'T' & decoy '#' share identical prompt so decoys aren't spoiled!
            actionPrompt = this.era === 'reboot' ? '▲ ENTER DOORWAY' : '▲ ENTER PORTAL';
          }
        } else if (nearWb) {
          const req = Math.max(1, this.salvagePartsTotal || 3);
          actionPrompt =
            this.salvagePartsCollected >= req
              ? '▲ CRAFT BEACON DYNAMO!'
              : `NEED PARTS (${this.salvagePartsCollected}/${req})`;
        } else if (nearCh) {
          const req = Math.max(1, this.compassKeysTotal || 3);
          actionPrompt =
            this.compassKeysCollected >= req
              ? '▲ OPEN TREASURE CHEST!'
              : `NEED KEYS (${this.compassKeysCollected}/${req})`;
        } else if (p.onElevator) {
          actionPrompt = this.era === 'reboot' ? '▲▼ CAGE LIFT' : '▲▼ RIDE LIFT';
        } else if (!isRealOrig) {
          const nearEl = this.elevators.find((el) => Math.abs(colDist(p.col, el.col + 0.5)) < 1.15);
          if (nearEl && Math.abs(nearEl.floor - p.floor) > 0.35) {
            actionPrompt = 'FIRE • CALL LIFT';
          }
        }
      }
    } else if (activeMode === 'submarine' && this.era === 'reboot') {
      if ((this.sub?.timer || 0) < 4.8) {
        actionPrompt = 'FIRE TORPEDO • JUMP SONAR PING';
      } else if ((this.sub?.sonarPulse || 0) > 0.35) {
        actionPrompt = '◎ ABYSSAL SONAR ACTIVE';
      }
    } else if (activeMode === 'vault' && this.vault.status === 'playing') {
      actionPrompt = 'TAP • LOCK RING';
    } else if (activeMode === 'puzzle' && this.puzzleRoom?.hud?.line) {
      actionPrompt = this.puzzleRoom.hud.line;
    }

    let displayTimer = this.zenMode ? this.zenElapsed : this.timer;
    let displayLimit = this.timeLimit || this.tower?.timeLimit || 95;
    if (activeMode === 'submarine') {
      displayTimer = Math.max(0, this.sub.duration - this.sub.timer);
      displayLimit = this.sub.duration;
    } else if (activeMode === 'skimmer') {
      displayTimer = Math.max(0, this.skimmer.duration - this.skimmer.timer);
      displayLimit = this.skimmer.duration;
    } else if (activeMode === 'glide') {
      const prog = Math.max(0, Math.min(1, this.glideStage?.progress ?? 0));
      displayTimer = Math.max(0, (1 - prog) * 22);
      displayLimit = 22;
    } else if (activeMode === 'vault') {
      displayTimer = Math.max(0, this.vault.timer);
      displayLimit = this.vault.duration;
    }

    const boostMult =
      activeMode === 'skimmer'
        ? this.skimmer.boostMult
        : activeMode === 'glide'
        ? Math.max(1, this.glideStage?.mult || 1)
        : Math.max(1, this.comboCount || 1);

    const missionStatus = this._buildMissionStatus();

    this.cb.onHud?.({
      era: this.era,
      mode: this.mode,
      runType: this.runType,
      zenMode: this.zenMode,
      score: this.score,
      hiScore: this.hiScore,
      lives: this.lives,
      gears: this.prog?.getGears?.() ?? 0,
      timer: displayTimer,
      timeLimit: displayLimit,
      towerId: this.tower ? this.tower.id : 1,
      towerName: this.tower ? this.tower.name : 'WATCHTOWER OF THE MIST',
      dirHint,
      altitudePct,
      waterPct,
      actionPrompt,
      missionStatus,
      boostMult,
    });
  }

  // --- Main Simulation Tick ---

  update(dt) {
    const clampedDt = Math.min(0.05, Math.max(0, dt || 0));
    this.time += clampedDt;

    if (this._stationHintCooldown > 0) {
      this._stationHintCooldown = Math.max(0, this._stationHintCooldown - clampedDt);
    }
    if (this._casualSkipConfirmTimer > 0) {
      this._casualSkipConfirmTimer = Math.max(0, this._casualSkipConfirmTimer - clampedDt);
    }

    if (this.prog?._pendingAutoTrophies?.length > 0) {
      this._flushPendingProgTrophies();
    }

    if (this.shake > 0) {
      this.shake *= Math.exp(-9 * clampedDt);
      if (this.shake < 0.12) this.shake = 0;
    }

    if (this.lightningFlash > 0) {
      this.lightningFlash = Math.max(0, this.lightningFlash - clampedDt * 2.8);
    }

    if (this.comboTimer > 0) {
      this.comboTimer = Math.max(0, this.comboTimer - clampedDt);
      if (this.comboTimer <= 0) this.comboCount = 0;
    }

    // Update popups
    for (let i = this.popups.length - 1; i >= 0; i--) {
      const pop = this.popups[i];
      pop.life -= clampedDt;
      if (pop.floor != null) pop.floor += clampedDt * 0.9;
      if (pop.y != null) pop.y -= clampedDt * 34;
      if (pop.life <= 0) this.popups.splice(i, 1);
    }

    // Update particles
    const fScale = this._isRealOriginal() ? 18 : 42;
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const pt = this.particles[i];
      pt.x += pt.vx * clampedDt;
      pt.y += pt.vy * clampedDt;
      pt.vy += (pt.gravity ?? 180) * clampedDt;
      if (pt.col != null) pt.col = wrapCol(pt.col + (pt.vx / 56) * clampedDt);
      if (pt.floor != null) pt.floor -= (pt.vy / fScale) * clampedDt;
      pt.life -= clampedDt;
      if (pt.life <= 0) this.particles.splice(i, 1);
    }

    if (this.mode === 'title') {
      this.camCol = wrapCol(this.camCol + clampedDt * 0.55);
      this._syncDynamicLedges(clampedDt, true);
    } else if (this.mode === 'tower') {
      this._updateTower(clampedDt);
    } else if (this.mode === 'topple') {
      this._updateTopple(clampedDt);
    } else if (this.mode === 'submarine') {
      this._updateSubmarine(clampedDt);
    } else if (this.mode === 'skimmer') {
      this._updateSkimmer(clampedDt);
    } else if (this.mode === 'glide') {
      this._updateGlide(clampedDt);
    } else if (this.mode === 'puzzle') {
      this._updatePuzzle(clampedDt);
    } else if (this.mode === 'vault') {
      this._updateVault(clampedDt);
    }

    this.input?.clearFrame?.();
  }

  // --- Tower Environmental & Ledge Helpers ---

  _isWalkableLedge(l) {
    return (
      !l.gone &&
      l.active &&
      l.type !== 'box' &&
      l.type !== 'pillar' &&
      l.type !== 'laserGate'
    );
  }

  _blocksHorizontalBody(l, floor) {
    if (l.gone || !l.active) return false;
    if (l.type !== 'box' && l.type !== 'pillar' && l.type !== 'laserGate') return false;
    if (l.h) {
      return l.floor < floor + 1.7 && l.floor + l.h > floor + 0.1;
    }
    return Math.abs(l.floor - floor) < 0.65;
  }

  _cellSolidReal(col, a, b) {
    for (const l of this.ledges) {
      if (l.gone || !l.active || Math.abs(colDist(col, l.col + 0.5)) > 0.5) continue;
      const isWall = l.type === 'box' || l.type === 'pillar';
      const lo = isWall ? l.floor : l.floor - 1;
      const hi = isWall ? l.floor + (l.h || 1.55) : l.floor;
      if (lo < b && hi > a) return true;
    }
    return false;
  }

  _vanishCrumbleImmediate(l) {
    if (l.gone) return;
    l.gone = true;
    l.crumbling = false;
    l.shake = false;
    l.respawnTimer = Infinity;
    sound?.crumble?.();
    this.addShake(3.0);
    const pos = this._colFloorToScreen(l.col + 0.5, l.floor, 10);
    if (pos) {
      this._spawnParticles(pos.x, pos.y, '#f59e0b', 10, 85, 210, l.col + 0.5, l.floor);
    }
    this._emitProgEvent('crumble', { era: this.era });
    if (this.era === 'original') {
      this._tryUnlockTrophy('chute_breaker');
    }
  }

  _syncDynamicLedges(dt, silent = false) {
    const convFlipped = Boolean(this.switchStates.conv);
    for (const l of this.ledges) {
      if (l.origType === 'conveyorR' || l.origType === 'conveyorL') {
        if (!l.switchGroup || l.switchGroup === 'conv') {
          l.type = convFlipped
            ? l.origType === 'conveyorR'
              ? 'conveyorL'
              : 'conveyorR'
            : l.origType;
        }
      }

      if (l.type === 'phaseBlock') {
        if (l.switchGroup) {
          const swOn = Boolean(this.switchStates[l.switchGroup]);
          l.active = l.inverted ? !swOn : swOn;
        } else {
          l.active = true;
        }
      } else if (l.type === 'laserGate') {
        if (l.switchGroup) {
          const swOn = Boolean(this.switchStates[l.switchGroup]);
          l.active = l.inverted ? swOn : !swOn;
        } else {
          l.active = true;
        }
      } else if (l.type === 'piston') {
        const period = Math.max(1.2, l.phasePeriod || 3.2);
        const u = ((((this.time + (l.phaseOffset || 0)) % period) + period) % period) / period;
        let ext = 1;
        if (u < 0.56) ext = 1;
        else if (u < 0.64) ext = 1 - (u - 0.56) / 0.08;
        else if (u < 0.92) ext = 0;
        else ext = (u - 0.92) / 0.08;
        l.pistonExt = Math.max(0, Math.min(1, ext));
        l.active = l.pistonExt >= 0.42;
      } else if (l.type === 'steamVent') {
        l.active = true;
        const period = Math.max(1.5, l.phasePeriod || 3.4);
        const u = ((((this.time + (l.phaseOffset || 0)) % period) + period) % period) / period;
        const prevSteam = l.steamActive;
        l.steamWarn = u >= 0.52 && u < 0.74;
        l.steamActive = u >= 0.74 && u < 0.96;
        if (!silent && l.steamActive && !prevSteam) {
          if (Math.abs(l.floor - this.player.floor) < 5 && Math.abs(colDist(this.player.col, l.col + 0.5)) < 4) {
            sound?.steamBurst?.();
          }
        }
      }
    }
  }

  _triggerSwitch(sw) {
    if (!sw || sw.cooldown > 0) return;
    sw.cooldown = sw.mode === 'drainValve' ? 3.2 : 0.65;
    this.towerSwitchesUsed += 1;
    sound?.switchToggle?.();
    this.input?.haptic?.(16);

    if (sw.mode === 'drainValve') {
      sw.active = true;
      const mech = this.tower?.mechanics || {};
      const minWater = (mech.waterBaseFloor ?? -0.55) - ((mech.waterRiseRate || 0) > 0 ? 0.45 : 0);
      this.waterFloor = Math.max(minWater, this.waterFloor - 1.6);
      this.addShake(3.5);
      this._tryUnlockTrophy('drain_plumber');
      this.addPopup({
        col: sw.col + 0.5,
        floor: sw.floor + 0.7,
        text: 'WATER -1.6F!',
        color: '#5efce8',
        maxLife: 1.15,
      });
    } else if (sw.mode === 'conveyorFlip') {
      this.switchStates.conv = !this.switchStates.conv;
      sw.active = this.switchStates.conv;
      this._tryUnlockTrophy('belt_flipper');
      this.addPopup({
        col: sw.col + 0.5,
        floor: sw.floor + 0.7,
        text: 'BELTS REVERSED!',
        color: '#fbbf24',
      });
    } else {
      const grp = sw.group || 'red';
      this.switchStates[grp] = !this.switchStates[grp];
      sw.active = this.switchStates[grp];
      this.addPopup({
        col: sw.col + 0.5,
        floor: sw.floor + 0.7,
        text: `${grp.toUpperCase()} ${sw.active ? 'ON' : 'OFF'}`,
        color: grp === 'cyan' ? '#5efce8' : '#fb7185',
      });
    }
    this._emitProgEvent('switch_trigger', { mode: sw.mode || 'toggle', group: sw.group || 'red' });
    this._syncDynamicLedges(0, true);
  }

  // --- Core Cylindrical Tower Gameplay ---

  _updateTower(dt) {
    const p = this.player;
    const inp = this.input.state;
    const isReboot = this.era === 'reboot';
    const isRealOrig = this._isRealOriginal();

    if (this.runType === 'daily' && this.dailyMeta) {
      this.dailyMeta.elapsedSec += dt;
    }

    // Cooldowns & pose springs
    if (p.invuln > 0 && !p.tumbling) p.invuln = Math.max(0, p.invuln - dt);
    if (p.fireCooldown > 0) p.fireCooldown = Math.max(0, p.fireCooldown - dt);
    if (p.knockbackTimer > 0) p.knockbackTimer = Math.max(0, p.knockbackTimer - dt);
    if (p.muzzleFlash > 0) p.muzzleFlash = Math.max(0, p.muzzleFlash - dt);
    if (p.stepUpCooldown > 0) p.stepUpCooldown = Math.max(0, p.stepUpCooldown - dt);
    if (p.hurtTimer > 0) p.hurtTimer = Math.max(0, p.hurtTimer - dt);
    if (p.landImpact > 0) p.landImpact = Math.max(0, p.landImpact - dt * 9.5);
    if (p.origHintCooldown > 0) p.origHintCooldown = Math.max(0, p.origHintCooldown - dt);

    const springRate = Math.min(1, dt * 15);
    p.squashX += (1 - p.squashX) * springRate;
    p.squashY += (1 - p.squashY) * springRate;

    // Tunnel / Door 3-stage cinematic traversal ('enter' -> 'transit' -> 'exit')
    if (p.doorPhase === 'enter') {
      p.tunnelTimer -= dt;
      p.enteringDoor = Math.min(1, 1 - p.tunnelTimer / 0.14);
      if (p.tunnelTimer <= 0) {
        p.doorPhase = 'transit';
        p.hidden = true;
        p.tunnelTimer = 0.34;
      }
      this._syncHud();
      return;
    }

    if (p.hidden || p.doorPhase === 'transit') {
      p.tunnelTimer -= dt;
      p.enteringDoor = 1;
      if (p.tunnelTarget) {
        const dc = colDist(this.camCol, p.tunnelTarget.col + 0.5);
        this.camCol = wrapCol(this.camCol + dc * Math.min(1, dt * 10));
        const tf = Math.max(2, p.tunnelTarget.floor + (isRealOrig ? 2.2 : 1.2));
        this.camFloor += (tf - this.camFloor) * Math.min(1, dt * 8.5);
      }
      if (p.tunnelTimer <= 0 && p.tunnelTarget) {
        p.col = wrapCol(p.tunnelTarget.col + 0.5);
        p.floor = p.tunnelTarget.floor;
        p.vx = 0;
        p.vy = 0;
        p.arc = null;
        p.hidden = false;
        p.onElevator = null;
        const exitSupport = this._findLedgeAt(p.col, p.floor);
        p.onGround = Boolean(exitSupport);
        p.doorPhase = 'exit';
        p.tunnelTimer = 0.16;
        p.tunnelTarget = null;
        p.invuln = Math.max(p.invuln || 0, 1.5);
        if (exitSupport && p.floor > this.waterFloor + 0.25) {
          p.safeCol = p.col;
          p.safeFloor = p.floor;
        }
        p.landingFloor = this._computeLandingFloor(p.col, p.floor);
        sound?.door?.();
      }
      this._syncHud();
      return;
    }

    if (p.doorPhase === 'exit') {
      p.tunnelTimer -= dt;
      p.enteringDoor = Math.max(0, p.tunnelTimer / 0.16);
      if (p.tunnelTimer <= 0) {
        p.doorPhase = null;
        p.enteringDoor = 0;
        p.invuln = Math.max(p.invuln || 0, 1.35);
      }
    }

    // Timer countdown (paused inside tunnels & Rune Chambers, infinite in Zen Mode)
    if (this.zenMode) {
      this.zenElapsed += dt;
    } else {
      const prevWhole = Math.ceil(this.timer);
      this.timer = Math.max(0, this.timer - dt);
      const nextWhole = Math.ceil(this.timer);
      if (this.timer > 0 && this.timer <= 15 && nextWhole < prevWhole) {
        sound?.timerTick?.();
      }
      if (this.timer <= 0) {
        this._loseLife('TIME UP!');
        return;
      }
    }

    // Environmental Tower Mechanics (Rising Sea, Wind, Blackout, Lightning)
    const mech = this.tower?.mechanics || {};
    if (mech.waterRiseRate > 0) {
      if (this.waterSurgeDelay > 0) {
        this.waterSurgeDelay = Math.max(0, this.waterSurgeDelay - dt);
      } else {
        const exitDoor = this.tower?.doors?.find((d) => d.isExit);
        const maxWater = (exitDoor ? exitDoor.floor : this.tower.floors - 2) - 1.2;
        const rate = this.zenMode ? mech.waterRiseRate * 0.45 : mech.waterRiseRate;
        this.waterFloor = Math.min(maxWater, this.waterFloor + rate * dt);
      }
    }

    if (mech.windForce > 0) {
      const period = Math.max(2.0, mech.windPeriod || 6.0);
      this.windCurrent = Math.sin((this.time * Math.PI * 2) / period) * mech.windForce;
    } else {
      this.windCurrent = 0;
    }

    if (mech.blackoutCycle > 0) {
      const cycle = Math.max(4.0, mech.blackoutCycle);
      const raw = Math.sin((this.time * Math.PI * 2) / cycle);
      const targetDark = raw > 0.15 ? Math.min(0.88, (raw - 0.15) * 1.15) : 0;
      this.blackoutFactor = Math.max(0, targetDark * (1 - this.lightningFlash));
    } else {
      this.blackoutFactor = 0;
    }

    if (mech.lightningInterval > 0) {
      this._lightningTimer -= dt;
      if (this._lightningTimer <= 0) {
        this._lightningTimer = mech.lightningInterval * (0.75 + Math.random() * 0.55);
        this.lightningFlash = 1.0;
        this.blackoutFactor = 0;
        this.addShake(2.4);
        sound?.thunderCrack?.();
      }
    }

    // Update crumbling ledges, switches, pistons, steam vents, phase/laser gates
    for (const l of this.ledges) {
      if (l.crumbling && !l.gone) {
        l.crumbleTimer -= dt;
        if (l.crumbleTimer <= 0) {
          l.gone = true;
          l.crumbling = false;
          l.shake = false;
          l.respawnTimer = 4.0;
          sound?.crumble?.();
          this.addShake(4.2);
          const pos = this._colFloorToScreen(l.col + 0.5, l.floor, 10);
          if (pos) {
            this._spawnParticles(pos.x, pos.y, '#f59e0b', 10, 85, 210, l.col + 0.5, l.floor);
          }
        }
      } else if (l.gone && l.type !== 'box' && Number.isFinite(l.respawnTimer)) {
        l.respawnTimer -= dt;
        if (l.respawnTimer <= 0) {
          l.gone = false;
        }
      }
    }

    for (const sw of this.switches) {
      if (sw.cooldown > 0) sw.cooldown = Math.max(0, sw.cooldown - dt);
    }

    this._syncDynamicLedges(dt, false);

    // Update elevators (continuous Reboot lifts vs multi-stop 1987 lifts with 10s auto-return)
    for (const el of this.elevators) {
      if (isRealOrig || Array.isArray(el.stops)) {
        if (p.onElevator !== el && !el.autoDir && el.floor > el.minFloor + 0.01) {
          el.idleT = (el.idleT || 0) + dt;
          if (el.idleT >= 10.0) {
            const rate = el.rowsPerSec || el.speed || 3.1;
            el.floor = Math.max(el.minFloor, el.floor - rate * dt);
            if (el.floor <= el.minFloor + 1e-4) {
              el.floor = el.minFloor;
              el.idleT = 0;
            }
          }
        }
      } else if (el.recallTarget !== null) {
        el.dwellTimer = 0;
        const diff = el.recallTarget - el.floor;
        if (Math.abs(diff) < 0.05) {
          el.floor = el.recallTarget;
          el.recallTarget = null;
        } else {
          el.floor += Math.sign(diff) * el.speed * 1.65 * dt;
        }
      } else {
        const playerManualSteer = p.onElevator === el && (inp.up || inp.down);
        if (playerManualSteer) {
          el.dwellTimer = 0;
        }
        if ((el.dwellTimer || 0) > 0 && !playerManualSteer) {
          el.dwellTimer = Math.max(0, el.dwellTimer - dt);
        } else {
          el.floor += el.dir * el.speed * dt;
          if (el.floor >= el.maxFloor) {
            el.floor = el.maxFloor;
            el.dir = -1;
            el.dwellTimer = 0.45;
          } else if (el.floor <= el.minFloor) {
            el.floor = el.minFloor;
            el.dir = 1;
            el.dwellTimer = 0.45;
          }
        }
      }
    }

    // Surface properties & wind shelter
    const underLedge = p.onGround ? this._findLedgeAt(p.col, p.floor) : null;
    if (isRealOrig && underLedge && underLedge.type === 'crumble' && !underLedge.gone) {
      this._vanishCrumbleImmediate(underLedge);
    }

    const isIce = Boolean(underLedge && underLedge.type === 'ice');
    const convPush = underLedge
      ? underLedge.type === 'conveyorR'
        ? 1.55
        : underLedge.type === 'conveyorL'
        ? -1.55
        : 0
      : 0;

    let windPush = this.windCurrent;
    if (windPush !== 0) {
      const sheltered =
        this.tower?.doors?.some(
          (d) => Math.abs(d.floor - p.floor) < 0.6 && Math.abs(colDist(p.col, d.col + 0.5)) < 0.6
        ) ||
        this.ledges.some(
          (b) =>
            !b.gone &&
            (b.type === 'box' || b.type === 'pillar') &&
            Math.abs(b.floor - p.floor) < 0.9 &&
            Math.abs(colDist(p.col, b.col + 0.5)) < 1.05
        );
      if (sheltered) windPush = 0;
    }

    // Horizontal movement intent
    let moveIntent = 0;
    if (Math.abs(inp.analogX || 0) > 0.08) {
      moveIntent = Math.max(-1, Math.min(1, inp.analogX));
    } else if (inp.left) {
      moveIntent = -1;
    } else if (inp.right) {
      moveIntent = 1;
    }

    if (!p.tumbling) {
      if (moveIntent < -0.08) p.facing = -1;
      else if (moveIntent > 0.08) p.facing = 1;
    }

    const moveSpeed = isRealOrig ? ORIG_WALK_SPEED : isReboot ? 4.5 : 4.1;
    const stepWalkSpeed = !isRealOrig && p.stepHopActive && !p.onGround ? 2.35 : moveSpeed;
    const targetVx = p.tumbling
      ? 0
      : isRealOrig
      ? moveIntent !== 0
        ? Math.sign(moveIntent) * ORIG_WALK_SPEED
        : 0
      : moveIntent * stepWalkSpeed;

    // 1987 Slippery ('slideR' / 'slideL'): pushes Pogo at +-2.0 cols/s only when idle/shooting
    const slidePush =
      p.onGround &&
      underLedge &&
      targetVx === 0 &&
      (underLedge.type === 'slideR' || underLedge.type === 'slideL')
        ? (underLedge.type === 'slideR' ? 1 : -1) * ORIG_WALK_SPEED
        : 0;

    if (p.onGround || p.onElevator) {
      if (!p.tumbling) p.arc = null;
    }

    if (isRealOrig && !p.onGround && !p.onElevator) {
      p.vx = p.arc && p.arc.t / PORT_TICK < p.arc.ticks ? p.arc.vx : 0;
    } else if ((p.knockbackTimer || 0) <= 0 && !p.tumbling) {
      if (isReboot) {
        const desiredVx = targetVx + convPush + slidePush + windPush;
        const isCounterSteer = moveIntent * p.vx < -0.1;
        const rate = !p.onGround
          ? Math.abs(moveIntent) > 0.05
            ? 38
            : 5.5
          : isIce
          ? Math.abs(moveIntent) > 0.05
            ? 15.5
            : 10.2
          : Math.abs(moveIntent) > 0.05
          ? isCounterSteer
            ? 92
            : 54
          : 68;
        p.vx = approach(p.vx, desiredVx, rate * dt);
      } else {
        const desiredOrigVx = targetVx + convPush + slidePush;
        if (isIce && p.onGround) {
          const iceRate = Math.abs(moveIntent) > 0.05 ? 15.0 : 10.2;
          p.vx = approach(p.vx, desiredOrigVx, iceRate * dt);
        } else {
          p.vx = desiredOrigVx;
        }
      }
    }

    const nextCol = wrapCol(p.col + p.vx * dt);
    const blockingBarrier = this.ledges.find(
      (l) =>
        this._blocksHorizontalBody(l, p.floor) &&
        Math.abs(colDist(nextCol, l.col + 0.5)) < 0.52 &&
        Math.abs(colDist(nextCol, l.col + 0.5)) < Math.abs(colDist(p.col, l.col + 0.5)) + 0.002
    );
    if (!blockingBarrier || p.tumbling) {
      p.col = nextCol;
    } else {
      p.vx = 0;
      if (blockingBarrier.type === 'laserGate' && p.invuln <= 0) {
        this._applyHazardHit(blockingBarrier.col + 0.5);
      }
    }

    // Step-on Switch check
    if (!p.tumbling) {
      for (const sw of this.switches) {
        const inside = Math.abs(sw.floor - p.floor) < 0.65 && Math.abs(colDist(p.col, sw.col + 0.5)) < 0.55;
        if (inside && !sw._playerInside) {
          this._triggerSwitch(sw);
        }
        sw._playerInside = inside;
      }

      // Collectibles pickup ('gear' | 'starCore' | 'relic' | 'salvage_part' | 'compass_key' | 'curio')
      for (const c of this.collectibles) {
        if (c.collected) continue;
        if (Math.abs(c.floor - p.floor) < 0.82 && Math.abs(colDist(p.col, c.col + 0.5)) < 0.68) {
          c.collected = true;
          this.input?.haptic?.(18);
          if (c.type === 'relic') {
            this.towerRelicCollected = true;
            const relicKey = c.relicId || c.id || `relic_t${this.tower?.id || 1}`;
            const relicRes = this.prog?.collectRelic?.(relicKey);
            this._handleProgTrophyReturn(relicRes);
            this.addScore(750);
            sound?.collectStar?.();
            const pos = this._colFloorToScreen(c.col + 0.5, c.floor + 0.45, 14);
            if (pos) {
              this._spawnParticles(pos.x, pos.y, '#c084fc', 14, 105, 150, c.col + 0.5, c.floor + 0.45);
            }
            this.addPopup({
              col: c.col + 0.5,
              floor: c.floor + 0.82,
              text: '◈ RELIC DECODED! +750',
              color: '#e879f9',
              maxLife: 1.45,
            });
            this._emitProgEvent('collectible', {
              type: 'relic',
              relicId: relicKey,
              towerId: this.tower?.id || 1,
              era: this.era,
            });
          } else if (c.type === 'salvage_part') {
            this.salvagePartsCollected += 1;
            const req = Math.max(1, this.salvagePartsTotal || 3);
            const partNames = ['COPPER COIL', 'PRISM LENS', 'BRASS SHAFT'];
            const partName = String(
              c.label || c.partName || c.name || partNames[(this.salvagePartsCollected - 1) % partNames.length]
            ).toUpperCase();
            this.prog?.addGears?.(2);
            this._flushPendingProgTrophies();
            this.addScore(300);
            sound?.collectGear?.();
            const pos = this._colFloorToScreen(c.col + 0.5, c.floor + 0.4, 14);
            if (pos) {
              this._spawnParticles(pos.x, pos.y, '#f59e0b', 12, 95, 165, c.col + 0.5, c.floor + 0.4);
            }
            this.addPopup({
              col: c.col + 0.5,
              floor: c.floor + 0.8,
              text: `❖ ${partName} (${this.salvagePartsCollected}/${req})`,
              color: '#fbbf24',
              maxLife: 1.35,
            });
            this._emitProgEvent('salvage_collect', {
              collected: this.salvagePartsCollected,
              total: req,
              partId: c.id,
            });
          } else if (c.type === 'compass_key') {
            this.compassKeysCollected += 1;
            const req = Math.max(1, this.compassKeysTotal || 3);
            this.prog?.addGears?.(2);
            this._flushPendingProgTrophies();
            this.addScore(300);
            sound?.collectStar?.();
            const pos = this._colFloorToScreen(c.col + 0.5, c.floor + 0.4, 14);
            if (pos) {
              this._spawnParticles(pos.x, pos.y, '#fde047', 12, 95, 160, c.col + 0.5, c.floor + 0.4);
            }
            this.addPopup({
              col: c.col + 0.5,
              floor: c.floor + 0.8,
              text: `◈ COMPASS KEY (${this.compassKeysCollected}/${req})`,
              color: '#fde047',
              maxLife: 1.35,
            });
            this._emitProgEvent('compass_key', {
              collected: this.compassKeysCollected,
              total: req,
              keyId: c.id,
            });
          } else if (c.type === 'curio') {
            this.curiosCollectedHere += 1;
            const curioKey = c.curioId || c.relicId || null;
            const curioRes = this.prog?.collectCurio?.(curioKey);
            this._handleProgTrophyReturn(curioRes);
            this.addScore(600);
            sound?.collectStar?.();
            const pos = this._colFloorToScreen(c.col + 0.5, c.floor + 0.45, 14);
            if (pos) {
              this._spawnParticles(pos.x, pos.y, '#5efce8', 14, 105, 150, c.col + 0.5, c.floor + 0.45);
            }
            const curioLabel = curioRes?.curio?.name
              ? `✦ ${String(curioRes.curio.name).toUpperCase()}!`
              : '✦ CURIO RECOVERED! +600';
            this.addPopup({
              col: c.col + 0.5,
              floor: c.floor + 0.82,
              text: curioLabel,
              color: '#5efce8',
              maxLife: 1.4,
            });
          } else if (c.type === 'starCore') {
            this.towerStarCollected = true;
            this.addScore(500);
            sound?.collectStar?.();
            this._tryUnlockTrophy('first_star_core');
            this.addPopup({
              col: c.col + 0.5,
              floor: c.floor + 0.75,
              text: '★ STAR CORE!',
              color: '#5efce8',
              maxLife: 1.3,
            });
            this._emitProgEvent('collectible', { type: 'starCore', towerId: this.tower?.id || 1, era: this.era });
          } else {
            this.prog?.addGears?.(1);
            this._flushPendingProgTrophies();
            this.addScore(100);
            sound?.collectGear?.();
            this.addPopup({
              col: c.col + 0.5,
              floor: c.floor + 0.65,
              text: '+1 GEAR',
              color: '#fbbf24',
            });
            this._emitProgEvent('collectible', { type: 'gear', towerId: this.tower?.id || 1, era: this.era });
          }
        }
      }

      // Casual Expedition Tinker Workbench & Sunken Treasure Chest interactions (#112)
      const wb = this.tower?.workbench;
      if (wb && !wb.crafted) {
        const dWb = Math.abs(colDist(p.col, wb.col + 0.5));
        const fWb = Math.abs(wb.floor - p.floor);
        const reqParts = Math.max(1, this.salvagePartsTotal || 3);
        if (fWb < 0.8 && dWb < 0.68) {
          if (this.salvagePartsCollected >= reqParts) {
            this._craftWorkbenchDynamo(wb);
          } else if (this._stationHintCooldown <= 0) {
            this._stationHintCooldown = 2.6;
            this.addPopup({
              col: wb.col + 0.5,
              floor: wb.floor + 0.9,
              text: `NEED PARTS (${this.salvagePartsCollected}/${reqParts})`,
              color: '#bae6fd',
              maxLife: 1.15,
            });
          }
        }
      }

      const ch = this.tower?.treasureChest;
      if (ch && !ch.opened) {
        const dCh = Math.abs(colDist(p.col, ch.col + 0.5));
        const fCh = Math.abs(ch.floor - p.floor);
        const reqKeys = Math.max(1, this.compassKeysTotal || 3);
        if (fCh < 0.8 && dCh < 0.68) {
          if (this.compassKeysCollected >= reqKeys) {
            this._openTreasureChest(ch);
          } else if (this._stationHintCooldown <= 0) {
            this._stationHintCooldown = 2.6;
            this.addPopup({
              col: ch.col + 0.5,
              floor: ch.floor + 0.9,
              text: `NEED KEYS (${this.compassKeysCollected}/${reqKeys})`,
              color: '#fde68a',
              maxLife: 1.15,
            });
          }
        }
      }
    }

    // Door / Workbench / Chest / Rune Chamber / Vault / Decoy / Exit interaction with UP
    if (!p.tumbling && this.input.consumeJustPressed('up') && (p.onGround || p.coyoteTimer > 0)) {
      const wbNear =
        this.tower?.workbench &&
        !this.tower.workbench.crafted &&
        Math.abs(this.tower.workbench.floor - p.floor) < 0.85 &&
        Math.abs(colDist(p.col, this.tower.workbench.col + 0.5)) < 0.95
          ? this.tower.workbench
          : null;
      if (wbNear) {
        const reqParts = Math.max(1, this.salvagePartsTotal || 3);
        if (this.salvagePartsCollected >= reqParts) {
          this._craftWorkbenchDynamo(wbNear);
        } else {
          sound?.vaultTick?.(false);
          this.addPopup({
            col: wbNear.col + 0.5,
            floor: wbNear.floor + 0.95,
            text: `COLLECT ${reqParts} SALVAGE PARTS (${this.salvagePartsCollected}/${reqParts})`,
            color: '#fbbf24',
            maxLife: 1.25,
          });
        }
        return;
      }

      const chNear =
        this.tower?.treasureChest &&
        !this.tower.treasureChest.opened &&
        Math.abs(this.tower.treasureChest.floor - p.floor) < 0.85 &&
        Math.abs(colDist(p.col, this.tower.treasureChest.col + 0.5)) < 0.95
          ? this.tower.treasureChest
          : null;
      if (chNear) {
        const reqKeys = Math.max(1, this.compassKeysTotal || 3);
        if (this.compassKeysCollected >= reqKeys) {
          this._openTreasureChest(chNear);
        } else {
          sound?.vaultTick?.(false);
          this.addPopup({
            col: chNear.col + 0.5,
            floor: chNear.floor + 0.95,
            text: `FIND ${reqKeys} COMPASS KEYS (${this.compassKeysCollected}/${reqKeys})`,
            color: '#fde047',
            maxLife: 1.25,
          });
        }
        return;
      }

      const door = this.tower?.doors?.find(
        (d) => Math.abs(d.floor - p.floor) < 0.55 && Math.abs(colDist(p.col, d.col + 0.5)) < 0.74
      );
      if (door) {
        if (door.isExit) {
          const missionType = this._getCasualMissionType(this.tower);
          if (missionType === 'tower_repair' && !this.dynamoCrafted && !this.tower?.workbench?.crafted) {
            sound?.vaultTick?.(false);
            this.input?.haptic?.(24);
            this.cb.onBanner?.('SUMMIT BEACON OFFLINE', 'CRAFT DYNAMO AT WORKBENCH');
            this.addPopup({
              col: door.col + 0.5,
              floor: door.floor + 1.0,
              text: 'CRAFT DYNAMO AT WORKBENCH!',
              color: '#fbbf24',
              maxLife: 1.4,
            });
            return;
          }
          const isCasualTower = Boolean(this.runType === 'endless_casual' || this.tower?.casual);
          const optionalIncomplete =
            isCasualTower &&
            ((missionType === 'treasure_hunt' &&
              !this.treasureChestOpened &&
              !this.tower?.treasureChest?.opened) ||
              (missionType === 'curio_survey' &&
                this.curiosCollectedHere < Math.max(1, this.curiosTotalHere || 4)) ||
              (missionType === 'puzzle_architect' &&
                !this.towerVaultCleared &&
                !this.vaultCrackedThisTower &&
                this.tower?.doors?.some((d) => (d.isRune && !d.solved) || d.isVault)));
          if (optionalIncomplete && (this._casualSkipConfirmTimer || 0) <= 0) {
            this._casualSkipConfirmTimer = 3.5;
            sound?.vaultTick?.(false);
            this.input?.haptic?.(18);
            this.cb.onBanner?.('OBJECTIVE INCOMPLETE', 'PRESS UP AGAIN TO DEPART');
            this.addPopup({
              col: door.col + 0.5,
              floor: door.floor + 1.0,
              text: 'PRESS UP AGAIN TO DEPART',
              color: '#fde047',
              maxLife: 1.5,
            });
            return;
          }
          this._casualSkipConfirmTimer = 0;
          this._triggerTowerTopple();
          return;
        }
        if (door.isRune && !door.solved) {
          this._enterPuzzleRoom(door);
          return;
        }
        if (door.isVault && !this.towerVaultCleared) {
          this.vaultReturnState = {
            col: door.col + 0.5,
            floor: door.floor,
            doorId: door.id,
          };
          sound?.door?.();
          this.startMiniGame('vault', false);
          return;
        }
        if (door.decoy) {
          // 1987 unpartnered '#' decoy (e.g. T8 summit): walks straight through hollow core to (c+8)%16 over empty air!
          this.towerDoorsUsed += 1;
          p.col = door.col + 0.5;
          p.doorPhase = 'enter';
          p.enteringDoor = 0.1;
          p.tunnelTimer = 0.14;
          p.tunnelTarget = { col: wrapCol(door.col + 8), floor: door.floor };
          p.vx = 0;
          p.vy = 0;
          sound?.door?.();
          this._tryUnlockTrophy('tunnel_runner');
          this._emitProgEvent('door_enter', { tunnelStyle: door.tunnelStyle || 'stone', decoy: true });
          return;
        }
        if (door.targetId) {
          const target = this.tower.doors.find((d) => d.id === door.targetId);
          if (target) {
            this.towerDoorsUsed += 1;
            const tStyle = door.tunnelStyle || target.tunnelStyle || 'stone';
            p.col = door.col + 0.5;
            p.doorPhase = 'enter';
            p.enteringDoor = 0.1;
            p.tunnelTimer = 0.14;
            p.tunnelTarget = target;
            p.vx = 0;
            p.vy = 0;
            sound?.door?.();
            this._tryUnlockTrophy('tunnel_runner');
            if (tStyle === 'sparkArch') {
              this._tryUnlockTrophy('spark_diver');
            }
            this._emitProgEvent('door_enter', { tunnelStyle: tStyle, decoy: false });
            return;
          }
        }
      }
    }

    // Coyote time & Jump buffering
    const coyoteWindow = isRealOrig ? 0.12 : isReboot ? 0.10 : 0.11;
    const bufferWindow = isRealOrig ? 0.13 : isReboot ? 0.11 : 0.12;
    if (p.onGround && !p.tumbling) {
      p.coyoteTimer = coyoteWindow;
    } else {
      p.coyoteTimer = Math.max(0, p.coyoteTimer - dt);
    }

    const jumpEdge = this.input.consumeJustPressed('jump');
    if (jumpEdge && !p.tumbling) {
      p.jumpBufferTimer = bufferWindow;
    } else {
      p.jumpBufferTimer = Math.max(0, p.jumpBufferTimer - dt);
    }

    // On a multi-stop lift while stationary, pressing JUMP rides the lift up instead of hopping off prematurely
    const stationaryLiftRide =
      (isRealOrig || Boolean(p.onElevator?.stops)) &&
      p.onElevator &&
      p.onElevator.floor < p.onElevator.maxFloor - 0.01 &&
      targetVx === 0;
    if (stationaryLiftRide && p.jumpBufferTimer > 0) {
      p.onElevator.autoDir = 1;
      p.jumpBufferTimer = 0;
    }

    // Jump Launch
    if (!p.tumbling && p.jumpBufferTimer > 0 && (p.onGround || p.coyoteTimer > 0)) {
      if (isRealOrig && targetVx === 0) {
        p.jumpBufferTimer = 0;
        if (p.origHintCooldown <= 0) {
          p.origHintCooldown = 2.5;
          this.addPopup({
            col: p.col,
            floor: p.floor + 1.4,
            text: 'WALK + JUMP TO LEAP',
            color: '#bae6fd',
            maxLife: 1.1,
          });
        }
      } else {
        if (isRealOrig) {
          p.vx = Math.sign(targetVx) * ORIG_WALK_SPEED;
          p.vy = 7.5;
          p.arc = makeArc('jump', p.floor, p.vx, ARC_JUMP.length, ARC_JUMP);
        } else {
          p.vy = isReboot ? 9.5 : 8.1;
        }
        p.jumpCutEligible = true;
        p.stepHopActive = false;
        p.jumpStartCol = p.col;
        p.jumpStartFloor = p.floor;
        p.onGround = false;
        p.onElevator = null;
        p.coyoteTimer = 0;
        p.jumpBufferTimer = 0;
        p.landImpact = 0;
        p.squashX = isReboot ? 0.86 : 0.78;
        p.squashY = isReboot ? 1.16 : 1.25;
        sound?.jump?.();
      }
    }

    // Classic Auto-Step-Up (+1 floor stair hop OR resting bottom lift platform!)
    if (!p.tumbling && p.onGround && Math.abs(targetVx) > 0 && (p.stepUpCooldown || 0) <= 0) {
      const stepFloor = Math.round(p.floor) + 1;
      const blockedOverhead = this.ledges.some(
        (b) =>
          !b.gone &&
          b.active &&
          Math.abs(b.floor - stepFloor) < 0.28 &&
          Math.abs(colDist(p.col, b.col + 0.5)) < 0.36
      );
      if (!blockedOverhead) {
        const stepLedge =
          this.ledges.find((l) => {
            if (!this._isWalkableLedge(l) || Math.abs(l.floor - stepFloor) > 0.22) return false;
            const dc = colDist(p.col, l.col + 0.5);
            return Math.sign(dc) === p.facing && Math.abs(dc) > 0.14 && Math.abs(dc) <= 0.62;
          }) ||
          this.elevators.find((el) => {
            if (Math.abs(el.floor - stepFloor) > 0.22) return false;
            const dc = colDist(p.col, el.col + 0.5);
            return Math.sign(dc) === p.facing && Math.abs(dc) > 0.14 && Math.abs(dc) <= 0.62;
          });
        if (stepLedge) {
          if (isRealOrig) {
            p.vx = p.facing * ORIG_WALK_SPEED;
            p.vy = 5.6;
            p.arc = makeArc('climb', p.floor, p.vx, ARC_CLIMB.length, ARC_CLIMB);
          } else {
            p.vy = isReboot ? 7.5 : 6.2;
            if (Math.abs(p.vx) > 2.35) {
              p.vx = Math.sign(p.vx) * 2.35;
            }
          }
          p.jumpCutEligible = false;
          p.stepHopActive = true;
          p.onGround = false;
          p.onElevator = null;
          p.coyoteTimer = 0;
          p.stepUpCooldown = 0.18;
          p.squashX = 0.88;
          p.squashY = 1.14;
          sound?.stepUp?.();
        }
      }
    }

    // Fire Cryo-Bolt / Snowball (or interact with adjacent Casual Workbench / Treasure Chest)
    if (this.input.consumeJustPressed('fire')) {
      const wbFire =
        !p.tumbling &&
        this.tower?.workbench &&
        !this.tower.workbench.crafted &&
        Math.abs(this.tower.workbench.floor - p.floor) < 0.85 &&
        Math.abs(colDist(p.col, this.tower.workbench.col + 0.5)) < 0.92 &&
        this.salvagePartsCollected >= Math.max(1, this.salvagePartsTotal || 3)
          ? this.tower.workbench
          : null;
      const chFire =
        !p.tumbling &&
        this.tower?.treasureChest &&
        !this.tower.treasureChest.opened &&
        Math.abs(this.tower.treasureChest.floor - p.floor) < 0.85 &&
        Math.abs(colDist(p.col, this.tower.treasureChest.col + 0.5)) < 0.92 &&
        this.compassKeysCollected >= Math.max(1, this.compassKeysTotal || 3)
          ? this.tower.treasureChest
          : null;
      if (wbFire) {
        this._craftWorkbenchDynamo(wbFire);
        p.fireBuffer = 0;
      } else if (chFire) {
        this._openTreasureChest(chFire);
        p.fireBuffer = 0;
      } else {
        p.fireBuffer = 0.18;
      }
    } else {
      p.fireBuffer = Math.max(0, (p.fireBuffer || 0) - dt);
    }

    if (!p.tumbling && p.fireBuffer > 0 && p.fireCooldown <= 0) {
      if (isRealOrig) {
        // 1987 rule: max 1 active snowball, thrown while stationary on solid ground (3.0 cols, +1.0 row rise)
        const stationary = p.onGround && Math.abs(moveIntent) <= 0.08 && Math.abs(p.vx) < 0.65;
        if (stationary && this.snowballs.length === 0) {
          p.fireBuffer = 0;
          p.fireCooldown = 0.22;
          p.muzzleFlash = 0.14;
          this.towerShotsFired += 1;
          this.snowballs.push({
            col: wrapCol(p.col + p.facing * 0.4),
            floor: p.floor + 0.85,
            dir: p.facing,
            speed: ORIG_SHOT_SPEED,
            rise: 1 / ORIG_SHOT_LIFE,
            life: ORIG_SHOT_LIFE,
            fxId: p.blasterFxId || this.blasterFxId || 'standard_cryo',
          });
          sound?.snowball?.();
          this._tryUnlockTrophy('first_snowball');
          this._emitProgEvent('snowball_fire', { era: this.era, recalledLift: false });
        }
      } else {
        const maxActive = isReboot ? 4 : 2;
        if (this.snowballs.length < maxActive) {
          p.fireBuffer = 0;
          p.fireCooldown = 0.24;
          p.muzzleFlash = 0.14;
          this.towerShotsFired += 1;
          let recalledLift = false;
          const nearEl = this.elevators.find((el) => Math.abs(colDist(p.col, el.col + 0.5)) < 1.15);
          if (nearEl && !nearEl.stops && Math.abs(nearEl.floor - p.floor) > 0.35) {
            nearEl.recallTarget = Math.max(nearEl.minFloor, Math.min(nearEl.maxFloor, p.floor));
            recalledLift = true;
            sound?.elevator?.();
            this._tryUnlockTrophy('lift_caller');
          }
          this.snowballs.push({
            col: wrapCol(p.col + p.facing * 0.42),
            floor: p.floor + 0.32,
            dir: p.facing,
            speed: 8.5,
            rise: 0,
            life: 1.1,
            fxId: p.blasterFxId || this.blasterFxId || 'standard_cryo',
          });
          sound?.snowball?.();
          this._tryUnlockTrophy('first_snowball');
          this._emitProgEvent('snowball_fire', { era: this.era, recalledLift });
        }
      }
    }

    // Level-walk onto resting lift platform
    if (!p.tumbling && p.onGround && !p.onElevator) {
      const levelEl = this.elevators.find(
        (el) => Math.abs(el.floor - p.floor) < 0.18 && Math.abs(colDist(p.col, el.col + 0.5)) < 0.44
      );
      if (levelEl) {
        p.onElevator = levelEl;
        p.floor = levelEl.floor;
        p.jumpCutEligible = false;
        p.stepHopActive = false;
        if (!isReboot && !levelEl.boarded) {
          levelEl.boarded = true;
          this.addScore(50);
          this.addPopup({ col: p.col, floor: p.floor + 0.9, text: '+50', color: '#38bdf8' });
        }
      }
    }

    // Vertical physics: Multi-Stop Lifts, 1987 Port Arcs & Weighty 3-Phase Asymmetric Gravity
    const wasOnGround = p.onGround;
    const prevVy = p.vy;

    if (p.onElevator && !p.tumbling) {
      p.jumpCutEligible = false;
      p.stepHopActive = false;
      const el = p.onElevator;
      if (isRealOrig || Array.isArray(el.stops)) {
        if (Math.abs(colDist(p.col, el.col + 0.5)) > 0.52 && !el.autoDir) {
          p.onElevator = null;
          p.onGround = Boolean(this._findLedgeAt(p.col, p.floor));
        } else if (Math.abs(colDist(p.col, el.col + 0.5)) > 0.65) {
          el.autoDir = 0;
          p.onElevator = null;
          p.onGround = false;
        } else {
          if (inp.up || jumpEdge) el.autoDir = 1;
          else if (inp.down) el.autoDir = -1;

          const rate = el.rowsPerSec || el.speed || 3.1;
          const stops = el.stops && el.stops.length > 2 ? el.stops : null;
          el.idleT = 0;

          if (el.autoDir === 1) {
            el.dir = 1;
            const held = Boolean(inp.up || inp.jump);
            const stopNext = stops && !held ? stops.find((s) => s > el.floor + 0.001) ?? el.maxFloor : el.maxFloor;
            el.floor = Math.min(stopNext, el.floor + rate * dt);
            if (el.floor >= stopNext - 1e-5) {
              el.floor = stopNext;
              if (!held || stopNext >= el.maxFloor) el.autoDir = 0;
            }
            // Riding upward into an unshot flashing block knocks Pogo off!
            const hitCapBox = this.ledges.some(
              (l) =>
                l.type === 'box' &&
                !l.gone &&
                l.active &&
                Math.abs(colDist(el.col + 0.5, l.col + 0.5)) < 0.5 &&
                l.floor < el.floor + POGO_VIS_H_ORIGINAL &&
                l.floor + (l.h || 1.55) > el.floor + 0.6
            );
            if (hitCapBox) {
              el.autoDir = 0;
              el.floor = Math.floor(el.floor);
              p.floor = el.floor;
              this._applyHazardHit(el.col + 0.5, true);
            }
          } else if (el.autoDir === -1) {
            el.dir = -1;
            const held = Boolean(inp.down);
            const stopPrev =
              stops && !held ? [...stops].reverse().find((s) => s < el.floor - 0.001) ?? el.minFloor : el.minFloor;
            el.floor = Math.max(stopPrev, el.floor - rate * dt);
            if (el.floor <= stopPrev + 1e-5) {
              el.floor = stopPrev;
              if (!held || stopPrev <= el.minFloor) el.autoDir = 0;
            }
          }

          if (p.onElevator === el) {
            p.floor = el.floor;
            p.vy = 0;
            p.onGround = true;
            this.maxFloorReached = Math.max(this.maxFloorReached, Math.floor(el.floor + 0.01));
            if (el.floor >= el.maxFloor - 0.08 && !el._topReached) {
              el._topReached = true;
              this._tryUnlockTrophy('lift_rider');
              this._emitProgEvent('elevator_ride', { era: this.era });
            }
          }
        }
      } else {
        if (Math.abs(colDist(p.col, el.col + 0.5)) > 0.66) {
          p.onElevator = null;
          p.onGround = false;
          if (isReboot) {
            p.invuln = Math.max(p.invuln || 0, 0.75);
          }
        } else {
          if (inp.up) {
            el.recallTarget = null;
            el.dwellTimer = 0;
            el.dir = 1;
            el.floor = Math.min(el.maxFloor, el.floor + el.speed * 0.48 * dt);
          } else if (inp.down) {
            el.recallTarget = null;
            el.dwellTimer = 0;
            el.dir = -1;
            el.floor = Math.max(el.minFloor, el.floor - el.speed * 0.48 * dt);
          }
          p.floor = el.floor;
          p.vy = 0;
          p.onGround = true;
          if (el.floor >= el.maxFloor - 0.08) {
            if (isReboot) {
              p.invuln = Math.max(p.invuln || 0, 0.75);
            }
            if (!el._topReached) {
              el._topReached = true;
              this._tryUnlockTrophy('lift_rider');
              this._emitProgEvent('elevator_ride', { era: this.era });
            }
          }
        }
      }
    }

    if (!p.onElevator) {
      const prevFloor = p.floor;
      const a = isRealOrig ? p.arc : null;

      if (a && !a.done && (a.t + dt) / PORT_TICK < a.ticks) {
        a.t += dt;
        const nf = a.y0 + arcRows(a.table, a.t / PORT_TICK);
        p.vy = (nf - p.floor) / Math.max(dt, 1e-6);
        p.floor = nf;
      } else {
        if (a && !a.done) {
          a.done = true;
          a.t = a.ticks * PORT_TICK;
          p.vy = Math.min(p.vy, a.endVy);
          if (a.kind === 'tumble') {
            p.tumbling = false;
            p.dropThrough = null;
            p.invuln = 1.5;
          }
        }
        if (isRealOrig) {
          p.vy = Math.max(-ORIG_MAX_FALL, p.vy - ORIG_FALL_G * dt);
        } else if (isReboot) {
          let grav = 24.5;
          if (p.vy > 1.4 && !inp.jump && p.jumpCutEligible) {
            grav = p.vy > 6.2 ? 62.0 : 48.0;
          } else if (Math.abs(p.vy) <= 1.1) {
            grav = 18.5;
          } else if (p.vy < -1.1) {
            grav = 37.0;
          }
          p.vy = Math.max(-15.0, p.vy - grav * dt);
        } else {
          const origGrav = p.vy < -1.0 ? 29.0 : 21.5;
          p.vy = Math.max(-14.5, p.vy - origGrav * dt);
          if (!inp.jump && p.vy > 2.0 && p.jumpCutEligible) {
            p.vy = Math.max(1.8, p.vy - 26.0 * dt);
          }
        }
        p.floor += p.vy * dt;
      }

      p.onGround = false;

      // Solid slab underside head-bump (prevents clipping up through overhead ledges/boxes in both 1987 & Reboot)
      if (isRealOrig && p.vy > 0 && !p.tumbling) {
        const head = p.floor + POGO_VIS_H_ORIGINAL;
        const prevHead = prevFloor + POGO_VIS_H_ORIGINAL;
        for (const l of this.ledges) {
          if (l.gone || !l.active || Math.abs(colDist(p.col, l.col + 0.5)) > 0.42) continue;
          const bottom = l.type === 'box' || l.type === 'pillar' ? l.floor : l.floor - SLAB_ROWS_ORIGINAL;
          if (bottom > prevHead - 0.01 && bottom <= head) {
            p.floor = bottom - POGO_VIS_H_ORIGINAL - 0.001;
            p.vy = 0;
            if (p.arc) p.arc.done = true;
            break;
          }
        }
      } else if (!isRealOrig && p.vy > 0 && !p.tumbling && !p.stepHopActive) {
        const head = p.floor + 0.72;
        const prevHead = prevFloor + 0.72;
        const startCol = p.jumpStartCol ?? p.col;
        const startFloor = p.jumpStartFloor ?? prevFloor;
        for (const l of this.ledges) {
          if (l.gone || !l.active || l.type === 'laserGate') continue;
          if (Math.abs(colDist(p.col, l.col + 0.5)) >= 0.34) continue;
          const isWallBlock = l.type === 'box' || l.type === 'pillar';
          if (
            !isWallBlock &&
            l.floor <= startFloor + 1.15 &&
            Math.abs(colDist(startCol, l.col + 0.5)) >= 0.45
          ) {
            continue;
          }
          const bottom = isWallBlock ? l.floor : l.floor - 0.14;
          if (prevHead <= bottom + 0.01 && head >= bottom) {
            p.floor = bottom - 0.721;
            p.vy = 0;
            p.jumpCutEligible = false;
            break;
          }
        }
      }

      // Landing on ledges or elevators (skipped while mid-ARC_TUMBLE drop-through!)
      if (p.vy <= 0 && !p.tumbling) {
        const landed = this._findLedgeLanding(p.col, prevFloor, p.floor, p.dropThrough);
        if (landed) {
          p.floor = landed.floor;
          p.vy = 0;
          p.arc = null;
          p.dropThrough = null;
          p.onGround = true;
          this._onTouchdown(wasOnGround, prevVy, landed);
        } else {
          for (let ei = 0; ei < this.elevators.length; ei++) {
            const el = this.elevators[ei];
            if (
              Math.abs(colDist(p.col, el.col + 0.5)) < 0.64 &&
              prevFloor >= el.floor - 0.45 &&
              p.floor <= el.floor + 0.35
            ) {
              p.floor = el.floor;
              p.vy = 0;
              p.arc = null;
              p.dropThrough = null;
              p.jumpCutEligible = false;
              p.stepHopActive = false;
              p.onGround = true;
              p.onElevator = el;
              this._onTouchdown(wasOnGround, prevVy, null);
              if (!isReboot && !el.boarded) {
                el.boarded = true;
                this.visitedElevators.add(ei);
                this.addScore(50);
                this.addPopup({ col: p.col, floor: p.floor + 0.9, text: '+50', color: '#38bdf8' });
              }
              break;
            }
          }
        }
      }

      // Forgiving ledge-edge mantle (Reboot & non-real classic)
      if (!isRealOrig && !p.onGround && p.vy <= 1.6 && Math.abs(p.vx) > 0.3) {
        const mantleLedge = this.ledges.find((l) => {
          if (!this._isWalkableLedge(l)) return false;
          const floorGap = l.floor - p.floor;
          if (floorGap <= 0 || floorGap > 0.18) return false;
          const dc = colDist(p.col, l.col + 0.5);
          return Math.abs(dc) < 0.72 && Math.sign(p.vx) === Math.sign(dc);
        });
        if (mantleLedge) {
          p.floor = mantleLedge.floor;
          p.vy = 0;
          p.stepHopActive = false;
          p.onGround = true;
          p.landImpact = Math.max(p.landImpact, 0.35);
          sound?.stepUp?.();
          this._registerLedgeStand(mantleLedge);
        }
      }
    }

    // Steam Vent upward launch impulse!
    if (!p.tumbling) {
      for (const l of this.ledges) {
        if (
          l.type === 'steamVent' &&
          l.steamActive &&
          Math.abs(p.floor - l.floor) < 0.75 &&
          Math.abs(colDist(p.col, l.col + 0.5)) < 0.58 &&
          p.vy < 8.5
        ) {
          p.vy = 12.8;
          p.jumpCutEligible = false;
          p.stepHopActive = false;
          p.jumpStartCol = p.col;
          p.jumpStartFloor = p.floor;
          p.onGround = false;
          p.onElevator = null;
          p.coyoteTimer = 0;
          p.squashX = 0.82;
          p.squashY = 1.22;
          this.towerSteamLaunches += 1;
          sound?.steamBurst?.();
          this.input?.haptic?.(22);
          this._tryUnlockTrophy('steam_surfer');
          this._emitProgEvent('steam_launch', { towerId: this.tower?.id || 1 });
        }
      }
    }

    // First-Time Stair Climb Score (+40 pts per new floor on foot in Original Mode)
    const curWholeFloor = Math.floor(p.floor + 0.01);
    if (!isReboot && !p.onElevator && p.onGround && curWholeFloor > this.maxFloorReached) {
      const gained = curWholeFloor - this.maxFloorReached;
      this.maxFloorReached = curWholeFloor;
      this.addScore(gained * 40);
      this.addPopup({ col: p.col, floor: curWholeFloor + 1.0, text: `+${gained * 40}`, color: '#a7f3d0', maxLife: 0.7 });
    } else if (curWholeFloor > this.maxFloorReached) {
      this.maxFloorReached = curWholeFloor;
    }

    // Anti-Stall Eye Timer
    if (Math.abs(p.floor - this.stallFloor) < 0.55) {
      this.stallTimer += dt;
    } else {
      this.stallFloor = p.floor;
      this.stallTimer = 0;
    }

    // Ocean / Rising Tide Immersion Check
    if (p.floor < this.waterFloor) {
      this.towerTouchedWater = true;
      sound?.splash?.();
      this.addShake(10);
      this._spawnSplashDroplets(
        (this.renderer?.width || 360) * 0.5,
        (this.renderer?.height || 640) * 0.78,
        p.col,
        this.waterFloor
      );
      if (this.zenMode) {
        this._zenBuoyantRescue();
      } else {
        this._loseLife('SPLASH!');
      }
      return;
    }

    // Update Snowballs / Cryo-Bolts
    this._updateSnowballs(dt);

    // Update Enemies
    this._updateEnemies(dt);

    p.landingFloor = this._computeLandingFloor(p.col, p.floor);
    this._updateCamera(dt);
    this._syncHud();
  }

  _onTouchdown(wasOnGround, prevVy, landed) {
    const p = this.player;
    const isReboot = this.era === 'reboot';
    p.jumpCutEligible = false;
    p.stepHopActive = false;
    if (!wasOnGround && prevVy < -1.4) {
      const impact = Math.min(1, Math.abs(prevVy) / (isReboot ? 13 : 10));
      p.landImpact = Math.max(p.landImpact, impact);
      if (isReboot) {
        p.squashX = 1 + 0.11 * impact;
        p.squashY = 1 - 0.09 * impact;
      } else {
        p.squashX = 1 + 0.26 * Math.max(0.4, impact);
        p.squashY = 1 - 0.22 * Math.max(0.4, impact);
      }
      if (Math.abs(prevVy) > 3.0) {
        sound?.land?.(impact);
      }
    }
    if (landed) {
      this._registerLedgeStand(landed);
    }
  }

  _registerLedgeStand(ledge) {
    const p = this.player;
    if (
      (ledge.type === 'solid' ||
        ledge.type === 'ice' ||
        ledge.type === 'steamVent' ||
        ledge.type === 'slideR' ||
        ledge.type === 'slideL') &&
      ledge.floor > this.waterFloor + 0.35
    ) {
      p.safeCol = ledge.col + 0.5;
      p.safeFloor = ledge.floor;
    }
    if (ledge.type === 'crumble') {
      if (this._isRealOriginal()) {
        this._vanishCrumbleImmediate(ledge);
      } else if (!ledge.crumbling) {
        ledge.crumbling = true;
        ledge.shake = true;
        ledge.crumbleTimer = 0.48;
      }
    }
  }

  _craftWorkbenchDynamo(wb) {
    if (!wb || wb.crafted) return;
    wb.crafted = true;
    this.dynamoCrafted = true;
    if (this.workbench) this.workbench.crafted = true;
    this.prog?.addGears?.(8);
    this._emitProgEvent('workbench_craft', {
      towerId: this.tower?.id || 1,
      partsUsed: this.salvagePartsCollected,
    });
    this._tryUnlockTrophy('tinker_apprentice');
    this.addScore(1000);
    this.addShake(5.5);
    if (typeof sound?.vaultUnlock === 'function') sound.vaultUnlock();
    else sound?.collectStar?.();
    this.input?.haptic?.([20, 30, 45]);
    const pos = this._colFloorToScreen(wb.col + 0.5, wb.floor + 0.55, 14);
    if (pos) {
      this._spawnParticles(pos.x, pos.y, '#fbbf24', 18, 120, 155, wb.col + 0.5, wb.floor + 0.55);
      this._spawnParticles(pos.x, pos.y, '#5efce8', 10, 95, 130, wb.col + 0.5, wb.floor + 0.55);
    }
    this.cb.onBanner?.('WORKBENCH COMPLETE!', 'BEACON DYNAMO CRAFTED • +8 GEARS');
    this.addPopup({
      col: wb.col + 0.5,
      floor: wb.floor + 1.0,
      text: '❖ BEACON DYNAMO CRAFTED!',
      color: '#fbbf24',
      maxLife: 1.5,
    });
    this._syncHud();
  }

  _openTreasureChest(ch) {
    if (!ch || ch.opened) return;
    ch.opened = true;
    this.treasureChestOpened = true;
    if (this.treasureChest) this.treasureChest.opened = true;
    this.prog?.addGears?.(15);
    const curioKey = ch.curioId || null;
    const curioRes = this.prog?.collectCurio?.(curioKey);
    this._handleProgTrophyReturn(curioRes);
    this._tryUnlockTrophy('chest_plunderer');
    this._flushPendingProgTrophies();
    this.addScore(1500);
    this.addShake(6.5);
    if (typeof sound?.vaultUnlock === 'function') sound.vaultUnlock();
    else sound?.collectStar?.();
    this.input?.haptic?.([25, 35, 55]);
    const pos = this._colFloorToScreen(ch.col + 0.5, ch.floor + 0.55, 14);
    if (pos) {
      this._spawnParticles(pos.x, pos.y, '#fde047', 22, 135, 165, ch.col + 0.5, ch.floor + 0.55);
      this._spawnParticles(pos.x, pos.y, '#34d399', 12, 100, 140, ch.col + 0.5, ch.floor + 0.55);
    }
    this.cb.onBanner?.('TREASURE CHEST UNLOCKED!', '+15 GEARS • RARE CURIO RECOVERED');
    this.addPopup({
      col: ch.col + 0.5,
      floor: ch.floor + 1.05,
      text: '★ +15 GEARS & RARE CURIO!',
      color: '#fde047',
      maxLife: 1.6,
    });
    this._syncHud();
  }

  // --- Snowball & Enemy Systems (Reboot + Sourced 1987 Real-Grid) ---

  _updateSnowballs(dt) {
    const isReboot = this.era === 'reboot';
    const isRealOrig = this._isRealOriginal();
    const trailPalette = this._getBlasterTrailColors();
    const activeFxId = this.player?.blasterFxId || this.blasterFxId || 'standard_cryo';

    for (let i = this.snowballs.length - 1; i >= 0; i--) {
      const sb = this.snowballs[i];
      const spd = sb.speed || 8.5;
      sb.col = wrapCol(sb.col + sb.dir * spd * dt);
      if (sb.rise) sb.floor += sb.rise * dt;
      sb.life -= dt;
      if (sb.life <= 0) {
        this.snowballs.splice(i, 1);
        continue;
      }

      // Blaster FX styled trail particles (#107)
      sb.trailTimer = (sb.trailTimer || 0) - dt;
      if (sb.trailTimer <= 0) {
        sb.trailTimer = 0.028;
        const pos = this._colFloorToScreen(sb.col, sb.floor, 14);
        if (pos) {
          const life = 0.22 + Math.random() * 0.14;
          const trailColor = trailPalette[Math.floor(Math.random() * trailPalette.length)] || '#67e8f9';
          this.particles.push({
            x: pos.x + (Math.random() - 0.5) * 4,
            y: pos.y + (Math.random() - 0.5) * 4,
            col: sb.col,
            floor: sb.floor,
            vx: -sb.dir * (18 + Math.random() * 20),
            vy: (Math.random() - 0.5) * 18,
            gravity: 28,
            size: activeFxId === 'retro_voxel' ? 3.2 + Math.random() * 1.6 : 2.5 + Math.random() * 2,
            color: trailColor,
            isSnowballTrail: true,
            life,
            maxLife: life,
          });
        }
      }

      // Check Switch hit!
      const hitSw = this.switches.find(
        (sw) => sw.cooldown <= 0 && Math.abs(sw.floor - sb.floor) < 0.78 && Math.abs(colDist(sb.col, sw.col + 0.5)) < 0.62
      );
      if (hitSw) {
        this._triggerSwitch(hitSw);
        this.snowballs.splice(i, 1);
        continue;
      }

      // Check Pillar ('!') — absorbs snowball with ricochet ping
      const pillar = this.ledges.find(
        (l) =>
          !l.gone &&
          l.active &&
          l.type === 'pillar' &&
          sb.floor >= l.floor - 0.2 &&
          sb.floor <= l.floor + (l.h || 1) + 0.2 &&
          Math.abs(colDist(sb.col, l.col + 0.5)) < 0.52
      );
      if (pillar) {
        const pos = this._colFloorToScreen(pillar.col + 0.5, sb.floor, 12);
        if (pos) {
          this._spawnParticles(pos.x, pos.y, trailPalette[0] || '#e0f2fe', 5, 65, 140, pillar.col + 0.5, sb.floor);
        }
        if (typeof sound?.deflect === 'function') sound.deflect();
        else sound?.stunEnemy?.();
        this.snowballs.splice(i, 1);
        continue;
      }

      // Check Destructible Flashing Block ('box')
      const box = this.ledges.find(
        (l) =>
          !l.gone &&
          l.active &&
          l.type === 'box' &&
          (l.h ? sb.floor >= l.floor - 0.25 && sb.floor <= l.floor + l.h + 0.25 : Math.abs(l.floor - sb.floor) < 0.72) &&
          Math.abs(colDist(sb.col, l.col + 0.5)) < 0.52
      );
      if (box) {
        box.gone = true;
        box.active = false;
        box.respawnTimer = Infinity;
        this.blocksShot += 1;
        if (isRealOrig) this.extras += 2;
        this._scoreActionHit(50, { col: box.col + 0.5, floor: box.floor + 0.5 }, '#fde047');
        this._tryUnlockTrophy('box_breaker');
        this._emitProgEvent('snowball_hit', { kind: 'box', era: this.era, combo: this.comboCount });
        this.addShake(3.5);
        const pos = this._colFloorToScreen(box.col + 0.5, box.floor + 0.3, 12);
        if (pos) {
          this._spawnParticles(pos.x, pos.y, trailPalette[1] || '#bae6fd', 8, 95, 180, box.col + 0.5, box.floor + 0.3);
        }
        if (typeof sound?.hitBlock === 'function') sound.hitBlock();
        else sound?.hitEnemy?.();
        this.snowballs.splice(i, 1);
        continue;
      }

      // Check Enemy hit
      let hit = false;
      for (const en of this.enemies) {
        if (en.dead) continue;
        // 1987 screen-space 'bonker' Molecule passes straight through snowballs untouched!
        if (en.kind === 'bonker') continue;

        const vReach = isRealOrig ? 1.15 : 0.68;
        if (Math.abs(en.floor - sb.floor) < vReach && Math.abs(colDist(sb.col, en.col)) < 0.56) {
          hit = true;
          const pos = this._colFloorToScreen(en.col, en.floor + 0.3, 14);

          if (isRealOrig && en.kind) {
            // Sourced 1987 matrix: 'bounce'/'park' DESTROYED (+100, +5 extras); 'roll' STUNNED 3.5s (0 pts, stays blocker); 'vpat'/'hpat' IMMUNE
            if (en.kind === 'bounce' || en.kind === 'park') {
              en.dead = true;
              en.deathTimer = 0.25;
              this.towerEnemiesDestroyed += 1;
              this.extras += 5;
              this.addScore(100);
              this.addPopup({ col: en.col, floor: en.floor + 0.6, text: '+100', color: '#38bdf8' });
              this.addShake(4.0);
              if (pos) this._spawnParticles(pos.x, pos.y, '#38bdf8', 10, 110, 190, en.col, en.floor + 0.3);
              sound?.hitEnemy?.();
              this._tryUnlockTrophy('bouncer_freeze');
              this._emitProgEvent('snowball_hit', { kind: 'bouncer', era: this.era, combo: 1 });
            } else if (en.kind === 'roll') {
              en.stunTimer = 3.5;
              this.towerEnemiesStunned += 1;
              this.addShake(2.0);
              if (pos) this._spawnParticles(pos.x, pos.y, '#a7f3d0', 6, 75, 150, en.col, en.floor + 0.3);
              sound?.stunEnemy?.();
              this._tryUnlockTrophy('roller_shatter');
              this._emitProgEvent('snowball_hit', { kind: 'roller', era: this.era, combo: 1 });
            } else {
              this.addShake(1.4);
              if (pos) this._spawnParticles(pos.x, pos.y, trailPalette[0] || '#e0f2fe', 5, 65, 140, en.col, en.floor + 0.3);
              if (typeof sound?.deflect === 'function') sound.deflect();
              else sound?.stunEnemy?.();
              this._emitProgEvent('snowball_hit', { kind: 'deflect', era: this.era, combo: 0 });
            }
          } else if (en.type === 'roller') {
            en.dead = true;
            this.towerEnemiesDestroyed += 1;
            this._scoreActionHit(100, { col: en.col, floor: en.floor + 0.5 }, '#38bdf8');
            this.addShake(4.0);
            if (pos) this._spawnParticles(pos.x, pos.y, '#f59e0b', 10, 110, 190, en.col, en.floor + 0.3);
            sound?.hitEnemy?.();
            this._tryUnlockTrophy('roller_shatter');
            this._emitProgEvent('snowball_hit', { kind: 'roller', era: this.era, combo: this.comboCount });
          } else if (en.type === 'bouncer') {
            const wasStunned = en.stunTimer > 0;
            en.stunTimer = 3.0;
            this.towerEnemiesStunned += 1;
            if (isReboot) {
              this._scoreActionHit(50, { col: en.col, floor: en.floor + 0.5 }, '#a7f3d0');
            } else if (!wasStunned) {
              this.addScore(100);
              this.addPopup({ col: en.col, floor: en.floor + 0.5, text: '+100', color: '#a7f3d0' });
            }
            this.addShake(2.2);
            if (pos) this._spawnParticles(pos.x, pos.y, '#a7f3d0', 7, 80, 160, en.col, en.floor + 0.3);
            sound?.stunEnemy?.();
            this._tryUnlockTrophy('bouncer_freeze');
            this._emitProgEvent('snowball_hit', { kind: 'bouncer', era: this.era, combo: this.comboCount });
          } else if ((en.type === 'robotH' || en.type === 'robotV') && isReboot) {
            en.stunTimer = 2.5;
            this.towerEnemiesStunned += 1;
            this._scoreActionHit(75, { col: en.col, floor: en.floor + 0.5 }, '#fbbf24');
            this.addShake(2.8);
            if (pos) this._spawnParticles(pos.x, pos.y, '#fbbf24', 8, 90, 170, en.col, en.floor + 0.3);
            sound?.stunEnemy?.();
            this._tryUnlockTrophy('sentinel_short');
            this._emitProgEvent('snowball_hit', { kind: 'robot', era: this.era, combo: this.comboCount });
          } else {
            this.addShake(1.4);
            if (pos) this._spawnParticles(pos.x, pos.y, trailPalette[0] || '#e0f2fe', 5, 65, 140, en.col, en.floor + 0.3);
            if (typeof sound?.deflect === 'function') sound.deflect();
            else sound?.stunEnemy?.();
            this._emitProgEvent('snowball_hit', { kind: 'deflect', era: this.era, combo: 0 });
          }
          break;
        }
      }
      if (hit) {
        this.snowballs.splice(i, 1);
      }
    }
  }

  _updateRealSpawnPoints() {
    if (!this.spawnPoints) return;
    const p = this.player;

    // Destroyed bouncing balls stay destroyed for the remainder of this life attempt
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const en = this.enemies[i];
      if (en.spawnKey && en.dead && en.deathTimer <= 0) {
        const sp = this.spawnPoints.find((s) => s.spawnKey === en.spawnKey);
        if (sp && sp.state === 'live') {
          sp.state = en.fellIntoSea ? 'idle' : 'destroyed';
        }
        this.enemies.splice(i, 1);
      }
    }

    // Despawn enemies > 12 rows below Pogo back to 'idle'
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const en = this.enemies[i];
      if (en.spawnKey && !en.dead && en.floor < p.floor - 12) {
        const sp = this.spawnPoints.find((s) => s.spawnKey === en.spawnKey);
        if (sp) sp.state = 'idle';
        this.enemies.splice(i, 1);
      }
    }

    let liveCount = this.enemies.filter((e) => !e.dead).length;
    if (liveCount >= MAX_REAL_ENEMIES || p.hidden) return;

    const cands = this.spawnPoints
      .filter((s) => s.state === 'idle' && s.floor >= p.floor - 4 && s.floor <= p.floor + 9)
      .sort((a, b) => Math.abs(a.floor - p.floor) - Math.abs(b.floor - p.floor));

    for (const sp of cands) {
      if (liveCount >= MAX_REAL_ENEMIES) break;
      sp.state = 'live';
      this.enemies.push(this._instantiateEnemy(sp, liveCount));
      liveCount++;
    }
  }

  _platformAtReal(col, floor) {
    return (
      this._findLedgeAt(col, floor) ||
      this.elevators.find((el) => Math.abs(el.floor - floor) < 0.14 && Math.abs(colDist(col, el.col + 0.5)) < 0.55)
    );
  }

  _moveRealEnemy(en, ei, dt) {
    const p = this.player;
    en.kt = (en.kt || 0) + dt;

    if (en.kind === 'bonker') {
      const slowSpeed = (MOLECULE_SPAN * 2) / (MOLECULE_SLOW + 2 * (MOLECULE_LIFE - MOLECULE_SLOW));
      const sx =
        en.kt < MOLECULE_SLOW
          ? slowSpeed * en.kt
          : slowSpeed * MOLECULE_SLOW + 2 * slowSpeed * (en.kt - MOLECULE_SLOW);
      en.col = wrapCol(this.camCol - en.dir * MOLECULE_SPAN + en.dir * sx);
      en.floor = en.baseFloor;
      if (en.kt > MOLECULE_LIFE) {
        this.enemies.splice(ei, 1);
        return true;
      }
      return false;
    }

    if (en.kind === 'vpat') {
      const nf = en.baseFloor + en.dir * (en.speed || 4.0) * dt;
      if (nf < 0 || nf + 1 > (this.tower?.floors || 99) || this._cellSolidReal(en.col, nf + 0.02, nf + 0.98)) {
        en.dir *= -1;
      } else {
        en.baseFloor = nf;
      }
      en.floor = en.baseFloor;
      return false;
    }

    if (en.kind === 'hpat') {
      const nc = wrapCol(en.col + en.dir * (en.speed || 2.0) * dt);
      if (this._cellSolidReal(nc + en.dir * 0.45, en.baseFloor + 0.02, en.baseFloor + 0.98)) {
        en.dir *= -1;
      } else {
        en.col = nc;
      }
      en.floor = en.baseFloor;
      return false;
    }

    // Ground kinds: 'roll', 'bounce', 'park'
    const floorLvl = Math.round(en.baseFloor);
    if (en.kind === 'park') {
      const dc = colDist(en.col, p.col);
      if (Math.abs(p.floor - floorLvl) < 0.5 && Math.abs(dc) <= 4 && !p.hidden) {
        en.kind = 'bounce';
        en.dir = Math.sign(dc) || 1;
        en.speed = 2.0;
      }
    }

    if (en.falling) {
      en.fallVy = Math.max(-ORIG_MAX_FALL, (en.fallVy || 0) - ORIG_FALL_G * dt);
      const prev = en.baseFloor;
      en.baseFloor += en.fallVy * dt;
      const land = this.ledges.find(
        (l) =>
          this._isWalkableLedge(l) &&
          prev >= l.floor - 0.06 &&
          en.baseFloor <= l.floor + 0.03 &&
          Math.abs(colDist(en.col, l.col + 0.5)) < 0.55
      );
      if (land) {
        en.baseFloor = land.floor;
        en.falling = false;
        en.fallVy = 0;
      }
      en.floor = en.baseFloor;
      if (en.floor < Math.max(-0.6, this.waterFloor)) {
        en.dead = true;
        en.fellIntoSea = true;
        en.deathTimer = 0.25;
      }
      return false;
    }

    if (!this._platformAtReal(en.col, floorLvl)) {
      en.falling = true;
      en.fallVy = 0;
      return false;
    }

    if (en.speed > 0) {
      const nc = wrapCol(en.col + en.dir * en.speed * dt);
      const ahead = nc + en.dir * 0.45;
      const wall = this._cellSolidReal(ahead, floorLvl + 0.05, floorLvl + 0.95);
      const liftAhead = this.elevators.some((el) => Math.abs(colDist(ahead, el.col + 0.5)) < 0.5);
      if (wall || (en.kind === 'roll' && (liftAhead || !this._platformAtReal(ahead, floorLvl)))) {
        en.dir *= -1;
      } else {
        en.col = nc;
      }
    }

    if (en.type === 'bouncer' && en.kind === 'bounce') {
      const ph = (en.kt % 0.66) / 0.66;
      en.floor = floorLvl + 6 * ph * (1 - ph);
    } else {
      en.floor = floorLvl;
    }
    en.baseFloor = floorLvl;
    return false;
  }

  _updateEnemies(dt) {
    const p = this.player;
    const isRealOrig = this._isRealOriginal();

    // Timed 18.75s Screen-Space Molecule ('bonker') on 1987 Real Towers
    if (isRealOrig && this.mode === 'tower') {
      this.moleculeTimer -= dt;
      const live = this.enemies.filter((e) => !e.dead).length;
      if (this.moleculeTimer <= 0 && !p.hidden && live < MAX_REAL_ENEMIES) {
        this.moleculeTimer = MOLECULE_PERIOD;
        this.moleculeDir = -this.moleculeDir;
        this.enemies.push(
          this._instantiateEnemy({
            type: 'molecule',
            kind: 'bonker',
            col: this.camCol,
            floor: p.floor,
            dir: this.moleculeDir,
            kt: 0,
            kspeed: 0,
          })
        );
      }
      this._updateRealSpawnPoints();
    }

    const stallThreshold = this.era === 'original' ? 7.5 : 10.0;
    const antiStallActive = !isRealOrig && !this.zenMode && this.stallTimer > stallThreshold;

    let closestEye = null;
    let closestEyeDist = Infinity;
    if (antiStallActive) {
      for (const en of this.enemies) {
        if (!en.dead && en.type === 'eye') {
          const df = Math.abs(en.floor - p.floor);
          if (df < closestEyeDist) {
            closestEyeDist = df;
            closestEye = en;
          }
        }
      }
    }

    for (let ei = this.enemies.length - 1; ei >= 0; ei--) {
      const en = this.enemies[ei];
      if (en.dead) {
        if (en.deathTimer > 0) en.deathTimer = Math.max(0, en.deathTimer - dt);
        continue;
      }

      if (en.stunTimer > 0) {
        en.stunTimer = Math.max(0, en.stunTimer - dt);
        // 1987 rule: a stunned rolling ball STILL blocks/knocks Pogo down on contact!
        if (isRealOrig && en.kind && p.invuln <= 0 && !p.tumbling && !p.hidden && portTouch(p.col, p.floor, en.col, en.floor)) {
          this._applyHazardHit(en.col, false);
        }
        continue;
      }

      if (isRealOrig && en.kind) {
        if (this._moveRealEnemy(en, ei, dt)) continue;
        const dfl = en.floor - p.floor;
        const touching =
          en.kind === 'bonker'
            ? Math.abs(colDist(en.col, p.col)) < 0.8 && dfl > -1.75 && dfl <= 2.0
            : portTouch(p.col, p.floor, en.col, en.floor);
        if (p.invuln <= 0 && !p.tumbling && !p.hidden && touching) {
          this._applyHazardHit(en.col, en.kind === 'bonker');
        }
        continue;
      }

      // Standard Reboot / non-real Enemy Patrol
      if (en.type === 'robotH' && en.spanStart != null && en.spanLen != null) {
        if (en.edgePause > 0) {
          en.edgePause = Math.max(0, en.edgePause - dt);
        } else {
          en.spanOffset += en.dir * (en.speed || 1.6) * dt;
          const minOff = 0.3;
          const maxOff = Math.max(0.7, en.spanLen - 0.3);
          if (en.spanOffset >= maxOff) {
            en.spanOffset = maxOff;
            en.dir = -1;
            en.edgePause = 0.15;
          } else if (en.spanOffset <= minOff) {
            en.spanOffset = minOff;
            en.dir = 1;
            en.edgePause = 0.15;
          }
          en.col = wrapCol(en.spanStart + en.spanOffset);
        }
      } else if (en.type === 'robotV') {
        const minF = en.minFloor ?? en.baseFloor - 1.5;
        const maxF = en.maxFloor ?? en.baseFloor + 1.5;
        const mid = (minF + maxF) * 0.5;
        const half = Math.max(0.4, (maxF - minF) * 0.5);
        en.floor = mid + Math.sin(this.time * (en.speed || 1.8) + en.phase) * half;
      } else {
        en.col = wrapCol(en.col + en.dir * (en.speed || 1.8) * dt);
        if (en.type === 'molecule') {
          en.floor = en.baseFloor + Math.sin(this.time * 3 + en.phase) * (en.amp || 0.4);
        } else if (en.type === 'bouncer') {
          en.floor = en.baseFloor + Math.abs(Math.sin(this.time * 4.5 + en.phase)) * (en.amp || 0.65);
        } else if (en.type === 'eye') {
          if (en === closestEye) {
            en.floor = approach(en.floor, p.floor + 0.35, 0.8 * dt);
          } else {
            en.floor = approach(en.floor, en.baseFloor, 0.5 * dt);
          }
        }
      }

      const shieldedInCageLift = this.era === 'reboot' && Boolean(p.onElevator);
      if (
        p.invuln <= 0 &&
        !shieldedInCageLift &&
        Math.abs(en.floor - p.floor) < 0.56 &&
        Math.abs(colDist(en.col, p.col)) < 0.52
      ) {
        this._applyHazardHit(en.col, false);
      }
    }
  }

  _applyHazardHit(sourceCol, smallTumble = false) {
    const p = this.player;
    if (p.shield) {
      p.shield = false;
      p.invuln = 1.6;
      sound?.stunEnemy?.();
      this.addShake(4.0);
      this.input?.haptic?.(25);
      this._tryUnlockTrophy('shield_saver');
      this._emitProgEvent('shield_absorb', { towerId: this.tower?.id || 1, era: this.era });
      this.addPopup({
        col: p.col,
        floor: p.floor + 1.0,
        text: 'SHIELD ABSORBED!',
        color: '#5efce8',
        maxLife: 1.15,
      });
      return;
    }

    this.towerHurtCount += 1;
    this.runHurtTotal += 1;
    p.jumpCutEligible = false;
    p.stepHopActive = false;
    this.comboCount = 0;
    this.comboTimer = 0;
    sound?.hurt?.();
    this.addShake(8.5);
    this.input?.haptic?.(40);

    if (this._isRealOriginal()) {
      // Sourced 1987 ARC_TUMBLE: hops +1.6 rows then falls straight through platforms for ~8 rows (~3 rows on Molecule/box)
      p.arc = makeArc('tumble', p.floor, 0, smallTumble ? 30 : 40, ARC_TUMBLE);
      p.tumbling = true;
      p.dropThrough = -1e9;
      p.invuln = 99;
      p.hurtTimer = 0.85;
      p.vx = 0;
      p.vy = 2.6;
      p.onGround = false;
      p.onElevator = null;
      p.coyoteTimer = 0;
      p.jumpBufferTimer = 0;
      p.squashX = 1.25;
      p.squashY = 0.78;
      return;
    }

    const zenScale = this.zenMode ? 0.55 : 1.0;
    p.invuln = 1.6;
    p.hurtTimer = 0.45 * zenScale;
    p.vy = (this.era === 'reboot' ? 5.6 : 4.2) * zenScale;
    p.onGround = false;
    p.onElevator = null;
    p.coyoteTimer = 0;
    p.knockbackTimer = 0.18 * zenScale;
    p.squashX = 1.22;
    p.squashY = 0.80;
    p.vx = (colDist(sourceCol, p.col) >= 0 ? 1 : -1) * 3.6;
  }

  _findLedgeAt(col, floor) {
    return this.ledges.find(
      (l) =>
        this._isWalkableLedge(l) &&
        Math.abs(l.floor - floor) < 0.14 &&
        Math.abs(colDist(col, l.col + 0.5)) < 0.66
    );
  }

  _findLedgeLanding(col, prevFloor, nextFloor, dropThrough = null) {
    return this.ledges.find(
      (l) =>
        this._isWalkableLedge(l) &&
        (dropThrough == null || l.floor < dropThrough - 0.05) &&
        prevFloor >= l.floor - 0.16 &&
        nextFloor <= l.floor + 0.06 &&
        Math.abs(colDist(col, l.col + 0.5)) < 0.66
    );
  }

  _computeLandingFloor(col, floor) {
    let best = this.waterFloor;
    for (const l of this.ledges) {
      if (
        this._isWalkableLedge(l) &&
        l.floor <= floor + 0.14 &&
        Math.abs(colDist(col, l.col + 0.5)) < 0.66
      ) {
        if (l.floor > best) best = l.floor;
      }
    }
    for (const el of this.elevators) {
      if (el.floor <= floor + 0.16 && Math.abs(colDist(col, el.col + 0.5)) < 0.64) {
        if (el.floor > best) best = el.floor;
      }
    }
    return best;
  }

  _updateCamera(dt) {
    const isRealOrig = this._isRealOriginal();
    const d = colDist(this.camCol, this.player.col);
    this.camCol = wrapCol(this.camCol + d * Math.min(1, dt * 13));
    const offset = isRealOrig ? 2.2 : 1.25;
    const targetFloor = Math.max(this.waterFloor + 2.4, this.player.floor + offset);
    const rate = isRealOrig ? 16 : 7.5;
    this.camFloor += (targetFloor - this.camFloor) * Math.min(1, dt * rate);
  }

  _zenBuoyantRescue() {
    const p = this.player;
    let rescueCol = p.safeCol;
    let rescueFloor = p.safeFloor;
    if (rescueFloor <= this.waterFloor + 0.4) {
      const dryLedges = this.ledges
        .filter((l) => this._isWalkableLedge(l) && l.floor > this.waterFloor + 0.8)
        .sort((a, b) => a.floor - b.floor);
      if (dryLedges.length > 0) {
        rescueCol = dryLedges[0].col + 0.5;
        rescueFloor = dryLedges[0].floor;
      } else {
        const baseWater = this.tower?.mechanics?.waterBaseFloor ?? -0.55;
        this.waterFloor = baseWater;
        rescueCol = (this.tower?.spawn?.col ?? 0) + 0.5;
        rescueFloor = this.tower?.spawn?.floor ?? 0;
      }
    }
    const mech = this.tower?.mechanics || {};
    if ((mech.waterRiseRate || 0) > 0) {
      this.waterSurgeDelay = 3.2;
    }
    p.col = rescueCol;
    p.floor = rescueFloor;
    p.vx = 0;
    p.vy = 0;
    p.arc = null;
    p.tumbling = false;
    p.dropThrough = null;
    p.jumpCutEligible = false;
    p.stepHopActive = false;
    p.onGround = true;
    p.onElevator = null;
    p.invuln = 2.0;
    p.landingFloor = this._computeLandingFloor(p.col, p.floor);
    this.cb.onBanner?.('BUOYANT RESCUE', 'ZEN MODE ACTIVE');
    this._syncHud();
  }

  _loseLife(reason) {
    this.lives -= 1;
    this.towerDeathsHere += 1;
    this.runDeathsTotal += 1;
    this.input?.haptic?.(60);

    if (this.lives <= 0) {
      this.mode = 'gameover';
      sound?.setWind?.(0);
      if (this.runType === 'daily' && this.dailyMeta) {
        const exitDoor = this.tower?.doors?.find((d) => d.isExit);
        const exitFloor = exitDoor ? exitDoor.floor : Math.max(1, (this.tower?.floors || 20) - 2);
        const altPct = Math.max(0, Math.min(100, Math.round((this.maxFloorReached / exitFloor) * 100)));
        this.prog?.recordDailyResult?.({
          dateKey: this.dailyMeta.dateKey,
          score: this.score,
          clearTimeSec: null,
          completed: false,
          altitudePct: altPct,
        });
        this._flushPendingProgTrophies();
      } else if (this.runType === 'endless') {
        this.prog?.recordEndlessRun?.(this.endlessDepth, this.score);
        this._flushPendingProgTrophies();
      }
      this._syncHud();
      this.cb.onGameOver?.(false, this.score, this.hiScore, this._buildGameOverSummary(false));
      return;
    }

    this.cb.onBanner?.(reason, `${this.lives} ${this.lives === 1 ? 'LIFE' : 'LIVES'} LEFT`);

    if (this.era === 'original') {
      // Classic 1987 rule: restart tower from Floor 0 spawn with fresh clock & restored blocks/crumbles/balls/lifts
      this.timer = this.timeLimit;
      this.towerShotsFired = 0;
      for (const l of this.ledges) {
        l.gone = false;
        l.crumbling = false;
        l.shake = false;
        l.respawnTimer = 0;
        if (l.origType === 'box') l.active = true;
      }
      for (const el of this.elevators) {
        el.floor = el.startFloor ?? el.minFloor ?? 0;
        el.autoDir = 0;
        el.idleT = 0;
        el.dwellTimer = 0;
      }
      if (this.spawnPoints) {
        for (const sp of this.spawnPoints) sp.state = 'idle';
        this.enemies = [];
      }
      this.moleculeTimer = MOLECULE_PERIOD;
      this.blocksShot = 0;
      this.extras = 0;

      this.player.col = (this.tower?.spawn?.col ?? 0) + 0.5;
      this.player.floor = this.tower?.spawn?.floor ?? 0;
      this.player.safeCol = this.player.col;
      this.player.safeFloor = this.player.floor;
    } else {
      if (this.timer <= 0) {
        this.timer = this.timeLimit;
      }
      const mech = this.tower?.mechanics || {};
      const hasSurge = (mech.waterRiseRate || 0) > 0;
      const minWater = (mech.waterBaseFloor ?? -0.55) - (hasSurge ? 0.45 : 0);
      if (hasSurge) {
        this.waterSurgeDelay = 3.2;
      }
      if (this.waterFloor >= this.player.safeFloor - 1.0) {
        this.waterFloor = Math.max(minWater, this.player.safeFloor - 2.4);
      }
      this.player.col = this.player.safeCol;
      this.player.floor = this.player.safeFloor;
    }

    this.player.vx = 0;
    this.player.vy = 0;
    this.player.arc = null;
    this.player.tumbling = false;
    this.player.dropThrough = null;
    this.player.jumpCutEligible = false;
    this.player.stepHopActive = false;
    this.player.doorPhase = null;
    this.player.enteringDoor = 0;
    this.player.hidden = false;
    this.player.onGround = true;
    this.player.onElevator = null;
    this.player.invuln = 2.0;
    this.player.squashX = 1;
    this.player.squashY = 1;
    this.player.landImpact = 0;
    this.player.hurtTimer = 0;
    this.player.coyoteTimer = 0;
    this.player.jumpBufferTimer = 0;
    this.player.knockbackTimer = 0;
    this.player.muzzleFlash = 0;
    this.player.stepUpCooldown = 0;
    this.comboCount = 0;
    this.comboTimer = 0;
    this.stallTimer = 0;
    if (this.spawnPoints) {
      this._updateRealSpawnPoints();
    }
    this.player.landingFloor = this._computeLandingFloor(this.player.col, this.player.floor);
    this._syncHud();
  }

  // --- Tower Topple & Campaign Progression ---

  _triggerTowerTopple() {
    this.mode = 'topple';
    this.topple = { active: true, progress: 0, duration: 2.6 };
    this.towersClearedInRun += 1;

    const parTime = this.tower?.parTime || 35;
    const speedMet = !this.zenMode && this.timer >= parTime;
    const vaultMet = Boolean(this.towerVaultCleared || this.vaultCrackedThisTower || this.towerStarCollected);
    const isRealOrig = this._isRealOriginal();

    const timeBonus = this.zenMode ? 300 : Math.ceil(this.timer) * 10;
    const techniqueBonus =
      this.era === 'original' && (this.tower?.id || 1) >= 2
        ? 10 * Math.max(0, 100 - this.towerHurtCount * 2)
        : 0;
    const extrasBonus = isRealOrig ? Math.min(500, this.extras || 0) * 10 : 0;
    const baseClear = isRealOrig ? 0 : 500;
    const totalBonus = baseClear + timeBonus + techniqueBonus + extrasBonus;

    this.addScore(totalBonus);
    this.addShake(13);
    this.addPopup({
      col: this.player.col,
      floor: this.player.floor + 1.25,
      text: `+${totalBonus}`,
      color: '#fbbf24',
      maxLife: 1.4,
    });

    sound?.towerTopple?.();
    this.input?.haptic?.([30, 40, 60]);

    // Progression & 100-Trophy Evaluation (#107 & #112)
    const isCasualRun = Boolean(this.runType === 'endless_casual' || this.tower?.casual);
    const missionType = this._getCasualMissionType(this.tower);

    this._tryUnlockTrophy('first_topple');
    if (this.zenMode || isCasualRun) {
      this._tryUnlockTrophy('zen_voyager');
    }
    if (!isCasualRun) {
      if (this.towerHurtCount === 0) {
        this._tryUnlockTrophy('storm_ghost');
      }
      if (this.towerShotsFired === 0) {
        this._tryUnlockTrophy('pacifist_climb');
      }
    }

    if (this.runType === 'reboot_campaign' || this.runType === 'original_campaign') {
      const tid = this.tower?.id || 1;
      const singleRunAll8 = Boolean(
        this.era === 'original' &&
          this.runType === 'original_campaign' &&
          this.runStartedFromTower1 &&
          this.towersClearedInRun >= 8 &&
          tid === 8
      );
      const flawlessRunFromT1 = Boolean(
        this.runStartedFromTower1 && this.runHurtTotal === 0 && this.runDeathsTotal === 0
      );

      this.sectorFlawlessPending = Boolean(
        this.era === 'reboot' &&
          (tid === 2 || tid === 4 || tid === 6) &&
          this.towerHurtCount === 0 &&
          vaultMet &&
          speedMet
      );

      const clearRes = this.prog?.recordTowerClear?.({
        era: this.era,
        runType: this.runType,
        zenMode: this.zenMode,
        towerId: tid,
        clear: true,
        vault: vaultMet,
        speed: speedMet,
        hurtCount: this.towerHurtCount,
        shotsFired: this.towerShotsFired,
        pacifist: this.towerShotsFired === 0,
        deathsThisTower: this.towerDeathsHere,
        livesRemaining: this.lives,
        timeRemaining: this.timer,
        parTime,
        boxesShot: this.blocksShot,
        enemiesDestroyed: this.towerEnemiesDestroyed,
        switchesUsed: this.towerSwitchesUsed,
        singleRunAll8,
        flawlessRunFromT1,
        maxCombo: this.maxComboHere || 0,
        touchedWater: this.towerTouchedWater,
      });
      if (clearRes) {
        this.lastClearStars = clearRes.stars;
        this.runStarsEarned += clearRes.stars?.count || 1;
        this._handleProgTrophyReturn(clearRes);
      }

      if (this.era === 'reboot') {
        if (tid === 1) this._tryUnlockTrophy('mist_walker');
        else if (tid >= 2 && tid <= 8) this._tryUnlockTrophy(`clear_reboot_t${tid}`);
        if (tid >= 1 && tid <= 4 && speedMet) this._tryUnlockTrophy(`speed_reboot_t${tid}`);
        if (tid === 2 && !this.towerTouchedWater) this._tryUnlockTrophy('tide_runner');
        if (tid === 4 && !this.towerTouchedWater) this._tryUnlockTrophy('wind_walker');
        if (tid === 5 && vaultMet) this._tryUnlockTrophy('switch_architect');
        if (tid === 6 && this.towerHurtCount === 0) this._tryUnlockTrophy('piston_dancer');
        if (tid === 7 && !this.towerTouchedWater) this._tryUnlockTrophy('blackout_beacon');
        if (tid === 8 && vaultMet) this._tryUnlockTrophy('vault_t8_clear');
      } else {
        if (tid >= 1 && tid <= 8) this._tryUnlockTrophy(`clear_orig_t${tid}`);
        if (tid >= 2 && this.towerHurtCount === 0) this._tryUnlockTrophy('orig_technique_perfect');
        if (singleRunAll8) this._tryUnlockTrophy('immortal_1987');
      }

      // Evaluate multi-tower campaign, sector & capstone trophies
      let speedCount = 0;
      let rebootSpeedCount = 0;
      let allReboot = true;
      let allOrig = true;
      for (let checkId = 1; checkId <= 8; checkId++) {
        const rs = this.prog?.getTowerStars?.('reboot', checkId);
        const os = this.prog?.getTowerStars?.('original', checkId);
        if (rs?.speed) {
          speedCount++;
          rebootSpeedCount++;
        }
        if (os?.speed) speedCount++;
        if (!rs?.clear) allReboot = false;
        if (!os?.clear) allOrig = false;
      }
      if (speedCount >= 3) this._tryUnlockTrophy('speed_demon');
      if (rebootSpeedCount >= 8) this._tryUnlockTrophy('chrono_olympian');
      if (allReboot) this._tryUnlockTrophy('operation_nebulus');
      if (allOrig) this._tryUnlockTrophy('classic_hero');

      const totalStars = this.prog?.getTotalStars?.() || 0;
      const rebootStars = this.prog?.getTotalStars?.('reboot') || 0;
      const rebootMedals = this.prog?.getTotalMedals?.('reboot') || 0;
      if (rebootStars >= 24 && rebootMedals >= 40) {
        this._tryUnlockTrophy('nebulus_sovereign');
      }
      if (totalStars >= 24) {
        const skinIds = [
          'default_amphibian',
          'deep_diver',
          'poison_dart',
          'clockwork_brass',
          'frost_warden',
          'shadow_infiltrator',
          'retro_1987',
          'golden_toppler',
        ];
        const unlockedSkinCount = skinIds.filter((id) => this.prog?.isSkinUnlocked?.(id)).length;
        if (unlockedSkinCount >= 6) {
          this._tryUnlockTrophy('nebulus_legend');
        }
      }
    } else if (this.runType === 'daily' && this.dailyMeta) {
      this.prog?.addGears?.(5);
      this.prog?.recordDailyResult?.({
        dateKey: this.dailyMeta.dateKey,
        score: this.score,
        clearTimeSec: Math.round(this.dailyMeta.elapsedSec * 10) / 10,
        completed: true,
        altitudePct: 100,
      });
      this._tryUnlockTrophy('daily_try');
      this._tryUnlockTrophy('daily_climber');
      if (speedMet) {
        this._tryUnlockTrophy('daily_speed_ace');
      }
      this._flushPendingProgTrophies();
    } else if (this.runType === 'endless_casual') {
      this.endlessDepth += 1;
      const casRes = this.prog?.recordCasualExpedition?.({
        towersCleared: 1,
        depth: this.endlessDepth,
        missionType,
        craftedDynamo: this.dynamoCrafted,
        dynamoCrafted: this.dynamoCrafted,
        chestOpened: this.treasureChestOpened,
        curiosFound: this.curiosCollectedHere,
        score: this.score,
      });
      this._handleProgTrophyReturn(casRes);
      this._emitProgEvent('casual_clear', {
        depth: this.endlessDepth,
        missionType,
        dynamoCrafted: this.dynamoCrafted,
        chestOpened: this.treasureChestOpened,
        curiosFound: this.curiosCollectedHere,
      });
    } else if (this.runType === 'endless') {
      this.endlessDepth += 1;
      this.prog?.addGears?.(3);
      this.prog?.recordEndlessRun?.(this.endlessDepth, this.score);
      if (this.endlessDepth >= 1) this._tryUnlockTrophy('endless_1');
      if (this.endlessDepth >= 3) this._tryUnlockTrophy('endless_3');
      if (this.endlessDepth >= 5) this._tryUnlockTrophy('endless_5');
      if (this.endlessDepth >= 10) this._tryUnlockTrophy('endless_10');
      if (this.endlessDepth >= 15) this._tryUnlockTrophy('abyssal_titan');
      this._flushPendingProgTrophies();
    }

    if (isRealOrig) {
      const parts = [`TIME +${timeBonus}`];
      if ((this.tower?.id || 1) >= 2) parts.push(`TECHNIQUE +${techniqueBonus}`);
      if (extrasBonus > 0) parts.push(`EXTRAS +${extrasBonus}`);
      this.cb.onBanner?.('TOWER TOPPLED!', parts.join(' • '));
    } else if (this.runType === 'endless_casual') {
      const title =
        missionType === 'tower_repair'
          ? 'SUMMIT BEACON IGNITED!'
          : missionType === 'treasure_hunt'
          ? 'EXPEDITION HOARD SECURED!'
          : 'EXPEDITION SECTOR CLEAR!';
      this.cb.onBanner?.(title, `SECTOR ${this.endlessDepth} • +${totalBonus} PTS`);
    } else {
      this.cb.onBanner?.('TOWER TOPPLED!', `+${totalBonus} BONUS`);
    }
    this._syncHud();
  }

  _nextCampaignTransitMode(justFinishedId) {
    if (this.era === 'original') return 'submarine';
    // 4-Sector Archipelago Map (§2 & §3.2.5):
    // T1->T2 & T5->T6: 'submarine'
    // T2->T3, T4->T5, T6->T7 (Sector Summits): 'glide'
    // T3->T4 & T7->T8: 'skimmer'
    if (justFinishedId === 2 || justFinishedId === 4 || justFinishedId === 6) return 'glide';
    if (justFinishedId === 3 || justFinishedId === 7) return 'skimmer';
    return 'submarine';
  }

  _updateTopple(dt) {
    this.topple.progress += dt / this.topple.duration;
    this.shake = Math.max(this.shake, 5.2 * (1 - this.topple.progress));
    if (Math.random() < 0.45) {
      this._spawnParticles(
        (this.renderer?.width || 360) * (0.3 + Math.random() * 0.4),
        (this.renderer?.height || 640) * (0.25 + Math.random() * 0.45),
        this.tower?.palette?.ledge || '#60a5fa',
        4,
        110
      );
    }

    if (this.topple.progress >= 1) {
      if (this.runType === 'daily') {
        this.mode = 'victory';
        this._syncHud();
        this.cb.onGameOver?.(true, this.score, this.hiScore, this._buildGameOverSummary(true));
        return;
      }

      if (this.runType === 'endless_casual') {
        const pool = ['submarine', 'glide', 'skimmer', 'puzzle', 'vault'];
        const choices = pool.filter((m) => m !== this._lastCasualMini);
        const nextMini = choices[Math.floor(Math.random() * choices.length)] || 'glide';
        this._lastCasualMini = nextMini;
        this.startMiniGame(nextMini, false);
        return;
      }

      if (this.runType === 'endless') {
        const cycle = this.era === 'original' ? ['submarine'] : ['submarine', 'glide', 'skimmer'];
        const nextMini = cycle[(Math.max(1, this.endlessDepth) - 1) % cycle.length];
        this.startMiniGame(nextMini, false);
        return;
      }

      // Campaign progression
      if (this.towerIndex >= this.towers.length - 1) {
        if (this.era === 'original') {
          this._tryUnlockTrophy('classic_hero');
        } else {
          this._tryUnlockTrophy('operation_nebulus');
        }
        this.mode = 'victory';
        this._syncHud();
        this.cb.onGameOver?.(true, this.score, this.hiScore, this._buildGameOverSummary(true));
      } else {
        const nextMini = this._nextCampaignTransitMode(this.tower?.id || this.towerIndex + 1);
        this.startMiniGame(nextMini, false);
      }
    }
  }

  _finishTransitionMiniGame() {
    sound?.setWind?.(0);
    if (this.standaloneMiniGame) {
      this.mode = 'victory';
      this._syncHud();
      this.cb.onGameOver?.(true, this.score, this.hiScore, this._buildGameOverSummary(true));
      return;
    }

    if (this.runType === 'endless_casual') {
      const nextT = generateProceduralTower({
        seed: (this.endlessSeed + (this.endlessDepth + 1) * 7919) >>> 0,
        index: this.endlessDepth + 1,
        difficulty: 1 + this.endlessDepth * 0.25,
        era: 'reboot',
        casual: true,
      });
      this.mode = 'tower';
      this.loadTower(nextT);
      return;
    }

    if (this.runType === 'endless') {
      const nextT = generateProceduralTower({
        seed: (this.endlessSeed + (this.endlessDepth + 1) * 7919) >>> 0,
        index: this.endlessDepth + 1,
        difficulty: 1 + this.endlessDepth * 0.45,
        era: this.era,
      });
      this.mode = 'tower';
      this.loadTower(nextT);
      return;
    }

    this.towerIndex += 1;
    this.mode = 'tower';
    this.loadTower(this.towerIndex);
  }

  _buildGameOverSummary(victory) {
    const totalGears = this.prog?.getGears?.() || 0;
    return {
      victory: Boolean(victory),
      era: this.era,
      runType: this.runType,
      zenMode: this.zenMode,
      score: this.score,
      hiScore: this.hiScore,
      stars: this.lastClearStars,
      starsEarned: this.runStarsEarned,
      gearsEarned: Math.max(0, totalGears - (this.runGearsStart || 0)),
      totalGears,
      towersCleared: this.towersClearedInRun,
      towerId: this.tower?.id ?? 1,
      towerName: this.tower?.name ?? '',
    };
  }

  // --- Mini-Game A: MK.7 Sub-Hunter ('submarine') ---

  _initSubmarineStage() {
    this.mode = 'submarine';
    const w = this.renderer?.width || 360;
    const h = this.renderer?.height || 640;
    const isOrig = this.era === 'original';

    const initVents = isOrig
      ? []
      : [
          { x: w * 0.56, y: h - 24, width: 54, phase: 0.4, active: true, boosted: false },
          { x: w * 1.04, y: h - 24, width: 58, phase: 2.1, active: true, boosted: false },
        ];

    const initHiddenCaches = isOrig
      ? []
      : [
          { x: w * 0.68, y: h - 84, vx: -58 },
          { x: w * 1.28, y: h - 92, vx: -58 },
          { x: w * 1.88, y: h - 80, vx: -58 },
        ];

    this.sub = {
      x: w * 0.22,
      y: h * 0.5,
      vx: 0,
      vy: 0,
      timer: 0,
      duration: isOrig ? 14.0 : 18.0,
      sonarPulse: 0,
      sonarCooldown: 0,
      sonarOriginX: w * 0.22,
      sonarOriginY: h * 0.5,
      ventBoostTimer: 0,
      cachesRevealed: 0,
      fishSeq: 0,
      warpCave: {
        x: w + 220,
        y: Math.max(82, h * 0.2),
        active: !isOrig,
        entered: false,
      },
      vents: initVents,
      hiddenCaches: initHiddenCaches,
      shockwaves: [],
      bubbles: [],
      fish: [],
      mines: [],
      spawnTimer: 0.35,
      mineTimer: 2.2,
      ventTimer: 3.6,
      fireCooldown: 0,
      fishCaughtCount: 0,
      minesDestroyed: 0,
    };

    this._handleProgTrophyReturn(this.prog?.recordMiniGamePlayed?.('submarine'));
    sound?.setMiniGameMode?.('submarine');
    this.cb.onBanner?.(
      this.runType === 'endless_casual' ? 'PEACEFUL VOYAGE' : isOrig ? 'BONUS STAGE' : 'ABYSSAL TRANSIT',
      isOrig ? 'MK.7 MINI-SUBMARINE' : 'ABYSSAL MANTA-SUB MK.7'
    );
    this._syncHud();
  }

  _triggerSubSonarPing(s, w, h) {
    s.sonarPulse = 1.0;
    s.sonarCooldown = 3.5;
    s.sonarOriginX = s.x;
    s.sonarOriginY = s.y;
    s.shockwaves.push({ x: s.x, y: s.y, life: 0.85, maxLife: 0.85, maxR: 260, color: '#5efce8' });

    if (typeof sound?.boostGate === 'function') sound.boostGate(2);
    else sound?.bubble?.();
    this.input?.haptic?.([14, 24, 18]);
    this.addShake(2.8);

    // Repel & stun nearby naval mines
    for (const m of s.mines) {
      const dx = m.x - s.x;
      const dy = m.y - s.y;
      const dist = Math.hypot(dx, dy) || 1;
      if (dist < 280) {
        const push = ((280 - dist) / 280) * 115;
        m.x += (dx / dist) * push;
        m.y = Math.max(66, Math.min(h - 62, m.y + (dy / dist) * push * 0.8));
        m.pushVx = (dx / dist) * 145;
        m.frozenTimer = 1.4;
        this._spawnParticles(m.x, m.y, '#67e8f9', 8, 85, 40);
      }
    }

    // Reveal hidden sunken Golden Gear caches within sonar sweep (or materialize trench cache)
    let revealedCount = 0;
    for (let ci = s.hiddenCaches.length - 1; ci >= 0; ci--) {
      const hc = s.hiddenCaches[ci];
      if (hc.x >= 24 && hc.x <= w + 90) {
        const rx = Math.max(54, Math.min(w - 36, hc.x));
        const ry = Math.max(90, Math.min(h - 68, hc.y));
        s.fish.push({
          x: rx,
          y: ry,
          baseY: ry,
          vx: -44,
          color: '#fbbf24',
          waveAmp: 0,
          phase: 0,
          species: 0,
          bubbled: true,
          caught: false,
          isGear: true,
          isSonarCache: true,
        });
        this._spawnParticles(rx, ry, '#fde047', 16, 115, 60);
        this.addPopup({
          x: rx,
          y: ry - 18,
          text: '◈ SONAR CACHE!',
          color: '#fde047',
          maxLife: 1.25,
        });
        s.hiddenCaches.splice(ci, 1);
        s.cachesRevealed = (s.cachesRevealed || 0) + 1;
        revealedCount++;
      }
    }

    if (revealedCount === 0 && (s.cachesRevealed || 0) < 3) {
      const rx = Math.max(70, Math.min(w - 44, s.x + 135));
      const ry = Math.max(110, h - 82);
      s.fish.push({
        x: rx,
        y: ry,
        baseY: ry,
        vx: -44,
        color: '#fbbf24',
        waveAmp: 0,
        phase: 0,
        species: 0,
        bubbled: true,
        caught: false,
        isGear: true,
        isSonarCache: true,
      });
      this._spawnParticles(rx, ry, '#fde047', 16, 115, 60);
      this.addPopup({
        x: rx,
        y: ry - 18,
        text: '◈ SONAR CACHE!',
        color: '#fde047',
        maxLife: 1.25,
      });
      s.cachesRevealed = (s.cachesRevealed || 0) + 1;
    }
  }

  _updateSubmarine(dt) {
    const s = this.sub;
    const inp = this.input.state;
    const w = this.renderer?.width || 360;
    const h = this.renderer?.height || 640;
    const isOrig = this.era === 'original';
    const isCasual = this.runType === 'endless_casual';

    s.timer += dt;
    if (s.timer >= s.duration) {
      this._tryUnlockTrophy('sub_novice');
      this._emitProgEvent('sub_complete', {
        era: this.era,
        fishCaught: s.fishCaughtCount || 0,
        minesDestroyed: s.minesDestroyed || 0,
        warpEntered: Boolean(s.warpCave?.entered),
        score: this.score,
      });
      this._finishTransitionMiniGame();
      return;
    }

    if (s.sonarPulse > 0) {
      s.sonarPulse = Math.max(0, s.sonarPulse - dt * 1.12);
    }
    if (s.sonarCooldown > 0) {
      s.sonarCooldown = Math.max(0, s.sonarCooldown - dt);
    }
    if (s.ventBoostTimer > 0) {
      s.ventBoostTimer = Math.max(0, s.ventBoostTimer - dt);
    }
    for (let si = (s.shockwaves?.length || 0) - 1; si >= 0; si--) {
      const sw = s.shockwaves[si];
      sw.life -= dt;
      if (sw.life <= 0) s.shockwaves.splice(si, 1);
    }

    const baseSpeed = !isOrig && s.ventBoostTimer > 0 ? 285 : 205;
    const ax = Math.abs(inp.analogX || 0) > 0.05 ? inp.analogX : (inp.right ? 1 : 0) - (inp.left ? 1 : 0);
    const ay = Math.abs(inp.analogY || 0) > 0.05 ? inp.analogY : (inp.down ? 1 : 0) - (inp.up ? 1 : 0);
    s.vx = approach(s.vx, ax * baseSpeed + (!isOrig && s.ventBoostTimer > 0 ? 75 : 0), 900 * dt);
    s.vy = approach(s.vy, ay * baseSpeed, 900 * dt);

    // Reboot Hydrothermal Bubble Vents (`sub.vents = [{ x, width }]`)
    if (!isOrig) {
      s.ventTimer = (s.ventTimer ?? 3.4) - dt;
      if (s.ventTimer <= 0) {
        s.ventTimer = 3.5 + Math.random() * 1.4;
        s.vents.push({
          x: w + 60,
          y: h - 24,
          width: 50 + Math.random() * 16,
          phase: Math.random() * Math.PI * 2,
          active: true,
          boosted: false,
        });
      }

      for (let vi = s.vents.length - 1; vi >= 0; vi--) {
        const v = s.vents[vi];
        v.x -= 92 * dt;
        const inColumn = Math.abs(s.x - v.x) < v.width * 0.62 && s.y > h * 0.22;
        if (inColumn) {
          s.vy -= 430 * dt;
          s.vx += 290 * dt;
          s.ventBoostTimer = 0.36;
          if (Math.random() < 0.65) {
            const life = 0.34 + Math.random() * 0.22;
            this.particles.push({
              x: s.x - 18 + (Math.random() - 0.5) * 14,
              y: s.y + 8 + (Math.random() - 0.5) * 10,
              vx: -(65 + Math.random() * 55),
              vy: -(95 + Math.random() * 75),
              gravity: -40,
              size: 3 + Math.random() * 3,
              color: Math.random() < 0.5 ? '#a5f3fc' : '#5efce8',
              life,
              maxLife: life,
            });
          }
          if (!v.boosted) {
            v.boosted = true;
            this.addScore(100);
            sound?.bubble?.();
            this.input?.haptic?.(14);
            this.addPopup({
              x: s.x,
              y: s.y - 24,
              text: '▲ VENT BOOST! +100',
              color: '#67e8f9',
              maxLife: 1.05,
            });
          }
        }
        if (v.x < -(v.width || 60) - 40) {
          s.vents.splice(vi, 1);
        }
      }

      for (let ci = s.hiddenCaches.length - 1; ci >= 0; ci--) {
        const hc = s.hiddenCaches[ci];
        hc.x += (hc.vx || -58) * dt;
        if (hc.x < -50) s.hiddenCaches.splice(ci, 1);
      }
    }

    s.x = Math.max(38, Math.min(w - 42, s.x + s.vx * dt));
    s.y = Math.max(58, Math.min(h - 56, s.y + s.vy * dt));

    if (s.fireCooldown > 0) s.fireCooldown -= dt;

    if (isOrig) {
      // 1987 Classic rule: strictly 1 active stun bubble at a time, zero mines/vents/sonar!
      const fireOrig = this.input.consumeJustPressed('fire') || this.input.consumeJustPressed('jump');
      if (fireOrig && s.bubbles.length === 0) {
        s.fireCooldown = 0.22;
        s.bubbles.push({ x: s.x + 28, startX: s.x + 28, y: s.y, vx: 285, isTorpedo: false });
        sound?.bubble?.();
      }
    } else {
      // 2026 Reboot Manta-Sub: FIRE = Cryo-Encase Torpedoes; JUMP = Abyssal Sonar Ping (3.5s CD)
      const firePressed = this.input.consumeJustPressed('fire');
      const sonarPressed = this.input.consumeJustPressed('jump');
      if (firePressed && s.fireCooldown <= 0) {
        s.fireCooldown = 0.2;
        s.bubbles.push({
          x: s.x + 30,
          startX: s.x + 30,
          y: s.y + 4,
          vx: 345,
          isTorpedo: true,
          fxId: this.blasterFxId || 'standard_cryo',
        });
        sound?.bubble?.();
      }
      if (sonarPressed && s.sonarCooldown <= 0) {
        this._triggerSubSonarPing(s, w, h);
      }
    }

    s.spawnTimer -= dt;
    if (s.spawnTimer <= 0) {
      s.spawnTimer = isOrig ? 0.46 + Math.random() * 0.32 : 0.36 + Math.random() * 0.28;
      const colors = ['#5efce8', '#f472b6', '#4ade80', '#fbbf24'];
      const color = colors[Math.floor(Math.random() * colors.length)];
      const isGear = !isOrig && Math.random() < (isCasual ? 0.28 : 0.18);
      const baseY = 70 + Math.random() * Math.max(80, h - 145);
      const species = (s.fishSeq = (s.fishSeq || 0) + 1) % 2;
      s.fish.push({
        x: w + 32,
        y: baseY,
        baseY,
        vx: -(82 + Math.random() * 72),
        color: isGear ? '#fbbf24' : color,
        waveAmp: color === '#f472b6' || species === 1 ? 22 : 0,
        phase: Math.random() * Math.PI * 2,
        species,
        modelIdx: species,
        bubbled: false,
        caught: false,
        isGear,
      });
    }

    if (!isOrig) {
      if (!isCasual) {
        s.mineTimer -= dt;
        if (s.mineTimer <= 0) {
          s.mineTimer = 2.6 + Math.random() * 1.4;
          s.mines.push({
            x: w + 36,
            y: 85 + Math.random() * Math.max(80, h - 170),
            vx: -(68 + Math.random() * 38),
            pushVx: 0,
            frozenTimer: 0,
            hp: 1,
            phase: Math.random() * Math.PI * 2,
          });
        }
      }

      if (s.warpCave.active && !s.warpCave.entered && s.timer >= 9.8) {
        s.warpCave.x -= 95 * dt;
        if (Math.hypot(s.x - s.warpCave.x, s.y - s.warpCave.y) < 46) {
          s.warpCave.entered = true;
          s.warpCave.active = false;
          this.prog?.addGears?.(5);
          this._flushPendingProgTrophies();
          this.addScore(500);
          this.nextTowerShield = true;
          this.nextTowerWarpFloors = 2;
          sound?.collectStar?.();
          this._tryUnlockTrophy('warp_finder');
          this.addPopup({
            x: s.x,
            y: s.y - 22,
            text: 'WARP CAVE! +5 GEARS & SHIELD',
            color: '#5efce8',
            maxLife: 1.4,
          });
        }
      }
    }

    // Update Cryo-Torpedoes / Classic Stun Bubble
    for (let i = s.bubbles.length - 1; i >= 0; i--) {
      const b = s.bubbles[i];
      b.x += b.vx * dt;
      const maxRange = isOrig ? Math.min(w * 0.72, 360) : Infinity;
      if (b.x > w + 28 || (isOrig && b.x - (b.startX ?? 0) > maxRange)) {
        s.bubbles.splice(i, 1);
        continue;
      }

      let consumed = false;
      for (const f of s.fish) {
        if (!f.caught && !f.bubbled && Math.hypot(b.x - f.x, b.y - f.y) < 26) {
          f.bubbled = true;
          f.vx *= 0.35;
          consumed = true;
          sound?.stunEnemy?.();
          this._spawnParticles(f.x, f.y, '#67e8f9', 6, 70, 30);
          break;
        }
      }

      if (!consumed && !isOrig) {
        for (let mi = s.mines.length - 1; mi >= 0; mi--) {
          const m = s.mines[mi];
          if (Math.hypot(b.x - m.x, b.y - m.y) < 28) {
            consumed = true;
            m.hp = (m.hp ?? 1) - 1;
            if (m.hp <= 0) {
              s.minesDestroyed = (s.minesDestroyed || 0) + 1;
              s.shockwaves.push({ x: m.x, y: m.y, life: 0.55, maxLife: 0.55, maxR: 92, color: '#67e8f9' });
              this.prog?.addGears?.(1);
              this._tryUnlockTrophy('sub_mine_sweeper');
              this._scoreActionHit(150, { x: m.x, y: m.y - 14 }, '#fbbf24');
              this._spawnParticles(m.x, m.y, '#67e8f9', 14, 135, 65);
              this._spawnParticles(m.x, m.y, '#fb923c', 10, 110, 90);
              this.addShake(4.5);
              sound?.hitEnemy?.();
              s.mines.splice(mi, 1);
            } else {
              sound?.stunEnemy?.();
            }
            break;
          }
        }
      }

      if (consumed) {
        s.bubbles.splice(i, 1);
      }
    }

    // Update mines (Reboot only)
    for (let i = s.mines.length - 1; i >= 0; i--) {
      const m = s.mines[i];
      if (m.frozenTimer > 0) m.frozenTimer = Math.max(0, m.frozenTimer - dt);
      if (m.pushVx) {
        m.x += m.pushVx * dt;
        m.pushVx *= Math.exp(-5 * dt);
        if (Math.abs(m.pushVx) < 2) m.pushVx = 0;
      }
      m.x += m.vx * (m.frozenTimer > 0 ? 0.25 : 1) * dt;
      m.y += Math.sin(this.time * 2.5 + m.phase) * 14 * dt;
      if (m.frozenTimer <= 0 && Math.hypot(s.x - m.x, s.y - m.y) < 32) {
        this.comboCount = 0;
        this.comboTimer = 0;
        this.addShake(8);
        sound?.hurt?.();
        this.input?.haptic?.(35);
        this._spawnParticles(m.x, m.y, '#fb7185', 12, 110);
        s.mines.splice(i, 1);
        continue;
      }
      if (m.x < -45 || m.x > w + 140) s.mines.splice(i, 1);
    }

    // Update fish & hull-collect ONLY bubbled ones
    for (let i = s.fish.length - 1; i >= 0; i--) {
      const f = s.fish[i];
      f.x += f.vx * dt;
      if (!f.bubbled && f.waveAmp) {
        f.y = f.baseY + Math.sin(this.time * 4 + f.phase) * f.waveAmp;
      }
      if (f.bubbled) {
        f.y -= (f.isSonarCache ? 16 : 22) * dt;
        if (Math.hypot(s.x - f.x, s.y - f.y) < 36) {
          f.caught = true;
          if (f.isGear) {
            const gearAmt = f.isSonarCache ? 2 : 1;
            const scoreAmt = f.isSonarCache ? 300 : 150;
            this.prog?.addGears?.(gearAmt);
            this._flushPendingProgTrophies();
            this.addScore(scoreAmt);
            sound?.collectGear?.();
            this.addPopup({
              x: f.x,
              y: f.y - 12,
              text: f.isSonarCache ? `+2 GEARS! +${scoreAmt}` : '+1 GEAR',
              color: '#fbbf24',
            });
          } else {
            s.fishCaughtCount += 1;
            const pts = isOrig ? 50 : 250;
            this._scoreActionHit(pts, { x: f.x, y: f.y - 12 }, '#4ade80');
            sound?.catchFish?.();
            if (s.fishCaughtCount >= 10) {
              this._tryUnlockTrophy('sub_ace');
            }
          }
          this._spawnParticles(f.x, f.y, f.isGear ? '#fde047' : '#a5f3fc', 10, 90);
          s.fish.splice(i, 1);
          continue;
        }
      }
      if (f.x < -45 || f.y < 24) {
        s.fish.splice(i, 1);
      }
    }

    this._syncHud();
  }

  // --- Mini-Game B: Hydro-Skimmer Run ('skimmer') ---

  _initSkimmerStage() {
    this.mode = 'skimmer';
    this.skimmer = {
      laneX: 0,
      vx: 0,
      y: 0,
      vy: 0,
      onWater: true,
      speed: 18,
      boostMult: 1,
      maxBoost: 1,
      boostTimer: 0,
      distance: 0,
      timer: 0,
      duration: 18.0,
      gates: [],
      ramps: [],
      hazards: [],
      gears: [],
      bolts: [],
      fireCooldown: 0,
      spawnCursor: 12,
      lastLane: 0,
      rampsUsed: 0,
      cratesDestroyed: 0,
    };

    for (let z = 14; z <= 46; z += 11) {
      this._spawnSkimmerRow(z);
    }
    this.skimmer.spawnCursor = 46;

    this._handleProgTrophyReturn(this.prog?.recordMiniGamePlayed?.('skimmer'));
    sound?.setMiniGameMode?.('skimmer');
    this.cb.onBanner?.(
      this.runType === 'endless_casual' ? 'PEACEFUL SPRINT' : 'TRANSIT SPRINT',
      'HYDRO-SKIMMER RUN'
    );
    this._syncHud();
  }

  _spawnSkimmerRow(zAhead) {
    const sk = this.skimmer;
    const isCasual = this.runType === 'endless_casual';
    const rawLane = (Math.random() * 2 - 1) * 2.5;
    const prevLane = sk.lastLane ?? 0;
    const lane = Math.max(-2.5, Math.min(2.5, Math.max(prevLane - 2.6, Math.min(prevLane + 2.6, rawLane))));
    sk.lastLane = lane;
    const roll = Math.random();
    if (roll < 0.44) {
      sk.gates.push({ z: zAhead, laneX: lane, width: 1.45, hit: false });
      sk.hazards.push({
        z: zAhead + 4.5,
        laneX: Math.max(-3.1, Math.min(3.1, -lane * 0.85)),
        type: isCasual ? 'crate' : Math.random() < 0.5 ? 'mine' : 'crate',
        hp: 1,
      });
    } else if (roll < 0.72) {
      sk.ramps.push({ z: zAhead, laneX: lane, width: 1.35, used: false });
      for (let g = 0; g < 3; g++) {
        sk.gears.push({
          z: zAhead + 3.0 + g * 2.2,
          laneX: lane,
          y: 1.5 + Math.sin((g / 2) * Math.PI) * 0.65,
          collected: false,
        });
      }
    } else {
      if (!isCasual || Math.random() < 0.65) {
        sk.hazards.push({
          z: zAhead,
          laneX: lane,
          type: isCasual ? 'crate' : Math.random() < 0.55 ? 'crate' : 'rock',
          hp: 1,
        });
      }
      sk.gears.push({
        z: zAhead + 2.5,
        laneX: Math.max(-3.0, Math.min(3.0, -lane)),
        y: 0.35,
        collected: false,
      });
    }
  }

  _updateSkimmer(dt) {
    const sk = this.skimmer;
    const inp = this.input.state;
    const isCasual = this.runType === 'endless_casual';

    sk.timer += dt;
    if (sk.timer >= sk.duration) {
      this.nextTowerTimeBonus = sk.boostMult * 3;
      this._tryUnlockTrophy('skimmer_novice');
      this._emitProgEvent('skimmer_complete', {
        maxBoost: sk.maxBoost || sk.boostMult || 1,
        rampsUsed: sk.rampsUsed || 0,
        cratesDestroyed: sk.cratesDestroyed || 0,
        score: this.score,
      });
      this._finishTransitionMiniGame();
      return;
    }

    if (sk.boostTimer > 0) {
      sk.boostTimer = Math.max(0, sk.boostTimer - dt);
      if (sk.boostTimer <= 0 && sk.boostMult > 1) {
        sk.boostMult = Math.max(1, sk.boostMult - 1);
        sk.boostTimer = sk.boostMult > 1 ? 4.0 : 0;
      }
    }

    sk.speed = 18 + (sk.boostMult - 1) * 3.6;
    const dz = sk.speed * dt;
    sk.distance += dz;

    const steer =
      Math.abs(inp.analogX || 0) > 0.05
        ? inp.analogX
        : (inp.right ? 1 : 0) - (inp.left ? 1 : 0);
    sk.vx = approach(sk.vx, steer * 8.2, 34 * dt);
    sk.laneX = Math.max(-3.5, Math.min(3.5, sk.laneX + sk.vx * dt));

    if (this.input.consumeJustPressed('jump') && sk.onWater) {
      sk.vy = 8.2;
      sk.onWater = false;
      sound?.jump?.();
    }

    if (!sk.onWater) {
      sk.vy -= 22.5 * dt;
      sk.y += sk.vy * dt;
      if (sk.y <= 0) {
        sk.y = 0;
        sk.vy = 0;
        sk.onWater = true;
        sound?.land?.(0.45);
      }
    }

    if (sk.fireCooldown > 0) sk.fireCooldown -= dt;
    if (this.input.consumeJustPressed('fire') && sk.fireCooldown <= 0) {
      sk.fireCooldown = 0.24;
      sk.bolts.push({ z: 1.0, laneX: sk.laneX, y: sk.y + 0.35 });
      sound?.snowball?.();
    }

    sk.spawnCursor -= dz;
    while (sk.spawnCursor < 46) {
      sk.spawnCursor += 10.5;
      this._spawnSkimmerRow(sk.spawnCursor);
    }

    for (let i = sk.bolts.length - 1; i >= 0; i--) {
      const b = sk.bolts[i];
      b.z += 36 * dt;
      if (b.z > 52) {
        sk.bolts.splice(i, 1);
        continue;
      }
      for (let hi = sk.hazards.length - 1; hi >= 0; hi--) {
        const h = sk.hazards[hi];
        if (Math.abs(b.z - h.z) < 1.3 && Math.abs(b.laneX - h.laneX) < 0.85) {
          if (h.type === 'crate') {
            sk.cratesDestroyed = (sk.cratesDestroyed || 0) + 1;
            this.prog?.addGears?.(1);
            this._tryUnlockTrophy('skimmer_crate_buster');
            this.addScore(100 * sk.boostMult);
            if (typeof sound?.hitBlock === 'function') sound.hitBlock();
            else sound?.hitEnemy?.();
            sk.hazards.splice(hi, 1);
          } else {
            if (typeof sound?.deflect === 'function') sound.deflect();
            else sound?.stunEnemy?.();
          }
          sk.bolts.splice(i, 1);
          break;
        }
      }
    }

    for (let i = sk.gates.length - 1; i >= 0; i--) {
      const g = sk.gates[i];
      g.z -= dz;
      if (!g.hit && Math.abs(g.z) < 1.0 && Math.abs(sk.laneX - g.laneX) < g.width * 0.65) {
        g.hit = true;
        sk.boostMult = Math.min(4, sk.boostMult + 1);
        sk.maxBoost = Math.max(sk.maxBoost || 1, sk.boostMult);
        sk.boostTimer = 5.8;
        this.addScore(150 * sk.boostMult);
        sound?.boostGate?.(sk.boostMult);
        this.input?.haptic?.(18);
        if (sk.boostMult >= 4) {
          this._tryUnlockTrophy('skimmer_pro');
        }
      }
      if (g.z < -6) sk.gates.splice(i, 1);
    }

    for (let i = sk.ramps.length - 1; i >= 0; i--) {
      const r = sk.ramps[i];
      r.z -= dz;
      if (!r.used && Math.abs(r.z) < 1.0 && Math.abs(sk.laneX - r.laneX) < r.width * 0.65 && sk.y < 0.7) {
        r.used = true;
        sk.rampsUsed = (sk.rampsUsed || 0) + 1;
        sk.vy = 10.6;
        sk.onWater = false;
        sound?.jump?.();
        this.input?.haptic?.(20);
        this._tryUnlockTrophy('skimmer_ramp_air');
      }
      if (r.z < -6) sk.ramps.splice(i, 1);
    }

    for (let i = sk.gears.length - 1; i >= 0; i--) {
      const g = sk.gears[i];
      g.z -= dz;
      if (
        !g.collected &&
        Math.abs(g.z) < 1.05 &&
        Math.abs(sk.laneX - g.laneX) < 0.85 &&
        Math.abs(sk.y - g.y) < 1.1
      ) {
        g.collected = true;
        this.prog?.addGears?.(1);
        this._flushPendingProgTrophies();
        this.addScore(125 * sk.boostMult);
        sound?.collectGear?.();
      }
      if (g.z < -6 || g.collected) sk.gears.splice(i, 1);
    }

    for (let i = sk.hazards.length - 1; i >= 0; i--) {
      const h = sk.hazards[i];
      h.z -= dz;
      const hitHeight = h.type === 'rock' ? 1.35 : 0.85;
      if (Math.abs(h.z) < 0.9 && Math.abs(sk.laneX - h.laneX) < 0.75 && sk.y < hitHeight) {
        if (isCasual) {
          this.addScore(50);
          if (typeof sound?.hitBlock === 'function') sound.hitBlock();
          sk.hazards.splice(i, 1);
          continue;
        }
        sk.boostMult = 1;
        sk.boostTimer = 0;
        this.addShake(7.5);
        sound?.hurt?.();
        this.input?.haptic?.(40);
        sk.hazards.splice(i, 1);
        continue;
      }
      if (h.z < -6) sk.hazards.splice(i, 1);
    }

    this._syncHud();
  }

  // --- Mini-Game C: The Glide ('glide' — Sector Summit Sky-Wing) ---

  _initGlideStage() {
    this.mode = 'glide';
    this.glideGoldenOrChain4 = false;
    this._glideThermalUnlockedHere = false;
    this.glideStage = new GlideStage();

    const w = this.renderer?.width || 390;
    const h = this.renderer?.height || 640;
    const isCasual = this.runType === 'endless_casual';
    const nextT =
      !this.standaloneMiniGame && this.runType !== 'endless' && !isCasual
        ? this.towers?.[this.towerIndex + 1]
        : null;
    // GLIDE_THEMES[0] = 'moonlit_storm' (T2->T3), [1] = 'aurora' (T4->T5), [2] = 'storm' (T6->T7)
    const sectorIdx = this.standaloneMiniGame
      ? 0
      : Math.max(0, Math.min(2, Math.floor(((this.tower?.id || 2) - 1) / 2)));
    const casualThemes = ['dawn', 'aurora', 'moonlit_storm', 'day'];
    const casualTheme = casualThemes[(this.endlessDepth || 0) % casualThemes.length];

    this.glideStage.start({
      width: w,
      height: h,
      worldIndex: sectorIdx,
      themeKey: this.standaloneMiniGame ? 'moonlit_storm' : isCasual ? casualTheme : null,
      standalone: Boolean(this.standaloneMiniGame),
      nextWorldName: isCasual
        ? `EXPEDITION SECTOR ${this.endlessDepth + 1}`
        : nextT?.name || 'NEXT SECTOR MONOLITH',
      nextGlow: nextT?.palette?.glow || '#5efce8',
      fromGlow: this.tower?.palette?.glow || '#5efce8',
      healing: isCasual ? 1 : Math.min(1, (this.tower?.id || 2) / 8),
    });

    this._handleProgTrophyReturn(this.prog?.recordMiniGamePlayed?.('glide'));
    sound?.setMiniGameMode?.('glide');
    this._syncHud();
  }

  _updateGlide(dt) {
    const st = this.glideStage;
    if (!st) {
      this._finishTransitionMiniGame();
      return;
    }

    const w = this.renderer?.width || 390;
    const h = this.renderer?.height || 640;
    if (st.width !== w || st.height !== h) {
      st.resize?.(w, h);
    }

    const firePressed = this.input.consumeJustPressed('fire') || this.input.consumeJustPressed('jump');
    const fx = {
      addScore: (pts) => this.addScore(pts),
      addGears: (g) => {
        this.prog?.addGears?.(g);
        this._flushPendingProgTrophies();
        this.glideGoldenOrChain4 = true;
        sound?.collectGear?.();
      },
      popup: (x, y, text, color) => this.addPopup({ x, y, text, color }),
      particles: (x, y, color, count, spd) => this._spawnParticles(x, y, color, count, spd),
      shake: (a) => this.addShake(a),
      haptic: (p) => this.input?.haptic?.(p),
      banner: (sub, title) => this.cb.onBanner?.(sub, title),
      sound,
    };

    const done = st.update(dt, this.input.state, firePressed, fx);
    if (
      (st.goldCaught || 0) > 0 ||
      Boolean(st.hitFourGateChain) ||
      (st.maxGateChain || 0) >= 4 ||
      (st.gateChain || 0) >= 4
    ) {
      this.glideGoldenOrChain4 = true;
    }
    if (!this._glideThermalUnlockedHere && (st.thermalTime || 0) > 0.15) {
      this._glideThermalUnlockedHere = true;
      this._tryUnlockTrophy('glide_thermal');
    }

    this._syncHud();
    if (done) {
      sound?.setWind?.(0);
      this._tryUnlockTrophy('glide_novice');
      if (this.glideGoldenOrChain4) {
        this._tryUnlockTrophy('sky_rider');
      }
      if (
        this.sectorFlawlessPending &&
        (this.glideGoldenOrChain4 || Boolean(st.perfect) || (st.lanternsCaught || 0) >= 4)
      ) {
        this._tryUnlockTrophy('flawless_sector');
      }
      this.sectorFlawlessPending = false;
      this._emitProgEvent('glide_complete', {
        lanternsCaught: st.lanternsCaught || 0,
        kites: st.kites || 0,
        goldCaught: st.goldCaught || 0,
        gatesPassed: st.gatesPassed || 0,
        maxGateChain: st.maxGateChain || 0,
        perfect: Boolean(st.perfect),
        hits: st.hits || 0,
        thermalTime: st.thermalTime || 0,
      });
      this.glideStage = null;
      this._finishTransitionMiniGame();
    }
  }

  // --- Mini-Game D: Rune-Door Secret Chambers ('puzzle') ---

  _enterPuzzleRoom(door) {
    this.standaloneMiniGame = false;
    this._initPuzzleStage(door);
  }

  _initPuzzleStage(door = null) {
    this.puzzleDoor = door;
    this.mode = 'puzzle';
    this.particles = [];
    this.popups = [];
    this.shake = 0;

    let puz = door ? this.puzzleData : null;
    if (!door || !puz) {
      this._standalonePuzzleIdx = ((this._standalonePuzzleIdx ?? -1) + 1) % PUZZLE_TYPES.length;
      const pType = door?.puzzleType || PUZZLE_TYPES[this._standalonePuzzleIdx] || 'lights';
      const pSeed = door?.puzzleSeed || (((Date.now() >>> 0) % 90000) + 1000);
      puz = makePuzzle({
        type: pType,
        seed: pSeed,
        difficulty: this.runType === 'endless_casual' ? 0.3 : 0.4,
        hideTarget: Boolean(door && (pType === 'lights' || pType === 'bells') && this.tower?.clue),
      });
    }

    this.puzzleRoom = new PuzzleRoom();
    this.puzzleRoom.start({
      width: this.renderer?.width || 390,
      height: this.renderer?.height || 640,
      puzzle: puz,
      worldIndex: Math.floor(((this.tower?.id || 1) - 1) / 2),
      palette: this.tower?.palette,
    });

    this._handleProgTrophyReturn(this.prog?.recordMiniGamePlayed?.('puzzle'));
    sound?.setMiniGameMode?.('puzzle');
    if (typeof sound?.puzzleEnter === 'function') sound.puzzleEnter();
    else sound?.door?.();
    this._syncHud();
  }

  _updatePuzzle(dt) {
    const room = this.puzzleRoom;
    if (!room) {
      this._leavePuzzleRoom();
      return;
    }

    const w = this.renderer?.width || 390;
    const h = this.renderer?.height || 640;
    if (room.width !== w || room.height !== h) {
      room.resize?.(w, h);
    }

    const firePressed = this.input.consumeJustPressed('fire') || this.input.consumeJustPressed('jump');
    const fx = {
      addScore: (pts) => this.addScore(pts),
      addGears: (g) => {
        this.prog?.addGears?.(g);
        this._flushPendingProgTrophies();
        sound?.collectGear?.();
      },
      popup: (x, y, text, color) => this.addPopup({ x, y, text, color }),
      particles: (x, y, color, count, spd) => this._spawnParticles(x, y, color, count, spd),
      shake: (a) => this.addShake(a),
      haptic: (p) => this.input?.haptic?.(p),
      banner: (sub, title) => this.cb.onBanner?.(sub, title),
      sound,
    };

    const done = room.update(dt, this.input.state, firePressed, fx);
    this._syncHud();
    if (done) {
      this._leavePuzzleRoom();
    }
  }

  _leavePuzzleRoom() {
    const room = this.puzzleRoom;
    const door = this.puzzleDoor;
    const solved = Boolean(room?.solved);
    const pType = room?.puzzleType || room?.type || room?.puzzle?.type || door?.puzzleType || 'lights';

    if (typeof sound?.puzzleLeave === 'function') sound.puzzleLeave();
    else sound?.door?.();

    if (solved) {
      this._tryUnlockTrophy('rune_scholar');
      if (pType === 'lights') this._tryUnlockTrophy('rune_lights_clear');
      else if (pType === 'bells') this._tryUnlockTrophy('rune_bells_clear');
      else if (pType === 'beam') this._tryUnlockTrophy('rune_beam_clear');
      else if (pType === 'blocks') this._tryUnlockTrophy('rune_blocks_clear');
    }
    this._emitProgEvent('puzzle_complete', {
      solved,
      puzzleType: pType,
      moves: room?.moves || 0,
      undos: room?.undos || 0,
      timeSec: room?.timeSec || 0,
    });

    if (this.standaloneMiniGame) {
      if (solved) {
        this.prog?.addGears?.(10);
        this._flushPendingProgTrophies();
        this.addScore(1500);
      }
      this.puzzleRoom = null;
      this.puzzleDoor = null;
      this.mode = solved ? 'victory' : 'gameover';
      this._syncHud();
      this.cb.onGameOver?.(solved, this.score, this.hiScore, this._buildGameOverSummary(solved));
      return;
    }

    // Inter-tower Casual Expedition Rune Chamber transition (`door === null`)
    if (!door) {
      if (solved) {
        this.prog?.addGears?.(10);
        this._flushPendingProgTrophies();
        this.addScore(1500);
      }
      this.puzzleRoom = null;
      this.puzzleDoor = null;
      this._finishTransitionMiniGame();
      return;
    }

    if (solved && !door.solved) {
      door.solved = true;
      this.towerVaultCleared = true;
      this.vaultCrackedThisTower = true;
      this.timer = Math.min((this.timeLimit || this.tower?.timeLimit || 95) + 15, this.timer + 15);
      this.prog?.addGears?.(10);
      this._tryUnlockTrophy('first_star_core');
      this._flushPendingProgTrophies();
      this.addScore(1500);
      this.player.shield = true;
      this.cb.onBanner?.('RUNE CHAMBER SOLVED!', '★ STAR CORE • +10 GEARS • +15s');
    }

    this.puzzleRoom = null;
    this.puzzleDoor = null;
    this.mode = 'tower';
    this.input?.consumeJustPressed?.('jump');
    this.input?.consumeJustPressed?.('up');

    this.player.col = wrapCol(door.col + 0.5);
    this.player.floor = door.floor;
    this.player.onGround = true;
    this.player.vx = 0;
    this.player.vy = 0;
    this.player.invuln = 1.8;
    this.player.landingFloor = this._computeLandingFloor(this.player.col, this.player.floor);

    sound?.setMiniGameMode?.(null);
    sound?.setTowerTheme?.(this.tower?.id || 1, this.tower?.theme || 'mist');
    this._syncHud();
  }

  // --- Mini-Game E: Core Lock Vault ('vault') ---

  _initVaultStage() {
    this.mode = 'vault';
    const isCasual = this.runType === 'endless_casual';
    this.vault = {
      activeRing: 0,
      strikes: 0,
      maxStrikes: isCasual ? 5 : 3,
      timer: isCasual ? 15.0 : 12.0,
      duration: isCasual ? 15.0 : 12.0,
      status: 'playing',
      statusTimer: 0,
      rings: this._createVaultRings(),
    };

    this._handleProgTrophyReturn(this.prog?.recordMiniGamePlayed?.('vault'));
    sound?.setMiniGameMode?.('vault');
    this.cb.onBanner?.('ANCIENT CHAMBER', 'CORE LOCK VAULT');
    this._syncHud();
  }

  _updateVault(dt) {
    const v = this.vault;

    if (v.status === 'playing') {
      v.timer = Math.max(0, v.timer - dt);
      for (const r of v.rings) {
        if (!r.locked) {
          r.angle = (((r.angle + r.speed * dt) % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
        }
      }

      if (this.input.consumeJustPressed('fire') || this.input.consumeJustPressed('jump')) {
        const ring = v.rings[v.activeRing];
        if (ring) {
          const diff = Math.abs(wrapAngleRad(ring.angle - ring.targetAngle));
          if (diff <= ring.tolerance) {
            ring.angle = ring.targetAngle;
            ring.locked = true;
            v.activeRing += 1;
            sound?.vaultTick?.(true);
            this.input?.haptic?.(18);
            this._tryUnlockTrophy('vault_novice');
            this._emitProgEvent('vault_ring_lock', { ringIndex: v.activeRing });

            if (v.activeRing >= v.rings.length) {
              v.status = 'won';
              v.statusTimer = 1.35;
              this.addShake(6);
              this.addScore(1000);
              this.prog?.addGears?.(10);
              sound?.vaultUnlock?.();
              if (v.strikes === 0) {
                this._tryUnlockTrophy('vault_cracker');
              }
              if (!this.standaloneMiniGame && this.vaultReturnState) {
                this.towerVaultCleared = true;
                this.vaultCrackedThisTower = true;
                this.player.shield = true;
                this._tryUnlockTrophy('first_star_core');
                if (this.era === 'reboot' && this.tower?.id === 8) {
                  this._tryUnlockTrophy('vault_t8_clear');
                }
              }
              this._emitProgEvent('vault_complete', {
                won: true,
                strikes: v.strikes,
                ringsLocked: v.activeRing,
                timeRemaining: v.timer,
              });
              this._flushPendingProgTrophies();
              this.cb.onBanner?.('VAULT CRACKED!', '★ STAR CORE + 10 GEARS');
            }
          } else {
            v.strikes += 1;
            this.addShake(5);
            sound?.vaultTick?.(false);
            this.input?.haptic?.(35);
            if (v.strikes >= v.maxStrikes) {
              v.status = 'failed';
              v.statusTimer = 1.1;
              sound?.vaultFail?.();
              this._emitProgEvent('vault_complete', {
                won: false,
                strikes: v.strikes,
                ringsLocked: v.activeRing,
                timeRemaining: v.timer,
              });
              this.cb.onBanner?.(
                this.vaultReturnState ? 'LOCK JAMMED' : 'CHAMBER SEALED',
                this.vaultReturnState ? 'RETURNING TO LEDGE' : 'CONTINUING EXPEDITION'
              );
            }
          }
        }
      }

      if (v.status === 'playing' && v.timer <= 0) {
        v.status = 'failed';
        v.statusTimer = 1.1;
        sound?.vaultFail?.();
        this._emitProgEvent('vault_complete', {
          won: false,
          strikes: v.strikes,
          ringsLocked: v.activeRing,
          timeRemaining: 0,
        });
        this.cb.onBanner?.('VAULT SEALED', 'TIME EXPIRED');
      }
    } else {
      v.statusTimer -= dt;
      if (v.statusTimer <= 0) {
        if (this.standaloneMiniGame) {
          const won = v.status === 'won';
          this.mode = won ? 'victory' : 'gameover';
          this._syncHud();
          this.cb.onGameOver?.(won, this.score, this.hiScore, this._buildGameOverSummary(won));
        } else if (!this.vaultReturnState) {
          // Inter-tower Casual Expedition Vault transition
          this._finishTransitionMiniGame();
        } else {
          this.mode = 'tower';
          this.player.col = this.vaultReturnState.col;
          this.player.floor = this.vaultReturnState.floor;
          this.player.vx = 0;
          this.player.vy = 0;
          this.player.invuln = 2.0;
          this.player.landingFloor = this._computeLandingFloor(this.player.col, this.player.floor);
          this.vaultReturnState = null;
          sound?.setMiniGameMode?.(null);
          sound?.setTowerTheme?.(this.tower?.id || 1, this.tower?.theme || 'mist');
          this._syncHud();
        }
      }
    }

    this._syncHud();
  }

  // --- Scene Render Dispatch (§3.7) ---

  render() {
    if (!this.renderer) return;
    if (typeof this.renderer.renderScene === 'function') {
      this.renderer.renderScene(this);
      return;
    }

    const activeMode = this.mode === 'paused' ? this.pausedFrom || 'tower' : this.mode;
    if (activeMode === 'submarine') {
      this.renderer.renderSubmarineScene?.(this);
    } else if (activeMode === 'skimmer') {
      this.renderer.renderSkimmerScene?.(this);
    } else if (activeMode === 'glide') {
      this.renderer.renderGlideScene?.(this);
    } else if (activeMode === 'puzzle') {
      this.renderer.renderPuzzleScene?.(this);
    } else if (activeMode === 'vault') {
      this.renderer.renderVaultScene?.(this);
    } else if (this.tower) {
      this.renderer.renderTowerScene?.(this);
    }
  }
}
