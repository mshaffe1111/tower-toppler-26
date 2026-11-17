# TOWER TOPPLER '26 — MOBILE TOUCH & CONTROLS FEEL AUDIT (`60Hz` CHROMIUM TELEMETRY)

**Author:** Mobile Touch & Controls Feel Engineer (`controls_playtest`)  
**Scope:** Live `60Hz` (`dt = 16.6667ms`) Headless Chromium CDP multi-touch + frame-accurate physics playtest across `src/input.js`, `src/game.js`, `index.html`, and `styles.css` (`390×844 @ 2x DPR`, 32 messy real-world mobile player gestures across all 4 control schemes & all 5 mini-games).  
**Final Verdict:** **`[CONTROLS 10/10]` — `32 / 32` (`100.0%`) PASS** (`0` uncaught page errors, `0` CDP multi-touch errors).

---

## 1. Executive Summary & Test Methodology

To evaluate touch feel under authentic human thumb mechanics rather than synthetic 2-point unit jumps, we ran a two-layer **60Hz Headless Chromium CDP + Physics Simulation Harness** against `http://127.0.0.1:8126/` (`Emulation.setDeviceMetricsOverride(390×844 @ 2x DPR, mobile: true)` + `Emulation.setTouchEmulationEnabled(maxTouchPoints: 5)`):
1. **Layer A — Native Chromium DevTools Multi-Touch (`Input.dispatchTouchEvent`)**: Dispatches simultaneous multi-finger `touchStart` / `touchMove` / `touchEnd` frames (`touchPoints: [{id: 0}, {id: 1}]`) against the live DOM to verify CSS `touch-action: none`, `elementFromPoint` hit-testing, pointer capture, and zero uncaught runtime exceptions (`nativeCdpMultiTouchErrors = []`).
2. **Layer B — Deterministic `60Hz` (`16.6667ms`) Stepped Gesture + `TowerTopplerGame` Physics Suite (`G01–G32`)**: Feeds 32 noisy human trajectories (cosine ease-in-out doorway slides, `±2.4px` capacitive digitizer quantization jitter, `±18°` anatomical thumb pivot arcs, `6–14px` capacitive finger-peel rolls, ballistic mid-run flick releases, consecutive hurdles without lifting thumb, and 2- & 3-finger multi-touch combinations) into `InputController` + `TowerTopplerGame` across all 4 control modes (`gesture`, `joystick`, `dpad`, `tilt`) and all 5 mini-games (`submarine`, `skimmer`, `glide`, `puzzle`, `vault`).

- **Round 1 Baseline (`21 / 32` Passed, `11` Defects Isolated)**: Uncovered 9 root-cause defects across `src/input.js` (`#156` items 1–8) and `src/game.js` (`#156` item 9).
- **Round 2 Verification (`32 / 32` Passed — `100.0%`)**: Following `@gameplay` (`#158`) and `@controls` (`#164`), all 32 real-world 60Hz scenarios pass with zero false triggers, zero pointer-stealing, and zero dropped edges.

---

## 2. Round-1 vs. Round-2 `60Hz` Chromium Telemetry (`32 / 32` Verified)

| ID | Category | Real-World 60Hz Mobile Gesture Scenario | R1 | R2 | Round-2 Verified `60Hz` Telemetry |
| :- | :--- | :--- | :-: | :-: | :--- |
| `G01` | 1. Running Flick | `50px` slide right (`200ms`) $\rightarrow$ diagonal flick (`dx=+25, dy=-35` in `80ms`) held across 2-col gap + edge doorway | FAIL | **PASS** | `jumped=true`, `upMisfired=false`, `doorMisfired=false`, `minVx=4.35`, `maxFloor=5.74` (`+1.74F`), `endCol=5.31` |
| `G02` | 1. Running Flick | Ballistic running diagonal flick (`dx=+25, dy=-35` in `80ms`) + **natural thumb lift at peak** | FAIL | **PASS** | `jumped=true`, `upMisfired=false`, **`horizSpan=2.38` cols** (`>=2.35c` contract; up from `0.23c`!), `maxFloor=5.74` |
| `G03` | 1. Running Flick | Pre-drifted walk (`-7.5px` upward drift over `220ms`) $\rightarrow$ diagonal flick (`dx=+25, dy=-35` in `80ms`) | PASS | **PASS** | `jumped=true`, `upMisfired=false`, `doorsUsed=0`, `vy=8.68` |
| `G04` | 1. Running Flick | Leftward sprint shallow `42°` diagonal flick (`dx=-32, dy=-29` in `67ms`) | PASS | **PASS** | `jumped=true`, `upMisfired=false`, `vx=-4.42`, `vy=9.09` |
| `G05` | 1. Running Flick | Double consecutive mid-run gap flicks without lifting or pulling thumb down `16px` | FAIL | **PASS** | **`jumpCount=2/2`**, `upMisfired=false`, `endCol=5.25` |
| `G06` | 1. Running Flick | Standstill crisp `80ms` upward flick (`dx=+4, dy=-35` in `80ms`) in front of doorway | FAIL | **PASS** | **`jumped=true`, `upMisfired=false`, `doorsUsed=0`** (was `doorsUsed=1` misfire in R1) |
| `G07` | 2. Slow Slide | Canonical slow upward slide (`dy=-35px` over `220ms`) at doorway | PASS | **PASS** | `upTriggered=true`, `jumpMisfired=false`, `doorsUsed=1` |
| `G08` | 2. Slow Slide | Slow upward slide (`220ms`) with `±2.4px` capacitive digitizer quantization jitter | FAIL | **PASS** | **`upTriggered=true`, `jumpMisfired=false`, `doorsUsed=1`** (`anchorY` immune to stationary X-jitter) |
| `G09` | 2. Slow Slide | Slow upward slide (`dy=-36px` over `220ms`) on Original multi-stop elevator | PASS | **PASS** | `upTriggered=true`, `jumpMisfired=false`, `liftFloor=4.63`, `onElevator=true` |
| `G10` | 2. Slow Slide | Hesitant two-stage upward slide (`-15px` $\rightarrow$ `115ms` pause $\rightarrow$ `-20px`) at doorway | PASS | **PASS** | `upTriggered=true`, `jumpMisfired=false`, `doorsUsed=1` |
| `G11` | 2. Slow Slide | Slow `60Hz` downward slide (`dy=+35px` over `220ms`, `+2.5px/frame`) on elevator | FAIL | **PASS** | **`downTriggered=true`, `jumpMisfired=false`, `liftFloor=7.63`** |
| `G12` | 2. Slow Slide | Continuous upward slide (`-35px`) then downward reversal (`+52px`) | PASS | **PASS** | `sawUp=true`, `sawDown=true`, `jumpMisfired=false` |
| `G13` | 3. Thumb Arc | Rightward walk at `-18°` upward arc (`dx=+95.1, dy=-30.9`) past doorway | PASS | **PASS** | `droppedWalkFrames=0`, `upOrDown=false`, `jumpMisfired=false`, `doorsUsed=0` |
| `G14` | 3. Thumb Arc | Rightward walk at `+18°` downward arc (`dx=+95.1, dy=+30.9`) | PASS | **PASS** | `droppedWalkFrames=0`, `upOrDown=false` |
| `G15` | 3. Thumb Arc | Leftward walk at `-18°` upward arc (`dx=-95.1, dy=-30.9`) | PASS | **PASS** | `droppedWalkFrames=0`, `upOrDown=false`, `jumpMisfired=false` |
| `G16` | 3. Thumb Arc | Serpentine `R -> L -> R` dynamic re-anchor reversals under `±18°` arc drift | PASS | **PASS** | `sawRight1=true`, `sawLeftRev=true`, `sawRight2=true`, `upOrDown=false` |
| `G17` | 3. Thumb Arc | Virtual Joystick extended `90px` drag at `-18°` outside `45px` ring | FAIL | **PASS** | **`rightHeld=true`, `upOrDown=false`, `doorsUsed=0`** (radially clamped `nx, ny` + hysteresis) |
| `G18` | 3. Thumb Arc | Classic D-Pad right hold with `43°–47°` diagonal thumb-roll jitter | FAIL | **PASS** | **`droppedRight=false`, `upChatter=false`, `doorsUsed=0`** (`1.30x` diagonal hysteresis) |
| `G19` | 4. Tap Wobble | `6.0px` capacitive finger roll during `120ms` tap | PASS | **PASS** | `shots=1`, `dir=+1` |
| `G20` | 4. Tap Wobble | `10.0px` diagonal roll during `120ms` tap | PASS | **PASS** | `shots=1`, `dir=+1`, `facing=+1` |
| `G21` | 4. Tap Wobble | `13.8px` backward thumb-peel roll (`dx=-13.5`) during `120ms` tap while facing Right | FAIL | **PASS** | **`shots=1`, `shotDir=+1`, `facing=+1`** (`15px` deadzone blocks backward facing flip) |
| `G22` | 4. Tap Wobble | `14.0px` upward finger-roll tap (`120ms`, `dx=+4, dy=-13.4`) at doorway | PASS | **PASS** | `shots=1`, `jumpedOrUp=false`, `doorsUsed=0` |
| `G23` | 4. Tap Wobble | Rapid triple-tap burst (`3× 90ms` taps, `13.5px` wobble, `83ms` gap) | PASS | **PASS** | `fireEdges=3` |
| `G24` | 4. Tap Wobble | Tilt mode left-half (`fire`) & right-half (`jump`) `14.0px` wobble taps | PASS | **PASS** | `firedLeft=true`, `jumpedRight=true`, `vy=9.09` |
| `G25` | 5. Multi-Touch | Gesture 2-thumb: Left thumb walking right + Right thumb `-15px` wobble tap | PASS | **PASS** | `shots=1`, `shotDir=+1`, `flippedLeft=false`, `stillWalkingRight=true` |
| `G26` | 5. Multi-Touch | Gesture 2-thumb: Left walk + Right `#btn-fire` slide-rollover onto `#btn-jump` | PASS | **PASS** | `shotFired=true`, `jumped=true`, `keptRight=true`, `vy=9.09` |
| `G27` | 5. Multi-Touch | Gesture 2-thumb: Left holding walk left + Right upward flick on canvas | PASS | **PASS** | `jumped=true`, `upMisfired=false`, `keptLeft=true`, `vx=-3.81` |
| `G28` | 5. Multi-Touch | Joystick 2-thumb: Left `#joystick-zone` + Right canvas tap, `#btn-fire`, & `#btn-jump` | PASS | **PASS** | `canvasTapFired=true`, `btnFired=true`, `btnJumped=true`, `droppedWalk=false` |
| `G29` | 5. Multi-Touch | Joystick anti-steal: active left stick ignores stray second left-half touch | PASS | **PASS** | `puckActiveAfter=true`, zero puck/axis theft |
| `G30` | 5. Multi-Touch | D-Pad 2-thumb: outer-halo engage, `L->R` slide, `#btn-jump` `7px` halo, open-canvas fire | FAIL | **PASS** | **`haloLeftWorked=true`, `slidToRight=true`, `haloJumpWorked=true`, `openRightFired=true`, `stillRight=true`** |
| `G31` | 5. Multi-Touch | Tilt mode: `+12°` roll + `140ms`-rested thumb upward flick + simultaneous left-half tap | FAIL | **PASS** | **`tiltWalkingRight=true`, `jumped=true`, `upMisfired=false`, `fired=true`, `tiltPreserved=true`** |
| `G32` | 5. Multi-Touch | All 5 mini-games (`Submarine`, `Skimmer`, `Glide`, `Rune Chamber`, `Vault`) at `60Hz` | PASS | **PASS** | `subTorpedo=true`, `subSonar=true`, `skimmerOk=true`, `glideOk=true`, `puzzleStepped=true`, `vaultLocked=true` |

---

## 3. Summary of Verified Fixes Applied (`#156` $\rightarrow$ `#158` & `#164`)

1. **Stationary `#dpad` & `#joystick-zone` `pointerdown` Aggregation (`src/input.js`)**: `_recomputeState()` now executes *after* `_activePointers.set(e.pointerId, entry)` across all anchored and halo branches, and `#btn-jump` / `#btn-fire` press & slide-rollover explicitly emit `justPressed[action] = true`.
2. **Full-Apex Flick Hold (`290ms` / `315ms`) + `260ms` Ballistic Horizontal Carry (`src/input.js` + `src/game.js`)**: Running diagonal upward flicks achieve `+1.74F` jump apex (`>= 1.65F` `verifyTowerSolvable` envelope) and `2.38`-col ballistic chasm reach even when the player lifts their thumb at the `80ms` peak (`!p.onGround` neutral coast `rate = 5.5` vs active air-steer `38`).
3. **Consecutive Mid-Run Hurdle Re-Arm (`src/input.js`)**: `flickLatched` re-arms either on `>= 14px` downward return OR after `150ms` of horizontal continuation (`dyStep >= -0.8`).
4. **Standstill `80ms` Flick vs. `220ms` Doorway Slide Separation (`src/input.js`)**: `GESTURE_FLICK_VELOCITY_Y = -340 px/s`, `GESTURE_SLIDE_UP_MAX_SPEED = 290 px/s`, and `GESTURE_SLIDE_UP_HOLD_MS = 135ms` cleanly separate `80ms` `-35px` jumps (`-437 px/s`) from `220ms` `-35px` doorway/lift slides (`-159 px/s`).
5. **Digitizer X-Jitter Guard & `60Hz` Downward Slide Accumulation (`src/input.js`)**: `isShallowHorizDrift` is gated on committed horizontal walk travel (`|dx| > 15px`), and `anchorY` no longer chases downward steps below `startY`.
6. **Capacitive Tap Finger-Peel Facing Protection (`src/input.js`)**: `GESTURE_HORIZ_DEADZONE_PX = 15` (`22px` for secondary pointers while a primary walk pointer is active) prevents `6–14px` backward finger-peel tap wobble from flipping `p.facing` before `pointerup` fires.
7. **Radially Clamped Virtual Joystick & D-Pad Diagonal Hysteresis (`src/input.js`)**: Joystick normalizes `(px/maxR, py/maxR)` on the clamped circle with `-0.56 / -0.42` hysteresis + vertical dominance; D-Pad applies `1.30×` horizontal / `1.18×` vertical diagonal hysteresis.
8. **Tilt / RightPad Rested-Thumb Flick Parity (`src/input.js`)**: `_updateTiltTouchPointer` refreshes `upOnsetY` / `upOnsetTime` after pauses/downward motion and shares the `-340 px/s` flick velocity & `315ms` full-apex pulse.
