# Towering Waters: Gateway's Descent — 60Hz Cylindrical Physics, Staircase Traversal & 6-Mode Balance Specification

**Scope:** Fixed-timestep `60Hz` (`dt = 16.667ms`) physics, `COLS = 20` cylindrical scale calibration, walkable staircases, lizard combat mechanics, and 6-mode progression across [src/game.js](../src/game.js), [src/levels.js](../src/levels.js), [src/puzzleRoom.js](../src/puzzleRoom.js), and [src/progression.js](../src/progression.js).

---

## 1. Synchronized V3 World & Hero Scale (`COLS = 20`)

| Parameter | Calibrated V3 Value | Gameplay Impact |
| :--- | :---: | :--- |
| **Cylindrical Columns (`COLS`)** | `20` | `18°` per column around `TOWER_RADIUS = 3.75` (`~1.18u` arc width per column). |
| **Floor Spacing (`FLOOR_HEIGHT`)** | `1.50u` | Spacious architectural framing for `~1.18u`-tall skeletal Gateway + `~0.98u` dynamic lizard tail. |
| **Comfortable Jump Span** | `~2.6 – 2.9` cols | Effortless clearance across 1-column and 2-column chasm gaps from center-of-terrace takeoffs. |
| **Coyote Time & Jump Buffer** | `185ms` / `150ms` | Eliminates edge-pixel takeoff frustration while preserving crisp skill expression. |
| **Ledge-Lip Mantle** | `0.42` floors | Smoothly mantles Gateway onto terrace nosings when catching the upper lip mid-arc. |
| **5-Riser Staircase Traversal** | Automatic walk | Contiguous ascending/descending stair flights (`cell.stairDir`) allow uninterrupted running up and down real staircases while keeping jump available at any instant. |

---

## 2. Combat, Interactive Hydro-Routing & Climax Loop

- **360° Lizard Tail-Whip + Hydro-Pulse Synergy:**
  - **Tail-Whip** flips armored `snap_crab` Dredgers onto their carapaces as high-bounce springboards, deflects `barnacle_mortar` bubbles, spins **Wall Pipe-Valves**, and cracks Siphon Crystal Locks.
  - **Hydro-Pulse** encases foes (`gulp_hopper`, `volt_eel`, `rail_skater`, `vent_stalker`) inside buoyant Sea-Glass Hydro-Bubbles for safe traversal or combo knockback.
- **Environmental Hydro-Puzzles:**
  - **Live Pipe-Valve Routing** redirects pressurized water through transparent spire conduits to power mechanical elevators or raise local floodgates so Gateway can swim across broken lower spans.
  - **Gecko Wall-Scamper Strips** and **Tail-Grapple Swing Rings** open vertical and aerial shortcuts across all 10 campaign spires.
- **Playable Spire Climax (`core_descent`):**
  - Opening a spire's summit Crown Valve launches a `20–25s` vertical dive down the flooded Central Reactor Shaft to smash 3 Siphon Crystal Locks and plant the **Harmonic Water Seed**, triggering the **Spire Purification Cutscene** (`watershedHealth: 0 → 100%`).

---

## 3. Non-Redundant 6-Mode Balance Matrix

| Mode | Stakes & Timer | Checkpoints & Progression | Signature Differentiator |
| :--- | :--- | :--- | :--- |
| **`campaign`** | Balanced Siphon Clock + Shield upgrades | Act & Spire saves + Watershed Restoration | 5 Earth Water Biomes, 10 handcrafted spires, story cutscenes & Act Bosses (`siphon_warden`). |
| **`purist`** | 1-Hit KO (0 Shield), strict arcade clock | Pure single-run high-score chase | Classic high-stakes arcade skill ruleset inside the sunlit AAA 3D world with combo multipliers. |
| **`flood_rush`** | Continuous rising surge (`waterRiseRate > 0`) | Endless vertical altitude survival | High-tempo procedural spires with geyser boosts and aerial tail-grapple chains. |
| **`sanctum_trials`** | Timer-free (`∞`) meditative flow | Per-trial star mastery | Handcrafted pipe-valve routing, floodgate swimming, and aqueduct logic spires. |
| **`expedition`** | Roguelite run health & carryover | 3-Card **Bio-Mutation Draft** per spire | Stackable lizard evolutions (*Triple Tail-Whip*, *Gecko Sprint*, *Hydro-Jet Double Jump*, *Tidal Magnet*, *Bubble Aegis*). |
| **`daily_tide`** | Shared UTC seed (`getDailySeed()`) | Daily personal best & clear time | Identical worldwide spire layout + rotating daily biome modifier. |
