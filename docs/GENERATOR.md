# Reboot tower generator: design

Goal: a new tower every day, and generated Reboot campaign levels, that:
- feel like the 1987 towers;
- always differ;
- have a difficulty arc;
- are always beatable;
- use the Reboot's twists, such as the tower sinking into the sea.

## 1. What the real towers teach (measured from the 8 original grids)

| Measure | Real towers |
|---|---|
| Height | 47–96 rows |
| Platform density | 1.1–1.6 cells per row (sparse: you see the brick wall, not a ledge forest) |
| Platform runs | mostly **single cells** (diagonal stairs, stepping stones); a few long ledges (7+) per tower |
| Row gaps | mostly 1 (stairs); big gaps (4–13 rows) are bridged by **lifts** |
| Lifts | 6–14 per tower; rise 2–25 rows, typically ~9; the platform is **level with the ledge** it rests in (the data draws `^` at body height on that ledge cell), so you walk on and off |
| Tunnels | 4–10 door pairs (column c and c+8); Tower 7 has none |
| Crumbling cells | almost always **single**, never side by side: hop each one |
| Flashing blocks | gate a ledge or cap a lift shaft (shoot first: a lock and its key) |
| Enemies | at fixed spots, at most 4 alive; patrollers guard columns and long ledges |

## 2. Pieces (the grammar)
Each piece is a small template with an entry, an exit and the cells it reserves. Every piece comes
from a pattern in the real towers.

| Piece | Shape | Puzzle role |
|---|---|---|
| STAIRS(n, dir) | n diagonal single-cell steps | flow, height |
| LEDGE(n) | flat run | breathing room; long ones carry patrols |
| HOP(dx, dy) | a gap to a stepping stone | timing, nerve |
| CRUMBLE BRIDGE(n) | run with single crumbling cells | commitment (hop each) |
| LIFT(rise, side) | platform level with the route, top stop, exit ledge | big height, choices |
| CAPPED LIFT | a lift with a flashing block on the shaft | lock and key (shoot, then ride) |
| GATE | flashing block across a run | lock and key |
| TUNNEL | door at c, door and exit ledge at c+8 | the 180° twist: route moves to the far side |
| DECOY DOOR | a door whose far side has no ledge (drops you) | reading the tower (Trap of Tricks) |
| DROP | a deliberate step off to a lower ledge | one-way route |
| PILLAR NOOK | pillars boxing a door or a stepping stone | walls, choke points |
| SUMMIT | exit door; on hard days a 4-door summit with a clue | finale |

## 3. Assembly: route first, then the world around it
1. **Start at the base.** A cursor (column, row, facing) starts at the base; an occupancy grid
   records solid cells and **reserved** cells (headroom above every standing cell, lift shafts,
   door fronts) so later pieces can never block the route.
2. **Build the main route.** Pick pieces from a weighted grammar that depends on the current
   **act** (below). Place a piece only if it fits (no overlap, clear headroom), then move the
   cursor to its exit. Wrap round the cylinder freely; tunnels jump the cursor to the far side.
3. **Grow branches** off the main route: decoy doors, dead-end lifts, and side ledges with
   rewards (star-fish, time). These are the "clues and mapping" layer: the player has to read the
   cylinder to see which way is up. Branches use the same pieces.
4. **Place enemies** at piece junctions, following the original's habits (all from the data):
   - a vertical patroller beside a lift column;
   - a horizontal patroller on a long ledge;
   - a rolling ball on a long run;
   - a parked ball at the top of stairs.
   They come in by act, at most 4 alive.
5. **Apply the twist** (section 5), which adjusts piece weights. For example, a sinking tower
   avoids long dead-end branches low down.

## 4. Always beatable (the math)
- **Move table.** Measured once from the game's own physics, by simulating each move in the
  engine:
  - from a standing cell, which cells (dx, dy) you can land on by walking off, stepping up, or
    jumping (with or without a run-up);
  - which needs the head clearance above.

  There is one table per physics (Original, Reboot), stored as data.
- **Grid solver.** A breadth-first search over standing cells, lift stops and tunnel exits, using
  the move table. It's fast (milliseconds), so it runs in the browser every time a tower is made.
  - A tower is accepted only if the exit is reachable from the base.
  - **Every** placed platform must be reachable too ("all the pieces are used"), as in the real
    towers (95–100%).
  - Failures are repaired (move or swap the piece) or regenerated from the next seed.
- **Offline check.** The slow, exact engine-driven check (the same one that verified the 8 real
  towers) runs on large batches of seeds to confirm the move table and solver never lie.

## 5. Difficulty arc
- **Within a tower** (acts by height):
  1. **Act I, the base (0–30%):** stairs, ledges, a first lift; no hazards.
  2. **Act II, the middle (30–75%):** tunnels, gates, capped lifts, patrollers.
  3. **Act III, the climb to the top (75–100%):** crumble bridges, combined pieces, the twist at
     full strength.
  4. **Summit:** the exit, or the 4-door summit on hard days.
- **Across the week:** Monday is short and gentle (about 45 rows); Sunday is tall and mean (about
  90 rows). The daily seed is the date, so everyone gets the same tower that day.
- **Twists rotate through the week** (Reboot mechanics; the rest of docs/TWISTS.md slots in as
  they're built):
  - **sinking tower:** the sea rises (built as flood);
  - **crumbling base:** the tower collapses from below (collapse);
  - **gale:** wind;
  - **blizzard:** gusts;
  - **night:** dark;
  - **clockwork ledges:** pistons;
  - **plain:** none.
- **Reboot campaign:** the same generator with each tower's theme and twist, 3 levels each,
  climbing in difficulty.

## 6. Checking it's good, not just beatable
For each generated tower, measure the same statistics as the table in section 1 (density, single
cells, lifts, rises, tunnels, crumble isolation) and keep them within the real towers' ranges. A
batch report compares 100 generated towers with the 8 real ones.

## 7. Build order
1. Move table measured from the engine (Reboot physics), plus the grid solver, cross-checked
   against the engine on the 8 real towers.
2. Piece templates, assembler and branches.
3. Enemies by act.
4. Daily tower: date seed, weekly arc, twist rotation; results tied to the daily trophies.
5. Reboot campaign levels from the same generator.
6. Batch statistics report and an engine-verified sample.

## 8. Status
- **Built:** generator (src/towergen.js), grid solver, daily tower (date seed, weekly arc, twist
  rotation), and enemies at the original's favourite spots.
- **Speed:** 60/60 test towers generate in 100 ms in total, each proven beatable with 100% of
  its pieces reachable.
- **Engine check:** confirmed a full week of daily towers (Monday to Sunday, 46–90 rows) is
  climbable.

## 8b. Since then
- **Lifts are level with the floor** (walk on, walk off), in the real towers and generated ones.
- **Ledges are solid from below:** the solver doesn't count on a jump or hop under a ledge 3 rows up.
- **The Reboot campaign and endless mode use this generator** (24 campaign levels, 44–85 rows).
  All 24 pass the engine-driven check (pistons counted as out: they're out 68% of each cycle).

## 9. New elements (the Reboot adds its own)
The grammar is open. Each new element becomes a **piece** (placed on the route) or a **twist**
(a rule for the whole tower), and gets measured into the solver so towers stay provably
beatable.

**Next, from docs/TWISTS.md and docs/WORLDS.md:**
- **Counter-rotating drums:** "random directions". Bands of the tower turn on their own, each
  in a random direction and speed.
- **Inversion towers:** controls or gravity flip.
- **Phase portals** (90°).
- **Pressure-plate bridges** on the far side.
- **Launch pads.**
- **Phase ledges.**
- **Tilting planks.**
- **Steam vents.**
- **Domino scaffolding.**
- **Enemies:** mimic doors, laser turrets, crawler beetles.
- **Tower shapes:** tapered and hollow-core towers.

**Game types on the same generator:**
- daily;
- time attack;
- one tall tower;
- a 10-world campaign with the sawtooth arc (Introduce, Combine, Twist, Apex).
