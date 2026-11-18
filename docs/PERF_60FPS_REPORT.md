# Towering Waters: Gateway's Descent — Mobile 60fps WebGL2 GPU, Shadow & Memory Budget Specification

**Target Hardware:** Google Play Android Phones (`412×915` Portrait, `915×412` Landscape), Tablets (`1024×768`), and Desktop (`1920×1080`)  
**Graphics Pipeline:** Three.js `r170` WebGL 2.0 · `2048×2048` `PCFSoftShadowMap` · Sky-Tinted `PMREM` IBL · ACES Filmic `CinematicPostFX`  
**Strict Frame Budgets:** `<= 160` Draw Calls / Frame · `<= 120,000` Triangles / Frame · `0` Per-Frame GC Allocations · `0` VRAM Geometry/Texture Leaks · `< 75 MB` Total APK Bundle

---

## 1. Multi-Pass AAA Daylight & Biome Rendering Architecture

1. **Planar / Fresnel Biome Water Pass (`src/water.js`):**
   - Biome-tuned living water shaders across `canyon_river` (directional whitewater rapids + boulder wakes), `alpine_lake` (crisp snow-peak mirror reflections), `mist_bayou` (calm jade-amber channels), `coral_sea` (translucent turquoise lagoon revealing underwater coral shelves & gliding manta rays), and `storm_ocean` (polar maelstrom swells), plus live `purificationProgress` (`0..1`) water-healing bloom.
2. **Tight-Frustum Real-Time Sun Shadow Pass (`src/renderer.js`):**
   - `2048×2048` `PCFSoftShadowMap` directional sun/alpenglow light tracking Gateway's active vertical spire band so 5-riser staircases, wrought-bronze handrails, mechanical elevator cabs, and Gateway's 34-bone `SkinnedMesh` cast crisp, grounded shadows without wasted off-screen texels.
3. **Instanced Spire & Environment Batching (`src/towerArchitecture.js`, `src/stormSky.js`, `src/oceanVfx.js`):**
   - Back-sector angular culling, merged static elevator guide-rail & buttress geometry, `InstancedMesh` stair flights, turbines, water droplets, fireflies, and particle pools.
4. **ACES Filmic Post-Processing (`src/postfx.js`):**
   - Balanced sunlit exposure, thresholded highlight bloom (preserving crisp cloud and whitewater foam detail), and per-biome atmospheric color grading with adaptive DPR scaling (`1.75x → 1.25x → 1.0x`) to lock `16.67ms` (`60fps`) frame pacing on mobile GPUs.

---

## 2. Per-Subsystem GPU Budget Allocation

| Subsystem | Module & Assets | Draw-Call Budget | Triangle Budget | Memory & Batching Discipline |
| :--- | :--- | :---: | :---: | :--- |
| **Hydro-Spire Architecture** | `src/towerArchitecture.js` (`real_staircase.glb`, `mech_elevator.glb`, `hydro_turbine.glb`, `pipe_valve.glb`) | `35 – 58` | `45,000 – 72,000` | Merged shaft I-beams & conduits, instanced 5-riser stairs, altitude-window prop culling. |
| **Gateway 34-Bone Heroine** | `src/gateway.js` (`assets/models/gateway.glb`) | `1 – 6` | `3,500 – 8,500` | Seamless weight-painted `SkinnedMesh` with consolidated 1K PBR atlas & shared material cache. |
| **7 Articulated Foes** | `src/enemyRig.js` (`assets/models/enemy_*.glb`) | `10 – 24` | `6,000 – 14,000` | Pooled `EnemyVisualPool` instances + shared Sea-Glass Hydro-Bubble stun cage material. |
| **5-Biome Sky & 3D Vistas** | `src/stormSky.js`, `src/water.js`, `src/oceanVfx.js` | `8 – 18` | `10,000 – 20,000` | Merged canyon cliffs, waterfalls, snow peaks, cypress arches, coral shelves & instanced wildlife. |
| **Mini-Games (`5` Modes)** | `core_descent`, `reef_swim`, `rapids_surf`, `frill_glide`, `aqueduct_sanctum` | `60 – 130` | `40,000 – 98,000` | Reusable object pools and bounded LRU caches (`dGeo = 0, dTex = 0` across mode switches). |
| **Post-FX Pipeline** | `src/postfx.js` | `10 – 15` | `15` | Fullscreen-triangle passes resized cleanly without render-target leaks. |
