"""
TOWERING WATERS: GATEWAY'S DESCENT — Wave 2 Weta/Insomniac Hero Sculpt & PBR Pipeline
=====================================================================================
Upgrades **Gateway** from smooth base blockout to true AAA hero fidelity:
  1. `scipy.spatial.cKDTree` Lloyd-Relaxed Voronoi Dermal Scale Mosaic (`2048x2048 -> 1024x1024`):
     - Large interlocking 5-to-7-sided polygonal scute plates on snout, brows, dorsal spine & tail
     - Fine irregular granular gecko pebble tubercles on cheeks, neck, forearms, shins, hands & feet
     - Soft transverse pleated mother-of-pearl & coral-blush ventral belly gastrosteges
     - Multi-octave curl-warped sea-glass iridescence + organic bioluminescent rosette/wave markings
  2. `Pillow` Supersampled Botanical/Aquatic Fin Venation & Ornate Embossed Pelagian Filigree:
     - Dichotomously-branching 3-order fin-ray venation + marginal ocelli on head-frills & tail leaf
     - Embossed Atlantean/Pelagian gold wave-scrollwork, braided borders, rivets & inlaid rune conduits
     - Multi-layered jewel-striated golden-amber & emerald reptilian iris with collarette & crypts
  3. Enhanced 3D Sculpt Anatomy (`GatewayMesh` bound to 39-Bone `Armature` + 18 NLA Clips):
     - Crisp supraorbital brow crests, 3D raised nostril rims & recessed slits, sculpted labial lip contour
     - Defined clavicle, deltoid, quadriceps & gastrocnemius/Achilles digitigrade musculature
     - 20 sculpted 3D scalloped dorsal hydro-spines running down spine & 7-bone tail + 3D fin-ray ribs
     - Multi-layered 3D beveled Pelagian collar armor, 4-prong Harmonic Water Seed cradle & Hydro-Caster
"""

import os
import sys
import math
import json
import struct
import subprocess
import traceback

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_DIR = os.path.dirname(SCRIPT_DIR)
OUT_MODELS_DIR = os.path.join(PROJECT_DIR, "assets", "models")
OUT_TEXTURES_DIR = os.path.join(PROJECT_DIR, "assets", "textures")
DONE_JSON_PATH = os.path.join(OUT_MODELS_DIR, "_gateway_build_done.json")
PROOF_RENDER_PATH = r"C:\Users\mshaf\.gemini\antigravity\brain\7ce01634-b178-4665-b637-a4e88d2cbed3\scratch\gateway_wave2_blender_proof.png"
PY312_EXE = r"C:\Users\mshaf\AppData\Local\Programs\Python\Python312\python.exe"

os.makedirs(OUT_MODELS_DIR, exist_ok=True)
os.makedirs(OUT_TEXTURES_DIR, exist_ok=True)


# ==============================================================================
# PART A: SCIPY + PILLOW 2048->1024 WETA/SUBSTANCE PBR TEXTURE SYNTHESIS
# ==============================================================================

def generate_weta_pbr_textures_py312(out_size=1024):
    import numpy as np
    from scipy.spatial import cKDTree
    from scipy.ndimage import gaussian_filter, sobel, distance_transform_edt
    from PIL import Image, ImageDraw

    SS = out_size * 2  # 2048x2048 supersampled synthesis -> Lanczos 1024x1024!
    rng = np.random.default_rng(20261118)

    def hex_f(h):
        h = h.lstrip("#")
        return np.array([int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16)], dtype=np.float32) / 255.0

    def sstep(e0, e1, x):
        t = np.clip((x - e0) / np.maximum(1e-8, e1 - e0), 0.0, 1.0)
        return t * t * (3.0 - 2.0 * t)

    def fbm_field(shape, scales, weights, seed_offset=0):
        acc = np.zeros(shape, dtype=np.float32)
        r_loc = np.random.default_rng(918273 + seed_offset)
        for sc, wt in zip(scales, weights):
            gh = max(4, shape[0] // sc)
            gw = max(4, shape[1] // sc)
            coarse = r_loc.random((gh, gw), dtype=np.float32)
            up = np.array(
                Image.fromarray((coarse * 255).astype(np.uint8)).resize((shape[1], shape[0]), Image.Resampling.BICUBIC),
                dtype=np.float32,
            ) / 255.0
            acc += up * wt
        return acc

    alb = np.zeros((SS, SS, 3), dtype=np.float32)
    emi = np.zeros((SS, SS, 3), dtype=np.float32)
    rough = np.full((SS, SS), 0.40, dtype=np.float32)
    metal = np.zeros((SS, SS), dtype=np.float32)
    ao = np.ones((SS, SS), dtype=np.float32)
    height = np.zeros((SS, SS), dtype=np.float32)

    # Note: Image row 0 = TOP (`v_blender = 1.0`), row SS-1 = BOTTOM (`v_blender = 0.0`)!
    # Wait: when Blender loads an image file from disk (`bpy.data.images.load`), row 0 of PNG
    # is TOP (`v_blender = 1.0`)! Let's use `vb = 1.0 - y / (SS - 1)` so PNG matches Blender UVs 1:1!
    ys_vb = np.linspace(1.0, 0.0, SS, dtype=np.float32)
    xs_ub = np.linspace(0.0, 1.0, SS, dtype=np.float32)
    UB, VB = np.meshgrid(xs_ub, ys_vb)

    # ==========================================================================
    # 1. `Q_SKIN` (`UB <= 0.705, VB <= 0.765`): LLOYD-VORONOI REPTILIAN MOSAIC
    # ==========================================================================
    sh_y = int(round(SS * (1.0 - 0.0))) - int(round(SS * (1.0 - 0.765)))
    y0_s = int(round(SS * (1.0 - 0.765)))
    x1_s = int(round(SS * 0.705))
    H_s, W_s = SS - y0_s, x1_s

    su = (UB[y0_s:, :x1_s] - 0.02) / 0.66
    sv = (VB[y0_s:, :x1_s] - 0.02) / 0.72
    front_dist = np.abs(np.clip(su, 0.0, 1.0) - 0.5) * 2.0

    # Multi-octave organic curl/mottle fields
    mottle1 = fbm_field((H_s, W_s), [220, 96, 42, 18], [0.45, 0.28, 0.17, 0.10], 11)
    mottle2 = fbm_field((H_s, W_s), [160, 68, 28], [0.52, 0.32, 0.16], 29)
    warp_u = (fbm_field((H_s, W_s), [110, 48], [0.65, 0.35], 47) - 0.5) * 0.028
    warp_v = (fbm_field((H_s, W_s), [110, 48], [0.65, 0.35], 63) - 0.5) * 0.028

    # Build Lloyd-relaxed Voronoi seeds for:
    #   (A) Large polygonal armor scutes (~1,850 plates across snout, brows, dorsal spine & tail)
    #   (B) Fine irregular gecko pebble tubercles (~13,500 granules across cheeks, neck & limbs)
    def _voronoi_scales(n_seeds, aspect_v=1.22, relax_iters=2, seed_val=101):
        r_v = np.random.default_rng(seed_val)
        pts = np.column_stack([r_v.uniform(-0.06, 1.06, n_seeds), r_v.uniform(-0.06, aspect_v + 0.06, n_seeds)])
        # Quick grid-based Lloyd centroid relaxation for realistic biological hexagonal/pentagonal packing!
        g_res = 240
        gx, gy = np.meshgrid(np.linspace(-0.04, 1.04, g_res), np.linspace(-0.04, aspect_v + 0.04, g_res))
        g_pts = np.column_stack([gx.ravel(), gy.ravel()])
        for _ in range(relax_iters):
            tree_r = cKDTree(pts)
            _, own = tree_r.query(g_pts, k=1)
            counts = np.bincount(own, minlength=n_seeds).astype(np.float32)
            sx = np.bincount(own, weights=g_pts[:, 0], minlength=n_seeds)
            sy = np.bincount(own, weights=g_pts[:, 1], minlength=n_seeds)
            valid = counts > 0
            pts[valid, 0] = sx[valid] / counts[valid]
            pts[valid, 1] = sy[valid] / counts[valid]

        tree = cKDTree(pts)
        q_pts = np.column_stack([(su + warp_u).ravel(), ((sv + warp_v) * aspect_v).ravel()])
        dists, idxs = tree.query(q_pts, k=2, workers=-1)
        d1 = dists[:, 0].reshape(H_s, W_s).astype(np.float32)
        d2 = dists[:, 1].reshape(H_s, W_s).astype(np.float32)
        c_id = idxs[:, 0].reshape(H_s, W_s)

        avg_spacing = math.sqrt((1.12 * (aspect_v + 0.12)) / n_seeds)
        bevel_raw = (d2 - d1) / (avg_spacing * 0.55)
        plate_dome = sstep(0.06, 0.48, bevel_raw) * (1.0 - 0.18 * np.clip(d1 / (avg_spacing * 0.65), 0.0, 1.0) ** 2)
        crevice = 1.0 - sstep(0.03, 0.24, bevel_raw)
        cell_rand = r_v.random(n_seeds, dtype=np.float32)[c_id]
        cell_ang = (r_v.random(n_seeds, dtype=np.float32)[c_id] - 0.5) * 0.9
        return plate_dome, crevice, cell_rand, cell_ang

    scute_dome, scute_crev, scute_var, scute_ang = _voronoi_scales(1850, aspect_v=1.28, relax_iters=2, seed_val=307)
    pebb_dome, pebb_crev, pebb_var, _ = _voronoi_scales(13500, aspect_v=1.28, relax_iters=1, seed_val=709)

    # Micro-keratin longitudinal striations inside large dorsal/snout scute plates!
    keratin_stripes = 0.5 + 0.5 * np.sin((su * np.cos(scute_ang) + sv * np.sin(scute_ang)) * 950.0 + mottle2 * 6.0)
    scute_dome = np.clip(scute_dome + (keratin_stripes - 0.5) * 0.08 * scute_dome, 0.0, 1.0)

    # Anatomical scale-type mask:
    #   - Large polygonal scutes on dorsal spine (`front_dist > 0.52`), tail (`sv < 0.38`), & snout/brow (`sv > 0.85, front_dist < 0.35`)
    #   - Fine granular gecko pebbles on cheeks, neck, flanks & limbs
    #   - Soft transverse pleated gastrostege shields on throat & belly (`front_dist < 0.31, 0.12 < sv < 0.84`)
    large_scute_mask = np.clip(
        sstep(0.46, 0.72, front_dist)
        + (1.0 - sstep(0.26, 0.42, sv)) * sstep(0.24, 0.48, front_dist) * 0.85
        + sstep(0.855, 0.91, sv) * (1.0 - sstep(0.22, 0.42, front_dist)) * 0.90,
        0.0,
        1.0,
    )
    belly_v_zone = sstep(0.11, 0.21, sv) * (1.0 - sstep(0.80, 0.855, sv))
    noisy_front = front_dist + (mottle1 - 0.5) * 0.065
    belly_mask = belly_v_zone * (1.0 - sstep(0.18, 0.33, noisy_front))
    coral_flank_mask = belly_v_zone * (1.0 - sstep(0.26, 0.44, noisy_front)) * (1.0 - belly_mask * 0.65)

    # Soft curved ventral gastrostege pleats (`~34` gentle overlapping shields with organic warp!)
    pleat_coord = (sv + warp_v * 0.35 + 0.018 * (front_dist ** 2)) * 36.0
    pleat_f = pleat_coord - np.floor(pleat_coord)
    belly_pleat_dome = sstep(0.04, 0.22, pleat_f) * (1.0 - 0.22 * pleat_f)
    belly_pleat_crev = 1.0 - sstep(0.02, 0.14, pleat_f)
    fine_skin_grain = fbm_field((H_s, W_s), [8, 4], [0.6, 0.4], 88)

    eff_dome = (scute_dome * large_scute_mask + pebb_dome * (1.0 - large_scute_mask)) * (1.0 - belly_mask) + belly_pleat_dome * belly_mask
    eff_crev = (scute_crev * large_scute_mask + pebb_crev * (1.0 - large_scute_mask) * 0.78) * (1.0 - belly_mask) + belly_pleat_crev * belly_mask * 0.42
    eff_var  = (scute_var * large_scute_mask + pebb_var * (1.0 - large_scute_mask)) * (1.0 - belly_mask * 0.82)

    # Rich Weta/Abzû Iridescent Color Palette
    c_abyss_spine = hex_f("#074454")
    c_sea_teal    = hex_f("#13a8a2")
    c_jade_mottle = hex_f("#0d8478")
    c_aqua_glow   = hex_f("#45efe0")
    c_violet_irid = hex_f("#818cf8")
    c_gold_fleck  = hex_f("#fde68a")
    c_coral_edge  = hex_f("#f79d94")
    c_pearl_belly = hex_f("#fff4ed")
    c_mouth_dark  = hex_f("#062a33")
    c_biolume     = hex_f("#5efce8")

    dorsal_w = sstep(0.45, 0.94, front_dist)
    flank_w = np.exp(-((front_dist - 0.40) ** 2) / 0.055)
    irid_w = sstep(0.48, 0.95, sv) * np.exp(-((front_dist - 0.34) ** 2) / 0.075) * sstep(0.35, 0.75, mottle2)

    s_col = c_sea_teal[None, None, :] * (1.0 - dorsal_w[:, :, None] * 0.58) + c_abyss_spine[None, None, :] * (dorsal_w[:, :, None] * 0.58)
    # Natural mottled sea-dapple patches!
    jade_patch = sstep(0.38, 0.72, mottle1) * 0.42
    s_col = s_col * (1.0 - jade_patch[:, :, None]) + c_jade_mottle[None, None, :] * jade_patch[:, :, None]
    s_col = s_col * (1.0 - flank_w[:, :, None] * 0.48) + c_aqua_glow[None, None, :] * (flank_w[:, :, None] * 0.48)
    s_col = s_col * (1.0 - irid_w[:, :, None] * 0.32) + c_violet_irid[None, None, :] * (irid_w[:, :, None] * 0.32)

    # Scattered golden-turquoise mineral flecks on scattered dorsal scales (`eff_var > 0.88`)
    fleck_w = sstep(0.87, 0.96, eff_var) * (1.0 - belly_mask) * 0.35
    s_col = s_col * (1.0 - fleck_w[:, :, None]) + c_gold_fleck[None, None, :] * fleck_w[:, :, None]

    # Blend coral-rose subsurface transition & pleated mother-of-pearl belly
    s_col = s_col * (1.0 - coral_flank_mask[:, :, None] * 0.72) + c_coral_edge[None, None, :] * (coral_flank_mask[:, :, None] * 0.72)
    s_col = s_col * (1.0 - belly_mask[:, :, None] * 0.93) + c_pearl_belly[None, None, :] * (belly_mask[:, :, None] * 0.93)

    # Cheek warmth + sculpted smile crease & teardrop nostrils
    cheek_w = np.exp(-(((front_dist - 0.22) / 0.11) ** 2 + ((sv - 0.855) / 0.032) ** 2))
    s_col = s_col * (1.0 - cheek_w[:, :, None] * 0.42) + c_coral_edge[None, None, :] * (cheek_w[:, :, None] * 0.42)

    du_f = np.abs(su - 0.5)
    mouth_cv = 0.838 + 0.022 * ((np.minimum(0.20, du_f) / 0.18) ** 1.55)
    mouth_ao = (1.0 - sstep(0.001, 0.0048, np.abs(sv - mouth_cv))) * (1.0 - sstep(0.13, 0.175, du_f))
    nost_ao = np.zeros((H_s, W_s), dtype=np.float32)
    for sgn in (-1.0, 1.0):
        nd = ((su - (0.5 + sgn * 0.026)) / 0.0052) ** 2 + ((sv - 0.878) / 0.0072) ** 2
        nost_ao = np.maximum(nost_ao, 1.0 - sstep(0.22, 1.0, nd))
    feat_ao = np.clip(mouth_ao * 0.82 + nost_ao * 0.88, 0.0, 1.0)
    s_col = s_col * (1.0 - feat_ao[:, :, None]) + c_mouth_dark[None, None, :] * feat_ao[:, :, None]

    # Scale crown bevel highlight + organic crevice shadow + individual scale hue/value variance
    scale_light = 0.90 + 0.15 * eff_dome + 0.10 * (eff_var - 0.5) - 0.18 * eff_crev + 0.04 * (fine_skin_grain - 0.5)
    s_col = np.clip(s_col * scale_light[:, :, None], 0.0, 1.0)

    # Organic Pelagian Bioluminescent Markings (drawn via Pillow Bezier curves & crescent rosettes!)
    bio_img = Image.new("L", (W_s, H_s), 0)
    b_draw = ImageDraw.Draw(bio_img)
    for side_sgn in (-1, 1):
        # Sweeping sinuous Pelagian flank ribbons & crescent ocelli along neck -> ribs -> thighs -> tail!
        for k_mark in range(14):
            t_m = 0.08 + k_mark * 0.052
            fd_base = 0.44 + 0.06 * math.sin(k_mark * 0.85)
            su_c = 0.5 + side_sgn * (fd_base * 0.5)
            px_c = int((su_c * 0.66 + 0.02) / 0.705 * W_s)
            py_c = int((1.0 - (t_m * 0.72 + 0.02) / 0.765) * H_s)
            rx_m = int(W_s * (0.011 + 0.004 * math.sin(k_mark)))
            ry_m = int(H_s * 0.014)
            b_draw.arc([px_c - rx_m, py_c - ry_m, px_c + rx_m, py_c + ry_m], start=20, end=215, fill=235, width=max(3, SS // 280))
            b_draw.ellipse([px_c - rx_m // 3, py_c - ry_m // 3, px_c + rx_m // 3, py_c + ry_m // 3], fill=255)
        # 3 delicate glowing sub-orbital cheek constellation teardrops
        for cd_i, (fd_d, sv_d, rad_d) in enumerate([(0.28, 0.862, 6), (0.33, 0.871, 5), (0.38, 0.882, 4)]):
            su_d = 0.5 + side_sgn * (fd_d * 0.5)
            px_d = int((su_d * 0.66 + 0.02) / 0.705 * W_s)
            py_d = int((1.0 - (sv_d * 0.72 + 0.02) / 0.765) * H_s)
            b_draw.ellipse([px_d - rad_d, py_d - rad_d, px_d + rad_d, py_d + rad_d], fill=255)

    bio_arr = gaussian_filter(np.array(bio_img, dtype=np.float32) / 255.0, sigma=2.2)
    # Modulate bioluminescence by individual scale domes so individual scales glow like living gems!
    bio_scales = np.clip(bio_arr * (0.55 + 0.75 * eff_dome) * (1.0 - eff_crev * 0.7), 0.0, 1.0)

    s_col = np.clip(s_col + c_biolume[None, None, :] * (bio_scales[:, :, None] * 0.62), 0.0, 1.0)
    alb[y0_s:, :x1_s] = s_col
    emi[y0_s:, :x1_s] = c_biolume[None, None, :] * (bio_scales[:, :, None] * 0.95)
    rough[y0_s:, :x1_s] = np.clip(0.30 + 0.30 * eff_crev + 0.08 * belly_mask - 0.06 * eff_dome, 0.22, 0.66)
    metal[y0_s:, :x1_s] = 0.10 * flank_w + 0.06 * irid_w + 0.05 * fleck_w
    ao[y0_s:, :x1_s] = np.clip(1.0 - 0.34 * eff_crev - 0.50 * feat_ao, 0.32, 1.0)
    height[y0_s:, :x1_s] = 0.62 * eff_dome - 0.42 * eff_crev - 0.65 * feat_ao + 0.16 * bio_scales

    # ==========================================================================
    # 2. `Q_FRILL` (`UB > 0.705, VB <= 0.70`): BRANCHING VEINED FIN MEMBRANES
    # ==========================================================================
    y0_f = int(round(SS * (1.0 - 0.70)))
    x0_f = x1_s
    H_f, W_f = SS - y0_f, SS - x0_f
    fu = np.clip((UB[y0_f:, x0_f:] - 0.72) / 0.26, 0.0, 1.0)
    fv = np.clip((VB[y0_f:, x0_f:] - 0.04) / 0.64, 0.0, 1.0)

    vein_img = Image.new("L", (W_f, H_f), 0)
    v_draw = ImageDraw.Draw(vein_img)

    # Draw 9 cartilaginous primary fin-rays + dichotomous 2nd & 3rd order capillary venation!
    r_vein = np.random.default_rng(4455)
    for ir in range(9):
        v_base = 0.06 + (0.88 * ir) / 8.0
        pts_main = []
        for st in range(12):
            t = st / 11.0
            u_pt = t
            v_pt = v_base + 0.022 * math.sin(t * 4.2 + ir * 0.7)
            px = int((0.05 + u_pt * 0.90) * W_f)
            py = int((1.0 - (0.04 + v_pt * 0.92)) * H_f)
            pts_main.append((px, py, u_pt, v_pt))
        for st in range(len(pts_main) - 1):
            w_ray = max(2, int((1.0 - st / 12.0) * (SS / 165.0)))
            v_draw.line([pts_main[st][:2], pts_main[st + 1][:2]], fill=245, width=w_ray)
            # Dichotomous secondary & tertiary capillary vein branches!
            if 2 <= st <= 9:
                for b_sgn in (-1, 1):
                    bx0, by0, bu0, bv0 = pts_main[st]
                    bu1 = min(0.98, bu0 + 0.14 + r_vein.uniform(-0.02, 0.03))
                    bv1 = bv0 + b_sgn * (0.038 + r_vein.uniform(0.0, 0.02))
                    bx1 = int((0.05 + bu1 * 0.90) * W_f)
                    by1 = int((1.0 - (0.04 + bv1 * 0.92)) * H_f)
                    v_draw.line([(bx0, by0), (bx1, by1)], fill=175, width=max(1, SS // 520))
                    # Tertiary fine capillaries
                    for t_sgn in (-1, 1):
                        bu2 = min(0.99, bu1 + 0.08)
                        bv2 = bv1 + t_sgn * 0.018
                        bx2 = int((0.05 + bu2 * 0.90) * W_f)
                        by2 = int((1.0 - (0.04 + bv2 * 0.92)) * H_f)
                        v_draw.line([(bx1, by1), (bx2, by2)], fill=115, width=1)

    vein_sharp = np.array(vein_img, dtype=np.float32) / 255.0
    vein_soft = gaussian_filter(vein_sharp, sigma=2.5)
    vein_field = np.clip(0.65 * vein_sharp + 0.55 * vein_soft, 0.0, 1.0)
    mem_mottle = fbm_field((H_f, W_f), [64, 24], [0.65, 0.35], 91)

    c_f_root  = hex_f("#0d9488")
    c_f_aqua  = hex_f("#5efce8")
    c_f_coral = hex_f("#fb7185")
    c_f_vein  = hex_f("#fef3c7")

    f_col = (
        c_f_root[None, None, :] * (1.0 - sstep(0.04, 0.48, fu))[:, :, None]
        + c_f_aqua[None, None, :] * (sstep(0.04, 0.48, fu) * (1.0 - sstep(0.44, 0.85, fu)))[:, :, None]
        + c_f_coral[None, None, :] * sstep(0.44, 0.85, fu)[:, :, None]
    )
    f_col *= (0.88 + 0.22 * mem_mottle[:, :, None])
    f_col = f_col * (1.0 - vein_field[:, :, None] * 0.55) + c_f_vein[None, None, :] * (vein_field[:, :, None] * 0.55)

    # Bioluminescent marginal ocelli spots nestled between the fin rays!
    ocelli = np.zeros((H_f, W_f), dtype=np.float32)
    for ir in range(8):
        vc_o = 0.06 + (0.88 * (ir + 0.5)) / 8.0
        do = np.sqrt(((fu - 0.78) / 0.045) ** 2 + ((fv - vc_o) / 0.024) ** 2)
        ocelli = np.maximum(ocelli, 1.0 - sstep(0.35, 1.0, do))
    f_col = np.clip(f_col + c_f_aqua[None, None, :] * (ocelli[:, :, None] * 0.65), 0.0, 1.0)

    alb[y0_f:, x0_f:] = f_col
    emi[y0_f:, x0_f:] = np.clip(
        c_f_aqua[None, None, :] * ((vein_field * 0.52 + ocelli * 0.95)[:, :, None])
        + c_f_coral[None, None, :] * (sstep(0.70, 0.96, fu)[:, :, None] * 0.38),
        0.0,
        1.0,
    )
    rough[y0_f:, x0_f:] = np.clip(0.18 + 0.16 * (1.0 - vein_field), 0.14, 0.36)
    metal[y0_f:, x0_f:] = 0.15 * vein_field
    ao[y0_f:, x0_f:] = np.clip(0.86 + 0.14 * vein_field, 0.75, 1.0)
    height[y0_f:, x0_f:] = 0.58 * vein_field + 0.22 * ocelli

    # ==========================================================================
    # 3. `Q_EYE` (`UB > 0.705, VB > 0.70`): JEWEL-STRIATED REPTILIAN IRIS
    # ==========================================================================
    H_e, W_e = y0_f, SS - x0_f
    ex = (UB[:y0_f, x0_f:] - 0.85) / 0.125
    ey = (VB[:y0_f, x0_f:] - 0.85) / 0.125
    er = np.sqrt(ex * ex + ey * ey)
    eang = np.arctan2(ey, ex)

    # Scalloped vertical-almond dragon-gecko pupil + golden collarette ring + multi-layer stromal crypts!
    pupil_d = np.sqrt((ex / (0.26 + 0.012 * np.cos(eang * 8.0))) ** 2 + (ey / 0.42) ** 2)
    pupil_m = 1.0 - sstep(0.88, 1.02, pupil_d)
    iris_m = (1.0 - pupil_m) * (1.0 - sstep(0.75, 0.82, er))
    limbal = np.exp(-(((er - 0.77) / 0.048) ** 2)) * (1.0 - pupil_m)

    f1 = 0.5 + 0.5 * np.sin(eang * 52.0 + np.sin(er * 26.0) * 0.65)
    f2 = 0.5 + 0.5 * np.cos(eang * 118.0 - er * 18.0)
    crypts = sstep(0.62, 0.88, _np_hash_polar := (0.5 + 0.5 * np.sin(eang * 23.0 + 1.7) * np.cos(er * 21.0)))
    collarette = np.exp(-(((pupil_d - 1.28 + 0.08 * np.sin(eang * 18.0)) / 0.16) ** 2)) * iris_m

    iris_t = np.clip((er - 0.22) / 0.54, 0.0, 1.0)
    c_i_gold  = hex_f("#fde047")
    c_i_amber = hex_f("#f59e0b")
    c_i_emrld = hex_f("#10b981")
    c_i_teal  = hex_f("#047857")
    c_i_deep  = hex_f("#022c22")
    c_sclera  = hex_f("#f8f4ed")
    c_scl_shd = hex_f("#cbbfb2")

    i_col = (
        c_i_amber[None, None, :] * (1.0 - sstep(0.0, 0.36, iris_t))[:, :, None]
        + c_i_emrld[None, None, :] * (sstep(0.0, 0.36, iris_t) * (1.0 - sstep(0.42, 0.88, iris_t)))[:, :, None]
        + c_i_teal[None, None, :] * sstep(0.42, 0.88, iris_t)[:, :, None]
    )
    stroma = 0.68 + 0.38 * f1 + 0.22 * f2 - 0.32 * crypts
    i_col = np.clip(i_col * stroma[:, :, None] + c_i_gold[None, None, :] * (collarette[:, :, None] * 0.68), 0.0, 1.0)
    i_col = i_col * (1.0 - crypts[:, :, None] * 0.35) + c_i_deep[None, None, :] * (crypts[:, :, None] * 0.35)

    # Subtle upper-eyelid ambient shadow + delicate scleral micro-veins
    upper_shd = sstep(0.18, 0.72, ey) * 0.18
    scl_col = (c_sclera[None, None, :] * (1.0 - sstep(0.78, 1.05, er))[:, :, None] + c_scl_shd[None, None, :] * sstep(0.78, 1.05, er)[:, :, None]) * (1.0 - upper_shd[:, :, None])

    e_col = scl_col * (1.0 - iris_m[:, :, None]) + i_col * iris_m[:, :, None]
    e_col = e_col * (1.0 - limbal[:, :, None] * 0.88) + hex_f("#020617")[None, None, :] * (limbal[:, :, None] * 0.88)
    e_col = e_col * (1.0 - pupil_m[:, :, None]) + hex_f("#02040a")[None, None, :] * pupil_m[:, :, None]

    # Dual studio window softbox catchlight + pinpoint secondary glint!
    cl1 = 1.0 - sstep(0.075, 0.105, np.sqrt(((ex + 0.22) * 0.92) ** 2 + ((ey - 0.24) * 1.12) ** 2))
    cl2 = 1.0 - sstep(0.032, 0.050, np.sqrt((ex - 0.19) ** 2 + (ey + 0.18) ** 2))
    catch = np.clip(cl1 + cl2 * 0.92, 0.0, 1.0)
    e_col = np.clip(e_col * (1.0 - catch[:, :, None]) + catch[:, :, None], 0.0, 1.0)

    alb[:y0_f, x0_f:] = e_col
    emi[:y0_f, x0_f:] = np.clip(
        c_i_gold[None, None, :] * (collarette[:, :, None] * 0.58)
        + c_i_emrld[None, None, :] * (iris_m[:, :, None] * f1[:, :, None] * 0.30)
        + catch[:, :, None] * 0.98,
        0.0,
        1.0,
    )
    rough[:y0_f, x0_f:] = 0.035
    metal[:y0_f, x0_f:] = 0.02

    # ==========================================================================
    # 4. `Q_GEAR` (`UB <= 0.705, VB > 0.765`): EMBOSSED PELAGIAN GOLD FILIGREE
    # ==========================================================================
    H_g, W_g = y0_s, x1_s
    gu = np.clip((UB[:y0_s, :x1_s] - 0.02) / 0.66, 0.0, 1.0)
    gv = np.clip((VB[:y0_s, :x1_s] - 0.78) / 0.20, 0.0, 1.0)

    # Draw ornate Pelagian Art-Nouveau wave-scrollwork, lotus medallions, rivets & hydro-rune inlays!
    fil_img = Image.new("L", (W_g, H_g), 0)
    rune_img = Image.new("L", (W_g, H_g), 0)
    f_draw = ImageDraw.Draw(fil_img)
    r_draw = ImageDraw.Draw(rune_img)

    # Band 0 (`gv in 0.00..0.36`, bottom of Q_GEAR -> rows `int(0.64*H_g)..H_g`): Pearlescent Ceramic + Gold Inlay + Glowing Runes!
    # Band 1 (`gv in 0.36..0.68`, mid of Q_GEAR -> rows `int(0.32*H_g)..int(0.64*H_g)`): Embossed Gold Scrollwork!
    # Band 2 (`gv in 0.68..1.00`, top of Q_GEAR -> rows `0..int(0.32*H_g)`): Faceted Harmonic Water Seed Crystal!
    y_b2 = int(0.32 * H_g)
    y_b1 = int(0.64 * H_g)

    # Braided gold borders & wave-volute scrollwork in Band 1 (`y_b2 .. y_b1`)
    f_draw.rectangle([0, y_b2 + 4, W_g, y_b2 + 12], fill=235)
    f_draw.rectangle([0, y_b1 - 12, W_g, y_b1 - 4], fill=235)
    n_scrolls = 12
    sw_step = W_g // n_scrolls
    for sc_i in range(n_scrolls + 1):
        cx_sc = sc_i * sw_step
        cy_sc = (y_b2 + y_b1) // 2
        rad_s = int((y_b1 - y_b2) * 0.34)
        f_draw.arc([cx_sc - rad_s, cy_sc - rad_s, cx_sc + rad_s, cy_sc + rad_s], 0, 290, fill=250, width=max(3, SS // 340))
        f_draw.arc([cx_sc - rad_s // 2, cy_sc - rad_s // 2, cx_sc + rad_s // 2, cy_sc + rad_s // 2], 120, 360, fill=230, width=max(2, SS // 450))
        f_draw.ellipse([cx_sc - 5, cy_sc - 5, cx_sc + 5, cy_sc + 5], fill=255)
        # Rivet studs along borders
        f_draw.ellipse([cx_sc - 4, y_b2 + 15, cx_sc + 4, y_b2 + 23], fill=255)
        f_draw.ellipse([cx_sc - 4, y_b1 - 23, cx_sc + 4, y_b1 - 15], fill=255)

    # Inlaid Pelagian lotus panels & glowing aqua rune conduits in Ceramic Band 0 (`y_b1 .. H_g`)
    for sc_i in range(10):
        x0_p = int(sc_i * (W_g / 10.0)) + 8
        x1_p = int((sc_i + 1) * (W_g / 10.0)) - 8
        y0_p = y_b1 + 10
        y1_p = H_g - 10
        f_draw.rounded_rectangle([x0_p, y0_p, x1_p, y1_p], radius=14, outline=220, width=max(2, SS // 440))
        mx_p, my_p = (x0_p + x1_p) // 2, (y0_p + y1_p) // 2
        r_draw.line([(x0_p + 18, my_p), (x1_p - 18, my_p)], fill=245, width=max(2, SS // 420))
        r_draw.ellipse([mx_p - 10, my_p - 10, mx_p + 10, my_p + 10], outline=255, width=max(2, SS // 480))

    fil_bevel = gaussian_filter(np.array(fil_img, dtype=np.float32) / 255.0, sigma=1.6)
    rune_glow = gaussian_filter(np.array(rune_img, dtype=np.float32) / 255.0, sigma=1.8)
    hammered = fbm_field((H_g, W_g), [36, 16, 8], [0.5, 0.3, 0.2], 123)

    # Voronoi-faceted crystal caustics for Harmonic Water Seed (`Band 2`)
    c_tree = cKDTree(rng.uniform(0.0, 1.0, (95, 2)))
    c_q = np.column_stack([gu.ravel(), gv.ravel()])
    cd, _ = c_tree.query(c_q, k=2, workers=-1)
    crystal_edge = 1.0 - sstep(0.004, 0.026, (cd[:, 1] - cd[:, 0]).reshape(H_g, W_g).astype(np.float32))

    c_pearl_cer = hex_f("#eef9fb")
    c_gold_rich = hex_f("#e6b656")
    c_gold_hi   = hex_f("#fef08a")
    c_gold_ao   = hex_f("#784b12")
    c_seed_deep = hex_f("#0891b2")
    c_seed_cyan = hex_f("#67e8f9")
    c_seed_core = hex_f("#ecfeff")

    is_cer = gv < 0.36
    is_gld = (gv >= 0.36) & (gv < 0.68)
    is_sed = gv >= 0.68

    g_col = np.zeros((H_g, W_g, 3), dtype=np.float32)
    cer_c = c_pearl_cer[None, None, :] * (0.93 + 0.10 * hammered[:, :, None])
    cer_c = cer_c * (1.0 - fil_bevel[:, :, None] * 0.85) + c_gold_rich[None, None, :] * (fil_bevel[:, :, None] * 0.85)
    cer_c = np.clip(cer_c + c_seed_cyan[None, None, :] * (rune_glow[:, :, None] * 0.72), 0.0, 1.0)

    gld_c = c_gold_rich[None, None, :] * (0.84 + 0.20 * hammered[:, :, None])
    gld_c = gld_c * (1.0 - fil_bevel[:, :, None] * 0.55) + c_gold_hi[None, None, :] * (fil_bevel[:, :, None] * 0.55)
    gld_crev = np.clip((1.0 - fil_bevel) * 0.25, 0.0, 1.0)
    gld_c = gld_c * (1.0 - gld_crev[:, :, None]) + c_gold_ao[None, None, :] * gld_crev[:, :, None]

    sed_c = (
        c_seed_deep[None, None, :] * (1.0 - hammered[:, :, None] * 0.65)
        + c_seed_cyan[None, None, :] * (hammered[:, :, None] * 0.65)
    )
    sed_c = np.clip(sed_c + c_seed_core[None, None, :] * (crystal_edge[:, :, None] * 0.85), 0.0, 1.0)

    g_col[is_cer] = cer_c[is_cer]
    g_col[is_gld] = gld_c[is_gld]
    g_col[is_sed] = sed_c[is_sed]

    alb[:y0_s, :x1_s] = g_col
    emi_g = np.zeros_like(g_col)
    emi_g[is_cer] = (c_seed_cyan[None, None, :] * (rune_glow[:, :, None] * 0.85))[is_cer]
    emi_g[is_sed] = (c_seed_cyan[None, None, :] * (0.72 + 0.55 * crystal_edge[:, :, None]))[is_sed]
    emi[:y0_s, :x1_s] = np.clip(emi_g, 0.0, 1.0)

    r_g = np.full((H_g, W_g), 0.22, dtype=np.float32)
    m_g = np.full((H_g, W_g), 0.18, dtype=np.float32)
    r_g[is_cer] = (0.24 - 0.08 * fil_bevel)[is_cer]
    m_g[is_cer] = np.clip(0.14 + 0.74 * fil_bevel, 0.14, 0.88)[is_cer]
    r_g[is_gld] = np.clip(0.24 - 0.10 * fil_bevel + 0.06 * (1.0 - hammered), 0.14, 0.34)[is_gld]
    m_g[is_gld] = 0.90
    r_g[is_sed] = 0.06
    m_g[is_sed] = 0.08

    rough[:y0_s, :x1_s] = r_g
    metal[:y0_s, :x1_s] = m_g
    ao[:y0_s, :x1_s] = np.clip(0.78 + 0.22 * fil_bevel, 0.72, 1.0)
    height[:y0_s, :x1_s] = np.where(is_sed, crystal_edge * 0.42, fil_bevel * 0.65 - rune_glow * 0.35 + hammered * 0.08)

    # ==========================================================================
    # 5. SOBEL TANGENT-SPACE NORMAL MAP (`2048x2048 -> 1024x1024` LANCZOS!)
    # ==========================================================================
    # Note: in PNG top-down coords, `+y` is DOWN (`-V_blender`), so `ny = +sobel_y` points `+V_blender` UP!
    gx_h = sobel(height, axis=1, mode="wrap") * 0.95
    gy_h = sobel(height, axis=0, mode="wrap") * 0.95
    nx = -gx_h
    ny = gy_h
    nz = np.ones_like(nx)
    inv_n = 1.0 / np.sqrt(nx * nx + ny * ny + nz * nz)
    nrm = np.stack([0.5 + 0.5 * nx * inv_n, 0.5 + 0.5 * ny * inv_n, 0.5 + 0.5 * nz * inv_n], axis=-1)
    orm = np.stack([ao, rough, metal], axis=-1)

    def _save_downsampled(arr_f32, fname):
        u8 = np.clip(np.round(arr_f32 * 255.0), 0, 255).astype(np.uint8)
        im = Image.fromarray(u8, mode="RGB").resize((out_size, out_size), Image.Resampling.LANCZOS)
        p = os.path.join(OUT_TEXTURES_DIR, fname)
        im.save(p, format="PNG", optimize=True)
        return p

    return [
        _save_downsampled(alb, "gateway_albedo.png"),
        _save_downsampled(nrm, "gateway_normal.png"),
        _save_downsampled(orm, "gateway_orm.png"),
        _save_downsampled(emi, "gateway_emissive.png"),
    ]


# ==============================================================================
# PART B: BLENDER 5.3 ANATOMICAL HERO SCULPT, 39-BONE RIG & 18 NLA ANIMATIONS
# ==============================================================================

def run_blender_pipeline():
    import bpy
    import bmesh
    from mathutils import Vector
    import numpy as np

    # First invoke Python 3.12 (`scipy` + `Pillow`) to synthesize crisp 2048->1024 PBR maps!
    subprocess.run([PY312_EXE, os.path.abspath(__file__), "--textures-only"], check=True)

    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.unit_settings.system = "METRIC"
    scene.unit_settings.scale_length = 1.0
    scene.render.fps = 24

    def v3(tx, ty, tz):
        return Vector((float(tx), -float(tz), float(ty)))

    def b2t(bvec):
        return (float(bvec.x), float(bvec.z), -float(bvec.y))

    def clamp01(x):
        return 0.0 if x <= 0.0 else (1.0 if x >= 1.0 else float(x))

    # Load synthesized 1K PBR textures & pack into `.blend`/`.glb`
    def _load_tex(fname, is_srgb):
        p = os.path.join(OUT_TEXTURES_DIR, fname)
        img = bpy.data.images.load(p)
        img.colorspace_settings.name = "sRGB" if is_srgb else "Non-Color"
        img.pack()
        return img

    alb_img = _load_tex("gateway_albedo.png", True)
    nrm_img = _load_tex("gateway_normal.png", False)
    orm_img = _load_tex("gateway_orm.png", False)
    emi_img = _load_tex("gateway_emissive.png", True)

    mat = bpy.data.materials.new(name="mat_gateway")
    mat.use_nodes = True
    nt = mat.node_tree
    nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    bsdf = nt.nodes.new("ShaderNodeBsdfPrincipled")
    nt.links.new(bsdf.outputs["BSDF"], out.inputs["Surface"])

    n_alb = nt.nodes.new("ShaderNodeTexImage")
    n_alb.image = alb_img
    nt.links.new(n_alb.outputs["Color"], bsdf.inputs["Base Color"])

    n_orm = nt.nodes.new("ShaderNodeTexImage")
    n_orm.image = orm_img
    sep = nt.nodes.new("ShaderNodeSeparateColor")
    nt.links.new(n_orm.outputs["Color"], sep.inputs["Color"])
    nt.links.new(sep.outputs["Green"], bsdf.inputs["Roughness"])
    nt.links.new(sep.outputs["Blue"], bsdf.inputs["Metallic"])

    n_nrm = nt.nodes.new("ShaderNodeTexImage")
    n_nrm.image = nrm_img
    nmap = nt.nodes.new("ShaderNodeNormalMap")
    nmap.inputs["Strength"].default_value = 0.92
    nt.links.new(n_nrm.outputs["Color"], nmap.inputs["Color"])
    nt.links.new(nmap.outputs["Normal"], bsdf.inputs["Normal"])

    n_emi = nt.nodes.new("ShaderNodeTexImage")
    n_emi.image = emi_img
    if "Emission Color" in bsdf.inputs:
        nt.links.new(n_emi.outputs["Color"], bsdf.inputs["Emission Color"])
        bsdf.inputs["Emission Strength"].default_value = 1.0
    elif "Emission" in bsdf.inputs:
        nt.links.new(n_emi.outputs["Color"], bsdf.inputs["Emission"])

    # 39-Bone Gateway Skeleton
    BONE_SPECS = [
        ("Root",       None,        (0.000, 0.000,  0.000), (0.000, 0.140,  0.000), (0, 0, 1)),
        ("Pelvis",     "Root",      (0.000, 0.530, -0.012), (0.000, 0.605, -0.008), (0, 0, 1)),
        ("Spine1",     "Pelvis",    (0.000, 0.605, -0.008), (0.000, 0.695,  0.002), (0, 0, 1)),
        ("Spine2",     "Spine1",    (0.000, 0.695,  0.002), (0.000, 0.785,  0.008), (0, 0, 1)),
        ("Chest",      "Spine2",    (0.000, 0.785,  0.008), (0.000, 0.875,  0.006), (0, 0, 1)),
        ("Neck",       "Chest",     (0.000, 0.875,  0.006), (0.000, 0.968,  0.020), (0, 0, 1)),
        ("Head",       "Neck",      (0.000, 0.968,  0.020), (0.000, 1.135,  0.045), (0, 0, 1)),
        ("Jaw",        "Head",      (0.000, 0.985,  0.042), (0.000, 0.972,  0.142), (0, -1, 0)),
        ("EyeL",       "Head",      (0.046, 1.036,  0.090), (0.052, 1.036,  0.130), (0, 1, 0)),
        ("EyeR",       "Head",     (-0.046, 1.036,  0.090),(-0.052, 1.036,  0.130), (0, 1, 0)),
        ("EyelidL",    "Head",      (0.046, 1.040,  0.090), (0.052, 1.054,  0.132), (0, -1, 0)),
        ("EyelidR",    "Head",     (-0.046, 1.040,  0.090),(-0.052, 1.054,  0.132), (0, -1, 0)),
        ("FrillL1",    "Head",      (0.064, 1.038,  0.005), (0.128, 1.105, -0.095), (1, 0, 0.5)),
        ("FrillL2",    "FrillL1",   (0.128, 1.105, -0.095), (0.192, 1.182, -0.228), (1, 0, 0.5)),
        ("FrillR1",    "Head",     (-0.064, 1.038,  0.005),(-0.128, 1.105, -0.095), (-1, 0, 0.5)),
        ("FrillR2",    "FrillR1",  (-0.128, 1.105, -0.095),(-0.192, 1.182, -0.228), (-1, 0, 0.5)),
        ("ClavicleL",  "Chest",     (0.038, 0.848,  0.004), (0.106, 0.852, -0.004), (0, 0, 1)),
        ("UpperArmL",  "ClavicleL", (0.106, 0.852, -0.004), (0.168, 0.676, -0.012), (0, 0, 1)),
        ("ForearmL",   "UpperArmL", (0.168, 0.676, -0.012), (0.198, 0.512,  0.028), (0, 0, 1)),
        ("HandL",      "ForearmL",  (0.198, 0.512,  0.028), (0.214, 0.415,  0.062), (0, 0, 1)),
        ("ClavicleR",  "Chest",    (-0.038, 0.848,  0.004),(-0.106, 0.852, -0.004), (0, 0, 1)),
        ("UpperArmR",  "ClavicleR",(-0.106, 0.852, -0.004),(-0.168, 0.676, -0.012), (0, 0, 1)),
        ("ForearmR",   "UpperArmR",(-0.168, 0.676, -0.012),(-0.198, 0.512,  0.028), (0, 0, 1)),
        ("HandR",      "ForearmR", (-0.198, 0.512,  0.028),(-0.214, 0.415,  0.062), (0, 0, 1)),
        ("ThighL",     "Pelvis",    (0.084, 0.525, -0.006), (0.104, 0.305,  0.048), (0, 0, 1)),
        ("ShinL",      "ThighL",    (0.104, 0.305,  0.048), (0.098, 0.132, -0.042), (0, 0, 1)),
        ("AnkleL",     "ShinL",     (0.098, 0.132, -0.042), (0.098, 0.034,  0.036), (0, 0, 1)),
        ("FootL",      "AnkleL",    (0.098, 0.034,  0.036), (0.098, 0.014,  0.152), (0, 1, 0)),
        ("ThighR",     "Pelvis",   (-0.084, 0.525, -0.006),(-0.104, 0.305,  0.048), (0, 0, 1)),
        ("ShinR",      "ThighR",   (-0.104, 0.305,  0.048),(-0.098, 0.132, -0.042), (0, 0, 1)),
        ("AnkleR",     "ShinR",    (-0.098, 0.132, -0.042),(-0.098, 0.034,  0.036), (0, 0, 1)),
        ("FootR",      "AnkleR",   (-0.098, 0.034,  0.036),(-0.098, 0.014,  0.152), (0, 1, 0)),
        ("Tail1",      "Pelvis",    (0.000, 0.520, -0.062), (0.000, 0.462, -0.198), (0, 1, 0)),
        ("Tail2",      "Tail1",     (0.000, 0.462, -0.198), (0.000, 0.398, -0.340), (0, 1, 0)),
        ("Tail3",      "Tail2",     (0.000, 0.398, -0.340), (0.000, 0.356, -0.486), (0, 1, 0)),
        ("Tail4",      "Tail3",     (0.000, 0.356, -0.486), (0.000, 0.352, -0.634), (0, 1, 0)),
        ("Tail5",      "Tail4",     (0.000, 0.352, -0.634), (0.000, 0.386, -0.778), (0, 1, 0)),
        ("Tail6",      "Tail5",     (0.000, 0.386, -0.778), (0.000, 0.445, -0.916), (0, 1, 0)),
        ("Tail7",      "Tail6",     (0.000, 0.445, -0.916), (0.000, 0.518, -1.045), (0, 1, 0)),
    ]

    arm_data = bpy.data.armatures.new("GatewaySkeleton")
    arm_obj = bpy.data.objects.new("GatewayArmature", arm_data)
    scene.collection.objects.link(arm_obj)
    bpy.context.view_layer.objects.active = arm_obj
    bpy.ops.object.mode_set(mode="EDIT")
    eb_map = {}
    for bname, pname, h_t3, t_t3, r_t3 in BONE_SPECS:
        eb = arm_data.edit_bones.new(bname)
        eb.head = v3(*h_t3)
        eb.tail = v3(*t_t3)
        eb.align_roll(v3(*r_t3))
        if pname and pname in eb_map:
            eb.parent = eb_map[pname]
            eb.use_connect = False
        eb_map[bname] = eb
    bpy.ops.object.mode_set(mode="OBJECT")
    for pb in arm_obj.pose.bones:
        pb.rotation_mode = "XYZ"

    # UV Helpers
    def _uv_skin(tx, ty, tz, is_limb=False, v_override=None):
        if is_limb:
            cx = 0.12 if tx >= 0 else -0.12
            ang = math.atan2(tx - cx, tz) / math.pi
            su = (0.16 + 0.10 * ang) if tx >= 0 else (0.84 + 0.10 * ang)
            sv = v_override if v_override is not None else clamp01(ty / 1.16)
        else:
            z_eff = tz + max(0.0, ty - 0.955) * 0.95
            su = 0.5 + math.atan2(tx, z_eff if abs(z_eff) > 1e-5 else 1e-5) / (2.0 * math.pi)
            if ty > 0.955:
                h_blend = clamp01((ty - 0.955) / 0.035)
                sv_head = clamp01(0.76 + (ty - 0.955) * 0.85 + max(0.0, tz) * 0.48)
                sv_base = v_override if v_override is not None else clamp01(ty / 1.16)
                sv = sv_base * (1.0 - h_blend) + sv_head * h_blend
            else:
                sv = v_override if v_override is not None else clamp01(ty / 1.16)
        return (0.04 + clamp01(su) * 0.62, 0.03 + clamp01(sv) * 0.70)

    def _uv_frill(u01, v01):
        return (0.73 + clamp01(u01) * 0.24, 0.05 + clamp01(v01) * 0.62)

    def _uv_gear(u01, band):
        v_lo = 0.79 if band == 0 else (0.86 if band == 1 else 0.93)
        return (0.04 + (u01 % 1.0) * 0.62, v_lo + 0.025)

    # Welded Organic Body Loft (`BMesh`) + Anatomical Muscle & Cranial Sculpting
    bm = bmesh.new()
    uv_layer = bm.loops.layers.uv.verify()
    N_RING = 28

    body_stations = [
        (0.518, -1.045, 0.008, 0.000, 0.011, 0.011, 1.24, 0.03),
        (0.478, -0.972, 0.014, 0.000, 0.020, 0.020, 1.28, 0.05),
        (0.428, -0.885, 0.021, 0.000, 0.028, 0.028, 1.36, 0.08),
        (0.382, -0.780, 0.028, 0.000, 0.035, 0.035, 1.48, 0.11),
        (0.352, -0.662, 0.036, 0.000, 0.042, 0.042, 1.58, 0.15),
        (0.350, -0.542, 0.045, 0.000, 0.049, 0.049, 1.68, 0.19),
        (0.378, -0.428, 0.054, 0.000, 0.057, 0.057, 1.78, 0.23),
        (0.420, -0.322, 0.064, 0.000, 0.066, 0.066, 1.82, 0.27),
        (0.464, -0.222, 0.074, 0.000, 0.074, 0.073, 1.78, 0.31),
        (0.498, -0.135, 0.084, 0.000, 0.081, 0.078, 1.46, 0.35),
        (0.512, -0.072, 0.094, 0.000, 0.084, 0.076, 0.90, 0.38),
        (0.495, -0.014, 0.098, 0.000, 0.074, 0.078, 0.16, 0.41),
        (0.524, -0.012, 0.114, 0.000, 0.084, 0.090, 0.05, 0.44),
        (0.556, -0.010, 0.116, 0.000, 0.084, 0.090, 0.02, 0.47),
        (0.588, -0.008, 0.104, 0.000, 0.076, 0.080, 0.00, 0.50),
        (0.628, -0.004, 0.078, 0.000, 0.064, 0.064, 0.00, 0.53),
        (0.670,  0.000, 0.075, 0.000, 0.063, 0.062, 0.00, 0.57),
        (0.714,  0.005, 0.088, 0.000, 0.074, 0.069, 0.00, 0.60),
        (0.754,  0.010, 0.102, 0.000, 0.089, 0.076, 0.00, 0.63),
        (0.790,  0.012, 0.113, 0.000, 0.095, 0.080, 0.00, 0.66),
        (0.822,  0.009, 0.116, 0.000, 0.084, 0.078, 0.00, 0.69),
        (0.850,  0.006, 0.113, 0.000, 0.074, 0.072, 0.00, 0.71),
        (0.874,  0.006, 0.094, 0.000, 0.062, 0.062, 0.00, 0.73),
        (0.894,  0.008, 0.062, 0.000, 0.050, 0.050, -0.06, 0.75),
        (0.920,  0.012, 0.044, 0.000, 0.043, 0.044, -0.10, 0.77),
        (0.948,  0.018, 0.041, 0.000, 0.041, 0.042, -0.12, 0.79),
        (0.974,  0.024, 0.046, 0.000, 0.046, 0.046, -0.08, 0.80),
        (0.994,  0.022, 0.068, 0.000, 0.064, 0.072, -0.22, 0.81),
        (1.018,  0.022, 0.084, 0.000, 0.082, 0.088, -0.46, 0.83),
        (1.040,  0.034, 0.079, 0.000, 0.082, 0.090, -0.78, 0.85),
        (1.052,  0.062, 0.067, 0.000, 0.064, 0.078, -1.10, 0.87),
        (1.044,  0.096, 0.049, 0.000, 0.046, 0.056, -1.34, 0.89),
        (1.032,  0.128, 0.036, 0.000, 0.035, 0.042, -1.46, 0.91),
        (1.022,  0.156, 0.024, 0.000, 0.024, 0.028, -1.51, 0.93),
        (1.015,  0.174, 0.011, 0.000, 0.012, 0.014, -1.53, 0.95),
    ]

    HIP_S0, ARM_S0 = 11, 19

    def _is_interior_hole_vert(s, j):
        if (HIP_S0 + 1) <= s <= (HIP_S0 + 2) and (6 <= j <= 7 or 21 <= j <= 22):
            return True
        if (ARM_S0 + 1) <= s <= (ARM_S0 + 3) and (6 <= j <= 8 or 20 <= j <= 22):
            return True
        return False

    def _is_hole_quad(s, j):
        if HIP_S0 <= s < (HIP_S0 + 3) and (5 <= j < 8 or 20 <= j < 23):
            return True
        if ARM_S0 <= s < (ARM_S0 + 4) and (5 <= j < 9 or 19 <= j < 23):
            return True
        return False

    grid_verts, grid_t3, grid_v_uv = [], [], []
    joint_smooth_verts = set()

    for s_idx, (cy, cz, rx, _ry, rzf, rzb, pitch, v_uv) in enumerate(body_stations):
        pitch_eff = -abs(pitch) if s_idx <= 10 else pitch
        f_y, f_z = math.sin(pitch_eff), math.cos(pitch_eff)
        row_v, row_t = [], []
        for j in range(N_RING):
            if _is_interior_hole_vert(s_idx, j):
                row_v.append(None)
                row_t.append(None)
                continue
            th = (2.0 * math.pi * j) / N_RING
            sth, cth = math.sin(th), math.cos(th)
            rz = rzf if cth >= 0.0 else rzb
            x = sth * rx
            y = cy + cth * rz * f_y
            z = cz + cth * rz * f_z

            # Wave 2 Sculpted Cranial & Facial Anatomy (`Head` stations `27..34`)!
            if 27 <= s_idx <= 33:
                for sgn in (-1.0, 1.0):
                    # Recessed almond orbital socket
                    d_eye = ((x - sgn * 0.048) / 0.036) ** 2 + ((y - 1.036) / 0.032) ** 2 + ((z - 0.088) / 0.048) ** 2
                    if d_eye < 1.8:
                        indent = math.exp(-d_eye * 1.35) * 0.019
                        x -= sgn * indent * 0.35
                        z -= indent * 0.85
                    # Crisp 3D Supraorbital Horned Brow Crest sweeping over each eye!
                    d_brow = ((x - sgn * 0.052) / 0.026) ** 2 + ((y - 1.066) / 0.018) ** 2 + ((z - 0.076) / 0.052) ** 2
                    if d_brow < 1.8:
                        crest_lift = math.exp(-d_brow * 1.4) * 0.015
                        y += crest_lift
                        x += sgn * crest_lift * 0.35
                    # 3D Sculpted Nostril Rim Swell + Recessed Nasal Cavity (`s_idx ~ 32`)
                    d_nost = ((x - sgn * 0.016) / 0.010) ** 2 + ((y - 1.036) / 0.010) ** 2 + ((z - 0.142) / 0.016) ** 2
                    if d_nost < 2.2:
                        # Donut rim around recessed center (`d_nost < 0.45` recesses, `0.45..1.5` swells!)
                        rim = math.exp(-((d_nost - 0.85) ** 2) * 2.2) * 0.006 - math.exp(-d_nost * 3.2) * 0.007
                        y += rim
                        x += sgn * rim * 0.5
                # Sculpted 3D Labial Lip Cushion & Smile Corner Contour!
                if z > 0.05 and abs(y - 1.004) < 0.022:
                    lip_d = abs(y - (1.000 + 0.012 * (abs(x) / 0.065) ** 1.5))
                    if lip_d < 0.006:
                        z -= (1.0 - lip_d / 0.006) * 0.005  # 3D mouth groove!
                    elif lip_d < 0.015:
                        z += math.sin(((lip_d - 0.006) / 0.009) * math.pi) * 0.0035  # Lip cushion!
            elif 15 <= s_idx <= 22:
                # Subtle athletic abdominal linea alba & spinal erector muscles!
                if cth > 0.72:
                    z -= math.exp(-(x / 0.014) ** 2) * 0.0045
                elif cth < -0.70:
                    z += math.exp(-(x / 0.018) ** 2) * 0.006

            bv = bm.verts.new(v3(x, y, z))
            if (HIP_S0 - 1) <= s_idx <= (HIP_S0 + 4) or (ARM_S0 - 1) <= s_idx <= (ARM_S0 + 5):
                joint_smooth_verts.add(bv)
            row_v.append(bv)
            row_t.append((x, y, z))

        grid_verts.append(row_v)
        grid_t3.append(row_t)
        grid_v_uv.append(v_uv)

    def _add_quad_with_skin_uv(v0, v1, v2, v3_v, t0, t1, t2, t3, v_uv0, v_uv1, is_limb=False):
        try:
            f = bm.faces.new([v0, v1, v2, v3_v])
        except ValueError:
            return
        pts = [t0, t1, t2, t3]
        vvs = [v_uv0, v_uv0, v_uv1, v_uv1]
        raw_us = [list(_uv_skin(pts[k][0], pts[k][1], pts[k][2], is_limb=is_limb, v_override=vvs[k])) for k in range(4)]
        if not is_limb:
            u_vals = [ru[0] for ru in raw_us]
            if max(u_vals) - min(u_vals) > 0.32:
                for ru in raw_us:
                    if ru[0] < 0.35:
                        ru[0] += 0.62
        for k in range(4):
            f.loops[k][uv_layer].uv = (raw_us[k][0], raw_us[k][1])

    for s in range(len(body_stations) - 1):
        for j in range(N_RING):
            if _is_hole_quad(s, j):
                continue
            jn = (j + 1) % N_RING
            v0, v1 = grid_verts[s][j], grid_verts[s][jn]
            v2, v3_v = grid_verts[s + 1][jn], grid_verts[s + 1][j]
            if None in (v0, v1, v2, v3_v):
                continue
            _add_quad_with_skin_uv(v0, v1, v2, v3_v, grid_t3[s][j], grid_t3[s][jn], grid_t3[s + 1][jn], grid_t3[s + 1][j], grid_v_uv[s], grid_v_uv[s + 1], is_limb=False)

    v_tail_cap = bm.verts.new(v3(0.0, 0.526, -1.058))
    for j in range(N_RING):
        jn = (j + 1) % N_RING
        try:
            f = bm.faces.new([v_tail_cap, grid_verts[0][jn], grid_verts[0][j]])
            for lp in f.loops:
                lp[uv_layer].uv = (0.35, 0.03)
        except ValueError:
            pass

    snout_cap_t = (0.0, 1.012, 0.182)
    v_snout_cap = bm.verts.new(v3(*snout_cap_t))
    cap_uv = _uv_skin(*snout_cap_t, is_limb=False, v_override=0.955)
    for j in range(N_RING):
        jn = (j + 1) % N_RING
        try:
            f = bm.faces.new([v_snout_cap, grid_verts[-1][j], grid_verts[-1][jn]])
            f.loops[0][uv_layer].uv = cap_uv
            f.loops[1][uv_layer].uv = _uv_skin(*grid_t3[-1][j], is_limb=False, v_override=0.95)
            f.loops[2][uv_layer].uv = _uv_skin(*grid_t3[-1][jn], is_limb=False, v_override=0.95)
        except ValueError:
            pass

    def _extract_socket_loop(s0, n_rows, j0, n_cols):
        pts_v, pts_t = [], []
        s1, j1 = s0 + n_rows, j0 + n_cols
        for j in range(j0, j1):
            pts_v.append(grid_verts[s0][j])
            pts_t.append(grid_t3[s0][j])
        for s in range(s0, s1):
            pts_v.append(grid_verts[s][j1])
            pts_t.append(grid_t3[s][j1])
        for j in range(j1, j0, -1):
            pts_v.append(grid_verts[s1][j])
            pts_t.append(grid_t3[s1][j])
        for s in range(s1, s0, -1):
            pts_v.append(grid_verts[s][j0])
            pts_t.append(grid_t3[s][j0])
        return pts_v, pts_t

    def _loft_limb_tube(start_v, start_t, stations):
        m_cnt = len(start_v)
        prev_v, prev_t = list(start_v), list(start_t)
        prev_v_uv = clamp01(sum(p[1] for p in start_t) / (len(start_t) * 1.16))
        sc = Vector((sum(p[0] for p in start_t) / m_cnt, sum(p[1] for p in start_t) / m_cnt, sum(p[2] for p in start_t) / m_cnt))
        centers = [Vector(st[:3]) for st in stations]
        tangents = []
        for idx in range(len(centers)):
            p_prev = sc if idx == 0 else centers[idx - 1]
            p_next = centers[idx] if idx == len(centers) - 1 else centers[idx + 1]
            tg = p_next - p_prev
            tangents.append(tg.normalized() if tg.length > 1e-6 else Vector((0.0, -1.0, 0.0)))

        t0 = tangents[0]
        b1_acc, b2_acc = Vector((0, 0, 0)), Vector((0, 0, 0))
        for k, pt in enumerate(start_t):
            ang = (2.0 * math.pi * k) / m_cnt
            rel_perp = (Vector(pt) - sc) - t0 * (Vector(pt) - sc).dot(t0)
            b1_acc += rel_perp * math.cos(ang)
            b2_acc += rel_perp * math.sin(ang)
        b1 = b1_acc.normalized()
        b2 = (b2_acc - b1 * b2_acc.dot(b1)).normalized()
        if b1.cross(b2).dot(t0) < 0:
            b2 = -b2

        for idx, (cx, cy, cz, r1, r2, v_uv) in enumerate(stations):
            if idx > 0:
                q = tangents[idx - 1].rotation_difference(tangents[idx])
                b1 = (q @ b1).normalized()
                b2 = (q @ b2).normalized()
            cur_v, cur_t = [], []
            c_vec = centers[idx]
            for k in range(m_cnt):
                ang = (2.0 * math.pi * k) / m_cnt
                pt_vec = c_vec + b1 * (math.cos(ang) * r1) + b2 * (math.sin(ang) * r2)
                pt = (pt_vec.x, pt_vec.y, pt_vec.z)
                bv = bm.verts.new(v3(*pt))
                if idx <= 1:
                    joint_smooth_verts.add(bv)
                cur_v.append(bv)
                cur_t.append(pt)
            for k in range(m_cnt):
                kn = (k + 1) % m_cnt
                _add_quad_with_skin_uv(prev_v[k], prev_v[kn], cur_v[kn], cur_v[k], prev_t[k], prev_t[kn], cur_t[kn], cur_t[k], prev_v_uv, v_uv, is_limb=True)
            prev_v, prev_t, prev_v_uv = cur_v, cur_t, v_uv
        return prev_v, prev_t

    def _branch_digits(rim_v, rim_t, digit_specs, cleft_pairs, v_uv_base):
        cleft_v, cleft_t = {}, {}
        for idx_c, (ia, ib) in enumerate(cleft_pairs):
            pa, pb = rim_t[ia], rim_t[ib]
            mx, my, mz = 0.5 * (pa[0] + pb[0]), 0.5 * (pa[1] + pb[1]), 0.5 * (pa[2] + pb[2]) + 0.010
            cleft_t[idx_c] = (mx, my, mz)
            cleft_v[idx_c] = bm.verts.new(v3(mx, my, mz))

        for d_spec in digit_specs:
            loop_items = d_spec["loop"]
            d_v = [cleft_v[it[1]] if isinstance(it, tuple) else rim_v[it] for it in loop_items]
            d_t = [cleft_t[it[1]] if isinstance(it, tuple) else rim_t[it] for it in loop_items]
            m_d = len(d_v)
            dc = Vector((sum(p[0] for p in d_t) / m_d, sum(p[1] for p in d_t) / m_d, sum(p[2] for p in d_t) / m_d))
            dir_vec = Vector(d_spec["dir"]).normalized()
            up_vec = Vector((0.0, 1.0, 0.0)) if abs(dir_vec.y) < 0.9 else Vector((0.0, 0.0, 1.0))

            b1_a, b2_a = Vector((0, 0, 0)), Vector((0, 0, 0))
            for k, pt in enumerate(d_t):
                ang = (2.0 * math.pi * k) / m_d
                rel_p = (Vector(pt) - dc) - dir_vec * (Vector(pt) - dc).dot(dir_vec)
                b1_a += rel_p * math.cos(ang)
                b2_a += rel_p * math.sin(ang)
            b1 = b1_a.normalized() if b1_a.length > 1e-6 else dir_vec.cross(up_vec).normalized()
            b2 = (b2_a - b1 * b2_a.dot(b1)).normalized()
            if b2.length < 1e-6:
                b2 = dir_vec.cross(b1).normalized()
            if b1.cross(b2).dot(dir_vec) < 0:
                b2 = -b2

            length, r_base = d_spec["len"], d_spec["r"]
            pv, pt_l = d_v, d_t
            for sf, sx_r, sy_r, drop_y in [(0.36, 0.85, 0.82, 0.0), (0.72, 0.76, 0.72, -0.002), (0.96, 1.22, 0.80, -0.003)]:
                c_seg = dc + dir_vec * (length * sf) + Vector((0.0, drop_y, 0.0))
                cv, ct_l = [], []
                for k in range(m_d):
                    ang = (2.0 * math.pi * k) / m_d
                    p_vec = c_seg + b1 * (math.cos(ang) * r_base * sx_r) + b2 * (math.sin(ang) * r_base * sy_r)
                    pt_tup = (p_vec.x, max(0.001, p_vec.y) if d_spec.get("clamp_floor") else p_vec.y, p_vec.z)
                    cv.append(bm.verts.new(v3(*pt_tup)))
                    ct_l.append(pt_tup)
                for k in range(m_d):
                    kn = (k + 1) % m_d
                    _add_quad_with_skin_uv(pv[k], pv[kn], cv[kn], cv[k], pt_l[k], pt_l[kn], ct_l[kn], ct_l[k], v_uv_base, v_uv_base, is_limb=True)
                pv, pt_l = cv, ct_l

            tip_vec = dc + dir_vec * (length * 1.08)
            tip_t = (tip_vec.x, max(0.003, tip_vec.y) if d_spec.get("clamp_floor") else tip_vec.y, tip_vec.z)
            v_tip = bm.verts.new(v3(*tip_t))
            for k in range(m_d):
                kn = (k + 1) % m_d
                try:
                    f = bm.faces.new([pv[k], pv[kn], v_tip])
                    for lp in f.loops:
                        lp[uv_layer].uv = (0.35, 0.14)
                except ValueError:
                    pass

    # Muscular Deltoid/Bicep/Forearm Arms + 4-Fingered Gecko Hands
    for is_left in (True, False):
        sgn = 1.0 if is_left else -1.0
        arm_loop_v, arm_loop_t = _extract_socket_loop(ARM_S0, 4, 5 if is_left else 19, 4)
        arm_stations = [
            (sgn * 0.128, 0.828,  0.002, 0.043, 0.041, 0.68),  # Sculpted deltoid cap!
            (sgn * 0.149, 0.752, -0.004, 0.035, 0.034, 0.62),  # Bicep belly
            (sgn * 0.168, 0.676, -0.012, 0.027, 0.027, 0.56),  # Tapered elbow
            (sgn * 0.183, 0.608,  0.006, 0.032, 0.030, 0.50),  # Muscular brachioradialis forearm swell
            (sgn * 0.194, 0.542,  0.020, 0.022, 0.021, 0.45),
            (sgn * 0.198, 0.505,  0.030, 0.019, 0.016, 0.42),
            (sgn * 0.206, 0.468,  0.044, 0.029, 0.013, 0.39),
        ]
        palm_v, palm_t = _loft_limb_tube(arm_loop_v, arm_loop_t, arm_stations)
        p_center = Vector((sum(p[0] for p in palm_t) / 16.0, sum(p[1] for p in palm_t) / 16.0, sum(p[2] for p in palm_t) / 16.0))
        f_loops = [[0, 1, 2, ("c", 0), 14, 15], [("c", 0), 2, 3, 4, ("c", 1), 12, 13, 14], [("c", 1), 4, 5, 6, ("c", 2), 10, 11, 12], [("c", 2), 6, 7, 8, 9, 10]]
        f_lens = [0.044, 0.058, 0.062, 0.050]
        f_specs = []
        for fi, fl in enumerate(f_loops):
            raw_idxs = [it for it in fl if isinstance(it, int)]
            fc = Vector((sum(palm_t[ii][0] for ii in raw_idxs) / len(raw_idxs), sum(palm_t[ii][1] for ii in raw_idxs) / len(raw_idxs), sum(palm_t[ii][2] for ii in raw_idxs) / len(raw_idxs)))
            spread = fc - p_center
            spread.y = 0.0
            if spread.length > 1e-5:
                spread.normalize()
            d_dir = Vector((sgn * 0.18 + spread.x * 0.55, -0.88, 0.42 + spread.z * 0.55)).normalized()
            f_specs.append({"loop": fl, "dir": (d_dir.x, d_dir.y, d_dir.z), "len": f_lens[fi], "r": 0.0076})
        _branch_digits(palm_v, palm_t, f_specs, [(2, 14), (4, 12), (6, 10)], 0.36)

    # Athletic Quadriceps & Gastrocnemius/Achilles Digitigrade Legs + 3-Toed Webbed Feet
    for is_left in (True, False):
        sgn = 1.0 if is_left else -1.0
        leg_loop_v, leg_loop_t = _extract_socket_loop(HIP_S0, 3, 5 if is_left else 20, 3)
        leg_stations = [
            (sgn * 0.098, 0.492,  0.004, 0.061, 0.068, 0.40),  # Athletic glute/upper thigh
            (sgn * 0.105, 0.405,  0.030, 0.055, 0.062, 0.35),  # Sculpted quadriceps sweep!
            (sgn * 0.104, 0.305,  0.048, 0.037, 0.039, 0.27),  # Crisp knee
            (sgn * 0.102, 0.238,  0.002, 0.042, 0.046, 0.21),  # Defined gastrocnemius calf belly!
            (sgn * 0.098, 0.172, -0.028, 0.025, 0.028, 0.16),  # Taut Achilles taper!
            (sgn * 0.098, 0.132, -0.042, 0.024, 0.027, 0.13),  # Elevated digitigrade hock
            (sgn * 0.098, 0.078, -0.002, 0.021, 0.023, 0.08),
            (sgn * 0.098, 0.026,  0.036, 0.028, 0.018, 0.04),
            (sgn * 0.098, 0.016,  0.070, 0.038, 0.014, 0.03),
        ]
        foot_v, foot_t = _loft_limb_tube(leg_loop_v, leg_loop_t, leg_stations)
        t_loops = [[0, 1, 2, ("c", 0), 10, 11], [("c", 0), 2, 3, 4, ("c", 1), 8, 9, 10], [("c", 1), 4, 5, 6, 7, 8]]
        f_cent = Vector((sum(p[0] for p in foot_t) / 12.0, 0.0, sum(p[2] for p in foot_t) / 12.0))
        t_lens = [0.072, 0.092, 0.074]
        t_specs = []
        for ti, tl in enumerate(t_loops):
            raw_idxs = [it for it in tl if isinstance(it, int)]
            tc = Vector((sum(foot_t[ii][0] for ii in raw_idxs) / len(raw_idxs), 0.0, sum(foot_t[ii][2] for ii in raw_idxs) / len(raw_idxs)))
            dx_spread = clamp01((tc.x - f_cent.x) * 18.0 + 0.5) * 2.0 - 1.0
            yaw = dx_spread * 0.38 if abs(dx_spread) > 0.15 else ((-0.36 if ti == 0 else (0.0 if ti == 1 else 0.36)) * sgn)
            t_specs.append({"loop": tl, "dir": (math.sin(yaw), -0.05, math.cos(yaw)), "len": t_lens[ti], "r": 0.011, "clamp_floor": True})
        _branch_digits(foot_v, foot_t, t_specs, [(2, 10), (4, 8)], 0.03)

    bmesh.ops.smooth_vert(bm, verts=list(joint_smooth_verts), factor=0.55, use_axis_x=True, use_axis_y=True, use_axis_z=True)
    bmesh.ops.smooth_vert(bm, verts=list(joint_smooth_verts), factor=0.45, use_axis_x=True, use_axis_y=True, use_axis_z=True)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)

    body_mesh = bpy.data.meshes.new("GatewayBody_Base")
    bm.to_mesh(body_mesh)
    bm.free()
    for poly in body_mesh.polygons:
        poly.use_smooth = True
    body_mesh.materials.append(mat)

    body_obj = bpy.data.objects.new("GatewayMesh", body_mesh)
    scene.collection.objects.link(body_obj)
    bpy.context.view_layer.objects.active = body_obj

    sub = body_obj.modifiers.new(name="SmoothOrganic", type="SUBSURF")
    sub.levels = 1
    sub.render_levels = 1
    sub.uv_smooth = "PRESERVE_BOUNDARIES"
    bpy.ops.object.modifier_apply(modifier=sub.name)

    sm = body_obj.modifiers.new(name="JointRelax", type="SMOOTH")
    sm.factor = 0.28
    sm.iterations = 2
    bpy.ops.object.modifier_apply(modifier=sm.name)

    for v in body_obj.data.vertices:
        if v.co.z < 0.0:
            v.co.z = 0.0

    # Wave 2 Sculpted Detail Additions (`BMesh`):
    #   - 3D Scalloped Dorsal Spine Fin-Scutes (`18` swept-back spines along back & tail!)
    #   - 3-Lobe Scalloped Sea-Dragon Frills + 3D Structural Cartilage Fin-Ray Ribs!
    #   - Multi-Layered 3D Beveled Pelagian Armor, 4-Prong Water Seed Cradle & Bladed Gauntlet!
    bm_det = bmesh.new()
    bm_det.from_mesh(body_obj.data)
    uv_det = bm_det.loops.layers.uv.verify()

    def _add_scalloped_frill(root_pts, mid_pts, tip_pts, thick=0.0034):
        nr, nu = len(root_pts), 8
        top_g, bot_g = [], []
        for iu in range(nu):
            fu = iu / float(nu - 1)
            tr, br = [], []
            for iv in range(nr):
                fv = iv / float(max(1, nr - 1))
                p0, pm, p1 = Vector(root_pts[iv]), Vector(mid_pts[iv]), Vector(tip_pts[iv])
                om = 1.0 - fu
                p_ray = p0 * (om * om) + pm * (2.0 * om * fu) + p1 * (fu * fu)
                end_taper = math.sin(fv * math.pi) ** 0.45
                lobe_wave = 0.84 + 0.16 * math.cos((fv - 0.5) * math.pi * 5.0)
                p = p0.lerp(p_ray, 0.24 + 0.76 * (end_taper * lobe_wave))
                # 3D physical fin-ray ridge relief!
                ray_swell = 0.0020 * (0.5 + 0.5 * math.cos(fv * math.pi * 6.0)) * (1.0 - fu * 0.45)
                th_h = (thick * (1.0 - fu * 0.72) + ray_swell) * (0.35 + 0.65 * end_taper)
                n_dir = Vector((0.45 if p.x >= 0 else -0.45, 0.75, 0.48)).normalized() if abs(p.x) > 0.02 else Vector((1.0, 0.0, 0.0))
                tr.append(bm_det.verts.new(v3(*(p + n_dir * th_h))))
                br.append(bm_det.verts.new(v3(*(p - n_dir * th_h))))
            top_g.append(tr)
            bot_g.append(br)

        for iu in range(nu - 1):
            u0, u1 = iu / float(nu - 1), (iu + 1) / float(nu - 1)
            for iv in range(nr - 1):
                v0, v1 = iv / float(nr - 1), (iv + 1) / float(nr - 1)
                for quad_v, q_uv in (
                    ([top_g[iu][iv], top_g[iu][iv + 1], top_g[iu + 1][iv + 1], top_g[iu + 1][iv]],
                     [_uv_frill(u0, v0), _uv_frill(u0, v1), _uv_frill(u1, v1), _uv_frill(u1, v0)]),
                    ([bot_g[iu][iv], bot_g[iu + 1][iv], bot_g[iu + 1][iv + 1], bot_g[iu][iv + 1]],
                     [_uv_frill(u0, v0), _uv_frill(u1, v0), _uv_frill(u1, v1), _uv_frill(u0, v1)]),
                ):
                    try:
                        f = bm_det.faces.new(quad_v)
                        for k in range(4):
                            f.loops[k][uv_det].uv = q_uv[k]
                    except ValueError:
                        pass
        for iv in range(nr - 1):
            v0, v1 = iv / float(nr - 1), (iv + 1) / float(nr - 1)
            try:
                f = bm_det.faces.new([top_g[-1][iv], bot_g[-1][iv], bot_g[-1][iv + 1], top_g[-1][iv + 1]])
                for lp in f.loops:
                    lp[uv_det].uv = _uv_frill(0.98, 0.5 * (v0 + v1))
            except ValueError:
                pass

    # 1. Swept-Back Scalloped 3-Lobe Sea-Dragon Head-Frills + Crown Fin + Caudal Leaf-Fin
    for sgn in (1.0, -1.0):
        roots = [(sgn * 0.048, 1.080, -0.008), (sgn * 0.060, 1.064, 0.004), (sgn * 0.068, 1.046, 0.010), (sgn * 0.072, 1.028, 0.010), (sgn * 0.070, 1.010, 0.006), (sgn * 0.064, 0.992, 0.000), (sgn * 0.052, 0.976, -0.008)]
        mids  = [(sgn * 0.095, 1.132, -0.085), (sgn * 0.122, 1.116, -0.092), (sgn * 0.138, 1.092, -0.095), (sgn * 0.142, 1.062, -0.092), (sgn * 0.132, 1.032, -0.085), (sgn * 0.112, 1.005, -0.075), (sgn * 0.085, 0.982, -0.065)]
        tips  = [(sgn * 0.132, 1.196, -0.205), (sgn * 0.178, 1.184, -0.232), (sgn * 0.202, 1.142, -0.238), (sgn * 0.206, 1.088, -0.225), (sgn * 0.188, 1.042, -0.202), (sgn * 0.154, 1.005, -0.172), (sgn * 0.108, 0.980, -0.138)]
        if sgn < 0:
            roots, mids, tips = list(reversed(roots)), list(reversed(mids)), list(reversed(tips))
        _add_scalloped_frill(roots, mids, tips, thick=0.0035)

    _add_scalloped_frill(
        [(0.0, 1.058, 0.042), (0.0, 1.072, 0.002), (0.0, 1.058, -0.038), (0.0, 1.022, -0.068), (0.0, 0.985, -0.078)],
        [(0.0, 1.098, 0.012), (0.0, 1.148, -0.042), (0.0, 1.132, -0.095), (0.0, 1.075, -0.122), (0.0, 1.008, -0.115)],
        [(0.0, 1.124, -0.025), (0.0, 1.196, -0.108), (0.0, 1.172, -0.178), (0.0, 1.095, -0.188), (0.0, 1.018, -0.155)],
        thick=0.0032,
    )

    for sgn in (1.0, -1.0):
        t_roots = [(sgn * 0.018, 0.372, -0.715), (sgn * 0.016, 0.402, -0.805), (sgn * 0.013, 0.442, -0.895), (sgn * 0.009, 0.482, -0.978), (sgn * 0.005, 0.518, -1.045)]
        t_mids  = [(sgn * 0.042, 0.378, -0.738), (sgn * 0.068, 0.415, -0.835), (sgn * 0.072, 0.460, -0.932), (sgn * 0.052, 0.502, -1.015), (sgn * 0.018, 0.538, -1.072)]
        t_tips  = [(sgn * 0.055, 0.385, -0.762), (sgn * 0.108, 0.428, -0.868), (sgn * 0.116, 0.478, -0.968), (sgn * 0.078, 0.524, -1.048), (sgn * 0.012, 0.558, -1.095)]
        if sgn < 0:
            t_roots, t_mids, t_tips = list(reversed(t_roots)), list(reversed(t_mids)), list(reversed(t_tips))
        _add_scalloped_frill(t_roots, t_mids, t_tips, thick=0.0030)

    # 2. 18 Sculpted 3D Scalloped Dorsal Spine Fin-Scutes running down Back & 7-Bone Tail!
    dorsal_spine_pts = [
        # (y_base, z_base, height_len, sweep_z, width_x, v_uv)
        (0.710, -0.066, 0.022, -0.028, 0.0055, 0.55),
        (0.655, -0.062, 0.026, -0.032, 0.0060, 0.50),
        (0.598, -0.072, 0.030, -0.036, 0.0065, 0.45),
        (0.552, -0.105, 0.034, -0.040, 0.0068, 0.40),
        (0.525, -0.175, 0.038, -0.044, 0.0068, 0.35),
        (0.492, -0.265, 0.038, -0.044, 0.0062, 0.30),
        (0.452, -0.365, 0.036, -0.042, 0.0058, 0.25),
        (0.415, -0.468, 0.034, -0.040, 0.0052, 0.20),
        (0.395, -0.572, 0.032, -0.038, 0.0048, 0.16),
        (0.396, -0.678, 0.030, -0.036, 0.0042, 0.12),
        (0.422, -0.785, 0.028, -0.034, 0.0038, 0.09),
        (0.465, -0.888, 0.025, -0.030, 0.0032, 0.06),
    ]
    for yb, zb, h_sp, sz_sp, wx_sp, fv_sp in dorsal_spine_pts:
        # 4-base pyramid-fin swept cleanly backward with coral-aqua Q_FRILL UV!
        b_front = bm_det.verts.new(v3(0.0, yb + 0.006, zb + 0.022))
        b_left  = bm_det.verts.new(v3(wx_sp, yb - 0.004, zb))
        b_right = bm_det.verts.new(v3(-wx_sp, yb - 0.004, zb))
        b_back  = bm_det.verts.new(v3(0.0, yb - 0.006, zb - 0.024))
        v_peak  = bm_det.verts.new(v3(0.0, yb + h_sp, zb + sz_sp))
        for tri_v in ([b_front, b_left, v_peak], [b_left, b_back, v_peak], [b_back, b_right, v_peak], [b_right, b_front, v_peak]):
            try:
                f = bm_det.faces.new(tri_v)
                f.loops[0][uv_det].uv = _uv_frill(0.15, fv_sp)
                f.loops[1][uv_det].uv = _uv_frill(0.25, fv_sp + 0.04)
                f.loops[2][uv_det].uv = _uv_frill(0.92, fv_sp + 0.02)
            except ValueError:
                pass

    # 3. Large Jewel-Detailed Almond Reptilian Eyes (`EyeL/R`) + Winged Lash Eyelids (`EyelidL/R`)
    for sgn in (1.0, -1.0):
        ecx, ecy, ecz = sgn * 0.046, 1.036, 0.090
        yaw_e = sgn * 0.28
        cy_e, sy_e = math.cos(yaw_e), math.sin(yaw_e)
        u_segs_e = 24
        thetas_e = [135, 95, 62, 42, 28, 16, 6]
        e_rings = []
        for deg in thetas_e:
            th = math.radians(deg)
            sr, cr = math.sin(th), math.cos(th)
            ring = []
            for iu in range(u_segs_e):
                a = (2.0 * math.pi * iu) / u_segs_e
                lx, ly, lz = 0.034 * sr * math.cos(a), 0.036 * sr * math.sin(a), 0.033 * cr
                wx = ecx + lx * cy_e + lz * sy_e
                wz = ecz - lx * sy_e + lz * cy_e
                ring.append((bm_det.verts.new(v3(wx, ecy + ly, wz)), math.cos(a), math.sin(a), deg / 62.0))
            e_rings.append(ring)

        for ir in range(len(e_rings) - 1):
            r0, r1 = e_rings[ir], e_rings[ir + 1]
            for iu in range(u_segs_e):
                iun = (iu + 1) % u_segs_e
                try:
                    f = bm_det.faces.new([r0[iu][0], r0[iun][0], r1[iun][0], r1[iu][0]])
                    for k, item in enumerate([r0[iu], r0[iun], r1[iun], r1[iu]]):
                        rr = min(1.02, item[3]) * 0.122
                        f.loops[k][uv_det].uv = (0.85 + item[1] * rr, 0.85 + item[2] * rr)
                except ValueError:
                    pass
        v_pup = bm_det.verts.new(v3(ecx + 0.034 * sy_e, ecy, ecz + 0.034 * cy_e))
        for iu in range(u_segs_e):
            iun = (iu + 1) % u_segs_e
            try:
                f = bm_det.faces.new([e_rings[-1][iu][0], e_rings[-1][iun][0], v_pup])
                for lp in f.loops:
                    lp[uv_det].uv = (0.85, 0.85)
            except ValueError:
                pass

        lid_rings = []
        for phi_l in [0.15, 0.46, 0.78]:
            sp_l, cp_l = math.sin(phi_l), math.cos(phi_l)
            lr = []
            for iu_l in range(11):
                a_l = -0.10 * math.pi + (1.20 * math.pi * iu_l) / 10.0
                lx = 0.0365 * sp_l * math.cos(a_l)
                ly = 0.0385 * cp_l + sgn * lx * 0.34
                lz = 0.0355 * sp_l * math.sin(a_l)
                wx = ecx + lx * cy_e + lz * sy_e
                wz = ecz - lx * sy_e + lz * cy_e
                lr.append(bm_det.verts.new(v3(wx, ecy + ly, wz)))
            lid_rings.append(lr)
        for ir in range(len(lid_rings) - 1):
            for iu in range(10):
                try:
                    f = bm_det.faces.new([lid_rings[ir][iu], lid_rings[ir][iu + 1], lid_rings[ir + 1][iu + 1], lid_rings[ir + 1][iu]])
                    for lp in f.loops:
                        lp[uv_det].uv = (0.06, 0.68)
                except ValueError:
                    pass

    # 4. Ornate 3D Beveled Pelagian Hydro-Conduit Armor, 4-Prong Seed Cradle & Bladed Gauntlet!
    def _add_gear_tube(pts_t3, rx, ry, band):
        pts = [Vector(p) for p in pts_t3]
        segs = 10
        rings = []
        for i, p in enumerate(pts):
            tg = (pts[1] - pts[0]) if i == 0 else ((pts[-1] - pts[-2]) if i == len(pts) - 1 else (pts[i + 1] - pts[i - 1]))
            tg.normalize()
            up = Vector((0.0, 0.0, 1.0)) if abs(tg.z) < 0.82 else Vector((0.0, 1.0, 0.0))
            n1 = tg.cross(up).normalized()
            n2 = n1.cross(tg).normalized()
            rings.append([bm_det.verts.new(v3(*(p + n1 * (math.cos(2 * math.pi * s / segs) * rx) + n2 * (math.sin(2 * math.pi * s / segs) * ry)))) for s in range(segs)])
        for i in range(len(rings) - 1):
            u0, u1 = (i / float(len(rings) - 1)) * 0.85, ((i + 1) / float(len(rings) - 1)) * 0.85
            for s in range(segs):
                sn = (s + 1) % segs
                try:
                    f = bm_det.faces.new([rings[i][s], rings[i][sn], rings[i + 1][sn], rings[i + 1][s]])
                    f.loops[0][uv_det].uv = _uv_gear(u0, band)
                    f.loops[1][uv_det].uv = _uv_gear(u0 + 0.08, band)
                    f.loops[2][uv_det].uv = _uv_gear(u1 + 0.08, band)
                    f.loops[3][uv_det].uv = _uv_gear(u1, band)
                except ValueError:
                    pass

    def _add_gear_gem(center_t3, radii_t3, band, u_s=14, v_s=10):
        cx, cy, cz = center_t3
        rx, ry, rz = radii_t3
        rings = []
        for iv in range(1, v_s):
            phi = -math.pi * 0.5 + (math.pi * iv) / v_s
            cp, sp = math.cos(phi), math.sin(phi)
            rings.append([bm_det.verts.new(v3(cx + rx * cp * math.cos(2 * math.pi * iu / u_s), cy + ry * sp, cz + rz * cp * math.sin(2 * math.pi * iu / u_s))) for iu in range(u_s)])
        for ir in range(len(rings) - 1):
            for iu in range(u_s):
                iun = (iu + 1) % u_s
                try:
                    f = bm_det.faces.new([rings[ir][iu], rings[ir][iun], rings[ir + 1][iun], rings[ir + 1][iu]])
                    for k in range(4):
                        f.loops[k][uv_det].uv = _uv_gear((iu + (1 if k in (1, 2) else 0)) / float(u_s), band)
                except ValueError:
                    pass
        for cap_y, r_end, flip in ((cy - ry, rings[0], True), (cy + ry, rings[-1], False)):
            vc = bm_det.verts.new(v3(cx, cap_y, cz))
            for iu in range(u_s):
                iun = (iu + 1) % u_s
                verts_tri = [vc, r_end[iun], r_end[iu]] if flip else [vc, r_end[iu], r_end[iun]]
                try:
                    f = bm_det.faces.new(verts_tri)
                    for lp in f.loops:
                        lp[uv_det].uv = _uv_gear(0.5, band)
                except ValueError:
                    pass

    for sgn in (1.0, -1.0):
        # Pearlescent collarbone mantle + twin raised embossed gold filigree border trims!
        _add_gear_tube([(0.0, 0.808, 0.098), (sgn * 0.068, 0.844, 0.072), (sgn * 0.094, 0.878, 0.004), (sgn * 0.066, 0.842, -0.076), (0.0, 0.798, -0.088)], 0.014, 0.006, band=0)
        _add_gear_tube([(0.0, 0.818, 0.100), (sgn * 0.072, 0.854, 0.074), (sgn * 0.098, 0.886, 0.004), (sgn * 0.070, 0.850, -0.078), (0.0, 0.808, -0.090)], 0.0055, 0.0045, band=1)
        _add_gear_tube([(0.0, 0.790, 0.098), (sgn * 0.088, 0.758, 0.066), (sgn * 0.106, 0.752, -0.010), (0.0, 0.775, -0.088)], 0.009, 0.005, band=1)
        # Sculpted Pelagian hip guardian V-belt + lateral thigh filigree tassets!
        _add_gear_tube([(0.0, 0.558, 0.082), (sgn * 0.088, 0.590, 0.052), (sgn * 0.105, 0.596, -0.018), (0.0, 0.575, -0.082)], 0.0095, 0.005, band=1)
        _add_gear_tube([(sgn * 0.108, 0.588, 0.018), (sgn * 0.120, 0.525, 0.022), (sgn * 0.118, 0.468, 0.028)], 0.018, 0.0045, band=0)
        _add_gear_tube([(sgn * 0.110, 0.588, 0.022), (sgn * 0.123, 0.525, 0.026), (sgn * 0.120, 0.465, 0.032)], 0.0045, 0.0045, band=1)
        # Left wrist golden Pelagian cuff bracer for balanced heroic silhouette!
        if sgn > 0:
            _add_gear_tube([(0.190, 0.562, 0.015), (0.198, 0.515, 0.028)], 0.024, 0.022, band=1)

    # Sternum Harmonic Medallion + 4-Prong Dorsal Royal Pelagian Harmonic Water Seed Cradle!
    _add_gear_gem((0.0, 0.804, 0.100), (0.026, 0.035, 0.012), band=1)
    _add_gear_gem((0.0, 0.804, 0.107), (0.016, 0.024, 0.010), band=2)

    _add_gear_gem((0.0, 0.805, -0.090), (0.054, 0.082, 0.024), band=0)
    _add_gear_gem((0.0, 0.805, -0.100), (0.040, 0.064, 0.022), band=1)
    _add_gear_gem((0.0, 0.805, -0.114), (0.026, 0.048, 0.024), band=2)
    for px_s, py_s in [(-0.028, 0.848), (0.028, 0.848), (-0.028, 0.762), (0.028, 0.762)]:
        _add_gear_tube([(px_s * 1.2, py_s, -0.092), (px_s * 0.65, py_s * 0.99 + 0.008, -0.128)], 0.0055, 0.0055, band=1)

    # Right-Forearm Multi-Bladed Pelagian Hydro-Caster Gauntlet!
    _add_gear_tube([(-0.176, 0.635, -0.004), (-0.188, 0.572, 0.012), (-0.198, 0.512, 0.028)], 0.030, 0.027, band=0)
    _add_gear_tube([(-0.178, 0.636, -0.004), (-0.199, 0.510, 0.029)], 0.032, 0.006, band=1)
    _add_gear_tube([(-0.198, 0.625, -0.014), (-0.222, 0.562, 0.008), (-0.218, 0.502, 0.038)], 0.006, 0.016, band=2)
    _add_gear_gem((-0.205, 0.495, 0.044), (0.023, 0.016, 0.023), band=1)
    _add_gear_gem((-0.208, 0.482, 0.055), (0.015, 0.015, 0.018), band=2)

    bmesh.ops.recalc_face_normals(bm_det, faces=bm_det.faces)
    bm_det.to_mesh(body_obj.data)
    bm_det.free()
    for poly in body_obj.data.polygons:
        poly.use_smooth = True

    # Smooth Multi-Bone Skinning Weights
    body_obj.parent = arm_obj
    arm_mod = body_obj.modifiers.new(name="Armature", type="ARMATURE")
    arm_mod.object = arm_obj

    bone_names = [b[0] for b in BONE_SPECS if b[0] != "Root"]
    vgroups = {bn: body_obj.vertex_groups.new(name=bn) for bn in bone_names}
    body_obj.vertex_groups.new(name="Root")

    seg_list = []
    for bname, pname, h_t3, t_t3, _ in BONE_SPECS:
        if bname == "Root":
            continue
        hv, tv = Vector(h_t3), Vector(t_t3)
        sigma = 0.024 if bname in ("EyeL", "EyeR", "EyelidL", "EyelidR") else (0.044 if (bname.startswith("Frill") or bname == "Jaw") else (0.048 if bname in ("HandL", "HandR", "FootL", "FootR", "AnkleL", "AnkleR") else (0.068 if bname.startswith("Tail") else 0.078)))
        seg_list.append((bname, hv, tv, sigma))

    mesh = body_obj.data
    n_verts = len(mesh.vertices)
    b_idx_map = {bn: idx for idx, (bn, _, _, _) in enumerate(seg_list)}
    W = np.zeros((n_verts, len(seg_list)), dtype=np.float32)

    for vi, v in enumerate(mesh.vertices):
        tx, ty, tz = b2t(v.co)
        pt = Vector((tx, ty, tz))
        for bi, (bname, hv, tv, sigma) in enumerate(seg_list):
            if bname.endswith("L") and tx < -0.015:
                continue
            if bname.endswith("R") and tx > 0.015:
                continue
            if bname.startswith("Tail") and (tz > -0.15 and ty < 0.34):
                continue
            if bname in ("ThighL", "ThighR", "ShinL", "ShinR", "AnkleL", "AnkleR", "FootL", "FootR") and tz < -0.13 and abs(tx) < 0.065:
                continue
            if bname in ("EyeL", "EyeR", "EyelidL", "EyelidR") and (pt - hv).length > 0.046:
                continue
            if bname == "Jaw" and (ty > 1.008 or tz < 0.035 or abs(tx) > 0.052):
                continue

            ab = tv - hv
            ab_len2 = ab.length_squared
            t_proj = clamp01((pt - hv).dot(ab) / ab_len2) if ab_len2 > 1e-8 else 0.0
            dist = (pt - (hv + ab * t_proj)).length
            W[vi, bi] = math.exp(-((dist / sigma) ** 2) * 1.65) / ((dist + 0.014) ** 2)

    eye_verts = set()
    for poly in mesh.polygons:
        u0, v0 = mesh.uv_layers.active.data[poly.loop_indices[0]].uv
        if u0 > 0.71 and v0 > 0.71:
            for v_i in poly.vertices:
                eye_verts.add(v_i)
    for v_i in eye_verts:
        tx, _, _ = b2t(mesh.vertices[v_i].co)
        W[v_i, :] = 0.0
        W[v_i, b_idx_map["EyeL" if tx >= 0 else "EyeR"]] = 1.0

    row_sums = W.sum(axis=1, keepdims=True)
    W[row_sums[:, 0] < 1e-8, b_idx_map["Pelvis"]] = 1.0
    W /= np.maximum(1e-8, W.sum(axis=1, keepdims=True))

    adj = [[] for _ in range(n_verts)]
    for e in mesh.edges:
        a, b = e.vertices[0], e.vertices[1]
        if a not in eye_verts and b not in eye_verts:
            adj[a].append(b)
            adj[b].append(a)
    for _ in range(2):
        W_next = W.copy()
        for vi in range(n_verts):
            if vi in eye_verts or not adj[vi]:
                continue
            W_next[vi] = 0.68 * W[vi] + 0.32 * W[adj[vi]].mean(axis=0)
        W = W_next / np.maximum(1e-8, W_next.sum(axis=1, keepdims=True))

    for vi in range(n_verts):
        row = W[vi]
        top4 = np.argsort(row)[-4:]
        sub_w = np.where(row[top4] > 0.005, row[top4], 0.0)
        s = float(sub_w.sum())
        if s <= 1e-8:
            vgroups["Pelvis"].add([vi], 1.0, "REPLACE")
            continue
        sub_w /= s
        for idx_k, bi in enumerate(top4):
            wv = float(sub_w[idx_k])
            if wv > 0.002:
                vgroups[seg_list[bi][0]].add([vi], wv, "REPLACE")

    # Bake All 18 NLA Skeletal Animations
    def _zero_pose():
        for pb in arm_obj.pose.bones:
            pb.location = (0.0, 0.0, 0.0)
            pb.rotation_euler = (0.0, 0.0, 0.0)
            pb.scale = (1.0, 1.0, 1.0)

    def _set_rot(bname, rx=0.0, ry=0.0, rz=0.0):
        pb = arm_obj.pose.bones.get(bname)
        if pb:
            pb.rotation_euler = (float(rx), float(ry), float(rz))

    def _set_loc_t3(bname, dx=0.0, dy=0.0, dz=0.0):
        pb = arm_obj.pose.bones.get(bname)
        if pb:
            pb.location = (float(dx), float(dy), float(dz))

    def _set_tail_wave(phase, amp_yaw, amp_pitch, base_lift=0.0, freq_step=0.62):
        for ti in range(1, 8):
            ang = phase - (ti - 1) * freq_step
            falloff = 0.72 + 0.08 * ti
            _set_rot(f"Tail{ti}", base_lift * (1.0 if ti <= 3 else -0.45) + math.cos(ang) * amp_pitch * falloff, 0.0, math.sin(ang) * amp_yaw * falloff)

    def _eval_clip_pose(clip_name, u):
        _zero_pose()
        p = u * 2.0 * math.pi
        sp, cp = math.sin(p), math.cos(p)
        c2 = math.cos(2.0 * p)

        if clip_name == "IdleBreathe":
            _set_loc_t3("Pelvis", 0.008 * sp, -0.006 + 0.008 * cp, 0.0)
            _set_rot("Pelvis", 0.02 * cp, 0.06 * sp, 0.02 * sp)
            _set_rot("Spine1", 0.02 - 0.02 * cp, -0.03 * sp, -0.02 * sp)
            _set_rot("Spine2", 0.02 - 0.02 * cp, -0.03 * sp, 0.0)
            _set_rot("Chest", 0.02 - 0.03 * cp, -0.02 * sp, 0.0)
            _set_rot("Neck", -0.04 + 0.02 * cp, 0.05 * sp, 0.0)
            _set_rot("Head", 0.02 + 0.02 * cp, 0.08 * sp, 0.05 * cp)
            blink = max(0.0, math.sin((u - 0.72) / 0.10 * math.pi)) if 0.72 <= u <= 0.82 else 0.0
            _set_rot("EyelidL", 0.72 * blink, 0.0, 0.0)
            _set_rot("EyelidR", 0.72 * blink, 0.0, 0.0)
            _set_rot("FrillL1", 0.08 + 0.05 * cp, 0.0, 0.0)
            _set_rot("FrillL2", 0.10 + 0.07 * sp, 0.0, 0.0)
            _set_rot("FrillR1", 0.08 + 0.05 * cp, 0.0, 0.0)
            _set_rot("FrillR2", 0.10 + 0.07 * sp, 0.0, 0.0)
            _set_rot("UpperArmL", -0.06 + 0.03 * sp, 0.0, -0.14)
            _set_rot("ForearmL", 0.34, 0.0, 0.0)
            _set_rot("UpperArmR", 0.06 - 0.03 * sp, 0.0, 0.16)
            _set_rot("ForearmR", 0.40, 0.0, 0.0)
            knee_flex = 0.03 * (1.0 - cp)
            for s in ("L", "R"):
                _set_rot(f"Thigh{s}", knee_flex, 0.0, 0.0)
                _set_rot(f"Shin{s}", -2.0 * knee_flex, 0.0, 0.0)
                _set_rot(f"Ankle{s}", knee_flex, 0.0, 0.0)
                _set_rot(f"Foot{s}", 0.0, 0.0, 0.0)
            _set_tail_wave(p, amp_yaw=0.16, amp_pitch=0.05, base_lift=0.04)

        elif clip_name in ("Walk", "FluidRun", "StairClimb"):
            is_run, is_stair = (clip_name == "FluidRun"), (clip_name == "StairClimb")
            stride = 0.68 if is_run else (0.58 if is_stair else 0.40)
            lift = 0.56 if is_stair else (0.48 if is_run else 0.28)
            lean = 0.24 if is_run else (0.20 if is_stair else 0.09)
            bounce = 0.038 if is_run else (0.045 if is_stair else 0.020)
            _set_loc_t3("Pelvis", 0.014 * sp, abs(cp) * bounce - 0.018, 0.0)
            _set_rot("Pelvis", lean * 0.35, 0.16 * sp, 0.06 * cp)
            _set_rot("Spine1", lean * 0.35, -0.09 * sp, -0.04 * cp)
            _set_rot("Spine2", lean * 0.30, -0.09 * sp, 0.0)
            _set_rot("Chest", lean * 0.25 + 0.02 * c2, -0.08 * sp, 0.0)
            _set_rot("Neck", -lean * 0.45, 0.06 * sp, 0.0)
            _set_rot("Head", -lean * 0.40 + (0.08 if is_stair else 0.0), 0.06 * sp, 0.0)
            fr_fold = -0.14 if is_run else 0.05
            for fn in ("FrillL1", "FrillL2", "FrillR1", "FrillR2"):
                _set_rot(fn, fr_fold + 0.05 * c2, 0.0, 0.0)
            l_up, r_up = max(0.0, cp), max(0.0, -cp)
            _set_rot("ThighL", sp * stride + l_up * lift * 0.55, 0.0, 0.0)
            _set_rot("ShinL", -l_up * lift * 1.35 - max(0.0, -sp) * 0.22, 0.0, 0.0)
            _set_rot("AnkleL", l_up * lift * 0.65 - sp * 0.20, 0.0, 0.0)
            _set_rot("FootL", -max(0.0, -sp) * 0.32 + l_up * 0.22, 0.0, 0.0)
            _set_rot("ThighR", -sp * stride + r_up * lift * 0.55, 0.0, 0.0)
            _set_rot("ShinR", -r_up * lift * 1.35 - max(0.0, sp) * 0.22, 0.0, 0.0)
            _set_rot("AnkleR", r_up * lift * 0.65 + sp * 0.20, 0.0, 0.0)
            _set_rot("FootR", -max(0.0, sp) * 0.32 + r_up * 0.22, 0.0, 0.0)
            arm_amp = 0.65 if is_run else (0.55 if is_stair else 0.36)
            _set_rot("UpperArmL", -sp * arm_amp, 0.0, -0.18)
            _set_rot("ForearmL", 0.52 + max(0.0, -sp) * 0.35, 0.0, 0.0)
            _set_rot("UpperArmR", sp * arm_amp, 0.0, 0.18)
            _set_rot("ForearmR", 0.52 + max(0.0, sp) * 0.35, 0.0, 0.0)
            _set_tail_wave(p, amp_yaw=(0.26 if is_run else 0.18), amp_pitch=0.07, base_lift=(0.10 if is_run else 0.06))

        elif clip_name == "JumpCoil":
            t = math.sin(u * math.pi * 0.5)
            _set_loc_t3("Pelvis", 0.0, -0.145 * t, -0.04 * t)
            _set_rot("Pelvis", 0.28 * t, 0.0, 0.0)
            _set_rot("Spine1", 0.18 * t, 0.0, 0.0)
            _set_rot("Chest", 0.14 * t, 0.0, 0.0)
            _set_rot("Head", -0.36 * t, 0.0, 0.0)
            for fn in ("FrillL1", "FrillL2", "FrillR1", "FrillR2"):
                _set_rot(fn, 0.28 * t, 0.0, 0.0)
            for s in ("L", "R"):
                sgn = -1.0 if s == "L" else 1.0
                _set_rot(f"UpperArm{s}", -0.58 * t, 0.0, sgn * 0.32 * t)
                _set_rot(f"Forearm{s}", 0.65 * t, 0.0, 0.0)
                _set_rot(f"Thigh{s}", 0.62 * t, 0.0, 0.0)
                _set_rot(f"Shin{s}", -0.92 * t, 0.0, 0.0)
                _set_rot(f"Ankle{s}", 0.52 * t, 0.0, 0.0)
            _set_tail_wave(0.8 * t, amp_yaw=0.14, amp_pitch=0.12, base_lift=0.20 * t)

        elif clip_name == "AirRise":
            _set_loc_t3("Pelvis", 0.0, 0.03 * sp, 0.0)
            _set_rot("Pelvis", -0.10, 0.05 * sp, 0.0)
            _set_rot("Spine1", -0.08, 0.0, 0.0)
            _set_rot("Chest", -0.10, 0.0, 0.0)
            _set_rot("Head", -0.14 + 0.04 * cp, 0.0, 0.0)
            for fn in ("FrillL1", "FrillL2", "FrillR1", "FrillR2"):
                _set_rot(fn, 0.36 + 0.08 * sp, 0.0, 0.0)
            _set_rot("UpperArmL", 0.65 + 0.08 * sp, 0.0, -0.45)
            _set_rot("ForearmL", 0.42, 0.0, 0.0)
            _set_rot("UpperArmR", 0.52 - 0.08 * sp, 0.0, 0.45)
            _set_rot("ForearmR", 0.48, 0.0, 0.0)
            _set_rot("ThighL", 0.72, 0.0, 0.0)
            _set_rot("ShinL", -0.95, 0.0, 0.0)
            _set_rot("AnkleL", 0.35, 0.0, 0.0)
            _set_rot("ThighR", -0.32, 0.0, 0.0)
            _set_rot("ShinR", -0.18, 0.0, 0.0)
            _set_rot("FootR", -0.42, 0.0, 0.0)
            _set_tail_wave(p, amp_yaw=0.16, amp_pitch=0.10, base_lift=-0.22)

        elif clip_name == "FrillGlide":
            _set_loc_t3("Pelvis", 0.02 * sp, 0.02 * cp, 0.0)
            _set_rot("Pelvis", 0.48, 0.06 * sp, 0.08 * sp)
            _set_rot("Spine1", 0.14, 0.0, 0.0)
            _set_rot("Chest", -0.12, 0.0, 0.0)
            _set_rot("Neck", -0.22, 0.0, 0.0)
            _set_rot("Head", -0.24 + 0.04 * cp, 0.06 * sp, 0.0)
            for fn in ("FrillL1", "FrillL2", "FrillR1", "FrillR2"):
                _set_rot(fn, 0.58 + 0.08 * c2, 0.0, 0.0)
            _set_rot("UpperArmL", 0.18, 0.0, -1.08 + 0.06 * cp)
            _set_rot("ForearmL", 0.18, 0.0, -0.15)
            _set_rot("UpperArmR", 0.18, 0.0, 1.08 - 0.06 * cp)
            _set_rot("ForearmR", 0.18, 0.0, 0.15)
            for s in ("L", "R"):
                _set_rot(f"Thigh{s}", -0.36 + 0.05 * sp, 0.0, (-0.18 if s == "L" else 0.18))
                _set_rot(f"Shin{s}", -0.28, 0.0, 0.0)
                _set_rot(f"Foot{s}", -0.35, 0.0, 0.0)
            _set_tail_wave(p, amp_yaw=0.26, amp_pitch=0.08, base_lift=0.14)

        elif clip_name == "Fall":
            _set_rot("Pelvis", 0.14, 0.05 * sp, 0.0)
            _set_rot("Spine1", 0.10, 0.0, 0.0)
            _set_rot("Head", 0.24 + 0.04 * sp, 0.0, 0.0)
            for fn in ("FrillL1", "FrillL2", "FrillR1", "FrillR2"):
                _set_rot(fn, 0.42 + 0.10 * c2, 0.0, 0.0)
            _set_rot("UpperArmL", 0.35 + 0.08 * sp, 0.0, -0.78)
            _set_rot("ForearmL", 0.45, 0.0, 0.0)
            _set_rot("UpperArmR", 0.35 - 0.08 * sp, 0.0, 0.78)
            _set_rot("ForearmR", 0.45, 0.0, 0.0)
            _set_rot("ThighL", 0.36 + 0.06 * sp, 0.0, 0.0)
            _set_rot("ShinL", -0.45, 0.0, 0.0)
            _set_rot("ThighR", 0.56 - 0.06 * sp, 0.0, 0.0)
            _set_rot("ShinR", -0.78, 0.0, 0.0)
            _set_tail_wave(p, amp_yaw=0.20, amp_pitch=0.12, base_lift=0.28)

        elif clip_name == "Land":
            env = math.sin(u * math.pi) * (1.0 - 0.45 * u)
            _set_loc_t3("Pelvis", 0.0, -0.155 * env, 0.0)
            _set_rot("Pelvis", 0.26 * env, 0.0, 0.0)
            _set_rot("Spine1", 0.22 * env, 0.0, 0.0)
            _set_rot("Chest", 0.16 * env, 0.0, 0.0)
            _set_rot("Head", -0.28 * env, 0.0, 0.0)
            for s in ("L", "R"):
                sgn = -1.0 if s == "L" else 1.0
                _set_rot(f"UpperArm{s}", 0.32 * env, 0.0, sgn * 0.55 * env)
                _set_rot(f"Forearm{s}", 0.52 * env, 0.0, 0.0)
                _set_rot(f"Thigh{s}", 0.64 * env, 0.0, 0.0)
                _set_rot(f"Shin{s}", -0.96 * env, 0.0, 0.0)
                _set_rot(f"Ankle{s}", 0.32 * env, 0.0, 0.0)
            _set_tail_wave(u * 4.0, amp_yaw=0.22 * env, amp_pitch=0.18 * env, base_lift=-0.16 * env)

        elif clip_name == "LedgeMantle":
            arc = math.sin(u * math.pi)
            _set_loc_t3("Pelvis", 0.0, -0.18 * (1.0 - u) + 0.06 * arc, 0.06 * arc)
            _set_rot("Pelvis", 0.38 * arc, 0.0, 0.0)
            _set_rot("Spine1", 0.28 * arc, 0.0, 0.0)
            _set_rot("Head", -0.35 * arc, 0.0, 0.0)
            for s in ("L", "R"):
                sgn = -1.0 if s == "L" else 1.0
                _set_rot(f"UpperArm{s}", (1.15 - 1.35 * u) * arc, 0.0, sgn * 0.28)
                _set_rot(f"Forearm{s}", 0.72 * arc, 0.0, 0.0)
                _set_rot(f"Thigh{s}", 0.78 * arc, 0.0, 0.0)
                _set_rot(f"Shin{s}", -1.05 * arc, 0.0, 0.0)
            _set_tail_wave(u * 5.0, amp_yaw=0.26, amp_pitch=0.14, base_lift=0.20 * arc)

        elif clip_name == "WallScamper":
            _set_loc_t3("Pelvis", 0.025 * sp, 0.02 * c2, 0.02)
            _set_rot("Pelvis", -0.18, 0.0, 0.16 * sp)
            _set_rot("Spine1", -0.10, 0.0, 0.18 * sp)
            _set_rot("Chest", -0.08, 0.0, -0.16 * sp)
            _set_rot("Head", -0.45, 0.12 * sp, 0.0)
            _set_rot("UpperArmL", 1.25 + 0.48 * sp, 0.0, -0.48)
            _set_rot("ForearmL", 0.65 - 0.25 * sp, 0.0, 0.0)
            _set_rot("UpperArmR", 1.25 - 0.48 * sp, 0.0, 0.48)
            _set_rot("ForearmR", 0.65 + 0.25 * sp, 0.0, 0.0)
            _set_rot("ThighL", 0.58 - 0.45 * sp, 0.0, -0.35)
            _set_rot("ShinL", -0.82 + 0.30 * sp, 0.0, 0.0)
            _set_rot("ThighR", 0.58 + 0.45 * sp, 0.0, 0.35)
            _set_rot("ShinR", -0.82 - 0.30 * sp, 0.0, 0.0)
            _set_tail_wave(p, amp_yaw=0.34, amp_pitch=0.06, base_lift=-0.10)

        elif clip_name == "TailWhip":
            spin_u = clamp01((u - 0.08) / 0.80)
            spin_ease = spin_u * spin_u * (3.0 - 2.0 * spin_u)
            whip_arc = math.sin(u * math.pi)
            _set_loc_t3("Pelvis", 0.0, 0.08 * whip_arc - 0.04, 0.0)
            _set_rot("Pelvis", 0.26 * whip_arc, spin_ease * 2.0 * math.pi, 0.0)
            _set_rot("Spine1", 0.18 * whip_arc, 0.22 * math.sin(u * 2.0 * math.pi), 0.0)
            _set_rot("Chest", 0.12 * whip_arc, 0.18 * math.sin(u * 2.0 * math.pi), 0.0)
            _set_rot("Head", -0.22 * whip_arc, -0.25 * math.sin(u * 2.0 * math.pi), 0.0)
            for fn in ("FrillL1", "FrillL2", "FrillR1", "FrillR2"):
                _set_rot(fn, 0.55 * whip_arc, 0.0, 0.0)
            _set_rot("UpperArmL", 0.22, 0.0, -0.85 * whip_arc - 0.18)
            _set_rot("UpperArmR", 0.22, 0.0, 0.85 * whip_arc + 0.18)
            _set_rot("ThighL", 0.45 * whip_arc, 0.0, -0.22 * whip_arc)
            _set_rot("ShinL", -0.65 * whip_arc, 0.0, 0.0)
            _set_rot("ThighR", 0.25 * whip_arc, 0.0, 0.22 * whip_arc)
            for ti in range(1, 8):
                _set_rot(f"Tail{ti}", 0.08 * whip_arc, 0.0, -0.24 * whip_arc * (0.6 + 0.1 * ti))

        elif clip_name == "HydroCast":
            punch = math.sin(min(1.0, u * 1.45) * math.pi) if u < 0.69 else math.sin(((1.0 - u) / 0.31) * math.pi * 0.5) * 0.25
            _set_rot("Pelvis", 0.10 * punch, -0.22 * punch, 0.0)
            _set_rot("Spine1", 0.08 * punch, 0.28 * punch, 0.0)
            _set_rot("Chest", 0.08 * punch, 0.34 * punch, 0.0)
            _set_rot("Head", -0.12 * punch, -0.32 * punch, 0.0)
            for fn in ("FrillL1", "FrillL2", "FrillR1", "FrillR2"):
                _set_rot(fn, 0.46 * punch, 0.0, 0.0)
            _set_rot("ClavicleR", 0.18 * punch, 0.20 * punch, 0.0)
            _set_rot("UpperArmR", 1.32 * punch, 0.0, 0.16)
            _set_rot("ForearmR", 0.18 * (1.0 - punch), 0.0, 0.0)
            _set_rot("HandR", -0.58 * punch, 0.0, 0.0)
            _set_rot("UpperArmL", -0.52 * punch, 0.0, -0.42 * punch - 0.14)
            _set_rot("ForearmL", 0.62, 0.0, 0.0)
            _set_tail_wave(u * 2.0 * math.pi, amp_yaw=0.22, amp_pitch=0.06, base_lift=0.14 * punch)

        elif clip_name == "FreeSwim":
            _set_loc_t3("Pelvis", 0.045 * sp, 0.03 * cp, 0.0)
            _set_rot("Pelvis", 1.08, 0.22 * sp, 0.12 * cp)
            _set_rot("Spine1", 0.08, -0.18 * cp, 0.0)
            _set_rot("Chest", -0.14, -0.14 * sp, 0.0)
            _set_rot("Neck", -0.38, 0.12 * sp, 0.0)
            _set_rot("Head", -0.42, 0.10 * cp, 0.0)
            for fn in ("FrillL1", "FrillL2", "FrillR1", "FrillR2"):
                _set_rot(fn, 0.25 + 0.14 * cp, 0.0, 0.0)
            _set_rot("UpperArmL", -0.78 + 0.14 * sp, 0.0, -0.22)
            _set_rot("ForearmL", 0.25, 0.0, 0.0)
            _set_rot("UpperArmR", -0.78 - 0.14 * sp, 0.0, 0.22)
            _set_rot("ForearmR", 0.25, 0.0, 0.0)
            _set_rot("ThighL", -0.55 + 0.18 * sp, 0.0, -0.12)
            _set_rot("ShinL", -0.22, 0.0, 0.0)
            _set_rot("FootL", -0.52, 0.0, 0.0)
            _set_rot("ThighR", -0.55 - 0.18 * sp, 0.0, 0.12)
            _set_rot("ShinR", -0.22, 0.0, 0.0)
            _set_rot("FootR", -0.52, 0.0, 0.0)
            _set_tail_wave(p, amp_yaw=0.38, amp_pitch=0.06, base_lift=0.04, freq_step=0.72)

        elif clip_name == "RapidsSurf":
            _set_loc_t3("Pelvis", 0.03 * sp, -0.095 + 0.022 * c2, 0.0)
            _set_rot("Pelvis", 0.16, 0.52, 0.08 * sp)
            _set_rot("Spine1", 0.10, -0.18, -0.06 * sp)
            _set_rot("Chest", 0.08, -0.22, 0.0)
            _set_rot("Head", -0.18, -0.12 + 0.05 * sp, 0.06 * sp)
            for fn in ("FrillL1", "FrillL2", "FrillR1", "FrillR2"):
                _set_rot(fn, 0.34 + 0.08 * c2, 0.0, 0.0)
            _set_rot("UpperArmL", 0.45 + 0.08 * sp, 0.0, -0.78)
            _set_rot("ForearmL", 0.35, 0.0, 0.0)
            _set_rot("UpperArmR", -0.35 - 0.08 * sp, 0.0, 0.72)
            _set_rot("ForearmR", 0.42, 0.0, 0.0)
            _set_rot("ThighL", 0.52 + 0.05 * c2, 0.0, -0.24)
            _set_rot("ShinL", -0.72 - 0.06 * c2, 0.0, 0.0)
            _set_rot("AnkleL", 0.20, 0.0, 0.0)
            _set_rot("ThighR", 0.38 + 0.05 * c2, 0.0, 0.24)
            _set_rot("ShinR", -0.58 - 0.06 * c2, 0.0, 0.0)
            _set_rot("AnkleR", 0.20, 0.0, 0.0)
            _set_tail_wave(p, amp_yaw=0.28, amp_pitch=0.05, base_lift=-0.10)

        elif clip_name == "CoreDive":
            _set_loc_t3("Pelvis", 0.02 * sp, 0.02 * cp, 0.0)
            _set_rot("Pelvis", 1.38, 0.10 * sp, 0.10 * cp)
            _set_rot("Spine1", 0.12, 0.0, 0.0)
            _set_rot("Chest", -0.10, 0.0, 0.0)
            _set_rot("Head", -0.52, 0.08 * sp, 0.0)
            for fn in ("FrillL1", "FrillL2", "FrillR1", "FrillR2"):
                _set_rot(fn, -0.22 + 0.08 * c2, 0.0, 0.0)
            _set_rot("UpperArmL", -0.62, 0.0, -0.45 + 0.06 * sp)
            _set_rot("ForearmL", 0.32, 0.0, 0.0)
            _set_rot("UpperArmR", -0.62, 0.0, 0.45 - 0.06 * sp)
            _set_rot("ForearmR", 0.32, 0.0, 0.0)
            for s in ("L", "R"):
                _set_rot(f"Thigh{s}", -0.48, 0.0, (-0.15 if s == "L" else 0.15))
                _set_rot(f"Shin{s}", -0.35, 0.0, 0.0)
                _set_rot(f"Foot{s}", -0.45, 0.0, 0.0)
            _set_tail_wave(p, amp_yaw=0.24, amp_pitch=0.14, base_lift=0.08)

        elif clip_name == "Celebrate":
            hop = abs(sp)
            _set_loc_t3("Pelvis", 0.0, 0.12 * hop - 0.015, 0.0)
            _set_rot("Pelvis", -0.08 * hop, 0.25 * cp, 0.06 * sp)
            _set_rot("Chest", -0.16, -0.12 * cp, 0.0)
            _set_rot("Head", -0.18, 0.14 * cp, 0.08 * sp)
            _set_rot("Jaw", 0.16 * hop, 0.0, 0.0)
            for fn in ("FrillL1", "FrillL2", "FrillR1", "FrillR2"):
                _set_rot(fn, 0.56 + 0.10 * c2, 0.0, 0.0)
            _set_rot("UpperArmL", 2.25 + 0.22 * sp, 0.0, -0.42)
            _set_rot("ForearmL", 0.35, 0.0, 0.0)
            _set_rot("UpperArmR", 2.25 - 0.22 * sp, 0.0, 0.42)
            _set_rot("ForearmR", 0.35, 0.0, 0.0)
            _set_rot("ThighL", 0.35 * hop, 0.0, -0.12)
            _set_rot("ShinL", -0.55 * hop, 0.0, 0.0)
            _set_rot("ThighR", -0.15 * hop, 0.0, 0.12)
            _set_rot("ShinR", -0.25 * hop, 0.0, 0.0)
            _set_tail_wave(p * 2.0, amp_yaw=0.30, amp_pitch=0.14, base_lift=0.14)

        elif clip_name == "CutsceneHero":
            _set_loc_t3("Pelvis", 0.01 * sp, -0.004 + 0.006 * cp, 0.0)
            _set_rot("Pelvis", -0.02, 0.12 * sp, 0.02 * cp)
            _set_rot("Spine1", -0.03, -0.05 * sp, 0.0)
            _set_rot("Chest", -0.05, -0.06 * sp, 0.0)
            _set_rot("Neck", -0.04, 0.12 * cp, 0.0)
            _set_rot("Head", -0.03 + 0.03 * sp, 0.16 * cp, 0.05 * sp)
            blink = max(0.0, math.sin((u - 0.45) / 0.08 * math.pi)) if 0.45 <= u <= 0.53 else 0.0
            _set_rot("EyelidL", 0.72 * blink, 0.0, 0.0)
            _set_rot("EyelidR", 0.72 * blink, 0.0, 0.0)
            for fn in ("FrillL1", "FrillL2", "FrillR1", "FrillR2"):
                _set_rot(fn, 0.18 + 0.08 * sp, 0.0, 0.0)
            gesture = 0.5 + 0.5 * sp
            _set_rot("UpperArmR", 0.55 + 0.25 * gesture, -0.35, 0.12)
            _set_rot("ForearmR", 1.15 - 0.35 * gesture, 0.0, 0.0)
            _set_rot("UpperArmL", 0.18 * (1.0 - gesture), 0.0, -0.24 - 0.12 * gesture)
            _set_rot("ForearmL", 0.38, 0.0, 0.0)
            _set_tail_wave(p, amp_yaw=0.18, amp_pitch=0.06, base_lift=0.06)

    CLIP_SPECS = [
        ("IdleBreathe",  48, 4), ("Walk", 32, 2), ("FluidRun", 24, 2), ("StairClimb", 24, 2),
        ("JumpCoil",     12, 2), ("AirRise", 20, 2), ("FrillGlide", 32, 2), ("Fall", 24, 2),
        ("Land",         14, 2), ("LedgeMantle", 18, 2), ("WallScamper", 20, 2), ("TailWhip", 18, 1),
        ("HydroCast",    16, 2), ("FreeSwim", 32, 2), ("RapidsSurf", 28, 2), ("CoreDive", 24, 2),
        ("Celebrate",    40, 2), ("CutsceneHero", 60, 3),
    ]

    arm_obj.animation_data_create()
    anim_bones = [pb.name for pb in arm_obj.pose.bones if pb.name != "Root"]
    for clip_name, n_frames, step in CLIP_SPECS:
        act = bpy.data.actions.new(name=clip_name)
        act.use_fake_user = True
        arm_obj.animation_data.action = act
        if hasattr(act, "slots"):
            slot = act.slots.new(id_type="OBJECT", name=arm_obj.name) if len(act.slots) == 0 else act.slots[0]
            arm_obj.animation_data.action_slot = slot
        frames = list(range(1, n_frames + 1, step))
        if frames[-1] != n_frames:
            frames.append(n_frames)
        for fr in frames:
            u = (fr - 1) / float(max(1, n_frames - 1))
            scene.frame_set(fr)
            _eval_clip_pose(clip_name, u)
            for bname in anim_bones:
                pb = arm_obj.pose.bones[bname]
                pb.keyframe_insert(data_path="rotation_euler", frame=fr)
                if bname == "Pelvis":
                    pb.keyframe_insert(data_path="location", frame=fr)
        track = arm_obj.animation_data.nla_tracks.new()
        track.name = clip_name
        strip = track.strips.new(clip_name, 1, act)
        strip.name = clip_name
        track.mute = False

    arm_obj.animation_data.action = None
    scene.frame_set(1)
    _zero_pose()
    bpy.context.view_layer.update()

    # Export `assets/models/gateway.glb`
    out_glb = os.path.join(OUT_MODELS_DIR, "gateway.glb")
    bpy.ops.export_scene.gltf(
        filepath=out_glb,
        export_format="GLB",
        export_yup=True,
        export_apply=False,
        export_texcoords=True,
        export_normals=True,
        export_tangents=True,
        export_materials="EXPORT",
        export_skins=True,
        export_animations=True,
        export_animation_mode="NLA_TRACKS",
        export_nla_strips=True,
        export_rest_position_armature=True,
        export_force_sampling=True,
        export_frame_step=1,
        export_optimize_animation_size=True,
    )

    size_bytes = os.path.getsize(out_glb)
    with open(out_glb, "rb") as f:
        f.read(12)
        chunk_len, _ = struct.unpack("<II", f.read(8))
        gltf = json.loads(f.read(chunk_len).decode("utf-8"))

    accessors = gltf.get("accessors", [])
    tris = sum(accessors[p["indices"]]["count"] // 3 for m in gltf.get("meshes", []) for p in m.get("primitives", []) if "indices" in p)
    pos_acc = next(accessors[p["attributes"]["POSITION"]] for m in gltf.get("meshes", []) for p in m.get("primitives", []))

    # Render 4-Panel Cycles Close-Up + Multi-Pose Studio Proof Sheet!
    os.makedirs(os.path.dirname(PROOF_RENDER_PATH), exist_ok=True)
    engines = [e.identifier for e in scene.render.bl_rna.properties["engine"].enum_items]
    scene.render.engine = "CYCLES" if "CYCLES" in engines else engines[0]
    if scene.render.engine == "CYCLES":
        scene.cycles.samples = 32
        scene.cycles.use_denoising = False

    world = bpy.data.worlds.new("StudioWorld")
    scene.world = world
    world.use_nodes = True
    bg = world.node_tree.nodes.get("Background")
    if bg:
        bg.inputs[0].default_value = (0.032, 0.068, 0.115, 1.0)
        bg.inputs[1].default_value = 0.85

    def _add_light(name, energy, loc_t3, col):
        ld = bpy.data.lights.new(name=name, type="AREA")
        ld.energy, ld.size, ld.color = energy, 2.4, col
        lo = bpy.data.objects.new(name, ld)
        lo.location = v3(*loc_t3)
        lo.rotation_euler = (v3(0.0, 0.68, 0.0) - lo.location).to_track_quat("-Z", "Y").to_euler()
        scene.collection.objects.link(lo)

    _add_light("KeyLight", 125.0, (1.8, 2.1, 2.2), (1.0, 0.97, 0.92))
    _add_light("FillLight", 62.0, (-2.0, 1.2, 1.8), (0.65, 0.92, 1.0))
    _add_light("RimLight", 115.0, (-1.2, 1.9, -2.2), (0.45, 0.95, 0.90))

    cam_data = bpy.data.cameras.new("ProofCam")
    cam_obj = bpy.data.objects.new("ProofCam", cam_data)
    scene.collection.objects.link(cam_obj)
    scene.camera = cam_obj

    shots = [
        ("3q",      (1.02, 0.76, 1.48),  (0.00, 0.60, -0.06), 50.0, "IdleBreathe", 0.15),
        ("side",    (1.98, 0.64, -0.26), (0.00, 0.56, -0.34), 48.0, "FluidRun",    0.20),
        ("closeup", (0.22, 1.05, 0.58),  (0.00, 1.02,  0.03), 68.0, "CutsceneHero",0.20),
        ("back3q",  (-1.12, 0.88, -1.55),(0.00, 0.62, -0.22), 50.0, "HydroCast",   0.45),
    ]
    panel_size = 512
    scene.render.resolution_x = panel_size
    scene.render.resolution_y = panel_size
    panels = []
    for tag, c_pos, c_tgt, lens, clip_n, u_val in shots:
        _eval_clip_pose(clip_n, u_val)
        bpy.context.view_layer.update()
        cam_data.lens = lens
        cam_obj.location = v3(*c_pos)
        cam_obj.rotation_euler = (v3(*c_tgt) - cam_obj.location).to_track_quat("-Z", "Y").to_euler()
        tmp_p = PROOF_RENDER_PATH.replace(".png", f"_{tag}.png")
        scene.render.filepath = tmp_p
        bpy.ops.render.render(write_still=True)
        img_l = bpy.data.images.load(tmp_p)
        arr = np.empty(panel_size * panel_size * 4, dtype=np.float32)
        img_l.pixels.foreach_get(arr)
        panels.append(arr.reshape((panel_size, panel_size, 4)))

    _zero_pose()
    grid = np.concatenate([np.concatenate([panels[2], panels[3]], axis=1), np.concatenate([panels[0], panels[1]], axis=1)], axis=0)
    comp = bpy.data.images.new("ProofGrid", width=panel_size * 2, height=panel_size * 2, alpha=False)
    comp.pixels.foreach_set(grid.ravel())
    comp.filepath_raw = PROOF_RENDER_PATH
    comp.file_format = "PNG"
    comp.save()

    report = {
        "ok": True,
        "glb_path": out_glb,
        "size_bytes": size_bytes,
        "size_mb": round(size_bytes / (1024 * 1024), 3),
        "triangles": tris,
        "skin_count": len(gltf.get("skins", [])),
        "bone_count": len(gltf["skins"][0]["joints"]),
        "animation_count": len(gltf.get("animations", [])),
        "embedded_images": len(gltf.get("images", [])),
        "bounds_min_yup": pos_acc.get("min"),
        "bounds_max_yup": pos_acc.get("max"),
        "proof_render": PROOF_RENDER_PATH,
    }
    with open(DONE_JSON_PATH, "w", encoding="utf-8") as f:
        json.dump(report, f, indent=2)


if __name__ == "__main__":
    try:
        if "--textures-only" in sys.argv:
            paths = generate_weta_pbr_textures_py312(out_size=1024)
            print(json.dumps({"textures_ok": True, "paths": paths}))
        else:
            run_blender_pipeline()
    except Exception:
        if "--textures-only" not in sys.argv:
            with open(DONE_JSON_PATH, "w", encoding="utf-8") as ef:
                json.dump({"ok": False, "error": traceback.format_exc()}, ef, indent=2)
        raise
