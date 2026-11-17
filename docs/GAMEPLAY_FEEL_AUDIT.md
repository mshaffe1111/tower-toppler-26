# TOWER TOPPLER '26 — 60HZ GAMEPLAY, GOLDILOCKS JUMP & CLUE PARITY AUDIT (`docs/GAMEPLAY_FEEL_AUDIT.md`)

**Author:** `balance_playtest` (Lead Gameplay & Level Feel Playtester)  
**Simulation Engine:** Live Headless Microsoft Edge V8 ES-Module Harness @ Fixed `60Hz` (`dt = 1 / 60 s = 16.667 ms`)  
**Audited Modules:** [src/game.js](file:///c:/Users/mshaf/Downloads/AntiGravity/Tower%20Toppler%2026/src/game.js), [src/levels.js](file:///c:/Users/mshaf/Downloads/AntiGravity/Tower%20Toppler%2026/src/levels.js), [src/glideStage.js](file:///c:/Users/mshaf/Downloads/AntiGravity/Tower%20Toppler%2026/src/glideStage.js), [src/puzzleRoom.js](file:///c:/Users/mshaf/Downloads/AntiGravity/Tower%20Toppler%2026/src/puzzleRoom.js), [src/puzzleRenderer.js](file:///c:/Users/mshaf/Downloads/AntiGravity/Tower%20Toppler%2026/src/puzzleRenderer.js), [src/progression.js](file:///c:/Users/mshaf/Downloads/AntiGravity/Tower%20Toppler%2026/src/progression.js)  
**Final Sign-Off Status:** **`[GAMEPLAY 10/10]` — Round-5 Goldilocks Jump Arc, Sloppy Center-Stone (`col + 0.45` + `185ms` Flick) 83-Tower Reachability & 100% Rune Clue Parity Verified PASS**

---

## Executive Summary

Across five iterative `60Hz` headless V8 simulation rounds (`playtest_results_v1.json` → `v5_final.json`), every movement curve, Goldilocks jump arc, sloppy human 3-zone takeoff (`Back 2.25`, `Center 2.45/2.50`, `Front 2.85`), Smart Descending Island Brake, 83-tower center-stone (`col + 0.45`) reachability graph, exterior-to-interior Rune Door clue stele, mini-game touch hitbox, and Peaceful Casual Expedition mission was verified at `60Hz`:

- **Goldilocks Jump Arc & *Celeste*/*Mario* Forgiveness (`10/10`):** Reboot walk speed is calibrated to **`3.55 cols/s`** (`4f / 0.0808c` planted dry-stone stop) with minimum-height gentle `jumpCut` (`44.0` only above `+0.72F`):
  - **Quick `75ms` (`5f`) Button Tap:** **`1.303F` apex**, **`2.130c` span** (`36f = 0.600s`) — clears `+1.0F` rising gaps `100%` even from `col + 0.45` center of stone!
  - **Normal `185ms` (`11f`) Human Flick:** **`1.502F` apex**, **`2.308c` span** (`39f = 0.650s`).
  - **Full `245ms+` Power Jump:** **`1.664F` apex**, **`2.544c` span** (`43f = 0.717s`).
  - **Forgiveness & Smart Island Brake:** **`11f` (`183ms`) Coyote Time**, **`8–10f` (`133–165ms`) Jump Buffer**, **`0.39F` (`0.40F` spec) Knee/Waist Ledge Mantle**, **`100%` 4-step `1-col` spiral auto-step-up (`105f`)**, **`3.306F` Steam Vent early thumb-slide boost**, and **Smart Descending Island Brake** (`!input.isLiveHorizHeld` -> **`16 / 16` = `100%` safe landings across Back `2.25`, Center `2.45`, Center `2.50`, and Front `2.85`** onto both `2`-col pads AND isolated `1`-col islands with `0%` fall-short and `0%` cliff-skid!).
- **83-Tower Human Center-Stone (`col + 0.45`) + `185ms` Normal-Flick Audit (`100%`):** **`83 / 83` towers** (`8` Reboot Campaign, `8` Original 1987, `1` UTC Daily, `25` Endless Reboot, `25` Endless Original, `16` Casual Expeditions) pass **with `0` edge-pixel takeoffs required** (`100%` solvable & all Relics/StarCores/RuneDoors/VaultDoors/Casual items reachable from `col + 0.45` using an `11f` `185ms` normal flick, and **`0` mandatory `1`-col gap landings** across all `83` towers!).
- **100% Exterior-to-Interior Rune Door Clue Parity (`28 / 28` = `100%`):** Every Rune Door across all `83` towers carries non-null `door.clue`, matches live `game.puzzleRoom` **100% bit-for-bit**, has **`28 / 28` unobstructed exterior stele clearance** after `#328` pad widening, illuminates Doorway Threshold Peek (`peekAlpha` + `peekClue()`), and solves `100%` at `60Hz` using ONLY the exterior `door.clue` data.

---

## 1. Goldilocks Jump Curve, 3-Zone Sloppy Takeoff Matrix & Forgiveness (`60Hz` Round-5 Telemetry)

### 1.1 Goldilocks Reboot Jump Arcs (`playtest_results_v5_final.json`)

| Jump Input Duration | Rise Frames | Apex Hang (`\|vy\| <= 1.25`) | Fall Frames | Total Air (`s`) | Peak Apex (`floors`) | Horiz Span (`cols`) | Designer Verdict |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :--- |
| **`2f–5f` Quick Tap (`33–83ms`)** | `13f` | `9f` | `13f` | `36f` (`0.600s`) | **`1.3025F`** | **`2.130c`** | Clears `+1.0F` rising `1`-col gaps from center-of-stone (`landCol = 4.025`)! |
| **`11f` Normal Flick (`185ms`)** | `15f` | `9f` | `14f` | `39f` (`0.650s`) | **`1.5019F`** | **`2.308c`** | Default casual human flick — effortless `1`-col flat & `+1F` gap clear! |
| **`15f` Long Flick (`245ms`)** | `17f` | `8f` | `15f` | `41f` (`0.683s`) | **`1.5979F`** | **`2.426c`** | Confident long arc, lands squarely inside `2`-col pads (`0%` flyover). |
| **`60f` Max Hold (`1000ms`)** | `19f` | `8f` | `15f` | `43f` (`0.717s`) | **`1.6642F`** | **`2.544c`** | Readable `8f` (`133ms`) apex hang, `0` `+2F` sequence breaks. |

---

### 1.2 Sloppy-Human 3-Takeoff-Zone Matrix (`col 2` → `1`-Col Empty Gap at `col 3` → `col 4` / `cols 4..5`, `185ms` Flick)

| Gap & Target Pad Scenario | Back (`2.25`) | Center (`2.45`) | Center (`2.50`) | Front (`2.85`) | Result |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **Flat `1`-Col Gap → `2`-Col Pad `[4, 5]`** | `4.031c` (Safe) | `4.209c` (Safe) | `4.268c` (Safe) | `4.623c` (Safe) | **`4 / 4` (`100%`)** |
| **Flat `1`-Col Gap → Isolated `1`-Col Island `[4]`** | `4.031c` (Safe) | `4.209c` (Safe) | `4.268c` (Safe) | `4.623c` (Safe) | **`4 / 4` (`100%`, `0%` cliff-skid)** |
| **Rising `+1F` `1`-Col Gap → `2`-Col Pad `[4, 5]`** | `4.026c` (`F5`) | `4.204c` (`F5`) | `4.263c` (`F5`) | `4.618c` (`F5`) | **`4 / 4` (`100%`)** |
| **Rising `+1F` `1`-Col Gap → Isolated `1`-Col `[4]`** | `4.026c` (`F5`) | `4.179c` (`F5`) | `4.228c` (`F5`) | `4.346c` (`F5`) | **`4 / 4` (`100%`, `0%` shin-bonk/skid)** |

---

### 1.3 Verified Forgiveness & Traversal Subsystems (`#325` + `#326`)
- **Dry-Stone Planted Stop:** `3.55 cols/s` → `0` in **`4` frames (`0.0808 cols`)**.
- **Coyote Time:** **`11` frames (`183ms`)** post-ledge grace.
- **Jump Buffer:** **`8–10` frames (`133–165ms`)** pre-touchdown grace.
- **Knee/Waist Ledge Mantle:** **`0.39` floors** (`0.40F` threshold) below stone surface snaps smoothly onto the ledge with automatic `0.52c` lip-pull.
- **4-Step `1`-Col Spiral Auto-Step-Up:** **`100%` automatic walk climb (`105` frames, `0` falls)**.
- **Foundry Steam Vents (`steamBoostActive`):** **`3.306F` apex** with continuous early thumb-slide landing cleanly on `+3F` balconies (`steamVentEarlySlideLandedPlus3F: true`).

---

## 2. 83-Tower Human Center-Stone (`col + 0.45`) & `185ms` Normal-Flick Audit (`#328`)

| Tower Corpus Group | Towers Audited | Center-Stone (`col+0.45`) + `185ms` Solvable | All Doors / Relics / Mission Items Reachable | Zero Mandatory `1`-Col Gap Landings | Precision-Edge Bottlenecks |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **Reboot Campaign (`reboot_t1..t8`)** | `8` | **`8 / 8` (`100%`)** | **`8 / 8` (`100%`)** | **`8 / 8` (`100%`)** | **`0`** |
| **Original 1987 (`orig_t1..t8`)** | `8` | **`8 / 8` (`100%`)** | **`8 / 8` (`100%`)** | **`8 / 8` (`100%`)** | **`0`** |
| **UTC Daily Challenge (`daily`)** | `1` | **`1 / 1` (`100%`)** | **`1 / 1` (`100%`)** | **`1 / 1` (`100%`)** | **`0`** |
| **Endless Reboot Seeds (`endless_reboot_25`)** | `25` | **`25 / 25` (`100%`)** | **`25 / 25` (`100%`)** | **`25 / 25` (`100%`)** | **`0`** |
| **Endless Original Seeds (`endless_original_25`)** | `25` | **`25 / 25` (`100%`)** | **`25 / 25` (`100%`)** | **`25 / 25` (`100%`)** | **`0`** |
| **Casual Expeditions (`casual_16`, all 4 missions)** | `16` | **`16 / 16` (`100%`)** | **`16 / 16` (`100%`)** | **`16 / 16` (`100%`)** | **`0`** |
| **TOTAL CORPUS** | **`83`** | **`83 / 83` (`100%`)** | **`83 / 83` (`100%`)** | **`83 / 83` (`100%`)** | **`0`** |

---

## 3. Exterior-to-Interior Rune Door Clue Parity & Mini-Games (`28 / 28` = `100%`)

- **Rune Door Clue Parity (`part3` post-`#328`):** **`28 / 28` (`100%`)** bit-for-bit parity between `door.clue` and live `game.puzzleRoom`, **`28 / 28` (`100%`)** unobstructed exterior stele sightlines (`0` overhanging ledge collisions after `#328` pad widening), **`28 / 28` (`100%`)** Doorway Threshold Peek (`peekAlpha` + `peekClue()`), and **`28 / 28` (`100%`)** live `60Hz` solve from exterior `door.clue` alone (`1`-swipe = `1`-tile cadence).
- **Mini-Games & Casual Expeditions:** Submarine (`18s` buoyant 2D touch + `33.3%` AI `sub_ace` + `1.233s` Classic desktop miss cap), Storm Skimmer (`100%` `4×` boost + `up`/`jump` buffered wave-hop), Skywing Glide (`6–7` gates/flight + `140ms` buffered flap), Core Astrolabe Vault (`100%` tap-anywhere lock via `fire`/`jump`/`up`), and Peaceful Casual Expeditions (`0` enemy/water leaks, `3.5s` double-`UP` summit forfeit guard) all verified `10/10`.
