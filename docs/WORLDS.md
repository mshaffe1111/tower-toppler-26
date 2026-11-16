# WORLDS: the 10-world expansion (player's design; build after the faithful original campaign)

40 towers (10 worlds × 4 towers) built from the twists in [TWISTS.md](TWISTS.md), on top of the Classic
8-tower campaign in [ORIGINAL-RULES.md](ORIGINAL-RULES.md).

## 1. Pacing framework (the "sawtooth triad")
A straight ramp in enemy speed and gap width causes fatigue by World 4 and peak input frustration by
World 6. Four structural rules:
- **Four towers per world: Introduce → Combine → Twist → Apex.**
  - **T1, onboarding:** the world's signature mechanic on its own, with generous catch platforms
    directly under hazards.
  - **T2, integration:** pairs the new mechanic with enemies and platforms from earlier worlds.
  - **T3, inversion:** subverts expectations, e.g. a hazard becomes a traversal tool, or movement is
    reversed.
  - **T4, apex citadel:** full mastery under tighter clock pressure, plus an optional high-risk
    demolition-node route for bonus time and score.
- **Sawtooth relief between worlds:** going from World N's T4 to World N+1's T1 cuts baseline stress by
  about 25%, so players can experiment before intensity climbs past the previous peak.
- **Cognitive load budget:** at most one new tower archetype and one primary rule per world. Secondary
  hazards are staggered across T2 and T3.
- **Easy vs Normal:** don't just inflate health or shrink timers. Adjust spatial forgiveness (how many
  catch ledges), telegraph lead times and how many hazards overlap.

## 2. World matrix
| W | Name | Archetype | New ledges & obstacles | New enemies | Catch-floor coverage (Normal / Easy) | Par-to-clock ratio (Normal / Easy) |
|---|---|---|---|---|---|---|
| 1 | The Azure Spire | Standard cylinder | Solid, stairs, lifts, 180° tunnels, flashing blocks | Bouncing cannonballs, flying eyes | 85% / 95% | 1.65× / 2.10× |
| 2 | Foundry of Gears | Standard cylinder | Conveyors | Vicious robots, shield sentries | 80% / 90% | 1.55× / 1.95× |
| 3 | The Cryo-Vault | Frost cylinder | Slippery ice, cryo-stun blocks | Sliding cannonballs | 75% / 88% | 1.50× / 1.90× |
| 4 | Hall of Mirrors | Labyrinth cylinder | Phase portals (90°), pressure-plate bridges | Mimic doorways | 70% / 85% | 1.45× / 1.85× |
| 5 | Clockwork Citadel | Counter-rotating drums | Tilting planks | Pendulum drones | 65% / 80% | 1.40× / 1.80× |
| 6 | Monsoon Keep | Gale-force (wind) | Crumbling, domino scaffolding, launch pads | — (wind-modified fliers) | 55% / 75% | 1.38× / 1.75× |
| 7 | The Amber Core | Hollow-core (dual layer) | Resin ledges | Crawler beetles | 50% / 70% | 1.35× / 1.70× |
| 8 | Obsidian Watchtower | Eclipse (searchlights) | Circuit breakers | Laser turrets, mutant molecules | 45% / 65% | 1.32× / 1.65× |
| 9 | The Abyssal Trench | Rising tide | Phase ledges, steam vents | Repulsor / magnet orbs | 35% (dynamic) / 55% | 1.28× / 1.60× |
| 10 | Spire of Nemesis | Tapered ziggurat | Bulkhead locks, full synthesis | All enemy classes | 25% / 45% | 1.25× / 1.55× |

## 3. World by world
**W1 · The Azure Spire (orientation and core controls).**
- *Tower:* standard 16-column masonry, 12–16 tiers.
- *Teaches:* separate Jump and Fire, horizon rim-light silhouettes, and Down + Jump drop-through. Also
  180° tunnels for blocked walkways, and flashing blocks for clearing a line before jumping.
- *Enemies:* bouncing cannonballs (read the arc, one-shot kill) and flying eyes (patience windows,
  no weapon).
- *Focus:* read the cylinder in 3D; check both perimeter arcs before riding a lift; spot when an
  outside dead end lines up with a doorway.
- *Easy:* safety ledges every two tiers above the water; cannonballs 25% slower.

**W2 · Foundry of Gears (patrols and momentum).**
- *Tower:* industrial iron cylinder, 16 columns, 16–20 tiers, exposed gears.
- *Conveyors:* in T1 they move toward safe walls; in T2–4 they push toward drops, or launch you across
  wide gaps when you run with them.
- *Enemies:* invulnerable robots (route via lifts, tunnels or drop-throughs). Shield sentries: jump over
  and shoot the rear core, or lure them onto conveyor edges.
- *Easy:* sentry turn-around delay after you jump them goes from 0.6 s to 1.2 s.

**W3 · The Cryo-Vault (friction and cryo-platforming).**
- *Tower:* glacial stone, 16 columns, 18–22 tiers.
- *Ice ledges:* short taps and counter-steering.
- *Enemies:* sliding cannonballs under low ceilings. Charged cryo-stun (hold 0.4 s) freezes sliding
  cannonballs and robots into solid ice for 5 s. In T3–4 you must freeze cannonballs under overhangs
  as stepping stones.
- *Easy:* freeze lasts 8 s; ice inertia −30%.

**W4 · Hall of Mirrors (deception and asymmetric warps).**
- *Tower:* ornate temple, 18 columns, 20–24 tiers.
- *Phase portals:* violet runes; 90° round and 2 tiers up or down.
- *Pressure plates:* a bridge extends on the opposite side for 8 s.
- *Mimic doorways:* blink every 2.5 s; shoot one for bonus time.
- *Easy:* portal exit arrow; bridges stay 12 s.

**W5 · Clockwork Citadel (moving geometry).**
- *Tower:* 4 independent drums of 4–5 tiers each, turning on a fixed cycle.
- *Tilting planks:* dump you after 1.0 s off-centre.
- *Pendulum drones:* shoot the anchor to drop them a tier.
- *Easy:* drums 30% slower, with a 1.0 s lock at cardinal alignments.

**W6 · Monsoon Keep (wind and shattering paths).**
- *Tower:* storm cliff, 18 columns, 22–26 tiers, wind streaks blowing west to east.
- *Ledges:* crumbling and domino scaffolding (no standing to shoot), plus launch pads (two tiers up).
- *Enemies:* no new class; eyes and cannonballs drift faster downwind.
- *Layout:* leeward gaps 40% wider (ride the tailwind); tunnels give shelter.
- *Easy:* headwind drag −40%; dominoes +0.35 s per plank.

**W7 · The Amber Core (two layers and vertical threats).**
- *Tower:* 20-column outer shell with arches into a 12-column inner scaffold ring.
- *Resin ledges:* no knockback or sliding, but half speed and no jump.
- *Crawler beetles:* climb columns; freeze them for wall ledges.
- *Easy:* arches more see-through; resin slowdown 25%.

**W8 · Obsidian Watchtower (stealth, sweeps, sabotage).**
- *Tower:* dark basalt with rotating searchlights and vision cones.
- *Circuit breakers:* shoot one to black out lights, conveyors and lasers in a 5-tier sector for 12 s.
- *Enemies:* laser turrets (90° sweeps) and mutant molecules.
- *Easy:* searchlights 25% slower, 0.75 s detection grace, 16 s blackout.

**W9 · The Abyssal Trench (rising tide and rhythm).**
- *Tower:* bioluminescent deep-sea spire; the sea rises and seals lower tunnels.
- *Ledges:* phase ledges (3.0 s pulse) and steam vents (two-tier updraft).
- *Enemies:* repulsor and magnet orbs; slingshot off a repulsor's outer ring.
- *Easy:* tide 35% slower and capped 4 tiers below the summit; phase solid time 4.2 s.

**W10 · Spire of Nemesis (tapered ziggurat, total synthesis).**
- *Tower:* 24 columns at the base, 16 mid, a 10-column spire; 28–32 tiers.
- *Bulkhead locks:* 2–3 key switches on opposite sides of the middle and upper tiers.
- *Hazards:* clockwork tiers mid-way; wind and crumbling near the top; every enemy class.
- *Easy:* 2 switches, a 12-column spire, +35 s on the clock.

## 4. Tuning targets (30 FPS / 33.3 ms frame budget)
| Metric | W1–2 | W3–4 | W5–6 | W7–8 | W9–10 |
|---|---|---|---|---|---|
| Tower height (tiers) | 12–18 | 18–22 | 20–26 | 22–28 | 26–32 |
| Min reaction window, Normal | 700 ms (21 f) | 566 ms (17 f) | 466 ms (14 f) | 400 ms (12 f) | 333 ms (10 f) |
| Min reaction window, Easy | 900 ms (27 f) | 733 ms (22 f) | 633 ms (19 f) | 533 ms (16 f) | 466 ms (14 f) |
| Horizon telegraph lead | 45° (2 cols) | 40° (2 cols) | 35° (1.75) | 30° (1.5) | 25° (1.25) |
| Max simultaneous hazards on screen | 1–2 | 2–3 | 3 | 3–4 | 4–5 |
| First-try clear rate, Normal | 75–85% | 55–65% | 40–50% | 25–35% | 10–20% |
| First-try clear rate, Easy | 90–95% | 80–85% | 70–75% | 55–65% | 40–50% |

## Engineering notes for when we build this
- The procedural generator and engine-driven reachability checker (src/procgen.js, scratchpad
  reach.js) can enforce **catch-floor coverage**, **max simultaneous hazards** and **reaction windows**
  as hard constraints, and measure **par time** by bot runs, so each world's numbers are checked, not
  hoped for.
- Variable column counts (18/20/24/10) and tapering need the tower grid to support per-tier column
  counts. This is the biggest engine change in the plan; worlds 1–3 need none of it.
