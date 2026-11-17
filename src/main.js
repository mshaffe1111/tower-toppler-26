import { sound } from './audio.js';
import { InputController, CONTROL_MODES } from './input.js';
import { GameRenderer } from './renderer.js';
import { TowerTopplerGame } from './game.js';
import * as progMod from './progression.js';
import * as levelsMod from './levels.js';
import * as uiArtMod from './uiArtwork.js';

const { progression, SKIN_CATALOG, TROPHIES } = progMod;
const { createTowers, getDailySeed } = levelsMod;

// ================= DOM REFERENCES =================
const appEl = document.getElementById('app');
const stageWrap = document.getElementById('stage-wrap');
const canvas = document.getElementById('game-canvas');
const hudEl = document.getElementById('hud');
const touchControlsEl = document.getElementById('touch-controls');

// Top HUD
const scoreEl = document.getElementById('score-display');
const hiScoreEl = document.getElementById('hi-score-display');
const livesEl = document.getElementById('lives-display');
const gearsEl = document.getElementById('gears-display');
const timerEl = document.getElementById('timer-display');
const timerRingEl = document.getElementById('timer-ring');
const timerRingArcEl = document.getElementById('timer-ring-arc');
const dirArrowEl = document.getElementById('dir-arrow');
const towerBadgeEl = document.getElementById('tower-badge');
const missionStatusPillEl = document.getElementById('mission-status-pill');

const btnEraToggle = document.getElementById('btn-era-toggle');
const btnCtrlMode = document.getElementById('btn-ctrl-mode');
const btnMusic = document.getElementById('btn-music');
const btnSound = document.getElementById('btn-sound');
const btnPause = document.getElementById('btn-pause');

// In-Stage Telemetry & Toasts
const altMeterEl = document.getElementById('altitude-meter');
const altFillEl = document.getElementById('alt-fill');
const altPipEl = document.getElementById('alt-pip');
const altWaterEl = document.getElementById('alt-water');
const actionPromptEl = document.getElementById('action-prompt');

const bannerEl = document.getElementById('stage-banner');
const bannerSubEl = document.getElementById('banner-sub');
const bannerTitleEl = document.getElementById('banner-title');

const trophyToastEl = document.getElementById('trophy-toast');
const trophyToastKickerEl = document.getElementById('trophy-toast-kicker');
const trophyToastTitleEl = document.getElementById('trophy-toast-title');
const trophyToastIconEl = trophyToastEl?.querySelector('.trophy-toast-icon');

// Touch Controls
const btnCalibrateTilt = document.getElementById('btn-calibrate-tilt');

// Overlays
const overlayTitle = document.getElementById('overlay-title');
const overlayWorlds = document.getElementById('overlay-worlds');
const overlayWardrobe = document.getElementById('overlay-wardrobe');
const overlayTrophies = document.getElementById('overlay-trophies');
const overlayMinigames = document.getElementById('overlay-minigames');
const overlayPause = document.getElementById('overlay-pause');
const overlayGameOver = document.getElementById('overlay-gameover');
const gameoverCardEl = document.getElementById('gameover-card');

// Diegetic Start Screen Controls
const eraTabBtns = document.querySelectorAll('[data-era-select]');
const titleSubEraEl = document.getElementById('title-sub-era');
const titleTaglineEl = document.getElementById('title-tagline');
const startTowerSelect = document.getElementById('start-tower');
const selectedTowerStarsEl = document.getElementById('selected-tower-stars');
const toggleZenInput = document.getElementById('toggle-zen');
const selectControlMode = document.getElementById('select-control-mode');

const btnTitleSettings = document.getElementById('btn-title-settings');
const titleSettingsDrawer = document.getElementById('title-settings-drawer');
const titleCtrlGlyphEl = document.getElementById('title-ctrl-glyph');
const titleCtrlCodeEl = document.getElementById('title-ctrl-code');
const btnZenPill = document.getElementById('btn-zen-pill');
const zenPillLabelEl = document.getElementById('zen-pill-label');
const btnTitleMusic = document.getElementById('btn-title-music');
const btnTitleSound = document.getElementById('btn-title-sound');
const titleCtrlPickBtns = document.querySelectorAll('[data-ctrl-pick]');

const titleCrestStageEl = document.getElementById('title-crest-stage');
const titleDioramaStageEl = document.getElementById('title-diorama-stage');

const expeditionsDrawerEl = document.getElementById('expeditions-drawer');
const btnExpeditions = document.getElementById('btn-expeditions');
const btnCloseExpeditions = document.getElementById('btn-close-expeditions');
const spireArtDailyEl = document.getElementById('spire-art-daily');
const spireArtEndlessEl = document.getElementById('spire-art-endless');
const spireArtCasualEl = document.getElementById('spire-art-casual');

const btnHeroSector = document.getElementById('btn-hero-sector');
const heroSectorNameEl = document.getElementById('hero-sector-name');
const playMedallionSvgEl = document.getElementById('play-medallion-svg');
const heroPlayKickerEl = document.getElementById('hero-play-kicker');
const heroPlayLabelEl = document.getElementById('hero-play-label');

const btnStart = document.getElementById('btn-start');
const btnWorlds = document.getElementById('btn-worlds');
const btnDaily = document.getElementById('btn-daily');
const btnEndless = document.getElementById('btn-endless');
const btnCasualEndless = document.getElementById('btn-casual-endless');
const btnMinigames = document.getElementById('btn-minigames');
const dailyMetaEl = document.getElementById('daily-meta');
const endlessMetaEl = document.getElementById('endless-meta');
const casualMetaEl = document.getElementById('casual-meta');
const btnWardrobe = document.getElementById('btn-wardrobe');
const btnTrophies = document.getElementById('btn-trophies');
const worldsDockBadgeEl = document.getElementById('worlds-dock-badge');
const wardrobeBtnBadge = document.getElementById('wardrobe-btn-badge');
const trophiesBtnBadge = document.getElementById('trophies-btn-badge');

// World Map / Sea Chart Controls
const worldsKickerEl = document.getElementById('worlds-kicker');
const worldsStarsPillEl = document.getElementById('worlds-stars-pill');
const worldsMapListEl = document.getElementById('worlds-map-list');
const btnCloseWorlds = document.getElementById('btn-close-worlds');

// Wardrobe & Blaster FX Controls
const wardrobeGearsEl = document.getElementById('wardrobe-gears');
const wardrobeGridEl = document.getElementById('wardrobe-grid');
const blasterFxGridEl = document.getElementById('blaster-fx-grid');
const wardrobeTabBtns = document.querySelectorAll('[data-wardrobe-tab]');
const wardrobeSkinsTabLbl = document.getElementById('wardrobe-skins-tab-lbl');
const wardrobeBlasterTabLbl = document.getElementById('wardrobe-blaster-tab-lbl');
const btnCloseWardrobe = document.getElementById('btn-close-wardrobe');

// Trophies (1,000 PTS) & Relic Codex Controls
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

// Pause Controls
const pauseTowerName = document.getElementById('pause-tower-name');
const pauseControlMode = document.getElementById('pause-control-mode');
const pauseCtrlPillBtns = document.querySelectorAll('[data-pause-ctrl]');
const btnPauseCalibrate = document.getElementById('btn-pause-calibrate');
const btnResume = document.getElementById('btn-resume');
const btnRestart = document.getElementById('btn-restart');
const btnPauseTitle = document.getElementById('btn-pause-title');

// Game Over Controls
const goBadge = document.getElementById('go-badge');
const goTitle = document.getElementById('go-title');
const goScore = document.getElementById('go-score');
const goHi = document.getElementById('go-hi');
const goStars = document.getElementById('go-stars');
const goGears = document.getElementById('go-gears');
const btnPlayAgain = document.getElementById('btn-play-again');
const btnBackTitle = document.getElementById('btn-back-title');

// Cinematic Cutscene Controls
const overlayCutscene = document.getElementById('overlay-cutscene');
const cutsceneActPillEl = document.getElementById('cutscene-act-pill');
const cutsceneTitleEl = document.getElementById('cutscene-title');
const btnCutsceneSkip = document.getElementById('btn-cutscene-skip');
const cutsceneTapStage = document.getElementById('cutscene-tap-stage');
const cutsceneCommsBoxEl = document.getElementById('cutscene-comms-box');
const cutscenePortraitEl = document.getElementById('cutscene-portrait');
const cutsceneSpeakerEl = document.getElementById('cutscene-speaker');
const cutsceneStepDotsEl = document.getElementById('cutscene-step-dots');
const cutsceneTextEl = document.getElementById('cutscene-text');
const btnCutsceneNext = document.getElementById('btn-cutscene-next');

// ================= BESPOKE VECTOR SVG LIBRARY (ZERO EMOJIS) =================
const RING_CIRCUMFERENCE = 2 * Math.PI * 19;

const FROG_LIFE_SVG = `
  <svg viewBox="0 0 24 26" aria-hidden="true">
    <path fill="currentColor" fill-rule="evenodd" d="M12 1.5C6.1 1.5 2 5.9 2 11.6C2 16.8 6.4 23.6 12 24.5C17.6 23.6 22 16.8 22 11.6C22 5.9 17.9 1.5 12 1.5ZM5.4 10.6C5.8 9.4 7.7 9.7 9.4 10.7C11.0 11.6 11.7 13.1 11.1 14.0C10.5 14.9 8.7 14.8 7.1 13.9C5.5 13.0 5.0 11.7 5.4 10.6ZM18.6 10.6C19.0 11.7 18.5 13.0 16.9 13.9C15.3 14.8 13.5 14.9 12.9 14.0C12.3 13.1 13.0 11.6 14.6 10.7C16.3 9.7 18.2 9.4 18.6 10.6Z"/>
  </svg>
`;

const SVG_GEAR = `<svg class="ico-svg ico-gear-gold" viewBox="0 0 24 24" aria-hidden="true"><use href="#ico-gear"/></svg>`;
const SVG_STAR_ON = `<svg class="ico-svg ico-star-filled" viewBox="0 0 24 24" aria-hidden="true"><use href="#ico-star"/></svg>`;
const SVG_STAR_OFF = `<svg class="ico-svg ico-star-hollow" viewBox="0 0 24 24" aria-hidden="true"><use href="#ico-star-empty"/></svg>`;
const SVG_TROPHY = `<svg class="ico-svg" viewBox="0 0 24 24" aria-hidden="true"><use href="#ico-trophy"/></svg>`;
const SVG_DIAMOND = `<svg class="ico-svg" viewBox="0 0 24 24" aria-hidden="true"><use href="#ico-diamond"/></svg>`;
const SVG_RELIC = `<svg class="ico-svg" viewBox="0 0 24 24" aria-hidden="true"><use href="#ico-relic"/></svg>`;
const SVG_BLASTER = `<svg class="ico-svg" viewBox="0 0 24 24" aria-hidden="true"><use href="#ico-blaster"/></svg>`;
const SVG_CRAFT = `<svg class="ico-svg" viewBox="0 0 24 24" aria-hidden="true"><use href="#ico-craft"/></svg>`;
const SVG_KEY = `<svg class="ico-svg" viewBox="0 0 24 24" aria-hidden="true"><use href="#ico-key"/></svg>`;
const SVG_CURIO = `<svg class="ico-svg" viewBox="0 0 24 24" aria-hidden="true"><use href="#ico-curio"/></svg>`;
const SVG_FILM = `<svg class="ico-svg" viewBox="0 0 24 24" aria-hidden="true"><use href="#ico-film"/></svg>`;

// Bespoke Holographic Comms Portraits (Zero Emojis)
const HOLO_PORTRAITS = {
  mara: `
    <svg viewBox="0 0 48 48" aria-hidden="true">
      <circle cx="24" cy="24" r="21" fill="none" stroke="currentColor" stroke-width="1" stroke-dasharray="5 3" opacity="0.55"/>
      <path d="M11 41c1.5-7 6.2-10.5 13-10.5S35.5 34 37 41" fill="currentColor" fill-opacity="0.22" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
      <path d="M16.5 19c0-5 3.3-8.5 7.5-8.5s7.5 3.5 7.5 8.5c0 4.8-3.2 8.5-7.5 8.5s-7.5-3.7-7.5-8.5Z" fill="currentColor" fill-opacity="0.18" stroke="currentColor" stroke-width="1.6"/>
      <path d="M15 18.2h18l-1.5 3.6H16.5L15 18.2Z" fill="currentColor"/>
      <path d="M14 19.5h-2.5v4H14M34 19.5h2.5v4H34" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
    </svg>`,
  pogo: `
    <svg viewBox="0 0 48 48" aria-hidden="true">
      <circle cx="24" cy="24" r="21" fill="none" stroke="currentColor" stroke-width="1" stroke-dasharray="4 3" opacity="0.55"/>
      <path d="M13 41c2-6 5.8-9 11-9s9 3 11 9" fill="currentColor" fill-opacity="0.2" stroke="currentColor" stroke-width="1.6"/>
      <path d="M18 33l6 6 6-6" fill="none" stroke="#ffe44d" stroke-width="1.5" stroke-linejoin="round"/>
      <path fill="currentColor" fill-opacity="0.28" stroke="currentColor" stroke-width="1.6" d="M24 9c-7.5 0-12.5 4.8-12.5 11.2 0 5.6 5.2 10.8 12.5 11.5 7.3-.7 12.5-5.9 12.5-11.5C36.5 13.8 31.5 9 24 9Z"/>
      <path d="M24 6.5c1.5 2 1.8 4.2 0 6.2-1.8-2-1.5-4.2 0-6.2Z" fill="currentColor"/>
      <ellipse cx="18.5" cy="19.8" rx="3.4" ry="2.5" transform="rotate(-14 18.5 19.8)" fill="#050b16" stroke="currentColor" stroke-width="1.3"/>
      <circle cx="19.3" cy="19.1" r="1" fill="#ffffff"/>
      <ellipse cx="29.5" cy="19.8" rx="3.4" ry="2.5" transform="rotate(14 29.5 19.8)" fill="#050b16" stroke="currentColor" stroke-width="1.3"/>
      <circle cx="28.7" cy="19.1" r="1" fill="#ffffff"/>
    </svg>`,
  kroll: `
    <svg viewBox="0 0 48 48" aria-hidden="true">
      <polygon points="24,4 41,14 41,34 24,44 7,34 7,14" fill="currentColor" fill-opacity="0.15" stroke="currentColor" stroke-width="1.6"/>
      <polygon points="24,10 35,17 35,31 24,38 13,31 13,17" fill="none" stroke="currentColor" stroke-width="1.2" stroke-dasharray="4 2"/>
      <circle cx="24" cy="24" r="6.2" fill="currentColor" fill-opacity="0.32" stroke="currentColor" stroke-width="1.8"/>
      <circle cx="24" cy="24" r="2.6" fill="#ffffff"/>
      <path d="M24 4v6M24 38v6M7 14l6 3M35 31l6 3M41 14l-6 3M13 31l-6 3" stroke="currentColor" stroke-width="1.3"/>
    </svg>`,
};

const STORY_CUTSCENES = {
  prologue: {
    act: 'PROLOGUE • SECTOR I',
    title: 'DROP INTO NEBULUS',
    towerIdx: 0,
    beats: [
      {
        speaker: 'mara',
        name: 'COMMANDER MARA • ORBITAL HQ',
        text: 'Orbital scan confirmed, Specialist Pogo. Eight dormant Abyssal Monoliths have ignited across the Nebulus trench—superheating the sea and dragging the crust under.',
      },
      {
        speaker: 'kroll',
        name: 'KROLL-9 • MONOLITH OVERMIND',
        text: 'INTRUSION DETECTED IN SECTOR ONE. TERRAFORM SUBMERSION PROTOCOL AT 14%. AMPHIBIOUS ORGANISM WILL BE EXPUNGED.',
      },
      {
        speaker: 'pogo',
        name: 'SPECIALIST POGO • AMPHIBIOUS CORPS',
        text: 'MK.7 drop-pod clear of the surf. Harness strapped, Cryo-Blaster charged. Point me at the Watchtower—we are toppling all eight back into the abyss.',
      },
    ],
  },
  sector2: {
    act: 'ACT II • SECTOR II',
    title: 'FIRES OF THE FOUNDRY',
    towerIdx: 2,
    beats: [
      {
        speaker: 'mara',
        name: 'COMMANDER MARA • ORBITAL HQ',
        text: 'Sector I is down! Your Sky-Wing glide puts you right at the Smelter Reach—an automated iron foundry venting pressurized steam straight into the polar jetstream.',
      },
      {
        speaker: 'kroll',
        name: 'KROLL-9 • MONOLITH OVERMIND',
        text: 'CLOCKWORK SENTINELS ACTIVATED. BOREAL GALES ESCALATING TO LETHAL VELOCITY. YOUR CLIMB ENDS IN THE FURNACE.',
      },
      {
        speaker: 'pogo',
        name: 'SPECIALIST POGO • AMPHIBIOUS CORPS',
        text: 'Pressurized steam vents just mean a faster boost up the boiler plates, Kroll. Time to flip your conveyors and ride the gale.',
      },
    ],
  },
  sector3: {
    act: 'ACT III • SECTOR III',
    title: 'SECRETS BENEATH THE TRENCH',
    towerIdx: 4,
    beats: [
      {
        speaker: 'mara',
        name: 'COMMANDER MARA • ORBITAL HQ',
        text: 'Halfway to the core! The Destructo Inc. tablets we decrypted show Sector III houses the Prism Labyrinth—its floating amethyst molecules guard phase-shifted bridges.',
      },
      {
        speaker: 'pogo',
        name: 'SPECIALIST POGO • AMPHIBIOUS CORPS',
        text: 'I see the resonators inlaid into the obsidian walls, Command. Crack the rune sanctums, time the hydraulic pistons, and drop their offshore rig.',
      },
      {
        speaker: 'kroll',
        name: 'KROLL-9 • MONOLITH OVERMIND',
        text: 'ALERT: PRISM MATRIX BREACHED. ENGAGING HIGH-OUTPUT LASER GATES AND TIDAL DERRICK OVERDRIVE.',
      },
    ],
  },
  sector4: {
    act: 'ACT IV • SECTOR IV',
    title: 'EYE OF THE MAELSTROM',
    towerIdx: 6,
    beats: [
      {
        speaker: 'mara',
        name: 'COMMANDER MARA • ORBITAL HQ',
        text: 'You have reached the Maelstrom Core. Watch your footing—crown Tesla arrays on Tower 7 drain ambient moonlight every nine seconds to plunge the spire into blackout!',
      },
      {
        speaker: 'kroll',
        name: 'KROLL-9 • MONOLITH OVERMIND',
        text: 'DROWN IN SHADOW AND SURGING TIDE. THE ECLIPSED APEX REACTOR WILL CONSUME THIS OCEAN WORLD.',
      },
      {
        speaker: 'pogo',
        name: 'SPECIALIST POGO • AMPHIBIOUS CORPS',
        text: 'Amber cage-lifts glow brighter in the dark. Two monoliths left—keep the extraction sub warm, Mara.',
      },
    ],
  },
  epilogue: {
    act: 'EPILOGUE • OPERATION COMPLETE',
    title: 'DAWN OVER NEBULUS',
    towerIdx: 7,
    beats: [
      {
        speaker: 'kroll',
        name: 'KROLL-9 • MONOLITH OVERMIND',
        text: 'CRITICAL CORE COLLAPSE... MAELSTROM SURGE SUBSIDING... ALL EIGHT MONOLITHS OFFLINE...',
      },
      {
        speaker: 'mara',
        name: 'COMMANDER MARA • ORBITAL HQ',
        text: 'Direct hit on the Apex reactor! Seismic buoys confirm every monolith has crumbled into the trench—ocean levels across Planet Nebulus are stabilizing!',
      },
      {
        speaker: 'pogo',
        name: 'SPECIALIST POGO • AMPHIBIOUS CORPS',
        text: 'Storm clouds are parting under the moon, Command. Mission accomplished—bring the MK.7 alongside and let us head home.',
      },
    ],
  },
};

const FALLBACK_CURIO_CATALOG = [
  { id: 'curio_beacon_dynamo', kind: 'blueprint', title: 'BEACON REPAIR DYNAMO', lore: 'Hand-wound copper coil, prism lens, and brass drive shaft assembled at a field Tinker Workbench.' },
  { id: 'curio_tide_astrolabe', kind: 'curio', title: 'SUNKEN TIDE ASTROLABE', lore: 'Barnacle-encrusted brass sextant calibrated to Planet Nebulus dual-lunar tides.' },
  { id: 'curio_amber_firefly', kind: 'curio', title: 'FOSSILIZED STORM FIREFLY', lore: 'Bioluminescent cyan-mint insect preserved inside translucent abyssal resin.' },
  { id: 'curio_foundry_gear', kind: 'blueprint', title: 'MASTERWORK ESCAPEMENT', lore: 'Self-lubricating clockwork gear train salvaged from a dormant steam spire.' },
  { id: 'curio_frost_prism', kind: 'curio', title: 'PERMAFROST CORONA SHARD', lore: 'Never-melting glacial crystal that hums softly during upper-atmosphere gales.' },
  { id: 'curio_rune_tuning_fork', kind: 'blueprint', title: 'RESONANCE TUNING FORK', lore: 'Strikes the exact pentatonic pitch needed to wake ancient monolith bell sanctums.' },
  { id: 'curio_kelp_lantern', kind: 'curio', title: 'ABYSSAL SPORE LANTERN', lore: 'Glass diver flask filled with glowing trench flora that guides MK.7 crews home.' },
  { id: 'curio_skimmer_fin', kind: 'blueprint', title: 'HYDRO-FOIL VORTEX KEEL', lore: 'Titanium-brass wave-carving fin engineered for storm-swell slalom runs.' },
  { id: 'curio_sky_compass', kind: 'curio', title: 'THERMAL GYRO COMPASS', lore: 'Gimbaled navigator sphere carried by summit Sky-Wing gliders between sectors.' },
  { id: 'curio_obsidian_key', kind: 'curio', title: 'MONOLITH KEYSTONE SEAL', lore: 'Carved indigo-basalt emblem bearing the original builder crest of Nebulus.' },
  { id: 'curio_tesla_filament', kind: 'blueprint', title: 'STORM CAPACITOR COIL', lore: 'Captures stray forked lightning arcs to illuminate blackout citadels.' },
  { id: 'curio_star_heart', kind: 'curio', title: 'DORMANT REACTOR SEED', lore: 'Crystalline heart of a decommissioned tower, radiating calm emerald warmth.' },
];

const FALLBACK_BLASTER_FX = [
  { id: 'standard_cryo', name: 'MK.4 Frostbite Cryo', description: 'Standard glacial ice-cyan bolts and frost mist.', pointsRequired: 0, gearCost: 0, previewColors: ['#7be8ff', '#e0f2fe', '#38bdf8'] },
  { id: 'emerald_plasma', name: 'Bioluminescent Surge', description: 'Abyssal emerald-mint bolts charged with kelp spores.', pointsRequired: 100, gearCost: 60, previewColors: ['#34d399', '#a7f3d0', '#10b981'] },
  { id: 'solar_ember', name: 'Smelter Forge Flare', description: 'Superheated molten-amber bolts from Sector II foundries.', pointsRequired: 250, gearCost: 110, previewColors: ['#fbbf24', '#fef08a', '#ea580c'] },
  { id: 'amethyst_void', name: 'Prism Singularity', description: 'Crystalline violet-magenta bolts resonating with Molecule cores.', pointsRequired: 450, gearCost: 160, previewColors: ['#c084fc', '#f5d0fe', '#9333ea'] },
  { id: 'retro_voxel', name: '1987 Arcade Pulse', description: 'Crisp neon-lime & electric-cyan classic 7800 energy spheres.', pointsRequired: 700, gearCost: 220, previewColors: ['#39ff14', '#ffffff', '#00f0ff'] },
  { id: 'diamond_prism', name: 'Millennium Aurora', description: 'Prismatic diamond-white bolts with iridescent starlight trails.', pointsRequired: 900, gearCost: 320, previewColors: ['#a5f3fc', '#f5d0fe', '#fde047'] },
];

const FALLBACK_RELIC_CODEX = [
  { id: 'relic_t1', towerId: 1, title: 'LOG 01 • DESTRUCTO SURVEY BEACON', lore: 'Eight self-sealing monoliths rose from the Nebulus shelf overnight. Their masonry predates our colonial charter—yet fresh iron conduits pump superheated brine straight into the trench.' },
  { id: 'relic_t2', towerId: 2, title: 'LOG 02 • THE SINKING RELIQUARY', lore: 'Hydrostatic sensors confirm Tower 2 is intentionally ballasting downward. Whoever built these spires designed the brass sluice valves to test amphibious climbers.' },
  { id: 'relic_t3', towerId: 3, title: 'LOG 03 • AUTOMATON FOUNDRY MANIFEST', lore: 'Clockwork sentinels continue stamping boiler plates with zero crew aboard. The runes etched behind the furnace arch match melodies sung by deep-trench bronze bells.' },
  { id: 'relic_t4', towerId: 4, title: 'LOG 04 • BOREAL THERMAL VORTEX', lore: 'Upper-atmosphere cryo-spires are flash-freezing storm fronts to feed the central core. Only MK.7 thermal wings can ride the updrafts between sectors.' },
  { id: 'relic_t5', towerId: 5, title: 'LOG 05 • AMETHYST MOLECULE SYNTHESIS', lore: 'The floating crystalline clusters are not wildlife—they are mobile phase-keys grown inside the Prism Labyrinth to guard the reactor harmonics.' },
  { id: 'relic_t6', towerId: 6, title: 'LOG 06 • HYDRAULIC TIDE DERRICK', lore: 'Every piston stroke synchronizes with Nebulus lunar perigee. Crack the astrolabe vaults and the monolith surrenders its reserve Star Cores.' },
  { id: 'relic_t7', towerId: 7, title: 'LOG 07 • TEMPEST BLACKOUT PROTOCOL', lore: 'Crown Tesla arrays drain ambient moonlight every nine seconds to blind orbital scans. Follow the amber cage-lift halos through the dark.' },
  { id: 'relic_t8', towerId: 8, title: 'LOG 08 • OPERATION NEBULUS DIRECTIVE', lore: 'Final transmission to Specialist Pogo: plant the summit charges at the Apex crown. When the eighth monolith topples, Planet Nebulus breathes free again.' },
];

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
  gesture: `
    <svg class="ico-svg" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 12h16M7 9l-3 3 3 3M17 9l3 3-3 3" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`,
  joystick: `
    <svg class="ico-svg" viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="8.5" r="4" fill="currentColor"/>
      <path d="M12 12.5v5M6 19h12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
    </svg>`,
  dpad: `
    <svg class="ico-svg" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M9.5 4h5v5.5H20v5h-5.5V20h-5v-5.5H4v-5h5.5V4Z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/>
    </svg>`,
  tilt: `
    <svg class="ico-svg" viewBox="0 0 24 24" aria-hidden="true">
      <rect x="4" y="7" width="16" height="10" rx="2.2" transform="rotate(-14 12 12)" fill="none" stroke="currentColor" stroke-width="1.8"/>
      <circle cx="12" cy="12" r="1.8" fill="currentColor"/>
    </svg>`,
};

const CTRL_SHORT_CODES = {
  gesture: 'GESTURE',
  joystick: 'STICK',
  dpad: 'D-PAD',
  tilt: 'TILT',
};

const DIR_CHEVRON_SVGS = {
  left: `<svg class="ico-dir" viewBox="0 0 12 12"><path d="M8 2L3.5 6L8 10" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  right: `<svg class="ico-dir" viewBox="0 0 12 12"><path d="M4 2L8.5 6L4 10" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  up: `<svg class="ico-dir" viewBox="0 0 12 12"><path d="M2 8.5L6 3.5L10 8.5" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
};

const PROMPT_ICONS = {
  up: `<svg class="ico-svg" viewBox="0 0 16 16"><path d="M3.5 10.5L8 5l4.5 5.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  updown: `<svg class="ico-svg" viewBox="0 0 16 16"><path d="M4.5 6.5L8 3l3.5 3.5M4.5 9.5L8 13l3.5-3.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  cryo: `<svg class="ico-svg" viewBox="0 0 16 16"><g stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><line x1="8" y1="2" x2="8" y2="14"/><line x1="2.8" y1="5" x2="13.2" y2="11"/><line x1="13.2" y1="5" x2="2.8" y2="11"/></g></svg>`,
  bolt: `<svg class="ico-svg" viewBox="0 0 16 16"><path d="M9.2 1.5L3.5 9h4.2l-.9 5.5L12.5 7H8.3l.9-5.5Z" fill="currentColor"/></svg>`,
  rune: `<svg class="ico-svg" viewBox="0 0 16 16"><path d="M8 1.6 13.4 8 8 14.4 2.6 8 8 1.6Z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><circle cx="8" cy="8" r="1.8" fill="currentColor"/></svg>`,
  wing: `<svg class="ico-svg" viewBox="0 0 16 16"><path d="M1.5 7.5 8 3.2l6.5 4.3-4.2 1L8 11.8 5.7 8.5l-4.2-1Z" fill="currentColor"/></svg>`,
  craft: `<svg class="ico-svg" viewBox="0 0 24 24"><use href="#ico-craft"/></svg>`,
  key: `<svg class="ico-svg" viewBox="0 0 24 24"><use href="#ico-key"/></svg>`,
  curio: `<svg class="ico-svg" viewBox="0 0 24 24"><use href="#ico-curio"/></svg>`,
};

const FALLBACK_SECTOR_WORLDS = [
  {
    id: 1,
    code: 'SECTOR I',
    name: 'THE DROWNED WATCH',
    blurb: 'Moonlit storm approach and surging abyssal reliquary.',
    towerIds: [1, 2],
    intraRoute: { mode: 'submarine', label: 'SEA ROUTE • SUB-HUNTER' },
    summitRoute: { mode: 'glide', label: 'SUMMIT SKY-WING • THE GLIDE' },
  },
  {
    id: 2,
    code: 'SECTOR II',
    name: 'SMELTER & BOREAL REACH',
    blurb: 'Pressurized steam foundries into howling arctic crosswinds.',
    towerIds: [3, 4],
    intraRoute: { mode: 'skimmer', label: 'STORM SPRINT • HYDRO-SKIMMER' },
    summitRoute: { mode: 'glide', label: 'SUMMIT SKY-WING • THE GLIDE' },
  },
  {
    id: 3,
    code: 'SECTOR III',
    name: 'ARCANE & HYDRAULIC TRENCH',
    blurb: 'Resonator prism laser vaults and offshore hydraulic pistons.',
    towerIds: [5, 6],
    intraRoute: { mode: 'submarine', label: 'TRENCH ROUTE • SUB-HUNTER' },
    summitRoute: { mode: 'glide', label: 'SUMMIT SKY-WING • THE GLIDE' },
  },
  {
    id: 4,
    code: 'SECTOR IV',
    name: 'MAELSTROM CORE',
    blurb: 'Blackout thunder citadel leading to the eclipsed Apex reactor.',
    towerIds: [7, 8],
    intraRoute: { mode: 'skimmer', label: 'MAELSTROM SPRINT • HYDRO-SKIMMER' },
    summitRoute: null,
  },
];

// ================= DIEGETIC ARTWORK BRIDGES (WITH SCULPTED FALLBACKS) =================
function getArtTitleCrestSVG(era = 'reboot') {
  if (uiArtMod && typeof uiArtMod.getTitleCrestSVG === 'function') {
    return uiArtMod.getTitleCrestSVG(era);
  }
  const sub = era === 'original' ? "NEBULUS ARCHIVE · '87" : "OPERATION NEBULUS · '26";
  const accent = era === 'original' ? '#00f0ff' : '#5ef2ff';
  const brass = era === 'original' ? '#ffe600' : '#d99b38';
  return `
    <svg viewBox="0 0 560 195" class="title-crest-svg" aria-hidden="true">
      <defs>
        <linearGradient id="fbCrestMetal" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#ffffff"/>
          <stop offset="48%" stop-color="#d6eeff"/>
          <stop offset="100%" stop-color="${accent}"/>
        </linearGradient>
        <linearGradient id="fbRibbon" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stop-color="#0a1326" stop-opacity="0.92"/>
          <stop offset="50%" stop-color="#142544" stop-opacity="0.96"/>
          <stop offset="100%" stop-color="#0a1326" stop-opacity="0.92"/>
        </linearGradient>
      </defs>
      <g class="crest-astrolabe-spin" opacity="0.72">
        <circle cx="280" cy="88" r="76" fill="none" stroke="${brass}" stroke-width="1.6" stroke-dasharray="10 6"/>
        <circle cx="280" cy="88" r="62" fill="none" stroke="${accent}" stroke-width="1.1" stroke-dasharray="4 5" opacity="0.75"/>
      </g>
      <path d="M74 96 L156 80 L144 108 Z M486 96 L404 80 L416 108 Z" fill="${brass}" fill-opacity="0.32" stroke="${brass}" stroke-width="1.2"/>
      <path d="M266 20 L294 20 L300 66 L260 66 Z" fill="#0d1830" stroke="${brass}" stroke-width="1.4"/>
      <polygon points="280,8 284,18 294,19 286,25 289,35 280,29 271,35 274,25 266,19 276,18" fill="${accent}"/>
      <text x="280" y="102" text-anchor="middle" font-family="Orbitron, sans-serif" font-weight="900" font-size="44" letter-spacing="5" fill="#050b18" stroke="#050b18" stroke-width="8">TOWER TOPPLER</text>
      <text x="280" y="98" text-anchor="middle" font-family="Orbitron, sans-serif" font-weight="900" font-size="44" letter-spacing="5" fill="url(#fbCrestMetal)" stroke="${brass}" stroke-width="1.1">TOWER TOPPLER</text>
      <polygon points="132,126 428,126 444,145 428,164 132,164 116,145" fill="url(#fbRibbon)" stroke="${brass}" stroke-width="1.6"/>
      <text x="280" y="150" text-anchor="middle" font-family="Orbitron, sans-serif" font-weight="800" font-size="13.5" letter-spacing="4.2" fill="#ffe082">${sub}</text>
    </svg>
  `;
}

function getArtPlayMedallionSVG(era = 'reboot') {
  if (uiArtMod && typeof uiArtMod.getPlayMedallionSVG === 'function') {
    return uiArtMod.getPlayMedallionSVG(era);
  }
  const brass = era === 'original' ? '#ffe600' : '#d99b38';
  const cyan = era === 'original' ? '#00f0ff' : '#5ef2ff';
  return `
    <svg viewBox="0 0 380 110" preserveAspectRatio="none" aria-hidden="true">
      <polygon points="24,5 356,5 375,55 356,105 24,105 5,55" fill="rgba(8,18,38,0.88)" stroke="${brass}" stroke-width="2"/>
      <polygon points="30,11 350,11 367,55 350,99 30,99 13,55" fill="none" stroke="${cyan}" stroke-width="1" stroke-opacity="0.45"/>
      <circle cx="32" cy="55" r="8" fill="none" stroke="${brass}" stroke-width="1.4"/>
      <circle cx="348" cy="55" r="8" fill="none" stroke="${brass}" stroke-width="1.4"/>
    </svg>
  `;
}

function getArtExpeditionSVG(modeId, era = 'reboot') {
  if (uiArtMod && typeof uiArtMod.getExpeditionArtSVG === 'function') {
    return uiArtMod.getExpeditionArtSVG(modeId, era);
  }
  const tint = modeId === 'casual' ? '#42f5aa' : modeId === 'endless' ? '#c084fc' : '#ffe082';
  return `
    <svg viewBox="0 0 220 250" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <rect width="220" height="250" fill="#071124"/>
      <circle cx="160" cy="56" r="26" fill="${tint}" fill-opacity="0.22"/>
      <path d="M84 64 L136 64 L148 210 L72 210 Z" fill="#101f3c" stroke="${tint}" stroke-opacity="0.45" stroke-width="1.5"/>
      <path d="M0 198 Q55 182 110 198 T220 198 L220 250 L0 250 Z" fill="#0b2847"/>
    </svg>
  `;
}

function getArtMinigamePortalSVG(gameId, era = 'reboot') {
  if (uiArtMod && typeof uiArtMod.getMinigamePortalSVG === 'function') {
    return uiArtMod.getMinigamePortalSVG(gameId, era);
  }
  const accentMap = {
    submarine: '#38bdf8',
    glide: '#7be8ff',
    skimmer: '#42f5aa',
    puzzle: '#c084fc',
    vault: '#fbbf24',
  };
  const c = accentMap[gameId] || '#7be8ff';
  return `
    <svg viewBox="0 0 380 132" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <rect width="380" height="132" fill="#071126"/>
      <circle cx="305" cy="44" r="34" fill="${c}" fill-opacity="0.20"/>
      <circle cx="305" cy="44" r="20" fill="none" stroke="${c}" stroke-opacity="0.55" stroke-width="1.5" stroke-dasharray="6 4"/>
      <path d="M0 96 Q95 76 190 96 T380 92 L380 132 L0 132 Z" fill="#0b1f3d"/>
    </svg>
  `;
}

function getArtTrophyShieldSVG(tier = 'aluminum', unlocked = true) {
  if (uiArtMod && typeof uiArtMod.getTrophyShieldSVG === 'function') {
    return uiArtMod.getTrophyShieldSVG(tier, unlocked);
  }
  const palette = {
    aluminum: ['#cbd5e1', '#475569'],
    copper: ['#fbbf24', '#9a3412'],
    platinum: ['#e0f2fe', '#0284c7'],
    diamond: ['#f5d0fe', '#7c3aed'],
  };
  const [hi, lo] = unlocked ? (palette[tier] || palette.aluminum) : ['#64748b', '#1e293b'];
  return `
    <svg viewBox="0 0 56 64" aria-hidden="true">
      <polygon points="28,3 51,14 47,43 28,60 9,43 5,14" fill="${lo}" fill-opacity="0.55" stroke="${hi}" stroke-width="2"/>
      <polygon points="28,10 44,18 41,40 28,52 15,40 12,18" fill="none" stroke="${hi}" stroke-opacity="0.45" stroke-width="1.2"/>
      ${
        unlocked
          ? `<polygon points="28,18 32,27 41,28 34,34 36,43 28,38 20,43 22,34 15,28 24,27" fill="${hi}"/>`
          : `<rect x="21" y="27" width="14" height="11" rx="2" fill="none" stroke="${hi}" stroke-width="1.8"/><path d="M24 27v-3.5a4 4 0 0 1 8 0V27" fill="none" stroke="${hi}" stroke-width="1.8"/>`
      }
    </svg>
  `;
}

// ================= FORMATTING & HUD HELPERS =================
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

function renderActionPromptMarkup(rawText) {
  const upper = String(rawText || '').toUpperCase();
  let icon = PROMPT_ICONS.up;
  if (rawText.includes('▲▼') || (upper.includes('LIFT') && upper.includes('RIDE')) || upper.includes('CAGE')) {
    icon = PROMPT_ICONS.updown;
  } else if (upper.includes('CRAFT') || upper.includes('WORKBENCH') || upper.includes('DYNAMO') || upper.includes('REPAIR') || upper.includes('FIX')) {
    icon = PROMPT_ICONS.craft;
  } else if (upper.includes('CHEST') || upper.includes('KEY') || upper.includes('TREASURE')) {
    icon = PROMPT_ICONS.key;
  } else if (upper.includes('CURIO') || upper.includes('ARTIFACT')) {
    icon = PROMPT_ICONS.curio;
  } else if (upper.includes('RUNE') || upper.includes('CHAMBER') || upper.includes('PUZZLE') || upper.includes('BELL') || upper.includes('MIRROR')) {
    icon = PROMPT_ICONS.rune;
  } else if (upper.includes('GLIDE') || upper.includes('FLAP') || upper.includes('WING')) {
    icon = PROMPT_ICONS.wing;
  } else if (upper.includes('CALL') || upper.includes('CRYO') || upper.includes('SNOW')) {
    icon = PROMPT_ICONS.cryo;
  } else if (upper.includes('BOOST')) {
    icon = PROMPT_ICONS.bolt;
  }
  const cleanLabel = upper
    .replace(/->/g, '•')
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}▲▼◀▶]/gu, '')
    .trim();
  return `${icon}<span>${cleanLabel}</span>`;
}

function renderMissionStatusMarkup(rawStatus) {
  const upper = String(rawStatus || '').toUpperCase();
  let icon = PROMPT_ICONS.curio;
  if (upper.includes('PART') || upper.includes('WORKBENCH') || upper.includes('DYNAMO') || upper.includes('CRAFT') || upper.includes('FIX') || upper.includes('REPAIR')) {
    icon = PROMPT_ICONS.craft;
  } else if (upper.includes('KEY') || upper.includes('CHEST') || upper.includes('TREASURE')) {
    icon = PROMPT_ICONS.key;
  } else if (upper.includes('RUNE') || upper.includes('PUZZLE') || upper.includes('SWITCH')) {
    icon = PROMPT_ICONS.rune;
  }
  const clean = upper
    .replace(/->/g, '•')
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}▲▼◀▶]/gu, '')
    .trim();
  return `${icon}<span>${clean}</span>`;
}

// Inject static control icons into diegetic popover & pause pills
document.querySelectorAll('[data-ctrl-ico]').forEach((slot) => {
  const key = slot.dataset.ctrlIco || 'gesture';
  slot.innerHTML = CTRL_SVGS[key] || CTRL_SVGS.gesture;
});

// ================= INITIALIZE ENGINE INSTANCES =================
const initSettings = progression.getSettings();

const input = new InputController({
  mode: initSettings.controlMode || 'gesture',
  hapticsEnabled: initSettings.hapticsEnabled !== false,
});
input.setTiltSensitivity?.(initSettings.tiltSensitivity ?? 1.0);

const renderer = new GameRenderer(canvas);
renderer.setEra?.(initSettings.era || 'reboot');
renderer.setSkin?.(progression.getEquippedSkin());
renderer.setBlasterFx?.(progression.getEquippedBlasterFx?.() || initSettings.blasterFxId || 'standard_cryo');

sound.setEra?.(initSettings.era || 'reboot');
sound.setZenMode?.(Boolean(initSettings.zenMode));
sound.setMuted?.(Boolean(initSettings.muted));
sound.setMusicEnabled?.(initSettings.musicEnabled !== false);

// Banner & Trophy Toast Timers
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
    (sum, t) => sum + (progression.isTrophyUnlocked(t.id) ? (t.points || 5) : 0),
    0
  );
}

function getRankTitleForPoints(pts) {
  if (pts >= 1000) return 'MILLENNIUM TOPPLER';
  if (pts >= 700) return 'NEBULUS SOVEREIGN';
  if (pts >= 450) return 'ABYSSAL VANGUARD';
  if (pts >= 200) return 'STORM OPERATIVE';
  if (pts >= 50) return 'MONOLITH SCOUT';
  return 'AMPHIBIOUS CADET';
}

function pumpTrophyQueue() {
  if (trophyToastBusy || trophyQueue.length === 0 || !trophyToastEl) return;
  trophyToastBusy = true;
  const trophy = trophyQueue.shift();
  const tier = trophy.tier || 'aluminum';
  const pts = trophy.points || (tier === 'diamond' ? 30 : tier === 'platinum' ? 20 : tier === 'copper' ? 10 : 5);

  trophyToastEl.classList.remove('tier-aluminum', 'tier-copper', 'tier-platinum', 'tier-diamond');
  trophyToastEl.classList.add(`tier-${tier}`);

  if (trophyToastIconEl) {
    trophyToastIconEl.innerHTML = getArtTrophyShieldSVG(tier, true);
  }
  if (trophyToastKickerEl) {
    trophyToastKickerEl.textContent = `${tier.toUpperCase()} TROPHY • +${pts} PTS`;
  }
  if (trophyToastTitleEl) trophyToastTitleEl.textContent = trophy.title || 'Trophy Unlocked';
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

// Track life pips & arrow state to avoid DOM churn at 60fps
let prevLivesRendered = -1;
function renderLivesPips(lives) {
  const count = Math.max(0, Math.floor(lives ?? 3));
  if (count === prevLivesRendered) return;
  const gained = prevLivesRendered >= 0 && count > prevLivesRendered;
  prevLivesRendered = count;

  if (!livesEl) return;
  livesEl.innerHTML = '';
  const slots = Math.max(3, count);
  for (let i = 0; i < slots; i++) {
    const pip = document.createElement('span');
    const active = i < count;
    pip.className = active
      ? (gained && i === count - 1 ? 'life-pip gain' : 'life-pip')
      : 'life-pip depleted';
    pip.innerHTML = FROG_LIFE_SVG;
    livesEl.appendChild(pip);
  }
}

let prevDirKey = '';
let prevPromptRaw = '';
let prevMissionStatusRaw = '';

let lastLaunch = {
  type: 'campaign',
  era: initSettings.era || 'reboot',
  towerIdx: 0,
  zenMode: Boolean(initSettings.zenMode),
  miniGame: 'submarine',
};

let gearsBeforeRun = progression.getGears();

const game = new TowerTopplerGame(
  renderer,
  input,
  {
    onHud(hud) {
      if (scoreEl) scoreEl.textContent = formatScore(hud.score);
      if (hiScoreEl) hiScoreEl.textContent = formatScore(hud.hiScore);
      if (gearsEl) gearsEl.textContent = String(hud.gears ?? progression.getGears());

      renderLivesPips(hud.lives);

      const isZenTower = Boolean(hud.zenMode) && hud.mode === 'tower';
      const isUrgent = !isZenTower && hud.timer <= 15 && (hud.mode === 'tower' || hud.mode === 'vault');

      if (timerEl) {
        timerEl.textContent = isZenTower ? 'ZEN' : formatTimerInt(hud.timer);
        timerEl.classList.toggle('zen', isZenTower);
        timerEl.classList.toggle('urgent', isUrgent);
      }

      if (timerRingEl && timerRingArcEl) {
        timerRingEl.classList.toggle('zen', isZenTower);
        timerRingEl.classList.toggle('urgent', isUrgent);
        const limit = Math.max(1, hud.timeLimit || 95);
        const ratio = isZenTower ? 1 : Math.max(0, Math.min(1, (hud.timer || 0) / limit));
        const dashOffset = RING_CIRCUMFERENCE * (1 - ratio);
        timerRingArcEl.style.strokeDashoffset = dashOffset.toFixed(2);
      }

      if (dirArrowEl) {
        const dirKey = hud.dirHint === '◀' ? 'left' : hud.dirHint === '▶' ? 'right' : 'up';
        if (dirKey !== prevDirKey) {
          prevDirKey = dirKey;
          dirArrowEl.innerHTML = DIR_CHEVRON_SVGS[dirKey];
        }
      }
      if (towerBadgeEl) {
        if (hud.mode === 'submarine') towerBadgeEl.textContent = 'SUB';
        else if (hud.mode === 'skimmer') towerBadgeEl.textContent = 'SKIM';
        else if (hud.mode === 'glide') towerBadgeEl.textContent = 'GLIDE';
        else if (hud.mode === 'puzzle') towerBadgeEl.textContent = 'RUNE';
        else if (hud.mode === 'vault') towerBadgeEl.textContent = 'VAULT';
        else if (hud.runType === 'daily') towerBadgeEl.textContent = 'DAILY';
        else if (hud.runType === 'endless_casual') towerBadgeEl.textContent = `EXP${hud.towerId || 1}`;
        else if (hud.runType === 'endless') towerBadgeEl.textContent = `S${hud.towerId || 1}`;
        else towerBadgeEl.textContent = `T${hud.towerId || 1}`;
      }

      if (missionStatusPillEl) {
        const mRaw = (hud.mode === 'tower' || hud.mode === 'topple') && hud.missionStatus ? String(hud.missionStatus) : '';
        if (mRaw) {
          if (mRaw !== prevMissionStatusRaw) {
            prevMissionStatusRaw = mRaw;
            missionStatusPillEl.innerHTML = renderMissionStatusMarkup(mRaw);
          }
          missionStatusPillEl.classList.remove('hidden');
        } else {
          prevMissionStatusRaw = '';
          missionStatusPillEl.classList.add('hidden');
        }
      }

      const showAlt = (hud.mode === 'tower' || hud.mode === 'topple') && !isTitleScreenOpen();
      if (altMeterEl) {
        altMeterEl.classList.toggle('hidden', !showAlt);
        const altPct = Math.max(0, Math.min(100, hud.altitudePct ?? 0));
        const waterPct = Math.max(0, Math.min(100, hud.waterPct ?? 0));
        if (altFillEl) altFillEl.style.height = `${altPct}%`;
        if (altPipEl) altPipEl.style.bottom = `${altPct}%`;
        if (altWaterEl) altWaterEl.style.height = `${waterPct}%`;
        altMeterEl.classList.toggle('sinking', waterPct > 1);
      }

      if (actionPromptEl) {
        let promptRaw = hud.actionPrompt || '';
        if (!promptRaw && hud.mode === 'skimmer' && (hud.boostMult || 1) > 1) {
          promptRaw = `BOOST ${hud.boostMult}X`;
        }
        const activeMode =
          (hud.mode === 'tower' ||
            hud.mode === 'submarine' ||
            hud.mode === 'skimmer' ||
            hud.mode === 'glide' ||
            hud.mode === 'puzzle' ||
            hud.mode === 'vault') &&
          !isTitleScreenOpen();
        if (promptRaw && activeMode) {
          if (promptRaw !== prevPromptRaw) {
            prevPromptRaw = promptRaw;
            actionPromptEl.innerHTML = renderActionPromptMarkup(promptRaw);
          }
          actionPromptEl.classList.remove('hidden');
        } else {
          prevPromptRaw = '';
          actionPromptEl.classList.add('hidden');
        }
      }
    },

    onBanner: showBanner,

    onTrophy: enqueueTrophyToast,

    onGameOver(victory, score, hiScore, summary = {}) {
      sound.setMusicActive?.(false);
      input.resetState?.();
      if (actionPromptEl) actionPromptEl.classList.add('hidden');
      if (missionStatusPillEl) missionStatusPillEl.classList.add('hidden');
      if (altMeterEl) altMeterEl.classList.add('hidden');

      if (gameoverCardEl) {
        gameoverCardEl.dataset.outcome = victory ? 'victory' : 'defeat';
      }

      if (goBadge) {
        if (victory) {
          goBadge.textContent =
            game.runType === 'daily'
              ? 'DAILY MONOLITH CONQUERED'
              : game.runType === 'endless_casual'
                ? 'EXPEDITION COMPLETE'
                : game.runType === 'minigame'
                  ? 'SIMULATION COMPLETE'
                  : 'PLANET NEBULUS SAVED';
        } else {
          goBadge.textContent =
            game.runType === 'endless_casual'
              ? 'EXPEDITION CONCLUDED'
              : game.runType === 'endless'
                ? 'ABYSS RUN ENDED'
                : 'MISSION ENDED';
        }
      }

      if (goTitle) {
        goTitle.textContent = victory
          ? game.runType === 'minigame'
            ? 'STAGE CLEAR'
            : 'VICTORY'
          : 'GAME OVER';
      }

      if (goScore) goScore.textContent = Number(score || 0).toLocaleString();
      if (goHi) goHi.textContent = Number(hiScore || 0).toLocaleString();

      if (goStars) {
        if (summary && summary.stars) {
          goStars.innerHTML = starsToSvgHtml(summary.stars);
        } else if (game.runType === 'endless') {
          const depth = summary?.towersCleared ?? Math.max(0, (game.tower?.id || 1) - 1);
          goStars.textContent = `${depth} SECTORS`;
        } else if (game.tower?.id && (game.runType === 'reboot_campaign' || game.runType === 'original_campaign')) {
          goStars.innerHTML = starsToSvgHtml(progression.getTowerStars(game.era, game.tower.id));
        } else {
          goStars.innerHTML = starsToSvgHtml({ clear: victory, vault: victory, speed: victory });
        }
      }

      const totalGears = progression.getGears();
      const earnedGears =
        summary?.gearsEarned != null
          ? summary.gearsEarned
          : Math.max(0, totalGears - gearsBeforeRun);
      if (goGears) {
        goGears.innerHTML =
          earnedGears > 0
            ? `${SVG_GEAR}<span>+${earnedGears} (${totalGears})</span>`
            : `${SVG_GEAR}<span>${totalGears}</span>`;
      }
      if (gearsEl) gearsEl.textContent = String(totalGears);

      refreshTitleMeta();

      if (victory && game.runType === 'reboot_campaign' && !hasSeenCutscene('epilogue')) {
        markCutsceneSeen('epilogue');
        playStoryCutscene('epilogue', {
          previewMode: true,
          onComplete: () => {
            overlayGameOver?.classList.remove('hidden');
            syncTitleShowcaseState();
          },
        });
      } else {
        overlayGameOver?.classList.remove('hidden');
        syncTitleShowcaseState();
      }
    },
  },
  progression
);

game.applySettings?.(progression.getSettings());

// ================= TITLE DIORAMA & CHROME VISIBILITY SYNC =================
function isTitleScreenOpen() {
  return Boolean(overlayTitle && !overlayTitle.classList.contains('hidden'));
}

function closeTitleDrawers() {
  titleSettingsDrawer?.classList.add('hidden');
  btnTitleSettings?.setAttribute('aria-expanded', 'false');
  btnTitleSettings?.classList.remove('active');
  expeditionsDrawerEl?.classList.add('hidden');
  btnExpeditions?.setAttribute('aria-expanded', 'false');
  btnExpeditions?.classList.remove('active');
}

function syncTitleShowcaseState() {
  const titleOpen = isTitleScreenOpen();
  const wardrobeOpen = Boolean(overlayWardrobe && !overlayWardrobe.classList.contains('hidden'));
  const menuAnyOpen =
    titleOpen ||
    wardrobeOpen ||
    Boolean(overlayWorlds && !overlayWorlds.classList.contains('hidden')) ||
    Boolean(overlayTrophies && !overlayTrophies.classList.contains('hidden')) ||
    Boolean(overlayMinigames && !overlayMinigames.classList.contains('hidden')) ||
    cutsceneState.active;

  if (appEl) {
    appEl.dataset.titleOpen = titleOpen ? 'true' : 'false';
    appEl.dataset.wardrobeOpen = wardrobeOpen ? 'true' : 'false';
  }
  game.titleShowcase = titleOpen;
  game.wardrobeSpotlight = wardrobeOpen;

  const hideGameplayChrome = menuAnyOpen && game.mode === 'title' || cutsceneState.active || wardrobeOpen || titleOpen;
  hudEl?.classList.toggle('hidden', hideGameplayChrome);
  touchControlsEl?.classList.toggle('hidden', hideGameplayChrome);
}

// ================= UI STATE SYNC & DIEGETIC ARTWORK MOUNTING =================
let prevArtEraMounted = '';

function mountDiegeticArtwork(force = false) {
  const era = progression.getSettings().era || 'reboot';
  if (!force && prevArtEraMounted === era && titleCrestStageEl?.innerHTML) return;
  prevArtEraMounted = era;

  if (titleCrestStageEl) {
    titleCrestStageEl.innerHTML = getArtTitleCrestSVG(era);
  }
  if (playMedallionSvgEl) {
    playMedallionSvgEl.innerHTML = getArtPlayMedallionSVG(era);
  }
  if (spireArtDailyEl) {
    spireArtDailyEl.innerHTML = getArtExpeditionSVG('daily', era);
  }
  if (spireArtEndlessEl) {
    spireArtEndlessEl.innerHTML = getArtExpeditionSVG('endless', era);
  }
  if (spireArtCasualEl) {
    spireArtCasualEl.innerHTML = getArtExpeditionSVG('casual', era);
  }
  portalArtEls.forEach((el) => {
    const gid = el.dataset.portalArt || 'submarine';
    el.innerHTML = getArtMinigamePortalSVG(gid, era);
  });
}

function syncAudioButtons() {
  const s = progression.getSettings();
  const soundSvg = sound.muted ? SVG_SOUND_OFF : SVG_SOUND_ON;
  const musicSvg = sound.musicEnabled ? SVG_MUSIC_ON : SVG_MUSIC_OFF;

  if (btnSound) {
    btnSound.innerHTML = soundSvg;
    btnSound.classList.toggle('is-off', Boolean(sound.muted));
  }
  if (btnTitleSound) {
    btnTitleSound.innerHTML = `${soundSvg}<span>${sound.muted ? 'SFX OFF' : 'SFX ON'}</span>`;
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
  if (gearsEl) gearsEl.textContent = String(progression.getGears());
  if (hiScoreEl) hiScoreEl.textContent = formatScore(progression.getHighScore(s.era || 'reboot'));
}

function syncZenUI(zenMode) {
  const isZen = Boolean(zenMode);
  if (toggleZenInput) toggleZenInput.checked = isZen;
  if (btnZenPill) {
    btnZenPill.classList.toggle('active', isZen);
    btnZenPill.setAttribute('aria-pressed', String(isZen));
  }
  if (zenPillLabelEl) {
    zenPillLabelEl.textContent = isZen ? 'CASUAL ZEN • ON' : 'CASUAL ZEN • OFF';
  }
}

function updateSelectedTowerRibbon(era) {
  if (!startTowerSelect) return;
  const towers = createTowers(era);
  const idx = Math.max(0, Math.min(towers.length - 1, Number(startTowerSelect.value) || 0));
  const tower = towers[idx];
  const stars = tower ? progression.getTowerStars(era, tower.id) : null;

  if (selectedTowerStarsEl) {
    selectedTowerStarsEl.innerHTML = starsToSvgHtml(stars);
  }
  if (heroSectorNameEl && tower) {
    heroSectorNameEl.textContent = `T${tower.id} • ${String(tower.name || '').toUpperCase()}`;
  }

  const sectorNum = Math.floor(idx / 2) + 1;
  const roman = ['I', 'II', 'III', 'IV'][sectorNum - 1] || String(sectorNum);
  const isZen = Boolean(progression.getSettings().zenMode);

  if (heroPlayKickerEl) {
    heroPlayKickerEl.textContent =
      era === 'original'
        ? `1987 ARCHIVE • TOWER ${idx + 1}${isZen ? ' • ZEN' : ''}`
        : `SECTOR ${roman} • ${isZen ? 'ZEN ASCENT' : 'OPERATION NEBULUS'}`;
  }
  if (heroPlayLabelEl) {
    heroPlayLabelEl.textContent = era === 'original' ? 'LAUNCH TOWER' : 'ASCEND MONOLITH';
  }
}

// ================= SEQUENTIAL PROGRESSION & CUTSCENE ENGINE =================
const CUTSCENE_STORAGE_KEY = 'tt26_cutscenes_v1';
const seenCutscenesMem = new Set();
try {
  const rawSeen = localStorage.getItem(CUTSCENE_STORAGE_KEY);
  if (rawSeen) {
    JSON.parse(rawSeen).forEach((k) => seenCutscenesMem.add(k));
  }
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

function isTowerUnlockedForCampaign(era, towerId) {
  if (!towerId || towerId <= 1) return true;
  return Boolean(progression.getTowerStars(era, towerId - 1)?.clear);
}

const cutsceneState = {
  active: false,
  kind: 'prologue',
  beatIdx: 0,
  elapsed: 0,
  cameraDuration: 9.0,
  charIdx: 0,
  fullText: '',
  previewMode: false,
  prevMode: null,
  onComplete: null,
};

function renderCutsceneBeat() {
  const def = STORY_CUTSCENES[cutsceneState.kind];
  if (!def) return;
  const beat = def.beats[cutsceneState.beatIdx];
  if (!beat) return;

  if (cutsceneActPillEl) cutsceneActPillEl.textContent = def.act;
  if (cutsceneTitleEl) cutsceneTitleEl.textContent = def.title;
  if (cutsceneCommsBoxEl) cutsceneCommsBoxEl.dataset.speaker = beat.speaker;
  if (cutscenePortraitEl) cutscenePortraitEl.innerHTML = HOLO_PORTRAITS[beat.speaker] || HOLO_PORTRAITS.mara;
  if (cutsceneSpeakerEl) cutsceneSpeakerEl.textContent = beat.name;

  if (cutsceneStepDotsEl) {
    cutsceneStepDotsEl.innerHTML = def.beats
      .map((_, i) => `<span class="cinema-dot${i === cutsceneState.beatIdx ? ' active' : ''}"></span>`)
      .join('');
  }

  cutsceneState.fullText = beat.text;
  cutsceneState.charIdx = 0;
  if (cutsceneTextEl) cutsceneTextEl.textContent = '';

  if (btnCutsceneNext) {
    const isLast = cutsceneState.beatIdx >= def.beats.length - 1;
    btnCutsceneNext.textContent = isLast ? 'CONTINUE ›' : 'NEXT ›';
  }
}

function playStoryCutscene(kind, { previewMode = false, onComplete = null } = {}) {
  const def = STORY_CUTSCENES[kind];
  if (!def || !overlayCutscene) {
    onComplete?.();
    return;
  }

  clearBanner();
  input.resetState?.();
  if (actionPromptEl) actionPromptEl.classList.add('hidden');
  if (missionStatusPillEl) missionStatusPillEl.classList.add('hidden');
  if (altMeterEl) altMeterEl.classList.add('hidden');

  cutsceneState.active = true;
  cutsceneState.kind = kind;
  cutsceneState.beatIdx = 0;
  cutsceneState.elapsed = 0;
  cutsceneState.previewMode = previewMode;
  cutsceneState.prevMode = game.mode;
  cutsceneState.onComplete = onComplete;

  if (previewMode) {
    const rebootTowers = createTowers('reboot');
    const targetTower = rebootTowers[def.towerIdx] || rebootTowers[0];
    renderer.setEra?.('reboot');
    game.era = 'reboot';
    game.loadTower(targetTower);
    clearBanner();
    game.mode = 'tower';
    if (game.player) {
      game.player.invuln = 0;
      game.player.victory = kind === 'epilogue';
    }
  } else if (game.player) {
    game.player.invuln = 0;
  }

  game.cutsceneCam = { active: true, phase: 0, kind };
  renderCutsceneBeat();
  overlayCutscene.classList.remove('hidden');
  syncTitleShowcaseState();
}

function finishCutscene() {
  if (!cutsceneState.active) return;
  cutsceneState.active = false;
  game.cutsceneCam = null;
  renderer.setCutsceneCam?.(null);
  if (game.player) {
    game.player.victory = false;
  }
  overlayCutscene?.classList.add('hidden');

  if (cutsceneState.previewMode) {
    const s = progression.getSettings();
    const savedEra = s.era || 'reboot';
    renderer.setEra?.(savedEra);
    game.era = savedEra;
    game.mode = cutsceneState.prevMode || 'title';
  }

  const cb = cutsceneState.onComplete;
  cutsceneState.onComplete = null;
  cb?.();
  syncTitleShowcaseState();
}

function advanceCutsceneStep() {
  if (!cutsceneState.active) return;
  sound.unlock();
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

// ================= TOWER SELECTION & DIORAMA PREVIEW =================
let selectedSeaChartIdx = 0;

function populateTowerSelect(era, keepIdx = null) {
  if (!startTowerSelect) return;
  const prevIdx = keepIdx != null ? keepIdx : Number(startTowerSelect.value) || 0;
  const towers = createTowers(era);
  startTowerSelect.innerHTML = '';
  let highestUnlockedIdx = 0;

  towers.forEach((t, i) => {
    const unlocked = isTowerUnlockedForCampaign(era, t.id);
    if (unlocked) highestUnlockedIdx = i;
    const stars = progression.getTowerStars(era, t.id);
    const count = stars?.count ?? ((stars?.clear ? 1 : 0) + (stars?.vault ? 1 : 0) + (stars?.speed ? 1 : 0));
    const opt = document.createElement('option');
    opt.value = String(i);
    if (unlocked) {
      opt.textContent = `${t.id}. ${t.name} [${count}/3]`;
    } else {
      opt.disabled = true;
      opt.textContent = `${t.id}. ${t.name} [CLEAR T${t.id - 1} TO UNLOCK]`;
    }
    startTowerSelect.appendChild(opt);
  });

  const clampedPrev = Math.max(0, Math.min(towers.length - 1, prevIdx));
  const chosenIdx = isTowerUnlockedForCampaign(era, towers[clampedPrev]?.id)
    ? clampedPrev
    : highestUnlockedIdx;
  startTowerSelect.value = String(chosenIdx);
  selectedSeaChartIdx = chosenIdx;
  updateSelectedTowerRibbon(era);
}

function loadTitlePreviewTower() {
  const s = progression.getSettings();
  const era = s.era || 'reboot';
  const towers = createTowers(era);
  const idx = Math.max(0, Math.min(towers.length - 1, Number(startTowerSelect?.value) || 0));
  updateSelectedTowerRibbon(era);
  game.era = era;
  game.loadTower(towers[idx] || 0);
  if (game.player) {
    game.player.invuln = 0;
    game.player.blasterFxId = getEquippedBlasterFxSafe();
    game.camCol = game.player.col ?? 0.5;
    game.camFloor = (game.player.floor ?? 0) + 1.15;
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
  const s = progression.getSettings();
  const era = s.era || 'reboot';

  eraTabBtns.forEach((btn) => {
    const active = btn.dataset.eraSelect === era;
    btn.classList.toggle('active', active);
    btn.setAttribute('aria-selected', String(active));
  });
  if (btnEraToggle) btnEraToggle.textContent = era === 'original' ? "'87" : "'26";

  if (titleSubEraEl) {
    titleSubEraEl.textContent = era === 'original' ? "NEBULUS ARCHIVE '87" : "OPERATION NEBULUS '26";
  }
  if (titleTaglineEl) {
    titleTaglineEl.textContent =
      era === 'original'
        ? 'Climb all 8 faithful 1987 Nebulus towers in glossy HD and pilot the classic MK.7 Mini-Submarine.'
        : 'Scale 8 storm-lashed oceanic monoliths, crack ancient core vaults, and topple the Abyssal Reactors.';
  }

  mountDiegeticArtwork();
  populateTowerSelect(era);
  syncZenUI(s.zenMode);

  // Daily Tower Spire Meta
  const { dateKey } = getDailySeed(new Date());
  const dailyRec = progression.getDailyRecord(dateKey);
  if (dailyMetaEl) {
    if (dailyRec && dailyRec.completed) {
      dailyMetaEl.textContent = `CLEARED • ${dailyRec.bestScore.toLocaleString()}`;
    } else if (dailyRec && dailyRec.played) {
      dailyMetaEl.textContent = `${dateKey} • ${dailyRec.bestScore.toLocaleString()}`;
    } else {
      dailyMetaEl.textContent = `${dateKey} • 20F`;
    }
  }

  // Endless Abyss & Casual Spire Meta
  const bestDepth = progression.getBestEndlessDepth();
  if (endlessMetaEl) {
    endlessMetaEl.textContent = bestDepth > 0 ? `BEST: ${bestDepth} SPIRES` : 'INFINITE CLIMB';
  }
  if (casualMetaEl) {
    const curios = getCurioCatalog();
    const foundCurios = typeof progression.getCollectedCurios === 'function'
      ? progression.getCollectedCurios().length
      : 0;
    casualMetaEl.textContent = foundCurios > 0 ? `${foundCurios}/${curios.length} CURIOS` : 'CRAFT & CURIOS';
  }

  // 5-Crest Medallion Dock Badges (Compact, Zero-Overflow)
  const towers = createTowers(era);
  const unlockedTowers = towers.filter((t) => isTowerUnlockedForCampaign(era, t.id)).length;
  if (worldsDockBadgeEl) {
    worldsDockBadgeEl.textContent = `${unlockedTowers}/${towers.length}`;
  }

  const unlockedSkinsCount = SKIN_CATALOG.filter((sk) => progression.isSkinUnlocked(sk.id)).length;
  if (wardrobeBtnBadge) {
    wardrobeBtnBadge.textContent = `${unlockedSkinsCount}/${SKIN_CATALOG.length}`;
  }

  const trophyPts = computeTrophyPoints();
  if (trophiesBtnBadge) {
    trophiesBtnBadge.textContent = `${trophyPts} PTS`;
  }

  syncAudioButtons();
}

async function applyControlMode(mode, fromUserGesture = false) {
  const validMode = CONTROL_MODES.includes(mode) ? mode : 'gesture';
  if (validMode === 'tilt' && fromUserGesture) {
    try {
      await input.requestTiltPermission?.();
      input.calibrateTilt?.();
    } catch (_) {}
  }

  input.setControlMode(validMode);
  appEl.dataset.controlMode = validMode;
  progression.updateSettings({ controlMode: validMode });
  game.applySettings?.(progression.getSettings());

  if (selectControlMode) selectControlMode.value = validMode;
  if (pauseControlMode) pauseControlMode.value = validMode;
  if (btnCtrlMode) btnCtrlMode.innerHTML = CTRL_SVGS[validMode] || CTRL_SVGS.gesture;
  if (titleCtrlGlyphEl) titleCtrlGlyphEl.innerHTML = CTRL_SVGS[validMode] || CTRL_SVGS.gesture;
  if (titleCtrlCodeEl) titleCtrlCodeEl.textContent = CTRL_SHORT_CODES[validMode] || 'GESTURE';

  titleCtrlPickBtns.forEach((btn) => {
    const active = btn.dataset.ctrlPick === validMode;
    btn.classList.toggle('active', active);
    btn.setAttribute('aria-checked', String(active));
  });

  pauseCtrlPillBtns.forEach((btn) => {
    const active = btn.dataset.pauseCtrl === validMode;
    btn.classList.toggle('active', active);
    btn.setAttribute('aria-checked', String(active));
  });

  if (btnPauseCalibrate) {
    btnPauseCalibrate.classList.toggle('hidden', validMode !== 'tilt');
  }
}

function applyEra(era) {
  const nextEra = era === 'original' ? 'original' : 'reboot';
  appEl.dataset.era = nextEra;
  progression.updateSettings({ era: nextEra });
  renderer.setEra?.(nextEra);
  sound.setEra?.(nextEra);
  game.applySettings?.(progression.getSettings());
  refreshTitleMeta();

  if (game.mode === 'title') {
    loadTitlePreviewTower();
  }
}

// ================= ARMORY, BLASTER FX, 100 TROPHIES & RELIQUARY =================
let activeWardrobeTab = 'skins';
let activeTrophyView = 'trophies';
let activeTierFilter = 'all';

function getBlasterCatalog() {
  return Array.isArray(progMod.BLASTER_FX_CATALOG) && progMod.BLASTER_FX_CATALOG.length > 0
    ? progMod.BLASTER_FX_CATALOG
    : FALLBACK_BLASTER_FX;
}

function getRelicCatalog() {
  return Array.isArray(progMod.RELIC_CODEX) && progMod.RELIC_CODEX.length > 0
    ? progMod.RELIC_CODEX
    : FALLBACK_RELIC_CODEX;
}

function getCurioCatalog() {
  return Array.isArray(progMod.CURIO_CATALOG) && progMod.CURIO_CATALOG.length > 0
    ? progMod.CURIO_CATALOG
    : FALLBACK_CURIO_CATALOG;
}

function isBlasterFxUnlockedSafe(fx, trophyPts) {
  if (typeof progression.isBlasterFxUnlocked === 'function') {
    return progression.isBlasterFxUnlocked(fx.id);
  }
  const reqPts = fx.pointsRequired ?? fx.minPoints ?? fx.trophyPoints ?? 0;
  return fx.id === 'standard_cryo' || trophyPts >= reqPts;
}

function getEquippedBlasterFxSafe() {
  if (typeof progression.getEquippedBlasterFx === 'function') {
    return progression.getEquippedBlasterFx();
  }
  return progression.getSettings()?.blasterFxId || 'standard_cryo';
}

function syncWardrobeTabsUI() {
  wardrobeTabBtns.forEach((btn) => {
    const active = btn.dataset.wardrobeTab === activeWardrobeTab;
    btn.classList.toggle('active', active);
    btn.setAttribute('aria-selected', String(active));
  });
  wardrobeGridEl?.classList.toggle('hidden', activeWardrobeTab !== 'skins');
  blasterFxGridEl?.classList.toggle('hidden', activeWardrobeTab !== 'blaster');
}

function renderWardrobeModal() {
  const gears = progression.getGears();
  const equippedSkin = progression.getEquippedSkin();
  const equippedFx = getEquippedBlasterFxSafe();
  const trophyPts = computeTrophyPoints();
  const fxCatalog = getBlasterCatalog();

  if (wardrobeGearsEl) wardrobeGearsEl.textContent = String(gears);

  const unlockedSkins = SKIN_CATALOG.filter((s) => progression.isSkinUnlocked(s.id)).length;
  const unlockedFx = fxCatalog.filter((f) => isBlasterFxUnlockedSafe(f, trophyPts)).length;
  if (wardrobeSkinsTabLbl) wardrobeSkinsTabLbl.textContent = `POGO SKINS (${unlockedSkins}/${SKIN_CATALOG.length})`;
  if (wardrobeBlasterTabLbl) wardrobeBlasterTabLbl.textContent = `BLASTER FX (${unlockedFx}/${fxCatalog.length})`;

  syncWardrobeTabsUI();

  if (wardrobeGridEl) {
    wardrobeGridEl.innerHTML = '';
    SKIN_CATALOG.forEach((skin) => {
      const unlocked = progression.isSkinUnlocked(skin.id);
      const isEquipped = equippedSkin === skin.id;
      const [c1, c2, c3] = skin.previewColors || ['#56b847', '#d8e89b', '#7be8ff'];

      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `skin-card armory-crest-card${isEquipped ? ' equipped' : ''}${!unlocked ? ' locked' : ''}`;

      let actionMarkup = '<span>EQUIP</span>';
      if (isEquipped) {
        actionMarkup = '<span>EQUIPPED</span>';
      } else if (!unlocked) {
        actionMarkup =
          skin.gearCost > 0
            ? `<span>FORGE</span>${SVG_GEAR}<span>${skin.gearCost}</span>`
            : `<span>${skin.milestoneText || 'MILESTONE'}</span>`;
      }

      btn.innerHTML = `
        <div class="skin-top-row">
          <span class="skin-swatch" style="background: linear-gradient(135deg, ${c1} 0%, ${c2} 55%, ${c3} 100%);"></span>
          <span class="skin-name">${skin.name}</span>
        </div>
        <div class="skin-desc">${unlocked ? skin.description : (skin.milestoneText || skin.description)}</div>
        <span class="skin-action-tag">${actionMarkup}</span>
      `;

      btn.addEventListener('click', () => {
        sound.unlock();
        if (unlocked) {
          progression.equipSkin(skin.id);
          renderer.setSkin?.(skin.id);
          game.applySettings?.(progression.getSettings());
          if (game.player) game.player.skinId = skin.id;
          sound.switchToggle?.();
          renderWardrobeModal();
          refreshTitleMeta();
        } else if (skin.gearCost > 0) {
          const res = progression.unlockSkin(skin.id, true);
          if (res && res.unlocked) {
            if (Array.isArray(res.newlyUnlockedTrophies)) {
              res.newlyUnlockedTrophies.forEach(enqueueTrophyToast);
            }
            progression.equipSkin(skin.id);
            renderer.setSkin?.(skin.id);
            game.applySettings?.(progression.getSettings());
            if (game.player) game.player.skinId = skin.id;
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
      const unlocked = isBlasterFxUnlockedSafe(fx, trophyPts);
      const isEquipped = equippedFx === fx.id;
      const colors = fx.previewColors || [fx.color || '#7be8ff', fx.coreColor || '#ffffff', fx.trailColor || '#38bdf8'];
      const [c1, c2, c3] = [colors[0] || '#7be8ff', colors[1] || '#ffffff', colors[2] || colors[0] || '#38bdf8'];
      const reqPts = fx.pointsRequired ?? fx.minPoints ?? fx.trophyPoints ?? 0;
      const gearCost = fx.gearCost ?? fx.cost ?? 0;

      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `skin-card armory-crest-card${isEquipped ? ' equipped' : ''}${!unlocked ? ' locked' : ''}`;

      let actionMarkup = '<span>EQUIP FX</span>';
      if (isEquipped) {
        actionMarkup = '<span>EQUIPPED</span>';
      } else if (!unlocked) {
        actionMarkup =
          gearCost > 0
            ? `<span>${reqPts}P OR</span>${SVG_GEAR}<span>${gearCost}</span>`
            : `<span>${reqPts} PTS</span>`;
      }

      btn.innerHTML = `
        <div class="skin-top-row">
          <span class="skin-swatch blaster-swatch" style="background: linear-gradient(135deg, ${c1} 0%, ${c2} 50%, ${c3} 100%);">${SVG_BLASTER}</span>
          <span class="skin-name">${fx.name}</span>
        </div>
        <div class="skin-desc">${fx.description || ''}</div>
        <span class="skin-action-tag">${actionMarkup}</span>
      `;

      const applyEquippedFxLive = (fxId) => {
        progression.equipBlasterFx?.(fxId);
        progression.updateSettings({ blasterFxId: fxId });
        renderer.setBlasterFx?.(fxId);
        game.applySettings?.({ ...progression.getSettings(), blasterFxId: fxId });
        if (game.player) {
          game.player.blasterFxId = fxId;
          game.player.muzzleFlash = 0.26;
        }
      };

      btn.addEventListener('click', () => {
        sound.unlock();
        if (unlocked) {
          applyEquippedFxLive(fx.id);
          sound.snowball?.();
          renderWardrobeModal();
          refreshTitleMeta();
        } else if (gearCost > 0) {
          let didUnlock = false;
          if (typeof progression.unlockBlasterFx === 'function') {
            const res = progression.unlockBlasterFx(fx.id, true);
            didUnlock = Boolean(res === true || res?.unlocked);
            if (Array.isArray(res?.newlyUnlockedTrophies)) {
              res.newlyUnlockedTrophies.forEach(enqueueTrophyToast);
            }
          } else if (progression.spendGears?.(gearCost)) {
            didUnlock = true;
          }
          if (didUnlock) {
            applyEquippedFxLive(fx.id);
            sound.collectStar?.();
            renderWardrobeModal();
            refreshTitleMeta();
          } else {
            sound.vaultFail?.();
          }
        } else {
          sound.vaultFail?.();
        }
      });

      blasterFxGridEl.appendChild(btn);
    });
  }
}

function syncTrophyViewTabsUI() {
  trophyViewTabBtns.forEach((btn) => {
    const active = btn.dataset.trophyView === activeTrophyView;
    btn.classList.toggle('active', active);
    btn.setAttribute('aria-selected', String(active));
  });
  const showTrophies = activeTrophyView === 'trophies';
  const showRelics = activeTrophyView === 'relics';
  const showCurios = activeTrophyView === 'curios';
  trophyTierFiltersEl?.classList.toggle('hidden', !showTrophies);
  trophiesGridEl?.classList.toggle('hidden', !showTrophies);
  relicCodexListEl?.classList.toggle('hidden', !showRelics);
  curioCodexListEl?.classList.toggle('hidden', !showCurios);
}

function renderTrophiesModal() {
  const totalStars = progression.getTotalStars();
  if (totalStarsDisplayEl) {
    totalStarsDisplayEl.innerHTML = `${SVG_STAR_ON}<span>${totalStars} / 48</span>`;
  }

  const pts = computeTrophyPoints();
  const maxPts = TROPHIES.reduce((s, t) => s + (t.points || 5), 0) || 1000;
  const unlockedTotal = TROPHIES.filter((t) => progression.isTrophyUnlocked(t.id)).length;

  if (trophyRankLblEl) {
    trophyRankLblEl.textContent = `RANK • ${getRankTitleForPoints(pts)}`;
  }
  if (trophyPtsDisplayEl) {
    trophyPtsDisplayEl.textContent = `${pts.toLocaleString()} / ${maxPts.toLocaleString()} PTS (${unlockedTotal}/${TROPHIES.length})`;
  }
  if (trophyPtsFillEl) {
    const pct = Math.max(0, Math.min(100, (pts / Math.max(1, maxPts)) * 100));
    trophyPtsFillEl.style.width = `${pct.toFixed(1)}%`;
  }

  const relics = getRelicCatalog();
  const collectedIds = new Set(
    typeof progression.getCollectedRelics === 'function' ? progression.getCollectedRelics() : []
  );
  const collectedCount = relics.filter(
    (r) => collectedIds.has(r.id) || progression.isRelicCollected?.(r.id)
  ).length;

  const curios = getCurioCatalog();
  const collectedCurioIds = new Set(
    typeof progression.getCollectedCurios === 'function' ? progression.getCollectedCurios() : []
  );
  const curioCount = curios.filter(
    (c) => collectedCurioIds.has(c.id) || progression.isCurioCollected?.(c.id)
  ).length;

  if (trophiesViewTabLbl) trophiesViewTabLbl.textContent = `TROPHIES (${unlockedTotal}/${TROPHIES.length})`;
  if (relicsViewTabLbl) relicsViewTabLbl.textContent = `RELICS (${collectedCount}/${relics.length})`;
  if (curiosViewTabLbl) curiosViewTabLbl.textContent = `CURIOS (${curioCount}/${curios.length})`;

  const tierTotals = { all: TROPHIES.length, aluminum: 0, copper: 0, platinum: 0, diamond: 0 };
  const tierUnlocked = { all: unlockedTotal, aluminum: 0, copper: 0, platinum: 0, diamond: 0 };
  TROPHIES.forEach((t) => {
    const tr = t.tier || 'aluminum';
    if (tierTotals[tr] != null) {
      tierTotals[tr]++;
      if (progression.isTrophyUnlocked(t.id)) tierUnlocked[tr]++;
    }
  });

  const shortNames = { all: 'ALL', aluminum: 'ALUM', copper: 'COPPER', platinum: 'PLAT', diamond: 'DIAMOND' };
  tierFilterBtns.forEach((btn) => {
    const tr = btn.dataset.tierFilter || 'all';
    btn.classList.toggle('active', tr === activeTierFilter);
    btn.textContent = `${shortNames[tr] || tr.toUpperCase()} (${tierUnlocked[tr] ?? 0}/${tierTotals[tr] ?? 0})`;
  });

  syncTrophyViewTabsUI();

  if (trophiesGridEl) {
    trophiesGridEl.innerHTML = '';
    TROPHIES.forEach((t) => {
      const tier = t.tier || 'aluminum';
      if (activeTierFilter !== 'all' && tier !== activeTierFilter) return;

      const unlocked = progression.isTrophyUnlocked(t.id);
      const tPts = t.points || (tier === 'diamond' ? 30 : tier === 'platinum' ? 20 : tier === 'copper' ? 10 : 5);
      const shieldSvg = getArtTrophyShieldSVG(tier, unlocked);

      const card = document.createElement('div');
      card.className = `trophy-card tier-${tier} ${unlocked ? 'unlocked' : 'locked'}`;
      card.innerHTML = `
        <span class="trophy-shield-wrap trophy-emblem">${shieldSvg}</span>
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
    relics.forEach((r, idx) => {
      const found = collectedIds.has(r.id) || Boolean(progression.isRelicCollected?.(r.id));
      const sectorNum = r.towerId || idx + 1;
      const rTitle = r.title || r.name || `DATA LOG 0${sectorNum}`;
      const rLore = r.lore || r.text || r.description || r.body || '';

      const card = document.createElement('div');
      card.className = `relic-card stele-tablet-card ${found ? 'unlocked' : 'locked'}`;
      card.innerHTML = `
        <span class="relic-icon-box">${found ? SVG_RELIC : SVG_LOCK}</span>
        <div>
          <div class="relic-meta">${found ? `DECRYPTED STELE • MONOLITH T${sectorNum}` : `ENCRYPTED STELE • MONOLITH T${sectorNum}`}</div>
          <div class="relic-title">${found ? rTitle : `CLASSIFIED DESTRUCTO INC. TABLET #0${sectorNum}`}</div>
          <div class="relic-lore">${found ? rLore : `Recover the hidden holographic stone tablet on Reboot Sector Tower ${sectorNum} to decrypt this transmission.`}</div>
        </div>
      `;
      relicCodexListEl.appendChild(card);
    });
  }

  if (curioCodexListEl) {
    curioCodexListEl.innerHTML = '';
    curios.forEach((c, idx) => {
      const found = collectedCurioIds.has(c.id) || Boolean(progression.isCurioCollected?.(c.id));
      const isBlueprint = (c.kind || c.type || '').toLowerCase().includes('blueprint');
      const cTitle = c.title || c.name || `EXPEDITION CURIO #${idx + 1}`;
      const cLore = c.lore || c.description || c.text || '';
      const iconSvg = !found ? SVG_LOCK : isBlueprint ? SVG_CRAFT : SVG_CURIO;
      const metaTag = found
        ? (isBlueprint ? 'CRAFTED BLUEPRINT • EXPEDITION LOG' : 'CATALOGED CURIO • EXPEDITION LOG')
        : 'UNDISCOVERED EXPEDITION ARTIFACT';

      const card = document.createElement('div');
      card.className = `relic-card stele-tablet-card ${found ? 'unlocked' : 'locked'}`;
      card.innerHTML = `
        <span class="relic-icon-box">${iconSvg}</span>
        <div>
          <div class="relic-meta">${metaTag}</div>
          <div class="relic-title">${found ? cTitle : `UNCHARTED CURIO #${String(idx + 1).padStart(2, '0')}`}</div>
          <div class="relic-lore">${found ? cLore : 'Explore Endless Casual Expeditions—repair beacons at Tinker Workbenches, unlock sunken Treasure Chests, and survey puzzle spires to catalog this curio.'}</div>
        </div>
      `;
      curioCodexListEl.appendChild(card);
    });
  }
}

// ================= NAUTICAL ARCHIPELAGO SEA CHART =================
function resolveTowerIdFromChartArgs(idxOrTower, maybeTower) {
  if (typeof maybeTower === 'object' && maybeTower !== null && maybeTower.id != null) {
    return Number(maybeTower.id);
  }
  if (typeof idxOrTower === 'object' && idxOrTower !== null && idxOrTower.id != null) {
    return Number(idxOrTower.id);
  }
  const n = Number(idxOrTower);
  return Number.isFinite(n) ? n + 1 : 1;
}

function resolveCutsceneKeyForArg(arg) {
  if (typeof arg === 'string' && STORY_CUTSCENES[arg]) return arg;
  const n = Number(arg);
  if (n === 0 || n === 1) return 'prologue';
  if (n === 2 || n === 3) return 'sector2';
  if (n === 4 || n === 5) return 'sector3';
  if (n === 6 || n === 7) return 'sector4';
  if (n >= 8) return 'epilogue';
  return 'prologue';
}

function renderFallbackSeaChart(container, opts) {
  const {
    era,
    towers,
    selectedIdx,
    isTowerUnlocked,
    getStars,
    getMasteryCount,
    isRelicFound,
    onSelectTower,
    onDeployTower,
    onPlayCutscene,
  } = opts;

  const coords = [
    [82, 492],
    [296, 452],
    [118, 376],
    [324, 330],
    [98, 250],
    [314, 198],
    [126, 122],
    [292, 62],
  ];

  const routeLines = coords
    .slice(0, -1)
    .map(([x1, y1], i) => {
      const [x2, y2] = coords[i + 1];
      const cleared = Boolean(getStars(i, towers[i])?.clear);
      return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${cleared ? '#5ef2ff' : '#475569'}" stroke-width="2.2" stroke-dasharray="6 5" opacity="${cleared ? '0.85' : '0.45'}"/>`;
    })
    .join('');

  const nodesSvg = towers
    .map((t, i) => {
      const [cx, cy] = coords[i] || [210, 280];
      const unlocked = isTowerUnlocked(i, t);
      const st = getStars(i, t);
      const sel = i === selectedIdx;
      const stroke = sel ? '#ffe082' : unlocked ? '#5ef2ff' : '#64748b';
      const fill = unlocked ? '#0c1c38' : '#090f1d';
      return `
        <g class="sea-spire-node${sel ? ' selected active' : ''}${st?.clear ? ' cleared' : ''}${!unlocked ? ' locked' : ''}" data-spire-idx="${i}" transform="translate(${cx},${cy})" style="cursor:pointer">
          ${sel ? `<circle r="27" fill="none" stroke="#ffe082" stroke-width="1.6" stroke-dasharray="5 4"/>` : ''}
          <polygon points="0,-21 19,-9 19,12 0,22 -19,12 -19,-9" fill="${fill}" stroke="${stroke}" stroke-width="${sel ? '2.4' : '1.6'}"/>
          <text y="4" text-anchor="middle" font-family="Orbitron, sans-serif" font-size="10.5" font-weight="800" fill="${unlocked ? '#ffffff' : '#94a3b8'}">T${t.id}</text>
        </g>
      `;
    })
    .join('');

  const selTower = towers[selectedIdx] || towers[0];
  const selUnlocked = selTower ? isTowerUnlocked(selectedIdx, selTower) : true;
  const selStars = selTower ? getStars(selectedIdx, selTower) : null;
  const selMastery = selTower ? getMasteryCount(selectedIdx, selTower) : 0;
  const selRelic = selTower ? isRelicFound(selectedIdx, selTower) : false;
  const cutMap = { 1: 'prologue', 3: 'sector2', 5: 'sector3', 7: 'sector4', 8: 'epilogue' };
  const cutKey = era === 'reboot' && selTower ? cutMap[selTower.id] : null;
  const cutReady = cutKey && (selUnlocked || hasSeenCutscene(cutKey));

  container.innerHTML = `
    <div class="sea-chart-frame">
      <svg viewBox="0 0 420 560" class="sea-chart-svg" role="img" aria-label="Nebulus Archipelago Sea Chart">
        <rect width="420" height="560" rx="14" fill="#050d1d"/>
        <circle cx="356" cy="496" r="36" fill="none" stroke="rgba(217,155,56,0.32)" stroke-width="1.2"/>
        ${routeLines}
        ${nodesSvg}
      </svg>
      <div class="spyglass-plaque">
        <div class="wt-name-row">
          <span class="wt-num">T${selTower?.id || 1}</span>
          <span class="wt-name">${selTower?.name || 'Monolith'}</span>
          <span class="wt-stars">${starsToSvgHtml(selStars)}</span>
        </div>
        <div class="wt-meta-row">
          <span class="wt-secret-tag">MASTERY ${selMastery}/5</span>
          ${era === 'reboot' ? `<span class="wt-relic-tag${selRelic ? ' found' : ''}">${SVG_RELIC}<span>${selRelic ? 'RELIC LOGGED' : 'RELIC UNFOUND'}</span></span>` : ''}
        </div>
        <div class="pause-btn-pair" style="margin-top:8px">
          ${
            cutReady
              ? `<button type="button" class="btn-secondary spyglass-cinema-btn" data-play-cut="${cutKey}">${SVG_FILM}<span>CINEMA</span></button>`
              : ''
          }
          <button type="button" class="btn-primary spyglass-deploy-btn"${selUnlocked ? '' : ' disabled'}>
            ${selUnlocked ? `DEPLOY T${selTower?.id || 1}` : `CLEAR T${(selTower?.id || 2) - 1} FIRST`}
          </button>
        </div>
      </div>
    </div>
  `;

  container.querySelectorAll('[data-spire-idx]').forEach((node) => {
    node.addEventListener('click', () => {
      const nextIdx = Number(node.dataset.spireIdx) || 0;
      onSelectTower(nextIdx);
      renderFallbackSeaChart(container, { ...opts, selectedIdx: nextIdx });
    });
  });
  container.querySelector('[data-play-cut]')?.addEventListener('click', (e) => {
    onPlayCutscene(e.currentTarget.dataset.playCut);
  });
  container.querySelector('.spyglass-deploy-btn')?.addEventListener('click', () => {
    onDeployTower(selectedIdx);
  });
}

function renderWorldsModal() {
  if (!worldsMapListEl) return;
  const s = progression.getSettings();
  const era = s.era || 'reboot';
  const towers = createTowers(era);
  const eraStars = progression.getTotalStars(era);
  const collectedRelicSet = new Set(
    typeof progression.getCollectedRelics === 'function' ? progression.getCollectedRelics() : []
  );

  if (worldsKickerEl) {
    worldsKickerEl.textContent =
      era === 'original' ? 'CLASSIC 1987 • ARCHIPELAGO CHART' : 'OPERATION NEBULUS • SEA CHART';
  }
  if (worldsStarsPillEl) {
    worldsStarsPillEl.innerHTML = `${SVG_STAR_ON}<span>${eraStars} / 24</span>`;
  }

  selectedSeaChartIdx = Math.max(0, Math.min(towers.length - 1, selectedSeaChartIdx));

  const chartOpts = {
    era,
    towers,
    sectors:
      era === 'reboot' && Array.isArray(levelsMod.SECTOR_WORLDS) && levelsMod.SECTOR_WORLDS.length === 4
        ? levelsMod.SECTOR_WORLDS
        : FALLBACK_SECTOR_WORLDS,
    selectedIdx: selectedSeaChartIdx,
    isTowerUnlocked: (idxOrTower, maybeTower) => {
      const tid = resolveTowerIdFromChartArgs(idxOrTower, maybeTower);
      return isTowerUnlockedForCampaign(era, tid);
    },
    getStars: (idxOrTower, maybeTower) => {
      const tid = resolveTowerIdFromChartArgs(idxOrTower, maybeTower);
      return progression.getTowerStars(era, tid);
    },
    getMasteryCount: (idxOrTower, maybeTower) => {
      const tid = resolveTowerIdFromChartArgs(idxOrTower, maybeTower);
      const st = progression.getTowerStars(era, tid);
      return [st?.clear, st?.vault, st?.speed, st?.nohit, st?.combo].filter(Boolean).length;
    },
    isRelicFound: (idxOrTower, maybeTower) => {
      if (era !== 'reboot') return false;
      const tid = resolveTowerIdFromChartArgs(idxOrTower, maybeTower);
      const tDef = towers[tid - 1];
      const rc = Array.isArray(tDef?.collectibles) ? tDef.collectibles.find((c) => c.type === 'relic') : null;
      const rid = rc?.relicId || rc?.id || `relic_t${tid}`;
      return collectedRelicSet.has(rid) || Boolean(progression.isRelicCollected?.(rid));
    },
    isCutsceneUnlocked: (cutKey, idx = 0) => {
      if (era !== 'reboot' || !cutKey) return false;
      if (cutKey === 'epilogue') {
        return Boolean(progression.getTowerStars('reboot', 8)?.clear) || hasSeenCutscene('epilogue');
      }
      const reqTid = (STORY_CUTSCENES[cutKey]?.towerIdx ?? idx) + 1;
      return isTowerUnlockedForCampaign('reboot', reqTid) || hasSeenCutscene(cutKey);
    },
    onSelectTower: (idx) => {
      sound.unlock();
      sound.switchToggle?.();
      const clamped = Math.max(0, Math.min(towers.length - 1, Number(idx) || 0));
      selectedSeaChartIdx = clamped;
      if (startTowerSelect && isTowerUnlockedForCampaign(era, towers[clamped]?.id)) {
        startTowerSelect.value = String(clamped);
        loadTitlePreviewTower();
      }
    },
    onDeployTower: (idx) => {
      sound.unlock();
      const targetIdx = Math.max(0, Math.min(towers.length - 1, Number(idx ?? selectedSeaChartIdx) || 0));
      if (!isTowerUnlockedForCampaign(era, towers[targetIdx]?.id)) {
        sound.vaultFail?.();
        return;
      }
      if (startTowerSelect) startTowerSelect.value = String(targetIdx);
      launchSelectedCampaign();
    },
    onPlayCutscene: (cutArg) => {
      sound.unlock();
      const cutKey = resolveCutsceneKeyForArg(cutArg);
      const def = STORY_CUTSCENES[cutKey];
      const reqTowerId = (def?.towerIdx ?? 0) + 1;
      const canPlay =
        era === 'reboot' &&
        (cutKey === 'epilogue'
          ? Boolean(progression.getTowerStars('reboot', 8)?.clear) || hasSeenCutscene('epilogue')
          : isTowerUnlockedForCampaign('reboot', reqTowerId) || hasSeenCutscene(cutKey));
      if (!canPlay) {
        sound.vaultFail?.();
        return;
      }
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
    onLaunchRoute: (routeMode) => {
      if (routeMode) launchMiniGameRun(routeMode);
    },
  };

  worldsMapListEl.innerHTML = '';
  if (uiArtMod && typeof uiArtMod.renderArchipelagoSeaChart === 'function') {
    uiArtMod.renderArchipelagoSeaChart(worldsMapListEl, chartOpts);
  } else {
    renderFallbackSeaChart(worldsMapListEl, chartOpts);
  }
}

// ================= GAME LAUNCH & NAVIGATION FLOWS =================
function hideAllOverlays() {
  closeTitleDrawers();
  overlayTitle?.classList.add('hidden');
  overlayWorlds?.classList.add('hidden');
  overlayWardrobe?.classList.add('hidden');
  overlayTrophies?.classList.add('hidden');
  overlayMinigames?.classList.add('hidden');
  overlayPause?.classList.add('hidden');
  overlayGameOver?.classList.add('hidden');
  overlayCutscene?.classList.add('hidden');
  syncTitleShowcaseState();
}

function beginRunCommon() {
  sound.unlock();
  if (cutsceneState.active) {
    cutsceneState.active = false;
    game.cutsceneCam = null;
    renderer.setCutsceneCam?.(null);
  }
  hideAllOverlays();
  input.resetState?.();
  game.applySettings?.({ ...progression.getSettings(), blasterFxId: getEquippedBlasterFxSafe() });
  gearsBeforeRun = progression.getGears();
}

function launchSelectedCampaign() {
  const s = progression.getSettings();
  const era = s.era || 'reboot';
  const zenMode = Boolean(toggleZenInput ? toggleZenInput.checked : s.zenMode);
  const towers = createTowers(era);
  let towerIdx = Math.max(0, Math.min(towers.length - 1, Number(startTowerSelect?.value) || 0));

  while (towerIdx > 0 && !isTowerUnlockedForCampaign(era, towers[towerIdx]?.id)) {
    towerIdx--;
  }

  progression.updateSettings({ zenMode });
  sound.setZenMode?.(zenMode);

  const startActual = () => {
    beginRunCommon();
    game.applySettings?.({ ...progression.getSettings(), blasterFxId: getEquippedBlasterFxSafe() });
    lastLaunch = { type: 'campaign', era, towerIdx, zenMode, miniGame: 'submarine' };
    game.startCampaign({ era, startTowerIdx: towerIdx, zenMode });
    syncTitleShowcaseState();
  };

  if (era === 'reboot' && towerIdx === 0 && !hasSeenCutscene('prologue')) {
    sound.unlock();
    hideAllOverlays();
    markCutsceneSeen('prologue');
    playStoryCutscene('prologue', {
      previewMode: true,
      onComplete: startActual,
    });
    return;
  }

  startActual();
}

function launchDailyRun() {
  beginRunCommon();
  lastLaunch = { type: 'daily', era: 'reboot', towerIdx: 0, zenMode: false, miniGame: 'submarine' };
  game.startDailyChallenge(new Date());
  syncTitleShowcaseState();
}

function launchEndlessRun() {
  beginRunCommon();
  const era = progression.getSettings().era || 'reboot';
  lastLaunch = { type: 'endless', era, towerIdx: 0, zenMode: false, miniGame: 'submarine' };
  game.startEndlessMode({ era, seed: Date.now() });
  syncTitleShowcaseState();
}

function launchCasualEndlessRun() {
  beginRunCommon();
  lastLaunch = { type: 'endless_casual', era: 'reboot', towerIdx: 0, zenMode: true, miniGame: 'submarine' };
  if (typeof game.startCasualEndlessMode === 'function') {
    game.startCasualEndlessMode({ seed: Date.now() });
  } else {
    game.startEndlessMode({ era: 'reboot', seed: Date.now(), casual: true });
  }
  syncTitleShowcaseState();
}

function launchMiniGameRun(miniType) {
  beginRunCommon();
  lastLaunch = { type: 'minigame', era: 'reboot', towerIdx: 0, zenMode: false, miniGame: miniType };
  game.startMiniGame(miniType, true);
  syncTitleShowcaseState();
}

function relaunchLastMode() {
  if (lastLaunch.type === 'daily') {
    launchDailyRun();
  } else if (lastLaunch.type === 'endless_casual') {
    launchCasualEndlessRun();
  } else if (lastLaunch.type === 'endless') {
    launchEndlessRun();
  } else if (lastLaunch.type === 'minigame') {
    launchMiniGameRun(lastLaunch.miniGame);
  } else {
    beginRunCommon();
    game.startCampaign({
      era: lastLaunch.era,
      startTowerIdx: lastLaunch.towerIdx,
      zenMode: lastLaunch.zenMode,
    });
    syncTitleShowcaseState();
  }
}

function returnToTitle() {
  hideAllOverlays();
  clearBanner();
  input.resetState?.();
  sound.setMusicActive?.(false);
  sound.setMiniGameMode?.(null);
  if (actionPromptEl) actionPromptEl.classList.add('hidden');
  if (missionStatusPillEl) missionStatusPillEl.classList.add('hidden');
  if (altMeterEl) altMeterEl.classList.add('hidden');

  refreshTitleMeta();
  loadTitlePreviewTower();
  overlayTitle?.classList.remove('hidden');
  syncTitleShowcaseState();
}

function openWorldsOverlay() {
  sound.unlock();
  closeTitleDrawers();
  selectedSeaChartIdx = Math.max(0, Number(startTowerSelect?.value) || 0);
  overlayTitle?.classList.add('hidden');
  renderWorldsModal();
  overlayWorlds?.classList.remove('hidden');
  syncTitleShowcaseState();
}

// ================= WIRE EVENT LISTENERS =================
eraTabBtns.forEach((btn) => {
  btn.addEventListener('click', () => {
    sound.unlock();
    sound.switchToggle?.();
    applyEra(btn.dataset.eraSelect);
  });
});

btnEraToggle?.addEventListener('click', () => {
  sound.unlock();
  sound.switchToggle?.();
  const cur = progression.getSettings().era || 'reboot';
  applyEra(cur === 'reboot' ? 'original' : 'reboot');
});

startTowerSelect?.addEventListener('change', () => {
  const era = progression.getSettings().era || 'reboot';
  selectedSeaChartIdx = Number(startTowerSelect.value) || 0;
  updateSelectedTowerRibbon(era);
  if (game.mode === 'title') {
    loadTitlePreviewTower();
  }
});

function setZenModeValue(nextZen) {
  const zenMode = Boolean(nextZen);
  syncZenUI(zenMode);
  progression.updateSettings({ zenMode });
  sound.setZenMode?.(zenMode);
  game.applySettings?.(progression.getSettings());
  updateSelectedTowerRibbon(progression.getSettings().era || 'reboot');
}

toggleZenInput?.addEventListener('change', () => {
  setZenModeValue(toggleZenInput.checked);
});

btnZenPill?.addEventListener('click', () => {
  sound.unlock();
  sound.switchToggle?.();
  setZenModeValue(!progression.getSettings().zenMode);
});

btnTitleSettings?.addEventListener('click', (e) => {
  e.stopPropagation();
  sound.unlock();
  sound.switchToggle?.();
  const willOpen = Boolean(titleSettingsDrawer?.classList.contains('hidden'));
  expeditionsDrawerEl?.classList.add('hidden');
  btnExpeditions?.setAttribute('aria-expanded', 'false');
  btnExpeditions?.classList.remove('active');
  titleSettingsDrawer?.classList.toggle('hidden', !willOpen);
  btnTitleSettings.setAttribute('aria-expanded', String(willOpen));
  btnTitleSettings.classList.toggle('active', willOpen);
});

btnExpeditions?.addEventListener('click', (e) => {
  e.stopPropagation();
  sound.unlock();
  sound.switchToggle?.();
  const willOpen = Boolean(expeditionsDrawerEl?.classList.contains('hidden'));
  titleSettingsDrawer?.classList.add('hidden');
  btnTitleSettings?.setAttribute('aria-expanded', 'false');
  btnTitleSettings?.classList.remove('active');
  expeditionsDrawerEl?.classList.toggle('hidden', !willOpen);
  btnExpeditions.setAttribute('aria-expanded', String(willOpen));
  btnExpeditions.classList.toggle('active', willOpen);
});

btnCloseExpeditions?.addEventListener('click', () => {
  sound.unlock();
  expeditionsDrawerEl?.classList.add('hidden');
  btnExpeditions?.setAttribute('aria-expanded', 'false');
  btnExpeditions?.classList.remove('active');
});

const handleDioramaOrCrestActivate = () => {
  const anyDrawerOpen =
    (titleSettingsDrawer && !titleSettingsDrawer.classList.contains('hidden')) ||
    (expeditionsDrawerEl && !expeditionsDrawerEl.classList.contains('hidden'));
  if (anyDrawerOpen) {
    sound.unlock();
    closeTitleDrawers();
    return;
  }
  launchSelectedCampaign();
};

titleDioramaStageEl?.addEventListener('click', handleDioramaOrCrestActivate);
titleDioramaStageEl?.addEventListener('keydown', (e) => {
  if (e.code === 'Enter' || e.code === 'Space') {
    e.preventDefault();
    handleDioramaOrCrestActivate();
  }
});
titleCrestStageEl?.addEventListener('click', handleDioramaOrCrestActivate);

selectControlMode?.addEventListener('change', () => {
  applyControlMode(selectControlMode.value, true);
});

pauseControlMode?.addEventListener('change', () => {
  applyControlMode(pauseControlMode.value, true);
});

titleCtrlPickBtns.forEach((btn) => {
  btn.addEventListener('click', () => {
    sound.unlock();
    sound.switchToggle?.();
    applyControlMode(btn.dataset.ctrlPick || 'gesture', true);
  });
});

pauseCtrlPillBtns.forEach((btn) => {
  btn.addEventListener('click', () => {
    sound.unlock();
    sound.switchToggle?.();
    applyControlMode(btn.dataset.pauseCtrl || 'gesture', true);
  });
});

btnCtrlMode?.addEventListener('click', () => {
  sound.unlock();
  const cur = input.controlMode || progression.getSettings().controlMode || 'gesture';
  const idx = CONTROL_MODES.indexOf(cur);
  const next = CONTROL_MODES[(idx + 1) % CONTROL_MODES.length];
  applyControlMode(next, true);
  showBanner('CONTROLS', `${next.toUpperCase()} MODE`);
});

const handleCalibrate = () => {
  sound.unlock();
  const neutral = input.calibrateTilt?.() ?? 0;
  sound.switchToggle?.();
  showBanner('TILT CALIBRATED', `NEUTRAL ${Number(neutral).toFixed(1)} DEG`);
};
btnCalibrateTilt?.addEventListener('click', handleCalibrate);
btnPauseCalibrate?.addEventListener('click', handleCalibrate);

// Title Mode Launchers
btnStart?.addEventListener('click', launchSelectedCampaign);
btnHeroSector?.addEventListener('click', openWorldsOverlay);
btnDaily?.addEventListener('click', launchDailyRun);
btnEndless?.addEventListener('click', launchEndlessRun);
btnCasualEndless?.addEventListener('click', launchCasualEndlessRun);

// Sub-Modals (Sea Chart, Armory, Reliquary, Simulation Portals)
btnWorlds?.addEventListener('click', openWorldsOverlay);

btnCloseWorlds?.addEventListener('click', () => {
  overlayWorlds?.classList.add('hidden');
  overlayTitle?.classList.remove('hidden');
  syncTitleShowcaseState();
});

btnWardrobe?.addEventListener('click', () => {
  sound.unlock();
  clearBanner();
  closeTitleDrawers();
  overlayTitle?.classList.add('hidden');
  if (game.player) {
    game.camCol = game.player.col ?? 0.5;
    game.camFloor = game.player.floor ?? 0;
  }
  renderWardrobeModal();
  overlayWardrobe?.classList.remove('hidden');
  syncTitleShowcaseState();
  requestAnimationFrame(() => {
    const activeCarousel = activeWardrobeTab === 'blaster' ? blasterFxGridEl : wardrobeGridEl;
    activeCarousel?.querySelector('.equipped')?.scrollIntoView?.({ block: 'nearest', inline: 'center' });
  });
});

btnCloseWardrobe?.addEventListener('click', () => {
  overlayWardrobe?.classList.add('hidden');
  overlayTitle?.classList.remove('hidden');
  syncTitleShowcaseState();
});

wardrobeTabBtns.forEach((btn) => {
  btn.addEventListener('click', () => {
    sound.unlock();
    sound.switchToggle?.();
    activeWardrobeTab = btn.dataset.wardrobeTab || 'skins';
    syncWardrobeTabsUI();
  });
});

trophyViewTabBtns.forEach((btn) => {
  btn.addEventListener('click', () => {
    sound.unlock();
    sound.switchToggle?.();
    activeTrophyView = btn.dataset.trophyView || 'trophies';
    syncTrophyViewTabsUI();
  });
});

tierFilterBtns.forEach((btn) => {
  btn.addEventListener('click', () => {
    sound.unlock();
    sound.switchToggle?.();
    activeTierFilter = btn.dataset.tierFilter || 'all';
    renderTrophiesModal();
  });
});

btnTrophies?.addEventListener('click', () => {
  sound.unlock();
  closeTitleDrawers();
  overlayTitle?.classList.add('hidden');
  renderTrophiesModal();
  overlayTrophies?.classList.remove('hidden');
  syncTitleShowcaseState();
});

btnCloseTrophies?.addEventListener('click', () => {
  overlayTrophies?.classList.add('hidden');
  overlayTitle?.classList.remove('hidden');
  syncTitleShowcaseState();
});

btnMinigames?.addEventListener('click', () => {
  sound.unlock();
  closeTitleDrawers();
  mountDiegeticArtwork();
  overlayTitle?.classList.add('hidden');
  overlayMinigames?.classList.remove('hidden');
  syncTitleShowcaseState();
});

btnCloseMinigames?.addEventListener('click', () => {
  overlayMinigames?.classList.add('hidden');
  overlayTitle?.classList.remove('hidden');
  syncTitleShowcaseState();
});

minigameCards.forEach((card) => {
  card.addEventListener('click', () => {
    const mgType = card.dataset.minigame || 'submarine';
    launchMiniGameRun(mgType);
  });
});

// Audio & Pause HUD Buttons
const handleToggleMute = () => {
  sound.unlock();
  const muted = sound.toggleMute();
  progression.updateSettings({ muted });
  syncAudioButtons();
};
const handleToggleMusic = () => {
  sound.unlock();
  const musicEnabled = sound.toggleMusic();
  progression.updateSettings({ musicEnabled });
  syncAudioButtons();
};

btnSound?.addEventListener('click', handleToggleMute);
btnTitleSound?.addEventListener('click', handleToggleMute);
btnMusic?.addEventListener('click', handleToggleMusic);
btnTitleMusic?.addEventListener('click', handleToggleMusic);

function triggerPauseToggle() {
  if (game.mode === 'title' || game.mode === 'gameover' || game.mode === 'victory') return;
  sound.unlock();
  const paused = game.togglePause();
  input.resetState?.();
  if (paused) {
    if (actionPromptEl) actionPromptEl.classList.add('hidden');
    if (pauseTowerName) {
      if (game.pausedFrom === 'submarine') pauseTowerName.textContent = 'MK.7 Sub-Hunter';
      else if (game.pausedFrom === 'skimmer') pauseTowerName.textContent = 'Hydro-Skimmer Run';
      else if (game.pausedFrom === 'glide') pauseTowerName.textContent = 'The Glide (Sky-Wing)';
      else if (game.pausedFrom === 'puzzle') pauseTowerName.textContent = 'Secret Rune Chamber';
      else if (game.pausedFrom === 'vault') pauseTowerName.textContent = 'Core Lock Vault';
      else if (game.tower) pauseTowerName.textContent = `Sector ${game.tower.id}: ${game.tower.name}`;
    }
    overlayPause?.classList.remove('hidden');
  } else {
    overlayPause?.classList.add('hidden');
  }
}

btnPause?.addEventListener('click', triggerPauseToggle);

btnResume?.addEventListener('click', () => {
  if (game.mode === 'paused') {
    triggerPauseToggle();
  } else {
    overlayPause?.classList.add('hidden');
  }
});

btnRestart?.addEventListener('click', relaunchLastMode);
btnPauseTitle?.addEventListener('click', returnToTitle);
btnPlayAgain?.addEventListener('click', relaunchLastMode);
btnBackTitle?.addEventListener('click', returnToTitle);

// Cutscene Controls
btnCutsceneNext?.addEventListener('click', advanceCutsceneStep);
cutsceneTapStage?.addEventListener('click', advanceCutsceneStep);
btnCutsceneSkip?.addEventListener('click', () => {
  sound.unlock();
  sound.switchToggle?.();
  finishCutscene();
});

// Keyboard Shortcuts (M = Music, Space/Enter = Cutscene Next, Escape/P = Pause/Close)
window.addEventListener('keydown', (e) => {
  if (e.repeat) return;
  if (cutsceneState.active) {
    if (e.code === 'Escape') {
      e.preventDefault();
      sound.unlock();
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
    if (!overlayWorlds?.classList.contains('hidden')) {
      overlayWorlds.classList.add('hidden');
      overlayTitle?.classList.remove('hidden');
      syncTitleShowcaseState();
    } else if (!overlayWardrobe?.classList.contains('hidden')) {
      overlayWardrobe.classList.add('hidden');
      overlayTitle?.classList.remove('hidden');
      syncTitleShowcaseState();
    } else if (!overlayTrophies?.classList.contains('hidden')) {
      overlayTrophies.classList.add('hidden');
      overlayTitle?.classList.remove('hidden');
      syncTitleShowcaseState();
    } else if (!overlayMinigames?.classList.contains('hidden')) {
      overlayMinigames.classList.add('hidden');
      overlayTitle?.classList.remove('hidden');
      syncTitleShowcaseState();
    } else if (isTitleScreenOpen()) {
      closeTitleDrawers();
    } else {
      triggerPauseToggle();
    }
  }
});

// ================= VIEWPORT RESIZE & BOOT =================
function handleResize() {
  const w = window.innerWidth || stageWrap.clientWidth || 390;
  const h = window.innerHeight || stageWrap.clientHeight || 844;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  renderer.resize(w, h, dpr);
}

window.addEventListener('resize', handleResize);
window.visualViewport?.addEventListener('resize', handleResize);

// Initial State Sync & Live 3D Start-Screen Watchtower Diorama
applyControlMode(initSettings.controlMode || 'gesture', false);
appEl.dataset.era = initSettings.era || 'reboot';
refreshTitleMeta();
renderLivesPips(3);
loadTitlePreviewTower();
syncTitleShowcaseState();
handleResize();

// ================= MAIN 60FPS ANIMATION LOOP =================
let lastTs = performance.now();

function loop(ts) {
  const rawDt = (ts - lastTs) / 1000;
  lastTs = ts;
  const dt = Math.max(0, Math.min(0.05, rawDt));

  if (
    !cutsceneState.active &&
    game.runType === 'reboot_campaign' &&
    game.mode === 'tower' &&
    game.tower
  ) {
    const tid = game.tower.id;
    const actMap = { 3: 'sector2', 5: 'sector3', 7: 'sector4' };
    const actKey = actMap[tid];
    if (actKey && !hasSeenCutscene(actKey)) {
      markCutsceneSeen(actKey);
      playStoryCutscene(actKey, { previewMode: false });
    }
  }

  if (cutsceneState.active) {
    game.time = (game.time || 0) + dt;
    cutsceneState.elapsed += dt;

    const def = STORY_CUTSCENES[cutsceneState.kind];
    const totalBeats = Math.max(1, def?.beats?.length || 3);
    const beatFrac = totalBeats > 1 ? cutsceneState.beatIdx / (totalBeats - 1) : 1;
    const timeSweep = Math.min(0.32, (cutsceneState.elapsed / cutsceneState.cameraDuration) * 0.32);
    const phase = Math.max(0, Math.min(1, beatFrac * 0.68 + timeSweep));
    game.cutsceneCam = { active: true, phase, kind: cutsceneState.kind };

    if (cutsceneState.charIdx < cutsceneState.fullText.length) {
      cutsceneState.charIdx = Math.min(
        cutsceneState.fullText.length,
        cutsceneState.charIdx + dt * 62
      );
      if (cutsceneTextEl) {
        cutsceneTextEl.textContent = cutsceneState.fullText.slice(0, Math.floor(cutsceneState.charIdx));
      }
    }
  } else if (game.mode === 'title') {
    game.time = (game.time || 0) + dt;
    game._syncDynamicLedges?.(dt, true);
    if (game.player && game.player.muzzleFlash > 0) {
      game.player.muzzleFlash = Math.max(0, game.player.muzzleFlash - dt);
    }

    const titleOpen = isTitleScreenOpen();
    const wardrobeOpen = Boolean(overlayWardrobe && !overlayWardrobe.classList.contains('hidden'));
    game.titleShowcase = titleOpen;
    game.wardrobeSpotlight = wardrobeOpen;

    if (wardrobeOpen && game.player) {
      const targetCol = game.player.col ?? 0.5;
      const diff = (((targetCol - game.camCol + 8) % 16) + 16) % 16 - 8;
      game.camCol = (((game.camCol + diff * Math.min(1, dt * 8)) % 16) + 16) % 16;
      const targetFloor = game.player.floor ?? 0;
      game.camFloor = (game.camFloor ?? 0) + (targetFloor - (game.camFloor ?? 0)) * Math.min(1, dt * 8);
    } else if (titleOpen && game.player) {
      // Heroic Live 3D Start-Screen Diorama framing Pogo on wet base ledge with gentle breathing orbit
      const baseCol = game.player.col ?? 0.5;
      const gentleOrbit = Math.sin((game.time || 0) * 0.42) * 0.44;
      const targetCol = (((baseCol + gentleOrbit) % 16) + 16) % 16;
      const diff = (((targetCol - (game.camCol ?? baseCol) + 8) % 16) + 16) % 16 - 8;
      game.camCol = ((((game.camCol ?? baseCol) + diff * Math.min(1, dt * 5)) % 16) + 16) % 16;
      const targetFloor = (game.player.floor ?? 0) + 1.15;
      game.camFloor = (game.camFloor ?? targetFloor) + (targetFloor - (game.camFloor ?? targetFloor)) * Math.min(1, dt * 4);
    } else {
      game.camCol = ((game.camCol || 0) + dt * 0.38) % 16;
      const targetFloor = 1.6;
      game.camFloor = (game.camFloor ?? 1.6) + (targetFloor - (game.camFloor ?? 1.6)) * Math.min(1, dt * 3);
    }
  } else {
    game.titleShowcase = false;
    game.wardrobeSpotlight = false;
    game.update(dt);
  }

  game.render();
  requestAnimationFrame(loop);
}

requestAnimationFrame(loop);
