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
