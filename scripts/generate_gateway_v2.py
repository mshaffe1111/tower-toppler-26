"""
TOWERING WATERS: GATEWAY'S DESCENT — Gateway 2.0 Pixar/Nintendo Star Hero Pipeline
===================================================================================
Re-sculpts **Gateway** from scratch in Blender 5.3.0.0 (`assets/models/gateway.glb`):
  1. Adorable Heroic 1:2.63 Mascot Proportions (`1.000m` bind crown height, `min_y === 0.000m`,
     auto-normalized to `1.22m` world height in `src/gateway.js`):
       - Plush wide heart-shaped mascot head (`38%` height, plump smiling cheeks, soft rounded
         axolotl/sea-dragon muzzle, dimpled upturned smile, tiny teardrop nostrils, deep soft eye cups)
       - Huge soulful front-angled jewel eyes (`r ~ 0.072m`) with friendly dilated round-almond
         pupils, emerald-sapphire-gold radial iris & dual crisp white specular catchlights
       - Wide-open arched Upper Eyelids (subtle winged dark lash rim) + smooth Lower Eyelids
         (for adorable Pixar `^ ^` happy squint!) + sculpted floating Brow Arcs
       - 6 Volumetric pillowed translucent-look Coral-Petal Ear-Frills (3 per side: tall upper,
         wide mid, cheek-curl bottom matching `story_portrait_gateway.webp`)
       - Flowing Vibrant Coral-Sunset & Sunlit-Gold Sea-Silk Explorer Scarf (plush neck cowl + 2
         asymmetric swallowtail flowing ribbons) + Ornate Gold Filigree Collar & Glowing Faceted
         Star-Sapphire Water-Seed Medallion + Snug Gold Wrist/Ankle Cuffs + Hydro-Caster Bracelet +
         Cute Bronze-Leather Hip Explorer Satchel
       - Compact athletic pear torso with silky warm cream-pearl belly, sturdy otter-like legs,
         adorable 3-toed webbed paws, and a plump S-curving tail with dual-lobed petal tail-fin
  2. 50-Bone Hero Skeleton (ALL 39 canonical bones preserved + 11 new facial/spring appeal bones:
     `LowerLidL/R`, `BrowL/R`, `MouthSmile`, `FrillBotL/R`, `ScarfL1/L2`, `ScarfR1/R2`)
  3. Silky Touch-Ready 1024x1024 WEBP PBR Atlas (supersampled 2048->1024 via Python 3.12
     NumPy/SciPy/Pillow — zero dark mud cracks, rosy coral cheek blushes, glowing aqua freckles,
     strict non-overlapping UV islands!)
  4. 22 Baked NLA Skeletal Clips (all 18 canonical clips upgraded with lively Pixar appeal +
     4 new signature personality clips: `IdleCurious`, `EdgeTeeter`, `SpringSomersault`, `WetShake`)
     with exact Analytic 2-Bone Foot-IK grounding (`< 0.01mm` drift on idle!).

Run via:
  C:\\Users\\mshaf\\AppData\\Local\\Microsoft\\WindowsApps\\blender-launcher.exe -b -P scripts/generate_gateway_v2.py -- --rebake-textures --render-proof
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

BRAIN_DIR = os.path.join(
    os.path.expanduser("~"),
    ".gemini",
    "antigravity",
    "brain",
    "73b3b216-3179-493e-902c-d73c6248f9dd",
)
SCRATCH_DIR = os.path.join(BRAIN_DIR, "scratch")
TEX_CACHE_DIR = os.path.join(SCRATCH_DIR, "gateway_v2_textures")
DONE_JSON_PATH = os.path.join(SCRATCH_DIR, "gateway_v2_build_report.json")
PROOF_SHEET_PATH = os.path.join(BRAIN_DIR, "gateway_v2_showcase.png")
PY312_EXE = r"C:\Users\mshaf\AppData\Local\Programs\Python\Python312\python.exe"

os.makedirs(OUT_MODELS_DIR, exist_ok=True)
os.makedirs(TEX_CACHE_DIR, exist_ok=True)
os.makedirs(BRAIN_DIR, exist_ok=True)


# ==============================================================================
# PART A: 2048->1024 SILKY PIXAR PBR ATLAS SYNTHESIS (Python 3.12 + SciPy + PIL)
# ==============================================================================

def generate_gateway_v2_pbr_textures(out_size=1024):
    import numpy as np
    from scipy.spatial import cKDTree
    from scipy.ndimage import gaussian_filter, sobel
    from PIL import Image, ImageDraw

    SS = out_size * 2  # 2048x2048 supersampled -> Lanczos 1024x1024
    rng = np.random.default_rng(20261121)

    def hex_f(h):
        h = h.lstrip("#")
        return np.array([int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16)], dtype=np.float32) / 255.0

    def sstep(e0, e1, x):
        t = np.clip((x - e0) / np.maximum(1e-8, e1 - e0), 0.0, 1.0)
        return t * t * (3.0 - 2.0 * t)

    def fbm_field(shape, scales, weights, seed_offset=0):
        acc = np.zeros(shape, dtype=np.float32)
        r_loc = np.random.default_rng(771234 + seed_offset)
        for sc, wt in zip(scales, weights):
            gh = max(4, shape[0] // sc)
            gw = max(4, shape[1] // sc)
            coarse = r_loc.random((gh, gw), dtype=np.float32)
            up = np.array(
                Image.fromarray((coarse * 255).astype(np.uint8)).resize(
                    (shape[1], shape[0]), Image.Resampling.BICUBIC
                ),
                dtype=np.float32,
            ) / 255.0
            acc += up * wt
        return acc

    alb = np.zeros((SS, SS, 3), dtype=np.float32)
    emi = np.zeros((SS, SS, 3), dtype=np.float32)
    rough = np.full((SS, SS), 0.34, dtype=np.float32)
    metal = np.zeros((SS, SS), dtype=np.float32)
    ao = np.ones((SS, SS), dtype=np.float32)
    height = np.zeros((SS, SS), dtype=np.float32)

    # Row 0 = TOP (`VB = 1.0`), Row SS-1 = BOTTOM (`VB = 0.0`)
    ys_vb = np.linspace(1.0, 0.0, SS, dtype=np.float32)
    xs_ub = np.linspace(0.0, 1.0, SS, dtype=np.float32)
    UB, VB = np.meshgrid(xs_ub, ys_vb)

    # Strict Non-Overlapping UV Islands (matched 1:1 in `src/gateway.js`):
    #   Q_SKIN:   UB <= 0.68, VB <= 0.65   (All skin/head/body/tail/limbs — NEVER overlaps lash/brow!)
    #   Q_LASH:   UB in 0.34..0.68, VB in 0.65..0.72 (Dedicated Upper Eyelid Winged Lash Rim!)
    #   Q_BROW:   UB in 0.00..0.34, VB in 0.65..0.72 (Dedicated Floating Brow Arc strip!)
    #   Q_SCARF:  UB >  0.68, VB <= 0.34   (Vibrant Coral-Sunset & Sunlit-Gold Sea-Silk Scarf!)
    #   Q_FRILL:  UB >  0.68, 0.34 < VB <= 0.70 (Luminous Coral-Petal Ear-Frills & Tail-Fin!)
    #   Q_EYE:    UB >  0.68, VB >  0.70   (Soulful Pixar Jewel Eyes!)
    #   Q_GEAR:   UB <= 0.68, VB >  0.72   (Stitched Leather Satchel, Gold Filigree, Star-Sapphire Gem!)
    x1_s = int(round(SS * 0.68))
    y0_skin_top = int(round(SS * (1.0 - 0.65)))
    y0_s = int(round(SS * (1.0 - 0.72)))
    y0_frill = int(round(SS * (1.0 - 0.70)))
    y0_scarf = int(round(SS * (1.0 - 0.34)))

    # ==========================================================================
    # 1. Q_SKIN (UB <= 0.68, VB <= 0.65): SILKY TOUCH-READY PIXAR SEA-GLASS SKIN
    # ==========================================================================
    H_s, W_s = SS - y0_skin_top, x1_s
    su = np.clip((UB[y0_skin_top:, :x1_s] - 0.02) / 0.64, 0.0, 1.0)
    sv = np.clip((VB[y0_skin_top:, :x1_s] - 0.02) / 0.61, 0.0, 1.0)
    front_dist = np.abs(su - 0.5) * 2.0

    mottle1 = fbm_field((H_s, W_s), [190, 84, 34], [0.50, 0.32, 0.18], 13)
    warp_u = (fbm_field((H_s, W_s), [110, 44], [0.65, 0.35], 53) - 0.5) * 0.018
    warp_v = (fbm_field((H_s, W_s), [110, 44], [0.65, 0.35], 71) - 0.5) * 0.018

    def _soft_pearl_scales(n_seeds, aspect_v=1.18, seed_val=419):
        r_v = np.random.default_rng(seed_val)
        pts = np.column_stack([
            r_v.uniform(-0.05, 1.05, n_seeds),
            r_v.uniform(-0.05, aspect_v + 0.05, n_seeds),
        ])
        g_res = 180
        gx, gy = np.meshgrid(np.linspace(-0.03, 1.03, g_res), np.linspace(-0.03, aspect_v + 0.03, g_res))
        g_pts = np.column_stack([gx.ravel(), gy.ravel()])
        for _ in range(2):
            tree_r = cKDTree(pts)
            _, own = tree_r.query(g_pts, k=1)
            cnt = np.bincount(own, minlength=n_seeds).astype(np.float32)
            sx = np.bincount(own, weights=g_pts[:, 0], minlength=n_seeds)
            sy = np.bincount(own, weights=g_pts[:, 1], minlength=n_seeds)
            ok = cnt > 0
            pts[ok, 0] = sx[ok] / cnt[ok]
            pts[ok, 1] = sy[ok] / cnt[ok]

        tree = cKDTree(pts)
        q_pts = np.column_stack([(su + warp_u).ravel(), ((sv + warp_v) * aspect_v).ravel()])
        dists, idxs = tree.query(q_pts, k=2, workers=-1)
        d1 = dists[:, 0].reshape(H_s, W_s).astype(np.float32)
        d2 = dists[:, 1].reshape(H_s, W_s).astype(np.float32)
        c_id = idxs[:, 0].reshape(H_s, W_s)

        avg_sp = math.sqrt((1.10 * (aspect_v + 0.10)) / n_seeds)
        bevel = (d2 - d1) / (avg_sp * 0.64)
        dome = sstep(0.05, 0.58, bevel) * (1.0 - 0.12 * np.clip(d1 / (avg_sp * 0.72), 0.0, 1.0) ** 2)
        seam = 1.0 - sstep(0.04, 0.28, bevel)
        var = r_v.random(n_seeds, dtype=np.float32)[c_id]
        return dome, seam, var

    sc_dome, sc_seam, sc_var = _soft_pearl_scales(1600, aspect_v=1.18, seed_val=419)

    face_smooth_zone = sstep(0.68, 0.78, sv) * (1.0 - sstep(0.30, 0.56, front_dist)) * (1.0 - sstep(0.89, 0.96, sv))
    dorsal_scale_zone = np.clip(
        sstep(0.44, 0.76, front_dist) * 0.85
        + sstep(0.87, 0.94, sv) * 0.68
        + (1.0 - sstep(0.18, 0.36, sv)) * sstep(0.24, 0.52, front_dist) * 0.70,
        0.0,
        1.0,
    ) * (1.0 - face_smooth_zone * 0.90)

    belly_torso = sstep(0.16, 0.28, sv) * (1.0 - sstep(0.63, 0.72, sv)) * (1.0 - sstep(0.21, 0.40, front_dist + (mottle1 - 0.5) * 0.05))
    belly_chin = sstep(0.64, 0.72, sv) * (1.0 - sstep(0.752, 0.790, sv)) * (1.0 - sstep(0.17, 0.34, front_dist))
    belly_mask = np.clip(np.maximum(belly_torso, belly_chin * 0.85), 0.0, 1.0)
    belly_wave = 0.5 + 0.5 * np.sin((sv + 0.012 * (front_dist ** 2)) * 120.0)

    # Rich, Vibrant Pixar Pelagian Sea-Glass Turquoise Palette (holds vibrant saturation under bright PBR!)
    c_mint_main   = hex_f("#14c9ba")  # Lush jewel sea-mint turquoise
    c_mint_bright = hex_f("#4ef7e6")  # Sunlit sea-glass highlight
    c_ocean_teal  = hex_f("#097682")  # Rich friendly dorsal ocean teal
    c_crown_shimm = hex_f("#6bfae9")  # Luminous crown shimmer
    c_pearl_belly = hex_f("#fff5e8")  # Cozy warm cream-pearl tummy & chin
    c_peach_blush = hex_f("#ff708c")  # Adorable warm rosy coral cheek blush!
    c_smile_warm  = hex_f("#0e5463")  # Soft warm teal smile line
    c_nostril_sft = hex_f("#0a4654")
    c_biolume     = hex_f("#78fff2")

    dorsal_t = sstep(0.46, 0.94, front_dist)
    s_col = c_mint_main[None, None, :] * (1.0 - dorsal_t[:, :, None] * 0.56) + c_ocean_teal[None, None, :] * (dorsal_t[:, :, None] * 0.56)

    mottle_w = sstep(0.32, 0.78, mottle1) * 0.22
    s_col = s_col * (1.0 - mottle_w[:, :, None]) + c_mint_bright[None, None, :] * mottle_w[:, :, None]

    crown_glow = sstep(0.86, 0.96, sv) * (1.0 - sstep(0.30, 0.68, front_dist)) * (0.40 + 0.60 * sc_dome)
    s_col = s_col * (1.0 - crown_glow[:, :, None] * 0.34) + c_crown_shimm[None, None, :] * (crown_glow[:, :, None] * 0.34)

    shimmer_sc = dorsal_scale_zone * (0.042 * sc_dome + 0.032 * (sc_var - 0.5) - 0.032 * sc_seam)
    s_col = np.clip(s_col * (1.0 + shimmer_sc[:, :, None]), 0.0, 1.0)

    warm_rim = np.clip(sstep(0.16, 0.28, sv) * (1.0 - sstep(0.65, 0.75, sv)) * (1.0 - sstep(0.28, 0.48, front_dist)) * (1.0 - belly_mask), 0.0, 1.0)
    s_col = s_col * (1.0 - warm_rim[:, :, None] * 0.24) + c_mint_bright[None, None, :] * (warm_rim[:, :, None] * 0.24)
    belly_shaded = c_pearl_belly[None, None, :] * (0.97 + 0.03 * belly_wave[:, :, None])
    s_col = s_col * (1.0 - belly_mask[:, :, None] * 0.94) + belly_shaded * (belly_mask[:, :, None] * 0.94)

    # Warm Rosy Coral Cheek Blushes placed right on the plump cheek apples under outer eye corners!
    cheek_blush = np.exp(-(((front_dist - 0.32) / 0.13) ** 2 + ((sv - 0.788) / 0.044) ** 2))
    s_col = s_col * (1.0 - cheek_blush[:, :, None] * 0.52) + c_peach_blush[None, None, :] * (cheek_blush[:, :, None] * 0.52)

    # Soft warm upturned smile curve + subtle rosy lower lip + tiny cute nostrils!
    du_f = np.abs(su - 0.5)
    smile_curve = 0.755 + 0.025 * ((np.minimum(0.165, du_f) / 0.145) ** 1.65)
    smile_line = (1.0 - sstep(0.0014, 0.0044, np.abs(sv - smile_curve))) * (1.0 - sstep(0.115, 0.160, du_f))
    dimple = np.exp(-(((du_f - 0.144) / 0.014) ** 2 + ((sv - 0.782) / 0.011) ** 2)) * 0.34
    nostril = np.zeros((H_s, W_s), dtype=np.float32)
    for sgn in (-1.0, 1.0):
        nd = ((su - (0.5 + sgn * 0.032)) / 0.0064) ** 2 + ((sv - 0.806) / 0.0076) ** 2
        nostril = np.maximum(nostril, 1.0 - sstep(0.28, 1.0, nd))
    lower_lip_tint = np.exp(-((du_f / 0.072) ** 2 + ((sv - 0.745) / 0.010) ** 2)) * 0.28
    s_col = s_col * (1.0 - lower_lip_tint[:, :, None]) + c_peach_blush[None, None, :] * lower_lip_tint[:, :, None]
    s_col = s_col * (1.0 - np.clip(smile_line * 0.58 + dimple, 0.0, 0.68)[:, :, None]) + c_smile_warm[None, None, :] * np.clip(smile_line * 0.58 + dimple, 0.0, 0.68)[:, :, None]
    s_col = s_col * (1.0 - nostril[:, :, None] * 0.72) + c_nostril_sft[None, None, :] * (nostril[:, :, None] * 0.72)

    # Glowing Aqua-Star Cheek Freckles & Pelagian Tail Flank Sparkle Pearls!
    bio_img = Image.new("L", (W_s, H_s), 0)
    b_draw = ImageDraw.Draw(bio_img)
    for side_sgn in (-1, 1):
        for fd_d, sv_d, rad_d in [(0.31, 0.794, 7), (0.37, 0.805, 6), (0.42, 0.820, 5)]:
            su_d = 0.5 + side_sgn * (fd_d * 0.5)
            px_d = int((su_d * 0.64 + 0.02) / 0.68 * W_s)
            py_d = int((1.0 - (sv_d * 0.61 + 0.02) / 0.65) * H_s)
            b_draw.ellipse([px_d - rad_d, py_d - rad_d, px_d + rad_d, py_d + rad_d], fill=255)
        for k_m in range(10):
            t_m = 0.08 + k_m * 0.052
            fd_m = 0.46 + 0.05 * math.sin(k_m * 0.9)
            su_m = 0.5 + side_sgn * (fd_m * 0.5)
            px_m = int((su_m * 0.64 + 0.02) / 0.68 * W_s)
            py_m = int((1.0 - (t_m * 0.61 + 0.02) / 0.65) * H_s)
            rad_m = max(4, int(W_s * (0.0085 + 0.002 * math.sin(k_m))))
            b_draw.ellipse([px_m - rad_m, py_m - rad_m, px_m + rad_m, py_m + rad_m], fill=235)

    bio_arr = gaussian_filter(np.array(bio_img, dtype=np.float32) / 255.0, sigma=2.2)
    s_col = np.clip(s_col + c_biolume[None, None, :] * (bio_arr[:, :, None] * 0.58), 0.0, 1.0)

    alb[y0_skin_top:, :x1_s] = s_col
    emi[y0_skin_top:, :x1_s] = np.clip(
        c_biolume[None, None, :] * (bio_arr[:, :, None] * 0.88 + crown_glow[:, :, None] * 0.14),
        0.0,
        1.0,
    )
    rough[y0_skin_top:, :x1_s] = np.clip(0.32 + 0.06 * belly_mask + 0.04 * sc_seam * dorsal_scale_zone - 0.03 * sc_dome * dorsal_scale_zone, 0.26, 0.44)
    metal[y0_skin_top:, :x1_s] = 0.04 * dorsal_scale_zone
    ao[y0_skin_top:, :x1_s] = np.clip(1.0 - 0.05 * sc_seam * dorsal_scale_zone - 0.22 * nostril - 0.15 * smile_line, 0.68, 1.0)
    height[y0_skin_top:, :x1_s] = 0.11 * sc_dome * dorsal_scale_zone - 0.04 * sc_seam * dorsal_scale_zone + 0.03 * belly_wave * belly_mask - 0.14 * smile_line - 0.20 * nostril

    # ==========================================================================
    # 1B. DEDICATED NON-OVERLAPPING EYELID LASH & BROW STRIP (VB in 0.65..0.72)
    # ==========================================================================
    # Zero skin/head vertex ever enters `VB in 0.65..0.72` -> ZERO back-of-head dark patch!
    x_mid_lb = int(round(SS * 0.34))
    H_lb = y0_skin_top - y0_s
    # Left half (`UB 0.00..0.34`): Sculpted Brow Arc soft mint-teal gradient
    bv_g = np.linspace(1.0, 0.0, max(1, H_lb), dtype=np.float32)[:, None]
    c_brow_hi = hex_f("#7efdf0")
    alb[y0_s:y0_skin_top, :x_mid_lb] = c_ocean_teal[None, None, :] * (1.0 - bv_g[:, :, None] * 0.65) + c_brow_hi[None, None, :] * (bv_g[:, :, None] * 0.65)
    emi[y0_s:y0_skin_top, :x_mid_lb] = c_mint_bright[None, None, :] * 0.08
    rough[y0_s:y0_skin_top, :x_mid_lb] = 0.34
    # Right half (`UB 0.34..0.68`): Upper Eyelid Sea-Mint + Charming Dark Winged Lash Rim along bottom (`lv -> 0`)!
    W_lash = x1_s - x_mid_lb
    lv_g = np.linspace(1.0, 0.0, max(1, H_lb), dtype=np.float32)[:, None]
    lu_g = np.linspace(0.0, 1.0, max(1, W_lash), dtype=np.float32)[None, :]
    lash_thick = 0.22 + 0.14 * sstep(0.55, 0.95, lu_g)
    lash_mask = 1.0 - sstep(lash_thick - 0.06, lash_thick + 0.08, lv_g)
    c_lash = hex_f("#06202a")
    alb[y0_s:y0_skin_top, x_mid_lb:x1_s] = c_mint_main[None, None, :] * (1.0 - lash_mask[:, :, None]) + c_lash[None, None, :] * lash_mask[:, :, None]
    emi[y0_s:y0_skin_top, x_mid_lb:x1_s] = 0.0
    rough[y0_s:y0_skin_top, x_mid_lb:x1_s] = 0.32 - 0.10 * lash_mask

    # ==========================================================================
    # 2. Q_FRILL (UB > 0.68, 0.34 < VB <= 0.70): LUMINOUS CORAL-PETAL EAR-FRILLS
    # ==========================================================================
    H_f, W_f = y0_scarf - y0_frill, SS - x1_s
    fu = np.clip((UB[y0_frill:y0_scarf, x1_s:] - 0.70) / 0.28, 0.0, 1.0)
    fv = np.clip((VB[y0_frill:y0_scarf, x1_s:] - 0.355) / 0.33, 0.0, 1.0)

    vein_img = Image.new("L", (W_f, H_f), 0)
    v_draw = ImageDraw.Draw(vein_img)
    r_v = np.random.default_rng(8831)
    for ir in range(7):
        v_base = 0.08 + (0.84 * ir) / 6.0
        pts_m = []
        for st in range(10):
            t = st / 9.0
            vp = v_base + 0.030 * math.sin(t * 3.8 + ir * 0.9)
            px = int((0.04 + t * 0.92) * W_f)
            py = int((1.0 - (0.04 + vp * 0.92)) * H_f)
            pts_m.append((px, py, t, vp))
        for st in range(len(pts_m) - 1):
            wr = max(2, int((1.0 - st / 11.0) * (SS / 145.0)))
            v_draw.line([pts_m[st][:2], pts_m[st + 1][:2]], fill=245, width=wr)
            if 1 <= st <= 7:
                for bs in (-1, 1):
                    bx0, by0, bu0, bv0 = pts_m[st]
                    bu1 = min(0.97, bu0 + 0.16 + r_v.uniform(-0.02, 0.03))
                    bv1 = bv0 + bs * (0.048 + r_v.uniform(0.0, 0.02))
                    bx1 = int((0.04 + bu1 * 0.92) * W_f)
                    by1 = int((1.0 - (0.04 + bv1 * 0.92)) * H_f)
                    v_draw.line([(bx0, by0), (bx1, by1)], fill=190, width=max(2, SS // 400))

    vein_s = np.array(vein_img, dtype=np.float32) / 255.0
    vein_f = np.clip(0.58 * vein_s + 0.65 * gaussian_filter(vein_s, sigma=2.6), 0.0, 1.0)

    c_fr_root  = hex_f("#14c9ba")
    c_fr_aqua  = hex_f("#80fcf0")
    c_fr_coral = hex_f("#ff5478")  # Richer vivid coral-rose petal tips!
    c_fr_vein  = hex_f("#ff876b")  # Glowing warm coral-peach veins (story_portrait_gateway!)
    c_fr_rim   = hex_f("#ffe5b8")

    f_col = (
        c_fr_root[None, None, :] * (1.0 - sstep(0.05, 0.42, fu))[:, :, None]
        + c_fr_aqua[None, None, :] * (sstep(0.05, 0.42, fu) * (1.0 - sstep(0.40, 0.80, fu)))[:, :, None]
        + c_fr_coral[None, None, :] * sstep(0.40, 0.80, fu)[:, :, None]
    )
    f_col = f_col * (1.0 - vein_f[:, :, None] * 0.66) + c_fr_vein[None, None, :] * (vein_f[:, :, None] * 0.66)
    rim_glow = sstep(0.82, 0.98, fu)
    f_col = f_col * (1.0 - rim_glow[:, :, None] * 0.42) + c_fr_rim[None, None, :] * (rim_glow[:, :, None] * 0.42)

    dew = np.zeros((H_f, W_f), dtype=np.float32)
    for ir in range(6):
        vc_d = 0.10 + (0.80 * (ir + 0.5)) / 6.0
        dd = np.sqrt(((fu - 0.78) / 0.048) ** 2 + ((fv - vc_d) / 0.034) ** 2)
        dew = np.maximum(dew, 1.0 - sstep(0.32, 1.0, dd))
    f_col = np.clip(f_col + c_fr_aqua[None, None, :] * (dew[:, :, None] * 0.52), 0.0, 1.0)

    alb[y0_frill:y0_scarf, x1_s:] = f_col
    emi[y0_frill:y0_scarf, x1_s:] = np.clip(
        c_fr_aqua[None, None, :] * ((dew * 0.78 + (1.0 - fu) * 0.14)[:, :, None])
        + c_fr_vein[None, None, :] * (vein_f[:, :, None] * 0.50)
        + c_fr_rim[None, None, :] * (rim_glow[:, :, None] * 0.34),
        0.0,
        1.0,
    )
    rough[y0_frill:y0_scarf, x1_s:] = np.clip(0.20 + 0.14 * (1.0 - vein_f), 0.16, 0.36)
    metal[y0_frill:y0_scarf, x1_s:] = 0.08 * vein_f
    ao[y0_frill:y0_scarf, x1_s:] = np.clip(0.90 + 0.10 * vein_f, 0.85, 1.0)
    height[y0_frill:y0_scarf, x1_s:] = 0.26 * vein_f + 0.10 * dew

    # ==========================================================================
    # 3. Q_SCARF (UB > 0.68, VB <= 0.34): VIBRANT CORAL-SUNSET & GOLD SEA-SILK!
    # ==========================================================================
    H_sc, W_sc = SS - y0_scarf, SS - x1_s
    sc_u = np.clip((UB[y0_scarf:, x1_s:] - 0.70) / 0.28, 0.0, 1.0)
    sc_v = np.clip((VB[y0_scarf:, x1_s:] - 0.02) / 0.30, 0.0, 1.0)

    silk_weave = 0.5 + 0.25 * np.sin(sc_u * 260.0) + 0.25 * np.sin(sc_v * 260.0)
    silk_fold = fbm_field((H_sc, W_sc), [96, 36], [0.65, 0.35], 199)

    trim_img = Image.new("L", (W_sc, H_sc), 0)
    t_draw = ImageDraw.Draw(trim_img)
    b_top = int(0.11 * H_sc)
    b_bot = int(0.89 * H_sc)
    t_draw.rectangle([0, b_top - 11, W_sc, b_top + 11], fill=250)
    t_draw.rectangle([0, b_bot - 11, W_sc, b_bot + 11], fill=250)
    t_draw.rectangle([0, b_top + 22, W_sc, b_top + 29], fill=220)
    t_draw.rectangle([0, b_bot - 29, W_sc, b_bot - 22], fill=220)
    for wi in range(10):
        cx_w = int((0.06 + wi * 0.095) * W_sc)
        r_w = int(0.055 * H_sc)
        t_draw.arc([cx_w - r_w, b_top + 26, cx_w + r_w, b_top + 26 + 2 * r_w], 0, 220, fill=240, width=max(3, SS // 360))
        t_draw.arc([cx_w - r_w, b_bot - 26 - 2 * r_w, cx_w + r_w, b_bot - 26], 140, 360, fill=240, width=max(3, SS // 360))
    cx_tip = int(0.84 * W_sc)
    cy_tip = H_sc // 2
    rd_x, rd_y = int(0.08 * W_sc), int(0.20 * H_sc)
    t_draw.polygon([(cx_tip, cy_tip - rd_y), (cx_tip + rd_x, cy_tip), (cx_tip, cy_tip + rd_y), (cx_tip - rd_x, cy_tip)], outline=255, width=max(4, SS // 250))
    t_draw.ellipse([cx_tip - rd_x // 3, cy_tip - rd_x // 3, cx_tip + rd_x // 3, cy_tip + rd_x // 3], fill=255)
    t_draw.rectangle([int(0.93 * W_sc), 0, W_sc, H_sc], fill=248)

    gold_trim = gaussian_filter(np.array(trim_img, dtype=np.float32) / 255.0, sigma=1.1)

    # Deeper, richer Coral-Sunset Crimson-Vermilion so it POPS dramatically against sandstone & basalt!
    c_sc_deep = hex_f("#be123c")
    c_sc_main = hex_f("#f43f5e")
    c_sc_glow = hex_f("#ff758f")
    c_sc_gold = hex_f("#f5b82e")

    scarf_c = (
        c_sc_deep[None, None, :] * (1.0 - sstep(0.0, 0.72, sc_u))[:, :, None] * 0.42
        + c_sc_main[None, None, :] * (0.58 + 0.42 * sstep(0.0, 0.72, sc_u))[:, :, None]
    )
    scarf_c = scarf_c * (0.90 + 0.14 * silk_fold[:, :, None] + 0.04 * (silk_weave[:, :, None] - 0.5))
    scarf_c = np.clip(scarf_c + c_sc_glow[None, None, :] * (sstep(0.55, 0.95, silk_fold)[:, :, None] * 0.16), 0.0, 1.0)
    scarf_c = scarf_c * (1.0 - gold_trim[:, :, None] * 0.94) + c_sc_gold[None, None, :] * (gold_trim[:, :, None] * 0.94)

    alb[y0_scarf:, x1_s:] = np.clip(scarf_c, 0.0, 1.0)
    emi[y0_scarf:, x1_s:] = c_sc_gold[None, None, :] * (gold_trim[:, :, None] * 0.16) + c_sc_main[None, None, :] * 0.05
    rough[y0_scarf:, x1_s:] = np.clip(0.46 - 0.24 * gold_trim + 0.04 * (silk_weave - 0.5), 0.18, 0.52)
    metal[y0_scarf:, x1_s:] = 0.86 * gold_trim
    ao[y0_scarf:, x1_s:] = np.clip(0.92 + 0.08 * gold_trim, 0.88, 1.0)
    height[y0_scarf:, x1_s:] = 0.24 * gold_trim + 0.03 * silk_weave

    # ==========================================================================
    # 4. Q_EYE (UB > 0.68, VB > 0.70): SOULFUL PIXAR JEWEL EYE (story_portrait!)
    # ==========================================================================
    ex = (UB[:y0_frill, x1_s:] - 0.84) / 0.135
    ey = (VB[:y0_frill, x1_s:] - 0.85) / 0.135
    er = np.sqrt(ex * ex + ey * ey)
    eang = np.arctan2(ey, ex)

    # Large, warm, friendly dilated round-almond pupil + lush emerald-sapphire-gold iris!
    pupil_d = np.sqrt((ex / 0.35) ** 2 + (ey / 0.43) ** 2)
    pupil_m = 1.0 - sstep(0.90, 1.02, pupil_d)
    iris_m = (1.0 - pupil_m) * (1.0 - sstep(0.79, 0.86, er))
    limbal = np.exp(-(((er - 0.81) / 0.055) ** 2)) * (1.0 - pupil_m)

    f1 = 0.5 + 0.5 * np.sin(eang * 44.0 + np.sin(er * 20.0) * 0.55)
    f2 = 0.5 + 0.5 * np.cos(eang * 92.0 - er * 14.0)
    collarette = np.exp(-(((pupil_d - 1.24) / 0.22) ** 2)) * iris_m
    lower_bounce = sstep(-0.10, -0.68, ey) * iris_m * (1.0 - sstep(0.68, 0.82, er))

    iris_t = np.clip((er - 0.30) / 0.52, 0.0, 1.0)
    c_i_gold   = hex_f("#fde047")
    c_i_lime   = hex_f("#4ade80")
    c_i_emrld  = hex_f("#10b981")
    c_i_sapph  = hex_f("#06b6d4")
    c_i_deep   = hex_f("#064e5e")
    c_sclera   = hex_f("#fdf9f2")
    c_scl_shd  = hex_f("#d6cfc5")

    i_col = (
        c_i_gold[None, None, :] * (1.0 - sstep(0.0, 0.28, iris_t))[:, :, None]
        + c_i_emrld[None, None, :] * (sstep(0.0, 0.28, iris_t) * (1.0 - sstep(0.48, 0.90, iris_t)))[:, :, None]
        + c_i_sapph[None, None, :] * sstep(0.48, 0.90, iris_t)[:, :, None]
    )
    stroma = 0.78 + 0.26 * f1 + 0.14 * f2
    i_col = np.clip(
        i_col * stroma[:, :, None]
        + c_i_gold[None, None, :] * (collarette[:, :, None] * 0.62)
        + c_i_lime[None, None, :] * (lower_bounce[:, :, None] * 0.58),
        0.0,
        1.0,
    )
    upper_shd = sstep(0.22, 0.78, ey) * 0.28
    i_col *= (1.0 - upper_shd[:, :, None])

    scl_col = (
        c_sclera[None, None, :] * (1.0 - sstep(0.84, 1.06, er))[:, :, None]
        + c_scl_shd[None, None, :] * sstep(0.84, 1.06, er)[:, :, None]
    ) * (1.0 - upper_shd[:, :, None] * 0.65)

    e_col = scl_col * (1.0 - iris_m[:, :, None]) + i_col * iris_m[:, :, None]
    e_col = e_col * (1.0 - limbal[:, :, None] * 0.82) + c_i_deep[None, None, :] * (limbal[:, :, None] * 0.82)
    e_col = e_col * (1.0 - pupil_m[:, :, None]) + hex_f("#060b16")[None, None, :] * pupil_m[:, :, None]

    # Dual Pure-White High-Gloss Pixar Catchlights
    cl1 = 1.0 - sstep(0.130, 0.166, np.sqrt(((ex + 0.24) * 0.92) ** 2 + ((ey - 0.24) * 1.06) ** 2))
    cl2 = 1.0 - sstep(0.055, 0.078, np.sqrt((ex - 0.22) ** 2 + (ey + 0.19) ** 2))
    catch = np.clip(cl1 + cl2 * 0.95, 0.0, 1.0)
    e_col = np.clip(e_col * (1.0 - catch[:, :, None]) + catch[:, :, None], 0.0, 1.0)

    alb[:y0_frill, x1_s:] = e_col
    emi[:y0_frill, x1_s:] = np.clip(
        c_i_gold[None, None, :] * (collarette[:, :, None] * 0.48)
        + c_i_lime[None, None, :] * (lower_bounce[:, :, None] * 0.46)
        + c_i_emrld[None, None, :] * (iris_m[:, :, None] * 0.20)
        + catch[:, :, None] * 0.98,
        0.0,
        1.0,
    )
    rough[:y0_frill, x1_s:] = 0.025
    metal[:y0_frill, x1_s:] = 0.02

    # ==========================================================================
    # 5. Q_GEAR (UB <= 0.68, VB > 0.72): LEATHER SATCHEL, GOLD FILIGREE, SAPPHIRE GEM
    # ==========================================================================
    H_g, W_g = y0_s, x1_s
    gu = np.clip((UB[:y0_s, :x1_s] - 0.02) / 0.64, 0.0, 1.0)
    gv = np.clip((VB[:y0_s, :x1_s] - 0.74) / 0.24, 0.0, 1.0)

    fil_img = Image.new("L", (W_g, H_g), 0)
    f_draw = ImageDraw.Draw(fil_img)

    y_b2 = int(0.32 * H_g)
    y_b1 = int(0.65 * H_g)

    f_draw.rectangle([0, y_b2 + 5, W_g, y_b2 + 13], fill=240)
    f_draw.rectangle([0, y_b1 - 13, W_g, y_b1 - 5], fill=240)
    n_sc = 11
    sw = W_g // n_sc
    for i_sc in range(n_sc + 1):
        cx = i_sc * sw
        cy = (y_b2 + y_b1) // 2
        rs = int((y_b1 - y_b2) * 0.34)
        f_draw.arc([cx - rs, cy - rs, cx + rs, cy + rs], 0, 290, fill=250, width=max(3, SS // 330))
        f_draw.ellipse([cx - 5, cy - 5, cx + 5, cy + 5], fill=255)
        f_draw.ellipse([cx - 4, y_b2 + 16, cx + 4, y_b2 + 24], fill=255)
        f_draw.ellipse([cx - 4, y_b1 - 24, cx + 4, y_b1 - 16], fill=255)

    for st_i in range(28):
        sx0 = int(st_i * (W_g / 28.0)) + 4
        sx1 = sx0 + max(8, W_g // 48)
        f_draw.line([(sx0, y_b1 + 14), (sx1, y_b1 + 14)], fill=225, width=max(2, SS // 440))
        f_draw.line([(sx0, H_g - 14), (sx1, H_g - 14)], fill=225, width=max(2, SS // 440))

    fil_bev = gaussian_filter(np.array(fil_img, dtype=np.float32) / 255.0, sigma=1.4)
    grain = fbm_field((H_g, W_g), [36, 14, 6], [0.5, 0.3, 0.2], 241)

    c_tree = cKDTree(rng.uniform(0.0, 1.0, (85, 2)))
    cd, _ = c_tree.query(np.column_stack([gu.ravel(), gv.ravel()]), k=2, workers=-1)
    crys_edge = 1.0 - sstep(0.005, 0.028, (cd[:, 1] - cd[:, 0]).reshape(H_g, W_g).astype(np.float32))

    c_leather   = hex_f("#9e5d3d")
    c_stitch    = hex_f("#fde6b8")
    c_gold_rich = hex_f("#f0b949")
    c_gold_hi   = hex_f("#fef08a")
    c_gold_ao   = hex_f("#8c5614")
    c_sapph_dp  = hex_f("#0284c7")
    c_sapph_lt  = hex_f("#7dd3fc")
    c_sapph_hi  = hex_f("#f0f9ff")

    is_lth = gv < 0.35
    is_gld = (gv >= 0.35) & (gv < 0.68)
    is_gem = gv >= 0.68

    g_col = np.zeros((H_g, W_g, 3), dtype=np.float32)
    lth_c = c_leather[None, None, :] * (0.86 + 0.22 * grain[:, :, None])
    lth_c = lth_c * (1.0 - fil_bev[:, :, None] * 0.78) + c_stitch[None, None, :] * (fil_bev[:, :, None] * 0.78)

    gld_c = c_gold_rich[None, None, :] * (0.86 + 0.20 * grain[:, :, None])
    gld_c = gld_c * (1.0 - fil_bev[:, :, None] * 0.50) + c_gold_hi[None, None, :] * (fil_bev[:, :, None] * 0.50)
    gld_ao = np.clip((1.0 - fil_bev) * 0.22, 0.0, 1.0)
    gld_c = gld_c * (1.0 - gld_ao[:, :, None]) + c_gold_ao[None, None, :] * gld_ao[:, :, None]

    gem_c = (
        c_sapph_dp[None, None, :] * (1.0 - grain[:, :, None] * 0.62)
        + c_sapph_lt[None, None, :] * (grain[:, :, None] * 0.62)
    )
    gem_c = np.clip(gem_c + c_sapph_hi[None, None, :] * (crys_edge[:, :, None] * 0.88), 0.0, 1.0)

    g_col[is_lth] = lth_c[is_lth]
    g_col[is_gld] = gld_c[is_gld]
    g_col[is_gem] = gem_c[is_gem]

    alb[:y0_s, :x1_s] = np.clip(g_col, 0.0, 1.0)
    emi_g = np.zeros_like(g_col)
    emi_g[is_gem] = (c_sapph_lt[None, None, :] * (0.76 + 0.45 * crys_edge[:, :, None]))[is_gem]
    emi[:y0_s, :x1_s] = np.clip(emi_g, 0.0, 1.0)

    r_g = np.full((H_g, W_g), 0.28, dtype=np.float32)
    m_g = np.full((H_g, W_g), 0.10, dtype=np.float32)
    r_g[is_lth] = (0.58 - 0.10 * fil_bev)[is_lth]
    m_g[is_lth] = 0.06
    r_g[is_gld] = np.clip(0.24 - 0.08 * fil_bev + 0.05 * (1.0 - grain), 0.14, 0.34)[is_gld]
    m_g[is_gld] = 0.88
    r_g[is_gem] = 0.05
    m_g[is_gem] = 0.08

    rough[:y0_s, :x1_s] = r_g
    metal[:y0_s, :x1_s] = m_g
    ao[:y0_s, :x1_s] = np.clip(0.84 + 0.16 * fil_bev, 0.78, 1.0)
    height[:y0_s, :x1_s] = np.where(is_gem, crys_edge * 0.32, fil_bev * 0.42 + grain * 0.05)

    # ==========================================================================
    # 6. TANGENT-SPACE NORMAL MAP + ORM PACKING (2048 -> 1024 LANCZOS)
    # ==========================================================================
    gx_h = sobel(height, axis=1, mode="wrap") * 0.72
    gy_h = sobel(height, axis=0, mode="wrap") * 0.72
    nx = -gx_h
    ny = gy_h
    nz = np.ones_like(nx)
    inv_n = 1.0 / np.sqrt(nx * nx + ny * ny + nz * nz)
    nrm = np.stack([0.5 + 0.5 * nx * inv_n, 0.5 + 0.5 * ny * inv_n, 0.5 + 0.5 * nz * inv_n], axis=-1)
    orm = np.stack([ao, rough, metal], axis=-1)

    def _save(arr_f32, fname):
        u8 = np.clip(np.round(arr_f32 * 255.0), 0, 255).astype(np.uint8)
        im = Image.fromarray(u8, mode="RGB").resize((out_size, out_size), Image.Resampling.LANCZOS)
        p = os.path.join(TEX_CACHE_DIR, fname)
        im.save(p, format="PNG", optimize=True)
        return p

    return [
        _save(alb, "gateway_v2_albedo.png"),
        _save(nrm, "gateway_v2_normal.png"),
        _save(orm, "gateway_v2_orm.png"),
        _save(emi, "gateway_v2_emissive.png"),
    ]


# ==============================================================================
# PART B: BLENDER 5.3 ADORABLE HERO SCULPT, 50-BONE RIG & 22 NLA CLIPS
# ==============================================================================

def run_blender_pipeline():
    import bpy
    import bmesh
    from mathutils import Vector, Matrix
    import numpy as np

    req_tex = [
        "gateway_v2_albedo.png",
        "gateway_v2_normal.png",
        "gateway_v2_orm.png",
        "gateway_v2_emissive.png",
    ]
    if "--rebake-textures" in sys.argv or not all(os.path.exists(os.path.join(TEX_CACHE_DIR, fn)) for fn in req_tex):
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

    def _load_tex(fname, is_srgb):
        p = os.path.join(TEX_CACHE_DIR, fname)
        img = bpy.data.images.load(p)
        img.colorspace_settings.name = "sRGB" if is_srgb else "Non-Color"
        img.pack()
        return img

    alb_img = _load_tex("gateway_v2_albedo.png", True)
    nrm_img = _load_tex("gateway_v2_normal.png", False)
    orm_img = _load_tex("gateway_v2_orm.png", False)
    emi_img = _load_tex("gateway_v2_emissive.png", True)

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
    nmap.inputs["Strength"].default_value = 0.70
    nt.links.new(n_nrm.outputs["Color"], nmap.inputs["Color"])
    nt.links.new(nmap.outputs["Normal"], bsdf.inputs["Normal"])

    n_emi = nt.nodes.new("ShaderNodeTexImage")
    n_emi.image = emi_img
    if "Emission Color" in bsdf.inputs:
        nt.links.new(n_emi.outputs["Color"], bsdf.inputs["Emission Color"])
        bsdf.inputs["Emission Strength"].default_value = 0.85
    elif "Emission" in bsdf.inputs:
        nt.links.new(n_emi.outputs["Color"], bsdf.inputs["Emission"])

    # ==========================================================================
    # 1. 50-BONE HERO SKELETON (All 39 Canonical + 11 New Expressive Appeal Bones)
    # ==========================================================================
    EYE_X, EYE_Y, EYE_Z = 0.085, 0.802, 0.120
    EYE_YAW = 0.17  # Warm friendly forward-angled 10 deg yaw!

    BONE_SPECS = [
        ("Root",       None,        (0.000, 0.000,  0.000), (0.000, 0.100,  0.000), (0, 0, 1)),
        ("Pelvis",     "Root",      (0.000, 0.305, -0.008), (0.000, 0.378, -0.004), (0, 0, 1)),
        ("Spine1",     "Pelvis",    (0.000, 0.378, -0.004), (0.000, 0.448,  0.002), (0, 0, 1)),
        ("Spine2",     "Spine1",    (0.000, 0.448,  0.002), (0.000, 0.515,  0.006), (0, 0, 1)),
        ("Chest",      "Spine2",    (0.000, 0.515,  0.006), (0.000, 0.575,  0.004), (0, 0, 1)),
        ("Neck",       "Chest",     (0.000, 0.575,  0.004), (0.000, 0.630,  0.012), (0, 0, 1)),
        ("Head",       "Neck",      (0.000, 0.630,  0.012), (0.000, 0.990,  0.025), (0, 0, 1)),

        # 10-Bone Facial Expression Rig
        ("Jaw",        "Head",      (0.000, 0.684,  0.055), (0.000, 0.674,  0.168), (0, -1, 0)),
        ("MouthSmile", "Head",      (0.000, 0.715,  0.135), (0.000, 0.720,  0.205), (0, 1, 0)),
        ("EyeL",       "Head",      ( EYE_X, EYE_Y, EYE_Z), ( EYE_X + 0.012, EYE_Y, EYE_Z + 0.064), (0, 1, 0)),
        ("EyeR",       "Head",      (-EYE_X, EYE_Y, EYE_Z), (-EYE_X - 0.012, EYE_Y, EYE_Z + 0.064), (0, 1, 0)),
        # Upper Eyelid: roll `(0, -1, 0)` so `+rx` rotates DOWN to blink closed!
        ("EyelidL",    "Head",      ( EYE_X, EYE_Y, EYE_Z), ( EYE_X + 0.012, EYE_Y + 0.018, EYE_Z + 0.064), (0, -1, 0)),
        ("EyelidR",    "Head",      (-EYE_X, EYE_Y, EYE_Z), (-EYE_X - 0.012, EYE_Y + 0.018, EYE_Z + 0.064), (0, -1, 0)),
        # Lower Eyelid: roll `(0, 1, 0)` so `+rx` rotates UP into joyful `^ ^` smiling squint!
        ("LowerLidL",  "Head",      ( EYE_X, EYE_Y, EYE_Z), ( EYE_X + 0.012, EYE_Y - 0.018, EYE_Z + 0.064), (0, 1, 0)),
        ("LowerLidR",  "Head",      (-EYE_X, EYE_Y, EYE_Z), (-EYE_X - 0.012, EYE_Y - 0.018, EYE_Z + 0.064), (0, 1, 0)),
        # Sculpted Expressive Floating Brows
        ("BrowL",      "Head",      ( 0.085, 0.888, 0.160), ( 0.085, 0.888, 0.210), (0, 1, 0)),
        ("BrowR",      "Head",      (-0.085, 0.888, 0.160), (-0.085, 0.888, 0.210), (0, 1, 0)),

        # 6 Volumetric Coral-Petal Ear-Frill Spring Bones
        ("FrillL1",    "Head",      ( 0.148, 0.818, -0.008), ( 0.248, 0.900, -0.085), (1, 0, 0.5)),
        ("FrillL2",    "FrillL1",   ( 0.248, 0.900, -0.085), ( 0.348, 0.988, -0.160), (1, 0, 0.5)),
        ("FrillBotL",  "Head",      ( 0.150, 0.720,  0.002), ( 0.275, 0.640, -0.088), (1, 0, 0.5)),
        ("FrillR1",    "Head",      (-0.148, 0.818, -0.008), (-0.248, 0.900, -0.085), (-1, 0, 0.5)),
        ("FrillR2",    "FrillR1",   (-0.248, 0.900, -0.085), (-0.348, 0.988, -0.160), (-1, 0, 0.5)),
        ("FrillBotR",  "Head",      (-0.150, 0.720,  0.002), (-0.275, 0.640, -0.088), (-1, 0, 0.5)),

        # 4 Flowing Coral-Sunset Sea-Silk Scarf Spring Bones
        ("ScarfL1",    "Chest",     ( 0.044, 0.578, -0.102), ( 0.088, 0.492, -0.268), (0, 1, 0)),
        ("ScarfL2",    "ScarfL1",   ( 0.088, 0.492, -0.268), ( 0.132, 0.412, -0.455), (0, 1, 0)),
        ("ScarfR1",    "Chest",     (-0.044, 0.578, -0.102), (-0.082, 0.505, -0.242), (0, 1, 0)),
        ("ScarfR2",    "ScarfR1",   (-0.082, 0.505, -0.242), (-0.116, 0.445, -0.390), (0, 1, 0)),

        # Compact Athletic Arms (poised playful rest pose)
        ("ClavicleL",  "Chest",     ( 0.042, 0.526,  0.004), ( 0.125, 0.518,  0.002), (0, 0, 1)),
        ("UpperArmL",  "ClavicleL", ( 0.125, 0.518,  0.002), ( 0.184, 0.422, -0.014), (0, 0, 1)),
        ("ForearmL",   "UpperArmL", ( 0.184, 0.422, -0.014), ( 0.204, 0.338,  0.042), (0, 0, 1)),
        ("HandL",      "ForearmL",  ( 0.204, 0.338,  0.042), ( 0.214, 0.282,  0.088), (0, 0, 1)),
        ("ClavicleR",  "Chest",     (-0.042, 0.526,  0.004), (-0.125, 0.518,  0.002), (0, 0, 1)),
        ("UpperArmR",  "ClavicleR", (-0.125, 0.518,  0.002), (-0.184, 0.422, -0.014), (0, 0, 1)),
        ("ForearmR",   "UpperArmR", (-0.184, 0.422, -0.014), (-0.204, 0.338,  0.042), (0, 0, 1)),
        ("HandR",      "ForearmR",  (-0.204, 0.338,  0.042), (-0.214, 0.282,  0.088), (0, 0, 1)),

        # Sturdy Compact Legs & Webbed Paws (exact forward knee bend for 0.00mm 2-Bone Foot-IK!)
        ("ThighL",     "Pelvis",    ( 0.080, 0.305,  0.002), ( 0.090, 0.175,  0.040), (0, 0, 1)),
        ("ShinL",      "ThighL",    ( 0.090, 0.175,  0.040), ( 0.088, 0.068, -0.016), (0, 0, 1)),
        ("AnkleL",     "ShinL",     ( 0.088, 0.068, -0.016), ( 0.088, 0.022,  0.030), (0, 0, 1)),
        ("FootL",      "AnkleL",    ( 0.088, 0.022,  0.030), ( 0.088, 0.014,  0.124), (0, 1, 0)),
        ("ThighR",     "Pelvis",    (-0.080, 0.305,  0.002), (-0.090, 0.175,  0.040), (0, 0, 1)),
        ("ShinR",      "ThighR",    (-0.090, 0.175,  0.040), (-0.088, 0.068, -0.016), (0, 0, 1)),
        ("AnkleR",     "ShinR",     (-0.088, 0.068, -0.016), (-0.088, 0.022,  0.030), (0, 0, 1)),
        ("FootR",      "AnkleR",    (-0.088, 0.022,  0.030), (-0.088, 0.014,  0.124), (0, 1, 0)),

        # Plump Expressive S-Curving Tail (7 bones)
        ("Tail1",      "Pelvis",    (0.000, 0.302, -0.072), (0.000, 0.270, -0.180), (0, 1, 0)),
        ("Tail2",      "Tail1",     (0.000, 0.270, -0.180), (0.000, 0.252, -0.292), (0, 1, 0)),
        ("Tail3",      "Tail2",     (0.000, 0.252, -0.292), (0.000, 0.258, -0.402), (0, 1, 0)),
        ("Tail4",      "Tail3",     (0.000, 0.258, -0.402), (0.000, 0.288, -0.510), (0, 1, 0)),
        ("Tail5",      "Tail4",     (0.000, 0.288, -0.510), (0.000, 0.338, -0.612), (0, 1, 0)),
        ("Tail6",      "Tail5",     (0.000, 0.338, -0.612), (0.000, 0.398, -0.706), (0, 1, 0)),
        ("Tail7",      "Tail6",     (0.000, 0.398, -0.706), (0.000, 0.456, -0.790), (0, 1, 0)),
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

    # ==========================================================================
    # 2. STRICT NON-OVERLAPPING UV HELPERS (Matches Part A 1:1!)
    # ==========================================================================
    def _uv_skin(su01, sv01):
        # Strictly inside `UB 0.02..0.66, VB 0.02..0.63` -> NEVER touches Lash/Brow strip at `VB 0.65..0.72`!
        return (0.02 + clamp01(su01) * 0.64, 0.02 + clamp01(sv01) * 0.61)

    def _uv_skin_cyl(tx, ty, tz, is_limb=False, v_override=None):
        if is_limb:
            cx = 0.14 if tx >= 0 else -0.14
            ang = math.atan2(tx - cx, tz) / math.pi
            su = (0.14 + 0.08 * ang) if tx >= 0 else (0.86 + 0.08 * ang)
            sv = v_override if v_override is not None else clamp01(ty / 0.68) * 0.62
        else:
            su = 0.5 + math.atan2(tx, tz if abs(tz) > 1e-5 else 1e-5) / (2.0 * math.pi)
            sv = v_override if v_override is not None else clamp01(ty / 0.98)
        return _uv_skin(su, sv)

    def _uv_frill(u01, v01):
        return (0.70 + clamp01(u01) * 0.28, 0.355 + clamp01(v01) * 0.33)

    def _uv_scarf(u01, v01):
        return (0.70 + clamp01(u01) * 0.28, 0.02 + clamp01(v01) * 0.30)

    def _uv_gear(u01, band):
        v_lo = 0.765 if band == 0 else (0.855 if band == 1 else 0.935)
        return (0.04 + (u01 % 1.0) * 0.60, v_lo + 0.02)

    def _uv_lid(u01, v01):
        # Dedicated Q_LASH strip (`UB 0.355..0.665, VB 0.658..0.712`)
        return (0.355 + clamp01(u01) * 0.310, 0.658 + clamp01(v01) * 0.054)

    def _uv_brow(u01, v01):
        # Dedicated Q_BROW strip (`UB 0.02..0.32, VB 0.658..0.712`)
        return (0.02 + clamp01(u01) * 0.30, 0.658 + clamp01(v01) * 0.054)

    TAG_BODY      = 0
    TAG_HEAD      = 1
    TAG_EYE_L     = 2
    TAG_EYE_R     = 3
    TAG_ULID_L    = 4
    TAG_ULID_R    = 5
    TAG_LLID_L    = 6
    TAG_LLID_R    = 7
    TAG_BROW_L    = 8
    TAG_BROW_R    = 9
    TAG_FRILL_TL  = 10
    TAG_FRILL_TR  = 11
    TAG_FRILL_BL  = 12
    TAG_FRILL_BR  = 13
    TAG_SCARF_COL = 14
    TAG_SCARF_L   = 15
    TAG_SCARF_R   = 16
    TAG_GEAR_CH   = 17
    TAG_SATCHEL   = 18
    TAG_CUFF_L    = 19
    TAG_CUFF_R    = 20
    TAG_ANKLE_L   = 21
    TAG_ANKLE_R   = 22
    TAG_TAIL_FIN  = 23
    TAG_DORSAL    = 24
    TAG_LIMB_ARML = 25
    TAG_LIMB_ARMR = 26
    TAG_LIMB_LEGL = 27
    TAG_LIMB_LEGR = 28

    bm = bmesh.new()
    uv_layer = bm.loops.layers.uv.verify()
    tag_layer = bm.verts.layers.int.new("part_tag")
    u_param_layer = bm.verts.layers.float.new("u_param")

    def _new_v(tx, ty, tz, tag=TAG_BODY, up=0.0):
        bv = bm.verts.new(v3(tx, ty, tz))
        bv[tag_layer] = tag
        bv[u_param_layer] = float(up)
        return bv

    def _add_quad(verts, uvs):
        try:
            f = bm.faces.new(verts)
        except ValueError:
            return None
        for k in range(4):
            f.loops[k][uv_layer].uv = uvs[k]
        return f

    def _add_tri(verts, uvs):
        try:
            f = bm.faces.new(verts)
        except ValueError:
            return None
        for k in range(3):
            f.loops[k][uv_layer].uv = uvs[k]
        return f

    # ==========================================================================
    # 3. PLUMP TAIL + COMPACT PEAR TORSO + COZY NECK (Clean 16-Seg Loft!)
    # ==========================================================================
    N_BODY = 16
    torso_tail_stations = [
        (0.456, -0.790, 0.012, 0.014, 0.014, 1.24, 0.03),
        (0.415, -0.722, 0.020, 0.023, 0.023, 1.30, 0.07),
        (0.362, -0.635, 0.028, 0.032, 0.032, 1.38, 0.11),
        (0.308, -0.538, 0.038, 0.041, 0.041, 1.48, 0.16),
        (0.268, -0.432, 0.048, 0.050, 0.050, 1.62, 0.20),
        (0.252, -0.320, 0.060, 0.062, 0.060, 1.70, 0.25),
        (0.266, -0.208, 0.072, 0.072, 0.070, 1.62, 0.30),
        (0.292, -0.115, 0.086, 0.084, 0.080, 1.30, 0.34),
        (0.302, -0.048, 0.108, 0.098, 0.094, 0.64, 0.37),
        # Compact sturdy pear-shaped heroic torso (`y = 0.295..0.575`)
        (0.306, -0.008, 0.132, 0.122, 0.114, 0.14, 0.40),
        (0.346, -0.004, 0.142, 0.128, 0.118, 0.04, 0.44),
        (0.392,  0.000, 0.134, 0.120, 0.110, 0.00, 0.49),
        (0.444,  0.004, 0.125, 0.112, 0.104, 0.00, 0.54),
        (0.496,  0.006, 0.124, 0.108, 0.102, 0.00, 0.58),
        (0.544,  0.005, 0.106, 0.094, 0.090, 0.00, 0.62),
        (0.588,  0.007, 0.082, 0.080, 0.080, -0.04, 0.66),
        (0.640,  0.014, 0.088, 0.086, 0.086, -0.06, 0.69),  # Extends seamlessly into head base!
    ]

    body_rings, body_t3, body_vuv = [], [], []
    for s_idx, (cy, cz, rx, rzf, rzb, pitch, v_uv) in enumerate(torso_tail_stations):
        cp, sp = math.cos(pitch), math.sin(pitch)
        r_v, r_t = [], []
        for j in range(N_BODY):
            th = (2.0 * math.pi * j) / N_BODY
            sth, cth = math.sin(th), math.cos(th)
            rz = rzf if cth >= 0.0 else rzb
            lx, lz = rx * sth, rz * cth
            if 9 <= s_idx <= 13 and cth > 0.25:
                lz += 0.008 * (cth ** 2) * math.sin(((s_idx - 9) / 4.0) * math.pi)
            x = lx
            y = cy - lz * sp
            z = cz + lz * cp
            r_v.append(_new_v(x, y, z, TAG_BODY, v_uv))
            r_t.append((x, y, z))
        body_rings.append(r_v)
        body_t3.append(r_t)
        body_vuv.append(v_uv)

    for s in range(len(torso_tail_stations) - 1):
        for j in range(N_BODY):
            jn = (j + 1) % N_BODY
            pts = [body_t3[s][j], body_t3[s][jn], body_t3[s + 1][jn], body_t3[s + 1][j]]
            vvs = [body_vuv[s], body_vuv[s], body_vuv[s + 1], body_vuv[s + 1]]
            raw_u = [list(_uv_skin_cyl(pts[k][0], pts[k][1], pts[k][2], False, vvs[k])) for k in range(4)]
            uvals = [u[0] for u in raw_u]
            if max(uvals) - min(uvals) > 0.30:
                for u in raw_u:
                    if u[0] < 0.34:
                        u[0] += 0.64
            _add_quad(
                [body_rings[s][j], body_rings[s][jn], body_rings[s + 1][jn], body_rings[s + 1][j]],
                [(u[0], u[1]) for u in raw_u],
            )

    v_tail_tip = _new_v(0.0, 0.464, -0.806, TAG_BODY, 0.02)
    for j in range(N_BODY):
        jn = (j + 1) % N_BODY
        _add_tri([v_tail_tip, body_rings[0][jn], body_rings[0][j]], [_uv_skin(0.5, 0.02)] * 3)

    # ==========================================================================
    # 4. ADORABLE PIXAR MASCOT HEAD (`y = 0.620 .. 0.992m`, Cozy Heart/Bean Shape!)
    # ==========================================================================
    N_HEAD_U = 24
    N_HEAD_V = 15
    head_rings, head_uvs = [], []
    H_CY = 0.802
    H_CZ = 0.016

    for iv in range(1, N_HEAD_V):
        t_v = iv / float(N_HEAD_V)
        phi = -0.5 * math.pi + t_v * math.pi
        cp, sp = math.cos(phi), math.sin(phi)
        r_v, r_uv = [], []

        for iu in range(N_HEAD_U):
            th = (2.0 * math.pi * iu) / N_HEAD_U
            sth, cth = math.sin(th), math.cos(th)

            # Cozy, wide, lovable Pixar mascot proportions (less tall-egg, wider cute cheeks!)
            rx_h = 0.174
            ry_h = 0.184
            rz_h = 0.160

            cheek_band = math.exp(-((sp + 0.24) / 0.36) ** 2)
            rx_h += 0.024 * cheek_band
            # Gently rounded warm crown dome
            forehead_taper = max(0.0, sp)
            rx_h -= 0.012 * (forehead_taper ** 1.4)

            x = rx_h * cp * sth
            y = H_CY + ry_h * sp
            z = H_CZ + rz_h * cp * cth

            if cth > 0.10:
                # Plush, SOFT ROUNDED cute axolotl-dragon muzzle (broad & lovable in side profile!)
                muzzle_lat = math.exp(-((x / 0.128) ** 2))
                muzzle_v = math.exp(-(((y - 0.752) / 0.072) ** 2))
                muzzle_fwd = (cth ** 1.35) * muzzle_lat * muzzle_v
                z += 0.048 * muzzle_fwd
                # Soft rounded nose bridge cushion (NO pointy spike!)
                nose_round = math.exp(-((x / 0.068) ** 2 + ((y - 0.774) / 0.046) ** 2)) * (cth ** 1.6)
                z += 0.012 * nose_round
                y += 0.004 * nose_round

                # Plump warm smiling cheek pillows
                for sgn in (1.0, -1.0):
                    d_chk = ((x - sgn * 0.114) / 0.060) ** 2 + ((y - 0.742) / 0.046) ** 2
                    if d_chk < 2.2:
                        swell = math.exp(-d_chk * 1.1) * 0.021 * max(0.0, cth)
                        x += sgn * swell * 0.65
                        z += swell * 0.85

                    # Soft recessed eye sockets so huge jewel eyes nestle snugly inside!
                    d_eye = ((x - sgn * EYE_X) / 0.068) ** 2 + ((y - EYE_Y) / 0.072) ** 2
                    if d_eye < 1.55 and z > 0.06:
                        z -= math.exp(-d_eye * 1.65) * 0.042

                    # Subtle soft brow-arch cushion
                    d_br = ((x - sgn * 0.085) / 0.052) ** 2 + ((y - 0.884) / 0.026) ** 2
                    if d_br < 1.8 and z > 0.07:
                        z += math.exp(-d_br * 1.4) * 0.008

                # Gentle warm 3D smile curve & soft chin
                if z > 0.10 and abs(x) < 0.115 and 0.690 < y < 0.758:
                    smile_y = 0.714 + 0.024 * ((min(0.105, abs(x)) / 0.095) ** 1.65)
                    dl = abs(y - smile_y)
                    if dl < 0.009:
                        z -= (1.0 - dl / 0.009) * 0.005
                    elif dl < 0.020 and y < smile_y:
                        z += math.sin(((dl - 0.009) / 0.011) * math.pi) * 0.004

            if y < 0.648:
                blend_n = clamp01((0.648 - y) / 0.036)
                y = 0.648 - (0.648 - y) * 0.72
                z = z * (1.0 - blend_n * 0.25) + 0.012 * (blend_n * 0.25)

            y = min(0.992, y)

            ang_u = math.atan2(x, max(1e-5, z - H_CZ) if z >= H_CZ else (z - H_CZ))
            su_h = 0.5 + ang_u / (2.0 * math.pi)
            sv_h = 0.705 + clamp01((y - 0.625) / 0.367) * 0.275
            if cth > 0.2:
                sv_h = 0.692 + clamp01((y - 0.620) / 0.372) * 0.290

            r_v.append(_new_v(x, y, z, TAG_HEAD, sv_h))
            r_uv.append((su_h, sv_h))
        head_rings.append(r_v)
        head_uvs.append(r_uv)

    for ir in range(len(head_rings) - 1):
        for iu in range(N_HEAD_U):
            iun = (iu + 1) % N_HEAD_U
            raw_s = [head_uvs[ir][iu], head_uvs[ir][iun], head_uvs[ir + 1][iun], head_uvs[ir + 1][iu]]
            us = [p[0] for p in raw_s]
            wrap_seam = (max(us) - min(us)) > 0.50
            fixed_uvs = [
                _uv_skin(clamp01((su_p + 1.0) if (wrap_seam and su_p < 0.5) else su_p), sv_p)
                for su_p, sv_p in raw_s
            ]
            _add_quad(
                [head_rings[ir][iu], head_rings[ir][iun], head_rings[ir + 1][iun], head_rings[ir + 1][iu]],
                fixed_uvs,
            )

    v_crown = _new_v(0.0, 0.992, H_CZ, TAG_HEAD, 0.98)
    v_chin_bot = _new_v(0.0, 0.620, H_CZ, TAG_HEAD, 0.70)
    for iu in range(N_HEAD_U):
        iun = (iu + 1) % N_HEAD_U
        _add_tri([head_rings[-1][iu], head_rings[-1][iun], v_crown], [_uv_skin(0.5, 0.98)] * 3)
        _add_tri([head_rings[0][iun], head_rings[0][iu], v_chin_bot], [_uv_skin(0.5, 0.70)] * 3)

    # ==========================================================================
    # 5. HUGE BRIGHT GLOSSY PIXAR EYES + ARCHED UPPER LIDS + TUCKED LOWER LIDS + BROWS
    # ==========================================================================
    EYE_RX, EYE_RY, EYE_RZ = 0.068, 0.074, 0.056

    for is_left in (True, False):
        sgn = 1.0 if is_left else -1.0
        ecx, ecy, ecz = sgn * EYE_X, EYE_Y, EYE_Z
        yaw_e = sgn * EYE_YAW
        cy_e, sy_e = math.cos(yaw_e), math.sin(yaw_e)
        eye_tag = TAG_EYE_L if is_left else TAG_EYE_R
        ulid_tag = TAG_ULID_L if is_left else TAG_ULID_R
        llid_tag = TAG_LLID_L if is_left else TAG_LLID_R
        brow_tag = TAG_BROW_L if is_left else TAG_BROW_R

        def _eye_to_world(lx, ly, lz):
            wx = ecx + lx * cy_e + lz * sy_e
            wz = ecz - lx * sy_e + lz * cy_e
            return (wx, ecy + ly, wz)

        # A) Glossy Eyeball Dome (`16 x 6` clean rings!)
        u_segs_e = 16
        thetas_e = [118, 86, 62, 44, 28, 13]
        e_rings = []
        for deg in thetas_e:
            th = math.radians(deg)
            sr, cr = math.sin(th), math.cos(th)
            ring = []
            for iu in range(u_segs_e):
                a = (2.0 * math.pi * iu) / u_segs_e
                ca, sa = math.cos(a), math.sin(a)
                wx, wy, wz = _eye_to_world(EYE_RX * sr * ca, EYE_RY * sr * sa, EYE_RZ * cr)
                uv_r = min(1.04, deg / 62.0) * 0.132
                ring.append((_new_v(wx, wy, wz, eye_tag), 0.84 + ca * uv_r, 0.85 + sa * uv_r))
            e_rings.append(ring)

        for ir in range(len(e_rings) - 1):
            r0, r1 = e_rings[ir], e_rings[ir + 1]
            for iu in range(u_segs_e):
                iun = (iu + 1) % u_segs_e
                _add_quad(
                    [r0[iu][0], r0[iun][0], r1[iun][0], r1[iu][0]],
                    [(r0[iu][1], r0[iu][2]), (r0[iun][1], r0[iun][2]), (r1[iun][1], r1[iun][2]), (r1[iu][1], r1[iu][2])],
                )
        v_pup = _new_v(*_eye_to_world(0.0, 0.0, EYE_RZ), eye_tag)
        for iu in range(u_segs_e):
            iun = (iu + 1) % u_segs_e
            _add_tri(
                [e_rings[-1][iu][0], e_rings[-1][iun][0], v_pup],
                [(e_rings[-1][iu][1], e_rings[-1][iu][2]), (e_rings[-1][iun][1], e_rings[-1][iun][2]), (0.84, 0.85)],
            )

        # B) WIDE-OPEN GRACEFULLY ARCHED Upper Eyelid (`EyelidL/R`, ZERO sleepy droop!)
        # Lower lash rim arches high (`+42 deg` at center above pupil, curving sweetly down to `+24 deg` at corners!)
        ul_u, ul_v = 9, 3
        ul_rings = []
        for iv in range(ul_v):
            fv = iv / float(ul_v - 1)  # 0 = lower winged lash rim, 1 = upper back tuck
            row = []
            for iu in range(ul_u):
                fu = iu / float(ul_u - 1)  # 0 = inner nose side, 1 = outer cheek wing
                # High bright open curve in center (`sin(fu*pi)` arch!) so whole jewel iris gleams!
                arch_deg = 24.0 + 22.0 * math.sin(fu * math.pi)
                elev = math.radians(arch_deg + fv * (86.0 - arch_deg))
                ce, se = math.cos(elev), math.sin(elev)
                az = math.radians((-72.0 + fu * 154.0) * sgn)
                wing_x = sgn * (0.008 * ((max(0.0, fu - 0.62) / 0.38) ** 1.6)) * (1.0 - fv)
                wing_y = (0.006 * ((max(0.0, fu - 0.62) / 0.38) ** 1.4)) * (1.0 - fv)
                pad = 0.0046
                lx = (EYE_RX + pad) * ce * math.sin(az) + wing_x
                ly = (EYE_RY + pad) * se + wing_y
                lz = (EYE_RZ + pad) * ce * math.cos(az)
                row.append((_new_v(*_eye_to_world(lx, ly, lz), ulid_tag), _uv_lid(fu, fv)))
            ul_rings.append(row)

        for iv in range(ul_v - 1):
            for iu in range(ul_u - 1):
                a, b = ul_rings[iv][iu], ul_rings[iv][iu + 1]
                c, d = ul_rings[iv + 1][iu + 1], ul_rings[iv + 1][iu]
                verts = [a[0], b[0], c[0], d[0]] if is_left else [b[0], a[0], d[0], c[0]]
                uvs = [a[1], b[1], c[1], d[1]] if is_left else [b[1], a[1], d[1], c[1]]
                _add_quad(verts, uvs)

        # C) Snugly Tucked Curved Lower Eyelid (`LowerLidL/R`, blends seamlessly into sea-mint cheek & lifts into `^ ^` happy squint!)
        ll_u, ll_v = 9, 3
        ll_rings = []
        for iv in range(ll_v):
            fv = iv / float(ll_v - 1)
            row = []
            for iu in range(ll_u):
                fu = iu / float(ll_u - 1)
                # Full smooth upward smile arch (`^ ^` crescent when lifted!)
                smile_arch = -44.0 + 16.0 * math.sin(fu * math.pi)
                elev = math.radians(smile_arch - fv * 36.0)
                ce, se = math.cos(elev), math.sin(elev)
                az = math.radians((-82.0 + fu * 164.0) * sgn)
                pad = 0.0040
                lx = (EYE_RX + pad) * ce * math.sin(az)
                ly = (EYE_RY + pad) * se
                lz = (EYE_RZ + pad) * ce * math.cos(az)
                # Match exact surrounding sea-mint cheek skin UV (`su = 0.5 +- 0.14, sv = 0.84`, outside belly/blush seam!)
                row.append((_new_v(*_eye_to_world(lx, ly, lz), llid_tag), _uv_skin(0.5 + sgn * 0.15, 0.835)))
            ll_rings.append(row)

        for iv in range(ll_v - 1):
            for iu in range(ll_u - 1):
                a, b = ll_rings[iv][iu], ll_rings[iv][iu + 1]
                c, d = ll_rings[iv + 1][iu + 1], ll_rings[iv + 1][iu]
                verts = [b[0], a[0], d[0], c[0]] if is_left else [a[0], b[0], c[0], d[0]]
                uvs = [b[1], a[1], d[1], c[1]] if is_left else [a[1], b[1], c[1], d[1]]
                _add_quad(verts, uvs)

        # D) Expressive Curved Floating Brow Arc (`BrowL/R`, crisp & organic!)
        br_segs, br_ring_n = 7, 5
        br_rings = []
        for i_s in range(br_segs):
            t = i_s / float(br_segs - 1)
            taper = math.sin(t * math.pi) ** 0.55 * 0.74 + 0.26
            bx = sgn * (0.044 + t * 0.086)
            by = 0.884 + 0.015 * math.sin(t * math.pi) - 0.003 * t
            bz = 0.172 - 0.036 * (t ** 1.55)
            r_h, r_d = 0.0105 * taper, 0.0095 * taper
            ring = []
            for k in range(br_ring_n):
                ang = (2.0 * math.pi * k) / br_ring_n
                ring.append((_new_v(bx, by + math.sin(ang) * r_h, bz + math.cos(ang) * r_d, brow_tag), _uv_brow(t, 0.5 + 0.45 * math.sin(ang))))
            br_rings.append(ring)

        for i_s in range(br_segs - 1):
            for k in range(br_ring_n):
                kn = (k + 1) % br_ring_n
                a, b = br_rings[i_s][k], br_rings[i_s][kn]
                c, d = br_rings[i_s + 1][kn], br_rings[i_s + 1][k]
                verts = [a[0], b[0], c[0], d[0]] if is_left else [b[0], a[0], d[0], c[0]]
                uvs = [a[1], b[1], c[1], d[1]] if is_left else [b[1], a[1], d[1], c[1]]
                _add_quad(verts, uvs)
        for end_ring, flip in ((br_rings[0], is_left), (br_rings[-1], not is_left)):
            vc = _new_v(
                sum(b2t(it[0].co)[0] for it in end_ring) / br_ring_n,
                sum(b2t(it[0].co)[1] for it in end_ring) / br_ring_n,
                sum(b2t(it[0].co)[2] for it in end_ring) / br_ring_n,
                brow_tag,
            )
            for k in range(br_ring_n):
                kn = (k + 1) % br_ring_n
                tri = [vc, end_ring[kn][0], end_ring[k][0]] if flip else [vc, end_ring[k][0], end_ring[kn][0]]
                _add_tri(tri, [_uv_brow(0.5, 0.5)] * 3)

    # ==========================================================================
    # 6. 6 VOLUMETRIC CORAL-PETAL EAR-FRILLS + DUAL-LOBED TAIL-FIN + DORSAL PEARLS
    # ==========================================================================
    def _add_volumetric_petal_frond(ctrl_pts, widths, thicks, tag, v_band=(0.05, 0.95), n_len=6, n_wid=4):
        p0, pm, p1 = [Vector(p) for p in ctrl_pts]
        top_grid, bot_grid = [], []
        for iu in range(n_len):
            u = iu / float(n_len - 1)
            om = 1.0 - u
            center = p0 * (om * om) + pm * (2.0 * om * u) + p1 * (u * u)
            tang = (pm - p0) * (2.0 * om) + (p1 - pm) * (2.0 * u)
            if tang.length < 1e-6:
                tang = Vector((1.0, 0.0, 0.0))
            tang.normalize()
            cam_n = Vector((0.18 if center.x >= 0 else -0.18, 0.15, 0.96)).normalized()
            side_w = tang.cross(cam_n)
            if side_w.length < 1e-5:
                side_w = Vector((0.0, 1.0, 0.0))
            side_w.normalize()
            norm_f = side_w.cross(tang).normalized()
            if norm_f.z < 0:
                norm_f = -norm_f

            w_prof = (widths[0] * (1.0 - u) + widths[1] * u) * (0.48 + 0.88 * math.sin(u * math.pi) ** 0.72)
            if iu == n_len - 1:
                w_prof *= 0.16
            th_prof = (thicks[0] * (1.0 - u) + thicks[1] * u) * (1.0 - 0.55 * u)

            t_row, b_row = [], []
            for iv in range(n_wid):
                fv = iv / float(n_wid - 1)
                s_w = (fv - 0.5) * 2.0
                pillow = math.sqrt(max(0.02, 1.0 - s_w * s_w))
                cup = (1.0 - s_w * s_w) * 0.012 * math.sin(u * math.pi)
                pt_base = center + side_w * (s_w * w_prof) + norm_f * cup
                v_uv = v_band[0] + fv * (v_band[1] - v_band[0])
                t_row.append((_new_v(*(pt_base + norm_f * (th_prof * pillow)), tag, u), _uv_frill(u, v_uv)))
                b_row.append((_new_v(*(pt_base - norm_f * (th_prof * pillow * 0.85)), tag, u), _uv_frill(u, v_uv)))
            top_grid.append(t_row)
            bot_grid.append(b_row)

        for iu in range(n_len - 1):
            for iv in range(n_wid - 1):
                a, b = top_grid[iu][iv], top_grid[iu][iv + 1]
                c, d = top_grid[iu + 1][iv + 1], top_grid[iu + 1][iv]
                _add_quad([a[0], b[0], c[0], d[0]], [a[1], b[1], c[1], d[1]])
                ab, bb = bot_grid[iu][iv], bot_grid[iu][iv + 1]
                cb, db = bot_grid[iu + 1][iv + 1], bot_grid[iu + 1][iv]
                _add_quad([ab[0], db[0], cb[0], bb[0]], [ab[1], db[1], cb[1], bb[1]])
        for iu in range(n_len - 1):
            _add_quad([top_grid[iu][0][0], top_grid[iu + 1][0][0], bot_grid[iu + 1][0][0], bot_grid[iu][0][0]], [top_grid[iu][0][1]] * 4)
            _add_quad([top_grid[iu][-1][0], bot_grid[iu][-1][0], bot_grid[iu + 1][-1][0], top_grid[iu + 1][-1][0]], [top_grid[iu][-1][1]] * 4)
        for iv in range(n_wid - 1):
            _add_quad([top_grid[-1][iv][0], top_grid[-1][iv + 1][0], bot_grid[-1][iv + 1][0], bot_grid[-1][iv][0]], [top_grid[-1][iv][1]] * 4)

    for is_left in (True, False):
        sgn = 1.0 if is_left else -1.0
        t_top = TAG_FRILL_TL if is_left else TAG_FRILL_TR
        t_bot = TAG_FRILL_BL if is_left else TAG_FRILL_BR
        _add_volumetric_petal_frond(
            [(sgn * 0.132, 0.858, -0.005), (sgn * 0.232, 0.985, -0.078), (sgn * 0.308, 1.102, -0.145)],
            widths=(0.036, 0.048), thicks=(0.011, 0.005), tag=t_top, v_band=(0.06, 0.36),
        )
        _add_volumetric_petal_frond(
            [(sgn * 0.152, 0.794,  0.002), (sgn * 0.270, 0.844, -0.088), (sgn * 0.358, 0.862, -0.165)],
            widths=(0.044, 0.056), thicks=(0.012, 0.005), tag=t_top, v_band=(0.34, 0.68),
        )
        _add_volumetric_petal_frond(
            [(sgn * 0.150, 0.726,  0.008), (sgn * 0.240, 0.690, -0.055), (sgn * 0.280, 0.618, -0.095)],
            widths=(0.034, 0.044), thicks=(0.010, 0.005), tag=t_bot, v_band=(0.66, 0.95),
        )

    for is_left in (True, False):
        sgn = 1.0 if is_left else -1.0
        _add_volumetric_petal_frond(
            [(sgn * 0.014, 0.365, -0.625), (sgn * 0.082, 0.422, -0.742), (sgn * 0.118, 0.488, -0.848)],
            widths=(0.036, 0.052), thicks=(0.008, 0.004), tag=TAG_TAIL_FIN, v_band=(0.12, 0.88), n_len=5, n_wid=4,
        )

    def _add_smooth_ellipsoid(center_t3, radii_t3, tag, uv_fn, u_s=8, v_s=5, up=0.0):
        cx, cy, cz = center_t3
        rx, ry, rz = radii_t3
        rings = []
        for iv in range(1, v_s):
            phi = -0.5 * math.pi + (math.pi * iv) / v_s
            cp, sp = math.cos(phi), math.sin(phi)
            row = []
            for iu in range(u_s):
                a = (2.0 * math.pi * iu) / u_s
                row.append((_new_v(cx + rx * cp * math.cos(a), cy + ry * sp, cz + rz * cp * math.sin(a), tag, up), uv_fn(iu / float(u_s), iv / float(v_s))))
            rings.append(row)
        for ir in range(len(rings) - 1):
            for iu in range(u_s):
                iun = (iu + 1) % u_s
                _add_quad(
                    [rings[ir][iu][0], rings[ir][iun][0], rings[ir + 1][iun][0], rings[ir + 1][iu][0]],
                    [rings[ir][iu][1], rings[ir][iun][1], rings[ir + 1][iun][1], rings[ir + 1][iu][1]],
                )
        for cap_y, r_end, flip in ((cy - ry, rings[0], True), (cy + ry, rings[-1], False)):
            vc = _new_v(cx, cap_y, cz, tag, up)
            cuv = uv_fn(0.5, 0.0 if flip else 1.0)
            for iu in range(u_s):
                iun = (iu + 1) % u_s
                verts = [vc, r_end[iun][0], r_end[iu][0]] if flip else [vc, r_end[iu][0], r_end[iun][0]]
                _add_tri(verts, [cuv, r_end[iu][1], r_end[iun][1]])

    for yd, zd, rx_d, ry_d, rz_d in [
        (0.452, -0.104, 0.011, 0.014, 0.022),
        (0.376, -0.114, 0.012, 0.015, 0.024),
        (0.320, -0.156, 0.012, 0.015, 0.024),
        (0.296, -0.252, 0.011, 0.014, 0.024),
        (0.294, -0.362, 0.010, 0.013, 0.022),
        (0.320, -0.474, 0.009, 0.012, 0.020),
        (0.370, -0.582, 0.008, 0.010, 0.017),
    ]:
        _add_smooth_ellipsoid((0.0, yd, zd), (rx_d, ry_d, rz_d), TAG_DORSAL, lambda u, v: _uv_frill(0.25 + 0.55 * v, 0.5), u_s=6, v_s=4)

    # ==========================================================================
    # 7. COMPACT ATHLETIC ARMS & STURDY LEGS + ADORABLE WEBBED PAWS!
    # ==========================================================================
    def _add_limb_chain(stations, tag, n_seg=10, cap_start=True, cap_end=True):
        centers = [Vector(s[:3]) for s in stations]
        rings, tangs = [], []
        for i in range(len(centers)):
            p0 = centers[i] if i == 0 else centers[i - 1]
            p1 = centers[i] if i == len(centers) - 1 else centers[i + 1]
            tg = p1 - p0
            tangs.append(tg.normalized() if tg.length > 1e-6 else Vector((0, -1, 0)))

        up0 = Vector((0, 0, 1)) if abs(tangs[0].z) < 0.85 else Vector((1, 0, 0))
        b1 = tangs[0].cross(up0).normalized()
        b2 = tangs[0].cross(b1).normalized()

        for i, (cx, cy, cz, r1, r2, v_uv) in enumerate(stations):
            if i > 0:
                q = tangs[i - 1].rotation_difference(tangs[i])
                b1 = (q @ b1).normalized()
                b2 = (q @ b2).normalized()
            c = centers[i]
            row = []
            for k in range(n_seg):
                ang = (2.0 * math.pi * k) / n_seg
                pt = c + b1 * (math.cos(ang) * r1) + b2 * (math.sin(ang) * r2)
                py_clamped = max(0.000, pt.y)
                row.append((_new_v(pt.x, py_clamped, pt.z, tag, v_uv), _uv_skin_cyl(pt.x, py_clamped, pt.z, True, v_uv)))
            rings.append(row)

        for i in range(len(rings) - 1):
            for k in range(n_seg):
                kn = (k + 1) % n_seg
                _add_quad(
                    [rings[i][k][0], rings[i][kn][0], rings[i + 1][kn][0], rings[i + 1][k][0]],
                    [rings[i][k][1], rings[i][kn][1], rings[i + 1][kn][1], rings[i + 1][k][1]],
                )
        if cap_start:
            c0 = centers[0]
            vc0 = _new_v(c0.x, c0.y, c0.z, tag, stations[0][5])
            for k in range(n_seg):
                kn = (k + 1) % n_seg
                _add_tri([vc0, rings[0][kn][0], rings[0][k][0]], [rings[0][k][1]] * 3)
        if cap_end:
            ce = centers[-1]
            vce = _new_v(ce.x, max(0.002, ce.y), ce.z, tag, stations[-1][5])
            for k in range(n_seg):
                kn = (k + 1) % n_seg
                _add_tri([vce, rings[-1][k][0], rings[-1][kn][0]], [rings[-1][k][1]] * 3)

    for is_left in (True, False):
        sgn = 1.0 if is_left else -1.0
        arm_tag = TAG_LIMB_ARML if is_left else TAG_LIMB_ARMR
        _add_limb_chain([
            (sgn * 0.105, 0.518,  0.002, 0.044, 0.042, 0.56),
            (sgn * 0.146, 0.488, -0.004, 0.042, 0.040, 0.52),
            (sgn * 0.178, 0.436, -0.012, 0.036, 0.035, 0.47),
            (sgn * 0.194, 0.382,  0.014, 0.038, 0.036, 0.42),
            (sgn * 0.204, 0.338,  0.042, 0.031, 0.029, 0.37),
            (sgn * 0.212, 0.302,  0.068, 0.036, 0.025, 0.34),
        ], arm_tag, n_seg=8)
        for ox, oy, oz, frx, fry, frz in [
            (-0.024, -0.016, 0.026, 0.010, 0.012, 0.016),
            (-0.012, -0.032, 0.034, 0.010, 0.011, 0.019),
            ( 0.006, -0.034, 0.036, 0.010, 0.011, 0.020),
            ( 0.022, -0.028, 0.030, 0.009, 0.010, 0.017),
        ]:
            _add_smooth_ellipsoid((sgn * 0.212 + sgn * ox, 0.302 + oy, 0.068 + oz), (frx, fry, frz), arm_tag, lambda u, v: _uv_skin(0.5, 0.34), u_s=6, v_s=4)

    for is_left in (True, False):
        sgn = 1.0 if is_left else -1.0
        leg_tag = TAG_LIMB_LEGL if is_left else TAG_LIMB_LEGR
        _add_limb_chain([
            (sgn * 0.076, 0.312,  0.002, 0.064, 0.068, 0.36),
            (sgn * 0.088, 0.245,  0.022, 0.062, 0.066, 0.30),
            (sgn * 0.090, 0.175,  0.040, 0.048, 0.050, 0.23),
            (sgn * 0.089, 0.118,  0.012, 0.046, 0.048, 0.16),
            (sgn * 0.088, 0.068, -0.016, 0.036, 0.038, 0.10),
            (sgn * 0.088, 0.026,  0.026, 0.042, 0.026, 0.05),
            (sgn * 0.088, 0.022,  0.072, 0.048, 0.022, 0.03),
        ], leg_tag, n_seg=10)
        for tx_o, tz_o, rx_t, ry_t, rz_t in [
            (-0.026, 0.106, 0.016, 0.015, 0.032),
            ( 0.000, 0.116, 0.017, 0.016, 0.036),
            ( 0.026, 0.104, 0.016, 0.015, 0.031),
        ]:
            _add_smooth_ellipsoid((sgn * 0.088 + sgn * tx_o, ry_t, tz_o), (rx_t, ry_t, rz_t), leg_tag, lambda u, v: _uv_skin(0.5, 0.05), u_s=6, v_s=4)

    # ==========================================================================
    # 8. FLOWING CORAL-SUNSET & GOLD SEA-SILK EXPLORER SCARF + SNUG CUFFS + SATCHEL
    # ==========================================================================
    # A) Plush Scarf Cowl wrapped cozily right up under her cute chin (ZERO neck gap!)
    n_cowl_u, n_cowl_v = 16, 6
    cowl_rings = []
    for iu in range(n_cowl_u):
        a = (2.0 * math.pi * iu) / n_cowl_u
        ca, sa = math.cos(a), math.sin(a)
        cx_c = 0.104 * sa
        cz_c = 0.008 + (0.104 if ca > 0 else 0.098) * ca
        cy_c = 0.606 - 0.016 * max(0.0, ca) + 0.005 * math.sin(a * 3.0)
        r_tube_r = 0.031 + 0.006 * max(0.0, ca)
        r_tube_y = 0.036 + 0.005 * max(0.0, ca)
        rad_dir = Vector((sa, 0.0, ca)).normalized()
        row = []
        for iv in range(n_cowl_v):
            b = (2.0 * math.pi * iv) / n_cowl_v
            pt = Vector((cx_c, cy_c, cz_c)) + rad_dir * (math.cos(b) * r_tube_r) + Vector((0.0, math.sin(b) * r_tube_y, 0.0))
            row.append((_new_v(*pt, TAG_SCARF_COL), _uv_scarf(iu / float(n_cowl_u), iv / float(n_cowl_v))))
        cowl_rings.append(row)

    for iu in range(n_cowl_u):
        iun = (iu + 1) % n_cowl_u
        for iv in range(n_cowl_v):
            ivn = (iv + 1) % n_cowl_v
            _add_quad(
                [cowl_rings[iu][iv][0], cowl_rings[iu][ivn][0], cowl_rings[iun][ivn][0], cowl_rings[iun][iv][0]],
                [cowl_rings[iu][iv][1], cowl_rings[iu][ivn][1], cowl_rings[iun][ivn][1], cowl_rings[iun][iv][1]],
            )

    # B) Two Flowing Asymmetric Sea-Silk Scarf Ribbons (`ScarfL1/L2`, `ScarfR1/R2`)
    def _add_scarf_ribbon(ctrl_pts, w_root, w_tip, thick, tag, n_len=8, n_wid=4):
        p0, pm, p1 = [Vector(p) for p in ctrl_pts]
        top_g, bot_g = [], []
        for iu in range(n_len):
            u = iu / float(n_len - 1)
            om = 1.0 - u
            center = p0 * (om * om) + pm * (2.0 * om * u) + p1 * (u * u)
            center.y += 0.012 * math.sin(u * math.pi * 2.0)
            tang = (pm - p0) * (2.0 * om) + (p1 - pm) * (2.0 * u)
            tang.normalize()
            side = tang.cross(Vector((0.0, 1.0, 0.0)))
            if side.length < 1e-5:
                side = Vector((1.0, 0.0, 0.0))
            side.normalize()
            up_n = side.cross(tang).normalized()
            if up_n.y < 0:
                up_n = -up_n

            half_w = 0.5 * (w_root * (1.0 - u) + w_tip * u)
            tr, br = [], []
            for iv in range(n_wid):
                fv = iv / float(n_wid - 1)
                sw = (fv - 0.5) * 2.0
                notch_pull = -0.028 * (1.0 - abs(sw)) if iu == n_len - 1 else 0.0
                pt_b = center + side * (sw * half_w) + tang * notch_pull + up_n * (0.005 * (1.0 - sw * sw))
                tr.append((_new_v(*(pt_b + up_n * (thick * 0.5)), tag, u), _uv_scarf(u, fv)))
                br.append((_new_v(*(pt_b - up_n * (thick * 0.5)), tag, u), _uv_scarf(u, fv)))
            top_g.append(tr)
            bot_g.append(br)

        for iu in range(n_len - 1):
            for iv in range(n_wid - 1):
                a, b = top_g[iu][iv], top_g[iu][iv + 1]
                c, d = top_g[iu + 1][iv + 1], top_g[iu + 1][iv]
                _add_quad([a[0], b[0], c[0], d[0]], [a[1], b[1], c[1], d[1]])
                ab, bb = bot_g[iu][iv], bot_g[iu][iv + 1]
                cb, db = bot_g[iu + 1][iv + 1], bot_g[iu + 1][iv]
                _add_quad([ab[0], db[0], cb[0], bb[0]], [ab[1], db[1], cb[1], bb[1]])
        for iu in range(n_len - 1):
            _add_quad([top_g[iu][0][0], top_g[iu + 1][0][0], bot_g[iu + 1][0][0], bot_g[iu][0][0]], [top_g[iu][0][1]] * 4)
            _add_quad([top_g[iu][-1][0], bot_g[iu][-1][0], bot_g[iu + 1][-1][0], top_g[iu + 1][-1][0]], [top_g[iu][-1][1]] * 4)
        for iv in range(n_wid - 1):
            _add_quad([top_g[-1][iv][0], top_g[-1][iv + 1][0], bot_g[-1][iv + 1][0], bot_g[-1][iv][0]], [_uv_scarf(0.98, 0.5)] * 4)

    _add_scarf_ribbon([(0.044, 0.580, -0.102), (0.092, 0.496, -0.275), (0.135, 0.410, -0.462)], 0.072, 0.096, 0.010, TAG_SCARF_L)
    _add_scarf_ribbon([(-0.044, 0.580, -0.102), (-0.084, 0.506, -0.245), (-0.118, 0.444, -0.395)], 0.064, 0.086, 0.010, TAG_SCARF_R)

    # C) Ornate Sunlit-Gold Collar Medallion & Glowing Faceted Star-Sapphire Water-Seed Pendant!
    def _add_gear_ring(center_t3, rx, rz, tube_r, band, tag, tilt_x=0.0, n_u=14, n_v=5):
        cx, cy, cz = center_t3
        ct, st = math.cos(tilt_x), math.sin(tilt_x)
        rings = []
        for iu in range(n_u):
            a = (2.0 * math.pi * iu) / n_u
            ca, sa = math.cos(a), math.sin(a)
            px = rx * sa
            pz = rz * ca
            py = -pz * st
            pz_r = pz * ct
            rad = Vector((sa, -ca * st, ca * ct)).normalized()
            up = Vector((0.0, ct, st)).normalized()
            row = []
            for iv in range(n_v):
                b = (2.0 * math.pi * iv) / n_v
                pt = Vector((cx + px, cy + py, cz + pz_r)) + rad * (math.cos(b) * tube_r) + up * (math.sin(b) * tube_r)
                row.append((_new_v(*pt, tag), _uv_gear(iu / float(n_u), band)))
            rings.append(row)
        for iu in range(n_u):
            iun = (iu + 1) % n_u
            for iv in range(n_v):
                ivn = (iv + 1) % n_v
                _add_quad(
                    [rings[iu][iv][0], rings[iu][ivn][0], rings[iun][ivn][0], rings[iun][iv][0]],
                    [rings[iu][iv][1], rings[iu][ivn][1], rings[iun][ivn][1], rings[iun][iv][1]],
                )

    _add_gear_ring((0.0, 0.562, 0.008), 0.118, 0.114, 0.010, band=1, tag=TAG_GEAR_CH, tilt_x=0.20, n_u=14, n_v=5)
    _add_smooth_ellipsoid((0.0, 0.532, 0.125), (0.036, 0.044, 0.016), TAG_GEAR_CH, lambda u, v: _uv_gear(u, 1), u_s=8, v_s=5)
    _add_smooth_ellipsoid((0.0, 0.532, 0.135), (0.024, 0.032, 0.015), TAG_GEAR_CH, lambda u, v: _uv_gear(u, 2), u_s=8, v_s=5)

    # D) Snugly-Fitted Golden Wrist Cuffs (ZERO floating gap!) + Right-Wrist Hydro-Caster Gem
    _add_gear_ring(( 0.201, 0.346, 0.036), 0.032, 0.031, 0.008, band=1, tag=TAG_CUFF_L, tilt_x=0.45, n_u=10, n_v=5)
    _add_gear_ring((-0.201, 0.346, 0.036), 0.033, 0.032, 0.009, band=1, tag=TAG_CUFF_R, tilt_x=0.45, n_u=10, n_v=5)
    _add_smooth_ellipsoid((-0.214, 0.340, 0.052), (0.015, 0.015, 0.018), TAG_CUFF_R, lambda u, v: _uv_gear(u, 2), u_s=7, v_s=4)

    # E) Snug Gold Ankle Explorer Bands
    _add_gear_ring(( 0.088, 0.068, -0.014), 0.037, 0.038, 0.007, band=1, tag=TAG_ANKLE_L, tilt_x=0.14, n_u=10, n_v=5)
    _add_gear_ring((-0.088, 0.068, -0.014), 0.037, 0.038, 0.007, band=1, tag=TAG_ANKLE_R, tilt_x=0.14, n_u=10, n_v=5)

    # F) Cute Bronze-Leather Explorer Satchel + Clean Continuous Non-Clipping Explorer Hip Belt!
    _add_smooth_ellipsoid((0.144, 0.346, -0.012), (0.028, 0.044, 0.046), TAG_SATCHEL, lambda u, v: _uv_gear(u, 0), u_s=8, v_s=5)
    _add_smooth_ellipsoid((0.150, 0.364, -0.012), (0.022, 0.022, 0.044), TAG_SATCHEL, lambda u, v: _uv_gear(u, 0), u_s=7, v_s=4)
    _add_smooth_ellipsoid((0.172, 0.350, -0.012), (0.008, 0.013, 0.014), TAG_SATCHEL, lambda u, v: _uv_gear(u, 1), u_s=6, v_s=4)
    # Clean proud explorer belt (`rx=0.148, rz=0.140, tube_r=0.010`) so it NEVER pokes through tummy!
    _add_gear_ring((0.0, 0.356, -0.002), 0.149, 0.140, 0.010, band=0, tag=TAG_SATCHEL, tilt_x=0.06, n_u=16, n_v=5)
    # Cute little golden front belt buckle centered cleanly at `(0, 0.348, +0.144)`!
    _add_smooth_ellipsoid((0.0, 0.348, 0.142), (0.020, 0.018, 0.010), TAG_SATCHEL, lambda u, v: _uv_gear(u, 1), u_s=6, v_s=4)

    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.verts.ensure_lookup_table()
    vert_tags = [int(v[tag_layer]) for v in bm.verts]
    vert_uparam = [float(v[u_param_layer]) for v in bm.verts]

    mesh = bpy.data.meshes.new("GatewayMeshData")
    bm.to_mesh(mesh)
    bm.free()

    for poly in mesh.polygons:
        poly.use_smooth = True
    mesh.materials.append(mat)

    body_obj = bpy.data.objects.new("GatewayMesh", mesh)
    scene.collection.objects.link(body_obj)

    min_sole_z = min(v.co.z for v in mesh.vertices)
    if abs(min_sole_z) > 1e-6:
        for v in mesh.vertices:
            v.co.z -= min_sole_z
        mesh.update()

    # ==========================================================================
    # 9. EXACT PART-TAGGED 50-BONE SKINNING WEIGHTS (Zero Bleed, Max 4 Weights!)
    # ==========================================================================
    body_obj.parent = arm_obj
    arm_mod = body_obj.modifiers.new(name="Armature", type="ARMATURE")
    arm_mod.object = arm_obj

    all_bone_names = [b[0] for b in BONE_SPECS]
    vgroups = {bn: body_obj.vertex_groups.new(name=bn) for bn in all_bone_names}

    bone_segs = {bname: (Vector(h_t3), Vector(t_t3)) for bname, _, h_t3, t_t3, _ in BONE_SPECS}

    def _seg_dist(pt, bname):
        hv, tv = bone_segs[bname]
        ab = tv - hv
        l2 = ab.length_squared
        t = clamp01((pt - hv).dot(ab) / l2) if l2 > 1e-8 else 0.0
        return (pt - (hv + ab * t)).length

    def _assign_chain_weights(vi, pt, candidates, sigma):
        w_raw = {}
        for bn in candidates:
            d = _seg_dist(pt, bn)
            w_raw[bn] = math.exp(-((d / sigma) ** 2) * 1.65) / ((d + 0.012) ** 2)
        items = sorted(w_raw.items(), key=lambda kv: kv[1], reverse=True)[:4]
        s = sum(v for _, v in items)
        if s <= 1e-9:
            vgroups[candidates[0]].add([vi], 1.0, "REPLACE")
            return
        for bn, wv in items:
            if wv / s > 0.003:
                vgroups[bn].add([vi], wv / s, "REPLACE")

    n_verts = len(mesh.vertices)
    for vi in range(n_verts):
        tx, ty, tz = b2t(mesh.vertices[vi].co)
        pt = Vector((tx, ty, tz))
        tag = vert_tags[vi]
        up = vert_uparam[vi]

        if tag == TAG_EYE_L:
            vgroups["EyeL"].add([vi], 1.0, "REPLACE")
        elif tag == TAG_EYE_R:
            vgroups["EyeR"].add([vi], 1.0, "REPLACE")
        elif tag == TAG_ULID_L:
            vgroups["EyelidL"].add([vi], 1.0, "REPLACE")
        elif tag == TAG_ULID_R:
            vgroups["EyelidR"].add([vi], 1.0, "REPLACE")
        elif tag == TAG_LLID_L:
            vgroups["LowerLidL"].add([vi], 1.0, "REPLACE")
        elif tag == TAG_LLID_R:
            vgroups["LowerLidR"].add([vi], 1.0, "REPLACE")
        elif tag == TAG_BROW_L:
            vgroups["BrowL"].add([vi], 1.0, "REPLACE")
        elif tag == TAG_BROW_R:
            vgroups["BrowR"].add([vi], 1.0, "REPLACE")
        elif tag == TAG_FRILL_TL:
            if up < 0.15:
                w0 = 1.0 - up / 0.15
                vgroups["Head"].add([vi], w0 * 0.45, "REPLACE")
                vgroups["FrillL1"].add([vi], 1.0 - w0 * 0.45, "REPLACE")
            elif up < 0.55:
                t = (up - 0.15) / 0.40
                vgroups["FrillL1"].add([vi], 1.0 - t * 0.5, "REPLACE")
                vgroups["FrillL2"].add([vi], t * 0.5, "REPLACE")
            else:
                t = clamp01((up - 0.55) / 0.45)
                vgroups["FrillL1"].add([vi], 0.5 * (1.0 - t), "REPLACE")
                vgroups["FrillL2"].add([vi], 0.5 + 0.5 * t, "REPLACE")
        elif tag == TAG_FRILL_TR:
            if up < 0.15:
                w0 = 1.0 - up / 0.15
                vgroups["Head"].add([vi], w0 * 0.45, "REPLACE")
                vgroups["FrillR1"].add([vi], 1.0 - w0 * 0.45, "REPLACE")
            elif up < 0.55:
                t = (up - 0.15) / 0.40
                vgroups["FrillR1"].add([vi], 1.0 - t * 0.5, "REPLACE")
                vgroups["FrillR2"].add([vi], t * 0.5, "REPLACE")
            else:
                t = clamp01((up - 0.55) / 0.45)
                vgroups["FrillR1"].add([vi], 0.5 * (1.0 - t), "REPLACE")
                vgroups["FrillR2"].add([vi], 0.5 + 0.5 * t, "REPLACE")
        elif tag == TAG_FRILL_BL:
            w_h = clamp01(1.0 - up * 3.5) * 0.38
            vgroups["Head"].add([vi], w_h, "REPLACE")
            vgroups["FrillBotL"].add([vi], 1.0 - w_h, "REPLACE")
        elif tag == TAG_FRILL_BR:
            w_h = clamp01(1.0 - up * 3.5) * 0.38
            vgroups["Head"].add([vi], w_h, "REPLACE")
            vgroups["FrillBotR"].add([vi], 1.0 - w_h, "REPLACE")
        elif tag == TAG_SCARF_COL:
            w_neck = clamp01((ty - 0.585) / 0.055) * 0.35
            vgroups["Chest"].add([vi], 1.0 - w_neck, "REPLACE")
            if w_neck > 0.01:
                vgroups["Neck"].add([vi], w_neck, "REPLACE")
        elif tag == TAG_SCARF_L:
            if up < 0.12:
                t = up / 0.12
                vgroups["Chest"].add([vi], 1.0 - t, "REPLACE")
                vgroups["ScarfL1"].add([vi], t, "REPLACE")
            elif up < 0.58:
                t = (up - 0.12) / 0.46
                vgroups["ScarfL1"].add([vi], 1.0 - t * 0.65, "REPLACE")
                vgroups["ScarfL2"].add([vi], t * 0.65, "REPLACE")
            else:
                t = clamp01((up - 0.58) / 0.42)
                vgroups["ScarfL1"].add([vi], 0.35 * (1.0 - t), "REPLACE")
                vgroups["ScarfL2"].add([vi], 0.65 + 0.35 * t, "REPLACE")
        elif tag == TAG_SCARF_R:
            if up < 0.12:
                t = up / 0.12
                vgroups["Chest"].add([vi], 1.0 - t, "REPLACE")
                vgroups["ScarfR1"].add([vi], t, "REPLACE")
            elif up < 0.58:
                t = (up - 0.12) / 0.46
                vgroups["ScarfR1"].add([vi], 1.0 - t * 0.65, "REPLACE")
                vgroups["ScarfR2"].add([vi], t * 0.65, "REPLACE")
            else:
                t = clamp01((up - 0.58) / 0.42)
                vgroups["ScarfR1"].add([vi], 0.35 * (1.0 - t), "REPLACE")
                vgroups["ScarfR2"].add([vi], 0.65 + 0.35 * t, "REPLACE")
        elif tag == TAG_GEAR_CH:
            vgroups["Chest"].add([vi], 1.0, "REPLACE")
        elif tag == TAG_SATCHEL:
            vgroups["Pelvis"].add([vi], 0.80, "REPLACE")
            vgroups["Spine1"].add([vi], 0.20, "REPLACE")
        elif tag == TAG_CUFF_L:
            vgroups["ForearmL"].add([vi], 1.0, "REPLACE")
        elif tag == TAG_CUFF_R:
            vgroups["ForearmR"].add([vi], 1.0, "REPLACE")
        elif tag == TAG_ANKLE_L:
            vgroups["AnkleL"].add([vi], 1.0, "REPLACE")
        elif tag == TAG_ANKLE_R:
            vgroups["AnkleR"].add([vi], 1.0, "REPLACE")
        elif tag == TAG_TAIL_FIN:
            _assign_chain_weights(vi, pt, ["Tail5", "Tail6", "Tail7"], sigma=0.085)
        elif tag == TAG_DORSAL:
            _assign_chain_weights(vi, pt, ["Spine1", "Spine2", "Pelvis", "Tail1", "Tail2", "Tail3", "Tail4", "Tail5", "Tail6"], sigma=0.070)
        elif tag == TAG_HEAD:
            w_jaw = 0.0
            if ty < 0.712 and tz > 0.065 and abs(tx) < 0.095:
                w_jaw = clamp01((0.712 - ty) / 0.048) * clamp01((tz - 0.065) / 0.065) * (1.0 - clamp01(abs(tx) / 0.095)) * 0.72
            w_smile = 0.0
            if 0.695 < ty < 0.768 and tz > 0.115 and abs(tx) < 0.125:
                ds = ((abs(tx) - 0.065) / 0.055) ** 2 + ((ty - 0.728) / 0.032) ** 2
                w_smile = math.exp(-ds * 1.1) * clamp01((tz - 0.115) / 0.055) * 0.48
            w_neck = clamp01((0.648 - ty) / 0.030) * 0.35 if ty < 0.648 else 0.0
            tot_sub = w_jaw + w_smile + w_neck
            if tot_sub > 0.85:
                sc = 0.85 / tot_sub
                w_jaw *= sc
                w_smile *= sc
                w_neck *= sc
                tot_sub = 0.85
            vgroups["Head"].add([vi], 1.0 - tot_sub, "REPLACE")
            if w_jaw > 0.01:
                vgroups["Jaw"].add([vi], w_jaw, "REPLACE")
            if w_smile > 0.01:
                vgroups["MouthSmile"].add([vi], w_smile, "REPLACE")
            if w_neck > 0.01:
                vgroups["Neck"].add([vi], w_neck, "REPLACE")
        elif tag == TAG_LIMB_ARML:
            _assign_chain_weights(vi, pt, ["Chest", "ClavicleL", "UpperArmL", "ForearmL", "HandL"], sigma=0.052)
        elif tag == TAG_LIMB_ARMR:
            _assign_chain_weights(vi, pt, ["Chest", "ClavicleR", "UpperArmR", "ForearmR", "HandR"], sigma=0.052)
        elif tag == TAG_LIMB_LEGL:
            _assign_chain_weights(vi, pt, ["Pelvis", "ThighL", "ShinL", "AnkleL", "FootL"], sigma=0.052)
        elif tag == TAG_LIMB_LEGR:
            _assign_chain_weights(vi, pt, ["Pelvis", "ThighR", "ShinR", "AnkleR", "FootR"], sigma=0.052)
        else:
            if tz < -0.075:
                _assign_chain_weights(vi, pt, ["Pelvis", "Tail1", "Tail2", "Tail3", "Tail4", "Tail5", "Tail6", "Tail7"], sigma=0.072)
            else:
                _assign_chain_weights(vi, pt, ["Pelvis", "Spine1", "Spine2", "Chest", "Neck", "Head"], sigma=0.062)

    bpy.ops.object.select_all(action="DESELECT")
    body_obj.select_set(True)
    bpy.context.view_layer.objects.active = body_obj
    bpy.ops.object.mode_set(mode="WEIGHT_PAINT")
    bpy.ops.object.vertex_group_limit_total(group_select_mode="ALL", limit=4)
    bpy.ops.object.vertex_group_normalize_all(group_select_mode="ALL", lock_active=False)
    bpy.ops.object.mode_set(mode="OBJECT")

    # ==========================================================================
    # 10. BAKE ALL 22 LIVELY PIXAR NLA CLIPS + EXACT ANALYTIC 2-BONE FOOT-IK!
    # ==========================================================================
    def _zero_pose():
        for pb in arm_obj.pose.bones:
            pb.location = (0.0, 0.0, 0.0)
            pb.rotation_euler = (0.0, 0.0, 0.0)
            pb.scale = (1.0, 1.0, 1.0)

    _zero_pose()
    bpy.context.view_layer.update()

    _leg_ik_bind = {}
    for _s in ("L", "R"):
        _pb_th = arm_obj.pose.bones[f"Thigh{_s}"]
        _pb_sh = arm_obj.pose.bones[f"Shin{_s}"]
        _pb_ak = arm_obj.pose.bones[f"Ankle{_s}"]
        _pb_ft = arm_obj.pose.bones[f"Foot{_s}"]
        _h0 = _pb_th.head.copy()
        _k0 = _pb_sh.head.copy()
        _a0 = _pb_ak.head.copy()
        _f0 = _pb_ft.head.copy()
        _l1 = (_k0 - _h0).length
        _l2 = (_a0 - _k0).length
        _u0 = (_a0 - _h0).normalized()
        _kv = _k0 - _h0
        _pole0 = (_kv - _u0 * _kv.dot(_u0)).normalized()
        _yth0 = (_k0 - _h0).normalized()
        _ysh0 = (_a0 - _k0).normalized()
        _n0 = _yth0.cross(_u0).normalized()
        _b0_th = Matrix((_n0, _yth0, _n0.cross(_yth0))).transposed()
        _b0_sh = Matrix((_n0, _ysh0, _n0.cross(_ysh0))).transposed()
        _leg_ik_bind[_s] = {
            "h0": _h0, "a0": _a0, "f0": _f0, "l1": _l1, "l2": _l2,
            "pole0": _pole0, "n0": _n0,
            "b0_th_inv": _b0_th.inverted(), "b0_sh_inv": _b0_sh.inverted(),
            "m_th0": _pb_th.matrix.to_3x3().copy(),
            "m_sh0": _pb_sh.matrix.to_3x3().copy(),
            "m_ak0": _pb_ak.matrix.to_3x3().copy(),
            "hip_in_pelvis": arm_obj.pose.bones["Pelvis"].bone.matrix_local.inverted() @ _h0,
            "r_rel_th": arm_obj.pose.bones["Pelvis"].bone.matrix_local.to_3x3().inverted() @ _pb_th.bone.matrix_local.to_3x3(),
            "r_rel_sh": _pb_th.bone.matrix_local.to_3x3().inverted() @ _pb_sh.bone.matrix_local.to_3x3(),
            "r_rel_ak": _pb_sh.bone.matrix_local.to_3x3().inverted() @ _pb_ak.bone.matrix_local.to_3x3(),
        }

    def _pin_feet_analytic_ik():
        bpy.context.view_layer.update()
        pb_pelvis = arm_obj.pose.bones["Pelvis"]
        m_pelvis = pb_pelvis.matrix
        m_pelvis_3 = m_pelvis.to_3x3()
        for s in ("L", "R"):
            bd = _leg_ik_bind[s]
            pb_th = arm_obj.pose.bones[f"Thigh{s}"]
            pb_sh = arm_obj.pose.bones[f"Shin{s}"]
            pb_ak = arm_obj.pose.bones[f"Ankle{s}"]
            pb_ft = arm_obj.pose.bones[f"Foot{s}"]

            h_cur = m_pelvis @ bd["hip_in_pelvis"]
            a_tgt = bd["a0"]
            ha = a_tgt - h_cur
            l1, l2 = bd["l1"], bd["l2"]
            raw_d = ha.length
            d = max(abs(l1 - l2) + 1e-5, min(l1 + l2 - 1e-5, raw_d))
            u_dir = ha / (raw_d if raw_d > 1e-7 else 1.0)

            p_dir = bd["pole0"] - u_dir * bd["pole0"].dot(u_dir)
            if p_dir.length_squared < 1e-8:
                p_dir = Vector((0.0, -1.0, 0.0)) - u_dir * u_dir.y * -1.0
            p_dir.normalize()

            cos_a = max(-1.0, min(1.0, (l1 * l1 + d * d - l2 * l2) / (2.0 * l1 * d)))
            sin_a = math.sqrt(max(0.0, 1.0 - cos_a * cos_a))
            k_pos = h_cur + u_dir * (l1 * cos_a) + p_dir * (l1 * sin_a)

            y_th = (k_pos - h_cur).normalized()
            y_sh = (a_tgt - k_pos).normalized()
            n_pl = y_th.cross(u_dir)
            n_pl = n_pl.normalized() if n_pl.length_squared > 1e-8 else bd["n0"]

            b1_th = Matrix((n_pl, y_th, n_pl.cross(y_th))).transposed()
            m_th_world = (b1_th @ bd["b0_th_inv"]) @ bd["m_th0"]
            m_th_basis = (m_pelvis_3 @ bd["r_rel_th"]).inverted() @ m_th_world
            pb_th.rotation_euler = m_th_basis.to_euler("XYZ")

            b1_sh = Matrix((n_pl, y_sh, n_pl.cross(y_sh))).transposed()
            m_sh_world = (b1_sh @ bd["b0_sh_inv"]) @ bd["m_sh0"]
            m_sh_basis = (m_th_world @ bd["r_rel_sh"]).inverted() @ m_sh_world
            pb_sh.rotation_euler = m_sh_basis.to_euler("XYZ")

            m_ak_basis = (m_sh_world @ bd["r_rel_ak"]).inverted() @ bd["m_ak0"]
            pb_ak.rotation_euler = m_ak_basis.to_euler("XYZ")
            pb_ft.rotation_euler = (0.0, 0.0, 0.0)

    def _set_rot(bname, rx=0.0, ry=0.0, rz=0.0):
        pb = arm_obj.pose.bones.get(bname)
        if pb:
            pb.rotation_euler = (float(rx), float(ry), float(rz))

    def _set_loc_t3(bname, dx=0.0, dy=0.0, dz=0.0):
        pb = arm_obj.pose.bones.get(bname)
        if pb:
            pb.location = (float(dx), float(dy), float(dz))

    def _set_world_delta_t3(bname, dx=0.0, dy=0.0, dz=0.0):
        pb = arm_obj.pose.bones.get(bname)
        if pb:
            pb.location = pb.bone.matrix_local.to_3x3().inverted() @ v3(dx, dy, dz)

    def _set_frills(top_flare, bot_flare=None, phase=0.0, amp=0.0):
        bf = top_flare * 0.72 if bot_flare is None else bot_flare
        w1 = math.cos(phase) * amp
        w2 = math.sin(phase) * amp * 1.25
        _set_rot("FrillL1", top_flare * 0.7 + w1, 0.0, 0.0)
        _set_rot("FrillL2", top_flare * 0.9 + w2, 0.0, 0.0)
        _set_rot("FrillBotL", bf + w1 * 0.8, 0.0, 0.0)
        _set_rot("FrillR1", top_flare * 0.7 + w1, 0.0, 0.0)
        _set_rot("FrillR2", top_flare * 0.9 + w2, 0.0, 0.0)
        _set_rot("FrillBotR", bf + w1 * 0.8, 0.0, 0.0)

    def _set_scarf(phase, lift=0.0, yaw_amp=0.12, pitch_amp=0.08):
        _set_rot("ScarfL1", lift + math.sin(phase) * pitch_amp, 0.0, math.cos(phase) * yaw_amp)
        _set_rot("ScarfL2", lift * 0.8 + math.sin(phase - 0.8) * pitch_amp * 1.4, 0.0, math.cos(phase - 0.8) * yaw_amp * 1.4)
        _set_rot("ScarfR1", lift + math.sin(phase + 0.6) * pitch_amp, 0.0, math.cos(phase + 0.6) * yaw_amp)
        _set_rot("ScarfR2", lift * 0.8 + math.sin(phase - 0.2) * pitch_amp * 1.4, 0.0, math.cos(phase - 0.2) * yaw_amp * 1.4)

    def _set_tail_wave(phase, amp_yaw, amp_pitch, base_lift=0.0, freq_step=0.60):
        for ti in range(1, 8):
            ang = phase - (ti - 1) * freq_step
            falloff = 0.74 + 0.08 * ti
            _set_rot(
                f"Tail{ti}",
                base_lift * (1.0 if ti <= 3 else -0.40) + math.cos(ang) * amp_pitch * falloff,
                0.0,
                math.sin(ang) * amp_yaw * falloff,
            )

    def _set_mood_face(mood):
        if mood == "happy":
            # Bright, wide-open, radiant sparkling Pixar eyes!
            _set_rot("EyelidL", -0.04, 0.0, 0.0)
            _set_rot("EyelidR", -0.04, 0.0, 0.0)
            _set_rot("LowerLidL", 0.04, 0.0, 0.0)
            _set_rot("LowerLidR", 0.04, 0.0, 0.0)
            _set_world_delta_t3("BrowL", 0.0, 0.005, 0.0)
            _set_world_delta_t3("BrowR", 0.0, 0.005, 0.0)
            _set_rot("BrowL", 0.0, 0.07, 0.0)
            _set_rot("BrowR", 0.0, -0.07, 0.0)
            _set_world_delta_t3("MouthSmile", 0.0, 0.005, 0.002)
        elif mood == "curious":
            _set_rot("EyelidL", -0.10, 0.0, 0.0)
            _set_rot("EyelidR", -0.05, 0.0, 0.0)
            _set_rot("LowerLidL", 0.00, 0.0, 0.0)
            _set_rot("LowerLidR", 0.00, 0.0, 0.0)
            _set_world_delta_t3("BrowL", 0.0, 0.016, 0.0)
            _set_world_delta_t3("BrowR", 0.0, -0.004, 0.0)
            _set_rot("BrowL", 0.0, 0.16, 0.0)
            _set_rot("BrowR", 0.0, 0.08, 0.0)
            _set_world_delta_t3("MouthSmile", 0.004, 0.006, 0.002)
        elif mood == "determined":
            _set_rot("EyelidL", 0.24, 0.0, 0.0)
            _set_rot("EyelidR", 0.24, 0.0, 0.0)
            _set_rot("LowerLidL", 0.22, 0.0, 0.0)
            _set_rot("LowerLidR", 0.22, 0.0, 0.0)
            _set_world_delta_t3("BrowL", 0.0, -0.010, 0.004)
            _set_world_delta_t3("BrowR", 0.0, -0.010, 0.004)
            _set_rot("BrowL", 0.0, -0.26, 0.0)
            _set_rot("BrowR", 0.0, 0.26, 0.0)
            _set_world_delta_t3("MouthSmile", 0.0, 0.003, 0.003)
        elif mood == "joyful":
            # Joyful `^ ^` smiling cheek-squint — keeps eyes warm, cute & unmistakable!
            _set_rot("EyelidL", 0.22, 0.0, 0.0)
            _set_rot("EyelidR", 0.22, 0.0, 0.0)
            _set_rot("LowerLidL", 0.56, 0.0, 0.0)
            _set_rot("LowerLidR", 0.56, 0.0, 0.0)
            _set_world_delta_t3("BrowL", 0.0, 0.018, 0.0)
            _set_world_delta_t3("BrowR", 0.0, 0.018, 0.0)
            _set_rot("BrowL", 0.0, 0.14, 0.0)
            _set_rot("BrowR", 0.0, -0.14, 0.0)
            _set_rot("Jaw", 0.18, 0.0, 0.0)
            _set_world_delta_t3("MouthSmile", 0.0, 0.010, 0.004)
        elif mood == "surprised":
            _set_rot("EyelidL", -0.24, 0.0, 0.0)
            _set_rot("EyelidR", -0.24, 0.0, 0.0)
            _set_rot("LowerLidL", -0.10, 0.0, 0.0)
            _set_rot("LowerLidR", -0.10, 0.0, 0.0)
            _set_world_delta_t3("BrowL", 0.0, 0.024, 0.0)
            _set_world_delta_t3("BrowR", 0.0, 0.024, 0.0)
            _set_rot("BrowL", 0.0, 0.20, 0.0)
            _set_rot("BrowR", 0.0, -0.20, 0.0)
            _set_rot("Jaw", 0.16, 0.0, 0.0)
            _set_world_delta_t3("MouthSmile", 0.0, -0.005, 0.0)
        elif mood == "hurt":
            _set_rot("EyelidL", 0.68, 0.0, 0.0)
            _set_rot("EyelidR", 0.68, 0.0, 0.0)
            _set_rot("LowerLidL", 0.56, 0.0, 0.0)
            _set_rot("LowerLidR", 0.56, 0.0, 0.0)
            _set_world_delta_t3("BrowL", 0.0, -0.014, 0.0)
            _set_world_delta_t3("BrowR", 0.0, -0.014, 0.0)
            _set_rot("BrowL", 0.0, -0.32, 0.0)
            _set_rot("BrowR", 0.0, 0.32, 0.0)
            _set_rot("Jaw", 0.12, 0.0, 0.0)
            _set_world_delta_t3("MouthSmile", 0.0, -0.008, 0.0)

    def _eval_clip_pose(clip_name, u):
        _zero_pose()
        p = u * 2.0 * math.pi
        sp, cp = math.sin(p), math.cos(p)
        c2 = math.cos(2.0 * p)

        if clip_name == "IdleBreathe":
            dy = -0.008 * (1.0 - cp)
            _set_world_delta_t3("Pelvis", 0.0, dy, 0.0)
            _set_rot("Pelvis", 0.0, 0.0, 0.0)
            _set_rot("Spine1", 0.022 - 0.024 * cp, 0.025 * sp, 0.015 * sp)
            _set_rot("Spine2", 0.020 - 0.026 * cp, 0.028 * sp, 0.015 * sp)
            _set_rot("Chest",  0.018 - 0.032 * cp, 0.030 * sp, 0.0)
            _set_rot("ClavicleL", 0.0, 0.0, 0.032 * cp)
            _set_rot("ClavicleR", 0.0, 0.0, -0.032 * cp)
            _set_rot("Neck", -0.030 + 0.022 * cp, 0.048 * sp, 0.020 * sp)
            _set_rot("Head",  0.015 + 0.024 * cp, 0.085 * sp, 0.048 * cp)
            _set_mood_face("happy")
            blink = max(0.0, math.sin((u - 0.72) / 0.10 * math.pi)) if 0.72 <= u <= 0.82 else 0.0
            if blink > 0.01:
                _set_rot("EyelidL", 0.92 * blink, 0.0, 0.0)
                _set_rot("EyelidR", 0.92 * blink, 0.0, 0.0)
            _set_frills(0.10, phase=p, amp=0.065)
            _set_scarf(p, lift=0.04, yaw_amp=0.14, pitch_amp=0.08)
            _set_rot("UpperArmL", 0.08 + 0.04 * sp, 0.0, -0.18 - 0.03 * cp)
            _set_rot("ForearmL",  0.34 + 0.04 * (1.0 - cp), 0.0, 0.0)
            _set_rot("UpperArmR", 0.10 - 0.04 * sp, 0.0,  0.20 + 0.03 * cp)
            _set_rot("ForearmR",  0.38 + 0.04 * (1.0 - cp), 0.0, 0.0)
            _set_tail_wave(p, amp_yaw=0.22, amp_pitch=0.06, base_lift=0.06)
            _pin_feet_analytic_ik()

        elif clip_name == "IdleCurious":
            # Adorable 22 deg puppy head-tilt + open outward friendly paw wave beside cheek!
            dy = -0.008 * (1.0 - cp)
            _set_world_delta_t3("Pelvis", 0.0, dy, 0.0)
            wave_env = math.sin(clamp01((u - 0.10) / 0.78) * math.pi)
            wave_osc = math.sin(u * 6.0 * math.pi) * wave_env
            _set_rot("Spine1", -0.02 * wave_env, -0.08 * wave_env, 0.05 * wave_env)
            _set_rot("Chest",  -0.04 * wave_env, -0.10 * wave_env, 0.07 * wave_env)
            _set_rot("Neck",   -0.04 * wave_env,  0.08 * wave_env, 0.12 * wave_env)
            _set_rot("Head",   -0.04 * wave_env,  0.14 * wave_env, 0.22 * wave_env)
            _set_mood_face("joyful" if 0.25 < u < 0.75 else "curious")
            _set_frills(0.28 * wave_env + 0.10, phase=p * 2.5, amp=0.11 * wave_env)
            _set_scarf(p * 1.5, lift=0.06, yaw_amp=0.16, pitch_amp=0.09)
            # Clear open outward-held paw wave beside cheek (ZERO chin overlap!)
            _set_rot("ClavicleR", 0.08 * wave_env, 0.0, -0.22 * wave_env)
            _set_rot("UpperArmR", 1.38 * wave_env, 0.0, 0.88 * wave_env + 0.22 * wave_osc)
            _set_rot("ForearmR",  0.42 * wave_env, 0.0, 0.28 * wave_osc)
            _set_rot("HandR",    -0.16 * wave_env, 0.0, 0.24 * wave_osc)
            _set_rot("UpperArmL", 0.12, 0.0, -0.24 - 0.08 * wave_env)
            _set_rot("ForearmL",  0.48, 0.0, 0.0)
            _set_tail_wave(p * 2.0, amp_yaw=0.30, amp_pitch=0.08, base_lift=0.12)
            _pin_feet_analytic_ik()

        elif clip_name == "EdgeTeeter":
            sway = math.sin(p)
            _set_world_delta_t3("Pelvis", 0.0, -0.012 + 0.008 * abs(sway), -0.020 * (0.5 + 0.5 * cp))
            _set_rot("Pelvis", -0.22 - 0.10 * sway, 0.0, 0.06 * sway)
            _set_rot("Spine1", -0.14 - 0.06 * sway, 0.0, -0.08 * sway)
            _set_rot("Chest",  -0.12, 0.0, -0.08 * sway)
            _set_rot("Neck",    0.16, 0.0, 0.0)
            _set_rot("Head",    0.34 + 0.08 * c2, 0.08 * sway, 0.06 * cp)
            _set_mood_face("surprised")
            _set_frills(0.45, phase=p * 3.0, amp=0.12)
            _set_scarf(p * 2.5, lift=0.35, yaw_amp=0.28, pitch_amp=0.18)
            _set_rot("UpperArmL", p * 2.0, 0.0, -0.88)
            _set_rot("ForearmL",  0.22, 0.0, 0.0)
            _set_rot("UpperArmR", p * 2.0 + math.pi, 0.0, 0.88)
            _set_rot("ForearmR",  0.22, 0.0, 0.0)
            _set_tail_wave(p * 2.5, amp_yaw=0.42, amp_pitch=0.18, base_lift=0.26)
            _pin_feet_analytic_ik()

        elif clip_name == "SpringSomersault":
            flip_u = clamp01((u - 0.04) / 0.78)
            flip_ease = flip_u * flip_u * (3.0 - 2.0 * flip_u)
            tuck = math.sin(clamp01(u / 0.82) * math.pi)
            open_end = clamp01((u - 0.72) / 0.28)
            _set_loc_t3("Pelvis", 0.0, 0.08 * tuck, 0.0)
            _set_rot("Pelvis", flip_ease * 2.0 * math.pi, 0.0, 0.0)
            _set_rot("Spine1", 0.34 * tuck - 0.14 * open_end, 0.0, 0.0)
            _set_rot("Chest",  0.34 * tuck - 0.16 * open_end, 0.0, 0.0)
            _set_rot("Head",   0.26 * tuck - 0.18 * open_end, 0.0, 0.0)
            _set_mood_face("joyful")
            _set_frills(0.54, phase=p * 2.0, amp=0.10)
            _set_scarf(p * 2.5, lift=0.58, yaw_amp=0.22, pitch_amp=0.24)
            _set_rot("UpperArmL", 0.75 * tuck + 1.45 * open_end, 0.0, -0.35 * tuck - 0.95 * open_end)
            _set_rot("ForearmL",  1.10 * tuck + 0.15 * open_end, 0.0, 0.0)
            _set_rot("UpperArmR", 0.75 * tuck + 1.45 * open_end, 0.0,  0.35 * tuck + 0.95 * open_end)
            _set_rot("ForearmR",  1.10 * tuck + 0.15 * open_end, 0.0, 0.0)
            for s in ("L", "R"):
                _set_rot(f"Thigh{s}", 1.15 * tuck - 0.22 * open_end, 0.0, (-0.18 if s == "L" else 0.18) * open_end)
                _set_rot(f"Shin{s}", -1.45 * tuck - 0.20 * open_end, 0.0, 0.0)
                _set_rot(f"Foot{s}", -0.25, 0.0, 0.0)
            _set_tail_wave(p * 2.0, amp_yaw=0.14, amp_pitch=0.26, base_lift=-0.25 * tuck + 0.22 * open_end)

        elif clip_name == "WetShake":
            shake_env = math.sin(clamp01(u / 0.78) * math.pi)
            end_grin = clamp01((u - 0.72) / 0.28)
            osc = math.sin(u * 10.0 * math.pi) * shake_env
            osc_lag = math.sin(u * 10.0 * math.pi - 0.7) * shake_env
            _set_world_delta_t3("Pelvis", 0.0, -0.022 * shake_env, 0.0)
            _set_rot("Pelvis", 0.14 * shake_env, 0.28 * osc, 0.12 * osc)
            _set_rot("Spine1", 0.10 * shake_env, 0.36 * osc, 0.16 * osc)
            _set_rot("Chest",  0.08 * shake_env, 0.44 * osc, 0.18 * osc)
            _set_rot("Neck",  -0.12 * shake_env, 0.42 * osc_lag, 0.22 * osc_lag)
            _set_rot("Head",  -0.10 * shake_env, 0.50 * osc_lag, 0.32 * osc_lag)
            _set_mood_face("joyful" if end_grin > 0.3 else "hurt")
            _set_frills(0.28 + 0.38 * shake_env, phase=u * 12.0 * math.pi, amp=0.35 * shake_env)
            _set_scarf(u * 10.0 * math.pi, lift=0.25 * shake_env, yaw_amp=0.55 * shake_env, pitch_amp=0.24 * shake_env)
            _set_rot("UpperArmL", 0.22 * shake_env, 0.0, -0.58 * shake_env - 0.16)
            _set_rot("ForearmL",  0.65 * shake_env + 0.30, 0.0, 0.0)
            _set_rot("UpperArmR", 0.22 * shake_env, 0.0,  0.58 * shake_env + 0.16)
            _set_rot("ForearmR",  0.65 * shake_env + 0.30, 0.0, 0.0)
            _set_tail_wave(u * 10.0 * math.pi, amp_yaw=0.52 * shake_env + 0.16, amp_pitch=0.10, base_lift=0.14)
            _pin_feet_analytic_ik()

        elif clip_name in ("Walk", "FluidRun", "StairClimb"):
            is_run, is_stair = (clip_name == "FluidRun"), (clip_name == "StairClimb")
            stride = 0.78 if is_run else (0.64 if is_stair else 0.46)
            lift = 0.64 if is_stair else (0.56 if is_run else 0.32)
            lean = 0.26 if is_run else (0.22 if is_stair else 0.10)
            bounce = 0.040 if is_run else (0.044 if is_stair else 0.022)
            _set_loc_t3("Pelvis", 0.014 * sp, abs(cp) * bounce - 0.018, 0.0)
            _set_rot("Pelvis", lean * 0.35, 0.18 * sp, 0.07 * cp)
            _set_rot("Spine1", lean * 0.35, -0.10 * sp, -0.04 * cp)
            _set_rot("Spine2", lean * 0.30, -0.10 * sp, 0.0)
            _set_rot("Chest",  lean * 0.25 + 0.02 * c2, -0.09 * sp, 0.0)
            _set_rot("Neck",  -lean * 0.45, 0.06 * sp, 0.0)
            _set_rot("Head",  -lean * 0.42 + (0.08 if is_stair else 0.0), 0.06 * sp, 0.03 * cp)
            _set_mood_face("determined" if is_run else "happy")
            _set_frills(-0.14 if is_run else 0.08, phase=p * 2.0, amp=0.06)
            _set_scarf(p, lift=(0.48 if is_run else 0.18), yaw_amp=(0.24 if is_run else 0.14), pitch_amp=0.14)
            l_up, r_up = max(0.0, cp), max(0.0, -cp)
            _set_rot("ThighL", sp * stride + l_up * lift * 0.55, 0.0, 0.0)
            _set_rot("ShinL", -l_up * lift * 1.35 - max(0.0, -sp) * 0.24, 0.0, 0.0)
            _set_rot("AnkleL", l_up * lift * 0.65 - sp * 0.20, 0.0, 0.0)
            _set_rot("FootL", -max(0.0, -sp) * 0.30 + l_up * 0.22, 0.0, 0.0)
            _set_rot("ThighR", -sp * stride + r_up * lift * 0.55, 0.0, 0.0)
            _set_rot("ShinR", -r_up * lift * 1.35 - max(0.0, sp) * 0.24, 0.0, 0.0)
            _set_rot("AnkleR", r_up * lift * 0.65 + sp * 0.20, 0.0, 0.0)
            _set_rot("FootR", -max(0.0, sp) * 0.30 + r_up * 0.22, 0.0, 0.0)
            arm_amp = 0.76 if is_run else (0.58 if is_stair else 0.42)
            _set_rot("UpperArmL", -sp * arm_amp, 0.0, -0.22)
            _set_rot("ForearmL",  0.58 + max(0.0, -sp) * 0.38, 0.0, 0.0)
            _set_rot("UpperArmR",  sp * arm_amp, 0.0,  0.22)
            _set_rot("ForearmR",  0.58 + max(0.0,  sp) * 0.38, 0.0, 0.0)
            _set_tail_wave(p, amp_yaw=(0.30 if is_run else 0.20), amp_pitch=0.08, base_lift=(0.14 if is_run else 0.08))

        elif clip_name == "JumpCoil":
            t = math.sin(u * math.pi * 0.5)
            _set_world_delta_t3("Pelvis", 0.0, -0.085 * t, -0.025 * t)
            _set_rot("Pelvis", 0.26 * t, 0.0, 0.0)
            _set_rot("Spine1", 0.18 * t, 0.0, 0.0)
            _set_rot("Chest",  0.14 * t, 0.0, 0.0)
            _set_rot("Head",  -0.32 * t, 0.0, 0.0)
            _set_mood_face("determined")
            _set_frills(0.28 * t)
            _set_scarf(u * 2.0, lift=0.22 * t)
            for s in ("L", "R"):
                sgn = -1.0 if s == "L" else 1.0
                _set_rot(f"UpperArm{s}", -0.56 * t, 0.0, sgn * 0.34 * t)
                _set_rot(f"Forearm{s}",   0.68 * t, 0.0, 0.0)
            _set_tail_wave(0.8 * t, amp_yaw=0.14, amp_pitch=0.12, base_lift=0.22 * t)
            _pin_feet_analytic_ik()

        elif clip_name == "AirRise":
            _set_world_delta_t3("Pelvis", 0.0, 0.0, 0.0)
            _set_rot("Pelvis", -0.10, 0.0, 0.0)
            _set_rot("Spine1", -0.06, 0.0, 0.0)
            _set_rot("Chest",  -0.08, 0.0, 0.0)
            _set_rot("Head",   -0.12 + 0.02 * cp, 0.0, 0.0)
            _set_mood_face("happy")
            _set_frills(0.24, phase=p, amp=0.05)
            _set_scarf(p, lift=-0.38, yaw_amp=0.16, pitch_amp=0.14)
            _set_rot("UpperArmL", 1.38, 0.0, -0.36)
            _set_rot("ForearmL",  0.34, 0.0, 0.0)
            _set_rot("UpperArmR", -0.38, 0.0, 0.34)
            _set_rot("ForearmR",  0.58, 0.0, 0.0)
            _set_rot("ThighL", 0.88, 0.0, 0.0)
            _set_rot("ShinL", -1.18, 0.0, 0.0)
            _set_rot("AnkleL", 0.36, 0.0, 0.0)
            _set_rot("ThighR", -0.42, 0.0, 0.0)
            _set_rot("ShinR",  -0.16, 0.0, 0.0)
            _set_rot("FootR",  -0.38, 0.0, 0.0)
            _set_tail_wave(p, amp_yaw=0.06, amp_pitch=0.06, base_lift=-0.22)

        elif clip_name == "FrillGlide":
            _set_loc_t3("Pelvis", 0.02 * sp, 0.02 * cp, 0.0)
            _set_rot("Pelvis", 0.44, 0.06 * sp, 0.08 * sp)
            _set_rot("Spine1", 0.14, 0.0, 0.0)
            _set_rot("Chest", -0.14, 0.0, 0.0)
            _set_rot("Neck",  -0.22, 0.0, 0.0)
            _set_rot("Head",  -0.24 + 0.04 * cp, 0.06 * sp, 0.0)
            _set_mood_face("joyful")
            _set_frills(0.66, phase=p * 2.0, amp=0.10)
            _set_scarf(p * 2.0, lift=0.58, yaw_amp=0.22, pitch_amp=0.16)
            _set_rot("UpperArmL", 0.24, 0.0, -1.16 + 0.06 * cp)
            _set_rot("ForearmL",  0.16, 0.0, -0.15)
            _set_rot("UpperArmR", 0.24, 0.0,  1.16 - 0.06 * cp)
            _set_rot("ForearmR",  0.16, 0.0,  0.15)
            for s in ("L", "R"):
                _set_rot(f"Thigh{s}", -0.34 + 0.05 * sp, 0.0, (-0.18 if s == "L" else 0.18))
                _set_rot(f"Shin{s}",  -0.28, 0.0, 0.0)
                _set_rot(f"Foot{s}",  -0.36, 0.0, 0.0)
            _set_tail_wave(p, amp_yaw=0.26, amp_pitch=0.08, base_lift=0.16)

        elif clip_name == "Fall":
            _set_world_delta_t3("Pelvis", 0.0, 0.0, 0.0)
            _set_rot("Pelvis", 0.10, 0.0, 0.0)
            _set_rot("Spine1", 0.08, 0.0, 0.0)
            _set_rot("Chest",  0.06, 0.0, 0.0)
            _set_rot("Neck",   0.08, 0.0, 0.0)
            _set_rot("Head",   0.18, 0.0, 0.0)
            _set_mood_face("happy")
            _set_frills(0.36, phase=p * 2.0, amp=0.08)
            _set_scarf(p * 2.0, lift=0.62, yaw_amp=0.22, pitch_amp=0.18)
            _set_rot("UpperArmL", 0.42 + 0.10 * sp, 0.0, -0.62)
            _set_rot("ForearmL",  0.46, 0.0, 0.0)
            _set_rot("UpperArmR", 0.42 - 0.10 * sp, 0.0,  0.62)
            _set_rot("ForearmR",  0.46, 0.0, 0.0)
            _set_rot("ThighL", 0.52 + 0.14 * sp, 0.0, 0.0)
            _set_rot("ShinL", -0.68 - 0.10 * sp, 0.0, 0.0)
            _set_rot("ThighR", 0.30 - 0.14 * sp, 0.0, 0.0)
            _set_rot("ShinR", -0.40 + 0.10 * sp, 0.0, 0.0)
            _set_tail_wave(p, amp_yaw=0.08, amp_pitch=0.08, base_lift=0.28)

        elif clip_name == "Land":
            env = math.sin(u * math.pi) * (1.0 - 0.40 * u)
            _set_world_delta_t3("Pelvis", 0.0, -0.095 * env, 0.0)
            _set_rot("Pelvis", 0.24 * env, 0.0, 0.0)
            _set_rot("Spine1", 0.20 * env, 0.0, 0.0)
            _set_rot("Chest",  0.14 * env, 0.0, 0.0)
            _set_rot("Head",  -0.24 * env, 0.0, 0.0)
            _set_mood_face("happy")
            _set_frills(-0.22 * env)
            _set_scarf(u * 4.0, lift=-0.24 * env, yaw_amp=0.18 * env)
            for s in ("L", "R"):
                sgn = -1.0 if s == "L" else 1.0
                _set_rot(f"UpperArm{s}", 0.34 * env, 0.0, sgn * 0.56 * env)
                _set_rot(f"Forearm{s}",  0.54 * env, 0.0, 0.0)
            _set_tail_wave(u * 4.0, amp_yaw=0.22 * env, amp_pitch=0.18 * env, base_lift=-0.16 * env)
            _pin_feet_analytic_ik()

        elif clip_name == "LedgeMantle":
            arc = math.sin(u * math.pi)
            _set_loc_t3("Pelvis", 0.0, -0.14 * (1.0 - u) + 0.06 * arc, 0.05 * arc)
            _set_rot("Pelvis", 0.36 * arc, 0.0, 0.0)
            _set_rot("Spine1", 0.26 * arc, 0.0, 0.0)
            _set_rot("Head",  -0.32 * arc, 0.0, 0.0)
            _set_mood_face("determined")
            _set_frills(0.28 * arc)
            _set_scarf(u * 4.0, lift=0.32 * arc)
            for s in ("L", "R"):
                sgn = -1.0 if s == "L" else 1.0
                _set_rot(f"UpperArm{s}", (1.15 - 1.35 * u) * arc, 0.0, sgn * 0.28)
                _set_rot(f"Forearm{s}",  0.72 * arc, 0.0, 0.0)
                _set_rot(f"Thigh{s}",    0.78 * arc, 0.0, 0.0)
                _set_rot(f"Shin{s}",    -1.05 * arc, 0.0, 0.0)
            _set_tail_wave(u * 5.0, amp_yaw=0.28, amp_pitch=0.14, base_lift=0.22 * arc)

        elif clip_name == "WallScamper":
            _set_loc_t3("Pelvis", 0.024 * sp, 0.02 * c2, 0.02)
            _set_rot("Pelvis", -0.16, 0.0, 0.16 * sp)
            _set_rot("Spine1", -0.10, 0.0, 0.18 * sp)
            _set_rot("Chest",  -0.08, 0.0, -0.16 * sp)
            _set_rot("Head",   -0.42, 0.12 * sp, 0.0)
            _set_mood_face("determined")
            _set_frills(0.18, phase=p, amp=0.06)
            _set_scarf(p, lift=-0.22, yaw_amp=0.18)
            _set_rot("UpperArmL", 1.25 + 0.48 * sp, 0.0, -0.48)
            _set_rot("ForearmL",  0.65 - 0.25 * sp, 0.0, 0.0)
            _set_rot("UpperArmR", 1.25 - 0.48 * sp, 0.0,  0.48)
            _set_rot("ForearmR",  0.65 + 0.25 * sp, 0.0, 0.0)
            _set_rot("ThighL",    0.58 - 0.45 * sp, 0.0, -0.35)
            _set_rot("ShinL",    -0.82 + 0.30 * sp, 0.0, 0.0)
            _set_rot("ThighR",    0.58 + 0.45 * sp, 0.0,  0.35)
            _set_rot("ShinR",    -0.82 - 0.30 * sp, 0.0, 0.0)
            _set_tail_wave(p, amp_yaw=0.38, amp_pitch=0.06, base_lift=-0.10)

        elif clip_name == "TailWhip":
            spin_u = clamp01((u - 0.08) / 0.80)
            spin_ease = spin_u * spin_u * (3.0 - 2.0 * spin_u)
            whip_arc = math.sin(u * math.pi)
            _set_loc_t3("Pelvis", 0.0, 0.07 * whip_arc - 0.03, 0.0)
            _set_rot("Pelvis", 0.24 * whip_arc, spin_ease * 2.0 * math.pi, 0.0)
            _set_rot("Spine1", 0.16 * whip_arc, 0.22 * math.sin(u * 2.0 * math.pi), 0.0)
            _set_rot("Chest",  0.12 * whip_arc, 0.18 * math.sin(u * 2.0 * math.pi), 0.0)
            _set_rot("Head",  -0.18 * whip_arc, -0.25 * math.sin(u * 2.0 * math.pi), 0.0)
            _set_mood_face("determined")
            _set_frills(0.58 * whip_arc)
            _set_scarf(u * 6.0, lift=0.52 * whip_arc, yaw_amp=0.55 * whip_arc)
            _set_rot("UpperArmL", 0.22, 0.0, -0.88 * whip_arc - 0.18)
            _set_rot("UpperArmR", 0.22, 0.0,  0.88 * whip_arc + 0.18)
            _set_rot("ThighL", 0.44 * whip_arc, 0.0, -0.22 * whip_arc)
            _set_rot("ShinL", -0.64 * whip_arc, 0.0, 0.0)
            _set_rot("ThighR", 0.24 * whip_arc, 0.0,  0.22 * whip_arc)
            for ti in range(1, 8):
                _set_rot(f"Tail{ti}", 0.08 * whip_arc, 0.0, -0.26 * whip_arc * (0.65 + 0.1 * ti))

        elif clip_name == "HydroCast":
            punch = math.sin(min(1.0, u * 1.45) * math.pi) if u < 0.69 else math.sin(((1.0 - u) / 0.31) * math.pi * 0.5) * 0.25
            _set_world_delta_t3("Pelvis", 0.0, -0.016 * punch, 0.0)
            _set_rot("Pelvis", 0.04 * punch, -0.08 * punch, 0.0)
            _set_rot("Spine1", 0.08 * punch,  0.22 * punch, 0.0)
            _set_rot("Spine2", 0.06 * punch,  0.18 * punch, 0.0)
            _set_rot("Chest",  0.08 * punch,  0.28 * punch, 0.0)
            _set_rot("Head",  -0.10 * punch, -0.30 * punch, 0.0)
            _set_mood_face("determined")
            _set_frills(0.46 * punch)
            _set_scarf(u * 4.0, lift=0.26 * punch, yaw_amp=0.22 * punch)
            _set_rot("ClavicleR", 0.18 * punch, 0.20 * punch, 0.0)
            _set_rot("UpperArmR", 1.32 * punch, 0.0, 0.16)
            _set_rot("ForearmR",  0.18 * (1.0 - punch), 0.0, 0.0)
            _set_rot("HandR",    -0.56 * punch, 0.0, 0.0)
            _set_rot("UpperArmL", -0.48 * punch, 0.0, -0.42 * punch - 0.16)
            _set_rot("ForearmL",  0.62, 0.0, 0.0)
            _set_tail_wave(u * 2.0 * math.pi, amp_yaw=0.20, amp_pitch=0.06, base_lift=0.14 * punch)
            _pin_feet_analytic_ik()

        elif clip_name == "FreeSwim":
            _set_loc_t3("Pelvis", 0.045 * sp, 0.03 * cp, 0.0)
            _set_rot("Pelvis", 1.04, 0.22 * sp, 0.12 * cp)
            _set_rot("Spine1", 0.08, -0.18 * cp, 0.0)
            _set_rot("Chest", -0.14, -0.14 * sp, 0.0)
            _set_rot("Neck",  -0.36,  0.12 * sp, 0.0)
            _set_rot("Head",  -0.38,  0.10 * cp, 0.0)
            _set_mood_face("happy")
            _set_frills(0.26, phase=p, amp=0.14)
            _set_scarf(p, lift=0.32, yaw_amp=0.30, pitch_amp=0.16)
            _set_rot("UpperArmL", -0.74 + 0.16 * sp, 0.0, -0.24)
            _set_rot("ForearmL",  0.26, 0.0, 0.0)
            _set_rot("UpperArmR", -0.74 - 0.16 * sp, 0.0,  0.24)
            _set_rot("ForearmR",  0.26, 0.0, 0.0)
            _set_rot("ThighL", -0.52 + 0.18 * sp, 0.0, -0.12)
            _set_rot("ShinL",  -0.22, 0.0, 0.0)
            _set_rot("FootL",  -0.50, 0.0, 0.0)
            _set_rot("ThighR", -0.52 - 0.18 * sp, 0.0,  0.12)
            _set_rot("ShinR",  -0.22, 0.0, 0.0)
            _set_rot("FootR",  -0.50, 0.0, 0.0)
            _set_tail_wave(p, amp_yaw=0.42, amp_pitch=0.06, base_lift=0.04, freq_step=0.72)

        elif clip_name == "RapidsSurf":
            _set_loc_t3("Pelvis", 0.03 * sp, -0.072 + 0.020 * c2, 0.0)
            _set_rot("Pelvis", 0.16, 0.50, 0.08 * sp)
            _set_rot("Spine1", 0.10, -0.16, -0.06 * sp)
            _set_rot("Chest",  0.08, -0.20, 0.0)
            _set_rot("Head",  -0.16, -0.12 + 0.06 * sp, 0.06 * sp)
            _set_mood_face("joyful")
            _set_frills(0.36, phase=p * 2.0, amp=0.10)
            _set_scarf(p * 2.0, lift=0.52, yaw_amp=0.30, pitch_amp=0.16)
            _set_rot("UpperArmL",  0.48 + 0.10 * sp, 0.0, -0.82)
            _set_rot("ForearmL",   0.34, 0.0, 0.0)
            _set_rot("UpperArmR", -0.34 - 0.10 * sp, 0.0,  0.76)
            _set_rot("ForearmR",   0.42, 0.0, 0.0)
            _set_rot("ThighL", 0.50 + 0.05 * c2, 0.0, -0.24)
            _set_rot("ShinL", -0.70 - 0.06 * c2, 0.0, 0.0)
            _set_rot("AnkleL", 0.20, 0.0, 0.0)
            _set_rot("ThighR", 0.36 + 0.05 * c2, 0.0,  0.24)
            _set_rot("ShinR", -0.56 - 0.06 * c2, 0.0, 0.0)
            _set_rot("AnkleR", 0.20, 0.0, 0.0)
            _set_tail_wave(p, amp_yaw=0.30, amp_pitch=0.06, base_lift=-0.08)

        elif clip_name == "CoreDive":
            _set_loc_t3("Pelvis", 0.02 * sp, 0.02 * cp, 0.0)
            _set_rot("Pelvis", 1.32, 0.10 * sp, 0.10 * cp)
            _set_rot("Spine1", 0.12, 0.0, 0.0)
            _set_rot("Chest", -0.12, 0.0, 0.0)
            _set_rot("Head",  -0.54, 0.08 * sp, 0.0)
            _set_mood_face("determined")
            _set_frills(-0.18, phase=p * 2.0, amp=0.08)
            _set_scarf(p * 3.0, lift=0.72, yaw_amp=0.28, pitch_amp=0.22)
            _set_rot("UpperArmL", -0.58, 0.0, -0.48 + 0.06 * sp)
            _set_rot("ForearmL",  0.32, 0.0, 0.0)
            _set_rot("UpperArmR", -0.58, 0.0,  0.48 - 0.06 * sp)
            _set_rot("ForearmR",  0.32, 0.0, 0.0)
            for s in ("L", "R"):
                _set_rot(f"Thigh{s}", -0.46, 0.0, (-0.15 if s == "L" else 0.15))
                _set_rot(f"Shin{s}",  -0.34, 0.0, 0.0)
                _set_rot(f"Foot{s}",  -0.44, 0.0, 0.0)
            _set_tail_wave(p, amp_yaw=0.26, amp_pitch=0.14, base_lift=0.08)

        elif clip_name == "Celebrate":
            hop = abs(sp)
            _set_loc_t3("Pelvis", 0.0, 0.13 * hop - 0.014, 0.0)
            _set_rot("Pelvis", -0.08 * hop, 0.28 * cp, 0.07 * sp)
            _set_rot("Chest",  -0.16, -0.12 * cp, 0.0)
            _set_rot("Head",   -0.16,  0.14 * cp, 0.10 * sp)
            _set_mood_face("joyful")
            _set_frills(0.60, phase=p * 2.0, amp=0.12)
            _set_scarf(p * 2.0, lift=0.45 * hop + 0.12, yaw_amp=0.28, pitch_amp=0.18)
            _set_rot("UpperArmL", 2.25 + 0.26 * sp, 0.0, -0.48)
            _set_rot("ForearmL",  0.32, 0.0, 0.0)
            _set_rot("UpperArmR", 2.25 - 0.26 * sp, 0.0,  0.48)
            _set_rot("ForearmR",  0.32, 0.0, 0.0)
            _set_rot("ThighL",  0.38 * hop, 0.0, -0.14)
            _set_rot("ShinL",  -0.58 * hop, 0.0, 0.0)
            _set_rot("ThighR", -0.14 * hop, 0.0,  0.14)
            _set_rot("ShinR",  -0.28 * hop, 0.0, 0.0)
            _set_tail_wave(p * 2.0, amp_yaw=0.34, amp_pitch=0.14, base_lift=0.16)

        elif clip_name == "CutsceneHero":
            _set_world_delta_t3("Pelvis", 0.0, -0.008 * (1.0 - cp), 0.0)
            _set_rot("Pelvis", -0.02, 0.10 * sp, 0.02 * cp)
            _set_rot("Spine1", -0.03, -0.05 * sp, 0.0)
            _set_rot("Chest",  -0.05, -0.06 * sp, 0.0)
            _set_rot("Neck",   -0.04,  0.10 * cp, 0.0)
            _set_rot("Head",   -0.03 + 0.03 * sp, 0.14 * cp, 0.06 * sp)
            _set_mood_face("happy")
            blink = max(0.0, math.sin((u - 0.45) / 0.08 * math.pi)) if 0.45 <= u <= 0.53 else 0.0
            if blink > 0.01:
                _set_rot("EyelidL", 0.92 * blink, 0.0, 0.0)
                _set_rot("EyelidR", 0.92 * blink, 0.0, 0.0)
            _set_frills(0.20, phase=p, amp=0.08)
            _set_scarf(p, lift=0.08, yaw_amp=0.15, pitch_amp=0.09)
            gesture = 0.5 + 0.5 * sp
            _set_rot("UpperArmR", 0.65 + 0.35 * gesture, -0.32, 0.36)
            _set_rot("ForearmR",  0.85 - 0.25 * gesture, 0.0, 0.0)
            _set_rot("UpperArmL", 0.18 * (1.0 - gesture), 0.0, -0.24 - 0.12 * gesture)
            _set_rot("ForearmL",  0.42, 0.0, 0.0)
            _set_tail_wave(p, amp_yaw=0.22, amp_pitch=0.06, base_lift=0.08)
            _pin_feet_analytic_ik()

    CLIP_SPECS = [
        ("IdleBreathe",      48, 1),
        ("Walk",             32, 2),
        ("FluidRun",         24, 2),
        ("StairClimb",       24, 2),
        ("JumpCoil",         12, 2),
        ("AirRise",          20, 2),
        ("FrillGlide",       32, 2),
        ("Fall",             24, 2),
        ("Land",             14, 2),
        ("LedgeMantle",      18, 2),
        ("WallScamper",      20, 2),
        ("TailWhip",         18, 1),
        ("HydroCast",        16, 1),
        ("FreeSwim",         32, 2),
        ("RapidsSurf",       28, 2),
        ("CoreDive",         24, 2),
        ("Celebrate",        40, 2),
        ("CutsceneHero",     60, 3),
        ("IdleCurious",      48, 2),
        ("EdgeTeeter",       32, 2),
        ("SpringSomersault", 24, 1),
        ("WetShake",         24, 1),
    ]

    arm_obj.animation_data_create()
    anim_bones = [pb.name for pb in arm_obj.pose.bones if pb.name != "Root"]
    loc_bones = {"Pelvis", "BrowL", "BrowR", "MouthSmile"}
    max_idle_foot_drift_mm = 0.0
    max_cast_foot_drift_mm = 0.0

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
            if clip_name in ("IdleBreathe", "HydroCast"):
                bpy.context.view_layer.update()
                for s_chk in ("L", "R"):
                    drift_mm = (arm_obj.pose.bones[f"Foot{s_chk}"].head - _leg_ik_bind[s_chk]["f0"]).length * 1000.0
                    if clip_name == "IdleBreathe":
                        max_idle_foot_drift_mm = max(max_idle_foot_drift_mm, drift_mm)
                    else:
                        max_cast_foot_drift_mm = max(max_cast_foot_drift_mm, drift_mm)
            for bname in anim_bones:
                pb = arm_obj.pose.bones[bname]
                pb.keyframe_insert(data_path="rotation_euler", frame=fr)
                if bname in loc_bones:
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

    # ==========================================================================
    # 11. EXPORT `assets/models/gateway.glb` (1K WEBP PBR, 50 Bones, 22 NLA Clips)
    # ==========================================================================
    bpy.ops.object.select_all(action="DESELECT")
    arm_obj.select_set(True)
    body_obj.select_set(True)
    bpy.context.view_layer.objects.active = arm_obj

    out_glb = os.path.join(OUT_MODELS_DIR, "gateway.glb")
    export_kwargs = dict(
        filepath=out_glb,
        export_format="GLB",
        use_selection=True,
        export_yup=True,
        export_apply=False,
        export_texcoords=True,
        export_normals=True,
        export_tangents=True,
        export_materials="EXPORT",
        export_image_format="WEBP",
        export_image_quality=86,
        export_skins=True,
        export_animations=True,
        export_animation_mode="NLA_TRACKS",
        export_nla_strips=True,
        export_rest_position_armature=True,
        export_force_sampling=True,
        export_frame_step=1,
        export_optimize_animation_size=True,
    )
    op_props = set(bpy.ops.export_scene.gltf.get_rna_type().properties.keys())
    safe_kwargs = {k: v for k, v in export_kwargs.items() if k in op_props}
    bpy.ops.export_scene.gltf(**safe_kwargs)

    size_bytes = os.path.getsize(out_glb)
    with open(out_glb, "rb") as f:
        f.read(12)
        chunk_len, _ = struct.unpack("<II", f.read(8))
        gltf = json.loads(f.read(chunk_len).decode("utf-8"))

    accessors = gltf.get("accessors", [])
    tris = sum(accessors[p["indices"]]["count"] // 3 for m in gltf.get("meshes", []) for p in m.get("primitives", []) if "indices" in p)
    pos_acc = next(accessors[p["attributes"]["POSITION"]] for m in gltf.get("meshes", []) for p in m.get("primitives", []))
    joint_names = [gltf["nodes"][j]["name"] for j in gltf["skins"][0]["joints"]]

    # ==========================================================================
    # 12. 6-PANEL STUDIO SHOWCASE & EXPRESSION SHEET RENDER
    # ==========================================================================
    if "--render-proof" in sys.argv:
        engines = [e.identifier for e in scene.render.bl_rna.properties["engine"].enum_items]
        scene.render.engine = "CYCLES" if "CYCLES" in engines else engines[0]
        if scene.render.engine == "CYCLES":
            scene.cycles.samples = 32
            scene.cycles.use_denoising = False

        world = bpy.data.worlds.new("GatewayV2StudioWorld")
        scene.world = world
        world.use_nodes = True
        bg = world.node_tree.nodes.get("Background")
        if bg:
            bg.inputs[0].default_value = (0.042, 0.088, 0.145, 1.0)
            bg.inputs[1].default_value = 0.90

        bpy.ops.mesh.primitive_cylinder_add(vertices=32, radius=0.42, depth=0.025, location=(0.0, 0.0, -0.0125))
        ped = bpy.context.active_object
        ped_mat = bpy.data.materials.new("PedestalMat")
        ped_mat.use_nodes = True
        ped_mat.node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value = (0.58, 0.44, 0.30, 1.0)
        ped_mat.node_tree.nodes["Principled BSDF"].inputs["Roughness"].default_value = 0.68
        ped.data.materials.append(ped_mat)

        def _add_light(name, energy, loc_t3, col, size=2.2):
            ld = bpy.data.lights.new(name=name, type="AREA")
            ld.energy, ld.size, ld.color = energy, size, col
            lo = bpy.data.objects.new(name, ld)
            lo.location = v3(*loc_t3)
            lo.rotation_euler = (v3(0.0, 0.56, 0.0) - lo.location).to_track_quat("-Z", "Y").to_euler()
            scene.collection.objects.link(lo)

        _add_light("KeyLight",  120.0, ( 1.6, 1.9,  2.1), (1.00, 0.97, 0.92))
        _add_light("FillLight",  64.0, (-1.9, 1.2,  1.8), (0.72, 0.94, 1.00))
        _add_light("RimLight",  130.0, (-1.1, 1.7, -2.0), (0.52, 0.96, 1.00))
        _add_light("EyeFill",    22.0, ( 0.0, 0.95, 1.3), (1.00, 0.98, 0.95), size=0.9)

        cam_data = bpy.data.cameras.new("ProofCam")
        cam_obj = bpy.data.objects.new("ProofCam", cam_data)
        scene.collection.objects.link(cam_obj)
        scene.camera = cam_obj

        for tr in arm_obj.animation_data.nla_tracks:
            tr.mute = True

        shots = [
            ("front3q",    ( 0.72, 0.64,  1.52), ( 0.00, 0.54, -0.02), 54.0, "IdleBreathe", 0.15, "happy"),
            ("side",       ( 1.72, 0.58, -0.18), ( 0.00, 0.50, -0.22), 50.0, "FluidRun",    0.20, "determined"),
            ("back3q",     (-0.96, 0.74, -1.48), ( 0.00, 0.52, -0.16), 52.0, "IdleBreathe", 0.10, "happy"),
            ("face_happy", ( 0.18, 0.82,  0.88), ( 0.00, 0.78,  0.04), 66.0, "IdleBreathe", 0.05, "happy"),
            ("face_wave",  ( 0.24, 0.80,  0.98), ( 0.00, 0.76,  0.02), 60.0, "IdleCurious", 0.50, "joyful"),
            ("face_teeter",(-0.22, 0.82,  0.96), ( 0.00, 0.74,  0.02), 62.0, "EdgeTeeter",  0.25, "surprised"),
        ]
        pw, ph = 512, 512
        scene.render.resolution_x = pw
        scene.render.resolution_y = ph
        panels = []
        for tag, c_pos, c_tgt, lens, clip_n, u_val, mood_ov in shots:
            _eval_clip_pose(clip_n, u_val)
            if mood_ov:
                _set_mood_face(mood_ov)
            bpy.context.view_layer.update()
            cam_data.lens = lens
            cam_obj.location = v3(*c_pos)
            cam_obj.rotation_euler = (v3(*c_tgt) - cam_obj.location).to_track_quat("-Z", "Y").to_euler()
            tmp_p = os.path.join(SCRATCH_DIR, f"gw2_panel_{tag}.png")
            scene.render.filepath = tmp_p
            bpy.ops.render.render(write_still=True)
            img_l = bpy.data.images.load(tmp_p)
            arr = np.empty(pw * ph * 4, dtype=np.float32)
            img_l.pixels.foreach_get(arr)
            panels.append(arr.reshape((ph, pw, 4)))

        row_bot = np.concatenate([panels[3], panels[4], panels[5]], axis=1)
        row_top = np.concatenate([panels[0], panels[1], panels[2]], axis=1)
        grid = np.concatenate([row_bot, row_top], axis=0)
        comp = bpy.data.images.new("GatewayV2Showcase", width=pw * 3, height=ph * 2, alpha=False)
        comp.pixels.foreach_set(grid.ravel())
        comp.filepath_raw = PROOF_SHEET_PATH
        comp.file_format = "PNG"
        comp.save()

    report = {
        "ok": True,
        "glb_path": out_glb,
        "proof_sheet": PROOF_SHEET_PATH if "--render-proof" in sys.argv else None,
        "size_bytes": size_bytes,
        "size_mb": round(size_bytes / (1024 * 1024), 3),
        "triangles": tris,
        "skin_count": len(gltf.get("skins", [])),
        "bone_count": len(joint_names),
        "joints": joint_names,
        "animation_count": len(gltf.get("animations", [])),
        "animations": [a.get("name", "") for a in gltf.get("animations", [])],
        "embedded_images": len(gltf.get("images", [])),
        "image_mimes": [im.get("mimeType", "") for im in gltf.get("images", [])],
        "bounds_min_yup": [round(x, 5) for x in pos_acc.get("min", [])],
        "bounds_max_yup": [round(x, 5) for x in pos_acc.get("max", [])],
        "max_idle_foot_drift_mm": round(max_idle_foot_drift_mm, 6),
        "max_cast_foot_drift_mm": round(max_cast_foot_drift_mm, 6),
    }
    with open(DONE_JSON_PATH, "w", encoding="utf-8") as f:
        json.dump(report, f, indent=2)
    print("GATEWAY_V2_BUILD_REPORT:", json.dumps(report))


if __name__ == "__main__":
    try:
        if "--textures-only" in sys.argv:
            paths = generate_gateway_v2_pbr_textures(out_size=1024)
            print(json.dumps({"textures_ok": True, "paths": paths}))
        else:
            run_blender_pipeline()
    except Exception:
        if "--textures-only" not in sys.argv:
            with open(DONE_JSON_PATH, "w", encoding="utf-8") as ef:
                json.dump({"ok": False, "error": traceback.format_exc()}, ef, indent=2)
        raise
