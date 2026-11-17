"""
TOWER TOPPLER '26 — Principal 3D Blender V2 Creature & Prop Pipeline
====================================================================
Generates all 10 mobile-optimized, subdiv-smoothed, PBR-material `.glb` 3D assets
in `assets/models/` plus V2 Weta/Pixar-grade Cycles 3D Studio Turnaround & Action
Renders of **Explorer Pogo** matching `media_1794856383556_f193848e.jpg`.

V2 Masterpiece Upgrades:
  1. Soulful Reference-Matched Amphibian Eyes (`256x256` radial iris shader):
     Large glossy obsidian pupil (~68% of visible eye) framed by a warm golden-lime
     to emerald striated iris rim, dark limbal ring, shaded upper-socket crease, and
     dual crisp corneal catchlights.
  2. `512x512` Mottled Amphibian Skin Albedo + Roughness + Dermal Bump + Cycles SSS:
     Continuous 3D anatomical projection eliminating any plastic look or hard-edged
     belly sticker — warm lime-olive snout/brows/shoulders, deeper forest-teal dorsal
     mottling & speckles, and a soft feathered cream-tan throat-to-belly gradient.
  3. Low Organic Gecko Cranial Ridge & Seamless OpenVDB-Fused Creature Anatomy:
     Subtle fleshy cranial ridge tapering naturally into the skull; matched spherical
     joint sockets in `pogo.glb` (`<= 2,500 tris`) plus continuous OpenVDB-fused +
     corrective-smoothed ZBrush-grade skin across neck/shoulders/elbows/hips/knees
     in the Cycles Studio Turnaround renders.
  4. Flat-Beveled Stitched Weathered Leather Harness & Compact Canvas Rucksack:
     Form-fitting ribbon-profile saddle-leather straps (`0.024 x 0.0045`) with tan
     edge stitching & aged brass sternum buckle, compact woven-canvas explorer pack,
     and damp mossy dark-indigo stone corbel pedestal.
  5. Clean `handR` Bind-Pose `blaster` Grip Alignment (`+Z` barrel, grip centered in
     `handR` palm) and unobstructed open-hand hero turnaround matching reference!
"""

import bpy
import bmesh
from mathutils import Vector, Matrix
import math
import json
import struct
import shutil
import traceback
import os

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_DIR = os.path.dirname(SCRIPT_DIR)
OUT_MODELS_DIR = os.path.join(PROJECT_DIR, "assets", "models")
COORD_ARTIFACT_DIR = r"C:\Users\mshaf\.gemini\antigravity\brain\b6a43bbe-38f9-4931-ad74-7734ee8536f4"
SELF_ARTIFACT_DIR = r"C:\Users\mshaf\.gemini\antigravity\brain\9234d737-b1c4-4e73-8045-f332f6815bc1"
LOG_PATH = os.path.join(OUT_MODELS_DIR, "_build_report.json")

os.makedirs(OUT_MODELS_DIR, exist_ok=True)


# ==============================================================================
# 1. COORDINATE BIJECTION (Three.js Y-Up <-> Blender Z-Up) & MATH HELPERS
# ==============================================================================

def v3(tx, ty, tz):
    """Map Three.js `(tx, ty, tz)` -> Blender `(tx, -tz, ty)` for exact glTF Y-up."""
    return Vector((float(tx), -float(tz), float(ty)))


def b2t(bvec):
    """Map Blender `(bx, by, bz)` -> Three.js `(tx, ty, tz)`."""
    return (bvec.x, bvec.z, -bvec.y)


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


def clamp01(x):
    return 0.0 if x <= 0.0 else (1.0 if x >= 1.0 else x)


def smoothstep(e0, e1, x):
    t = clamp01((x - e0) / (e1 - e0)) if abs(e1 - e0) > 1e-8 else 0.0
    return t * t * (3.0 - 2.0 * t)


def lerp(a, b, t):
    return a + (b - a) * t


def lerp3(c0, c1, t):
    return (lerp(c0[0], c1[0], t), lerp(c0[1], c1[1], t), lerp(c0[2], c1[2], t))


def srgb_to_lin(c):
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def hex_srgb(hex_str):
    h = hex_str.lstrip("#")
    return (int(h[0:2], 16) / 255.0, int(h[2:4], 16) / 255.0, int(h[4:6], 16) / 255.0)


def hex_lin(hex_str):
    r, g, b = hex_srgb(hex_str)
    return (srgb_to_lin(r), srgb_to_lin(g), srgb_to_lin(b))


def reset_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.unit_settings.system = "METRIC"
    scene.unit_settings.scale_length = 1.0
    return scene


# ==============================================================================
# 2. NEXT-GEN PROCEDURAL CREATURE & PROP TEXTURE GENERATORS (`512x512` / `256x256`)
# ==============================================================================

def _hash2(ix, iy):
    n = (ix * 374761393 + iy * 668265263) & 0xFFFFFFFF
    n = ((n ^ (n >> 13)) * 1274126177) & 0xFFFFFFFF
    return ((n ^ (n >> 16)) & 0xFFFF) / 65535.0


def _vnoise(x, y):
    ix, iy = int(math.floor(x)), int(math.floor(y))
    fx, fy = x - ix, y - iy
    ux = fx * fx * (3.0 - 2.0 * fx)
    uy = fy * fy * (3.0 - 2.0 * fy)
    a = _hash2(ix, iy)
    b = _hash2(ix + 1, iy)
    c = _hash2(ix, iy + 1)
    d = _hash2(ix + 1, iy + 1)
    return lerp(lerp(a, b, ux), lerp(c, d, ux), uy)


def _fbm(x, y):
    return 0.55 * _vnoise(x, y) + 0.30 * _vnoise(x * 2.03 + 7.1, y * 2.03 + 3.7) + 0.15 * _vnoise(x * 4.11 + 13.3, y * 4.11 + 9.2)


def create_pogo_mottled_skin_maps(size=512):
    """
    Explorer Pogo V3 — 512x512 Velvety Matte Amphibian Albedo + Roughness + Dermal Normal Maps!
    Matched 1:1 to `reference_pogo_closeup.png`:
      - `u` in [0..1]: `u = 0.5` is front centerline (+Z snout/throat/pot-belly);
        `u = 0.25 / 0.75` are lateral flanks; `u = 0.0 / 1.0` is dorsal spine (-Z) & limbs.
      - `v = clamp01(ty / 0.855)`:
        * `v = 0.23 .. 0.54` (front): Warm creamy-butter frog pot-belly (`#e6da9e..#cfc082`)
        * `v = 0.52 .. 0.66` (front/cheeks): Warm peachy rosy-tan jaw/lip/cheek blush (`#d6a37a`)
        * `v = 0.66 .. 1.00` (snout, turret cups, cocked brows, crown fin): Luminous velvety
          seafoam / mint-jade green (`#75d986..#90e89d`)
        * Back & limbs: Rich velvety mossy leaf-green (`#459753..#58ae64`) + subtle organic spots
        * Roughness: `0.58 .. 0.72` soft velvety matte-satin (ZERO dark oily vinyl shine!).
    """
    alb = bpy.data.images.new("PogoV2_Skin_Albedo", width=size, height=size, alpha=False)
    rgh = bpy.data.images.new("PogoV2_Skin_Roughness", width=size, height=size, alpha=False)
    nrm = bpy.data.images.new("PogoV2_Skin_Normal", width=size, height=size, alpha=False)
    rgh.colorspace_settings.name = "Non-Color"
    nrm.colorspace_settings.name = "Non-Color"

    apx = [0.0] * (size * size * 4)
    rpx = [0.0] * (size * size * 4)
    npx = [0.0] * (size * size * 4)
    hfield = [0.0] * (size * size)

    c_mint_crown = hex_srgb("#78d28c")      # Cooler pastel seafoam-jade crown fin, brows & snout bridge (`reference_pogo_closeup.png`!)
    c_mint_mid   = hex_srgb("#55aa6d")      # Cool sage-jade cheeks, limbs & upper flanks (zero neon lime!)
    c_moss_mid   = hex_srgb("#3d8252")      # Velvety forest-jade outer limbs & flanks
    c_moss_deep  = hex_srgb("#2c633e")      # Soft deep-moss dorsal shading
    c_speckle    = hex_srgb("#245233")      # Subtle organic amphibian mottling on back/limbs
    c_belly_warm = hex_srgb("#e6dca0")      # Warm creamy-butter round lower pot-belly core
    c_belly_edge = hex_srgb("#a8c27c")      # Smooth sage-pistachio belly/sternum transition
    c_throat_mid = hex_srgb("#88ad6c")      # Feathered under-chin / V-neck throat tone (kills horizontal collar line!)
    c_chin_ao    = hex_srgb("#4c6944")      # Soft natural under-chin & eye-cup crease ambient shadow
    c_rosy_jaw   = hex_srgb("#dbb38e")      # Soft warm peachy-tan / rosy-ochre lower jaw & cheek pigment
    c_rosy_lip   = hex_srgb("#ebd1b0")      # Lighter warm chamois-apricot lip highlight
    c_mouth_ao   = hex_srgb("#2c1c14")      # Crisp warm-umber mouth groove & teardrop nostril slit AO
    c_pad_warm   = hex_srgb("#82be7c")      # Soft seafoam-olive toe & finger pads

    for y in range(size):
        v = y / float(size - 1)
        for x in range(size):
            u = x / float(size - 1)
            du_signed = u - 0.5
            du_abs = abs(du_signed)
            front_dist = du_abs * 2.0  # 0.0 at +Z centerline, 1.0 at -Z spine

            m1 = _fbm(u * 10.0, v * 10.0)
            m2 = _vnoise(u * 26.0 + 4.2, v * 26.0 + 1.8)
            pebble = _vnoise(u * 84.0, v * 84.0)
            fine_pore = _vnoise(u * 158.0 + 2.1, v * 158.0 + 6.4)

            # 1. Cooler pastel seafoam-jade head/snout/crown + mossy forest-jade flanks
            head_mint_w = smoothstep(0.56, 0.72, v) * (1.0 - smoothstep(0.46, 0.96, front_dist) * 0.40)
            crown_peak_w = smoothstep(0.71, 0.92, v) * (1.0 - smoothstep(0.55, 1.0, front_dist) * 0.30)
            dorsal_w = smoothstep(0.40, 0.92, front_dist) * (1.0 - crown_peak_w * 0.40)

            col = lerp3(c_moss_mid, c_mint_mid, clamp01(0.38 + head_mint_w * 0.62 + (m1 - 0.48) * 0.24))
            col = lerp3(col, c_mint_crown, clamp01((head_mint_w * 0.58 + crown_peak_w * 0.66) * (0.76 + 0.24 * m1)))
            col = lerp3(col, c_moss_deep, clamp01(dorsal_w * (0.48 + 0.42 * m1)))

            # Subtle organic mossy spots on dorsal back & outer limbs
            speck_mask = smoothstep(0.66, 0.82, m2 * 0.65 + m1 * 0.35) * smoothstep(0.26, 0.54, front_dist)
            col = lerp3(col, c_speckle, speck_mask * 0.44)

            # Soft seafoam-olive lift on low toe pads (`v < 0.055`)
            pad_w = (1.0 - smoothstep(0.02, 0.065, v)) * 0.55
            col = lerp3(col, c_pad_warm, pad_w)

            # 2. Cute Pear Pot-Belly (`v = 0.20..0.46`) + Seamless Feathered V-Neck Throat (`v = 0.43..0.57`)
            noisy_dist = front_dist + (m1 - 0.5) * 0.075 + (m2 - 0.5) * 0.030
            v_pot = smoothstep(0.19, 0.26, v) * (1.0 - smoothstep(0.42, 0.52, v))
            pot_half_w = 0.42 * math.sin(clamp01((v - 0.18) / 0.34) * math.pi * 0.88 + 0.12)
            pot_edge = 1.0 - smoothstep(pot_half_w * 0.52, pot_half_w * 1.18, noisy_dist)
            pot_core = 1.0 - smoothstep(0.0, max(0.08, pot_half_w * 0.72), noisy_dist)
            belly_w = clamp01(v_pot * pot_edge)
            belly_col = lerp3(c_belly_edge, c_belly_warm, clamp01(pot_core * 0.94 + (m1 - 0.5) * 0.12))
            col = lerp3(col, belly_col, belly_w)

            # Feathered sternum-to-throat sage-cream bridge + soft under-chin shadow (`v = 0.42..0.57`)
            v_throat = smoothstep(0.41, 0.47, v) * (1.0 - smoothstep(0.53, 0.59, v))
            throat_w = v_throat * (1.0 - smoothstep(0.18, 0.46, noisy_dist))
            col = lerp3(col, c_throat_mid, clamp01(throat_w * 0.65))
            chin_shadow = smoothstep(0.49, 0.54, v) * (1.0 - smoothstep(0.55, 0.59, v)) * (1.0 - smoothstep(0.22, 0.52, noisy_dist))
            col = lerp3(col, c_chin_ao, clamp01(chin_shadow * 0.42))

            # 3. Soft Warm Peachy-Tan / Rosy-Ochre Lower Jaw, Chin & Lip Rim (`reference_pogo_closeup.png`!)
            v_mouth_curve = 0.641 + 0.033 * ((min(0.24, du_abs) / 0.20) ** 1.42)
            d_mouth = v - v_mouth_curve
            mouth_span = 1.0 - smoothstep(0.165, 0.230, du_abs)

            # Lower jaw & cheek pastel peachy-tan zone (`-0.076 <= d_mouth <= +0.015`)
            jaw_vert = smoothstep(-0.078, -0.042, d_mouth) * (1.0 - smoothstep(0.006, 0.022, d_mouth))
            jaw_w = clamp01(jaw_vert * mouth_span)
            freck = smoothstep(0.42, 0.78, m2 * 0.6 + m1 * 0.4)
            jaw_base = lerp3(c_rosy_lip, c_rosy_jaw, clamp01(0.35 + 0.45 * freck + 0.18 * smoothstep(0.04, 0.16, du_abs)))
            col = lerp3(col, jaw_base, jaw_w * 0.74)

            # Crisp warm-umber mouth groove AO right inside the smirk line (`abs(d_mouth) < 0.010`)
            groove_ao = (1.0 - smoothstep(0.0015, 0.0105, abs(d_mouth))) * (1.0 - smoothstep(0.180, 0.220, du_abs))
            col = lerp3(col, c_mouth_ao, groove_ao * 0.78)

            # 4. Two Crisp Angled Teardrop Nostril Slits on Clean Seafoam Snout Bridge (`u = 0.5 ± 0.0205, v = 0.696`)
            nostril_ao = 0.0
            for n_sign in (-1.0, 1.0):
                nu = (du_signed - n_sign * 0.0205) / 0.0090
                nv = (v - 0.696) / 0.0130
                ca_n, sa_n = 0.829, 0.559 * n_sign
                ru = nu * ca_n + nv * sa_n
                rv = -nu * sa_n + nv * ca_n
                taper = 0.55 + 0.55 * clamp01((rv + 1.0) * 0.5)
                nd2 = (ru / max(0.28, taper * 0.52)) ** 2 + (rv * 0.92) ** 2
                nostril_ao = max(nostril_ao, 1.0 - smoothstep(0.22, 1.05, nd2))
            col = lerp3(col, c_mouth_ao, nostril_ao * 0.88)

            micro_tint = 0.96 + 0.08 * pebble
            r = clamp01(col[0] * micro_tint)
            g = clamp01(col[1] * micro_tint)
            b = clamp01(col[2] * micro_tint)

            # Soft velvety matte-satin amphibian roughness (`0.58 .. 0.72` — zero plastic glare!)
            rough = lerp(0.60 + 0.08 * (1.0 - pebble), 0.68 + 0.04 * m2, clamp01(belly_w + jaw_w * 0.6))

            idx = (y * size + x) * 4
            apx[idx] = srgb_to_lin(r)
            apx[idx + 1] = srgb_to_lin(g)
            apx[idx + 2] = srgb_to_lin(b)
            apx[idx + 3] = 1.0

            rpx[idx] = rough
            rpx[idx + 1] = rough
            rpx[idx + 2] = rough
            rpx[idx + 3] = 1.0

            base_h = (pebble * 0.68 + fine_pore * 0.32) * (1.0 - belly_w * 0.42)
            lip_cushion = 0.22 * math.exp(-((abs(d_mouth) - 0.014) ** 2) / 0.00012) * mouth_span
            hfield[y * size + x] = base_h + lip_cushion - groove_ao * 0.75 - nostril_ao * 0.85

    strength = 1.85
    for y in range(size):
        ym = (y - 1) % size
        yp = (y + 1) % size
        for x in range(size):
            xm = (x - 1) % size
            xp = (x + 1) % size
            dx = (hfield[y * size + xp] - hfield[y * size + xm]) * strength
            dy = (hfield[yp * size + x] - hfield[ym * size + x]) * strength
            nx, ny = -dx, -dy
            nz = math.sqrt(max(0.15, 1.0 - min(0.82, nx * nx + ny * ny)))
            idx = (y * size + x) * 4
            npx[idx] = clamp01(0.5 + 0.5 * nx)
            npx[idx + 1] = clamp01(0.5 + 0.5 * ny)
            npx[idx + 2] = clamp01(0.5 + 0.5 * nz)
            npx[idx + 3] = 1.0

    alb.pixels = apx
    rgh.pixels = rpx
    nrm.pixels = npx
    alb.pack()
    rgh.pack()
    nrm.pack()
    return alb, rgh, nrm


def create_soulful_eye_albedo(size=256):
    """
    Explorer Pogo V3.5 — 256x256 Soulful Creamy-Sclera Pixar Turret Eye Albedo (`PogoV2_Eye_Albedo`):
    Matched 1:1 to `reference_pogo_closeup.png` (`v = deg / 180.0` from +Z pupil center):
      - `v = 0.000 .. 0.108` (`0..19.5 deg`, ~42% visible aperture): Soulful glossy dark-espresso pupil
      - `v = 0.108 .. 0.164` (`19.5..29.5 deg`): Warm dark-amber / burnt-sienna iris + crisp limbal rim
      - `v = 0.164 .. 0.620` (`29.5..111 deg`): Warm creamy-ivory sclera (`#f5eddc` -> `#ded1b4`)
        with soft natural socket-rim shading so the eyeball rounds richly into the chameleon eye-cup!
    """
    img = bpy.data.images.new("PogoV2_Eye_Albedo", width=size, height=size, alpha=False)
    px = [0.0] * (size * size * 4)

    c_pupil_core  = hex_srgb("#05060a")
    c_pupil_edge  = hex_srgb("#1b1008")
    c_amber_ring  = hex_srgb("#c27e30")
    c_hazel_iris  = hex_srgb("#6d451c")
    c_limbal      = hex_srgb("#1c120b")
    c_sclera_core = hex_srgb("#f6eee0")
    c_sclera_rim  = hex_srgb("#dfd2b6")
    c_sclera_deep = hex_srgb("#9c8d74")

    for y in range(size):
        v = y / float(size - 1)
        for x in range(size):
            u = x / float(size)
            ang = u * math.pi * 2.0
            fibers = 0.5 + 0.5 * math.sin(ang * 30.0 + math.sin(v * 32.0) * 0.40)
            flecks = _vnoise(u * 24.0, v * 24.0)

            if v < 0.108:
                t = smoothstep(0.072, 0.108, v)
                col = lerp3(c_pupil_core, c_pupil_edge, t)
            elif v < 0.164:
                t = (v - 0.108) / (0.164 - 0.108)
                base_iris = lerp3(c_amber_ring, c_hazel_iris, smoothstep(0.08, 0.82, t))
                fiber_mod = 0.86 + 0.28 * fibers * (1.0 - 0.22 * t) + 0.08 * (flecks - 0.5)
                col = (
                    clamp01(base_iris[0] * fiber_mod),
                    clamp01(base_iris[1] * fiber_mod),
                    clamp01(base_iris[2] * fiber_mod),
                )
                pupil_blend = 1.0 - smoothstep(0.108, 0.118, v)
                col = lerp3(col, c_pupil_edge, pupil_blend)
                limbal_blend = smoothstep(0.144, 0.164, v)
                col = lerp3(col, c_limbal, limbal_blend * 0.94)
            elif v < 0.178:
                t = smoothstep(0.164, 0.178, v)
                col = lerp3(c_limbal, c_sclera_core, t * 0.96)
            elif v < 0.460:
                rim_t = smoothstep(0.185, 0.460, v)
                subtle = (flecks - 0.5) * 0.016
                base_s = lerp3(c_sclera_core, c_sclera_rim, rim_t)
                col = (clamp01(base_s[0] + subtle), clamp01(base_s[1] + subtle), clamp01(base_s[2] + subtle))
            else:
                deep_t = smoothstep(0.460, 0.780, v)
                col = lerp3(c_sclera_rim, c_sclera_deep, deep_t)

            idx = (y * size + x) * 4
            px[idx] = srgb_to_lin(col[0])
            px[idx + 1] = srgb_to_lin(col[1])
            px[idx + 2] = srgb_to_lin(col[2])
            px[idx + 3] = 1.0

    img.pixels = px
    img.pack()
    return img


def create_vest_canvas_maps(size=512):
    """
    Explorer Pogo V3.5 — 512x512 Woven Sand/Khaki Chamois Vest Albedo & Normal Maps (`#ccb68c`):
      - Crisp woven linen/canvas warp-and-weft slub texture (ZERO flat plastic brown!)
      - Weathered light khaki-sand highlights (`#dfd0ae`) & soft fold shading (`#ab9368`)
      - Stitched dark-tan/brown seam border + folded welt relief along front lapels, collar & hem!
    """
    v_alb = bpy.data.images.new("PogoV35_Vest_Albedo", width=size, height=size, alpha=False)
    v_nrm = bpy.data.images.new("PogoV35_Vest_Normal", width=size, height=size, alpha=False)
    v_nrm.colorspace_settings.name = "Non-Color"

    apx = [0.0] * (size * size * 4)
    npx = [0.0] * (size * size * 4)
    hmap = [0.0] * (size * size)

    c_base  = hex_srgb("#ccb68c")
    c_light = hex_srgb("#dfd0ae")
    c_shade = hex_srgb("#a89066")
    c_hem   = hex_srgb("#987f56")
    c_stitch = hex_srgb("#5c3d22")
    c_thread_hi = hex_srgb("#efe3c4")

    for y in range(size):
        v = y / float(size - 1)
        for x in range(size):
            u = x / float(size - 1)
            m_fold = _fbm(u * 9.0 + 1.3, v * 9.0 + 2.7)
            m_fine = _vnoise(u * 34.0, v * 34.0)

            # Crisp criss-cross woven canvas warp & weft threads
            warp = 0.5 + 0.5 * math.sin(u * math.pi * 116.0 + (m_fine - 0.5) * 0.6)
            weft = 0.5 + 0.5 * math.sin(v * math.pi * 116.0 + (m_fold - 0.5) * 0.6)
            weave = 0.5 * warp + 0.5 * weft

            col = lerp3(c_shade, c_base, clamp01(0.28 + m_fold * 0.72))
            col = lerp3(col, c_light, clamp01((weave - 0.35) * 0.68 + (m_fine - 0.5) * 0.18))

            # Folded seam welt + dashed saddle-stitching around vest lapels, bottom hem & collar/shoulder edges!
            d_edge_u = min(u, 1.0 - u)
            d_edge_v = min(v, 1.0 - v)
            d_border = min(d_edge_u * 1.35, d_edge_v)

            welt = 1.0 - smoothstep(0.032, 0.058, d_border)
            seam_groove = (1.0 - smoothstep(0.004, 0.014, abs(d_border - 0.044)))
            col = lerp3(col, c_hem, welt * 0.28 + seam_groove * 0.52)

            # Dashed stitch marks running parallel to whichever border is closest
            along = (v * 64.0) if (d_edge_u * 1.35 < d_edge_v) else (u * 78.0)
            dash_phase = along - math.floor(along)
            is_dash = smoothstep(0.14, 0.24, dash_phase) * (1.0 - smoothstep(0.68, 0.78, dash_phase))
            stitch_band = 1.0 - smoothstep(0.004, 0.013, abs(d_border - 0.032))
            stitch_w = clamp01(is_dash * stitch_band)
            col = lerp3(col, c_stitch, stitch_w * 0.85)
            col = lerp3(col, c_thread_hi, clamp01(is_dash * (1.0 - smoothstep(0.002, 0.007, abs(d_border - 0.030)))) * 0.30)

            idx = (y * size + x) * 4
            apx[idx]     = srgb_to_lin(clamp01(col[0]))
            apx[idx + 1] = srgb_to_lin(clamp01(col[1]))
            apx[idx + 2] = srgb_to_lin(clamp01(col[2]))
            apx[idx + 3] = 1.0

            hmap[y * size + x] = (
                weave * 0.36
                + m_fold * 0.28
                + welt * 0.26
                - seam_groove * 0.42
                + stitch_w * 0.34
            )

    n_strength = 2.4
    for y in range(size):
        ym = max(0, y - 1)
        yp = min(size - 1, y + 1)
        for x in range(size):
            xm = max(0, x - 1)
            xp = min(size - 1, x + 1)
            dx = (hmap[y * size + xp] - hmap[y * size + xm]) * n_strength
            dy = (hmap[yp * size + x] - hmap[ym * size + x]) * n_strength
            nx, ny = -dx, -dy
            nz = math.sqrt(max(0.18, 1.0 - min(0.80, nx * nx + ny * ny)))
            idx = (y * size + x) * 4
            npx[idx]     = clamp01(0.5 + 0.5 * nx)
            npx[idx + 1] = clamp01(0.5 + 0.5 * ny)
            npx[idx + 2] = clamp01(0.5 + 0.5 * nz)
            npx[idx + 3] = 1.0

    v_alb.pixels = apx
    v_nrm.pixels = npx
    v_alb.pack()
    v_nrm.pack()
    return v_alb, v_nrm


def create_leather_and_canvas_maps(size=128):
    """Stitched espresso saddle-leather straps & warm weathered sand-canvas rucksack maps."""
    l_alb = bpy.data.images.new("PogoV2_Leather_Albedo", width=size, height=size, alpha=False)
    c_alb = bpy.data.images.new("PogoV2_Canvas_Albedo", width=size, height=size, alpha=False)
    lpx = [0.0] * (size * size * 4)
    cpx = [0.0] * (size * size * 4)

    c_l1 = hex_srgb("#382012")
    c_l2 = hex_srgb("#54321d")
    c_stitch = hex_srgb("#d2ad78")
    c_can1 = hex_srgb("#b8a074")
    c_can2 = hex_srgb("#d4be92")

    for y in range(size):
        v = y / float(size - 1)
        for x in range(size):
            u = x / float(size - 1)
            grain = _fbm(u * 18.0, v * 18.0)
            lcol = lerp3(c_l1, c_l2, grain)
            edge_d = min(abs(u - 0.12), abs(u - 0.88))
            dash = 1.0 if ((y // 5) % 2 == 0) else 0.0
            if edge_d < 0.028 and dash > 0.5:
                lcol = lerp3(lcol, c_stitch, 0.80)

            weave = 0.5 + 0.25 * math.sin(u * math.pi * 48.0) + 0.25 * math.sin(v * math.pi * 48.0)
            ccol = lerp3(c_can1, c_can2, clamp01(weave * 0.55 + grain * 0.45))

            idx = (y * size + x) * 4
            lpx[idx], lpx[idx + 1], lpx[idx + 2], lpx[idx + 3] = srgb_to_lin(lcol[0]), srgb_to_lin(lcol[1]), srgb_to_lin(lcol[2]), 1.0
            cpx[idx], cpx[idx + 1], cpx[idx + 2], cpx[idx + 3] = srgb_to_lin(ccol[0]), srgb_to_lin(ccol[1]), srgb_to_lin(ccol[2]), 1.0

    l_alb.pixels = lpx
    c_alb.pixels = cpx
    l_alb.pack()
    c_alb.pack()
    return l_alb, c_alb


def create_sclera_vein_maps(size=256):
    """
    Matte-wet warm bone-ivory sclera (`#eae4da` -> `#8e7678` rear vascularized socket)
    with branching dark-crimson/burgundy capillary veins matching `media_1794884512715_2296550d.jpg`.
    """
    alb = bpy.data.images.new("EyeballSclera_Albedo", width=size, height=size, alpha=False)
    nrm = bpy.data.images.new("EyeballSclera_Normal", width=size, height=size, alpha=False)
    nrm.colorspace_settings.name = "Non-Color"
    apx = [0.0] * (size * size * 4)
    npx = [0.0] * (size * size * 4)

    for y in range(size):
        v = y / float(size - 1)
        for x in range(size):
            u = x / float(size)
            ang = u * math.pi * 2.0
            n_warp = _fbm(u * 6.0, v * 6.0) * 0.85
            w1 = abs(math.sin(ang * 6.0 + n_warp * 2.2 + math.sin(v * 8.0) * 0.45))
            w2 = abs(math.sin(ang * 13.0 - n_warp * 2.8 - math.cos(v * 14.0) * 0.55))
            w3 = abs(math.sin(ang * 23.0 + n_warp * 3.4))
            vein1 = max(0.0, 1.0 - w1 * 8.5) * smoothstep(0.92, 0.18, v)
            vein2 = max(0.0, 1.0 - w2 * 12.5) * smoothstep(0.86, 0.22, v) * 0.72
            vein3 = max(0.0, 1.0 - w3 * 16.0) * smoothstep(0.78, 0.30, v) * 0.42
            vein = clamp01(vein1 + vein2 + vein3)
            rear_bruise = smoothstep(0.46, 0.04, v) * 0.62
            mottle = (_fbm(u * 10.0 + 3.1, v * 10.0 + 1.7) - 0.5) * 0.06

            # Warm bone-ivory base (`#ebe5dc`) + dark crimson veins (`#5c0f1e`) + bruised socket
            base_r = 0.91 + mottle
            base_g = 0.885 + mottle * 0.9
            base_b = 0.84 + mottle * 0.7
            r = base_r * (1.0 - vein * 0.48 - rear_bruise * 0.36) + 0.42 * vein
            g = base_g * (1.0 - vein * 0.86 - rear_bruise * 0.58) + 0.05 * vein
            b = base_b * (1.0 - vein * 0.80 - rear_bruise * 0.46) + 0.10 * vein

            idx = (y * size + x) * 4
            apx[idx] = srgb_to_lin(clamp01(r))
            apx[idx + 1] = srgb_to_lin(clamp01(g))
            apx[idx + 2] = srgb_to_lin(clamp01(b))
            apx[idx + 3] = 1.0

            nx = math.cos(ang * 6.0) * vein * 0.42
            ny = (vein - rear_bruise * 0.22) * 0.32
            nz = math.sqrt(max(0.2, 1.0 - nx * nx - ny * ny))
            npx[idx], npx[idx + 1], npx[idx + 2], npx[idx + 3] = 0.5 + 0.5 * nx, 0.5 + 0.5 * ny, 0.5 + 0.5 * nz, 1.0

    alb.pixels = apx
    nrm.pixels = npx
    alb.pack()
    nrm.pack()
    return alb, nrm


def create_eye_monster_iris_map(size=256):
    """
    Luminous striated turquoise-cyan-emerald iris (`#0e7490` limbal ring -> `#22ebff` radial fibers
    -> `#99ffff` inner sphincter ring) matching `media_1794884512715_2296550d.jpg`.
    """
    img = bpy.data.images.new("EyeballIris_Albedo", width=size, height=size, alpha=False)
    px = [0.0] * (size * size * 4)
    for y in range(size):
        dy = (y / float(size - 1)) * 2.0 - 1.0
        for x in range(size):
            dx = (x / float(size - 1)) * 2.0 - 1.0
            r = math.sqrt(dx * dx + dy * dy)
            ang = math.atan2(dy, dx)
            fibers = 0.5 + 0.32 * math.sin(ang * 38.0 + math.sin(r * 14.0) * 0.8) + 0.18 * math.cos(ang * 67.0 - r * 9.0)
            limbal = smoothstep(0.98, 0.74, r)
            inner_glow = smoothstep(0.68, 0.42, r) * smoothstep(0.24, 0.40, r)
            pupil_mask = smoothstep(0.30, 0.36, r)

            col = lerp3((0.04, 0.22, 0.30), (0.10, 0.82, 0.92), clamp01(fibers * limbal))
            col = lerp3(col, (0.58, 1.0, 0.96), inner_glow * 0.75)
            col = lerp3((0.01, 0.02, 0.04), col, pupil_mask)
            idx = (y * size + x) * 4
            px[idx], px[idx + 1], px[idx + 2], px[idx + 3] = srgb_to_lin(col[0]), srgb_to_lin(col[1]), srgb_to_lin(col[2]), 1.0
    img.pixels = px
    img.pack()
    return img


def create_stone_normal_img(size=256):
    """
    Seamless periodic chiseled rough-hewn slate normal map with hairline cracks & pitted relief.
    """
    img = bpy.data.images.new("CorbelStone_Normal", width=size, height=size, alpha=False)
    img.colorspace_settings.name = "Non-Color"
    px = [0.0] * (size * size * 4)
    hmap = [0.0] * (size * size)
    for y in range(size):
        v = y / float(size)
        for x in range(size):
            u = x / float(size)
            # Periodic multi-harmonic rough slate grain + hairline crack creases
            a1 = u * math.pi * 2.0
            b1 = v * math.pi * 2.0
            h = (
                0.42 * math.sin(a1 * 3.0 + 0.4) * math.cos(b1 * 2.0 - 0.3)
                + 0.28 * math.sin(a1 * 7.0 - b1 * 5.0)
                + 0.18 * math.cos(a1 * 13.0 + b1 * 11.0)
                + 0.12 * math.sin(a1 * 23.0 - b1 * 19.0)
            )
            crack = abs(math.sin(a1 * 2.0 + math.sin(b1 * 3.0) * 0.85))
            if crack < 0.045:
                h -= (1.0 - crack / 0.045) * 0.55
            hmap[y * size + x] = h

    for y in range(size):
        ym = (y - 1) % size
        yp = (y + 1) % size
        for x in range(size):
            xm = (x - 1) % size
            xp = (x + 1) % size
            dx = (hmap[y * size + xp] - hmap[y * size + xm]) * 0.85
            dy = (hmap[yp * size + x] - hmap[ym * size + x]) * 0.85
            nx, ny = -dx, -dy
            inv = 1.0 / math.sqrt(nx * nx + ny * ny + 1.0)
            idx = (y * size + x) * 4
            px[idx], px[idx + 1], px[idx + 2], px[idx + 3] = 0.5 + 0.5 * nx * inv, 0.5 + 0.5 * ny * inv, 0.5 + 0.5 * inv, 1.0
    img.pixels = px
    img.pack()
    return img


# ==============================================================================
# 3. PBR + SUBSURFACE SCATTERING MATERIAL FACTORY
# ==============================================================================

def make_mat(
    name,
    hex_color,
    roughness=0.45,
    metallic=0.0,
    coat=0.0,
    coat_rough=0.08,
    sss_weight=0.0,
    sss_scale=0.015,
    emission_hex=None,
    emission_strength=0.0,
    alpha=1.0,
    albedo_img=None,
    roughness_img=None,
    normal_img=None,
    normal_strength=0.55,
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

    if sss_weight > 0.0:
        if "Subsurface Weight" in bsdf.inputs:
            bsdf.inputs["Subsurface Weight"].default_value = sss_weight
        if "Subsurface Scale" in bsdf.inputs:
            bsdf.inputs["Subsurface Scale"].default_value = sss_scale
        if "Subsurface Radius" in bsdf.inputs:
            bsdf.inputs["Subsurface Radius"].default_value = (0.85, 1.05, 0.32)

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


# ==============================================================================
# 4. BMESH SCULPTING, ANATOMICAL UV PROJECTION & SUBDIV HELPERS
# ==============================================================================

def assign_spherical_uvs(bm, scale=1.0):
    uv_layer = bm.loops.layers.uv.verify()
    center = Vector((0.0, 0.0, 0.0))
    if bm.verts:
        center = sum((v.co for v in bm.verts), Vector()) / len(bm.verts)
    for f in bm.faces:
        for loop in f.loops:
            d = loop.vert.co - center
            r = d.length
            if r < 1e-6:
                u, v = 0.5, 0.5
            else:
                u = 0.5 + math.atan2(d.x, -d.y) / (2.0 * math.pi)
                v = 0.5 + math.asin(clamp01((d.z / r) * 0.5 + 0.5) * 2.0 - 1.0) / math.pi
            loop[uv_layer].uv = (u * scale, v * scale)


def project_anatomical_skin_uvs(obj, is_limb=False):
    """
    Projects continuous 3D body-space cylindrical UVs `(u, v)` onto `obj` so the
    `512x512` mottled amphibian skin + soft belly gradient wraps with ZERO seams!
    """
    mesh = obj.data
    if not mesh.uv_layers:
        mesh.uv_layers.new(name="UVMap")
    uv_data = mesh.uv_layers.active.data
    mw = obj.matrix_world

    for poly in mesh.polygons:
        c_world = mw @ poly.center
        ctx, cty, ctz = b2t(c_world)
        poly_u = 0.5 + math.atan2(ctx, ctz) / (2.0 * math.pi)

        for loop_idx in poly.loop_indices:
            v_idx = mesh.loops[loop_idx].vertex_index
            wco = mw @ mesh.vertices[v_idx].co
            tx, ty, tz = b2t(wco)

            if is_limb:
                cx_limb = -0.092 if tx < 0 else 0.092
                limb_ang = math.atan2(tx - cx_limb, tz) / math.pi
                u = (0.12 + 0.08 * limb_ang) if tx < 0 else (0.88 + 0.08 * limb_ang)
            else:
                u = 0.5 + math.atan2(tx, max(tz, -0.25) if abs(tz) < 1e-5 else tz) / (2.0 * math.pi)
                if u - poly_u > 0.5:
                    u -= 1.0
                elif poly_u - u > 0.5:
                    u += 1.0

            v = clamp01(ty / 0.831)
            uv_data[loop_idx].uv = (clamp01(u), v)


def finalize_mesh_obj(
    name,
    bm,
    materials,
    pos=(0.0, 0.0, 0.0),
    rot=(0.0, 0.0, 0.0),
    parent=None,
    subdiv_levels=0,
    decimate_ratio=1.0,
    smooth=True,
    uv_scale=1.0,
    keep_custom_uvs=False,
):
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    if not keep_custom_uvs:
        assign_spherical_uvs(bm, scale=uv_scale)

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

    if subdiv_levels > 0:
        mod = obj.modifiers.new(name="Subdiv", type="SUBSURF")
        mod.levels = subdiv_levels
        mod.render_levels = subdiv_levels
        mod.uv_smooth = "PRESERVE_BOUNDARIES"
        bpy.context.view_layer.objects.active = obj
        bpy.ops.object.modifier_apply(modifier=mod.name)

    if decimate_ratio < 0.999:
        apply_decimate(obj, decimate_ratio, smooth=smooth)
    else:
        for poly in obj.data.polygons:
            poly.use_smooth = smooth

    return obj


def apply_decimate(obj, ratio, smooth=True):
    if obj.type != "MESH" or ratio >= 0.999 or len(obj.data.polygons) < 20:
        return
    mod = obj.modifiers.new(name="MobileOpt", type="DECIMATE")
    mod.decimate_type = "COLLAPSE"
    mod.ratio = ratio
    mod.use_collapse_triangulate = False
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.modifier_apply(modifier=mod.name)
    for poly in obj.data.polygons:
        poly.use_smooth = smooth


def make_empty_node(name, pos=(0.0, 0.0, 0.0), rot=(0.0, 0.0, 0.0), parent=None):
    obj = bpy.data.objects.new(name, None)
    obj.empty_display_size = 0.05
    obj.location = v3(*pos)
    obj.rotation_euler = rot3(*rot)
    if parent is not None:
        obj.parent = parent
    bpy.context.collection.objects.link(obj)
    return obj


def add_loft_rings(bm, rings_t3, closed=True, cap_start=True, cap_end=True, mat_idx=0):
    v_rings = [[bm.verts.new(v3(*p)) for p in ring] for ring in rings_t3]
    created_faces = []
    for i in range(len(v_rings) - 1):
        r0, r1 = v_rings[i], v_rings[i + 1]
        n = len(r0)
        limit = n if closed else (n - 1)
        m_idx = mat_idx[i] if isinstance(mat_idx, (list, tuple)) else mat_idx
        for j in range(limit):
            jn = (j + 1) % n
            try:
                f = bm.faces.new([r0[j], r0[jn], r1[jn], r1[j]])
                f.material_index = m_idx
                created_faces.append(f)
            except ValueError:
                pass

    if closed and len(v_rings[0]) >= 3:
        m_start = mat_idx[0] if isinstance(mat_idx, (list, tuple)) else mat_idx
        m_end = mat_idx[-1] if isinstance(mat_idx, (list, tuple)) else mat_idx
        if cap_start:
            c0 = sum((v.co for v in v_rings[0]), Vector()) / len(v_rings[0])
            vc0 = bm.verts.new(c0)
            r0 = v_rings[0]
            n = len(r0)
            for j in range(n):
                jn = (j + 1) % n
                try:
                    f = bm.faces.new([vc0, r0[jn], r0[j]])
                    f.material_index = m_start
                    created_faces.append(f)
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
                    f.material_index = m_end
                    created_faces.append(f)
                except ValueError:
                    pass
    return created_faces


def add_swept_curve(bm, pts_t3, radii, segs=10, up_t3=(0.0, 1.0, 0.0), cap_start=True, cap_end=True, mat_idx=0):
    pts = [Vector(p) for p in pts_t3]
    cnt = len(pts)
    if cnt < 2:
        return []

    r_list = []
    is_per_station = (
        isinstance(radii, (list, tuple))
        and len(radii) == cnt
        and (not isinstance(radii[0], (int, float)) or cnt != 2 or isinstance(radii, list))
    )
    for i in range(cnt):
        ri = radii[i] if is_per_station else radii
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
            a = (2.0 * math.pi * s) / segs
            pt = pts[i] + binrm * (math.cos(a) * rx) + nrm * (math.sin(a) * ry)
            ring.append((pt.x, pt.y, pt.z))
        rings.append(ring)

    return add_loft_rings(bm, rings, closed=True, cap_start=cap_start, cap_end=cap_end, mat_idx=mat_idx)


def add_flat_surface_strap(bm, pts_t3, normals_t3, width=0.024, thickness=0.0045, mat_idx=0):
    """
    Sculpts a true flat-cross-section, beveled saddle-leather ribbon strap hugging
    an organic surface along `normals_t3` with clean edge UVs for saddle-stitching!
    """
    uv_layer = bm.loops.layers.uv.verify()
    pts = [Vector(p) for p in pts_t3]
    nrms = [Vector(n).normalized() for n in normals_t3]
    cnt = len(pts)

    # 6-point beveled ribbon cross-section: (u_width_frac, v_thick_frac, strap_u_uv)
    profile = [
        (-0.50, 0.00, 0.02),
        (-0.44, 0.85, 0.12),
        (0.44,  0.85, 0.88),
        (0.50,  0.00, 0.98),
        (0.44, -0.45, 0.88),
        (-0.44, -0.45, 0.12),
    ]

    v_rings = []
    for i in range(cnt):
        t = (pts[1] - pts[0]) if i == 0 else ((pts[-1] - pts[-2]) if i == cnt - 1 else (pts[i + 1] - pts[i - 1]))
        t.normalize()
        n = nrms[i]
        side = t.cross(n).normalized()
        n_ortho = side.cross(t).normalized()
        ring = []
        for uw, vt, _ in profile:
            p = pts[i] + side * (uw * width) + n_ortho * (vt * thickness)
            ring.append(bm.verts.new(v3(p.x, p.y, p.z)))
        v_rings.append(ring)

    for i in range(cnt - 1):
        r0, r1 = v_rings[i], v_rings[i + 1]
        v0_uv = i / float(max(1, cnt - 1)) * 3.0
        v1_uv = (i + 1) / float(max(1, cnt - 1)) * 3.0
        for j in range(6):
            jn = (j + 1) % 6
            try:
                f = bm.faces.new([r0[j], r0[jn], r1[jn], r1[j]])
                f.material_index = mat_idx
                u_a, u_b = profile[j][2], profile[jn][2]
                f.loops[0][uv_layer].uv = (u_a, v0_uv)
                f.loops[1][uv_layer].uv = (u_b, v0_uv)
                f.loops[2][uv_layer].uv = (u_b, v1_uv)
                f.loops[3][uv_layer].uv = (u_a, v1_uv)
            except ValueError:
                pass


def add_ellipsoid(bm, center_t3, radii_t3, u_segs=14, v_segs=10, mat_idx=0, hemi_top_only=False):
    cx, cy, cz = center_t3
    rx, ry, rz = radii_t3
    rings = []
    v_start = 0 if hemi_top_only else 1
    v_count = max(2, v_segs // 2) if hemi_top_only else (v_segs - 1)
    for iv in range(v_start, v_start + v_count):
        phi = (iv / float(max(1, v_count - 1))) * (math.pi * 0.48) if hemi_top_only else (-math.pi * 0.5 + (iv / float(v_segs)) * math.pi)
        cphi, sphi = math.cos(phi), math.sin(phi)
        ring = [(cx + rx * cphi * math.cos((2.0 * math.pi * iu) / u_segs), cy + ry * sphi, cz + rz * cphi * math.sin((2.0 * math.pi * iu) / u_segs)) for iu in range(u_segs)]
        rings.append(ring)
    return add_loft_rings(bm, rings, closed=True, cap_start=not hemi_top_only, cap_end=True, mat_idx=mat_idx)


def add_soulful_amphibian_eyeball(bm, rx=0.068, ry=0.070, rz=0.066, u_segs=26):
    """
    Explorer Pogo V3.5 — Soulful Creamy-Sclera Pixar Turret Eye (`reference_pogo_closeup.png` 1:1!):
      - Warmer, larger ~42% dark-espresso/obsidian pupil (`0..19.5 deg` from +Z, `mat_idx=2` -> `mat_pupil`)
      - Warm dark-amber / burnt-sienna striated iris rim (`19.5..29.5 deg`, `mat_idx=1` -> `mat_eye`)
      - Warm creamy-ivory sclera (`29.5..165 deg`, `mat_idx=0` -> `mat_shade_sclera`)
      - Polar UVs `(u = angle, v = deg / 180.0)` mapped cleanly onto `PogoV2_Eye_Albedo`!
      - Dual crisp white corneal catchlights (`mat_idx=3` -> `mat_white`)!
    """
    uv_layer = bm.loops.layers.uv.verify()
    thetas_deg = [165, 128, 92, 60, 39, 29.5, 24.5, 19.5, 12.0, 4.0]
    v_rings = []
    v_uvs = []
    for deg in thetas_deg:
        th = math.radians(deg)
        z = rz * math.cos(th)
        sr = math.sin(th)
        cornea = 0.0026 * math.cos((deg / 30.0) * math.pi * 0.5) if deg <= 30.0 else 0.0
        ring = []
        for iu in range(u_segs):
            a = (2.0 * math.pi * iu) / u_segs
            ring.append(bm.verts.new(v3(rx * sr * math.cos(a), ry * sr * math.sin(a), z + cornea)))
        v_rings.append(ring)
        v_uvs.append(deg / 180.0)

    # Strip materials for WebGL `src/pogo.js` (`0` = creamy sclera, `1` = warm amber iris, `2` = ~42% soulful pupil):
    strip_mats = [0, 0, 0, 0, 0, 1, 1, 2, 2]
    for i in range(len(v_rings) - 1):
        r0, r1 = v_rings[i], v_rings[i + 1]
        vv0, vv1 = v_uvs[i], v_uvs[i + 1]
        for j in range(u_segs):
            jn = (j + 1) % u_segs
            f = bm.faces.new([r0[j], r0[jn], r1[jn], r1[j]])
            f.material_index = strip_mats[i]
            u0, u1 = j / float(u_segs), (j + 1) / float(u_segs)
            f.loops[0][uv_layer].uv = (u0, vv0)
            f.loops[1][uv_layer].uv = (u1, vv0)
            f.loops[2][uv_layer].uv = (u1, vv1)
            f.loops[3][uv_layer].uv = (u0, vv1)

    # Rear cap (`mat_idx = 0`) & front pupil center cap (`mat_idx = 2`)
    vc0 = bm.verts.new(v3(0.0, 0.0, -rz))
    for j in range(u_segs):
        jn = (j + 1) % u_segs
        f = bm.faces.new([vc0, v_rings[0][jn], v_rings[0][j]])
        f.material_index = 0
        for lp in f.loops:
            lp[uv_layer].uv = (0.5, 0.98)

    vc1 = bm.verts.new(v3(0.0, 0.0, rz + 0.0031))
    for j in range(u_segs):
        jn = (j + 1) % u_segs
        f = bm.faces.new([vc1, v_rings[-1][j], v_rings[-1][jn]])
        f.material_index = 2
        for lp in f.loops:
            lp[uv_layer].uv = (0.5, 0.01)

    # Dual crisp flush corneal catchlights (`mat_idx = 3` -> `mat_white`, zero side-view protrusion!)
    c1_faces = add_ellipsoid(bm, (-0.012, 0.016, rz + 0.0026), (0.0090, 0.0100, 0.0007), u_segs=10, v_segs=6, mat_idx=3)
    c2_faces = add_ellipsoid(bm, (0.014, -0.012, rz + 0.0024), (0.0042, 0.0042, 0.0006), u_segs=8, v_segs=4, mat_idx=3)
    for f in c1_faces + c2_faces:
        for lp in f.loops:
            lp[uv_layer].uv = (0.5, 0.5)


def add_spherical_cap(bm, radius, phi_max=1.64, u_segs=18, v_segs=6, pitch_offset=-0.25, mat_idx=0):
    rings = []
    cp, sp = math.cos(pitch_offset), math.sin(pitch_offset)
    for iv in range(1, v_segs + 1):
        theta = (iv / float(v_segs)) * phi_max
        y0 = radius * math.cos(theta)
        r_ring = radius * math.sin(theta)
        ring = [(r_ring * math.cos((2.0 * math.pi * iu) / u_segs), y0 * cp - r_ring * math.sin((2.0 * math.pi * iu) / u_segs) * sp, y0 * sp + r_ring * math.sin((2.0 * math.pi * iu) / u_segs) * cp) for iu in range(u_segs)]
        rings.append(ring)
    return add_loft_rings(bm, rings, closed=True, cap_start=True, cap_end=False, mat_idx=mat_idx)


def add_bevel_box(bm, center_t3, size_t3, bevel=0.015, segs=1, rot_t3=(0.0, 0.0, 0.0), mat_idx=0):
    tb = bmesh.new()
    bmesh.ops.create_cube(tb, size=1.0)
    sx, sy, sz = size_t3
    bmesh.ops.scale(tb, vec=(sx, sz, sy), verts=tb.verts)
    if bevel > 0.0:
        bmesh.ops.bevel(tb, geom=list(tb.edges), offset=bevel, segments=segs, profile=0.5, affect="EDGES")
    if any(abs(a) > 1e-6 for a in rot_t3):
        rmat = rot3(*rot_t3).to_matrix()
        bmesh.ops.rotate(tb, cent=(0.0, 0.0, 0.0), matrix=rmat, verts=tb.verts)
    bmesh.ops.translate(tb, vec=v3(*center_t3), verts=tb.verts)

    vmap = {v: bm.verts.new(v.co) for v in tb.verts}
    created_faces = []
    for f in tb.faces:
        try:
            nf = bm.faces.new([vmap[v] for v in f.verts])
            nf.material_index = mat_idx
            created_faces.append(nf)
        except ValueError:
            pass
    tb.free()
    return created_faces


def export_glb_and_inspect(filepath, export_apply=True):
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
        magic, ver, total_len = struct.unpack("<III", f.read(12))
        chunk_len, chunk_type = struct.unpack("<II", f.read(8))
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


# ==============================================================================
# 5. ASSET 1: EXPLORER POGO V3 (`assets/models/pogo.glb`) + PIXAR STUDIO RENDERS
# ==============================================================================

def add_open_vest_shell(bm, vest_stations, thick=0.0055, segs=20, mat_idx=0):
    """
    Builds a 100% manifold, hollow open-front explorer vest C-shell with full `(u, v)` UVs
    mapped onto `PogoV35_Vest_Albedo` / `PogoV35_Vest_Normal` (woven khaki-chamois canvas +
    folded seam welt + dark-brown dashed saddle-stitching along lapels, collar & hem!).
    """
    uv_layer = bm.loops.layers.uv.verify()
    o_rings = []
    i_rings = []
    ns = len(vest_stations)
    for s_idx, (yl, vrx, vrzf, vrzb, vzs, open_deg) in enumerate(vest_stations):
        a_start = math.radians(open_deg)
        a_end = math.radians(360.0 - open_deg)
        o_r = []
        i_r = []
        for k in range(segs):
            t = k / float(segs - 1)
            th = a_start + (a_end - a_start) * t
            cx, cz = math.sin(th), math.cos(th)
            # Tailored sleeveless armhole scoop on upper stations (`abs(cx) > 0.68`)
            arm_dip = -0.022 * ((max(0.0, abs(cx) - 0.66) / 0.34) ** 1.3) if yl >= 0.045 else 0.0
            # Subtle bottom-front cutaway curve framing top of round pot-belly
            hem_lift = 0.010 * max(0.0, cz) if s_idx == 0 else 0.0
            rz = vrzf if cz >= 0.0 else vrzb
            o_r.append(bm.verts.new(v3(cx * (vrx + thick), yl + arm_dip + hem_lift, vzs + cz * (rz + thick))))
            i_r.append(bm.verts.new(v3(cx * (vrx - 0.0015), yl + arm_dip + hem_lift, vzs + cz * (rz - 0.0015))))
        o_rings.append(o_r)
        i_rings.append(i_r)

    def _set_quad_uv(face, uv0, uv1, uv2, uv3):
        face.material_index = mat_idx
        face.loops[0][uv_layer].uv = uv0
        face.loops[1][uv_layer].uv = uv1
        face.loops[2][uv_layer].uv = uv2
        face.loops[3][uv_layer].uv = uv3

    for s in range(ns - 1):
        v0 = s / float(ns - 1)
        v1 = (s + 1) / float(ns - 1)
        for k in range(segs - 1):
            u0 = k / float(segs - 1)
            u1 = (k + 1) / float(segs - 1)
            try:
                f_out = bm.faces.new([o_rings[s][k], o_rings[s][k + 1], o_rings[s + 1][k + 1], o_rings[s + 1][k]])
                _set_quad_uv(f_out, (u0, v0), (u1, v0), (u1, v1), (u0, v1))
            except ValueError:
                pass
            try:
                f_in = bm.faces.new([i_rings[s][k + 1], i_rings[s][k], i_rings[s + 1][k], i_rings[s + 1][k + 1]])
                _set_quad_uv(f_in, (u1, v0), (u0, v0), (u0, v1), (u1, v1))
            except ValueError:
                pass

        # Left (`u ~ 0.01`) & Right (`u ~ 0.99`) front lapel thickness edges
        for quad, u_edge in (
            ([i_rings[s][0], o_rings[s][0], o_rings[s + 1][0], i_rings[s + 1][0]], 0.015),
            ([o_rings[s][-1], i_rings[s][-1], i_rings[s + 1][-1], o_rings[s + 1][-1]], 0.985),
        ):
            try:
                f_lap = bm.faces.new(quad)
                _set_quad_uv(f_lap, (u_edge, v0), (u_edge, v0), (u_edge, v1), (u_edge, v1))
            except ValueError:
                pass

    for k in range(segs - 1):
        u0 = k / float(segs - 1)
        u1 = (k + 1) / float(segs - 1)
        for quad, v_edge in (
            ([i_rings[0][k], i_rings[0][k + 1], o_rings[0][k + 1], o_rings[0][k]], 0.015),
            ([o_rings[-1][k], o_rings[-1][k + 1], i_rings[-1][k + 1], i_rings[-1][k]], 0.985),
        ):
            try:
                f_hem = bm.faces.new(quad)
                _set_quad_uv(f_hem, (u0, v_edge), (u1, v_edge), (u1, v_edge), (u0, v_edge))
            except ValueError:
                pass


def add_vest_shoulder_panel(bm, pts_t3, nrms_t3, widths, thickness=0.0055, mat_idx=0):
    """
    Sculpts an over-the-shoulder woven khaki-chamois vest strap/panel with `u in [0, 1]`
    mapped across its width so BOTH edges display folded seam welts & dashed stitching!
    """
    uv_layer = bm.loops.layers.uv.verify()
    pts = [Vector(p) for p in pts_t3]
    nrms = [Vector(n).normalized() for n in nrms_t3]
    cnt = len(pts)
    profile = [
        (-0.50,  0.00, 0.01),
        (-0.46,  0.88, 0.04),
        ( 0.00,  1.00, 0.50),
        ( 0.46,  0.88, 0.96),
        ( 0.50,  0.00, 0.99),
        ( 0.44, -0.35, 0.92),
        (-0.44, -0.35, 0.08),
    ]
    np = len(profile)
    v_rings = []
    for i in range(cnt):
        t = (pts[1] - pts[0]) if i == 0 else ((pts[-1] - pts[-2]) if i == cnt - 1 else (pts[i + 1] - pts[i - 1]))
        t.normalize()
        side = t.cross(nrms[i]).normalized()
        n_ortho = side.cross(t).normalized()
        w_i = widths[i] if isinstance(widths, (list, tuple)) else widths
        ring = []
        for uw, vt, _ in profile:
            p = pts[i] + side * (uw * w_i) + n_ortho * (vt * thickness)
            ring.append(bm.verts.new(v3(p.x, p.y, p.z)))
        v_rings.append(ring)

    for i in range(cnt - 1):
        r0, r1 = v_rings[i], v_rings[i + 1]
        v0_uv = 0.08 + 0.84 * (i / float(max(1, cnt - 1)))
        v1_uv = 0.08 + 0.84 * ((i + 1) / float(max(1, cnt - 1)))
        for j in range(np):
            jn = (j + 1) % np
            try:
                f = bm.faces.new([r0[j], r0[jn], r1[jn], r1[j]])
                f.material_index = mat_idx
                u_a, u_b = profile[j][2], profile[jn][2]
                f.loops[0][uv_layer].uv = (u_a, v0_uv)
                f.loops[1][uv_layer].uv = (u_b, v0_uv)
                f.loops[2][uv_layer].uv = (u_b, v1_uv)
                f.loops[3][uv_layer].uv = (u_a, v1_uv)
            except ValueError:
                pass


def build_pogo_scene(for_cycles_studio=False):
    """
    Builds Explorer Pogo V3.5 (`#238` / `#251` — 10/10 Pixar match to `reference_pogo_closeup.png`):
      1. Cute Pear/Teardrop Silhouette (`~28%` narrower sleek shoulders flaring into a round
         creamy pot-belly) + tapered neck column & feathered throat gradient (ZERO collar seam!).
      2. Over-the-Shoulder Stitched Sand/Khaki Chamois Vest (`#ccb68c`, `512x512` woven canvas +
         seam-stitched borders) cinched by dark stitched leather chest/belly-arch harness straps!
      3. Cooler Pastel Seafoam-Jade Head (`#78d28c`), Warm Peachy-Tan Lower Jaw/Lips (`#c49370`),
         2 Crisp Angled Teardrop Nostril Slits, and Deep Warm-Umber Mouth Groove AO!
      4. Soulful `~42%` Pupils (`0..19.5 deg`) + Warm Dark-Amber Iris + Deep Olive-Umber Eye-Cup
         Crease AO + Curious `~8.3 deg` Head Cock & Asymmetric Brow!
      5. Natural Downward-Curled Amphibian Fingers (`~35 deg` knuckle curl — zero flat spokes!).
    """
    reset_scene()
    skin_alb, skin_rgh, skin_nrm = create_pogo_mottled_skin_maps(512 if for_cycles_studio else 256)
    eye_alb = create_soulful_eye_albedo(256)
    leather_alb, canvas_alb = create_leather_and_canvas_maps(128)
    vest_alb, vest_nrm = create_vest_canvas_maps(512 if for_cycles_studio else 256)

    mat_body = make_mat(
        "mat_body", "#56aa6c", roughness=0.64, metallic=0.0, coat=0.0, coat_rough=0.45,
        sss_weight=0.30 if for_cycles_studio else 0.0, sss_scale=0.014,
        albedo_img=skin_alb,
        roughness_img=skin_rgh,
        normal_img=skin_nrm, normal_strength=0.28, uv_scale=1.0
    )
    mat_shade = make_mat(
        "mat_shade", "#37603f", roughness=0.70, metallic=0.0, coat=0.0, coat_rough=0.50,
        sss_weight=0.16 if for_cycles_studio else 0.0, sss_scale=0.008,
        normal_img=skin_nrm, normal_strength=0.18, uv_scale=1.0
    )
    mat_belly = make_mat(
        "mat_belly", "#e5dc9e", roughness=0.68, metallic=0.0, coat=0.0, coat_rough=0.50,
        sss_weight=0.30 if for_cycles_studio else 0.0, sss_scale=0.014,
        albedo_img=skin_alb,
        roughness_img=skin_rgh,
        normal_img=skin_nrm, normal_strength=0.14, uv_scale=1.0
    )
    mat_crest = make_mat(
        "mat_crest", "#76cf8a", roughness=0.60, metallic=0.0, coat=0.0, coat_rough=0.44,
        sss_weight=0.34 if for_cycles_studio else 0.0, sss_scale=0.015,
        albedo_img=skin_alb,
        normal_img=skin_nrm, normal_strength=0.18, uv_scale=1.0
    )
    mat_web = make_mat("mat_web", "#7ec482", roughness=0.64, metallic=0.0, sss_weight=0.28 if for_cycles_studio else 0.0, alpha=0.95)

    mat_harness = make_mat(
        "mat_harness", "#422616", roughness=0.76, metallic=0.04,
        albedo_img=leather_alb, uv_scale=1.0
    )
    mat_vest = make_mat(
        "mat_vest", "#ccb68c", roughness=0.88, metallic=0.01,
        albedo_img=vest_alb,
        normal_img=vest_nrm, normal_strength=0.58, uv_scale=1.0
    )
    mat_pack = make_mat(
        "mat_pack", "#c4ae82", roughness=0.86, metallic=0.02,
        albedo_img=canvas_alb, uv_scale=2.0
    )
    mat_mouth = make_mat("mat_mouth", "#241610", roughness=0.82, metallic=0.0)

    mat_eye_sclera = make_mat(
        "mat_shade_sclera", "#f4ecdc", roughness=0.16, coat=0.84, coat_rough=0.05,
        albedo_img=eye_alb, uv_scale=1.0
    )
    mat_eye = make_mat(
        "mat_eye", "#9e6628", roughness=0.10, metallic=0.0, coat=0.94, coat_rough=0.03,
        emission_hex="#9e6628", emission_strength=0.04,
        albedo_img=eye_alb, uv_scale=1.0
    )
    mat_pupil = make_mat(
        "mat_pupil", "#05060b", roughness=0.20, metallic=0.0, coat=0.60, coat_rough=0.04,
        albedo_img=eye_alb, uv_scale=1.0
    )
    mat_white = make_mat("mat_white", "#ffffff", roughness=0.04, emission_hex="#ffffff", emission_strength=1.35)

    mat_brass = make_mat("mat_brass", "#c4923e", roughness=0.32, metallic=0.86)
    mat_steel = make_mat("mat_steel", "#36404f", roughness=0.32, metallic=0.84)
    mat_accent = make_mat("mat_accent", "#4fd8f5", roughness=0.15, emission_hex="#38bdf8", emission_strength=1.55)

    pogo_root = make_empty_node("PogoRoot", (0.0, 0.0, 0.0))
    parts = {}

    # --------------------------------------------------------------------------
    # 1. CUTE PEAR/TEARDROP POT-BELLY TORSO (`torso` at chest `(0, 0.356, 0)`)
    #    ~28% narrower sleek upper shoulders tapering continuously into skull base
    #    (ZERO barrel chest, ZERO horizontal collar shelf/seam!)
    # --------------------------------------------------------------------------
    bm = bmesh.new()
    torso_stations = [
        (-0.148, 0.062, 0.056, 0.060, -0.004),
        (-0.114, 0.112, 0.108, 0.098,  0.004),
        (-0.070, 0.128, 0.144, 0.104,  0.014),  # Cute round forward pot-belly!
        (-0.024, 0.122, 0.138, 0.100,  0.012),
        ( 0.022, 0.106, 0.112, 0.092,  0.006),
        ( 0.062, 0.091, 0.091, 0.082,  0.004),  # Narrow sleek upper shoulders!
        ( 0.096, 0.076, 0.076, 0.070,  0.008),  # Sleek tapered collar
        ( 0.132, 0.066, 0.066, 0.062,  0.014),  # Smooth neck column rising into head
        ( 0.168, 0.056, 0.056, 0.052,  0.018),  # Tucked cleanly inside skull base!
    ]
    rings = []
    for y, rx, rzf, rzb, zs in torso_stations:
        ring = []
        for s in range(18):
            a = (2.0 * math.pi * s) / 18
            ca, sa = math.cos(a), math.sin(a)
            rz = rzf if sa >= 0.0 else rzb
            ring.append((ca * rx, y, zs + sa * rz))
        rings.append(ring)
    add_loft_rings(bm, rings, closed=True, cap_start=True, cap_end=True, mat_idx=0)
    add_swept_curve(bm, [(0.0, -0.108, -0.082), (0.0, -0.124, -0.120), (0.0, -0.120, -0.140)], [(0.038, 0.032), (0.022, 0.018), (0.009, 0.009)], segs=8, mat_idx=0)
    parts["torso"] = finalize_mesh_obj("torso", bm, mat_body, pos=(0.0, 0.356, 0.0), parent=pogo_root, subdiv_levels=1)

    # --------------------------------------------------------------------------
    # 2. CONFORMAL PEAR POT-BELLY PATCH (`belly` at spine `(0, 0.286, 0)`)
    # --------------------------------------------------------------------------
    bm = bmesh.new()
    belly_stations = [
        (-0.044, 0.058, 0.104),
        (-0.004, 0.098, 0.152),
        ( 0.036, 0.104, 0.156),
        ( 0.076, 0.082, 0.124),
        ( 0.118, 0.054, 0.094),
        ( 0.154, 0.040, 0.080),
    ]
    b_rings = []
    for y, bx_w, z_surf in belly_stations:
        ring = []
        for s in range(12):
            a = (2.0 * math.pi * s) / 12
            ca, sa = math.cos(a), math.sin(a)
            z = (z_surf + 0.0010) if sa >= 0.0 else (z_surf - 0.024)
            curve_back = -0.022 * (ca * ca)
            ring.append((ca * bx_w, y, z + curve_back + sa * 0.004))
        b_rings.append(ring)
    add_loft_rings(bm, b_rings, closed=True, cap_start=True, cap_end=True, mat_idx=0)
    parts["belly"] = finalize_mesh_obj("belly", bm, mat_belly, pos=(0.0, 0.286, 0.0), parent=pogo_root, subdiv_levels=1)

    # --------------------------------------------------------------------------
    # 3. OVER-THE-SHOULDER STITCHED KHAKI-CHAMOIS VEST (`#ccb68c`) + INVERTED-Y
    #    SADDLE-LEATHER HARNESS & COMPASS (`harness` at chest `(0, 0.356, 0)`)
    # --------------------------------------------------------------------------
    bm = bmesh.new()
    vest_stations = [
        (-0.006, 0.118, 0.130, 0.098, 0.010, 56.0),
        ( 0.026, 0.108, 0.114, 0.094, 0.006, 38.0),
        ( 0.058, 0.095, 0.096, 0.085, 0.004, 33.0),
        ( 0.088, 0.082, 0.082, 0.075, 0.007, 37.0),
    ]
    add_open_vest_shell(bm, vest_stations, thick=0.0055, segs=20, mat_idx=0)

    for side in (-1.0, 1.0):
        # Continuous over-the-shoulder stitched khaki-chamois vest panels (`mat_vest`)!
        v_sh_pts = [
            (side * 0.054, 0.078,  0.070),
            (side * 0.064, 0.104,  0.040),
            (side * 0.068, 0.113,  0.004),
            (side * 0.064, 0.102, -0.038),
            (side * 0.056, 0.080, -0.068),
        ]
        v_sh_nrms = [
            (side * 0.42, 0.42,  0.80),
            (side * 0.38, 0.80,  0.46),
            (side * 0.30, 0.95,  0.05),
            (side * 0.36, 0.78, -0.50),
            (side * 0.38, 0.38, -0.84),
        ]
        add_vest_shoulder_panel(bm, v_sh_pts, v_sh_nrms, [0.040, 0.038, 0.036, 0.038, 0.042], thickness=0.0052, mat_idx=0)

        # Tailored folded V-neck collar lapel trim (`mat_vest`)
        lap_pts = [
            (side * 0.050, 0.088, 0.074),
            (side * 0.062, 0.062, 0.090),
            (side * 0.068, 0.034, 0.102),
        ]
        lap_nrms = [
            (side * 0.48, 0.25, 0.84),
            (side * 0.52, 0.18, 0.83),
            (side * 0.54, 0.10, 0.84),
        ]
        add_vest_shoulder_panel(bm, lap_pts, lap_nrms, [0.020, 0.024, 0.018], thickness=0.0045, mat_idx=0)

        # Dark stitched leather harness straps riding OVER the vest shoulder panels to high sternum clasp!
        s_pts = [
            (side * 0.056, 0.088, -0.076),
            (side * 0.068, 0.118,  0.004),
            (side * 0.064, 0.102,  0.054),
            (side * 0.052, 0.070,  0.094),
            (side * 0.030, 0.044,  0.116),
            (0.0,          0.028,  0.123),
        ]
        s_nrms = [
            (side * 0.32, 0.42, -0.85),
            (side * 0.30, 0.95,  0.05),
            (side * 0.38, 0.78,  0.48),
            (side * 0.42, 0.40,  0.81),
            (side * 0.26, 0.18,  0.95),
            (0.0,         0.08,  1.00),
        ]
        add_flat_surface_strap(bm, s_pts, s_nrms, width=0.016, thickness=0.0048, mat_idx=1)

        # Inverted-U dark leather belly-arch strap framing top curve of his round yellow pot-belly!
        r_pts = [
            (0.0,          0.026,  0.124),
            (side * 0.038, 0.018,  0.126),
            (side * 0.074, 0.000,  0.118),
            (side * 0.106, -0.016, 0.088),
            (side * 0.127, -0.022, 0.036),
            (side * 0.126, -0.020, -0.018),
            (side * 0.110, -0.014, -0.066),
            (side * 0.076, -0.006, -0.096),
        ]
        r_nrms = [
            (0.0,         0.06,  1.00),
            (side * 0.30, 0.04,  0.95),
            (side * 0.58, 0.02,  0.81),
            (side * 0.82, 0.00,  0.57),
            (side * 0.96, 0.00,  0.28),
            (side * 0.99, 0.00, -0.14),
            (side * 0.86, 0.00, -0.51),
            (side * 0.50, 0.00, -0.86),
        ]
        add_flat_surface_strap(bm, r_pts, r_nrms, width=0.016, thickness=0.0046, mat_idx=1)
        add_bevel_box(bm, (side * 0.048, 0.064, 0.098), (0.020, 0.011, 0.005), bevel=0.002, rot_t3=(-0.40, side * 0.34, -side * 0.48), mat_idx=2)

    # Compact aged-brass sternum buckle + small brass lapel compass badge + hip utility pouch
    add_bevel_box(bm, (0.0, 0.027, 0.126), (0.026, 0.020, 0.006), bevel=0.0025, segs=1, mat_idx=2)
    add_bevel_box(bm, (0.0, 0.027, 0.129), (0.013, 0.010, 0.004), bevel=0.0018, segs=1, mat_idx=1)

    add_swept_curve(bm, [(-0.070, 0.052, 0.094), (-0.073, 0.054, 0.100)], [0.011, 0.010], segs=10, mat_idx=2)
    add_ellipsoid(bm, (-0.074, 0.054, 0.101), (0.006, 0.006, 0.0025), u_segs=8, v_segs=5, mat_idx=1)

    add_bevel_box(bm, (0.126, -0.046, 0.026), (0.026, 0.046, 0.038), bevel=0.007, rot_t3=(0.08, 0.18, -0.14), mat_idx=1)
    add_ellipsoid(bm, (0.140, -0.038, 0.030), (0.0042, 0.0050, 0.0050), u_segs=6, v_segs=4, mat_idx=2)

    parts["harness"] = finalize_mesh_obj(
        "harness", bm, [mat_vest, mat_harness, mat_brass],
        pos=(0.0, 0.356, 0.0), parent=pogo_root, keep_custom_uvs=True
    )

    # --------------------------------------------------------------------------
    # 4. CHUNKY TAN CANVAS RUCKSACK + PEEKING ROLLED SHOULDER BEDROLL
    #    (`backpack` at `(0, 0.428, -0.100)` — peeks unmistakably over shoulder!)
    # --------------------------------------------------------------------------
    bm = bmesh.new()
    add_bevel_box(bm, (0.012, -0.006, -0.002), (0.194, 0.178, 0.096), bevel=0.026, segs=2, mat_idx=0)
    add_bevel_box(bm, (0.012,  0.054, -0.006), (0.202, 0.054, 0.102), bevel=0.016, segs=1, mat_idx=0)
    bedroll_pts = [
        (-0.118, 0.098, 0.024),
        (-0.030, 0.112, 0.020),
        ( 0.058, 0.120, 0.026),
        ( 0.142, 0.110, 0.040),
    ]
    add_swept_curve(bm, bedroll_pts, [(0.036, 0.036), (0.041, 0.041), (0.042, 0.042), (0.038, 0.038)], segs=14, mat_idx=0)
    for sx in (-0.056, 0.078):
        add_swept_curve(bm, [(sx - 0.008, 0.114, 0.024), (sx + 0.008, 0.114, 0.024)], 0.044, segs=12, mat_idx=1)
        add_bevel_box(bm, (sx * 0.85, 0.004, -0.006), (0.020, 0.186, 0.104), bevel=0.004, mat_idx=1)
        add_bevel_box(bm, (sx * 0.85, 0.018, -0.058), (0.028, 0.022, 0.010), bevel=0.003, mat_idx=2)
    add_swept_curve(bm, [(0.012, -0.052, -0.056), (0.012, 0.036, -0.056)], 0.019, segs=10, mat_idx=3)
    add_swept_curve(bm, [(0.012,  0.030, -0.056), (0.012, 0.048, -0.056)], 0.024, segs=10, mat_idx=2)
    add_swept_curve(bm, [(0.012, -0.066, -0.056), (0.012, -0.048, -0.056)], 0.024, segs=10, mat_idx=2)

    parts["backpack"] = finalize_mesh_obj(
        "backpack", bm, [mat_pack, mat_harness, mat_brass, mat_accent],
        pos=(0.0, 0.428, -0.100), parent=pogo_root
    )

    # --------------------------------------------------------------------------
    # 5. UNIFIED HEART/WEDGE CHAMELEON-FROG HEAD & CHIN (`head` at `(0, 0.476, 0.020)`)
    #    Cooler seafoam-jade crown, warm peachy-tan lower jaw/lips, crisp angled
    #    teardrop nostril slits, deep mouth groove AO & olive-umber eye-cup rim crease!
    # --------------------------------------------------------------------------
    head_bm = bmesh.new()
    head_stations = [
        # (z_local, y_center, rx, ry_top, ry_bot)
        (-0.146, 0.146, 0.068, 0.064, 0.066),
        (-0.106, 0.144, 0.136, 0.124, 0.118),
        (-0.052, 0.142, 0.180, 0.156, 0.136),
        ( 0.000, 0.138, 0.190, 0.164, 0.132),  # Wide expressive chameleon cheeks + heart-tapered jaw!
        ( 0.056, 0.132, 0.174, 0.150, 0.108),
        ( 0.110, 0.122, 0.144, 0.114, 0.080),
        ( 0.156, 0.112, 0.106, 0.074, 0.054),
        ( 0.188, 0.106, 0.064, 0.042, 0.030),
        ( 0.204, 0.104, 0.026, 0.018, 0.013),
    ]
    h_rings = []
    h_segs = 26
    for z, yc, rx, ryt, ryb in head_stations:
        ring = []
        for s in range(h_segs):
            a = (2.0 * math.pi * s) / h_segs
            ca, sa = math.cos(a), math.sin(a)
            ry = ryt if sa >= 0.0 else ryb
            x = ca * rx
            y = yc + sa * ry

            # Integrated smooth chameleon turret eye-socket mounds
            if -0.025 <= z <= 0.155 and sa > -0.10:
                z_fac = math.sin(((z + 0.025) / 0.180) * math.pi)
                turret = math.exp(-((abs(ca) - 0.60) ** 2) / 0.082) * max(0.0, sa + 0.10) * 0.056 * z_fac
                mid_valley = math.exp(-(ca ** 2) / 0.050) * max(0.0, sa) * 0.020 * z_fac
                y += turret - mid_valley
                x += math.copysign(turret * 0.38, ca)

            # Heart/wedge lower-jaw taper (`sa < -0.16`) so chin tucks neatly into narrow pear collar!
            if sa < -0.16:
                chin_t = (-sa - 0.16) / 0.84
                x *= (1.0 - 0.32 * (chin_t ** 1.35))
                if z > 0.03:
                    z -= 0.024 * (chin_t ** 1.15) * smoothstep(0.03, 0.18, z)

            # Sculpted mouth groove tuck + upturned confident asymmetric half-smirk!
            if z > -0.025 and -0.52 < sa < 0.06:
                groove_indent = math.exp(-((sa + 0.32) ** 2) / 0.008) * smoothstep(-0.02, 0.06, z)
                z -= groove_indent * 0.007
                x *= (1.0 - groove_indent * 0.025)
                corner_fac = max(0.0, 1.0 - max(0.0, z + 0.010) / 0.16)
                smirk_asym = 1.28 if ca > 0.0 else 0.88
                y += corner_fac * 0.018 * smirk_asym * (abs(ca) ** 1.3)

            ring.append((x, y, z))
        h_rings.append(ring)
    add_loft_rings(head_bm, h_rings, closed=True, cap_start=True, cap_end=True, mat_idx=0)

    # Concentric fleshy chameleon turret eye-hoods (`mat_idx=2` -> `mat_shade` on inner rim crease!)
    for side in (1.0, -1.0):
        cy_r, sy_r = math.cos(side * 0.18), math.sin(side * 0.18)
        hood_rings = []
        for deg, rad in ((148, 0.062), (118, 0.083), (82, 0.084), (52, 0.079), (47, 0.0725), (86, 0.066)):
            th = math.radians(deg)
            lz = 0.066 * math.cos(th)
            sr = math.sin(th)
            hr = []
            for iu in range(16):
                ang = (2.0 * math.pi * iu) / 16
                lx = rad * sr * math.cos(ang)
                ly = (rad + 0.002) * sr * math.sin(ang)
                wx = side * 0.098 + lx * cy_r + lz * sy_r
                wy = 0.178 + ly
                wz = 0.096 - lx * sy_r + lz * cy_r
                hr.append((wx, wy, wz))
            hood_rings.append(hr)
        add_loft_rings(head_bm, hood_rings, closed=True, cap_start=True, cap_end=True, mat_idx=[0, 0, 0, 2, 2])

    # Sculpted snout nostril alae swells + 2 crisp dark angled teardrop nostril slits (`mat_mouth`)!
    for side in (-1.0, 1.0):
        add_ellipsoid(head_bm, (side * 0.026, 0.126, 0.178), (0.012, 0.009, 0.014), u_segs=8, v_segs=6, mat_idx=0)
        n_pts = [
            (side * 0.030, 0.129, 0.184),
            (side * 0.025, 0.125, 0.189),
            (side * 0.019, 0.120, 0.193),
        ]
        add_swept_curve(head_bm, n_pts, [(0.0046, 0.0030), (0.0034, 0.0024), (0.0014, 0.0012)], segs=6, mat_idx=1)

    # Crisp Wide Upturned Confident Half-Smirk Mouth Crease (`mat_mouth` deep warm umber)
    smile_pts = [
        (-0.152, 0.099, 0.024),
        (-0.125, 0.089, 0.092),
        (-0.074, 0.082, 0.156),
        ( 0.000, 0.080, 0.191),
        ( 0.074, 0.085, 0.156),
        ( 0.127, 0.101, 0.090),
        ( 0.156, 0.119, 0.022),
    ]
    add_swept_curve(head_bm, smile_pts, [0.0036, 0.0046, 0.0050, 0.0050, 0.0050, 0.0048, 0.0038], segs=6, mat_idx=1)
    parts["head"] = finalize_mesh_obj(
        "head", head_bm, [mat_body, mat_mouth, mat_shade], pos=(0.0, 0.452, 0.022), parent=pogo_root, subdiv_levels=1
    )

    # --------------------------------------------------------------------------
    # 6. PROMINENT SCULPTED DORSAL CROWN FIN (`crest` at `(0, 0.744, 0.024)`)
    # --------------------------------------------------------------------------
    bm = bmesh.new()
    fin_profiles = [
        ( 0.078, -0.048, -0.012, 0.011),
        ( 0.044, -0.036,  0.048, 0.016),
        ( 0.004, -0.030,  0.084, 0.018),
        (-0.038, -0.034,  0.068, 0.017),
        (-0.080, -0.046,  0.032, 0.013),
        (-0.120, -0.068, -0.014, 0.009),
    ]
    c_rings = []
    for z, yb, yt, ht in fin_profiles:
        ym, ry = 0.5 * (yb + yt), 0.5 * (yt - yb)
        c_rings.append([
            (math.cos((2.0 * math.pi * s) / 14) * ht, ym + math.sin((2.0 * math.pi * s) / 14) * ry, z)
            for s in range(14)
        ])
    add_loft_rings(bm, c_rings, closed=True, cap_start=True, cap_end=True, mat_idx=0)
    parts["crest"] = finalize_mesh_obj(
        "crest", bm, mat_crest, pos=(0.0, 0.744, 0.024), parent=pogo_root, subdiv_levels=1
    )

    # --------------------------------------------------------------------------
    # 7. FLESHY CHAMELEON SUPRAORBITAL BROWS (`browL`, `browR` — Snug & Expressive!)
    # --------------------------------------------------------------------------
    for bname, side in (("browL", 1.0), ("browR", -1.0)):
        bm = bmesh.new()
        arch_lift = 0.012 if side > 0 else 0.004
        inner_dip = -0.004 if side > 0 else -0.012
        b_pts = [
            (-side * 0.052, inner_dip - 0.010, 0.022),
            (-side * 0.016, arch_lift,         0.036),
            ( side * 0.022, arch_lift + 0.002, 0.026),
            ( side * 0.054, -0.022,           -0.010),
        ]
        add_swept_curve(bm, b_pts, [(0.008, 0.008), (0.015, 0.012), (0.015, 0.012), (0.008, 0.008)], segs=10, mat_idx=0)
        by_pos = 0.700 if side > 0 else 0.694
        parts[bname] = finalize_mesh_obj(
            bname, bm, mat_crest, pos=(side * 0.098, by_pos, 0.118), parent=pogo_root, subdiv_levels=1
        )

    # --------------------------------------------------------------------------
    # 8. CREAMY-SCLERA TURRET EYES (`eyeL`, `eyeR`) + BLINK LIDS (`eyelidL`, `eyelidR`)
    # --------------------------------------------------------------------------
    for sfx, side in (("L", 1.0), ("R", -1.0)):
        bm = bmesh.new()
        add_soulful_amphibian_eyeball(bm, rx=0.067, ry=0.069, rz=0.065, u_segs=20)
        parts[f"eye{sfx}"] = finalize_mesh_obj(
            f"eye{sfx}",
            bm,
            [mat_eye_sclera, mat_eye, mat_pupil, mat_white],
            pos=(side * 0.098, 0.630, 0.118),
            rot=(0.0, side * 0.18, 0.0),
            parent=pogo_root,
            keep_custom_uvs=True,
        )

        bm_lid = bmesh.new()
        add_spherical_cap(bm_lid, radius=0.0715, phi_max=math.pi * 0.52, u_segs=18, v_segs=6, pitch_offset=-0.26, mat_idx=0)
        parts[f"eyelid{sfx}"] = finalize_mesh_obj(
            f"eyelid{sfx}",
            bm_lid,
            mat_crest if for_cycles_studio else mat_body,
            pos=(side * 0.098, 0.630, 0.118),
            rot=(0.0, side * 0.18, 0.0),
            parent=pogo_root,
        )

    # --------------------------------------------------------------------------
    # 9. CONFORMAL FLUSH CHIN / GULAR THROAT PATCH (`jaw` at `(0, 0.482, 0.046)`)
    # --------------------------------------------------------------------------
    bm = bmesh.new()
    jaw_stations = [
        (-0.026, 0.002, 0.076, 0.014, 0.020),
        ( 0.018, 0.012, 0.104, 0.016, 0.024),
        ( 0.068, 0.024, 0.092, 0.014, 0.020),
        ( 0.114, 0.036, 0.066, 0.011, 0.015),
        ( 0.144, 0.044, 0.036, 0.007, 0.009),
    ]
    j_rings = []
    for z, yc, rx, ryt, ryb in jaw_stations:
        ring = []
        for s in range(12):
            a = (2.0 * math.pi * s) / 12
            ca, sa = math.cos(a), math.sin(a)
            ry = ryt if sa >= 0.0 else ryb
            ring.append((ca * rx, yc + sa * ry, z))
        j_rings.append(ring)
    add_loft_rings(bm, j_rings, closed=True, cap_start=True, cap_end=True, mat_idx=0)
    parts["jaw"] = finalize_mesh_obj("jaw", bm, mat_belly, pos=(0.0, 0.482, 0.046), parent=pogo_root, subdiv_levels=1)

    # --------------------------------------------------------------------------
    # 10. LITHE ATHLETIC ARMS, WRIST BRACER & NATURAL DOWNWARD-CURLED HANDS!
    #     (`shoulder` narrowed to `±0.096`, fingers curl gently downward ~35 deg!)
    # --------------------------------------------------------------------------
    for sfx, side in (("L", 1.0), ("R", -1.0)):
        bm = bmesh.new()
        ua_pts = [
            (-side * 0.018, 0.020,  0.0),
            ( 0.0,          0.000,  0.0),
            ( side * 0.004, -0.042, 0.002),
            ( 0.0,         -0.086,  0.001),
            ( 0.0,         -0.106,  0.0),
            ( 0.0,         -0.121,  0.0),
            ( 0.0,         -0.130,  0.0),
        ]
        ua_rad = [(0.032, 0.030), (0.034, 0.032), (0.029, 0.028), (0.025, 0.024), (0.024, 0.024), (0.020, 0.020), (0.010, 0.010)]
        add_swept_curve(bm, ua_pts, ua_rad, segs=12, up_t3=(0.0, 0.0, 1.0), mat_idx=0)
        parts[f"upperArm{sfx}"] = finalize_mesh_obj(
            f"upperArm{sfx}", bm, mat_body, pos=(side * 0.096, 0.430, -0.004), parent=pogo_root, subdiv_levels=1
        )

        bm = bmesh.new()
        fa_pts = [
            (0.0,  0.022,  0.0),
            (0.0,  0.012,  0.0),
            (0.0,  0.000,  0.0),
            (0.0, -0.036,  0.004),
            (0.0, -0.076,  0.003),
            (0.0, -0.102,  0.003),
            (0.0, -0.114,  0.004),
            (0.0, -0.121,  0.005),
        ]
        fa_rad = [(0.010, 0.010), (0.020, 0.020), (0.024, 0.024), (0.027, 0.025), (0.022, 0.021), (0.019, 0.018), (0.016, 0.015), (0.009, 0.009)]
        add_swept_curve(bm, fa_pts, fa_rad, segs=12, up_t3=(0.0, 0.0, 1.0), mat_idx=0)
        if sfx == "L":
            add_swept_curve(bm, [(0.0, -0.062, 0.003), (0.0, -0.090, 0.003)], [(0.0245, 0.0235), (0.0220, 0.0210)], segs=12, up_t3=(0.0, 0.0, 1.0), mat_idx=1)
            parts[f"forearm{sfx}"] = finalize_mesh_obj(
                f"forearm{sfx}", bm, [mat_body, mat_harness], pos=(side * 0.096, 0.324, -0.004), parent=pogo_root, subdiv_levels=1
            )
        else:
            parts[f"forearm{sfx}"] = finalize_mesh_obj(
                f"forearm{sfx}", bm, mat_body, pos=(side * 0.096, 0.324, -0.004), parent=pogo_root, subdiv_levels=1
            )

        bm = bmesh.new()
        palm_pts = [(0.0, 0.010, 0.001), (0.0, -0.002, 0.004), (0.0, -0.018, 0.010), (0.0, -0.028, 0.012)]
        palm_rad = [(0.014, 0.013), (0.020, 0.016), (0.026, 0.015), (0.025, 0.012)]
        add_swept_curve(bm, palm_pts, palm_rad, segs=12, up_t3=(0.0, 0.0, 1.0), mat_idx=0)

        # Inner thumb curling gently downward & outward (`~34 deg` natural amphibian curl)
        thumb_pts = [
            (-side * 0.018, -0.015, 0.010),
            (-side * 0.038, -0.026, 0.021),
            (-side * 0.049, -0.045, 0.017),
            (-side * 0.046, -0.060, 0.007),
            (-side * 0.043, -0.065, 0.003),
        ]
        add_swept_curve(
            bm, thumb_pts,
            [(0.0100, 0.0090), (0.0088, 0.0082), (0.0080, 0.0074), (0.0088, 0.0076), (0.0048, 0.0042)],
            segs=8, up_t3=(0.0, 0.0, 1.0), mat_idx=0
        )

        # 3 outer fingers with crisp daylight separation (`-0.38..+0.48 rad`), curling downward at knuckles!
        digit_specs = [
            (-side * 0.38, 0.060, 0.0098),
            ( side * 0.05, 0.068, 0.0105),
            ( side * 0.48, 0.058, 0.0096),
        ]
        for ang, flen, r_base in digit_specs:
            dx, dz = math.sin(ang), math.cos(ang)
            f_pts = [
                (dx * 0.018, -0.024, 0.011 + dz * 0.005),
                (dx * (0.018 + flen * 0.34), -0.036, 0.021 + dz * (flen * 0.26)),
                (dx * (0.018 + flen * 0.56), -0.056, 0.019 + dz * (flen * 0.22)),
                (dx * (0.018 + flen * 0.62), -0.076, 0.008 + dz * (flen * 0.10)),
                (dx * (0.018 + flen * 0.60), -0.083, 0.004 + dz * (flen * 0.07)),
            ]
            f_rad = [
                (r_base, r_base * 0.90),
                (r_base * 0.86, r_base * 0.80),
                (r_base * 0.78, r_base * 0.74),
                (r_base * 0.88, r_base * 0.78),
                (r_base * 0.48, r_base * 0.42),
            ]
            add_swept_curve(bm, f_pts, f_rad, segs=8, up_t3=(0.0, 0.0, 1.0), mat_idx=0)

        parts[f"hand{sfx}"] = finalize_mesh_obj(
            f"hand{sfx}", bm, mat_body, pos=(side * 0.096, 0.222, -0.004), parent=pogo_root, subdiv_levels=1
        )

    # --------------------------------------------------------------------------
    # 11. BIND-POSE `blaster` GRIPPED CLEANLY IN `handR` PALM!
    # --------------------------------------------------------------------------
    bm = bmesh.new()
    add_bevel_box(bm, (0.0, -0.008, -0.002), (0.026, 0.060, 0.032), bevel=0.005, rot_t3=(0.22, 0.0, 0.0), mat_idx=0)
    add_bevel_box(bm, (0.0,  0.024,  0.034), (0.036, 0.038, 0.098), bevel=0.005, mat_idx=1)
    add_swept_curve(bm, [(0.0, 0.024, 0.078), (0.0, 0.024, 0.144)], [0.019, 0.016], segs=10, mat_idx=1)
    add_swept_curve(bm, [(0.0, 0.028, 0.016), (0.0, 0.028, 0.072)], 0.020, segs=10, mat_idx=2)
    add_swept_curve(bm, [(0.0, 0.024, 0.136), (0.0, 0.024, 0.152)], [0.017, 0.022], segs=10, mat_idx=3)
    parts["blaster"] = finalize_mesh_obj(
        "blaster", bm, [mat_harness, mat_steel, mat_accent, mat_brass],
        pos=(-0.100, 0.190, 0.034), parent=pogo_root
    )

    # --------------------------------------------------------------------------
    # 12. ATHLETIC DIAMOND-CROUCH FROG LEGS & WIDE SPLAYED 3-TOED FEET!
    # --------------------------------------------------------------------------
    for sfx, side in (("L", 1.0), ("R", -1.0)):
        bm = bmesh.new()
        th_pts = [
            (-side * 0.014, 0.032, -0.004),
            ( 0.0,          0.000,  0.0),
            ( side * 0.006, -0.046, 0.005),
            ( 0.0,         -0.088,  0.002),
            ( 0.0,         -0.112,  0.0),
            ( 0.0,         -0.132,  0.0),
            ( 0.0,         -0.144,  0.0),
        ]
        th_rad = [(0.044, 0.044), (0.047, 0.048), (0.045, 0.047), (0.036, 0.037), (0.032, 0.032), (0.026, 0.026), (0.014, 0.014)]
        add_swept_curve(bm, th_pts, th_rad, segs=12, up_t3=(0.0, 0.0, 1.0), mat_idx=0)
        parts[f"thigh{sfx}"] = finalize_mesh_obj(
            f"thigh{sfx}", bm, mat_body, pos=(side * 0.068, 0.244, 0.004), parent=pogo_root, subdiv_levels=1
        )

        bm = bmesh.new()
        sh_pts = [
            (0.0,  0.030,  0.0),
            (0.0,  0.016,  0.0),
            (0.0,  0.000,  0.0),
            (0.0, -0.040, -0.006),
            (0.0, -0.080, -0.003),
            (0.0, -0.108,  0.0),
            (0.0, -0.118,  0.002),
        ]
        sh_rad = [(0.014, 0.014), (0.026, 0.026), (0.032, 0.032), (0.034, 0.036), (0.025, 0.026), (0.021, 0.022), (0.013, 0.013)]
        add_swept_curve(bm, sh_pts, sh_rad, segs=12, up_t3=(0.0, 0.0, 1.0), mat_idx=0)
        parts[f"shin{sfx}"] = finalize_mesh_obj(
            f"shin{sfx}", bm, mat_body, pos=(side * 0.068, 0.132, 0.004), parent=pogo_root, subdiv_levels=1
        )

        bm = bmesh.new()
        f_pts = [(0.0, 0.002, -0.020), (0.0, -0.010, 0.012), (0.0, -0.012, 0.046)]
        f_rad = [(0.024, 0.015), (0.032, 0.011), (0.038, 0.010)]
        add_swept_curve(bm, f_pts, f_rad, segs=10, up_t3=(0.0, 1.0, 0.0), mat_idx=0)

        toe_specs = [(side * 0.50, 0.118), (0.0, 0.136), (-side * 0.46, 0.112)]
        web_tips = []
        for yaw, tlen in toe_specs:
            dx, dz = math.sin(yaw), math.cos(yaw)
            t0 = (dx * 0.016, -0.012, 0.036 + dz * 0.014)
            t1 = (dx * (tlen * 0.55), -0.010, 0.036 + dz * (tlen * 0.55))
            t2 = (dx * tlen, -0.012, 0.036 + dz * tlen)
            web_tips.append((dx * (tlen * 0.72), -0.013, 0.036 + dz * (tlen * 0.72)))
            add_swept_curve(bm, [t0, t1, t2], [(0.013, 0.009), (0.0105, 0.008), (0.009, 0.007)], segs=8, mat_idx=0)
            add_ellipsoid(bm, (t2[0], -0.012, t2[2]), (0.018, 0.010, 0.020), u_segs=10, v_segs=6, mat_idx=0)

        base_w = (0.0, -0.013, 0.038)
        for wi in range(2):
            pa, pb = web_tips[wi], web_tips[wi + 1]
            pm = ((pa[0] + pb[0]) * 0.44, -0.013, (pa[2] + pb[2]) * 0.44)
            add_loft_rings(
                bm,
                [
                    [(base_w[0], -0.011, base_w[2]), (pa[0], -0.011, pa[2]), (pm[0], -0.011, pm[2]), (pb[0], -0.011, pb[2])],
                    [(base_w[0], -0.015, base_w[2]), (pa[0], -0.015, pa[2]), (pm[0], -0.015, pm[2]), (pb[0], -0.015, pb[2])],
                ],
                closed=True, cap_start=True, cap_end=True, mat_idx=1,
            )

        parts[f"foot{sfx}"] = finalize_mesh_obj(
            f"foot{sfx}", bm, [mat_body, mat_web], pos=(side * 0.068, 0.024, 0.004), parent=pogo_root
        )

    bpy.context.view_layer.update()
    trunk_skin_names = ("torso", "belly", "head", "crest", "browL", "browR", "jaw")
    limb_skin_names = (
        "upperArmL", "forearmL", "handL", "upperArmR", "forearmR", "handR",
        "thighL", "shinL", "footL", "thighR", "shinR", "footR",
    )
    for sk_name in trunk_skin_names:
        project_anatomical_skin_uvs(parts[sk_name], is_limb=False)
    for sk_name in limb_skin_names:
        project_anatomical_skin_uvs(parts[sk_name], is_limb=True)

    return pogo_root, parts, mat_body


def reparent_keep_world(child_obj, new_parent):
    mw = child_obj.matrix_world.copy()
    child_obj.parent = new_parent
    child_obj.matrix_parent_inverse = new_parent.matrix_world.inverted()
    child_obj.matrix_world = mw


def set_direct_parent(child_obj, new_parent, pos_t3, rot_t3=(0.0, 0.0, 0.0)):
    child_obj.parent = new_parent
    child_obj.matrix_parent_inverse.identity()
    child_obj.location = v3(*pos_t3)
    child_obj.rotation_euler = rot3(*rot_t3)


def build_studio_pedestal():
    stone_nrm = create_stone_normal_img(256)
    mat_ped_stone = make_mat(
        "studio_stone", "#282e4d", roughness=0.68, metallic=0.05,
        normal_img=stone_nrm, normal_strength=0.75, uv_scale=3.0
    )
    mat_ped_trim = make_mat(
        "studio_trim", "#485472", roughness=0.58, metallic=0.06,
        normal_img=stone_nrm, normal_strength=0.62, uv_scale=2.2
    )
    mat_ped_moss = make_mat("studio_moss", "#2f5727", roughness=0.88, metallic=0.0)

    bm = bmesh.new()
    add_swept_curve(bm, [(0.0, -0.055, 0.0), (0.0, -0.002, 0.0)], [0.46, 0.48], segs=32, mat_idx=0)
    add_swept_curve(bm, [(0.0, -0.18, 0.0), (0.0, -0.055, 0.0)], [0.35, 0.45], segs=32, mat_idx=0)
    pavers = [
        (-0.17,  0.10, 0.28, 0.24,  0.04),
        ( 0.16,  0.10, 0.28, 0.24, -0.03),
        (-0.15, -0.14, 0.27, 0.22, -0.05),
        ( 0.15, -0.14, 0.27, 0.22,  0.03),
    ]
    for px, pz, pw, pd, ry in pavers:
        add_bevel_box(bm, (px, -0.008, pz), (pw, 0.022, pd), bevel=0.007, rot_t3=(0.0, ry, 0.0), mat_idx=1)

    moss_clusters = [
        (-0.34, 0.002, 0.16, 0.050), (-0.30, 0.004, 0.21, 0.034),
        ( 0.32, 0.002, 0.18, 0.046), ( 0.01, 0.001, -0.02, 0.036),
        (-0.22, 0.002, -0.28, 0.052), ( 0.25, 0.003, -0.25, 0.042),
    ]
    for mx, my, mz, mr in moss_clusters:
        add_ellipsoid(bm, (mx, my, mz), (mr * 1.25, 0.015, mr), u_segs=8, v_segs=5, mat_idx=2)

    return finalize_mesh_obj("StudioPedestal", bm, [mat_ped_stone, mat_ped_trim, mat_ped_moss])


def setup_studio_lighting_and_camera():
    scene = bpy.context.scene
    world = bpy.data.worlds.new("MoonlitStudioV3")
    scene.world = world
    world.use_nodes = True
    bg = world.node_tree.nodes.get("Background")
    wcol = hex_lin("#0b1326")
    bg.inputs[0].default_value = (wcol[0], wcol[1], wcol[2], 1.0)
    bg.inputs[1].default_value = 1.05

    def add_area_light(lname, pos_t3, target_t3, hex_c, power, size=1.6):
        ldata = bpy.data.lights.new(name=lname, type="AREA")
        ldata.color = hex_lin(hex_c)
        ldata.energy = power
        ldata.size = size
        lobj = bpy.data.objects.new(name=lname, object_data=ldata)
        lobj.location = v3(*pos_t3)
        direction = v3(*target_t3) - lobj.location
        lobj.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()
        bpy.context.collection.objects.link(lobj)
        return lobj

    # Soft Pixar overcast-moonlight key + generous warm eye/belly fill + seafoam rim (`reference_pogo_closeup.png`!)
    add_area_light("KeyMoon",      (-1.15, 1.75, 1.95), (0.0, 0.44, 0.0), "#eef6ff", 52.0, size=2.1)
    add_area_light("FillLantern",  ( 1.45, 1.05, 1.75), (0.0, 0.44, 0.0), "#fff0d8", 34.0, size=2.2)
    add_area_light("FrontEyeFill", ( 0.00, 0.62, 1.85), (0.0, 0.56, 0.0), "#f4f8ff", 16.0, size=1.8)
    add_area_light("RimCyanL",     (-1.35, 1.35, -1.40),(0.0, 0.46, 0.0), "#7efce8", 32.0, size=1.3)
    add_area_light("RimMoonR",     ( 1.35, 1.45, -1.40),(0.0, 0.46, 0.0), "#93c5fd", 28.0, size=1.3)

    scene.render.engine = "CYCLES"
    scene.cycles.device = "CPU"
    scene.cycles.samples = 36
    try:
        scene.cycles.use_denoising = True
        scene.cycles.denoiser = "OPENIMAGEDENOISE"
    except Exception:
        scene.cycles.use_denoising = False
    scene.cycles.max_bounces = 4
    try:
        scene.view_settings.view_transform = "Filmic"
        scene.view_settings.look = "Medium High Contrast"
    except Exception:
        pass
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA"
    scene.render.film_transparent = False

    cam_data = bpy.data.cameras.new("TurnaroundCam")
    cam_data.lens = 72.0
    cam_obj = bpy.data.objects.new("TurnaroundCam", cam_data)
    bpy.context.collection.objects.link(cam_obj)
    scene.camera = cam_obj
    return scene, cam_obj


def wire_pose_rig(pogo_root, parts):
    """
    Parents every V3.5 part onto the exact `PogoRig` joint hierarchy (`BASE_PELVIS_Y = 0.252`,
    `LEG_UPPER_LEN = 0.112`, `LEG_LOWER_LEN = 0.108`, `FOOT_SOLE_HEIGHT = 0.024`,
    narrow pear shoulders `(±0.096, 0.074, -0.004)`)!
    """
    j_pelvis = make_empty_node("j_pelvis", (0.0, 0.252, 0.0), parent=pogo_root)
    j_spine  = make_empty_node("j_spine",  (0.0, 0.034, 0.0), parent=j_pelvis)
    j_chest  = make_empty_node("j_chest",  (0.0, 0.070, 0.0), parent=j_spine)
    j_head   = make_empty_node("j_head",   (0.0, 0.096, 0.022), parent=j_chest)

    set_direct_parent(parts["belly"],    j_spine, (0.0, 0.0, 0.0))
    set_direct_parent(parts["torso"],    j_chest, (0.0, 0.0, 0.0))
    set_direct_parent(parts["harness"],  j_chest, (0.0, 0.0, 0.0))
    set_direct_parent(parts["backpack"], j_chest, (0.0, 0.072, -0.100))

    set_direct_parent(parts["head"],    j_head, (0.0, 0.0, 0.0))
    set_direct_parent(parts["crest"],   j_head, (0.0, 0.292, 0.002))
    set_direct_parent(parts["browL"],   j_head, ( 0.098, 0.248, 0.096))
    set_direct_parent(parts["browR"],   j_head, (-0.098, 0.242, 0.096))
    set_direct_parent(parts["eyeL"],    j_head, ( 0.098, 0.178, 0.096), (0.0,  0.18, 0.0))
    set_direct_parent(parts["eyeR"],    j_head, (-0.098, 0.178, 0.096), (0.0, -0.18, 0.0))
    set_direct_parent(parts["eyelidL"], j_head, ( 0.098, 0.178, 0.096), (0.0,  0.18, 0.0))
    set_direct_parent(parts["eyelidR"], j_head, (-0.098, 0.178, 0.096), (0.0, -0.18, 0.0))
    set_direct_parent(parts["jaw"],     j_head, (0.0, 0.030, 0.024))

    set_direct_parent(parts["upperArmL"], j_chest,            ( 0.096,  0.074, -0.004))
    set_direct_parent(parts["forearmL"],  parts["upperArmL"], ( 0.0,   -0.106,  0.0))
    set_direct_parent(parts["handL"],     parts["forearmL"],  ( 0.0,   -0.102,  0.0))

    set_direct_parent(parts["upperArmR"], j_chest,            (-0.096,  0.074, -0.004))
    set_direct_parent(parts["forearmR"],  parts["upperArmR"], ( 0.0,   -0.106,  0.0))
    set_direct_parent(parts["handR"],     parts["forearmR"],  ( 0.0,   -0.102,  0.0))
    set_direct_parent(parts["blaster"],   parts["handR"],     (-0.004, -0.032,  0.038))

    set_direct_parent(parts["thighL"], j_pelvis,        ( 0.068, -0.008, 0.004))
    set_direct_parent(parts["shinL"],  parts["thighL"], ( 0.0,   -0.112, 0.0))
    set_direct_parent(parts["footL"],  parts["shinL"],  ( 0.0,   -0.108, 0.0))

    set_direct_parent(parts["thighR"], j_pelvis,        (-0.068, -0.008, 0.004))
    set_direct_parent(parts["shinR"],  parts["thighR"], ( 0.0,   -0.112, 0.0))
    set_direct_parent(parts["footR"],  parts["shinR"],  ( 0.0,   -0.108, 0.0))

    bpy.context.view_layer.update()
    return j_pelvis, j_spine, j_chest, j_head


def apply_pogo_v3_reference_crouch(parts, j_pelvis, j_chest, j_head):
    """
    Poses Explorer Pogo V3.5 in the exact athletic diamond bow-legged frog crouch,
    natural downward-curled hands, curious ~8.3 deg head tilt, and cocked asymmetric brow
    of `reference_pogo_closeup.png`!
    """
    parts["eyelidL"].rotation_euler = rot3(-1.08,  0.18,  0.0)
    parts["eyelidR"].rotation_euler = rot3(-1.02, -0.18,  0.0)
    parts["browL"].rotation_euler   = rot3( 0.0,   0.0,   0.08)
    parts["browR"].rotation_euler   = rot3( 0.0,   0.0,  -0.14)
    parts["eyeL"].rotation_euler    = rot3(-0.03,  0.15, -0.06)
    parts["eyeR"].rotation_euler    = rot3(-0.03, -0.06, -0.06)
    parts["jaw"].rotation_euler     = rot3( 0.00,  0.0,   0.0)

    # True Diamond Frog Crouch + Curious ~8.3 deg (`+0.145 rad`) Head Cock!
    bend = 0.54
    drop = 0.040
    j_pelvis.location      = v3(0.0, 0.252 - drop, -0.010)
    j_chest.rotation_euler = rot3(0.05, -0.03, 0.02)
    j_head.rotation_euler  = rot3(0.04, -0.15, 0.145)

    parts["thighL"].rotation_euler = rot3(-bend,  0.40,  0.50)
    parts["shinL"].rotation_euler  = rot3( 0.98,  0.0,  -0.38)
    parts["footL"].rotation_euler  = rot3(-0.44,  0.32, -0.12)

    parts["thighR"].rotation_euler = rot3(-bend, -0.40, -0.50)
    parts["shinR"].rotation_euler  = rot3( 0.98,  0.0,   0.38)
    parts["footR"].rotation_euler  = rot3(-0.44, -0.32,  0.12)

    # Relaxed-ready outward-bent elbows & natural downward-curled amphibian fingers!
    parts["upperArmL"].rotation_euler = rot3( 0.10,  0.14,  0.48)
    parts["forearmL"].rotation_euler  = rot3(-0.56,  0.08,  0.14)
    parts["handL"].rotation_euler     = rot3(-0.06,  0.18, -0.16)

    parts["upperArmR"].rotation_euler = rot3( 0.08, -0.14, -0.48)
    parts["forearmR"].rotation_euler  = rot3(-0.58, -0.08, -0.14)
    parts["handR"].rotation_euler     = rot3(-0.06, -0.18,  0.16)

    return bend, drop


def render_pogo_v2_studio_suite():
    """
    Renders Explorer Pogo V3.5 Cycles SSS Studio Turnaround (`pogo_v3_hero_3q.png`,
    `pogo_v3_turnaround.png`, plus `pogo_hero_3q.png`, `pogo_turnaround.png`, `pogo_front.png`,
    `pogo_side.png`, `pogo_back.png`, and `pogo_action_blaster.png`)!
    """
    target_dirs = [d for d in (COORD_ARTIFACT_DIR, SELF_ARTIFACT_DIR) if os.path.isdir(os.path.dirname(d))]
    for d in target_dirs:
        os.makedirs(d, exist_ok=True)
    primary_dir = target_dirs[0] if target_dirs else OUT_MODELS_DIR

    pogo_root, parts, _ = build_pogo_scene(for_cycles_studio=True)
    j_pelvis, j_spine, j_chest, j_head = wire_pose_rig(pogo_root, parts)
    parts["blaster"].hide_render = True
    parts["belly"].hide_render = True
    parts["jaw"].hide_render = True
    bend, drop = apply_pogo_v3_reference_crouch(parts, j_pelvis, j_chest, j_head)

    bpy.context.view_layer.update()
    pedestal = build_studio_pedestal()
    scene, cam_obj = setup_studio_lighting_and_camera()

    views = [
        ("pogo_v3_hero_3q.png", 900, 1024, -0.14, 0.47, 2.04, 0.40),
        ("pogo_front.png",      760, 1024,  0.00, 0.47, 2.04, 0.40),
        ("pogo_side.png",       760, 1024,  1.48, 0.47, 2.04, 0.40),
        ("pogo_back.png",       760, 1024,  2.86, 0.47, 2.04, 0.40),
    ]

    rendered_paths = []
    for fname, rw, rh, yaw, cam_y, dist, look_y in views:
        pogo_root.rotation_euler = rot3(0.0, yaw, 0.0)
        pedestal.rotation_euler = rot3(0.0, yaw, 0.0)

        cam_obj.location = v3(0.0, cam_y, dist)
        look_vec = v3(0.0, look_y, 0.0) - cam_obj.location
        cam_obj.rotation_euler = look_vec.to_track_quat("-Z", "Y").to_euler()

        scene.render.resolution_x = rw
        scene.render.resolution_y = rh
        scene.render.resolution_percentage = 100
        out_path = os.path.join(primary_dir, fname)
        scene.render.filepath = out_path
        bpy.ops.render.render(write_still=True)
        rendered_paths.append(out_path)

    hero_alias = os.path.join(primary_dir, "pogo_hero_3q.png")
    shutil.copy2(rendered_paths[0], hero_alias)

    imgs = [bpy.data.images.load(p) for p in rendered_paths]
    total_w = sum(im.size[0] for im in imgs) + 20 * 5
    total_h = 1024 + 40
    sheet = bpy.data.images.new("PogoV3TurnaroundSheet", width=total_w, height=total_h, alpha=False)
    bg_srgb = (0.042, 0.068, 0.135, 1.0)
    sheet_px = list(bg_srgb) * (total_w * total_h)

    x_cursor = 20
    for im in imgs:
        iw, ih = im.size
        src = list(im.pixels)
        y_off = 20
        for row in range(ih):
            dst_idx = ((y_off + row) * total_w + x_cursor) * 4
            src_idx = (row * iw) * 4
            sheet_px[dst_idx : dst_idx + iw * 4] = src[src_idx : src_idx + iw * 4]
        x_cursor += iw + 20

    sheet.pixels = sheet_px
    v3_sheet_path = os.path.join(primary_dir, "pogo_v3_turnaround.png")
    sheet.filepath_raw = v3_sheet_path
    sheet.file_format = "PNG"
    sheet.save()

    legacy_sheet_path = os.path.join(primary_dir, "pogo_turnaround.png")
    shutil.copy2(v3_sheet_path, legacy_sheet_path)
    rendered_paths.extend([hero_alias, v3_sheet_path, legacy_sheet_path])

    # Action Cryo-Blaster Aim Portrait (`pogo_action_blaster.png`)
    pogo_root_b, parts_b, _ = build_pogo_scene(for_cycles_studio=True)
    j_pelvis_b, _, j_chest_b, j_head_b = wire_pose_rig(pogo_root_b, parts_b)
    parts_b["belly"].hide_render = True
    parts_b["jaw"].hide_render = True
    apply_pogo_v3_reference_crouch(parts_b, j_pelvis_b, j_chest_b, j_head_b)

    j_chest_b.rotation_euler = rot3(0.05, 0.16, 0.0)
    j_head_b.rotation_euler  = rot3(-0.02, 0.15, -0.03)
    parts_b["upperArmR"].rotation_euler = rot3(-1.18, 0.12, -0.22)
    parts_b["forearmR"].rotation_euler  = rot3(-0.26, 0.0,   0.0)
    parts_b["handR"].rotation_euler     = rot3( 1.32, 0.0,   0.06)

    bpy.context.view_layer.update()
    pedestal_b = build_studio_pedestal()
    scene_b, cam_b = setup_studio_lighting_and_camera()

    pogo_root_b.rotation_euler = rot3(0.0, -0.24, 0.0)
    pedestal_b.rotation_euler  = rot3(0.0, -0.24, 0.0)
    cam_b.location = v3(0.0, 0.47, 2.04)
    cam_b.rotation_euler = (v3(0.0, 0.40, 0.0) - cam_b.location).to_track_quat("-Z", "Y").to_euler()

    scene_b.render.resolution_x = 900
    scene_b.render.resolution_y = 1024
    act_path = os.path.join(primary_dir, "pogo_action_blaster.png")
    scene_b.render.filepath = act_path
    bpy.ops.render.render(write_still=True)
    rendered_paths.append(act_path)

    for d in target_dirs[1:]:
        for p in rendered_paths:
            shutil.copy2(p, os.path.join(d, os.path.basename(p)))

    return rendered_paths


# ==============================================================================
# 6. ASSETS 2–10: MOBILE-OPTIMIZED REBOOT ENEMIES, VEHICLES & PROPS
# ==============================================================================

def assign_box_uvs(bm, scale=1.5):
    uv_layer = bm.loops.layers.uv.verify()
    bm.faces.ensure_lookup_table()
    for f in bm.faces:
        n = f.normal
        ax, ay, az = abs(n.x), abs(n.y), abs(n.z)
        for loop in f.loops:
            tx, ty, tz = b2t(loop.vert.co)
            if az >= ax and az >= ay:
                u, v = tx * scale, tz * scale
            elif ax >= ay:
                u, v = tz * scale, ty * scale
            else:
                u, v = tx * scale, ty * scale
            loop[uv_layer].uv = (u, v)


def build_enemy_eye():
    """
    Upgraded `#212` Tendril-Eyeball Monster matching `media_1794884512715_2296550d.jpg`:
    - Heroic `~1.4x` root scale (`EnemyEyeRoot.scale = 1.38`), while keeping child node local
      radii (`r = 0.270`) calibrated 1:1 with `src/enemyRig.js` sockets & cornea glints!
    - Matte-wet warm bone-ivory veined sclera (`256x256` branching crimson veins),
    - Front tarnished-bronze iris bezel ring + rear bronze socket harness (`mat_metal`),
    - Luminous striated turquoise-cyan iris (`256x256` radial fiber map) + obsidian pupil,
    - 6 sinuous multi-jointed organic crimson tendrils (`tendril_1..6`).
    """
    reset_scene()
    sclera_alb, sclera_nrm = create_sclera_vein_maps(256)
    iris_alb = create_eye_monster_iris_map(256)

    mat_sclera = make_mat(
        "mat_sclera", "#ebe5dc", roughness=0.25, metallic=0.0, coat=0.76, coat_rough=0.10,
        albedo_img=sclera_alb, normal_img=sclera_nrm, normal_strength=0.78, uv_scale=1.0
    )
    mat_iris = make_mat(
        "mat_iris", "#24e8f8", roughness=0.07, metallic=0.08, coat=1.0, coat_rough=0.02,
        albedo_img=iris_alb, emission_hex="#1fe6ff", emission_strength=2.25, uv_scale=1.0
    )
    mat_pupil = make_mat("mat_pupil", "#03050a", roughness=0.02, metallic=0.08, coat=1.0, coat_rough=0.01)
    mat_tendril = make_mat("mat_tendril", "#841427", roughness=0.28, metallic=0.04, coat=0.78, coat_rough=0.12)
    mat_metal = make_mat("mat_metal", "#6e5434", roughness=0.33, metallic=0.88)

    eye_root = make_empty_node("EnemyEyeRoot", (0.0, 0.0, 0.0))
    eye_root.scale = (1.38, 1.38, 1.38)

    # 1. Matte-wet veined warm-ivory sclera + 6 raised organic crimson vein trunks
    bm = bmesh.new()
    add_ellipsoid(bm, (0.0, 0.0, 0.0), (0.270, 0.264, 0.268), u_segs=18, v_segs=12, mat_idx=0)
    for vi in range(6):
        va = (2.0 * math.pi * vi) / 6.0 + 0.28
        v_pts = []
        for st in range(5):
            t = st / 4.0
            phi = -0.38 * math.pi + t * 0.62 * math.pi
            wob = math.sin(t * 5.5 + vi * 1.3) * 0.16
            r = 0.268
            v_pts.append((r * math.cos(phi) * math.cos(va + wob), r * math.cos(phi) * math.sin(va + wob), r * math.sin(phi)))
        add_swept_curve(bm, v_pts, [0.015, 0.012, 0.009, 0.006, 0.003], segs=4, mat_idx=1)

    # Polar cornea-to-socket UVs (`v = 1` at `+Z` front cornea, `v = 0` at `-Z` rear socket)
    uv_layer = bm.loops.layers.uv.verify()
    for f in bm.faces:
        cx, cy, cz = b2t(f.calc_center_median())
        pu = 0.5 + math.atan2(cy, cx) / (2.0 * math.pi)
        for loop in f.loops:
            tx, ty, tz = b2t(loop.vert.co)
            rr = max(1e-5, math.sqrt(tx * tx + ty * ty + tz * tz))
            u = 0.5 + math.atan2(ty, tx) / (2.0 * math.pi)
            if u - pu > 0.5:
                u -= 1.0
            elif pu - u > 0.5:
                u += 1.0
            v = clamp01((tz / rr) * 0.5 + 0.5)
            loop[uv_layer].uv = (u, v)
    finalize_mesh_obj("sclera", bm, [mat_sclera, mat_tendril], parent=eye_root, decimate_ratio=0.52, keep_custom_uvs=True)

    # 2. Luminous striated turquoise-cyan iris with concentric planar UVs
    bm = bmesh.new()
    add_ellipsoid(bm, (0.0, 0.0, 0.188), (0.148, 0.148, 0.092), u_segs=16, v_segs=8, mat_idx=0)
    uv_i = bm.loops.layers.uv.verify()
    for f in bm.faces:
        for loop in f.loops:
            tx, ty, _ = b2t(loop.vert.co)
            loop[uv_i].uv = (clamp01(0.5 + tx / 0.305), clamp01(0.5 + ty / 0.305))
    finalize_mesh_obj("iris", bm, mat_iris, parent=eye_root, decimate_ratio=0.72, keep_custom_uvs=True)

    # 3. Deep velvet-obsidian pupil
    bm = bmesh.new()
    add_ellipsoid(bm, (0.0, 0.0, 0.232), (0.074, 0.074, 0.060), u_segs=12, v_segs=6, mat_idx=0)
    finalize_mesh_obj("pupil", bm, mat_pupil, parent=eye_root, decimate_ratio=0.78)

    # 4. Tarnished-bronze front iris optic bezel + rear equatorial socket harness (`mat_metal`)
    bm = bmesh.new()
    bezel_pts = [
        (math.cos((2.0 * math.pi * k) / 16.0) * 0.156, math.sin((2.0 * math.pi * k) / 16.0) * 0.156, 0.205)
        for k in range(17)
    ]
    add_swept_curve(bm, bezel_pts, (0.017, 0.020), segs=6, mat_idx=0)
    rear_ring = [
        (math.cos((2.0 * math.pi * k) / 16.0) * 0.264, math.sin((2.0 * math.pi * k) / 16.0) * 0.264, -0.048)
        for k in range(17)
    ]
    add_swept_curve(bm, rear_ring, (0.024, 0.028), segs=6, mat_idx=0)
    for sx in (-1.0, 1.0):
        add_swept_curve(bm, [(sx * 0.228, 0.0, -0.03), (sx * 0.288, 0.0, -0.03)], [0.076, 0.062], segs=8, mat_idx=0)
        add_ellipsoid(bm, (sx * 0.292, 0.0, -0.03), (0.018, 0.042, 0.042), u_segs=8, v_segs=5, mat_idx=1)
    for sy in (-1.0, 1.0):
        arc_pts = [(-0.258, sy * 0.04, -0.03), (-0.16, sy * 0.22, -0.04), (0.0, sy * 0.268, -0.05), (0.16, sy * 0.22, -0.04), (0.258, sy * 0.04, -0.03)]
        add_swept_curve(bm, arc_pts, (0.019, 0.012), segs=5, mat_idx=0)
    finalize_mesh_obj("harness_ring", bm, [mat_metal, mat_iris], parent=eye_root, decimate_ratio=0.58)

    # 5. 6 sinuous multi-jointed organic crimson creeping tendrils
    tendril_specs = [
        (-0.19, -0.10, -0.13, -0.39, -0.33, -0.04),
        (-0.23, 0.05, -0.11, -0.47, -0.24, -0.16),
        (-0.14, 0.19, -0.15, -0.33, 0.34, -0.27),
        (0.19, -0.10, -0.13, 0.39, -0.33, -0.04),
        (0.23, 0.05, -0.11, 0.47, -0.24, -0.16),
        (0.11, -0.20, -0.11, 0.21, -0.34, 0.09),
    ]
    for idx, (x0, y0, z0, x2, y2, z2) in enumerate(tendril_specs, start=1):
        bm = bmesh.new()
        sx = 1.0 if x0 >= 0 else -1.0
        xm = (x0 + x2) * 0.54 + 0.065 * sx
        ym = (y0 + y2) * 0.40 + 0.055
        zm = (z0 + z2) * 0.48 - 0.065
        xk = x0 + (x2 - x0) * 0.80 + 0.03 * sx
        yk = y0 + (y2 - y0) * 0.72 - 0.02
        zk = z0 + (z2 - z0) * 0.78
        pts = [
            (0.0, 0.0, 0.0),
            ((xm - x0) * 0.52, (ym - y0) * 0.52, (zm - z0) * 0.52),
            (xm - x0, ym - y0, zm - z0),
            (xk - x0, yk - y0, zk - z0),
            (x2 - x0, y2 - y0, z2 - z0),
        ]
        add_swept_curve(bm, pts, [0.040, 0.031, 0.022, 0.013, 0.005], segs=5, mat_idx=0)
        finalize_mesh_obj(f"tendril_{idx}", bm, mat_tendril, pos=(x0, y0, z0), parent=eye_root)

    return export_glb_and_inspect(os.path.join(OUT_MODELS_DIR, "enemy_eye.glb"))


def add_chiseled_crystal(bm, dir_t3, length, base_r, offset=0.05, mat_idx=0):
    d = Vector(dir_t3).normalized()
    up = Vector((0.0, 1.0, 0.0)) if abs(d.y) < 0.85 else Vector((1.0, 0.0, 0.0))
    u = d.cross(up).normalized()
    v = d.cross(u).normalized()
    p_base, p_shld, p_tip = d * offset, d * (offset + length * 0.66), d * (offset + length)
    r0, r1, r2 = [], [], []
    for s in range(6):
        a = (2.0 * math.pi * s) / 6 + 0.25
        rv = u * math.cos(a) + v * math.sin(a)
        p0, p1, p2 = p_base + rv * (base_r * 0.82), p_shld + rv * base_r, p_tip + rv * 0.004
        r0.append((p0.x, p0.y, p0.z))
        r1.append((p1.x, p1.y, p1.z))
        r2.append((p2.x, p2.y, p2.z))
    add_loft_rings(bm, [r0, r1, r2], closed=True, cap_start=True, cap_end=True, mat_idx=mat_idx)


def add_faceted_jewel_chunk(bm, center_t3, axis_t3, len_out, len_in, rx, ry, sides=6, twist=0.22, mat_idx=0):
    """
    Razor-sharp flat-shaded polyhedral amethyst crystal bipyramid chunk matching
    the lower-right diamond crystal cluster in `media_1794884512715_2296550d.jpg`.
    """
    c = Vector(center_t3)
    d = Vector(axis_t3).normalized()
    up = Vector((0.0, 1.0, 0.0)) if abs(d.y) < 0.85 else Vector((1.0, 0.0, 0.0))
    u = d.cross(up).normalized()
    v = d.cross(u).normalized()

    p_in = c - d * len_in
    p_low = c - d * (len_in * 0.25)
    p_high = c + d * (len_out * 0.48)
    p_tip = c + d * len_out

    rings = []
    for p_ctr, sc, tw in ((p_in, 0.06, 0.0), (p_low, 0.86, 0.08), (p_high, 1.0, twist), (p_tip, 0.04, twist + 0.12)):
        ring = []
        for s in range(sides):
            a = (2.0 * math.pi * s) / sides + tw
            asym = 1.0 + 0.12 * math.sin(s * 2.3 + twist * 4.0)
            rv = u * (math.cos(a) * rx * sc * asym) + v * (math.sin(a) * ry * sc * asym)
            pt = p_ctr + rv
            ring.append((pt.x, pt.y, pt.z))
        rings.append(ring)
    add_loft_rings(bm, rings, closed=True, cap_start=True, cap_end=True, mat_idx=mat_idx)


def build_enemy_molecule():
    """
    Upgraded `#212` Amethyst Crystal Cluster (`media_1794884512715_2296550d.jpg` lower-right):
    Tight diamond/octahedral constellation of chunky, razor-faceted dark-violet amethyst
    shards hovering around an incandescent white-magenta core visible right through the front!
    """
    reset_scene()
    mat_crystal = make_mat(
        "mat_crystal", "#3b1170", roughness=0.11, metallic=0.16, coat=0.95, coat_rough=0.03,
        emission_hex="#6b21a8", emission_strength=0.38
    )
    mat_core = make_mat("mat_core", "#fff2ff", roughness=0.05, emission_hex="#ff5cff", emission_strength=3.80)
    mol_root = make_empty_node("MoleculeRoot", (0.0, 0.0, 0.0))

    bm_core = bmesh.new()
    add_ellipsoid(bm_core, (0.0, 0.0, 0.02), (0.148, 0.148, 0.148), u_segs=16, v_segs=12, mat_idx=0)
    finalize_mesh_obj("core", bm_core, mat_core, parent=mol_root, smooth=True)

    bm_crys = bmesh.new()
    # 6 Primary chunky diamond-constellation faceted shards (leaving front `+Z` window open to `core`!)
    primary_chunks = [
        ((0.00, 0.215, 0.01), (0.05, 1.00, 0.12), 0.165, 0.085, 0.115, 0.095, 6, 0.18),   # Top crown peak
        ((0.00, -0.215, -0.01), (-0.04, -1.00, 0.10), 0.160, 0.085, 0.110, 0.092, 6, 0.42), # Bottom keel peak
        ((-0.235, 0.015, 0.02), (-1.00, 0.08, 0.18), 0.165, 0.085, 0.108, 0.096, 6, 0.30),  # Left wing shard
        ((0.235, -0.015, 0.02), (1.00, -0.08, 0.18), 0.165, 0.085, 0.108, 0.096, 6, -0.26), # Right wing shard
        ((-0.11, 0.11, -0.175), (-0.45, 0.48, -0.88), 0.145, 0.075, 0.105, 0.090, 5, 0.55), # Upper-rear shard
        ((0.11, -0.11, -0.175), (0.45, -0.48, -0.88), 0.145, 0.075, 0.105, 0.090, 5, 0.15),  # Lower-rear shard
    ]
    # 6 Smaller faceted satellite crystal teeth framing the incandescent core
    secondary_chunks = [
        ((-0.145, 0.145, 0.085), (-0.68, 0.68, 0.36), 0.105, 0.055, 0.068, 0.058, 5, 0.12),
        ((0.148, 0.140, 0.080), (0.70, 0.65, 0.34), 0.102, 0.055, 0.066, 0.056, 5, 0.44),
        ((-0.142, -0.145, 0.082), (-0.66, -0.68, 0.35), 0.100, 0.055, 0.065, 0.056, 5, 0.28),
        ((0.145, -0.140, 0.085), (0.68, -0.66, 0.36), 0.104, 0.055, 0.068, 0.058, 5, -0.18),
        ((0.12, 0.12, -0.15), (0.52, 0.52, -0.68), 0.110, 0.060, 0.074, 0.064, 5, 0.35),
        ((-0.12, -0.12, -0.15), (-0.52, -0.52, -0.68), 0.110, 0.060, 0.074, 0.064, 5, -0.35),
    ]
    for cpos, cdir, lout, lin, crx, cry, csides, ctw in primary_chunks + secondary_chunks:
        add_faceted_jewel_chunk(bm_crys, cpos, cdir, lout, lin, crx, cry, sides=csides, twist=ctw, mat_idx=0)
    finalize_mesh_obj("crystal_cluster", bm_crys, mat_crystal, parent=mol_root, smooth=False)
    return export_glb_and_inspect(os.path.join(OUT_MODELS_DIR, "enemy_molecule.glb"))


def build_enemy_roller():
    reset_scene()
    mat_iron = make_mat("mat_iron", "#353c4b", roughness=0.34, metallic=0.86)
    mat_brass = make_mat("mat_brass", "#c8963e", roughness=0.28, metallic=0.88)
    mat_furnace = make_mat("mat_furnace", "#ffb020", roughness=0.15, emission_hex="#ff7b00", emission_strength=2.6)

    root = make_empty_node("RollerRoot", (0.0, 0.0, 0.0))
    bm = bmesh.new()
    add_ellipsoid(bm, (0.0, 0.0, 0.0), (0.232, 0.232, 0.232), u_segs=14, v_segs=10, mat_idx=2)
    for hemi_sign in (1.0, -1.0):
        rings = []
        for iv in range(4):
            phi = (0.13 + (iv / 3.0) * 0.35) * math.pi * hemi_sign
            cphi, sphi = math.cos(phi), math.sin(phi)
            rings.append([(0.268 * cphi * math.cos((2.0 * math.pi * iu) / 14), 0.268 * sphi, 0.268 * cphi * math.sin((2.0 * math.pi * iu) / 14)) for iu in range(14)])
        if hemi_sign < 0:
            rings.reverse()
        add_loft_rings(bm, rings, closed=True, cap_start=(hemi_sign < 0), cap_end=(hemi_sign > 0), mat_idx=0)
    for k in range(6):
        th = (2.0 * math.pi * k) / 6
        add_bevel_box(bm, (math.cos(th) * 0.258, 0.0, math.sin(th) * 0.258), (0.036, 0.095, 0.036), bevel=0.004, rot_t3=(0.0, -th, 0.0), mat_idx=1)
    for sz in (-0.255, 0.255):
        add_swept_curve(bm, [(0.0, 0.0, sz * 0.85), (0.0, 0.0, sz * 1.08)], 0.068, segs=8, mat_idx=1)
    finalize_mesh_obj("roller_ball", bm, [mat_iron, mat_brass, mat_furnace], parent=root, decimate_ratio=0.72)
    return export_glb_and_inspect(os.path.join(OUT_MODELS_DIR, "enemy_roller.glb"))


def build_enemy_bouncer():
    reset_scene()
    mat_spore = make_mat("mat_spore", "#84cc16", roughness=0.18, metallic=0.04, coat=0.85, coat_rough=0.08, emission_hex="#65a30d", emission_strength=0.95)
    mat_iron = make_mat("mat_iron", "#333b4a", roughness=0.36, metallic=0.84)
    mat_brass = make_mat("mat_brass", "#ca9a42", roughness=0.28, metallic=0.86)
    mat_core = make_mat("mat_core", "#ecfccb", roughness=0.10, emission_hex="#bef264", emission_strength=2.2)

    root = make_empty_node("BouncerRoot", (0.0, 0.0, 0.0))
    bm = bmesh.new()
    add_ellipsoid(bm, (0.0, 0.045, 0.0), (0.245, 0.215, 0.245), u_segs=14, v_segs=10, mat_idx=0)
    for na in range(4):
        ang = (2.0 * math.pi * na) / 4.0
        add_ellipsoid(bm, (math.cos(ang) * 0.135, 0.185, math.sin(ang) * 0.135), (0.044, 0.036, 0.044), u_segs=8, v_segs=5, mat_idx=1)
    add_ellipsoid(bm, (0.0, 0.238, 0.0), (0.056, 0.042, 0.056), u_segs=8, v_segs=5, mat_idx=1)
    finalize_mesh_obj("spore_sac", bm, [mat_spore, mat_core], parent=root, decimate_ratio=0.75)

    bm_base = bmesh.new()
    add_swept_curve(bm_base, [(0.0, -0.095, 0.0), (0.0, -0.025, 0.0)], [0.215, 0.235], segs=12, mat_idx=1)
    coil_pts = [(math.cos((s / 14.0) * math.pi * 4.0) * (0.145 - (s / 14.0) * 0.025), -0.085 - (s / 14.0) * 0.155, math.sin((s / 14.0) * math.pi * 4.0) * (0.145 - (s / 14.0) * 0.025)) for s in range(15)]
    add_swept_curve(bm_base, coil_pts, 0.022, segs=5, mat_idx=1)
    for ca in range(4):
        ang = (2.0 * math.pi * ca) / 4.0 + 0.78
        cx, cz = math.cos(ang), math.sin(ang)
        add_swept_curve(bm_base, [(cx * 0.19, -0.07, cz * 0.19), (cx * 0.26, -0.15, cz * 0.26), (cx * 0.21, -0.25, cz * 0.21)], [0.028, 0.020, 0.008], segs=5, mat_idx=0)
    finalize_mesh_obj("base_claws", bm_base, [mat_iron, mat_brass], parent=root, decimate_ratio=0.72)
    return export_glb_and_inspect(os.path.join(OUT_MODELS_DIR, "enemy_bouncer.glb"))


def build_enemy_robot():
    reset_scene()
    mat_brass = make_mat("mat_brass", "#c28e3a", roughness=0.28, metallic=0.88)
    mat_iron = make_mat("mat_iron", "#323947", roughness=0.35, metallic=0.85)
    mat_visor = make_mat("mat_visor", "#ff2a4b", roughness=0.10, emission_hex="#ff1e42", emission_strength=2.8)
    mat_thruster = make_mat("mat_thruster", "#38bdf8", roughness=0.12, emission_hex="#0ea5e9", emission_strength=2.2)

    root = make_empty_node("RobotRoot", (0.0, 0.0, 0.0))
    bm = bmesh.new()
    add_swept_curve(bm, [(0.0, -0.18, 0.0), (0.0, -0.06, 0.0), (0.0, 0.08, 0.0), (0.0, 0.20, 0.0), (0.0, 0.26, 0.0)], [0.14, 0.23, 0.24, 0.19, 0.09], segs=12, mat_idx=0)
    add_swept_curve(bm, [(0.0, 0.03, 0.0), (0.0, 0.13, 0.0)], [0.225, 0.225], segs=12, mat_idx=1)
    for sx in (-1.0, 1.0):
        add_ellipsoid(bm, (sx * 0.24, 0.06, 0.0), (0.065, 0.085, 0.095), u_segs=8, v_segs=6, mat_idx=1)
        add_swept_curve(bm, [(sx * 0.25, 0.02, 0.02), (sx * 0.29, -0.08, 0.08), (sx * 0.23, -0.16, 0.14)], [0.026, 0.020, 0.010], segs=5, mat_idx=0)
    finalize_mesh_obj("body", bm, [mat_brass, mat_iron], parent=root, decimate_ratio=0.75)

    bm_v = bmesh.new()
    add_swept_curve(bm_v, [(-0.165, 0.08, 0.165), (-0.085, 0.08, 0.222), (0.0, 0.08, 0.242), (0.085, 0.08, 0.222), (0.165, 0.08, 0.165)], (0.018, 0.032), segs=6, mat_idx=0)
    finalize_mesh_obj("visor", bm_v, mat_visor, parent=root)

    bm_g = bmesh.new()
    add_swept_curve(bm_g, [(0.0, 0.25, 0.0), (0.0, 0.30, 0.0)], [0.11, 0.11], segs=10, mat_idx=0)
    for t in range(6):
        ang = (2.0 * math.pi * t) / 6.0
        add_bevel_box(bm_g, (math.cos(ang) * 0.125, 0.275, math.sin(ang) * 0.125), (0.036, 0.034, 0.036), bevel=0.004, rot_t3=(0.0, -ang, 0.0), mat_idx=0)
    finalize_mesh_obj("rotor_top", bm_g, mat_brass, parent=root, decimate_ratio=0.65)

    bm_r = bmesh.new()
    add_swept_curve(bm_r, [(0.0, -0.25, 0.0), (0.0, -0.17, 0.0)], [0.095, 0.145], segs=10, mat_idx=0)
    add_ellipsoid(bm_r, (0.0, -0.25, 0.0), (0.082, 0.032, 0.082), u_segs=10, v_segs=5, mat_idx=1)
    finalize_mesh_obj("rotor_bot", bm_r, [mat_iron, mat_thruster], parent=root, decimate_ratio=0.75)
    return export_glb_and_inspect(os.path.join(OUT_MODELS_DIR, "enemy_robot.glb"))


def build_mk7_sub():
    reset_scene()
    mat_hull = make_mat("mat_hull", "#cbd5e1", roughness=0.24, metallic=0.76, coat=0.45, coat_rough=0.12)
    mat_navy = make_mat("mat_navy", "#16354d", roughness=0.34, metallic=0.58)
    mat_brass = make_mat("mat_brass", "#d49b3d", roughness=0.24, metallic=0.88)
    mat_glass = make_mat("mat_glass", "#7dd3fc", roughness=0.05, metallic=0.08, coat=1.0, alpha=0.58)
    mat_glow = make_mat("mat_glow", "#38bdf8", roughness=0.10, emission_hex="#38bdf8", emission_strength=2.2)
    mat_pogo = make_mat("mat_pogo", "#58b947", roughness=0.36, metallic=0.02)

    sub_root = make_empty_node("Mk7SubRoot", (0.0, 0.0, 0.0))
    bm = bmesh.new()
    hull_stations = [
        (-0.80, 0.055, 0.055), (-0.66, 0.175, 0.165), (-0.42, 0.310, 0.285), (-0.12, 0.385, 0.355),
        (0.22, 0.395, 0.365), (0.52, 0.325, 0.300), (0.74, 0.195, 0.185), (0.84, 0.065, 0.065),
    ]
    rings = [[(x, math.sin((2.0 * math.pi * s) / 18) * ry, math.cos((2.0 * math.pi * s) / 18) * rz) for s in range(18)] for x, ry, rz in hull_stations]
    add_loft_rings(bm, rings, closed=True, cap_start=True, cap_end=True, mat_idx=0)
    add_swept_curve(bm, [(0.14, 0.24, 0.0), (0.14, 0.36, 0.0)], [0.275, 0.255], segs=14, mat_idx=2)
    for sz in (-1.0, 1.0):
        add_swept_curve(bm, [(-0.26, -0.08, sz * 0.34), (0.42, -0.08, sz * 0.34)], 0.068, segs=8, mat_idx=1)
        add_ellipsoid(bm, (0.43, -0.08, sz * 0.34), (0.025, 0.052, 0.052), u_segs=8, v_segs=5, mat_idx=3)
        add_bevel_box(bm, (0.05, -0.02, sz * 0.44), (0.28, 0.026, 0.22), bevel=0.005, rot_t3=(0.0, 0.18 * sz, 0.08), mat_idx=1)
    add_bevel_box(bm, (-0.60, 0.23, 0.0), (0.30, 0.34, 0.036), bevel=0.006, rot_t3=(0.0, 0.0, -0.28), mat_idx=1)
    add_bevel_box(bm, (-0.60, -0.19, 0.0), (0.24, 0.24, 0.032), bevel=0.006, rot_t3=(0.0, 0.0, 0.24), mat_idx=1)
    add_swept_curve(bm, [(-0.83, 0.0, 0.0), (-0.75, 0.0, 0.0)], 0.088, segs=10, mat_idx=2)
    add_swept_curve(bm, [(0.74, 0.04, 0.0), (0.88, 0.04, 0.0)], [0.095, 0.105], segs=10, mat_idx=2)
    add_ellipsoid(bm, (0.885, 0.04, 0.0), (0.025, 0.088, 0.088), u_segs=10, v_segs=6, mat_idx=3)
    finalize_mesh_obj("hull", bm, [mat_hull, mat_navy, mat_brass, mat_glow], parent=sub_root)

    bm_d = bmesh.new()
    add_ellipsoid(bm_d, (0.14, 0.34, 0.0), (0.245, 0.225, 0.235), u_segs=16, v_segs=10, mat_idx=0, hemi_top_only=True)
    finalize_mesh_obj("dome", bm_d, mat_glass, parent=sub_root)

    bm_p = bmesh.new()
    add_ellipsoid(bm_p, (0.15, 0.39, 0.0), (0.115, 0.105, 0.115), u_segs=10, v_segs=8, mat_idx=0)
    add_ellipsoid(bm_p, (0.21, 0.43, 0.065), (0.035, 0.038, 0.035), u_segs=8, v_segs=5, mat_idx=1)
    add_ellipsoid(bm_p, (0.21, 0.43, -0.065), (0.035, 0.038, 0.035), u_segs=8, v_segs=5, mat_idx=1)
    finalize_mesh_obj("pilot", bm_p, [mat_pogo, mat_glow], parent=sub_root)

    bm_prop = bmesh.new()
    add_swept_curve(bm_prop, [(-0.05, 0.0, 0.0), (0.04, 0.0, 0.0)], [0.042, 0.058], segs=8, mat_idx=0)
    for b in range(4):
        ang = (2.0 * math.pi * b) / 4.0
        add_bevel_box(bm_prop, (0.0, math.cos(ang) * 0.145, math.sin(ang) * 0.145), (0.022, 0.22, 0.075), bevel=0.004, rot_t3=(ang, 0.42 * math.cos(ang), 0.42 * math.sin(ang)), mat_idx=0)
    finalize_mesh_obj("propeller", bm_prop, mat_brass, pos=(-0.84, 0.0, 0.0), parent=sub_root)
    return export_glb_and_inspect(os.path.join(OUT_MODELS_DIR, "mk7_sub.glb"))


def build_hydro_skimmer():
    """
    Upgraded `#210` Next-Gen Gunmetal & Burnished-Brass Riveted Storm Hydro-Skimmer:
    Replaces V1 white gelcoat with dark storm-gunmetal riveted plating, burnished-brass
    strakes/cockpit coaming, armoured slate hydrofoil outriggers, and twin brass plasma cowlings!
    """
    reset_scene()
    hull_nrm = create_riveted_hull_normal_img(128)
    mat_hull = make_mat(
        "mat_hull", "#222c3d", roughness=0.26, metallic=0.84, coat=0.45, coat_rough=0.14,
        normal_img=hull_nrm, normal_strength=0.52, uv_scale=3.0
    )
    mat_trim = make_mat("mat_trim", "#152238", roughness=0.34, metallic=0.76, normal_img=hull_nrm, normal_strength=0.35, uv_scale=2.0)
    mat_brass = make_mat("mat_brass", "#cf9638", roughness=0.24, metallic=0.90)
    mat_glow = make_mat("mat_glow", "#42f0ff", roughness=0.08, emission_hex="#22e6ff", emission_strength=2.8)
    mat_glass = make_mat("mat_glass", "#5eead4", roughness=0.05, metallic=0.12, coat=1.0, alpha=0.42)

    root = make_empty_node("HydroSkimmerRoot", (0.0, 0.0, 0.0))
    bm = bmesh.new()
    sk_stations = [
        (-1.04, 0.04, 0.035, 0.035, 0.025), (-0.70, 0.04, 0.185, 0.105, 0.080),
        (-0.28, 0.045, 0.305, 0.115, 0.110), (0.20, 0.045, 0.335, 0.105, 0.120),
        (0.60, 0.065, 0.305, 0.135, 0.110), (0.86, 0.080, 0.235, 0.115, 0.090),
    ]
    rings = []
    for z, yc, rx, ryt, ryb in sk_stations:
        ring = []
        for s in range(16):
            a = (2.0 * math.pi * s) / 16
            ca, sa = math.cos(a), math.sin(a)
            keel = -0.035 * max(0.0, -sa - 0.25)
            ry = ryt if sa >= 0.0 else ryb
            ring.append((ca * rx, yc + sa * ry + keel, z))
        rings.append(ring)
    add_loft_rings(bm, rings, closed=True, cap_start=True, cap_end=True, mat_idx=0)
    # Central burnished-brass nose spine & cockpit coaming ring
    add_swept_curve(bm, [(0.0, 0.125, -0.96), (0.0, 0.155, -0.62), (0.0, 0.160, -0.38)], [0.016, 0.024, 0.022], segs=6, mat_idx=2)
    coam_pts = [
        (-0.22, 0.14, 0.24), (-0.23, 0.145, -0.26), (0.0, 0.155, -0.40),
        (0.23, 0.145, -0.26), (0.22, 0.14, 0.24),
    ]
    add_swept_curve(bm, coam_pts, (0.022, 0.018), segs=6, mat_idx=2)
    for sx in (-1.0, 1.0):
        # Swept hydrofoil outrigger struts & armoured sponsons + brass strakes + plasma chine vents
        add_swept_curve(bm, [(sx * 0.26, 0.05, 0.02), (sx * 0.46, 0.00, 0.10), (sx * 0.58, -0.04, 0.18)], [(0.024, 0.072), (0.020, 0.060), (0.018, 0.050)], segs=8, mat_idx=1)
        add_swept_curve(bm, [(sx * 0.58, -0.04, -0.36), (sx * 0.58, -0.05, 0.14), (sx * 0.58, -0.03, 0.60)], [(0.024, 0.024), (0.074, 0.054), (0.046, 0.040)], segs=10, mat_idx=1)
        add_swept_curve(bm, [(sx * 0.58, 0.005, -0.28), (sx * 0.58, 0.008, 0.50)], 0.014, segs=6, mat_idx=2)
        add_swept_curve(bm, [(sx * 0.625, -0.03, -0.24), (sx * 0.625, -0.03, 0.48)], 0.014, segs=6, mat_idx=3)
        add_swept_curve(bm, [(sx * 0.19, 0.095, -0.46), (sx * 0.15, 0.095, -0.92)], [0.028, 0.018], segs=8, mat_idx=2)
    assign_box_uvs(bm, scale=1.6)
    finalize_mesh_obj("hull", bm, [mat_hull, mat_trim, mat_brass, mat_glow], parent=root, decimate_ratio=0.82, keep_custom_uvs=True)

    bm_c = bmesh.new()
    add_bevel_box(bm_c, (0.0, 0.19, -0.34), (0.36, 0.12, 0.24), bevel=0.02, rot_t3=(-0.52, 0.0, 0.0), mat_idx=0)
    finalize_mesh_obj("cockpit", bm_c, mat_glass, parent=root)

    for tname, sx in (("thrusterL", -0.15), ("thrusterR", 0.15)):
        bm_t = bmesh.new()
        add_swept_curve(bm_t, [(0.0, 0.0, -0.14), (0.0, 0.0, 0.02), (0.0, 0.0, 0.14)], [0.088, 0.112, 0.102], segs=12, mat_idx=0)
        add_swept_curve(bm_t, [(0.0, 0.0, 0.08), (0.0, 0.0, 0.145)], [0.108, 0.114], segs=12, mat_idx=2)
        add_ellipsoid(bm_t, (0.0, 0.0, 0.13), (0.082, 0.082, 0.036), u_segs=12, v_segs=6, mat_idx=1)
        finalize_mesh_obj(tname, bm_t, [mat_hull, mat_glow, mat_brass], pos=(sx, 0.09, 0.80), parent=root, decimate_ratio=0.80)

    return export_glb_and_inspect(os.path.join(OUT_MODELS_DIR, "hydro_skimmer.glb"))


def build_corbel_ledge():
    """
    Upgraded `#210` / `#212` Weathered Romanesque Corbel Ledge matching `media_1794884512715_2296550d.jpg`:
    - Irregular hand-hewn 3-flagstone walkway slab (`flagstone_slab`, `y_top = +0.105`) with
      chiseled stone bed (`mat_stone`) and damp slate flagstone caps (`mat_stone_top`),
    - Smooth concave S-scroll **Romanesque tapered stone corbel bracket** (`corbel_brackets`,
      `mat_stone` — automatically instanced on every solid ledge by `towerArchitecture.js`!)
      sweeping from `(z=-0.32, y=-0.42)` up to `(z=+0.24, y=-0.02)` with chiseled abacus molding,
    - Draped 3D emerald moss clumps & coastal barnacles (`moss_clumps`, `mat_moss`).
    """
    reset_scene()
    stone_nrm = create_stone_normal_img(256)
    mat_stone = make_mat(
        "mat_stone", "#323858", roughness=0.72, metallic=0.05,
        normal_img=stone_nrm, normal_strength=0.75, uv_scale=1.8
    )
    mat_stone_top = make_mat(
        "mat_stone_top", "#525b7a", roughness=0.54, metallic=0.06, coat=0.22, coat_rough=0.28,
        normal_img=stone_nrm, normal_strength=0.62, uv_scale=1.8
    )
    mat_moss = make_mat("mat_moss", "#2d4f24", roughness=0.88, metallic=0.0)

    root = make_empty_node("CorbelLedgeRoot", (0.0, 0.0, 0.0))

    # 1. Irregular hand-chiseled 3-stone weathered flagstone walkway (`y_top = +0.105`)
    bm_slab = bmesh.new()
    add_bevel_box(bm_slab, (0.0, 0.024, -0.01), (1.06, 0.092, 0.64), bevel=0.015, segs=1, mat_idx=0)
    flagstones = [
        (-0.365, 0.081, 0.005, 0.345, 0.048, 0.685, (0.0, 0.012, -0.008)),
        (0.005, 0.083, 0.015, 0.365, 0.050, 0.695, (0.008, -0.010, 0.005)),
        (0.370, 0.080, 0.000, 0.340, 0.047, 0.675, (-0.006, 0.015, 0.010)),
    ]
    for fx, fy, fz, fw, fh_s, fd, frot in flagstones:
        add_bevel_box(bm_slab, (fx, fy, fz), (fw, fh_s, fd), bevel=0.011, segs=1, rot_t3=frot, mat_idx=1)
    assign_box_uvs(bm_slab, scale=1.5)
    finalize_mesh_obj("flagstone_slab", bm_slab, [mat_stone, mat_stone_top], parent=root, smooth=False, keep_custom_uvs=True)

    # 2. Smooth concave Romanesque tapered stone corbel bracket (`mat_stone`, centered at `x = 0.0`)
    bm_corb = bmesh.new()
    # Strictly monotonic `y` horizontal `(x, z)` chamfered sections sweeping along a concave
    # Romanesque cavetto curve + stepped abacus molding lip (`100%` manifold, `~92` tris!)
    z_back = -0.330
    corbel_y_stations = [
        # (y, z_front, half_w, chamfer)
        (-0.440, -0.270, 0.080, 0.016),
        (-0.380, -0.242, 0.088, 0.018),
        (-0.290, -0.198, 0.098, 0.020),
        (-0.190, -0.112, 0.110, 0.022),
        (-0.100,  0.032, 0.122, 0.024),
        (-0.046,  0.192, 0.132, 0.026),
        (-0.038,  0.246, 0.144, 0.028),
        ( 0.006,  0.250, 0.144, 0.028),
    ]
    c_rings = []
    for cy, zf, hw, ch in corbel_y_stations:
        c_rings.append([
            (-hw, cy, z_back),
            ( hw, cy, z_back),
            ( hw, cy, zf - ch),
            ( hw - ch, cy, zf),
            (-hw + ch, cy, zf),
            (-hw, cy, zf - ch),
        ])
    add_loft_rings(bm_corb, c_rings, closed=True, cap_start=True, cap_end=True, mat_idx=0)
    assign_box_uvs(bm_corb, scale=1.5)
    finalize_mesh_obj("corbel_brackets", bm_corb, mat_stone, parent=root, smooth=False, keep_custom_uvs=True)

    # 3. Organic emerald moss cushions along flagstone joints (`mat_moss`)
    bm_moss = bmesh.new()
    for mx, mz, mr in [(-0.40, -0.24, 0.065), (0.19, -0.25, 0.058), (-0.18, 0.18, 0.042), (0.36, 0.22, 0.045)]:
        add_ellipsoid(bm_moss, (mx, 0.102, mz), (mr * 1.35, 0.016, mr), u_segs=7, v_segs=4, mat_idx=0)
    finalize_mesh_obj("moss_clumps", bm_moss, mat_moss, parent=root, decimate_ratio=0.75)

    return export_glb_and_inspect(os.path.join(OUT_MODELS_DIR, "corbel_ledge.glb"))


def build_cage_elevator():
    """
    Upgraded `#212` Warm Golden Wrought-Iron & Brass Lantern Cage Lift (`media_1794884512715_2296550d.jpg`):
    - Heavy chamfered dark-iron & riveted-brass platform base (`y = 0.0..0.10`),
    - 4 wrought-iron corner stanchions + tarnished-brass side/rear cage bars (`+Z` front open),
    - Domed arched iron hoist crown (`y = 0.92..1.08`) with twin hoist shackles,
    - Brilliant `#ffaa2b` / `#fff0b3` ceiling lantern disc + upper golden halo ring + warm post glow!
    """
    reset_scene()
    mat_iron = make_mat("mat_iron", "#242936", roughness=0.40, metallic=0.86)
    mat_brass = make_mat("mat_brass", "#c89038", roughness=0.26, metallic=0.90)
    mat_amber_glow = make_mat("mat_amber_glow", "#fff0b3", roughness=0.08, emission_hex="#ffaa2b", emission_strength=3.60)

    root = make_empty_node("CageElevatorRoot", (0.0, 0.0, 0.0))
    bm = bmesh.new()
    # Heavy stone-dark iron base & brass floor plate
    add_bevel_box(bm, (0.0, 0.045, 0.0), (0.92, 0.09, 0.68), bevel=0.018, segs=1, mat_idx=0)
    add_bevel_box(bm, (0.0, 0.096, 0.0), (0.84, 0.024, 0.60), bevel=0.006, segs=1, mat_idx=1)
    # Upper cornice & arched hoist crown with twin cable shackles
    add_bevel_box(bm, (0.0, 0.925, 0.0), (0.94, 0.085, 0.70), bevel=0.018, segs=1, mat_idx=0)
    add_bevel_box(bm, (0.0, 0.985, 0.0), (0.70, 0.048, 0.52), bevel=0.010, segs=1, mat_idx=1)
    for sx in (-0.18, 0.18):
        arch = [(sx, 0.96, -0.24), (sx, 1.055, 0.0), (sx, 0.96, 0.24)]
        add_swept_curve(bm, arch, 0.022, segs=6, mat_idx=0)
        add_ellipsoid(bm, (sx, 1.07, 0.0), (0.028, 0.032, 0.028), u_segs=8, v_segs=5, mat_idx=1)

    # 4 Corner stanchions + brass collars
    for cx, cz in [(-0.40, -0.28), (0.40, -0.28), (-0.40, 0.28), (0.40, 0.28)]:
        add_bevel_box(bm, (cx, 0.485, cz), (0.048, 0.84, 0.048), bevel=0.006, mat_idx=0)
        add_bevel_box(bm, (cx, 0.13, cz), (0.070, 0.07, 0.070), bevel=0.006, mat_idx=1)
        add_bevel_box(bm, (cx, 0.855, cz), (0.070, 0.07, 0.070), bevel=0.006, mat_idx=1)

    # Vertical brass side & rear cage bars + mid waist rail (`+Z` front wide open for Pogo)
    for bx, bz in [(-0.24, -0.29), (-0.08, -0.29), (0.08, -0.29), (0.24, -0.29), (-0.41, -0.11), (-0.41, 0.09), (0.41, -0.11), (0.41, 0.09)]:
        add_swept_curve(bm, [(bx, 0.09, bz), (bx, 0.89, bz)], 0.013, segs=5, mat_idx=1)
    for sx in (-0.41, 0.41):
        add_bevel_box(bm, (sx, 0.38, 0.0), (0.026, 0.030, 0.56), bevel=0.004, mat_idx=1)
    add_bevel_box(bm, (0.0, 0.38, -0.29), (0.80, 0.030, 0.026), bevel=0.004, mat_idx=1)
    finalize_mesh_obj("cage_frame", bm, [mat_iron, mat_brass], parent=root, decimate_ratio=0.72)

    # Warm golden lantern ceiling disc + upper crown halo ring + warm floor rim (`mat_amber_glow`)
    bm_l = bmesh.new()
    add_ellipsoid(bm_l, (0.0, 0.875, 0.0), (0.31, 0.028, 0.22), u_segs=14, v_segs=6, mat_idx=0)
    halo_pts = [
        (math.cos((2.0 * math.pi * k) / 16.0) * 0.35, 1.015, math.sin((2.0 * math.pi * k) / 16.0) * 0.26)
        for k in range(17)
    ]
    add_swept_curve(bm_l, halo_pts, 0.018, segs=6, mat_idx=0)
    add_bevel_box(bm_l, (0.0, 0.110, 0.24), (0.66, 0.014, 0.038), bevel=0.004, mat_idx=0)
    finalize_mesh_obj("lantern_core", bm_l, mat_amber_glow, parent=root, decimate_ratio=0.80)
    return export_glb_and_inspect(os.path.join(OUT_MODELS_DIR, "cage_elevator.glb"))


# ==============================================================================
# 7. NEXT-GEN MINI-GAME & SANCTUM PUZZLE `.GLB` SUITE (#128)
#    (`reboot_sub_mk7.glb`, `alien_fish_1.glb`, `alien_fish_2.glb`, `sea_mine.glb`,
#     `warp_cavern.glb`, `sky_glider.glb`, `puzzle_props.glb`)
# ==============================================================================

def create_riveted_hull_normal_img(size=128):
    img = bpy.data.images.new("MantaHull_Normal", width=size, height=size, alpha=False)
    img.colorspace_settings.name = "Non-Color"
    px = [0.5, 0.5, 1.0, 1.0] * (size * size)
    for y in range(size):
        v = y / float(size)
        for x in range(size):
            u = x / float(size)
            seam_u = 1.0 if min(u % 0.25, 0.25 - (u % 0.25)) < 0.012 else 0.0
            seam_v = 1.0 if min(v % 0.25, 0.25 - (v % 0.25)) < 0.012 else 0.0
            nx = -0.28 * seam_u
            ny = -0.28 * seam_v
            nz = math.sqrt(max(0.2, 1.0 - nx * nx - ny * ny))
            idx = (y * size + x) * 4
            px[idx], px[idx + 1], px[idx + 2], px[idx + 3] = 0.5 + 0.5 * nx, 0.5 + 0.5 * ny, 0.5 + 0.5 * nz, 1.0
    img.pixels = px
    img.pack()
    return img


def create_biolume_fish_albedo(size=128, base_hex="#0e7490", stripe_hex="#5efce8", spot_hex="#f472b6"):
    img = bpy.data.images.new("BiolumeFish_Albedo_" + base_hex.lstrip("#"), width=size, height=size, alpha=False)
    px = [0.0] * (size * size * 4)
    cb = hex_srgb(base_hex)
    cs = hex_srgb(stripe_hex)
    cp = hex_srgb(spot_hex)
    for y in range(size):
        v = y / float(size - 1)
        for x in range(size):
            u = x / float(size - 1)
            band = 0.5 + 0.5 * math.sin(u * math.pi * 10.0 + math.sin(v * math.pi * 3.0) * 1.4)
            spots = smoothstep(0.72, 0.88, _vnoise(u * 18.0, v * 14.0))
            belly = smoothstep(0.55, 0.15, v) * 0.45
            col = lerp3(cb, cs, (band ** 3) * 0.65 + belly)
            col = lerp3(col, cp, spots * 0.75)
            idx = (y * size + x) * 4
            px[idx], px[idx + 1], px[idx + 2], px[idx + 3] = srgb_to_lin(col[0]), srgb_to_lin(col[1]), srgb_to_lin(col[2]), 1.0
    img.pixels = px
    img.pack()
    return img


def create_rusted_mine_maps(size=128):
    alb = bpy.data.images.new("SeaMine_Albedo", width=size, height=size, alpha=False)
    nrm = bpy.data.images.new("SeaMine_Normal", width=size, height=size, alpha=False)
    nrm.colorspace_settings.name = "Non-Color"
    apx = [0.0] * (size * size * 4)
    npx = [0.0] * (size * size * 4)
    c_iron = hex_srgb("#27303d")
    c_rust = hex_srgb("#6e361f")
    c_moss = hex_srgb("#2b4c38")
    for y in range(size):
        v = y / float(size - 1)
        for x in range(size):
            u = x / float(size - 1)
            n1 = _fbm(u * 10.0, v * 10.0)
            n2 = _vnoise(u * 26.0, v * 26.0)
            col = lerp3(c_iron, c_rust, smoothstep(0.45, 0.78, n1))
            col = lerp3(col, c_moss, smoothstep(0.62, 0.88, n2) * 0.55)
            idx = (y * size + x) * 4
            apx[idx], apx[idx + 1], apx[idx + 2], apx[idx + 3] = srgb_to_lin(col[0]), srgb_to_lin(col[1]), srgb_to_lin(col[2]), 1.0
            nx, ny = (n2 - 0.5) * 0.45, (n1 - 0.5) * 0.45
            nz = math.sqrt(max(0.2, 1.0 - nx * nx - ny * ny))
            npx[idx], npx[idx + 1], npx[idx + 2], npx[idx + 3] = 0.5 + 0.5 * nx, 0.5 + 0.5 * ny, 0.5 + 0.5 * nz, 1.0
    alb.pixels = apx
    nrm.pixels = npx
    alb.pack()
    nrm.pack()
    return alb, nrm


def create_glider_sail_albedo(w=256, h=128):
    """Weathered Da-Vinci / Steampunk expedition ripstop sail canvas map."""
    img = bpy.data.images.new("SkyGlider_Sail_Albedo", width=w, height=h, alpha=False)
    px = [0.0] * (w * h * 4)
    c_navy = hex_srgb("#1b263b")
    c_parch = hex_srgb("#e8dcc4")
    c_amber = hex_srgb("#c9882c")
    c_cyan = hex_srgb("#22b8cf")
    c_crim = hex_srgb("#9e2f28")
    c_seam = hex_srgb("#2b1e16")

    for y in range(h):
        v = y / float(h - 1)  # 0 = leading edge, 1 = trailing edge
        for x in range(w):
            au = abs((x / float(w - 1)) * 2.0 - 1.0)  # 0 = keel center, 1 = wingtip
            weave = 0.93 + 0.07 * (0.5 + 0.5 * math.sin(x * 0.9) * math.sin(y * 0.9))
            grime = _fbm(au * 8.0, v * 8.0)
            if au < 0.11:
                col = c_navy
            elif au < 0.28:
                col = c_amber
            elif au < 0.56:
                col = c_parch
            elif au < 0.72:
                col = c_cyan
            elif au < 0.86:
                col = c_amber
            else:
                col = c_crim

            # Stitched leather batten rib seams & leading-edge reinforcement
            rib_d = min(abs(au - r) for r in (0.11, 0.28, 0.42, 0.56, 0.72, 0.86))
            if rib_d < 0.012 or v < 0.08 or v > 0.94:
                col = lerp3(col, c_seam, 0.72)

            col = (clamp01(col[0] * weave * (0.90 + 0.18 * grime)),
                   clamp01(col[1] * weave * (0.90 + 0.18 * grime)),
                   clamp01(col[2] * weave * (0.90 + 0.18 * grime)))
            idx = (y * w + x) * 4
            px[idx], px[idx + 1], px[idx + 2], px[idx + 3] = srgb_to_lin(col[0]), srgb_to_lin(col[1]), srgb_to_lin(col[2]), 1.0
    img.pixels = px
    img.pack()
    return img


def build_reboot_sub_mk7():
    """
    2026 Reboot Abyssal Manta-Bathysphere (`assets/models/reboot_sub_mk7.glb`):
      - `+X` nose forward, `-X` stern, `+Y` dorsal, `±Z` swept manta hydro-wings (`L=2.08`, `W=1.84`)
      - Nodes: `manta_hull`, `nose_dome` (clear panoramic front dome), `pilot_seat` (Empty at `(0.36, -0.18, 0.0)`
        where `PogoRig` sits visibly at the glowing `helm_console`!), `thrusterL`, `thrusterR`, `torpedo_pods`.
    """
    reset_scene()
    hull_nrm = create_riveted_hull_normal_img(128)
    mat_titanium = make_mat("mat_titanium", "#1e293b", roughness=0.28, metallic=0.84, coat=0.35, normal_img=hull_nrm, normal_strength=0.45, uv_scale=3.0)
    mat_brass = make_mat("mat_brass", "#c9933b", roughness=0.25, metallic=0.88)
    mat_dark_cockpit = make_mat("mat_cockpit", "#0f172a", roughness=0.55, metallic=0.35)
    mat_glow = make_mat("mat_glow", "#4ff0ff", roughness=0.10, emission_hex="#38bdf8", emission_strength=2.35)
    mat_amber = make_mat("mat_amber", "#ffbe44", roughness=0.12, emission_hex="#f59e0b", emission_strength=2.10)
    mat_glass = make_mat("mat_glass", "#a5f3fc", roughness=0.04, metallic=0.05, coat=1.0, coat_rough=0.01, alpha=0.24)

    root = make_empty_node("RebootSubRoot", (0.0, 0.0, 0.0))

    # 1. Aggressive Manta-Bathysphere Hull (`x = -1.04` stern .. `x = +0.28` panoramic dome collar)
    bm = bmesh.new()
    fuselage_stations = [
        (-1.04, 0.06, 0.08, 0.0),
        (-0.84, 0.18, 0.24, 0.0),
        (-0.52, 0.32, 0.42, 0.01),
        (-0.16, 0.40, 0.46, 0.02),
        (0.18,  0.39, 0.42, 0.02),
        (0.28,  0.37, 0.39, 0.01),
    ]
    f_rings = []
    for x, ry, rz, yc in fuselage_stations:
        f_rings.append([(x, yc + math.sin((2.0 * math.pi * s) / 18) * ry, math.cos((2.0 * math.pi * s) / 18) * rz) for s in range(18)])
    add_loft_rings(bm, f_rings, closed=True, cap_start=True, cap_end=True, mat_idx=0)

    # Heavy riveted brass panoramic nose-dome collar ring + dorsal spine ribs
    add_swept_curve(bm, [(0.22, 0.01, 0.0), (0.31, 0.01, 0.0)], [0.40, 0.385], segs=18, mat_idx=1)
    for rx in (-0.48, -0.14):
        add_swept_curve(bm, [(rx - 0.03, 0.01, 0.0), (rx + 0.03, 0.01, 0.0)], [0.41, 0.41], segs=16, mat_idx=1)

    # Swept Anhedral Manta Hydro-Wings (`±Z` out to `0.92`) + glowing cyan chine strips!
    for sz in (-1.0, 1.0):
        wing_pts = [
            (-0.18, -0.02, sz * 0.36),
            (-0.34, -0.05, sz * 0.66),
            (-0.56, -0.08, sz * 0.92),
        ]
        add_swept_curve(bm, wing_pts, [(0.36, 0.055), (0.26, 0.042), (0.14, 0.024)], segs=8, up_t3=(0.0, 1.0, 0.0), mat_idx=0)
        # Bioluminescent wing-leading-edge plasma strip (`mat_glow`)
        add_swept_curve(bm, [(-0.02, -0.02, sz * 0.38), (-0.48, -0.08, sz * 0.90)], 0.018, segs=6, mat_idx=3)

    # Swept dorsal manta tailfin + twin ventral skids
    add_bevel_box(bm, (-0.68, 0.34, 0.0), (0.42, 0.32, 0.038), bevel=0.008, rot_t3=(0.0, 0.0, -0.38), mat_idx=0)
    add_swept_curve(bm, [(-0.86, 0.48, 0.0), (-0.50, 0.48, 0.0)], 0.022, segs=6, mat_idx=3)

    # Forward Bathysphere Cockpit Floor, Pilot Bucket Seat & Glowing Cyan Holographic Helm Console!
    add_bevel_box(bm, (0.46, -0.22, 0.0), (0.44, 0.05, 0.44), bevel=0.008, mat_idx=2)
    add_bevel_box(bm, (0.28, -0.04, 0.0), (0.07, 0.32, 0.28), bevel=0.010, rot_t3=(0.0, 0.0, 0.16), mat_idx=1)
    add_bevel_box(bm, (0.64, -0.09, 0.0), (0.12, 0.14, 0.30), bevel=0.010, rot_t3=(0.0, 0.0, -0.35), mat_idx=2)
    add_bevel_box(bm, (0.61, -0.01, 0.0), (0.08, 0.02, 0.26), bevel=0.004, rot_t3=(0.0, 0.0, -0.45), mat_idx=3)

    finalize_mesh_obj("manta_hull", bm, [mat_titanium, mat_brass, mat_dark_cockpit, mat_glow], parent=root, decimate_ratio=0.72)

    # 2. Twin Under-Wing Cryo-Torpedo Launchers + Bow Searchlights (`torpedo_pods`)
    bm_tp = bmesh.new()
    for sz in (-1.0, 1.0):
        add_swept_curve(bm_tp, [(-0.06, -0.22, sz * 0.44), (0.48, -0.22, sz * 0.44)], [0.065, 0.058], segs=8, mat_idx=0)
        add_ellipsoid(bm_tp, (0.49, -0.22, sz * 0.44), (0.042, 0.048, 0.048), u_segs=8, v_segs=6, mat_idx=2)
        # Twin bow amber searchlight pods under chin
        add_swept_curve(bm_tp, [(0.58, -0.26, sz * 0.18), (0.72, -0.26, sz * 0.18)], [0.045, 0.055], segs=8, mat_idx=1)
        add_ellipsoid(bm_tp, (0.73, -0.26, sz * 0.18), (0.020, 0.046, 0.046), u_segs=8, v_segs=5, mat_idx=3)
    finalize_mesh_obj("torpedo_pods", bm_tp, [mat_titanium, mat_brass, mat_glow, mat_amber], parent=root)

    # 3. Twin Shrouded Wing-Mounted Plasma-Bubble Thrusters (`thrusterL`, `thrusterR`)
    for tname, sz in (("thrusterL", -0.54), ("thrusterR", 0.54)):
        bm_th = bmesh.new()
        add_swept_curve(bm_th, [(-0.18, 0.0, 0.0), (0.16, 0.0, 0.0)], [0.125, 0.115], segs=12, mat_idx=0)
        add_swept_curve(bm_th, [(-0.20, 0.0, 0.0), (-0.14, 0.0, 0.0)], [0.132, 0.128], segs=12, mat_idx=1)
        add_ellipsoid(bm_th, (-0.17, 0.0, 0.0), (0.045, 0.098, 0.098), u_segs=10, v_segs=6, mat_idx=2)
        finalize_mesh_obj(tname, bm_th, [mat_titanium, mat_brass, mat_glow], pos=(-0.68, -0.04, sz), parent=root)

    # 4. Large Clear Panoramic Front Glass Bathysphere Nose-Dome (`nose_dome`)
    bm_d = bmesh.new()
    dome_stations = [
        (0.26, 0.365, 0.380),
        (0.46, 0.350, 0.365),
        (0.68, 0.295, 0.310),
        (0.86, 0.195, 0.205),
        (0.96, 0.075, 0.080),
    ]
    d_rings = [[(x, math.sin((2.0 * math.pi * s) / 18) * ry, math.cos((2.0 * math.pi * s) / 18) * rz) for s in range(18)] for x, ry, rz in dome_stations]
    add_loft_rings(bm_d, d_rings, closed=True, cap_start=False, cap_end=True, mat_idx=0)
    finalize_mesh_obj("nose_dome", bm_d, mat_glass, parent=root)

    # 5. Exact Pilot Seat Origin (`pilot_seat` at `(0.36, -0.18, 0.0)`) for `PogoRig`!
    make_empty_node("pilot_seat", (0.36, -0.18, 0.0), parent=root)

    return export_glb_and_inspect(os.path.join(OUT_MODELS_DIR, "reboot_sub_mk7.glb"), export_apply=False)


def build_alien_fish_1():
    """
    Bioluminescent Abyssal Angler-Stalker (`assets/models/alien_fish_1.glb`):
      - Swims `-X` forward (`-X` jaws & glowing angler esca lure, `+X` crescent ribbon `tail_fin`)
      - Nodes: `body`, `pectoralL`, `pectoralR`, `tail_fin` (pivoted at `(+0.30, 0, 0)` for Y-swish!).
    """
    reset_scene()
    f_alb = create_biolume_fish_albedo(128, "#0f4c75", "#4ff0ff", "#f472b6")
    mat_body = make_mat("mat_fish_body", "#38bdf8", roughness=0.22, coat=0.80, emission_hex="#0284c7", emission_strength=0.45, albedo_img=f_alb)
    mat_fin = make_mat("mat_fish_fin", "#67e8f9", roughness=0.18, emission_hex="#22d3ee", emission_strength=0.75, alpha=0.84)
    mat_glow = make_mat("mat_fish_glow", "#fdf4ff", roughness=0.08, emission_hex="#f472b6", emission_strength=2.60)
    mat_eye = make_mat("mat_fish_eye", "#040812", roughness=0.04, coat=1.0)

    root = make_empty_node("AlienFish1Root", (0.0, 0.0, 0.0))

    bm = bmesh.new()
    stations = [
        (-0.34, 0.07, 0.06, -0.02),
        (-0.22, 0.19, 0.14,  0.00),
        (-0.05, 0.23, 0.16,  0.01),
        (0.14,  0.16, 0.11,  0.00),
        (0.30,  0.06, 0.05,  0.00),
    ]
    rings = [[(x, yc + math.sin((2.0 * math.pi * s) / 14) * ry, math.cos((2.0 * math.pi * s) / 14) * rz) for s in range(14)] for x, ry, rz, yc in stations]
    add_loft_rings(bm, rings, closed=True, cap_start=True, cap_end=True, mat_idx=0)

    # Curved scalloped dorsal sail-fin (ZERO square boxes!)
    dorsal_pts = [(-0.12, 0.20, 0.0), (0.02, 0.34, 0.0), (0.18, 0.28, 0.0), (0.26, 0.10, 0.0)]
    add_swept_curve(bm, dorsal_pts, [(0.008, 0.03), (0.008, 0.07), (0.007, 0.06), (0.005, 0.02)], segs=6, up_t3=(0.0, 1.0, 0.0), mat_idx=1)

    # Arching Bioluminescent Angler Illicium Stalk + Glowing Esca Lure Orb ahead of `-X` snout!
    lure_pts = [(-0.16, 0.18, 0.0), (-0.28, 0.32, 0.0), (-0.42, 0.26, 0.0), (-0.46, 0.14, 0.0)]
    add_swept_curve(bm, lure_pts, [0.014, 0.010, 0.007, 0.005], segs=6, mat_idx=1)
    add_ellipsoid(bm, (-0.46, 0.12, 0.0), (0.042, 0.046, 0.042), u_segs=10, v_segs=8, mat_idx=2)

    # Glossy alien eyes + glowing lateral photophores
    for sz in (-1.0, 1.0):
        add_ellipsoid(bm, (-0.22, 0.05, sz * 0.125), (0.042, 0.044, 0.028), u_segs=10, v_segs=6, mat_idx=3)
        for px, py in [(-0.08, -0.04), (0.04, -0.03), (0.15, -0.02)]:
            add_ellipsoid(bm, (px, py, sz * 0.14), (0.018, 0.014, 0.008), u_segs=6, v_segs=4, mat_idx=2)

    finalize_mesh_obj("body", bm, [mat_body, mat_fin, mat_glow, mat_eye], parent=root)

    # Swept Organic Pectoral Ribbon Fins (`pectoralL`, `pectoralR`)
    for pname, sz in (("pectoralL", -1.0), ("pectoralR", 1.0)):
        bm_p = bmesh.new()
        p_pts = [(0.0, 0.0, 0.0), (0.08, -0.06, sz * 0.14), (0.20, -0.11, sz * 0.24)]
        add_swept_curve(bm_p, p_pts, [(0.045, 0.008), (0.055, 0.006), (0.022, 0.004)], segs=6, up_t3=(0.0, 1.0, 0.0), mat_idx=0)
        finalize_mesh_obj(pname, bm_p, mat_fin, pos=(-0.10, -0.04, sz * 0.12), parent=root)

    # Crescent Bifurcated Flowing Ribbon Tail Fin (`tail_fin` pivoted at `(+0.30, 0, 0)`!)
    bm_t = bmesh.new()
    for sy in (-1.0, 1.0):
        lobe_pts = [(0.0, 0.0, 0.0), (0.12, sy * 0.12, 0.0), (0.28, sy * 0.24, 0.0), (0.38, sy * 0.29, 0.0)]
        add_swept_curve(bm_t, lobe_pts, [(0.008, 0.045), (0.007, 0.065), (0.006, 0.048), (0.004, 0.016)], segs=6, up_t3=(0.0, 1.0, 0.0), mat_idx=0)
    finalize_mesh_obj("tail_fin", bm_t, mat_fin, pos=(0.30, 0.0, 0.0), parent=root)

    return export_glb_and_inspect(os.path.join(OUT_MODELS_DIR, "alien_fish_1.glb"), export_apply=False)


def build_alien_fish_2():
    """
    Bioluminescent Veil-Fin Ribbon Ray-Fish (`assets/models/alien_fish_2.glb`):
      - Swims `-X` forward, `+X` flowing bifurcated veil `tail_fin` pivoted at `(+0.32, 0, 0)`.
    """
    reset_scene()
    f_alb = create_biolume_fish_albedo(128, "#4c1d95", "#f472b6", "#5efce8")
    mat_body = make_mat("mat_fish_body", "#c084fc", roughness=0.20, coat=0.85, emission_hex="#9333ea", emission_strength=0.50, albedo_img=f_alb)
    mat_fin = make_mat("mat_fish_fin", "#f5d0fe", roughness=0.16, emission_hex="#e879f9", emission_strength=0.80, alpha=0.82)
    mat_glow = make_mat("mat_fish_glow", "#ecfeff", roughness=0.08, emission_hex="#5efce8", emission_strength=2.50)
    mat_eye = make_mat("mat_fish_eye", "#050811", roughness=0.04, coat=1.0)

    root = make_empty_node("AlienFish2Root", (0.0, 0.0, 0.0))

    bm = bmesh.new()
    stations = [
        (-0.36, 0.04, 0.05),
        (-0.20, 0.15, 0.13),
        (-0.02, 0.19, 0.15),
        (0.16,  0.13, 0.10),
        (0.32,  0.05, 0.04),
    ]
    rings = [[(x, math.sin((2.0 * math.pi * s) / 14) * ry, math.cos((2.0 * math.pi * s) / 14) * rz) for s in range(14)] for x, ry, rz in stations]
    add_loft_rings(bm, rings, closed=True, cap_start=True, cap_end=True, mat_idx=0)

    # Flowing upper & lower curved veil crests!
    for sy in (-1.0, 1.0):
        v_pts = [(-0.08, sy * 0.16, 0.0), (0.08, sy * 0.30, 0.0), (0.26, sy * 0.22, 0.0)]
        add_swept_curve(bm, v_pts, [(0.007, 0.035), (0.007, 0.065), (0.005, 0.030)], segs=6, up_t3=(0.0, 1.0, 0.0), mat_idx=1)

    for sz in (-1.0, 1.0):
        add_ellipsoid(bm, (-0.22, 0.03, sz * 0.11), (0.038, 0.040, 0.026), u_segs=10, v_segs=6, mat_idx=3)
        add_swept_curve(bm, [(-0.16, 0.0, sz * 0.13), (0.20, 0.0, sz * 0.09)], 0.012, segs=6, mat_idx=2)

    finalize_mesh_obj("body", bm, [mat_body, mat_fin, mat_glow, mat_eye], parent=root)

    for pname, sz in (("pectoralL", -1.0), ("pectoralR", 1.0)):
        bm_p = bmesh.new()
        p_pts = [(0.0, 0.0, 0.0), (0.06, -0.02, sz * 0.18), (0.22, 0.02, sz * 0.30)]
        add_swept_curve(bm_p, p_pts, [(0.075, 0.008), (0.085, 0.006), (0.030, 0.004)], segs=6, up_t3=(0.0, 1.0, 0.0), mat_idx=0)
        finalize_mesh_obj(pname, bm_p, mat_fin, pos=(-0.06, -0.02, sz * 0.12), parent=root)

    bm_t = bmesh.new()
    for sy, amp in ((-1.0, -0.18), (0.0, 0.0), (1.0, 0.18)):
        t_pts = [(0.0, 0.0, 0.0), (0.16, amp * 0.7, 0.0), (0.34, amp * 1.25, 0.0), (0.46, amp * 1.4, 0.0)]
        add_swept_curve(bm_t, t_pts, [(0.007, 0.040), (0.006, 0.055), (0.005, 0.038), (0.004, 0.012)], segs=6, up_t3=(0.0, 1.0, 0.0), mat_idx=0)
    finalize_mesh_obj("tail_fin", bm_t, mat_fin, pos=(0.32, 0.0, 0.0), parent=root)

    return export_glb_and_inspect(os.path.join(OUT_MODELS_DIR, "alien_fish_2.glb"), export_apply=False)


def build_sea_mine():
    """
    Barnacle-Encrusted Horned Abyssal Naval Mine (`assets/models/sea_mine.glb`):
      - Centered at `(0,0,0)`, casing `r=0.34`, contact horns `r=0.52`, lower chain links.
      - Nodes: `mine_body`, `horns`.
    """
    reset_scene()
    m_alb, m_nrm = create_rusted_mine_maps(128)
    mat_iron = make_mat("mat_rusted_iron", "#333d4b", roughness=0.58, metallic=0.72, albedo_img=m_alb, normal_img=m_nrm, normal_strength=0.65, uv_scale=2.0)
    mat_brass = make_mat("mat_brass", "#b88738", roughness=0.34, metallic=0.84)
    mat_barnacle = make_mat("mat_barnacle", "#9aa39b", roughness=0.86, metallic=0.05)
    mat_red = make_mat("mat_red_glow", "#ff3b4e", roughness=0.10, emission_hex="#ff1e38", emission_strength=2.85)

    root = make_empty_node("SeaMineRoot", (0.0, 0.0, 0.0))

    bm = bmesh.new()
    add_ellipsoid(bm, (0.0, 0.0, 0.0), (0.34, 0.34, 0.34), u_segs=18, v_segs=12, mat_idx=0)
    # Equatorial bolted flange belt
    add_swept_curve(bm, [(math.cos(a) * 0.345, 0.0, math.sin(a) * 0.345) for a in [(2.0 * math.pi * k) / 16 for k in range(17)]], (0.022, 0.016), segs=6, cap_start=False, cap_end=False, mat_idx=1)

    # 3 Sinister Glowing Crimson Optical Sensor Ports around front/sides!
    for ea in (-0.65, 0.0, 0.65):
        ex, ez = math.sin(ea) * 0.325, math.cos(ea) * 0.325
        add_swept_curve(bm, [(ex * 0.92, 0.05, ez * 0.92), (ex * 1.06, 0.05, ez * 1.06)], 0.068, segs=10, mat_idx=1)
        add_ellipsoid(bm, (ex * 1.07, 0.05, ez * 1.07), (0.048, 0.048, 0.028), u_segs=10, v_segs=6, mat_idx=3)

    # 10 Sculpted Calcareous Barnacle Clusters encrusted onto hull!
    barn_dirs = [
        (0.5, 0.7, 0.5), (-0.6, 0.6, 0.4), (0.2, 0.85, -0.4), (-0.4, -0.6, 0.6),
        (0.65, -0.5, 0.45), (-0.7, 0.2, -0.6), (0.6, 0.3, -0.65), (0.0, -0.75, -0.55),
    ]
    for bx, by, bz in barn_dirs:
        d = Vector((bx, by, bz)).normalized()
        p0, p1 = d * 0.325, d * 0.375
        add_swept_curve(bm, [(p0.x, p0.y, p0.z), (p1.x, p1.y, p1.z)], [0.052, 0.028], segs=7, mat_idx=2)

    # Lower Mooring Shackle & 5 Heavy Anchor Chain Links (`y = -0.36 .. -1.15`)
    for li in range(5):
        ly = -0.42 - li * 0.16
        rot_y = (math.pi * 0.5) if (li % 2 == 1) else 0.0
        add_bevel_box(bm, (0.0, ly, 0.0), (0.085, 0.18, 0.036), bevel=0.010, rot_t3=(0.0, rot_y, 0.0), mat_idx=0)

    finalize_mesh_obj("mine_body", bm, [mat_iron, mat_brass, mat_barnacle, mat_red], parent=root, decimate_ratio=0.72)

    # 10 Hertz Chemical Contact Horns (`horns`)
    bm_h = bmesh.new()
    horn_dirs = [
        (0.0, 1.0, 0.0),
        (0.72, 0.58, 0.38), (-0.72, 0.58, 0.38), (0.55, 0.60, -0.58), (-0.55, 0.60, -0.58),
        (0.88, -0.22, 0.42), (-0.88, -0.22, 0.42), (0.72, -0.35, -0.60), (-0.72, -0.35, -0.60),
        (0.0, -0.48, 0.88),
    ]
    for hx, hy, hz in horn_dirs:
        d = Vector((hx, hy, hz)).normalized()
        p0, p1, p2 = d * 0.32, d * 0.48, d * 0.52
        add_swept_curve(bm_h, [(p0.x, p0.y, p0.z), (p1.x, p1.y, p1.z)], [0.042, 0.022], segs=7, mat_idx=0)
        add_ellipsoid(bm_h, (p2.x, p2.y, p2.z), (0.024, 0.024, 0.024), u_segs=6, v_segs=5, mat_idx=1)

    finalize_mesh_obj("horns", bm_h, [mat_brass, mat_red], parent=root)
    return export_glb_and_inspect(os.path.join(OUT_MODELS_DIR, "sea_mine.glb"), export_apply=False)


def build_warp_cavern():
    """
    Jagged Basalt & Amethyst Bioluminescent Sea-Cavern Arch (`assets/models/warp_cavern.glb`):
      - Centered around `(0, 0, 0)` facing `+Z`, navigable inner opening `r = 0.60`, outer span `~2.15`.
      - Nodes: `basalt_arch`, `amethyst_crystals`, `portal_throat`.
    """
    reset_scene()
    rock_nrm = create_stone_normal_img(128)
    mat_basalt = make_mat("mat_basalt", "#102338", roughness=0.82, metallic=0.14, normal_img=rock_nrm, normal_strength=0.85, uv_scale=4.0)
    mat_amethyst = make_mat("mat_amethyst", "#7e22ce", roughness=0.12, metallic=0.10, coat=0.92, emission_hex="#c084fc", emission_strength=1.65)
    mat_cyan = make_mat("mat_cyan_crystal", "#22d3ee", roughness=0.10, metallic=0.08, coat=0.92, emission_hex="#5efce8", emission_strength=1.85)
    mat_throat = make_mat("mat_throat", "#030712", roughness=0.95, metallic=0.0)

    root = make_empty_node("WarpCavernRoot", (0.0, 0.0, 0.0))

    # 1. Craggy Volcanic Trench-Basalt Sea-Cavern Arch Ring
    bm = bmesh.new()
    arch_pts = []
    arch_rads = []
    segs_arch = 18
    for i in range(segs_arch + 1):
        a = (2.0 * math.pi * i) / segs_arch
        wob = 0.84 + 0.11 * math.sin(a * 3.0 + 0.6) + 0.06 * math.cos(a * 5.0)
        z_jolt = 0.06 * math.sin(a * 4.0)
        arch_pts.append((math.cos(a) * wob, math.sin(a) * wob, z_jolt))
        rx = 0.24 + 0.07 * abs(math.sin(a * 2.5))
        ry = 0.28 + 0.08 * abs(math.cos(a * 2.0))
        arch_rads.append((rx, ry))
    add_swept_curve(bm, arch_pts, arch_rads, segs=7, cap_start=False, cap_end=False, mat_idx=0)
    finalize_mesh_obj("basalt_arch", bm, mat_basalt, parent=root, smooth=False, decimate_ratio=0.78)

    # 2. Chiseled Glowing Amethyst & Seafoam-Cyan Crystal Stalactites/Stalagmites (`amethyst_crystals`)
    bm_c = bmesh.new()
    for k in range(14):
        a = (2.0 * math.pi * k) / 14.0 + 0.22
        r_anchor = 0.76 + (k % 3) * 0.05
        bx, by = math.cos(a) * r_anchor, math.sin(a) * r_anchor
        # Point inward & slightly forward (+Z) into cavern mouth!
        inward = Vector((-math.cos(a) * 0.82, -math.sin(a) * 0.82, 0.34 if k % 2 == 0 else 0.14)).normalized()
        clen = 0.26 + (k % 3) * 0.07
        crad = 0.055 + (k % 2) * 0.018
        # Build hexagonal crystal prism at `(bx, by, 0.08)`
        tb = bmesh.new()
        add_chiseled_crystal(tb, (inward.x, inward.y, inward.z), clen, crad, offset=0.0, mat_idx=(k % 2))
        bmesh.ops.translate(tb, vec=v3(bx, by, 0.08), verts=tb.verts)
        vmap = {v: bm_c.verts.new(v.co) for v in tb.verts}
        for f in tb.faces:
            nf = bm_c.faces.new([vmap[v] for v in f.verts])
            nf.material_index = k % 2
        tb.free()
    finalize_mesh_obj("amethyst_crystals", bm_c, [mat_amethyst, mat_cyan], parent=root, smooth=False)

    # 3. Recessed Abyssal Portal Throat Disc (`portal_throat` at `z = -0.14`)
    bm_p = bmesh.new()
    add_ellipsoid(bm_p, (0.0, 0.0, -0.14), (0.74, 0.74, 0.03), u_segs=20, v_segs=4, mat_idx=0)
    finalize_mesh_obj("portal_throat", bm_p, mat_throat, parent=root)

    return export_glb_and_inspect(os.path.join(OUT_MODELS_DIR, "warp_cavern.glb"), export_apply=False)


def build_sky_glider():
    """
    Explorer Da-Vinci / Steampunk Sky-Wing (`assets/models/sky_glider.glb`):
      - Exact `src/glideRenderer.js` frame: `+X` Nose (`+0.96`), `-X` Keel Tail (`-0.84`),
        `±Z` Wingspan (`-1.50 .. +1.50`), `+Y` Dorsal Kingpost (`+0.44`).
      - `grip_bar` node origin at `(0.36, -0.92, 0.0)` spanning `z = -0.42 .. +0.42`
        (1:1 match to `BAR_X=0.36, BAR_Y=-0.92, BAR_Z=0.42` in `glideRenderer.js`!).
    """
    reset_scene()
    sail_alb = create_glider_sail_albedo(256, 128)
    mat_sail = make_mat("mat_sail_canvas", "#e8dcc4", roughness=0.66, metallic=0.02, albedo_img=sail_alb, uv_scale=1.0)
    mat_brass = make_mat("mat_brass", "#c9953c", roughness=0.26, metallic=0.88)
    mat_steel = make_mat("mat_steel", "#64748b", roughness=0.30, metallic=0.82)
    mat_leather = make_mat("mat_leather", "#52321e", roughness=0.74, metallic=0.05)
    mat_glow = make_mat("mat_jet_glow", "#5efce8", roughness=0.10, emission_hex="#38bdf8", emission_strength=2.40)

    root = make_empty_node("SkyGliderRoot", (0.0, 0.0, 0.0))

    # 1. Cambered Bat-Ribbed Expedition Delta Sail (`wing_sail` — double-sided solid thin shell!)
    bm_sail = bmesh.new()
    uv_layer = bm_sail.loops.layers.uv.verify()
    seg_u, seg_v = 22, 6
    top_grid, bot_grid = [], []
    for j in range(seg_v + 1):
        v = j / float(seg_v)
        t_row, b_row = [], []
        for i in range(seg_u + 1):
            u = (i / float(seg_u)) * 2.0 - 1.0
            au = abs(u)
            lx = lerp(0.95, -0.42, au)
            lz = u * 1.48
            scallop = abs(math.sin(au * math.pi * 3.5)) * 0.075 * (1.0 - au * 0.45)
            tx = lerp(-0.64, -0.50, au) + scallop
            tz = u * 1.48 * (au ** 0.92 if au > 1e-5 else 0.0)
            x = lerp(lx, tx, v)
            z = lerp(lz, tz, v)
            camber = math.sin(math.pi * min(1.0, v * 1.15)) * (1.0 - au * au) * 0.13 + au * 0.10 - v * 0.03
            t_row.append(bm_sail.verts.new(v3(x, camber + 0.004, z)))
            b_row.append(bm_sail.verts.new(v3(x, camber - 0.004, z)))
        top_grid.append(t_row)
        bot_grid.append(b_row)

    for j in range(seg_v):
        for i in range(seg_u):
            u0, u1 = i / float(seg_u), (i + 1) / float(seg_u)
            v0, v1 = j / float(seg_v), (j + 1) / float(seg_v)
            ft = bm_sail.faces.new([top_grid[j][i], top_grid[j + 1][i], top_grid[j + 1][i + 1], top_grid[j][i + 1]])
            fb = bm_sail.faces.new([bot_grid[j][i], bot_grid[j][i + 1], bot_grid[j + 1][i + 1], bot_grid[j + 1][i]])
            for f, coords in ((ft, [(u0, v0), (u0, v1), (u1, v1), (u1, v0)]), (fb, [(u0, v0), (u1, v0), (u1, v1), (u0, v1)])):
                f.material_index = 0
                for k, lp in enumerate(f.loops):
                    lp[uv_layer].uv = coords[k]

    finalize_mesh_obj("wing_sail", bm_sail, mat_sail, parent=root, keep_custom_uvs=True)

    # 2. Curved Brass Leading-Edge Spars, Keel Spine, Kingpost & Da-Vinci V-Tailfin (`spar_frame`)
    bm_f = bmesh.new()
    for sz in (-1.0, 1.0):
        add_swept_curve(bm_f, [(0.96, 0.0, 0.0), (0.32, 0.05, sz * 0.72), (-0.42, 0.10, sz * 1.49)], [0.030, 0.026, 0.018], segs=8, mat_idx=0)
        # Crossbar & upturned brass aero winglet tip
        add_swept_curve(bm_f, [(0.18, 0.06, sz * 0.03), (0.02, 0.09, sz * 0.98)], 0.018, segs=6, mat_idx=1)
        add_swept_curve(bm_f, [(-0.42, 0.10, sz * 1.49), (-0.54, 0.24, sz * 1.54)], [0.018, 0.008], segs=6, mat_idx=0)
        # Rigging wires from dorsal kingpost
        add_swept_curve(bm_f, [(0.10, 0.44, 0.0), (-0.20, 0.09, sz * 1.15)], 0.0045, segs=4, mat_idx=1)
        # Rear Da-Vinci V-tailfin stabilizer ribs & canvas
        add_bevel_box(bm_f, (-0.74, 0.08, sz * 0.12), (0.26, 0.010, 0.22), bevel=0.003, rot_t3=(sz * 0.42, 0.22 * sz, 0.12), mat_idx=0)

    # Central keel tube + dorsal brass kingpost + leather nose fairing
    add_swept_curve(bm_f, [(1.02, 0.0, 0.0), (-0.82, -0.02, 0.0)], [0.028, 0.020], segs=8, mat_idx=0)
    add_swept_curve(bm_f, [(0.12, 0.0, 0.0), (0.10, 0.45, 0.0)], [0.018, 0.012], segs=6, mat_idx=0)
    add_ellipsoid(bm_f, (0.98, 0.0, 0.0), (0.085, 0.042, 0.055), u_segs=10, v_segs=6, mat_idx=2)
    finalize_mesh_obj("spar_frame", bm_f, [mat_brass, mat_steel, mat_leather], parent=root)

    # 3. Twin Brass Cryo-Steam Boost-Jets (`boost_jets` at `(-0.36, 0.03, ±0.44)`)
    bm_j = bmesh.new()
    for sz in (-0.44, 0.44):
        add_swept_curve(bm_j, [(-0.48, 0.03, sz), (-0.22, 0.04, sz)], [0.058, 0.046], segs=10, mat_idx=0)
        add_ellipsoid(bm_j, (-0.49, 0.03, sz), (0.024, 0.048, 0.048), u_segs=8, v_segs=6, mat_idx=1)
    finalize_mesh_obj("boost_jets", bm_j, [mat_brass, mat_glow], parent=root)

    # 4. Control Trapeze Struts (`trapeze_frame`) & Exact `grip_bar` at `(0.36, -0.92, 0.0)`!
    bm_tr = bmesh.new()
    for sz in (-1.0, 1.0):
        add_swept_curve(bm_tr, [(0.22, -0.01, sz * 0.04), (0.36, -0.92, sz * 0.42)], 0.014, segs=6, mat_idx=0)
        add_swept_curve(bm_tr, [(-0.24, -0.01, 0.0), (0.36, -0.92, sz * 0.42)], 0.0045, segs=4, mat_idx=1)
    finalize_mesh_obj("trapeze_frame", bm_tr, [mat_brass, mat_steel], parent=root)

    bm_gb = bmesh.new()
    add_swept_curve(bm_gb, [(0.0, 0.0, -0.44), (0.0, 0.0, 0.44)], 0.016, segs=8, mat_idx=0)
    for gz in (-0.22, 0.22):
        add_swept_curve(bm_gb, [(0.0, 0.0, gz - 0.07), (0.0, 0.0, gz + 0.07)], 0.021, segs=8, mat_idx=1)
    finalize_mesh_obj("grip_bar", bm_gb, [mat_brass, mat_leather], pos=(0.36, -0.92, 0.0), parent=root)

    return export_glb_and_inspect(os.path.join(OUT_MODELS_DIR, "sky_glider.glb"), export_apply=False)


def build_puzzle_props():
    """
    Ancient Sanctum 4-Prop Pack (`assets/models/puzzle_props.glb`):
      4 top-level named nodes (`temple_bell`, `prism_mirror`, `push_monolith`, `sanctum_brazier`),
      each built around its own `(0, 0, 0)` tile-floor local origin (`y = 0.0` at floor)!
    """
    reset_scene()
    stone_nrm = create_stone_normal_img(128)
    mat_stone = make_mat("mat_stone", "#282c48", roughness=0.62, metallic=0.08, normal_img=stone_nrm, normal_strength=0.70, uv_scale=2.5)
    mat_iron = make_mat("mat_iron", "#232834", roughness=0.42, metallic=0.84)
    mat_bronze = make_mat("mat_bronze", "#b58338", roughness=0.28, metallic=0.88)
    mat_rune_glow = make_mat("mat_rune_glow", "#5efce8", roughness=0.12, emission_hex="#38bdf8", emission_strength=2.20)
    mat_mirror = make_mat("mat_mirror_crystal", "#e0f2fe", roughness=0.03, metallic=0.92, coat=1.0, emission_hex="#7dd3fc", emission_strength=0.45)
    mat_fire = make_mat("mat_fire_glow", "#ffbe3b", roughness=0.10, emission_hex="#ff7b00", emission_strength=3.10)

    root = make_empty_node("PuzzlePropsRoot", (0.0, 0.0, 0.0))

    # --------------------------------------------------------------------------
    # PROP 1: `temple_bell` (Arch Yoke `y=0..1.66` + Swinging `bell_body` at `(0, 1.48, 0)`)
    # --------------------------------------------------------------------------
    bell_grp = make_empty_node("temple_bell", (-3.0, 0.0, 0.0), parent=root)
    bm_yoke = bmesh.new()
    for sx in (-0.50, 0.50):
        add_bevel_box(bm_yoke, (sx, 0.06, 0.0), (0.24, 0.12, 0.30), bevel=0.012, mat_idx=0)
        add_swept_curve(bm_yoke, [(sx, 0.12, 0.0), (sx * 0.96, 0.90, 0.0), (sx * 0.88, 1.58, 0.0)], [0.058, 0.048, 0.044], segs=8, mat_idx=1)
        add_bevel_box(bm_yoke, (sx * 0.72, 1.42, 0.0), (0.28, 0.05, 0.06), bevel=0.006, rot_t3=(0.0, 0.0, sx * 0.65), mat_idx=2)
    add_bevel_box(bm_yoke, (0.0, 1.60, 0.0), (1.16, 0.10, 0.15), bevel=0.012, mat_idx=1)
    add_bevel_box(bm_yoke, (0.0, 1.67, 0.0), (1.24, 0.05, 0.18), bevel=0.008, mat_idx=2)
    finalize_mesh_obj("bell_yoke", bm_yoke, [mat_stone, mat_iron, mat_bronze], parent=bell_grp)

    bm_bell = bmesh.new()
    bell_prof = [
        (0.00,  0.04),
        (-0.06, 0.11),
        (-0.18, 0.16),
        (-0.34, 0.19),
        (-0.46, 0.25),
        (-0.54, 0.32),
        (-0.57, 0.30),
    ]
    b_rings = [[(math.cos((2.0 * math.pi * s) / 16) * r, y, math.sin((2.0 * math.pi * s) / 16) * r) for s in range(16)] for y, r in bell_prof]
    add_loft_rings(bm_bell, b_rings, closed=True, cap_start=True, cap_end=True, mat_idx=[0, 0, 1, 0, 1, 0])
    add_ellipsoid(bm_bell, (0.0, -0.58, 0.0), (0.055, 0.065, 0.055), u_segs=8, v_segs=6, mat_idx=0)
    finalize_mesh_obj("bell_body", bm_bell, [mat_bronze, mat_rune_glow], pos=(0.0, 1.48, 0.0), parent=bell_grp)

    # --------------------------------------------------------------------------
    # PROP 2: `prism_mirror` (Geared Pedestal `y=0..0.32` + Rotating `mirror_turret` `y=0.32..1.28`)
    # --------------------------------------------------------------------------
    mir_grp = make_empty_node("prism_mirror", (-1.0, 0.0, 0.0), parent=root)
    bm_mb = bmesh.new()
    add_swept_curve(bm_mb, [(0.0, 0.0, 0.0), (0.0, 0.14, 0.0), (0.0, 0.32, 0.0)], [0.38, 0.30, 0.26], segs=12, mat_idx=0)
    for g in range(8):
        ga = (2.0 * math.pi * g) / 8.0
        add_bevel_box(bm_mb, (math.cos(ga) * 0.29, 0.24, math.sin(ga) * 0.29), (0.06, 0.05, 0.06), bevel=0.005, rot_t3=(0.0, -ga, 0.0), mat_idx=1)
    finalize_mesh_obj("mirror_base", bm_mb, [mat_stone, mat_bronze], parent=mir_grp)

    bm_mt = bmesh.new()
    # Yoke arms relative to `(0, 0.32, 0)` -> mirror center at `local y = +0.46` (`world y = 0.78`!)
    add_bevel_box(bm_mt, (0.0, 0.04, 0.0), (0.86, 0.07, 0.11), bevel=0.008, mat_idx=0)
    add_bevel_box(bm_mt, (0.0, 0.90, 0.0), (0.86, 0.07, 0.11), bevel=0.008, mat_idx=0)
    for sx in (-0.40, 0.40):
        add_bevel_box(bm_mt, (sx, 0.47, 0.0), (0.07, 0.86, 0.11), bevel=0.008, mat_idx=0)
        add_ellipsoid(bm_mt, (sx, 0.95, 0.0), (0.055, 0.055, 0.055), u_segs=8, v_segs=6, mat_idx=0)
    add_bevel_box(bm_mt, (0.0, 0.47, 0.0), (0.72, 0.80, 0.042), bevel=0.008, mat_idx=1)
    finalize_mesh_obj("mirror_turret", bm_mt, [mat_bronze, mat_mirror], pos=(0.0, 0.32, 0.0), parent=mir_grp)

    # --------------------------------------------------------------------------
    # PROP 3: `push_monolith` (`0.84 x 0.86 x 0.84`, base `y = 0.0`)
    # --------------------------------------------------------------------------
    mono_grp = make_empty_node("push_monolith", (1.0, 0.0, 0.0), parent=root)
    bm_mn = bmesh.new()
    add_bevel_box(bm_mn, (0.0, 0.43, 0.0), (0.82, 0.86, 0.82), bevel=0.045, segs=1, mat_idx=0)
    # Bronze corner clamps
    for cx in (-0.38, 0.38):
        for cz in (-0.38, 0.38):
            add_bevel_box(bm_mn, (cx, 0.06, cz), (0.11, 0.12, 0.11), bevel=0.008, mat_idx=1)
            add_bevel_box(bm_mn, (cx, 0.80, cz), (0.11, 0.12, 0.11), bevel=0.008, mat_idx=1)
    # Glowing carved diamond rune inlays on all 4 vertical faces + top!
    for rot_y in (0.0, math.pi * 0.5, math.pi, math.pi * 1.5):
        s_in, c_os = math.sin(rot_y), math.cos(rot_y)
        add_bevel_box(bm_mn, (s_in * 0.412, 0.43, c_os * 0.412), (0.28, 0.28, 0.018), bevel=0.004, rot_t3=(0.0, rot_y, math.pi * 0.25), mat_idx=2)
    add_bevel_box(bm_mn, (0.0, 0.862, 0.0), (0.34, 0.016, 0.34), bevel=0.004, rot_t3=(0.0, math.pi * 0.25, 0.0), mat_idx=2)
    finalize_mesh_obj("monolith_body", bm_mn, [mat_stone, mat_bronze, mat_rune_glow], parent=mono_grp)

    # --------------------------------------------------------------------------
    # PROP 4: `sanctum_brazier` (`y = 0.0 .. 1.16` — Wrought-Iron Dragon Fire Brazier!)
    # --------------------------------------------------------------------------
    braz_grp = make_empty_node("sanctum_brazier", (3.0, 0.0, 0.0), parent=root)
    bm_br = bmesh.new()
    add_swept_curve(bm_br, [(0.0, 0.0, 0.0), (0.0, 0.10, 0.0)], [0.28, 0.24], segs=10, mat_idx=0)
    # 3 Curved wrought-iron dragon-scroll legs rising to fire bowl (`y = 0.72`)
    for k in range(3):
        la = (2.0 * math.pi * k) / 3.0
        lx, lz = math.cos(la), math.sin(la)
        l_pts = [(lx * 0.20, 0.08, lz * 0.20), (lx * 0.11, 0.42, lz * 0.11), (lx * 0.24, 0.74, lz * 0.24), (lx * 0.30, 0.86, lz * 0.30)]
        add_swept_curve(bm_br, l_pts, [0.032, 0.026, 0.030, 0.018], segs=6, mat_idx=1)
    # Ribbed iron/bronze fire bowl
    add_swept_curve(bm_br, [(0.0, 0.64, 0.0), (0.0, 0.78, 0.0), (0.0, 0.84, 0.0)], [0.10, 0.26, 0.29], segs=12, mat_idx=1)
    add_swept_curve(bm_br, [(0.0, 0.81, 0.0), (0.0, 0.86, 0.0)], [0.30, 0.31], segs=12, mat_idx=2)
    # Sculpted glowing ember coals & swirling 3D flame tongues (`mat_idx=3 -> mat_fire`)!
    add_ellipsoid(bm_br, (0.0, 0.84, 0.0), (0.23, 0.06, 0.23), u_segs=10, v_segs=6, mat_idx=3)
    flame_pts = [(0.0, 0.84, 0.0), (0.03, 0.98, 0.02), (-0.02, 1.12, -0.01), (0.0, 1.22, 0.0)]
    add_swept_curve(bm_br, flame_pts, [0.14, 0.10, 0.05, 0.01], segs=7, mat_idx=3)
    finalize_mesh_obj("brazier_body", bm_br, [mat_stone, mat_iron, mat_bronze, mat_fire], parent=braz_grp)

    return export_glb_and_inspect(os.path.join(OUT_MODELS_DIR, "puzzle_props.glb"), export_apply=False)


# ==============================================================================
# MAIN PIPELINE ORCHESTRATOR
# ==============================================================================

def main():
    import sys
    report = {"assets": [], "renders": []}

    turnaround_check = os.path.join(COORD_ARTIFACT_DIR, "pogo_v3_turnaround.png")
    force_render = ("--render-pogo" in sys.argv) or (not os.path.exists(turnaround_check))
    if force_render:
        report["renders"] = render_pogo_v2_studio_suite()

    # Build upright bind-pose Explorer Pogo V3 WITH embedded 512x512 velvety matte skin,
    # 256x256 creamy-sclera eye, and tan vest / stitched leather maps (`src/pogo.js` #238)!
    _, pogo_parts, _ = build_pogo_scene(for_cycles_studio=True)
    dec_map = {
        "torso": 0.09, "belly": 0.11, "head": 0.09, "crest": 0.12, "jaw": 0.12,
        "browL": 0.12, "browR": 0.12,
        "eyelidL": 0.18, "eyelidR": 0.18,
        "harness": 0.62, "backpack": 0.18, "blaster": 0.18,
        "upperArmL": 0.08, "upperArmR": 0.08, "forearmL": 0.10, "forearmR": 0.08,
        "handL": 0.08, "handR": 0.08,
        "thighL": 0.08, "thighR": 0.08, "shinL": 0.08, "shinR": 0.08,
        "footL": 0.15, "footR": 0.15,
    }
    for pname, pratio in dec_map.items():
        if pname in pogo_parts:
            apply_decimate(pogo_parts[pname], pratio, smooth=True)

    bpy.context.view_layer.update()
    for sk_name in ("torso", "belly", "head", "crest", "browL", "browR", "jaw"):
        project_anatomical_skin_uvs(pogo_parts[sk_name], is_limb=False)
    for sk_name in (
        "upperArmL", "forearmL", "handL", "upperArmR", "forearmR", "handR",
        "thighL", "shinL", "footL", "thighR", "shinR", "footR",
    ):
        project_anatomical_skin_uvs(pogo_parts[sk_name], is_limb=True)

    pogo_info = export_glb_and_inspect(os.path.join(OUT_MODELS_DIR, "pogo.glb"), export_apply=False)
    report["assets"].append(pogo_info)

    if "--pogo-only" not in sys.argv:
        # Export all 9 Core Enemies, Vehicles & Props + 7 New Next-Gen Mini-Game & Puzzle Assets (#128)!
        report["assets"].append(build_enemy_eye())
        report["assets"].append(build_enemy_molecule())
        report["assets"].append(build_enemy_roller())
        report["assets"].append(build_enemy_bouncer())
        report["assets"].append(build_enemy_robot())
        report["assets"].append(build_mk7_sub())
        report["assets"].append(build_hydro_skimmer())
        report["assets"].append(build_corbel_ledge())
        report["assets"].append(build_cage_elevator())

        report["assets"].append(build_reboot_sub_mk7())
        report["assets"].append(build_alien_fish_1())
        report["assets"].append(build_alien_fish_2())
        report["assets"].append(build_sea_mine())
        report["assets"].append(build_warp_cavern())
        report["assets"].append(build_sky_glider())
        report["assets"].append(build_puzzle_props())

    with open(LOG_PATH, "w", encoding="utf-8") as f:
        json.dump(report, f, indent=2)


if __name__ == "__main__":
    try:
        main()
    except Exception:
        err_path = os.path.join(OUT_MODELS_DIR, "_build_error.txt")
        with open(err_path, "w", encoding="utf-8") as ef:
            ef.write(traceback.format_exc())
        raise
