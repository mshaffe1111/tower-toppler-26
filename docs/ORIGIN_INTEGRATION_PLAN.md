# TOWER TOPPLER '26 — `origin/main` (`e42c3da`) CHERRY-PICK & NEXT-GEN INTEGRATION PLAN
**Status:** Authoritative Delta Specification (Builds ON TOP of `docs/ARCHITECTURE_CONTRACT.md` & `docs/REBOOT_2026_DESIGN.md`)  
**Architecture Rule (#89):** **KEEP our current Next-Gen codebase as the primary engine!** Do **NOT** checkout or overwrite our WebGL2 PBR renderer, Blender 5.3.0 `.glb` pipeline (`assets/models/*.glb`), 33-bone IK `PogoRig`, 4-mode `InputController`, Studio DSP `SoundEngine`, or bespoke SVG UI with `origin/main`. Instead, extract and upgrade `origin/main`'s best gameplay/progression inventions cleanly into our modular Next-Gen architecture.

---

## 1. Audit Summary of `origin/main` (`e42c3da`) — What to Cherry-Pick vs. Keep Next-Gen

| Subsystem | What `origin/main` (`e42c3da`) Has | Integration Decision |
| :--- | :--- | :--- |
| **3D Engine, `.glb` Models & Skeletal Pogo** | Procedural SDF bean-frog with knitted scarf (`sculpt.js` + `pogo.js`), toy-diorama tilt-shift (`postfx.js`), daytime horizon themes. | **KEEP OUR NEXT-GEN BUILD:** Keep our Reference-Photo moonlit storm renderer (`src/renderer.js`), 10 Blender `.glb` assets (`pogo.glb`, `cage_elevator.glb`, `corbel_ledge.glb`, `enemy_*.glb`, `mk7_sub.glb`, `hydro_skimmer.glb`), and 33-bone amphibian `PogoRig` (`src/pogo.js`) with leather harness, explorer pack, and 8 skins. |
| **Touch Controls & Character Physics** | Slide-push-up jumps *and* enters doors (`_updateSlide` in `origin/main:src/input.js`), causing accidental jumps near doors/lifts; slower symmetric jump (`vy=7.3, g=22`). | **KEEP OUR NEXT-GEN BUILD:** Keep our weighty 3-phase asymmetric Reboot physics (`jumpVy=9.5, gUp=24.5, gDown=37.0`) and 4-mode `InputController` (`'gesture'` where horizontal slide walks, slide-up enters doors/lifts ONLY and **never** jumps, fast upward FLICK jumps, quick TAP shoots; `'joystick'`; `'dpad'`; `'tilt'`). |
| **Hang-Glider Inter-World Ride (*The Glide*)** | `src/glideStage.js` (50 KB) + `src/glideRenderer.js` (179 KB): 22s 3D sky-glide with dive/climb energy physics, thermals, wing-flap, lantern strings, star kites, ring gates (`4×` chain), storm lightning & gulls. | **CHERRY-PICK & UPGRADE TO NEXT-GEN!** Port as `src/glideStage.js` + `src/glideRenderer.js`, upgraded with moonlit storm/aurora Reboot lighting, `POGO_SKINS` + leather harness pilot tinting, `analogX`/`analogY` 4-mode input adapter, and zero WebGL state leaks! |
| **Hidden Rune-Door Puzzle Chambers + Exterior Tower Clues** | `src/puzzleRoom.js` (57 KB) + `src/puzzleRenderer.js` (128 KB) + `props.js:buildClue`: 4 seed-generated, verified-solvable 3D torch-lit chambers (`'lights'`, `'bells'`, `'beam'`, `'blocks'`) whose solutions are painted/carved on the **outside** of the tower wall several floors away! | **CHERRY-PICK & UPGRADE TO NEXT-GEN!** Port `src/puzzleRoom.js` + `src/puzzleRenderer.js` and add `buildTowerClue(clue)` + `isRune` doorways to `src/levels.js` & `src/renderer.js`, adapting `PuzzleRenderer` to our `PogoRig` (`setSkin`, `poseState`, yaw alignment) and pausing the tower timer while inside! |
| **Campaign World Map & 5-Medal Mastery** | `src/campaign.js` + `src/worlds.js` (`#overlay-worlds` interactive progression map) + 5 per-tower style medals (`speed`, `nohit`, `explorer`, `combo`, etc.) in `settings.js`/`trophies.js`. | **CHERRY-PICK & MERGE INTO NEXT-GEN UI/PROGRESSION:** Add an interactive **Operation Nebulus Archipelago World Map (`#overlay-worlds`)** organizing our 8 bespoke Story Biomes into **4 Storm Sectors** linked by Sea Routes (*Sub-Hunter* / *Hydro-Skimmer*) and Summit Sky Routes (*The Glide*), plus 5-feat per-tower medal tracking & expanded trophies! |
| **Cell-for-Cell 1987 Original Towers** | `src/realTowerData.js`, `src/realTowers.js`, `docs/ORIGINAL-RULES.md` (authentic 1987 layouts + PICO-8/7800 measured constants). | **COVERED IN `docs/ORIGIN_CLASSIC_AUDIT.md`** (`@classic_research`) → feeds directly into `createOriginalTowers()` and `era === 'original'` physics/rules while keeping our crisp 2007–2010 HD Arcade visuals & sound! |

---

## 2. Unified 5 Mini-Games & Secret Chambers Lineup

With this integration, *Tower Toppler '26* features **5 full 3D playable Mini-Games & Secret Chambers**—experienced organically during Campaign progression **AND** playable on-demand anytime from the **Mini-Games Arcade (`#overlay-minigames`)**:

| # | Mode Key | Title | Organic Campaign Trigger | Standalone Arcade Launch | Core Gameplay & Rewards |
| :- | :--- | :--- | :--- | :--- | :--- |
| **1** | `'submarine'` | **MK.7 Sub-Hunter** | Sea route after `T1 → T2` and `T5 → T6` (and after all Original towers `T1..T7`). | `game.startMiniGame('submarine', true)` | **Original:** Pure 14s 2-step bubble-encase → hull-collect fish hunt. **Reboot:** 16s abyssal trench run with chained sea mines + secret Bioluminescent Warp Cave (`+5` Gears + Cryo-Shield). |
| **2** | `'skimmer'` | **Hydro-Skimmer Run** | Storm-surface sea sprint after `T3 → T4` and `T7 → T8`. | `game.startMiniGame('skimmer', true)` | 18s 3D chase-cam wave slalom across moonlit white-foam swells; thread cyan/gold Boost Gates (`1×→4×`), jump wave ramps for Gear arcs, blast mines. |
| **3** | `'glide'` | **The Glide (Sky-Wing)** | **Sector Summit Launch** after `T2 → T3`, `T4 → T5`, and `T6 → T7`! | `game.startMiniGame('glide', true)` | 22s 3D hang-glider flight off the toppling monolith crown across moonlit storm clouds, rising sea thermals, lantern strings, star kites, and `4×` ring gates toward the next sector island! |
| **4** | `'puzzle'` | **Rune-Door Secret Chambers** | Entering a glowing carved **Rune Door (`door.isRune = true`)** hidden on Reboot towers (`T1, T3, T5, T7` + procedural/daily). | `game.startMiniGame('puzzle', true)` (cycles/picks `'lights'`, `'bells'`, `'beam'`, `'blocks'`) | Torch-lit 3D interior stone chamber (`clock paused!`). Read the exterior mural/bell-banners on the tower wall outside to solve `'lights'` or `'bells'`, or solve `'beam'` mirrors / `'blocks'` plates inside! Awards **Explorer Star Core**, **`+15s` clock**, **`+10` Gears**, **`+1,500` pts**. |
| **5** | `'vault'` | **Core Lock Vault** | Entering a hidden **Vault Door (`door.isVault = true`)** on Reboot towers (`T2, T4, T6, T8` + procedural/daily). | `game.startMiniGame('vault', true)` | 3D concentric brass-and-amethyst astrolabe tumbler rings; tap `FIRE` at `12 o'clock` to lock all 3 rings within `12s` (`3` strikes) for **Explorer Star Core**, **`+10` Gears**, **`+1,000` pts**, and Cryo-Shield! |

*(Notice how cleanly Reboot Story Towers `T1..T8` alternate secret doors: Odd towers `T1, T3, T5, T7` hide **Painted-Clue Rune Puzzle Chambers**, and Even towers `T2, T4, T6, T8` hide **Core Lock Astrolabe Vaults**—while procedural Endless/Daily towers can spawn either!)*

---

## 3. Exact Module-by-Module Integration Contract

### 3.1 New Self-Contained Modules (`src/glideStage.js`, `src/glideRenderer.js`, `src/puzzleRoom.js`, `src/puzzleRenderer.js`)

Port these 4 files from `origin/main` (`git show origin/main:src/<file>`) with the following **mandatory Next-Gen upgrades & adapters**:

#### A. `src/glideStage.js` (Pure Logic Leaf Module — Zero Imports)
- **Exports:** `GLIDE_THEMES`, `GLIDE_STAGE_TIMING`, `GlideStage` (`start`, `resize`, `update`).
- **4-Mode Input Adapter in `update(dt, input, firePressed, fx)`:**
  - Replace `input.axisX` / `input.axisY` checks with dual-compatible reads:
    ```js
    const ax = Number(input.analogX ?? input.axisX) || 0;
    const ay = Number(input.analogY ?? input.axisY) || 0;
    ```
  - Wing-flap trigger: `firePressed` (`consumeJustPressed('fire') || consumeJustPressed('jump')`), so in Tuned Gesture mode **both a quick TAP and an upward FLICK** flap the glider wings cleanly while sliding up/down or tilting pitches climb/dive!
- **Gear Collectibles Integration:** Catching a Golden Lantern or completing a `4×` Ring Gate chain invokes `fx.addGears?.(2)` (awarding Golden Gears into `ProgressionManager`!).

#### B. `src/glideRenderer.js` (3D Scene Renderer sharing `GameRenderer.webgl`)
- **Exports:** `GlideRenderer` (`constructor(webglRenderer, opts)`, `resize(w, h, dpr)`, `setSkin(skinId)`, `setEra(era)`, `render(stage, ctx)`).
- **Next-Gen Visual Upgrades:**
  1. Add `'moonlit_storm'` as the signature Reboot sky theme (veiled silver-blue storm moon, dark indigo-slate clouds with silver rim-light, cyan/emerald firefly updraft thermals, white-foam dark ocean below—matching `media_1794856383556_f193848e.jpg`!), alongside world-specific storm/aurora/ember skies.
  2. **Pogo Skin & Leather Harness Sync (`setSkin(skinId)`):** Read skin colors from `POGO_SKINS` (`src/pogo.js`) so the hang-gliding Pogo pilot displays the player's equipped skin (`default_amphibian`, `clockwork_brass`, `golden_toppler`, etc.) and brown leather explorer harness instead of a hardcoded green/red scarf mesh!
  3. **Strict WebGL State Hygiene in `render()`:** Save and restore `gl.autoClear`, `gl.toneMapping`, `gl.toneMappingExposure`, and ensure `gl.setRenderTarget(null)` before rendering so `GameRenderer`'s `EffectComposer` + `UnrealBloomPass` never suffers state corruption on mode transitions.

#### C. `src/puzzleRoom.js` (Pure Logic + Verified Generator Leaf Module — Zero Imports)
- **Exports:** `PUZZLE_TYPES` (`['lights', 'bells', 'beam', 'blocks']`), `BELL_COLORS`, `BELL_COLOR_NAMES`, `BELL_NOTES`, `makePuzzle({ type, seed, difficulty, hideTarget })`, `isPuzzleSolvedState(p, st)`, `PuzzleRoom` (`start`, `resize`, `update`).
- **4-Mode Touch & Gesture Adapter in `update(dt, input, firePressed, fx)`:**
  - Read `const ax = Number(input.analogX ?? input.axisX) || 0; const ay = Number(input.analogY ?? input.axisY) || 0;` so Joystick, D-Pad, Tilt, AND Tuned Gesture slides (`left`/`right`/`up`/`down`) step Pogo cleanly across chamber tiles without needing jump!
  - `firePressed` (quick TAP in Gesture mode, or `FIRE`/`JUMP` button) performs the context action: stomp rune tile (`'lights'`), ring adjacent bell (`'bells'`), rotate adjacent mirror (`'beam'`), or undo last block push (`'blocks'`).

#### D. `src/puzzleRenderer.js` (3D Interior Torch-Lit Chamber Renderer)
- **Exports:** `PuzzleRenderer` (`constructor(webglRenderer, opts)`, `resize(w, h, dpr)`, `setSkin(skinId)`, `render(room, ctx)`).
- **CRITICAL `PogoRig` Next-Gen Adapter (Fixes Yaw & Pose Contract!):**
  - Import `{ PogoRig } from './pogo.js'`.
  - Instantiate `this.pogoRig = new PogoRig(skinId); this.pogoObj = this.pogoRig.group;` and expose `setSkin(skinId) { this.pogoRig?.setSkin(skinId); }`.
  - **Yaw Alignment Fix:** Unlike `origin/main`'s bean-Pogo (which baked a `-0.85` yaw offset), our 33-bone `PogoRig` faces `+X` (`facing = 1`) with an internal `0.38 rad` 3/4 hero presentation angle. Set `root.rotation.y = this._pogoYaw - 0.38;` so Pogo faces the exact direction he walks in the chamber!
  - **Pose Contract Fix:** Pass our exact `poseState` keys to `this.pogoRig.update(dt, poseState)`:
    ```js
    this.pogoRig.update(dt, {
      time,
      vx: po.speed * 0.55,
      vy: po.hopT >= 0 ? (po.hopT < 0.12 ? 5.5 : -6.0) : 0,
      facing: 1,
      onGround: po.hop < 0.03,
      onElevator: false,
      squashX: 1 + land * 0.12,
      squashY: 1 - land * 0.14,
      landImpact: land,
      muzzleFlash: acted ? 0.12 : 0,
      hurtTimer: 0,
      invuln: 0,
      enteringDoor: 0,
      victory: room.phase === 'solved',
    });
    ```
  - **Visual Polish:** Tint chamber ashlar masonry toward weathered dark indigo-slate (`#2b2d4a`) with mossy stone seams, warm flickering iron wall sconces (`#ffaa33`), dusty silver-blue moonlit slit-window shaft, and crisp bespoke typography (zero emoji characters on HUD/banners!).

---

### 3.2 Updates to Existing Next-Gen Modules

#### 1. `src/levels.js` — Rune Doors, Exterior Tower Clues & 4-Sector World Metadata
- **Rune Doors & Clues on Reboot Towers:**
  - On Reboot Towers **1, 3, 5, and 7** (and 50% of Procedural/Daily Reboot towers; the other 50% get `isVault: true`), include a secret Rune Door:
    ```js
    {
      id: 'r_t1_rune',
      col: 6,
      floor: 9,
      targetId: null,
      isExit: false,
      isVault: false,
      isRune: true,
      puzzleType: 'lights', // T1: 'lights', T3: 'bells', T5: 'beam', T7: 'blocks'
      puzzleSeed: 10101
    }
    ```
  - Export `SECTOR_WORLDS` (4 Archipelago Sectors grouping Reboot Towers `1–2`, `3–4`, `5–6`, `7–8` for the World Map, with sector names, lore blurbs, sky themes, and inter-sector `'glide'` vs intra-sector `'submarine'`/`'skimmer'` route descriptors):
    1. **Sector I — *The Drowned Watch*:** T1 *Watchtower of the Mist* → *(Sub-Hunter)* → T2 *The Sinking Reliquary* **[Summit → Sky-Glide]**
    2. **Sector II — *Smelter & Boreal Reach*:** T3 *Foundry of Steam & Iron* → *(Hydro-Skimmer)* → T4 *Gale-Force Boreal Spire* **[Summit → Sky-Glide]**
    3. **Sector III — *Arcane & Hydraulic Trench*:** T5 *Labyrinth of the Prism Core* → *(Sub-Hunter)* → T6 *Tidal Piston Rig* **[Summit → Sky-Glide]**
    4. **Sector IV — *Maelstrom Core*:** T7 *Blackout Tempest Citadel* → *(Hydro-Skimmer)* → T8 *Apex of Nebulus* **[Final Topple]**

#### 2. `src/renderer.js` — Rune Door Archways, Exterior Tower Clues & Sub-Renderer Dispatch
- **Exterior Architectural Clues (`tower.clue`) & Rune Doors (`door.isRune`):**
  - When `_getOrBuildTowerGroup(tower)` sees a door with `door.isRune === true`, frame the stone doorway with a **glowing carved runic keystone ring & floating cyan/emerald rune sigil** (dims cleanly once `door.solved === true`).
  - When `tower.clue` is present (`{ kind: 'lights' | 'bells', col, floor, n?, pattern?, order?, colors? }`), build and attach the 3D exterior clue plaque (`_buildTowerClue(tower.clue)` adapted from `origin/main:src/props.js:buildClue`):
    - `'lights'`: Weathered dark-slate stone relief plaque bolted onto the cylinder wall at `(clue.col, clue.floor)` displaying the `n×n` grid of glowing cyan runic tiles (`#5efce8`) vs dark unlit stone!
    - `'bells'`: Riveted brass cross-rail mounted to the masonry with gently swaying colored swallowtail banners (`BELL_COLORS`) showing the exact ringing order!
- **Delegated Rendering for `'glide'` and `'puzzle'` Modes:**
  - Instantiate (lazily or in constructor) `this.glideRenderer = new GlideRenderer(this.webgl)` and `this.puzzleRenderer = new PuzzleRenderer(this.webgl)`.
  - Forward `resize(w, h, dpr)` and `setSkin(skinId)` / `setEra(era)` to both sub-renderers.
  - Add `renderGlideScene(state)` and `renderPuzzleScene(state)`, and wire both into `renderScene(state)` when `activeMode === 'glide'` or `activeMode === 'puzzle'`.

#### 3. `src/audio.js` — Glide & Rune Chamber Acoustic Cues
- Add lightweight, zero-allocation studio Web Audio methods on `SoundEngine` (respecting `this.muted` and `this.era`):
  - **Glide SFX:** `setWind(level = 0)` (smooth bandpass storm-wind rush), `glideFlap()` (canvas sail whoosh + warm air thump), `ringChime(step = 0)` (ascending crystalline harmonic gate chime), `gust()` (swelling wind shear), `thunderClap()` (aliases/extends `thunderCrack()`).
  - **Puzzle Chamber SFX:** `puzzleEnter()` / `puzzleLeave()` (heavy stone slab & torch whoosh), `puzzleTile(lit)` (resonant stone rune stomp), `puzzleBell(semitone)` (pure pentatonic struck bronze-crystal bell!), `puzzleMirror()` (brass gear click + prism shimmer), `puzzleBlock()` (heavy stone slide on ashlar floor), `puzzlePlate()` (pressure lock chime), `puzzleUndo()` (reverse crystal sweep), `puzzleWrong()` (muted low stone thud), `puzzleSolve()` (lush major-9th chamber unlock fanfare).

#### 4. `src/progression.js` — 5-Medal Mastery & Expanded Trophies
- Preserve 100% of the existing `ProgressionManager` API (`getTowerStars`, `recordTowerClear`, `SKIN_CATALOG`, `TROPHIES`, `'tt26_save_v2'`) while enriching:
  - Track optional extra per-tower mastery medals in `recordTowerClear`: `nohit` (`hurtCount === 0`) and `combo` (`maxCombo >= 4`), exposed on `getTowerStars(era, towerId)` (`{ clear, vault, speed, nohit, combo, count }`, where `count` remains `0..3` Star Cores for skin gates + `medalsCount` `0..5` for World Map / Trophy Hall!).
  - Add 2 new trophies (bringing `TROPHIES` to **18** crisp bespoke SVG-badged achievements, or folding cleanly into the Trophy Hall):
    - `sky_rider` — **Storm Wing Ace:** Complete *The Glide* catching a Golden Lantern or `4×` Ring Gate chain.
    - `rune_scholar` — **Rune Reader:** Decipher an exterior tower clue and solve a hidden *Rune Puzzle Chamber*.

#### 5. `src/game.js` — `'glide'` & `'puzzle'` Modes + Clue Placement
- Expand `GameMode` union: `'title' | 'tower' | 'topple' | 'submarine' | 'skimmer' | 'glide' | 'puzzle' | 'vault' | 'paused' | 'gameover' | 'victory'`.
- **On `loadTower(idxOrTower)`:**
  - If the tower has a `door.isRune` door, deterministically generate `this.puzzleData = makePuzzle({ type: door.puzzleType, seed: door.puzzleSeed || (tower.id * 7919), difficulty: 0.35, hideTarget: door.puzzleType === 'lights' })`.
  - If `this.puzzleData.clue` exists, attach `this.tower.clue` `4–6` floors away and `(door.col + 6) % 16` around the cylinder on a clear wall patch so players discover the painted/carved clue while climbing!
- **Entering & Solving a Rune Door (`_enterPuzzleRoom(door)` / `_updatePuzzle(dt)`):**
  - Sliding `UP` (or pressing `UP`) at an unsolved `door.isRune` switches `this.mode = 'puzzle'` (**tower countdown timer `this.timer` is paused** while inside!).
  - Solving awards: `door.solved = true`, `this.vaultCrackedThisTower = true` (grants the tower's Explorer/Secret Star Core!), `this.timer = Math.min(this.tower.timeLimit + 15, this.timer + 15)`, `+10` Golden Gears (`progression.addGears(10)`), `+1500` Score, unlocks `rune_scholar` trophy, and steps Pogo safely back onto `(door.col + 0.5, door.floor)` with `1.8s` invulnerability!
- **Inter-Sector Summit Glide (`_updateTopple` transition & `startMiniGame('glide')`):**
  - In Reboot Campaign (`era === 'reboot'`), transition routes between the 8 towers follow the Sector Map:
    - `T1 → T2` & `T5 → T6`: *MK.7 Sub-Hunter* (`'submarine'`)
    - `T2 → T3`, `T4 → T5`, `T6 → T7` (Sector Summits!): **The Glide (`'glide'`)**
    - `T3 → T4` & `T7 → T8`: *Hydro-Skimmer Run* (`'skimmer'`)
  - `startMiniGame(type, standalone = true)` now accepts `'submarine' | 'skimmer' | 'glide' | 'puzzle' | 'vault'`!

#### 6. `index.html` + `styles.css` + `src/main.js` — Interactive World Map & 5-Game Arcade
- **Interactive Campaign World Map (`#overlay-worlds`):**
  - Accessible from the Title Screen (`WORLD MAP` / `SECTORS` button beside `LAUNCH MISSION`), displaying the **4 Storm Sectors** and all **8 Monoliths**, sea/sky route connectors (`SUB`, `GLIDE`, `SKIM`), earned Star Cores (`★★★`) & Mastery Medals, and 1-tap tower launch for unlocked sectors!
- **Upgraded Mini-Games Arcade (`#overlay-minigames`):**
  - Showcases all **5 Playable 3D Mini-Games & Secret Chambers** (*MK.7 Sub-Hunter*, *Hydro-Skimmer Run*, *The Glide*, *Rune Puzzle Chamber*, *Core Lock Vault*) with crisp inline SVG emblems (zero emoji slop!) and instant launch buttons.
- **HUD Badge Support:**
  - `#tower-badge` cleanly displays `'GLIDE'` in `'glide'` mode and `'RUNE'` in `'puzzle'` mode; `#action-prompt` displays `'UP • ENTER RUNE CHAMBER'` when Pogo stands before an unsolved Rune Door.

---

## 4. Parallel Execution Ownership Map (Zero File Collisions)

When `@coordinator` dispatches implementation workers for this delta pass, file ownership splits cleanly with zero overlap:

1. **`@glide_puzzle` (or `@minigames`):** Owns NEW files `src/glideStage.js`, `src/glideRenderer.js`, `src/puzzleRoom.js`, `src/puzzleRenderer.js` (ported from `origin/main` + upgraded to Next-Gen `PogoRig`, `POGO_SKINS`, `analogX`/`analogY`, moonlit storm visuals, and clean WebGL state hygiene).
2. **`@levels_prog`:** Owns `src/levels.js` + `src/progression.js` (`SECTOR_WORLDS`, `isRune` doors on Reboot T1/T3/T5/T7 + procedural, authentic 1987 `createOriginalTowers()` per `docs/ORIGIN_CLASSIC_AUDIT.md`, 5-medal tracking, and `sky_rider` + `rune_scholar` trophies).
3. **`@audio`:** Owns `src/audio.js` (adds Glide & Rune Puzzle acoustic SFX + any Original 2008 HD soundbank refinements from `ORIGIN_CLASSIC_AUDIT.md`).
4. **`@renderer`:** Owns `src/renderer.js` (adds `_buildTowerClue`, glowing `isRune` stone doorway arches, and `GlideRenderer` / `PuzzleRenderer` delegation).
5. **`@gameplay`:** Owns `src/game.js` (wires `'glide'` & `'puzzle'` modes, `makePuzzle` + `tower.clue` placement, Sector Summit Glide transitions, and `ORIGIN_CLASSIC_AUDIT.md` Original rules).
6. **`@ui`:** Owns `index.html`, `styles.css`, `src/main.js` (adds `#overlay-worlds` 4-Sector Archipelago World Map, expands `#overlay-minigames` to all 5 mini-games with bespoke inline SVGs, and updates HUD badges).
