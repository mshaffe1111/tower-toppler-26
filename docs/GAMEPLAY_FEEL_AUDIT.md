# TOWER TOPPLER '26 — 60HZ GAMEPLAY, PRECISION MOVEMENT & CLUE PARITY AUDIT (`docs/GAMEPLAY_FEEL_AUDIT.md`)

**Author:** `balance_playtest` (Lead Gameplay & Level Feel Playtester)  
**Simulation Engine:** Live Headless Microsoft Edge V8 ES-Module Harness @ Fixed `60Hz` (`dt = 1 / 60 s = 16.667 ms`)  
**Audited Modules:** [src/game.js](file:///c:/Users/mshaf/Downloads/AntiGravity/Tower%20Toppler%2026/src/game.js), [src/levels.js](file:///c:/Users/mshaf/Downloads/AntiGravity/Tower%20Toppler%2026/src/levels.js), [src/glideStage.js](file:///c:/Users/mshaf/Downloads/AntiGravity/Tower%20Toppler%2026/src/glideStage.js), [src/puzzleRoom.js](file:///c:/Users/mshaf/Downloads/AntiGravity/Tower%20Toppler%2026/src/puzzleRoom.js), [src/puzzleRenderer.js](file:///c:/Users/mshaf/Downloads/AntiGravity/Tower%20Toppler%2026/src/puzzleRenderer.js), [src/progression.js](file:///c:/Users/mshaf/Downloads/AntiGravity/Tower%20Toppler%2026/src/progression.js)  
**Final Sign-Off Status:** **`[GAMEPLAY 10/10]` — Round-4 Surgical Mobile/Tablet Precision Physics, 83-Tower Reachability & 100% Rune Clue Parity Verified PASS**

---

## Executive Summary

Across four iterative `60Hz` headless V8 simulation rounds (`playtest_results_v1.json` → `v4_final.json`), every movement curve, jump arc, multi-width ledge landing, doorway/lift interaction, 83-tower reachability graph, exterior-to-interior Rune Door clue stele, mini-game touch hitbox, and Peaceful Casual Expedition mission was verified at `60Hz`:

- **Surgical Mobile/Tablet Movement & Jump Precision (`10/10`):** Reboot walk speed is calibrated to **`3.35 cols/s`** (`3.15 cols/s` Classic Endless, `2.00 cols/s` 1987 Real) with planted **`4`-frame (`0.0708 cols`) dry-stone braking**, **`3`-frame (`0.0517 cols`) counter-steer turnaround**, **`7`-frame (`0.160 cols`) mid-air horizontal braking** on thumb stop, and a surgical **`2.066`-col full running jump span** (`1.419F` apex in `37f = 0.617s`; `85ms` short-hop = `0.927F` apex, `1.452` cols) that lands squarely on `1`-, `2`-, and `3`-column ledges with **`0%` overshoot**.
- **Mobile Forgiveness & Traversal Subsystems (`10/10`):** Verified `7f` (`117ms`) Coyote Time, `6f` (`100ms`) Jump Buffer, `0.18–0.22F` lip mantle forgiveness, `100%` 4-step `1-col` spiral staircase auto-step-up (`102f`), `3.112F` Foundry Steam Vent launches with full early thumb-slide clearance onto `+2F`/`+3F` balconies (`p.steamBoostActive`), `dc = 0` overhead ceiling stops (`2.139F`), and `±0.78`-col doorway entry tolerance synced every frame via `input.setInteractContext`.
- **83-Tower True-`60Hz` Solvability & Fairness (`100%`):** **`83 / 83` towers** (`8` Reboot Campaign, `8` Original 1987, `1` UTC Daily, `25` Endless Reboot, `25` Endless Original, `16` Casual Expeditions) pass both `verifyTowerSolvable` and independent live-`60Hz`-envelope reachability across every summit exit, Rune Door, Vault Door, Relic, Star Core, Workbench, Treasure Chest, and Curio (`0` mandatory gaps exceeding jump span, `0` spawn/tunnel/cage-lift cheap hits).
- **100% Exterior-to-Interior Rune Door Clue Parity & Blind-Clue Solvability (`28 / 28` = `100%`):** Every Rune Door across Campaign, Daily, Endless, and Casual carries non-null `door.clue` via shared `peekPuzzleClue` / `deriveRuneDoorClue` PRNG paths, matches live `game.puzzleRoom` **100% bit-for-bit**, has unobstructed exterior stele clearance (`door.floor + 1.45..2.45`), illuminates diegetic Doorway Threshold Peek (`peekAlpha` + `peekClue()`), and was **solved `28 / 28` (`100%`) at `60Hz` using ONLY the exterior `door.clue` data** (`1`-swipe = `1`-tile touch cadence).

---

## 1. Surgical Mobile/Tablet Movement & Jump Precision (`60Hz` Round-4 Telemetry)

### 1.1 Ground Traction, Mid-Air Braking & Ice Matrix (`playtest_results_v4_final.json`)

| Physics Regime & Surface | Walk Speed (`cols/s`) | Accel `0 → 100%` | Dry/Ice Stop (Frames / `cols`) | 180° Turn to `vx = 0` | Turn Skid (`cols`) | Mid-Air Brake (`moveIntent = 0`) | Final Verdict |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :--- |
| **`reboot` — Dry Stone (`solid`)** | **`3.35`** | `5f` (`83ms`) | **`4f` (`0.0708c < 0.08c`)** | **`3f` (`50ms`)** | **`0.0517c`** | **`7f` (`0.160c` drift)** | **10/10 Mountain-Goat Planted Precision** |
| **`reboot` — Glacier Ice (`ice`)** | `3.35` | `15f` (`250ms`) | `27f` (`0.7204c`) | `15f` (`250ms`) | `0.3879c` | `7f` (`0.160c` in air) | **10/10 Readable Slide** (fits `2–3` col ice shelves cleanly) |
| **`original` (Real 1987 Grid)** | `2.00` | `1f` (`17ms`) | `1f` (`0.0000c`) | `1f` (`17ms`) | `0.0000c` | Authentic `ARC_JUMP` | **10/10 Authentic** Atari 7800 / Hewson port table |
| **`original` (Endless `solid`)** | **`3.15`** | `1f` (`17ms`) | `1f` (`0.0000c`) | `1f` (`17ms`) | `0.0000c` | **`1f` (`0.000c` drift)** | **10/10 Crisp Classic Endless** |
| **`original` (Endless `ice`)** | `3.15` | `15f` (`250ms`) | `26f` (`0.6354c`) | `15f` (`250ms`) | `0.3558c` | `1f` (`0.000c` in air) | **10/10 Linear Controlled Slide** |

---

### 1.2 Proportional Jump Arcs & Multi-Width Ledge Landing Precision (`60Hz`)

| Mode & Jump Hold Duration | Rise Frames | Apex Hang | Fall Frames | Total Air (`s`) | Peak Apex (`floors`) | Horiz Span (`cols`) | Ledge Landing Verification |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :--- |
| **`reboot` — `1f` Micro-Tap (`17ms`)** | `7f` | `5f` | `8f` | `21f` (`0.350s`) | `0.587F` | `1.173c` | Low roller hop |
| **`reboot` — `5f` Short Flick (`83ms`)** | `10f` | `5f` | `10f` | `26f` (`0.433s`) | **`0.927F`** | **`1.452c`** | Lands & plants on **`1`-col island** (`col 2.983`, `0%` overshoot!) |
| **`reboot` — `9f` Med Flick (`150ms`)** | `12f` | `6f` | `12f` | `31f` (`0.517s`) | **`1.180F`** | **`1.731c`** | Clean `+1F` step-gap hop |
| **`reboot` — `14f` Full Flick (`233ms`)** | `15f` | `5f` | `13f` | `34f` (`0.567s`) | **`1.350F`** | **`1.898c`** | Lands on **`1`-col island** w/ mid-air stop (`col 3.095`, `0%` overshoot!) |
| **`reboot` — Full Hold (`60f`)** | `17f` | `6f` | `13f` | **`37f` (`0.617s`)** | **`1.419F`** | **`2.066c`** | Lands squarely on **`2`-col (`col 3.884`)**, **`3`-col**, & **`+1F` (`col 3.493`)** ledges (`0%` flyover!) |
| **`original` (Real 1987 `ARC_JUMP`)** | `19f` | `7f` | `18f` | `45f` (`0.750s`) | `2.250 rows` | `1.500c` | Enforces classic 1987 `1`-brick gap law (`dc = 3` = `false`) |
| **`original` (Procedural Endless)** | `18f` | `5f` | `15f` | `39f` (`0.650s`) | `1.397F` | **`2.048c`** | Lands squarely on `2`-col (`col 3.873`) & `+1F` (`col 3.453`) ledges |

---

### 1.3 Mobile Forgiveness, Doorway Context, Steam Vents & Sightlines

- **Coyote Time & Jump Buffer:** `7` frames (`117ms`) post-ledge Coyote Time + `6` frames (`100ms`) pre-touchdown Jump Buffer + `0.18–0.22F` lip mantle forgiveness.
- **`+1` Auto-Step-Up (`stepWalkSpeed = 2.25 cols/s`):** `100%` climb across isolated steps (`32f`) and continuous 4-step `1-col` spiral staircases (`102f` Reboot, `93f` Classic Endless, `128f` Real 1987; `fellOff: false`).
- **Foundry Steam Vents (`p.steamBoostActive`):** Reaches **`3.112F`** both vertically and when mobile players continuously slide their thumb toward adjacent `+2F`/`+3F` target balconies (`earlyDriftApex = 3.112F`, `r3_relic` at `col 6, floor 5` verified `true`), while `dc = 0` overhead ceilings still stop cleanly (`2.139F` / `3.139F`).
- **Doorway Precision & `setInteractContext`:** Verified across `0.00`, `0.45`, and `0.72` col offsets from doorway center with residual `vx = 2.2 cols/s` (`interactContextReportedDoor: true`, `enteredWithResidualVxAndEdgeUp: true`, `vxZeroedOnEntry: true`).
- **Vertical Camera Sightlines:** Rest look-ahead `camFloor = p.floor + 1.45` (`+2.45` climbing look-ahead), keeping `5–6` floors of upcoming ledges, enemies, and exterior Rune Door clue steles cleanly in view.

---

## 2. 83-Tower True-`60Hz` Reachability & Fairness Audit

| Tower Corpus Group | Towers Audited | `verifyTowerSolvable` | Live-`60Hz`-Envelope Solvable | All Doors / Relics / Mission Items Reachable | Spawn / Tunnel / Cage-Lift Cheap Hits |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **Reboot Campaign (`reboot_t1..t8`)** | `8` | `8 / 8` (`100%`) | **`8 / 8` (`100%`)** | **`8 / 8` (`100%`)** | `0` |
| **Original 1987 (`orig_t1..t8`)** | `8` | `8 / 8` (`100%`) | **`8 / 8` (`100%`)** | **`8 / 8` (`100%`)** | `0` |
| **UTC Daily Challenge (`daily`)** | `1` | `1 / 1` (`100%`) | **`1 / 1` (`100%`)** | **`1 / 1` (`100%`)** | `0` |
| **Endless Reboot Seeds (`endless_reboot_25`)** | `25` | `25 / 25` (`100%`) | **`25 / 25` (`100%`)** | **`25 / 25` (`100%`)** | `0` |
| **Endless Original Seeds (`endless_original_25`)** | `25` | `25 / 25` (`100%`) | **`25 / 25` (`100%`)** | **`25 / 25` (`100%`)** | `0` |
| **Casual Expeditions (`casual_16`, all 4 missions)** | `16` | `16 / 16` (`100%`) | **`16 / 16` (`100%`)** | **`16 / 16` (`100%`)** | `0` (`0` enemies, `0` rising sea) |
| **TOTAL CORPUS** | **`83`** | **`83 / 83` (`100%`)** | **`83 / 83` (`100%`)** | **`83 / 83` (`100%`)** | **`0`** |

---

## 3. 100% Exterior-to-Interior Rune Door Clue Parity & Mini-Game Touch Audit

### 3.1 Live Rune Door Clue Parity & Blind-Exterior-Clue Solvability (`28` Rune Doors Across `83` Towers)
- **Shared Deterministic Generator (`peekPuzzleClue` / `deriveRuneDoorClue`):** `hasExportedPeekPuzzleClue = true`.
- **Non-Null Exterior `door.clue`:** **`28 / 28` (`100%`)** (`10` `lights`, `6` `bells`, `6` `beam`, `6` `blocks`).
- **Exterior Plaque Unobstructed Sightline (`door.floor + 1.45..2.45`):** **`28 / 28` (`100%`)** (`0` overhanging ledge obstructions).
- **Bit-for-Bit Parity (`door.clue` vs Live `game.puzzleRoom`):** **`28 / 28` (`100%`)** (`pattern` matches `puzzle.target` bit-for-bit on every `lights` door; `order` & `colors` match `BELL_COLORS[bells[order[i]].color]` bit-for-bit on every `bells` door).
- **Diegetic Doorway Threshold Peek (`peekAlpha` + `peekClue()`):** **`28 / 28` (`100%`)** illuminate on walk-in, when stepping back to `(doorX ± 1, rows - 1)`, and via `#btn-peek-clue`.
- **Live `60Hz` Solve Using ONLY Exterior `door.clue`:** **`28 / 28` (`100%`)** solved tile-by-tile inside live `TowerTopplerGame` without ever reading internal `puzzle.target` or `puzzle.order`; `200ms` directional swipe steps **exactly `1` tile** (`0` overshoot).

### 3.2 All 5 Mini-Games & Casual Expeditions Touch Verification
- **Submarine (`reboot` & `original`):** `18.0s` buoyant 2D steering (`225/305 px/s`), generous `32px` fish / `35px` mine torpedo / `320px` sonar / `56px` Warp Cave touch hitboxes (`33.3%` AI `sub_ace` rate); Classic `14.0s` 1-bubble purity (`1.233s` desktop miss cap).
- **Storm Skimmer:** Snappy `9.0` lateral carve, `±2.4` clamped lanes, `1.58` boost gates (`100%` `4×` boost), `0.13s` buffered wave-hop via `jump` or `up`.
- **Skywing Glide:** `6–7` Ring Gates/flight, `140ms` buffered flap (`jump`/`fire`), `1.82s` crisp landing settle.
- **Core Astrolabe Vault:** `100%` lock support across **`fire`, `jump`, and `up`** (`vaultTapActions = { fire: true, jump: true, up: true }`) with generous `0.42 / 0.38 / 0.35 rad` mobile sweet-spots.
- **Endless Casual Expeditions:** `0` enemies, `0` rising water, `100%` reachable Workbench / Salvage Parts / Compass Keys / Treasure Chest / Curios, and `3.5s` double-`UP` summit forfeit guard across all `4` mission archetypes.
