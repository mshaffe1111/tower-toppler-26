# Tower Toppler (Atari 7800, 1988): the original, as the reference

This is the faithfulness spec for the **Classic campaign**: the 8 original towers, rules and enemies.
Modern additions (separate jump and fire, rewind, checkpoints, charged shot, new enemies, twists) are
layered on top and can be switched off with **Classic rules**. Source: the player's own write-up of
the Atari 7800 version, plus original Amiga/ST/C64/7800/DOS screenshots (see "Look" below).

## Setting
- Port of Hewson's 1987 *Nebulus* (John M. Phillips), released on the 7800 by Atari/U.S. Gold in 1988.
- Ocean planet Nebulus. You play a frog-suited demolition operative from Destructo, Inc. ("Pogo" in
  Europe, "Sly" in 7800 guides), who arrives in the BA-1 minisub.
- Climb 8 cylindrical towers that rise out of a toxic sea. Reach the control-room door at the summit
  before the countdown runs out to trigger the tower's self-destruct.

## The rotating cylinder
- The hero stays fixed on the screen's central vertical axis.
- Walking left or right rotates the whole tower (ledges, stairs, doors, lifts and enemies) around its axis.
- The tower is a closed circular grid: walk far enough one way and you come back to where you started.

## 7800 controls (for reference; we deliberately separate Jump and Fire)
- **Left/Right:** walk around the tower (rotates the cylinder).
- **Up:** enter a doorway or tunnel when in front of it, or ride a lift up.
- **Down:** ride a lift down.
- **Fire while walking:** fixed-arc jump.
- **Fire while standing still:** snowball straight ahead.
- **Original nuance:** pressing Fire with left/right still held jumps instead of shooting, which often
  sends you off narrow ledges. That's why the reboot uses separate JUMP and FIRE.

## Tower architecture
- **Solid ledges:** horizontal platforms jutting out of the tower wall.
- **Angled stairways:** stepped platforms wrapping round the wall.
- **Lifts:** vertical platforms ridden with Up/Down. Some span several tiers; some are one-way or stop
  at fixed heights.
- **Tunnels (doorways):** Up at a doorway walks you through the tower's core and out the exact
  opposite side (180°) at the same height.
- **Slippery ledges:** no traction; you slide in the direction of momentum until you hit something,
  jump, or slide off.
- **Crumbling ledges:** start dissolving the moment you step on them.

## Falls, lives, timer, scoring
- **Falling is not death:** stepping off a ledge or touching an enemy makes you fall straight down. If
  there's a platform below at that angle you land safely, losing height and time. A life is lost only
  if you fall into the sea or the clock runs out.
- **Lives:** start with 3, plus an extra life every 5,000 points.
- **Timer:** counts down from the moment you step off the minisub onto the tower's base.
- **Points:**
  - Bouncing cannonball destroyed: 100.
  - Flashing block destroyed: 50.
  - Angled stairway, first time only: 40 per step.
  - Certain lifts: 50, plus a bonus based on ride length.
  - End of tower: time remaining, plus a technique bonus (100 base from Tower 2 on, minus 2 per enemy
    hit), plus destroyed extras.

## Submarine bonus stage
- Entering the summit door collapses the tower into the ocean. You reboard the BA-1 minisub for a
  side-scrolling underwater stage.
- Fire bubbles or snowballs to stun fish, then steer into them: 50 bonus points per fish, counting
  toward the next extra life.

## Enemies (three classes: destructible, stunnable, indestructible). Contact knocks you off your ledge.
| Enemy | Movement | Shot | Points | Beat it by |
|---|---|---|---|---|
| **Bouncing cannonball** | Moves along ledges and stairs, bouncing in steady arcs | **Destroyed** in one hit | 100 | Stop, face it, shoot; or jump over |
| **Sliding cannonball** | Slides back and forth on a fixed stretch, no bounce, often under low ceilings | **Stun only** (freezes a few seconds) | – | Stun to buy time to retreat, take a lift or a tunnel. You **can't walk through** a stunned one |
| **Flying eye** (Tower 1) | Hovers in vertical, horizontal or wave loops round the tower | **Immune** | – | Timing; wait on a safe ledge or in a doorway |
| **Mutant molecule** | Multi-orb cluster drifting diagonally or in circles across several tiers | **Immune** (not even stunned) | – | Track its cycle, duck into a tunnel, or drop to a safe ledge |
| **Vicious robot** (Tower 2) | Patrols back and forth, guards lift junctions | **Immune** | – | Jump over it, route round via lifts, tunnels or drops |
| **Flashing block** | Static block on a ledge blocking the way | **Destroyed** | 50 | Shoot it to clear the path |

## Universal strategy
- **180° tunnel pairs:** when the outside route dead-ends, look for a door on this tier or the one
  below; the route continues on the opposite side.
- **Controlled drops:** falling onto a lower ledge costs no life, so stepping off onto a known ledge
  is a real tool for passing robots and molecules.
- **Foreshortened edges:** ledges near the left and right edges of the tower are squashed by
  perspective. Check the type and look out for enemies coming round the curve.

## The 8 towers
| # | Name | Theme and hazards | Strategy |
|---|---|---|---|
| 1 | **Tower of Eyes** | Easiest. Wide solid ledges, basic stairs, lifts, flashing blocks, bouncing cannonballs, flying eyes | Learn stop-and-shoot; wait out the eyes' loops |
| 2 | **Realm of Robots** | Patrolling robots, tighter lift connections, bouncing cannonballs | Don't shoot robots; route round them with lifts, parallel ledges and tunnels |
| 3 | **Trap of Tricks** | Deceptive tunnels into dead ends, loops and drops; mutant molecules and bouncing balls | Learn the productive tunnel sequence; a molecule can knock you down onto the right tier-2 ledge |
| 4 | **Slippery Slide** | Mostly slippery ledges that keep your momentum | Short taps, counter-steer on landing, line up carefully at doors |
| 5 | **Broken Path** | Long chains of crumbling ledges | Never stop on crumbling ground; clear blocks from solid ground first, then commit |
| 6 | **Swimmer's Delight** | Few lower catch ledges, wide gaps over the sea: a miss usually means the water | Play safe: check for floor beneath; use tunnels when fliers sweep the catwalks |
| 7 | **Nasty One** | Fast mixes of robots, molecules, eyes and sliding cannonballs in tight bottlenecks | Use everything: clear blocks early, stun only to retreat, drop deliberately |
| 8 | **Edge of Doom** | Longest and hardest: slippery and crumbling ledges, trap tunnels, dense patrols, strict clock, **4-door summit puzzle** | An optimised tunnel route; at the top, the **third door from your arrival point** is the control room |

## Look (from original Amiga/ST/7800/DOS screenshots)
- **Tower:** very saturated single-colour **bricks**, a different colour per tower (red/orange with a
  yellow highlight gradient, bright green, blue on the 7800, magenta on DOS). Each brick has a bright
  top-left bevel and a dark inset edge. Running bond, about 4–5 brick rows between ledge levels, about
  6 bricks across the visible face.
- **Ledges:** cream/beige limestone slabs with a speckled texture, protruding from the wall; the same
  on every tower.
- **Lifts:** a column of stacked round cream-stone discs, with the hero riding the top disc.
- **Doors:** plain tall black rectangular openings.
- **Crown:** crenellated battlements.
- **Background:** black starry sky; sunset gradient bands (red, orange, yellow) at the horizon;
  mountain silhouettes; a deep-blue-to-cyan sea reflecting the tower.

### Measured proportions (C64 screenshot + NES "Castelian" full tower maps, measured with PIL)
Sources: vgmaps.com NES atlas (`Castelian-*.png`), retrogarden.co.uk C64 review screenshot.
- **Bricks:** 5 brick rows per floor, with the ledge taking the place of one row. Alternate rows
  offset. About 8–9 bricks visible across the face, foreshortened toward the edges; centre brick
  aspect about 3.5:1. Thin black mortar.
- **Ledges:** about one brick row thick (about 15% of the floor height), segmented, sticking out
  clearly past the tower silhouette.
- **Doors:** black rectangles about 2 bricks wide by one floor high; front and back are linked.
- **Tower top:** crenellated battlements.
- **Sky and sea:** black sky with sparse single-pixel stars. On the NES, the sea is a dithered
  gradient from the tower's dark colour to white.
- **Relative tower heights (NES maps):** Eyes 826, Trap 826, Swimmers 954, Slippery 962,
  Robots 1002, Nasty 1090, Broken Path 1218, Edge of Doom 1218 px.
- **Tower colours vary by version:** NES T1 purple, T2 blue, T3 red, T4 violet, T5 magenta,
  T6 olive, T7 green, T8 sea green; C64 T1 blue, T2 red; Amiga screenshots show red and green.
  The constant is **one strong colour per tower**.

### Measured movement (the player's two 7800 clips, frame-by-frame brick tracking)
Method: 60 fps frames, phase correlation of the brickwork to get the tower's scroll per frame.
Pogo stays fixed on screen, so the scroll is his motion.
- **Updates:** the 7800 moves the tower in coarse steps, about every 4 frames (~15 Hz).
  Sideways steps are about 1/6 of a column; vertical steps are half a brick row.
- **Stair step:** one column wide by one brick row high. Climbing pauses sideways motion for a
  few frames at each step.
- **Walking:** about 2.0 of the 7800's columns per second, or 7.1 brick rows per second. Ours
  is 2.8 of our narrower columns per second, about 7.8 rows per second.
- **Jump:** the tower turns about 8.5 brick rows per second sideways during a jump, which is
  about 3.0 of our columns per second. With our arc (1.15 steps high, 0.66 s in the air) that
  gives a 2-column hop, matching the design brief.

### What the Original mode does now
- **Jump:** a committed arc. Its sideways speed is fixed at takeoff (3.0 columns/s when
  walking, straight up from standing), it can't be steered in mid-air, and its height is fixed.
- **Falls:** walking off a ledge, or being knocked off by an enemy, drops you straight down.
- **Snowballs:** only thrown standing still. There is no charged shot and no ground-pound.
- **Points:**
  - Stairs: 40 per new step climbed on foot, first time only.
  - Lifts: 50 the first time you board each one; height gained on a lift pays nothing.
  - End of a climb: 10 per whole second left on the clock; from Tower 2 on, a technique bonus
    of 100 minus 2 per knockdown.
- **Crumbling ledges:** dissolve about 1 s after you step on them.
- **Losing a life:** you restart at the tower's base with a fresh clock.

