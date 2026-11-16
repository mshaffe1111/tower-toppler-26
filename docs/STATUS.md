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

### Confirmed findings that change the Original (not yet applied)
- **Tower size:** heights are 47, 71, 49, 66, 96, 64, 80, 96 rows. Ours follow SPEC's 24–46, so
  they're about half as tall. The 16 columns are right.
- **Time limits:** 100, 120, 140 … 240 (+20 per tower). SPEC has 85–165.
- **Doors:** 1 column by 3 rows, always in pairs at column c and c+8. Tower 7 has no tunnels.
- **Enemies:** at most 4 at once, at fixed spots. The molecule is a timed flyer that crosses at
  Pogo's height about every 10 s; it doesn't spawn when you linger.
- **Slippery ledges:** they push you left or right, not "slide with your momentum".
- **Getting hit:** you "land a few levels down", falling through platforms (about 8 rows in the
  port).
- **Scoring:**
  - Lift points depend on the length of the ride (7800 manual).
  - The technique bonus is paid ×10 and skipped on Tower 1 (C64).
  - There's a third "Extras" tally: +5 per ball and +2 per block shot, paid ×10.
- **Tower 8 summit:** doors at columns 9–12, exit at 10.

### Strong leads from the port (check against footage before using)
- **Jump:** sideways speed equals the walk, about 1.5 columns long, peak 2.25 rows. Ours is
  2.6 columns/s and 1.15 rows.
- **Snowball:** about 3 columns of range, one on screen at a time. Ours is 6.
- **Crumbling ledges:** vanish as soon as you stand on one and don't regrow during that attempt.
- **Stairs:** no source supports Pogo sliding back down when he stops.

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
1. **Real towers:** build each Original tower from docs/research/original-towers-grid.txt, using
   its real heights, doors, lifts, blocks, crumbling and slippery ledges, and enemy spots. Use the
   real time limits (100–240). Check the result against the ZX maps.
2. **Confirmed rules from RESEARCH.md:**
   - molecule timing, enemy cap and fixed spots;
   - slippery push;
   - the hit fall;
   - lift ride-length points, technique ×10, the Extras tally.
3. **Port values:** check the jump (speed = walk, ~1.5 columns, 2.25-row peak) and the snowball
   (~3 columns) against footage before adopting them.
4. **Remaining presentation:**
   - the seven-segment clock with a facing arrow;
   - the ring-by-ring topple;
   - the two-step catch in the sub stage;
   - Tower 8's identical-looking real door.
5. **Reboot:** the twists in docs/TWISTS.md, then the 10 worlds in docs/WORLDS.md. It can keep
   generated towers.

## Work in progress, not applied
- **docs/wip/sub-stage-upgrade.patch:** sub-stage visual polish (shader precompile, depth-of-field
  clamp, surfacing spray) from a helper pass. It's unreviewed and untested in renders; review and
  render-check it before applying with `git apply`.
