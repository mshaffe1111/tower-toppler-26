# TOWER TOPPLER '26 — 60HZ GAMEPLAY & LEVEL FEEL AUDIT (`docs/GAMEPLAY_FEEL_AUDIT.md`)

**Author:** `balance_playtest` (Lead Gameplay & Level Feel Playtester)  
**Simulation Engine:** Live Headless Microsoft Edge V8 ES-Module Harness @ Fixed `60Hz` (`dt = 1 / 60 s = 16.667 ms`)  
**Audited Modules:** [src/game.js](file:///c:/Users/mshaf/Downloads/AntiGravity/Tower%20Toppler%2026/src/game.js), [src/levels.js](file:///c:/Users/mshaf/Downloads/AntiGravity/Tower%20Toppler%2026/src/levels.js), [src/glideStage.js](file:///c:/Users/mshaf/Downloads/AntiGravity/Tower%20Toppler%2026/src/glideStage.js), [src/puzzleRoom.js](file:///c:/Users/mshaf/Downloads/AntiGravity/Tower%20Toppler%2026/src/puzzleRoom.js), [src/puzzleRenderer.js](file:///c:/Users/mshaf/Downloads/AntiGravity/Tower%20Toppler%2026/src/puzzleRenderer.js), [src/progression.js](file:///c:/Users/mshaf/Downloads/AntiGravity/Tower%20Toppler%2026/src/progression.js)  
**Final Sign-Off Status:** **`[GAMEPLAY 10/10]` — All 3 Simulation Rounds Verified PASS at 60Hz**

---

## Executive Summary

Across three iterative `60Hz` headless V8 simulation rounds (`playtest_results_v1.json` → `v2` → `v3`), every physics curve, traversal edge case, handcrafted/procedural tower doorway & elevator shaft, intermission mini-game, Rune Chamber puzzle generator, and Peaceful Casual Expedition mission was measured down to exact `16.67ms` frame counts and verified post-fix:

- **Character Weight & Traversal Precision (`10/10`):** Reboot ground acceleration (`5f`), stop (`4f / 0.112 cols`), and counter-steer turnaround (`3f` to zero / `0.073 cols` skid) feel razor-sharp; `+1` auto-step-up climbs both isolated steps (`30f`) and continuous 4-step `1-col` spiral staircases (`102f`, `0%` overshoot/fall); Foundry steam vents launch cleanly to `3.243 floors` with or without holding Jump; solid ceiling undersides block `dc = 0` vertical phase-through (`2.139F`) without obstructing diagonal stair jumps (`100%` clear); and Procedural Original Endless physics were de-floated (`42f` jump, `25f / 0.790 cols` linear ice stop) while keeping Real 1987 Original `100%` faithful (`45f` `ARC_JUMP`, `1f` digital stop).
- **Spawn, Doorway & Lift Fairness across 57 Towers (`10/10`):** `100%` BFS solvability (`8/8` Reboot, `8/8` Original 1987, `40/40` Procedural, `1/1` Daily), **`0` spawn cheap hits** (including `orig_t6` Frame-72 `vpat` fix), **`0` dynamic tunnel-exit cheap hits** across `8` patrol phases on every doorway, and **`0` mid-shaft enemy hits** inside Reboot's enclosed wrought-iron cage elevators (`0.45s` endpoint dwell + `0.75s` top/dismount grace).
- **All 5 Mini-Games & All 4 Casual Expeditions (`10/10`):** Reboot Manta-Sub (`18.0s`, `28.0` fish/run, `33.3%` AI `sub_ace` rate, `100%` Warp Cave), Classic 1987 Sub (`14.0s` 1-bubble purity, `1.233s` desktop miss cap down from `3.483s`), Hydro-Skimmer (`16.05/19.9` gates hit, `100%` `4×` boost), Sky-Wing Glide (`6–7` gates/flight, `1.82s` crisp landing settle), all 4 Rune Chamber types (`80/80` = `100%` solved & Par Cleared, standalone `'bells'` 4-color mural/HUD target clue added, `~2.2s` skippable solve outro), Core Lock Vault (`20/20` cracked), and all 4 Casual Expedition missions (`0` enemy/water leaks across `40` seeds, `3.5s` double-`UP` summit forfeit guard).

---

## 1. Character Weight, Turnaround & Jump Precision (`60Hz` Verified Telemetry)

### 1.1 Post-Fix Ground & Ice Traction Matrix (Round 3 Verified)

| Physics Regime & Surface | Max Walk Speed (`cols/s`) | Accel `0 → 90%` (Frames) | Accel `0 → 100%` (Frames) | Release Stop (Frames / `ms`) | Stop Distance (`cols`) | 180° Turn to `vx = 0` (Frames) | 180° Full Reverse (Frames) | Turn Skid Overshoot (`cols`) | Final Verdict |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :--- |
| **`reboot` — Dry Stone (`solid`)** | `4.50` | `5f` | `5f` (`83ms`) | `4f` (`67ms`) | `0.112` | **`3f` (`50ms`)** | **`8f` (`133ms`)** | **`0.073`** | **10/10 Razor-Crisp** (`92 cols/s²` counter-steer snaps faster than passive release). |
| **`reboot` — Glacier Ice (`ice`)** | `4.50` | `16f` | `18f` (`300ms`) | `27f` (`450ms`) | `0.956` | `18f` | `35f` (`583ms`) | `0.616` | **10/10 Readable Slide** (`< 1.0` col stop fits 3-col Boreal Spire shelves cleanly). |
| **`original` (Real 1987 Grid)** | `2.00` | `1f` | `1f` (`17ms`) | `1f` (`17ms`) | `0.000` | `1f` | `1f` (`17ms`) | `0.000` | **10/10 Authentic** Atari 7800 / Hewson digital walk. |
| **`original` (Endless `solid`)** | `4.10` | `1f` | `1f` (`17ms`) | `1f` (`17ms`) | `0.000` | `1f` | `1f` (`17ms`) | `0.000` | **10/10 Snappy** classic-feel endless walk. |
| **`original` (Endless `ice`)** | `4.10` | `15f` | `17f` (`283ms`) | **`25f` (`417ms`)** | **`0.790`** | `17f` | **`33f` (`550ms`)** | **`0.527`** | **10/10 Fixed** (was `99f` stop / `7.929 cols` exponential spinout in Round 1!). |

---

### 1.2 Post-Fix Jump Arcs, Variable Short-Hop & Gap-Clearing Matrix (`60Hz`)

| Mode & Jump Hold Duration | Rise (`vy > 1.1`) | Apex Hang (`\|vy\| <= 1.1`) | Fall (`vy < -1.1`) | Total Air Frames (`s`) | Peak Apex (`floors`) | Horiz Span (`cols`) | Clears 1-Col Gap `(dc=2, df=0)` | Clears `+1F` Gap `(dc=2, df=+1)` | Final Verdict |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :--- |
| **`reboot` — `1f` Tap (`17ms`)** | `10f` | `7f` | `10f` | `28f` (`0.467s`) | `0.846F` | `2.10` | Yes | Yes | Crisp micro-hop over low `roller` spheres. |
| **`reboot` — `2f` Tap (`33ms`)** | `10f` | `7f` | `10f` | `28f` (`0.467s`) | `0.916F` | `2.10` | Yes | Yes | Responsive low-ceiling short-hop. |
| **`reboot` — `4f` Tap (`67ms`)** | `11f` | `7f` | `12f` | `31f` (`0.517s`) | `1.095F` | `2.33` | Yes | Yes | Clean `+1F` single-gap hop with `0.18F` mantle. |
| **`reboot` — `6f` Hold (`100ms`)** | `13f` | `7f` | `13f` | `34f` (`0.567s`) | `1.254F` | `2.55` | Yes | Yes | Mid-arc tactical hop. |
| **`reboot` — `10f` Hold (`167ms`)** | `15f` | `6f` | `14f` | `36f` (`0.600s`) | `1.476F` | `2.70` | Yes | Yes | Mid-high arc (`input.js` touch flick uses `315ms` full hold + `260ms` ballistic X-carry). |
| **`reboot` — Full Hold (`60f`)** | `20f` | `7f` | `16f` | `44f` (`0.733s`) | `1.768F` | `3.30` | Clears 2-col `(dc=3)` (`true`) | Yes (`true`) | **10/10 Weighty** (`37.0` fall gravity = `1.51×` ascent; `7f` = `117ms` readable apex). |
| **`original` (Real 1987 `ARC_JUMP`)** | `19f` | `7f` | `18f` | `45f` (`0.750s`) | `2.250 rows` | `1.50` | Yes (`true`) | Yes (`true`) | **10/10 Authentic** (`flat_2gap` = `false`, enforcing 1987 1-brick gap law; stationary jump displays `'WALK + JUMP TO LEAP'`). |
| **`original` (Procedural Endless)** | `19f` | `6f` | `16f` | **`42f` (`0.700s`)** | **`1.459F`** | **`2.87`** | Clears 2-col `(dc=3)` (`true`) | Yes (`true`) | **10/10 De-Floated** (was `54f` / `0.900s` / `3.96 cols` moon-gravity in Round 1!). |

---

### 1.3 Traversal Subsystems: Auto-Step-Up, Steam Vents, Ceiling Bonks & Cage Lifts

| Subsystem | Round 1 Measurement (Pre-Fix) | Root Cause Identified | Round 3 Verified Measurement (Post-Fix) | Status |
| :--- | :--- | :--- | :--- | :---: |
| **`+1` Auto-Step-Up & 4-Step `1-Col` Spiral Stairs** | `0.470F` (`reboot`) / `0.567F` (`orig_endless`) -> **`0%` stair climb, fell into sea** | Voluntary short-hop `!inp.jump` gravity cut crushed non-jump step impulses, and `4.5 cols/s` horizontal speed overshot `1-col` steps before descent. | **`100%` Single-Step & 4-Step Spiral Climb:** `reboot` (`30f` / `102f`, `1.432F` apex, `fellOff: false`), `orig_real` (`29f` / `119f`), `orig_endless` (`20f` / `82f`) via `jumpCutEligible = false` + `stepHopActive` (`2.35 cols/s` stair-cadence cap). | **PASS** |
| **Foundry Steam Vents (`steamVent`)** | `1.503F` (walk-on) / `2.996F` (holding Jump) -> **Missed `+2F` perches & Reboot T3's `+3F` Relic (`r3_relic`)** | Short-hop gravity cut truncated walk-on vent launches (`inp.jump = false`), and `vy = 11.4` peaked `0.004F` shy of `+3.000F`. | **`3.243F` Unconditional Apex** both walking on (`inp.jump = false`) and holding Jump (`vy = 12.8`, `jumpCutEligible = false`) -> `reachesPlus2F: true`, `reachesPlus3F_T3Relic: true`. | **PASS** |
| **Solid Ceiling Underside Head-Bump** | `reboot` & `orig_endless` ghosted upward through `+1F` / `+2F` overhead slabs (`3.768F`) | Underside head-bump check existed only in `isRealOrig`. | **`dc = 0` Vertical Phase-Up Blocked:** `+1F` ceiling stops cleanly at **`2.139F`** (`clippedUpOntoCeiling: false`), `+2F` stops at **`3.139F`**, while diagonal stair jumps (`dc = ±1, df = +1`) remain **`100%` unobstructed** (`diagStepJumpUnblocked: true`). | **PASS** |
| **Reboot Cage Lift Boarding & Recall** | `0.00s` endpoint dwell (`0.08F` walk-on tolerance) | Lifts reversed direction on the exact frame they touched `minFloor` / `maxFloor`. | **`0.45s` (`27f`) Endpoint Station Dwell** at both `minFloor` and `maxFloor` (immediately overridden by manual `UP`/`DOWN`), widened `0.18F` walk-on tolerance, plus instant Snowball Lift Recall within `1.15 cols`. | **PASS** |

---

## 2. Spawn, Doorway & Lift Fairness Audit (`57` Towers × `8` Patrol Phases @ `60Hz`)

### 2.1 Solvability & Reachability Summary
- **BFS Tower Solvability (`verifyTowerSolvable`):** `8 / 8` Reboot Handcrafted (`100%`), `8 / 8` Original 1987 Real-Grid (`100%`), `20 / 20` Procedural Reboot (`100%`), `20 / 20` Procedural Original (`100%`), `1 / 1` UTC Daily (`100%`).
- **Unreachable Collectibles / Secret Doors / Rune Chambers:** **`0` across all 57 towers**.

### 2.2 Dynamic Spawn, Tunnel Exit & Elevator Ride Verification (Round 1 → Round 3)

| Fairness Vector | Round 1 Finding | Fix Applied (`@levels_prog` + `@gameplay`) | Round 3 Verified Result (`playtest_results_v3.json`) | Status |
| :--- | :--- | :--- | :--- | :---: |
| **Tower Spawn Safety (`t = 0..3.0s`)** | `orig_t6` (*Swimmer's Delight*) `vpat` at `(c=0, r=6)` dove straight down onto spawn `(0.5, 0)` at `t = 1.20s` (Frame `72`), hitting Pogo the exact frame `invuln = 1.2s` expired. | `levels.js`: Set initial `dir: 1` (upward) for `vpat` at `c === 0 && r <= 12`. `game.js`: Extended `loadTower` spawn grace to **`2.0s`**. | **`0` spawn hazards (`spawnHazards: []`) across all 57 towers!** | **PASS** |
| **Static Door/Lift Camping (`reboot` + `proc`)** | Early builds risked `robotH` / patrollers overlapping doorway columns at `t = 0`. | `levels.js` (`#155`): Relocated doorway-adjacent `robotH` spawns and offset `eye`/`roller`/`bouncer` patrol origins `+4.5..+8.0 cols` from doors/lifts. | **`0` static proximity violations across all Reboot, Daily & Procedural towers** (only authentic 1987 `orig_t8` `real8d8f39` entrance has a classic adjacent `roller`, `0` exit hits). | **PASS** |
| **Dynamic Tunnel Exit Fairness (`8` patrol phases / door)** | `10` Reboot tunnel doors suffered sweep hits `0.85..1.05s` after Pogo emerged from a `180°` cylinder wrap (`0.80s` grace was `0.5s` too short). | `game.js`: Set post-tunnel arrival `invuln` to **`1.50s`** on `'exit'` start and **`1.35s`** (`81` frames) upon `'exit'` completion. | **`0` tunnel-exit cheap hits (`cheapHitsOutOf8Phases === 0` on 100% of doorways across all 57 towers)!** | **PASS** |
| **Elevator Shaft & Dismount Fairness (`8` patrol phases / lift)** | Wrapping `eye` & `molecule` patrollers clipped through Reboot's enclosed wrought-iron cage elevators (`cage_elevator.glb`) mid-shaft on `8` Reboot towers + `3` bottom-frame boarding overlaps in Round 2. | `game.js` (`#177`, `#181`): Full `Boolean(p.onElevator)` cage shielding (`shieldedInCageLift`) in Reboot era across `minFloor..maxFloor` + **`0.75s` top/dismount grace** on reaching `maxFloor` or stepping off. | **`0` mid-shaft enemy hits (`shaftHitsOutOf8Phases === 0`) across 100% of Reboot Handcrafted & Procedural Reboot cage lifts!** *(Classic `orig_t2..t8` preserve authentic 1987 open-lift shootable `'b'` block & patroller rules.)* | **PASS** |

---

## 3. All 5 Mini-Games & All 4 Endless Casual Missions (`60Hz` Verified Telemetry)

### 3.1 Post-Fix Mini-Game Telemetry Matrix (Round 3 Verified)

| Mini-Game Mode | 60Hz Sample | Round 1 Baseline Issue | Round 3 Verified Telemetry | Designer Verdict |
| :--- | :---: | :--- | :--- | :---: |
| **1A. Reboot Manta-Sub (`submarine`, `era: 'reboot'`)** | `15` runs (`390×844`) | `14.0s` timer spawned only `17.47` non-gear fish -> **`0.0%` `sub_ace` (`10+` fish) unlock rate**. | **`18.0s` swim, `28.0` non-gear fish/run**, avg `8.6` caught (max `12`), **`sub_ace` (`10+`) = `33.3%`**, `4.0` sonar caches, `5.53` vent boosts, **`100%` Warp Cave**, `3` rapid-fire torpedoes (`0.85s` miss). | **10/10 Action-Packed & Fair** |
| **1B. Classic 1987 Sub (`submarine`, `era: 'original'`)** | `15` mobile + `10` desktop (`1280×720`) | Missed shot on `1280px` desktop traveled to `x = 1308px`, locking out shooting for **`3.483s` (`209f`)**! | Strictly `1` active bubble, `0` mines/vents/sonar (`100%` 1987 pure); **`1280px` desktop miss lockout cut from `3.483s` → `1.233s`** (`0.967s` mobile); avg `9.0` fish caught (`20–26.7%` `sub_ace`). | **10/10 Crisp Across All Viewports** |
| **2. Hydro-Skimmer (`skimmer`)** | `20` runs | `27` opposite-edge wide gate pairs (`\|Δlane\| > 3.6`) at `4×` boost. | **`19.9` gates spawned, `16.05` hit (`+1.9` gates/run), `100%` `4×` boost (`skimmer_pro`)**, `7.35` ramps, `7.75` crates; wide opposite-edge gate pairs cut by **`59%` (`27 → 11`)** via `±2.6` lane clamping + `8.2` carve rate. | **10/10 Fast, Readable Slalom** |
| **3. Sky-Wing Glide (`glide`)** | `12` full flights | Spawned **rigid `4` gates total** on `12/12` runs (`0` margin for `4-gate chain`) + `3.65s` post-touchdown dead wait. | **`6–7` Ring Gates spawned/flight** (`0` sub-4-gate flights; `4-gate chain` doubled to `33.3%`; `5/12` perfect runs), `100%` Golden Lantern spawn, total flight `25.77s`, **post-touchdown wait cut `3.65s → 1.82s`**. | **10/10 exhilarating & Snappy** |
| **4. Rune Chambers (`lights`, `bells`, `beam`, `blocks`)** | `80` live chambers (`20 × 4`) | Standalone/Casual `'bells'` had `showTarget: false` (blind guessing without exterior tower) + `4.81–5.10s` post-solve wait. | **`80 / 80` (`100%`) solved, `80 / 80` (`100%`) Par Cleared** (`0.53–0.77` moves/par ratio, `0` over par); standalone/casual `'bells'` sets **`showTarget: true`** and renders glowing 4-color bell order on 3D stele mural & HUD; post-solve wait cut to **`3.51–3.80s`** (`~2.2s` with `FIRE` early exit). | **10/10 Clever, Fair & Skippable** |
| **5. Core Lock Vault (`vault`)** | `20` runs | Already crisp in Round 1 (`12s / 3 strikes` Campaign, `15s / 5 strikes` Casual). | **`20 / 20` (`100%`) wins** in avg `4.08s`; tactile sweet-spot windows = **`461ms` (`28f`) → `298ms` (`18f`) → `206ms` (`12f`)**; awards `+10` Gears + Star Core + Shield. | **10/10 Tactile Mastery** |

---

### 3.2 Endless Casual Expeditions (`startCasualEndlessMode` — 40 Seeds + Live 4-Mission Run)

| Casual Expedition Check | Measured Result (`playtest_results_v3.json`) | Verdict |
| :--- | :--- | :---: |
| **Peaceful Mode Purity (`40` seeds across all `4` mission archetypes)** | **`0` enemies (`enemyLeakCount: 0`), `0` rising water (`waterRiseLeakCount: 0`)**, `0` mines in Sub-Hunter / Hydro-Skimmer, infinite lives, generous Vault (`15s / 5 strikes`). | **PASS** |
| **Objective Item Reachability (`salvage_part`, `workbench`, `compass_key`, `treasureChest`, `curio`, `isRune`)** | **`0` unreachable objective items (`unreachableObjectiveItems: 0`) across `40 / 40` seeds** (`12` `tower_repair`, `9` `treasure_hunt`, `10` `curio_survey`, `9` `puzzle_architect`). | **PASS** |
| **Accidental Premature Summit Exit Guard (`prematureExitAllowedWithoutObjective`)** | **`false` across all `4 / 4` mission types** (`tower_repair: false`, `treasure_hunt: false`, `curio_survey: false`, `puzzle_architect: false`) — pressing `UP` once at the summit with an incomplete objective now shows a `3.5s` confirmation prompt (`'CHEST UNOPENED • UP AGAIN TO LEAVE'`, etc.) instead of forfeiting expedition rewards. | **PASS** |
| **Live 4-Mission Progression & Economy Loop** | Completed all `4` mission types live at `60Hz`, earning **`128` Golden Gears** and cataloging **`9 / 12` Curios & Blueprints** in just 4 expeditions (with Blueprints `10–12` unlocking deterministically on expeditions `2, 4, 6`). | **PASS** |

---

## 4. Round-by-Round Fix & Re-Verification Log

1. **Round 1 (`playtest_results_v1.json` → Board `#166`):**
   - Built headless Edge V8 `60Hz` harness (`playtest_bot.js`) auditing all 3 physics regimes, 57 towers, 5 mini-games, 80 Rune Chambers, and 40 Casual seeds.
   - Uncovered 8 concrete gameplay/feel issues: `!inp.jump` gravity cut breaking Auto-Step-Up (`0.47F`) and walk-on Steam Vents (`1.50F`), missing Reboot ceiling head-bump, Original Endless floatiness (`54f`) & exponential ice spinout (`99f / 7.93 cols`), `orig_t6` Frame-72 `vpat` spawn dive-bomb, Reboot tunnel-exit & cage-lift sweep hits, sparse Reboot Sub fish (`0%` `sub_ace`) & `3.48s` Original `1280px` bubble lockout, rigid `4`-gate Glide spawns, missing standalone `'bells'` target clue, and single-`UP` Casual summit forfeit.
2. **Round 2 (`#155`, `#167`, `#173`, `#177` → `playtest_results_v2.json` → Board `#180`):**
   - Verified fixes from `@levels_prog` (`orig_t6` `vpat` upward `dir: 1` + doorway spacing), `@glide_puzzle` (`showTarget: !hideTarget` + 4-color `'bells'` stele/HUD clue, `6–7` Glide gates & `3.8s` arrival, `2.1s` Rune Chamber `SOLVED_T` + `fire` skip), and `@gameplay` (`jumpCutEligible`, `92` counter-steer, Original Endless de-float & linear ice, `2.0s` spawn grace, `1.35s` tunnel grace, `0.45s` lift dwell, `18s` Reboot Sub, `1.23s` Original bubble cap, Skimmer lane clamp, Casual `3.5s` double-`UP` guard).
   - Isolated 3 residual edge cases in `src/game.js`: horizontal `4.5 cols/s` overshoot on continuous `1-col` spiral stairs, `l.floor - 0.32` `< prevHead` allowing `+1F` ceiling clip, and `minFloor + 0.08` leaving 3 unshielded bottom frames on `3` Reboot cage lifts.
3. **Round 3 (`#181` → `playtest_results_v3.json` — Final Verification):**
   - `@gameplay` landed `stepHopActive` (`2.35 cols/s` stair-cadence cap), `l.floor - 0.14` ceiling underside bonk, and full `Boolean(p.onElevator)` Reboot cage-lift shielding.
   - Re-ran the complete `60Hz` headless V8 simulation suite (`playtest_results_v3.json`): **100% of traversal, fairness, mini-game, puzzle, and Casual Expedition checks passed with zero regressions (`[GAMEPLAY 10/10]`).**
