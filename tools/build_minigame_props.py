"""
TOWERING WATERS: GATEWAY'S DESCENT — Signature Mini-Games 3D Prop Pipeline
===========================================================================
Generates mobile-optimized, subdiv-smoothed, PBR-textured `.glb` 3D props
in `assets/models/` for all 5 Gateway-centric mini-games:
  1. `core_reactor_props.glb` (`core_descent` Central Reactor Shaft Dive):
     - `reactor_turbine`: 5-blade + 1-open-sector hydro-turbine rotor
     - `siphon_crystal_lock`: Hydraulic-clawed Siphon Crystal Core lock
     - `harmonic_seed_anchor`: Bedrock sea-glass & bronze lotus receptacle
  2. `sea_turtle.glb` (`reef_swim` Rescued Reef Sea Turtle w/ articulated flippers)
  3. `river_otter.glb` (`reef_swim` / `rapids_surf` Rescued River Otter w/ tail)
  4. `siphon_cage.glb` (`reef_swim` Siphon Containment Cage w/ shatterable lock)
  5. `alien_fish_1.glb` & `alien_fish_2.glb` (Vibrant Reef Dartfish & Spotted Eagle Ray)
  6. `sea_mine.glb` (Barnacled Copper-Iron Siphon Surge Mine)
  7. `warp_cavern.glb` (Sunlit Coral-Limestone & Sea-Glass Reef Grotto Arch)
  8. `puzzle_props.glb` (`aqueduct_sanctum` 4-prop pack: Harmonic Water-Bell,
     Crystal Prism Turret, Travertine Sluice Block, Sunlit Aqueduct Valve Brazier)
"""

import bpy
import bmesh
from mathutils import Vector, Matrix
import math
import json
import struct
import traceback
import os

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_DIR = os.path.dirname(SCRIPT_DIR)
OUT_MODELS_DIR = os.path.join(PROJECT_DIR, "assets", "models")
DONE_PATH = os.path.join(OUT_MODELS_DIR, "_minigame_props_done.json")
ERR_PATH = os.path.join(OUT_MODELS_DIR, "_minigame_props_error.txt")

os.makedirs(OUT_MODELS_DIR, exist_ok=True)
for stale in (DONE_PATH, ERR_PATH):
    if os.path.exists(stale):
        try:
            os.remove(stale)
        except OSError:
            pass


# ==============================================================================
# 1. COORDINATE BIJECTION (Three.js Y-Up <-> Blender Z-Up) & MATH HELPERS
# ==============================================================================

def v3(tx, ty, tz):
    """Map Three.js `(tx, ty, tz)` -> Blender `(tx, -tz, ty)` for exact glTF Y-up."""
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
    return (
        0.55 * _vnoise(x, y)
        + 0.30 * _vnoise(x * 2.03 + 7.1, y * 2.03 + 3.7)
        + 0.15 * _vnoise(x * 4.11 + 13.3, y * 4.11 + 9.2)
    )


# ==============================================================================
# 2. PROCEDURAL PBR TEXTURE GENERATORS
# ==============================================================================

def create_travertine_stone_normal(size=128):
    img = bpy.data.images.new("AqueductStone_Normal", width=size, height=size, alpha=False)
    img.colorspace_settings.name = "Non-Color"
    px = [0.0] * (size * size * 4)
    hmap = [0.0] * (size * size)
    for y in range(size):
        v = y / float(size)
        for x in range(size):
            u = x / float(size)
            a1 = u * math.pi * 2.0
            b1 = v * math.pi * 2.0
            h = (
                0.42 * math.sin(a1 * 3.0 + 0.4) * math.cos(b1 * 2.0 - 0.3)
                + 0.28 * math.sin(a1 * 7.0 - b1 * 5.0)
                + 0.18 * math.cos(a1 * 13.0 + b1 * 11.0)
                + 0.12 * math.sin(a1 * 21.0 - b1 * 17.0)
            )
            vein = abs(math.sin(a1 * 2.0 + math.sin(b1 * 3.0) * 0.75))
            if vein < 0.04:
                h -= (1.0 - vein / 0.04) * 0.45
            hmap[y * size + x] = h

    for y in range(size):
        ym, yp = (y - 1) % size, (y + 1) % size
        for x in range(size):
            xm, xp = (x - 1) % size, (x + 1) % size
            dx = (hmap[y * size + xp] - hmap[y * size + xm]) * 0.78
            dy = (hmap[yp * size + x] - hmap[ym * size + x]) * 0.78
            nx, ny = -dx, -dy
            inv = 1.0 / math.sqrt(nx * nx + ny * ny + 1.0)
            idx = (y * size + x) * 4
            px[idx], px[idx + 1], px[idx + 2], px[idx + 3] = (
                0.5 + 0.5 * nx * inv,
                0.5 + 0.5 * ny * inv,
                0.5 + 0.5 * inv,
                1.0,
            )
    img.pixels = px
    img.pack()
    return img


def create_turtle_shell_maps(size=128):
    alb = bpy.data.images.new("TurtleShell_Albedo", width=size, height=size, alpha=False)
    nrm = bpy.data.images.new("TurtleShell_Normal", width=size, height=size, alpha=False)
    nrm.colorspace_settings.name = "Non-Color"
    apx = [0.0] * (size * size * 4)
    npx = [0.0] * (size * size * 4)
    hmap = [0.0] * (size * size)

    c_deep = hex_srgb("#134e4a")
    c_mid = hex_srgb("#2a8a78")
    c_gold = hex_srgb("#d4a359")
    c_seam = hex_srgb("#0b2926")

    for y in range(size):
        v = y / float(size - 1)
        for x in range(size):
            u = x / float(size - 1)
            # Voronoi-like scute plates
            gx, gy = u * 5.0, v * 4.0
            ix, iy = int(math.floor(gx)), int(math.floor(gy))
            d1, d2 = 9.0, 9.0
            for oy in (-1, 0, 1):
                for ox in (-1, 0, 1):
                    cx = ix + ox + 0.22 + 0.56 * _hash2(ix + ox, iy + oy)
                    cy = iy + oy + 0.22 + 0.56 * _hash2(ix + ox + 31, iy + oy + 17)
                    dd = math.hypot(gx - cx, gy - cy)
                    if dd < d1:
                        d2 = d1
                        d1 = dd
                    elif dd < d2:
                        d2 = dd
            edge = clamp01((d2 - d1) / 0.16)
            sunburst = 0.5 + 0.5 * math.sin(d1 * 26.0 + _fbm(u * 8.0, v * 8.0) * 2.5)
            col = lerp3(c_gold, c_mid, clamp01(d1 * 1.45))
            col = lerp3(col, c_deep, sunburst * 0.42)
            col = lerp3(c_seam, col, smoothstep(0.0, 0.45, edge))
            idx = (y * size + x) * 4
            apx[idx], apx[idx + 1], apx[idx + 2], apx[idx + 3] = (
                srgb_to_lin(col[0]),
                srgb_to_lin(col[1]),
                srgb_to_lin(col[2]),
                1.0,
            )
            hmap[y * size + x] = smoothstep(0.0, 0.5, edge) * (1.0 - d1 * 0.35)

    for y in range(size):
        ym, yp = (y - 1) % size, (y + 1) % size
        for x in range(size):
            xm, xp = (x - 1) % size, (x + 1) % size
            dx = (hmap[y * size + xp] - hmap[y * size + xm]) * 1.35
            dy = (hmap[yp * size + x] - hmap[ym * size + x]) * 1.35
            nx, ny = -dx, -dy
            inv = 1.0 / math.sqrt(nx * nx + ny * ny + 1.0)
            idx = (y * size + x) * 4
            npx[idx], npx[idx + 1], npx[idx + 2], npx[idx + 3] = (
                0.5 + 0.5 * nx * inv,
                0.5 + 0.5 * ny * inv,
                0.5 + 0.5 * inv,
                1.0,
            )
    alb.pixels = apx
    nrm.pixels = npx
    alb.pack()
    nrm.pack()
    return alb, nrm


def create_reef_fish_albedo(size=128, base_hex="#0284c7", stripe_hex="#5efce8", fin_hex="#fbbf24"):
    img = bpy.data.images.new("ReefFish_" + base_hex.lstrip("#"), width=size, height=size, alpha=False)
    px = [0.0] * (size * size * 4)
    cb = hex_srgb(base_hex)
    cs = hex_srgb(stripe_hex)
    cf = hex_srgb(fin_hex)
    for y in range(size):
        v = y / float(size - 1)
        for x in range(size):
            u = x / float(size - 1)
            band = 0.5 + 0.5 * math.sin(u * math.pi * 9.0 + math.sin(v * math.pi * 3.0) * 1.3)
            spots = smoothstep(0.70, 0.88, _vnoise(u * 16.0, v * 14.0))
            belly = smoothstep(0.56, 0.14, v) * 0.48
            col = lerp3(cb, cs, (band ** 3) * 0.65 + belly)
            col = lerp3(col, cf, spots * 0.78)
            idx = (y * size + x) * 4
            px[idx], px[idx + 1], px[idx + 2], px[idx + 3] = (
                srgb_to_lin(col[0]),
                srgb_to_lin(col[1]),
                srgb_to_lin(col[2]),
                1.0,
            )
    img.pixels = px
    img.pack()
    return img


def create_siphon_metal_maps(size=128):
    alb = bpy.data.images.new("SiphonMetal_Albedo", width=size, height=size, alpha=False)
    nrm = bpy.data.images.new("SiphonMetal_Normal", width=size, height=size, alpha=False)
    nrm.colorspace_settings.name = "Non-Color"
    apx = [0.0] * (size * size * 4)
    npx = [0.0] * (size * size * 4)
    c_iron = hex_srgb("#223042")
    c_copper = hex_srgb("#8c4a27")
    c_patina = hex_srgb("#2c6e63")
    for y in range(size):
        v = y / float(size - 1)
        for x in range(size):
            u = x / float(size - 1)
            n1 = _fbm(u * 9.0, v * 9.0)
            n2 = _vnoise(u * 24.0, v * 24.0)
            col = lerp3(c_iron, c_copper, smoothstep(0.46, 0.78, n1))
            col = lerp3(col, c_patina, smoothstep(0.62, 0.88, n2) * 0.5)
            idx = (y * size + x) * 4
            apx[idx], apx[idx + 1], apx[idx + 2], apx[idx + 3] = (
                srgb_to_lin(col[0]),
                srgb_to_lin(col[1]),
                srgb_to_lin(col[2]),
                1.0,
            )
            nx, ny = (n2 - 0.5) * 0.42, (n1 - 0.5) * 0.42
            nz = math.sqrt(max(0.2, 1.0 - nx * nx - ny * ny))
            npx[idx], npx[idx + 1], npx[idx + 2], npx[idx + 3] = (
                0.5 + 0.5 * nx,
                0.5 + 0.5 * ny,
                0.5 + 0.5 * nz,
                1.0,
            )
    alb.pixels = apx
    nrm.pixels = npx
    alb.pack()
    nrm.pack()
    return alb, nrm


# ==============================================================================
# 3. MATERIAL & BMESH BUILDERS
# ==============================================================================

def make_mat(
    name,
    hex_color,
    roughness=0.42,
    metallic=0.0,
    coat=0.0,
    coat_rough=0.08,
    emission_hex=None,
    emission_strength=0.0,
    alpha=1.0,
    albedo_img=None,
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

    if emission_hex is not None and emission_strength > 0.0:
        ecol = hex_lin(emission_hex)
        if "Emission Color" in bsdf.inputs:
            bsdf.inputs["Emission Color"].default_value = (ecol[0], ecol[1], ecol[2], 1.0)
            bsdf.inputs["Emission Strength"].default_value = emission_strength

    if albedo_img is not None or normal_img is not None:
        tc = nt.nodes.new("ShaderNodeTexCoord")
        mp = nt.nodes.new("ShaderNodeMapping")
        mp.inputs["Scale"].default_value = (uv_scale, uv_scale, uv_scale)
        nt.links.new(tc.outputs["UV"], mp.inputs["Vector"])

        if albedo_img is not None:
            ta = nt.nodes.new("ShaderNodeTexImage")
            ta.image = albedo_img
            nt.links.new(mp.outputs["Vector"], ta.inputs["Vector"])
            nt.links.new(ta.outputs["Color"], bsdf.inputs["Base Color"])

        if normal_img is not None:
            tn = nt.nodes.new("ShaderNodeTexImage")
            tn.image = normal_img
            nn = nt.nodes.new("ShaderNodeNormalMap")
            nn.inputs["Strength"].default_value = normal_strength
            nt.links.new(mp.outputs["Vector"], tn.inputs["Vector"])
            nt.links.new(tn.outputs["Color"], nn.inputs["Color"])
            nt.links.new(nn.outputs["Normal"], bsdf.inputs["Normal"])

    return mat


def assign_spherical_uvs(bm, scale=1.0):
    uv_layer = bm.loops.layers.uv.verify()
    center = sum((v.co for v in bm.verts), Vector()) / len(bm.verts) if bm.verts else Vector((0.0, 0.0, 0.0))
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


def make_empty_node(name, pos=(0.0, 0.0, 0.0), rot=(0.0, 0.0, 0.0), parent=None):
    obj = bpy.data.objects.new(name, None)
    obj.empty_display_size = 0.05
    obj.location = v3(*pos)
    obj.rotation_euler = rot3(*rot)
    if parent is not None:
        obj.parent = parent
    bpy.context.collection.objects.link(obj)
    return obj


def finalize_mesh_obj(name, bm, materials, pos=(0.0, 0.0, 0.0), rot=(0.0, 0.0, 0.0), parent=None, subdiv_levels=0, smooth=True, uv_scale=1.0):
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
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
        bpy.context.view_layer.objects.active = obj
        bpy.ops.object.modifier_apply(modifier=mod.name)
        for poly in obj.data.polygons:
            poly.use_smooth = smooth

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
    is_per_station = (
        isinstance(radii, (list, tuple))
        and len(radii) == cnt
        and (not isinstance(radii[0], (int, float)) or cnt != 2 or isinstance(radii, list))
    )
    r_list = []
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


def add_ellipsoid(bm, center_t3, radii_t3, u_segs=14, v_segs=10, mat_idx=0, hemi_top_only=False):
    cx, cy, cz = center_t3
    rx, ry, rz = radii_t3
    rings = []
    v_start = 0 if hemi_top_only else 1
    v_count = max(2, v_segs // 2) if hemi_top_only else (v_segs - 1)
    for iv in range(v_start, v_start + v_count):
        phi = (
            (iv / float(max(1, v_count - 1))) * (math.pi * 0.48)
            if hemi_top_only
            else (-math.pi * 0.5 + (iv / float(v_segs)) * math.pi)
        )
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
    return add_loft_rings(bm, rings, closed=True, cap_start=not hemi_top_only, cap_end=True, mat_idx=mat_idx)


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
        _magic, _ver, _total_len = struct.unpack("<III", f.read(12))
        chunk_len, _chunk_type = struct.unpack("<II", f.read(8))
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
# 4. ASSET PACKS FOR ALL 5 GATEWAY MINI-GAMES
# ==============================================================================

def build_core_reactor_props():
    """
    `assets/models/core_reactor_props.glb` for `core_descent`:
      1. `reactor_turbine`: 5 hydrofoil blades + 1 shattered passage gap around angle 0 (+X)
      2. `siphon_crystal_lock`: Glowing crimson-violet Siphon Crystal Core gripped by 3 bronze claws
      3. `harmonic_seed_anchor`: Pearlescent & sea-glass Lotus Bedrock Receptacle
    """
    reset_scene()
    metal_alb, metal_nrm = create_siphon_metal_maps(128)
    mat_titanium = make_mat("mat_titanium", "#1e293b", roughness=0.34, metallic=0.88, albedo_img=metal_alb, normal_img=metal_nrm, normal_strength=0.45)
    mat_bronze = make_mat("mat_bronze", "#c68a3e", roughness=0.26, metallic=0.90)
    mat_siphon_crystal = make_mat("mat_siphon_crystal", "#f43f5e", roughness=0.10, metallic=0.15, coat=1.0, emission_hex="#fb7185", emission_strength=1.75)
    mat_aqua_glow = make_mat("mat_aqua_glow", "#5efce8", roughness=0.12, emission_hex="#22d3ee", emission_strength=1.65)
    mat_pearl = make_mat("mat_pearl", "#e6f7f5", roughness=0.18, metallic=0.22, coat=0.9)

    root = make_empty_node("CoreReactorRoot", (0.0, 0.0, 0.0))

    # 1. `reactor_turbine` (XY plane rotor: 6 sectors, sector 0 at +X is broken stub = safe dive passage!)
    turb_grp = make_empty_node("reactor_turbine", (0.0, 0.0, 0.0), parent=root)
    bm_t = bmesh.new()
    # Central turbine hub & glowing bearing ring
    add_swept_curve(bm_t, [(0.0, 0.0, -0.26), (0.0, 0.0, 0.0), (0.0, 0.0, 0.28)], [0.42, 0.56, 0.34], segs=16, up_t3=(0.0, 1.0, 0.0), mat_idx=1)
    add_swept_curve(bm_t, [(0.0, 0.0, -0.06), (0.0, 0.0, 0.06)], [0.60, 0.60], segs=16, up_t3=(0.0, 1.0, 0.0), mat_idx=3)
    # Outer partial shroud ring (open across sector 0: angles -0.46 .. +0.46 rad!)
    shroud_pts = []
    for k in range(21):
        ang = 0.50 + (k / 20.0) * (math.pi * 2.0 - 1.00)
        shroud_pts.append((math.cos(ang) * 2.42, math.sin(ang) * 2.42, 0.0))
    add_swept_curve(bm_t, shroud_pts, 0.11, segs=8, up_t3=(0.0, 0.0, 1.0), cap_start=True, cap_end=True, mat_idx=0)

    # 5 full hydrofoil blades (sectors 1..5) + 1 broken stub at sector 0
    for b_idx in range(6):
        ang = (b_idx * math.pi * 2.0) / 6.0
        ca, sa = math.cos(ang), math.sin(ang)
        if b_idx == 0:
            add_bevel_box(bm_t, (ca * 0.66, sa * 0.66, 0.0), (0.28, 0.22, 0.10), bevel=0.015, rot_t3=(0.0, 0.0, ang + 0.18), mat_idx=1)
        else:
            for seg in range(4):
                r_mid = 0.72 + seg * 0.42
                w_blade = 0.34 + seg * 0.07
                pitch = 0.34 - seg * 0.04
                add_bevel_box(
                    bm_t,
                    (ca * r_mid, sa * r_mid, math.sin(seg * 0.4) * 0.03),
                    (0.46, w_blade, 0.075),
                    bevel=0.012,
                    rot_t3=(ca * pitch, sa * pitch, ang),
                    mat_idx=0 if seg < 3 else 1,
                )
    finalize_mesh_obj("turbine_rotor", bm_t, [mat_titanium, mat_bronze, mat_siphon_crystal, mat_aqua_glow], parent=turb_grp)

    # 2. `siphon_crystal_lock`
    lock_grp = make_empty_node("siphon_crystal_lock", (5.0, 0.0, 0.0), parent=root)
    bm_l = bmesh.new()
    # Central jagged Siphon crystal cluster
    add_swept_curve(bm_l, [(0.0, -0.58, 0.0), (0.0, 0.0, 0.0), (0.0, 0.62, 0.0)], [0.04, 0.36, 0.03], segs=6, mat_idx=2)
    for k in range(4):
        ka = (k * math.pi * 0.5) + 0.35
        kx, kz = math.cos(ka), math.sin(ka)
        add_swept_curve(
            bm_l,
            [(0.0, -0.1, 0.0), (kx * 0.32, 0.18, kz * 0.32), (kx * 0.46, 0.42, kz * 0.46)],
            [0.14, 0.16, 0.02],
            segs=5,
            mat_idx=2,
        )
    # 3 curved bronze & titanium siphon containment claws
    for c_idx in range(3):
        ca_ang = (c_idx * math.pi * 2.0) / 3.0
        cx, cz = math.cos(ca_ang), math.sin(ca_ang)
        add_swept_curve(
            bm_l,
            [(cx * 0.64, -0.24, cz * 0.64), (cx * 0.52, 0.0, cz * 0.52), (cx * 0.34, 0.32, cz * 0.34)],
            [0.08, 0.065, 0.035],
            segs=7,
            mat_idx=1,
        )
    add_swept_curve(bm_l, [(0.0, -0.18, 0.0), (0.0, -0.10, 0.0)], [0.58, 0.58], segs=14, mat_idx=0)
    finalize_mesh_obj("crystal_lock_body", bm_l, [mat_titanium, mat_bronze, mat_siphon_crystal], parent=lock_grp)

    # 3. `harmonic_seed_anchor`
    anc_grp = make_empty_node("harmonic_seed_anchor", (-5.0, 0.0, 0.0), parent=root)
    bm_a = bmesh.new()
    add_swept_curve(bm_a, [(0.0, -0.35, 0.0), (0.0, 0.0, 0.0), (0.0, 0.18, 0.0)], [1.55, 1.32, 0.92], segs=18, mat_idx=4)
    # 8 sculpted sea-glass & bronze lotus petals
    for p_idx in range(8):
        pa = (p_idx * math.pi * 2.0) / 8.0
        px_d, pz_d = math.cos(pa), math.sin(pa)
        add_swept_curve(
            bm_a,
            [(px_d * 0.42, 0.08, pz_d * 0.42), (px_d * 0.95, 0.38, pz_d * 0.95), (px_d * 1.28, 0.82, pz_d * 1.28)],
            [(0.18, 0.05), (0.24, 0.06), (0.04, 0.02)],
            segs=8,
            mat_idx=4 if p_idx % 2 == 0 else 1,
        )
    # Central glowing Harmonic Water Seed orb
    add_ellipsoid(bm_a, (0.0, 0.58, 0.0), (0.34, 0.46, 0.34), u_segs=14, v_segs=10, mat_idx=3)
    finalize_mesh_obj("seed_anchor_body", bm_a, [mat_titanium, mat_bronze, mat_siphon_crystal, mat_aqua_glow, mat_pearl], parent=anc_grp)

    return export_glb_and_inspect(os.path.join(OUT_MODELS_DIR, "core_reactor_props.glb"), export_apply=False)


def build_sea_turtle():
    """
    `assets/models/sea_turtle.glb` — Rescued Reef Sea Turtle (`+X` forward swim direction):
      - `turtle_body`: Domed Voronoi-patterned carapace, cream plastron, gentle head & eyes
      - `flipper_L` & `flipper_R`: Articulated fore-flippers for graceful underwater wing-strokes!
    """
    reset_scene()
    shell_alb, shell_nrm = create_turtle_shell_maps(128)
    mat_shell = make_mat("mat_turtle_shell", "#ffffff", roughness=0.34, coat=0.45, albedo_img=shell_alb, normal_img=shell_nrm, normal_strength=0.75)
    mat_skin = make_mat("mat_turtle_skin", "#4ea896", roughness=0.52)
    mat_belly = make_mat("mat_turtle_belly", "#e8dfc2", roughness=0.58)
    mat_eye = make_mat("mat_turtle_eye", "#111827", roughness=0.08, coat=1.0)

    root = make_empty_node("SeaTurtleRoot", (0.0, 0.0, 0.0))
    bm = bmesh.new()
    # Domed teardrop carapace (`-0.46 .. +0.36` along X)
    add_ellipsoid(bm, (-0.04, 0.06, 0.0), (0.44, 0.17, 0.35), u_segs=16, v_segs=10, mat_idx=0, hemi_top_only=True)
    add_ellipsoid(bm, (-0.04, -0.02, 0.0), (0.40, 0.08, 0.31), u_segs=14, v_segs=8, mat_idx=2)
    # Gentle reptilian neck + head (`+X`)
    add_swept_curve(bm, [(0.28, 0.02, 0.0), (0.44, 0.05, 0.0), (0.56, 0.06, 0.0)], [0.10, 0.11, 0.075], segs=10, mat_idx=1)
    for sz in (-0.065, 0.065):
        add_ellipsoid(bm, (0.50, 0.085, sz), (0.028, 0.028, 0.022), u_segs=8, v_segs=6, mat_idx=3)
    # Hind flippers & short tail
    for sz in (-0.20, 0.20):
        add_swept_curve(bm, [(-0.34, -0.01, sz * 0.7), (-0.52, -0.03, sz * 1.15)], [(0.06, 0.018), (0.03, 0.01)], segs=7, mat_idx=1)
    finalize_mesh_obj("turtle_body", bm, [mat_shell, mat_skin, mat_belly, mat_eye], subdiv_levels=1, parent=root)

    for side, sz in (("L", -1.0), ("R", 1.0)):
        bm_f = bmesh.new()
        add_swept_curve(
            bm_f,
            [(0.0, 0.0, 0.0), (0.04, -0.02, sz * 0.24), (-0.10, -0.04, sz * 0.50), (-0.22, -0.05, sz * 0.64)],
            [(0.085, 0.022), (0.11, 0.020), (0.075, 0.015), (0.02, 0.008)],
            segs=8,
            mat_idx=0,
        )
        finalize_mesh_obj(f"flipper_{side}", bm_f, [mat_skin], pos=(0.18, 0.0, sz * 0.25), subdiv_levels=1, parent=root)

    return export_glb_and_inspect(os.path.join(OUT_MODELS_DIR, "sea_turtle.glb"), export_apply=False)


def build_river_otter():
    """
    `assets/models/river_otter.glb` — Playful Canyon/Lake River Otter (`+X` forward swim direction):
      - `otter_body`: Sleek hydrodynamic torso, cream throat, cute snout, ears & paws
      - `otter_tail`: Articulated rudder tail for sinuous swimming!
    """
    reset_scene()
    mat_fur = make_mat("mat_otter_fur", "#6b4226", roughness=0.62)
    mat_cream = make_mat("mat_otter_cream", "#ead7b7", roughness=0.64)
    mat_dark = make_mat("mat_otter_dark", "#18181b", roughness=0.14, coat=0.8)

    root = make_empty_node("RiverOtterRoot", (0.0, 0.0, 0.0))
    bm = bmesh.new()
    body_pts = [(-0.34, 0.0, 0.0), (-0.12, 0.02, 0.0), (0.14, 0.03, 0.0), (0.34, 0.08, 0.0), (0.48, 0.09, 0.0)]
    body_rad = [(0.11, 0.10), (0.145, 0.135), (0.14, 0.13), (0.115, 0.11), (0.085, 0.075)]
    add_swept_curve(bm, body_pts, body_rad, segs=12, mat_idx=0)
    # Creamy chest/throat patch & muzzle cheeks
    add_ellipsoid(bm, (0.18, -0.04, 0.0), (0.24, 0.085, 0.105), u_segs=12, v_segs=8, mat_idx=1)
    for sz in (-0.038, 0.038):
        add_ellipsoid(bm, (0.50, 0.07, sz), (0.045, 0.038, 0.040), u_segs=8, v_segs=6, mat_idx=1)
        add_ellipsoid(bm, (0.44, 0.135, sz * 1.65), (0.024, 0.024, 0.020), u_segs=8, v_segs=6, mat_idx=2)
        add_ellipsoid(bm, (0.34, 0.16, sz * 2.4), (0.022, 0.025, 0.018), u_segs=6, v_segs=5, mat_idx=0)
    # Nose & tucked swimming paws
    add_ellipsoid(bm, (0.545, 0.095, 0.0), (0.022, 0.018, 0.024), u_segs=8, v_segs=6, mat_idx=2)
    for px_p in (-0.22, 0.18):
        for sz in (-0.11, 0.11):
            add_swept_curve(bm, [(px_p, -0.08, sz), (px_p - 0.10, -0.13, sz * 1.25)], [0.036, 0.024], segs=6, mat_idx=0)
    finalize_mesh_obj("otter_body", bm, [mat_fur, mat_cream, mat_dark], subdiv_levels=1, parent=root)

    bm_t = bmesh.new()
    add_swept_curve(
        bm_t,
        [(0.0, 0.0, 0.0), (-0.18, -0.01, 0.0), (-0.38, -0.02, 0.0), (-0.54, -0.01, 0.0)],
        [(0.085, 0.075), (0.068, 0.055), (0.042, 0.032), (0.012, 0.010)],
        segs=8,
        mat_idx=0,
    )
    finalize_mesh_obj("otter_tail", bm_t, [mat_fur], pos=(-0.32, 0.0, 0.0), subdiv_levels=1, parent=root)

    return export_glb_and_inspect(os.path.join(OUT_MODELS_DIR, "river_otter.glb"), export_apply=False)


def build_siphon_cage():
    """
    `assets/models/siphon_cage.glb` — Siphon Syndicate Wildlife Containment Cage:
      - `cage_frame`: Hexagonal copper-and-titanium bar prism with float collar
      - `cage_lock`: Glowing amber-crimson Siphon lock ring around the equator
    """
    reset_scene()
    metal_alb, metal_nrm = create_siphon_metal_maps(128)
    mat_iron = make_mat("mat_cage_iron", "#243244", roughness=0.38, metallic=0.86, albedo_img=metal_alb, normal_img=metal_nrm, normal_strength=0.45)
    mat_copper = make_mat("mat_cage_copper", "#b46934", roughness=0.30, metallic=0.88)
    mat_lock = make_mat("mat_cage_lock", "#fb7185", roughness=0.14, emission_hex="#f43f5e", emission_strength=1.75)

    root = make_empty_node("SiphonCageRoot", (0.0, 0.0, 0.0))
    bm_c = bmesh.new()
    # Top & bottom hexagonal end-caps + 6 vertical containment bars
    for cy in (-0.52, 0.52):
        ring_pts = [(math.cos((k * math.pi * 2.0) / 6.0) * 0.62, cy, math.sin((k * math.pi * 2.0) / 6.0) * 0.62) for k in range(7)]
        add_swept_curve(bm_c, ring_pts, 0.045, segs=6, up_t3=(0.0, 1.0, 0.0), mat_idx=1)
    for k in range(6):
        ang = (k * math.pi * 2.0) / 6.0
        bx, bz = math.cos(ang) * 0.60, math.sin(ang) * 0.60
        add_swept_curve(bm_c, [(bx, -0.52, bz), (bx, 0.52, bz)], 0.032, segs=6, mat_idx=0)
    add_swept_curve(bm_c, [(0.0, 0.52, 0.0), (0.0, 0.70, 0.0)], [0.22, 0.12], segs=8, mat_idx=1)
    finalize_mesh_obj("cage_frame", bm_c, [mat_iron, mat_copper], parent=root)

    bm_lk = bmesh.new()
    eq_pts = [(math.cos((k * math.pi * 2.0) / 12.0) * 0.65, 0.0, math.sin((k * math.pi * 2.0) / 12.0) * 0.65) for k in range(13)]
    add_swept_curve(bm_lk, eq_pts, 0.036, segs=6, up_t3=(0.0, 1.0, 0.0), mat_idx=0)
    add_bevel_box(bm_lk, (0.0, 0.0, 0.66), (0.20, 0.22, 0.10), bevel=0.015, mat_idx=0)
    finalize_mesh_obj("cage_lock", bm_lk, [mat_lock], parent=root)

    return export_glb_and_inspect(os.path.join(OUT_MODELS_DIR, "siphon_cage.glb"), export_apply=False)


def build_reef_fish_1():
    """Vibrant Sunlit Reef Mandarin-Angelfish (`assets/models/alien_fish_1.glb` compatibility path)."""
    reset_scene()
    alb = create_reef_fish_albedo(128, "#0284c7", "#5efce8", "#fbbf24")
    mat_body = make_mat("mat_fish1_body", "#ffffff", roughness=0.28, coat=0.55, albedo_img=alb)
    mat_fin = make_mat("mat_fish1_fin", "#38bdf8", roughness=0.22, emission_hex="#22d3ee", emission_strength=0.65, alpha=0.88)
    mat_eye = make_mat("mat_fish1_eye", "#0f172a", roughness=0.08, coat=1.0)

    root = make_empty_node("ReefFish1Root", (0.0, 0.0, 0.0))
    bm = bmesh.new()
    pts = [(-0.46, 0.0, 0.0), (-0.18, 0.02, 0.0), (0.10, 0.03, 0.0), (0.34, 0.01, 0.0), (0.48, -0.01, 0.0)]
    rads = [(0.03, 0.05), (0.11, 0.22), (0.14, 0.26), (0.10, 0.17), (0.03, 0.05)]
    add_swept_curve(bm, pts, rads, segs=12, mat_idx=0)
    # Flowing dorsal, ventral & forked caudal fins
    add_swept_curve(bm, [(0.12, 0.22, 0.0), (-0.12, 0.38, 0.0), (-0.36, 0.28, 0.0)], [(0.02, 0.06), (0.015, 0.09), (0.01, 0.03)], segs=6, mat_idx=1)
    add_swept_curve(bm, [(0.06, -0.20, 0.0), (-0.16, -0.34, 0.0), (-0.34, -0.24, 0.0)], [(0.02, 0.05), (0.015, 0.08), (0.01, 0.03)], segs=6, mat_idx=1)
    add_swept_curve(bm, [(-0.42, 0.0, 0.0), (-0.64, 0.20, 0.0)], [(0.02, 0.05), (0.01, 0.09)], segs=6, mat_idx=1)
    add_swept_curve(bm, [(-0.42, 0.0, 0.0), (-0.64, -0.20, 0.0)], [(0.02, 0.05), (0.01, 0.09)], segs=6, mat_idx=1)
    for sz in (-0.095, 0.095):
        add_ellipsoid(bm, (0.30, 0.05, sz), (0.032, 0.032, 0.022), u_segs=8, v_segs=6, mat_idx=2)
    finalize_mesh_obj("fish_body", bm, [mat_body, mat_fin, mat_eye], subdiv_levels=1, parent=root)
    return export_glb_and_inspect(os.path.join(OUT_MODELS_DIR, "alien_fish_1.glb"), export_apply=False)


def build_reef_fish_2():
    """Graceful Spotted Eagle-Ray / Reef Glider (`assets/models/alien_fish_2.glb` compatibility path)."""
    reset_scene()
    alb = create_reef_fish_albedo(128, "#0f766e", "#99f6e4", "#f472b6")
    mat_body = make_mat("mat_fish2_body", "#ffffff", roughness=0.30, coat=0.5, albedo_img=alb)
    mat_wing = make_mat("mat_fish2_wing", "#2dd4bf", roughness=0.25, emission_hex="#14b8a6", emission_strength=0.45)

    root = make_empty_node("ReefFish2Root", (0.0, 0.0, 0.0))
    bm = bmesh.new()
    add_swept_curve(
        bm,
        [(-0.62, 0.0, 0.0), (-0.28, 0.01, 0.0), (0.08, 0.02, 0.0), (0.38, 0.01, 0.0), (0.52, 0.0, 0.0)],
        [(0.015, 0.015), (0.07, 0.05), (0.14, 0.09), (0.11, 0.07), (0.04, 0.03)],
        segs=10,
        mat_idx=0,
    )
    for sz in (-1.0, 1.0):
        add_swept_curve(
            bm,
            [(0.12, 0.0, sz * 0.08), (0.02, 0.02, sz * 0.34), (-0.16, 0.03, sz * 0.56)],
            [(0.20, 0.035), (0.16, 0.025), (0.04, 0.012)],
            segs=8,
            mat_idx=1,
        )
    finalize_mesh_obj("fish2_body", bm, [mat_body, mat_wing], subdiv_levels=1, parent=root)
    return export_glb_and_inspect(os.path.join(OUT_MODELS_DIR, "alien_fish_2.glb"), export_apply=False)


def build_siphon_surge_mine():
    """Copper & Basalt Siphon Surge Node (`assets/models/sea_mine.glb`)."""
    reset_scene()
    metal_alb, metal_nrm = create_siphon_metal_maps(128)
    mat_hull = make_mat("mat_mine_hull", "#ffffff", roughness=0.44, metallic=0.82, albedo_img=metal_alb, normal_img=metal_nrm, normal_strength=0.65)
    mat_copper = make_mat("mat_mine_copper", "#b46934", roughness=0.32, metallic=0.88)
    mat_glow = make_mat("mat_mine_glow", "#fb923c", roughness=0.14, emission_hex="#f97316", emission_strength=1.65)

    root = make_empty_node("SiphonSurgeNode", (0.0, 0.0, 0.0))
    bm = bmesh.new()
    add_ellipsoid(bm, (0.0, 0.0, 0.0), (0.76, 0.76, 0.76), u_segs=16, v_segs=12, mat_idx=0)
    add_swept_curve(bm, [(0.0, -0.06, 0.0), (0.0, 0.06, 0.0)], [0.81, 0.81], segs=16, mat_idx=1)

    # 12 Siphon intake horns with glowing pressure tips
    dirs = [
        (1, 0, 0), (-1, 0, 0), (0, 1, 0), (0, -1, 0), (0, 0, 1), (0, 0, -1),
        (0.577, 0.577, 0.577), (-0.577, 0.577, 0.577), (0.577, -0.577, 0.577),
        (0.577, 0.577, -0.577), (-0.577, -0.577, 0.577), (-0.577, 0.577, -0.577),
    ]
    for dx, dy, dz in dirs:
        add_swept_curve(
            bm,
            [(dx * 0.70, dy * 0.70, dz * 0.70), (dx * 0.96, dy * 0.96, dz * 0.96)],
            [0.11, 0.06],
            segs=7,
            mat_idx=1,
        )
        add_ellipsoid(bm, (dx * 1.00, dy * 1.00, dz * 1.00), (0.065, 0.065, 0.065), u_segs=8, v_segs=6, mat_idx=2)
    finalize_mesh_obj("mine_body", bm, [mat_hull, mat_copper, mat_glow], parent=root)
    return export_glb_and_inspect(os.path.join(OUT_MODELS_DIR, "sea_mine.glb"), export_apply=False)


def build_reef_grotto_arch():
    """Sunlit Coral-Limestone & Sea-Glass Reef Grotto Arch (`assets/models/warp_cavern.glb`)."""
    reset_scene()
    stone_nrm = create_travertine_stone_normal(128)
    mat_limestone = make_mat("mat_reef_limestone", "#6e7f8d", roughness=0.66, normal_img=stone_nrm, normal_strength=0.75, uv_scale=2.4)
    mat_coral = make_mat("mat_staghorn_coral", "#fb7185", roughness=0.45, emission_hex="#f43f5e", emission_strength=0.25)
    mat_seaglass = make_mat("mat_seaglass_crystal", "#5efce8", roughness=0.10, coat=0.9, emission_hex="#22d3ee", emission_strength=1.55)

    root = make_empty_node("ReefGrottoArch", (0.0, 0.0, 0.0))
    bm = bmesh.new()
    arch_pts = []
    arch_rads = []
    for k in range(13):
        ang = -0.25 + (k / 12.0) * (math.pi + 0.50)
        rx = math.cos(ang) * 1.08
        ry = math.sin(ang) * 1.12
        arch_pts.append((rx, ry, math.sin(k * 0.9) * 0.08))
        arch_rads.append((0.28 - 0.06 * math.sin(ang), 0.24))
    add_swept_curve(bm, arch_pts, arch_rads, segs=10, up_t3=(0.0, 0.0, 1.0), mat_idx=0)

    # Branching coral fans & glowing sea-glass crystals crowning the arch
    for ang in (0.35, 1.05, 1.57, 2.15, 2.78):
        cx, cy = math.cos(ang) * 1.14, math.sin(ang) * 1.18
        add_swept_curve(bm, [(cx * 0.92, cy * 0.92, 0.12), (cx * 1.24, cy * 1.26, 0.20)], [0.09, 0.025], segs=6, mat_idx=2)
        add_swept_curve(bm, [(cx * 0.94, cy * 0.94, -0.10), (cx * 1.18, cy * 1.22, -0.16)], [0.07, 0.03], segs=6, mat_idx=1)

    finalize_mesh_obj("cavern_arch", bm, [mat_limestone, mat_coral, mat_seaglass], parent=root)
    return export_glb_and_inspect(os.path.join(OUT_MODELS_DIR, "warp_cavern.glb"), export_apply=False)


def build_aqueduct_sanctum_props():
    """
    Ancient Aqueduct Sanctum 4-Prop Pack (`assets/models/puzzle_props.glb`):
      Preserves exact node names (`temple_bell`, `prism_mirror`, `push_monolith`, `sanctum_brazier`)
      & child sub-nodes (`bell_yoke`, `bell_body`, `mirror_base`, `mirror_turret`, `monolith_body`, `brazier_body`)
      upgraded with sunlit travertine-limestone, brushed aqueduct brass, turquoise water-crystal inlays,
      and brass rotary pipe-valve sconces!
    """
    reset_scene()
    stone_nrm = create_travertine_stone_normal(128)
    mat_travertine = make_mat("mat_travertine", "#c8bea8", roughness=0.56, metallic=0.04, normal_img=stone_nrm, normal_strength=0.65, uv_scale=2.5)
    mat_verdigris = make_mat("mat_verdigris_bronze", "#3d7a74", roughness=0.38, metallic=0.72)
    mat_brass = make_mat("mat_aqueduct_brass", "#d49b3d", roughness=0.24, metallic=0.90)
    mat_water_glow = make_mat("mat_water_glow", "#5efce8", roughness=0.10, emission_hex="#06b6d4", emission_strength=1.75)
    mat_prism = make_mat("mat_prism_crystal", "#e0f7ff", roughness=0.03, metallic=0.90, coat=1.0, emission_hex="#7dd3fc", emission_strength=0.50)
    mat_sun_amber = make_mat("mat_sun_amber", "#fde047", roughness=0.12, emission_hex="#f59e0b", emission_strength=1.80)

    root = make_empty_node("AqueductPropsRoot", (0.0, 0.0, 0.0))

    # 1. `temple_bell` -> Harmonic Water-Bell Fountain (`(-3.0, 0.0, 0.0)`)
    bell_grp = make_empty_node("temple_bell", (-3.0, 0.0, 0.0), parent=root)
    bm_yoke = bmesh.new()
    for sx in (-0.50, 0.50):
        add_bevel_box(bm_yoke, (sx, 0.07, 0.0), (0.26, 0.14, 0.32), bevel=0.015, mat_idx=0)
        add_swept_curve(bm_yoke, [(sx, 0.14, 0.0), (sx * 0.96, 0.92, 0.0), (sx * 0.86, 1.58, 0.0)], [0.062, 0.052, 0.046], segs=10, mat_idx=1)
        add_bevel_box(bm_yoke, (sx * 0.72, 1.42, 0.0), (0.28, 0.055, 0.065), bevel=0.008, rot_t3=(0.0, 0.0, sx * 0.65), mat_idx=2)
    # Travertine & brass aqueduct lintel trough
    add_bevel_box(bm_yoke, (0.0, 1.61, 0.0), (1.22, 0.11, 0.18), bevel=0.014, mat_idx=0)
    add_bevel_box(bm_yoke, (0.0, 1.68, 0.0), (1.28, 0.045, 0.21), bevel=0.008, mat_idx=2)
    finalize_mesh_obj("bell_yoke", bm_yoke, [mat_travertine, mat_verdigris, mat_brass], parent=bell_grp)

    bm_bell = bmesh.new()
    bell_prof = [
        (0.00, 0.05),
        (-0.07, 0.13),
        (-0.19, 0.18),
        (-0.35, 0.21),
        (-0.47, 0.27),
        (-0.55, 0.34),
        (-0.58, 0.31),
    ]
    b_rings = [[(math.cos((2.0 * math.pi * s) / 18) * r, y, math.sin((2.0 * math.pi * s) / 18) * r) for s in range(18)] for y, r in bell_prof]
    add_loft_rings(bm_bell, b_rings, closed=True, cap_start=True, cap_end=True, mat_idx=[0, 0, 1, 0, 1, 0])
    add_ellipsoid(bm_bell, (0.0, -0.59, 0.0), (0.06, 0.07, 0.06), u_segs=8, v_segs=6, mat_idx=1)
    finalize_mesh_obj("bell_body", bm_bell, [mat_brass, mat_water_glow], pos=(0.0, 1.48, 0.0), parent=bell_grp)

    # 2. `prism_mirror` -> Aqueduct Crystal Prism Beam Turret (`(-1.0, 0.0, 0.0)`)
    mir_grp = make_empty_node("prism_mirror", (-1.0, 0.0, 0.0), parent=root)
    bm_mb = bmesh.new()
    add_swept_curve(bm_mb, [(0.0, 0.0, 0.0), (0.0, 0.15, 0.0), (0.0, 0.32, 0.0)], [0.40, 0.32, 0.27], segs=14, mat_idx=0)
    for g in range(8):
        ga = (2.0 * math.pi * g) / 8.0
        add_bevel_box(bm_mb, (math.cos(ga) * 0.30, 0.24, math.sin(ga) * 0.30), (0.065, 0.055, 0.065), bevel=0.006, rot_t3=(0.0, -ga, 0.0), mat_idx=1)
    finalize_mesh_obj("mirror_base", bm_mb, [mat_travertine, mat_brass], parent=mir_grp)

    bm_mt = bmesh.new()
    add_bevel_box(bm_mt, (0.0, 0.04, 0.0), (0.86, 0.075, 0.115), bevel=0.010, mat_idx=0)
    add_bevel_box(bm_mt, (0.0, 0.90, 0.0), (0.86, 0.075, 0.115), bevel=0.010, mat_idx=0)
    for sx in (-0.40, 0.40):
        add_bevel_box(bm_mt, (sx, 0.47, 0.0), (0.075, 0.86, 0.115), bevel=0.010, mat_idx=0)
        add_ellipsoid(bm_mt, (sx, 0.95, 0.0), (0.06, 0.06, 0.06), u_segs=8, v_segs=6, mat_idx=0)
    add_bevel_box(bm_mt, (0.0, 0.47, 0.0), (0.72, 0.80, 0.048), bevel=0.010, mat_idx=1)
    finalize_mesh_obj("mirror_turret", bm_mt, [mat_brass, mat_prism], pos=(0.0, 0.32, 0.0), parent=mir_grp)

    # 3. `push_monolith` -> Carved Aqueduct Sluice Stone Block (`(1.0, 0.0, 0.0)`)
    mono_grp = make_empty_node("push_monolith", (1.0, 0.0, 0.0), parent=root)
    bm_mn = bmesh.new()
    add_bevel_box(bm_mn, (0.0, 0.43, 0.0), (0.82, 0.86, 0.82), bevel=0.045, segs=1, mat_idx=0)
    for cx in (-0.38, 0.38):
        for cz in (-0.38, 0.38):
            add_bevel_box(bm_mn, (cx, 0.06, cz), (0.11, 0.12, 0.11), bevel=0.008, mat_idx=1)
            add_bevel_box(bm_mn, (cx, 0.80, cz), (0.11, 0.12, 0.11), bevel=0.008, mat_idx=1)
    for rot_y in (0.0, math.pi * 0.5, math.pi, math.pi * 1.5):
        s_in, c_os = math.sin(rot_y), math.cos(rot_y)
        add_bevel_box(bm_mn, (s_in * 0.412, 0.43, c_os * 0.412), (0.30, 0.30, 0.020), bevel=0.005, rot_t3=(0.0, rot_y, math.pi * 0.25), mat_idx=2)
    add_bevel_box(bm_mn, (0.0, 0.862, 0.0), (0.36, 0.018, 0.36), bevel=0.005, rot_t3=(0.0, math.pi * 0.25, 0.0), mat_idx=2)
    finalize_mesh_obj("monolith_body", bm_mn, [mat_travertine, mat_brass, mat_water_glow], parent=mono_grp)

    # 4. `sanctum_brazier` -> Sunlit Brass Rotary Aqueduct Valve & Water-Lotus Fountain (`(3.0, 0.0, 0.0)`)
    braz_grp = make_empty_node("sanctum_brazier", (3.0, 0.0, 0.0), parent=root)
    bm_br = bmesh.new()
    add_swept_curve(bm_br, [(0.0, 0.0, 0.0), (0.0, 0.12, 0.0)], [0.30, 0.25], segs=12, mat_idx=0)
    # Central bronze aqueduct standpipe + rotary brass valve handwheel
    add_swept_curve(bm_br, [(0.0, 0.10, 0.0), (0.0, 0.72, 0.0)], [0.095, 0.085], segs=12, mat_idx=1)
    wheel_pts = [(math.cos((k * math.pi * 2.0) / 14.0) * 0.23, 0.44 + math.sin((k * math.pi * 2.0) / 14.0) * 0.23, 0.14) for k in range(15)]
    add_swept_curve(bm_br, wheel_pts, 0.024, segs=6, up_t3=(0.0, 0.0, 1.0), mat_idx=2)
    for sp in range(4):
        sa = (sp * math.pi) / 2.0
        add_bevel_box(bm_br, (0.0, 0.44, 0.14), (0.44, 0.028, 0.024), bevel=0.004, rot_t3=(0.0, 0.0, sa), mat_idx=2)
    # Upper fluted water-lotus basin & luminous sunlit crystal water plume
    add_swept_curve(bm_br, [(0.0, 0.66, 0.0), (0.0, 0.80, 0.0), (0.0, 0.87, 0.0)], [0.11, 0.28, 0.32], segs=14, mat_idx=2)
    add_ellipsoid(bm_br, (0.0, 0.86, 0.0), (0.25, 0.06, 0.25), u_segs=12, v_segs=6, mat_idx=3)
    add_swept_curve(bm_br, [(0.0, 0.86, 0.0), (0.0, 1.06, 0.0), (0.0, 1.20, 0.0)], [0.13, 0.09, 0.02], segs=8, mat_idx=4)
    finalize_mesh_obj("brazier_body", bm_br, [mat_travertine, mat_verdigris, mat_brass, mat_water_glow, mat_sun_amber], parent=braz_grp)

    return export_glb_and_inspect(os.path.join(OUT_MODELS_DIR, "puzzle_props.glb"), export_apply=False)


def main():
    report = {"assets": [], "removed_obsolete": []}
    report["assets"].append(build_core_reactor_props())
    report["assets"].append(build_sea_turtle())
    report["assets"].append(build_river_otter())
    report["assets"].append(build_siphon_cage())
    report["assets"].append(build_reef_fish_1())
    report["assets"].append(build_reef_fish_2())
    report["assets"].append(build_siphon_surge_mine())
    report["assets"].append(build_reef_grotto_arch())
    report["assets"].append(build_aqueduct_sanctum_props())

    with open(DONE_PATH, "w", encoding="utf-8") as f:
        json.dump(report, f, indent=2)


if __name__ == "__main__":
    try:
        main()
    except Exception:
        with open(ERR_PATH, "w", encoding="utf-8") as ef:
            ef.write(traceback.format_exc())
        raise
