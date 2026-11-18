"""
TOWERING WATERS: GATEWAY'S DESCENT — Wave 2 High-Detail AAA Enemy Pipeline
==========================================================================
Combines `512x512` weathered, battle-scarred PBR texture maps (`Albedo`, `Normal`,
`ORM [Cavity AO + Micro-Roughness + Metallic]`, and `Emissive`) with high-detail
hard-surface & organic BMesh sculpting in Blender 5.3:

  1. `enemy_snap_crab.glb`       — Serrated barnacle-encrusted carapace, hydraulic linkages, jagged crusher teeth
  2. `enemy_gulp_hopper.glb`     — Bathysphere-amphibian armor, hooded iris optics, caged glass tank, coil-spring legs
  3. `enemy_volt_eel.glb`        — Fanged moray predator skull, gill louvers, Tesla spine nodes, fin-ray membranes
  4. `enemy_rail_skater.glb`     — Faceted stealth-manta hydrofoil, 6-blade scimitar impellers, A-arm suspension skids
  5. `enemy_barnacle_mortar.glb` — 7-cone encrusted reef colony, bolted iron bands, 5 toothed rifled shell valves
  6. `enemy_vent_stalker.glb`    — Horned fanged reptile skull, osteoderm scutes, craggy chimneys & jagged frost shards
  7. `enemy_siphon_warden.glb`   — Obsidian-and-gold war-helm, 3-tier pauldrons, geared astrolabe core, bladed shields & tri-claw kraken arms

Can also regenerate all `512x512` PBR PNGs standalone under Python 3.12 (`--bake-textures`).
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
SENTINEL_PATH = os.path.join(OUT_MODELS_DIR, "_enemies_build_done.json")

os.makedirs(OUT_MODELS_DIR, exist_ok=True)
os.makedirs(OUT_TEXTURES_DIR, exist_ok=True)


# ==============================================================================
# STANDALONE PYTHON 3.12 `512x512` WEATHERED PBR TEXTURE BAKER (`--bake-textures`)
# ==============================================================================

def bake_textures_numpy(size=512):
    import numpy as np
    from scipy.ndimage import gaussian_filter
    from PIL import Image

    def hex_rgb(h):
        h = h.lstrip("#")
        return np.array([int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16)], dtype=np.float32) / 255.0

    def mix_arr(a, b, t):
        t = np.clip(t, 0.0, 1.0)
        if np.ndim(t) == 2 and np.ndim(a) >= 1 and (np.ndim(a) == 1 or a.shape[-1] == 3):
            t = t[..., None]
        return a * (1.0 - t) + b * t

    def sstep(e0, e1, x):
        t = np.clip((x - e0) / max(1e-6, (e1 - e0)), 0.0, 1.0)
        return t * t * (3.0 - 2.0 * t)

    def fbm(sz, base_freq=4, octaves=5, seed=42):
        rng = np.random.default_rng(seed)
        yy, xx = np.meshgrid(np.linspace(0, 1, sz, endpoint=False), np.linspace(0, 1, sz, endpoint=False), indexing="ij")
        tot = np.zeros((sz, sz), dtype=np.float32)
        amp, freq, nrm = 0.5, base_freq, 0.0
        for _ in range(octaves):
            g = rng.random((freq, freq), dtype=np.float32)
            gx, gy = xx * freq, yy * freq
            ix0, iy0 = np.floor(gx).astype(np.int32) % freq, np.floor(gy).astype(np.int32) % freq
            ix1, iy1 = (ix0 + 1) % freq, (iy0 + 1) % freq
            fx, fy = gx - np.floor(gx), gy - np.floor(gy)
            ux, uy = fx * fx * (3 - 2 * fx), fy * fy * (3 - 2 * fy)
            val = (g[iy0, ix0] * (1 - ux) + g[iy0, ix1] * ux) * (1 - uy) + (g[iy1, ix0] * (1 - ux) + g[iy1, ix1] * ux) * uy
            tot += val * amp
            nrm += amp
            amp *= 0.5
            freq *= 2
        return tot / max(1e-6, nrm)

    def voronoi(sz, cells=12, jitter=0.85, seed=101):
        rng = np.random.default_rng(seed)
        yy, xx = np.meshgrid(np.linspace(0, cells, sz, endpoint=False), np.linspace(0, cells, sz, endpoint=False), indexing="ij")
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

    def scratches(sz, count=30, seed=303):
        rng = np.random.default_rng(seed)
        yy, xx = np.meshgrid(np.linspace(0, 1, sz, endpoint=False), np.linspace(0, 1, sz, endpoint=False), indexing="ij")
        out = np.zeros((sz, sz), dtype=np.float32)
        for _ in range(count):
            x0, y0, ang = rng.random(), rng.random(), rng.uniform(0, math.pi)
            ln, wd = rng.uniform(0.08, 0.28), rng.uniform(0.0022, 0.0055)
            dx, dy = ((xx - x0 + 0.5) % 1.0) - 0.5, ((yy - y0 + 0.5) % 1.0) - 0.5
            along = dx * math.cos(ang) + dy * math.sin(ang)
            perp = -dx * math.sin(ang) + dy * math.cos(ang) + 0.004 * np.sin(along * 45.0)
            tl = np.clip(1.0 - np.abs(along) / (ln * 0.5), 0.0, 1.0)
            out = np.maximum(out, np.clip(1.0 - np.abs(perp) / wd, 0.0, 1.0) * (tl ** 0.6))
        return out

    def save_set(name, alb, hmap, rgh, met, emi=None, n_str=3.8):
        dx = (np.roll(hmap, -1, axis=1) - np.roll(hmap, 1, axis=1)) * n_str
        dy = (np.roll(hmap, -1, axis=0) - np.roll(hmap, 1, axis=0)) * n_str
        inv = 1.0 / np.sqrt(dx * dx + dy * dy + 1.0)
        nrm = np.stack([0.5 - 0.5 * dx * inv, 0.5 + 0.5 * dy * inv, 0.5 + 0.5 * inv], axis=-1)
        ao = np.clip(0.82 + (hmap - gaussian_filter(hmap, sigma=3.0, mode="wrap")) * 1.65, 0.18, 1.0)
        alb_b = np.clip(alb * (0.58 + 0.42 * ao[..., None]), 0.0, 1.0)
        orm = np.stack([ao, np.clip(rgh, 0.12, 0.96), np.clip(met, 0.0, 1.0)], axis=-1)
        if emi is None:
            emi = np.zeros_like(alb_b)
        for suf, arr in (("albedo", alb_b), ("normal", np.clip(nrm, 0, 1)), ("orm", orm), ("emissive", np.clip(emi, 0, 1))):
            Image.fromarray((arr * 255.0 + 0.5).astype(np.uint8), mode="RGB").save(
                os.path.join(OUT_TEXTURES_DIR, f"enemy_{name}_{suf}.png"), optimize=True
            )

    u = np.linspace(0, 1, size, endpoint=False, dtype=np.float32)
    yy, xx = np.meshgrid(u, u, indexing="ij")

    # Bake if missing
    _, _, edge = voronoi(size, 9, 0.9, 11)
    bf1, _, _ = voronoi(size, 22, 0.95, 17)
    n1, nf, sc = fbm(size, 6, 5, 19), fbm(size, 24, 3, 23), scratches(size, 34, 29)
    seam = 1.0 - sstep(0.02, 0.075, edge + (n1 - 0.5) * 0.03)
    barn = sstep(0.26, 0.14, bf1) * sstep(0.05, 0.12, bf1) * sstep(0.54, 0.76, n1)
    verd = np.clip(seam * 0.65 + sstep(0.66, 0.84, n1) * 0.35, 0, 1)
    c = mix_arr(hex_rgb("#6e1714"), hex_rgb("#ad2f24"), n1)
    c = mix_arr(mix_arr(mix_arr(c, hex_rgb("#2e6f63"), verd * 0.58), hex_rgb("#d9cec1"), barn * 0.88), hex_rgb("#e09f67"), sc * 0.75)
    save_set("snap_crab", c, (1 - seam) * 0.45 + barn * 0.52 - sc * 0.38 + nf * 0.14, 0.56 + barn * 0.28 - sc * 0.26, 0.28 + sc * 0.58, hex_rgb("#06b6d4")[None, None, :] * (seam[..., None] * 0.22), 4.2)


if "--bake-textures" in sys.argv:
    bake_textures_numpy(512)
    sys.exit(0)


# ==============================================================================
# BLENDER 5.3 HIGH-DETAIL SCULPT & PBR ASSEMBLY
# ==============================================================================
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


def lerp(a, b, t):
    return a + (b - a) * t


def srgb_to_lin(c):
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def hex_lin(hex_str):
    h = hex_str.lstrip("#")
    return tuple(srgb_to_lin(int(h[i:i + 2], 16) / 255.0) for i in (0, 2, 4))


def reset_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.unit_settings.system = "METRIC"
    scene.unit_settings.scale_length = 1.0
    return scene


def load_baked_pbr_bundle(prefix, has_emissive=True):
    """Loads pre-baked `512x512` `enemy_<prefix>_{albedo,normal,orm,emissive}` (`.webp` or `.png`) & packs into GLB."""
    bundle = {}
    for key, suf, non_color in (
        ("albedo", "albedo", False),
        ("normal", "normal", True),
        ("orm", "orm", True),
        ("emissive", "emissive", False),
    ):
        if key == "emissive" and not has_emissive:
            continue
        for ext in ("webp", "png"):
            p = os.path.join(OUT_TEXTURES_DIR, f"enemy_{prefix}_{suf}.{ext}")
            if os.path.exists(p):
                img = bpy.data.images.load(p)
                if non_color:
                    img.colorspace_settings.name = "Non-Color"
                img.pack()
                bundle[key] = img
                break
    return bundle


def make_pbr_mat(
    name,
    hex_color="#ffffff",
    roughness=0.52,
    metallic=0.0,
    coat=0.0,
    coat_rough=0.22,
    emission_hex=None,
    emission_strength=0.0,
    alpha=1.0,
    transmission=0.0,
    tex_bundle=None,
    normal_strength=1.15,
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

    if transmission > 0.0 and "Transmission Weight" in bsdf.inputs:
        bsdf.inputs["Transmission Weight"].default_value = transmission

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


def assign_triplanar_uvs(bm, scale=1.85):
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


def assign_frontal_lens_uvs(bm, center_t3, radius):
    """Projects `(tx, ty)` frontal disc UVs around `center_t3` onto `enemy_eye_lens` iris texture!"""
    uv_layer = bm.loops.layers.uv.verify()
    cx, cy, _ = center_t3
    inv_r = 0.48 / max(1e-4, radius)
    for f in bm.faces:
        for lp in f.loops:
            # Blender `(bx, by, bz)` -> Three `(tx = bx, ty = bz)`
            tx = lp.vert.co.x
            ty = lp.vert.co.z
            lp[uv_layer].uv = (0.5 + (tx - cx) * inv_r, 0.5 + (ty - cy) * inv_r)


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
    uv_scale=1.85,
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


def add_swept_curve(bm, pts_t3, radii, segs=10, up_t3=(0.0, 1.0, 0.0), cap_start=True, cap_end=True, mat_idx=0):
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


def add_ellipsoid(bm, center_t3, radii_t3, u_segs=14, v_segs=10, mat_idx=0):
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


def add_barnacle_cluster(bm, center_t3, normal_t3, scale=1.0, count=3, mat_idx=0):
    """Sculpts a craggy 3D volcano-barnacle cluster right onto carapaces, reefs, and armor."""
    c = Vector(center_t3)
    n = Vector(normal_t3).normalized()
    up = Vector((0.0, 1.0, 0.0)) if abs(n.y) < 0.85 else Vector((1.0, 0.0, 0.0))
    t1 = n.cross(up).normalized()
    t2 = n.cross(t1).normalized()
    offsets = [(0.0, 0.0, 0.042 * scale, 0.036 * scale), (0.035 * scale, 0.02 * scale, 0.028 * scale, 0.024 * scale), (-0.03 * scale, 0.025 * scale, 0.025 * scale, 0.022 * scale)]
    for ox, oy, r_base, h_cone in offsets[:count]:
        p0 = c + t1 * ox + t2 * oy - n * (0.005 * scale)
        p1 = p0 + n * h_cone
        add_swept_curve(bm, [(p0.x, p0.y, p0.z), (p1.x, p1.y, p1.z)], [r_base, r_base * 0.48], segs=7, mat_idx=mat_idx)


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
        magic, ver, total_len = struct.unpack("<III", f.read(12))
        chunk_len, chunk_type = struct.unpack("<II", f.read(8))
        gltf_json = json.loads(f.read(chunk_len).decode("utf-8"))

    nodes = [n.get("name", "") for n in gltf_json.get("nodes", [])]
    mats = [m.get("name", "") for m in gltf_json.get("materials", [])]
    images = len(gltf_json.get("images", []))
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
        "images": images,
        "nodes": nodes,
        "materials": mats,
    }


# ==============================================================================
# ENEMY 1: `snap_crab` — Snap-Claw Dredger (`enemy_snap_crab.glb`)
# ==============================================================================

def build_enemy_snap_crab():
    reset_scene()
    tex_crab = load_baked_pbr_bundle("snap_crab", has_emissive=True)
    tex_metal = load_baked_pbr_bundle("weathered_metal", has_emissive=False)
    tex_eye = load_baked_pbr_bundle("eye_lens", has_emissive=True)

    mat_carapace = make_pbr_mat(
        "mat_crab_carapace", "#9e2a22", roughness=0.58, metallic=0.25, coat=0.0,
        emission_hex="#06b6d4", emission_strength=0.35, tex_bundle=tex_crab, normal_strength=1.35
    )
    mat_metal = make_pbr_mat(
        "mat_crab_brass", "#a87932", roughness=0.42, metallic=0.86, coat=0.0,
        tex_bundle=tex_metal, normal_strength=1.20
    )
    mat_piston = make_pbr_mat("mat_crab_piston", "#94a3b8", roughness=0.26, metallic=0.92)
    mat_tooth = make_pbr_mat("mat_crab_tooth", "#e7e5e4", roughness=0.45, metallic=0.05)
    mat_bounce = make_pbr_mat(
        "mat_crab_bounce_pad", "#0891b2", roughness=0.22, metallic=0.15, coat=0.4,
        emission_hex="#06b6d4", emission_strength=0.95
    )
    mat_spark = make_pbr_mat(
        "mat_crab_spark", "#0284c7", roughness=0.10, emission_hex="#00b4d8", emission_strength=1.15
    )
    mat_eye_lens = make_pbr_mat(
        "mat_crab_iris", "#d97706", roughness=0.08, coat=0.85,
        emission_hex="#f59e0b", emission_strength=0.55, tex_bundle=tex_eye, normal_strength=0.4
    )

    root = make_empty_node("SnapCrabRoot", (0.0, 0.0, 0.0))

    # 1. Chiseled Faceted Barnacle-Encrusted Carapace + 10 Marginal Saw-Teeth!
    bm_car = bmesh.new()
    car_stations = [
        (0.16, 0.30, 0.23),
        (0.23, 0.38, 0.29),
        (0.32, 0.35, 0.27),
        (0.41, 0.27, 0.21),
        (0.47, 0.14, 0.11),
    ]
    rings = []
    for y, rx, rz in car_stations:
        ring = []
        for s in range(20):
            a = (2.0 * math.pi * s) / 20
            ridge = 1.0 + 0.065 * math.cos(a * 8.0)
            ring.append((math.cos(a) * rx * ridge, y, math.sin(a) * rz * ridge))
        rings.append(ring)
    add_loft_rings(bm_car, rings, closed=True, cap_start=True, cap_end=True, mat_idx=0)

    # 5 Sharp serrated marginal crab-shell teeth per side!
    for sx in (-1.0, 1.0):
        for ti in range(5):
            ang = (-0.45 + ti * 0.26)
            bx = sx * math.cos(ang) * 0.35
            bz = math.sin(ang) * 0.26
            add_swept_curve(
                bm_car,
                [(bx * 0.92, 0.24, bz), (bx * 1.18, 0.23, bz + 0.03)],
                [0.034, 0.006],
                segs=5,
                mat_idx=0,
            )

    # Dorsal 3D encrusted barnacle clusters & bolted copper spine armor strip
    add_barnacle_cluster(bm_car, (-0.14, 0.42, -0.05), (-0.3, 1.0, -0.1), scale=1.1, count=3, mat_idx=2)
    add_barnacle_cluster(bm_car, (0.16, 0.40, 0.04), (0.35, 1.0, 0.1), scale=0.95, count=2, mat_idx=2)
    add_bevel_box(bm_car, (0.0, 0.45, -0.02), (0.11, 0.06, 0.28), bevel=0.010, mat_idx=1)

    # Rear bolted siphon exhaust manifold + flanged copper stacks
    for sx in (-0.13, 0.13):
        add_swept_curve(bm_car, [(sx, 0.33, -0.20), (sx * 1.18, 0.49, -0.29)], [0.038, 0.046], segs=10, mat_idx=1)
        add_swept_curve(bm_car, [(sx * 1.15, 0.47, -0.27), (sx * 1.19, 0.50, -0.30)], 0.054, segs=10, mat_idx=1)

    # Chiseled riveted front brow bumper
    add_swept_curve(
        bm_car,
        [(-0.26, 0.26, 0.19), (-0.13, 0.29, 0.28), (0.0, 0.30, 0.30), (0.13, 0.29, 0.28), (0.26, 0.26, 0.19)],
        (0.026, 0.036),
        segs=6,
        mat_idx=1,
    )
    finalize_mesh_obj("carapace", bm_car, [mat_carapace, mat_metal, mat_tooth], parent=root, uv_scale=1.9)

    # 2. Glowing Turquoise Hydro-Bounce Belly Pad (`belly_pad`)
    bm_pad = bmesh.new()
    add_ellipsoid(bm_pad, (0.0, 0.16, 0.0), (0.24, 0.042, 0.19), u_segs=16, v_segs=8, mat_idx=0)
    add_swept_curve(
        bm_pad,
        [(math.cos((2.0 * math.pi * k) / 16) * 0.23, 0.145, math.sin((2.0 * math.pi * k) / 16) * 0.18) for k in range(17)],
        0.022,
        segs=6,
        mat_idx=1,
    )
    finalize_mesh_obj("belly_pad", bm_pad, [mat_bounce, mat_metal], parent=root)

    # 3. Armored Hooded Periscope Optics with Striated Iris Texture (`eye_stalk_L`, `eye_stalk_R`)
    for side_nm, sx in (("eye_stalk_L", -0.105), ("eye_stalk_R", 0.105)):
        bm_eye = bmesh.new()
        assign_triplanar_uvs(bm_eye)
        # Stalk + armored cylindrical camera-hood housing
        add_swept_curve(bm_eye, [(0.0, 0.0, 0.0), (sx * 0.12, 0.11, 0.02)], [0.024, 0.028], segs=8, mat_idx=0)
        add_swept_curve(bm_eye, [(sx * 0.12, 0.135, -0.02), (sx * 0.12, 0.135, 0.065)], [0.048, 0.054], segs=12, mat_idx=0)
        assign_triplanar_uvs(bm_eye, scale=2.2)
        # Front striated bio-optic lens
        lens_faces = add_ellipsoid(bm_eye, (sx * 0.12, 0.135, 0.058), (0.044, 0.044, 0.022), u_segs=14, v_segs=8, mat_idx=1)
        bmesh.ops.recalc_face_normals(bm_eye, faces=bm_eye.faces)
        uv_layer = bm_eye.loops.layers.uv.verify()
        for f in lens_faces:
            for lp in f.loops:
                lp[uv_layer].uv = (0.5 + (lp.vert.co.x - sx * 0.12) / 0.092, 0.5 + (lp.vert.co.z - 0.135) / 0.092)
        finalize_mesh_obj(side_nm, bm_eye, [mat_metal, mat_eye_lens], pos=(sx, 0.36, 0.17), parent=root, keep_custom_uvs=True)

    # 4. Heavy Industrial Hydraulic Crusher Claws (`arm_L/R` + `pincer_upper/lower` with Jagged Teeth!)
    for tag, sx in (("L", -1.0), ("R", 1.0)):
        arm_node = make_empty_node(f"arm_{tag}", (sx * 0.24, 0.23, 0.16), parent=root)
        bm_arm = bmesh.new()
        add_bevel_box(bm_arm, (sx * 0.05, 0.0, 0.06), (0.11, 0.09, 0.14), bevel=0.014, rot_t3=(0.0, sx * 0.35, 0.0), mat_idx=0)
        add_bevel_box(bm_arm, (sx * 0.04, 0.0, 0.17), (0.14, 0.12, 0.15), bevel=0.016, mat_idx=1)
        # Dual hydraulic actuator cylinders & piston rods
        for py in (-0.035, 0.045):
            add_swept_curve(bm_arm, [(sx * 0.09, py, 0.02), (sx * 0.06, py, 0.18)], 0.018, segs=8, mat_idx=2)
        finalize_mesh_obj(f"arm_boom_{tag}", bm_arm, [mat_carapace, mat_metal, mat_piston], parent=arm_node, uv_scale=2.2)

        # Jagged Upper Hydraulic Crusher Claw + 4 Serrated Teeth
        bm_up = bmesh.new()
        add_swept_curve(
            bm_up,
            [(0.0, 0.0, 0.0), (-sx * 0.02, 0.072, 0.10), (-sx * 0.12, 0.022, 0.22)],
            [(0.068, 0.050), (0.058, 0.044), (0.016, 0.014)],
            segs=8,
            mat_idx=0,
        )
        add_bevel_box(bm_up, (-sx * 0.02, 0.045, 0.08), (0.08, 0.04, 0.12), bevel=0.008, rot_t3=(-0.2, -sx * 0.25, 0.0), mat_idx=1)
        for ti in range(4):
            tz = 0.05 + ti * 0.042
            tx = -sx * (0.01 + ti * 0.024)
            add_swept_curve(bm_up, [(tx, 0.015, tz), (tx - sx * 0.012, -0.022, tz + 0.008)], [0.015, 0.003], segs=5, mat_idx=2)
        finalize_mesh_obj(
            f"pincer_upper_{tag}", bm_up, [mat_carapace, mat_metal, mat_tooth], pos=(sx * 0.03, 0.02, 0.21), parent=arm_node, uv_scale=2.2
        )

        # Jagged Lower Cutter Jaw + 3 Interlocking Teeth
        bm_lo = bmesh.new()
        add_swept_curve(
            bm_lo,
            [(0.0, 0.0, 0.0), (-sx * 0.02, -0.055, 0.09), (-sx * 0.11, -0.012, 0.20)],
            [(0.055, 0.040), (0.046, 0.034), (0.014, 0.012)],
            segs=8,
            mat_idx=0,
        )
        for ti in range(3):
            tz = 0.065 + ti * 0.042
            tx = -sx * (0.015 + ti * 0.024)
            add_swept_curve(bm_lo, [(tx, -0.015, tz), (tx - sx * 0.01, 0.020, tz + 0.006)], [0.013, 0.003], segs=5, mat_idx=1)
        finalize_mesh_obj(
            f"pincer_lower_{tag}", bm_lo, [mat_metal, mat_tooth], pos=(sx * 0.03, -0.028, 0.21), parent=arm_node, uv_scale=2.2
        )

    bm_sp = bmesh.new()
    add_ellipsoid(bm_sp, (0.0, 0.0, 0.0), (0.038, 0.038, 0.038), u_segs=10, v_segs=8, mat_idx=0)
    finalize_mesh_obj("claw_spark", bm_sp, mat_spark, pos=(0.0, 0.23, 0.42), parent=root)

    # 5. Spiked Multi-Plate 6-Legged Crustacean Limbs (`leg_L1..L3`, `leg_R1..R3`)
    z_offsets = [0.10, -0.01, -0.12]
    x_spreads = [0.22, 0.25, 0.21]
    z_sweeps = [0.07, 0.0, -0.08]
    for idx_l in range(3):
        for tag, sx in (("L", -1.0), ("R", 1.0)):
            hip_x, hip_y, hip_z = sx * 0.25, 0.20, z_offsets[idx_l]
            rx, rz = sx * x_spreads[idx_l], z_sweeps[idx_l]

            bm_leg = bmesh.new()
            # Bolted hip housing + angular armored thigh (`merus`) + knee joint + sharp tarsal `dactyl`
            add_bevel_box(bm_leg, (sx * 0.03, 0.02, 0.0), (0.07, 0.06, 0.06), bevel=0.008, mat_idx=1)
            add_swept_curve(
                bm_leg,
                [(0.0, 0.0, 0.0), (rx * 0.58, 0.085, rz * 0.5), (rx, -0.055, rz * 0.85), (rx * 0.92, -hip_y, rz)],
                [(0.036, 0.046), (0.040, 0.050), (0.028, 0.032), (0.008, 0.010)],
                segs=6,
                mat_idx=0,
            )
            # Dorsal chitin leg spine + knee rivet clevis
            add_swept_curve(bm_leg, [(rx * 0.45, 0.09, rz * 0.4), (rx * 0.62, 0.15, rz * 0.5)], [0.018, 0.004], segs=5, mat_idx=0)
            add_bevel_box(bm_leg, (rx * 0.58, 0.08, rz * 0.5), (0.055, 0.055, 0.055), bevel=0.008, mat_idx=1)
            finalize_mesh_obj(
                f"leg_{tag}{idx_l + 1}", bm_leg, [mat_carapace, mat_metal], pos=(hip_x, hip_y, hip_z), parent=root, uv_scale=2.4
            )

    return export_glb_and_inspect(os.path.join(OUT_MODELS_DIR, "enemy_snap_crab.glb"))


# ==============================================================================
# ENEMY 2: `gulp_hopper` — Gulp-Hopper Drone (`enemy_gulp_hopper.glb`)
# ==============================================================================

def build_enemy_gulp_hopper():
    reset_scene()
    tex_hop = load_baked_pbr_bundle("gulp_hopper", has_emissive=True)
    tex_metal = load_baked_pbr_bundle("weathered_metal", has_emissive=False)
    tex_eye = load_baked_pbr_bundle("eye_lens", has_emissive=True)

    mat_shell = make_pbr_mat(
        "mat_hopper_shell", "#165b73", roughness=0.46, metallic=0.25, coat=0.12,
        emission_hex="#0891b2", emission_strength=0.35, tex_bundle=tex_hop, normal_strength=1.25
    )
    mat_metal = make_pbr_mat("mat_hopper_brass", "#a87932", roughness=0.40, metallic=0.86, tex_bundle=tex_metal, normal_strength=1.2)
    mat_piston = make_pbr_mat("mat_hopper_piston", "#94a3b8", roughness=0.25, metallic=0.92)
    mat_glass = make_pbr_mat("mat_hopper_glass", "#bae6fd", roughness=0.05, metallic=0.04, coat=1.0, alpha=0.28, transmission=0.72)
    mat_water = make_pbr_mat(
        "mat_hopper_water", "#0891b2", roughness=0.10, metallic=0.05, coat=0.8,
        alpha=0.90, emission_hex="#06b6d4", emission_strength=0.90
    )
    mat_foam = make_pbr_mat("mat_hopper_foam", "#a5f3fc", roughness=0.15, emission_hex="#38bdf8", emission_strength=0.65)
    mat_eye = make_pbr_mat(
        "mat_hopper_eye", "#d97706", roughness=0.08, coat=0.85,
        emission_hex="#f59e0b", emission_strength=0.55, tex_bundle=tex_eye, normal_strength=0.4
    )

    root = make_empty_node("GulpHopperRoot", (0.0, 0.0, 0.0))
    body_pivot = make_empty_node("hopper_body", (0.0, 0.0, 0.0), parent=root)

    # 1. Bathysphere-Amphibian Armored Cowl, Dorsal Siphon Valve & Ballast Pipes (`hopper_torso`)
    bm_top = bmesh.new()
    add_ellipsoid(bm_top, (0.0, 0.46, -0.02), (0.26, 0.16, 0.23), u_segs=18, v_segs=12, mat_idx=0)
    # Chiseled armored brow ridge + riveted dorsal hatch collar + siphon stack
    add_bevel_box(bm_top, (0.0, 0.50, 0.14), (0.34, 0.05, 0.10), bevel=0.012, rot_t3=(0.25, 0.0, 0.0), mat_idx=1)
    add_swept_curve(bm_top, [(0.0, 0.57, -0.06), (0.0, 0.71, -0.11)], [0.065, 0.105], segs=12, mat_idx=1)
    add_swept_curve(bm_top, [(0.0, 0.69, -0.10), (0.0, 0.72, -0.115)], 0.118, segs=12, mat_idx=1)
    # Protective riveted tank cage ribs wrapping around the glass belly
    for ang_deg in (-65, -28, 28, 65, 135, -135):
        ra = math.radians(ang_deg)
        sx, sz = math.sin(ra), math.cos(ra)
        add_swept_curve(
            bm_top,
            [(sx * 0.24, 0.40, 0.06 + sz * 0.22), (sx * 0.26, 0.23, 0.08 + sz * 0.25), (sx * 0.16, 0.07, 0.06 + sz * 0.16)],
            0.016,
            segs=6,
            mat_idx=1,
        )
    finalize_mesh_obj("hopper_torso", bm_top, [mat_shell, mat_metal], parent=body_pivot, uv_scale=1.9)

    # 2. Hinged Gulper Jaw + Internal Suction Turbine Vanes (`gulper_jaw`)
    bm_jaw = bmesh.new()
    add_ellipsoid(bm_jaw, (0.0, 0.0, 0.08), (0.19, 0.048, 0.12), u_segs=14, v_segs=8, mat_idx=0)
    for sx in (-0.18, 0.18):
        add_bevel_box(bm_jaw, (sx, 0.01, 0.02), (0.05, 0.06, 0.06), bevel=0.008, mat_idx=1)
    jaw_ring = [(math.cos((2.0 * math.pi * k) / 14) * 0.072, 0.01 + math.sin((2.0 * math.pi * k) / 14) * 0.054, 0.20) for k in range(15)]
    add_swept_curve(bm_jaw, jaw_ring, 0.018, segs=6, mat_idx=1)
    finalize_mesh_obj("gulper_jaw", bm_jaw, [mat_shell, mat_metal], pos=(0.0, 0.40, 0.10), parent=body_pivot, uv_scale=2.0)

    # 3. Armored Frog Optical Turrets with Striated Iris Texture (`eye_L`, `eye_R`)
    for enm, sx in (("eye_L", -0.165), ("eye_R", 0.165)):
        bm_e = bmesh.new()
        add_swept_curve(bm_e, [(0.0, 0.0, -0.05), (0.0, 0.0, 0.055)], [0.072, 0.078], segs=14, mat_idx=0)
        # Upper protective amphibian metal eyelid cowl
        add_bevel_box(bm_e, (0.0, 0.052, 0.02), (0.14, 0.04, 0.12), bevel=0.010, rot_t3=(0.18, 0.0, -sx * 0.9), mat_idx=1)
        assign_triplanar_uvs(bm_e, scale=2.2)
        lens_f = add_ellipsoid(bm_e, (0.0, 0.0, 0.050), (0.068, 0.068, 0.032), u_segs=16, v_segs=8, mat_idx=2)
        bmesh.ops.recalc_face_normals(bm_e, faces=bm_e.faces)
        uv_layer = bm_e.loops.layers.uv.verify()
        for f in lens_f:
            for lp in f.loops:
                lp[uv_layer].uv = (0.5 + lp.vert.co.x / 0.142, 0.5 + lp.vert.co.z / 0.142)
        finalize_mesh_obj(enm, bm_e, [mat_metal, mat_shell, mat_eye], pos=(sx, 0.56, 0.11), parent=body_pivot, keep_custom_uvs=True)

    # 4. Glass Belly Tank (`glass_belly_tank`) + Stolen Water Core (`stolen_water_core`)
    bm_tank = bmesh.new()
    add_ellipsoid(bm_tank, (0.0, 0.0, 0.0), (0.245, 0.215, 0.240), u_segs=20, v_segs=14, mat_idx=0)
    finalize_mesh_obj("glass_belly_tank", bm_tank, mat_glass, pos=(0.0, 0.23, 0.08), parent=body_pivot)

    bm_wat = bmesh.new()
    add_ellipsoid(bm_wat, (0.0, -0.02, 0.0), (0.190, 0.160, 0.185), u_segs=18, v_segs=12, mat_idx=0)
    for bx, by, bz, br in ((-0.07, 0.06, 0.10, 0.032), (0.08, 0.04, 0.09, 0.026), (0.0, 0.09, 0.07, 0.024)):
        add_ellipsoid(bm_wat, (bx, by, bz), (br, br, br), u_segs=8, v_segs=6, mat_idx=1)
    finalize_mesh_obj("stolen_water_core", bm_wat, [mat_water, mat_foam], pos=(0.0, 0.23, 0.08), parent=body_pivot)

    # 5. Coil-Spring + Hydraulic Piston Frog Legs (`hind_leg_L/R`, `fore_leg_L/R`) with 3-Toed Webbed Paddles
    for tag, sx in (("L", -1.0), ("R", 1.0)):
        bm_hl = bmesh.new()
        add_bevel_box(bm_hl, (sx * 0.06, 0.05, -0.05), (0.10, 0.13, 0.15), bevel=0.014, rot_t3=(-0.4, 0.0, 0.0), mat_idx=0)
        # Helical shock-spring coils around piston shin
        coil = [
            (sx * 0.12 + math.cos(s * 1.4) * 0.042, 0.06 - (s / 12.0) * 0.24, -0.08 + (s / 12.0) * 0.16 + math.sin(s * 1.4) * 0.042)
            for s in range(13)
        ]
        add_swept_curve(bm_hl, coil, 0.012, segs=5, mat_idx=1)
        add_swept_curve(bm_hl, [(sx * 0.12, 0.08, -0.09), (sx * 0.12, -0.21, 0.10)], 0.024, segs=8, mat_idx=2)
        # 3-toed riveted hydro-flipper foot
        for ti in (-1, 0, 1):
            add_bevel_box(bm_hl, (sx * 0.13 + ti * 0.048, -0.225, 0.15), (0.042, 0.028, 0.18), bevel=0.006, rot_t3=(0.0, ti * 0.16, 0.0), mat_idx=1)
        finalize_mesh_obj(f"hind_leg_{tag}", bm_hl, [mat_shell, mat_metal, mat_piston], pos=(sx * 0.23, 0.24, -0.04), parent=root, uv_scale=2.2)

        bm_fl = bmesh.new()
        add_bevel_box(bm_fl, (sx * 0.04, -0.05, 0.03), (0.065, 0.12, 0.065), bevel=0.010, rot_t3=(0.35, 0.0, 0.0), mat_idx=0)
        add_swept_curve(bm_fl, [(sx * 0.05, -0.08, 0.04), (sx * 0.08, -0.16, 0.09)], 0.024, segs=7, mat_idx=2)
        add_bevel_box(bm_fl, (sx * 0.08, -0.165, 0.12), (0.09, 0.026, 0.11), bevel=0.006, mat_idx=1)
        finalize_mesh_obj(f"fore_leg_{tag}", bm_fl, [mat_shell, mat_metal, mat_piston], pos=(sx * 0.20, 0.18, 0.11), parent=root, uv_scale=2.2)

    return export_glb_and_inspect(os.path.join(OUT_MODELS_DIR, "enemy_gulp_hopper.glb"))


# ==============================================================================
# ENEMY 3: `volt_eel` — Conduit Volt-Eel (`enemy_volt_eel.glb`)
# ==============================================================================

def build_enemy_volt_eel():
    reset_scene()
    tex_eel = load_baked_pbr_bundle("volt_eel", has_emissive=True)
    tex_metal = load_baked_pbr_bundle("weathered_metal", has_emissive=False)
    tex_eye = load_baked_pbr_bundle("eye_lens", has_emissive=True)

    mat_eel_body = make_pbr_mat(
        "mat_eel_body", "#14294a", roughness=0.38, metallic=0.32, coat=0.18,
        emission_hex="#06b6d4", emission_strength=0.65, tex_bundle=tex_eel, normal_strength=1.35
    )
    mat_copper = make_pbr_mat("mat_eel_copper", "#b86b32", roughness=0.38, metallic=0.88, tex_bundle=tex_metal, normal_strength=1.2)
    mat_fin = make_pbr_mat(
        "mat_eel_fin", "#0891b2", roughness=0.18, metallic=0.08, coat=0.4,
        alpha=0.82, emission_hex="#06b6d4", emission_strength=0.90
    )
    mat_arc = make_pbr_mat("mat_eel_arc", "#38bdf8", roughness=0.10, emission_hex="#00b4d8", emission_strength=1.20)
    mat_fang = make_pbr_mat("mat_eel_fang", "#e0f2fe", roughness=0.20, emission_hex="#38bdf8", emission_strength=0.45)
    mat_eye = make_pbr_mat("mat_eel_eye", "#eab308", roughness=0.08, coat=0.85, emission_hex="#facc15", emission_strength=0.65, tex_bundle=tex_eye)

    root = make_empty_node("VoltEelRoot", (0.0, 0.0, 0.0))

    # Segment 0: Ferocious Fanged Bio-Mech Moray Skull + Flared Copper Gill Louvers
    seg0 = make_empty_node("seg_0", (0.0, 0.0, 0.0), parent=root)
    bm_h = bmesh.new()
    h_stations = [
        (-0.12, 0.130, 0.145),
        (-0.02, 0.150, 0.165),
        (0.10, 0.125, 0.125),
        (0.22, 0.080, 0.072),
        (0.31, 0.042, 0.036),
    ]
    h_rings = [
        [(math.cos((2.0 * math.pi * s) / 16) * rx, math.sin((2.0 * math.pi * s) / 16) * ry + 0.02, z) for s in range(16)]
        for z, rx, ry in h_stations
    ]
    add_loft_rings(bm_h, h_rings, closed=True, cap_start=True, cap_end=True, mat_idx=0)

    # Armored brow crests, striated predator eyes & 3 copper gill louvers per flank
    for sx in (-1.0, 1.0):
        add_bevel_box(bm_h, (sx * 0.09, 0.095, 0.12), (0.05, 0.028, 0.11), bevel=0.006, rot_t3=(0.15, sx * 0.25, -sx * 0.35), mat_idx=1)
        add_ellipsoid(bm_h, (sx * 0.098, 0.062, 0.125), (0.026, 0.030, 0.046), u_segs=10, v_segs=6, mat_idx=5)
        for gi in range(3):
            gz = -0.02 - gi * 0.035
            add_bevel_box(bm_h, (sx * 0.138, 0.01, gz), (0.024, 0.09, 0.016), bevel=0.003, rot_t3=(0.0, sx * 0.42, 0.0), mat_idx=1)
    # 6 Sharp curved upper moray fangs!
    for sx in (-1.0, 1.0):
        for fi, fz in enumerate((0.14, 0.20, 0.26)):
            fx = sx * (0.068 - fi * 0.016)
            add_swept_curve(bm_h, [(fx, -0.015, fz), (fx * 0.9, -0.062, fz - 0.012)], [0.011, 0.002], segs=5, mat_idx=4)
    finalize_mesh_obj("eel_skull", bm_h, [mat_eel_body, mat_copper, mat_arc, mat_fin, mat_fang, mat_eye], parent=seg0, uv_scale=2.2)

    # Fanged Hinged Lower Jaw (`eel_jaw`)
    bm_j = bmesh.new()
    add_swept_curve(bm_j, [(0.0, 0.0, 0.0), (0.0, -0.02, 0.23)], [(0.095, 0.044), (0.038, 0.020)], segs=10, mat_idx=0)
    for sx in (-1.0, 1.0):
        for fi, fz in enumerate((0.11, 0.18)):
            fx = sx * (0.052 - fi * 0.015)
            add_swept_curve(bm_j, [(fx, 0.012, fz), (fx * 0.9, 0.054, fz - 0.008)], [0.010, 0.002], segs=5, mat_idx=1)
    finalize_mesh_obj("eel_jaw", bm_j, [mat_eel_body, mat_fang], pos=(0.0, -0.038, 0.02), parent=seg0, uv_scale=2.2)

    # Twin Tesla-Coil Insulator Arc Antennae (`arc_antenna_L`, `arc_antenna_R`) + `arc_bridge`
    for anm, sx in (("arc_antenna_L", -1.0), ("arc_antenna_R", 1.0)):
        bm_a = bmesh.new()
        add_swept_curve(bm_a, [(0.0, 0.0, 0.0), (sx * 0.10, 0.14, -0.02), (sx * 0.15, 0.24, -0.09)], [0.022, 0.014, 0.007], segs=8, mat_idx=0)
        for ri in (0.35, 0.68):
            add_ellipsoid(bm_a, (sx * 0.15 * ri, 0.24 * ri, -0.09 * ri), (0.028, 0.014, 0.028), u_segs=8, v_segs=5, mat_idx=0)
        add_ellipsoid(bm_a, (sx * 0.15, 0.24, -0.09), (0.026, 0.026, 0.026), u_segs=8, v_segs=6, mat_idx=1)
        finalize_mesh_obj(anm, bm_a, [mat_copper, mat_arc], pos=(sx * 0.06, 0.12, 0.09), parent=seg0)

    bm_ab = bmesh.new()
    add_swept_curve(bm_ab, [(-0.19, 0.35, 0.0), (0.0, 0.40, 0.03), (0.19, 0.35, 0.0)], 0.010, segs=6, mat_idx=0)
    finalize_mesh_obj("arc_bridge", bm_ab, mat_arc, parent=seg0)

    # Segments 1..6: Ribbed Fin-Ray Membranes + Dorsal Copper Tesla Nodes
    for k in range(1, 7):
        t = k / 7.0
        rad_x = lerp(0.118, 0.048, t)
        rad_y = lerp(0.132, 0.058, t)
        seg_len = 0.19
        bm_s = bmesh.new()
        add_swept_curve(
            bm_s,
            [(0.0, 0.0, -seg_len * 0.56), (0.0, 0.0, seg_len * 0.56)],
            [(rad_x * 0.92, rad_y * 0.92), (rad_x, rad_y)],
            segs=14,
            mat_idx=0,
        )
        # Bolted copper induction collar + dorsal Tesla electrode spike
        add_swept_curve(bm_s, [(0.0, 0.0, -0.024), (0.0, 0.0, 0.024)], (rad_x * 1.08, rad_y * 1.08), segs=14, mat_idx=1)
        fin_h = lerp(0.105, 0.060, t)
        add_swept_curve(bm_s, [(0.0, rad_y, 0.02), (0.0, rad_y + fin_h * 1.15, -0.03)], [0.016, 0.004], segs=6, mat_idx=1)
        # Thin webbed dorsal & lateral fin membranes
        add_swept_curve(
            bm_s,
            [(0.0, rad_y * 0.9, seg_len * 0.48), (0.0, rad_y + fin_h, -0.02), (0.0, rad_y * 0.85, -seg_len * 0.48)],
            [(0.005, 0.025), (0.006, 0.050), (0.005, 0.025)],
            segs=7,
            mat_idx=2,
        )
        for sx in (-1.0, 1.0):
            add_swept_curve(
                bm_s,
                [(sx * rad_x * 0.85, 0.0, seg_len * 0.35), (sx * (rad_x + 0.08), -0.015, -0.03), (sx * rad_x * 0.8, 0.0, -seg_len * 0.38)],
                [(0.018, 0.005), (0.038, 0.007), (0.015, 0.005)],
                segs=7,
                mat_idx=2,
            )
        finalize_mesh_obj(f"seg_{k}", bm_s, [mat_eel_body, mat_copper, mat_fin], parent=root, uv_scale=2.2)

    # Segment 7: Rayed Bio-Electric Caudal Tail Fluke
    bm_tail = bmesh.new()
    add_swept_curve(bm_tail, [(0.0, 0.0, 0.09), (0.0, 0.0, -0.20)], [(0.044, 0.052), (0.008, 0.014)], segs=10, mat_idx=0)
    for ry in (-0.11, 0.0, 0.11):
        add_swept_curve(bm_tail, [(0.0, 0.0, 0.05), (0.0, ry, -0.22)], [0.012, 0.004], segs=6, mat_idx=1)
    add_ellipsoid(bm_tail, (0.0, 0.0, -0.09), (0.008, 0.135, 0.17), u_segs=12, v_segs=8, mat_idx=2)
    finalize_mesh_obj("seg_7", bm_tail, [mat_eel_body, mat_copper, mat_fin], parent=root, uv_scale=2.2)

    return export_glb_and_inspect(os.path.join(OUT_MODELS_DIR, "enemy_volt_eel.glb"))


# ==============================================================================
# ENEMY 4: `rail_skater` — Riptide Rail-Skater (`enemy_rail_skater.glb`)
# ==============================================================================

def build_enemy_rail_skater():
    reset_scene()
    tex_sk = load_baked_pbr_bundle("rail_skater", has_emissive=True)
    tex_metal = load_baked_pbr_bundle("weathered_metal", has_emissive=False)

    mat_hull = make_pbr_mat(
        "mat_skater_hull", "#183e54", roughness=0.42, metallic=0.68, coat=0.10,
        emission_hex="#06b6d4", emission_strength=0.45, tex_bundle=tex_sk, normal_strength=1.25
    )
    mat_metal = make_pbr_mat("mat_skater_brass", "#a87932", roughness=0.38, metallic=0.88, tex_bundle=tex_metal, normal_strength=1.2)
    mat_dark = make_pbr_mat("mat_skater_visor", "#07111e", roughness=0.12, metallic=0.50, coat=0.8)
    mat_aqua = make_pbr_mat("mat_skater_aqua", "#06b6d4", roughness=0.10, alpha=0.84, emission_hex="#00b4d8", emission_strength=1.0)

    root = make_empty_node("RailSkaterRoot", (0.0, 0.0, 0.0))
    chassis = make_empty_node("manta_chassis", (0.0, 0.34, 0.0), parent=root)

    # 1. Faceted Chiseled Stealth-Manta Hydrofoil + Forward Ram Intakes + Visor Brow
    bm_m = bmesh.new()
    m_stations = [
        (-0.26, 0.08, 0.05),
        (-0.08, 0.25, 0.11),
        (0.10, 0.26, 0.10),
        (0.25, 0.15, 0.06),
    ]
    m_rings = [
        [(math.cos((2.0 * math.pi * s) / 8) * rx, 0.02 + math.sin((2.0 * math.pi * s) / 8) * ry, z) for s in range(8)]
        for z, rx, ry in m_stations
    ]
    add_loft_rings(bm_m, m_rings, closed=True, cap_start=True, cap_end=True, mat_idx=0)
    for sx in (-1.0, 1.0):
        add_bevel_box(bm_m, (sx * 0.32, 0.02, -0.02), (0.34, 0.036, 0.18), bevel=0.008, rot_t3=(0.0, -sx * 0.32, sx * 0.08), mat_idx=0)
        add_bevel_box(bm_m, (sx * 0.14, -0.01, 0.18), (0.08, 0.045, 0.09), bevel=0.006, mat_idx=1)
    add_bevel_box(bm_m, (0.0, 0.10, -0.02), (0.06, 0.09, 0.36), bevel=0.010, mat_idx=1)
    add_bevel_box(bm_m, (0.0, 0.025, 0.21), (0.28, 0.052, 0.08), bevel=0.010, mat_idx=2)
    finalize_mesh_obj("manta_hull", bm_m, [mat_hull, mat_metal, mat_dark], parent=chassis, uv_scale=2.0)

    bm_eye = bmesh.new()
    add_ellipsoid(bm_eye, (0.0, 0.0, 0.0), (0.044, 0.024, 0.022), u_segs=10, v_segs=8, mat_idx=0)
    finalize_mesh_obj("scanner_eye", bm_eye, mat_aqua, pos=(0.0, 0.025, 0.255), parent=chassis)

    # 2. Riveted Turbine Nacelles + 6-Blade Scimitar Impellers (`impeller_L`, `impeller_R`)
    for tag, sx, pitch_sign in (("L", -0.35, 1.0), ("R", 0.35, -1.0)):
        pod = make_empty_node(f"impeller_pod_{tag}", (sx, 0.01, -0.02), parent=chassis)
        bm_sh = bmesh.new()
        sh_pts = [(math.cos((2.0 * math.pi * k) / 16) * 0.128, math.sin((2.0 * math.pi * k) / 16) * 0.128, 0.0) for k in range(17)]
        add_swept_curve(bm_sh, sh_pts, (0.022, 0.036), segs=6, mat_idx=0)
        for st_i in range(4):
            sa = (2.0 * math.pi * st_i) / 4.0 + 0.78
            add_bevel_box(bm_sh, (math.cos(sa) * 0.07, math.sin(sa) * 0.07, -0.02), (0.11, 0.014, 0.024), bevel=0.002, rot_t3=(0.0, 0.0, sa), mat_idx=1)
        finalize_mesh_obj(f"shroud_{tag}", bm_sh, [mat_metal, mat_hull], parent=pod, uv_scale=2.2)

        bm_imp = bmesh.new()
        add_swept_curve(bm_imp, [(0.0, 0.0, -0.055), (0.0, 0.0, 0.065)], [0.038, 0.022], segs=10, mat_idx=0)
        for b in range(6):
            ba = (2.0 * math.pi * b) / 6.0
            add_bevel_box(
                bm_imp,
                (math.cos(ba) * 0.068, math.sin(ba) * 0.068, 0.0),
                (0.086, 0.028, 0.008),
                bevel=0.002,
                rot_t3=(0.42 * pitch_sign * math.sin(ba), -0.42 * pitch_sign * math.cos(ba), ba),
                mat_idx=0,
            )
        finalize_mesh_obj(f"impeller_{tag}", bm_imp, mat_metal, parent=pod, uv_scale=2.4)

        bm_jet = bmesh.new()
        add_swept_curve(bm_jet, [(0.0, 0.0, -0.04), (0.0, 0.0, -0.30)], [0.075, 0.012], segs=10, mat_idx=0)
        finalize_mesh_obj(f"jet_plume_{tag}", bm_jet, mat_aqua, pos=(sx, 0.01, -0.06), parent=chassis)

    # 3. Truss-Framed Shock-Absorber Skids (`skid_FL`, `skid_FR`, `skid_BL`, `skid_BR`)
    skid_specs = [
        ("skid_FL", -0.18, 0.10, -0.34, 0.22),
        ("skid_FR", 0.18, 0.10, 0.34, 0.22),
        ("skid_BL", -0.18, -0.10, -0.36, -0.22),
        ("skid_BR", 0.18, -0.10, 0.36, -0.22),
    ]
    for snm, hx, hz, fx, fz in skid_specs:
        bm_sk = bmesh.new()
        dx, dz = fx - hx, fz - hz
        add_swept_curve(bm_sk, [(0.0, 0.02, 0.0), (dx, -0.29, dz + 0.03)], 0.018, segs=6, mat_idx=0)
        add_swept_curve(bm_sk, [(0.0, -0.03, -0.03), (dx, -0.30, dz - 0.03)], 0.015, segs=6, mat_idx=0)
        # Upturned twin-tip hydrofoil ski
        add_swept_curve(
            bm_sk,
            [(dx, -0.31, dz - 0.12), (dx, -0.315, dz + 0.08), (dx, -0.27, dz + 0.16)],
            [(0.030, 0.012), (0.034, 0.014), (0.018, 0.008)],
            segs=6,
            mat_idx=1,
        )
        add_bevel_box(bm_sk, (dx, -0.322, dz), (0.058, 0.012, 0.18), bevel=0.003, mat_idx=2)
        finalize_mesh_obj(snm, bm_sk, [mat_metal, mat_hull, mat_aqua], pos=(hx, -0.02, hz), parent=chassis, uv_scale=2.2)

    return export_glb_and_inspect(os.path.join(OUT_MODELS_DIR, "enemy_rail_skater.glb"))


# ==============================================================================
# ENEMY 5: `barnacle_mortar` — Barnacle Geyser-Mortar (`enemy_barnacle_mortar.glb`)
# ==============================================================================

def build_enemy_barnacle_mortar():
    reset_scene()
    tex_bn = load_baked_pbr_bundle("barnacle_mortar", has_emissive=True)
    tex_metal = load_baked_pbr_bundle("weathered_metal", has_emissive=False)

    mat_reef = make_pbr_mat(
        "mat_mortar_reef", "#5c5163", roughness=0.76, metallic=0.06, coat=0.0,
        emission_hex="#ea580c", emission_strength=0.65, tex_bundle=tex_bn, normal_strength=1.45
    )
    mat_metal = make_pbr_mat("mat_mortar_copper", "#8c5c2e", roughness=0.45, metallic=0.86, tex_bundle=tex_metal, normal_strength=1.3)
    mat_tooth = make_pbr_mat("mat_mortar_tooth", "#dfd3c8", roughness=0.65, metallic=0.04)
    mat_core = make_pbr_mat("mat_mortar_core", "#f97316", roughness=0.14, emission_hex="#ea580c", emission_strength=1.10)
    mat_bubble = make_pbr_mat(
        "mat_mortar_bubble", "#0891b2", roughness=0.06, coat=1.0, alpha=0.72,
        transmission=0.45, emission_hex="#06b6d4", emission_strength=0.80
    )

    root = make_empty_node("BarnacleMortarRoot", (0.0, 0.0, 0.0))
    turret = make_empty_node("mortar_turret", (0.0, 0.0, 0.0), rot=(0.18, 0.0, 0.0), parent=root)

    # 1. Craggy Asymmetric 7-Cluster Barnacle Reef Base + Bolted Iron Anchor Clamps (`reef_base`)
    bm_b = bmesh.new()
    b_stations = [(0.00, 0.42, 0.40), (0.15, 0.37, 0.35), (0.30, 0.31, 0.29), (0.43, 0.25, 0.24)]
    b_rings = []
    for y, rx, rz in b_stations:
        ring = []
        for s in range(20):
            a = (2.0 * math.pi * s) / 20.0
            flute = 1.0 + 0.095 * math.cos(a * 7.0) + 0.04 * math.sin(a * 3.0)
            ring.append((math.cos(a) * rx * flute, y, math.sin(a) * rz * flute))
        b_rings.append(ring)
    add_loft_rings(bm_b, b_rings, closed=True, cap_start=True, cap_end=True, mat_idx=0)

    for k in range(6):
        ka = (2.0 * math.pi * k) / 6.0 + 0.35
        h_sub = 0.20 + (k % 3) * 0.06
        r_sub = 0.13 - (k % 2) * 0.025
        add_swept_curve(
            bm_b,
            [(math.cos(ka) * 0.32, 0.01, math.sin(ka) * 0.30), (math.cos(ka) * 0.26, h_sub, math.sin(ka) * 0.25)],
            [r_sub, r_sub * 0.52],
            segs=9,
            mat_idx=0,
        )
        # Bolted iron anchor claw-brackets around perimeter
        add_bevel_box(bm_b, (math.cos(ka) * 0.36, 0.12, math.sin(ka) * 0.34), (0.07, 0.20, 0.09), bevel=0.010, rot_t3=(0.0, -ka, 0.0), mat_idx=1)

    add_swept_curve(bm_b, [(0.0, 0.16, 0.0), (0.0, 0.21, 0.0)], 0.36, segs=18, mat_idx=1)
    add_swept_curve(bm_b, [(0.0, 0.38, 0.0), (0.0, 0.42, 0.0)], 0.27, segs=18, mat_idx=1)
    finalize_mesh_obj("reef_base", bm_b, [mat_reef, mat_metal], parent=turret, uv_scale=1.8)

    # 2. 5 Thick Toothed & Rifled Calcified Shell Petals (`petal_pivot_0..4`)
    for i in range(5):
        yaw = (2.0 * math.pi * i) / 5.0
        piv = make_empty_node(f"petal_pivot_{i}", (math.sin(yaw) * 0.22, 0.42, math.cos(yaw) * 0.22), rot=(0.0, yaw, 0.0), parent=turret)
        bm_p = bmesh.new()
        add_swept_curve(
            bm_p,
            [(0.0, 0.0, 0.0), (0.0, 0.16, -0.05), (0.0, 0.31, -0.16)],
            [(0.125, 0.044), (0.100, 0.036), (0.026, 0.016)],
            segs=8,
            mat_idx=0,
        )
        # Internal rifled bronze barrel rail + jagged shell rim teeth
        add_bevel_box(bm_p, (0.0, 0.14, -0.075), (0.055, 0.22, 0.024), bevel=0.005, rot_t3=(0.42, 0.0, 0.0), mat_idx=1)
        for sx in (-0.07, 0.07):
            add_swept_curve(bm_p, [(sx, 0.18, -0.07), (sx * 0.7, 0.25, -0.13)], [0.018, 0.004], segs=5, mat_idx=2)
        finalize_mesh_obj(f"petal_{i}", bm_p, [mat_reef, mat_metal, mat_tooth], parent=piv, uv_scale=2.2)

    bm_c = bmesh.new()
    add_ellipsoid(bm_c, (0.0, 0.0, 0.0), (0.165, 0.125, 0.165), u_segs=14, v_segs=10, mat_idx=0)
    finalize_mesh_obj("pressure_core", bm_c, mat_core, pos=(0.0, 0.43, 0.0), parent=turret)

    bm_bub = bmesh.new()
    add_ellipsoid(bm_bub, (0.0, 0.0, 0.0), (0.16, 0.16, 0.16), u_segs=18, v_segs=14, mat_idx=0)
    finalize_mesh_obj("mortar_bubble", bm_bub, mat_bubble, pos=(0.0, 0.54, 0.0), parent=turret)

    return export_glb_and_inspect(os.path.join(OUT_MODELS_DIR, "enemy_barnacle_mortar.glb"))


# ==============================================================================
# ENEMY 6: `vent_stalker` — Thermal Vent-Stalker (`enemy_vent_stalker.glb`)
# ==============================================================================

def build_enemy_vent_stalker():
    reset_scene()
    tex_vs = load_baked_pbr_bundle("vent_stalker", has_emissive=True)
    tex_metal = load_baked_pbr_bundle("weathered_metal", has_emissive=False)

    mat_skin = make_pbr_mat(
        "mat_stalker_skin", "#1e293b", roughness=0.58, metallic=0.18, coat=0.08,
        emission_hex="#ea580c", emission_strength=0.65, tex_bundle=tex_vs, normal_strength=1.45
    )
    mat_bronze = make_pbr_mat("mat_stalker_bronze", "#8c5c2e", roughness=0.44, metallic=0.86, tex_bundle=tex_metal, normal_strength=1.25)
    mat_crystal = make_pbr_mat("mat_stalker_crystal", "#0891b2", roughness=0.10, coat=0.9, alpha=0.88, emission_hex="#06b6d4", emission_strength=0.95)
    mat_vent_fire = make_pbr_mat("mat_stalker_vent", "#f97316", roughness=0.12, emission_hex="#ea580c", emission_strength=1.15)

    root = make_empty_node("VentStalkerRoot", (0.0, 0.0, 0.0))
    body = make_empty_node("stalker_body", (0.0, 0.0, 0.0), parent=root)

    # 1. Armored Basalt Salamander Torso + Overlapping Dorsal Osteoderm Scutes!
    bm_t = bmesh.new()
    t_stations = [(-0.26, 0.10, 0.085), (-0.12, 0.16, 0.115), (0.04, 0.17, 0.120), (0.18, 0.15, 0.105), (0.26, 0.105, 0.085)]
    t_rings = [
        [(math.cos((2.0 * math.pi * s) / 14) * rx, 0.20 + math.sin((2.0 * math.pi * s) / 14) * ry, z) for s in range(14)]
        for z, rx, ry in t_stations
    ]
    add_loft_rings(bm_t, t_rings, closed=True, cap_start=True, cap_end=True, mat_idx=0)
    for sz_plate in (-0.18, -0.06, 0.06, 0.18):
        for sx in (-0.11, 0.11):
            add_bevel_box(bm_t, (sx, 0.25, sz_plate), (0.09, 0.032, 0.10), bevel=0.008, rot_t3=(0.0, 0.0, -sx * 3.2), mat_idx=0)
    finalize_mesh_obj("stalker_torso", bm_t, mat_skin, parent=body, uv_scale=2.2)

    # 2. Craggy Encrusted Hydrothermal Chimneys & Jagged Multi-Shard Cryo-Crystals (`dorsal_vents`)
    bm_v = bmesh.new()
    for vz, vh, vr in ((-0.16, 0.14, 0.038), (-0.02, 0.18, 0.046), (0.12, 0.15, 0.042)):
        for sx in (-0.06, 0.06):
            add_swept_curve(bm_v, [(sx, 0.28, vz), (sx * 1.45, 0.28 + vh, vz - 0.03)], [vr * 1.15, vr * 0.95], segs=7, mat_idx=0)
            add_ellipsoid(bm_v, (sx * 1.45, 0.28 + vh, vz - 0.03), (vr * 0.78, 0.02, vr * 0.78), u_segs=7, v_segs=5, mat_idx=2)
        # Asymmetric faceted 3-prong frost crystal cluster
        for ca, cr_h in ((0.0, 1.30), (-0.28, 0.85), (0.30, 0.80)):
            add_swept_curve(
                bm_v,
                [(ca * 0.08, 0.29, vz + 0.02), (ca * 0.22, 0.29 + vh * cr_h, vz - 0.01)],
                [0.034, 0.004],
                segs=5,
                mat_idx=1,
            )
    finalize_mesh_obj("dorsal_vents", bm_v, [mat_bronze, mat_crystal, mat_vent_fire], parent=body, uv_scale=2.4)

    # 3. Horned Fanged Reptile Skull (`stalker_head`)
    bm_h = bmesh.new()
    add_swept_curve(
        bm_h,
        [(0.0, 0.0, -0.02), (0.0, 0.015, 0.11), (0.0, -0.01, 0.24)],
        [(0.130, 0.092), (0.118, 0.076), (0.056, 0.036)],
        segs=10,
        mat_idx=0,
    )
    for sx in (-1.0, 1.0):
        # Chiseled supraorbital brow horn + gill spikes + glowing thermal eye
        add_bevel_box(bm_h, (sx * 0.08, 0.065, 0.08), (0.045, 0.028, 0.11), bevel=0.006, rot_t3=(-0.2, sx * 0.25, -sx * 0.4), mat_idx=0)
        add_ellipsoid(bm_h, (sx * 0.090, 0.035, 0.10), (0.022, 0.024, 0.038), u_segs=8, v_segs=6, mat_idx=2)
        add_swept_curve(bm_h, [(sx * 0.10, 0.03, 0.01), (sx * 0.19, 0.09, -0.10)], [0.026, 0.005], segs=5, mat_idx=1)
        add_swept_curve(bm_h, [(sx * 0.10, -0.01, 0.02), (sx * 0.17, 0.02, -0.08)], [0.020, 0.005], segs=5, mat_idx=1)
    finalize_mesh_obj("stalker_head", bm_h, [mat_skin, mat_crystal, mat_vent_fire], pos=(0.0, 0.22, 0.25), parent=body, uv_scale=2.4)

    # 4. Scuted Whip Tail (`tail_1` -> `tail_2`)
    t1 = make_empty_node("tail_1", (0.0, 0.20, -0.25), parent=body)
    bm_t1 = bmesh.new()
    add_swept_curve(bm_t1, [(0.0, 0.0, 0.0), (0.0, -0.02, -0.24)], [(0.098, 0.084), (0.056, 0.052)], segs=10, mat_idx=0)
    for tz in (-0.06, -0.16):
        add_swept_curve(bm_t1, [(0.0, 0.05, tz), (0.0, 0.12, tz - 0.03)], [0.024, 0.005], segs=5, mat_idx=1)
    finalize_mesh_obj("tail_1_mesh", bm_t1, [mat_skin, mat_crystal], parent=t1, uv_scale=2.4)

    t2 = make_empty_node("tail_2", (0.0, -0.02, -0.23), parent=t1)
    bm_t2 = bmesh.new()
    add_swept_curve(bm_t2, [(0.0, 0.0, 0.0), (0.0, 0.01, -0.27)], [(0.054, 0.048), (0.008, 0.012)], segs=8, mat_idx=0)
    add_swept_curve(bm_t2, [(0.0, 0.03, -0.06), (0.0, 0.10, -0.14), (0.0, 0.01, -0.26)], [0.018, 0.022, 0.004], segs=5, mat_idx=1)
    finalize_mesh_obj("tail_2_mesh", bm_t2, [mat_skin, mat_crystal], parent=t2, uv_scale=2.4)

    # 5. 3-Clawed Muscular Reptilian Limbs (`leg_FL`, `leg_FR`, `leg_BL`, `leg_BR`)
    legs = [
        ("leg_FL", -0.14, 0.14, -0.18, 0.08),
        ("leg_FR", 0.14, 0.14, 0.18, 0.08),
        ("leg_BL", -0.14, -0.14, -0.19, -0.07),
        ("leg_BR", 0.14, -0.14, 0.19, -0.07),
    ]
    for lnm, hx, hz, dx, dz in legs:
        bm_l = bmesh.new()
        add_swept_curve(bm_l, [(0.0, 0.0, 0.0), (dx * 0.65, 0.04, dz * 0.5), (dx, -0.17, dz)], [0.048, 0.038, 0.026], segs=8, mat_idx=0)
        for ci in (-1, 0, 1):
            add_swept_curve(bm_l, [(dx, -0.17, dz), (dx + ci * 0.032, -0.18, dz + 0.065)], [0.014, 0.003], segs=5, mat_idx=1)
        finalize_mesh_obj(lnm, bm_l, [mat_skin, mat_crystal], pos=(hx, 0.18, hz), parent=body, uv_scale=2.4)

    return export_glb_and_inspect(os.path.join(OUT_MODELS_DIR, "enemy_vent_stalker.glb"))


# ==============================================================================
# ENEMY 7: `siphon_warden` — Siphon Warden Leviathan-Mech (`enemy_siphon_warden.glb`)
# ==============================================================================

def build_enemy_siphon_warden():
    reset_scene()
    tex_wd = load_baked_pbr_bundle("siphon_warden", has_emissive=True)
    tex_metal = load_baked_pbr_bundle("weathered_metal", has_emissive=False)

    mat_armor = make_pbr_mat(
        "mat_warden_armor", "#141d38", roughness=0.44, metallic=0.62, coat=0.08,
        emission_hex="#06b6d4", emission_strength=0.65, tex_bundle=tex_wd, normal_strength=1.40
    )
    mat_gold = make_pbr_mat("mat_warden_gold", "#d49b35", roughness=0.32, metallic=0.92, tex_bundle=tex_metal, normal_strength=1.2)
    mat_shield = make_pbr_mat(
        "mat_warden_shield", "#0284c7", roughness=0.10, metallic=0.18, coat=0.9,
        alpha=0.74, emission_hex="#06b6d4", emission_strength=0.85
    )
    mat_core = make_pbr_mat("mat_warden_core", "#c026d3", roughness=0.08, emission_hex="#d946ef", emission_strength=1.20)
    mat_lance = make_pbr_mat("mat_warden_lance", "#06b6d4", roughness=0.08, emission_hex="#22d3ee", emission_strength=1.10)

    root = make_empty_node("SiphonWardenRoot", (0.0, 0.0, 0.0))
    body = make_empty_node("warden_body", (0.0, 0.0, 0.0), parent=root)

    # 1. Chiseled Faceted Obsidian War-Helm, 3-Tier Shoulder Pauldrons, Mandibles & Thoracic Ribs (`warden_mantle`)
    bm_m = bmesh.new()
    m_stations = [
        (-0.66, 0.06, 0.06),
        (-0.40, 0.22, 0.17),
        (-0.10, 0.36, 0.24),
        (0.24, 0.45, 0.28),
        (0.54, 0.48, 0.28),
        (0.78, 0.30, 0.18),
        (0.94, 0.10, 0.08),
    ]
    m_rings = []
    for y, rx, rz in m_stations:
        ring = []
        for s in range(12):  # 12-sided chiseled armor facets instead of blobby egg!
            a = (2.0 * math.pi * s) / 12.0
            hood = 1.25 if abs(math.cos(a)) > 0.50 and y > 0.15 else 1.0
            ring.append((math.cos(a) * rx * hood, y, math.sin(a) * rz - 0.08))
        m_rings.append(ring)
    add_loft_rings(bm_m, m_rings, closed=True, cap_start=True, cap_end=True, mat_idx=0)

    # 3-Tier Overlapping Winged Shoulder Pauldrons + Lower Mechanical Mandible Tusks + Thoracic Ribs!
    for sx in (-1.0, 1.0):
        for tier_i in range(3):
            ty = 0.28 + tier_i * 0.14
            tx = sx * (0.42 + tier_i * 0.10)
            add_bevel_box(bm_m, (tx, ty, -0.03), (0.34, 0.11, 0.24), bevel=0.014, rot_t3=(0.0, -sx * 0.22, sx * (0.28 + tier_i * 0.12)), mat_idx=0)
            add_bevel_box(bm_m, (tx * 1.06, ty + 0.04, 0.02), (0.30, 0.03, 0.20), bevel=0.006, rot_t3=(0.0, -sx * 0.22, sx * (0.28 + tier_i * 0.12)), mat_idx=1)
        # Lower mechanical mandible tusks framing the Siphon Core
        add_swept_curve(bm_m, [(sx * 0.32, -0.08, 0.06), (sx * 0.22, -0.26, 0.22)], [0.045, 0.012], segs=6, mat_idx=1)

    # Sovereign Gold Pelagian Trident Crown
    for sx, h_top in ((-1.0, 1.16), (0.0, 1.30), (1.0, 1.16)):
        add_swept_curve(bm_m, [(sx * 0.18, 0.74, 0.0), (sx * 0.28, h_top, -0.08)], [(0.056, 0.036), (0.010, 0.008)], segs=6, mat_idx=1)
    # War-Helm Brow Crest & 4 Fierce Glowing Slit Visors
    add_swept_curve(
        bm_m,
        [(-0.36, 0.59, 0.14), (-0.17, 0.52, 0.24), (0.0, 0.49, 0.28), (0.17, 0.52, 0.24), (0.36, 0.59, 0.14)],
        (0.026, 0.038),
        segs=6,
        mat_idx=1,
    )
    for sx in (-1.0, 1.0):
        add_swept_curve(bm_m, [(sx * 0.08, 0.49, 0.24), (sx * 0.25, 0.54, 0.19)], [(0.026, 0.016), (0.016, 0.010)], segs=6, mat_idx=2)
        add_swept_curve(bm_m, [(sx * 0.14, 0.57, 0.21), (sx * 0.31, 0.62, 0.14)], [(0.020, 0.014), (0.014, 0.010)], segs=6, mat_idx=2)
    finalize_mesh_obj("warden_mantle", bm_m, [mat_armor, mat_gold, mat_lance], parent=body, uv_scale=1.5)

    # 2. Geared Astrolabe Siphon Core (`siphon_core_outer`, `siphon_core_inner`, `siphon_singularity`)
    core_pos = (0.0, 0.10, 0.22)
    bm_go = bmesh.new()
    go_pts = [(math.cos((2.0 * math.pi * k) / 24) * 0.28, math.sin((2.0 * math.pi * k) / 24) * 0.28, 0.0) for k in range(25)]
    add_swept_curve(bm_go, go_pts, (0.024, 0.036), segs=6, mat_idx=0)
    for k in range(12):
        ka = (2.0 * math.pi * k) / 12.0
        add_bevel_box(bm_go, (math.cos(ka) * 0.305, math.sin(ka) * 0.305, 0.0), (0.042, 0.032, 0.044), bevel=0.004, rot_t3=(0.0, 0.0, ka), mat_idx=1)
    finalize_mesh_obj("siphon_core_outer", bm_go, [mat_gold, mat_armor], pos=core_pos, parent=body, uv_scale=2.0)

    bm_gi = bmesh.new()
    gi_pts = [(math.cos((2.0 * math.pi * k) / 20) * 0.19, 0.0, math.sin((2.0 * math.pi * k) / 20) * 0.19) for k in range(21)]
    add_swept_curve(bm_gi, gi_pts, 0.022, segs=6, mat_idx=0)
    finalize_mesh_obj("siphon_core_inner", bm_gi, mat_gold, pos=core_pos, parent=body, uv_scale=2.0)

    bm_sg = bmesh.new()
    add_ellipsoid(bm_sg, (0.0, 0.0, 0.0), (0.125, 0.125, 0.125), u_segs=12, v_segs=8, mat_idx=0)
    finalize_mesh_obj("siphon_singularity", bm_sg, mat_core, pos=core_pos, parent=body, smooth=False)

    # 3. 4 Ornate Bladed Pelagian Aegis Halberd-Shields (`shield_orbit` -> `shield_0..3`)
    sh_orbit = make_empty_node("shield_orbit", core_pos, parent=body)
    for i in range(4):
        sa = (2.0 * math.pi * i) / 4.0 + math.pi * 0.25
        sx, sy = math.cos(sa) * 0.58, math.sin(sa) * 0.58
        bm_sh = bmesh.new()
        kite_stations = [(-0.22, 0.015, 0.012), (-0.06, 0.12, 0.024), (0.10, 0.14, 0.026), (0.24, 0.02, 0.012)]
        k_rings = [
            [(math.cos((2.0 * math.pi * s) / 6) * kw, ky, math.sin((2.0 * math.pi * s) / 6) * kt + 0.04) for s in range(6)]
            for ky, kw, kt in kite_stations
        ]
        add_loft_rings(bm_sh, k_rings, closed=True, cap_start=True, cap_end=True, mat_idx=0)
        # Ornate gold armor bezel & central spine boss
        add_bevel_box(bm_sh, (0.02, 0.02, 0.045), (0.05, 0.34, 0.032), bevel=0.006, mat_idx=1)
        add_swept_curve(
            bm_sh,
            [(-0.13, -0.05, 0.05), (0.0, 0.23, 0.055), (0.13, -0.05, 0.05), (0.0, -0.21, 0.05)],
            0.018,
            segs=6,
            mat_idx=1,
        )
        finalize_mesh_obj(f"shield_{i}", bm_sh, [mat_shield, mat_gold], pos=(sx, sy, 0.02), rot=(0.0, 0.0, sa - math.pi * 0.5), parent=sh_orbit, uv_scale=2.0)

    # 4. 4 Segmented Vertebra-Armored Kraken Tentacles + Tri-Pronged Siphon Claw-Tridents (`tentacle_0..3`)
    tent_anchors = [
        (-0.42, 0.22, -0.02, -1.0, 0.42),
        (0.42, 0.22, -0.02, 1.0, 0.42),
        (-0.36, -0.22, 0.0, -1.0, -0.38),
        (0.36, -0.22, 0.0, 1.0, -0.38),
    ]
    for i, (ax, ay, az, sx, sy_bias) in enumerate(tent_anchors):
        t_prox = make_empty_node(f"tentacle_{i}", (ax, ay, az), parent=body)
        bm_tp = bmesh.new()
        p_curve = [(0.0, 0.0, 0.0), (sx * 0.28, sy_bias * 0.22, 0.10), (sx * 0.48, sy_bias * 0.10, 0.24)]
        add_swept_curve(bm_tp, p_curve, [0.082, 0.066, 0.052], segs=8, mat_idx=0)
        # Segmented gold vertebra armor collars along arm!
        for vf in (0.25, 0.55, 0.85):
            vx = sx * 0.48 * vf
            vy = sy_bias * 0.16 * math.sin(vf * math.pi)
            vz = 0.24 * vf
            add_bevel_box(bm_tp, (vx, vy, vz), (0.13, 0.13, 0.045), bevel=0.008, rot_t3=(0.0, sx * 0.6, 0.0), mat_idx=1)
        finalize_mesh_obj(f"tentacle_prox_{i}", bm_tp, [mat_armor, mat_gold], parent=t_prox, uv_scale=2.0)

        t_dist = make_empty_node(f"tentacle_tip_{i}", (sx * 0.48, sy_bias * 0.10, 0.24), parent=t_prox)
        bm_td = bmesh.new()
        add_swept_curve(bm_td, [(0.0, 0.0, 0.0), (sx * 0.16, -0.15, 0.18), (-sx * 0.04, -0.26, 0.34)], [0.050, 0.036, 0.024], segs=8, mat_idx=0)
        # Tri-pronged glowing plasma siphon claw-trident!
        for ca in (-0.06, 0.0, 0.06):
            add_swept_curve(
                bm_td,
                [(-sx * 0.04, -0.26 + ca * 0.5, 0.34), (-sx * 0.12 + ca, -0.35 + ca, 0.48)],
                [0.018, 0.003],
                segs=5,
                mat_idx=1,
            )
        finalize_mesh_obj(f"tentacle_dist_{i}", bm_td, [mat_armor, mat_lance], parent=t_dist, uv_scale=2.0)

    return export_glb_and_inspect(os.path.join(OUT_MODELS_DIR, "enemy_siphon_warden.glb"))


# ==============================================================================
# MAIN BUILD ENTRYPOINT
# ==============================================================================

def main():
    if os.path.exists(SENTINEL_PATH):
        try:
            os.remove(SENTINEL_PATH)
        except OSError:
            pass

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
    with open(SENTINEL_PATH, "w", encoding="utf-8") as f:
        json.dump({"ok": True, "count": len(results), "models": results}, f, indent=2)


if __name__ == "__main__":
    try:
        main()
    except Exception:
        with open(SENTINEL_PATH, "w", encoding="utf-8") as ef:
            json.dump({"ok": False, "error": traceback.format_exc()}, ef, indent=2)
        raise
