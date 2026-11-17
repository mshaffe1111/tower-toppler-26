// Tower Toppler '26 — Persistent Progression, 100 Trophies (1,000 PTS), 8 Lore Relics,
// 12 Exploration Curios & Blueprints, 6 Cryo-Blaster FX Styles, 5-Medal Mastery & 8 Pogo Skins
// Pure leaf module (zero internal imports per ARCHITECTURE_CONTRACT.md §1)

const DEFAULT_SETTINGS = Object.freeze({
  era: 'reboot',                 // 'reboot' | 'original'
  controlMode: 'gesture',        // 'gesture' | 'joystick' | 'dpad' | 'tilt'
  zenMode: false,                // Casual Zen modifier
  muted: false,                  // Master audio mute
  musicEnabled: true,            // Music bus toggle
  hapticsEnabled: true,          // navigator.vibrate pulses
  tiltSensitivity: 1.0,          // 0.5 .. 2.0
  skinId: 'default_amphibian',   // active Pogo skin ID
  blasterFxId: 'standard_cryo'   // active Cryo-Blaster projectile/trail FX ID
});

export const SKIN_CATALOG = [
  {
    id: 'default_amphibian',
    name: 'Explorer Pogo',
    description: 'Standard Amphibious Corps field harness, canvas pack, and lime-emerald camo.',
    gearCost: 0,
    milestoneText: 'Unlocked by Default',
    previewColors: ['#56b847', '#d8e89b', '#7c5832']
  },
  {
    id: 'deep_diver',
    name: 'Abyssal Diver',
    description: 'Matte midnight-teal trench wetsuit with riveted MK.7 brass collar and cyan glow.',
    gearCost: 75,
    milestoneText: '75 Golden Gears',
    previewColors: ['#0f4c5c', '#5efce8', '#b45309']
  },
  {
    id: 'poison_dart',
    name: 'Cobalt Dart',
    description: 'Vivid cobalt-blue amphibian patterning crowned by a fiery tangerine dorsal crest.',
    gearCost: 120,
    milestoneText: '120 Golden Gears',
    previewColors: ['#1d4ed8', '#0f172a', '#f97316']
  },
  {
    id: 'clockwork_brass',
    name: 'Foundry Automaton',
    description: 'Burnished brass and copper articulated plates powered by a miniature steam-gauge pack.',
    gearCost: 160,
    milestoneText: 'Clear Reboot Tower 3 or 160 Gears',
    previewColors: ['#b45309', '#fbbf24', '#78350f']
  },
  {
    id: 'frost_warden',
    name: 'Glacier Warden',
    description: 'Translucent arctic-cyan hide with snow-white frost crest and crystalline cryo-pack.',
    gearCost: 200,
    milestoneText: 'Clear Reboot Tower 4 or 200 Gears',
    previewColors: ['#67e8f9', '#f8fafc', '#0284c7']
  },
  {
    id: 'shadow_infiltrator',
    name: 'Night Ops',
    description: 'Stealth obsidian-indigo operative suit with carbon harness and emerald night-vision pips.',
    gearCost: 250,
    milestoneText: 'Crack 5 Secret Vaults/Chambers or 250 Gears',
    previewColors: ['#1e1b4b', '#312e81', '#22c55e']
  },
  {
    id: 'retro_1987',
    name: "Classic '87 Tribute",
    description: 'Bright 1987 arcade emerald skin, sunny yellow belly, and classic Destructo blaster.',
    gearCost: 180,
    milestoneText: 'Clear any 4 Original Mode Towers or 180 Gears',
    previewColors: ['#22c55e', '#fde047', '#ef4444']
  },
  {
    id: 'golden_toppler',
    name: 'Sovereign Gold',
    description: 'Brushed celestial gold scales with royal amethyst crest reserved for elite operatives.',
    gearCost: 400,
    milestoneText: 'Earn 18 Star Cores or 400 Gears',
    previewColors: ['#eab308', '#9333ea', '#fef08a']
  }
];

export const BLASTER_FX_CATALOG = [
  {
    id: 'standard_cryo',
    name: 'MK.4 Standard Cryo',
    description: 'Factory Destructo Inc. compressed cryo-orb with crisp ice-cyan vapor wake.',
    trophyPointsReq: 0,
    pointsRequired: 0,
    pointsReq: 0,
    gearCost: 0,
    milestoneText: 'Unlocked by Default',
    coreColor: '#e0f2fe',
    emissiveColor: '#38bdf8',
    muzzleColor: '#7be8ff',
    trailColors: ['#e0f2fe', '#67e8f9'],
    previewColors: ['#38bdf8', '#e0f2fe', '#0284c7']
  },
  {
    id: 'emerald_plasma',
    name: 'Bioluminescent Surge',
    description: 'Deep-trench bio-plasma bolt trailing ionized emerald and seafoam firefly motes.',
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
    name: 'Foundry Slag Bolt',
    description: 'Superheated Clockwork Foundry arc-charge shedding bright forge-gold sparks.',
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
    name: 'Prism Singularity',
    description: 'Resonator-tuned crystalline bolt pulsing with ultraviolet and magenta rift energy.',
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
    id: 'retro_voxel',
    name: '1987 Arcade Pulse',
    description: 'High-contrast 8-bit tribute concussion pulse flashing sunny gold and cobalt.',
    trophyPointsReq: 700,
    pointsRequired: 700,
    pointsReq: 700,
    gearCost: 300,
    milestoneText: '700 Trophy Pts or 300 Gears',
    coreColor: '#ffffff',
    emissiveColor: '#fde047',
    muzzleColor: '#facc15',
    trailColors: ['#fde047', '#38bdf8'],
    previewColors: ['#eab308', '#38bdf8', '#ef4444']
  },
  {
    id: 'diamond_prism',
    name: 'Sovereign Starlight',
    description: 'Refractive diamond-tier starcore lance leaving a tri-spectrum aurora wake.',
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

export const RELIC_CODEX = [
  {
    id: 'relic_t1',
    towerId: 1,
    index: 1,
    code: 'DATA LOG 01',
    title: 'Project Nebulus Directive',
    sector: 'Sector I • Watchtower of the Mist',
    author: 'Destructo Inc. Orbital Recon',
    accentColor: '#5efce8',
    icon: '◈',
    lore: 'Eight dormant Abyssal Terraform Monoliths have ignited under a lunar super-storm. MK.7 Specialist Pogo is cleared for vertical insertion: reach each crown portal, arm the core charges, and topple every tower into the sea.',
    text: 'Eight dormant Abyssal Terraform Monoliths have ignited under a lunar super-storm. MK.7 Specialist Pogo is cleared for vertical insertion: reach each crown portal, arm the core charges, and topple every tower into the sea.',
    description: 'Recovered from Watchtower of the Mist (Tower 1).'
  },
  {
    id: 'relic_t2',
    towerId: 2,
    index: 2,
    code: 'DATA LOG 02',
    title: 'Abyssal Sluice Telemetry',
    sector: 'Sector I • The Sinking Reliquary',
    author: 'Chief Hydrologist V. Kael',
    accentColor: '#22d3ee',
    icon: '≈',
    lore: 'Trench intake gates beneath Monolith Two have ruptured! Seawater is surging upward at 0.17 tiers per second. Only emergency brass Drain Valves wired into the exterior masonry can vent head pressure long enough to reach the crown.',
    text: 'Trench intake gates beneath Monolith Two have ruptured! Seawater is surging upward at 0.17 tiers per second. Only emergency brass Drain Valves wired into the exterior masonry can vent head pressure long enough to reach the crown.',
    description: 'Recovered from The Sinking Reliquary (Tower 2).'
  },
  {
    id: 'relic_t3',
    towerId: 3,
    index: 3,
    code: 'DATA LOG 03',
    title: 'Automaton Forge Manifest',
    sector: 'Sector II • Clockwork Foundry',
    author: 'Foundry Overseer Unit 09',
    accentColor: '#f59e0b',
    icon: '❖',
    lore: 'Geothermal boilers feed both the reversible ore-conveyor belts and the Clockwork Sentinel patrols. Caution: cracked grate nozzles hiss for one second before venting vertical superheated steam plumes.',
    text: 'Geothermal boilers feed both the reversible ore-conveyor belts and the Clockwork Sentinel patrols. Caution: cracked grate nozzles hiss for one second before venting vertical superheated steam plumes.',
    description: 'Recovered from Clockwork Foundry (Tower 3).'
  },
  {
    id: 'relic_t4',
    towerId: 4,
    index: 4,
    code: 'DATA LOG 04',
    title: 'Cryogenic Vortex Anomaly',
    sector: 'Sector II • Boreal Spire',
    author: 'Boreal Weather Array',
    accentColor: '#67e8f9',
    icon: '✳',
    lore: 'Monolith Four vents endothermic exhaust straight into the upper troposphere, glazing every corbel in mirror-ice and whipping 6-second cyclonic crosswinds around the cylinder. Hug recessed stone doorways to break the gale.',
    text: 'Monolith Four vents endothermic exhaust straight into the upper troposphere, glazing every corbel in mirror-ice and whipping 6-second cyclonic crosswinds around the cylinder. Hug recessed stone doorways to break the gale.',
    description: 'Recovered from Boreal Spire (Tower 4).'
  },
  {
    id: 'relic_t5',
    towerId: 5,
    index: 5,
    code: 'DATA LOG 05',
    title: 'Resonator Cipher Tablet',
    sector: 'Sector III • Prism Labyrinth',
    author: 'Archivist S. Phillips',
    accentColor: '#e879f9',
    icon: '◇',
    lore: 'The builders hid Star Cores behind runic chambers whose combinations are carved in plain sight along the outer tower masonry—glowing tile grids and colored bronze bell banners waiting five stories away for keen eyes.',
    text: 'The builders hid Star Cores behind runic chambers whose combinations are carved in plain sight along the outer tower masonry—glowing tile grids and colored bronze bell banners waiting five stories away for keen eyes.',
    description: 'Recovered from Prism Labyrinth (Tower 5).'
  },
  {
    id: 'relic_t6',
    towerId: 6,
    index: 6,
    code: 'DATA LOG 06',
    title: 'Derrick Hydraulic Spec',
    sector: 'Sector III • Tidal Piston Rig',
    author: 'Offshore Structural Log',
    accentColor: '#34d399',
    icon: '⬡',
    lore: 'Twelve-ton brass hydraulic rams anchor Monolith Six to the abyssal shelf, cycling in and out of the bulkhead in 3-second pneumatic cadences. Mistime a foothold on a retracting ram and the ocean claims another diver.',
    text: 'Twelve-ton brass hydraulic rams anchor Monolith Six to the abyssal shelf, cycling in and out of the bulkhead in 3-second pneumatic cadences. Mistime a foothold on a retracting ram and the ocean claims another diver.',
    description: 'Recovered from Tidal Piston Rig (Tower 6).'
  },
  {
    id: 'relic_t7',
    towerId: 7,
    index: 7,
    code: 'DATA LOG 07',
    title: 'Tempest Capacitor Grid',
    sector: 'Sector IV • Blackout Citadel',
    author: 'High-Voltage Telemetry',
    accentColor: '#818cf8',
    icon: '↯',
    lore: 'Columnar basalt lightning conductors drink the storm itself, plunging the citadel into periodic twilight blackouts before discharging blinding megavolt forks across the rain-slick battlements.',
    text: 'Columnar basalt lightning conductors drink the storm itself, plunging the citadel into periodic twilight blackouts before discharging blinding megavolt forks across the rain-slick battlements.',
    description: 'Recovered from Blackout Citadel (Tower 7).'
  },
  {
    id: 'relic_t8',
    towerId: 8,
    index: 8,
    code: 'DATA LOG 08',
    title: 'Operative Dossier: 1987–2026',
    sector: 'Sector IV • Apex of Nebulus',
    author: 'Destructo Inc. Command Vault',
    accentColor: '#fbbf24',
    icon: '♛',
    lore: 'Thirty-nine cycles after the first eight Nebulus towers fell, the master Eclipsed Reactor has surfaced at the center of the maelstrom. Topple the Apex crown, and Planet Nebulus breathes free at last.',
    text: 'Thirty-nine cycles after the first eight Nebulus towers fell, the master Eclipsed Reactor has surfaced at the center of the maelstrom. Topple the Apex crown, and Planet Nebulus breathes free at last.',
    description: 'Recovered from Apex of Nebulus (Tower 8).'
  }
];

export const CURIO_CATALOG = [
  {
    id: 'curio_astrolabe',
    index: 1,
    category: 'curio',
    name: 'Tidal Brass Astrolabe',
    title: 'Tidal Brass Astrolabe',
    sector: 'Endless Casual • Artifact Survey',
    gearBonus: 5,
    accentColor: '#fbbf24',
    icon: '◎',
    lore: 'Gilded three-ring celestial dial calibrated to Nebulus twin-tide harmonics.',
    text: 'Gilded three-ring celestial dial calibrated to Nebulus twin-tide harmonics.',
    description: 'Gilded three-ring celestial dial calibrated to Nebulus twin-tide harmonics.'
  },
  {
    id: 'curio_nautilus',
    index: 2,
    category: 'curio',
    name: 'Iridescent Glass Nautilus',
    title: 'Iridescent Glass Nautilus',
    sector: 'Endless Casual • Artifact Survey',
    gearBonus: 5,
    accentColor: '#5efce8',
    icon: '◈',
    lore: 'Crystalline spiral shell resonating with low-frequency ocean trench currents.',
    text: 'Crystalline spiral shell resonating with low-frequency ocean trench currents.',
    description: 'Crystalline spiral shell resonating with low-frequency ocean trench currents.'
  },
  {
    id: 'curio_chronometer',
    index: 3,
    category: 'curio',
    name: 'Submerged MK.1 Chronometer',
    title: 'Submerged MK.1 Chronometer',
    sector: 'Endless Casual • Lost Treasure',
    gearBonus: 5,
    accentColor: '#38bdf8',
    icon: '◷',
    lore: 'Watertight 1987 Destructo Inc. diver pocket watch—still ticking on ruby bearings.',
    text: 'Watertight 1987 Destructo Inc. diver pocket watch—still ticking on ruby bearings.',
    description: 'Watertight 1987 Destructo Inc. diver pocket watch—still ticking on ruby bearings.'
  },
  {
    id: 'curio_prism_lens',
    index: 4,
    category: 'curio',
    name: 'Refractive Starlight Prism',
    title: 'Refractive Starlight Prism',
    sector: 'Endless Casual • Master Puzzle Spire',
    gearBonus: 5,
    accentColor: '#e879f9',
    icon: '◇',
    lore: 'Precision-ground amethyst octahedron used to split resonator laser beams.',
    text: 'Precision-ground amethyst octahedron used to split resonator laser beams.',
    description: 'Precision-ground amethyst octahedron used to split resonator laser beams.'
  },
  {
    id: 'curio_compass',
    index: 5,
    category: 'curio',
    name: 'Mariner Lodestone Compass',
    title: 'Mariner Lodestone Compass',
    sector: 'Endless Casual • Lost Treasure',
    gearBonus: 5,
    accentColor: '#34d399',
    icon: '✦',
    lore: 'Floating magnetized meteorite needle pointing unerringly toward submerged Star Cores.',
    text: 'Floating magnetized meteorite needle pointing unerringly toward submerged Star Cores.',
    description: 'Floating magnetized meteorite needle pointing unerringly toward submerged Star Cores.'
  },
  {
    id: 'curio_automaton_heart',
    index: 6,
    category: 'curio',
    name: 'Clockwork Escapement Core',
    title: 'Clockwork Escapement Core',
    sector: 'Endless Casual • Artifact Survey',
    gearBonus: 5,
    accentColor: '#f59e0b',
    icon: '❖',
    lore: 'Mainspring governor salvaged from a decommissioned Foundry sentinel.',
    text: 'Mainspring governor salvaged from a decommissioned Foundry sentinel.',
    description: 'Mainspring governor salvaged from a decommissioned Foundry sentinel.'
  },
  {
    id: 'curio_frost_orchid',
    index: 7,
    category: 'curio',
    name: 'Cryo-Preserved Abyssal Orchid',
    title: 'Cryo-Preserved Abyssal Orchid',
    sector: 'Endless Casual • Artifact Survey',
    gearBonus: 5,
    accentColor: '#67e8f9',
    icon: '✳',
    lore: 'Bioluminescent pelagic blossom flash-frozen inside crystal Boreal ice.',
    text: 'Cryo-Preserved pelagic blossom flash-frozen inside crystal Boreal ice.',
    description: 'Bioluminescent pelagic blossom flash-frozen inside crystal Boreal ice.'
  },
  {
    id: 'curio_thunder_glass',
    index: 8,
    category: 'curio',
    name: 'Fulgurite Lightning Vial',
    title: 'Fulgurite Lightning Vial',
    sector: 'Endless Casual • Lost Treasure',
    gearBonus: 5,
    accentColor: '#818cf8',
    icon: '↯',
    lore: 'Hollow tube of vitrified sea-sand humming with trapped tempest static.',
    text: 'Hollow tube of vitrified sea-sand humming with trapped tempest static.',
    description: 'Hollow tube of vitrified sea-sand humming with trapped tempest static.'
  },
  {
    id: 'blueprint_beacon_dynamo',
    index: 9,
    category: 'blueprint',
    name: 'Blueprint: Summit Beacon Dynamo',
    title: 'Blueprint: Summit Beacon Dynamo',
    sector: 'Workbench Craft • Tower Repair',
    gearBonus: 8,
    accentColor: '#fbbf24',
    icon: '⬡',
    lore: 'Field schematic assembling a Copper Coil, Prism Lens, and Brass Shaft into a self-exciting monolith stabilizer.',
    text: 'Field schematic assembling a Copper Coil, Prism Lens, and Brass Shaft into a self-exciting monolith stabilizer.',
    description: 'Crafted at a Tinker Workbench during a Fix-the-Monolith expedition.'
  },
  {
    id: 'blueprint_mk7_thruster',
    index: 10,
    category: 'blueprint',
    name: 'Blueprint: MK.7 Hydro-Impeller',
    title: 'Blueprint: MK.7 Hydro-Impeller',
    sector: 'Workbench Craft • Naval Engineering',
    gearBonus: 8,
    accentColor: '#22d3ee',
    icon: '≈',
    lore: 'Whisper-quiet magnetohydrodynamic shroud specs for deep-trench MK.7 voyages.',
    text: 'Whisper-quiet magnetohydrodynamic shroud specs for deep-trench MK.7 voyages.',
    description: 'Recovered from coastal salvage & workbench calibration.'
  },
  {
    id: 'blueprint_skywing_rib',
    index: 11,
    category: 'blueprint',
    name: 'Blueprint: Storm-Silk Glider Frame',
    title: 'Blueprint: Storm-Silk Glider Frame',
    sector: 'Workbench Craft • Aero-Rigging',
    gearBonus: 8,
    accentColor: '#a7f3d0',
    icon: '∆',
    lore: 'Ultralight hinged carbon-reed spar enabling Pogo to ride violent summit thermals.',
    text: 'Ultralight hinged carbon-reed spar enabling Pogo to ride violent summit thermals.',
    description: 'Recovered from high-altitude spire expeditions.'
  },
  {
    id: 'blueprint_cryo_condenser',
    index: 12,
    category: 'blueprint',
    name: 'Blueprint: MK.4 Cryo-Condenser',
    title: 'Blueprint: MK.4 Cryo-Condenser',
    sector: 'Workbench Craft • Armory',
    gearBonus: 8,
    accentColor: '#f472b6',
    icon: '★',
    lore: 'Triple-baffled phase chamber allowing custom prismatic cryo-bolt modulation.',
    text: 'Triple-baffled phase chamber allowing custom prismatic cryo-bolt modulation.',
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
  // Reboot Campaign & Mechanics (16)
  tDef('first_topple', 'Monolith Breaker', 'Topple your first tower in any mode.', 'aluminum', 5, 'campaign', '❖'),
  tDef('mist_walker', 'Watchtower Cleared', 'Complete Reboot Tower 1 (Watchtower of the Mist).', 'aluminum', 5, 'campaign', '◈'),
  tDef('clear_reboot_t2', 'Reliquary Survivor', 'Complete Reboot Tower 2 (The Sinking Reliquary).', 'aluminum', 5, 'campaign', '≈'),
  tDef('clear_reboot_t3', 'Smelter Veteran', 'Complete Reboot Tower 3 (Clockwork Foundry).', 'aluminum', 5, 'campaign', '❖'),
  tDef('clear_reboot_t4', 'Gale Climber', 'Complete Reboot Tower 4 (Boreal Spire).', 'aluminum', 5, 'campaign', '✳'),
  tDef('clear_reboot_t5', 'Prism Initiate', 'Complete Reboot Tower 5 (Prism Labyrinth).', 'aluminum', 5, 'campaign', '◇'),
  tDef('clear_reboot_t6', 'Derrick Rigger', 'Complete Reboot Tower 6 (Tidal Piston Rig).', 'aluminum', 5, 'campaign', '⬡'),
  tDef('clear_reboot_t7', 'Tempest Walker', 'Complete Reboot Tower 7 (Blackout Citadel).', 'aluminum', 5, 'campaign', '↯'),
  tDef('clear_reboot_t8', 'Reactor Breacher', 'Complete Reboot Tower 8 (Apex of Nebulus).', 'aluminum', 5, 'campaign', '★'),
  tDef('lift_rider', 'Cage Ascender', 'Ride a wrought-iron cage elevator to its upper stop.', 'aluminum', 5, 'campaign', '▲'),
  tDef('lift_caller', 'Remote Recall', 'Recall a distant cage elevator to your floor with a cryo-shot.', 'aluminum', 5, 'campaign', '◎'),
  tDef('tunnel_runner', 'Misty Passage', 'Traverse an interior stone doorway shortcut.', 'aluminum', 5, 'campaign', '◈'),
  tDef('spark_diver', 'Welder Shortcut', 'Thread a spark-showering arched side tunnel.', 'aluminum', 5, 'campaign', '✦'),
  tDef('drain_plumber', 'Pressure Relief', 'Trigger a brass Drain Valve to lower surging sea levels.', 'aluminum', 5, 'campaign', '≈'),
  tDef('steam_surfer', 'Thermal Updraft', 'Launch skyward on an erupting Foundry steam vent.', 'aluminum', 5, 'campaign', '»'),
  tDef('belt_flipper', 'Reverse Polarity', 'Reverse conveyor belt direction using a Foundry switch.', 'aluminum', 5, 'campaign', '⇄'),

  // Original 1987 Classic Towers & Rules (10)
  tDef('clear_orig_t1', 'Eyes Wide Open', 'Topple 1987 Original Tower 1 (The Tower of Eyes).', 'aluminum', 5, 'original', '▲'),
  tDef('clear_orig_t2', 'Robot Wrangler', 'Topple 1987 Original Tower 2 (The Realm of Robots).', 'aluminum', 5, 'original', '▲'),
  tDef('clear_orig_t3', 'Deception Dodger', 'Topple 1987 Original Tower 3 (Trap of Tricks).', 'aluminum', 5, 'original', '▲'),
  tDef('clear_orig_t4', 'Glacier Skater', 'Topple 1987 Original Tower 4 (Slippery Slide).', 'aluminum', 5, 'original', '▲'),
  tDef('clear_orig_t5', 'Ruin Hopper', 'Topple 1987 Original Tower 5 (Broken Path).', 'aluminum', 5, 'original', '▲'),
  tDef('clear_orig_t6', 'High Dive Dry', "Topple 1987 Original Tower 6 (Swimmer's Delight).", 'aluminum', 5, 'original', '▲'),
  tDef('clear_orig_t7', 'No Doors Needed', 'Topple 1987 Original Tower 7 (Nasty One).', 'aluminum', 5, 'original', '▲'),
  tDef('clear_orig_t8', 'Summit Gambler', 'Topple 1987 Original Tower 8 (Edge of Doom).', 'aluminum', 5, 'original', '▲'),
  tDef('chute_breaker', 'Chimney Drop', 'Dissolve a crumbling step in Original Mode.', 'aluminum', 5, 'original', '▾'),
  tDef('classic_extra_life', '5,000-Point 1-UP', 'Earn an extra life at a 5,000-point arcade threshold.', 'aluminum', 5, 'original', '✦'),

  // Combat & Cryo-Blaster (6)
  tDef('first_snowball', 'Cryo Calibration', 'Fire your MK.4 Cryo-Blaster inside a tower.', 'aluminum', 5, 'combat', '✳'),
  tDef('box_breaker', 'Crate Shatter', 'Demolish a barricade block with a cryo-bolt.', 'aluminum', 5, 'combat', '❖'),
  tDef('roller_shatter', 'Furnace Cracker', 'Neutralize a Rolling Sphere with a direct shot.', 'aluminum', 5, 'combat', '◎'),
  tDef('bouncer_freeze', 'Spore Stasis', 'Freeze or pop a Bouncing Hopper with your blaster.', 'aluminum', 5, 'combat', '✳'),
  tDef('sentinel_short', 'Clockwork Jammer', 'Short-circuit a patrolling Clockwork Sentinel in Reboot Mode.', 'aluminum', 5, 'combat', '↯'),
  tDef('shield_saver', 'Cryo-Barrier Saved', 'Absorb a hazard or enemy impact with an active Cryo-Shield.', 'aluminum', 5, 'combat', '◎'),

  // Mini-Games Onboarding (8)
  tDef('sub_novice', 'Trench Diver', 'Complete a voyage in MK.7 Sub-Hunter.', 'aluminum', 5, 'minigames', '◎'),
  tDef('sub_mine_sweeper', 'Ordnance Disposal', 'Detonate a chained abyssal sea mine in MK.7 Sub-Hunter.', 'aluminum', 5, 'minigames', '✦'),
  tDef('skimmer_novice', 'Wake Runner', 'Complete an ocean sprint in Hydro-Skimmer Run.', 'aluminum', 5, 'minigames', '»'),
  tDef('skimmer_ramp_air', 'Crest Jumper', 'Launch off a curling foam wave-ramp in Hydro-Skimmer Run.', 'aluminum', 5, 'minigames', '∆'),
  tDef('skimmer_crate_buster', 'Flotsam Blaster', 'Blast floating cargo crates during Hydro-Skimmer Run.', 'aluminum', 5, 'minigames', '❖'),
  tDef('glide_novice', 'First Flight', 'Complete a sky-wing flight in The Glide.', 'aluminum', 5, 'minigames', '∆'),
  tDef('glide_thermal', 'Updraft Rider', 'Gain altitude inside a rising sea thermal in The Glide.', 'aluminum', 5, 'minigames', '≈'),
  tDef('vault_novice', 'Tumbler Apprentice', 'Lock your first rotating ring inside a Core Lock Vault.', 'aluminum', 5, 'minigames', '⬡'),

  // Exploration, Casual Expeditions & Endless/Daily Onboarding (10)
  tDef('first_gear', 'Cog Scavenger', 'Collect your first Golden Gear.', 'aluminum', 5, 'exploration', '❖'),
  tDef('first_star_core', 'Core Harvester', 'Earn your first Star Core.', 'aluminum', 5, 'exploration', '★'),
  tDef('relic_finder_1', 'Ancient Signal', 'Recover your first Destructo Inc. Lore Relic tablet.', 'aluminum', 5, 'exploration', '◈'),
  tDef('casual_explorer', 'Peaceful Expedition', 'Complete a peaceful monolith climb in Endless Casual mode.', 'aluminum', 5, 'exploration', '✧'),
  tDef('tinker_apprentice', 'Monolith Tinker', 'Scavenge 3 Salvage Parts and craft a Beacon Dynamo at a Workbench.', 'aluminum', 5, 'exploration', '⬡'),
  tDef('chest_plunderer', 'Sunken Hoard', 'Find 3 Compass Keys and unlock a Summit Treasure Chest.', 'aluminum', 5, 'exploration', '★'),
  tDef('era_switcher', 'Time Traveler', 'Switch between the 2026 Reboot and 1987 Original eras.', 'aluminum', 5, 'exploration', '⇄'),
  tDef('zen_voyager', 'Calm Amidst the Storm', 'Climb a monolith with Casual Zen Mode enabled.', 'aluminum', 5, 'exploration', '✧'),
  tDef('daily_try', 'Global Contender', 'Attempt a UTC Daily Seeded Tower challenge.', 'aluminum', 5, 'endless_daily', '◷'),
  tDef('endless_1', 'Into the Abyss', 'Topple Sector 1 in Endless Abyss mode.', 'aluminum', 5, 'endless_daily', '∞'),

  // ================= COPPER TIER: 30 × 10 PTS = 300 PTS =================
  // Speed Pars, Biome Survival & Casual Surveys (10)
  tDef('speed_reboot_t1', 'Mist Sprinter', 'Beat the Speed Par time on Watchtower of the Mist (T1).', 'copper', 10, 'campaign', '↯'),
  tDef('speed_reboot_t2', 'Surge Outrunner', 'Beat the Speed Par time on The Sinking Reliquary (T2).', 'copper', 10, 'campaign', '↯'),
  tDef('speed_demon', 'Chrono Blitz', 'Earn the Speed Star Core on 3 different towers.', 'copper', 10, 'campaign', '↯'),
  tDef('tide_runner', 'Outrun the Abyss', 'Clear The Sinking Reliquary (Reboot T2) without touching the rising sea.', 'copper', 10, 'campaign', '≈'),
  tDef('wind_walker', 'Anchor Footing', 'Clear Boreal Spire (Reboot T4) without plunging into the sea.', 'copper', 10, 'campaign', '✳'),
  tDef('piston_dancer', 'Pneumatic Rhythm', 'Clear Tidal Piston Rig (Reboot T6) with zero enemy or hazard hits.', 'copper', 10, 'campaign', '⬡'),
  tDef('blackout_beacon', 'Night Vision', 'Clear Blackout Citadel (Reboot T7) without touching the sea.', 'copper', 10, 'campaign', '✧'),
  tDef('storm_ghost', 'Untouchable Operative', 'Clear any tower without taking a single enemy hit.', 'copper', 10, 'combat', '✧'),
  tDef('curio_collector_4', 'Field Naturalist', 'Catalog 4 Exploration Curios or Blueprints in your Codex.', 'copper', 10, 'exploration', '◎'),
  tDef('casual_voyager_5', 'Horizon Wanderer', 'Complete 5 Endless Casual expeditions across the archipelago.', 'copper', 10, 'exploration', '✧'),

  // Secret Rune Chambers & Core Lock Vaults (8)
  tDef('rune_scholar', 'Rune Reader', 'Decipher an exterior tower clue and solve a hidden Rune Puzzle Chamber.', 'copper', 10, 'exploration', '◈'),
  tDef('rune_lights_clear', 'Mosaic Illuminator', 'Solve a Lights Mosaic Rune Chamber.', 'copper', 10, 'minigames', '◈'),
  tDef('rune_bells_clear', 'Carillon Virtuoso', 'Ring the exact banner sequence in a Bell Choir Rune Chamber.', 'copper', 10, 'minigames', '◈'),
  tDef('rune_beam_clear', 'Optic Architect', 'Align the crystal mirrors to solve a Prism Beam Rune Chamber.', 'copper', 10, 'minigames', '◇'),
  tDef('rune_blocks_clear', 'Ashlar Tactician', 'Seal every stone pressure plate in a Blocks Rune Chamber.', 'copper', 10, 'minigames', '❖'),
  tDef('switch_architect', 'Prism Tactician', 'Clear Prism Labyrinth (Reboot T5) collecting its Explorer Star Core.', 'copper', 10, 'campaign', '◇'),
  tDef('vault_cracker', 'Master Locksmith', 'Crack open a Core Lock Vault with zero missed strikes.', 'copper', 10, 'minigames', '⬡'),
  tDef('vault_t8_clear', 'Reactor Vault Breached', 'Crack the hidden Core Lock Vault on Apex of Nebulus (T8).', 'copper', 10, 'exploration', '★'),

  // Combat, Mini-Game Aces & Classic Technique (7)
  tDef('snowball_sniper', 'Cryo Sharpshooter', 'Achieve a 4x snowball hit combo inside a tower.', 'copper', 10, 'combat', '✳'),
  tDef('sub_ace', 'Abyssal Angler', 'Catch 10+ bioluminescent fish in a single MK.7 Sub-Hunter stage.', 'copper', 10, 'minigames', '✦'),
  tDef('warp_finder', 'Trench Secret', 'Discover the secret bioluminescent Warp Cave in MK.7 Sub-Hunter.', 'copper', 10, 'minigames', '◎'),
  tDef('skimmer_pro', 'Wave Carver', 'Reach a 4x Boost Gate multiplier in Hydro-Skimmer Run.', 'copper', 10, 'minigames', '»'),
  tDef('sky_rider', 'Storm Wing Ace', 'Complete The Glide catching a Golden Lantern or 4x Ring Gate chain.', 'copper', 10, 'minigames', '∆'),
  tDef('arcade_tourist', 'Pentathlon Operative', 'Experience all 5 playable 3D Mini-Games and Secret Chambers.', 'copper', 10, 'minigames', '★'),
  tDef('orig_technique_perfect', '1,000-Point Technique', 'Earn a flawless 1,000-point Technique Bonus on Original Towers 2–8.', 'copper', 10, 'original', '▲'),

  // Endless, Daily & Collection Milestones (5)
  tDef('daily_climber', 'Daily Vanguard', 'Complete a Daily Seeded Tower challenge.', 'copper', 10, 'endless_daily', '◷'),
  tDef('endless_3', 'Abyssal Stride', 'Topple 3 consecutive towers in a single Endless Abyss run.', 'copper', 10, 'endless_daily', '∞'),
  tDef('relic_hunter_4', 'Encrypted Archive', 'Recover 4 Destructo Inc. Lore Relic tablets.', 'copper', 10, 'exploration', '◈'),
  tDef('first_skin', 'Custom Operative', 'Unlock an additional Pogo Skin in the Wardrobe.', 'copper', 10, 'exploration', '❖'),
  tDef('first_blaster_fx', 'Modded Cryo-Core', 'Unlock an additional Cryo-Blaster FX style.', 'copper', 10, 'combat', '✳'),

  // ================= PLATINUM TIER: 15 × 20 PTS = 300 PTS =================
  tDef('sector_1_master', 'Lords of the Drowned Watch', 'Earn all 6 Star Cores across Sector I (Reboot Towers 1 & 2).', 'platinum', 20, 'campaign', '★'),
  tDef('sector_2_master', 'Masters of Fire & Frost', 'Earn all 6 Star Cores across Sector II (Reboot Towers 3 & 4).', 'platinum', 20, 'campaign', '★'),
  tDef('sector_3_master', 'Wardens of Prism & Iron', 'Earn all 6 Star Cores across Sector III (Reboot Towers 5 & 6).', 'platinum', 20, 'campaign', '★'),
  tDef('sector_4_master', 'Conquerors of the Maelstrom', 'Earn all 6 Star Cores across Sector IV (Reboot Towers 7 & 8).', 'platinum', 20, 'campaign', '★'),
  tDef('operation_nebulus', 'Savior of Nebulus', 'Clear all 8 Story Towers in 2026 Reboot Mode.', 'platinum', 20, 'campaign', '★'),
  tDef('classic_hero', '1987 Purist', 'Clear all 8 cell-for-cell 1987 towers in Original Mode.', 'platinum', 20, 'original', '▲'),
  tDef('pacifist_climb', 'Ghost of Destructo', 'Topple any non-casual tower without firing a single shot.', 'platinum', 20, 'combat', '✧'),
  tDef('chrono_olympian', 'Chrono Olympian', 'Earn all 8 Speed Star Cores across the 2026 Reboot Campaign.', 'platinum', 20, 'campaign', '↯'),
  tDef('endless_5', 'Deep Horizon', 'Topple 5 consecutive towers in a single Endless Abyss run.', 'platinum', 20, 'endless_daily', '∞'),
  tDef('daily_speed_ace', 'Global Pace-Setter', 'Complete a Daily Seeded Tower beating its Speed Par time.', 'platinum', 20, 'endless_daily', '◷'),
  tDef('archivist_nebulus', 'Keeper of the Monoliths', 'Recover all 8 Destructo Inc. Lore Relic tablets (8/8).', 'platinum', 20, 'exploration', '◈'),
  tDef('curio_archivist_12', 'Master Curio Curator', 'Collect all 12 Exploration Curios and Tinker Blueprints (12/12).', 'platinum', 20, 'exploration', '◎'),
  tDef('nebulus_legend', "Grand Toppler '26", 'Collect at least 24 Star Cores and unlock 6 Pogo Skins.', 'platinum', 20, 'exploration', '♛'),
  tDef('wardrobe_complete', 'Amphibian Couture', 'Unlock all 8 Pogo Skins in the Wardrobe.', 'platinum', 20, 'exploration', '❖'),
  tDef('arsenal_complete', 'Prismatic Armory', 'Unlock all 6 Cryo-Blaster FX styles.', 'platinum', 20, 'combat', '✳'),

  // ================= DIAMOND TIER: 5 × 30 PTS = 150 PTS =================
  tDef('nebulus_sovereign', 'Nebulus Sovereign', 'Earn all 24 Star Cores and all 40 Mastery Medals in 2026 Reboot Mode.', 'diamond', 30, 'campaign', '♛'),
  tDef('immortal_1987', '1987 Arcade Immortal', 'Conquer all 8 real 1987 Original Towers in a single campaign run from Tower 1.', 'diamond', 30, 'original', '♛'),
  tDef('abyssal_titan', 'Abyssal Titan', 'Topple 15 consecutive monoliths in a single Endless Abyss run.', 'diamond', 30, 'endless_daily', '♛'),
  tDef('flawless_sector', 'Flawless Sector Sweep', 'Clear a Sector Summit tower with 0 hits, secret, speed par, and a 4x Summit Glide.', 'diamond', 30, 'campaign', '♛'),
  tDef('millennium_toppler', 'Millennium Toppler', 'Unlock all other 99 Trophies to achieve a perfect 1,000 / 1,000 Trophy Score.', 'diamond', 30, 'exploration', '♛')
];

const VALID_ERAS = new Set(['reboot', 'original']);
const VALID_CONTROLS = new Set(['gesture', 'joystick', 'dpad', 'tilt']);
const VALID_BUCKETS = new Set(['reboot', 'original', 'endless', 'daily', 'casual']);
const VALID_MINIGAMES = new Set(['submarine', 'skimmer', 'glide', 'puzzle', 'vault']);

const SKIN_BY_ID = new Map(SKIN_CATALOG.map((s) => [s.id, s]));
const BLASTER_BY_ID = new Map(BLASTER_FX_CATALOG.map((b) => [b.id, b]));
const RELIC_BY_ID = new Map(RELIC_CODEX.map((r) => [r.id, r]));
const CURIO_BY_ID = new Map(CURIO_CATALOG.map((c) => [c.id, c]));
const TROPHY_BY_ID = new Map(TROPHIES.map((t) => [t.id, t]));

const TIER_META = {
  aluminum: { total: 50, pointsEach: 5, maxPoints: 250 },
  copper: { total: 30, pointsEach: 10, maxPoints: 300 },
  platinum: { total: 15, pointsEach: 20, maxPoints: 300 },
  diamond: { total: 5, pointsEach: 30, maxPoints: 150 }
};

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
    version: 4,
    settings: { ...DEFAULT_SETTINGS },
    highScores: {
      reboot: 0,
      original: 0,
      endless: 0,
      daily: 0,
      casual: 0
    },
    gears: 0,
    lifetimeGears: 0,
    unlockedSkins: ['default_amphibian'],
    unlockedBlasterFx: ['standard_cryo'],
    collectedRelics: [],
    collectedCurios: [],
    unlockedTrophies: [],
    playedMiniGames: [],
    seenEras: ['reboot'],
    towerStars: {
      reboot: {},
      original: {}
    },
    dailyRecords: {},
    bestEndlessDepth: 0,
    casualExpeditionsCleared: 0,
    bestCasualDepth: 0,
    vaultsCracked: 0
  };
}

function safeReadStorage(key) {
  try {
    if (typeof globalThis !== 'undefined' && globalThis.localStorage) {
      return globalThis.localStorage.getItem(key);
    }
  } catch (_) {
    // Ignore sandboxed / private-mode storage errors
  }
  return null;
}

function safeWriteStorage(key, value) {
  try {
    if (typeof globalThis !== 'undefined' && globalThis.localStorage) {
      globalThis.localStorage.setItem(key, value);
      return true;
    }
  } catch (_) {
    // Ignore quota / security errors
  }
  return false;
}

export class ProgressionManager {
  constructor(storageKey = 'tt26_save_v2') {
    this.storageKey = storageKey;
    this.state = createFreshState();
    this._pendingAutoTrophies = [];
    this._armedFlawlessSector = false;
    this._load();
  }

  _load() {
    const raw = safeReadStorage(this.storageKey);
    if (!raw) {
      const legacyHi = Number(safeReadStorage('tt26_hiscore') || 0);
      if (Number.isFinite(legacyHi) && legacyHi > 0) {
        this.state.highScores.original = Math.floor(legacyHi);
      }
      return;
    }

    try {
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') return;

      const fresh = createFreshState();

      if (Array.isArray(parsed.unlockedSkins)) {
        const set = new Set(['default_amphibian']);
        for (const id of parsed.unlockedSkins) {
          if (SKIN_BY_ID.has(id)) set.add(id);
        }
        fresh.unlockedSkins = Array.from(set);
      }

      if (Array.isArray(parsed.unlockedBlasterFx)) {
        const bSet = new Set(['standard_cryo']);
        for (const id of parsed.unlockedBlasterFx) {
          if (BLASTER_BY_ID.has(id)) bSet.add(id);
        }
        fresh.unlockedBlasterFx = Array.from(bSet);
      }

      if (Array.isArray(parsed.collectedRelics)) {
        const rSet = new Set();
        for (const id of parsed.collectedRelics) {
          if (RELIC_BY_ID.has(id)) rSet.add(id);
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
        fresh.playedMiniGames = parsed.playedMiniGames.filter((m) => VALID_MINIGAMES.has(m));
      }

      if (Array.isArray(parsed.seenEras)) {
        const eSet = new Set(['reboot']);
        for (const e of parsed.seenEras) {
          if (VALID_ERAS.has(e)) eSet.add(e);
        }
        fresh.seenEras = Array.from(eSet);
      }

      if (parsed.settings && typeof parsed.settings === 'object') {
        fresh.settings = this._sanitizeSettings(
          { ...fresh.settings, ...parsed.settings },
          fresh.unlockedSkins,
          fresh.unlockedBlasterFx
        );
      }

      if (parsed.highScores && typeof parsed.highScores === 'object') {
        for (const bucket of VALID_BUCKETS) {
          const val = Number(parsed.highScores[bucket]);
          if (Number.isFinite(val) && val > 0) {
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
        for (const era of ['reboot', 'original']) {
          const src = parsed.towerStars[era];
          if (src && typeof src === 'object') {
            for (const [k, v] of Object.entries(src)) {
              if (v && typeof v === 'object') {
                fresh.towerStars[era][String(k)] = normalizeStarRecord(v);
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

      if (Number.isFinite(Number(parsed.bestEndlessDepth)) && Number(parsed.bestEndlessDepth) > 0) {
        fresh.bestEndlessDepth = Math.floor(Number(parsed.bestEndlessDepth));
      }
      if (Number.isFinite(Number(parsed.casualExpeditionsCleared)) && Number(parsed.casualExpeditionsCleared) > 0) {
        fresh.casualExpeditionsCleared = Math.floor(Number(parsed.casualExpeditionsCleared));
      }
      if (Number.isFinite(Number(parsed.bestCasualDepth)) && Number(parsed.bestCasualDepth) > 0) {
        fresh.bestCasualDepth = Math.floor(Number(parsed.bestCasualDepth));
      }
      if (Number.isFinite(Number(parsed.vaultsCracked)) && Number(parsed.vaultsCracked) > 0) {
        fresh.vaultsCracked = Math.floor(Number(parsed.vaultsCracked));
      }

      this.state = fresh;
      this._syncBlasterFxMilestonesNoSave();
      if (!this.isBlasterFxUnlocked(this.state.settings.blasterFxId)) {
        this.state.settings.blasterFxId = 'standard_cryo';
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
    const skins = Array.isArray(unlockedSkins) ? unlockedSkins : ['default_amphibian'];
    const blasters = Array.isArray(unlockedBlasterFx) ? unlockedBlasterFx : ['standard_cryo'];
    const era = VALID_ERAS.has(candidate.era) ? candidate.era : DEFAULT_SETTINGS.era;
    const controlMode = VALID_CONTROLS.has(candidate.controlMode)
      ? candidate.controlMode
      : DEFAULT_SETTINGS.controlMode;
    const tiltRaw = Number(candidate.tiltSensitivity);
    const tiltSensitivity = Number.isFinite(tiltRaw)
      ? Math.max(0.5, Math.min(2.0, tiltRaw))
      : DEFAULT_SETTINGS.tiltSensitivity;
    const skinId =
      typeof candidate.skinId === 'string' && SKIN_BY_ID.has(candidate.skinId) && skins.includes(candidate.skinId)
        ? candidate.skinId
        : 'default_amphibian';
    const blasterFxId =
      typeof candidate.blasterFxId === 'string' &&
      BLASTER_BY_ID.has(candidate.blasterFxId) &&
      (blasters.includes(candidate.blasterFxId) || candidate.blasterFxId === 'standard_cryo')
        ? candidate.blasterFxId
        : 'standard_cryo';

    return {
      era,
      controlMode,
      zenMode: Boolean(candidate.zenMode),
      muted: Boolean(candidate.muted),
      musicEnabled: candidate.musicEnabled !== undefined ? Boolean(candidate.musicEnabled) : true,
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
    if (!this.state.seenEras.includes(this.state.settings.era)) {
      this.state.seenEras.push(this.state.settings.era);
    }
    if (this.state.seenEras.length >= 2) {
      const t = this._unlockTrophyNoSave('era_switcher');
      if (t) this._pendingAutoTrophies.push(t);
    }
    this._save();
    return this.getSettings();
  }

  // ================= HIGH SCORES & GEARS =================

  getHighScore(bucket = 'reboot') {
    const key = VALID_BUCKETS.has(bucket) ? bucket : 'reboot';
    return this.state.highScores[key] || 0;
  }

  recordScore(bucket, score) {
    const key = VALID_BUCKETS.has(bucket) ? bucket : 'reboot';
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
    if (this.state.gears < cost) {
      return false;
    }
    if (cost > 0) {
      this.state.gears -= cost;
      this._save();
    }
    return true;
  }

  // ================= POGO SKINS (8) =================

  isSkinUnlocked(skinId) {
    if (skinId === 'default_amphibian') return true;
    return this.state.unlockedSkins.includes(skinId);
  }

  unlockSkin(skinId, useGears = false) {
    const skin = SKIN_BY_ID.get(skinId);
    if (!skin) {
      return { unlocked: false, reason: 'invalid_skin' };
    }
    if (this.isSkinUnlocked(skinId)) {
      return { unlocked: true, reason: 'already_unlocked', newlyUnlockedTrophies: [] };
    }
    if (useGears) {
      const cost = Math.max(0, skin.gearCost || 0);
      if (this.state.gears < cost) {
        return { unlocked: false, reason: 'insufficient_gears' };
      }
      this.state.gears -= cost;
    }
    this.state.unlockedSkins.push(skinId);

    const newlyUnlockedTrophies = [];
    if (this.state.unlockedSkins.length >= 2) {
      const t = this._unlockTrophyNoSave('first_skin');
      if (t) newlyUnlockedTrophies.push(t);
    }
    if (this.state.unlockedSkins.length >= SKIN_CATALOG.length) {
      const t = this._unlockTrophyNoSave('wardrobe_complete');
      if (t) newlyUnlockedTrophies.push(t);
    }
    if (this.getTotalStars(null) >= 24 && this.state.unlockedSkins.length >= 6) {
      const t = this._unlockTrophyNoSave('nebulus_legend');
      if (t) newlyUnlockedTrophies.push(t);
    }
    for (const extra of this.drainPendingTrophies()) {
      newlyUnlockedTrophies.push(extra);
    }

    this._save();
    return { unlocked: true, newlyUnlockedTrophies };
  }

  equipSkin(skinId) {
    if (!SKIN_BY_ID.has(skinId) || !this.isSkinUnlocked(skinId)) {
      return false;
    }
    this.state.settings.skinId = skinId;
    this._save();
    return true;
  }

  getEquippedSkin() {
    const active = this.state.settings.skinId;
    return this.isSkinUnlocked(active) ? active : 'default_amphibian';
  }

  // ================= CRYO-BLASTER FX UNLOCKABLES (6) =================

  _syncBlasterFxMilestonesNoSave() {
    const pts = this.getTrophyPoints();
    let added = false;
    for (const fx of BLASTER_FX_CATALOG) {
      if (pts >= (fx.trophyPointsReq || 0) && !this.state.unlockedBlasterFx.includes(fx.id)) {
        this.state.unlockedBlasterFx.push(fx.id);
        added = true;
      }
    }
    if (added) {
      if (this.state.unlockedBlasterFx.length >= 2) {
        const t = this._unlockTrophyNoSave('first_blaster_fx');
        if (t) this._pendingAutoTrophies.push(t);
      }
      if (this.state.unlockedBlasterFx.length >= BLASTER_FX_CATALOG.length) {
        const t = this._unlockTrophyNoSave('arsenal_complete');
        if (t) this._pendingAutoTrophies.push(t);
      }
    }
    return added;
  }

  isBlasterFxUnlocked(fxId) {
    if (fxId === 'standard_cryo') return true;
    const fx = BLASTER_BY_ID.get(fxId);
    if (!fx) return false;
    if (this.state.unlockedBlasterFx.includes(fxId)) return true;
    if (this.getTrophyPoints() >= (fx.trophyPointsReq || 0)) {
      this.state.unlockedBlasterFx.push(fxId);
      return true;
    }
    return false;
  }

  unlockBlasterFx(fxId, useGears = false) {
    const fx = BLASTER_BY_ID.get(fxId);
    if (!fx) {
      return { unlocked: false, reason: 'invalid_blaster_fx' };
    }
    if (this.isBlasterFxUnlocked(fxId)) {
      return { unlocked: true, reason: 'already_unlocked', newlyUnlockedTrophies: [] };
    }
    if (useGears) {
      const cost = Math.max(0, fx.gearCost || 0);
      if (this.state.gears < cost) {
        return { unlocked: false, reason: 'insufficient_gears' };
      }
      this.state.gears -= cost;
    }
    this.state.unlockedBlasterFx.push(fxId);

    const newlyUnlockedTrophies = [];
    if (this.state.unlockedBlasterFx.length >= 2) {
      const t = this._unlockTrophyNoSave('first_blaster_fx');
      if (t) newlyUnlockedTrophies.push(t);
    }
    if (this.state.unlockedBlasterFx.length >= BLASTER_FX_CATALOG.length) {
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
    if (!BLASTER_BY_ID.has(fxId) || !this.isBlasterFxUnlocked(fxId)) {
      return false;
    }
    this.state.settings.blasterFxId = fxId;
    this._save();
    return true;
  }

  getEquippedBlasterFx() {
    const active = this.state.settings.blasterFxId;
    return this.isBlasterFxUnlocked(active) ? active : 'standard_cryo';
  }

  getBlasterFxDef(fxId = this.getEquippedBlasterFx()) {
    return BLASTER_BY_ID.get(fxId) || BLASTER_FX_CATALOG[0];
  }

  // ================= LORE RELIC CODEX (8 TABLETS) =================

  collectRelic(relicId) {
    const resolvedId =
      typeof relicId === 'number' ? `relic_t${relicId}` : String(relicId || '');
    const def = RELIC_BY_ID.get(resolvedId);
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
      if (count >= 4) {
        const t = this._unlockTrophyNoSave('relic_hunter_4');
        if (t) newlyUnlockedTrophies.push(t);
      }
      if (count >= RELIC_CODEX.length) {
        const t = this._unlockTrophyNoSave('archivist_nebulus');
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
    const resolvedId =
      typeof relicId === 'number' ? `relic_t${relicId}` : String(relicId || '');
    return this.state.collectedRelics.includes(resolvedId);
  }

  getCollectedRelics() {
    return [...this.state.collectedRelics];
  }

  getRelicCount() {
    return this.state.collectedRelics.length;
  }

  // ================= EXPLORATION CURIOS & BLUEPRINTS (12) =================

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

  recordCasualExpedition({
    towersCleared = 1,
    depth = null,
    missionType = null,
    craftedDynamo = false,
    dynamoCrafted = false,
    chestOpened = false,
    curiosFound = 0,
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

    // Reward Golden Gears for Casual Expeditions (+6 per tower cleared)
    this.state.gears += 6;
    this.state.lifetimeGears = Math.max(this.state.gears, (this.state.lifetimeGears || 0) + 6);
    grant('first_gear');
    grant('casual_explorer');
    grant('zen_voyager');

    if (this.state.casualExpeditionsCleared >= 5) {
      grant('casual_voyager_5');
    }

    if (didCraft || missionType === 'tower_repair') {
      if (didCraft) grant('tinker_apprentice');
      const bp = this.collectCurio('blueprint_beacon_dynamo');
      if (bp?.newlyUnlockedTrophies?.length) newlyUnlockedTrophies.push(...bp.newlyUnlockedTrophies);
    }
    if (chestOpened) {
      grant('chest_plunderer');
    }

    // Unlock blueprint milestones across expedition count
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
    if (cleanScore > (this.state.highScores.casual || 0)) {
      this.state.highScores.casual = cleanScore;
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

  // ================= MINI-GAME & GAMEPLAY EVENT ENGINE =================

  recordMiniGamePlayed(mode) {
    if (!VALID_MINIGAMES.has(mode)) return null;
    if (!this.state.playedMiniGames.includes(mode)) {
      this.state.playedMiniGames.push(mode);
      if (this.state.playedMiniGames.length >= VALID_MINIGAMES.size) {
        const t = this._unlockTrophyNoSave('arcade_tourist');
        this._save();
        return t;
      }
      this._save();
    }
    return null;
  }

  /**
   * Unified event-driven trophy evaluator called from `src/game.js` (#109 / #112).
   * @param {string} type
   * @param {object} [payload={}]
   * @returns {object[]} Newly unlocked trophy definitions
   */
  recordGameplayEvent(type, payload = {}) {
    const unlockedNow = this.drainPendingTrophies();
    const grant = (id) => {
      const t = this._unlockTrophyNoSave(id);
      if (t) unlockedNow.push(t);
    };
    const markMini = (mode) => {
      if (VALID_MINIGAMES.has(mode) && !this.state.playedMiniGames.includes(mode)) {
        this.state.playedMiniGames.push(mode);
      }
      if (this.state.playedMiniGames.length >= VALID_MINIGAMES.size) {
        grant('arcade_tourist');
      }
    };

    switch (type) {
      case 'tower_start': {
        const era = payload.era === 'original' ? 'original' : 'reboot';
        if (!this.state.seenEras.includes(era)) {
          this.state.seenEras.push(era);
        }
        if (this.state.seenEras.length >= 2) grant('era_switcher');
        if (payload.zenMode || payload.runType === 'endless_casual') grant('zen_voyager');
        if (payload.runType === 'daily') grant('daily_try');
        break;
      }

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

      case 'crumble':
        if (payload.era === 'original') grant('chute_breaker');
        break;

      case 'snowball_fire':
        grant('first_snowball');
        if (payload.recalledLift) grant('lift_caller');
        break;

      case 'snowball_hit': {
        grant('first_snowball');
        if (payload.recalledLift) grant('lift_caller');
        const kind = payload.kind;
        if (kind === 'box') grant('box_breaker');
        else if (kind === 'roller') grant('roller_shatter');
        else if (kind === 'bouncer') grant('bouncer_freeze');
        else if (kind === 'robot') grant('sentinel_short');

        const combo = Number(payload.combo) || 0;
        if (combo >= 4) grant('snowball_sniper');
        break;
      }

      case 'switch_trigger':
        if (payload.mode === 'drainValve') grant('drain_plumber');
        else if (payload.mode === 'conveyorFlip') grant('belt_flipper');
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

      case 'salvage_collect':
      case 'compass_key':
        break;

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
        markMini('submarine');
        grant('sub_novice');
        if (Number(payload.minesDestroyed) >= 1) grant('sub_mine_sweeper');
        if (Number(payload.fishCaught) >= 10) grant('sub_ace');
        if (payload.warpEntered) grant('warp_finder');
        break;

      case 'skimmer_complete':
        markMini('skimmer');
        grant('skimmer_novice');
        if (Number(payload.rampsUsed) >= 1) grant('skimmer_ramp_air');
        if (Number(payload.cratesDestroyed) >= 1) grant('skimmer_crate_buster');
        if (Number(payload.maxBoost) >= 4) grant('skimmer_pro');
        break;

      case 'glide_complete': {
        markMini('glide');
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
          if (this._armedFlawlessSector) {
            grant('flawless_sector');
            this._armedFlawlessSector = false;
          }
        } else {
          this._armedFlawlessSector = false;
        }
        break;
      }

      case 'puzzle_complete':
        markMini('puzzle');
        if (payload.solved) {
          grant('rune_scholar');
          if (payload.puzzleType === 'lights') grant('rune_lights_clear');
          else if (payload.puzzleType === 'bells') grant('rune_bells_clear');
          else if (payload.puzzleType === 'beam') grant('rune_beam_clear');
          else if (payload.puzzleType === 'blocks') grant('rune_blocks_clear');
        }
        break;

      case 'vault_ring_lock':
        markMini('vault');
        grant('vault_novice');
        break;

      case 'vault_complete':
        markMini('vault');
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

  // ================= STAR CORES & 5-MEDAL TOWER MASTERY =================

  getTowerStars(era, towerId) {
    const e = era === 'original' ? 'original' : 'reboot';
    const rec = this.state.towerStars[e]?.[String(towerId)];
    return normalizeStarRecord(rec || {});
  }

  getTotalStars(era = null) {
    const eras = era && VALID_ERAS.has(era) ? [era] : ['reboot', 'original'];
    let sum = 0;
    for (const e of eras) {
      const map = this.state.towerStars[e] || {};
      for (const rec of Object.values(map)) {
        if (rec) {
          sum += (rec.clear ? 1 : 0) + (rec.vault ? 1 : 0) + (rec.speed ? 1 : 0);
        }
      }
    }
    return sum;
  }

  getTotalMedals(era = null) {
    const eras = era && VALID_ERAS.has(era) ? [era] : ['reboot', 'original'];
    let sum = 0;
    for (const e of eras) {
      const map = this.state.towerStars[e] || {};
      for (const rec of Object.values(map)) {
        if (rec) {
          sum += normalizeStarRecord(rec).medalsCount;
        }
      }
    }
    return sum;
  }

  _countClearedTowers(era) {
    const map = this.state.towerStars[era] || {};
    let cleared = 0;
    for (let id = 1; id <= 8; id++) {
      if (map[String(id)]?.clear) cleared++;
    }
    return cleared;
  }

  _countSpeedStars(onlyEra = null) {
    const eras = onlyEra ? [onlyEra] : ['reboot', 'original'];
    let speedCount = 0;
    for (const era of eras) {
      const map = this.state.towerStars[era] || {};
      for (const rec of Object.values(map)) {
        if (rec?.speed) speedCount++;
      }
    }
    return speedCount;
  }

  _countVaultStars() {
    let vaultCount = 0;
    for (const era of ['reboot', 'original']) {
      const map = this.state.towerStars[era] || {};
      for (const rec of Object.values(map)) {
        if (rec?.vault) vaultCount++;
      }
    }
    return Math.max(vaultCount, this.state.vaultsCracked || 0);
  }

  recordTowerClear(data = {}) {
    const isCasualRun = Boolean(data.casual || data.runType === 'endless_casual');
    const era = data.era === 'original' ? 'original' : 'reboot';
    const towerId = Math.max(1, Math.floor(Number(data.towerId) || 1));

    const newlyUnlockedSkins = [];
    const newlyUnlockedTrophies = this.drainPendingTrophies();
    const tryUnlockMilestoneTrophy = (trophyId) => {
      const unlocked = this._unlockTrophyNoSave(trophyId);
      if (unlocked) newlyUnlockedTrophies.push(unlocked);
    };

    if (isCasualRun && data.clear) {
      tryUnlockMilestoneTrophy('first_topple');
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

    const isCampaign =
      !data.runType || data.runType === 'reboot_campaign' || data.runType === 'original_campaign';

    const prev = isCampaign ? this.getTowerStars(era, towerId) : normalizeStarRecord({});
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

    if (isCampaign && towerId >= 1 && towerId <= 8) {
      this.state.towerStars[era][String(towerId)] = stars;
    }

    const tryUnlockMilestoneSkin = (skinId) => {
      if (!this.isSkinUnlocked(skinId)) {
        this.state.unlockedSkins.push(skinId);
        newlyUnlockedSkins.push(skinId);
      }
    };

    const totalStars = this.getTotalStars(null);
    const rebootStars = this.getTotalStars('reboot');
    const rebootMedals = this.getTotalMedals('reboot');
    const origCleared = this._countClearedTowers('original');
    const rebootCleared = this._countClearedTowers('reboot');
    const vaultTotal = this._countVaultStars();

    if (isCampaign && era === 'reboot' && towerId === 3 && stars.clear) {
      tryUnlockMilestoneSkin('clockwork_brass');
    }
    if (isCampaign && era === 'reboot' && towerId === 4 && stars.clear) {
      tryUnlockMilestoneSkin('frost_warden');
    }
    if (vaultTotal >= 5) {
      tryUnlockMilestoneSkin('shadow_infiltrator');
    }
    if (origCleared >= 4) {
      tryUnlockMilestoneSkin('retro_1987');
    }
    if (totalStars >= 18) {
      tryUnlockMilestoneSkin('golden_toppler');
    }

    if (newlyUnlockedSkins.length > 0) {
      if (this.state.unlockedSkins.length >= 2) tryUnlockMilestoneTrophy('first_skin');
      if (this.state.unlockedSkins.length >= SKIN_CATALOG.length) tryUnlockMilestoneTrophy('wardrobe_complete');
    }

    if (totalStars >= 1) {
      tryUnlockMilestoneTrophy('first_star_core');
    }

    if (data.clear) {
      tryUnlockMilestoneTrophy('first_topple');

      if (data.zenMode || this.state.settings.zenMode) {
        tryUnlockMilestoneTrophy('zen_voyager');
      }

      if (isCampaign && era === 'reboot') {
        if (towerId === 1) tryUnlockMilestoneTrophy('mist_walker');
        else if (towerId >= 2 && towerId <= 8) tryUnlockMilestoneTrophy(`clear_reboot_t${towerId}`);

        if ((towerId === 1 || towerId === 2) && stars.speed) {
          tryUnlockMilestoneTrophy(`speed_reboot_t${towerId}`);
        }
        if (towerId === 2 && data.touchedWater === false) {
          tryUnlockMilestoneTrophy('tide_runner');
        }
        if (towerId === 4 && data.touchedWater === false) {
          tryUnlockMilestoneTrophy('wind_walker');
        }
        if (towerId === 5 && stars.vault) {
          tryUnlockMilestoneTrophy('switch_architect');
        }
        if (towerId === 6 && earnedNohit) {
          tryUnlockMilestoneTrophy('piston_dancer');
        }
        if (towerId === 7 && data.touchedWater === false) {
          tryUnlockMilestoneTrophy('blackout_beacon');
        }
        if (towerId === 8 && stars.vault) {
          tryUnlockMilestoneTrophy('vault_t8_clear');
        }
        if (
          (towerId === 2 || towerId === 4 || towerId === 6) &&
          earnedNohit &&
          Boolean(data.vault) &&
          Boolean(data.speed)
        ) {
          this._armedFlawlessSector = true;
        }
        if (data.perfectGlideBefore && earnedNohit && Boolean(data.vault) && Boolean(data.speed)) {
          tryUnlockMilestoneTrophy('flawless_sector');
        }
      } else if (isCampaign && era === 'original') {
        if (towerId >= 1 && towerId <= 8) {
          tryUnlockMilestoneTrophy(`clear_orig_t${towerId}`);
        }
        if (towerId === 1 || towerId === 4 || towerId === 5 || towerId === 8) {
          tryUnlockMilestoneTrophy('chute_breaker');
        }
        if (towerId >= 2 && earnedNohit) {
          tryUnlockMilestoneTrophy('orig_technique_perfect');
        }
        if ((data.singleRunAll8 || data.flawlessRunFromT1) && towerId === 8) {
          tryUnlockMilestoneTrophy('immortal_1987');
        }
      }

      if (data.runType === 'daily') {
        tryUnlockMilestoneTrophy('daily_try');
        tryUnlockMilestoneTrophy('daily_climber');
        if (data.speed || (data.parTime && Number(data.timeRemaining) >= Number(data.parTime))) {
          tryUnlockMilestoneTrophy('daily_speed_ace');
        }
      }
      if (data.runType === 'endless') {
        if (towerId >= 1) tryUnlockMilestoneTrophy('endless_1');
        if (towerId >= 3) tryUnlockMilestoneTrophy('endless_3');
        if (towerId >= 5) tryUnlockMilestoneTrophy('endless_5');
        if (towerId >= 15) tryUnlockMilestoneTrophy('abyssal_titan');
      }

      if (earnedNohit) {
        tryUnlockMilestoneTrophy('storm_ghost');
      }
      if (data.pacifist || (data.shotsFired !== undefined && Number(data.shotsFired) === 0)) {
        tryUnlockMilestoneTrophy('pacifist_climb');
      }
    }

    if (earnedCombo) tryUnlockMilestoneTrophy('snowball_sniper');

    for (let sIdx = 0; sIdx < 4; sIdx++) {
      const a = this.getTowerStars('reboot', sIdx * 2 + 1);
      const b = this.getTowerStars('reboot', sIdx * 2 + 2);
      if (a.count === 3 && b.count === 3) {
        tryUnlockMilestoneTrophy(`sector_${sIdx + 1}_master`);
      }
    }

    if (this._countSpeedStars() >= 3) {
      tryUnlockMilestoneTrophy('speed_demon');
    }
    if (this._countSpeedStars('reboot') >= 8) {
      tryUnlockMilestoneTrophy('chrono_olympian');
    }
    if (origCleared >= 8) {
      tryUnlockMilestoneTrophy('classic_hero');
    }
    if (rebootCleared >= 8) {
      tryUnlockMilestoneTrophy('operation_nebulus');
    }
    if (totalStars >= 24 && this.state.unlockedSkins.length >= 6) {
      tryUnlockMilestoneTrophy('nebulus_legend');
    }
    if (rebootStars >= 24 && rebootMedals >= 40) {
      tryUnlockMilestoneTrophy('nebulus_sovereign');
    }

    for (const extra of this.drainPendingTrophies()) {
      newlyUnlockedTrophies.push(extra);
    }

    this._save();
    return {
      stars: { ...stars },
      newlyUnlockedTrophies,
      newlyUnlockedSkins
    };
  }

  // ================= DAILY & ENDLESS RECORDS =================

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
    if (cleanScore > (this.state.highScores.daily || 0)) {
      this.state.highScores.daily = cleanScore;
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
    if (cleanScore > (this.state.highScores.endless || 0)) {
      this.state.highScores.endless = cleanScore;
    }
    const pushIf = (cond, id) => {
      if (!cond) return;
      const t = this._unlockTrophyNoSave(id);
      if (t) this._pendingAutoTrophies.push(t);
    };
    pushIf(depth >= 1, 'endless_1');
    pushIf(depth >= 3, 'endless_3');
    pushIf(depth >= 5, 'endless_5');
    pushIf(depth >= 15, 'abyssal_titan');
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
    if (this.state.unlockedTrophies.includes(trophyId)) {
      return null;
    }
    this.state.unlockedTrophies.push(trophyId);

    this._syncBlasterFxMilestonesNoSave();

    if (
      trophyId !== 'millennium_toppler' &&
      this.state.unlockedTrophies.length === TROPHIES.length - 1 &&
      !this.state.unlockedTrophies.includes('millennium_toppler')
    ) {
      const cap = TROPHY_BY_ID.get('millennium_toppler');
      if (cap) {
        this.state.unlockedTrophies.push('millennium_toppler');
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
      era: this.state.settings.era,
      controlMode: this.state.settings.controlMode,
      muted: this.state.settings.muted,
      musicEnabled: this.state.settings.musicEnabled,
      hapticsEnabled: this.state.settings.hapticsEnabled,
      tiltSensitivity: this.state.settings.tiltSensitivity,
      skinId: 'default_amphibian',
      blasterFxId: 'standard_cryo'
    };
    this.state = createFreshState();
    this.state.settings = preservedSettings;
    this._pendingAutoTrophies = [];
    this._armedFlawlessSector = false;
    this._save();
  }
}

export const progression = new ProgressionManager();
