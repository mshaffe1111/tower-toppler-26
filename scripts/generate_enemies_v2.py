"""
TOWERING WATERS: GATEWAY'S DESCENT — Enemies 2.0 Stylized Personality Pipeline
==============================================================================
Headless Blender 5.3.0.0 sculpting, clean stylized PBR baking, GLB export, and
studio lineup preview renderer for all 7 expressive enemy archetypes + 5-Act
interchangeable Sovereign Warden crowns:

  1. `enemy_snap_crab.glb`       — Grumpy crimson-coral brawler, oversized brass-rimmed
                                   snapping pincers, bold angry hinged brows & big yellow
                                   eyes, bright aqua spring-belly trampoline underneath!
  2. `enemy_gulp_hopper.glb`     — Adorable-goofy emerald/violet puffer bullfrog, giant
                                   bulging golden eyes, eyelids, wide cheeky mouth + pink
                                   tongue, expandable aqua throat-sac & springy hind legs!
  3. `enemy_volt_eel.glb`        — High-contrast midnight-indigo & electric-cyan moray,
                                   glowing dorsal spark-fins, menacing glowing eyes + brows,
                                   floppy exhausted tongue & 8 sinuous body segments!
  4. `enemy_rail_skater.glb`     — Cocky crimson/brass clockwork wheel-strider, aviator
                                   goggles with glowing dual visor eyes, chunky glowing
                                   spark-wheels, spinning brass wind-up key & sleek chassis!
  5. `enemy_barnacle_mortar.glb` — Cowardly armored siege hermit inside a 5-petal bronze-coral
                                   fortress with a REAL expressive face in front AND a
                                   peeking googly periscope eye-stalk that ducks when panicked!
  6. `enemy_vent_stalker.glb`    — Brooding volcanic-obsidian & molten-amber thermal
                                   salamander, sharp glowing eyes + brows, inflatable orange
                                   throat-sac, 3 brass kettle chimneys & gripping wall claws!
  7. `enemy_siphon_warden.glb`   — De-cluttered Obsidian & Royal-Gold Sovereign Boss with a
                                   giant unobstructed expressive Cyclops Eye-Visor (+ shutter
                                   eyelids), 3 distinct breakable Sea-Glass Aegis shield
                                   plates, chunky beveled pincer-tentacles & Act 1–5 crowns!

Usage (Blender 5.3 headless):
  blender-launcher.exe -b -P scripts/generate_enemies_v2.py -- --lineup <path.png>
"""

import os
import sys
import math
import json
import struct
import tempfile
import traceback

import bpy
import bmesh
import numpy as np
from mathutils import Vector, Matrix

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_DIR = os.path.dirname(SCRIPT_DIR)
OUT_MODELS_DIR = os.path.join(PROJECT_DIR, "assets", "models")
TEMP_TEX_DIR = os.path.join(tempfile.gettempdir(), "tw_enemies_v2_textures")

os.makedirs(OUT_MODELS_DIR, exist_ok=True)
os.makedirs(TEMP_TEX_DIR, exist_ok=True)


# ==============================================================================
# COORDINATE, MATH & COLOR HELPERS (Canonical Three.js Y-up -> Blender Z-up)
# ==============================================================================

def v3(tx, ty, tz):
    """Converts Three.js `(x, y_up, z_fwd)` into Blender `(x, -z_fwd, y_up)`."""
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


def lerp(a, b, t):
    return a + (b - a) * t


def srgb_to_lin(c):
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def hex_rgb(hex_str):
    h = hex_str.lstrip("#")
    return np.array([int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16)], dtype=np.float32) / 255.0


def hex_lin(hex_str):
    h = hex_str.lstrip("#")
    return tuple(srgb_to_lin(int(h[i:i + 2], 16) / 255.0) for i in (0, 2, 4))


def reset_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.unit_settings.system = "METRIC"
    scene.unit_settings.scale_length = 1.0
    return scene


# ==============================================================================
# CLEAN STYLIZED NUMPY PBR TEXTURE BAKER (ZERO MUDDY CAMO NOISE!)
# ==============================================================================

def _mix(a, b, t):
    t = np.clip(t, 0.0, 1.0)
    if np.ndim(t) == 2 and (np.ndim(a) == 1 or a.shape[-1] == 3):
        t = t[..., None]
    return a * (1.0 - t) + b * t


def _sstep(e0, e1, x):
    if abs(e1 - e0) < 1e-6:
        return (x >= e0).astype(np.float32)
    t = np.clip((x - e0) / (e1 - e0), 0.0, 1.0)
    return t * t * (3.0 - 2.0 * t)


def _fbm(sz, base_freq=4, octaves=4, seed=42):
    rng = np.random.default_rng(seed)
    u = np.linspace(0.0, 1.0, sz, endpoint=False, dtype=np.float32)
    yy, xx = np.meshgrid(u, u, indexing="ij")
    tot = np.zeros((sz, sz), dtype=np.float32)
    amp, freq, nrm = 0.5, base_freq, 0.0
    for _ in range(octaves):
        g = rng.random((freq, freq), dtype=np.float32)
        gx, gy = xx * freq, yy * freq
        ix0 = np.floor(gx).astype(np.int32) % freq
        iy0 = np.floor(gy).astype(np.int32) % freq
        ix1 = (ix0 + 1) % freq
        iy1 = (iy0 + 1) % freq
        fx, fy = gx - np.floor(gx), gy - np.floor(gy)
        ux = fx * fx * (3.0 - 2.0 * fx)
        uy = fy * fy * (3.0 - 2.0 * fy)
        val = (
            (g[iy0, ix0] * (1.0 - ux) + g[iy0, ix1] * ux) * (1.0 - uy)
            + (g[iy1, ix0] * (1.0 - ux) + g[iy1, ix1] * ux) * uy
        )
        tot += val * amp
        nrm += amp
        amp *= 0.5
        freq *= 2
    return tot / max(1e-6, nrm)


def _voronoi(sz, cells=8, jitter=0.75, seed=101):
    rng = np.random.default_rng(seed)
    u = np.linspace(0.0, float(cells), sz, endpoint=False, dtype=np.float32)
    yy, xx = np.meshgrid(u, u, indexing="ij")
    cx, cy = np.floor(xx).astype(np.int32), np.floor(yy).astype(np.int32)
    ox = rng.uniform(0.5 - 0.5 * jitter, 0.5 + 0.5 * jitter, (cells, cells)).astype(np.float32)
    oy = rng.uniform(0.5 - 0.5 * jitter, 0.5 + 0.5 * jitter, (cells, cells)).astype(np.float32)
    d1 = np.full((sz, sz), 1e9, dtype=np.float32)
    d2 = np.full((sz, sz), 1e9, dtype=np.float32)
    for dy in (-1, 0, 1):
        for dx in (-1, 0, 1):
            nx, ny = (cx + dx) % cells, (cy + dy) % cells
            dist = np.hypot(xx - (cx + dx + ox[ny, nx]), yy - (cy + dy + oy[ny, nx]))
            m1 = dist < d1
            d2 = np.where(m1, d1, np.minimum(d2, dist))
            d1 = np.where(m1, dist, d1)
    return d1, d2, d2 - d1


def _box_blur(img, radius=2):
    out = img.copy()
    for _ in range(2):
        acc = np.zeros_like(out)
        cnt = 0
        for d in range(-radius, radius + 1):
            acc += np.roll(out, d, axis=1)
            cnt += 1
        out = acc / cnt
        acc = np.zeros_like(out)
        for d in range(-radius, radius + 1):
            acc += np.roll(out, d, axis=0)
        out = acc / cnt
    return out


def _rgb_to_packed_image(name, rgb_arr, non_color=False):
    h, w, _ = rgb_arr.shape
    arr = np.clip(rgb_arr, 0.0, 1.0)
    rgba = np.ones((h, w, 4), dtype=np.float32)
    rgba[:, :, :3] = arr[::-1, :, :]
    img = bpy.data.images.new(name, width=w, height=h, alpha=False, float_buffer=False)
    img.colorspace_settings.name = "Non-Color" if non_color else "sRGB"
    img.pixels.foreach_set(rgba.ravel())
    tmp_path = os.path.join(TEMP_TEX_DIR, f"{name}.png")
    img.filepath_raw = tmp_path
    img.file_format = "PNG"
    img.save()
    img.pack()
    return img


def bake_pbr_bundle(name, alb, hmap, rgh, met, emi=None, n_str=1.8):
    dx = (np.roll(hmap, -1, axis=1) - np.roll(hmap, 1, axis=1)) * n_str
    dy = (np.roll(hmap, -1, axis=0) - np.roll(hmap, 1, axis=0)) * n_str
    inv = 1.0 / np.sqrt(dx * dx + dy * dy + 1.0)
    nrm = np.stack([0.5 - 0.5 * dx * inv, 0.5 + 0.5 * dy * inv, 0.5 + 0.5 * inv], axis=-1)
    ao = np.clip(0.90 + (hmap - _box_blur(hmap, 3)) * 0.85, 0.48, 1.0)
    alb_b = np.clip(alb * (0.80 + 0.20 * ao[..., None]), 0.0, 1.0)
    orm = np.stack([ao, np.clip(rgh, 0.10, 0.90), np.clip(met, 0.0, 1.0)], axis=-1)

    bundle = {
        "albedo": _rgb_to_packed_image(f"v2_{name}_albedo", alb_b, non_color=False),
        "normal": _rgb_to_packed_image(f"v2_{name}_normal", np.clip(nrm, 0.0, 1.0), non_color=True),
        "orm": _rgb_to_packed_image(f"v2_{name}_orm", orm, non_color=True),
    }
    if emi is not None and float(np.max(emi)) > 0.005:
        bundle["emissive"] = _rgb_to_packed_image(f"v2_{name}_emissive", np.clip(emi, 0.0, 1.0), non_color=False)
    return bundle


def bake_stylized_eye_bundle(
    name,
    sclera_hex="#fffbe6",
    iris_outer_hex="#f59e0b",
    iris_inner_hex="#fef08a",
    pupil_hex="#0e0b16",
    pupil_kind="round",
    iris_rad=0.36,
    pupil_rad=0.19,
    emissive_boost=0.72,
    size=192,
):
    """Bakes a super-expressive Pixar/Nintendo cartoon eye with jewel iris & dual catchlights!"""
    u = np.linspace(-0.5, 0.5, size, dtype=np.float32)
    yy, xx = np.meshgrid(u, u, indexing="ij")
    rr = np.hypot(xx, yy)
    ang = np.arctan2(yy, xx)

    sclera = hex_rgb(sclera_hex)[None, None, :]
    lid_shadow = _sstep(-0.20, -0.47, yy) * 0.14 + _sstep(0.38, 0.50, rr) * 0.16
    col = sclera * (1.0 - lid_shadow[..., None])

    iris_mask = 1.0 - _sstep(iris_rad - 0.018, iris_rad + 0.012, rr)
    limbal = _sstep(iris_rad - 0.055, iris_rad - 0.008, rr) * iris_mask
    iris_t = np.clip(rr / max(1e-4, iris_rad), 0.0, 1.0)
    fiber = 0.5 + 0.5 * np.sin(ang * 16.0 + iris_t * 5.0)
    iris_col = _mix(hex_rgb(iris_inner_hex), hex_rgb(iris_outer_hex), iris_t ** 0.85)
    iris_col = iris_col * (0.90 + 0.16 * fiber[..., None])
    lower_glow = _sstep(0.0, 0.22, yy) * (1.0 - _sstep(iris_rad * 0.92, iris_rad, rr))
    iris_col = np.clip(iris_col + hex_rgb(iris_inner_hex)[None, None, :] * (lower_glow[..., None] * 0.35), 0.0, 1.0)
    iris_col = _mix(iris_col, hex_rgb("#1c1520"), limbal * 0.72)
    col = _mix(col, iris_col, iris_mask)

    if pupil_kind == "slit":
        pr = np.hypot(xx * 2.0, yy * 0.84)
        p_mask = 1.0 - _sstep(pupil_rad - 0.015, pupil_rad + 0.015, pr)
    elif pupil_kind == "cyclops":
        ring1 = np.exp(-((rr - 0.37) / 0.018) ** 2)
        ring2 = np.exp(-((rr - 0.25) / 0.015) ** 2)
        ticks = (np.abs(np.sin(ang * 6.0)) < 0.14).astype(np.float32) * _sstep(0.24, 0.27, rr) * (1.0 - _sstep(0.36, 0.39, rr))
        col = _mix(col, hex_rgb("#fef08a"), np.clip((ring1 + ring2 * 0.75 + ticks * 0.70), 0.0, 1.0))
        pr = np.hypot(xx * 1.08, yy * 1.08)
        p_mask = 1.0 - _sstep(pupil_rad - 0.015, pupil_rad + 0.015, pr)
    else:
        pr = np.hypot(xx * 1.02, yy * 0.98)
        p_mask = 1.0 - _sstep(pupil_rad - 0.014, pupil_rad + 0.014, pr)
    col = _mix(col, hex_rgb(pupil_hex), p_mask)

    # Twin crisp pure-white specular catchlights
    glint1 = 1.0 - _sstep(0.055, 0.074, np.hypot(xx + 0.11, yy + 0.11))
    glint2 = 1.0 - _sstep(0.025, 0.040, np.hypot(xx - 0.12, yy - 0.10))
    glint = np.clip(glint1 + glint2 * 0.92, 0.0, 1.0)
    white = np.array([1.0, 1.0, 1.0], dtype=np.float32)
    col = _mix(col, white, glint)

    emi = iris_col * (iris_mask[..., None] * (1.0 - p_mask[..., None]) * emissive_boost)
    emi = np.clip(emi + sclera * ((1.0 - iris_mask[..., None]) * 0.20) + white[None, None, :] * (glint[..., None] * 0.95), 0.0, 1.0)

    hmap = np.full((size, size), 0.5, dtype=np.float32) + iris_mask * 0.04
    rgh = np.full((size, size), 0.08, dtype=np.float32)
    met = np.full((size, size), 0.04, dtype=np.float32)
    return bake_pbr_bundle(name, col, hmap, rgh, met, emi=emi, n_str=0.6)


def bake_gold_brass_bundle(name="gold_brass", base_hex="#f6be42", warm_hex="#c6801d", size=192):
    n1 = _fbm(size, 4, 3, 701)
    u = np.linspace(0.0, 1.0, size, endpoint=False, dtype=np.float32)
    yy, _ = np.meshgrid(u, u, indexing="ij")
    brush = 0.5 + 0.5 * np.sin(yy * math.pi * 18.0 + n1 * 3.0)
    alb = _mix(hex_rgb(warm_hex), hex_rgb(base_hex), 0.48 + 0.38 * n1 + 0.14 * brush)
    hmap = 0.5 + n1 * 0.14 + brush * 0.03
    rgh = 0.20 + (1.0 - n1) * 0.10
    met = np.full((size, size), 0.88, dtype=np.float32)
    return bake_pbr_bundle(name, alb, hmap, rgh, met, emi=None, n_str=0.9)


# ==============================================================================
# MATERIAL & BMESH PRIMITIVE BUILDERS
# ==============================================================================

def make_pbr_mat(
    name,
    hex_color="#ffffff",
    roughness=0.34,
    metallic=0.0,
    coat=0.0,
    coat_rough=0.18,
    emission_hex=None,
    emission_strength=0.0,
    alpha=1.0,
    tex_bundle=None,
    normal_strength=0.9,
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

    if coat > 0.0:
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

    if tex_bundle is not None:
        if tex_bundle.get("albedo") is not None:
            ta = nt.nodes.new("ShaderNodeTexImage")
            ta.image = tex_bundle["albedo"]
            nt.links.new(ta.outputs["Color"], bsdf.inputs["Base Color"])

        if tex_bundle.get("orm") is not None:
            to = nt.nodes.new("ShaderNodeTexImage")
            to.image = tex_bundle["orm"]
            sep = nt.nodes.new("ShaderNodeSeparateColor")
            if hasattr(sep, "mode"):
                sep.mode = "RGB"
            nt.links.new(to.outputs["Color"], sep.inputs["Color"])
            nt.links.new(sep.outputs["Green"], bsdf.inputs["Roughness"])
            nt.links.new(sep.outputs["Blue"], bsdf.inputs["Metallic"])

        if tex_bundle.get("normal") is not None:
            tn = nt.nodes.new("ShaderNodeTexImage")
            tn.image = tex_bundle["normal"]
            nn = nt.nodes.new("ShaderNodeNormalMap")
            nn.inputs["Strength"].default_value = normal_strength
            nt.links.new(tn.outputs["Color"], nn.inputs["Color"])
            nt.links.new(nn.outputs["Normal"], bsdf.inputs["Normal"])

        if tex_bundle.get("emissive") is not None and emission_strength > 0.0:
            te = nt.nodes.new("ShaderNodeTexImage")
            te.image = tex_bundle["emissive"]
            if "Emission Color" in bsdf.inputs:
                nt.links.new(te.outputs["Color"], bsdf.inputs["Emission Color"])
                bsdf.inputs["Emission Strength"].default_value = emission_strength

    return mat


def assign_triplanar_uvs(bm, scale=1.55):
    uv_layer = bm.loops.layers.uv.verify()
    center = Vector((0.0, 0.0, 0.0))
    if bm.verts:
        center = sum((v.co for v in bm.verts), Vector()) / len(bm.verts)
    for f in bm.faces:
        n = f.normal
        ax, ay, az = abs(n.x), abs(n.y), abs(n.z)
        for loop in f.loops:
            d = loop.vert.co - center
            if az >= ax and az >= ay:
                u, v = d.x * scale + 0.5, d.y * scale + 0.5
            elif ax >= ay:
                u, v = d.y * scale + 0.5, d.z * scale + 0.5
            else:
                u, v = d.x * scale + 0.5, d.z * scale + 0.5
            loop[uv_layer].uv = (u, v)


def project_eye_uvs(bm, faces, center_t3, rx, ry=None):
    uv_layer = bm.loops.layers.uv.verify()
    cx, cy, _ = center_t3
    ry = rx if ry is None else ry
    inv_rx = 0.47 / max(1e-4, rx)
    inv_ry = 0.47 / max(1e-4, ry)
    for f in faces:
        for lp in f.loops:
            tx = lp.vert.co.x
            ty = lp.vert.co.z
            u = max(0.01, min(0.99, 0.5 + (tx - cx) * inv_rx))
            v = max(0.01, min(0.99, 0.5 + (ty - cy) * inv_ry))
            lp[uv_layer].uv = (u, v)


def make_empty_node(name, pos=(0.0, 0.0, 0.0), rot=(0.0, 0.0, 0.0), parent=None):
    obj = bpy.data.objects.new(name, None)
    obj.empty_display_size = 0.05
    obj.location = v3(*pos)
    obj.rotation_euler = rot3(*rot)
    if parent is not None:
        obj.parent = parent
    bpy.context.collection.objects.link(obj)
    return obj


def finalize_mesh_obj(
    name,
    bm,
    materials,
    pos=(0.0, 0.0, 0.0),
    rot=(0.0, 0.0, 0.0),
    parent=None,
    smooth=True,
    uv_scale=1.55,
    keep_custom_uvs=False,
):
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    if not keep_custom_uvs:
        assign_triplanar_uvs(bm, scale=uv_scale)

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


def add_swept_curve(bm, pts_t3, radii, segs=8, up_t3=(0.0, 1.0, 0.0), cap_start=True, cap_end=True, mat_idx=0):
    pts = [Vector(p) for p in pts_t3]
    cnt = len(pts)
    if cnt < 2:
        return []

    r_list = []
    is_per_station = (
        isinstance(radii, (list, tuple))
        and len(radii) == cnt
        and not (cnt == 2 and isinstance(radii, tuple) and isinstance(radii[0], (int, float)))
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


def add_ellipsoid(bm, center_t3, radii_t3, u_segs=14, v_segs=9, mat_idx=0):
    cx, cy, cz = center_t3
    rx, ry, rz = radii_t3
    rings = []
    for iv in range(1, v_segs):
        phi = -math.pi * 0.5 + (iv / float(v_segs)) * math.pi
        cphi, sphi = math.cos(phi), math.sin(phi)
        ring = [
            (
                cx + rx * cphi * math.cos((2.0 * math.pi * iu) / u_segs),
                cy + ry * sphi,
                cz + rz * cphi * math.sin((2.0 * math.pi * iu) / u_segs),
            )
            for iu in range(u_segs)
        ]
        rings.append(ring)
    return add_loft_rings(bm, rings, closed=True, cap_start=True, cap_end=True, mat_idx=mat_idx)


def add_bevel_box(bm, center_t3, size_t3, bevel=0.012, segs=1, rot_t3=(0.0, 0.0, 0.0), mat_idx=0):
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


def add_torus_ring(bm, center_t3, major_r, minor_r, segs_u=16, segs_v=6, rot_t3=(0.0, 0.0, 0.0), mat_idx=0):
    rmat = rot3(*rot_t3).to_matrix() if any(abs(a) > 1e-6 for a in rot_t3) else Matrix.Identity(3)
    c_bl = v3(*center_t3)
    v_rings = []
    for iu in range(segs_u):
        au = (2.0 * math.pi * iu) / segs_u
        cu, su = math.cos(au), math.sin(au)
        ring = []
        for iv in range(segs_v):
            av = (2.0 * math.pi * iv) / segs_v
            cv, sv = math.cos(av), math.sin(av)
            tx = (major_r + minor_r * cv) * cu
            ty = minor_r * sv
            tz = (major_r + minor_r * cv) * su
            p_bl = rmat @ v3(tx, ty, tz) + c_bl
            ring.append(bm.verts.new(p_bl))
        v_rings.append(ring)
    created = []
    for iu in range(segs_u):
        r0 = v_rings[iu]
        r1 = v_rings[(iu + 1) % segs_u]
        for iv in range(segs_v):
            ivn = (iv + 1) % segs_v
            try:
                f = bm.faces.new([r0[iv], r0[ivn], r1[ivn], r1[iv]])
                f.material_index = mat_idx
                created.append(f)
            except ValueError:
                pass
    return created


def export_glb_and_inspect(filepath):
    bpy.ops.export_scene.gltf(
        filepath=filepath,
        export_format="GLB",
        export_yup=True,
        export_apply=False,
        export_texcoords=True,
        export_normals=True,
        export_materials="EXPORT",
    )
    size_bytes = os.path.getsize(filepath)
    with open(filepath, "rb") as f:
        _, _, _ = struct.unpack("<III", f.read(12))
        chunk_len, _ = struct.unpack("<II", f.read(8))
        gltf_json = json.loads(f.read(chunk_len).decode("utf-8"))

    nodes = [n.get("name", "") for n in gltf_json.get("nodes", [])]
    mats = [m.get("name", "") for m in gltf_json.get("materials", [])]
    images = len(gltf_json.get("images", []))
    accs = gltf_json.get("accessors", [])
    tris = 0
    for mesh in gltf_json.get("meshes", []):
        for prim in mesh.get("primitives", []):
            if "indices" in prim:
                tris += accs[prim["indices"]]["count"] // 3
            elif "POSITION" in prim.get("attributes", {}):
                tris += accs[prim["attributes"]["POSITION"]]["count"] // 3

    bpy.context.view_layer.update()
    xs, ys, zs = [], [], []
    for obj in bpy.context.scene.objects:
        if obj.type != "MESH":
            continue
        mw = obj.matrix_world
        for corner in obj.bound_box:
            wc = mw @ Vector(corner)
            xs.append(wc.x)
            ys.append(wc.z)
            zs.append(-wc.y)

    bbox = {
        "min": [round(min(xs), 4), round(min(ys), 4), round(min(zs), 4)] if xs else [0, 0, 0],
        "max": [round(max(xs), 4), round(max(ys), 4), round(max(zs), 4)] if xs else [0, 0, 0],
    }

    return {
        "file": os.path.basename(filepath),
        "bytes": size_bytes,
        "triangles": tris,
        "images": images,
        "nodes": nodes,
        "materials": mats,
        "bbox": bbox,
    }


# ==============================================================================
# ENEMY 1: `snap_crab` — Grumpy Crimson-Coral Crustacean Brawler
# ==============================================================================

def build_enemy_snap_crab():
    reset_scene()

    # Rich Saturated Glossy Candy-Crimson -> Tangerine-Coral Carapace!
    sz = 256
    u = np.linspace(0.0, 1.0, sz, endpoint=False, dtype=np.float32)
    yy, xx = np.meshgrid(u, u, indexing="ij")
    n1 = _fbm(sz, 4, 3, 101)
    d1, _, _ = _voronoi(sz, 8, 0.72, 107)
    spots = _sstep(0.22, 0.10, d1) * 0.22
    shell_alb = _mix(hex_rgb("#c81428"), hex_rgb("#ff5232"), np.clip(0.28 + 0.58 * n1 + spots, 0.0, 1.0))
    shell_alb = _mix(shell_alb, hex_rgb("#ff8a5b"), spots * 0.40)
    shell_h = 0.5 + n1 * 0.12 + spots * 0.08
    shell_r = 0.22 + (1.0 - n1) * 0.10
    shell_m = np.full((sz, sz), 0.14, dtype=np.float32)
    tex_shell = bake_pbr_bundle("crab_shell", shell_alb, shell_h, shell_r, shell_m, n_str=1.2)

    # Inviting Glowing Sea-Mint Aqua Spring-Belly Cushion with concentric gold/aqua target rings!
    ux, uy = xx - 0.5, yy - 0.5
    rr = np.hypot(ux, uy)
    ring_a = np.exp(-((rr - 0.34) / 0.032) ** 2)
    ring_b = np.exp(-((rr - 0.19) / 0.028) ** 2)
    center_dot = 1.0 - _sstep(0.06, 0.09, rr)
    belly_alb = _mix(hex_rgb("#0cb8b0"), hex_rgb("#22f5e6"), 1.0 - np.clip(rr * 1.9, 0.0, 1.0))
    belly_alb = _mix(belly_alb, hex_rgb("#fef08a"), np.clip(ring_a * 0.82 + center_dot * 0.92, 0.0, 1.0))
    belly_alb = _mix(belly_alb, hex_rgb("#e0fffe"), ring_b * 0.85)
    belly_emi = belly_alb * (0.65 + 0.35 * np.clip(ring_a + ring_b + center_dot, 0.0, 1.0))[..., None]
    tex_belly = bake_pbr_bundle(
        "crab_belly", belly_alb, 0.5 + ring_a * 0.22 + ring_b * 0.18,
        np.full((sz, sz), 0.16, np.float32), np.full((sz, sz), 0.08, np.float32), emi=belly_emi, n_str=1.5
    )

    tex_brass = bake_gold_brass_bundle("crab_brass", "#f6be42", "#c78522")
    tex_eye = bake_stylized_eye_bundle(
        "crab_eye",
        sclera_hex="#fffbe6",
        iris_outer_hex="#f59e0b",
        iris_inner_hex="#fef08a",
        pupil_hex="#150d12",
        pupil_kind="round",
        iris_rad=0.37,
        pupil_rad=0.19,
        emissive_boost=0.78,
    )

    mat_shell = make_pbr_mat("mat_crab_carapace", "#dc2638", roughness=0.24, metallic=0.14, coat=0.55, tex_bundle=tex_shell, normal_strength=0.9)
    mat_brass = make_pbr_mat("mat_crab_brass", "#f5b83d", roughness=0.22, metallic=0.88, tex_bundle=tex_brass, normal_strength=0.8)
    mat_cream = make_pbr_mat("mat_crab_cream", "#fff3e2", roughness=0.32, metallic=0.04, coat=0.25)
    mat_frown = make_pbr_mat("mat_crab_frown", "#3a1019", roughness=0.35)
    mat_belly = make_pbr_mat("mat_crab_bounce_pad", "#14f1d9", roughness=0.16, metallic=0.08, emission_hex="#14f1d9", emission_strength=1.15, tex_bundle=tex_belly)
    mat_spark = make_pbr_mat("mat_crab_spark", "#38bdf8", roughness=0.10, emission_hex="#22f0e8", emission_strength=1.35)
    mat_eye = make_pbr_mat("mat_crab_eye", "#fef08a", roughness=0.06, coat=0.85, emission_hex="#fde047", emission_strength=0.90, tex_bundle=tex_eye, normal_strength=0.35)

    root = make_empty_node("SnapCrabRoot", (0.0, 0.0, 0.0))

    # 1. Chunky Glossy Domed Crimson-Coral Carapace + Cream Lower Face + Grumpy Mouth (`carapace`)
    bm_car = bmesh.new()
    car_stations = [
        (0.155, 0.30, 0.24),
        (0.230, 0.395, 0.310),
        (0.325, 0.385, 0.300),
        (0.425, 0.300, 0.240),
        (0.500, 0.175, 0.140),
        (0.540, 0.065, 0.052),
    ]
    rings = []
    for y, rx, rz in car_stations:
        ring = []
        for s in range(18):
            a = (2.0 * math.pi * s) / 18.0
            scallop = 1.0 + 0.045 * math.cos(a * 6.0)
            ring.append((math.cos(a) * rx * scallop, y, math.sin(a) * rz * scallop))
        rings.append(ring)
    add_loft_rings(bm_car, rings, closed=True, cap_start=True, cap_end=True, mat_idx=0)

    for sx in (-1.0, 1.0):
        for ang, sc in ((-0.35, 1.0), (0.05, 1.15), (0.42, 0.95)):
            bx = sx * math.cos(ang) * 0.37
            bz = math.sin(ang) * 0.27
            add_swept_curve(bm_car, [(bx * 0.90, 0.255, bz), (bx * 1.17, 0.268, bz + 0.03)], [0.044 * sc, 0.014 * sc], segs=6, mat_idx=0)

    # Cream-Ivory sculpted cheek & grumpy scowl mouthplate!
    add_ellipsoid(bm_car, (0.0, 0.235, 0.250), (0.255, 0.092, 0.098), u_segs=14, v_segs=8, mat_idx=2)
    frown_pts = [
        (-0.155, 0.212, 0.318),
        (-0.080, 0.252, 0.346),
        (0.0, 0.264, 0.352),
        (0.080, 0.252, 0.346),
        (0.155, 0.212, 0.318),
    ]
    add_swept_curve(bm_car, frown_pts, 0.016, segs=6, mat_idx=3)
    for sx in (-0.072, 0.072):
        add_swept_curve(bm_car, [(sx, 0.242, 0.342), (sx, 0.278, 0.350)], [0.020, 0.005], segs=6, mat_idx=2)

    # Burnished-Gold Dorsal Crest, Twin Steam Exhausts & Belt
    add_bevel_box(bm_car, (0.0, 0.520, -0.02), (0.145, 0.056, 0.26), bevel=0.012, mat_idx=1)
    for sx in (-0.145, 0.145):
        add_swept_curve(bm_car, [(sx, 0.36, -0.21), (sx * 1.15, 0.52, -0.29)], [0.040, 0.048], segs=8, mat_idx=1)
        add_torus_ring(bm_car, (sx * 1.15, 0.52, -0.29), 0.048, 0.013, 12, 6, rot_t3=(0.55, 0.0, 0.0), mat_idx=1)
    belt_pts = [(math.cos((2.0 * math.pi * k) / 18) * 0.40, 0.235, math.sin((2.0 * math.pi * k) / 18) * 0.315) for k in range(19)]
    add_swept_curve(bm_car, belt_pts, 0.018, segs=6, mat_idx=1)
    finalize_mesh_obj("carapace", bm_car, [mat_shell, mat_brass, mat_cream, mat_frown], parent=root, uv_scale=1.5)

    # 2. Bright Inviting Aqua Spring-Belly Cushion underneath (`belly_pad`)
    bm_pad = bmesh.new()
    pad_faces = add_ellipsoid(bm_pad, (0.0, 0.145, 0.0), (0.285, 0.056, 0.230), u_segs=16, v_segs=8, mat_idx=0)
    uv_l = bm_pad.loops.layers.uv.verify()
    for f in pad_faces:
        for lp in f.loops:
            lp[uv_l].uv = (0.5 + lp.vert.co.x / 0.58, 0.5 + lp.vert.co.y / 0.47)
    ring_f = add_torus_ring(bm_pad, (0.0, 0.135, 0.0), 0.265, 0.025, 18, 6, mat_idx=1)
    for f in ring_f:
        for lp in f.loops:
            lp[uv_l].uv = (0.5, 0.5)
    finalize_mesh_obj("belly_pad", bm_pad, [mat_belly, mat_brass], parent=root, keep_custom_uvs=True)

    # 3. Big Glossy Yellow Expressive Eyes (`eye_stalk_L/R`) + Bold Angry Hinged V-Brows (`brow_L/R`)
    for tag, sx in (("L", -0.122), ("R", 0.122)):
        bm_e = bmesh.new()
        add_swept_curve(bm_e, [(0.0, 0.0, 0.0), (0.0, 0.088, 0.032)], [0.032, 0.038], segs=8, mat_idx=0)
        add_torus_ring(bm_e, (0.0, 0.115, 0.044), 0.072, 0.015, 14, 6, rot_t3=(math.pi * 0.5, 0.0, 0.0), mat_idx=1)
        assign_triplanar_uvs(bm_e, scale=2.0)
        eye_f = add_ellipsoid(bm_e, (0.0, 0.115, 0.050), (0.072, 0.076, 0.058), u_segs=14, v_segs=10, mat_idx=2)
        bmesh.ops.recalc_face_normals(bm_e, faces=bm_e.faces)
        project_eye_uvs(bm_e, eye_f, (0.0, 0.115, 0.050), 0.072, 0.076)
        finalize_mesh_obj(
            f"eye_stalk_{tag}", bm_e, [mat_shell, mat_brass, mat_eye],
            pos=(sx, 0.365, 0.190), parent=root, keep_custom_uvs=True
        )

        # Bold Expressive V-Scowl Eyebrow Shields (`\ /` grumpy brawler energy!)
        bm_b = bmesh.new()
        s_sign = -1.0 if tag == "L" else 1.0
        add_bevel_box(bm_b, (0.0, 0.0, 0.0), (0.165, 0.048, 0.068), bevel=0.012, rot_t3=(0.16, 0.0, s_sign * 0.32), mat_idx=0)
        add_bevel_box(bm_b, (0.0, 0.020, 0.014), (0.172, 0.020, 0.052), bevel=0.006, rot_t3=(0.16, 0.0, s_sign * 0.32), mat_idx=1)
        finalize_mesh_obj(f"brow_{tag}", bm_b, [mat_shell, mat_brass], pos=(sx * 0.96, 0.548, 0.252), parent=root, uv_scale=2.2)

    # 4. Oversized Articulated Brass-Rimmed Snapping Pincers (`arm_L/R`, `pincer_upper/lower`)
    for tag, sx in (("L", -1.0), ("R", 1.0)):
        arm_node = make_empty_node(f"arm_{tag}", (sx * 0.28, 0.24, 0.17), parent=root)
        bm_arm = bmesh.new()
        add_ellipsoid(bm_arm, (sx * 0.04, 0.0, 0.04), (0.080, 0.070, 0.090), u_segs=10, v_segs=7, mat_idx=0)
        add_bevel_box(bm_arm, (sx * 0.06, 0.0, 0.15), (0.140, 0.122, 0.148), bevel=0.018, mat_idx=1)
        finalize_mesh_obj(f"arm_boom_{tag}", bm_arm, [mat_shell, mat_brass], parent=arm_node, uv_scale=1.9)

        # Oversized Heroic Boxing Upper Crusher Claw with Brass Rim & Ivory Teeth!
        bm_up = bmesh.new()
        add_swept_curve(
            bm_up,
            [(0.0, 0.0, 0.0), (sx * 0.02, 0.102, 0.12), (-sx * 0.06, 0.088, 0.25), (-sx * 0.16, 0.018, 0.32)],
            [(0.094, 0.072), (0.102, 0.078), (0.072, 0.056), (0.022, 0.020)],
            segs=10,
            mat_idx=0,
        )
        add_swept_curve(
            bm_up,
            [(0.0, 0.056, 0.02), (sx * 0.02, 0.152, 0.13), (-sx * 0.07, 0.120, 0.26)],
            [0.036, 0.040, 0.018],
            segs=6,
            mat_idx=1,
        )
        for ti in range(3):
            tz = 0.08 + ti * 0.065
            tx = -sx * (0.01 + ti * 0.040)
            add_swept_curve(bm_up, [(tx, 0.015, tz), (tx - sx * 0.01, -0.030, tz + 0.008)], [0.022, 0.006], segs=5, mat_idx=2)
        finalize_mesh_obj(
            f"pincer_upper_{tag}", bm_up, [mat_shell, mat_brass, mat_cream],
            pos=(sx * 0.05, 0.024, 0.205), parent=arm_node, uv_scale=1.8
        )

        bm_lo = bmesh.new()
        add_swept_curve(
            bm_lo,
            [(0.0, 0.0, 0.0), (sx * 0.01, -0.072, 0.11), (-sx * 0.14, -0.014, 0.27)],
            [(0.072, 0.052), (0.066, 0.046), (0.020, 0.016)],
            segs=8,
            mat_idx=1,
        )
        for ti in range(2):
            tz = 0.09 + ti * 0.066
            tx = -sx * (0.02 + ti * 0.038)
            add_swept_curve(bm_lo, [(tx, -0.012, tz), (tx - sx * 0.01, 0.028, tz + 0.008)], [0.020, 0.005], segs=5, mat_idx=2)
        finalize_mesh_obj(
            f"pincer_lower_{tag}", bm_lo, [mat_shell, mat_brass, mat_cream],
            pos=(sx * 0.05, -0.030, 0.205), parent=arm_node, uv_scale=1.9
        )

    bm_sp = bmesh.new()
    add_ellipsoid(bm_sp, (0.0, 0.0, 0.0), (0.042, 0.042, 0.042), u_segs=8, v_segs=6, mat_idx=0)
    finalize_mesh_obj("claw_spark", bm_sp, mat_spark, pos=(0.0, 0.25, 0.50), parent=root)

    # 5. 6 Chunky Articulated Legs — Grounded squarely at `y == 0.000`!
    z_offsets = [0.11, -0.01, -0.13]
    x_spreads = [0.23, 0.26, 0.22]
    z_sweeps = [0.08, 0.0, -0.09]
    for idx_l in range(3):
        for tag, sx in (("L", -1.0), ("R", 1.0)):
            hip_x, hip_y, hip_z = sx * 0.27, 0.20, z_offsets[idx_l]
            rx, rz = sx * x_spreads[idx_l], z_sweeps[idx_l]
            bm_leg = bmesh.new()
            add_ellipsoid(bm_leg, (sx * 0.02, 0.01, 0.0), (0.048, 0.042, 0.044), u_segs=8, v_segs=6, mat_idx=1)
            add_swept_curve(
                bm_leg,
                [(0.0, 0.0, 0.0), (rx * 0.56, 0.082, rz * 0.5), (rx, -0.045, rz * 0.85), (rx * 0.94, -hip_y + 0.014, rz)],
                [(0.042, 0.046), (0.046, 0.050), (0.034, 0.036), (0.018, 0.014)],
                segs=7,
                mat_idx=0,
            )
            add_ellipsoid(bm_leg, (rx * 0.94, -hip_y + 0.018, rz), (0.026, 0.018, 0.026), u_segs=8, v_segs=6, mat_idx=1)
            finalize_mesh_obj(
                f"leg_{tag}{idx_l + 1}", bm_leg, [mat_shell, mat_brass],
                pos=(hip_x, hip_y, hip_z), parent=root, uv_scale=2.0
            )

    return export_glb_and_inspect(os.path.join(OUT_MODELS_DIR, "enemy_snap_crab.glb"))


# ==============================================================================
# ENEMY 2: `gulp_hopper` — Adorable-Goofy Emerald/Violet Puffer Bullfrog
# ==============================================================================

def build_enemy_gulp_hopper():
    reset_scene()

    # Lush Sunny Pixar Emerald-Lime with playful subtle Royal-Violet frog spots (unmistakably vibrant GREEN frog!)
    sz = 256
    n1 = _fbm(sz, 4, 3, 201)
    d1, _, _ = _voronoi(sz, 5, 0.72, 209)
    spots = _sstep(0.17, 0.08, d1)
    skin_alb = _mix(hex_rgb("#16a34a"), hex_rgb("#4ade80"), np.clip(0.35 + 0.55 * n1, 0.0, 1.0))
    skin_alb = _mix(skin_alb, hex_rgb("#8b5cf6"), spots * 0.72)
    skin_h = 0.5 + n1 * 0.10 + spots * 0.06
    skin_r = 0.24 + (1.0 - n1) * 0.08
    skin_m = np.full((sz, sz), 0.05, dtype=np.float32)
    tex_skin = bake_pbr_bundle("hopper_skin", skin_alb, skin_h, skin_r, skin_m, n_str=0.9)

    # Rich swirling bubbly aqua-teal texture for the expandable balloon throat-sac & belly (NOT flat blown-out cyan!)
    u = np.linspace(0.0, 1.0, sz, endpoint=False, dtype=np.float32)
    yy, xx = np.meshgrid(u, u, indexing="ij")
    bn = _fbm(sz, 5, 3, 223)
    bd1, _, _ = _voronoi(sz, 8, 0.85, 229)
    bub = _sstep(0.18, 0.08, bd1) * _sstep(0.03, 0.07, bd1)
    wat_alb = _mix(hex_rgb("#0891b2"), hex_rgb("#22f0e8"), np.clip(0.35 + 0.55 * bn, 0.0, 1.0))
    wat_alb = _mix(wat_alb, hex_rgb("#e0fffe"), bub * 0.85)
    wat_emi = wat_alb * (0.48 + 0.35 * bub[..., None])
    tex_water = bake_pbr_bundle("hopper_water", wat_alb, 0.5 + bub * 0.20, np.full((sz, sz), 0.12, np.float32), np.full((sz, sz), 0.08, np.float32), emi=wat_emi, n_str=1.0)

    tex_brass = bake_gold_brass_bundle("hopper_brass", "#fbbf24", "#d99124")
    tex_eye = bake_stylized_eye_bundle(
        "hopper_eye",
        sclera_hex="#fffef0",
        iris_outer_hex="#f59e0b",
        iris_inner_hex="#fef08a",
        pupil_hex="#130f22",
        pupil_kind="round",
        iris_rad=0.40,
        pupil_rad=0.22,
        emissive_boost=0.82,
    )

    mat_skin = make_pbr_mat("mat_hopper_shell", "#18c97e", roughness=0.24, metallic=0.05, coat=0.55, tex_bundle=tex_skin, normal_strength=0.8)
    mat_violet = make_pbr_mat("mat_hopper_violet", "#8b5cf6", roughness=0.26, metallic=0.12, coat=0.45)
    mat_brass = make_pbr_mat("mat_hopper_brass", "#fbbf24", roughness=0.20, metallic=0.88, tex_bundle=tex_brass)
    mat_tongue = make_pbr_mat("mat_hopper_tongue", "#fb7185", roughness=0.22, coat=0.65, emission_hex="#f43f5e", emission_strength=0.25)
    mat_mouth_in = make_pbr_mat("mat_hopper_mouth", "#581c45", roughness=0.45)
    mat_glass = make_pbr_mat("mat_hopper_glass", "#bae6fd", roughness=0.08, metallic=0.08, alpha=0.24)
    mat_water = make_pbr_mat("mat_hopper_water", "#22f0e8", roughness=0.14, metallic=0.08, alpha=0.92, emission_hex="#14f1d9", emission_strength=0.72, tex_bundle=tex_water)
    mat_foam = make_pbr_mat("mat_hopper_foam", "#e0fffe", roughness=0.15, emission_hex="#5efce8", emission_strength=0.75)
    mat_eye = make_pbr_mat("mat_hopper_eye", "#fde047", roughness=0.06, coat=0.85, emission_hex="#fbbf24", emission_strength=0.92, tex_bundle=tex_eye, normal_strength=0.35)

    root = make_empty_node("GulpHopperRoot", (0.0, 0.0, 0.0))
    body_pivot = make_empty_node("hopper_body", (0.0, 0.0, 0.0), parent=root)

    # 1. Plump Adorable Emerald-Jade Bullfrog Head & Back with Violet Shoulder Accents (`hopper_torso`)
    bm_top = bmesh.new()
    add_ellipsoid(bm_top, (0.0, 0.45, -0.02), (0.315, 0.185, 0.265), u_segs=16, v_segs=10, mat_idx=0)
    # Plump cheeky rosy-emerald frog cheeks!
    for sx in (-0.245, 0.245):
        add_ellipsoid(bm_top, (sx, 0.39, 0.135), (0.110, 0.084, 0.098), u_segs=12, v_segs=8, mat_idx=0)
        # Playful Royal-Violet shoulder crest pads
        add_ellipsoid(bm_top, (sx * 0.90, 0.44, -0.15), (0.105, 0.085, 0.105), u_segs=10, v_segs=7, mat_idx=1)
    # Cute sunny gold crown-cap & siphon nozzle on head!
    add_torus_ring(bm_top, (0.0, 0.620, -0.03), 0.085, 0.022, 14, 6, mat_idx=2)
    add_swept_curve(bm_top, [(0.0, 0.60, -0.03), (0.0, 0.70, -0.06)], [0.060, 0.084], segs=10, mat_idx=2)
    for sx in (-0.065, 0.065):
        add_ellipsoid(bm_top, (sx, 0.49, 0.225), (0.018, 0.014, 0.014), u_segs=6, v_segs=5, mat_idx=1)
    # Curved gold harness ribs framing the water-balloon belly
    for ang_deg in (-65, 65, 138, -138):
        ra = math.radians(ang_deg)
        sx, sz = math.sin(ra), math.cos(ra)
        add_swept_curve(
            bm_top,
            [(sx * 0.26, 0.41, 0.05 + sz * 0.22), (sx * 0.28, 0.24, 0.08 + sz * 0.25), (sx * 0.18, 0.08, 0.05 + sz * 0.17)],
            0.016,
            segs=6,
            mat_idx=2,
        )
    finalize_mesh_obj("hopper_torso", bm_top, [mat_skin, mat_violet, mat_brass], parent=body_pivot, uv_scale=1.5)

    # 2. Wide Cheeky Smiling Bullfrog Mouth (`gulper_jaw`) + Playful Peeking Pink Tongue (`tongue_tip`)
    bm_jaw = bmesh.new()
    add_ellipsoid(bm_jaw, (0.0, -0.012, 0.105), (0.255, 0.050, 0.135), u_segs=14, v_segs=8, mat_idx=0)
    add_ellipsoid(bm_jaw, (0.0, 0.018, 0.095), (0.215, 0.028, 0.105), u_segs=12, v_segs=7, mat_idx=1)
    for sx in (-0.24, 0.24):
        add_ellipsoid(bm_jaw, (sx, 0.016, 0.045), (0.042, 0.042, 0.042), u_segs=8, v_segs=6, mat_idx=2)
    jaw_obj = finalize_mesh_obj(
        "gulper_jaw", bm_jaw, [mat_skin, mat_mouth_in, mat_brass],
        pos=(0.0, 0.382, 0.115), parent=body_pivot, uv_scale=1.8
    )

    bm_tng = bmesh.new()
    add_swept_curve(
        bm_tng,
        [(0.0, 0.014, 0.02), (0.02, 0.026, 0.14), (0.055, 0.008, 0.23)],
        [(0.052, 0.018), (0.062, 0.020), (0.042, 0.016)],
        segs=8,
        mat_idx=0,
    )
    finalize_mesh_obj("tongue_tip", bm_tng, mat_tongue, pos=(0.0, 0.012, 0.06), parent=jaw_obj)

    # 3. Giant Wide-Open Bulging Golden Frog Eyes (`eye_L/R`) + High-Perched Eyelid Hoods (`lid_L/R`)
    for tag, sx in (("L", -0.180), ("R", 0.180)):
        bm_e = bmesh.new()
        add_ellipsoid(bm_e, (0.0, -0.015, -0.025), (0.105, 0.100, 0.090), u_segs=12, v_segs=8, mat_idx=0)
        add_torus_ring(bm_e, (0.0, 0.0, 0.034), 0.092, 0.014, 14, 6, rot_t3=(math.pi * 0.5, 0.0, 0.0), mat_idx=1)
        assign_triplanar_uvs(bm_e, scale=2.0)
        eye_f = add_ellipsoid(bm_e, (0.0, 0.0, 0.042), (0.092, 0.094, 0.066), u_segs=16, v_segs=10, mat_idx=2)
        bmesh.ops.recalc_face_normals(bm_e, faces=bm_e.faces)
        project_eye_uvs(bm_e, eye_f, (0.0, 0.0, 0.042), 0.092, 0.094)
        eye_obj = finalize_mesh_obj(
            f"eye_{tag}", bm_e, [mat_skin, mat_brass, mat_eye],
            pos=(sx, 0.585, 0.125), parent=body_pivot, keep_custom_uvs=True
        )

        # Articulated Violet Eyelid Hood tilted back at rest so huge goofy eyes shine wide open!
        bm_lid = bmesh.new()
        lid_rings = []
        for iv in range(5):
            phi = 0.42 + (iv / 4.0) * (math.pi * 0.34)
            cphi, sphi = math.cos(phi), math.sin(phi)
            ring = [
                (
                    math.cos(a) * 0.099 * cphi,
                    sphi * 0.100,
                    0.038 + math.sin(a) * 0.074 * cphi,
                )
                for a in [k * math.pi / 8.0 for k in range(9)]
            ]
            lid_rings.append(ring)
        add_loft_rings(bm_lid, lid_rings, closed=False, cap_start=False, cap_end=False, mat_idx=0)
        finalize_mesh_obj(f"lid_{tag}", bm_lid, mat_violet, pos=(0.0, 0.0, 0.0), parent=eye_obj)

    # 4. Expandable Vocal Throat Sac (`throat_sac`) + Glass Belly Tank + Bubbly Water Core
    bm_sac = bmesh.new()
    add_ellipsoid(bm_sac, (0.0, 0.0, 0.0), (0.195, 0.110, 0.135), u_segs=14, v_segs=9, mat_idx=0)
    finalize_mesh_obj("throat_sac", bm_sac, mat_water, pos=(0.0, 0.31, 0.180), parent=body_pivot)

    bm_tank = bmesh.new()
    add_ellipsoid(bm_tank, (0.0, 0.0, 0.0), (0.265, 0.225, 0.255), u_segs=16, v_segs=10, mat_idx=0)
    finalize_mesh_obj("glass_belly_tank", bm_tank, mat_glass, pos=(0.0, 0.235, 0.075), parent=body_pivot)

    bm_wat = bmesh.new()
    add_ellipsoid(bm_wat, (0.0, -0.01, 0.0), (0.215, 0.180, 0.205), u_segs=14, v_segs=9, mat_idx=0)
    for bx, by, bz, br in ((-0.08, 0.06, 0.13, 0.042), (0.09, 0.04, 0.12, 0.036), (0.0, 0.10, 0.10, 0.032)):
        add_ellipsoid(bm_wat, (bx, by, bz), (br, br, br), u_segs=8, v_segs=6, mat_idx=1)
    finalize_mesh_obj("stolen_water_core", bm_wat, [mat_water, mat_foam], pos=(0.0, 0.235, 0.075), parent=body_pivot)

    # 5. Sturdy Springy Hind Legs (`hind_leg_L/R`) & Cute Fore Paws (`fore_leg_L/R`) — Grounded at `y == 0.000`!
    for tag, sx in (("L", -1.0), ("R", 1.0)):
        bm_hl = bmesh.new()
        add_ellipsoid(bm_hl, (sx * 0.075, 0.055, -0.04), (0.108, 0.118, 0.138), u_segs=12, v_segs=8, mat_idx=0)
        coil = [
            (sx * 0.13 + math.cos(s * 1.45) * 0.044, 0.04 - (s / 12.0) * 0.24, -0.06 + (s / 12.0) * 0.14 + math.sin(s * 1.45) * 0.044)
            for s in range(13)
        ]
        add_swept_curve(bm_hl, coil, 0.015, segs=5, mat_idx=2)
        add_swept_curve(bm_hl, [(sx * 0.13, 0.06, -0.07), (sx * 0.13, -0.21, 0.09)], 0.028, segs=7, mat_idx=1)
        for ti in (-1, 0, 1):
            add_swept_curve(
                bm_hl,
                [(sx * 0.13, -0.218, 0.07), (sx * 0.13 + ti * 0.068, -0.222, 0.23)],
                [(0.032, 0.020), (0.026, 0.018)],
                segs=6,
                mat_idx=0,
            )
            add_ellipsoid(bm_hl, (sx * 0.13 + ti * 0.068, -0.222, 0.24), (0.030, 0.018, 0.030), u_segs=7, v_segs=5, mat_idx=2)
        finalize_mesh_obj(
            f"hind_leg_{tag}", bm_hl, [mat_skin, mat_violet, mat_brass],
            pos=(sx * 0.24, 0.24, -0.04), parent=root, uv_scale=1.9
        )

        bm_fl = bmesh.new()
        add_swept_curve(bm_fl, [(0.0, 0.0, 0.0), (sx * 0.06, -0.10, 0.06), (sx * 0.08, -0.162, 0.10)], [0.048, 0.038, 0.034], segs=7, mat_idx=0)
        add_ellipsoid(bm_fl, (sx * 0.08, -0.164, 0.13), (0.056, 0.016, 0.064), u_segs=8, v_segs=6, mat_idx=2)
        finalize_mesh_obj(
            f"fore_leg_{tag}", bm_fl, [mat_skin, mat_violet, mat_brass],
            pos=(sx * 0.21, 0.18, 0.12), parent=root, uv_scale=2.0
        )

    return export_glb_and_inspect(os.path.join(OUT_MODELS_DIR, "enemy_gulp_hopper.glb"))


# ==============================================================================
# ENEMY 3: `volt_eel` — High-Contrast Midnight-Indigo & Electric-Cyan Moray
# ==============================================================================

def build_enemy_volt_eel():
    reset_scene()

    sz = 256
    u = np.linspace(0.0, 1.0, sz, endpoint=False, dtype=np.float32)
    yy, xx = np.meshgrid(u, u, indexing="ij")
    n1 = _fbm(sz, 4, 3, 301)
    wave_v = (yy * 3.0 + np.abs(xx - 0.5) * 1.4) % 1.0
    cyan_band = _sstep(0.14, 0.22, wave_v) * (1.0 - _sstep(0.28, 0.36, wave_v))
    yell_band = _sstep(0.21, 0.24, wave_v) * (1.0 - _sstep(0.26, 0.29, wave_v))
    eel_alb = _mix(hex_rgb("#16134a"), hex_rgb("#262278"), 0.35 + 0.55 * n1)
    eel_alb = _mix(eel_alb, hex_rgb("#00e5ff"), cyan_band * 0.88)
    eel_alb = _mix(eel_alb, hex_rgb("#fde047"), yell_band * 0.95)
    eel_emi = hex_rgb("#00f5ff")[None, None, :] * (cyan_band[..., None] * 0.72) + hex_rgb("#fde047")[None, None, :] * (yell_band[..., None] * 0.92)
    tex_eel = bake_pbr_bundle(
        "eel_body", eel_alb, 0.5 + cyan_band * 0.14 + n1 * 0.06,
        0.24 - cyan_band * 0.10, np.full((sz, sz), 0.26, np.float32), emi=eel_emi, n_str=1.1
    )

    tex_copper = bake_gold_brass_bundle("eel_copper", "#f2a641", "#b86228")
    tex_eye = bake_stylized_eye_bundle(
        "eel_eye",
        sclera_hex="#fef9c3",
        iris_outer_hex="#facc15",
        iris_inner_hex="#ffffff",
        pupil_hex="#0c0a24",
        pupil_kind="slit",
        iris_rad=0.42,
        pupil_rad=0.18,
        emissive_boost=0.98,
    )

    mat_body = make_pbr_mat("mat_eel_body", "#1e1b5e", roughness=0.24, metallic=0.28, coat=0.45, emission_hex="#00f5ff", emission_strength=0.95, tex_bundle=tex_eel, normal_strength=0.8)
    mat_copper = make_pbr_mat("mat_eel_copper", "#e59235", roughness=0.24, metallic=0.88, tex_bundle=tex_copper)
    mat_fin = make_pbr_mat("mat_eel_fin", "#00f5ff", roughness=0.14, metallic=0.12, alpha=0.88, emission_hex="#00f5ff", emission_strength=1.35)
    mat_arc = make_pbr_mat("mat_eel_arc", "#fde047", roughness=0.10, emission_hex="#fde047", emission_strength=1.65)
    mat_fang = make_pbr_mat("mat_eel_fang", "#f0fdfa", roughness=0.18, emission_hex="#7dd3fc", emission_strength=0.55)
    mat_tongue = make_pbr_mat("mat_eel_tongue", "#f472b6", roughness=0.25, emission_hex="#ec4899", emission_strength=0.35)
    mat_eye = make_pbr_mat("mat_eel_eye", "#fde047", roughness=0.06, coat=0.85, emission_hex="#fde047", emission_strength=1.30, tex_bundle=tex_eye, normal_strength=0.35)

    root = make_empty_node("VoltEelRoot", (0.0, 0.0, 0.0))

    # Segment 0: Bold Expressive Mischievous Moray Head (`seg_0`)
    seg0 = make_empty_node("seg_0", (0.0, 0.0, 0.0), parent=root)
    bm_h = bmesh.new()
    h_stations = [
        (-0.14, 0.160, 0.170),
        (-0.02, 0.192, 0.200),
        (0.11, 0.165, 0.156),
        (0.24, 0.112, 0.098),
        (0.35, 0.056, 0.048),
    ]
    h_rings = [
        [(math.cos((2.0 * math.pi * s) / 14) * rx, math.sin((2.0 * math.pi * s) / 14) * ry + 0.025, z) for s in range(14)]
        for z, rx, ry in h_stations
    ]
    add_loft_rings(bm_h, h_rings, closed=True, cap_start=True, cap_end=True, mat_idx=0)

    for sx in (-1.0, 1.0):
        for gi in range(3):
            gz = -0.02 - gi * 0.040
            add_bevel_box(bm_h, (sx * 0.178, 0.015, gz), (0.028, 0.11, 0.020), bevel=0.004, rot_t3=(0.0, sx * 0.40, 0.0), mat_idx=1)
        for fi, fz in enumerate((0.15, 0.22, 0.29)):
            fx = sx * (0.088 - fi * 0.018)
            add_swept_curve(bm_h, [(fx, -0.018, fz), (fx * 0.90, -0.072, fz - 0.012)], [0.018, 0.004], segs=5, mat_idx=4)
    assign_triplanar_uvs(bm_h, scale=1.8)

    # Bold Menacing Glowing Yellow Eyes angled slightly forward for crisp 3/4 readability!
    for sx in (-1.0, 1.0):
        eye_c = (sx * 0.128, 0.098, 0.175)
        eye_f = add_ellipsoid(bm_h, eye_c, (0.062, 0.062, 0.066), u_segs=14, v_segs=9, mat_idx=5)
        uv_l = bm_h.loops.layers.uv.verify()
        for f in eye_f:
            for lp in f.loops:
                tx = lp.vert.co.x - eye_c[0]
                ty = lp.vert.co.z - eye_c[1]
                tz = -lp.vert.co.y - eye_c[2]
                u_proj = (-sx * tz * 0.55 + tx * 0.83) * 0.46 / 0.066 + 0.5
                v_proj = ty * 0.46 / 0.062 + 0.5
                lp[uv_l].uv = (max(0.01, min(0.99, u_proj)), max(0.01, min(0.99, v_proj)))

    finalize_mesh_obj("eel_skull", bm_h, [mat_body, mat_copper, mat_arc, mat_fin, mat_fang, mat_eye], parent=seg0, keep_custom_uvs=True)

    for tag, sx in (("L", -1.0), ("R", 1.0)):
        bm_eb = bmesh.new()
        add_bevel_box(bm_eb, (0.0, 0.0, 0.0), (0.072, 0.034, 0.150), bevel=0.006, rot_t3=(0.18, sx * 0.28, -sx * 0.38), mat_idx=0)
        add_bevel_box(bm_eb, (0.0, 0.018, 0.01), (0.052, 0.014, 0.135), bevel=0.004, rot_t3=(0.18, sx * 0.28, -sx * 0.38), mat_idx=1)
        finalize_mesh_obj(f"eel_brow_{tag}", bm_eb, [mat_copper, mat_arc], pos=(sx * 0.118, 0.165, 0.172), parent=seg0)

    bm_j = bmesh.new()
    add_swept_curve(bm_j, [(0.0, 0.0, 0.0), (0.0, -0.022, 0.27)], [(0.118, 0.052), (0.048, 0.024)], segs=10, mat_idx=0)
    for sx in (-1.0, 1.0):
        for fi, fz in enumerate((0.12, 0.20)):
            fx = sx * (0.068 - fi * 0.018)
            add_swept_curve(bm_j, [(fx, 0.014, fz), (fx * 0.90, 0.064, fz - 0.008)], [0.016, 0.004], segs=5, mat_idx=1)
    jaw_obj = finalize_mesh_obj("eel_jaw", bm_j, [mat_body, mat_fang], pos=(0.0, -0.045, 0.02), parent=seg0, uv_scale=1.9)

    bm_et = bmesh.new()
    add_swept_curve(bm_et, [(0.0, 0.01, 0.04), (0.0, 0.025, 0.16), (0.02, -0.02, 0.28)], [(0.042, 0.016), (0.048, 0.018), (0.032, 0.012)], segs=7, mat_idx=0)
    finalize_mesh_obj("eel_tongue", bm_et, mat_tongue, pos=(0.0, 0.012, 0.04), parent=jaw_obj)

    for anm, sx in (("arc_antenna_L", -1.0), ("arc_antenna_R", 1.0)):
        bm_a = bmesh.new()
        add_swept_curve(bm_a, [(0.0, 0.0, 0.0), (sx * 0.12, 0.16, -0.02), (sx * 0.18, 0.28, -0.10)], [0.026, 0.016, 0.009], segs=7, mat_idx=0)
        for ri in (0.36, 0.70):
            add_torus_ring(bm_a, (sx * 0.18 * ri, 0.28 * ri, -0.10 * ri), 0.028, 0.010, 10, 5, mat_idx=0)
        add_ellipsoid(bm_a, (sx * 0.18, 0.28, -0.10), (0.038, 0.038, 0.038), u_segs=8, v_segs=6, mat_idx=1)
        finalize_mesh_obj(anm, bm_a, [mat_copper, mat_arc], pos=(sx * 0.075, 0.15, 0.09), parent=seg0)

    bm_ab = bmesh.new()
    add_swept_curve(bm_ab, [(-0.24, 0.42, -0.01), (-0.08, 0.48, 0.03), (0.08, 0.44, 0.01), (0.24, 0.42, -0.01)], 0.014, segs=5, mat_idx=0)
    finalize_mesh_obj("arc_bridge", bm_ab, mat_arc, parent=seg0)

    for k in range(1, 7):
        t = k / 7.0
        rad_x = lerp(0.132, 0.056, t)
        rad_y = lerp(0.146, 0.068, t)
        seg_len = 0.20
        bm_s = bmesh.new()
        add_swept_curve(bm_s, [(0.0, 0.0, -seg_len * 0.56), (0.0, 0.0, seg_len * 0.56)], [(rad_x * 0.92, rad_y * 0.92), (rad_x, rad_y)], segs=12, mat_idx=0)
        add_swept_curve(bm_s, [(0.0, 0.0, -0.026), (0.0, 0.0, 0.026)], (rad_x * 1.10, rad_y * 1.10), segs=12, mat_idx=1)
        fin_h = lerp(0.150, 0.088, t)
        add_swept_curve(bm_s, [(0.0, rad_y, 0.02), (0.0, rad_y + fin_h * 1.12, -0.04)], [0.020, 0.006], segs=5, mat_idx=3)
        add_swept_curve(bm_s, [(0.0, rad_y * 0.85, seg_len * 0.48), (0.0, rad_y + fin_h, -0.01), (0.0, rad_y * 0.85, -seg_len * 0.48)], [(0.009, 0.032), (0.012, 0.068), (0.009, 0.032)], segs=6, mat_idx=2)
        for sx in (-1.0, 1.0):
            add_swept_curve(bm_s, [(sx * rad_x * 0.85, 0.0, seg_len * 0.34), (sx * (rad_x + 0.095), -0.012, -0.02), (sx * rad_x * 0.80, 0.0, -seg_len * 0.36)], [(0.020, 0.007), (0.042, 0.010), (0.016, 0.007)], segs=6, mat_idx=2)
        finalize_mesh_obj(f"seg_{k}", bm_s, [mat_body, mat_copper, mat_fin, mat_arc], parent=root, uv_scale=1.9)

    bm_tail = bmesh.new()
    add_swept_curve(bm_tail, [(0.0, 0.0, 0.10), (0.0, 0.0, -0.22)], [(0.052, 0.062), (0.010, 0.016)], segs=10, mat_idx=0)
    for ry in (-0.13, 0.0, 0.13):
        add_swept_curve(bm_tail, [(0.0, 0.0, 0.05), (0.0, ry, -0.24)], [0.016, 0.005], segs=5, mat_idx=3)
    add_ellipsoid(bm_tail, (0.0, 0.0, -0.10), (0.012, 0.165, 0.19), u_segs=10, v_segs=7, mat_idx=2)
    finalize_mesh_obj("seg_7", bm_tail, [mat_body, mat_copper, mat_fin, mat_arc], parent=root, uv_scale=2.0)

    return export_glb_and_inspect(os.path.join(OUT_MODELS_DIR, "enemy_volt_eel.glb"))


# ==============================================================================
# ENEMY 4: `rail_skater` — Cocky Brass/Crimson Clockwork Wheel-Strider
# ==============================================================================

def build_enemy_rail_skater():
    reset_scene()

    sz = 256
    u = np.linspace(0.0, 1.0, sz, endpoint=False, dtype=np.float32)
    yy, xx = np.meshgrid(u, u, indexing="ij")
    n1 = _fbm(sz, 4, 3, 401)
    stripe_l = _sstep(0.39, 0.41, xx) * (1.0 - _sstep(0.45, 0.47, xx))
    stripe_r = _sstep(0.53, 0.55, xx) * (1.0 - _sstep(0.59, 0.61, xx))
    stripes = np.clip(stripe_l + stripe_r, 0.0, 1.0)
    hull_alb = _mix(hex_rgb("#be123c"), hex_rgb("#f43f5e"), 0.35 + 0.55 * n1)
    hull_alb = _mix(hull_alb, hex_rgb("#f8fafc"), stripes * 0.94)
    hull_r = 0.20 + (1.0 - stripes) * 0.08
    hull_m = np.full((sz, sz), 0.32, dtype=np.float32) * (1.0 - stripes * 0.5)
    tex_hull = bake_pbr_bundle("skater_hull", hull_alb, 0.5 + stripes * 0.08 + n1 * 0.06, hull_r, hull_m, n_str=0.9)

    tex_brass = bake_gold_brass_bundle("skater_brass", "#f6be42", "#c88622")

    mat_hull = make_pbr_mat("mat_skater_hull", "#e11d48", roughness=0.22, metallic=0.35, coat=0.65, tex_bundle=tex_hull, normal_strength=0.8)
    mat_brass = make_pbr_mat("mat_skater_brass", "#f5b83d", roughness=0.20, metallic=0.90, tex_bundle=tex_brass)
    mat_visor = make_pbr_mat("mat_skater_visor", "#090f1d", roughness=0.10, metallic=0.45, coat=0.95)
    mat_led_eye = make_pbr_mat("mat_skater_eye_led", "#22f0e8", roughness=0.06, emission_hex="#00f5ff", emission_strength=1.95)
    mat_wheel_glow = make_pbr_mat("mat_skater_wheel_glow", "#fb923c", roughness=0.12, emission_hex="#fbbf24", emission_strength=1.65)
    mat_tire = make_pbr_mat("mat_skater_tire", "#1e293b", roughness=0.45, metallic=0.15)
    mat_aqua = make_pbr_mat("mat_skater_aqua", "#22f0e8", roughness=0.10, alpha=0.86, emission_hex="#00f5ff", emission_strength=1.30)

    root = make_empty_node("RailSkaterRoot", (0.0, 0.0, 0.0))
    chassis = make_empty_node("manta_chassis", (0.0, 0.34, 0.0), parent=root)

    # 1. Leaning Aerodynamic Crimson/Brass Wheel-Strider Chassis + Aviator Goggles (`manta_hull`)
    bm_m = bmesh.new()
    m_stations = [
        (-0.28, 0.095, 0.060),
        (-0.10, 0.255, 0.130),
        (0.08, 0.275, 0.125),
        (0.24, 0.215, 0.095),
        (0.32, 0.105, 0.052),
    ]
    m_rings = [
        [(math.cos((2.0 * math.pi * s) / 12) * rx, 0.03 + math.sin((2.0 * math.pi * s) / 12) * ry, z) for s in range(12)]
        for z, rx, ry in m_stations
    ]
    add_loft_rings(bm_m, m_rings, closed=True, cap_start=True, cap_end=True, mat_idx=0)
    for sx in (-1.0, 1.0):
        add_bevel_box(bm_m, (sx * 0.30, 0.03, -0.04), (0.30, 0.042, 0.20), bevel=0.010, rot_t3=(0.0, -sx * 0.30, sx * 0.10), mat_idx=0)
        add_bevel_box(bm_m, (sx * 0.16, -0.02, 0.18), (0.09, 0.055, 0.11), bevel=0.008, mat_idx=1)
    add_bevel_box(bm_m, (0.0, 0.13, -0.14), (0.34, 0.032, 0.11), bevel=0.008, rot_t3=(-0.22, 0.0, 0.0), mat_idx=1)
    # Bold Aviator Goggles / Visor Helmet Housing + Cheeky Brass Bumper Grin!
    add_bevel_box(bm_m, (0.0, 0.060, 0.245), (0.35, 0.108, 0.090), bevel=0.020, mat_idx=2)
    add_bevel_box(bm_m, (0.0, -0.018, 0.268), (0.24, 0.026, 0.055), bevel=0.006, mat_idx=1)
    for sx in (-0.088, 0.088):
        add_torus_ring(bm_m, (sx, 0.062, 0.288), 0.068, 0.015, 14, 6, rot_t3=(math.pi * 0.5, 0.0, 0.0), mat_idx=1)
    finalize_mesh_obj("manta_hull", bm_m, [mat_hull, mat_brass, mat_visor], parent=chassis, uv_scale=1.6)

    # Expressive Glowing Dual Visor Eyes (`visor_eye_L/R`) + Cocky Angled Brow Rims + `scanner_eye`
    for tag, sx in (("L", -0.088), ("R", 0.088)):
        bm_ve = bmesh.new()
        add_ellipsoid(bm_ve, (0.0, 0.0, 0.0), (0.054, 0.044, 0.026), u_segs=12, v_segs=8, mat_idx=0)
        finalize_mesh_obj(f"visor_eye_{tag}", bm_ve, mat_led_eye, pos=(sx, 0.062, 0.295), parent=chassis)

        bm_sb = bmesh.new()
        s_sign = -1.0 if tag == "L" else 1.0
        add_bevel_box(bm_sb, (0.0, 0.0, 0.0), (0.125, 0.026, 0.044), bevel=0.006, rot_t3=(0.08, 0.0, s_sign * 0.24), mat_idx=0)
        finalize_mesh_obj(f"skater_brow_{tag}", bm_sb, mat_brass, pos=(sx, 0.118, 0.298), parent=chassis)

    bm_sc = bmesh.new()
    add_ellipsoid(bm_sc, (0.0, 0.0, 0.0), (0.026, 0.014, 0.016), u_segs=8, v_segs=6, mat_idx=0)
    finalize_mesh_obj("scanner_eye", bm_sc, mat_led_eye, pos=(0.0, 0.062, 0.298), parent=chassis)

    # Oversized Sculpted Dorsal Brass Wind-Up Clockwork Key (`clockwork_key`)
    bm_key = bmesh.new()
    add_swept_curve(bm_key, [(0.0, 0.0, 0.0), (0.0, 0.16, 0.0)], [0.028, 0.022], segs=8, mat_idx=0)
    for sx in (-0.068, 0.068):
        add_torus_ring(bm_key, (sx, 0.20, 0.0), 0.062, 0.018, 14, 6, rot_t3=(math.pi * 0.5, 0.0, 0.0), mat_idx=0)
    finalize_mesh_obj("clockwork_key", bm_key, mat_brass, pos=(0.0, 0.135, -0.02), parent=chassis)

    # 2. Brass Side Turbo-Impellers (`impeller_L/R`, `shroud_L/R`, `jet_plume_L/R`)
    for tag, sx, pitch_sign in (("L", -0.36, 1.0), ("R", 0.36, -1.0)):
        pod = make_empty_node(f"impeller_pod_{tag}", (sx, 0.02, -0.03), parent=chassis)
        bm_sh = bmesh.new()
        add_torus_ring(bm_sh, (0.0, 0.0, 0.0), 0.125, 0.028, 16, 6, rot_t3=(math.pi * 0.5, 0.0, 0.0), mat_idx=0)
        finalize_mesh_obj(f"shroud_{tag}", bm_sh, mat_brass, parent=pod)

        bm_imp = bmesh.new()
        add_swept_curve(bm_imp, [(0.0, 0.0, -0.05), (0.0, 0.0, 0.06)], [0.036, 0.022], segs=8, mat_idx=0)
        for b in range(6):
            ba = (2.0 * math.pi * b) / 6.0
            add_bevel_box(
                bm_imp,
                (math.cos(ba) * 0.066, math.sin(ba) * 0.066, 0.0),
                (0.084, 0.028, 0.010),
                bevel=0.002,
                rot_t3=(0.40 * pitch_sign * math.sin(ba), -0.40 * pitch_sign * math.cos(ba), ba),
                mat_idx=0,
            )
        finalize_mesh_obj(f"impeller_{tag}", bm_imp, mat_brass, parent=pod)

        bm_jet = bmesh.new()
        add_swept_curve(bm_jet, [(0.0, 0.0, -0.04), (0.0, 0.0, -0.32)], [0.078, 0.014], segs=8, mat_idx=0)
        finalize_mesh_obj(f"jet_plume_{tag}", bm_jet, mat_aqua, pos=(sx, 0.02, -0.07), parent=chassis)

    # 3. 4 Articulated Brass Suspension Struts (`skid_*`) + WIDE Chunky Glowing Spark-Wheels (`wheel_*`)!
    # Chassis `y = 0.34`, skid `y = -0.02`, wheel center `y = -0.205` => `0.115` world; wheel outer radius `0.115` -> bottom `y == 0.000`!
    skid_specs = [
        ("FL", -0.18, 0.12, -0.33, 0.21),
        ("FR", 0.18, 0.12, 0.33, 0.21),
        ("BL", -0.18, -0.12, -0.35, -0.21),
        ("BR", 0.18, -0.12, 0.35, -0.21),
    ]
    for tag, hx, hz, fx, fz in skid_specs:
        dx, dz = fx - hx, fz - hz
        bm_sk = bmesh.new()
        add_swept_curve(bm_sk, [(0.0, 0.02, 0.0), (dx, -0.205, dz)], 0.025, segs=7, mat_idx=0)
        add_swept_curve(bm_sk, [(0.0, -0.03, -0.02), (dx * 0.85, -0.205, dz)], 0.018, segs=6, mat_idx=1)
        sk_obj = finalize_mesh_obj(f"skid_{tag}", bm_sk, [mat_brass, mat_hull], pos=(hx, -0.02, hz), parent=chassis)

        # Wide Chunky Glowing Spark-Wheel (`radius = 0.115`, wide glowing tread + dual golden hubcaps!)
        bm_w = bmesh.new()
        # Wide dark rubber sidewall cylinder (`width = 0.088m`, radius `0.108`)
        add_swept_curve(bm_w, [(-0.044, 0.0, 0.0), (0.044, 0.0, 0.0)], 0.108, segs=16, mat_idx=0)
        # Blazing glowing fiery-amber/gold center spark-tread ring (`radius = 0.115`, reads brightly from front & side!)
        add_swept_curve(bm_w, [(-0.024, 0.0, 0.0), (0.024, 0.0, 0.0)], 0.115, segs=16, mat_idx=1)
        # Beveled brass hubcap drums on both outer faces
        add_swept_curve(bm_w, [(-0.056, 0.0, 0.0), (0.056, 0.0, 0.0)], 0.058, segs=12, mat_idx=2)
        finalize_mesh_obj(f"wheel_{tag}", bm_w, [mat_tire, mat_wheel_glow, mat_brass], pos=(dx, -0.205, dz), parent=sk_obj)

    return export_glb_and_inspect(os.path.join(OUT_MODELS_DIR, "enemy_rail_skater.glb"))


# ==============================================================================
# ENEMY 5: `barnacle_mortar` — Cowardly Siege Hermit + Real Face & Googly Periscope!
# ==============================================================================

def build_enemy_barnacle_mortar():
    reset_scene()

    sz = 256
    u = np.linspace(0.0, 1.0, sz, endpoint=False, dtype=np.float32)
    yy, xx = np.meshgrid(u, u, indexing="ij")
    n1 = _fbm(sz, 4, 3, 501)
    flute = 0.5 + 0.5 * np.cos(xx * math.pi * 10.0 + n1 * 1.2)
    reef_alb = _mix(hex_rgb("#9e3e58"), hex_rgb("#e47044"), 0.38 + 0.44 * flute + 0.18 * n1)
    reef_alb = _mix(reef_alb, hex_rgb("#8b5cf6"), _sstep(0.60, 0.85, n1) * 0.45)
    reef_h = 0.5 + flute * 0.20 + n1 * 0.10
    reef_r = 0.38 + (1.0 - flute) * 0.14
    reef_m = np.full((sz, sz), 0.18, dtype=np.float32)
    tex_reef = bake_pbr_bundle("mortar_reef", reef_alb, reef_h, reef_r, reef_m, n_str=1.3)

    tex_brass = bake_gold_brass_bundle("mortar_brass", "#f6be42", "#b87424")
    tex_eye_hermit = bake_stylized_eye_bundle(
        "mortar_hermit_eye",
        sclera_hex="#fffef2",
        iris_outer_hex="#f59e0b",
        iris_inner_hex="#fef08a",
        pupil_hex="#120c1a",
        pupil_kind="round",
        iris_rad=0.40,
        pupil_rad=0.23,
        emissive_boost=0.92,
    )
    tex_eye_peri = bake_stylized_eye_bundle(
        "mortar_peri_eye",
        sclera_hex="#f0fdfa",
        iris_outer_hex="#06b6d4",
        iris_inner_hex="#fef08a",
        pupil_hex="#0d1324",
        pupil_kind="round",
        iris_rad=0.40,
        pupil_rad=0.22,
        emissive_boost=0.98,
    )

    mat_reef = make_pbr_mat("mat_mortar_reef", "#d96b43", roughness=0.40, metallic=0.16, coat=0.25, tex_bundle=tex_reef, normal_strength=1.0)
    mat_brass = make_pbr_mat("mat_mortar_copper", "#f2b23d", roughness=0.24, metallic=0.88, tex_bundle=tex_brass)
    mat_hermit = make_pbr_mat("mat_mortar_hermit", "#ef4444", roughness=0.26, metallic=0.05, coat=0.50)
    mat_cavity = make_pbr_mat("mat_mortar_cavity", "#180f24", roughness=0.65)
    mat_core = make_pbr_mat("mat_mortar_core", "#f97316", roughness=0.14, emission_hex="#fb923c", emission_strength=1.25)
    mat_bubble = make_pbr_mat("mat_mortar_bubble", "#22f0e8", roughness=0.08, coat=0.85, alpha=0.82, emission_hex="#00f5ff", emission_strength=1.05)
    mat_eye_h = make_pbr_mat("mat_mortar_eye_h", "#fef08a", roughness=0.06, coat=0.85, emission_hex="#fde047", emission_strength=1.00, tex_bundle=tex_eye_hermit, normal_strength=0.35)
    mat_eye_p = make_pbr_mat("mat_mortar_eye_p", "#67e8f9", roughness=0.06, coat=0.85, emission_hex="#38bdf8", emission_strength=1.10, tex_bundle=tex_eye_peri, normal_strength=0.35)

    root = make_empty_node("BarnacleMortarRoot", (0.0, 0.0, 0.0))
    turret = make_empty_node("mortar_turret", (0.0, 0.0, 0.0), parent=root)

    # 1. Chunky Bronze-Coral Reef Fortress Base with Large Front Armored Window (`reef_base`)
    bm_b = bmesh.new()
    b_stations = [(0.00, 0.42, 0.40), (0.14, 0.39, 0.37), (0.30, 0.34, 0.32), (0.43, 0.28, 0.27)]
    b_rings = []
    for y, rx, rz in b_stations:
        ring = []
        for s in range(18):
            a = (2.0 * math.pi * s) / 18.0
            flute = 1.0 + 0.070 * math.cos(a * 5.0)
            ring.append((math.cos(a) * rx * flute, y, math.sin(a) * rz * flute))
        b_rings.append(ring)
    add_loft_rings(bm_b, b_rings, closed=True, cap_start=True, cap_end=True, mat_idx=0)

    add_torus_ring(bm_b, (0.0, 0.055, 0.0), 0.395, 0.042, 18, 6, mat_idx=1)
    add_torus_ring(bm_b, (0.0, 0.405, 0.0), 0.290, 0.030, 18, 6, mat_idx=1)
    for k in range(5):
        ka = (2.0 * math.pi * k) / 5.0 + 0.32
        add_bevel_box(bm_b, (math.sin(ka) * 0.375, 0.13, math.cos(ka) * 0.355), (0.085, 0.24, 0.095), bevel=0.012, rot_t3=(0.0, ka, 0.0), mat_idx=1)

    # Wide, prominent front armored window framing our cowardly Hermit's googly face!
    add_bevel_box(bm_b, (0.0, 0.235, 0.320), (0.37, 0.215, 0.110), bevel=0.016, mat_idx=1)
    add_bevel_box(bm_b, (0.0, 0.235, 0.342), (0.30, 0.155, 0.098), bevel=0.010, mat_idx=2)
    finalize_mesh_obj("reef_base", bm_b, [mat_reef, mat_brass, mat_cavity], parent=turret, uv_scale=1.6)

    # 2. REAL COWARDLY HERMIT FACE inside front embrasure (`hermit_face`, `hermit_eye_L/R`, `hermit_brow_L/R`)!
    h_face = make_empty_node("hermit_face", (0.0, 0.235, 0.365), parent=turret)
    bm_hf = bmesh.new()
    add_ellipsoid(bm_hf, (0.0, -0.01, -0.02), (0.145, 0.082, 0.082), u_segs=12, v_segs=8, mat_idx=0)
    for sx in (-0.125, 0.125):
        add_ellipsoid(bm_hf, (sx, -0.052, 0.038), (0.042, 0.030, 0.046), u_segs=8, v_segs=6, mat_idx=0)
    finalize_mesh_obj("hermit_head_mesh", bm_hf, mat_hermit, parent=h_face)

    for tag, sx, ey_sc in (("L", -0.078, 1.12), ("R", 0.078, 0.94)):
        bm_he = bmesh.new()
        ef = add_ellipsoid(bm_he, (0.0, 0.0, 0.0), (0.062 * ey_sc, 0.066 * ey_sc, 0.048), u_segs=14, v_segs=9, mat_idx=0)
        bmesh.ops.recalc_face_normals(bm_he, faces=bm_he.faces)
        project_eye_uvs(bm_he, ef, (0.0, 0.0, 0.0), 0.062 * ey_sc, 0.066 * ey_sc)
        finalize_mesh_obj(f"hermit_eye_{tag}", bm_he, mat_eye_h, pos=(sx, 0.015, 0.040), parent=h_face, keep_custom_uvs=True)

        bm_hb = bmesh.new()
        s_sign = -1.0 if tag == "L" else 1.0
        add_bevel_box(bm_hb, (0.0, 0.0, 0.0), (0.105, 0.026, 0.040), bevel=0.006, rot_t3=(0.0, 0.0, -s_sign * 0.24), mat_idx=0)
        finalize_mesh_obj(f"hermit_brow_{tag}", bm_hb, mat_brass, pos=(sx, 0.084, 0.054), parent=h_face)

    # 3. Peeking Googly Periscope Eye-Stalk (`mortar_periscope`) rising high & unmistakable!
    bm_peri = bmesh.new()
    add_swept_curve(bm_peri, [(0.0, 0.0, 0.0), (0.0, 0.28, 0.0), (0.0, 0.36, 0.068)], [0.032, 0.028, 0.040], segs=10, mat_idx=0)
    add_torus_ring(bm_peri, (0.0, 0.36, 0.106), 0.078, 0.018, 14, 6, rot_t3=(math.pi * 0.5, 0.0, 0.0), mat_idx=0)
    add_bevel_box(bm_peri, (0.0, 0.440, 0.110), (0.135, 0.024, 0.052), bevel=0.006, rot_t3=(0.15, 0.0, 0.0), mat_idx=0)
    assign_triplanar_uvs(bm_peri, scale=2.2)
    pe_f = add_ellipsoid(bm_peri, (0.0, 0.36, 0.114), (0.075, 0.078, 0.054), u_segs=14, v_segs=10, mat_idx=1)
    bmesh.ops.recalc_face_normals(bm_peri, faces=bm_peri.faces)
    project_eye_uvs(bm_peri, pe_f, (0.0, 0.36, 0.114), 0.075, 0.078)
    finalize_mesh_obj("mortar_periscope", bm_peri, [mat_brass, mat_eye_p], pos=(0.0, 0.42, 0.0), parent=turret, keep_custom_uvs=True)

    # 4. 5 Thick Beveled Bronze-Coral Crown Petals (`petal_pivot_0..4` -> `petal_0..4`)
    for i in range(5):
        yaw = (2.0 * math.pi * i) / 5.0
        piv = make_empty_node(
            f"petal_pivot_{i}",
            (math.sin(yaw) * 0.240, 0.42, math.cos(yaw) * 0.240),
            rot=(0.0, yaw, 0.0),
            parent=turret,
        )
        bm_p = bmesh.new()
        add_swept_curve(bm_p, [(0.0, 0.0, 0.0), (0.0, 0.16, -0.055), (0.0, 0.30, -0.17)], [(0.132, 0.048), (0.108, 0.040), (0.034, 0.020)], segs=8, mat_idx=0)
        add_bevel_box(bm_p, (0.0, 0.145, -0.072), (0.062, 0.22, 0.028), bevel=0.006, rot_t3=(0.44, 0.0, 0.0), mat_idx=1)
        finalize_mesh_obj(f"petal_{i}", bm_p, [mat_reef, mat_brass], parent=piv, uv_scale=1.9)

    bm_c = bmesh.new()
    add_ellipsoid(bm_c, (0.0, 0.0, 0.0), (0.175, 0.130, 0.175), u_segs=14, v_segs=9, mat_idx=0)
    finalize_mesh_obj("pressure_core", bm_c, mat_core, pos=(0.0, 0.43, 0.0), parent=turret)

    bm_bub = bmesh.new()
    add_ellipsoid(bm_bub, (0.0, 0.0, 0.0), (0.168, 0.168, 0.168), u_segs=16, v_segs=10, mat_idx=0)
    finalize_mesh_obj("mortar_bubble", bm_bub, mat_bubble, pos=(0.0, 0.55, 0.0), parent=turret)

    return export_glb_and_inspect(os.path.join(OUT_MODELS_DIR, "enemy_barnacle_mortar.glb"))


# ==============================================================================
# ENEMY 6: `vent_stalker` — Brooding Volcanic-Obsidian & Molten-Amber Salamander
# ==============================================================================

def build_enemy_vent_stalker():
    reset_scene()

    # Sleek Deep Volcanic-Obsidian with soft organic molten magma glows (NO messy wireframe grid!)
    sz = 256
    n1 = _fbm(sz, 4, 3, 601)
    _, _, edge = _voronoi(sz, 5, 0.78, 607)
    lava = (1.0 - _sstep(0.02, 0.09, edge)) * _sstep(0.42, 0.72, n1)
    skin_alb = _mix(hex_rgb("#141b2d"), hex_rgb("#263350"), 0.35 + 0.50 * n1)
    skin_alb = _mix(skin_alb, hex_rgb("#ff5a14"), lava * 0.85)
    skin_alb = _mix(skin_alb, hex_rgb("#fbbf24"), (lava ** 2.0) * 0.75)
    skin_emi = hex_rgb("#ff5a14")[None, None, :] * (lava[..., None] * 0.82)
    tex_skin = bake_pbr_bundle(
        "stalker_skin", skin_alb, 0.5 + (1.0 - lava) * 0.18 + n1 * 0.08,
        0.32 - lava * 0.14, np.full((sz, sz), 0.22, np.float32), emi=skin_emi, n_str=1.3
    )

    tex_brass = bake_gold_brass_bundle("stalker_brass", "#e8a838", "#b36f22")
    tex_eye = bake_stylized_eye_bundle(
        "stalker_eye",
        sclera_hex="#fff7ed",
        iris_outer_hex="#ea580c",
        iris_inner_hex="#fde047",
        pupil_hex="#180a08",
        pupil_kind="slit",
        iris_rad=0.42,
        pupil_rad=0.18,
        emissive_boost=0.98,
    )

    mat_skin = make_pbr_mat("mat_stalker_skin", "#1a2338", roughness=0.32, metallic=0.22, coat=0.35, emission_hex="#ff6b1a", emission_strength=0.85, tex_bundle=tex_skin, normal_strength=0.9)
    mat_obsidian_clean = make_pbr_mat("mat_stalker_head_obs", "#182136", roughness=0.28, metallic=0.24, coat=0.45)
    mat_brass = make_pbr_mat("mat_stalker_bronze", "#e29b32", roughness=0.24, metallic=0.88, tex_bundle=tex_brass)
    mat_molten = make_pbr_mat("mat_stalker_vent", "#ff6b1a", roughness=0.14, emission_hex="#ff7b1a", emission_strength=1.55)
    mat_amber_glow = make_pbr_mat("mat_stalker_amber", "#fbbf24", roughness=0.14, emission_hex="#f97316", emission_strength=1.35)
    mat_eye = make_pbr_mat("mat_stalker_eye", "#fde047", roughness=0.06, coat=0.85, emission_hex="#fbbf24", emission_strength=1.30, tex_bundle=tex_eye, normal_strength=0.35)

    root = make_empty_node("VentStalkerRoot", (0.0, 0.0, 0.0))
    body = make_empty_node("stalker_body", (0.0, 0.0, 0.0), parent=root)

    # 1. Muscular Volcanic-Obsidian Torso + Glowing Molten Belly (`stalker_torso`)
    bm_t = bmesh.new()
    t_stations = [(-0.28, 0.11, 0.095), (-0.12, 0.18, 0.130), (0.04, 0.195, 0.138), (0.19, 0.17, 0.120), (0.28, 0.12, 0.095)]
    t_rings = [
        [(math.cos((2.0 * math.pi * s) / 14) * rx, 0.215 + math.sin((2.0 * math.pi * s) / 14) * ry, z) for s in range(14)]
        for z, rx, ry in t_stations
    ]
    add_loft_rings(bm_t, t_rings, closed=True, cap_start=True, cap_end=True, mat_idx=0)
    add_ellipsoid(bm_t, (0.0, 0.125, 0.01), (0.135, 0.048, 0.245), u_segs=12, v_segs=7, mat_idx=1)
    for sz_plate in (-0.18, -0.05, 0.08, 0.19):
        for sx in (-0.13, 0.13):
            add_bevel_box(bm_t, (sx, 0.265, sz_plate), (0.10, 0.040, 0.105), bevel=0.008, rot_t3=(0.0, 0.0, -sx * 2.8), mat_idx=0)
    finalize_mesh_obj("stalker_torso", bm_t, [mat_skin, mat_amber_glow], parent=body, uv_scale=1.6)

    # 2. 3 Chunky Brass Tea-Kettle Chimneys (`dorsal_vents`) + 3 Hinged Rattling Brass Lids (`chimney_cap_0..2`)
    bm_v = bmesh.new()
    chimney_specs = [(-0.15, 0.15, 0.054), (0.0, 0.19, 0.062), (0.15, 0.15, 0.054)]
    for vz, vh, vr in chimney_specs:
        add_swept_curve(bm_v, [(0.0, 0.30, vz), (0.0, 0.30 + vh, vz)], [vr * 1.15, vr * 0.92], segs=10, mat_idx=0)
        add_torus_ring(bm_v, (0.0, 0.30 + vh, vz), vr * 0.94, 0.014, 12, 6, mat_idx=0)
        add_ellipsoid(bm_v, (0.0, 0.30 + vh, vz), (vr * 0.78, 0.026, vr * 0.78), u_segs=8, v_segs=5, mat_idx=1)
    finalize_mesh_obj("dorsal_vents", bm_v, [mat_brass, mat_molten], parent=body, uv_scale=2.0)

    for idx_c, (vz, vh, vr) in enumerate(chimney_specs):
        bm_cap = bmesh.new()
        add_swept_curve(bm_cap, [(vr * 0.9, 0.0, 0.0), (vr * 0.9, 0.022, 0.0)], [vr * 1.05, vr * 0.92], segs=10, mat_idx=0)
        add_ellipsoid(bm_cap, (vr * 0.9, 0.036, 0.0), (0.018, 0.018, 0.018), u_segs=7, v_segs=5, mat_idx=1)
        finalize_mesh_obj(f"chimney_cap_{idx_c}", bm_cap, [mat_brass, mat_molten], pos=(-vr * 0.9, 0.31 + vh, vz), parent=body)

    # 3. Clean Obsidian Brooding Salamander Head (`stalker_head`) so Sharp Eyes & Glowing Throat-Sac POP 100%!
    head_node = make_empty_node("stalker_head", (0.0, 0.24, 0.27), parent=body)
    bm_h = bmesh.new()
    add_swept_curve(bm_h, [(0.0, 0.0, -0.04), (0.0, 0.02, 0.13), (0.0, 0.0, 0.28)], [(0.168, 0.120), (0.150, 0.100), (0.072, 0.048)], segs=12, mat_idx=0)
    for sx in (-1.0, 1.0):
        add_swept_curve(bm_h, [(sx * 0.11, 0.06, 0.01), (sx * 0.22, 0.14, -0.11)], [0.034, 0.008], segs=7, mat_idx=1)
        add_swept_curve(bm_h, [(sx * 0.13, 0.00, 0.01), (sx * 0.23, 0.04, -0.09)], [0.026, 0.008], segs=7, mat_idx=2)
    finalize_mesh_obj("stalker_skull_mesh", bm_h, [mat_obsidian_clean, mat_brass, mat_molten], parent=head_node)

    for tag, sx in (("L", -1.0), ("R", 1.0)):
        bm_se = bmesh.new()
        ef = add_ellipsoid(bm_se, (0.0, 0.0, 0.0), (0.054, 0.052, 0.056), u_segs=12, v_segs=8, mat_idx=0)
        bmesh.ops.recalc_face_normals(bm_se, faces=bm_se.faces)
        uv_l = bm_se.loops.layers.uv.verify()
        for f in ef:
            for lp in f.loops:
                tx = lp.vert.co.x
                ty = lp.vert.co.z
                tz = -lp.vert.co.y
                u_p = (-sx * tz * 0.56 + tx * 0.82) * 0.46 / 0.056 + 0.5
                v_p = ty * 0.46 / 0.052 + 0.5
                lp[uv_l].uv = (max(0.01, min(0.99, u_p)), max(0.01, min(0.99, v_p)))
        finalize_mesh_obj(f"stalker_eye_{tag}", bm_se, mat_eye, pos=(sx * 0.115, 0.062, 0.148), parent=head_node, keep_custom_uvs=True)

        bm_sb = bmesh.new()
        add_bevel_box(bm_sb, (0.0, 0.0, 0.0), (0.068, 0.034, 0.135), bevel=0.006, rot_t3=(-0.15, sx * 0.25, -sx * 0.42), mat_idx=0)
        finalize_mesh_obj(f"stalker_brow_{tag}", bm_sb, mat_brass, pos=(sx * 0.104, 0.110, 0.138), parent=head_node)

    bm_ts = bmesh.new()
    add_ellipsoid(bm_ts, (0.0, 0.0, 0.0), (0.130, 0.092, 0.122), u_segs=14, v_segs=9, mat_idx=0)
    finalize_mesh_obj("throat_sac", bm_ts, mat_molten, pos=(0.0, -0.058, 0.115), parent=head_node)

    # 4. Articulated Scuted Whip Tail (`tail_1` -> `tail_2`)
    t1 = make_empty_node("tail_1", (0.0, 0.21, -0.27), parent=body)
    bm_t1 = bmesh.new()
    add_swept_curve(bm_t1, [(0.0, 0.0, 0.0), (0.0, -0.02, -0.25)], [(0.110, 0.092), (0.064, 0.056)], segs=10, mat_idx=0)
    for tz in (-0.07, -0.17):
        add_swept_curve(bm_t1, [(0.0, 0.06, tz), (0.0, 0.14, tz - 0.03)], [0.026, 0.006], segs=5, mat_idx=1)
    finalize_mesh_obj("tail_1_mesh", bm_t1, [mat_skin, mat_molten], parent=t1, uv_scale=2.0)

    t2 = make_empty_node("tail_2", (0.0, -0.02, -0.24), parent=t1)
    bm_t2 = bmesh.new()
    add_swept_curve(bm_t2, [(0.0, 0.0, 0.0), (0.0, 0.01, -0.28)], [(0.062, 0.052), (0.012, 0.014)], segs=8, mat_idx=0)
    add_swept_curve(bm_t2, [(0.0, 0.04, -0.06), (0.0, 0.12, -0.15), (0.0, 0.01, -0.27)], [0.020, 0.026, 0.006], segs=5, mat_idx=1)
    finalize_mesh_obj("tail_2_mesh", bm_t2, [mat_skin, mat_molten], parent=t2, uv_scale=2.0)

    # 5. 4 Muscular Clean-Obsidian Gripping Wall-Claw Limbs (`leg_FL/FR/BL/BR`) — Grounded at `y == 0.000`!
    legs = [
        ("leg_FL", -0.16, 0.15, -0.19, 0.09),
        ("leg_FR", 0.16, 0.15, 0.19, 0.09),
        ("leg_BL", -0.16, -0.14, -0.20, -0.08),
        ("leg_BR", 0.16, -0.14, 0.20, -0.08),
    ]
    for lnm, hx, hz, dx, dz in legs:
        bm_l = bmesh.new()
        add_swept_curve(bm_l, [(0.0, 0.0, 0.0), (dx * 0.65, 0.048, dz * 0.5), (dx, -0.168, dz)], [0.056, 0.046, 0.036], segs=8, mat_idx=0)
        for ci in (-1, 0, 1):
            add_swept_curve(bm_l, [(dx, -0.165, dz), (dx + ci * 0.040, -0.174, dz + 0.080)], [0.018, 0.006], segs=5, mat_idx=1)
        finalize_mesh_obj(lnm, bm_l, [mat_obsidian_clean, mat_amber_glow], pos=(hx, 0.18, hz), parent=body)

    return export_glb_and_inspect(os.path.join(OUT_MODELS_DIR, "enemy_vent_stalker.glb"))


# ==============================================================================
# ENEMY 7: `siphon_warden` — De-Cluttered Obsidian & Royal-Gold Sovereign Boss
# ==============================================================================

def build_enemy_siphon_warden():
    reset_scene()

    # Ultra-Clean Velvet-Satin Midnight-Obsidian Armor (ZERO busy grid lines or tiger stripes!)
    sz = 256
    n1 = _fbm(sz, 4, 3, 701)
    arm_alb = _mix(hex_rgb("#0c1328"), hex_rgb("#1c2952"), 0.30 + 0.60 * n1)
    arm_h = 0.5 + n1 * 0.08
    arm_r = 0.24 + (1.0 - n1) * 0.10
    arm_m = np.full((sz, sz), 0.56, dtype=np.float32)
    tex_armor = bake_pbr_bundle("warden_armor", arm_alb, arm_h, arm_r, arm_m, emi=None, n_str=0.8)

    tex_gold = bake_gold_brass_bundle("warden_gold", "#f8c146", "#c4841e")
    tex_cyclops = bake_stylized_eye_bundle(
        "warden_cyclops_eye",
        sclera_hex="#fef3c7",
        iris_outer_hex="#f97316",
        iris_inner_hex="#fef08a",
        pupil_hex="#140712",
        pupil_kind="cyclops",
        iris_rad=0.43,
        pupil_rad=0.14,
        emissive_boost=1.10,
    )

    mat_armor = make_pbr_mat("mat_warden_armor", "#121c3a", roughness=0.26, metallic=0.58, coat=0.45, tex_bundle=tex_armor, normal_strength=0.6)
    mat_gold = make_pbr_mat("mat_warden_gold", "#f5b83d", roughness=0.18, metallic=0.94, tex_bundle=tex_gold)
    mat_shield = make_pbr_mat("mat_warden_shield", "#22f0e8", roughness=0.10, metallic=0.22, coat=0.85, alpha=0.84, emission_hex="#06b6d4", emission_strength=1.05)
    mat_core = make_pbr_mat("mat_warden_core", "#d946ef", roughness=0.10, emission_hex="#e879f9", emission_strength=1.45)
    mat_claw_core = make_pbr_mat("mat_warden_claw_core", "#38bdf8", roughness=0.14, metallic=0.45, emission_hex="#00f5ff", emission_strength=1.20)
    mat_eye = make_pbr_mat("mat_warden_cyclops", "#fbbf24", roughness=0.06, coat=0.90, emission_hex="#f59e0b", emission_strength=1.35, tex_bundle=tex_cyclops, normal_strength=0.35)

    # Distinct Act 1–5 Crown Accent Materials
    mat_act1 = make_pbr_mat("mat_warden_act1", "#ea580c", roughness=0.24, metallic=0.86, emission_hex="#f97316", emission_strength=0.85)
    mat_act2 = make_pbr_mat("mat_warden_act2", "#7dd3fc", roughness=0.12, metallic=0.30, emission_hex="#38bdf8", emission_strength=1.35)
    mat_act3 = make_pbr_mat("mat_warden_act3", "#10b981", roughness=0.22, metallic=0.35, emission_hex="#22c55e", emission_strength=1.15)
    mat_act4 = make_pbr_mat("mat_warden_act4", "#fb7185", roughness=0.22, metallic=0.40, emission_hex="#f43f5e", emission_strength=1.15)
    mat_act5 = make_pbr_mat("mat_warden_act5", "#e879f9", roughness=0.14, metallic=0.55, emission_hex="#d946ef", emission_strength=1.45)

    root = make_empty_node("SiphonWardenRoot", (0.0, 0.0, 0.0))
    body = make_empty_node("warden_body", (0.0, 0.0, 0.0), parent=root)

    # 1. De-Cluttered Faceted Obsidian & Royal-Gold Sovereign Chassis (`warden_mantle`)
    bm_m = bmesh.new()
    m_stations = [
        (-0.66, 0.07, 0.06),
        (-0.40, 0.22, 0.17),
        (-0.10, 0.36, 0.25),
        (0.24, 0.46, 0.28),
        (0.58, 0.46, 0.29),
        (0.82, 0.32, 0.20),
        (0.95, 0.14, 0.10),
    ]
    m_rings = []
    for y, rx, rz in m_stations:
        ring = []
        for s in range(12):
            a = (2.0 * math.pi * s) / 12.0
            hood = 1.18 if abs(math.cos(a)) > 0.55 and y > 0.18 else 1.0
            ring.append((math.cos(a) * rx * hood, y, math.sin(a) * rz - 0.06))
        m_rings.append(ring)
    add_loft_rings(bm_m, m_rings, closed=True, cap_start=True, cap_end=True, mat_idx=0)

    # Commanding 2-Tier Winged Obsidian & Royal-Gold Shoulder Pauldrons + Chest Mantle Ribs
    for sx in (-1.0, 1.0):
        for tier_i in range(2):
            ty = 0.32 + tier_i * 0.18
            tx = sx * (0.46 + tier_i * 0.10)
            add_bevel_box(bm_m, (tx, ty, -0.02), (0.36, 0.12, 0.26), bevel=0.016, rot_t3=(0.0, -sx * 0.18, sx * (0.26 + tier_i * 0.14)), mat_idx=0)
            add_bevel_box(bm_m, (tx * 1.05, ty + 0.055, 0.02), (0.34, 0.036, 0.22), bevel=0.006, rot_t3=(0.0, -sx * 0.18, sx * (0.26 + tier_i * 0.14)), mat_idx=1)
        add_swept_curve(bm_m, [(sx * 0.32, -0.04, 0.10), (sx * 0.22, -0.26, 0.24)], [0.048, 0.016], segs=7, mat_idx=1)
    # Sculpted Royal-Gold Helm Brow Crest + Giant Monocle Ring around Cyclops Eye (`y = 0.62`!)
    add_swept_curve(
        bm_m,
        [(-0.38, 0.70, 0.14), (-0.18, 0.78, 0.24), (0.0, 0.80, 0.27), (0.18, 0.78, 0.24), (0.38, 0.70, 0.14)],
        (0.034, 0.044),
        segs=7,
        mat_idx=1,
    )
    add_torus_ring(bm_m, (0.0, 0.61, 0.255), 0.188, 0.030, 20, 8, rot_t3=(math.pi * 0.5, 0.0, 0.0), mat_idx=1)
    # Royal-Gold lower waist keel ring
    add_torus_ring(bm_m, (0.0, -0.28, -0.04), 0.28, 0.024, 16, 6, mat_idx=1)
    finalize_mesh_obj("warden_mantle", bm_m, [mat_armor, mat_gold], parent=body, uv_scale=1.2)

    # 2. GIANT UNOBSTRUCTED EXPRESSIVE CYCLOPS EYE-VISOR (`warden_eye` at `y = 0.61`!)
    eye_root = make_empty_node("warden_eye", (0.0, 0.61, 0.255), parent=body)
    bm_ir = bmesh.new()
    ir_f = add_ellipsoid(bm_ir, (0.0, 0.0, 0.022), (0.168, 0.168, 0.095), u_segs=18, v_segs=11, mat_idx=0)
    bmesh.ops.recalc_face_normals(bm_ir, faces=bm_ir.faces)
    project_eye_uvs(bm_ir, ir_f, (0.0, 0.0, 0.022), 0.168, 0.168)
    finalize_mesh_obj("warden_iris", bm_ir, mat_eye, parent=eye_root, keep_custom_uvs=True)

    # Articulated Golden Upper & Lower Cyclops Shutter Eyelids (cleanly open at rest!)
    bm_lt = bmesh.new()
    add_bevel_box(bm_lt, (0.0, 0.145, 0.085), (0.31, 0.068, 0.055), bevel=0.012, mat_idx=0)
    finalize_mesh_obj("warden_lid_top", bm_lt, mat_gold, pos=(0.0, 0.0, 0.0), parent=eye_root)

    bm_lb = bmesh.new()
    add_bevel_box(bm_lb, (0.0, -0.145, 0.085), (0.29, 0.060, 0.052), bevel=0.012, mat_idx=0)
    finalize_mesh_obj("warden_lid_bot", bm_lb, mat_gold, pos=(0.0, 0.0, 0.0), parent=eye_root)

    # 3. Act 1–5 Interchangeable Biome Crown Accents (`crown_act_1` .. `crown_act_5`)!
    bm_c1 = bmesh.new()
    for sx in (-1.0, 1.0):
        add_swept_curve(bm_c1, [(sx * 0.16, 0.82, 0.02), (sx * 0.39, 0.98, 0.12), (sx * 0.30, 1.22, 0.24)], [0.062, 0.048, 0.016], segs=8, mat_idx=0)
    add_bevel_box(bm_c1, (0.0, 0.94, 0.06), (0.24, 0.14, 0.10), bevel=0.014, mat_idx=1)
    finalize_mesh_obj("crown_act_1", bm_c1, [mat_gold, mat_act1], parent=body)

    bm_c2 = bmesh.new()
    for sx, h_top in ((-1.0, 1.18), (-0.45, 1.26), (0.0, 1.38), (0.45, 1.26), (1.0, 1.18)):
        add_swept_curve(bm_c2, [(sx * 0.26, 0.84, 0.0), (sx * 0.32, h_top, -0.04)], [0.046, 0.008], segs=6, mat_idx=1)
    add_torus_ring(bm_c2, (0.0, 0.86, -0.01), 0.26, 0.026, 14, 6, mat_idx=0)
    finalize_mesh_obj("crown_act_2", bm_c2, [mat_gold, mat_act2], parent=body)

    bm_c3 = bmesh.new()
    for i_p in range(6):
        pa = (2.0 * math.pi * i_p) / 6.0
        add_swept_curve(bm_c3, [(math.sin(pa) * 0.22, 0.84, math.cos(pa) * 0.16), (math.sin(pa) * 0.34, 1.08, math.cos(pa) * 0.22), (math.sin(pa) * 0.22, 1.24, math.cos(pa) * 0.14)], [0.046, 0.036, 0.010], segs=6, mat_idx=1)
    add_ellipsoid(bm_c3, (0.0, 1.00, 0.0), (0.10, 0.14, 0.10), u_segs=8, v_segs=6, mat_idx=0)
    finalize_mesh_obj("crown_act_3", bm_c3, [mat_gold, mat_act3], parent=body)

    bm_c4 = bmesh.new()
    for sx, h_top in ((-1.0, 1.24), (0.0, 1.38), (1.0, 1.24)):
        add_swept_curve(bm_c4, [(sx * 0.19, 0.82, 0.0), (sx * 0.28, h_top, -0.04)], [(0.056, 0.036), (0.012, 0.010)], segs=7, mat_idx=0)
    add_ellipsoid(bm_c4, (0.0, 1.08, 0.04), (0.085, 0.085, 0.060), u_segs=10, v_segs=7, mat_idx=1)
    finalize_mesh_obj("crown_act_4", bm_c4, [mat_gold, mat_act4], parent=body)

    bm_c5 = bmesh.new()
    add_torus_ring(bm_c5, (0.0, 1.06, -0.06), 0.42, 0.026, 22, 6, rot_t3=(math.pi * 0.5, 0.0, 0.0), mat_idx=0)
    add_torus_ring(bm_c5, (0.0, 1.06, -0.06), 0.34, 0.016, 18, 6, rot_t3=(math.pi * 0.5, 0.0, 0.0), mat_idx=1)
    for sx, h_top in ((-1.0, 1.26), (0.0, 1.40), (1.0, 1.26)):
        add_swept_curve(bm_c5, [(sx * 0.18, 0.82, 0.0), (sx * 0.26, h_top, -0.05)], [(0.052, 0.036), (0.012, 0.010)], segs=7, mat_idx=0)
    finalize_mesh_obj("crown_act_5", bm_c5, [mat_gold, mat_act5], parent=body)

    # 4. Clean Chest Astrolabe Siphon Core (`siphon_core_outer`, `siphon_core_inner`, `siphon_singularity`)
    core_pos = (0.0, 0.08, 0.24)
    bm_go = bmesh.new()
    add_torus_ring(bm_go, (0.0, 0.0, 0.0), 0.265, 0.028, 20, 6, rot_t3=(math.pi * 0.5, 0.0, 0.0), mat_idx=0)
    for k in range(12):
        ka = (2.0 * math.pi * k) / 12.0
        add_bevel_box(bm_go, (math.cos(ka) * 0.29, math.sin(ka) * 0.29, 0.0), (0.040, 0.030, 0.042), bevel=0.005, rot_t3=(0.0, 0.0, ka), mat_idx=1)
    finalize_mesh_obj("siphon_core_outer", bm_go, [mat_gold, mat_armor], pos=core_pos, parent=body)

    bm_gi = bmesh.new()
    add_torus_ring(bm_gi, (0.0, 0.0, 0.0), 0.185, 0.022, 18, 6, mat_idx=0)
    finalize_mesh_obj("siphon_core_inner", bm_gi, mat_gold, pos=core_pos, parent=body)

    bm_sg = bmesh.new()
    add_ellipsoid(bm_sg, (0.0, 0.0, 0.0), (0.128, 0.128, 0.128), u_segs=10, v_segs=7, mat_idx=0)
    finalize_mesh_obj("siphon_singularity", bm_sg, mat_core, pos=core_pos, parent=body, smooth=False)

    # 5. 3 Distinct Breakable Sea-Glass Aegis Shield Plates (`shield_0..2` at -90 deg, +30 deg, +150 deg -> NEVER covers Cyclops Eye!)
    sh_orbit = make_empty_node("shield_orbit", core_pos, parent=body)
    shield_angles = [-math.pi * 0.5, math.pi / 6.0, 5.0 * math.pi / 6.0]
    for i, sa in enumerate(shield_angles):
        sx, sy = math.cos(sa) * 0.58, math.sin(sa) * 0.58
        bm_sh = bmesh.new()
        hex_stations = [(-0.22, 0.052, 0.018), (-0.11, 0.165, 0.028), (0.11, 0.165, 0.028), (0.22, 0.052, 0.018)]
        h_rings = [
            [(math.cos((2.0 * math.pi * s) / 6) * kw, ky, math.sin((2.0 * math.pi * s) / 6) * kt + 0.04) for s in range(6)]
            for ky, kw, kt in hex_stations
        ]
        add_loft_rings(bm_sh, h_rings, closed=True, cap_start=True, cap_end=True, mat_idx=0)
        frame_pts = [
            (-0.165, -0.11, 0.052), (-0.165, 0.11, 0.052), (0.0, 0.225, 0.054),
            (0.165, 0.11, 0.052), (0.165, -0.11, 0.052), (0.0, -0.225, 0.054),
            (-0.165, -0.11, 0.052),
        ]
        add_swept_curve(bm_sh, frame_pts, 0.020, segs=6, mat_idx=1)
        add_bevel_box(bm_sh, (0.0, 0.0, 0.056), (0.068, 0.22, 0.032), bevel=0.008, mat_idx=1)
        finalize_mesh_obj(
            f"shield_{i}", bm_sh, [mat_shield, mat_gold],
            pos=(sx, sy, 0.05), rot=(0.0, 0.0, sa - math.pi * 0.5), parent=sh_orbit
        )

    # 6. 4 Chunky Beveled Armored Pincer-Tentacles (`tentacle_0..3`, ZERO flat paper triangles!)
    tent_anchors = [
        (-0.36, 0.22, -0.02, -1.0, 0.38),
        (0.36, 0.22, -0.02, 1.0, 0.38),
        (-0.18, -0.18, -0.02, -1.0, -0.36),
        (0.18, -0.18, -0.02, 1.0, -0.36),
    ]
    for i, (ax, ay, az, sx, sy_bias) in enumerate(tent_anchors):
        t_prox = make_empty_node(f"tentacle_{i}", (ax, ay, az), parent=body)
        bm_tp = bmesh.new()
        p_curve = [(0.0, 0.0, 0.0), (sx * 0.28, sy_bias * 0.20, 0.10), (sx * 0.48, sy_bias * 0.10, 0.24)]
        add_swept_curve(bm_tp, p_curve, [0.092, 0.076, 0.062], segs=8, mat_idx=0)
        for vf in (0.24, 0.54, 0.84):
            vx = sx * 0.48 * vf
            vy = sy_bias * 0.15 * math.sin(vf * math.pi)
            vz = 0.24 * vf
            add_bevel_box(bm_tp, (vx, vy, vz), (0.148, 0.148, 0.052), bevel=0.010, rot_t3=(0.0, sx * 0.55, 0.0), mat_idx=1)
        finalize_mesh_obj(f"tentacle_prox_{i}", bm_tp, [mat_armor, mat_gold], parent=t_prox)

        t_dist = make_empty_node(f"tentacle_tip_{i}", (sx * 0.48, sy_bias * 0.10, 0.24), parent=t_prox)
        bm_td = bmesh.new()
        add_swept_curve(bm_td, [(0.0, 0.0, 0.0), (sx * 0.16, -0.14, 0.18), (-sx * 0.02, -0.24, 0.34)], [0.064, 0.052, 0.048], segs=8, mat_idx=0)
        add_bevel_box(bm_td, (-sx * 0.02, -0.24, 0.34), (0.138, 0.138, 0.102), bevel=0.016, mat_idx=1)
        add_ellipsoid(bm_td, (-sx * 0.02, -0.24, 0.392), (0.048, 0.048, 0.048), u_segs=8, v_segs=6, mat_idx=2)
        for jaw_s in (-1.0, 1.0):
            add_swept_curve(
                bm_td,
                [
                    (-sx * 0.02 + jaw_s * 0.050, -0.24, 0.37),
                    (-sx * 0.04 + jaw_s * 0.102, -0.27, 0.47),
                    (-sx * 0.03 + jaw_s * 0.032, -0.30, 0.58),
                ],
                [(0.042, 0.050), (0.038, 0.044), (0.018, 0.022)],
                segs=7,
                mat_idx=0,
            )
            add_bevel_box(
                bm_td,
                (-sx * 0.04 + jaw_s * 0.095, -0.27, 0.47),
                (0.030, 0.064, 0.108),
                bevel=0.006,
                rot_t3=(0.12, jaw_s * 0.25, 0.0),
                mat_idx=1,
            )
        finalize_mesh_obj(f"tentacle_dist_{i}", bm_td, [mat_armor, mat_gold, mat_claw_core], parent=t_dist)

    return export_glb_and_inspect(os.path.join(OUT_MODELS_DIR, "enemy_siphon_warden.glb"))


# ==============================================================================
# STUDIO 7-ENEMY LINEUP PREVIEW RENDERER (`--lineup <output.png>`)
# ==============================================================================

def render_lineup_preview(out_png):
    """Imports all 7 exported GLBs into a clean 2-row studio stage with ZERO cropping."""
    reset_scene()
    scene = bpy.context.scene
    scene.render.engine = "BLENDER_EEVEE"
    scene.render.resolution_x = 1920
    scene.render.resolution_y = 1080
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.filepath = out_png
    if hasattr(scene.eevee, "taa_render_samples"):
        scene.eevee.taa_render_samples = 32
    scene.view_settings.view_transform = "AgX" if "AgX" in [i.identifier for i in scene.view_settings.bl_rna.properties["view_transform"].enum_items] else "Standard"
    scene.view_settings.exposure = 0.25

    world = bpy.data.worlds.new("StudioWorld")
    scene.world = world
    world.use_nodes = True
    wnt = world.node_tree
    bg = wnt.nodes.get("Background")
    if bg:
        bg.inputs["Color"].default_value = (0.10, 0.16, 0.28, 1.0)
        bg.inputs["Strength"].default_value = 1.25

    # Warm Sandstone Studio Stage proving instant contrast against Act I canyon stone!
    mat_floor = make_pbr_mat("mat_stage_sandstone", "#b89068", roughness=0.72, metallic=0.02)
    bm_fl = bmesh.new()
    add_bevel_box(bm_fl, (0.0, -0.06, -0.2), (14.0, 0.12, 7.0), bevel=0.02, mat_idx=0)
    add_bevel_box(bm_fl, (0.0, 0.90, -1.9), (14.0, 1.80, 2.6), bevel=0.04, mat_idx=0)
    finalize_mesh_obj("StudioStage", bm_fl, mat_floor)

    def import_placed(glb_name, pos_t3, rot_t3=(0.0, 0.0, 0.0), scale=1.0, post_fn=None):
        before = set(bpy.context.scene.objects)
        bpy.ops.import_scene.gltf(filepath=os.path.join(OUT_MODELS_DIR, glb_name))
        added = [o for o in bpy.context.scene.objects if o not in before]
        roots = [o for o in added if o.parent is None]
        holder = make_empty_node(f"Holder_{glb_name}_{len(bpy.context.scene.objects)}", pos_t3, rot_t3)
        holder.scale = (scale, scale, scale)
        for r in roots:
            r.parent = holder
        if post_fn:
            post_fn(added, holder)
        return holder

    # TOP ROW (y=1.80 stone plinth): Snap-Crab upright, Snap-Crab flipped, Gulp-Hopper, Volt-Eel, Rail-Skater (100% unobstructed!)
    def hide_crab_spark(objs, _holder):
        for o in objs:
            if o.name.startswith("claw_spark"):
                o.hide_render = True
                o.hide_viewport = True

    import_placed("enemy_snap_crab.glb", (-3.55, 1.80, -1.35), (0.0, 0.20, 0.0), scale=1.22, post_fn=hide_crab_spark)
    import_placed("enemy_snap_crab.glb", (-1.95, 2.36, -1.35), (0.20, -0.10, math.pi), scale=1.18, post_fn=hide_crab_spark)
    import_placed("enemy_gulp_hopper.glb", (-0.30, 1.80, -1.35), (0.0, -0.10, 0.0), scale=1.25)

    def pose_eel(objs, _holder):
        segs = {}
        for o in objs:
            base = o.name.split(".")[0]
            if base.startswith("seg_") and len(base) <= 5:
                try:
                    segs[int(base.split("_")[1])] = o
                except ValueError:
                    pass
        for k, s in segs.items():
            sx = (k - 2.4) * 0.165
            sy = math.sin(k * 0.85) * 0.16
            sz = -k * 0.04
            s.location = v3(sx, sy, sz)
            s.rotation_euler = rot3(0.0, -0.35 if k == 0 else -0.85, 0.0)

    import_placed("enemy_volt_eel.glb", (1.40, 2.38, -1.35), (0.0, 0.0, 0.0), scale=1.15, post_fn=pose_eel)
    import_placed("enemy_rail_skater.glb", (3.25, 1.80, -1.35), (0.0, -0.38, 0.0), scale=1.22)

    # BOTTOM ROW (y=0.00 foreground stone): Barnacle Mortar (real face + peeking periscope!), Vent Stalker, Siphon Warden + Act 1-4 crowns!
    def pose_mortar(objs, _holder):
        for o in objs:
            if o.name.startswith("petal_pivot_"):
                o.rotation_euler.x -= 0.42

    import_placed("enemy_barnacle_mortar.glb", (-2.85, 0.0, 0.35), (0.0, 0.16, 0.0), scale=1.35, post_fn=pose_mortar)
    import_placed("enemy_vent_stalker.glb", (-0.95, 0.0, 0.45), (0.0, 0.45, 0.0), scale=1.32)

    def pose_warden(objs, _holder):
        for o in objs:
            base = o.name.split(".")[0]
            if base in ("crown_act_1", "crown_act_2", "crown_act_3", "crown_act_4"):
                o.hide_render = True
                o.hide_viewport = True

    import_placed("enemy_siphon_warden.glb", (1.20, 0.78, 0.35), (0.0, -0.18, 0.0), scale=1.02, post_fn=pose_warden)

    # Display Act 1..4 Warden Crowns cleanly on far right foreground!
    for act_i, (cx, cy) in enumerate(((2.95, 0.32), (3.75, 0.32), (2.95, 1.02), (3.75, 1.02)), start=1):
        def show_only_crown(objs, _holder, target=f"crown_act_{act_i}"):
            for o in objs:
                if o.type == "MESH" and o.name.split(".")[0] != target:
                    o.hide_render = True
                    o.hide_viewport = True
        import_placed("enemy_siphon_warden.glb", (cx, cy - 0.62, 0.45), (0.0, -0.18, 0.0), scale=0.72, post_fn=show_only_crown)

    def add_light(name, ltype, energy, color, pos_t3, rot_t3=(0.0, 0.0, 0.0), size=2.5):
        ld = bpy.data.lights.new(name, type=ltype)
        ld.energy = energy
        ld.color = color
        if ltype == "AREA":
            ld.size = size
        lo = bpy.data.objects.new(name, ld)
        lo.location = v3(*pos_t3)
        lo.rotation_euler = rot3(*rot_t3)
        bpy.context.collection.objects.link(lo)
        return lo

    add_light("KeySun", "AREA", 520.0, (1.0, 0.96, 0.88), (3.8, 5.6, 6.8), (-0.55, 0.42, 0.0), size=5.0)
    add_light("FillSky", "AREA", 240.0, (0.72, 0.88, 1.0), (-5.2, 4.0, 5.8), (-0.36, -0.54, 0.0), size=5.5)
    add_light("RimAqua", "AREA", 320.0, (0.38, 0.94, 1.0), (0.0, 4.6, -5.2), (0.65, math.pi, 0.0), size=8.5)

    cam_d = bpy.data.cameras.new("LineupCam")
    cam_d.lens = 36.0
    cam_o = bpy.data.objects.new("LineupCam", cam_d)
    cam_o.location = v3(0.05, 1.92, 8.65)
    direction = v3(0.05, 1.40, -0.35) - cam_o.location
    cam_o.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()
    bpy.context.collection.objects.link(cam_o)
    scene.camera = cam_o

    bpy.ops.render.render(write_still=True)


# ==============================================================================
# MAIN ENTRYPOINT
# ==============================================================================

def main():
    argv = sys.argv
    extra = argv[argv.index("--") + 1:] if "--" in argv else []
    lineup_path = None
    sentinel_path = os.path.join(TEMP_TEX_DIR, "enemies_v2_build_report.json")
    for idx, tok in enumerate(extra):
        if tok == "--lineup" and idx + 1 < len(extra):
            lineup_path = extra[idx + 1]
        elif tok == "--report" and idx + 1 < len(extra):
            sentinel_path = extra[idx + 1]

    builders = [
        build_enemy_snap_crab,
        build_enemy_gulp_hopper,
        build_enemy_volt_eel,
        build_enemy_rail_skater,
        build_enemy_barnacle_mortar,
        build_enemy_vent_stalker,
        build_enemy_siphon_warden,
    ]
    results = [fn() for fn in builders]

    if lineup_path:
        os.makedirs(os.path.dirname(os.path.abspath(lineup_path)), exist_ok=True)
        render_lineup_preview(lineup_path)

    report = {
        "ok": True,
        "count": len(results),
        "lineup": lineup_path,
        "models": results,
    }
    with open(sentinel_path, "w", encoding="utf-8") as f:
        json.dump(report, f, indent=2)


if __name__ == "__main__":
    try:
        main()
    except Exception:
        err_path = os.path.join(TEMP_TEX_DIR, "enemies_v2_build_error.txt")
        with open(err_path, "w", encoding="utf-8") as ef:
            ef.write(traceback.format_exc())
        raise
