# Tower Toppler '26

A **2026 mobile-first reimagining** of the classic Atari 7800 game **Tower Toppler** (*Nebulus*, Hewson 1987).

Guide Pogo up 8 rotating towers rising out of the sea, reach the door at the top of each one to topple it, then catch fish in the MK.7 mini-submarine bonus stage.

## Classic rules, faithfully kept
- **Hit by a nasty → knocked down to the ledge below.** No ledge below? Into the sea, and you lose a life.
- **Bouncing balls & flying molecules** pop with a snowball. **Silver rolling balls** can only be frozen for a few seconds. **Floating eyes** can't be hurt at all; jump over them.
- **Flying nasties** come around the tower at Pogo's height. A red **!** at the screen edge warns you which side they're coming from.
- Ground enemies **patrol along their ledges** and turn back at edges; if their ledge crumbles, they fall into the sea.
- Crumbling, slippery (ice), conveyor and shootable-block ledges; lifts (fire to call one); tunnels through to the far side of the tower; a time limit on every tower.
- Points for every new floor climbed, enemy combos, a time bonus for toppling the tower, and an extra life every 5,000 points.

## Controls
| | Touch | Keyboard | Gamepad |
|---|---|---|---|
| Walk | Floating analog **thumbstick** (right side; swap in Pause menu) | ← → / A D | Left stick / D-pad |
| Doors & lifts | Push stick ▲ / ▼ | ↑ ↓ / W S | Stick / D-pad |
| Jump | **JUMP** | Space / Z / K | A / B |
| Fire / call lift | **FIRE** (hold for auto-fire) | X / J / Enter | X / Y / RB / RT |
| Pause | ⏸ | P / Esc | Start |

The thumbstick gives proportional speed: a light push walks slowly, a full push walks at full speed. Modern assists: coyote time, jump buffering, automatic step-up onto the next stair, a ledge-mantle grab, and an edge guard so you can't walk off a ledge into the sea by accident (jumps and slippery ledges are still risky).

## Look
Three.js WebGL renderer with curved stone walkways that hug the tower, real-time soft shadows, a procedural nebula sky dome, a GPU-animated ocean with a foam collar and sun glints, per-tower biome palettes, chrome reflections, glowing particles, and a cinematic vignette.

## Running
Static files, no build step: serve the folder (for example `python3 -m http.server`) and open `index.html`. Three.js loads from the jsDelivr CDN.
