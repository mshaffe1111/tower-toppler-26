# Tower Toppler / Nebulus: research notes (sourced)

Research into the original game so the Classic campaign can be built from facts. It covers Tower
Toppler (Atari 7800, 1988), the Hewson original *Nebulus* (1987, John M. Phillips: C64, ZX
Spectrum, CPC, Amiga, ST) and the NES/Game Boy *Castelian*. It checks and corrects
[ORIGINAL-RULES.md](ORIGINAL-RULES.md) and [SPEC.md](SPEC.md).
The proposed changes are in the last section: [Changes the remake needs](#changes-the-remake-needs).

**Status labels**
- **CONFIRMED:** stated in an original manual; read directly from tower data and checked against an
  independent map; or stated by two independent sources that agree.
- **UNCERTAIN:** a single secondary source; a search-engine excerpt of a page I could not open; a
  value from a fan port with nothing to corroborate it; or my own inference.

**Fan-port data.** Two open-source fan versions turned out to be the richest technical sources:
- [S8] PICO-8 *Nebulus* by carlc27843. Its gameplay was studied from the Amstrad CPC original, and
  its code documents frame-level physics.
- [S9] *Toppler*, whose Mission 1 is a cell-by-cell transcription of the 8 original towers.

Both are remakes, so their numbers are labelled as port values. Where they agree with each other,
with the hand-drawn ZX maps or with the NES speedrun notes, that's said explicitly.

**Not reachable from this session:**
- Blocked: GameFAQs, the AtariAge forums, TCRF, MobyGames and Lemon64 (bot protection).
- Reset: web.archive.org and discmaster.
- Not on the allow-list: Hall of Light, GB64, C64-Wiki, Lemon Amiga, StrategyWiki and Atari
  Compendium.
- Refused by the permission system: archive.org magazine-scan downloads.

Facts from those sites came only through search-engine excerpts and are marked "(excerpt)".

---

## 0. Sources

| ID | Source | How read |
|---|---|---|
| S1 | Atari 7800 *Tower Toppler* manual (Atari, 1988, C300018-056 Rev. A): https://atariage.com/manual_html_page.php?SoftwareLabelID=713 | fetched, full text |
| S2 | Hewson *Nebulus* manual, C64 + ZX (English/French/German): https://spectrumcomputing.co.uk/zxdb/sinclair/entries/0003377/Nebulus(MULTI-LANG).pdf | fetched, full text |
| S3 | Spectrum Computing *Nebulus* entry (maps, magazine index): https://spectrumcomputing.co.uk/entry/3377 | fetched |
| S4 | VGMaps NES *Castelian* atlas (maps by zagato blackfist): https://www.vgmaps.com/Atlas/NES/index.htm | fetched |
| S5 | Wikipedia, *Nebulus (video game)*: https://en.wikipedia.org/wiki/Nebulus_(video_game) | fetched (wikitext) |
| S6 | TASVideos *Castelian*: https://tasvideos.org/1836G, author notes https://tasvideos.org/6194S, https://tasvideos.org/6439S, https://tasvideos.org/7806S | fetched |
| S7 | SDA Knowledge Base, *Castelian* Game Mechanics: https://kb.speeddemosarchive.com/Castelian_(NES)/Game_Mechanics | excerpt |
| S8 | PICO-8 *Nebulus* source (carlc27843): https://github.com/carlc27843/nebulus-public, files `out/nebulus-source.lua` and `out/nebulus-expanded.lua`; page https://carlc27843.itch.io/nebulus ("gameplay ... from studying the CPC version") | cloned and read |
| S9 | *Toppler* (open-source remake), fork https://github.com/Toast442/toppler of http://toppler.sourceforge.net. Data in `m1.ttm`, logic in `level.cc` and `robots.cc` | cloned, decoded |
| S10 | C64-Wiki: https://www.c64-wiki.com/wiki/Nebulus and https://www.c64-wiki.de/wiki/Nebulus | excerpt |
| S11 | TV Tropes, *Nebulus*: https://tvtropes.org/pmwiki/pmwiki.php/VideoGame/Nebulus | excerpt |
| S12 | FRGCB version comparison: http://frgcb.blogspot.com/2018/03/nebulus-hewson-consultants-1987.html | excerpt |
| S13 | Atari Compendium, 7800 easter eggs: https://www.ataricompendium.com/game_library/easter_eggs/7800/78towertoppler.html | excerpt |
| S14 | AtariProtos, 7800 prototype: http://www.atariprotos.com/7800/software/towertoppler/42287.htm | excerpt |
| S15 | AtariAge forum threads: 392175 (7800 source found), 250058 (7800 high-score club), 206505 and 30284 (difficulty switches), https://forums.atariage.com/ | excerpt |
| S16 | The Atari Times, 7800 review: http://www.ataritimes.com/index.php?ArticleIDX=357 | excerpt |
| S17 | Zzap!64 review, issue 32: https://www.zzap64.co.uk/cgi-bin/displayreview.pl?reviewid=45 | excerpt |
| S18 | Lemon64 *Nebulus* page and comments: https://www.lemon64.com/game/nebulus | excerpt |
| S19 | Red Parsley blog: http://redparsley.blogspot.com/2011/11/computer-platform-games-3.html | excerpt |
| S20 | NES *Castelian* manual transcription: http://www.world-of-nintendo.com/manuals/nes/castelian.shtml | excerpt |
| S21 | The player's own 7800 clip (`scratchpad/j3/` frames), HUD read frame by frame | local |

---

## 1. Manuals: the exact rules text

### 1.1 Atari 7800 manual [S1] (CONFIRMED, primary)
Controls table, verbatim:

| Action | Controller movement |
|---|---|
| Walk left or right | Move controller left or right. |
| Enter a tunnel or take elevator up | Move controller up. |
| Take elevator down | Move controller down. |
| Jump | Press fire button while walking. |
| Shoot enemies | Press fire button while standing still. |
| Shoot fish | Press fire button while in the minisub. |

Rules text, verbatim:
> "You're armed with a snowball gun, and you can destroy flashing block barricades by shooting them.
> You have to do that in order to get past them. You can also destroy all the rolling cannonballs
> except the ones that slide back and forth instead of bouncing. You can stun these for a few
> seconds, but you can't get past them."

> "All other creatures are indestructible. You have to time your movements to avoid them, or
> they'll knock you down the tower and maybe even into the water."

> "Your footing on the tower is shaky at best. Some ledges are slippery; others crumble beneath you.
> If you're lucky, you'll just fall partway down when you slip. If you're not so lucky, you'll find
> yourself taking an unplanned bath."

> "You start your mission with only three lives, and you use one up every time you go for a swim.
> You gain a bonus life every time you earn 5,000 points."

> "The clock starts ticking the moment you step out of your sub." ... "Between towers, you can relax
> in the minisub, racking up bonus points by stunning and catching fish as you speed to the next
> tower. As soon as you get there, the clock starts again."

> "Even if you survive your bath, you've got to start all over again at the bottom of the tower."

> "The game ends when you topple the last tower or lose your last life."

Scoring, verbatim:
> "Your final score is based on the amount of time you take to topple a tower, the number of
> mistakes you make in your climb, and the number of times your [sic] knocked partway or all the way
> down. You also score points as follows:
> Destroy a bouncing cannonball 100 points / Destroy a flashing block 50 points / Catch a fish 50
> bonus points / Step up onto some elevators 50 points / Go up some angled stairways (first time
> only) 40 points per stair.
> The points you earn for an elevator ride depend upon the length of the ride."

Tower blurbs (names and hints), verbatim:
- **Tower of Eyes:** "the easiest tower to topple, but watch out for the flying eyeballs that see
  every move you make."
- **Realm of Robots:** "Mechanical enemies make your life miserable."
- **Trap of Tricks:** "Be careful going through doorways. Some of them lead nowhere."
- **Slippery Slide:** "You'll wish you had grips on your shoes."
- **Broken Path:** "Get ready to do some real jumping. That's the only way you'll make it up the
  crumbling ledges of this tower."
- **Swimmer's Delight:** "It's delightful only if you don't mind losing a few lives."
- **Nasty One:** "your enemies will be hopping mad -- and meaner than ever!"
- **Edge of Doom:** "the hardest tower to topple."

Setup: "make sure that both difficulty switches are in the right position" (they drive the hidden
level select, section 10). The story names the enemies as "indestructible mutant molecules, weird
flying eyes, vicious robots, and huge cannonballs".

What the 7800 manual does not give: the snowball's range, the per-tower time limits, the
time-bonus rate, the technique-bonus formula and the elevator length bonus.

### 1.2 Hewson *Nebulus* manual, C64 and ZX [S2] (CONFIRMED, primary)
> Controls: "Left: Walk left / Right: Walk right / Up: Enter door/go up on lift / Down: Go down on
> lift / Fire: Shoot snowball or jump (if pressed while walking)".

> "You arrive at the bottom of each tower in your trusty submarine. Climb to the top of the tower
> within the allowed time. The towers are covered with various ledges, tunnels and lifts. You may
> also discover ledges which dissolve when you stand on them and slippery ledges which will push
> you left or right."

> "Flashing blocks and bouncing balls can be destroyed by shooting them but the silver rolling balls
> can only be stopped in their tracks for a few seconds. All other creatures are indestructible. If
> hit by a creature, you will tumble off the ledge and land a few levels down. If you fall in the
> sea, you lose a life."

> "Entering the final door at the top of the tower sets off the destruction sequence. You are
> awarded bonuses for the time left and for technique and the tower will crumble into the sea."

> "(Commodore Only) - During this time you can pick up bonuses by catching fish. This is achieved by
> shooting air bubbles to capture the fish, which can then be collected."

> SCORING: "Bouncing Ball: 100 points / Flashing Block: 50 points / Bonus points while climbing a
> tower. / Extra life every 5000 points."

> TECHNICAL DATA: "'Rotational' 3D scrolling with precise hidden-surface removal running at 25
> frames/second."

### 1.3 Other manuals (UNCERTAIN, excerpts only)
- **NES *Castelian* manual [S20]:**
  - HUD: "Lives remaining / Time remaining / Score / Tower number".
  - "Shoot the flashing ledges (brightly colored blocks) for extra points."
  - "Lives will not help Julius if he runs out of time."
- **Amiga manual (Lemon Amiga docs, excerpt via search):** "there is a set time limit for each one
  [tower]" and "The clock starts running from the moment that you step out of your sub."
- **Not obtained:** the US Gold C64 *Tower Toppler* manual (on archive.org) and the Atari ST
  manual. See [Still unknown](#12-still-unknown).

---

## 2. Controls, jumping and shooting

| Fact | Status | Source |
|---|---|---|
| Fire while walking jumps; fire while standing still shoots. There is no separate jump button. | CONFIRMED | S1, S2 |
| You can't jump from a standstill: in the port, fire with no direction held always shoots. | CONFIRMED (manuals) and port code agrees | S1, S2, S8 |
| Pressing the opposite direction plays a turn-around animation before walking. | UNCERTAIN (port) | S8 `plfuns` turn state |
| **Jump arc:** sideways speed is the same as walking speed, fixed at takeoff. It lasts 24 ticks, so it covers 1.5 columns (24 of the 16-units-per-column angle units). The peak is 18 world units = **2.25 step-rows**, and Pogo lands at the same height. If nothing is under him when the arc ends, he drops straight down with no more sideways motion. | UNCERTAIN (port values) | S8 `pljdys[1]`, `pljump`, `plfall(afterjump)` |
| **Jump in the remake's units:** at the 7800's measured walk of 2.0 columns/s, a jump lasts 0.75 s, travels 1.5 columns and peaks at 2.25 rows. It clears a 1-column gap and can land on a ledge up to 2 rows higher. | UNCERTAIN (inferred from S8 plus the walk speed measured in ORIGINAL-RULES) | |
| **Stairs:** walking into a 1-row step starts a short "climb" hop (14 ticks, peak 10 units) that lands on the step. There's no separate stair button. | UNCERTAIN (port) | S8 `pljump(pogojump.climb)` |
| **Snowball range:** it flies at 2× walking speed for 24 ticks, about **3 columns**, rising about 1 row along the way, then fades. Only one is on screen at a time. | UNCERTAIN (port); "short-range snowballs" also in S19 | S8 `updateshot`, `plshotdys` |
| Snowball effects: destroys flashing blocks and bouncing balls, stuns rolling balls, has no effect on anything else. | CONFIRMED | S1, S2; S8 implements the same |

---

## 3. Tower structure

| Fact | Status | Source |
|---|---|---|
| A tower is **16 columns round** (a closed loop). | CONFIRMED | S8 (`mapcellw` 16; 256 angle units, 16 per column), S9 (`TOWERWID` 16), hand-drawn ZX maps (16 blocks a lap, measured) |
| The vertical unit is a **step-row**. A stair step is 1 column wide and 1 row high. A door is 1 column wide and **3 rows** high. Ledges are 1 row thick. | CONFIRMED | S9 data, ZX maps (doors 2×3 grid squares, blocks 2×1), NES map (bricks 8 px, doors 24-25 px = 3 rows) |
| On the NES, one brick row = one step-row = 8 px. Ledges sit at any row, not on a fixed "floor" pitch. Stacked door levels are usually 4 rows apart (3-row door plus a 1-row ledge). | CONFIRMED (measured on [S4]) | S4 |
| Tower heights in step-rows: Eyes 47, Robots 71, Tricks 49, Slippery 66, Broken 96, Swimmers 64, Nasty 80, Doom 96. | CONFIRMED: S8's table, S9 (+1 empty base row), and the NES map heights (8 px a row, within ±2 rows) all agree | S8, S9, S4 |
| **Doors always come in pairs, column c and column c+8 at the same height** (a tunnel through the core). Going through turns the tower 180°. If the far door has no ledge under it, Pogo drops on exiting. | CONFIRMED (door pairs: S9 data on every tower; 180° turn: S8 code and S3 review); the drop-on-exit is from the port | S9, S8 |
| Door transit takes about 145 ticks: turn in, walk in, a 64-tick rotation, walk out. | UNCERTAIN (port) | S8 |
| **Lifts** have a bottom stop, optional middle stops and a top stop. Up at a bottom or middle stop rides up; Down rides down. Holding the direction carries you past middle stops; releasing it stops you at the next one. | CONFIRMED (Up/Down: S1, S2); stop logic UNCERTAIN (port) | S1, S2, S8 |
| Lift speed is 1 world unit per tick (8 ticks per row), i.e. 2 rows in the time it takes to walk 1 column. | UNCERTAIN (port) | S8 |
| A lift left at an upper stop waits 600 ticks (10 s) and then drops back to its bottom stop at 1 row per tick. | UNCERTAIN (port) | S8 `plpark`, `updateelevs` |
| Riding a lift up into a solid tile (e.g. a flashing block capping the shaft) knocks Pogo off (a 30-tick tumble). Lift shafts capped by flashing blocks appear in the data (e.g. Tower 8, column 13). | UNCERTAIN (port); the capped shafts are in S9 data | S8 `plchkcollide`, S9 |
| **Crumbling ("dissolving") ledges:** "ledges which dissolve when you stand on them" [S2]; "others crumble beneath you" [S1]. In the port the block disappears **the first tick Pogo stands on it** and doesn't come back until the tower restarts. That's why Broken Path is crossed by jumping. | CONFIRMED (they dissolve); instant and no regrowth UNCERTAIN (port; consistent with S1's Broken Path blurb) | S1, S2, S8 `plbreak` |
| **Slippery ledges** "will push you left or right" [S2]. In the port, a slippery cell moves Pogo 1 unit per tick in one fixed direction while he's **idle or shooting**; walking overrides it. It acts as a conveyor, not momentum ice. | CONFIRMED (they push you); port details UNCERTAIN | S2, S8 `plslide` |
| **Walking off an edge:** depending on how far past the edge Pogo is, he topples forward (keeps drifting in the walking direction), topples backward, or drops straight down. | UNCERTAIN (port) | S8 `plchkfall`, `plfallcodes` |
| **Stopping on stairs:** no source mentions sliding back down. Steps are ordinary 1-row platforms in the data and in the port. | UNCERTAIN (absence of evidence) | S8, S9, ZX maps |
| **NES only:** one door per tower (none on Tower 7) can also be entered with **Down**, and it then exits somewhere else. | CONFIRMED for NES (TAS notes) | S6 7806S |

---

## 4. Falling, getting hit, lives and the timer

| Fact | Status | Source |
|---|---|---|
| Touching an enemy doesn't kill you. You "tumble off the ledge and land a few levels down". Falling into the sea costs a life. | CONFIRMED | S2, S1, S5 |
| **Tumble shape (port):** a hit plays a 40-tick tumble (30 if it's the molecule, or being crushed on a lift). Pogo hops up about 2 rows, then drops **through platforms** for the rest of the tumble (net about 8 rows for 40 ticks, 3 rows for 30). Only after that does he fall normally and land on the next platform. So a hit usually drops you about 2 "floors", not just to the ledge under your feet. | UNCERTAIN (port); matches "a few levels down" [S2] | S8 `pltumbledys`, tumble state |
| **Hit while riding a lift:** the tumble waits until the lift reaches a row boundary. The lift parks there and later drops back down. | UNCERTAIN (port) | S8 |
| **Hit on stairs:** no special case; it's the same tumble. | UNCERTAIN (port) | S8 |
| No invulnerability window after a hit appears in the port (collisions are simply off during the tumble). | UNCERTAIN (port) | S8 |
| Losing a life (sea or time-out): restart at the bottom of the tower. | CONFIRMED | S1 ("start all over again at the bottom") |
| The timer resets with a new life. | CONFIRMED (port code), UNCERTAIN for 7800 (a review's tip, "jump into the water to lose a life to reset the timer") | S8 `levelreset`; review excerpt |
| Running out of time costs a life. | CONFIRMED | S17 (Zzap!64, excerpt), S16; NES manual says lives "will not help ... if he runs out of time" (meaning unclear) |
| The clock starts when Pogo steps out of the sub. | CONFIRMED | S1, Amiga docs |
| Lives: start with 3, +1 every 5,000 points. | CONFIRMED | S1, S2 |
| Maximum 8 lives. | UNCERTAIN (port) | S8 |
| NES Hero difficulty: extra life every 10,000. | CONFIRMED for NES | S6 6194S |
| **7800 timer display:** 3 digits plus tenths ("061:5"), counting down. | CONFIRMED (seen in the player's clip) | S21 |
| 7800 timer rate: in the clip it falls about 2.07 units per 150 extracted frames. That's 1 unit ≈ 1.2 s **if** the frames are 60 fps. The extraction rate isn't recorded. | UNCERTAIN | S21 |
| NES timer: 1 tick per 20 game frames (60 NES frames, 1 s) on Novice; per 15 game frames (45 NES frames) on Hero. | CONFIRMED for NES | S6 6194S |
| 7800 glitch: a player reports jumping into a ball near time-out set the timer to 999. | UNCERTAIN (one forum post) | S15 (250058) |

---

## 5. Scoring

| Item | 7800 (manual) | C64 / CPC / NES | Status |
|---|---|---|---|
| Bouncing ball destroyed | 100 | 100 [S2]; port 100 | CONFIRMED |
| Flashing block destroyed | 50 | 50 [S2]; port 50 | CONFIRMED |
| Fish caught | 50 | port 50 | CONFIRMED (S1) |
| Stairs | 40 per stair, first time only | not in S2 ("Bonus points while climbing a tower") | CONFIRMED for 7800 |
| Elevators | 50 for "some elevators", plus points that "depend upon the length of the ride" | — | CONFIRMED for 7800; formula unknown |
| Height points | — | port: +10 per new row of maximum height (any means). C64-Wiki (de): "Höhenpunkte - je höher die Spielfigur, desto mehr Punkte" | UNCERTAIN; **7800 uses stair/lift points instead** |
| Time bonus | "based on the amount of time" | 10 per whole second left [S10]; port 10 per second, rounded up | CONFIRMED for C64 (two sources); 7800 rate UNCERTAIN |
| Technique bonus | "number of mistakes ... times knocked partway or all the way down" | starts at 100, **−2 per enemy contact**, paid ×10, **none on Tower 1** [S10]. NES: starts at 100, −2 per hit [S6]. Port: 100, −1 per tumble, ×10, on every tower | CONFIRMED (100 start, −2: S10 + S6); Tower 1 exclusion UNCERTAIN (S10 only); 7800 UNCERTAIN |
| Extras bonus | not mentioned | **+5 per ball shot, +2 per flashing block shot, paid ×10** [S10 (de), S8, identical]. NES: 5 on completion plus 2 per destroyed enemy [S6]. Port caps extras at 500. | CONFIRMED for C64/CPC; 7800 UNCERTAIN |
| Extra life | every 5,000 | every 5,000 | CONFIRMED |
| End-of-tower tally order | — | Time, then Technique, then Extras, each counted down into the score | CONFIRMED (S6 NES + S8) |

C64-Wiki (English) also has a per-tower "Runpoints" table (Tower 1: blue, 2,040, "57,9", "60,5").
Only the first row came through, and its columns aren't clear (UNCERTAIN, [S10]).

---

## 6. Enemies

There are three behaviour families plus the flashing block. The look of the patrollers changes per
tower ("flying eyes" on Tower 1, "robots" on Tower 2, and so on), but the behaviour codes are shared.
Toppler's robot codes 1-7 [S9 `robots.cc`] and the PICO-8 spawn table [S8 `aispawnt`] map
one-to-one. That's two independent remakes using the same seven enemy kinds (CONFIRMED that both
use them; that the original does too is inferred).

| Enemy | Movement | Shot | Points | Status / source |
|---|---|---|---|---|
| **Flashing block** (barricade) | Static. Blocks a path or caps a lift shaft. | Destroyed | 50 (+2 extras) | CONFIRMED S1, S2, S10 |
| **Bouncing ball** ("bouncing cannonball", red) | Moves around the tower at walking speed, or sits still. Bounces in a fixed arc (+12 units up, then falls at up to 4/tick), so it bounces down stairs and off ledges, and vanishes in the sea. Reverses at walls. A parked ball starts towards Pogo when he walks on its row within a quarter lap. | **Destroyed** | 100 (+5 extras) | Destroyed and 100 CONFIRMED (S1, S2); movement UNCERTAIN (S8) |
| **Rolling ball** ("silver rolling ball" / "slides back and forth") | Rolls at walking speed and reverses at ledge ends and lifts. Falls if it rolls off where there's no platform nearby. | **Stunned** for "a few seconds" (port: 180 ticks = 3 s). A stunned ball still blocks and knocks you off: "you can't get past them". | 0 | CONFIRMED S1, S2 (stun, can't pass); 3 s UNCERTAIN (S8) |
| **Vertical patroller** (eyes, robots, etc.) | Moves straight up and down at 1 or 2 units/tick and reverses on hitting a tile or another enemy. | Immune (absorbs the shot) | — | Immune CONFIRMED (S1, S2); movement UNCERTAIN (S8, S9 `ROBOT_VERT`, ZX maps draw vertical arrows) |
| **Horizontal patroller** | Moves around the tower at 1 or 2 units/tick and reverses on obstacles. Some patrol the whole lap (ZX Tower 3 map). | Immune | — | Same as above (S9 `ROBOT_HORIZ`) |
| **Molecule** ("mutant molecule"; "bonker" in S8, "cross" in S9) | **A timed flyer, not tied to the tower.** Every ~600 ticks (10 s), when nothing else is spawning, it flies across the **screen** at Pogo's current height, alternating sides, slow at first and then faster. It lasts ~202 ticks. A Lemon64 player: "every so many seconds, the game would fire a projectile across the tower at you." | Immune (shots pass through) | — | Existence and timer CONFIRMED (S8 + S9 + S6/S7 NES "molecule timer" + S18); the exact 600/202 ticks are UNCERTAIN (port). NES: molecules are twice as fast on Hero [S6]. Speedrunners use deliberate molecule hits to drop onto lower ledges in Towers 3 and 4 [S6]. |

Spawning: enemies are placed at fixed cells in the tower data. They spawn as the view scrolls up to
them and despawn when they fall more than 12 rows below Pogo. **At most 4 enemies exist at once,
including the molecule.** CONFIRMED: the NES TAS [S6] ("can only store four enemies ... including
the molecule") and S8 (`#ais>=4`) agree.

Enemies per tower (from the S9 data; codes as above):

| Tower | rolling | bouncing (moving / parked) | vertical (slow / fast) | horizontal (slow / fast) | flashing blocks |
|---|---|---|---|---|---|
| 1 Tower of Eyes | 2 | 1 / 2 | 3 / 0 | 1 / 0 | 2 |
| 2 Realm of Robots | 0 | 0 / 0 | 3 / 1 | 2 / 2 | 0 |
| 3 Trap of Tricks | 0 | 0 / 2 | 2 / 0 | 2 / 0 | 2 |
| 4 Slippery Slide | 0 | 2 / 3 | 6 / 0 | 1 / 0 | 5 |
| 5 Broken Path | 0 | 2 / 2 | 7 / 4 | 1 / 3 | 4 |
| 6 Swimmer's Delight | 0 | 0 / 0 | 4 / 6 | 4 / 0 | 4 |
| 7 Nasty One | 0 | 6 / 0 | 5 / 2 | 5 / 1 | 3 |
| 8 Edge of Doom | 2 | 0 / 4 | 10 / 0 | 1 / 1 | 7 |

---

## 7. Submarine bonus stage

| Fact | Status | Source |
|---|---|---|
| Between towers you ride the minisub. You shoot to stun or bubble fish, then touch them to collect: 50 each. | CONFIRMED | S1, S2 |
| The stage exists on C64 and 7800 (and Amiga/ST). **ZX Spectrum and CPC have no fish stage.** NES/Game Boy replace it with side-scrolling platform bonus stages (the 7 "Bonus" maps on VGMaps). | CONFIRMED (S2 "Commodore only", S5, S12); NES detail UNCERTAIN (S11) | S2, S5, S12, S11, S4 |
| Amiga: fish give **extra time for the next tower** instead of points, and the display glitches above 50. | UNCERTAIN | S11, S12 |
| Port: up to 6 fish; one stun bubble at a time, travelling at 4 px/tick; a stunned fish stops drifting; the stage ends when the next tower's pylon scrolls in (fixed length). | UNCERTAIN (port) | S8 |
| 7800 reviewer: "you can only fire slow moving, singular bullets". | UNCERTAIN (one review) | review excerpt |

---

## 8. The eight towers

### 8.1 Names, heights and time limits

| # | Name (7800 manual) | Height (step-rows) | CPC-derived port timer | NES (TV Tropes rule: 100, +20 per tower) | Amiga (TV Tropes rule: 400, +50 per tower) | 7800 |
|---|---|---|---|---|---|---|
| 1 | Tower of Eyes | 47 | **100** | 100 | 400 | 100? (review: "the allotted 100 seconds") |
| 2 | Realm of Robots | 71 | **120** | 120 | 450 | ? |
| 3 | Trap of Tricks | 49 | **140** | 140 | 500 | ? |
| 4 | Slippery Slide | 66 | **160** | 160 | 550 | ? |
| 5 | Broken Path | 96 | **180** | 180 | 600 | ? |
| 6 | Swimmer's Delight | 64 | **200** | 200 | 650 | ? |
| 7 | Nasty One | 80 | **220** | 220 | 700 | ? |
| 8 | Edge of Doom | 96 | **240** | 240 | 750 | ? |

- **Port column:** read directly from S8's `levels` table (`plt` field, multiplied by 60 ticks).
- **NES and Amiga columns:** worked out from TV Tropes' wording ("counts down from 100 and adds 20
  each stage" / "from 400 and adds 50"), so UNCERTAIN.
- **Agreement:** the port and the NES rule agree exactly (CONFIRMED that 100 + 20 per tower is used
  in at least two versions).
- **7800:** only the tower 1 value is hinted, by one review (S16, UNCERTAIN).
- **Tower names:** CONFIRMED by S1, S8, S9 and S4.

### 8.2 Per-tower notes and tricks (from the S9 tower data, checked against the ZX maps)
- **Fidelity check:** door, lift, crumbling-block and exit positions in S9 were compared with the
  independent hand-drawn ZX maps for Towers 1, 3 and 8, and match column for column (CONFIRMED).
  Slippery tiles are **not** marked on the ZX maps, so S9's slippery marks are unverified.
- **Start:** Pogo starts at column 0 on the ground ledge (ZX maps "START"; S8 `levelreset`).
- **Tower 1, Tower of Eyes:**
  - Two crumbling blocks in the ground ledge right next to the start (columns 3-4).
  - Exit at column 4 at the top.
  - 5 tunnel pairs.
- **Tower 3, Trap of Tricks** ("Some of them lead nowhere"):
  - 4 tunnel pairs; two of them drop you when you come out: row 12, column 6→14 (a 5-row drop) and
    row 39, column 7→15 (3 rows).
  - The NES speedrun shows a forced molecule hit used as a route (Towers 3 and 4) [S6].
- **Tower 4, Slippery Slide:** a vertical stack of 5 crumbling blocks (column 6) above the summit
  approach, and lifts capped by flashing blocks.
- **Tower 5, Broken Path:** a "ladder" of tunnel pairs on rows 64-76 (columns 3/11, 5/13, 7/15,
  1/9). One direction of each drops you 11-21 rows. Many crumbling blocks.
- **Tower 6, Swimmer's Delight:** the tower with the most lifts (11). Exit at column 2.
- **Tower 7, Nasty One:** **no tunnel doors at all**, only the exit (CONFIRMED: S9 data plus the
  NES TAS note "tower 7 ... doesn't have any door openings" [S6]). The climb is all lifts (14),
  stairs, crumbling blocks (11) and 6 moving bouncing balls.
- **Tower 8, Edge of Doom: the summit door puzzle.**
  - The summit row has doors at columns 1-4 and 9-12, with the **EXIT at column 10**.
  - A ledge runs under columns 9-12, and the lift's top stop is at column 13.
  - Arriving by that lift and walking left, you pass column 12 (decoy), column 11 (decoy), then
    column 10 (**EXIT**): **the third door from your arrival point**.
  - The decoys at 9, 11 and 12 tunnel to columns 1, 3 and 4 on the far side, where there's no
    ledge, so you fall 8-9 rows.
  - Status: CONFIRMED for door and exit positions (S9 plus the ZX map, which labels "EXIT" at the
    second door of the right-hand group of four). The lift at column 13 is S9 only.

---

## 9. Maps downloaded

All in `/tmp/claude-0/-home-user-tower-toppler-26/33e04cb8-4314-54eb-9b30-8537be1ef792/scratchpad/research/maps/`:

| File | What it is | Source |
|---|---|---|
| `zx-nebulus-tower1-TowerOfEyes-unrolled-handdrawn.jpg` … `zx-nebulus-tower8-EdgeOfDoom-unrolled-handdrawn.jpg` (8 files) | **Full unrolled maps of all 8 towers** on graph paper (ZX Spectrum). They mark doors, the EXIT, lifts (↕ blocks), crumbling blocks (hatched full blocks), flashing blocks (small hatched squares) and enemies with their paths (arrows). 16 blocks a lap. | S3 `games-maps/n/Nebulus.zip` |
| `zx-nebulus-all8towers-front-back-screens.png` | Screen-ripped front and back views of all 8 ZX towers side by side (shows relative heights) | S3 `Nebulus_2.png` |
| `zx-nebulus-tower2+3-magazine-map.jpg`, `zx-nebulus-tower4+5-magazine-map.jpg`, `zx-nebulus-tower6-magazine-map.jpg` | Magazine front/back maps ("Standby to access: Nebulus … section writer: Jon Riglar"), Towers 2-6 | S3 |
| `nes-castelian-tower1-TowerOfEyes.png` … `nes-castelian-tower8-EdgeOfDoom.png` (8 files) | NES front and back views of every tower | S4 |
| `nes-castelian-bonus1-sub-stage.png` … `bonus7` (7 files) | NES bonus stages (side-scrolling, replacing the sub stage) | S4 |
| `toppler-mission1-original-towers-ascii.txt` | **Machine-readable cell grid of all 8 towers** (16 columns × 48-97 rows), decoded from S9 `m1.ttm`. Also reproduced in [Appendix A](#appendix-a-tower-cell-maps). | S9 |
| `pico8-port-constants.txt` | The physics and scoring constants and tables extracted from S8 | S8 |

I found no complete C64, Amiga, ST or 7800 tower maps; VGMaps has only the NES set. The scratchpad
`research/` folder also keeps the manual texts (`manuals/tt7800-atariage-manual.txt`,
`manuals/zx-nebulus-multilang.pdf` and `.txt`) and the decoder scripts (`scripts/ttm_dump.py`,
`scripts/p8val.py`, `scripts/doors.py`).

---

## 10. Differences between versions

| Topic | 7800 | Others | Status / source |
|---|---|---|---|
| Lineage | The C64 and 7800 versions are "made from the same mold", with only slight font differences; the C64 uses 5 colours to the 7800's 3. An Atari 8-bit prototype of the 7800 version exists. | — | UNCERTAIN [S12] |
| Developer | U.S. Gold in the UK programmed the 7800 port. Its source was recovered from a disk labelled FINALTOPP and recompiled (AtariAge thread 392175). | — | UNCERTAIN [S15, S14] |
| Scoring while climbing | 40 per new stair, 50 on some lifts plus a ride-length bonus | Port: 10 per new row of height. C64: "height points" | 7800 CONFIRMED [S1]; others UNCERTAIN |
| Hidden level select | Left difficulty switch: move it left to cycle towers, right to pick. Also an unlimited-lives trick and a "game completed" message trick. The prototype lacks it. | NES (JP): password system | UNCERTAIN [S13, S14, S15]; sources differ on which switch |
| Players | 1 or 2 players (alternating; second controller in the right port) | C64/ZX: one or two players (F1/F3, keys 1/2) | CONFIRMED [S1, S2] |
| Prototype | Different start-of-level music; each level a different colour; the final adds a parallax bonus screen | — | UNCERTAIN [S14] |
| Bonus stage | Fish, 50 points each | C64 fish; ZX/CPC none; Amiga fish give time; NES platform stages | see section 7 |
| Difficulty modes | Difficulty switches (level select only) | NES: Novice/Hero. Hero runs the timer 4/3 faster, molecules 2× faster, extra life every 10,000 | NES CONFIRMED [S6] |
| Doors | Up only | NES: one door per tower also works with Down, exiting elsewhere | NES CONFIRMED [S6] |
| Hero | Frog-suited Destructo, Inc. operative (unnamed in the 7800 manual) | "Pogo" (Wikipedia); "Julius" (NES); Kyoro-chan (JP) | CONFIRMED [S1, S5, S6] |
| Frame rate | — | ZX/C64 "25 frames/second" rotational scrolling | CONFIRMED [S2] |

---

## 11. Conflicts between sources
1. **Technique penalty:** −2 per hit (C64-Wiki [S10], NES TAS [S6]) vs −1 per tumble (port [S8]).
   Prefer −2.
2. **Technique on Tower 1:** none on Tower 1 (C64-Wiki, which matches ORIGINAL-RULES) vs every
   tower (port). Not resolved for the 7800.
3. **Climbing points:** the 7800 manual (40 per stair, 50 per lift plus length) vs the port (10 per
   new row). These are probably real version differences. Keep the 7800 manual for a 7800-faithful
   mode.
4. **Extras:** +5/+2 per kill (C64-Wiki, port) vs NES (+5 once at completion, +2 per kill).
5. **Timers:** Amiga 400 + 50 per tower (TV Tropes) vs NES/CPC 100 + 20 per tower. The 7800 is
   unconfirmed beyond the "100 seconds" review line.
6. **Level-select switch:** left (Atari Compendium, GameFAQs) vs right (one AtariAge poster).
7. **7800 prototype disk:** "Atari ST disk labelled FINALTOPP" (AtariAge) vs "same disk as the
   final Atari XE version" (AtariProtos).

---

## 12. Still unknown
- **7800 per-tower time limits** (only the Tower 1 "100 seconds" hint), and whether a 7800 timer
  unit is a real second (the clip suggests about 1.2 s, frame rate unconfirmed).
- **7800 frame-level physics:** jump length and height, snowball range, lift speed and stun time.
  No 7800 disassembly was reachable. The recovered 7800 source (AtariAge thread 392175) is behind
  Cloudflare. All motion numbers above come from the CPC-derived PICO-8 port, so check them against
  7800 footage.
- **7800 elevator length bonus** formula, and which elevators pay the 50.
- **7800 time-bonus rate** and **technique formula** (whether Tower 1 is excluded, and −2 per hit),
  and whether the 7800 has an "Extras" tally.
- **Which ledges are slippery** in each tower, and which way they push (the ZX maps don't mark
  them; S9 marks only a few, all pushing the same way).
- **Crumbling delay:** instant in the port; no primary source gives a delay.
- Any **invulnerability** window after a hit (none in the port).
- **The Amiga, ST and US Gold C64 manuals** (Lemon Amiga docs and archive.org were not reachable or
  were refused).
- **Magazine solutions and maps:**
  - Crash #49, #51 and #59 (an 8-part solution).
  - Sinclair User #73 and #74 (maps).
  - C&VG #75 (player's guide and map).
  - These exist as World of Spectrum scans on archive.org, but the download was refused by the
    permission system.
- **GameFAQs FAQs** for *Castelian* and *Tower Toppler* (blocked by bot protection).
- C64-Wiki's per-tower "Runpoints" table (only its first row came through).

---

## Appendix A: tower cell maps

All 8 original towers, decoded from Toppler `m1.ttm` [S9] (https://github.com/Toast442/toppler).
Door, lift, crumbling-block and exit positions were checked against the hand-drawn ZX maps [S3]
for Towers 1, 3 and 8 (CONFIRMED). Slippery marks and the enemy codes are UNCERTAIN.

- The top of each tower is printed first. Each text row is one step-row; there are 16 columns
  and they wrap round.
- Toppler's `time` value is its own unit, not the original timer.
- Toppler's `color` value is its own choice, not the original colour.

```text
Toppler (open-source remake, GPL) Mission 1 = transcription of the 8 original Nebulus towers.
Source: https://github.com/Toast442/toppler (fork of toppler.sourceforge.net), file m1.ttm, decoded with scripts/ttm_dump.py
16 columns around the tower (wraps). Top of tower printed first. 1 text row = 1 step height.
Legend: '-' ledge/step, '.' vanishing (crumbling) step, '>' '<' slippery step pushing right/left, '#' door/tunnel, 'T' target (summit) door, 'b' box = flashing block,
        '^' lift bottom (lift platform), 'v' lift top stop, '+' lift middle stop, '!' lift shaft/stick, '1'-'7' robot spawn (enemy type index in Toppler, NOT original enemy ids)
'time' is Toppler's own unit, NOT the original timer.
mission Mission 1 towers 8

== tower 1 Tower of eyes time 500 color (255, 0, 0) robot 0 height 48
|                |
|                |
| #  T    #      |
| #  T    #      |
| #  T    #      |
| ----    --v6   |
|#!      # !     |
|#!      # !     |
|#!      # !^    |
|--   v.-- ------|
|                |
|                |
|       1        |
|      ---       |
|                |
|                |
|         4      |
|                |
|    -       --v |
|    !       !   |
|    !  2    !   |
|    -.-------   |
|     .          |
|     .          |
|     ^          |
| #   -   #      |
| #       #      |
| #     4 #  3 ^ |
| ->>     ------ |
|    >>          |
|      >         |
|       >    b   |
|        >3  b   |
|         -----v |
|                |
|                |
|                |
|         1    ^ |
|        ----v-- |
|                |
|      #       # |
|      #       # |
|      # 4   ^ # |
|  #   v   # --- |
|  #       #     |
|  #   ^   #     |
|---..------     |
|                |

== tower 2 Realm of robots time 600 color (150, 150, 255) robot 1 height 72
|                |
|                |
|     T          |
|     T          |
|     T          |
|     v          |
|                |
|                |
|                |
|    -.-         |
|       -        |
| 7      ---     |
|     ^     -    |
|     --     --- |
|               -|
|--         7    |
| #-      #      |
| # -     #      |
| #  -    #      |
| .   -----v     |
| .              |
|                |
|                |
|                |
|                |
|                |
|                |
|                |
|                |
|                |
|    #       #   |
|    #       #   |
|    #       #   |
|   ---v 6       |
| --             |
|-              -|
|          ^  -- |
|          ---   |
|                |
|                |
|                |
|          4     |
|                |
|                |
|                |
|           >>v  |
|          -     |
|  #      -#     |
|  #     - # 4   |
|  #   ^-  #     |
|  -v  -   --    |
|  !       !     |
|  !6      !     |
|  !       !  ^  |
|  !^      ----  |
| v---           |
|     >          |
|      >         |
|       >    4   |
| ^      -       |
| -v  #   -   #  |
|     #    -  #  |
|     #     - #  |
|     --v    --  |
|  ^             |
| --            -|
|       ^5v      |
|       -        |
|                |
|         ^      |
|-..     --- - --|
|                |

== tower 3 Trap of tricks time 700 color (170, 170, 170) robot 2 height 50
|                |
|                |
|    T           |
|    T           |
|    T           |
|   v-      ---  |
|                |
|                |
|       #       #|
|       #       #|
|       #       #|
|       --v      |
|    #       #   |
|    #    6  #   |
|   ^#       # --|
|   --       --  |
|                |
|                |
|                |
|                |
|         b      |
|         b      |
|          ---   |
|    6        -  |
|              - |
|     v-        -|
|-      - ^      |
| -      -- 4    |
|  -             |
|   -- 4         |
|           -v   |
|                |
|          -     |
|     ^          |
|     -----      |
|     !#       # |
|     !#       # |
|     !#       # |
|  -v-----v      |
|                |
|                |
|                |
|        3   ^   |
|    -----.  --- |
|                |
|    #       #   |
|    #       #   |
|   ^#    ^3 #   |
|-  --    -------|
|                |

== tower 4 Slippery slide time 800 color (163, 120, 88) robot 3 height 67
|                |
|                |
|         T      |
|         T      |
|         T      |
| v-      ---v   |
|  !        !    |
|  !        !    |
|  !  2 2   !    |
|  ----.-----    |
|      .         |
|      .         |
|      .         |
|      .         |
|      .         |
|      --..-     |
|                |
|                |
|            ^   |
|           --   |
|                |
| 3              |
| ^ -            |
| -- -.-         |
|       -        |
|        -       |
|         - 4    |
|     -v-  - 4   |
|           -    |
|       #    -  #|
|    6  #     - #|
|       #      -#|
|   --- ----    -|
|           -    |
|            -   |
|                |
|    3           |
| v---           |
|    !-^ 44      |
|- # ! -   #     |
|  # !     #     |
|# # !  -# #     |
|#b-v-   # -     |
|#     # #-    # |
|-b    # -     # |
|    3 #       #-|
| ^  ---       - |
| -              |
|                |
|                |
|     #       #  |
|#    #  #    #  |
|#  ^ #  #    #  |
|#  ---  #    -  |
|-       -v    -.|
|  b             |
|  b      b      |
|  >>>>>v        |
| -       ^      |
|-        -------|
|    4           |
|                |
|   - - ^        |
|  -   4-        |
| -              |
|-   . .    -----|
|                |

== tower 5 Broken path time 900 color (0, 155, 155) robot 4 height 97
|                |
|                |
|    -     T     |
|     -    T     |
|          T     |
|    4     -v    |
|     4    !     |
|          !     |
|          !     |
|          !     |
|  23      !^    |
|---------v------|
|                |
|                |
|                |
|                |
|                |
|                |
|       #       #|
|     7 #       #|
|  5  # # ^   # #|
|     # - --- #  |
|   # #-    #-#  |
|   # -     # -  |
| # #-    # #    |
| # -     #      |
| #-   4# #     #|
| -     # -     #|
|     # #-    # #|
|     # -     #  |
|   # #-    # #  |
|   # -     #    |
|   #-      #    |
|   -       v    |
|                |
|                |
|   6-v-         |
|                |
| -           4  |
|  -         5   |
|   -   >>       |
|    - -         |
|>             >>|
|             -  |
|           ^-   |
|       4   -    |
|                |
|                |
|   -  #       # |
|   v  #       # |
|      # --    # |
|           v-.. |
|       -        |
|                |
|     b          |
|       5        |
|-v      - - - --|
|     ^   4      |
|     ---        |
|         .      |
|                |
|                |
|    7           |
|          -     |
|                |
|                |
|- - - - -v5     |
|           ^    |
|  -       --    |
| . .            |
|                |
| b              |
| b              |
| ^ ^            |
| ---            |
|                |
|    7           |
|         ^      |
|        --      |
|       -        |
|   #  -    #    |
|   # -     #    |
|   #-      #    |
|   -       -    |
|          -     |
|         -    3 |
|-v      -     --|
|   4  v-      ! |
|      b       ! |
|        2     ! |
| +--.- -.------ |
|                |
|                |
|                |
| ^    ^         |
|--    ----      |
|                |

== tower 6 Swimmers delight time 1000 color (255, 100, 100) robot 5 height 65
|                |
|                |
|  T             |
|  T             |
|  T             |
|  -             |
|          6     |
| -              |
|    6           |
|-               |
|            6   |
|               -|
|      6         |
|              - |
|                |
|          -  -  |
|       -        |
|         b  -   |
|                |
|      -  v -    |
|     -          |
|  v--     5     |
|           4    |
|                |
|                |
|            4   |
|           --v  |
|         ^-     |
|         -      |
|                |
|                |
|                |
|                |
|                |
|                |
|             ^  |
|v    - v------  |
|      -         |
| #.     -#      |
| #   5   #      |
|^#.      #      |
|--       --5-   |
|  .   5^        |
|   v----     -  |
| #. #    #  #   |
| #  #    #  # - |
| #^^#    #  #   |
|-----    ----  -|
| -      -       |
|       -        |
|  b   -         |
|- v---        v-|
| #       #      |
| #       #      |
| #       #    b |
|  ^--v 4 -5     |
|  -       -v    |
|4               |
|              ^ |
| - v- --     ---|
|    !           |
|    !b          |
|   ^!^  5  ^    |
|------------    |
|                |

== tower 7 Nasty one time 1100 color (150, 255, 150) robot 6 height 81
|                |
|                |
| T              |
| T              |
| T              |
| v              |
|                |
|                |
|            2  2|
|-.       v------|
|                |
|                |
|              22|
|-.        v-----|
|                |
|                |
|     2          |
| .------v       |
|                |
|                |
|  2             |
| ^-- --v        |
| -  -           |
|                |
|                |
|                |
|                |
|    4           |
|   4 4          |
|                |
|       ^^^^     |
|  v--------     |
|                |
|                |
|        7       |
|                |
|           -   -|
|- ^    -- - - - |
| --   v  -   -  |
|                |
|                |
|     6          |
|      ^  4      |
|    ---         |
| - -       - - -|
|. .       - . . |
|         -      |
|       v-       |
|                |
|                |
|                |
|    6 v         |
|       ^        |
|       -        |
|                |
|    6v          |
|      ^         |
|      -         |
|                |
|     6          |
|     b          |
|     b          |
|   - ^          |
|  - --  v-      |
| -        -     |
|-          -    |
|            ----|
|     v--.   v   |
|                |
|                |
|              4 |
|     +-.b       |
|       v     5 5|
|                |
|     6      ^   |
|       ^    -   |
|   --.--.-   -  |
|  -           - |
| -   ^  ^      -|
|-    -----      |
|                |

== tower 8 Edge of doom time 1200 color (255, 155, 0) robot 7 height 97
|                |
|                |
| ####    #T##   |
| ####    #T##   |
| ####    #T##   |
|         ----v  |
|                |
|                |
|                |
|                |
|                |
|                |
|                |
|   -            |
| .  -           |
|     -          |
|      -      b  |
|    4  -        |
|- -#    -  #  - |
|   #     - #    |
|   #      -# b  |
|   -  4    -    |
|    -        ^ .|
|     -       -  |
|      -v        |
|                |
|                |
|                |
|                |
|                |
|                |
|   v---         |
|                |
|                |
|                |
|           6    |
|                |
|    -    -      |
|     - b-       |
|      -b        |
|       ^        |
|--- --------v---|
|                |
|      7         |
|                |
|                |
|   ^            |
|   -..------+   |
|                |
|                |
|                |
|     1          |
|  v --.--       |
|#       #       |
|#       #       |
|#       #1     -|
|-    ------   - |
|             -  |
|            .   |
|            .   |
|            .   |
| - #       #.   |
| - #   #   #.  #|
|   #   #   #^  #|
|  b-v  # - --  #|
|-      -       -|
|                |
|                |
|  b             |
|  ^ ^ -   -4-v  |
|  ---   -4      |
|       4        |
|     4          |
|                |
|     -   - - ^  |
|#   -  -#    -  |
|#  -    #       |
|# -     #       |
|--   #  --v  #  |
|     #       #  |
|     #       #  |
|   3 --v  .---  |
|  3-            |
|3 - -           |
|-             3 |
| -   -    b   - |
|   -        -  -|
|             -  |
|                |
|                |
|                |
|     4          |
|    4           |
|   4            |
|  4    ^  ^     |
|--------  -     |
|                |
```

---

## Changes the remake needs

Compared with ORIGINAL-RULES.md and SPEC.md. Each item gives its status and the section above that
backs it.

### Towers
1. **Tower height:** the original towers are 47-96 step-rows tall: 47, 71, 49, 66, 96, 64, 80 and
   96 (§3, CONFIRMED). SPEC's 24-46 rows are about half that. The geometry can be rebuilt directly
   from Appendix A (16 columns, as now).
2. **Time limits:** use 100, 120, 140, 160, 180, 200, 220 and 240 (§8.1). This is CONFIRMED for the
   CPC-derived port and NES; for the 7800 it's UNCERTAIN, and only Tower 1's 100 is hinted. SPEC
   has 85-165. The 7800 HUD shows tenths, which matches SPEC's SSS:T.
3. **Doors:** always a pair, column c and column c+8, at the same row, 1 column wide and 3 rows
   high. Coming out over empty space drops you (§3, CONFIRMED). Tower 7 has **no** tunnel doors
   (§8.2, CONFIRMED).
4. **Edge of Doom summit:** doors at columns 9-12 above the summit ledge, with the exit at column
   10. That's the third door from the lift top at column 13. The decoys drop you 8-9 rows on the
   far side (§8.2, CONFIRMED). This matches ORIGINAL-RULES, and Appendix A gives the exact layout.
5. **Brick proportions:** ORIGINAL-RULES' "5 brick rows per floor" isn't a fixed rule. Ledges sit
   at any step-row; on the NES one brick row is one step-row and a door is 3 of them (§3).

### Movement
6. **Jump (replaces the UNVERIFIED placeholder):**
   - Sideways speed equals **walking speed** (not 2.6 columns/s).
   - Length **1.5 columns**; peak **2.25 rows** (SPEC: 1.15).
   - About 0.75 s at the 7800's 2.0 columns/s.
   - It can't be steered. If nothing is underneath at the end of the arc, Pogo drops straight
     down. You can't jump from a standstill.
   - Status: UNCERTAIN (port values, §2). Check against 7800 footage before treating them as final.
7. **Snowball:** about **3 columns** of range at 2× walking speed, one on screen at a time
   (UNCERTAIN, port plus "short-range" in S19, §2). Currently ~6 columns (ORIGINAL-RULES) and max 2
   on screen (SPEC).
8. **Stairs:** walking into a step does a small auto-hop. No source supports SPEC's "slinky" slide
   back down when you stop; drop it from Classic rules (§3, UNCERTAIN).
9. **Slippery ledges:** they act as **conveyors**: they push you in a fixed direction while you're
   standing still or shooting, and walking overrides them. The manual says they "push you left or
   right" (CONFIRMED, §3); the conveyor behaviour is from the port (UNCERTAIN). This replaces
   ORIGINAL-RULES' "slide in the direction of momentum".
10. **Crumbling ledges:** they vanish **as soon as you stand on them** and don't regrow during that
    attempt. You cross them by jumping (§3; the vanishing is CONFIRMED, instant and no-regrow are
    UNCERTAIN). Currently ~1 s (ORIGINAL-RULES) and 0.45 s with a 6 s regrow (SPEC).
11. **Lifts:**
    - 1 row per 8 ticks, i.e. 2 rows in one column's walking time.
    - Holding Up or Down carries you past middle stops.
    - An empty lift returns to its bottom stop after ~10 s.
    - Riding into a flashing block or ledge knocks you off.
    - Status: UNCERTAIN (port, §3).

### Getting hit, lives and time
12. **Getting hit:** a short hop up, then you fall **through** platforms for the rest of the tumble
    (net ~8 rows), then land: "land a few levels down" (CONFIRMED wording; port mechanics, §4).
    It's not just "fall straight down onto the first ledge below". A hit while riding a lift waits
    for a row boundary. SPEC's 1.2 s invulnerability has no source.
13. **Lives and time:** losing a life (sea or time-out) restarts the tower from the bottom with a
    fresh clock (CONFIRMED, §4). This matches the current Original mode.

### Enemies
14. **Molecule:** a **timed flyer that crosses the screen at Pogo's height** about every 10 s. It's
    immune to shots, knocks you off, and counts toward the 4-enemy cap (§6, CONFIRMED as a timed
    flyer; timings UNCERTAIN). This replaces ORIGINAL-RULES' "drifting diagonally or in circles
    across several tiers" and SPEC's "spawn after 8-12 s of lingering in one height zone".
15. **Patrollers (eyes, robots and the rest):** they move only straight up and down or round the
    tower, at slow or fast speed, and reverse on obstacles (§6, UNCERTAIN). No "wave loops". Their
    look changes per tower; their behaviour doesn't.
16. **Enemy cap and placement:** at most **4 enemies at once**. They're placed at fixed map spots,
    spawn as they scroll into view and despawn 12 rows below Pogo (§6, CONFIRMED).
17. **Rolling ball stun:** about 3 s, and a stunned ball still blocks you and knocks you off
    (CONFIRMED that you can't pass it; 3 s UNCERTAIN). SPEC is already right.

### Scoring
18. **Climbing:** keep the 7800 manual's 40 per new stair and 50 on boarding some lifts, but **add
    the lift ride-length bonus**. The manual says lift points "depend upon the length of the ride";
    ORIGINAL-RULES currently says height on a lift "pays nothing". The amount is unknown (§5).
19. **End of tower:**
    - Time: 10 per second left.
    - Technique: starts at 100, −2 per hit, ×10, none on Tower 1. This is CONFIRMED for C64/NES and
      UNCERTAIN for the 7800.
    - **Add an "Extras" tally:** +5 per ball and +2 per block shot, ×10, counted after Technique
      (CONFIRMED for C64, §5). SPEC doesn't have it.

### Sub stage
20. **Sub stage:** one stun bubble at a time; touch a stunned fish for 50; fixed-length stage
    (CONFIRMED for the 50; the rest UNCERTAIN, §7). SPEC's two-step catch is right.
