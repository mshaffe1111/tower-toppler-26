# Towering Waters: Gateway's Descent

**Created by Matt Shaffer** · **Package ID:** `com.mattshaffer.toweringwaters`  
**Platform:** Android (Google Play Store Offline WebGL2 / Capacitor AAB) · Desktop & Mobile Progressive Web App  
**IP & Licensing:** 100% Original Intellectual Property · Zero External Runtime CDNs · MIT (`three@0.170.0`) & SIL OFL 1.1 Bundled Typography

---

## Story & Premise

Across Earth's great watersheds, the mechanized **Siphon Syndicate** has anchored colossal hydro-extraction spires—draining roaring canyon rivers into cracked red dust, freezing alpine mirror lakes, choking emerald bayous, bleaching sunlit coral lagoons, and churning polar seas into artificial maelstroms.

Sent from the oceanic starworld **Pelagia**, **Gateway**—an athletic, iridescent female alien hydro-lizard equipped with a pearlescent **Hydro-Conduit Harness** and guided by orbital AI navigator **Naiad**—descends through Earth's cloud layer to scale each Siphon Spire, rescue trapped native water guardians, plunge headfirst down the flooded **Central Reactor Core**, and plant **Harmonic Water Seeds** that shatter the siphons and surge living water back into every ecosystem.

---

## Flagship AAA Features

### 1. Gateway — 34-Bone Skeletal Hydro-Lizard Heroine
- **Seamless Weight-Painted `THREE.SkinnedMesh` (`assets/models/gateway.glb`):** Sculpted `1.18u`-tall agile reptilian silhouette with a `0.98u` dynamic 7-bone counter-balancing lizard tail, iridescent sea-glass teal & coral scales, blinking amber-emerald eyes with corneal catchlights, digitigrade legs, 4-fingered gecko hands, and swept-back aquatic head-frills that flare in flight.
- **14+ Baked `AnimationMixer` Clips + Procedural Bone Polish:** Smooth `0.10s–0.18s` cross-fades across `IdleBreathe`, `Walk`, `FluidRun`, `StairClimb`, `JumpCoil`, `AirRise`, `FrillGlide`, `Fall`, `Land`, `LedgeMantle`, `WallScamper`, `TailWhip`, `HydroCast`, `FreeSwim`, `RapidsSurf`, `CoreDive`, `Celebrate`, and `CutsceneHero`, enhanced with cylindrical turn-banking, 5-riser stair foot-planting, head look-at, and spring-damped tail S-waves.
- **Signature Abilities:**
  - **Hydro-Pulse Cast (`#btn-fire`):** Pressurized sea-glass water bolt that encases foes in swirling translucent Hydro-Bubble cages and triggers distant aqueduct switches.
  - **360° Lizard Tail-Whip (`#btn-whip`):** High-torque close-quarters tail sweep that flips armored `snap_crab` Dredgers upside-down into high-bounce springboards, deflects `barnacle_mortar` bubbles, spins **Wall Pipe-Valves**, and shatters Siphon Crystal Locks.
  - **8 Unlockable Sovereign Skins:** *Sea-Glass Guardian*, *Coral Reef Empress*, *Canyon Rapids Ranger*, *Alpine Glacier Mystic*, *Bayou Biolume*, *Abyssal Leviathan*, *Solar Oasis*, and *Sovereign Starlight*.

### 2. Engineered Cylindrical Hydro-Spires (`COLS = 20`)
- **Expanded AAA World Scale:** `COLS = 20` radial columns, `TOWER_RADIUS = 3.75`, and `FLOOR_HEIGHT = 1.50` world units, paired with real-time `2048×2048` `PCFSoftShadowMap` directional sunlight and sky-tinted `PMREM` environment lighting.
- **Real Walkable 5-Riser Staircases (`real_staircase.glb`):** Engineered multi-tread curved stair flights with beveled risers, non-slip nosing, side stringer beams, underside cantilever brackets, and wrought-bronze safety handrails—Gateway runs fluidly up and down stairs without forced jump-mashing.
- **Full-Height Mechanical Elevators (`mech_elevator.glb`):** Continuous twin vertical I-beam guide rails bolted to the spire, overhead pulley/winch motor housings with spinning sheaves, illuminated safety-railed cabs, moving hoist cables, and opposing counterweights.
- **Interactive Spire Mechanics:** Live **Hydro-Pipe Valve Routing** (`pipe_valve.glb`) to power lifts and raise local floodgates, **Spinning Hydro-Turbines** (`hydro_turbine.glb`), **Gecko Wall-Scamper Strips**, and aerial **Tail-Grapple Swing Rings**.

### 3. Five Living Earth Water Biomes (10 Handcrafted Campaign Spires)
1. **Act I — Redwood Canyon Rivers (`canyon_river`):** Golden morning sunbeams, layered red-rock sandstone gorges, pine-crowned mesas, cliffside waterfalls with mist rainbows, and whitewater river rapids.
2. **Act II — Crystal Alpine Mirror Lakes (`alpine_lake`):** High-altitude azure skies, rose-gold alpenglow across snow-capped granite peaks, stone aqueducts, and glassy cobalt-turquoise mirror water.
3. **Act III — Emerald Mist Bayous (`mist_bayou`):** Warm amber-violet twilight, moss-draped cypress arches, sunken limestone temples, golden fireflies, and glowing lotus lily channels.
4. **Act IV — Sunlit Tropical Coral Seas (`coral_sea`):** Radiant noon cumulus skies, white-sand palm atolls, limestone sea-arches, and crystal-clear turquoise lagoons revealing underwater coral shelves and gliding manta rays.
5. **Act V — Polar & Tempest Deep Oceans (`storm_ocean`):** Shimmering emerald-violet polar aurora curtains, translucent turquoise icebergs, forked storm lightning, and a colossal maelstrom vortex around the Mother Siphon.

### 4. Six Non-Redundant Game Modes
| Mode ID | Display Title | Core Ruleset & Experience |
| :--- | :--- | :--- |
| `campaign` | **Story Campaign (*Gateway's Descent*)** | 5-Act narrative across 10 handcrafted spires, bespoke Gateway/Naiad/Guardian cutscenes, Reactor Core Descents, and live `0 → 100%` World Watershed Restoration Map. |
| `purist` | **Purist Arcade Mode** | Pure high-stakes arcade skill ruleset inside the modern 3D world: 1-hit stakes, strict Siphon countdown clock, combo score multiplier, zero mid-spire checkpoints. |
| `flood_rush` | **Flash-Flood Survival** | Relentless rising corrupted surge chases Gateway up tall procedural hydro-spires packed with geyser boosts and tail-grapple rings. |
| `sanctum_trials` | **Sanctum Puzzle Trials** | Timer-free handcrafted aqueduct logic and pipe-valve pressure-routing spires for meditative spatial mastery. |
| `expedition` | **Watershed Expedition** | Multi-spire roguelite journey across shifting biomes featuring 3-card **Bio-Mutation Drafts** (*Triple Tail-Whip*, *Gecko Sprint*, *Hydro-Jet Double Jump*, *Tidal Magnet*, *Bubble Aegis*). |
| `daily_tide` | **Daily Tide Run** | Deterministic UTC daily seeded spire and biome modifier shared by all players worldwide. |

### 5. Five Signature Gateway Mini-Games
- **`core_descent` — Reactor Core Descent:** Playable vertical dive down a spire's flooded glass-and-bronze central shaft, dodging spinning turbine blades, shattering 3 Siphon Crystal Locks, and planting the Harmonic Water Seed.
- **`reef_swim` — Coral Reef & Lakebed Free-Swim:** Gateway swims directly underwater with undulating spine-and-tail propulsion through sunlit caustic shafts to free caged sea turtles and river otters.
- **`rapids_surf` — Whitewater Rapids Tail-Surf:** High-speed canyon gorge and reef channel carving atop a living bioluminescent Hydro-Wake.
- **`frill_glide` — Canyon Updraft Frill-Glide:** Gateway flares her iridescent webbed neck and rib frills to soar through waterfall mists and golden thermal updraft rings.
- **`aqueduct_sanctum` — Ancient Aqueduct Sanctum Chambers:** Sunlit temple water-vaults with rotary brass pipe valves, crystal prism beams, and harmonic water-bell fountains.

### 6. Seven Original Articulated Enemies (`EnemyVisualPool`)
1. **`snap_crab` — Snap-Claw Dredger:** 6-legged copper-and-coral crustacean bot; flips onto its curved shell when Tail-Whipped to become a glowing Hydro-Bounce springboard.
2. **`gulp_hopper` — Gulp-Hopper Drone:** Glass-bellied amphibian siphon-bot that visibly inflates its water tank before launching elastic stair-to-stair hops.
3. **`volt_eel` — Conduit Volt-Eel:** 8-segment sinuous electric moray slithering in true S-waves along wet walls and staircases.
4. **`rail_skater` — Riptide Rail-Skater:** Twin-impeller water-strider drone carving bright aqua hydro-jet wakes.
5. **`barnacle_mortar` — Barnacle Geyser-Mortar:** 5-petal armored reef turret with pressure-glow telegraphs and deflectable water-sludge bubbles.
6. **`vent_stalker` — Thermal Vent-Stalker:** Sleek cryo/steam crawler venting frost crystals and rising thermal plumes.
7. **`siphon_warden` — Siphon Warden Leviathan-Mech:** Multi-segment armored Act Boss with rotating siphon core and shield-plate phases.

### 7. Studio-Mastered Acoustic `.ogg` Audio & 3-Bus Mixer
- Long-form evolving studio `.ogg` acoustic/ambient stems (`marimba`, `kalimba`, `felt piano`, `bamboo flute`, `cello`, warm pads) paired with natural stereo river, alpine lake, bayou, coral surf, and deep ocean soundscapes (`assets/audio/*.ogg`).
- 6-variation round-robin wet-stone/wood footsteps, silky water/air whooshes, pentatonic harmonic chimes, and independent **Music / Water Ambience / SFX** volume sliders.

---

## 100% Offline Bundle & Google Play Store Setup

Every runtime dependency is vendored locally in the repository—**zero external CDN requests** (`three@0.170.0` in `vendor/three/` and SIL OFL `.woff2` fonts in `assets/fonts/`):

```text
├── index.html                  # Offline importmap, local fonts.css & manifest link
├── styles.css                  # Responsive Android/Tablet/Desktop hydro-glass UI
├── manifest.webmanifest        # Fullscreen offline PWA / TWA manifest
├── capacitor.config.json       # Capacitor Android config (com.mattshaffer.toweringwaters)
├── package.json                # CLI scripts & glTF / Capacitor tooling
├── vendor/three/               # Local three@0.170.0 build + examples/jsm addons
├── assets/
│   ├── fonts/                  # Local .woff2 families + fonts.css + OFL.txt
│   ├── models/                 # Gateway 34-bone SkinnedMesh, staircases, elevators & foes
│   ├── audio/                  # Studio-mastered .ogg music & biome water ambiences
│   └── textures/               # Baked PBR normal, roughness & scale maps
├── src/                        # Modular ES2022 WebGL2 engine, physics & 6 modes
└── docs/                       # Architecture Contract, Google Play Packaging & Audits
```

### Run Locally (100% Offline Static Server)
```bash
npm run serve
# Opens http://localhost:8080 (works cleanly in Airplane Mode / zero internet)
```

### Build Android App Bundle (`.aab`) for Google Play Store
See [docs/GOOGLE_PLAY_PACKAGING.md](docs/GOOGLE_PLAY_PACKAGING.md) for the complete Capacitor Android Studio & Play Console release workflow.
