import { describe, it, expect, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import * as THREE from '../vendor/three/build/three.module.min.js';

vi.mock('three', () => import('../vendor/three/build/three.module.min.js'));
vi.mock('three/addons/loaders/GLTFLoader.js', () => import('../vendor/three/examples/jsm/loaders/GLTFLoader.js'));
vi.mock('three/addons/utils/BufferGeometryUtils.js', () => import('../vendor/three/examples/jsm/utils/BufferGeometryUtils.js'));

import {
  EnemyVisualPool,
  ENEMY_FAMILIES,
  FAMILY_WORLD_SCALES,
  ENEMY_CULL_FLOOR_WINDOW,
  WARDEN_CULL_FLOOR_WINDOW,
  ACT_WARDEN_PALETTES,
  FAM_SNAP_CRAB,
  FAM_GULP_HOPPER,
  FAM_VOLT_EEL,
  FAM_RAIL_SKATER,
  FAM_BARNACLE_MORTAR,
  FAM_VENT_STALKER,
  FAM_SIPHON_WARDEN,
  resolveEnemyFamilyId,
} from '../src/enemyRig.js';

const MODELS_DIR = path.resolve(process.cwd(), 'assets', 'models');

function parseGlbInfo(filename) {
  const fullPath = path.join(MODELS_DIR, filename);
  const buf = fs.readFileSync(fullPath);
  const magic = buf.subarray(0, 4).toString('ascii');
  const version = buf.readUInt32LE(4);
  const totalLen = buf.readUInt32LE(8);
  const chunk0Len = buf.readUInt32LE(12);
  const chunk0Type = buf.readUInt32LE(16);
  const json = JSON.parse(buf.subarray(20, 20 + chunk0Len).toString('utf8'));

  const nodes = (json.nodes || []).map((n) => n.name || '');
  const materials = (json.materials || []).map((m) => m.name || '');
  const images = (json.images || []).length;
  const accessors = json.accessors || [];

  let triangles = 0;
  for (const mesh of json.meshes || []) {
    for (const prim of mesh.primitives || []) {
      if (prim.indices != null) {
        triangles += Math.floor(accessors[prim.indices].count / 3);
      } else if (prim.attributes?.POSITION != null) {
        triangles += Math.floor(accessors[prim.attributes.POSITION].count / 3);
      }
    }
  }

  // Compute world-space bounding box from GLTF node hierarchy & POSITION accessor min/max
  const parentOf = new Map();
  (json.nodes || []).forEach((n, idx) => {
    for (const ch of n.children || []) parentOf.set(ch, idx);
  });

  const matCache = new Map();
  const getWorldMatrix = (idx) => {
    if (matCache.has(idx)) return matCache.get(idx);
    const n = json.nodes[idx];
    const m = new THREE.Matrix4();
    if (Array.isArray(n.matrix) && n.matrix.length === 16) {
      m.fromArray(n.matrix);
    } else {
      const pos = new THREE.Vector3(...(n.translation || [0, 0, 0]));
      const quat = new THREE.Quaternion(...(n.rotation || [0, 0, 0, 1]));
      const scl = new THREE.Vector3(...(n.scale || [1, 1, 1]));
      m.compose(pos, quat, scl);
    }
    const pIdx = parentOf.get(idx);
    const out = pIdx != null ? getWorldMatrix(pIdx).clone().multiply(m) : m;
    matCache.set(idx, out);
    return out;
  };

  const box = new THREE.Box3();
  const corner = new THREE.Vector3();
  (json.nodes || []).forEach((n, idx) => {
    if (n.mesh == null) return;
    const wm = getWorldMatrix(idx);
    for (const prim of json.meshes[n.mesh].primitives || []) {
      const acc = accessors[prim.attributes?.POSITION];
      if (!acc?.min || !acc?.max) continue;
      for (const x of [acc.min[0], acc.max[0]]) {
        for (const y of [acc.min[1], acc.max[1]]) {
          for (const z of [acc.min[2], acc.max[2]]) {
            corner.set(x, y, z).applyMatrix4(wm);
            box.expandByPoint(corner);
          }
        }
      }
    }
  });

  return {
    fullPath,
    bytes: buf.length,
    magic,
    version,
    totalLen,
    chunk0Type,
    nodes,
    materials,
    images,
    triangles,
    box,
  };
}

describe('Enemies 2.0: Re-Sculpted Stylized GLB Assets & Expressive Rig Hooks', () => {
  const EXPECTED_SPECS = [
    {
      file: 'enemy_snap_crab.glb',
      grounded: true,
      requiredNodes: [
        'carapace',
        'belly_pad',
        'eye_stalk_L',
        'eye_stalk_R',
        'brow_L',
        'brow_R',
        'arm_L',
        'arm_R',
        'pincer_upper_L',
        'pincer_upper_R',
        'leg_L1',
        'leg_R3',
      ],
    },
    {
      file: 'enemy_gulp_hopper.glb',
      grounded: true,
      requiredNodes: [
        'hopper_body',
        'hopper_torso',
        'gulper_jaw',
        'tongue_tip',
        'throat_sac',
        'eye_L',
        'eye_R',
        'lid_L',
        'lid_R',
        'glass_belly_tank',
        'stolen_water_core',
        'hind_leg_L',
        'hind_leg_R',
      ],
    },
    {
      file: 'enemy_volt_eel.glb',
      grounded: false,
      requiredNodes: [
        'seg_0',
        'seg_1',
        'seg_7',
        'eel_skull',
        'eel_jaw',
        'eel_tongue',
        'eel_brow_L',
        'eel_brow_R',
        'arc_antenna_L',
        'arc_antenna_R',
        'arc_bridge',
      ],
    },
    {
      file: 'enemy_rail_skater.glb',
      grounded: true,
      requiredNodes: [
        'manta_chassis',
        'manta_hull',
        'visor_eye_L',
        'visor_eye_R',
        'skater_brow_L',
        'skater_brow_R',
        'clockwork_key',
        'wheel_FL',
        'wheel_FR',
        'wheel_BL',
        'wheel_BR',
        'impeller_L',
        'impeller_R',
      ],
    },
    {
      file: 'enemy_barnacle_mortar.glb',
      grounded: true,
      requiredNodes: [
        'mortar_turret',
        'reef_base',
        'hermit_face',
        'hermit_eye_L',
        'hermit_eye_R',
        'hermit_brow_L',
        'hermit_brow_R',
        'mortar_periscope',
        'petal_pivot_0',
        'petal_pivot_4',
        'pressure_core',
        'mortar_bubble',
      ],
    },
    {
      file: 'enemy_vent_stalker.glb',
      grounded: true,
      requiredNodes: [
        'stalker_body',
        'stalker_torso',
        'stalker_head',
        'throat_sac',
        'stalker_eye_L',
        'stalker_eye_R',
        'stalker_brow_L',
        'stalker_brow_R',
        'dorsal_vents',
        'chimney_cap_0',
        'chimney_cap_2',
        'leg_FL',
        'leg_BR',
      ],
    },
    {
      file: 'enemy_siphon_warden.glb',
      grounded: false,
      requiredNodes: [
        'warden_body',
        'warden_mantle',
        'warden_eye',
        'warden_iris',
        'warden_lid_top',
        'warden_lid_bot',
        'shield_orbit',
        'shield_0',
        'shield_1',
        'shield_2',
        'tentacle_0',
        'tentacle_3',
        'tentacle_tip_0',
        'tentacle_tip_3',
        'crown_act_1',
        'crown_act_2',
        'crown_act_3',
        'crown_act_4',
        'crown_act_5',
        'siphon_singularity',
      ],
    },
  ];

  it('verifies all 7 enemy GLBs exist, are valid GLB 2.0 with packed PBR textures, clean grounding & expressive face/crown nodes', () => {
    for (const spec of EXPECTED_SPECS) {
      const info = parseGlbInfo(spec.file);
      expect(info.magic, `${spec.file} magic`).toBe('glTF');
      expect(info.version, `${spec.file} version`).toBe(2);
      expect(info.totalLen).toBe(info.bytes);
      expect(info.bytes, `${spec.file} size`).toBeGreaterThan(80_000);
      expect(info.bytes, `${spec.file} budget`).toBeLessThan(900_000);
      expect(info.images, `${spec.file} packed PBR images`).toBeGreaterThanOrEqual(4);
      expect(info.triangles, `${spec.file} triangle count`).toBeGreaterThanOrEqual(2000);
      expect(info.triangles, `${spec.file} mobile tri budget`).toBeLessThanOrEqual(8000);

      for (const reqNode of spec.requiredNodes) {
        expect(info.nodes, `${spec.file} missing node ${reqNode}`).toContain(reqNode);
      }

      if (spec.grounded) {
        expect(
          Math.abs(info.box.min.y),
          `${spec.file} ground flush min_y=${info.box.min.y}`
        ).toBeLessThanOrEqual(0.02);
      }
    }
  });
});

describe('Enemies 2.0: Widened 5.4F Culling Window & Synchronized World Scales (#603)', () => {
  it('exposes calibrated world scales and widened 5.4F / 6.2F culling constants', () => {
    expect(ENEMY_CULL_FLOOR_WINDOW).toBe(5.4);
    expect(WARDEN_CULL_FLOOR_WINDOW).toBe(6.2);
    expect(FAMILY_WORLD_SCALES).toHaveLength(7);
    expect(FAMILY_WORLD_SCALES[FAM_SNAP_CRAB]).toBe(1.22);
    expect(FAMILY_WORLD_SCALES[FAM_SIPHON_WARDEN]).toBe(0.90);
    expect(ACT_WARDEN_PALETTES).toHaveLength(5);
  });

  it('keeps enemies visible up to 5.4F (standard) / 6.2F (Warden) and culls beyond those windows', () => {
    const scene = new THREE.Scene();
    const pool = new EnemyVisualPool(scene);
    pool.prewarmAllRigs();

    const enemies = [
      { type: 'snap_crab', col: 0, floor: 5.1, dir: 1, aiState: 'patrol' }, // inside 5.4F (would have popped out at 3.8F!)
      { type: 'snap_crab', col: 0, floor: 5.8, dir: 1, aiState: 'patrol' }, // outside 5.4F -> culled!
      { type: 'siphon_warden', col: 0, floor: 6.0, dir: 1, isBoss: true, hp: 5, maxHp: 5, aiState: 'patrol' }, // inside 6.2F
      { type: 'siphon_warden', col: 0, floor: 6.6, dir: 1, isBoss: true, hp: 5, maxHp: 5, aiState: 'patrol' }, // outside 6.2F -> culled!
    ];

    pool.syncEnemies(enemies, 0, 1.5, 3.75, 1.0, 0, { camFloor: 0.0, heroCol: 0, heroFloor: 0 });

    const visibleCrabs = pool._buckets[FAM_SNAP_CRAB].filter((r) => r.visible);
    const visibleWardens = pool._buckets[FAM_SIPHON_WARDEN].filter((r) => r.visible);
    expect(visibleCrabs).toHaveLength(1);
    expect(visibleWardens).toHaveLength(1);

    pool.dispose();
  });
});

describe('Enemies 2.0: Zero-GC Pooled Diegetic World Telegraphs & Defensive State Handling', () => {
  it('drives all 7 enemy diegetic telegraph states cleanly without throwing and toggles exact pooled meshes', () => {
    const scene = new THREE.Scene();
    const pool = new EnemyVisualPool(scene);
    pool.prewarmAllRigs();

    // 1. Snap-Crab: aggro_tell (! pop), flipped (dizzy stars + ▲ BOUNCE chevron), shellPunted (spin blur!)
    const crabAggro = { type: 'snap_crab', col: 0, floor: 0, dir: 1, aiState: 'aggro_tell', telegraph: 0.9 };
    const crabFlip = { type: 'snap_crab', col: 1, floor: 0, dir: 1, aiState: 'flipped', flipped: true, bounceSquash: 0.7 };
    const crabPunt = { type: 'snap_crab', col: -1, floor: 0, dir: 1, aiState: 'shell_slide', flipped: true, shellPunted: true, velCol: 8.5 };
    for (let k = 0; k < 15; k++) {
      pool.syncEnemies([crabAggro, crabFlip, crabPunt], 0, 1.5, 3.75, 0.5 + k * 0.05, 0, { camFloor: 0 });
    }
    const crabRigs = pool._buckets[FAM_SNAP_CRAB];
    expect(crabRigs[0].userData.diegetic.alertSprite.visible).toBe(true);
    expect(crabRigs[1].userData.diegetic.dizzyGroup.visible).toBe(true);
    expect(crabRigs[1].userData.bounceChevron.visible).toBe(true);
    expect(crabRigs[2].userData.spinBlurRing.visible).toBe(true);

    // 2. Gulp-Hopper: 1.6x balloon inflation + radial ground shockwave ring (`slamWaveProgress`)
    const hopperInflate = { type: 'gulp_hopper', col: 0, floor: 0, baseFloor: 0, dir: 1, aiState: 'inflate', inflatePhase: 1.0 };
    const hopperSlam = { type: 'gulp_hopper', col: 1, floor: 0, baseFloor: 0, dir: 1, aiState: 'land_recover', slamWaveProgress: 0.42 };
    for (let k = 0; k < 20; k++) {
      pool.syncEnemies([hopperInflate, hopperSlam], 0, 1.5, 3.75, 2.0 + k * 0.05, 0, { camFloor: 0 });
    }
    const hopRigs = pool._buckets[FAM_GULP_HOPPER];
    expect(hopRigs[0].userData.glassTank.scale.x).toBeGreaterThan(1.48);
    expect(hopRigs[0].userData.diegetic.alertSprite.visible).toBe(true);
    expect(hopRigs[1].userData.shockwaveRing.visible).toBe(true);

    // 3. Volt-Eel: translucent electric danger dome on coil_tell/discharge, dimming + dizzy stars on exhausted
    const eelShock = { type: 'volt_eel', col: 0, floor: 1, dir: 1, aiState: 'discharge', coilBlend: 1, shockActive: true };
    const eelExhaust = { type: 'volt_eel', col: 1, floor: 1, dir: 1, aiState: 'exhausted', coilBlend: 0, shockActive: false };
    for (let k = 0; k < 15; k++) {
      pool.syncEnemies([eelShock, eelExhaust], 0, 1.5, 3.75, 4.0 + k * 0.05, 0, { camFloor: 1 });
    }
    const eelRigs = pool._buckets[FAM_VOLT_EEL];
    expect(eelRigs[0].userData.electricDome.visible).toBe(true);
    expect(eelRigs[1].userData.electricDome.visible).toBe(false);
    expect(eelRigs[1].userData.diegetic.dizzyGroup.visible).toBe(true);

    // 4. Rail-Skater: burnout sparks & lean on spark_brake + windup `!` alert
    const skaterBrake = { type: 'rail_skater', col: 0, floor: 0, dir: 1, aiState: 'spark_brake', brakeBlend: 1 };
    const skaterWind = { type: 'rail_skater', col: 1, floor: 0, dir: -1, aiState: 'windup', telegraph: 0.8 };
    for (let k = 0; k < 15; k++) {
      pool.syncEnemies([skaterBrake, skaterWind], 0, 1.5, 3.75, 6.0 + k * 0.05, 0, { camFloor: 0 });
    }
    const skRigs = pool._buckets[FAM_RAIL_SKATER];
    expect(skRigs[0].userData.burnoutSparks.every((s) => s.visible)).toBe(true);
    expect(skRigs[1].userData.diegetic.alertSprite.visible).toBe(true);

    // 5. Barnacle Mortar: dotted parabolic targeting arc + floor bullseye + Golden `BAT IT!` projectile halo + `shell_hide` panic
    const mortarAim = {
      type: 'barnacle_mortar',
      col: 0,
      floor: 0,
      dir: 1,
      aiState: 'swell_tell',
      telegraph: 0.85,
      openAmount: 0.85,
      mortarArc: { startCol: 0, startFloor: 0.5, targetCol: 3.0, targetFloor: 0, progress: 0.85 },
    };
    const mortarHide = { type: 'barnacle_mortar', col: -1, floor: 0, dir: 1, aiState: 'shell_hide', shellHide: 1 };
    const mortarProjs = [
      { col: 1.5, floor: 0.8, deflected: false, batWindow: true },
      { col: 0.4, floor: 0.6, deflected: true },
    ];
    for (let k = 0; k < 15; k++) {
      pool.syncEnemies([mortarAim, mortarHide], 0, 1.5, 3.75, 8.0 + k * 0.05, 0, {
        camFloor: 0,
        heroCol: 2.0,
        heroFloor: 0,
        enemyProjectiles: mortarProjs,
      });
    }
    const morRigs = pool._buckets[FAM_BARNACLE_MORTAR];
    expect(morRigs[0].userData.diegetic.alertSprite.visible).toBe(true);
    expect(morRigs[1].userData.diegetic.curioSprite.visible).toBe(true);
    expect(pool._mortarArcs[0].bullseye.visible).toBe(true);
    expect(pool._mortarArcs[0].beads.filter((b) => b.visible).length).toBeGreaterThanOrEqual(6);
    expect(pool._projHalos[0].visible).toBe(true);
    expect(pool._projHalos[1].visible).toBe(true);

    // 6. Vent-Stalker: flaring throat-sac & vertical steam plume column on hiss_tell / erupt + dizzy cooldown
    const stalkerHiss = { type: 'vent_stalker', col: 0, floor: 1, dir: 1, aiState: 'hiss_tell', telegraph: 0.9 };
    const stalkerErupt = { type: 'vent_stalker', col: 1, floor: 1, dir: 1, aiState: 'erupt', venting: true };
    const stalkerCool = { type: 'vent_stalker', col: -1, floor: 1, dir: 1, aiState: 'cooldown' };
    for (let k = 0; k < 15; k++) {
      pool.syncEnemies([stalkerHiss, stalkerErupt, stalkerCool], 0, 1.5, 3.75, 10.0 + k * 0.05, 0, { camFloor: 1 });
    }
    const stRigs = pool._buckets[FAM_VENT_STALKER];
    expect(stRigs[0].userData.steamColumn.visible).toBe(true);
    expect(stRigs[0].userData.throatSac.scale.x).toBeGreaterThan(1.45);
    expect(stRigs[1].userData.steamColumn.visible).toBe(true);
    expect(stRigs[2].userData.diegetic.dizzyGroup.visible).toBe(true);

    // 7. Siphon Warden: Act 1–5 signatures, floor warning carpet, sweeping Hydro-Beam & exposed core dizzy stars
    const actSigs = ['bulldozer_mortar', 'cryo_beam', 'mire_tentacles', 'aegis_summoner', 'leviathan_prime'];
    for (let a = 0; a < actSigs.length; a++) {
      const bossTele = {
        type: 'siphon_warden',
        col: 0,
        floor: 2,
        dir: 1,
        isBoss: true,
        hp: 4,
        maxHp: 6,
        bossPhase: 2,
        actSignature: actSigs[a],
        aiState: 'telegraph',
        telegraph: 0.85,
        beamCharge: 0.9,
        beamActive: a === 1 || a === 4,
        shielded: true,
        coreExposed: false,
      };
      pool.syncEnemies([bossTele], 0, 1.5, 3.75, 12.0 + a * 0.2, 0, { camFloor: 2 });
      const wRig = pool._buckets[FAM_SIPHON_WARDEN][0];
      expect(wRig.userData.floorCarpet.visible).toBe(true);
      expect(wRig.userData.hydroBeam.visible).toBe(true);
    }

    const bossExposed = {
      type: 'siphon_warden',
      col: 0,
      floor: 2,
      dir: 1,
      isBoss: true,
      hp: 2,
      maxHp: 6,
      bossPhase: 3,
      actSignature: 'leviathan_prime',
      aiState: 'vulnerable',
      shielded: false,
      coreExposed: true,
    };
    pool.syncEnemies([bossExposed], 0, 1.5, 3.75, 14.0, 0, { camFloor: 2 });
    const wRigExp = pool._buckets[FAM_SIPHON_WARDEN][0];
    expect(wRigExp.userData.exposedRingOuter.visible).toBe(true);
    expect(wRigExp.userData.diegetic.dizzyGroup.visible).toBe(true);
    expect(wRigExp.userData.floorCarpet.visible).toBe(false);

    // Defensive test: bare minimal enemy objects & Bestiary turntable showcase never throw!
    const bareList = ENEMY_FAMILIES.map((type, idx) => ({ type, col: idx * 0.4, floor: 0 }));
    expect(() => pool.syncEnemies(bareList, 0, 1.5, 3.75, 16.0, 0, null)).not.toThrow();
    for (const fam of ENEMY_FAMILIES) {
      expect(resolveEnemyFamilyId(fam)).toBeGreaterThanOrEqual(0);
      expect(() => pool.setBestiaryShowcase({ active: true, family: fam, yaw: 0.4, time: 17.0 })).not.toThrow();
    }
    expect(() => pool.setBestiaryShowcase({ active: false })).not.toThrow();
    expect(() => pool.dispose()).not.toThrow();
  });
});
