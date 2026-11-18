// ============================================================================
// TOWERING WATERS: GATEWAY'S DESCENT — LEAD 3D GRAPHICS COMPOSITOR (`src/renderer.js`)
// ============================================================================
// Unified Console-AAA WebGL2 PBR, Real-Time Shadow & Signature Mini-Game Compositor:
//   1. Synchronized V3 World Scale: `COLS = 20`, `TOWER_RADIUS = 3.75`, `FLOOR_HEIGHT = 1.50`
//   2. `GatewayRig` (`./gateway.js`): 39-bone weight-painted `SkinnedMesh` female alien hydro-lizard
//   3. 5-Biome Daylight / Alpenglow / Sunset / Lagoon / Aurora PBR Lighting + Sky-Tinted `PMREM` IBL
//   4. `2048x2048` `PCFSoftShadowMap` tight vertical-band shadow frustum grounding every 5-riser
//      staircase tread, balustrade handrail, mechanical elevator shaft, enemy, and Gateway
//   5. Dynamic aspect-calibrated Third-Person Camera (`9:19.5` portrait, `20:9` landscape, tablet,
//      `1080p` desktop) + sweeping Cutscene Crane & Spire Purification Water-Eruption Shots
//   6. 5 Signature Gateway Mini-Games: `core_descent`, `reef_swim`, `rapids_surf`, `frill_glide`,
//      and `aqueduct_sanctum` (`puzzle` + `vault`)
// ============================================================================

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { mergeGeometries as _rawMergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { GatewayRig } from './gateway.js';
import { COLS as _LEVEL_COLS } from './levels.js';
import { GlideRenderer } from './glideRenderer.js';
import { PuzzleRenderer } from './puzzleRenderer.js';
import { CinematicPostFX, resolvePostFxBiome } from './postfx.js';
import { EnemyVisualPool } from './enemyRig.js';
import { StormAtmosphere } from './stormSky.js';
import { TowerFluidAndSparkVFX } from './oceanVfx.js';
import {
  buildDetailedTowerGroup,
  updateTowerArchitecture,
  disposeTowerArchitecture,
  resolveRebootTheme as resolveArchTheme,
} from './towerArchitecture.js';
import { SkimmerRenderer } from './skimmerRenderer.js';
import { VaultRenderer } from './vaultRenderer.js';
import { Ocean } from './water.js';
import { SubRenderer } from './subRenderer.js';

void _LEVEL_COLS;
export const COLS = 20;
export const TOWER_RADIUS = 3.75;
export const FLOOR_HEIGHT = 1.50;

const TWO_PI = Math.PI * 2;
const COL_ANGLE = TWO_PI / COLS;
const LEDGE_STAND_OFFSET = 0.46; // Exact centerline match with `towerArchitecture.js` `LEDGE_OFFSET`
const LIFT_STAND_OFFSET = 0.48;  // Exact centerline match with `towerArchitecture.js` `LIFT_OFFSET`
const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

const HYDRO_FX_STYLES = {
  standard_cryo: {
    core: '#e0f2fe',
    emissive: '#38bdf8',
    muzzle: '#7dd3fc',
    trail: '#bae6fd',
    ring: '#5efce8',
    shape: 'icosa',
  },
  tidal_pearl: {
    core: '#f0fdfa',
    emissive: '#2dd4bf',
    muzzle: '#5efce8',
    trail: '#99f6e4',
    ring: '#67e8f9',
    shape: 'icosa',
  },
  emerald_plasma: {
    core: '#ecfdf5',
    emissive: '#10b981',
    muzzle: '#34d399',
    trail: '#6ee7b7',
    ring: '#5efce8',
    shape: 'icosa',
  },
  solar_ember: {
    core: '#fef9c3',
    emissive: '#f59e0b',
    muzzle: '#fbbf24',
    trail: '#fde68a',
    ring: '#fde047',
    shape: 'icosa',
  },
  amethyst_void: {
    core: '#fae8ff',
    emissive: '#a855f7',
    muzzle: '#e879f9',
    trail: '#d8b4fe',
    ring: '#c084fc',
    shape: 'prism',
  },
  coral_bloom: {
    core: '#ffe4e6',
    emissive: '#fb7185',
    muzzle: '#f472b6',
    trail: '#fda4af',
    ring: '#5efce8',
    shape: 'prism',
  },
  diamond_prism: {
    core: '#ffffff',
    emissive: '#67e8f9',
    muzzle: '#f0abfc',
    trail: '#a5f3fc',
    ring: '#fde047',
    shape: 'prism',
    prismatic: true,
  },
};

// 5 Console-AAA Earth Watershed Daylight / Alpenglow / Twilight / Lagoon / Aurora Lighting Rigs
const BIOME_LIGHT_RIGS = Object.freeze({
  canyon_river: Object.freeze({
    bg: '#489cd6',
    fog: '#a7dce8',
    fogNear: 46,
    fogFar: 152,
    hemiSky: '#cbeafe',
    hemiGround: '#a85238',
    hemiInt: 0.96,
    sunCol: '#fff3d1',
    sunInt: 2.52,
    sunPos: [11.2, 14.5, 11.4],
    fillCol: '#2dd4bf',
    fillInt: 0.62,
    rimCol: '#fde68a',
    rimInt: 1.04,
    glintCol: '#fef08a',
    glintInt: 1.28,
    envInt: 0.68,
  }),
  alpine_lake: Object.freeze({
    bg: '#3b82d6',
    fog: '#d8ecff',
    fogNear: 50,
    fogFar: 162,
    hemiSky: '#e0f2fe',
    hemiGround: '#5b6f86',
    hemiInt: 1.02,
    sunCol: '#fff7ed',
    sunInt: 2.48,
    sunPos: [-10.8, 15.2, 11.6],
    fillCol: '#38bdf8',
    fillInt: 0.68,
    rimCol: '#fbcfe8',
    rimInt: 1.08,
    glintCol: '#e0f2fe',
    glintInt: 1.32,
    envInt: 0.72,
  }),
  mist_bayou: Object.freeze({
    bg: '#4338ca',
    fog: '#d98a6c',
    fogNear: 42,
    fogFar: 140,
    hemiSky: '#fdba74',
    hemiGround: '#1b4d46',
    hemiInt: 0.88,
    sunCol: '#fed7aa',
    sunInt: 2.26,
    sunPos: [12.0, 10.6, 10.8],
    fillCol: '#34d399',
    fillInt: 0.74,
    rimCol: '#fde047',
    rimInt: 1.06,
    glintCol: '#fdba74',
    glintInt: 1.18,
    envInt: 0.62,
  }),
  coral_sea: Object.freeze({
    bg: '#0ea5e9',
    fog: '#a5f3fc',
    fogNear: 52,
    fogFar: 168,
    hemiSky: '#ecfeff',
    hemiGround: '#0891b2',
    hemiInt: 1.08,
    sunCol: '#fffbeb',
    sunInt: 2.62,
    sunPos: [8.8, 16.4, 11.2],
    fillCol: '#22d3ee',
    fillInt: 0.82,
    rimCol: '#67e8f9',
    rimInt: 1.02,
    glintCol: '#ffffff',
    glintInt: 1.42,
    envInt: 0.75,
  }),
  storm_ocean: Object.freeze({
    bg: '#102a45',
    fog: '#194a69',
    fogNear: 40,
    fogFar: 142,
    hemiSky: '#7dd3fc',
    hemiGround: '#0c3b5e',
    hemiInt: 0.86,
    sunCol: '#e0f2fe',
    sunInt: 2.24,
    sunPos: [10.4, 13.2, 11.4],
    fillCol: '#2dd4bf',
    fillInt: 0.78,
    rimCol: '#c084fc',
    rimInt: 1.18,
    glintCol: '#a5f3fc',
    glintInt: 1.35,
    envInt: 0.58,
  }),
});

const HYDRO_DEFAULT_HEXES = new Set([
  '#e0f2fe',
  '#bae6fd',
  '#7dd3fc',
  '#38bdf8',
  '#67e8f9',
  '#a5f3fc',
  '#cffafe',
  '#5efce8',
]);

function mergeRigidGeos(parts) {
  const normalized = parts.map((g) => (g.index ? g.toNonIndexed() : g));
  const merged = _rawMergeGeometries(normalized, false);
  for (let i = 0; i < parts.length; i++) {
    if (normalized[i] !== parts[i]) normalized[i].dispose();
    parts[i].dispose();
  }
  return merged;
}

function wrapAngle(a) {
  let res = a % TWO_PI;
  if (res > Math.PI) res -= TWO_PI;
  if (res < -Math.PI) res += TWO_PI;
  return res;
}

function writeShakeOffset(shake, time, out) {
  if (!shake) {
    out.x = 0;
    out.y = 0;
    return out;
  }
  if (typeof shake === 'object') {
    out.x = (shake.x || 0) * 0.025;
    out.y = (shake.y || 0) * 0.025;
    return out;
  }
  const mag = (Number(shake) || 0) * 0.025;
  if (mag <= 0.001) {
    out.x = 0;
    out.y = 0;
    return out;
  }
  out.x = Math.sin(time * 73.7) * mag;
  out.y = Math.cos(time * 61.3) * mag * 0.85;
  return out;
}

function createGlowDotTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  const g = ctx.createRadialGradient(32, 32, 1, 32, 32, 30);
  g.addColorStop(0, 'rgba(255, 255, 255, 1)');
  g.addColorStop(0.28, 'rgba(220, 252, 255, 0.80)');
  g.addColorStop(0.62, 'rgba(94, 252, 232, 0.24)');
  g.addColorStop(1, 'rgba(94, 252, 232, 0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createWatershedTabletTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 192;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#0c2738';
  ctx.fillRect(0, 0, 128, 192);

  // Pelagian sea-glass & gold aqueduct stele border
  ctx.strokeStyle = '#5efce8';
  ctx.lineWidth = 3;
  ctx.strokeRect(10, 10, 108, 172);
  ctx.strokeStyle = 'rgba(250, 204, 21, 0.78)';
  ctx.lineWidth = 1.6;
  ctx.strokeRect(17, 17, 94, 158);

  // Harmonic Water Droplet Crest
  ctx.fillStyle = '#5efce8';
  ctx.beginPath();
  ctx.moveTo(64, 38);
  ctx.quadraticCurveTo(86, 64, 64, 84);
  ctx.quadraticCurveTo(42, 64, 64, 38);
  ctx.closePath();
  ctx.fill();

  const rows = [104, 118, 132, 146, 160];
  const widths = [74, 58, 68, 46, 62];
  for (let i = 0; i < rows.length; i++) {
    const ry = rows[i];
    const rw = widths[i];
    ctx.fillStyle = i % 2 === 0 ? '#5efce8' : '#38bdf8';
    ctx.fillRect(27, ry, rw * 0.58, 4.5);
    ctx.fillRect(27 + rw * 0.66, ry, rw * 0.34, 4.5);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createPopupTexture(text, color) {
  const canvas = document.createElement('canvas');
  canvas.width = 288;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  ctx.font = '800 26px Outfit, Orbitron, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineWidth = 6.5;
  ctx.strokeStyle = 'rgba(4, 14, 28, 0.92)';
  ctx.strokeText(text, 144, 32);
  ctx.fillStyle = color || '#fde047';
  ctx.fillText(text, 144, 32);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/**
 * Generates a sky-and-ground tinted HDR PMREM IBL cubemap for a given Earth Water Biome
 * so wet stone staircases, brass elevators, glass conduits & Gateway's scales reflect natural sunlight!
 */
function buildBiomePmremTexture(webgl, rigSpec) {
  try {
    const pmrem = new THREE.PMREMGenerator(webgl);
    const envScene = new THREE.Scene();
    envScene.background = new THREE.Color(rigSpec.bg);

    const skyDome = new THREE.Mesh(
      new THREE.SphereGeometry(18, 20, 12, 0, TWO_PI, 0, Math.PI * 0.5),
      new THREE.MeshBasicMaterial({ color: rigSpec.hemiSky, side: THREE.BackSide })
    );
    const groundBowl = new THREE.Mesh(
      new THREE.SphereGeometry(18, 20, 12, 0, TWO_PI, Math.PI * 0.5, Math.PI * 0.5),
      new THREE.MeshBasicMaterial({ color: rigSpec.hemiGround, side: THREE.BackSide })
    );
    const sunCard = new THREE.Mesh(
      new THREE.SphereGeometry(2.6, 12, 10),
      new THREE.MeshBasicMaterial({ color: rigSpec.sunCol })
    );
    sunCard.position.set(rigSpec.sunPos[0], rigSpec.sunPos[1], rigSpec.sunPos[2]);
    const waterCard = new THREE.Mesh(
      new THREE.RingGeometry(4, 16, 20),
      new THREE.MeshBasicMaterial({ color: rigSpec.fillCol, side: THREE.DoubleSide })
    );
    waterCard.rotation.x = -Math.PI * 0.5;
    waterCard.position.y = -3.0;

    envScene.add(skyDome, groundBowl, sunCard, waterCard);
    const tex = pmrem.fromScene(envScene, 0.035).texture;
    skyDome.geometry.dispose();
    skyDome.material.dispose();
    groundBowl.geometry.dispose();
    groundBowl.material.dispose();
    sunCard.geometry.dispose();
    sunCard.material.dispose();
    waterCard.geometry.dispose();
    waterCard.material.dispose();
    pmrem.dispose();
    return tex;
  } catch {
    return null;
  }
}

export class GameRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.width = 390;
    this.height = 844;
    this.biome = 'canyon_river';
    this.purificationProgress = 0;
    this.skinId = 'sea_glass_guardian';
    this.blasterFxId = 'standard_cryo';
    this.cutsceneCam = null;
    this._cutscenePhaseSmooth = 0;
    this._lastCutsceneKind = '';
    this._lastTime = 0;
    this._skyStateProxy = {};

    // Adaptive Dynamic Resolution Scaling for locked 60fps across mobile & desktop
    this.maxDpr = Math.min((typeof window !== 'undefined' && window.devicePixelRatio) || 1, 1.75);
    this.currentDpr = this.maxDpr;
    this._frameEmaMs = 16.6;
    this._slowFrameCount = 0;
    this._lastPerfNow = 0;

    // Delegated specialist stage renderers (`core_descent`, `reef_swim`, `rapids_surf`, `frill_glide`, `aqueduct_sanctum`)
    this.subRenderer = null;
    this.skimmerRenderer = null;
    this.glideRenderer = null;
    this.puzzleRenderer = null;
    this.vaultRenderer = null;

    this.webgl = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: 'high-performance',
    });
    this.webgl.toneMapping = THREE.ACESFilmicToneMapping;
    this.webgl.toneMappingExposure = 1.04;
    this.webgl.shadowMap.enabled = true;
    this.webgl.shadowMap.type = THREE.PCFSoftShadowMap;
    this.webgl.shadowMap.autoUpdate = false;
    this.webgl.setPixelRatio(this.currentDpr);

    this._biomeEnvMaps = new Map();
    this._initEnvironment();
    this._initSharedAssets();
    this._initTowerScene();
    this._initPostProcessing();
    this._loadBlenderAssets();
  }

  _getBiomeEnvMap(biomeKey) {
    if (this._biomeEnvMaps.has(biomeKey)) {
      return this._biomeEnvMaps.get(biomeKey);
    }
    const spec = BIOME_LIGHT_RIGS[biomeKey] || BIOME_LIGHT_RIGS.canyon_river;
    const tex = buildBiomePmremTexture(this.webgl, spec);
    this._biomeEnvMaps.set(biomeKey, tex);
    return tex;
  }

  _initEnvironment() {
    this.envTex = this._getBiomeEnvMap('canyon_river');
  }

  _ensureSubRenderer() {
    if (this.subRenderer) return this.subRenderer;
    this.subRenderer = new SubRenderer(this.webgl, {
      width: this.width,
      height: this.height,
      softDotTex: this.glowDotTex,
      skinId: this.skinId,
      blasterFxId: this.blasterFxId,
      showHud: false,
    });
    this.subRenderer.resize?.(this.width, this.height);
    this.subRenderer.setSkin?.(this.skinId);
    this.subRenderer.setBlasterFx?.(this.blasterFxId);
    return this.subRenderer;
  }

  _ensureGlideRenderer() {
    if (this.glideRenderer) return this.glideRenderer;
    this.glideRenderer = new GlideRenderer(this.webgl, {
      width: this.width,
      height: this.height,
      dpr: this.currentDpr,
      softDotTex: this.glowDotTex,
      skinId: this.skinId,
    });
    this.glideRenderer.resize?.(this.width, this.height, this.currentDpr);
    this.glideRenderer.setSkin?.(this.skinId);
    this.glideRenderer.prewarm?.();
    return this.glideRenderer;
  }

  _ensurePuzzleRenderer() {
    if (this.puzzleRenderer) return this.puzzleRenderer;
    this.puzzleRenderer = new PuzzleRenderer(this.webgl, {
      width: this.width,
      height: this.height,
      dpr: this.currentDpr,
      softDotTex: this.glowDotTex,
      skinId: this.skinId,
    });
    this.puzzleRenderer.resize?.(this.width, this.height, this.currentDpr);
    this.puzzleRenderer.setSkin?.(this.skinId);
    this.puzzleRenderer.prewarm?.();
    return this.puzzleRenderer;
  }

  _ensureSkimmerRenderer() {
    if (this.skimmerRenderer) return this.skimmerRenderer;
    this.skimmerRenderer = new SkimmerRenderer(this.webgl, {
      width: this.width,
      height: this.height,
      dpr: this.currentDpr,
      skinId: this.skinId,
      blasterFxId: this.blasterFxId,
      envMap: this.envTex,
      softDotTex: this.glowDotTex,
    });
    this.skimmerRenderer.resize?.(this.width, this.height, this.currentDpr);
    this.skimmerRenderer.setSkin?.(this.skinId);
    this.skimmerRenderer.setBlasterFx?.(this.blasterFxId);
    this.skimmerRenderer.prewarm?.();
    return this.skimmerRenderer;
  }

  _ensureVaultRenderer() {
    if (this.vaultRenderer) return this.vaultRenderer;
    this.vaultRenderer = new VaultRenderer(this.webgl, {
      width: this.width,
      height: this.height,
      dpr: this.currentDpr,
      envMap: this.envTex,
      softDotTex: this.glowDotTex,
    });
    this.vaultRenderer.resize?.(this.width, this.height, this.currentDpr);
    this.vaultRenderer.prewarm?.();
    return this.vaultRenderer;
  }

  _initSharedAssets() {
    this.glowDotTex = createGlowDotTexture();
    this.relicTabletTex = createWatershedTabletTexture();

    this.sharedParticleGeo = new THREE.BoxGeometry(0.14, 0.14, 0.14);
    this.sharedPulseGeo = new THREE.IcosahedronGeometry(0.17, 1);
    this.sharedPrismGeo = new THREE.OctahedronGeometry(0.20, 0);
    this.sharedFxRingGeo = new THREE.TorusGeometry(0.25, 0.020, 6, 22);
    this.sharedTrailDotGeo = new THREE.SphereGeometry(0.072, 8, 8);

    const trailParts = [];
    const orbitParts = [];
    for (let t = 1; t <= 3; t++) {
      const sc = 1.0 - t * 0.22;
      const tp = new THREE.SphereGeometry(0.07 * sc, 8, 8);
      tp.translate(-t * 0.16, 0, -0.02 * t);
      trailParts.push(tp);

      const ang = ((t - 1) * TWO_PI) / 3;
      const op = new THREE.SphereGeometry(0.07 * sc, 8, 8);
      op.translate(Math.cos(ang) * 0.26, Math.sin(ang) * 0.10, Math.sin(ang) * 0.22);
      orbitParts.push(op);
    }
    this.sharedTrailClusterGeo = mergeRigidGeos(trailParts);
    this.sharedOrbitalTrailGeo = mergeRigidGeos(orbitParts);
    this.sharedTrailClusterGeo.userData.shared = true;
    this.sharedOrbitalTrailGeo.userData.shared = true;

    // Merged Crystalline Water Droplet Collectible Geometry (1 draw call!)
    const dropParts = [
      new THREE.SphereGeometry(0.16, 12, 10),
      (() => {
        const cone = new THREE.ConeGeometry(0.145, 0.24, 12);
        cone.translate(0, 0.14, 0);
        return cone;
      })(),
    ];
    this.sharedWaterDropGeo = mergeRigidGeos(dropParts);
    this.sharedWaterDropGeo.userData.shared = true;
    this.sharedWaterDropMat = new THREE.MeshStandardMaterial({
      color: '#67e8f9',
      emissive: '#06b6d4',
      emissiveIntensity: 0.85,
      roughness: 0.08,
      metalness: 0.18,
    });
    this.sharedWaterDropMat.userData.shared = true;

    for (const g of [
      this.sharedParticleGeo,
      this.sharedPulseGeo,
      this.sharedPrismGeo,
      this.sharedFxRingGeo,
      this.sharedTrailDotGeo,
    ]) {
      g.userData.shared = true;
    }

    this.sharedPulseMat = new THREE.MeshStandardMaterial({
      color: '#e0f2fe',
      emissive: '#38bdf8',
      emissiveIntensity: 1.45,
      roughness: 0.10,
      metalness: 0.2,
    });
    this.sharedFxRingMat = new THREE.MeshBasicMaterial({
      color: '#5efce8',
      transparent: true,
      opacity: 0.85,
    });
    this.sharedTrailDotMat = new THREE.MeshBasicMaterial({
      color: '#bae6fd',
      transparent: true,
      opacity: 0.62,
    });
    this.sharedHaloSpriteMat = new THREE.SpriteMaterial({
      map: this.glowDotTex,
      color: '#7dd3fc',
      transparent: true,
      opacity: 0.65,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    for (const m of [
      this.sharedPulseMat,
      this.sharedFxRingMat,
      this.sharedTrailDotMat,
      this.sharedHaloSpriteMat,
    ]) {
      m.userData.shared = true;
    }

    this.popupPool = [];
    this._tempColor = new THREE.Color();
    this._prismColor = new THREE.Color();
    this._bgColor = new THREE.Color();
    this._fogColor = new THREE.Color();

    // Zero-allocation per-frame scratch math objects
    this._ndcVec = new THREE.Vector3();
    this._rayDir = new THREE.Vector3();
    this._grappleStart = new THREE.Vector3();
    this._grappleEnd = new THREE.Vector3();
    this._shakeVec = { x: 0, y: 0 };
    this._worldPt = { x: 0, y: 0 };
    this._debrisDummy = new THREE.Object3D();
    this._enemyExtraOpts = { cols: COLS, enemyProjectiles: null };

    this.glbModels = {};
    this._archPropsVersion = 0;
    this._collectibleMats = new Map();
  }

  _prepareGlbScene(scene) {
    scene.traverse((obj) => {
      if (obj.geometry) {
        obj.geometry.userData = obj.geometry.userData || {};
        obj.geometry.userData.shared = true;
      }
      if (!obj.isMesh || !obj.material) return;
      const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
      for (const m of mats) {
        if (!m) continue;
        m.userData = m.userData || {};
        m.userData.shared = true;
        if (typeof m.emissiveIntensity === 'number' && m.emissiveIntensity > 1.85) {
          m.emissiveIntensity = 1.85;
        }
      }
    });
    return scene;
  }

  _loadBlenderAssets() {
    let loader;
    try {
      loader = new GLTFLoader();
    } catch {
      return;
    }

    const specs = [
      { key: 'real_staircase', url: 'assets/models/real_staircase.glb' },
      { key: 'mech_elevator', url: 'assets/models/mech_elevator.glb' },
      { key: 'hydro_turbine', url: 'assets/models/hydro_turbine.glb' },
      { key: 'pipe_valve', url: 'assets/models/pipe_valve.glb' },
    ];

    for (const sp of specs) {
      loader.load(
        sp.url,
        (gltf) => {
          if (!gltf || !gltf.scene) return;
          this.glbModels[sp.key] = this._prepareGlbScene(gltf.scene);
          this._archPropsVersion++;
        },
        undefined,
        () => {}
      );
    }
  }

  _initPostProcessing() {
    this.postfx = null;
    try {
      this.postfx = new CinematicPostFX(this.webgl, this.width, this.height, this.currentDpr);
      this.postfx.setBiome(this.biome, this.purificationProgress);
    } catch {
      this.postfx = null;
    }
  }

  _renderWithComposer(scene, camera, opts) {
    if (this.postfx) {
      try {
        this.postfx.render(scene, camera, opts);
        return;
      } catch {
        this.postfx = null;
      }
    }
    this.webgl.render(scene, camera);
  }

  setEra(_era) {
    // Unified AAA rendering pipeline
  }

  setBiome(biome) {
    const resolved = resolvePostFxBiome(biome);
    if (this.biome === resolved && this.towerScene?.environment) return;
    this.biome = resolved;
    const env = this._getBiomeEnvMap(resolved);
    if (env) {
      this.envTex = env;
      if (this.towerScene) this.towerScene.environment = env;
    }
    this.enemyVisuals?.setTheme?.(resolved);
    this.enemyVisuals?.setEnvironment?.(this.envTex);
    this.postfx?.setBiome(resolved, this.purificationProgress);
  }

  setPurificationProgress(p) {
    this.purificationProgress = Math.max(0, Math.min(1, Number(p) || 0));
    this.postfx?.setBiome(this.biome, this.purificationProgress);
  }

  setSkin(skinId) {
    if (!skinId || this.skinId === skinId) return;
    this.skinId = skinId;
    this.gatewayRig?.setSkin?.(skinId);
    this.subRenderer?.setSkin?.(skinId);
    this.glideRenderer?.setSkin?.(skinId);
    this.puzzleRenderer?.setSkin?.(skinId);
    this.skimmerRenderer?.setSkin?.(skinId);
  }

  setBlasterFx(fxId) {
    const resolved = fxId && HYDRO_FX_STYLES[fxId] ? fxId : 'standard_cryo';
    this.blasterFxId = resolved;
    this.subRenderer?.setBlasterFx?.(resolved);
    this.skimmerRenderer?.setBlasterFx?.(resolved);
  }

  setCutsceneCam(cfg = null) {
    this.cutsceneCam = cfg && cfg.active ? cfg : null;
  }

  _syncHydroFxMaterials(time = 0) {
    const fx = HYDRO_FX_STYLES[this.blasterFxId] || HYDRO_FX_STYLES.standard_cryo;
    if (fx.prismatic) {
      const hue = (time * 0.42) % 1;
      this._prismColor.setHSL(hue, 0.92, 0.68);
      this.sharedPulseMat.color.set('#ffffff');
      this.sharedPulseMat.emissive.copy(this._prismColor);
      this.sharedHaloSpriteMat.color.copy(this._prismColor);
      this.sharedTrailDotMat.color.setHSL((hue + 0.16) % 1, 0.9, 0.72);
      this.sharedFxRingMat.color.setHSL((hue + 0.48) % 1, 0.95, 0.65);
    } else {
      this.sharedPulseMat.color.set(fx.core);
      this.sharedPulseMat.emissive.set(fx.emissive);
      this.sharedHaloSpriteMat.color.set(fx.muzzle);
      this.sharedTrailDotMat.color.set(fx.trail);
      if (fx.ring) this.sharedFxRingMat.color.set(fx.ring);
    }
    return fx;
  }

  _applyPixelRatio(dpr) {
    this.webgl.setPixelRatio(dpr);
    this.webgl.setSize(this.width, this.height, false);
    if (this.postfx) {
      this.postfx.resize(this.width, this.height, dpr);
    }
    if (this.ocean) {
      this.ocean.setSize(this.width, this.height, dpr);
    }
    this.subRenderer?.resize?.(this.width, this.height);
    this.glideRenderer?.resize?.(this.width, this.height, dpr);
    this.puzzleRenderer?.resize?.(this.width, this.height, dpr);
    this.skimmerRenderer?.resize?.(this.width, this.height, dpr);
    this.vaultRenderer?.resize?.(this.width, this.height, dpr);
  }

  _trackFramePerformance() {
    const now = performance.now();
    if (this._lastPerfNow > 0) {
      const frameMs = now - this._lastPerfNow;
      if (frameMs > 0 && frameMs < 200) {
        this._frameEmaMs = this._frameEmaMs * 0.92 + frameMs * 0.08;
        if (this._frameEmaMs > 19.0 && this.currentDpr > 1.0) {
          this._slowFrameCount++;
          if (this._slowFrameCount >= 45) {
            this.currentDpr = this.currentDpr > 1.25 ? 1.25 : 1.0;
            this._applyPixelRatio(this.currentDpr);
            this._slowFrameCount = 0;
            this._frameEmaMs = 16.6;
          }
        } else if (this._slowFrameCount > 0) {
          this._slowFrameCount--;
        }
      }
    }
    this._lastPerfNow = now;
  }

  resize(w, h, dpr = 1) {
    this.width = Math.max(1, w);
    this.height = Math.max(1, h);
    this.maxDpr = Math.min(dpr, 1.75);
    this.currentDpr = this.maxDpr;
    this._slowFrameCount = 0;
    this._frameEmaMs = 16.6;
    this._applyPixelRatio(this.currentDpr);

    const aspect = Math.max(0.38, this.width / this.height);
    if (this.towerCam) {
      this.towerCam.aspect = aspect;
      this.towerCam.updateProjectionMatrix();
    }
  }

  renderScene(state) {
    if (!state) return;
    this._trackFramePerformance();

    const hero = state.gateway || state.player;
    if (hero?.skinId && hero.skinId !== this.skinId) {
      this.setSkin(hero.skinId);
    }
    const nextFx = hero?.blasterFxId || state.blasterFxId;
    if (nextFx && nextFx !== this.blasterFxId) {
      this.setBlasterFx(nextFx);
    }

    const activeMode = state.mode === 'paused' ? (state.pausedFrom || 'tower') : state.mode;
    if (activeMode === 'core_descent') {
      this.renderCoreDescentScene(state);
    } else if (activeMode === 'reef_swim' || activeMode === 'submarine') {
      this.renderSubmarineScene(state);
    } else if (activeMode === 'rapids_surf' || activeMode === 'skimmer') {
      this.renderSkimmerScene(state);
    } else if (activeMode === 'frill_glide' || activeMode === 'glide') {
      this.renderGlideScene(state);
    } else if (activeMode === 'aqueduct_sanctum' || activeMode === 'puzzle') {
      if (state.puzzleRoom || state.puzzle) {
        this.renderPuzzleScene(state);
      } else if (state.vault || state.sanctumVault) {
        this.renderVaultScene(state);
      }
    } else if (activeMode === 'vault') {
      this.renderVaultScene(state);
    } else if (state.tower) {
      this.renderTowerScene(state);
    }
  }

  _initTowerScene() {
    this.towerScene = new THREE.Scene();
    this.towerScene.background = new THREE.Color('#489cd6');
    this.towerScene.fog = new THREE.Fog('#a7dce8', 46, 152);
    if (this.envTex) {
      this.towerScene.environment = this.envTex;
      this.towerScene.environmentIntensity = 0.68;
    }

    this.towerCam = new THREE.PerspectiveCamera(50, 390 / 844, 0.15, 280);

    // 5-Biome Daylight / Alpenglow / Twilight / Lagoon / Aurora Rig + 2048x2048 PCFSoftShadowMap
    this.hemiLight = new THREE.HemisphereLight('#cbeafe', '#a85238', 0.96);
    this.towerScene.add(this.hemiLight);

    this.keyLight = new THREE.DirectionalLight('#fff3d1', 2.52);
    this.keyLight.position.set(11.2, 14.5, 11.4);
    this.keyLight.castShadow = true;
    this.keyLight.shadow.mapSize.set(2048, 2048);
    this.keyLight.shadow.camera.near = 2.2;
    this.keyLight.shadow.camera.far = 36.0;
    this.keyLight.shadow.camera.left = -6.8;
    this.keyLight.shadow.camera.right = 6.8;
    this.keyLight.shadow.camera.top = 9.6;
    this.keyLight.shadow.camera.bottom = -9.6;
    this.keyLight.shadow.bias = -0.00035;
    this.keyLight.shadow.normalBias = 0.018;
    this.keyLight.shadow.radius = 1.85;
    this.towerScene.add(this.keyLight);
    this.towerScene.add(this.keyLight.target);

    this.fillLight = new THREE.DirectionalLight('#2dd4bf', 0.62);
    this.fillLight.position.set(-10.0, 3.5, 10.5);
    this.towerScene.add(this.fillLight);

    this.rimLight = new THREE.DirectionalLight('#fde68a', 1.04);
    this.rimLight.position.set(-11.0, 9.0, -9.8);
    this.towerScene.add(this.rimLight);

    this.sunGlintLight = new THREE.DirectionalLight('#fef08a', 1.28);
    this.sunGlintLight.position.set(4.5, 11.0, -16.0);
    this.towerScene.add(this.sunGlintLight);

    this.heroLight = new THREE.PointLight('#5efce8', 0.48, 7.5);
    this.towerScene.add(this.heroLight);

    this.archAccentLight = new THREE.PointLight('#ffaa2b', 0, 8.5, 1.7);
    this.towerScene.add(this.archAccentLight);

    // 5-Biome Atmospheric Sky, Canyon Cliffs / Snow Peaks / Cypress Arches / Coral Reefs (`src/stormSky.js`)
    this.stormSky = new StormAtmosphere(this.towerScene, {
      towerRadius: TOWER_RADIUS,
      floorHeight: FLOOR_HEIGHT,
    });

    // Real-Time Planar-Reflecting Living Water (`src/water.js`)
    this.ocean = new Ocean(this.webgl, {
      towerRadius: TOWER_RADIUS,
      preset: 'canyon_river',
      size: 240,
      segments: 64,
      waterY: -0.55 * FLOOR_HEIGHT,
    });
    this.ocean.setSize(this.width, this.height, this.currentDpr);
    this.towerScene.add(this.ocean.mesh);
    this._lastOceanBiome = '';

    // Whitewater Rapids Surf, Waterfall Mist & Conduit VFX (`src/oceanVfx.js`)
    this.oceanVfx = new TowerFluidAndSparkVFX(this.towerScene);

    this.towerCache = new Map();
    this.currentTowerGroup = null;

    // 39-Bone `SkinnedMesh` Heroine Gateway (`src/gateway.js`)
    this.gatewayRig = new GatewayRig(this.skinId);
    this.towerScene.add(this.gatewayRig.group);

    // Bubble Aegis Shield, 360° Tail-Whip Water Slash, Tail-Grapple Tether & Landing Ring
    this.shieldBubble = new THREE.Mesh(
      new THREE.SphereGeometry(0.76, 22, 18),
      new THREE.MeshStandardMaterial({
        color: '#67e8f9',
        emissive: '#0ea5e9',
        emissiveIntensity: 0.65,
        transparent: true,
        opacity: 0.28,
        roughness: 0.08,
      })
    );
    this.shieldBubble.visible = false;
    this.towerScene.add(this.shieldBubble);

    this.tailWhipVfxGroup = this._buildTailWhipVfx();
    this.towerScene.add(this.tailWhipVfxGroup);

    this.grappleBeam = this._buildGrappleBeam();
    this.towerScene.add(this.grappleBeam);

    this.tunnelVortexGroup = this._buildTunnelVortex();
    this.towerScene.add(this.tunnelVortexGroup);

    this.landingRingGroup = this._buildLandingRing();
    this.towerScene.add(this.landingRingGroup);

    this.muzzleFlashGroup = this._buildMuzzleFlashGroup();
    this.towerScene.add(this.muzzleFlashGroup);

    this.wardrobeFxOrb = this._buildHydroPulseNode(true);
    this.wardrobeFxOrb.visible = false;
    this.towerScene.add(this.wardrobeFxOrb);

    // Spire Purification Crystal-Water Eruption Fountain (active during purification cutscenes & topples)
    this.purificationEruptionGroup = this._buildPurificationEruption();
    this.towerScene.add(this.purificationEruptionGroup);

    // 7 Original Articulated Siphon Syndicate Enemies (`src/enemyRig.js`)
    this.enemyVisuals = new EnemyVisualPool(this.towerScene, { chromeEnv: this.envTex });

    this.collectibleGroup = new THREE.Group();
    this.pulseGroup = new THREE.Group();
    this.particleGroup = new THREE.Group();
    this.popupGroup = new THREE.Group();
    this.towerScene.add(this.collectibleGroup, this.pulseGroup, this.particleGroup, this.popupGroup);

    this.pulsePool = [];
    for (let i = 0; i < 3; i++) {
      const fxNode = this._buildHydroPulseNode();
      fxNode.visible = false;
      this.pulseGroup.add(fxNode);
      this.pulsePool.push(fxNode);
    }

    this.collectiblePool = [];
    this.particlePool = [];
    this._initParticleInstancer(112);
    this.debrisPool = this._buildDebrisPool();
    this.towerScene.add(this.debrisPool.inst);
  }

  _buildTailWhipVfx() {
    const g = new THREE.Group();
    g.visible = false;
    const slashRing = new THREE.Mesh(
      new THREE.TorusGeometry(0.96, 0.065, 8, 32, Math.PI * 1.45),
      new THREE.MeshBasicMaterial({
        color: '#5efce8',
        transparent: true,
        opacity: 0.88,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    slashRing.rotation.x = Math.PI * 0.5;
    const innerDisc = new THREE.Mesh(
      new THREE.RingGeometry(0.52, 0.98, 28),
      new THREE.MeshBasicMaterial({
        color: '#38bdf8',
        transparent: true,
        opacity: 0.34,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    innerDisc.rotation.x = Math.PI * 0.5;
    g.add(slashRing, innerDisc);
    g.userData = { slashRing, innerDisc };
    return g;
  }

  _buildGrappleBeam() {
    const geo = new THREE.CylinderGeometry(0.032, 0.045, 1.0, 8);
    geo.rotateX(Math.PI * 0.5);
    geo.translate(0, 0, 0.5);
    const mat = new THREE.MeshBasicMaterial({
      color: '#5efce8',
      transparent: true,
      opacity: 0.86,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const m = new THREE.Mesh(geo, mat);
    m.visible = false;
    return m;
  }

  _buildPurificationEruption() {
    const g = new THREE.Group();
    g.visible = false;
    // Feathered cascading turquoise water-geyser plumes + prismatic mist rings (zero boxy geometry!)
    const plumeMat = new THREE.MeshBasicMaterial({
      map: this.glowDotTex,
      color: '#5efce8',
      transparent: true,
      opacity: 0.62,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const geyser = new THREE.Mesh(new THREE.CylinderGeometry(2.35, 0.85, 26, 24, 1, true), plumeMat);
    geyser.position.y = 13;

    const innerCore = new THREE.Mesh(
      new THREE.CylinderGeometry(1.15, 0.45, 30, 20, 1, true),
      new THREE.MeshBasicMaterial({
        map: this.glowDotTex,
        color: '#e0f7ff',
        transparent: true,
        opacity: 0.72,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
        depthWrite: false,
      })
    );
    innerCore.position.y = 15;

    const rainbowHalo = new THREE.Mesh(
      new THREE.TorusGeometry(5.6, 0.22, 12, 42),
      new THREE.MeshBasicMaterial({
        color: '#67e8f9',
        transparent: true,
        opacity: 0.48,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    rainbowHalo.rotation.x = Math.PI * 0.5;

    const goldHalo = new THREE.Mesh(
      new THREE.TorusGeometry(6.8, 0.14, 10, 42),
      new THREE.MeshBasicMaterial({
        color: '#fde047',
        transparent: true,
        opacity: 0.38,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    goldHalo.rotation.x = Math.PI * 0.5;
    goldHalo.position.y = 2.4;

    g.add(geyser, innerCore, rainbowHalo, goldHalo);
    g.userData = { geyser, innerCore, rainbowHalo, goldHalo };
    return g;
  }

  _trimEnemyShadows() {
    const root = this.enemyVisuals?.root;
    if (!root) return;
    const kids = root.children;
    for (let i = 0; i < kids.length; i++) {
      const rig = kids[i];
      if (!rig || !rig.isGroup || !rig.visible) continue;
      const bodyRoot = rig.userData?.body || rig;
      const sigKey = bodyRoot.children?.[0] || bodyRoot;
      if (rig._shadowTrimKey === sigKey) continue;
      rig._shadowTrimKey = sigKey;

      rig.traverse((o) => {
        if (!o.isMesh) return;
        const m = Array.isArray(o.material) ? o.material[0] : o.material;
        o.castShadow = Boolean(m && !m.transparent && !m.isMeshBasicMaterial);
      });
    }
  }

  _initParticleInstancer(maxCount = 112) {
    this._maxParticles = maxCount;
    this.particleInstGeo = this.sharedParticleGeo.clone();
    this._particleAlphas = new Float32Array(maxCount);
    this._particleAlphaAttr = new THREE.InstancedBufferAttribute(this._particleAlphas, 1);
    this._particleAlphaAttr.setUsage(THREE.DynamicDrawUsage);
    this.particleInstGeo.setAttribute('aAlpha', this._particleAlphaAttr);

    this.particleInstMat = new THREE.MeshBasicMaterial({
      color: '#ffffff',
      transparent: true,
      depthWrite: false,
    });
    this.particleInstMat.onBeforeCompile = (shader) => {
      shader.vertexShader =
        'attribute float aAlpha;\nvarying float vPartAlpha;\n' +
        shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvPartAlpha = aAlpha;');
      shader.fragmentShader =
        'varying float vPartAlpha;\n' +
        shader.fragmentShader.replace(
          '#include <dithering_fragment>',
          'gl_FragColor.a *= vPartAlpha;\n#include <dithering_fragment>'
        );
    };

    this.particleInst = new THREE.InstancedMesh(this.particleInstGeo, this.particleInstMat, maxCount);
    this.particleInst.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.particleInst.frustumCulled = false;
    this.particleInst.count = 0;
    this.particleInst.visible = false;
    this._tempColor.set('#ffffff');
    for (let i = 0; i < maxCount; i++) {
      this.particleInst.setColorAt(i, this._tempColor);
    }
    if (this.particleInst.instanceColor) {
      this.particleInst.instanceColor.setUsage(THREE.DynamicDrawUsage);
    }
    this.particleGroup.add(this.particleInst);
  }

  _buildMuzzleFlashGroup() {
    const g = new THREE.Group();
    g.visible = false;
    const core = new THREE.Mesh(this.sharedPrismGeo, this.sharedPulseMat);
    core.scale.setScalar(0.82);
    const flare = new THREE.Sprite(this.sharedHaloSpriteMat);
    flare.scale.set(0.95, 0.95, 1);
    g.add(core, flare);
    g.userData = { core, flare };
    return g;
  }

  _buildHydroPulseNode(isOrbital = false) {
    const g = new THREE.Group();
    const icosa = new THREE.Mesh(this.sharedPulseGeo, this.sharedPulseMat);
    const prism = new THREE.Mesh(this.sharedPrismGeo, this.sharedPulseMat);
    const ring = new THREE.Mesh(this.sharedFxRingGeo, this.sharedFxRingMat);
    const halo = new THREE.Sprite(this.sharedHaloSpriteMat);
    halo.scale.set(0.65, 0.65, 1);

    const trailCluster = new THREE.Mesh(
      isOrbital ? this.sharedOrbitalTrailGeo : this.sharedTrailClusterGeo,
      this.sharedTrailDotMat
    );

    g.add(icosa, prism, ring, halo, trailCluster);
    g.userData = { icosa, prism, ring, halo, trailCluster };
    return g;
  }

  _buildLandingRing() {
    const g = new THREE.Group();
    const shadow = new THREE.Mesh(
      new THREE.CircleGeometry(0.32, 22),
      new THREE.MeshBasicMaterial({ color: '#041224', transparent: true, opacity: 0.48, depthWrite: false })
    );
    shadow.rotation.x = -Math.PI / 2;

    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.34, 0.43, 26),
      new THREE.MeshBasicMaterial({
        color: '#5efce8',
        transparent: true,
        opacity: 0.76,
        side: THREE.DoubleSide,
        depthWrite: false,
      })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.006;

    g.add(shadow, ring);
    g.userData = { shadow, ring };
    return g;
  }

  _buildTunnelVortex() {
    const g = new THREE.Group();
    g.visible = false;
    const outerRing = new THREE.Mesh(
      new THREE.TorusGeometry(0.52, 0.048, 8, 26),
      new THREE.MeshBasicMaterial({ color: '#5efce8', transparent: true, opacity: 0.85 })
    );
    const innerRing = new THREE.Mesh(
      new THREE.TorusGeometry(0.34, 0.035, 8, 22),
      new THREE.MeshBasicMaterial({ color: '#fde047', transparent: true, opacity: 0.82 })
    );
    const core = new THREE.Mesh(
      new THREE.CircleGeometry(0.28, 22),
      new THREE.MeshBasicMaterial({ color: '#bae6fd', transparent: true, opacity: 0.48, side: THREE.DoubleSide })
    );
    g.add(outerRing, innerRing, core);
    g.userData = { outerRing, innerRing, core };
    return g;
  }

  _buildDebrisPool() {
    // Cascading Luminous Purification Water-Droplet Streamers (replaces old boxy debris cubes!)
    const geo = this.sharedWaterDropGeo.clone();
    geo.scale(1.15, 1.85, 1.15);
    const mat = new THREE.MeshStandardMaterial({
      color: '#bae6fd',
      emissive: '#38bdf8',
      emissiveIntensity: 1.15,
      roughness: 0.08,
      metalness: 0.15,
      transparent: true,
      opacity: 0.86,
    });
    const inst = new THREE.InstancedMesh(geo, mat, 48);
    inst.visible = false;
    const meta = [];
    for (let i = 0; i < 48; i++) {
      const ang = (i / 48) * TWO_PI;
      meta.push({
        ang,
        rad: TOWER_RADIUS + 0.55 + (i % 4) * 0.65,
        speed: 0.85 + (i % 6) * 0.22,
        phase: (i * 0.21) % 1,
        scale: 0.65 + (i % 4) * 0.25,
      });
    }
    return { inst, geo, mat, meta };
  }

  _getOrBuildTowerGroup(tower) {
    const rbTheme = resolveArchTheme(tower);
    const propVer = this._archPropsVersion;
    const clue = tower.clue;
    const clueSig = clue
      ? `${clue.kind}_${clue.col}_${clue.floor}_${clue.n || ''}_${(clue.pattern || clue.order || []).join('')}`
      : 'noclue';
    const basePrefix = `v3_${rbTheme}_`;
    const towerSuffix = `_${tower.key || tower.id}_${clueSig}`;
    const cacheKey = `${basePrefix}p${propVer}${towerSuffix}`;
    if (this.towerCache.has(cacheKey)) {
      return this.towerCache.get(cacheKey);
    }

    for (const [k, old] of this.towerCache.entries()) {
      if (k !== cacheKey && k.startsWith(basePrefix) && k.endsWith(towerSuffix) && old.group !== this.currentTowerGroup) {
        disposeTowerArchitecture(old);
        this.towerCache.delete(k);
      }
    }

    if (this.towerCache.size > 10) {
      for (const [oldestKey, oldEntry] of this.towerCache.entries()) {
        if (oldEntry && oldEntry.group !== this.currentTowerGroup) {
          disposeTowerArchitecture(oldEntry);
          this.towerCache.delete(oldestKey);
          break;
        }
      }
    }

    const cached = buildDetailedTowerGroup(tower, 'reboot', {
      real_staircase: this.glbModels.real_staircase || null,
      mech_elevator: this.glbModels.mech_elevator || null,
      hydro_turbine: this.glbModels.hydro_turbine || null,
      pipe_valve: this.glbModels.pipe_valve || null,
      useOceanVfx: true,
    });
    this.towerCache.set(cacheKey, cached);
    return cached;
  }

  _getCollectibleMat(key, factory) {
    let mat = this._collectibleMats.get(key);
    if (!mat) {
      mat = factory();
      mat.userData = mat.userData || {};
      mat.userData.shared = true;
      this._collectibleMats.set(key, mat);
    }
    return mat;
  }

  _disposeCollectibleMesh(root, forceMaterials = false) {
    if (!root) return;
    const seenMats = forceMaterials ? new Set() : null;
    root.traverse((obj) => {
      if (obj.geometry && !obj.geometry.userData?.shared) {
        obj.geometry.dispose();
      }
      if (forceMaterials) {
        const mats = Array.isArray(obj.material) ? obj.material : obj.material ? [obj.material] : [];
        for (const m of mats) {
          if (m && !m.userData?.shared && !seenMats.has(m)) {
            seenMats.add(m);
            m.dispose();
          }
        }
      }
    });
  }

  _buildCollectibleMesh(type) {
    const g = new THREE.Group();
    if (type === 'waterSeed' || type === 'starCore') {
      const seed = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.30, 1),
        this._getCollectibleMat(
          'waterSeed:core',
          () =>
            new THREE.MeshStandardMaterial({
              color: '#fde047',
              emissive: '#f59e0b',
              emissiveIntensity: 1.25,
              roughness: 0.08,
              metalness: 0.35,
            })
        )
      );
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(0.40, 0.028, 8, 26),
        this._getCollectibleMat('waterSeed:ring', () => new THREE.MeshBasicMaterial({ color: '#5efce8' }))
      );
      g.add(seed, ring);
      g.userData.holoRing = ring;
    } else if (type === 'relic') {
      const tabletMat = this._getCollectibleMat(
        'relic:tablet',
        () => new THREE.MeshStandardMaterial({ color: '#1e3a4c', roughness: 0.42, metalness: 0.32 })
      );
      const glyphMat = this._getCollectibleMat(
        'relic:glyph',
        () =>
          new THREE.MeshStandardMaterial({
            map: this.relicTabletTex,
            emissive: '#ffffff',
            emissiveMap: this.relicTabletTex,
            emissiveIntensity: 1.2,
            roughness: 0.18,
          })
      );
      const slab = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.50, 0.075), tabletMat);
      const face = new THREE.Mesh(new THREE.PlaneGeometry(0.28, 0.42), glyphMat);
      face.position.z = 0.042;
      const holoRing = new THREE.Mesh(
        new THREE.TorusGeometry(0.34, 0.018, 8, 28),
        this._getCollectibleMat(
          'relic:ring',
          () => new THREE.MeshBasicMaterial({ color: '#5efce8', transparent: true, opacity: 0.78 })
        )
      );
      g.add(slab, face, holoRing);
      g.userData = { holoRing };
    } else if (
      type === 'critterPod' ||
      type === 'critter_pod' ||
      type === 'critter' ||
      type === 'wildlife' ||
      type === 'rescuePod'
    ) {
      // Wave 3 Rescuable Earth Water-Critter Pod (Translucent Sea-Glass Bubble + Bronze Collar + 3D Otter/Turtle!)
      const bubble = new THREE.Mesh(
        new THREE.SphereGeometry(0.36, 16, 12),
        this._getCollectibleMat(
          'critterPod:bubble',
          () =>
            new THREE.MeshStandardMaterial({
              color: '#a5f3fc',
              emissive: '#22d3ee',
              emissiveIntensity: 0.55,
              roughness: 0.06,
              transparent: true,
              opacity: 0.48,
            })
        )
      );
      const collar = new THREE.Mesh(
        new THREE.TorusGeometry(0.38, 0.032, 8, 24),
        this._getCollectibleMat(
          'critterPod:collar',
          () => new THREE.MeshStandardMaterial({ color: '#e5a945', metalness: 0.86, roughness: 0.22 })
        )
      );
      const critterCore = new THREE.Group();
      const fbCritter = new THREE.Mesh(
        new THREE.CapsuleGeometry(0.11, 0.22, 6, 10),
        this._getCollectibleMat(
          'critterPod:body',
          () => new THREE.MeshStandardMaterial({ color: '#2dd4bf', roughness: 0.35 })
        )
      );
      fbCritter.rotation.z = Math.PI * 0.5;
      critterCore.add(fbCritter);
      if (typeof window !== 'undefined' && typeof fetch === 'function') {
        const loader = new GLTFLoader();
        loader.load(
          'assets/models/sea_turtle.glb',
          (gltf) => {
            if (!gltf?.scene) return;
            critterCore.clear();
            const cl = gltf.scene.clone(true);
            cl.scale.setScalar(0.46);
            critterCore.add(cl);
          },
          undefined,
          () => {}
        );
      }
      g.add(bubble, collar, critterCore);
      g.userData = { holoRing: collar };
    } else if (type === 'curio' || type === 'salvage_part' || type === 'compass_key') {
      const orb = new THREE.Mesh(
        new THREE.IcosahedronGeometry(0.21, 1),
        this._getCollectibleMat(
          'curio:orb',
          () =>
            new THREE.MeshStandardMaterial({
              color: '#5efce8',
              emissive: '#06b6d4',
              emissiveIntensity: 1.25,
              roughness: 0.08,
            })
        )
      );
      const gimbal = new THREE.Mesh(
        new THREE.TorusGeometry(0.28, 0.022, 8, 24),
        this._getCollectibleMat(
          'curio:gimbal',
          () => new THREE.MeshStandardMaterial({ color: '#eab308', metalness: 0.88, roughness: 0.2 })
        )
      );
      g.add(orb, gimbal);
      g.userData = { holoRing: gimbal };
    } else {
      // Default Crystalline Water Droplet (`waterDrop` / `gear`)
      const drop = new THREE.Mesh(this.sharedWaterDropGeo, this.sharedWaterDropMat);
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(0.26, 0.018, 6, 20),
        this._getCollectibleMat(
          'waterDrop:ring',
          () => new THREE.MeshBasicMaterial({ color: '#bae6fd', transparent: true, opacity: 0.7 })
        )
      );
      g.add(drop, ring);
      g.userData = { holoRing: ring };
    }
    return g;
  }

  _screenToWorld(x, y, cam, zPlane = 0) {
    cam.updateMatrixWorld();
    const ndcX = (x / Math.max(1, this.width)) * 2 - 1;
    const ndcY = 1 - (y / Math.max(1, this.height)) * 2;
    this._ndcVec.set(ndcX, ndcY, 0.5).unproject(cam);
    this._rayDir.copy(this._ndcVec).sub(cam.position);
    const dz = this._rayDir.z;
    const out = this._worldPt;
    if (Math.abs(dz) > 1e-5) {
      const t = (zPlane - cam.position.z) / dz;
      out.x = cam.position.x + this._rayDir.x * t;
      out.y = cam.position.y + this._rayDir.y * t;
      return out;
    }
    const dist = cam.position.z - zPlane;
    const halfH = Math.tan(THREE.MathUtils.degToRad(cam.fov * 0.5)) * dist;
    const halfW = halfH * cam.aspect;
    out.x = (x / Math.max(1, this.width) - 0.5) * 2 * halfW + cam.position.x;
    out.y = (0.5 - y / Math.max(1, this.height)) * 2 * halfH + cam.position.y;
    return out;
  }

  _syncParticles(_pool, _container, particles, cam, zPlane, camCol = 0, isTower = false, fh = FLOOR_HEIGHT) {
    const inst = this.particleInst;
    if (!inst) return;
    const list = particles || [];
    if (list.length === 0) {
      inst.count = 0;
      inst.visible = false;
      return;
    }
    const fx = HYDRO_FX_STYLES[this.blasterFxId] || HYDRO_FX_STYLES.standard_cryo;
    const tintHydro = this.blasterFxId !== 'standard_cryo';
    const dm = this._debrisDummy;
    dm.rotation.set(0, 0, 0);
    let visCount = 0;

    for (let i = 0; i < list.length && visCount < this._maxParticles; i++) {
      const p = list[i];
      const alpha = Math.max(0, Math.min(1, p.life / Math.max(0.001, p.maxLife || 1)));
      if (alpha <= 0.005) continue;

      if (isTower && p.col != null && p.floor != null) {
        const theta = wrapAngle((p.col - camCol) * COL_ANGLE);
        if (Math.abs(theta) > 1.58) continue;
        const r = TOWER_RADIUS + 0.58;
        dm.position.set(r * Math.sin(theta), p.floor * fh, r * Math.cos(theta));
      } else {
        const wp = this._screenToWorld(p.x || 0, p.y || 0, cam, zPlane);
        dm.position.set(wp.x, wp.y, zPlane);
      }

      const s = Math.max(0.28, (p.size || 4) * 0.24);
      dm.scale.setScalar(s);
      dm.updateMatrix();
      inst.setMatrixAt(visCount, dm.matrix);

      const rawHex = typeof p.color === 'string' ? p.color.toLowerCase() : '#ffffff';
      if (tintHydro && HYDRO_DEFAULT_HEXES.has(rawHex)) {
        if (fx.prismatic) {
          this._tempColor.setHSL(((i * 0.13) + (this._lastTime * 0.5)) % 1, 0.92, 0.7);
        } else {
          this._tempColor.set(i % 2 === 0 ? fx.trail : fx.muzzle);
        }
      } else {
        this._tempColor.set(p.color || '#ffffff');
      }
      inst.setColorAt(visCount, this._tempColor);
      this._particleAlphas[visCount] = alpha;
      visCount++;
    }

    inst.count = visCount;
    inst.visible = visCount > 0;
    if (visCount > 0) {
      inst.instanceMatrix.needsUpdate = true;
      if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
      this._particleAlphaAttr.needsUpdate = true;
    }
  }

  _syncPopups(popups, camCol, container, cam, isTower, fh = FLOOR_HEIGHT) {
    const list = popups || [];
    while (this.popupPool.length < list.length) {
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ transparent: true, depthTest: false }));
      container.add(sp);
      this.popupPool.push({ sprite: sp, key: '' });
    }
    for (let i = 0; i < this.popupPool.length; i++) {
      const slot = this.popupPool[i];
      if (i >= list.length) {
        slot.sprite.visible = false;
        continue;
      }
      const pop = list[i];
      if (slot.sprite.parent !== container) container.add(slot.sprite);
      const key = `${pop.text}_${pop.color}`;
      if (slot.key !== key) {
        slot.sprite.material.map?.dispose();
        slot.sprite.material.map = createPopupTexture(pop.text, pop.color);
        slot.sprite.material.needsUpdate = true;
        slot.key = key;
      }
      const t = 1 - Math.max(0, pop.life / Math.max(0.001, pop.maxLife || 1));
      slot.sprite.visible = true;
      slot.sprite.material.opacity = Math.max(0, 1 - t * t);

      if (isTower && pop.col != null && pop.floor != null) {
        const theta = wrapAngle((pop.col - camCol) * COL_ANGLE);
        const nudgedTheta = theta + (theta >= 0 ? 0.14 : -0.14);
        const r = TOWER_RADIUS + 1.05;
        slot.sprite.position.set(
          r * Math.sin(nudgedTheta),
          pop.floor * fh + 1.12 * fh + t * 1.15,
          r * Math.cos(nudgedTheta)
        );
        slot.sprite.scale.set(1.78, 0.42, 1);
      } else if (pop.x != null && pop.y != null) {
        const wp = this._screenToWorld(pop.x, pop.y, cam, 1.5);
        slot.sprite.position.set(wp.x, wp.y + 0.22 + t * 0.85, 1.5);
        slot.sprite.scale.set(1.85, 0.44, 1);
      } else {
        slot.sprite.visible = false;
      }
    }
  }

  renderTowerScene(state) {
    const { tower, camCol = 0, camFloor = 2, time = 0 } = state;
    if (!tower) return;

    const hero = state.gateway || state.player;
    if (hero?.skinId && hero.skinId !== this.skinId) this.setSkin(hero.skinId);
    const reqFx = hero?.blasterFxId || state.blasterFxId;
    if (reqFx && reqFx !== this.blasterFxId) this.setBlasterFx(reqFx);
    const activeFx = this._syncHydroFxMaterials(time);

    const dt = Math.min(0.05, Math.max(0.001, time - this._lastTime || 0.016));
    this._lastTime = time;

    // Resolve Biome & Purification Progress
    const biomeKey = resolveArchTheme(tower);
    if (biomeKey !== this.biome) {
      this.setBiome(biomeKey);
    }
    const purify = Math.max(
      0,
      Math.min(1, Number(state.purificationProgress ?? tower.healing ?? this.purificationProgress) || 0)
    );
    this.purificationProgress = purify;

    const fh = FLOOR_HEIGHT;
    const aspect = this.towerCam.aspect;
    const isWardrobe = Boolean(state.wardrobeSpotlight && hero);
    const cutscene =
      !isWardrobe && state.cutsceneCam?.active
        ? state.cutsceneCam
        : !isWardrobe && state.cutscene?.active
        ? state.cutscene
        : !isWardrobe && this.cutsceneCam?.active
        ? this.cutsceneCam
        : null;
    const isPurifying = Boolean(
      state.spirePurifying ||
      (cutscene && String(cutscene.kind || '').includes('purif')) ||
      (state.topple?.active && purify > 0.05)
    );
    const isCutscene = Boolean(cutscene);
    const isTitleShowcase =
      !isWardrobe &&
      !isCutscene &&
      (Boolean(state.titleShowcase) || (state.titleShowcase !== false && state.mode === 'title'));

    let csEase = 0;
    let csKind = '';
    if (isCutscene) {
      csKind = String(cutscene.kind || 'prologue').toLowerCase();
      const rawPhase = Math.max(0, Math.min(1, Number(cutscene.phase) || 0));
      if (this._lastCutsceneKind !== csKind) {
        this._lastCutsceneKind = csKind;
        this._cutscenePhaseSmooth = rawPhase;
      } else {
        this._cutscenePhaseSmooth += (rawPhase - this._cutscenePhaseSmooth) * Math.min(1, dt * 4.2);
      }
      const sp = this._cutscenePhaseSmooth;
      csEase = sp * sp * (3 - 2 * sp);
    } else {
      this._lastCutsceneKind = '';
    }

    // Dynamic Aspect-Calibrated Third-Person Camera Framing for V3 World (`TOWER_RADIUS = 3.75`, `FLOOR_HEIGHT = 1.50`)
    const pBaseCol = hero ? hero.col : 0.5;
    const landBlend = Math.max(0, Math.min(1, (aspect - 0.92) / 1.15));
    const tallPhoneBlend = Math.max(0, Math.min(1, (0.74 - aspect) / 0.29)); // 1.0 on 9:20/9:19.5 Android portrait

    const csOrbitCols = isCutscene
      ? csKind.includes('purif') || csKind === 'epilogue'
        ? Math.sin(time * 0.55) * 1.4
        : (csKind.includes('2') || csKind.includes('4') ? 2.8 : -2.8) * (1 - csEase) + Math.sin(time * 0.45) * 0.16
      : 0;

    const effCamCol = isWardrobe
      ? pBaseCol
      : isCutscene
      ? pBaseCol + csOrbitCols
      : isTitleShowcase
      ? pBaseCol + Math.sin(time * 0.30) * (0.42 - landBlend * 0.12)
      : camCol;

    // Portrait (`48° -> 55.5°`) vs Tablet/Desktop/Phone-Landscape (`42° -> 39°`)
    const portraitGameFov = 48 + tallPhoneBlend * 7.5;
    const landscapeGameFov = 42 - Math.max(0, Math.min(1, (aspect - 1.33) / 0.90)) * 3.0;
    const gameplayFov = Math.round((portraitGameFov * (1 - landBlend) + landscapeGameFov * landBlend) * 2) * 0.5;
    const wantFov = isWardrobe ? 44 : isCutscene ? 50 : gameplayFov;
    if (this.towerCam.fov !== wantFov) {
      this.towerCam.fov = wantFov;
      this.towerCam.updateProjectionMatrix();
    }

    // `camZ` frames 1.28x Gateway heroically while keeping spire at `~65–71%` width on `412x915`
    // Android Portrait so BOTH flanks of the living Earth Water Biome vista shine clearly!
    let camZ;
    if (aspect < 0.92) {
      camZ = 19.8 + tallPhoneBlend * 6.8; // 19.8m (3:4) -> 26.6m (9:19.5 portrait: ~65% spire + 35% sunlit flanks!)
    } else {
      const wideLand = Math.max(0, Math.min(1, (aspect - 1.33) / 0.90));
      camZ = 16.2 - wideLand * 1.4; // 16.2m tablet -> 14.8m 1080p / 20:9 landscape
    }

    const posOffY = (1.05 + tallPhoneBlend * 0.48) * (1 - landBlend) + 0.32 * landBlend;
    const tiltUpY = (0.72 + tallPhoneBlend * 0.28) * (1 - landBlend) + 0.38 * landBlend;
    let camY = camFloor * fh + posOffY;
    const shake = writeShakeOffset(state.shake, time, this._shakeVec);

    if (isWardrobe) {
      const pFloorY = (hero.floor || 0) * fh;
      const wardLand = Math.max(0, Math.min(1, (aspect - 1.05) / 1.0));
      const wardY = pFloorY + 0.62 + wardLand * 0.08;
      const wardZ = TOWER_RADIUS + 3.25 + wardLand * 0.55;
      this.towerCam.position.set(0, wardY, wardZ);
      this.towerCam.lookAt(0, pFloorY + 0.58, TOWER_RADIUS + LEDGE_STAND_OFFSET);
    } else if (isTitleShowcase) {
      // Heroic Title Screen Vista framing 1.28x Gateway squarely in the center between Title Crest & CTA!
      const pFloorY = (hero?.floor || 0) * fh;
      const wideLand = Math.max(0, Math.min(1, (aspect - 1.33) / 0.90));
      const showcaseZ = aspect < 0.92 ? 16.4 + tallPhoneBlend * 5.2 : 13.6 - wideLand * 1.1;
      const showcaseX = Math.sin(time * 0.30) * 0.48;
      camY = pFloorY + (1.08 * (1 - landBlend) + 0.94 * landBlend) + Math.sin(time * 0.55) * 0.05;
      const lookY = pFloorY + (0.98 * (1 - landBlend) + 0.92 * landBlend);
      camZ = showcaseZ;
      this.towerCam.position.set(showcaseX, camY, showcaseZ);
      this.towerCam.lookAt(0, lookY, TOWER_RADIUS + LEDGE_STAND_OFFSET * 0.55);
    } else if (isCutscene) {
      const pFloorY = (hero?.floor || 0) * fh;
      const towerTopY = Math.max(18, tower.floors * fh);
      const heroCloseZ = aspect < 0.85 ? TOWER_RADIUS + 6.4 : TOWER_RADIUS + 4.9;
      const breatheY = Math.sin(time * 0.85) * 0.07;

      if (csKind.includes('purif') || csKind === 'epilogue') {
        // Dramatic Spire Purification Crane Zoom-Out as healing water erupts into the watershed!
        const pull = csKind.includes('purif') ? Math.max(0.25, csEase) : Math.max(0, (csEase - 0.35) / 0.65);
        const cz = lerp(TOWER_RADIUS + 6.2, camZ * 1.28, pull);
        const cx = Math.sin(time * 0.62) * (2.2 * pull + 0.6);
        camY = lerp(pFloorY + 1.2, towerTopY * 0.52, pull) + breatheY;
        this.towerCam.position.set(cx, camY, cz);
        this.towerCam.lookAt(0, lerp(pFloorY + 0.8, towerTopY * 0.38, pull), 0);
      } else {
        // Sweeping Act Intro Crane Glide from Spire Vista down to Gateway
        const startY = towerTopY * 0.64;
        camY = lerp(startY, pFloorY + 1.05, csEase) + breatheY;
        const cz = lerp(camZ * 1.12, heroCloseZ, csEase);
        const lookY = lerp(towerTopY * 0.42, pFloorY + 0.68, csEase);
        this.towerCam.position.set(Math.sin(time * 0.45) * 0.85 * (1 - csEase), camY, cz);
        this.towerCam.lookAt(0, lookY, (TOWER_RADIUS + LEDGE_STAND_OFFSET) * csEase);
      }
    } else {
      this.towerCam.position.set(shake.x, camY + shake.y, camZ);
      this.towerCam.lookAt(shake.x, camY + tiltUpY + shake.y, 0);
    }

    // Apply 5-Biome Daylight / Alpenglow / Sunset / Lagoon / Aurora Lighting + `2048x2048` Tight Shadow Band
    const rigSpec = BIOME_LIGHT_RIGS[biomeKey] || BIOME_LIGHT_RIGS.canyon_river;
    const blackout = Math.max(0, Math.min(1, state.blackoutFactor || 0));
    const lightning = Math.max(0, Math.min(1.5, state.lightningFlash || 0));
    const lightMult = Math.max(0.32, 1 - blackout * 0.65) + lightning * 1.2 + purify * 0.12;
    const shadowFocusY = isWardrobe
      ? (hero.floor || 0) * fh + 0.6
      : isTitleShowcase
      ? (hero?.floor || 0) * fh + 2.4
      : camY;

    const skyPreset = this.stormSky?.getBiomeLighting?.(biomeKey) || null;
    this._bgColor.set(skyPreset?.bgColor || rigSpec.bg);
    this._fogColor.set(skyPreset?.fogColor || rigSpec.fog);
    if (purify > 0.01) {
      this._tempColor.set('#38bdf8');
      this._bgColor.lerp(this._tempColor, purify * 0.22);
    }
    this.towerScene.background.copy(this._bgColor);
    this.towerScene.fog.color.copy(this._fogColor);
    this.towerScene.fog.near = Math.max(rigSpec.fogNear, camZ + 12);
    this.towerScene.fog.far = Math.max(rigSpec.fogFar, camZ + 118);
    this.towerScene.environmentIntensity = rigSpec.envInt;

    this.hemiLight.color.set(skyPreset?.hemiSky || rigSpec.hemiSky);
    this.hemiLight.groundColor.set(skyPreset?.hemiGround || rigSpec.hemiGround);
    this.hemiLight.intensity = (skyPreset?.hemiIntensity ?? rigSpec.hemiInt) * lightMult;

    this.keyLight.color.set(skyPreset?.keyColor || rigSpec.sunCol);
    this.keyLight.intensity = (skyPreset?.keyIntensity ?? rigSpec.sunInt) * lightMult;
    this.keyLight.castShadow = true;
    this.keyLight.position.set(
      rigSpec.sunPos[0],
      shadowFocusY + rigSpec.sunPos[1],
      rigSpec.sunPos[2]
    );
    this.keyLight.target.position.set(0, shadowFocusY, 0);
    this.keyLight.target.updateMatrixWorld();

    this.fillLight.color.set(skyPreset?.fillColor || rigSpec.fillCol);
    this.fillLight.intensity = (skyPreset?.fillIntensity ?? rigSpec.fillInt) * lightMult;
    this.rimLight.color.set(skyPreset?.rimColor || rigSpec.rimCol);
    this.rimLight.intensity = (skyPreset?.rimIntensity ?? rigSpec.rimInt) * lightMult;
    this.sunGlintLight.color.set(rigSpec.glintCol);
    this.sunGlintLight.intensity = rigSpec.glintInt * lightMult;

    let showcaseState = state;
    if (isTitleShowcase && !state.titleShowcase) {
      const sp = this._skyStateProxy;
      sp.tower = state.tower;
      sp.camCol = effCamCol;
      sp.camFloor = camFloor;
      sp.waterFloor = state.waterFloor;
      sp.windCurrent = state.windCurrent;
      sp.ledges = state.ledges;
      sp.topple = state.topple;
      sp.player = hero;
      sp.gateway = hero;
      sp.purificationProgress = purify;
      sp.blackoutFactor = state.blackoutFactor;
      sp.lightningFlash = state.lightningFlash;
      sp.titleShowcase = true;
      showcaseState = sp;
    }

    if (this.stormSky) {
      this.stormSky.setPurification?.(purify);
      this.stormSky.update(showcaseState, this.towerCam, time, dt);
    }

    // Swap Cached Spire Architecture Group
    const cached = this._getOrBuildTowerGroup(tower);
    if (this.currentTowerGroup !== cached.group) {
      if (this.currentTowerGroup) this.towerScene.remove(this.currentTowerGroup);
      this.currentTowerGroup = cached.group;
      this.towerScene.add(this.currentTowerGroup);
      if (this.oceanVfx) {
        this.oceanVfx.rebuildForTower(tower, fh, TOWER_RADIUS);
      }
      if (!cached.compiled) {
        try {
          this.webgl.compile(this.towerScene, this.towerCam);
        } catch {
          // Ignore driver fallback
        }
        cached.compiled = true;
      }
    }

    const tg = cached.group;
    tg.rotation.y = -effCamCol * COL_ANGLE;

    // Spire Topple & Purification Crystal-Water Eruption
    const topple = state.topple || { active: false, progress: 0 };
    if (topple.active) {
      tg.position.y = -topple.progress * tower.floors * fh * 0.92;
      tg.rotation.z = Math.sin(time * 34) * 0.035 * (1 - topple.progress) + topple.progress * 0.10;
      tg.position.x = Math.sin(time * 42) * 0.14 * (1 - topple.progress);

      const dp = this.debrisPool;
      dp.inst.visible = true;
      const dm = this._debrisDummy;
      for (let i = 0; i < dp.meta.length; i++) {
        const d = dp.meta[i];
        const u = (d.phase + time * d.speed * 0.55) % 1;
        const arcR = d.rad + u * 2.8;
        const dropY = camY - 2.0 + Math.sin(u * Math.PI) * 9.5 - u * 2.5;
        const swirlA = d.ang + time * 0.65;
        dm.position.set(Math.sin(swirlA) * arcR, dropY, Math.cos(swirlA) * arcR);
        dm.rotation.set(Math.cos(u * Math.PI) * 0.65, swirlA, 0);
        dm.scale.setScalar(d.scale * (1.0 - u * 0.45));
        dm.updateMatrix();
        dp.inst.setMatrixAt(i, dm.matrix);
      }
      dp.inst.instanceMatrix.needsUpdate = true;
    } else {
      tg.position.set(0, 0, 0);
      tg.rotation.z = 0;
      this.debrisPool.inst.visible = false;
    }

    if (isPurifying || topple.active) {
      const towerTopY = tower.floors * fh + tg.position.y;
      this.purificationEruptionGroup.visible = true;
      this.purificationEruptionGroup.position.set(0, Math.max(0, towerTopY * 0.65), 0);
      this.purificationEruptionGroup.rotation.y = time * 1.8;
      const eScale = 0.85 + Math.max(purify, topple.progress || 0) * 0.95;
      this.purificationEruptionGroup.scale.set(eScale, 1.0 + Math.sin(time * 9) * 0.12, eScale);
    } else {
      this.purificationEruptionGroup.visible = false;
    }

    updateTowerArchitecture(cached, state, time, dt);

    // Update Collectibles (`waterDrop`, `waterSeed`, `relic`, `curio`, plus Wave 3 `critterPods`!)
    const rawCols = state.collectibles || [];
    const extraPods = state.critterPods || state.wildlifePods || null;
    const collectibles =
      extraPods && extraPods.length > 0
        ? rawCols.concat(
            extraPods.map((cp) => ({
              col: cp.col,
              floor: cp.floor,
              type: cp.type || 'critterPod',
              collected: Boolean(cp.rescued || cp.collected || cp.freed),
            }))
          )
        : rawCols;
    while (this.collectiblePool.length < collectibles.length) {
      const cDef = collectibles[this.collectiblePool.length];
      const cm = this._buildCollectibleMesh(cDef.type);
      this.collectibleGroup.add(cm);
      this.collectiblePool.push({ mesh: cm, type: cDef.type });
    }
    for (let i = 0; i < this.collectiblePool.length; i++) {
      const slot = this.collectiblePool[i];
      if (i >= collectibles.length || collectibles[i].collected) {
        slot.mesh.visible = false;
        continue;
      }
      const colItem = collectibles[i];
      if (slot.type !== colItem.type) {
        this.collectibleGroup.remove(slot.mesh);
        this._disposeCollectibleMesh(slot.mesh);
        slot.mesh = this._buildCollectibleMesh(colItem.type);
        slot.type = colItem.type;
        this.collectibleGroup.add(slot.mesh);
      }
      const ct = wrapAngle((colItem.col + 0.5 - effCamCol) * COL_ANGLE);
      if (Math.abs(ct) > 1.56 || Math.abs(colItem.floor - camFloor) > 12) {
        slot.mesh.visible = false;
        continue;
      }
      slot.mesh.visible = true;
      const cr = TOWER_RADIUS + LEDGE_STAND_OFFSET;
      slot.mesh.position.set(
        cr * Math.sin(ct),
        colItem.floor * fh + 0.58 + Math.sin(time * 3.5 + i) * 0.09 + (topple.active ? tg.position.y : 0),
        cr * Math.cos(ct)
      );
      slot.mesh.rotation.y = ct + time * (colItem.type === 'relic' ? 1.8 : 2.5);
      if (slot.mesh.userData.holoRing) {
        slot.mesh.userData.holoRing.rotation.x = Math.PI * 0.35 + Math.sin(time * 2.8 + i) * 0.24;
        slot.mesh.userData.holoRing.rotation.z = time * 2.4;
      }
    }

    // Update 39-Bone `GatewayRig`, Tail-Whip Slash, Tail-Grapple Tether, Shield & Landing Ring
    this.muzzleFlashGroup.visible = false;
    this.wardrobeFxOrb.visible = false;
    this.tailWhipVfxGroup.visible = false;
    this.grappleBeam.visible = false;

    if (hero) {
      const pTheta = wrapAngle((hero.col - effCamCol) * COL_ANGLE);
      const standOff = hero.onElevator ? LIFT_STAND_OFFSET : LEDGE_STAND_OFFSET;
      const pr = TOWER_RADIUS + standOff;
      const px = pr * Math.sin(pTheta);
      const pz = pr * Math.cos(pTheta);
      const py = hero.floor * fh + (topple.active ? tg.position.y : 0);

      const inTunnel = Boolean(hero.hidden && hero.tunnelTimer > 0 && !topple.active);
      this.tunnelVortexGroup.visible = inTunnel;
      if (inTunnel) {
        this.tunnelVortexGroup.position.set(px, py + 0.62, pz);
        this.tunnelVortexGroup.rotation.y = pTheta;
        this.tunnelVortexGroup.userData.outerRing.rotation.z = time * 8;
        this.tunnelVortexGroup.userData.innerRing.rotation.z = -time * 11;
      }

      const heroVisible = !hero.hidden && !topple.active;
      this.gatewayRig.group.visible = heroVisible;
      this.landingRingGroup.visible = heroVisible && !isWardrobe && !isCutscene && !isTitleShowcase;
      this.shieldBubble.visible = Boolean(heroVisible && hero.shield);

      if (heroVisible) {
        // 1.28x Hero Visual Stature (`1.185 * 1.28 = 1.517u`, cleanly clearing `1.66u` elevator hoist yokes!)
        const heroScale = isWardrobe ? 1.12 : 1.28;
        this.gatewayRig.group.scale.setScalar(heroScale);
        this.gatewayRig.group.position.set(px, py, pz);
        this.gatewayRig.group.rotation.y =
          pTheta + (isWardrobe ? Math.sin(time * 0.85) * 0.55 : isTitleShowcase ? Math.sin(time * 0.65) * 0.22 : 0);

        const mf = Math.max(0, Number(hero.muzzleFlash || hero.hydroFlash) || 0);
        const whipT = Math.max(0, Number(hero.tailWhipTimer || hero.whipTimer) || 0);

        this.gatewayRig.update(dt, {
          time,
          vx: hero.vx || 0,
          vy: hero.vy || 0,
          facing: hero.facing || 1,
          onGround: Boolean(hero.onGround),
          onElevator: hero.onElevator,
          onStairs: Boolean(hero.onStairs),
          stairSlope: hero.stairSlope ?? hero.stairDir ?? 0,
          wallScamper: Boolean(hero.wallScamper || hero.climbing),
          isSwimming: Boolean(hero.isSwimming),
          tailWhipTimer: whipT,
          frillFlare: hero.frillFlare || 0,
          squashX: hero.squashX || 1,
          squashY: hero.squashY || 1,
          landImpact: hero.landImpact || 0,
          muzzleFlash: mf,
          hurtTimer: hero.hurtTimer || 0,
          invuln: isWardrobe || isCutscene || isTitleShowcase || state.mode === 'title' ? 0 : hero.invuln || 0,
          enteringDoor: hero.enteringDoor || 0,
          anim: hero.anim || null,
          cutscene: isCutscene && !csKind.includes('epilogue'),
          victory: state.mode === 'victory' || (isCutscene && (csKind === 'epilogue' || csKind.includes('purif'))),
        });

        // 360° Crystalline Water-Blade Tail-Whip Slash Arc!
        if (whipT > 0.01 && !isWardrobe) {
          this.tailWhipVfxGroup.visible = true;
          this.tailWhipVfxGroup.position.set(px, py + 0.56, pz);
          this.tailWhipVfxGroup.rotation.y = pTheta + time * 24 * (hero.facing || 1);
          const whipAlpha = Math.min(1, whipT * 3.2);
          this.tailWhipVfxGroup.scale.setScalar(1.0 + (1 - whipAlpha) * 0.35);
          this.tailWhipVfxGroup.userData.slashRing.material.opacity = whipAlpha * 0.9;
          this.tailWhipVfxGroup.userData.innerDisc.material.opacity = whipAlpha * 0.36;
        }

        // Aerial Tail-Grapple Swing Tether!
        if (hero.grappleTarget && hero.grappleTarget.col != null && hero.grappleTarget.floor != null) {
          const gTheta = wrapAngle((hero.grappleTarget.col + 0.5 - effCamCol) * COL_ANGLE);
          const gr = TOWER_RADIUS + LEDGE_STAND_OFFSET;
          this._grappleStart.set(px, py + 0.65, pz);
          this._grappleEnd.set(gr * Math.sin(gTheta), hero.grappleTarget.floor * fh, gr * Math.cos(gTheta));
          const dist = this._grappleStart.distanceTo(this._grappleEnd);
          if (dist > 0.1) {
            this.grappleBeam.visible = true;
            this.grappleBeam.position.copy(this._grappleStart);
            this.grappleBeam.lookAt(this._grappleEnd);
            this.grappleBeam.scale.set(1, 1, dist);
          }
        }

        if (mf > 0.01 && !isWardrobe) {
          const facingDir = hero.facing || 1;
          const mTheta = pTheta + facingDir * 0.11;
          const mr = TOWER_RADIUS + standOff + 0.10;
          const flashScale = Math.min(1.45, 0.6 + mf * 4.5);
          this.muzzleFlashGroup.visible = true;
          this.muzzleFlashGroup.position.set(mr * Math.sin(mTheta), py + 0.64, mr * Math.cos(mTheta));
          this.muzzleFlashGroup.scale.setScalar(flashScale);
          this.muzzleFlashGroup.rotation.set(time * 14, mTheta, time * 18);
          this.heroLight.color.set(activeFx.prismatic ? this._prismColor : activeFx.muzzle);
          this.heroLight.intensity = 1.25;
        } else {
          this.heroLight.color.set('#5efce8');
          this.heroLight.intensity = isTitleShowcase ? 0.58 : 0.38;
        }
        this.heroLight.position.set(px, py + 1.25, pz + 1.35);

        if (isWardrobe) {
          const wUd = this.wardrobeFxOrb.userData;
          const wardLand = Math.max(0, Math.min(1, (aspect - 1.05) / 1.0));
          this.wardrobeFxOrb.visible = true;
          this.wardrobeFxOrb.position.set(
            0.38 + wardLand * 0.22,
            py + 0.68 + Math.sin(time * 3.2) * 0.03,
            TOWER_RADIUS + standOff + 0.12
          );
          this.wardrobeFxOrb.scale.setScalar(0.42);
          wUd.icosa.visible = activeFx.shape !== 'prism';
          wUd.prism.visible = activeFx.shape === 'prism';
          wUd.ring.visible = Boolean(activeFx.ring);
          wUd.icosa.rotation.set(time * 3.5, time * 4.8, 0);
          wUd.prism.rotation.set(time * 3.2, time * 5.0, 0);
          wUd.ring.rotation.set(Math.PI * 0.3 + time * 3.0, time * 4.2, 0);
          wUd.trailCluster.rotation.set(Math.sin(time * 2.4) * 0.18, time * 4.2, 0);
        }

        if (this.shieldBubble.visible) {
          this.shieldBubble.position.set(px, py + 0.62, pz);
          this.shieldBubble.rotation.y = time * 1.8;
        }

        const waterFl = state.waterFloor != null ? state.waterFloor : -0.55;
        const lf = hero.landingFloor != null ? hero.landingFloor : waterFl;
        const dist = Math.max(0, (hero.floor - lf) * fh);
        this.landingRingGroup.position.set(px, lf * fh + 0.035, pz);
        this.landingRingGroup.scale.setScalar(Math.max(0.55, 1.15 - dist * 0.08));
        const overWater = lf <= waterFl + 0.08;
        this.landingRingGroup.userData.ring.material.color.set(overWater ? '#fb7185' : '#5efce8');
        this.landingRingGroup.userData.ring.material.opacity = Math.max(0.24, 0.78 - dist * 0.11);
      }
    }

    // Update 7 Original Articulated Enemies + Barnacle Mortar Projectiles (`src/enemyRig.js`)
    if (this.enemyVisuals) {
      this._enemyExtraOpts.enemyProjectiles = state.enemyProjectiles || null;
      this.enemyVisuals.syncEnemies(
        state.enemies,
        effCamCol,
        fh,
        TOWER_RADIUS,
        time,
        topple.active ? tg.position.y : 0,
        this._enemyExtraOpts
      );
      this._trimEnemyShadows();
    }

    // Front-Hemisphere Architectural Accent PointLight (Sanctum Doors & Elevator Cabs)
    if (!isWardrobe) {
      const toppleOffY = topple.active ? tg.position.y : 0;
      let bestDist = 999;
      let poolX = 0;
      let poolY = 0;
      let poolZ = 0;
      let poolHex = '#5efce8';

      const doors = tower.doors;
      if (doors) {
        for (let i = 0; i < doors.length; i++) {
          const d = doors[i];
          const isSanctum = Boolean(d.isSanctum || d.isRune || d.rune);
          const isVault = Boolean(d.isVault || d.vault);
          if (!d.isExit && !isSanctum && !isVault) continue;
          const dTheta = wrapAngle((d.col + 0.5 - effCamCol) * COL_ANGLE);
          if (Math.abs(dTheta) > 1.35) continue;
          const dy = d.floor * fh + 0.72 + toppleOffY;
          const dist = Math.abs(dy - shadowFocusY) + Math.abs(dTheta) * 1.6;
          if (dist < bestDist) {
            bestDist = dist;
            const lr = TOWER_RADIUS + 0.85;
            poolX = lr * Math.sin(dTheta);
            poolY = dy;
            poolZ = lr * Math.cos(dTheta);
            poolHex = isSanctum ? '#2efce0' : isVault ? '#fde047' : '#38bdf8';
          }
        }
      }
      if (bestDist < 12.0) {
        this.archAccentLight.color.set(poolHex);
        this.archAccentLight.intensity = 1.65 * lightMult;
        this.archAccentLight.position.set(poolX, poolY, poolZ);
      } else {
        this.archAccentLight.intensity = 0;
      }
    } else {
      this.archAccentLight.intensity = 0;
    }

    // Update Hydro-Pulse Projectiles (`state.snowballs || state.pulses || state.projectiles`)
    const pulses = state.hydroPulses || state.snowballs || [];
    while (this.pulsePool.length < pulses.length) {
      const fxNode = this._buildHydroPulseNode();
      this.pulseGroup.add(fxNode);
      this.pulsePool.push(fxNode);
    }
    for (let i = 0; i < this.pulsePool.length; i++) {
      const m = this.pulsePool[i];
      if (i >= pulses.length) {
        m.visible = false;
        continue;
      }
      const sb = pulses[i];
      const st = wrapAngle((sb.col - effCamCol) * COL_ANGLE);
      if (Math.abs(st) > 1.58) {
        m.visible = false;
        continue;
      }
      m.visible = true;
      const sr = TOWER_RADIUS + LEDGE_STAND_OFFSET;
      m.position.set(sr * Math.sin(st), sb.floor * fh + 0.52, sr * Math.cos(st));
      m.rotation.y = st;

      const ud = m.userData;
      ud.icosa.visible = activeFx.shape !== 'prism';
      ud.prism.visible = activeFx.shape === 'prism';
      ud.ring.visible = Boolean(activeFx.ring);
      ud.icosa.rotation.set(time * 6, time * 8, 0);
      ud.prism.rotation.set(time * 6, time * 10, 0);
      ud.ring.rotation.set(Math.PI * 0.32 + time * 6, time * 8, 0);

      const sbDir = sb.dir || (sb.vx >= 0 ? 1 : -1);
      ud.trailCluster.scale.x = sbDir;
      ud.trailCluster.position.y = Math.sin(time * 22 + i) * 0.025;
    }

    // Update Living Biome Water (`src/water.js`) + Rising Floodgate / Surge Waterline
    const waterY = (state.waterFloor != null ? state.waterFloor : -0.55) * fh;
    if (this.ocean) {
      if (this._lastOceanBiome !== biomeKey) {
        this._lastOceanBiome = biomeKey;
        if (this.ocean.setTheme) this.ocean.setTheme(biomeKey);
        else this.ocean.setEra?.('reboot', biomeKey);
      }
      this.ocean.setPurification?.(purify);
      const sunDir = this.stormSky?.getSunDirection?.() || this.stormSky?.getMoonDirection?.();
      if (sunDir) {
        if (this.ocean.setSunlight) this.ocean.setSunlight({ direction: sunDir });
        else this.ocean.setMoonlight?.({ direction: sunDir });
      }
      this.ocean.update(time, {
        waterY,
        lightningFlash: lightning,
        towerRadius: TOWER_RADIUS,
        purificationProgress: purify,
      });
    }

    if (this.oceanVfx) {
      this.oceanVfx.setPurification?.(purify);
      if (isWardrobe || (isTitleShowcase && (hero?.floor || 0) < 0.85)) {
        this.oceanVfx.setVisible?.(false);
      } else {
        this.oceanVfx.setVisible?.(true);
        this.oceanVfx.update(showcaseState, effCamCol, time, dt);
      }
    }

    this._syncParticles(
      this.particlePool,
      this.particleGroup,
      state.particles,
      this.towerCam,
      TOWER_RADIUS + 0.65,
      effCamCol,
      true,
      fh
    );
    this._syncPopups(state.popups, effCamCol, this.popupGroup, this.towerCam, true, fh);
    this.collectibleGroup.visible = !isWardrobe;
    if (isWardrobe && this.enemyVisuals?.root) {
      this.enemyVisuals.root.visible = false;
    }

    // Planar Water Reflection Pass (culls dynamic micro-props so reflection renders sky + vistas + spire cleanly)
    if (this.ocean) {
      const prevWeatherVis = this.stormSky?.weatherPoints?.visible ?? false;
      const prevStreakVis = this.stormSky?.streakLines?.visible ?? false;
      const prevSprayVis = this.stormSky?.seaSprayPoints?.visible ?? false;
      const prevFireflyVis = this.stormSky?.fireflyPoints?.visible ?? false;
      const prevFlankMistVis = this.stormSky?.flankMistMesh?.visible ?? false;
      const prevEnemyRootVis = this.enemyVisuals?.root?.visible ?? !isWardrobe;
      const prevHeroVis = this.gatewayRig.group.visible;
      const prevShieldVis = this.shieldBubble.visible;
      const prevWhipVis = this.tailWhipVfxGroup.visible;
      const prevGrappleVis = this.grappleBeam.visible;
      const prevRingVis = this.landingRingGroup.visible;
      const prevTunnelVis = this.tunnelVortexGroup.visible;
      const prevFlashVis = this.muzzleFlashGroup.visible;
      const prevWardrobeVis = this.wardrobeFxOrb.visible;
      const prevDebrisVis = this.debrisPool.inst.visible;
      const prevVfxVis = this.oceanVfx?.group?.visible ?? !isWardrobe;
      const prevCollectibleVis = this.collectibleGroup.visible;
      const prevKeyShadow = this.keyLight.castShadow;

      try {
        this.keyLight.castShadow = false;
        cached.setReflectionPass?.(true);
        if (this.enemyVisuals) {
          if (this.enemyVisuals.setReflectionPass) this.enemyVisuals.setReflectionPass(true);
          else if (this.enemyVisuals.root) this.enemyVisuals.root.visible = false;
        }
        this.stormSky?.setReflectionPass?.(true);
        this.gatewayRig.group.visible = false;
        this.shieldBubble.visible = false;
        this.tailWhipVfxGroup.visible = false;
        this.grappleBeam.visible = false;
        this.landingRingGroup.visible = false;
        this.tunnelVortexGroup.visible = false;
        this.muzzleFlashGroup.visible = false;
        this.wardrobeFxOrb.visible = false;
        this.debrisPool.inst.visible = false;
        this.oceanVfx?.setVisible?.(false);
        this.collectibleGroup.visible = false;
        this.pulseGroup.visible = false;
        this.particleGroup.visible = false;
        this.popupGroup.visible = false;

        this.ocean.updateReflection(this.towerScene, this.towerCam);
      } finally {
        cached.setReflectionPass?.(false);
        if (this.enemyVisuals) {
          if (this.enemyVisuals.setReflectionPass) this.enemyVisuals.setReflectionPass(isWardrobe);
          if (this.enemyVisuals.root) this.enemyVisuals.root.visible = prevEnemyRootVis;
        }
        this.stormSky?.setReflectionPass?.(false);
        if (this.stormSky?.weatherPoints) this.stormSky.weatherPoints.visible = prevWeatherVis;
        if (this.stormSky?.streakLines) this.stormSky.streakLines.visible = prevStreakVis;
        if (this.stormSky?.seaSprayPoints) this.stormSky.seaSprayPoints.visible = prevSprayVis;
        if (this.stormSky?.fireflyPoints) this.stormSky.fireflyPoints.visible = prevFireflyVis;
        if (this.stormSky?.flankMistMesh) this.stormSky.flankMistMesh.visible = prevFlankMistVis;
        this.gatewayRig.group.visible = prevHeroVis;
        this.shieldBubble.visible = prevShieldVis;
        this.tailWhipVfxGroup.visible = prevWhipVis;
        this.grappleBeam.visible = prevGrappleVis;
        this.landingRingGroup.visible = prevRingVis;
        this.tunnelVortexGroup.visible = prevTunnelVis;
        this.muzzleFlashGroup.visible = prevFlashVis;
        this.wardrobeFxOrb.visible = prevWardrobeVis;
        this.debrisPool.inst.visible = prevDebrisVis;
        this.oceanVfx?.setVisible?.(prevVfxVis);
        this.collectibleGroup.visible = prevCollectibleVis;
        this.pulseGroup.visible = true;
        this.particleGroup.visible = true;
        this.popupGroup.visible = true;
        this.keyLight.castShadow = prevKeyShadow;
      }
    }

    this.webgl.shadowMap.needsUpdate = true;
    this._renderWithComposer(this.towerScene, this.towerCam, {
      biome: biomeKey,
      purification: purify,
      flash: lightning,
      darkness: blackout,
    });
  }

  renderCoreDescentScene(state) {
    const hero = state.gateway || state.player;
    const nextSkin = hero?.skinId || state.skinId;
    if (nextSkin && nextSkin !== this.skinId) this.setSkin(nextSkin);
    const sr = this._ensureSubRenderer();
    if (!sr) return;
    const time = state.time ?? state.coreDescent?.timer ?? 0;
    this._lastTime = time;
    sr.renderCoreDescent(state, {
      time,
      shake: state.shake,
      skinId: this.skinId,
    });
  }

  renderSubmarineScene(state) {
    if (!state?.reefSwim && !state?.subStage && !state?.sub) return;
    const hero = state.gateway || state.player;
    const nextSkin = hero?.skinId || state.skinId;
    if (nextSkin && nextSkin !== this.skinId) this.setSkin(nextSkin);
    const reqFx = hero?.blasterFxId || state.blasterFxId;
    if (reqFx && reqFx !== this.blasterFxId) this.setBlasterFx(reqFx);

    const sr = this._ensureSubRenderer();
    if (!sr) return;
    if (typeof state.showSubHud === 'boolean') {
      sr.showHud = state.showSubHud;
    }
    const time = state.time ?? state.reefSwim?.t ?? state.subStage?.t ?? state.sub?.timer ?? 0;
    this._lastTime = time;
    sr.render(state, {
      time,
      particles: state.particles,
      popups: state.popups,
      shake: state.shake,
      skinId: this.skinId,
      blasterFxId: this.blasterFxId,
    });
  }

  renderSkimmerScene(state) {
    if (!state?.rapidsSurf && !state?.rapids && !state?.skimmer) return;
    const hero = state.gateway || state.player;
    const nextSkin = hero?.skinId || state.skinId;
    if (nextSkin && nextSkin !== this.skinId) this.setSkin(nextSkin);
    const reqFx = hero?.blasterFxId || state.blasterFxId;
    if (reqFx && reqFx !== this.blasterFxId) this.setBlasterFx(reqFx);

    const sr = this._ensureSkimmerRenderer();
    if (!sr) return;
    sr.render(state, { postfx: this.postfx });
  }

  renderGlideScene(state) {
    const stage = state?.frillGlide || state?.glideStage || state?.glide;
    if (!stage) return;
    const hero = state.gateway || state.player;
    const nextSkin = hero?.skinId || state.skinId;
    if (nextSkin && nextSkin !== this.skinId) this.setSkin(nextSkin);

    const gr = this._ensureGlideRenderer();
    if (!gr) return;
    const time = state.time || 0;
    const dt = Math.min(0.05, Math.max(0.001, time - this._lastTime || 0.016));
    this._lastTime = time;

    const prevAutoClear = this.webgl.autoClear;
    const prevToneMapping = this.webgl.toneMapping;
    const prevExposure = this.webgl.toneMappingExposure;
    try {
      this.webgl.setRenderTarget(null);
      gr.render(stage, {
        time,
        dt,
        particles: state.particles,
        popups: state.popups,
        shake: state.shake,
        skinId: this.skinId,
        player: hero,
      });
    } finally {
      this.webgl.setRenderTarget(null);
      this.webgl.autoClear = prevAutoClear;
      this.webgl.toneMapping = prevToneMapping;
      this.webgl.toneMappingExposure = prevExposure;
    }
  }

  renderPuzzleScene(state) {
    const room = state?.puzzleRoom || state?.puzzle;
    if (!room) return;
    const hero = state.gateway || state.player;
    const nextSkin = hero?.skinId || state.skinId;
    if (nextSkin && nextSkin !== this.skinId) this.setSkin(nextSkin);

    const pr = this._ensurePuzzleRenderer();
    if (!pr) return;
    const time = state.time || 0;
    const dt = Math.min(0.05, Math.max(0.001, time - this._lastTime || 0.016));
    this._lastTime = time;

    const prevAutoClear = this.webgl.autoClear;
    const prevToneMapping = this.webgl.toneMapping;
    const prevExposure = this.webgl.toneMappingExposure;
    const prevShadowAuto = this.webgl.shadowMap.autoUpdate;
    try {
      this.webgl.setRenderTarget(null);
      this.webgl.shadowMap.autoUpdate = true;
      this.webgl.shadowMap.needsUpdate = true;
      pr.render(room, {
        time,
        dt,
        particles: state.particles,
        popups: state.popups,
        shake: state.shake,
        skinId: this.skinId,
        player: hero,
      });
    } finally {
      this.webgl.setRenderTarget(null);
      this.webgl.autoClear = prevAutoClear;
      this.webgl.toneMapping = prevToneMapping;
      this.webgl.toneMappingExposure = prevExposure;
      this.webgl.shadowMap.autoUpdate = prevShadowAuto;
    }
  }

  renderVaultScene(state) {
    if (!state?.vault && !state?.sanctumVault) return;
    const vr = this._ensureVaultRenderer();
    if (!vr) return;
    vr.render(state, { postfx: this.postfx });
  }

  dispose() {
    if (this.towerCache) {
      for (const entry of this.towerCache.values()) {
        disposeTowerArchitecture(entry);
      }
      this.towerCache.clear();
    }
    for (let i = 0; i < this.collectiblePool.length; i++) {
      this._disposeCollectibleMesh(this.collectiblePool[i].mesh, false);
    }
    this.collectiblePool.length = 0;
    if (this._collectibleMats) {
      for (const mat of this._collectibleMats.values()) {
        mat?.dispose();
      }
      this._collectibleMats.clear();
    }
    this.particleInstGeo?.dispose();
    this.particleInstMat?.dispose();
    this.particlePool.length = 0;
    for (let i = 0; i < this.popupPool.length; i++) {
      this.popupPool[i].sprite.material?.map?.dispose();
      this.popupPool[i].sprite.material?.dispose();
    }
    this.popupPool.length = 0;

    this.stormSky?.dispose?.();
    this.ocean?.dispose?.();
    this.oceanVfx?.dispose?.();
    this.enemyVisuals?.dispose?.();
    this.postfx?.dispose?.();
    this.gatewayRig?.dispose?.();
    this.subRenderer?.dispose?.();
    this.skimmerRenderer?.dispose?.();
    this.vaultRenderer?.dispose?.();
    this.glideRenderer?.dispose?.();
    this.puzzleRenderer?.dispose?.();

    this.debrisPool?.geo?.dispose();
    this.debrisPool?.mat?.dispose();
    this.shieldBubble?.geometry?.dispose();
    this.shieldBubble?.material?.dispose();
    this.grappleBeam?.geometry?.dispose();
    this.grappleBeam?.material?.dispose();
    this._disposeCollectibleMesh(this.tailWhipVfxGroup, true);
    this._disposeCollectibleMesh(this.purificationEruptionGroup, true);
    this._disposeCollectibleMesh(this.landingRingGroup, true);
    this._disposeCollectibleMesh(this.tunnelVortexGroup, true);

    this.sharedParticleGeo?.dispose();
    this.sharedPulseGeo?.dispose();
    this.sharedPrismGeo?.dispose();
    this.sharedFxRingGeo?.dispose();
    this.sharedTrailDotGeo?.dispose();
    this.sharedTrailClusterGeo?.dispose();
    this.sharedOrbitalTrailGeo?.dispose();
    this.sharedWaterDropGeo?.dispose();
    this.sharedPulseMat?.dispose();
    this.sharedFxRingMat?.dispose();
    this.sharedTrailDotMat?.dispose();
    this.sharedHaloSpriteMat?.dispose();
    this.sharedWaterDropMat?.dispose();
    this.glowDotTex?.dispose();
    this.relicTabletTex?.dispose();
    this.keyLight?.shadow?.map?.dispose?.();
    if (this._biomeEnvMaps) {
      for (const tex of this._biomeEnvMaps.values()) {
        tex?.dispose?.();
      }
      this._biomeEnvMaps.clear();
    }
    this.webgl?.dispose();
  }
}

export default GameRenderer;
