# Tower Toppler '26 — Classic *Tower Toppler* / *Nebulus* Design & 2008 HD Arcade Specification (`Original Mode`)

> **Document Scope & Ownership**: Canonical historical reference, gameplay mechanics ruleset, 8-tower architectural guide, MK.7 Mini-Submarine bonus stage specification, and **2007–2010 XBLA/PSN HD Arcade** visual & audio engineering spec for **Original Mode** (`era: 'original'`).
> Complements `docs/REBOOT_2026_DESIGN.md` (`era: 'reboot'`) and `docs/ARCHITECTURE_CONTRACT.md`.

---

## 0. Historical Lineage & Premise

Originally created by **John M. Phillips** and published by **Hewson Consultants** in 1987 as ***Nebulus*** (Commodore 64, ZX Spectrum, Amstrad CPC, followed by Phillips' own 16-bit Amiga and Atari ST conversions) and localized in North America by **U.S. Gold / Atari Corp.** in 1988 as ***Tower Toppler*** (notably on the **Atari 7800 ProSystem**), the game pioneered cylindrical pseudo-3D rotation in platform-puzzle design.

### The *Destructo Inc.* Mission Brief
Eight colossal cylindrical towers have been constructed illegally across an oceanic planet, poisoning the surrounding sea. Playing as **Pogo** — a diminutive, bug-eyed green amphibious operative employed by **Destructo Inc.** and equipped with a frog-suit and snowball/concussion blaster — the player deploys to the base of each tower via the experimental **MK.7 Mini-Submarine**. Pogo must scale the exterior ledges, interior through-tunnels, and vertical lifts of each tower before the mission clock expires, enter the summit control doorway to plant demolition charges, and watch the entire structure collapse brick-by-brick into the waves before boarding the MK.7 sub toward the next tower.

### Role of `Original Mode` in *Tower Toppler '26*
In *Tower Toppler '26*, **Original Mode** preserves the **authentic 16-column puzzle-platforming rules, enemy behaviors, 8 classic towers, and MK.7 Mini-Submarine bonus stage** of the 1987–1988 originals, presented with the unmistakable **crisp, glossy, vibrant 60fps 3D arcade aesthetic and punchy retro-synth audio of a 2007–2010 Xbox Live Arcade (XBLA) / PlayStation Network (PSN) HD Remake** — providing a bright, tactile, arcade-pure contrast to **Reboot Mode**'s 2026 stormy next-gen campaign.

---

## 1. Core Cylindrical Geometry, Physics, Timer, Scoring & Classic Enemy Roster

### 1.1 Exact 16-Column Cylindrical Geometry & Brick/Gap Scaling

In every classic port (C64, Atari 7800, Amiga/ST) and in `src/levels.js`, every tower is mapped onto a discrete **16-column wrapped cylinder**:

| Parameter | Classic Hardware (C64 / 7800 / Amiga) | *Tower Toppler '26* Canonical Grid (`Original Mode`) |
| :--- | :--- | :--- |
| **Circumference Columns (`COLS`)** | `16` discrete brick columns (`0..15`) | `COLS = 16` (`col` wraps continuously via `((c % 16) + 16) % 16`) |
| **Angular Sector per Column (`Δθ`)** | `360° / 16 = 22.5°` (`π / 8 ≈ 0.3927 rad`) | `COL_ANGLE = (Math.PI * 2) / 16` (`0.392699 rad`) |
| **Shortest Signed Column Delta** | Wrapped signed modulo `[-8, +8]` | `colDist(a, b)` clamped to `[-8, +8]` columns |
| **Visible Front Arc** | Front 8 columns (`±90°`) + 1 ledge lip on each horizon edge | Cylinder wall `±90°`; protruding ledges/entities visible to `±104°` (`±0.58π`) |
| **Horizontal Projection** | Orthographic cylindrical sine projection: $x = x_0 + R \sin(\Delta\theta)$ | Pogo stays horizontally centered (`camCol` tracks `player.col`); tower rotates behind Pogo |
| **Cylinder Radius vs. Floor Height** | Visually ~5.0–5.2 brick-widths wide across front diameter | `TOWER_RADIUS = 2.55`, `FLOOR_HEIGHT = 1.0` (circumference $\approx 16.02$ world units $\implies 1.00$ unit per column!) |
| **Doorway Vertical Span** | `3` brick layers tall (`1` column wide) | `1.0` col wide archway spanning `~1.8–2.2` visual brick courses above ledge |

#### Brick, Ledge & Gap Scaling Rules (The "1-Brick Gap" Law)
1. **1-Column Unit Equivalence**: With `TOWER_RADIUS = 2.55` and `FLOOR_HEIGHT = 1.0`, one angular column around the cylinder exterior equals $2\pi(2.55)/16 \approx 1.001\text{ world units}$ — creating a **1:1 square aspect ratio** between 1 column width and 1 floor step height at the cylinder face.
2. **Ledge Footprint**: Each walkable ledge tile occupies **1 column (`col` to `col + 1`, centered at `col + 0.5`)** and protrudes radially outward from the cylinder wall (`~0.38–0.45` world units), visually foreshortening at the left/right cylinder horizons (`cos(Δθ)` width compression) just like the 8-bit hardware's lookup-table sprites.
3. **Player Collision Footprint**: Pogo's horizontal support width is `~0.52–0.65` columns (centered on `player.col`), and vertical body height is `~0.85` floors.
4. **The Classic 1-Brick Gap Constraint**:
   - **1-Column Empty Gap (`col c` ledge $\rightarrow$ `col c+1` empty $\rightarrow$ `col c+2` ledge, same floor)**: **CLEARABLE** via a running jump.
   - **2-Column Empty Gap (`col c` ledge $\rightarrow$ `col c+1, c+2` empty $\rightarrow$ `col c+3` ledge, same floor)**: **UNCROSSABLE** on the same level (unless boosted down from a higher tier or carried by a high-speed conveyor). This strict geometric ceiling is the foundation of *Nebulus* route design — forcing players to use through-tower doors, elevators, or upper drop-downs rather than brute-force jumping.

---

### 1.2 Step-Up vs. Jump Arcs & Classic Controls

Classic *Tower Toppler* / *Nebulus* distinguishes sharply between **walking up stairs (Auto Step-Up)** and **leaping across gaps/hazards (Gap Jump)**:

#### A. Automatic Step-Up (`+1 Floor` Stair Hop)
- **Trigger**: Walking horizontally (`|vx| > 0`) on ground into an adjacent walkable ledge (`solid`, `ice`, `crumble`, `conveyorL/R`) located at **`floor + 1`** within `0.14 < |Δcol| <= 0.62` in Pogo's facing direction, **provided no overhead ceiling ledge blocks `(player.col, floor + 1)`**.
- **Arc & Feel**: Automatic crisp upward hop (`vy ≈ 5.8 floors/s` under `g = 16.5 floors/s²`, peaking at `~1.02 floors` in `~0.35s` with `stepUpCooldown = 0.22s`). Requires **no Jump button press**, enabling fluid rhythmic climbing up spiral staircases.
- **Classic Edge-Slip Rule**: If the player releases/reverses horizontal movement mid-step before Pogo's center crosses onto the upper ledge lip, Pogo slips back down to the originating step (`floor`).
- **Destructible Box Exception**: Flashing destructible blocks (`type: 'box'`) act as solid chest-high walls — Pogo **cannot** auto-step onto or walk through a `box`; it must be shot with a snowball (`50 pts`) or jumped over if headroom permits.

#### B. Gap Jump (`1-Column` Chasm / Hazard Leap)
- **Trigger**: Pressing `JUMP` while grounded (with `0.10–0.12s` coyote/buffer tolerance for responsive touch/gamepad play; `0.0s` strict option if desired).
- **Kinematics**:
  - Horizontal walk speed: `moveSpeed = 4.4 cols/s`
  - Takeoff vertical velocity: `vy = 7.6 floors/s`, Gravity: `g = 16.5 floors/s²`
  - **Peak Apex**: $h_{\max} = \frac{7.6^2}{2 \times 16.5} \approx \mathbf{1.75\text{ floors}}$ (un-cut full hold) or **$\approx 1.20\text{–}1.35\text{ floors}$** classic fixed arc — high enough to clear a rolling cannonball (`height ~0.65`) or reach a `+1 floor` ledge across a 1-column gap, **never high enough to reach `+2 floors` directly**.
  - **Horizontal Span**: Full flight time $T = \frac{2 \times 7.6}{16.5} \approx 0.92\text{ s}$ covers $\sim 1.9\text{–}2.0\text{ columns}$ center-to-center, reliably spanning a **1-brick empty column** (`Δcol = 2.0` from ledge center `c + 0.5` to `c + 2.5` with lip overlap) while falling short of a **2-brick empty gap** (`Δcol = 3.0`).
- **Classic Commitment vs. Variable Cut**: On original C64/7800 hardware, horizontal jump arcs are committed parabolic trajectories once launched (releasing Jump early in `Original Mode` applies at most a subtle apex trim while preserving horizontal gap reach).

#### C. Control Mapping Lineage
- **1-Button Joystick (1987 C64 / Amiga / Atari ST)**:
  - `Left / Right`: Rotate-walk around cylinder.
  - `Up`: Enter doorway (when in front of door) OR drive elevator upward.
  - `Down`: Drive elevator downward.
  - `Fire + Left/Right`: Gap Jump.
  - `Fire (Stationary)`: Shoot snowball (and recall nearby elevator).
- **2-Button Arcade / Atari 7800 ProSystem / *Tower Toppler '26* Standard**:
  - Decouples **Button 1 (`JUMP`)** and **Button 2 (`FIRE`)**, allowing Pogo to perform **stationary vertical hops** over oncoming Rolling Cannonballs and **fire snowballs while walking or mid-air**, plus recall adjacent elevators with `FIRE`.

---

### 1.3 Falling Behavior: Landing on Lower Ledges vs. Falling into the Sea

One of *Nebulus*'s defining design pillars is that **enemies do not deal health damage or instant death on contact** — gravity and tower architecture determine your fate:

1. **Enemy Collision = Tumble / Knockdown**:
   - Touching any active enemy (even stunned/frozen hazards in strict hardware, though stunned bouncers are safe hurdles when jumped) triggers a **knockback tumble**: Pogo cries out, loses footing, receives a brief lateral/upward bump (`vy ≈ 3.8–4.2`, `vx ≈ ±3.5` away from impact, `knockbackTimer ≈ 0.18s`), and drops downward under gravity.
2. **Saved by a Lower Ledge (`floor >= 0`)**:
   - As Pogo tumbles downward, the collision solver continuously checks intact walkable ledges (`solid`, `ice`, `crumble`, `conveyorL/R`) and elevator platforms directly beneath Pogo's column (`|colDist| < 0.66`).
   - If **any intact ledge** lies anywhere below Pogo — whether 1 floor down or 14 floors down — **Pogo lands safely on that ledge with zero fall damage!**
   - The penalty is **lost vertical progress and lost clock seconds** (plus `-2` Technique bonus points), creating intense emergent drama as a hit near the summit sends Pogo tumbling past 6 tiers before catching a narrow brick lip just above the waves.
   - *Note*: Landing on a `crumble` ledge immediately triggers its `0.48s` crumble countdown, forcing instant recovery!
3. **Plunging into the Toxic Sea (`floor < -0.55`)**:
   - If **no ledge or elevator** intercepts Pogo's fall all the way past Floor `0`, Pogo plunges straight into the churning sea at the base of the tower with a dramatic splash (`SPLASH!`).
   - **Result**: Immediate loss of **1 Life**.
   - **Original Mode Respawn Rule**: In strict classic *Tower Toppler* / *Nebulus*, drowning in the sea or running out of time **restarts the current tower from the Floor 0 spawn point (`spawn.col, spawn.floor`) with a fresh timer (`tower.timeLimit`)** and restored destructible blocks (whereas `Casual / Checkpoint` assist respawns at `safeCol, safeFloor`). `Original Mode` defaults to **Base Restart on Death** (with intact score) for authentic arcade tension.

---

### 1.4 Countdown Timer & Anti-Stall Enforcement

1. **Per-Tower Mission Clock**:
   - Each tower assigns a fixed `timeLimit` (`90` to `120` seconds, scaling with tower height from 17 to 21+ floors).
   - Counts down at `1.0 unit / real second` during active `tower` play (pauses during interior door transitions, topple cutscenes, and pause menu).
   - **Low-Time Urgency (`timer <= 15s`)**: HUD timer flashes red/amber and emits a crisp 1Hz warning beep (`<= 5s` doubles to 2Hz).
   - **Time Expiration (`timer <= 0`)**: Triggers `TIME UP!`, deducts **1 Life**, and restarts the tower with full `timeLimit`.
2. **Classic Anti-Stall / Anti-Camping Rule (The Lingering Eye)**:
   - In classic *Nebulus* / *Toppler*, active on-screen enemies are capped (~4–6 simultaneous threats) and players might try to camp indefinitely on a safe ledge waiting for perfect cycles.
   - If Pogo remains within `±0.5 floors` of the same vertical height for **`> 7.5 seconds`**, the nearest **Flying Eye (`eye`)** (or an off-screen patrol Eye) smoothly adjusts its `baseFloor` toward `player.floor` (`0.8 floors/s` vertical drift) and sweeps horizontally across Pogo's tier, forcing continuous upward momentum!

---

### 1.5 Authentic Scoring System & Extra Life Threshold

Synthesizing the official **Atari 7800 *Tower Toppler* Manual**, the **Commodore 64 / Amiga *Nebulus* scoring routines**, and *Tower Toppler '26* HUD popups:

| Scoring Event | Classic Manual / C64 Value | `Original Mode` Canonical Implementation | Popup / Notes |
| :--- | :--- | :--- | :--- |
| **Destroy Flashing Block (`box`)** | `50 pts` (+2 C64 Extra pts) | **`50 pts`** | `+50` yellow arcade popup; block permanently cleared for current attempt |
| **Destroy Rolling Cannonball (`roller`)** | `100 pts` (Atari 7800 Manual) | **`100 pts`** | `+100` cyan arcade popup; shatters into glossy fragments |
| **Stun Bouncing Ball (`bouncer`)** | `100 pts` (7800 Manual) | **`100 pts`** (awarded once per stun cycle) | `+100` emerald popup; freezes bouncer in place for `3.0s` |
| **First-Time Stair / New Max Floor** | `40 pts` per new row climbed | **`40 pts`** per new `maxFloorReached` on current attempt | Silent HUD tally (prevents infinite step-up farming!) |
| **First-Time Elevator Boarding** | `50 pts` + ride distance | **`50 pts`** first time riding each shaft (`+10 pts/floor` ascended) | `+50` subtle lift bonus |
| **Submarine Fish (Bubble + Catch)** | `50 pts` (7800) / `50–75 pts` (C64) | **`100 pts`** standard fish / **`200 pts`** golden dart-fish | Up to ~28–30 fish per intermission (`~3,000 pts` max skill ceiling) |
| **Tower Topple Demolition Base** | Included in clear tally | **`500 pts`** | Awarded upon entering summit exit door |
| **Remaining Time Bonus** | `10 × remaining seconds` | **`10 × Math.ceil(timer)` pts** | Ticks down rapidly on HUD during tower collapse sequence! |
| **Technique Bonus (Towers 2–8)** | `10 × technique` (starts `100`, `-2`/hit) | **`10 × Math.max(0, 100 - hitsTaken * 2)` pts** (Towers 2–8; `0` on Tower 1) | Authentic C64/Amiga flawless-climb reward (`+1,000 pts` max for 0 hits!) |
| **Extra Life Threshold** | **Every `5,000 points`** | **Every `5,000 points`** (`nextExtraLife += 5000`) | Starting lives = `3`, maximum cap = `6`; plays classic 6-note fanfare |

> **Design Note on Combo Multipliers**: While `Reboot Mode` uses modern `1x–4x` arcade combo chains, `Original Mode` uses **pure deterministic classic point values** (plus the authentic C64 **Time + Technique** end-of-tower bonus tally) so high-score hunting mirrors 1988/2008 XBLA leaderboards!

---

### 1.6 Classic Enemy Roster & Snowball Interaction Rules

Pogo's weapon fires a fast horizontal **Snowball / Concussion Orb** (`speed = 8.5 cols/s`, range `~9.3 cols` / `life = 1.1s`, `fireCooldown = 0.25s`, max 2 active snowballs on screen in classic mode). Crucially, **most creatures guarding the towers are completely impervious to Pogo's weapon**.

#### Complete Snowball Interaction Matrix

| Entity Type (`levels.js` key) | Classic Name | Movement Pattern | Snowball Result | Points |
| :--- | :--- | :--- | :--- | :--- |
| **`box`** (ledge tile) | **Flashing Block** | Stationary pulsing barrier on ledge; blocks walking & step-up | **DESTROYED** (shatters permanently) | **`50 pts`** |
| **`roller`** | **Rolling Cannonball** | Rolls steadily along ledges (`1.5–2.6 cols/s`); drops down step edges or wraps | **DESTROYED** (explodes on hit; respawns at chute after `8s` if spawner-fed) | **`100 pts`** |
| **`bouncer`** | **Bouncing Ball** | Hops rhythmically (`|sin(t·4.5)| · 0.65` floors) while patrolling (`1.4–2.3 cols/s`) | **STUNNED** (frozen motionless for **`3.0s`**, then resumes bouncing) | **`100 pts`** |
| **`eye`** | **Flying Eye** | Unblinking disembodied eyeball; sweeps horizontally (`1.6–2.7 cols/s`) & tracks lingering player height | **IMMUNE** (snowball deflects/fizzles harmlessly on cornea) | `0 pts` |
| **`molecule`** | **Mutant Molecule** | Multi-atom geometric lattice bobbing sinusoidally (`±0.35–0.50` floors) around mid-air lanes | **IMMUNE** (snowball shatters on atomic ring with spark) | `0 pts` |
| **`robotH`** | **Horizontal Robot** | Armored mechanical droid patrolling strictly edge-to-edge along a single contiguous ledge span | **IMMUNE** (snowball ricochets off metal hull with clang) | `0 pts` |
| **`robotV`** | **Vertical Robot** | Piston/diamond sentinel oscillating vertically (`minFloor ↔ maxFloor`) inside a fixed column gap | **IMMUNE** (snowball ricochets off metal hull with clang) | `0 pts` |

> **Historical Port Note (Atari 7800 vs. C64/Amiga Spheres)**: On C64/Amiga, flickering purple jumping balls shatter when shot while solid silver rolling spheres freeze in place; in the North American Atari 7800 *Tower Toppler* manual and `src/game.js`, **Rolling Cannonballs (`roller`) are destroyed (`100 pts`)** and **Bouncing Cannonballs (`bouncer`) are temporarily stunned (`3.0s`)**. *Tower Toppler '26* standardizes on `roller = DESTROYED` and `bouncer = STUNNED (3.0s)` across the codebase for 100% visual clarity (armored dark-chrome cannonballs shatter; bright elastic energy-spheres freeze).

#### Detailed Classic Enemy Behaviors
1. **Flying Eyes (`eye`)**:
   - **Visual**: Large glossy white eyeball with a vivid tracking iris/pupil that rotates continuously to stare directly at Pogo (`player.col, player.floor`).
   - **Behavior**: Sweeps smoothly around the cylinder (`col = wrapCol(col + dir * speed * dt)`), ignoring gaps and walls. When Pogo stalls on the same floor for `> 7.5s`, the Eye slowly converges vertically (`±0.8 floors/s`) onto `player.floor + 0.35` to flush Pogo out.
2. **Mutant Molecules (`molecule`)**:
   - **Visual**: Geometric cluster of 4–6 glossy colored spheres (covalent atomic lattice / rotating tetrahedral diamond) orbiting a glowing nucleus.
   - **Behavior**: Orbits horizontally around the tower while oscillating vertically via `floor = baseFloor + Math.sin(time * 3.0 + phase) * amp` (`amp = 0.35–0.50`). Placed across jump chasms and doorway exits so the player must read the sine wave and pass underneath at peak crest or jump over at trough.
3. **Rolling Cannonballs (`roller`)**:
   - **Visual**: Heavy dark-chrome / gunmetal sphere with rotating specular bands.
   - **Behavior**: Hugs the ledge surface (`floor = ledge.floor`), rolling at `1.5–2.6 cols/s`. In bounded ledge mode (`minCol..maxCol`), reverses at ledge ends or step walls; in chute mode, rolls off step lips, drops under gravity to the next lower ledge, and eventually splashes into the sea before respawning at its top chute. **Primary target for Pogo's snowball gun** when trapped on narrow corridors.
4. **Bouncing Balls (`bouncer`)**:
   - **Visual**: Vibrant magenta/purple glossy sphere that squashes on each ledge bounce.
   - **Behavior**: Travels horizontally (`1.4–2.3 cols/s`) while executing continuous rectified-sine hops (`floor = baseFloor + Math.abs(Math.sin(time * 4.5 + phase)) * 0.65`). Hitting it with a snowball freezes it at its current `(col, floor)` for `3.0s` with an icy/electric shimmer, letting Pogo leap cleanly over it.
5. **Horizontal Robots (`robotH`)**:
   - **Visual**: Classic *Realm of Robots* blocky anodized-steel security droid with twin optic visors and motorized treads.
   - **Behavior**: Bound strictly to a contiguous platform span (`minCol` to `maxCol` on a single `floor`). Patrols at `1.4–2.4 cols/s`, pausing `0.15s` at each ledge edge before reversing `dir *= -1`. Because it is **immune** to snowballs and occupies `0.8` floors of height, Pogo must either **jump cleanly over it** mid-stride or wait inside an alcove/elevator until it marches past.
6. **Vertical Robots (`robotV`)**:
   - **Visual**: Cylindrical/diamond chrome sentinel with pulsing equatorial warning ring and top/bottom thruster cones.
   - **Behavior**: Locked to a single `col` (`col + 0.5`), oscillating vertically between `minFloor` and `maxFloor` (`floor = mid + Math.sin(time * speed + phase) * halfSpan`). Positioned inside **1-brick jump gaps** or directly in front of **elevator shafts**, requiring timed horizontal leaps while the sentinel is at the bottom or top of its stroke.

---

## 2. All 8 Original Towers & MK.7 Mini-Submarine Bonus Stage

### 2.1 Authentic Interactive Tower Mechanics

1. **Through-Tower Tunnels & Trick Doors (`doors`)**:
   - Arched doorways recessed into the cylinder brickwork (`UP` when grounded within `|colDist| < 0.72` and `|Δfloor| < 0.5`).
   - **Standard Tunnels**: Walk Pogo into the dark interior (`0.35–0.55s` smooth camera wrap around the tower exterior) to emerge at the paired `targetId` doorway — classically **180° across the hollow tower (`(col + 8) % 16`)** or diagonal interior stairs (`+2` to `+4` floors higher) bypassing unjumpable exterior walls.
   - **Trick Doors**: Identical-looking doorways (prominent from Tower 3 *Trap of Tricks* onward) whose `targetId` drops Pogo **downward** back to Floor `0`, traps Pogo in a sealed dead-end loop, or deposits Pogo directly onto a **crumbling ledge** above open ocean!
   - **Summit Exit Door (`isExit: true`)**: Located at the apex platform; entering triggers the **Tower Topple Demolition Sequence**.
2. **Crumbling / Dissolving Ledges (`type: 'crumble'`)**:
   - Scored/segmented brittle bricks. The instant Pogo lands or steps onto one, `crumbling = true` starts a **`0.48s` vibration countdown** before the brick dissolves (`gone = true`, respawning after `4.0s`).
   - **Tactical Rule**: Never stop on a crumbling brick — continuous walking (`4.4 cols/s` crosses 1 brick in `0.23s`) or immediate jumping clears 2–3 consecutive crumbling bricks safely, whereas hesitating drops Pogo straight through!
3. **Slippery / Ice Ledges (`type: 'ice'`)**:
   - Frosted low-friction ledges (`vx = vx * 0.94 + targetVx * 0.08`). Stopping input leaves Pogo sliding ~1.0–1.5 columns before halting; players must tap-feather movement or counter-steer (`opposite D-pad`) upon landing.
4. **Directional Conveyor Ledges (`type: 'conveyorL' | 'conveyorR'`)**:
   - Motorized belt ledges applying continuous lateral drift (`±1.5 cols/s`), extending jumps with the belt and compressing jumps against the belt.
5. **Recallable Elevators (`elevators`)**:
   - Vertical platform lifts riding grooved rails in column `el.col` between `minFloor` and `maxFloor`.
   - **Manual Ride Control**: Standing on the lift (`onElevator`), holding `UP` drives it toward `maxFloor` and holding `DOWN` drives it toward `minFloor` (classic *Nebulus* lifts wait at stations or patrol gently; manual input always takes priority).
   - **Classic Snowball/Fire Recall**: If an elevator platform is above or below Pogo while Pogo stands adjacent to its shaft (`|colDist(player.col, el.col + 0.5)| < 1.15`), pressing **`FIRE` recalls the lift rapidly (`1.6x` speed) directly to `clamp(player.floor, minFloor, maxFloor)`**!
6. **Tower Topple Demolition Sequence**:
   - Entering `isExit: true` triggers detonation: the tower shakes violently, debris showers outward, the remaining clock rapidly converts into `10 × seconds` bonus points, and the entire 16-column cylinder **collapses downward row-by-row into the churning sea** over `2.6s` until the roof submerges completely!

---

### 2.2 Complete Guide to All 8 Original Towers

| # | Classic Tower Title | Brick / Ledge Arcade Palette | Floors | Timer | Signature Mechanics & Enemy Debut |
| :-: | :--- | :--- | :-: | :-: | :--- |
| **1** | **The Tower of Eyes** | Royal Cobalt Blue / Sky-Blue | `17` | `90s` | Onboarding climb, early dissolving-ledge bait, first tunnel, **Flying Eyes**, **Rollers**, **Bouncers**, **Molecules** |
| **2** | **The Realm of Robots** | Cyber Violet / Electric Cyan | `18` | `95s` | **Horizontal & Vertical Robots** debut, **Flashing Block (`box`)** gate, multi-lift sync, spiral upper stairs |
| **3** | **Trap of Tricks** | Emerald Green / Gold Amber | `18` | `100s` | **Trick Loop Doors** (false door drops to Floor 0!), baited lifts, split real-vs-decoy pathways |
| **4** | **Slippery Slide** | Glacier Cerulean / Frost White | `18` | `100s` | **Slippery Ice Ledges** across ~70% of tower; momentum braking on solid door thresholds, ice-to-lift transfers |
| **5** | **Broken Path** | Crimson Brick / Pale Coral | `19` | `105s` | Segmented **Crumbling Bridges**, mandatory 1-brick chasm jumps, Vertical Robot gap sentries |
| **6** | **Swimmer's Delight** | Deep Ocean Teal / Toxic Lime | `19` | `110s` | Opposing **Conveyors**, ice-into-crumble traps, unshielded high-altitude sea drops (zero safety ledges below!) |
| **7** | **Nasty One** | Magma Orange / Bright Yellow | `20` | `115s` | Brutal gauntlet fusing ice, crumble, conveyors, Trick Doors, Robots, and overlapping Eye/Molecule lanes |
| **8** | **Edge of Doom** | Midnight Maroon / Neon Magenta | `21` | `120s` | Grand Finale: twin multi-stage recallable lifts, razor-thin 1-brick ice/crumble spires, peak-speed full enemy roster |

#### Per-Tower Architectural & Progression Breakdown

1. **Tower 1 — *The Tower of Eyes*** (`90s`, 17 Floors, Cobalt Blue `#1d4ed8` / Sky `#60a5fa`)
   - **Classic Layout**: Spawns at Floor `0` (`col 0`). Moving right introduces auto-step-up stairs (`Floors 0→5`), while an early **crumbling decoy span (`Floor 6, cols 8–9`)** punishes careless sprinting just before the first true interior tunnel (`col 12, Floor 6 → col 4, Floor 8`).
   - **Progression**: Teaches shooting a `roller` on Floor `1`, timing a `molecule` at Floor `4.5`, stunning a `bouncer` at Floor `8`, ducking/waiting past invincible `eye` patrollers on upper tiers (`Floor 11`), and recalling/riding the final `col 8` elevator (`Floors 12→15`) to the `col 10, Floor 15` summit door.

2. **Tower 2 — *The Realm of Robots*** (`95s`, 18 Floors, Cyber Violet `#6d28d9` / Cyan `#22d3ee`)
   - **Classic Layout**: Splits left/right off spawn toward an early long-stroke elevator (`col 1, Floors 3→7`) guarded by a **Vertical Robot (`robotV`)** oscillating across the approach gap, followed by narrow ledges patrolled by **Horizontal Robots (`robotH`)**.
   - **Key Puzzle**: Floor `9` features a **Flashing Destructible Block (`box` at `col 11`)** sealing off the step-up to the `col 13, Floor 10 → col 5, Floor 12` through-tunnel. Above Floor `12`, an exposed 4-step spiral staircase (`cols 8→11, Floors 13→16`) demands crisp auto-step pacing under a sweeping `molecule` to reach `col 14, Floor 16`.

3. **Tower 3 — *Trap of Tricks*** (`100s`, 18 Floors, Emerald `#047857` / Gold `#fbbf24`)
   - **Classic Layout**: Introduces **architectural deception**. Floor `4` presents two neighboring doorways: **Door `t3trick` (`col 1, Floor 4`)** is a classic *Nebulus* trap tunnel that dumps Pogo all the way back down to **`col 15, Floor 0`**, whereas **Door `t3a` (`col 3, Floor 4`)** ascends cleanly to `col 11, Floor 7`!
   - **Upper Trap**: A second decoy tunnel or crumbling bait (`Floors 9 & 15`) flanks the `col 12` recallable elevator (`Floors 10→14`), with a `robotH` and `eye` pressuring anyone who pauses to guess which door is real.

4. **Tower 4 — *Slippery Slide*** (`100s`, 18 Floors, Glacier Blue `#0284c7` / Crystalline Ice `#e0f2fe`)
   - **Classic Layout**: Almost every horizontal run (`Floors 1, 2, 4, 8, 10, 12, 14, 16`) is glazed **Slippery Ice (`ice`)**, punctuated only by rare `solid` braking islands (`Floors 3, 9, 15`).
   - **Signature Challenge**: Jumping across 1-brick chasms onto 3-column ice ledges requires counter-tapping immediately on touchdown so Pogo doesn't skate straight off the far lip into the sea, especially when boarding the `col 6` (`Floors 4→8`) elevator or lining up `UP` inside the `col 15, Floor 10` doorway!

5. **Tower 5 — *Broken Path*** (`105s`, 19 Floors, Crimson `#991b1b` / Pale Coral `#fca5a5`)
   - **Classic Layout**: A vertical Swiss-cheese ruin where continuous walkways are replaced by alternating `2-column` **Crumbling Bridges (`crumble`)** (`Floors 1, 3, 8, 14, 16`) and `1-brick` open-air gaps.
   - **Signature Challenge**: Stopping to shoot on a `crumble` bridge is fatal; players must pre-clear `roller` cannonballs from `solid` anchor islands (`Floors 2, 4, 7, 9, 13, 15`), sprint nonstop across dissolving spans, and time a `robotV` guarding the `col 11` (`Floors 9→13`) lift shaft.

6. **Tower 6 — *Swimmer's Delight*** (`110s`, 19 Floors, Deep Teal `#0f766e` / Toxic Lime `#a3e635`)
   - **Classic Layout**: Named with peak 1980s British irony — because **high-altitude columns intentionally omit lower ledges beneath jump gaps**, meaning a single mistimed jump or `eye` bump at Floor `13–16` sends Pogo plummeting 15 stories straight into the sea ("going for a swim")!
   - **Signature Challenge**: Combines clockwise & counter-clockwise **Conveyor Belts (`conveyorR` / `conveyorL` on Floors 1, 3, 13)** with `crumble` (`Floors 8, 15`) and `ice` (`Floor 9` tunnel threshold), requiring full-circumference wraps around the cylinder.

7. **Tower 7 — *Nasty One*** (`115s`, 20 Floors, Magma Orange `#c2410c` / Sulfur Yellow `#fde047`)
   - **Classic Layout**: Relentless late-game synthesis. Every tier switches surface physics (`ice` Floor 1 $\rightarrow$ `crumble` Floor 2 $\rightarrow$ `solid` lift entry Floor 3 $\rightarrow$ `conveyorL` Floor 9 $\rightarrow$ Trick vs. True Door choice on Floor 10).
   - **Signature Challenge**: High-velocity `molecule` (`2.6–2.7 cols/s`), `eye` (`2.6 cols/s`), `robotH`, and `roller` lanes overlap at elevator exits (`col 13, Floor 8`) and summit approaches (`Floors 14–18`), punishing any wasted second on the `115s` timer.

8. **Tower 8 — *Edge of Doom*** (`120s`, 21 Floors, Midnight Maroon `#9d174d` / Electric Cyan-White `#38bdf8`)
   - **Classic Layout**: The ultimate Destructo Inc. exam. Features **two separate multi-floor elevators** (`col 1, Floors 4→9` and `col 11, Floors 16→19`), a mid-tower interior warp (`col 10, Floor 11 → col 2, Floor 14` onto pure `ice`), Trick Door traps, Flashing `box` roadblocks, `robotV` chasm sentries, and `2.8–2.9 cols/s` apex `molecule` & `eye` guardians protecting the `col 13, Floor 19` demolition room.

---

### 2.3 Authentic MK.7 Mini-Submarine Bonus Stage

Triggered automatically after toppling **Towers 1 through 7** (7 intermissions total; toppling Tower 8 triggers final Mission Victory):

1. **Setting & Transit**:
   - Side-scrolling underwater transit (`duration = 14.0s`) as Pogo pilots the iconic yellow-and-cyan **MK.7 Mini-Submarine** left-to-right from the rubble of the demolished tower to the submerged foundation of the next tower.
   - **Zero Life-Loss Penalty**: Unlike `Reboot Mode`'s hazard-filled *MK.7 Sub-Hunter*, the classic bonus stage is a pure **skill-based extra-life point harvest** with no mines or hull damage.
2. **Authentic Two-Step Catch Loop (Bubble-Encase $\rightarrow$ Collect)**:
   - **Step 1 — Shoot Air Bubbles (`FIRE`)**: Pressing `FIRE` launches a translucent compressed-air torpedo bubble horizontally from the bow nozzle (`vx = 280 px/s`, `fireCooldown = 0.22s`).
   - **Step 2 — Encase Fish**: Direct contact (`radius < 22px`) between an air torpedo and a wild swimming fish **traps/numbs the fish inside a buoyant air sphere** (`f.bubbled = true`).
     - *Crucial Classic Rule*: Touching an **un-bubbled** fish with the submarine hull **does NOT catch it** — fish slip right past the sub unless encased in a bubble first!
     - Once bubbled, the fish's horizontal swim speed drops by `65%` and buoyancy gently lifts it upward (`vy = -22 px/s`), risking escape off the top water surface if Pogo waits too long!
   - **Step 3 — Collect Bubbled Fish**: Steering the MK.7 hull (`8-way smooth D-pad/stick, 195 px/s`) into a **bubble-encased fish** (`radius < 32px`) pops the bubble with a sparkling chime and awards bonus points!
3. **Classic Fish Schools (~28–30 Fish per Voyage)**:
   - **Neon Reef Minnows (Emerald / Sky-Blue)**: Steady horizontal swimmers (`100 pts` arcade / `50 pts` strict manual), spawned in staggered 3-fish diagonal ribbons.
   - **Sine-Wave Angelfish (Magenta / Rose)**: Undulate vertically (`y = y0 + sin(t * 4) * 28px`), requiring predictive bubble lead shots (`150 pts`).
   - **Golden Dart-Puffers (Gold `#fbbf24`)**: Fast, compact deep-water prizes (`200 pts`) that streak across the lower seabed silhouette.

---

## 3. Aesthetic & Audio Spec for `Original Mode` (2007–2010 XBLA / PSN HD Arcade Era)

To make switching between **Original Mode (`era: 'original'`)** and **Reboot Mode (`era: 'reboot'`)** feel like switching between two genuinely distinct eras of game craftsmanship (think *Halo: Combat Evolved Anniversary* or *Wonder Boy: The Dragon's Trap* era-toggle, anchored in 2008 HD Arcade classics like *Pac-Man Championship Edition*, *Bionic Commando Rearmed*, *Super Stardust HD*, and *Q*bert / Frogger XBLA*), `Original Mode` enforces the following dedicated visual and audio specification:

### 3.1 Visual Specification (`GameRenderer` with `era: 'original'`)

| Visual Pillar | `Original Mode` (**2007–2010 XBLA/PSN HD Arcade**) | `Reboot Mode` (**2026 Next-Gen Atmospheric**) |
| :--- | :--- | :--- |
| **Surface Materials** | **Crisp, glossy, clean bevel-chamfered 3D blocks** (`roughness: 0.24`, `metalness: 0.18`); zero moss, rust, cracks, or grime | Weathered dark indigo slate stone, damp moss patches, rusted iron pipes, high-detail organic bump/roughness |
| **Color Saturation** | **Vibrant jewel-toned arcade palettes** specific to each of the 8 classic towers; high-contrast clean dark mortar | Moody nocturnal indigo/purple-slate masonry lit by warm amber cages and eerie cyan/purple bioluminescence |
| **Lighting & Fog** | **Bright, clean 3-point studio arcade lighting** (`exposure: 1.08`), sharp specular highlights, clean sky horizon (minimal/no murky fog) | Stormy moonlit night, dramatic volumetric mist, spark-showering tunnels, heavy atmospheric depth fog |
| **Sky & Ocean** | **Deep cosmic-cobalt to royal-azure gradient** with crisp twinkling arcade stars & **glossy stylized cyan/blue rolling wave bands** | Storm clouds, glowing full moon, drifting fireflies, churning dark ocean with crashing white-foam breakers |
| **Pogo Character** | **Classic Toy-Gloss Arcade Pogo**: smooth bright emerald-green bulbous body, huge glossy white eyes, orange webbed boots & snout tube | **Next-Gen Hierarchical Skeletal Pogo**: detailed skin textures, crest, tactical harness, backpack & glowing blaster |
| **Elevators & Doors** | **Sleek anodized arcade platform lifts** with glowing neon side-rails & clean recessed black archways | Industrial iron-cage lifts with vertical cables & warm golden halo rings; misty carved stone portals |

#### Exact Three.js Shader & Material Parameters (`era: 'original'`)
1. **Glossy Beveled Tower Bricks**:
   - Procedural `512×512` crisp geometric brick canvas: sharp `45°` bevel highlight (`rgba(255,255,255,0.42)` top/left, `rgba(0,0,0,0.48)` bottom/right), uniform clean mortar lines (`pal.mortar`), **zero organic noise/moss**, and crisp neon accent trims (`pal.glow`) every 4th course.
   - Material: `MeshStandardMaterial({ roughness: 0.25, metalness: 0.16, bumpScale: 0.035, emissiveIntensity: 0.35 })` — producing that signature **2008 glossy plastic/enamel arcade cabinet sheen** under directional specular light!
2. **Extruded Arcade Ledges**:
   - Crisp chamfered box wedges (`solid`: glossy `pal.ledge` body with bright `pal.ledgeTop` cap; `crumble`: bright amber/gold segmented warning stripes; `ice`: mirror-gloss `#e0f2fe` with `roughness: 0.08, metalness: 0.25`; `conveyor`: crisp scrolling neon chevrons; `box`: high-visibility 8Hz strobing yellow/white/cyan arcade cube!).
3. **2008 Studio 3-Point Lighting Rig**:
   - `HemisphereLight('#7dd3fc', '#0a1938', 0.72)` — clean, shadow-lifting sky bounce so back-edges stay readable.
   - `DirectionalLight('#ffffff', 1.35)` at `(9, 15, 12)` — crisp white key light producing bright specular glints on bricks, cannonballs, and Pogo's eyes.
   - `DirectionalLight(pal.glow, 0.85)` at `(-9, 6, -6)` — saturated per-tower colored rim light wrapping the cylinder silhouette.
   - `toneMappingExposure = 1.08`, distant clean `Fog('#071430', 34, 85)` (never obscuring active tower geometry).
4. **Glossy Arcade Enemies**:
   - `roller`: Mirror-polished gunmetal chrome sphere (`metalness: 0.82, roughness: 0.14`) with equatorial groove.
   - `bouncer`: Candy-gloss translucent/lacquered magenta sphere (`#d946ef`, `roughness: 0.12`) with crisp squash-and-stretch.
   - `eye`: Pristine glossy porcelain-white eyeball (`roughness: 0.10`) with bright cobalt/emerald iris and sharp corneal highlight dot.
   - `molecule`: Vibrant primary-colored glossy spheres (`#f43f5e`, `#38bdf8`, `#facc15`) linked by glowing chrome rods.
   - `robotH` / `robotV`: Clean retro-futuristic anodized silver/cyan droids with glowing visor strips.

---

### 3.2 Audio Specification (`SoundEngine` with `era: 'original'`)

While `Reboot Mode` features a lush, wet, atmospheric 2026 chill-synthwave / dark-cinematic soundscape (`112 BPM`, warm detuned triangle pads, long space reverb), **`Original Mode` switches `SoundEngine` to a punchy, dry-forward 2008 XBLA/PSN Retro-Synth & Chiptune-HD Soundbank**:

#### A. Musical Direction (John M. Phillips 1987 SID/Paula Homage $\times$ 2008 HD Electro-Arcade)
- **Tempo & Groove**: Upbeat **`128 BPM`** 16th-note driving arcade sequencer (`stepDur = 60 / 128 / 4 ≈ 0.1172s`).
- **Mix Bus**: Tight, punchy, front-of-speaker arcade mix — `sfxReverbGain = 0.05`, `musicReverbGain = 0.07` (short crisp room reflection rather than lush cinematic tail).
- **Instrumentation**:
  1. **Punchy Octave-Jumping PWM/Saw Bass**: Crisp `sawtooth` + `square` sub-layer through a snappy lowpass envelope (`cutoff: 950Hz → 280Hz`, zero muddy sub-boom) playing driving root-octave 8th/16th patterns (`C minor / A minor` heroic arcade progression, transposed per tower `[0, +2, +3, +5, -2, +4, +7, +5]` semitones).
  2. **Signature C64 SID Rapid Arpeggio Voice**: Crisp `square` wave cycling 3-note chord triads (`[0, 3, 7]` / `[0, 4, 7]` / `[0, 5, 9]`) at rapid 32nd-note / 50Hz chiptune shimmer (`gain: 0.024`, bandpass/lowpass `2400Hz`) — instantly evoking John M. Phillips' iconic C64 *Nebulus* title synth!
  3. **2008 XBLA Electro-Arcade Drums**: Tight pitch-snapped electronic kick (`150Hz → 48Hz` in `0.085s`), snappy crisp white-noise arcade snare (`bandpass 2200Hz`, `0.055s`), and crisp closed chiptune hi-hats (`highpass 6500Hz`, `0.022s`).
  4. **MK.7 Mini-Submarine Bonus Theme**: Switches automatically during `mode === 'submarine'` to a **bouncy, major-key (`F major / C major`) calypso-synth marimba + bubbly FM bass groove at `132 BPM`**, giving the intermission a joyful classic arcade bonus-stage identity!

#### B. 2008 HD Arcade SFX Synthesis Table (`era: 'original'`)

| SFX Method | 2008 Arcade Timbre & Waveform Recipe | Pitch / Filter Envelope | Duration |
| :--- | :--- | :--- | :-: |
| `stepUp()` | Crisp `square` + `triangle` blip | `330Hz → 495Hz` (perfect 5th hop) | `0.075s` |
| `jump()` | Classic rising arcade `square` sweep + light air tick | `196Hz → 587Hz` exponential rise (`LPF 2600Hz`) | `0.115s` |
| `land(imp)` | Tight dry low `triangle` thud | `130Hz → 48Hz` | `0.060s` |
| `snowball()` | Snappy laser-pop `square` + crisp noise burst | `1480Hz → 360Hz` (`BPF 2800Hz`) | `0.080s` |
| `hitBlock()` | Destructible `box` shatter: 2-step `square` arp + crunch | `523Hz → 784Hz` + noise `1800Hz → 500Hz` | `0.130s` |
| `hitEnemy()` | `roller` cannonball explosion: punchy bass drop + metallic FM | `220Hz → 42Hz` + FM `440Hz (mod 2.5)` + noise | `0.170s` |
| `stunEnemy()` | `bouncer` freeze: dual electric `square` trill | Alternating `660Hz / 880Hz` 3-step freeze chime | `0.150s` |
| `deflect()` | Immune `eye`/`molecule`/`robot` ricochet ping | Metallic FM `1180Hz → 1760Hz` (`modRatio 3.41`) | `0.070s` |
| `door()` | Classic 3-note ascending/descending portal `square` triad | `261.6Hz → 329.6Hz → 392.0Hz` (`0.05s` each) | `0.160s` |
| `elevator()` | Clean servo hum / recall chirp (`sawtooth` LPF) | `220Hz → 330Hz → 440Hz` (`LPF 1400Hz`) | `0.120s` |
| `crumble()` | Brittle stepped pitch-drop + dry gravel noise | `180Hz → 60Hz` stepped + `LPF 900Hz` noise | `0.190s` |
| `hurt()` | Classic descending cartoon-arcade tumble slide (`sawtooth`) | `440Hz → 110Hz` wobbly vibrato drop | `0.240s` |
| `splash()` | Filtered white-noise water plunge + rising bubble blips | Noise `1800Hz → 300Hz` + 3 sine pops (`420→880Hz`) | `0.380s` |
| `bubble()` | Submarine air-torpedo `sine` pop | `310Hz → 780Hz` fast upward bubble chirp | `0.100s` |
| `catchFish()` | Bright 4-note XBLA coin/pickup `square` fanfare | `C5 → E5 → G5 → C6` (`0.035s` arp) | `0.180s` |
| `towerTopple()`| Sustained rumble + triumphant 8-bit/HD brass fanfare | Low noise rumble + `F → G → C` bright `sawtooth` triad | `1.100s` |
| `extraLife()` | Classic 6-note 1-UP arcade jingle (`square` + `FM` bell) | `E5-G5-E6-C6-D6-G6` crisp staccato | `0.480s` |
