# Design spec (from the player's 4-part brief)

This is the target. Where the current build differs, see "Gap list" at the end.
Related: [ORIGINAL-RULES.md](ORIGINAL-RULES.md), [TWISTS.md](TWISTS.md), [WORLDS.md](WORLDS.md).

## 1. Platform, look, camera
- **Platform:** mobile portrait 9:16, full-screen (`100dvw × 100dvh`), touch-action locked (no
  browser swipes). On desktop: a centred phone frame (max 430px wide, 94vh tall).
- **Assets:** no external asset files. Meshes, textures (CanvasTexture), particles and audio are
  all generated in code.
- **Performance:** 60–120 fps. InstancedMesh for bricks and ledges, DPR capped at 2, ACES tone
  mapping, selective bloom.
- **Art direction:** "bioluminescent industrial". The stark silhouettes of the 7800 (bright sprites,
  striped masonry, a pitch-black sea at night) rebuilt with PBR.
- **Tower:**
  - True radial grid: 16 sectors, radius 4.0, row height 0.75.
  - Ribbed/striped bricks as a homage to the 7800 sprites, with bevels, crevice AO, and a wet sheen
    near the waterline.
  - Per-tower palette: Cobalt Blue, Crimson Industrial, Ultraviolet Alloy, Rusted Bronze, Toxic
    Emerald, Glacial Cyan, Hazard Gold, Obsidian Chrome.
- **Sea and sky:**
  - Displaced toxic sea with bioluminescent green/violet foam, SSS glow, and splash rings.
  - Midnight-indigo sky with neighbouring towers on the horizon and drifting spores.
  - Rim lights separate the characters from the wall.
- **Pogo:**
  - Glossy green bio-suit (roughness 0.25, clearcoat 0.6), big visor-eyes with tracking pupils.
  - Frog hind legs with squash and stretch, oxygen/cryo tank on the back.
  - Wrist cryo-blaster that glows cyan when firing.
- **Camera:**
  - Pogo is locked at θ = 0 (front centre); walking rotates the tower with zero lag.
  - Camera follows Pogo's height with a lerp of 0.12.
  - It tilts up 4° when riding a lift up and pulls back 10% on long falls.
  - Directional shake on hits and on demolition.

## 2. Touch controls (no virtual D-pad)
- **Drag horizontally anywhere to walk:** "direct clutch + velocity". 48px of drag = 1 sector
  (22.5°); hold at the end of a drag to keep walking at 4.5 sectors/s until you lift. Facing
  updates at once, and the HUD arrow follows.
- **Tap (under 180ms, under 12px movement) to fire:** cryo-snowball along the curve in the facing
  direction, max 2 on screen, range 6 sectors. A second thumb can tap while the first drags.
  Tapping never jumps.
- **Flick up / up-left / up-right (velocity over 0.45 px/ms) to jump:** a committed parabolic arc,
  span 2.0 sectors, peak 1.15 rows. Clears 1-sector gaps, staggered steps and low cannonballs.
- **Swipe straight up (within ±30° of vertical):**
  - At a door: go through the tunnel. The camera orbits 180° round the outside in 0.65s while an
    X-ray cyan silhouette of Pogo runs through, then he exits the opposite door.
  - On a lift: ride it up to its next stop.
- **Swipe down:** ride the lift down.
- **Sub stage:** drag anywhere to steer 1:1; tap to fire stun bubbles (second tap toggles autofire).

## 3. Physics and tiles (60 Hz fixed step, 16-column wrap)
- **Ledges:** stick out 0.85 units from the wall.
- **Stair steps:** +1 row per sector; climbed by walking or jumping. Stop on a stair connector and
  after 0.2s Pogo loses traction and slides back down ("froggy slinky") to a flat ledge.
- **Flashing barrier bricks:** pulsing striped blocks that block paths or cap lift shafts. A shot
  shatters one (+50), and it stays cleared for that attempt.
- **Crumbling ledges:** crack on landing, collapse 0.45s later (or at once when you step off),
  regrow after 6s. Lift-cap blocks stay cleared.
- **Slippery / conveyor ledges:** push sideways at ±2.2 sectors/s unless you counter-drag.
- **Lifts:** lit platforms in tracks, between stop markers or barrier bricks.
- **Getting hit:** touching any enemy or hazard never kills outright. Pogo tumbles and falls
  straight down that column, with 1.2s of invulnerability after landing. If something is below he
  lands on it (a deliberate puzzle shortcut). If not, he falls into the sea: −1 life and respawn at
  the BA-1 dock. The clock resets only on a new life.
- **Clock at 000:0:** a shockwave knocks Pogo into the sea (−1 life).

## 4. Enemies (7800 rules)
1. **Bouncing cannonballs:** destroyed by a shot, 100 pts. Ribbed metal; they bounce down stairs and
   along ledges.
2. **Sliding chrome spheres:** stun only, 0 pts. A shot freezes one for 3.0s, but it still knocks
   Pogo down if touched, so jump over it while it's stunned.
3. **Flying eyeballs:** indestructible, shots spark off. They patrol a row or hover in shafts,
   blink, and track Pogo.
4. **Mutant molecules:** indestructible, time pressure. They spawn after 8–12s of lingering in one
   height zone and drift toward Pogo's row. Also a puzzle tool in T3 and T4: let one knock you down
   onto a sealed ledge.
5. **Geometric robots (cubes, spinning cylinders):** indestructible. They oscillate between two
   columns or move up and down gaps; duck under on a lower ledge or jump over.
6. **Spring / popper bots (T6–T8):** indestructible, fast vertical hops guarding narrow paths.

## 5. The 8 towers (16 columns, verified completable)
| # | Name | Palette | Height (rows) | Timer | Design |
|---|---|---|---|---|---|
| 1 | Tower of Eyes | Cobalt Blue | 24 | 85.0 | Intro. Wraparound ledges, 2 tunnels, lifts, barrier bricks, cannonballs, eyeballs, molecules |
| 2 | Realm of Robots | Crimson Red | 28 | 90.0 | Robots guarding two-gap jumps; multi-stage lift shafts blocked by barrier bricks |
| 3 | Trap of Tricks | Royal Purple | 26 | 95.0 | Dead-end doors. After the early lift, either a precision wrap-jump or let a molecule knock you onto the true path |
| 4 | Slippery Slide | Burnished Bronze | 32 | 100.0 | Slippery rails, descending drops, sliding spheres you must stun and vault |
| 5 | Broken Path | Toxic Emerald | 36 | 110.0 | Crumbling stacks over lifts (step on them to clear the shaft); long-range sniping of barrier bricks |
| 6 | Swimmer's Delight | Glacial Cyan | 34 | 130.0 | Precision gaps straight over the sea; one hit can drop you to row 0 |
| 7 | Nasty One | Hazard Gold | 40 | 160.0 | Dense patrols: popper bots, spheres, slippery ledges, crumbling bridges |
| 8 | Edge of Doom | Obsidian + White Neon | 46 | 165.0 | Everything. Summit at row 44: four doors, Door #3 from your arrival point wins; decoys drop you down a chute |

## 6. Topple and sub stage
- **Demolition (4.0s):** sirens, red strobes, pull-back, then each ring of the tower collapses in
  turn into the sea while the time and technique bonuses tally.
- **BA-1 minisub stage:**
  - 20s between towers, in a 5-layer parallax trench with floodlights.
  - Bioluminescent fish and shrimp swim in waves.
  - Catching takes two steps: shoot a fish so it floats up in a bubble, then steer into it
    (+50 each, plus combo popups).

## 7. Audio and haptics (procedural, Web Audio)
- **Music:** a minor-key arpeggio title theme in homage to John M. Phillips' Nebulus theme. It
  fades during climbs, which stay ambient and percussive.
- **Movement:**
  - Footsteps: dual-pitch ticks per stride, with vibrate(5).
  - Jump: a rising sweep.
  - Slinky slide: descending blips.
  - Lift: a servo hum that follows height.
- **Shooting:** a crystalline chirp to fire, a glassy crunch for barrier bricks and cannonballs, a
  metallic ping off immune enemies.
- **Falling:** a knockback thud plus a falling whistle (vibrate [30,20,50]). Landing on stone gives
  a thump; landing in the sea gives a splash and sinking bubbles (vibrate 120).
- **Collapse:** a low rumble, a chain of blasts, and roaring water.

## 8. Scoring (7800)
- **Climbing:** a new stair or elevation row climbed for the first time, +40 per row. Stepping on or
  riding a new lift, +50 plus a distance bonus.
- **Shooting:** barrier brick +50; cannonball +100.
- **Sub stage:** fish +50.
- **End of tower:**
  - Time bonus: 10 × the whole seconds left.
  - Technique bonus: starts at 100, −2 per knockback; off on T1, on for T2–T8. It pays
    10 × what's left.
- **Lives:** start with 3, with +1 every 5,000 points (with a chime).

## 9. HUD and modes
- **Clock:** a giant seven-segment clock at top centre (SSS:T in tenths). Amber below 20.0, flashing
  crimson with ticks below 10.0.
- **Top left:** PLAYER ONE, an 8-digit score, life pips, and a facing arrow by the clock that flips
  instantly.
- **Top right:** tower badge (TOWER 1/8: TOWER OF EYES), a vertical height bar, mute and pause.
- **Modes:**
  - **1P arcade campaign.**
  - **2P pass-and-play:** turns swap on a lost life or a topple, with a PLAYER TWO score.
  - **"7800 difficulty switch (A/B)" toggle:** unlocks tower select (1–8) and practice/infinite
    lives (a nod to the 7800 secret).
- **High-score table:** 3 initials, plus highest tower and fastest splits, saved locally.
- **Onboarding:** 3 cards on first launch ("Drag to rotate", "Tap to shoot", "Flick up to jump /
  swipe up for doors").

## Gap list (current build vs this spec), in build order
1. **Controls:** tap to fire, second-thumb tap fires, no on-screen button deck (full screen),
   drag-clutch walking.
2. **Towers:** taller (24–46 rows); staircase-led climbing; many more barrier bricks, including
   lift-shaft caps; fewer fliers; molecules spawn only after 8–12s of lingering; popper bots
   T6–T8.
3. **Feel:** committed jump arc (2 sectors, 1.15 rows peak; ours is 1.2 rows with air steering);
   stair slinky slide.
4. **Scoring/HUD:** stair and lift points, technique bonus, giant seven-segment clock with
   amber/crimson stages, facing arrow.
5. **Topple sequence and sub stage:** ring-by-ring collapse; two-step bubble catch.
6. **Modes:** 2P pass-and-play, difficulty-switch toggle, initials high-score table, 3-card
   onboarding.
