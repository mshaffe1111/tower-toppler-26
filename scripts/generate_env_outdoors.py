"""
TOWERING WATERS: GATEWAY'S DESCENT — Outdoor Mini-Game Environment Kits Pipeline
================================================================================
Headless Blender 5.3.0.0 sculpting, PBR harmonizing, GLB export, and 3-panel
EEVEE beauty-sheet renderer for all 3 outdoor mini-game environment kits:

  1. `assets/models/env_rapids_gorge.glb` (Rapids Surf)
     - `CliffBank_Left`, `CliffBank_Right` (modular 18m stepped Sedona sandstone
       canyon cliff banks with mossy terraces & rounded Pixar 3D pine/redwood crowns)
     - `AqueductBridge_High` (26m-wide overhanging carved stone Pelagian aqueduct
       bridge arch spanning HIGH y >= 9.0m over the river with antique-bronze trim)
     - `TimberPier` (weathered redwood timber riverbank pier + glowing aqua lantern)
     - `RiverBoulder_A`, `RiverBoulder_B` (sculpted mossy river boulders)
     - `SlalomGate_Arch` (carved bronze-and-sandstone slalom gate w/ glowing aqua lanterns)
     - `SlalomRing_Bronze` (chunky 3D antique-bronze & sea-glass crystal slalom ring)
     - `HydroBoard_Hero` (sleek carved bronze-and-timber Hydro-Board for Gateway 2.0)
     - `SupplyBuoy_Pelagian` (chunky bronze-and-crystal smashable supply buoy)

  2. `assets/models/env_reef_grotto.glb` (Reef Swim)
     - `GrottoArch_Vault` (curved vaulted underwater Pelagian limestone ruin arch)
     - `SunkenColumn_A`, `SunkenColumn_B` (intact & broken fluted sunken columns)
     - `SeabedDune_Tile` (undulating 3D tileable sandy seabed dune section)
     - `ReefOutcrop_Rock` (rounded sculpted limestone outcrop shelf)
     - `Coral_Staghorn`, `Coral_Table`, `Coral_BrainDome`, `Coral_Anemone`,
       `Kelp_Cluster` (100% real chunky 3D sculpted coral & undulating ribbon kelp)
     - `SunkenAmphora` (sculpted bronze & terracotta sunken treasure amphorae)
     - `HydroRing_Reef` (chunky 3D antique-bronze & crystal glowing hydro-ring)

  3. `assets/models/env_sky_canyon.glb` (Frill Glide)
     - `SeaStack_Mesa_A` (terraced Sedona sandstone sea-stack mesa w/ rounded 3D tree crowns)
     - `SeaStack_Spire_B` (sculpted coastal sandstone arch-stack w/ bonsai terrace)
     - `Viaduct_SkyBridge` (ruined 3-arch stone Pelagian viaduct sky-bridge w/ bronze trim)
     - `Cumulus_Cloud_A`, `Cumulus_Cloud_B` (sculpted multi-lobe volumetric cumulus banks)
     - `ThermalRing_Bronze` (sculpted 3D bronze & golden-aqua crystal thermal updraft ring)
     - `StormCloud_Sculpted` (billowing dark-indigo 3D thunderhead cloud hazard)
     - `LaunchSanctuary_Deck`, `ArrivalSpire_Distant` (carved summit launch & arrival spire)

Usage (Blender 5.3 headless):
  C:\\Users\\mshaf\\AppData\\Local\\Microsoft\\WindowsApps\\blender-launcher.exe -b -P scripts/generate_env_outdoors.py -- --beauty <out.png>
"""

import os
import sys
import math
import json
import struct
import traceback

import bpy
import bmesh
import numpy as np
from mathutils import Vector, Matrix, Euler

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_DIR = os.path.dirname(SCRIPT_DIR)
TEX_DIR = os.path.join(PROJECT_DIR, "assets", "textures")
OUT_MODELS_DIR = os.path.join(PROJECT_DIR, "assets", "models")

DEFAULT_BRAIN_DIR = os.path.join(
    os.path.expanduser("~"),
    ".gemini",
    "antigravity",
    "brain",
    "e9d72e9b-b182-4691-a566-7d72e2078abf",
)
DEFAULT_BEAUTY_PATH = os.path.join(DEFAULT_BRAIN_DIR, "r6_rescue_eevee_outdoors.png")
DEFAULT_REPORT_PATH = os.path.join(DEFAULT_BRAIN_DIR, "scratch", "env_outdoors_report.json")

os.makedirs(OUT_MODELS_DIR, exist_ok=True)
os.makedirs(os.path.dirname(DEFAULT_REPORT_PATH), exist_ok=True)

TAU = math.pi * 2.0


# ==============================================================================
# COORDINATE, MATH & COLOR HELPERS (Three.js Y-up -> Blender Z-up)
# ==============================================================================

def v3(tx, ty, tz):
    """Converts Three.js (x, y_up, z_toward_cam) into Blender (x, -z, y_up)."""
    return Vector((float(tx), -float(tz), float(ty)))


def b_to_t3(bv):
    """Converts Blender Vector (bx, by, bz) back to Three.js (tx, ty_up, tz)."""
    return (float(bv.x), float(bv.z), float(-bv.y))


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


def clamp(v, a, b):
    return a if v < a else (b if v > b else v)


def lerp(a, b, t):
    return a + (b - a) * t


def sstep(e0, e1, x):
    t = clamp((x - e0) / max(1e-6, e1 - e0), 0.0, 1.0)
    return t * t * (3.0 - 2.0 * t)


def srgb_to_lin(c):
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def hex_srgb(h):
    h = h.lstrip("#")
    return (int(h[0:2], 16) / 255.0, int(h[2:4], 16) / 255.0, int(h[4:6], 16) / 255.0)


def hex_lin(h):
    r, g, b = hex_srgb(h)
    return (srgb_to_lin(r), srgb_to_lin(g), srgb_to_lin(b))


def mix_rgb(c0, c1, t):
    t = clamp(t, 0.0, 1.0)
    return (lerp(c0[0], c1[0], t), lerp(c0[1], c1[1], t), lerp(c0[2], c1[2], t))


def hash3(x, y, z, seed=0.0):
    n = math.sin(x * 127.1 + y * 311.7 + z * 74.7 + seed * 19.19) * 43758.5453
    return n - math.floor(n)


def smooth_noise3(x, y, z, seed=0.0):
    ix, iy, iz = math.floor(x), math.floor(y), math.floor(z)
    fx, fy, fz = x - ix, y - iy, z - iz
    ux, uy, uz = fx * fx * (3 - 2 * fx), fy * fy * (3 - 2 * fy), fz * fz * (3 - 2 * fz)
    c000 = hash3(ix, iy, iz, seed)
    c100 = hash3(ix + 1, iy, iz, seed)
    c010 = hash3(ix, iy + 1, iz, seed)
    c110 = hash3(ix + 1, iy + 1, iz, seed)
    c001 = hash3(ix, iy, iz + 1, seed)
    c101 = hash3(ix + 1, iy, iz + 1, seed)
    c011 = hash3(ix, iy + 1, iz + 1, seed)
    c111 = hash3(ix + 1, iy + 1, iz + 1, seed)
    x00 = lerp(c000, c100, ux)
    x10 = lerp(c010, c110, ux)
    x01 = lerp(c001, c101, ux)
    x11 = lerp(c011, c111, ux)
    y0 = lerp(x00, x10, uy)
    y1 = lerp(x01, x11, uy)
    return lerp(y0, y1, uz)


def fbm3(x, y, z, seed=0.0, octaves=3):
    val = 0.0
    amp = 0.55
    freq = 1.0
    for o in range(octaves):
        val += amp * (smooth_noise3(x * freq, y * freq, z * freq, seed + o * 7.3) * 2.0 - 1.0)
        freq *= 2.05
        amp *= 0.48
    return val


def reset_scene():
    _IMG_CACHE.clear()
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.unit_settings.system = "METRIC"
    scene.unit_settings.scale_length = 1.0
    return scene


# ==============================================================================
# HARMONIZED PBR MATERIAL LIBRARY (REUSING MAIN SPIRE 1K/512 WEBP PBR MAPS!)
# ==============================================================================

_IMG_CACHE = {}


def load_tex_image(filename, is_color=True):
    key = (filename, is_color)
    if key in _IMG_CACHE:
        try:
            img = _IMG_CACHE[key]
            if img and img.name in bpy.data.images:
                return img
        except ReferenceError:
            _IMG_CACHE.pop(key, None)
    path = os.path.join(TEX_DIR, filename)
    if not os.path.exists(path):
        raise FileNotFoundError(f"Missing texture: {path}")
    img = bpy.data.images.load(path, check_existing=True)
    img.colorspace_settings.name = "sRGB" if is_color else "Non-Color"
    # Keep embedded textures compact (<= 512px) so HydroBoard_Hero doesn't bloat GLB size!
    try:
        if img.size[0] > 512 or img.size[1] > 512:
            img.scale(512, 512)
    except Exception:
        pass
    try:
        img.pack()
    except Exception:
        pass
    _IMG_CACHE[key] = img
    return img


def make_pbr_tex_mat(
    name,
    albedo_file,
    normal_file=None,
    orm_file=None,
    tint_hex="#ffffff",
    roughness=0.72,
    metallic=0.0,
    normal_strength=0.95,
    use_vcol=True,
    emissive_hex=None,
    emissive_strength=0.0,
    double_sided=False,
):
    if name in bpy.data.materials:
        return bpy.data.materials[name]
    mat = bpy.data.materials.new(name=name)
    mat.use_nodes = True
    mat.use_backface_culling = not double_sided
    nt = mat.node_tree
    nt.nodes.clear()

    out = nt.nodes.new("ShaderNodeOutputMaterial")
    out.location = (600, 0)
    bsdf = nt.nodes.new("ShaderNodeBsdfPrincipled")
    bsdf.location = (260, 0)
    nt.links.new(bsdf.outputs["BSDF"], out.inputs["Surface"])

    # Albedo texture
    tex_alb = nt.nodes.new("ShaderNodeTexImage")
    tex_alb.location = (-480, 260)
    tex_alb.image = load_tex_image(albedo_file, is_color=True)

    col_out = tex_alb.outputs["Color"]

    # Optional tint multiply
    if tint_hex and tint_hex.lower() != "#ffffff":
        mix_t = nt.nodes.new("ShaderNodeMix")
        mix_t.data_type = "RGBA"
        mix_t.blend_type = "MULTIPLY"
        mix_t.inputs["Factor"].default_value = 1.0
        r, g, b = hex_lin(tint_hex)
        mix_t.inputs["B"].default_value = (r, g, b, 1.0)
        mix_t.location = (-200, 260)
        nt.links.new(col_out, mix_t.inputs["A"])
        col_out = mix_t.outputs["Result"]

    # Vertex AO / color multiply (exports cleanly as COLOR_0 * baseColorTexture in glTF 2.0)
    if use_vcol:
        vc = nt.nodes.new("ShaderNodeVertexColor")
        vc.layer_name = "Color"
        vc.location = (-460, 480)
        mix_v = nt.nodes.new("ShaderNodeMix")
        mix_v.data_type = "RGBA"
        mix_v.blend_type = "MULTIPLY"
        mix_v.inputs["Factor"].default_value = 1.0
        mix_v.location = (0, 320)
        nt.links.new(col_out, mix_v.inputs["A"])
        nt.links.new(vc.outputs["Color"], mix_v.inputs["B"])
        col_out = mix_v.outputs["Result"]

    nt.links.new(col_out, bsdf.inputs["Base Color"])

    # ORM (R=AO, G=Roughness, B=Metallic) or scalar
    if orm_file and os.path.exists(os.path.join(TEX_DIR, orm_file)):
        tex_orm = nt.nodes.new("ShaderNodeTexImage")
        tex_orm.location = (-480, -40)
        tex_orm.image = load_tex_image(orm_file, is_color=False)
        sep = nt.nodes.new("ShaderNodeSeparateColor")
        sep.location = (-180, -40)
        nt.links.new(tex_orm.outputs["Color"], sep.inputs["Color"])
        nt.links.new(sep.outputs["Green"], bsdf.inputs["Roughness"])
        nt.links.new(sep.outputs["Blue"], bsdf.inputs["Metallic"])
    else:
        bsdf.inputs["Roughness"].default_value = roughness
        bsdf.inputs["Metallic"].default_value = metallic

    # Normal map
    if normal_file and os.path.exists(os.path.join(TEX_DIR, normal_file)):
        tex_nrm = nt.nodes.new("ShaderNodeTexImage")
        tex_nrm.location = (-480, -340)
        tex_nrm.image = load_tex_image(normal_file, is_color=False)
        nrm = nt.nodes.new("ShaderNodeNormalMap")
        nrm.location = (-120, -340)
        nrm.inputs["Strength"].default_value = normal_strength
        nt.links.new(tex_nrm.outputs["Color"], nrm.inputs["Color"])
        nt.links.new(nrm.outputs["Normal"], bsdf.inputs["Normal"])

    # Optional soft emissive bounce
    if emissive_hex and emissive_strength > 0.0:
        er, eg, eb = hex_lin(emissive_hex)
        bsdf.inputs["Emission Color"].default_value = (er, eg, eb, 1.0)
        bsdf.inputs["Emission Strength"].default_value = emissive_strength

    return mat


def make_vcol_stylized_mat(
    name,
    roughness=0.58,
    metallic=0.0,
    normal_file=None,
    normal_strength=0.45,
    emissive_vcol_strength=0.0,
    emissive_hex=None,
    emissive_strength=0.0,
    double_sided=False,
):
    if name in bpy.data.materials:
        return bpy.data.materials[name]
    mat = bpy.data.materials.new(name=name)
    mat.use_nodes = True
    mat.use_backface_culling = not double_sided
    nt = mat.node_tree
    nt.nodes.clear()

    out = nt.nodes.new("ShaderNodeOutputMaterial")
    out.location = (520, 0)
    bsdf = nt.nodes.new("ShaderNodeBsdfPrincipled")
    bsdf.location = (200, 0)
    nt.links.new(bsdf.outputs["BSDF"], out.inputs["Surface"])

    vc = nt.nodes.new("ShaderNodeVertexColor")
    vc.layer_name = "Color"
    vc.location = (-260, 220)
    nt.links.new(vc.outputs["Color"], bsdf.inputs["Base Color"])

    bsdf.inputs["Roughness"].default_value = roughness
    bsdf.inputs["Metallic"].default_value = metallic

    if normal_file and os.path.exists(os.path.join(TEX_DIR, normal_file)):
        tex_nrm = nt.nodes.new("ShaderNodeTexImage")
        tex_nrm.location = (-360, -240)
        tex_nrm.image = load_tex_image(normal_file, is_color=False)
        nrm = nt.nodes.new("ShaderNodeNormalMap")
        nrm.location = (-80, -240)
        nrm.inputs["Strength"].default_value = normal_strength
        nt.links.new(tex_nrm.outputs["Color"], nrm.inputs["Color"])
        nt.links.new(nrm.outputs["Normal"], bsdf.inputs["Normal"])

    if emissive_hex and emissive_strength > 0.0:
        er, eg, eb = hex_lin(emissive_hex)
        bsdf.inputs["Emission Color"].default_value = (er, eg, eb, 1.0)
        bsdf.inputs["Emission Strength"].default_value = emissive_strength
    # NOTE: Never link VertexColor -> Emission Color for glTF 2.0 export, as glTF
    # has no per-vertex emission and falls back to uniform white emissiveFactor!

    return mat


def make_emissive_crystal_mat(name, base_hex, emissive_hex, strength=2.2, roughness=0.14, metallic=0.18):
    if name in bpy.data.materials:
        return bpy.data.materials[name]
    mat = bpy.data.materials.new(name=name)
    mat.use_nodes = True
    nt = mat.node_tree
    nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    bsdf = nt.nodes.new("ShaderNodeBsdfPrincipled")
    nt.links.new(bsdf.outputs["BSDF"], out.inputs["Surface"])
    br, bg, bb = hex_lin(base_hex)
    er, eg, eb = hex_lin(emissive_hex)
    bsdf.inputs["Base Color"].default_value = (br, bg, bb, 1.0)
    bsdf.inputs["Roughness"].default_value = roughness
    bsdf.inputs["Metallic"].default_value = metallic
    bsdf.inputs["Emission Color"].default_value = (er, eg, eb, 1.0)
    bsdf.inputs["Emission Strength"].default_value = min(1.55, float(strength))
    return mat


# ==============================================================================
# BMESH SCULPTING, TRIPLANAR UV & VERTEX COLOR AO UTILITIES
# ==============================================================================

def apply_box_uvs(bm, scale=0.25, u_shift=0.0, v_shift=0.0):
    """Clean world-scale triplanar/box UV mapping so stone strata run horizontally!"""
    uv_layer = bm.loops.layers.uv.verify()
    bm.faces.ensure_lookup_table()
    for f in bm.faces:
        n = f.normal
        ax, ay, az = abs(n.x), abs(n.y), abs(n.z)
        for loop in f.loops:
            tx, ty, tz = b_to_t3(loop.vert.co)
            if az >= ax and az >= ay:
                # Blender Z = Three.js Y (top/bottom horizontal cap)
                u, v = tx * scale, tz * scale
            elif ax >= ay:
                # Facing X -> horizontal along Z, vertical along Y
                u, v = tz * scale, ty * scale
            else:
                # Facing Z -> horizontal along X, vertical along Y
                u, v = tx * scale, ty * scale
            loop[uv_layer].uv = (u + u_shift, v + v_shift)


def paint_bmesh_vcol(bm, color_fn, face_filter=None):
    """Paints linear vertex colors into the `Color` corner attribute."""
    col_layer = bm.loops.layers.color.get("Color")
    if col_layer is None:
        col_layer = bm.loops.layers.color.new("Color")
    bm.normal_update()
    for f in bm.faces:
        if face_filter is not None and not face_filter(f):
            continue
        fn = f.normal
        # Three.js normal (nx, ny_up, nz)
        tnx, tny, tnz = float(fn.x), float(fn.z), float(-fn.y)
        for loop in f.loops:
            tx, ty, tz = b_to_t3(loop.vert.co)
            vn = loop.vert.normal
            vnx, vny, vnz = float(vn.x), float(vn.z), float(-vn.y)
            r, g, b = color_fn(tx, ty, tz, vnx, vny, vnz, tny, f.material_index)
            loop[col_layer] = (clamp(r, 0.0, 1.0), clamp(g, 0.0, 1.0), clamp(b, 0.0, 1.0), 1.0)


def paint_faces_gradient(bm, faces, bot_hex, mid_hex, top_hex, y_min, y_max, ao_strength=0.22):
    c_bot = hex_lin(bot_hex)
    c_mid = hex_lin(mid_hex)
    c_top = hex_lin(top_hex)
    col_layer = bm.loops.layers.color.get("Color")
    if col_layer is None:
        col_layer = bm.loops.layers.color.new("Color")
    span = max(1e-4, y_max - y_min)
    for f in faces:
        for loop in f.loops:
            tx, ty, tz = b_to_t3(loop.vert.co)
            vn = loop.vert.normal
            ny = float(vn.z)  # Three.js +Y up
            t = clamp((ty - y_min) / span, 0.0, 1.0)
            if t < 0.5:
                c = mix_rgb(c_bot, c_mid, t * 2.0)
            else:
                c = mix_rgb(c_mid, c_top, (t - 0.5) * 2.0)
            # Subtle skylight normal AO boost
            sky = 1.0 - ao_strength * clamp(0.5 - ny * 0.5, 0.0, 1.0)
            loop[col_layer] = (clamp(c[0] * sky, 0.0, 1.0), clamp(c[1] * sky, 0.0, 1.0), clamp(c[2] * sky, 0.0, 1.0), 1.0)


def make_empty_node(name, pos_t3=(0.0, 0.0, 0.0), rot_t3=(0.0, 0.0, 0.0), parent=None):
    obj = bpy.data.objects.new(name, None)
    obj.location = v3(*pos_t3)
    obj.rotation_euler = rot3(*rot_t3)
    bpy.context.collection.objects.link(obj)
    if parent is not None:
        obj.parent = parent
    return obj


def finalize_mesh_obj(name, bm, materials, pos=(0.0, 0.0, 0.0), rot=(0.0, 0.0, 0.0), parent=None, smooth=True, recalc_normals=True):
    mesh = bpy.data.meshes.new(name)
    if recalc_normals:
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    for f in bm.faces:
        f.smooth = smooth
    bm.to_mesh(mesh)
    bm.free()

    mats = materials if isinstance(materials, (list, tuple)) else [materials]
    for m in mats:
        mesh.materials.append(m)

    obj = bpy.data.objects.new(name, mesh)
    obj.location = v3(*pos)
    obj.rotation_euler = rot3(*rot)
    bpy.context.collection.objects.link(obj)
    if parent is not None:
        obj.parent = parent
    return obj


def add_bevel_box(bm, center_t3, size_t3, bevel=0.05, segs=1, rot_t3=(0.0, 0.0, 0.0), mat_idx=0):
    sx, sy, sz = size_t3
    before_verts = set(bm.verts)
    res = bmesh.ops.create_cube(bm, size=1.0)
    verts = res["verts"]
    for v in verts:
        v.co.x *= sx
        v.co.y *= sz
        v.co.z *= sy
    edges = list({e for v in verts for e in v.link_edges})
    if bevel > 1e-4:
        b = min(bevel, sx * 0.42, sy * 0.42, sz * 0.42)
        bmesh.ops.bevel(bm, geom=edges, offset=b, segments=segs, affect="EDGES", clamp_overlap=True)
    # Gather ALL vertices created by create_cube + bevel (bevel replaces original verts!)
    vset = [v for v in bm.verts if v not in before_verts and v.is_valid]
    fset = {f for v in vset for f in v.link_faces if f.is_valid}
    rmat = rot3(*rot_t3).to_matrix().to_4x4()
    tvec = v3(*center_t3)
    for v in vset:
        v.co = (rmat @ v.co) + tvec
    for f in fset:
        f.material_index = mat_idx
    return fset


def add_cylinder_t3(
    bm,
    center_t3,
    r_bot,
    r_top,
    height,
    segs=14,
    rot_t3=(0.0, 0.0, 0.0),
    mat_idx=0,
    flutes=0,
    flute_depth=0.04,
):
    res = bmesh.ops.create_cone(
        bm,
        cap_ends=True,
        cap_tris=False,
        segments=segs,
        radius1=r_bot,
        radius2=r_top,
        depth=height,
    )
    verts = res["verts"]
    if flutes > 0:
        for v in verts:
            r = math.hypot(v.co.x, v.co.y)
            if r > 1e-4:
                ang = math.atan2(v.co.y, v.co.x)
                # Keep top/bottom lips clean
                z_end = 1.0 - sstep(height * 0.36, height * 0.48, abs(v.co.z))
                sc = 1.0 - flute_depth * (0.5 + 0.5 * math.cos(ang * flutes)) * z_end
                v.co.x *= sc
                v.co.y *= sc
    fset = {f for v in verts for f in v.link_faces}
    rmat = rot3(*rot_t3).to_matrix().to_4x4()
    tvec = v3(*center_t3)
    for v in verts:
        v.co = (rmat @ v.co) + tvec
    for f in fset:
        f.material_index = mat_idx
    return fset


def add_organic_blob(
    bm,
    center_t3,
    radii_t3,
    subdivs=2,
    noise_amp=0.14,
    noise_freq=1.6,
    seed=1.0,
    flatten_bottom=None,
    strata_amp=0.0,
    strata_freq=4.5,
    mat_idx=0,
):
    """Creates a smooth organic sculpted rock / cloud / foliage puff from an icosphere."""
    res = bmesh.ops.create_icosphere(bm, subdivisions=subdivs, radius=1.0)
    verts = res["verts"]
    rx, ry, rz = radii_t3
    cx, cy, cz = center_t3
    for v in verts:
        # In Blender coords: x=tx, y=-tz, z=ty
        nx, ny_up, nz = v.co.x, v.co.z, -v.co.y
        n = fbm3(nx * noise_freq + seed, ny_up * noise_freq, nz * noise_freq - seed, seed=seed, octaves=3)
        d = 1.0 + n * noise_amp
        if strata_amp > 0.0:
            d += math.sin(ny_up * strata_freq + seed) * strata_amp
        tx = nx * rx * d
        ty = ny_up * ry * d
        tz = nz * rz * d
        if flatten_bottom is not None and ty < flatten_bottom:
            ty = lerp(ty, flatten_bottom, 0.72)
        v.co = v3(cx + tx, cy + ty, cz + tz)
    fset = {f for v in verts for f in v.link_faces}
    for f in fset:
        f.material_index = mat_idx
    return fset


def add_loft_tube(bm, points_t3, radii, rad_segs=8, cap_start=True, cap_end=True, mat_idx=0, twist=0.0, oval_ratio=1.0):
    """Sweeps a smooth 3D tube along Three.js polyline `points_t3`."""
    n = len(points_t3)
    if n < 2:
        return set()
    pts = [v3(*p) for p in points_t3]
    if isinstance(radii, (int, float)):
        r_list = [float(radii)] * n
    else:
        r_list = [float(r) for r in radii]

    rings = []
    prev_n = Vector((1.0, 0.0, 0.0))
    for i in range(n):
        if i == 0:
            tang = (pts[1] - pts[0]).normalized()
        elif i == n - 1:
            tang = (pts[-1] - pts[-2]).normalized()
        else:
            tang = (pts[i + 1] - pts[i - 1]).normalized()
        if tang.length < 1e-6:
            tang = Vector((0.0, 0.0, 1.0))
        if abs(tang.dot(prev_n)) > 0.94:
            ref = Vector((0.0, 1.0, 0.0)) if abs(tang.y) < 0.9 else Vector((1.0, 0.0, 0.0))
            norm = tang.cross(ref).normalized()
        else:
            norm = (prev_n - tang * prev_n.dot(tang)).normalized()
        binorm = tang.cross(norm).normalized()
        prev_n = norm

        r = r_list[i]
        ring = []
        tw = twist * (i / max(1, n - 1))
        for j in range(rad_segs):
            a = (j / rad_segs) * TAU + tw
            ca, sa = math.cos(a) * r, math.sin(a) * r * oval_ratio
            p = pts[i] + norm * ca + binorm * sa
            ring.append(bm.verts.new(p))
        rings.append(ring)

    faces = set()
    for i in range(n - 1):
        r0, r1 = rings[i], rings[i + 1]
        for j in range(rad_segs):
            jn = (j + 1) % rad_segs
            try:
                f = bm.faces.new((r0[j], r0[jn], r1[jn], r1[j]))
                f.material_index = mat_idx
                faces.add(f)
            except ValueError:
                pass

    if cap_start:
        c0 = bm.verts.new(pts[0])
        for j in range(rad_segs):
            jn = (j + 1) % rad_segs
            try:
                f = bm.faces.new((c0, rings[0][jn], rings[0][j]))
                f.material_index = mat_idx
                faces.add(f)
            except ValueError:
                pass
    if cap_end:
        c1 = bm.verts.new(pts[-1])
        for j in range(rad_segs):
            jn = (j + 1) % rad_segs
            try:
                f = bm.faces.new((c1, rings[-1][j], rings[-1][jn]))
                f.material_index = mat_idx
                faces.add(f)
            except ValueError:
                pass
    return faces


def add_beveled_torus_t3(bm, center_t3, major_r, minor_r, maj_segs=28, min_segs=10, axis="Z", mat_idx=0):
    """Creates a chunky 3D torus ring oriented around Three.js axis ('X', 'Y', or 'Z')."""
    cx, cy, cz = center_t3
    rings = []
    for i in range(maj_segs):
        a = (i / maj_segs) * TAU
        ca, sa = math.cos(a), math.sin(a)
        ring = []
        for j in range(min_segs):
            b = (j / min_segs) * TAU
            cb, sb = math.cos(b), math.sin(b)
            # Subtle sculptural octagonal/chamfered fullness
            rr = major_r + minor_r * cb
            zz = minor_r * sb
            if axis == "Z":
                pt = (cx + rr * ca, cy + rr * sa, cz + zz)
            elif axis == "Y":
                pt = (cx + rr * ca, cy + zz, cz + rr * sa)
            else:
                pt = (cx + zz, cy + rr * sa, cz + rr * ca)
            ring.append(bm.verts.new(v3(*pt)))
        rings.append(ring)
    faces = set()
    for i in range(maj_segs):
        r0 = rings[i]
        r1 = rings[(i + 1) % maj_segs]
        for j in range(min_segs):
            jn = (j + 1) % min_segs
            try:
                f = bm.faces.new((r0[j], r1[j], r1[jn], r0[jn]))
                f.material_index = mat_idx
                faces.add(f)
            except ValueError:
                pass
    return faces


def add_pixar_tree(bm, base_t3, scale=1.0, seed=1.0, mat_trunk=1, mat_foliage=2):
    """Sculpts a lush Pixar/Nintendo stylized 3D tree with tapered trunk & billowing rounded 3D crown lobes."""
    bx, by, bz = base_t3
    trunk_h = 2.1 * scale
    add_loft_tube(
        bm,
        [
            (bx, by - 0.18 * scale, bz),
            (bx + 0.06 * scale * math.sin(seed), by + trunk_h * 0.45, bz + 0.05 * scale * math.cos(seed)),
            (bx - 0.04 * scale * math.cos(seed), by + trunk_h, bz),
        ],
        [0.28 * scale, 0.19 * scale, 0.11 * scale],
        rad_segs=7,
        cap_start=True,
        cap_end=True,
        mat_idx=mat_trunk,
    )
    # 3 layered plush billowing 3D crown clusters (ZERO flat spiky planes!)
    fol_faces = set()
    lobe_specs = [
        # Lower lush skirt of 4 offset rounded pillows
        (-0.72, 1.85,  0.42, 0.92, 0.68, 0.88),
        ( 0.74, 1.92,  0.34, 0.90, 0.66, 0.86),
        ( 0.12, 1.95, -0.72, 0.96, 0.70, 0.90),
        (-0.36, 2.02, -0.52, 0.86, 0.66, 0.84),
        # Mid full canopy billows
        (-0.44, 2.72,  0.22, 0.88, 0.74, 0.86),
        ( 0.48, 2.68, -0.18, 0.84, 0.72, 0.82),
        # Sunlit rounded dome crown
        ( 0.02, 3.45,  0.04, 0.82, 0.72, 0.82),
    ]
    for idx, (ox, oy, oz, rx, ry, rz) in enumerate(lobe_specs):
        ang = seed * 1.3
        ca, sa = math.cos(ang), math.sin(ang)
        rx_o = (ox * ca - oz * sa) * scale
        rz_o = (ox * sa + oz * ca) * scale
        fs = add_organic_blob(
            bm,
            (bx + rx_o, by + oy * scale, bz + rz_o),
            (rx * scale, ry * scale, rz * scale),
            subdivs=2,
            noise_amp=0.11,
            noise_freq=1.5,
            seed=seed + idx * 3.1,
            flatten_bottom=-ry * scale * 0.45,
            mat_idx=mat_foliage,
        )
        fol_faces.update(fs)
    return fol_faces


def export_glb_and_inspect(filepath, max_tris=18000, max_mb=2.5):
    bpy.ops.object.select_all(action="SELECT")
    export_kwargs = dict(
        filepath=filepath,
        export_format="GLB",
        use_selection=True,
        export_yup=True,
        export_apply=True,
        export_texcoords=True,
        export_normals=True,
        export_tangents=False,
        export_materials="EXPORT",
        export_image_format="WEBP",
        export_image_quality=76,
        export_vertex_color="MATERIAL",
        export_all_vertex_colors=True,
        export_animations=False,
    )
    op_props = set(bpy.ops.export_scene.gltf.get_rna_type().properties.keys())
    safe_kwargs = {k: v for k, v in export_kwargs.items() if k in op_props}
    bpy.ops.export_scene.gltf(**safe_kwargs)

    size_bytes = os.path.getsize(filepath)
    with open(filepath, "rb") as f:
        f.read(12)
        chunk_len, _ = struct.unpack("<II", f.read(8))
        gltf = json.loads(f.read(chunk_len).decode("utf-8"))

    accessors = gltf.get("accessors", [])
    total_tris = 0
    per_mesh = {}
    for m in gltf.get("meshes", []):
        m_tris = 0
        for p in m.get("primitives", []):
            if "indices" in p:
                m_tris += accessors[p["indices"]]["count"] // 3
            elif "POSITION" in p.get("attributes", {}):
                m_tris += accessors[p["attributes"]["POSITION"]]["count"] // 3
        per_mesh[m.get("name", "?")] = m_tris
        total_tris += m_tris

    size_mb = round(size_bytes / (1024 * 1024), 3)
    node_names = [n.get("name", "") for n in gltf.get("nodes", [])]
    info = {
        "path": filepath,
        "size_bytes": size_bytes,
        "size_mb": size_mb,
        "total_tris": total_tris,
        "within_tri_budget": total_tris <= max_tris,
        "within_size_budget": size_mb <= max_mb,
        "embedded_images": len(gltf.get("images", [])),
        "meshes": per_mesh,
        "nodes": node_names,
    }
    print(f"[EXPORT] {os.path.basename(filepath)}: {total_tris} tris, {size_mb} MB, {len(gltf.get('images', []))} imgs")
    if total_tris > max_tris:
        raise RuntimeError(f"{filepath} exceeded tri budget: {total_tris} > {max_tris}")
    if size_mb > max_mb:
        raise RuntimeError(f"{filepath} exceeded size budget: {size_mb} MB > {max_mb} MB")
    return info


# ==============================================================================
# KIT 1: `assets/models/env_rapids_gorge.glb` (RAPIDS SURF)
# ==============================================================================

def build_env_rapids_gorge():
    reset_scene()

    mat_sandstone = make_pbr_tex_mat(
        "Mat_Rapids_Sandstone",
        "arch_canyon_sandstone_albedo.webp",
        "arch_canyon_sandstone_normal.webp",
        "arch_canyon_sandstone_orm.webp",
        tint_hex="#ffe8d4",
        normal_strength=1.05,
        use_vcol=True,
    )
    mat_travertine = make_pbr_tex_mat(
        "Mat_Rapids_Travertine",
        "arch_coral_travertine_albedo.webp",
        "arch_coral_travertine_normal.webp",
        "arch_coral_travertine_orm.webp",
        tint_hex="#f7e8d2",
        normal_strength=0.95,
        use_vcol=True,
    )
    mat_bronze = make_pbr_tex_mat(
        "Mat_Rapids_Bronze",
        "arch_antique_bronze_albedo.webp",
        "arch_antique_bronze_normal.webp",
        "arch_antique_bronze_orm.webp",
        tint_hex="#ffdba4",
        normal_strength=0.90,
        use_vcol=True,
    )
    mat_timber = make_pbr_tex_mat(
        "Mat_Rapids_Timber",
        "arch_redwood_timber_albedo.webp",
        "arch_redwood_timber_normal.webp",
        "arch_redwood_timber_orm.webp",
        tint_hex="#f4dbc8",
        normal_strength=0.95,
        use_vcol=True,
    )
    mat_skimmer = make_pbr_tex_mat(
        "Mat_Rapids_BoardWood",
        "mg_pbr_skimmer_wood_albedo.webp",
        "mg_pbr_skimmer_wood_normal.webp",
        None,
        tint_hex="#ffe8d6",
        roughness=0.34,
        metallic=0.14,
        normal_strength=1.0,
        use_vcol=True,
    )
    mat_foliage = make_vcol_stylized_mat(
        "Mat_Rapids_Foliage",
        roughness=0.72,
        metallic=0.0,
        emissive_vcol_strength=0.06,
    )
    mat_glow_aqua = make_emissive_crystal_mat(
        "Mat_Rapids_AquaCrystal",
        "#99f6ff",
        "#2ce8e4",
        strength=2.4,
        roughness=0.12,
        metallic=0.12,
    )

    # ------------------------------------------------------------------
    # 1. `CliffBank_Left` & `CliffBank_Right` (21m overlapping stepped Sedona bluffs!)
    #    Local origin x=0 sits at water's edge; rock recedes outward in +X (Right)
    #    or -X (Left), z in [-10.5, +10.5] with wrapped end caps -> ZERO gaps on S-curves!
    # ------------------------------------------------------------------
    def build_cliff_bank(side_sign, obj_name, seed):
        bm = bmesh.new()
        nz_segs = 14
        span_z = 21.0
        # Sculpted stepped canyon cross-section (x_outward, y_up):
        # 3 gorgeous horizontal Sedona strata benches + undercut riverbank!
        profile = [
            (-0.35, -1.8),  # submerged river wall toe
            ( 0.00,  0.15), # waterline undercut
            ( 0.90,  1.25), # bench 1 edge
            ( 2.40,  1.55), # bench 1 mossy terrace
            ( 2.80,  4.45), # mid stratified cliff wall
            ( 4.15,  4.90), # bench 2 terrace
            ( 4.70,  8.65), # upper canyon bluff face
            ( 6.45,  9.25), # upper rim plateau
            (11.40,  9.65), # back mesa shelf
            (12.20, -1.80), # outer back skirt
        ]
        n_prof = len(profile)
        grid = []
        for iz in range(nz_segs + 1):
            u = iz / float(nz_segs)
            tz = -span_z * 0.5 + u * span_z
            ang = u * TAU
            row = []
            for ip, (px, py) in enumerate(profile):
                if ip == 0 or ip == n_prof - 1:
                    ox, oy = px, py
                else:
                    buttress = (
                        math.sin(ang * 2.0 + seed + ip * 0.45) * 0.50
                        + math.cos(ang * 3.0 - seed * 1.4 + ip * 0.8) * 0.26
                    )
                    strata_j = math.sin(ang * 4.0 + ip * 1.7 + seed) * 0.14
                    w_scale = 0.42 if ip <= 2 else (0.72 if ip <= 5 else 1.0)
                    ox = px + buttress * w_scale
                    oy = py + strata_j * (0.35 if ip <= 2 else 0.70)
                row.append(bm.verts.new(v3(side_sign * ox, oy, tz)))
            grid.append(row)

        cliff_faces = set()
        for iz in range(nz_segs):
            for ip in range(n_prof - 1):
                v00 = grid[iz][ip]
                v10 = grid[iz + 1][ip]
                v11 = grid[iz + 1][ip + 1]
                v01 = grid[iz][ip + 1]
                # Ensure outward normals point INWARD toward the river (-side_sign * X) and UP (+Y)!
                verts = (v00, v10, v11, v01) if side_sign > 0 else (v00, v01, v11, v10)
                f = bm.faces.new(verts)
                f.material_index = 0
                cliff_faces.add(f)

        # Close both Z end-caps solidly so curved river banks NEVER reveal thin sky slivers!
        for end_iz, rev in ((0, side_sign < 0), (nz_segs, side_sign > 0)):
            r_end = grid[end_iz]
            try:
                f_cap = bm.faces.new(tuple(reversed(r_end)) if rev else tuple(r_end))
                f_cap.material_index = 0
            except ValueError:
                pass

        # Sculpted mossy cushions nestled flush into the horizontal sandstone ledges (mat_idx=2)
        moss_specs = [
            (1.95, 1.38, -5.6, 1.15, 0.28, 1.85),
            (2.05, 1.42,  2.8, 1.20, 0.30, 2.15),
            (3.75, 4.72, -1.8, 1.10, 0.30, 2.25),
            (3.85, 4.76,  6.2, 1.08, 0.28, 1.85),
            (6.25, 9.18, -4.8, 1.95, 0.38, 2.85),
            (6.45, 9.22,  4.4, 2.05, 0.40, 3.10),
        ]
        for idx, (mx, my, mz, rx, ry, rz) in enumerate(moss_specs):
            add_organic_blob(
                bm,
                (side_sign * mx, my, mz),
                (rx, ry, rz),
                subdivs=2,
                noise_amp=0.14,
                noise_freq=1.2,
                seed=seed + idx * 5.2,
                flatten_bottom=-ry * 0.35,
                mat_idx=2,
            )

        # 2 lush Pixar 3D stylized pine/redwood trees crowning the upper rim plateau!
        for t_idx, (tx, ty, tz, tsc) in enumerate([
            (6.35, 9.18, -4.8, 1.18),
            (6.75, 9.24,  4.5, 1.04),
        ]):
            add_pixar_tree(bm, (side_sign * tx, ty, tz), scale=tsc, seed=seed + t_idx * 9.7, mat_trunk=1, mat_foliage=2)

        apply_box_uvs(bm, scale=0.18)

        # Paint warm sandstone strata AO + wet darker riverbank base, rich mossy greens, sunlit tree crowns
        def cliff_vcol(tx, ty, tz, vnx, vny, vnz, fny, mat_idx):
            if mat_idx == 0:
                wet = sstep(-0.3, 1.2, ty)
                warm = sstep(2.0, 9.5, ty)
                c_wet = hex_lin("#745242")
                c_mid = hex_lin("#e8c8b0")
                c_top = hex_lin("#fff0dc")
                c = mix_rgb(c_wet, c_mid, wet)
                c = mix_rgb(c, c_top, warm * 0.65)
                ao = 0.78 + 0.22 * clamp(vny * 0.5 + 0.5, 0.0, 1.0)
                return (c[0] * ao, c[1] * ao, c[2] * ao)
            elif mat_idx == 1:
                c = hex_lin("#aa8268")
                ao = 0.72 + 0.28 * clamp(vny * 0.5 + 0.5, 0.0, 1.0)
                return (c[0] * ao, c[1] * ao, c[2] * ao)
            else:
                up = clamp(vny * 0.55 + 0.45, 0.0, 1.0)
                c_shd = hex_lin("#194b34")
                c_mid = hex_lin("#388844")
                c_sun = hex_lin("#8ad054")
                c = mix_rgb(c_shd, c_mid, clamp(up * 1.4, 0.0, 1.0))
                c = mix_rgb(c, c_sun, sstep(0.55, 0.96, up))
                return c

        paint_bmesh_vcol(bm, cliff_vcol)
        finalize_mesh_obj(obj_name, bm, [mat_sandstone, mat_timber, mat_foliage], smooth=True)

    build_cliff_bank(-1.0, "CliffBank_Left", seed=1.7)
    build_cliff_bank(1.0, "CliffBank_Right", seed=4.3)

    # ------------------------------------------------------------------
    # 2. `AqueductBridge_High` (26m-wide overhanging stone Pelagian aqueduct arch,
    #    bottom of crown at y = 9.2m >= 8.0m!)
    # ------------------------------------------------------------------
    bm_aq = bmesh.new()
    # Twin battered stone abutment piers seated deep in the canyon banks (|x| = 12.6m)
    for sx in (-1.0, 1.0):
        add_bevel_box(bm_aq, (sx * 12.6, 5.2, 0.0), (3.2, 12.8, 3.8), bevel=0.14, mat_idx=0)
        add_bevel_box(bm_aq, (sx * 12.1, 1.2, 0.0), (4.0, 3.6, 4.4), bevel=0.16, mat_idx=0)
        # Bronze pilaster ring bands on piers
        for by in (3.6, 7.6, 11.2):
            add_bevel_box(bm_aq, (sx * 12.6, by, 0.0), (3.42, 0.28, 4.02), bevel=0.05, mat_idx=2)

    # Sweeping semicircular voussoir arch spanning x = -11.2..+11.2, springing y=5.4 -> crown y=9.8
    span_x = 11.2
    spring_y = 5.4
    rise_y = 4.6
    n_voussoirs = 15
    for i in range(n_voussoirs):
        t = (i + 0.5) / n_voussoirs
        ang = math.pi * (1.0 - t)  # pi -> 0
        ax = math.cos(ang) * span_x
        ay = spring_y + math.sin(ang) * rise_y
        # Tangent slope
        dx = math.sin(ang) * span_x
        dy = -math.cos(ang) * rise_y
        slope = math.atan2(dy, dx)
        is_key = (i == n_voussoirs // 2)
        bw = 2.55 if is_key else 2.38
        bh = 1.65 if is_key else 1.32
        bd = 3.20 if is_key else 2.90
        add_bevel_box(bm_aq, (ax, ay, 0.0), (bw, bh, bd), bevel=0.08, rot_t3=(0.0, 0.0, slope), mat_idx=1 if is_key else 0)
        # Spandrel masonry piers rising from arch extrados to aqueduct deck (y = 11.4m)
        if i % 2 == 1:
            top_deck = 11.4
            col_h = max(0.6, top_deck - (ay + 0.35))
            add_bevel_box(bm_aq, (ax, ay + 0.30 + col_h * 0.5, 0.0), (1.05, col_h, 2.58), bevel=0.06, mat_idx=0)

    # Upper aqueduct channel deck & twin sculpted parapet walls (y = 11.2..12.6m)
    add_bevel_box(bm_aq, (0.0, 11.45, 0.0), (27.6, 0.72, 3.45), bevel=0.08, mat_idx=1)
    for sz in (-1.38, 1.38):
        add_bevel_box(bm_aq, (0.0, 12.18, sz), (27.8, 0.85, 0.48), bevel=0.06, mat_idx=0)
        # Decorative bronze cornice molding along aqueduct parapet
        add_bevel_box(bm_aq, (0.0, 11.72, sz * 1.18), (27.2, 0.18, 0.16), bevel=0.03, mat_idx=2)

    # Decorative bronze arch-rib band & central Pelagian solar medallion on both faces
    for sz in (-1.42, 1.42):
        arc_pts = [
            (math.cos(math.pi * (1.0 - k / 14.0)) * (span_x - 0.55),
             spring_y + math.sin(math.pi * (1.0 - k / 14.0)) * (rise_y - 0.45),
             sz)
            for k in range(15)
        ]
        add_loft_tube(bm_aq, arc_pts, 0.14, rad_segs=6, cap_start=True, cap_end=True, mat_idx=2)
        add_beveled_torus_t3(bm_aq, (0.0, spring_y + rise_y + 0.1, sz * 1.12), 0.72, 0.12, maj_segs=18, min_segs=6, axis="Z", mat_idx=2)
        add_organic_blob(bm_aq, (0.0, spring_y + rise_y + 0.1, sz * 1.12), (0.42, 0.42, 0.18), subdivs=1, noise_amp=0.0, mat_idx=3)

    apply_box_uvs(bm_aq, scale=0.22)
    paint_bmesh_vcol(
        bm_aq,
        lambda tx, ty, tz, vnx, vny, vnz, fny, mi: (
            (1.0, 1.0, 1.0)
            if mi == 3
            else tuple(c * (0.78 + 0.22 * clamp(vny * 0.5 + 0.5, 0.0, 1.0)) for c in hex_lin("#f5e6d2" if mi != 2 else "#ffe2b4"))
        ),
    )
    finalize_mesh_obj("AqueductBridge_High", bm_aq, [mat_sandstone, mat_travertine, mat_bronze, mat_glow_aqua], smooth=False)

    # ------------------------------------------------------------------
    # 3. `TimberPier` (Weathered redwood riverbank pier + glowing aqua lantern)
    # ------------------------------------------------------------------
    bm_pr = bmesh.new()
    # 6 stout chamfered pilings
    for px in (-1.45, 0.0, 1.45):
        for pz in (-0.95, 0.95):
            is_front = (px > 1.0)
            ph = 3.6 if (is_front and pz > 0) else (2.45 if is_front else 2.25)
            add_cylinder_t3(bm_pr, (px, ph * 0.5 - 0.8, pz), 0.17, 0.15, ph, segs=8, mat_idx=0)
            # Bronze iron-collar cap on piling
            add_cylinder_t3(bm_pr, (px, ph - 0.82, pz), 0.185, 0.185, 0.14, segs=8, mat_idx=1)

    # Cross beams & planked timber walkway (y = 0.88m)
    for pz in (-0.95, 0.95):
        add_bevel_box(bm_pr, (0.0, 0.72, pz), (3.85, 0.18, 0.18), bevel=0.02, mat_idx=0)
    for k in range(9):
        px = -1.72 + k * 0.43
        add_bevel_box(bm_pr, (px, 0.90, 0.0), (0.37, 0.10, 2.38), bevel=0.015, mat_idx=0)
    # Diagonal structural cross braces
    add_bevel_box(bm_pr, (-0.72, 0.28, 0.92), (1.55, 0.11, 0.11), bevel=0.015, rot_t3=(0.0, 0.0, 0.48), mat_idx=0)
    add_bevel_box(bm_pr, (0.72, 0.28, 0.92), (1.55, 0.11, 0.11), bevel=0.015, rot_t3=(0.0, 0.0, -0.48), mat_idx=0)
    # Bronze harbor lantern arm & glowing aqua crystal lantern on front piling!
    add_bevel_box(bm_pr, (1.82, 2.66, 0.95), (0.78, 0.10, 0.10), bevel=0.02, mat_idx=1)
    add_cylinder_t3(bm_pr, (2.10, 2.30, 0.95), 0.18, 0.11, 0.16, segs=6, mat_idx=1)
    add_cylinder_t3(bm_pr, (2.10, 1.92, 0.95), 0.16, 0.18, 0.12, segs=6, mat_idx=1)
    add_cylinder_t3(bm_pr, (2.10, 2.11, 0.95), 0.13, 0.14, 0.30, segs=6, mat_idx=2)

    apply_box_uvs(bm_pr, scale=0.45)
    paint_bmesh_vcol(
        bm_pr,
        lambda tx, ty, tz, vnx, vny, vnz, fny, mi: (
            (1.0, 1.0, 1.0)
            if mi == 2
            else tuple(c * (0.68 + 0.32 * sstep(-0.3, 1.8, ty)) for c in hex_lin("#f2dfd0" if mi == 0 else "#ffe0ad"))
        ),
    )
    finalize_mesh_obj("TimberPier", bm_pr, [mat_timber, mat_bronze, mat_glow_aqua], smooth=False)

    # ------------------------------------------------------------------
    # 4. `RiverBoulder_A` & `RiverBoulder_B` (Sculpted mossy river boulders)
    # ------------------------------------------------------------------
    def build_river_boulder(name, lobes, moss_caps, seed):
        bm = bmesh.new()
        for idx, (cx, cy, cz, rx, ry, rz) in enumerate(lobes):
            add_organic_blob(
                bm,
                (cx, cy, cz),
                (rx, ry, rz),
                subdivs=2,
                noise_amp=0.17,
                noise_freq=1.6,
                seed=seed + idx * 4.7,
                flatten_bottom=-0.35,
                strata_amp=0.07,
                strata_freq=5.2,
                mat_idx=0,
            )
        for idx, (mx, my, mz, rx, ry, rz) in enumerate(moss_caps):
            add_organic_blob(
                bm,
                (mx, my, mz),
                (rx, ry, rz),
                subdivs=2,
                noise_amp=0.12,
                noise_freq=2.0,
                seed=seed + 30.0 + idx * 3.9,
                flatten_bottom=-ry * 0.25,
                mat_idx=1,
            )
        apply_box_uvs(bm, scale=0.42)
        def boulder_col(tx, ty, tz, vnx, vny, vnz, fny, mi):
            if mi == 0:
                wet = sstep(-0.1, 0.65, ty)
                c = mix_rgb(hex_lin("#6c5347"), hex_lin("#ecd6c0"), wet)
                ao = 0.78 + 0.22 * clamp(vny * 0.5 + 0.5, 0.0, 1.0)
                return (c[0] * ao, c[1] * ao, c[2] * ao)
            else:
                up = clamp(vny * 0.55 + 0.45, 0.0, 1.0)
                return mix_rgb(hex_lin("#235c3e"), hex_lin("#80c454"), up)
        paint_bmesh_vcol(bm, boulder_col)
        finalize_mesh_obj(name, bm, [mat_sandstone, mat_foliage], smooth=True)

    build_river_boulder(
        "RiverBoulder_A",
        lobes=[(0.0, 0.34, 0.0, 0.92, 0.64, 0.86), (0.48, 0.24, -0.32, 0.58, 0.44, 0.56)],
        moss_caps=[(-0.08, 0.78, 0.05, 0.56, 0.18, 0.50)],
        seed=11.3,
    )
    build_river_boulder(
        "RiverBoulder_B",
        lobes=[(0.0, 0.44, 0.0, 1.08, 0.78, 0.96), (-0.56, 0.26, 0.36, 0.64, 0.46, 0.58)],
        moss_caps=[(0.05, 0.98, -0.05, 0.64, 0.20, 0.54), (-0.54, 0.56, 0.34, 0.38, 0.14, 0.34)],
        seed=23.7,
    )

    # ------------------------------------------------------------------
    # 5. `SlalomGate_Arch` (Carved 3D antique-bronze & sandstone river boost gate
    #    with twin hanging glowing aqua lanterns!)
    # ------------------------------------------------------------------
    bm_gt = bmesh.new()
    for sx in (-1.0, 1.0):
        px = sx * 1.82
        # Stepped carved sandstone pylon base + shaft + travertine capital
        add_bevel_box(bm_gt, (px, 0.22, 0.0), (0.86, 0.82, 0.86), bevel=0.06, mat_idx=0)
        add_cylinder_t3(bm_gt, (px, 1.82, 0.0), 0.34, 0.29, 2.55, segs=10, mat_idx=0, flutes=8, flute_depth=0.05)
        add_bevel_box(bm_gt, (px, 3.22, 0.0), (0.76, 0.34, 0.76), bevel=0.05, mat_idx=1)
        # Bronze collar bands + finial orb
        add_beveled_torus_t3(bm_gt, (px, 0.74, 0.0), 0.36, 0.065, maj_segs=14, min_segs=6, axis="Y", mat_idx=2)
        add_beveled_torus_t3(bm_gt, (px, 2.98, 0.0), 0.33, 0.065, maj_segs=14, min_segs=6, axis="Y", mat_idx=2)
        # Inward bronze bracket arm + sculpted hanging aqua lantern!
        lx = px - sx * 0.46
        add_bevel_box(bm_gt, (px - sx * 0.28, 2.86, 0.0), (0.56, 0.09, 0.11), bevel=0.02, mat_idx=2)
        add_cylinder_t3(bm_gt, (lx, 2.60, 0.0), 0.16, 0.08, 0.14, segs=6, mat_idx=2)
        add_cylinder_t3(bm_gt, (lx, 2.18, 0.0), 0.12, 0.16, 0.11, segs=6, mat_idx=2)
        add_cylinder_t3(bm_gt, (lx, 2.39, 0.0), 0.125, 0.135, 0.31, segs=6, mat_idx=3)

    # Graceful double-ribbed antique-bronze overhead arch spanning x = -1.82..+1.82
    arch_pts = [
        (math.cos(math.pi * (1.0 - k / 12.0)) * 1.82, 3.26 + math.sin(math.pi * (1.0 - k / 12.0)) * 1.18, 0.0)
        for k in range(13)
    ]
    add_loft_tube(bm_gt, arch_pts, 0.14, rad_segs=8, cap_start=True, cap_end=True, mat_idx=2)
    upper_pts = [
        (math.cos(math.pi * (1.0 - k / 12.0)) * 1.72, 3.55 + math.sin(math.pi * (1.0 - k / 12.0)) * 1.28, 0.0)
        for k in range(13)
    ]
    add_loft_tube(bm_gt, upper_pts, 0.075, rad_segs=6, cap_start=True, cap_end=True, mat_idx=2)
    # Central glowing aqua Pelagian crest medallion at arch apex
    add_beveled_torus_t3(bm_gt, (0.0, 4.62, 0.0), 0.34, 0.07, maj_segs=16, min_segs=6, axis="Z", mat_idx=2)
    add_organic_blob(bm_gt, (0.0, 4.62, 0.0), (0.22, 0.28, 0.12), subdivs=1, noise_amp=0.0, mat_idx=3)

    apply_box_uvs(bm_gt, scale=0.38)
    paint_bmesh_vcol(
        bm_gt,
        lambda tx, ty, tz, vnx, vny, vnz, fny, mi: (
            (1.0, 1.0, 1.0) if mi == 3 else tuple(c * (0.76 + 0.24 * clamp(vny * 0.5 + 0.5, 0.0, 1.0)) for c in hex_lin("#f7e7d4"))
        ),
    )
    finalize_mesh_obj("SlalomGate_Arch", bm_gt, [mat_sandstone, mat_travertine, mat_bronze, mat_glow_aqua], smooth=True)

    # ------------------------------------------------------------------
    # 6. `SlalomRing_Bronze` (Chunky 3D sculpted antique-bronze & aqua crystal ring)
    # ------------------------------------------------------------------
    bm_sr = bmesh.new()
    add_beveled_torus_t3(bm_sr, (0.0, 0.0, 0.0), 0.78, 0.095, maj_segs=24, min_segs=8, axis="Z", mat_idx=0)
    add_beveled_torus_t3(bm_sr, (0.0, 0.0, 0.0), 0.67, 0.048, maj_segs=24, min_segs=6, axis="Z", mat_idx=1)
    for k in range(4):
        ang = k * math.pi * 0.5
        cx, cy = math.cos(ang) * 0.78, math.sin(ang) * 0.78
        add_bevel_box(bm_sr, (cx, cy, 0.0), (0.22, 0.24, 0.24), bevel=0.03, rot_t3=(0.0, 0.0, ang), mat_idx=0)
        add_organic_blob(bm_sr, (math.cos(ang) * 0.96, math.sin(ang) * 0.96, 0.0), (0.09, 0.09, 0.07), subdivs=1, noise_amp=0.0, mat_idx=1)
    apply_box_uvs(bm_sr, scale=0.8)
    paint_bmesh_vcol(bm_sr, lambda tx, ty, tz, vnx, vny, vnz, fny, mi: (1.0, 1.0, 1.0))
    finalize_mesh_obj("SlalomRing_Bronze", bm_sr, [mat_bronze, mat_glow_aqua], smooth=True)

    # ------------------------------------------------------------------
    # 7. `HydroBoard_Hero` (Sleek carved bronze-and-timber Hydro-Board for Gateway 2.0!)
    #    Oriented nose toward -Z (downriver), tail toward +Z, deck at y ~ +0.06m!
    # ------------------------------------------------------------------
    bm_hb = bmesh.new()
    # Lofted sculpted surfboard/skimboard hull along Z (-1.12 nose -> +0.98 swallowtail)
    stations = [
        # (z, half_w, thickness, rocker_y)
        (-1.12, 0.03, 0.030, 0.16),
        (-0.96, 0.19, 0.050, 0.09),
        (-0.68, 0.34, 0.072, 0.03),
        (-0.30, 0.40, 0.082, 0.00),
        ( 0.15, 0.39, 0.080, 0.00),
        ( 0.56, 0.34, 0.068, 0.01),
        ( 0.86, 0.25, 0.050, 0.03),
        ( 1.00, 0.14, 0.028, 0.05),
    ]
    cross_n = 12
    hull_rings = []
    for z, hw, th, ry in stations:
        ring = []
        for j in range(cross_n):
            a = (j / cross_n) * TAU
            ca, sa = math.cos(a), math.sin(a)
            px = ca * hw
            # Flatter ergonomic deck top, slightly keeled V-hull bottom
            py = ry + (sa * th * 0.52 if sa >= 0 else sa * th * 0.72)
            ring.append(bm_hb.verts.new(v3(px, py, z)))
        hull_rings.append(ring)

    for i in range(len(hull_rings) - 1):
        r0, r1 = hull_rings[i], hull_rings[i + 1]
        for j in range(cross_n):
            jn = (j + 1) % cross_n
            f = bm_hb.faces.new((r0[j], r1[j], r1[jn], r0[jn]))
            f.material_index = 0
    # Cap nose & tail
    c_nose = bm_hb.verts.new(v3(0.0, 0.18, -1.16))
    c_tail = bm_hb.verts.new(v3(0.0, 0.05, 0.92))  # recessed swallowtail notch!
    for j in range(cross_n):
        jn = (j + 1) % cross_n
        f0 = bm_hb.faces.new((c_nose, hull_rings[0][jn], hull_rings[0][j]))
        f0.material_index = 1
        f1 = bm_hb.faces.new((c_tail, hull_rings[-1][j], hull_rings[-1][jn]))
        f1.material_index = 1

    # Carved antique-bronze outer bumper rails + prow beak + twin underside hydro-fins!
    for sx in (-1.0, 1.0):
        rail_pts = [(sx * (hw + 0.012), ry + 0.005, z) for z, hw, th, ry in stations]
        add_loft_tube(bm_hb, rail_pts, [0.024, 0.032, 0.038, 0.040, 0.038, 0.036, 0.032, 0.026], rad_segs=6, cap_start=True, cap_end=True, mat_idx=1)
        # Swept underside hydro-fin
        add_bevel_box(bm_hb, (sx * 0.21, -0.09, 0.66), (0.03, 0.20, 0.34), bevel=0.008, rot_t3=(0.32, 0.0, sx * 0.14), mat_idx=1)

    # Ornate bronze prow crest + glowing aqua Pelagian wave crystal recessed on foredeck
    add_bevel_box(bm_hb, (0.0, 0.11, -0.86), (0.18, 0.05, 0.42), bevel=0.015, rot_t3=(0.24, 0.0, 0.0), mat_idx=1)
    add_beveled_torus_t3(bm_hb, (0.0, 0.068, -0.44), 0.14, 0.026, maj_segs=14, min_segs=6, axis="Y", mat_idx=1)
    add_organic_blob(bm_hb, (0.0, 0.072, -0.44), (0.09, 0.028, 0.11), subdivs=1, noise_amp=0.0, mat_idx=2)
    # Recessed luminous hydro-strip along deck spine
    add_bevel_box(bm_hb, (0.0, 0.044, 0.18), (0.045, 0.016, 0.96), bevel=0.005, mat_idx=2)

    apply_box_uvs(bm_hb, scale=0.62)
    paint_bmesh_vcol(bm_hb, lambda tx, ty, tz, vnx, vny, vnz, fny, mi: (1.0, 1.0, 1.0))
    finalize_mesh_obj("HydroBoard_Hero", bm_hb, [mat_skimmer, mat_bronze, mat_glow_aqua], smooth=True)

    # ------------------------------------------------------------------
    # 8. `SupplyBuoy_Pelagian` (Chunky smashable bronze & glowing crystal supply buoy)
    # ------------------------------------------------------------------
    bm_sb = bmesh.new()
    add_beveled_torus_t3(bm_sb, (0.0, 0.08, 0.0), 0.56, 0.12, maj_segs=14, min_segs=6, axis="Y", mat_idx=0)
    add_cylinder_t3(bm_sb, (0.0, -0.05, 0.0), 0.44, 0.52, 0.30, segs=8, mat_idx=0)
    add_cylinder_t3(bm_sb, (0.0, 0.72, 0.0), 0.46, 0.28, 0.20, segs=8, mat_idx=0)
    for k in range(4):
        a = k * math.pi * 0.5 + math.pi * 0.25
        add_cylinder_t3(bm_sb, (math.cos(a) * 0.42, 0.38, math.sin(a) * 0.42), 0.05, 0.05, 0.64, segs=6, mat_idx=0)
    add_organic_blob(bm_sb, (0.0, 0.38, 0.0), (0.34, 0.34, 0.34), subdivs=1, noise_amp=0.0, mat_idx=1)
    add_organic_blob(bm_sb, (0.0, 0.92, 0.0), (0.14, 0.14, 0.14), subdivs=1, noise_amp=0.0, mat_idx=1)
    apply_box_uvs(bm_sb, scale=0.8)
    paint_bmesh_vcol(bm_sb, lambda tx, ty, tz, vnx, vny, vnz, fny, mi: (1.0, 1.0, 1.0))
    finalize_mesh_obj("SupplyBuoy_Pelagian", bm_sb, [mat_bronze, mat_glow_aqua], smooth=True)

    return export_glb_and_inspect(os.path.join(OUT_MODELS_DIR, "env_rapids_gorge.glb"))


# ==============================================================================
# KIT 2: `assets/models/env_reef_grotto.glb` (REEF SWIM)
# ==============================================================================

def build_env_reef_grotto():
    reset_scene()

    mat_limestone = make_pbr_tex_mat(
        "Mat_Reef_Limestone",
        "arch_bayou_limestone_albedo.webp",
        "arch_bayou_limestone_normal.webp",
        "arch_bayou_limestone_orm.webp",
        tint_hex="#c8ece4",
        normal_strength=1.0,
        use_vcol=True,
    )
    mat_travertine = make_pbr_tex_mat(
        "Mat_Reef_Travertine",
        "arch_coral_travertine_albedo.webp",
        "arch_coral_travertine_normal.webp",
        "arch_coral_travertine_orm.webp",
        tint_hex="#e6ece2",
        normal_strength=0.95,
        use_vcol=True,
    )
    mat_bronze = make_pbr_tex_mat(
        "Mat_Reef_Bronze",
        "arch_antique_bronze_albedo.webp",
        "arch_antique_bronze_normal.webp",
        "arch_antique_bronze_orm.webp",
        tint_hex="#f8d49c",
        normal_strength=0.90,
        use_vcol=True,
    )
    mat_seabed = make_pbr_tex_mat(
        "Mat_Reef_Seabed",
        "mg_pbr_reef_seabed_albedo.webp",
        "mg_pbr_reef_seabed_normal.webp",
        None,
        tint_hex="#e4f2ea",
        roughness=0.86,
        metallic=0.0,
        normal_strength=0.95,
        use_vcol=True,
    )
    mat_coral = make_vcol_stylized_mat(
        "Mat_Reef_Coral",
        roughness=0.50,
        metallic=0.02,
        normal_file="biome_rock_limestone_normal.webp",
        normal_strength=0.35,
        emissive_vcol_strength=0.14,
    )
    mat_kelp = make_vcol_stylized_mat(
        "Mat_Reef_Kelp",
        roughness=0.44,
        metallic=0.0,
        emissive_vcol_strength=0.12,
        double_sided=True,
    )
    mat_glow_aqua = make_emissive_crystal_mat(
        "Mat_Reef_AquaCrystal",
        "#a5f8ff",
        "#2cf0e8",
        strength=2.4,
        roughness=0.12,
        metallic=0.14,
    )

    # ------------------------------------------------------------------
    # 1. `GrottoArch_Vault` (Curved vaulted underwater Pelagian limestone ruin arch!)
    # ------------------------------------------------------------------
    bm_ga = bmesh.new()
    span_x = 6.8
    spring_y = 4.6
    rise_y = 4.2
    for sx in (-1.0, 1.0):
        # Stepped plinth & massive carved limestone pier
        add_bevel_box(bm_ga, (sx * span_x, 0.55, 0.0), (2.75, 1.4, 3.15), bevel=0.12, mat_idx=0)
        add_bevel_box(bm_ga, (sx * span_x, 2.75, 0.0), (2.15, 3.4, 2.65), bevel=0.10, mat_idx=0)
        # Fluted travertine engaged half-column on inner face
        add_cylinder_t3(bm_ga, (sx * (span_x - 1.05), 2.75, 0.0), 0.54, 0.48, 3.6, segs=12, mat_idx=1, flutes=10, flute_depth=0.05)
        # Carved capital + bronze relief collar
        add_bevel_box(bm_ga, (sx * span_x, 4.62, 0.0), (2.48, 0.56, 2.92), bevel=0.08, mat_idx=1)
        add_bevel_box(bm_ga, (sx * span_x, 4.24, 0.0), (2.32, 0.22, 2.78), bevel=0.04, mat_idx=2)

    # Vaulted limestone arch voussoirs (15 tight overlapping sculpted chamfered stones)
    n_v = 15
    for i in range(n_v):
        t = (i + 0.5) / n_v
        ang = math.pi * (1.0 - t)
        ax = math.cos(ang) * span_x
        ay = spring_y + math.sin(ang) * rise_y
        slope = math.atan2(-math.cos(ang) * rise_y, math.sin(ang) * span_x)
        is_key = (i == n_v // 2)
        add_bevel_box(
            bm_ga,
            (ax, ay, 0.0),
            (1.92 if is_key else 1.72, 1.48 if is_key else 1.18, 2.90 if is_key else 2.60),
            bevel=0.08,
            rot_t3=(0.0, 0.0, slope),
            mat_idx=1 if is_key else 0,
        )

    # Sunken antique-bronze arch-rib ring & keystone Pelagian sun-crest
    for sz in (-1.30, 1.30):
        rib_pts = [
            (math.cos(math.pi * (1.0 - k / 14.0)) * (span_x - 0.52),
             spring_y + math.sin(math.pi * (1.0 - k / 14.0)) * (rise_y - 0.44),
             sz)
            for k in range(15)
        ]
        add_loft_tube(bm_ga, rib_pts, 0.13, rad_segs=6, cap_start=True, cap_end=True, mat_idx=2)
    add_beveled_torus_t3(bm_ga, (0.0, spring_y + rise_y + 0.05, 1.46), 0.62, 0.10, maj_segs=16, min_segs=6, axis="Z", mat_idx=2)
    add_organic_blob(bm_ga, (0.0, spring_y + rise_y + 0.05, 1.46), (0.36, 0.36, 0.16), subdivs=1, noise_amp=0.0, mat_idx=4)

    # Lush sculpted encrusting 3D coral domes nestled snugly on top of the sunken arch shoulders!
    for cx, cy, cz, rx, ry, rz in [
        (-6.2, 5.15, 0.35, 0.68, 0.42, 0.65),
        ( 6.2, 5.15, 0.35, 0.72, 0.44, 0.68),
        (-3.6, 8.65, 0.25, 0.62, 0.36, 0.58),
        ( 3.6, 8.65, 0.25, 0.66, 0.38, 0.62),
    ]:
        add_organic_blob(bm_ga, (cx, cy, cz), (rx, ry, rz), subdivs=2, noise_amp=0.14, noise_freq=2.2, seed=cx * 3.1, mat_idx=3)

    apply_box_uvs(bm_ga, scale=0.26)
    def grotto_col(tx, ty, tz, vnx, vny, vnz, fny, mi):
        if mi == 4:
            return (1.0, 1.0, 1.0)
        if mi == 3:
            up = clamp(vny * 0.5 + 0.5, 0.0, 1.0)
            return mix_rgb(hex_lin("#d46072"), hex_lin("#ffc499"), up)
        depth_t = sstep(0.0, 9.0, ty)
        c = mix_rgb(hex_lin("#7daea8"), hex_lin("#e8f4ee"), depth_t)
        ao = 0.76 + 0.24 * clamp(vny * 0.5 + 0.5, 0.0, 1.0)
        return (c[0] * ao, c[1] * ao, c[2] * ao)
    paint_bmesh_vcol(bm_ga, grotto_col)
    finalize_mesh_obj("GrottoArch_Vault", bm_ga, [mat_limestone, mat_travertine, mat_bronze, mat_coral, mat_glow_aqua], smooth=True)

    # ------------------------------------------------------------------
    # 2. `SunkenColumn_A` (Tall fluted column) & `SunkenColumn_B` (Broken column + fallen drum)
    # ------------------------------------------------------------------
    bm_ca = bmesh.new()
    add_bevel_box(bm_ca, (0.0, 0.30, 0.0), (1.75, 0.64, 1.75), bevel=0.07, mat_idx=0)
    add_beveled_torus_t3(bm_ca, (0.0, 0.72, 0.0), 0.62, 0.13, maj_segs=16, min_segs=6, axis="Y", mat_idx=1)
    add_cylinder_t3(bm_ca, (0.0, 3.25, 0.0), 0.54, 0.45, 4.85, segs=16, mat_idx=1, flutes=12, flute_depth=0.055)
    add_beveled_torus_t3(bm_ca, (0.0, 5.56, 0.0), 0.50, 0.09, maj_segs=16, min_segs=6, axis="Y", mat_idx=2)
    add_bevel_box(bm_ca, (0.0, 5.92, 0.0), (1.48, 0.44, 1.48), bevel=0.07, mat_idx=1)
    apply_box_uvs(bm_ca, scale=0.36)
    paint_bmesh_vcol(bm_ca, lambda tx, ty, tz, vnx, vny, vnz, fny, mi: tuple(c * (0.76 + 0.24 * sstep(0.0, 6.0, ty)) for c in hex_lin("#dceee8")))
    finalize_mesh_obj("SunkenColumn_A", bm_ca, [mat_limestone, mat_travertine, mat_bronze], smooth=True)

    bm_cb = bmesh.new()
    add_bevel_box(bm_cb, (0.0, 0.28, 0.0), (1.72, 0.60, 1.72), bevel=0.07, mat_idx=0)
    add_cylinder_t3(bm_cb, (0.0, 1.85, 0.0), 0.54, 0.49, 2.70, segs=16, mat_idx=1, flutes=12, flute_depth=0.055)
    # Sheared angled fracture cap on top of broken shaft
    for v in bm_cb.verts:
        tx, ty, tz = b_to_t3(v.co)
        if ty > 2.85:
            v.co = v3(tx, ty + tx * 0.42 + math.sin(tz * 4.0) * 0.09, tz)
    # Fallen fluted column drum resting beside plinth
    add_cylinder_t3(bm_cb, (1.42, 0.44, 0.35), 0.48, 0.46, 1.65, segs=14, rot_t3=(0.12, 0.55, 1.48), mat_idx=1, flutes=10, flute_depth=0.05)
    add_beveled_torus_t3(bm_cb, (0.0, 0.66, 0.0), 0.60, 0.11, maj_segs=14, min_segs=6, axis="Y", mat_idx=2)
    apply_box_uvs(bm_cb, scale=0.36)
    paint_bmesh_vcol(bm_cb, lambda tx, ty, tz, vnx, vny, vnz, fny, mi: tuple(c * (0.76 + 0.24 * sstep(0.0, 3.5, ty)) for c in hex_lin("#dceee8")))
    finalize_mesh_obj("SunkenColumn_B", bm_cb, [mat_limestone, mat_travertine, mat_bronze], smooth=True)

    # ------------------------------------------------------------------
    # 3. `SeabedDune_Tile` (Undulating 3D sandy seabed dune section, periodic in X!)
    # ------------------------------------------------------------------
    bm_sd = bmesh.new()
    nx, nz = 28, 18
    w_x, d_z = 24.0, 22.0
    uv_layer = bm_sd.loops.layers.uv.verify()
    sgrid = []
    for iz in range(nz + 1):
        vz = iz / float(nz)
        tz = -d_z * 0.5 + vz * d_z
        row = []
        for ix in range(nx + 1):
            ux = ix / float(nx)
            tx = -w_x * 0.5 + ux * w_x
            ang_x = ux * TAU
            dune = (
                math.sin(ang_x * 1.0 + tz * 0.22) * 0.42
                + math.cos(ang_x * 2.0 - tz * 0.35) * 0.24
                + math.sin(ang_x * 4.0 + tz * 0.72) * 0.08
                + max(0.0, (-tz - 2.0) * 0.12)
            )
            row.append(bm_sd.verts.new(v3(tx, dune, tz)))
        sgrid.append(row)
    for iz in range(nz):
        for ix in range(nx):
            # Counter-clockwise viewed from +Y (Blender +Z) so normals strictly point UPWARD!
            f = bm_sd.faces.new((sgrid[iz][ix], sgrid[iz + 1][ix], sgrid[iz + 1][ix + 1], sgrid[iz][ix + 1]))
            f.material_index = 0
            for lp in f.loops:
                tx, ty, tz = b_to_t3(lp.vert.co)
                lp[uv_layer].uv = (tx * 0.16, tz * 0.16)
    bm_sd.normal_update()
    for f in bm_sd.faces:
        if f.normal.z < 0.0:
            f.normal_flip()
    paint_bmesh_vcol(
        bm_sd,
        lambda tx, ty, tz, vnx, vny, vnz, fny, mi: mix_rgb(hex_lin("#8cbcc0"), hex_lin("#fff4d8"), sstep(-0.6, 0.9, ty)),
    )
    finalize_mesh_obj("SeabedDune_Tile", bm_sd, mat_seabed, smooth=True, recalc_normals=False)

    # ------------------------------------------------------------------
    # 4. `ReefOutcrop_Rock` (Rounded sculpted limestone reef shelf mound)
    # ------------------------------------------------------------------
    bm_ro = bmesh.new()
    for idx, (cx, cy, cz, rx, ry, rz) in enumerate([
        ( 0.0, 0.52,  0.0, 1.85, 0.78, 1.42),
        (-1.15, 0.36, 0.28, 1.05, 0.54, 0.92),
        ( 1.22, 0.42,-0.22, 1.15, 0.62, 0.98),
    ]):
        add_organic_blob(bm_ro, (cx, cy, cz), (rx, ry, rz), subdivs=2, noise_amp=0.14, noise_freq=1.3, seed=7.0 + idx * 4.3, flatten_bottom=-0.22, strata_amp=0.06, strata_freq=4.2, mat_idx=0)
    for v in bm_ro.verts:
        v.co.z -= 0.14
    apply_box_uvs(bm_ro, scale=0.35)
    paint_bmesh_vcol(bm_ro, lambda tx, ty, tz, vnx, vny, vnz, fny, mi: mix_rgb(hex_lin("#588c90"), hex_lin("#e0ece2"), clamp(vny * 0.55 + 0.45, 0.0, 1.0)))
    finalize_mesh_obj("ReefOutcrop_Rock", bm_ro, mat_limestone, smooth=True)

    # ------------------------------------------------------------------
    # 5. CHUNKY SMOOTH 3D SCULPTED CORAL CLUSTERS & RIBBON KELP (ZERO CARDBOARD!)
    # ------------------------------------------------------------------

    # 5a. `Coral_Staghorn` (Plump organic branching staghorn bush, vibrant coral-rose -> sunlit peach tips!)
    bm_cs = bmesh.new()
    add_organic_blob(bm_cs, (0.0, 0.14, 0.0), (0.62, 0.30, 0.58), subdivs=2, noise_amp=0.12, noise_freq=2.0, seed=3.1, flatten_bottom=-0.08, mat_idx=0)
    n_main = 8
    for i in range(n_main):
        az = (i / float(n_main)) * TAU + (i % 2) * 0.20
        ca, sa = math.cos(az), math.sin(az)
        px, pz = -sa, ca
        sp = 0.44 + (i % 3) * 0.14
        hh = 0.88 + (i % 3) * 0.26
        sw = 0.16 if i % 2 == 0 else -0.16
        p0 = (ca * 0.16, 0.06, sa * 0.16)
        p1 = (ca * sp * 0.52 + px * sw * 0.5, hh * 0.38, sa * sp * 0.52 + pz * sw * 0.5)
        p2 = (ca * sp * 0.96 + px * sw, hh * 0.76, sa * sp * 0.96 + pz * sw)
        p3 = (ca * sp * 0.86 + px * sw * 0.6, hh, sa * sp * 0.86 + pz * sw * 0.6)
        add_loft_tube(bm_cs, [p0, p1, p2, p3], [0.125, 0.102, 0.078, 0.062], rad_segs=8, mat_idx=0)
        add_organic_blob(bm_cs, p3, (0.074, 0.078, 0.074), subdivs=1, noise_amp=0.05, mat_idx=0)
        side = 1.0 if i % 2 == 0 else -1.0
        f0 = p1
        f1 = (p1[0] + ca * 0.24 + px * side * 0.25, p1[1] + hh * 0.26, p1[2] + sa * 0.24 + pz * side * 0.25)
        f2 = (f1[0] + ca * 0.11 + px * side * 0.11, f1[1] + hh * 0.25, f1[2] + sa * 0.11 + pz * side * 0.11)
        add_loft_tube(bm_cs, [f0, f1, f2], [0.086, 0.068, 0.054], rad_segs=7, mat_idx=0)
        add_organic_blob(bm_cs, f2, (0.064, 0.068, 0.064), subdivs=1, noise_amp=0.05, mat_idx=0)

    apply_box_uvs(bm_cs, scale=0.8)
    paint_faces_gradient(bm_cs, bm_cs.faces, "#8a1838", "#ee4866", "#ffb899", 0.0, 1.38, ao_strength=0.22)
    finalize_mesh_obj("Coral_Staghorn", bm_cs, mat_coral, smooth=True)

    # 5b. `Coral_Table` (Multi-tiered chunky scalloped 3D table-coral rosette, rich apricot/terracotta!)
    bm_ct = bmesh.new()
    add_cylinder_t3(bm_ct, (0.0, 0.24, 0.0), 0.38, 0.24, 0.56, segs=12, mat_idx=0)
    tiers = [
        (-0.18, 0.42,  0.14, 0.92, 0.19, 0.5),
        ( 0.24, 0.68, -0.12, 0.76, 0.17, 2.2),
        (-0.04, 0.94, -0.02, 0.52, 0.15, 4.1),
    ]
    for ox, oy, oz, rad, th, ph in tiers:
        fs = add_organic_blob(
            bm_ct,
            (ox, oy, oz),
            (rad, th, rad * 0.92),
            subdivs=3,
            noise_amp=0.07,
            noise_freq=2.4,
            seed=ph,
            mat_idx=0,
        )
        seen = set()
        for f in fs:
            for v in f.verts:
                if v in seen:
                    continue
                seen.add(v)
                tx, ty, tz = b_to_t3(v.co)
                lx, lz = tx - ox, tz - oz
                r = math.hypot(lx, lz)
                ang = math.atan2(lz, lx)
                rn = clamp(r / max(0.05, rad), 0.0, 1.0)
                ruffle = math.sin(ang * 7.0 + ph) * 0.10 * rn * rn
                cup = rn * rn * 0.14
                v.co = v3(tx + math.cos(ang) * ruffle * 0.55, ty + cup + ruffle, tz + math.sin(ang) * ruffle * 0.55)

    apply_box_uvs(bm_ct, scale=0.75)
    paint_faces_gradient(bm_ct, bm_ct.faces, "#962e20", "#eb6a34", "#ffd28a", 0.0, 1.18, ao_strength=0.24)
    finalize_mesh_obj("Coral_Table", bm_ct, mat_coral, smooth=True)

    # 5c. `Coral_BrainDome` (Deeply carved sinuous meandering brain-coral ridges + dark valley crevice AO!)
    bm_cbn = bmesh.new()
    dome_specs = [
        ( 0.00, 0.42,  0.00, 0.78, 0.62, 0.74, "#a83e32", "#f28e64", "#ffe4be", 1.2),  # warm coral-terracotta -> sunlit peach!
        (-0.66, 0.28,  0.34, 0.52, 0.44, 0.50, "#126872", "#2cc8ba", "#b4fff4", 4.6),  # deep sea-teal -> sunlit aqua-mint!
        ( 0.62, 0.30, -0.26, 0.56, 0.46, 0.52, "#9a4a6a", "#e484a2", "#ffdce8", 8.1),  # warm dusty rose-coral -> pearl-blush!
    ]
    col_layer_cbn = bm_cbn.loops.layers.color.new("Color")
    for ox, oy, oz, rx, ry, rz, c_val, c_mid, c_top, sd in dome_specs:
        fs = add_organic_blob(bm_cbn, (ox, oy, oz), (rx, ry, rz), subdivs=3, noise_amp=0.05, noise_freq=2.4, seed=sd, flatten_bottom=-0.06, mat_idx=0)
        bm_cbn.normal_update()
        # Carve DEEP sinuous brain-coral meandering ridges & valleys along true radial outward normal!
        ridge_by_v = {}
        seen = set()
        for f in fs:
            for v in f.verts:
                if v in seen:
                    continue
                seen.add(v)
                tx, ty, tz = b_to_t3(v.co)
                lx, ly, lz = tx - ox, ty - oy, tz - oz
                rad_v = Vector((lx, -lz, ly))
                if rad_v.length > 1e-4:
                    rad_v.normalize()
                # Multi-frequency domain-warped meandering brain-coral labyrinth channels
                wx = lx * 7.5 + math.sin(lz * 6.2 + ly * 4.5 + sd) * 1.85
                wz = lz * 7.5 + math.cos(lx * 5.8 - ly * 4.2 + sd) * 1.85
                wave = math.sin(wx) * math.cos(wz) + 0.45 * math.sin((wx + wz) * 1.35 + sd)
                ridge_val = clamp(wave * 0.5 + 0.5, 0.0, 1.0)
                # Sharpen ridge crests & carve crisp recessed coral grooves (0.095m relief!)
                disp = (ridge_val - 0.42) * 0.145 * sstep(0.02, 0.28, ty)
                v.co += rad_v * disp
                ridge_by_v[v] = ridge_val

        bm_cbn.normal_update()
        cv_lin = hex_lin(c_val)
        cm_lin = hex_lin(c_mid)
        ct_lin = hex_lin(c_top)
        for f in fs:
            for lp in f.loops:
                tx, ty, tz = b_to_t3(lp.vert.co)
                ny = float(lp.vert.normal.z)
                rv = ridge_by_v.get(lp.vert, 0.5)
                # Crevice valleys get rich deep coral shadow, raised labyrinth ridges catch warm sunlight!
                t_col = clamp(rv * 0.68 + sstep(0.0, oy + ry, ty) * 0.32, 0.0, 1.0)
                if t_col < 0.45:
                    c = mix_rgb(cv_lin, cm_lin, t_col / 0.45)
                else:
                    c = mix_rgb(cm_lin, ct_lin, (t_col - 0.45) / 0.55)
                crevice_ao = 0.48 + 0.52 * sstep(0.15, 0.85, rv)
                sky = 0.78 + 0.22 * clamp(ny * 0.5 + 0.5, 0.0, 1.0)
                lp[col_layer_cbn] = (clamp(c[0] * crevice_ao * sky, 0.0, 1.0), clamp(c[1] * crevice_ao * sky, 0.0, 1.0), clamp(c[2] * crevice_ao * sky, 0.0, 1.0), 1.0)

    for v in bm_cbn.verts:
        v.co.z -= 0.16
    apply_box_uvs(bm_cbn, scale=1.2)
    finalize_mesh_obj("Coral_BrainDome", bm_cbn, mat_coral, smooth=True)

    # 5d. `Coral_Anemone` (Sculpted rocky limestone holdfast + blooming warm coral-peach & aqua anemone polyps!)
    bm_ca2 = bmesh.new()
    # Real sculpted limestone rock base (`mat_idx=2` -> `mat_limestone` PBR!) instead of smooth Play-Doh blob!
    rock_fs = add_organic_blob(bm_ca2, (0.0, 0.16, 0.0), (0.68, 0.28, 0.64), subdivs=2, noise_amp=0.18, noise_freq=2.2, seed=5.5, flatten_bottom=-0.06, strata_amp=0.07, mat_idx=2)
    paint_faces_gradient(bm_ca2, rock_fs, "#4a787c", "#8ab4aa", "#d6ece2", 0.0, 0.45, ao_strength=0.25)
    for i in range(13):
        ring_idx = 0 if i < 5 else 1
        az = (i / (5.0 if ring_idx == 0 else 8.0)) * TAU + ring_idx * 0.42
        ca, sa = math.cos(az), math.sin(az)
        r0 = 0.15 if ring_idx == 0 else 0.36
        r1 = 0.30 if ring_idx == 0 else 0.62
        hh = 0.84 if ring_idx == 0 else 0.58 + (i % 3) * 0.11
        sway_x = -sa * (0.09 if i % 2 == 0 else -0.09)
        sway_z =  ca * (0.09 if i % 2 == 0 else -0.09)
        p0 = (ca * r0, 0.18, sa * r0)
        p1 = (ca * (r0 + r1) * 0.52 + sway_x, hh * 0.54, sa * (r0 + r1) * 0.52 + sway_z)
        p2 = (ca * r1 + sway_x * 0.6, hh, sa * r1 + sway_z * 0.6)
        tfs = add_loft_tube(bm_ca2, [p0, p1, p2], [0.092, 0.066, 0.082], rad_segs=7, mat_idx=0)
        bulb = add_organic_blob(bm_ca2, p2, (0.098, 0.104, 0.098), subdivs=1, noise_amp=0.04, mat_idx=1 if i % 3 == 0 else 0)
        paint_faces_gradient(bm_ca2, tfs, "#a83454", "#f6787e", "#ffd4b8", 0.16, hh + 0.12, ao_strength=0.18)
        if i % 3 != 0:
            paint_faces_gradient(bm_ca2, bulb, "#f6787e", "#ffc4a8", "#fff5e8", hh - 0.1, hh + 0.12, ao_strength=0.05)
        else:
            paint_faces_gradient(bm_ca2, bulb, "#5ef8ff", "#aefcff", "#ffffff", hh - 0.1, hh + 0.12, ao_strength=0.0)
    apply_box_uvs(bm_ca2, scale=0.8)
    finalize_mesh_obj("Coral_Anemone", bm_ca2, [mat_coral, mat_glow_aqua, mat_limestone], smooth=True)

    # 5e. `Kelp_Cluster` (5 lush undulating thick 3D sculpted ribbon kelp fronds w/ gas bladders!)
    bm_kp = bmesh.new()
    frond_specs = [
        ( 0.00,  0.00, 3.6, 0.34, 0.0,  0.34),
        (-0.34,  0.18, 2.9, 0.28, 1.1,  0.28),
        ( 0.36, -0.14, 3.2, 0.30, 2.3,  0.30),
        (-0.18, -0.32, 2.5, 0.26, 3.8,  0.25),
        ( 0.24,  0.28, 2.7, 0.27, 5.1,  0.27),
    ]
    for fx, fz, fh, fw, rot_y, sway in frond_specs:
        segs = 14
        ca, sa = math.cos(rot_y), math.sin(rot_y)
        rows = []
        for s in range(segs + 1):
            t = s / float(segs)
            wy = t * fh
            sx_off = math.sin(t * 4.8 + rot_y) * sway * (0.25 + t * 0.95)
            sz_off = math.cos(t * 3.4 + rot_y) * sway * 0.55 * t
            w_env = math.sin(min(1.0, t * 2.6) * math.pi * 0.5) * (1.0 - t * 0.78) * fw
            ruffle = math.sin(t * 18.0 + rot_y) * 0.12 * w_env
            cx = fx + sx_off
            cz = fz + sz_off
            pL = (cx - ca * w_env, wy + ruffle, cz - sa * w_env + ruffle * 0.7)
            pC = (cx + sa * 0.045, wy, cz - ca * 0.045)
            pR = (cx + ca * w_env, wy - ruffle, cz + sa * w_env - ruffle * 0.7)
            rows.append([bm_kp.verts.new(v3(*pL)), bm_kp.verts.new(v3(*pC)), bm_kp.verts.new(v3(*pR))])
        for s in range(segs):
            for c_i in range(2):
                f = bm_kp.faces.new((rows[s][c_i], rows[s][c_i + 1], rows[s + 1][c_i + 1], rows[s + 1][c_i]))
                f.material_index = 0
        for b_t in (0.30, 0.58):
            by = b_t * fh
            bx = fx + math.sin(b_t * 4.8 + rot_y) * sway * (0.25 + b_t * 0.95)
            bz = fz + math.cos(b_t * 3.4 + rot_y) * sway * 0.55 * b_t
            add_organic_blob(bm_kp, (bx, by, bz), (0.075, 0.095, 0.075), subdivs=1, noise_amp=0.05, mat_idx=0)

    apply_box_uvs(bm_kp, scale=0.6)
    paint_faces_gradient(bm_kp, bm_kp.faces, "#0a4c3e", "#1eb876", "#b2f66c", 0.0, 3.6, ao_strength=0.14)
    finalize_mesh_obj("Kelp_Cluster", bm_kp, mat_kelp, smooth=True, recalc_normals=False)

    # ------------------------------------------------------------------
    # 6. `SunkenAmphora` (Sculpted bronze & travertine sunken Pelagian amphorae!)
    # ------------------------------------------------------------------
    bm_am = bmesh.new()
    def add_amphora(bm_t, offset_t3, rot_t3, sc=1.0, mat_body=0, mat_trim=1):
        # Lathe profile (radius, y)
        prof = [
            (0.14, 0.00), (0.24, 0.14), (0.42, 0.42), (0.46, 0.72),
            (0.36, 1.02), (0.18, 1.24), (0.17, 1.46), (0.26, 1.56), (0.20, 1.60),
        ]
        n_seg = 14
        rmat = rot3(*rot_t3).to_matrix().to_4x4()
        tvec = v3(*offset_t3)
        rings = []
        for rad, py in prof:
            ring = []
            for j in range(n_seg):
                a = (j / n_seg) * TAU
                pt = v3(math.cos(a) * rad * sc, py * sc, math.sin(a) * rad * sc)
                ring.append(bm_t.verts.new((rmat @ pt) + tvec))
            rings.append(ring)
        for i in range(len(rings) - 1):
            r0, r1 = rings[i], rings[i + 1]
            for j in range(n_seg):
                jn = (j + 1) % n_seg
                f = bm_t.faces.new((r0[j], r0[jn], r1[jn], r1[j]))
                f.material_index = mat_trim if i in (4, 6, 7) else mat_body
        # Twin graceful S-scroll bronze handles!
        for sx in (-1.0, 1.0):
            h_pts = [
                (sx * 0.22 * sc, 1.44 * sc, 0.0),
                (sx * 0.48 * sc, 1.38 * sc, 0.0),
                (sx * 0.56 * sc, 1.12 * sc, 0.0),
                (sx * 0.44 * sc, 0.86 * sc, 0.0),
            ]
            # Transform handle points
            tr_pts = []
            for hp in h_pts:
                bp = (rmat @ v3(*hp)) + tvec
                tr_pts.append(b_to_t3(bp))
            add_loft_tube(bm_t, tr_pts, 0.055 * sc, rad_segs=6, cap_start=True, cap_end=True, mat_idx=mat_trim)

    add_amphora(bm_am, (-0.35, 0.0, 0.0), (0.06, 0.35, -0.14), sc=1.0, mat_body=0, mat_trim=1)
    add_amphora(bm_am, (0.68, 0.34, 0.28), (0.20, -0.55, 1.24), sc=0.82, mat_body=1, mat_trim=0)
    # Glowing sunken pearls nestled at amphora mouth!
    for px, py, pz in [(1.55, 0.14, 0.44), (1.72, 0.12, 0.22), (1.42, 0.12, 0.62)]:
        add_organic_blob(bm_am, (px, py, pz), (0.11, 0.11, 0.11), subdivs=1, noise_amp=0.0, mat_idx=2)

    apply_box_uvs(bm_am, scale=0.65)
    paint_bmesh_vcol(bm_am, lambda tx, ty, tz, vnx, vny, vnz, fny, mi: (1.0, 1.0, 1.0) if mi == 2 else tuple(c * (0.78 + 0.22 * clamp(vny * 0.5 + 0.5, 0.0, 1.0)) for c in hex_lin("#f4dfca")))
    finalize_mesh_obj("SunkenAmphora", bm_am, [mat_bronze, mat_travertine, mat_glow_aqua], smooth=True)

    # ------------------------------------------------------------------
    # 7. `HydroRing_Reef` (Chunky 3D antique-bronze & crystal glowing hydro-ring!)
    # ------------------------------------------------------------------
    bm_hr = bmesh.new()
    add_beveled_torus_t3(bm_hr, (0.0, 0.0, 0.0), 0.92, 0.115, maj_segs=26, min_segs=8, axis="Z", mat_idx=0)
    add_beveled_torus_t3(bm_hr, (0.0, 0.0, 0.0), 0.78, 0.056, maj_segs=26, min_segs=6, axis="Z", mat_idx=1)
    for k in range(4):
        ang = k * math.pi * 0.5
        ca, sa = math.cos(ang), math.sin(ang)
        add_bevel_box(bm_hr, (ca * 0.92, sa * 0.92, 0.0), (0.28, 0.26, 0.28), bevel=0.035, rot_t3=(0.0, 0.0, ang), mat_idx=0)
        # Sculpted hydro-fin winglet on outer clasp
        add_bevel_box(bm_hr, (ca * 1.16, sa * 1.16, 0.0), (0.26, 0.10, 0.14), bevel=0.02, rot_t3=(0.0, 0.0, ang), mat_idx=0)
        add_organic_blob(bm_hr, (ca * 1.06, sa * 1.06, 0.0), (0.10, 0.10, 0.10), subdivs=1, noise_amp=0.0, mat_idx=1)
    apply_box_uvs(bm_hr, scale=0.75)
    paint_bmesh_vcol(bm_hr, lambda tx, ty, tz, vnx, vny, vnz, fny, mi: (1.0, 1.0, 1.0))
    finalize_mesh_obj("HydroRing_Reef", bm_hr, [mat_bronze, mat_glow_aqua], smooth=True)

    return export_glb_and_inspect(os.path.join(OUT_MODELS_DIR, "env_reef_grotto.glb"))


# ==============================================================================
# KIT 3: `assets/models/env_sky_canyon.glb` (FRILL GLIDE)
# ==============================================================================

def build_env_sky_canyon():
    reset_scene()

    mat_sandstone = make_pbr_tex_mat(
        "Mat_Sky_Sandstone",
        "arch_canyon_sandstone_albedo.webp",
        "arch_canyon_sandstone_normal.webp",
        "arch_canyon_sandstone_orm.webp",
        tint_hex="#ffead6",
        normal_strength=1.0,
        use_vcol=True,
    )
    mat_travertine = make_pbr_tex_mat(
        "Mat_Sky_Travertine",
        "arch_coral_travertine_albedo.webp",
        "arch_coral_travertine_normal.webp",
        "arch_coral_travertine_orm.webp",
        tint_hex="#faeadd",
        normal_strength=0.95,
        use_vcol=True,
    )
    mat_bronze = make_pbr_tex_mat(
        "Mat_Sky_Bronze",
        "arch_antique_bronze_albedo.webp",
        "arch_antique_bronze_normal.webp",
        "arch_antique_bronze_orm.webp",
        tint_hex="#ffe0a8",
        normal_strength=0.90,
        use_vcol=True,
    )
    mat_timber = make_pbr_tex_mat(
        "Mat_Sky_Timber",
        "arch_redwood_timber_albedo.webp",
        "arch_redwood_timber_normal.webp",
        "arch_redwood_timber_orm.webp",
        tint_hex="#ebd2bc",
        normal_strength=0.90,
        use_vcol=True,
    )
    mat_foliage = make_vcol_stylized_mat(
        "Mat_Sky_Foliage",
        roughness=0.70,
        metallic=0.0,
        emissive_vcol_strength=0.08,
    )
    mat_cumulus = make_vcol_stylized_mat(
        "Mat_Sky_Cumulus",
        roughness=0.92,
        metallic=0.0,
        emissive_vcol_strength=0.22,
    )
    mat_glow_gold = make_emissive_crystal_mat(
        "Mat_Sky_ThermalGold",
        "#fff2b8",
        "#fbbf24",
        strength=2.3,
        roughness=0.14,
        metallic=0.22,
    )
    mat_glow_aqua = make_emissive_crystal_mat(
        "Mat_Sky_ThermalAqua",
        "#a8f8ff",
        "#2ce8e4",
        strength=2.2,
        roughness=0.12,
        metallic=0.14,
    )

    # ------------------------------------------------------------------
    # 1. `SeaStack_Mesa_A` (Majestic sculpted Sedona sea-stack mesa + rounded 3D tree crowns!)
    # ------------------------------------------------------------------
    bm_ms = bmesh.new()
    # Lofted multi-tiered terraced Sedona mesa (18 radial segments, 11 height rings!)
    mesa_levels = [
        # (y, rx, rz, ox, oz)
        (-2.2, 5.4, 4.4,  0.00,  0.00),  # wide submerged sea base
        ( 0.0, 4.8, 3.9,  0.05,  0.00),  # sea waterline flare
        ( 1.2, 3.9, 3.3,  0.10, -0.05),  # undercut wave notch!
        ( 2.8, 4.5, 3.7,  0.00,  0.05),  # stepped sandstone terrace 1
        ( 3.4, 4.4, 3.6, -0.05,  0.05),
        ( 5.8, 3.7, 3.1, -0.10,  0.00),  # vertical striated cliff face
        ( 6.4, 4.1, 3.4, -0.05, -0.08),  # overhanging strata cap 2
        ( 8.6, 3.4, 2.9,  0.05, -0.04),
        ( 9.5, 3.8, 3.2,  0.08,  0.00),  # crowning mesa rim flare!
        (10.2, 3.5, 2.9,  0.05,  0.00),  # sunlit plateau top
    ]
    n_rad = 18
    m_rings = []
    for li, (my, rx, rz, ox, oz) in enumerate(mesa_levels):
        ring = []
        for j in range(n_rad):
            a = (j / float(n_rad)) * TAU
            ca, sa = math.cos(a), math.sin(a)
            # Bold sculpted rock buttresses & natural strata crags (NOT a smooth cylinder!)
            buttress = (
                1.0
                + 0.16 * math.cos(a * 3.0 + 0.6)
                + 0.10 * math.sin(a * 5.0 - 1.1 + li * 0.25)
                + 0.06 * fbm3(ca * 2.0, my * 0.35, sa * 2.0, seed=9.1)
            )
            ring.append(bm_ms.verts.new(v3(ox + ca * rx * buttress, my, oz + sa * rz * buttress)))
        m_rings.append(ring)
    for i in range(len(m_rings) - 1):
        r0, r1 = m_rings[i], m_rings[i + 1]
        for j in range(n_rad):
            jn = (j + 1) % n_rad
            f = bm_ms.faces.new((r0[j], r0[jn], r1[jn], r1[j]))
            f.material_index = 0
    # Cap top plateau cleanly
    c_top = bm_ms.verts.new(v3(0.05, 10.35, 0.0))
    for j in range(n_rad):
        jn = (j + 1) % n_rad
        f = bm_ms.faces.new((c_top, m_rings[-1][j], m_rings[-1][jn]))
        f.material_index = 2  # lush grassy meadow top!

    # Sculpted lush grassy cushions on the top plateau & mid terrace + 3 Pixar rounded 3D trees!
    add_organic_blob(bm_ms, (0.0, 10.25, 0.0), (3.45, 0.55, 2.85), subdivs=2, noise_amp=0.10, seed=4.2, flatten_bottom=-0.15, mat_idx=2)
    add_organic_blob(bm_ms, (2.4, 3.45, 1.35), (1.45, 0.38, 1.25), subdivs=1, noise_amp=0.14, seed=6.7, mat_idx=2)
    add_pixar_tree(bm_ms, (-1.25, 10.35,  0.42), scale=0.95, seed=2.4, mat_trunk=1, mat_foliage=2)
    add_pixar_tree(bm_ms, ( 0.85, 10.40, -0.55), scale=1.12, seed=5.9, mat_trunk=1, mat_foliage=2)
    add_pixar_tree(bm_ms, ( 1.65, 10.30,  0.95), scale=0.78, seed=8.3, mat_trunk=1, mat_foliage=2)

    apply_box_uvs(bm_ms, scale=0.18)
    def mesa_col(tx, ty, tz, vnx, vny, vnz, fny, mi):
        if mi == 0:
            wet = sstep(-0.4, 1.8, ty)
            c = mix_rgb(hex_lin("#855b48"), hex_lin("#f2d5bc"), wet)
            c = mix_rgb(c, hex_lin("#fff2e0"), sstep(5.0, 10.2, ty) * 0.45)
            ao = 0.78 + 0.22 * clamp(vny * 0.5 + 0.5, 0.0, 1.0)
            return (c[0] * ao, c[1] * ao, c[2] * ao)
        elif mi == 1:
            return hex_lin("#aa8268")
        else:
            up = clamp(vny * 0.55 + 0.45, 0.0, 1.0)
            c = mix_rgb(hex_lin("#1f5a3e"), hex_lin("#489c4c"), clamp(up * 1.4, 0.0, 1.0))
            return mix_rgb(c, hex_lin("#9ed65e"), sstep(0.55, 0.96, up))
    paint_bmesh_vcol(bm_ms, mesa_col)
    finalize_mesh_obj("SeaStack_Mesa_A", bm_ms, [mat_sandstone, mat_timber, mat_foliage], smooth=True)

    # ------------------------------------------------------------------
    # 2. `SeaStack_Spire_B` (Sculpted twin-pillar coastal sandstone arch-stack — ZERO cone spike!)
    # ------------------------------------------------------------------
    bm_sp = bmesh.new()
    # Left tall terraced sea-stack pillar & Right shoulder buttress joined by natural sea-window arch!
    def add_terraced_pillar(bm_t, cx, cz, h, r_base, r_top, seed):
        lvls = 8
        n_r = 14
        rings = []
        for i in range(lvls + 1):
            t = i / float(lvls)
            py = -2.2 + t * (h + 2.2)
            # Stepped sandstone ledges rather than straight cone!
            step_r = lerp(r_base, r_top, t ** 0.72) * (1.0 + 0.14 * math.sin(t * 14.0 + seed))
            ring = []
            for j in range(n_r):
                a = (j / float(n_r)) * TAU
                cr = step_r * (1.0 + 0.15 * math.cos(a * 3.0 + seed) + 0.09 * math.sin(a * 5.0 - seed))
                ring.append(bm_t.verts.new(v3(cx + math.cos(a) * cr, py, cz + math.sin(a) * cr * 0.86)))
            rings.append(ring)
        for i in range(lvls):
            r0, r1 = rings[i], rings[i + 1]
            for j in range(n_r):
                jn = (j + 1) % n_r
                f = bm_t.faces.new((r0[j], r0[jn], r1[jn], r1[j]))
                f.material_index = 0
        ct = bm_t.verts.new(v3(cx, h + 0.18, cz))
        for j in range(n_r):
            jn = (j + 1) % n_r
            f = bm_t.faces.new((ct, rings[-1][j], rings[-1][jn]))
            f.material_index = 0

    add_terraced_pillar(bm_sp, -2.25, 0.0, 11.4, 2.65, 1.55, seed=3.4)
    add_terraced_pillar(bm_sp,  2.55, 0.2,  7.4, 2.35, 1.45, seed=7.8)
    # Natural carved sandstone sea-window arch bridging the two pillars (y = 4.2..6.2m)
    arch_bridge_pts = [
        (-2.1, 4.4, 0.0), (-0.9, 5.8, 0.05), (0.3, 6.1, 0.10), (1.5, 5.4, 0.15), (2.5, 4.2, 0.2),
    ]
    add_loft_tube(bm_sp, arch_bridge_pts, [1.28, 1.05, 0.96, 1.08, 1.24], rad_segs=10, mat_idx=0, oval_ratio=0.82)
    # Rounded Pixar 3D bonsai pine crowns perched on the twin plateaus!
    add_organic_blob(bm_sp, (-2.25, 11.45, 0.0), (1.65, 0.36, 1.45), subdivs=1, noise_amp=0.12, seed=2.2, mat_idx=2)
    add_pixar_tree(bm_sp, (-2.25, 11.45, 0.0), scale=0.82, seed=11.1, mat_trunk=1, mat_foliage=2)
    add_organic_blob(bm_sp, (2.55, 7.45, 0.2), (1.55, 0.34, 1.35), subdivs=1, noise_amp=0.12, seed=6.1, mat_idx=2)
    add_pixar_tree(bm_sp, (2.55, 7.45, 0.2), scale=0.72, seed=15.3, mat_trunk=1, mat_foliage=2)

    apply_box_uvs(bm_sp, scale=0.20)
    paint_bmesh_vcol(bm_sp, mesa_col)
    finalize_mesh_obj("SeaStack_Spire_B", bm_sp, [mat_sandstone, mat_timber, mat_foliage], smooth=True)

    # ------------------------------------------------------------------
    # 3. `Viaduct_SkyBridge` (Ruined 3-arch stone Pelagian viaduct sky-bridge!)
    # ------------------------------------------------------------------
    bm_vb = bmesh.new()
    # 4 tall carved sandstone viaduct piers extending below sea level (y = -2.4..9.4m)
    pier_xs = [-8.4, -2.8, 2.8, 8.4]
    for idx, px in enumerate(pier_xs):
        is_ruined_end = (idx == 3)
        ph = 9.2 if not is_ruined_end else 7.4
        add_bevel_box(bm_vb, (px, -2.4 + ph * 0.5, 0.0), (1.75, ph, 2.85), bevel=0.10, mat_idx=0)
        add_bevel_box(bm_vb, (px, -0.8, 0.0), (2.28, 3.2, 3.35), bevel=0.12, mat_idx=0)
        # Bronze pilaster trim bands
        add_bevel_box(bm_vb, (px, 5.2, 0.0), (1.92, 0.24, 3.04), bevel=0.04, mat_idx=2)
        if not is_ruined_end:
            add_bevel_box(bm_vb, (px, 8.6, 0.0), (2.02, 0.34, 3.12), bevel=0.05, mat_idx=1)

    # 3 graceful Pelagian stone viaduct arches (3rd arch artfully ruined/broken near right!)
    for bay in range(3):
        cx = (pier_xs[bay] + pier_xs[bay + 1]) * 0.5
        rx = 2.65
        ry = 2.45
        sy = 5.45
        n_v = 9
        for i in range(n_v):
            if bay == 2 and i >= 6:
                continue  # broken ruined arch span on right!
            t = (i + 0.5) / n_v
            ang = math.pi * (1.0 - t)
            ax = cx + math.cos(ang) * rx
            ay = sy + math.sin(ang) * ry
            slope = math.atan2(-math.cos(ang) * ry, math.sin(ang) * rx)
            is_key = (i == n_v // 2)
            add_bevel_box(bm_vb, (ax, ay, 0.0), (1.08, 0.96 if is_key else 0.78, 2.65 if is_key else 2.42), bevel=0.06, rot_t3=(0.0, 0.0, slope), mat_idx=1 if is_key else 0)
        if bay < 2:
            # Ornate antique-bronze Pelagian ring medallion in spandrel & arch rib!
            for sz in (-1.28, 1.28):
                add_beveled_torus_t3(bm_vb, (cx, sy + ry + 0.06, sz), 0.48, 0.075, maj_segs=14, min_segs=6, axis="Z", mat_idx=2)

    # Upper roadway deck & weathered broken balustrade parapet (spanning left 2.4 bays!)
    add_bevel_box(bm_vb, (-2.6, 8.75, 0.0), (14.4, 0.62, 3.05), bevel=0.07, mat_idx=1)
    for sz in (-1.26, 1.26):
        add_bevel_box(bm_vb, (-3.4, 9.42, sz), (12.4, 0.72, 0.38), bevel=0.05, mat_idx=0)
        add_bevel_box(bm_vb, (-2.6, 9.02, sz * 1.15), (14.2, 0.14, 0.14), bevel=0.02, mat_idx=2)
    # Lush mossy vine tufts draping over ruined stones
    for vx, vy, vz, vr in [(-2.8, 9.7, 1.15, 0.72), (2.8, 9.5, -1.10, 0.68), (5.0, 8.2, 0.85, 0.58)]:
        add_organic_blob(bm_vb, (vx, vy, vz), (vr, vr * 0.55, vr * 0.72), subdivs=1, noise_amp=0.14, seed=vx * 3.0, mat_idx=3)

    apply_box_uvs(bm_vb, scale=0.24)
    def viaduct_col(tx, ty, tz, vnx, vny, vnz, fny, mi):
        if mi == 3:
            return mix_rgb(hex_lin("#24603f"), hex_lin("#88cc58"), clamp(vny * 0.55 + 0.45, 0.0, 1.0))
        wet = sstep(-0.5, 2.0, ty)
        c = mix_rgb(hex_lin("#8b6a58"), hex_lin("#f8ead8"), wet)
        ao = 0.78 + 0.22 * clamp(vny * 0.5 + 0.5, 0.0, 1.0)
        return (c[0] * ao, c[1] * ao, c[2] * ao)
    paint_bmesh_vcol(bm_vb, viaduct_col)
    finalize_mesh_obj("Viaduct_SkyBridge", bm_vb, [mat_sandstone, mat_travertine, mat_bronze, mat_foliage], smooth=False)

    # ------------------------------------------------------------------
    # 4. `Cumulus_Cloud_A`, `Cumulus_Cloud_B` & `StormCloud_Sculpted`
    #    VOXEL-REMESHED, SMOOTHLY FUSED, ASYMMETRICAL HORIZONTALLY DRIFTED CLOUD BANKS!
    #    ZERO separate creased spheres, ZERO symmetrical pyramids, ZERO muddy black clump!
    # ------------------------------------------------------------------
    def build_fused_cloud(
        name,
        puffs,
        seed,
        top_hex="#fffcf2",
        mid_hex="#f2f6ff",
        bot_hex="#b2cff2",
        voxel_size=0.22,
        smooth_iters=8,
        decimate_ratio=0.16,
    ):
        bm = bmesh.new()
        for idx, (cx, cy, cz, rx, ry, rz) in enumerate(puffs):
            add_organic_blob(
                bm,
                (cx, cy, cz),
                (rx, ry, rz),
                subdivs=2,
                noise_amp=0.10,
                noise_freq=1.2,
                seed=seed + idx * 4.1,
                flatten_bottom=-0.22 if cy <= 0.45 else None,
                mat_idx=0,
            )
        obj = finalize_mesh_obj(name, bm, mat_cumulus, smooth=True)

        # Fuse all puffs into ONE seamless organic wind-swept cloud sculpture via Voxel Remesh + Smooth + Decimate!
        bpy.context.view_layer.objects.active = obj
        mod_r = obj.modifiers.new("CloudRemesh", "REMESH")
        mod_r.mode = "VOXEL"
        mod_r.voxel_size = voxel_size
        mod_r.use_smooth_shade = True

        mod_s = obj.modifiers.new("CloudSmooth", "SMOOTH")
        mod_s.factor = 0.65
        mod_s.iterations = smooth_iters

        mod_d = obj.modifiers.new("CloudDecimate", "DECIMATE")
        mod_d.ratio = decimate_ratio

        bpy.ops.object.select_all(action="DESELECT")
        obj.select_set(True)
        bpy.ops.object.convert(target="MESH")

        # Bake luminous warm-cream sunlit tops & sky-periwinkle undersides onto the fused manifold cloud!
        bm_f = bmesh.new()
        bm_f.from_mesh(obj.data)
        bm_f.normal_update()
        # Gently flatten wispy cloud base deck for authentic tradewind horizon drift!
        ys = [b_to_t3(v.co)[1] for v in bm_f.verts]
        y_min, y_max = min(ys), max(ys)
        y_floor = y_min + (y_max - y_min) * 0.14
        for v in bm_f.verts:
            tx, ty, tz = b_to_t3(v.co)
            if ty < y_floor:
                ty = lerp(ty, y_floor, 0.58)
                v.co = v3(tx, ty, tz)
        bm_f.normal_update()

        ys2 = [b_to_t3(v.co)[1] for v in bm_f.verts]
        y_min2, y_max2 = min(ys2), max(ys2)
        span = max(0.5, y_max2 - y_min2)
        c_top = hex_lin(top_hex)
        c_mid = hex_lin(mid_hex)
        c_bot = hex_lin(bot_hex)

        apply_box_uvs(bm_f, scale=0.20)
        def fused_cloud_col(tx, ty, tz, vnx, vny, vnz, fny, mi):
            ht = clamp((ty - y_min2) / span, 0.0, 1.0)
            # Soft directional warm sunlit top-left illumination, luminous periwinkle shadow underside (zero dark grey creases!)
            sun_lit = clamp(vny * 0.42 + vnx * 0.16 + 0.58, 0.0, 1.0)
            t = clamp(ht * 0.62 + sun_lit * 0.38, 0.0, 1.0)
            if t < 0.45:
                return mix_rgb(c_bot, c_mid, t / 0.45)
            return mix_rgb(c_mid, c_top, (t - 0.45) / 0.55)

        paint_bmesh_vcol(bm_f, fused_cloud_col)
        for f in bm_f.faces:
            f.smooth = True
        bm_f.to_mesh(obj.data)
        bm_f.free()
        obj.data.update()
        return obj

    # Asymmetrical wind-swept cumulus bank A (tall offset billow on left, long trailing sunlit plume to right!)
    build_fused_cloud(
        "Cumulus_Cloud_A",
        puffs=[
            (-3.4, 0.10,  0.10, 1.55, 0.72, 1.15),
            (-1.9, 0.24, -0.15, 2.05, 0.96, 1.45),
            (-0.1, 0.20,  0.18, 2.15, 0.88, 1.38),
            ( 1.9, 0.14, -0.12, 1.85, 0.76, 1.22),
            ( 3.7, 0.06,  0.08, 1.45, 0.58, 0.98),
            (-2.1, 1.12,  0.05, 1.55, 1.18, 1.25),
            (-1.1, 1.78, -0.06, 1.32, 1.12, 1.12),
            ( 0.6, 1.05,  0.10, 1.38, 0.92, 1.10),
            ( 2.2, 0.68, -0.08, 1.18, 0.68, 0.96),
        ],
        seed=2.1,
        voxel_size=0.24,
        smooth_iters=8,
        decimate_ratio=0.14,
    )

    # Asymmetrical elongated coastal tradewind cloud bank B (sleek flat deck on left, billowing warm turret right!)
    build_fused_cloud(
        "Cumulus_Cloud_B",
        puffs=[
            (-3.6, 0.08, -0.10, 1.45, 0.56, 0.96),
            (-1.8, 0.16,  0.12, 1.92, 0.74, 1.25),
            ( 0.2, 0.22, -0.08, 2.10, 0.90, 1.40),
            ( 2.1, 0.24,  0.14, 1.95, 0.92, 1.36),
            ( 3.6, 0.12, -0.06, 1.35, 0.66, 1.02),
            ( 0.9, 1.15,  0.05, 1.45, 1.08, 1.18),
            ( 2.0, 1.62, -0.05, 1.22, 1.02, 1.06),
            (-0.6, 0.82,  0.10, 1.25, 0.74, 1.04),
        ],
        seed=8.7,
        voxel_size=0.24,
        smooth_iters=8,
        decimate_ratio=0.14,
    )

    # 5. `StormCloud_Sculpted` (Sculpted dramatic wind-swept anvil thunderhead — luminous slate-silver top, stormy blue-violet underside!)
    build_fused_cloud(
        "StormCloud_Sculpted",
        puffs=[
            (-1.75, 0.02,  0.08, 1.18, 0.54, 0.88),
            (-0.25, 0.10, -0.08, 1.52, 0.68, 1.05),
            ( 1.45, 0.05,  0.10, 1.38, 0.60, 0.94),
            ( 2.45, 0.00, -0.06, 0.92, 0.44, 0.74),
            (-0.65, 0.72,  0.04, 1.15, 0.78, 0.92),
            ( 0.68, 0.92, -0.05, 1.28, 0.88, 0.98),
            ( 1.45, 1.18,  0.02, 1.18, 0.64, 0.86),  # sheared anvil top!
        ],
        seed=19.4,
        top_hex="#9cb4d6",
        mid_hex="#56698e",
        bot_hex="#363e5c",
        voxel_size=0.18,
        smooth_iters=7,
        decimate_ratio=0.15,
    )

    # ------------------------------------------------------------------
    # 6. `ThermalRing_Bronze` (Sculpted 3D antique-bronze & crystal thermal updraft ring!)
    # ------------------------------------------------------------------
    bm_tr = bmesh.new()
    add_beveled_torus_t3(bm_tr, (0.0, 0.0, 0.0), 1.00, 0.118, maj_segs=26, min_segs=8, axis="Z", mat_idx=0)
    add_beveled_torus_t3(bm_tr, (0.0, 0.0, 0.0), 0.85, 0.058, maj_segs=26, min_segs=6, axis="Z", mat_idx=1)
    # 4 sleek sculpted Pelagian cardinal clasps + glowing crystal medallions
    for k in range(4):
        ang = k * math.pi * 0.5
        ca, sa = math.cos(ang), math.sin(ang)
        add_bevel_box(bm_tr, (ca * 1.00, sa * 1.00, 0.0), (0.28, 0.28, 0.30), bevel=0.04, rot_t3=(0.0, 0.0, ang), mat_idx=0)
        add_bevel_box(bm_tr, (ca * 1.18, sa * 1.18, 0.0), (0.20, 0.13, 0.16), bevel=0.03, rot_t3=(0.0, 0.0, ang), mat_idx=0)
        add_organic_blob(bm_tr, (ca * 1.12, sa * 1.12, 0.0), (0.10, 0.10, 0.10), subdivs=1, noise_amp=0.0, mat_idx=2 if k % 2 == 0 else 1)
    apply_box_uvs(bm_tr, scale=0.75)
    paint_bmesh_vcol(bm_tr, lambda tx, ty, tz, vnx, vny, vnz, fny, mi: (1.0, 1.0, 1.0))
    finalize_mesh_obj("ThermalRing_Bronze", bm_tr, [mat_bronze, mat_glow_gold, mat_glow_aqua], smooth=True)

    # ------------------------------------------------------------------
    # 7. `LaunchSanctuary_Deck` & `ArrivalSpire_Distant`
    # ------------------------------------------------------------------
    bm_ls = bmesh.new()
    add_cylinder_t3(bm_ls, (0.0, -2.5, 0.0), 3.15, 2.85, 5.0, segs=18, mat_idx=0)
    add_cylinder_t3(bm_ls, (0.0, 0.14, 0.0), 3.05, 3.18, 0.42, segs=18, mat_idx=1)
    add_beveled_torus_t3(bm_ls, (0.0, 0.34, 0.0), 3.10, 0.11, maj_segs=24, min_segs=6, axis="Y", mat_idx=2)
    for k in range(8):
        a = (k / 8.0) * TAU
        add_cylinder_t3(bm_ls, (math.cos(a) * 2.90, 0.72, math.sin(a) * 2.90), 0.11, 0.09, 0.78, segs=6, mat_idx=2)
    apply_box_uvs(bm_ls, scale=0.28)
    paint_bmesh_vcol(bm_ls, lambda tx, ty, tz, vnx, vny, vnz, fny, mi: tuple(c * (0.78 + 0.22 * sstep(-4.0, 1.0, ty)) for c in hex_lin("#f5e4d0")))
    finalize_mesh_obj("LaunchSanctuary_Deck", bm_ls, [mat_sandstone, mat_travertine, mat_bronze], smooth=True)

    bm_as = bmesh.new()
    add_cylinder_t3(bm_as, (0.0, 4.5, 0.0), 3.2, 2.6, 11.0, segs=18, mat_idx=0)
    for ry in (1.5, 4.8, 8.2):
        add_beveled_torus_t3(bm_as, (0.0, ry, 0.0), 3.15 - ry * 0.05, 0.18, maj_segs=22, min_segs=6, axis="Y", mat_idx=2)
    add_cylinder_t3(bm_as, (0.0, 10.6, 0.0), 2.85, 0.4, 2.4, segs=16, mat_idx=1)
    add_organic_blob(bm_as, (0.0, 12.1, 0.0), (0.65, 0.95, 0.65), subdivs=1, noise_amp=0.0, mat_idx=3)
    apply_box_uvs(bm_as, scale=0.22)
    paint_bmesh_vcol(bm_as, lambda tx, ty, tz, vnx, vny, vnz, fny, mi: (1.0, 1.0, 1.0) if mi == 3 else tuple(c * (0.78 + 0.22 * sstep(0.0, 10.0, ty)) for c in hex_lin("#f5e6d4")))
    finalize_mesh_obj("ArrivalSpire_Distant", bm_as, [mat_sandstone, mat_travertine, mat_bronze, mat_glow_aqua], smooth=True)

    return export_glb_and_inspect(os.path.join(OUT_MODELS_DIR, "env_sky_canyon.glb"))


# ==============================================================================
# 3-PANEL BLENDER EEVEE BEAUTY SHEET RENDERER
# ==============================================================================

def _setup_eevee(scene, w=960, h=720, exposure=0.15):
    scene.render.engine = "BLENDER_EEVEE"
    scene.render.resolution_x = w
    scene.render.resolution_y = h
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    if hasattr(scene.eevee, "taa_render_samples"):
        scene.eevee.taa_render_samples = 32
    vt_items = [i.identifier for i in scene.view_settings.bl_rna.properties["view_transform"].enum_items]
    scene.view_settings.view_transform = "AgX" if "AgX" in vt_items else "Standard"
    scene.view_settings.exposure = exposure


def _import_glb_map(filepath):
    before = set(bpy.context.scene.objects)
    bpy.ops.import_scene.gltf(filepath=filepath)
    added = [o for o in bpy.context.scene.objects if o not in before]
    by_name = {}
    for o in added:
        base = o.name.split(".")[0]
        by_name[base] = o
        # Hide original templates far away; we instance/duplicate cleanly into diorama
        o.hide_render = True
        o.hide_viewport = True
    return by_name


def _place_copy(src_obj, pos_t3, rot_t3=(0.0, 0.0, 0.0), scale=(1.0, 1.0, 1.0)):
    if src_obj is None:
        return None
    cp = src_obj.copy()
    cp.data = src_obj.data
    cp.hide_render = False
    cp.hide_viewport = False
    cp.location = v3(*pos_t3)
    cp.rotation_euler = rot3(*rot_t3)
    if isinstance(scale, (int, float)):
        cp.scale = (scale, scale, scale)
    else:
        # Three.js (sx, sy_up, sz) -> Blender (sx, sz, sy_up)
        cp.scale = (scale[0], scale[2], scale[1])
    bpy.context.collection.objects.link(cp)
    return cp


def _add_sun(name, energy, color, rot_t3):
    ld = bpy.data.lights.new(name, type="SUN")
    ld.energy = energy
    ld.color = color
    lo = bpy.data.objects.new(name, ld)
    lo.rotation_euler = rot3(*rot_t3)
    bpy.context.collection.objects.link(lo)
    return lo


def _add_area(name, energy, color, pos_t3, tgt_t3, size=6.0):
    ld = bpy.data.lights.new(name, type="AREA")
    ld.energy = energy
    ld.color = color
    ld.size = size
    lo = bpy.data.objects.new(name, ld)
    lo.location = v3(*pos_t3)
    lo.rotation_euler = (v3(*tgt_t3) - lo.location).to_track_quat("-Z", "Y").to_euler()
    bpy.context.collection.objects.link(lo)
    return lo


def _add_cam(scene, pos_t3, tgt_t3, lens=32.0):
    cd = bpy.data.cameras.new("BeautyCam")
    cd.lens = lens
    cd.clip_end = 400.0
    co = bpy.data.objects.new("BeautyCam", cd)
    co.location = v3(*pos_t3)
    co.rotation_euler = (v3(*tgt_t3) - co.location).to_track_quat("-Z", "Y").to_euler()
    bpy.context.collection.objects.link(co)
    scene.camera = co
    return co


def _set_gradient_world(scene, bot_hex, mid_hex, top_hex, strength=1.15):
    world = bpy.data.worlds.new("BeautyWorld")
    scene.world = world
    world.use_nodes = True
    nt = world.node_tree
    nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputWorld")
    bg = nt.nodes.new("ShaderNodeBackground")
    bg.inputs["Strength"].default_value = strength
    tc = nt.nodes.new("ShaderNodeTexCoord")
    sep = nt.nodes.new("ShaderNodeSeparateXYZ")
    mr = nt.nodes.new("ShaderNodeMapRange")
    mr.inputs["From Min"].default_value = -0.15
    mr.inputs["From Max"].default_value = 0.65
    ramp = nt.nodes.new("ShaderNodeValToRGB")
    ramp.color_ramp.elements[0].position = 0.0
    ramp.color_ramp.elements[0].color = (*hex_lin(bot_hex), 1.0)
    ramp.color_ramp.elements[1].position = 1.0
    ramp.color_ramp.elements[1].color = (*hex_lin(top_hex), 1.0)
    mid_el = ramp.color_ramp.elements.new(0.38)
    mid_el.color = (*hex_lin(mid_hex), 1.0)
    nt.links.new(tc.outputs["Generated"], sep.inputs["Vector"])
    nt.links.new(sep.outputs["Z"], mr.inputs["Value"])
    nt.links.new(mr.outputs["Result"], ramp.inputs["Fac"])
    nt.links.new(ramp.outputs["Color"], bg.inputs["Color"])
    nt.links.new(bg.outputs["Background"], out.inputs["Surface"])


def _make_water_plane(name, w, d, y_t3, z_t3, col_hex="#14aebc", rough=0.12):
    bpy.ops.mesh.primitive_plane_add(size=1.0, location=v3(0.0, y_t3, z_t3))
    obj = bpy.context.active_object
    obj.name = name
    obj.scale = (w, d, 1.0)
    mat = bpy.data.materials.new(f"Mat_{name}")
    mat.use_nodes = True
    nt = mat.node_tree
    bsdf = nt.nodes["Principled BSDF"]
    bsdf.inputs["Base Color"].default_value = (*hex_lin(col_hex), 1.0)
    bsdf.inputs["Roughness"].default_value = rough
    bsdf.inputs["Metallic"].default_value = 0.05
    # Subtle water wave bump
    noise = nt.nodes.new("ShaderNodeTexNoise")
    noise.inputs["Scale"].default_value = 18.0
    noise.inputs["Detail"].default_value = 4.0
    bump = nt.nodes.new("ShaderNodeBump")
    bump.inputs["Strength"].default_value = 0.20
    nt.links.new(noise.outputs["Fac"], bump.inputs["Height"])
    nt.links.new(bump.outputs["Normal"], bsdf.inputs["Normal"])
    obj.data.materials.append(mat)
    return obj


def _import_gateway_preview(pos_t3, rot_t3=(0.0, 0.0, 0.0), scale=1.22):
    gw_path = os.path.join(OUT_MODELS_DIR, "gateway.glb")
    if not os.path.exists(gw_path):
        return None
    before = set(bpy.context.scene.objects)
    bpy.ops.import_scene.gltf(filepath=gw_path)
    added = [o for o in bpy.context.scene.objects if o not in before]
    roots = [o for o in added if o.parent is None]
    holder = make_empty_node("GatewayPreviewHolder", pos_t3, rot_t3)
    holder.scale = (scale, scale, scale)
    for r in roots:
        r.parent = holder
    return holder


def render_3panel_beauty_sheet(out_png, panel_w=960, panel_h=720):
    scratch_dir = os.path.join(os.path.dirname(os.path.abspath(out_png)), "scratch")
    os.makedirs(scratch_dir, exist_ok=True)
    panel_paths = []

    # ---- PANEL 1: RAPIDS SURF (Canyon Gorge) ----
    scene = reset_scene()
    _setup_eevee(scene, panel_w, panel_h, exposure=0.20)
    _set_gradient_world(scene, "#f5d098", "#7cc8f0", "#1e6db8", strength=1.25)
    _make_water_plane("RapidsWater", 44.0, 140.0, 0.0, -36.0, col_hex="#15b4be", rough=0.14)

    rapids = _import_glb_map(os.path.join(OUT_MODELS_DIR, "env_rapids_gorge.glb"))
    for k in range(5):
        z = -3.0 - k * 17.5
        curve = math.sin(k * 0.55) * 1.8
        _place_copy(rapids.get("CliffBank_Left"), (curve - 11.6, 0.0, z))
        _place_copy(rapids.get("CliffBank_Right"), (curve + 11.6, 0.0, z))
    _place_copy(rapids.get("AqueductBridge_High"), (0.6, 0.0, -24.5))
    _place_copy(rapids.get("AqueductBridge_High"), (1.8, 0.0, -56.0))
    _place_copy(rapids.get("TimberPier"), (-10.2, 0.0, -9.5), rot_t3=(0.0, 0.08, 0.0))
    _place_copy(rapids.get("TimberPier"), (10.4, 0.0, -19.5), rot_t3=(0.0, math.pi - 0.12, 0.0))
    _place_copy(rapids.get("SlalomGate_Arch"), (-1.4, 0.0, -14.5))
    _place_copy(rapids.get("SlalomGate_Arch"), (2.4, 0.0, -34.0))
    _place_copy(rapids.get("SlalomRing_Bronze"), (1.5, 1.35, -9.2), rot_t3=(0.0, -0.15, 0.0))
    _place_copy(rapids.get("SlalomRing_Bronze"), (-1.2, 1.45, -20.5), rot_t3=(0.0, 0.12, 0.0))
    _place_copy(rapids.get("RiverBoulder_A"), (4.0, 0.0, -12.0), rot_t3=(0.0, 0.7, 0.0), scale=1.15)
    _place_copy(rapids.get("RiverBoulder_B"), (-4.4, 0.0, -18.0), rot_t3=(0.0, 1.9, 0.0), scale=1.20)
    _place_copy(rapids.get("SupplyBuoy_Pelagian"), (3.1, 0.1, -8.5))
    _place_copy(rapids.get("HydroBoard_Hero"), (0.0, 0.14, -1.8), rot_t3=(0.04, -0.16, -0.08), scale=1.22)
    _import_gateway_preview((0.0, 0.24, -1.8), rot_t3=(0.0, math.pi + 0.45, 0.0), scale=1.28)

    _add_sun("SunKey", 4.2, (1.0, 0.92, 0.76), (-0.75, 0.55, 0.0))
    _add_area("HeroFill", 220.0, (0.78, 0.96, 1.0), (-3.5, 4.5, 5.5), (0.0, 1.0, -2.0), size=6.0)
    _add_cam(scene, (0.4, 3.4, 5.4), (0.2, 2.2, -16.0), lens=28.0)

    p1 = os.path.join(scratch_dir, "eevee_panel_1_rapids.png")
    scene.render.filepath = p1
    bpy.ops.render.render(write_still=True)
    panel_paths.append(p1)

    # ---- PANEL 2: REEF SWIM (Pelagian Underwater Grotto) ----
    scene = reset_scene()
    _setup_eevee(scene, panel_w, panel_h, exposure=0.22)
    _set_gradient_world(scene, "#063b54", "#0c829e", "#60e4f2", strength=1.45)

    reef = _import_glb_map(os.path.join(OUT_MODELS_DIR, "env_reef_grotto.glb"))
    _place_copy(reef.get("SeabedDune_Tile"), (-12.0, -3.55, -3.5))
    _place_copy(reef.get("SeabedDune_Tile"), ( 12.0, -3.55, -3.5))
    _place_copy(reef.get("GrottoArch_Vault"), ( 0.0, -3.4, -8.5), rot_t3=(0.0, 0.10, 0.0), scale=1.08)
    _place_copy(reef.get("GrottoArch_Vault"), (-7.2, -3.1, -17.5), rot_t3=(0.0, -0.22, 0.0), scale=1.24)
    _place_copy(reef.get("SunkenColumn_A"), (-5.5, -3.5, -4.4), scale=0.95)
    _place_copy(reef.get("SunkenColumn_B"), ( 5.7, -3.4, -4.6), rot_t3=(0.0, -0.4, 0.0), scale=1.0)
    _place_copy(reef.get("ReefOutcrop_Rock"), (-4.2, -3.6, -1.6), rot_t3=(0.0, 0.4, 0.0), scale=1.05)
    _place_copy(reef.get("ReefOutcrop_Rock"), ( 3.4, -3.5, -2.0), rot_t3=(0.0, -0.8, 0.0), scale=1.15)
    _place_copy(reef.get("ReefOutcrop_Rock"), (-0.5, -3.5, -3.2), rot_t3=(0.0, 1.2, 0.0), scale=0.92)
    # Lush real 3D coral gardens & ribbon kelp!
    _place_copy(reef.get("Coral_Staghorn"), (-3.9, -2.9, -1.2), scale=1.15)
    _place_copy(reef.get("Coral_Staghorn"), ( 4.2, -2.8, -1.8), rot_t3=(0.0, 1.4, 0.0), scale=1.22)
    _place_copy(reef.get("Coral_Table"), (-1.4, -3.1, -1.8), scale=1.18)
    _place_copy(reef.get("Coral_Table"), ( 2.2, -2.9, -2.2), rot_t3=(0.0, 2.1, 0.0), scale=1.05)
    _place_copy(reef.get("Coral_BrainDome"), (-2.6, -3.2, -0.8), scale=1.08)
    _place_copy(reef.get("Coral_BrainDome"), ( 1.0, -3.2, -1.1), rot_t3=(0.0, 1.6, 0.0), scale=1.12)
    _place_copy(reef.get("Coral_Anemone"), (-0.2, -3.2, -1.0), scale=1.10)
    _place_copy(reef.get("Coral_Anemone"), ( 5.1, -3.0, -1.2), rot_t3=(0.0, 0.9, 0.0), scale=1.05)
    _place_copy(reef.get("Kelp_Cluster"), (-5.6, -3.4, -2.5), scale=1.12)
    _place_copy(reef.get("Kelp_Cluster"), ( 6.1, -3.3, -2.8), rot_t3=(0.0, 1.2, 0.0), scale=1.18)
    _place_copy(reef.get("Kelp_Cluster"), ( 0.4, -3.3, -5.2), scale=1.25)
    _place_copy(reef.get("SunkenAmphora"), (-4.6, -3.35, -0.4), rot_t3=(0.0, 0.55, 0.0), scale=0.95)
    _place_copy(reef.get("HydroRing_Reef"), ( 2.6,  0.4, -0.4), rot_t3=(0.0, 0.52, 0.0), scale=1.12)
    _import_gateway_preview((-2.4, -0.3, 0.5), rot_t3=(0.95, math.pi * 0.5, 0.0), scale=1.35)

    _add_sun("ReefSun", 3.6, (0.88, 0.98, 1.0), (-1.15, 0.25, 0.0))
    _add_area("CausticTop", 420.0, (0.55, 0.96, 1.0), (0.0, 8.5, 1.5), (0.0, -2.5, -2.0), size=14.0)
    _add_area("WarmCoralFill", 180.0, (1.0, 0.88, 0.76), (-3.0, 1.5, 6.5), (0.0, -1.5, -2.0), size=8.0)
    _add_cam(scene, (0.0, 0.45, 9.8), (0.0, -0.65, -3.0), lens=31.0)

    p2 = os.path.join(scratch_dir, "eevee_panel_2_reef.png")
    scene.render.filepath = p2
    bpy.ops.render.render(write_still=True)
    panel_paths.append(p2)

    # ---- PANEL 3: FRILL GLIDE (Sky Canyon Sea-Stacks, Viaduct & Volumetric Clouds) ----
    scene = reset_scene()
    _setup_eevee(scene, panel_w, panel_h, exposure=0.22)
    _set_gradient_world(scene, "#fbd8a2", "#6cc4f4", "#1b62b5", strength=1.30)
    _make_water_plane("GlideOcean", 180.0, 160.0, -4.6, -34.0, col_hex="#109cb0", rough=0.10)

    sky = _import_glb_map(os.path.join(OUT_MODELS_DIR, "env_sky_canyon.glb"))
    _place_copy(sky.get("SeaStack_Mesa_A"), (-11.2, -4.6, -21.0), rot_t3=(0.0, 0.35, 0.0), scale=0.98)
    _place_copy(sky.get("SeaStack_Spire_B"), ( 12.2, -4.6, -24.5), rot_t3=(0.0, -0.45, 0.0), scale=1.08)
    _place_copy(sky.get("Viaduct_SkyBridge"), ( 0.8, -4.6, -18.0), rot_t3=(0.0, -0.10, 0.0), scale=0.94)
    _place_copy(sky.get("Cumulus_Cloud_A"), (-11.5,  8.6, -24.5), scale=1.55)
    _place_copy(sky.get("Cumulus_Cloud_B"), ( 11.2,  9.2, -26.5), scale=1.65)
    _place_copy(sky.get("Cumulus_Cloud_A"), (  0.6, 10.6, -36.0), rot_t3=(0.0, 0.4, 0.0), scale=2.25)
    _place_copy(sky.get("StormCloud_Sculpted"), ( 6.8,  4.2, -8.5), scale=1.05)
    _place_copy(sky.get("ThermalRing_Bronze"), ( 2.5,  1.2, -1.2), rot_t3=(0.0, 0.55, 0.0), scale=1.12)
    _place_copy(sky.get("ThermalRing_Bronze"), (-1.8,  2.3, -6.8), rot_t3=(0.0, 0.42, 0.0), scale=1.05)
    _place_copy(sky.get("ArrivalSpire_Distant"), ( 17.5, -4.8, -42.0), scale=1.15)
    _import_gateway_preview((-4.2, 1.5, 0.4), rot_t3=(1.15, math.pi * 0.5, 0.0), scale=1.32)

    _add_sun("GoldenSun", 4.4, (1.0, 0.90, 0.72), (-0.65, 0.58, 0.0))
    _add_area("SkyBounce", 320.0, (0.76, 0.92, 1.0), (-6.0, 8.0, 10.0), (0.0, 0.5, -8.0), size=12.0)
    _add_cam(scene, (0.0, 1.8, 12.2), (0.2, 1.5, -14.0), lens=28.0)

    p3 = os.path.join(scratch_dir, "eevee_panel_3_glide.png")
    scene.render.filepath = p3
    bpy.ops.render.render(write_still=True)
    panel_paths.append(p3)

    # Composite all 3 panels cleanly side-by-side (`2880x720`) with crisp 6px dark divider borders!
    arrays = []
    for pp in panel_paths:
        img = bpy.data.images.load(pp)
        buf = np.empty(panel_w * panel_h * 4, dtype=np.float32)
        img.pixels.foreach_get(buf)
        arrays.append(buf.reshape((panel_h, panel_w, 4)))
    div = np.full((panel_h, 6, 4), (0.03, 0.06, 0.10, 1.0), dtype=np.float32)
    sheet = np.concatenate([arrays[0], div, arrays[1], div, arrays[2]], axis=1)
    sh_h, sh_w, _ = sheet.shape
    os.makedirs(os.path.dirname(os.path.abspath(out_png)), exist_ok=True)
    comp = bpy.data.images.new("OutdoorsBeautySheet", width=sh_w, height=sh_h, alpha=False)
    comp.pixels.foreach_set(sheet.ravel())
    comp.filepath_raw = out_png
    comp.file_format = "PNG"
    comp.save()
    print(f"[BEAUTY] Saved 3-panel EEVEE beauty sheet: {out_png} ({sh_w}x{sh_h})")


# ==============================================================================
# MAIN ENTRYPOINT
# ==============================================================================

def main():
    argv = sys.argv
    extra = argv[argv.index("--") + 1:] if "--" in argv else []
    beauty_path = DEFAULT_BEAUTY_PATH
    report_path = DEFAULT_REPORT_PATH
    skip_beauty = "--no-beauty" in extra
    for idx, tok in enumerate(extra):
        if tok == "--beauty" and idx + 1 < len(extra):
            beauty_path = extra[idx + 1]
        elif tok == "--report" and idx + 1 < len(extra):
            report_path = extra[idx + 1]

    r_rapids = build_env_rapids_gorge()
    r_reef = build_env_reef_grotto()
    r_sky = build_env_sky_canyon()

    if not skip_beauty:
        render_3panel_beauty_sheet(beauty_path)

    report = {
        "ok": True,
        "beauty_sheet": None if skip_beauty else beauty_path,
        "kits": {
            "env_rapids_gorge": r_rapids,
            "env_reef_grotto": r_reef,
            "env_sky_canyon": r_sky,
        },
    }
    os.makedirs(os.path.dirname(os.path.abspath(report_path)), exist_ok=True)
    with open(report_path, "w", encoding="utf-8") as f:
        json.dump(report, f, indent=2)
    print("ENV_OUTDOORS_REPORT:", json.dumps(report))


if __name__ == "__main__":
    try:
        main()
    except Exception:
        err_path = os.path.join(os.path.dirname(DEFAULT_REPORT_PATH), "env_outdoors_error.txt")
        os.makedirs(os.path.dirname(err_path), exist_ok=True)
        with open(err_path, "w", encoding="utf-8") as ef:
            ef.write(traceback.format_exc())
        raise
