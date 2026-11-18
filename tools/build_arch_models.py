"""
TOWERING WATERS: GATEWAY'S DESCENT — WAVE 2 AAA PBR TEXTURE & 3D SCULPT PIPELINE
=================================================================================
Dual-stage offline asset pipeline (`tools/build_arch_models.py`):

Stage 1 (`python tools/build_arch_models.py --bake-textures`):
  Uses Python 3.12 (`numpy`, `scipy.ndimage`, `Pillow`) to synthesize 7 seamless
  `1024x1024` Substance-grade PBR material sets (`albedo`, `normal`, `orm` in
  `assets/textures/arch_*.webp`, where ORM = R: 8-ray HBAO, G: Roughness, B: Metalness):
    1. `arch_canyon_sandstone_*` — Chiseled Sedona cross-bedded red-rock sandstone
    2. `arch_alpine_granite_*`   — Carved silver alpine granite + Pelagian hydro-glyph reliefs
    3. `arch_bayou_limestone_*`  — Weathered temple limestone + 3D moss cavity colonies
    4. `arch_coral_travertine_*` — Porous fossil-shell coral travertine + pearl chevron inlay
    5. `arch_storm_basalt_*`     — Hexagonal volcanic basalt + riveted titanium & plasma veins
    6. `arch_redwood_timber_*`   — Fibrous seasoned redwood heartwood planks & copper cleats
    7. `arch_antique_bronze_*`   — Planished antique bronze + embossed wave filigree & patina

Stage 2 (`blender-launcher.exe -b -P tools/build_arch_models.py`):
  Loads the baked PBR sheets and builds 4 high-detail architectural/mechanical `.glb`s:
    1. `assets/models/real_staircase.glb` (riveted nosings, C-girders, pierced spandrel
       trusses, lathe-turned spindle balusters, wrought S-scroll filigree & orb newels)
    2. `assets/models/mech_elevator.glb` (Art-Deco brass fretwork light-deck, filigree
       sea-glass panels, 3-roller guide shoes, lattice hoist yoke, spur-gear winch & sheaves)
    3. `assets/models/hydro_turbine.glb` (16-bucket double-cupped riveted copper & redwood
       Pelton waterwheel + geared crystal hub + bolted gooseneck penstock)
    4. `assets/models/pipe_valve.glb` (bolted T-manifold, spiral-caged bubble sight-glass,
       Bourdon gauge, and 6-spoke forged copper/brass filigree handwheel)
"""

import os
import sys
import math
import json
import struct
import traceback

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_DIR = os.path.dirname(SCRIPT_DIR)
OUT_MODELS_DIR = os.path.join(PROJECT_DIR, "assets", "models")
OUT_TEXTURES_DIR = os.path.join(PROJECT_DIR, "assets", "textures")
DONE_SENTINEL = os.path.join(OUT_MODELS_DIR, "_arch_build_done.json")
ERR_SENTINEL = os.path.join(OUT_MODELS_DIR, "_arch_build_error.txt")

os.makedirs(OUT_MODELS_DIR, exist_ok=True)
os.makedirs(OUT_TEXTURES_DIR, exist_ok=True)

COLS = 20
TWO_PI = math.pi * 2.0
COL_ANGLE = TWO_PI / float(COLS)
TOWER_RADIUS = 3.75
FLOOR_HEIGHT = 1.50
LEDGE_R = TOWER_RADIUS + 0.46


# ==============================================================================
# STAGE 1: PYTHON 3.12 (`numpy` + `scipy` + `Pillow`) 1024x1024 AAA PBR BAKER
# ==============================================================================

def run_pbr_texture_baker():
    import numpy as np
    from scipy import ndimage
    from PIL import Image

    # Remove legacy 256x256 Wave-1 PNGs in assets/textures/arch_*.png
    for fn in os.listdir(OUT_TEXTURES_DIR):
        if fn.startswith("arch_") and fn.endswith(".png"):
            try:
                os.remove(os.path.join(OUT_TEXTURES_DIR, fn))
            except OSError:
                pass

    N = 1024
    lin = np.linspace(0.0, 1.0, N, endpoint=False, dtype=np.float32)
    uu, vv = np.meshgrid(lin, lin)  # shape (N, N)

    def hex_rgb(h):
        s = h.lstrip("#")
        return np.array([int(s[0:2], 16), int(s[2:4], 16), int(s[4:6], 16)], dtype=np.float32) / 255.0

    def mix_col(c0, c1, t):
        t3 = np.clip(t, 0.0, 1.0)[..., None]
        return c0 * (1.0 - t3) + c1 * t3

    def smoothstep_np(e0, e1, x):
        t = np.clip((x - e0) / max(1e-6, e1 - e0), 0.0, 1.0)
        return t * t * (3.0 - 2.0 * t)

    def tileable_noise(freq_x, freq_y, seed):
        rng = np.random.default_rng(seed)
        grid = rng.random((freq_y, freq_x), dtype=np.float32)
        # Pad with periodic wrap then zoom smoothly to N x N
        pad = np.pad(grid, ((2, 2), (2, 2)), mode="wrap")
        zy = N / float(freq_y)
        zx = N / float(freq_x)
        zoomed = ndimage.zoom(pad, (zy, zx), order=3, mode="wrap")
        sy = int(round(2 * zy))
        sx = int(round(2 * zx))
        out = zoomed[sy:sy + N, sx:sx + N]
        mn, mx = float(out.min()), float(out.max())
        return (out - mn) / max(1e-6, mx - mn)

    def tileable_fbm(fx, fy, octaves=5, gain=0.52, seed=100):
        acc = np.zeros((N, N), dtype=np.float32)
        amp = 1.0
        norm = 0.0
        for o in range(octaves):
            acc += amp * tileable_noise(min(N // 2, fx * (2 ** o)), min(N // 2, fy * (2 ** o)), seed + o * 37)
            norm += amp
            amp *= gain
        return acc / norm

    def warped_fbm(fx, fy, warp_amt=0.06, octaves=5, seed=200):
        wx = (tileable_fbm(fx, fy, octaves=3, seed=seed + 11) - 0.5) * warp_amt
        wy = (tileable_fbm(fx, fy, octaves=3, seed=seed + 29) - 0.5) * warp_amt
        base = tileable_fbm(fx * 2, fy * 2, octaves=octaves, seed=seed)
        px = ((uu + wx) % 1.0) * N
        py = ((vv + wy) % 1.0) * N
        return ndimage.map_coordinates(base, [py, px], order=1, mode="wrap")

    def tileable_voronoi(cells, jitter=0.82, seed=300):
        rng = np.random.default_rng(seed)
        # Evaluate on 512x512 then upsample 2x for speed (<0.25s)
        M = 512
        lm = np.linspace(0.0, float(cells), M, endpoint=False, dtype=np.float32)
        gx, gy = np.meshgrid(lm, lm)
        ix = np.floor(gx).astype(np.int32)
        iy = np.floor(gy).astype(np.int32)

        pts_x = rng.random((cells, cells), dtype=np.float32) * jitter + (1.0 - jitter) * 0.5
        pts_y = rng.random((cells, cells), dtype=np.float32) * jitter + (1.0 - jitter) * 0.5
        pts_id = rng.random((cells, cells), dtype=np.float32)

        d1 = np.full((M, M), 99.0, dtype=np.float32)
        d2 = np.full((M, M), 99.0, dtype=np.float32)
        cid = np.zeros((M, M), dtype=np.float32)

        for dy in (-1, 0, 1):
            wy = (iy + dy) % cells
            for dx in (-1, 0, 1):
                wx = (ix + dx) % cells
                px = ix + dx + pts_x[wy, wx]
                py = iy + dy + pts_y[wy, wx]
                dist = np.hypot(gx - px, gy - py)
                mask1 = dist < d1
                mask2 = (~mask1) & (dist < d2)
                d2 = np.where(mask1, d1, np.where(mask2, dist, d2))
                cid = np.where(mask1, pts_id[wy, wx], cid)
                d1 = np.where(mask1, dist, d1)

        edge = ndimage.zoom(d2 - d1, 2.0, order=1, mode="wrap")[:N, :N]
        f1 = ndimage.zoom(d1, 2.0, order=1, mode="wrap")[:N, :N]
        cell_tone = ndimage.zoom(cid, 2.0, order=0, mode="wrap")[:N, :N]
        return f1, edge, cell_tone

    def ashlar_blocks(rows, cols, mortar_w=0.022, bevel_w=0.085, chip_amt=0.028, seed=400):
        rng = np.random.default_rng(seed)
        chip_x = (tileable_fbm(24, 24, octaves=4, seed=seed + 3) - 0.5) * chip_amt
        chip_y = (tileable_fbm(24, 24, octaves=4, seed=seed + 7) - 0.5) * chip_amt

        vr = ((vv + chip_y * 0.35) % 1.0) * rows
        r_idx = np.floor(vr).astype(np.int32) % rows
        fy = vr - np.floor(vr)

        row_offsets = rng.random(rows, dtype=np.float32) * 0.25 + (np.arange(rows, dtype=np.float32) % 2) * 0.5
        uc = ((uu + row_offsets[r_idx] + chip_x * 0.35) % 1.0) * cols
        c_idx = np.floor(uc).astype(np.int32) % cols
        fx = uc - np.floor(uc)

        block_tones = rng.random((rows, cols), dtype=np.float32)
        tilt_x = (rng.random((rows, cols), dtype=np.float32) - 0.5) * 0.16
        tilt_y = (rng.random((rows, cols), dtype=np.float32) - 0.5) * 0.16

        dist_edge = np.minimum(np.minimum(fx, 1.0 - fx) * (rows / max(1.0, float(cols))), np.minimum(fy, 1.0 - fy))
        # Perturb edge with sharp rock chips
        rock_chip = (tileable_fbm(32, 32, octaves=3, seed=seed + 19) - 0.5) * chip_amt
        eff_dist = dist_edge + rock_chip

        mortar_mask = 1.0 - smoothstep_np(mortar_w * 0.55, mortar_w * 1.45, eff_dist)
        bevel_prof = smoothstep_np(mortar_w * 0.7, mortar_w + bevel_w, eff_dist)
        pillow = np.sin(np.clip(fx, 0.0, 1.0) * math.pi) * np.sin(np.clip(fy, 0.0, 1.0) * math.pi)
        tilt = tilt_x[r_idx, c_idx] * (fx - 0.5) + tilt_y[r_idx, c_idx] * (fy - 0.5)

        block_h = bevel_prof * (0.72 + 0.24 * pillow + tilt) - mortar_mask * 0.55
        return block_h, mortar_mask, bevel_prof, block_tones[r_idx, c_idx], r_idx, fx, fy

    def hydro_glyph_frieze(rows, r_idx, fx, fy):
        """Carved Pelagian spiral-wave & stepped water-temple glyph reliefs on frieze courses."""
        on_frieze = ((r_idx % 4) == 1).astype(np.float32)
        # Centered medallion / wave scroll inside each stone block (fx, fy in 0..1)
        cx = (fx - 0.5) * 2.0
        cy = (fy - 0.5) * 2.0
        rad = np.hypot(cx * 0.85, cy)
        ang = np.arctan2(cy, cx * 0.85)
        spiral = np.abs(np.sin(rad * 11.5 - ang * 2.0))
        spiral_groove = (1.0 - smoothstep_np(0.12, 0.34, spiral)) * smoothstep_np(0.82, 0.62, rad) * smoothstep_np(0.10, 0.22, rad)
        border_frame = (1.0 - smoothstep_np(0.03, 0.09, np.abs(rad - 0.72)))
        wave_band = (1.0 - smoothstep_np(0.06, 0.16, np.abs(cy - 0.28 * np.sin(fx * TWO_PI * 2.0)))) * ((r_idx % 4) == 3).astype(np.float32)
        return np.clip(on_frieze * np.maximum(spiral_groove, border_frame * 0.8) + wave_band * 0.75, 0.0, 1.0)

    def compute_hbao_curvature_normals(h, nrm_strength=4.5, ao_scale=1.35):
        # 8-direction horizon-based ambient occlusion on wrapped heightfield
        dirs = [(1, 0), (-1, 0), (0, 1), (0, -1), (1, 1), (-1, 1), (1, -1), (-1, -1)]
        radii = [2, 5, 10, 18, 30]
        occ = np.zeros_like(h)
        for dx, dy in dirs:
            step_len = math.hypot(dx, dy)
            max_slope = np.zeros_like(h)
            for r in radii:
                shifted = np.roll(np.roll(h, -dy * r, axis=0), -dx * r, axis=1)
                dh = (shifted - h) * ao_scale * 26.0
                slope = np.maximum(0.0, dh / (r * step_len))
                max_slope = np.maximum(max_slope, slope)
            occ += np.arctan(max_slope) / (math.pi * 0.5)
        ao = np.clip(1.0 - (occ / len(dirs)) * 1.08, 0.12, 1.0)

        # Multi-scale curvature (ridge wear vs cavity moss/patina)
        h_blur = ndimage.gaussian_filter(h, sigma=2.2, mode="wrap")
        curv = ndimage.laplace(h_blur, mode="wrap") * 12.0
        ridge = np.clip(curv, 0.0, 1.0)
        cavity = np.clip(-curv, 0.0, 1.0)

        # Scharr tangent-space normal map (+X right, +Y up for OpenGL/Three.js)
        gx = (
            3.0 * (np.roll(h, -1, axis=1) - np.roll(h, 1, axis=1))
            + np.roll(np.roll(h, -1, axis=0), -1, axis=1)
            - np.roll(np.roll(h, -1, axis=0), 1, axis=1)
            + np.roll(np.roll(h, 1, axis=0), -1, axis=1)
            - np.roll(np.roll(h, 1, axis=0), 1, axis=1)
        ) * (nrm_strength * 0.25)
        gy = (
            3.0 * (np.roll(h, 1, axis=0) - np.roll(h, -1, axis=0))
            + np.roll(np.roll(h, 1, axis=0), -1, axis=1)
            - np.roll(np.roll(h, -1, axis=0), -1, axis=1)
            + np.roll(np.roll(h, 1, axis=0), 1, axis=1)
            - np.roll(np.roll(h, -1, axis=0), 1, axis=1)
        ) * (nrm_strength * 0.25)
        nx = -gx
        ny = gy
        nz = np.ones_like(h)
        inv = 1.0 / np.sqrt(nx * nx + ny * ny + nz * nz)
        nrm_rgb = np.stack([0.5 + 0.5 * nx * inv, 0.5 + 0.5 * ny * inv, 0.5 + 0.5 * nz * inv], axis=-1)
        return ao, ridge, cavity, np.clip(nrm_rgb, 0.0, 1.0)

    def save_pbr_triplet(prefix, alb_rgb, nrm_rgb, ao, rough, metal, also_png_512=False):
        alb_u8 = np.clip(alb_rgb * 255.0 + 0.5, 0, 255).astype(np.uint8)
        nrm_u8 = np.clip(nrm_rgb * 255.0 + 0.5, 0, 255).astype(np.uint8)
        orm_u8 = np.clip(
            np.stack([ao, np.clip(rough, 0.04, 0.98), np.clip(metal, 0.0, 1.0)], axis=-1) * 255.0 + 0.5,
            0,
            255,
        ).astype(np.uint8)

        Image.fromarray(alb_u8, "RGB").save(
            os.path.join(OUT_TEXTURES_DIR, f"{prefix}_albedo.webp"), "WEBP", quality=86, method=4
        )
        Image.fromarray(nrm_u8, "RGB").save(
            os.path.join(OUT_TEXTURES_DIR, f"{prefix}_normal.webp"), "WEBP", quality=88, method=4
        )
        Image.fromarray(orm_u8, "RGB").resize((512, 512), Image.Resampling.BILINEAR).save(
            os.path.join(OUT_TEXTURES_DIR, f"{prefix}_orm.webp"), "WEBP", quality=86, method=4
        )

        if also_png_512:
            # Temporary 512x512 PNGs for Blender 5.3 GLB packing (cleaned up after GLB build)
            Image.fromarray(alb_u8, "RGB").resize((512, 512), Image.Resampling.LANCZOS).save(
                os.path.join(OUT_TEXTURES_DIR, f"_tmp_{prefix}_albedo.png"), "PNG"
            )
            Image.fromarray(nrm_u8, "RGB").resize((512, 512), Image.Resampling.BILINEAR).save(
                os.path.join(OUT_TEXTURES_DIR, f"_tmp_{prefix}_normal.png"), "PNG"
            )
            Image.fromarray(orm_u8[:, :, 1], "L").resize((512, 512), Image.Resampling.BILINEAR).save(
                os.path.join(OUT_TEXTURES_DIR, f"_tmp_{prefix}_rough.png"), "PNG"
            )

    micro_grain = tileable_fbm(64, 64, octaves=3, seed=901)
    fine_pits = tileable_fbm(96, 96, octaves=2, seed=907)

    # --------------------------------------------------------------------------
    # 1. `arch_canyon_sandstone` — Chiseled Sedona Cross-Bedded Red-Rock Sandstone
    # --------------------------------------------------------------------------
    bh, mortar, bev, btone, r_idx, fx, fy = ashlar_blocks(6, 3, mortar_w=0.022, bevel_w=0.09, chip_amt=0.032, seed=101)
    strata_wave = warped_fbm(4, 24, warp_amt=0.08, octaves=5, seed=105)
    _, v_edge, _ = tileable_voronoi(14, seed=109)
    cracks = (1.0 - smoothstep_np(0.015, 0.06, v_edge)) * (1.0 - mortar)
    glyphs = hydro_glyph_frieze(6, r_idx, fx, fy) * 0.45
    h1 = bh * 0.62 + strata_wave * 0.28 + micro_grain * 0.12 - cracks * 0.28 - glyphs * 0.26
    ao1, ridge1, cav1, nrm1 = compute_hbao_curvature_normals(h1, nrm_strength=5.2)

    col_sand_a = hex_rgb("#c96b43")
    col_sand_b = hex_rgb("#e08b5c")
    col_sand_deep = hex_rgb("#8f3d24")
    col_ochre = hex_rgb("#edb47e")
    col_mortar1 = hex_rgb("#361910")
    alb1 = mix_col(col_sand_deep, col_sand_a, strata_wave * 0.72 + btone * 0.28)
    alb1 = mix_col(alb1, col_sand_b, smoothstep_np(0.45, 0.82, strata_wave))
    alb1 = mix_col(alb1, col_ochre, ridge1 * 0.55 + (1.0 - smoothstep_np(0.75, 0.95, micro_grain)) * 0.08)
    alb1 = mix_col(alb1, col_sand_deep * 0.65, cav1 * 0.45 + cracks * 0.5 + glyphs * 0.45)
    alb1 = mix_col(alb1, col_mortar1, mortar * 0.92)
    alb1 *= (0.68 + 0.32 * ao1)[..., None]
    rgh1 = 0.64 + 0.18 * micro_grain + mortar * 0.22 - ridge1 * 0.14
    save_pbr_triplet("arch_canyon_sandstone", alb1, nrm1, ao1, rgh1, np.full_like(ao1, 0.03))

    # --------------------------------------------------------------------------
    # 2. `arch_alpine_granite` — Carved Silver Alpine Granite + Hydro-Glyph Reliefs
    # --------------------------------------------------------------------------
    bh, mortar, bev, btone, r_idx, fx, fy = ashlar_blocks(6, 3, mortar_w=0.018, bevel_w=0.075, chip_amt=0.018, seed=202)
    granite_cryst = warped_fbm(18, 18, warp_amt=0.04, octaves=5, seed=207)
    _, v_edge, v_tone = tileable_voronoi(22, seed=211)
    glyphs2 = hydro_glyph_frieze(6, r_idx, fx, fy)
    chisel_marks = np.sin((uu * 96.0 + vv * 32.0) * TWO_PI) * 0.025 * (1.0 - mortar)
    h2 = bh * 0.68 + granite_cryst * 0.18 + micro_grain * 0.14 + chisel_marks - glyphs2 * 0.38
    ao2, ridge2, cav2, nrm2 = compute_hbao_curvature_normals(h2, nrm_strength=4.8)

    col_gran_lo = hex_rgb("#8898ad")
    col_gran_hi = hex_rgb("#dce6f2")
    col_glyph_gold = hex_rgb("#c89d46")
    col_mortar2 = hex_rgb("#1e2b3d")
    mica_fleck = (fine_pits > 0.76).astype(np.float32)
    alb2 = mix_col(col_gran_lo, col_gran_hi, granite_cryst * 0.6 + btone * 0.25 + v_tone * 0.15)
    alb2 = mix_col(alb2, hex_rgb("#f8fbff"), ridge2 * 0.5 + mica_fleck * 0.35)
    alb2 = mix_col(alb2, col_glyph_gold, glyphs2 * 0.68)
    alb2 = mix_col(alb2, col_mortar2, mortar * 0.92 + cav2 * 0.28)
    alb2 *= (0.72 + 0.28 * ao2)[..., None]
    rgh2 = 0.38 + 0.22 * granite_cryst - mica_fleck * 0.18 - glyphs2 * 0.12 + mortar * 0.35
    met2 = 0.06 + glyphs2 * 0.62 + mica_fleck * 0.15
    save_pbr_triplet("arch_alpine_granite", alb2, nrm2, ao2, rgh2, met2, also_png_512=True)

    # --------------------------------------------------------------------------
    # 3. `arch_bayou_limestone` — Weathered Temple Limestone + 3D Moss Colonies
    # --------------------------------------------------------------------------
    bh, mortar, bev, btone, r_idx, fx, fy = ashlar_blocks(5, 3, mortar_w=0.028, bevel_w=0.10, chip_amt=0.042, seed=303)
    lime_erosion = warped_fbm(8, 12, warp_amt=0.09, octaves=5, seed=309)
    _, v_edge, _ = tileable_voronoi(12, seed=313)
    cracks3 = (1.0 - smoothstep_np(0.02, 0.075, v_edge)) * (1.0 - mortar)
    glyphs3 = hydro_glyph_frieze(5, r_idx, fx, fy) * 0.85
    moss_patch = smoothstep_np(0.50, 0.74, warped_fbm(5, 5, warp_amt=0.12, seed=317) * 0.68 + mortar * 0.48)
    moss_puff = moss_patch * (0.18 + 0.14 * micro_grain)
    h3 = bh * 0.58 + lime_erosion * 0.24 - cracks3 * 0.36 - glyphs3 * 0.32 + moss_puff
    ao3, ridge3, cav3, nrm3 = compute_hbao_curvature_normals(h3, nrm_strength=5.4)

    col_lime_a = hex_rgb("#5e7061")
    col_lime_b = hex_rgb("#889c89")
    col_moss_dk = hex_rgb("#22471d")
    col_moss_hi = hex_rgb("#487d34")
    col_mortar3 = hex_rgb("#162419")
    alb3 = mix_col(col_lime_a, col_lime_b, lime_erosion * 0.65 + btone * 0.35)
    alb3 = mix_col(alb3, hex_rgb("#a8bba6"), ridge3 * 0.45)
    alb3 = mix_col(alb3, col_mortar3, mortar * 0.88 + cracks3 * 0.55 + glyphs3 * 0.42)
    moss_col = mix_col(col_moss_dk, col_moss_hi, micro_grain * 0.7 + ridge3 * 0.3)
    alb3 = mix_col(alb3, moss_col, np.clip(moss_patch + cav3 * 0.35, 0.0, 0.92))
    alb3 *= (0.68 + 0.32 * ao3)[..., None]
    rgh3 = 0.56 + 0.26 * moss_patch + 0.14 * micro_grain - (1.0 - moss_patch) * smoothstep_np(0.65, 0.9, warped_fbm(3, 20, seed=321)) * 0.25
    save_pbr_triplet("arch_bayou_limestone", alb3, nrm3, ao3, rgh3, np.full_like(ao3, 0.04))

    # --------------------------------------------------------------------------
    # 4. `arch_coral_travertine` — Porous Coral Travertine + Mother-of-Pearl Inlay
    # --------------------------------------------------------------------------
    bh, mortar, bev, btone, r_idx, fx, fy = ashlar_blocks(6, 3, mortar_w=0.020, bevel_w=0.08, chip_amt=0.024, seed=404)
    wave_flute = warped_fbm(6, 18, warp_amt=0.07, octaves=5, seed=409)
    f1_pores, _, _ = tileable_voronoi(36, seed=413)
    coral_pores = (1.0 - smoothstep_np(0.06, 0.16, f1_pores)) * (fine_pits > 0.48).astype(np.float32) * (1.0 - mortar)
    # Pearl/verdigris chevron inlay on every 4th course
    chev = 1.0 - smoothstep_np(0.08, 0.18, np.abs((fy - 0.5) - 0.26 * np.abs(((fx * 2.0) % 1.0) - 0.5) * 2.0))
    pearl_inlay = chev * ((r_idx % 4) == 2).astype(np.float32) * (1.0 - mortar)
    h4 = bh * 0.62 + wave_flute * 0.24 - coral_pores * 0.32 + pearl_inlay * 0.14 + micro_grain * 0.10
    ao4, ridge4, cav4, nrm4 = compute_hbao_curvature_normals(h4, nrm_strength=4.6)

    col_trav_lo = hex_rgb("#cbbba2")
    col_trav_hi = hex_rgb("#f4ece0")
    col_pearl = hex_rgb("#5ce1e6")
    col_mortar4 = hex_rgb("#1f4959")
    alb4 = mix_col(col_trav_lo, col_trav_hi, wave_flute * 0.68 + btone * 0.32)
    alb4 = mix_col(alb4, hex_rgb("#ffffff"), ridge4 * 0.48)
    alb4 = mix_col(alb4, hex_rgb("#9e8b72"), coral_pores * 0.65 + cav4 * 0.28)
    alb4 = mix_col(alb4, col_pearl, pearl_inlay * 0.82)
    alb4 = mix_col(alb4, col_mortar4, mortar * 0.90)
    alb4 *= (0.74 + 0.26 * ao4)[..., None]
    rgh4 = 0.44 + coral_pores * 0.28 - pearl_inlay * 0.28 + 0.14 * micro_grain
    met4 = 0.05 + pearl_inlay * 0.42
    save_pbr_triplet("arch_coral_travertine", alb4, nrm4, ao4, rgh4, met4)

    # --------------------------------------------------------------------------
    # 5. `arch_storm_basalt` — Hexagonal Volcanic Basalt & Riveted Titanium Veins
    # --------------------------------------------------------------------------
    f1_hex, hex_edge, hex_id = tileable_voronoi(10, jitter=0.45, seed=505)
    stria = warped_fbm(28, 6, warp_amt=0.03, octaves=4, seed=509)
    hex_seam = 1.0 - smoothstep_np(0.022, 0.075, hex_edge)
    plate_band = ((np.floor(vv * 4.0).astype(np.int32) % 4) == 0).astype(np.float32)
    rivet_u = ((uu * 16.0) % 1.0) - 0.5
    rivet_v = ((vv * 16.0) % 1.0) - 0.5
    rivets = (1.0 - smoothstep_np(0.14, 0.24, np.hypot(rivet_u, rivet_v))) * plate_band
    h5 = (1.0 - hex_seam) * (0.48 + hex_id * 0.22 + stria * 0.22) + plate_band * 0.18 + rivets * 0.24 - hex_seam * 0.48
    ao5, ridge5, cav5, nrm5 = compute_hbao_curvature_normals(h5, nrm_strength=4.8)

    col_bas_lo = hex_rgb("#1e293b")
    col_bas_hi = hex_rgb("#3b4d6b")
    col_titan = hex_rgb("#647c9c")
    col_plasma = hex_rgb("#22d3ee")
    col_copper_riv = hex_rgb("#d9823b")
    plasma_vein = hex_seam * smoothstep_np(0.58, 0.84, warped_fbm(6, 6, seed=517))
    alb5 = mix_col(col_bas_lo, col_bas_hi, stria * 0.6 + hex_id * 0.4)
    alb5 = mix_col(alb5, col_titan, plate_band * 0.65 + ridge5 * 0.42)
    alb5 = mix_col(alb5, col_copper_riv, rivets * 0.88)
    alb5 = mix_col(alb5, hex_rgb("#09111e"), hex_seam * 0.88)
    alb5 = mix_col(alb5, col_plasma, plasma_vein * 0.78)
    alb5 *= (0.70 + 0.30 * ao5)[..., None]
    rgh5 = 0.30 + 0.22 * stria - plate_band * 0.08 - rivets * 0.12 + hex_seam * 0.25
    met5 = 0.32 + plate_band * 0.42 + rivets * 0.52 + ridge5 * 0.2
    save_pbr_triplet("arch_storm_basalt", alb5, nrm5, ao5, rgh5, met5)

    # --------------------------------------------------------------------------
    # 6. `arch_redwood_timber` — Seasoned Redwood Planks, Grain & Copper Cleats
    # --------------------------------------------------------------------------
    plank_rows = 8
    vp = vv * plank_rows
    p_idx = np.floor(vp).astype(np.int32) % plank_rows
    pfy = vp - np.floor(vp)
    plank_seam = 1.0 - smoothstep_np(0.025, 0.075, np.minimum(pfy, 1.0 - pfy))
    wood_rings = 0.5 + 0.5 * np.sin((warped_fbm(32, 4, warp_amt=0.05, octaves=5, seed=606) * 14.0 + p_idx * 1.7))
    wood_fibers = tileable_fbm(128, 12, octaves=3, seed=611)
    cleat_band = (np.abs(((uu * 4.0 + (p_idx % 2) * 0.5) % 1.0) - 0.5) < 0.045).astype(np.float32) * (1.0 - plank_seam)
    h6 = (1.0 - plank_seam) * (0.55 + wood_rings * 0.20 + wood_fibers * 0.16) + cleat_band * 0.22 - plank_seam * 0.48
    ao6, ridge6, cav6, nrm6 = compute_hbao_curvature_normals(h6, nrm_strength=4.2)

    col_rw_dk = hex_rgb("#5c2614")
    col_rw_md = hex_rgb("#8c3f23")
    col_rw_hi = hex_rgb("#b85d38")
    col_cleat = hex_rgb("#cf7c42")
    alb6 = mix_col(col_rw_dk, col_rw_md, wood_rings * 0.7 + wood_fibers * 0.3)
    alb6 = mix_col(alb6, col_rw_hi, ridge6 * 0.52)
    alb6 = mix_col(alb6, col_cleat, cleat_band * 0.90)
    alb6 = mix_col(alb6, hex_rgb("#240d06"), plank_seam * 0.92)
    alb6 *= (0.72 + 0.28 * ao6)[..., None]
    rgh6 = 0.52 + 0.20 * wood_fibers - cleat_band * 0.26 + plank_seam * 0.25
    met6 = 0.04 + cleat_band * 0.82
    save_pbr_triplet("arch_redwood_timber", alb6, nrm6, ao6, rgh6, met6, also_png_512=True)

    # --------------------------------------------------------------------------
    # 7. `arch_antique_bronze` — Planished Hammered Bronze, Filigree & Patina
    # --------------------------------------------------------------------------
    f1_ham, _, _ = tileable_voronoi(28, jitter=0.75, seed=707)
    hammer_dimples = np.cos(np.clip(f1_ham * 2.2, 0.0, 1.0) * math.pi * 0.5) * 0.14
    brush_fine = tileable_fbm(96, 16, octaves=3, seed=711) * 0.08

    # Embossed Art-Deco / Pelagian Wave-Scroll Filigree Bands & Rivet Straps
    strap_h = (np.minimum((vv * 4.0) % 1.0, 1.0 - ((vv * 4.0) % 1.0)) < 0.09).astype(np.float32)
    riv_x = ((uu * 24.0) % 1.0) - 0.5
    riv_y = ((vv * 4.0) % 1.0)
    riv_y_d = np.minimum(riv_y, 1.0 - riv_y) * 6.0
    strap_rivets = (1.0 - smoothstep_np(0.16, 0.28, np.hypot(riv_x, riv_y_d))) * strap_h

    # Ornate S-scroll filigree wave & rosette between straps
    fu_fil = ((uu * 4.0) % 1.0) - 0.5
    fv_fil = ((vv * 4.0) % 1.0) - 0.5
    rosette_r = np.hypot(fu_fil, fv_fil)
    rosette_a = np.arctan2(fv_fil, fu_fil)
    petal = 0.26 + 0.07 * np.cos(rosette_a * 6.0)
    filigree_ring = (1.0 - smoothstep_np(0.02, 0.055, np.abs(rosette_r - petal))) * (1.0 - strap_h)
    filigree_scroll = (1.0 - smoothstep_np(0.025, 0.06, np.abs(fv_fil - 0.18 * np.sin(uu * TWO_PI * 4.0)))) * (1.0 - strap_h)
    filigree = np.maximum(filigree_ring, filigree_scroll * 0.85)

    h7 = 0.5 + hammer_dimples + brush_fine + strap_h * 0.20 + strap_rivets * 0.26 + filigree * 0.24
    ao7, ridge7, cav7, nrm7 = compute_hbao_curvature_normals(h7, nrm_strength=4.4)

    col_brz_base = hex_rgb("#b8873d")
    col_brz_gold = hex_rgb("#f5cf7a")
    col_brz_dark = hex_rgb("#5e411d")
    col_verdigris = hex_rgb("#3c8c7e")

    patina_mask = np.clip(cav7 * 0.72 + (1.0 - ao7) * 0.45 - ridge7 * 0.5, 0.0, 0.78)
    alb7 = mix_col(col_brz_dark, col_brz_base, 0.45 + hammer_dimples * 2.2 + brush_fine * 1.5)
    alb7 = mix_col(alb7, col_brz_gold, np.clip(ridge7 * 0.72 + filigree * 0.55 + strap_rivets * 0.65, 0.0, 1.0))
    alb7 = mix_col(alb7, col_verdigris, patina_mask * 0.62)
    alb7 *= (0.74 + 0.26 * ao7)[..., None]
    rgh7 = 0.22 + 0.16 * (1.0 - ridge7) + patina_mask * 0.42 - strap_rivets * 0.08
    met7 = np.clip(0.88 - patina_mask * 0.52, 0.22, 0.96)
    save_pbr_triplet("arch_antique_bronze", alb7, nrm7, ao7, rgh7, met7, also_png_512=True)

    webp_files = sorted(fn for fn in os.listdir(OUT_TEXTURES_DIR) if fn.startswith("arch_") and fn.endswith(".webp"))
    total_kb = sum(os.path.getsize(os.path.join(OUT_TEXTURES_DIR, fn)) for fn in webp_files) / 1024.0
    print(f"Baked {len(webp_files)} AAA 1K PBR .webp textures ({total_kb:.1f} KB total) in assets/textures/")


# ==============================================================================
# STAGE 2: BLENDER 5.3 HIGH-DETAIL ARCHITECTURAL & MECHANICAL `.GLB` BUILDER
# ==============================================================================

def run_blender_glb_builder():
    import bpy
    import bmesh
    from mathutils import Vector, Matrix

    def v3(tx, ty, tz):
        return Vector((float(tx), -float(tz), float(ty)))

    def rot3(rx=0.0, ry=0.0, rz=0.0):
        cx, sx = math.cos(rx), math.sin(rx)
        cy, sy = math.cos(ry), math.sin(ry)
        cz, sz = math.cos(rz), math.sin(rz)
        mx = Matrix(((1, 0, 0), (0, cx, -sx), (0, sx, cx)))
        my = Matrix(((cy, 0, sy), (0, 1, 0), (-sy, 0, cy)))
        mz = Matrix(((cz, -sz, 0), (sz, cz, 0), (0, 0, 1)))
        rt = mx @ my @ mz
        mc = Matrix(((1, 0, 0), (0, 0, -1), (0, 1, 0)))
        rb = mc @ rt @ mc.transposed()
        return rb.to_euler("XYZ")

    def cyl_local(r, theta_rel, y_rel, ref_r=LEDGE_R):
        return (r * math.sin(theta_rel), y_rel, r * math.cos(theta_rel) - ref_r)

    def lerp(a, b, t):
        return a + (b - a) * t

    def srgb_to_lin(c):
        return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4

    def hex_lin(hex_str):
        h = hex_str.lstrip("#")
        r, g, b = int(h[0:2], 16) / 255.0, int(h[2:4], 16) / 255.0, int(h[4:6], 16) / 255.0
        return (srgb_to_lin(r), srgb_to_lin(g), srgb_to_lin(b))

    def reset_scene():
        bpy.ops.wm.read_factory_settings(use_empty=True)
        scene = bpy.context.scene
        scene.unit_settings.system = "METRIC"
        scene.unit_settings.scale_length = 1.0
        return scene

    def load_packed_pbr_triplet(prefix):
        alb_p = os.path.join(OUT_TEXTURES_DIR, f"_tmp_{prefix}_albedo.png")
        nrm_p = os.path.join(OUT_TEXTURES_DIR, f"_tmp_{prefix}_normal.png")
        rgh_p = os.path.join(OUT_TEXTURES_DIR, f"_tmp_{prefix}_rough.png")
        alb = bpy.data.images.load(alb_p) if os.path.exists(alb_p) else None
        nrm = bpy.data.images.load(nrm_p) if os.path.exists(nrm_p) else None
        rgh = bpy.data.images.load(rgh_p) if os.path.exists(rgh_p) else None
        if alb:
            alb.pack()
        if nrm:
            nrm.colorspace_settings.name = "Non-Color"
            nrm.pack()
        if rgh:
            rgh.colorspace_settings.name = "Non-Color"
            rgh.pack()
        return alb, rgh, nrm

    def make_mat(
        name,
        hex_color,
        roughness=0.45,
        metallic=0.0,
        coat=0.0,
        coat_rough=0.08,
        emission_hex=None,
        emission_strength=0.0,
        alpha=1.0,
        albedo_img=None,
        roughness_img=None,
        normal_img=None,
        normal_strength=0.85,
        uv_scale=1.0,
    ):
        mat = bpy.data.materials.new(name=name)
        mat.use_nodes = True
        if alpha < 0.999:
            if hasattr(mat, "surface_render_method"):
                mat.surface_render_method = "BLENDED"
            elif hasattr(mat, "blend_method"):
                mat.blend_method = "BLEND"

        nt = mat.node_tree
        bsdf = nt.nodes.get("Principled BSDF")
        col = hex_lin(hex_color)
        bsdf.inputs["Base Color"].default_value = (col[0], col[1], col[2], alpha)
        bsdf.inputs["Roughness"].default_value = roughness
        bsdf.inputs["Metallic"].default_value = metallic
        if "Alpha" in bsdf.inputs:
            bsdf.inputs["Alpha"].default_value = alpha
        if "Coat Weight" in bsdf.inputs:
            bsdf.inputs["Coat Weight"].default_value = coat
            bsdf.inputs["Coat Roughness"].default_value = coat_rough
        elif "Clearcoat" in bsdf.inputs:
            bsdf.inputs["Clearcoat"].default_value = coat
            bsdf.inputs["Clearcoat Roughness"].default_value = coat_rough
        if emission_hex is not None and emission_strength > 0.0:
            ecol = hex_lin(emission_hex)
            if "Emission Color" in bsdf.inputs:
                bsdf.inputs["Emission Color"].default_value = (ecol[0], ecol[1], ecol[2], 1.0)
                bsdf.inputs["Emission Strength"].default_value = emission_strength

        if albedo_img is not None or roughness_img is not None or normal_img is not None:
            tc = nt.nodes.new("ShaderNodeTexCoord")
            mp = nt.nodes.new("ShaderNodeMapping")
            mp.inputs["Scale"].default_value = (uv_scale, uv_scale, uv_scale)
            nt.links.new(tc.outputs["UV"], mp.inputs["Vector"])

            if albedo_img is not None:
                ta = nt.nodes.new("ShaderNodeTexImage")
                ta.image = albedo_img
                nt.links.new(mp.outputs["Vector"], ta.inputs["Vector"])
                nt.links.new(ta.outputs["Color"], bsdf.inputs["Base Color"])
            if roughness_img is not None:
                tr = nt.nodes.new("ShaderNodeTexImage")
                tr.image = roughness_img
                nt.links.new(mp.outputs["Vector"], tr.inputs["Vector"])
                nt.links.new(tr.outputs["Color"], bsdf.inputs["Roughness"])
            if normal_img is not None:
                tn = nt.nodes.new("ShaderNodeTexImage")
                tn.image = normal_img
                nn = nt.nodes.new("ShaderNodeNormalMap")
                nn.inputs["Strength"].default_value = normal_strength
                nt.links.new(mp.outputs["Vector"], tn.inputs["Vector"])
                nt.links.new(tn.outputs["Color"], nn.inputs["Color"])
                nt.links.new(nn.outputs["Normal"], bsdf.inputs["Normal"])
        return mat

    def make_empty_node(name, pos=(0.0, 0.0, 0.0), rot=(0.0, 0.0, 0.0), parent=None):
        obj = bpy.data.objects.new(name, None)
        obj.empty_display_size = 0.05
        obj.location = v3(*pos)
        obj.rotation_euler = rot3(*rot)
        if parent is not None:
            obj.parent = parent
        bpy.context.collection.objects.link(obj)
        return obj

    def assign_box_uvs(bm, scale=1.25):
        uv_layer = bm.loops.layers.uv.verify()
        for f in bm.faces:
            n = f.normal
            ax, ay, az = abs(n.x), abs(n.y), abs(n.z)
            for loop in f.loops:
                co = loop.vert.co
                if az >= ax and az >= ay:
                    u, v = co.x, co.y
                elif ax >= ay:
                    u, v = co.y, co.z
                else:
                    u, v = co.x, co.z
                loop[uv_layer].uv = (u * scale, v * scale)

    def finalize_mesh_obj(name, bm, materials, pos=(0.0, 0.0, 0.0), rot=(0.0, 0.0, 0.0), parent=None, smooth=True, uv_scale=1.25):
        bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5)
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
        assign_box_uvs(bm, scale=uv_scale)

        mesh = bpy.data.meshes.new(name + "_Mesh")
        bm.to_mesh(mesh)
        bm.free()

        for poly in mesh.polygons:
            poly.use_smooth = smooth

        mats = materials if isinstance(materials, (list, tuple)) else [materials]
        for m in mats:
            mesh.materials.append(m)

        obj = bpy.data.objects.new(name, mesh)
        obj.location = v3(*pos)
        obj.rotation_euler = rot3(*rot)
        if parent is not None:
            obj.parent = parent
        bpy.context.collection.objects.link(obj)
        return obj

    def add_bevel_box(bm, center_t3, size_t3, bevel=0.012, segs=1, rot_t3=(0.0, 0.0, 0.0), mat_idx=0):
        tb = bmesh.new()
        bmesh.ops.create_cube(tb, size=1.0)
        sx, sy, sz = size_t3
        bmesh.ops.scale(tb, vec=(sx, sz, sy), verts=tb.verts)
        if bevel > 0.0:
            eff_b = min(bevel, min(sx, sy, sz) * 0.38)
            bmesh.ops.bevel(tb, geom=list(tb.edges), offset=eff_b, segments=segs, profile=0.5, affect="EDGES")
        if any(abs(a) > 1e-6 for a in rot_t3):
            rmat = rot3(*rot_t3).to_matrix()
            bmesh.ops.rotate(tb, cent=(0.0, 0.0, 0.0), matrix=rmat, verts=tb.verts)
        bmesh.ops.translate(tb, vec=v3(*center_t3), verts=tb.verts)

        vmap = {v: bm.verts.new(v.co) for v in tb.verts}
        for f in tb.faces:
            try:
                nf = bm.faces.new([vmap[v] for v in f.verts])
                nf.material_index = mat_idx
            except ValueError:
                pass
        tb.free()

    def add_loft_rings(bm, rings_t3, closed=True, cap_start=True, cap_end=True, mat_idx=0):
        v_rings = [[bm.verts.new(v3(*p)) for p in ring] for ring in rings_t3]
        for i in range(len(v_rings) - 1):
            r0, r1 = v_rings[i], v_rings[i + 1]
            n = len(r0)
            limit = n if closed else (n - 1)
            for j in range(limit):
                jn = (j + 1) % n
                try:
                    f = bm.faces.new([r0[j], r0[jn], r1[jn], r1[j]])
                    f.material_index = mat_idx
                except ValueError:
                    pass
        if closed and len(v_rings[0]) >= 3:
            if cap_start:
                c0 = sum((v.co for v in v_rings[0]), Vector()) / len(v_rings[0])
                vc0 = bm.verts.new(c0)
                r0 = v_rings[0]
                n = len(r0)
                for j in range(n):
                    jn = (j + 1) % n
                    try:
                        f = bm.faces.new([vc0, r0[jn], r0[j]])
                        f.material_index = mat_idx
                    except ValueError:
                        pass
            if cap_end:
                c1 = sum((v.co for v in v_rings[-1]), Vector()) / len(v_rings[-1])
                vc1 = bm.verts.new(c1)
                r1 = v_rings[-1]
                n = len(r1)
                for j in range(n):
                    jn = (j + 1) % n
                    try:
                        f = bm.faces.new([vc1, r1[j], r1[jn]])
                        f.material_index = mat_idx
                    except ValueError:
                        pass

    def add_swept_tube(bm, pts_t3, radii, segs=8, up_t3=(0.0, 1.0, 0.0), cap_start=True, cap_end=True, mat_idx=0):
        pts = [Vector(p) for p in pts_t3]
        cnt = len(pts)
        if cnt < 2:
            return
        is_list = isinstance(radii, (list, tuple)) and len(radii) == cnt and isinstance(radii[0], (int, float, list, tuple))
        r_list = []
        for i in range(cnt):
            ri = radii[i] if is_list else radii
            if isinstance(ri, (int, float)):
                r_list.append((float(ri), float(ri)))
            else:
                r_list.append((float(ri[0]), float(ri[1])))

        tangents = []
        for i in range(cnt):
            t = (pts[1] - pts[0]) if i == 0 else ((pts[-1] - pts[-2]) if i == cnt - 1 else (pts[i + 1] - pts[i - 1]))
            tangents.append(t.normalized() if t.length > 1e-6 else Vector((0.0, 1.0, 0.0)))

        up = Vector(up_t3).normalized()
        if abs(tangents[0].dot(up)) > 0.92:
            up = Vector((1.0, 0.0, 0.0)) if abs(tangents[0].x) < 0.8 else Vector((0.0, 0.0, 1.0))

        nrm = (up - tangents[0] * tangents[0].dot(up)).normalized()
        rings = []
        for i in range(cnt):
            if i > 0:
                q = tangents[i - 1].rotation_difference(tangents[i])
                nrm = (q @ nrm).normalized()
            binrm = tangents[i].cross(nrm).normalized()
            rx, ry = r_list[i]
            ring = []
            for s in range(segs):
                a = (TWO_PI * s) / segs
                pt = pts[i] + binrm * (math.cos(a) * rx) + nrm * (math.sin(a) * ry)
                ring.append((pt.x, pt.y, pt.z))
            rings.append(ring)
        add_loft_rings(bm, rings, closed=True, cap_start=cap_start, cap_end=cap_end, mat_idx=mat_idx)

    def add_turned_spindle(bm, base_xyz, height, scale_r=1.0, segs=8, mat_idx=0):
        """Classical lathe-turned architectural bronze spindle baluster."""
        bx, by, bz = base_xyz
        prof = [
            (0.00, 0.028),
            (0.08, 0.028),
            (0.14, 0.015),
            (0.30, 0.025),
            (0.46, 0.013),
            (0.66, 0.022),
            (0.84, 0.014),
            (0.94, 0.024),
            (1.00, 0.024),
        ]
        pts = [(bx, by + f * height, bz) for f, _ in prof]
        rads = [r * scale_r for _, r in prof]
        add_swept_tube(bm, pts, rads, segs=segs, up_t3=(0.0, 0.0, 1.0), mat_idx=mat_idx)

    def add_curved_annular_box(bm, r0, r1, a0, a1, y_bot, y_top, bev=0.014, arc_segs=2, mat_idx=0):
        lo, hi = (a0, a1) if a0 <= a1 else (a1, a0)
        h = max(0.01, y_top - y_bot)
        b = min(bev, h * 0.34, (r1 - r0) * 0.28)

        def make_ring_loop(ri, ro, da_in, y_val):
            pts = []
            lo_c = lo + da_in
            hi_c = hi - da_in
            if hi_c <= lo_c:
                mid = 0.5 * (lo + hi)
                lo_c, hi_c = mid - 0.001, mid + 0.001
            for s in range(arc_segs + 1):
                a = lerp(lo_c, hi_c, s / float(arc_segs))
                pts.append(cyl_local(ro, a, y_val))
            for s in range(arc_segs, -1, -1):
                a = lerp(lo_c, hi_c, s / float(arc_segs))
                pts.append(cyl_local(ri, a, y_val))
            return pts

        da_bev = b / max(1.0, 0.5 * (r0 + r1))
        rings = [
            make_ring_loop(r0 + b * 0.5, r1 - b, da_bev, y_bot),
            make_ring_loop(r0, r1, 0.0, y_bot + b),
            make_ring_loop(r0, r1, 0.0, y_top - b),
            make_ring_loop(r0 + b * 0.5, r1 - b, da_bev, y_top),
        ]
        add_loft_rings(bm, rings, closed=True, cap_start=True, cap_end=True, mat_idx=mat_idx)

    def export_glb_and_inspect(filepath, export_apply=False):
        bpy.ops.export_scene.gltf(
            filepath=filepath,
            export_format="GLB",
            export_yup=True,
            export_apply=export_apply,
            export_texcoords=True,
            export_normals=True,
            export_materials="EXPORT",
        )
        size_bytes = os.path.getsize(filepath)
        with open(filepath, "rb") as f:
            f.read(12)
            chunk_len, _ = struct.unpack("<II", f.read(8))
            gltf_json = json.loads(f.read(chunk_len).decode("utf-8"))

        nodes = [n.get("name", "") for n in gltf_json.get("nodes", [])]
        mats = [m.get("name", "") for m in gltf_json.get("materials", [])]
        accessors = gltf_json.get("accessors", [])
        tris = 0
        for mesh in gltf_json.get("meshes", []):
            for prim in mesh.get("primitives", []):
                if "indices" in prim:
                    tris += accessors[prim["indices"]]["count"] // 3
                elif "POSITION" in prim.get("attributes", {}):
                    tris += accessors[prim["attributes"]["POSITION"]]["count"] // 3
        return {
            "file": os.path.basename(filepath),
            "bytes": size_bytes,
            "triangles": tris,
            "nodes": nodes,
            "materials": mats,
        }

    # --------------------------------------------------------------------------
    # ASSET 1: `real_staircase.glb` (Wave 2 High-Craft Spindles, Rivets & Filigree)
    # --------------------------------------------------------------------------
    def _populate_helical_stair_flight(bm_stone, bm_metal, dir_sign=1.0):
        steps = 5
        step_rise = FLOOR_HEIGHT / float(steps)
        t_start = 0.12 * COL_ANGLE
        t_end = 0.92 * COL_ANGLE
        t_span = (t_end - t_start) / float(steps)

        r_wall = TOWER_RADIUS - 0.06
        r_mid = TOWER_RADIUS + 0.44
        r_outer = TOWER_RADIUS + 0.95
        r_rail = TOWER_RADIUS + 0.90

        # 1. 5 Multi-Stone Beveled Treads + Molded Risers + Riveted Bullnose Nosings
        for s in range(steps):
            y_prev = s * step_rise
            y_top = (s + 1) * step_rise
            a0 = dir_sign * (t_start + s * t_span - 0.012 * COL_ANGLE)
            a1 = dir_sign * (t_start + (s + 1) * t_span + 0.008 * COL_ANGLE)

            # Recessed riser + raised ornamental riser molding bar
            riser_a0 = dir_sign * (t_start + s * t_span)
            riser_a1 = dir_sign * (t_start + s * t_span + 0.036 * COL_ANGLE)
            add_curved_annular_box(bm_stone, r_wall, r_outer - 0.045, riser_a0, riser_a1, y_prev - 0.05, y_top - 0.055, bev=0.008, arc_segs=1)
            add_curved_annular_box(bm_metal, r_wall + 0.14, r_outer - 0.10, riser_a0 - dir_sign * 0.006 * COL_ANGLE, riser_a0 + dir_sign * 0.010 * COL_ANGLE, y_prev + 0.06, y_top - 0.11, bev=0.004, arc_segs=1)

            # Two-stone fitted ashlar tread slabs (inner & outer stone blocks with crisp joint!)
            r_split = r_mid + (0.06 if (s % 2 == 0) else -0.06)
            add_curved_annular_box(bm_stone, r_wall, r_split - 0.008, a0, a1, y_top - 0.068, y_top, bev=0.011, arc_segs=1)
            add_curved_annular_box(bm_stone, r_split + 0.008, r_outer - 0.015, a0, a1, y_top - 0.068, y_top, bev=0.011, arc_segs=1)

            # Riveted bronze bullnose nosing + 3 dome rivet studs per step!
            nose_a0 = dir_sign * (t_start + s * t_span - 0.018 * COL_ANGLE)
            nose_a1 = dir_sign * (t_start + s * t_span + 0.024 * COL_ANGLE)
            add_curved_annular_box(bm_metal, r_wall + 0.06, r_outer + 0.008, nose_a0, nose_a1, y_top - 0.034, y_top + 0.006, bev=0.006, arc_segs=1)
            for rr in (r_wall + 0.22, r_mid, r_outer - 0.12):
                rc = cyl_local(rr, dir_sign * (t_start + s * t_span + 0.004 * COL_ANGLE), y_top + 0.010)
                add_bevel_box(bm_metal, rc, (0.022, 0.012, 0.022), bevel=0.005)

        # 2. Flanged Riveted Outer C-Channel Stringer Girder + Inner Carved Stone Stringer
        str_stations = 6
        inner_pts, outer_web_pts, outer_top_pts, outer_bot_pts = [], [], [], []
        for k in range(str_stations):
            f = k / float(str_stations - 1)
            th = dir_sign * lerp(t_start - 0.02 * COL_ANGLE, t_end + 0.02 * COL_ANGLE, f)
            yk = f * FLOOR_HEIGHT - 0.14
            inner_pts.append(cyl_local(TOWER_RADIUS + 0.05, th, yk))
            outer_web_pts.append(cyl_local(r_outer - 0.035, th, yk))
            outer_top_pts.append(cyl_local(r_outer - 0.018, th, yk + 0.095))
            outer_bot_pts.append(cyl_local(r_outer - 0.018, th, yk - 0.095))

        add_swept_tube(bm_metal, outer_web_pts, (0.024, 0.105), segs=6, up_t3=(0.0, 1.0, 0.0))
        add_swept_tube(bm_metal, outer_top_pts, (0.044, 0.020), segs=6, up_t3=(0.0, 1.0, 0.0))
        add_swept_tube(bm_metal, outer_bot_pts, (0.044, 0.020), segs=6, up_t3=(0.0, 1.0, 0.0))
        add_swept_tube(bm_stone, inner_pts, (0.058, 0.13), segs=6, up_t3=(0.0, 1.0, 0.0))

        # 3. Pierced Arched Spandrel Cantilever Trusses + Bolted Wall Plates
        for frac in (0.28, 0.72):
            th_b = dir_sign * lerp(t_start, t_end, frac)
            yb = frac * FLOOR_HEIGHT - 0.12
            add_curved_annular_box(bm_stone, r_wall, TOWER_RADIUS + 0.16, th_b - 0.042 * COL_ANGLE, th_b + 0.042 * COL_ANGLE, yb - 0.48, yb + 0.04, bev=0.010, arc_segs=1)
            strut_pts = [
                cyl_local(TOWER_RADIUS + 0.04, th_b, yb - 0.44),
                cyl_local(TOWER_RADIUS + 0.48, th_b, yb - 0.19),
                cyl_local(r_outer - 0.06, th_b, yb - 0.04),
            ]
            add_swept_tube(bm_metal, strut_pts, (0.028, 0.042), segs=6, up_t3=(0.0, 1.0, 0.0))
            # Decorative spandrel ring inside the truss triangle
            ring_c = cyl_local(TOWER_RADIUS + 0.34, th_b, yb - 0.16)
            sp_ring = [cyl_local(TOWER_RADIUS + 0.34 + math.cos((TWO_PI * q) / 10) * 0.075, th_b, yb - 0.16 + math.sin((TWO_PI * q) / 10) * 0.075) for q in range(11)]
            add_swept_tube(bm_metal, sp_ring, 0.012, segs=5, cap_start=False, cap_end=False)
            add_bevel_box(bm_metal, ring_c, (0.025, 0.025, 0.025), bevel=0.005)

        # 4. Lathe-Turned Spindle Balusters + S-Scroll Filigree Infill + Finial Newel Posts!
        rail_h = 0.46
        handrail_pts, kneerail_pts, baserail_pts = [], [], []
        for s in range(steps + 1):
            f = s / float(steps)
            th_r = dir_sign * lerp(t_start - 0.01 * COL_ANGLE, t_end + 0.01 * COL_ANGLE, f)
            y_step = f * FLOOR_HEIGHT
            is_end_newel = s == 0 or s == steps
            if is_end_newel:
                add_turned_spindle(bm_metal, cyl_local(r_rail, th_r, y_step - 0.04), rail_h + 0.09, scale_r=1.38, segs=8)
                orb_c = cyl_local(r_rail, th_r, y_step + rail_h + 0.085)
                add_bevel_box(bm_metal, orb_c, (0.078, 0.078, 0.078), bevel=0.024, rot_t3=(0.35, th_r, 0.35))
            else:
                add_turned_spindle(bm_metal, cyl_local(r_rail, th_r, y_step - 0.03), rail_h + 0.02, scale_r=0.92, segs=7)

            handrail_pts.append(cyl_local(r_rail, th_r, y_step + rail_h))
            kneerail_pts.append(cyl_local(r_rail, th_r, y_step + rail_h * 0.56))
            baserail_pts.append(cyl_local(r_rail, th_r, y_step + 0.08))

            # Wrought-bronze S-scroll wave filigree between balusters!
            if s < steps:
                scroll_pts = []
                for q in range(6):
                    qf = (s + q / 5.0) / float(steps)
                    qth = dir_sign * lerp(t_start - 0.01 * COL_ANGLE, t_end + 0.01 * COL_ANGLE, qf)
                    qy = qf * FLOOR_HEIGHT + 0.16 + 0.085 * math.sin((q / 5.0) * TWO_PI)
                    scroll_pts.append(cyl_local(r_rail, qth, qy))
                add_swept_tube(bm_metal, scroll_pts, 0.010, segs=5)

        add_swept_tube(bm_metal, handrail_pts, (0.032, 0.024), segs=8, up_t3=(0.0, 1.0, 0.0))
        add_swept_tube(bm_metal, kneerail_pts, 0.013, segs=6, up_t3=(0.0, 1.0, 0.0))
        add_swept_tube(bm_metal, baserail_pts, 0.012, segs=6, up_t3=(0.0, 1.0, 0.0))

    def _populate_terrace_deck(bm_stone, bm_metal):
        half_a = 0.49 * COL_ANGLE
        r_wall = TOWER_RADIUS - 0.06
        r_outer = TOWER_RADIUS + 0.95

        # Stepped ogee stone bed course
        add_curved_annular_box(bm_stone, r_wall, r_outer - 0.045, -half_a, half_a, -0.185, -0.055, bev=0.014, arc_segs=3)

        # Multi-course fitted ashlar terrace pavers + inlaid bronze drainage strip
        for idx, (a0, a1) in enumerate([(-half_a, -0.17 * COL_ANGLE), (-0.155 * COL_ANGLE, 0.155 * COL_ANGLE), (0.17 * COL_ANGLE, half_a)]):
            r_lip = r_outer + (0.008 if idx == 1 else -0.004)
            add_curved_annular_box(bm_stone, r_wall, TOWER_RADIUS + 0.40, a0, a1, -0.062, 0.0, bev=0.011, arc_segs=2)
            add_curved_annular_box(bm_stone, TOWER_RADIUS + 0.48, r_lip - 0.024, a0, a1, -0.062, 0.0, bev=0.011, arc_segs=2)

        # Inlaid bronze aqueduct grate band down the center of the terrace
        add_curved_annular_box(bm_metal, TOWER_RADIUS + 0.40, TOWER_RADIUS + 0.48, -half_a * 0.94, half_a * 0.94, -0.058, 0.002, bev=0.005, arc_segs=3)

        # Riveted outer metallic fascia & anti-slip bullnose curb
        add_curved_annular_box(bm_metal, r_outer - 0.044, r_outer + 0.014, -half_a, half_a, -0.074, 0.007, bev=0.008, arc_segs=3)
        for rf_a in (-0.36, -0.18, 0.0, 0.18, 0.36):
            rc = cyl_local(r_outer + 0.016, rf_a * COL_ANGLE, -0.032)
            add_bevel_box(bm_metal, rc, (0.022, 0.022, 0.014), bevel=0.005, rot_t3=(0.0, rf_a * COL_ANGLE, 0.0))

        # Twin Pierced Spandrel Underside Corbels & Turned Corner Bollards
        for side in (-1.0, 1.0):
            th_c = side * 0.31 * COL_ANGLE
            add_curved_annular_box(bm_stone, r_wall, TOWER_RADIUS + 0.26, th_c - 0.065 * COL_ANGLE, th_c + 0.065 * COL_ANGLE, -0.60, -0.16, bev=0.014, arc_segs=1)
            add_curved_annular_box(bm_stone, r_wall, TOWER_RADIUS + 0.58, th_c - 0.055 * COL_ANGLE, th_c + 0.055 * COL_ANGLE, -0.34, -0.15, bev=0.012, arc_segs=1)
            truss_pts = [
                cyl_local(TOWER_RADIUS + 0.05, th_c, -0.56),
                cyl_local(TOWER_RADIUS + 0.52, th_c, -0.30),
                cyl_local(r_outer - 0.07, th_c, -0.07),
            ]
            add_swept_tube(bm_metal, truss_pts, (0.030, 0.044), segs=6, up_t3=(0.0, 1.0, 0.0))
            sp_ring = [cyl_local(TOWER_RADIUS + 0.38 + math.cos((TWO_PI * q) / 10) * 0.08, th_c, -0.24 + math.sin((TWO_PI * q) / 10) * 0.08) for q in range(11)]
            add_swept_tube(bm_metal, sp_ring, 0.012, segs=5, cap_start=False, cap_end=False)

            add_turned_spindle(bm_metal, cyl_local(r_outer - 0.03, side * 0.44 * COL_ANGLE, -0.02), 0.16, scale_r=1.05, segs=7)

    def build_real_staircase_glb():
        reset_scene()
        s_alb, s_rgh, s_nrm = load_packed_pbr_triplet("arch_alpine_granite")
        m_alb, m_rgh, m_nrm = load_packed_pbr_triplet("arch_antique_bronze")

        mat_stone = make_mat(
            "mat_arch_stone", "#e2e8f0", roughness=0.58, metallic=0.06,
            albedo_img=s_alb, roughness_img=s_rgh, normal_img=s_nrm, normal_strength=0.95, uv_scale=1.5
        )
        mat_metal = make_mat(
            "mat_arch_bronze", "#d4a34b", roughness=0.26, metallic=0.88, coat=0.25,
            albedo_img=m_alb, roughness_img=m_rgh, normal_img=m_nrm, normal_strength=0.85, uv_scale=1.8
        )

        root = make_empty_node("RealStaircaseRoot")
        bm_rs, bm_rm = bmesh.new(), bmesh.new()
        _populate_helical_stair_flight(bm_rs, bm_rm, dir_sign=1.0)
        finalize_mesh_obj("stair_flight_R_stone", bm_rs, mat_stone, parent=root)
        finalize_mesh_obj("stair_flight_R_metal", bm_rm, mat_metal, parent=root)

        bm_ls, bm_lm = bmesh.new(), bmesh.new()
        _populate_helical_stair_flight(bm_ls, bm_lm, dir_sign=-1.0)
        finalize_mesh_obj("stair_flight_L_stone", bm_ls, mat_stone, parent=root)
        finalize_mesh_obj("stair_flight_L_metal", bm_lm, mat_metal, parent=root)

        bm_ts, bm_tm = bmesh.new(), bmesh.new()
        _populate_terrace_deck(bm_ts, bm_tm)
        finalize_mesh_obj("terrace_deck_stone", bm_ts, mat_stone, parent=root)
        finalize_mesh_obj("terrace_deck_metal", bm_tm, mat_metal, parent=root)

        return export_glb_and_inspect(os.path.join(OUT_MODELS_DIR, "real_staircase.glb"), export_apply=False)

    # --------------------------------------------------------------------------
    # ASSET 2: `mech_elevator.glb` (Art-Deco Fretwork Deck, 3-Roller Shoes & Gears)
    # --------------------------------------------------------------------------
    def build_mech_elevator_glb():
        reset_scene()
        m_alb, m_rgh, m_nrm = load_packed_pbr_triplet("arch_antique_bronze")

        mat_steel = make_mat("mat_lift_steel", "#222e40", roughness=0.34, metallic=0.86, normal_img=m_nrm, normal_strength=0.65, uv_scale=2.0)
        mat_brass = make_mat("mat_lift_brass", "#dba646", roughness=0.24, metallic=0.90, coat=0.3, albedo_img=m_alb, roughness_img=m_rgh, normal_img=m_nrm, normal_strength=0.80, uv_scale=1.8)
        mat_glass = make_mat("mat_lift_glass", "#a5f3fc", roughness=0.05, metallic=0.10, coat=1.0, coat_rough=0.02, emission_hex="#0891b2", emission_strength=0.24, alpha=0.34)
        mat_deck_glow = make_mat("mat_lift_deck_glow", "#67e8f9", roughness=0.12, metallic=0.15, emission_hex="#22d3ee", emission_strength=1.35)
        mat_ind_up = make_mat("mat_chevron_up", "#5efce8", roughness=0.10, emission_hex="#10b981", emission_strength=1.7)
        mat_ind_dn = make_mat("mat_chevron_down", "#fde047", roughness=0.10, emission_hex="#f59e0b", emission_strength=1.6)

        root = make_empty_node("MechElevatorRoot")
        cab_grp = make_empty_node("elevator_cab", parent=root)
        bm_cab = bmesh.new()

        # Riveted stepped chassis + brass bumper trim (`y = -0.18 .. 0.0`)
        add_bevel_box(bm_cab, (0.0, -0.09, 0.0), (1.16, 0.18, 0.92), bevel=0.022, mat_idx=0)
        add_bevel_box(bm_cab, (0.0, -0.025, 0.0), (1.22, 0.046, 0.98), bevel=0.012, mat_idx=1)
        add_bevel_box(bm_cab, (0.0, -0.155, 0.0), (1.20, 0.032, 0.95), bevel=0.008, mat_idx=1)

        # Illuminated sea-glass floor core + Intricate Art-Deco Cross-Hatched Brass Fretwork Grille!
        add_bevel_box(bm_cab, (0.0, -0.006, 0.02), (0.94, 0.012, 0.70), bevel=0.003, mat_idx=3)
        for gx in (-0.36, -0.18, 0.0, 0.18, 0.36):
            add_bevel_box(bm_cab, (gx, 0.002, 0.02), (0.024, 0.010, 0.72), bevel=0.003, mat_idx=1)
        for gz in (-0.24, -0.07, 0.10, 0.27):
            add_bevel_box(bm_cab, (0.0, 0.002, gz), (0.96, 0.010, 0.022), bevel=0.003, mat_idx=1)
        # Central brass octagonal floor medallion
        med_ring = [(math.cos((TWO_PI * k) / 12) * 0.18, 0.004, 0.02 + math.sin((TWO_PI * k) / 12) * 0.18) for k in range(13)]
        add_swept_tube(bm_cab, med_ring, 0.014, segs=6, cap_start=False, cap_end=False, mat_idx=1)

        # 3-Roller Spring-Loaded Guide Shoes gripping the Twin I-Beam Rails (`x = ±0.52, z = -0.43`)
        for sx in (-1.0, 1.0):
            gx = sx * 0.52
            add_bevel_box(bm_cab, (gx, 0.16, -0.43), (0.14, 0.58, 0.15), bevel=0.012, mat_idx=0)
            for ry in (-0.08, 0.16, 0.40, 1.54):
                add_swept_tube(bm_cab, [(gx - 0.075, ry, -0.37), (gx + 0.075, ry, -0.37)], 0.036, segs=10, mat_idx=1)
            add_bevel_box(bm_cab, (gx, 1.54, -0.43), (0.14, 0.26, 0.15), bevel=0.010, mat_idx=0)

        # Turned Front Baluster Posts + Filigree-Framed Tempered Sea-Glass Waist Panels!
        rail_y = 0.54
        for sx in (-1.0, 1.0):
            px = sx * 0.54
            add_turned_spindle(bm_cab, (px, 0.0, 0.40), 0.58, scale_r=1.22, segs=8, mat_idx=1)
            add_bevel_box(bm_cab, (px, 0.60, 0.40), (0.078, 0.05, 0.078), bevel=0.012, mat_idx=1)
            # Fluted twin-channel rear yoke columns
            add_swept_tube(bm_cab, [(px, -0.08, -0.36), (px, 1.60, -0.36)], 0.036, segs=8, mat_idx=0)
            for cy in (0.28, 0.54, 0.84, 1.32, 1.56):
                add_bevel_box(bm_cab, (px, cy, -0.36), (0.092, 0.052, 0.092), bevel=0.010, mat_idx=1)

            add_swept_tube(bm_cab, [(px, rail_y, -0.36), (px, rail_y, 0.40)], (0.028, 0.022), segs=8, mat_idx=1)
            add_swept_tube(bm_cab, [(px, 0.10, -0.36), (px, 0.10, 0.40)], 0.015, segs=6, mat_idx=1)
            add_bevel_box(bm_cab, (px, 0.31, 0.02), (0.018, 0.38, 0.68), bevel=0.004, mat_idx=2)
            # Diagonal Art-Deco filigree muntin bars across the side glass panels!
            add_swept_tube(bm_cab, [(px, 0.12, -0.30), (px, 0.50, 0.34)], 0.010, segs=5, mat_idx=1)
            add_swept_tube(bm_cab, [(px, 0.50, -0.30), (px, 0.12, 0.34)], 0.010, segs=5, mat_idx=1)

        add_swept_tube(bm_cab, [(-0.54, rail_y, -0.36), (0.54, rail_y, -0.36)], (0.028, 0.022), segs=8, mat_idx=1)
        add_swept_tube(bm_cab, [(-0.54, 0.10, -0.36), (0.54, 0.10, -0.36)], 0.015, segs=6, mat_idx=1)
        add_bevel_box(bm_cab, (0.0, 0.31, -0.36), (0.98, 0.38, 0.018), bevel=0.004, mat_idx=2)
        for mx in (-0.24, 0.24):
            add_turned_spindle(bm_cab, (mx, 0.08, -0.36), 0.45, scale_r=0.72, segs=6, mat_idx=1)

        # Pierced Lattice-Truss Overhead Hoist Yoke (`y = 1.58 .. 1.76`) + Turnbuckle Spring Shackles
        yoke_pts = [(-0.54, 1.58, -0.36), (-0.46, 1.67, -0.14), (0.0, 1.72, -0.08), (0.46, 1.67, -0.14), (0.54, 1.58, -0.36)]
        add_swept_tube(bm_cab, yoke_pts, (0.044, 0.056), segs=8, up_t3=(0.0, 1.0, 0.0), mat_idx=0)
        yoke_low = [(-0.52, 1.48, -0.36), (-0.38, 1.58, -0.14), (0.0, 1.62, -0.08), (0.38, 1.58, -0.14), (0.52, 1.48, -0.36)]
        add_swept_tube(bm_cab, yoke_low, 0.020, segs=6, up_t3=(0.0, 1.0, 0.0), mat_idx=1)
        add_bevel_box(bm_cab, (0.0, 1.70, -0.10), (0.72, 0.082, 0.15), bevel=0.014, mat_idx=1)
        add_bevel_box(bm_cab, (0.0, 1.63, -0.10), (0.50, 0.026, 0.09), bevel=0.005, mat_idx=3)
        for cx in (-0.24, 0.24):
            add_swept_tube(bm_cab, [(cx, 1.72, -0.10), (cx, 1.82, -0.10)], [0.042, 0.030], segs=8, mat_idx=1)

        add_bevel_box(bm_cab, (0.54, 1.05, -0.29), (0.12, 0.36, 0.10), bevel=0.012, mat_idx=0)
        add_bevel_box(bm_cab, (0.54, 1.05, -0.24), (0.13, 0.38, 0.02), bevel=0.005, mat_idx=1)

        finalize_mesh_obj("cab_structure", bm_cab, [mat_steel, mat_brass, mat_glass, mat_deck_glow], parent=cab_grp)

        # Dual-bar Pantograph `safety_gate`
        gate_bm = bmesh.new()
        add_swept_tube(gate_bm, [(-0.08, 0.0, 0.0), (1.03, 0.0, 0.0)], 0.022, segs=8, mat_idx=0)
        add_swept_tube(gate_bm, [(0.08, -0.09, 0.0), (0.96, -0.09, 0.0)], 0.014, segs=6, mat_idx=0)
        for rx in (0.22, 0.52, 0.82):
            add_bevel_box(gate_bm, (rx, -0.045, 0.0), (0.026, 0.11, 0.032), bevel=0.004, mat_idx=1)
        add_bevel_box(gate_bm, (0.0, 0.0, 0.0), (0.085, 0.085, 0.085), bevel=0.014, mat_idx=0)
        finalize_mesh_obj("safety_gate", gate_bm, [mat_brass, mat_steel], pos=(-0.52, 0.49, 0.40), parent=cab_grp)

        bm_up = bmesh.new()
        for dy in (-0.025, 0.025):
            add_bevel_box(bm_up, (-0.022, dy, 0.0), (0.062, 0.016, 0.024), bevel=0.003, rot_t3=(0.0, 0.0, 0.65), mat_idx=0)
            add_bevel_box(bm_up, (0.022, dy, 0.0), (0.062, 0.016, 0.024), bevel=0.003, rot_t3=(0.0, 0.0, -0.65), mat_idx=0)
        finalize_mesh_obj("chevron_up", bm_up, mat_ind_up, pos=(0.54, 1.14, -0.225), parent=cab_grp)

        bm_dn = bmesh.new()
        for dy in (-0.025, 0.025):
            add_bevel_box(bm_dn, (-0.022, dy, 0.0), (0.062, 0.016, 0.024), bevel=0.003, rot_t3=(0.0, 0.0, -0.65), mat_idx=0)
            add_bevel_box(bm_dn, (0.022, dy, 0.0), (0.062, 0.016, 0.024), bevel=0.003, rot_t3=(0.0, 0.0, 0.65), mat_idx=0)
        finalize_mesh_obj("chevron_down", bm_dn, mat_ind_dn, pos=(0.54, 0.96, -0.225), parent=cab_grp)

        # Overhead Geared `winch_housing` with Meshing Spur-Gear Train!
        bm_wh = bmesh.new()
        add_bevel_box(bm_wh, (0.0, 0.20, -0.18), (1.34, 0.26, 1.02), bevel=0.026, mat_idx=0)
        add_bevel_box(bm_wh, (0.0, 0.37, -0.14), (1.10, 0.16, 0.80), bevel=0.022, mat_idx=1)
        add_swept_tube(bm_wh, [(-0.46, 0.25, -0.26), (0.46, 0.25, -0.26)], 0.17, segs=14, mat_idx=1)
        # Visible toothed spur gear on right side of winch drum
        add_swept_tube(bm_wh, [(0.48, 0.25, -0.26), (0.55, 0.25, -0.26)], 0.25, segs=16, mat_idx=1)
        for gt in range(12):
            ga = (TWO_PI * gt) / 12.0
            add_bevel_box(bm_wh, (0.515, 0.25 + math.sin(ga) * 0.265, -0.26 + math.cos(ga) * 0.265), (0.06, 0.045, 0.045), bevel=0.005, rot_t3=(ga, 0.0, 0.0), mat_idx=1)
        for sx in (-1.0, 1.0):
            add_swept_tube(bm_wh, [(sx * 0.52, -0.28, -0.52), (sx * 0.52, 0.12, 0.20)], (0.044, 0.058), segs=6, up_t3=(0.0, 1.0, 0.0), mat_idx=0)
        add_bevel_box(bm_wh, (0.0, 0.055, 0.06), (0.68, 0.028, 0.38), bevel=0.006, mat_idx=2)
        finalize_mesh_obj("winch_housing", bm_wh, [mat_steel, mat_brass, mat_deck_glow], parent=root)

        # 10-Spoke Pierced `sheave_wheel`
        bm_sh = bmesh.new()
        add_swept_tube(bm_sh, [(-0.038, 0.0, 0.0), (-0.016, 0.0, 0.0)], 0.24, segs=18, mat_idx=0)
        add_swept_tube(bm_sh, [(0.016, 0.0, 0.0), (0.038, 0.0, 0.0)], 0.24, segs=18, mat_idx=0)
        add_swept_tube(bm_sh, [(-0.022, 0.0, 0.0), (0.022, 0.0, 0.0)], 0.19, segs=16, mat_idx=1)
        add_swept_tube(bm_sh, [(-0.056, 0.0, 0.0), (0.056, 0.0, 0.0)], 0.062, segs=10, mat_idx=0)
        for k in range(10):
            ang = (TWO_PI * k) / 10.0
            add_swept_tube(bm_sh, [(0.0, 0.0, 0.0), (0.0, math.sin(ang) * 0.20, math.cos(ang) * 0.20)], 0.014, segs=5, mat_idx=0)
        finalize_mesh_obj("sheave_wheel", bm_sh, [mat_brass, mat_steel], parent=root)

        # Slotted `counterweight`
        bm_cw = bmesh.new()
        for p_idx in range(6):
            py = -0.28 + p_idx * 0.112
            m_i = 1 if p_idx in (0, 5) else 0
            add_bevel_box(bm_cw, (0.0, py, 0.0), (0.48, 0.092, 0.14), bevel=0.010, mat_idx=m_i)
        for rx in (-0.17, 0.17):
            add_swept_tube(bm_cw, [(rx, -0.34, 0.0), (rx, 0.36, 0.0)], 0.022, segs=6, mat_idx=1)
        add_bevel_box(bm_cw, (0.0, 0.37, 0.0), (0.14, 0.09, 0.10), bevel=0.010, mat_idx=1)
        finalize_mesh_obj("counterweight", bm_cw, [mat_steel, mat_brass], parent=root)

        return export_glb_and_inspect(os.path.join(OUT_MODELS_DIR, "mech_elevator.glb"), export_apply=False)

    # --------------------------------------------------------------------------
    # ASSET 3: `hydro_turbine.glb` (16-Bucket Riveted Copper & Redwood Waterwheel)
    # --------------------------------------------------------------------------
    def build_hydro_turbine_glb():
        reset_scene()
        m_alb, m_rgh, m_nrm = load_packed_pbr_triplet("arch_antique_bronze")
        w_alb, w_rgh, w_nrm = load_packed_pbr_triplet("arch_redwood_timber")

        mat_copper = make_mat("mat_turbine_copper", "#d47944", roughness=0.26, metallic=0.88, coat=0.25, albedo_img=m_alb, roughness_img=m_rgh, normal_img=m_nrm, normal_strength=0.80, uv_scale=1.8)
        mat_timber = make_mat("mat_turbine_timber", "#8c4225", roughness=0.58, metallic=0.08, albedo_img=w_alb, roughness_img=w_rgh, normal_img=w_nrm, normal_strength=0.85, uv_scale=1.6)
        mat_iron = make_mat("mat_turbine_iron", "#222e3e", roughness=0.38, metallic=0.84, normal_img=m_nrm, normal_strength=0.5)
        mat_aqua = make_mat("mat_turbine_aqua", "#67e8f9", roughness=0.08, emission_hex="#06b6d4", emission_strength=1.6)

        root = make_empty_node("HydroTurbineRoot")

        bm_h = bmesh.new()
        add_swept_tube(bm_h, [(0.0, 0.0, -0.06), (0.0, 0.0, 0.09)], 0.58, segs=18, mat_idx=2)
        add_swept_tube(bm_h, [(0.0, 0.0, 0.07), (0.0, 0.0, 0.13)], 0.50, segs=18, mat_idx=0)
        for kb in range(10):
            ba = (TWO_PI * kb) / 10.0
            add_bevel_box(bm_h, (math.cos(ba) * 0.53, math.sin(ba) * 0.53, 0.10), (0.04, 0.04, 0.04), bevel=0.008, mat_idx=0)

        spout_pts = [(0.0, 1.20, -0.06), (0.0, 1.18, 0.16), (0.08, 1.12, 0.26), (0.20, 1.03, 0.30)]
        add_swept_tube(bm_h, spout_pts, [0.14, 0.13, 0.12, 0.10], segs=12, mat_idx=0)
        add_swept_tube(bm_h, [(0.0, 1.18, 0.06), (0.0, 1.18, 0.11)], 0.17, segs=12, mat_idx=2)
        add_swept_tube(bm_h, [(0.18, 1.04, 0.30), (0.24, 1.00, 0.30)], 0.088, segs=10, mat_idx=3)

        for sx in (-0.40, 0.40):
            add_swept_tube(bm_h, [(sx, -0.36, 0.02), (0.0, 0.0, 0.49)], 0.040, segs=6, mat_idx=2)
            add_swept_tube(bm_h, [(sx, 0.32, 0.02), (0.0, 0.0, 0.49)], 0.032, segs=6, mat_idx=0)
        add_swept_tube(bm_h, [(0.0, 0.0, 0.04), (0.0, 0.0, 0.54)], 0.080, segs=12, mat_idx=0)
        finalize_mesh_obj("turbine_housing", bm_h, [mat_copper, mat_timber, mat_iron, mat_aqua], parent=root)

        bm_w = bmesh.new()
        wheel_r = 0.88
        rim_segs = 28
        for z_off in (-0.12, 0.12):
            rim_pts = [(math.cos((TWO_PI * s) / rim_segs) * wheel_r, math.sin((TWO_PI * s) / rim_segs) * wheel_r, z_off) for s in range(rim_segs + 1)]
            add_swept_tube(bm_w, rim_pts, 0.038, segs=6, cap_start=False, cap_end=False, mat_idx=0)
            wood_pts = [(math.cos((TWO_PI * s) / rim_segs) * (wheel_r - 0.09), math.sin((TWO_PI * s) / rim_segs) * (wheel_r - 0.09), z_off * 0.85) for s in range(rim_segs + 1)]
            add_swept_tube(bm_w, wood_pts, 0.032, segs=6, cap_start=False, cap_end=False, mat_idx=1)

        # 8 Spokes + Riveted Gusset Ring
        for k in range(8):
            ang = (TWO_PI * k) / 8.0
            cx, sy = math.cos(ang), math.sin(ang)
            add_bevel_box(bm_w, (cx * 0.43, sy * 0.43, 0.0), (0.76, 0.052, 0.15), bevel=0.008, rot_t3=(0.0, 0.0, ang), mat_idx=1)
            add_bevel_box(bm_w, (cx * 0.78, sy * 0.78, 0.0), (0.09, 0.09, 0.25), bevel=0.010, rot_t3=(0.0, 0.0, ang), mat_idx=0)

        # 16 Double-Cupped Pelton Hydro-Buckets + Rim Rivets
        buckets = 16
        for b in range(buckets):
            ang = (TWO_PI * b) / float(buckets)
            bx, by = math.cos(ang) * (wheel_r + 0.02), math.sin(ang) * (wheel_r + 0.02)
            add_bevel_box(bm_w, (bx, by, 0.0), (0.17, 0.032, 0.25), bevel=0.006, rot_t3=(0.0, 0.0, ang + 0.48), mat_idx=0)
            tx, ty = math.cos(ang + 0.075) * (wheel_r + 0.095), math.sin(ang + 0.075) * (wheel_r + 0.095)
            add_bevel_box(bm_w, (tx, ty, 0.0), (0.095, 0.028, 0.24), bevel=0.005, rot_t3=(0.0, 0.0, ang + 1.08), mat_idx=0)

        add_swept_tube(bm_w, [(0.0, 0.0, -0.16), (0.0, 0.0, 0.16)], 0.18, segs=14, mat_idx=0)
        add_swept_tube(bm_w, [(0.0, 0.0, -0.18), (0.0, 0.0, 0.18)], 0.105, segs=12, mat_idx=3)
        finalize_mesh_obj("turbine_wheel", bm_w, [mat_copper, mat_timber, mat_iron, mat_aqua], pos=(0.0, 0.0, 0.28), parent=root)

        return export_glb_and_inspect(os.path.join(OUT_MODELS_DIR, "hydro_turbine.glb"), export_apply=False)

    # --------------------------------------------------------------------------
    # ASSET 4: `pipe_valve.glb` (Bolted T-Manifold, Sight-Glass & Filigree Wheel)
    # --------------------------------------------------------------------------
    def build_pipe_valve_glb():
        reset_scene()
        m_alb, m_rgh, m_nrm = load_packed_pbr_triplet("arch_antique_bronze")

        mat_bronze = make_mat("mat_valve_bronze", "#d49b3d", roughness=0.24, metallic=0.90, coat=0.3, albedo_img=m_alb, roughness_img=m_rgh, normal_img=m_nrm, normal_strength=0.80, uv_scale=1.8)
        mat_copper_wheel = make_mat("mat_valve_wheel", "#de5f3a", roughness=0.25, metallic=0.80, coat=0.35, normal_img=m_nrm, normal_strength=0.65, uv_scale=2.0)
        mat_iron = make_mat("mat_valve_iron", "#202b3b", roughness=0.36, metallic=0.86, normal_img=m_nrm, normal_strength=0.5)
        mat_sight_glow = make_mat("mat_valve_sight", "#5efce8", roughness=0.08, emission_hex="#14b8a6", emission_strength=1.6)

        root = make_empty_node("PipeValveRoot")

        bm_b = bmesh.new()
        add_swept_tube(bm_b, [(0.0, 0.0, 0.0), (0.0, 0.08, 0.0)], [0.24, 0.20], segs=10, mat_idx=2)
        add_swept_tube(bm_b, [(0.0, 0.07, 0.0), (0.0, 0.115, 0.0)], 0.21, segs=10, mat_idx=0)
        for kb in range(6):
            ba = (TWO_PI * kb) / 6.0
            add_bevel_box(bm_b, (math.cos(ba) * 0.18, 0.115, math.sin(ba) * 0.18), (0.03, 0.025, 0.03), bevel=0.005, mat_idx=0)

        add_swept_tube(bm_b, [(0.0, 0.56, -0.38), (0.0, 0.56, 0.15)], 0.088, segs=10, mat_idx=2)
        add_swept_tube(bm_b, [(0.0, 0.56, -0.36), (0.0, 0.56, -0.29)], 0.15, segs=10, mat_idx=0)
        add_swept_tube(bm_b, [(0.0, 0.56, 0.09), (0.0, 0.56, 0.15)], 0.13, segs=10, mat_idx=0)

        add_swept_tube(bm_b, [(0.0, 0.10, 0.0), (0.0, 0.24, 0.0)], 0.098, segs=10, mat_idx=2)
        add_swept_tube(bm_b, [(0.0, 0.23, 0.0), (0.0, 0.275, 0.0)], 0.132, segs=10, mat_idx=0)
        add_swept_tube(bm_b, [(0.0, 0.45, 0.0), (0.0, 0.495, 0.0)], 0.132, segs=10, mat_idx=0)
        add_swept_tube(bm_b, [(0.0, 0.48, 0.0), (0.0, 0.69, 0.0)], 0.110, segs=10, mat_idx=0)

        for k in range(6):
            ca = (TWO_PI * k) / 6.0
            add_swept_tube(bm_b, [(math.cos(ca) * 0.112, 0.25, math.sin(ca) * 0.112), (math.cos(ca) * 0.112, 0.47, math.sin(ca) * 0.112)], 0.012, segs=5, mat_idx=0)

        add_swept_tube(bm_b, [(0.0, 0.75, -0.025), (0.0, 0.75, 0.045)], 0.105, segs=14, mat_idx=0)
        finalize_mesh_obj("valve_body", bm_b, [mat_bronze, mat_copper_wheel, mat_iron], parent=root)

        bm_sg = bmesh.new()
        add_swept_tube(bm_sg, [(0.0, 0.26, 0.0), (0.0, 0.46, 0.0)], 0.086, segs=12, mat_idx=0)
        add_swept_tube(bm_sg, [(0.0, 0.75, 0.040), (0.0, 0.75, 0.055)], 0.080, segs=12, mat_idx=0)
        finalize_mesh_obj("valve_sight_core", bm_sg, mat_sight_glow, parent=root)

        bm_w = bmesh.new()
        wheel_r = 0.30
        rim_segs = 24
        rim_pts = [(math.cos((TWO_PI * s) / rim_segs) * wheel_r, math.sin((TWO_PI * s) / rim_segs) * wheel_r, 0.0) for s in range(rim_segs + 1)]
        inner_pts = [(math.cos((TWO_PI * s) / rim_segs) * (wheel_r * 0.56), math.sin((TWO_PI * s) / rim_segs) * (wheel_r * 0.56), 0.0) for s in range(rim_segs + 1)]
        add_swept_tube(bm_w, rim_pts, 0.028, segs=8, cap_start=False, cap_end=False, mat_idx=1)
        add_swept_tube(bm_w, inner_pts, 0.016, segs=6, cap_start=False, cap_end=False, mat_idx=0)

        for k in range(6):
            ang = (TWO_PI * k) / 6.0
            cx, sy = math.cos(ang), math.sin(ang)
            add_swept_tube(bm_w, [(0.0, 0.0, 0.0), (cx * wheel_r, sy * wheel_r, 0.0)], 0.018, segs=6, mat_idx=0)
            add_swept_tube(bm_w, [(cx * wheel_r, sy * wheel_r, 0.0), (cx * (wheel_r + 0.075), sy * (wheel_r + 0.075), 0.022)], [0.022, 0.030], segs=7, mat_idx=0)

        add_swept_tube(bm_w, [(0.0, 0.0, -0.07), (0.0, 0.0, 0.055)], 0.064, segs=10, mat_idx=0)
        add_swept_tube(bm_w, [(0.0, 0.0, 0.050), (0.0, 0.0, 0.076)], 0.042, segs=8, mat_idx=2)
        finalize_mesh_obj("valve_wheel", bm_w, [mat_bronze, mat_copper_wheel, mat_sight_glow], pos=(0.0, 0.56, 0.20), parent=root)

        return export_glb_and_inspect(os.path.join(OUT_MODELS_DIR, "pipe_valve.glb"), export_apply=False)

    if os.path.exists(DONE_SENTINEL):
        os.remove(DONE_SENTINEL)
    if os.path.exists(ERR_SENTINEL):
        os.remove(ERR_SENTINEL)

    assets = [
        build_real_staircase_glb(),
        build_mech_elevator_glb(),
        build_hydro_turbine_glb(),
        build_pipe_valve_glb(),
    ]

    # Clean up temporary _tmp_*.png files used for GLB packing
    for fn in os.listdir(OUT_TEXTURES_DIR):
        if fn.startswith("_tmp_") and fn.endswith(".png"):
            try:
                os.remove(os.path.join(OUT_TEXTURES_DIR, fn))
            except OSError:
                pass

    report = {
        "status": "ok",
        "wave": 2,
        "scale": {"COLS": COLS, "TOWER_RADIUS": TOWER_RADIUS, "FLOOR_HEIGHT": FLOOR_HEIGHT},
        "assets": assets,
    }
    with open(DONE_SENTINEL, "w", encoding="utf-8") as f:
        json.dump(report, f, indent=2)


if __name__ == "__main__":
    try:
        if "--bake-textures" in sys.argv:
            run_pbr_texture_baker()
        else:
            run_blender_glb_builder()
    except Exception:
        with open(ERR_SENTINEL, "w", encoding="utf-8") as ef:
            ef.write(traceback.format_exc())
        raise
