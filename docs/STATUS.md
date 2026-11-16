# Status and handoff

Where the project stands, what is verified, and what to do next. Read this first in a new session.

## Live
- **Link:** GitHub Pages builds from `main`. To deploy, open a PR from the work branch and merge it.
- **Cache:** bump `main.js?v=` in index.html and `VERSION` in sw.js on every deploy, so phones
  load the new code.
- **Two products:**
  - **ORIGINAL:** the 1987/88 rules on the 8 towers.
  - **REBOOT:** twists, new foes, rewind.
- **Campaign:** 8 towers × 3 levels each.
  - Level 1 is a fixed generated layout.
  - Levels 2 and 3 are generated fresh each run.
  - Only level 3 topples the tower.

## Working rule (from the player)
**Don't guess about the original.** Every Original-mode value must trace back to a source: the
manual, a walkthrough or FAQ, the tower maps, or a measurement from real footage. Anything
unsourced gets marked UNVERIFIED in docs/ORIGINAL-RULES.md.

## Research
- **docs/RESEARCH.md:** findings with a source and CONFIRMED / UNCERTAIN on every fact. Sources:
  - the 7800 manual and the Hewson C64/ZX manual;
  - ZX and NES maps;
  - an open-source remake (Toppler) and a PICO-8 port.

  Its "Still unknown" list is the next research to-do.
- **docs/research/original-towers-grid.txt:** a cell-by-cell grid of all 8 real towers, from the
  GPL Toppler remake. Its doors, lifts and exits match the hand-drawn ZX maps column for column on
  Towers 1, 3 and 8. **Build the Original towers from this.**
- **docs/research/pico8-port-constants.txt:** physics and scoring values pulled from the PICO-8
  port. Treat them as UNCERTAIN until 7800 footage agrees.
- The map images (ZX hand-drawn, NES Castelian) are not in the repo; RESEARCH.md lists their URLs.

### Applied to the Original (see ORIGINAL-RULES.md, "What the Original mode does now")
- **Towers:** the Original campaign is the 8 real towers, built cell for cell from
  docs/research/original-towers-grid.txt by src/realTowers.js. All 8 are verified climbable with
  the sourced physics by an engine-driven check that simulates walks, jumps, lifts and tunnels.
  - The Reboot keeps 3 generated levels per tower.
  - Generated levels under the Original's physics failed the check (6 of 16 blocked), so the
    Original has no generated levels for now.
- **Physics:**
  - Jump: walking speed, 1.5 columns, 2.25 rows; no standing jump.
  - Step hop, faster falls, and you bump your head on ledges above.
  - Snowballs go 3 columns, one at a time.
  - Crumbling ledges vanish the moment you stand on one; slippery ledges push you while you
    stand still.
  - Lifts: 4 rows/s, middle stops, drop back after 10 s, knock you off if ridden into a
    flashing block.
- **Getting hit:** the tumble sends you down a few levels.
- **Enemies:** the 7 kinds at fixed spots, at most 4 at once, and the molecule every 10 s.
- **Scoring and time:** Time, Technique ×10 (not on Tower 1) and Extras tallies; no combos;
  time limits 100–240.

### Still open
- Which way each slippery ledge pushes (UNVERIFIED).
- The lift ride-length bonus formula (unknown).
- Patroller looks on Towers 3–8 (undocumented).

### Measured from the player's 7800 clips
Walk 2.0 columns/s; a stair step is 1 column × 1 brick row; Pogo is about 2 rows tall.

## Original mode: what's in
- **Jump:** a committed arc, sideways speed fixed at takeoff (2.6 columns/s, UNVERIFIED), no
  steering in mid-air, fixed height.
- **Falls:** walking off a ledge, or getting knocked off, drops you straight down.
- **Walking:** 2.0 columns/s (measured).
- **Snowballs:** about 6 columns of range (design brief), only thrown standing still, never
  come back round.
- **Points:**
  - Stairs: 40 per new step climbed on foot.
  - Lifts: 50 on first boarding.
  - End of a climb: time bonus of 10 per second left; technique bonus of 100 − 2 per knockdown
    from Tower 2 on.
  - The brief says the technique bonus pays ×10. UNVERIFIED which is right.
- **Ledges:** crumbling ledges last about 1 s.
- **Lives:** a lost life restarts the climb at the tower base with a fresh clock.
- **Enemies:** eyes, molecules and robots can't be hurt; sliding cannonballs can only be
  stunned; molecules spawn when you linger.
- **Removed for the Original:** no charged shot, ground-pound, rewind, checkpoints or edge guard.

## Controls
- **Default "slide" scheme, no on-screen buttons:**
  - slide anywhere to walk;
  - push up (straight or diagonal, flick or slow push) to jump;
  - tap to throw a snowball;
  - two fingers held = rewind (Reboot only).
- **Doors:** jumping at a door enters it only from the door's centre.
- **Other schemes:** Buttons and Gesture remain under Options › Controls.
- **Full screen:** automatic on phones when a game starts (Options › Video), plus a title icon and
  a pause-menu toggle. iPhone Safari can't go full screen; Install covers that.

## Verification tools (scratchpad scripts; recreate if the scratchpad is gone)
- **Climbability:** an engine-driven check that simulates jumps and walks from every ledge.
  All 24 Original levels pass with the current physics.
- **Other tests:** a smoke test (Original, Reboot and sub stage, in portrait and landscape), a
  touch-input test and a jump-arc test.
- **Running tests:** Playwright with swiftshader. It draws only about 2 fps, so step the game by
  hand with `g.update(1/60)` in timing tests.

## Next, in order
1. **Reboot generator:** a new generator for the Reboot, built from what the real towers show.
   - Building blocks: stairs, 3-row door pairs, lifts with stops, pillars, flashing blocks capping
     shafts, single crumbling cells.
   - Proportions: 47–96 rows; at most 4 enemies, at fixed spots.
   - Then layer the Reboot twists on top.
   - Verify every tower with the engine-driven check (scratchpad reach-real.js models lifts and
     tunnels).
   - Compare its statistics with the real towers.
2. **Generated Original levels:** optional; only if the generator understands the Original's
   physics.
3. **Presentation:**
   - the seven-segment clock with a facing arrow;
   - the ring-by-ring topple;
   - the two-step catch in the sub stage;
   - Tower 8's real door made to look identical to its decoys.

## Work in progress, not applied
- **docs/wip/sub-stage-upgrade.patch:** sub-stage visual polish (shader precompile, depth-of-field
  clamp, surfacing spray) from a helper pass. It's unreviewed and untested in renders; review and
  render-check it before applying with `git apply`.
