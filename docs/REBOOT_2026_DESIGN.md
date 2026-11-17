# TOWER TOPPLER '26 — 2026 REBOOT DESIGN DOCUMENT
**Project:** *Tower Toppler '26: Operation Nebulus*  
**Role:** 2026 Reboot Lead Design & Visual/Gameplay Specification  
**Target Platform:** Mobile-First Full-Bleed WebGL2 (Three.js r170 PBR + Selective Bloom) & Desktop Browser  

---

## 1. Executive Vision & Dual-Era Architecture

*Tower Toppler '26* delivers two distinct, selectable eras powered by one unified cylindrical 3D physics and progression engine:

1. **2026 Reboot Mode (`era: 'reboot'`, Default):** A moody, atmospheric, next-gen 3D reimagining (*Operation Nebulus*) directly anchored to the target visual reference frame—storm-lashed moonlit night skies, bioluminescent cyan/green fireflies, crashing white-foam dark ocean swells, wet dark-indigo/purple-slate masonry with moss and rusty iron pipes, carved stone corbel ledges, misty stone doorways, spark-showering side tunnels, warm golden-amber cage elevators, a hierarchical skeletal **Pogo** with explorer harness/backpack, weighty zero-floatiness physics, 8 distinct Story Campaign towers, 3 playable mini-games, Procedural Endless/Daily climbs, and Casual Zen Mode.
2. **Original Classic HD Mode (`era: 'original'`):** A faithful 2007–2010 XBLA/PSN HD Arcade tribute preserving the 8 classic Nebulus / Atari 7800 tower layouts, enemy rules, glossy vibrant arcade shaders, and punchy retro-synth audio (documented in `docs/ORIGINAL_DESIGN.md`).

---

## 2. Visual Target Specification (Reference Photo Breakdown)

Every camera angle, light source, material roughness value, prop silhouette, and HUD element in `era: 'reboot'` is engineered to match the target visual reference frame.

### 2.1 Full-Bleed Viewport & Framing
- **Zero Opaque Chrome Bars:** `#app` and `#stage-wrap` occupy `100vw × 100dvh` (`position: fixed; inset: 0; overflow: hidden`). The Three.js canvas renders edge-to-edge behind both the top HUD and bottom ghosted touch controls—no solid header or footer bars ever crop the stormy sky or crashing sea.
- **Hero Camera Composition:**
  - Perspective camera (`FOV = 42°`), positioned at `z = 9.4` (portrait adaptive clamp `<= 10.8`) with slight upward tilt so the massive stone cylinder fills ~52–58% of horizontal width on mobile portrait and ~34–40% on widescreen, leaving dramatic stormy ocean and moonlit clouds flanking both sides of the tower.
  - **Tone Mapping & Post-Processing:** `THREE.ACESFilmicToneMapping` (`toneMappingExposure = 1.24`), `PMREMGenerator` dark storm environment map for wet stone/iron specular reflections, plus `EffectComposer` + `UnrealBloomPass` (`threshold: 0.80, strength: 0.38, radius: 0.34`) so ONLY emissive sources (cage lift halo, fireflies, Eyeball cyan iris, Molecule magenta core, tunnel sparks, HUD glow) bloom without muddying the dark masonry.

### 2.2 Moonlit Stormy Night Sky & Drifting Fireflies
- **Night Sky Dome:** Deep midnight-slate vertical gradient (`#060a14` zenith → `#0e182b` mid-sky → `#132338` horizon), linear atmospheric fog (`new THREE.Fog('#0b1526', 20, 58)`) that preserves 100% foreground contrast on bricks and ledges.
- **Veiled Storm Moon (Upper-Right):** Pale silver-blue moon disc (`#e2eeff`, soft atmospheric corona `#6b8ab8`) positioned in the upper-right sky quadrant, partially veiled by 4–6 layered drifting dark storm-cloud planes (`#0a1222` core with `#3b5275` moonlit silver-blue rim edges).
- **3-Point Moonlit Lighting Rig:**
  - **Moon Key Light (`DirectionalLight`):** Cool silver-blue (`#cfe4ff`, intensity `1.85`) from upper-right `(7.5, 12.0, 8.5)` raking across wet stone bevels and corbels.
  - **Ocean Bounce Fill (`DirectionalLight`):** Cool seafoam-cyan (`#38bdf8`, intensity `0.68`) from lower-left `(-7.0, 2.5, 7.5)` lifting left-side brick shadows and wet moss.
  - **Storm Hemisphere (`HemisphereLight`):** Sky `#47648c` / Ground `#0b1926`, intensity `0.95`.
- **Drifting Cyan/Green Fireflies:** 80 instanced/point-sprite bioluminescent motes (`#5efce8` cyan-mint, `#42f5aa` emerald-green, `#7be8ff` ice-cyan) drifting lazily around the cylinder (`r = TOWER_RADIUS + 0.5..3.8`) on curl/dual-sine air currents with soft additive glow and individual phase pulsing.

### 2.3 Crashing White-Foam Dark Ocean Base
- **Dark Stormy Swells:** High-density annular/plane ocean mesh (`PlaneGeometry(64, 64, 96, 96)`) displaced each frame by 4-octave directional Gerstner/sine swells. Deep abyssal slate-teal material (`color: '#091926'`, crest tint `'#16354d'`, `roughness: 0.20`, `metalness: 0.38`) catching moonlit specular glints.
- **Crashing White-Foam Collar & Sea Spray:**
  - At the tower waterline (`y = waterFloor * FLOOR_HEIGHT`, default `-0.55`), a multi-layered turbulent **white sea-foam surge ring** (`#e8f6ff`, `#b2d8eb`) churns and scales rhythmically with wave crests.
  - Continuous **3D Sea-Spray Billow Emitters** around the visible front/left/right base hurl frothy white-cyan foam droplets and mist plumes (`1.0–1.8` floors high) up against the wet basal stonework.

### 2.4 Tower Masonry, Moss, Rusty Pipes & Architectural Props
- **Weathered Dark Indigo / Purple-Slate Stone Bricks:**
  - High-segment cylinder (`TOWER_RADIUS = 2.55`, 64 radial segments) wrapped in a procedural `1024×1024` PBR stone texture set (`map`, `bumpMap`, `roughnessMap`, `emissiveMap`) PLUS physical 3D relief courses and buttresses.
  - **Palette (Base Archetype):** Deep indigo-slate stone blocks (`#232442`, `#2e3158`, `#393c6b`), dark recessed mortar (`#0d0e1d`), chipped bevel highlights (`#5c6594`), and wet-stone `roughness` variation (`0.32` damp streaks to `0.82` rough slate).
- **Lush Moss Patches:** Organic dark-olive and forest-emerald moss clusters (`#264524`, `#3b6632`, `#4f8240`) baked into mortar seams AND placed as low-poly 3D mossy tufts along ledge corners, stair joints, and damp pipe brackets.
- **Rusty Iron Pipes, Flanges & Rivets:** Physical 3D cylindrical iron conduits (`#282b36`, weathered rust `#5e3a27`, specular steel rivets `#737d91`) bolted vertically and horizontally onto the masonry with flanged couplings, elbow bends, wall clamps, and subtle steam wisps.
- **Carved Stone Corbel Ledges & Stepped Runs:**
  - Every `solid` ledge is a thick, beveled grey-slate stone slab (`#4b5366` body, `#6d7991` moonlit wet top cap, `#252a38` shadow underside) supported beneath by **two carved curved stone corbel brackets** anchored into the tower wall, accented with moss patches.
  - Adjacent diagonal (+1 floor) runs automatically include **chiseled stone stair riser steps** bridging the cylinder arc—matching the stepped stone foreground walk in the reference frame!
  - **Special Ledge Visuals in Reboot Mode:**
    - `crumble`: Pre-cracked 3-stone slab with glowing ember-amber stress veins (`#f59e0b` → `#ef4444`), trembling and shedding stone grit before collapsing.
    - `ice`: Frosted translucent glacier-slate (`#93c5fd`, top `#e0f2fe`, `roughness: 0.08`) with sharp 3D icicles hanging from the corbels.
    - `conveyorL` / `conveyorR`: Riveted dark-iron frame housing physical spinning brass/steel rollers and illuminated amber/cyan directional chevrons.
    - `box`: Iron-strapped stone/cryo barricade crate with glowing energy core seams that shatters into tumbling fragments when shot.
    - `laserGate` / `phaseBlock`: Brass-framed emitter nodes projecting crimson/cyan plasma beams or shimmering holographic stone slabs controlled by switches.
- **Misty Stone Doorways:**
  - Recessed rectangular doorway cut visually into the masonry (`#070a12` pitch-black interior) framed by thick chiseled grey-slate stone jambs and lintel (`#5d687e`, `#7b88a1`), with soft animated **volumetric mist/fog sprites** (`#cbd5e1` at `0.22` alpha) drifting out over the stone threshold.
  - **Summit Exit Doorway:** Crowned with an ornate golden-cyan keystone arch and upward light shaft.
- **Spark-Showering Arched Side Tunnels:**
  - Protruding barrel-vaulted stone-and-iron tunnel mouths mounted on shortcut/hazard ledges, lit inside by flickering warm orange arc-light (`#ff9e2c`) and intermittently **showering bright yellow-orange welding sparks** (`#ffb84d`, `#fff5cc`) that bounce off the wet stone slab!
- **Warm Golden-Amber Cage Elevators:**
  - Recessed vertical shaft channel in the tower wall.
  - **Twin Taut Vertical Steel Cables** (`#8d98a8`) extending from the cage roof all the way up to a recessed circular stone crown housing a **glowing warm golden-amber halo ring** (`#ffaa33` / `#ffd980`).
  - **Wrought-Iron & Brass Cage Car:** Open vertical-bar rectangular cage (`#7c5832` brass frame, dark iron baseplate, warm overhead ceiling lamp) with an attached `PointLight('#ffb84d', 1.85, 5.2)` casting warm golden-amber illumination across the surrounding indigo stonework and rising mist!

### 2.5 Reboot Monster Visuals
| Type | Name | 2026 Reboot 3D Model & Lighting Spec | Snowball Rule |
| :--- | :--- | :--- | :--- |
| `eye` | **Abyssal Tendril Eye** | Large wet bloodshot white eyeball (`#dce6ec` sclera with crimson capillary veins), intense glowing **ice-cyan iris** (`#4ff0ff`) + tracking black pupil locking onto Pogo, propelled by 5 writhing dark-crimson organic tendrils (`#7a1828`, `#b8283c`) gripping the stone; casts soft cyan light. | Immune (knockback spark + metallic-organic squelch) |
| `molecule` | **Mutant Crystal Molecule** | Floating cluster of 8–10 sharp, dark-violet/amethyst crystal polyhedra (`#3a145e`, `#6c24a8`, `#a84cff`) rotating around a blazing **white-magenta energy core** (`#ff99ff` / `#ffffff`) with purple point-light glow. | Immune (deflects cryo-bolt with crystal chime) |
| `roller` | **Riveted Furnace Sphere** | Heavy dark-iron riveted sphere (`#383e4c`) with glowing amber equatorial slit (`#f59e0b`) rolling physically along ledges. | **Destroyed** (`+100 × combo`, shatters in sparks) |
| `bouncer` | **Bio-Spore Hopper** | Squat biomechanical pod with glowing toxic-lime/amber sac (`#84cc16`) and iron claws that compresses deeply on stone impact. | **Stunned 3.0s** (`+50 × combo`, frozen in frost shell) |
| `robotH` / `robotV` | **Clockwork Sentinel** | Brass-and-iron automaton drone with sweeping crimson optical visor patrolling horizontal corridors or vertical shafts. | **Stunned 2.5s** (`+75 × combo`, short-circuits) |

### 2.6 Reference-Matched HUD & Ghosted Touch Controls
- **Top-Left (`PLAYER ONE` Cluster):**
  - Label: `PLAYER ONE` in crisp, wide-tracked geometric sci-fi font (`Orbitron`), glowing ice-cyan (`#7be8ff`).
  - Score: 8-digit zero-padded tabular readout (`00004520`) in bright crisp white (`#f8fafc`) with subtle dark drop-shadow for 100% legibility against clouds or stone.
  - Lives: Row of **Alien-Frog Head Silhouette SVG Icons** (`#6bf2ff` active glowing cyan-mint icons, dimmed `#4a759e` for the reserve/last slot, pulsing briefly on extra life).
- **Top-Center (`TIME` + Depleting Circular Ring):**
  - Left sub-stack: `TIME` label (`#f1f5f9`, `0.78rem`) above bold 3-digit integer readout (`092` in warm glowing yellow `#ffe44d`; pulses urgent coral-red `#fb7185` at `<= 15s`; shows `ZEN` infinity symbol in Casual Zen Mode).
  - Right companion: **Depleting Circular Ring Gauge** (`46×46px` SVG): crisp white outer ring + inner track + thick glowing warm-yellow arc (`#ffe44d`, `stroke-dasharray` depleted proportionally to `timer / timeLimit`).
- **Top-Right (Arcade Symmetry + Minimal Utility):**
  - Ghosted secondary readout (`HIGH SCORE` / `BEST` in translucent cool slate `rgba(205, 220, 240, 0.42)` with `00000000` tabular digits—honoring the exact `PLAYER TWO` ghosted visual balance from the reference screenshot!).
  - Tucked neatly beneath/beside in hairline ghosted glyphs (`opacity: 0.45`): Era badge (`'26` / `'87`), Control Mode quick-toggle, Audio, and Pause `(||)`.
- **Bottom Corners — Minimal Translucent Ghosted Touch Controls:**
  - **Strict Visual Rule:** NO opaque plastic arcade circles or heavy neon gradients during gameplay! All touch overlays use **1.5px hairline white/ice-cyan vector strokes** (`rgba(226, 242, 255, 0.24)` at rest → `rgba(123, 232, 255, 0.65)` while touched) with delicate corner framing ticks matching the reference screenshot:
    - `'gesture'` mode: Ultra-clean viewport—only tiny bottom-left `(||)` corner bracket and faint bottom-right target reticle ring (`opacity: 0.20`), plus subtle touch ripple where thumbs contact the glass.
    - `'joystick'` mode: Hairline circular ring + translucent floating puck on bottom-left; two hairline circular rings (`FIRE` dot & `JUMP` chevron) on bottom-right.
    - `'dpad'` mode: Hairline 4-dot/chevron directional reticle on bottom-left; two hairline action rings on bottom-right.
    - `'tilt'` mode: Delicate horizontal spirit-level tick bar at bottom-center + `[CALIBRATE]` micro-pill when paused, with ghosted action zones on left/right corners.

---

## 3. Next-Gen Skeletal Pogo (`src/pogo.js`) & 8 Unlockable Skins

### 3.1 Hierarchical 3D Bone Rig (`PogoRig`)
Instead of rigid primitive spheres, Pogo is a true hierarchical 3D character rig built from articulated `THREE.Group` bone joints and sculpted organic `LatheGeometry` / `CapsuleGeometry` / `SphereGeometry` meshes with PBR subsurface-style sheen:

```
root (world col/floor placement & cylinder tangent yaw)
 └── pelvis (COM bounce, crouch dip, hip roll/twist)
      ├── spine → chest (breathing scale, forward run lean, blaster twist)
      │    ├── harness & backpack (crossed leather chest straps, brass buckle, canvas explorer pack + glowing cryo-cell)
      │    ├── neck → head (smooth look-at tracking toward velocity, nearby doors, or close threats)
      │    │    ├── crest (amphibian cranial ridge fin)
      │    │    ├── browL & browR (expressive ridges: focused, startled, hurt)
      │    │    ├── eyeL & eyeR (large glossy obsidian-teal eyes + bright dual catchlights)
      │    │    ├── eyelidL & eyelidR (organic 140ms blink every 3.5–5.5s, squint on recoil/hurt)
      │    │    └── jaw (subtle mouth open on jump launch, hurt, and tower topple cheer)
      │    ├── shoulderL → upperArmL → forearmL → handL (3-fingered amphibian hand)
      │    └── shoulderR → upperArmR → forearmR → handR → blaster (compact brass/iron cryo-pistol + muzzleLight)
      ├── thighL → shinL → footL (digitigrade ankle + 3-toed webbed amphibian foot)
      └── thighR → shinR → footR (digitigrade ankle + 3-toed webbed amphibian foot)
```

### 3.2 Procedural Skeletal Animation States
- **Idle (`|vx| < 0.15`, `onGround`):** Subtle `1.8 Hz` chest breathing, relaxed 3/4 hero stance (matching the reference frame in front of the doorway!), gentle head scan, periodic natural blink.
- **Walk / Run (`|vx| >= 0.15`, `onGround`):** Snappy `10 Hz` stride cycle—alternating thigh/shin/webbed-foot swing with heel-to-web roll, pelvis vertical double-bounce, opposite shoulder/arm counter-swing, `12°` forward chest lean.
- **Jump Takeoff & Heavy Fall (`!onGround`):**
  - *Launch (`vy > 2.5`):* Explosive hip/knee extension, toes pointed downward, arms swept back, brow raised.
  - *Apex (`|vy| <= 2.5`):* Knees tucked cleanly forward so foot placement over target ledges is crystal-clear, arms out for balance.
  - *Heavy Descent (`vy < -2.5`):* Weighty braced landing posture—one leg extended slightly ahead to meet the stone, spine poised.
- **Crisp Landing Compression (`landImpact`):** `90ms` skeletal knee-bend (`pelvis.position.y -= 0.11`, `thigh` pitch, `shin` counter-pitch) with rapid critically-damped recovery—**zero wobbly rubber scaling!**
- **Additive Blaster Aim & Recoil (`muzzleFlash > 0`):** Right shoulder/arm snaps forward toward `facing`, blaster slide kicks back `-0.07` units, cyan-white muzzle flash illuminates Pogo's face and adjacent bricks.

### 3.3 The 8 Unlockable Pogo Skins
| # | `skinId` | Display Name | Visual Palette & Signature Details | Unlock Requirement |
| :- | :--- | :--- | :--- | :--- |
| 1 | `default_amphibian` | **Explorer Pogo** | Lime-emerald skin (`#56b847`), pale cream belly (`#d8e89b`), brown leather harness & canvas pack (Reference Hero). | Unlocked by Default |
| 2 | `deep_diver` | **Abyssal Diver** | Matte midnight-teal wetsuit skin (`#0f4c5c`), riveted brass MK.7 neck ring, glowing cyan bioluminescent stripes. | `75` Golden Gears |
| 3 | `poison_dart` | **Cobalt Dart** | Vivid cobalt-blue & velvet-black amphibian skin (`#1d4ed8`), fiery tangerine cranial crest (`#f97316`). | `120` Golden Gears |
| 4 | `clockwork_brass` | **Foundry Automaton** | Burnished brass & copper articulated plates (`#b45309`), glowing amber optical eyes, miniature steam-gauge pack. | Clear Reboot Tower 3 *or* `160` Gears |
| 5 | `frost_warden` | **Glacier Warden** | Translucent arctic-cyan skin (`#67e8f9`), snow-white frost crest, glowing crystalline cryo-pack. | Clear Reboot Tower 4 *or* `200` Gears |
| 6 | `shadow_infiltrator` | **Night Ops** | Stealth obsidian-indigo skin (`#1e1b4b`), tactical carbon harness, glowing emerald night-vision visor pips. | Crack 5 Core Lock Vaults *or* `250` Gears |
| 7 | `retro_1987` | **Classic '87 Tribute** | Bright arcade emerald (`#22c55e`), sunny yellow belly (`#fde047`), classic white-and-red blaster housing. | Clear any 4 Original Mode Towers |
| 8 | `golden_toppler` | **Sovereign Gold** | Brushed celestial gold skin (`#eab308`), royal amethyst crest (`#9333ea`), subtle drifting starlight motes. | Earn `18` Star Cores *or* `400` Gears |

---

## 4. Weighty Character Physics & Concise Touch Controls

### 4.1 Asymmetric Heavy Gravity (Zero Floatiness!)
Reboot Mode replaces floaty symmetric arcs with a tuned **3-phase asymmetric gravity curve** that feels substantial, athletic, and dead-accurate on mobile touchscreens:

| Parameter | Reboot Value | Engineering Purpose |
| :--- | :--- | :--- |
| `moveSpeed` | `4.5 cols/s` | Brisk, authoritative horizontal traversal around the 16-column cylinder. |
| `groundAccel` / `groundDecel` | `54` / `68 cols/s²` | Instant takeoff and **zero slippery overshoot** when stopping on 1-tile ledges (`ice` uses `11` / `4.5 cols/s²`). |
| `airAccel` | `38 cols/s²` | Responsive mid-air column correction without feeling weightless. |
| `jumpVy` | `9.5 floors/s` | Explosive upward launch impulse (`~1.85` floor apex in `0.39s`). |
| `gravityUp` (`vy > 1.1`) | `24.5 floors/s²` | Snappy, energetic climb to the jump apex. |
| `gravityJumpCut` (`vy > 1.8`, jump released) | `40.0 floors/s²` | Crisp short-hop control when tapping/light-flicking jump. |
| `gravityApex` (`|vy| <= 1.1`) | `18.5 floors/s²` | `~45ms` micro-clarity window right at the peak to line up ledges cleanly. |
| `gravityDown` (`vy < -1.1`) | **`37.0 floors/s²`** | **1.51× heavier descent!** Pogo drops with crisp, decisive stone weight—zero balloon floatiness. |
| `maxFallSpeed` | `15.0 floors/s` | Prevents tunneling through thin ledges while keeping tall drops thrilling. |
| `coyoteTime` / `jumpBuffer` | `0.11s` / `0.12s` | Forgiving late-ledge jumps and pre-landing jump flicks. |
| `ledgeMantleWindow` | `0.18 floors` | Smoothly clambers onto a ledge lip if Pogo brushes within `0.18` floors of the top face while moving toward it. |
| `autoStepUp` | `+1.0 floor` (`vy = 6.8`) | Classic Tower Toppler step-hop when walking directly into an adjacent +1 floor stone step (`dc <= 0.62`). |

*(Note: When `era === 'original'`, physics optionally use the classic symmetric arcade preset `jumpVy = 7.6, gravity = 16.5` so purists get authentic classic timing, while `era === 'reboot'` uses the weighty asymmetric curve above—both verified to clear identical `2.5`-column +1-floor gaps with generous margin!)*

### 4.2 The 4 Concise Touch Control Modes (`src/input.js`)
Players can switch between **4 first-class control schemes** at any time from the Title Card, Pause Menu, or HUD quick-pill:

#### Mode 1: Tuned Gesture (`'gesture'` — Mobile Default)
Engineered specifically to eliminate gesture collisions between walking, entering doors/riding lifts, jumping, and shooting:
1. **Horizontal Slide → Walk ONLY (`left` / `right`):**
   - Sliding thumb horizontally beyond `10px` from the dynamic anchor walks left or right continuously.
   - **Dynamic Re-Anchoring:** When the thumb reverses horizontal direction by `> 12px` after sliding, the horizontal anchor follows smoothly so changing direction is instantaneous without lifting your thumb!
2. **Deliberate Slide Up / Down → Doors & Lifts ONLY (`up` / `down` — NEVER JUMPS!):**
   - Sliding upward `dy <= -26px` at moderate/controlled speed (`upwardVelocity < 680 px/s` OR sustained hold `>= 105ms` without a fast flick peak) sets `state.up = true` (and triggers `justPressed.up` once).
   - **Strict Guarantee:** Slide-up **NEVER** triggers `jump`! Walking up to a misty stone doorway or standing on a cage elevator and sliding your thumb up cleanly enters the door or rides the lift upward with **zero accidental jumps**.
   - Sliding downward `dy >= 26px` sets `state.down = true` to ride elevators down (or dive in Sub-Hunter).
3. **Crisp Upward FLICK → Jump (`jump`):**
   - A rapid upward flick gesture—upward displacement `dy <= -20px` achieved within `<= 115ms` of upward motion onset AND peak upward pointer velocity `v_y <= -720 px/s` (`|v_y| > |v_x| * 0.85`)—fires `jump` (`justPressed.jump = true`, held for `160ms` or until finger release for full jump, cut shorter on quick flick release).
   - Works both from a standstill AND mid-walk (either by flicking upward at the end of a horizontal slide, or flicking with the second thumb while the left thumb continues sliding horizontally!).
4. **Quick TAP → Shoot (`fire`):**
   - Touch down + release within `<= 195ms` with total pointer displacement `<= 12px` fires `fire` (`justPressed.fire = true`) to shoot cryo-bolts/snowballs, toggle switches, or recall cage elevators.

#### Mode 2: Virtual Joystick + Ghosted Buttons (`'joystick'`)
- **Left Zone:** Floating-origin hairline circular joystick (`radius = 48px`). Horizontal deflection (`|analogX| > 0.18`) walks; vertical deflection (`analogY < -0.55` / `> 0.55`) operates doors & lifts ONLY (never jumps).
- **Right Zone:** Two ghosted hairline circular buttons—`FIRE` (lower-left arc) and `JUMP` (upper-right arc)—supporting multi-touch hold and slide-press.

#### Mode 3: Classic D-Pad + Ghosted Buttons (`'dpad'`)
- **Left Zone:** Anchored hairline 4-way D-Pad with pointer-captured slide-between-directions (`left`, `right`, `up` for doors/lifts, `down` for lifts/sub).
- **Right Zone:** Ghosted hairline `FIRE` and `JUMP` circular buttons.

#### Mode 4: Tilt / Motion Control (`'tilt'`)
- **Tilt Steering:** Reads `DeviceOrientationEvent` (`gamma` roll in portrait, orientation-compensated `beta` in landscape), requesting iOS permission cleanly via `requestTiltPermission()` when selected.
- **Calibration & Filtering:** Exponential moving average filter (`alpha = 0.28`), `±3.5°` neutral deadzone around `tiltNeutralGamma` (set via 1-tap **Calibrate Neutral** button), smooth ramp to 100% walk/skimmer speed at `±16°`.
- **Touch Actions in Tilt Mode:** Tap left half of screen = `FIRE`; tap/flick right half = `JUMP`; vertical slide anywhere = `UP`/`DOWN` (doors & lifts).

---

## 5. 2026 Story Campaign: *"Operation Nebulus"*

### 5.1 Narrative Premise
Centuries after the first Nebulus mission, eight dormant **Abyssal Terraform Monoliths** have ignited beneath a perpetual lunar super-storm, violently super-heating oceanic trenches and dragging the planet's crust underwater. Deployed from an orbital drop-pod in the **MK.7 Sub-Skimmer**, Amphibious Corps specialist **Pogo** must scale each monolith, bypass ancient security labyrinths, plant core charges at the summit portal, and topple all eight towers into the abyss before Planet Nebulus drowns.

### 5.2 The 8 Unique Reboot Towers
Every Reboot tower has a bespoke architectural variant, lighting mood, weather particle layer, and **signature gameplay mechanic**:

| ID | Tower Name | Floors / Time | Signature Visual & Weather Theme | Unique Gameplay Mechanic |
| :- | :--- | :-: | :--- | :--- |
| **1** | **Watchtower of the Mist** | `18F` / `95s` | **Reference Photo Archetype:** Wet dark indigo/purple-slate bricks, olive moss, rusty pipes, misty doorways, sparking arched side-tunnels, warm amber cage lifts, cyan/green fireflies. | **Foundation Mastery:** Classic cylindrical ascent introducing sparking shortcut tunnels, recallable amber cage lifts, hidden Vault Door, and Eyeball + Molecule patrols. |
| **2** | **The Sinking Reliquary** | `20F` / `90s` | **Flooded Trench Ruins:** Barnacle-crusted teal-indigo stone, gushing wall sluices, spinning amber flood-warning beacons, violent white sea spray. | **Rising Sea Level (`waterRiseRate: 0.18 floors/s`):** The ocean actively surges up the tower! Lower ledges submerge under crashing foam; shooting brass **Drain Valves** drops water by `1.6` floors to buy precious seconds. |
| **3** | **Foundry of Steam & Iron** | `20F` / `100s` | **Industrial Smelter:** Soot-blackened iron-plated stone, glowing orange furnace grates, heavy brass pipework, drifting ember ash & steam clouds. | **Rhythmic Steam Vents & Reversible Conveyors:** Pressurized pipe nozzles hiss for `1.0s` before erupting into vertical steam jets (launching or knocking Pogo); switches reverse conveyor belt flow! |
| **4** | **Gale-Force Boreal Spire** | `21F` / `105s` | **Arctic Storm Monolith:** Frosted blue-slate masonry, 3D hanging icicles, diagonal driving snow particles, pale aurora moon-glow. | **Blizzard Crosswinds (`windCycle`):** Every `6s`, howling gales sweep around the cylinder (`±1.4 cols/s` horizontal push). Pogo leans into the gale and uses stone windbreak pillars & tunnels as shelter! |
| **5** | **Labyrinth of the Prism Core** | `21F` / `110s` | **Arcane Crystalline Vault:** Deep violet-obsidian stone inlaid with glowing gold conduits, floating amethyst prisms, crimson & cyan plasma beams. | **Switch & Laser Puzzle Labyrinth:** Shooting or stepping on **Resonator Switches** toggles Red/Cyan **Laser Gates** and materializes **Phase Bridges**, creating multi-floor spatial routing puzzles. |
| **6** | **Tidal Piston Rig** | `22F` / `110s` | **Offshore Hydraulic Derrick:** Riveted gunmetal & mossy stone, giant brass hydraulic rams, swinging anchor chains, emerald sea-foam. | **Extending Hydraulic Pistons:** Timed mechanical corbel platforms slide in and out of the cylinder wall with audible pneumatic telegraphs, paired with fast dual-shaft cage elevators. |
| **7** | **Blackout Tempest Citadel** | `23F` / `115s` | **Thunderstorm Fortress:** Rain-lashed pitch-slate stone, heavy diagonal rain streaks, crackling crown Tesla coils. | **Storm Blackouts & Lightning Flashes:** Ambient moonlight dims periodically into moody silhouette twilight—Pogo's pack lantern, amber lifts, cyan Eyeballs, and purple Molecules glow vividly until **forked lightning** illuminates the whole tower! |
| **8** | **Apex of Nebulus** | `25F` / `125s` | **Eclipsed Core Monolith:** Obsidian-indigo & molten-gold stonework, swirling maelstrom whirlpool at the base, violet storm-moon corona. | **The Grand Convergence:** Combines a relentless **rising maelstrom tide (`0.15 floors/s`)**, **multi-switch laser vaults**, **blizzard upper battlements**, and **high-speed cage-lift relays** to the master reactor crown! |

---

## 6. Playable Mini-Games (3 Full 3D Mini-Games!)

To keep campaign pacing electric, inter-tower transitions alternate between **MK.7 Sub-Hunter** and **Hydro-Skimmer Run**, while hidden doors inside towers launch **Core Lock Vault**—and all 3 are directly playable from the **Arcade / Mini-Games** menu!

### 6.1 Mini-Game A: *MK.7 Sub-Hunter* (`mode: 'submarine'`)
- **When Played:** Transitions `T1→T2`, `T3→T4`, `T5→T6`, `T7→T8` (`16s` run) + Standalone Mode.
- **3D Scene:** Deep bioluminescent ocean trench, volumetric moonlight shafts piercing the dark water, swaying kelp silhouettes, brass-and-glass MK.7 Mini-Submarine with Pogo visible inside the dome and a volumetric cone headlight.
- **Gameplay:**
  - Steer in 2D trench plane; fire **Cryo-Stasis Bubbles** to encase glowing alien fish (`+250 × combo`) and Golden Gear pods, then pilot through bubbled targets to collect them.
  - **2026 Hazards & Secrets:** Chained **Abyssal Sea Mines** drift in the current (2 shots shatter them for `+150` + `1 Gear`; touching one shakes the hull and resets combo). Near the `11s` mark, a **Bioluminescent Upper Reef Cave** opens—threading through it awards `+5 Golden Gears` and starts the next tower with a **Cryo-Shield** (absorbs 1 hit)!

### 6.2 Mini-Game B: *Hydro-Skimmer Run* (`mode: 'skimmer'`)
- **When Played:** Transitions `T2→T3`, `T4→T5`, `T6→T7` (`18s` high-speed ocean sprint) + Standalone Mode.
- **3D Scene:** Dynamic chase-cam behind the MK.7 converted into a sleek **Hydro-Skimmer** carving across churning moonlit white-foam swells toward the silhouette of the next monolith on the horizon!
- **Gameplay:**
  - **Controls:** Smooth lateral carving (`left`/`right` or `analogX` across `-3.5..+3.5` wave corridor), **Wave-Hop (`jump`)** to leap low barriers and crest ramps, and **Plasma Pulse (`fire`)** to detonate wooden debris crates.
  - **Boost Gates & Slalom:** Carve cleanly through glowing **Cyan/Amber Boost Gates** to escalate speed & score multiplier (`1× → 2× → 3× → 4×`), launch off **Foam Wave Ramps** to grab airborne **Golden Gear arcs**, and dodge floating **Spiked Mines** & **Storm Rocks**!

### 6.3 Mini-Game C: *Core Lock Vault* (`mode: 'vault'`)
- **When Played:** Triggered mid-tower upon entering a hidden **Vault Door** (`door.isVault = true`, marked by a subtle golden-emerald runic lock & firefly cluster) + Standalone Practice Mode.
- **3D Scene:** Tight macro close-up inside an ancient stone-and-brass chamber focusing on **3 Concentric Counter-Rotating Brass & Amethyst Tumbler Rings** surrounding a levitating **Star Core**.
- **Gameplay:**
  - A glowing alignment beam sits at `12 o'clock`. Each ring rotates at an escalating speed (`ring 0: 1.6 rad/s`, `ring 1: -2.3 rad/s`, `ring 2: 3.1 rad/s`, with a `±22°` golden sweet-spot notch).
  - Press `FIRE` / `TAP` as the active ring's golden notch crosses the alignment beam!
  - **3 Strikes / `12.0s` Vault Timer:** Locking all 3 rings cracks open the vault in a shower of golden sparks, awarding the tower's **Vault Star Core**, **`+10` Golden Gears**, **`+1000` Bonus Points**, and returning Pogo safely to the vault doorway with `2.0s` invulnerability! (Failing 3 strikes ejects Pogo unharmed back onto the ledge so he can retry if time permits.)

---

## 7. Procedural Endless, Daily Seeded Tower & Casual Zen Mode

### 7.1 Deterministic `mulberry32` PRNG & Chunk Architecture
All procedural generation in `src/levels.js` uses a pure, zero-dependency `mulberry32(seed)` 32-bit PRNG:
- **Daily Seeded Tower (`runType: 'daily'`):** Seed is derived from the UTC date (`YYYYMMDD`, e.g., `20261116`). Every player around the globe climbs the exact same 20-floor tower, competing for best score and fastest clear time!
- **Procedural Endless Abyss (`runType: 'endless'`):** Starts at `Sector 1` (`16` floors) and scales smoothly (`floors = min(30, 16 + depth * 2)`), introducing rising tides, wind gusts, switches, and denser enemy patrols as depth increases, interleaved with Sub-Hunter and Hydro-Skimmer bonus runs.

### 7.2 Verified-Solvable Chunk Generator (`verifyTowerSolvable`)
Rather than scattering random ledges that might produce impossible jumps, the generator assembles towers from **8 Parameterized 3-to-4-Floor Architectural Chunks**:
1. `SpiralCorbelRun` (stepped stone climb + roller patrol)
2. `CrumbleGapCrossing` (2-col jump over crumbling slate + safe bypass)
3. `CageLiftShaft` (amber cage elevator spanning 3–4 floors + guarding Eyeball)
4. `SparkTunnelShortcut` (main switchback vs sparking side-tunnel warp)
5. `SwitchLaserPuzzle` (shootable resonator switch unlocking a laser-gated upper ledge)
6. `ConveyorMomentum` (directional conveyor run into a timed jump)
7. `GlacierWindShelf` (icy corbel shelf with windbreak pillar)
8. `SecretVaultBranch` (optional side challenge leading to a Vault Door or Star Core)

**Guaranteed Solvability Pass:** Every generated `TowerDefinition` runs through `verifyTowerSolvable(tower)`—a deterministic state-space BFS over `(ledgeIndex, switchBitmask)` edges validated against Pogo's conservative movement envelope (`dh <= 1.65` floors at `dc <= 2.35` cols, elevator spans, bidirectional doors, and destructible boxes). If a random seed produces a blocked transition, the generator repairs the gap with a stepping corbel ledge before returning—**guaranteeing 100.0% solvability on every Endless and Daily tower**.

### 7.3 Casual Zen Mode (`zenMode: true`)
Designed for players who want to soak in the moonlit ocean atmosphere and tactile climbing without time pressure:
- **No Countdown Death:** The top-center circular gauge becomes a calm cyan ambient halo tracking elapsed climb time without expiring.
- **Buoyant Rescue Sea & Infinite Lives:** Falling into the stormy ocean (or touching rising water in Tower 2/8) gently buoys Pogo upward inside a glowing stasis bubble back onto `safeCol / safeFloor` with zero Game Over!
- **Soothing Storm Soundscape:** Softens enemy knockback (`50%` shorter stun, zero life loss) and emphasizes rain, distant surf, and warm ambient synth pads.

---

## 8. Collectibles, Star Cores & 16 Trophies (`src/progression.js`)

### 8.1 Collectibles
- **3 Star Cores per Campaign Tower (`24` Reboot + `24` Original):**
  1. **Summit Core (`clear`):** Topple the tower.
  2. **Explorer / Vault Core (`vault`):** Crack the tower's hidden **Core Lock Vault** (or collect the floating Star Core in Original Mode).
  3. **Chrono Core (`speed`):** Topple the tower with `>= parTime` seconds remaining on the timer.
- **Golden Gears (`gears`):** Gleaming brass-and-cyan cogs placed along daring side ledges (`+1` Gear each), inside Sub-Hunter/Hydro-Skimmer bonus runs, and awarded on tower clears (`+5` first clear, `+3` repeat). Spent in the **Wardrobe** to unlock Pogo Skins!

### 8.2 The 16 Trophies
| # | `id` | Trophy Title | Unlock Condition |
| :- | :--- | :--- | :--- |
| 1 | `first_topple` | **Monolith Breaker** | Topple your first tower in any mode. |
| 2 | `mist_walker` | **Watchtower Cleared** | Complete Reboot Tower 1 (*Watchtower of the Mist*). |
| 3 | `tide_runner` | **Outrun the Abyss** | Clear *The Sinking Reliquary* (Reboot T2) without touching the rising sea. |
| 4 | `vault_cracker` | **Master Locksmith** | Crack open a *Core Lock Vault* with zero missed strikes. |
| 5 | `sub_ace` | **Abyssal Angler** | Catch 10+ bioluminescent fish in a single *MK.7 Sub-Hunter* stage. |
| 6 | `warp_finder` | **Trench Secret** | Discover the secret bioluminescent Warp Cave in *MK.7 Sub-Hunter*. |
| 7 | `skimmer_pro` | **Wave Carver** | Reach a `4×` Boost Gate multiplier in *Hydro-Skimmer Run*. |
| 8 | `snowball_sniper` | **Cryo Sharpshooter** | Achieve a `4×` snowball hit combo inside a tower. |
| 9 | `switch_architect` | **Prism Tactician** | Clear *Labyrinth of the Prism Core* (Reboot T5) collecting its Vault Core. |
| 10 | `storm_ghost` | **Untouchable Operative** | Clear any tower without taking a single enemy hit (`hurtCount === 0`). |
| 11 | `speed_demon` | **Chrono Blitz** | Earn the Speed Star Core (`timer >= parTime`) on 3 different towers. |
| 12 | `daily_climber` | **Daily Vanguard** | Complete a *Daily Seeded Tower* challenge. |
| 13 | `endless_5` | **Deep Horizon** | Topple 5 consecutive towers in a single *Endless Abyss* run. |
| 14 | `classic_hero` | **1987 Purist** | Clear all 8 towers in *Original Mode*. |
| 15 | `operation_nebulus` | **Savior of Nebulus** | Clear all 8 Story Towers in *2026 Reboot Mode*. |
| 16 | `nebulus_legend` | **Grand Toppler '26** | Collect at least `24` Star Cores and unlock `6` Pogo Skins. |
