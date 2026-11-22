import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect, vi } from 'vitest';
import * as THREE from '../vendor/three/build/three.module.min.js';

vi.mock('three', () => import('../vendor/three/build/three.module.min.js'));
vi.mock('three/addons/loaders/GLTFLoader.js', () => import('../vendor/three/examples/jsm/loaders/GLTFLoader.js'));

import {
  GatewayRig,
  PogoRig,
  GATEWAY_SKINS,
  POGO_SKINS,
  SKIN_CATALOG as GATEWAY_SKIN_EXPORTS,
  GATEWAY_CLIP_NAMES,
  GATEWAY_MOODS,
  GATEWAY_CANONICAL_BONES,
  GATEWAY_V2_APPEAL_BONES,
  DEFAULT_TARGET_HEIGHT,
} from '../src/gateway.js';
import { SKIN_CATALOG } from '../src/progression.js';

const GLB_PATH = path.resolve(process.cwd(), 'assets/models/gateway.glb');

function parseGlbJson(filePath) {
  const buf = fs.readFileSync(filePath);
  expect(buf.toString('ascii', 0, 4)).toBe('glTF');
  const version = buf.readUInt32LE(4);
  expect(version).toBe(2);
  const chunkLen = buf.readUInt32LE(12);
  const chunkType = buf.toString('ascii', 16, 20);
  expect(chunkType).toBe('JSON');
  const gltf = JSON.parse(buf.toString('utf8', 20, 20 + chunkLen));
  return { buf, gltf };
}

describe('Gateway 2.0 Star Hero — Binary GLB Asset & Rig Verification', () => {
  it('validates assets/models/gateway.glb bounds (min_y == 0), size < 2.0 MB, 4600-6000 tris & WEBP PBR textures', () => {
    expect(fs.existsSync(GLB_PATH)).toBe(true);
    const { buf, gltf } = parseGlbJson(GLB_PATH);

    // File size < 2.0 MB
    const sizeMb = buf.byteLength / (1024 * 1024);
    expect(sizeMb).toBeLessThan(2.0);
    expect(sizeMb).toBeGreaterThan(0.1);

    // Embedded WEBP PBR atlas maps
    const images = gltf.images || [];
    expect(images.length).toBeGreaterThanOrEqual(4);
    for (const im of images) {
      expect(im.mimeType).toBe('image/webp');
    }

    // Triangle budget: 4,600 - 6,000 crisp triangles
    const accessors = gltf.accessors || [];
    let tris = 0;
    let minY = Infinity;
    let maxY = -Infinity;
    for (const m of gltf.meshes || []) {
      for (const p of m.primitives || []) {
        if (p.indices != null) {
          tris += Math.floor(accessors[p.indices].count / 3);
        }
        const posAcc = accessors[p.attributes.POSITION];
        if (posAcc?.min && posAcc?.max) {
          minY = Math.min(minY, posAcc.min[1]);
          maxY = Math.max(maxY, posAcc.max[1]);
        }
      }
    }

    expect(tris).toBeGreaterThanOrEqual(4600);
    expect(tris).toBeLessThanOrEqual(6000);
    // Exact sole grounding at y = 0.000m and ~1.00m crown (+ frill tips ~1.10m)
    expect(Math.abs(minY)).toBeLessThan(1e-4);
    expect(maxY).toBeGreaterThanOrEqual(0.95);
    expect(maxY).toBeLessThanOrEqual(1.16);
  });

  it('preserves all 39 canonical bones AND includes all 11 new Gateway 2.0 appeal bones (50 joints total)', () => {
    const { gltf } = parseGlbJson(GLB_PATH);
    expect(gltf.skins?.length).toBe(1);
    const joints = gltf.skins[0].joints.map((jIdx) => gltf.nodes[jIdx].name);

    expect(joints.length).toBeGreaterThanOrEqual(49);
    expect(joints.length).toBe(50);

    for (const canonBone of GATEWAY_CANONICAL_BONES) {
      expect(joints, `Missing canonical bone ${canonBone}`).toContain(canonBone);
    }
    for (const appealBone of GATEWAY_V2_APPEAL_BONES) {
      expect(joints, `Missing Gateway 2.0 appeal bone ${appealBone}`).toContain(appealBone);
    }
  });

  it('bakes all 22 NLA animation clips including IdleCurious, EdgeTeeter, SpringSomersault & WetShake', () => {
    const { gltf } = parseGlbJson(GLB_PATH);
    const animNames = (gltf.animations || []).map((a) => a.name);

    expect(animNames.length).toBe(22);
    for (const expectedClip of GATEWAY_CLIP_NAMES) {
      expect(animNames, `Missing baked NLA clip ${expectedClip}`).toContain(expectedClip);
    }
  });
});

describe('Gateway 2.0 Runtime Rig — 1.22m Scale, 6 Moods, Eye-Look, Springs, Foot-IK & 8 Skins', () => {
  it('auto-normalizes default stature to exact 1.22m world height and preserves all bone/class aliases', () => {
    const rig = new GatewayRig();
    expect(DEFAULT_TARGET_HEIGHT).toBe(1.22);
    expect(rig.getWorldHeight()).toBeCloseTo(1.22, 4);

    // Custom targetHeight & dynamic setter
    rig.setTargetHeight(1.36);
    expect(rig.getWorldHeight()).toBeCloseTo(1.36, 4);
    rig.setTargetHeight(1.22);
    expect(rig.getWorldHeight()).toBeCloseTo(1.22, 4);

    // 50 bones + legacy aliases intact
    expect(rig.skeleton.bones.length).toBe(50);
    for (const b of [...GATEWAY_CANONICAL_BONES, ...GATEWAY_V2_APPEAL_BONES]) {
      expect(rig.bones[b], `Stand-in rig missing bone ${b}`).toBeTruthy();
    }
    expect(rig.bones.browL).toBe(rig.bones.BrowL);
    expect(rig.bones.lowerLidL).toBe(rig.bones.LowerLidL);
    expect(rig.bones.mouthSmile).toBe(rig.bones.MouthSmile);
    expect(rig.bones.scarfL1).toBe(rig.bones.ScarfL1);
    expect(rig.bones.hydroCaster).toBeTruthy();
    expect(rig.bones.muzzle).toBeTruthy();
    expect(PogoRig).toBe(GatewayRig);
    expect(POGO_SKINS).toBe(GATEWAY_SKINS);
    expect(GATEWAY_SKIN_EXPORTS).toBe(GATEWAY_SKINS);

    rig.dispose();
  });

  it('drives all 6 live facial moods distinctly + organic blinking (2.5-4.5s) + live eye-look tracking', () => {
    const rig = new GatewayRig();
    expect(GATEWAY_MOODS).toEqual(['happy', 'curious', 'determined', 'joyful', 'surprised', 'hurt']);

    const snapshots = {};
    for (const mood of GATEWAY_MOODS) {
      rig.setMood(mood);
      // Settle damped facial blend over 0.6s
      for (let i = 0; i < 36; i++) {
        rig.update(1 / 60, { time: i / 60, vx: 0, vy: 0, onGround: true, mood });
      }
      expect(rig.getMood()).toBe(mood);
      snapshots[mood] = {
        uLidX: rig.bones.EyelidL.rotation.x,
        lLidX: rig.bones.LowerLidL.rotation.x,
        browLY: rig.bones.BrowL.position.y,
        browRY: rig.bones.BrowR.position.y,
        browLRoll: rig.bones.BrowL.rotation.y,
        jawX: rig.bones.Jaw.rotation.x,
        smileY: rig.bones.MouthSmile.position.y,
      };
    }

    // Verify clear expression separation:
    // - joyful lifts LowerLidL into `^ ^` crescent higher than happy & opens Jaw laugh
    expect(snapshots.joyful.lLidX).toBeGreaterThan(snapshots.happy.lLidX + 0.35);
    expect(snapshots.joyful.jawX).toBeGreaterThan(0.10);
    // - curious raises left brow higher than right brow (asymmetric inquisitive tilt!)
    expect(snapshots.curious.browLY).toBeGreaterThan(snapshots.curious.browRY + 0.012);
    // - determined angles brow inward (`browLRoll < 0`) vs happy (`> 0`)
    expect(snapshots.determined.browLRoll).toBeLessThan(-0.15);
    expect(snapshots.happy.browLRoll).toBeGreaterThan(0.02);
    // - surprised opens upper lids wider & raises brows higher than happy
    expect(snapshots.surprised.uLidX).toBeLessThan(snapshots.happy.uLidX - 0.10);
    expect(snapshots.surprised.browLY).toBeGreaterThan(snapshots.happy.browLY + 0.01);
    // - hurt tightly winces both upper and lower lids
    expect(snapshots.hurt.uLidX).toBeGreaterThan(0.45);
    expect(snapshots.hurt.lLidX).toBeGreaterThan(0.40);

    // Test automatic organic blink within 2.5 - 4.5s window
    rig.setMood('happy');
    let maxBlinkRotX = -Infinity;
    for (let step = 0; step < 300; step++) {
      rig.update(1 / 60, { time: step / 60, vx: 0, vy: 0, onGround: true });
      if (rig.bones.EyelidL.rotation.x > maxBlinkRotX) {
        maxBlinkRotX = rig.bones.EyelidL.rotation.x;
      }
    }
    expect(maxBlinkRotX).toBeGreaterThan(0.55);

    // Test live eye-look & pointer gaze tracking
    rig.setPointerGaze(0.85, -0.45, true);
    for (let i = 0; i < 30; i++) {
      rig.update(1 / 60, { time: 5 + i / 60, vx: 0, vy: 0, onGround: true, titleShowcase: true });
    }
    expect(rig.bones.EyeL.rotation.y).toBeGreaterThan(0.08);
    expect(rig.bones.EyeR.rotation.y).toBeGreaterThan(0.08);
    expect(rig.bones.EyeL.rotation.x).toBeGreaterThan(0.03);

    rig.dispose();
  });

  it('maintains < 0.05mm grounded 2-bone Analytic Foot-IK lock across IdleBreathe, IdleCurious, HydroCast & landing crouch', () => {
    const rig = new GatewayRig();
    const motionRoot = rig._motionRoot || rig._standInGroup;
    expect(rig._legIkBind).toBeTruthy();

    const bindAnkleL = rig._legIkBind[0].ankleBindPos.clone();
    const bindAnkleR = rig._legIkBind[1].ankleBindPos.clone();
    const invRoot = new THREE.Matrix4();
    const tmpM = new THREE.Matrix4();
    const curPos = new THREE.Vector3();

    let maxDriftMm = 0;

    // 1. IdleBreathe + IdleCurious + HydroCast + Land compression across 180 frames
    for (let step = 0; step < 180; step++) {
      const t = step / 60;
      const isCast = step >= 90 && step < 115;
      const landImpact = step === 120 ? 0.85 : 0;
      rig.update(1 / 60, {
        time: t,
        vx: 0,
        vy: 0,
        facing: 1,
        onGround: true,
        muzzleFlash: isCast ? 0.14 : 0,
        landImpact,
        squashY: step >= 120 && step < 140 ? 0.88 : 1.0,
      });

      motionRoot.updateWorldMatrix(true, true);
      invRoot.copy(motionRoot.matrixWorld).invert();

      tmpM.multiplyMatrices(invRoot, rig.bones.AnkleL.matrixWorld);
      curPos.setFromMatrixPosition(tmpM);
      maxDriftMm = Math.max(maxDriftMm, curPos.distanceTo(bindAnkleL) * 1000);

      tmpM.multiplyMatrices(invRoot, rig.bones.AnkleR.matrixWorld);
      curPos.setFromMatrixPosition(tmpM);
      maxDriftMm = Math.max(maxDriftMm, curPos.distanceTo(bindAnkleR) * 1000);
    }

    expect(maxDriftMm).toBeLessThan(0.05);
    rig.dispose();
  });

  it('animates secondary springs (scarf, 6 coral frills, 7-bone tail) and Title/Personality triggers cleanly', () => {
    const rig = new GatewayRig();

    // Sprint + jump -> flowing scarf & tail springs respond dynamically
    for (let i = 0; i < 25; i++) {
      rig.update(1 / 60, { time: i / 60, vx: 3.5, vy: 5.0, facing: 1, onGround: false });
    }
    expect(Math.abs(rig.bones.ScarfL1.rotation.x)).toBeGreaterThan(0.02);
    expect(Math.abs(rig.bones.ScarfR2.rotation.x)).toBeGreaterThan(0.02);
    expect(Math.abs(rig.bones.FrillBotL.rotation.x)).toBeGreaterThan(0.01);
    expect(Math.abs(rig.bones.Tail4.rotation.x)).toBeGreaterThan(0.01);

    // Title Wave & Title Hop interactive behaviors
    rig.triggerTitleWave();
    rig.update(1 / 60, { time: 1.0, vx: 0, vy: 0, onGround: true, titleShowcase: true });
    expect(rig._activeClipName).toBe('IdleCurious');
    expect(rig.getMood()).toBe('joyful');

    rig.triggerTitleHop();
    rig.update(0.15, { time: 1.15, vx: 0, vy: 0, onGround: true, titleShowcase: true });
    expect(rig._activeClipName).toBe('Celebrate');
    expect((rig._motionRoot || rig._standInGroup).position.y).toBeGreaterThan(0.08);

    // EdgeTeeter, SpringSomersault, WetShake, HeroCelebrate alias
    rig._titleHopTimer = 0;
    rig._titleWaveTimer = 0;
    rig.update(1 / 60, { time: 2.0, vx: 0, vy: 0, onGround: true, edgeTeeter: 0.9 });
    expect(rig._activeClipName).toBe('EdgeTeeter');
    expect(rig.getMood()).toBe('surprised');

    rig.update(1 / 60, { time: 2.1, vx: 1.5, vy: 8.0, onGround: false, springSomersault: true });
    expect(rig._activeClipName).toBe('SpringSomersault');
    expect(rig.getMood()).toBe('joyful');

    rig.update(1 / 60, { time: 2.2, vx: 0, vy: 0, onGround: true, wetShakeTimer: 0.55 });
    expect(rig._activeClipName).toBe('WetShake');

    rig.playAction('HeroCelebrate');
    expect(rig._activeClipName).toBe('Celebrate');

    rig.dispose();
  });

  it('switches cleanly across all 8 SKIN_CATALOG palettes including Sovereign Starlight aurora motes', () => {
    expect(SKIN_CATALOG.length).toBe(8);
    expect(GATEWAY_SKINS.length).toBe(8);

    const rig = new GatewayRig();
    for (const catSkin of SKIN_CATALOG) {
      rig.setSkin(catSkin.id);
      expect(rig.currentSkinId).toBe(catSkin.id);
      expect(rig._activeSkin.id).toBe(catSkin.id);
      expect(rig._activeSkin.scarfColor).toBeTruthy();
      expect(rig._starMotesGroup.visible).toBe(catSkin.id === 'sovereign_starlight');
    }

    // Invalid skin ID gracefully falls back to sea_glass_guardian
    rig.setSkin('nonexistent_skin_id');
    expect(rig.currentSkinId).toBe('sea_glass_guardian');

    rig.dispose();
  });
});
