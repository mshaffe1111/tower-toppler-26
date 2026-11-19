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
  createWardenGauntletTowers,
  generateProceduralTower,
  createDailyTower,
} from './levels.js';
import { sound } from './audio.js';
import { progression, BIO_MUTATIONS, CRITTER_CATALOG, SKILL_TREE, STORY_CUTSCENES, rollMutationChoices } from './progression.js';
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

// True 120Hz Fixed-Timestep Tactile Hydro-Lizard Physics Engine (COLS = 20, 1 col = 1.323m, 1 floor = 1.50m, Gateway 1.52m / 38kg)
export const FIXED_STEP = 1 / 120;       // Deterministic 120Hz physics sub-step (zero slow-motion at 15fps, zero tunneling at 144Hz!)
const FIXED_EPS = 1e-9;
const MAX_FRAME_DT = 0.10;               // Spike cap (up to 12 deterministic 1/120s sub-steps per frame)
const MAX_SUBSTEPS = 12;

export const BASE_WALK_SPEED = 3.30;     // 4.37 m/s (303ms/stone, 1,009 px/s @ 1080p, 624 CSS px/s @ 412x915)
export const GROUND_ACCEL = 19.5;        // 0.169s weighted claw-plant ramp-up (cols/s²)
export const GROUND_FRICTION = 24.0;     // 0.138s, 0.22 col planted heel-stop (cols/s²)
export const GROUND_SKID_DECEL = 34.0;   // 0.19s braced turnaround skid (cols/s²)
export const JUMP_HORIZ_IMPULSE = 1.18;  // 3.89 cols/s athletic lizard hind-leg running leap drive
const ICE_ACCEL = 9.5;
const ICE_FRICTION = 3.8;
export const AIR_ACCEL = 14.5;           // Realistic mid-air directional thrust (cols/s²)
export const AIR_DRAG = 1.6;             // Aerodynamic horizontal drag (cols/s²)

export const BASE_JUMP_VY = 11.60;       // +1.444F (2.17m) crisp lizard leap apex in 0.245s
export const GRAV_RISE = 46.5;           // Snappy weighted ascent
export const GRAV_JUMP_CUT = 88.0;       // +0.68F crisp short-hop release
export const GRAV_APEX = 54.0;           // Heavier than rise -> ZERO mid-air float!
export const GRAV_FALL = 69.0;           // 0.455s total level air-time
const MAX_FALL_SPEED = 24.0;
export const SPRING_LAUNCH_VY = 18.0;    // +3.48F Snap-Crab carapace & Hydro-Geyser vault launch!
const COYOTE_WINDOW = 0.145;             // 145ms crisp coyote forgiveness
const JUMP_BUFFER_WINDOW = 0.140;        // 140ms jump buffer forgiveness
const MANTLE_MAX_GAP = 0.36;             // 0.36 floors crisp ledge-edge mantle

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
    this._physicsAccum = 0;
    this.timer = 105;
    this.timeLimit = 105;
    this.zenElapsed = 0;

    // Mandatory 3-Seal Campaign Fortress Lock State
    this.crownSealsTotal = 0;
    this.crownSealsBroken = 0;
    this.sealObjectives = [];

    this.shake = 0;
    this.hitStopTimer = 0;
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
    this.wardrobeOrbitYaw = 0;
    this.wardrobeAnimOverride = null;
    this.bestiaryPreview = null;
    this.cutsceneCam = null;

    // Wave 4: 3-Phase Boss Hazards & Critter Sonar Proximity Radar
    this.bossHazards = [];
    this._bossHazardSeq = 0;
    this.critterSonar = {
      active: false,
      distanceFloors: 99,
      dirHint: '',
      critterName: '',
      species: '',
      proximity: 0,
    };
    this._critterSonarPingTimer = 0;

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
      stairStepBob: 0,
      stairStepIndex: -1,
      skidTimer: 0,
      _skidSfxCooldown: 0,
      onElevator: null,
      wallScamper: false,
      climbing: false,
      activeWallStrip: null,
      grappleTarget: null,
      grappleTimer: 0,
      isSwimming: false,
      isGliding: false,
      swimPhase: 0,
      waterDipOffset: 0,
      waterDipVel: 0,
      pushingBox: 0,
      riptideDashTimer: 0,
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
      landSquash: 0,
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

  /**
   * Returns active permanent Pelagian Bio-Skill rank (0..3).
   * Always returns 0 in `'purist'` mode so Purist Arcade stays 100% pure & unboosted!
   */
  getSkillRank(id) {
    if (this.runType === 'purist') return 0;
    return this.prog?.getSkillRank?.(id) || 0;
  }

  /** Convenience wrapper for UI Skill Tree purchases with synchronized audio chime & HUD sync. */
  upgradeSkill(id) {
    const res = this.prog?.upgradeSkill?.(id) || { ok: false, reason: 'unavailable' };
    if (res.ok) {
      sound?.skillUnlock?.(res.rank || 1);
      this._flushPendingProgTrophies();
      this._syncHud();
    }
    return res;
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
      case 'warden_gauntlet':
        return 'warden_gauntlet';
      case 'master_watershed':
        return 'master_watershed';
      default:
        return this.masterWatershed ? 'master_watershed' : 'campaign';
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
    if (m === 'warden_gauntlet' || m === 'boss_rush' || m === 'gauntlet') {
      return this.startWardenGauntletMode(opts);
    }
    if (m === 'master_watershed' || m === 'ng_plus' || m === 'master') {
      return this.startMasterWatershedMode(opts);
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
    sound?.setBossActive?.(false);
    sound?.setGameMode?.(this.runType);
    sound?.setMiniGameMode?.(null);
    sound?.setWind?.(0);
    sound?.setMusicActive?.(true);
  }

  startCampaign({ startTowerIdx = 0, zenMode = this.zenMode, masterWatershed = false } = {}) {
    this.masterWatershed = Boolean(masterWatershed);
    this.zenMode = this.masterWatershed ? false : Boolean(zenMode);
    this.gameMode = this.masterWatershed ? 'master_watershed' : 'campaign';
    this.runType = this.masterWatershed ? 'master_watershed' : 'campaign';
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

  startMasterWatershedMode({ startTowerIdx = 0 } = {}) {
    return this.startCampaign({ startTowerIdx, zenMode: false, masterWatershed: true });
  }

  startWardenGauntletMode({ startActIdx = 0 } = {}) {
    this.masterWatershed = false;
    this.zenMode = false;
    this.gameMode = 'warden_gauntlet';
    this.runType = 'warden_gauntlet';
    this.standaloneMiniGame = false;
    this.dailyMeta = null;
    this.vaultReturnState = null;
    this.activeMutations = [];
    this.pendingMutationChoices = [];
    this.gauntletBossesDefeated = 0;
    this.gauntletElapsedSec = 0;

    this._prepareRunAudioAndVisuals(false);
    this.towers = createWardenGauntletTowers();
    this.towerIndex = Math.max(0, Math.min(this.towers.length - 1, Number(startActIdx) || 0));

    this._resetRunStats();
    this.lives = 3;
    this.nextTowerShield = true;
    this.mode = 'tower';
    this.loadTower(this.towerIndex);
  }

  startPuristMode({ startTowerIdx = 0 } = {}) {
    this.masterWatershed = false;
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
    this.masterWatershed = false;
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
    this.masterWatershed = false;
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
    this.towers = createSanctumTowers(15);
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
    this.masterWatershed = false;
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
    this.masterWatershed = false;
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
    this.hitStopTimer = 0;
    this._physicsAccum = 0;
    this.comboCount = 0;
    this.comboTimer = 0;
    this.input?.resetState?.();
    if (this.gateway) {
      this.gateway.isGliding = resolved === 'frill_glide';
      this.gateway.frillFlare = resolved === 'frill_glide' ? 1 : 0;
      this.gateway.pushingBox = 0;
    }

    if (resolved === 'core_descent') {
      this._initCoreDescentStage();
    } else {
      // Clear stale Core Descent state before entering any other mini-game (#411 Fix #7)
      this.coreDescent = null;
      this.descent = null;
      if (resolved === 'rapids_surf') {
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
    this.coreDescent = null;
    this.descent = null;
    this.critterPods = [];
    this._aquaStepCooldown = 0;
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
    this.coreDescent = null;
    this.descent = null;
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
    // Purist Arcade (0.84x) and Master Watershed NG+ (0.88x) enforce tighter high-stakes clocks!
    const modeClockScale =
      this.runType === 'purist' ? 0.84 : this.masterWatershed || this.runType === 'master_watershed' ? 0.88 : 1.0;
    const chronoSkillSec = this.getSkillRank('chrono_reservoir') * 8;
    this.timeLimit = Math.round(rawLimit * modeClockScale) + bonusSec + chronoSkillSec;
    this.timer = this.timeLimit;
    this.zenElapsed = 0;

    this.particles = [];
    this.popups = [];
    this.hydroPulses.length = 0;
    this.enemyProjectiles = [];
    this.bossHazards = [];
    this.critterSonar = { active: false, distanceFloors: 99, dirHint: '', critterName: '', species: '', proximity: 0 };
    this._critterSonarPingTimer = 0;
    this.shake = 0;
    this.hitStopTimer = 0;
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
    this._physicsAccum = 0;
    this.switchStates = {
      red: false,
      cyan: false,
      conv: false,
      pipeA: false,
      pipeB: false,
      seal_1: false,
      seal_2: false,
      seal_3: false,
    };
    this.pipeStates = { pipeA: false, pipeB: false };

    // Initialize Mandatory 3-Seal Campaign Fortress Objectives (`crownSealsTotal = 3`, `crownSealsBroken = 0`)
    this.sealObjectives = (t.crownSeals || []).map((s, idx) => ({
      id: String(s.id || `seal_${idx + 1}`),
      index: Number(s.index ?? idx + 1),
      label: String(s.label || `Seal ${idx + 1}`),
      shortLabel: String(s.shortLabel || `Seal ${idx + 1}: ${s.label || 'Lock'}`),
      hint: String(s.hint || ''),
      kind: String(s.kind || (idx === 0 ? 'pipe_valves' : idx === 1 ? 'sanctum' : 'upper_sluice')),
      pipeGroup: s.pipeGroup || null,
      doorId: s.doorId || null,
      switchId: s.switchId || null,
      broken: false,
    }));
    this.crownSealsTotal = this.sealObjectives.length;
    this.crownSealsBroken = 0;

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
      visualSlideCol: 0,
      pushTimer: 0,
      _boxDustTimer: 0,
      crumbling: false,
      crumbleTimer: 0,
      crumbleDepress: 0,
      crumbleDepressVel: 0,
      _chipTimer: 0,
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
      cabBounceOffset: 0,
      cabBounceVel: 0,
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
    const rescuedCritters = this.prog?.getRescuedCritters?.() || [];
    this.collectibles = (t.collectibles || []).map((c) => ({
      ...c,
      collected: false,
      alreadyOwned:
        c.type === 'relic'
          ? ownedRelics.includes(c.relicId || c.id)
          : c.type === 'critter_pod'
          ? rescuedCritters.includes(c.critterId || c.id)
          : false,
    }));
    this.critterPods = this.collectibles.filter((c) => c.type === 'critter_pod');

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

    this._syncDynamicLedges(0, true);

    const isMasterNg = Boolean(this.masterWatershed || this.runType === 'master_watershed');
    const rawEnemies = isSanctumTower
      ? (t.enemies || []).filter((e) => Boolean(e && e.harmless))
      : t.enemies || [];
    this.enemies = rawEnemies.map((e, idx) => {
      const inst = this._instantiateEnemy(e, idx);
      if (isMasterNg && !inst.harmless) {
        inst.ngScale = 1.18;
        if (inst.type === 'siphon_warden') {
          inst.hp += 1;
          inst.maxHp += 1;
        }
      }
      return inst;
    });

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
      (Boolean(this.nextTowerShield) || this.hasMutation('bubble_aegis') || this.getSkillRank('tidal_aegis') > 0);
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
    sound?.setGameMode?.(this.runType);
    const biomeTheme = t.theme || 'canyon_river';
    sound?.setTheme?.(biomeTheme);
    sound?.setTowerTheme?.(t.id || 1, biomeTheme);
    const hasLiveWarden =
      this.mode !== 'title' &&
      (this.runType === 'warden_gauntlet' || this.enemies.some((e) => !e.dead && e.type === 'siphon_warden'));
    sound?.setBossActive?.(hasLiveWarden);

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
          : this.runType === 'warden_gauntlet'
          ? t.subtitle || `WARDEN GAUNTLET • ACT ${t.act || 1}/5`
          : this.runType === 'master_watershed' || this.masterWatershed
          ? `MASTER WATERSHED NG+ • 2X REWARDS • SPIRE ${t.id}`
          : this.runType === 'sanctum_trials'
          ? t.subtitle || `SANCTUM TRIAL • SPIRE ${this.endlessDepth + 1}/15`
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

  _resolveActSignature(actNum) {
    const act = Math.max(1, Math.min(5, Math.round(Number(actNum) || 1)));
    if (act === 1) return 'bulldozer_mortar';
    if (act === 2) return 'cryo_beam';
    if (act === 3) return 'mire_tentacles';
    if (act === 4) return 'aegis_summoner';
    return 'leviathan_prime';
  }

  _instantiateEnemy(e, idx = 0) {
    const needsSpan = e.type === 'snap_crab' || e.type === 'gulp_hopper' || (e.type === 'rail_skater' && e.axis !== 'v');
    const span = needsSpan ? this._computeContiguousSpan(e.col, Math.round(e.floor), e.type) : null;
    let initCol = span ? wrapCol(span.startCol + span.initialOffset) : e.col;

    // Keep Siphon Warden / Lock-Keeper bosses patrolling cleanly over their Crown Arena terrace (never offscreen over empty void!)
    let arenaStart = null;
    let arenaLen = null;
    let arenaMinOff = 0.85;
    let arenaMaxOff = null;
    let arenaOffset = 0;
    if (e.type === 'siphon_warden') {
      if (e.arenaStartCol !== undefined && e.arenaLen && e.arenaLen < COLS) {
        arenaStart = wrapCol(e.arenaStartCol);
        arenaLen = e.arenaLen;
      } else {
        const wSpan = this._computeContiguousSpan(e.col, Math.round(e.floor), 'siphon_warden');
        if (wSpan && wSpan.length >= 3 && wSpan.length < COLS) {
          arenaStart = wSpan.startCol;
          arenaLen = wSpan.length;
        }
      }
      if (arenaStart !== null && arenaLen !== null) {
        arenaMinOff = Math.min(0.85, arenaLen * 0.2);
        arenaMaxOff = Math.max(arenaMinOff, arenaLen - arenaMinOff);
        const rel = ((wrapCol(initCol) - arenaStart) % COLS + COLS) % COLS;
        arenaOffset = Math.max(arenaMinOff, Math.min(arenaMaxOff, rel));
        initCol = wrapCol(arenaStart + arenaOffset);
      }
    }

    const defaultSpeedByType = {
      snap_crab: 0.88,
      gulp_hopper: 0.0,
      volt_eel: 1.15,
      rail_skater: 2.35,
      barnacle_mortar: 0.0,
      vent_stalker: 0.78,
      siphon_warden: 2.05,
    };
    const initialAiStateByType = {
      snap_crab: 'patrol',
      gulp_hopper: 'sit_watch',
      volt_eel: 'prowl',
      rail_skater: 'sprint',
      barnacle_mortar: 'watch',
      vent_stalker: 'stalk',
      siphon_warden: 'patrol',
    };
    const initialAiTimerByType = {
      snap_crab: 0,
      gulp_hopper: 0.55,
      volt_eel: Math.max(0.8, 3.4 - (idx % 3) * 0.8),
      rail_skater: 0,
      barnacle_mortar: 0,
      vent_stalker: 1.4,
      siphon_warden: 2.2,
    };
    const actNum = e.act ?? this.tower?.act ?? Math.ceil((this.tower?.id || 1) / 2);
    const actSig = e.type === 'siphon_warden' ? this._resolveActSignature(actNum) : null;
    const baseSpd =
      e.type === 'siphon_warden'
        ? Math.max(1.85, Math.min(2.35, Number(e.speed ?? defaultSpeedByType.siphon_warden)))
        : defaultSpeedByType[e.type] ?? 0.88;

    return {
      ...e,
      col: initCol,
      spawnCol: initCol,
      spawnFloor: e.floor,
      baseFloor: e.floor,
      speed: baseSpd,
      ngScale: 1.0,
      phase: (e.phaseOffset ?? idx * 1.43) % (Math.PI * 2),
      aiState: initialAiStateByType[e.type] || 'patrol',
      aiTimer: initialAiTimerByType[e.type] ?? 0,
      velCol: 0,
      velFloor: 0,
      telegraph: 0,
      chargeBlend: 0,
      inflatePhase: 0,
      coilBlend: 0,
      shockActive: false,
      brakeBlend: 0,
      shellHide: 0,
      venting: false,
      actSignature: actSig,
      aggroCooldown: 0,
      hopVy: 0,
      hopVx: 0,
      vDir: e.dir === -1 ? -1 : 1,
      stalkClock: (idx * 0.85) % 2.4,
      brakeStartSpeed: 2.35,
      stunTimer: 0,
      flipped: false,
      flipTimer: 0,
      slitherPhase: (idx * 0.9) % (Math.PI * 2),
      openAmount: 0,
      fireTimer: 1.1 + (idx % 3) * 0.65,
      hp: e.hp ?? (e.type === 'siphon_warden' ? 3 : 1),
      maxHp: e.maxHp ?? e.hp ?? (e.type === 'siphon_warden' ? 3 : 1),
      shielded: e.type === 'siphon_warden',
      harmless: Boolean(e.harmless),
      bossTitle: e.bossTitle || null,
      phase2Spawned: false,
      bossPhase: 'patrol',
      bossPhaseTier: 1,
      coreExposed: false,
      coreExposeTimer: 0,
      bossTimer: 2.2,
      bossHitCooldown: 0,
      arenaStart,
      arenaLen,
      arenaMinOff,
      arenaMaxOff,
      arenaOffset,
      dead: false,
      deathTimer: 0,
      edgePause: 0,
      spanStart: span ? span.startCol : null,
      spanLen: span ? span.length : null,
      spanMinOff: span ? span.minOff : 0.58,
      spanMaxOff: span ? span.maxOff : null,
      spanOffset: span ? span.initialOffset : 0,
    };
  }

  _hasShaftOrHardWallAt(c, floor) {
    const wc = wrapCol(c);
    if (
      this.elevators?.some(
        (el) => wrapCol(el.col) === wc && floor >= el.minFloor - 0.45 && floor <= el.maxFloor + 0.45
      )
    ) {
      return true;
    }
    if (
      this.ledges?.some(
        (l) =>
          !l.gone &&
          l.active &&
          (l.type === 'pillar' || l.type === 'laserGate') &&
          wrapCol(l.col) === wc &&
          (l.h ? l.floor < floor + 1.2 && l.floor + l.h > floor + 0.15 : Math.abs(l.floor - floor) < 0.65)
      )
    ) {
      return true;
    }
    return false;
  }

  _computeContiguousSpan(col, floor, enemyType = 'snap_crab') {
    const hasTile = (c) => {
      const wc = wrapCol(c);
      if (this._hasShaftOrHardWallAt(wc, floor)) return false;
      return this.ledges.some(
        (l) =>
          !l.gone &&
          l.active &&
          l.type !== 'box' &&
          l.type !== 'pillar' &&
          l.type !== 'laserGate' &&
          Math.abs(l.floor - floor) < 0.25 &&
          wrapCol(l.col) === wc
      );
    };
    const startTile = Math.floor(wrapCol(col));
    if (!hasTile(startTile)) {
      return { startCol: startTile, length: 3, minOff: 0.65, maxOff: 2.35, initialOffset: 1.5 };
    }
    let leftSteps = 0;
    while (leftSteps < COLS - 1 && hasTile(startTile - leftSteps - 1)) leftSteps++;
    let rightSteps = 0;
    while (rightSteps < COLS - 1 - leftSteps && hasTile(startTile + rightSteps + 1)) rightSteps++;
    const spanStart = wrapCol(startTile - leftSteps);
    const length = Math.max(1, leftSteps + 1 + rightSteps);

    // Wide ground-enemy clearance: >= 0.55–0.90 cols before elevator rails, stone pillars, or ledge drop-offs!
    const isWide = enemyType === 'snap_crab';
    const wallMargin = isWide ? 0.90 : 0.72;
    const dropMargin = isWide ? 0.62 : 0.55;
    const leftBlocked = this._hasShaftOrHardWallAt(spanStart - 1, floor);
    const rightBlocked = this._hasShaftOrHardWallAt(spanStart + length, floor);
    const rawMinOff = leftBlocked ? wallMargin : dropMargin;
    const rawMaxOff = length - (rightBlocked ? wallMargin : dropMargin);
    const minOff = rawMinOff <= rawMaxOff ? rawMinOff : length * 0.5;
    const maxOff = rawMinOff <= rawMaxOff ? rawMaxOff : length * 0.5;
    const rawInitial = leftSteps + (wrapCol(col) - startTile || 0.5);
    const initialOffset = Math.max(minOff, Math.min(maxOff, rawInitial));
    return { startCol: spanStart, length, minOff, maxOff, initialOffset };
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
    const ngMult = this.masterWatershed || this.runType === 'master_watershed' ? 2 : 1;
    this.score += Math.floor(pts * ngMult);
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
    if (this.masterWatershed || this.runType === 'master_watershed') {
      amt *= 2;
    }
    if (this.hasMutation('tidal_magnet') && Math.random() < 0.35) {
      amt += 1;
    }
    const magRank = this.getSkillRank('pelagic_magnet');
    if (magRank > 0 && Math.random() < magRank * 0.10) {
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
      if (!cd) return null;
      return `CORE CRYSTALS ${cd.crystalsSmashed}/${cd.crystalsRequired} • DEPTH ${Math.round(cd.depth)}m`;
    }
    if (activeMode !== 'tower' || !this.tower) return null;

    if (this.runType === 'warden_gauntlet') {
      const boss = this.enemies.find((e) => !e.dead && e.type === 'siphon_warden');
      if (boss) {
        return `${boss.bossTitle || 'SIPHON WARDEN'} • HP ${boss.hp}/${boss.maxHp}`;
      }
      return `WARDEN BANISHED • ENTER CROWN SHRINE (${this.gauntletBossesDefeated || 0}/5)`;
    }
    if (this.runType === 'master_watershed' || this.masterWatershed) {
      return `MASTER NG+ • 2X YIELD • SPIRE ${this.tower.id}/10`;
    }
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
    const overdrive = this.hasMutation('harmonic_overdrive');
    const maxCap = overdrive ? 10 : this.runType === 'purist' ? 8 : 4;
    const step = overdrive ? 2 : 1;
    this.comboCount = Math.min(maxCap, (this.comboCount || 0) + step);
    this.comboTimer = overdrive ? 5.2 : this.runType === 'purist' ? 4.0 : 3.2;
    if (overdrive && this.comboCount % 4 === 0 && !this.zenMode && this.mode === 'tower') {
      this.timer = Math.min(this.timeLimit, this.timer + 4);
    }
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

  _spawnSplashDroplets(x, y, col = null, floor = null, count = 24, speedScale = 1.0) {
    const colors = ['#e8f6ff', '#67e8f9', '#2dd4bf', '#a5f3fc'];
    for (let i = 0; i < count; i++) {
      const spread = (Math.random() - 0.5) * 260 * speedScale;
      const upSpeed = -(130 + Math.random() * 190) * speedScale;
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
        (sw.mode === 'pipeValve' || sw.mode === 'floodValve' || sw.mode === 'drainValve' || sw.mode === 'sluiceSeal') &&
        sw.cooldown <= 0 &&
        Math.abs(sw.floor - p.floor) < 0.72 &&
        Math.abs(colDist(p.col, sw.col + 0.5)) < 0.92
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

  _isCrownLocked() {
    return (this.crownSealsTotal || 0) > 0 && (this.crownSealsBroken || 0) < (this.crownSealsTotal || 0);
  }

  _getLockedSeals() {
    return (this.sealObjectives || []).filter((s) => !s.broken);
  }

  _breakCrownSeal(sealId, customBannerSub = '') {
    if (!Array.isArray(this.sealObjectives) || this.sealObjectives.length === 0) return false;
    const seal = this.sealObjectives.find((s) => s.id === sealId);
    if (!seal || seal.broken) return false;

    seal.broken = true;
    this.crownSealsBroken = this.sealObjectives.filter((s) => s.broken).length;
    this.switchStates[seal.id] = true;
    this.pipeStates[seal.id] = true;
    for (const el of this.elevators) {
      if (el.pipeGroup === seal.id && !el.powered) {
        el.powered = true;
      }
    }
    this._syncDynamicLedges(0, true);

    this.addScore(400);
    this._awardGears(3);
    this.addShake(6.5);
    if (typeof sound?.vaultUnlock === 'function') sound.vaultUnlock();
    else sound?.collectStar?.();
    this.input?.haptic?.([20, 35, 50]);

    const p = this.gateway;
    const allBroken = this.crownSealsBroken >= this.crownSealsTotal;
    if (p) {
      this.addPopup({
        col: p.col,
        floor: p.floor + 1.45,
        text: allBroken
          ? `★ ALL ${this.crownSealsTotal}/${this.crownSealsTotal} CROWN SEALS SHATTERED!`
          : `✦ SEAL ${this.crownSealsBroken}/${this.crownSealsTotal} BROKEN: ${seal.label.toUpperCase()}!`,
        color: allBroken ? '#fde047' : '#5efce8',
        maxLife: 1.7,
      });
    }
    this.cb.onBanner?.(
      allBroken
        ? 'ALL 3 CROWN SEALS SHATTERED!'
        : `CROWN SEAL ${this.crownSealsBroken}/${this.crownSealsTotal} SHATTERED!`,
      allBroken
        ? 'SUMMIT CROWN VALVE UNSEALED • ASCEND & DIVE!'
        : customBannerSub || `${seal.label.toUpperCase()} COMPLETE`
    );
    this._syncHud();
    return true;
  }

  _denyLockedCrown(door) {
    const locked = this._getLockedSeals();
    const lockedList = locked.map((s) => `${s.index}/${this.crownSealsTotal} ${s.label}`).join(' • ');
    if (typeof sound?.hitBlock === 'function') sound.hitBlock();
    sound?.vaultTick?.(false);
    this.addShake(4.2);
    this.input?.haptic?.([25, 45]);
    this.cb.onBanner?.(
      `CROWN SEALED (${this.crownSealsBroken}/${this.crownSealsTotal})`,
      lockedList ? `LOCKED: ${lockedList}` : 'BREAK ALL 3 SEALS FIRST'
    );
    const col = door ? door.col + 0.5 : this.gateway?.col ?? 0.5;
    const floor = door ? door.floor : this.gateway?.floor ?? 0;
    this.addPopup({
      col,
      floor: floor + 1.45,
      text: `🔒 CROWN SEALED (${this.crownSealsBroken}/${this.crownSealsTotal}) — ${locked[0]?.label?.toUpperCase() || 'SOLVE SEALS'}`,
      color: '#fb7185',
      maxLife: 1.65,
    });
    this._syncHud();
  }

  _buildHudPayload() {
    const activeMode = this.mode === 'paused' ? this.pausedFrom || 'tower' : this.mode;
    const interactCtx = this._evaluateInteractContext();

    const exitDoor = this.tower?.doors?.find((d) => d.isExit);
    const exitFloor = exitDoor ? exitDoor.floor : Math.max(1, (this.tower?.floors || 18) - 2);
    const p = this.gateway;

    const altitudePct =
      activeMode === 'core_descent'
        ? Math.max(0, Math.min(100, Math.round((1 - (this.coreDescent?.progress || 0)) * 100)))
        : Math.max(0, Math.min(100, Math.round((p.floor / Math.max(1, exitFloor)) * 100)));

    const waterPct =
      this.waterFloor > -0.45
        ? Math.max(0, Math.min(100, Math.round(((this.waterFloor + 0.55) / (exitFloor + 0.55)) * 100)))
        : 0;

    let dirHint = '▲';
    let actionPrompt = null;
    const crownLocked = this._isCrownLocked();

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
            if (crownLocked) {
              const locked = this._getLockedSeals();
              const needTxt = locked.map((s) => s.label.toUpperCase()).join(' & ');
              actionPrompt = `🔒 CROWN SEALED (${this.crownSealsBroken}/${this.crownSealsTotal}) — SOLVE ${needTxt}`;
            } else if (missionType === 'tower_repair' && !this.dynamoCrafted && !wb?.crafted) {
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
            actionPrompt = '▲ ENTER CROSS-SPIRE TUNNEL';
          }
        } else if (interactCtx.switchObj) {
          const sw = interactCtx.switchObj;
          if (sw.mode === 'sluiceSeal') {
            const liveKeeper = sw.requiresLockKeeper
              ? this.enemies.find((e) => !e.dead && (e.isLockKeeper || e.type === 'siphon_warden'))
              : null;
            actionPrompt = liveKeeper
              ? `🔒 DEFEAT ${(liveKeeper.bossTitle || 'LOCK-KEEPER').toUpperCase()} TO UNLOCK SLUICE`
              : '◎ WHIP / PULSE • PULL UPPER SLUICE LEVER';
          } else {
            actionPrompt =
              sw.mode === 'floodValve'
                ? '◎ WHIP / PULSE • OPEN FLOODGATE'
                : '◎ WHIP / PULSE • SPIN PIPE-VALVE';
          }
        } else if (unpoweredLift) {
          actionPrompt = 'SPIN BOTH PIPE-VALVES TO POWER LIFT';
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
      if (cd?.phase === 'seed_plant' || cd?.seedPlanted) {
        actionPrompt = '★ HARMONIC WATER SEED PLANTED!';
      } else {
        actionPrompt = `STEER TURBINES • WHIP/PULSE CRYSTALS (${cd?.crystalsSmashed ?? 0}/${cd?.crystalsRequired ?? 3})`;
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
    let displayLimit = this.timeLimit || this.tower?.timeLimit || 260;
    if (activeMode === 'core_descent' && this.coreDescent) {
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

    return {
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
      crownSealsBroken: this.crownSealsBroken || 0,
      crownSealsTotal: this.crownSealsTotal || 0,
      crownLocked,
      sealObjectives: (this.sealObjectives || []).map((s) => ({ ...s })),
      coreDescent: activeMode === 'core_descent' && this.coreDescent ? {
        progress: this.coreDescent.progress,
        depth: Math.round(this.coreDescent.depth),
        totalDepth: this.coreDescent.totalDepth,
        crystalsSmashed: this.coreDescent.crystalsSmashed,
        crystalsRequired: this.coreDescent.crystalsRequired,
        coresSmashed: this.coreDescent.crystalsSmashed,
        totalCores: this.coreDescent.crystalsRequired,
        seedPlanted: this.coreDescent.seedPlanted,
      } : null,
      coresSmashed: this.coreDescent?.crystalsSmashed ?? 0,
      totalCores: this.coreDescent?.crystalsRequired ?? 3,
      crittersRescued: this.prog?.getCritterCount?.() ?? 0,
      crittersTotal: CRITTER_CATALOG.length,
      critterSonar: this.critterSonar?.active ? { ...this.critterSonar } : null,
      skillRanks: this.prog?.getAllSkillRanks?.() || {},
      comboMult: Math.max(1, this.comboCount || 1),
      actionPrompt,
      interactKind: crownLocked && interactCtx.door?.isExit ? '' : interactCtx.kind,
      canPeekClue,
      missionStatus,
      boostMult,
      _interactCtx: interactCtx,
    };
  }

  getHudState() {
    const payload = this._buildHudPayload();
    delete payload._interactCtx;
    return payload;
  }

  getRenderState() {
    return {
      mode: this.mode,
      time: this.time,
      tower: this.tower,
      gateway: this.gateway,
      player: this.gateway,
      pogo: this.gateway,
      ledges: this.ledges,
      elevators: this.elevators,
      switches: this.switches,
      wallStrips: this.wallStrips,
      grappleRings: this.grappleRings,
      collectibles: this.collectibles,
      critterPods: this.critterPods,
      enemies: this.enemies,
      enemyProjectiles: this.enemyProjectiles,
      hydroPulses: this.hydroPulses,
      bossHazards: this.bossHazards,
      particles: this.particles,
      popups: this.popups,
      camCol: this.camCol,
      camFloor: this.camFloor,
      waterFloor: this.waterFloor,
      waterPurified: this.waterPurified,
      windCurrent: this.windCurrent,
      lightningFlash: this.lightningFlash,
      shake: this.shake,
      hitStopTimer: this.hitStopTimer || 0,
      crownSealsBroken: this.crownSealsBroken || 0,
      crownSealsTotal: this.crownSealsTotal || 0,
      crownLocked: this._isCrownLocked(),
      sealObjectives: (this.sealObjectives || []).map((s) => ({ ...s })),
      switchStates: this.switchStates,
      pipeStates: this.pipeStates,
    };
  }

  _syncHud() {
    const activeMode = this.mode === 'paused' ? this.pausedFrom || 'tower' : this.mode;
    const payload = this._buildHudPayload();
    const interactCtx = payload._interactCtx;
    delete payload._interactCtx;
    this.input?.setGameMode?.(activeMode);
    const lockedExit = Boolean(payload.crownLocked && interactCtx?.door?.isExit);
    this.input?.setInteractContext?.(
      lockedExit ? false : Boolean(interactCtx?.canInteract),
      lockedExit ? '' : interactCtx?.kind || ''
    );
    this.cb.onHud?.(payload);
  }

  // ===========================================================================
  // MAIN SIMULATION TICK — TRUE 120Hz FIXED-TIMESTEP ACCUMULATOR
  // ===========================================================================

  update(dt) {
    const rawDt = Math.min(MAX_FRAME_DT, Math.max(0, Number(dt) || 0));
    this._physicsAccum = Math.min(MAX_FRAME_DT, (this._physicsAccum || 0) + rawDt);

    let steps = 0;
    while (this._physicsAccum + FIXED_EPS >= FIXED_STEP && steps < MAX_SUBSTEPS) {
      this._physicsAccum = Math.max(0, this._physicsAccum - FIXED_STEP);
      this._stepFixed(FIXED_STEP);
      steps += 1;
    }

    if (steps > 0) {
      this.input?.clearFrame?.();
      this._syncHud();
    }
  }

  _stepFixed(dt) {
    this.time += dt;
    this.input?.update?.(dt);

    if (this._stationHintCooldown > 0) {
      this._stationHintCooldown = Math.max(0, this._stationHintCooldown - dt);
    }
    if (this._casualSkipConfirmTimer > 0) {
      this._casualSkipConfirmTimer = Math.max(0, this._casualSkipConfirmTimer - dt);
    }

    if (this.prog?._pendingAutoTrophies?.length > 0) {
      this._flushPendingProgTrophies();
    }

    if (this.shake > 0) {
      this.shake *= Math.exp(-9 * dt);
      if (this.shake < 0.12) this.shake = 0;
    }

    if (this.lightningFlash > 0) {
      this.lightningFlash = Math.max(0, this.lightningFlash - dt * 2.8);
    }

    if (this.comboTimer > 0) {
      this.comboTimer = Math.max(0, this.comboTimer - dt);
      if (this.comboTimer <= 0) this.comboCount = 0;
    }

    for (let i = this.popups.length - 1; i >= 0; i--) {
      const pop = this.popups[i];
      pop.life -= dt;
      if (pop.floor != null) pop.floor += dt * 0.9;
      if (pop.y != null) pop.y -= dt * 34;
      if (pop.life <= 0) this.popups.splice(i, 1);
    }

    for (let i = this.particles.length - 1; i >= 0; i--) {
      const pt = this.particles[i];
      pt.x += pt.vx * dt;
      pt.y += pt.vy * dt;
      pt.vy += (pt.gravity ?? 180) * dt;
      if (pt.col != null) pt.col = wrapCol(pt.col + (pt.vx / 56) * dt);
      if (pt.floor != null) pt.floor -= (pt.vy / 46) * dt;
      pt.life -= dt;
      if (pt.life <= 0) this.particles.splice(i, 1);
    }

    if (this.mode !== 'tower') {
      this.input?.setInteractContext?.(false, '');
    }

    if (this.mode === 'title') {
      this.camCol = wrapCol(this.camCol + dt * 0.52);
      this._syncDynamicLedges(dt, true);
    } else if (this.mode === 'tower') {
      this._updateTower(dt);
    } else if (this.mode === 'core_descent') {
      this._updateCoreDescent(dt);
    } else if (this.mode === 'topple') {
      this._updateTopple(dt);
    } else if (this.mode === 'reef_swim' || this.mode === 'submarine') {
      this._updateSubmarine(dt);
    } else if (this.mode === 'rapids_surf' || this.mode === 'skimmer') {
      this._updateSkimmer(dt);
    } else if (this.mode === 'frill_glide' || this.mode === 'glide') {
      this._updateGlide(dt);
    } else if (this.mode === 'aqueduct_sanctum' || this.mode === 'puzzle') {
      this._updatePuzzle(dt);
    } else if (this.mode === 'vault') {
      this._updateVault(dt);
    }
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

    // Upper Sluice Seal Lever (`sluiceSeal`): requires defeating the spire's Lock-Keeper/Warden first!
    if (sw.mode === 'sluiceSeal') {
      if (sw.active) return;
      if (sw.requiresLockKeeper) {
        const liveKeeper = this.enemies.find((e) => !e.dead && (e.isLockKeeper || e.type === 'siphon_warden'));
        if (liveKeeper) {
          sw.cooldown = 0.7;
          if (typeof sound?.hitBlock === 'function') sound.hitBlock();
          sound?.vaultTick?.(false);
          this.addShake(3.2);
          this.input?.haptic?.([22, 35]);
          const title = (liveKeeper.bossTitle || 'LOCK-KEEPER').toUpperCase();
          this.cb.onBanner?.('UPPER SLUICE LOCKED!', `DEFEAT ${title} TO UNLOCK LEVER`);
          this.addPopup({
            col: sw.col + 0.5,
            floor: sw.floor + 1.0,
            text: `🔒 DEFEAT ${title} FIRST!`,
            color: '#fb7185',
            maxLife: 1.45,
          });
          return;
        }
      }
      sw.cooldown = 0.8;
      sw.active = true;
      sw.targetValveAngle = (sw.targetValveAngle || 0) + Math.PI * 1.5;
      this.towerSwitchesUsed += 1;
      if (typeof sound?.pipeValve === 'function') sound.pipeValve();
      else sound?.switchToggle?.();
      this.input?.haptic?.([20, 30, 45]);
      const sId = sw.sealId || 'seal_3';
      this.switchStates[sId] = true;
      const broke = this._breakCrownSeal(sId, 'UPPER SLUICE ENGAGED • SUMMIT CROWN UNSEALED!');
      if (!broke) {
        this.addPopup({
          col: sw.col + 0.5,
          floor: sw.floor + 0.9,
          text: '★ UPPER SLUICE UNLOCKED!',
          color: '#fde047',
          maxLife: 1.35,
        });
      }
      this._emitProgEvent('switch_trigger', { mode: 'sluiceSeal', group: sId, poweredLift: false });
      this._syncDynamicLedges(0, true);
      return;
    }

    sw.cooldown = sw.mode === 'drainValve' ? 2.8 : 0.55;
    sw.targetValveAngle = (sw.targetValveAngle || 0) + Math.PI * 1.5;
    this.towerSwitchesUsed += 1;
    if (typeof sound?.pipeValve === 'function') sound.pipeValve();
    else sound?.switchToggle?.();
    this.input?.haptic?.(16);

    let poweredLift = false;

    if (sw.mode === 'pipeValve') {
      const pGrp = sw.pipeGroup || sw.group || 'pipeA';
      sw.active = true;
      const groupValves = this.switches.filter(
        (s) => s.mode === 'pipeValve' && (s.pipeGroup || s.group || 'pipeA') === pGrp
      );
      const spunCount = groupValves.filter((s) => s.active).length;
      const totalNeeded = Math.max(1, groupValves.length);

      if (spunCount < totalNeeded) {
        this.addShake(3.2);
        this.addPopup({
          col: sw.col + 0.5,
          floor: sw.floor + 0.95,
          text: `◈ COPPER VALVE ${spunCount}/${totalNeeded} — SPIN NEXT VALVE!`,
          color: '#fbbf24',
          maxLife: 1.5,
        });
        this.cb.onBanner?.(
          `PIPE PRESSURE ${spunCount}/${totalNeeded}`,
          'FIND & SPIN THE SECOND COPPER VALVE TO POWER THE LIFT'
        );
      } else {
        this.pipeStates[pGrp] = true;
        this.switchStates[pGrp] = true;
        for (const el of this.elevators) {
          if (el.pipeGroup === pGrp && !el.powered) {
            el.powered = true;
            poweredLift = true;
          }
        }
        this.addShake(4.5);
        const brokeSeal = sw.sealId
          ? this._breakCrownSeal(sw.sealId, poweredLift ? 'COPPER PIPES PRESSURIZED • ELEVATOR ACTIVE!' : 'HYDRO CONDUIT PRESSURIZED!')
          : false;
        if (!brokeSeal) {
          this.addPopup({
            col: sw.col + 0.5,
            floor: sw.floor + 0.85,
            text: poweredLift ? '◈ PIPE PRESSURIZED • LIFT ACTIVE!' : '◈ HYDRO CONDUIT OPEN!',
            color: '#2dd4bf',
            maxLife: 1.35,
          });
        }
      }
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

  _canSlideSiphonBox(box, pushDir) {
    if (!box || box.gone || !box.active || box.type !== 'box' || !pushDir) return false;
    const destCol = wrapCol(box.col + Math.sign(pushDir));
    const boxFloor = Math.round(box.floor);
    if (this._hasShaftOrHardWallAt(destCol, boxFloor)) return false;
    if (
      this.wallStrips?.some(
        (ws) => wrapCol(ws.col) === destCol && boxFloor >= ws.minFloor - 0.25 && boxFloor <= ws.maxFloor + 0.25
      )
    ) {
      return false;
    }
    const support = this.ledges.find(
      (l) =>
        this._isWalkableLedge(l) &&
        (l.type === 'solid' || l.type === 'ice' || l.type === 'conveyorL' || l.type === 'conveyorR') &&
        wrapCol(l.col) === destCol &&
        Math.abs(l.floor - boxFloor) < 0.22
    );
    if (!support) return false;
    const hasBarrier = this.ledges.some(
      (b) =>
        b !== box &&
        !b.gone &&
        b.active &&
        (b.type === 'box' || b.type === 'pillar' || b.type === 'laserGate') &&
        wrapCol(b.col) === destCol &&
        Math.abs(b.floor - boxFloor) < 0.75
    );
    if (hasBarrier) return false;
    // Never slide a crate onto any switch/valve, doorway, workbench, or reliquary chest!
    if (this.switches?.some((sw) => wrapCol(sw.col) === destCol && Math.abs(sw.floor - boxFloor) < 0.65)) {
      return false;
    }
    if (this.tower?.doors?.some((d) => wrapCol(d.col) === destCol && Math.abs(d.floor - boxFloor) < 0.75)) {
      return false;
    }
    if (this.tower?.workbench && wrapCol(this.tower.workbench.col) === destCol && Math.abs(this.tower.workbench.floor - boxFloor) < 0.75) {
      return false;
    }
    if (this.tower?.treasureChest && wrapCol(this.tower.treasureChest.col) === destCol && Math.abs(this.tower.treasureChest.floor - boxFloor) < 0.75) {
      return false;
    }
    return true;
  }

  _shatterSiphonBox(box, hitDir = 1, pts = 75) {
    if (!box || box.gone) return;
    box.gone = true;
    box.active = false;
    box.respawnTimer = Infinity;
    box.visualSlideCol = 0;
    box.pushTimer = 0;
    this.hitStopTimer = Math.max(this.hitStopTimer || 0, 0.035);
    this._scoreActionHit(pts, { col: box.col + 0.5, floor: box.floor + 0.6 }, '#fde047');
    this._tryUnlockTrophy('box_breaker');
    this.addShake(4.0);
    this._triggerStormSiphonShockwave(box.col + 0.5, box.floor);

    const dirSign = Math.sign(hitDir) || 1;
    const pos = this._colFloorToScreen(box.col + 0.5, box.floor + 0.45, 12);
    const baseX = pos ? pos.x : (this.renderer?.width || 390) * 0.5;
    const baseY = pos ? pos.y : (this.renderer?.height || 680) * 0.55;
    const debrisColors = ['#d97706', '#92400e', '#fbbf24', '#cbd5e1'];
    for (let k = 0; k < 14; k++) {
      const spreadA = (Math.random() - 0.5) * 1.4;
      const spd = 75 + Math.random() * 115;
      const life = 0.42 + Math.random() * 0.34;
      this.particles.push({
        x: baseX + (Math.random() - 0.5) * 14,
        y: baseY + (Math.random() - 0.5) * 14,
        col: wrapCol(box.col + 0.5 + (Math.random() - 0.5) * 0.36),
        floor: box.floor + 0.25 + Math.random() * 0.5,
        vx: dirSign * Math.cos(spreadA) * spd + (Math.random() - 0.5) * 40,
        vy: -Math.abs(Math.sin(spreadA)) * spd - (45 + Math.random() * 75),
        gravity: 290,
        size: 3.5 + Math.random() * 4.5,
        color: debrisColors[k % debrisColors.length],
        isCrateDebris: true,
        life,
        maxLife: life,
      });
    }
    if (typeof sound?.hitBlock === 'function') sound.hitBlock();
    else sound?.hitEnemy?.();
  }

  _executeTailWhip() {
    const p = this.gateway;
    const isTriple = this.hasMutation('triple_whip');
    const vortexRank = this.getSkillRank('wide_tail_vortex');
    const dur = isTriple ? 0.40 : 0.32;
    p.tailWhipTimer = dur;
    p.whipTimer = dur;
    p.tailWhip = 1.0;
    p.whipCooldown = (isTriple ? 0.30 : 0.42) * (1 - vortexRank * 0.08);
    p.whipBuffer = 0;
    p.squashX = 1.14;
    p.squashY = 0.90;
    this.towerWhiplashes += 1;

    // Bio-Mutation: Riptide Tail-Dash (`hydro_dash`) — mid-air forward surge + brief invuln!
    if (!p.onGround && !p.wallScamper && this.hasMutation('hydro_dash')) {
      const dashSpeed = BASE_WALK_SPEED * (this.hasMutation('gecko_sprint') ? 1.22 : 1.0) * 1.65;
      p.vx = p.facing * dashSpeed;
      p.vy = Math.max(p.vy, 2.8);
      p.invuln = Math.max(p.invuln || 0, 0.35);
      p.knockbackTimer = 0.14;
      p.riptideDashTimer = 0.22;
      this.addPopup({
        col: p.col,
        floor: p.floor + 1.0,
        text: '➤ RIPTIDE DASH!',
        color: '#22d3ee',
        maxLife: 0.75,
      });
    }

    if (typeof sound?.tailWhip === 'function') sound.tailWhip();
    else if (typeof sound?.whip === 'function') sound.whip();
    else sound?.jump?.();
    this.input?.haptic?.(16);
    this._emitProgEvent('tail_whip', { towerId: this.tower?.id || 1 });

    const reachCols = (isTriple ? 2.10 : 1.65) * (1 + vortexRank * 0.14);
    const reachFloors = 1.18 * (1 + vortexRank * 0.08);

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

    // 2. Shatter adjacent Siphon Lock Crates ('box') with physical debris & 35ms hit-stop!
    for (const l of this.ledges) {
      if (!l.gone && l.active && l.type === 'box') {
        const hitF = l.h ? p.floor >= l.floor - 0.4 && p.floor <= l.floor + l.h + 0.4 : Math.abs(l.floor - p.floor) <= reachFloors;
        if (hitF && Math.abs(colDist(p.col, l.col + 0.5)) <= reachCols) {
          const hitDir = Math.sign(colDist(p.col, l.col + 0.5)) || p.facing;
          this._shatterSiphonBox(l, hitDir, 75);
        }
      }
    }

    // 3. Deflect Parabolic Barnacle Mortar Bubbles along a fast pressurized return trajectory (speed = 7.8) + 35ms hit-stop!
    for (const proj of this.enemyProjectiles) {
      if (
        !proj.deflected &&
        Math.abs(proj.floor - (p.floor + 0.4)) <= reachFloors + 0.35 &&
        Math.abs(colDist(p.col, proj.col)) <= reachCols + 0.30
      ) {
        proj.deflected = true;
        proj.speed = isTriple ? 9.2 : 7.8;
        // Aim pressurized return trajectory back at originating mortar/warden or opposite direction!
        let returnTarget = null;
        let bestDist = 9.0;
        for (const en of this.enemies) {
          if (en.dead || en.harmless) continue;
          const dC = Math.abs(colDist(proj.col, en.col));
          const dF = Math.abs(en.floor - proj.floor);
          if (dC < bestDist && dF < 4.5) {
            bestDist = dC;
            returnTarget = en;
          }
        }
        if (returnTarget) {
          const dToTarget = colDist(proj.col, returnTarget.col);
          proj.dir = Math.sign(dToTarget) || -proj.dir || p.facing;
          const tFlight = Math.max(0.12, Math.abs(dToTarget) / proj.speed);
          proj.grav = 2.4;
          proj.vy = ((returnTarget.floor + 0.35) - proj.floor) / tFlight + 0.5 * proj.grav * tFlight;
        } else {
          proj.dir = -proj.dir || p.facing;
          proj.grav = 2.0;
          proj.vy = 0.65;
        }
        proj.life = 1.6;
        this.hitStopTimer = Math.max(this.hitStopTimer || 0, 0.035);
        this._scoreActionHit(120, { col: proj.col, floor: proj.floor + 0.5 }, '#5efce8');
        this.addPopup({
          col: proj.col,
          floor: proj.floor + 0.9,
          text: '◎ DEFLECTED!',
          color: '#5efce8',
          maxLife: 1.0,
        });
        this.addShake(3.8);
        sound?.deflect?.();
      }
    }

    // 4. Flip Snap-Crabs & Strike Enemies / Siphon Wardens (2.0x Scale Hitboxes + Physical Recoil!)
    let landedMeleeHit = false;
    for (const en of this.enemies) {
      if (en.dead) continue;
      const eColBonus = en.type === 'siphon_warden' ? 0.35 : 0.15;
      if (Math.abs(en.floor - p.floor) <= reachFloors + eColBonus && Math.abs(colDist(p.col, en.col)) <= reachCols + eColBonus) {
        this._applyAttackToEnemy(en, 'whip');
        if (!landedMeleeHit) {
          landedMeleeHit = true;
          const recoilDir = -Math.sign(colDist(p.col, en.col) || p.facing) || -p.facing;
          p.vx = recoilDir * 2.15;
          p.squashX = 1.20;
          p.squashY = 0.84;
          this.addShake(4.2);
        }
      }
    }
  }

  _applyAttackToEnemy(en, source = 'pulse') {
    const pos = this._colFloorToScreen(en.col, en.floor + 0.35, 14);

    if (en.type === 'snap_crab') {
      en.flipped = true;
      en.flipTimer = 5.6;
      en.stunTimer = 5.6;
      en.aiState = 'flipped';
      en.velCol = 0;
      en.velFloor = 0;
      en.chargeBlend = 0;
      en.telegraph = 0;
      if (source === 'whip') this.hitStopTimer = Math.max(this.hitStopTimer || 0, 0.025);
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
      if ((en.bossHitCooldown || 0) > 0) return;
      const breakerRank = this.getSkillRank('warden_breaker');
      const exposeMult = 1 + breakerRank * 0.2;
      const isShielded = Boolean(en.shielded || (!en.coreExposed && en.bossPhase !== 'vulnerable'));

      if (isShielded && source !== 'deflect') {
        // Hydro-Pulse or Tail-Whip cracks the Siphon Shield into a clear Core Exposure window!
        en.bossPhase = 'vulnerable';
        en.aiState = 'vulnerable';
        en.shielded = false;
        en.coreExposed = true;
        en.chargeBlend = 0;
        en.coilBlend = 0;
        en.shockActive = false;
        en.bossTimer = 2.8 * exposeMult;
        en.coreExposeTimer = en.bossTimer;
        en.bossHitCooldown = 0.26;
        if (source === 'whip') this.hitStopTimer = Math.max(this.hitStopTimer || 0, 0.030);
        this.addShake(3.2);
        if (pos) this._spawnParticles(pos.x, pos.y, '#67e8f9', 10, 115, 160, en.col, en.floor + 0.5);
        this.addPopup({ col: en.col, floor: en.floor + 0.95, text: '◈ SHIELD CRACKED • STRIKE CORE!', color: '#67e8f9', maxLife: 1.05 });
        sound?.stunEnemy?.();
        return;
      }

      const dmg = en.coreExposed && source === 'whip' && breakerRank >= 3 ? 2 : 1;
      en.hp = Math.max(0, (en.hp || 1) - dmg);
      en.stunTimer = 0.48;
      en.bossHitCooldown = 0.45;
      if (source === 'whip' || source === 'deflect') this.hitStopTimer = Math.max(this.hitStopTimer || 0, 0.035);
      this.addShake(5.5);
      if (pos) this._spawnParticles(pos.x, pos.y, '#f472b6', 14, 130, 170, en.col, en.floor + 0.5);
      if (en.hp <= 0) {
        en.dead = true;
        en.coreExposed = false;
        en.coreExposeTimer = 0;
        en.velCol = 0;
        en.velFloor = 0;
        en.deathTimer = 0.45;
        this.bossHazards = [];
        this.towerEnemiesDestroyed += 1;
        this._awardGears(8);
        this._scoreActionHit(1500 + breakerRank * 150, { col: en.col, floor: en.floor + 0.9 }, '#fde047');
        this._triggerStormSiphonShockwave(en.col, en.floor);
        this.cb.onBanner?.(
          `${en.bossTitle || 'SIPHON WARDEN'} SHATTERED!`,
          this.runType === 'warden_gauntlet'
            ? '+8 GEARS • ADVANCING TO NEXT ACT'
            : en.isLockKeeper
            ? 'UPPER SLUICE UNLOCKED • PULL LEVER FOR SEAL 3/3!'
            : '+8 HYDRO-GEARS • CROWN CLEAR'
        );
        this._emitProgEvent('warden_defeat', { towerId: this.tower?.id || 1 });
        sound?.hitEnemy?.();
        const anyWardenAlive = this.enemies.some((other) => !other.dead && other.type === 'siphon_warden');
        if (!anyWardenAlive) {
          sound?.setBossActive?.(false);
          if (this.runType === 'warden_gauntlet') {
            this.gauntletBossesDefeated = (this.gauntletBossesDefeated || 0) + 1;
            this._triggerSpirePurification();
          }
        }
      } else {
        const prevTier = en.bossPhaseTier || 1;
        const nextRatio = en.hp / Math.max(1, en.maxHp || 3);
        const nextTier = nextRatio <= 0.35 ? 3 : nextRatio <= 0.68 ? 2 : 1;
        en.bossPhaseTier = nextTier;
        // Re-engage shield cleanly between HP stages so every phase plays its signature telegraph & attack!
        en.bossPhase = 'patrol';
        en.aiState = 'patrol';
        en.shielded = true;
        en.coreExposed = false;
        en.coreExposeTimer = 0;
        en.chargeBlend = 0;
        en.coilBlend = 0;
        en.shockActive = false;
        en.bossTimer = nextTier === 3 ? 1.55 : 2.1;
        en.dir = -(en.dir || 1);

        this._awardGears(1);
        this._scoreActionHit(300 + breakerRank * 150, { col: en.col, floor: en.floor + 0.8 }, '#fb7185');
        this.addPopup({
          col: en.col,
          floor: en.floor + 1.25,
          text: source === 'deflect' ? `◎ DEFLECT COUNTER! (${en.hp}/${en.maxHp})` : `WARDEN ${en.hp}/${en.maxHp}`,
          color: '#fde047',
          maxLife: 1.1,
        });
        if (nextTier > prevTier) {
          const bTitle = (en.bossTitle || 'SIPHON WARDEN').toUpperCase();
          if (nextTier === 3) {
            this.lightningFlash = Math.max(this.lightningFlash, 0.72);
            this.cb.onBanner?.(`${bTitle} — FINAL OVERDRIVE!`, 'DUAL BEAM & SLAM • CRACK SHIELD TO FINISH!');
          } else {
            this.cb.onBanner?.(`${bTitle} — PHASE 2!`, 'SIPHON SHIELD RECHARGED • WATCH FOR TENTACLE SLAM!');
          }
        }
        sound?.hitEnemy?.();
      }
      return;
    }

    if (en.type === 'barnacle_mortar') {
      // Paranoid Siege Hermit: clamped 5-petal armor (`shell_hide`) deflects frontal Hydro-Pulses, while Tail-Whip cracks it open!
      if (source === 'pulse' && en.aiState === 'shell_hide' && (en.shellHide || 0) > 0.5) {
        sound?.deflect?.();
        this.addShake(1.6);
        if (pos) this._spawnParticles(pos.x, pos.y, '#fde047', 6, 85, 190, en.col, en.floor + 0.35);
        this.addPopup({
          col: en.col,
          floor: en.floor + 0.95,
          text: '◈ CLAMPED ARMOR • TAIL-WHIP!',
          color: '#fde047',
          maxLife: 0.95,
        });
        return;
      }
      if (source === 'whip' || source === 'deflect' || en.openAmount > 0.25) {
        en.dead = true;
        en.shellHide = 0;
        en.velCol = 0;
        en.velFloor = 0;
        en.deathTimer = 0.3;
        if (source === 'whip' || source === 'deflect') this.hitStopTimer = Math.max(this.hitStopTimer || 0, 0.035);
        this.towerEnemiesDestroyed += 1;
        this._scoreActionHit(150, { col: en.col, floor: en.floor + 0.6 }, '#fb923c');
        this._triggerStormSiphonShockwave(en.col, en.floor);
        this.addShake(4.2);
        if (pos) this._spawnParticles(pos.x, pos.y, '#fb923c', 12, 115, 180, en.col, en.floor + 0.4);
        sound?.hitEnemy?.();
      } else {
        en.stunTimer = 2.6;
        en.aiState = 'stunned';
        sound?.stunEnemy?.();
      }
      return;
    }

    if (en.type === 'gulp_hopper') {
      if (source === 'whip' || en.stunTimer > 0) {
        en.dead = true;
        en.velCol = 0;
        en.velFloor = 0;
        en.inflatePhase = 0;
        en.deathTimer = 0.28;
        if (source === 'whip') this.hitStopTimer = Math.max(this.hitStopTimer || 0, 0.030);
        this.towerEnemiesDestroyed += 1;
        this._scoreActionHit(100, { col: en.col, floor: en.floor + 0.5 }, '#38bdf8');
        this._triggerStormSiphonShockwave(en.col, en.floor);
        sound?.hitEnemy?.();
      } else {
        en.stunTimer = 3.4;
        en.aiState = 'stunned';
        en.velCol = 0;
        en.velFloor = 0;
        en.inflatePhase = 0;
        en.floor = en.baseFloor;
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

    if (en.type === 'volt_eel') {
      // Bio-Electric Conduit Hunter: meleeing while `shockActive` bounces off the discharge aura; punish during `exhausted`!
      if (en.shockActive && source === 'whip') {
        const p = this.gateway;
        const bounceDir = Math.sign(colDist(en.col, p.col)) || -p.facing;
        p.vx = bounceDir * 3.1;
        p.knockbackTimer = 0.14;
        sound?.deflect?.();
        this.addPopup({
          col: en.col,
          floor: en.floor + 0.95,
          text: '⚡ SHOCK COIL • WAIT FOR UNCOIL!',
          color: '#67e8f9',
          maxLife: 1.05,
        });
        if (!p.shield && (p.invuln || 0) <= 0) {
          this._applyHazardHit(en.col);
        }
        return;
      }
      const wasExhausted = en.aiState === 'exhausted';
      en.shockActive = false;
      en.coilBlend = 0;
      en.telegraph = 0;
      en.velCol = 0;
      en.velFloor = 0;
      if (wasExhausted && source === 'whip') {
        en.dead = true;
        en.deathTimer = 0.30;
        this.hitStopTimer = Math.max(this.hitStopTimer || 0, 0.035);
        this.towerEnemiesDestroyed += 1;
        this._scoreActionHit(140, { col: en.col, floor: en.floor + 0.5 }, '#67e8f9');
        this._triggerStormSiphonShockwave(en.col, en.floor);
        sound?.hitEnemy?.();
      } else {
        en.stunTimer = wasExhausted ? 4.2 : 3.0;
        en.aiState = 'stunned';
        this.towerEnemiesStunned += 1;
        this._scoreActionHit(wasExhausted ? 115 : 85, { col: en.col, floor: en.floor + 0.5 }, '#fbbf24');
        sound?.stunEnemy?.();
      }
      this.addShake(2.8);
      if (pos) this._spawnParticles(pos.x, pos.y, '#67e8f9', 10, 95, 165, en.col, en.floor + 0.35);
      this._tryUnlockTrophy('sentinel_short');
      this._emitProgEvent('snowball_hit', { kind: 'volt_eel', runType: this.runType, combo: this.comboCount });
      return;
    }

    // rail_skater, vent_stalker
    const bonusWindow =
      (en.type === 'rail_skater' && (en.aiState === 'spark_brake' || en.aiState === 'windup')) ||
      (en.type === 'vent_stalker' && en.aiState === 'cooldown');
    en.stunTimer = bonusWindow ? 3.8 : 3.0;
    en.aiState = 'stunned';
    en.velCol = 0;
    en.velFloor = 0;
    en.brakeBlend = 0;
    en.venting = false;
    en.telegraph = 0;
    if (source === 'whip') this.hitStopTimer = Math.max(this.hitStopTimer || 0, 0.025);
    this.towerEnemiesStunned += 1;
    this._scoreActionHit(bonusWindow ? 110 : 85, { col: en.col, floor: en.floor + 0.5 }, '#fbbf24');
    this.addShake(2.6);
    if (pos) this._spawnParticles(pos.x, pos.y, '#fbbf24', 9, 95, 165, en.col, en.floor + 0.35);
    sound?.stunEnemy?.();
    this._tryUnlockTrophy('sentinel_short');
    this._emitProgEvent('snowball_hit', { kind: en.type, runType: this.runType, combo: this.comboCount });
  }

  _triggerStormSiphonShockwave(originCol, originFloor) {
    if (!this.hasMutation('storm_siphon')) return;
    let affected = 0;
    for (const other of this.enemies) {
      if (other.dead) continue;
      if (Math.abs(other.floor - originFloor) <= 1.4 && Math.abs(colDist(other.col, originCol)) <= 2.5) {
        if (other.type === 'snap_crab' && !other.flipped) {
          other.flipped = true;
          other.flipTimer = 5.6;
          other.stunTimer = 5.6;
          affected += 1;
        } else if (other.type !== 'siphon_warden' && other.stunTimer <= 0) {
          other.stunTimer = 3.0;
          affected += 1;
        }
      }
    }
    if (affected > 0) {
      this.addPopup({
        col: originCol,
        floor: originFloor + 1.15,
        text: `⚡ TEMPEST NOVA x${affected}!`,
        color: '#c084fc',
        maxLife: 0.95,
      });
    }
  }

  // ===========================================================================
  // CORE CYLINDRICAL SPIRE GAMEPLAY & CONTINUOUS WALKABLE STAIRCASES
  // ===========================================================================

  _updateTower(dt) {
    const p = this.gateway;
    const inp = this.input.state;
    p.isGliding = false;
    p.frillFlare = 0;

    // Crisp 35ms Physical Impact Hit-Stop (clamps world entity step without stalling UI/audio/particles or dropping input!)
    if ((this.hitStopTimer || 0) > 0) {
      if (this.input.consumeJustPressed('jump') && !p.wallScamper) {
        p.jumpBufferTimer = JUMP_BUFFER_WINDOW;
      }
      if (this.input.consumeJustPressed('whip')) {
        p.whipBuffer = 0.16;
      }
      if (this.input.consumeJustPressed('fire')) {
        p.fireBuffer = 0.18;
      }
      this.hitStopTimer = Math.max(0, this.hitStopTimer - dt);
      return;
    }

    const preInteract = this._evaluateInteractContext();
    this.input?.setInteractContext?.(preInteract.canInteract, preInteract.kind);

    if (this.runType === 'daily_tide' && this.dailyMeta) {
      this.dailyMeta.elapsedSec += dt;
    }
    if (this.runType === 'warden_gauntlet') {
      this.gauntletElapsedSec = (this.gauntletElapsedSec || 0) + dt;
    }
    if ((this._aquaStepCooldown || 0) > 0) {
      this._aquaStepCooldown = Math.max(0, this._aquaStepCooldown - dt);
    }

    // Bubble Aegis mutation / Tidal Aegis Bio-Skill auto-regeneration
    const aegisSkillRank = this.getSkillRank('tidal_aegis');
    const hasAutoAegis = this.hasMutation('bubble_aegis') || aegisSkillRank > 0;
    if (hasAutoAegis && !p.shield) {
      const skillPeriod = aegisSkillRank === 3 ? 18.0 : aegisSkillRank === 2 ? 24.0 : 32.0;
      const aegisPeriod = this.hasMutation('bubble_aegis') ? Math.min(18.0, skillPeriod) : skillPeriod;
      this._aegisRechargeTimer += dt;
      if (this._aegisRechargeTimer >= aegisPeriod) {
        this._aegisRechargeTimer = 0;
        p.shield = true;
        this.addPopup({
          col: p.col,
          floor: p.floor + 1.3,
          text: '◈ TIDAL AEGIS RESTORED!',
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
    if (p.riptideDashTimer > 0) p.riptideDashTimer = Math.max(0, p.riptideDashTimer - dt);
    if (p.muzzleFlash > 0) p.muzzleFlash = Math.max(0, p.muzzleFlash - dt);
    if (p.stepUpCooldown > 0) p.stepUpCooldown = Math.max(0, p.stepUpCooldown - dt);
    if (p.hurtTimer > 0) p.hurtTimer = Math.max(0, p.hurtTimer - dt);
    if (p.landImpact > 0) p.landImpact = Math.max(0, p.landImpact - dt * 9.5);
    if (p.landSquash > 0) p.landSquash = Math.max(0, p.landSquash - dt * 6.5);
    if (p.skidTimer > 0) p.skidTimer = Math.max(0, p.skidTimer - dt);
    if (p._skidSfxCooldown > 0) p._skidSfxCooldown = Math.max(0, p._skidSfxCooldown - dt);
    if (p.stairStepBob > 0) p.stairStepBob = Math.max(0, p.stairStepBob - dt * 11.0);

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

    // Crumbling stones (with physical damped spring sag `crumbleDepress` + falling stone chips before drop!)
    for (const l of this.ledges) {
      if (l.crumbling && !l.gone) {
        l.crumbleTimer -= dt;
        const crumbleProg = 1 - Math.max(0, l.crumbleTimer) / 0.52;
        const targetDepress = Math.min(1, 0.42 + crumbleProg * 0.58);
        const depAcc = (targetDepress - (l.crumbleDepress || 0)) * 145.0 - (l.crumbleDepressVel || 0) * 14.0;
        l.crumbleDepressVel = (l.crumbleDepressVel || 0) + depAcc * dt;
        l.crumbleDepress = Math.max(0, Math.min(1, (l.crumbleDepress || 0) + l.crumbleDepressVel * dt));

        l._chipTimer = (l._chipTimer || 0) - dt;
        if (l._chipTimer <= 0) {
          l._chipTimer = 0.085;
          const chipPos = this._colFloorToScreen(l.col + 0.5, l.floor - 0.06, 10);
          const cx = chipPos ? chipPos.x : (this.renderer?.width || 390) * 0.5;
          const cy = chipPos ? chipPos.y : (this.renderer?.height || 680) * 0.55;
          for (let ci = 0; ci < 2; ci++) {
            const life = 0.34 + Math.random() * 0.24;
            this.particles.push({
              x: cx + (Math.random() - 0.5) * 14,
              y: cy + 2,
              col: wrapCol(l.col + 0.2 + Math.random() * 0.6),
              floor: l.floor - 0.06,
              vx: (Math.random() - 0.5) * 28,
              vy: 18 + Math.random() * 35,
              gravity: 310,
              size: 2.5 + Math.random() * 2.5,
              color: ci % 2 === 0 ? '#d6c2a8' : '#a8a29e',
              isStoneChip: true,
              life,
              maxLife: life,
            });
          }
        }

        if (l.crumbleTimer <= 0) {
          l.gone = true;
          l.crumbling = false;
          l.shake = false;
          l.crumbleDepress = 1;
          l.crumbleDepressVel = 0;
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
          l.crumbleDepress = 0;
          l.crumbleDepressVel = 0;
        }
      } else if ((l.crumbleDepress || 0) > 0) {
        l.crumbleDepress = approach(l.crumbleDepress, 0, dt * 4.5);
        l.crumbleDepressVel = 0;
      }
    }

    this._syncDynamicLedges(dt, false);

    // Mechanical Twin-Rail Elevators (respecting Pipe-Valve `el.powered` + counterweight spring `cabBounceOffset`)
    for (const el of this.elevators) {
      if (Math.abs(el.cabBounceOffset || 0) > 1e-4 || Math.abs(el.cabBounceVel || 0) > 1e-4) {
        const bAcc = -(el.cabBounceOffset || 0) * 185.0 - (el.cabBounceVel || 0) * 14.5;
        el.cabBounceVel = (el.cabBounceVel || 0) + bAcc * dt;
        el.cabBounceOffset = Math.max(-0.06, Math.min(0.02, (el.cabBounceOffset || 0) + el.cabBounceVel * dt));
        if (Math.abs(el.cabBounceOffset) < 2e-4 && Math.abs(el.cabBounceVel) < 2e-3) {
          el.cabBounceOffset = 0;
          el.cabBounceVel = 0;
        }
      }
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
    const scalesRank = this.getSkillRank('streamlined_scales');
    const geckoRank = this.getSkillRank('gecko_grip');
    const springRank = this.getSkillRank('geyser_spring');
    const updraftRank = this.getSkillRank('thermal_updraft');
    const graceRank = this.getSkillRank('harmonic_grace');
    const walkSpeed = BASE_WALK_SPEED * (hasGeckoMut ? 1.22 : 1.0) * (1 + scalesRank * 0.06);
    const jumpVy = BASE_JUMP_VY * (1 + springRank * 0.05);

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
      const climbRate = (hasGeckoMut ? 5.25 : 4.15) * (1 + geckoRank * 0.12);
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
        p.vy = jumpVy;
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
    const isIce = Boolean(underLedge && underLedge.type === 'ice' && !hasGeckoMut && geckoRank < 2);
    const convPush = underLedge
      ? underLedge.type === 'conveyorR'
        ? 1.15
        : underLedge.type === 'conveyorL'
        ? -1.15
        : 0
      : 0;

    let windPush = this.windCurrent * (this.masterWatershed || this.runType === 'master_watershed' ? 1.25 : 1.0);
    if (windPush !== 0) {
      const sheltered =
        Boolean(p.onElevator) ||
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

    let pushedBoxThisStep = null;
    if (!p.wallScamper) {
      const wasOnStairs = Boolean(p.onStairs);
      const effectiveMoveIntent = descendingIslandBrake ? 0 : moveIntent;
      let effSpeed = p.isSwimming ? walkSpeed * 0.88 : walkSpeed;
      // Real staircase slope physics: uphill resistance (0.86x), downhill gravity-assisted stride (1.12x)!
      if (wasOnStairs && p.onGround && !p.onElevator && !p.isSwimming && p.stairDir !== 0) {
        if (effectiveMoveIntent * p.stairDir > 0.05) effSpeed *= 0.86;
        else if (effectiveMoveIntent * p.stairDir < -0.05) effSpeed *= 1.12;
      }
      const targetVx = effectiveMoveIntent * effSpeed;

      if ((p.knockbackTimer || 0) <= 0 && (p.grappleTimer || 0) <= 0) {
        const desiredVx = targetVx + convPush + windPush;
        const isCounterSteer = effectiveMoveIntent * p.vx < -0.15;
        let rate;
        if (!p.onGround) {
          // True air-momentum conservation: running takeoff impulse (1.18x) bleeds only aerodynamic AIR_DRAG when steering with momentum!
          if (descendingIslandBrake) {
            rate = 18.0;
          } else if (Math.abs(effectiveMoveIntent) > 0.05) {
            if (p.vx * desiredVx > 0 && Math.abs(p.vx) > Math.abs(desiredVx)) {
              rate = AIR_DRAG;
            } else {
              rate = AIR_ACCEL;
            }
          } else {
            rate = AIR_DRAG;
          }
        } else if (p.isSwimming) {
          rate = Math.abs(effectiveMoveIntent) > 0.05 ? 14.0 : 10.5;
        } else if (isIce) {
          rate = Math.abs(effectiveMoveIntent) > 0.05 ? ICE_ACCEL : ICE_FRICTION;
        } else if (Math.abs(effectiveMoveIntent) > 0.05) {
          if (isCounterSteer && Math.abs(p.vx) > 1.45) {
            rate = GROUND_SKID_DECEL;
            p.skidTimer = 0.19;
            if ((p._skidSfxCooldown || 0) <= 0) {
              p._skidSfxCooldown = 0.18;
              sound?.step?.();
              const sp = this._colFloorToScreen(p.col, p.floor + 0.08, 10);
              if (sp) this._spawnParticles(sp.x, sp.y, '#d6c2a8', 4, 65, 190, p.col, p.floor + 0.08);
            }
          } else {
            rate = GROUND_ACCEL;
          }
        } else {
          // Natural planted claw-stop friction (~0.22 col stop inside 1 stone without robot snap!)
          rate = GROUND_FRICTION;
        }
        p.vx = approach(p.vx, desiredVx, rate * dt);

        if (!p.onGround && (p.riptideDashTimer || 0) <= 0) {
          const maxAirVx = walkSpeed * JUMP_HORIZ_IMPULSE + Math.abs(convPush + windPush);
          p.vx = Math.max(-maxAirVx, Math.min(maxAirVx, p.vx));
        }
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
        } else if (blockingBarrier.type === 'box' && p.onGround && !p.onElevator && !p.isSwimming) {
          const pushDir = Math.sign(colDist(p.col, blockingBarrier.col + 0.5)) || p.facing;
          if (Math.abs(moveIntent) > 0.12 && Math.sign(moveIntent) === pushDir) {
            pushedBoxThisStep = blockingBarrier;
            p.pushingBox = approach(p.pushingBox || 0, 1, dt * 9.5);
            if (this._canSlideSiphonBox(blockingBarrier, pushDir)) {
              blockingBarrier.pushTimer = (blockingBarrier.pushTimer || 0) + dt;
              blockingBarrier.visualSlideCol = pushDir * Math.min(1.0, blockingBarrier.pushTimer / 0.38);
              if (blockingBarrier.pushTimer >= 0.38) {
                blockingBarrier.col = wrapCol(blockingBarrier.col + pushDir);
                blockingBarrier.visualSlideCol = 0;
                blockingBarrier.pushTimer = 0;
                this.addShake(1.6);
                sound?.stepUp?.();
              }
            } else {
              blockingBarrier.visualSlideCol = approach(
                blockingBarrier.visualSlideCol || 0,
                pushDir * 0.28,
                dt * 2.2
              );
            }
            blockingBarrier._boxDustTimer = (blockingBarrier._boxDustTimer || 0) - dt;
            if (blockingBarrier._boxDustTimer <= 0) {
              blockingBarrier._boxDustTimer = 0.09;
              const sp = this._colFloorToScreen(blockingBarrier.col + 0.5, blockingBarrier.floor + 0.06, 10);
              if (sp) {
                this._spawnParticles(sp.x, sp.y, '#d6c2a8', 2, 42, 180, blockingBarrier.col + 0.5, blockingBarrier.floor + 0.06);
              }
            }
          }
        }
      }

      // -----------------------------------------------------------------------
      // REAL 5-RISER STEP-BY-STEP STAIRCASE PHYSICS (UPHILL WEIGHT + OPEN-SIDE FREEFALL!)
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
            p.stairPhase = (p.stairPhase + Math.abs(p.vx) * dt * 2.4) % 1;
          }
          // Discrete 5-tread physical riser cadence micro-impulses!
          if (stairSample.onRamp && stairSample.treadIndex !== p.stairStepIndex && Math.abs(p.vx) > 0.35) {
            p.stairStepIndex = stairSample.treadIndex;
            p.stairStepBob = 1.0;
            p.squashY = Math.min(p.squashY, 0.95);
            p.squashX = Math.max(p.squashX, 1.05);
          }
          this._registerLedgeStand(stairSample.supportLedge);
        } else if (wasOnStairs) {
          p.stairStepIndex = -1;
          // Stepping off the open side of a staircase immediately hands p.vx into GRAV_FALL = 74.0 freefall!
          if (!this._findLedgeAt(p.col, p.floor)) {
            p.onGround = false;
            p.vy = Math.min(p.vy, -0.4);
          }
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

    if (!pushedBoxThisStep) {
      p.pushingBox = approach(p.pushingBox || 0, 0, dt * 8.5);
    }
    for (const l of this.ledges) {
      if (l.type === 'box' && !l.gone && l !== pushedBoxThisStep) {
        if ((l.pushTimer || 0) > 0) l.pushTimer = Math.max(0, l.pushTimer - dt * 2.8);
        if (Math.abs(l.visualSlideCol || 0) > 1e-4) {
          l.visualSlideCol = approach(l.visualSlideCol, 0, dt * 3.4);
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

    const magnetSkillRank = this.getSkillRank('pelagic_magnet');
    const magnetRangeCol = this.hasMutation('tidal_magnet')
      ? Math.max(2.6, 1.2 + magnetSkillRank * 0.8)
      : magnetSkillRank > 0
      ? 0.4 + magnetSkillRank * 0.8
      : 0;
    for (const c of this.collectibles) {
      if (c.collected) continue;
      const dCol = colDist(c.col + 0.5, p.col);
      const dFlr = p.floor - c.floor;
      if (magnetRangeCol > 0 && Math.abs(dCol) < magnetRangeCol && Math.abs(dFlr) < 1.8) {
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
          // HARD 3-SEAL FORTRESS LOCK: ZERO UNLOCKED EXIT DOORS!
          if (this._isCrownLocked()) {
            this._denyLockedCrown(door);
            return;
          }
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

    // Coyote time & Jump buffering (185ms coyote / 150ms buffer; boosted by Pelagian Grace & Harmonic Grace)
    const effCoyote =
      COYOTE_WINDOW * (this.hasMutation('pelagian_grace') ? 1.35 : 1.0) * (1 + graceRank * 0.15);
    if (p.onGround || p.isSwimming) {
      p.coyoteTimer = effCoyote;
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
        p.vx = swingDir * (walkSpeed * 1.26 * (1 + updraftRank * 0.08));
        p.vy = jumpVy * (1 + updraftRank * 0.06);
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
        if (!p.isSwimming) {
          if (Math.abs(moveIntent) > 0.55 && Math.abs(p.vx) > 1.8 && moveIntent * p.vx > 0) {
            // Athletic lizard hind-leg running takeoff boost (JUMP_HORIZ_IMPULSE = 1.18 -> 3.89 cols/s)
            p.vx = Math.sign(moveIntent) * Math.max(Math.abs(p.vx), walkSpeed * JUMP_HORIZ_IMPULSE);
          } else if (Math.abs(moveIntent) > 0.55 && moveIntent * p.vx >= 0) {
            // Responsive standing/walk directional takeoff for one-thumb diagonal flicks
            p.vx = Math.sign(moveIntent) * Math.max(Math.abs(p.vx), walkSpeed * 0.86 * Math.abs(moveIntent));
          }
        }
        p.vy = p.isSwimming ? jumpVy * 1.04 : jumpVy;
        p.isSwimming = false;
        p.isGliding = false;
        p.frillFlare = 0;
        p.waterDipOffset = 0;
        p.waterDipVel = 0;
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
        p.vy = jumpVy;
        p.isGliding = false;
        p.frillFlare = 0;
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
      const twinStream = this.hasMutation('twin_pulse');
      const lanceRank = this.getSkillRank('charged_hydro_lance');
      const baseSpd = (fastPulse ? 11.6 : 8.7) * (1 + lanceRank * 0.15);
      const basePierce = (fastPulse ? 2 : 1) + (lanceRank >= 3 ? 2 : lanceRank >= 2 ? 1 : 0);
      const fxId = p.blasterFxId || this.blasterFxId || 'tidal_pearl';
      if (twinStream) {
        this.hydroPulses.push(
          { col: wrapCol(p.col + p.facing * 0.42), floor: p.floor + 0.24, dir: p.facing, speed: baseSpd, pierce: basePierce, rise: 0, life: 1.15, fxId },
          { col: wrapCol(p.col + p.facing * 0.42), floor: p.floor + 0.68, dir: p.facing, speed: baseSpd, pierce: basePierce, rise: 0, life: 1.15, fxId }
        );
      } else {
        this.hydroPulses.push({
          col: wrapCol(p.col + p.facing * 0.42),
          floor: p.floor + 0.38,
          dir: p.facing,
          speed: baseSpd,
          pierce: basePierce,
          rise: 0,
          life: 1.15,
          fxId,
        });
      }
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
        // Hands-free cab centering so wind/drift never pulls Gateway off a moving elevator (#411 Fix #6)
        if (Math.abs(moveIntent) <= 0.08) {
          const dCab = colDist(p.col, el.col + 0.5);
          p.col = wrapCol(p.col + dCab * Math.min(1, dt * 10));
          p.vx = 0;
        }
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
      const lowGravApex = Boolean(this.tower?.mechanics?.lowGravApex);

      let grav = GRAV_RISE;
      p.frillFlare = 0;
      p.isGliding = false;
      if (p.vy > 1.4 && !inp.jump && p.jumpCutEligible) {
        grav = GRAV_JUMP_CUT;
      } else if (Math.abs(p.vy) <= 1.4) {
        grav = lowGravApex ? GRAV_APEX * 0.78 : GRAV_APEX;
      } else if (p.vy < -1.4) {
        grav = GRAV_FALL;
      }

      const maxFall = this.hasMutation('frill_updraft') && inp.jump && p.vy < 0 ? -3.15 : -MAX_FALL_SPEED;

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
              if (prevVy < -2.0) {
                const elImp = Math.min(1, Math.abs(prevVy) / 14.0);
                el.cabBounceOffset = Math.max(-0.06, (el.cabBounceOffset || 0) - 0.032 * elImp);
                el.cabBounceVel = (el.cabBounceVel || 0) - (0.52 + 0.62 * elImp);
              }
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
        const geyserSkillMult = 1 + updraftRank * 0.10 + springRank * 0.04;
        p.vy = (this.hasMutation('carapace_vault') ? 20.4 : SPRING_LAUNCH_VY) * geyserSkillMult;
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

    // Waterline Check: Purified Floodgate Archimedes Buoyant Swim vs Corrupted Siphon Surge!
    if (p.floor <= this.waterFloor + (p.isSwimming ? 0.18 : 0.02)) {
      if (this.waterPurified) {
        if (p.vy <= 0.1) {
          if (!p.isSwimming) {
            p.isSwimming = true;
            if (prevVy < -1.5) {
              const submergeImp = Math.min(1.0, Math.abs(prevVy) / 14.0);
              p.waterDipOffset = Math.max(-0.42, -0.14 - submergeImp * 0.26);
              p.waterDipVel = -Math.min(3.6, Math.abs(prevVy) * 0.24);
              const spPos = this._colFloorToScreen(p.col, this.waterFloor + 0.05, 12);
              const sx = spPos ? spPos.x : (this.renderer?.width || 390) * 0.5;
              const sy = spPos ? spPos.y : (this.renderer?.height || 680) * 0.72;
              const dropCount = Math.min(32, Math.max(8, Math.round(Math.abs(prevVy) * 2.2)));
              this._spawnSplashDroplets(sx, sy, p.col, this.waterFloor, dropCount, 0.75 + submergeImp * 0.65);
            } else {
              p.waterDipOffset = -0.03;
              p.waterDipVel = 0;
            }
            sound?.splash?.();
            this._emitProgEvent('floodgate_swim', { towerId: this.tower?.id || 1 });
          }
          p.swimPhase = (p.swimPhase || 0) + dt * 6.5;
          const targetBob = Math.sin(p.swimPhase * 0.85) * 0.024;
          const buoyAcc = (targetBob - (p.waterDipOffset || 0)) * 52.0 - (p.waterDipVel || 0) * 6.2;
          p.waterDipVel = (p.waterDipVel || 0) + buoyAcc * dt;
          p.waterDipOffset = Math.max(-0.48, Math.min(0.14, (p.waterDipOffset || 0) + p.waterDipVel * dt));
          p.floor = this.waterFloor + p.waterDipOffset;
          p.vy = 0;
          p.onGround = true;
        }
      } else if (p.floor < this.waterFloor) {
        // Bio-Mutation: Water-Strider Skim (`aqua_step`) emergency hydro-leap off surge water!
        if (this.hasMutation('aqua_step') && (this._aquaStepCooldown || 0) <= 0) {
          this._aquaStepCooldown = 10.0;
          p.floor = this.waterFloor + 0.12;
          p.vy = 16.2;
          p.onGround = false;
          p.invuln = Math.max(p.invuln || 0, 0.9);
          sound?.splash?.();
          sound?.jump?.();
          this.addPopup({
            col: p.col,
            floor: p.floor + 1.1,
            text: '≈ WATER-STRIDER SKIM!',
            color: '#5efce8',
            maxLife: 1.1,
          });
        } else {
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
      }
    } else {
      if (p.isSwimming && p.floor > this.waterFloor + 0.22) {
        p.isSwimming = false;
      }
      if (!p.isSwimming && Math.abs(p.waterDipOffset || 0) > 1e-4) {
        p.waterDipOffset = approach(p.waterDipOffset, 0, dt * 5.0);
        p.waterDipVel = 0;
      }
    }

    // Update Skeletal Animation State Hint for `GatewayRig` (`src/gateway.js` — ZERO `FrillGlide` on tower jumps!)
    p.isGliding = false;
    p.frillFlare = 0;
    if (p.tailWhipTimer > 0) p.anim = 'TailWhip';
    else if (p.muzzleFlash > 0.04) p.anim = 'HydroCast';
    else if (p.wallScamper) p.anim = 'WallScamper';
    else if (p.isSwimming) p.anim = 'FreeSwim';
    else if (!p.onGround) {
      p.anim = p.vy >= 0.6 ? 'AirRise' : 'Fall';
    } else if (p.onStairs && Math.abs(p.vx) > 0.15) {
      p.anim = 'StairClimb';
    } else if (Math.abs(p.vx) > 1.55) {
      p.anim = 'FluidRun';
    } else if (Math.abs(p.vx) > 0.10) {
      p.anim = 'Walk';
    } else {
      p.anim = 'IdleBreathe';
    }

    this._updateHydroPulses(dt);
    this._updateEnemyProjectiles(dt);
    this._updateEnemies(dt);
    this._updateBossHazards(dt);
    this._updateCritterSonar(dt);

    p.landingFloor = this._computeLandingFloor(p.col, p.floor);
    this._updateCamera(dt);
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
    } else if (c.type === 'critter_pod') {
      const critterRes = this.prog?.rescueCritter?.(c.critterId || c.id || null);
      this._handleProgTrophyReturn(critterRes);
      this.addScore(500);
      if (typeof sound?.critterRescue === 'function') sound.critterRescue();
      else sound?.collectStar?.();
      const pos = this._colFloorToScreen(c.col + 0.5, c.floor + 0.5, 14);
      if (pos) this._spawnParticles(pos.x, pos.y, '#5efce8', 16, 125, 140, c.col + 0.5, c.floor + 0.5);
      const spName = String(critterRes?.critter?.species || c.species || 'WATER CRITTER').toUpperCase();
      const cnt = critterRes?.totalRescued ?? this.prog?.getCritterCount?.() ?? 1;
      const tot = critterRes?.totalCatalog ?? CRITTER_CATALOG.length;
      this.addPopup({
        col: c.col + 0.5,
        floor: c.floor + 1.35,
        text: `✦ ${spName} RESCUED! (${cnt}/${tot})`,
        color: '#5efce8',
        maxLife: 1.55,
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

    if (!wasOnGround && prevVy < -1.8) {
      const impact = Math.min(1, Math.abs(prevVy) / 16.0);
      p.landSquash = Math.max(p.landSquash || 0, impact);
      p.landImpact = Math.max(p.landImpact || 0, impact);
      p.squashX = 1 + 0.18 * impact;
      p.squashY = 1 - 0.16 * impact;
      if (impact > 0.35) {
        this.addShake(1.2 + impact * 2.1);
      }
      if (Math.abs(prevVy) > 2.4) {
        sound?.land?.(impact);
        const sp = this._colFloorToScreen(p.col, p.floor + 0.05, 10);
        if (sp) {
          this._spawnParticles(sp.x, sp.y, '#d6c2a8', Math.round(4 + impact * 6), 72, 210, p.col, p.floor + 0.05);
        }
      }
    }
    if (landed) {
      if (landed.type === 'crumble' && !wasOnGround) {
        const sagImp = Math.min(0.45, Math.abs(prevVy) / 22.0);
        landed.crumbleDepress = Math.min(1, Math.max(landed.crumbleDepress || 0, 0.36 + sagImp));
        landed.crumbleDepressVel = Math.max(landed.crumbleDepressVel || 0, Math.min(10.0, Math.abs(prevVy) * 0.75 + 3.0));
      }
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
      ledge.crumbleDepress = Math.max(ledge.crumbleDepress || 0, 0.38);
      ledge._chipTimer = 0;
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

      // 2. Hit Siphon Crate ('box') -> shatter with physical debris & 35ms hit-stop!
      const box = this.ledges.find(
        (l) =>
          !l.gone &&
          l.active &&
          l.type === 'box' &&
          (l.h ? sb.floor >= l.floor - 0.25 && sb.floor <= l.floor + l.h + 0.25 : Math.abs(l.floor - sb.floor) < 0.75) &&
          Math.abs(colDist(sb.col, l.col + 0.5)) < 0.55
      );
      if (box) {
        this._shatterSiphonBox(box, sb.dir, 60);
        this._emitProgEvent('snowball_hit', { kind: 'box', runType: this.runType, combo: this.comboCount });
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

      // 4. Hit Enemy (2.0x Visual Scale Match)
      for (const en of this.enemies) {
        if (en.dead) continue;
        const vReach = en.type === 'siphon_warden' ? 1.25 : 0.95;
        const hReach = en.type === 'siphon_warden' ? 1.05 : 0.82;
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

  _spawnParabolicMortar(en, shotDir, targetCol, targetFloor, grav = 10.5) {
    const col0 = wrapCol(en.col + shotDir * 0.45);
    const floor0 = en.floor + 0.55;
    const dFloor = Math.max(-2.5, Math.min(2.8, targetFloor - floor0));
    const vy0 = 3.8 + dFloor * 0.6;
    const disc = Math.max(0.09, vy0 * vy0 - 2 * grav * ((targetFloor + 0.30) - floor0));
    const tHit = (vy0 + Math.sqrt(disc)) / grav;
    const distCols = Math.max(1.2, Math.min(8.2, Math.abs(colDist(col0, targetCol))));
    const horizSpeed = Math.max(2.1, Math.min(6.4, distCols / Math.max(0.32, tHit)));
    this.enemyProjectiles.push({
      col: col0,
      floor: floor0,
      dir: shotDir,
      speed: horizSpeed,
      vy: vy0,
      grav,
      life: Math.max(1.8, tHit + 0.55),
      deflected: false,
    });
  }

  _updateEnemyProjectiles(dt) {
    const p = this.gateway;
    for (let i = this.enemyProjectiles.length - 1; i >= 0; i--) {
      const pr = this.enemyProjectiles[i];
      const prevPrFloor = pr.floor;
      if (pr.grav) {
        pr.vy = (pr.vy || 0) - pr.grav * dt;
      }
      pr.col = wrapCol(pr.col + pr.dir * pr.speed * dt);
      pr.floor += (pr.vy || 0) * dt;
      pr.life -= dt;
      if (pr.life <= 0) {
        this.enemyProjectiles.splice(i, 1);
        continue;
      }

      if (pr.deflected) {
        // Deflected pressurized water-bomb shatters enemies or Wardens (2.0x scale hitboxes)!
        for (const en of this.enemies) {
          if (en.dead) continue;
          if (Math.abs(en.floor - pr.floor) < 1.05 && Math.abs(colDist(en.col, pr.col)) < 0.96) {
            this._applyAttackToEnemy(en, 'deflect');
            this._emitProgEvent('mortar_deflect', { towerId: this.tower?.id || 1 });
            this.enemyProjectiles.splice(i, 1);
            break;
          }
        }
      } else {
        if (
          p.invuln <= 0 &&
          !p.hidden &&
          !p.onElevator &&
          Math.abs(pr.floor - (p.floor + 0.35)) < 0.62 &&
          Math.abs(colDist(pr.col, p.col)) < 0.54
        ) {
          this.enemyProjectiles.splice(i, 1);
          this._applyHazardHit(pr.col);
          continue;
        }
        // Splash parabolic mortar bombs cleanly when impacting solid terrace stone on descent!
        if ((pr.vy || 0) < -0.6) {
          const hitStone = this._findLedgeLanding(pr.col, prevPrFloor, pr.floor);
          if (hitStone) {
            const sp = this._colFloorToScreen(pr.col, hitStone.floor + 0.08, 12);
            if (sp) {
              this._spawnParticles(sp.x, sp.y, '#38bdf8', 7, 85, 220, pr.col, hitStone.floor + 0.08);
            }
            sound?.bubble?.();
            this.enemyProjectiles.splice(i, 1);
          }
        }
      }
    }
  }

  _moveEnemyAlongSpan(en, speedVal, dt, wallCenterClear = 1.25) {
    const prevCol = en.col;
    const floorRef = en.type === 'gulp_hopper' ? en.baseFloor : en.floor;
    if (en.spanStart != null && en.spanLen != null) {
      const minOff = en.spanMinOff ?? 0.62;
      const maxOff = en.spanMaxOff ?? Math.max(minOff, en.spanLen - 0.62);
      const nextOffset = en.spanOffset + en.dir * speedVal * dt;
      const nextCol = wrapCol(en.spanStart + nextOffset);
      const hitsDynamicObstacle =
        this.ledges.some(
          (l) =>
            !l.gone &&
            l.active &&
            (l.type === 'box' || l.type === 'pillar' || l.type === 'laserGate') &&
            (l.h ? l.floor < floorRef + 1.2 && l.floor + l.h > floorRef + 0.15 : Math.abs(l.floor - floorRef) < 0.65) &&
            Math.abs(colDist(nextCol, l.col + 0.5)) < wallCenterClear &&
            Math.abs(colDist(nextCol, l.col + 0.5)) < Math.abs(colDist(en.col, l.col + 0.5)) + 0.002
        ) ||
        this.elevators.some(
          (el) =>
            floorRef >= el.minFloor - 0.45 &&
            floorRef <= el.maxFloor + 0.45 &&
            Math.abs(colDist(nextCol, el.col + 0.5)) < wallCenterClear &&
            Math.abs(colDist(nextCol, el.col + 0.5)) < Math.abs(colDist(en.col, el.col + 0.5)) + 0.002
        );

      if (hitsDynamicObstacle) {
        return { hitBound: true, movedCols: 0 };
      }
      if (en.dir > 0 && nextOffset >= maxOff) {
        en.spanOffset = maxOff;
        en.col = wrapCol(en.spanStart + en.spanOffset);
        return { hitBound: true, movedCols: colDist(prevCol, en.col) };
      }
      if (en.dir < 0 && nextOffset <= minOff) {
        en.spanOffset = minOff;
        en.col = wrapCol(en.spanStart + en.spanOffset);
        return { hitBound: true, movedCols: colDist(prevCol, en.col) };
      }
      en.spanOffset = nextOffset;
      en.col = wrapCol(en.spanStart + en.spanOffset);
      return { hitBound: false, movedCols: colDist(prevCol, en.col) };
    }
    en.col = wrapCol(en.col + en.dir * speedVal * dt);
    return { hitBound: false, movedCols: colDist(prevCol, en.col) };
  }

  _updateEnemies(dt) {
    const p = this.gateway;

    for (let ei = this.enemies.length - 1; ei >= 0; ei--) {
      const en = this.enemies[ei];
      if (en.dead) {
        en.velCol = 0;
        en.velFloor = 0;
        if (en.deathTimer > 0) en.deathTimer = Math.max(0, en.deathTimer - dt);
        continue;
      }

      const ngScale = en.ngScale || 1.0;
      const prevCol = en.col;
      const prevFloor = en.floor;

      // Flipped Snap-Crab Dredger -> Harmless glowing Hydro-Bounce Springboard!
      if (en.flipped) {
        en.flipTimer = Math.max(0, (en.flipTimer || 0) - dt);
        en.stunTimer = en.flipTimer;
        en.aiState = 'flipped';
        en.velCol = 0;
        en.velFloor = 0;
        en.chargeBlend = 0;
        en.telegraph = 0;
        if (en.flipTimer <= 0) {
          en.flipped = false;
          en.stunTimer = 0;
          en.aiState = 'patrol';
        } else {
          const hitCrabSpring =
            p.vy <= 1.6 &&
            Math.abs(p.floor - en.floor) < 0.92 &&
            Math.abs(colDist(p.col, en.col)) < 0.92;
          if (hitCrabSpring) {
            p.vy = this.hasMutation('carapace_vault') ? 20.4 : SPRING_LAUNCH_VY;
            p.onGround = false;
            p.onElevator = null;
            p.wallScamper = false;
            p.isSwimming = false;
            p.isGliding = false;
            p.frillFlare = 0;
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
        en.aiState = 'stunned';
        en.velCol = 0;
        en.velFloor = 0;
        en.shockActive = false;
        en.venting = false;
        en.chargeBlend = 0;
        en.brakeBlend = 0;
        en.telegraph = 0;
        if (en.stunTimer <= 0) {
          en.aiState =
            en.type === 'gulp_hopper'
              ? 'sit_watch'
              : en.type === 'volt_eel'
              ? 'prowl'
              : en.type === 'rail_skater'
              ? 'sprint'
              : en.type === 'barnacle_mortar'
              ? 'watch'
              : en.type === 'vent_stalker'
              ? 'stalk'
              : 'patrol';
          en.aiTimer = en.type === 'volt_eel' ? 3.4 : 0.55;
        }
        continue;
      }

      // 1. `snap_crab` — Grumpy Territorial Brawler (`0.88` scuttle -> `0.45s` edge_look | `0.42s` aggro_tell -> `2.45` charge -> `0.70s` huff)
      if (en.type === 'snap_crab') {
        if ((en.aggroCooldown || 0) > 0) en.aggroCooldown = Math.max(0, en.aggroCooldown - dt);
        const distToHero = colDist(en.col, p.col);
        const canAggro =
          !en.harmless &&
          !p.hidden &&
          (en.aggroCooldown || 0) <= 0 &&
          Math.abs(en.floor - p.floor) < 0.65 &&
          Math.abs(distToHero) <= 2.8;

        if (en.aiState === 'edge_look') {
          en.aiTimer -= dt;
          en.telegraph = 0.15;
          en.chargeBlend = approach(en.chargeBlend || 0, 0, dt * 6);
          if (canAggro) {
            if (Math.abs(distToHero) > 0.05) en.dir = Math.sign(distToHero);
            en.aiState = 'aggro_tell';
            en.aiTimer = 0.42;
          } else if (en.aiTimer <= 0) {
            en.dir = en.nextDir || -en.dir;
            en.aiState = 'patrol';
          }
        } else if (en.aiState === 'aggro_tell') {
          en.aiTimer -= dt;
          if (Math.abs(distToHero) > 0.05) en.dir = Math.sign(distToHero);
          en.telegraph = Math.max(0, Math.min(1, 1 - en.aiTimer / 0.42));
          en.chargeBlend = approach(en.chargeBlend || 0, 0.35, dt * 4.5);
          if (en.aiTimer <= 0) {
            en.aiState = 'charge';
            en.aiTimer = 0.65;
            en.chargeBlend = 1;
          }
        } else if (en.aiState === 'charge') {
          en.aiTimer -= dt;
          en.chargeBlend = 1;
          en.telegraph = 1;
          const chargeSpd = 2.45 * ngScale;
          const { hitBound } = this._moveEnemyAlongSpan(en, chargeSpd, dt, 1.35);
          if (hitBound || en.aiTimer <= 0) {
            en.aiState = 'huff';
            en.aiTimer = 0.70;
            en.aggroCooldown = 1.35;
            if (hitBound) en.nextDir = -en.dir;
          }
        } else if (en.aiState === 'huff') {
          en.aiTimer -= dt;
          en.chargeBlend = approach(en.chargeBlend || 0, 0, dt * 5.0);
          en.telegraph = 0;
          if (en.aiTimer <= 0) {
            if (en.nextDir) {
              en.dir = en.nextDir;
              en.nextDir = 0;
            }
            en.aiState = 'patrol';
          }
        } else {
          // 'patrol'
          en.aiState = 'patrol';
          en.chargeBlend = approach(en.chargeBlend || 0, 0, dt * 6);
          en.telegraph = approach(en.telegraph || 0, 0, dt * 5);
          if (canAggro) {
            if (Math.abs(distToHero) > 0.05) en.dir = Math.sign(distToHero);
            en.aiState = 'aggro_tell';
            en.aiTimer = 0.42;
          } else {
            const patrolSpd = 0.88 * ngScale;
            const { hitBound } = this._moveEnemyAlongSpan(en, patrolSpd, dt, 1.35);
            if (hitBound) {
              en.aiState = 'edge_look';
              en.aiTimer = 0.45;
              en.nextDir = -en.dir;
            }
          }
        }
      }
      // 2. `gulp_hopper` — Gluttonous Ambush Bullfrog (`0.00` grounded sit_watch -> `0.85s` 1.45x inflate -> ballistic `vy=8.6, grav=26` leap -> `0.55s` land_recover)
      else if (en.type === 'gulp_hopper') {
        const distToHero = colDist(en.col, p.col);
        const heroNear = Math.abs(en.baseFloor - p.floor) <= 2.5 && Math.abs(distToHero) <= 5.0;

        if (en.aiState === 'inflate') {
          en.aiTimer -= dt;
          en.floor = en.baseFloor;
          en.inflatePhase = Math.max(0, Math.min(1, 1 - en.aiTimer / 0.85));
          en.telegraph = en.inflatePhase;
          if (en.inflatePhase < 0.6 && heroNear && Math.abs(distToHero) > 0.08) {
            en.dir = Math.sign(distToHero);
          }
          if (en.aiTimer <= 0) {
            // Ensure hop direction has room on the terrace span; bounce inward if sitting at span boundary!
            if (en.spanStart != null && en.spanLen != null) {
              const minOff = en.spanMinOff ?? 0.58;
              const maxOff = en.spanMaxOff ?? Math.max(minOff, en.spanLen - 0.58);
              if (en.dir > 0 && en.spanOffset >= maxOff - 0.08 && maxOff > minOff + 0.1) en.dir = -1;
              else if (en.dir < 0 && en.spanOffset <= minOff + 0.08 && maxOff > minOff + 0.1) en.dir = 1;
            }
            en.aiState = 'leap';
            en.hopVy = 8.6;
            en.hopVx = 1.75 * ngScale;
            en.inflatePhase = 0;
            en.telegraph = 0;
          }
        } else if (en.aiState === 'leap') {
          en.inflatePhase = 0;
          en.telegraph = 0;
          const { hitBound } = this._moveEnemyAlongSpan(en, en.hopVx || 1.75 * ngScale, dt, 1.15);
          if (hitBound) {
            en.hopVx = 0;
            en.nextDir = -en.dir;
          }
          en.hopVy = (en.hopVy || 0) - 26.0 * dt;
          en.floor += en.hopVy * dt;
          if (en.floor <= en.baseFloor && en.hopVy <= 0) {
            en.floor = en.baseFloor;
            en.hopVy = 0;
            en.hopVx = 0;
            if (en.nextDir) {
              en.dir = en.nextDir;
              en.nextDir = 0;
            }
            en.aiState = 'land_recover';
            en.aiTimer = 0.55;
          }
        } else if (en.aiState === 'land_recover') {
          en.aiTimer -= dt;
          en.floor = en.baseFloor;
          en.inflatePhase = 0;
          en.telegraph = 0;
          if (en.aiTimer <= 0) {
            en.aiState = 'sit_watch';
            en.aiTimer = 0.55;
          }
        } else {
          // 'sit_watch' — strictly 0.00 cols/s grounded!
          en.aiState = 'sit_watch';
          en.aiTimer -= dt;
          en.floor = en.baseFloor;
          en.inflatePhase = approach(en.inflatePhase || 0, 0, dt * 6);
          en.telegraph = 0;
          if (heroNear && Math.abs(distToHero) > 0.08) {
            en.dir = Math.sign(distToHero);
          }
          if (en.aiTimer <= 0) {
            en.aiState = 'inflate';
            en.aiTimer = 0.85;
          }
        }
      }
      // 3. `volt_eel` — Bio-Electric Conduit Hunter (`1.15/1.55` S-wave prowl -> `0.65s` coil_tell -> `0.85s` shock discharge -> `2.2s` dimmed exhausted)
      else if (en.type === 'volt_eel') {
        en.aiTimer -= dt;
        if (en.aiState === 'coil_tell') {
          en.coilBlend = Math.max(0, Math.min(1, 1 - en.aiTimer / 0.65));
          en.telegraph = en.coilBlend;
          en.shockActive = false;
          if (en.aiTimer <= 0) {
            en.aiState = 'discharge';
            en.aiTimer = 0.85;
            en.coilBlend = 1;
            en.shockActive = true;
          }
        } else if (en.aiState === 'discharge') {
          en.coilBlend = 1;
          en.telegraph = 1;
          en.shockActive = true;
          if (en.aiTimer <= 0) {
            en.aiState = 'exhausted';
            en.aiTimer = 2.2;
            en.shockActive = false;
            en.telegraph = 0;
          }
        } else if (en.aiState === 'exhausted') {
          en.shockActive = false;
          en.telegraph = 0;
          en.coilBlend = approach(en.coilBlend || 0, 0, dt * 4.2);
          const exhSpd = 0.55 * ngScale;
          en.slitherPhase = (en.slitherPhase || 0) + dt * 2.2;
          en.col = wrapCol(en.col + en.dir * exhSpd * dt);
          en.floor = en.baseFloor + Math.sin(en.slitherPhase) * ((en.amp || 0.36) * 0.45);
          if (en.aiTimer <= 0) {
            en.aiState = 'prowl';
            en.aiTimer = 3.4;
          }
        } else {
          // 'prowl'
          en.aiState = 'prowl';
          en.shockActive = false;
          en.coilBlend = approach(en.coilBlend || 0, 0, dt * 5.0);
          en.telegraph = 0;
          const stalkingHero = Math.abs(en.baseFloor - p.floor) < 1.1 && Math.abs(colDist(en.col, p.col)) < 6.0;
          const prowlSpd = (stalkingHero ? 1.55 : 1.15) * ngScale;
          en.slitherPhase = (en.slitherPhase || 0) + dt * (stalkingHero ? 6.4 : 5.0);
          en.col = wrapCol(en.col + en.dir * prowlSpd * dt);
          en.floor = en.baseFloor + Math.sin(en.slitherPhase) * (en.amp || 0.36);
          if (en.aiTimer <= 0) {
            en.aiState = 'coil_tell';
            en.aiTimer = 0.65;
          }
        }
      }
      // 4. `rail_skater` — Hyperactive Clockwork Strider (`2.35` sprint -> `0.55s` spark_brake -> `0.25s` 180° windup)
      else if (en.type === 'rail_skater' && en.axis !== 'v') {
        const minOff = en.spanMinOff ?? 0.55;
        const maxOff = en.spanMaxOff ?? Math.max(minOff, (en.spanLen || 3) - 0.55);
        const brakeZone = Math.min(0.62, Math.max(0.18, (maxOff - minOff) * 0.35));

        if (en.aiState === 'spark_brake') {
          en.aiTimer -= dt;
          en.brakeBlend = 1;
          en.telegraph = 0.5;
          const remFrac = Math.max(0, en.aiTimer / 0.55);
          const decelSpd = (en.brakeStartSpeed || 2.35 * ngScale) * remFrac;
          this._moveEnemyAlongSpan(en, decelSpd, dt, 1.15);
          en._sparkTimer = (en._sparkTimer || 0) - dt;
          if (en._sparkTimer <= 0) {
            en._sparkTimer = 0.08;
            const sp = this._colFloorToScreen(en.col, en.floor + 0.06, 12);
            if (sp) this._spawnParticles(sp.x, sp.y, '#fb923c', 2, 65, 200, en.col, en.floor + 0.06);
          }
          if (en.aiTimer <= 0) {
            en.aiState = 'windup';
            en.aiTimer = 0.25;
          }
        } else if (en.aiState === 'windup') {
          en.aiTimer -= dt;
          en.brakeBlend = approach(en.brakeBlend || 0, 0.25, dt * 6.0);
          en.telegraph = Math.max(0, Math.min(1, 1 - en.aiTimer / 0.25));
          if (en.aiTimer <= 0) {
            en.dir = -en.dir;
            en.brakeBlend = 0;
            en.telegraph = 0;
            en.aiState = 'sprint';
          }
        } else {
          // 'sprint'
          en.aiState = 'sprint';
          en.brakeBlend = approach(en.brakeBlend || 0, 0, dt * 8.0);
          en.telegraph = 0;
          const sprintSpd = 2.35 * ngScale;
          const { hitBound } = this._moveEnemyAlongSpan(en, sprintSpd, dt, 1.15);
          const distToEnd =
            en.spanStart != null && en.spanLen != null
              ? en.dir > 0
                ? maxOff - en.spanOffset
                : en.spanOffset - minOff
              : Infinity;
          if (hitBound || (maxOff - minOff > 0.25 && distToEnd <= brakeZone)) {
            en.aiState = 'spark_brake';
            en.aiTimer = 0.55;
            en.brakeStartSpeed = hitBound ? 0 : sprintSpd;
            en.brakeBlend = 1;
          }
        }
      }
      // 5. `vent_stalker` — Brooding Thermal Salamander (`0.78` stalk + sniff -> `0.80s` hiss_tell -> `1.05s` vertical steam erupt -> `1.6s` cooldown)
      else if (en.type === 'vent_stalker' || en.axis === 'v') {
        const minF = en.minFloor ?? en.baseFloor - 1.4;
        const maxF = en.maxFloor ?? en.baseFloor + 1.4;

        if (en.aiState === 'hiss_tell') {
          en.aiTimer -= dt;
          en.venting = false;
          en.telegraph = Math.max(0, Math.min(1, 1 - en.aiTimer / 0.80));
          if (en.aiTimer <= 0) {
            en.aiState = 'erupt';
            en.aiTimer = 1.05;
            en.venting = true;
            en.telegraph = 1;
            if (Math.abs(en.floor - p.floor) < 5 && Math.abs(colDist(en.col, p.col)) < 4.5) {
              sound?.steamBurst?.();
            }
          }
        } else if (en.aiState === 'erupt') {
          en.aiTimer -= dt;
          en.venting = true;
          en.telegraph = 1;
          en._steamTimer = (en._steamTimer || 0) - dt;
          if (en._steamTimer <= 0) {
            en._steamTimer = 0.09;
            const sp = this._colFloorToScreen(en.col, en.floor + 0.65, 12);
            if (sp) this._spawnParticles(sp.x, sp.y, '#f8fafc', 2, 75, -90, en.col, en.floor + 0.65);
          }
          if (en.aiTimer <= 0) {
            en.aiState = 'cooldown';
            en.aiTimer = 1.60;
            en.venting = false;
            en.telegraph = 0;
          }
        } else if (en.aiState === 'cooldown') {
          en.aiTimer -= dt;
          en.venting = false;
          en.telegraph = 0;
          if (en.aiTimer < 1.2) {
            const slowCrawl = 0.36 * ngScale;
            en.floor += (en.vDir || 1) * slowCrawl * dt;
            if (en.floor >= maxF) {
              en.floor = maxF;
              en.vDir = -1;
            } else if (en.floor <= minF) {
              en.floor = minF;
              en.vDir = 1;
            }
          }
          if (en.aiTimer <= 0) {
            en.aiState = 'stalk';
            en.aiTimer = 1.35;
          }
        } else if (en.aiState === 'sniff') {
          en.aiTimer -= dt;
          en.venting = false;
          en.telegraph = 0;
          en.stalkClock = (en.stalkClock || 0) + dt;
          if (en.stalkClock >= 3.2) {
            en.stalkClock = 0;
            en.aiState = 'hiss_tell';
            en.aiTimer = 0.80;
          } else if (en.aiTimer <= 0) {
            en.aiState = 'stalk';
            en.aiTimer = 1.35;
          }
        } else {
          // 'stalk' — 0.78 floors/s heavy 4-limb vertical climb
          en.aiState = 'stalk';
          en.aiTimer -= dt;
          en.venting = false;
          en.telegraph = 0;
          en.stalkClock = (en.stalkClock || 0) + dt;
          const stalkSpd = 0.78 * ngScale;
          en.floor += (en.vDir || 1) * stalkSpd * dt;
          let hitEnd = false;
          if (en.floor >= maxF) {
            en.floor = maxF;
            en.vDir = -1;
            hitEnd = true;
          } else if (en.floor <= minF) {
            en.floor = minF;
            en.vDir = 1;
            hitEnd = true;
          }
          if (en.stalkClock >= 3.2) {
            en.stalkClock = 0;
            en.aiState = 'hiss_tell';
            en.aiTimer = 0.80;
          } else if (hitEnd || en.aiTimer <= 0) {
            en.aiState = 'sniff';
            en.aiTimer = 0.35;
          }
        }
      }
      // 6. `barnacle_mortar` — Paranoid Siege Hermit (`watch` -> `0.90s` swell_tell -> parabolic `lob_recoil`; `< 1.35 col` panics into `shell_hide`!)
      else if (en.type === 'barnacle_mortar') {
        const distToHero = colDist(en.col, p.col);
        const absDist = Math.abs(distToHero);
        const dFloor = p.floor - en.floor;
        if (absDist > 0.05) en.dir = Math.sign(distToHero);

        const panicClose = !p.hidden && Math.abs(dFloor) < 0.95 && absDist < 1.35;
        if (panicClose) {
          en.aiState = 'shell_hide';
          en.aiTimer = 1.1;
          en.shellHide = approach(en.shellHide || 0, 1, dt * 10.0);
          en.openAmount = 1 - en.shellHide;
          en.telegraph = 0;
        } else if (en.aiState === 'shell_hide') {
          en.aiTimer -= dt;
          en.shellHide = approach(en.shellHide || 0, 1, dt * 8.0);
          en.openAmount = 1 - en.shellHide;
          en.telegraph = 0;
          if (en.aiTimer <= 0) {
            en.aiState = 'watch';
          }
        } else {
          en.shellHide = approach(en.shellHide || 0, 0, dt * 6.0);
          const period = Math.max(2.6, en.firePeriod || 3.3);
          if (en.aiState === 'swell_tell') {
            en.aiTimer -= dt;
            en.telegraph = Math.max(0, Math.min(1, 1 - en.aiTimer / 0.90));
            en.openAmount = en.telegraph;
            if (en.aiTimer <= 0) {
              en.aiState = 'lob_recoil';
              en.aiTimer = 0.38;
              en.telegraph = 0;
              en.openAmount = 1;
              if (this.enemyProjectiles.length < 5) {
                const shotDir = Math.sign(distToHero) || en.dir || 1;
                const aimCol = absDist <= 8.5 ? p.col : wrapCol(en.col + shotDir * 3.6);
                const aimFloor = Math.abs(dFloor) <= 4.0 ? p.floor : en.floor;
                this._spawnParabolicMortar(en, shotDir, aimCol, aimFloor, 10.5);
                sound?.bubble?.();
              }
            }
          } else if (en.aiState === 'lob_recoil') {
            en.aiTimer -= dt;
            en.telegraph = 0;
            en.openAmount = Math.max(0.15, en.aiTimer / 0.38);
            if (en.aiTimer <= 0) {
              en.aiState = 'watch';
              en.fireTimer = Math.max(1.7, period - 1.28);
            }
          } else {
            // 'watch'
            en.aiState = 'watch';
            en.fireTimer -= dt;
            en.telegraph = 0;
            en.openAmount = approach(en.openAmount || 0, 0.15, dt * 3.0);
            const inSight =
              (absDist >= 1.35 && absDist <= 7.8 && Math.abs(dFloor) <= 3.8) ||
              Math.abs(en.floor - this.camFloor) < 4.5;
            if (en.fireTimer <= 0 && inSight) {
              en.aiState = 'swell_tell';
              en.aiTimer = 0.90;
            }
          }
        }
      }
      // 7. `siphon_warden` — 5-Act Sovereign Bosses with Signature Per-Act Tactics (`actSignature`)!
      else if (en.type === 'siphon_warden') {
        if ((en.bossHitCooldown || 0) > 0) {
          en.bossHitCooldown = Math.max(0, en.bossHitCooldown - dt);
        }
        const act = Math.max(1, Math.min(5, Math.round(Number(en.act ?? this.tower?.act ?? Math.ceil((this.tower?.id || 1) / 2)))));
        en.actSignature = en.actSignature || this._resolveActSignature(act);

        en.bossTimer -= dt;
        const hpRatio = (en.hp || 1) / Math.max(1, en.maxHp || 3);
        const phaseTier = hpRatio <= 0.35 ? 3 : hpRatio <= 0.68 ? 2 : 1;
        en.bossPhaseTier = phaseTier;
        const breakerMult = 1 + this.getSkillRank('warden_breaker') * 0.2;
        const spdMult = (phaseTier === 3 ? 1.25 : phaseTier === 2 ? 1.12 : 1.0) * ngScale;
        en.slitherPhase = (en.slitherPhase || 0) + dt * (4.2 * spdMult);

        const advanceWardenCol = (speedVal) => {
          if (en.arenaStart != null && en.arenaLen != null && en.arenaLen < COLS) {
            const minOff = en.arenaMinOff ?? 0.85;
            const maxOff = en.arenaMaxOff ?? Math.max(minOff, en.arenaLen - 0.85);
            let nextOff = (en.arenaOffset ?? 0) + (en.dir || 1) * speedVal * dt;
            if (nextOff >= maxOff) {
              nextOff = maxOff;
              en.dir = -1;
            } else if (nextOff <= minOff) {
              nextOff = minOff;
              en.dir = 1;
            }
            en.arenaOffset = nextOff;
            en.col = wrapCol(en.arenaStart + en.arenaOffset);
          } else {
            en.col = wrapCol(en.col + (en.dir || 1) * speedVal * dt);
          }
        };

        // Act 4 (`aegis_summoner`) & Phase 2+ Escalation: deploy a flippable Snap-Crab springboard helper safely clear of Gateway!
        const wantsCrabSummon = (act === 4 || phaseTier >= 2) && !en.phase2Spawned && this.enemies.length < 8;
        if (wantsCrabSummon) {
          en.phase2Spawned = true;
          const arenaFloor = Math.round(en.baseFloor);
          const candidateLedges = this.ledges.filter(
            (l) =>
              this._isWalkableLedge(l) &&
              Math.abs(l.floor - arenaFloor) <= 1 &&
              Math.abs(colDist(l.col + 0.5, p.col)) >= 2.1
          );
          const spawnLedge =
            candidateLedges.sort(
              (a, b) => Math.abs(colDist(b.col + 0.5, p.col)) - Math.abs(colDist(a.col + 0.5, p.col))
            )[0] ||
            this.ledges.find((l) => this._isWalkableLedge(l) && Math.abs(l.floor - arenaFloor) <= 1);
          if (spawnLedge) {
            this.enemies.push(
              this._instantiateEnemy(
                { type: 'snap_crab', col: spawnLedge.col + 0.5, floor: spawnLedge.floor, dir: -en.dir, speed: 0.88 },
                this.enemies.length
              )
            );
          }
          if (phaseTier === 3) this.lightningFlash = Math.max(this.lightningFlash, 0.75);
        }

        if (en.bossPhase === 'patrol') {
          en.aiState = 'patrol';
          en.shielded = true;
          en.coreExposed = false;
          en.coreExposeTimer = 0;
          en.chargeBlend = approach(en.chargeBlend || 0, 0, dt * 5);
          en.coilBlend = approach(en.coilBlend || 0, 0, dt * 5);
          en.shockActive = false;
          advanceWardenCol((en.speed || 2.05) * spdMult);
          en.floor = en.baseFloor + Math.sin(en.slitherPhase * 0.7) * (phaseTier === 3 ? 0.48 : 0.36);
          en.telegraph = 0;
          en.openAmount = 0;
          if (en.bossTimer <= 0) {
            en.bossPhase = 'telegraph';
            en.aiState = 'telegraph';
            en.bossTimer = phaseTier === 3 ? 0.75 : 0.92;
          }
        } else if (en.bossPhase === 'telegraph') {
          en.aiState = 'telegraph';
          en.shielded = true;
          en.coreExposed = false;
          en.coreExposeTimer = 0;
          const teleDur = phaseTier === 3 ? 0.75 : 0.92;
          en.telegraph = 1 - Math.max(0, en.bossTimer / teleDur);
          en.openAmount = en.telegraph;

          // Per-Act signature physical windup & rush traits!
          const aimDir = Math.sign(colDist(en.col, p.col)) || en.dir || 1;
          if (en.actSignature === 'bulldozer_mortar') {
            en.dir = aimDir;
            en.chargeBlend = en.telegraph;
            if (en.telegraph > 0.55) {
              advanceWardenCol(2.85 * spdMult);
            }
          } else if (en.actSignature === 'cryo_beam' || en.actSignature === 'aegis_summoner') {
            en.coilBlend = en.telegraph;
            en.shockActive = en.actSignature === 'aegis_summoner' && en.telegraph > 0.65;
          } else if (en.actSignature === 'leviathan_prime') {
            en.chargeBlend = en.telegraph * 0.8;
            en.coilBlend = en.telegraph;
          }

          if (en.bossTimer <= 0) {
            en.shockActive = false;
            // Signature Act Attacks!
            if (Math.abs(en.floor - p.floor) < 6.5 && this.enemyProjectiles.length < 8) {
              if (en.actSignature === 'bulldozer_mortar') {
                // Act 1: Bulldozer Rush + Twin Parabolic Mortar Lob
                this._spawnParabolicMortar(en, -1, wrapCol(en.col - 2.6), p.floor, 9.8);
                this._spawnParabolicMortar(en, 1, wrapCol(en.col + 2.6), p.floor, 9.8);
              } else if (en.actSignature === 'leviathan_prime' || phaseTier >= 3) {
                // Act 5 / Phase 3: 3-Mortar Parabolic Barrage!
                this._spawnParabolicMortar(en, -1, wrapCol(en.col - 3.0), p.floor, 10.2);
                this._spawnParabolicMortar(en, 1, wrapCol(en.col + 3.0), p.floor, 10.2);
                this._spawnParabolicMortar(en, aimDir, p.col, p.floor, 10.5);
                this.lightningFlash = Math.max(this.lightningFlash, 0.55);
                this.addShake(3.2);
              } else {
                this._spawnParabolicMortar(en, aimDir, p.col, p.floor, 10.0);
              }
              sound?.bubble?.();
            }

            if (Math.abs(en.floor - p.floor) < 7.0 && this.bossHazards.length < 4) {
              if (en.actSignature === 'cryo_beam') {
                this._spawnBossHazard('hydro_beam', en, aimDir, Math.max(2, phaseTier));
              } else if (en.actSignature === 'mire_tentacles') {
                this._spawnBossHazard('tentacle_slam', en, aimDir, phaseTier);
                // Second flanking tentacle slam!
                const savedCol = p.col;
                p.col = wrapCol(savedCol + aimDir * 2.2);
                this._spawnBossHazard('tentacle_slam', en, -aimDir, phaseTier);
                p.col = savedCol;
              } else if (en.actSignature === 'aegis_summoner') {
                this._spawnBossHazard('hydro_beam', en, aimDir, phaseTier);
              } else if (en.actSignature === 'leviathan_prime' || phaseTier === 3) {
                this._spawnBossHazard('hydro_beam', en, aimDir, 3);
                this._spawnBossHazard('tentacle_slam', en, aimDir, 3);
              } else if (phaseTier >= 2) {
                this._spawnBossHazard('tentacle_slam', en, aimDir, phaseTier);
              }
            }

            en.bossPhase = 'vulnerable';
            en.aiState = 'vulnerable';
            en.shielded = false;
            en.coreExposed = true;
            en.chargeBlend = 0;
            en.coilBlend = 0;
            en.bossTimer = (phaseTier === 3 ? 2.4 : 2.8) * breakerMult;
            en.coreExposeTimer = en.bossTimer;
            en.dir *= -1;
          }
        } else {
          // 'vulnerable' — core armor plates open for Gateway's Hydro-Pulse or Tail-Whip!
          en.aiState = 'vulnerable';
          en.shielded = false;
          en.coreExposed = true;
          en.chargeBlend = 0;
          en.coilBlend = 0;
          en.shockActive = false;
          en.coreExposeTimer = Math.max(0, en.bossTimer);
          en.openAmount = 1;
          en.telegraph = 0.35;
          advanceWardenCol(0.75 * spdMult);
          if (en.bossTimer <= 0) {
            en.bossPhase = 'patrol';
            en.aiState = 'patrol';
            en.shielded = true;
            en.coreExposed = false;
            en.coreExposeTimer = 0;
            en.bossTimer = phaseTier === 3 ? 1.85 : 2.4;
          }
        }
      }

      // Compute exact instantaneous 120Hz velocities (`velCol`, `velFloor`) for `enemyRig.js`, `renderer.js`, and telemetry!
      en.velCol = dt > 0 ? colDist(prevCol, en.col) / dt : 0;
      en.velFloor = dt > 0 ? (en.floor - prevFloor) / dt : 0;
      if (
        (en.type === 'gulp_hopper' && en.aiState !== 'leap') ||
        (en.type === 'snap_crab' && (en.aiState === 'edge_look' || en.aiState === 'aggro_tell' || en.aiState === 'huff')) ||
        (en.type === 'volt_eel' && (en.aiState === 'coil_tell' || en.aiState === 'discharge')) ||
        (en.type === 'rail_skater' && en.aiState === 'windup') ||
        en.type === 'barnacle_mortar' ||
        en.type === 'vent_stalker'
      ) {
        en.velCol = 0;
      }
      if (
        (en.type === 'gulp_hopper' && en.aiState !== 'leap') ||
        en.type === 'snap_crab' ||
        en.type === 'rail_skater' ||
        en.type === 'barnacle_mortar' ||
        (en.type === 'volt_eel' && (en.aiState === 'coil_tell' || en.aiState === 'discharge')) ||
        (en.type === 'vent_stalker' && (en.aiState === 'sniff' || en.aiState === 'hiss_tell' || en.aiState === 'erupt'))
      ) {
        en.velFloor = 0;
      }

      // Contact & Signature Aura Hazard Check (harmless training crabs & elevator cabs never hurt Gateway!)
      if (en.harmless) continue;
      const shieldedInLift = Boolean(p.onElevator);
      if (p.invuln <= 0 && !shieldedInLift && !p.hidden) {
        const hitFloorTol = en.type === 'siphon_warden' ? 0.95 : en.shockActive ? 0.92 : 0.76;
        const hitColTol = en.type === 'siphon_warden' ? 0.90 : en.shockActive ? 1.02 : 0.72;
        const bodyContact =
          Math.abs(en.floor - p.floor) < hitFloorTol && Math.abs(colDist(en.col, p.col)) < hitColTol;
        const ventPlumeContact =
          en.type === 'vent_stalker' &&
          en.venting &&
          p.floor >= en.floor - 0.30 &&
          p.floor <= en.floor + 1.50 &&
          Math.abs(colDist(en.col, p.col)) < 0.70;
        if (bodyContact || ventPlumeContact) {
          this._applyHazardHit(en.col);
        }
      }
    }
  }

  _spawnBossHazard(kind, en, aimDir = 1, phaseTier = 1) {
    const p = this.gateway;
    const id = `bh_${++this._bossHazardSeq}`;
    if (kind === 'tentacle_slam') {
      const telegraphDur = phaseTier === 3 ? 0.68 : 0.82;
      const activeDur = 0.58;
      this.bossHazards.push({
        id,
        kind: 'tentacle_slam',
        col: wrapCol(p ? p.col : en.col),
        floor: Math.max(0, (p ? p.floor : en.floor) - 0.5),
        spanCols: 1.5,
        spanFloors: 3.1,
        dir: 0,
        sweepSpeed: 0,
        phase: 'telegraph',
        timer: telegraphDur,
        telegraphDur,
        activeDur,
        duration: telegraphDur + activeDur,
        progress: 0,
        phaseTier,
      });
    } else {
      const telegraphDur = phaseTier === 3 ? 0.62 : 0.76;
      const activeDur = phaseTier === 3 ? 0.92 : 0.78;
      this.bossHazards.push({
        id,
        kind: 'hydro_beam',
        col: wrapCol(en.col + aimDir * 0.9),
        floor: en.floor,
        spanCols: 3.2,
        spanFloors: 0.95,
        dir: aimDir || 1,
        sweepSpeed: phaseTier === 3 ? 3.8 : 2.7,
        phase: 'telegraph',
        timer: telegraphDur,
        telegraphDur,
        activeDur,
        duration: telegraphDur + activeDur,
        progress: 0,
        phaseTier,
      });
    }
  }

  _updateBossHazards(dt) {
    if (!this.bossHazards || this.bossHazards.length === 0) return;
    const p = this.gateway;
    for (let i = this.bossHazards.length - 1; i >= 0; i--) {
      const hz = this.bossHazards[i];
      hz.timer -= dt;
      if (hz.phase === 'telegraph') {
        hz.progress = Math.max(0, Math.min(1, 1 - hz.timer / Math.max(0.05, hz.telegraphDur)));
        if (hz.timer <= 0) {
          hz.phase = 'active';
          hz.timer = hz.activeDur;
          hz.progress = 0;
          this.addShake(hz.kind === 'tentacle_slam' ? 4.2 : 2.8);
          sound?.steamBurst?.();
        }
      } else {
        hz.progress = Math.max(0, Math.min(1, 1 - hz.timer / Math.max(0.05, hz.activeDur)));
        if (hz.kind === 'hydro_beam' && hz.sweepSpeed) {
          hz.col = wrapCol(hz.col + hz.dir * hz.sweepSpeed * dt);
        }
        if (p && p.invuln <= 0 && !p.hidden && !p.onElevator) {
          const halfCol = (hz.spanCols || 1.6) * 0.42;
          const inCol = Math.abs(colDist(hz.col, p.col)) <= halfCol;
          const inFloor =
            hz.kind === 'tentacle_slam'
              ? p.floor >= hz.floor - 0.35 && p.floor <= hz.floor + (hz.spanFloors || 3.0)
              : Math.abs(p.floor - hz.floor) <= (hz.spanFloors || 0.95) * 0.65;
          if (inCol && inFloor) {
            this._applyHazardHit(hz.col);
          }
        }
        if (hz.timer <= 0) {
          this.bossHazards.splice(i, 1);
        }
      }
    }
  }

  _updateCritterSonar(dt) {
    const rank = this.getSkillRank('critter_sonar');
    if (rank <= 0 || !this.collectibles || this.collectibles.length === 0) {
      if (this.critterSonar.active) {
        this.critterSonar.active = false;
        this.critterSonar.proximity = 0;
      }
      return;
    }
    const p = this.gateway;
    const maxRangeFloors = 3 + rank * 3; // Rank 1: 6F, Rank 2: 9F, Rank 3: 12F
    let nearest = null;
    let bestDist = Infinity;
    for (const c of this.collectibles) {
      if (c.collected || c.type !== 'critter_pod' || c.alreadyOwned) continue;
      const dF = Math.abs(c.floor - p.floor);
      const dC = Math.abs(colDist(p.col, c.col + 0.5));
      const metric = Math.hypot(dF, dC * 0.45);
      if (dF <= maxRangeFloors && metric < bestDist) {
        bestDist = metric;
        nearest = c;
      }
    }
    if (!nearest) {
      this.critterSonar.active = false;
      this.critterSonar.distanceFloors = 99;
      this.critterSonar.proximity = 0;
      return;
    }
    const prox = Math.max(0.08, Math.min(1, 1 - bestDist / Math.max(2, maxRangeFloors)));
    const dCol = colDist(p.col, nearest.col + 0.5);
    const dFloor = nearest.floor - p.floor;
    let dirHint = '◎';
    if (Math.abs(dFloor) > 1.2) dirHint = dFloor > 0 ? '▲' : '▼';
    else if (Math.abs(dCol) > 0.8) dirHint = dCol > 0 ? '▶' : '◀';
    this.critterSonar = {
      active: true,
      distanceFloors: Number(bestDist.toFixed(1)),
      dirHint,
      critterName: nearest.name || nearest.species || 'Water Critter',
      species: nearest.species || 'Water Critter',
      proximity: Number(prox.toFixed(2)),
    };
    this._critterSonarPingTimer -= dt;
    if (this._critterSonarPingTimer <= 0) {
      sound?.critterRadarPing?.(prox);
      this._critterSonarPingTimer = Math.max(1.1, 2.9 - prox * 1.6);
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
    const graceInvulnMult = 1 + this.getSkillRank('harmonic_grace') * 0.15;
    p.invuln = 1.65 * (this.hasMutation('pelagian_grace') ? 1.35 : 1.0) * graceInvulnMult;
    p.hurtTimer = 0.45 * zenScale;
    p.vy = 7.4 * zenScale;
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
    // Restrict smooth stair ramps strictly to real 3D 5-riser staircase masonry (`solid`/`stair*`) (#411 Fix #8)
    const isStairMasonry = (l) =>
      this._isWalkableLedge(l) && (l.type === 'solid' || l.type === 'stairR' || l.type === 'stairL');

    let best = null;
    let bestErr = maxTol;

    for (const l0 of this.ledges) {
      if (!isStairMasonry(l0) || l0.col !== c0) continue;
      if (Math.abs(l0.floor - refFloor) > 1.35) continue;
      for (const l1 of this.ledges) {
        if (!isStairMasonry(l1) || l1.col !== c1) continue;
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

        const linearFloor = l0.floor + df * rampT;
        // 5-riser physical tread quantization blended with smooth step climb so feet push up each stone riser!
        const treadPos = Math.max(0, Math.min(4.999, rampT * 5));
        const treadIndex = Math.floor(treadPos);
        const treadFrac = treadPos - treadIndex;
        const steppedRamp = (treadIndex + Math.min(1, treadFrac * 1.45)) / 5;
        const surfFloor = l0.floor + df * (rampT * 0.55 + steppedRamp * 0.45);
        const err = Math.abs(linearFloor - refFloor);
        if (err <= bestErr) {
          bestErr = err;
          best = {
            floor: surfFloor,
            linearFloor,
            treadIndex,
            rampT,
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
      } else if (this.runType === 'warden_gauntlet') {
        sound?.setBossActive?.(false);
        this.prog?.recordWardenGauntletRun?.({
          bossesDefeated: this.gauntletBossesDefeated || 0,
          cleared: false,
          timeSec: this.gauntletElapsedSec || 0,
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
      const prevDeathsHere = this.towerDeathsHere;
      this.loadTower(this.towerIndex);
      this.towerDeathsHere = prevDeathsHere;
      this.cb.onBanner?.(reason, `${this.lives} ${this.lives === 1 ? 'LIFE' : 'LIVES'} LEFT • FLOOR 0 RESET`);
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
    if (this._isCrownLocked()) {
      const exitDoor = this.tower?.doors?.find((d) => d.isExit);
      this._denyLockedCrown(exitDoor);
      return;
    }
    if (this.runType === 'warden_gauntlet') {
      const liveWarden = this.enemies.find((e) => !e.dead && e.type === 'siphon_warden');
      if (liveWarden) {
        sound?.vaultTick?.(false);
        this.cb.onBanner?.('CROWN SEALED BY WARDEN!', `DEFEAT ${liveWarden.bossTitle || 'SIPHON WARDEN'} FIRST`);
        return;
      }
      this.lastCoreCrystalsSmashed = 3;
      this._triggerSpirePurification();
      return;
    }
    // Purist Arcade & Flood Rush keep lightning-fast pace:
    // Campaign, Master Watershed NG+, Expedition, Sanctum Trials & Daily Tide launch full playable Reactor Core Descent!
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

    // 7 giant spinning 5-blade Hydro-Turbine Gates synced 1:1 with `core_reactor_props.glb` (#411 Fix #7)
    for (let i = 0; i < 7; i++) {
      const depth = 52 + i * 48;
      turbines.push({
        id: i + 1,
        depth,
        z: depth,
        rotAngle: (i * 1.1) % (Math.PI * 2),
        rotSpeed: (i % 2 === 0 ? 1 : -1) * (1.25 + i * 0.14),
        bladeCount: 5,
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
            const sector = (Math.PI * 2) / (tb.bladeCount || 5);
            let rel = (cd.angle - tb.rotAngle) % sector;
            if (rel < 0) rel += sector;
            const bladeHalfWidth = 0.16;
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
    if (this.coreDescent) {
      this.coreDescent.active = false;
    }
    this.mode = 'topple';
    this.topple = { active: true, progress: 0, duration: this.runType === 'warden_gauntlet' ? 1.8 : 2.6 };
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

    if (this.runType === 'campaign' || this.runType === 'purist' || this.runType === 'master_watershed') {
      const tid = this.tower?.id || 1;
      const clearRes = this.prog?.recordTowerClear?.({
        runType: this.runType === 'master_watershed' ? 'campaign' : this.runType,
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
      if (this.runType === 'master_watershed' || this.masterWatershed) {
        const ngRes = this.prog?.recordMasterWatershedClear?.({
          towerId: tid,
          score: this.score,
          fullCampaignClear: tid >= 10,
        });
        this._handleProgTrophyReturn(ngRes);
      }
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
      if (this.tower?.id) {
        this.prog?.recordSanctumSpireClear?.(this.tower.id);
      }
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

    if (this.runType === 'warden_gauntlet') {
      if (this.towerIndex >= this.towers.length - 1) {
        sound?.setBossActive?.(false);
        const wgRes = this.prog?.recordWardenGauntletRun?.({
          bossesDefeated: this.towers.length,
          cleared: true,
          timeSec: this.gauntletElapsedSec || 0,
          score: this.score,
        });
        this._handleProgTrophyReturn(wgRes);
        this.mode = 'victory';
        this._syncHud();
        this.cb.onGameOver?.(true, this.score, this.hiScore, this._buildGameOverSummary(true));
      } else {
        this.towerIndex += 1;
        this.nextTowerShield = true;
        this.mode = 'tower';
        this.loadTower(this.towerIndex);
      }
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
      if (this.hasMutation('pelagian_grace') && this.endlessDepth > 0 && this.endlessDepth % 3 === 0 && this.lives < 6) {
        this.lives = Math.min(6, this.lives + 1);
        sound?.extraLife?.();
      }
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
    const awardSubGears = (g) => {
      this._awardGears(g);
      sound?.collectGear?.();
    };
    const fx = {
      addScore: (pts) => this.addScore(pts),
      addGear: awardSubGears,
      addGears: awardSubGears,
      onWarpCave: () => {
        this.nextTowerShield = true;
        this.nextTowerWarpFloors = 2;
        this._tryUnlockTrophy('grotto_explorer');
        this._tryUnlockTrophy('warp_finder');
      },
      grantWarpReward: () => {
        this.nextTowerShield = true;
        this.nextTowerWarpFloors = 2;
        this._tryUnlockTrophy('grotto_explorer');
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
    this.gateway.isGliding = true;
    this.gateway.frillFlare = 1.0;
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
      if (this.gateway) {
        this.gateway.isGliding = false;
        this.gateway.frillFlare = 0;
      }
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
      this.timer = Math.min((this.timeLimit || this.tower?.timeLimit || 260) + 20, this.timer + 20);
      this._awardGears(10);
      this._tryUnlockTrophy('first_star_core');
      this.addScore(1500);
      if (this.runType !== 'purist') this.gateway.shield = true;
      // Solving a Mandatory Inner Aqueduct Sanctum shatters Crown Seal 2/3 & retracts Mid-Spire Siphon Barrier!
      const matchedSealId =
        door.sealId ||
        this.sealObjectives?.find((s) => s.kind === 'sanctum' && (!s.doorId || s.doorId === door.id))?.id ||
        null;
      const brokeSeal = matchedSealId
        ? this._breakCrownSeal(matchedSealId, 'SANCTUM SOLVED • MID-SPIRE BARRIER RETRACTED!')
        : false;
      if (!brokeSeal) {
        this.cb.onBanner?.('AQUEDUCT SANCTUM SOLVED!', '★ HARMONIC SEED • +10 GEARS • +20s');
      }
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
