# Tower Toppler '26 — `origin/main` (`e42c3da`) Classic 1987 Audit & 2007–2010 HD Integration Spec

> **Status:** Authoritative Delta Specification for **Original Mode (`era: 'original'`)**  
> **Architecture Mandate (#89):** **Keep our current Next-Gen build (`docs/ARCHITECTURE_CONTRACT.md`) as the primary engine and codebase.** Cherry-pick `origin/main`'s (`e42c3da`) **cell-for-cell 1987 tower layouts (`REAL_TOWER_GRIDS`) and primary-sourced 1987/1988 Atari 7800 + Hewson CPC/C64 rules**, and pair them with our crisp **2007–2010 XBLA/PSN HD Arcade visual & retro-synth audio pipeline** without breaking a single cell-for-cell 1987 rule.

---

## 1. Executive Audit of `origin/main` (`e42c3da`)

### 1.1 What `origin/main` Already Nails (Cherry-Pick Directly!)
`origin/main` (`docs/RESEARCH.md`, `docs/ORIGINAL-RULES.md`, `docs/research/pico8-port-constants.txt`, `src/realTowerData.js`, `src/realTowers.js`, `src/game.js`) contains extraordinary, primary-sourced historical engineering verified against the **Atari 7800 manual (`C300018-056 Rev. A`)**, the **Hewson C64/ZX multi-language manual**, **hand-drawn ZX Spectrum & NES *Castelian* maps**, **frame-by-frame Atari 7800 Level 1 video measurements**, **GPL *Toppler* (`m1.ttm` / `robots.cc`)**, and the **Amstrad CPC-accurate PICO-8 disassembly**:

1. **Authentic Cell-for-Cell 1987 Layouts (`REAL_TOWER_GRIDS`, Towers 1–8)**:
   - Exact 16-column × variable-row maps matching the 1987 Hewson original column-for-column:
     - **Heights (step-rows)**: T1 *Tower of Eyes* = **`47`**, T2 *Realm of Robots* = **`71`**, T3 *Trap of Tricks* = **`49`**, T4 *Slippery Slide* = **`66`**, T5 *Broken Path* = **`96`**, T6 *Swimmer's Delight* = **`64`**, T7 *Nasty One* = **`80`**, T8 *Edge of Doom* = **`96`**.
     - **Time Limits (`REAL_TIME_LIMITS`)**: **`[100, 120, 140, 160, 180, 200, 220, 240]` seconds** (`100s` on T1, `+20s` per tower).
   - **Authentic Grid Architecture**:
     - `'-'` solid step, `'.'` instant-vanish crumbling step, `'>'` / `'<'` directional slippery push-step (`slideR` / `slideL`).
     - `'!'` **Solid Pillars (`type: 'pillar', h`)**: Non-walkable, non-shootable vertical stone/metal columns blocking horizontal passage and absorbing snowballs.
     - `'b'` **Flashing Blocks (`type: 'box', h`)**: 1- or 2-row tall shootable barriers resting on the step below (`50 pts`, `+2` Extras).
     - `'#'` **180° Core Tunnel Doors (3 rows tall)**: Strictly paired between column `c` and `(c + 8) % 16` at the same row! Any `'#'` door with **no partner at `c + 8`** is an authentic **dead-end / decoy trap door** (notably **Tower 8 *Edge of Doom*'s iconic 8-door summit `####    #T##`**, where only `'T'` at col `9` is the exit and the 7 `'#'` decoys fail/drop you!). Also confirms **Tower 7 (*Nasty One*) has zero tunnel doors**.
     - `'^' ... '+' ... 'v'` **Multi-Stop Lifts**: Bottom platform `' ^ '` sits `+1` step above its supporting ledge (walk into it to auto-step onto the lift!), optional middle stops `'+'`, and top stop `'v'`. All 8 towers are engine-verified 100% climbable.

2. **Measured 1987/7800 Proportions & Frame-Accurate Physics (`PORT_TICK = 1 / 32` s)**:
   - **7800 Step & Camera Proportions**: One step-row is **`STEP_ORIGINAL = 0.43`** of a column (`FH = 0.43` world units at `TOWER_RADIUS = 2.55`), `1` brick course per step, ledge thickness **`0.65` rows** (solid from underneath — head-bumps prevent clipping while keeping T8's under-ledge jump legal!), Pogo height **`2.0` rows**, enemies **`~2.0` rows**, and **`18°` long-lens camera FOV** from further back so Pogo's screen width matches the 7800's flat orthographic projection (`~0.24` of tower radius).
   - **Walk**: Single digital speed **`2.0 cols/s`** (`8.0s` per 16-col lap).
   - **Running Jump (`ARC_JUMP`, 24 ticks = `0.75s`)**: Horizontal speed fixed at **`2.0 cols/s`** (`1.5 cols` span, clearing 1-column empty gaps), peak **`+2.25 rows`** (`+18/8`), 4-tick hang at apex, **no mid-air steering**, and **no jumping from a standstill** (when stationary, `UP` enters doors / rides lifts; with separate `JUMP` button, pressing `JUMP` while moving launches the `1.5-col` arc, or optional classic-assist stationary hop if not strict).
   - **Stair Auto-Hop (`ARC_CLIMB`, 14 ticks = `0.4375s`)**: Walking into a `+1` step or a resting bottom lift (`^`) hops up `+1.25 rows` peak onto the step.
   - **Crumbling (`.`)**: Vanishes immediately when walked/landed on and **stays gone for that life attempt** (crossed by hopping).
   - **Slippery (`>` / `<` $\rightarrow$ `slideR` / `slideL`)**: Pushes Pogo at **`±2.0 cols/s` while standing still or shooting**; active walking overrides the push (Hewson manual: *"slippery ledges push you left or right"*).
   - **Lifts**: Ride at **`3.1–4.0 rows/s`**; pause at middle `'+'` stops unless `UP`/`DOWN` remains held; auto-return to bottom stop after **`10.0s`** idle empty; riding upward into an unshot `'b'` flashing block knocks Pogo off; **cannot** be called by shooting snowballs.
   - **Snowballs**: **1 active snowball max**, thrown **only while standing still on solid ground** (or buffered within `0.18s` of stopping), speed **`4.0 cols/s`** (`2×` walk) for **`0.75s`** (`3.0 cols` range), rising **`+1.0 row`** over its flight (`plshotdys`), absorbed by `'!'` pillars and immune enemies.
   - **Knockdown Tumble (`ARC_TUMBLE`)**: Enemy hit hops Pogo **`+1.6 rows`**, then **falls through platforms** for **`~8 rows`** (`~3 rows` when hit by the Molecule) before catching the next solid ledge below! Death (sea plunge or `timer <= 0`) restarts at `(col: 0, floor: 0)` with fresh clock and restored blocks/crumbles/enemies.

3. **Authentic 7-Code Enemy Spawner + Timed Screen-Space Molecule + Scoring**:
   - **Map Enemy Codes (`1..7` from *Toppler* `robots.cc`)**:
     - `1` (`kind: 'roll'`, `type: 'roller'`, `2.0 cols/s`): Rolls on ledges, reverses at ledge edges, walls, and lift shafts. **Snowball = STUNNED (`3.0–5.6s`)** — **stays solid and still blocks/knocks Pogo off while stunned!** (`0 pts`).
     - `2` (`kind: 'bounce'`, `type: 'bouncer'`, `2.0 cols/s`): `1.5-row` parabolic hop every `0.66s`, hops off ledge edges and falls to lower ledges/sea. **Snowball = DESTROYED (`100 pts`, `+5` Extras)** and stays destroyed for that life attempt!
     - `3` (`kind: 'park'`, `type: 'bouncer'`, `0 -> 2.0 cols/s`): **Parked Bouncing Ball** — sits motionless until Pogo reaches its row within `≤ 4 columns`, then launches toward Pogo as `kind: 'bounce'`! **Snowball = DESTROYED (`100 pts`, `+5` Extras)**.
     - `4` / `5` (`kind: 'vpat'`, slow `4.0 rows/s` / fast `8.0 rows/s`): Vertical patroller oscillating straight up/down its column, reversing on solid cells/bounds. **Snowball = IMMUNE** (absorbs shot).
     - `6` / `7` (`kind: 'hpat'`, slow `2.0 cols/s` / fast `4.0 cols/s`): Horizontal patroller circling at fixed row, reversing on solid cells (`!`, `b`, step walls). **Snowball = IMMUNE** (absorbs shot).
   - **Active Cap (`MAX_REAL_ENEMIES = 4`)**: Enemies stay dormant at map `spawnPoints`, spawn when within `[player.floor - 4, player.floor + 9]`, and despawn back to `'idle'` when `> 12 rows` below Pogo.
   - **Timed Screen-Space Molecule (`kind: 'bonker'`, `type: 'molecule'`)**: Spawns every **`18.75s`** (`600` port ticks, when `< 4` enemies active) at `player.floor`, crossing **in screen/camera space (`camCol`-relative)** across `11 columns` (`4.0s` slow drift then `2.3s` fast sweep) so rotating the tower cannot shake it off! **Snowball = IMMUNE** (passes right through snowballs).
   - **1987 Scoring Tally (Flat `1x`, No Combos)**:
     - `+40 pts` per new stair row climbed on foot; `+50 pts` first boarding of each lift; `+50 pts` (`+2` Extras) per `'b'` block shot; `+100 pts` (`+5` Extras) per `'2'`/`'3'` bouncing ball destroyed; `+50 pts` per bubbled fish caught in Submarine stage; Extra Life every **`5,000 pts`**.
     - **End-of-Tower Tally**: `Time Bonus = Math.ceil(timer) * 10` + `Technique Bonus = (tower.id >= 2 ? Math.max(0, 100 - knockdowns * 2) * 10 : 0)` + `Extras Bonus = Math.min(500, extras) * 10`.

---

### 1.2 What `origin/main` (`e42c3da`) Misses — Exact Upgrades Needed in Our Next-Gen Build

| Area | Deficit in `origin/main` (`e42c3da`) | How Our Next-Gen Engine Upgrades It (`era: 'original'`) |
| :--- | :--- | :--- |
| **1. Audio Era (`src/audio.js`)** | `origin/main` has **zero Original-mode music or SFX differentiation** — it plays the exact same 2026 lush reverb/flute/pad soundtrack (`Sunrise Steps`, `Jade Pagoda`) in Original Mode. | Keep our Next-Gen `SoundEngine.setEra('original')` (**2007–2010 XBLA / 50Hz C64 SID Tribute**: dry-forward `0.05` wet, `128 BPM` octave-saw bass + stepped 3-note SID arpeggios, `132 BPM` major-key Submarine bonus groove, and crisp retro-HD SFX including `hitBlock`, `deflect`, `stunEnemy`, `timerTick`). |
| **2. 2007–2010 HD Look (`src/renderer.js`)** | `origin/main` reuses Reboot's weathered/pitted stone normal maps, glowing lava-crack limestone, swirling black-hole shader portals, tilt-shift blur, and cartoon-outlined SDF enemies. | Render `era === 'original'` with **authentic 2007–2010 XBLA/PSN HD Arcade shaders**: crisp bevel-chamfered glossy bricks (`roughness: 0.24`, `metalness: 0.16`, zero moss/pitting), clean dark mortar, vibrant 8-tower jewel palettes, sleek arcade platform lifts, strobing high-contrast `'b'` blocks, glossy anodized `'!'` pillars, clean 3-point studio lighting (`exposure: 1.06`, no tilt-shift blur, no storm fog), and glossy 2008 `PogoRig` (`setEraStyle('original')`). |
| **3. Classic Submarine Stage (`src/game.js`)** | `origin/main`'s `SubStage` forces Reboot's `20s` mines, jellyfish, clams, and `4x` combos onto Original Mode. | Keep our clean `era === 'original'` **14s Classic MK.7 Mini-Submarine** ruleset: pure two-step **1-stun-bubble-at-a-time** encase $\rightarrow$ touch-collect (`50 pts` strict / zero mines, zero hull stun), rendered in bright crisp 2008 underwater arcade clarity! |
| **4. Patroller Visual Variety** | `origin/main` lacked `molecule` / `robotV` / `robotH` visual mapping on Towers 3–8 (`PATROL_LOOK` reused Reboot `spiker`). | Map `vpat` / `hpat` cleanly to our classic 6-archetype HD models per tower theme: T1 `eye`, T2 `robotV`/`robotH`, T3 `eye`/`robotH`, T4 `eye`, T5 `robotV`/`eye`, T6 `robotH`/`eye`, T7 `robotV`/`robotH`, T8 `eye`/`robotH`, while the timed `18.75s` `bonker` uses the classic HD `molecule`! |

---

## 2. Verbatim Cell-for-Cell 1987 Tower Data (`REAL_TOWER_GRIDS`)

For direct, self-contained use in `src/levels.js` (`createOriginalTowers()`), here are all **8 authentic 1987 tower grids** (`top row first`, `16 columns` wide, bottom empty sea row stripped by parser so ground ledge = `floor 0`):

- `'-'` = `'solid'` step | `'.'` = `'crumble'` step | `'>'` = `'slideR'` step | `'<'` = `'slideL'` step
- `'!'` = `'pillar'` (vertical run of `h` rows sitting on `floor = r0 - 1`; solid blocker, absorbs shots)
- `'b'` = `'box'` (vertical run of `h` rows sitting on `floor = r0 - 1`; shootable flashing block, `50 pts`)
- `'#'` = 3-row core doorway on `floor = r0 - 1`, paired with `(col + 8) % 16` at same `floor` (`decoy: true` if unpartnered!)
- `'T'` = 3-row summit exit doorway (`isExit: true`) on `floor = r0 - 1`
- `'^'` = lift bottom stop at `r` (sits `+1` row above supporting step `r - 1`), `'+'` = middle stop(s), `'v'` = top stop
- `'1'` = `roller` (`2.0 cols/s`, stun-only), `'2'` = `bouncer` (`2.0 cols/s`, destroy `100 pts`), `'3'` = parked `bouncer` (wakes within `4 cols`), `'4'`/`'5'` = slow/fast vertical patroller (`4.0`/`8.0 rows/s`, immune), `'6'`/`'7'` = slow/fast horizontal patroller (`2.0`/`4.0 cols/s`, immune).

```js
export const REAL_TIME_LIMITS = [100, 120, 140, 160, 180, 200, 220, 240];

export const REAL_TOWER_GRIDS = {
  1: [ // THE TOWER OF EYES (47 rows, 100s)
    "                ",
    "                ",
    " #  T    #      ",
    " #  T    #      ",
    " #  T    #      ",
    " ----    --v6   ",
    "#!      # !     ",
    "#!      # !     ",
    "#!      # !^    ",
    "--   v.-- ------",
    "                ",
    "                ",
    "       1        ",
    "      ---       ",
    "                ",
    "                ",
    "         4      ",
    "                ",
    "    -       --v ",
    "    !       !   ",
    "    !  2    !   ",
    "    -.-------   ",
    "     .          ",
    "     .          ",
    "     ^          ",
    " #   -   #      ",
    " #       #      ",
    " #     4 #  3 ^ ",
    " ->>     ------ ",
    "    >>          ",
    "      >         ",
    "       >    b   ",
    "        >3  b   ",
    "         -----v ",
    "                ",
    "                ",
    "                ",
    "         1    ^ ",
    "        ----v-- ",
    "                ",
    "      #       # ",
    "      #       # ",
    "      # 4   ^ # ",
    "  #   v   # --- ",
    "  #       #     ",
    "  #   ^   #     ",
    "---..------     ",
    "                ",
  ],
  2: [ // THE REALM OF ROBOTS (71 rows, 120s)
    "                ",
    "                ",
    "     T          ",
    "     T          ",
    "     T          ",
    "     v          ",
    "                ",
    "                ",
    "                ",
    "    -.-         ",
    "       -        ",
    " 7      ---     ",
    "     ^     -    ",
    "     --     --- ",
    "               -",
    "--         7    ",
    " #-      #      ",
    " # -     #      ",
    " #  -    #      ",
    " .   -----v     ",
    " .              ",
    "                ",
    "                ",
    "                ",
    "                ",
    "                ",
    "                ",
    "                ",
    "                ",
    "                ",
    "    #       #   ",
    "    #       #   ",
    "    #       #   ",
    "   ---v 6       ",
    " --             ",
    "-              -",
    "          ^  -- ",
    "          ---   ",
    "                ",
    "                ",
    "                ",
    "          4     ",
    "                ",
    "                ",
    "                ",
    "           >>v  ",
    "          -     ",
    "  #      -#     ",
    "  #     - # 4   ",
    "  #   ^-  #     ",
    "  -v  -   --    ",
    "  !       !     ",
    "  !6      !     ",
    "  !       !  ^  ",
    "  !^      ----  ",
    " v---           ",
    "     >          ",
    "      >         ",
    "       >    4   ",
    " ^      -       ",
    " -v  #   -   #  ",
    "     #    -  #  ",
    "     #     - #  ",
    "     --v    --  ",
    "  ^             ",
    " --            -",
    "       ^5v      ",
    "       -        ",
    "                ",
    "         ^      ",
    "-..     --- - --",
    "                ",
  ],
  3: [ // TRAP OF TRICKS (49 rows, 140s)
    "                ",
    "                ",
    "    T           ",
    "    T           ",
    "    T           ",
    "   v-      ---  ",
    "                ",
    "                ",
    "       #       #",
    "       #       #",
    "       #       #",
    "       --v      ",
    "    #       #   ",
    "    #    6  #   ",
    "   ^#       # --",
    "   --       --  ",
    "                ",
    "                ",
    "                ",
    "                ",
    "         b      ",
    "         b      ",
    "          ---   ",
    "    6        -  ",
    "              - ",
    "     v-        -",
    "-      - ^      ",
    " -      -- 4    ",
    "  -             ",
    "   -- 4         ",
    "           -v   ",
    "                ",
    "          -     ",
    "     ^          ",
    "     -----      ",
    "     !#       # ",
    "     !#       # ",
    "     !#       # ",
    "  -v-----v      ",
    "                ",
    "                ",
    "                ",
    "        3   ^   ",
    "    -----.  --- ",
    "                ",
    "    #       #   ",
    "    #       #   ",
    "   ^#    ^3 #   ",
    "-  --    -------",
    "                ",
  ],
  4: [ // SLIPPERY SLIDE (66 rows, 160s)
    "                ",
    "                ",
    "         T      ",
    "         T      ",
    "         T      ",
    " v-      ---v   ",
    "  !        !    ",
    "  !        !    ",
    "  !  2 2   !    ",
    "  ----.-----    ",
    "      .         ",
    "      .         ",
    "      .         ",
    "      .         ",
    "      .         ",
    "      --..-     ",
    "                ",
    "                ",
    "            ^   ",
    "           --   ",
    "                ",
    " 3              ",
    " ^ -            ",
    " -- -.-         ",
    "       -        ",
    "        -       ",
    "         - 4    ",
    "     -v-  - 4   ",
    "           -    ",
    "       #    -  #",
    "    6  #     - #",
    "       #      -#",
    "   --- ----    -",
    "           -    ",
    "            -   ",
    "                ",
    "    3           ",
    " v---           ",
    "    !-^ 44      ",
    "- # ! -   #     ",
    "  # !     #     ",
    "# # !  -# #     ",
    "#b-v-   # -     ",
    "#     # #-    # ",
    "-b    # -     # ",
    "    3 #       #-",
    " ^  ---       - ",
    " -              ",
    "                ",
    "                ",
    "     #       #  ",
    "#    #  #    #  ",
    "#  ^ #  #    #  ",
    "#  ---  #    -  ",
    "-       -v    -.",
    "  b             ",
    "  b      b      ",
    "  >>>>>v        ",
    " -       ^      ",
    "-        -------",
    "    4           ",
    "                ",
    "   - - ^        ",
    "  -   4-        ",
    " -              ",
    "-   . .    -----",
    "                ",
  ],
  5: [ // BROKEN PATH (96 rows, 180s)
    "                ",
    "                ",
    "    -     T     ",
    "     -    T     ",
    "          T     ",
    "    4     -v    ",
    "     4    !     ",
    "          !     ",
    "          !     ",
    "          !     ",
    "  23      !^    ",
    "---------v------",
    "                ",
    "                ",
    "                ",
    "                ",
    "                ",
    "                ",
    "       #       #",
    "     7 #       #",
    "  5  # # ^   # #",
    "     # - --- #  ",
    "   # #-    #-#  ",
    "   # -     # -  ",
    " # #-    # #    ",
    " # -     #      ",
    " #-   4# #     #",
    " -     # -     #",
    "     # #-    # #",
    "     # -     #  ",
    "   # #-    # #  ",
    "   # -     #    ",
    "   #-      #    ",
    "   -       v    ",
    "                ",
    "                ",
    "   6-v-         ",
    "                ",
    " -           4  ",
    "  -         5   ",
    "   -   >>       ",
    "    - -         ",
    ">             >>",
    "             -  ",
    "           ^-   ",
    "       4   -    ",
    "                ",
    "                ",
    "   -  #       # ",
    "   v  #       # ",
    "      # --    # ",
    "           v-.. ",
    "       -        ",
    "                ",
    "     b          ",
    "       5        ",
    "-v      - - - --",
    "     ^   4      ",
    "     ---        ",
    "         .      ",
    "                ",
    "                ",
    "    7           ",
    "          -     ",
    "                ",
    "                ",
    "- - - - -v5     ",
    "           ^    ",
    "  -       --    ",
    " . .            ",
    "                ",
    " b              ",
    " b              ",
    " ^ ^            ",
    " ---            ",
    "                ",
    "    7           ",
    "         ^      ",
    "        --      ",
    "       -        ",
    "   #  -    #    ",
    "   # -     #    ",
    "   #-      #    ",
    "   -       -    ",
    "          -     ",
    "         -    3 ",
    "-v      -     --",
    "   4  v-      ! ",
    "      b       ! ",
    "        2     ! ",
    " +--.- -.------ ",
    "                ",
    "                ",
    "                ",
    " ^    ^         ",
    "--    ----      ",
    "                ",
  ],
  6: [ // SWIMMER'S DELIGHT (64 rows, 200s)
    "                ",
    "                ",
    "  T             ",
    "  T             ",
    "  T             ",
    "  -             ",
    "          6     ",
    " -              ",
    "    6           ",
    "-               ",
    "            6   ",
    "               -",
    "      6         ",
    "              - ",
    "                ",
    "          -  -  ",
    "       -        ",
    "         b  -   ",
    "                ",
    "      -  v -    ",
    "     -          ",
    "  v--     5     ",
    "           4    ",
    "                ",
    "                ",
    "            4   ",
    "           --v  ",
    "         ^-     ",
    "         -      ",
    "                ",
    "                ",
    "                ",
    "                ",
    "                ",
    "                ",
    "             ^  ",
    "v    - v------  ",
    "      -         ",
    " #.     -#      ",
    " #   5   #      ",
    "^#.      #      ",
    "--       --5-   ",
    "  .   5^        ",
    "   v----     -  ",
    " #. #    #  #   ",
    " #  #    #  # - ",
    " #^^#    #  #   ",
    "-----    ----  -",
    " -      -       ",
    "       -        ",
    "  b   -         ",
    "- v---        v-",
    " #       #      ",
    " #       #      ",
    " #       #    b ",
    "  ^--v 4 -5     ",
    "  -       -v    ",
    "4               ",
    "              ^ ",
    " - v- --     ---",
    "    !           ",
    "    !b          ",
    "   ^!^  5  ^    ",
    "------------    ",
    "                ",
  ],
  7: [ // NASTY ONE (80 rows, 220s — authentically ZERO tunnel doors!)
    "                ",
    "                ",
    " T              ",
    " T              ",
    " T              ",
    " v              ",
    "                ",
    "                ",
    "            2  2",
    "-.       v------",
    "                ",
    "                ",
    "              22",
    "-.        v-----",
    "                ",
    "                ",
    "     2          ",
    " .------v       ",
    "                ",
    "                ",
    "  2             ",
    " ^-- --v        ",
    " -  -           ",
    "                ",
    "                ",
    "                ",
    "                ",
    "    4           ",
    "   4 4          ",
    "                ",
    "       ^^^^     ",
    "  v--------     ",
    "                ",
    "                ",
    "        7       ",
    "                ",
    "           -   -",
    "- ^    -- - - - ",
    " --   v  -   -  ",
    "                ",
    "                ",
    "     6          ",
    "      ^  4      ",
    "    ---         ",
    " - -       - - -",
    ". .       - . . ",
    "         -      ",
    "       v-       ",
    "                ",
    "                ",
    "                ",
    "    6 v         ",
    "       ^        ",
    "       -        ",
    "                ",
    "    6v          ",
    "      ^         ",
    "      -         ",
    "                ",
    "     6          ",
    "     b          ",
    "     b          ",
    "   - ^          ",
    "  - --  v-      ",
    " -        -     ",
    "-          -    ",
    "            ----",
    "     v--.   v   ",
    "                ",
    "                ",
    "              4 ",
    "     +-.b       ",
    "       v     5 5",
    "                ",
    "     6      ^   ",
    "       ^    -   ",
    "   --.--.-   -  ",
    "  -           - ",
    " -   ^  ^      -",
    "-    -----      ",
    "                ",
  ],
  8: [ // EDGE OF DOOM (96 rows, 240s — 8-door summit ring #### #T##!)
    "                ",
    "                ",
    " ####    #T##   ",
    " ####    #T##   ",
    " ####    #T##   ",
    "         ----v  ",
    "                ",
    "                ",
    "                ",
    "                ",
    "                ",
    "                ",
    "                ",
    "   -            ",
    " .  -           ",
    "     -          ",
    "      -      b  ",
    "    4  -        ",
    "- -#    -  #  - ",
    "   #     - #    ",
    "   #      -# b  ",
    "   -  4    -    ",
    "    -        ^ .",
    "     -       -  ",
    "      -v        ",
    "                ",
    "                ",
    "                ",
    "                ",
    "                ",
    "                ",
    "   v---         ",
    "                ",
    "                ",
    "                ",
    "           6    ",
    "                ",
    "    -    -      ",
    "     - b-       ",
    "      -b        ",
    "       ^        ",
    "--- --------v---",
    "                ",
    "      7         ",
    "                ",
    "                ",
    "   ^            ",
    "   -..------+   ",
    "                ",
    "                ",
    "                ",
    "     1          ",
    "  v --.--       ",
    "#       #       ",
    "#       #       ",
    "#       #1     -",
    "-    ------   - ",
    "             -  ",
    "            .   ",
    "            .   ",
    "            .   ",
    " - #       #.   ",
    " - #   #   #.  #",
    "   #   #   #^  #",
    "  b-v  # - --  #",
    "-      -       -",
    "                ",
    "                ",
    "  b             ",
    "  ^ ^ -   -4-v  ",
    "  ---   -4      ",
    "       4        ",
    "     4          ",
    "                ",
    "     -   - - ^  ",
    "#   -  -#    -  ",
    "#  -    #       ",
    "# -     #       ",
    "--   #  --v  #  ",
    "     #       #  ",
    "     #       #  ",
    "   3 --v  .---  ",
    "  3-            ",
    "3 - -           ",
    "-             3 ",
    " -   -    b   - ",
    "   -        -  -",
    "             -  ",
    "                ",
    "                ",
    "                ",
    "     4          ",
    "    4           ",
    "   4            ",
    "  4    ^  ^     ",
    "--------  -     ",
    "                ",
  ],
};
```

---

## 3. Module-by-Module Upgrade Blueprint (Onto Our Next-Gen Codebase)

### 3.1 `src/levels.js` (`@levels_prog`) — Building `createOriginalTowers()` from `REAL_TOWER_GRIDS`
1. **Parse `REAL_TOWER_GRIDS` into `TowerDefinition`**:
   - Reverse `top` array so `rows[0]` is Floor `0` (stripping trailing empty sea row).
   - **IMPORTANT — Do NOT strip static ledges inside lift columns!** In `REAL_TOWER_GRIDS`, every `'^'` lift bottom at row `r` sits **1 row above a walkable ledge cell at `r - 1`** (and middle/top stops `'+'`/`'v'` sit level with adjacent ledges). Keep the `r - 1` ground ledge intact so Pogo walks onto `(c, r - 1)` and **auto-steps `+1` row onto the resting lift at `r`**!
   - **Ledges**:
     - `'-'` $\rightarrow$ `{ col: c, floor: r, type: 'solid' }`
     - `'.'` $\rightarrow$ `{ col: c, floor: r, type: 'crumble' }`
     - `'>'` $\rightarrow$ `{ col: c, floor: r, type: 'slideR' }`
     - `'<'` $\rightarrow$ `{ col: c, floor: r, type: 'slideL' }`
     - Vertical runs of `'!'` (`r0`, length `n`) $\rightarrow$ `{ col: c, floor: r0 - 1, type: 'pillar', h: n }`
     - Vertical runs of `'b'` (`r0`, length `n`) $\rightarrow$ `{ col: c, floor: r0 - 1, type: 'box', h: n }`
   - **Doors (`'#'` and `'T'`, 3 rows per door)**:
     - Split vertical runs in chunks of `3` (`floor = r0 + k - 1`).
     - Pair each non-exit `'#'` door at `(c, floor)` with `'#'` at `((c + 8) % 16, floor)`. If no partner exists (e.g. Tower 8's 7 summit decoy doors), set `targetId: null, decoy: true`.
   - **Elevators (`'^'` $\rightarrow$ `'+'` $\rightarrow$ `'v'`)**:
     - `{ col: c, minFloor: bottom, maxFloor: top, startFloor: bottom, stops: [bottom, ...middles, top], rowsPerSec: 3.1, speed: 3.1 }`.
   - **Enemies (`codes 1..7`)**:
     - Emit `{ type, kind, kspeed, col: c + 0.5, floor: r - 1, dir: (r + c) % 2 ? 1 : -1, spawnKey: `${c},${r}` }` with tower-appropriate HD visual types:
       - `1` $\rightarrow$ `type: 'roller', kind: 'roll', kspeed: 2.0`
       - `2` $\rightarrow$ `type: 'bouncer', kind: 'bounce', kspeed: 2.0`
       - `3` $\rightarrow$ `type: 'bouncer', kind: 'park', kspeed: 0`
       - `4` / `5` $\rightarrow$ `type: (id === 2 || id === 5 || id === 7) ? 'robotV' : 'eye', kind: 'vpat', kspeed: code === 5 ? 8.0 : 4.0`
       - `6` / `7` $\rightarrow$ `type: (id === 2 || id === 6 || id === 7 || id === 8) ? 'robotH' : 'eye', kind: 'hpat', kspeed: code === 7 ? 4.0 : 2.0`
   - **Set `real: true`, `era: 'original'`, `timeLimit: REAL_TIME_LIMITS[id - 1]`, `parTime: Math.round(REAL_TIME_LIMITS[id - 1] * 0.4)`**, plus 3 reachable `starCore` / `gear` collectibles placed along verified reachable ledges for optional progression parity!
2. **Update `verifyTowerSolvable(tower)` for `tower.real === true`**:
   - When `tower.real` is true, BFS graph transitions use the sourced 1987 kinematics:
     - Walk `±1 col` at same `floor` (blocked by `'pillar'`, shootable through `'box'`), auto-step `+1 row` onto adjacent step or resting lift `minFloor`, committed jump `Δcol = ±1..2` peaking `+2.25 rows` (respecting solid underside head-bump at `floor + 2`!), vertical lift travel across `stops` up to `maxFloor` (unless capped by unshot `'box'`), `180°` paired tunnel traversal (`targetId !== null` — emerging over empty space drops straight down to highest ledge `< target.floor`!), and straight-down ledge drops! All 8 `REAL_TOWER_GRIDS` are proven 100% solvable under these exact transitions.

---

### 3.2 `src/game.js` (`@gameplay`) — Exact 1987 Rule Fidelity on `tower.real` / `era === 'original'`
Preserve Reboot Mode (`era === 'reboot'`) untouched while enforcing every sourced 1987 rule when `this.era === 'original'` (and `this.tower?.real`):

1. **Lookup-Table Arcs & Walk Speed (`PORT_TICK = 1 / 32`)**:
   - `origWalkSpeed = 2.0` cols/s (digital constant speed, no slow analog crawl).
   - Running Jump: `ARC_JUMP` (`24` ticks = `0.75s`, horizontal `vx = facing * 2.0` cols/s fixed at takeoff = `1.5 cols`, peak `+2.25 rows`, no mid-air steering, solid slab underside head-bump!).
   - Auto-Step Climb: `ARC_CLIMB` (`14` ticks = `0.4375s`, peak `+1.25 rows`) triggered when walking into a `+1` solid/crumble/slide step **OR** a resting lift platform at `el.floor === Math.round(p.floor) + 1`.
   - Decoy Door Handling: Pressing `UP` at a `door.decoy === true` (unpartnered `'#'` door, such as Tower 8's summit decoys) plays a door-slam / bounce-back knockdown or passes through to `c + 8` over empty air (dropping Pogo 8–9 rows down the back of the summit, matching 1987!).
2. **Surface & Lift Rules**:
   - `crumble`: Vanishes immediately on walk/land (`gone = true`, `respawnTimer = 9999` — no regrow until life restart).
   - `slideR` / `slideL`: Pushes Pogo at `+2.0` / `-2.0 cols/s` **only when idle or shooting**; walking overrides it.
   - `'pillar'`: Solid horizontal wall from `l.floor` to `l.floor + l.h`; blocks Pogo, reverses enemies, absorbs snowballs, cannot be stood on or destroyed.
   - `elevators`: Ride at `el.rowsPerSec` (`3.1–4.0 rows/s`); stop at intermediate `el.stops` unless `UP`/`DOWN` stays held; auto-drop back to `el.minFloor` after `10.0s` empty; knock Pogo into tumble if ridden up into an intact `'box'`; disable snowball lift-recall on `tower.real`.
3. **Snowballs, 4-Enemy Spawner, Screen-Space Molecule & Tumble**:
   - **Snowball**: Max `1` active (`this.snowballs.length === 0`), fired while grounded & stationary (`4.0 cols/s`, `life = 0.75s` = `3.0 cols`, rising `+1.33 rows/s` = `+1.0 row` total).
   - **Snowball Matrix (Sourced 7800/CPC)**:
     - `'box'` $\rightarrow$ **DESTROYED** (`+50 pts`, `extras += 2`).
     - `'bouncer'` (`kind: 'bounce' | 'park'`) $\rightarrow$ **DESTROYED** (`+100 pts`, `extras += 5`; its `spawnPoint` marks `'destroyed'` for the remainder of this life attempt!).
     - `'roller'` (`kind: 'roll'`) $\rightarrow$ **STUNNED (`3.5s`)** (`0 pts`; freezes in place and **still blocks/knocks Pogo off** if touched!).
     - `'eye'`, `'robotV'`, `'robotH'`, `'molecule'` (`vpat` / `hpat` / `bonker`) $\rightarrow$ **IMMUNE** (`sound.deflect()`).
   - **4-Enemy Active Window + `18.75s` Molecule (`bonker`)**: Spawn dormant `tower.enemies` within `[-4, +9]` rows up to `MAX_REAL_ENEMIES = 4`; despawn to `'idle'` below `-12` rows; spawn 1 screen-space `bonker` Molecule at `player.floor` every `18.75s`!
   - **Hit Tumble (`ARC_TUMBLE`)**: Hops `+1.6 rows`, ignores platforms for `~8 rows` (`~3 rows` on Molecule hit), then lands on the next intact ledge below (or plunges into sea `< -0.55` $\rightarrow$ `-1` life $\rightarrow$ restart at Floor `0` with fresh timer & restored blocks/crumbles/balls).
4. **End-of-Tower Tally & Pure Classic Submarine**:
   - Award `Time (10 × ceil(timer))` + `Technique (tower.id >= 2 ? max(0, 100 - knockdowns * 2) * 10 : 0)` + `Extras (min(500, extras) * 10)`.
   - Submarine intermission (`era === 'original'`): `14.0s` pure voyage, **1 active stun bubble at a time**, two-step bubble-stun $\rightarrow$ touch-catch (`50 pts` per fish, zero mines/jellies).

---

### 3.3 `src/renderer.js` & `src/pogo.js` (`@renderer` / `@pogo_rig`) — 7800 Proportions $\times$ 2007–2010 XBLA HD Shaders
1. **Authentic 7800 Proportions on `tower.real` (`era === 'original'`)**:
   - Set floor world-unit step height `FH = 0.43` (vs `1.0` on Reboot 18-floor towers) so 47–96-row real towers have exact 7800 brick aspect ratios (`1` tall glossy brick course per step-row, `DOOR_H = 3 * FH`, `'pillar'` height `l.h * FH`, `'box'` height `l.h * FH`, ledge thickness `0.65 * FH`).
   - Switch `towerCam.fov = 18` (positioned proportionally further back so `±3.7` world units fit horizontally) to eliminate perspective magnification between Pogo (`R + 0.42`) and the cylinder face (`R = 2.55`), scaling `PogoRig` and enemy models to `~2.0 * FH` tall!
2. **Crisp 2007–2010 XBLA/PSN HD Visual Finish (Zero Weathered Grime / Zero Tilt-Shift)**:
   - **Bricks**: Clean, sharp-beveled glossy enamel/ceramic 3D bricks (`roughness: 0.24`, `metalness: 0.16`, crisp specular highlights, dark recessed mortar, vibrant 8-tower jewel palettes — **never** Reboot's mossy/pitted masonry).
   - **Ledges, Pillars & Boxes**:
     - `solid`: Glossy chamfered arcade stone/acrylic cap in `pal.ledgeTop` / `pal.ledge`.
     - `crumble`: Segmented amber/gold brittle arcade wafers (clean geometric seams, no organic lava rocks).
     - `slideR` / `slideL`: Mirror-slick glacier cyan/white slabs (`roughness: 0.08`) with subtle animated directional specular sheen arrows so the player can read the push direction!
     - `pillar` (`'!'`): Sleek fluted anodized metallic/enamel barrier column spanning `l.h * FH`.
     - `box` (`'b'`): High-visibility 8Hz strobing neon-gold/cyan/white bevelled arcade energy cube spanning `l.h * FH`.
   - **Doors & Lifts**: Crisp recessed black 3-row archways (with **identical exterior appearance on Tower 8's summit real exit `'T'` vs `'#'` decoys**, per `STATUS.md` presentation rule!) and sleek glowing neon-rail arcade platform lifts.
   - **Lighting & Sky**: Clean studio 3-point key/rim lighting (`exposure: 1.06`, bloom `threshold: 0.88, strength: 0.22`, **no tilt-shift blur**), deep cosmic-black/cobalt starfield sky with crisp horizon sunset band & clean glossy turquoise-blue waves.

---

### 3.4 `src/audio.js` (`@audio`) — Older-Era 2007–2010 XBLA / C64 SID Soundbank Verification
Our Next-Gen `src/audio.js` (`setEra('original')`) already supplies the exact older-era soundbank missing from `origin/main`! Ensure all Original-specific events route cleanly:
- **Music (`era === 'original'`)**: Dry-forward (`0.05` SFX / `0.07` Music wet) **`128 BPM`** punchy 2008 arcade synthwave featuring single-oscillator **50Hz stepped 3-note C64 SID triad arpeggios** (John M. Phillips homage), octave-jumping PWM/saw bass, crisp XBLA electro drums, and the **`132 BPM` major-key calypso-marimba Submarine bonus groove**.
- **SFX Cues**:
  - `stepUp()` on `ARC_CLIMB` (`+1` stair & bottom lift step-on)
  - `jump()` on `ARC_JUMP`
  - `snowball()` on stationary shot
  - `hitBlock()` on `'b'` flashing block shatter (`+50`)
  - `hitEnemy()` on `'2'`/`'3'` bouncing ball pop (`+100`)
  - `stunEnemy()` on `'1'` rolling ball stun
  - `deflect()` on `'!'` pillar or immune `vpat`/`hpat`/`bonker` ricochet
  - `crumble()` on instant `'.'` vanish
  - `hurt()` on `ARC_TUMBLE` knockdown
  - `timerTick()` at `<= 15s` countdown urgency.
