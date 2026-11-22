import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

/**
 * TOWERING WATERS: GATEWAY'S DESCENT — Gateway 2.0 Star Hero Rig & Skins (`src/gateway.js`)
 * =========================================================================================
 * Gateway 2.0 — Adorable, charismatic Pelagian sea-dragon/axolotl star adventurer:
 *   - Golden 1:2.63 mascot proportions (`1.000m` bind crown height, `min_y === 0.000m`,
 *     auto-normalized to exact `1.22m` world height when `group.scale` is default!)
 *   - True weight-painted `THREE.SkinnedMesh` + 50-bone `THREE.Skeleton` (`assets/models/gateway.glb`)
 *     preserving ALL 39 canonical bones + 11 new expressive appeal bones
 *     (`LowerLidL/R`, `BrowL/R`, `MouthSmile`, `FrillBotL/R`, `ScarfL1/L2`, `ScarfR1/R2`)
 *   - Silky Pixar-grade 1024x1024 WEBP PBR Atlas (Sea-Mint skin + Cream-Pearl belly + Coral-Sunset
 *     & Gold Sea-Silk Explorer Scarf + 6 Volumetric Coral-Petal Ear-Frills + Huge Glossy Jewel Eyes)
 *   - 22 Baked `THREE.AnimationMixer` Skeletal Clips (all 18 upgraded canonical clips +
 *     `IdleCurious`, `EdgeTeeter`, `SpringSomersault`, `WetShake`)
 *   - 6-Mood Live Facial Controller (`happy`, `curious`, `determined`, `joyful`, `surprised`, `hurt`),
 *     organic automatic blinking (`2.5–4.5s`), live eye-look/pointer gaze tracking, 2nd-order
 *     spring-damped secondary physics on 6 coral ear-frills, 4-bone flowing scarf & 7-bone tail,
 *     Title Screen interactive wave/hop behaviors, and `< 0.05mm` grounded 2-bone Analytic Foot-IK!
 */

export const DEFAULT_TARGET_HEIGHT = 1.22;
export const GATEWAY_BIND_HEIGHT = 1.00;

export const GATEWAY_MOODS = ['happy', 'curious', 'determined', 'joyful', 'surprised', 'hurt'];
const MOOD_SET = new Set(GATEWAY_MOODS);

export const GATEWAY_SKINS = [
  {
    id: 'sea_glass_guardian',
    name: 'Sea-Glass Guardian',
    bodyColor: '#20d8c8',
    bodyDeepColor: '#0d8a8e',
    bellyColor: '#fff6eb',
    crestColor: '#ff758f',
    scarfColor: '#ff5d75',
    scarfTrimColor: '#ffd166',
    vestColor: '#9e5d3d',
    harnessColor: '#9e5d3d',
    packColor: '#f0b949',
    eyeGlow: '#10b981',
    accentColor: '#72fff0',
    metallic: 0.06,
  },
  {
    id: 'coral_reef_empress',
    name: 'Coral Reef Empress',
    bodyColor: '#f05a7e',
    bodyDeepColor: '#962344',
    bellyColor: '#fff3ec',
    crestColor: '#22d3ee',
    scarfColor: '#14b8a6',
    scarfTrimColor: '#fde047',
    vestColor: '#b35c44',
    harnessColor: '#b35c44',
    packColor: '#f4be5e',
    eyeGlow: '#2dd4bf',
    accentColor: '#67e8f9',
    metallic: 0.08,
  },
  {
    id: 'canyon_rapids_ranger',
    name: 'Canyon Rapids Ranger',
    bodyColor: '#d97736',
    bodyDeepColor: '#7c3412',
    bellyColor: '#fdf2df',
    crestColor: '#22c58b',
    scarfColor: '#0f9d7a',
    scarfTrimColor: '#fde047',
    vestColor: '#7c4427',
    harnessColor: '#7c4427',
    packColor: '#e6a83a',
    eyeGlow: '#f59e0b',
    accentColor: '#5eead4',
    metallic: 0.12,
  },
  {
    id: 'alpine_glacier_mystic',
    name: 'Alpine Glacier Mystic',
    bodyColor: '#38a7ec',
    bodyDeepColor: '#16528a',
    bellyColor: '#f0f7ff',
    crestColor: '#f472b6',
    scarfColor: '#ec4899',
    scarfTrimColor: '#fbcfe8',
    vestColor: '#64748b',
    harnessColor: '#64748b',
    packColor: '#e8a590',
    eyeGlow: '#67e8f9',
    accentColor: '#93c5fd',
    metallic: 0.16,
  },
  {
    id: 'bayou_biolume',
    name: 'Bayou Biolume',
    bodyColor: '#1ea37c',
    bodyDeepColor: '#0b4f41',
    bellyColor: '#f5f0da',
    crestColor: '#a3e635',
    scarfColor: '#f59e0b',
    scarfTrimColor: '#fef08a',
    vestColor: '#6e4a2c',
    harnessColor: '#6e4a2c',
    packColor: '#d99030',
    eyeGlow: '#facc15',
    accentColor: '#bef264',
    metallic: 0.10,
  },
  {
    id: 'abyssal_leviathan',
    name: 'Abyssal Leviathan',
    bodyColor: '#3855b8',
    bodyDeepColor: '#18245c',
    bellyColor: '#dbe6f6',
    crestColor: '#a855f7',
    scarfColor: '#8b5cf6',
    scarfTrimColor: '#38bdf8',
    vestColor: '#3b486b',
    harnessColor: '#3b486b',
    packColor: '#94a3f8',
    eyeGlow: '#22d3ee',
    accentColor: '#22d3ee',
    metallic: 0.22,
  },
  {
    id: 'solar_oasis',
    name: 'Solar Oasis',
    bodyColor: '#eb9f26',
    bodyDeepColor: '#8f4d0c',
    bellyColor: '#fef6e0',
    crestColor: '#20d8c8',
    scarfColor: '#0ea5e9',
    scarfTrimColor: '#fef08a',
    vestColor: '#8b542b',
    harnessColor: '#8b542b',
    packColor: '#e6ae3c',
    eyeGlow: '#10b981',
    accentColor: '#5efce8',
    metallic: 0.24,
  },
  {
    id: 'sovereign_starlight',
    name: 'Sovereign Starlight',
    bodyColor: '#7ca2e8',
    bodyDeepColor: '#3e4d8f',
    bellyColor: '#f4f3ff',
    crestColor: '#c084fc',
    scarfColor: '#e879f9',
    scarfTrimColor: '#fde047',
    vestColor: '#6b6796',
    harnessColor: '#6b6796',
    packColor: '#f5c84c',
    eyeGlow: '#e879f9',
    accentColor: '#5efce8',
    metallic: 0.36,
    iridescentOpal: true,
  },
];

// Compatibility aliases
export const POGO_SKINS = GATEWAY_SKINS;
export const SKIN_CATALOG = GATEWAY_SKINS;

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
  'IdleCurious',
  'EdgeTeeter',
  'SpringSomersault',
  'WetShake',
];

const ONE_SHOT_CLIPS = new Set([
  'JumpCoil',
  'Land',
  'LedgeMantle',
  'TailWhip',
  'HydroCast',
  'SpringSomersault',
  'WetShake',
]);

const CLIP_ALIASES = {
  idle: 'IdleBreathe',
  idlebreathe: 'IdleBreathe',
  breathe: 'IdleBreathe',
  idlecurious: 'IdleCurious',
  curious: 'IdleCurious',
  wave: 'IdleCurious',
  titlewave: 'IdleCurious',
  titlemascot: 'IdleCurious',
  edgeteeter: 'EdgeTeeter',
  teeter: 'EdgeTeeter',
  ledge_teeter: 'EdgeTeeter',
  springsomersault: 'SpringSomersault',
  somersault: 'SpringSomersault',
  flip: 'SpringSomersault',
  wetshake: 'WetShake',
  shake: 'WetShake',
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
  skidstop: 'Land',
  mantle: 'LedgeMantle',
  ledgemantle: 'LedgeMantle',
  climb: 'WallScamper',
  scamper: 'WallScamper',
  wallscamper: 'WallScamper',
  wall_scamper: 'WallScamper',
  whip: 'TailWhip',
  tailwhip: 'TailWhip',
  tailwhipspin: 'TailWhip',
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
  herocelebrate: 'Celebrate',
  hero_celebrate: 'Celebrate',
  victory: 'Celebrate',
  cutscene: 'CutsceneHero',
  cutscenehero: 'CutsceneHero',
  hero: 'CutsceneHero',
};

// Exact 50-bone bind-pose specification matching `scripts/generate_gateway_v2.py` 1:1
// (All 39 canonical bones + 11 new expressive appeal bones at 1.000m mascot proportions!)
export const GATEWAY_CANONICAL_BONES = [
  'Root', 'Pelvis', 'Spine1', 'Spine2', 'Chest', 'Neck', 'Head',
  'Jaw', 'EyeL', 'EyeR', 'EyelidL', 'EyelidR',
  'FrillL1', 'FrillL2', 'FrillR1', 'FrillR2',
  'ClavicleL', 'UpperArmL', 'ForearmL', 'HandL',
  'ClavicleR', 'UpperArmR', 'ForearmR', 'HandR',
  'ThighL', 'ShinL', 'AnkleL', 'FootL',
  'ThighR', 'ShinR', 'AnkleR', 'FootR',
  'Tail1', 'Tail2', 'Tail3', 'Tail4', 'Tail5', 'Tail6', 'Tail7',
];

export const GATEWAY_V2_APPEAL_BONES = [
  'LowerLidL', 'LowerLidR', 'BrowL', 'BrowR', 'MouthSmile',
  'FrillBotL', 'FrillBotR',
  'ScarfL1', 'ScarfL2', 'ScarfR1', 'ScarfR2',
];

const STANDIN_BONE_SPECS = [
  ['Root', null, [0, 0, 0]],
  ['Pelvis', 'Root', [0, 0.305, -0.008]],
  ['Spine1', 'Pelvis', [0, 0.073, 0.004]],
  ['Spine2', 'Spine1', [0, 0.070, 0.006]],
  ['Chest', 'Spine2', [0, 0.067, 0.004]],
  ['Neck', 'Chest', [0, 0.060, -0.002]],
  ['Head', 'Neck', [0, 0.055, 0.008]],
  ['Jaw', 'Head', [0, 0.055, 0.043]],
  ['MouthSmile', 'Head', [0, 0.085, 0.123]],
  ['EyeL', 'Head', [0.084, 0.176, 0.106]],
  ['EyeR', 'Head', [-0.084, 0.176, 0.106]],
  ['EyelidL', 'Head', [0.084, 0.176, 0.106]],
  ['EyelidR', 'Head', [-0.084, 0.176, 0.106]],
  ['LowerLidL', 'Head', [0.084, 0.176, 0.106]],
  ['LowerLidR', 'Head', [-0.084, 0.176, 0.106]],
  ['BrowL', 'Head', [0.084, 0.262, 0.146]],
  ['BrowR', 'Head', [-0.084, 0.262, 0.146]],
  ['FrillL1', 'Head', [0.145, 0.192, -0.020]],
  ['FrillL2', 'FrillL1', [0.100, 0.083, -0.077]],
  ['FrillBotL', 'Head', [0.148, 0.090, -0.010]],
  ['FrillR1', 'Head', [-0.145, 0.192, -0.020]],
  ['FrillR2', 'FrillR1', [-0.100, 0.083, -0.077]],
  ['FrillBotR', 'Head', [-0.148, 0.090, -0.010]],
  ['ScarfL1', 'Chest', [0.044, 0.053, -0.108]],
  ['ScarfL2', 'ScarfL1', [0.044, -0.086, -0.166]],
  ['ScarfR1', 'Chest', [-0.044, 0.053, -0.108]],
  ['ScarfR2', 'ScarfR1', [-0.038, -0.073, -0.140]],
  ['ClavicleL', 'Chest', [0.042, 0.011, -0.002]],
  ['UpperArmL', 'ClavicleL', [0.083, -0.008, -0.002]],
  ['ForearmL', 'UpperArmL', [0.059, -0.096, -0.016]],
  ['HandL', 'ForearmL', [0.020, -0.084, 0.056]],
  ['ClavicleR', 'Chest', [-0.042, 0.011, -0.002]],
  ['UpperArmR', 'ClavicleR', [-0.083, -0.008, -0.002]],
  ['ForearmR', 'UpperArmR', [-0.059, -0.096, -0.016]],
  ['HandR', 'ForearmR', [-0.020, -0.084, 0.056]],
  ['ThighL', 'Pelvis', [0.080, 0.000, 0.010]],
  ['ShinL', 'ThighL', [0.010, -0.130, 0.038]],
  ['AnkleL', 'ShinL', [-0.002, -0.107, -0.056]],
  ['FootL', 'AnkleL', [0.000, -0.046, 0.046]],
  ['ThighR', 'Pelvis', [-0.080, 0.000, 0.010]],
  ['ShinR', 'ThighR', [-0.010, -0.130, 0.038]],
  ['AnkleR', 'ShinR', [0.002, -0.107, -0.056]],
  ['FootR', 'AnkleR', [0.000, -0.046, 0.046]],
  ['Tail1', 'Pelvis', [0, -0.003, -0.064]],
  ['Tail2', 'Tail1', [0, -0.032, -0.108]],
  ['Tail3', 'Tail2', [0, -0.018, -0.112]],
  ['Tail4', 'Tail3', [0, 0.006, -0.110]],
  ['Tail5', 'Tail4', [0, 0.030, -0.108]],
  ['Tail6', 'Tail5', [0, 0.050, -0.102]],
  ['Tail7', 'Tail6', [0, 0.060, -0.094]],
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
  ['mouthSmile', 'MouthSmile'],
  ['eyeL', 'EyeL'],
  ['eyeR', 'EyeR'],
  ['eyelidL', 'EyelidL'],
  ['eyelidR', 'EyelidR'],
  ['lowerLidL', 'LowerLidL'],
  ['lowerLidR', 'LowerLidR'],
  ['browL', 'BrowL'],
  ['browR', 'BrowR'],
  ['frillL1', 'FrillL1'],
  ['frillL2', 'FrillL2'],
  ['frillBotL', 'FrillBotL'],
  ['frillR1', 'FrillR1'],
  ['frillR2', 'FrillR2'],
  ['frillBotR', 'FrillBotR'],
  ['scarfL1', 'ScarfL1'],
  ['scarfL2', 'ScarfL2'],
  ['scarfR1', 'ScarfR1'],
  ['scarfR2', 'ScarfR2'],
  ['crest', 'FrillL1'],
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

// 6-Mood Live Facial Pose Parameters (EyelidL/R, LowerLidL/R, BrowL/R height & roll, Jaw, MouthSmile, Frill boost)
const MOOD_TARGETS = {
  happy: {
    uLidL: -0.04, uLidR: -0.04,
    lLidL: 0.04, lLidR: 0.04,
    browYL: 0.005, browYR: 0.005,
    browRollL: 0.07, browRollR: -0.07,
    jaw: 0.00, smileY: 0.005, frill: 0.06,
  },
  curious: {
    uLidL: -0.10, uLidR: -0.05,
    lLidL: 0.00, lLidR: 0.00,
    browYL: 0.016, browYR: -0.004,
    browRollL: 0.16, browRollR: 0.08,
    jaw: 0.00, smileY: 0.006, frill: 0.26,
  },
  determined: {
    uLidL: 0.24, uLidR: 0.24,
    lLidL: 0.22, lLidR: 0.22,
    browYL: -0.010, browYR: -0.010,
    browRollL: -0.26, browRollR: 0.26,
    jaw: 0.00, smileY: 0.003, frill: 0.34,
  },
  joyful: {
    uLidL: 0.22, uLidR: 0.22,
    lLidL: 0.56, lLidR: 0.56,
    browYL: 0.018, browYR: 0.018,
    browRollL: 0.14, browRollR: -0.14,
    jaw: 0.18, smileY: 0.010, frill: 0.56,
  },
  surprised: {
    uLidL: -0.24, uLidR: -0.24,
    lLidL: -0.10, lLidR: -0.10,
    browYL: 0.024, browYR: 0.024,
    browRollL: 0.20, browRollR: -0.20,
    jaw: 0.16, smileY: -0.005, frill: 0.42,
  },
  hurt: {
    uLidL: 0.68, uLidR: 0.68,
    lLidL: 0.56, lLidR: 0.56,
    browYL: -0.014, browYR: -0.014,
    browRollL: -0.32, browRollR: 0.32,
    jaw: 0.12, smileY: -0.008, frill: -0.36,
  },
};

const FACIAL_BONE_NAMES = [
  'EyeL', 'EyeR', 'EyelidL', 'EyelidR', 'LowerLidL', 'LowerLidR',
  'BrowL', 'BrowR', 'Jaw', 'MouthSmile',
];

// Hard bind-relative Euler clamp limits for all 6 coral ear-frill bones so frills fan
// outward/slightly back and NEVER fold forward (+Z / +rx) across Gateway's face or eyes!
const FRILL_BONE_CLAMPS = [
  ['FrillL1',   -0.38, 0.24, 0.14, 0.16],
  ['FrillL2',   -0.42, 0.24, 0.14, 0.16],
  ['FrillBotL', -0.34, 0.22, 0.14, 0.16],
  ['FrillR1',   -0.38, 0.24, 0.14, 0.16],
  ['FrillR2',   -0.42, 0.24, 0.14, 0.16],
  ['FrillBotR', -0.34, 0.22, 0.14, 0.16],
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
              if (obj.geometry.attributes?.uv && !obj.geometry.attributes?.uv1) {
                obj.geometry.setAttribute('uv1', obj.geometry.attributes.uv);
              }
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

let _sharedPalmSplashTex = null;

function getSharedPalmSplashTex() {
  if (_sharedPalmSplashTex) return _sharedPalmSplashTex;
  if (typeof document === 'undefined' || typeof document.createElement !== 'function') return null;
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 64;
  const ctx = c.getContext('2d');
  if (!ctx) return null;
  ctx.clearRect(0, 0, 64, 64);
  const g = ctx.createRadialGradient(32, 32, 1, 32, 32, 28);
  g.addColorStop(0.0, 'rgba(255, 255, 255, 0.95)');
  g.addColorStop(0.28, 'rgba(180, 250, 255, 0.65)');
  g.addColorStop(0.62, 'rgba(94, 252, 232, 0.20)');
  g.addColorStop(0.88, 'rgba(94, 252, 232, 0.0)');
  g.addColorStop(1.0, 'rgba(94, 252, 232, 0.0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  ctx.save();
  ctx.translate(32, 32);
  for (let i = 0; i < 6; i++) {
    ctx.rotate(Math.PI / 3);
    const rg = ctx.createLinearGradient(0, 0, 24, 0);
    rg.addColorStop(0.0, 'rgba(255, 255, 255, 0.75)');
    rg.addColorStop(0.55, 'rgba(125, 235, 255, 0.28)');
    rg.addColorStop(1.0, 'rgba(125, 235, 255, 0.0)');
    ctx.fillStyle = rg;
    ctx.beginPath();
    ctx.moveTo(2, -2.2);
    ctx.quadraticCurveTo(14, -4.0, 24, 0);
    ctx.quadraticCurveTo(14, 4.0, 2, 2.2);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  _sharedPalmSplashTex = tex;
  return tex;
}

/**
 * Synthesizes and caches per-skin `albedo` & `emissive` CanvasTextures from the embedded
 * Gateway 2.0 1K WEBP atlas across all 5 UV regions:
 *   - Q_SKIN  (UB <= 0.68, VB <= 0.72): Silky Pixar skin, cream belly, rosy cheeks, lash rim & brows
 *   - Q_SCARF (UB >  0.68, VB <= 0.34): Woven sea-silk Explorer Scarf & sunlit gold wave embroidery
 *   - Q_FRILL (UB >  0.68, 0.34 < VB <= 0.70): Translucent-look veined petal ear-frills & tail-fin
 *   - Q_EYE   (UB >  0.68, VB >  0.70): Jewel iris (preserving dark pupil, warm sclera & catchlights!)
 *   - Q_GEAR  (UB <= 0.68, VB >  0.72): Stitched explorer satchel, gold filigree & Sapphire Water Seed
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
    const cDeep = hexToRgb01(skin.bodyDeepColor || skin.bodyColor);
    const cBelly = hexToRgb01(skin.bellyColor);
    const cCrest = hexToRgb01(skin.crestColor);
    const cScarf = hexToRgb01(skin.scarfColor || skin.crestColor);
    const cScarfTrim = hexToRgb01(skin.scarfTrimColor || skin.packColor);
    const cHarness = hexToRgb01(skin.harnessColor);
    const cPack = hexToRgb01(skin.packColor);
    const cEye = hexToRgb01(skin.eyeGlow);
    const cAccent = hexToRgb01(skin.accentColor);
    const isOpal = Boolean(skin.iridescentOpal);

    for (let py = 0; py < h; py++) {
      const vb = 1.0 - py / Math.max(1, h - 1);
      for (let px = 0; px < w; px++) {
        const ub = px / Math.max(1, w - 1);
        const idx = (py * w + px) * 4;
        const r0 = dA[idx] / 255;
        const g0 = dA[idx + 1] / 255;
        const b0 = dA[idx + 2] / 255;
        const lum = 0.2126 * r0 + 0.7152 * g0 + 0.0722 * b0;
        const sat = Math.max(r0, g0, b0) - Math.min(r0, g0, b0);

        let outR = r0;
        let outG = g0;
        let outB = b0;
        let keepOrig = false;

        if (ub <= 0.68 && vb <= 0.72) {
          if (vb >= 0.65) {
            if (ub >= 0.34) {
              // Dedicated Q_LASH strip (`UB 0.34..0.68, VB 0.65..0.72`): preserve dark winged lash rim, tint lid skin!
              if (lum < 0.24) {
                keepOrig = true;
              } else {
                const lGain = 0.72 + 0.36 * lum;
                outR = Math.min(1, cBody[0] * lGain);
                outG = Math.min(1, cBody[1] * lGain);
                outB = Math.min(1, cBody[2] * lGain);
              }
            } else {
              // Dedicated Q_BROW strip (`UB 0.00..0.34, VB 0.65..0.72`): crisp brightened skin/accent tone!
              const bGain = 0.68 + 0.42 * lum;
              outR = Math.min(1, (cBody[0] * 0.65 + cAccent[0] * 0.35) * bGain);
              outG = Math.min(1, (cBody[1] * 0.65 + cAccent[1] * 0.35) * bGain);
              outB = Math.min(1, (cBody[2] * 0.65 + cAccent[2] * 0.35) * bGain);
            }
          } else {
            const su = Math.max(0, Math.min(1, (ub - 0.02) / 0.64));
            const sv = Math.max(0, Math.min(1, (vb - 0.02) / 0.61));
            const frontDist = Math.abs(su - 0.5) * 2.0;

            // Detect warm cream-pearl belly & rosy coral cheek blush so both stay plush & adorable!
            const isBelly = r0 > 0.76 && g0 > 0.72 && b0 > 0.66 && sat < 0.16;
            const isCheekBlush = sv > 0.72 && sv < 0.86 && r0 > g0 * 1.06 && r0 > 0.52;
            const isSmileOrNostril = sv > 0.73 && sv < 0.84 && frontDist < 0.36 && lum < 0.34;

            if (isSmileOrNostril) {
              // Soft tinted smile & tiny nostrils harmonized to skin deep color
              outR = cDeep[0] * 0.52;
              outG = cDeep[1] * 0.52;
              outB = cDeep[2] * 0.52;
            } else if (isBelly) {
              const bGain = 0.88 + 0.14 * lum;
              outR = cBelly[0] * bGain;
              outG = cBelly[1] * bGain;
              outB = cBelly[2] * bGain;
            } else {
              const dorsalT = Math.max(0, Math.min(1, (frontDist - 0.44) / 0.52));
              let sr = cBody[0] * (1 - dorsalT * 0.54) + cDeep[0] * (dorsalT * 0.54);
              let sg = cBody[1] * (1 - dorsalT * 0.54) + cDeep[1] * (dorsalT * 0.54);
              let sb = cBody[2] * (1 - dorsalT * 0.54) + cDeep[2] * (dorsalT * 0.54);

              if (isOpal) {
                const wave = 0.5 + 0.5 * Math.sin(sv * 8.5 + su * 5.2);
                const opalR = cAccent[0] * (1 - wave) + cCrest[0] * wave;
                const opalG = cAccent[1] * (1 - wave) + cCrest[1] * wave;
                const opalB = cAccent[2] * (1 - wave) + cCrest[2] * wave;
                sr = sr * 0.72 + opalR * 0.28;
                sg = sg * 0.72 + opalG * 0.28;
                sb = sb * 0.72 + opalB * 0.28;
              }
              // Gentle silky value retention (NEVER harsh dark cracks!)
              const silkGain = 0.66 + 0.44 * Math.max(0.15, Math.min(1.0, lum / 0.72));
              outR = sr * silkGain;
              outG = sg * silkGain;
              outB = sb * silkGain;
              if (isCheekBlush) {
                // Keep soft warm peach-pink cheek blush!
                outR = outR * 0.62 + 0.98 * 0.38;
                outG = outG * 0.62 + 0.56 * 0.38;
                outB = outB * 0.62 + 0.64 * 0.38;
              }
            }
          }
        } else if (ub > 0.68 && vb <= 0.34) {
          // Q_SCARF: Rich sea-silk Explorer Scarf + metallic gold wave embroidery!
          const isGoldTrim = r0 > 0.78 && g0 > 0.64 && b0 < 0.56;
          if (isGoldTrim) {
            const gGain = 0.72 + 0.34 * lum;
            outR = cScarfTrim[0] * gGain;
            outG = cScarfTrim[1] * gGain;
            outB = cScarfTrim[2] * gGain;
          } else {
            const sGain = 0.64 + 0.48 * Math.max(0.15, lum);
            outR = cScarf[0] * sGain;
            outG = cScarf[1] * sGain;
            outB = cScarf[2] * sGain;
          }
        } else if (ub > 0.68 && vb <= 0.70) {
          // Q_FRILL: Luminous sea-mint root -> translucent glowing petal tips!
          const fu = Math.max(0, Math.min(1, (ub - 0.70) / 0.28));
          const midT = Math.max(0, Math.min(1, fu * 1.4));
          const tipT = Math.max(0, Math.min(1, (fu - 0.40) / 0.58));
          let fr = cBody[0] * (1 - midT) + cAccent[0] * midT;
          let fg = cBody[1] * (1 - midT) + cAccent[1] * midT;
          let fb = cBody[2] * (1 - midT) + cAccent[2] * midT;
          fr = fr * (1 - tipT * 0.65) + cCrest[0] * (tipT * 0.65);
          fg = fg * (1 - tipT * 0.65) + cCrest[1] * (tipT * 0.65);
          fb = fb * (1 - tipT * 0.65) + cCrest[2] * (tipT * 0.65);
          const fGain = 0.62 + 0.48 * Math.max(0.15, lum);
          outR = fr * fGain;
          outG = fg * fGain;
          outB = fb * fGain;
        } else if (ub > 0.68 && vb > 0.70) {
          // Q_EYE: Preserve friendly dark pupil, warm cream sclera & pure-white catchlights, tint jewel iris!
          const ex = (ub - 0.84) / 0.135;
          const ey = (vb - 0.85) / 0.135;
          const er = Math.hypot(ex, ey);
          if (er > 0.77 || lum > 0.84 || lum < 0.10) {
            keepOrig = true;
          } else {
            const irisGain = 0.52 + 0.66 * Math.max(0.10, lum);
            outR = cEye[0] * irisGain;
            outG = cEye[1] * irisGain;
            outB = cEye[2] * irisGain;
          }
        } else {
          // Q_GEAR: stitched leather satchel (0..0.35), gold filigree (0.35..0.68), Star-Sapphire gem (0.68..1.0)
          const gv = Math.max(0, Math.min(1, (vb - 0.74) / 0.24));
          if (gv < 0.35) {
            const lGain = 0.58 + 0.52 * Math.max(0.10, lum);
            outR = cHarness[0] * lGain;
            outG = cHarness[1] * lGain;
            outB = cHarness[2] * lGain;
          } else if (gv < 0.68) {
            const mGain = 0.58 + 0.54 * Math.max(0.10, lum);
            outR = cPack[0] * mGain;
            outG = cPack[1] * mGain;
            outB = cPack[2] * mGain;
          } else {
            const gGain = 0.60 + 0.56 * Math.max(0.10, lum);
            outR = cAccent[0] * gGain;
            outG = cAccent[1] * gGain;
            outB = cAccent[2] * gGain;
          }
        }

        if (!keepOrig) {
          dA[idx] = Math.max(0, Math.min(255, Math.round(outR * 255)));
          dA[idx + 1] = Math.max(0, Math.min(255, Math.round(outG * 255)));
          dA[idx + 2] = Math.max(0, Math.min(255, Math.round(outB * 255)));
        }
      }
    }
    ctxA.putImageData(imgA, 0, 0);

    const texA = new THREE.CanvasTexture(cAlb);
    texA.flipY = Boolean(baseMaps.albedo.flipY);
    texA.colorSpace = THREE.SRGBColorSpace;
    texA.minFilter = THREE.LinearMipmapLinearFilter;
    texA.magFilter = THREE.LinearFilter;
    texA.anisotropy = 4;
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
            const isWhite = dE[i] > 225 && dE[i + 1] > 225 && dE[i + 2] > 225;
            if (!isWhite) {
              dE[i] = Math.min(255, Math.round(cAccent[0] * elum * 235));
              dE[i + 1] = Math.min(255, Math.round(cAccent[1] * elum * 235));
              dE[i + 2] = Math.min(255, Math.round(cAccent[2] * elum * 235));
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
   * @param {string | { skinId?: string, targetHeight?: number }} [skinId='sea_glass_guardian']
   */
  constructor(skinId = 'sea_glass_guardian') {
    const opts = typeof skinId === 'object' && skinId !== null ? skinId : { skinId };
    const initSkinId = opts.skinId || 'sea_glass_guardian';

    this.group = new THREE.Group();
    this.group.name = 'GatewayRig';

    // Exact 1.22m World Height Auto-Normalization wrapper (`gateway.glb` bind crown = 1.000m!)
    this.targetHeight =
      Number.isFinite(opts.targetHeight) && opts.targetHeight > 0.1
        ? Number(opts.targetHeight)
        : DEFAULT_TARGET_HEIGHT;
    this._bindCrownHeight = GATEWAY_BIND_HEIGHT;
    this._normGroup = new THREE.Group();
    this._normGroup.name = 'GatewayHeightNormRoot';
    this._normGroup.scale.setScalar(this.targetHeight / this._bindCrownHeight);
    this.group.add(this._normGroup);

    this._disposed = false;
    this._glbApplied = false;
    this._ownedGeos = new Set();
    this._ownedMats = new Set();
    this._baseGlbMaps = null;

    this.currentSkinId = null;
    this.currentEra = 'reboot';
    this._activeSkin = GATEWAY_SKINS[0];

    // Zero-allocation scratch math objects for 60fps mobile animation polish & 2-bone Foot-IK
    this._qScratchA = new THREE.Quaternion();
    this._qScratchB = new THREE.Quaternion();
    this._qIkParentRoot = new THREE.Quaternion();
    this._qIkDelta = new THREE.Quaternion();
    this._qIkThighRoot = new THREE.Quaternion();
    this._qIkShinRoot = new THREE.Quaternion();
    this._qIkLocalTmp = new THREE.Quaternion();
    this._eScratch = new THREE.Euler(0, 0, 0, 'XYZ');
    this._scratchColor = new THREE.Color();
    this._mIkInvRoot = new THREE.Matrix4();
    this._mIkTmp = new THREE.Matrix4();
    this._mIkBasis1 = new THREE.Matrix4();
    this._mIkDelta = new THREE.Matrix4();
    this._vIkHip = new THREE.Vector3();
    this._vIkAnkleTgt = new THREE.Vector3();
    this._vIkHA = new THREE.Vector3();
    this._vIkUDir = new THREE.Vector3();
    this._vIkPole = new THREE.Vector3();
    this._vIkKnee = new THREE.Vector3();
    this._vIkThighDir = new THREE.Vector3();
    this._vIkShinDir = new THREE.Vector3();
    this._vIkPlaneN = new THREE.Vector3();
    this._vIkBinorm = new THREE.Vector3();

    this._initDummyPoseState = { time: 0, vx: 0, vy: 0, facing: 1, onGround: true };
    this._lastPoseState = this._initDummyPoseState;
    this._yawSyncedToCaller = false;
    this._internalTime = 0;
    this._stridePhase = 0;
    this._yaw = 0.42;
    this._prevYaw = 0.42;
    this._bankRoll = 0;
    this._pelvisBindY = 0.305;
    this._headLookYaw = 0;
    this._headLookPitch = 0;
    this._eyeLookYaw = 0;
    this._eyeLookPitch = 0;
    this._frillFlare = 0;
    this._frillVel = 0;
    this._castBlend = 0;
    this._pushBlend = 0;
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
    this._legIkBind = null;

    // 6-Mood Live Facial Controller + Organic Blinking (`2.5–4.5s`) + Title Showcase State
    this._moodOverride = null;
    this.currentMood = 'happy';
    this._faceBind = {};
    this._faceState = {
      uLidL: 0, uLidR: 0,
      lLidL: 0.14, lLidR: 0.14,
      browYL: 0.004, browYR: 0.004,
      browRollL: 0.06, browRollR: -0.06,
      jaw: 0, smileY: 0.004, frill: 0.06,
    };
    this._blinkTimer = 0;
    this._nextBlinkInterval = 3.2;
    this._blinkPhase = 0;
    this._blinkCount = 0;
    this._blinkActive = false;
    this._doubleBlinkQueued = false;
    this._idleCuriosityTimer = 0;
    this._pointerGazeX = 0;
    this._pointerGazeY = 0;
    this._pointerGazeActive = false;
    this._titleWaveTimer = 0;
    this._titleHopTimer = 0;
    this._titleHopDuration = 0.62;
    this._prevTitleWaveFlag = false;
    this._prevTitleHopFlag = false;
    this._frillBind = {};
    this._wetShakeTimer = 0;
    this._somersaultTimer = 0;

    // 4-Bone 2nd-Order Spring-Damped Sea-Silk Scarf Physics
    this._scarfPitchLag = 0;
    this._scarfPitchVel = 0;
    this._scarfYawLag = 0;
    this._scarfYawVel = 0;

    // 7-Bone 2nd-Order Spring-Damped Dynamic Tail Physics
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

  setTargetHeight(meters) {
    if (!Number.isFinite(meters) || meters <= 0.1) return;
    this.targetHeight = Number(meters);
    this._syncHeightNormalization();
  }

  getWorldHeight() {
    const groupScaleY = this.group?.scale?.y || 1;
    const normScaleY = this._normGroup?.scale?.y || 1;
    return this._bindCrownHeight * normScaleY * groupScaleY;
  }

  _syncHeightNormalization() {
    if (!this._normGroup) return;
    const norm = this.targetHeight / Math.max(0.2, this._bindCrownHeight);
    this._normGroup.scale.setScalar(norm);
  }

  setMood(mood) {
    if (mood === null || mood === undefined || mood === 'auto') {
      this._moodOverride = null;
      return;
    }
    const key = String(mood).toLowerCase();
    const mapped = key === 'celebrate' ? 'joyful' : key;
    if (MOOD_SET.has(mapped)) {
      this._moodOverride = mapped;
      this.currentMood = mapped;
    }
  }

  getMood() {
    return this.currentMood;
  }

  setPointerGaze(nx = 0, ny = 0, active = true) {
    this._pointerGazeX = THREE.MathUtils.clamp(Number(nx) || 0, -1, 1);
    this._pointerGazeY = THREE.MathUtils.clamp(Number(ny) || 0, -1, 1);
    this._pointerGazeActive = Boolean(active);
  }

  triggerTitleWave(duration = 1.65) {
    this._titleWaveTimer = Math.max(this._titleWaveTimer, Number(duration) || 1.65);
    if (this.actions.IdleCurious && this._activeClipName !== 'IdleCurious') {
      this.playAction('IdleCurious', 0.14, 1.0);
    }
  }

  triggerTitleHop(duration = 0.62) {
    this._titleHopDuration = Math.max(0.35, Number(duration) || 0.62);
    this._titleHopTimer = this._titleHopDuration;
    this._frillVel = THREE.MathUtils.clamp(this._frillVel + 1.8, -3.5, 3.5);
    this._scarfPitchVel = THREE.MathUtils.clamp(this._scarfPitchVel + 4.5, -8.0, 8.0);
    this._tailPitchVel = THREE.MathUtils.clamp(this._tailPitchVel + 5.0, -8.0, 8.0);
    if (this.actions.Celebrate) {
      this.playAction('Celebrate', 0.08, 1.35);
    }
  }

  triggerWetShake(duration = 0.65) {
    this._wetShakeTimer = Math.max(this._wetShakeTimer, Number(duration) || 0.65);
    if (this.actions.WetShake) {
      this._activeClipName = null;
      this.playAction('WetShake', 0.08, 1.15);
    }
  }

  triggerSpringSomersault(duration = 0.72) {
    this._somersaultTimer = Math.max(this._somersaultTimer, Number(duration) || 0.72);
    if (this.actions.SpringSomersault) {
      this._activeClipName = null;
      this.playAction('SpringSomersault', 0.06, 1.2);
    }
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
        roughness: 0.34,
        metalness: 0.06,
        emissive: '#ffffff',
        emissiveIntensity: 0.85,
      })
    );
    this.accentMat = this._trackMat(
      new THREE.MeshStandardMaterial({
        color: '#72fff0',
        emissive: '#38bdf8',
        emissiveIntensity: 1.05,
        roughness: 0.14,
        metalness: 0.22,
      })
    );
    const palmSplashTex = getSharedPalmSplashTex();
    this.flashMat = this._trackMat(
      new THREE.MeshBasicMaterial({
        color: '#7dd3fc',
        map: palmSplashTex,
        transparent: true,
        opacity: 0.82,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    this._starMoteMat = this._trackMat(
      new THREE.MeshStandardMaterial({
        color: '#c4f5ff',
        emissive: '#7dd3fc',
        emissiveIntensity: 0.85,
        roughness: 0.12,
        metalness: 0.35,
        transparent: true,
        opacity: 0.88,
      })
    );
    this._moteDummy = new THREE.Object3D();
    this.mats = {
      skin: this.mainMat,
      accentGlow: this.accentMat,
      muzzleFlash: this.flashMat,
    };
  }

  /**
   * Builds a lightweight, real 50-bone `THREE.SkinnedMesh` + 22 procedural clips for instant
   * Frame-0 rendering & headless Node tests before `gateway.glb` finishes loading.
   */
  _buildInstantSkinnedStandIn() {
    const standInGroup = new THREE.Group();
    standInGroup.name = 'GatewayStandInRoot';
    this._normGroup.add(standInGroup);
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

    // Compact 1.000m mascot stand-in SkinnedMesh along Tail -> Torso -> Head (`y = 0..1.00m`)
    const curvePts = [
      new THREE.Vector3(0, 0.45, -0.78),
      new THREE.Vector3(0, 0.28, -0.48),
      new THREE.Vector3(0, 0.27, -0.18),
      new THREE.Vector3(0, 0.31, -0.01),
      new THREE.Vector3(0, 0.45, 0.005),
      new THREE.Vector3(0, 0.58, 0.01),
      new THREE.Vector3(0, 0.78, 0.04),
      new THREE.Vector3(0, 0.96, 0.02),
    ];
    const bodyCurve = new THREE.CatmullRomCurve3(curvePts);
    const geo = this._trackGeo(new THREE.TubeGeometry(bodyCurve, 32, 0.09, 12, false));
    const posAttr = geo.attributes.position;
    const vCount = posAttr.count;
    const skinIndices = new Uint16Array(vCount * 4);
    const skinWeights = new Float32Array(vCount * 4);

    const boneWorldPts = boneList.map((b) => {
      const v = new THREE.Vector3();
      b.getWorldPosition(v);
      return v;
    });
    const tmpP = new THREE.Vector3();

    for (let i = 0; i < vCount; i++) {
      tmpP.fromBufferAttribute(posAttr, i);
      if (tmpP.z < -0.12) {
        const tf = Math.max(0.18, 1.0 - (-tmpP.z - 0.12) / 0.74);
        tmpP.x *= tf;
        tmpP.y = 0.34 + (tmpP.y - 0.34) * tf;
        posAttr.setXYZ(i, tmpP.x, tmpP.y, tmpP.z);
      } else if (tmpP.y > 0.64) {
        // Plump mascot head swell in stand-in
        tmpP.x *= 1.65;
        tmpP.z *= 1.35;
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
    this._captureFacialBindPose();
    this._measureBindPoseLegIk(standInGroup);
    this._initFallbackClipsAndMixer(standInGroup);
  }

  _captureFacialBindPose() {
    this._faceBind = {};
    for (let i = 0; i < FACIAL_BONE_NAMES.length; i++) {
      const fn = FACIAL_BONE_NAMES[i];
      const bone = this.bones[fn];
      if (bone) {
        this._faceBind[fn] = {
          pos: bone.position.clone(),
          quat: bone.quaternion.clone(),
        };
      }
    }
    this._frillBind = {};
    for (let i = 0; i < FRILL_BONE_CLAMPS.length; i++) {
      const bn = FRILL_BONE_CLAMPS[i][0];
      const bone = this.bones[bn];
      if (bone) {
        this._frillBind[bn] = {
          quat: bone.quaternion.clone(),
          invQuat: bone.quaternion.clone().invert(),
        };
      }
    }
  }

  _initFallbackClipsAndMixer(mixerRoot) {
    this.mixer = new THREE.AnimationMixer(mixerRoot);
    this.actions = {};
    this.animations = [];

    for (let i = 0; i < GATEWAY_CLIP_NAMES.length; i++) {
      const cname = GATEWAY_CLIP_NAMES[i];
      let track;
      if (cname === 'IdleBreathe' || cname === 'IdleCurious') {
        const y0 = this._pelvisBindY;
        track = new THREE.VectorKeyframeTrack(
          'Pelvis.position',
          [0, 0.5, 1.0],
          [0, y0, -0.008, 0, y0 - 0.010, -0.008, 0, y0, -0.008]
        );
      } else {
        const q0 = new THREE.Quaternion();
        const q1 = new THREE.Quaternion().setFromEuler(
          new THREE.Euler(cname === 'FluidRun' ? 0.18 : cname === 'SpringSomersault' ? Math.PI : 0.04, 0, 0)
        );
        track = new THREE.QuaternionKeyframeTrack(
          'Pelvis.quaternion',
          [0, 0.5, 1.0],
          [q0.x, q0.y, q0.z, q0.w, q1.x, q1.y, q1.z, q1.w, q0.x, q0.y, q0.z, q0.w]
        );
      }
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
    // Graceful fallback aliases if an older 39-bone GLB is ever tested
    if (!this.bones.browL && boneLookup.EyelidL) this.bones.browL = boneLookup.EyelidL;
    if (!this.bones.browR && boneLookup.EyelidR) this.bones.browR = boneLookup.EyelidR;

    if (!this._hydroEmitterGroup) {
      this._hydroEmitterGroup = new THREE.Group();
      this._hydroEmitterGroup.name = 'GatewayHydroCasterEmitter';

      const muzzle = new THREE.Group();
      const flashBloomA = new THREE.Mesh(
        this._trackGeo(new THREE.PlaneGeometry(0.11, 0.11)),
        this.flashMat
      );
      const flashBloomB = new THREE.Mesh(
        this._trackGeo(new THREE.PlaneGeometry(0.095, 0.095)),
        this.flashMat
      );
      flashBloomB.rotation.y = Math.PI * 0.5;
      const coreGeo = this._trackGeo(new THREE.OctahedronGeometry(0.016, 0));
      coreGeo.scale(0.85, 1.55, 0.85);
      const flashCore = new THREE.Mesh(coreGeo, this.accentMat);
      muzzle.add(flashBloomA, flashBloomB, flashCore);
      muzzle.visible = false;
      this._muzzleNode = muzzle;

      const muzzleLight = new THREE.PointLight('#5efce8', 0, 5.2, 1.8);
      muzzleLight.position.set(0, 0.02, 0.12);
      this._muzzleLight = muzzleLight;

      this._hydroEmitterGroup.position.set(0, -0.04, 0.045);
      this._hydroEmitterGroup.add(muzzle, muzzleLight);

      this._compatBlasterDummy = new THREE.Group();
      this._compatBackpackDummy = new THREE.Group();
      this._compatHarnessDummy = new THREE.Group();

      // Sovereign Starlight orbiting aurora star-droplets (1 InstancedMesh = 1 draw call!)
      this._starMotesGroup = new THREE.Group();
      const moteGeo = this._trackGeo(new THREE.OctahedronGeometry(0.015, 0));
      moteGeo.scale(0.65, 1.75, 0.65);
      const moteInst = new THREE.InstancedMesh(moteGeo, this._starMoteMat, 6);
      moteInst.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      const auroraHexes = ['#5efce8', '#c084fc', '#fde047', '#67e8f9', '#e879f9', '#99f6e4'];
      for (let i = 0; i < 6; i++) {
        this._scratchColor.set(auroraHexes[i]);
        moteInst.setColorAt(i, this._scratchColor);
      }
      if (moteInst.instanceColor) moteInst.instanceColor.needsUpdate = true;
      this._starMoteInst = moteInst;
      this._starMotes = [];
      this._starMotesGroup.add(moteInst);
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
   * Upgrades this `GatewayRig` instance to the sculpted Blender Gateway 2.0 `gateway.glb`
   * `SkinnedMesh` + 50-bone `Armature` + 1K WEBP PBR Atlas + 22 Baked NLA Skeletal Clips!
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

    // Retire Frame-0 stand-in cleanly
    if (this._standInGroup) {
      this._standInGroup.visible = false;
      this._normGroup.remove(this._standInGroup);
    }
    if (this.mixer) {
      this.mixer.stopAllAction();
    }

    const rigMotionRoot = new THREE.Group();
    rigMotionRoot.name = 'GatewayMotionRoot';
    rigMotionRoot.add(clonedScene);
    this._normGroup.add(rigMotionRoot);
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
    // Auto-detect Gateway 2.0 (`1.000m` crown) vs legacy (`1.185m`) for exact `1.22m` world height!
    this._bindCrownHeight = this._pelvisBindY > 0.44 ? 1.185 : GATEWAY_BIND_HEIGHT;
    this._syncHeightNormalization();

    clonedScene.position.set(0, 0, 0);

    this._captureFacialBindPose();
    this._measureBindPoseLegIk(rigMotionRoot);

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
    // Helpful canonical alias on `this.actions` for callers referencing `HeroCelebrate`
    if (this.actions.Celebrate && !this.actions.HeroCelebrate) {
      this.actions.HeroCelebrate = this.actions.Celebrate;
    }

    const startClip =
      this._activeClipName && this.actions[this._activeClipName] ? this._activeClipName : 'IdleBreathe';
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
    this.currentEra = 'reboot';
  }

  _refreshMaterials() {
    const skin = this._activeSkin || GATEWAY_SKINS[0];
    const metalBase = typeof skin.metallic === 'number' ? skin.metallic : 0.06;

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
      this.mainMat.normalScale.set(0.76, 0.76);
      this.mainMat.roughnessMap = this._baseGlbMaps.roughness || null;
      this.mainMat.metalnessMap = this._baseGlbMaps.metalness || null;
      this.mainMat.aoMap = this._baseGlbMaps.ao || this._baseGlbMaps.roughness || null;
      this.mainMat.aoMapIntensity = 0.78;
      this.mainMat.roughness = this._baseGlbMaps.roughness ? 1.0 : 0.34;
      this.mainMat.metalness = this._baseGlbMaps.metalness ? Math.max(0.85, metalBase) : metalBase;
      this.mainMat.emissiveMap = skinMaps ? skinMaps.emissive : this._baseGlbMaps.emissive || null;
      this.mainMat.emissive.set('#ffffff');
      this.mainMat.emissiveIntensity = 0.85;
    } else {
      this.mainMat.map = null;
      this.mainMat.color.set(skin.bodyColor);
      this.mainMat.emissive.set(skin.accentColor);
      this.mainMat.emissiveIntensity = 0.14;
      this.mainMat.roughness = 0.34;
      this.mainMat.metalness = metalBase;
    }
    this.mainMat.needsUpdate = true;

    if (this._starMotesGroup) {
      this._starMotesGroup.visible = skin.id === 'sovereign_starlight';
    }
  }

  /**
   * Cross-fades smoothly to a named skeletal clip on `this.mixer`.
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
   * Measures bind-pose `thighLen`, `shinLen`, and `motionRoot`-space ankle/foot contact targets
   * once when the stand-in or `gateway.glb` skeleton binds. Completely invariant to `this.group` transforms!
   */
  _measureBindPoseLegIk(motionRoot) {
    if (!motionRoot) return;
    const savedPos = motionRoot.position.clone();
    const savedRot = motionRoot.rotation.clone();
    const savedScale = motionRoot.scale.clone();
    motionRoot.position.set(0, 0, 0);
    motionRoot.rotation.set(0, 0, 0);
    motionRoot.scale.set(1, 1, 1);
    motionRoot.updateWorldMatrix(true, true);

    const invRoot = new THREE.Matrix4().copy(motionRoot.matrixWorld).invert();
    const matTmp = new THREE.Matrix4();
    const legs = [];

    for (const s of ['L', 'R']) {
      const thigh = this.bones[`Thigh${s}`];
      const shin = this.bones[`Shin${s}`];
      const ankle = this.bones[`Ankle${s}`];
      const foot = this.bones[`Foot${s}`];
      if (!thigh || !shin || !ankle || !foot || !thigh.parent) continue;

      matTmp.multiplyMatrices(invRoot, thigh.matrixWorld);
      const hipBindPos = new THREE.Vector3().setFromMatrixPosition(matTmp);
      const thighBindQuat = new THREE.Quaternion().setFromRotationMatrix(matTmp);

      matTmp.multiplyMatrices(invRoot, shin.matrixWorld);
      const kneeBindPos = new THREE.Vector3().setFromMatrixPosition(matTmp);
      const shinBindQuat = new THREE.Quaternion().setFromRotationMatrix(matTmp);

      matTmp.multiplyMatrices(invRoot, ankle.matrixWorld);
      const ankleBindPos = new THREE.Vector3().setFromMatrixPosition(matTmp);
      const ankleBindQuat = new THREE.Quaternion().setFromRotationMatrix(matTmp);

      matTmp.multiplyMatrices(invRoot, foot.matrixWorld);
      const footBindPos = new THREE.Vector3().setFromMatrixPosition(matTmp);
      const footBindLocalQuat = foot.quaternion.clone();

      const thighLen = hipBindPos.distanceTo(kneeBindPos);
      const shinLen = kneeBindPos.distanceTo(ankleBindPos);

      const thighDirBind = kneeBindPos.clone().sub(hipBindPos).normalize();
      const shinDirBind = ankleBindPos.clone().sub(kneeBindPos).normalize();
      const uBind = ankleBindPos.clone().sub(hipBindPos).normalize();
      const vKnee = kneeBindPos.clone().sub(hipBindPos);
      const poleDirBind = vKnee.clone().addScaledVector(uBind, -vKnee.dot(uBind));
      if (poleDirBind.lengthSq() < 1e-8) poleDirBind.set(0, 0, 1);
      poleDirBind.normalize();

      const planeNormalBind = new THREE.Vector3().crossVectors(thighDirBind, uBind);
      if (planeNormalBind.lengthSq() < 1e-8) planeNormalBind.set(1, 0, 0);
      planeNormalBind.normalize();

      const thighBasis0Inv = new THREE.Matrix4()
        .makeBasis(
          planeNormalBind,
          thighDirBind,
          new THREE.Vector3().crossVectors(planeNormalBind, thighDirBind)
        )
        .invert();
      const shinBasis0Inv = new THREE.Matrix4()
        .makeBasis(
          planeNormalBind,
          shinDirBind,
          new THREE.Vector3().crossVectors(planeNormalBind, shinDirBind)
        )
        .invert();

      legs.push({
        side: s,
        hipBindPos,
        kneeBindPos,
        ankleBindPos,
        footBindPos,
        thighLen,
        shinLen,
        thighBindQuat,
        shinBindQuat,
        ankleBindQuat,
        footBindLocalQuat,
        poleDirBind,
        planeNormalBind,
        thighBasis0Inv,
        shinBasis0Inv,
      });
    }

    motionRoot.position.copy(savedPos);
    motionRoot.rotation.copy(savedRot);
    motionRoot.scale.copy(savedScale);
    motionRoot.updateWorldMatrix(false, true);

    if (legs.length === 2) {
      this._legIkBind = legs;
    }
  }

  /**
   * Zero-allocation Runtime Analytic 2-Bone Leg IK Solver (Law of Cosines).
   * Pins both `AnkleL/R` and `FootL/R` flat on `y = 0.000m` (`< 0.05mm` drift!) across
   * `IdleBreathe`, `IdleCurious`, `EdgeTeeter`, `WetShake`, `HydroCast`, and landing crouches!
   */
  _solveGroundedTwoBoneLegIk(motionRoot, ikWeight = 1.0) {
    if (!this._legIkBind || !motionRoot || ikWeight <= 0.001) return;

    motionRoot.updateWorldMatrix(true, true);
    this._mIkInvRoot.copy(motionRoot.matrixWorld).invert();

    for (let i = 0; i < this._legIkBind.length; i++) {
      const leg = this._legIkBind[i];
      const thigh = this.bones[`Thigh${leg.side}`];
      const shin = this.bones[`Shin${leg.side}`];
      const ankle = this.bones[`Ankle${leg.side}`];
      const foot = this.bones[`Foot${leg.side}`];
      if (!thigh || !shin || !ankle || !foot || !thigh.parent) continue;

      this._mIkTmp.multiplyMatrices(this._mIkInvRoot, thigh.parent.matrixWorld);
      this._qIkParentRoot.setFromRotationMatrix(this._mIkTmp);

      this._mIkTmp.multiplyMatrices(this._mIkInvRoot, thigh.matrixWorld);
      this._vIkHip.setFromMatrixPosition(this._mIkTmp);

      this._vIkAnkleTgt.copy(leg.ankleBindPos);
      this._vIkHA.subVectors(this._vIkAnkleTgt, this._vIkHip);
      const rawDist = this._vIkHA.length();
      const L1 = leg.thighLen;
      const L2 = leg.shinLen;
      const minD = Math.abs(L1 - L2) + 1e-5;
      const maxD = L1 + L2 - 1e-5;
      const d = THREE.MathUtils.clamp(rawDist, minD, maxD);
      this._vIkUDir.copy(this._vIkHA).divideScalar(rawDist > 1e-7 ? rawDist : 1);

      const dotUP = this._vIkUDir.dot(leg.poleDirBind);
      this._vIkPole.copy(leg.poleDirBind).addScaledVector(this._vIkUDir, -dotUP);
      if (this._vIkPole.lengthSq() < 1e-8) {
        this._vIkPole.set(0, 0, 1).addScaledVector(this._vIkUDir, -this._vIkUDir.z);
      }
      this._vIkPole.normalize();

      const cosAlpha = THREE.MathUtils.clamp((L1 * L1 + d * d - L2 * L2) / (2 * L1 * d), -1, 1);
      const sinAlpha = Math.sqrt(Math.max(0, 1 - cosAlpha * cosAlpha));
      this._vIkKnee
        .copy(this._vIkHip)
        .addScaledVector(this._vIkUDir, L1 * cosAlpha)
        .addScaledVector(this._vIkPole, L1 * sinAlpha);

      this._vIkThighDir.subVectors(this._vIkKnee, this._vIkHip).normalize();
      this._vIkShinDir.subVectors(this._vIkAnkleTgt, this._vIkKnee).normalize();
      this._vIkPlaneN.crossVectors(this._vIkThighDir, this._vIkUDir);
      if (this._vIkPlaneN.lengthSq() > 1e-8) {
        this._vIkPlaneN.normalize();
      } else {
        this._vIkPlaneN.copy(leg.planeNormalBind);
      }

      this._vIkBinorm.crossVectors(this._vIkPlaneN, this._vIkThighDir);
      this._mIkBasis1.makeBasis(this._vIkPlaneN, this._vIkThighDir, this._vIkBinorm);
      this._mIkDelta.multiplyMatrices(this._mIkBasis1, leg.thighBasis0Inv);
      this._qIkDelta.setFromRotationMatrix(this._mIkDelta);
      this._qIkThighRoot.multiplyQuaternions(this._qIkDelta, leg.thighBindQuat);
      this._qIkLocalTmp.copy(this._qIkParentRoot).invert().multiply(this._qIkThighRoot);
      if (ikWeight >= 0.999) thigh.quaternion.copy(this._qIkLocalTmp);
      else thigh.quaternion.slerp(this._qIkLocalTmp, ikWeight);

      this._vIkBinorm.crossVectors(this._vIkPlaneN, this._vIkShinDir);
      this._mIkBasis1.makeBasis(this._vIkPlaneN, this._vIkShinDir, this._vIkBinorm);
      this._mIkDelta.multiplyMatrices(this._mIkBasis1, leg.shinBasis0Inv);
      this._qIkDelta.setFromRotationMatrix(this._mIkDelta);
      this._qIkShinRoot.multiplyQuaternions(this._qIkDelta, leg.shinBindQuat);
      this._qIkLocalTmp.copy(this._qIkThighRoot).invert().multiply(this._qIkShinRoot);
      if (ikWeight >= 0.999) shin.quaternion.copy(this._qIkLocalTmp);
      else shin.quaternion.slerp(this._qIkLocalTmp, ikWeight);

      this._qIkLocalTmp.copy(this._qIkShinRoot).invert().multiply(leg.ankleBindQuat);
      if (ikWeight >= 0.999) {
        ankle.quaternion.copy(this._qIkLocalTmp);
        foot.quaternion.copy(leg.footBindLocalQuat);
      } else {
        ankle.quaternion.slerp(this._qIkLocalTmp, ikWeight);
        foot.quaternion.slerp(leg.footBindLocalQuat, ikWeight);
      }

      thigh.updateWorldMatrix(false, true);
    }
  }

  /**
   * Resolves the active facial mood (`happy`/`curious`/`determined`/`joyful`/`surprised`/`hurt`)
   * from explicit overrides, gameplay state hints, or animation context.
   */
  _resolveTargetMood(ps, ctx) {
    if (this._moodOverride && MOOD_SET.has(this._moodOverride)) {
      return this._moodOverride;
    }
    if (typeof ps.mood === 'string') {
      const m = ps.mood.toLowerCase() === 'celebrate' ? 'joyful' : ps.mood.toLowerCase();
      if (MOOD_SET.has(m)) return m;
    }
    if (ctx.hurtTimer > 0.01) return 'hurt';
    if (ctx.edgeTeeter > 0.15 || this._activeClipName === 'EdgeTeeter') return 'surprised';
    if (
      ctx.victory ||
      ctx.springSomersault ||
      this._titleHopTimer > 0.01 ||
      this._titleWaveTimer > 0.15 ||
      this._activeClipName === 'Celebrate' ||
      this._activeClipName === 'SpringSomersault'
    ) {
      return 'joyful';
    }
    if (
      ctx.whipTimer > 0.01 ||
      this._whipHoldTimer > 0.01 ||
      ctx.muzzleFlash > 0.01 ||
      ctx.wallScamper ||
      ctx.isCoreDive ||
      ctx.pushingBox > 0.1 ||
      ctx.speed > 2.55
    ) {
      return 'determined';
    }
    if (
      this._activeClipName === 'IdleCurious' ||
      (ctx.isTitleShowcase && this._pointerGazeActive) ||
      (ctx.onGround && ctx.speed < 0.15 && Boolean(ps.lookTarget))
    ) {
      return 'curious';
    }
    return 'happy';
  }

  /**
   * Updates organic natural blinking (`2.5–4.5s` irregular cadence + occasional cute double-blink!).
   */
  _updateOrganicBlink(dt) {
    this._blinkTimer += dt;
    if (!this._blinkActive) {
      if (this._blinkTimer >= this._nextBlinkInterval) {
        this._blinkActive = true;
        this._blinkPhase = 0;
        this._blinkTimer = 0;
        this._blinkCount++;
        // Deterministic organic interval in [2.5s .. 4.5s] (zero Math.random jitter in tests!)
        const h = Math.abs(Math.sin(this._blinkCount * 12.9898 + 4.1414) * 43758.5453) % 1;
        this._nextBlinkInterval = 2.5 + h * 2.0;
        this._doubleBlinkQueued = this._blinkCount % 3 === 1;
      }
      return 0;
    }

    const blinkDur = 0.135;
    this._blinkPhase += dt / blinkDur;
    if (this._blinkPhase >= 1.0) {
      if (this._doubleBlinkQueued) {
        this._doubleBlinkQueued = false;
        this._blinkPhase = -0.55; // Brief 75ms pause before 2nd cute blink!
        return 0;
      }
      this._blinkActive = false;
      this._blinkPhase = 0;
      return 0;
    }
    if (this._blinkPhase < 0) return 0;
    return Math.sin(this._blinkPhase * Math.PI);
  }

  /**
   * Updates `THREE.AnimationMixer` + 6-Mood Facial Controller + Eye-Look + Spring Physics + Foot-IK!
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
    const isCoreDive = Boolean(ps.coreDive || ps.diving);
    const isMantling = Boolean(ps.mantling || Number(ps.mantleTimer) > 0);
    const isCutscene = Boolean(ps.cutscene || ps.cutscenePose);
    const isTitleShowcase = Boolean(ps.titleShowcase || ps.titleScreen);
    const edgeTeeter = THREE.MathUtils.clamp(Number(ps.edgeTeeter) || 0, 0, 1);
    const extWetShake = Math.max(0, Number(ps.wetShakeTimer) || 0);
    const springSomersault = Boolean(ps.springSomersault || ps.somersault || this._somersaultTimer > 0.01);
    const speed = Math.abs(vx);
    const speedNorm = THREE.MathUtils.clamp(speed / 3.55, 0, 1);
    const pushingBox = THREE.MathUtils.clamp(Number(ps.pushingBox) || 0, 0, 1);
    this._pushBlend = damp(this._pushBlend, onGround ? pushingBox : 0, 14, safeDt);

    // Handle Title Screen trigger hints on rising edge only (prevents resetting clips / exploding spring vel every frame!)
    const wantTitleWave = Boolean(ps.titleWave);
    const wantTitleHop = Boolean(ps.titleHop);
    if (wantTitleWave && !this._prevTitleWaveFlag) this.triggerTitleWave(1.65);
    if (wantTitleHop && !this._prevTitleHopFlag) this.triggerTitleHop(0.62);
    this._prevTitleWaveFlag = wantTitleWave;
    this._prevTitleHopFlag = wantTitleHop;
    if (ps.pointerGaze && typeof ps.pointerGaze === 'object') {
      this._pointerGazeX = THREE.MathUtils.clamp(Number(ps.pointerGaze.x) || 0, -1, 1);
      this._pointerGazeY = THREE.MathUtils.clamp(Number(ps.pointerGaze.y) || 0, -1, 1);
      this._pointerGazeActive = ps.pointerGaze.active !== false;
    }

    if (this._titleWaveTimer > 0) this._titleWaveTimer = Math.max(0, this._titleWaveTimer - safeDt);
    if (this._titleHopTimer > 0) this._titleHopTimer = Math.max(0, this._titleHopTimer - safeDt);
    if (this._wetShakeTimer > 0) this._wetShakeTimer = Math.max(0, this._wetShakeTimer - safeDt);
    if (this._somersaultTimer > 0) this._somersaultTimer = Math.max(0, this._somersaultTimer - safeDt);
    const wetShakeActive = extWetShake > 0.01 || this._wetShakeTimer > 0.01;

    // Track continuous quiet idle duration to auto-trigger adorable `IdleCurious` wave after 3.2s!
    if (
      onGround &&
      speed < 0.08 &&
      !onStairs &&
      !wallScamper &&
      !isSwimming &&
      !isSurfing &&
      !isCoreDive &&
      !victory &&
      !isCutscene &&
      edgeTeeter < 0.1 &&
      !wetShakeActive &&
      whipTimer <= 0.01 &&
      muzzleFlash <= 0.01 &&
      hurtTimer <= 0.01
    ) {
      this._idleCuriosityTimer += safeDt;
    } else {
      this._idleCuriosityTimer = 0;
    }

    // STRICT FrillGlide Gate
    const isWardrobeGlidePreview =
      ps.anim === 'FrillGlide' && Number(ps.frillFlare) >= 0.99 && speed === 0 && vy === 0 && !onGround;
    const isGliding =
      ps.isGliding !== undefined
        ? Boolean(ps.isGliding)
        : Boolean(ps.gliding || ps.frillGlide || isWardrobeGlidePreview);

    const extLandSquash = THREE.MathUtils.clamp(
      Number(ps.landSquash ?? ps.landImpact) || 0,
      0,
      1.35
    );
    const extSkidTimer = Math.max(0, Number(ps.skidTimer) || 0);
    const hasExtStairBob = ps.stairStepBob !== undefined && ps.stairStepBob !== null;
    const extStairBob = Number(ps.stairStepBob) || 0;

    // Detect heavy landing impact transitions
    if (!this._wasOnGround && onGround && this._lastVy < -1.5) {
      const impactMag = THREE.MathUtils.clamp((-this._lastVy - 1.2) / 11.5, 0.28, 1.0);
      this._landTimer = 0.22 + impactMag * 0.10;
      this._landSquash = Math.max(this._landSquash, impactMag);
      this._landSquashVel = Math.max(this._landSquashVel, impactMag * 4.5);
      this._tailPitchVel -= impactMag * 12.5;
      this._scarfPitchVel -= impactMag * 9.0;
      this._frillVel -= impactMag * 6.5;
    }
    if (extLandSquash > this._landSquash) {
      const deltaImp = extLandSquash - this._landSquash;
      this._landSquash = extLandSquash;
      this._tailPitchVel -= deltaImp * 9.5;
      this._scarfPitchVel -= deltaImp * 7.0;
    }
    this._wasOnGround = onGround;
    this._lastVy = vy;
    if (this._landTimer > 0) this._landTimer = Math.max(0, this._landTimer - safeDt);
    if (this._whipHoldTimer > 0) this._whipHoldTimer = Math.max(0, this._whipHoldTimer - safeDt);

    // 2nd-order damped spring recovery on landing compression
    const squashTarget = onGround ? extLandSquash * 0.85 : 0;
    const sqAccel = (squashTarget - this._landSquash) * 125.0 - this._landSquashVel * 14.5;
    this._landSquashVel += sqAccel * safeDt;
    this._landSquash = THREE.MathUtils.clamp(
      this._landSquash + this._landSquashVel * safeDt,
      -0.14,
      1.15
    );
    const landComp = Math.max(0, this._landSquash);

    // Turn-around counter-steer skid detection
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

    // 1. Select & Cross-Fade Among All 22 Skeletal Clips
    const hardClipOverride = opts?.clip || ps.clip || null;
    const animHint = typeof ps.anim === 'string' ? ps.anim : null;
    let wantClip = 'IdleBreathe';
    let fadeDur = 0.14;
    let timeScale = 1.0;

    const calcStrideTimeScale = (clipName, colSpeed) => {
      const worldMps = colSpeed * 1.323;
      const strideMeters = clipName === 'FluidRun' ? 1.52 : clipName === 'StairClimb' ? 1.27 : 1.05;
      const cyclesPerSec = worldMps / strideMeters;
      const clipDur = this.actions[clipName]?.getClip?.()?.duration || 1.0;
      return THREE.MathUtils.clamp(cyclesPerSec * clipDur, 0.16, 2.92);
    };

    if (hardClipOverride && typeof hardClipOverride === 'string') {
      const normOver = hardClipOverride.toLowerCase().replace(/[^a-z0-9]/g, '');
      if ((normOver === 'frillglide' || normOver === 'glide') && !isGliding) {
        wantClip = vy >= -0.5 ? 'AirRise' : 'Fall';
        fadeDur = vy >= -0.5 ? 0.07 : 0.13;
      } else {
        wantClip = hardClipOverride;
        fadeDur = 0.12;
        if (normOver.includes('run') || normOver.includes('walk') || normOver.includes('stair')) {
          const canon = normOver.includes('run') ? 'FluidRun' : normOver.includes('stair') ? 'StairClimb' : 'Walk';
          timeScale = speed > 0.05 ? calcStrideTimeScale(canon, speed) : 1.0;
        }
      }
    } else if (this._titleHopTimer > 0.01) {
      wantClip = 'Celebrate';
      fadeDur = 0.08;
      timeScale = 1.35;
    } else if (this._titleWaveTimer > 0.01) {
      wantClip = 'IdleCurious';
      fadeDur = 0.14;
      timeScale = 1.0;
    } else if (victory || animHint === 'Celebrate' || animHint === 'HeroCelebrate') {
      wantClip = 'Celebrate';
      fadeDur = 0.16;
    } else if (isCutscene || animHint === 'CutsceneHero') {
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
      if (springSomersault || animHint === 'SpringSomersault') {
        wantClip = 'SpringSomersault';
        fadeDur = 0.06;
        timeScale = 1.18;
      } else if (vy >= -0.5) {
        // Sync with calibrated apex hang (`bible_physics_touch.md` §4.4 #3: snappy 0.07s fade & hold through apex!)
        wantClip = 'AirRise';
        fadeDur = 0.07;
      } else {
        wantClip = 'Fall';
        fadeDur = 0.13;
      }
    } else if (wetShakeActive || animHint === 'WetShake') {
      wantClip = 'WetShake';
      fadeDur = 0.08;
      timeScale = 1.18;
    } else if (edgeTeeter > 0.15 || animHint === 'EdgeTeeter') {
      wantClip = 'EdgeTeeter';
      fadeDur = 0.10;
      timeScale = 1.12;
    } else if (this._landTimer > 0.02 && speed < 0.10) {
      wantClip = 'Land';
      fadeDur = 0.08;
    } else if (muzzleFlash > 0.02 && speed < 0.35) {
      wantClip = 'HydroCast';
      fadeDur = 0.09;
      timeScale = 1.25;
    } else if (animHint === 'StairClimb' && speed < 0.05) {
      wantClip = 'StairClimb';
      fadeDur = 0.12;
      timeScale = 1.0;
    } else if (onStairs && speed >= 0.10) {
      wantClip = 'StairClimb';
      fadeDur = 0.12;
      timeScale = calcStrideTimeScale('StairClimb', speed);
    } else if (speed > 1.25 || doorBlend > 0.05) {
      wantClip = 'FluidRun';
      fadeDur = 0.12;
      timeScale = calcStrideTimeScale('FluidRun', Math.max(speed, doorBlend * 2.4));
    } else if (speed >= 0.10 || this._pushBlend > 0.05) {
      wantClip = 'Walk';
      fadeDur = 0.14;
      timeScale = calcStrideTimeScale('Walk', Math.max(speed, this._pushBlend * 0.85));
    } else if (
      animHint === 'IdleCurious' ||
      (this._idleCuriosityTimer > 3.2 && this._idleCuriosityTimer % 7.5 < 2.2)
    ) {
      wantClip = 'IdleCurious';
      fadeDur = 0.20;
      timeScale = 0.92;
    }

    this.playAction(wantClip, fadeDur, timeScale);
    if (this.mixer) {
      this.mixer.update(safeDt);
    }

    if (this.skinnedMesh) {
      this.skinnedMesh.castShadow = true;
      this.skinnedMesh.receiveShadow = true;
    }

    // Grounded 2-bone Foot-IK eligibility (`< 0.05mm` drift across idle, curious wave, teeter, wet shake, cast & land!)
    const ikEligible =
      onGround &&
      !isSwimming &&
      !isSurfing &&
      !wallScamper &&
      !isMantling &&
      !isGliding &&
      !isCoreDive &&
      !victory &&
      this._titleHopTimer <= 0.01 &&
      this._activeClipName !== 'Celebrate' &&
      this._activeClipName !== 'StairClimb' &&
      speed < 0.10 &&
      whipTimer <= 0.01 &&
      this._whipHoldTimer <= 0.01 &&
      doorBlend <= 0.02;
    const ikWeight = ikEligible
      ? speed <= 0.02
        ? 1.0
        : THREE.MathUtils.clamp((0.10 - speed) / 0.08, 0, 1)
      : 0.0;

    // 2. Motion Root Heading Yaw, Stride Phase, Title Hop Arc & Squash/Stretch
    if ((onGround && speed >= 0.10) || doorBlend > 0.05) {
      const effColSpeed = Math.max(speed, doorBlend * 2.4);
      const strideM = wantClip === 'FluidRun' ? 1.52 : wantClip === 'StairClimb' ? 1.18 : 1.05;
      this._stridePhase += safeDt * ((effColSpeed * 1.323) / strideM) * Math.PI * 2;
    }

    let targetYaw = dir * (0.42 + speedNorm * 0.74);
    if (wallScamper) {
      targetYaw = Math.PI + dir * 0.12;
    } else if (isSwimming || isSurfing || isCoreDive) {
      targetYaw = ps.yawOverride != null ? Number(ps.yawOverride) : 0;
    } else if (isTitleShowcase) {
      // Face player warmly on Title Screen with subtle pointer lean!
      targetYaw = THREE.MathUtils.clamp(this._pointerGazeX * 0.28, -0.32, 0.32);
    } else if (victory || isCutscene) {
      targetYaw = Math.sin(time * 2.2) * 0.24;
    } else if (doorBlend > 0.001) {
      const doorYaw = dir >= 0 ? Math.PI : -Math.PI;
      targetYaw = THREE.MathUtils.lerp(targetYaw, doorYaw, Math.min(1, doorBlend * 1.35));
    }

    if (!this._yawSyncedToCaller && ps !== this._initDummyPoseState) {
      this._yawSyncedToCaller = true;
      this._yaw = targetYaw;
      this._prevYaw = targetYaw;
    }

    this._prevYaw = this._yaw;
    this._yaw = dampAngle(this._yaw, targetYaw, 15, safeDt);
    let yawVel = (this._yaw - this._prevYaw) / safeDt;
    yawVel = THREE.MathUtils.clamp(yawVel, -14, 14);

    // Interactive Title Hop joyful bounce arc + 360° celebratory spin!
    let titleHopY = 0;
    let titleHopSpin = 0;
    let titleHopSx = 1;
    let titleHopSy = 1;
    if (this._titleHopTimer > 0.001) {
      const uHop = 1 - this._titleHopTimer / this._titleHopDuration;
      const arc = Math.sin(uHop * Math.PI);
      titleHopY = arc * 0.26;
      titleHopSpin = uHop * Math.PI * 2;
      titleHopSy = 1 + arc * 0.12 - (uHop > 0.85 ? (1 - (1 - uHop) / 0.15) * 0.10 : 0);
      titleHopSx = 1 / Math.sqrt(Math.max(0.8, titleHopSy));
    }

    const baseSx = THREE.MathUtils.clamp((Number(ps.squashX) || 1) * titleHopSx, 0.84, 1.18);
    const baseSy = THREE.MathUtils.clamp((Number(ps.squashY) || 1) * titleHopSy, 0.82, 1.18);

    const motionRoot = this._motionRoot || this._standInGroup;
    if (motionRoot) {
      motionRoot.rotation.set(0, this._yaw + titleHopSpin, 0);
      const rawSx = THREE.MathUtils.clamp(baseSx * (1 + landComp * 0.085), 0.84, 1.22);
      const rawSy = THREE.MathUtils.clamp(baseSy * (1 - landComp * 0.095), 0.78, 1.20);
      const sx = THREE.MathUtils.lerp(rawSx, 1.0, ikWeight);
      const sy = THREE.MathUtils.lerp(rawSy, 1.0, ikWeight);
      motionRoot.scale.set(sx, sy, sx);
      motionRoot.position.set(0, titleHopY, -doorBlend * 0.34);
    }

    // Invulnerability bioluminescent pulse shimmer
    if (invuln > 0) {
      const pulse = 0.5 + 0.5 * Math.sin(time * 30);
      this.mainMat.emissiveIntensity = 0.85 + pulse * 0.85;
    } else if (this.mainMat.emissiveIntensity > 0.88) {
      this.mainMat.emissiveIntensity = 0.85;
    }

    // 3. Additive Spine Banking, Jump Pitch, Box-Push Lean, Skid & Landing Compression
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
    const airTrajectoryPitch =
      !onGround && !isGliding && !isSwimming && !isSurfing && !wallScamper && !isMantling && !springSomersault
        ? vy >= -0.5
          ? THREE.MathUtils.clamp(-vy * 0.018, -0.22, 0.05)
          : THREE.MathUtils.clamp((-vy - 0.5) * 0.020, 0, 0.22)
        : 0;
    const landTorsoPitch = landComp * 0.24;
    const skidTorsoPitch = this._skidBlend * 0.16;
    const pushTorsoPitch = this._pushBlend * 0.36;
    const totalTorsoPitch = hurtPitch + landTorsoPitch + skidTorsoPitch + airTrajectoryPitch + pushTorsoPitch;

    this._addBoneLocalEuler(b.Spine1, totalTorsoPitch * 0.42, skidLean * 0.14, this._bankRoll * 0.38);
    this._addBoneLocalEuler(b.Spine2, totalTorsoPitch * 0.32, skidLean * 0.12, this._bankRoll * 0.34);
    this._addBoneLocalEuler(b.Chest, totalTorsoPitch * 0.26, skidLean * 0.10, this._bankRoll * 0.28);

    if (this._pushBlend > 0.02) {
      const pb = this._pushBlend;
      this._addBoneLocalEuler(b.ClavicleL, 0.14 * pb, 0, 0);
      this._addBoneLocalEuler(b.ClavicleR, 0.14 * pb, 0, 0);
      this._addBoneLocalEuler(b.UpperArmL, 0.92 * pb, 0, 0.16 * pb);
      this._addBoneLocalEuler(b.UpperArmR, 0.92 * pb, 0, -0.16 * pb);
      this._addBoneLocalEuler(b.ForearmL, 0.28 * pb, 0, 0);
      this._addBoneLocalEuler(b.ForearmR, 0.28 * pb, 0, 0);
      this._addBoneLocalEuler(b.HandL, -0.52 * pb, 0, 0);
      this._addBoneLocalEuler(b.HandR, -0.52 * pb, 0, 0);
      this._addBoneLocalEuler(b.Head, -0.22 * pb, 0, 0);
    }

    // 3b. Landing Compression + Skid Crouch Pelvis Drop & Stair Step Hints
    const stairActive = onGround && onStairs && speed > 0.08 ? 1 : 0;
    const rawStairBob = stairActive
      ? hasExtStairBob
        ? THREE.MathUtils.clamp(extStairBob, -1.0, 1.0)
        : Math.sin(this._stridePhase * 1.15) * 0.5
      : 0;
    this._stairBobSmooth = damp(this._stairBobSmooth, rawStairBob, 24, safeDt);

    if (b.Pelvis) {
      const landPelvisDrop = -landComp * 0.085;
      const skidPelvisDrop = -this._skidBlend * 0.042;
      const pushPelvisDrop = -this._pushBlend * 0.032;
      const ikSquashDrop = ikWeight * THREE.MathUtils.clamp((baseSy - 1) * 0.22, -0.06, 0.0);
      const stairPelvisDelta = stairActive ? this._stairBobSmooth * 0.038 - 0.014 : 0;
      const pelvisDeltaY = landPelvisDrop + skidPelvisDrop + pushPelvisDrop + ikSquashDrop + stairPelvisDelta;
      if (this._glbApplied) {
        b.Pelvis.position.y += pelvisDeltaY;
      } else if (!ikEligible) {
        b.Pelvis.position.y = this._pelvisBindY + pelvisDeltaY;
      } else {
        b.Pelvis.position.y += pelvisDeltaY;
      }
      if (stairActive) {
        const weightShift = Math.sin(this._stridePhase) * 0.095;
        this._addBoneLocalEuler(b.Pelvis, 0.05 * (stairSlope >= 0 ? 1 : -0.6), 0, weightShift);
      }
    }

    const legRxSign = this._glbApplied ? -1 : 1;

    if (landComp > 0.015) {
      this._addBoneLocalEuler(b.ThighL, -0.52 * landComp * legRxSign, 0, -0.08 * landComp);
      this._addBoneLocalEuler(b.ThighR, -0.52 * landComp * legRxSign, 0, 0.08 * landComp);
      this._addBoneLocalEuler(b.ShinL, 0.88 * landComp * legRxSign, 0, 0);
      this._addBoneLocalEuler(b.ShinR, 0.88 * landComp * legRxSign, 0, 0);
      this._addBoneLocalEuler(b.AnkleL, -0.34 * landComp * legRxSign, 0, 0);
      this._addBoneLocalEuler(b.AnkleR, -0.34 * landComp * legRxSign, 0, 0);
      this._addBoneLocalEuler(b.UpperArmL, 0.18 * landComp, 0, 0.28 * landComp);
      this._addBoneLocalEuler(b.UpperArmR, 0.18 * landComp, 0, -0.28 * landComp);
    }

    if (this._skidBlend > 0.02) {
      const sb = this._skidBlend;
      const leadL = this._skidDir > 0;
      const leadThigh = leadL ? b.ThighL : b.ThighR;
      const leadShin = leadL ? b.ShinL : b.ShinR;
      const leadAnkle = leadL ? b.AnkleL : b.AnkleR;
      const trailThigh = leadL ? b.ThighR : b.ThighL;
      const trailShin = leadL ? b.ShinR : b.ShinL;
      this._addBoneLocalEuler(leadThigh, -0.42 * sb * legRxSign, 0, 0);
      this._addBoneLocalEuler(leadShin, -0.14 * sb * legRxSign, 0, 0);
      this._addBoneLocalEuler(leadAnkle, 0.24 * sb * legRxSign, 0, 0);
      this._addBoneLocalEuler(trailThigh, 0.32 * sb * legRxSign, 0, 0);
      this._addBoneLocalEuler(trailShin, 0.48 * sb * legRxSign, 0, 0);
      this._addBoneLocalEuler(b.UpperArmL, -0.26 * sb * this._skidDir, 0, 0.24 * sb);
      this._addBoneLocalEuler(b.UpperArmR, 0.26 * sb * this._skidDir, 0, -0.24 * sb);
    }

    // 4. Discrete 5-Riser Stair Stepping
    if (stairActive > 0) {
      const ascending = stairSlope >= 0;
      const slopeSign = ascending ? 1 : -1;
      const bobBoost = hasExtStairBob ? Math.abs(this._stairBobSmooth) * 0.55 : 0.35;
      const lCycle = Math.sin(this._stridePhase);
      const lLift = Math.max(0, lCycle) * (0.45 + bobBoost);
      const rLift = Math.max(0, -lCycle) * (0.45 + bobBoost);

      if (ascending) {
        this._addBoneLocalEuler(b.ThighL, -0.58 * lLift * legRxSign, 0, 0);
        this._addBoneLocalEuler(b.ShinL, 0.86 * lLift * legRxSign, 0, 0);
        this._addBoneLocalEuler(b.AnkleL, (-0.24 * lLift + lCycle * 0.16) * legRxSign, 0, 0);
        this._addBoneLocalEuler(b.FootL, -lCycle * 0.14 * legRxSign, 0, 0);
        this._addBoneLocalEuler(b.ThighR, -0.58 * rLift * legRxSign, 0, 0);
        this._addBoneLocalEuler(b.ShinR, 0.86 * rLift * legRxSign, 0, 0);
        this._addBoneLocalEuler(b.AnkleR, (-0.24 * rLift - lCycle * 0.16) * legRxSign, 0, 0);
        this._addBoneLocalEuler(b.FootR, lCycle * 0.14 * legRxSign, 0, 0);
      } else {
        this._addBoneLocalEuler(b.ThighL, -0.24 * lLift * legRxSign, 0, 0);
        this._addBoneLocalEuler(b.ShinL, 0.52 * (0.35 + lLift) * legRxSign, 0, 0);
        this._addBoneLocalEuler(b.AnkleL, lCycle * 0.16 * slopeSign * legRxSign, 0, 0);
        this._addBoneLocalEuler(b.FootL, -lCycle * 0.14 * slopeSign * legRxSign, 0, 0);
        this._addBoneLocalEuler(b.ThighR, -0.24 * rLift * legRxSign, 0, 0);
        this._addBoneLocalEuler(b.ShinR, 0.52 * (0.35 + rLift) * legRxSign, 0, 0);
        this._addBoneLocalEuler(b.AnkleR, -lCycle * 0.16 * slopeSign * legRxSign, 0, 0);
        this._addBoneLocalEuler(b.FootR, lCycle * 0.14 * slopeSign * legRxSign, 0, 0);
      }
    }

    // 5. 6-Mood Live Facial Expression Controller + Organic Blinking + Live Eye-Look Tracking!
    const targetMood = this._resolveTargetMood(ps, {
      hurtTimer,
      edgeTeeter,
      victory,
      springSomersault,
      whipTimer,
      muzzleFlash,
      wallScamper,
      isCoreDive,
      pushingBox,
      speed,
      isTitleShowcase,
      onGround,
    });
    this.currentMood = targetMood;
    const mSpec = MOOD_TARGETS[targetMood] || MOOD_TARGETS.happy;
    const fs = this._faceState;
    const fLambda = 16;
    fs.uLidL = damp(fs.uLidL, mSpec.uLidL, fLambda, safeDt);
    fs.uLidR = damp(fs.uLidR, mSpec.uLidR, fLambda, safeDt);
    fs.lLidL = damp(fs.lLidL, mSpec.lLidL, fLambda, safeDt);
    fs.lLidR = damp(fs.lLidR, mSpec.lLidR, fLambda, safeDt);
    fs.browYL = damp(fs.browYL, mSpec.browYL, fLambda, safeDt);
    fs.browYR = damp(fs.browYR, mSpec.browYR, fLambda, safeDt);
    fs.browRollL = damp(fs.browRollL, mSpec.browRollL, fLambda, safeDt);
    fs.browRollR = damp(fs.browRollR, mSpec.browRollR, fLambda, safeDt);
    fs.jaw = damp(fs.jaw, mSpec.jaw, fLambda, safeDt);
    fs.smileY = damp(fs.smileY, mSpec.smileY, fLambda, safeDt);
    fs.frill = damp(fs.frill, mSpec.frill, 12, safeDt);

    // Live Eye-Look & Head Gaze Tracking (threats/collectibles/pointer/camera!)
    let wantHeadYaw = 0;
    let wantHeadPitch = 0;
    if (isTitleShowcase && this._pointerGazeActive) {
      wantHeadYaw = THREE.MathUtils.clamp(this._pointerGazeX * 0.44, -0.48, 0.48);
      wantHeadPitch = THREE.MathUtils.clamp(-this._pointerGazeY * 0.30, -0.32, 0.32);
    } else if (ps.lookTarget && typeof ps.lookTarget === 'object') {
      wantHeadYaw = THREE.MathUtils.clamp(
        Number(ps.lookTarget.dTheta ?? ps.lookTarget.yaw ?? ps.lookTarget.x) || 0,
        -0.55,
        0.55
      );
      wantHeadPitch = THREE.MathUtils.clamp(
        Number(ps.lookTarget.dy ?? ps.lookTarget.pitch ?? ps.lookTarget.y) || 0,
        -0.36,
        0.36
      );
    } else if (this._pointerGazeActive) {
      wantHeadYaw = THREE.MathUtils.clamp(this._pointerGazeX * 0.38, -0.44, 0.44);
      wantHeadPitch = THREE.MathUtils.clamp(-this._pointerGazeY * 0.26, -0.28, 0.28);
    } else if (onGround && speed < 0.2 && !victory) {
      wantHeadYaw = Math.sin(time * 1.15) * 0.14;
      wantHeadPitch = Math.cos(time * 1.65) * 0.05;
    }

    this._headLookYaw = damp(this._headLookYaw, wantHeadYaw, 10, safeDt);
    this._headLookPitch = damp(this._headLookPitch, wantHeadPitch, 10, safeDt);
    // Eyes lead head faster (crisp Pixar eye-dart!)
    this._eyeLookYaw = damp(this._eyeLookYaw, wantHeadYaw, 22, safeDt);
    this._eyeLookPitch = damp(this._eyeLookPitch, wantHeadPitch, 22, safeDt);

    this._addBoneLocalEuler(b.Neck, this._headLookPitch * 0.28, this._headLookYaw * 0.28, 0);
    this._addBoneLocalEuler(
      b.Head,
      this._headLookPitch * 0.56,
      this._headLookYaw * 0.56,
      -this._bankRoll * 0.32
    );

    // Reset facial bones cleanly to bind rest pose before applying crisp 6-mood expression + blink + eye-look!
    const blinkVal = this._updateOrganicBlink(safeDt);
    const applyBindReset = (name) => {
      const bone = b[name];
      const bind = this._faceBind[name];
      if (!bone || !bind) return null;
      bone.position.copy(bind.pos);
      bone.quaternion.copy(bind.quat);
      return bone;
    };

    const eyeL = applyBindReset('EyeL');
    const eyeR = applyBindReset('EyeR');
    const eyeYawClamped = THREE.MathUtils.clamp(this._eyeLookYaw * 0.45, -0.28, 0.28);
    const eyePitchClamped = THREE.MathUtils.clamp(this._eyeLookPitch * 0.38, -0.22, 0.22);
    if (this._glbApplied) {
      // gateway.glb EyeL/EyeR bones have local +Y = pupil forward, +Z = up, +X = right-inverted:
      // yaw rotates around local Z, pitch rotates around local -X so pupils truly track horizontally & vertically!
      this._addBoneLocalEuler(eyeL, -eyePitchClamped, 0, eyeYawClamped);
      this._addBoneLocalEuler(eyeR, -eyePitchClamped, 0, eyeYawClamped);
    } else {
      this._addBoneLocalEuler(eyeL, eyePitchClamped, eyeYawClamped, 0);
      this._addBoneLocalEuler(eyeR, eyePitchClamped, eyeYawClamped, 0);
    }

    const uLidL = applyBindReset('EyelidL');
    const uLidR = applyBindReset('EyelidR');
    const blinkClose = blinkVal * 0.92;
    const effULidL = THREE.MathUtils.clamp(blinkVal > 0.001 ? Math.max(fs.uLidL, blinkClose) : fs.uLidL, -0.32, 0.96);
    const effULidR = THREE.MathUtils.clamp(blinkVal > 0.001 ? Math.max(fs.uLidR, blinkClose) : fs.uLidR, -0.32, 0.96);
    this._addBoneLocalEuler(uLidL, effULidL, 0, 0);
    this._addBoneLocalEuler(uLidR, effULidR, 0, 0);

    const lLidL = applyBindReset('LowerLidL');
    const lLidR = applyBindReset('LowerLidR');
    this._addBoneLocalEuler(lLidL, THREE.MathUtils.clamp(fs.lLidL, -0.18, 0.72), 0, 0);
    this._addBoneLocalEuler(lLidR, THREE.MathUtils.clamp(fs.lLidR, -0.18, 0.72), 0, 0);

    const browL = applyBindReset('BrowL');
    const browR = applyBindReset('BrowR');
    if (browL) {
      browL.position.y += fs.browYL;
      this._addBoneLocalEuler(browL, 0, fs.browRollL, 0);
    }
    if (browR) {
      browR.position.y += fs.browYR;
      this._addBoneLocalEuler(browR, 0, fs.browRollR, 0);
    }

    const jaw = applyBindReset('Jaw');
    if (jaw && Math.abs(fs.jaw) > 0.002) {
      this._addBoneLocalEuler(jaw, fs.jaw, 0, 0);
    }
    const mouthSmile = applyBindReset('MouthSmile');
    if (mouthSmile) {
      mouthSmile.position.y += fs.smileY;
    }

    // 6. 2nd-Order Spring-Damped 6-Frill Coral Ear-Frill Physics (`FrillL1/L2/FrillBotL`, `FrillR1/R2/FrillBotR`)!
    // Substep-stabilized spring + strict bind-relative clamp guarantees frills fan outward/slightly back
    // and NEVER fold forward (+Z) across Gateway's face/eyes in ANY animation or FPS step!
    const extFlare = THREE.MathUtils.clamp(Number(ps.frillFlare) || 0, -0.35, 0.55);
    const targetFrill = THREE.MathUtils.clamp(
      Math.max(
        extFlare * 0.45,
        isGliding
          ? 0.24
          : !onGround
            ? 0.08 + THREE.MathUtils.clamp(-vy * 0.012, 0, 0.14)
            : muzzleFlash > 0.01 || whipTimer > 0.01
              ? 0.22
              : this._skidBlend * 0.18 + fs.frill * 0.28
      ),
      -0.28,
      0.32
    );
    const springDt = Math.min(safeDt, 0.025);
    const frillAcc = (targetFrill - this._frillFlare) * 95.0 - this._frillVel * 13.5;
    this._frillVel = THREE.MathUtils.clamp(this._frillVel + frillAcc * springDt, -3.5, 3.5);
    this._frillFlare = THREE.MathUtils.clamp(this._frillFlare + this._frillVel * springDt, -0.28, 0.34);
    const frillAero = THREE.MathUtils.clamp(
      (isGliding ? Math.sin(time * 24) * 0.048 : !onGround ? Math.sin(time * 18) * 0.024 : Math.sin(time * 3.8) * 0.018) +
        this._frillFlare -
        landComp * 0.22,
      -0.30,
      0.32
    );
    if (Math.abs(frillAero) > 0.004) {
      this._addBoneLocalEuler(b.FrillL1, frillAero * 0.34, 0, 0);
      this._addBoneLocalEuler(b.FrillL2, frillAero * 0.42, 0, 0);
      this._addBoneLocalEuler(b.FrillBotL, frillAero * 0.36, 0, 0);
      this._addBoneLocalEuler(b.FrillR1, frillAero * 0.34, 0, 0);
      this._addBoneLocalEuler(b.FrillR2, frillAero * 0.42, 0, 0);
      this._addBoneLocalEuler(b.FrillBotR, frillAero * 0.36, 0, 0);
    }

    // Strict bind-relative clamp on ALL 6 Frill* bones after mixer + spring pass!
    for (let fi = 0; fi < FRILL_BONE_CLAMPS.length; fi++) {
      const [bn, minRx, maxRx, maxRy, maxRz] = FRILL_BONE_CLAMPS[fi];
      const bone = b[bn];
      const bind = this._frillBind?.[bn];
      if (!bone || !bind) continue;
      this._qScratchA.multiplyQuaternions(bind.invQuat, bone.quaternion).normalize();
      this._eScratch.setFromQuaternion(this._qScratchA, 'XYZ');
      const cx = THREE.MathUtils.clamp(this._eScratch.x, minRx, maxRx);
      const cy = THREE.MathUtils.clamp(this._eScratch.y, -maxRy, maxRy);
      const cz = THREE.MathUtils.clamp(this._eScratch.z, -maxRz, maxRz);
      this._eScratch.set(cx, cy, cz, 'XYZ');
      this._qScratchB.setFromEuler(this._eScratch);
      bone.quaternion.multiplyQuaternions(bind.quat, this._qScratchB);
    }

    // 7. 2nd-Order Spring-Damped 4-Bone Flowing Sea-Silk Scarf Physics (`ScarfL1/L2`, `ScarfR1/R2`)!
    const scarfSpringK = 78.0;
    const scarfDamp = 8.4;
    const scarfPitchTarget = THREE.MathUtils.clamp(
      speedNorm * 0.44 - vy * 0.042 + (isGliding ? 0.50 : 0) - landComp * 0.32,
      -0.65,
      0.78
    );
    const scarfYawTarget = THREE.MathUtils.clamp(
      yawVel * 0.048 + skidLean * 0.44 + (whipTimer > 0 ? 0.55 : 0),
      -0.75,
      0.75
    );
    this._scarfPitchVel += ((scarfPitchTarget - this._scarfPitchLag) * scarfSpringK - this._scarfPitchVel * scarfDamp) * safeDt;
    this._scarfPitchLag = THREE.MathUtils.clamp(this._scarfPitchLag + this._scarfPitchVel * safeDt, -0.75, 0.85);
    this._scarfYawVel += ((scarfYawTarget - this._scarfYawLag) * scarfSpringK - this._scarfYawVel * scarfDamp) * safeDt;
    this._scarfYawLag = THREE.MathUtils.clamp(this._scarfYawLag + this._scarfYawVel * safeDt, -0.82, 0.82);

    const breezeFreq = 4.6 + speedNorm * 6.5 + (isGliding ? 5.0 : 0);
    const breezeAmp = 0.055 + speedNorm * 0.085 + (isGliding ? 0.08 : 0);
    const flutterL1 = Math.sin(time * breezeFreq) * breezeAmp;
    const flutterL2 = Math.sin(time * breezeFreq - 0.95) * breezeAmp * 1.45;
    const flutterR1 = Math.sin(time * breezeFreq + 0.75) * breezeAmp;
    const flutterR2 = Math.sin(time * breezeFreq - 0.25) * breezeAmp * 1.45;
    this._addBoneLocalEuler(b.ScarfL1, this._scarfPitchLag * 0.55 + flutterL1, 0, this._scarfYawLag * 0.52 + flutterL1 * 0.6);
    this._addBoneLocalEuler(b.ScarfL2, this._scarfPitchLag * 0.72 + flutterL2, 0, this._scarfYawLag * 0.76 + flutterL2 * 0.7);
    this._addBoneLocalEuler(b.ScarfR1, this._scarfPitchLag * 0.52 + flutterR1, 0, this._scarfYawLag * 0.50 + flutterR1 * 0.6);
    this._addBoneLocalEuler(b.ScarfR2, this._scarfPitchLag * 0.68 + flutterR2, 0, this._scarfYawLag * 0.72 + flutterR2 * 0.7);

    // 8. Upper-Body Run-And-Cast Additive Layer + Hydro-Caster Palm Flash
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

    // 9. 2nd-Order Spring-Damped 7-Bone Plush Tail Physics (`Tail1`..`Tail7`)!
    const tailSpringK = 92.0;
    const tailDamp = 9.2;
    const yawImpulse = THREE.MathUtils.clamp(yawVel * 0.042 + skidLean * 0.34, -0.62, 0.62);
    const pitchImpulse = THREE.MathUtils.clamp(-vy * 0.036 - landComp * 0.52, -0.62, 0.52);

    this._tailYawVel += ((yawImpulse - this._tailYawLag) * tailSpringK - this._tailYawVel * tailDamp) * safeDt;
    this._tailYawLag = THREE.MathUtils.clamp(this._tailYawLag + this._tailYawVel * safeDt, -0.62, 0.62);

    this._tailPitchVel += ((pitchImpulse - this._tailPitchLag) * tailSpringK - this._tailPitchVel * tailDamp) * safeDt;
    this._tailPitchLag = THREE.MathUtils.clamp(this._tailPitchLag + this._tailPitchVel * safeDt, -0.58, 0.52);

    const swimExtra = Number(ps.swimPhase) || 0;
    const happyWagBoost = targetMood === 'joyful' ? 1.45 : isTitleShowcase ? 1.25 : 1.0;
    for (let ti = 1; ti <= 7; ti++) {
      const tBone = b[`Tail${ti}`];
      if (!tBone) continue;
      const chainGain = 0.16 + ti * 0.055;
      const sWave =
        Math.sin(time * (4.4 + speedNorm * 4.5) - ti * 0.62 + swimExtra) *
        (0.038 + speedNorm * 0.055) *
        happyWagBoost;
      const addRx = this._tailPitchLag * chainGain;
      const addRz = this._tailYawLag * chainGain + sWave;
      this._addBoneLocalEuler(tBone, addRx, 0, addRz);
    }

    // 10. Sovereign Starlight Prestige Orbiting Aurora Droplets
    if (this._starMotesGroup && this._starMotesGroup.visible && this._starMoteInst) {
      const dm = this._moteDummy;
      for (let i = 0; i < 6; i++) {
        const a = time * 1.65 + (i * Math.PI * 2) / 6;
        const rad = 0.27 + Math.sin(time * 2.2 + i) * 0.035;
        dm.position.set(
          Math.cos(a) * rad,
          0.05 + Math.sin(time * 2.6 + i * 1.3) * 0.12,
          Math.sin(a) * rad
        );
        dm.rotation.set(time * 1.8 + i, a + time * 1.4, Math.sin(time * 2.1 + i) * 0.35);
        dm.scale.setScalar(0.72 + Math.sin(time * 4.2 + i * 2) * 0.22);
        dm.updateMatrix();
        this._starMoteInst.setMatrixAt(i, dm.matrix);
      }
      this._starMoteInst.instanceMatrix.needsUpdate = true;
    }

    // 11. Final Pass: Analytic 2-Bone Leg IK — locks `FootL` & `FootR` flat on `y = 0.000m` (`< 0.05mm` drift!)
    if (ikWeight > 0.001 && motionRoot) {
      this._solveGroundedTwoBoneLegIk(motionRoot, ikWeight);
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
