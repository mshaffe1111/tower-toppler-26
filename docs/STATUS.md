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
- **docs/RESEARCH.md:** findings from the research pass, with a source and CONFIRMED / UNCERTAIN
  on each fact. It may be partial: the pass was cut short when the session ended. Its "Still
  unknown" list is the next research to-do.
- **docs/ORIGINAL-RULES.md:** the player's write-up, plus what was measured from their 7800 clips.
  - Measured: walk 2.0 columns/s, stair step = 1 column × 1 brick row, Pogo about 2 rows tall.
  - The jump's sideways speed is UNVERIFIED.
- **docs/SPEC.md:** the player's design brief and the remaining gap list.
- **Tower maps:** full maps of all 8 towers exist (NES *Castelian* on vgmaps.com). The biggest
  next fidelity win is to build each Original tower's level 1 from the real map instead of a
  generated look-alike.

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
1. **Apply RESEARCH.md:** replace unverified values (jump distance, technique multiplier, timers,
   enemy speeds) with sourced ones.
2. **Real tower layouts:** transcribe each Original tower's level 1 from the real maps.
3. **Remaining Original gaps:**
   - walls capping lift shafts;
   - the stair slide-back, if sources confirm it;
   - the seven-segment clock with a facing arrow;
   - the ring-by-ring topple;
   - the two-step catch in the sub stage;
   - on Tower 8, making the real summit door look identical to the decoys.
4. **Reboot:** the twists in docs/TWISTS.md, then the 10 worlds in docs/WORLDS.md.

## Work in progress, not applied
- **docs/wip/sub-stage-upgrade.patch:** sub-stage visual polish (shader precompile, depth-of-field
  clamp, surfacing spray) from a helper pass. It's unreviewed and untested in renders; review and
  render-check it before applying with `git apply`.
