# TOWER TOPPLER '26 — SURGICAL GRAFT PLAN ONTO `origin/main` (`e42c3da`)
**Status:** Authoritative Master Blueprint (#130 + #132 Visual-Proof-First Gate)  
**Foundation:** `origin/main` (`e42c3da`) — 61 KB instanced beveled `arcSlab` masonry (`props.js`), 15 KB planar-reflecting GLSL Fresnel `Ocean` (`water.js`), 214 KB caustic/boid submarine engine (`subStage.js` + `subRenderer.js`), 230 KB hang-glider (`glideStage.js` + `glideRenderer.js`), 186 KB Rune Sanctums (`puzzleRoom.js` + `puzzleRenderer.js`), 142 KB 3D enemies (`enemyModels.js`), 10-World / 50-Tower Campaign (`worlds.js` + `towergen.js`), and 8 real cell-for-cell 1987 towers (`realTowerData.js` + `realTowers.js`).  
**Mandatory Gate (#132):** **VISUAL PROOFS PASS FIRST BEFORE ANY FURTHER GAMEPLAY/UI WIRING.** `@renderer` and `@glide_puzzle` pull `origin/main`'s 3D `arcSlab` `InstancedMesh` blocks (`props.js`/`materials.js`), planar-reflecting `Ocean` (`water.js`), and 179 KB `subRenderer.js` (+ `sub-stage-upgrade.patch`) directly alongside `@blender_artist`'s 17 `.glb` models (`#131`) so `@visual_qa` can capture `2x` Retina Visual Proof PNGs (A: Moonlit Storm 3D-Block Tower + Reflective Ocean, B: Multi-Material 3D-Block Towers + 2008 Original HD, C: Living-Caustics/Boid Reboot Manta-Submarine, D: Sky-Wing Glide + Flooded 3D Rune Sanctum) for side-by-side sign-off against `origin/main` and `media_1794856383556_f193848e.jpg`!

---

## 1. Exact Git Backup, Reset & Asset Restoration Sequence

Execute **ONLY** after all currently running workers finish their turns:

```powershell
# 1. Archive current cleanroom build + all 17 Blender .glb models onto backup branch
git checkout -b cleanroom-modules-v1
git add -A
git commit -m "Archive cleanroom modules, Blender 5.3.0 GLBs, and design specs"

# 2. Reset main cleanly onto origin/main (e42c3da)
git checkout -B main origin/main

# 3. Restore our Blender 5.3.0 GLB assets, build script, and reference design docs
git checkout cleanroom-modules-v1 -- assets/models tools/build_blender_models.py docs/REBOOT_2026_DESIGN.md docs/ORIGINAL_DESIGN.md

# 4. Apply origin/main's unapplied SubRenderer/SubStage polish patch (_precompile, DOF clamp, surfacing splash)
git apply docs/wip/sub-stage-upgrade.patch
```

### Preserved Blender 5.3.0 `.glb` Manifest (`assets/models/*.glb` — 17 Models)
| Category | Files Restored from `cleanroom-modules-v1` | Target Renderer(s) on `origin/main` |
| :--- | :--- | :--- |
| **Hero Rig** | `pogo.glb` (985 KB V2 sculpt: radial emerald/amber iris, mottled amphibian SSS skin, stitched leather harness, brass buckles, explorer pack) | `src/pogo.js` → shared across `renderer.js`, `puzzleRenderer.js`, `subRenderer.js`, `glideRenderer.js`, `skimmerRenderer.js` |
| **Tower Props** | `cage_elevator.glb` (22.9 KB), `corbel_ledge.glb` (35.0 KB) | `src/props.js` (`buildLiftPod` / `buildLiftTrack` / `buildLedge` in Reboot) |
| **Enemies** | `enemy_eye.glb` (78.3 KB), `enemy_molecule.glb` (30.6 KB), `enemy_roller.glb` (17.0 KB), `enemy_bouncer.glb` (20.1 KB), `enemy_robot.glb` (21.5 KB) | `src/enemyModels.js` (Reboot detail meshes / procedural fallback) |
| **Submarine** | `reboot_sub_mk7.glb` (49.0 KB Manta-Sub: `RebootSubRoot` → `manta_hull`, `nose_dome`, `pilot_seat` at `(0.36,-0.18,0)`, `thrusterL/R`, `torpedo_pods`), `mk7_sub.glb` (43.5 KB), `alien_fish_1.glb` & `alien_fish_2.glb` (`body`, `pectoralL/R`, `tail_fin`), `sea_mine.glb` (`mine_body`, `horns`), `warp_cavern.glb` (`basalt_arch`, `amethyst_crystals`, `portal_throat`) | `src/subRenderer.js` |
| **Sky & Surface** | `sky_glider.glb` (83.5 KB: `wing_sail`, `spar_frame`, `boost_jets`, `trapeze_frame`, `grip_bar` at `(0.36,-0.92,0)`), `hydro_skimmer.glb` (28.5 KB), `puzzle_props.glb` (92.2 KB: `temple_bell` w/ `bell_body`, `prism_mirror` w/ `mirror_turret`, `push_monolith`, `sanctum_brazier`) | `src/glideRenderer.js`, `src/skimmerRenderer.js`, `src/puzzleRenderer.js` |

---

## 2. Pillar 1 — Explorer Pogo V2 Everywhere (`src/pogo.js` + `src/settings.js`)

Replace `origin/main`'s SDF bean-frog (`src/pogo.js`) with our approved **33-Bone Skeletal IK Explorer Pogo V2 + `assets/models/pogo.glb`** from `cleanroom-modules-v1:src/pogo.js`, implementing these **5 mandatory `origin/main` compatibility adapters** so every caller (`renderer.js`, `puzzleRenderer.js`, `towerFx.js` ghost, `subRenderer.js`, `glideRenderer.js`) works out-of-the-box:

1. **Constructor Signature Adapter (`ghost` & `skinId`):**
   - `origin/main:src/renderer.js` calls both `new PogoRig()` and `new PogoRig({ ghost: true })` (for ghost run replays!).
   - `constructor(optsOrSkin = 'default_amphibian')`: accept either a `string` (`skinId`) or `{ ghost = false, skinId = 'default_amphibian' }`. When `ghost === true`, apply a translucent additive cyan-emerald ghost shader (`opacity: 0.36`, `depthWrite: false`) across all rig meshes and skip loading duplicate `.glb` lights.
2. **Root Scale & Forward Axis Calibration (`STEP_REBOOT = 0.28` / `STEP_ORIGINAL = 0.43`):**
   - `origin/main:src/renderer.js` scales `pogoGroup` via `0.72 * (FH / 0.36) * ((state.original ? 2.0 : 2.1) / 2.0)` (`~0.588` at `FH = 0.28`) and rotates `pogoGroup.rotation.set(player.hang ? -0.25 : 0, pTheta, 0)`.
   - Normalize `PogoRig` local geometry so feet sit flush at `y = 0`, crown sits at `y = 1.00`, and `facing = 1` faces `+X` (with internal `0.38 rad` 3/4 camera hero turn when `facing = ±1`), matching `origin/main`'s exact `2.0–2.1` brick-row silhouette height and ledge/head-bump clearance (`POGO_VIS_H_REBOOT = 2.05`)!
3. **`lanternWorld(outVec3)` Method:**
   - `origin/main:src/renderer.js` calls `this.pogoRig.lanternWorld(this.lantern.position)` on `dark` twist towers (World 5 *Lantern Night*). Implement `lanternWorld(out)` returning the world position of Pogo's glowing backpack cryo-lantern cell (`bones.backpack`).
4. **Superset `update(dt, s)` Pose State:**
   - Support all `origin/main` state fields seamlessly alongside our skeletal IK:
     - `s.muzzle || s.muzzleFlash` → right-arm Cryo-Blaster aim + slide recoil + muzzle flash
     - `s.charge` (`0..1`) → dual-hand cryo-orb charge glow at blaster nozzle
     - `s.hang` (`boolean`) → arms raised gripping ledge lip (`y + 0.3`), legs dangling with subtle kick
     - `s.pound` (`boolean`) → tucked meteor ground-pound pose
     - `s.teeter` (`boolean`) → single-foot edge balance windmill
     - `s.celebrate || s.victory` & `s.emote` → summit fist-pump / joy animation
     - `s.danger`, `s.dangerDir`, `s.dangerUp` → dynamic head/eye tracking toward nearest enemy!
     - `s.frozen` / `s.dark` → frost shell tint / illuminated backpack lantern
5. **Unified 8 Skins + 6 Cryo-Blaster FX (`src/settings.js` + `renderer._applySkin`):**
   - Expand `SKINS` in `src/settings.js` to our **8 Unlockable Skins** (`default_amphibian` [alias `'classic'` for save compatibility], `deep_diver`, `poison_dart`, `clockwork_brass`, `frost_warden`, `shadow_infiltrator`, `retro_1987`, `golden_toppler`) + **`BLASTER_FX_CATALOG`** (`cryo_cyan`, `plasma_violet`, `solar_amber`, `emerald_venom`, `void_crimson`, `prismatic_star`), unlockable via **Medals OR Golden Gears**!
   - Update `renderer._applySkin(group, skin)` to call `this.pogoRig.setSkin(skin.id)` and `this.pogoRig.setEraStyle(state.original ? 'original' : 'reboot')`.
   - In `PuzzleRenderer`: update `root.rotation.y = this._pogoYaw - 0.38` so Pogo V2 faces his exact walking vector in Sanctums.
   - In `SubRenderer` & `GlideRenderer`: place Pogo V2 (head/torso/arms synced to `currentSkin()`) inside the submarine glass canopy and clipped into the `sky_glider.glb` leather hang-harness!

---

## 3. Pillar 2 — Moonlit Storm Reference Tower & 2008 XBLA Original Look (`src/props.js`, `src/materials.js`, `src/water.js`, `src/renderer.js`, `src/postfx.js`)

Keep 100% of `origin/main`'s individually beveled 3D `InstancedMesh` `arcSlab` masonry, curved `arcSlab` ledges, and planar-reflecting GLSL `Ocean`, while grafting our two target era aesthetics:

### 3.1 Reboot Mode (`!state.original`) — Reference-Photo "Moonlit Storm" Upgrade
1. **New Signature `'moonlit_slate'` Material Theme (`src/props.js` & `src/materials.js`):**
   - Used on **World 1 (*Watchtower of the Mist*, formerly *Sunrise Shoals*)** and storm worlds:
   - Deep weathered indigo/purple-slate `arcSlab` courses (`colors: ['#242546', '#2e3159', '#393d6c', '#1e203b', '#333663']`, `mortar: '#0b0c1a'`, wet-stone specular `roughness: 0.38`, `normal: 1.45`, silver-blue rim `hi: '#cfe4ff'`).
   - **Moss Patches, Rusty Iron Pipes & Corbel Brackets (`buildTowerBody` & `buildLedge`):**
     - Instanced olive/emerald 3D moss tufts (`#2d5029`, `#436e39`) tucked along mortar joints and ledge corners.
     - Vertical dark-iron flanged pipes (`#282b36`, rust `#5c3a27`, steel rivets) bolted across masonry courses.
     - Underside carved stone corbels (`corbel_ledge.glb` or curved stepped `arcSlab` corbel brackets) beneath Reboot `solid` ledges.
   - **Misty Ashlar Stone Doorways & Spark-Showering Side Tunnels (`buildDoor`):**
     - Stepped ashlar stone quoins + keystone arch around dark portals with drifting threshold mist sprites; non-exit shortcut tunnels intermittently shower bouncing warm-amber welding sparks (`#ffb84d`).
   - **Warm Golden-Amber Cage Elevators (`buildLiftTrack` & `buildLiftPod` when `!original`):**
     - Mount `cage_elevator.glb` (or instanced wrought-iron/brass cage car) suspended by **twin taut vertical steel cables** running up to a wrought-iron cantilever bracket + **glowing `#ffaa33` golden-amber ceiling halo ring** + warm `PointLight('#ffb84d', 1.6, 4.5)`!
2. **Moonlit Storm Sky, Veiled Cratered Moon, 80 Fireflies & White-Foam Swells (`renderer.js`, `towerFx.js`, `water.js`):**
   - Set World 1 / Storm `TOD_KEYS` baseline to **Moonlit Storm Night** (deep midnight-slate sky `#060b16` → `#122138`, upper-right cratered silver-blue moon behind drifting rim-lit storm clouds, raking `#cfe4ff` key moonlight + `#38bdf8` ocean bounce).
   - Add **80 drifting cyan-mint/emerald fireflies** (`#5efce8`, `#42f5aa` using soft radial glow texture) in `TowerFx`.
   - Tune `water.js` storm preset for deeper abyssal slate-teal swells (`#071522` / `#13314a`) with heightened frothy **white sea-foam collar & wispy sea-mist** crashing against the basal stonework!
   - Default `settings.diorama = false` in `settings.js` (still toggleable in Options › Video!) so the moonlit clouds, tower crown, and crashing sea foam render 100% crisp like `media_1794856383556_f193848e.jpg`, while keeping `PostFX` selective bloom (`threshold: 0.80, strength: 0.36`).

### 3.2 Original Mode (`state.original === true`) — Crisp 2007–2010 XBLA/PSN HD Arcade Look
- Keep `origin/main`'s exact 7800 geometry & proportions (`STEP_ORIGINAL = 0.43`, `ORIGINAL_STEP_OPTS`, `FOV = 18°`, classic telescopic disc lifts, all 8 cell-for-cell `realTowerData.js` towers).
- Upgrade Original brick & ledge materials in `props.js` / `renderer.js` to **glossy 2008 HD Arcade finish**: clean chamfered jewel-toned bricks (`roughness: 0.25, metalness: 0.16`, zero moss/rust/pipes), crisp studio 3-point rim lighting (`exposure: 1.08`), starry arcade twilight horizon, and candy-gloss/chrome `enemyModels.js` shaders!

---

## 4. Pillar 3 — All 5 Mini-Games & Secret Sanctums Upgraded

1. **MK.7 Sub-Hunter (`src/subStage.js` + `src/subRenderer.js` — 214 KB Base + Patch):**
   - **Original Mode (`original === true`):** Pure `14s` 1987 two-step **Bubble-Encase (`FIRE`) → Hull-Collect** fish schools (`0` mines, `0` jellies, classic yellow MK.7 sub).
   - **Reboot Mode (`!original`):** Swap in sleek **`reboot_sub_mk7.glb` Manta-Sub** (`alien_fish_1.glb` / `alien_fish_2.glb` / `sea_mine.glb` / `warp_cavern.glb` enrichments), decouple **`FIRE` = Cryo-Encase Torpedo** (encases fauna & shatters mines for `+1` Gear) from **`JUMP`/Flick = Abyssal Sonar Ping** (`3.5s` cooldown cyan sonar ring freezing nearby mines & revealing sunken Gear caches), add **Hydrothermal Bubble Vents**, and upper **Bioluminescent Warp Cavern** granting a start-of-tower Cryo-Shield!
2. **The Glide (`src/glideStage.js` + `src/glideRenderer.js` — 230 KB Base):**
   - Integrate **`sky_glider.glb`** wing + **Explorer Pogo V2** in leather harness (`currentSkin()`), add `'moonlit_storm'` sky theme, dual-read `analogX ?? axisX` / `analogY ?? axisY`, and award Golden Gears on Golden Lanterns & `4×` Ring Gate chains!
3. **Rune-Door Secret Sanctums (`src/puzzleRoom.js` + `src/puzzleRenderer.js` — 186 KB Base):**
   - Wire 33-bone **`PogoRig` V2**, integrate **`puzzle_props.glb`** (braziers, runic pillars, mirror pedestals), pull `PuzzleRenderer` camera ~18% closer over wet reflective ashlar stone, and preserve exterior tower-wall clues (`props.js:buildClue`)!
4. **Hydro-Skimmer Run (`src/skimmerStage.js` + `src/skimmerRenderer.js`) & Core Lock Astrolabe Vault (`src/vaultStage.js` + `src/vaultRenderer.js`):**
   - Extract our zero-allocation **3D Hydro-Skimmer Wave-Slalom** (`hydro_skimmer.glb`, moonlit foam wave-ramps, `1×→4×` Boost Gates) and **3-Ring Engraved Astrolabe Core Lock Vault** (`door.vault = true` — already styled in `origin/main:src/props.js:buildDoor`!) into clean standalone stage/renderer pairs sharing `renderer.webgl`, playable on odd/even world transitions, behind `vault` doors, AND from the new **Title Mini-Games Arcade (`#overlay-minigames`)**!

---

## 5. Pillar 4 — 4-Mode Concise Touch Controls & Solver-Verified Weighty Physics

### 5.1 Concise 4-Mode Controls (`src/input.js`, `src/controls.js`, `src/options.js`)
Upgrade `origin/main`'s multi-source `InputController` (`_sources` Set architecture) so `OPTION_TABS` › Controls offers **all 4 precision modes**:
1. **`'slide'` (Tuned Gesture — Default):**
   - Horizontal drag → proportional `axisX` (`-1..+1`) with `12px` instant reversal re-anchoring.
   - **Controlled Slide UP** (`dy <= -26px`, upward speed `< 680 px/s` OR held `>= 105ms` without flick impulse) → holds **`up` ONLY** (`_hold('up', src, true)`). Enters doors/rune-sanctums/vaults and rides lifts UP—**NEVER triggers `jump`!**
   - **Fast Upward FLICK** (`dy <= -20px` within `<= 115ms` AND `velocityY <= -720 px/s`) → triggers **`jump` ONLY** (variable jump height on quick release).
   - **Quick Stationary TAP** (`<= 195ms`, `< 12px` travel) → pulses **`fire`**; **Hold Still (`320ms`)** → charges Cryo-Shot; **2nd Finger Hold** → **`rewind`**.
2. **`'buttons'` (Virtual Joystick + Ghosted Buttons):** Floating/fixed `#stick-zone` + hairline ghosted `JUMP`, `FIRE`, `REWIND` + `ControlEditor`.
3. **`'dpad'` (Classic 4-Way D-Pad + Ghosted Buttons):** Cardinal 4-way slide-tracking D-Pad mode + `JUMP`, `FIRE`, `REWIND`.
4. **`'tilt'` (Calibrated Motion Tilt):** Graft `DeviceOrientationEvent` roll steering (`requestTiltPermission()`, `calibrateTilt()` action row in `options.js` & Pause overlay, `2.5°` deadzone, `tiltSensitivity`) driving `this.state.axisX` + split-screen/button Jump & Fire!

### 5.2 Solver-Verified Weighty Reboot Physics (`src/game.js`)
- **Original Mode (`this.original === true`):** Keep `origin/main`'s sourced 1987 `ARC_JUMP`, `ARC_CLIMB`, `ARC_TUMBLE`, `origWalkSpeed = 2.0`, and `PORT_TICK = 1/32` **100% untouched**!
- **Reboot Mode (`!this.original`):** Upgrade `PHYS` to a **3-phase asymmetric heavy gravity curve** mathematically calibrated to `origin/main`'s row-grid (`STEP_REBOOT = 0.28`) and `towergen.js:rebootReach(dx, dy)`:
  - `walkSpeed: 3.1`, `airSpeed: 5.1`
  - `jumpVy: 8.4`, `gravityUp: 26.0` (`vy > 0.8`), `gravityJumpCut: 44.0` (when `jump` released early), `gravityApex: 19.0` (`|vy| <= 0.8`), **`gravityDown: 38.0`** (`vy < -0.8` — **1.46× heavier fall!**), `maxFall: 16.0`.
  - **Mathematical Proof for `rebootReach`:** Apex is `8.4² / (2 × 26.0) = 1.36 rows`—comfortably clearing `+1`-row ledges while **strictly `< 2.0` rows** (so Pogo NEVER sequence-breaks `+2`-row barriers on any of the 50 World Campaign towers!), and `airSpeed = 5.1` clears `dx <= 4` at `dy = 0..+1` and `dx <= 5` at `dy < 0` with generous margin!
  - Decouple `jumpAtDoor` when `scheme === 'slide'` so jumping past a doorway never sucks Pogo inside unintentionally; entering doors uses `up` cleanly!

---

## 6. Pillar 5 — 10-World Campaign + Cutscenes, Endless Casual Expeditions, 100 Trophies (`1,000 pts`), Reference HUD & Dual-Era Audio

1. **10-World (50-Tower) Campaign + In-Engine 3D Cutscenes (`worlds.js`, `renderer.js`, `main.js`):**
   - Retheme World 1 in `src/worlds.js` to **Watchtower of the Mist** (`materials: ['moonlit_slate', ...]`, `scenery: 'islands'`) so the first Reboot climb immediately matches the Reference Photo!
   - Graft `#overlay-cutscene` (letterboxed story transmissions + `[SKIP]`) and `state.cutsceneCam` smooth 3D crane-orbit sweeps in `renderer.js` for Campaign Prologue, World Summit transitions, and Victory Epilogue.
2. **Endless Casual Expeditions (`src/towergen.js`, `src/props.js`, `src/game.js`, `src/main.js`):**
   - Add **`ENDLESS CASUAL`** (*Zero Foes • Craft • Treasure • Curios*) on `#overlay-title` alongside `DAILY TOWER` and `ENDLESS`.
   - Uses `makeGeneratedTower` (`100%` `solveGrid` verified!) with `enemies = []`, `clock = false`, buoyant sea rescue, and rolls our 4 exploration missions: `'tower_repair'` (3 Salvage Parts → 3D Tinker Workbench → Summit Beacon), `'treasure_hunt'` (3 Compass Keys → 3D Hinged Sunken Chest), `'curio_survey'` (4 Astrolabe Curios), and `'puzzle_architect'` (guaranteed Rune Sanctum)!
3. **100 Trophies (`1,000 pts` Gamerscore), Gears, Relics & Curios (`src/trophies.js`, `src/settings.js`):**
   - Expand `origin/main`'s 81 `TROPHIES` cleanly to **100 Trophies totaling exactly `1,000 pts`** (`bronze: 5`, `silver: 10`, `gold: 20`, `platinum: 50`), adding Golden Gears (`progress.gears`), `RELIC_TABLETS` (`8` lore codex entries), `CURIO_CATALOG` (`12` blueprints), and bespoke SVG category icons (zero emoji slop!).
4. **Reference-Photo Top HUD & Minimal Ghosted Controls (`index.html`, `styles.css`, `src/main.js`):**
   - Style `#hud` to match `media_1794856383556_f193848e.jpg`: full-bleed transparent viewport; Top-Left `PLAYER ONE` (`#7be8ff`) + `00004520` + cyan **Alien-Frog Head SVG life icons**; Top-Center `TIME` + glowing yellow `092` + **Depleting SVG Circular Ring (`#timer-ring-arc`)**; Top-Right ghosted `HIGH SCORE`; bottom hairline translucent ghosted touch controls (`rgba(226,242,255,0.24)` idle); and replace remaining emoji glyphs in `index.html`/`options.js`/`trophies.js` with razor-sharp inline SVGs!
5. **Dual-Era Audio (`src/audio.js` — 103 KB Base):**
   - Keep `origin/main`'s 8-theme height-layered stem engine, underwater low-pass filter, and rewind tape-bend `ConstantSourceNode`; add `setEra('original' | 'reboot')` switching Original climbs to a dry, punchy **2008 XBLA / C64 arpeggio arcade voice** while adding `sonarPing()`, `workbenchCraft()`, `chestOpen()`, and storm-surf ambience in Reboot!

---

## 7. Conflict-Free Parallel Worker Slice Matrix (Post-Reset)

Once `@coordinator` runs the §1 Git Reset onto `origin/main` (`e42c3da`):

| Worker | Owned Files (Strict Non-Overlapping) | Graft Assignment |
| :--- | :--- | :--- |
| **`@pogo_rig`** | `src/pogo.js` | Port 33-bone IK Explorer Pogo V2 + `pogo.glb` + 8 Skins + 6 Blaster FX with all 5 §2 `origin/main` adapters (`ghost`, `lanternWorld`, `FH` height, superset `update`). |
| **`@tower_art`** | `src/props.js`, `src/materials.js`, `src/water.js`, `src/towerFx.js`, `src/postfx.js`, `src/renderer.js`, `src/enemyModels.js` | Add `'moonlit_slate'` moss/pipes/corbels, `cage_elevator.glb` amber lifts, veiled moon + 80 fireflies + frothy storm swells, 2008 XBLA HD Original shaders, 3D Workbench/Chest props, `cutsceneCam`, and `.glb` enemy enrichments. |
| **`@minigames`** | `src/subStage.js`, `src/subRenderer.js`, `src/glideStage.js`, `src/glideRenderer.js`, `src/puzzleRoom.js`, `src/puzzleRenderer.js`, `src/skimmerStage.js`, `src/skimmerRenderer.js`, `src/vaultStage.js`, `src/vaultRenderer.js` | Upgrade all 5 mini-games (`reboot_sub_mk7.glb` + Sonar + Vents + Warp Cavern; `sky_glider.glb` + Pogo V2; `puzzle_props.glb` + closer camera; Hydro-Skimmer & Core Lock Vault). |
| **`@gameplay`** | `src/game.js`, `src/worlds.js`, `src/campaign.js`, `src/towergen.js` | Graft §5.2 solver-verified weighty Reboot `PHYS`, decoupled door `up`, World 1 *Watchtower of the Mist*, Endless Casual Expeditions (Craft/Chest/Curios), and Skimmer/Vault/Arcade hooks. |
| **`@controls_prog`** | `src/input.js`, `src/controls.js`, `src/options.js`, `src/settings.js`, `src/trophies.js`, `src/audio.js` | Graft §5.1 4-Mode Controls (Flick-Jump vs Slide-Up-No-Jump, Tap-Fire, Joystick, D-Pad, Tilt), 8 Skins + 6 Blaster FX + Gears + Relics/Curios, 100 Trophies (`1,000 pts`), `diorama: false` default, and Dual-Era Audio. |
| **`@ui`** | `index.html`, `styles.css`, `styles-landscape.css`, `src/main.js` | Full-bleed Reference-Photo HUD (`PLAYER ONE` + frog-head SVGs + `TIME 092` circular SVG ring), hairline ghosted touch controls, `#overlay-minigames` (5 games), `#overlay-cutscene`, `ENDLESS CASUAL` card, Wardrobe/Relic/Curio tabs, and 100% bespoke inline SVGs. |
