// Towering Waters: Gateway's Descent — Persistent Progression, Watershed Restoration,
// 5-Act Story Arc, 7 Bio-Mutations, 100 Trophies (1,000 PTS), 10 Field Logs, 12 Curios,
// 6 Hydro-Pulse Styles & 8 Gateway Skins (Created by Matt Shaffer)
// Pure leaf module (zero internal imports)

const DEFAULT_SETTINGS = Object.freeze({
  controlMode: 'gesture',           // 'gesture' | 'joystick' | 'dpad' | 'tilt'
  zenMode: false,                   // Peaceful / Assist modifier
  muted: false,                     // Master audio mute
  musicEnabled: true,               // Music bus toggle
  musicVolume: 0.85,                // 0.0 .. 1.0 (Music slider)
  ambienceVolume: 0.80,             // 0.0 .. 1.0 (Natural Water Ambience slider)
  sfxVolume: 0.85,                  // 0.0 .. 1.0 (Organic Foley & Chimes slider)
  hapticsEnabled: true,             // navigator.vibrate pulses
  tiltSensitivity: 1.0,             // 0.5 .. 2.0
  skinId: 'sea_glass_guardian',     // active Gateway skin ID
  blasterFxId: 'tidal_pearl'       // active Hydro-Pulse FX ID
});

export const WATERSHED_BIOMES = [
  {
    id: 1,
    act: 1,
    key: 'canyon_river',
    name: 'Redwood Canyon Rivers',
    guardianName: 'Elder Oakhaven',
    guardianTitle: 'River Otter Steward of the Gorge',
    spireIds: [1, 2],
    parchedColor: '#786352',
    restoredColor: '#14b8a6',
    accentColor: '#2dd4bf',
    summary: 'Sunlit sandstone gorges, towering coastal redwoods, and roaring whitewater cataracts.'
  },
  {
    id: 2,
    act: 2,
    key: 'alpine_lake',
    name: 'Crystal Alpine Lakes',
    guardianName: 'Spirit Lumi',
    guardianTitle: 'Silver-Trout Keeper of the High Tarns',
    spireIds: [3, 4],
    parchedColor: '#64748b',
    restoredColor: '#38bdf8',
    accentColor: '#7dd3fc',
    summary: 'Mirror-clear glacial lakes cradled by rose-gold alpenglow granite peaks and stone aqueducts.'
  },
  {
    id: 3,
    act: 3,
    key: 'mist_bayou',
    name: 'Emerald Mist Bayous',
    guardianName: 'Keeper Mossback',
    guardianTitle: 'Great Heron Warden of the Cypress Delta',
    spireIds: [5, 6],
    parchedColor: '#57534e',
    restoredColor: '#10b981',
    accentColor: '#fbbf24',
    summary: 'Twilight cypress arches draped in Spanish moss, glowing lotus channels, and golden fireflies.'
  },
  {
    id: 4,
    act: 4,
    key: 'coral_sea',
    name: 'Sunlit Coral Seas',
    guardianName: 'Matriarch Aurelia',
    guardianTitle: 'Reef Manta Sovereign of the Lagoon',
    spireIds: [7, 8],
    parchedColor: '#78716c',
    restoredColor: '#06b6d4',
    accentColor: '#f472b6',
    summary: 'Dazzling turquoise atoll lagoons with living underwater coral shelves and gliding rays.'
  },
  {
    id: 5,
    act: 5,
    key: 'storm_ocean',
    name: 'Polar & Tempest Oceans',
    guardianName: 'Oracle Borealis',
    guardianTitle: 'Leviathan Songkeeper of the Deep Current',
    spireIds: [9, 10],
    parchedColor: '#334155',
    restoredColor: '#6366f1',
    accentColor: '#5efce8',
    summary: 'Electric deep-ocean swells, translucent turquoise icebergs, and emerald-violet polar auroras.'
  }
];

export const SKIN_CATALOG = [
  {
    id: 'sea_glass_guardian',
    name: 'Sea-Glass Guardian',
    description: 'Gateway’s signature Pelagian iridescent sea-glass teal scales, coral head-frills, and pearlescent hydro-conduit harness.',
    gearCost: 0,
    milestoneText: 'Unlocked by Default',
    previewColors: ['#2dd4bf', '#99f6e4', '#fb7185']
  },
  {
    id: 'coral_reef_empress',
    name: 'Coral Reef Empress',
    description: 'Sunlit mother-of-pearl scales accented with vibrant living-coral magenta frills and turquoise lagoon bioluminescence.',
    gearCost: 75,
    milestoneText: '75 Hydro-Gears',
    previewColors: ['#fb7185', '#fef3c7', '#22d3ee']
  },
  {
    id: 'canyon_rapids_ranger',
    name: 'Canyon Rapids Ranger',
    description: 'Warm burnished copper-sandstone hide with emerald river-moss crests and whitewater foam tail markings.',
    gearCost: 120,
    milestoneText: 'Restore Act I Canyon Rivers or 120 Gears',
    previewColors: ['#d97706', '#34d399', '#fef08a']
  },
  {
    id: 'alpine_glacier_mystic',
    name: 'Alpine Glacier Mystic',
    description: 'Crystalline frost-azure scales with snow-quartz dorsal frills and rose-gold alpenglow conduit trim.',
    gearCost: 160,
    milestoneText: 'Restore Act II Alpine Lakes or 160 Gears',
    previewColors: ['#38bdf8', '#f8fafc', '#f472b6']
  },
  {
    id: 'bayou_biolume',
    name: 'Bayou Biolume',
    description: 'Deep jade-moss scales illuminated by warm firefly-amber frill veins and twilight lotus luminescence.',
    gearCost: 200,
    milestoneText: 'Restore Act III Mist Bayous or 200 Gears',
    previewColors: ['#059669', '#fbbf24', '#a7f3d0']
  },
  {
    id: 'abyssal_leviathan',
    name: 'Abyssal Leviathan',
    description: 'Midnight-indigo pelagic armor with electric cyan lateral stripes and ultraviolet deep-trench glow.',
    gearCost: 240,
    milestoneText: 'Solve 5 Aqueduct Sanctums/Vaults or 240 Gears',
    previewColors: ['#1e1b4b', '#22d3ee', '#c084fc']
  },
  {
    id: 'solar_oasis',
    name: 'Solar Oasis',
    description: 'Radiant golden-sunstone scales paired with shimmering aquamarine crests and polished bronze clasps.',
    gearCost: 280,
    milestoneText: 'Restore Act IV Coral Seas or 280 Gears',
    previewColors: ['#f59e0b', '#2dd4bf', '#fef9c3']
  },
  {
    id: 'sovereign_starlight',
    name: 'Sovereign Starlight',
    description: 'Celestial diamond-opal scales of Pelagia’s High Envoys, trailing a full-spectrum aurora water wake.',
    gearCost: 400,
    milestoneText: 'Earn 20 Harmonic Seeds or 400 Gears',
    previewColors: ['#5efce8', '#e879f9', '#fde047']
  }
];

export const GATEWAY_SKIN_CATALOG = SKIN_CATALOG;

const LEGACY_SKIN_ALIAS = {
  default_amphibian: 'sea_glass_guardian',
  deep_diver: 'abyssal_leviathan',
  poison_dart: 'coral_reef_empress',
  clockwork_brass: 'canyon_rapids_ranger',
  frost_warden: 'alpine_glacier_mystic',
  shadow_infiltrator: 'bayou_biolume'
};

export const HYDRO_FX_CATALOG = [
  {
    id: 'tidal_pearl',
    name: 'Pelagic Sea-Glass',
    description: 'Pure Pelagian harmonic water pulse trailing crystalline seafoam droplets.',
    trophyPointsReq: 0,
    pointsRequired: 0,
    pointsReq: 0,
    gearCost: 0,
    milestoneText: 'Unlocked by Default',
    coreColor: '#f0fdfa',
    emissiveColor: '#2dd4bf',
    muzzleColor: '#5efce8',
    trailColors: ['#99f6e4', '#67e8f9'],
    previewColors: ['#2dd4bf', '#f0fdfa', '#0284c7']
  },
  {
    id: 'emerald_plasma',
    name: 'Bayou Biolume Surge',
    description: 'Living emerald river-spirit bolt shedding glowing jade and firefly motes.',
    trophyPointsReq: 100,
    pointsRequired: 100,
    pointsReq: 100,
    gearCost: 90,
    milestoneText: '100 Trophy Pts or 90 Gears',
    coreColor: '#d1fae5',
    emissiveColor: '#10b981',
    muzzleColor: '#34d399',
    trailColors: ['#6ee7b7', '#34d399'],
    previewColors: ['#10b981', '#a7f3d0', '#065f46']
  },
  {
    id: 'solar_ember',
    name: 'Canyon Sunburst',
    description: 'Golden-hour thermal geyser pulse shimmering with warm amber spray.',
    trophyPointsReq: 250,
    pointsRequired: 250,
    pointsReq: 250,
    gearCost: 150,
    milestoneText: '250 Trophy Pts or 150 Gears',
    coreColor: '#fef3c7',
    emissiveColor: '#f59e0b',
    muzzleColor: '#fbbf24',
    trailColors: ['#fde68a', '#f97316'],
    previewColors: ['#f59e0b', '#fef08a', '#b45309']
  },
  {
    id: 'amethyst_void',
    name: 'Abyssal Prism Current',
    description: 'Refractive deep-sea crystal pulse resonating with violet and magenta harmonics.',
    trophyPointsReq: 450,
    pointsRequired: 450,
    pointsReq: 450,
    gearCost: 220,
    milestoneText: '450 Trophy Pts or 220 Gears',
    coreColor: '#fae8ff',
    emissiveColor: '#c084fc',
    muzzleColor: '#e879f9',
    trailColors: ['#f0abfc', '#a855f7'],
    previewColors: ['#a855f7', '#f5d0fe', '#581c87']
  },
  {
    id: 'coral_bloom',
    name: 'Coral Lagoon Shimmer',
    description: 'Tropical reef hydro-orb weaving rose-coral ribbons with sunlit turquoise foam.',
    trophyPointsReq: 680,
    pointsRequired: 680,
    pointsReq: 680,
    gearCost: 300,
    milestoneText: '680 Trophy Pts or 300 Gears',
    coreColor: '#fff1f2',
    emissiveColor: '#fb7185',
    muzzleColor: '#2dd4bf',
    trailColors: ['#fda4af', '#5eead4'],
    previewColors: ['#fb7185', '#2dd4bf', '#fef08a']
  },
  {
    id: 'diamond_prism',
    name: 'Sovereign Starlight',
    description: 'Celestial Pelagian starcore lance leaving a tri-spectrum polar aurora wake.',
    trophyPointsReq: 900,
    pointsRequired: 900,
    pointsReq: 900,
    gearCost: 450,
    milestoneText: '900 Trophy Pts or 450 Gears',
    coreColor: '#ffffff',
    emissiveColor: '#5efce8',
    muzzleColor: '#f472b6',
    trailColors: ['#5efce8', '#f472b6', '#fde047'],
    previewColors: ['#5efce8', '#f472b6', '#fde047']
  }
];

export const BLASTER_FX_CATALOG = HYDRO_FX_CATALOG;

const LEGACY_FX_ALIAS = {
  standard_cryo: 'tidal_pearl',
  pelagic_tide: 'tidal_pearl',
  sea_glass_pulse: 'tidal_pearl',
  emerald_biolume: 'emerald_plasma',
  emerald_lotus: 'emerald_plasma',
  canyon_sunburst: 'solar_ember',
  amethyst_current: 'amethyst_void',
  coral_aurora: 'coral_bloom',
  coral_prism: 'coral_bloom',
  alpine_glacier: 'tidal_pearl',
  aurora_sovereign: 'diamond_prism',
  sovereign_starlight: 'diamond_prism'
};

// ============================================================================
// 7 SELECTABLE ROGUELITE BIO-MUTATIONS ('expedition' Mode)
// ============================================================================

export const BIO_MUTATIONS = [
  {
    id: 'triple_whip',
    name: 'Triple Tail-Whip',
    title: 'Triple Tail-Whip',
    badge: 'TAIL MASTERY',
    icon: '◎',
    accentColor: '#2dd4bf',
    shortDesc: '+40% whip radius, faster spin cooldown & triple shockwave cascade.',
    description: 'Gateway’s 360° Lizard Tail-Whip unleashes 3 cascading hydro-rings, expanding reach to 1.75 columns and reflecting mortar bubbles at 2x speed.'
  },
  {
    id: 'gecko_sprint',
    name: 'Gecko Sprint',
    title: 'Gecko Sprint',
    badge: 'AGILITY',
    icon: '»',
    accentColor: '#34d399',
    shortDesc: '+22% run & staircase speed, +30% Wall-Scamper climb & full glacier traction.',
    description: 'Micro-setae toe pads grant full dry-stone grip on Alpine ice, +22% sprint speed up real staircases, and rapid Gecko Wall-Scamper climbs.'
  },
  {
    id: 'hydro_double_jump',
    name: 'Hydro-Jet Double Jump',
    title: 'Hydro-Jet Double Jump',
    badge: 'AERIAL',
    icon: '▲',
    accentColor: '#38bdf8',
    shortDesc: 'Tap Jump in mid-air for a full pressurized water-jet second leap.',
    description: 'Vents pressurized water from Gateway’s harness nozzles to trigger a crisp mid-air second jump, resetting on every landing, wall-strip, or grapple ring.'
  },
  {
    id: 'tidal_magnet',
    name: 'Tidal Magnet',
    title: 'Tidal Magnet',
    badge: 'HARVEST',
    icon: '✦',
    accentColor: '#fbbf24',
    shortDesc: 'Draws nearby Hydro-Gears & Curios within 2.6 cols and grants +25% Gear yield.',
    description: 'Harmonic currents pull nearby Hydro-Gears, Salvage Parts, and Harmonic Seeds straight into Gateway’s orbit while boosting Gear rewards.'
  },
  {
    id: 'bubble_aegis',
    name: 'Bubble Aegis',
    title: 'Bubble Aegis',
    badge: 'DEFENSE',
    icon: '◈',
    accentColor: '#67e8f9',
    shortDesc: 'Starts every spire with a Sea-Glass Shield that regenerates every 18s.',
    description: 'Wraps Gateway in a refractive Sea-Glass Aegis that absorbs any hazard hit and automatically reforms after 18 seconds of unhit climbing.'
  },
  {
    id: 'pulse_ricochet',
    name: 'Prismatic Hydro-Pulse',
    title: 'Prismatic Hydro-Pulse',
    badge: 'CASTER',
    icon: '◇',
    accentColor: '#e879f9',
    shortDesc: '+35% Hydro-Pulse velocity, pierces stunned foes & spins distant Pipe-Valves.',
    description: 'Supercharges Gateway’s wrist Hydro-Caster so pulses fly 35% faster, pierce through bubbled drones, and spin Wall Pipe-Valves from afar.'
  },
  {
    id: 'frill_updraft',
    name: 'Frill Thermal Glide',
    title: 'Frill Thermal Glide',
    badge: 'GLIDE',
    icon: '∆',
    accentColor: '#f472b6',
    shortDesc: 'Hold Jump while descending to flare Gateway’s neck-frills for feather-fall glide.',
    description: 'Flares Gateway’s iridescent webbed neck-frills in mid-air, softening descent speed and extending horizontal chasm reach.'
  }
];

// ============================================================================
// MEANINGFUL 5-ACT STORY ARC & CUTSCENE SCRIPTS
// ============================================================================

export const STORY_ARC = {
  title: "Towering Waters: Gateway's Descent",
  hero: {
    name: 'Gateway',
    homeworld: 'Pelagia',
    species: 'Pelagian Hydro-Saurian Envoy',
    role: 'Keeper of the Harmonic Water Seeds'
  },
  companion: {
    name: 'Naiad',
    role: 'Pelagian Bio-Acoustic Navigator AI'
  },
  antagonist: {
    name: 'The Siphon Syndicate',
    leader: 'Arch-Dredger Vane & The Mother Siphon',
    motive: 'Draining Earth’s five great freshwater and marine watersheds through ten colossal atmospheric Siphon Spires to bottle living biospheres as corporate fuel.'
  },
  cutscenes: {
    prologue: {
      id: 'prologue',
      act: 'PROLOGUE • ORBITAL DESCENT',
      title: 'THE PARCHED BLUE WORLD',
      biome: 'canyon_river',
      towerIdx: 0,
      cameraCue: 'prologue_skyfall',
      beats: [
        {
          speaker: 'naiad',
          name: 'NAIAD • BIO-ACOUSTIC NAVIGATOR',
          text: 'Atmospheric entry complete, Gateway. Below us lies Earth—once a jewel of singing rivers and sapphire seas. Now ten Siphon Syndicate spires are drinking its watersheds dry.'
        },
        {
          speaker: 'gateway',
          name: 'GATEWAY • ENVOY OF PELAGIA',
          text: 'I can feel the riverbed cracking through my scales, Naiad... The Redwood Gorge below is gasping. Our Harmonic Water Seeds are warm—they want to take root.'
        },
        {
          speaker: 'naiad',
          name: 'NAIAD • BIO-ACOUSTIC NAVIGATOR',
          text: 'Each Spire locks stolen water inside its central bedrock shaft. Climb to the Crown Valve, dive straight down the flooded Reactor Core, and plant a Harmonic Seed!'
        }
      ]
    },
    act_1_clear: {
      id: 'act_1_clear',
      act: 'ACT I RESTORED • REDWOOD CANYON RIVERS',
      title: 'THE CATARACTS ROAR AGAIN',
      biome: 'canyon_river',
      towerIdx: 2,
      watershedPct: 100,
      cameraCue: 'purification_crane',
      beats: [
        {
          speaker: 'guardian',
          name: 'ELDER OAKHAVEN • RIVER GUARDIAN',
          text: 'Listen to that thunder, little star-lizard! From the redwoods to the canyon floor, whitewater is pouring over every cliffside waterfall again!'
        },
        {
          speaker: 'gateway',
          name: 'GATEWAY • ENVOY OF PELAGIA',
          text: 'The salmon and river otters are already returning to the rapids! Where does the Siphon conduit lead next, Naiad?'
        },
        {
          speaker: 'naiad',
          name: 'NAIAD • BIO-ACOUSTIC NAVIGATOR',
          text: 'High into the snow-crowned granite peaks! The Syndicate has frozen the Crystal Alpine Lakes behind twin cryo-spillways. Catch the canyon updraft—spread your frills!'
        }
      ]
    },
    act_2_clear: {
      id: 'act_2_clear',
      act: 'ACT II RESTORED • CRYSTAL ALPINE LAKES',
      title: 'MIRROR OF THE SNOW PEAKS',
      biome: 'alpine_lake',
      towerIdx: 4,
      watershedPct: 100,
      cameraCue: 'purification_crane',
      beats: [
        {
          speaker: 'guardian',
          name: 'SPIRIT LUMI • ALPINE GUARDIAN',
          text: 'Look upon the tarn, Gateway—so pure and still it reflects the rose-gold alpenglow of every summit! Our mountain springs feed the lowlands once more.'
        },
        {
          speaker: 'naiad',
          name: 'NAIAD • BIO-ACOUSTIC NAVIGATOR',
          text: 'Intercepting a Siphon Syndicate transmission: their lowland Bayou refineries are choking the southern river delta with dark brine.'
        },
        {
          speaker: 'gateway',
          name: 'GATEWAY • ENVOY OF PELAGIA',
          text: 'Not for long. Let’s ride the snowmelt down into the Emerald Mist Bayous and relight the lotus channels!'
        }
      ]
    },
    act_3_clear: {
      id: 'act_3_clear',
      act: 'ACT III RESTORED • EMERALD MIST BAYOUS',
      title: 'LANTERNS OF THE CYPRESS DELTA',
      biome: 'mist_bayou',
      towerIdx: 6,
      watershedPct: 100,
      cameraCue: 'purification_crane',
      beats: [
        {
          speaker: 'guardian',
          name: 'KEEPER MOSSBACK • BAYOU GUARDIAN',
          text: 'Ten thousand fireflies dancing over jade water, and every lotus blossom open to the twilight! You’ve given the wetlands their heartbeat back, Gateway.'
        },
        {
          speaker: 'gateway',
          name: 'GATEWAY • ENVOY OF PELAGIA',
          text: 'The delta is breathing sweet mist again—and look past the mangroves! The open tropical sea is calling.'
        },
        {
          speaker: 'naiad',
          name: 'NAIAD • BIO-ACOUSTIC NAVIGATOR',
          text: 'Ahead lie the Sunlit Coral Seas. Two offshore Siphon rigs are bleaching the reef lagoons—dive straight in and free the reef guardians!'
        }
      ]
    },
    act_4_clear: {
      id: 'act_4_clear',
      act: 'ACT IV RESTORED • SUNLIT CORAL SEAS',
      title: 'SONG OF THE TURQUOISE ATOLL',
      biome: 'coral_sea',
      towerIdx: 8,
      watershedPct: 100,
      cameraCue: 'purification_crane',
      beats: [
        {
          speaker: 'guardian',
          name: 'MATRIARCH AURELIA • REEF SOVEREIGN',
          text: 'Sunlight dances across living coral shelves once more, Sister of Pelagia! Our manta wings glide through warm turquoise lagoons thanks to your courage.'
        },
        {
          speaker: 'warden',
          name: 'MOTHER SIPHON • POLAR TELEMETRY',
          text: 'WARNING: FOUR CONTINENTAL WATERSHEDS LOST TO PELAGIAN INTERFERENCE. ENGAGING MAXIMUM VORTEX DRAW AT POLAR NEXUS.'
        },
        {
          speaker: 'gateway',
          name: 'GATEWAY • ENVOY OF PELAGIA',
          text: 'That’s the Mother Siphon at the Polar Ocean nexus. Hold tight, Naiad—one final tempest between Earth and total restoration!'
        }
      ]
    },
    epilogue: {
      id: 'epilogue',
      act: 'FINALE • EARTH WATERSHEDS 100% RESTORED',
      title: 'SYMPHONY OF LIVING WATERS',
      biome: 'storm_ocean',
      towerIdx: 10,
      watershedPct: 100,
      cameraCue: 'finale_aurora_bloom',
      beats: [
        {
          speaker: 'guardian',
          name: 'ORACLE BOREALIS • DEEP OCEAN GUARDIAN',
          text: 'The Mother Siphon fractures into sea-glass, and the polar aurora sings from pole to equator! Every river, lake, bayou, reef, and ocean beats as one living tide.'
        },
        {
          speaker: 'naiad',
          name: 'NAIAD • BIO-ACOUSTIC NAVIGATOR',
          text: 'Global hydrosphere telemetry reads 100.0% harmonic balance! Pelagia will rejoice—shall I chart our return star-course, Gateway?'
        },
        {
          speaker: 'gateway',
          name: 'GATEWAY • GUARDIAN OF TWO WORLDS',
          text: 'Give me one more sunrise on those redwood rapids first, Naiad. Earth’s waters are safe—and the tide is just getting fun!'
        }
      ]
    }
  }
};

export const STORY_CUTSCENES = STORY_ARC.cutscenes;

// ============================================================================
// 10 WATERSHED FIELD LOGS (1 PER CAMPAIGN SPIRE, ALIASED AS RELIC_CODEX)
// ============================================================================

export const WATERSHED_LOGS = [
  {
    id: 'relic_t1',
    towerId: 1,
    index: 1,
    code: 'HYDRO LOG 01',
    title: 'Arrival at Redwood Gorge',
    sector: 'Act I • Sunlit Gorge Sluice',
    author: 'Naiad • Pelagian Survey',
    accentColor: '#2dd4bf',
    icon: '◈',
    lore: 'Siphon Spire One clamps straight over the upper redwood cataract, diverting snow-fed river rapids into copper pressure conduits. Gateway’s Tail-Whip can spin their exterior Pipe-Valves to turn their own water pressure against them.',
    text: 'Siphon Spire One clamps straight over the upper redwood cataract, diverting snow-fed river rapids into copper pressure conduits. Gateway’s Tail-Whip can spin their exterior Pipe-Valves to turn their own water pressure against them.',
    description: 'Recovered from Sunlit Gorge Sluice (Spire 1).'
  },
  {
    id: 'relic_t2',
    towerId: 2,
    index: 2,
    code: 'HYDRO LOG 02',
    title: 'Oakhaven’s Floodgate Pact',
    sector: 'Act I • Redwood Cataract Dam',
    author: 'Elder Oakhaven • Gorge Ranger',
    accentColor: '#34d399',
    icon: '≈',
    lore: 'When the Syndicate smashed our lower timber bridges, they forgot one thing: open the brass Floodgate Valves and clean river water fills the basin so an agile swimmer can cross any chasm!',
    text: 'When the Syndicate smashed our lower timber bridges, they forgot one thing: open the brass Floodgate Valves and clean river water fills the basin so an agile swimmer can cross any chasm!',
    description: 'Recovered from Redwood Cataract Dam (Spire 2).'
  },
  {
    id: 'relic_t3',
    towerId: 3,
    index: 3,
    code: 'HYDRO LOG 03',
    title: 'Crystal Tarn Resonance',
    sector: 'Act II • Mirror Tarn Aqueduct',
    author: 'Dr. Elena Vance • Alpine Hydrology',
    accentColor: '#38bdf8',
    icon: '✳',
    lore: 'Wet quartz-crystal veins grow vertically up the silver-granite aqueducts. Native rock-salamanders—and Pelagian hydro-lizards—can scamper straight up those wet crystal strips on all fours.',
    text: 'Wet quartz-crystal veins grow vertically up the silver-granite aqueducts. Native rock-salamanders—and Pelagian hydro-lizards—can scamper straight up those wet crystal strips on all fours.',
    description: 'Recovered from Mirror Tarn Aqueduct (Spire 3).'
  },
  {
    id: 'relic_t4',
    towerId: 4,
    index: 4,
    code: 'HYDRO LOG 04',
    title: 'Alpenglow Wind & Bronze Rings',
    sector: 'Act II • Alpenglow Spillway Spire',
    author: 'Spirit Lumi • High Tarn Steward',
    accentColor: '#7dd3fc',
    icon: '∆',
    lore: 'Mountain gales sweep across the high glacial spillways every six seconds, but ancient bronze bell-rings hang over the widest chasms—perfect for a prehensile lizard tail to snag mid-leap!',
    text: 'Mountain gales sweep across the high glacial spillways every six seconds, but ancient bronze bell-rings hang over the widest chasms—perfect for a prehensile lizard tail to snag mid-leap!',
    description: 'Recovered from Alpenglow Spillway Spire (Spire 4).'
  },
  {
    id: 'relic_t5',
    towerId: 5,
    index: 5,
    code: 'HYDRO LOG 05',
    title: 'Cipher of the Sunken Temple',
    sector: 'Act III • Firefly Cypress Reliquary',
    author: 'Keeper Mossback • Delta Archive',
    accentColor: '#fbbf24',
    icon: '◇',
    lore: 'Our ancestors built sunlit Aqueduct Sanctums inside the bayou limestone. Each chamber’s glyph mosaic or water-bell sequence is carved onto the exterior wall stele just above the doorway.',
    text: 'Our ancestors built sunlit Aqueduct Sanctums inside the bayou limestone. Each chamber’s glyph mosaic or water-bell sequence is carved onto the exterior wall stele just above the doorway.',
    description: 'Recovered from Firefly Cypress Reliquary (Spire 5).'
  },
  {
    id: 'relic_t6',
    towerId: 6,
    index: 6,
    code: 'HYDRO LOG 06',
    title: 'Barnacle Mortar Counter-Play',
    sector: 'Act III • Sunken Lotus Floodgate',
    author: 'Naiad • Tactical Combat Scan',
    accentColor: '#10b981',
    icon: '◎',
    lore: 'Siphon Barnacle Mortars peel open five iron petals with an orange-cyan pressure glow before lobbing volatile water-sludge globes. Time a 360° Tail-Whip to bat the globe straight back!',
    text: 'Siphon Barnacle Mortars peel open five iron petals with an orange-cyan pressure glow before lobbing volatile water-sludge globes. Time a 360° Tail-Whip to bat the globe straight back!',
    description: 'Recovered from Sunken Lotus Floodgate (Spire 6).'
  },
  {
    id: 'relic_t7',
    towerId: 7,
    index: 7,
    code: 'HYDRO LOG 07',
    title: 'Atoll Reef Bio-Telemetry',
    sector: 'Act IV • Mother-of-Pearl Atoll Spire',
    author: 'Matriarch Aurelia • Lagoon Choir',
    accentColor: '#f472b6',
    icon: '✦',
    lore: 'Beneath the translucent turquoise lagoon, Siphon Snap-Claw Dredgers patrol the coral terraces. Flip a Dredger onto its curved dorsal shell with a Tail-Whip and bounce skyward off its carapace!',
    text: 'Beneath the translucent turquoise lagoon, Siphon Snap-Claw Dredgers patrol the coral terraces. Flip a Dredger onto its curved dorsal shell with a Tail-Whip and bounce skyward off its carapace!',
    description: 'Recovered from Mother-of-Pearl Atoll Spire (Spire 7).'
  },
  {
    id: 'relic_t8',
    towerId: 8,
    index: 8,
    code: 'HYDRO LOG 08',
    title: 'Syndicate Tanker Ledger',
    sector: 'Act IV • Pelagic Reef Conduit',
    author: 'Intercepted Syndicate Dispatch',
    accentColor: '#22d3ee',
    icon: '⬡',
    lore: 'Arch-Dredger Vane didn’t come merely for H2O—Earth’s living microbial & harmonic water memory powers the Syndicate’s warp drives. Every Harmonic Seed Gateway plants permanently severs their siphon lock.',
    text: 'Arch-Dredger Vane didn’t come merely for H2O—Earth’s living microbial & harmonic water memory powers the Syndicate’s warp drives. Every Harmonic Seed Gateway plants permanently severs their siphon lock.',
    description: 'Recovered from Pelagic Reef Conduit (Spire 8).'
  },
  {
    id: 'relic_t9',
    towerId: 9,
    index: 9,
    code: 'HYDRO LOG 09',
    title: 'Aurora Maelstrom Convergence',
    sector: 'Act V • Aurora Iceberg Bastion',
    author: 'Oracle Borealis • Polar Deep',
    accentColor: '#818cf8',
    icon: '↯',
    lore: 'Where emerald auroras touch the glacial sea, Spire Nine channels megavolt storm-veins through dark basalt ribs. Use recessed sanctum archways to shelter from tempest gusts.',
    text: 'Where emerald auroras touch the glacial sea, Spire Nine channels megavolt storm-veins through dark basalt ribs. Use recessed sanctum archways to shelter from tempest gusts.',
    description: 'Recovered from Aurora Iceberg Bastion (Spire 9).'
  },
  {
    id: 'relic_t10',
    towerId: 10,
    index: 10,
    code: 'HYDRO LOG 10',
    title: 'Covenant of Pelagia & Earth',
    sector: 'Act V • The Mother Siphon Citadel',
    author: 'Gateway • Personal Star-Log',
    accentColor: '#5efce8',
    icon: '♛',
    lore: 'Ten spires climbed, five watersheds singing again. When this final Harmonic Seed blooms at the bedrock of the Mother Siphon, Pelagia and Earth will share a living tide forever.',
    text: 'Ten spires climbed, five watersheds singing again. When this final Harmonic Seed blooms at the bedrock of the Mother Siphon, Pelagia and Earth will share a living tide forever.',
    description: 'Recovered from The Mother Siphon Citadel (Spire 10).'
  }
];

export const RELIC_CODEX = WATERSHED_LOGS;

// ============================================================================
// 12 NATURALIST CURIOS & HARMONIC BLUEPRINTS
// ============================================================================

export const CURIO_CATALOG = [
  {
    id: 'curio_astrolabe',
    index: 1,
    category: 'curio',
    name: 'Tidal Brass Astrolabe',
    title: 'Tidal Brass Astrolabe',
    sector: 'Sanctum & Expedition • Survey',
    gearBonus: 5,
    accentColor: '#fbbf24',
    icon: '◎',
    lore: 'Gilded three-ring celestial dial calibrated to Earth’s lunar spring-tide harmonics.',
    text: 'Gilded three-ring celestial dial calibrated to Earth’s lunar spring-tide harmonics.',
    description: 'Gilded three-ring celestial dial calibrated to Earth’s lunar spring-tide harmonics.'
  },
  {
    id: 'curio_nautilus',
    index: 2,
    category: 'curio',
    name: 'Iridescent Sea-Glass Nautilus',
    title: 'Iridescent Sea-Glass Nautilus',
    sector: 'Coral Seas • Reef Survey',
    gearBonus: 5,
    accentColor: '#5efce8',
    icon: '◈',
    lore: 'Crystalline spiral shell resonating with warm pelagic lagoon currents.',
    text: 'Crystalline spiral shell resonating with warm pelagic lagoon currents.',
    description: 'Crystalline spiral shell resonating with warm pelagic lagoon currents.'
  },
  {
    id: 'curio_chronometer',
    index: 3,
    category: 'curio',
    name: 'Redwood River Sundial',
    title: 'Redwood River Sundial',
    sector: 'Canyon Rivers • Gorge Cache',
    gearBonus: 5,
    accentColor: '#38bdf8',
    icon: '◷',
    lore: 'Carved copper-and-redwood pocket sundial left by canyon dam keepers—still gleaming in waterfall mist.',
    text: 'Carved copper-and-redwood pocket sundial left by canyon dam keepers—still gleaming in waterfall mist.',
    description: 'Carved copper-and-redwood pocket sundial left by canyon dam keepers—still gleaming in waterfall mist.'
  },
  {
    id: 'curio_prism_lens',
    index: 4,
    category: 'curio',
    name: 'Refractive Rainbow Prism',
    title: 'Refractive Rainbow Prism',
    sector: 'Sanctum Trials • Optic Vault',
    gearBonus: 5,
    accentColor: '#e879f9',
    icon: '◇',
    lore: 'Precision-ground amethyst octahedron used to split sunlit aqueduct beams.',
    text: 'Precision-ground amethyst octahedron used to split sunlit aqueduct beams.',
    description: 'Precision-ground amethyst octahedron used to split sunlit aqueduct beams.'
  },
  {
    id: 'curio_compass',
    index: 5,
    category: 'curio',
    name: 'Pelagian Wayfinder Compass',
    title: 'Pelagian Wayfinder Compass',
    sector: 'Watershed Expedition • Hoard',
    gearBonus: 5,
    accentColor: '#34d399',
    icon: '✦',
    lore: 'Floating star-stone needle pointing unerringly toward dormant Harmonic Water Seeds.',
    text: 'Floating star-stone needle pointing unerringly toward dormant Harmonic Water Seeds.',
    description: 'Floating star-stone needle pointing unerringly toward dormant Harmonic Water Seeds.'
  },
  {
    id: 'curio_automaton_heart',
    index: 6,
    category: 'curio',
    name: 'Purified Hydro-Turbine Core',
    title: 'Purified Hydro-Turbine Core',
    sector: 'Canyon Rivers • Dam Salvage',
    gearBonus: 5,
    accentColor: '#f59e0b',
    icon: '❖',
    lore: 'Miniature copper waterwheel governor reclaimed from a purified Siphon sluice.',
    text: 'Miniature copper waterwheel governor reclaimed from a purified Siphon sluice.',
    description: 'Miniature copper waterwheel governor reclaimed from a purified Siphon sluice.'
  },
  {
    id: 'curio_frost_orchid',
    index: 7,
    category: 'curio',
    name: 'Alpenglow Ice-Lotus',
    title: 'Alpenglow Ice-Lotus',
    sector: 'Alpine Lakes • Glacial Tarn',
    gearBonus: 5,
    accentColor: '#67e8f9',
    icon: '✳',
    lore: 'Bioluminescent snow-blossom preserved inside crystal-clear mountain quartz.',
    text: 'Bioluminescent snow-blossom preserved inside crystal-clear mountain quartz.',
    description: 'Bioluminescent snow-blossom preserved inside crystal-clear mountain quartz.'
  },
  {
    id: 'curio_thunder_glass',
    index: 8,
    category: 'curio',
    name: 'Aurora Fulgurite Vial',
    title: 'Aurora Fulgurite Vial',
    sector: 'Polar Oceans • Tempest Cache',
    gearBonus: 5,
    accentColor: '#818cf8',
    icon: '↯',
    lore: 'Hollow tube of vitrified sea-sand humming with trapped polar aurora light.',
    text: 'Hollow tube of vitrified sea-sand humming with trapped polar aurora light.',
    description: 'Hollow tube of vitrified sea-sand humming with trapped polar aurora light.'
  },
  {
    id: 'blueprint_beacon_dynamo',
    index: 9,
    category: 'blueprint',
    name: 'Blueprint: Harmonic Sluice Dynamo',
    title: 'Blueprint: Harmonic Sluice Dynamo',
    sector: 'Workbench Craft • Watershed Repair',
    gearBonus: 8,
    accentColor: '#fbbf24',
    icon: '⬡',
    lore: 'Field schematic assembling a Copper Impeller, Sea-Glass Lens, and Redwood Viva-Shaft into a self-purifying spire stabilizer.',
    text: 'Field schematic assembling a Copper Impeller, Sea-Glass Lens, and Redwood Viva-Shaft into a self-purifying spire stabilizer.',
    description: 'Crafted at a Hydro-Workbench during a Sanctum or Expedition climb.'
  },
  {
    id: 'blueprint_mk7_thruster',
    index: 10,
    category: 'blueprint',
    name: 'Blueprint: Hydro-Wake Tail Fin',
    title: 'Blueprint: Hydro-Wake Tail Fin',
    sector: 'Workbench Craft • Rapids Surf',
    gearBonus: 8,
    accentColor: '#22d3ee',
    icon: '≈',
    lore: 'Harmonic harness tuning allowing Gateway’s lizard tail to carve standing whitewater rapids at high speed.',
    text: 'Harmonic harness tuning allowing Gateway’s lizard tail to carve standing whitewater rapids at high speed.',
    description: 'Unlocked through Sanctum & Expedition milestones.'
  },
  {
    id: 'blueprint_skywing_rib',
    index: 11,
    category: 'blueprint',
    name: 'Blueprint: Iridescent Frill-Weave',
    title: 'Blueprint: Iridescent Frill-Weave',
    sector: 'Workbench Craft • Canyon Updrafts',
    gearBonus: 8,
    accentColor: '#a7f3d0',
    icon: '∆',
    lore: 'Resonant water-ribbon amplifiers that stream from Gateway’s flared neck-frills in canyon thermals.',
    text: 'Resonant water-ribbon amplifiers that stream from Gateway’s flared neck-frills in canyon thermals.',
    description: 'Recovered from high-altitude spire expeditions.'
  },
  {
    id: 'blueprint_cryo_condenser',
    index: 12,
    category: 'blueprint',
    name: 'Blueprint: Pelagian Seed Amplifier',
    title: 'Blueprint: Pelagian Seed Amplifier',
    sector: 'Workbench Craft • Hydro-Caster',
    gearBonus: 8,
    accentColor: '#f472b6',
    icon: '★',
    lore: 'Triple-chambered sea-glass resonator enabling custom prismatic Hydro-Pulse waveforms.',
    text: 'Triple-chambered sea-glass resonator enabling custom prismatic Hydro-Pulse waveforms.',
    description: 'Recovered from deep expedition vaults and chests.'
  }
];

function tDef(id, title, description, tier, points, category, icon) {
  return { id, title, description, tier, points, category, icon };
}

// EXACTLY 100 Trophies totaling EXACTLY 1,000 points:
// 50 aluminum (5 pts = 250) + 30 copper (10 pts = 300) + 15 platinum (20 pts = 300) + 5 diamond (30 pts = 150)
export const TROPHIES = [
  // ================= ALUMINUM TIER: 50 × 5 PTS = 250 PTS =================
  // Campaign Spires 1-10 & Core Mechanics (18)
  tDef('first_purify', 'Seed Planter', 'Purify your first Siphon Spire in any mode.', 'aluminum', 5, 'campaign', '❖'),
  tDef('mist_walker', 'Gorge Sluice Purified', 'Purify Campaign Spire 1 (Sunlit Gorge Sluice).', 'aluminum', 5, 'campaign', '◈'),
  tDef('clear_reboot_t2', 'Cataract Liberator', 'Purify Campaign Spire 2 (Redwood Cataract Dam).', 'aluminum', 5, 'campaign', '≈'),
  tDef('clear_reboot_t3', 'Mirror Tarn Cleansed', 'Purify Campaign Spire 3 (Mirror Tarn Aqueduct).', 'aluminum', 5, 'campaign', '❖'),
  tDef('clear_reboot_t4', 'Alpenglow Climber', 'Purify Campaign Spire 4 (Alpenglow Spillway Spire).', 'aluminum', 5, 'campaign', '✳'),
  tDef('clear_reboot_t5', 'Firefly Reliquary Freed', 'Purify Campaign Spire 5 (Firefly Cypress Reliquary).', 'aluminum', 5, 'campaign', '◇'),
  tDef('clear_reboot_t6', 'Lotus Floodgate Opened', 'Purify Campaign Spire 6 (Sunken Lotus Floodgate).', 'aluminum', 5, 'campaign', '⬡'),
  tDef('clear_reboot_t7', 'Atoll Pearl Awakened', 'Purify Campaign Spire 7 (Mother-of-Pearl Atoll Spire).', 'aluminum', 5, 'campaign', '↯'),
  tDef('clear_reboot_t8', 'Reef Conduit Healed', 'Purify Campaign Spire 8 (Pelagic Reef Conduit).', 'aluminum', 5, 'campaign', '★'),
  tDef('clear_spire_9', 'Aurora Bastion Breached', 'Purify Campaign Spire 9 (Aurora Iceberg Bastion).', 'aluminum', 5, 'campaign', '✳'),
  tDef('clear_spire_10', 'Mother Siphon Shattered', 'Purify Campaign Spire 10 (The Mother Siphon Citadel).', 'aluminum', 5, 'campaign', '♛'),
  tDef('lift_rider', 'Mechanical Ascender', 'Ride a twin-rail mechanical elevator to its upper stop.', 'aluminum', 5, 'campaign', '▲'),
  tDef('lift_caller', 'Hydro Recall', 'Recall or power a mechanical elevator using Hydro-Pulse or a Pipe-Valve.', 'aluminum', 5, 'campaign', '◎'),
  tDef('tunnel_runner', 'Sanctum Passage', 'Traverse an interior stone archway shortcut.', 'aluminum', 5, 'campaign', '◈'),
  tDef('spark_diver', 'Conduit Shortcut', 'Thread a glowing hydro-conduit archway.', 'aluminum', 5, 'campaign', '✦'),
  tDef('drain_plumber', 'Valve Engineer', 'Spin a brass Pipe-Valve or Drain Valve to route spire water.', 'aluminum', 5, 'campaign', '≈'),
  tDef('steam_surfer', 'Geyser Updraft', 'Launch skyward on an erupting hydro-geyser vent.', 'aluminum', 5, 'campaign', '»'),
  tDef('belt_flipper', 'Current Reversal', 'Reverse hydro-channel flow direction using a sluice switch.', 'aluminum', 5, 'campaign', '⇄'),

  // Lizard Abilities, Purist Arcade & Flood Rush Onboarding (8)
  tDef('tail_whip_first', 'Lizard Snap', 'Unleash Gateway’s 360° Tail-Whip inside a spire.', 'aluminum', 5, 'combat', '◎'),
  tDef('crab_flipper', 'Carapace Springboard', 'Flip a Snap-Claw Dredger onto its back and bounce high off its shell.', 'aluminum', 5, 'combat', '▲'),
  tDef('gecko_climber', 'Gecko Grip', 'Scamper vertically up a wet crystal or moss Wall-Strip.', 'aluminum', 5, 'exploration', '»'),
  tDef('grapple_swinger', 'Prehensile Vault', 'Snag an aerial Grapple Ring with Gateway’s tail to cross a chasm.', 'aluminum', 5, 'exploration', '∆'),
  tDef('floodgate_swimmer', 'Buoyant Hydro-Saurian', 'Raise clean Floodgate water and swim across a broken lower bridge.', 'aluminum', 5, 'exploration', '≈'),
  tDef('purist_first', 'Purist Initiate', 'Clear a spire under strict 1-Hit Purist Arcade stakes.', 'aluminum', 5, 'purist', '▲'),
  tDef('flood_rush_first', 'Surge Outrunner', 'Survive Spire 1 in Flash-Flood Survival mode.', 'aluminum', 5, 'endless_daily', '≈'),
  tDef('classic_extra_life', '5,000-Point 1-UP', 'Earn a bonus life at a 5,000-point score threshold.', 'aluminum', 5, 'purist', '✦'),

  // Combat & Hydro-Caster (6)
  tDef('first_snowball', 'Hydro Calibration', 'Fire Gateway’s wrist Hydro-Caster inside a spire.', 'aluminum', 5, 'combat', '✳'),
  tDef('box_breaker', 'Siphon Lock Shatter', 'Demolish a Siphon barrier crate with Hydro-Pulse or Tail-Whip.', 'aluminum', 5, 'combat', '❖'),
  tDef('roller_shatter', 'Dredger Neutralized', 'Flip or neutralize a Snap-Claw Dredger.', 'aluminum', 5, 'combat', '◎'),
  tDef('bouncer_freeze', 'Hopper Bubbled', 'Encase a Gulp-Hopper Drone in a sea-glass bubble.', 'aluminum', 5, 'combat', '✳'),
  tDef('sentinel_short', 'Skater Grounded', 'Stun a patrolling Riptide Rail-Skater or Volt-Eel.', 'aluminum', 5, 'combat', '↯'),
  tDef('shield_saver', 'Bubble Aegis Saved', 'Absorb an enemy or hazard impact with an active Sea-Glass Shield.', 'aluminum', 5, 'combat', '◎'),

  // 5 Gateway Mini-Games Onboarding (9)
  tDef('core_dive_novice', 'Into the Reactor Tube', 'Complete your first playable Reactor Core Descent.', 'aluminum', 5, 'minigames', '▾'),
  tDef('sub_novice', 'Reef Swimmer', 'Complete an underwater voyage in Coral & Lakebed Free-Swim.', 'aluminum', 5, 'minigames', '◎'),
  tDef('sub_mine_sweeper', 'Cage Breaker', 'Shatter a Siphon snare or mine during Reef Free-Swim.', 'aluminum', 5, 'minigames', '✦'),
  tDef('skimmer_novice', 'Rapids Tail-Surfer', 'Complete a canyon sprint in Whitewater Rapids Tail-Surf.', 'aluminum', 5, 'minigames', '»'),
  tDef('skimmer_ramp_air', 'Whitewater Crest Leap', 'Launch off a foaming river wave-ramp in Rapids Tail-Surf.', 'aluminum', 5, 'minigames', '∆'),
  tDef('skimmer_crate_buster', 'Driftwood Clearing', 'Shatter Siphon flotsam crates during Rapids Tail-Surf.', 'aluminum', 5, 'minigames', '❖'),
  tDef('glide_novice', 'Frill Flyer', 'Complete a sunlit canyon flight in Updraft Frill-Glide.', 'aluminum', 5, 'minigames', '∆'),
  tDef('glide_thermal', 'Mist Updraft Rider', 'Gain altitude inside a rainbow waterfall thermal in Frill-Glide.', 'aluminum', 5, 'minigames', '≈'),
  tDef('vault_novice', 'Tumbler Apprentice', 'Lock your first rotating ring inside a Harmonic Core Vault.', 'aluminum', 5, 'minigames', '⬡'),

  // Exploration, Sanctum Trials, Expedition & Daily Tide Onboarding (9)
  tDef('first_gear', 'Hydro-Gear Gatherer', 'Collect your first golden Hydro-Gear.', 'aluminum', 5, 'exploration', '❖'),
  tDef('first_star_core', 'Seed Keeper', 'Earn your first Harmonic Water Seed.', 'aluminum', 5, 'exploration', '★'),
  tDef('relic_finder_1', 'Watershed Signal', 'Recover your first Watershed Field Log tablet.', 'aluminum', 5, 'exploration', '◈'),
  tDef('casual_explorer', 'Sanctum Pilgrim', 'Complete a timer-free spire in Sanctum Puzzle Trials.', 'aluminum', 5, 'exploration', '✧'),
  tDef('tinker_apprentice', 'Watershed Tinker', 'Gather 3 Salvage Parts and craft a Harmonic Dynamo at a Workbench.', 'aluminum', 5, 'exploration', '⬡'),
  tDef('chest_plunderer', 'Sunken Reliquary', 'Find 3 Wayfinder Keys and unlock a Summit Treasure Chest.', 'aluminum', 5, 'exploration', '★'),
  tDef('expedition_first', 'Bio-Mutant Envoy', 'Draft your first Bio-Mutation in Watershed Expedition mode.', 'aluminum', 5, 'endless_daily', '✦'),
  tDef('daily_try', 'Tide Contender', 'Attempt a UTC Daily Tide Run challenge.', 'aluminum', 5, 'endless_daily', '◷'),
  tDef('zen_voyager', 'Gentle Current', 'Purify a spire with Zen Assist or Sanctum calm active.', 'aluminum', 5, 'exploration', '✧'),

  // ================= COPPER TIER: 30 × 10 PTS = 300 PTS =================
  // Speed Pars, Biome Mastery & Bosses (10)
  tDef('speed_reboot_t1', 'Gorge Sprinter', 'Beat the Speed Par time on Sunlit Gorge Sluice (Spire 1).', 'copper', 10, 'campaign', '↯'),
  tDef('speed_reboot_t2', 'Cataract Dasher', 'Beat the Speed Par time on Redwood Cataract Dam (Spire 2).', 'copper', 10, 'campaign', '↯'),
  tDef('speed_demon', 'Chrono Stream', 'Earn the Speed Seed medal on 3 different spires.', 'copper', 10, 'campaign', '↯'),
  tDef('tide_runner', 'Dry Scales', 'Clear Sunken Lotus Floodgate (Spire 6) without falling into unpurified brine.', 'copper', 10, 'campaign', '≈'),
  tDef('wind_walker', 'Mountain Surefoot', 'Clear Alpenglow Spillway Spire (Spire 4) without falling into the tarn.', 'copper', 10, 'campaign', '✳'),
  tDef('piston_dancer', 'Coral Rhythm', 'Clear Pelagic Reef Conduit (Spire 8) with zero enemy or hazard hits.', 'copper', 10, 'campaign', '⬡'),
  tDef('blackout_beacon', 'Aurora Pathfinder', 'Clear Aurora Iceberg Bastion (Spire 9) with zero falls.', 'copper', 10, 'campaign', '✧'),
  tDef('storm_ghost', 'Untouchable Lizard', 'Purify any combat spire without taking a single hit.', 'copper', 10, 'combat', '✧'),
  tDef('warden_slayer', 'Warden Breaker', 'Defeat an Act-End Siphon Warden Leviathan-Mech.', 'copper', 10, 'combat', '♛'),
  tDef('mortar_reflector', 'Return to Sender', 'Deflect a Barnacle Mortar bubble with Tail-Whip to shatter a foe.', 'copper', 10, 'combat', '◎'),

  // Secret Aqueduct Sanctums & Core Vaults (8)
  tDef('rune_scholar', 'Glyph Reader', 'Decipher an exterior stele clue and solve an Aqueduct Sanctum.', 'copper', 10, 'exploration', '◈'),
  tDef('rune_lights_clear', 'Mosaic Illuminator', 'Solve an Aqueduct Mosaic Sanctum.', 'copper', 10, 'minigames', '◈'),
  tDef('rune_bells_clear', 'Water-Bell Virtuoso', 'Chime the exact sequence in a Harmonic Bells Sanctum.', 'copper', 10, 'minigames', '◈'),
  tDef('rune_beam_clear', 'Sea-Glass Optician', 'Align rotary mirrors to solve a Sea-Glass Prism Sanctum.', 'copper', 10, 'minigames', '◇'),
  tDef('rune_blocks_clear', 'Sluice Tactician', 'Seal every pressure basin in a Sluice Basins Sanctum.', 'copper', 10, 'minigames', '❖'),
  tDef('switch_architect', 'Bayou Conduit Master', 'Purify Firefly Cypress Reliquary (Spire 5) solving its Sanctum.', 'copper', 10, 'campaign', '◇'),
  tDef('vault_cracker', 'Harmonic Locksmith', 'Unlock a Harmonic Core Vault with zero missed strikes.', 'copper', 10, 'minigames', '⬡'),
  tDef('vault_t8_clear', 'Mother Vault Breached', 'Unlock the Harmonic Core Vault on Spire 8 or Spire 10.', 'copper', 10, 'exploration', '★'),

  // Combat Combos & 5 Mini-Game Aces (7)
  tDef('snowball_sniper', 'Hydro Virtuoso', 'Achieve a 4x combat action combo inside a spire.', 'copper', 10, 'combat', '✳'),
  tDef('core_triple_smash', 'Core Crystal Crusher', 'Smash all 3 Siphon Crystal Cores during a single Reactor Core Descent.', 'copper', 10, 'minigames', '▾'),
  tDef('sub_ace', 'Wildlife Rescuer', 'Rescue 10+ reef creatures in a single Free-Swim stage.', 'copper', 10, 'minigames', '✦'),
  tDef('warp_finder', 'Grotto Secret', 'Swim into the hidden bioluminescent Grotto Cavern in Reef Free-Swim.', 'copper', 10, 'minigames', '◎'),
  tDef('skimmer_pro', 'Canyon Wake Carver', 'Reach a 4x Hydro-Gate multiplier in Rapids Tail-Surf.', 'copper', 10, 'minigames', '»'),
  tDef('sky_rider', 'Canyon Frill Ace', 'Complete Frill-Glide catching a Golden Orb or 4x Thermal Ring chain.', 'copper', 10, 'minigames', '∆'),
  tDef('arcade_tourist', 'Watershed Pentathlete', 'Experience all 5 signature Gateway Mini-Games.', 'copper', 10, 'minigames', '★'),

  // Modes & Collection Milestones (5)
  tDef('daily_climber', 'Daily Tide Champion', 'Complete a UTC Daily Tide Run spire.', 'copper', 10, 'endless_daily', '◷'),
  tDef('endless_3', 'Rising Surge Veteran', 'Survive 3 consecutive spires in Flash-Flood Survival or Expedition.', 'copper', 10, 'endless_daily', '∞'),
  tDef('curio_collector_4', 'Watershed Naturalist', 'Catalog 4 Naturalist Curios or Blueprints in your Codex.', 'copper', 10, 'exploration', '◎'),
  tDef('relic_hunter_4', 'Field Hydrologist', 'Recover 5 Watershed Field Log tablets.', 'copper', 10, 'exploration', '◈'),
  tDef('first_skin', 'Iridescent Shed', 'Unlock an additional Gateway Skin or Hydro-Pulse FX.', 'copper', 10, 'exploration', '❖'),

  // ================= PLATINUM TIER: 15 × 20 PTS = 300 PTS =================
  tDef('sector_1_master', 'Guardian of Redwood Rivers', 'Restore Act I Canyon Rivers to 100% and earn all 6 Act I Seeds.', 'platinum', 20, 'campaign', '★'),
  tDef('sector_2_master', 'Guardian of Alpine Lakes', 'Restore Act II Alpine Lakes to 100% and earn all 6 Act II Seeds.', 'platinum', 20, 'campaign', '★'),
  tDef('sector_3_master', 'Guardian of Mist Bayous', 'Restore Act III Mist Bayous to 100% and earn all 6 Act III Seeds.', 'platinum', 20, 'campaign', '★'),
  tDef('sector_4_master', 'Guardian of Coral Seas', 'Restore Act IV Coral Seas to 100% and earn all 6 Act IV Seeds.', 'platinum', 20, 'campaign', '★'),
  tDef('sector_5_master', 'Guardian of Polar Oceans', 'Restore Act V Polar Oceans to 100% and earn all 6 Act V Seeds.', 'platinum', 20, 'campaign', '★'),
  tDef('watershed_envoy', 'Envoy of Living Waters', 'Purify all 10 Story Spires across Earth’s 5 Watersheds.', 'platinum', 20, 'campaign', '★'),
  tDef('purist_master', 'Purist Arcade Master', 'Clear 5 spires in strict 1-Hit Purist Arcade Mode.', 'platinum', 20, 'purist', '▲'),
  tDef('pacifist_climb', 'Silent Current', 'Reach a non-zen spire’s Crown Valve without firing a single Hydro-Pulse.', 'platinum', 20, 'combat', '✧'),
  tDef('chrono_olympian', 'Tidal Speedster', 'Earn 8 Speed Seed medals across Campaign or Purist spires.', 'platinum', 20, 'campaign', '↯'),
  tDef('endless_5', 'Apex of the Surge', 'Clear 5 consecutive spires in Flash-Flood Survival or Watershed Expedition.', 'platinum', 20, 'endless_daily', '∞'),
  tDef('daily_speed_ace', 'Global Tide-Setter', 'Complete a Daily Tide Run beating its Speed Par time.', 'platinum', 20, 'endless_daily', '◷'),
  tDef('chronicler_five_seas', 'Chronicler of Five Seas', 'Recover all 10 Watershed Field Log tablets (10/10).', 'platinum', 20, 'exploration', '◈'),
  tDef('curio_archivist_12', 'Master Naturalist', 'Collect all 12 Watershed Curios and Harmonic Blueprints (12/12).', 'platinum', 20, 'exploration', '◎'),
  tDef('wardrobe_complete', 'Pelagian Regalia', 'Unlock all 8 Gateway Skins in the Wardrobe.', 'platinum', 20, 'exploration', '❖'),
  tDef('arsenal_complete', 'Prismatic Resonator', 'Unlock all 6 Hydro-Pulse FX styles.', 'platinum', 20, 'combat', '✳'),

  // ================= DIAMOND TIER: 5 × 30 PTS = 150 PTS =================
  tDef('watershed_sovereign', 'Sovereign of Earth’s Waters', 'Restore all 5 Watersheds to 100% and earn 30 Harmonic Water Seeds.', 'diamond', 30, 'campaign', '♛'),
  tDef('purist_immortal', 'Purist Immortal', 'Conquer a full Purist Arcade gauntlet with an 8x Skill Multiplier.', 'diamond', 30, 'purist', '♛'),
  tDef('abyssal_titan', 'Expedition Leviathan', 'Clear a 10-spire Watershed Expedition or survive 10 Flash-Flood spires.', 'diamond', 30, 'endless_daily', '♛'),
  tDef('flawless_sector', 'Flawless Watershed Sweep', 'Purify an Act Boss spire with 0 hits, Sanctum/Vault, Speed Par & 3 Core Crystals.', 'diamond', 30, 'campaign', '♛'),
  tDef('harmonic_millennium', 'Harmonic Millennium', 'Unlock all other 99 Trophies to achieve a perfect 1,000 / 1,000 Trophy Score.', 'diamond', 30, 'exploration', '♛')
];

const VALID_CONTROLS = new Set(['gesture', 'joystick', 'dpad', 'tilt']);
const VALID_BUCKETS = new Set([
  'campaign',
  'purist',
  'flood_rush',
  'sanctum_trials',
  'expedition',
  'daily_tide'
]);
const BUCKET_ALIASES = {
  reboot: 'campaign',
  reboot_campaign: 'campaign',
  original: 'purist',
  original_campaign: 'purist',
  endless: 'flood_rush',
  casual: 'sanctum_trials',
  endless_casual: 'sanctum_trials',
  daily: 'daily_tide'
};

const VALID_MINIGAMES = new Set([
  'core_descent',
  'reef_swim',
  'rapids_surf',
  'frill_glide',
  'aqueduct_sanctum'
]);
const MINIGAME_ALIASES = {
  submarine: 'reef_swim',
  skimmer: 'rapids_surf',
  glide: 'frill_glide',
  puzzle: 'aqueduct_sanctum',
  vault: 'aqueduct_sanctum'
};

const SKIN_BY_ID = new Map(SKIN_CATALOG.map((s) => [s.id, s]));
const FX_BY_ID = new Map(HYDRO_FX_CATALOG.map((b) => [b.id, b]));
const LOG_BY_ID = new Map(WATERSHED_LOGS.map((r) => [r.id, r]));
const CURIO_BY_ID = new Map(CURIO_CATALOG.map((c) => [c.id, c]));
const MUTATION_BY_ID = new Map(BIO_MUTATIONS.map((m) => [m.id, m]));
const TROPHY_BY_ID = new Map(TROPHIES.map((t) => [t.id, t]));
const BIOME_KEYS = WATERSHED_BIOMES.map((b) => b.key);

const TIER_META = {
  aluminum: { total: 50, pointsEach: 5, maxPoints: 250 },
  copper: { total: 30, pointsEach: 10, maxPoints: 300 },
  platinum: { total: 15, pointsEach: 20, maxPoints: 300 },
  diamond: { total: 5, pointsEach: 30, maxPoints: 150 }
};

function resolveBucket(bucket) {
  const b = String(bucket || 'campaign');
  if (VALID_BUCKETS.has(b)) return b;
  return BUCKET_ALIASES[b] || 'campaign';
}

function resolveSkinId(skinId) {
  const s = String(skinId || '');
  if (SKIN_BY_ID.has(s)) return s;
  if (LEGACY_SKIN_ALIAS[s]) return LEGACY_SKIN_ALIAS[s];
  return 'sea_glass_guardian';
}

function resolveFxId(fxId) {
  const f = String(fxId || '');
  if (FX_BY_ID.has(f)) return f;
  if (LEGACY_FX_ALIAS[f]) return LEGACY_FX_ALIAS[f];
  return 'tidal_pearl';
}

function resolveMiniGameId(mode) {
  const m = String(mode || '');
  if (VALID_MINIGAMES.has(m)) return m;
  return MINIGAME_ALIASES[m] || null;
}

function normalizeStarRecord(rec = {}) {
  const clear = Boolean(rec.clear);
  const vault = Boolean(rec.vault);
  const speed = Boolean(rec.speed);
  const nohit = Boolean(rec.nohit);
  const combo = Boolean(rec.combo);
  const count = (clear ? 1 : 0) + (vault ? 1 : 0) + (speed ? 1 : 0);
  const medalsCount = count + (nohit ? 1 : 0) + (combo ? 1 : 0);
  return { clear, vault, speed, nohit, combo, count, medalsCount };
}

function createFreshState() {
  return {
    version: 5,
    settings: { ...DEFAULT_SETTINGS },
    highScores: {
      campaign: 0,
      purist: 0,
      flood_rush: 0,
      sanctum_trials: 0,
      expedition: 0,
      daily_tide: 0
    },
    watershedHealth: {
      canyon_river: 0,
      alpine_lake: 0,
      mist_bayou: 0,
      coral_sea: 0,
      storm_ocean: 0
    },
    gears: 0,
    lifetimeGears: 0,
    unlockedSkins: ['sea_glass_guardian'],
    unlockedBlasterFx: ['tidal_pearl'],
    collectedRelics: [],
    collectedCurios: [],
    unlockedTrophies: [],
    playedMiniGames: [],
    seenCutscenes: [],
    towerStars: {
      campaign: {},
      purist: {}
    },
    dailyRecords: {},
    bestEndlessDepth: 0,
    bestFloodMeters: 0,
    bestExpeditionDepth: 0,
    puristClears: 0,
    casualExpeditionsCleared: 0,
    bestCasualDepth: 0,
    vaultsCracked: 0
  };
}

function getBrowserStorage() {
  try {
    if (typeof window !== 'undefined' && window.localStorage && typeof window.localStorage.getItem === 'function') {
      return window.localStorage;
    }
  } catch (_) {}
  return null;
}

function safeReadStorage(key) {
  try {
    const ls = getBrowserStorage();
    if (ls) return ls.getItem(key);
  } catch (_) {}
  return null;
}

function safeWriteStorage(key, value) {
  try {
    const ls = getBrowserStorage();
    if (ls) {
      ls.setItem(key, value);
      return true;
    }
  } catch (_) {}
  return false;
}

export function rollMutationChoices(ownedIds = [], seed = Date.now(), count = 3) {
  const ownedSet = new Set(Array.isArray(ownedIds) ? ownedIds : []);
  const available = BIO_MUTATIONS.filter((m) => !ownedSet.has(m.id));
  const pool = available.length >= count ? [...available] : [...BIO_MUTATIONS];
  let s = (Number(seed) || 1) >>> 0;
  const nextRand = () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(nextRand() * (i + 1));
    const tmp = pool[i];
    pool[i] = pool[j];
    pool[j] = tmp;
  }
  return pool.slice(0, Math.min(count, pool.length)).map((m) => ({ ...m }));
}

export class ProgressionManager {
  constructor(storageKey = 'towering_waters_save_v1') {
    this.storageKey = storageKey;
    this.state = createFreshState();
    this._pendingAutoTrophies = [];
    this._armedFlawlessSector = false;
    this._load();
  }

  _load() {
    const raw = safeReadStorage(this.storageKey);
    if (!raw) return;

    try {
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') return;

      const fresh = createFreshState();

      if (Array.isArray(parsed.unlockedSkins)) {
        const set = new Set(['sea_glass_guardian']);
        for (const id of parsed.unlockedSkins) {
          const mapped = resolveSkinId(id);
          if (SKIN_BY_ID.has(mapped)) set.add(mapped);
        }
        fresh.unlockedSkins = Array.from(set);
      }

      if (Array.isArray(parsed.unlockedBlasterFx)) {
        const bSet = new Set(['tidal_pearl']);
        for (const id of parsed.unlockedBlasterFx) {
          const mapped = resolveFxId(id);
          if (FX_BY_ID.has(mapped)) bSet.add(mapped);
        }
        fresh.unlockedBlasterFx = Array.from(bSet);
      }

      if (Array.isArray(parsed.collectedRelics)) {
        const rSet = new Set();
        for (const id of parsed.collectedRelics) {
          if (LOG_BY_ID.has(id)) rSet.add(id);
        }
        fresh.collectedRelics = Array.from(rSet);
      }

      if (Array.isArray(parsed.collectedCurios)) {
        const cSet = new Set();
        for (const id of parsed.collectedCurios) {
          if (CURIO_BY_ID.has(id)) cSet.add(id);
        }
        fresh.collectedCurios = Array.from(cSet);
      }

      if (Array.isArray(parsed.unlockedTrophies)) {
        const tSet = new Set();
        for (const id of parsed.unlockedTrophies) {
          if (TROPHY_BY_ID.has(id)) tSet.add(id);
        }
        fresh.unlockedTrophies = Array.from(tSet);
      }

      if (Array.isArray(parsed.playedMiniGames)) {
        const mSet = new Set();
        for (const m of parsed.playedMiniGames) {
          const resolved = resolveMiniGameId(m);
          if (resolved) mSet.add(resolved);
        }
        fresh.playedMiniGames = Array.from(mSet);
      }

      if (Array.isArray(parsed.seenCutscenes)) {
        fresh.seenCutscenes = parsed.seenCutscenes.filter((s) => typeof s === 'string');
      }

      if (parsed.watershedHealth && typeof parsed.watershedHealth === 'object') {
        for (const key of BIOME_KEYS) {
          const v = Number(parsed.watershedHealth[key]);
          if (Number.isFinite(v) && v >= 0) {
            fresh.watershedHealth[key] = Math.max(0, Math.min(100, Math.round(v)));
          }
        }
      }

      if (parsed.settings && typeof parsed.settings === 'object') {
        fresh.settings = this._sanitizeSettings(
          { ...fresh.settings, ...parsed.settings },
          fresh.unlockedSkins,
          fresh.unlockedBlasterFx
        );
      }

      if (parsed.highScores && typeof parsed.highScores === 'object') {
        for (const [k, rawVal] of Object.entries(parsed.highScores)) {
          const bucket = resolveBucket(k);
          const val = Number(rawVal);
          if (Number.isFinite(val) && val > (fresh.highScores[bucket] || 0)) {
            fresh.highScores[bucket] = Math.floor(val);
          }
        }
      }

      if (Number.isFinite(Number(parsed.gears)) && Number(parsed.gears) >= 0) {
        fresh.gears = Math.floor(Number(parsed.gears));
      }
      if (Number.isFinite(Number(parsed.lifetimeGears)) && Number(parsed.lifetimeGears) >= 0) {
        fresh.lifetimeGears = Math.max(fresh.gears, Math.floor(Number(parsed.lifetimeGears)));
      } else {
        fresh.lifetimeGears = fresh.gears;
      }

      if (parsed.towerStars && typeof parsed.towerStars === 'object') {
        for (const [rawMode, src] of Object.entries(parsed.towerStars)) {
          const targetKey = rawMode === 'purist' ? 'purist' : 'campaign';
          if (src && typeof src === 'object') {
            for (const [k, v] of Object.entries(src)) {
              if (v && typeof v === 'object') {
                fresh.towerStars[targetKey][String(k)] = normalizeStarRecord(v);
              }
            }
          }
        }
      }

      if (parsed.dailyRecords && typeof parsed.dailyRecords === 'object') {
        for (const [dateKey, rec] of Object.entries(parsed.dailyRecords)) {
          if (rec && typeof rec === 'object') {
            fresh.dailyRecords[dateKey] = {
              played: Boolean(rec.played),
              completed: Boolean(rec.completed),
              bestScore: Math.max(0, Math.floor(Number(rec.bestScore) || 0)),
              bestTimeSec:
                rec.bestTimeSec !== null && rec.bestTimeSec !== undefined && Number.isFinite(Number(rec.bestTimeSec))
                  ? Number(rec.bestTimeSec)
                  : null,
              bestAltitudePct: Math.max(0, Math.min(100, Math.round(Number(rec.bestAltitudePct) || 0)))
            };
          }
        }
      }

      for (const field of [
        'bestEndlessDepth',
        'bestFloodMeters',
        'bestExpeditionDepth',
        'puristClears',
        'casualExpeditionsCleared',
        'bestCasualDepth',
        'vaultsCracked'
      ]) {
        if (Number.isFinite(Number(parsed[field])) && Number(parsed[field]) > 0) {
          fresh[field] = Math.floor(Number(parsed[field]));
        }
      }

      this.state = fresh;
      this._syncWatershedFromStarsNoSave();
      this._syncBlasterFxMilestonesNoSave();
      if (!this.isBlasterFxUnlocked(this.state.settings.blasterFxId)) {
        this.state.settings.blasterFxId = 'tidal_pearl';
      }
    } catch (_) {
      this.state = createFreshState();
    }
  }

  _save() {
    safeWriteStorage(this.storageKey, JSON.stringify(this.state));
  }

  _sanitizeSettings(
    candidate,
    unlockedSkins = this.state?.unlockedSkins,
    unlockedBlasterFx = this.state?.unlockedBlasterFx
  ) {
    const skins = Array.isArray(unlockedSkins) ? unlockedSkins : ['sea_glass_guardian'];
    const blasters = Array.isArray(unlockedBlasterFx) ? unlockedBlasterFx : ['tidal_pearl'];
    const controlMode = VALID_CONTROLS.has(candidate.controlMode)
      ? candidate.controlMode
      : DEFAULT_SETTINGS.controlMode;
    const tiltRaw = Number(candidate.tiltSensitivity);
    const tiltSensitivity = Number.isFinite(tiltRaw)
      ? Math.max(0.5, Math.min(2.0, tiltRaw))
      : DEFAULT_SETTINGS.tiltSensitivity;

    const clampVol = (v, fb) => {
      const n = Number(v);
      return Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : fb;
    };

    const reqSkin = resolveSkinId(candidate.skinId);
    const skinId = skins.includes(reqSkin) ? reqSkin : 'sea_glass_guardian';

    const reqFx = resolveFxId(candidate.blasterFxId);
    const blasterFxId =
      blasters.includes(reqFx) || reqFx === 'tidal_pearl' ? reqFx : 'tidal_pearl';

    return {
      controlMode,
      zenMode: Boolean(candidate.zenMode),
      muted: Boolean(candidate.muted),
      musicEnabled: candidate.musicEnabled !== undefined ? Boolean(candidate.musicEnabled) : true,
      musicVolume: clampVol(candidate.musicVolume, DEFAULT_SETTINGS.musicVolume),
      ambienceVolume: clampVol(candidate.ambienceVolume, DEFAULT_SETTINGS.ambienceVolume),
      sfxVolume: clampVol(candidate.sfxVolume, DEFAULT_SETTINGS.sfxVolume),
      hapticsEnabled: candidate.hapticsEnabled !== undefined ? Boolean(candidate.hapticsEnabled) : true,
      tiltSensitivity,
      skinId,
      blasterFxId
    };
  }

  getSettings() {
    return { ...this.state.settings };
  }

  updateSettings(partialSettings = {}) {
    if (!partialSettings || typeof partialSettings !== 'object') {
      return this.getSettings();
    }
    this._syncBlasterFxMilestonesNoSave();
    this.state.settings = this._sanitizeSettings({
      ...this.state.settings,
      ...partialSettings
    });
    this._save();
    return this.getSettings();
  }

  // ================= WATERSHED RESTORATION & CUTSCENES =================

  _syncWatershedFromStarsNoSave() {
    const camp = this.state.towerStars.campaign || {};
    for (const b of WATERSHED_BIOMES) {
      const [s1, s2] = b.spireIds;
      const c1 = Boolean(camp[String(s1)]?.clear);
      const c2 = Boolean(camp[String(s2)]?.clear);
      let computed = 0;
      if (c1 && c2) computed = 100;
      else if (c1 || c2) computed = 50;
      if (computed > (this.state.watershedHealth[b.key] || 0)) {
        this.state.watershedHealth[b.key] = computed;
      }
    }
  }

  getWatershedHealth(biomeOrAct = null) {
    this._syncWatershedFromStarsNoSave();
    if (biomeOrAct === null || biomeOrAct === undefined) {
      const overall = this.getOverallWatershedHealth();
      return {
        ...this.state.watershedHealth,
        overall,
        global: overall
      };
    }
    if (typeof biomeOrAct === 'number') {
      if (biomeOrAct >= 0 && biomeOrAct < WATERSHED_BIOMES.length) {
        return this.state.watershedHealth[WATERSHED_BIOMES[biomeOrAct].key] || 0;
      }
      const found = WATERSHED_BIOMES.find((b) => b.act === biomeOrAct || b.id === biomeOrAct);
      return found ? this.state.watershedHealth[found.key] || 0 : 0;
    }
    const key = String(biomeOrAct);
    if (key in this.state.watershedHealth) {
      return this.state.watershedHealth[key] || 0;
    }
    const byAct = WATERSHED_BIOMES.find((b) => `act_${b.act}` === key || `sector_${b.act}` === key);
    return byAct ? this.state.watershedHealth[byAct.key] || 0 : 0;
  }

  getOverallWatershedHealth() {
    let total = 0;
    for (const k of BIOME_KEYS) {
      total += this.state.watershedHealth[k] || 0;
    }
    return Math.round(total / BIOME_KEYS.length);
  }

  setWatershedHealth(biomeKey, pct) {
    if (!(biomeKey in this.state.watershedHealth)) return 0;
    const clamped = Math.max(0, Math.min(100, Math.round(Number(pct) || 0)));
    if (clamped > this.state.watershedHealth[biomeKey]) {
      this.state.watershedHealth[biomeKey] = clamped;
      this._save();
    }
    return this.state.watershedHealth[biomeKey];
  }

  hasSeenCutscene(cutsceneId) {
    return this.state.seenCutscenes.includes(String(cutsceneId || ''));
  }

  markCutsceneSeen(cutsceneId) {
    const key = String(cutsceneId || '');
    if (!key) return;
    if (!this.state.seenCutscenes.includes(key)) {
      this.state.seenCutscenes.push(key);
      this._save();
    }
  }

  // ================= HIGH SCORES & HYDRO-GEARS =================

  getHighScore(bucket = 'campaign') {
    const key = resolveBucket(bucket);
    return this.state.highScores[key] || 0;
  }

  getModeHighScore(mode = 'campaign') {
    return this.getHighScore(mode);
  }

  recordScore(bucket, score) {
    const key = resolveBucket(bucket);
    const clean = Math.max(0, Math.floor(Number(score) || 0));
    if (clean >= 5000) {
      const t = this._unlockTrophyNoSave('classic_extra_life');
      if (t) this._pendingAutoTrophies.push(t);
    }
    if (clean > (this.state.highScores[key] || 0)) {
      this.state.highScores[key] = clean;
      this._save();
    }
    return this.state.highScores[key];
  }

  getGears() {
    return this.state.gears;
  }

  addGears(amount) {
    const delta = Math.floor(Number(amount) || 0);
    if (delta > 0) {
      this.state.gears += delta;
      this.state.lifetimeGears = Math.max(this.state.gears, (this.state.lifetimeGears || 0) + delta);
      const t1 = this._unlockTrophyNoSave('first_gear');
      if (t1) this._pendingAutoTrophies.push(t1);
      this._save();
    }
    return this.state.gears;
  }

  spendGears(amount) {
    const cost = Math.max(0, Math.floor(Number(amount) || 0));
    if (this.state.gears < cost) return false;
    if (cost > 0) {
      this.state.gears -= cost;
      this._save();
    }
    return true;
  }

  // ================= GATEWAY SKINS (8) =================

  isSkinUnlocked(skinId) {
    const mapped = resolveSkinId(skinId);
    if (mapped === 'sea_glass_guardian') return true;
    return this.state.unlockedSkins.includes(mapped);
  }

  unlockSkin(skinId, useGears = false) {
    const mapped = resolveSkinId(skinId);
    const skin = SKIN_BY_ID.get(mapped);
    if (!skin || (skinId !== mapped && !LEGACY_SKIN_ALIAS[skinId])) {
      return { unlocked: false, reason: 'invalid_skin' };
    }
    if (this.isSkinUnlocked(mapped)) {
      return { unlocked: true, reason: 'already_unlocked', newlyUnlockedTrophies: [] };
    }
    if (useGears) {
      const cost = Math.max(0, skin.gearCost || 0);
      if (this.state.gears < cost) {
        return { unlocked: false, reason: 'insufficient_gears' };
      }
      this.state.gears -= cost;
    }
    this.state.unlockedSkins.push(mapped);

    const newlyUnlockedTrophies = [];
    if (this.state.unlockedSkins.length >= 2) {
      const t = this._unlockTrophyNoSave('first_skin');
      if (t) newlyUnlockedTrophies.push(t);
    }
    if (this.state.unlockedSkins.length >= SKIN_CATALOG.length) {
      const t = this._unlockTrophyNoSave('wardrobe_complete');
      if (t) newlyUnlockedTrophies.push(t);
    }
    for (const extra of this.drainPendingTrophies()) {
      newlyUnlockedTrophies.push(extra);
    }

    this._save();
    return { unlocked: true, newlyUnlockedTrophies };
  }

  equipSkin(skinId) {
    const mapped = resolveSkinId(skinId);
    if (!SKIN_BY_ID.has(mapped) || !this.isSkinUnlocked(mapped)) {
      return false;
    }
    this.state.settings.skinId = mapped;
    this._save();
    return true;
  }

  getEquippedSkin() {
    const active = resolveSkinId(this.state.settings.skinId);
    return this.isSkinUnlocked(active) ? active : 'sea_glass_guardian';
  }

  // ================= HYDRO-PULSE FX UNLOCKABLES (6) =================

  _syncBlasterFxMilestonesNoSave() {
    const pts = this.getTrophyPoints();
    let added = false;
    for (const fx of HYDRO_FX_CATALOG) {
      if (pts >= (fx.trophyPointsReq || 0) && !this.state.unlockedBlasterFx.includes(fx.id)) {
        this.state.unlockedBlasterFx.push(fx.id);
        added = true;
      }
    }
    if (added) {
      if (this.state.unlockedBlasterFx.length >= 2) {
        const t = this._unlockTrophyNoSave('first_skin');
        if (t) this._pendingAutoTrophies.push(t);
      }
      if (this.state.unlockedBlasterFx.length >= HYDRO_FX_CATALOG.length) {
        const t = this._unlockTrophyNoSave('arsenal_complete');
        if (t) this._pendingAutoTrophies.push(t);
      }
    }
    return added;
  }

  isBlasterFxUnlocked(fxId) {
    const mapped = resolveFxId(fxId);
    if (mapped === 'tidal_pearl') return true;
    const fx = FX_BY_ID.get(mapped);
    if (!fx) return false;
    if (this.state.unlockedBlasterFx.includes(mapped)) return true;
    if (this.getTrophyPoints() >= (fx.trophyPointsReq || 0)) {
      this.state.unlockedBlasterFx.push(mapped);
      return true;
    }
    return false;
  }

  unlockBlasterFx(fxId, useGears = false) {
    const mapped = resolveFxId(fxId);
    const fx = FX_BY_ID.get(mapped);
    if (!fx || (fxId !== mapped && !LEGACY_FX_ALIAS[fxId])) {
      return { unlocked: false, reason: 'invalid_blaster_fx' };
    }
    if (this.isBlasterFxUnlocked(mapped)) {
      return { unlocked: true, reason: 'already_unlocked', newlyUnlockedTrophies: [] };
    }
    if (useGears) {
      const cost = Math.max(0, fx.gearCost || 0);
      if (this.state.gears < cost) {
        return { unlocked: false, reason: 'insufficient_gears' };
      }
      this.state.gears -= cost;
    }
    this.state.unlockedBlasterFx.push(mapped);

    const newlyUnlockedTrophies = [];
    if (this.state.unlockedBlasterFx.length >= 2) {
      const t = this._unlockTrophyNoSave('first_skin');
      if (t) newlyUnlockedTrophies.push(t);
    }
    if (this.state.unlockedBlasterFx.length >= HYDRO_FX_CATALOG.length) {
      const t = this._unlockTrophyNoSave('arsenal_complete');
      if (t) newlyUnlockedTrophies.push(t);
    }
    for (const extra of this.drainPendingTrophies()) {
      newlyUnlockedTrophies.push(extra);
    }

    this._save();
    return { unlocked: true, newlyUnlockedTrophies };
  }

  equipBlasterFx(fxId) {
    const mapped = resolveFxId(fxId);
    if (!FX_BY_ID.has(mapped) || !this.isBlasterFxUnlocked(mapped)) {
      return false;
    }
    this.state.settings.blasterFxId = mapped;
    this._save();
    return true;
  }

  getEquippedBlasterFx() {
    const active = resolveFxId(this.state.settings.blasterFxId);
    return this.isBlasterFxUnlocked(active) ? active : 'tidal_pearl';
  }

  getBlasterFxDef(fxId = this.getEquippedBlasterFx()) {
    return FX_BY_ID.get(resolveFxId(fxId)) || HYDRO_FX_CATALOG[0];
  }

  // ================= WATERSHED FIELD LOG CODEX (10 TABLETS) =================

  collectRelic(relicId) {
    let resolvedId = typeof relicId === 'number' ? `relic_t${relicId}` : String(relicId || '');
    const logMatch = /^log_s(\d+)$/i.exec(resolvedId);
    if (logMatch) resolvedId = `relic_t${logMatch[1]}`;
    const def = LOG_BY_ID.get(resolvedId);
    if (!def) return null;

    const firstTime = !this.state.collectedRelics.includes(resolvedId);
    const newlyUnlockedTrophies = [];

    if (firstTime) {
      this.state.collectedRelics.push(resolvedId);
      const count = this.state.collectedRelics.length;
      if (count >= 1) {
        const t = this._unlockTrophyNoSave('relic_finder_1');
        if (t) newlyUnlockedTrophies.push(t);
      }
      if (count >= 5) {
        const t = this._unlockTrophyNoSave('relic_hunter_4');
        if (t) newlyUnlockedTrophies.push(t);
      }
      if (count >= WATERSHED_LOGS.length) {
        const t = this._unlockTrophyNoSave('chronicler_five_seas');
        if (t) newlyUnlockedTrophies.push(t);
      }
      for (const extra of this.drainPendingTrophies()) {
        newlyUnlockedTrophies.push(extra);
      }
      this._save();
    }

    return {
      collected: true,
      firstTime,
      relic: { ...def },
      newlyUnlockedTrophies
    };
  }

  isRelicCollected(relicId) {
    let resolvedId = typeof relicId === 'number' ? `relic_t${relicId}` : String(relicId || '');
    const logMatch = /^log_s(\d+)$/i.exec(resolvedId);
    if (logMatch) resolvedId = `relic_t${logMatch[1]}`;
    return this.state.collectedRelics.includes(resolvedId);
  }

  getCollectedRelics() {
    return [...this.state.collectedRelics];
  }

  getRelicCount() {
    return this.state.collectedRelics.length;
  }

  // ================= NATURALIST CURIOS & BLUEPRINTS (12) =================

  collectCurio(curioId = null) {
    let resolvedId = curioId ? String(curioId) : '';
    if (!CURIO_BY_ID.has(resolvedId)) {
      const nextUnowned = CURIO_CATALOG.find((c) => !this.state.collectedCurios.includes(c.id));
      resolvedId = nextUnowned ? nextUnowned.id : CURIO_CATALOG[0].id;
    }
    const def = CURIO_BY_ID.get(resolvedId);
    if (!def) return null;

    const firstTime = !this.state.collectedCurios.includes(resolvedId);
    const newlyUnlockedTrophies = [];

    if (firstTime) {
      this.state.collectedCurios.push(resolvedId);
      const bonus = Math.max(0, def.gearBonus || 5);
      if (bonus > 0) {
        this.state.gears += bonus;
        this.state.lifetimeGears = Math.max(this.state.gears, (this.state.lifetimeGears || 0) + bonus);
        const tg = this._unlockTrophyNoSave('first_gear');
        if (tg) newlyUnlockedTrophies.push(tg);
      }
      const count = this.state.collectedCurios.length;
      if (count >= 4) {
        const t = this._unlockTrophyNoSave('curio_collector_4');
        if (t) newlyUnlockedTrophies.push(t);
      }
      if (count >= CURIO_CATALOG.length) {
        const t = this._unlockTrophyNoSave('curio_archivist_12');
        if (t) newlyUnlockedTrophies.push(t);
      }
      for (const extra of this.drainPendingTrophies()) {
        newlyUnlockedTrophies.push(extra);
      }
      this._save();
    }

    return {
      collected: true,
      firstTime,
      curio: { ...def },
      newlyUnlockedTrophies
    };
  }

  isCurioCollected(curioId) {
    return this.state.collectedCurios.includes(String(curioId || ''));
  }

  getCollectedCurios() {
    return [...this.state.collectedCurios];
  }

  getCurioCount() {
    return this.state.collectedCurios.length;
  }

  // ================= SANCTUM TRIALS, EXPEDITION & FLOOD RUSH =================

  recordCasualExpedition({
    towersCleared = 1,
    depth = null,
    missionType = null,
    craftedDynamo = false,
    dynamoCrafted = false,
    chestOpened = false,
    score = 0
  } = {}) {
    const didCraft = Boolean(craftedDynamo || dynamoCrafted);
    const newlyUnlockedTrophies = [];
    const grant = (id) => {
      const t = this._unlockTrophyNoSave(id);
      if (t) newlyUnlockedTrophies.push(t);
    };

    const inc = Math.max(1, Math.floor(Number(towersCleared) || 1));
    this.state.casualExpeditionsCleared = (this.state.casualExpeditionsCleared || 0) + inc;
    const curDepth = depth !== null ? Math.floor(Number(depth) || 1) : inc;
    if (curDepth > (this.state.bestCasualDepth || 0)) {
      this.state.bestCasualDepth = curDepth;
    }

    this.state.gears += 6;
    this.state.lifetimeGears = Math.max(this.state.gears, (this.state.lifetimeGears || 0) + 6);
    grant('first_gear');
    grant('casual_explorer');
    grant('zen_voyager');

    if (didCraft || missionType === 'tower_repair') {
      if (didCraft) grant('tinker_apprentice');
      const bp = this.collectCurio('blueprint_beacon_dynamo');
      if (bp?.newlyUnlockedTrophies?.length) newlyUnlockedTrophies.push(...bp.newlyUnlockedTrophies);
    }
    if (chestOpened) {
      grant('chest_plunderer');
    }

    if (this.state.casualExpeditionsCleared >= 2) {
      const bp = this.collectCurio('blueprint_mk7_thruster');
      if (bp?.newlyUnlockedTrophies?.length) newlyUnlockedTrophies.push(...bp.newlyUnlockedTrophies);
    }
    if (this.state.casualExpeditionsCleared >= 4) {
      const bp = this.collectCurio('blueprint_skywing_rib');
      if (bp?.newlyUnlockedTrophies?.length) newlyUnlockedTrophies.push(...bp.newlyUnlockedTrophies);
    }
    if (this.state.casualExpeditionsCleared >= 6) {
      const bp = this.collectCurio('blueprint_cryo_condenser');
      if (bp?.newlyUnlockedTrophies?.length) newlyUnlockedTrophies.push(...bp.newlyUnlockedTrophies);
    }

    const cleanScore = Math.max(0, Math.floor(Number(score) || 0));
    if (cleanScore > (this.state.highScores.sanctum_trials || 0)) {
      this.state.highScores.sanctum_trials = cleanScore;
    }

    for (const extra of this.drainPendingTrophies()) {
      newlyUnlockedTrophies.push(extra);
    }
    this._save();

    return {
      totalCleared: this.state.casualExpeditionsCleared,
      bestDepth: this.state.bestCasualDepth,
      newlyUnlockedTrophies
    };
  }

  getCasualStats() {
    return {
      totalCleared: this.state.casualExpeditionsCleared || 0,
      bestDepth: this.state.bestCasualDepth || 0,
      curiosCollected: this.state.collectedCurios.length
    };
  }

  recordExpeditionRun({ spiresCleared = 0, mutations = [], score = 0 } = {}) {
    const depth = Math.max(0, Math.floor(Number(spiresCleared) || 0));
    const cleanScore = Math.max(0, Math.floor(Number(score) || 0));
    if (depth > (this.state.bestExpeditionDepth || 0)) {
      this.state.bestExpeditionDepth = depth;
    }
    if (cleanScore > (this.state.highScores.expedition || 0)) {
      this.state.highScores.expedition = cleanScore;
    }
    if (Array.isArray(mutations) && mutations.length > 0) {
      const t = this._unlockTrophyNoSave('expedition_first');
      if (t) this._pendingAutoTrophies.push(t);
    }
    if (depth >= 3) {
      const t = this._unlockTrophyNoSave('endless_3');
      if (t) this._pendingAutoTrophies.push(t);
    }
    if (depth >= 5) {
      const t = this._unlockTrophyNoSave('endless_5');
      if (t) this._pendingAutoTrophies.push(t);
    }
    if (depth >= 10) {
      const t = this._unlockTrophyNoSave('abyssal_titan');
      if (t) this._pendingAutoTrophies.push(t);
    }
    this._save();
    return this.state.bestExpeditionDepth;
  }

  getBestExpeditionDepth() {
    return this.state.bestExpeditionDepth || 0;
  }

  recordFloodRushRun({ spiresCleared = 0, metersClimbed = 0, score = 0 } = {}) {
    const depth = Math.max(0, Math.floor(Number(spiresCleared) || 0));
    const meters = Math.max(0, Math.floor(Number(metersClimbed) || 0));
    const cleanScore = Math.max(0, Math.floor(Number(score) || 0));
    if (depth > (this.state.bestEndlessDepth || 0)) {
      this.state.bestEndlessDepth = depth;
    }
    if (meters > (this.state.bestFloodMeters || 0)) {
      this.state.bestFloodMeters = meters;
    }
    if (cleanScore > (this.state.highScores.flood_rush || 0)) {
      this.state.highScores.flood_rush = cleanScore;
    }
    if (depth >= 1) {
      const t = this._unlockTrophyNoSave('flood_rush_first');
      if (t) this._pendingAutoTrophies.push(t);
    }
    if (depth >= 3) {
      const t = this._unlockTrophyNoSave('endless_3');
      if (t) this._pendingAutoTrophies.push(t);
    }
    if (depth >= 5) {
      const t = this._unlockTrophyNoSave('endless_5');
      if (t) this._pendingAutoTrophies.push(t);
    }
    if (depth >= 10) {
      const t = this._unlockTrophyNoSave('abyssal_titan');
      if (t) this._pendingAutoTrophies.push(t);
    }
    this._save();
    return { bestDepth: this.state.bestEndlessDepth, bestMeters: this.state.bestFloodMeters };
  }

  getBestFloodRush() {
    return {
      bestDepth: this.state.bestEndlessDepth || 0,
      bestMeters: this.state.bestFloodMeters || 0
    };
  }

  getBestFloodHeight() {
    return Math.round((this.state.bestFloodMeters || 0) / 1.5);
  }

  // ================= MINI-GAME & GAMEPLAY EVENT ENGINE =================

  recordMiniGamePlayed(mode) {
    const resolved = resolveMiniGameId(mode);
    if (!resolved) return null;
    if (!this.state.playedMiniGames.includes(resolved)) {
      this.state.playedMiniGames.push(resolved);
      if (this.state.playedMiniGames.length >= VALID_MINIGAMES.size) {
        const t = this._unlockTrophyNoSave('arcade_tourist');
        this._save();
        return t;
      }
      this._save();
    }
    return null;
  }

  recordGameplayEvent(type, payload = {}) {
    const unlockedNow = this.drainPendingTrophies();
    const grant = (id) => {
      const t = this._unlockTrophyNoSave(id);
      if (t) unlockedNow.push(t);
    };
    const markMini = (mode) => {
      const resolved = resolveMiniGameId(mode);
      if (resolved && !this.state.playedMiniGames.includes(resolved)) {
        this.state.playedMiniGames.push(resolved);
      }
      if (this.state.playedMiniGames.length >= VALID_MINIGAMES.size) {
        grant('arcade_tourist');
      }
    };

    switch (type) {
      case 'tower_start': {
        if (payload.zenMode || payload.runType === 'sanctum_trials') grant('zen_voyager');
        if (payload.runType === 'daily_tide' || payload.runType === 'daily') grant('daily_try');
        break;
      }

      case 'tail_whip':
        grant('tail_whip_first');
        break;

      case 'crab_springboard':
        grant('crab_flipper');
        break;

      case 'wall_scamper':
        grant('gecko_climber');
        break;

      case 'grapple_swing':
        grant('grapple_swinger');
        break;

      case 'floodgate_swim':
        grant('floodgate_swimmer');
        break;

      case 'mortar_deflect':
        grant('mortar_reflector');
        break;

      case 'warden_defeat':
        grant('warden_slayer');
        break;

      case 'mutation_draft':
        grant('expedition_first');
        break;

      case 'core_descent_complete':
        markMini('core_descent');
        grant('core_dive_novice');
        if (Number(payload.crystalsSmashed) >= 3) {
          grant('core_triple_smash');
        }
        break;

      case 'elevator_ride':
        grant('lift_rider');
        if (payload.recalled) grant('lift_caller');
        break;

      case 'elevator_recall':
      case 'lift_recall':
        grant('lift_caller');
        break;

      case 'door_enter':
        grant('tunnel_runner');
        if (payload.tunnelStyle === 'sparkArch') grant('spark_diver');
        break;

      case 'steam_launch':
        grant('steam_surfer');
        break;

      case 'snowball_fire':
      case 'hydro_fire':
        grant('first_snowball');
        if (payload.recalledLift) grant('lift_caller');
        break;

      case 'snowball_hit':
      case 'hydro_hit': {
        grant('first_snowball');
        if (payload.recalledLift) grant('lift_caller');
        const kind = payload.kind;
        if (kind === 'box') grant('box_breaker');
        else if (kind === 'roller' || kind === 'snap_crab') grant('roller_shatter');
        else if (kind === 'bouncer' || kind === 'gulp_hopper') grant('bouncer_freeze');
        else if (kind === 'robot' || kind === 'rail_skater' || kind === 'volt_eel') grant('sentinel_short');

        const combo = Number(payload.combo) || 0;
        if (combo >= 4) grant('snowball_sniper');
        if (combo >= 8 && payload.runType === 'purist') grant('purist_immortal');
        break;
      }

      case 'switch_trigger':
        if (payload.mode === 'drainValve' || payload.mode === 'pipeValve' || payload.mode === 'floodValve') {
          grant('drain_plumber');
          if (payload.poweredLift) grant('lift_caller');
        } else if (payload.mode === 'conveyorFlip') {
          grant('belt_flipper');
        }
        break;

      case 'shield_absorb':
        grant('shield_saver');
        break;

      case 'extra_life':
        grant('classic_extra_life');
        break;

      case 'workbench_craft': {
        grant('tinker_apprentice');
        const bp = this.collectCurio('blueprint_beacon_dynamo');
        if (bp?.newlyUnlockedTrophies?.length) unlockedNow.push(...bp.newlyUnlockedTrophies);
        break;
      }

      case 'chest_open':
      case 'treasure_open': {
        grant('chest_plunderer');
        const cr = this.collectCurio(payload.curioId || null);
        if (cr?.newlyUnlockedTrophies?.length) unlockedNow.push(...cr.newlyUnlockedTrophies);
        break;
      }

      case 'curio_collect': {
        const cr = this.collectCurio(payload.curioId || payload.id || null);
        if (cr?.newlyUnlockedTrophies?.length) unlockedNow.push(...cr.newlyUnlockedTrophies);
        break;
      }

      case 'casual_clear':
        grant('casual_explorer');
        grant('zen_voyager');
        break;

      case 'collectible':
        if (payload.type === 'gear') {
          grant('first_gear');
        } else if (payload.type === 'starCore') {
          grant('first_star_core');
        } else if (payload.type === 'relic' && payload.relicId) {
          const res = this.collectRelic(payload.relicId);
          if (res?.newlyUnlockedTrophies?.length) {
            unlockedNow.push(...res.newlyUnlockedTrophies);
          }
        } else if (payload.type === 'curio') {
          const res = this.collectCurio(payload.curioId || null);
          if (res?.newlyUnlockedTrophies?.length) {
            unlockedNow.push(...res.newlyUnlockedTrophies);
          }
        }
        break;

      case 'sub_complete':
      case 'reef_swim_complete':
        markMini('reef_swim');
        grant('sub_novice');
        if (Number(payload.minesDestroyed) >= 1) grant('sub_mine_sweeper');
        if (Number(payload.fishCaught) >= 10) grant('sub_ace');
        if (payload.warpEntered) grant('warp_finder');
        break;

      case 'skimmer_complete':
      case 'rapids_surf_complete':
        markMini('rapids_surf');
        grant('skimmer_novice');
        if (Number(payload.rampsUsed) >= 1) grant('skimmer_ramp_air');
        if (Number(payload.cratesDestroyed) >= 1) grant('skimmer_crate_buster');
        if (Number(payload.maxBoost) >= 4) grant('skimmer_pro');
        break;

      case 'glide_complete':
      case 'frill_glide_complete': {
        markMini('frill_glide');
        grant('glide_novice');
        if (Number(payload.thermalTime) > 0.15 || Number(payload.gatesPassed) >= 2) {
          grant('glide_thermal');
        }
        const aceGlide = Boolean(
          payload.goldCaught ||
          Number(payload.maxGateChain) >= 4 ||
          Number(payload.lanternsCaught) >= 4 ||
          payload.perfect
        );
        if (aceGlide) {
          grant('sky_rider');
        }
        break;
      }

      case 'puzzle_complete':
      case 'sanctum_complete':
        markMini('aqueduct_sanctum');
        if (payload.solved) {
          grant('rune_scholar');
          if (payload.puzzleType === 'lights') grant('rune_lights_clear');
          else if (payload.puzzleType === 'bells') grant('rune_bells_clear');
          else if (payload.puzzleType === 'beam') grant('rune_beam_clear');
          else if (payload.puzzleType === 'blocks') grant('rune_blocks_clear');
        }
        break;

      case 'vault_ring_lock':
        markMini('aqueduct_sanctum');
        grant('vault_novice');
        break;

      case 'vault_complete':
        markMini('aqueduct_sanctum');
        if (payload.won || Number(payload.ringsLocked) >= 1) {
          grant('vault_novice');
        }
        if (payload.won && Number(payload.strikes || 0) === 0) {
          grant('vault_cracker');
        }
        break;

      default:
        break;
    }

    for (const extra of this.drainPendingTrophies()) {
      unlockedNow.push(extra);
    }
    if (unlockedNow.length > 0) {
      this._save();
    }
    return unlockedNow;
  }

  // ================= HARMONIC SEEDS & 5-MEDAL SPIRE MASTERY =================

  getTowerStars(modeKey = 'campaign', towerId = 1) {
    if (typeof modeKey === 'number') {
      towerId = modeKey;
      modeKey = 'campaign';
    }
    const m = modeKey === 'purist' ? 'purist' : 'campaign';
    const rec = this.state.towerStars[m]?.[String(towerId)];
    return normalizeStarRecord(rec || {});
  }

  getTotalStars(modeKey = null) {
    const modes = modeKey === 'purist' ? ['purist'] : modeKey === 'campaign' || modeKey === 'reboot' ? ['campaign'] : ['campaign', 'purist'];
    let sum = 0;
    for (const m of modes) {
      const map = this.state.towerStars[m] || {};
      for (const rec of Object.values(map)) {
        if (rec) {
          sum += (rec.clear ? 1 : 0) + (rec.vault ? 1 : 0) + (rec.speed ? 1 : 0);
        }
      }
    }
    return sum;
  }

  getTotalMedals(modeKey = null) {
    const modes = modeKey === 'purist' ? ['purist'] : modeKey === 'campaign' || modeKey === 'reboot' ? ['campaign'] : ['campaign', 'purist'];
    let sum = 0;
    for (const m of modes) {
      const map = this.state.towerStars[m] || {};
      for (const rec of Object.values(map)) {
        if (rec) {
          sum += normalizeStarRecord(rec).medalsCount;
        }
      }
    }
    return sum;
  }

  _countClearedTowers(modeKey = 'campaign') {
    const map = this.state.towerStars[modeKey] || {};
    let cleared = 0;
    for (let id = 1; id <= 10; id++) {
      if (map[String(id)]?.clear) cleared++;
    }
    return cleared;
  }

  _countSpeedStars(onlyMode = null) {
    const modes = onlyMode ? [onlyMode] : ['campaign', 'purist'];
    let speedCount = 0;
    for (const m of modes) {
      const map = this.state.towerStars[m] || {};
      for (const rec of Object.values(map)) {
        if (rec?.speed) speedCount++;
      }
    }
    return speedCount;
  }

  _countVaultStars() {
    let vaultCount = 0;
    for (const m of ['campaign', 'purist']) {
      const map = this.state.towerStars[m] || {};
      for (const rec of Object.values(map)) {
        if (rec?.vault) vaultCount++;
      }
    }
    return Math.max(vaultCount, this.state.vaultsCracked || 0);
  }

  recordTowerClear(data = {}) {
    const runType = String(data.runType || 'campaign');
    const isSanctumTrials = Boolean(data.casual || runType === 'sanctum_trials' || runType === 'endless_casual');
    const isPurist = runType === 'purist';
    const starBucket = isPurist ? 'purist' : 'campaign';
    const towerId = Math.max(1, Math.floor(Number(data.towerId) || 1));

    const newlyUnlockedSkins = [];
    const newlyUnlockedTrophies = this.drainPendingTrophies();
    const tryUnlockMilestoneTrophy = (trophyId) => {
      const unlocked = this._unlockTrophyNoSave(trophyId);
      if (unlocked) newlyUnlockedTrophies.push(unlocked);
    };

    if (isSanctumTrials && data.clear) {
      tryUnlockMilestoneTrophy('first_purify');
      const expRes = this.recordCasualExpedition({
        towersCleared: 1,
        depth: towerId,
        missionType: data.missionType || data.casualMission || null,
        craftedDynamo: Boolean(data.craftedDynamo),
        chestOpened: Boolean(data.chestOpened),
        score: data.score || 0
      });
      if (expRes?.newlyUnlockedTrophies?.length) {
        newlyUnlockedTrophies.push(...expRes.newlyUnlockedTrophies);
      }
      const stars = normalizeStarRecord({
        clear: Boolean(data.clear),
        vault: Boolean(data.vault),
        speed: Boolean(data.speed),
        nohit: true,
        combo: Boolean(Number(data.maxCombo) >= 4)
      });
      this._save();
      return { stars, newlyUnlockedTrophies, newlyUnlockedSkins };
    }

    const isCampaignOrPurist =
      !data.runType ||
      runType === 'campaign' ||
      runType === 'reboot_campaign' ||
      runType === 'purist';

    const prev = isCampaignOrPurist ? this.getTowerStars(starBucket, towerId) : normalizeStarRecord({});
    const earnedNohit = Boolean(
      data.nohit || (data.clear && data.hurtCount !== undefined && Number(data.hurtCount) === 0)
    );
    const earnedCombo = Boolean(data.combo || Number(data.maxCombo) >= 4);

    const stars = normalizeStarRecord({
      clear: prev.clear || data.clear,
      vault: prev.vault || data.vault,
      speed: prev.speed || data.speed,
      nohit: prev.nohit || earnedNohit,
      combo: prev.combo || earnedCombo
    });

    if (data.vault) {
      this.state.vaultsCracked = (this.state.vaultsCracked || 0) + 1;
    }

    let watershedBefore = 0;
    let watershedAfter = 0;
    let biomeObj = null;

    if (isCampaignOrPurist && towerId >= 1 && towerId <= 10) {
      this.state.towerStars[starBucket][String(towerId)] = stars;
      if (!isPurist && data.clear) {
        biomeObj = WATERSHED_BIOMES.find((b) => b.spireIds.includes(towerId)) || null;
        if (biomeObj) {
          watershedBefore = this.state.watershedHealth[biomeObj.key] || 0;
          const [s1, s2] = biomeObj.spireIds;
          const c1 = Boolean(this.state.towerStars.campaign[String(s1)]?.clear);
          const c2 = Boolean(this.state.towerStars.campaign[String(s2)]?.clear);
          const nextPct = c1 && c2 ? 100 : 50;
          this.state.watershedHealth[biomeObj.key] = Math.max(watershedBefore, nextPct);
          watershedAfter = this.state.watershedHealth[biomeObj.key];
        }
      }
    }

    if (isPurist && data.clear) {
      this.state.puristClears = (this.state.puristClears || 0) + 1;
      tryUnlockMilestoneTrophy('purist_first');
      if (this.state.puristClears >= 5 || this._countClearedTowers('purist') >= 5) {
        tryUnlockMilestoneTrophy('purist_master');
      }
      if (Number(data.maxCombo) >= 8) {
        tryUnlockMilestoneTrophy('purist_immortal');
      }
    }

    const tryUnlockMilestoneSkin = (skinId) => {
      if (!this.isSkinUnlocked(skinId)) {
        this.state.unlockedSkins.push(skinId);
        newlyUnlockedSkins.push(skinId);
      }
    };

    const totalStars = this.getTotalStars(null);
    const campaignStars = this.getTotalStars('campaign');
    const campaignCleared = this._countClearedTowers('campaign');
    const vaultTotal = this._countVaultStars();

    if (this.state.watershedHealth.canyon_river >= 100) tryUnlockMilestoneSkin('canyon_rapids_ranger');
    if (this.state.watershedHealth.alpine_lake >= 100) tryUnlockMilestoneSkin('alpine_glacier_mystic');
    if (this.state.watershedHealth.mist_bayou >= 100) tryUnlockMilestoneSkin('bayou_biolume');
    if (this.state.watershedHealth.coral_sea >= 100) tryUnlockMilestoneSkin('solar_oasis');
    if (vaultTotal >= 5) tryUnlockMilestoneSkin('abyssal_leviathan');
    if (totalStars >= 20) tryUnlockMilestoneSkin('sovereign_starlight');

    if (newlyUnlockedSkins.length > 0) {
      if (this.state.unlockedSkins.length >= 2) tryUnlockMilestoneTrophy('first_skin');
      if (this.state.unlockedSkins.length >= SKIN_CATALOG.length) tryUnlockMilestoneTrophy('wardrobe_complete');
    }

    if (totalStars >= 1) {
      tryUnlockMilestoneTrophy('first_star_core');
    }

    if (data.clear) {
      tryUnlockMilestoneTrophy('first_purify');

      if (data.zenMode || this.state.settings.zenMode) {
        tryUnlockMilestoneTrophy('zen_voyager');
      }

      if (isCampaignOrPurist) {
        if (towerId === 1) tryUnlockMilestoneTrophy('mist_walker');
        else if (towerId >= 2 && towerId <= 8) tryUnlockMilestoneTrophy(`clear_reboot_t${towerId}`);
        else if (towerId === 9) tryUnlockMilestoneTrophy('clear_spire_9');
        else if (towerId === 10) tryUnlockMilestoneTrophy('clear_spire_10');

        if ((towerId === 1 || towerId === 2) && stars.speed) {
          tryUnlockMilestoneTrophy(`speed_reboot_t${towerId}`);
        }
        if (towerId === 6 && data.touchedWater === false) {
          tryUnlockMilestoneTrophy('tide_runner');
        }
        if (towerId === 4 && data.touchedWater === false) {
          tryUnlockMilestoneTrophy('wind_walker');
        }
        if (towerId === 5 && stars.vault) {
          tryUnlockMilestoneTrophy('switch_architect');
        }
        if (towerId === 8 && earnedNohit) {
          tryUnlockMilestoneTrophy('piston_dancer');
        }
        if (towerId === 9 && data.touchedWater === false) {
          tryUnlockMilestoneTrophy('blackout_beacon');
        }
        if ((towerId === 8 || towerId === 10) && stars.vault) {
          tryUnlockMilestoneTrophy('vault_t8_clear');
        }
        if (
          towerId % 2 === 0 &&
          earnedNohit &&
          Boolean(data.vault) &&
          Boolean(data.speed) &&
          Number(data.crystalsSmashed ?? 3) >= 3
        ) {
          tryUnlockMilestoneTrophy('flawless_sector');
        }
      }

      if (runType === 'daily_tide' || runType === 'daily') {
        tryUnlockMilestoneTrophy('daily_try');
        tryUnlockMilestoneTrophy('daily_climber');
        if (data.speed || (data.parTime && Number(data.timeRemaining) >= Number(data.parTime))) {
          tryUnlockMilestoneTrophy('daily_speed_ace');
        }
      }

      if (earnedNohit) {
        tryUnlockMilestoneTrophy('storm_ghost');
      }
      if (data.pacifist || (data.shotsFired !== undefined && Number(data.shotsFired) === 0)) {
        tryUnlockMilestoneTrophy('pacifist_climb');
      }
    }

    if (earnedCombo) tryUnlockMilestoneTrophy('snowball_sniper');

    for (const b of WATERSHED_BIOMES) {
      const a = this.getTowerStars('campaign', b.spireIds[0]);
      const c = this.getTowerStars('campaign', b.spireIds[1]);
      if (a.count === 3 && c.count === 3 && this.state.watershedHealth[b.key] >= 100) {
        tryUnlockMilestoneTrophy(`sector_${b.act}_master`);
      }
    }

    if (this._countSpeedStars() >= 3) {
      tryUnlockMilestoneTrophy('speed_demon');
    }
    if (this._countSpeedStars() >= 8) {
      tryUnlockMilestoneTrophy('chrono_olympian');
    }
    if (campaignCleared >= 10) {
      tryUnlockMilestoneTrophy('watershed_envoy');
    }
    if (campaignStars >= 30 && this.getOverallWatershedHealth() >= 100) {
      tryUnlockMilestoneTrophy('watershed_sovereign');
    }

    for (const extra of this.drainPendingTrophies()) {
      newlyUnlockedTrophies.push(extra);
    }

    this._save();
    return {
      stars: { ...stars },
      watershedBefore,
      watershedAfter,
      biome: biomeObj ? { ...biomeObj } : null,
      overallWatershedHealth: this.getOverallWatershedHealth(),
      newlyUnlockedTrophies,
      newlyUnlockedSkins
    };
  }

  // ================= DAILY TIDE & ENDLESS RECORDS =================

  recordDailyResult({ dateKey, score = 0, clearTimeSec = null, completed = false, altitudePct = 0 } = {}) {
    if (!dateKey) return null;
    const key = String(dateKey);
    const prev = this.getDailyRecord(key);
    const cleanScore = Math.max(0, Math.floor(Number(score) || 0));
    const cleanAlt = Math.max(0, Math.min(100, Math.round(Number(altitudePct) || 0)));

    let bestTimeSec = prev.bestTimeSec;
    if (completed && clearTimeSec !== null && clearTimeSec !== undefined && Number.isFinite(Number(clearTimeSec))) {
      const t = Math.max(0, Number(clearTimeSec));
      bestTimeSec = bestTimeSec === null ? t : Math.min(bestTimeSec, t);
    }

    const next = {
      played: true,
      completed: Boolean(prev.completed || completed),
      bestScore: Math.max(prev.bestScore, cleanScore),
      bestTimeSec,
      bestAltitudePct: Math.max(prev.bestAltitudePct || 0, completed ? 100 : cleanAlt)
    };

    this.state.dailyRecords[key] = next;
    if (cleanScore > (this.state.highScores.daily_tide || 0)) {
      this.state.highScores.daily_tide = cleanScore;
    }
    const tTry = this._unlockTrophyNoSave('daily_try');
    if (tTry) this._pendingAutoTrophies.push(tTry);
    if (completed) {
      const tClear = this._unlockTrophyNoSave('daily_climber');
      if (tClear) this._pendingAutoTrophies.push(tClear);
    }
    this._save();
    return { ...next };
  }

  getDailyRecord(dateKey) {
    const rec = this.state.dailyRecords[String(dateKey)];
    if (!rec) {
      return {
        played: false,
        completed: false,
        bestScore: 0,
        bestTimeSec: null,
        bestAltitudePct: 0
      };
    }
    return { ...rec };
  }

  recordEndlessRun(towersCleared = 0, score = 0) {
    const depth = Math.max(0, Math.floor(Number(towersCleared) || 0));
    const cleanScore = Math.max(0, Math.floor(Number(score) || 0));
    if (depth > this.state.bestEndlessDepth) {
      this.state.bestEndlessDepth = depth;
    }
    if (cleanScore > (this.state.highScores.flood_rush || 0)) {
      this.state.highScores.flood_rush = cleanScore;
    }
    const pushIf = (cond, id) => {
      if (!cond) return;
      const t = this._unlockTrophyNoSave(id);
      if (t) this._pendingAutoTrophies.push(t);
    };
    pushIf(depth >= 1, 'flood_rush_first');
    pushIf(depth >= 3, 'endless_3');
    pushIf(depth >= 5, 'endless_5');
    pushIf(depth >= 10, 'abyssal_titan');
    this._save();
    return this.state.bestEndlessDepth;
  }

  getBestEndlessDepth() {
    return this.state.bestEndlessDepth || 0;
  }

  // ================= 100 TROPHIES & 1,000-POINT ENGINE =================

  getTrophyPoints() {
    let pts = 0;
    for (const id of this.state.unlockedTrophies) {
      const def = TROPHY_BY_ID.get(id);
      if (def) pts += def.points || 0;
    }
    return pts;
  }

  getMaxTrophyPoints() {
    return 1000;
  }

  getTrophyBreakdown() {
    const tiers = {
      aluminum: { unlocked: 0, total: TIER_META.aluminum.total, points: 0, maxPoints: TIER_META.aluminum.maxPoints, pointsEach: 5 },
      copper: { unlocked: 0, total: TIER_META.copper.total, points: 0, maxPoints: TIER_META.copper.maxPoints, pointsEach: 10 },
      platinum: { unlocked: 0, total: TIER_META.platinum.total, points: 0, maxPoints: TIER_META.platinum.maxPoints, pointsEach: 20 },
      diamond: { unlocked: 0, total: TIER_META.diamond.total, points: 0, maxPoints: TIER_META.diamond.maxPoints, pointsEach: 30 }
    };

    let totalUnlocked = 0;
    let totalPoints = 0;
    for (const id of this.state.unlockedTrophies) {
      const def = TROPHY_BY_ID.get(id);
      if (!def) continue;
      totalUnlocked++;
      totalPoints += def.points || 0;
      const bucket = tiers[def.tier];
      if (bucket) {
        bucket.unlocked++;
        bucket.points += def.points || 0;
      }
    }

    return {
      totalUnlocked,
      totalCount: TROPHIES.length,
      totalPoints,
      maxPoints: 1000,
      tiers,
      aluminum: { ...tiers.aluminum },
      copper: { ...tiers.copper },
      platinum: { ...tiers.platinum },
      diamond: { ...tiers.diamond }
    };
  }

  drainPendingTrophies() {
    if (!this._pendingAutoTrophies.length) return [];
    const out = [...this._pendingAutoTrophies];
    this._pendingAutoTrophies.length = 0;
    return out;
  }

  _unlockTrophyNoSave(trophyId) {
    const def = TROPHY_BY_ID.get(trophyId);
    if (!def) return null;
    if (this.state.unlockedTrophies.includes(trophyId)) return null;
    this.state.unlockedTrophies.push(trophyId);

    this._syncBlasterFxMilestonesNoSave();

    if (
      trophyId !== 'harmonic_millennium' &&
      this.state.unlockedTrophies.length === TROPHIES.length - 1 &&
      !this.state.unlockedTrophies.includes('harmonic_millennium')
    ) {
      const cap = TROPHY_BY_ID.get('harmonic_millennium');
      if (cap) {
        this.state.unlockedTrophies.push('harmonic_millennium');
        this._syncBlasterFxMilestonesNoSave();
        this._pendingAutoTrophies.push({ ...cap });
      }
    }

    return { ...def };
  }

  unlockTrophy(trophyId) {
    const unlocked = this._unlockTrophyNoSave(trophyId);
    if (unlocked) {
      this._save();
    }
    return unlocked;
  }

  isTrophyUnlocked(trophyId) {
    return this.state.unlockedTrophies.includes(trophyId);
  }

  getUnlockedTrophies() {
    return [...this.state.unlockedTrophies];
  }

  resetProgress() {
    const preservedSettings = {
      ...DEFAULT_SETTINGS,
      controlMode: this.state.settings.controlMode,
      muted: this.state.settings.muted,
      musicEnabled: this.state.settings.musicEnabled,
      musicVolume: this.state.settings.musicVolume,
      ambienceVolume: this.state.settings.ambienceVolume,
      sfxVolume: this.state.settings.sfxVolume,
      hapticsEnabled: this.state.settings.hapticsEnabled,
      tiltSensitivity: this.state.settings.tiltSensitivity,
      skinId: 'sea_glass_guardian',
      blasterFxId: 'tidal_pearl'
    };
    this.state = createFreshState();
    this.state.settings = preservedSettings;
    this._pendingAutoTrophies = [];
    this._armedFlawlessSector = false;
    this._save();
  }
}

export const progression = new ProgressionManager();
