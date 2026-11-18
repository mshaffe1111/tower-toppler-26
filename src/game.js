// Towering Waters: Gateway's Descent — Core 6-Mode Gameplay Engine, Smooth Staircases,
// Lizard Tail-Whip & Hydro-Pulse Combat, Live Pipe-Valve Routing, Gecko Wall-Scamper,
// Tail-Grapple Rings, 7 Siphon Syndicate Enemies, Playable Reactor Core Descent & 5 Mini-Games
// Created by Matt Shaffer

import {
  COLS,
  SECTOR_WORLDS,
  getDailySeed,
  createTowers,
  createSanctumTowers,
  generateProceduralTower,
  createDailyTower,
} from './levels.js';
import { sound } from './audio.js';
import { progression, BIO_MUTATIONS, STORY_CUTSCENES, rollMutationChoices } from './progression.js';
import { SubStage } from './subStage.js';
import { GlideStage } from './glideStage.js';
import { PUZZLE_TYPES, makePuzzle, peekPuzzleClue, PuzzleRoom } from './puzzleRoom.js';

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

// Calibrated COLS = 20 Larger-Hero Traversal Constants (TOWER_RADIUS = 3.75, FLOOR_HEIGHT = 1.50)
const BASE_WALK_SPEED = 4.05;     // ~2.67 col normal flick span, ~2.93 col full power jump span
const BASE_JUMP_VY = 9.65;        // ~1.70 floor apex (effortlessly clears +1F without skipping +2F)
const GRAV_RISE = 26.0;
const GRAV_JUMP_CUT = 45.0;
const GRAV_APEX = 16.0;
const GRAV_FALL = 37.2;
const MAX_FALL_SPEED = 15.2;
const COYOTE_WINDOW = 0.185;      // 185ms coyote forgiveness
const JUMP_BUFFER_WINDOW = 0.150; // 150ms jump buffer forgiveness
const MANTLE_MAX_GAP = 0.42;      // 0.42 floors generous ledge-edge mantle

const MINI_MODE_CANONICAL = {
  core_descent: 'core_descent',
  descent: 'core_descent',
  reef_swim: 'reef_swim',
  submarine: 'reef_swim',
  rapids_surf: 'rapids_surf',
  skimmer: 'rapids_surf',
  frill_glide: 'frill_glide',
  glide: 'frill_glide',
  aqueduct_sanctum: 'aqueduct_sanctum',
  puzzle: 'aqueduct_sanctum',
  vault: 'vault',
};

export class ToweringWatersGame {
  constructor(renderer, input, callbacks = {}, progressionMgr = progression) {
    this.renderer = renderer;
    this.input = input;
    this.cb = callbacks || {};
    this.prog = progressionMgr || progression;

    const saved = this.prog?.getSettings?.() || {};
    this.era = 'reboot'; // harmless compatibility field for renderers
    this.zenMode = Boolean(saved.zenMode);
    this.skinId = saved.skinId || this.prog?.getEquippedSkin?.() || 'sea_glass_guardian';
    this.blasterFxId = saved.blasterFxId || this.prog?.getEquippedBlasterFx?.() || 'tidal_pearl';

    // Active scene mode:
    // 'title' | 'tower' | 'core_descent' | 'topple' | 'reef_swim' | 'rapids_surf' | 'frill_glide'
    // | 'aqueduct_sanctum' | 'vault' | 'mutation_draft' | 'paused' | 'gameover' | 'victory'
    this.mode = 'title';
    this.pausedFrom = null;
    // 6 Game Modes: 'campaign' | 'purist' | 'flood_rush' | 'sanctum_trials' | 'expedition' | 'daily_tide'
    this.gameMode = 'campaign';
    this.runType = 'campaign';
    this.standaloneMiniGame = false;

    this.towers = createTowers('campaign');
    this.towerIndex = 0;
    this.tower = null;

    this.score = 0;
    this.nextExtraLife = 5000;
    this.hiScore = this.prog?.getHighScore?.(this._scoreBucket()) || 0;
    this.lives = 3;
    this.time = 0;
    this.timer = 105;
    this.timeLimit = 105;
    this.zenElapsed = 0;

    this.shake = 0;
    this.comboCount = 0;
    this.comboTimer = 0;
    this.maxComboHere = 0;

    // Campaign, Expedition & Flood-Rush progression state
    this.towersClearedInRun = 0;
    this.runStartedFromTower1 = false;
    this.runDeathsTotal = 0;
    this.runHurtTotal = 0;
    this.runStarsEarned = 0;
    this.runGearsStart = this.prog?.getGears?.() || 0;
    this.lastClearStars = null;
    this.lastPurificationInfo = null;
    this.purificationProgress = 0;
    this.nextTowerTimeBonus = 0;
    this.nextTowerShield = false;
    this.nextTowerWarpFloors = 0;
    this.endlessDepth = 0;
    this.floodAltitudeMeters = 0;
    this.endlessSeed = Date.now() >>> 0;
    this._lastCasualMini = null;
    this.dailyMeta = null;
    this.vaultReturnState = null;

    // Roguelite Bio-Mutations ('expedition' mode)
    this.activeMutations = [];
    this.pendingMutationChoices = [];
    this._aegisRechargeTimer = 0;

    // Per-spire telemetry
    this.towerHurtCount = 0;
    this.towerShotsFired = 0;
    this.towerWhiplashes = 0;
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
    this.lastCoreCrystalsSmashed = 0;
    this.maxFloorReached = 0;
    this.visitedElevators = new Set();
    this.stallFloor = 0;
    this.stallTimer = 0;
    this._footstepAccum = 0;

    // Sanctum Trials / Workbench & Reliquary Chest state
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
    this._upDoorLatch = false;

    // Mini-game stage controllers
    this.puzzleData = null;
    this.puzzleDoor = null;
    this.puzzleRoom = null;
    this.puzzle = null;
    this._standalonePuzzleIdx = -1;
    this.subStage = null;
    this.reefSwim = null;
    this.glideStage = null;
    this.frillGlide = null;
    this.glideGoldenOrChain4 = false;

    // Live environmental & Pipe-Valve routing state
    this.waterFloor = -0.55;
    this.targetWaterFloor = -0.55;
    this.waterPurified = false;
    this.waterSurgeDelay = 0;
    this.windCurrent = 0;
    this.blackoutFactor = 0;
    this.lightningFlash = 0;
    this._lightningTimer = 0;
    this.switchStates = { red: false, cyan: false, conv: false, pipeA: false, pipeB: false };
    this.pipeStates = { pipeA: false, pipeB: false };
    this.wardrobeSpotlight = false;
    this.cutsceneCam = null;

    this.camCol = 0;
    this.camFloor = 2;

    // Hero object exposed as `gateway` (with renderer compatibility aliases)
    this.gateway = this._createDefaultGateway(0.5, 0);
    this.player = this.gateway;
    this.pogo = this.gateway;

    this.ledges = [];
    this.elevators = [];
    this.switches = [];
    this.wallStrips = [];
    this.grappleRings = [];
    this.collectibles = [];
    this.enemies = [];
    this.enemyProjectiles = [];
    this.hydroPulses = [];
    this.snowballs = this.hydroPulses;
    this.particles = [];
    this.popups = [];

    this.topple = {
      active: false,
      progress: 0,
      duration: 2.8,
    };

    this.coreDescent = this._createEmptyCoreDescent();
    this.descent = this.coreDescent;

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
      fireCooldown: 0,
      fishCaughtCount: 0,
      minesDestroyed: 0,
    };

    this.skimmer = {
      laneX: 0,
      vx: 0,
      y: 0,
      vy: 0,
      surfBank: 0,
      onWater: true,
      speed: 19,
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
      whipTimer: 0,
      fireCooldown: 0,
      spawnCursor: 0,
    };
    this.rapidsSurf = this.skimmer;
    this.rapids = this.skimmer;

    this.vault = {
      activeRing: 0,
      strikes: 0,
      maxStrikes: 3,
      timer: 13.5,
      duration: 13.5,
      status: 'playing',
      statusTimer: 0,
      rings: this._createVaultRings(),
    };
    this.sanctumVault = this.vault;
  }

  get state() {
    return this;
  }

  get mutations() {
    return this.activeMutations;
  }

  _setGateway(heroObj) {
    this.gateway = heroObj;
    this.player = heroObj;
    this.pogo = heroObj;
    return heroObj;
  }

  _createDefaultGateway(col = 0.5, floor = 0) {
    return {
      col,
      floor,
      vx: 0,
      vy: 0,
      facing: 1,
      onGround: true,
      onStairs: false,
      stairSlope: 0,
      stairDir: 0,
      stairPhase: 0,
      onElevator: null,
      wallScamper: false,
      climbing: false,
      activeWallStrip: null,
      grappleTarget: null,
      grappleTimer: 0,
      isSwimming: false,
      swimPhase: 0,
      tailWhipTimer: 0,
      whipTimer: 0,
      tailWhip: 0,
      whipCooldown: 0,
      frillFlare: 0,
      airJumpsLeft: this.hasMutation?.('hydro_double_jump') ? 1 : 0,
      anim: 'IdleBreathe',
      invuln: 0,
      shield: false,
      hidden: false,
      enteringDoor: 0,
      doorPhase: null,
      tunnelTimer: 0,
      tunnelTarget: null,
      safeCol: col,
      safeFloor: floor,
      fireCooldown: 0,
      fireBuffer: 0,
      whipBuffer: 0,
      muzzleFlash: 0,
      squashX: 1,
      squashY: 1,
      landImpact: 0,
      hurtTimer: 0,
      landingFloor: floor,
      skinId: this.skinId || 'sea_glass_guardian',
      blasterFxId: this.blasterFxId || this.prog?.getEquippedBlasterFx?.() || 'tidal_pearl',
      mutations: [...(this.activeMutations || [])],
      coyoteTimer: 0,
      jumpBufferTimer: 0,
      jumpCutEligible: false,
      stepHopActive: false,
      steamBoostActive: false,
      jumpStartCol: col,
      jumpStartFloor: floor,
      knockbackTimer: 0,
      stepUpCooldown: 0,
    };
  }

  _createEmptyCoreDescent() {
    const turbines = [];
    const crystalLocks = [];
    const rings = [];
    const pulses = [];
    return {
      active: false,
      phase: 'idle',
      timer: 0,
      duration: 21.0,
      depth: 0,
      totalDepth: 420,
      progress: 0,
      shaftRadius: 3.6,
      theme: 'canyon_river',
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      angle: 0,
      radial: 0,
      speed: 20.0,
      whipTimer: 0,
      spinTimer: 0,
      boostTimer: 0,
      invuln: 0,
      crystalsSmashed: 0,
      crystalsRequired: 3,
      coresSmashed: 0,
      totalCores: 3,
      seedPlanted: false,
      purificationWave: 0,
      turbines,
      obstacles: turbines,
      crystalLocks,
      cores: crystalLocks,
      rings,
      pickups: rings,
      pulses,
    };
  }

  _createVaultRings() {
    return [
      { angle: Math.random() * Math.PI * 2, speed: 1.55, targetAngle: 0, tolerance: 0.44, locked: false },
      { angle: Math.random() * Math.PI * 2, speed: -2.15, targetAngle: 0, tolerance: 0.40, locked: false },
      { angle: Math.random() * Math.PI * 2, speed: 2.80, targetAngle: 0, tolerance: 0.36, locked: false },
    ];
  }

  hasMutation(id) {
    return this.runType === 'expedition' && Array.isArray(this.activeMutations) && this.activeMutations.includes(id);
  }

  _scoreBucket() {
    switch (this.runType) {
      case 'purist':
        return 'purist';
      case 'flood_rush':
        return 'flood_rush';
      case 'sanctum_trials':
        return 'sanctum_trials';
      case 'expedition':
        return 'expedition';
      case 'daily_tide':
      case 'daily':
        return 'daily_tide';
      default:
        return 'campaign';
    }
  }

  // ===========================================================================
  // PUBLIC SETTINGS & 6-MODE LAUNCH API
  // ===========================================================================

  applySettings(settings = {}) {
    if (!settings || typeof settings !== 'object') return;
    const updated = this.prog?.updateSettings?.(settings) || settings;

    if (settings.zenMode !== undefined) {
      this.zenMode = Boolean(settings.zenMode);
      sound?.setZenMode?.(this.zenMode);
    }

    if (updated.skinId || settings.skinId) {
      this.skinId = updated.skinId || settings.skinId;
      if (this.gateway) this.gateway.skinId = this.skinId;
      this.renderer?.setSkin?.(this.skinId);
    }

    const nextFx = updated.blasterFxId || settings.blasterFxId || this.prog?.getEquippedBlasterFx?.();
    if (nextFx) {
      this.blasterFxId = nextFx;
      if (this.gateway) this.gateway.blasterFxId = nextFx;
      this.renderer?.setBlasterFx?.(nextFx);
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
    if (settings.musicVolume !== undefined) {
      sound?.setMusicVolume?.(Number(settings.musicVolume));
    }
    if (settings.ambienceVolume !== undefined) {
      sound?.setAmbienceVolume?.(Number(settings.ambienceVolume));
    }
    if (settings.sfxVolume !== undefined) {
      sound?.setSfxVolume?.(Number(settings.sfxVolume));
    }

    this.hiScore = this.prog?.getHighScore?.(this._scoreBucket()) || 0;
    this._syncHud();
  }

  /**
   * Primary 6-Mode Entry Point:
   *  1. 'campaign'       — 5-Act Story Campaign (10 Spires, Cutscenes, Watershed Restoration)
   *  2. 'purist'         — Purist Arcade Mode (1-Hit KO, Strict Clock, 8x Skill Multiplier, Zero Checkpoints)
   *  3. 'flood_rush'     — Flash-Flood Survival (Accelerating Rising Surge, Geysers & Grapple Escape)
   *  4. 'sanctum_trials' — Sanctum Puzzle Odyssey (Timer-Free Multi-Valve & Aqueduct Sanctum Logic Spires)
   *  5. 'expedition'     — Watershed Roguelite Expedition (5-Biome Rotation + 3-Card Bio-Mutation Drafts)
   *  6. 'daily_tide'     — Deterministic UTC Daily Seeded Spire + Daily Tide Modifier
   */
  startGame(mode = 'campaign', opts = {}) {
    const m = String(mode || 'campaign').toLowerCase();
    if (m === 'purist' || m === 'arcade') {
      return this.startPuristMode(opts);
    }
    if (m === 'flood_rush' || m === 'endless') {
      return this.startFloodRushMode(opts);
    }
    if (m === 'sanctum_trials' || m === 'casual' || m === 'endless_casual') {
      return this.startSanctumTrialsMode(opts);
    }
    if (m === 'expedition' || m === 'roguelite') {
      return this.startExpeditionMode(opts);
    }
    if (m === 'daily_tide' || m === 'daily') {
      return this.startDailyChallenge(opts?.date || new Date());
    }
    return this.startCampaign(opts);
  }

  _prepareRunAudioAndVisuals(zen = false) {
    this.skinId = this.prog?.getEquippedSkin?.() || this.skinId || 'sea_glass_guardian';
    this.blasterFxId = this.prog?.getEquippedBlasterFx?.() || this.blasterFxId || 'tidal_pearl';
    this.renderer?.setEra?.('reboot');
    this.renderer?.setSkin?.(this.skinId);
    this.renderer?.setBlasterFx?.(this.blasterFxId);
    sound?.setZenMode?.(Boolean(zen));
    sound?.setMiniGameMode?.(null);
    sound?.setWind?.(0);
    sound?.setMusicActive?.(true);
  }

  startCampaign({ startTowerIdx = 0, zenMode = this.zenMode } = {}) {
    this.zenMode = Boolean(zenMode);
    this.gameMode = 'campaign';
    this.runType = 'campaign';
    this.standaloneMiniGame = false;
    this.dailyMeta = null;
    this.vaultReturnState = null;
    this.activeMutations = [];
    this.pendingMutationChoices = [];

    this._prepareRunAudioAndVisuals(this.zenMode);
    this.towers = createTowers('campaign');
    this.towerIndex = Math.max(0, Math.min(this.towers.length - 1, Number(startTowerIdx) || 0));

    this._resetRunStats();
    this.runStartedFromTower1 = this.towerIndex === 0;
    this.mode = 'tower';
    this.loadTower(this.towerIndex);
  }

  startPuristMode({ startTowerIdx = 0 } = {}) {
    this.zenMode = false;
    this.gameMode = 'purist';
    this.runType = 'purist';
    this.standaloneMiniGame = false;
    this.dailyMeta = null;
    this.vaultReturnState = null;
    this.activeMutations = [];
    this.pendingMutationChoices = [];

    this._prepareRunAudioAndVisuals(false);
    this.towers = createTowers('campaign');
    this.towerIndex = Math.max(0, Math.min(this.towers.length - 1, Number(startTowerIdx) || 0));

    this._resetRunStats();
    this.lives = 3;
    this.runStartedFromTower1 = this.towerIndex === 0;
    this.mode = 'tower';
    this.loadTower(this.towerIndex);
  }

  startFloodRushMode({ seed = Date.now() } = {}) {
    this.zenMode = false;
    this.gameMode = 'flood_rush';
    this.runType = 'flood_rush';
    this.standaloneMiniGame = false;
    this.dailyMeta = null;
    this.vaultReturnState = null;
    this.activeMutations = [];
    this.pendingMutationChoices = [];
    this.endlessDepth = 0;
    this.floodAltitudeMeters = 0;
    this.endlessSeed = (Number(seed) || Date.now()) >>> 0;

    this._prepareRunAudioAndVisuals(false);
    this._resetRunStats();
    this.lives = 2;
    this.mode = 'tower';
    const firstTower = generateProceduralTower({
      seed: (this.endlessSeed + 101) >>> 0,
      index: 1,
      difficulty: 1.2,
      modeHint: 'flood_rush',
    });
    this.loadTower(firstTower);
  }

  startSanctumTrialsMode({ seed = Date.now(), startTowerIdx = 0 } = {}) {
    this.zenMode = true;
    this.gameMode = 'sanctum_trials';
    this.runType = 'sanctum_trials';
    this.standaloneMiniGame = false;
    this.dailyMeta = null;
    this.vaultReturnState = null;
    this.activeMutations = [];
    this.pendingMutationChoices = [];
    this.endlessDepth = Number(startTowerIdx) || 0;
    this._lastCasualMini = null;
    this.endlessSeed = (Number(seed) || Date.now()) >>> 0;

    this._prepareRunAudioAndVisuals(true);
    this._resetRunStats();
    this.towers = createSanctumTowers(5);
    this.mode = 'tower';
    const firstTower =
      this.endlessDepth < this.towers.length
        ? this.towers[this.endlessDepth]
        : generateProceduralTower({
            seed: (this.endlessSeed + 307) >>> 0,
            index: this.endlessDepth + 1,
            difficulty: 1,
            modeHint: 'sanctum_trials',
            casual: true,
          });
    this.loadTower(firstTower);
  }

  startExpeditionMode({ seed = Date.now(), initialMutation = null } = {}) {
    this.zenMode = false;
    this.gameMode = 'expedition';
    this.runType = 'expedition';
    this.standaloneMiniGame = false;
    this.dailyMeta = null;
    this.vaultReturnState = null;
    this.endlessDepth = 0;
    this.endlessSeed = (Number(seed) || Date.now()) >>> 0;
    this.activeMutations = initialMutation ? [String(initialMutation)] : [];
    this.pendingMutationChoices = [];

    this._prepareRunAudioAndVisuals(false);
    this._resetRunStats();
    this.lives = 3;
    this.mode = 'tower';
    const firstTower = generateProceduralTower({
      seed: (this.endlessSeed + 509) >>> 0,
      index: 1,
      difficulty: 1.1,
      modeHint: 'expedition',
    });
    this.loadTower(firstTower);
  }

  startDailyChallenge(date = new Date()) {
    const { seed, dateKey } = getDailySeed(date);
    this.zenMode = false;
    this.gameMode = 'daily_tide';
    this.runType = 'daily_tide';
    this.standaloneMiniGame = false;
    this.vaultReturnState = null;
    this.activeMutations = [];
    this.pendingMutationChoices = [];

    const dailyTower = createDailyTower(date);
    this.dailyMeta = {
      seed,
      dateKey,
      elapsedSec: 0,
      modifier: dailyTower.dailyModifier || null,
    };

    this._prepareRunAudioAndVisuals(false);
    this._resetRunStats();
    this.mode = 'tower';
    this.loadTower(dailyTower);
    this._tryUnlockTrophy('daily_try');
  }

  // Back-compat convenience aliases
  startNewGame(startTowerIdx = 0) {
    return this.startCampaign({ startTowerIdx, zenMode: this.zenMode });
  }
  startEndlessMode(opts = {}) {
    return this.startFloodRushMode(opts);
  }
  startCasualEndlessMode(opts = {}) {
    return this.startSanctumTrialsMode(opts);
  }

  startMiniGame(type = 'reef_swim', standalone = true) {
    const resolved = MINI_MODE_CANONICAL[String(type || '').toLowerCase()] || 'reef_swim';
    this.standaloneMiniGame = Boolean(standalone);
    if (this.standaloneMiniGame) {
      this.runType = 'minigame';
      this._resetRunStats();
      this.vaultReturnState = null;
      this.puzzleDoor = null;
      sound?.setMusicActive?.(true);
    }

    sound?.setWind?.(0);
    this.particles = [];
    this.popups = [];
    this.shake = 0;
    this.comboCount = 0;
    this.comboTimer = 0;
    this.input?.resetState?.();

    if (resolved === 'core_descent') {
      this._initCoreDescentStage();
    } else if (resolved === 'rapids_surf') {
      this._initSkimmerStage();
    } else if (resolved === 'frill_glide') {
      this._initGlideStage();
    } else if (resolved === 'aqueduct_sanctum') {
      this._initPuzzleStage(null);
    } else if (resolved === 'vault') {
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
    this.runStarsEarned = 0;
    this.runGearsStart = this.prog?.getGears?.() || 0;
    this.lastClearStars = null;
    this.lastPurificationInfo = null;
    this.purificationProgress = 0;
    this.nextTowerTimeBonus = 0;
    this.nextTowerShield = false;
    this.nextTowerWarpFloors = 0;
    this.subStage = null;
    this.reefSwim = null;
    this.glideStage = null;
    this.frillGlide = null;
    this.puzzleRoom = null;
    this.puzzle = null;
    this.puzzleDoor = null;
    this.blasterFxId = this.prog?.getEquippedBlasterFx?.() || this.blasterFxId || 'tidal_pearl';
    this.hiScore = this.prog?.getHighScore?.(this._scoreBucket()) || 0;
    this.input?.resetState?.();
  }

  // ===========================================================================
  // SPIRE LOADING & INITIALIZATION
  // ===========================================================================

  loadTower(idxOrTower) {
    let rawT = null;
    if (typeof idxOrTower === 'number') {
      if (!this.towers || this.towers.length === 0) {
        this.towers = createTowers('campaign');
      }
      const clampedIdx = Math.max(0, Math.min(this.towers.length - 1, idxOrTower));
      this.towerIndex = clampedIdx;
      rawT = this.towers[clampedIdx];
    } else if (idxOrTower && typeof idxOrTower === 'object') {
      rawT = idxOrTower;
    }

    if (!rawT) return;

    const clonedDoors = (rawT.doors || []).map((d) => ({
      ...d,
      isRune: Boolean(d.isRune || d.rune),
      solved: false,
    }));

    const isSanctumTower = Boolean(rawT.casual || this.runType === 'sanctum_trials');
    const t = {
      ...rawT,
      casual: isSanctumTower,
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
    this.wallStrips = (t.wallStrips || []).map((ws) => ({ ...ws }));
    this.grappleRings = (t.grappleRings || []).map((gr) => ({ ...gr, _cooldown: 0 }));

    this.puzzleData = null;
    this.puzzleDoor = null;
    this.puzzleRoom = null;
    this.puzzle = null;
    this.subStage = null;
    this.reefSwim = null;
    this.glideStage = null;
    this.frillGlide = null;
    this.purificationProgress = 0;

    const runeDoors = t.doors.filter((d) => d.isRune);
    for (let ri = 0; ri < runeDoors.length; ri++) {
      const rd = runeDoors[ri];
      const pType =
        rd.puzzleType ||
        PUZZLE_TYPES[((t.id || 1) - 1 + ri) % PUZZLE_TYPES.length] ||
        'lights';
      const pSeed = rd.puzzleSeed ?? ((t.id || 1) * 7919 + 17 + ri * 1013);
      const pDiff =
        rd.puzzleDifficulty !== undefined && rd.puzzleDifficulty !== null
          ? Number(rd.puzzleDifficulty)
          : Math.min(0.85, 0.25 + ((t.id || 1) - 1) * 0.06);
      rd.puzzleType = pType;
      rd.puzzleSeed = pSeed;
      rd.puzzleDifficulty = pDiff;
      const builtPuz = makePuzzle({
        type: pType,
        seed: pSeed,
        difficulty: pDiff,
        hideTarget: pType === 'lights' || pType === 'bells',
      });
      rd._puzzle = builtPuz;
      if (!this.puzzleData) {
        this.puzzleData = builtPuz;
      }
      const peeked = peekPuzzleClue({ seed: pSeed, difficulty: pDiff, forcedType: pType });
      const baseClue = peeked?.clue || builtPuz?.clue || { kind: pType };
      rd.clue = {
        ...(rd.clue || {}),
        ...baseClue,
        col: rd.col,
        floor: rd.floor,
        ...(rd.clueColOffset !== undefined ? { clueColOffset: rd.clueColOffset } : {}),
      };
    }
    t.runeDoors = runeDoors;
    t.vaultDoor = t.doors.find((d) => d.isVault) || null;
    if (runeDoors.length > 0 && runeDoors[0].clue) {
      t.clue = { ...runeDoors[0].clue };
    }

    this.tower = t;

    const bonusSec = this.nextTowerTimeBonus || 0;
    this.nextTowerTimeBonus = 0;
    const rawLimit = t.timeLimit || 105;
    // Purist Arcade enforces a tighter 0.84x high-stakes clock!
    const modeClockScale = this.runType === 'purist' ? 0.84 : 1.0;
    this.timeLimit = Math.round(rawLimit * modeClockScale) + bonusSec;
    this.timer = this.timeLimit;
    this.zenElapsed = 0;

    this.particles = [];
    this.popups = [];
    this.hydroPulses.length = 0;
    this.enemyProjectiles = [];
    this.shake = 0;
    this.comboCount = 0;
    this.comboTimer = 0;
    this.maxComboHere = 0;
    this.topple = { active: false, progress: 0, duration: 2.8 };

    // Per-spire telemetry
    this.towerHurtCount = 0;
    this.towerShotsFired = 0;
    this.towerWhiplashes = 0;
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
    this.lastCoreCrystalsSmashed = 0;
    this.visitedElevators = new Set();
    this._stationHintCooldown = 0;
    this._casualSkipConfirmTimer = 0;
    this._upDoorLatch = false;
    this._footstepAccum = 0;
    this._aegisRechargeTimer = 0;

    // Environmental & Pipe-Valve state
    const mech = t.mechanics || {};
    const hasSurge = !isSanctumTower && (mech.waterRiseRate || 0) > 0;
    this.waterFloor = (mech.waterBaseFloor ?? -0.55) - (hasSurge ? 0.55 : 0);
    this.targetWaterFloor = this.waterFloor;
    this.waterPurified = Boolean(mech.waterPurified);
    this.waterSurgeDelay = hasSurge ? (this.runType === 'flood_rush' ? 2.0 : 3.2) : 0;
    this.windCurrent = 0;
    this.blackoutFactor = 0;
    this.lightningFlash = 0;
    this._lightningTimer = mech.lightningInterval > 0 ? mech.lightningInterval * 0.65 : 0;
    this.switchStates = { red: false, cyan: false, conv: false, pipeA: false, pipeB: false };
    this.pipeStates = { pipeA: false, pipeB: false };

    this.ledges = (t.ledges || []).map((l) => ({
      ...l,
      origType: l.type || 'solid',
      type: l.type || 'solid',
      switchGroup: l.switchGroup || null,
      pipeGroup: l.pipeGroup || null,
      stairDir: l.stairDir || 0,
      stairDownDir: l.stairDownDir || 0,
      isStair: Boolean(l.isStair),
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
      pipeGroup: e.pipeGroup || null,
      powered: e.powered !== undefined ? Boolean(e.powered) : !e.pipeGroup,
    }));

    this.switches = (t.switches || []).map((s) => ({
      ...s,
      active: false,
      valveAngle: 0,
      targetValveAngle: 0,
      cooldown: 0,
      _playerInside: false,
    }));

    const ownedRelics = this.prog?.getCollectedRelics?.() || [];
    this.collectibles = (t.collectibles || []).map((c) => ({
      ...c,
      collected: false,
      alreadyOwned: c.type === 'relic' ? ownedRelics.includes(c.relicId || c.id) : false,
    }));

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

    if (isSanctumTower) {
      this.enemies = [];
    } else {
      this.enemies = (t.enemies || []).map((e, idx) => this._instantiateEnemy(e, idx));
    }

    this._syncDynamicLedges(0, true);

    let spawnCol = (t.spawn?.col ?? 0) + 0.5;
    let spawnFloor = t.spawn?.floor ?? 0;
    if (this.nextTowerWarpFloors > 0 && this.runType !== 'purist') {
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

    const grantShield =
      this.runType !== 'purist' &&
      (Boolean(this.nextTowerShield) || this.hasMutation('bubble_aegis'));
    this.nextTowerShield = false;

    if (this.mode !== 'title') {
      this.skinId = this.prog?.getEquippedSkin?.() || this.skinId || 'sea_glass_guardian';
      this.blasterFxId = this.prog?.getEquippedBlasterFx?.() || this.blasterFxId || 'tidal_pearl';
      this.renderer?.setSkin?.(this.skinId);
      this.renderer?.setBlasterFx?.(this.blasterFxId);
    }

    const hero = this._createDefaultGateway(spawnCol, spawnFloor);
    hero.invuln = this.mode === 'title' ? 0 : 2.0;
    hero.shield = grantShield;
    hero.landingFloor = this._computeLandingFloor(hero.col, hero.floor);
    this._setGateway(hero);

    this.maxFloorReached = Math.floor(spawnFloor);
    this.stallFloor = spawnFloor;
    this.stallTimer = 0;

    this.camCol = hero.col;
    this.camFloor = Math.max(1.5, hero.floor + 1.45);

    sound?.setWind?.(0);
    sound?.setMiniGameMode?.(null);
    const biomeTheme = t.theme || 'canyon_river';
    sound?.setTheme?.(biomeTheme);
    sound?.setTowerTheme?.(t.id || 1, biomeTheme);

    if (this.mode !== 'title') {
      this._emitProgEvent('tower_start', {
        runType: this.runType,
        zenMode: this.zenMode,
        controlMode: this.input?.controlMode,
        towerId: t.id || 1,
        theme: biomeTheme,
        casual: isSanctumTower,
        missionType,
      });
      const sub =
        this.runType === 'daily_tide'
          ? `DAILY TIDE • ${this.dailyMeta?.modifier?.badge || this.dailyMeta?.dateKey || ''}`
          : this.runType === 'sanctum_trials'
          ? t.subtitle || `SANCTUM TRIAL • SPIRE ${this.endlessDepth + 1}`
          : this.runType === 'flood_rush'
          ? `FLASH-FLOOD SURVIVAL • SURGE ${this.endlessDepth + 1}`
          : this.runType === 'expedition'
          ? `WATERSHED EXPEDITION • SPIRE ${this.endlessDepth + 1}`
          : this.runType === 'purist'
          ? `PURIST ARCADE • 1-HIT STAKES • SPIRE ${t.id}`
          : t.subtitle || `SPIRE ${t.id}`;
      this.cb.onBanner?.(sub, t.name);
      if (bonusSec > 0) {
        this.addPopup({
          col: hero.col,
          floor: hero.floor + 1.35,
          text: `+${bonusSec}s RAPIDS WAKE BONUS!`,
          color: '#5efce8',
          maxLife: 1.35,
        });
      }
    }
    this._syncHud();
  }

  _instantiateEnemy(e, idx = 0) {
    const needsSpan = e.type === 'snap_crab' || (e.type === 'rail_skater' && e.axis !== 'v');
    const span = needsSpan ? this._computeContiguousSpan(e.col, Math.round(e.floor)) : null;
    return {
      ...e,
      spawnCol: e.col,
      spawnFloor: e.floor,
      baseFloor: e.floor,
      speed: e.speed ?? (e.type === 'barnacle_mortar' ? 0 : 1.75),
      phase: (e.phaseOffset ?? idx * 1.43) % (Math.PI * 2),
      stunTimer: 0,
      flipped: false,
      flipTimer: 0,
      inflatePhase: 0,
      slitherPhase: (idx * 0.9) % (Math.PI * 2),
      openAmount: 0,
      telegraph: 0,
      venting: false,
      fireTimer: 1.4 + (idx % 3) * 0.75,
      hp: e.hp ?? (e.type === 'siphon_warden' ? 3 : 1),
      maxHp: e.maxHp ?? e.hp ?? (e.type === 'siphon_warden' ? 3 : 1),
      shielded: e.type === 'siphon_warden',
      bossPhase: 'patrol',
      bossTimer: 2.4,
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
    while (leftSteps < COLS - 1 && hasTile(startTile - leftSteps - 1)) leftSteps++;
    let rightSteps = 0;
    while (rightSteps < COLS - 1 - leftSteps && hasTile(startTile + rightSteps + 1)) rightSteps++;
    const spanStart = wrapCol(startTile - leftSteps);
    const length = Math.max(1, leftSteps + 1 + rightSteps);
    const initialOffset = Math.max(
      0.35,
      Math.min(length - 0.35, leftSteps + (wrapCol(col) - startTile || 0.5))
    );
    return { startCol: spanStart, length, initialOffset };
  }

  togglePause() {
    const pausable = new Set([
      'tower',
      'core_descent',
      'reef_swim',
      'submarine',
      'rapids_surf',
      'skimmer',
      'frill_glide',
      'glide',
      'aqueduct_sanctum',
      'puzzle',
      'vault',
    ]);
    if (pausable.has(this.mode)) {
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

  // ===========================================================================
  // SCORING, TROPHIES & VFX HELPERS
  // ===========================================================================

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
        this._emitProgEvent('extra_life', { score: this.score, runType: this.runType });
        this._tryUnlockTrophy('classic_extra_life');
      }
      if (!this.zenMode && this.lives < 6) {
        this.lives = Math.min(6, this.lives + 1);
        sound?.extraLife?.();
        if (this.mode === 'tower') {
          this.addPopup({
            col: this.gateway.col,
            floor: this.gateway.floor + 1.35,
            text: 'EXTRA LIFE!',
            color: '#6bf2ff',
            maxLife: 1.35,
          });
        }
      }
    }
    this._syncHud();
  }

  _awardGears(baseAmount = 1) {
    let amt = Math.max(1, Math.floor(baseAmount));
    if (this.hasMutation('tidal_magnet') && Math.random() < 0.35) {
      amt += 1;
    }
    this.prog?.addGears?.(amt);
    this._flushPendingProgTrophies();
    return amt;
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
    if (Array.isArray(unlocked) && unlocked.length >= 99 && !unlocked.includes('harmonic_millennium')) {
      const cap = this.prog?.unlockTrophy?.('harmonic_millennium');
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
    const fxId = this.gateway?.blasterFxId || this.blasterFxId || 'tidal_pearl';
    const def = this.prog?.getBlasterFxDef?.(fxId);
    if (def && Array.isArray(def.trailColors) && def.trailColors.length > 0) {
      return def.trailColors;
    }
    return ['#e0f2fe', '#67e8f9'];
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
    if (activeMode === 'core_descent') {
      const cd = this.coreDescent;
      return `CORE CRYSTALS ${cd.crystalsSmashed}/${cd.crystalsRequired} • DEPTH ${Math.round(cd.depth)}m`;
    }
    if (activeMode !== 'tower' || !this.tower) return null;

    if (this.runType === 'flood_rush') {
      return `SURGE CLIMB • ${this.floodAltitudeMeters}m SURVIVED`;
    }
    if (this.runType === 'expedition') {
      const mutCount = this.activeMutations.length;
      return `EXPEDITION SPIRE ${this.endlessDepth + 1} • ${mutCount} BIO-${mutCount === 1 ? 'MUTATION' : 'MUTATIONS'}`;
    }
    if (this.runType === 'purist') {
      return `PURIST ARCADE • ${Math.max(1, this.comboCount)}X CHAIN • 1-HIT STAKES`;
    }
    if (this.runType === 'daily_tide' && this.dailyMeta?.modifier) {
      return `DAILY TIDE • ${this.dailyMeta.modifier.badge}`;
    }

    const mType = this._getCasualMissionType(this.tower);
    if (!mType) return null;

    if (mType === 'tower_repair') {
      if (this.dynamoCrafted || this.tower.workbench?.crafted) {
        return 'SLUICE DYNAMO READY -> CROWN VALVE';
      }
      const req = Math.max(1, this.salvagePartsTotal || 3);
      if (this.salvagePartsCollected >= req) {
        return `PARTS ${this.salvagePartsCollected}/${req} -> CRAFT AT WORKBENCH`;
      }
      return `HYDRO PARTS ${this.salvagePartsCollected}/${req}`;
    }
    if (mType === 'treasure_hunt') {
      if (this.treasureChestOpened || this.tower.treasureChest?.opened) {
        return 'RELIQUARY CLAIMED -> CROWN VALVE';
      }
      const req = Math.max(1, this.compassKeysTotal || 3);
      if (this.compassKeysCollected >= req) {
        return `KEYS ${this.compassKeysCollected}/${req} -> UNLOCK CHEST`;
      }
      return `WAYFINDER KEYS ${this.compassKeysCollected}/${req}`;
    }
    if (mType === 'curio_survey') {
      const req = Math.max(1, this.curiosTotalHere || 4);
      return `CURIOS ${this.curiosCollectedHere}/${req}`;
    }
    if (mType === 'puzzle_architect') {
      if (this.towerVaultCleared || this.vaultCrackedThisTower) {
        return 'SANCTUM SOLVED -> CROWN VALVE';
      }
      return 'SANCTUM TRIAL -> SOLVE AQUEDUCT SANCTUM';
    }
    return null;
  }

  _scoreActionHit(basePts, popupPos, baseColor) {
    const maxCap = this.runType === 'purist' ? 8 : 4;
    this.comboCount = Math.min(maxCap, (this.comboCount || 0) + 1);
    this.comboTimer = this.runType === 'purist' ? 4.0 : 3.2;
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
      if (mult >= 4) this._tryUnlockTrophy('snowball_sniper');
      if (mult >= 8 && this.runType === 'purist') this._tryUnlockTrophy('purist_immortal');
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
    const width = this.renderer?.width || 390;
    const height = this.renderer?.height || 680;
    const centerX = width * 0.5;
    const radius = Math.min(width * 0.35, 148) + radiusOffset;
    const floorPx = 46;
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
    const colors = ['#e8f6ff', '#67e8f9', '#2dd4bf', '#a5f3fc'];
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

  // ===========================================================================
  // INTERACTION CONTEXT & HUD SYNCHRONIZATION
  // ===========================================================================

  _evaluateInteractContext() {
    const p = this.gateway;
    if (
      this.mode !== 'tower' ||
      !this.tower ||
      !p ||
      p.hidden ||
      p.doorPhase ||
      (!p.onGround && (p.coyoteTimer || 0) <= 0 && !p.onElevator && !p.wallScamper)
    ) {
      return { canInteract: false, kind: '' };
    }

    const enterableDoor = this.tower.doors?.find(
      (d) =>
        Math.abs(d.floor - p.floor) < 0.62 &&
        Math.abs(colDist(p.col, d.col + 0.5)) < 0.84 &&
        (d.isExit ||
          (d.isRune && !d.solved) ||
          (d.isVault && !this.towerVaultCleared) ||
          Boolean(d.targetId))
    );
    if (enterableDoor) {
      return { canInteract: true, kind: 'door', door: enterableDoor };
    }

    const nearPipeValve = this.switches?.find(
      (sw) =>
        (sw.mode === 'pipeValve' || sw.mode === 'floodValve' || sw.mode === 'drainValve') &&
        sw.cooldown <= 0 &&
        Math.abs(sw.floor - p.floor) < 0.72 &&
        Math.abs(colDist(p.col, sw.col + 0.5)) < 0.88
    );
    if (nearPipeValve && !nearPipeValve.active) {
      return { canInteract: true, kind: 'whip', switchObj: nearPipeValve };
    }

    const wb = this.tower.workbench;
    if (
      wb &&
      !wb.crafted &&
      Math.abs(wb.floor - p.floor) < 0.85 &&
      Math.abs(colDist(p.col, wb.col + 0.5)) < 0.95 &&
      this.salvagePartsCollected >= Math.max(1, this.salvagePartsTotal || 3)
    ) {
      return { canInteract: true, kind: 'fire' };
    }

    const ch = this.tower.treasureChest;
    if (
      ch &&
      !ch.opened &&
      Math.abs(ch.floor - p.floor) < 0.85 &&
      Math.abs(colDist(p.col, ch.col + 0.5)) < 0.95 &&
      this.compassKeysCollected >= Math.max(1, this.compassKeysTotal || 3)
    ) {
      return { canInteract: true, kind: 'fire' };
    }

    if (p.onElevator || p.wallScamper) {
      return { canInteract: true, kind: 'lift' };
    }
    const restingLift = this.elevators?.find(
      (el) => el.powered !== false && Math.abs(el.floor - p.floor) < 0.45 && Math.abs(colDist(p.col, el.col + 0.5)) < 0.72
    );
    if (restingLift) {
      return { canInteract: true, kind: 'lift' };
    }

    return { canInteract: false, kind: '' };
  }

  _syncHud() {
    const activeMode = this.mode === 'paused' ? this.pausedFrom || 'tower' : this.mode;
    const interactCtx = this._evaluateInteractContext();
    this.input?.setGameMode?.(activeMode);
    this.input?.setInteractContext?.(interactCtx.canInteract, interactCtx.kind);

    const exitDoor = this.tower?.doors?.find((d) => d.isExit);
    const exitFloor = exitDoor ? exitDoor.floor : Math.max(1, (this.tower?.floors || 18) - 2);
    const p = this.gateway;

    const altitudePct =
      activeMode === 'core_descent'
        ? Math.max(0, Math.min(100, Math.round((1 - (this.coreDescent.progress || 0)) * 100)))
        : Math.max(0, Math.min(100, Math.round((p.floor / Math.max(1, exitFloor)) * 100)));

    const waterPct =
      this.waterFloor > -0.45
        ? Math.max(0, Math.min(100, Math.round(((this.waterFloor + 0.55) / (exitFloor + 0.55)) * 100)))
        : 0;

    let dirHint = '▲';
    let actionPrompt = null;

    if (activeMode === 'tower' && this.tower) {
      if (exitDoor) {
        const d = colDist(p.col, exitDoor.col + 0.5);
        if (Math.abs(d) < 0.75) dirHint = '▲';
        else dirHint = d > 0 ? '▶' : '◀';
      }
      if (!p.hidden && this.mode === 'tower') {
        const missionType = this._getCasualMissionType(this.tower);
        const wb = this.tower.workbench;
        const ch = this.tower.treasureChest;
        const nearWb =
          wb && !wb.crafted && Math.abs(wb.floor - p.floor) < 0.85 && Math.abs(colDist(p.col, wb.col + 0.5)) < 0.95;
        const nearCh =
          ch && !ch.opened && Math.abs(ch.floor - p.floor) < 0.85 && Math.abs(colDist(p.col, ch.col + 0.5)) < 0.95;
        const nearDoor =
          (p.onGround || p.coyoteTimer > 0) &&
          this.tower.doors?.find(
            (d) => Math.abs(d.floor - p.floor) < 0.62 && Math.abs(colDist(p.col, d.col + 0.5)) < 0.84
          );
        const unpoweredLift = this.elevators.find(
          (el) => el.powered === false && Math.abs(colDist(p.col, el.col + 0.5)) < 1.15 && Math.abs(el.minFloor - p.floor) < 1.2
        );

        if (nearDoor) {
          if (nearDoor.isExit) {
            if (missionType === 'tower_repair' && !this.dynamoCrafted && !wb?.crafted) {
              actionPrompt = 'CRAFT DYNAMO AT WORKBENCH';
            } else if ((this._casualSkipConfirmTimer || 0) > 0) {
              actionPrompt = '▲ PRESS UP AGAIN TO DIVE';
            } else {
              actionPrompt = '▲ OPEN CROWN VALVE & CORE DIVE!';
            }
          } else if (nearDoor.isVault) {
            actionPrompt = this.towerVaultCleared ? '✓ CORE VAULT UNLOCKED' : '▲ ENTER HARMONIC VAULT';
          } else if (nearDoor.isRune) {
            actionPrompt = nearDoor.solved ? '✓ SANCTUM SOLVED' : '▲ ENTER AQUEDUCT SANCTUM';
          } else {
            actionPrompt = '▲ ENTER CONDUIT ARCHWAY';
          }
        } else if (interactCtx.switchObj) {
          actionPrompt =
            interactCtx.switchObj.mode === 'floodValve'
              ? '◎ WHIP / PULSE • OPEN FLOODGATE'
              : '◎ WHIP / PULSE • SPIN PIPE-VALVE';
        } else if (unpoweredLift) {
          actionPrompt = 'SPIN PIPE-VALVE TO POWER LIFT';
        } else if (nearWb) {
          const req = Math.max(1, this.salvagePartsTotal || 3);
          actionPrompt =
            this.salvagePartsCollected >= req
              ? '▲ CRAFT HARMONIC DYNAMO!'
              : `NEED PARTS (${this.salvagePartsCollected}/${req})`;
        } else if (nearCh) {
          const req = Math.max(1, this.compassKeysTotal || 3);
          actionPrompt =
            this.compassKeysCollected >= req
              ? '▲ OPEN RELIQUARY CHEST!'
              : `NEED KEYS (${this.compassKeysCollected}/${req})`;
        } else if (p.wallScamper) {
          actionPrompt = '▲▼ GECKO WALL-SCAMPER • JUMP LEAP';
        } else if (p.isSwimming) {
          actionPrompt = '≈ SURFACE SWIM • JUMP LEAP OUT';
        } else if (p.onElevator) {
          actionPrompt = '▲▼ MECHANICAL ELEVATOR';
        } else {
          const nearEl = this.elevators.find((el) => el.powered !== false && Math.abs(colDist(p.col, el.col + 0.5)) < 1.2);
          if (nearEl && Math.abs(nearEl.floor - p.floor) > 0.35) {
            actionPrompt = 'PULSE • RECALL ELEVATOR';
          }
        }
      }
    } else if (activeMode === 'core_descent') {
      const cd = this.coreDescent;
      dirHint = '▾';
      if (cd.phase === 'seed_plant' || cd.seedPlanted) {
        actionPrompt = '★ HARMONIC WATER SEED PLANTED!';
      } else {
        actionPrompt = `STEER TURBINES • WHIP/PULSE CRYSTALS (${cd.crystalsSmashed}/${cd.crystalsRequired})`;
      }
    } else if (activeMode === 'reef_swim' || activeMode === 'submarine') {
      const st = this.subStage || this.sub;
      if ((st?.rideT ?? st?.timer ?? 0) < 4.8) {
        actionPrompt = 'PULSE FREE CAGES • JUMP BIO-SONAR';
      } else if ((st?.sonarPulse || 0) > 0.35) {
        actionPrompt = '◎ PELAGIAN SONAR ACTIVE';
      }
    } else if (activeMode === 'rapids_surf' || activeMode === 'skimmer') {
      if ((this.skimmer?.timer || 0) < 4.5) {
        actionPrompt = 'CARVE WAKE • SWIPE UP RAMP-LEAP • PULSE CRATES';
      }
    } else if (activeMode === 'vault' && this.vault.status === 'playing') {
      actionPrompt = 'TAP • LOCK HARMONIC RING';
    } else if ((activeMode === 'aqueduct_sanctum' || activeMode === 'puzzle') && this.puzzleRoom?.hud?.line) {
      actionPrompt = this.puzzleRoom.hud.line;
    }

    let displayTimer = this.zenMode ? this.zenElapsed : this.timer;
    let displayLimit = this.timeLimit || this.tower?.timeLimit || 105;
    if (activeMode === 'core_descent') {
      displayTimer = Math.max(0, this.coreDescent.duration - this.coreDescent.timer);
      displayLimit = this.coreDescent.duration;
    } else if (activeMode === 'reef_swim' || activeMode === 'submarine') {
      if (this.subStage) {
        displayTimer = Math.max(0, (1 - (this.subStage.progress || 0)) * this.subStage.rideDuration);
        displayLimit = this.subStage.rideDuration;
      } else {
        displayTimer = Math.max(0, this.sub.duration - this.sub.timer);
        displayLimit = this.sub.duration;
      }
    } else if (activeMode === 'rapids_surf' || activeMode === 'skimmer') {
      displayTimer = Math.max(0, this.skimmer.duration - this.skimmer.timer);
      displayLimit = this.skimmer.duration;
    } else if (activeMode === 'frill_glide' || activeMode === 'glide') {
      const prog = Math.max(0, Math.min(1, this.glideStage?.progress ?? 0));
      displayTimer = Math.max(0, (1 - prog) * 22);
      displayLimit = 22;
    } else if (activeMode === 'vault') {
      displayTimer = Math.max(0, this.vault.timer);
      displayLimit = this.vault.duration;
    }

    const boostMult =
      activeMode === 'rapids_surf' || activeMode === 'skimmer'
        ? this.skimmer.boostMult
        : activeMode === 'frill_glide' || activeMode === 'glide'
        ? Math.max(1, this.glideStage?.mult || 1)
        : Math.max(1, this.comboCount || 1);

    const missionStatus = this._buildMissionStatus();
    const puzType = this.puzzleRoom?.puzzle?.type || this.puzzleDoor?.puzzleType || null;
    const canPeekClue = Boolean(
      (activeMode === 'aqueduct_sanctum' || activeMode === 'puzzle') &&
        this.puzzleDoor &&
        (puzType === 'lights' || puzType === 'bells')
    );

    const biomeKey = this.tower?.theme || 'canyon_river';
    const watershedPct = this.prog?.getWatershedHealth?.(biomeKey) ?? 0;

    this.cb.onHud?.({
      era: 'reboot',
      mode: this.mode,
      gameMode: this.gameMode,
      runType: this.runType,
      zenMode: this.zenMode,
      score: this.score,
      hiScore: this.hiScore,
      lives: this.lives,
      gears: this.prog?.getGears?.() ?? 0,
      timer: displayTimer,
      timeLimit: displayLimit,
      towerId: this.tower ? this.tower.id : 1,
      act: this.tower?.act || 1,
      biome: biomeKey,
      watershedPct,
      overallWatershedPct: this.prog?.getOverallWatershedHealth?.() ?? 0,
      towerName: this.tower ? this.tower.name : 'SUNLIT GORGE SLUICE',
      dirHint,
      altitudePct,
      waterPct,
      waterPurified: this.waterPurified,
      shield: Boolean(p?.shield),
      mutations: this.activeMutations,
      coreDescent: activeMode === 'core_descent' ? {
        progress: this.coreDescent.progress,
        depth: Math.round(this.coreDescent.depth),
        totalDepth: this.coreDescent.totalDepth,
        crystalsSmashed: this.coreDescent.crystalsSmashed,
        crystalsRequired: this.coreDescent.crystalsRequired,
        coresSmashed: this.coreDescent.crystalsSmashed,
        totalCores: this.coreDescent.crystalsRequired,
        seedPlanted: this.coreDescent.seedPlanted,
      } : null,
      coresSmashed: this.coreDescent.crystalsSmashed,
      totalCores: this.coreDescent.crystalsRequired,
      comboMult: Math.max(1, this.comboCount || 1),
      actionPrompt,
      interactKind: interactCtx.kind,
      canPeekClue,
      missionStatus,
      boostMult,
    });
  }

  // ===========================================================================
  // MAIN SIMULATION TICK
  // ===========================================================================

  update(dt) {
    const clampedDt = Math.min(0.05, Math.max(0, dt || 0));
    this.time += clampedDt;
    this.input?.update?.(clampedDt);

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

    for (let i = this.popups.length - 1; i >= 0; i--) {
      const pop = this.popups[i];
      pop.life -= clampedDt;
      if (pop.floor != null) pop.floor += clampedDt * 0.9;
      if (pop.y != null) pop.y -= clampedDt * 34;
      if (pop.life <= 0) this.popups.splice(i, 1);
    }

    for (let i = this.particles.length - 1; i >= 0; i--) {
      const pt = this.particles[i];
      pt.x += pt.vx * clampedDt;
      pt.y += pt.vy * clampedDt;
      pt.vy += (pt.gravity ?? 180) * clampedDt;
      if (pt.col != null) pt.col = wrapCol(pt.col + (pt.vx / 56) * clampedDt);
      if (pt.floor != null) pt.floor -= (pt.vy / 46) * clampedDt;
      pt.life -= clampedDt;
      if (pt.life <= 0) this.particles.splice(i, 1);
    }

    if (this.mode !== 'tower') {
      this.input?.setInteractContext?.(false, '');
    }

    if (this.mode === 'title') {
      this.camCol = wrapCol(this.camCol + clampedDt * 0.52);
      this._syncDynamicLedges(clampedDt, true);
    } else if (this.mode === 'tower') {
      this._updateTower(clampedDt);
    } else if (this.mode === 'core_descent') {
      this._updateCoreDescent(clampedDt);
    } else if (this.mode === 'topple') {
      this._updateTopple(clampedDt);
    } else if (this.mode === 'reef_swim' || this.mode === 'submarine') {
      this._updateSubmarine(clampedDt);
    } else if (this.mode === 'rapids_surf' || this.mode === 'skimmer') {
      this._updateSkimmer(clampedDt);
    } else if (this.mode === 'frill_glide' || this.mode === 'glide') {
      this._updateGlide(clampedDt);
    } else if (this.mode === 'aqueduct_sanctum' || this.mode === 'puzzle') {
      this._updatePuzzle(clampedDt);
    } else if (this.mode === 'vault') {
      this._updateVault(clampedDt);
    }

    this.input?.clearFrame?.();
  }

  // ===========================================================================
  // SPIRE MECHANISMS, PIPE-VALVES & DYNAMIC LEDGES
  // ===========================================================================

  _isWalkableLedge(l) {
    return (
      Boolean(l) &&
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
      return l.floor < floor + 1.6 && l.floor + l.h > floor + 0.1;
    }
    return Math.abs(l.floor - floor) < 0.65;
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
        const grp = l.pipeGroup || l.switchGroup;
        if (grp) {
          const swOn = Boolean(this.switchStates[grp] || this.pipeStates[grp]);
          l.active = l.inverted ? !swOn : swOn;
        } else {
          l.active = true;
        }
      } else if (l.type === 'laserGate') {
        const grp = l.pipeGroup || l.switchGroup;
        if (grp) {
          const swOn = Boolean(this.switchStates[grp] || this.pipeStates[grp]);
          l.active = l.inverted ? swOn : !swOn;
        } else {
          l.active = true;
        }
      } else if (l.type === 'piston') {
        const period = Math.max(1.2, l.phasePeriod || 3.2);
        const u = ((((this.time + (l.phaseOffset || 0)) % period) + period) % period) / period;
        let ext = 1;
        if (u < 0.58) ext = 1;
        else if (u < 0.66) ext = 1 - (u - 0.58) / 0.08;
        else if (u < 0.92) ext = 0;
        else ext = (u - 0.92) / 0.08;
        l.pistonExt = Math.max(0, Math.min(1, ext));
        l.active = l.pistonExt >= 0.42;
      } else if (l.type === 'steamVent') {
        l.active = true;
        const gMult = this.tower?.mechanics?.geyserMult || 1.0;
        const period = Math.max(1.4, (l.phasePeriod || 3.3) / gMult);
        const u = ((((this.time + (l.phaseOffset || 0)) % period) + period) % period) / period;
        const prevSteam = l.steamActive;
        l.steamWarn = u >= 0.48 && u < 0.70;
        l.steamActive = u >= 0.70 && u < 0.96;
        if (!silent && l.steamActive && !prevSteam) {
          if (Math.abs(l.floor - this.gateway.floor) < 5 && Math.abs(colDist(this.gateway.col, l.col + 0.5)) < 4.5) {
            sound?.steamBurst?.();
          }
        }
      }
    }
  }

  _triggerSwitch(sw) {
    if (!sw || sw.cooldown > 0) return;
    sw.cooldown = sw.mode === 'drainValve' ? 2.8 : 0.55;
    sw.targetValveAngle = (sw.targetValveAngle || 0) + Math.PI * 1.5;
    this.towerSwitchesUsed += 1;
    if (typeof sound?.pipeValve === 'function') sound.pipeValve();
    else sound?.switchToggle?.();
    this.input?.haptic?.(16);

    let poweredLift = false;

    if (sw.mode === 'pipeValve') {
      const pGrp = sw.pipeGroup || sw.group || 'pipeA';
      this.pipeStates[pGrp] = true;
      this.switchStates[pGrp] = true;
      sw.active = true;
      for (const el of this.elevators) {
        if (el.pipeGroup === pGrp && !el.powered) {
          el.powered = true;
          poweredLift = true;
        }
      }
      this.addShake(3.8);
      this.addPopup({
        col: sw.col + 0.5,
        floor: sw.floor + 0.85,
        text: poweredLift ? '◈ PIPE PRESSURIZED • LIFT ACTIVE!' : '◈ HYDRO CONDUIT OPEN!',
        color: '#2dd4bf',
        maxLife: 1.35,
      });
    } else if (sw.mode === 'floodValve') {
      sw.active = true;
      this.waterPurified = true;
      const targetW = Number(sw.targetWaterFloor ?? sw.floor + 0.35);
      this.targetWaterFloor = Math.max(this.targetWaterFloor, targetW);
      this.addShake(4.2);
      this._tryUnlockTrophy('drain_plumber');
      this.addPopup({
        col: sw.col + 0.5,
        floor: sw.floor + 0.85,
        text: '≈ FLOODGATE OPEN • SPRING WATER!',
        color: '#38bdf8',
        maxLife: 1.4,
      });
    } else if (sw.mode === 'drainValve') {
      sw.active = true;
      const mech = this.tower?.mechanics || {};
      const minWater = (mech.waterBaseFloor ?? -0.55) - ((mech.waterRiseRate || 0) > 0 ? 0.55 : 0);
      const dropAmt = this.runType === 'flood_rush' ? 2.2 : 1.8;
      this.waterFloor = Math.max(minWater, this.waterFloor - dropAmt);
      this.targetWaterFloor = this.waterFloor;
      if (this.runType === 'flood_rush') {
        this.waterSurgeDelay = Math.max(this.waterSurgeDelay, 2.5);
      }
      this.addShake(3.5);
      this._tryUnlockTrophy('drain_plumber');
      this.addPopup({
        col: sw.col + 0.5,
        floor: sw.floor + 0.75,
        text: `SURGE -${dropAmt.toFixed(1)}F!`,
        color: '#5efce8',
        maxLife: 1.15,
      });
    } else if (sw.mode === 'conveyorFlip') {
      this.switchStates.conv = !this.switchStates.conv;
      sw.active = this.switchStates.conv;
      this._tryUnlockTrophy('belt_flipper');
      this.addPopup({
        col: sw.col + 0.5,
        floor: sw.floor + 0.75,
        text: 'CURRENT REVERSED!',
        color: '#fbbf24',
      });
    } else {
      const grp = sw.group || 'red';
      this.switchStates[grp] = !this.switchStates[grp];
      sw.active = this.switchStates[grp];
      this.addPopup({
        col: sw.col + 0.5,
        floor: sw.floor + 0.75,
        text: `${grp.toUpperCase()} SLUICE ${sw.active ? 'OPEN' : 'SHUT'}`,
        color: grp === 'cyan' ? '#5efce8' : '#fb7185',
      });
    }
    this._emitProgEvent('switch_trigger', {
      mode: sw.mode || 'toggle',
      group: sw.group || 'red',
      poweredLift,
    });
    this._syncDynamicLedges(0, true);
  }

  // ===========================================================================
  // GATEWAY TAIL-WHIP SPIN & HYDRO-PULSE COMBAT
  // ===========================================================================

  _executeTailWhip() {
    const p = this.gateway;
    const isTriple = this.hasMutation('triple_whip');
    const dur = isTriple ? 0.40 : 0.32;
    p.tailWhipTimer = dur;
    p.whipTimer = dur;
    p.tailWhip = 1.0;
    p.whipCooldown = isTriple ? 0.30 : 0.42;
    p.whipBuffer = 0;
    p.squashX = 1.14;
    p.squashY = 0.90;
    this.towerWhiplashes += 1;

    if (typeof sound?.tailWhip === 'function') sound.tailWhip();
    else if (typeof sound?.whip === 'function') sound.whip();
    else sound?.jump?.();
    this.input?.haptic?.(16);
    this._emitProgEvent('tail_whip', { towerId: this.tower?.id || 1 });

    const reachCols = isTriple ? 1.75 : 1.32;
    const reachFloors = 0.98;

    const screenPos = this._colFloorToScreen(p.col, p.floor + 0.45, 14);
    if (screenPos) {
      this._spawnParticles(
        screenPos.x,
        screenPos.y,
        isTriple ? '#5efce8' : '#2dd4bf',
        isTriple ? 18 : 12,
        130,
        90,
        p.col,
        p.floor + 0.45
      );
    }

    // 1. Spin adjacent Pipe-Valves & Switches!
    for (const sw of this.switches) {
      if (sw.cooldown <= 0 && Math.abs(sw.floor - p.floor) <= reachFloors && Math.abs(colDist(p.col, sw.col + 0.5)) <= reachCols) {
        this._triggerSwitch(sw);
      }
    }

    // 2. Crack adjacent Siphon Lock Crates ('box')!
    for (const l of this.ledges) {
      if (!l.gone && l.active && l.type === 'box') {
        const hitF = l.h ? p.floor >= l.floor - 0.4 && p.floor <= l.floor + l.h + 0.4 : Math.abs(l.floor - p.floor) <= reachFloors;
        if (hitF && Math.abs(colDist(p.col, l.col + 0.5)) <= reachCols) {
          l.gone = true;
          l.active = false;
          l.respawnTimer = Infinity;
          this._scoreActionHit(75, { col: l.col + 0.5, floor: l.floor + 0.6 }, '#fde047');
          this._tryUnlockTrophy('box_breaker');
          this.addShake(3.8);
          if (typeof sound?.hitBlock === 'function') sound.hitBlock();
          else sound?.hitEnemy?.();
        }
      }
    }

    // 3. Deflect Barnacle Mortar Bubbles!
    for (const proj of this.enemyProjectiles) {
      if (
        !proj.deflected &&
        Math.abs(proj.floor - (p.floor + 0.4)) <= reachFloors + 0.25 &&
        Math.abs(colDist(p.col, proj.col)) <= reachCols + 0.25
      ) {
        proj.deflected = true;
        proj.dir = -proj.dir || p.facing;
        proj.speed = isTriple ? 13.5 : 10.8;
        proj.life = 1.6;
        this._scoreActionHit(120, { col: proj.col, floor: proj.floor + 0.5 }, '#5efce8');
        this.addPopup({
          col: proj.col,
          floor: proj.floor + 0.9,
          text: '◎ DEFLECTED!',
          color: '#5efce8',
          maxLife: 1.0,
        });
        this.addShake(3.5);
        sound?.deflect?.();
      }
    }

    // 4. Flip Snap-Crabs & Strike Enemies / Siphon Wardens!
    for (const en of this.enemies) {
      if (en.dead) continue;
      if (Math.abs(en.floor - p.floor) <= reachFloors && Math.abs(colDist(p.col, en.col)) <= reachCols) {
        this._applyAttackToEnemy(en, 'whip');
      }
    }
  }

  _applyAttackToEnemy(en, source = 'pulse') {
    const pos = this._colFloorToScreen(en.col, en.floor + 0.35, 14);

    if (en.type === 'snap_crab') {
      en.flipped = true;
      en.flipTimer = 5.6;
      en.stunTimer = 5.6;
      this.towerEnemiesStunned += 1;
      this._scoreActionHit(100, { col: en.col, floor: en.floor + 0.6 }, '#2dd4bf');
      this.addPopup({
        col: en.col,
        floor: en.floor + 1.05,
        text: '▲ FLIPPED SPRINGBOARD!',
        color: '#5efce8',
        maxLife: 1.15,
      });
      this.addShake(3.5);
      if (pos) this._spawnParticles(pos.x, pos.y, '#2dd4bf', 10, 105, 160, en.col, en.floor + 0.35);
      sound?.stunEnemy?.();
      this._tryUnlockTrophy('roller_shatter');
      this._emitProgEvent('snowball_hit', { kind: 'snap_crab', runType: this.runType, combo: this.comboCount });
      return;
    }

    if (en.type === 'siphon_warden') {
      if (en.bossPhase === 'patrol' && source === 'pulse') {
        // Hydro-Pulse cracks shield into early vulnerable window!
        en.bossPhase = 'vulnerable';
        en.shielded = false;
        en.bossTimer = 2.6;
        this.addShake(2.5);
        this.addPopup({ col: en.col, floor: en.floor + 0.9, text: 'SHIELD CRACKED!', color: '#67e8f9', maxLife: 0.9 });
        sound?.stunEnemy?.();
        return;
      }
      en.hp = Math.max(0, (en.hp || 1) - 1);
      en.stunTimer = 0.55;
      this.addShake(5.5);
      if (pos) this._spawnParticles(pos.x, pos.y, '#f472b6', 14, 130, 170, en.col, en.floor + 0.5);
      if (en.hp <= 0) {
        en.dead = true;
        en.deathTimer = 0.45;
        this.towerEnemiesDestroyed += 1;
        this._awardGears(8);
        this._scoreActionHit(1500, { col: en.col, floor: en.floor + 0.9 }, '#fde047');
        this.cb.onBanner?.('SIPHON WARDEN SHATTERED!', '+8 HYDRO-GEARS • CROWN CLEAR');
        this._emitProgEvent('warden_defeat', { towerId: this.tower?.id || 1 });
        sound?.hitEnemy?.();
      } else {
        this._awardGears(1);
        this._scoreActionHit(300, { col: en.col, floor: en.floor + 0.8 }, '#fb7185');
        this.addPopup({
          col: en.col,
          floor: en.floor + 1.25,
          text: `WARDEN ${en.hp}/${en.maxHp}`,
          color: '#fde047',
          maxLife: 1.0,
        });
        sound?.hitEnemy?.();
      }
      return;
    }

    if (en.type === 'barnacle_mortar') {
      if (source === 'whip' || source === 'deflect' || en.openAmount > 0.25) {
        en.dead = true;
        en.deathTimer = 0.3;
        this.towerEnemiesDestroyed += 1;
        this._scoreActionHit(150, { col: en.col, floor: en.floor + 0.6 }, '#fb923c');
        this.addShake(4.2);
        if (pos) this._spawnParticles(pos.x, pos.y, '#fb923c', 12, 115, 180, en.col, en.floor + 0.4);
        sound?.hitEnemy?.();
      } else {
        en.stunTimer = 2.6;
        sound?.stunEnemy?.();
      }
      return;
    }

    if (en.type === 'gulp_hopper') {
      if (source === 'whip' || en.stunTimer > 0) {
        en.dead = true;
        en.deathTimer = 0.28;
        this.towerEnemiesDestroyed += 1;
        this._scoreActionHit(100, { col: en.col, floor: en.floor + 0.5 }, '#38bdf8');
        sound?.hitEnemy?.();
      } else {
        en.stunTimer = 3.4;
        this.towerEnemiesStunned += 1;
        this._scoreActionHit(60, { col: en.col, floor: en.floor + 0.5 }, '#a7f3d0');
        sound?.stunEnemy?.();
      }
      this.addShake(2.4);
      if (pos) this._spawnParticles(pos.x, pos.y, '#a7f3d0', 8, 85, 155, en.col, en.floor + 0.3);
      this._tryUnlockTrophy('bouncer_freeze');
      this._emitProgEvent('snowball_hit', { kind: 'gulp_hopper', runType: this.runType, combo: this.comboCount });
      return;
    }

    // volt_eel, rail_skater, vent_stalker
    en.stunTimer = 3.0;
    this.towerEnemiesStunned += 1;
    this._scoreActionHit(85, { col: en.col, floor: en.floor + 0.5 }, '#fbbf24');
    this.addShake(2.6);
    if (pos) this._spawnParticles(pos.x, pos.y, '#fbbf24', 9, 95, 165, en.col, en.floor + 0.35);
    sound?.stunEnemy?.();
    this._tryUnlockTrophy('sentinel_short');
    this._emitProgEvent('snowball_hit', { kind: en.type, runType: this.runType, combo: this.comboCount });
  }

  // ===========================================================================
  // CORE CYLINDRICAL SPIRE GAMEPLAY & CONTINUOUS WALKABLE STAIRCASES
  // ===========================================================================

  _updateTower(dt) {
    const p = this.gateway;
    const inp = this.input.state;
    const preInteract = this._evaluateInteractContext();
    this.input?.setInteractContext?.(preInteract.canInteract, preInteract.kind);

    if (this.runType === 'daily_tide' && this.dailyMeta) {
      this.dailyMeta.elapsedSec += dt;
    }

    // Bubble Aegis bio-mutation auto-regeneration
    if (this.hasMutation('bubble_aegis') && !p.shield) {
      this._aegisRechargeTimer += dt;
      if (this._aegisRechargeTimer >= 18.0) {
        this._aegisRechargeTimer = 0;
        p.shield = true;
        this.addPopup({
          col: p.col,
          floor: p.floor + 1.3,
          text: '◈ BUBBLE AEGIS RESTORED!',
          color: '#67e8f9',
          maxLife: 1.2,
        });
      }
    }

    // Cooldowns & spring poses
    if (p.invuln > 0) p.invuln = Math.max(0, p.invuln - dt);
    if (p.fireCooldown > 0) p.fireCooldown = Math.max(0, p.fireCooldown - dt);
    if (p.whipCooldown > 0) p.whipCooldown = Math.max(0, p.whipCooldown - dt);
    if (p.tailWhipTimer > 0) {
      p.tailWhipTimer = Math.max(0, p.tailWhipTimer - dt);
      p.whipTimer = p.tailWhipTimer;
      p.tailWhip = p.tailWhipTimer / 0.34;
    } else {
      p.whipTimer = 0;
      p.tailWhip = 0;
    }
    if (p.grappleTimer > 0) {
      p.grappleTimer = Math.max(0, p.grappleTimer - dt);
      if (p.grappleTimer <= 0) p.grappleTarget = null;
    }
    if (p.knockbackTimer > 0) p.knockbackTimer = Math.max(0, p.knockbackTimer - dt);
    if (p.muzzleFlash > 0) p.muzzleFlash = Math.max(0, p.muzzleFlash - dt);
    if (p.stepUpCooldown > 0) p.stepUpCooldown = Math.max(0, p.stepUpCooldown - dt);
    if (p.hurtTimer > 0) p.hurtTimer = Math.max(0, p.hurtTimer - dt);
    if (p.landImpact > 0) p.landImpact = Math.max(0, p.landImpact - dt * 9.5);

    for (const gr of this.grappleRings) {
      if (gr._cooldown > 0) gr._cooldown = Math.max(0, gr._cooldown - dt);
    }
    for (const sw of this.switches) {
      if (sw.cooldown > 0) sw.cooldown = Math.max(0, sw.cooldown - dt);
      if (sw.valveAngle !== sw.targetValveAngle) {
        sw.valveAngle = approach(sw.valveAngle || 0, sw.targetValveAngle || 0, 9.5 * dt);
      }
    }

    const springRate = Math.min(1, dt * 15);
    p.squashX += (1 - p.squashX) * springRate;
    p.squashY += (1 - p.squashY) * springRate;

    // 3-Stage Conduit Archway Traversal ('enter' -> 'transit' -> 'exit')
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
        this.camCol = wrapCol(this.camCol + dc * Math.min(1, dt * 12));
        const tf = Math.max(1.5, p.tunnelTarget.floor + 1.45);
        this.camFloor += (tf - this.camFloor) * Math.min(1, dt * 9.5);
      }
      if (p.tunnelTimer <= 0 && p.tunnelTarget) {
        p.col = wrapCol(p.tunnelTarget.col + 0.5);
        p.floor = p.tunnelTarget.floor;
        p.vx = 0;
        p.vy = 0;
        p.hidden = false;
        p.onElevator = null;
        p.wallScamper = false;
        p.climbing = false;
        const exitSupport = this._findLedgeAt(p.col, p.floor);
        p.onGround = Boolean(exitSupport);
        p.doorPhase = 'exit';
        p.tunnelTimer = 0.16;
        p.tunnelTarget = null;
        p.invuln = Math.max(p.invuln || 0, 1.5);
        this._upDoorLatch = true;
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
        this._upDoorLatch = true;
      }
    }

    // Spire Clock (paused in Sanctums; infinite in Zen / Sanctum Trials)
    if (this.zenMode || this.runType === 'sanctum_trials') {
      this.zenElapsed += dt;
    } else {
      const prevWhole = Math.ceil(this.timer);
      this.timer = Math.max(0, this.timer - dt);
      const nextWhole = Math.ceil(this.timer);
      if (this.timer > 0 && this.timer <= 15 && nextWhole < prevWhole) {
        sound?.timerTick?.();
      }
      if (this.timer <= 0) {
        this._loseLife('SIPHON CLOCK EXPIRED!');
        return;
      }
    }

    // Environmental Spire Mechanics (Purified Floodgate Leveling, Rising Surge, Wind, Lightning)
    const mech = this.tower?.mechanics || {};
    if (this.waterPurified && this.waterFloor < this.targetWaterFloor) {
      this.waterFloor = Math.min(this.targetWaterFloor, this.waterFloor + 1.45 * dt);
    } else if (mech.waterRiseRate > 0) {
      if (this.waterSurgeDelay > 0) {
        this.waterSurgeDelay = Math.max(0, this.waterSurgeDelay - dt);
      } else {
        const exitDoor = this.tower?.doors?.find((d) => d.isExit);
        const maxWater = (exitDoor ? exitDoor.floor : this.tower.floors - 2) - 1.1;
        const accel = this.runType === 'flood_rush' ? 1 + Math.min(0.55, this.zenElapsed * 0.006) : 1;
        const rate = (this.zenMode ? mech.waterRiseRate * 0.45 : mech.waterRiseRate) * accel;
        this.waterFloor = Math.min(maxWater, this.waterFloor + rate * dt);
      }
    }

    if (mech.windForce > 0) {
      const period = Math.max(2.0, mech.windPeriod || 6.0);
      this.windCurrent = Math.sin((this.time * Math.PI * 2) / period) * mech.windForce;
    } else {
      this.windCurrent = 0;
    }

    if (mech.lightningInterval > 0) {
      this._lightningTimer -= dt;
      if (this._lightningTimer <= 0) {
        this._lightningTimer = mech.lightningInterval * (0.75 + Math.random() * 0.55);
        this.lightningFlash = 1.0;
        this.addShake(2.2);
        sound?.thunderCrack?.();
      }
    }

    // Crumbling stones
    for (const l of this.ledges) {
      if (l.crumbling && !l.gone) {
        l.crumbleTimer -= dt;
        if (l.crumbleTimer <= 0) {
          l.gone = true;
          l.crumbling = false;
          l.shake = false;
          l.respawnTimer = this.runType === 'purist' ? 6.0 : 3.8;
          sound?.crumble?.();
          this.addShake(3.8);
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

    this._syncDynamicLedges(dt, false);

    // Mechanical Twin-Rail Elevators (respecting Pipe-Valve `el.powered`)
    for (const el of this.elevators) {
      if (el.powered === false) continue;
      if (el.recallTarget !== null) {
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
        if (playerManualSteer) el.dwellTimer = 0;
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

    // Horizontal & Vertical Input Intents
    let moveIntent = 0;
    if (Math.abs(inp.analogX || 0) > 0.08) {
      moveIntent = Math.max(-1, Math.min(1, inp.analogX));
    } else if (inp.left) {
      moveIntent = -1;
    } else if (inp.right) {
      moveIntent = 1;
    }

    let vertIntent = 0;
    if (Math.abs(inp.analogY || 0) > 0.18) {
      vertIntent = -Math.max(-1, Math.min(1, inp.analogY)); // +1 up, -1 down
    } else if (inp.up) {
      vertIntent = 1;
    } else if (inp.down) {
      vertIntent = -1;
    }

    if (moveIntent < -0.08) p.facing = -1;
    else if (moveIntent > 0.08) p.facing = 1;

    const hasGeckoMut = this.hasMutation('gecko_sprint');
    const walkSpeed = BASE_WALK_SPEED * (hasGeckoMut ? 1.22 : 1.0);

    // -------------------------------------------------------------------------
    // GECKO WALL-SCAMPER STRIP ATTACHMENT & CLIMBING
    // -------------------------------------------------------------------------
    if (!p.wallScamper && !p.onElevator) {
      const wantClimb = vertIntent > 0.25 || (!p.onGround && Math.abs(vertIntent) > 0.2);
      if (wantClimb) {
        const hitStrip = this.wallStrips.find(
          (ws) =>
            Math.abs(colDist(p.col, ws.col + 0.5)) < 0.58 &&
            p.floor >= ws.minFloor - 0.25 &&
            p.floor <= ws.maxFloor + 0.2
        );
        if (hitStrip) {
          p.wallScamper = true;
          p.climbing = true;
          p.activeWallStrip = hitStrip;
          p.col = wrapCol(hitStrip.col + 0.5);
          p.vx = 0;
          p.vy = 0;
          p.onGround = false;
          p.isSwimming = false;
          p.airJumpsLeft = this.hasMutation('hydro_double_jump') ? 1 : 0;
          this._emitProgEvent('wall_scamper', { towerId: this.tower?.id || 1 });
        }
      }
    }

    const jumpEdge = this.input.consumeJustPressed('jump');
    const whipEdge = this.input.consumeJustPressed('whip');

    if (p.wallScamper && p.activeWallStrip) {
      const ws = p.activeWallStrip;
      const climbRate = hasGeckoMut ? 5.25 : 4.15;
      p.floor = Math.max(ws.minFloor, Math.min(ws.maxFloor, p.floor + vertIntent * climbRate * dt));
      p.col = wrapCol(ws.col + 0.5);
      p.vx = 0;
      p.vy = 0;
      p.coyoteTimer = COYOTE_WINDOW;

      if (Math.abs(vertIntent) > 0.15) {
        this._footstepAccum += Math.abs(vertIntent) * climbRate * dt;
        if (this._footstepAccum >= 0.65) {
          this._footstepAccum = 0;
          sound?.step?.();
        }
      }

      // Leap off Wall-Strip or step off onto adjacent terrace at top/bottom!
      if (jumpEdge) {
        p.wallScamper = false;
        p.climbing = false;
        p.activeWallStrip = null;
        p.vy = BASE_JUMP_VY;
        p.vx = (Math.abs(moveIntent) > 0.1 ? Math.sign(moveIntent) : p.facing) * walkSpeed;
        p.jumpStartCol = p.col;
        p.jumpStartFloor = p.floor;
        p.jumpCutEligible = true;
        sound?.jump?.();
      } else if (Math.abs(moveIntent) > 0.35 && (p.floor >= ws.maxFloor - 0.15 || p.floor <= ws.minFloor + 0.15)) {
        p.wallScamper = false;
        p.climbing = false;
        p.activeWallStrip = null;
        p.vx = Math.sign(moveIntent) * walkSpeed;
        const stepOffLedge = this._findLedgeAt(wrapCol(p.col + Math.sign(moveIntent) * 0.6), Math.round(p.floor));
        if (stepOffLedge) {
          p.floor = stepOffLedge.floor;
          p.onGround = true;
        } else {
          p.vy = 6.2;
        }
      }
    }

    // Surface friction, ice, conveyor flumes & wind shelter
    const underLedge = p.onGround && !p.isSwimming ? this._findLedgeAt(p.col, p.floor) : null;
    const isIce = Boolean(underLedge && underLedge.type === 'ice' && !hasGeckoMut);
    const convPush = underLedge
      ? underLedge.type === 'conveyorR'
        ? 1.65
        : underLedge.type === 'conveyorL'
        ? -1.65
        : 0
      : 0;

    let windPush = this.windCurrent;
    if (windPush !== 0) {
      const sheltered =
        p.wallScamper ||
        this.tower?.doors?.some(
          (d) => Math.abs(d.floor - p.floor) < 0.65 && Math.abs(colDist(p.col, d.col + 0.5)) < 0.7
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

    const rawLiveHeld =
      typeof this.input?.isLiveHorizHeld === 'function'
        ? this.input.isLiveHorizHeld()
        : typeof this.input?.isLiveHorizHeld === 'boolean'
        ? this.input.isLiveHorizHeld
        : Math.abs(moveIntent) > 0.05;
    const liveHorizHeld = Boolean(rawLiveHeld && Math.abs(moveIntent) > 0.05);

    // Smart Descending Island Brake
    let descendingIslandBrake = false;
    const horizSign = Math.abs(p.vx) > 0.15 ? Math.sign(p.vx) : Math.sign(moveIntent);
    if (!p.onGround && !p.wallScamper && p.vy < -0.5 && horizSign !== 0 && !liveHorizHeld) {
      const underAirLedge = this.ledges.find(
        (l) =>
          this._isWalkableLedge(l) &&
          Math.abs(colDist(p.col, l.col + 0.5)) < 0.44 &&
          p.floor >= l.floor - 0.05 &&
          p.floor - l.floor <= 0.62
      );
      if (underAirLedge && underAirLedge.type !== 'ice') {
        const adjCol = wrapCol(underAirLedge.col + horizSign);
        const hasAdjStone = this.ledges.some(
          (n) =>
            this._isWalkableLedge(n) &&
            wrapCol(n.col) === adjCol &&
            Math.abs(n.floor - underAirLedge.floor) <= 1.05
        );
        if (!hasAdjStone) {
          descendingIslandBrake = true;
        }
      }
    }

    if (!p.wallScamper) {
      const effectiveMoveIntent = descendingIslandBrake ? 0 : moveIntent;
      const effSpeed = p.isSwimming ? walkSpeed * 0.94 : walkSpeed;
      const targetVx = effectiveMoveIntent * effSpeed;

      if ((p.knockbackTimer || 0) <= 0 && (p.grappleTimer || 0) <= 0) {
        const desiredVx = targetVx + convPush + windPush;
        const isCounterSteer = effectiveMoveIntent * p.vx < -0.1;
        const rate = !p.onGround
          ? descendingIslandBrake
            ? 36.0
            : Math.abs(effectiveMoveIntent) > 0.05
            ? 40.0
            : 29.0
          : isIce
          ? Math.abs(effectiveMoveIntent) > 0.05
            ? 15.0
            : 8.0
          : Math.abs(effectiveMoveIntent) > 0.05
          ? isCounterSteer
            ? 78.0
            : 48.0
          : 62.0;
        p.vx = approach(p.vx, desiredVx, rate * dt);
      }

      const prevCol = p.col;
      const nextCol = wrapCol(p.col + p.vx * dt);
      const blockingBarrier = this.ledges.find(
        (l) =>
          this._blocksHorizontalBody(l, p.floor) &&
          Math.abs(colDist(nextCol, l.col + 0.5)) < 0.52 &&
          Math.abs(colDist(nextCol, l.col + 0.5)) < Math.abs(colDist(p.col, l.col + 0.5)) + 0.002
      );
      if (!blockingBarrier) {
        p.col = nextCol;
      } else {
        p.vx = 0;
        if (blockingBarrier.type === 'laserGate' && p.invuln <= 0) {
          this._applyHazardHit(blockingBarrier.col + 0.5);
        }
      }

      // -----------------------------------------------------------------------
      // BUTTER-SMOOTH REAL STAIRCASE TRAVERSAL (RUN UP & DOWN WITHOUT JUMPING!)
      // -----------------------------------------------------------------------
      p.onStairs = false;
      p.stairSlope = 0;
      if (p.onGround && !p.onElevator && !p.isSwimming) {
        const stepDir = Math.abs(p.vx) > 0.08 ? Math.sign(p.vx) : Math.sign(moveIntent);
        const stairSample = this._sampleStairSurface(p.col, p.floor, 0.56);
        if (stairSample) {
          p.floor = stairSample.floor;
          p.onStairs = stairSample.onRamp;
          const upDir = stairSample.upDir;
          p.stairSlope = stepDir !== 0 ? (stepDir === upDir ? 1 : -1) : 1;
          p.stairDir = upDir;
          if (Math.abs(p.vx) > 0.05) {
            p.stairPhase = (p.stairPhase + Math.abs(p.vx) * dt * 2.2) % 1;
          }
          this._registerLedgeStand(stairSample.supportLedge);
        }

        // Organic 6-variation footstep cadence on grounded movement
        const movedCols = Math.abs(colDist(prevCol, p.col));
        if (movedCols > 0.001) {
          this._footstepAccum += movedCols;
          if (this._footstepAccum >= 0.56) {
            this._footstepAccum = 0;
            sound?.step?.();
          }
        }
      }
    }

    // Step-on Switches & Collectibles Pickup (+ Tidal Magnet pull!)
    for (const sw of this.switches) {
      const inside = Math.abs(sw.floor - p.floor) < 0.68 && Math.abs(colDist(p.col, sw.col + 0.5)) < 0.58;
      if (inside && !sw._playerInside) {
        this._triggerSwitch(sw);
      }
      sw._playerInside = inside;
    }

    const magnetActive = this.hasMutation('tidal_magnet');
    for (const c of this.collectibles) {
      if (c.collected) continue;
      const dCol = colDist(c.col + 0.5, p.col);
      const dFlr = p.floor - c.floor;
      if (magnetActive && Math.abs(dCol) < 2.6 && Math.abs(dFlr) < 1.8) {
        c.col = wrapCol(c.col + dCol * Math.min(1, dt * 7.5));
        c.floor += dFlr * Math.min(1, dt * 7.5);
      }
      if (Math.abs(c.floor - p.floor) < 0.85 && Math.abs(colDist(p.col, c.col + 0.5)) < 0.72) {
        this._collectSpireItem(c);
      }
    }

    // Auto-check adjacent Workbench / Reliquary Chest
    const wb = this.tower?.workbench;
    if (wb && !wb.crafted) {
      const reqParts = Math.max(1, this.salvagePartsTotal || 3);
      if (Math.abs(wb.floor - p.floor) < 0.82 && Math.abs(colDist(p.col, wb.col + 0.5)) < 0.72) {
        if (this.salvagePartsCollected >= reqParts) {
          this._craftWorkbenchDynamo(wb);
        } else if (this._stationHintCooldown <= 0) {
          this._stationHintCooldown = 2.6;
          this.addPopup({
            col: wb.col + 0.5,
            floor: wb.floor + 1.35,
            text: `NEED PARTS (${this.salvagePartsCollected}/${reqParts})`,
            color: '#bae6fd',
            maxLife: 1.15,
          });
        }
      }
    }

    const ch = this.tower?.treasureChest;
    if (ch && !ch.opened) {
      const reqKeys = Math.max(1, this.compassKeysTotal || 3);
      if (Math.abs(ch.floor - p.floor) < 0.82 && Math.abs(colDist(p.col, ch.col + 0.5)) < 0.72) {
        if (this.compassKeysCollected >= reqKeys) {
          this._openTreasureChest(ch);
        } else if (this._stationHintCooldown <= 0) {
          this._stationHintCooldown = 2.6;
          this.addPopup({
            col: ch.col + 0.5,
            floor: ch.floor + 1.35,
            text: `NEED KEYS (${this.compassKeysCollected}/${reqKeys})`,
            color: '#fde68a',
            maxLife: 1.15,
          });
        }
      }
    }

    // Door / Crown Valve / Sanctum / Vault UP Interaction
    const upEdge = Boolean(this.input.consumeJustPressed?.('up'));
    if (!inp.up) this._upDoorLatch = false;
    if (upEdge) this._upDoorLatch = false;
    const wantsUpInteract =
      !p.wallScamper &&
      (p.onGround || p.coyoteTimer > 0) &&
      (upEdge || (Boolean(inp.up) && !this._upDoorLatch && Math.abs(p.vx) <= 4.3));

    if (wantsUpInteract) {
      const door = this.tower?.doors?.find(
        (d) => Math.abs(d.floor - p.floor) < 0.62 && Math.abs(colDist(p.col, d.col + 0.5)) < 0.84
      );
      if (door) {
        if (door.isExit) {
          this._upDoorLatch = true;
          p.jumpBufferTimer = 0;
          p.vx = 0;
          p.col = wrapCol(door.col + 0.5);
          const missionType = this._getCasualMissionType(this.tower);
          if (missionType === 'tower_repair' && !this.dynamoCrafted && !this.tower?.workbench?.crafted) {
            sound?.vaultTick?.(false);
            this.input?.haptic?.(24);
            this.cb.onBanner?.('CROWN SLUICE OFFLINE', 'CRAFT DYNAMO AT WORKBENCH');
            this.addPopup({
              col: door.col + 0.5,
              floor: door.floor + 1.35,
              text: 'CRAFT DYNAMO AT WORKBENCH!',
              color: '#fbbf24',
              maxLife: 1.4,
            });
            return;
          }
          const isSanctumRun = Boolean(this.runType === 'sanctum_trials' || this.tower?.casual);
          const optionalIncomplete =
            isSanctumRun &&
            ((missionType === 'treasure_hunt' && !this.treasureChestOpened && !this.tower?.treasureChest?.opened) ||
              (missionType === 'curio_survey' && this.curiosCollectedHere < Math.max(1, this.curiosTotalHere || 4)) ||
              (missionType === 'puzzle_architect' &&
                !this.towerVaultCleared &&
                !this.vaultCrackedThisTower &&
                this.tower?.doors?.some((d) => (d.isRune && !d.solved) || d.isVault)));
          if (optionalIncomplete && (this._casualSkipConfirmTimer || 0) <= 0) {
            this._casualSkipConfirmTimer = 3.5;
            sound?.vaultTick?.(false);
            this.cb.onBanner?.('TRIAL INCOMPLETE', 'PRESS UP AGAIN TO PURIFY SPIRE');
            this.addPopup({
              col: door.col + 0.5,
              floor: door.floor + 1.35,
              text: 'PRESS UP AGAIN TO DEPART',
              color: '#fde047',
              maxLife: 1.5,
            });
            return;
          }
          this._casualSkipConfirmTimer = 0;
          this._enterCrownValve();
          return;
        }
        if (door.isRune && !door.solved) {
          this._upDoorLatch = true;
          p.jumpBufferTimer = 0;
          p.vx = 0;
          p.vy = 0;
          p.col = wrapCol(door.col + 0.5);
          p.floor = door.floor;
          this._enterPuzzleRoom(door);
          return;
        }
        if (door.isVault && !this.towerVaultCleared) {
          this._upDoorLatch = true;
          p.jumpBufferTimer = 0;
          p.vx = 0;
          p.vy = 0;
          p.col = wrapCol(door.col + 0.5);
          p.floor = door.floor;
          this.vaultReturnState = {
            col: door.col + 0.5,
            floor: door.floor,
            doorId: door.id,
          };
          sound?.door?.();
          this.startMiniGame('vault', false);
          return;
        }
        if (door.targetId) {
          const target = this.tower.doors.find((d) => d.id === door.targetId);
          if (target) {
            this._upDoorLatch = true;
            p.jumpBufferTimer = 0;
            this.towerDoorsUsed += 1;
            const tStyle = door.tunnelStyle || target.tunnelStyle || 'stone';
            p.col = wrapCol(door.col + 0.5);
            p.floor = door.floor;
            p.doorPhase = 'enter';
            p.enteringDoor = 0.1;
            p.tunnelTimer = 0.14;
            p.tunnelTarget = target;
            p.vx = 0;
            p.vy = 0;
            sound?.door?.();
            this._tryUnlockTrophy('tunnel_runner');
            if (tStyle === 'sparkArch') this._tryUnlockTrophy('spark_diver');
            this._emitProgEvent('door_enter', { tunnelStyle: tStyle, decoy: false });
            return;
          }
        }
      }
    }

    // Coyote time & Jump buffering (185ms coyote / 150ms buffer)
    if (p.onGround || p.isSwimming) {
      p.coyoteTimer = COYOTE_WINDOW;
      p.airJumpsLeft = this.hasMutation('hydro_double_jump') ? 1 : 0;
    } else if (!p.wallScamper) {
      p.coyoteTimer = Math.max(0, p.coyoteTimer - dt);
    }

    if (jumpEdge && !p.wallScamper) {
      p.jumpBufferTimer = JUMP_BUFFER_WINDOW;
    } else {
      p.jumpBufferTimer = Math.max(0, p.jumpBufferTimer - dt);
    }

    // Tail-Grapple Swing Ring Snag (airborne near ring + Jump/Whip OR apex carry across chasm!)
    if (!p.onGround && !p.wallScamper && (p.grappleTimer || 0) <= 0) {
      const nearRing = this.grappleRings.find(
        (gr) =>
          (gr._cooldown || 0) <= 0 &&
          Math.abs(colDist(p.col, gr.col)) < 1.35 &&
          Math.abs(p.floor - gr.floor) < 1.32
      );
      const autoApexSnag =
        nearRing && Math.abs(moveIntent) > 0.25 && p.vy < 2.2 && p.vy > -4.8 && p.floor < nearRing.floor + 0.3;
      if (nearRing && (jumpEdge || whipEdge || p.jumpBufferTimer > 0 || autoApexSnag)) {
        nearRing._cooldown = 1.1;
        p.grappleTarget = nearRing;
        p.grappleTimer = 0.28;
        p.jumpBufferTimer = 0;
        const swingDir = Math.abs(moveIntent) > 0.1 ? Math.sign(moveIntent) : p.facing;
        p.facing = swingDir;
        p.col = wrapCol(nearRing.col);
        p.floor = Math.max(p.floor, nearRing.floor - 0.35);
        p.vx = swingDir * (walkSpeed * 1.26);
        p.vy = BASE_JUMP_VY;
        p.jumpCutEligible = false;
        p.airJumpsLeft = this.hasMutation('hydro_double_jump') ? 1 : 0;
        p.squashX = 0.85;
        p.squashY = 1.18;
        if (typeof sound?.grappleSwing === 'function') sound.grappleSwing();
        else sound?.jump?.();
        this.input?.haptic?.(20);
        this._emitProgEvent('grapple_swing', { towerId: this.tower?.id || 1 });
        this.addPopup({
          col: nearRing.col,
          floor: nearRing.floor + 0.85,
          text: '∆ TAIL GRAPPLE!',
          color: '#2dd4bf',
          maxLife: 0.9,
        });
      }
    }

    // Grounded / Swimming / Coyote Jump OR Hydro-Jet Double Jump!
    if (!p.wallScamper && p.jumpBufferTimer > 0) {
      if (p.onGround || p.coyoteTimer > 0 || p.isSwimming) {
        p.vy = p.isSwimming ? BASE_JUMP_VY * 1.04 : BASE_JUMP_VY;
        p.isSwimming = false;
        p.onStairs = false;
        p.stairSlope = 0;
        p.jumpCutEligible = true;
        p.steamBoostActive = false;
        p.jumpStartCol = p.col;
        p.jumpStartFloor = p.floor;
        p.onGround = false;
        p.onElevator = null;
        p.coyoteTimer = 0;
        p.jumpBufferTimer = 0;
        p.landImpact = 0;
        p.squashX = 0.86;
        p.squashY = 1.16;
        sound?.jump?.();
      } else if ((p.airJumpsLeft || 0) > 0) {
        p.airJumpsLeft -= 1;
        p.vy = BASE_JUMP_VY;
        p.jumpCutEligible = true;
        p.jumpStartCol = p.col;
        p.jumpStartFloor = p.floor;
        p.jumpBufferTimer = 0;
        p.squashX = 0.84;
        p.squashY = 1.18;
        const pos = this._colFloorToScreen(p.col, p.floor, 12);
        if (pos) this._spawnParticles(pos.x, pos.y, '#38bdf8', 12, 110, 150, p.col, p.floor);
        sound?.jump?.();
        this.input?.haptic?.(16);
      }
    }

    // 360° Lizard Tail-Whip Input
    if (whipEdge) {
      p.whipBuffer = 0.16;
    } else {
      p.whipBuffer = Math.max(0, (p.whipBuffer || 0) - dt);
    }
    if (p.whipBuffer > 0 && p.whipCooldown <= 0) {
      this._executeTailWhip();
    }

    // Wrist Hydro-Pulse Input (or Workbench / Chest craft)
    if (this.input.consumeJustPressed('fire')) {
      const wbFire =
        this.tower?.workbench &&
        !this.tower.workbench.crafted &&
        Math.abs(this.tower.workbench.floor - p.floor) < 0.85 &&
        Math.abs(colDist(p.col, this.tower.workbench.col + 0.5)) < 0.95 &&
        this.salvagePartsCollected >= Math.max(1, this.salvagePartsTotal || 3)
          ? this.tower.workbench
          : null;
      const chFire =
        this.tower?.treasureChest &&
        !this.tower.treasureChest.opened &&
        Math.abs(this.tower.treasureChest.floor - p.floor) < 0.85 &&
        Math.abs(colDist(p.col, this.tower.treasureChest.col + 0.5)) < 0.95 &&
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

    if (p.fireBuffer > 0 && p.fireCooldown <= 0 && this.hydroPulses.length < 4) {
      p.fireBuffer = 0;
      p.fireCooldown = 0.23;
      p.muzzleFlash = 0.14;
      this.towerShotsFired += 1;
      let recalledLift = false;
      const nearEl = this.elevators.find((el) => el.powered !== false && Math.abs(colDist(p.col, el.col + 0.5)) < 1.25);
      if (nearEl && Math.abs(nearEl.floor - p.floor) > 0.35) {
        nearEl.recallTarget = Math.max(nearEl.minFloor, Math.min(nearEl.maxFloor, p.floor));
        recalledLift = true;
        sound?.elevator?.();
        this._tryUnlockTrophy('lift_caller');
      }
      const fastPulse = this.hasMutation('pulse_ricochet');
      this.hydroPulses.push({
        col: wrapCol(p.col + p.facing * 0.42),
        floor: p.floor + 0.38,
        dir: p.facing,
        speed: fastPulse ? 11.6 : 8.7,
        pierce: fastPulse ? 2 : 1,
        rise: 0,
        life: 1.15,
        fxId: p.blasterFxId || this.blasterFxId || 'tidal_pearl',
      });
      if (typeof sound?.hydroPulse === 'function') sound.hydroPulse();
      else sound?.snowball?.();
      this._tryUnlockTrophy('first_snowball');
      this._emitProgEvent('snowball_fire', { recalledLift });
    }

    // Level-walk onto resting powered Mechanical Elevator
    if (p.onGround && !p.onElevator && !p.wallScamper && !p.isSwimming) {
      const levelEl = this.elevators.find(
        (el) => el.powered !== false && Math.abs(el.floor - p.floor) < 0.22 && Math.abs(colDist(p.col, el.col + 0.5)) < 0.46
      );
      if (levelEl) {
        p.onElevator = levelEl;
        p.floor = levelEl.floor;
        p.jumpCutEligible = false;
        p.steamBoostActive = false;
      }
    }

    // Vertical Physics: Elevator Ride, Asymmetric Jump Gravity, Frill Glide & Purified Swimming
    const wasOnGround = p.onGround;
    const prevVy = p.vy;

    if (p.onElevator) {
      p.jumpCutEligible = false;
      p.steamBoostActive = false;
      const el = p.onElevator;
      if (el.powered === false || Math.abs(colDist(p.col, el.col + 0.5)) > 0.66) {
        p.onElevator = null;
        p.onGround = false;
        if (this.runType !== 'purist') {
          p.invuln = Math.max(p.invuln || 0, 0.65);
        }
      } else {
        if (inp.up) {
          el.recallTarget = null;
          el.dwellTimer = 0;
          el.dir = 1;
          el.floor = Math.min(el.maxFloor, el.floor + el.speed * 0.52 * dt);
        } else if (inp.down) {
          el.recallTarget = null;
          el.dwellTimer = 0;
          el.dir = -1;
          el.floor = Math.max(el.minFloor, el.floor - el.speed * 0.52 * dt);
        }
        p.floor = el.floor;
        p.vy = 0;
        p.onGround = true;
        if (el.floor >= el.maxFloor - 0.08) {
          if (this.runType !== 'purist') p.invuln = Math.max(p.invuln || 0, 0.65);
          if (!el._topReached) {
            el._topReached = true;
            this._tryUnlockTrophy('lift_rider');
            this._emitProgEvent('elevator_ride', { runType: this.runType });
          }
        }
      }
    } else if (!p.wallScamper && !p.onStairs) {
      const prevFloor = p.floor;
      const risen = p.floor - (p.jumpStartFloor ?? p.floor);
      const lowGravApex = Boolean(this.tower?.mechanics?.lowGravApex);

      let grav = GRAV_RISE;
      p.frillFlare = 0;
      if (p.vy > 1.35 && !inp.jump && p.jumpCutEligible && (risen >= 0.72 || p.vy < 6.6)) {
        grav = GRAV_JUMP_CUT;
      } else if (Math.abs(p.vy) <= 1.35) {
        grav = lowGravApex ? GRAV_APEX * 0.72 : GRAV_APEX;
        p.frillFlare = 0.45;
      } else if (p.vy < -1.35) {
        grav = GRAV_FALL;
      }

      const maxFall = this.hasMutation('frill_updraft') && inp.jump && p.vy < 0 ? -3.15 : -MAX_FALL_SPEED;
      if (this.hasMutation('frill_updraft') && inp.jump && p.vy < 0) {
        p.frillFlare = 1.0;
      }

      p.vy = Math.max(maxFall, p.vy - grav * dt);
      p.floor += p.vy * dt;
      p.onGround = false;

      // Overhead ceiling check (ignores stairs & diagonal destination ledges)
      if (p.vy > 0) {
        const head = p.floor + 0.76;
        const prevHead = prevFloor + 0.76;
        const startCol = p.jumpStartCol ?? p.col;
        const startFloor = p.jumpStartFloor ?? prevFloor;
        const diagFloorReach = p.steamBoostActive ? 3.45 : 1.35;
        for (const l of this.ledges) {
          if (l.gone || !l.active || l.type === 'laserGate') continue;
          if (Math.abs(colDist(p.col, l.col + 0.5)) >= 0.34) continue;
          const isWallBlock = l.type === 'box' || l.type === 'pillar';
          if (
            !isWallBlock &&
            l.floor <= startFloor + diagFloorReach &&
            Math.abs(colDist(startCol, l.col + 0.5)) >= 0.42
          ) {
            continue;
          }
          const bottom = isWallBlock ? l.floor : l.floor - 0.14;
          if (prevHead <= bottom + 0.01 && head >= bottom) {
            p.floor = bottom - 0.761;
            p.vy = 0;
            p.jumpCutEligible = false;
            p.steamBoostActive = false;
            break;
          }
        }
      }

      // Landing on ledges or Mechanical Elevators
      if (p.vy <= 0) {
        const landed = this._findLedgeLanding(p.col, prevFloor, p.floor);
        if (landed) {
          p.floor = landed.floor;
          p.vy = 0;
          p.isSwimming = false;
          p.onGround = true;
          this._onTouchdown(wasOnGround, prevVy, landed);
        } else {
          for (let ei = 0; ei < this.elevators.length; ei++) {
            const el = this.elevators[ei];
            if (
              el.powered !== false &&
              Math.abs(colDist(p.col, el.col + 0.5)) < 0.64 &&
              prevFloor >= el.floor - 0.45 &&
              p.floor <= el.floor + 0.35
            ) {
              p.floor = el.floor;
              p.vy = 0;
              p.isSwimming = false;
              p.jumpCutEligible = false;
              p.steamBoostActive = false;
              p.onGround = true;
              p.onElevator = el;
              this._onTouchdown(wasOnGround, prevVy, null);
              break;
            }
          }
        }
      }

      // Generous 0.42F Waist/Knee Ledge-Edge Mantle
      if (!p.onGround && p.vy <= 2.6 && (Math.abs(p.vx) > 0.12 || Math.abs(moveIntent) > 0.05)) {
        const approachDir = Math.abs(p.vx) > 0.12 ? Math.sign(p.vx) : Math.sign(moveIntent);
        const maxMantleRise = (p.jumpStartFloor ?? p.floor) + (p.steamBoostActive ? 3.55 : 1.65);
        const mantleLedge = this.ledges.find((l) => {
          if (!this._isWalkableLedge(l)) return false;
          if (l.floor > maxMantleRise) return false;
          const floorGap = l.floor - p.floor;
          if (floorGap <= 0 || floorGap > MANTLE_MAX_GAP) return false;
          const dc = colDist(p.col, l.col + 0.5);
          return Math.abs(dc) < 0.86 && approachDir === Math.sign(dc);
        });
        if (mantleLedge) {
          const dc = colDist(p.col, mantleLedge.col + 0.5);
          if (Math.abs(dc) > 0.56) {
            p.col = wrapCol(mantleLedge.col + 0.5 - Math.sign(dc) * 0.52);
          }
          p.floor = mantleLedge.floor;
          p.vy = 0;
          p.isSwimming = false;
          p.jumpCutEligible = false;
          p.steamBoostActive = false;
          p.onGround = true;
          p.landImpact = Math.max(p.landImpact, 0.35);
          if (!liveHorizHeld) {
            const adjCol = wrapCol(mantleLedge.col + approachDir);
            const hasAdj = this.ledges.some(
              (n) => this._isWalkableLedge(n) && wrapCol(n.col) === adjCol && Math.abs(n.floor - mantleLedge.floor) <= 0.8
            );
            if (!hasAdj) p.vx = 0;
          }
          sound?.stepUp?.();
          this._registerLedgeStand(mantleLedge);
        }
      }
    }

    // Hydro-Geyser Updraft Launch ('steamVent')
    for (const l of this.ledges) {
      if (
        l.type === 'steamVent' &&
        l.steamActive &&
        Math.abs(p.floor - l.floor) < 0.78 &&
        Math.abs(colDist(p.col, l.col + 0.5)) < 0.62 &&
        p.vy < 8.5
      ) {
        p.vy = 13.5;
        p.wallScamper = false;
        p.climbing = false;
        p.isSwimming = false;
        p.jumpCutEligible = false;
        p.steamBoostActive = true;
        p.jumpStartCol = l.col + 0.5;
        p.jumpStartFloor = l.floor;
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

    // Altitude & Flood-Rush meter tracking
    const curWholeFloor = Math.floor(p.floor + 0.01);
    if (curWholeFloor > this.maxFloorReached) {
      const gained = curWholeFloor - this.maxFloorReached;
      this.maxFloorReached = curWholeFloor;
      if (this.runType === 'flood_rush') {
        this.floodAltitudeMeters += Math.round(gained * 2.5);
      }
    }

    // Waterline Check: Purified Floodgate Buoyant Swim vs Corrupted Siphon Surge!
    if (p.floor <= this.waterFloor + 0.02) {
      if (this.waterPurified) {
        if (!p.isSwimming) {
          p.isSwimming = true;
          sound?.splash?.();
          this._emitProgEvent('floodgate_swim', { towerId: this.tower?.id || 1 });
        }
        p.floor = this.waterFloor;
        p.vy = 0;
        p.onGround = true;
        p.swimPhase = (p.swimPhase || 0) + dt * 6.5;
      } else if (p.floor < this.waterFloor) {
        this.towerTouchedWater = true;
        sound?.splash?.();
        this.addShake(10);
        this._spawnSplashDroplets(
          (this.renderer?.width || 390) * 0.5,
          (this.renderer?.height || 680) * 0.78,
          p.col,
          this.waterFloor
        );
        if (this.zenMode || this.runType === 'sanctum_trials') {
          this._zenBuoyantRescue();
        } else {
          this._loseLife('SIPHON SURGE!');
        }
        return;
      }
    } else if (p.isSwimming && p.floor > this.waterFloor + 0.15) {
      p.isSwimming = false;
    }

    // Update Skeletal Animation State Hint for `GatewayRig` (`src/gateway.js`)
    if (p.tailWhipTimer > 0) p.anim = 'TailWhip';
    else if (p.muzzleFlash > 0.04) p.anim = 'HydroCast';
    else if (p.wallScamper) p.anim = 'WallScamper';
    else if (p.isSwimming) p.anim = 'FreeSwim';
    else if (!p.onGround) {
      if (p.frillFlare > 0.6) p.anim = 'FrillGlide';
      else if (p.vy > 0.8) p.anim = 'AirRise';
      else p.anim = 'Fall';
    } else if (p.onStairs && Math.abs(p.vx) > 0.25) {
      p.anim = 'StairClimb';
    } else if (Math.abs(p.vx) > 2.2) {
      p.anim = 'FluidRun';
    } else if (Math.abs(p.vx) > 0.2) {
      p.anim = 'Walk';
    } else {
      p.anim = 'IdleBreathe';
    }

    this._updateHydroPulses(dt);
    this._updateEnemyProjectiles(dt);
    this._updateEnemies(dt);

    p.landingFloor = this._computeLandingFloor(p.col, p.floor);
    this._updateCamera(dt);
    this._syncHud();
  }

  _collectSpireItem(c) {
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
      if (pos) this._spawnParticles(pos.x, pos.y, '#c084fc', 14, 105, 150, c.col + 0.5, c.floor + 0.45);
      this.addPopup({
        col: c.col + 0.5,
        floor: c.floor + 1.35,
        text: '◈ FIELD LOG DECODED! +750',
        color: '#e879f9',
        maxLife: 1.45,
      });
      this._emitProgEvent('collectible', { type: 'relic', relicId: relicKey, towerId: this.tower?.id || 1 });
    } else if (c.type === 'salvage_part') {
      this.salvagePartsCollected += 1;
      const req = Math.max(1, this.salvagePartsTotal || 3);
      const partNames = ['COPPER IMPELLER', 'SEA-GLASS LENS', 'REDWOOD SHAFT'];
      const partName = String(
        c.label || partNames[(this.salvagePartsCollected - 1) % partNames.length]
      ).toUpperCase();
      this._awardGears(2);
      this.addScore(300);
      sound?.collectGear?.();
      this.addPopup({
        col: c.col + 0.5,
        floor: c.floor + 1.35,
        text: `❖ ${partName} (${this.salvagePartsCollected}/${req})`,
        color: '#fbbf24',
        maxLife: 1.35,
      });
    } else if (c.type === 'compass_key') {
      this.compassKeysCollected += 1;
      const req = Math.max(1, this.compassKeysTotal || 3);
      this._awardGears(2);
      this.addScore(300);
      sound?.collectStar?.();
      this.addPopup({
        col: c.col + 0.5,
        floor: c.floor + 1.35,
        text: `◈ WAYFINDER KEY (${this.compassKeysCollected}/${req})`,
        color: '#fde047',
        maxLife: 1.35,
      });
    } else if (c.type === 'curio') {
      this.curiosCollectedHere += 1;
      const curioRes = this.prog?.collectCurio?.(c.curioId || null);
      this._handleProgTrophyReturn(curioRes);
      this.addScore(600);
      sound?.collectStar?.();
      const curioLabel = curioRes?.curio?.name
        ? `✦ ${String(curioRes.curio.name).toUpperCase()}!`
        : '✦ CURIO CATALOGED! +600';
      this.addPopup({
        col: c.col + 0.5,
        floor: c.floor + 1.35,
        text: curioLabel,
        color: '#5efce8',
        maxLife: 1.4,
      });
    } else if (c.type === 'starCore') {
      this.towerStarCollected = true;
      this.addScore(600);
      sound?.collectStar?.();
      this._tryUnlockTrophy('first_star_core');
      this.addPopup({
        col: c.col + 0.5,
        floor: c.floor + 1.35,
        text: '★ HARMONIC SEED!',
        color: '#5efce8',
        maxLife: 1.35,
      });
      this._emitProgEvent('collectible', { type: 'starCore', towerId: this.tower?.id || 1 });
    } else {
      const gained = this._awardGears(1);
      this.addScore(100 * gained);
      sound?.collectGear?.();
      this.addPopup({
        col: c.col + 0.5,
        floor: c.floor + 1.35,
        text: `+${gained} ${gained > 1 ? 'GEARS' : 'GEAR'}`,
        color: '#fbbf24',
      });
      this._emitProgEvent('collectible', { type: 'gear', towerId: this.tower?.id || 1 });
    }
  }

  _onTouchdown(wasOnGround, prevVy, landed) {
    const p = this.gateway;
    const inp = this.input?.state;
    p.jumpCutEligible = false;
    p.steamBoostActive = false;
    p.airJumpsLeft = this.hasMutation('hydro_double_jump') ? 1 : 0;

    const neutralHoriz = !inp || (!inp.left && !inp.right && Math.abs(inp.analogX || 0) <= 0.08);
    const rawLive =
      typeof this.input?.isLiveHorizHeld === 'function'
        ? this.input.isLiveHorizHeld()
        : typeof this.input?.isLiveHorizHeld === 'boolean'
        ? this.input.isLiveHorizHeld
        : !neutralHoriz;
    const isDryStone =
      !landed ||
      (landed.type !== 'ice' && landed.type !== 'conveyorR' && landed.type !== 'conveyorL');

    if (isDryStone && !wasOnGround) {
      if (neutralHoriz) {
        p.vx *= 0.2;
        if (Math.abs(p.vx) < 0.5) p.vx = 0;
      } else if (!rawLive && landed && Math.abs(p.vx) > 0.1) {
        const adjCol = wrapCol(landed.col + Math.sign(p.vx));
        const hasAdj = this.ledges.some(
          (n) => this._isWalkableLedge(n) && wrapCol(n.col) === adjCol && Math.abs(n.floor - landed.floor) <= 1.05
        );
        if (!hasAdj) {
          p.vx *= 0.15;
          if (Math.abs(p.vx) < 0.55) p.vx = 0;
        }
      }
    }

    if (!wasOnGround && prevVy < -1.4) {
      const impact = Math.min(1, Math.abs(prevVy) / 13);
      p.landImpact = Math.max(p.landImpact, impact);
      p.squashX = 1 + 0.11 * impact;
      p.squashY = 1 - 0.09 * impact;
      if (Math.abs(prevVy) > 3.0) {
        sound?.land?.(impact);
      }
    }
    if (landed) {
      this._registerLedgeStand(landed);
    }
  }

  _registerLedgeStand(ledge) {
    const p = this.gateway;
    if (
      (ledge.type === 'solid' || ledge.type === 'ice' || ledge.type === 'steamVent') &&
      ledge.floor > this.waterFloor + 0.35
    ) {
      p.safeCol = ledge.col + 0.5;
      p.safeFloor = ledge.floor;
    }
    if (ledge.type === 'crumble' && !ledge.crumbling) {
      ledge.crumbling = true;
      ledge.shake = true;
      ledge.crumbleTimer = 0.52;
    }
  }

  _craftWorkbenchDynamo(wb) {
    if (!wb || wb.crafted) return;
    wb.crafted = true;
    this.dynamoCrafted = true;
    if (this.workbench) this.workbench.crafted = true;
    this._awardGears(8);
    this._emitProgEvent('workbench_craft', {
      towerId: this.tower?.id || 1,
      partsUsed: this.salvagePartsCollected,
    });
    this._tryUnlockTrophy('tinker_apprentice');
    this.addScore(1000);
    this.addShake(5.5);
    sound?.vaultUnlock?.();
    this.input?.haptic?.([20, 30, 45]);
    this.cb.onBanner?.('HYDRO-WORKBENCH COMPLETE!', 'HARMONIC DYNAMO CRAFTED • +8 GEARS');
    this.addPopup({
      col: wb.col + 0.5,
      floor: wb.floor + 1.0,
      text: '❖ HARMONIC DYNAMO CRAFTED!',
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
    this._awardGears(15);
    const curioRes = this.prog?.collectCurio?.(ch.curioId || null);
    this._handleProgTrophyReturn(curioRes);
    this._tryUnlockTrophy('chest_plunderer');
    this._flushPendingProgTrophies();
    this.addScore(1500);
    this.addShake(6.5);
    sound?.vaultUnlock?.();
    this.input?.haptic?.([25, 35, 55]);
    this.cb.onBanner?.('RELIQUARY CHEST UNLOCKED!', '+15 GEARS • RARE CURIO RECOVERED');
    this.addPopup({
      col: ch.col + 0.5,
      floor: ch.floor + 1.05,
      text: '★ +15 GEARS & RARE CURIO!',
      color: '#fde047',
      maxLife: 1.6,
    });
    this._syncHud();
  }

  // ===========================================================================
  // HYDRO-PULSES, MORTAR BUBBLES & 7 SIPHON SYNDICATE ENEMIES
  // ===========================================================================

  _updateHydroPulses(dt) {
    const trailPalette = this._getBlasterTrailColors();

    for (let i = this.hydroPulses.length - 1; i >= 0; i--) {
      const sb = this.hydroPulses[i];
      const spd = sb.speed || 8.7;
      sb.col = wrapCol(sb.col + sb.dir * spd * dt);
      if (sb.rise) sb.floor += sb.rise * dt;
      sb.life -= dt;
      if (sb.life <= 0) {
        this.hydroPulses.splice(i, 1);
        continue;
      }

      sb.trailTimer = (sb.trailTimer || 0) - dt;
      if (sb.trailTimer <= 0) {
        sb.trailTimer = 0.03;
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
            size: 2.5 + Math.random() * 2,
            color: trailColor,
            isSnowballTrail: true,
            life,
            maxLife: life,
          });
        }
      }

      // 1. Hit Pipe-Valve or Switch
      const hitSw = this.switches.find(
        (sw) => sw.cooldown <= 0 && Math.abs(sw.floor - sb.floor) < 0.8 && Math.abs(colDist(sb.col, sw.col + 0.5)) < 0.65
      );
      if (hitSw) {
        this._triggerSwitch(hitSw);
        if ((sb.pierce || 1) <= 1) {
          this.hydroPulses.splice(i, 1);
          continue;
        }
        sb.pierce -= 1;
      }

      // 2. Hit Siphon Crate ('box')
      const box = this.ledges.find(
        (l) =>
          !l.gone &&
          l.active &&
          l.type === 'box' &&
          (l.h ? sb.floor >= l.floor - 0.25 && sb.floor <= l.floor + l.h + 0.25 : Math.abs(l.floor - sb.floor) < 0.75) &&
          Math.abs(colDist(sb.col, l.col + 0.5)) < 0.55
      );
      if (box) {
        box.gone = true;
        box.active = false;
        box.respawnTimer = Infinity;
        this._scoreActionHit(60, { col: box.col + 0.5, floor: box.floor + 0.5 }, '#fde047');
        this._tryUnlockTrophy('box_breaker');
        this._emitProgEvent('snowball_hit', { kind: 'box', runType: this.runType, combo: this.comboCount });
        this.addShake(3.5);
        sound?.hitBlock?.();
        this.hydroPulses.splice(i, 1);
        continue;
      }

      // 3. Pop enemy Mortar Bubbles mid-air!
      let poppedBubble = false;
      for (let pi = this.enemyProjectiles.length - 1; pi >= 0; pi--) {
        const pr = this.enemyProjectiles[pi];
        if (!pr.deflected && Math.abs(pr.floor - sb.floor) < 0.65 && Math.abs(colDist(pr.col, sb.col)) < 0.62) {
          this.enemyProjectiles.splice(pi, 1);
          this._scoreActionHit(50, { col: pr.col, floor: pr.floor + 0.4 }, '#67e8f9');
          sound?.bubble?.();
          poppedBubble = true;
          break;
        }
      }
      if (poppedBubble && (sb.pierce || 1) <= 1) {
        this.hydroPulses.splice(i, 1);
        continue;
      }

      // 4. Hit Enemy
      for (const en of this.enemies) {
        if (en.dead) continue;
        const vReach = en.type === 'siphon_warden' ? 0.95 : 0.72;
        const hReach = en.type === 'siphon_warden' ? 0.78 : 0.58;
        if (Math.abs(en.floor - sb.floor) < vReach && Math.abs(colDist(sb.col, en.col)) < hReach) {
          this._applyAttackToEnemy(en, 'pulse');
          if ((sb.pierce || 1) <= 1) {
            this.hydroPulses.splice(i, 1);
          } else {
            sb.pierce -= 1;
          }
          break;
        }
      }
    }
  }

  _updateEnemyProjectiles(dt) {
    const p = this.gateway;
    for (let i = this.enemyProjectiles.length - 1; i >= 0; i--) {
      const pr = this.enemyProjectiles[i];
      pr.col = wrapCol(pr.col + pr.dir * pr.speed * dt);
      pr.floor += (pr.vy || 0) * dt;
      pr.life -= dt;
      if (pr.life <= 0) {
        this.enemyProjectiles.splice(i, 1);
        continue;
      }

      if (pr.deflected) {
        // Deflected bubble shatters enemies or Wardens!
        for (const en of this.enemies) {
          if (en.dead) continue;
          if (Math.abs(en.floor - pr.floor) < 0.85 && Math.abs(colDist(en.col, pr.col)) < 0.75) {
            this._applyAttackToEnemy(en, 'deflect');
            this._emitProgEvent('mortar_deflect', { towerId: this.tower?.id || 1 });
            this.enemyProjectiles.splice(i, 1);
            break;
          }
        }
      } else if (
        p.invuln <= 0 &&
        !p.hidden &&
        !p.onElevator &&
        Math.abs(pr.floor - (p.floor + 0.35)) < 0.62 &&
        Math.abs(colDist(pr.col, p.col)) < 0.54
      ) {
        this.enemyProjectiles.splice(i, 1);
        this._applyHazardHit(pr.col);
      }
    }
  }

  _updateEnemies(dt) {
    const p = this.gateway;

    for (let ei = this.enemies.length - 1; ei >= 0; ei--) {
      const en = this.enemies[ei];
      if (en.dead) {
        if (en.deathTimer > 0) en.deathTimer = Math.max(0, en.deathTimer - dt);
        continue;
      }

      // Flipped Snap-Crab Dredger -> Harmless glowing Hydro-Bounce Springboard!
      if (en.flipped) {
        en.flipTimer = Math.max(0, (en.flipTimer || 0) - dt);
        en.stunTimer = en.flipTimer;
        if (en.flipTimer <= 0) {
          en.flipped = false;
          en.stunTimer = 0;
        } else {
          const hitCrabSpring =
            p.vy <= 1.2 &&
            Math.abs(p.floor - en.floor) < 0.72 &&
            Math.abs(colDist(p.col, en.col)) < 0.68;
          if (hitCrabSpring) {
            p.vy = 13.6;
            p.onGround = false;
            p.onElevator = null;
            p.wallScamper = false;
            p.isSwimming = false;
            p.jumpCutEligible = false;
            p.steamBoostActive = true;
            p.jumpStartCol = en.col;
            p.jumpStartFloor = en.floor;
            p.airJumpsLeft = this.hasMutation('hydro_double_jump') ? 1 : 0;
            p.squashX = 0.80;
            p.squashY = 1.24;
            sound?.jump?.();
            this.input?.haptic?.(22);
            this._emitProgEvent('crab_springboard', { towerId: this.tower?.id || 1 });
            this.addPopup({
              col: en.col,
              floor: en.floor + 1.1,
              text: '★ CARAPACE BOUNCE!',
              color: '#2dd4bf',
              maxLife: 1.0,
            });
          }
          continue;
        }
      }

      if (en.stunTimer > 0) {
        en.stunTimer = Math.max(0, en.stunTimer - dt);
        continue;
      }

      // 1. snap_crab & horizontal rail_skater on contiguous terrace spans
      if ((en.type === 'snap_crab' || (en.type === 'rail_skater' && en.axis !== 'v')) && en.spanStart != null && en.spanLen != null) {
        if (en.type === 'snap_crab') {
          const nearPlayer = Math.abs(en.floor - p.floor) < 0.6 && Math.abs(colDist(en.col, p.col)) < 1.8;
          en.telegraph = nearPlayer ? Math.min(1, (en.telegraph || 0) + dt * 3) : Math.max(0, (en.telegraph || 0) - dt * 3);
        }
        if (en.edgePause > 0) {
          en.edgePause = Math.max(0, en.edgePause - dt);
        } else {
          en.spanOffset += en.dir * (en.speed || 1.65) * dt;
          const minOff = 0.35;
          const maxOff = Math.max(0.7, en.spanLen - 0.35);
          if (en.spanOffset >= maxOff) {
            en.spanOffset = maxOff;
            en.dir = -1;
            en.edgePause = 0.16;
          } else if (en.spanOffset <= minOff) {
            en.spanOffset = minOff;
            en.dir = 1;
            en.edgePause = 0.16;
          }
          en.col = wrapCol(en.spanStart + en.spanOffset);
        }
      }
      // 2. gulp_hopper: visible belly water-inhale telegraph -> elastic arc hop!
      else if (en.type === 'gulp_hopper') {
        const cycle = (this.time * 1.35 + en.phase) % 2.0;
        if (cycle < 0.68) {
          // Inhaling stolen water on ground before hop!
          en.inflatePhase = cycle / 0.68;
          en.floor = en.baseFloor;
        } else {
          en.inflatePhase = 0;
          const hopU = (cycle - 0.68) / 1.32;
          en.col = wrapCol(en.col + en.dir * (en.speed || 1.6) * dt);
          en.floor = en.baseFloor + Math.sin(hopU * Math.PI) * (en.amp || 0.82);
        }
      }
      // 3. volt_eel: sinuous S-wave slither along spire face
      else if (en.type === 'volt_eel') {
        en.slitherPhase = (en.slitherPhase || 0) + dt * 5.2;
        en.col = wrapCol(en.col + en.dir * (en.speed || 1.8) * dt);
        en.floor = en.baseFloor + Math.sin(en.slitherPhase) * (en.amp || 0.36);
        en.telegraph = Math.max(0, Math.sin(en.slitherPhase * 0.5));
      }
      // 4. vent_stalker (or vertical rail_skater): smooth vertical/thermal patrol
      else if (en.type === 'vent_stalker' || en.axis === 'v') {
        const minF = en.minFloor ?? en.baseFloor - 1.4;
        const maxF = en.maxFloor ?? en.baseFloor + 1.4;
        const mid = (minF + maxF) * 0.5;
        const half = Math.max(0.4, (maxF - minF) * 0.5);
        en.floor = mid + Math.sin(this.time * (en.speed || 1.85) + en.phase) * half;
        en.venting = Math.sin(this.time * 2.4 + en.phase) > 0.55;
        en.telegraph = en.venting ? 1 : 0;
      }
      // 5. barnacle_mortar: anchored turret with 5-petal telegraph & deflectable bubble!
      else if (en.type === 'barnacle_mortar') {
        en.fireTimer -= dt;
        const period = Math.max(2.6, en.firePeriod || 3.3);
        if (en.fireTimer <= 0.85 && en.fireTimer > 0) {
          en.telegraph = 1 - en.fireTimer / 0.85;
          en.openAmount = en.telegraph;
        } else if (en.fireTimer <= 0) {
          en.fireTimer = period;
          en.telegraph = 0;
          en.openAmount = 1;
          const distToHero = colDist(en.col, p.col);
          if (Math.abs(en.floor - p.floor) < 3.5 && Math.abs(distToHero) < 7.5 && this.enemyProjectiles.length < 5) {
            const shotDir = Math.sign(distToHero) || en.dir || 1;
            en.dir = shotDir;
            this.enemyProjectiles.push({
              col: wrapCol(en.col + shotDir * 0.45),
              floor: en.floor + 0.35,
              dir: shotDir,
              speed: 4.1,
              vy: 0,
              life: 1.9,
              deflected: false,
            });
            sound?.bubble?.();
          }
        } else {
          en.openAmount = Math.max(0, (en.openAmount || 0) - dt * 2.4);
          en.telegraph = 0;
        }
      }
      // 6. siphon_warden: Act-End Leviathan-Mech Boss!
      else if (en.type === 'siphon_warden') {
        en.bossTimer -= dt;
        en.slitherPhase = (en.slitherPhase || 0) + dt * 4.2;
        if (en.bossPhase === 'patrol') {
          en.shielded = true;
          en.col = wrapCol(en.col + en.dir * (en.speed || 2.1) * dt);
          en.floor = en.baseFloor + Math.sin(en.slitherPhase * 0.7) * 0.42;
          en.telegraph = 0;
          en.openAmount = 0;
          if (en.bossTimer <= 0) {
            en.bossPhase = 'telegraph';
            en.bossTimer = 0.95;
          }
        } else if (en.bossPhase === 'telegraph') {
          en.shielded = true;
          en.telegraph = 1 - Math.max(0, en.bossTimer / 0.95);
          en.openAmount = en.telegraph;
          if (en.bossTimer <= 0) {
            if (Math.abs(en.floor - p.floor) < 5.5 && this.enemyProjectiles.length < 6) {
              for (const sDir of [-1, 1]) {
                this.enemyProjectiles.push({
                  col: wrapCol(en.col + sDir * 0.5),
                  floor: en.floor + 0.25,
                  dir: sDir,
                  speed: 3.9,
                  vy: -0.25,
                  life: 2.0,
                  deflected: false,
                });
              }
              sound?.bubble?.();
            }
            en.bossPhase = 'vulnerable';
            en.shielded = false;
            en.bossTimer = 2.6;
            en.dir *= -1;
          }
        } else {
          // 'vulnerable' — core armor plates open for Gateway's Hydro-Pulse or Tail-Whip!
          en.shielded = false;
          en.openAmount = 1;
          en.telegraph = 0.35;
          en.col = wrapCol(en.col + en.dir * 0.75 * dt);
          if (en.bossTimer <= 0) {
            en.bossPhase = 'patrol';
            en.shielded = true;
            en.bossTimer = 2.6;
          }
        }
      }

      // Contact Hazard Check (Mechanical Elevator cab railings shield Gateway while riding!)
      const shieldedInLift = Boolean(p.onElevator);
      if (
        p.invuln <= 0 &&
        !shieldedInLift &&
        Math.abs(en.floor - p.floor) < 0.58 &&
        Math.abs(colDist(en.col, p.col)) < 0.52
      ) {
        this._applyHazardHit(en.col);
      }
    }
  }

  _applyHazardHit(sourceCol) {
    const p = this.gateway;
    this._aegisRechargeTimer = 0;

    if (p.shield && this.runType !== 'purist') {
      p.shield = false;
      p.invuln = 1.65;
      sound?.stunEnemy?.();
      this.addShake(4.0);
      this.input?.haptic?.(25);
      this._tryUnlockTrophy('shield_saver');
      this._emitProgEvent('shield_absorb', { towerId: this.tower?.id || 1 });
      this.addPopup({
        col: p.col,
        floor: p.floor + 1.35,
        text: 'SEA-GLASS SHIELD ABSORBED!',
        color: '#5efce8',
        maxLife: 1.15,
      });
      return;
    }

    this.towerHurtCount += 1;
    this.runHurtTotal += 1;
    p.jumpCutEligible = false;
    p.steamBoostActive = false;
    p.wallScamper = false;
    p.climbing = false;
    this.comboCount = 0;
    this.comboTimer = 0;
    sound?.hurt?.();
    this.addShake(8.5);
    this.input?.haptic?.(40);

    // Purist Arcade Rule: 1-Hit KO restarts the spire from Floor 0!
    if (this.runType === 'purist') {
      this._loseLife('PURIST 1-HIT KO!');
      return;
    }

    const zenScale = this.zenMode ? 0.55 : 1.0;
    p.invuln = 1.65;
    p.hurtTimer = 0.45 * zenScale;
    p.vy = 5.4 * zenScale;
    p.onGround = false;
    p.onElevator = null;
    p.coyoteTimer = 0;
    p.knockbackTimer = 0.18 * zenScale;
    p.squashX = 1.20;
    p.squashY = 0.82;
    p.vx = (colDist(sourceCol, p.col) >= 0 ? 1 : -1) * 3.5;
  }

  _sampleStairSurface(col, refFloor, maxTol = 0.56) {
    const s = wrapCol(col) - 0.5;
    const c0 = wrapCol(Math.floor(s));
    const c1 = wrapCol(c0 + 1);
    const t = s - Math.floor(s); // 0..1 between (c0+0.5) and (c1+0.5)
    const rampT = Math.max(0, Math.min(1, (t - 0.14) / 0.72));

    let best = null;
    let bestErr = maxTol;

    for (const l0 of this.ledges) {
      if (!this._isWalkableLedge(l0) || l0.col !== c0) continue;
      if (Math.abs(l0.floor - refFloor) > 1.35) continue;
      for (const l1 of this.ledges) {
        if (!this._isWalkableLedge(l1) || l1.col !== c1) continue;
        const df = l1.floor - l0.floor;
        if (Math.abs(df) !== 1) continue;
        const lowCol = df > 0 ? c0 : c1;
        const lowFloor = Math.min(l0.floor, l1.floor);
        // Must be a real staircase step (no flat terrace bridging across lowFloor on the destination column, and no ceiling block above lowCol)
        const hasFlatBridge = this.ledges.some(
          (b) => this._isWalkableLedge(b) && b.col === (df > 0 ? c1 : c0) && Math.abs(b.floor - lowFloor) < 0.2
        );
        if (hasFlatBridge) continue;
        const blockedOverhead = this.ledges.some(
          (b) => !b.gone && b.active && b.col === lowCol && Math.abs(b.floor - (lowFloor + 1)) < 0.25
        );
        if (blockedOverhead) continue;

        const surfFloor = l0.floor + df * rampT;
        const err = Math.abs(surfFloor - refFloor);
        if (err <= bestErr) {
          bestErr = err;
          best = {
            floor: surfFloor,
            upDir: df > 0 ? 1 : -1,
            onRamp: t > 0.12 && t < 0.88,
            supportLedge: t < 0.5 ? l0 : l1,
          };
        }
      }
    }
    return best;
  }

  _findExactTileLedge(tileCol, floorInt) {
    const wc = wrapCol(tileCol);
    return this.ledges.find(
      (l) => this._isWalkableLedge(l) && l.col === wc && Math.abs(l.floor - floorInt) < 0.2
    );
  }

  _findLedgeAt(col, floor) {
    const stairHit = this._sampleStairSurface(col, floor, 0.35);
    if (stairHit && stairHit.onRamp) {
      return { ...stairHit.supportLedge, floor: stairHit.floor };
    }
    return this.ledges.find(
      (l) =>
        this._isWalkableLedge(l) &&
        Math.abs(l.floor - floor) < 0.22 &&
        Math.abs(colDist(col, l.col + 0.5)) < 0.66
    );
  }

  _findLedgeLanding(col, prevFloor, nextFloor) {
    const stairHit = this._sampleStairSurface(col, (prevFloor + nextFloor) * 0.5, 0.55);
    if (stairHit && stairHit.onRamp && prevFloor >= stairHit.floor - 0.18 && nextFloor <= stairHit.floor + 0.08) {
      return { ...stairHit.supportLedge, floor: stairHit.floor };
    }
    return this.ledges.find(
      (l) =>
        this._isWalkableLedge(l) &&
        prevFloor >= l.floor - 0.18 &&
        nextFloor <= l.floor + 0.08 &&
        Math.abs(colDist(col, l.col + 0.5)) < 0.66
    );
  }

  _computeLandingFloor(col, floor) {
    let best = this.waterFloor;
    for (const l of this.ledges) {
      if (
        this._isWalkableLedge(l) &&
        l.floor <= floor + 0.18 &&
        Math.abs(colDist(col, l.col + 0.5)) < 0.66
      ) {
        if (l.floor > best) best = l.floor;
      }
    }
    for (const el of this.elevators) {
      if (el.powered !== false && el.floor <= floor + 0.18 && Math.abs(colDist(col, el.col + 0.5)) < 0.64) {
        if (el.floor > best) best = el.floor;
      }
    }
    return best;
  }

  _updateCamera(dt) {
    const p = this.gateway;
    const d = colDist(this.camCol, p.col);
    this.camCol = wrapCol(this.camCol + d * Math.min(1, dt * 14));

    const climbingBoost =
      (p.onElevator && p.onElevator.dir > 0) || p.wallScamper || p.onStairs || p.vy > 1.2
        ? 0.35
        : p.vy < -2.2
        ? -0.15
        : 0;
    const minCamFloor = Math.max(1.45, this.waterFloor + 2.0);
    const maxCamFloor = Math.max(minCamFloor, (this.tower?.floors || 18) + 0.6);
    const rawTarget = p.floor + 1.45 + climbingBoost;
    const targetFloor = Math.max(minCamFloor, Math.min(maxCamFloor, rawTarget));
    const vertDelta = targetFloor - this.camFloor;
    const vertRate = vertDelta < 0 ? 12.0 : 9.5;
    this.camFloor += vertDelta * Math.min(1, dt * vertRate);
  }

  _zenBuoyantRescue() {
    const p = this.gateway;
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
    if ((this.tower?.mechanics?.waterRiseRate || 0) > 0) {
      this.waterSurgeDelay = 3.2;
    }
    p.col = rescueCol;
    p.floor = rescueFloor;
    p.vx = 0;
    p.vy = 0;
    p.wallScamper = false;
    p.climbing = false;
    p.isSwimming = false;
    p.onGround = true;
    p.onElevator = null;
    p.invuln = 2.0;
    p.landingFloor = this._computeLandingFloor(p.col, p.floor);
    this.cb.onBanner?.('BUOYANT RESCUE', 'HARMONIC ASSIST ACTIVE');
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
      if (this.runType === 'daily_tide' && this.dailyMeta) {
        const exitDoor = this.tower?.doors?.find((d) => d.isExit);
        const exitFloor = exitDoor ? exitDoor.floor : Math.max(1, (this.tower?.floors || 22) - 2);
        const altPct = Math.max(0, Math.min(100, Math.round((this.maxFloorReached / exitFloor) * 100)));
        this.prog?.recordDailyResult?.({
          dateKey: this.dailyMeta.dateKey,
          score: this.score,
          clearTimeSec: null,
          completed: false,
          altitudePct: altPct,
        });
        this._flushPendingProgTrophies();
      } else if (this.runType === 'flood_rush') {
        this.prog?.recordFloodRushRun?.({
          spiresCleared: this.endlessDepth,
          metersClimbed: this.floodAltitudeMeters,
          score: this.score,
        });
        this._flushPendingProgTrophies();
      } else if (this.runType === 'expedition') {
        this.prog?.recordExpeditionRun?.({
          spiresCleared: this.endlessDepth,
          mutations: this.activeMutations,
          score: this.score,
        });
        this._flushPendingProgTrophies();
      }
      this._syncHud();
      this.cb.onGameOver?.(false, this.score, this.hiScore, this._buildGameOverSummary(false));
      return;
    }

    this.cb.onBanner?.(reason, `${this.lives} ${this.lives === 1 ? 'LIFE' : 'LIVES'} LEFT`);

    const p = this.gateway;
    if (this.runType === 'purist') {
      // Purist Arcade Rule: zero mid-spire checkpoints -> full spire reset to Floor 0!
      this.loadTower(this.towerIndex);
      return;
    }

    if (this.timer <= 0) {
      this.timer = this.timeLimit;
    }
    const mech = this.tower?.mechanics || {};
    const hasSurge = (mech.waterRiseRate || 0) > 0;
    const minWater = (mech.waterBaseFloor ?? -0.55) - (hasSurge ? 0.55 : 0);
    if (hasSurge) this.waterSurgeDelay = 3.2;
    if (!this.waterPurified && this.waterFloor >= p.safeFloor - 1.0) {
      this.waterFloor = Math.max(minWater, p.safeFloor - 2.4);
    }
    p.col = p.safeCol;
    p.floor = p.safeFloor;
    p.vx = 0;
    p.vy = 0;
    p.wallScamper = false;
    p.climbing = false;
    p.isSwimming = false;
    p.doorPhase = null;
    p.enteringDoor = 0;
    p.hidden = false;
    p.onGround = true;
    p.onElevator = null;
    p.invuln = 2.0;
    p.squashX = 1;
    p.squashY = 1;
    p.landImpact = 0;
    p.hurtTimer = 0;
    p.coyoteTimer = 0;
    p.jumpBufferTimer = 0;
    p.knockbackTimer = 0;
    this.comboCount = 0;
    this.comboTimer = 0;
    p.landingFloor = this._computeLandingFloor(p.col, p.floor);
    this._syncHud();
  }

  // ===========================================================================
  // CROWN VALVE -> PLAYABLE `core_descent` CLIMAX -> SPIRE PURIFICATION
  // ===========================================================================

  _enterCrownValve() {
    // Purist Arcade & Flood Rush keep lightning-fast pace OR short Core Descent:
    // Campaign, Expedition, Sanctum Trials & Daily Tide launch full playable Reactor Core Descent!
    if (this.runType === 'purist' || this.runType === 'flood_rush') {
      this.lastCoreCrystalsSmashed = 3;
      this._triggerSpirePurification();
      return;
    }
    this.standaloneMiniGame = false;
    this._initCoreDescentStage();
  }

  _initCoreDescentStage() {
    this.mode = 'core_descent';
    const theme = this.tower?.theme || 'canyon_river';
    const turbines = [];
    const crystalLocks = [];
    const rings = [];
    const pulses = [];

    // 7 giant spinning Hydro-Turbine Blade Gates spaced down the 420m flooded shaft
    for (let i = 0; i < 7; i++) {
      const depth = 52 + i * 48;
      turbines.push({
        id: i + 1,
        depth,
        z: depth,
        rotAngle: (i * 1.1) % (Math.PI * 2),
        rotSpeed: (i % 2 === 0 ? 1 : -1) * (1.25 + i * 0.14),
        bladeCount: i < 3 ? 3 : 4,
        gapSpan: 0.95,
        passed: false,
      });
    }

    // 4 glowing Siphon Crystal Cores/Locks (smash 3+ to supercharge the Seed!)
    for (let c = 0; c < 4; c++) {
      const depth = 76 + c * 78;
      const ang = (c * 1.65 + 0.5) % (Math.PI * 2);
      const rad = 0.46;
      crystalLocks.push({
        id: c + 1,
        depth,
        z: depth,
        angle: ang,
        radial: rad,
        x: Math.cos(ang) * rad,
        y: Math.sin(ang) * rad,
        hp: 1,
        maxHp: 1,
        shattered: false,
        shatterTimer: 0,
        color: c % 2 === 0 ? '#f472b6' : '#fbbf24',
      });
    }

    // 10 Bioluminescent Hydro-Speed & Gear Rings
    for (let r = 0; r < 10; r++) {
      const depth = 36 + r * 35;
      const ang = (r * 0.95) % (Math.PI * 2);
      const rad = 0.35 + (r % 3) * 0.14;
      rings.push({
        id: r + 1,
        depth,
        z: depth,
        x: Math.cos(ang) * rad,
        y: Math.sin(ang) * rad,
        collected: false,
      });
    }

    this.coreDescent = {
      active: true,
      phase: 'dive',
      timer: 0,
      duration: 21.0,
      depth: 0,
      totalDepth: 420,
      progress: 0,
      shaftRadius: 3.6,
      theme,
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      angle: 0,
      radial: 0,
      speed: 20.0,
      whipTimer: 0,
      spinTimer: 0,
      boostTimer: 0,
      invuln: 0,
      crystalsSmashed: 0,
      crystalsRequired: 3,
      coresSmashed: 0,
      totalCores: 3,
      seedPlanted: false,
      purificationWave: 0,
      turbines,
      obstacles: turbines,
      crystalLocks,
      cores: crystalLocks,
      rings,
      pickups: rings,
      pulses,
    };
    this.descent = this.coreDescent;
    this.gateway.anim = 'CoreDive';

    this._handleProgTrophyReturn(this.prog?.recordMiniGamePlayed?.('core_descent'));
    sound?.setMiniGameMode?.('core_descent');
    this.cb.onBanner?.('CROWN VALVE BREACHED!', 'REACTOR CORE DESCENT • SMASH 3 CRYSTALS');
    this._syncHud();
  }

  _updateCoreDescent(dt) {
    const cd = this.coreDescent;
    const inp = this.input.state;

    cd.timer += dt;
    if (cd.invuln > 0) cd.invuln = Math.max(0, cd.invuln - dt);
    if (cd.boostTimer > 0) cd.boostTimer = Math.max(0, cd.boostTimer - dt);
    if (cd.spinTimer > 0) {
      cd.spinTimer = Math.max(0, cd.spinTimer - dt);
      cd.whipTimer = cd.spinTimer;
    } else {
      cd.whipTimer = 0;
    }

    // 2D tube steering in normalized [-0.85..+0.85] circle
    const ax = Math.abs(inp.analogX || 0) > 0.05 ? inp.analogX : (inp.right ? 1 : 0) - (inp.left ? 1 : 0);
    const ay = Math.abs(inp.analogY || 0) > 0.05 ? inp.analogY : (inp.down ? 1 : 0) - (inp.up ? 1 : 0);
    cd.vx = approach(cd.vx, ax * 2.35, 11.5 * dt);
    cd.vy = approach(cd.vy, ay * 2.35, 11.5 * dt);
    cd.x += cd.vx * dt;
    cd.y += cd.vy * dt;
    const rLen = Math.hypot(cd.x, cd.y);
    if (rLen > 0.84) {
      cd.x = (cd.x / rLen) * 0.84;
      cd.y = (cd.y / rLen) * 0.84;
    }
    cd.radial = Math.hypot(cd.x, cd.y);
    cd.angle = Math.atan2(cd.y, cd.x);

    // Corkscrew Tail-Spin / Hydro-Jet Boost & Downward Hydro-Pulse!
    const whipPressed = this.input.consumeJustPressed('whip');
    const jumpPressed = this.input.consumeJustPressed('jump');
    const firePressed = this.input.consumeJustPressed('fire');

    if (whipPressed || jumpPressed) {
      cd.spinTimer = 0.45;
      cd.whipTimer = 0.45;
      cd.boostTimer = Math.max(cd.boostTimer, 0.85);
      if (typeof sound?.tailWhip === 'function') sound.tailWhip();
      else sound?.jump?.();
      this.input?.haptic?.(16);
    }

    if (firePressed || whipPressed) {
      cd.pulses.push({
        depth: cd.depth + 2.5,
        z: cd.depth + 2.5,
        x: cd.x,
        y: cd.y,
        speed: 58,
        life: 1.3,
      });
      if (typeof sound?.hydroPulse === 'function') sound.hydroPulse();
      else sound?.bubble?.();
    }

    if (cd.phase === 'dive') {
      cd.speed = cd.boostTimer > 0 ? 27.5 : 20.5;
      cd.depth = Math.min(cd.totalDepth, cd.depth + cd.speed * dt);
      cd.progress = Math.min(1, cd.depth / cd.totalDepth);

      // Update downward pulses
      for (let pi = cd.pulses.length - 1; pi >= 0; pi--) {
        const pl = cd.pulses[pi];
        pl.depth += pl.speed * dt;
        pl.z = pl.depth;
        pl.life -= dt;
        if (pl.life <= 0) {
          cd.pulses.splice(pi, 1);
          continue;
        }
        for (const cl of cd.crystalLocks) {
          if (!cl.shattered && Math.abs(pl.depth - cl.depth) < 9.5 && Math.hypot(pl.x - cl.x, pl.y - cl.y) < 0.36) {
            this._smashCoreCrystal(cd, cl);
            cd.pulses.splice(pi, 1);
            break;
          }
        }
      }

      // Update Crystal Cores (also smashable via Corkscrew Tail-Spin or body dive!)
      for (const cl of cd.crystalLocks) {
        if (cl.shattered) {
          if (cl.shatterTimer > 0) cl.shatterTimer = Math.max(0, cl.shatterTimer - dt);
          continue;
        }
        cl.angle += dt * 0.75;
        cl.x = Math.cos(cl.angle) * cl.radial;
        cl.y = Math.sin(cl.angle) * cl.radial;
        const hitRadius = cd.spinTimer > 0 ? 0.48 : 0.30;
        if (Math.abs(cd.depth - cl.depth) < 5.5 && Math.hypot(cd.x - cl.x, cd.y - cl.y) < hitRadius) {
          this._smashCoreCrystal(cd, cl);
        }
      }

      // Update Bioluminescent Hydro-Rings
      for (const rg of cd.rings) {
        if (!rg.collected && Math.abs(cd.depth - rg.depth) < 4.8 && Math.hypot(cd.x - rg.x, cd.y - rg.y) < 0.34) {
          rg.collected = true;
          cd.boostTimer = 1.1;
          this._awardGears(1);
          this.addScore(150);
          sound?.ringChime ? sound.ringChime() : sound?.collectGear?.();
        }
      }

      // Update Spinning Hydro-Turbines
      for (const tb of cd.turbines) {
        tb.rotAngle = (tb.rotAngle + tb.rotSpeed * dt) % (Math.PI * 2);
        if (!tb.passed && Math.abs(cd.depth - tb.depth) < 2.6) {
          tb.passed = true;
          // Center hub (radial < 0.22) or outer blade check; Corkscrew Spin glides safely through!
          if (cd.invuln <= 0 && cd.spinTimer <= 0 && cd.radial > 0.20) {
            const sector = (Math.PI * 2) / tb.bladeCount;
            let rel = (cd.angle - tb.rotAngle) % sector;
            if (rel < 0) rel += sector;
            const bladeHalfWidth = 0.20;
            if (rel < bladeHalfWidth || rel > sector - bladeHalfWidth) {
              cd.invuln = 1.1;
              cd.boostTimer = 0;
              this.comboCount = 0;
              this.addShake(6.5);
              sound?.hurt?.();
              this.input?.haptic?.(30);
            } else {
              this.addScore(100);
            }
          } else {
            this.addScore(100);
          }
        }
      }

      if (cd.depth >= cd.totalDepth - 1) {
        cd.phase = 'seed_plant';
        cd.seedPlanted = true;
        cd.purificationWave = 0.02;
        this.lastCoreCrystalsSmashed = cd.crystalsSmashed;
        const seedBonus = 600 + cd.crystalsSmashed * 250;
        this.addScore(seedBonus);
        this.addShake(11);
        if (typeof sound?.spirePurify === 'function') sound.spirePurify();
        else sound?.victory?.();
        this.input?.haptic?.([30, 40, 65]);
        this.cb.onBanner?.('HARMONIC WATER SEED PLANTED!', `BEDROCK ANCHOR PURIFIED • +${seedBonus}`);
        this._emitProgEvent('core_descent_complete', {
          crystalsSmashed: cd.crystalsSmashed,
          towerId: this.tower?.id || 1,
        });
      }
    } else if (cd.phase === 'seed_plant') {
      cd.purificationWave = Math.min(1, cd.purificationWave + dt * 0.68);
      this.purificationProgress = cd.purificationWave * 0.5;
      if (cd.purificationWave >= 1) {
        cd.phase = 'purified';
        if (this.standaloneMiniGame) {
          this.mode = 'victory';
          this._syncHud();
          this.cb.onGameOver?.(true, this.score, this.hiScore, this._buildGameOverSummary(true));
          return;
        }
        this._triggerSpirePurification();
        return;
      }
    }

    this._syncHud();
  }

  _smashCoreCrystal(cd, cl) {
    if (cl.shattered) return;
    cl.shattered = true;
    cl.shatterTimer = 0.5;
    cd.crystalsSmashed += 1;
    cd.coresSmashed = cd.crystalsSmashed;
    this._awardGears(2);
    this._scoreActionHit(250, { x: (this.renderer?.width || 390) * 0.5, y: (this.renderer?.height || 680) * 0.42 }, '#f472b6');
    this.addShake(5.0);
    sound?.hitBlock ? sound.hitBlock() : sound?.hitEnemy?.();
    this.input?.haptic?.(22);
    if (cd.crystalsSmashed >= 3) {
      this._tryUnlockTrophy('core_triple_smash');
    }
  }

  _triggerSpirePurification() {
    this.mode = 'topple';
    this.topple = { active: true, progress: 0, duration: 2.6 };
    this.purificationProgress = Math.max(this.purificationProgress, 0.5);
    this.towersClearedInRun += 1;
    this.gateway.anim = 'Celebrate';

    const parTime = this.tower?.parTime || 40;
    const speedMet = !this.zenMode && this.runType !== 'sanctum_trials' && this.timer >= parTime;
    const vaultMet = Boolean(this.towerVaultCleared || this.vaultCrackedThisTower || this.towerStarCollected);

    const timeBonus = this.zenMode || this.runType === 'sanctum_trials' ? 400 : Math.ceil(this.timer) * 12;
    const crystalBonus = (this.lastCoreCrystalsSmashed || 0) * 150;
    const totalBonus = 600 + timeBonus + crystalBonus;

    this.addScore(totalBonus);
    this.addShake(12);
    this.addPopup({
      col: this.gateway.col,
      floor: this.gateway.floor + 1.25,
      text: `+${totalBonus} PURIFIED!`,
      color: '#2dd4bf',
      maxLife: 1.45,
    });

    if (typeof sound?.spirePurify === 'function') sound.spirePurify();
    else sound?.towerTopple?.();
    this.input?.haptic?.([30, 40, 60]);

    const isSanctumRun = Boolean(this.runType === 'sanctum_trials' || this.tower?.casual);
    const missionType = this._getCasualMissionType(this.tower);

    this._tryUnlockTrophy('first_purify');
    if (this.zenMode || isSanctumRun) {
      this._tryUnlockTrophy('zen_voyager');
    }
    if (!isSanctumRun) {
      if (this.towerHurtCount === 0) this._tryUnlockTrophy('storm_ghost');
      if (this.towerShotsFired === 0) this._tryUnlockTrophy('pacifist_climb');
    }

    this.lastPurificationInfo = null;

    if (this.runType === 'campaign' || this.runType === 'purist') {
      const tid = this.tower?.id || 1;
      const clearRes = this.prog?.recordTowerClear?.({
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
        enemiesDestroyed: this.towerEnemiesDestroyed,
        switchesUsed: this.towerSwitchesUsed,
        maxCombo: this.maxComboHere || 0,
        crystalsSmashed: this.lastCoreCrystalsSmashed || 0,
        touchedWater: this.towerTouchedWater,
      });
      if (clearRes) {
        this.lastClearStars = clearRes.stars;
        this.runStarsEarned += clearRes.stars?.count || 1;
        this.lastPurificationInfo = {
          towerId: tid,
          towerName: this.tower?.name || '',
          act: this.tower?.act || Math.ceil(tid / 2),
          biome: this.tower?.theme || 'canyon_river',
          theme: this.tower?.theme || 'canyon_river',
          watershedBefore: clearRes.watershedBefore ?? 0,
          watershedAfter: clearRes.watershedAfter ?? 100,
          overallWatershedHealth: clearRes.overallWatershedHealth ?? 0,
          actRestored: tid % 2 === 0,
          cutscene:
            tid === 10
              ? STORY_CUTSCENES.epilogue
              : tid % 2 === 0
              ? STORY_CUTSCENES[`act_${Math.ceil(tid / 2)}_clear`] || null
              : null,
        };
        this._handleProgTrophyReturn(clearRes);
      }
    } else if (this.runType === 'daily_tide' && this.dailyMeta) {
      this._awardGears(6);
      this.prog?.recordDailyResult?.({
        dateKey: this.dailyMeta.dateKey,
        score: this.score,
        clearTimeSec: Math.round(this.dailyMeta.elapsedSec * 10) / 10,
        completed: true,
        altitudePct: 100,
      });
      this._tryUnlockTrophy('daily_try');
      this._tryUnlockTrophy('daily_climber');
      if (speedMet) this._tryUnlockTrophy('daily_speed_ace');
      this._flushPendingProgTrophies();
    } else if (isSanctumRun) {
      this.endlessDepth += 1;
      const casRes = this.prog?.recordCasualExpedition?.({
        towersCleared: 1,
        depth: this.endlessDepth,
        missionType,
        craftedDynamo: this.dynamoCrafted,
        dynamoCrafted: this.dynamoCrafted,
        chestOpened: this.treasureChestOpened,
        score: this.score,
      });
      this._handleProgTrophyReturn(casRes);
      this._emitProgEvent('casual_clear', { depth: this.endlessDepth, missionType });
    } else if (this.runType === 'flood_rush') {
      this.endlessDepth += 1;
      this._awardGears(4);
      this.prog?.recordFloodRushRun?.({
        spiresCleared: this.endlessDepth,
        metersClimbed: this.floodAltitudeMeters,
        score: this.score,
      });
      this._flushPendingProgTrophies();
    } else if (this.runType === 'expedition') {
      this.endlessDepth += 1;
      this._awardGears(5);
      this.prog?.recordExpeditionRun?.({
        spiresCleared: this.endlessDepth,
        mutations: this.activeMutations,
        score: this.score,
      });
      this._flushPendingProgTrophies();
    }

    const bannerTitle =
      this.runType === 'flood_rush'
        ? 'SURGE SPIRE ESCAPED!'
        : isSanctumRun
        ? 'AQUEDUCT SANCTUM RESTORED!'
        : 'SIPHON SPIRE PURIFIED!';
    const bannerSub =
      this.lastPurificationInfo && this.runType === 'campaign'
        ? `WATERSHED HEALTH ${this.lastPurificationInfo.watershedAfter}% • +${totalBonus}`
        : `+${totalBonus} BONUS`;
    this.cb.onBanner?.(bannerTitle, bannerSub);
    this._syncHud();
  }

  _nextCampaignTransitMode(justFinishedId) {
    // Rotates across Gateway's signature travel mini-games matching SECTOR_WORLDS!
    const actIdx = Math.max(0, Math.min(SECTOR_WORLDS.length - 1, Math.floor((justFinishedId - 1) / 2)));
    const world = SECTOR_WORLDS[actIdx];
    if (justFinishedId % 2 === 1) {
      return world?.routeType || 'rapids_surf';
    }
    return world?.exitRouteType || 'frill_glide';
  }

  _updateTopple(dt) {
    this.topple.progress += dt / this.topple.duration;
    this.purificationProgress = Math.min(1, 0.5 + this.topple.progress * 0.5);
    this.shake = Math.max(this.shake, 4.8 * (1 - Math.min(1, this.topple.progress)));
    if (Math.random() < 0.45) {
      this._spawnParticles(
        (this.renderer?.width || 390) * (0.3 + Math.random() * 0.4),
        (this.renderer?.height || 680) * (0.25 + Math.random() * 0.45),
        '#2dd4bf',
        4,
        115
      );
    }

    if (this.topple.progress >= 1 && !this._purificationDispatched) {
      this._purificationDispatched = true;
      if (this.runType === 'campaign' && this.lastPurificationInfo && typeof this.cb.onSpirePurified === 'function') {
        let doneCalled = false;
        const proceed = () => {
          if (doneCalled) return;
          doneCalled = true;
          this._purificationDispatched = false;
          this._advanceAfterSpirePurified();
        };
        this._pendingPurifyProceed = proceed;
        this.cb.onSpirePurified(this.lastPurificationInfo, proceed);
        return;
      }
      this._purificationDispatched = false;
      this._advanceAfterSpirePurified();
    }
  }

  completeSpirePurification() {
    if (typeof this._pendingPurifyProceed === 'function') {
      const fn = this._pendingPurifyProceed;
      this._pendingPurifyProceed = null;
      fn();
    }
  }

  _advanceAfterSpirePurified() {
    if (this.runType === 'daily_tide') {
      this.mode = 'victory';
      this._syncHud();
      this.cb.onGameOver?.(true, this.score, this.hiScore, this._buildGameOverSummary(true));
      return;
    }

    if (this.runType === 'purist') {
      if (this.towerIndex >= this.towers.length - 1) {
        this.mode = 'victory';
        this._syncHud();
        this.cb.onGameOver?.(true, this.score, this.hiScore, this._buildGameOverSummary(true));
      } else {
        this.towerIndex += 1;
        this.mode = 'tower';
        this.loadTower(this.towerIndex);
      }
      return;
    }

    if (this.runType === 'flood_rush') {
      const nextT = generateProceduralTower({
        seed: (this.endlessSeed + (this.endlessDepth + 1) * 7919) >>> 0,
        index: this.endlessDepth + 1,
        difficulty: 1.2 + this.endlessDepth * 0.45,
        modeHint: 'flood_rush',
      });
      this.mode = 'tower';
      this.loadTower(nextT);
      return;
    }

    if (this.runType === 'expedition') {
      // Offer 3 selectable Bio-Mutations between Expedition spires!
      const choices = rollMutationChoices(
        this.activeMutations,
        (this.endlessSeed + this.endlessDepth * 4099) >>> 0,
        3
      );
      this.pendingMutationChoices = choices;
      if (typeof this.cb.onMutationDraft === 'function') {
        this.mode = 'mutation_draft';
        this._syncHud();
        this.cb.onMutationDraft(choices, (pickedId) => {
          this.selectBioMutation(pickedId);
        });
        return;
      }
      // Fallback auto-pick if UI callback is omitted (e.g. headless simulation)
      if (choices.length > 0) {
        this.selectBioMutation(choices[0].id);
      }
      return;
    }

    if (this.runType === 'sanctum_trials') {
      const pool = ['reef_swim', 'frill_glide', 'rapids_surf', 'aqueduct_sanctum'];
      const choices = pool.filter((m) => m !== this._lastCasualMini);
      const nextMini = choices[Math.floor(Math.random() * choices.length)] || 'frill_glide';
      this._lastCasualMini = nextMini;
      this.startMiniGame(nextMini, false);
      return;
    }

    // Campaign progression (10 handcrafted spires)
    if (this.towerIndex >= this.towers.length - 1) {
      this._tryUnlockTrophy('watershed_envoy');
      this.mode = 'victory';
      this._syncHud();
      this.cb.onGameOver?.(true, this.score, this.hiScore, this._buildGameOverSummary(true));
    } else {
      const nextMini = this._nextCampaignTransitMode(this.tower?.id || this.towerIndex + 1);
      this.startMiniGame(nextMini, false);
    }
  }

  selectBioMutation(mutationId) {
    const picked =
      BIO_MUTATIONS.find((m) => m.id === mutationId) ||
      this.pendingMutationChoices[0] ||
      BIO_MUTATIONS[0];
    if (picked && !this.activeMutations.includes(picked.id)) {
      this.activeMutations.push(picked.id);
      if (this.gateway) this.gateway.mutations = [...this.activeMutations];
      this._emitProgEvent('mutation_draft', { mutationId: picked.id, count: this.activeMutations.length });
    }
    this.pendingMutationChoices = [];
    const cycle = ['rapids_surf', 'reef_swim', 'frill_glide'];
    const nextMini = cycle[(Math.max(1, this.endlessDepth) - 1) % cycle.length];
    this.startMiniGame(nextMini, false);
  }

  selectMutation(mutationId) {
    return this.selectBioMutation(mutationId);
  }

  _finishTransitionMiniGame() {
    sound?.setWind?.(0);
    if (this.standaloneMiniGame) {
      this.mode = 'victory';
      this._syncHud();
      this.cb.onGameOver?.(true, this.score, this.hiScore, this._buildGameOverSummary(true));
      return;
    }

    if (this.runType === 'sanctum_trials') {
      const nextT =
        this.endlessDepth < this.towers.length
          ? this.towers[this.endlessDepth]
          : generateProceduralTower({
              seed: (this.endlessSeed + (this.endlessDepth + 1) * 7919) >>> 0,
              index: this.endlessDepth + 1,
              difficulty: 1 + this.endlessDepth * 0.25,
              modeHint: 'sanctum_trials',
              casual: true,
            });
      this.mode = 'tower';
      this.loadTower(nextT);
      return;
    }

    if (this.runType === 'expedition') {
      const nextT = generateProceduralTower({
        seed: (this.endlessSeed + (this.endlessDepth + 1) * 7919) >>> 0,
        index: this.endlessDepth + 1,
        difficulty: 1.1 + this.endlessDepth * 0.35,
        modeHint: 'expedition',
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
      gameMode: this.gameMode,
      runType: this.runType,
      zenMode: this.zenMode,
      score: this.score,
      hiScore: this.hiScore,
      stars: this.lastClearStars,
      starsEarned: this.runStarsEarned,
      gearsEarned: Math.max(0, totalGears - (this.runGearsStart || 0)),
      totalGears,
      towersCleared: this.towersClearedInRun,
      floodAltitudeMeters: this.floodAltitudeMeters,
      mutations: [...this.activeMutations],
      watershedHealth: this.prog?.getWatershedHealth?.() || {},
      towerId: this.tower?.id ?? 1,
      towerName: this.tower?.name ?? '',
    };
  }

  // ===========================================================================
  // MINI-GAME 2: REEF & LAKEBED FREE-SWIM ('reef_swim' via `SubStage`)
  // ===========================================================================

  _initSubmarineStage() {
    this.mode = 'reef_swim';
    const w = this.renderer?.width || 390;
    const h = this.renderer?.height || 680;
    const isCalm = this.runType === 'sanctum_trials';
    const nextT = !this.standaloneMiniGame ? this.towers?.[this.towerIndex + 1] : null;

    this.subStage = new SubStage();
    this.subStage.start({
      width: w,
      height: h,
      towerIndex: this.towerIndex || 0,
      healing: Math.min(1, (this.prog?.getOverallWatershedHealth?.() || 25) / 100),
      nextTowerName: nextT?.name || 'NEXT WATERSHED SPIRE',
      nextGlow: nextT?.palette?.glow || '#2dd4bf',
      era: 'reboot',
      casual: isCalm,
    });
    this.reefSwim = this.subStage;
    this.gateway.anim = 'FreeSwim';

    this._handleProgTrophyReturn(this.prog?.recordMiniGamePlayed?.('reef_swim'));
    sound?.setMiniGameMode?.('reef_swim');
    this.cb.onBanner?.(
      isCalm ? 'PEACEFUL LAGOON SWIM' : 'UNDERWATER PASSAGE',
      'REEF & LAKEBED FREE-SWIM'
    );
    this._syncHud();
  }

  _updateSubmarine(dt) {
    const st = this.subStage;
    if (!st) {
      this._finishTransitionMiniGame();
      return;
    }

    const w = this.renderer?.width || 390;
    const h = this.renderer?.height || 680;
    if (st.width !== w || st.height !== h) {
      st.resize?.(w, h);
    }

    const firePressed = this.input.consumeJustPressed('fire') || this.input.consumeJustPressed('whip');
    const fx = {
      addScore: (pts) => this.addScore(pts),
      addGears: (g) => {
        this._awardGears(g);
        sound?.collectGear?.();
      },
      grantWarpReward: () => {
        this.nextTowerShield = true;
        this.nextTowerWarpFloors = 2;
        this._tryUnlockTrophy('warp_finder');
      },
      popup: (x, y, text, color) => this.addPopup({ x, y, text, color }),
      particles: (x, y, color, count, spd) => this._spawnParticles(x, y, color, count, spd),
      shake: (a) => this.addShake(a),
      haptic: (p) => this.input?.haptic?.(p),
      banner: (sub, title) => this.cb.onBanner?.(sub, title),
      sound,
    };

    const done = st.update(dt, this.input.state, firePressed, fx);
    // Keep `this.sub` mirrored for any renderer reading `state.sub`
    this.sub.x = st.sub.x;
    this.sub.y = st.sub.y;
    this.sub.vx = st.sub.vx;
    this.sub.vy = st.sub.vy;
    this.sub.timer = st.rideT;
    this.sub.duration = st.rideDuration;
    this.sub.sonarPulse = st.sonarPulse;

    if (st.warpEntered && !this.nextTowerShield) {
      this.nextTowerShield = true;
      this.nextTowerWarpFloors = 2;
      this._tryUnlockTrophy('warp_finder');
    }

    this._syncHud();
    if (done) {
      this._tryUnlockTrophy('sub_novice');
      if ((st.fishCaught || 0) >= 10) this._tryUnlockTrophy('sub_ace');
      if ((st.minesDestroyed || 0) >= 1) this._tryUnlockTrophy('sub_mine_sweeper');
      this._emitProgEvent('reef_swim_complete', {
        fishCaught: st.fishCaught || 0,
        minesDestroyed: st.minesDestroyed || 0,
        warpEntered: Boolean(st.warpEntered),
        score: this.score,
      });
      this.subStage = null;
      this.reefSwim = null;
      this._finishTransitionMiniGame();
    }
  }

  // ===========================================================================
  // MINI-GAME 3: WHITEWATER RAPIDS TAIL-SURF ('rapids_surf')
  // ===========================================================================

  _initSkimmerStage() {
    this.mode = 'rapids_surf';
    this.skimmer = {
      laneX: 0,
      vx: 0,
      y: 0,
      vy: 0,
      surfBank: 0,
      onWater: true,
      speed: 19,
      boostMult: 1,
      maxBoost: 1,
      boostTimer: 0,
      distance: 0,
      timer: 0,
      duration: 18.0,
      biome: this.tower?.theme || 'canyon_river',
      gates: [],
      ramps: [],
      hazards: [],
      gears: [],
      bolts: [],
      whipTimer: 0,
      fireCooldown: 0,
      spawnCursor: 12,
      lastLane: 0,
      rampsUsed: 0,
      cratesDestroyed: 0,
    };
    this.rapidsSurf = this.skimmer;
    this.rapids = this.skimmer;
    this.gateway.anim = 'RapidsSurf';

    for (let z = 14; z <= 46; z += 11) {
      this._spawnSkimmerRow(z);
    }
    this.skimmer.spawnCursor = 46;

    this._handleProgTrophyReturn(this.prog?.recordMiniGamePlayed?.('rapids_surf'));
    sound?.setMiniGameMode?.('rapids_surf');
    this.cb.onBanner?.(
      this.runType === 'sanctum_trials' ? 'SUNLIT RIVER CARVE' : 'GORGE WHITEWATER RUN',
      'WHITEWATER RAPIDS TAIL-SURF'
    );
    this._syncHud();
  }

  _spawnSkimmerRow(zAhead) {
    const sk = this.skimmer;
    const isCalm = this.runType === 'sanctum_trials';
    const rawLane = (Math.random() * 2 - 1) * 2.4;
    const prevLane = sk.lastLane ?? 0;
    const lane = Math.max(-2.4, Math.min(2.4, Math.max(prevLane - 2.4, Math.min(prevLane + 2.4, rawLane))));
    sk.lastLane = lane;
    const roll = Math.random();
    if (roll < 0.44) {
      sk.gates.push({ z: zAhead, laneX: lane, width: 1.62, hit: false });
      sk.hazards.push({
        z: zAhead + 4.8,
        laneX: Math.max(-3.1, Math.min(3.1, -lane * 0.85)),
        type: isCalm ? 'crate' : Math.random() < 0.5 ? 'mine' : 'crate',
        hp: 1,
      });
    } else if (roll < 0.72) {
      sk.ramps.push({ z: zAhead, laneX: lane, width: 1.52, used: false });
      for (let g = 0; g < 3; g++) {
        sk.gears.push({
          z: zAhead + 3.0 + g * 2.2,
          laneX: lane,
          y: 1.5 + Math.sin((g / 2) * Math.PI) * 0.65,
          collected: false,
        });
      }
    } else {
      if (!isCalm || Math.random() < 0.65) {
        sk.hazards.push({
          z: zAhead,
          laneX: lane,
          type: isCalm ? 'crate' : Math.random() < 0.55 ? 'crate' : 'rock',
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
    const isCalm = this.runType === 'sanctum_trials';

    sk.timer += dt;
    if (sk.whipTimer > 0) sk.whipTimer = Math.max(0, sk.whipTimer - dt);
    if (sk.timer >= sk.duration) {
      this.nextTowerTimeBonus = sk.boostMult * 3;
      this._tryUnlockTrophy('skimmer_novice');
      this._emitProgEvent('rapids_surf_complete', {
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

    sk.speed = 19 + (sk.boostMult - 1) * 3.8;
    const dz = sk.speed * dt;
    sk.distance += dz;

    const steer =
      Math.abs(inp.analogX || 0) > 0.05
        ? inp.analogX
        : (inp.right ? 1 : 0) - (inp.left ? 1 : 0);
    sk.vx = approach(sk.vx, steer * 9.2, 44 * dt);
    sk.laneX = Math.max(-3.5, Math.min(3.5, sk.laneX + sk.vx * dt));
    sk.surfBank = approach(sk.surfBank || 0, -steer * 0.55, 8.5 * dt);

    const hopPressed = this.input.consumeJustPressed('jump') || this.input.consumeJustPressed('up');
    if (hopPressed) sk.jumpBuffer = 0.14;
    else if ((sk.jumpBuffer || 0) > 0) sk.jumpBuffer = Math.max(0, sk.jumpBuffer - dt);

    if ((sk.jumpBuffer || 0) > 0 && sk.onWater) {
      sk.jumpBuffer = 0;
      sk.vy = 8.6;
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
    const whipSurf = this.input.consumeJustPressed('whip');
    if (whipSurf) {
      sk.whipTimer = 0.34;
      if (typeof sound?.tailWhip === 'function') sound.tailWhip();
    }
    if ((this.input.consumeJustPressed('fire') || whipSurf) && sk.fireCooldown <= 0) {
      sk.fireCooldown = 0.22;
      sk.bolts.push({ z: 1.0, laneX: sk.laneX, y: sk.y + 0.35 });
      if (typeof sound?.hydroPulse === 'function') sound.hydroPulse();
      else sound?.snowball?.();
    }

    sk.spawnCursor -= dz;
    while (sk.spawnCursor < 46) {
      sk.spawnCursor += 11.4;
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
        if (Math.abs(b.z - h.z) < 1.4 && Math.abs(b.laneX - h.laneX) < 1.1) {
          if (h.type === 'crate') {
            sk.cratesDestroyed = (sk.cratesDestroyed || 0) + 1;
            this._awardGears(1);
            this._tryUnlockTrophy('skimmer_crate_buster');
            this.addScore(100 * sk.boostMult);
            sound?.hitBlock?.();
            sk.hazards.splice(hi, 1);
          } else {
            sound?.deflect?.();
          }
          sk.bolts.splice(i, 1);
          break;
        }
      }
    }

    for (let i = sk.gates.length - 1; i >= 0; i--) {
      const g = sk.gates[i];
      g.z -= dz;
      if (!g.hit && Math.abs(g.z) < 1.1 && Math.abs(sk.laneX - g.laneX) < g.width * 0.7) {
        g.hit = true;
        sk.boostMult = Math.min(4, sk.boostMult + 1);
        sk.maxBoost = Math.max(sk.maxBoost || 1, sk.boostMult);
        sk.boostTimer = 5.8;
        this.addScore(150 * sk.boostMult);
        sound?.boostGate?.(sk.boostMult);
        this.input?.haptic?.(18);
        if (sk.boostMult >= 4) this._tryUnlockTrophy('skimmer_pro');
      }
      if (g.z < -6) sk.gates.splice(i, 1);
    }

    for (let i = sk.ramps.length - 1; i >= 0; i--) {
      const r = sk.ramps[i];
      r.z -= dz;
      if (!r.used && Math.abs(r.z) < 1.1 && Math.abs(sk.laneX - r.laneX) < r.width * 0.7 && sk.y < 0.75) {
        r.used = true;
        sk.rampsUsed = (sk.rampsUsed || 0) + 1;
        sk.vy = 10.8;
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
        Math.abs(g.z) < 1.15 &&
        Math.abs(sk.laneX - g.laneX) < 1.05 &&
        Math.abs(sk.y - g.y) < 1.2
      ) {
        g.collected = true;
        this._awardGears(1);
        this.addScore(125 * sk.boostMult);
        sound?.collectGear?.();
      }
      if (g.z < -6 || g.collected) sk.gears.splice(i, 1);
    }

    for (let i = sk.hazards.length - 1; i >= 0; i--) {
      const h = sk.hazards[i];
      h.z -= dz;
      const hitHeight = h.type === 'rock' ? 1.3 : 0.82;
      if (Math.abs(h.z) < 0.85 && Math.abs(sk.laneX - h.laneX) < 0.66 && sk.y < hitHeight) {
        if (isCalm || sk.whipTimer > 0) {
          this.addScore(75);
          sound?.hitBlock?.();
          sk.hazards.splice(i, 1);
          continue;
        }
        sk.boostMult = 1;
        sk.boostTimer = 0;
        this.addShake(7.0);
        sound?.hurt?.();
        this.input?.haptic?.(35);
        sk.hazards.splice(i, 1);
        continue;
      }
      if (h.z < -6) sk.hazards.splice(i, 1);
    }

    this._syncHud();
  }

  // ===========================================================================
  // MINI-GAME 4: CANYON UPDRAFT FRILL-GLIDE ('frill_glide' via `GlideStage`)
  // ===========================================================================

  _initGlideStage() {
    this.mode = 'frill_glide';
    this.glideGoldenOrChain4 = false;
    this._glideThermalUnlockedHere = false;
    this.glideStage = new GlideStage();
    this.frillGlide = this.glideStage;
    this.gateway.anim = 'FrillGlide';

    const w = this.renderer?.width || 390;
    const h = this.renderer?.height || 680;
    const nextT = !this.standaloneMiniGame ? this.towers?.[this.towerIndex + 1] : null;
    const actIdx = Math.max(0, Math.min(4, Math.floor(((this.tower?.id || 2) - 1) / 2)));
    const glideThemesByAct = ['dawn', 'day', 'sunset', 'aurora', 'storm'];

    this.glideStage.start({
      width: w,
      height: h,
      worldIndex: actIdx,
      themeKey: glideThemesByAct[actIdx] || 'dawn',
      standalone: Boolean(this.standaloneMiniGame),
      nextWorldName: nextT?.name || 'NEXT WATERSHED SPIRE',
      nextGlow: nextT?.palette?.glow || '#2dd4bf',
      fromGlow: this.tower?.palette?.glow || '#fbbf24',
      healing: 1,
    });

    this._handleProgTrophyReturn(this.prog?.recordMiniGamePlayed?.('frill_glide'));
    sound?.setMiniGameMode?.('frill_glide');
    this._syncHud();
  }

  _updateGlide(dt) {
    const st = this.glideStage;
    if (!st) {
      this._finishTransitionMiniGame();
      return;
    }

    const w = this.renderer?.width || 390;
    const h = this.renderer?.height || 680;
    if (st.width !== w || st.height !== h) {
      st.resize?.(w, h);
    }

    const firePressed =
      this.input.consumeJustPressed('fire') ||
      this.input.consumeJustPressed('jump') ||
      this.input.consumeJustPressed('whip');
    const fx = {
      addScore: (pts) => this.addScore(pts),
      addGears: (g) => {
        this._awardGears(g);
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
      if (this.glideGoldenOrChain4) this._tryUnlockTrophy('sky_rider');
      this._emitProgEvent('frill_glide_complete', {
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
      this.frillGlide = null;
      this._finishTransitionMiniGame();
    }
  }

  // ===========================================================================
  // MINI-GAME 5: ANCIENT AQUEDUCT SANCTUMS ('aqueduct_sanctum' & 'vault')
  // ===========================================================================

  _enterPuzzleRoom(door) {
    this.standaloneMiniGame = false;
    this._initPuzzleStage(door);
  }

  _initPuzzleStage(door = null) {
    this.puzzleDoor = door;
    this.mode = 'aqueduct_sanctum';
    this.particles = [];
    this.popups = [];
    this.shake = 0;

    let puz = door ? door._puzzle || null : null;
    if (!puz) {
      if (!door) {
        this._standalonePuzzleIdx = ((this._standalonePuzzleIdx ?? -1) + 1) % PUZZLE_TYPES.length;
      }
      const pType = door?.puzzleType || PUZZLE_TYPES[this._standalonePuzzleIdx] || 'lights';
      const pSeed = door?.puzzleSeed ?? (((Date.now() >>> 0) % 90000) + 1000);
      const pDiff =
        door && door.puzzleDifficulty !== undefined && door.puzzleDifficulty !== null
          ? Number(door.puzzleDifficulty)
          : this.runType === 'sanctum_trials'
          ? 0.3
          : 0.4;
      puz = makePuzzle({
        type: pType,
        seed: pSeed,
        difficulty: pDiff,
        hideTarget: Boolean(door && (pType === 'lights' || pType === 'bells')),
      });
      if (door) door._puzzle = puz;
    }

    this.puzzleRoom = new PuzzleRoom();
    this.puzzle = this.puzzleRoom;
    this.puzzleRoom.start({
      width: this.renderer?.width || 390,
      height: this.renderer?.height || 680,
      puzzle: puz,
      door: this.puzzleDoor,
      worldIndex: Math.floor(((this.tower?.id || 1) - 1) / 2),
      palette: this.tower?.palette,
    });

    this._handleProgTrophyReturn(this.prog?.recordMiniGamePlayed?.('aqueduct_sanctum'));
    sound?.setMiniGameMode?.('aqueduct_sanctum');
    sound?.puzzleEnter ? sound.puzzleEnter() : sound?.door?.();
    this._syncHud();
  }

  _updatePuzzle(dt) {
    const room = this.puzzleRoom;
    if (!room) {
      this._leavePuzzleRoom();
      return;
    }

    const w = this.renderer?.width || 390;
    const h = this.renderer?.height || 680;
    if (room.width !== w || room.height !== h) {
      room.resize?.(w, h);
    }

    const firePressed =
      this.input.consumeJustPressed('fire') ||
      this.input.consumeJustPressed('jump') ||
      this.input.consumeJustPressed('whip');
    const fx = {
      addScore: (pts) => this.addScore(pts),
      addGears: (g) => {
        this._awardGears(g);
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

    sound?.puzzleLeave ? sound.puzzleLeave() : sound?.door?.();

    if (solved) {
      this._tryUnlockTrophy('rune_scholar');
      if (pType === 'lights') this._tryUnlockTrophy('rune_lights_clear');
      else if (pType === 'bells') this._tryUnlockTrophy('rune_bells_clear');
      else if (pType === 'beam') this._tryUnlockTrophy('rune_beam_clear');
      else if (pType === 'blocks') this._tryUnlockTrophy('rune_blocks_clear');
    }
    this._emitProgEvent('sanctum_complete', {
      solved,
      puzzleType: pType,
      moves: room?.moves || 0,
      undos: room?.undos || 0,
      timeSec: room?.timeSec || 0,
    });

    if (this.standaloneMiniGame) {
      if (solved) {
        this._awardGears(10);
        this.addScore(1500);
      }
      this.puzzleRoom = null;
      this.puzzle = null;
      this.puzzleDoor = null;
      this.mode = solved ? 'victory' : 'gameover';
      this._syncHud();
      this.cb.onGameOver?.(solved, this.score, this.hiScore, this._buildGameOverSummary(solved));
      return;
    }

    if (!door) {
      if (solved) {
        this._awardGears(10);
        this.addScore(1500);
      }
      this.puzzleRoom = null;
      this.puzzle = null;
      this.puzzleDoor = null;
      this._finishTransitionMiniGame();
      return;
    }

    if (solved && !door.solved) {
      door.solved = true;
      this.towerVaultCleared = true;
      this.vaultCrackedThisTower = true;
      this.timer = Math.min((this.timeLimit || this.tower?.timeLimit || 105) + 15, this.timer + 15);
      this._awardGears(10);
      this._tryUnlockTrophy('first_star_core');
      this.addScore(1500);
      if (this.runType !== 'purist') this.gateway.shield = true;
      this.cb.onBanner?.('AQUEDUCT SANCTUM SOLVED!', '★ HARMONIC SEED • +10 GEARS • +15s');
    }

    this.puzzleRoom = null;
    this.puzzle = null;
    this.puzzleDoor = null;
    this.mode = 'tower';
    this._upDoorLatch = true;
    this.input?.consumeJustPressed?.('jump');
    this.input?.consumeJustPressed?.('up');

    const p = this.gateway;
    p.col = wrapCol(door.col + 0.5);
    p.floor = door.floor;
    p.onGround = true;
    p.vx = 0;
    p.vy = 0;
    p.invuln = 1.8;
    p.landingFloor = this._computeLandingFloor(p.col, p.floor);

    sound?.setMiniGameMode?.(null);
    sound?.setTheme?.(this.tower?.theme || 'canyon_river');
    sound?.setTowerTheme?.(this.tower?.id || 1, this.tower?.theme || 'canyon_river');
    this._syncHud();
  }

  _initVaultStage() {
    this.mode = 'vault';
    const isCalm = this.runType === 'sanctum_trials';
    this.vault = {
      activeRing: 0,
      strikes: 0,
      maxStrikes: isCalm ? 5 : 3,
      timer: isCalm ? 16.0 : 13.5,
      duration: isCalm ? 16.0 : 13.5,
      status: 'playing',
      statusTimer: 0,
      rings: this._createVaultRings(),
    };
    this.sanctumVault = this.vault;

    this._handleProgTrophyReturn(this.prog?.recordMiniGamePlayed?.('vault'));
    sound?.setMiniGameMode?.('vault');
    this.cb.onBanner?.('HARMONIC RELIQUARY', 'CORE LOCK VAULT');
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

      if (
        this.input.consumeJustPressed('fire') ||
        this.input.consumeJustPressed('jump') ||
        this.input.consumeJustPressed('whip') ||
        this.input.consumeJustPressed('up')
      ) {
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
              this._awardGears(10);
              sound?.vaultUnlock?.();
              if (v.strikes === 0) this._tryUnlockTrophy('vault_cracker');
              if (!this.standaloneMiniGame && this.vaultReturnState) {
                this.towerVaultCleared = true;
                this.vaultCrackedThisTower = true;
                if (this.runType !== 'purist') this.gateway.shield = true;
                this._tryUnlockTrophy('first_star_core');
                if (this.tower?.id === 8 || this.tower?.id === 10) {
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
              this.cb.onBanner?.('HARMONIC VAULT UNLOCKED!', '★ HARMONIC SEED + 10 GEARS');
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
              this.cb.onBanner?.('LOCK JAMMED', 'RETURNING TO TERRACE');
            }
          }
        }
      }

      if (v.status === 'playing' && v.timer <= 0) {
        v.status = 'failed';
        v.statusTimer = 1.1;
        sound?.vaultFail?.();
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
          this._finishTransitionMiniGame();
        } else {
          this.mode = 'tower';
          this._upDoorLatch = true;
          const p = this.gateway;
          p.col = this.vaultReturnState.col;
          p.floor = this.vaultReturnState.floor;
          p.vx = 0;
          p.vy = 0;
          p.invuln = 2.0;
          p.landingFloor = this._computeLandingFloor(p.col, p.floor);
          this.vaultReturnState = null;
          sound?.setMiniGameMode?.(null);
          sound?.setTheme?.(this.tower?.theme || 'canyon_river');
          sound?.setTowerTheme?.(this.tower?.id || 1, this.tower?.theme || 'canyon_river');
          this._syncHud();
        }
      }
    }

    this._syncHud();
  }

  // ===========================================================================
  // SCENE RENDER DISPATCH (COMPATIBLE WITH BOTH V3 & LEGACY RENDER METHODS)
  // ===========================================================================

  render() {
    if (!this.renderer) return;
    if (typeof this.renderer.renderScene === 'function') {
      this.renderer.renderScene(this);
      return;
    }

    const activeMode = this.mode === 'paused' ? this.pausedFrom || 'tower' : this.mode;
    if (activeMode === 'core_descent') {
      if (typeof this.renderer.renderCoreDescentScene === 'function') {
        this.renderer.renderCoreDescentScene(this);
      } else {
        this.renderer.renderTowerScene?.(this);
      }
    } else if (activeMode === 'reef_swim' || activeMode === 'submarine') {
      this.renderer.renderSubmarineScene?.(this);
    } else if (activeMode === 'rapids_surf' || activeMode === 'skimmer') {
      this.renderer.renderSkimmerScene?.(this);
    } else if (activeMode === 'frill_glide' || activeMode === 'glide') {
      this.renderer.renderGlideScene?.(this);
    } else if (activeMode === 'aqueduct_sanctum' || activeMode === 'puzzle') {
      this.renderer.renderPuzzleScene?.(this);
    } else if (activeMode === 'vault') {
      this.renderer.renderVaultScene?.(this);
    } else if (this.tower) {
      this.renderer.renderTowerScene?.(this);
    }
  }
}

export { ToweringWatersGame as GatewayGame, ToweringWatersGame as WatershedGame };
