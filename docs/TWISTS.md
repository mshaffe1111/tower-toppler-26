# Twists & enhancements (player's design list, to build after the faithful original)

Status key: ✅ built · 🟡 partly built / needs rework to match this spec · ⬜ not started

## 1. Core gameplay & control enhancements
- ✅ **Separate Jump and Fire.** Dedicated inputs: no accidental suicide jumps when stopping to shoot,
  and jumping shots can hit high switches and flying targets.
- 🟡 **Tactical cryo-stun and utility shots.** Instead of 70% of enemies being completely immune:
  - **Standard shot:** destroys fragile obstacles and light projectiles; pushes light enemies back.
  - **Charged shot (short hold):** freezes ground-based mechanical enemies and sliding cannonballs into
    solid, harmless ice blocks for 4–5 s, usable as temporary stepping stones to high ledges.
    (Built: charged freeze plus standing on ice. Still to do: push-back on standard shots, and tuning
    to 4–5 s.)
- ⬜ **Horizon warnings (no blind-curve deaths).** Subtle rim-light silhouettes at the tower's outer
  edges, directional audio pings, or a minimal 360° perimeter radar bar at the top of the screen.
  (We have an off-screen warning arrow; needs to become this.)
- 🟡 **Drop-through on purpose.** Down + Jump (or double-tap Down on grates) drops through thin
  platforms onto a ledge below, making the original's "controlled drop" an official move.
- ⬜ **Optional demolition nodes.** 2–3 exposed core nodes on harder side routes per tower. Detonating
  one takes 1.5 s standing still (exposed to patrols) and gives +15 s, a higher end-of-tower score
  multiplier and weaker defences higher up.

## 2. New tower archetypes
1. ⬜ **Clockwork tower:** 4–5 independent horizontal drums rotating on their own motors (some
   clockwise, some anticlockwise) on a predictable rhythm. Ledges and tunnel exits drift in and out of
   line; ride a drum like a sideways lift and time jumps across the seams.
2. 🟡 **Rising-tide tower:** the toxic sea rises up the tower, drowning lower tiers and sealing lower
   tunnels. No falling back to lower floors. (Built: the flood mechanic.)
3. ⬜ **Ziggurat / tapered tower:** the cylinder narrows every few floors. Wide lower tiers mean long
   routes; narrow upper tiers mean patrols lap quickly and jumps have little margin.
4. 🟡 **Gale-force tower:** steady wind from one direction. Walking into it slows you and shortens
   jumps; with it at your back, jumps go further, across gaps you couldn't clear otherwise. Tunnels
   give shelter. (Built: wind/storm mechanic in procgen; needs windward/leeward faces.)
5. 🟡 **Eclipse / searchlight tower:** heavy shadow lit by rotating beacons and enemy vision cones.
   Stepping into a searchlight triggers interceptor drones. (Built: dark mechanic with lantern;
   searchlights and drones not started.)
6. ⬜ **Hollow-core tower:** big arches reveal an inner scaffold ring. Step inside, climb inner
   ladders, watch outside patrols through the arches, and step back out ahead of blockades.

## 3. New ledge & platform types
- 🟡 **Conveyor ledges:** push you round the tower. Running with the belt launches you across wide
  gaps; running against it means keeping moving. (Built: conveyors.)
- ⬜ **Linked pressure plates:** a switch on one side extends retractable bridges on the opposite
  (180°) side for 8 s. Hit the switch, sprint through a tunnel, cross before it retracts.
- ⬜ **Launch pads:** spring tiles launching you two tiers straight up, on a fixed vertical path.
- ⬜ **Tilting planks:** pivot in the middle; stand off-centre and they tip you onto the tier below.
- ⬜ **Resin ledges:** sticky amber. No sliding and no knockback from minor hits, but half speed and no
  jumping until you step off.
- ⬜ **Phase ledges:** translucent platforms toggling solid and intangible on a steady 3 s beat,
  telegraphed by colour and audio ticks.

## 4. New enemies & counterplay
1. 🟡 **Shield sentries:** heavy bots with a shield in front. Frontal shots bounce off; jump over and
   shoot the back plate, or lure them onto crumbling or tilting ledges. (Built: shieldbug; needs
   back-shot stun and lure behaviour.)
2. ⬜ **Pendulum drones:** hang from the underside of upper ledges on energy cables, swinging across
   shafts. Shooting the anchor bracket drops them a tier and opens the upper lane.
3. ⬜ **Crawler beetles:** climb up and down specific columns across several floors. A charged shot
   freezes them mid-climb as a wall platform.
4. ⬜ **Mimic doorways:** creatures disguised as tunnel entrances with a tell (periodic blink,
   misaligned trim). Up in front of one gives a snap attack and knockback; shooting reveals and kills
   it for points and time.
5. ⬜ **Sweeper laser turrets:** wall emitters sweeping a 90° arc, then cooling for 2 s. Jump low
   beams, duck high ones, or time a tunnel entry.
6. ⬜ **Repulsor / magnet orbs:** push or pull fields. Careless players get pushed off; skilled
   players use the push mid-jump for extra distance.

## 5. Interactive world mechanics
- ⬜ **Circuit breakers:** shoot a wall fuse box to shut down conveyors, lasers and barriers in that
  vertical sector for 12 s.
- ⬜ **Steam vents:** grates hiss for 1.5 s, then jet steam. Dangerous if unprepared, but jumping into
  an active updraft lifts you two tiers.
- ⬜ **Bulkhead locks:** blast doors on the summit control room, opened by 2 key switches on opposite
  sides of the middle and upper tiers.
- ⬜ **Phase portals:** rare portals moving you 90° round and one tier up or down (standard tunnels:
  180°, same floor).
- ⬜ **Domino scaffolding:** plank bridges collapsing in sequence from the one you touch. Commit to a
  full sprint and jump.

## Also requested
- ⬜ **Clock off:** an option to remove the timer entirely.
