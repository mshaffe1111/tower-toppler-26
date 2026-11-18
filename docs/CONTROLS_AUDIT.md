# Towering Waters: Gateway's Descent — Mobile Touch, Gamepad & Android Ergonomics Specification

**Scope:** `60Hz` (`dt = 16.667ms`) multi-touch, gesture, virtual joystick, classic D-pad, device-tilt, keyboard, and Android Hardware Back-button ergonomics across [src/input.js](../src/input.js), [src/game.js](../src/game.js), [src/main.js](../src/main.js), [index.html](../index.html), and [styles.css](../styles.css).

---

## 1. Verified Android, Tablet & Desktop Viewport Matrix

| Device Profile | CSS Viewport | DPR | Primary Input Layout |
| :--- | :---: | :-: | :--- |
| **Compact Android Portrait** | `360×800` | `2x–3x` | Left navigation zone + right arc (`#btn-fire` Hydro-Pulse, `#btn-whip` Tail-Whip, `#btn-jump`) |
| **Google Play Pixel Portrait** | `412×915` | `2.6x` | Safe-area inset HUD + translucent hydro-glass touch controls (`0` HUD overlap) |
| **Ultra-Wide Android Landscape** | `915×412` | `2.6x` | Split thumb zones flanking full-bleed sunlit 3D watershed vista |
| **Tablet / Foldable** | `1024×768` | `2x` | Expanded touch targets (`60–70px`) + full keyboard support |
| **Desktop / Chromebook** | `1920×1080` | `1x–2x` | Keyboard (`WASD` / Arrows, `Space` Jump, `J`/`F` Hydro-Pulse, `K`/`E` Tail-Whip, `Esc` Pause) |

---

## 2. Four Selectable Touch Control Schemes (`CONTROL_MODES`)

1. **`'gesture'` (Fluid Thumb-Slide & Flick):**
   - Horizontal slide (`|dx| > 10px`) drives proportional cylindrical running around the `COLS = 20` spire with instant direction-reversal re-anchoring.
   - Controlled upward/downward slide enters Sanctum doorways, rides mechanical elevators, or climbs **Gecko Wall-Scamper Strips** (`0%` false jump misfires).
   - Crisp upward/diagonal thumb flick triggers Gateway's 2-tier athletic leap (`185ms` standard / `245ms` power arc).
   - Quick tap fires **Hydro-Pulse** (`#btn-fire`), with dedicated `#btn-whip` for **360° Lizard Tail-Whip** and `#btn-jump` for direct thumb jumping.
2. **`'joystick'` (Floating / Anchored Analog Ring):**
   - Smooth analog horizontal speed modulation and vertical stair/elevator/wall-scamper intent paired with right-hand `#btn-fire`, `#btn-whip`, and `#btn-jump` buttons.
3. **`'dpad'` (Tactile Cardinal Pad):**
   - Diagonal-chatter-resistant 4-way directional pad with outer-halo hit forgiveness and smooth rollover between `#btn-fire`, `#btn-whip`, and `#btn-jump`.
4. **`'tilt'` (Calibrated Accelerometer Roll):**
   - Neutral-calibrated device roll angle (`0.5×–2.0×` sensitivity) with touch doorway/lift swipes and right-hand action buttons.

---

## 3. Traversal Forgiveness & Mini-Game Input Guarantees

- **Walkable 5-Riser Staircases:** Gateway runs fluidly up and down contiguous staircases without requiring jump button presses on each floor rise.
- **Athletic Forgiveness Window:** `185ms` coyote time, `150ms` pre-touchdown jump buffer, `0.42`-floor ledge-lip mantle, and Smart Descending Island Brake (`0%` cliff-skid on isolated terraces).
- **5 Signature Mini-Games:**
  - **`core_descent`:** Smooth 360° dive steering + `#btn-whip` crystal-lock shatter.
  - **`reef_swim`:** Buoyant 2D underwater lizard propulsion + Hydro-Pulse cage release.
  - **`rapids_surf`:** Snappy lateral hydro-wake carving + upward wave-hop + Tail-Whip.
  - **`frill_glide`:** Buffered frill-flare climb/dive pitch control through canyon updrafts.
  - **`aqueduct_sanctum`:** 1-swipe = 1-step precision valve routing and rotary prism alignment.
- **Android Hardware Back Navigation:** `popstate` + Capacitor `backButton` listener cleanly closes sub-modals or pauses active spire/mini-game runs without abrupt app exit.
