import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

/**
 * TOWERING WATERS: GATEWAY'S DESCENT — AAA Skeletal Heroine & Skins (`src/gateway.js`)
 * ====================================================================================
 * Gateway — Sleek, athletic female alien hydro-lizard from oceanic starworld Pelagia:
 *   - ~1.185 world units standing height + ~0.985u counter-balancing S-curved lizard tail
 *   - True weight-painted `THREE.SkinnedMesh` + 39-bone `THREE.Skeleton` (`assets/models/gateway.glb`)
 *   - 1024x1024 Baked PBR Texture Atlas (Iridescent Scales Albedo, Tangent Normal, ORM, Biolume Emissive)
 *   - 18 Baked `THREE.AnimationMixer` Skeletal Clips (`0.10s–0.18s` smooth cross-fades)
 *   - Zero-allocation additive procedural bone polish: cylinder turn banking, 5-riser staircase
 *     foot-planting offsets, head/eye look-at, aquatic head-frill flare, run-and-cast upper-body
 *     layering, and 2nd-order spring-damped 7-bone dynamic tail S-wave physics!
 */

export const GATEWAY_SKINS = [
  {
    id: 'sea_glass_guardian',
    name: 'Sea-Glass Guardian',
    bodyColor: '#16b3ac',
    bellyColor: '#fff1eb',
    crestColor: '#4ef4e2',
    vestColor: '#e8f6f8',
    harnessColor: '#e8f6f8',
    packColor: '#e2b15c',
    eyeGlow: '#fbbf24',
    accentColor: '#5efce8',
    metallic: 0.08,
  },
  {
    id: 'coral_reef_empress',
    name: 'Coral Reef Empress',
    bodyColor: '#f43f5e',
    bellyColor: '#fff5f2',
    crestColor: '#2dd4bf',
    vestColor: '#ffe4e6',
    harnessColor: '#ffe4e6',
    packColor: '#fb7185',
    eyeGlow: '#2dd4bf',
    accentColor: '#fde047',
    metallic: 0.10,
  },
  {
    id: 'canyon_rapids_ranger',
    name: 'Canyon Rapids Ranger',
    bodyColor: '#10b981',
    bellyColor: '#fef3c7',
    crestColor: '#06b6d4',
    vestColor: '#fde68a',
    harnessColor: '#f5ebe0',
    packColor: '#d97706',
    eyeGlow: '#f59e0b',
    accentColor: '#38bdf8',
    metallic: 0.14,
  },
  {
    id: 'alpine_glacier_mystic',
    name: 'Alpine Glacier Mystic',
    bodyColor: '#38bdf8',
    bellyColor: '#f8fafc',
    crestColor: '#f472b6',
    vestColor: '#e2e8f0',
    harnessColor: '#f1f5f9',
    packColor: '#0284c7',
    eyeGlow: '#a5f3fc',
    accentColor: '#67e8f9',
    metallic: 0.18,
  },
  {
    id: 'bayou_biolume',
    name: 'Bayou Biolume',
    bodyColor: '#0f766e',
    bellyColor: '#fef9c3',
    crestColor: '#84cc16',
    vestColor: '#cbd5e1',
    harnessColor: '#d1fae5',
    packColor: '#b45309',
    eyeGlow: '#facc15',
    accentColor: '#4ade80',
    metallic: 0.12,
  },
  {
    id: 'abyssal_leviathan',
    name: 'Abyssal Leviathan',
    bodyColor: '#1d4ed8',
    bellyColor: '#cbd5e1',
    crestColor: '#a855f7',
    vestColor: '#334155',
    harnessColor: '#94a3b8',
    packColor: '#6366f1',
    eyeGlow: '#22d3ee',
    accentColor: '#00f5d4',
    metallic: 0.26,
  },
  {
    id: 'solar_oasis',
    name: 'Solar Oasis',
    bodyColor: '#0ea5e9',
    bellyColor: '#fefce8',
    crestColor: '#f97316',
    vestColor: '#fef08a',
    harnessColor: '#fef9c3',
    packColor: '#eab308',
    eyeGlow: '#10b981',
    accentColor: '#fbbf24',
    metallic: 0.34,
  },
  {
    id: 'sovereign_starlight',
    name: 'Sovereign Starlight',
    bodyColor: '#eab308',
    bellyColor: '#ffffff',
    crestColor: '#c084fc',
    vestColor: '#fef08a',
    harnessColor: '#faf5ff',
    packColor: '#fde047',
    eyeGlow: '#e879f9',
    accentColor: '#67e8f9',
    metallic: 0.68,
  },
];

// Compatibility alias for callers migrating to Gateway
export const POGO_SKINS = GATEWAY_SKINS;

const SKIN_MAP = new Map(GATEWAY_SKINS.map((s) => [s.id, s]));

export const GATEWAY_CLIP_NAMES = [
  'IdleBreathe',
  'Walk',
  'FluidRun',
  'StairClimb',
  'JumpCoil',
  'AirRise',
  'FrillGlide',
  'Fall',
  'Land',
  'LedgeMantle',
  'WallScamper',
  'TailWhip',
  'HydroCast',
  'FreeSwim',
  'RapidsSurf',
  'CoreDive',
  'Celebrate',
  'CutsceneHero',
];

const ONE_SHOT_CLIPS = new Set(['JumpCoil', 'Land', 'LedgeMantle', 'TailWhip', 'HydroCast']);

const CLIP_ALIASES = {
  idle: 'IdleBreathe',
  idlebreathe: 'IdleBreathe',
  breathe: 'IdleBreathe',
  walk: 'Walk',
  run: 'FluidRun',
  fluidrun: 'FluidRun',
  sprint: 'FluidRun',
  stair: 'StairClimb',
  stairs: 'StairClimb',
  stairclimb: 'StairClimb',
  coil: 'JumpCoil',
  jumpcoil: 'JumpCoil',
  jump: 'AirRise',
  rise: 'AirRise',
  airrise: 'AirRise',
  glide: 'FrillGlide',
  frillglide: 'FrillGlide',
  frill_glide: 'FrillGlide',
  fall: 'Fall',
  land: 'Land',
  mantle: 'LedgeMantle',
  ledgemantle: 'LedgeMantle',
  climb: 'WallScamper',
  scamper: 'WallScamper',
  wallscamper: 'WallScamper',
  wall_scamper: 'WallScamper',
  whip: 'TailWhip',
  tailwhip: 'TailWhip',
  tail_whip: 'TailWhip',
  cast: 'HydroCast',
  shoot: 'HydroCast',
  fire: 'HydroCast',
  hydrocast: 'HydroCast',
  hydro_cast: 'HydroCast',
  swim: 'FreeSwim',
  freeswim: 'FreeSwim',
  free_swim: 'FreeSwim',
  reef_swim: 'FreeSwim',
  surf: 'RapidsSurf',
  rapidssurf: 'RapidsSurf',
  rapids_surf: 'RapidsSurf',
  dive: 'CoreDive',
  coredive: 'CoreDive',
  core_dive: 'CoreDive',
  core_descent: 'CoreDive',
  celebrate: 'Celebrate',
  victory: 'Celebrate',
  cutscene: 'CutsceneHero',
  cutscenehero: 'CutsceneHero',
  hero: 'CutsceneHero',
};

// Exact 39-bone bind-pose specification matching `tools/build_gateway_3d.py` 1:1
const STANDIN_BONE_SPECS = [
  ['Root', null, [0, 0, 0]],
  ['Pelvis', 'Root', [0, 0.53, -0.012]],
  ['Spine1', 'Pelvis', [0, 0.075, 0.004]],
  ['Spine2', 'Spine1', [0, 0.09, 0.01]],
  ['Chest', 'Spine2', [0, 0.09, 0.006]],
  ['Neck', 'Chest', [0, 0.09, -0.002]],
  ['Head', 'Neck', [0, 0.093, 0.014]],
  ['Jaw', 'Head', [0, 0.017, 0.022]],
  ['EyeL', 'Head', [0.053, 0.068, 0.064]],
  ['EyeR', 'Head', [-0.053, 0.068, 0.064]],
  ['EyelidL', 'Head', [0.053, 0.072, 0.064]],
  ['EyelidR', 'Head', [-0.053, 0.072, 0.064]],
  ['FrillL1', 'Head', [0.068, 0.067, -0.005]],
  ['FrillL2', 'FrillL1', [0.077, 0.067, -0.093]],
  ['FrillR1', 'Head', [-0.068, 0.067, -0.005]],
  ['FrillR2', 'FrillR1', [-0.077, 0.067, -0.093]],
  ['ClavicleL', 'Chest', [0.038, 0.063, -0.004]],
  ['UpperArmL', 'ClavicleL', [0.068, 0.004, -0.008]],
  ['ForearmL', 'UpperArmL', [0.062, -0.176, -0.008]],
  ['HandL', 'ForearmL', [0.03, -0.164, 0.04]],
  ['ClavicleR', 'Chest', [-0.038, 0.063, -0.004]],
  ['UpperArmR', 'ClavicleR', [-0.068, 0.004, -0.008]],
  ['ForearmR', 'UpperArmR', [-0.062, -0.176, -0.008]],
  ['HandR', 'ForearmR', [-0.03, -0.164, 0.04]],
  ['ThighL', 'Pelvis', [0.084, -0.005, 0.006]],
  ['ShinL', 'ThighL', [0.02, -0.22, 0.054]],
  ['AnkleL', 'ShinL', [-0.006, -0.173, -0.09]],
  ['FootL', 'AnkleL', [0, -0.098, 0.078]],
  ['ThighR', 'Pelvis', [-0.084, -0.005, 0.006]],
  ['ShinR', 'ThighR', [-0.02, -0.22, 0.054]],
  ['AnkleR', 'ShinR', [0.006, -0.173, -0.09]],
  ['FootR', 'AnkleR', [0, -0.098, 0.078]],
  ['Tail1', 'Pelvis', [0, -0.008, -0.05]],
  ['Tail2', 'Tail1', [0, -0.04, -0.14]],
  ['Tail3', 'Tail2', [0, -0.046, -0.146]],
  ['Tail4', 'Tail3', [0, -0.034, -0.147]],
  ['Tail5', 'Tail4', [0, -0.014, -0.147]],
  ['Tail6', 'Tail5', [0, 0.014, -0.143]],
  ['Tail7', 'Tail6', [0, 0.032, -0.137]],
];

const BONE_ALIAS_PAIRS = [
  ['root', 'Root'],
  ['pelvis', 'Pelvis'],
  ['spine', 'Spine1'],
  ['spine1', 'Spine1'],
  ['spine2', 'Spine2'],
  ['chest', 'Chest'],
  ['neck', 'Neck'],
  ['head', 'Head'],
  ['jaw', 'Jaw'],
  ['eyeL', 'EyeL'],
  ['eyeR', 'EyeR'],
  ['eyelidL', 'EyelidL'],
  ['eyelidR', 'EyelidR'],
  ['frillL1', 'FrillL1'],
  ['frillL2', 'FrillL2'],
  ['frillR1', 'FrillR1'],
  ['frillR2', 'FrillR2'],
  ['crest', 'FrillL1'],
  ['browL', 'EyelidL'],
  ['browR', 'EyelidR'],
  ['clavicleL', 'ClavicleL'],
  ['clavicleR', 'ClavicleR'],
  ['shoulderL', 'ClavicleL'],
  ['shoulderR', 'ClavicleR'],
  ['upperArmL', 'UpperArmL'],
  ['upperArmR', 'UpperArmR'],
  ['forearmL', 'ForearmL'],
  ['forearmR', 'ForearmR'],
  ['handL', 'HandL'],
  ['handR', 'HandR'],
  ['thighL', 'ThighL'],
  ['thighR', 'ThighR'],
  ['shinL', 'ShinL'],
  ['shinR', 'ShinR'],
  ['ankleL', 'AnkleL'],
  ['ankleR', 'AnkleR'],
  ['footL', 'FootL'],
  ['footR', 'FootR'],
  ['tail1', 'Tail1'],
  ['tail2', 'Tail2'],
  ['tail3', 'Tail3'],
  ['tail4', 'Tail4'],
  ['tail5', 'Tail5'],
  ['tail6', 'Tail6'],
  ['tail7', 'Tail7'],
];

let _sharedGatewayGlbPromise = null;
const _skinAtlasCache = new Map();

function damp(current, target, lambda, dt) {
  return THREE.MathUtils.lerp(current, target, 1 - Math.exp(-lambda * dt));
}

function dampAngle(current, target, lambda, dt) {
  let delta = (target - current) % (Math.PI * 2);
  if (delta > Math.PI) delta -= Math.PI * 2;
  if (delta < -Math.PI) delta += Math.PI * 2;
  return current + delta * (1 - Math.exp(-lambda * dt));
}

function hexToRgb01(hex) {
  const c = new THREE.Color(hex);
  const toSrgb = (v) => (v <= 0.0031308 ? v * 12.92 : 1.055 * Math.pow(v, 1 / 2.4) - 0.055);
  return [toSrgb(c.r), toSrgb(c.g), toSrgb(c.b)];
}

/**
 * Self-contained deep cloner for `THREE.SkinnedMesh` + `THREE.Bone` hierarchies.
 * Guarantees each `GatewayRig` instance owns an independent `THREE.Skeleton` and bones.
 */
function cloneSkinnedHierarchy(sourceRoot) {
  const clonedRoot = sourceRoot.clone(true);
  const srcNodes = [];
  const dstNodes = [];
  sourceRoot.traverse((n) => srcNodes.push(n));
  clonedRoot.traverse((n) => dstNodes.push(n));

  const nodeMap = new Map();
  for (let i = 0; i < srcNodes.length; i++) {
    nodeMap.set(srcNodes[i], dstNodes[i]);
  }

  for (let i = 0; i < srcNodes.length; i++) {
    const src = srcNodes[i];
    if (!src.isSkinnedMesh || !src.skeleton) continue;
    const dst = dstNodes[i];
    const clonedBones = src.skeleton.bones.map((b) => nodeMap.get(b) || b);
    const clonedInverses = src.skeleton.boneInverses.map((m) => m.clone());
    dst.bind(new THREE.Skeleton(clonedBones, clonedInverses), src.bindMatrix.clone());
    dst.frustumCulled = false;
    dst.castShadow = true;
    dst.receiveShadow = true;
  }

  return clonedRoot;
}

/**
 * Loads `assets/models/gateway.glb` once and shares the parsed template & GPU base textures.
 */
function loadSharedGatewayGlb() {
  if (_sharedGatewayGlbPromise !== null) return _sharedGatewayGlbPromise;
  if (typeof window === 'undefined' || typeof fetch !== 'function') {
    _sharedGatewayGlbPromise = Promise.resolve(null);
    return _sharedGatewayGlbPromise;
  }

  _sharedGatewayGlbPromise = new Promise((resolve) => {
    try {
      const loader = new GLTFLoader();
      loader.load(
        'assets/models/gateway.glb',
        (gltf) => {
          if (!gltf || !gltf.scene) {
            resolve(null);
            return;
          }
          let baseMaps = {};
          gltf.scene.traverse((obj) => {
            if (obj.geometry) {
              obj.geometry.userData = obj.geometry.userData || {};
              obj.geometry.userData.shared = true;
            }
            if (obj.isMesh && obj.material) {
              const mat = Array.isArray(obj.material) ? obj.material[0] : obj.material;
              if (mat) {
                if (mat.map && !baseMaps.albedo) baseMaps.albedo = mat.map;
                if (mat.normalMap && !baseMaps.normal) baseMaps.normal = mat.normalMap;
                if (mat.roughnessMap && !baseMaps.roughness) baseMaps.roughness = mat.roughnessMap;
                if (mat.metalnessMap && !baseMaps.metalness) baseMaps.metalness = mat.metalnessMap;
                if (mat.emissiveMap && !baseMaps.emissive) baseMaps.emissive = mat.emissiveMap;
              }
            }
          });
          resolve({
            scene: gltf.scene,
            animations: Array.isArray(gltf.animations) ? gltf.animations : [],
            baseMaps,
          });
        },
        undefined,
        () => resolve(null)
      );
    } catch {
      resolve(null);
    }
  });
  return _sharedGatewayGlbPromise;
}

/**
 * Synthesizes and caches per-skin `albedo` & `emissive` CanvasTextures from the embedded
 * 1K `gateway.glb` atlas while preserving 100% of hexagonal scale shading, belly scutes,
 * radial iris fibers, corneal catchlights, and bioluminescent lateral-line spots!
 */
function getOrBuildSkinAtlasMaps(skin, baseMaps) {
  if (!baseMaps || !baseMaps.albedo || !baseMaps.albedo.image) return null;
  if (skin.id === 'sea_glass_guardian') {
    return { albedo: baseMaps.albedo, emissive: baseMaps.emissive || null, sharedBase: true };
  }
  const cached = _skinAtlasCache.get(skin.id);
  if (cached) return cached;
  if (typeof document === 'undefined' || typeof document.createElement !== 'function') {
    return { albedo: baseMaps.albedo, emissive: baseMaps.emissive || null, sharedBase: true };
  }

  try {
    const srcImg = baseMaps.albedo.image;
    const w = Math.min(512, srcImg.width || 512);
    const h = Math.min(512, srcImg.height || 512);

    const cAlb = document.createElement('canvas');
    cAlb.width = w;
    cAlb.height = h;
    const ctxA = cAlb.getContext('2d');
    if (!ctxA) return { albedo: baseMaps.albedo, emissive: baseMaps.emissive || null, sharedBase: true };
    ctxA.drawImage(srcImg, 0, 0, w, h);
    const imgA = ctxA.getImageData(0, 0, w, h);
    const dA = imgA.data;

    const cBody = hexToRgb01(skin.bodyColor);
    const cBelly = hexToRgb01(skin.bellyColor);
    const cCrest = hexToRgb01(skin.crestColor);
    const cHarness = hexToRgb01(skin.harnessColor);
    const cPack = hexToRgb01(skin.packColor);
    const cEye = hexToRgb01(skin.eyeGlow);
    const cAccent = hexToRgb01(skin.accentColor);

    for (let py = 0; py < h; py++) {
      // glTF PNG top row `py = 0` corresponds to `v_blender = 1.0`!
      const vb = 1.0 - py / Math.max(1, h - 1);
      for (let px = 0; px < w; px++) {
        const ub = px / Math.max(1, w - 1);
        const idx = (py * w + px) * 4;
        const r0 = dA[idx] / 255;
        const g0 = dA[idx + 1] / 255;
        const b0 = dA[idx + 2] / 255;
        const lum = 0.2126 * r0 + 0.7152 * g0 + 0.0722 * b0;

        let tr = cBody[0];
        let tg = cBody[1];
        let tb = cBody[2];
        let keepOrig = 0;

        if (ub <= 0.705 && vb <= 0.765) {
          // Q_SKIN: blend smoothly between dorsal/flank scales and ventral pearl belly!
          const su = Math.max(0, Math.min(1, (ub - 0.02) / 0.66));
          const frontDist = Math.abs(su - 0.5) * 2.0;
          const sv = Math.max(0, Math.min(1, (vb - 0.02) / 0.72));
          const bellyMask =
            frontDist < 0.34 && sv > 0.10 && sv < 0.86
              ? Math.max(0, Math.min(1, (0.34 - frontDist) / 0.20))
              : 0;
          tr = cBody[0] * (1 - bellyMask) + cBelly[0] * bellyMask;
          tg = cBody[1] * (1 - bellyMask) + cBelly[1] * bellyMask;
          tb = cBody[2] * (1 - bellyMask) + cBelly[2] * bellyMask;
        } else if (ub > 0.705 && vb <= 0.70) {
          // Q_FRILL: iridescent frill base -> accent margin
          const fu = Math.max(0, Math.min(1, (ub - 0.72) / 0.26));
          tr = cCrest[0] * (1 - fu * 0.45) + cAccent[0] * (fu * 0.45);
          tg = cCrest[1] * (1 - fu * 0.45) + cAccent[1] * (fu * 0.45);
          tb = cCrest[2] * (1 - fu * 0.45) + cAccent[2] * (fu * 0.45);
        } else if (ub > 0.705 && vb > 0.70) {
          // Q_EYE: preserve dark pupil (`lum < 0.08`) & bright sclera/catchlight (`lum > 0.80`), tint iris!
          const ex = (ub - 0.85) / 0.125;
          const ey = (vb - 0.85) / 0.125;
          const er = Math.hypot(ex, ey);
          if (er > 0.70 || lum > 0.82 || lum < 0.07) {
            keepOrig = 1;
          } else {
            tr = cEye[0];
            tg = cEye[1];
            tb = cEye[2];
          }
        } else {
          // Q_GEAR: ceramic (0..0.36), metallic trim (0.36..0.68), Harmonic Water Seed (0.68..1.0)
          const gv = Math.max(0, Math.min(1, (vb - 0.78) / 0.20));
          if (gv < 0.36) {
            tr = cHarness[0];
            tg = cHarness[1];
            tb = cHarness[2];
          } else if (gv < 0.68) {
            tr = cPack[0];
            tg = cPack[1];
            tb = cPack[2];
          } else {
            tr = cAccent[0];
            tg = cAccent[1];
            tb = cAccent[2];
          }
        }

        if (keepOrig < 0.99) {
          const gain = Math.pow(Math.max(0.02, lum), 0.78) * 1.48;
          dA[idx] = Math.max(0, Math.min(255, Math.round(tr * gain * 255)));
          dA[idx + 1] = Math.max(0, Math.min(255, Math.round(tg * gain * 255)));
          dA[idx + 2] = Math.max(0, Math.min(255, Math.round(tb * gain * 255)));
        }
      }
    }
    ctxA.putImageData(imgA, 0, 0);

    const texA = new THREE.CanvasTexture(cAlb);
    texA.flipY = Boolean(baseMaps.albedo.flipY);
    texA.colorSpace = THREE.SRGBColorSpace;
    texA.minFilter = THREE.LinearMipmapLinearFilter;
    texA.magFilter = THREE.LinearFilter;
    texA.generateMipmaps = true;

    let texE = baseMaps.emissive || null;
    if (baseMaps.emissive && baseMaps.emissive.image) {
      const cEmi = document.createElement('canvas');
      cEmi.width = w;
      cEmi.height = h;
      const ctxE = cEmi.getContext('2d');
      if (ctxE) {
        ctxE.drawImage(baseMaps.emissive.image, 0, 0, w, h);
        const imgE = ctxE.getImageData(0, 0, w, h);
        const dE = imgE.data;
        for (let i = 0; i < dE.length; i += 4) {
          const elum = Math.max(dE[i], dE[i + 1], dE[i + 2]) / 255;
          if (elum > 0.01) {
            // Preserve white catchlight peaks (`elum > 0.92` & neutral)
            const isWhite = dE[i] > 225 && dE[i + 1] > 225 && dE[i + 2] > 225;
            if (!isWhite) {
              dE[i] = Math.min(255, Math.round(cAccent[0] * elum * 285));
              dE[i + 1] = Math.min(255, Math.round(cAccent[1] * elum * 285));
              dE[i + 2] = Math.min(255, Math.round(cAccent[2] * elum * 285));
            }
          }
        }
        ctxE.putImageData(imgE, 0, 0);
        texE = new THREE.CanvasTexture(cEmi);
        texE.flipY = Boolean(baseMaps.emissive.flipY);
        texE.colorSpace = THREE.SRGBColorSpace;
        texE.minFilter = THREE.LinearMipmapLinearFilter;
        texE.magFilter = THREE.LinearFilter;
        texE.generateMipmaps = true;
      }
    }

    const entry = { albedo: texA, emissive: texE, sharedBase: false };
    _skinAtlasCache.set(skin.id, entry);
    return entry;
  } catch {
    return { albedo: baseMaps.albedo, emissive: baseMaps.emissive || null, sharedBase: true };
  }
}

export class GatewayRig {
  static preload() {
    return loadSharedGatewayGlb();
  }

  /**
   * @param {string | { skinId?: string }} [skinId='sea_glass_guardian']
   */
  constructor(skinId = 'sea_glass_guardian') {
    const initSkinId =
      typeof skinId === 'object' && skinId !== null ? skinId.skinId || 'sea_glass_guardian' : skinId;

    this.group = new THREE.Group();
    this.group.name = 'GatewayRig';

    this._disposed = false;
    this._glbApplied = false;
    this._ownedGeos = new Set();
    this._ownedMats = new Set();
    this._baseGlbMaps = null;

    this.currentSkinId = null;
    this.currentEra = 'reboot';
    this._activeSkin = GATEWAY_SKINS[0];

    // Zero-allocation scratch math objects for 60fps mobile animation polish
    this._qScratchA = new THREE.Quaternion();
    this._qScratchB = new THREE.Quaternion();
    this._eScratch = new THREE.Euler(0, 0, 0, 'XYZ');
    this._scratchColor = new THREE.Color();

    this._lastPoseState = { time: 0, vx: 0, vy: 0, facing: 1, onGround: true };
    this._internalTime = 0;
    this._stridePhase = 0;
    this._yaw = 0.38;
    this._prevYaw = 0.38;
    this._bankRoll = 0;
    this._stairOffset = 0;
    this._pelvisBindY = 0.53;
    this._headLookYaw = 0;
    this._headLookPitch = 0;
    this._frillFlare = 0;
    this._castBlend = 0;
    this._recoil = 0;
    this._landTimer = 0;
    this._landSquash = 0;
    this._landSquashVel = 0;
    this._skidBlend = 0;
    this._skidDir = 1;
    this._stairBobSmooth = 0;
    this._whipHoldTimer = 0;
    this._wasOnGround = true;
    this._lastVy = 0;
    this._prevVx = 0;

    // 7-Bone 2nd-order spring-damped dynamic lizard tail state
    this._tailYawVel = 0;
    this._tailYawLag = 0;
    this._tailPitchVel = 0;
    this._tailPitchLag = 0;

    this.bones = {};
    this.skinnedMesh = null;
    this.skeleton = null;
    this.mixer = null;
    this.actions = {};
    this.animations = [];
    this._activeClipName = null;

    this._initMaterials();
    this._buildInstantSkinnedStandIn();

    this.setSkin(initSkinId);
    this.update(0.016, this._lastPoseState);

    this.readyPromise = loadSharedGatewayGlb().then((glbData) => {
      if (glbData && !this._disposed && !this._glbApplied) {
        this._applyGatewayGlb(glbData);
      }
      return this;
    });
  }

  _trackGeo(geo) {
    this._ownedGeos.add(geo);
    return geo;
  }

  _trackMat(mat) {
    this._ownedMats.add(mat);
    return mat;
  }

  _initMaterials() {
    this.mainMat = this._trackMat(
      new THREE.MeshStandardMaterial({
        name: 'mat_gateway_live',
        color: '#ffffff',
        roughness: 0.38,
        metalness: 0.08,
        emissive: '#ffffff',
        emissiveIntensity: 0.92,
      })
    );
    this.accentMat = this._trackMat(
      new THREE.MeshStandardMaterial({
        color: '#5efce8',
        emissive: '#38bdf8',
        emissiveIntensity: 1.45,
        roughness: 0.12,
        metalness: 0.18,
      })
    );
    this.flashMat = this._trackMat(
      new THREE.MeshBasicMaterial({
        color: '#67e8f9',
        transparent: true,
        opacity: 0.62,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    // Legacy compatibility map if external code inspects `rig.mats`
    this.mats = {
      skin: this.mainMat,
      accentGlow: this.accentMat,
      muzzleFlash: this.flashMat,
    };
  }

  /**
   * Builds a lightweight, real 39-bone `THREE.SkinnedMesh` + 18 procedural clips for instant
   * Frame-0 rendering & headless Node tests before `gateway.glb` finishes loading.
   */
  _buildInstantSkinnedStandIn() {
    const standInGroup = new THREE.Group();
    standInGroup.name = 'GatewayStandInRoot';
    this.group.add(standInGroup);
    this._standInGroup = standInGroup;

    const boneList = [];
    const boneByName = {};
    for (let i = 0; i < STANDIN_BONE_SPECS.length; i++) {
      const [bname, pname, pos] = STANDIN_BONE_SPECS[i];
      const bone = new THREE.Bone();
      bone.name = bname;
      bone.position.set(pos[0], pos[1], pos[2]);
      if (pname && boneByName[pname]) {
        boneByName[pname].add(bone);
      }
      boneList.push(bone);
      boneByName[bname] = bone;
    }
    standInGroup.add(boneByName.Root);
    standInGroup.updateMatrixWorld(true);

    // Sculpted continuous tube-lofted stand-in SkinnedMesh along Spine + Tail (`y = 0..1.18u`, `z = -1.04..0.16u`)
    const curvePts = [
      new THREE.Vector3(0, 0.47, -1.04),
      new THREE.Vector3(0, 0.39, -0.65),
      new THREE.Vector3(0, 0.48, -0.22),
      new THREE.Vector3(0, 0.54, -0.01),
      new THREE.Vector3(0, 0.72, 0.01),
      new THREE.Vector3(0, 0.92, 0.015),
      new THREE.Vector3(0, 1.08, 0.05),
      new THREE.Vector3(0, 1.18, 0.02),
    ];
    const bodyCurve = new THREE.CatmullRomCurve3(curvePts);
    const geo = this._trackGeo(new THREE.TubeGeometry(bodyCurve, 32, 0.068, 12, false));
    const posAttr = geo.attributes.position;
    const vCount = posAttr.count;
    const skinIndices = new Uint16Array(vCount * 4);
    const skinWeights = new Float32Array(vCount * 4);

    // Compute world bone positions for clean weight binding
    const boneWorldPts = boneList.map((b) => {
      const v = new THREE.Vector3();
      b.getWorldPosition(v);
      return v;
    });
    const tmpP = new THREE.Vector3();

    for (let i = 0; i < vCount; i++) {
      tmpP.fromBufferAttribute(posAttr, i);
      // Taper tail tip & waist organically
      if (tmpP.z < -0.15) {
        const tf = Math.max(0.15, 1.0 - (-tmpP.z - 0.15) / 0.95);
        tmpP.x *= tf;
        tmpP.y = 0.43 + (tmpP.y - 0.43) * tf;
        posAttr.setXYZ(i, tmpP.x, tmpP.y, tmpP.z);
      }
      let b0 = 1;
      let b1 = 2;
      let d0 = Infinity;
      let d1 = Infinity;
      for (let bi = 1; bi < boneWorldPts.length; bi++) {
        const d = tmpP.distanceToSquared(boneWorldPts[bi]);
        if (d < d0) {
          d1 = d0;
          b1 = b0;
          d0 = d;
          b0 = bi;
        } else if (d < d1) {
          d1 = d;
          b1 = bi;
        }
      }
      const w0 = 1 / (Math.sqrt(d0) + 0.02);
      const w1 = 1 / (Math.sqrt(d1) + 0.02);
      const sum = w0 + w1;
      skinIndices[i * 4] = b0;
      skinIndices[i * 4 + 1] = b1;
      skinWeights[i * 4] = w0 / sum;
      skinWeights[i * 4 + 1] = w1 / sum;
    }
    geo.computeVertexNormals();
    geo.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(skinIndices, 4));
    geo.setAttribute('skinWeight', new THREE.Float32BufferAttribute(skinWeights, 4));

    const skel = new THREE.Skeleton(boneList);
    const sMesh = new THREE.SkinnedMesh(geo, this.mainMat);
    sMesh.name = 'GatewayStandInSkinnedMesh';
    sMesh.castShadow = true;
    sMesh.receiveShadow = true;
    sMesh.frustumCulled = false;
    standInGroup.add(sMesh);
    sMesh.bind(skel);

    this.skinnedMesh = sMesh;
    this.skeleton = skel;
    this._wireBoneAliasesAndAttachments(boneByName);
    this._initFallbackClipsAndMixer(standInGroup);
  }

  _initFallbackClipsAndMixer(mixerRoot) {
    this.mixer = new THREE.AnimationMixer(mixerRoot);
    this.actions = {};
    this.animations = [];

    for (let i = 0; i < GATEWAY_CLIP_NAMES.length; i++) {
      const cname = GATEWAY_CLIP_NAMES[i];
      const q0 = new THREE.Quaternion();
      const q1 = new THREE.Quaternion().setFromEuler(
        new THREE.Euler(cname === 'FluidRun' ? 0.18 : 0.03, 0, 0)
      );
      const track = new THREE.QuaternionKeyframeTrack(
        'Pelvis.quaternion',
        [0, 0.5, 1.0],
        [q0.x, q0.y, q0.z, q0.w, q1.x, q1.y, q1.z, q1.w, q0.x, q0.y, q0.z, q0.w]
      );
      const clip = new THREE.AnimationClip(cname, 1.0, [track]);
      this.animations.push(clip);
      const act = this.mixer.clipAction(clip);
      if (ONE_SHOT_CLIPS.has(cname)) {
        act.setLoop(THREE.LoopOnce, 1);
        act.clampWhenFinished = true;
      }
      this.actions[cname] = act;
    }
    this._activeClipName = 'IdleBreathe';
    this.actions.IdleBreathe.play();
  }

  _wireBoneAliasesAndAttachments(boneLookup) {
    this.bones = {};
    for (const [bname, bObj] of Object.entries(boneLookup)) {
      this.bones[bname] = bObj;
    }
    for (let i = 0; i < BONE_ALIAS_PAIRS.length; i++) {
      const [alias, canonical] = BONE_ALIAS_PAIRS[i];
      if (boneLookup[canonical]) {
        this.bones[alias] = boneLookup[canonical];
      }
    }

    // Attach Hydro-Caster Palm Emitter (`muzzle` + `muzzleLight`) & Sovereign Starlight Droplets!
    if (!this._hydroEmitterGroup) {
      this._hydroEmitterGroup = new THREE.Group();
      this._hydroEmitterGroup.name = 'GatewayHydroCasterEmitter';

      const muzzle = new THREE.Group();
      const flashRing = new THREE.Mesh(
        this._trackGeo(new THREE.TorusGeometry(0.034, 0.006, 8, 20)),
        this.flashMat
      );
      const flashCore = new THREE.Mesh(
        this._trackGeo(new THREE.SphereGeometry(0.020, 12, 10)),
        this.accentMat
      );
      muzzle.add(flashRing, flashCore);
      muzzle.visible = false;
      this._muzzleNode = muzzle;

      const muzzleLight = new THREE.PointLight('#5efce8', 0, 5.2, 1.8);
      muzzleLight.position.set(0, 0.02, 0.12);
      this._muzzleLight = muzzleLight;

      this._hydroEmitterGroup.position.set(0, -0.05, 0.045);
      this._hydroEmitterGroup.add(muzzle, muzzleLight);

      // Compatibility dummy groups (`blaster`, `backpack`, `harness`) so legacy renderers never throw
      this._compatBlasterDummy = new THREE.Group();
      this._compatBackpackDummy = new THREE.Group();
      this._compatHarnessDummy = new THREE.Group();

      // Sovereign Starlight orbiting water-starlight motes
      this._starMotesGroup = new THREE.Group();
      this._starMotes = [];
      const moteGeo = this._trackGeo(new THREE.OctahedronGeometry(0.022, 0));
      for (let i = 0; i < 6; i++) {
        const m = new THREE.Mesh(moteGeo, this.accentMat);
        this._starMotesGroup.add(m);
        this._starMotes.push(m);
      }
      this._starMotesGroup.visible = false;
    }

    const handR = this.bones.HandR;
    if (handR) {
      handR.add(this._hydroEmitterGroup, this._compatBlasterDummy);
    }
    const chest = this.bones.Chest;
    if (chest) {
      chest.add(this._compatBackpackDummy, this._compatHarnessDummy, this._starMotesGroup);
    }

    this.bones.hydroCaster = this._hydroEmitterGroup;
    this.bones.blaster = this._compatBlasterDummy;
    this.bones.backpack = this._compatBackpackDummy;
    this.bones.harness = this._compatHarnessDummy;
    this.bones.waterSeedCore = chest || this.group;
    this.bones.muzzle = this._muzzleNode;
    this.bones.muzzleLight = this._muzzleLight;
  }

  /**
   * Upgrades this `GatewayRig` instance to the full sculpted Blender `gateway.glb`
   * `SkinnedMesh` + 39-bone `Armature` + 1K PBR Maps + 18 Baked NLA Skeletal Clips!
   */
  _applyGatewayGlb(glbData) {
    const clonedScene = cloneSkinnedHierarchy(glbData.scene);
    clonedScene.name = 'GatewayGlbScene';

    let foundSkinned = null;
    const allSkinned = [];
    const boneByName = {};

    clonedScene.traverse((obj) => {
      if (obj.isBone && obj.name) {
        boneByName[obj.name] = obj;
      }
      if (obj.isSkinnedMesh) {
        allSkinned.push(obj);
        if (!foundSkinned) foundSkinned = obj;
        obj.material = this.mainMat;
        obj.castShadow = true;
        obj.receiveShadow = true;
        obj.frustumCulled = false;
      }
    });

    if (!foundSkinned || !foundSkinned.skeleton || foundSkinned.skeleton.bones.length < 30) {
      return;
    }

    // Cleanly retire Frame-0 stand-in
    if (this._standInGroup) {
      this._standInGroup.visible = false;
      this.group.remove(this._standInGroup);
    }
    if (this.mixer) {
      this.mixer.stopAllAction();
    }

    // Ensure `Root` wrapper rotates inside `this.group` identically to stand-in
    const rigMotionRoot = new THREE.Group();
    rigMotionRoot.name = 'GatewayMotionRoot';
    rigMotionRoot.add(clonedScene);
    this.group.add(rigMotionRoot);
    this._motionRoot = rigMotionRoot;

    this.skinnedMesh = foundSkinned;
    this._allSkinnedMeshes = allSkinned;
    this.skeleton = foundSkinned.skeleton;
    this._baseGlbMaps = glbData.baseMaps || null;

    if (!boneByName.Root) {
      boneByName.Root = rigMotionRoot;
    }
    this._wireBoneAliasesAndAttachments(boneByName);
    this.bones.root = rigMotionRoot;
    this.bones.Root = boneByName.Root || rigMotionRoot;
    if (boneByName.Pelvis) {
      this._pelvisBindY = boneByName.Pelvis.position.y;
    }
    clonedScene.position.set(0, 0, 0);

    // Bind all 18 baked Blender NLA clips into `THREE.AnimationMixer`
    this.mixer = new THREE.AnimationMixer(clonedScene);
    this.actions = {};
    this.animations = glbData.animations;

    for (let i = 0; i < glbData.animations.length; i++) {
      const clip = glbData.animations[i];
      const act = this.mixer.clipAction(clip);
      if (ONE_SHOT_CLIPS.has(clip.name)) {
        act.setLoop(THREE.LoopOnce, 1);
        act.clampWhenFinished = true;
      } else {
        act.setLoop(THREE.LoopRepeat, Infinity);
      }
      this.actions[clip.name] = act;
    }

    const startClip = this._activeClipName && this.actions[this._activeClipName] ? this._activeClipName : 'IdleBreathe';
    this._activeClipName = startClip;
    if (this.actions[startClip]) {
      this.actions[startClip].reset().play();
    }

    this._glbApplied = true;
    this._refreshMaterials();
    this.update(0.016, this._lastPoseState);
  }

  setSkin(skinId) {
    const skin = SKIN_MAP.get(skinId) || GATEWAY_SKINS[0];
    if (this.currentSkinId === skin.id && this._glbApplied) return;
    this.currentSkinId = skin.id;
    this._activeSkin = skin;
    this._refreshMaterials();
  }

  setEraStyle(_era) {
    // 100% AAA presentation (harmless compatibility method)
    this.currentEra = 'reboot';
  }

  _refreshMaterials() {
    const skin = this._activeSkin || GATEWAY_SKINS[0];
    const metalBase = typeof skin.metallic === 'number' ? skin.metallic : 0.08;

    this.accentMat.color.set(skin.accentColor);
    this.accentMat.emissive.set(skin.accentColor);
    if (this._muzzleLight) {
      this._muzzleLight.color.set(skin.accentColor);
    }

    if (this._baseGlbMaps && this._baseGlbMaps.albedo) {
      const skinMaps = getOrBuildSkinAtlasMaps(skin, this._baseGlbMaps);
      this.mainMat.map = skinMaps ? skinMaps.albedo : this._baseGlbMaps.albedo;
      this.mainMat.color.set('#ffffff');
      this.mainMat.normalMap = this._baseGlbMaps.normal || null;
      this.mainMat.normalScale.set(1.18, 1.18);
      this.mainMat.roughnessMap = this._baseGlbMaps.roughness || null;
      this.mainMat.metalnessMap = this._baseGlbMaps.metalness || null;
      this.mainMat.roughness = this._baseGlbMaps.roughness ? 1.0 : 0.38;
      this.mainMat.metalness = this._baseGlbMaps.metalness ? Math.max(0.85, metalBase) : metalBase;
      this.mainMat.emissiveMap = skinMaps ? skinMaps.emissive : this._baseGlbMaps.emissive || null;
      this.mainMat.emissive.set('#ffffff');
      this.mainMat.emissiveIntensity = 0.95;
    } else {
      this.mainMat.map = null;
      this.mainMat.color.set(skin.bodyColor);
      this.mainMat.emissive.set(skin.accentColor);
      this.mainMat.emissiveIntensity = 0.12;
      this.mainMat.roughness = 0.38;
      this.mainMat.metalness = metalBase;
    }
    this.mainMat.needsUpdate = true;

    if (this._starMotesGroup) {
      this._starMotesGroup.visible = skin.id === 'sovereign_starlight';
    }
  }

  /**
   * Cross-fades smoothly (`0.10s–0.18s`) to a named skeletal clip on `this.mixer`.
   */
  playAction(rawName, fadeDuration = 0.14, timeScale = 1.0) {
    if (!this.mixer || !rawName) return;
    const key = String(rawName).toLowerCase().replace(/[^a-z0-9_]/g, '');
    const resolved = this.actions[rawName] ? rawName : CLIP_ALIASES[key] || 'IdleBreathe';
    const nextAct = this.actions[resolved];
    if (!nextAct) return;

    nextAct.timeScale = timeScale;
    if (this._activeClipName === resolved) {
      if (ONE_SHOT_CLIPS.has(resolved) && !nextAct.isRunning()) {
        nextAct.reset().play();
      }
      return;
    }

    const prevAct = this._activeClipName ? this.actions[this._activeClipName] : null;
    nextAct.enabled = true;
    nextAct.setEffectiveWeight(1);
    nextAct.reset().play();
    if (prevAct && prevAct !== nextAct) {
      prevAct.crossFadeTo(nextAct, fadeDuration, false);
    }
    this._activeClipName = resolved;
  }

  triggerTailWhip() {
    this._whipHoldTimer = 0.55;
    if (this.actions.TailWhip) {
      this._activeClipName = null;
      this.playAction('TailWhip', 0.08, 1.25);
    }
  }

  triggerHydroCast() {
    this._castBlend = 1.0;
    this._recoil = 1.0;
  }

  _addBoneLocalEuler(bone, rx, ry, rz) {
    if (!bone) return;
    this._eScratch.set(rx, ry, rz, 'XYZ');
    this._qScratchA.setFromEuler(this._eScratch);
    bone.quaternion.multiply(this._qScratchA);
  }

  /**
   * Updates `THREE.AnimationMixer` + zero-allocation procedural bone polish!
   * Supports BOTH `update(dt, playerState, opts)` AND `update(playerState, dt, opts)`.
   */
  update(arg1, arg2, arg3) {
    let rawDt;
    let ps;
    let opts;
    if (typeof arg1 === 'object' && arg1 !== null) {
      ps = arg1;
      rawDt = typeof arg2 === 'number' ? arg2 : 0.016;
      opts = arg3 || null;
    } else {
      rawDt = typeof arg1 === 'number' ? arg1 : 0.016;
      ps = typeof arg2 === 'object' && arg2 !== null ? arg2 : this._lastPoseState;
      opts = arg3 || null;
    }
    this._lastPoseState = ps;

    const safeDt = Number.isFinite(rawDt) ? Math.min(Math.max(rawDt, 0.0005), 0.1) : 0.016;
    this._internalTime += safeDt;

    if (ps.skinId) this.setSkin(ps.skinId);

    const time = Number.isFinite(ps.time) ? ps.time : this._internalTime;
    const vx = Number(ps.vx) || 0;
    const vy = Number(ps.vy) || 0;
    const dir = (ps.facing != null ? Number(ps.facing) : 1) < 0 ? -1 : 1;
    const onGround = ps.onGround !== undefined ? Boolean(ps.onGround) : true;
    const doorBlend = THREE.MathUtils.clamp(Number(ps.enteringDoor) || 0, 0, 1);
    const invuln = Math.max(0, Number(ps.invuln) || 0);
    const hurtTimer = Math.max(0, Number(ps.hurtTimer) || 0);
    const muzzleFlash = Math.max(0, Number(ps.muzzleFlash || ps.castTimer || ps.hydroCast) || 0);
    const whipTimer = Math.max(0, Number(ps.tailWhipTimer || ps.whipTimer || ps.tailWhip) || 0);
    const victory = Boolean(ps.victory || ps.celebrate);
    const onStairs = Boolean(ps.onStairs || Math.abs(Number(ps.stairSlope || ps.stairDir) || 0) > 0.01);
    const stairSlope = Number(ps.stairSlope ?? ps.stairDir) || 0;
    const wallScamper = Boolean(ps.wallScamper || ps.climbing);
    const isSwimming = Boolean(ps.isSwimming || ps.swimming || ps.inWater);
    const isSurfing = Boolean(ps.surfing || ps.rapidsSurf);
    const isGliding = Boolean(ps.gliding || ps.frillGlide);
    const isCoreDive = Boolean(ps.coreDive || ps.diving);
    const isMantling = Boolean(ps.mantling || Number(ps.mantleTimer) > 0);
    const isCutscene = Boolean(ps.cutscene || ps.cutscenePose);

    const speed = Math.abs(vx);
    const speedNorm = THREE.MathUtils.clamp(speed / 4.8, 0, 1);

    // Physical weight telemetry from 120Hz physics (`@physics_puzzles_lead`) + fallback inference
    const extLandSquash = THREE.MathUtils.clamp(
      Number(ps.landSquash ?? ps.landImpact) || 0,
      0,
      1.35
    );
    const extSkidTimer = Math.max(0, Number(ps.skidTimer) || 0);
    const hasExtStairBob = ps.stairStepBob !== undefined && ps.stairStepBob !== null;
    const extStairBob = Number(ps.stairStepBob) || 0;

    // Detect heavy landing impact transitions (for impact crouch, knee bend, frill & tail whip!)
    if (!this._wasOnGround && onGround && this._lastVy < -1.5) {
      const impactMag = THREE.MathUtils.clamp((-this._lastVy - 1.2) / 11.5, 0.28, 1.0);
      this._landTimer = 0.22 + impactMag * 0.10;
      this._landSquash = Math.max(this._landSquash, impactMag);
      this._landSquashVel = Math.max(this._landSquashVel, impactMag * 4.5);
      // Heavy downward inertia whip impulse into 7-bone tail spring
      this._tailPitchVel -= impactMag * 12.5;
    }
    if (extLandSquash > this._landSquash) {
      const deltaImp = extLandSquash - this._landSquash;
      this._landSquash = extLandSquash;
      this._tailPitchVel -= deltaImp * 9.5;
    }
    this._wasOnGround = onGround;
    this._lastVy = vy;
    if (this._landTimer > 0) this._landTimer = Math.max(0, this._landTimer - safeDt);
    if (this._whipHoldTimer > 0) this._whipHoldTimer = Math.max(0, this._whipHoldTimer - safeDt);

    // 2nd-order damped spring recovery on landing impact compression (`_landSquash`)
    const squashTarget = onGround ? extLandSquash * 0.85 : 0;
    const sqAccel = (squashTarget - this._landSquash) * 125.0 - this._landSquashVel * 14.5;
    this._landSquashVel += sqAccel * safeDt;
    this._landSquash = THREE.MathUtils.clamp(
      this._landSquash + this._landSquashVel * safeDt,
      -0.14,
      1.15
    );
    const landComp = Math.max(0, this._landSquash);

    // Turn-around counter-steer skid detection (`skidTimer` OR high-speed reversal!)
    const autoSkid = onGround && !onStairs && speed > 1.25 && vx * dir < -0.35;
    const isSkidding = onGround && (extSkidTimer > 0.015 || autoSkid);
    if (isSkidding) {
      this._skidDir = vx !== 0 ? (vx > 0 ? 1 : -1) : -dir;
    }
    const targetSkid = isSkidding
      ? THREE.MathUtils.clamp(Math.max(extSkidTimer * 5.2, autoSkid ? speedNorm : 0), 0.35, 1.0)
      : 0;
    this._skidBlend = damp(this._skidBlend, targetSkid, isSkidding ? 22 : 12, safeDt);
    this._prevVx = vx;

    // 1. Select & Cross-Fade Skeletal Animation Clip (`0.10s–0.18s`)
    const explicitClip = opts?.clip || ps.clip || ps.anim;
    let wantClip = 'IdleBreathe';
    let fadeDur = 0.14;
    let timeScale = 1.0;

    if (explicitClip && typeof explicitClip === 'string') {
      wantClip = explicitClip;
      fadeDur = 0.12;
      if (wantClip.toLowerCase().includes('run') || wantClip.toLowerCase().includes('walk')) {
        timeScale = THREE.MathUtils.clamp(0.8 + speed * 0.22, 0.75, 1.65);
      }
    } else if (victory) {
      wantClip = 'Celebrate';
      fadeDur = 0.16;
    } else if (isCutscene) {
      wantClip = 'CutsceneHero';
      fadeDur = 0.18;
    } else if (isCoreDive) {
      wantClip = 'CoreDive';
      fadeDur = 0.14;
    } else if (isSwimming) {
      wantClip = 'FreeSwim';
      fadeDur = 0.16;
      timeScale = THREE.MathUtils.clamp(0.85 + Math.hypot(vx, vy) * 0.18, 0.8, 1.65);
    } else if (isSurfing) {
      wantClip = 'RapidsSurf';
      fadeDur = 0.14;
    } else if (whipTimer > 0.01 || this._whipHoldTimer > 0.01) {
      wantClip = 'TailWhip';
      fadeDur = 0.08;
      timeScale = 1.35;
    } else if (wallScamper) {
      wantClip = 'WallScamper';
      fadeDur = 0.12;
      timeScale = THREE.MathUtils.clamp(0.65 + Math.hypot(vx, vy) * 0.32, 0.45, 1.65);
    } else if (isMantling) {
      wantClip = 'LedgeMantle';
      fadeDur = 0.10;
    } else if (isGliding) {
      wantClip = 'FrillGlide';
      fadeDur = 0.14;
    } else if (!onGround) {
      if (vy > 1.6) {
        wantClip = 'AirRise';
        fadeDur = 0.10;
      } else if (vy < -1.8) {
        wantClip = 'Fall';
        fadeDur = 0.14;
      } else {
        wantClip = speed > 1.8 ? 'FrillGlide' : 'AirRise';
        fadeDur = 0.14;
      }
    } else if (this._landTimer > 0.02 && speed < 1.2) {
      wantClip = 'Land';
      fadeDur = 0.08;
    } else if (muzzleFlash > 0.02 && speed < 0.35) {
      wantClip = 'HydroCast';
      fadeDur = 0.09;
      timeScale = 1.25;
    } else if (onStairs && speed > 0.15) {
      wantClip = 'StairClimb';
      fadeDur = 0.12;
      timeScale = THREE.MathUtils.clamp(0.85 + speed * 0.24, 0.8, 1.6);
    } else if (speed > 1.55 || doorBlend > 0.05) {
      wantClip = 'FluidRun';
      fadeDur = 0.12;
      timeScale = THREE.MathUtils.clamp(0.82 + Math.max(speed, doorBlend * 3.0) * 0.20, 0.8, 1.65);
    } else if (speed > 0.12) {
      wantClip = 'Walk';
      fadeDur = 0.14;
      timeScale = THREE.MathUtils.clamp(0.85 + speed * 0.42, 0.75, 1.45);
    }

    this.playAction(wantClip, fadeDur, timeScale);
    if (this.mixer) {
      this.mixer.update(safeDt);
    }

    // Keep shadow casting locked on for Gateway's SkinnedMesh (1 shadow draw call!)
    if (this.skinnedMesh) {
      this.skinnedMesh.castShadow = true;
      this.skinnedMesh.receiveShadow = true;
    }

    // 2. Motion Root Heading Yaw, Door Entry & Squash/Stretch
    if ((onGround && speed > 0.12) || doorBlend > 0.05) {
      this._stridePhase += safeDt * (5.2 + Math.max(speed, doorBlend * 3.0) * 2.1);
    }

    let targetYaw = dir * (0.42 + speedNorm * 0.74);
    if (wallScamper) {
      targetYaw = Math.PI + dir * 0.12; // Face spire wall during gecko crystal climb!
    } else if (isSwimming || isSurfing || isCoreDive) {
      targetYaw = ps.yawOverride != null ? Number(ps.yawOverride) : 0;
    } else if (victory || isCutscene) {
      targetYaw = Math.sin(time * 2.2) * 0.24;
    } else if (doorBlend > 0.001) {
      const doorYaw = dir >= 0 ? Math.PI : -Math.PI;
      targetYaw = THREE.MathUtils.lerp(targetYaw, doorYaw, Math.min(1, doorBlend * 1.35));
    }

    this._prevYaw = this._yaw;
    this._yaw = dampAngle(this._yaw, targetYaw, 15, safeDt);
    let yawVel = (this._yaw - this._prevYaw) / safeDt;
    yawVel = THREE.MathUtils.clamp(yawVel, -14, 14);

    const motionRoot = this._motionRoot || this._standInGroup;
    if (motionRoot) {
      motionRoot.rotation.set(0, this._yaw, 0);
      // Combine caller squash/stretch with physical landing impact compression
      const baseSx = THREE.MathUtils.clamp(Number(ps.squashX) || 1, 0.86, 1.16);
      const baseSy = THREE.MathUtils.clamp(Number(ps.squashY) || 1, 0.84, 1.16);
      const sx = THREE.MathUtils.clamp(baseSx * (1 + landComp * 0.085), 0.84, 1.22);
      const sy = THREE.MathUtils.clamp(baseSy * (1 - landComp * 0.095), 0.78, 1.20);
      motionRoot.scale.set(sx, sy, sx);
      // EXACT y = 0.000 feet grounding — ZERO upward hover offset!
      motionRoot.position.set(0, 0, -doorBlend * 0.34);
    }

    // Invulnerability bioluminescent pulse shimmer
    if (invuln > 0) {
      const pulse = 0.5 + 0.5 * Math.sin(time * 30);
      this.mainMat.emissiveIntensity = 0.95 + pulse * 0.85;
    } else if (this.mainMat.emissiveIntensity > 1.0) {
      this.mainMat.emissiveIntensity = 0.95;
    }

    // 3. Additive Spine Turn-Banking, Skid Lean, Landing Impact Compression & Hurt Flinch
    const b = this.bones;
    const surfBank = Number(ps.surfBank) || 0;
    const skidLean = this._skidBlend * this._skidDir;
    const targetBank = THREE.MathUtils.clamp(
      -yawVel * 0.022 + surfBank * 0.38 + skidLean * 0.34,
      -0.46,
      0.46
    );
    this._bankRoll = damp(this._bankRoll, targetBank, 14, safeDt);
    const hurtPitch = hurtTimer > 0 ? -0.35 * Math.min(1, hurtTimer / 0.25) : 0;
    const fallPitch = !onGround && vy < -2.2 ? THREE.MathUtils.clamp((-vy - 2.2) * 0.022, 0, 0.26) : 0;
    const landTorsoPitch = landComp * 0.28;
    const skidTorsoPitch = this._skidBlend * 0.16;
    const totalTorsoPitch = hurtPitch + landTorsoPitch + skidTorsoPitch + fallPitch;

    this._addBoneLocalEuler(b.Spine1, totalTorsoPitch * 0.42, skidLean * 0.14, this._bankRoll * 0.38);
    this._addBoneLocalEuler(b.Spine2, totalTorsoPitch * 0.32, skidLean * 0.12, this._bankRoll * 0.34);
    this._addBoneLocalEuler(b.Chest, totalTorsoPitch * 0.26, skidLean * 0.10, this._bankRoll * 0.28);

    // 3b. Heavy Landing Compression (`landSquash`) + Skid Crouch Pelvis Drop & Deep Knee Bend!
    // Feet stay pinned at exact `y = 0.000` while hips absorb weight and knees flex deeply.
    const stairActive = onGround && onStairs && speed > 0.08 ? 1 : 0;
    const rawStairBob = stairActive
      ? hasExtStairBob
        ? THREE.MathUtils.clamp(extStairBob, -1.0, 1.0)
        : Math.sin(this._stridePhase * 1.15) * 0.5
      : 0;
    this._stairBobSmooth = damp(this._stairBobSmooth, rawStairBob, 24, safeDt);

    if (b.Pelvis) {
      const landPelvisDrop = -landComp * 0.135;
      const skidPelvisDrop = -this._skidBlend * 0.055;
      // Subtle pelvis compression on riser push-off (never floats root off stone!)
      const stairPelvisDelta = stairActive ? this._stairBobSmooth * 0.048 - 0.018 : 0;
      const pelvisDeltaY = landPelvisDrop + skidPelvisDrop + stairPelvisDelta;
      if (this._glbApplied) {
        b.Pelvis.position.y += pelvisDeltaY;
      } else {
        b.Pelvis.position.y = this._pelvisBindY + pelvisDeltaY;
      }
      if (stairActive) {
        // Weight shift roll onto planted foot per 30cm stone riser!
        const weightShift = Math.sin(this._stridePhase) * 0.095;
        this._addBoneLocalEuler(b.Pelvis, 0.05 * (stairSlope >= 0 ? 1 : -0.6), 0, weightShift);
      }
    }

    if (landComp > 0.015) {
      // Deep athletic knee & hip bend with flat dorsiflexed soles on stone!
      this._addBoneLocalEuler(b.ThighL, -0.58 * landComp, 0, -0.08 * landComp);
      this._addBoneLocalEuler(b.ThighR, -0.58 * landComp, 0, 0.08 * landComp);
      this._addBoneLocalEuler(b.ShinL, 0.96 * landComp, 0, 0);
      this._addBoneLocalEuler(b.ShinR, 0.96 * landComp, 0, 0);
      this._addBoneLocalEuler(b.AnkleL, -0.38 * landComp, 0, 0);
      this._addBoneLocalEuler(b.AnkleR, -0.38 * landComp, 0, 0);
      // Arms spread slightly for landing balance
      this._addBoneLocalEuler(b.UpperArmL, 0.18 * landComp, 0, 0.28 * landComp);
      this._addBoneLocalEuler(b.UpperArmR, 0.18 * landComp, 0, -0.28 * landComp);
    }

    if (this._skidBlend > 0.02) {
      // Turn-around braced leg plant (lead leg braces forward, rear leg bends behind!)
      const sb = this._skidBlend;
      const leadL = this._skidDir > 0;
      const leadThigh = leadL ? b.ThighL : b.ThighR;
      const leadShin = leadL ? b.ShinL : b.ShinR;
      const leadAnkle = leadL ? b.AnkleL : b.AnkleR;
      const trailThigh = leadL ? b.ThighR : b.ThighL;
      const trailShin = leadL ? b.ShinR : b.ShinL;
      this._addBoneLocalEuler(leadThigh, -0.44 * sb, 0, 0);
      this._addBoneLocalEuler(leadShin, -0.16 * sb, 0, 0);
      this._addBoneLocalEuler(leadAnkle, 0.28 * sb, 0, 0);
      this._addBoneLocalEuler(trailThigh, 0.34 * sb, 0, 0);
      this._addBoneLocalEuler(trailShin, 0.52 * sb, 0, 0);
      // Athletic arm counter-sweep during skid
      this._addBoneLocalEuler(b.UpperArmL, -0.26 * sb * this._skidDir, 0, 0.24 * sb);
      this._addBoneLocalEuler(b.UpperArmR, 0.26 * sb * this._skidDir, 0, -0.24 * sb);
    }

    // 4. Discrete 5-Riser Stair Stepping (`onStairs` / `stairStepBob` — 30cm stone treads!)
    if (stairActive > 0) {
      const ascending = stairSlope >= 0;
      const slopeSign = ascending ? 1 : -1;
      // Combine continuous stride cycle with physics `stairStepBob` pulse for crisp riser lift!
      const bobBoost = hasExtStairBob ? Math.abs(this._stairBobSmooth) * 0.55 : 0.35;
      const lCycle = Math.sin(this._stridePhase);
      const lLift = Math.max(0, lCycle) * (0.45 + bobBoost);
      const rLift = Math.max(0, -lCycle) * (0.45 + bobBoost);

      if (ascending) {
        // High unmistakable knee lift onto each 30cm stone riser + flat tread foot plant!
        this._addBoneLocalEuler(b.ThighL, -0.58 * lLift, 0, 0);
        this._addBoneLocalEuler(b.ShinL, 0.86 * lLift, 0, 0);
        this._addBoneLocalEuler(b.AnkleL, -0.24 * lLift + lCycle * 0.16, 0, 0);
        this._addBoneLocalEuler(b.FootL, -lCycle * 0.14, 0, 0);

        this._addBoneLocalEuler(b.ThighR, -0.58 * rLift, 0, 0);
        this._addBoneLocalEuler(b.ShinR, 0.86 * rLift, 0, 0);
        this._addBoneLocalEuler(b.AnkleR, -0.24 * rLift - lCycle * 0.16, 0, 0);
        this._addBoneLocalEuler(b.FootR, lCycle * 0.14, 0, 0);
      } else {
        // Controlled downhill knee-cushioning bend on each 30cm step descent
        this._addBoneLocalEuler(b.ThighL, -0.24 * lLift, 0, 0);
        this._addBoneLocalEuler(b.ShinL, 0.52 * (0.35 + lLift), 0, 0);
        this._addBoneLocalEuler(b.AnkleL, lCycle * 0.16 * slopeSign, 0, 0);
        this._addBoneLocalEuler(b.FootL, -lCycle * 0.14 * slopeSign, 0, 0);

        this._addBoneLocalEuler(b.ThighR, -0.24 * rLift, 0, 0);
        this._addBoneLocalEuler(b.ShinR, 0.52 * (0.35 + rLift), 0, 0);
        this._addBoneLocalEuler(b.AnkleR, -lCycle * 0.16 * slopeSign, 0, 0);
        this._addBoneLocalEuler(b.FootR, lCycle * 0.14 * slopeSign, 0, 0);
      }
    }

    // 5. Head & Soulful Eye Look-At + Natural Double-Blink Cycle
    let wantHeadYaw = 0;
    let wantHeadPitch = 0;
    if (ps.lookTarget && typeof ps.lookTarget === 'object') {
      wantHeadYaw = THREE.MathUtils.clamp(Number(ps.lookTarget.dTheta || ps.lookTarget.yaw) || 0, -0.52, 0.52);
      wantHeadPitch = THREE.MathUtils.clamp(Number(ps.lookTarget.dy || ps.lookTarget.pitch) || 0, -0.35, 0.35);
    } else if (onGround && speed < 0.2 && !victory) {
      wantHeadYaw = Math.sin(time * 1.15) * 0.12;
      wantHeadPitch = Math.cos(time * 1.65) * 0.04;
    }
    this._headLookYaw = damp(this._headLookYaw, wantHeadYaw, 10, safeDt);
    this._headLookPitch = damp(this._headLookPitch, wantHeadPitch, 10, safeDt);
    this._addBoneLocalEuler(b.Neck, this._headLookPitch * 0.35, this._headLookYaw * 0.35, 0);
    this._addBoneLocalEuler(b.Head, this._headLookPitch * 0.65, this._headLookYaw * 0.65, -this._bankRoll * 0.35);
    this._addBoneLocalEuler(b.EyeL, this._headLookPitch * 0.25, this._headLookYaw * 0.30, 0);
    this._addBoneLocalEuler(b.EyeR, this._headLookPitch * 0.25, this._headLookYaw * 0.30, 0);

    const blinkMod = time % 4.4;
    const isDouble = Math.floor(time / 4.4) % 3 === 1;
    let blink = 0;
    if (blinkMod < 0.12) blink = Math.sin((blinkMod / 0.12) * Math.PI);
    else if (isDouble && blinkMod > 0.20 && blinkMod < 0.31) blink = Math.sin(((blinkMod - 0.20) / 0.11) * Math.PI);
    if (hurtTimer > 0) blink = Math.max(blink, 0.65);
    if (blink > 0.01) {
      this._addBoneLocalEuler(b.EyelidL, blink * 0.72, 0, 0);
      this._addBoneLocalEuler(b.EyelidR, blink * 0.72, 0, 0);
    }

    // 6. Dynamic Aquatic Head-Frill Flare, Landing Whip & Aero-Flutter
    const extFlare = Number(ps.frillFlare) || 0;
    const targetFlare = Math.max(
      extFlare,
      isGliding
        ? 0.48
        : !onGround
          ? 0.28 + THREE.MathUtils.clamp(-vy * 0.025, 0, 0.28)
          : muzzleFlash > 0.01 || whipTimer > 0.01
            ? 0.38
            : this._skidBlend * 0.26
    );
    this._frillFlare = damp(this._frillFlare, targetFlare, 14, safeDt);
    // Landing impact whips head-frills sharply downward with inertia then rebounds!
    const frillLandDip = -landComp * 0.42;
    const flutter =
      (!onGround || isGliding ? Math.sin(time * 24) * 0.065 : 0) + this._frillFlare + frillLandDip;
    if (Math.abs(flutter) > 0.005) {
      this._addBoneLocalEuler(b.FrillL1, flutter * 0.55, 0, 0);
      this._addBoneLocalEuler(b.FrillL2, flutter * 0.78, 0, 0);
      this._addBoneLocalEuler(b.FrillR1, flutter * 0.55, 0, 0);
      this._addBoneLocalEuler(b.FrillR2, flutter * 0.78, 0, 0);
    }

    // 7. Upper-Body Run-And-Cast Additive Layer + Hydro-Caster Palm Flash
    const castingNow = muzzleFlash > 0.002;
    this._castBlend = damp(this._castBlend, castingNow ? 1 : 0, castingNow ? 32 : 11, safeDt);
    this._recoil = castingNow ? Math.min(1, muzzleFlash / 0.12) : damp(this._recoil, 0, 18, safeDt);

    if (this._castBlend > 0.01 && this._activeClipName !== 'HydroCast') {
      const cb = this._castBlend;
      this._addBoneLocalEuler(b.Chest, 0, 0.24 * cb, 0);
      this._addBoneLocalEuler(b.UpperArmR, (1.15 - this._recoil * 0.24) * cb, 0, 0.12 * cb);
      this._addBoneLocalEuler(b.ForearmR, (-0.32 + this._recoil * 0.18) * cb, 0, 0);
      this._addBoneLocalEuler(b.HandR, -0.45 * cb, 0, 0);
    }

    if (this._muzzleNode && this._muzzleLight) {
      if (castingNow) {
        this._muzzleNode.visible = true;
        this._muzzleNode.scale.setScalar(0.75 + this._recoil * 0.95);
        this._muzzleNode.rotation.z = time * 28;
        this._muzzleLight.intensity = 2.6 * this._recoil;
      } else {
        this._muzzleNode.visible = false;
        this._muzzleLight.intensity = 0;
      }
    }

    // 8. 2nd-Order Spring-Damped 7-Bone Dynamic Lizard Tail Physics (`Tail1`..`Tail7`)!
    const tailSpringK = 92.0;
    const tailDamp = 9.2;
    const yawImpulse = THREE.MathUtils.clamp(yawVel * 0.042 + skidLean * 0.34, -0.62, 0.62);
    const pitchImpulse = THREE.MathUtils.clamp(-vy * 0.036 - landComp * 0.52, -0.62, 0.52);

    this._tailYawVel += ((yawImpulse - this._tailYawLag) * tailSpringK - this._tailYawVel * tailDamp) * safeDt;
    this._tailYawLag = THREE.MathUtils.clamp(this._tailYawLag + this._tailYawVel * safeDt, -0.62, 0.62);

    this._tailPitchVel += ((pitchImpulse - this._tailPitchLag) * tailSpringK - this._tailPitchVel * tailDamp) * safeDt;
    this._tailPitchLag = THREE.MathUtils.clamp(this._tailPitchLag + this._tailPitchVel * safeDt, -0.58, 0.52);

    const swimExtra = Number(ps.swimPhase) || 0;
    for (let ti = 1; ti <= 7; ti++) {
      const tBone = b[`Tail${ti}`];
      if (!tBone) continue;
      const chainGain = 0.16 + ti * 0.055;
      const sWave =
        Math.sin(time * (4.2 + speedNorm * 4.5) - ti * 0.62 + swimExtra) *
        (0.035 + speedNorm * 0.055);
      const addRx = this._tailPitchLag * chainGain;
      const addRz = this._tailYawLag * chainGain + sWave;
      this._addBoneLocalEuler(tBone, addRx, 0, addRz);
    }

    // 9. Sovereign Starlight Prestige Orbiting Water-Starlight Droplets
    if (this._starMotesGroup && this._starMotesGroup.visible) {
      for (let i = 0; i < this._starMotes.length; i++) {
        const mote = this._starMotes[i];
        const a = time * 1.85 + (i * Math.PI * 2) / this._starMotes.length;
        const rad = 0.26 + Math.sin(time * 2.5 + i) * 0.04;
        mote.position.set(
          Math.cos(a) * rad,
          0.06 + Math.sin(time * 3.0 + i * 1.3) * 0.14,
          Math.sin(a) * rad
        );
        mote.rotation.set(time * 2.2 + i, time * 1.7, 0);
        mote.scale.setScalar(0.75 + Math.sin(time * 4.6 + i * 2) * 0.25);
      }
    }
  }

  dispose() {
    this._disposed = true;
    if (this.mixer) {
      this.mixer.stopAllAction();
    }
    for (const geo of this._ownedGeos) {
      geo.dispose();
    }
    this._ownedGeos.clear();
    for (const mat of this._ownedMats) {
      mat.dispose();
    }
    this._ownedMats.clear();
  }
}

export { GatewayRig as PogoRig };
