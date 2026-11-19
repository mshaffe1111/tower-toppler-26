// Towering Waters: Gateway's Descent — Created by Matt Shaffer
// Main Application Shell, 6-Mode Hub, Story & Purification Cutscene Theater, Living Watershed Map & Android Back-Button Controller

import { sound } from './audio.js';
import { InputController, CONTROL_MODES } from './input.js';
import { GameRenderer } from './renderer.js';
import * as gameMod from './game.js';
import * as progMod from './progression.js';
import * as levelsMod from './levels.js';
import * as uiArtMod from './uiArtwork.js';

const { progression, SKIN_CATALOG = [], TROPHIES = [] } = progMod;
const {
  createTowers,
  createSanctumTowers,
  createWardenGauntletTowers,
  createDailyTower,
  generateProceduralTower,
  getDailySeed,
} = levelsMod;

const GameEngineClass =
  gameMod.ToweringWatersGame ||
  gameMod.GatewayGame ||
  gameMod.WatershedGame ||
  Object.values(gameMod).find((v) => typeof v === 'function');

function getWorldCols() {
  return Number(levelsMod.COLS) || 20;
}

// ================= DOM REFERENCES =================
const appEl = document.getElementById('app');
const stageWrap = document.getElementById('stage-wrap');
const canvas = document.getElementById('game-canvas');
const stageTransitionVeilEl = document.getElementById('stage-transition-veil');
const hudEl = document.getElementById('hud');
const touchControlsEl = document.getElementById('touch-controls');

// Top HUD
const hudModeLabelEl = document.getElementById('hud-mode-label');
const hudTimerCaptionEl = document.getElementById('hud-timer-caption');
const scoreEl = document.getElementById('score-display');
const hiScoreEl = document.getElementById('hi-score-display');
const livesEl = document.getElementById('lives-display');
const gearsEl = document.getElementById('gears-display');
const timerEl = document.getElementById('timer-display');
const timerRingEl = document.getElementById('timer-ring');
const timerRingArcEl = document.getElementById('timer-ring-arc');
const dirArrowEl = document.getElementById('dir-arrow');
const towerBadgeEl = document.getElementById('tower-badge');
const crownSealsPillEl = document.getElementById('crown-seals-pill');
const crownSealsCountEl = document.getElementById('crown-seals-count');
const crownSealChips = [
  document.getElementById('crown-seal-0'),
  document.getElementById('crown-seal-1'),
  document.getElementById('crown-seal-2'),
];
const crownSealLbls = [
  document.getElementById('crown-seal-lbl-0'),
  document.getElementById('crown-seal-lbl-1'),
  document.getElementById('crown-seal-lbl-2'),
];
const missionStatusPillEl = document.getElementById('mission-status-pill');
const critterSonarPillEl = document.getElementById('critter-sonar-pill');

const btnCtrlMode = document.getElementById('btn-ctrl-mode');
const btnMusic = document.getElementById('btn-music');
const btnSound = document.getElementById('btn-sound');
const btnPause = document.getElementById('btn-pause');

// In-Stage Telemetry, Reactor Core Descent HUD & Toasts
const altMeterEl = document.getElementById('altitude-meter');
const altFillEl = document.getElementById('alt-fill');
const altPipEl = document.getElementById('alt-pip');
const altWaterEl = document.getElementById('alt-water');

const coreDescentHudEl = document.getElementById('core-descent-hud');
const coreHudTitleEl = document.getElementById('core-hud-title');
const coreHudLocksEl = document.getElementById('core-hud-locks');
const coreDepthFillEl = document.getElementById('core-depth-fill');
const coreHudSubEl = document.getElementById('core-hud-sub');

const actionPromptEl = document.getElementById('action-prompt');
const puzzleHudEl = document.getElementById('puzzle-hud');
const puzzleHudTitleEl = document.getElementById('puzzle-hud-title');
const puzzleHudSubEl = document.getElementById('puzzle-hud-sub');
const btnPeekClue = document.getElementById('btn-peek-clue');
const peekClueLblEl = document.getElementById('peek-clue-lbl');

const bannerEl = document.getElementById('stage-banner');
const bannerSubEl = document.getElementById('banner-sub');
const bannerTitleEl = document.getElementById('banner-title');

const trophyToastEl = document.getElementById('trophy-toast');
const trophyToastKickerEl = document.getElementById('trophy-toast-kicker');
const trophyToastTitleEl = document.getElementById('trophy-toast-title');
const trophyToastIconEl = trophyToastEl?.querySelector('.trophy-toast-icon');

// Touch Controls
const btnCalibrateTilt = document.getElementById('btn-calibrate-tilt');
const btnWhip = document.getElementById('btn-whip');
const hudCtrlHintEl = document.getElementById('hud-ctrl-hint');
const hudCtrlHintTextEl = document.getElementById('hud-ctrl-hint-text');
const tiltCtrlHintEl = document.getElementById('tilt-ctrl-hint');
const titleCtrlGuideEl = document.getElementById('title-ctrl-guide');
const pauseCtrlGuideEl = document.getElementById('pause-ctrl-guide');

// Overlays
const overlayTitle = document.getElementById('overlay-title');
const overlayModes = document.getElementById('overlay-modes');
const overlayWorlds = document.getElementById('overlay-worlds');
const overlayWardrobe = document.getElementById('overlay-wardrobe');
const overlayTrophies = document.getElementById('overlay-trophies');
const overlayMinigames = document.getElementById('overlay-minigames');
const overlayMutation = document.getElementById('overlay-mutation');
const overlayPause = document.getElementById('overlay-pause');
const overlayGameOver = document.getElementById('overlay-gameover');
const gameoverCardEl = document.getElementById('gameover-card');

// Title Screen Controls
const startTowerSelect = document.getElementById('start-tower');
const selectedTowerStarsEl = document.getElementById('selected-tower-stars');
const toggleZenInput = document.getElementById('toggle-zen');
const selectControlMode = document.getElementById('select-control-mode');

const btnVistaCycle = document.getElementById('btn-vista-cycle');
const vistaCycleLblEl = document.getElementById('vista-cycle-lbl');
const btnWatershedQuick = document.getElementById('btn-watershed-quick');
const titleWatershedPctEl = document.getElementById('title-watershed-pct');

const btnTitleSettings = document.getElementById('btn-title-settings');
const titleSettingsDrawer = document.getElementById('title-settings-drawer');
const titleCtrlGlyphEl = document.getElementById('title-ctrl-glyph');
const titleCtrlCodeEl = document.getElementById('title-ctrl-code');
const btnZenPill = document.getElementById('btn-zen-pill');
const zenPillLabelEl = document.getElementById('zen-pill-label');
const btnTitleMusic = document.getElementById('btn-title-music');
const btnTitleSound = document.getElementById('btn-title-sound');
const btnTitleVoice = document.getElementById('btn-title-voice');
const titleCtrlPickBtns = document.querySelectorAll('[data-ctrl-pick]');

// 3-Channel Audio Mixer Sliders (Title + Pause)
const sliderMusicVol = document.getElementById('slider-music-vol');
const valMusicVol = document.getElementById('val-music-vol');
const sliderAmbienceVol = document.getElementById('slider-ambience-vol');
const valAmbienceVol = document.getElementById('val-ambience-vol');
const sliderSfxVol = document.getElementById('slider-sfx-vol');
const valSfxVol = document.getElementById('val-sfx-vol');

const pauseSliderMusic = document.getElementById('pause-slider-music');
const pauseValMusic = document.getElementById('pause-val-music');
const pauseSliderAmbience = document.getElementById('pause-slider-ambience');
const pauseValAmbience = document.getElementById('pause-val-ambience');
const pauseSliderSfx = document.getElementById('pause-slider-sfx');
const pauseValSfx = document.getElementById('pause-val-sfx');

const titleCrestStageEl = document.getElementById('title-crest-stage');
const titleDioramaStageEl = document.getElementById('title-diorama-stage');

const btnHeroSector = document.getElementById('btn-hero-sector');
const heroSectorNameEl = document.getElementById('hero-sector-name');
const playMedallionSvgEl = document.getElementById('play-medallion-svg');
const heroPlayKickerEl = document.getElementById('hero-play-kicker');
const heroPlayLabelEl = document.getElementById('hero-play-label');

const btnStart = document.getElementById('btn-start');
const btnModes = document.getElementById('btn-modes');
const btnCloseModes = document.getElementById('btn-close-modes');
const modeHubCards = document.querySelectorAll('[data-mode-pick]');
const modeArtSlots = document.querySelectorAll('[data-mode-art]');
const metaModeCampaignEl = document.getElementById('meta-mode-campaign');
const metaModePuristEl = document.getElementById('meta-mode-purist');
const metaModeFloodEl = document.getElementById('meta-mode-flood');
const metaModeSanctumEl = document.getElementById('meta-mode-sanctum');
const metaModeExpeditionEl = document.getElementById('meta-mode-expedition');
const metaModeDailyEl = document.getElementById('meta-mode-daily');
const metaModeGauntletEl = document.getElementById('meta-mode-gauntlet');
const btnModeGauntlet = document.getElementById('btn-mode-gauntlet');
const metaModeMasterEl = document.getElementById('meta-mode-master');
const btnModeMaster = document.getElementById('btn-mode-master');

const btnWorlds = document.getElementById('btn-worlds');
const btnMinigames = document.getElementById('btn-minigames');
const btnWardrobe = document.getElementById('btn-wardrobe');
const btnTrophies = document.getElementById('btn-trophies');
const worldsDockBadgeEl = document.getElementById('worlds-dock-badge');
const wardrobeBtnBadge = document.getElementById('wardrobe-btn-badge');
const trophiesBtnBadge = document.getElementById('trophies-btn-badge');

// Watershed Map Controls
const worldsKickerEl = document.getElementById('worlds-kicker');
const worldsStarsPillEl = document.getElementById('worlds-stars-pill');
const worldsMapListEl = document.getElementById('worlds-map-list');
const btnCloseWorlds = document.getElementById('btn-close-worlds');

// Sanctuary Wardrobe, Hydro-Pulse FX, Bio-Skill Tree, 3D Bestiary & Critters Controls
const sanctuaryTurntableStageEl = document.getElementById('sanctuary-turntable-stage');
const sanctuaryTurntableHintEl = document.getElementById('sanctuary-turntable-hint');
const btnSanctuaryZoomOut = document.getElementById('btn-sanctuary-zoom-out');
const btnSanctuaryResetCam = document.getElementById('btn-sanctuary-reset-cam');
const btnSanctuaryZoomIn = document.getElementById('btn-sanctuary-zoom-in');
const sanctuaryAnimBarEl = document.getElementById('sanctuary-anim-bar');
const wardrobeGearsEl = document.getElementById('wardrobe-gears');
const wardrobeGridEl = document.getElementById('wardrobe-grid');
const blasterFxGridEl = document.getElementById('blaster-fx-grid');
const skillTreeGridEl = document.getElementById('skill-tree-grid');
const bestiaryPanelEl = document.getElementById('bestiary-panel');
const bestiaryDetailStripEl = document.getElementById('bestiary-detail-strip');
const bestiaryGridEl = document.getElementById('bestiary-grid');
const crittersGridEl = document.getElementById('critters-grid');
const wardrobeTabBtns = document.querySelectorAll('[data-wardrobe-tab]');
const wardrobeSkinsTabLbl = document.getElementById('wardrobe-skins-tab-lbl');
const wardrobeBlasterTabLbl = document.getElementById('wardrobe-blaster-tab-lbl');
const wardrobeSkillsTabLbl = document.getElementById('wardrobe-skills-tab-lbl');
const wardrobeBestiaryTabLbl = document.getElementById('wardrobe-bestiary-tab-lbl');
const wardrobeCrittersTabLbl = document.getElementById('wardrobe-critters-tab-lbl');
const btnCloseWardrobe = document.getElementById('btn-close-wardrobe');

// Honors & Field Logs Controls
const totalStarsDisplayEl = document.getElementById('total-stars-display');
const trophyRankLblEl = document.getElementById('trophy-rank-lbl');
const trophyPtsDisplayEl = document.getElementById('trophy-pts-display');
const trophyPtsFillEl = document.getElementById('trophy-pts-fill');
const trophyViewTabBtns = document.querySelectorAll('[data-trophy-view]');
const trophiesViewTabLbl = document.getElementById('trophies-view-tab-lbl');
const relicsViewTabLbl = document.getElementById('relics-view-tab-lbl');
const curiosViewTabLbl = document.getElementById('curios-view-tab-lbl');
const trophyTierFiltersEl = document.getElementById('trophy-tier-filters');
const tierFilterBtns = document.querySelectorAll('[data-tier-filter]');
const trophiesGridEl = document.getElementById('trophies-grid');
const relicCodexListEl = document.getElementById('relic-codex-list');
const curioCodexListEl = document.getElementById('curio-codex-list');
const btnCloseTrophies = document.getElementById('btn-close-trophies');

// Mini-Games Controls
const minigameCards = document.querySelectorAll('[data-minigame]');
const portalArtEls = document.querySelectorAll('[data-portal-art]');
const btnCloseMinigames = document.getElementById('btn-close-minigames');

// Bio-Mutation Draft Controls
const mutationActiveCountEl = document.getElementById('mutation-active-count');
const mutationCardsGridEl = document.getElementById('mutation-cards-grid');

// Pause & Game Over Controls
const pauseTowerName = document.getElementById('pause-tower-name');
const pauseControlMode = document.getElementById('pause-control-mode');
const pauseCtrlPillBtns = document.querySelectorAll('[data-pause-ctrl]');
const btnPauseCalibrate = document.getElementById('btn-pause-calibrate');
const btnResume = document.getElementById('btn-resume');
const btnRestart = document.getElementById('btn-restart');
const btnPauseTitle = document.getElementById('btn-pause-title');

const goBadge = document.getElementById('go-badge');
const goTitle = document.getElementById('go-title');
const goScore = document.getElementById('go-score');
const goHi = document.getElementById('go-hi');
const goStars = document.getElementById('go-stars');
const goGears = document.getElementById('go-gears');
const btnPlayAgain = document.getElementById('btn-play-again');
const btnBackTitle = document.getElementById('btn-back-title');

// Cutscene Theater Controls
const overlayCutscene = document.getElementById('overlay-cutscene');
const cutsceneActPillEl = document.getElementById('cutscene-act-pill');
const cutsceneTitleEl = document.getElementById('cutscene-title');
const cutsceneRestorationWrapEl = document.getElementById('cutscene-restoration-wrap');
const cutsceneRestorationLblEl = document.getElementById('cutscene-restoration-lbl');
const cutsceneRestorationPctEl = document.getElementById('cutscene-restoration-pct');
const cutsceneRestorationFillEl = document.getElementById('cutscene-restoration-fill');
const btnCutsceneSkip = document.getElementById('btn-cutscene-skip');
const cutsceneTapStage = document.getElementById('cutscene-tap-stage');
const cutsceneKeyframeCardEl = document.getElementById('cutscene-keyframe-card');
const cutsceneKeyframeImgEl = document.getElementById('cutscene-keyframe-img');
const cutsceneKeyframeCaptionEl = document.getElementById('cutscene-keyframe-caption');
const cutsceneCommsBoxEl = document.getElementById('cutscene-comms-box');
const cutscenePortraitEl = document.getElementById('cutscene-portrait');
const cutsceneSpeakerEl = document.getElementById('cutscene-speaker');
const cutsceneStepDotsEl = document.getElementById('cutscene-step-dots');
const cutsceneTextEl = document.getElementById('cutscene-text');
const btnCutsceneNext = document.getElementById('btn-cutscene-next');

// ================= BESPOKE VECTOR SVG LIBRARY (ZERO EMOJIS) =================
const RING_CIRCUMFERENCE = 2 * Math.PI * 19;

const HARMONIC_SHIELD_SVG = `
  <svg viewBox="0 0 24 26" aria-hidden="true">
    <path fill="currentColor" d="M12 2C7.4 8.2 4.5 12.6 4.5 17a7.5 7.5 0 0 0 15 0c0-4.4-2.9-8.8-7.5-15Zm0 10.4a3.2 3.2 0 1 1 0 6.4 3.2 3.2 0 0 1 0-6.4Z"/>
  </svg>
`;

const SVG_GEAR = `<svg class="ico-svg ico-gear-gold" viewBox="0 0 24 24" aria-hidden="true"><use href="#ico-gear"/></svg>`;
const SVG_STAR_ON = `<svg class="ico-svg ico-star-filled" viewBox="0 0 24 24" aria-hidden="true"><use href="#ico-star"/></svg>`;
const SVG_STAR_OFF = `<svg class="ico-svg ico-star-hollow" viewBox="0 0 24 24" aria-hidden="true"><use href="#ico-star-empty"/></svg>`;
const SVG_RELIC = `<svg class="ico-svg" viewBox="0 0 24 24" aria-hidden="true"><use href="#ico-relic"/></svg>`;
const SVG_BLASTER = `<svg class="ico-svg" viewBox="0 0 24 24" aria-hidden="true"><use href="#ico-blaster"/></svg>`;
const SVG_CRAFT = `<svg class="ico-svg" viewBox="0 0 24 24" aria-hidden="true"><use href="#ico-craft"/></svg>`;
const SVG_CURIO = `<svg class="ico-svg" viewBox="0 0 24 24" aria-hidden="true"><use href="#ico-curio"/></svg>`;

const SVG_LOCK = `
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <rect x="5" y="11" width="14" height="10" rx="2" fill="none" stroke="currentColor" stroke-width="1.8"/>
    <path d="M8 11V7.5a4 4 0 0 1 8 0V11" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
  </svg>
`;

const SVG_SOUND_ON = `
  <svg class="ico-svg" viewBox="0 0 24 24" aria-hidden="true">
    <path d="M4 9.5h3.8L13 5v14l-5.2-4.5H4v-5Z" fill="currentColor"/>
    <path d="M16.2 8.8a4.8 4.8 0 0 1 0 6.4M18.8 6.2a8.4 8.4 0 0 1 0 11.6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
  </svg>
`;

const SVG_SOUND_OFF = `
  <svg class="ico-svg" viewBox="0 0 24 24" aria-hidden="true">
    <path d="M4 9.5h3.8L13 5v14l-5.2-4.5H4v-5Z" fill="currentColor"/>
    <path d="M16.5 9.5l5 5M21.5 9.5l-5 5" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/>
  </svg>
`;

const SVG_MUSIC_ON = `
  <svg class="ico-svg" viewBox="0 0 24 24" aria-hidden="true">
    <path d="M9 17.5V6.2l10-2.2v11.3" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/>
    <circle cx="6.8" cy="17.8" r="2.6" fill="currentColor"/>
    <circle cx="16.8" cy="15.6" r="2.6" fill="currentColor"/>
  </svg>
`;

const SVG_MUSIC_OFF = `
  <svg class="ico-svg" viewBox="0 0 24 24" aria-hidden="true">
    <path d="M9 17.5V6.2l10-2.2v7.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
    <circle cx="6.8" cy="17.8" r="2.5" fill="currentColor"/>
    <path d="M4 4l16 16" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/>
  </svg>
`;

const CTRL_SVGS = {
  gesture: `<svg class="ico-svg" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12h16M7 9l-3 3 3 3M17 9l3 3-3 3" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  joystick: `<svg class="ico-svg" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8.5" r="4" fill="currentColor"/><path d="M12 12.5v5M6 19h12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`,
  dpad: `<svg class="ico-svg" viewBox="0 0 24 24" aria-hidden="true"><path d="M9.5 4h5v5.5H20v5h-5.5V20h-5v-5.5H4v-5h5.5V4Z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/></svg>`,
  tilt: `<svg class="ico-svg" viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="7" width="16" height="10" rx="2.2" transform="rotate(-14 12 12)" fill="none" stroke="currentColor" stroke-width="1.8"/><circle cx="12" cy="12" r="1.8" fill="currentColor"/></svg>`,
};

const CTRL_SHORT_CODES = {
  gesture: 'GESTURE',
  joystick: 'STICK',
  dpad: 'D-PAD',
  tilt: 'TILT',
};

const CTRL_GUIDE_TEXT = {
  gesture: 'Slide & Hold: Walk/Run • Quick Side-Slash or 2-Finger Tap: Tail-Whip • Flick Up: Jump • Tap: Hydro-Pulse',
  tilt: 'Tilt: Walk/Run • Wrist-Flick or Swipe Sideways: Tail-Whip • Flick Up: Jump • Tap: Hydro-Pulse',
  joystick: 'Thumb Stick: Walk/Run • Right Buttons: Tail-Whip, Hydro-Pulse & Jump',
  dpad: 'Classic D-Pad: 4-Way Move • Right Buttons: Tail-Whip, Hydro-Pulse & Jump',
};

const DIR_CHEVRON_SVGS = {
  left: `<svg class="ico-dir" viewBox="0 0 12 12"><path d="M8 2L3.5 6L8 10" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  right: `<svg class="ico-dir" viewBox="0 0 12 12"><path d="M4 2L8.5 6L4 10" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  up: `<svg class="ico-dir" viewBox="0 0 12 12"><path d="M2 8.5L6 3.5L10 8.5" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
};

const PROMPT_ICONS = {
  up: `<svg class="ico-svg" viewBox="0 0 16 16"><path d="M3.5 10.5L8 5l4.5 5.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  updown: `<svg class="ico-svg" viewBox="0 0 16 16"><path d="M4.5 6.5L8 3l3.5 3.5M4.5 9.5L8 13l3.5-3.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  pulse: `<svg class="ico-svg" viewBox="0 0 16 16"><circle cx="8" cy="8" r="5.5" fill="none" stroke="currentColor" stroke-width="1.6"/><circle cx="8" cy="8" r="2.2" fill="currentColor"/></svg>`,
  bolt: `<svg class="ico-svg" viewBox="0 0 16 16"><path d="M9.2 1.5L3.5 9h4.2l-.9 5.5L12.5 7H8.3l.9-5.5Z" fill="currentColor"/></svg>`,
  rune: `<svg class="ico-svg" viewBox="0 0 16 16"><path d="M8 1.6 13.4 8 8 14.4 2.6 8 8 1.6Z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><circle cx="8" cy="8" r="1.8" fill="currentColor"/></svg>`,
  craft: `<svg class="ico-svg" viewBox="0 0 24 24"><use href="#ico-craft"/></svg>`,
  key: `<svg class="ico-svg" viewBox="0 0 24 24"><use href="#ico-key"/></svg>`,
  curio: `<svg class="ico-svg" viewBox="0 0 24 24"><use href="#ico-curio"/></svg>`,
  lock: `<svg class="ico-svg" viewBox="0 0 24 24"><use href="#ico-lock-closed"/></svg>`,
};

// ================= MEANINGFUL STORY & SPIRE PURIFICATION CUTSCENES =================
const STORY_CUTSCENES = {
  prologue: {
    act: 'PROLOGUE • REDWOOD CANYON RIVERS',
    title: 'DESCENT FROM PELAGIA',
    towerIdx: 0,
    isPurification: false,
    beats: [
      {
        speaker: 'naiad',
        name: 'NAIAD • HYDRO-NAVIGATOR AI',
        text: 'Atmospheric entry complete, Envoy Gateway. Below us lies Earth’s Redwood Canyon Gorge—colossal Siphon Spires have locked the river headwaters down to 12% flow.',
      },
      {
        speaker: 'warden',
        name: 'WARDEN VEX • SIPHON SYNDICATE',
        text: 'UNREGISTERED PELAGIAN BIO-SIGNATURE DETECTED. GORGE TURBINES AT FULL EXTRACTION. EARTH’S HYDROSPHERE BELONGS TO THE SYNDICATE.',
      },
      {
        speaker: 'gateway',
        name: 'GATEWAY • PELAGIAN HYDRO-ENVOY',
        text: 'Feel the dry stone cracking beneath my claws, Naiad. Charge the Harmonic Water Seeds—I will climb every spire, dive their reactor shafts, and give these rivers back their voice!',
      },
    ],
  },
  act2_intro: {
    act: 'ACT II • CRYSTAL ALPINE LAKES',
    title: 'SILENT MIRROR PEAKS',
    towerIdx: 2,
    isPurification: false,
    beats: [
      {
        speaker: 'guardian',
        name: 'ELDER TALON • ALPINE WATER KEEPER',
        text: 'Traveler with the sea-glass frills—the canyon rapids sing again, yet our snow-fed Alpine Mirror Lakes are trapped behind high-altitude Siphon Viaducts!',
      },
      {
        speaker: 'naiad',
        name: 'NAIAD • HYDRO-NAVIGATOR AI',
        text: 'Telemetry confirms brass rotary pipe-valves along the granite facade. Spin them with your Tail-Whip to pressurize the mechanical lifts and thaw the glacial basin.',
      },
      {
        speaker: 'gateway',
        name: 'GATEWAY • PELAGIAN HYDRO-ENVOY',
        text: 'Crisp mountain air and wet crystal walls—perfect for a gecko-scamper. Hold fast, Elder; the snowmelt will shine like glass before dusk.',
      },
    ],
  },
  act3_intro: {
    act: 'ACT III • EMERALD MIST BAYOUS',
    title: 'ROOTS OF THE DELTA',
    towerIdx: 4,
    isPurification: false,
    beats: [
      {
        speaker: 'naiad',
        name: 'NAIAD • HYDRO-NAVIGATOR AI',
        text: 'Entering the Emerald Mist Bayou. Ancient cypress roots wrap around sunken temple spires while Syndicate dredgers pump toxic silt into the firefly channels.',
      },
      {
        speaker: 'warden',
        name: 'WARDEN MIRE • DELTA OVERSEER',
        text: 'FLOODGATE LOCKS SEALED. VOLT-EELS AND BARNACLE MORTARS DEPLOYED TO ALL STAIRWAYS. NO DROP ESCAPES THE DELTA.',
      },
      {
        speaker: 'gateway',
        name: 'GATEWAY • PELAGIAN HYDRO-ENVOY',
        text: 'Your mortar bubbles bounce right off my tail, Overseer. Let us open the floodgates and let the lotus lanterns bloom again!',
      },
    ],
  },
  act4_intro: {
    act: 'ACT IV • SUNLIT CORAL SEAS',
    title: 'GUARDIANS OF THE LAGOON',
    towerIdx: 6,
    isPurification: false,
    beats: [
      {
        speaker: 'guardian',
        name: 'KORU • CORAL REEF GUARDIAN',
        text: 'Envoy Gateway! Two limestone mega-spires are draining our turquoise atoll—reef shelves are bleaching in the noon sun and our sea turtles are locked in Siphon cages!',
      },
      {
        speaker: 'gateway',
        name: 'GATEWAY • PELAGIAN HYDRO-ENVOY',
        text: 'These warm coral currents remind me of Pelagia’s home lagoons. Point me to the Crown Valve, Koru—we free the reef wildlife and shatter their siphon core together.',
      },
    ],
  },
  act5_intro: {
    act: 'ACT V • POLAR & TEMPEST OCEANS',
    title: 'EYE OF THE MOTHER SIPHON',
    towerIdx: 8,
    isPurification: false,
    beats: [
      {
        speaker: 'warden',
        name: 'HIGH OVERLORD KRAKEN-01 • MOTHER SIPHON',
        text: 'FOUR WATERSHEDS LOST, YET THE POLAR MAELSTROM REMAINS IMPREGNABLE. ORBITAL EXTRACTION BEAM AT 94% CAPACITY!',
      },
      {
        speaker: 'naiad',
        name: 'NAIAD • HYDRO-NAVIGATOR AI',
        text: 'Aurora winds are howling across the glacial icebergs, Gateway. One final harmonic seed planted at the Mother Siphon’s bedrock anchor will heal Earth’s entire ocean cycle!',
      },
      {
        speaker: 'gateway',
        name: 'GATEWAY • PELAGIAN HYDRO-ENVOY',
        text: 'Frills flared, Hydro-Caster resonating at full tide. For Pelagia and for Earth—let’s finish this descent!',
      },
    ],
  },
  purify_canyon_river: {
    act: 'WATERSHED PURIFIED • ACT I',
    title: 'REDWOOD RIVERS REBORN',
    biomeLabel: 'CANYON RIVERS RESTORATION',
    towerIdx: 1,
    isPurification: true,
    startPct: 24,
    endPct: 100,
    beats: [
      {
        speaker: 'naiad',
        name: 'NAIAD • HYDRO-NAVIGATOR AI',
        text: 'Harmonic Water Seed anchored! The Siphon Spire’s copper conduits are fracturing—stolen mountain water is surging back into the Redwood Gorge!',
      },
      {
        speaker: 'gateway',
        name: 'GATEWAY • PELAGIAN HYDRO-ENVOY',
        text: 'Look at the waterfalls roaring back over the red-rock cliffs and rainbow mist rising from the rapids! Act I watershed restored to 100%!',
      },
    ],
  },
  purify_alpine_lake: {
    act: 'WATERSHED PURIFIED • ACT II',
    title: 'MIRROR LAKES AWAKENED',
    biomeLabel: 'ALPINE LAKES RESTORATION',
    towerIdx: 3,
    isPurification: true,
    startPct: 20,
    endPct: 100,
    beats: [
      {
        speaker: 'guardian',
        name: 'ELDER TALON • ALPINE WATER KEEPER',
        text: 'The glacial locks have shattered! Pure turquoise snowmelt is cascading through the stone aqueducts and filling the mirror basin!',
      },
      {
        speaker: 'gateway',
        name: 'GATEWAY • PELAGIAN HYDRO-ENVOY',
        text: 'Every granite peak reflects in crystal water once more. Onward down the mountain rivers toward the Emerald Bayou!',
      },
    ],
  },
  purify_mist_bayou: {
    act: 'WATERSHED PURIFIED • ACT III',
    title: 'LANTERNS OF THE BAYOU',
    biomeLabel: 'MIST BAYOUS RESTORATION',
    towerIdx: 5,
    isPurification: true,
    startPct: 22,
    endPct: 100,
    beats: [
      {
        speaker: 'naiad',
        name: 'NAIAD • HYDRO-NAVIGATOR AI',
        text: 'Silt toxicity dropping to zero! Fresh jade currents are sweeping beneath the cypress arches and thousands of golden fireflies are rising over the lotus pads!',
      },
      {
        speaker: 'gateway',
        name: 'GATEWAY • PELAGIAN HYDRO-ENVOY',
        text: 'The delta breathes warm and clear again. Next horizon: the sunlit Coral Seas!',
      },
    ],
  },
  purify_coral_sea: {
    act: 'WATERSHED PURIFIED • ACT IV',
    title: 'TURQUOISE LAGOON BLOOM',
    biomeLabel: 'CORAL SEAS RESTORATION',
    towerIdx: 7,
    isPurification: true,
    startPct: 25,
    endPct: 100,
    beats: [
      {
        speaker: 'guardian',
        name: 'KORU • CORAL REEF GUARDIAN',
        text: 'Our reefs are glowing with living color! Manta rays and sea turtles are gliding freely beneath the sunlit atoll arches once again!',
      },
      {
        speaker: 'gateway',
        name: 'GATEWAY • PELAGIAN HYDRO-ENVOY',
        text: 'Four Earth watersheds healed—only the Mother Siphon in the Polar Tempest Ocean stands between this planet and total restoration!',
      },
    ],
  },
  purify_storm_ocean: {
    act: 'WATERSHED PURIFIED • ACT V',
    title: 'MAELSTROM TAMED',
    biomeLabel: 'DEEP OCEANS RESTORATION',
    towerIdx: 9,
    isPurification: true,
    startPct: 30,
    endPct: 100,
    beats: [
      {
        speaker: 'naiad',
        name: 'NAIAD • HYDRO-NAVIGATOR AI',
        text: 'Mother Siphon core neutralized! The corrupted vortex is dissolving into calm sapphire swells under the Polar Aurora!',
      },
      {
        speaker: 'gateway',
        name: 'GATEWAY • PELAGIAN HYDRO-ENVOY',
        text: 'From mountain headwaters to the deepest ocean trench—Earth’s waters flow free!',
      },
    ],
  },
  epilogue: {
    act: 'EPILOGUE • GLOBAL HYDROSPHERE HEALED',
    title: 'EARTH’S LIVING WATERS',
    biomeLabel: 'GLOBAL EARTH HYDROSPHERE',
    towerIdx: 9,
    isPurification: true,
    startPct: 80,
    endPct: 100,
    beats: [
      {
        speaker: 'warden',
        name: 'MOTHER SIPHON TELEMETRY',
        text: 'CRITICAL HARMONIC OVERLOAD... ALL TEN SIPHON SPIRES REPURPOSED INTO NATURAL AQUEDUCT SANCTUARIES... SYNDICATE FLEET WITHDRAWING...',
      },
      {
        speaker: 'naiad',
        name: 'NAIAD • HYDRO-NAVIGATOR AI',
        text: 'Global orbital scan complete, Gateway! Redwood rivers, alpine mirror lakes, emerald bayous, coral lagoons, and polar oceans have all reached 100% harmonic balance!',
      },
      {
        speaker: 'gateway',
        name: 'GATEWAY • PELAGIAN HYDRO-ENVOY',
        text: 'Listen to the waterfalls and surf singing together, Naiad. Earth’s waters are safe—and I think I’ll surf a few more canyon rapids before our star-pod heads home!',
      },
    ],
  },
};

const FALLBACK_BIO_MUTATIONS = [
  {
    id: 'triple_whip',
    name: 'Triple Tail-Whip',
    description: 'Gateway’s 360° Lizard Tail-Whip unleashes 3 cascading hydro-rings, expanding reach to 1.75 columns and reflecting mortar bubbles at 2x speed.',
  },
  {
    id: 'hydro_double_jump',
    name: 'Hydro-Jet Double Jump',
    description: 'Vents pressurized water from Gateway’s harness nozzles to trigger a crisp mid-air second jump, resetting on every landing, wall-strip, or grapple ring.',
  },
  {
    id: 'gecko_sprint',
    name: 'Gecko Sprint',
    description: 'Micro-setae toe pads grant full dry-stone grip on Alpine ice, +22% sprint speed up real staircases, and rapid Gecko Wall-Scamper climbs.',
  },
  {
    id: 'bubble_aegis',
    name: 'Bubble Aegis',
    description: 'Generates a regenerative Pelagian sea-glass water shield that absorbs one enemy or hazard hit per spire without losing a heart.',
  },
  {
    id: 'tidal_magnet',
    name: 'Tidal Magnet',
    description: 'Draws nearby Water Pearls, salvage parts, compass keys, and curios smoothly toward Gateway across wide spire chasms.',
  },
];

const FALLBACK_HYDRO_FX = [
  { id: 'sea_glass_pulse', name: 'Pelagian Sea-Glass', description: 'Crystalline turquoise hydro-pulses with sunlit foam rings.', pointsRequired: 0, gearCost: 0, previewColors: ['#5efce8', '#ffffff', '#0ea5e9'] },
  { id: 'emerald_lotus', name: 'Bayou Biolume Surge', description: 'Emerald-jade water pulses infused with glowing lotus spores.', pointsRequired: 100, gearCost: 60, previewColors: ['#34d399', '#a7f3d0', '#059669'] },
  { id: 'canyon_sunburst', name: 'Canyon Rapids Gold', description: 'Sun-warmed amber-turquoise spray arcs from Redwood waterfalls.', pointsRequired: 250, gearCost: 110, previewColors: ['#fbbf24', '#fef08a', '#0284c7'] },
  { id: 'coral_prism', name: 'Coral Lagoon Prism', description: 'Iridescent rose-coral and aqua reef shockwaves.', pointsRequired: 450, gearCost: 160, previewColors: ['#fb7185', '#99f6e4', '#0891b2'] },
  { id: 'alpine_glacier', name: 'Alpenglow Frost-Stream', description: 'High-altitude sapphire-silver snowmelt spiral bolts.', pointsRequired: 700, gearCost: 220, previewColors: ['#7dd3fc', '#ffffff', '#2563eb'] },
  { id: 'aurora_sovereign', name: 'Polar Aurora Tide', description: 'Shimmering diamond-aqua and violet aurora harmonic waves.', pointsRequired: 900, gearCost: 320, previewColors: ['#5efce8', '#c084fc', '#fde047'] },
];

const FALLBACK_WATERSHED_LOGS = [
  { id: 'log_s1', towerId: 1, title: 'LOG 01 • REDWOOD GORGE HEADWATERS', lore: 'When the Siphon Spire anchored into the canyon floor, three centuries-old waterfalls vanished in an hour. Re-aligning the copper river-valves restores immediate flow.' },
  { id: 'log_s2', towerId: 2, title: 'LOG 02 • TIMBER DAM HYDRO-WHEELS', lore: 'Gateway’s harmonic seeds resonate with Earth’s minerals—cracking Siphon locks without harming native river trout or redwood roots.' },
  { id: 'log_s3', towerId: 3, title: 'LOG 03 • ALPINE MIRROR BASIN', lore: 'At 3,200 meters, crystal snowmelt feeds three continental rivers. Keeping the granite aqueducts unfrozen is vital to every valley below.' },
  { id: 'log_s4', towerId: 4, title: 'LOG 04 • ALPENGLOW VIADUCT', lore: 'Wet quartz veins along the spire face allow Pelagian geckos and hydro-lizards to scamper vertically past broken stair flights.' },
  { id: 'log_s5', towerId: 5, title: 'LOG 05 • CYPRESS LANTERN CHANNELS', lore: 'Bayou fireflies gather wherever clean oxygen-rich water returns. Follow their golden glow to hidden floodgate switches.' },
  { id: 'log_s6', towerId: 6, title: 'LOG 06 • DELTA ROOT SANCTUARY', lore: 'Ancient stone builders carved harmonic water-bells beneath the mangroves to celebrate seasonal rains.' },
  { id: 'log_s7', towerId: 7, title: 'LOG 07 • ATOLL REEF SHELVES', lore: 'Healthy staghorn coral buffers island coastlines from storm swells while sheltering thousands of reef species.' },
  { id: 'log_s8', towerId: 8, title: 'LOG 08 • SEA-GLASS CITADEL', lore: 'Snap-Claw Dredgers carry heavy top-shells—a swift lizard Tail-Whip flips them onto their backs into elastic hydro-trampolines.' },
  { id: 'log_s9', towerId: 9, title: 'LOG 09 • GLACIAL AURORA TRENCH', lore: 'Polar thermohaline currents circulate nutrients across every ocean on Earth. Stopping the deep-water siphon saves the global climate.' },
  { id: 'log_s10', towerId: 10, title: 'LOG 10 • PELAGIAN COVENANT', lore: 'Across the stars, living water binds every world together. Guard your rivers, lakes, and seas—and they will guard you.' },
];

const FALLBACK_CURIO_CATALOG = [
  { id: 'curio_river_otter_charm', kind: 'fauna', title: 'CARVED RIVER OTTER TOTEM', lore: 'Gifted by Canyon Gorge wildlife after the waterfalls returned.' },
  { id: 'curio_redwood_amber', kind: 'curio', title: 'SUNLIT REDWOOD DEW-RESIN', lore: 'Golden canyon resin encapsulating a sparkling drop of morning mist.' },
  { id: 'curio_alpine_quartz', kind: 'curio', title: 'ALPENGLOW ICE PRISM', lore: 'Refracts rose-gold mountain dawn across ancient aqueduct sanctuaries.' },
  { id: 'curio_valve_blueprint', kind: 'blueprint', title: 'ROTARY SLUICE SCHEMATIC', lore: 'Precision bronze hydro-valve gear train engineered for zero-leak water routing.' },
  { id: 'curio_bayou_lotus', kind: 'curio', title: 'BIOLUMINESCENT DELTA LOTUS', lore: 'Blooms at twilight whenever bayou currents run pure and clear.' },
  { id: 'curio_firefly_lantern', kind: 'fauna', title: 'CYPRESS FIREFLY VESSEL', lore: 'Open-lattice sanctuary lantern where marsh fireflies rest safely.' },
  { id: 'curio_sea_turtle_crest', kind: 'fauna', title: 'GREEN TURTLE SHELL MEDALLION', lore: 'Token of gratitude from coral lagoon sea turtles freed during Reef-Swim runs.' },
  { id: 'curio_pearl_conch', kind: 'curio', title: 'HARMONIC MOTHER-OF-PEARL CONCH', lore: 'Echoes with the soothing pentatonic chord of sunlit tropical surf.' },
  { id: 'curio_rapids_fin', kind: 'blueprint', title: 'HYDRO-WAKE SURF CREST', lore: 'Stabilizes high-speed whitewater canyon turns during Rapids Tail-Surf.' },
  { id: 'curio_frill_ribbon', kind: 'curio', title: 'IRIDESCENT UPDRAFT RIBBON', lore: 'Woven sea-silk streamer that traces thermal currents through waterfall rainbows.' },
  { id: 'curio_aurora_shard', kind: 'curio', title: 'POLAR AURORA SEA-GLASS', lore: 'Shimmers with emerald-violet sky curtains above glacial waters.' },
  { id: 'curio_pelagia_seed', kind: 'curio', title: 'PRIME HARMONIC WATER SEED', lore: 'Living crystalline droplet carried by Gateway from oceanic Pelagia.' },
];

// Inject static control icons into popover & pause pills
document.querySelectorAll('[data-ctrl-ico]').forEach((slot) => {
  const key = slot.dataset.ctrlIco || 'gesture';
  slot.innerHTML = CTRL_SVGS[key] || CTRL_SVGS.gesture;
});

// ================= INITIALIZE ENGINE INSTANCES =================
const initSettings = progression.getSettings?.() || {};

const input = new InputController({
  mode: initSettings.controlMode || 'gesture',
  hapticsEnabled: initSettings.hapticsEnabled !== false,
});
input.setTiltSensitivity?.(initSettings.tiltSensitivity ?? 1.0);

const renderer = new GameRenderer(canvas);
renderer.setSkin?.(progression.getEquippedSkin?.());
renderer.setBlasterFx?.(progression.getEquippedBlasterFx?.() || initSettings.blasterFxId || 'sea_glass_pulse');

// Initialize 3-Channel Audio Volumes
const savedMusicVol = Number.isFinite(initSettings.musicVolume) ? initSettings.musicVolume : 0.78;
const savedAmbVol = Number.isFinite(initSettings.ambienceVolume) ? initSettings.ambienceVolume : 0.82;
const savedSfxVol = Number.isFinite(initSettings.sfxVolume) ? initSettings.sfxVolume : 0.80;

sound.setZenMode?.(Boolean(initSettings.zenMode));
sound.setMuted?.(Boolean(initSettings.muted));
sound.setMusicEnabled?.(initSettings.musicEnabled !== false);
sound.setVoiceEnabled?.(initSettings.voiceEnabled !== false);
sound.setMusicVolume?.(savedMusicVol);
sound.setAmbienceVolume?.(savedAmbVol);
sound.setSfxVolume?.(savedSfxVol);

// ================= BANNER & HONOR TOAST QUEUE =================
let bannerTimeout = null;
function clearBanner() {
  clearTimeout(bannerTimeout);
  bannerEl?.classList.add('hidden');
}

function showBanner(sub, title) {
  if (!bannerEl) return;
  if (bannerSubEl) bannerSubEl.textContent = sub || '';
  if (bannerTitleEl) bannerTitleEl.textContent = title || '';
  bannerEl.classList.remove('hidden');
  clearTimeout(bannerTimeout);
  bannerTimeout = setTimeout(() => {
    bannerEl.classList.add('hidden');
  }, 2400);
}

const trophyQueue = [];
let trophyToastBusy = false;

function computeTrophyPoints() {
  if (typeof progression.getTrophyPoints === 'function') {
    return progression.getTrophyPoints();
  }
  return TROPHIES.reduce(
    (sum, t) => sum + (progression.isTrophyUnlocked?.(t.id) ? (t.points || 5) : 0),
    0
  );
}

function getRankTitleForPoints(pts) {
  if (pts >= 1000) return 'SOVEREIGN OF LIVING WATERS';
  if (pts >= 700) return 'PELAGIAN ARCH-GUARDIAN';
  if (pts >= 450) return 'HYDROSPHERE KEEPER';
  if (pts >= 200) return 'RAPIDS PATHFINDER';
  if (pts >= 50) return 'CANYON WARDEN';
  return 'STREAM SEEKER';
}

function pumpTrophyQueue() {
  if (trophyToastBusy || trophyQueue.length === 0 || !trophyToastEl) return;
  trophyToastBusy = true;
  const trophy = trophyQueue.shift();
  const tier = trophy.tier || 'aluminum';
  const pts = trophy.points || (tier === 'diamond' ? 30 : tier === 'platinum' ? 20 : tier === 'copper' ? 10 : 5);

  if (trophyToastIconEl && typeof uiArtMod.getTrophyShieldSVG === 'function') {
    trophyToastIconEl.innerHTML = uiArtMod.getTrophyShieldSVG(tier, true);
  }
  if (trophyToastKickerEl) {
    trophyToastKickerEl.textContent = `HONOR UNLOCKED • +${pts} PTS`;
  }
  if (trophyToastTitleEl) trophyToastTitleEl.textContent = trophy.title || 'Watershed Honor';
  trophyToastEl.classList.remove('hidden');
  sound.trophyUnlock?.();
  refreshTitleMeta();

  setTimeout(() => {
    trophyToastEl.classList.add('hidden');
    setTimeout(() => {
      trophyToastBusy = false;
      pumpTrophyQueue();
    }, 220);
  }, 2800);
}

function enqueueTrophyToast(trophy) {
  if (!trophy) return;
  trophyQueue.push(trophy);
  pumpTrophyQueue();
}

// ================= HUD HELPERS =================
function formatScore(n) {
  return String(Math.max(0, Math.floor(n || 0))).padStart(8, '0');
}

function formatTimerInt(sec) {
  return String(Math.max(0, Math.ceil(sec || 0))).padStart(3, '0');
}

function starsToSvgHtml(starsObj) {
  const s1 = starsObj?.clear ? SVG_STAR_ON : SVG_STAR_OFF;
  const s2 = starsObj?.vault ? SVG_STAR_ON : SVG_STAR_OFF;
  const s3 = starsObj?.speed ? SVG_STAR_ON : SVG_STAR_OFF;
  return `${s1}${s2}${s3}`;
}

let prevLivesRendered = -1;
function renderLivesPips(lives, isPurist = false) {
  const count = Math.max(0, Math.floor(lives ?? (isPurist ? 1 : 3)));
  const key = count * 10 + (isPurist ? 1 : 0);
  if (key === prevLivesRendered) return;
  prevLivesRendered = key;

  if (!livesEl) return;
  livesEl.innerHTML = '';
  const slots = isPurist ? Math.max(1, count) : Math.max(3, count);
  for (let i = 0; i < slots; i++) {
    const pip = document.createElement('span');
    pip.className = i < count ? 'life-pip' : 'life-pip depleted';
    pip.innerHTML = HARMONIC_SHIELD_SVG;
    livesEl.appendChild(pip);
  }
}

function resolveActionPromptSpec(rawText, hudMode, hudInteractKind = '') {
  const raw = String(rawText || '').trim();
  if (!raw || hudMode === 'puzzle' || hudMode === 'aqueduct_sanctum') {
    return { html: '', interactKind: '', triggerAction: null, subtype: '' };
  }
  const upper = raw.toUpperCase();
  const explicitKind = String(hudInteractKind || '').toLowerCase();

  // 0a. Already-completed Sanctum / Vault badge ('✓ SANCTUM SOLVED' / '✓ CORE VAULT UNLOCKED') is informational only!
  if (
    hudMode === 'tower' &&
    (raw.includes('✓') || upper.includes('SANCTUM SOLVED') || upper.includes('VAULT UNLOCKED'))
  ) {
    const cleanDone = upper
      .replace(/->/g, '•')
      .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}▲▼◀▶✓◎]/gu, '')
      .replace(/\s+/g, ' ')
      .trim();
    return {
      html: `${PROMPT_ICONS.rune}<span>✓ ${cleanDone}</span>`,
      interactKind: '',
      triggerAction: null,
      subtype: 'done',
    };
  }

  // 0b. Locked Crown / Sealed Fortress Gate / Guarded Sluice MUST take top priority so touch controls are NEVER misrouted!
  if (
    hudMode === 'tower' &&
    (upper.includes('SEALED') ||
      (upper.includes('LOCKED') && !upper.includes('UNLOCKED')) ||
      upper.includes('TO UNLOCK') ||
      upper.includes('NEED PARTS') ||
      upper.includes('NEED KEYS') ||
      upper.includes('CRAFT DYNAMO AT WORKBENCH') ||
      upper.includes('BREAK ALL') ||
      explicitKind === 'locked' ||
      explicitKind === 'sealed')
  ) {
    const cleanLocked = upper
      .replace(/->/g, '•')
      .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}▲▼◀▶✓◎]/gu, '')
      .replace(/\s+/g, ' ')
      .trim();
    return {
      html: `${PROMPT_ICONS.lock}<span>${cleanLocked}</span>`,
      interactKind: '',
      triggerAction: null,
      subtype: 'locked_crown',
    };
  }

  // 1. Tower Door / Summit Crown Valve / Core Dive / Sanctum / Vault / Tunnel MUST take priority BEFORE 'VALVE'!
  if (hudMode === 'tower') {
    if (
      upper.includes('CROWN') ||
      upper.includes('CORE') ||
      upper.includes('DIVE') ||
      upper.includes('PURIFY') ||
      upper.includes('DESCEND') ||
      upper.includes('SUMMIT') ||
      upper.includes('SHRINE')
    ) {
      return {
        html: `${PROMPT_ICONS.up}<span>TAP / SWIPE ↑ • DIVE CORE!</span>`,
        interactKind: 'door',
        triggerAction: 'up',
        subtype: 'door',
      };
    }
    if (upper.includes('SANCTUM') || upper.includes('RUNE') || upper.includes('AQUEDUCT')) {
      return {
        html: `${PROMPT_ICONS.rune}<span>TAP / SWIPE ↑ • SANCTUM</span>`,
        interactKind: 'door',
        triggerAction: 'up',
        subtype: 'door',
      };
    }
    if (upper.includes('VAULT')) {
      return {
        html: `${PROMPT_ICONS.up}<span>TAP / SWIPE ↑ • HYDRO VAULT</span>`,
        interactKind: 'door',
        triggerAction: 'up',
        subtype: 'door',
      };
    }
    if (
      upper.includes('DOOR') ||
      upper.includes('PORTAL') ||
      upper.includes('PASSAGE') ||
      upper.includes('CONDUIT') ||
      upper.includes('TUNNEL')
    ) {
      return {
        html: `${PROMPT_ICONS.up}<span>TAP OR SWIPE ↑ • ENTER DOOR</span>`,
        interactKind: 'door',
        triggerAction: 'up',
        subtype: 'door',
      };
    }
  }

  // 2. Elevator Recall / Call BEFORE generic 'LIFT' / 'ELEVATOR'!
  if ((upper.includes('RECALL') || upper.includes('CALL')) && (upper.includes('LIFT') || upper.includes('ELEVATOR'))) {
    return {
      html: `${PROMPT_ICONS.pulse}<span>TAP • RECALL ELEVATOR</span>`,
      interactKind: 'fire',
      triggerAction: 'fire',
      subtype: 'call_lift',
    };
  }

  // 3. Passive unpowered-lift hint ('SPIN PIPE-VALVES TO PRESSURIZE LIFT') when !hudInteractKind is informational only!
  if ((upper.includes('TO POWER') || upper.includes('TO PRESSURIZE')) && !explicitKind) {
    const cleanHint = upper
      .replace(/->/g, '•')
      .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}▲▼◀▶✓◎]/gu, '')
      .trim();
    return {
      html: `${PROMPT_ICONS.craft}<span>${cleanHint}</span>`,
      interactKind: '',
      triggerAction: null,
      subtype: 'hint',
    };
  }

  // 4. Interactive Pipe-Valve, Sluice Lever, Grapple Ring, Station & Powered Elevator Ride
  if (upper.includes('SLUICE') || upper.includes('LEVER')) {
    return {
      html: `${PROMPT_ICONS.craft}<span>TAP WHIP / PULSE • PULL SLUICE</span>`,
      interactKind: 'fire',
      triggerAction: 'whip',
      subtype: 'valve',
    };
  }
  if (upper.includes('VALVE') || upper.includes('PIPE')) {
    return {
      html: `${PROMPT_ICONS.craft}<span>TAP WHIP / PULSE • SPIN VALVE</span>`,
      interactKind: 'fire',
      triggerAction: 'whip',
      subtype: 'valve',
    };
  }
  if (upper.includes('GRAPPLE') || upper.includes('SWING')) {
    return {
      html: `${PROMPT_ICONS.bolt}<span>TAP WHIP • TAIL-GRAPPLE</span>`,
      interactKind: 'fire',
      triggerAction: 'whip',
      subtype: 'grapple',
    };
  }
  if (upper.includes('CRAFT') || upper.includes('CHEST')) {
    return {
      html: `${PROMPT_ICONS.craft}<span>TAP • INTERACT</span>`,
      interactKind: 'fire',
      triggerAction: 'fire',
      subtype: 'station',
    };
  }
  if (raw.includes('▲▼') || upper.includes('LIFT') || upper.includes('ELEVATOR')) {
    return {
      html: `${PROMPT_ICONS.updown}<span>TAP / SWIPE ↑ • RIDE ELEVATOR</span>`,
      interactKind: 'lift',
      triggerAction: 'up',
      subtype: 'lift',
    };
  }
  if (hudMode === 'vault') {
    return {
      html: `${PROMPT_ICONS.bolt}<span>TAP • ALIGN RING</span>`,
      interactKind: '',
      triggerAction: 'fire',
      subtype: 'vault',
    };
  }

  const cleanLabel = upper
    .replace(/->/g, '•')
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}▲▼◀▶✓◎]/gu, '')
    .trim();
  return {
    html: `${PROMPT_ICONS.up}<span>${cleanLabel}</span>`,
    interactKind: '',
    triggerAction: null,
    subtype: '',
  };
}

function renderMissionStatusMarkup(rawStatus) {
  const upper = String(rawStatus || '').toUpperCase();
  let icon = PROMPT_ICONS.curio;
  if (upper.includes('VALVE') || upper.includes('PIPE') || upper.includes('CRAFT')) icon = PROMPT_ICONS.craft;
  else if (upper.includes('KEY') || upper.includes('CHEST')) icon = PROMPT_ICONS.key;
  else if (upper.includes('SANCTUM') || upper.includes('PUZZLE')) icon = PROMPT_ICONS.rune;
  const clean = upper
    .replace(/->/g, '•')
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}▲▼◀▶]/gu, '')
    .trim();
  return `${icon}<span>${clean}</span>`;
}

let lastTs = performance.now();
function resetFrameClock() {
  lastTs = performance.now();
}

// ================= BIO-MUTATION DRAFT MODAL =================
let pendingMutationPickCb = null;

function openMutationDraftModal(choices, onPickCallback) {
  const pool =
    Array.isArray(choices) && choices.length > 0
      ? choices
      : (Array.isArray(progMod.BIO_MUTATIONS) && progMod.BIO_MUTATIONS.length >= 3
          ? progMod.BIO_MUTATIONS.slice(0, 3)
          : FALLBACK_BIO_MUTATIONS.slice(0, 3));

  pendingMutationPickCb = onPickCallback || null;
  input.resetState?.();
  input.setInteractContext?.(false, '');

  const activeCount = Array.isArray(game?.activeMutations)
    ? game.activeMutations.length
    : Array.isArray(game?.gateway?.mutations)
      ? game.gateway.mutations.length
      : Array.isArray(game?.mutations)
        ? game.mutations.length
        : 0;
  if (mutationActiveCountEl) {
    mutationActiveCountEl.textContent = `${activeCount} ACTIVE`;
  }

  if (mutationCardsGridEl) {
    mutationCardsGridEl.innerHTML = '';
    pool.slice(0, 3).forEach((mut) => {
      const card = document.createElement('button');
      card.type = 'button';
      card.className = 'mutation-card';
      const ico = typeof uiArtMod.getMutationIconSVG === 'function'
        ? uiArtMod.getMutationIconSVG(mut.id)
        : SVG_CURIO;
      card.innerHTML = `
        <span class="mutation-icon">${ico}</span>
        <span class="mutation-title">${mut.name || mut.title || 'Harmonic Evolution'}</span>
        <span class="mutation-desc">${mut.description || mut.desc || 'Enhances Gateway’s hydro-athleticism.'}</span>
        <span class="mutation-pick-tag">EVOLVE GATEWAY</span>
      `;
      card.addEventListener('click', () => {
        sound.unlock?.();
        sound.collectStar?.();
        overlayMutation?.classList.add('hidden');
        const cb = pendingMutationPickCb;
        pendingMutationPickCb = null;
        if (typeof cb === 'function') {
          cb(mut.id, mut);
        } else {
          (game.selectBioMutation || game.selectMutation)?.call(game, mut.id);
        }
        showBanner('BIO-MUTATION EVOLVED', String(mut.name || mut.title || '').toUpperCase());
        syncTitleShowcaseState();
        resetFrameClock();
      });
      mutationCardsGridEl.appendChild(card);
    });
  }

  overlayMutation?.classList.remove('hidden');
  pushNavGuard();
  syncTitleShowcaseState();
  resetFrameClock();
}

window.openMutationDraftModal = openMutationDraftModal;

// ================= GAME INSTANCE & CALLBACKS (ZERO-STALL DIRTY-CHECKED HUD) =================
const DEFAULT_SEAL_LABELS = [
  '1: Pipe Pressure',
  '2: Inner Sanctum',
  '3: Upper Sluice',
];

const hudCache = {
  scoreText: '',
  hiScoreText: '',
  gearsText: '',
  modeLabel: '',
  timerCaption: '',
  timerText: '',
  timerZen: null,
  timerUrgent: null,
  ringOffset: '',
  dirKey: '',
  towerBadge: '',
  sealsVisible: false,
  sealsKey: '',
  sealCountText: '',
  sealsUnsealed: false,
  sealChipLabels: ['', '', ''],
  sealChipBroken: [false, false, false],
  sealChipNext: [false, false, false],
  missionVisible: false,
  missionRaw: '',
  altVisible: false,
  altPct: -1,
  waterPct: -1,
  altSinking: false,
  coreVisible: false,
  coreTitle: '',
  coreLocks: '',
  corePct: -1,
  coreSub: '',
  appGameMode: '',
  puzzleVisible: false,
  puzzleTitle: '',
  puzzleSub: '',
  canPeek: null,
  isPeeking: null,
  promptKey: '',
  promptVisible: false,
  promptActionable: false,
  promptLocked: false,
  interactActive: null,
  interactKind: null,
};

let currentPromptAction = null;
let currentPromptSubtype = '';

function setInteractContextCached(active, kind) {
  const a = Boolean(active);
  const k = a ? String(kind || '') : '';
  if (hudCache.interactActive === a && hudCache.interactKind === k) return;
  hudCache.interactActive = a;
  hudCache.interactKind = k;
  input.setInteractContext?.(a, k);
}

function resetHudVisibilityCache() {
  hudCache.sealsVisible = false;
  hudCache.missionVisible = false;
  hudCache.altVisible = false;
  hudCache.coreVisible = false;
  hudCache.puzzleVisible = false;
  hudCache.promptVisible = false;
  hudCache.promptKey = '';
  hudCache.promptActionable = false;
  hudCache.promptLocked = false;
  hudCache.interactActive = false;
  hudCache.interactKind = '';
}

function formatSealShortLabel(rawObj, idx) {
  const fallback = DEFAULT_SEAL_LABELS[idx] || `Seal ${idx + 1}`;
  if (!rawObj) return fallback;
  const rawLabel =
    typeof rawObj === 'string'
      ? rawObj
      : rawObj.shortLabel || rawObj.label || rawObj.title || rawObj.name || '';
  const cleaned = String(rawLabel)
    .replace(/^(?:seal\s*#?\s*\d+\s*[:•\-–—]?\s*)/i, '')
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}✓✕]/gu, '')
    .replace(/\bPipe-Valve\s+Pressure\b/i, 'Pipe Pressure')
    .replace(/\bInner\s+Aqueduct\s+Sanctum\b/i, 'Inner Sanctum')
    .replace(/\bUpper\s+Sluice\s+Guardian\b/i, 'Upper Sluice')
    .replace(/\s+/g, ' ')
    .trim();
  if (!cleaned) return fallback;
  const compact = cleaned.length > 22 ? `${cleaned.slice(0, 21).trim()}…` : cleaned;
  return `${idx + 1}: ${compact}`;
}

function updateCrownSealsHud(hud, titleOpen) {
  if (!crownSealsPillEl) return;
  const rawTotal = hud.crownSealsTotal ?? game.crownSealsTotal ?? 0;
  const total = Math.max(0, Math.min(3, Number(rawTotal) || 0));
  const showSeals = hud.mode === 'tower' && total > 0 && !titleOpen && !cutsceneState.active;

  if (!showSeals) {
    if (hudCache.sealsVisible) {
      hudCache.sealsVisible = false;
      crownSealsPillEl.classList.add('hidden');
    }
    return;
  }

  if (!hudCache.sealsVisible) {
    hudCache.sealsVisible = true;
    crownSealsPillEl.classList.remove('hidden');
  }

  const rawObjectives = Array.isArray(hud.sealObjectives)
    ? hud.sealObjectives
    : Array.isArray(game.sealObjectives)
      ? game.sealObjectives
      : null;

  const rawBroken = hud.crownSealsBroken ?? game.crownSealsBroken ?? 0;
  let brokenCount = Math.max(0, Math.min(total, Number(rawBroken) || 0));

  const states = [false, false, false];
  const labels = ['', '', ''];
  let objBrokenSum = 0;
  let hasExplicitObjFlags = false;

  for (let i = 0; i < 3; i++) {
    const obj = rawObjectives?.[i];
    labels[i] = formatSealShortLabel(obj, i);
    if (obj && typeof obj === 'object') {
      const explicitFlag =
        obj.broken ?? obj.solved ?? obj.unlocked ?? obj.complete ?? obj.done;
      if (explicitFlag !== undefined) {
        hasExplicitObjFlags = true;
        states[i] = Boolean(explicitFlag);
        if (states[i]) objBrokenSum++;
      } else {
        states[i] = i < brokenCount;
      }
    } else {
      states[i] = i < brokenCount;
    }
  }

  if (hasExplicitObjFlags) {
    brokenCount = Math.max(brokenCount, Math.min(total, objBrokenSum));
  }

  const nextKey = `${brokenCount}/${total}|${states[0] ? 1 : 0}${states[1] ? 1 : 0}${states[2] ? 1 : 0}|${labels[0]}|${labels[1]}|${labels[2]}`;
  if (nextKey === hudCache.sealsKey) return;
  hudCache.sealsKey = nextKey;

  const allUnsealed = brokenCount >= total;
  if (allUnsealed !== hudCache.sealsUnsealed) {
    hudCache.sealsUnsealed = allUnsealed;
    crownSealsPillEl.classList.toggle('is-unsealed', allUnsealed);
  }

  const countText = allUnsealed
    ? `CROWN UNSEALED • ${brokenCount}/${total}`
    : `CROWN SEALS • ${brokenCount}/${total}`;
  if (crownSealsCountEl && countText !== hudCache.sealCountText) {
    hudCache.sealCountText = countText;
    crownSealsCountEl.textContent = countText;
  }

  let firstLockedIdx = -1;
  for (let i = 0; i < total; i++) {
    if (!states[i]) {
      firstLockedIdx = i;
      break;
    }
  }

  for (let i = 0; i < 3; i++) {
    const chip = crownSealChips[i];
    const lblEl = crownSealLbls[i];
    if (!chip) continue;
    chip.classList.toggle('hidden', i >= total);
    if (i >= total) continue;

    const isBroken = states[i];
    const isNext = !allUnsealed && i === firstLockedIdx;
    if (isBroken !== hudCache.sealChipBroken[i]) {
      hudCache.sealChipBroken[i] = isBroken;
      chip.classList.toggle('is-broken', isBroken);
    }
    if (isNext !== hudCache.sealChipNext[i]) {
      hudCache.sealChipNext[i] = isNext;
      chip.classList.toggle('is-next', isNext);
    }
    if (lblEl && labels[i] !== hudCache.sealChipLabels[i]) {
      hudCache.sealChipLabels[i] = labels[i];
      lblEl.textContent = labels[i];
    }
  }
}

let lastLaunch = {
  mode: 'campaign',
  towerIdx: 0,
  zenMode: Boolean(initSettings.zenMode),
  miniGame: 'core_descent',
};

let gearsBeforeRun = progression.getGears?.() ?? 0;

const game = new GameEngineClass(
  renderer,
  input,
  {
    onHud(hud) {
      const titleOpen = isTitleScreenOpen();

      // 1. Score / Best / Pearls (dirty-checked)
      if (scoreEl) {
        const sText = formatScore(hud.score);
        if (sText !== hudCache.scoreText) {
          hudCache.scoreText = sText;
          scoreEl.textContent = sText;
        }
      }
      if (hiScoreEl) {
        const hiText = formatScore(hud.hiScore);
        if (hiText !== hudCache.hiScoreText) {
          hudCache.hiScoreText = hiText;
          hiScoreEl.textContent = hiText;
        }
      }
      if (gearsEl) {
        const gText = String(hud.gears ?? progression.getGears?.() ?? 0);
        if (gText !== hudCache.gearsText) {
          hudCache.gearsText = gText;
          gearsEl.textContent = gText;
        }
      }

      const rType = String(hud.runType || game.runType || lastLaunch.mode || 'campaign').toLowerCase();
      const isPurist = rType.includes('purist');
      renderLivesPips(hud.lives, isPurist);

      if (hudModeLabelEl) {
        let modeLbl = 'GATEWAY';
        if (isPurist) {
          const mult = hud.comboMult || hud.multiplier || 1;
          modeLbl = mult > 1 ? `PURIST • ${mult}X` : 'PURIST ARCADE';
        } else if (rType.includes('gauntlet') || rType.includes('warden')) {
          modeLbl = 'WARDEN GAUNTLET';
        } else if (rType.includes('master')) {
          modeLbl = 'MASTER NG+';
        } else if (rType.includes('flood')) {
          modeLbl = 'FLASH-FLOOD';
        } else if (rType.includes('sanctum')) {
          modeLbl = 'SANCTUM TRIAL';
        } else if (rType.includes('expedition')) {
          modeLbl = 'EXPEDITION';
        } else if (rType.includes('daily')) {
          modeLbl = 'DAILY TIDE';
        }
        if (modeLbl !== hudCache.modeLabel) {
          hudCache.modeLabel = modeLbl;
          hudModeLabelEl.textContent = modeLbl;
        }
      }

      // 2. Siphon Timer & Ring (dirty-checked, quantized to avoid 60Hz SVG repaint stalls)
      const timerFree = Boolean(hud.zenMode || rType.includes('sanctum')) && hud.mode === 'tower';
      const isUrgent = !timerFree && hud.timer <= 15 && (hud.mode === 'tower' || hud.mode === 'vault');

      if (hudTimerCaptionEl) {
        const cap = timerFree ? 'FLOW' : isPurist ? 'CLOCK' : rType.includes('flood') ? 'SURGE' : 'SIPHON';
        if (cap !== hudCache.timerCaption) {
          hudCache.timerCaption = cap;
          hudTimerCaptionEl.textContent = cap;
        }
      }
      if (timerEl) {
        const tText = timerFree ? 'CALM' : formatTimerInt(hud.timer);
        if (tText !== hudCache.timerText) {
          hudCache.timerText = tText;
          timerEl.textContent = tText;
        }
        if (timerFree !== hudCache.timerZen) {
          timerEl.classList.toggle('zen', timerFree);
          timerRingEl?.classList.toggle('zen', timerFree);
          hudCache.timerZen = timerFree;
        }
        if (isUrgent !== hudCache.timerUrgent) {
          timerEl.classList.toggle('urgent', isUrgent);
          timerRingEl?.classList.toggle('urgent', isUrgent);
          hudCache.timerUrgent = isUrgent;
        }
      }

      if (timerRingArcEl) {
        const limit = Math.max(1, hud.timeLimit || 110);
        const ratio = timerFree ? 1 : Math.max(0, Math.min(1, (hud.timer || 0) / limit));
        const quantizedOffset = (Math.round(RING_CIRCUMFERENCE * (1 - ratio) * 2) * 0.5).toFixed(1);
        if (quantizedOffset !== hudCache.ringOffset) {
          hudCache.ringOffset = quantizedOffset;
          timerRingArcEl.style.strokeDashoffset = quantizedOffset;
        }
      }

      if (dirArrowEl) {
        const dirKey = hud.dirHint === '◀' ? 'left' : hud.dirHint === '▶' ? 'right' : 'up';
        if (dirKey !== hudCache.dirKey) {
          hudCache.dirKey = dirKey;
          dirArrowEl.innerHTML = DIR_CHEVRON_SVGS[dirKey];
        }
      }

      if (towerBadgeEl) {
        const m = hud.mode;
        let badge = `S${hud.towerId || 1}`;
        if (m === 'core_descent') badge = 'CORE';
        else if (m === 'reef_swim' || m === 'submarine') badge = 'REEF';
        else if (m === 'rapids_surf' || m === 'skimmer') badge = 'SURF';
        else if (m === 'frill_glide' || m === 'glide') badge = 'GLIDE';
        else if (m === 'aqueduct_sanctum' || m === 'puzzle') badge = 'SANCTUM';
        else if (m === 'vault') badge = 'VAULT';
        else if (rType.includes('daily')) badge = 'DAILY';
        else if (rType.includes('gauntlet') || rType.includes('warden')) badge = `W${hud.towerId || 1}`;
        else if (rType.includes('master')) badge = `M${hud.towerId || 1}`;
        if (badge !== hudCache.towerBadge) {
          hudCache.towerBadge = badge;
          towerBadgeEl.textContent = badge;
        }
      }

      // 3. 3-Seal Hydro-Lock Progression Pill (dirty-checked!)
      updateCrownSealsHud(hud, titleOpen);

      // 4. Mission Status Pill (dirty-checked)
      if (missionStatusPillEl) {
        const mRaw = hud.mode === 'tower' && hud.missionStatus ? String(hud.missionStatus) : '';
        const showMission = Boolean(mRaw && !titleOpen && !cutsceneState.active);
        if (showMission) {
          if (mRaw !== hudCache.missionRaw) {
            hudCache.missionRaw = mRaw;
            missionStatusPillEl.innerHTML = renderMissionStatusMarkup(mRaw);
          }
          if (!hudCache.missionVisible) {
            hudCache.missionVisible = true;
            missionStatusPillEl.classList.remove('hidden');
          }
        } else if (hudCache.missionVisible || hudCache.missionRaw) {
          hudCache.missionRaw = '';
          hudCache.missionVisible = false;
          missionStatusPillEl.classList.add('hidden');
        }
      }

      // 5. Altitude & Rising Surge Meter (quantized to 0.5% + dirty-checked)
      const showAlt = hud.mode === 'tower' && !titleOpen && !cutsceneState.active;
      if (altMeterEl) {
        if (showAlt !== hudCache.altVisible) {
          hudCache.altVisible = showAlt;
          altMeterEl.classList.toggle('hidden', !showAlt);
        }
        if (showAlt) {
          const altPct = Math.round(Math.max(0, Math.min(100, hud.altitudePct ?? 0)) * 2) * 0.5;
          const waterPct = Math.round(Math.max(0, Math.min(100, hud.waterPct ?? 0)) * 2) * 0.5;
          if (altPct !== hudCache.altPct) {
            hudCache.altPct = altPct;
            const pctStr = `${altPct}%`;
            if (altFillEl) altFillEl.style.height = pctStr;
            if (altPipEl) altPipEl.style.bottom = pctStr;
          }
          if (waterPct !== hudCache.waterPct) {
            hudCache.waterPct = waterPct;
            if (altWaterEl) altWaterEl.style.height = `${waterPct}%`;
          }
          const sinking = waterPct > 1;
          if (sinking !== hudCache.altSinking) {
            hudCache.altSinking = sinking;
            altMeterEl.classList.toggle('sinking', sinking);
          }
        }
      }

      // 6. Reactor Core Descent Telemetry HUD (dirty-checked)
      const showCoreHud = hud.mode === 'core_descent' && !titleOpen && !cutsceneState.active;
      if (coreDescentHudEl) {
        if (showCoreHud !== hudCache.coreVisible) {
          hudCache.coreVisible = showCoreHud;
          coreDescentHudEl.classList.toggle('hidden', !showCoreHud);
        }
        if (showCoreHud) {
          const cd = game.coreDescent || game.descent || hud.coreDescent || {};
          const locksHit = cd.crystalsSmashed ?? cd.coresSmashed ?? cd.locksBroken ?? hud.coresSmashed ?? 0;
          const locksMax = cd.totalCrystals ?? cd.totalCores ?? cd.totalLocks ?? 3;
          const progPct = Math.round(Math.max(0, Math.min(100, (cd.progress ?? hud.coreProgress ?? hud.depthPct ?? 0) * 100)) * 2) * 0.5;
          const cTitle = 'REACTOR CORE DESCENT';
          const cLocks = `SIPHON LOCKS • ${locksHit}/${locksMax}`;
          const cSub =
            progPct >= 90
              ? 'BEDROCK ANCHOR REACHED • PLANTING HARMONIC SEED!'
              : 'STEER TURBINES • TAIL-WHIP CRYSTAL LOCKS';

          if (coreHudTitleEl && cTitle !== hudCache.coreTitle) {
            hudCache.coreTitle = cTitle;
            coreHudTitleEl.textContent = cTitle;
          }
          if (coreHudLocksEl && cLocks !== hudCache.coreLocks) {
            hudCache.coreLocks = cLocks;
            coreHudLocksEl.textContent = cLocks;
          }
          if (coreDepthFillEl && progPct !== hudCache.corePct) {
            hudCache.corePct = progPct;
            coreDepthFillEl.style.width = `${progPct}%`;
          }
          if (coreHudSubEl && cSub !== hudCache.coreSub) {
            hudCache.coreSub = cSub;
            coreHudSubEl.textContent = cSub;
          }
        }
      }

      const nextAppMode = hud.mode || 'tower';
      if (appEl && nextAppMode !== hudCache.appGameMode) {
        hudCache.appGameMode = nextAppMode;
        appEl.dataset.gameMode = nextAppMode;
      }

      // 7. Aqueduct Sanctum Clue HUD (dirty-checked)
      const isSanctumMode = hud.mode === 'puzzle' || hud.mode === 'aqueduct_sanctum';
      const showPuzzleHud = isSanctumMode && !titleOpen && Boolean(game.puzzleRoom);
      if (puzzleHudEl) {
        if (showPuzzleHud !== hudCache.puzzleVisible) {
          hudCache.puzzleVisible = showPuzzleHud;
          puzzleHudEl.classList.toggle('hidden', !showPuzzleHud);
        }
        if (showPuzzleHud) {
          const pr = game.puzzleRoom;
          let pTitle = 'AQUEDUCT SANCTUM';
          let pSub = 'ROUTE LIVING WATER';
          if (pr.solved) {
            pTitle = 'SANCTUM HARMONIZED';
            pSub = pr.parCleared ? 'PAR MASTERY • +5 PEARLS' : 'HARMONIC SEED UNLOCKED';
          } else if (pr.type === 'lights') {
            pTitle = `WATER TILES • ${pr.moves || 0}/${pr.parMoves || 3}`;
            pSub = 'STEP • MATCH TABLET';
          } else if (pr.type === 'bells') {
            const progCount = pr.bellStep ?? pr.seqIdx ?? pr.progress ?? 0;
            const totalBells = Array.isArray(pr.order) ? pr.order.length : 4;
            pTitle = `HARMONIC BELLS • ${progCount}/${totalBells}`;
            pSub = 'CHIME • CREST ORDER';
          } else if (pr.type === 'beam') {
            pTitle = `CRYSTAL PRISM • ${pr.moves || 0}/${pr.parMoves || 4}`;
            pSub = 'ROTATE • LIGHT SEED';
          } else if (pr.type === 'blocks') {
            pTitle = `SLUICE BLOCKS • ${pr.moves || 0}/${pr.parMoves || 6}`;
            pSub = 'SLIDE • CLEAR CHANNEL';
          } else if (pr.type === 'pipes') {
            pTitle = `PIPE CONDUIT • ${pr.moves || 0}/${pr.parMoves || 6}`;
            pSub = 'ROTATE • CONNECT FLOW';
          } else if (pr.type === 'tide_locks') {
            pTitle = `TIDE LOCKS • ${pr.moves || 0}/${pr.parMoves || 5}`;
            pSub = 'BALANCE • SLUICE CHAMBERS';
          }

          if (puzzleHudTitleEl && pTitle !== hudCache.puzzleTitle) {
            hudCache.puzzleTitle = pTitle;
            puzzleHudTitleEl.textContent = pTitle;
          }
          if (puzzleHudSubEl && pSub !== hudCache.puzzleSub) {
            hudCache.puzzleSub = pSub;
            puzzleHudSubEl.textContent = pSub;
          }

          const canPeekClue =
            !pr.solved &&
            (pr.showTarget === false || ((pr.type === 'lights' || pr.type === 'bells') && pr.showTarget !== true));
          if (btnPeekClue) {
            if (canPeekClue !== hudCache.canPeek) {
              hudCache.canPeek = canPeekClue;
              btnPeekClue.classList.toggle('hidden', !canPeekClue);
            }
            const isPeeking = Boolean((pr.peekAlpha || 0) > 0.25 || pr.isPeekingClue);
            if (isPeeking !== hudCache.isPeeking) {
              hudCache.isPeeking = isPeeking;
              btnPeekClue.classList.toggle('peeking', isPeeking);
              btnPeekClue.classList.toggle('active', isPeeking);
              if (peekClueLblEl) peekClueLblEl.textContent = isPeeking ? 'CLUE LIT' : 'PEEK CLUE';
            }
          }
        }
      }

      // 8. Action Prompt Pill (dirty-checked — zero DOM/regex work unless prompt string changes!)
      if (actionPromptEl) {
        let promptRaw = isSanctumMode ? '' : (hud.actionPrompt || '');
        if (!promptRaw && (hud.mode === 'skimmer' || hud.mode === 'rapids_surf') && (hud.boostMult || 1) > 1) {
          promptRaw = `HYDRO-WAKE ${hud.boostMult}X`;
        }
        const activeMode = !isSanctumMode && hud.mode !== 'title' && !titleOpen && !cutsceneState.active;

        if (promptRaw && activeMode) {
          const nextKey = `${hud.mode}|${hud.interactKind || ''}|${promptRaw}`;
          if (nextKey !== hudCache.promptKey) {
            hudCache.promptKey = nextKey;
            const spec = resolveActionPromptSpec(promptRaw, hud.mode, hud.interactKind);
            actionPromptEl.innerHTML = spec.html;
            currentPromptAction = spec.triggerAction;
            currentPromptSubtype = spec.subtype;

            const isActionable = Boolean(spec.triggerAction);
            const isLocked = spec.subtype === 'locked_crown';
            const shouldShow = Boolean(spec.html);

            if (isActionable !== hudCache.promptActionable) {
              hudCache.promptActionable = isActionable;
              actionPromptEl.classList.toggle('is-actionable', isActionable);
            }
            if (isLocked !== hudCache.promptLocked) {
              hudCache.promptLocked = isLocked;
              actionPromptEl.classList.toggle('is-locked', isLocked);
            }
            if (shouldShow !== hudCache.promptVisible) {
              hudCache.promptVisible = shouldShow;
              actionPromptEl.classList.toggle('hidden', !shouldShow);
            }

            if (hud.mode === 'tower') {
              setInteractContextCached(Boolean(spec.interactKind), spec.interactKind || '');
            } else {
              setInteractContextCached(false, '');
            }
          }
        } else {
          if (hudCache.promptKey || hudCache.promptVisible) {
            hudCache.promptKey = '';
            currentPromptAction = null;
            currentPromptSubtype = '';
            if (hudCache.promptActionable) {
              hudCache.promptActionable = false;
              actionPromptEl.classList.remove('is-actionable');
            }
            if (hudCache.promptLocked) {
              hudCache.promptLocked = false;
              actionPromptEl.classList.remove('is-locked');
            }
            if (hudCache.promptVisible) {
              hudCache.promptVisible = false;
              actionPromptEl.classList.add('hidden');
            }
          }
          if (hud.mode !== 'tower') {
            setInteractContextCached(false, '');
          } else if (!promptRaw && hudCache.interactActive && !isHeroInInteractZone()) {
            setInteractContextCached(false, '');
          }
        }
      }
    },

    onBanner: showBanner,

    onTrophy: enqueueTrophyToast,

    onMutationDraft(choices, onPickCallback) {
      openMutationDraftModal(choices, onPickCallback);
    },

    onSpirePurified(info = {}, onDone = null) {
      const theme = String(info?.theme || info?.biome || game?.tower?.theme || 'canyon_river').toLowerCase();
      const cutKey = STORY_CUTSCENES[`purify_${theme}`] ? `purify_${theme}` : 'purify_canyon_river';
      playStoryCutscene(cutKey, {
        previewMode: false,
        startPct: info?.watershedBefore,
        endPct: info?.watershedAfter,
        onComplete: () => {
          onDone?.();
        },
      });
    },

    onGameOver(victory, score, hiScore, summary = {}) {
      sound.setMusicActive?.(false);
      input.resetState?.();
      setInteractContextCached(false, '');
      resetHudVisibilityCache();
      currentPromptAction = null;
      actionPromptEl?.classList.add('hidden');
      puzzleHudEl?.classList.add('hidden');
      crownSealsPillEl?.classList.add('hidden');
      missionStatusPillEl?.classList.add('hidden');
      altMeterEl?.classList.add('hidden');
      coreDescentHudEl?.classList.add('hidden');

      if (gameoverCardEl) {
        gameoverCardEl.dataset.outcome = victory ? 'victory' : 'defeat';
      }

      const rType = String(game.runType || lastLaunch.mode || 'campaign').toLowerCase();
      if (goBadge) {
        if (victory) {
          goBadge.textContent = rType.includes('daily')
            ? 'DAILY TIDE PURIFIED'
            : rType.includes('gauntlet') || rType.includes('warden')
              ? 'WARDEN GAUNTLET CONQUERED'
              : rType.includes('master')
                ? 'MASTER WATERSHED HEALED'
                : rType.includes('purist')
                  ? 'PURIST GAUNTLET CONQUERED'
                  : rType.includes('expedition')
                    ? 'WATERSHED EXPEDITION COMPLETE'
                    : rType.includes('sanctum')
                      ? 'SANCTUM TRIALS HARMONIZED'
                      : rType.includes('minigame')
                        ? 'CHALLENGE HARMONIZED'
                        : 'EARTH HYDROSPHERE RESTORED';
        } else {
          goBadge.textContent = rType.includes('flood')
            ? 'OVERTAKEN BY THE SURGE'
            : rType.includes('gauntlet') || rType.includes('warden')
              ? 'GAUNTLET RUN ENDED'
              : rType.includes('master')
                ? 'MASTER WATERSHED ENDED'
                : rType.includes('purist')
                  ? 'PURIST RUN ENDED'
                  : 'DESCENT INTERRUPTED';
        }
      }

      if (goTitle) {
        goTitle.textContent = victory ? 'WATERSHED HEALED' : 'RETURN TO SANCTUARY';
      }
      if (goScore) goScore.textContent = Number(score || 0).toLocaleString();
      if (goHi) goHi.textContent = Number(hiScore || 0).toLocaleString();

      if (goStars) {
        if (summary?.stars) {
          goStars.innerHTML = starsToSvgHtml(summary.stars);
        } else if (game.tower?.id) {
          goStars.innerHTML = starsToSvgHtml(getTowerStarsSafe(game.tower.id));
        } else {
          goStars.innerHTML = starsToSvgHtml({ clear: victory, vault: victory, speed: victory });
        }
      }

      const totalGears = progression.getGears?.() ?? 0;
      const earnedGears =
        summary?.gearsEarned != null ? summary.gearsEarned : Math.max(0, totalGears - gearsBeforeRun);
      if (goGears) {
        goGears.innerHTML =
          earnedGears > 0
            ? `${SVG_GEAR}<span>+${earnedGears} (${totalGears})</span>`
            : `${SVG_GEAR}<span>${totalGears}</span>`;
      }
      if (gearsEl) gearsEl.textContent = String(totalGears);

      refreshTitleMeta();

      if (victory && rType.includes('campaign') && !hasSeenCutscene('epilogue')) {
        markCutsceneSeen('epilogue');
        playStoryCutscene('epilogue', {
          previewMode: true,
          onComplete: () => {
            overlayGameOver?.classList.remove('hidden');
            pushNavGuard();
            syncTitleShowcaseState();
          },
        });
      } else {
        overlayGameOver?.classList.remove('hidden');
        pushNavGuard();
        syncTitleShowcaseState();
      }
    },
  },
  progression
);

if (typeof game.loadTower === 'function') {
  const _origLoadTower = game.loadTower.bind(game);
  game.loadTower = (...args) => {
    const res = _origLoadTower(...args);
    resetFrameClock();
    return res;
  };
}

game.applySettings?.(progression.getSettings?.() || {});

// ================= PROGRESSION SAFE HELPERS =================
let _cachedCampaignTowers = null;
function getTowersSafe() {
  if (!_cachedCampaignTowers) {
    const list = createTowers?.('reboot');
    if (Array.isArray(list) && list.length > 0) {
      _cachedCampaignTowers = list;
    }
  }
  return _cachedCampaignTowers || [];
}

function getTowerStarsSafe(towerId) {
  if (typeof progression.getTowerStars === 'function') {
    const res = progression.getTowerStars('reboot', towerId);
    if (res && typeof res === 'object') return res;
    const resDirect = progression.getTowerStars(towerId);
    if (resDirect && typeof resDirect === 'object') return resDirect;
  }
  return { clear: false, vault: false, speed: false, count: 0 };
}

function isSpireUnlocked(towerId) {
  if (!towerId || towerId <= 1) return true;
  return Boolean(getTowerStarsSafe(towerId - 1)?.clear);
}

function computeGlobalWatershedPct() {
  if (typeof progression.getWatershedHealth === 'function') {
    const h = progression.getWatershedHealth();
    if (typeof h === 'number') return Math.max(0, Math.min(100, Math.round(h <= 1 && h > 0 ? h * 100 : h)));
    if (h && typeof h === 'object' && typeof h.global === 'number') {
      return Math.max(0, Math.min(100, Math.round(h.global <= 1 && h.global > 0 ? h.global * 100 : h.global)));
    }
  }
  const towers = getTowersSafe();
  if (towers.length === 0) return 0;
  const cleared = towers.filter((t) => getTowerStarsSafe(t.id)?.clear).length;
  return Math.round((cleared / towers.length) * 100);
}

// ================= TITLE DIORAMA & CHROME VISIBILITY SYNC =================
function isTitleScreenOpen() {
  return Boolean(overlayTitle && !overlayTitle.classList.contains('hidden'));
}

function closeTitleDrawers() {
  titleSettingsDrawer?.classList.add('hidden');
  btnTitleSettings?.setAttribute('aria-expanded', 'false');
  btnTitleSettings?.classList.remove('active');
}

function isAnyModalOpenOnTitle() {
  return (
    Boolean(overlayModes && !overlayModes.classList.contains('hidden')) ||
    Boolean(overlayWorlds && !overlayWorlds.classList.contains('hidden')) ||
    Boolean(overlayWardrobe && !overlayWardrobe.classList.contains('hidden')) ||
    Boolean(overlayTrophies && !overlayTrophies.classList.contains('hidden')) ||
    Boolean(overlayMinigames && !overlayMinigames.classList.contains('hidden')) ||
    Boolean(overlayMutation && !overlayMutation.classList.contains('hidden'))
  );
}

function syncTitleShowcaseState() {
  const titleOpen = isTitleScreenOpen();
  const wardrobeOpen = Boolean(overlayWardrobe && !overlayWardrobe.classList.contains('hidden'));
  const modalOpen = isAnyModalOpenOnTitle();

  if (appEl) {
    appEl.dataset.titleOpen = titleOpen ? 'true' : 'false';
    appEl.dataset.wardrobeOpen = wardrobeOpen ? 'true' : 'false';
    appEl.dataset.cutsceneOpen = cutsceneState.active ? 'true' : 'false';
  }
  game.titleShowcase = titleOpen && !cutsceneState.active;
  game.wardrobeSpotlight = wardrobeOpen && !cutsceneState.active;
  if (!wardrobeOpen) {
    renderer.setBestiaryPreview?.(null);
    renderer.setWardrobePreview?.(null);
  }

  const hideGameplayChrome =
    titleOpen || wardrobeOpen || cutsceneState.active || (modalOpen && game.mode === 'title');
  hudEl?.classList.toggle('hidden', hideGameplayChrome);
  touchControlsEl?.classList.toggle('hidden', hideGameplayChrome);
}

// ================= MOUNT ARTWORK & 3-CHANNEL AUDIO MIXER =================
let artworkMounted = false;
function mountHydroArtwork(force = false) {
  if (artworkMounted && !force) return;
  artworkMounted = true;

  if (titleCrestStageEl && typeof uiArtMod.getTitleCrestSVG === 'function') {
    titleCrestStageEl.innerHTML = uiArtMod.getTitleCrestSVG('canyon_river');
  }
  if (playMedallionSvgEl && typeof uiArtMod.getPlayMedallionSVG === 'function') {
    playMedallionSvgEl.innerHTML = uiArtMod.getPlayMedallionSVG('campaign');
  }
  modeArtSlots.forEach((el) => {
    const modeKey = el.dataset.modeArt || 'campaign';
    if (typeof uiArtMod.getGameModeArtSVG === 'function') {
      el.innerHTML = uiArtMod.getGameModeArtSVG(modeKey);
    }
  });
  portalArtEls.forEach((el) => {
    const gid = el.dataset.portalArt || 'core_descent';
    if (typeof uiArtMod.getMinigamePortalSVG === 'function') {
      el.innerHTML = uiArtMod.getMinigamePortalSVG(gid);
    }
  });
}

function syncAudioMixerUI() {
  const s = progression.getSettings?.() || {};
  const mPct = Math.round((Number.isFinite(s.musicVolume) ? s.musicVolume : 0.78) * 100);
  const aPct = Math.round((Number.isFinite(s.ambienceVolume) ? s.ambienceVolume : 0.82) * 100);
  const xPct = Math.round((Number.isFinite(s.sfxVolume) ? s.sfxVolume : 0.80) * 100);

  if (sliderMusicVol) sliderMusicVol.value = String(mPct);
  if (pauseSliderMusic) pauseSliderMusic.value = String(mPct);
  if (valMusicVol) valMusicVol.textContent = `${mPct}%`;
  if (pauseValMusic) pauseValMusic.textContent = `${mPct}%`;

  if (sliderAmbienceVol) sliderAmbienceVol.value = String(aPct);
  if (pauseSliderAmbience) pauseSliderAmbience.value = String(aPct);
  if (valAmbienceVol) valAmbienceVol.textContent = `${aPct}%`;
  if (pauseValAmbience) pauseValAmbience.textContent = `${aPct}%`;

  if (sliderSfxVol) sliderSfxVol.value = String(xPct);
  if (pauseSliderSfx) pauseSliderSfx.value = String(xPct);
  if (valSfxVol) valSfxVol.textContent = `${xPct}%`;
  if (pauseValSfx) pauseValSfx.textContent = `${xPct}%`;
}

function bindChannelSlider(pairSliders, settingKey, applyFn) {
  pairSliders.forEach((inp) => {
    if (!inp) return;
    inp.addEventListener('input', () => {
      sound.unlock?.();
      const pct = Math.max(0, Math.min(100, Number(inp.value) || 0));
      const norm = pct / 100;
      applyFn(norm);
      progression.updateSettings?.({ [settingKey]: norm });
      syncAudioMixerUI();
    });
  });
}

bindChannelSlider([sliderMusicVol, pauseSliderMusic], 'musicVolume', (v) => sound.setMusicVolume?.(v));
bindChannelSlider([sliderAmbienceVol, pauseSliderAmbience], 'ambienceVolume', (v) => sound.setAmbienceVolume?.(v));
bindChannelSlider([sliderSfxVol, pauseSliderSfx], 'sfxVolume', (v) => sound.setSfxVolume?.(v));

function syncAudioButtons() {
  const soundSvg = sound.muted ? SVG_SOUND_OFF : SVG_SOUND_ON;
  const musicSvg = sound.musicEnabled ? SVG_MUSIC_ON : SVG_MUSIC_OFF;

  if (btnSound) {
    btnSound.innerHTML = soundSvg;
    btnSound.classList.toggle('is-off', Boolean(sound.muted));
  }
  if (btnTitleSound) {
    btnTitleSound.innerHTML = `${soundSvg}<span>${sound.muted ? 'AUDIO OFF' : 'AUDIO ON'}</span>`;
    btnTitleSound.classList.toggle('active', !sound.muted);
  }
  if (btnMusic) {
    btnMusic.innerHTML = musicSvg;
    btnMusic.classList.toggle('is-off', !sound.musicEnabled);
  }
  if (btnTitleMusic) {
    btnTitleMusic.innerHTML = `${musicSvg}<span>${sound.musicEnabled ? 'MUSIC ON' : 'MUSIC OFF'}</span>`;
    btnTitleMusic.classList.toggle('active', Boolean(sound.musicEnabled));
  }
  if (btnTitleVoice) {
    const voiceOn = sound.isVoiceEnabled ? sound.isVoiceEnabled() : sound.voiceEnabled !== false;
    btnTitleVoice.textContent = voiceOn ? 'VOICE ON' : 'VOICE OFF';
    btnTitleVoice.classList.toggle('active', Boolean(voiceOn));
  }
  if (gearsEl) {
    const gStr = String(progression.getGears?.() ?? 0);
    hudCache.gearsText = gStr;
    gearsEl.textContent = gStr;
  }
  if (hiScoreEl) {
    const hiStr = formatScore(progression.getHighScore?.('reboot') ?? 0);
    hudCache.hiScoreText = hiStr;
    hiScoreEl.textContent = hiStr;
  }
  syncAudioMixerUI();
}

function syncZenUI(zenMode) {
  const isZen = Boolean(zenMode);
  if (toggleZenInput) toggleZenInput.checked = isZen;
  if (btnZenPill) {
    btnZenPill.classList.toggle('active', isZen);
    btnZenPill.setAttribute('aria-pressed', String(isZen));
  }
  if (zenPillLabelEl) {
    zenPillLabelEl.textContent = isZen ? 'RELAXED FLOW • ON' : 'RELAXED FLOW • OFF';
  }
}

// ================= LIVE 3D VISTA BIOME PREVIEWER =================
const TITLE_VISTA_BIOMES = [
  { theme: 'canyon_river', label: 'CANYON RIVER', spireIdx: 0 },
  { theme: 'coral_sea', label: 'CORAL SEA', spireIdx: 6 },
  { theme: 'alpine_lake', label: 'ALPINE LAKE', spireIdx: 2 },
  { theme: 'mist_bayou', label: 'MIST BAYOU', spireIdx: 4 },
  { theme: 'storm_ocean', label: 'TEMPEST OCEAN', spireIdx: 8 },
];
let currentVistaIdx = 0;

function updateSelectedTowerRibbon() {
  if (!startTowerSelect) return;
  const towers = getTowersSafe();
  const idx = Math.max(0, Math.min(towers.length - 1, Number(startTowerSelect.value) || 0));
  const tower = towers[idx];
  const stars = tower ? getTowerStarsSafe(tower.id) : null;

  if (selectedTowerStarsEl) selectedTowerStarsEl.innerHTML = starsToSvgHtml(stars);
  if (heroSectorNameEl && tower) {
    heroSectorNameEl.textContent = `S${tower.id} • ${String(tower.name || '').toUpperCase()}`;
  }

  const actNum = Math.floor(idx / 2) + 1;
  const roman = ['I', 'II', 'III', 'IV', 'V'][actNum - 1] || String(actNum);
  const isZen = Boolean(progression.getSettings?.()?.zenMode);

  if (heroPlayKickerEl) {
    heroPlayKickerEl.textContent = `ACT ${roman} • ${isZen ? 'RELAXED FLOW' : "GATEWAY'S DESCENT"}`;
  }
  if (heroPlayLabelEl) {
    heroPlayLabelEl.textContent = 'BEGIN CAMPAIGN';
  }
}

// ================= CUTSCENE & PURIFICATION THEATER ENGINE =================
const CUTSCENE_STORAGE_KEY = 'towering_waters_cutscenes_v1';
const seenCutscenesMem = new Set();
try {
  const rawSeen = localStorage.getItem(CUTSCENE_STORAGE_KEY);
  if (rawSeen) JSON.parse(rawSeen).forEach((k) => seenCutscenesMem.add(k));
} catch (_) {}

function hasSeenCutscene(kind) {
  return seenCutscenesMem.has(kind);
}

function markCutsceneSeen(kind) {
  seenCutscenesMem.add(kind);
  try {
    localStorage.setItem(CUTSCENE_STORAGE_KEY, JSON.stringify([...seenCutscenesMem]));
  } catch (_) {}
}

const cutsceneState = {
  active: false,
  kind: 'prologue',
  beatIdx: 0,
  elapsed: 0,
  cameraDuration: 8.5,
  charIdx: 0,
  fullText: '',
  previewMode: false,
  prevMode: null,
  startPct: null,
  endPct: null,
  onComplete: null,
};

function resolveCutsceneKeyframeSpec(kind, def) {
  const k = String(kind || 'prologue').toLowerCase();
  if (k === 'act5_intro' || k === 'purify_storm_ocean' || k === 'epilogue') {
    return {
      src: './assets/textures/story_keyframe_finale.webp',
      caption: k === 'epilogue' ? 'GLOBAL HYDROSPHERE • 100%' : 'POLAR AURORA • MOTHER SIPHON',
    };
  }
  if (k === 'act2_intro') {
    return {
      src: './assets/textures/story_keyframe_act2.webp',
      caption: 'ACT II • CRYSTAL ALPINE LAKES',
    };
  }
  if (k === 'act3_intro') {
    return {
      src: './assets/textures/story_keyframe_act3.webp',
      caption: 'ACT III • EMERALD MIST BAYOUS',
    };
  }
  if (k === 'act4_intro') {
    return {
      src: './assets/textures/story_keyframe_act4.webp',
      caption: 'ACT IV • SUNLIT CORAL SEAS',
    };
  }
  if (def?.isPurification || k.startsWith('purify_')) {
    return {
      src: './assets/textures/story_keyframe_purification.webp',
      caption: 'CROWN FOUNTAIN PURIFIED',
    };
  }
  return {
    src: './assets/textures/story_keyframe_prologue.webp',
    caption: 'REDWOOD CANYON DESCENT',
  };
}

function renderCutsceneBeat() {
  const def = STORY_CUTSCENES[cutsceneState.kind];
  if (!def) return;
  const beat = def.beats[cutsceneState.beatIdx];
  if (!beat) return;

  if (cutsceneActPillEl) cutsceneActPillEl.textContent = def.act;
  if (cutsceneTitleEl) cutsceneTitleEl.textContent = def.title;
  if (cutsceneCommsBoxEl) cutsceneCommsBoxEl.dataset.speaker = beat.speaker;
  if (cutscenePortraitEl && typeof uiArtMod.getCutscenePortraitSVG === 'function') {
    cutscenePortraitEl.innerHTML = uiArtMod.getCutscenePortraitSVG(beat.speaker);
  }
  if (cutsceneSpeakerEl) cutsceneSpeakerEl.textContent = beat.name;

  const kf = resolveCutsceneKeyframeSpec(cutsceneState.kind, def);
  if (cutsceneKeyframeImgEl && cutsceneKeyframeImgEl.getAttribute('src') !== kf.src) {
    cutsceneKeyframeImgEl.setAttribute('src', kf.src);
  }
  if (cutsceneKeyframeCaptionEl) cutsceneKeyframeCaptionEl.textContent = kf.caption;
  cutsceneKeyframeCardEl?.classList.remove('hidden');

  if (cutsceneRestorationWrapEl) {
    cutsceneRestorationWrapEl.classList.toggle('hidden', !def.isPurification);
    if (def.isPurification && cutsceneRestorationLblEl) {
      cutsceneRestorationLblEl.textContent = def.biomeLabel || 'WATERSHED RESTORATION';
    }
  }

  if (cutsceneStepDotsEl) {
    cutsceneStepDotsEl.innerHTML = def.beats
      .map((_, i) => `<span class="cinema-dot${i === cutsceneState.beatIdx ? ' active' : ''}"></span>`)
      .join('');
  }

  cutsceneState.fullText = beat.text;
  cutsceneState.charIdx = 0;
  cutsceneState.lastCharInt = 0;
  if (cutsceneTextEl) cutsceneTextEl.textContent = '';

  if (btnCutsceneNext) {
    const isLast = cutsceneState.beatIdx >= def.beats.length - 1;
    btnCutsceneNext.textContent = isLast ? 'CONTINUE ›' : 'NEXT ›';
  }
}

function playStoryCutscene(kind, { previewMode = false, startPct = null, endPct = null, onComplete = null } = {}) {
  const def = STORY_CUTSCENES[kind];
  if (!def || !overlayCutscene) {
    onComplete?.();
    return;
  }

  clearBanner();
  closeTitleDrawers();
  // Ensure zero Title / Modal UI bleed behind the live 3D Cutscene Theater!
  overlayTitle?.classList.add('hidden');
  overlayModes?.classList.add('hidden');
  overlayWorlds?.classList.add('hidden');
  overlayWardrobe?.classList.add('hidden');
  overlayTrophies?.classList.add('hidden');
  overlayMinigames?.classList.add('hidden');
  overlayPause?.classList.add('hidden');
  overlayGameOver?.classList.add('hidden');

  input.resetState?.();
  setInteractContextCached(false, '');
  resetHudVisibilityCache();
  actionPromptEl?.classList.add('hidden');
  puzzleHudEl?.classList.add('hidden');
  crownSealsPillEl?.classList.add('hidden');
  missionStatusPillEl?.classList.add('hidden');
  altMeterEl?.classList.add('hidden');
  coreDescentHudEl?.classList.add('hidden');

  cutsceneState.active = true;
  cutsceneState.kind = kind;
  cutsceneState.beatIdx = 0;
  cutsceneState.elapsed = 0;
  cutsceneState.lastPct = -1;
  cutsceneState.lastCharInt = 0;
  cutsceneState.previewMode = previewMode;
  cutsceneState.prevMode = game.mode;
  cutsceneState.startPct = Number.isFinite(startPct) ? startPct : null;
  cutsceneState.endPct = Number.isFinite(endPct) ? endPct : null;
  cutsceneState.onComplete = onComplete;

  if (previewMode) {
    const towers = getTowersSafe();
    const rawT = towers[Math.min(towers.length - 1, def.towerIdx || 0)] || towers[0];
    if (rawT) {
      game.loadTower?.(buildTitlePreviewTower(rawT));
    }
    clearBanner();
    game.mode = 'tower';
    const hero = game.gateway || game.player;
    if (hero) {
      hero.col = 19.25;
      hero.floor = 2;
      hero.onGround = true;
      hero.invuln = 0;
      hero.victory = Boolean(def.isPurification);
      game.camCol = 19.25;
      game.camFloor = 2.85;
    }
  }

  game.purificationProgress = def.isPurification ? 0.1 : 0;
  game.cutsceneCam = { active: true, phase: 0, kind, isPurification: Boolean(def.isPurification) };
  if (def.isPurification) {
    sound.spirePurify?.();
  } else {
    sound.playMenuMusic?.();
  }
  renderCutsceneBeat();
  overlayCutscene.classList.remove('hidden');
  pushNavGuard();
  syncTitleShowcaseState();
}

function finishCutscene() {
  if (!cutsceneState.active) return;
  cutsceneState.active = false;
  game.cutsceneCam = null;
  renderer.setCutsceneCam?.(null);
  const hero = game.gateway || game.player;
  if (hero) hero.victory = false;
  overlayCutscene?.classList.add('hidden');

  if (cutsceneState.previewMode) {
    game.mode = cutsceneState.prevMode || 'title';
  }

  const cb = cutsceneState.onComplete;
  cutsceneState.onComplete = null;
  cb?.();

  if (
    game.mode === 'title' &&
    !isAnyModalOpenOnTitle() &&
    overlayGameOver?.classList.contains('hidden')
  ) {
    overlayTitle?.classList.remove('hidden');
  }
  syncTitleShowcaseState();
  resetFrameClock();
}

function advanceCutsceneStep() {
  if (!cutsceneState.active) return;
  sound.unlock?.();
  if (cutsceneState.charIdx < cutsceneState.fullText.length) {
    cutsceneState.charIdx = cutsceneState.fullText.length;
    if (cutsceneTextEl) cutsceneTextEl.textContent = cutsceneState.fullText;
    sound.switchToggle?.();
    return;
  }

  const def = STORY_CUTSCENES[cutsceneState.kind];
  if (def && cutsceneState.beatIdx < def.beats.length - 1) {
    cutsceneState.beatIdx++;
    sound.switchToggle?.();
    renderCutsceneBeat();
  } else {
    sound.collectStar?.();
    finishCutscene();
  }
}

// ================= SPIRE SELECTOR & LIVE 3D TITLE SHOWCASE =================
let selectedWatershedIdx = 0;

function populateTowerSelect(keepIdx = null) {
  if (!startTowerSelect) return;
  const prevIdx = keepIdx != null ? keepIdx : Number(startTowerSelect.value) || 0;
  const towers = getTowersSafe();
  startTowerSelect.innerHTML = '';
  let highestUnlockedIdx = 0;

  towers.forEach((t, i) => {
    const unlocked = isSpireUnlocked(t.id);
    if (unlocked) highestUnlockedIdx = i;
    const stars = getTowerStarsSafe(t.id);
    const count = stars?.count ?? ((stars?.clear ? 1 : 0) + (stars?.vault ? 1 : 0) + (stars?.speed ? 1 : 0));
    const opt = document.createElement('option');
    opt.value = String(i);
    opt.disabled = !unlocked;
    opt.textContent = unlocked ? `${t.id}. ${t.name} [${count}/3]` : `${t.id}. ${t.name} [LOCKED]`;
    startTowerSelect.appendChild(opt);
  });

  const clampedPrev = Math.max(0, Math.min(Math.max(0, towers.length - 1), prevIdx));
  const chosenIdx = isSpireUnlocked(towers[clampedPrev]?.id) ? clampedPrev : highestUnlockedIdx;
  startTowerSelect.value = String(chosenIdx);
  selectedWatershedIdx = chosenIdx;
  updateSelectedTowerRibbon();
}

function buildTitlePreviewTower(rawTower) {
  if (!rawTower) return null;
  const cleanCols = new Set([18, 19, 0]);
  const baseLedges = (Array.isArray(rawTower.ledges) ? rawTower.ledges : [])
    .filter((l) => !(cleanCols.has(l.col) && l.floor >= 1 && l.floor <= 3 && l.isStair))
    .map((l) => ({ ...l }));
  for (const c of [18, 19, 0]) {
    if (!baseLedges.some((l) => l.floor === 2 && l.col === c && !l.isStair)) {
      baseLedges.push({ col: c, floor: 2, type: 'solid', stairDir: 0 });
    }
  }
  return {
    ...rawTower,
    key: `title_preview_${rawTower.id}`,
    spawn: { col: 19, floor: 2 },
    ledges: baseLedges,
  };
}

function loadTitlePreviewTower(overrideSpireIdx = null) {
  const towers = getTowersSafe();
  const idx =
    overrideSpireIdx != null
      ? Math.max(0, Math.min(Math.max(0, towers.length - 1), overrideSpireIdx))
      : Math.max(0, Math.min(Math.max(0, towers.length - 1), Number(startTowerSelect?.value) || 0));
  updateSelectedTowerRibbon();
  const rawTower = towers[idx];
  if (rawTower) {
    game.loadTower?.(buildTitlePreviewTower(rawTower));
  } else {
    game.loadTower?.(0);
  }
  const hero = game.gateway || game.player;
  if (hero) {
    hero.col = 19.25;
    hero.floor = 2;
    hero.onGround = true;
    hero.invuln = 0;
    hero.blasterFxId = getEquippedHydroFxSafe();
    game.camCol = 19.25;
    game.camFloor = 2.85;
  }
  game.mode = 'title';
  clearBanner();
  syncTitleShowcaseState();
}

function refreshTitleMeta() {
  const pending = progression.drainPendingTrophies?.();
  if (Array.isArray(pending) && pending.length > 0) {
    pending.forEach(enqueueTrophyToast);
  }
  const s = progression.getSettings?.() || {};

  mountHydroArtwork();
  populateTowerSelect();
  syncZenUI(s.zenMode);

  const globalPct = computeGlobalWatershedPct();
  if (titleWatershedPctEl) titleWatershedPctEl.textContent = `${globalPct}% HEALED`;

  const towers = getTowersSafe();
  const unlockedCount = towers.filter((t) => isSpireUnlocked(t.id)).length;
  if (worldsDockBadgeEl) {
    worldsDockBadgeEl.textContent = globalPct > 0 ? `${globalPct}%` : `${unlockedCount}/${towers.length || 10}`;
  }

  // 6 Modes Hub Telemetry
  if (metaModeCampaignEl) metaModeCampaignEl.textContent = `${globalPct}% WATERSHEDS HEALED`;
  if (metaModePuristEl) {
    const pHi = progression.getModeHighScore?.('purist') ?? progression.getHighScore?.('purist') ?? 0;
    metaModePuristEl.textContent = pHi > 0 ? `BEST: ${pHi.toLocaleString()}` : '1-HIT • SIPHON CLOCK';
  }
  if (metaModeFloodEl) {
    const fBest = progression.getBestFloodHeight?.() ?? progression.getBestEndlessDepth?.() ?? 0;
    metaModeFloodEl.textContent = fBest > 0 ? `BEST SURGE: ${fBest}F` : 'ENDLESS RISING SURGE';
  }
  if (metaModeSanctumEl) {
    metaModeSanctumEl.textContent = 'ZERO TIMER • VALVE LOGIC';
  }
  if (metaModeExpeditionEl) {
    const eBest = progression.getBestEndlessDepth?.() ?? 0;
    metaModeExpeditionEl.textContent = eBest > 0 ? `BEST: ${eBest} SPIRES` : '3-CARD BIO-MUTATIONS';
  }
  if (metaModeDailyEl && typeof getDailySeed === 'function') {
    const { dateKey } = getDailySeed(new Date());
    const dailyRec = progression.getDailyRecord?.(dateKey);
    metaModeDailyEl.textContent =
      dailyRec?.completed
        ? `CLEARED • ${dailyRec.bestScore.toLocaleString()}`
        : `${dateKey} • UTC SEED`;
  }
  if (metaModeGauntletEl) {
    const gHi = progression.getModeHighScore?.('warden_gauntlet') ?? 0;
    metaModeGauntletEl.textContent = gHi > 0 ? `BEST: ${gHi.toLocaleString()}` : '5 SOVEREIGN WARDENS';
  }
  if (btnModeGauntlet) {
    btnModeGauntlet.classList.remove('hidden');
  }
  if (metaModeMasterEl) {
    const mHi = progression.getModeHighScore?.('master_watershed') ?? 0;
    metaModeMasterEl.textContent = mHi > 0 ? `BEST: ${mHi.toLocaleString()}` : 'NG+ • 2X PEARL YIELD';
  }
  if (btnModeMaster) {
    btnModeMaster.classList.remove('hidden');
  }

  const unlockedSkinsCount = SKIN_CATALOG.filter((sk) => progression.isSkinUnlocked?.(sk.id)).length;
  if (wardrobeBtnBadge) {
    wardrobeBtnBadge.textContent = `${Math.max(1, unlockedSkinsCount)}/${Math.max(8, SKIN_CATALOG.length)}`;
  }

  const trophyPts = computeTrophyPoints();
  if (trophiesBtnBadge) {
    trophiesBtnBadge.textContent = `${trophyPts} PTS`;
  }

  syncAudioButtons();
}

// ================= CONTROL SCHEME SWITCHING =================
let ctrlHintFreshTimer = null;

async function applyControlMode(mode, fromUserGesture = false) {
  const validMode = CONTROL_MODES.includes(mode) ? mode : 'gesture';
  if (validMode === 'tilt' && fromUserGesture) {
    try {
      await input.requestTiltPermission?.();
      input.calibrateTilt?.();
    } catch (_) {}
  }

  input.setControlMode(validMode);
  if (appEl) appEl.dataset.controlMode = validMode;
  if (touchControlsEl) touchControlsEl.dataset.controlMode = validMode;
  if (document.body) document.body.dataset.controlMode = validMode;
  progression.updateSettings?.({ controlMode: validMode });
  game.applySettings?.(progression.getSettings?.() || {});

  if (selectControlMode) selectControlMode.value = validMode;
  if (pauseControlMode) pauseControlMode.value = validMode;
  if (btnCtrlMode) btnCtrlMode.innerHTML = CTRL_SVGS[validMode] || CTRL_SVGS.gesture;
  if (titleCtrlGlyphEl) titleCtrlGlyphEl.innerHTML = CTRL_SVGS[validMode] || CTRL_SVGS.gesture;
  if (titleCtrlCodeEl) titleCtrlCodeEl.textContent = CTRL_SHORT_CODES[validMode] || 'GESTURE';

  const guideCopy = CTRL_GUIDE_TEXT[validMode] || CTRL_GUIDE_TEXT.gesture;
  if (titleCtrlGuideEl) titleCtrlGuideEl.textContent = guideCopy;
  if (pauseCtrlGuideEl) pauseCtrlGuideEl.textContent = guideCopy;
  if (hudCtrlHintTextEl) hudCtrlHintTextEl.textContent = CTRL_GUIDE_TEXT.gesture;
  if (tiltCtrlHintEl) tiltCtrlHintEl.textContent = CTRL_GUIDE_TEXT.tilt;

  if (fromUserGesture) {
    if (ctrlHintFreshTimer) clearTimeout(ctrlHintFreshTimer);
    hudCtrlHintEl?.classList.toggle('is-fresh', validMode === 'gesture');
    tiltCtrlHintEl?.classList.toggle('is-fresh', validMode === 'tilt');
    ctrlHintFreshTimer = setTimeout(() => {
      ctrlHintFreshTimer = null;
      hudCtrlHintEl?.classList.remove('is-fresh');
      tiltCtrlHintEl?.classList.remove('is-fresh');
    }, 3200);
  }

  titleCtrlPickBtns.forEach((btn) => {
    const active = btn.dataset.ctrlPick === validMode;
    btn.classList.toggle('active', active);
  });

  pauseCtrlPillBtns.forEach((btn) => {
    const active = btn.dataset.pauseCtrl === validMode;
    btn.classList.toggle('active', active);
  });

  btnPauseCalibrate?.classList.toggle('hidden', validMode !== 'tilt');
}

// ================= GATEWAY SANCTUARY, HONORS & WATERSHED ARCHIVES =================
let activeWardrobeTab = 'skins';
let activeTrophyView = 'trophies';
let activeTierFilter = 'all';

function getHydroFxCatalog() {
  const cat = progMod.HYDRO_FX_CATALOG || progMod.BLASTER_FX_CATALOG;
  return Array.isArray(cat) && cat.length > 0 ? cat : FALLBACK_HYDRO_FX;
}

function getWatershedLogsCatalog() {
  const cat = progMod.WATERSHED_LOGS || progMod.RELIC_CODEX;
  return Array.isArray(cat) && cat.length > 0 ? cat : FALLBACK_WATERSHED_LOGS;
}

function getCurioCatalog() {
  return Array.isArray(progMod.CURIO_CATALOG) && progMod.CURIO_CATALOG.length > 0
    ? progMod.CURIO_CATALOG
    : FALLBACK_CURIO_CATALOG;
}

function getEquippedHydroFxSafe() {
  return progression.getEquippedBlasterFx?.() || progression.getSettings?.()?.blasterFxId || 'sea_glass_pulse';
}

const BESTIARY_CATALOG = [
  {
    family: 'snap_crab',
    name: 'Snap-Claw Dredger',
    biome: 'CANYON & ATOLL',
    colors: ['#e07a5f', '#f4a261', '#2dd4bf'],
    tactic: 'Tail-Whip flips it upside-down onto its bronze carapace — bounce off it as a high Hydro-Springboard!',
  },
  {
    family: 'gulp_hopper',
    name: 'Gulp-Hopper Drone',
    biome: 'ALL WATERSHEDS',
    colors: ['#38bdf8', '#7dd3fc', '#fde047'],
    tactic: 'Inhales stolen river water into its glass belly tank before leaping; cast Hydro-Pulse mid-swell to stun.',
  },
  {
    family: 'volt_eel',
    name: 'Conduit Volt-Eel',
    biome: 'ALPINE & STORM',
    colors: ['#22d3ee', '#818cf8', '#f472b6'],
    tactic: '8-segment bio-mechanical moray slithering across wet ledges; leap its arc antennae or deflect with Tail-Whip.',
  },
  {
    family: 'rail_skater',
    name: 'Riptide Rail-Skater',
    biome: 'CANYON & CORAL',
    colors: ['#14b8a6', '#eab308', '#38bdf8'],
    tactic: 'Twin-impeller manta strider patrolling long spire walkways; time a jump or stun-bubble to clear the lane.',
  },
  {
    family: 'barnacle_mortar',
    name: 'Barnacle Geyser-Mortar',
    biome: 'BAYOU & CORAL',
    colors: ['#fb7185', '#f59e0b', '#34d399'],
    tactic: 'Five reef-iron petals flare before launching pressure bubbles — Tail-Whip right back to shatter its lock!',
  },
  {
    family: 'vent_stalker',
    name: 'Thermal Vent-Stalker',
    biome: 'ALPINE & POLAR',
    colors: ['#60a5fa', '#c084fc', '#5efce8'],
    tactic: 'Cryo-steam salamander prowling glacial terraces; watch dorsal vent plumes before striking with Hydro-Pulse.',
  },
  {
    family: 'siphon_warden',
    name: 'Siphon Warden Leviathan',
    biome: 'ACT BOSS • APEX',
    colors: ['#f43f5e', '#f59e0b', '#a855f7'],
    tactic: 'Sovereign Siphon Boss with 4 orbiting Aegis shields — break shields with Hydro-Pulse, then Tail-Whip the core!',
  },
];

const GATEWAY_ANIM_POSES = [
  { id: 'IdleBreathe', label: 'IDLE' },
  { id: 'FluidRun', label: 'RUN' },
  { id: 'TailWhip', label: 'TAIL-WHIP' },
  { id: 'HydroCast', label: 'PULSE' },
  { id: 'FrillGlide', label: 'GLIDE' },
  { id: 'FreeSwim', label: 'SWIM' },
  { id: 'Celebrate', label: 'VICTORY' },
];

const BESTIARY_ANIM_POSES = [
  { id: 'idle', label: 'IDLE' },
  { id: 'taunt', label: 'TAUNT' },
  { id: 'attack', label: 'ATTACK' },
];

const sanctuaryState = {
  yaw: null,
  zoom: 1.0,
  anim: 'IdleBreathe',
  bestiaryFamily: 'snap_crab',
  bestiaryYaw: 0.35,
  bestiaryZoom: 1.0,
  bestiaryAnim: 'idle',
  dragging: false,
  dragStartX: 0,
  dragBaseYaw: 0,
};

function formatPearlCopy(str) {
  return String(str || '')
    .replace(/\bHydro-Gears\b/gi, 'Water Pearls')
    .replace(/\bHydro Gears\b/gi, 'Water Pearls')
    .replace(/\bGears\b/g, 'Water Pearls');
}

function syncSanctuaryTurntable() {
  const wardrobeOpen = Boolean(overlayWardrobe && !overlayWardrobe.classList.contains('hidden'));
  if (!wardrobeOpen) {
    renderer.setBestiaryPreview?.(null);
    renderer.setWardrobePreview?.(null);
    return;
  }
  if (activeWardrobeTab === 'bestiary') {
    renderer.setWardrobePreview?.(null);
    if (renderer.enemyVisuals?.root) renderer.enemyVisuals.root.visible = true;
    renderer.setBestiaryPreview?.({
      active: true,
      family: sanctuaryState.bestiaryFamily,
      yaw: sanctuaryState.bestiaryYaw,
      zoom: sanctuaryState.bestiaryZoom,
      anim: sanctuaryState.bestiaryAnim,
    });
    if (sanctuaryTurntableHintEl) {
      const entry = BESTIARY_CATALOG.find((e) => e.family === sanctuaryState.bestiaryFamily) || BESTIARY_CATALOG[0];
      sanctuaryTurntableHintEl.textContent = `DRAG 360° • ${entry.name.toUpperCase()}`;
    }
  } else {
    renderer.setBestiaryPreview?.(null);
    renderer.setWardrobePreview?.({
      yaw: sanctuaryState.yaw,
      zoom: sanctuaryState.zoom,
      anim: sanctuaryState.anim === 'IdleBreathe' ? null : sanctuaryState.anim,
    });
    if (sanctuaryTurntableHintEl) {
      sanctuaryTurntableHintEl.textContent = 'DRAG TO SPIN 360°';
    }
  }
}

function renderSanctuaryAnimBar() {
  if (!sanctuaryAnimBarEl) return;
  const showBar = activeWardrobeTab === 'skins' || activeWardrobeTab === 'blaster' || activeWardrobeTab === 'bestiary';
  sanctuaryAnimBarEl.classList.toggle('hidden', !showBar);
  if (!showBar) return;

  const isBestiary = activeWardrobeTab === 'bestiary';
  const poses = isBestiary ? BESTIARY_ANIM_POSES : GATEWAY_ANIM_POSES;
  const activePose = isBestiary ? sanctuaryState.bestiaryAnim : sanctuaryState.anim;

  sanctuaryAnimBarEl.innerHTML = '';
  poses.forEach((pose) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `anim-studio-pill${activePose === pose.id ? ' active' : ''}`;
    btn.textContent = pose.label;
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      sound.unlock?.();
      sound.switchToggle?.();
      if (isBestiary) {
        sanctuaryState.bestiaryAnim = pose.id;
        if (pose.id !== 'idle') {
          renderer.enemyVisuals?.triggerBestiaryFlourish?.(pose.id);
        }
      } else {
        sanctuaryState.anim = pose.id;
      }
      syncSanctuaryTurntable();
      renderSanctuaryAnimBar();
    });
    sanctuaryAnimBarEl.appendChild(btn);
  });
}

function syncWardrobeTabsUI() {
  if (overlayWardrobe) {
    overlayWardrobe.dataset.sanctuaryTab = activeWardrobeTab;
  }
  wardrobeTabBtns.forEach((btn) => {
    const active = btn.dataset.wardrobeTab === activeWardrobeTab;
    btn.classList.toggle('active', active);
    btn.setAttribute('aria-selected', String(active));
  });
  wardrobeGridEl?.classList.toggle('hidden', activeWardrobeTab !== 'skins');
  blasterFxGridEl?.classList.toggle('hidden', activeWardrobeTab !== 'blaster');
  skillTreeGridEl?.classList.toggle('hidden', activeWardrobeTab !== 'skills');
  bestiaryPanelEl?.classList.toggle('hidden', activeWardrobeTab !== 'bestiary');
  crittersGridEl?.classList.toggle('hidden', activeWardrobeTab !== 'critters');
  syncSanctuaryTurntable();
  renderSanctuaryAnimBar();
}

function renderSkillTreePanel() {
  if (!skillTreeGridEl) return;
  const catalog = Array.isArray(progMod.SKILL_TREE) ? progMod.SKILL_TREE : [];
  const gears = progression.getGears?.() ?? 0;
  const totalRanks = progression.getTotalSkillRanks?.() ?? 0;
  const maxTotalRanks = catalog.reduce((s, sk) => s + (sk.maxRank || 3), 0);
  if (wardrobeSkillsTabLbl) {
    wardrobeSkillsTabLbl.textContent = `SKILLS (${totalRanks}/${maxTotalRanks || 36})`;
  }

  const branches = [
    { key: 'agility', title: 'PELAGIAN AGILITY' },
    { key: 'combat', title: 'HYDRO-COMBAT' },
    { key: 'watershed', title: 'WATERSHED MASTERY' },
  ];

  skillTreeGridEl.innerHTML = '';
  const notice = document.createElement('div');
  notice.className = 'skill-tree-notice';
  notice.textContent = 'Spend Water Pearls to permanently evolve Gateway across Campaign, Expedition & Mini-Games (disabled in Purist Arcade).';
  skillTreeGridEl.appendChild(notice);

  branches.forEach((br) => {
    const nodes = catalog.filter((sk) => sk.branch === br.key);
    if (nodes.length === 0) return;
    const grp = document.createElement('div');
    grp.className = 'skill-branch-group';
    const head = document.createElement('div');
    head.className = 'skill-branch-head';
    head.textContent = br.title;
    grp.appendChild(head);

    const row = document.createElement('div');
    row.className = 'skill-branch-nodes';
    nodes.forEach((sk) => {
      const rank = progression.getSkillRank?.(sk.id) ?? 0;
      const maxRank = sk.maxRank || 3;
      const maxed = rank >= maxRank;
      const nextCost = maxed ? 0 : (progression.getSkillUpgradeCost?.(sk.id) ?? sk.costs?.[rank] ?? 25);
      const affordable = !maxed && gears >= nextCost;

      const card = document.createElement('button');
      card.type = 'button';
      card.className = `skill-node-card${maxed ? ' maxed' : ''}${affordable ? ' affordable' : ''}`;
      const pipsHtml = Array.from({ length: maxRank }, (_, i) => `<span class="skill-pip${i < rank ? ' on' : ''}"></span>`).join('');
      card.innerHTML = `
        <div class="skill-node-top">
          <span class="skill-node-name">${sk.name}</span>
          <span class="skill-rank-pips">${pipsHtml}</span>
        </div>
        <div class="skill-node-desc">${sk.shortDesc || sk.description || ''}</div>
        <div class="skill-node-foot">
          <span>RANK ${rank}/${maxRank}</span>
          <span>${maxed ? 'MAXED' : `UPGRADE • ${nextCost} PEARLS`}</span>
        </div>
      `;
      card.addEventListener('click', () => {
        sound.unlock?.();
        if (maxed) return;
        const res = progression.upgradeSkill?.(sk.id);
        if (res && res.upgraded !== false && res !== false) {
          sound.collectStar?.();
          renderWardrobeModal();
          refreshTitleMeta();
        } else {
          sound.vaultFail?.();
        }
      });
      row.appendChild(card);
    });
    grp.appendChild(row);
    skillTreeGridEl.appendChild(grp);
  });
}

function renderBestiaryPanel() {
  if (!bestiaryGridEl) return;
  if (wardrobeBestiaryTabLbl) {
    wardrobeBestiaryTabLbl.textContent = `BESTIARY (${BESTIARY_CATALOG.length})`;
  }
  const activeEntry = BESTIARY_CATALOG.find((e) => e.family === sanctuaryState.bestiaryFamily) || BESTIARY_CATALOG[0];
  if (bestiaryDetailStripEl && activeEntry) {
    bestiaryDetailStripEl.innerHTML = `<strong>${activeEntry.name}</strong> • ${activeEntry.biome} — ${activeEntry.tactic}`;
  }

  bestiaryGridEl.innerHTML = '';
  BESTIARY_CATALOG.forEach((entry) => {
    const selected = entry.family === sanctuaryState.bestiaryFamily;
    const [c1, c2, c3] = entry.colors;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `skin-card${selected ? ' equipped' : ''}`;
    btn.innerHTML = `
      <div class="skin-top-row">
        <span class="skin-swatch" style="background: linear-gradient(135deg, ${c1} 0%, ${c2} 55%, ${c3} 100%);"></span>
        <span class="skin-name">${entry.name}</span>
      </div>
      <div class="skin-desc">${entry.biome}</div>
      <span class="skin-action-tag">${selected ? 'INSPECTING 3D' : 'INSPECT 3D'}</span>
    `;
    btn.addEventListener('click', () => {
      sound.unlock?.();
      sound.switchToggle?.();
      sanctuaryState.bestiaryFamily = entry.family;
      sanctuaryState.bestiaryYaw = 0.35;
      sanctuaryState.bestiaryAnim = 'taunt';
      syncSanctuaryTurntable();
      renderer.enemyVisuals?.triggerBestiaryFlourish?.('taunt');
      renderBestiaryPanel();
      renderSanctuaryAnimBar();
    });
    bestiaryGridEl.appendChild(btn);
  });
}

function renderCrittersPanel() {
  if (!crittersGridEl) return;
  const catalog = Array.isArray(progMod.CRITTER_CATALOG) ? progMod.CRITTER_CATALOG : [];
  const rescuedTotal = catalog.filter((c) => progression.isCritterRescued?.(c.id)).length;
  if (wardrobeCrittersTabLbl) {
    wardrobeCrittersTabLbl.textContent = `CRITTERS (${rescuedTotal}/${catalog.length || 30})`;
  }

  const groups = [
    { biome: 'canyon_river', title: 'ACT I • RIVER OTTERS' },
    { biome: 'alpine_lake', title: 'ACT II • ALPINE NEWTS' },
    { biome: 'mist_bayou', title: 'ACT III • BAYOU AXOLOTLS' },
    { biome: 'coral_sea', title: 'ACT IV • SEA TURTLES' },
    { biome: 'storm_ocean', title: 'ACT V • POLAR PUFFINS' },
  ];

  crittersGridEl.innerHTML = '';
  groups.forEach((g) => {
    const items = catalog.filter((c) => c.biome === g.biome);
    if (items.length === 0) return;
    const rescuedInBiome = items.filter((c) => progression.isCritterRescued?.(c.id)).length;
    const box = document.createElement('div');
    box.className = 'critter-biome-group';
    box.innerHTML = `
      <div class="critter-biome-head">
        <span>${g.title}</span>
        <span>${rescuedInBiome}/${items.length}</span>
      </div>
      <div class="critter-pips-row">
        ${items
          .map((c) => {
            const ok = Boolean(progression.isCritterRescued?.(c.id));
            return `<div class="critter-chip${ok ? ' rescued' : ''}" title="${ok ? c.lore : 'Hidden along Campaign Spire ' + c.towerId}">${ok ? c.name : `Spire ${c.towerId} • Hidden`}</div>`;
          })
          .join('')}
      </div>
    `;
    crittersGridEl.appendChild(box);
  });
}

function renderWardrobeModal() {
  const gears = progression.getGears?.() ?? 0;
  const equippedSkin = progression.getEquippedSkin?.();
  const equippedFx = getEquippedHydroFxSafe();
  const trophyPts = computeTrophyPoints();
  const fxCatalog = getHydroFxCatalog();

  if (wardrobeGearsEl) wardrobeGearsEl.textContent = String(gears);

  const unlockedSkins = SKIN_CATALOG.filter((s) => progression.isSkinUnlocked?.(s.id)).length;
  if (wardrobeSkinsTabLbl) wardrobeSkinsTabLbl.textContent = `SKINS (${unlockedSkins}/${SKIN_CATALOG.length})`;
  if (wardrobeBlasterTabLbl) wardrobeBlasterTabLbl.textContent = `PULSE (${fxCatalog.length})`;

  syncWardrobeTabsUI();

  if (wardrobeGridEl) {
    wardrobeGridEl.innerHTML = '';
    SKIN_CATALOG.forEach((skin) => {
      const unlocked = Boolean(progression.isSkinUnlocked?.(skin.id));
      const isEquipped = equippedSkin === skin.id;
      const [c1, c2, c3] = skin.previewColors || ['#14b8a6', '#99f6e4', '#38bdf8'];

      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `skin-card${isEquipped ? ' equipped' : ''}${!unlocked ? ' locked' : ''}`;

      let actionMarkup = '<span>EQUIP</span>';
      if (isEquipped) actionMarkup = '<span>EQUIPPED</span>';
      else if (!unlocked) {
        actionMarkup =
          skin.gearCost > 0
            ? `<span>UNLOCK</span>${SVG_GEAR}<span>${skin.gearCost}</span>`
            : `<span>${formatPearlCopy(skin.milestoneText || 'MILESTONE')}</span>`;
      }

      btn.innerHTML = `
        <div class="skin-top-row">
          <span class="skin-swatch" style="background: linear-gradient(135deg, ${c1} 0%, ${c2} 55%, ${c3} 100%);"></span>
          <span class="skin-name">${skin.name}</span>
        </div>
        <div class="skin-desc">${formatPearlCopy(unlocked ? skin.description : (skin.milestoneText || skin.description))}</div>
        <span class="skin-action-tag">${actionMarkup}</span>
      `;

      btn.addEventListener('click', () => {
        sound.unlock?.();
        if (unlocked) {
          progression.equipSkin?.(skin.id);
          renderer.setSkin?.(skin.id);
          const hero = game.gateway || game.player;
          if (hero) hero.skinId = skin.id;
          sound.switchToggle?.();
          renderWardrobeModal();
          refreshTitleMeta();
        } else if (skin.gearCost > 0) {
          const res = progression.unlockSkin?.(skin.id, true);
          if (res && res.unlocked) {
            progression.equipSkin?.(skin.id);
            renderer.setSkin?.(skin.id);
            const hero = game.gateway || game.player;
            if (hero) hero.skinId = skin.id;
            sound.collectStar?.();
            renderWardrobeModal();
            refreshTitleMeta();
          } else {
            sound.vaultFail?.();
          }
        }
      });
      wardrobeGridEl.appendChild(btn);
    });
  }

  if (blasterFxGridEl) {
    blasterFxGridEl.innerHTML = '';
    fxCatalog.forEach((fx) => {
      const reqPts = fx.pointsRequired ?? fx.minPoints ?? 0;
      const unlocked = Boolean(progression.isBlasterFxUnlocked?.(fx.id) ?? (trophyPts >= reqPts || reqPts === 0));
      const isEquipped = equippedFx === fx.id;
      const colors = fx.previewColors || ['#5efce8', '#ffffff', '#38bdf8'];
      const gearCost = fx.gearCost ?? 0;

      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `skin-card${isEquipped ? ' equipped' : ''}${!unlocked ? ' locked' : ''}`;

      let actionMarkup = '<span>EQUIP FX</span>';
      if (isEquipped) actionMarkup = '<span>EQUIPPED</span>';
      else if (!unlocked) {
        actionMarkup = gearCost > 0 ? `<span>${reqPts}P OR</span>${SVG_GEAR}<span>${gearCost}</span>` : `<span>${reqPts} PTS</span>`;
      }

      btn.innerHTML = `
        <div class="skin-top-row">
          <span class="skin-swatch" style="background: linear-gradient(135deg, ${colors[0]} 0%, ${colors[1]} 50%, ${colors[2] || colors[0]} 100%);">${SVG_BLASTER}</span>
          <span class="skin-name">${fx.name}</span>
        </div>
        <div class="skin-desc">${formatPearlCopy(fx.description || '')}</div>
        <span class="skin-action-tag">${actionMarkup}</span>
      `;

      const applyFx = (fxId) => {
        progression.equipBlasterFx?.(fxId);
        progression.updateSettings?.({ blasterFxId: fxId });
        renderer.setBlasterFx?.(fxId);
        const hero = game.gateway || game.player;
        if (hero) {
          hero.blasterFxId = fxId;
          hero.muzzleFlash = 0.25;
        }
      };

      btn.addEventListener('click', () => {
        sound.unlock?.();
        if (unlocked) {
          applyFx(fx.id);
          sound.switchToggle?.();
          renderWardrobeModal();
        } else if (gearCost > 0) {
          const res = progression.unlockBlasterFx?.(fx.id, true);
          if (res === true || res?.unlocked) {
            applyFx(fx.id);
            sound.collectStar?.();
            renderWardrobeModal();
            refreshTitleMeta();
          } else {
            sound.vaultFail?.();
          }
        }
      });
      blasterFxGridEl.appendChild(btn);
    });
  }

  renderSkillTreePanel();
  renderBestiaryPanel();
  renderCrittersPanel();
}

function syncTrophyViewTabsUI() {
  trophyViewTabBtns.forEach((btn) => {
    const active = btn.dataset.trophyView === activeTrophyView;
    btn.classList.toggle('active', active);
  });
  trophyTierFiltersEl?.classList.toggle('hidden', activeTrophyView !== 'trophies');
  trophiesGridEl?.classList.toggle('hidden', activeTrophyView !== 'trophies');
  relicCodexListEl?.classList.toggle('hidden', activeTrophyView !== 'relics');
  curioCodexListEl?.classList.toggle('hidden', activeTrophyView !== 'curios');
}

function renderTrophiesModal() {
  const towers = getTowersSafe();
  const maxStars = Math.max(30, towers.length * 3);
  const totalStars = progression.getTotalStars?.('reboot') ?? progression.getTotalStars?.() ?? 0;
  if (totalStarsDisplayEl) {
    totalStarsDisplayEl.innerHTML = `${SVG_STAR_ON}<span>${totalStars} / ${maxStars}</span>`;
  }

  const pts = computeTrophyPoints();
  const maxPts = TROPHIES.reduce((s, t) => s + (t.points || 5), 0) || 1000;
  const unlockedTotal = TROPHIES.filter((t) => progression.isTrophyUnlocked?.(t.id)).length;

  if (trophyRankLblEl) trophyRankLblEl.textContent = `RANK • ${getRankTitleForPoints(pts)}`;
  if (trophyPtsDisplayEl) trophyPtsDisplayEl.textContent = `${pts.toLocaleString()} / ${maxPts.toLocaleString()} PTS (${unlockedTotal}/${TROPHIES.length})`;
  if (trophyPtsFillEl) trophyPtsFillEl.style.width = `${Math.min(100, (pts / Math.max(1, maxPts)) * 100).toFixed(1)}%`;

  const logs = getWatershedLogsCatalog();
  const collectedLogs = new Set(progression.getCollectedRelics?.() || []);
  const logsCount = logs.filter((r) => collectedLogs.has(r.id) || progression.isRelicCollected?.(r.id)).length;

  const curios = getCurioCatalog();
  const collectedCurios = new Set(progression.getCollectedCurios?.() || []);
  const curioCount = curios.filter((c) => collectedCurios.has(c.id) || progression.isCurioCollected?.(c.id)).length;

  if (trophiesViewTabLbl) trophiesViewTabLbl.textContent = `HONORS (${unlockedTotal}/${TROPHIES.length})`;
  if (relicsViewTabLbl) relicsViewTabLbl.textContent = `LOGS (${logsCount}/${logs.length})`;
  if (curiosViewTabLbl) curiosViewTabLbl.textContent = `CURIOS (${curioCount}/${curios.length})`;

  syncTrophyViewTabsUI();

  if (trophiesGridEl) {
    trophiesGridEl.innerHTML = '';
    TROPHIES.forEach((t) => {
      const tier = t.tier || 'aluminum';
      if (activeTierFilter !== 'all' && tier !== activeTierFilter) return;
      const unlocked = Boolean(progression.isTrophyUnlocked?.(t.id));
      const tPts = t.points || 5;
      const shieldSvg = typeof uiArtMod.getTrophyShieldSVG === 'function' ? uiArtMod.getTrophyShieldSVG(tier, unlocked) : '';

      const card = document.createElement('div');
      card.className = `trophy-card tier-${tier} ${unlocked ? 'unlocked' : 'locked'}`;
      card.innerHTML = `
        <span class="trophy-shield-wrap">${shieldSvg}</span>
        <div class="trophy-body">
          <div class="trophy-top-line">
            <span class="trophy-title">${t.title}</span>
            <span class="trophy-pts-tag">+${tPts}</span>
          </div>
          <div class="trophy-desc">${t.description}</div>
        </div>
      `;
      trophiesGridEl.appendChild(card);
    });
  }

  if (relicCodexListEl) {
    relicCodexListEl.innerHTML = '';
    logs.forEach((r, idx) => {
      const found = collectedLogs.has(r.id) || Boolean(progression.isRelicCollected?.(r.id));
      const spireNum = r.towerId || idx + 1;
      const card = document.createElement('div');
      card.className = `relic-card ${found ? 'unlocked' : 'locked'}`;
      card.innerHTML = `
        <span class="relic-icon-box">${found ? SVG_RELIC : SVG_LOCK}</span>
        <div>
          <div class="relic-meta">${found ? `WATERSHED RECORD • SPIRE ${spireNum}` : `SEALED RECORD • SPIRE ${spireNum}`}</div>
          <div class="relic-title">${found ? (r.title || r.name) : `UNRECOVERED WATERSHED TABLET #${String(spireNum).padStart(2, '0')}`}</div>
          <div class="relic-lore">${found ? (r.lore || r.description || '') : `Explore Spire ${spireNum} in Story Campaign to recover Naiad’s hydrological field tablet.`}</div>
        </div>
      `;
      relicCodexListEl.appendChild(card);
    });
  }

  if (curioCodexListEl) {
    curioCodexListEl.innerHTML = '';
    curios.forEach((c, idx) => {
      const found = collectedCurios.has(c.id) || Boolean(progression.isCurioCollected?.(c.id));
      const card = document.createElement('div');
      card.className = `relic-card ${found ? 'unlocked' : 'locked'}`;
      card.innerHTML = `
        <span class="relic-icon-box">${found ? SVG_CURIO : SVG_LOCK}</span>
        <div>
          <div class="relic-meta">${found ? 'SANCTUARY CURIO • CATALOGED' : 'UNDISCOVERED SANCTUARY CURIO'}</div>
          <div class="relic-title">${found ? (c.title || c.name) : `HIDDEN CURIO #${String(idx + 1).padStart(2, '0')}`}</div>
          <div class="relic-lore">${found ? (c.lore || c.description || '') : 'Rescue trapped reef & river fauna or solve Aqueduct Sanctum Trials to catalog this curio.'}</div>
        </div>
      `;
      curioCodexListEl.appendChild(card);
    });
  }
}

// ================= INTERACTIVE LIVING WORLD WATERSHED MAP =================
function renderWorldsModal() {
  if (!worldsMapListEl) return;
  const towers = getTowersSafe();
  const maxStars = Math.max(24, towers.length * 3);
  const totalStars = progression.getTotalStars?.('reboot') ?? progression.getTotalStars?.() ?? 0;
  const collectedLogs = new Set(progression.getCollectedRelics?.() || []);

  if (worldsStarsPillEl) {
    worldsStarsPillEl.innerHTML = `${SVG_STAR_ON}<span>${totalStars} / ${maxStars}</span>`;
  }

  selectedWatershedIdx = Math.max(0, Math.min(Math.max(0, towers.length - 1), selectedWatershedIdx));

  const mapOpts = {
    towers,
    selectedIdx: selectedWatershedIdx,
    isTowerUnlocked: (idx, t) => isSpireUnlocked(t?.id ?? idx + 1),
    getStars: (idx, t) => getTowerStarsSafe(t?.id ?? idx + 1),
    getActRestoration: (actIdx) => {
      if (typeof progression.getWatershedHealth === 'function') {
        const h = progression.getWatershedHealth(actIdx);
        if (typeof h === 'number') return h <= 1 && h > 0 ? h * 100 : h;
      }
      const sA = getTowerStarsSafe(actIdx * 2 + 1)?.clear ? 50 : 0;
      const sB = getTowerStarsSafe(actIdx * 2 + 2)?.clear ? 50 : 0;
      return sA + sB;
    },
    isRelicFound: (idx, t) => {
      const tid = t?.id ?? idx + 1;
      return collectedLogs.has(`log_s${tid}`) || collectedLogs.has(`relic_t${tid}`) || Boolean(progression.isRelicCollected?.(`log_s${tid}`));
    },
    isCutsceneUnlocked: (cutKey, idx) => {
      if (!cutKey) return false;
      if (cutKey === 'epilogue') return Boolean(getTowerStarsSafe(towers.length || 10)?.clear) || hasSeenCutscene('epilogue');
      return isSpireUnlocked(idx + 1) || hasSeenCutscene(cutKey);
    },
    onSelectTower: (idx) => {
      sound.unlock?.();
      sound.switchToggle?.();
      selectedWatershedIdx = idx;
      if (startTowerSelect && isSpireUnlocked(towers[idx]?.id)) {
        startTowerSelect.value = String(idx);
        loadTitlePreviewTower();
      }
    },
    onDeployTower: (idx) => {
      sound.unlock?.();
      if (!isSpireUnlocked(towers[idx]?.id)) {
        sound.vaultFail?.();
        return;
      }
      if (startTowerSelect) startTowerSelect.value = String(idx);
      launchGameMode('campaign', { startTowerIdx: idx });
    },
    onPlayCutscene: (cutKey) => {
      sound.unlock?.();
      if (!STORY_CUTSCENES[cutKey]) return;
      overlayWorlds?.classList.add('hidden');
      markCutsceneSeen(cutKey);
      playStoryCutscene(cutKey, {
        previewMode: true,
        onComplete: () => {
          loadTitlePreviewTower();
          renderWorldsModal();
          overlayWorlds?.classList.remove('hidden');
          syncTitleShowcaseState();
        },
      });
    },
    onPlayRoute: (routeMode) => {
      if (routeMode) launchMiniGameRun(routeMode);
    },
  };

  worldsMapListEl.innerHTML = '';
  uiArtMod.renderWatershedWorldMap?.(worldsMapListEl, mapOpts);
}

// ================= 6 GAME MODES & 5 MINI-GAMES LAUNCHERS =================
function hideAllOverlays() {
  closeTitleDrawers();
  overlayTitle?.classList.add('hidden');
  overlayModes?.classList.add('hidden');
  overlayWorlds?.classList.add('hidden');
  overlayWardrobe?.classList.add('hidden');
  overlayTrophies?.classList.add('hidden');
  overlayMinigames?.classList.add('hidden');
  overlayMutation?.classList.add('hidden');
  overlayPause?.classList.add('hidden');
  overlayGameOver?.classList.add('hidden');
  overlayCutscene?.classList.add('hidden');
  syncTitleShowcaseState();
}

function beginRunCommon() {
  sound.unlock?.();
  if (cutsceneState.active) {
    cutsceneState.active = false;
    game.cutsceneCam = null;
    renderer.setCutsceneCam?.(null);
  }
  hideAllOverlays();
  resetHudVisibilityCache();
  crownSealsPillEl?.classList.add('hidden');
  puzzleHudEl?.classList.add('hidden');
  coreDescentHudEl?.classList.add('hidden');
  input.resetState?.();
  setInteractContextCached(false, '');
  game.applySettings?.({ ...(progression.getSettings?.() || {}), blasterFxId: getEquippedHydroFxSafe() });
  gearsBeforeRun = progression.getGears?.() ?? 0;
  pushNavGuard();
}

const prestagedModeRuns = {
  flood_rush: { seed: (Date.now() >>> 0) || 1337, tower: null },
  expedition: { seed: ((Date.now() + 7919) >>> 0) || 4242, tower: null },
  dailyDate: new Date(),
  dailyDateKey: '',
  dailyTower: null,
  sanctum0: null,
  gauntlet0: null,
  warmedPropVer: -1,
  timerId: null,
};

function rotatePrestagedEndlessSeeds(whichMode = null) {
  if (!whichMode || whichMode === 'flood_rush') {
    prestagedModeRuns.flood_rush.seed = ((prestagedModeRuns.flood_rush.seed + 104729) >>> 0) || 1337;
    prestagedModeRuns.flood_rush.tower = null;
  }
  if (!whichMode || whichMode === 'expedition') {
    prestagedModeRuns.expedition.seed = ((prestagedModeRuns.expedition.seed + 1299709) >>> 0) || 4242;
    prestagedModeRuns.expedition.tower = null;
  }
  prestagedModeRuns.warmedPropVer = -1;
}

function scheduleModeSpiresPrewarm() {
  const targetVer = renderer?._archPropsVersion ?? 0;
  if (prestagedModeRuns.warmedPropVer === targetVer) return;
  if (prestagedModeRuns.timerId != null) {
    clearTimeout(prestagedModeRuns.timerId);
    prestagedModeRuns.timerId = null;
  }

  let step = 0;
  const warmedGroups = [];

  const getStepTower = (sIdx) => {
    if (sIdx === 0) {
      // Step 0: Daily Tide FIRST so cold storm_ocean / daily launch is instant!
      const now = new Date();
      const dk = typeof getDailySeed === 'function' ? getDailySeed(now).dateKey : '';
      if (!prestagedModeRuns.dailyTower || prestagedModeRuns.dailyDateKey !== dk) {
        prestagedModeRuns.dailyDate = now;
        prestagedModeRuns.dailyDateKey = dk;
        prestagedModeRuns.dailyTower = typeof createDailyTower === 'function' ? createDailyTower(now) : null;
      }
      return prestagedModeRuns.dailyTower;
    }
    if (sIdx === 1) {
      // Step 1: Flood Rush
      if (!prestagedModeRuns.flood_rush.tower && typeof generateProceduralTower === 'function') {
        prestagedModeRuns.flood_rush.tower = generateProceduralTower({
          seed: (prestagedModeRuns.flood_rush.seed + 101) >>> 0,
          index: 1,
          difficulty: 1.2,
          modeHint: 'flood_rush',
        });
      }
      return prestagedModeRuns.flood_rush.tower;
    }
    if (sIdx === 2) {
      // Step 2: Expedition
      if (!prestagedModeRuns.expedition.tower && typeof generateProceduralTower === 'function') {
        prestagedModeRuns.expedition.tower = generateProceduralTower({
          seed: (prestagedModeRuns.expedition.seed + 509) >>> 0,
          index: 1,
          difficulty: 1.1,
          modeHint: 'expedition',
        });
      }
      return prestagedModeRuns.expedition.tower;
    }
    if (sIdx === 3) {
      // Step 3: Spire 1 (covers campaign, purist & master_watershed)
      return getTowersSafe()[0] || null;
    }
    if (sIdx === 4) {
      // Step 4: Sanctum 1
      if (!prestagedModeRuns.sanctum0 && typeof createSanctumTowers === 'function') {
        prestagedModeRuns.sanctum0 = createSanctumTowers(15)?.[0] || null;
      }
      return prestagedModeRuns.sanctum0;
    }
    if (sIdx === 5) {
      // Step 5: Warden Gauntlet Act 1
      if (!prestagedModeRuns.gauntlet0 && typeof createWardenGauntletTowers === 'function') {
        prestagedModeRuns.gauntlet0 = createWardenGauntletTowers()?.[0] || null;
      }
      return prestagedModeRuns.gauntlet0;
    }
    return null;
  };

  const runNextSlice = () => {
    prestagedModeRuns.timerId = null;
    // Never abort mid-prewarm if game.mode changes; advance immediately past already-cached towers!
    while (step <= 5) {
      let builtNew = false;
      try {
        const tw = getStepTower(step);
        if (tw) {
          const alreadyCached = Boolean(renderer.hasCachedTowerGroup?.(tw));
          const c = renderer.prewarmTowerGroup?.(tw, false);
          if (c?.group) warmedGroups.push(c.group);
          builtNew = !alreadyCached;
        }
      } catch (_) {}
      step++;
      if (step > 5) {
        try {
          renderer.compileTowerGroups?.(warmedGroups);
          prestagedModeRuns.warmedPropVer = renderer?._archPropsVersion ?? 0;
          resetFrameClock();
        } catch (_) {}
        return;
      }
      if (builtNew) {
        prestagedModeRuns.timerId = setTimeout(runNextSlice, 2);
        return;
      }
    }
  };

  prestagedModeRuns.timerId = setTimeout(runNextSlice, 2);
}

renderer.onArchGlbsReady = () => {
  prestagedModeRuns.warmedPropVer = -1;
  scheduleModeSpiresPrewarm();
};

function launchGameMode(modeId = 'campaign', extraOpts = {}) {
  const mode = String(modeId || 'campaign').toLowerCase();
  const s = progression.getSettings?.() || {};
  const zenMode = Boolean(toggleZenInput ? toggleZenInput.checked : s.zenMode);
  const towers = getTowersSafe();
  let towerIdx =
    extraOpts.startTowerIdx != null
      ? extraOpts.startTowerIdx
      : Math.max(0, Math.min(Math.max(0, towers.length - 1), Number(startTowerSelect?.value) || 0));

  if (mode === 'campaign') {
    while (towerIdx > 0 && !isSpireUnlocked(towers[towerIdx]?.id)) {
      towerIdx--;
    }
  }

  const startActual = () => {
    beginRunCommon();
    lastLaunch = { mode, towerIdx, zenMode, miniGame: 'core_descent' };

    const chosenSeed =
      extraOpts.seed != null
        ? extraOpts.seed
        : mode === 'flood_rush'
          ? prestagedModeRuns.flood_rush.seed
          : mode === 'expedition'
            ? prestagedModeRuns.expedition.seed
            : Date.now();
    const chosenDate =
      extraOpts.date != null
        ? extraOpts.date
        : mode === 'daily_tide' && prestagedModeRuns.dailyDate
          ? prestagedModeRuns.dailyDate
          : new Date();

    if (typeof game.startGame === 'function') {
      game.startGame(mode, {
        startTowerIdx: towerIdx,
        zenMode: mode === 'campaign' ? zenMode : mode === 'sanctum_trials',
        seed: chosenSeed,
        date: chosenDate,
        ...extraOpts,
      });
    } else if (mode === 'daily_tide') {
      game.startDailyChallenge?.(chosenDate);
    } else if (mode === 'sanctum_trials') {
      game.startCasualEndlessMode?.({ seed: chosenSeed, sanctumTrials: true });
    } else if (mode === 'flood_rush' || mode === 'expedition') {
      game.startEndlessMode?.({ seed: chosenSeed, mode });
    } else {
      game.startCampaign?.({ startTowerIdx: towerIdx, zenMode: mode === 'purist' ? false : zenMode, purist: mode === 'purist' });
    }
    if (mode === 'flood_rush' || mode === 'expedition') {
      rotatePrestagedEndlessSeeds(mode);
    }
    syncTitleShowcaseState();
    resetFrameClock();
  };

  if (mode === 'campaign' && towerIdx === 0 && !hasSeenCutscene('prologue')) {
    sound.unlock?.();
    hideAllOverlays();
    markCutsceneSeen('prologue');
    playStoryCutscene('prologue', {
      previewMode: true,
      onComplete: startActual,
    });
    resetFrameClock();
    return;
  }

  startActual();
}

function launchMiniGameRun(miniType = 'core_descent') {
  beginRunCommon();
  lastLaunch = { mode: 'minigame', towerIdx: 0, zenMode: false, miniGame: miniType };
  game.startMiniGame?.(miniType, true);
  syncTitleShowcaseState();
  try {
    game.render?.();
  } catch (_) {}
  resetFrameClock();
}

function relaunchLastMode() {
  if (lastLaunch.mode === 'minigame') {
    launchMiniGameRun(lastLaunch.miniGame);
  } else {
    launchGameMode(lastLaunch.mode, { startTowerIdx: lastLaunch.towerIdx });
  }
}

function returnToTitle() {
  hideAllOverlays();
  clearBanner();
  input.resetState?.();
  setInteractContextCached(false, '');
  resetHudVisibilityCache();
  currentPromptAction = null;
  sound.setMiniGameMode?.(null);
  sound.playMenuMusic?.();
  actionPromptEl?.classList.add('hidden');
  puzzleHudEl?.classList.add('hidden');
  crownSealsPillEl?.classList.add('hidden');
  missionStatusPillEl?.classList.add('hidden');
  altMeterEl?.classList.add('hidden');
  coreDescentHudEl?.classList.add('hidden');

  refreshTitleMeta();
  loadTitlePreviewTower();
  overlayTitle?.classList.remove('hidden');
  syncTitleShowcaseState();
  scheduleModeSpiresPrewarm();
}

// ================= INTERACTION ZONE & TAIL-WHIP TOUCH BRIDGE =================
function isHeroInInteractZone() {
  const hero = game.gateway || game.player;
  if (game.mode !== 'tower' || !game.tower || !hero) return false;
  if (hero.hidden || hero.tumbling) return false;
  if (hero.onElevator) return true;
  const cols = getWorldCols();
  const halfCols = cols * 0.5;
  const distCol = (a, b) => {
    let d = (((b - a) % cols) + cols) % cols;
    if (d > halfCols) d -= cols;
    return Math.abs(d);
  };
  if (hero.onGround || (hero.coyoteTimer || 0) > 0) {
    if (game.tower.doors?.some((d) => Math.abs(d.floor - hero.floor) < 0.6 && distCol(hero.col, d.col + 0.5) < 0.85)) {
      return true;
    }
    if (game.elevators?.some((el) => Math.abs(el.floor - hero.floor) < 0.58 && distCol(hero.col, el.col + 0.5) < 0.85)) {
      return true;
    }
  }
  return false;
}

function triggerTailWhipPulse() {
  sound.unlock?.();
  input.haptic?.(14);
  if (typeof input.triggerWhip === 'function') {
    input.triggerWhip();
  } else if (typeof input.triggerInteract === 'function') {
    input.triggerInteract('whip');
  } else if (input.state) {
    input.state.whip = true;
    if (input.justPressed) input.justPressed.whip = true;
    setTimeout(() => {
      if (input.state) input.state.whip = false;
    }, 140);
  }
}

btnWhip?.addEventListener('pointerdown', (e) => {
  if (input.controlMode === 'gesture' || input.controlMode === 'tilt') return;
  e.preventDefault();
  btnWhip.classList.add('active');
  triggerTailWhipPulse();
});
btnWhip?.addEventListener('pointerup', () => btnWhip.classList.remove('active'));
btnWhip?.addEventListener('pointercancel', () => btnWhip.classList.remove('active'));

let lastActionPromptPointerTs = -1000;
function triggerCurrentPromptInteract() {
  const act = currentPromptAction;
  if (!act) return;
  if (act === 'whip') {
    triggerTailWhipPulse();
    return;
  }
  sound.unlock?.();
  input.haptic?.(14);
  if (typeof input.triggerInteract === 'function') {
    input.triggerInteract(act);
  } else if (input.state) {
    input.state[act] = true;
    if (input.justPressed) input.justPressed[act] = true;
    setTimeout(() => {
      if (input.state) input.state[act] = false;
    }, 150);
  }
  if (currentPromptSubtype === 'station' && input.justPressed) {
    input.justPressed.up = true;
  }
}

function triggerPuzzlePeekClue() {
  const pr = game.puzzleRoom;
  if (!pr || pr.solved) return;
  sound.unlock?.();
  sound.switchToggle?.();
  if (typeof pr.peekClue === 'function') pr.peekClue();
  else if (typeof pr.triggerPeek === 'function') pr.triggerPeek();
  else {
    pr.peekAlpha = 1.0;
    pr.peekTimer = 2.8;
    pr.isPeekingClue = true;
  }
}

// ================= ANDROID HARDWARE BACK-BUTTON & POPSTATE CONTROLLER =================
function pushNavGuard() {
  try {
    if (!history.state || !history.state.twGuard) {
      history.pushState({ twGuard: true }, '');
    }
  } catch (_) {}
}

try {
  history.replaceState({ twBase: true }, '');
  history.pushState({ twGuard: true }, '');
} catch (_) {}

function handleHardwareBack() {
  pushNavGuard();

  if (cutsceneState.active) {
    finishCutscene();
    return true;
  }

  const subModals = [overlayModes, overlayWorlds, overlayWardrobe, overlayTrophies, overlayMinigames];
  for (const modal of subModals) {
    if (modal && !modal.classList.contains('hidden')) {
      modal.classList.add('hidden');
      overlayTitle?.classList.remove('hidden');
      syncTitleShowcaseState();
      return true;
    }
  }

  if (overlayGameOver && !overlayGameOver.classList.contains('hidden')) {
    returnToTitle();
    return true;
  }

  if (overlayMutation && !overlayMutation.classList.contains('hidden')) {
    // Keep roguelite draft safe from accidental dismissal; allow pausing only outside draft
    return true;
  }

  if (isTitleScreenOpen()) {
    if (titleSettingsDrawer && !titleSettingsDrawer.classList.contains('hidden')) {
      closeTitleDrawers();
      return true;
    }
    return false;
  }

  // Active gameplay or Pause overlay -> toggle Pause cleanly!
  triggerPauseToggle();
  return true;
}

window.__handleAndroidBack = handleHardwareBack;

window.addEventListener('popstate', () => {
  handleHardwareBack();
});

document.addEventListener('backbutton', (e) => {
  e.preventDefault?.();
  handleHardwareBack();
});

if (window.Capacitor?.Plugins?.App?.addListener) {
  try {
    window.Capacitor.Plugins.App.addListener('backButton', () => {
      handleHardwareBack();
    });
  } catch (_) {}
}

// ================= WIRE UI EVENT LISTENERS =================
btnVistaCycle?.addEventListener('click', () => {
  sound.unlock?.();
  sound.switchToggle?.();
  currentVistaIdx = (currentVistaIdx + 1) % TITLE_VISTA_BIOMES.length;
  const v = TITLE_VISTA_BIOMES[currentVistaIdx];
  if (vistaCycleLblEl) vistaCycleLblEl.textContent = `VISTA • ${v.label}`;
  loadTitlePreviewTower(v.spireIdx);
});

const openModesOverlay = () => {
  sound.unlock?.();
  sound.switchToggle?.();
  closeTitleDrawers();
  refreshTitleMeta();
  overlayTitle?.classList.add('hidden');
  overlayModes?.classList.remove('hidden');
  pushNavGuard();
  syncTitleShowcaseState();
  scheduleModeSpiresPrewarm();
};

const openWorldsOverlay = () => {
  sound.unlock?.();
  sound.switchToggle?.();
  closeTitleDrawers();
  selectedWatershedIdx = Math.max(0, Number(startTowerSelect?.value) || 0);
  overlayTitle?.classList.add('hidden');
  renderWorldsModal();
  overlayWorlds?.classList.remove('hidden');
  pushNavGuard();
  syncTitleShowcaseState();
};

btnModes?.addEventListener('click', openModesOverlay);
btnCloseModes?.addEventListener('click', () => {
  overlayModes?.classList.add('hidden');
  overlayTitle?.classList.remove('hidden');
  syncTitleShowcaseState();
});

modeHubCards.forEach((card) => {
  card.addEventListener('click', () => {
    const picked = card.dataset.modePick || 'campaign';
    launchGameMode(picked);
  });
});

btnWatershedQuick?.addEventListener('click', openWorldsOverlay);
btnHeroSector?.addEventListener('click', openWorldsOverlay);
btnWorlds?.addEventListener('click', openWorldsOverlay);

btnCloseWorlds?.addEventListener('click', () => {
  overlayWorlds?.classList.add('hidden');
  overlayTitle?.classList.remove('hidden');
  syncTitleShowcaseState();
});

btnStart?.addEventListener('click', () => launchGameMode('campaign'));

const handleTitleStageActivate = () => {
  if (titleSettingsDrawer && !titleSettingsDrawer.classList.contains('hidden')) {
    closeTitleDrawers();
    return;
  }
  launchGameMode('campaign');
};
titleDioramaStageEl?.addEventListener('click', handleTitleStageActivate);
titleDioramaStageEl?.addEventListener('keydown', (e) => {
  if (e.code === 'Enter' || e.code === 'Space') {
    e.preventDefault();
    handleTitleStageActivate();
  }
});

startTowerSelect?.addEventListener('change', () => {
  selectedWatershedIdx = Number(startTowerSelect.value) || 0;
  updateSelectedTowerRibbon();
  if (game.mode === 'title') loadTitlePreviewTower();
});

function setZenModeValue(nextZen) {
  const zenMode = Boolean(nextZen);
  syncZenUI(zenMode);
  progression.updateSettings?.({ zenMode });
  sound.setZenMode?.(zenMode);
  game.applySettings?.(progression.getSettings?.() || {});
  updateSelectedTowerRibbon();
}

toggleZenInput?.addEventListener('change', () => setZenModeValue(toggleZenInput.checked));
btnZenPill?.addEventListener('click', () => {
  sound.unlock?.();
  sound.switchToggle?.();
  setZenModeValue(!progression.getSettings?.()?.zenMode);
});

btnTitleSettings?.addEventListener('click', (e) => {
  e.stopPropagation();
  sound.unlock?.();
  sound.switchToggle?.();
  const willOpen = Boolean(titleSettingsDrawer?.classList.contains('hidden'));
  titleSettingsDrawer?.classList.toggle('hidden', !willOpen);
  btnTitleSettings.setAttribute('aria-expanded', String(willOpen));
  btnTitleSettings.classList.toggle('active', willOpen);
  if (willOpen) pushNavGuard();
});

selectControlMode?.addEventListener('change', () => applyControlMode(selectControlMode.value, true));
pauseControlMode?.addEventListener('change', () => applyControlMode(pauseControlMode.value, true));

titleCtrlPickBtns.forEach((btn) => {
  btn.addEventListener('click', () => {
    sound.unlock?.();
    sound.switchToggle?.();
    applyControlMode(btn.dataset.ctrlPick || 'gesture', true);
  });
});

pauseCtrlPillBtns.forEach((btn) => {
  btn.addEventListener('click', () => {
    sound.unlock?.();
    sound.switchToggle?.();
    applyControlMode(btn.dataset.pauseCtrl || 'gesture', true);
  });
});

btnCtrlMode?.addEventListener('click', () => {
  sound.unlock?.();
  const cur = input.controlMode || 'gesture';
  const idx = CONTROL_MODES.indexOf(cur);
  const next = CONTROL_MODES[(idx + 1) % CONTROL_MODES.length];
  applyControlMode(next, true);
  const modeLabel = next === 'tilt' ? 'MOTION (TILT)' : next === 'gesture' ? 'TOUCH (GESTURE)' : `${next.toUpperCase()} MODE`;
  showBanner(modeLabel, CTRL_GUIDE_TEXT[next] || `${next.toUpperCase()} MODE`);
});

const handleCalibrate = () => {
  sound.unlock?.();
  const neutral = input.calibrateTilt?.() ?? 0;
  sound.switchToggle?.();
  showBanner('TILT CALIBRATED', `NEUTRAL ${Number(neutral).toFixed(1)} DEG`);
};
btnCalibrateTilt?.addEventListener('click', handleCalibrate);
btnPauseCalibrate?.addEventListener('click', handleCalibrate);

btnWardrobe?.addEventListener('click', () => {
  sound.unlock?.();
  clearBanner();
  closeTitleDrawers();
  overlayTitle?.classList.add('hidden');
  const hero = game.gateway || game.player;
  if (hero) {
    game.camCol = hero.col ?? 0.5;
    game.camFloor = hero.floor ?? 0;
  }
  overlayWardrobe?.classList.remove('hidden');
  renderWardrobeModal();
  pushNavGuard();
  syncTitleShowcaseState();
  syncSanctuaryTurntable();
});

btnCloseWardrobe?.addEventListener('click', () => {
  overlayWardrobe?.classList.add('hidden');
  overlayTitle?.classList.remove('hidden');
  syncTitleShowcaseState();
});

// Interactive 360° Pelagian Sanctuary Orbit Drag & Zoom Controls
sanctuaryTurntableStageEl?.addEventListener('pointerdown', (e) => {
  if (e.target.closest('button')) return;
  sanctuaryState.dragging = true;
  sanctuaryState.dragStartX = e.clientX;
  if (activeWardrobeTab === 'bestiary') {
    sanctuaryState.dragBaseYaw = sanctuaryState.bestiaryYaw || 0;
  } else {
    if (sanctuaryState.yaw == null) sanctuaryState.yaw = 0;
    sanctuaryState.dragBaseYaw = sanctuaryState.yaw;
  }
  sanctuaryTurntableStageEl.classList.add('dragging');
  try { sanctuaryTurntableStageEl.setPointerCapture(e.pointerId); } catch (_) {}
});

sanctuaryTurntableStageEl?.addEventListener('pointermove', (e) => {
  if (!sanctuaryState.dragging) return;
  const dx = e.clientX - sanctuaryState.dragStartX;
  const nextYaw = sanctuaryState.dragBaseYaw + dx * 0.012;
  if (activeWardrobeTab === 'bestiary') {
    sanctuaryState.bestiaryYaw = nextYaw;
  } else {
    sanctuaryState.yaw = nextYaw;
  }
  syncSanctuaryTurntable();
});

const endSanctuaryDrag = (e) => {
  if (!sanctuaryState.dragging) return;
  sanctuaryState.dragging = false;
  sanctuaryTurntableStageEl?.classList.remove('dragging');
  try { sanctuaryTurntableStageEl?.releasePointerCapture(e.pointerId); } catch (_) {}
};
sanctuaryTurntableStageEl?.addEventListener('pointerup', endSanctuaryDrag);
sanctuaryTurntableStageEl?.addEventListener('pointercancel', endSanctuaryDrag);

btnSanctuaryZoomIn?.addEventListener('click', (e) => {
  e.stopPropagation();
  sound.unlock?.();
  sound.switchToggle?.();
  if (activeWardrobeTab === 'bestiary') {
    sanctuaryState.bestiaryZoom = Math.min(1.65, Number((sanctuaryState.bestiaryZoom + 0.2).toFixed(2)));
  } else {
    sanctuaryState.zoom = Math.min(1.65, Number((sanctuaryState.zoom + 0.2).toFixed(2)));
  }
  syncSanctuaryTurntable();
});

btnSanctuaryZoomOut?.addEventListener('click', (e) => {
  e.stopPropagation();
  sound.unlock?.();
  sound.switchToggle?.();
  if (activeWardrobeTab === 'bestiary') {
    sanctuaryState.bestiaryZoom = Math.max(0.65, Number((sanctuaryState.bestiaryZoom - 0.2).toFixed(2)));
  } else {
    sanctuaryState.zoom = Math.max(0.65, Number((sanctuaryState.zoom - 0.2).toFixed(2)));
  }
  syncSanctuaryTurntable();
});

btnSanctuaryResetCam?.addEventListener('click', (e) => {
  e.stopPropagation();
  sound.unlock?.();
  sound.switchToggle?.();
  if (activeWardrobeTab === 'bestiary') {
    sanctuaryState.bestiaryYaw = 0.35;
    sanctuaryState.bestiaryZoom = 1.0;
    sanctuaryState.bestiaryAnim = 'idle';
  } else {
    sanctuaryState.yaw = null;
    sanctuaryState.zoom = 1.0;
    sanctuaryState.anim = 'IdleBreathe';
  }
  syncSanctuaryTurntable();
  renderSanctuaryAnimBar();
});

wardrobeTabBtns.forEach((btn) => {
  btn.addEventListener('click', () => {
    sound.unlock?.();
    sound.switchToggle?.();
    activeWardrobeTab = btn.dataset.wardrobeTab || 'skins';
    syncWardrobeTabsUI();
  });
});

trophyViewTabBtns.forEach((btn) => {
  btn.addEventListener('click', () => {
    sound.unlock?.();
    sound.switchToggle?.();
    activeTrophyView = btn.dataset.trophyView || 'trophies';
    syncTrophyViewTabsUI();
  });
});

tierFilterBtns.forEach((btn) => {
  btn.addEventListener('click', () => {
    sound.unlock?.();
    sound.switchToggle?.();
    activeTierFilter = btn.dataset.tierFilter || 'all';
    tierFilterBtns.forEach((b) => b.classList.toggle('active', b === btn));
    renderTrophiesModal();
  });
});

btnTrophies?.addEventListener('click', () => {
  sound.unlock?.();
  closeTitleDrawers();
  overlayTitle?.classList.add('hidden');
  renderTrophiesModal();
  overlayTrophies?.classList.remove('hidden');
  pushNavGuard();
  syncTitleShowcaseState();
});

btnCloseTrophies?.addEventListener('click', () => {
  overlayTrophies?.classList.add('hidden');
  overlayTitle?.classList.remove('hidden');
  syncTitleShowcaseState();
});

btnMinigames?.addEventListener('click', () => {
  sound.unlock?.();
  closeTitleDrawers();
  mountHydroArtwork();
  overlayTitle?.classList.add('hidden');
  overlayMinigames?.classList.remove('hidden');
  pushNavGuard();
  syncTitleShowcaseState();
});

btnCloseMinigames?.addEventListener('click', () => {
  overlayMinigames?.classList.add('hidden');
  overlayTitle?.classList.remove('hidden');
  syncTitleShowcaseState();
});

minigameCards.forEach((card) => {
  card.addEventListener('click', () => {
    launchMiniGameRun(card.dataset.minigame || 'core_descent');
  });
});

actionPromptEl?.addEventListener('pointerdown', (e) => {
  if (!currentPromptAction) return;
  e.preventDefault();
  e.stopPropagation();
  lastActionPromptPointerTs = performance.now();
  triggerCurrentPromptInteract();
});

actionPromptEl?.addEventListener('click', (e) => {
  if (!currentPromptAction) return;
  e.preventDefault();
  e.stopPropagation();
  if (performance.now() - lastActionPromptPointerTs > 320) {
    triggerCurrentPromptInteract();
  }
});

btnPeekClue?.addEventListener('click', (e) => {
  e.preventDefault();
  e.stopPropagation();
  triggerPuzzlePeekClue();
});

// Audio Mute & Pause Controls
const handleToggleMute = () => {
  sound.unlock?.();
  const muted = sound.toggleMute?.();
  progression.updateSettings?.({ muted });
  syncAudioButtons();
};
const handleToggleMusic = () => {
  sound.unlock?.();
  const musicEnabled = sound.toggleMusic?.();
  progression.updateSettings?.({ musicEnabled });
  syncAudioButtons();
};
const handleToggleVoice = () => {
  sound.unlock?.();
  const voiceEnabled = sound.toggleVoice ? sound.toggleVoice() : true;
  progression.updateSettings?.({ voiceEnabled });
  syncAudioButtons();
  if (voiceEnabled) sound.voiceBlip?.('gateway', 0);
};

btnSound?.addEventListener('click', handleToggleMute);
btnTitleSound?.addEventListener('click', handleToggleMute);
btnMusic?.addEventListener('click', handleToggleMusic);
btnTitleMusic?.addEventListener('click', handleToggleMusic);
btnTitleVoice?.addEventListener('click', handleToggleVoice);

function triggerPauseToggle() {
  if (
    cutsceneState.active ||
    game.mode === 'title' ||
    game.mode === 'gameover' ||
    game.mode === 'victory' ||
    game.mode === 'mutation_draft' ||
    (overlayMutation && !overlayMutation.classList.contains('hidden'))
  ) {
    return;
  }
  sound.unlock?.();
  const paused = game.togglePause?.();
  input.resetState?.();
  input.setInteractContext?.(false, '');
  if (paused) {
    actionPromptEl?.classList.add('hidden');
    puzzleHudEl?.classList.add('hidden');
    syncAudioMixerUI();
    if (pauseTowerName) {
      const pf = game.pausedFrom;
      if (pf === 'core_descent') pauseTowerName.textContent = 'Reactor Core Descent';
      else if (pf === 'reef_swim' || pf === 'submarine') pauseTowerName.textContent = 'Pelagian Reef Dive (Bio-Submersible)';
      else if (pf === 'rapids_surf' || pf === 'skimmer') pauseTowerName.textContent = 'Whitewater Rapids Tail-Surf';
      else if (pf === 'frill_glide' || pf === 'glide') pauseTowerName.textContent = 'Canyon Updraft Frill-Glide';
      else if (pf === 'aqueduct_sanctum' || pf === 'puzzle') pauseTowerName.textContent = 'Aqueduct Sanctum';
      else if (pf === 'vault') pauseTowerName.textContent = 'Harmonic Core Vault';
      else if (game.tower) pauseTowerName.textContent = `Spire ${game.tower.id}: ${game.tower.name}`;
    }
    overlayPause?.classList.remove('hidden');
    pushNavGuard();
  } else {
    overlayPause?.classList.add('hidden');
    resetFrameClock();
  }
}

btnPause?.addEventListener('click', triggerPauseToggle);
btnResume?.addEventListener('click', () => {
  if (game.mode === 'paused') triggerPauseToggle();
  else overlayPause?.classList.add('hidden');
});
btnRestart?.addEventListener('click', relaunchLastMode);
btnPauseTitle?.addEventListener('click', returnToTitle);
btnPlayAgain?.addEventListener('click', relaunchLastMode);
btnBackTitle?.addEventListener('click', returnToTitle);

btnCutsceneNext?.addEventListener('click', advanceCutsceneStep);
cutsceneTapStage?.addEventListener('click', advanceCutsceneStep);
btnCutsceneSkip?.addEventListener('click', () => {
  sound.unlock?.();
  sound.switchToggle?.();
  finishCutscene();
});

window.addEventListener('keydown', (e) => {
  if (e.repeat) return;
  if (overlayMutation && !overlayMutation.classList.contains('hidden')) {
    const idx = e.code === 'Digit1' ? 0 : e.code === 'Digit2' ? 1 : e.code === 'Digit3' ? 2 : -1;
    if (idx >= 0) {
      const cards = mutationCardsGridEl?.querySelectorAll('.mutation-card');
      if (cards && cards[idx]) {
        e.preventDefault();
        cards[idx].click();
      }
    }
    return;
  }
  if (cutsceneState.active) {
    if (e.code === 'Escape') {
      e.preventDefault();
      finishCutscene();
    } else if (e.code === 'Space' || e.code === 'Enter') {
      e.preventDefault();
      advanceCutsceneStep();
    }
    return;
  }
  if (e.code === 'KeyM') {
    handleToggleMusic();
  } else if (e.code === 'Escape' || e.code === 'KeyP') {
    e.preventDefault();
    handleHardwareBack();
  }
});

// ================= VIEWPORT RESIZE & BOOT =================
function handleResize() {
  const w = window.innerWidth || stageWrap?.clientWidth || 412;
  const h = window.innerHeight || stageWrap?.clientHeight || 915;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  renderer.resize(w, h, dpr);
}

window.addEventListener('resize', handleResize);
window.visualViewport?.addEventListener('resize', handleResize);

// ================= STARTUP ASSET PRE-WARMING (ZERO MID-CLIMB STUTTERS) =================
const PREWARM_STORY_ASSETS = [
  './assets/textures/story_keyframe_prologue.webp',
  './assets/textures/story_keyframe_act2.webp',
  './assets/textures/story_keyframe_act3.webp',
  './assets/textures/story_keyframe_act4.webp',
  './assets/textures/story_keyframe_purification.webp',
  './assets/textures/story_keyframe_finale.webp',
  './assets/textures/story_portrait_gateway.webp',
  './assets/textures/story_portrait_naiad.webp',
  './assets/textures/story_portrait_warden.webp',
  './assets/textures/story_portrait_guardian.webp',
];
const _prewarmedImages = [];
let startupWarmupFrames = 0;
let startupVeilDismissed = false;

function dismissStartupTransitionVeil() {
  if (startupVeilDismissed) return;
  startupVeilDismissed = true;
  stageTransitionVeilEl?.classList.add('is-ready');
}

function prewarmStartupAssets() {
  // 1. Async decode all neural story keyframe plates & character portraits into GPU image cache
  const decodeJobs = PREWARM_STORY_ASSETS.map((src) => {
    const img = new Image();
    img.decoding = 'async';
    img.src = src;
    _prewarmedImages.push(img);
    if (typeof img.decode === 'function') {
      return img.decode().catch(() => {});
    }
    return Promise.resolve();
  });

  // 2. Pre-warm renderer shaders, Sanctum puzzle renderer (avoids 900ms PMREM/compile spike on _enterPuzzleRoom!), & initial tower render during startup fade
  try {
    renderer.prewarm?.();
    renderer._ensurePuzzleRenderer?.();
    game.render();
    scheduleModeSpiresPrewarm();
  } catch (_) {}

  // 3. Dismiss transition veil once images decode + GLBs & all 6 mode spires warm + >= 2 WebGL frames (capped at 850ms)
  let decodedReady = false;
  const isAllModeWarmReady = () =>
    decodedReady &&
    startupWarmupFrames >= 2 &&
    prestagedModeRuns.warmedPropVer === (renderer?._archPropsVersion ?? 0);

  const pollReady = () => {
    if (startupVeilDismissed) return;
    if (isAllModeWarmReady()) {
      dismissStartupTransitionVeil();
    } else {
      setTimeout(pollReady, 25);
    }
  };
  Promise.all(decodeJobs).then(() => {
    decodedReady = true;
    pollReady();
  });
  setTimeout(pollReady, 30);
  setTimeout(dismissStartupTransitionVeil, 850);
}

applyControlMode(initSettings.controlMode || 'gesture', false);
refreshTitleMeta();
renderLivesPips(3, false);
loadTitlePreviewTower(0);
syncTitleShowcaseState();
handleResize();
prewarmStartupAssets();

// ================= MAIN 60FPS ANIMATION LOOP =================
resetFrameClock();

function loop(ts) {
  requestAnimationFrame(loop);
  const rawDt = (ts - lastTs) / 1000;
  lastTs = ts;
  // Pass true wall-clock dt up to 0.10s so 120Hz fixed-timestep physics never slows down on brief dips
  const dt = Math.max(0, Math.min(0.10, rawDt));

  // Trigger Act Intro Cutscenes during Story Campaign
  if (
    !cutsceneState.active &&
    String(game.runType || '').toLowerCase().includes('campaign') &&
    game.mode === 'tower' &&
    game.tower
  ) {
    const tid = game.tower.id;
    const actMap = { 3: 'act2_intro', 5: 'act3_intro', 7: 'act4_intro', 9: 'act5_intro' };
    const actKey = actMap[tid];
    if (actKey && !hasSeenCutscene(actKey)) {
      markCutsceneSeen(actKey);
      playStoryCutscene(actKey, { previewMode: false });
    }
  }

  if (cutsceneState.active) {
    setInteractContextCached(false, '');
    game.time = (game.time || 0) + dt;
    cutsceneState.elapsed += dt;

    const def = STORY_CUTSCENES[cutsceneState.kind];
    const totalBeats = Math.max(1, def?.beats?.length || 2);
    const beatFrac = totalBeats > 1 ? cutsceneState.beatIdx / (totalBeats - 1) : 1;
    const timeSweep = Math.min(0.35, (cutsceneState.elapsed / cutsceneState.cameraDuration) * 0.35);
    const phase = Math.max(0, Math.min(1, beatFrac * 0.65 + timeSweep));

    if (def?.isPurification) {
      const sPct = cutsceneState.startPct ?? def.startPct ?? 20;
      const ePct = cutsceneState.endPct ?? def.endPct ?? 100;
      const curPct = Math.round(sPct + (ePct - sPct) * phase);
      game.purificationProgress = phase;
      renderer.setPurificationProgress?.(phase);
      if (curPct !== cutsceneState.lastPct) {
        cutsceneState.lastPct = curPct;
        if (cutsceneRestorationPctEl) cutsceneRestorationPctEl.textContent = `${curPct}%`;
        if (cutsceneRestorationFillEl) cutsceneRestorationFillEl.style.width = `${curPct}%`;
      }
    }

    game.cutsceneCam = {
      active: true,
      phase,
      kind: cutsceneState.kind,
      isPurification: Boolean(def?.isPurification),
    };

    if (cutsceneState.charIdx < cutsceneState.fullText.length) {
      cutsceneState.charIdx = Math.min(cutsceneState.fullText.length, cutsceneState.charIdx + dt * 65);
      const nextCharInt = Math.floor(cutsceneState.charIdx);
      if (nextCharInt !== cutsceneState.lastCharInt) {
        cutsceneState.lastCharInt = nextCharInt;
        if (cutsceneTextEl) {
          cutsceneTextEl.textContent = cutsceneState.fullText.slice(0, nextCharInt);
        }
        const ch = cutsceneState.fullText.charAt(nextCharInt - 1);
        if (ch && !/\s/.test(ch)) {
          const activeBeat = def?.beats?.[cutsceneState.beatIdx];
          sound.voiceBlip?.(activeBeat?.speaker || 'gateway', nextCharInt);
        }
      }
    }
  } else if (game.mode === 'title') {
    setInteractContextCached(false, '');
    game.time = (game.time || 0) + dt;
    game._syncDynamicLedges?.(dt, true);
    const hero = game.gateway || game.player;
    const cols = getWorldCols();
    const halfCols = cols * 0.5;
    if (hero && hero.muzzleFlash > 0) {
      hero.muzzleFlash = Math.max(0, hero.muzzleFlash - dt);
    }

    const titleOpen = isTitleScreenOpen();
    const wardrobeOpen = Boolean(overlayWardrobe && !overlayWardrobe.classList.contains('hidden'));
    game.titleShowcase = titleOpen;
    game.wardrobeSpotlight = wardrobeOpen;

    if (wardrobeOpen && hero) {
      const targetCol = hero.col ?? 0.5;
      const diff = (((targetCol - (game.camCol ?? targetCol) + halfCols) % cols) + cols) % cols - halfCols;
      game.camCol = ((((game.camCol ?? targetCol) + diff * Math.min(1, dt * 8)) % cols) + cols) % cols;
      const targetFloor = hero.floor ?? 0;
      game.camFloor = (game.camFloor ?? 0) + (targetFloor - (game.camFloor ?? 0)) * Math.min(1, dt * 8);
    } else if (titleOpen && hero) {
      const baseCol = hero.col ?? 1.0;
      const gentleOrbit = Math.sin((game.time || 0) * 0.30) * 0.18;
      const targetCol = (((baseCol + gentleOrbit) % cols) + cols) % cols;
      const diff = (((targetCol - (game.camCol ?? baseCol) + halfCols) % cols) + cols) % cols - halfCols;
      game.camCol = ((((game.camCol ?? baseCol) + diff * Math.min(1, dt * 5)) % cols) + cols) % cols;
      const targetFloor = (hero.floor ?? 1) + 0.85;
      game.camFloor = (game.camFloor ?? targetFloor) + (targetFloor - (game.camFloor ?? targetFloor)) * Math.min(1, dt * 4);
    } else {
      game.camCol = ((game.camCol || 0) + dt * 0.42) % cols;
      const targetFloor = 1.5;
      game.camFloor = (game.camFloor ?? 1.5) + (targetFloor - (game.camFloor ?? 1.5)) * Math.min(1, dt * 3);
    }
  } else {
    game.titleShowcase = false;
    game.wardrobeSpotlight = false;
    // Note: game.update(dt) already ticks this.input.update(clampedDt) once per frame!
    game.update(dt);
  }

  game.render();

  if (!startupVeilDismissed) {
    startupWarmupFrames++;
    if (startupWarmupFrames >= 2 && _prewarmedImages.every((im) => im.complete)) {
      dismissStartupTransitionVeil();
    }
  }
}

// Unlock soothing Pelagian Sanctuary Menu Score on first user interaction
let menuAudioBooted = false;
const bootSanctuaryAudioOnce = () => {
  if (menuAudioBooted) return;
  menuAudioBooted = true;
  sound.unlock?.();
  if (game.mode === 'title' || cutsceneState.active) {
    sound.playMenuMusic?.();
  }
};
window.addEventListener('pointerdown', bootSanctuaryAudioOnce, { once: true, passive: true });
window.addEventListener('keydown', bootSanctuaryAudioOnce, { once: true });

requestAnimationFrame(loop);
