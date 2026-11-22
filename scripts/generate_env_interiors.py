"""
TOWERING WATERS: GATEWAY'S DESCENT — Blender 5.3 Interior Environments Pipeline
===============================================================================
Sculpts, UV-maps, vertex-AO bakes, exports GLB, and renders Blender EEVEE beauty
sheets for all 3 Pelagian Interior Architecture kits:

  1. `assets/models/env_core_reactor.glb` (<= 16k tris, < 2 MB)
     - `ShaftRing_Main`        : Tileable 12m carved-stone & bronze reactor shaft
     - `Turbine_Blades`        : 15m sculpted riveted bronze hydrofoil rotor
     - `PowerCore_Crystal`     : Brass-caged faceted aquamarine/gold crystal cluster
     - `BoostRing_Bronze`      : 2.6m beveled bronze & crystal speed-gate ring
     - `Shaft_BottomSanctuary` : Submerged bronze dome & glowing bedrock hydro-pool

  2. `assets/models/env_sanctum_temple.glb` (<= 18k tris, < 2.5 MB)
  3. `assets/models/env_vault_chamber.glb`  (<= 18k tris, < 2.5 MB)

Usage (Blender 5.3 headless):
  blender-launcher.exe -b -P scripts/generate_env_interiors.py -- --only core --render-core <png>
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
from mathutils import Vector, Matrix, Euler

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_DIR = os.path.dirname(SCRIPT_DIR)
ASSETS_TEX_DIR = os.path.join(PROJECT_DIR, "assets", "textures")
OUT_MODELS_DIR = os.path.join(PROJECT_DIR, "assets", "models")
TEMP_DIR = os.path.join(tempfile.gettempdir(), "tw_env_interiors_v1")

os.makedirs(OUT_MODELS_DIR, exist_ok=True)
os.makedirs(TEMP_DIR, exist_ok=True)

TAU = math.pi * 2.0


# ==============================================================================
# COORDINATE, COLOR & SCENE HELPERS (Three.js Y-up <-> Blender Z-up)
# ==============================================================================

def v3(tx, ty, tz):
    """Converts Three.js (x, y_up, z_fwd) -> Blender (x, -z_fwd, y_up)."""
    return Vector((float(tx), -float(tz), float(ty)))


def bl_to_t3(vec):
    """Converts Blender (bx, by, bz) -> Three.js (bx, bz, -by)."""
    return (float(vec.x), float(vec.z), float(-vec.y))


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
# PBR TEXTURE & MATERIAL LIBRARY (LOCAL `assets/textures/arch_*` + HAMMERED BRONZE)
# ==============================================================================

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


def _rgb_to_packed_image(name, rgb_arr, non_color=False):
    h, w, _ = rgb_arr.shape
    arr = np.clip(rgb_arr, 0.0, 1.0)
    rgba = np.ones((h, w, 4), dtype=np.float32)
    rgba[:, :, :3] = arr[::-1, :, :]
    img = bpy.data.images.new(name, width=w, height=h, alpha=False, float_buffer=False)
    img.colorspace_settings.name = "Non-Color" if non_color else "sRGB"
    img.pixels.foreach_set(rgba.ravel())
    tmp_path = os.path.join(TEMP_DIR, f"{name}.png")
    img.filepath_raw = tmp_path
    img.file_format = "PNG"
    img.save()
    img.pack()
    return img


def load_arch_image(filename, non_color=False, max_dim=None):
    path = os.path.join(ASSETS_TEX_DIR, filename)
    if not os.path.isfile(path):
        raise FileNotFoundError(f"Missing texture: {path}")
    img = bpy.data.images.load(path, check_existing=True)
    img.colorspace_settings.name = "Non-Color" if non_color else "sRGB"
    if max_dim is not None and (img.size[0] > max_dim or img.size[1] > max_dim):
        img.scale(max_dim, max_dim)
    try:
        img.pack()
    except Exception:
        pass
    return img


def bake_hammered_bronze_bundle(name="hammered_bronze", base_hex="#dfa64c", dark_hex="#7c4f1d", patina_hex="#3a7d76", sz=256):
    """Bakes clean brushed/hammered Pelagian bronze with subtle patina for machined blades/rings."""
    n1 = _fbm(sz, 4, 4, 313)
    n2 = _fbm(sz, 8, 3, 521)
    u = np.linspace(0.0, 1.0, sz, endpoint=False, dtype=np.float32)
    yy, xx = np.meshgrid(u, u, indexing="ij")
    brush = 0.5 + 0.5 * np.sin(yy * math.pi * 24.0 + n1 * 4.2)
    patina = np.clip((0.36 - n1) * 2.4, 0.0, 1.0) * 0.24

    c_dark = hex_rgb(dark_hex)
    c_base = hex_rgb(base_hex)
    c_pat = hex_rgb(patina_hex)
    t = np.clip(0.32 + 0.52 * n1 + 0.16 * brush, 0.0, 1.0)[..., None]
    alb = c_dark * (1.0 - t) + c_base * t
    alb = alb * (1.0 - patina[..., None]) + c_pat * patina[..., None]

    hmap = 0.5 + n1 * 0.18 + n2 * 0.08 + brush * 0.03
    dx = (np.roll(hmap, -1, axis=1) - np.roll(hmap, 1, axis=1)) * 1.4
    dy = (np.roll(hmap, -1, axis=0) - np.roll(hmap, 1, axis=0)) * 1.4
    inv = 1.0 / np.sqrt(dx * dx + dy * dy + 1.0)
    nrm = np.stack([0.5 - 0.5 * dx * inv, 0.5 + 0.5 * dy * inv, 0.5 + 0.5 * inv], axis=-1)

    ao = np.clip(0.86 + (n1 - 0.5) * 0.22, 0.65, 1.0)
    rgh = np.clip(0.22 + (1.0 - n1) * 0.16 + patina * 0.35, 0.16, 0.58)
    met = np.clip(0.88 - patina * 0.45, 0.45, 0.92)
    orm = np.stack([ao, rgh, met], axis=-1)

    return {
        "albedo": _rgb_to_packed_image(f"{name}_albedo", alb, non_color=False),
        "normal": _rgb_to_packed_image(f"{name}_normal", np.clip(nrm, 0.0, 1.0), non_color=True),
        "orm": _rgb_to_packed_image(f"{name}_orm", orm, non_color=True),
    }


def make_arch_pbr_mat(
    name,
    prefix=None,
    tex_bundle=None,
    tint_hex="#ffffff",
    roughness_mul=1.0,
    roughness_val=0.58,
    metallic_val=0.05,
    normal_strength=1.05,
    emission_hex=None,
    emission_strength=0.0,
    use_vertex_ao=True,
    double_sided=False,
    alb_dim=384,
    nrm_dim=320,
    orm_dim=192,
):
    """Creates a glTF-2.0-compliant Principled PBR material with arch_* maps + Vertex Color AO."""
    mat = bpy.data.materials.new(name=name)
    mat.use_nodes = True
    mat.use_backface_culling = not double_sided
    nt = mat.node_tree
    bsdf = nt.nodes.get("Principled BSDF")

    alb_img = None
    nrm_img = None
    orm_img = None
    if prefix is not None:
        alb_img = load_arch_image(f"{prefix}_albedo.webp", non_color=False, max_dim=alb_dim)
        nrm_path = os.path.join(ASSETS_TEX_DIR, f"{prefix}_normal.webp")
        orm_path = os.path.join(ASSETS_TEX_DIR, f"{prefix}_orm.webp")
        if os.path.isfile(nrm_path):
            nrm_img = load_arch_image(f"{prefix}_normal.webp", non_color=True, max_dim=nrm_dim)
        if os.path.isfile(orm_path):
            orm_img = load_arch_image(f"{prefix}_orm.webp", non_color=True, max_dim=orm_dim)
    elif tex_bundle is not None:
        alb_img = tex_bundle.get("albedo")
        nrm_img = tex_bundle.get("normal")
        orm_img = tex_bundle.get("orm")

    tint = hex_lin(tint_hex)
    bsdf.inputs["Base Color"].default_value = (tint[0], tint[1], tint[2], 1.0)
    bsdf.inputs["Roughness"].default_value = roughness_val
    bsdf.inputs["Metallic"].default_value = metallic_val

    color_out = None
    if alb_img is not None:
        ta = nt.nodes.new("ShaderNodeTexImage")
        ta.image = alb_img
        color_out = ta.outputs["Color"]

        if tint_hex.lower() != "#ffffff":
            mix_t = nt.nodes.new("ShaderNodeMix")
            mix_t.data_type = "RGBA"
            mix_t.blend_type = "MULTIPLY"
            mix_t.inputs["Factor"].default_value = 1.0
            mix_t.inputs[7].default_value = (tint[0], tint[1], tint[2], 1.0)
            nt.links.new(color_out, mix_t.inputs[6])
            color_out = mix_t.outputs[2]

    if use_vertex_ao:
        vc = nt.nodes.new("ShaderNodeVertexColor")
        vc.layer_name = "Col"
        if color_out is not None:
            mix_ao = nt.nodes.new("ShaderNodeMix")
            mix_ao.data_type = "RGBA"
            mix_ao.blend_type = "MULTIPLY"
            mix_ao.inputs["Factor"].default_value = 1.0
            nt.links.new(color_out, mix_ao.inputs[6])
            nt.links.new(vc.outputs["Color"], mix_ao.inputs[7])
            nt.links.new(mix_ao.outputs[2], bsdf.inputs["Base Color"])
        else:
            mix_ao = nt.nodes.new("ShaderNodeMix")
            mix_ao.data_type = "RGBA"
            mix_ao.blend_type = "MULTIPLY"
            mix_ao.inputs["Factor"].default_value = 1.0
            mix_ao.inputs[6].default_value = (tint[0], tint[1], tint[2], 1.0)
            nt.links.new(vc.outputs["Color"], mix_ao.inputs[7])
            nt.links.new(mix_ao.outputs[2], bsdf.inputs["Base Color"])
    elif color_out is not None:
        nt.links.new(color_out, bsdf.inputs["Base Color"])

    if orm_img is not None:
        to = nt.nodes.new("ShaderNodeTexImage")
        to.image = orm_img
        sep = nt.nodes.new("ShaderNodeSeparateColor")
        if hasattr(sep, "mode"):
            sep.mode = "RGB"
        nt.links.new(to.outputs["Color"], sep.inputs["Color"])
        if abs(roughness_mul - 1.0) > 0.01:
            math_r = nt.nodes.new("ShaderNodeMath")
            math_r.operation = "MULTIPLY"
            math_r.use_clamp = True
            math_r.inputs[1].default_value = roughness_mul
            nt.links.new(sep.outputs["Green"], math_r.inputs[0])
            nt.links.new(math_r.outputs["Value"], bsdf.inputs["Roughness"])
        else:
            nt.links.new(sep.outputs["Green"], bsdf.inputs["Roughness"])
        nt.links.new(sep.outputs["Blue"], bsdf.inputs["Metallic"])

    if nrm_img is not None:
        tn = nt.nodes.new("ShaderNodeTexImage")
        tn.image = nrm_img
        nn = nt.nodes.new("ShaderNodeNormalMap")
        nn.inputs["Strength"].default_value = normal_strength
        nt.links.new(tn.outputs["Color"], nn.inputs["Color"])
        nt.links.new(nn.outputs["Normal"], bsdf.inputs["Normal"])

    if emission_hex is not None and emission_strength > 0.0:
        ecol = hex_lin(emission_hex)
        if "Emission Color" in bsdf.inputs:
            bsdf.inputs["Emission Color"].default_value = (ecol[0], ecol[1], ecol[2], 1.0)
            bsdf.inputs["Emission Strength"].default_value = emission_strength

    return mat


# ==============================================================================
# BMESH SCULPTING, TRIPLANAR/CYLINDRICAL UV & VERTEX AO UTILITIES
# ==============================================================================

def assign_box_uvs(bm, scale=0.35):
    """Clean world-scale triplanar UVs with zero stretching on sculpted stone/bronze."""
    uv_layer = bm.loops.layers.uv.verify()
    for f in bm.faces:
        n = f.normal
        ax, ay, az = abs(n.x), abs(n.y), abs(n.z)
        for lp in f.loops:
            c = lp.vert.co
            if az >= ax and az >= ay:
                u, v = c.x * scale, c.y * scale
            elif ax >= ay:
                u, v = c.y * scale, c.z * scale
            else:
                u, v = c.x * scale, c.z * scale
            lp[uv_layer].uv = (u, v)


def paint_vertex_ao(bm, ao_fn):
    """Paints baked Vertex AO & subtle tonal variation into Face Corner color layer 'Col'."""
    col_layer = bm.loops.layers.color.verify()
    for f in bm.faces:
        fn_t3 = bl_to_t3(f.normal)
        for lp in f.loops:
            pt_t3 = bl_to_t3(lp.vert.co)
            c = ao_fn(pt_t3, fn_t3, f.material_index)
            if isinstance(c, (int, float)):
                v = max(0.0, min(1.0, float(c)))
                lp[col_layer] = (v, v, v, 1.0)
            else:
                lp[col_layer] = (
                    max(0.0, min(1.0, float(c[0]))),
                    max(0.0, min(1.0, float(c[1]))),
                    max(0.0, min(1.0, float(c[2]))),
                    1.0,
                )


def finalize_mesh(
    name,
    bm,
    materials,
    pos=(0.0, 0.0, 0.0),
    rot=(0.0, 0.0, 0.0),
    parent=None,
    uv_scale=0.32,
    ao_fn=None,
    smooth=False,
    keep_uvs=False,
    recalc_normals=True,
    flip_normals=False,
):
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-4)
    if recalc_normals:
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    if flip_normals:
        bmesh.ops.reverse_faces(bm, faces=bm.faces)
    if not keep_uvs:
        assign_box_uvs(bm, scale=uv_scale)
    if ao_fn is not None:
        paint_vertex_ao(bm, ao_fn)
    else:
        paint_vertex_ao(bm, lambda p, n, m: 1.0)

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


def _copy_bmesh_into(dst_bm, src_bm, mat_idx=0):
    vmap = {v: dst_bm.verts.new(v.co) for v in src_bm.verts}
    out = []
    for f in src_bm.faces:
        try:
            nf = dst_bm.faces.new([vmap[v] for v in f.verts])
            nf.material_index = mat_idx
            out.append(nf)
        except ValueError:
            pass
    return out


def add_bevel_box(bm, center_t3, size_t3, bevel=0.04, segs=1, rot_t3=(0.0, 0.0, 0.0), mat_idx=0):
    tb = bmesh.new()
    bmesh.ops.create_cube(tb, size=1.0)
    sx, sy, sz = size_t3
    bmesh.ops.scale(tb, vec=(sx, sz, sy), verts=tb.verts)
    if bevel > 0.0:
        max_b = min(sx, sy, sz) * 0.42
        bmesh.ops.bevel(tb, geom=list(tb.edges), offset=min(bevel, max_b), segments=segs, profile=0.5, affect="EDGES")
    if any(abs(a) > 1e-6 for a in rot_t3):
        rmat = rot3(*rot_t3).to_matrix()
        bmesh.ops.rotate(tb, cent=(0.0, 0.0, 0.0), matrix=rmat, verts=tb.verts)
    bmesh.ops.translate(tb, vec=v3(*center_t3), verts=tb.verts)
    faces = _copy_bmesh_into(bm, tb, mat_idx=mat_idx)
    tb.free()
    return faces


def add_cylinder(bm, center_t3, r_bot, r_top, height, segs=16, rot_t3=(0.0, 0.0, 0.0), cap=True, mat_idx=0, bevel=0.0):
    tb = bmesh.new()
    bmesh.ops.create_cone(
        tb,
        cap_ends=cap,
        cap_tris=False,
        segments=segs,
        radius1=r_bot,
        radius2=r_top,
        depth=height,
    )
    if bevel > 0.0 and cap:
        cap_edges = [e for e in tb.edges if abs(e.verts[0].co.z - e.verts[1].co.z) < 1e-4]
        if cap_edges:
            bmesh.ops.bevel(tb, geom=cap_edges, offset=bevel, segments=1, profile=0.5, affect="EDGES")
    if any(abs(a) > 1e-6 for a in rot_t3):
        rmat = rot3(*rot_t3).to_matrix()
        bmesh.ops.rotate(tb, cent=(0.0, 0.0, 0.0), matrix=rmat, verts=tb.verts)
    bmesh.ops.translate(tb, vec=v3(*center_t3), verts=tb.verts)
    faces = _copy_bmesh_into(bm, tb, mat_idx=mat_idx)
    tb.free()
    return faces


def add_loft_rings(bm, rings_t3, closed=True, cap_start=False, cap_end=False, mat_idx=0, invert=False):
    v_rings = [[bm.verts.new(v3(*p)) for p in ring] for ring in rings_t3]
    created = []
    for i in range(len(v_rings) - 1):
        r0, r1 = v_rings[i], v_rings[i + 1]
        n = len(r0)
        lim = n if closed else (n - 1)
        m_i = mat_idx[i] if isinstance(mat_idx, (list, tuple)) else mat_idx
        for j in range(lim):
            jn = (j + 1) % n
            verts = [r0[j], r1[j], r1[jn], r0[jn]] if invert else [r0[j], r0[jn], r1[jn], r1[j]]
            try:
                f = bm.faces.new(verts)
                f.material_index = m_i
                created.append(f)
            except ValueError:
                pass
    if closed and len(v_rings[0]) >= 3:
        m_s = mat_idx[0] if isinstance(mat_idx, (list, tuple)) else mat_idx
        m_e = mat_idx[-1] if isinstance(mat_idx, (list, tuple)) else mat_idx
        if cap_start:
            c0 = sum((v.co for v in v_rings[0]), Vector()) / len(v_rings[0])
            vc0 = bm.verts.new(c0)
            r0 = v_rings[0]
            n = len(r0)
            for j in range(n):
                jn = (j + 1) % n
                verts = [vc0, r0[j], r0[jn]] if invert else [vc0, r0[jn], r0[j]]
                try:
                    f = bm.faces.new(verts)
                    f.material_index = m_s
                    created.append(f)
                except ValueError:
                    pass
        if cap_end:
            c1 = sum((v.co for v in v_rings[-1]), Vector()) / len(v_rings[-1])
            vc1 = bm.verts.new(c1)
            r1 = v_rings[-1]
            n = len(r1)
            for j in range(n):
                jn = (j + 1) % n
                verts = [vc1, r1[jn], r1[j]] if invert else [vc1, r1[j], r1[jn]]
                try:
                    f = bm.faces.new(verts)
                    f.material_index = m_e
                    created.append(f)
                except ValueError:
                    pass
    return created


def add_profile_torus(bm, center_t3, major_r, profile_2d, segs_u=32, rot_t3=(0.0, 0.0, 0.0), mat_idx=0):
    """Sweeps a custom 2D (dr, dy) cross-section around a circle in the XZ plane (axis +Y)."""
    rmat = rot3(*rot_t3).to_matrix() if any(abs(a) > 1e-6 for a in rot_t3) else Matrix.Identity(3)
    c_bl = v3(*center_t3)
    nv = len(profile_2d)
    rings = []
    for iu in range(segs_u):
        au = (TAU * iu) / segs_u
        cu, su = math.cos(au), math.sin(au)
        ring = []
        for dr, dy in profile_2d:
            r = major_r + dr
            p_bl = rmat @ v3(r * cu, dy, r * su) + c_bl
            ring.append(bm.verts.new(p_bl))
        rings.append(ring)
    created = []
    for iu in range(segs_u):
        r0 = rings[iu]
        r1 = rings[(iu + 1) % segs_u]
        for iv in range(nv):
            ivn = (iv + 1) % nv
            m_i = mat_idx[iv] if isinstance(mat_idx, (list, tuple)) else mat_idx
            try:
                f = bm.faces.new([r0[iv], r0[ivn], r1[ivn], r1[iv]])
                f.material_index = m_i
                created.append(f)
            except ValueError:
                pass
    return created


def add_torus(bm, center_t3, major_r, minor_r, segs_u=28, segs_v=8, rot_t3=(0.0, 0.0, 0.0), mat_idx=0):
    prof = [
        (minor_r * math.cos((TAU * iv) / segs_v), minor_r * math.sin((TAU * iv) / segs_v))
        for iv in range(segs_v)
    ]
    return add_profile_torus(bm, center_t3, major_r, prof, segs_u=segs_u, rot_t3=rot_t3, mat_idx=mat_idx)


def add_faceted_crystal(bm, base_t3, tip_dir_t3, length, radius, sides=6, tip_ratio=0.28, base_tip_ratio=0.18, mat_idx=0):
    """Sculpts a crisp doubly-terminated faceted Pelagian quartz crystal spire."""
    d = Vector(tip_dir_t3).normalized()
    up = Vector((0.0, 1.0, 0.0)) if abs(d.y) < 0.9 else Vector((1.0, 0.0, 0.0))
    u = d.cross(up).normalized()
    v = d.cross(u).normalized()
    b0 = Vector(base_t3)

    p_bot = b0 - d * (length * base_tip_ratio)
    p_low = b0
    p_hi = b0 + d * (length * (1.0 - tip_ratio))
    p_top = b0 + d * length

    v_bot = bm.verts.new(v3(*p_bot))
    v_top = bm.verts.new(v3(*p_top))
    r_low = []
    r_hi = []
    for k in range(sides):
        a = (TAU * k) / sides
        rad_k = radius * (1.0 + 0.08 * ((k % 2) * 2 - 1))
        off_l = (u * math.cos(a) + v * math.sin(a)) * rad_k
        off_h = (u * math.cos(a + 0.06) + v * math.sin(a + 0.06)) * (rad_k * 0.86)
        r_low.append(bm.verts.new(v3(*(p_low + off_l))))
        r_hi.append(bm.verts.new(v3(*(p_hi + off_h))))

    created = []
    for k in range(sides):
        kn = (k + 1) % sides
        for verts in (
            [r_low[k], r_low[kn], r_hi[kn], r_hi[k]],
            [r_hi[k], r_hi[kn], v_top],
            [r_low[kn], r_low[k], v_bot],
        ):
            try:
                f = bm.faces.new(verts)
                f.material_index = mat_idx
                created.append(f)
            except ValueError:
                pass
    return created


def export_glb_and_inspect(filepath, img_quality=76):
    """Exports active scene as glTF 2.0 GLB (WEBP textures + Vertex Color AO) & inspects every named mesh."""
    bpy.ops.export_scene.gltf(
        filepath=filepath,
        export_format="GLB",
        export_yup=True,
        export_apply=False,
        export_texcoords=True,
        export_normals=True,
        export_materials="EXPORT",
        export_image_format="WEBP",
        export_image_quality=img_quality,
        export_vertex_color="MATERIAL",
    )
    size_bytes = os.path.getsize(filepath)
    with open(filepath, "rb") as f:
        _, _, _ = struct.unpack("<III", f.read(12))
        chunk_len, _ = struct.unpack("<II", f.read(8))
        gltf_json = json.loads(f.read(chunk_len).decode("utf-8"))

    accs = gltf_json.get("accessors", [])
    total_tris = 0
    has_color0 = False
    for mesh in gltf_json.get("meshes", []):
        for prim in mesh.get("primitives", []):
            attrs = prim.get("attributes", {})
            if "COLOR_0" in attrs:
                has_color0 = True
            if "indices" in prim:
                total_tris += accs[prim["indices"]]["count"] // 3
            elif "POSITION" in attrs:
                total_tris += accs[attrs["POSITION"]]["count"] // 3

    bpy.context.view_layer.update()
    mesh_report = {}
    for obj in bpy.context.scene.objects:
        if obj.type != "MESH":
            continue
        mw = obj.matrix_world
        xs, ys, zs = [], [], []
        for corner in obj.bound_box:
            wc = mw @ Vector(corner)
            tx, ty, tz = bl_to_t3(wc)
            xs.append(tx)
            ys.append(ty)
            zs.append(tz)
        obj_tris = sum(max(0, len(p.vertices) - 2) for p in obj.data.polygons)
        mesh_report[obj.name] = {
            "triangles": obj_tris,
            "bbox_min": [round(min(xs), 3), round(min(ys), 3), round(min(zs), 3)],
            "bbox_max": [round(max(xs), 3), round(max(ys), 3), round(max(zs), 3)],
            "size": [round(max(xs) - min(xs), 3), round(max(ys) - min(ys), 3), round(max(zs) - min(zs), 3)],
        }

    return {
        "file": os.path.basename(filepath),
        "bytes": size_bytes,
        "mb": round(size_bytes / (1024 * 1024), 3),
        "triangles": total_tris,
        "images": len(gltf_json.get("images", [])),
        "has_vertex_ao": has_color0,
        "materials": [m.get("name", "") for m in gltf_json.get("materials", [])],
        "meshes": mesh_report,
    }


# ==============================================================================
# MILESTONE 1A — PRIORITY #1: `assets/models/env_core_reactor.glb`
# ==============================================================================

def build_env_core_reactor():
    """Builds the 5 modular sculpted Pelagian Core Reactor meshes cleanly centered at (0,0,0)."""
    reset_scene()

    # Shared PBR Materials (warm canyon sandstone + dark storm basalt + antique/machined bronze + luminous aqua/amber)
    hammered_bronze = bake_hammered_bronze_bundle("core_machined_bronze", "#e4ae52", "#7a4c1b", "#2d7c74", sz=192)

    mat_sandstone = make_arch_pbr_mat(
        "Mat_Core_Sandstone",
        prefix="arch_canyon_sandstone",
        tint_hex="#f7dec2",
        roughness_mul=0.92,
        normal_strength=1.20,
        use_vertex_ao=True,
        alb_dim=384,
        nrm_dim=256,
        orm_dim=160,
    )
    mat_basalt = make_arch_pbr_mat(
        "Mat_Core_Basalt",
        prefix="arch_storm_basalt",
        tint_hex="#8da7bc",
        roughness_mul=0.88,
        normal_strength=1.25,
        use_vertex_ao=True,
        alb_dim=384,
        nrm_dim=256,
        orm_dim=160,
    )
    mat_bronze_ornate = make_arch_pbr_mat(
        "Mat_Core_Bronze_Ornate",
        prefix="arch_antique_bronze",
        tint_hex="#f6cc78",
        roughness_mul=0.78,
        normal_strength=1.10,
        use_vertex_ao=True,
        alb_dim=320,
        nrm_dim=256,
        orm_dim=160,
    )
    mat_bronze_mach = make_arch_pbr_mat(
        "Mat_Core_Bronze_Machined",
        tex_bundle=hammered_bronze,
        tint_hex="#ffdf9c",
        roughness_mul=0.92,
        normal_strength=1.0,
        use_vertex_ao=True,
    )
    mat_aqua_glow = make_arch_pbr_mat(
        "Mat_Core_AquaConduit",
        tint_hex="#2ae8dc",
        roughness_val=0.14,
        metallic_val=0.14,
        emission_hex="#14d8cc",
        emission_strength=1.85,
        use_vertex_ao=True,
    )
    mat_amber_glow = make_arch_pbr_mat(
        "Mat_Core_AmberHazard",
        tint_hex="#ffc648",
        roughness_val=0.16,
        metallic_val=0.22,
        emission_hex="#ff9218",
        emission_strength=1.95,
        use_vertex_ao=True,
    )
    mat_pool = make_arch_pbr_mat(
        "Mat_Core_HydroPool",
        tint_hex="#0c8ba6",
        roughness_val=0.10,
        metallic_val=0.28,
        emission_hex="#0db8c4",
        emission_strength=0.85,
        use_vertex_ao=True,
    )

    core_mats = [
        mat_sandstone,      # 0
        mat_basalt,         # 1
        mat_bronze_ornate,  # 2
        mat_bronze_mach,    # 3
        mat_aqua_glow,      # 4
        mat_amber_glow,     # 5
        mat_pool,           # 6
    ]

    # ------------------------------------------------------------------
    # 1. `ShaftRing_Main` — 12m vertically tileable curved hydro-reactor shaft
    #    Axis: +Y, Y in [-6.0, +6.0], Inner clear bore ~8.4m, Wall R ~9.5m
    # ------------------------------------------------------------------
    bm = bmesh.new()
    H = 12.0

    # 1a. Stepped 24-sided inward-facing carved stone enclosure (bold alternating sandstone & basalt courses!)
    n_rad = 24
    course_profile = [
        (-6.00, 9.54, 1),
        (-5.25, 9.54, 1),
        (-5.10, 9.26, 0),
        (-3.20, 9.26, 0),
        (-3.05, 9.58, 1),
        (-0.85, 9.58, 1),
        (-0.70, 9.26, 0),
        (0.70, 9.26, 0),
        (0.85, 9.58, 1),
        (3.05, 9.58, 1),
        (3.20, 9.26, 0),
        (5.10, 9.26, 0),
        (5.25, 9.54, 1),
        (6.00, 9.54, 1),
    ]
    wall_rings = []
    wall_mats = []
    for idx_c, (cy, cr, cm) in enumerate(course_profile):
        ring = []
        for s in range(n_rad):
            a = (TAU * s) / n_rad
            r_mod = cr + (0.04 if (s % 2 == 0 and cm == 0) else 0.0)
            ring.append((math.cos(a) * r_mod, cy, math.sin(a) * r_mod))
        wall_rings.append(ring)
        if idx_c < len(course_profile) - 1:
            wall_mats.append(cm)
    wall_faces = add_loft_rings(bm, wall_rings, closed=True, cap_start=False, cap_end=False, mat_idx=wall_mats, invert=False)
    for f in wall_faces:
        fc = f.calc_center_median()
        rad_out = Vector((fc.x, fc.y, 0.0))
        if f.normal.dot(rad_out) > 0.0:
            f.normal_flip()

    # 1b. 12 Sculpted Architectural Masonry Buttress Ribs (every 30 deg, seamless Y=-6..+6)
    for k in range(12):
        ang = (TAU * k) / 12.0
        ca, sa = math.cos(ang), math.sin(ang)
        rot_y = -ang

        add_bevel_box(bm, (ca * 9.02, 0.0, sa * 9.02), (1.12, H, 0.88), bevel=0.09, segs=1, rot_t3=(0.0, rot_y, 0.0), mat_idx=0)
        add_bevel_box(bm, (ca * 8.44, 0.0, sa * 8.44), (0.30, H, 0.42), bevel=0.0, rot_t3=(0.0, rot_y, 0.0), mat_idx=1)
        for cy in (-3.8, 0.0, 3.8):
            add_bevel_box(bm, (ca * 8.56, cy, sa * 8.56), (0.76, 0.58, 1.06), bevel=0.0, rot_t3=(0.0, rot_y, 0.0), mat_idx=1)
            add_bevel_box(bm, (ca * 8.40, cy, sa * 8.40), (0.44, 0.26, 1.16), bevel=0.0, rot_t3=(0.0, rot_y, 0.0), mat_idx=3)

    # 1c. 6 Recessed Glowing Turquoise Aqueduct Glass Conduits (alternating 60 deg bays)
    for k in range(6):
        ang = (TAU * (k * 2 + 0.5)) / 12.0
        ca, sa = math.cos(ang), math.sin(ang)
        tx, tz = -sa, ca
        rot_y = -ang

        add_bevel_box(bm, (ca * 9.32, 0.0, sa * 9.32), (0.38, H, 1.40), bevel=0.0, rot_t3=(0.0, rot_y, 0.0), mat_idx=1)
        for side in (-0.36, 0.36):
            px = ca * 8.96 + tx * side
            pz = sa * 8.96 + tz * side
            add_cylinder(bm, (px, 0.0, pz), 0.22, 0.22, H, segs=6, cap=False, mat_idx=4)

        for cy in (-3.8, 0.0, 3.8):
            add_bevel_box(bm, (ca * 8.92, cy, sa * 8.92), (0.50, 0.36, 1.48), bevel=0.04, rot_t3=(0.0, rot_y, 0.0), mat_idx=3)
            add_bevel_box(bm, (ca * 8.64, cy, sa * 8.64), (0.14, 0.24, 0.24), bevel=0.0, rot_t3=(0.0, rot_y, 0.0), mat_idx=5)

    # 1d. 6 Bays x 2 Tiers = 12 Sculpted Arched Bronze Maintenance Alcoves (in alternating 60 deg bays)
    for k in range(6):
        ang = (TAU * (k * 2 + 1.5)) / 12.0
        ca, sa = math.cos(ang), math.sin(ang)
        tx, tz = -sa, ca
        rot_y = -ang

        for tier_y in (-3.0, 3.0):
            add_bevel_box(bm, (ca * 9.40, tier_y, sa * 9.40), (0.26, 3.10, 2.32), bevel=0.0, rot_t3=(0.0, rot_y, 0.0), mat_idx=1)
            for side in (-1.04, 1.04):
                add_bevel_box(
                    bm,
                    (ca * 9.04 + tx * side, tier_y - 0.24, sa * 9.04 + tz * side),
                    (0.56, 2.52, 0.38),
                    bevel=0.0,
                    rot_t3=(0.0, rot_y, 0.0),
                    mat_idx=0,
                )
            for vi in range(5):
                va = (vi / 4.0) * math.pi
                vx_tan = math.cos(va) * 0.96
                vy_off = 0.92 + math.sin(va) * 0.62
                is_key = (vi == 2)
                add_bevel_box(
                    bm,
                    (ca * (8.92 if is_key else 9.02) + tx * vx_tan, tier_y + vy_off, sa * (8.92 if is_key else 9.02) + tz * vx_tan),
                    (0.64 if is_key else 0.50, 0.44 if is_key else 0.34, 0.46 if is_key else 0.42),
                    bevel=0.04 if is_key else 0.0,
                    rot_t3=(va - math.pi * 0.5, rot_y, 0.0),
                    mat_idx=2 if is_key else 0,
                )
            add_bevel_box(bm, (ca * 8.84, tier_y - 1.48, sa * 8.84), (0.92, 0.24, 2.38), bevel=0.0, rot_t3=(0.0, rot_y, 0.0), mat_idx=2)
            add_bevel_box(bm, (ca * 8.52, tier_y - 0.88, sa * 8.52), (0.10, 0.10, 2.15), bevel=0.0, rot_t3=(0.0, rot_y, 0.0), mat_idx=3)
            for b_off in (-0.58, 0.58):
                add_bevel_box(bm, (ca * 8.54 + tx * b_off, tier_y - 1.18, sa * 8.54 + tz * b_off), (0.09, 0.58, 0.09), bevel=0.0, rot_t3=(0.0, rot_y, 0.0), mat_idx=3)
            add_bevel_box(bm, (ca * 8.90, tier_y + 0.88, sa * 8.90), (0.24, 0.36, 0.24), bevel=0.0, rot_t3=(0.0, rot_y, 0.0), mat_idx=5)

    # 1e. 3 Monumental Riveted Copper/Bronze Structural Pipe Rings (Y = -5.72, 0.0, +5.72)
    pipe_prof = [(0.26, -0.11), (0.26, 0.11), (0.11, 0.26), (-0.11, 0.26), (-0.26, 0.11), (-0.26, -0.11), (-0.11, -0.26), (0.11, -0.26)]
    for ry in (-5.72, 0.0, 5.72):
        add_profile_torus(bm, (0.0, ry, 0.0), 8.86, pipe_prof, segs_u=28, mat_idx=2 if ry == 0.0 else 3)

    def shaft_ao(pt, nrm, mat_idx):
        x, y, z = pt
        r = math.hypot(x, z)
        if mat_idx in (4, 5):
            return (1.0, 1.0, 1.0)
        r_ao = max(0.50, min(1.0, 1.02 - max(0.0, r - 8.45) * 0.42))
        seam_d = min(abs(y), abs(abs(y) - 5.72), abs(abs(y) - 3.8))
        seam_ao = 0.80 + 0.20 * min(1.0, seam_d / 0.55)
        up_warm = 0.92 + 0.08 * max(-1.0, min(1.0, nrm[1]))
        v = r_ao * seam_ao * up_warm
        return (v, v * 0.99, v * 0.96)

    finalize_mesh("ShaftRing_Main", bm, core_mats, uv_scale=0.22, ao_fn=shaft_ao, smooth=False, recalc_normals=False)

    # ------------------------------------------------------------------
    # 2. `Turbine_Blades` — 15m sculpted riveted antique-bronze hydrofoil rotor
    #    Axis: +Y, Span diameter ~15.0m (R=7.5m), Centered at (0,0,0)
    # ------------------------------------------------------------------
    bm = bmesh.new()

    add_cylinder(bm, (0.0, 0.0, 0.0), 1.48, 1.48, 1.32, segs=16, bevel=0.08, mat_idx=3)
    add_cylinder(bm, (0.0, 0.0, 0.0), 1.62, 1.62, 0.52, segs=16, bevel=0.05, mat_idx=2)
    add_cylinder(bm, (0.0, 0.84, 0.0), 1.18, 0.64, 0.42, segs=14, mat_idx=3)
    add_cylinder(bm, (0.0, -0.84, 0.0), 0.64, 1.18, 0.42, segs=14, mat_idx=3)
    add_cylinder(bm, (0.0, 1.06, 0.0), 0.54, 0.46, 0.14, segs=10, mat_idx=4)
    add_cylinder(bm, (0.0, -1.06, 0.0), 0.46, 0.54, 0.14, segs=10, mat_idx=4)
    for t_i in range(12):
        ta = (TAU * t_i) / 12.0
        for ty in (-0.54, 0.54):
            add_bevel_box(bm, (math.cos(ta) * 1.56, ty, math.sin(ta) * 1.56), (0.28, 0.22, 0.22), bevel=0.0, rot_t3=(0.0, -ta, 0.0), mat_idx=3)

    foil_pts = [
        (0.50, 0.00), (0.34, 0.18), (0.06, 0.23), (-0.24, 0.15),
        (-0.50, 0.02), (-0.22, -0.07), (0.10, -0.10), (0.36, -0.11),
    ]
    stations = [
        (1.30, 0.96, 0.72, 0.56),
        (2.50, 1.26, 0.70, 0.47),
        (4.10, 1.44, 0.65, 0.39),
        (5.65, 1.32, 0.56, 0.33),
        (6.80, 1.06, 0.46, 0.28),
        (7.48, 0.72, 0.32, 0.25),
    ]

    for b_i in range(5):
        ba = (TAU * b_i) / 5.0
        cb, sb = math.cos(ba), math.sin(ba)
        rot_y = -ba

        add_cylinder(bm, (cb * 1.52, 0.0, sb * 1.52), 0.54, 0.46, 0.55, segs=8, rot_t3=(0.0, rot_y, math.pi * 0.5), mat_idx=2)

        b_rings = []
        for r_st, chord, thick, pitch in stations:
            cp, sp = math.cos(pitch), math.sin(pitch)
            ring = []
            for fx, fy in foil_pts:
                lz = fx * chord
                ly = fy * thick
                rz = lz * cp - ly * sp
                ry = lz * sp + ly * cp
                sweep_z = -0.18 * max(0.0, (r_st - 4.0) / 3.5) ** 2
                wx = r_st * cb - (rz + sweep_z) * sb
                wz = r_st * sb + (rz + sweep_z) * cb
                ring.append((wx, ry, wz))
            b_rings.append(ring)
        add_loft_rings(bm, b_rings, closed=True, cap_start=True, cap_end=True, mat_idx=3)

        # 3 Precision-Fitted Riveted Bronze Collar Ribs hugging the EXACT hydrofoil cross-section!
        for r_rib, ch_rib, th_rib, p_rib in (
            (2.85, 1.32, 0.72, 0.45),
            (4.65, 1.41, 0.63, 0.37),
            (6.15, 1.18, 0.52, 0.31),
        ):
            cp, sp = math.cos(p_rib), math.sin(p_rib)
            rib_rings = []
            for dr_off in (-0.12, 0.12):
                rr_i = r_rib + dr_off
                sweep_z = -0.18 * max(0.0, (rr_i - 4.0) / 3.5) ** 2
                ring = []
                for fx, fy in foil_pts:
                    lz = fx * ch_rib * 1.045
                    ly = fy * th_rib * 1.18
                    rz = lz * cp - ly * sp
                    ry = lz * sp + ly * cp
                    wx = rr_i * cb - (rz + sweep_z) * sb
                    wz = rr_i * sb + (rz + sweep_z) * cb
                    ring.append((wx, ry, wz))
                rib_rings.append(ring)
            add_loft_rings(bm, rib_rings, closed=True, cap_start=True, cap_end=True, mat_idx=2)

        haz_rings = []
        for r_st, chord, thick, pitch in stations[3:]:
            cp, sp = math.cos(pitch), math.sin(pitch)
            ring = []
            for h_ang in range(5):
                ha = (TAU * h_ang) / 5.0
                lz = 0.50 * chord + math.cos(ha) * 0.09
                ly = math.sin(ha) * 0.09
                rz = lz * cp - ly * sp
                ry = lz * sp + ly * cp
                sweep_z = -0.18 * max(0.0, (r_st - 4.0) / 3.5) ** 2
                wx = r_st * cb - (rz + sweep_z) * sb
                wz = r_st * sb + (rz + sweep_z) * cb
                ring.append((wx, ry, wz))
            haz_rings.append(ring)
        add_loft_rings(bm, haz_rings, closed=True, cap_start=True, cap_end=True, mat_idx=5)

    def turbine_ao(pt, nrm, mat_idx):
        if mat_idx in (4, 5):
            return (1.0, 1.0, 1.0)
        r = math.hypot(pt[0], pt[2])
        root_ao = 0.72 + 0.28 * min(1.0, abs(r - 1.55) / 0.85)
        edge_hi = 0.90 + 0.10 * abs(nrm[1])
        v = min(1.0, root_ao * edge_hi)
        return (v, v * 0.98, v * 0.94)

    finalize_mesh("Turbine_Blades", bm, core_mats, uv_scale=0.35, ao_fn=turbine_ao, smooth=False)

    # ------------------------------------------------------------------
    # 3. `PowerCore_Crystal` — Sculpted brass-caged aquamarine/gold crystal cluster
    #    Centered at (0,0,0), H ~2.7m, W ~2.2m
    # ------------------------------------------------------------------
    bm = bmesh.new()

    add_faceted_crystal(bm, (0.0, -0.78, 0.0), (0.0, 1.0, 0.0), length=2.05, radius=0.42, sides=6, tip_ratio=0.30, base_tip_ratio=0.24, mat_idx=4)
    sat_specs = [
        (0.0, 0.42, 0.55, 1.18, 0.22, 4),
        (1.05, 0.48, 0.48, 1.02, 0.19, 5),
        (2.10, 0.44, 0.52, 1.15, 0.21, 4),
        (3.15, 0.46, -0.50, 1.08, 0.20, 4),
        (4.20, 0.42, -0.55, 0.98, 0.18, 5),
        (5.25, 0.45, -0.46, 1.12, 0.20, 4),
    ]
    for sa, tilt_r, dy, slen, srad, smat in sat_specs:
        dir_v = (math.cos(sa) * tilt_r, dy, math.sin(sa) * tilt_r)
        base_p = (math.cos(sa) * 0.18, -0.14 if dy > 0 else 0.14, math.sin(sa) * 0.18)
        add_faceted_crystal(bm, base_p, dir_v, length=slen, radius=srad, sides=6, tip_ratio=0.32, base_tip_ratio=0.20, mat_idx=smat)

    add_profile_torus(
        bm,
        (0.0, 0.0, 0.0),
        0.52,
        [(0.09, -0.11), (0.12, 0.0), (0.09, 0.11), (-0.06, 0.09), (-0.06, -0.09)],
        segs_u=14,
        mat_idx=2,
    )
    for ci in range(4):
        ca = (TAU * ci) / 4.0 + math.pi * 0.25
        for sy in (-1.0, 1.0):
            add_bevel_box(bm, (math.cos(ca) * 0.56, sy * 0.34, math.sin(ca) * 0.56), (0.11, 0.52, 0.14), bevel=0.0, rot_t3=(0.0, -ca, sy * 0.32), mat_idx=3)

    gimbal_prof = [(0.085, -0.05), (0.085, 0.05), (0.0, 0.095), (-0.085, 0.05), (-0.085, -0.05), (0.0, -0.095)]
    add_profile_torus(bm, (0.0, 0.0, 0.0), 1.06, gimbal_prof, segs_u=24, rot_t3=(0.48, 0.0, 0.32), mat_idx=3)
    add_profile_torus(bm, (0.0, 0.0, 0.0), 0.86, gimbal_prof, segs_u=20, rot_t3=(-0.56, 0.62, -0.26), mat_idx=2)

    rm_outer = rot3(0.48, 0.0, 0.32).to_matrix()
    for fi in range(4):
        fa = (TAU * fi) / 4.0
        loc_bl = rm_outer @ v3(math.cos(fa) * 1.12, 0.0, math.sin(fa) * 1.12)
        loc_t3 = bl_to_t3(loc_bl)
        add_bevel_box(bm, loc_t3, (0.20, 0.20, 0.20), bevel=0.03, rot_t3=(0.48, -fa, 0.32), mat_idx=3)

    finalize_mesh(
        "PowerCore_Crystal",
        bm,
        core_mats,
        uv_scale=0.85,
        ao_fn=lambda p, n, m: (1.0, 1.0, 1.0) if m in (4, 5) else (0.94, 0.92, 0.88),
        smooth=False,
    )

    # ------------------------------------------------------------------
    # 4. `BoostRing_Bronze` — 2.6m Beveled Antique-Bronze & Crystal Speed-Gate
    #    Centered at (0,0,0), axis +Y, centerline R=2.60m
    # ------------------------------------------------------------------
    bm = bmesh.new()
    BR = 2.60

    ring_prof = [
        (0.24, -0.14), (0.24, 0.14), (0.14, 0.26), (-0.10, 0.26),
        (-0.22, 0.16), (-0.22, -0.16), (-0.10, -0.26), (0.14, -0.26),
    ]
    ring_prof_mats = [2, 3, 3, 3, 2, 3, 3, 3]
    add_profile_torus(bm, (0.0, 0.0, 0.0), BR, ring_prof, segs_u=28, mat_idx=ring_prof_mats)
    add_torus(bm, (0.0, 0.0, 0.0), BR - 0.25, 0.075, segs_u=24, segs_v=5, mat_idx=4)

    for k in range(8):
        ka = (TAU * k) / 8.0
        ck, sk = math.cos(ka), math.sin(ka)
        rot_y = -ka
        add_bevel_box(bm, (ck * BR, 0.0, sk * BR), (0.56, 0.62, 0.42), bevel=0.04, rot_t3=(0.0, rot_y, 0.0), mat_idx=3)
        add_bevel_box(bm, (ck * (BR + 0.38), 0.0, sk * (BR + 0.38)), (0.42, 0.30, 0.26), bevel=0.0, rot_t3=(0.0, rot_y, 0.0), mat_idx=0)
        for sy in (-0.31, 0.31):
            add_bevel_box(bm, (ck * (BR - 0.04), sy, sk * (BR - 0.04)), (0.22, 0.08, 0.22), bevel=0.0, rot_t3=(0.0, rot_y, 0.0), mat_idx=5)

    def boost_ao(pt, nrm, mat_idx):
        if mat_idx in (4, 5):
            return (1.0, 1.0, 1.0)
        r = math.hypot(pt[0], pt[2])
        v = 0.82 + 0.18 * max(0.0, min(1.0, (abs(pt[1]) / 0.30 + max(0.0, r - 2.35) * 0.6) * 0.65))
        return (v, v * 0.99, v * 0.95)

    finalize_mesh("BoostRing_Bronze", bm, core_mats, uv_scale=0.55, ao_fn=boost_ao, smooth=False)

    # ------------------------------------------------------------------
    # 5. `Shaft_BottomSanctuary` — Submerged Bronze Dome & Glowing Hydro-Pool
    #    Centered at (0,0,0), axis +Y, outer R=9.65m (seals ShaftRing_Main!)
    # ------------------------------------------------------------------
    bm = bmesh.new()

    add_cylinder(bm, (0.0, -1.65, 0.0), 9.65, 9.65, 1.40, segs=24, mat_idx=1)
    rim_prof = [(0.75, -0.95), (0.75, 0.85), (0.35, 1.10), (-0.35, 1.10), (-0.75, 0.45), (-0.75, -0.95)]
    add_profile_torus(bm, (0.0, 0.0, 0.0), 8.90, rim_prof, segs_u=24, mat_idx=[1, 0, 0, 0, 1, 1])

    for k in range(12):
        ka = (TAU * k) / 12.0
        add_bevel_box(bm, (math.cos(ka) * 8.65, 0.72, math.sin(ka) * 8.65), (1.10, 2.25, 0.88), bevel=0.0, rot_t3=(0.0, -ka, 0.0), mat_idx=0 if k % 2 == 0 else 1)

    add_cylinder(bm, (0.0, -0.58, 0.0), 8.40, 8.40, 0.24, segs=24, mat_idx=6)
    for grate_r, gr_t in ((4.75, 0.16), (6.55, 0.14), (7.95, 0.18)):
        add_torus(bm, (0.0, -0.44, 0.0), grate_r, gr_t, segs_u=24, segs_v=5, mat_idx=2)

    for k in range(8):
        ka = (TAU * k) / 8.0
        add_bevel_box(bm, (math.cos(ka) * 6.0, -0.43, math.sin(ka) * 6.0), (4.40, 0.10, 0.34), bevel=0.0, rot_t3=(0.0, -ka, 0.0), mat_idx=4)

    add_cylinder(bm, (0.0, -0.15, 0.0), 4.25, 3.85, 0.75, segs=16, mat_idx=0)
    add_cylinder(bm, (0.0, 0.32, 0.0), 3.72, 3.55, 0.28, segs=16, mat_idx=2)

    dome_rings = []
    for lv in range(5):
        phi = (lv / 4.0) * (math.pi * 0.46)
        dr = math.cos(phi) * 3.12
        dy = 0.42 + math.sin(phi) * 2.38
        dome_rings.append([(math.cos((TAU * s) / 16.0) * dr, dy, math.sin((TAU * s) / 16.0) * dr) for s in range(16)])
    add_loft_rings(bm, dome_rings, closed=True, cap_start=False, cap_end=True, mat_idx=4)

    for k in range(8):
        ka = (TAU * k) / 8.0
        ck, sk = math.cos(ka), math.sin(ka)
        rot_y = -ka
        for seg in range(4):
            phi0 = (seg / 4.0) * (math.pi * 0.44)
            phi1 = ((seg + 1) / 4.0) * (math.pi * 0.44)
            pm = (phi0 + phi1) * 0.5
            rr = math.cos(pm) * 3.30
            yy = 0.42 + math.sin(pm) * 2.52
            add_bevel_box(bm, (ck * rr, yy, sk * rr), (0.32, 1.05, 0.36), bevel=0.0, rot_t3=(0.0, rot_y, pm), mat_idx=3)
        add_bevel_box(bm, (ck * 3.92, 0.78, sk * 3.92), (0.42, 1.38, 0.72), bevel=0.06, rot_t3=(0.0, rot_y, -0.48), mat_idx=2)

    add_torus(bm, (0.0, 2.86, 0.0), 0.92, 0.16, segs_u=14, segs_v=5, mat_idx=3)
    add_faceted_crystal(bm, (0.0, 2.75, 0.0), (0.0, 1.0, 0.0), length=1.25, radius=0.40, sides=6, tip_ratio=0.36, base_tip_ratio=0.22, mat_idx=5)

    def sanc_ao(pt, nrm, mat_idx):
        if mat_idx in (4, 5, 6):
            return (1.0, 1.0, 1.0)
        x, y, z = pt
        r = math.hypot(x, z)
        y_ao = max(0.55, min(1.0, 0.65 + (y + 1.0) * 0.14))
        r_ao = 0.92 if r > 8.2 else 1.0
        v = min(1.0, y_ao * r_ao)
        return (v, v * 0.99, v * 0.96)

    finalize_mesh("Shaft_BottomSanctuary", bm, core_mats, uv_scale=0.24, ao_fn=sanc_ao, smooth=False)

    return export_glb_and_inspect(os.path.join(OUT_MODELS_DIR, "env_core_reactor.glb"), img_quality=76)


# ==============================================================================
# BLENDER EEVEE BEAUTY RENDERER — CORE REACTOR 2-PANEL SHOWCASE
# ==============================================================================

def _setup_eevee(scene, res_x, res_y, out_path, exposure=0.45):
    scene.render.engine = "BLENDER_EEVEE"
    scene.render.resolution_x = res_x
    scene.render.resolution_y = res_y
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.filepath = out_path
    if hasattr(scene.eevee, "taa_render_samples"):
        scene.eevee.taa_render_samples = 32
    vt_items = [i.identifier for i in scene.view_settings.bl_rna.properties["view_transform"].enum_items]
    scene.view_settings.view_transform = "AgX" if "AgX" in vt_items else "Standard"
    scene.view_settings.exposure = exposure


def _load_png_rgba(path):
    img = bpy.data.images.load(path, check_existing=False)
    w, h = img.size[0], img.size[1]
    arr = np.array(img.pixels[:], dtype=np.float32).reshape((h, w, 4))
    bpy.data.images.remove(img)
    return arr


def _save_png_rgba(path, arr):
    h, w, _ = arr.shape
    img = bpy.data.images.new("CompositeSheet", width=w, height=h, alpha=True, float_buffer=False)
    img.pixels.foreach_set(np.clip(arr, 0.0, 1.0).ravel())
    img.filepath_raw = path
    img.file_format = "PNG"
    img.save()
    bpy.data.images.remove(img)


def render_core_reactor_beauty(out_png):
    """Renders a 1920x1080 2-panel Blender EEVEE beauty showcase of `env_core_reactor.glb`:
       - Left (1200x1080): Dramatic downward-plunging hero view INSIDE the assembled 3-ring shaft
         looking past BoostRing_Bronze, PowerCore_Crystal, Turbine_Blades to Shaft_BottomSanctuary!
       - Right (720x1080): 3 crisp studio close-up panels (Turbine, PowerCore + BoostRing, BottomSanctuary)."""
    glb_path = os.path.join(OUT_MODELS_DIR, "env_core_reactor.glb")

    def add_light(name, ltype, energy, color, pos_t3, rot_t3=(0.0, 0.0, 0.0), radius=2.0):
        ld = bpy.data.lights.new(name, type=ltype)
        ld.energy = energy
        ld.color = color
        if ltype == "AREA":
            ld.size = radius
        elif hasattr(ld, "shadow_soft_size"):
            ld.shadow_soft_size = radius
        lo = bpy.data.objects.new(name, ld)
        lo.location = v3(*pos_t3)
        lo.rotation_euler = rot3(*rot_t3)
        bpy.context.collection.objects.link(lo)
        return lo

    def set_cam(name, pos_t3, target_t3, lens=26.0):
        cam_d = bpy.data.cameras.new(name)
        cam_d.lens = lens
        cam_d.clip_end = 220.0
        cam_o = bpy.data.objects.new(name, cam_d)
        cam_o.location = v3(*pos_t3)
        direction = v3(*target_t3) - cam_o.location
        cam_o.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()
        bpy.context.collection.objects.link(cam_o)
        bpy.context.scene.camera = cam_o
        return cam_o

    def import_kit():
        bpy.ops.import_scene.gltf(filepath=glb_path)
        src = {o.name.split(".")[0]: o for o in bpy.context.scene.objects if o.type == "MESH"}
        for o in src.values():
            o.hide_render = True
            o.hide_viewport = True
        return src

    def spawn_copy(src, name, pos_t3, rot_t3=(0.0, 0.0, 0.0), scale=1.0):
        base = src[name]
        dup = base.copy()
        dup.data = base.data
        dup.hide_render = False
        dup.hide_viewport = False
        dup.rotation_mode = "XYZ"
        dup.location = v3(*pos_t3)
        dup.rotation_euler = rot3(*rot_t3)
        dup.scale = (scale, scale, scale)
        bpy.context.collection.objects.link(dup)
        return dup

    # --- PANEL 1: Full Assembled Interior Hydro-Reactor Shaft (1200x1080) ---
    p_main = os.path.join(TEMP_DIR, "core_panel_main.png")
    reset_scene()
    scene = bpy.context.scene
    _setup_eevee(scene, 1200, 1080, p_main, exposure=0.14)
    world = bpy.data.worlds.new("CoreShaftWorld")
    scene.world = world
    world.use_nodes = True
    world.node_tree.nodes["Background"].inputs["Color"].default_value = (0.04, 0.16, 0.25, 1.0)
    world.node_tree.nodes["Background"].inputs["Strength"].default_value = 0.75

    src = import_kit()
    spawn_copy(src, "ShaftRing_Main", (0.0, 6.0, 0.0))
    spawn_copy(src, "ShaftRing_Main", (0.0, -6.0, 0.0))
    spawn_copy(src, "ShaftRing_Main", (0.0, -18.0, 0.0))
    spawn_copy(src, "Shaft_BottomSanctuary", (0.0, -24.0, 0.0))

    spawn_copy(src, "BoostRing_Bronze", (-1.55, 2.8, 1.10), (0.14, 0.25, -0.08), scale=0.84)
    spawn_copy(src, "PowerCore_Crystal", (2.35, -0.2, -0.45), (0.10, 0.55, 0.0), scale=1.18)
    spawn_copy(src, "Turbine_Blades", (0.0, -6.4, 0.0), (0.0, 0.38, 0.0), scale=1.0)
    spawn_copy(src, "BoostRing_Bronze", (1.65, -12.0, 0.65), (0.0, -0.35, 0.0), scale=0.88)
    spawn_copy(src, "Turbine_Blades", (0.0, -17.2, 0.0), (0.0, 1.15, 0.0), scale=1.0)

    add_light("IntakeSun", "POINT", 18000.0, (1.0, 0.88, 0.68), (2.8, 15.0, 3.6), radius=3.5)
    add_light("UpperWarm", "POINT", 7500.0, (1.0, 0.82, 0.58), (-3.8, 4.8, 2.2), radius=2.8)
    add_light("MidAqua", "POINT", 10500.0, (0.24, 0.94, 1.0), (0.0, -4.5, 0.0), radius=3.2)
    add_light("LowerAqua", "POINT", 12000.0, (0.20, 0.90, 0.98), (0.0, -14.5, 0.0), radius=3.2)
    add_light("BedrockGold", "POINT", 17000.0, (1.0, 0.86, 0.44), (0.0, -20.5, 0.0), radius=3.2)
    set_cam("ShaftCam", (0.30, 11.2, 3.65), (0.0, -14.0, -0.25), lens=23.0)
    bpy.ops.render.render(write_still=True)

    # --- PANEL 2 (Top Right): Turbine_Blades Hero Studio Close-Up (720x360) ---
    p_turb = os.path.join(TEMP_DIR, "core_panel_turb.png")
    reset_scene()
    scene = bpy.context.scene
    _setup_eevee(scene, 720, 360, p_turb, exposure=0.22)
    world = bpy.data.worlds.new("StudioW1")
    scene.world = world
    world.use_nodes = True
    world.node_tree.nodes["Background"].inputs["Color"].default_value = (0.06, 0.16, 0.24, 1.0)
    world.node_tree.nodes["Background"].inputs["Strength"].default_value = 1.0
    src = import_kit()
    spawn_copy(src, "Turbine_Blades", (0.0, 0.0, 0.0), (0.0, 0.25, 0.0))
    add_light("Key", "AREA", 7200.0, (1.0, 0.92, 0.78), (8.0, 10.0, 10.0), (-0.65, 0.55, 0.0), radius=6.0)
    add_light("Rim", "AREA", 4500.0, (0.25, 0.95, 1.0), (-9.0, 6.0, -8.0), (0.55, -2.4, 0.0), radius=6.0)
    set_cam("TurbCam", (0.0, 10.2, 13.8), (0.0, -0.2, 0.0), lens=32.0)
    bpy.ops.render.render(write_still=True)

    # --- PANEL 3 (Mid Right): PowerCore_Crystal + BoostRing_Bronze Close-Up (720x360) ---
    p_props = os.path.join(TEMP_DIR, "core_panel_props.png")
    reset_scene()
    scene = bpy.context.scene
    _setup_eevee(scene, 720, 360, p_props, exposure=0.20)
    world = bpy.data.worlds.new("StudioW2")
    scene.world = world
    world.use_nodes = True
    world.node_tree.nodes["Background"].inputs["Color"].default_value = (0.05, 0.15, 0.23, 1.0)
    world.node_tree.nodes["Background"].inputs["Strength"].default_value = 1.0
    src = import_kit()
    spawn_copy(src, "PowerCore_Crystal", (-2.65, 0.0, 0.0), (0.08, 0.45, 0.0), scale=1.18)
    spawn_copy(src, "BoostRing_Bronze", (1.95, 0.0, 0.0), (1.12, -0.32, 0.0), scale=0.68)
    add_light("Key", "AREA", 2600.0, (1.0, 0.93, 0.80), (4.5, 5.5, 7.5), (-0.55, 0.45, 0.0), radius=4.5)
    add_light("Fill", "AREA", 1500.0, (0.30, 0.92, 1.0), (-6.0, 3.0, 5.0), (-0.30, -0.65, 0.0), radius=4.5)
    set_cam("PropCam", (0.0, 1.0, 9.2), (0.0, 0.0, 0.0), lens=34.0)
    bpy.ops.render.render(write_still=True)

    # --- PANEL 4 (Bottom Right): Shaft_BottomSanctuary Hero Close-Up (720x360) ---
    p_sanc = os.path.join(TEMP_DIR, "core_panel_sanc.png")
    reset_scene()
    scene = bpy.context.scene
    _setup_eevee(scene, 720, 360, p_sanc, exposure=0.18)
    world = bpy.data.worlds.new("StudioW3")
    scene.world = world
    world.use_nodes = True
    world.node_tree.nodes["Background"].inputs["Color"].default_value = (0.05, 0.17, 0.26, 1.0)
    world.node_tree.nodes["Background"].inputs["Strength"].default_value = 1.0
    src = import_kit()
    spawn_copy(src, "Shaft_BottomSanctuary", (0.0, 0.0, 0.0), (0.0, 0.30, 0.0))
    add_light("Key", "AREA", 9000.0, (1.0, 0.92, 0.78), (8.0, 12.0, 10.0), (-0.70, 0.50, 0.0), radius=7.0)
    add_light("Core", "POINT", 8000.0, (0.25, 0.96, 1.0), (0.0, 4.5, 0.0), radius=2.5)
    set_cam("SancCam", (0.0, 11.2, 15.2), (0.0, 0.3, 0.0), lens=30.0)
    bpy.ops.render.render(write_still=True)

    # Composite into crisp 1920x1080 beauty sheet (Blender pixel arrays are bottom-up!)
    canvas = np.zeros((1080, 1920, 4), dtype=np.float32)
    canvas[:, :, 3] = 1.0
    canvas[:, :1200, :] = _load_png_rgba(p_main)
    canvas[720:1080, 1200:1920, :] = _load_png_rgba(p_turb)   # Top-right
    canvas[360:720, 1200:1920, :] = _load_png_rgba(p_props)   # Mid-right
    canvas[0:360, 1200:1920, :] = _load_png_rgba(p_sanc)      # Bot-right
    gold = np.array([0.82, 0.66, 0.32, 1.0], dtype=np.float32)
    canvas[:, 1198:1202, :] = gold
    canvas[358:362, 1200:, :] = gold
    canvas[718:722, 1200:, :] = gold
    _save_png_rgba(out_png, canvas)


# ==============================================================================
# MAIN ENTRYPOINT
# ==============================================================================

def main():
    argv = sys.argv
    extra = argv[argv.index("--") + 1:] if "--" in argv else []
    only = None
    render_core_path = None
    report_path = os.path.join(TEMP_DIR, "env_interiors_report.json")

    for idx, tok in enumerate(extra):
        if tok == "--only" and idx + 1 < len(extra):
            only = extra[idx + 1].strip().lower()
        elif tok == "--render-core" and idx + 1 < len(extra):
            render_core_path = extra[idx + 1]
        elif tok == "--report" and idx + 1 < len(extra):
            report_path = extra[idx + 1]

    results = {}
    if only in (None, "all", "core"):
        results["env_core_reactor"] = build_env_core_reactor()

    if render_core_path:
        os.makedirs(os.path.dirname(os.path.abspath(render_core_path)), exist_ok=True)
        render_core_reactor_beauty(render_core_path)

    with open(report_path, "w", encoding="utf-8") as f:
        json.dump({"ok": True, "results": results, "render_core": render_core_path}, f, indent=2)


if __name__ == "__main__":
    try:
        main()
    except Exception:
        err_path = os.path.join(TEMP_DIR, "env_interiors_error.txt")
        with open(err_path, "w", encoding="utf-8") as ef:
            ef.write(traceback.format_exc())
        raise
