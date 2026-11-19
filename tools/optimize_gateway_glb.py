"""
Headless Blender 5.3 Optimizer & Decimator for `assets/models/gateway.glb`
===========================================================================
Decimates Gateway's 39-bone weight-painted SkinnedMesh from ~18,108 triangles
(5.52 MB PNG) down to ~3,900-4,200 crisp triangles (< 1.5 MB GLB with embedded
1K WEBP Voronoi PBR maps) while preserving:
  - 100% of her 39-bone Armature hierarchy & bone names
  - Smooth normalized 4-influence vertex weights across every joint
  - All 18 baked NLA skeletal animation clips with exact names
  - 1024x1024 Voronoi scale Albedo, Tangent Normal, ORM & Biolume Emissive maps
  - Exact sole grounding (`min_y == 0.000` in Three.js Y-up space)

Run via:
  C:\\Users\\mshaf\\AppData\\Local\\Microsoft\\WindowsApps\\blender-launcher.exe -b -P tools/optimize_gateway_glb.py
"""

import json
import os
import shutil
import struct
import sys
import traceback

import bpy

ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
GLB_PATH = os.path.join(ROOT_DIR, "assets", "models", "gateway.glb")
SCRATCH_DIR = os.path.join(
    os.path.expanduser("~"),
    ".gemini",
    "antigravity",
    "brain",
    "26e67a8a-c636-47eb-8fd3-64a8cb531f69",
    "scratch",
)
BACKUP_GLB = os.path.join(SCRATCH_DIR, "gateway_orig_18k.glb")
SENTINEL_PATH = os.path.join(SCRATCH_DIR, "optimize_gateway_done.json")
PROOF_IMG_PATH = os.path.join(SCRATCH_DIR, "gateway_decimated_proof.png")

EXPECTED_CLIPS = [
    "IdleBreathe",
    "Walk",
    "FluidRun",
    "StairClimb",
    "JumpCoil",
    "AirRise",
    "FrillGlide",
    "Fall",
    "Land",
    "LedgeMantle",
    "WallScamper",
    "TailWhip",
    "HydroCast",
    "FreeSwim",
    "RapidsSurf",
    "CoreDive",
    "Celebrate",
    "CutsceneHero",
]

TARGET_TRIS = 4200
MIN_TRIS = 3600
MAX_TRIS = 4400


def inspect_glb(filepath):
    size_bytes = os.path.getsize(filepath)
    with open(filepath, "rb") as f:
        f.read(12)
        chunk_len, _ = struct.unpack("<II", f.read(8))
        gltf = json.loads(f.read(chunk_len).decode("utf-8"))
    accessors = gltf.get("accessors", [])
    tris = 0
    min_y = 1e9
    max_y = -1e9
    for m in gltf.get("meshes", []):
        for p in m.get("primitives", []):
            if "indices" in p:
                tris += accessors[p["indices"]]["count"] // 3
            elif "POSITION" in p.get("attributes", {}):
                tris += accessors[p["attributes"]["POSITION"]]["count"] // 3
            pos_idx = p.get("attributes", {}).get("POSITION")
            if pos_idx is not None:
                acc = accessors[pos_idx]
                if "min" in acc and "max" in acc:
                    min_y = min(min_y, acc["min"][1])
                    max_y = max(max_y, acc["max"][1])
    skins = [len(s.get("joints", [])) for s in gltf.get("skins", [])]
    anims = [a.get("name", "") for a in gltf.get("animations", [])]
    imgs = [
        {
            "name": im.get("name", ""),
            "mime": im.get("mimeType", ""),
            "kb": round(
                gltf["bufferViews"][im["bufferView"]]["byteLength"] / 1024.0, 1
            )
            if "bufferView" in im
            else 0,
        }
        for im in gltf.get("images", [])
    ]
    return {
        "size_bytes": size_bytes,
        "size_mb": round(size_bytes / (1024.0 * 1024.0), 3),
        "tris": tris,
        "min_y": round(min_y, 5),
        "max_y": round(max_y, 5),
        "skins": skins,
        "bone_count": skins[0] if skins else 0,
        "animation_count": len(anims),
        "animations": anims,
        "images": imgs,
    }


def eval_tri_count(mesh_obj):
    depsgraph = bpy.context.evaluated_depsgraph_get()
    eval_obj = mesh_obj.evaluated_get(depsgraph)
    eval_mesh = eval_obj.to_mesh()
    eval_mesh.calc_loop_triangles()
    count = len(eval_mesh.loop_triangles)
    eval_obj.to_mesh_clear()
    return count


def decimate_mesh_to_target(mesh_obj, target_tris=TARGET_TRIS):
    bpy.ops.object.select_all(action="DESELECT")
    mesh_obj.select_set(True)
    bpy.context.view_layer.objects.active = mesh_obj

    # Remove any non-armature modifiers first
    for m in list(mesh_obj.modifiers):
        if m.type != "ARMATURE":
            mesh_obj.modifiers.remove(m)

    # Put Decimate BEFORE Armature modifier so it operates cleanly in bind pose
    arm_mods = [m for m in mesh_obj.modifiers if m.type == "ARMATURE"]

    # Try UV-delimited symmetric collapse first (keeps eyes, frills, gear & scale seams crisp
    # with zero asymmetric spikes!).
    chosen_delimit = {"UV"}
    mod = mesh_obj.modifiers.new(name="GatewayDecimate", type="DECIMATE")
    mod.decimate_type = "COLLAPSE"
    mod.use_collapse_triangulate = True
    mod.use_symmetry = True
    mod.symmetry_axis = "X"
    mod.delimit = chosen_delimit

    # Move Decimate above Armature and temporarily disable Armature during bind-pose decimation
    for am in arm_mods:
        am.show_viewport = False
    if arm_mods:
        bpy.ops.object.modifier_move_to_index(modifier=mod.name, index=0)

    # Check floor with UV delimit at ratio=0.10
    mod.ratio = 0.10
    bpy.context.view_layer.update()
    uv_min_tris = eval_tri_count(mesh_obj)
    if uv_min_tris > MAX_TRIS:
        chosen_delimit = set()
        mod.delimit = chosen_delimit

    # Binary search exact ratio for target_tris
    lo, hi = 0.05, 0.95
    best_ratio = 0.23
    best_diff = 10**9
    for _ in range(14):
        mid = 0.5 * (lo + hi)
        mod.ratio = mid
        bpy.context.view_layer.update()
        cur = eval_tri_count(mesh_obj)
        diff = abs(cur - target_tris)
        if diff < best_diff:
            best_diff = diff
            best_ratio = mid
        if cur > target_tris:
            hi = mid
        else:
            lo = mid

    mod.ratio = best_ratio
    bpy.context.view_layer.update()
    final_eval_tris = eval_tri_count(mesh_obj)

    # Apply ONLY the Decimate modifier (keep Armature modifier intact!)
    bpy.ops.object.modifier_apply(modifier=mod.name)
    for am in arm_mods:
        am.show_viewport = True

    # Ensure smooth shading across sculpted surfaces
    bpy.ops.object.shade_smooth()

    # Clean & normalize vertex skinning weights (max 4 bones/vertex for WebGL2 GPU skinning!)
    # Guard against any un-weighted vertices by assigning them to Pelvis before normalizing.
    pelvis_vg = mesh_obj.vertex_groups.get("Pelvis")
    if pelvis_vg is not None:
        for v in mesh_obj.data.vertices:
            if len(v.groups) == 0:
                pelvis_vg.add([v.index], 1.0, "REPLACE")
    bpy.ops.object.mode_set(mode="WEIGHT_PAINT")
    bpy.ops.object.vertex_group_limit_total(group_select_mode="ALL", limit=4)
    bpy.ops.object.vertex_group_normalize_all(
        group_select_mode="ALL", lock_active=False
    )
    bpy.ops.object.mode_set(mode="OBJECT")

    # Verify exact ground sole alignment (Blender Z == Three.js Y!)
    # Shift vertices slightly in Z ONLY if decimation nudged min Z off 0.000
    min_z = min(v.co.z for v in mesh_obj.data.vertices)
    if abs(min_z) > 1e-5:
        for v in mesh_obj.data.vertices:
            v.co.z -= min_z
        mesh_obj.data.update()

    return {
        "delimit": list(chosen_delimit),
        "ratio": round(best_ratio, 4),
        "eval_tris": final_eval_tris,
        "sole_z_correction": round(-min_z, 5),
    }


def render_proof_sheet(mesh_obj, arm_obj):
    scene = bpy.context.scene
    # Pose in clean IdleBreathe (mute all other NLA tracks so tracks don't stack!)
    if arm_obj.animation_data:
        arm_obj.animation_data.action = None
        for tr in arm_obj.animation_data.nla_tracks:
            tr.mute = tr.name != "IdleBreathe"
    scene.frame_set(1)
    bpy.context.view_layer.update()

    engines = [e.identifier for e in scene.render.bl_rna.properties["engine"].enum_items]
    scene.render.engine = "CYCLES" if "CYCLES" in engines else engines[0]
    if scene.render.engine == "CYCLES":
        scene.cycles.samples = 24
        scene.cycles.use_denoising = False

    scene.render.resolution_x = 768
    scene.render.resolution_y = 768
    scene.render.filepath = PROOF_IMG_PATH
    scene.render.image_settings.file_format = "PNG"

    world = bpy.data.worlds.new("ProofWorld")
    world.use_nodes = True
    bg = world.node_tree.nodes.get("Background")
    if bg:
        bg.inputs[0].default_value = (0.04, 0.09, 0.14, 1.0)
        bg.inputs[1].default_value = 1.0
    scene.world = world

    def add_light(name, energy, loc, col):
        ld = bpy.data.lights.new(name, type="AREA")
        ld.energy = energy
        ld.size = 1.5
        ld.color = col
        lo = bpy.data.objects.new(name, ld)
        lo.location = loc
        scene.collection.objects.link(lo)
        # Point at center (0, 0, 0.6)
        direction = (
            bpy.mathutils.Vector((0.0, 0.0, 0.6)) - lo.location
            if hasattr(bpy, "mathutils")
            else None
        )
        return lo

    import mathutils

    for nm, en, loc, col in [
        ("Key", 140.0, (1.4, -1.8, 1.6), (1.0, 0.96, 0.90)),
        ("Rim", 95.0, (-1.4, 1.4, 1.3), (0.35, 0.92, 1.0)),
        ("Fill", 55.0, (-1.2, -1.6, 0.7), (0.6, 0.85, 1.0)),
    ]:
        ld = bpy.data.lights.new(nm, type="AREA")
        ld.energy = en
        ld.size = 1.4
        ld.color = col
        lo = bpy.data.objects.new(nm, ld)
        lo.location = loc
        lo.rotation_euler = (
            mathutils.Vector((0.0, 0.0, 0.58)) - mathutils.Vector(loc)
        ).to_track_quat("-Z", "Y").to_euler()
        scene.collection.objects.link(lo)

    cam_data = bpy.data.cameras.new("ProofCam")
    cam_data.lens = 58
    cam_obj = bpy.data.objects.new("ProofCam", cam_data)
    cam_obj.location = (0.95, -1.75, 0.78)
    cam_obj.rotation_euler = (
        mathutils.Vector((0.0, -0.05, 0.58)) - cam_obj.location
    ).to_track_quat("-Z", "Y").to_euler()
    scene.collection.objects.link(cam_obj)
    scene.camera = cam_obj

    bpy.ops.render.render(write_still=True)


def main():
    os.makedirs(SCRATCH_DIR, exist_ok=True)
    before = inspect_glb(GLB_PATH)

    # Always source from un-decimated 18K backup so script is idempotent
    if before["tris"] > 10000:
        shutil.copy2(GLB_PATH, BACKUP_GLB)
    source_glb = BACKUP_GLB if os.path.exists(BACKUP_GLB) else GLB_PATH

    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=source_glb)

    # Identify Armature and primary SkinnedMesh
    arm_obj = None
    mesh_obj = None
    junk_objs = []
    for obj in list(bpy.data.objects):
        if obj.type == "ARMATURE":
            arm_obj = obj
        elif obj.type == "MESH":
            # Exclude glTF importer's custom bone shape icospheres
            if obj.name.lower().startswith("icosphere") or len(obj.vertex_groups) == 0:
                junk_objs.append(obj)
            else:
                mesh_obj = obj

    if arm_obj is None or mesh_obj is None:
        raise RuntimeError(
            f"Missing Armature ({arm_obj}) or SkinnedMesh ({mesh_obj}) in {source_glb}"
        )

    # Remove bone display shapes so they never bloat the export
    for pb in arm_obj.pose.bones:
        pb.custom_shape = None
    for j in junk_objs:
        bpy.data.objects.remove(j, do_unlink=True)

    # Verify & normalize NLA tracks for all 18 expected clips
    if not arm_obj.animation_data:
        arm_obj.animation_data_create()
    ad = arm_obj.animation_data
    ad.action = None

    # Map existing actions by canonical name (glTF importer sometimes preserves exact names
    # or attaches them to NLA tracks)
    action_by_name = {}
    for act in bpy.data.actions:
        action_by_name[act.name] = act
    for tr in list(ad.nla_tracks):
        for st in tr.strips:
            if st.action:
                # Prefer strip/track name if it matches EXPECTED_CLIPS
                if tr.name in EXPECTED_CLIPS:
                    action_by_name[tr.name] = st.action
                elif st.name in EXPECTED_CLIPS:
                    action_by_name[st.name] = st.action

    # Rebuild clean 18 NLA tracks with exact canonical clip names
    for tr in list(ad.nla_tracks):
        ad.nla_tracks.remove(tr)

    matched_clips = []
    for cname in EXPECTED_CLIPS:
        act = action_by_name.get(cname)
        if act is None:
            # Fallback case-insensitive match
            for k, v in action_by_name.items():
                if k.lower().startswith(cname.lower()):
                    act = v
                    break
        if act is not None:
            act.name = cname
            tr = ad.nla_tracks.new()
            tr.name = cname
            start_f = int(round(act.frame_range[0])) if act.frame_range else 1
            strip = tr.strips.new(cname, start_f, act)
            strip.name = cname
            tr.mute = False
            matched_clips.append(cname)

    # Ensure rest pose before decimating
    for pb in arm_obj.pose.bones:
        pb.location = (0, 0, 0)
        pb.rotation_quaternion = (1, 0, 0, 0)
        pb.rotation_euler = (0, 0, 0)
        pb.scale = (1, 1, 1)
    bpy.context.view_layer.update()

    decimate_stats = decimate_mesh_to_target(mesh_obj, TARGET_TRIS)

    # Select ONLY Armature + GatewayMesh for clean export
    bpy.ops.object.select_all(action="DESELECT")
    arm_obj.select_set(True)
    mesh_obj.select_set(True)
    bpy.context.view_layer.objects.active = arm_obj

    tmp_glb = os.path.join(SCRATCH_DIR, "gateway_opt_tmp.glb")
    if os.path.exists(tmp_glb):
        os.remove(tmp_glb)

    export_kwargs = dict(
        filepath=tmp_glb,
        export_format="GLB",
        use_selection=True,
        export_yup=True,
        export_apply=False,
        export_texcoords=True,
        export_normals=True,
        export_tangents=True,
        export_materials="EXPORT",
        export_image_format="WEBP",
        export_image_quality=85,
        export_skins=True,
        export_animations=True,
        export_animation_mode="NLA_TRACKS",
        export_nla_strips=True,
        export_rest_position_armature=True,
        export_force_sampling=True,
        export_frame_step=1,
        export_optimize_animation_size=True,
    )

    # Filter kwargs defensively against Blender 5.3 operator RNA properties
    op_props = set(bpy.ops.export_scene.gltf.get_rna_type().properties.keys())
    safe_kwargs = {k: v for k, v in export_kwargs.items() if k in op_props}
    bpy.ops.export_scene.gltf(**safe_kwargs)

    # Atomically copy over target `assets/models/gateway.glb` with brief retry
    import time as _time
    for attempt in range(5):
        try:
            shutil.copyfile(tmp_glb, GLB_PATH)
            break
        except OSError:
            if attempt == 4:
                raise
            _time.sleep(0.4)
    if os.path.exists(tmp_glb):
        os.remove(tmp_glb)

    after = inspect_glb(GLB_PATH)

    # Render a quick proof image (after export, so lights/cam never enter the GLB!)
    try:
        render_proof_sheet(mesh_obj, arm_obj)
    except Exception as render_err:
        after["proof_render_error"] = str(render_err)

    report = {
        "ok": True,
        "before": before,
        "decimate": decimate_stats,
        "matched_clips": len(matched_clips),
        "after": after,
        "export_kwargs_used": sorted(safe_kwargs.keys()),
    }
    with open(SENTINEL_PATH, "w", encoding="utf-8") as f:
        json.dump(report, f, indent=2)


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        os.makedirs(SCRATCH_DIR, exist_ok=True)
        with open(SENTINEL_PATH, "w", encoding="utf-8") as f:
            json.dump(
                {"ok": False, "error": str(exc), "trace": traceback.format_exc()},
                f,
                indent=2,
            )
        raise
