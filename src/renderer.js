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
  buildArchShaderWarmupGroup,
  prewarmArchSurfaces,
  getLoadedArchTextures,
  getBakedArchWebpVersion,
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
  ctx.clearRect(0, 0, 64, 64);
  // Smooth feathered radial disc reaching 0.0 alpha well before quad edges (ZERO square borders!)
  const g = ctx.createRadialGradient(32, 32, 1, 32, 32, 27);
  g.addColorStop(0.0, 'rgba(255, 255, 255, 0.96)');
  g.addColorStop(0.32, 'rgba(255, 255, 255, 0.68)');
  g.addColorStop(0.64, 'rgba(255, 255, 255, 0.22)');
  g.addColorStop(0.86, 'rgba(255, 255, 255, 0.0)');
  g.addColorStop(1.0, 'rgba(255, 255, 255, 0.0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createTurntableHaloTexture() {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 256;
  const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, 256, 256);

  // Soft feathered radial Pelagian sea-glass contact glow (reaches 0.0 alpha well inside edges!)
  const base = ctx.createRadialGradient(128, 128, 10, 128, 128, 118);
  base.addColorStop(0.0, 'rgba(110, 245, 235, 0.22)');
  base.addColorStop(0.55, 'rgba(56, 189, 248, 0.14)');
  base.addColorStop(0.76, 'rgba(94, 252, 232, 0.36)');
  base.addColorStop(0.84, 'rgba(253, 224, 71, 0.18)');
  base.addColorStop(0.93, 'rgba(94, 252, 232, 0.0)');
  base.addColorStop(1.0, 'rgba(94, 252, 232, 0.0)');
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, 256, 256);

  // Delicate Pelagian compass filigree ticks & scalloped wave arc
  ctx.save();
  ctx.translate(128, 128);
  ctx.strokeStyle = 'rgba(248, 210, 96, 0.62)';
  ctx.lineWidth = 2.0;
  ctx.beginPath();
  ctx.arc(0, 0, 74, 0, TWO_PI);
  ctx.stroke();

  ctx.strokeStyle = 'rgba(125, 249, 240, 0.54)';
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  ctx.arc(0, 0, 96, 0, TWO_PI);
  ctx.stroke();

  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * TWO_PI;
    const isMajor = i % 4 === 0;
    ctx.strokeStyle = isMajor ? 'rgba(253, 224, 71, 0.78)' : 'rgba(125, 249, 240, 0.44)';
    ctx.lineWidth = isMajor ? 2.6 : 1.5;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * (isMajor ? 66 : 74), Math.sin(a) * (isMajor ? 66 : 74));
    ctx.lineTo(Math.cos(a) * (isMajor ? 102 : 92), Math.sin(a) * (isMajor ? 102 : 92));
    ctx.stroke();
  }
  ctx.restore();

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createHydroSlashTexture() {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 128;
  const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, 256, 128);

  // Horizontal U = sweep along crescent (0 = leading blade head, 1 = feathered foam tail)
  // Vertical V = across blade width (0 = outer cutting edge, 1 = inner mist edge)
  for (let y = 0; y < 128; y++) {
    const v = y / 127;
    // Sharp bright leading ridge near v = 0.22, feathering cleanly to 0 at v = 0 and v = 1
    const edgeIn = Math.min(1, v / 0.14);
    const edgeOut = Math.pow(Math.max(0, 1 - Math.max(0, (v - 0.18) / 0.82)), 1.65);
    const crossAlpha = edgeIn * edgeOut;
    const ridgeBoost = Math.exp(-Math.pow((v - 0.20) / 0.11, 2));

    const grad = ctx.createLinearGradient(0, y, 256, y);
    const aHead = Math.min(1, crossAlpha * (0.85 + ridgeBoost * 0.45));
    const aMid = Math.min(1, crossAlpha * (0.68 + ridgeBoost * 0.32));
    const aTail = Math.min(1, crossAlpha * 0.22);

    const r = Math.round(56 + ridgeBoost * 190);
    const g = Math.round(196 + ridgeBoost * 59);
    const b = 255;

    grad.addColorStop(0.0, `rgba(${r}, ${g}, ${b}, 0.0)`);
    grad.addColorStop(0.08, `rgba(${r}, ${g}, ${b}, ${aHead.toFixed(3)})`);
    grad.addColorStop(0.36, `rgba(${Math.round(r * 0.88)}, ${g}, 250, ${aMid.toFixed(3)})`);
    grad.addColorStop(0.76, `rgba(45, 212, 191, ${aTail.toFixed(3)})`);
    grad.addColorStop(1.0, 'rgba(14, 165, 233, 0.0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, y, 256, 1);
  }

  // Flowing directional hydro-velocity ribbons & seafoam spray flecks
  ctx.globalCompositeOperation = 'lighter';
  for (let s = 0; s < 14; s++) {
    const sy = 14 + (s * 7.2) % 86;
    const sx = 10 + (s * 29) % 130;
    const len = 58 + (s % 4) * 28;
    const lg = ctx.createLinearGradient(sx, sy, sx + len, sy);
    lg.addColorStop(0.0, 'rgba(235, 254, 255, 0.0)');
    lg.addColorStop(0.28, 'rgba(225, 252, 255, 0.55)');
    lg.addColorStop(0.75, 'rgba(94, 252, 232, 0.22)');
    lg.addColorStop(1.0, 'rgba(56, 189, 248, 0.0)');
    ctx.strokeStyle = lg;
    ctx.lineWidth = s < 5 ? 3.2 : 1.8;
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.quadraticCurveTo(sx + len * 0.5, sy + ((s % 2 === 0 ? 1 : -1) * 4.5), sx + len, sy + 2);
    ctx.stroke();
  }
  // Delicate mist droplets in the trailing wake
  for (let d = 0; d < 26; d++) {
    const dx = 36 + ((d * 53) % 195);
    const dy = 20 + ((d * 37) % 82);
    const dr = 1.6 + (d % 3) * 1.1;
    const dg = ctx.createRadialGradient(dx, dy, 0.2, dx, dy, dr * 2.2);
    dg.addColorStop(0.0, 'rgba(240, 254, 255, 0.65)');
    dg.addColorStop(1.0, 'rgba(94, 252, 232, 0.0)');
    ctx.fillStyle = dg;
    ctx.beginPath();
    ctx.arc(dx, dy, dr * 2.2, 0, TWO_PI);
    ctx.fill();
  }
  ctx.globalCompositeOperation = 'source-over';

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createHydroWakeTexture() {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 128;
  const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, 128, 128);

  // Spiraling diagonal liquid slipstream ribbons fading cleanly to 0 at top & bottom ends
  for (let i = 0; i < 6; i++) {
    const x0 = (i / 6) * 128;
    const grad = ctx.createLinearGradient(0, 0, 0, 128);
    grad.addColorStop(0.0, 'rgba(235, 254, 255, 0.0)');
    grad.addColorStop(0.22, 'rgba(220, 252, 255, 0.78)');
    grad.addColorStop(0.62, 'rgba(94, 252, 232, 0.42)');
    grad.addColorStop(1.0, 'rgba(56, 189, 248, 0.0)');
    ctx.strokeStyle = grad;
    ctx.lineWidth = i % 2 === 0 ? 7.5 : 4.2;
    ctx.beginPath();
    ctx.moveTo(x0, 4);
    ctx.bezierCurveTo(x0 + 26, 42, x0 + 44, 86, x0 + 64, 124);
    ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createHydroBurstTexture() {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 128;
  const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, 128, 128);

  const core = ctx.createRadialGradient(64, 64, 2, 64, 64, 54);
  core.addColorStop(0.0, 'rgba(255, 255, 255, 0.94)');
  core.addColorStop(0.24, 'rgba(186, 248, 255, 0.68)');
  core.addColorStop(0.54, 'rgba(56, 189, 248, 0.24)');
  core.addColorStop(0.86, 'rgba(56, 189, 248, 0.0)');
  core.addColorStop(1.0, 'rgba(56, 189, 248, 0.0)');
  ctx.fillStyle = core;
  ctx.fillRect(0, 0, 128, 128);

  // Organic 7-petal water-splash crown rays + micro droplets
  ctx.save();
  ctx.translate(64, 64);
  for (let i = 0; i < 7; i++) {
    const ang = (i / 7) * TWO_PI + (i % 2) * 0.14;
    const len = 36 + (i % 3) * 9;
    ctx.save();
    ctx.rotate(ang);
    const rg = ctx.createLinearGradient(0, 0, len, 0);
    rg.addColorStop(0.0, 'rgba(255, 255, 255, 0.85)');
    rg.addColorStop(0.45, 'rgba(125, 245, 255, 0.42)');
    rg.addColorStop(1.0, 'rgba(56, 189, 248, 0.0)');
    ctx.fillStyle = rg;
    ctx.beginPath();
    ctx.moveTo(4, -4.5);
    ctx.quadraticCurveTo(len * 0.52, -7.2, len, 0);
    ctx.quadraticCurveTo(len * 0.52, 7.2, 4, 4.5);
    ctx.closePath();
    ctx.fill();

    // Detached outer splash droplet
    const dropR = len + 6;
    const dg = ctx.createRadialGradient(dropR, 0, 0.5, dropR, 0, 4.5);
    dg.addColorStop(0.0, 'rgba(235, 254, 255, 0.72)');
    dg.addColorStop(1.0, 'rgba(94, 252, 232, 0.0)');
    ctx.fillStyle = dg;
    ctx.beginPath();
    ctx.arc(dropR, 0, 4.5, 0, TWO_PI);
    ctx.fill();
    ctx.restore();
  }
  ctx.restore();

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createBraidedTetherTexture() {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 256;
  const ctx = c.getContext('2d');

  // Luminous translucent deep-turquoise water core (ZERO dark/black stripes!)
  const bgGrad = ctx.createLinearGradient(0, 0, 128, 0);
  bgGrad.addColorStop(0.0, '#0284c7');
  bgGrad.addColorStop(0.5, '#0ea5e9');
  bgGrad.addColorStop(1.0, '#0284c7');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, 128, 256);

  // Softly braided flowing turquoise water-tendrils (`#0284c7` -> `#38bdf8` -> `#a5f3fc`) + subtle gold thread!
  ctx.lineCap = 'round';
  for (let pass = -2; pass <= 4; pass++) {
    const yOff = pass * 64;
    // Primary aqua water-stream weave
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.72)';
    ctx.lineWidth = 26;
    ctx.beginPath();
    ctx.moveTo(-16, yOff);
    ctx.lineTo(144, yOff + 128);
    ctx.stroke();

    ctx.strokeStyle = 'rgba(165, 243, 252, 0.84)';
    ctx.lineWidth = 9;
    ctx.beginPath();
    ctx.moveTo(-16, yOff - 2);
    ctx.lineTo(144, yOff + 126);
    ctx.stroke();

    // Counter-woven translucent sea-glass tendril
    ctx.strokeStyle = 'rgba(34, 211, 238, 0.56)';
    ctx.lineWidth = 20;
    ctx.beginPath();
    ctx.moveTo(144, yOff + 16);
    ctx.lineTo(-16, yOff + 144);
    ctx.stroke();

    ctx.strokeStyle = 'rgba(224, 250, 255, 0.65)';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(144, yOff + 14);
    ctx.lineTo(-16, yOff + 142);
    ctx.stroke();

    // Delicate subtle golden filigree filament woven gently through the water-braid
    ctx.strokeStyle = 'rgba(253, 224, 71, 0.36)';
    ctx.lineWidth = 2.8;
    ctx.beginPath();
    ctx.moveTo(144, yOff + 22);
    ctx.lineTo(-16, yOff + 150);
    ctx.stroke();
  }

  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createTunnelDepthTexture() {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 128;
  const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, 128, 128);
  const g = ctx.createRadialGradient(64, 64, 6, 64, 64, 58);
  g.addColorStop(0.0, 'rgba(3, 15, 28, 0.92)');
  g.addColorStop(0.45, 'rgba(6, 28, 48, 0.72)');
  g.addColorStop(0.74, 'rgba(12, 54, 76, 0.28)');
  g.addColorStop(0.92, 'rgba(14, 72, 92, 0.0)');
  g.addColorStop(1.0, 'rgba(14, 72, 92, 0.0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createTunnelSpiralTexture() {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 256;
  const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, 256, 256);

  ctx.save();
  ctx.translate(128, 128);

  // Subtle ambient recessed aqua ring glow (fades cleanly to 0 before outer edge)
  const halo = ctx.createRadialGradient(0, 0, 16, 0, 0, 114);
  halo.addColorStop(0.0, 'rgba(56, 189, 248, 0.34)');
  halo.addColorStop(0.55, 'rgba(45, 212, 191, 0.22)');
  halo.addColorStop(0.84, 'rgba(56, 189, 248, 0.0)');
  halo.addColorStop(1.0, 'rgba(56, 189, 248, 0.0)');
  ctx.fillStyle = halo;
  ctx.fillRect(-128, -128, 256, 256);

  // 4 graceful logarithmic Pelagian water-spiral arms + fine antique-gold current threads
  const arms = 4;
  for (let a = 0; a < arms; a++) {
    const baseAng = (a / arms) * TWO_PI;
    const isGoldAccent = a % 2 === 1;
    for (let step = 0; step < 52; step++) {
      const t0 = step / 52;
      const t1 = (step + 1) / 52;
      const r0 = 14 + t0 * 96;
      const r1 = 14 + t1 * 96;
      const ang0 = baseAng + t0 * Math.PI * 1.95;
      const ang1 = baseAng + t1 * Math.PI * 1.95;
      const fade = Math.sin(t0 * Math.PI) * (1 - t0 * 0.28);
      ctx.strokeStyle = isGoldAccent
        ? `rgba(245, 208, 92, ${(fade * 0.56).toFixed(3)})`
        : `rgba(94, 248, 236, ${(fade * 0.78).toFixed(3)})`;
      ctx.lineWidth = (1 - t0 * 0.55) * (isGoldAccent ? 4.2 : 6.8);
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(Math.cos(ang0) * r0, Math.sin(ang0) * r0);
      ctx.lineTo(Math.cos(ang1) * r1, Math.sin(ang1) * r1);
      ctx.stroke();
    }
  }
  ctx.restore();

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/**
 * Builds a 3D sculpted, tapered crescent water-blade ribbon geometry with dynamic wave camber
 * so Tail-Whip looks like a crisp feathered crescent hydro-slash instead of a flat torus/disc!
 */
function buildCrescentSlashGeo(innerR = 0.54, outerR = 1.18, arcAngle = Math.PI * 1.48, waveAmp = 0.09, segs = 36) {
  const positions = [];
  const uvs = [];
  const indices = [];

  for (let i = 0; i <= segs; i++) {
    const t = i / segs; // 0 = leading blade head, 1 = feathered wake tip
    const ang = -t * arcAngle;
    // Broad sharp crescent head swelling quickly then tapering smoothly to a fine tip
    const headEnvelope = Math.sin(Math.min(1, t / 0.16) * Math.PI * 0.5);
    const tailTaper = Math.pow(Math.max(0, 1 - t), 0.72);
    const widthScale = headEnvelope * (0.14 + 0.86 * tailTaper);

    const midR = (innerR + outerR) * 0.5 + (1 - t) * 0.06;
    const halfW = (outerR - innerR) * 0.5 * widthScale;
    const rOut = midR + halfW;
    const rIn = Math.max(0.28, midR - halfW);

    // Sculpted 3D wave camber & slight cutting-edge bevel lift
    const yBase = Math.sin(t * Math.PI * 1.15) * waveAmp;
    const yOut = yBase + 0.048 * widthScale;
    const yIn = yBase - 0.032 * widthScale;

    const ca = Math.cos(ang);
    const sa = Math.sin(ang);

    positions.push(rOut * ca, yOut, rOut * sa);
    uvs.push(t, 0.0);

    positions.push(rIn * ca, yIn, rIn * sa);
    uvs.push(t, 1.0);

    if (i < segs) {
      const base = i * 2;
      indices.push(base, base + 1, base + 2);
      indices.push(base + 1, base + 3, base + 2);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
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
 * Prewarms ALL 5 Earth Water Biome HDR PMREM IBL cubemaps ONCE at startup using a single shared
 * `PMREMGenerator` and reusable environment rig -> 0.00ms biome switching & zero mode-launch stalls!
 */
function buildAllBiomePmremTextures(webgl, biomeRigs) {
  const map = new Map();
  if (!webgl || !biomeRigs) return map;
  let pmrem = null;
  let skyGeo = null;
  let groundGeo = null;
  let sunGeo = null;
  let waterGeo = null;
  let skyMat = null;
  let groundMat = null;
  let sunMat = null;
  let waterMat = null;
  try {
    pmrem = new THREE.PMREMGenerator(webgl);
    pmrem.compileEquirectangularShader?.();
    const envScene = new THREE.Scene();
    envScene.background = new THREE.Color('#489cd6');

    skyGeo = new THREE.SphereGeometry(18, 16, 10, 0, TWO_PI, 0, Math.PI * 0.5);
    groundGeo = new THREE.SphereGeometry(18, 16, 10, 0, TWO_PI, Math.PI * 0.5, Math.PI * 0.5);
    sunGeo = new THREE.SphereGeometry(2.6, 10, 8);
    waterGeo = new THREE.RingGeometry(4, 16, 16);

    skyMat = new THREE.MeshBasicMaterial({ color: '#cbeafe', side: THREE.BackSide });
    groundMat = new THREE.MeshBasicMaterial({ color: '#a85238', side: THREE.BackSide });
    sunMat = new THREE.MeshBasicMaterial({ color: '#fff3d1' });
    waterMat = new THREE.MeshBasicMaterial({ color: '#2dd4bf', side: THREE.DoubleSide });

    const skyDome = new THREE.Mesh(skyGeo, skyMat);
    const groundBowl = new THREE.Mesh(groundGeo, groundMat);
    const sunCard = new THREE.Mesh(sunGeo, sunMat);
    const waterCard = new THREE.Mesh(waterGeo, waterMat);
    waterCard.rotation.x = -Math.PI * 0.5;
    waterCard.position.y = -3.0;
    envScene.add(skyDome, groundBowl, sunCard, waterCard);

    for (const [biomeKey, rigSpec] of Object.entries(biomeRigs)) {
      if (!rigSpec) continue;
      envScene.background.set(rigSpec.bg);
      skyMat.color.set(rigSpec.hemiSky);
      groundMat.color.set(rigSpec.hemiGround);
      sunMat.color.set(rigSpec.sunCol);
      sunCard.position.set(rigSpec.sunPos[0], rigSpec.sunPos[1], rigSpec.sunPos[2]);
      waterMat.color.set(rigSpec.fillCol);
      const tex = pmrem.fromScene(envScene, 0.035).texture;
      if (tex) map.set(biomeKey, tex);
    }
  } catch {
    // Fallback to empty map on headless mocks
  } finally {
    skyGeo?.dispose();
    groundGeo?.dispose();
    sunGeo?.dispose();
    waterGeo?.dispose();
    skyMat?.dispose();
    groundMat?.dispose();
    sunMat?.dispose();
    waterMat?.dispose();
    pmrem?.dispose();
  }
  return map;
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

    // Adaptive Dynamic Resolution Scaling for locked 60fps across integrated GPUs & mobile
    this._isIntegratedGpu = false;
    this.maxDpr = Math.min((typeof window !== 'undefined' && window.devicePixelRatio) || 1, 1.25);
    this.currentDpr = this.maxDpr;
    this.usePostFX = true; // Shared CinematicPostFX (auto-bypasses cleanly to ACES at low DPR / high frame time!)
    this.postfxActive = false;
    this._frameEmaMs = 12.0;
    this._slowFrameCount = 0;
    this._lastPerfNow = 0;
    this._shadowTick = 0;

    // Interactive Title Screen Star Showcase state (pointer gaze, greeting wave, tap-to-hop!)
    this._titlePointerGaze = { x: 0, y: 0, tx: 0, ty: 0 };
    this._titleWaveTimer = 1.65;
    this._titleHopTimer = 0;
    this._titleHopDuration = 0.72;
    this._coreDescentCtx = null;

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
    // Detect integrated GPUs (e.g. AMD Radeon(TM) Graphics / Intel UHD / Vega) and cap maxDpr to 1.0 for locked 60fps!
    try {
      const gl = this.webgl.getContext();
      const dbg = gl?.getExtension?.('WEBGL_debug_renderer_info');
      const gpuStr = String(
        (dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : gl?.getParameter?.(gl.RENDERER)) || ''
      ).toLowerCase();
      if (
        gpuStr.includes('radeon (tm) graphics') ||
        gpuStr.includes('radeon(tm) graphics') ||
        gpuStr.includes('radeon graphics') ||
        gpuStr.includes('vega') ||
        gpuStr.includes('intel(r) uhd') ||
        gpuStr.includes('intel(r) hd') ||
        gpuStr.includes('intel(r) iris') ||
        gpuStr.includes('swiftshader') ||
        gpuStr.includes('llvmpipe')
      ) {
        this._isIntegratedGpu = true;
        this.maxDpr = Math.min(this.maxDpr, 1.0);
        this.currentDpr = this.maxDpr;
      }
    } catch {}
    this.webgl.toneMapping = THREE.ACESFilmicToneMapping;
    this.webgl.toneMappingExposure = 1.08;
    this.webgl.shadowMap.enabled = true;
    this.webgl.shadowMap.type = this._isIntegratedGpu ? THREE.BasicShadowMap : THREE.PCFShadowMap;
    this.webgl.shadowMap.autoUpdate = false;
    this.webgl.setPixelRatio(this.currentDpr);

    this._biomeEnvMaps = new Map();
    this._initEnvironment();
    this.bestiaryPreview = { active: false, family: 'snap_crab', yaw: 0, zoom: 1.0, anim: null };
    this.wardrobePreview = { yaw: null, zoom: 1.0, anim: null };
    this._wardrobeYawSmooth = 0;
    this._bestiaryYawSmooth = 0;
    this._bestiaryEnemyProxy = [
      { id: 'bestiary_showcase', type: 'snap_crab', col: 0, floor: 2, dir: 1, vx: 0, vy: 0, alive: true },
    ];

    this._initSharedAssets();
    this._initTowerScene();
    this._initPostProcessing();
    this._loadBlenderAssets();
  }

  /**
   * Public API for `@ui_story`'s 3D Interactive Bestiary Inspector (`snap_crab`..`siphon_warden`).
   * Accepts `{ active, family, yaw, zoom, anim }` or `null` to close.
   */
  setBestiaryPreview(opts = null) {
    if (!opts || opts.active === false) {
      this.bestiaryPreview.active = false;
      this.enemyVisuals?.setBestiaryShowcase?.({ active: false });
      return;
    }
    this.bestiaryPreview.active = true;
    if (opts.family || opts.type) this.bestiaryPreview.family = opts.family || opts.type;
    if (opts.yaw != null && Number.isFinite(Number(opts.yaw))) this.bestiaryPreview.yaw = Number(opts.yaw);
    if (opts.zoom != null && Number.isFinite(Number(opts.zoom))) this.bestiaryPreview.zoom = clamp(Number(opts.zoom), 0.55, 1.85);
    if (opts.anim !== undefined) this.bestiaryPreview.anim = opts.anim || null;
  }

  /**
   * Public API for `@ui_story`'s 360° Pelagian Sanctuary Gateway Turntable & Animation Studio.
   */
  setWardrobePreview(opts = null) {
    if (!opts) {
      this.wardrobePreview.yaw = null;
      this.wardrobePreview.zoom = 1.0;
      this.wardrobePreview.anim = null;
      return;
    }
    if (opts.yaw !== undefined) this.wardrobePreview.yaw = opts.yaw == null ? null : Number(opts.yaw);
    if (opts.zoom != null && Number.isFinite(Number(opts.zoom))) this.wardrobePreview.zoom = clamp(Number(opts.zoom), 0.6, 1.85);
    if (opts.anim !== undefined) this.wardrobePreview.anim = opts.anim || null;
  }

  setWardrobeOrbit(yaw = null, zoom = 1.0, anim = null) {
    this.setWardrobePreview({ yaw, zoom, anim });
  }

  /**
   * Interactive Title Screen Star Showcase hooks:
   * - `setTitlePointerGaze(nx, ny)`: smooth cursor/touch eye & head tracking in [-1..+1].
   * - `triggerTitleHeroHop()`: joyful elastic hop + spin + sparkle burst when player taps Gateway!
   * - `triggerTitleHeroWave()`: warm boot/idle camera wave!
   */
  setTitlePointerGaze(nx = 0, ny = 0) {
    this._titlePointerGaze.tx = clamp(Number(nx) || 0, -1, 1);
    this._titlePointerGaze.ty = clamp(Number(ny) || 0, -1, 1);
  }

  triggerTitleHeroHop() {
    this._titleHopTimer = this._titleHopDuration;
    this._titleWaveTimer = Math.max(this._titleWaveTimer, 0.9);
    this.gatewayRig?.triggerTitleHop?.();
    this.gatewayRig?.setMood?.('joyful');
  }

  triggerTitleHeroWave() {
    this._titleWaveTimer = 1.65;
    this.gatewayRig?.triggerTitleWave?.();
  }

  _getBiomeEnvMap(biomeKey = 'canyon_river') {
    const resolved = resolvePostFxBiome(biomeKey || this.biome || 'canyon_river');
    if (this._biomeEnvMaps.has(resolved)) {
      return this._biomeEnvMaps.get(resolved);
    }
    return this._sharedEnvTex || null;
  }

  _initEnvironment() {
    // Prewarm ALL 5 biome PMREM textures once with a single shared PMREMGenerator -> 0.00ms biome switches!
    const baked = buildAllBiomePmremTextures(this.webgl, BIOME_LIGHT_RIGS);
    for (const [k, tex] of baked.entries()) {
      this._biomeEnvMaps.set(k, tex);
    }
    this._sharedEnvTex =
      this._biomeEnvMaps.get('canyon_river') ||
      this._biomeEnvMaps.values().next().value ||
      null;
    this.envTex = this._sharedEnvTex;
  }

  _ensureSubRenderer() {
    if (this.subRenderer) return this.subRenderer;
    this.subRenderer = new SubRenderer(this.webgl, {
      width: this.width,
      height: this.height,
      softDotTex: this.glowDotTex,
      skinId: this.skinId,
      blasterFxId: this.blasterFxId,
      envMap: this._getBiomeEnvMap(this.biome),
      postfx: this.postfx,
      showHud: false,
    });
    this.subRenderer.resize?.(this.width, this.height);
    this.subRenderer.setSkin?.(this.skinId);
    this.subRenderer.setBlasterFx?.(this.blasterFxId);
    this.subRenderer.prewarm?.();
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
      envMap: this._getBiomeEnvMap(this.biome),
      postfx: this.postfx,
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
      envMap: this._getBiomeEnvMap(this.biome),
      postfx: this.postfx,
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
      envMap: this._getBiomeEnvMap(this.biome),
      postfx: this.postfx,
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
      skinId: this.skinId,
      envMap: this._getBiomeEnvMap(this.biome),
      postfx: this.postfx,
      softDotTex: this.glowDotTex,
    });
    this.vaultRenderer.resize?.(this.width, this.height, this.currentDpr);
    this.vaultRenderer.setSkin?.(this.skinId);
    this.vaultRenderer.prewarm?.();
    return this.vaultRenderer;
  }

  _initSharedAssets() {
    this.glowDotTex = createGlowDotTexture();
    this.relicTabletTex = createWatershedTabletTexture();
    this.turntableHaloTex = createTurntableHaloTexture();
    this.hydroSlashTex = createHydroSlashTexture();
    this.hydroWakeTex = createHydroWakeTexture();
    this.hydroBurstTex = createHydroBurstTexture();
    this.braidedTetherTex = createBraidedTetherTexture();
    this.tunnelDepthTex = createTunnelDepthTexture();
    this.tunnelSpiralTex = createTunnelSpiralTexture();

    this.sharedParticleGeo = new THREE.BoxGeometry(0.14, 0.14, 0.14);

    // Sculpted streamlined glossy living-water droplet oriented along +X (ZERO opaque clay bulb!)
    const boltProfile = [
      new THREE.Vector2(0.0, -0.23),
      new THREE.Vector2(0.036, -0.15),
      new THREE.Vector2(0.078, -0.04),
      new THREE.Vector2(0.094, 0.06),
      new THREE.Vector2(0.064, 0.14),
      new THREE.Vector2(0.0, 0.21),
    ];
    this.sharedPulseGeo = new THREE.LatheGeometry(boltProfile, 16);
    this.sharedPulseGeo.rotateZ(-Math.PI * 0.5);
    this.sharedPulseGeo.computeVertexNormals();

    // Sleek faceted crystalline water-lance oriented along +X for prism FX styles
    this.sharedPrismGeo = new THREE.OctahedronGeometry(0.115, 0);
    this.sharedPrismGeo.scale(1.9, 0.82, 0.82);
    this.sharedPrismGeo.computeVertexNormals();

    // Delicate translucent spiraling hydro-wake slipstream trailing behind the water-crystal nose
    this.sharedFxRingGeo = new THREE.CylinderGeometry(0.022, 0.118, 0.34, 16, 1, true);
    this.sharedFxRingGeo.rotateZ(Math.PI * 0.5);
    this.sharedFxRingGeo.translate(-0.13, 0, 0);

    this.sharedTrailDotGeo = new THREE.SphereGeometry(0.056, 8, 8);

    // Sculpted elongated teardrop water-droplet wakes (NOT stiff spherical beads!)
    const trailParts = [];
    const orbitParts = [];
    for (let t = 1; t <= 3; t++) {
      const sc = 1.0 - t * 0.22;
      const tp = new THREE.OctahedronGeometry(0.048 * sc, 1);
      tp.scale(1.85, 0.72, 0.72);
      tp.translate(-0.12 - t * 0.14, (t === 2 ? 0.032 : -0.022), -0.015 * t);
      trailParts.push(tp);

      const ang = ((t - 1) * TWO_PI) / 3;
      const op = new THREE.OctahedronGeometry(0.046 * sc, 1);
      op.scale(1.45, 0.78, 0.78);
      op.translate(Math.cos(ang) * 0.23, Math.sin(ang) * 0.09, Math.sin(ang) * 0.20);
      orbitParts.push(op);
    }
    this.sharedTrailClusterGeo = mergeRigidGeos(trailParts);
    this.sharedOrbitalTrailGeo = mergeRigidGeos(orbitParts);
    this.sharedTrailClusterGeo.userData.shared = true;
    this.sharedOrbitalTrailGeo.userData.shared = true;

    // Sculpted Faceted Pelagian Sapphire Relic Crystal (elongated diamond octahedron, 1 draw call!)
    const sapphireGeo = new THREE.OctahedronGeometry(0.18, 0);
    sapphireGeo.scale(0.84, 1.52, 0.84);
    sapphireGeo.computeVertexNormals();
    this.sharedWaterDropGeo = sapphireGeo;
    this.sharedWaterDropGeo.userData.shared = true;
    this.sharedWaterDropMat = new THREE.MeshStandardMaterial({
      color: '#0ea5e9',
      emissive: '#0369a1',
      emissiveIntensity: 0.35,
      roughness: 0.12,
      metalness: 0.35,
      flatShading: true,
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
      color: '#0284c7',
      emissive: '#22d3ee',
      emissiveIntensity: 0.62,
      roughness: 0.07,
      metalness: 0.16,
      transparent: true,
      opacity: 0.84,
      flatShading: false,
    });
    this.sharedFxRingMat = new THREE.MeshBasicMaterial({
      map: this.hydroWakeTex,
      color: '#38bdf8',
      transparent: true,
      opacity: 0.38,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this.sharedTrailDotMat = new THREE.MeshStandardMaterial({
      color: '#0ea5e9',
      emissive: '#22d3ee',
      emissiveIntensity: 0.58,
      roughness: 0.08,
      metalness: 0.14,
      transparent: true,
      opacity: 0.72,
    });
    this.sharedHaloSpriteMat = new THREE.SpriteMaterial({
      map: this.glowDotTex,
      color: '#38bdf8',
      transparent: true,
      opacity: 0.56,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this.sharedBurstMat = new THREE.MeshBasicMaterial({
      map: this.hydroBurstTex,
      color: '#7dd3fc',
      transparent: true,
      opacity: 0.88,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    for (const m of [
      this.sharedPulseMat,
      this.sharedFxRingMat,
      this.sharedTrailDotMat,
      this.sharedHaloSpriteMat,
      this.sharedBurstMat,
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
    this._glbLoadedCount = 0;
  }

  prewarm() {
    prewarmArchSurfaces();
    this._uploadAllReadyTextures();
    if (!this._towerSceneCompiled) {
      this._compileAllTowerShaders();
      this._towerSceneCompiled = true;
      this._compiledArchVersion = this._archPropsVersion;
      this._enemiesGlbCompiled = Boolean(this.enemyVisuals?.isReady?.());
    }
  }

  _uploadAllReadyTextures() {
    if (!this.webgl || typeof this.webgl.initTexture !== 'function') return;
    const archTexList = getLoadedArchTextures();
    for (let i = 0; i < archTexList.length; i++) {
      const t = archTexList[i];
      if (t && !t.userData?._gpuUploaded && (t.image || t.source?.data)) {
        t.userData = t.userData || {};
        t.userData._gpuUploaded = true;
        try {
          this.webgl.initTexture(t);
        } catch {}
      }
    }
    const skyTexList = this.stormSky?._ownedTextures;
    let uploadedSky = 0;
    if (Array.isArray(skyTexList)) {
      for (let i = 0; i < skyTexList.length; i++) {
        const t = skyTexList[i];
        if (!t) continue;
        if (t.userData?._gpuUploaded) {
          uploadedSky++;
          continue;
        }
        const img = t.image || t.source?.data;
        const imgReady = img && (img.complete !== false) && ((img.naturalWidth || img.width || 0) > 0);
        if (imgReady) {
          t.userData = t.userData || {};
          t.userData._gpuUploaded = true;
          uploadedSky++;
          try {
            this.webgl.initTexture(t);
          } catch {}
        }
      }
    }
    this._skyTexUploadedCount = uploadedSky;
    this._lastUploadedWebpVer = getBakedArchWebpVersion();
  }

  prewarmTowerGroup(tower, compileScene = false) {
    if (!tower) return null;
    const cached = this._getOrBuildTowerGroup(tower);
    if (!this._oceanVfxJitWarmed && this.oceanVfx) {
      this._oceanVfxJitWarmed = true;
      try {
        this.oceanVfx.rebuildForTower(tower, FLOOR_HEIGHT, TOWER_RADIUS);
        if (this.currentTowerGroup) {
          this.towerScene?.remove(this.currentTowerGroup);
          this.currentTowerGroup = null;
        }
      } catch {}
    }
    if (this.webgl && typeof this.webgl.initTexture === 'function') {
      if (cached?.wallAoTex && !cached.wallAoTex.userData?._gpuUploaded) {
        cached.wallAoTex.userData = cached.wallAoTex.userData || {};
        cached.wallAoTex.userData._gpuUploaded = true;
        try {
          this.webgl.initTexture(cached.wallAoTex);
        } catch {}
      }
      if (Array.isArray(cached?.ownedTextures)) {
        for (let i = 0; i < cached.ownedTextures.length; i++) {
          const ot = cached.ownedTextures[i];
          if (ot && !ot.userData?._gpuUploaded && (ot.image || ot.source?.data)) {
            ot.userData = ot.userData || {};
            ot.userData._gpuUploaded = true;
            try {
              this.webgl.initTexture(ot);
            } catch {}
          }
        }
      }
      this._uploadAllReadyTextures();
      if (compileScene && cached?.group && this.towerScene && this.towerCam) {
        this.compileTowerGroups([cached.group]);
      }
    }
    return cached;
  }

  compileTowerGroups(groups = []) {
    if (!this.webgl || !this.towerScene || !this.towerCam || !Array.isArray(groups) || !groups.length) return;
    // All towers share the exact same arch/prop PBR materials (`buildArchShaderWarmupGroup()`),
    // so compiling 1 representative group covers 100% of shaders without mounting 6 towers (~660k tris) at once!
    const rep = groups.find(Boolean);
    if (!rep) return;
    let addedRep = false;
    try {
      if (rep.parent !== this.towerScene) {
        this.towerScene.add(rep);
        addedRep = true;
      }
      this._compileAllTowerShaders();
      this._towerSceneCompiled = true;
      this._compiledArchVersion = this._archPropsVersion;
      this._enemiesGlbCompiled = Boolean(this.enemyVisuals?.isReady?.());
    } finally {
      if (addedRep && rep.parent === this.towerScene) {
        this.towerScene.remove(rep);
      }
    }
  }

  /**
   * Pre-compiles EVERY WebGL / ANGLE D3D11 shader permutation used by the Spire, all 4 Arch GLBs,
   * all 7 Enemy GLBs, collectibles, oceanVfx, stormSky (aurora, mantas, skyboxes), telegraphs, sparks &
   * instanced particles in ONE fast startup pass for BOTH `postfx.composer.readBuffer` (`HalfFloatType`
   * + `LinearSRGB` + `NoToneMapping`) AND `null` screen backbuffer (`ACES` + `sRGB`), WITH
   * `keyLight.castShadow = true` -> ZERO mode-launch or mid-climb ANGLE D3D11 HLSL compile freezes!
   */
  _compileAllTowerShaders() {
    if (!this.webgl || !this.towerScene || !this.towerCam) return;
    const saved = [];
    const savedCounts = [];
    const prevPartCount = this.particleInst ? this.particleInst.count : 0;

    try {
      this._uploadAllReadyTextures();
      this.enemyVisuals?.prewarmAllRigs?.();
      this._trimEnemyShadows(true);
    } catch {}

    const prevRt = this.webgl.getRenderTarget();
    const prevShadowAuto = this.webgl.shadowMap.autoUpdate;
    const prevShadowNeeds = this.webgl.shadowMap.needsUpdate;
    const prevToneMapping = this.webgl.toneMapping;
    const prevScissorTest = this.webgl.getScissorTest();
    const prevViewport = new THREE.Vector4();
    const prevScissor = new THREE.Vector4();
    this.webgl.getViewport(prevViewport);
    this.webgl.getScissor(prevScissor);

    const composerRt =
      this.usePostFX && this.postfx && !this.postfx.isBypassed && this.postfx.composer?.readBuffer
        ? this.postfx.composer.readBuffer
        : null;
    const savedRtVp = composerRt ? composerRt.viewport.clone() : null;
    const savedRtSc = composerRt ? composerRt.scissor.clone() : null;
    const savedRtScTest = composerRt ? Boolean(composerRt.scissorTest) : false;

    try {
      this.webgl.setRenderTarget(null);
      this.webgl.toneMapping = THREE.ACESFilmicToneMapping;
      this.webgl.setScissorTest(true);
      this.webgl.setScissor(0, 0, 16, 16);
      this.webgl.setViewport(0, 0, 16, 16);

      // Step 1: Allocate `keyLight.shadow.map` once cleanly with only current shadow casters (Gateway)
      if (this.keyLight) this.keyLight.castShadow = true;
      if (this.keyLight && !this.keyLight.shadow.map) {
        this.webgl.shadowMap.autoUpdate = false;
        this.webgl.shadowMap.needsUpdate = true;
        this.webgl.render(this.towerScene, this.towerCam);
      }

      // Step 2: Force every scene node visible & unculled and render 16x16 warmup passes with
      // `shadowMap.needsUpdate = false` (reusing the shadow map!) into BOTH `composer.readBuffer`
      // (`HalfFloatType` + `LinearSRGB`) AND `null` (`ACES` + `sRGB`) so ANGLE D3D11 compiles every
      // exact live PSO upfront at minimal raster cost.
      if (!this._archWarmupGroup) {
        this._archWarmupGroup = buildArchShaderWarmupGroup();
      }
      if (this._archWarmupGroup && !this._archWarmupGroup.parent) {
        this.towerScene.add(this._archWarmupGroup);
      }
      if (this.particleInst && prevPartCount === 0) {
        this.particleInst.count = 1;
      }
      this.towerScene.traverse((obj) => {
        saved.push(obj, obj.visible, obj.frustumCulled);
        obj.visible = true;
        obj.frustumCulled = false;
        if (obj.isInstancedMesh && obj.count === 0) {
          savedCounts.push(obj, obj.count);
          obj.count = 1;
        }
      });
      this.webgl.shadowMap.autoUpdate = false;
      this.webgl.shadowMap.needsUpdate = false;

      if (composerRt) {
        composerRt.viewport.set(0, 0, 16, 16);
        composerRt.scissor.set(0, 0, 16, 16);
        composerRt.scissorTest = true;
        this.webgl.setRenderTarget(composerRt);
        this.webgl.render(this.towerScene, this.towerCam);
      }

      this.webgl.setRenderTarget(null);
      this.webgl.setScissorTest(true);
      this.webgl.setScissor(0, 0, 16, 16);
      this.webgl.setViewport(0, 0, 16, 16);
      this.webgl.render(this.towerScene, this.towerCam);

      if (!this._postfxPassesCompiled && this.usePostFX && this.postfx?.composer && this.postfx?.renderPass) {
        this._postfxPassesCompiled = true;
        this.postfx.renderPass.scene = this.postfx._dummyScene;
        this.postfx.renderPass.camera = this.postfx._dummyCamera;
        this.postfx.composer.render(0.0166667);
      }
    } catch {
      // Ignore driver fallback
    } finally {
      if (composerRt && savedRtVp && savedRtSc) {
        composerRt.viewport.copy(savedRtVp);
        composerRt.scissor.copy(savedRtSc);
        composerRt.scissorTest = savedRtScTest;
      }
      if (this._archWarmupGroup?.parent) {
        this._archWarmupGroup.parent.remove(this._archWarmupGroup);
      }
      for (let i = 0; i < saved.length; i += 3) {
        saved[i].visible = saved[i + 1];
        saved[i].frustumCulled = saved[i + 2];
      }
      for (let i = 0; i < savedCounts.length; i += 2) {
        savedCounts[i].count = savedCounts[i + 1];
      }
      if (this.particleInst) {
        this.particleInst.count = prevPartCount;
      }
      this.webgl.shadowMap.autoUpdate = prevShadowAuto;
      this.webgl.shadowMap.needsUpdate = prevShadowNeeds;
      this.webgl.toneMapping = prevToneMapping;
      this.webgl.setViewport(prevViewport);
      this.webgl.setScissor(prevScissor);
      this.webgl.setScissorTest(prevScissorTest);
      this.webgl.setRenderTarget(prevRt);
    }
  }

  _prepareGlbScene(scene) {
    scene.traverse((obj) => {
      if (obj.geometry) {
        obj.geometry.userData = obj.geometry.userData || {};
        obj.geometry.userData.shared = true;
        if (obj.geometry.attributes?.uv && !obj.geometry.attributes?.uv1) {
          obj.geometry.setAttribute('uv1', obj.geometry.attributes.uv);
        }
      }
      if (!obj.isMesh || !obj.material) return;
      const convert = (m) => {
        if (!m) return m;
        let out = m;
        if (m.isMeshPhysicalMaterial) {
          out = new THREE.MeshStandardMaterial({
            name: m.name || '',
            color: m.color ? m.color.clone() : new THREE.Color('#ffffff'),
            map: m.map || null,
            normalMap: m.normalMap || null,
            normalScale: m.normalScale ? m.normalScale.clone() : new THREE.Vector2(1, 1),
            roughnessMap: m.roughnessMap || null,
            metalnessMap: m.metalnessMap || null,
            aoMap: m.aoMap || m.roughnessMap || null,
            aoMapIntensity: m.aoMapIntensity ?? 0.80,
            emissive: m.emissive ? m.emissive.clone() : new THREE.Color('#000000'),
            emissiveMap: m.emissiveMap || null,
            emissiveIntensity: Math.min(1.85, m.emissiveIntensity ?? 1.0),
            roughness: typeof m.roughness === 'number' ? m.roughness : 0.4,
            metalness: typeof m.metalness === 'number' ? m.metalness : 0.2,
            vertexColors: Boolean(m.vertexColors),
            transparent: Boolean(m.transparent),
            opacity: typeof m.opacity === 'number' ? m.opacity : 1.0,
            side: m.side,
          });
          m.dispose();
        } else {
          if (!out.aoMap && out.roughnessMap) {
            out.aoMap = out.roughnessMap;
            out.aoMapIntensity = out.aoMapIntensity ?? 0.80;
          }
          if (typeof out.emissiveIntensity === 'number' && out.emissiveIntensity > 1.85) {
            out.emissiveIntensity = 1.85;
          }
        }
        out.userData = out.userData || {};
        out.userData.shared = true;
        return out;
      };
      if (Array.isArray(obj.material)) {
        obj.material = obj.material.map(convert);
      } else {
        obj.material = convert(obj.material);
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

    let settled = 0;
    const onOneSettled = () => {
      settled++;
      if (settled >= specs.length) {
        for (const entry of this.towerCache.values()) {
          entry?.applyGlbUpgrade?.(this.glbModels);
          this._trimTowerShadows(entry?.group);
        }
        this._archPropsVersion++;
        this._archGlbsSettled = true;
        this.onArchGlbsReady?.();
      }
    };

    for (const sp of specs) {
      loader.load(
        sp.url,
        (gltf) => {
          if (gltf && gltf.scene) {
            this.glbModels[sp.key] = this._prepareGlbScene(gltf.scene);
          }
          onOneSettled();
        },
        undefined,
        () => {
          onOneSettled();
        }
      );
    }

    // Background-preload sculpted Blender Core Reactor kit (`env_core_reactor.glb`) without blocking startup!
    loader.load(
      'assets/models/env_core_reactor.glb',
      (gltf) => {
        if (gltf && gltf.scene) {
          this.glbModels.env_core_reactor = this._prepareGlbScene(gltf.scene);
          if (this._coreDescentCtx && !this._coreDescentCtx.glbMounted) {
            this._mountCoreReactorGlb(this._coreDescentCtx, this.glbModels.env_core_reactor);
          }
        }
      },
      undefined,
      () => {}
    );
  }

  _initPostProcessing() {
    this.postfx = null;
    if (!this.usePostFX) return;
    try {
      this.postfx = new CinematicPostFX(this.webgl, this.width, this.height, this.currentDpr, { enabled: true });
      this.postfx.setBiome(this.biome, this.purificationProgress);
      this._applyHalfResBloom(this.width, this.height, this.currentDpr);
    } catch {
      this.postfx = null;
    }
  }

  _applyHalfResBloom(w, h, dpr) {
    if (!this.postfx?.bloomPass) return;
    const physW = Math.max(64, Math.round(w * dpr * 0.5));
    const physH = Math.max(64, Math.round(h * dpr * 0.5));
    try {
      this.postfx.bloomPass.setSize(physW, physH);
    } catch {}
  }

  _renderWithComposer(scene, camera, opts) {
    if (this.usePostFX && this.postfx && this.postfx.enabled) {
      try {
        this.postfxActive = true;
        this.postfx.render(scene, camera, opts);
        return;
      } catch {
        this.postfx = null;
        this.postfxActive = false;
      }
    }
    this.postfxActive = false;
    this.webgl.setRenderTarget(null);
    this.webgl.toneMapping = THREE.ACESFilmicToneMapping;
    this.webgl.toneMappingExposure = 1.08 + (opts?.purification ? opts.purification * 0.05 : 0) + (opts?.flash ? opts.flash * 0.14 : 0);
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
    this._coreDescentCtx?.gatewayRig?.setSkin?.(skinId);
    this.subRenderer?.setSkin?.(skinId);
    this.glideRenderer?.setSkin?.(skinId);
    this.puzzleRenderer?.setSkin?.(skinId);
    this.skimmerRenderer?.setSkin?.(skinId);
    this.vaultRenderer?.setSkin?.(skinId);
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
      this._prismColor.setHSL(hue, 0.88, 0.56);
      this.sharedPulseMat.color.setHSL((hue + 0.04) % 1, 0.86, 0.38);
      this.sharedPulseMat.emissive.copy(this._prismColor);
      this.sharedHaloSpriteMat.color.copy(this._prismColor);
      if (this.sharedBurstMat) this.sharedBurstMat.color.copy(this._prismColor);
      this.sharedTrailDotMat.color.setHSL((hue + 0.14) % 1, 0.84, 0.46);
      this.sharedTrailDotMat.emissive?.setHSL((hue + 0.14) % 1, 0.88, 0.56);
      this.sharedFxRingMat.color.setHSL((hue + 0.48) % 1, 0.90, 0.62);
    } else {
      // Translucent deep-aquamarine/jewel living water crystal (NEVER matte white!)
      this.sharedPulseMat.color.set(fx.emissive).multiplyScalar(0.56);
      this.sharedPulseMat.emissive.set(fx.emissive);
      this.sharedHaloSpriteMat.color.set(fx.emissive);
      if (this.sharedBurstMat) this.sharedBurstMat.color.set(fx.muzzle);
      this.sharedTrailDotMat.color.set(fx.emissive).multiplyScalar(0.72);
      this.sharedTrailDotMat.emissive?.set(fx.emissive);
      if (fx.ring) this.sharedFxRingMat.color.set(fx.emissive);
    }
    return fx;
  }

  _applyPixelRatio(dpr) {
    this.webgl.setPixelRatio(dpr);
    this.webgl.setSize(this.width, this.height, false);
    if (this.postfx) {
      this.postfx.resize(this.width, this.height, dpr);
      this._applyHalfResBloom(this.width, this.height, dpr);
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
      if (frameMs > 0 && frameMs < 100) {
        this._frameEmaMs = this._frameEmaMs * 0.94 + frameMs * 0.06;
        const minDpr = this._isIntegratedGpu ? 0.72 : 0.85;
        if (this._frameEmaMs > 18.5 && this.currentDpr > minDpr) {
          this._slowFrameCount++;
          if (this._slowFrameCount >= 75) {
            this.currentDpr = Math.max(minDpr, Number((this.currentDpr - 0.08).toFixed(2)));
            this._applyPixelRatio(this.currentDpr);
            this._slowFrameCount = 0;
            this._frameEmaMs = 12.0;
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
    const pxArea = this.width * this.height;
    // Integrated AMD Radeon / Intel UHD GPUs are fill-rate bound at full 1080p (2.07M px):
    // scale smoothly to 0.68 DPR at >= 1.5M px (~1306x734 w/ MSAA) while keeping portrait 412x915 at 1.0!
    const dprCap = this._isIntegratedGpu ? (pxArea >= 1500000 ? 0.68 : pxArea >= 1000000 ? 0.78 : 1.0) : 1.25;
    this.maxDpr = Math.min(dpr, dprCap);
    this.currentDpr = this.maxDpr;
    this._slowFrameCount = 0;
    this._frameEmaMs = 12.0;
    this._applyPixelRatio(this.currentDpr);

    const aspect = Math.max(0.38, this.width / this.height);
    if (this.towerCam) {
      this.towerCam.aspect = aspect;
      this.towerCam.updateProjectionMatrix();
    }
    if (this._coreDescentCtx?.camera) {
      this._coreDescentCtx.camera.aspect = aspect;
      this._coreDescentCtx.camera.updateProjectionMatrix();
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

    // 5-Biome Daylight / Alpenglow / Twilight / Lagoon / Aurora Rig + Smart 512x512 PCFShadowMap (tight 8.8m hero frustum!)
    this.hemiLight = new THREE.HemisphereLight('#cbeafe', '#a85238', 0.98);
    this.towerScene.add(this.hemiLight);

    this.keyLight = new THREE.DirectionalLight('#fff3d1', 2.58);
    this.keyLight.position.set(11.2, 14.5, 11.4);
    this.keyLight.castShadow = true;
    this.keyLight.shadow.mapSize.set(512, 512);
    this.keyLight.shadow.camera.near = 3.0;
    this.keyLight.shadow.camera.far = 26.0;
    this.keyLight.shadow.camera.left = -4.4;
    this.keyLight.shadow.camera.right = 4.4;
    this.keyLight.shadow.camera.top = 4.4;
    this.keyLight.shadow.camera.bottom = -4.4;
    this.keyLight.shadow.bias = -0.00075;
    this.keyLight.shadow.normalBias = 0.028;
    this.towerScene.add(this.keyLight);
    this.towerScene.add(this.keyLight.target);

    this.fillLight = new THREE.DirectionalLight('#2dd4bf', 0.64);
    this.fillLight.position.set(-10.0, 3.5, 10.5);
    this.towerScene.add(this.fillLight);

    this.rimLight = new THREE.DirectionalLight('#fde68a', 1.28);
    this.rimLight.position.set(-8.5, 10.2, -11.5);
    this.towerScene.add(this.rimLight);

    this.heroLight = new THREE.PointLight('#5efce8', 0.52, 8.2);
    this.towerScene.add(this.heroLight);

    // 5-Biome Atmospheric Sky, Canyon Cliffs / Snow Peaks / Cypress Arches / Coral Reefs (`src/stormSky.js`)
    this.stormSky = new StormAtmosphere(this.towerScene, {
      towerRadius: TOWER_RADIUS,
      floorHeight: FLOOR_HEIGHT,
    });

    // Single-Pass Analytic Fresnel Living Water (`src/water.js` — 0 reflection render passes!)
    this.ocean = new Ocean(this.webgl, {
      towerRadius: TOWER_RADIUS,
      preset: 'canyon_river',
      size: 240,
      segments: 28,
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

    // Wave 4: Sanctuary Turntable Pedestal Halo, Rescued Wildlife Lagoon & 3D Boss Hazards Pool
    this.turntableHalo = this._buildTurntableHalo();
    this.towerScene.add(this.turntableHalo);

    this.bossHazardGroup = new THREE.Group();
    this.bossHazardPool = this._buildBossHazardPool(8);
    this.towerScene.add(this.bossHazardGroup);

    this.wildlifeLagoonGroup = new THREE.Group();
    this.wildlifeLagoonSlots = [];
    this._initWildlifeLagoon();
    this.towerScene.add(this.wildlifeLagoonGroup);

    // Round 6: Title Screen Carved Sun-Stone Pedestal, Hydro-Overcharge Aura, Hydro-Ring Speed Gates & Exterior Floodgate Surge FX
    this.titlePedestalGroup = this._buildTitlePedestal();
    this.towerScene.add(this.titlePedestalGroup);

    this.overchargeAuraGroup = this._buildOverchargeAura();
    this.towerScene.add(this.overchargeAuraGroup);

    this.hydroRingGroup = new THREE.Group();
    this.hydroRingPool = [];
    // Pre-seed 1 Hydro-Ring node so `_compileAllTowerShaders()` precompiles its materials at boot!
    const seedRing = this._buildHydroRingNode();
    this.hydroRingGroup.add(seedRing);
    this.hydroRingPool.push(seedRing);
    this.towerScene.add(this.hydroRingGroup);

    this.floodgateSurgeGroup = this._buildFloodgateSurge();
    this.towerScene.add(this.floodgateSurgeGroup);

    // Round 4: Pooled 7-Enemy Personality Visual Tells & Mortar Trailing Droplets (ZERO PointLights, <= 2 draw calls!)
    this._initEnemyTellVfxPools();
  }

  _buildTitlePedestal() {
    // Clean, whisper-thin flush inlaid bronze-and-aqua medallion sitting strictly within the timber/stone
    // quay deck (radius <= 0.40m, ZERO bulky plinth cylinder, NEVER intersects handrails!).
    const g = new THREE.Group();
    g.visible = false;
    const bronzeMat = new THREE.MeshStandardMaterial({
      color: '#c88c32',
      emissive: '#4d2b06',
      emissiveIntensity: 0.22,
      roughness: 0.34,
      metalness: 0.78,
    });
    const inlayMat = new THREE.MeshBasicMaterial({
      color: '#5efce8',
      transparent: true,
      opacity: 0.44,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    const bronzeRing = new THREE.Mesh(new THREE.RingGeometry(0.35, 0.41, 32), bronzeMat);
    bronzeRing.rotation.x = -Math.PI * 0.5;
    bronzeRing.position.y = 0.006;

    const glowRing = new THREE.Mesh(new THREE.RingGeometry(0.24, 0.34, 32), inlayMat);
    glowRing.rotation.x = -Math.PI * 0.5;
    glowRing.position.y = 0.009;

    const hopBurstRing = new THREE.Mesh(
      new THREE.TorusGeometry(0.46, 0.028, 8, 28),
      new THREE.MeshBasicMaterial({
        color: '#fde047',
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    hopBurstRing.rotation.x = Math.PI * 0.5;
    hopBurstRing.position.y = 0.16;

    g.add(bronzeRing, glowRing, hopBurstRing);
    g.userData = { glowRing, hopBurstRing };
    return g;
  }

  _buildOverchargeAura() {
    // Subtle, translucent horizontal low-waist hydro-aura halo + 8 sparkling water motes orbiting
    // cleanly around Gateway's waist/feet — NEVER flips vertical or obscures her adorable face!
    const g = new THREE.Group();
    g.visible = false;
    const matA = new THREE.MeshBasicMaterial({
      color: '#22f5e6',
      transparent: true,
      opacity: 0.28,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const matB = new THREE.MeshBasicMaterial({
      color: '#fde047',
      transparent: true,
      opacity: 0.22,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const ringA = new THREE.Mesh(new THREE.TorusGeometry(0.56, 0.018, 8, 32), matA);
    ringA.rotation.x = Math.PI * 0.5;
    const ringB = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.012, 8, 28), matB);
    ringB.rotation.x = Math.PI * 0.5;
    ringB.position.y = 0.06;

    const moteCount = 8;
    const moteGeo = new THREE.OctahedronGeometry(0.036, 0);
    const moteMat = new THREE.MeshBasicMaterial({
      color: '#88fff5',
      transparent: true,
      opacity: 0.72,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const motes = new THREE.InstancedMesh(moteGeo, moteMat, moteCount);
    motes.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    const moteDummy = new THREE.Object3D();

    g.add(ringA, ringB, motes);
    g.userData = { ringA, ringB, matA, matB, motes, moteCount, moteDummy };
    return g;
  }

  _buildHydroRingNode() {
    const g = new THREE.Group();
    g.visible = false;
    const outerMat = new THREE.MeshStandardMaterial({
      color: '#f5b83d',
      emissive: '#0ea5e9',
      emissiveIntensity: 0.48,
      roughness: 0.22,
      metalness: 0.84,
    });
    const innerMat = new THREE.MeshBasicMaterial({
      color: '#5efce8',
      transparent: true,
      opacity: 0.78,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const outer = new THREE.Mesh(new THREE.TorusGeometry(0.52, 0.048, 10, 26), outerMat);
    const inner = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.022, 8, 24), innerMat);
    const halo = new THREE.Sprite(this.sharedHaloSpriteMat);
    halo.scale.set(1.28, 1.28, 1);
    g.add(outer, inner, halo);
    g.userData = { outer, inner, halo };
    return g;
  }

  _buildFloodgateSurge() {
    const g = new THREE.Group();
    g.visible = false;
    const colMat = new THREE.MeshBasicMaterial({
      map: this.glowDotTex,
      color: '#38bdf8',
      transparent: true,
      opacity: 0.72,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const coreMat = new THREE.MeshBasicMaterial({
      map: this.glowDotTex,
      color: '#ccfbf1',
      transparent: true,
      opacity: 0.82,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const ringMat = new THREE.MeshBasicMaterial({
      color: '#5efce8',
      transparent: true,
      opacity: 0.84,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    const columns = [];
    for (let i = 0; i < 3; i++) {
      const ang = (i - 1) * 0.42;
      const r = TOWER_RADIUS + 0.78;
      const colMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.56, 14, 14, 1, true), colMat);
      colMesh.position.set(Math.sin(ang) * r, 7, Math.cos(ang) * r);
      const innerMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.28, 14, 10, 1, true), coreMat);
      innerMesh.position.copy(colMesh.position);
      g.add(colMesh, innerMesh);
      columns.push({ colMesh, innerMesh, baseAng: ang });
    }

    const waveRings = [];
    for (let k = 0; k < 3; k++) {
      const wr = new THREE.Mesh(new THREE.TorusGeometry(TOWER_RADIUS + 0.96, 0.08, 10, 40), ringMat);
      wr.rotation.x = Math.PI * 0.5;
      g.add(wr);
      waveRings.push(wr);
    }

    g.userData = { columns, waveRings, colMat, coreMat, ringMat };
    return g;
  }

  _syncHydroRings(rings, effCamCol, focusFloor, fh, time, dropY, hidden, archHasRings) {
    if (!this.hydroRingGroup) return;
    const list = !hidden && Array.isArray(rings) ? rings : [];
    while (this.hydroRingPool.length < list.length) {
      const node = this._buildHydroRingNode();
      this.hydroRingGroup.add(node);
      this.hydroRingPool.push(node);
    }
    for (let i = 0; i < this.hydroRingPool.length; i++) {
      const node = this.hydroRingPool[i];
      if (i >= list.length || list[i].collected) {
        node.visible = false;
        continue;
      }
      const rg = list[i];
      const theta = wrapAngle(((rg.col ?? 0) + 0.5 - effCamCol) * COL_ANGLE);
      if (Math.cos(theta) < -0.08 || Math.abs((rg.floor ?? 0) - focusFloor) > 5.0) {
        node.visible = false;
        continue;
      }
      node.visible = true;
      const r = TOWER_RADIUS + LEDGE_STAND_OFFSET;
      node.position.set(
        r * Math.sin(theta),
        (rg.floor ?? 0) * fh + 0.72 + Math.sin(time * 3.4 + i) * 0.07 + dropY,
        r * Math.cos(theta)
      );
      node.rotation.set(0, theta + Math.PI * 0.5, 0);
      // If towerArchitecture already draws the bronze outer torus, show only our radiant inner shimmer & halo!
      node.userData.outer.visible = !archHasRings;
      node.userData.inner.rotation.z = time * 3.2 + i;
      const pulse = 0.94 + Math.sin(time * 5.2 + i) * 0.08;
      node.scale.setScalar(pulse);
    }
  }

  _syncFloodgateSurge(state, focusFloor, fh, time, dropY, hidden) {
    if (!this.floodgateSurgeGroup) return 0;
    const fx = state?.spireFloodgateSurgeFx;
    const timer = Math.max(
      Number(state?.floodgateSurgeTimer) || 0,
      fx?.active ? Math.max(0, (fx.duration || 1.85) - (fx.timer || 0)) : 0
    );
    const dur = Math.max(0.5, Number(fx?.duration) || 1.85);
    if (hidden || timer <= 0.001) {
      this.floodgateSurgeGroup.visible = false;
      return 0;
    }

    const progress = clamp(1 - timer / dur, 0, 1);
    const env = Math.sin(progress * Math.PI);
    this.floodgateSurgeGroup.visible = true;
    const baseY = Math.max(0, (focusFloor - 2.2) * fh) + dropY;
    this.floodgateSurgeGroup.position.set(0, baseY, 0);

    const ud = this.floodgateSurgeGroup.userData;
    ud.colMat.opacity = 0.16 + env * 0.62;
    ud.coreMat.opacity = 0.22 + env * 0.68;
    ud.ringMat.opacity = 0.20 + env * 0.74;

    for (let i = 0; i < ud.columns.length; i++) {
      const c = ud.columns[i];
      const hScale = 0.35 + env * 1.15;
      c.colMesh.scale.set(0.85 + env * 0.45, hScale, 0.85 + env * 0.45);
      c.innerMesh.scale.set(0.75 + env * 0.4, hScale * 1.08, 0.75 + env * 0.4);
      c.colMesh.rotation.y = time * 3.8 * (i % 2 === 0 ? 1 : -1);
    }
    for (let k = 0; k < ud.waveRings.length; k++) {
      const wr = ud.waveRings[k];
      const u = (progress * 1.8 + k * 0.33) % 1;
      wr.position.y = u * 11.5;
      const sc = 0.96 + u * 0.26;
      wr.scale.set(sc, sc, 1);
    }
    return env;
  }

  _initEnemyTellVfxPools() {
    this._wwPos = new THREE.Vector3();
    this._wwQuat = new THREE.Quaternion();
    this._wwScl = new THREE.Vector3();
    this._wwEuler = new THREE.Euler();
    this._wwMat = new THREE.Matrix4();
    this._wwDummy = new THREE.Object3D();
    this._wwCol = new THREE.Color();
    this._wwLook = new THREE.Vector3();

    this.enemyTellSparkGeo = new THREE.PlaneGeometry(0.16, 0.16);
    this.enemyTellSparkMat = new THREE.MeshBasicMaterial({
      map: this.glowDotTex,
      color: '#ffffff',
      transparent: true,
      opacity: 0.92,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    this.enemyTellSparkInst = new THREE.InstancedMesh(this.enemyTellSparkGeo, this.enemyTellSparkMat, 96);
    this.enemyTellSparkInst.frustumCulled = false;
    // Pre-allocate `instanceColor` & matrix slot 0 upfront so D3D11 never recompiles shaders mid-climb!
    this._wwCol.set('#ffffff');
    this._wwMat.identity();
    this.enemyTellSparkInst.setMatrixAt(0, this._wwMat);
    this.enemyTellSparkInst.setColorAt(0, this._wwCol);
    this.enemyTellSparkInst.instanceMatrix.needsUpdate = true;
    if (this.enemyTellSparkInst.instanceColor) this.enemyTellSparkInst.instanceColor.needsUpdate = true;
    this.enemyTellSparkInst.visible = false;
    this.enemyTellSparkInst.count = 0;
    this.towerScene.add(this.enemyTellSparkInst);

    this.enemyTellSteamGeo = new THREE.PlaneGeometry(0.30, 0.30);
    this.enemyTellSteamMat = new THREE.MeshBasicMaterial({
      map: this.glowDotTex,
      color: '#f1f5f9',
      transparent: true,
      opacity: 0.56,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    this.enemyTellSteamInst = new THREE.InstancedMesh(this.enemyTellSteamGeo, this.enemyTellSteamMat, 64);
    this.enemyTellSteamInst.frustumCulled = false;
    this.enemyTellSteamInst.setMatrixAt(0, this._wwMat);
    this.enemyTellSteamInst.setColorAt(0, this._wwCol);
    this.enemyTellSteamInst.instanceMatrix.needsUpdate = true;
    if (this.enemyTellSteamInst.instanceColor) this.enemyTellSteamInst.instanceColor.needsUpdate = true;
    this.enemyTellSteamInst.visible = false;
    this.enemyTellSteamInst.count = 0;
    this.towerScene.add(this.enemyTellSteamInst);
  }

  _applyTowerWorldWeight(cached, state, fh, time) {
    if (!cached) return;
    const tower = state?.tower || cached.tower || {};
    const ledges = state?.ledges || tower?.ledges || [];
    const ledgeR = TOWER_RADIUS + LEDGE_STAND_OFFSET;

    // 1. Weighted Crates (`box`: col + visualSlideCol) & Crumble Slabs (`crumble`: -crumbleDepress * 0.12)
    if (cached.ledgeMeshes && ledges.length > 0) {
      for (let i = 0; i < ledges.length; i++) {
        const l = ledges[i];
        const node = cached.ledgeMeshes[i];
        if (!l || !node || l.gone) continue;
        const ud = node.userData;
        if (!ud) continue;

        if (l.type === 'box' && Array.isArray(ud.batchRefs)) {
          const effCol = (Number(l.col) || 0) + (Number(l.visualSlideCol) || 0);
          const effPhi = (effCol + 0.5) * COL_ANGLE;
          const prevPhi = ud._lastBoxPhi !== undefined ? ud._lastBoxPhi : ud.phi;
          if (Math.abs(effPhi - prevPhi) > 1e-4) {
            ud._lastBoxPhi = effPhi;
            const bx = ledgeR * Math.sin(effPhi);
            const bz = ledgeR * Math.cos(effPhi);
            this._wwEuler.set(0, effPhi, 0);
            this._wwQuat.setFromEuler(this._wwEuler);
            for (let b = 0; b < ud.batchRefs.length; b++) {
              const item = ud.batchRefs[b];
              const out = item?._bandOutRef;
              if (!out?.inst || !item?.m) continue;
              item.m.decompose(this._wwPos, this._wwDummy.quaternion, this._wwScl);
              this._wwPos.set(bx, this._wwPos.y, bz);
              this._wwMat.compose(this._wwPos, this._wwQuat, this._wwScl);
              out.inst.setMatrixAt(out.localIdx, this._wwMat);
              out.inst.instanceMatrix.needsUpdate = true;
            }
          }
        } else if (l.type === 'crumble' && node.visible) {
          const depress = Number(l.crumbleDepress) || 0;
          if (depress > 0.001) {
            node.position.y -= depress * 0.12;
            node.position.y += Math.sin(time * 52 + i * 1.7) * depress * 0.008;
          }
        }
      }
    }

    // 2. Weighted Counterweight Elevators (`el.cabBounceOffset * FLOOR_HEIGHT`)
    const elevators = state?.elevators || tower?.elevators || [];
    if (cached.elevatorPods && elevators.length > 0) {
      for (let i = 0; i < elevators.length; i++) {
        const el = elevators[i];
        const pod = cached.elevatorPods[i];
        if (!el || !pod) continue;
        const bounce = Number(el.cabBounceOffset) || 0;
        if (Math.abs(bounce) > 1e-4) {
          const bounceY = bounce * fh;
          pod.position.y += bounceY;
          const pUd = pod.userData;
          if (pUd?.update) pUd.update();
          if (pUd?.cwtNode) {
            pUd.cwtNode.position.y -= bounceY * 0.65;
          }
        }
      }
    }
  }

  _syncEnemyPersonalityVfx(state, effCamCol, fh, time, dropY, focusFloor, hidden = false) {
    if (!this.enemyTellSparkInst || !this.enemyTellSteamInst) return;
    if (hidden) {
      this.enemyTellSparkInst.visible = false;
      this.enemyTellSparkInst.count = 0;
      this.enemyTellSteamInst.visible = false;
      this.enemyTellSteamInst.count = 0;
      return;
    }

    const dm = this._wwDummy;
    const col = this._wwCol;
    const enemies = state?.enemies || [];
    const rBase = TOWER_RADIUS + LEDGE_STAND_OFFSET;
    let spCnt = 0;
    let stCnt = 0;

    // Track volt_eel exhausted dimming on active volt_eel rigs in enemyVisuals._buckets[2]
    const eelBucket = this.enemyVisuals?._buckets?.[2] || null;
    let eelSlotIdx = 0;

    for (let i = 0; i < enemies.length; i++) {
      const en = enemies[i];
      if (!en || en.alive === false || en.dead) continue;
      const th = wrapAngle(((Number(en.col) || 0) - effCamCol) * COL_ANGLE);
      const enFloor = Number(en.floor) || 0;
      const inView = Math.cos(th) >= -0.05 && Math.abs(enFloor - focusFloor) <= 3.6;

      const t = String(en.type || '').toLowerCase();
      const isEel = t.includes('volt_eel') || t === 'eel';
      if (isEel && inView && eelBucket && eelSlotIdx < eelBucket.length) {
        const rig = eelBucket[eelSlotIdx++];
        const isExhausted = en.aiState === 'exhausted';
        if (rig && rig.userData && rig.userData._lastExhausted !== isExhausted) {
          rig.userData._lastExhausted = isExhausted;
          rig.traverse((o) => {
            if (!o.isMesh || !o.material || Array.isArray(o.material)) return;
            const m = o.material;
            if (typeof m.emissiveIntensity === 'number' && m.emissiveIntensity > 0.05) {
              if (m.userData._baseEmissive === undefined) {
                m.userData._baseEmissive = m.emissiveIntensity;
              }
              m.emissiveIntensity = isExhausted ? m.userData._baseEmissive * 0.16 : m.userData._baseEmissive;
            }
          });
        }
      }

      if (!inView) continue;

      const ex = rBase * Math.sin(th);
      const ez = rBase * Math.cos(th);
      const ey = enFloor * fh + dropY;
      // Tangent unit vector along tower circumference (+col direction)
      const tanX = Math.cos(th);
      const tanZ = -Math.sin(th);
      const outX = Math.sin(th);
      const outZ = Math.cos(th);

      // 1. `rail_skater`: bright orange bronze-on-stone skate-brake sparks (`en.brakeBlend > 0.1`)
      const brake = Number(en.brakeBlend) || 0;
      if ((t.includes('rail_skater') || t === 'skater') && brake > 0.1 && spCnt < 96) {
        const dir = en.dir >= 0 ? 1 : -1;
        const sparkN = Math.min(8, 96 - spCnt);
        for (let k = 0; k < sparkN; k++) {
          const u = (time * (3.6 + (k % 3) * 0.9) + k * 0.27 + i * 0.41) % 1;
          const back = -dir * (0.14 + u * 0.62);
          const lift = 0.05 + Math.sin(u * Math.PI) * (0.28 + (k % 3) * 0.10) + u * 0.14;
          const radOff = 0.06 + ((k % 3) - 1) * 0.09;
          dm.position.set(
            ex + tanX * back + outX * radOff,
            ey + lift,
            ez + tanZ * back + outZ * radOff
          );
          dm.quaternion.copy(this.towerCam.quaternion);
          const sc = (0.55 + (1 - u) * 0.85) * clamp(brake, 0.35, 1.15);
          dm.scale.set(sc * 1.45, sc * 0.72, 1);
          dm.updateMatrix();
          col.set(k % 2 === 0 ? '#fb923c' : '#fde047');
          this.enemyTellSparkInst.setColorAt(spCnt, col);
          this.enemyTellSparkInst.setMatrixAt(spCnt++, dm.matrix);
        }
      }

      // 2. `volt_eel`: crackling cyan bio-electric aura ring / arc shimmer (`en.coilBlend > 0.2 || en.shockActive`)
      const coil = Number(en.coilBlend) || 0;
      const shock = Boolean(en.shockActive);
      if (isEel && (coil > 0.2 || shock) && spCnt < 96) {
        const arcN = Math.min(shock ? 14 : 9, 96 - spCnt);
        const rad = shock ? 0.62 : 0.44 + coil * 0.14;
        for (let k = 0; k < arcN; k++) {
          const ang = (k / arcN) * TWO_PI + time * (shock ? 16 : 9) + i;
          const jitter = Math.sin(time * 43 + k * 7.1) * (shock ? 0.14 : 0.07);
          const ca = Math.cos(ang) * (rad + jitter);
          const sa = Math.sin(ang) * (rad * 0.72 + jitter * 0.6);
          dm.position.set(
            ex + tanX * ca + outX * 0.14,
            ey + 0.56 + sa,
            ez + tanZ * ca + outZ * 0.14
          );
          dm.quaternion.copy(this.towerCam.quaternion);
          const pulse = shock ? 0.95 + Math.sin(time * 38 + k) * 0.45 : 0.65 + coil * 0.4;
          dm.scale.set(pulse * 1.35, pulse * 0.85, 1);
          dm.updateMatrix();
          col.set(k % 3 === 0 ? '#e0f2fe' : '#22d3ee');
          this.enemyTellSparkInst.setColorAt(spCnt, col);
          this.enemyTellSparkInst.setMatrixAt(spCnt++, dm.matrix);
        }
      }

      // 3. `snap_crab`: angry white steam puffs during `aggro_tell` or `huff`
      if (
        (t.includes('snap_crab') || t === 'crab') &&
        (en.aiState === 'aggro_tell' || en.aiState === 'huff') &&
        stCnt < 64
      ) {
        const isHuff = en.aiState === 'huff';
        const puffN = Math.min(6, 64 - stCnt);
        for (let k = 0; k < puffN; k++) {
          const side = k % 2 === 0 ? 1 : -1;
          const u = (time * (isHuff ? 2.4 : 3.2) + k * 0.31 + i * 0.19) % 1;
          const lat = side * (0.22 + u * 0.34);
          const rise = 0.44 + u * 0.64;
          dm.position.set(
            ex + tanX * lat + outX * (0.14 + u * 0.12),
            ey + rise,
            ez + tanZ * lat + outZ * (0.14 + u * 0.12)
          );
          dm.quaternion.copy(this.towerCam.quaternion);
          const sc = Math.sin(u * Math.PI) * (0.68 + u * 0.75);
          dm.scale.setScalar(Math.max(0.01, sc));
          dm.updateMatrix();
          col.set(isHuff ? '#e2e8f0' : '#ffffff');
          this.enemyTellSteamInst.setColorAt(stCnt, col);
          this.enemyTellSteamInst.setMatrixAt(stCnt++, dm.matrix);
        }
      }

      // 4. `vent_stalker`: warning steam wisps during `hiss_tell` before full `en.venting` plume!
      if ((t.includes('vent_stalker') || t === 'stalker') && en.aiState === 'hiss_tell' && stCnt < 64) {
        const wispN = Math.min(6, 64 - stCnt);
        for (let k = 0; k < wispN; k++) {
          const chimney = (k % 3) - 1;
          const u = (time * 3.1 + k * 0.29 + i * 0.37) % 1;
          const lat = chimney * 0.22 + Math.sin(time * 12 + k) * 0.04;
          const rise = 0.62 + u * 0.88;
          dm.position.set(
            ex + tanX * lat + outX * 0.12,
            ey + rise,
            ez + tanZ * lat + outZ * 0.12
          );
          dm.quaternion.copy(this.towerCam.quaternion);
          const sc = Math.sin(u * Math.PI) * (0.62 + u * 0.68);
          dm.scale.setScalar(Math.max(0.01, sc));
          dm.updateMatrix();
          col.set(k % 2 === 0 ? '#e0f2fe' : '#bae6fd');
          this.enemyTellSteamInst.setColorAt(stCnt, col);
          this.enemyTellSteamInst.setMatrixAt(stCnt++, dm.matrix);
        }
      }
    }

    // 5. `barnacle_mortar` parabolic velocity-aligned water-bombs + trailing hydro-droplet beads!
    const projs = state?.enemyProjectiles || null;
    const projMeshes = this.enemyVisuals?._projectileMeshes || null;
    if (Array.isArray(projs) && projs.length > 0) {
      const rProj = TOWER_RADIUS + 0.56;
      let usedMesh = 0;
      for (let i = 0; i < projs.length; i++) {
        const pr = projs[i];
        if (!pr) continue;
        const pFloor = Number(pr.floor) || 0;
        if (Math.abs(pFloor - focusFloor) > 3.2) continue;
        const th = wrapAngle(((Number(pr.col) || 0) - effCamCol) * COL_ANGLE);
        if (Math.cos(th) < -0.15) continue;

        const vxCols = Number(pr.vx ?? pr.speed) || 0;
        const vyFloors = Number(pr.vy) || 0;
        const vxW = vxCols * COL_ANGLE * rProj;
        const vyW = vyFloors * fh;
        const tanX = Math.cos(th);
        const tanZ = -Math.sin(th);
        const velX = vxW * tanX;
        const velY = vyW;
        const velZ = vxW * tanZ;
        const speedMag = Math.hypot(velX, velY, velZ);

        const px = rProj * Math.sin(th);
        const py = pFloor * fh + 0.68 + dropY;
        const pz = rProj * Math.cos(th);

        // Orient & aerodynamically stretch the pooled mortar orb along its parabolic velocity tangent!
        if (projMeshes && usedMesh < projMeshes.length) {
          const pm = projMeshes[usedMesh++];
          if (pm && pm.visible && speedMag > 0.15) {
            this._wwLook.set(pm.position.x + velX, pm.position.y + velY, pm.position.z + velZ);
            pm.lookAt(this._wwLook);
            const stretch = clamp(1.16 + speedMag * 0.055, 1.16, 1.72);
            const baseS = 1.22;
            pm.scale.set(baseS * 0.84, baseS * 0.84, baseS * stretch);
          }
        }

        // Trailing droplet beads behind the arcing mortar bomb
        if (speedMag > 0.15 && spCnt < 96) {
          const invS = 1 / speedMag;
          const dx = -velX * invS;
          const dy = -velY * invS;
          const dz = -velZ * invS;
          for (let d = 1; d <= 3 && spCnt < 96; d++) {
            const dist = d * 0.22 + ((time * 2.4 + d * 0.3) % 0.14);
            dm.position.set(px + dx * dist, py + dy * dist, pz + dz * dist);
            dm.quaternion.copy(this.towerCam.quaternion);
            const sc = (0.92 - d * 0.22) * (0.9 + Math.sin(time * 18 + d) * 0.12);
            dm.scale.setScalar(Math.max(0.18, sc));
            dm.updateMatrix();
            col.set(pr.deflected ? '#5efce8' : '#7dd3fc');
            this.enemyTellSparkInst.setColorAt(spCnt, col);
            this.enemyTellSparkInst.setMatrixAt(spCnt++, dm.matrix);
          }
        }
      }
    }

    this.enemyTellSparkInst.count = spCnt;
    this.enemyTellSparkInst.visible = spCnt > 0;
    if (spCnt > 0) {
      this.enemyTellSparkInst.instanceMatrix.needsUpdate = true;
      if (this.enemyTellSparkInst.instanceColor) this.enemyTellSparkInst.instanceColor.needsUpdate = true;
    }

    this.enemyTellSteamInst.count = stCnt;
    this.enemyTellSteamInst.visible = stCnt > 0;
    if (stCnt > 0) {
      this.enemyTellSteamInst.instanceMatrix.needsUpdate = true;
      if (this.enemyTellSteamInst.instanceColor) this.enemyTellSteamInst.instanceColor.needsUpdate = true;
    }
  }

  _buildTurntableHalo() {
    const g = new THREE.Group();
    g.visible = false;
    // Feathered Pelagian Sanctuary Pedestal Aura sized cleanly (`r = 0.43m < 0.46m` ledge depth)
    // so it sits 100% flush beneath Gateway's soles with ZERO ankle clipping and ZERO wall clipping!
    const outer = new THREE.Mesh(
      new THREE.PlaneGeometry(0.86, 0.86),
      new THREE.MeshBasicMaterial({
        map: this.turntableHaloTex,
        color: '#b8fdf5',
        transparent: true,
        opacity: 0.76,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    outer.rotation.x = -Math.PI * 0.5;

    const inner = new THREE.Mesh(
      new THREE.TorusGeometry(0.32, 0.008, 8, 36),
      new THREE.MeshStandardMaterial({
        color: '#d4a64a',
        emissive: '#785012',
        emissiveIntensity: 0.35,
        metalness: 0.82,
        roughness: 0.24,
      })
    );
    inner.rotation.x = Math.PI * 0.5;
    inner.position.y = 0.003;
    g.add(outer, inner);
    g.userData = { outer, inner };
    return g;
  }

  _buildBossHazardPool(maxSlots = 8) {
    const slots = [];
    const beamGeo = new THREE.CylinderGeometry(0.32, 0.32, 1.0, 14, 1, true);
    const coreGeo = new THREE.CylinderGeometry(0.14, 0.14, 1.0, 10);
    const ringGeo = new THREE.TorusGeometry(0.68, 0.065, 8, 24);
    ringGeo.rotateX(Math.PI * 0.5);
    const warnGeo = new THREE.RingGeometry(0.42, 0.84, 24);
    warnGeo.rotateX(-Math.PI * 0.5);

    for (let i = 0; i < maxSlots; i++) {
      const root = new THREE.Group();
      root.visible = false;
      const beamMat = new THREE.MeshBasicMaterial({
        color: '#f43f5e',
        transparent: true,
        opacity: 0.55,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
        depthWrite: false,
      });
      const coreMat = new THREE.MeshBasicMaterial({
        color: '#fef08a',
        transparent: true,
        opacity: 0.85,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const ringMat = new THREE.MeshBasicMaterial({
        color: '#5efce8',
        transparent: true,
        opacity: 0.72,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const warnMat = new THREE.MeshBasicMaterial({
        color: '#fbbf24',
        transparent: true,
        opacity: 0.65,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });

      const beam = new THREE.Mesh(beamGeo, beamMat);
      const core = new THREE.Mesh(coreGeo, coreMat);
      const ring = new THREE.Mesh(ringGeo, ringMat);
      const warn = new THREE.Mesh(warnGeo, warnMat);
      warn.position.y = 0.06;
      root.add(beam, core, ring, warn);
      this.bossHazardGroup.add(root);
      slots.push({ root, beam, core, ring, warn, beamMat, coreMat, ringMat, warnMat });
    }
    return slots;
  }

  _initWildlifeLagoon() {
    const splashGeo = new THREE.RingGeometry(0.24, 0.56, 20);
    splashGeo.rotateX(-Math.PI * 0.5);

    for (let i = 0; i < 12; i++) {
      const isTurtle = i % 2 === 0;
      const root = new THREE.Group();
      root.visible = false;
      const modelGroup = new THREE.Group();

      // Lightweight procedural stand-in until sea_turtle.glb / river_otter.glb finish loading
      const fb = new THREE.Mesh(
        isTurtle ? new THREE.SphereGeometry(0.32, 10, 8) : new THREE.CapsuleGeometry(0.14, 0.44, 6, 8),
        new THREE.MeshStandardMaterial({
          color: isTurtle ? '#2dd4bf' : '#855236',
          roughness: 0.42,
        })
      );
      if (isTurtle) fb.scale.set(1.2, 0.45, 0.95);
      else fb.rotation.z = Math.PI * 0.5;
      modelGroup.add(fb);

      const splashMat = new THREE.MeshBasicMaterial({
        color: '#e0f7ff',
        transparent: true,
        opacity: 0,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const splash = new THREE.Mesh(splashGeo, splashMat);
      root.add(modelGroup, splash);
      this.wildlifeLagoonGroup.add(root);

      this.wildlifeLagoonSlots.push({
        root,
        modelGroup,
        splash,
        splashMat,
        isTurtle,
        radius: TOWER_RADIUS + 2.6 + (i % 4) * 0.78,
        speed: (isTurtle ? 0.24 : 0.34) * (i % 4 < 2 ? 1 : -1) * (0.85 + (i % 3) * 0.14),
        phase: (i * TWO_PI) / 12 + (isTurtle ? 0.15 : 0.42),
        flipperL: null,
        flipperR: null,
        otterTail: null,
      });
    }

    if (typeof window !== 'undefined' && typeof fetch === 'function') {
      const loader = new GLTFLoader();
      loader.load(
        'assets/models/sea_turtle.glb',
        (gltf) => {
          if (!gltf?.scene) return;
          for (const slot of this.wildlifeLagoonSlots) {
            if (!slot.isTurtle) continue;
            slot.modelGroup.clear();
            const cl = gltf.scene.clone(true);
            cl.scale.setScalar(0.88);
            slot.flipperL = cl.getObjectByName('flipper_L') || null;
            slot.flipperR = cl.getObjectByName('flipper_R') || null;
            slot.modelGroup.add(cl);
          }
        },
        undefined,
        () => {}
      );
      loader.load(
        'assets/models/river_otter.glb',
        (gltf) => {
          if (!gltf?.scene) return;
          for (const slot of this.wildlifeLagoonSlots) {
            if (slot.isTurtle) continue;
            slot.modelGroup.clear();
            const cl = gltf.scene.clone(true);
            cl.scale.setScalar(0.92);
            slot.otterTail = cl.getObjectByName('otter_tail') || null;
            slot.modelGroup.add(cl);
          }
        },
        undefined,
        () => {}
      );
    }
  }

  _updateWildlifeLagoon(state, time, waterY, visible) {
    if (!this.wildlifeLagoonGroup) return;
    if (!visible) {
      this.wildlifeLagoonGroup.visible = false;
      return;
    }
    const escorts = state.rescuedCritterEscorts || state.watershedFlow?.rescuedThisStage || null;
    const escortCount = Array.isArray(escorts) ? escorts.length : 0;
    const rawCount = Math.max(
      escortCount,
      Number(
        state.rescuedCritterCount ??
          state.critterCount ??
          state.prog?.getCritterCount?.() ??
          state.progression?.getCritterCount?.() ??
          0
      ) || 0
    );
    const purify = Number(state.purificationProgress ?? state.tower?.healing ?? 0) || 0;
    const activeCount =
      rawCount > 0 ? clamp(Math.max(escortCount, Math.ceil((rawCount / 30) * 12) + 1), 2, 12) : purify > 0.12 ? 2 : 0;

    this.wildlifeLagoonGroup.visible = activeCount > 0;
    if (activeCount <= 0) return;

    for (let i = 0; i < this.wildlifeLagoonSlots.length; i++) {
      const slot = this.wildlifeLagoonSlots[i];
      if (i >= activeCount) {
        slot.root.visible = false;
        continue;
      }
      slot.root.visible = true;
      const ang = slot.phase + time * slot.speed;
      const cx = Math.sin(ang) * slot.radius;
      const cz = Math.cos(ang) * slot.radius;
      const dirSign = slot.speed >= 0 ? 1 : -1;

      if (slot.isTurtle) {
        const bob = Math.sin(time * 2.2 + slot.phase) * 0.08;
        slot.root.position.set(cx, waterY + 0.04 + bob, cz);
        slot.modelGroup.rotation.set(0, ang + (dirSign > 0 ? Math.PI * 0.5 : -Math.PI * 0.5), Math.sin(time * 2.4 + i) * 0.08);
        if (slot.flipperL) slot.flipperL.rotation.x = Math.sin(time * 4.8 + i) * 0.44;
        if (slot.flipperR) slot.flipperR.rotation.x = -Math.sin(time * 4.8 + i) * 0.44;
        slot.splashMat.opacity = 0.22 + Math.sin(time * 3 + i) * 0.08;
        slot.splash.scale.setScalar(1.1 + Math.sin(time * 2.5 + i) * 0.15);
      } else {
        // Joyful leaping River Otter arcs splashing cleanly over the lagoon surface!
        const leapCycle = (time * 1.45 + slot.phase) % TWO_PI;
        const rawArc = Math.sin(leapCycle);
        const leapY = rawArc > -0.15 ? Math.max(-0.18, rawArc * 0.88) : -0.18;
        slot.root.position.set(cx, waterY + 0.05, cz);
        slot.modelGroup.position.set(0, leapY, 0);
        slot.modelGroup.rotation.set(
          rawArc > -0.15 ? -Math.cos(leapCycle) * 0.52 : 0,
          ang + (dirSign > 0 ? Math.PI * 0.5 : -Math.PI * 0.5),
          0
        );
        if (slot.otterTail) slot.otterTail.rotation.y = Math.sin(time * 9.0 + i) * 0.42;
        const entrySplash = Math.abs(rawArc) < 0.28 ? 1 - Math.abs(rawArc) / 0.28 : 0;
        slot.splashMat.opacity = entrySplash * 0.65;
        slot.splash.scale.setScalar(0.85 + (1 - entrySplash) * 1.35);
      }
    }
  }

  _updateBossHazards(hazards, effCamCol, fh, time, toppleOffY) {
    if (!this.bossHazardPool) return;
    const list = hazards || [];
    for (let i = 0; i < this.bossHazardPool.length; i++) {
      const slot = this.bossHazardPool[i];
      if (i >= list.length) {
        slot.root.visible = false;
        continue;
      }
      const hz = list[i];
      if (hz.active === false) {
        slot.root.visible = false;
        continue;
      }
      const col = hz.col ?? hz.targetCol ?? 0;
      const theta = wrapAngle((col - effCamCol) * COL_ANGLE);
      if (Math.abs(theta) > 1.72) {
        slot.root.visible = false;
        continue;
      }
      const floor = hz.floor ?? hz.floorMin ?? 1;
      const spanFloors = Math.max(1.2, (hz.floorMax != null ? hz.floorMax - floor : hz.heightFloors ?? 4.2));
      const beamH = spanFloors * fh;
      const r = TOWER_RADIUS + LEDGE_STAND_OFFSET + 0.14;
      const px = r * Math.sin(theta);
      const pz = r * Math.cos(theta);
      const py = floor * fh + toppleOffY;

      const phase = String(hz.phase || (hz.telegraph > 0 ? 'telegraph' : 'active')).toLowerCase();
      const isTelegraph = phase === 'telegraph' || phase === 'warn' || phase === 'windup';
      const isSlam = String(hz.type || hz.kind || '').toLowerCase().includes('slam') || String(hz.type || hz.kind || '').toLowerCase().includes('tentacle');
      const pulse = 0.5 + 0.5 * Math.sin(time * (isTelegraph ? 22 : 16) + i);

      slot.root.visible = true;
      slot.root.position.set(px, py, pz);
      slot.root.rotation.set(0, theta, 0);

      slot.warn.visible = true;
      slot.warnMat.color.set(isTelegraph ? '#fbbf24' : isSlam ? '#f43f5e' : '#5efce8');
      slot.warnMat.opacity = isTelegraph ? 0.45 + pulse * 0.42 : 0.72;
      slot.warn.scale.setScalar(isTelegraph ? 0.85 + pulse * 0.35 : 1.25 + pulse * 0.2);

      if (isTelegraph) {
        slot.beam.visible = true;
        slot.beam.position.y = beamH * 0.5;
        slot.beam.scale.set(0.32, beamH, 0.32);
        slot.beamMat.color.set('#fbbf24');
        slot.beamMat.opacity = 0.22 + pulse * 0.18;
        slot.core.visible = false;
        slot.ring.visible = false;
      } else {
        slot.beam.visible = true;
        slot.beam.position.y = beamH * 0.5;
        const w = isSlam ? 1.15 : 0.92;
        slot.beam.scale.set(w + pulse * 0.18, beamH, w + pulse * 0.18);
        slot.beamMat.color.set(isSlam ? '#f43f5e' : '#38bdf8');
        slot.beamMat.opacity = 0.56 + pulse * 0.22;

        slot.core.visible = true;
        slot.core.position.y = beamH * 0.5;
        slot.core.scale.set(0.85 + pulse * 0.2, beamH, 0.85 + pulse * 0.2);
        slot.coreMat.color.set(isSlam ? '#fde047' : '#e0f7ff');

        slot.ring.visible = true;
        slot.ring.position.y = 0.14 + ((time * 2.8 + i * 0.3) % 1) * Math.min(2.2, beamH * 0.5);
        slot.ring.scale.setScalar(0.8 + ((time * 2.8 + i * 0.3) % 1) * 1.4);
        slot.ringMat.color.set(isSlam ? '#fb7185' : '#5efce8');
      }
    }
  }

  _buildTailWhipVfx() {
    const g = new THREE.Group();
    g.visible = false;
    // Sculpted 3D tapered crescent hydro-blade + feathered spray wake (ZERO flat torus/disc!)
    const slashRing = new THREE.Mesh(
      buildCrescentSlashGeo(0.56, 1.18, Math.PI * 1.48, 0.11, 36),
      new THREE.MeshBasicMaterial({
        map: this.hydroSlashTex,
        color: '#c4fbff',
        transparent: true,
        opacity: 0.92,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    slashRing.rotation.z = 0.12;

    const innerDisc = new THREE.Mesh(
      buildCrescentSlashGeo(0.42, 0.92, Math.PI * 1.24, -0.07, 28),
      new THREE.MeshBasicMaterial({
        map: this.hydroSlashTex,
        color: '#38bdf8',
        transparent: true,
        opacity: 0.54,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    innerDisc.position.y = -0.055;
    innerDisc.rotation.y = -0.34;
    innerDisc.rotation.z = -0.08;

    g.add(slashRing, innerDisc);
    g.userData = { slashRing, innerDisc };
    return g;
  }

  _buildGrappleBeam() {
    // Braided Pelagian aqua-gold hydro-tether + subtle translucent sheath + antique-gold clasp!
    const g = new THREE.Group();
    g.visible = false;

    const cordGeo = new THREE.CylinderGeometry(0.020, 0.024, 1.0, 10, 1, true);
    cordGeo.rotateX(Math.PI * 0.5);
    cordGeo.translate(0, 0, 0.5);
    const cordMat = new THREE.MeshStandardMaterial({
      map: this.braidedTetherTex,
      color: '#ffffff',
      emissive: '#38bdf8',
      emissiveMap: this.braidedTetherTex,
      emissiveIntensity: 0.56,
      metalness: 0.18,
      roughness: 0.12,
      transparent: true,
      opacity: 0.86,
    });
    const cord = new THREE.Mesh(cordGeo, cordMat);

    const sheathGeo = new THREE.CylinderGeometry(0.036, 0.040, 1.0, 10, 1, true);
    sheathGeo.rotateX(Math.PI * 0.5);
    sheathGeo.translate(0, 0, 0.5);
    const sheathMat = new THREE.MeshBasicMaterial({
      map: this.hydroWakeTex,
      color: '#5efce8',
      transparent: true,
      opacity: 0.28,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const sheath = new THREE.Mesh(sheathGeo, sheathMat);

    const endClasp = new THREE.Mesh(
      new THREE.TorusGeometry(0.068, 0.017, 8, 18),
      new THREE.MeshStandardMaterial({
        color: '#e2ae46',
        emissive: '#6e4508',
        emissiveIntensity: 0.28,
        metalness: 0.86,
        roughness: 0.22,
      })
    );

    g.add(cord, sheath, endClasp);
    g.userData = { cord, sheath, endClasp };
    return g;
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

  _trimEnemyShadows(includeHidden = false) {
    const root = this.enemyVisuals?.root;
    if (!root) return;
    const kids = root.children;
    for (let i = 0; i < kids.length; i++) {
      const rig = kids[i];
      if (!rig || !rig.isGroup || (!includeHidden && !rig.visible)) continue;
      const bodyRoot = rig.userData?.body || rig;
      const sigKey = bodyRoot.children?.[0] || bodyRoot;
      if (rig._shadowTrimKey === sigKey) continue;
      rig._shadowTrimKey = sigKey;

      rig.traverse((o) => {
        if (!o.isMesh) return;
        // Enemies use crisp dark radial AO contact shadow blobs (`enemy_contact_ao`) —
        // skip directional shadow-map depth draws on enemy sub-meshes to save 20-50 calls/frame!
        o.castShadow = false;
      });
    }
  }

  _initParticleInstancer(maxCount = 112) {
    this._maxParticles = maxCount;
    // Soft radial alpha-feathered disc so dust bursts & water splashes look organic (ZERO grey squares!)
    this.particleInstGeo = new THREE.PlaneGeometry(0.24, 0.24);
    this._particleAlphas = new Float32Array(maxCount);
    this._particleAlphaAttr = new THREE.InstancedBufferAttribute(this._particleAlphas, 1);
    this._particleAlphaAttr.setUsage(THREE.DynamicDrawUsage);
    this.particleInstGeo.setAttribute('aAlpha', this._particleAlphaAttr);

    this.particleInstMat = new THREE.MeshBasicMaterial({
      color: '#ffffff',
      map: this.glowDotTex,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
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
    // Organic feathered radial water-splash starburst + tiny crystalline droplet spark (ZERO blocky cube!)
    const g = new THREE.Group();
    g.visible = false;
    const burstGeo = new THREE.PlaneGeometry(0.46, 0.46);
    const burstA = new THREE.Mesh(burstGeo, this.sharedBurstMat);
    const burstB = new THREE.Mesh(burstGeo, this.sharedBurstMat);
    burstB.rotation.y = Math.PI * 0.5;
    burstB.rotation.z = 0.45;
    const core = new THREE.Mesh(this.sharedPrismGeo, this.sharedPulseMat);
    core.scale.setScalar(0.32);
    const flare = new THREE.Sprite(this.sharedHaloSpriteMat);
    flare.scale.set(0.58, 0.58, 1);
    g.add(burstA, burstB, core, flare);
    g.userData = { burstA, burstB, core, flare };
    return g;
  }

  _buildHydroPulseNode(isOrbital = false) {
    const g = new THREE.Group();
    const icosa = new THREE.Mesh(this.sharedPulseGeo, this.sharedPulseMat);
    const prism = new THREE.Mesh(this.sharedPrismGeo, this.sharedPulseMat);
    const ring = new THREE.Mesh(this.sharedFxRingGeo, this.sharedFxRingMat);
    const halo = new THREE.Sprite(this.sharedHaloSpriteMat);
    halo.scale.set(0.46, 0.46, 1);

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
    // Crisp dark ground-contact AO shadow disc directly under Gateway's feet (ZERO glowing cyan hover ring!)
    const c = document.createElement('canvas');
    c.width = 64;
    c.height = 64;
    const ctx = c.getContext('2d');
    const grad = ctx.createRadialGradient(32, 32, 2, 32, 32, 30);
    grad.addColorStop(0.0, 'rgba(2, 8, 16, 0.72)');
    grad.addColorStop(0.55, 'rgba(3, 10, 20, 0.44)');
    grad.addColorStop(0.82, 'rgba(4, 12, 24, 0.14)');
    grad.addColorStop(1.0, 'rgba(4, 12, 24, 0.0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 64, 64);
    const aoTex = new THREE.CanvasTexture(c);

    const shadow = new THREE.Mesh(
      new THREE.CircleGeometry(0.36, 20),
      new THREE.MeshBasicMaterial({
        map: aoTex,
        transparent: true,
        opacity: 0.92,
        depthWrite: false,
      })
    );
    shadow.rotation.x = -Math.PI / 2;
    g.add(shadow);
    g.userData = { shadow, ring: null };
    return g;
  }

  _buildTunnelVortex() {
    // Subtle recessed Pelagian water-spiral portal (feathered depth well + swirling turquoise-gold currents!)
    const g = new THREE.Group();
    g.visible = false;

    const core = new THREE.Mesh(
      new THREE.PlaneGeometry(1.04, 1.04),
      new THREE.MeshBasicMaterial({
        map: this.tunnelDepthTex,
        transparent: true,
        opacity: 0.92,
        side: THREE.DoubleSide,
        depthWrite: false,
      })
    );
    core.position.z = -0.02;

    const outerRing = new THREE.Mesh(
      new THREE.PlaneGeometry(1.08, 1.08),
      new THREE.MeshBasicMaterial({
        map: this.tunnelSpiralTex,
        color: '#a8f8ff',
        transparent: true,
        opacity: 0.78,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    outerRing.position.z = 0.01;

    const innerRing = new THREE.Mesh(
      new THREE.PlaneGeometry(0.72, 0.72),
      new THREE.MeshBasicMaterial({
        map: this.tunnelSpiralTex,
        color: '#fde68a',
        transparent: true,
        opacity: 0.52,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    innerRing.position.z = 0.03;

    g.add(core, outerRing, innerRing);
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
    inst.setColorAt(0, this._tempColor.set('#ffffff'));
    if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
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

  _computeTowerCacheKey(tower) {
    const rbTheme = resolveArchTheme(tower);
    const clue = tower.clue;
    const clueSig = clue
      ? `${clue.kind}_${clue.col}_${clue.floor}_${clue.n || ''}_${(clue.pattern || clue.order || []).join('')}`
      : 'noclue';
    const basePrefix = `v3_${rbTheme}_`;
    const towerIdentity = `${tower.cacheKey || tower.key || tower.id}_${tower.floors || 0}_${tower.ledges?.length || 0}`;
    const towerSuffix = `_${towerIdentity}_${clueSig}`;
    return { basePrefix, towerSuffix, cacheKey: `${basePrefix}${towerSuffix}` };
  }

  hasCachedTowerGroup(tower) {
    if (!tower || !this.towerCache) return false;
    return this.towerCache.has(this._computeTowerCacheKey(tower).cacheKey);
  }

  _trimTowerShadows(group) {
    if (!group) return;
    // Tower masonry & fixtures already carry rich baked AO; disable directional castShadow on static
    // architecture while preserving receiveShadow so Gateway 2.0 casts crisp soft shadows at 60fps!
    group.traverse((o) => {
      if (o.isMesh && o.castShadow) {
        o.castShadow = false;
      }
    });
  }

  _getOrBuildTowerGroup(tower) {
    const MAX_TOWER_CACHE = 16;
    const { basePrefix, towerSuffix, cacheKey } = this._computeTowerCacheKey(tower);
    if (this.towerCache.has(cacheKey)) {
      const hit = this.towerCache.get(cacheKey);
      // Promote active spire to MRU slot so LRU eviction never drops recent spires
      this.towerCache.delete(cacheKey);
      this.towerCache.set(cacheKey, hit);
      return hit;
    }

    for (const [k, old] of this.towerCache.entries()) {
      if (k !== cacheKey && k.startsWith(basePrefix) && k.endsWith(towerSuffix) && old.group !== this.currentTowerGroup) {
        if (old.group?.parent) old.group.parent.remove(old.group);
        disposeTowerArchitecture(old);
        this.towerCache.delete(k);
      }
    }

    while (this.towerCache.size >= MAX_TOWER_CACHE) {
      let evicted = false;
      for (const [oldestKey, oldEntry] of this.towerCache.entries()) {
        if (oldEntry && oldEntry.group !== this.currentTowerGroup) {
          if (oldEntry.group?.parent) oldEntry.group.parent.remove(oldEntry.group);
          disposeTowerArchitecture(oldEntry);
          this.towerCache.delete(oldestKey);
          evicted = true;
          break;
        }
      }
      if (!evicted) break;
    }

    const cached = buildDetailedTowerGroup(tower, 'reboot', {
      real_staircase: this.glbModels.real_staircase || null,
      mech_elevator: this.glbModels.mech_elevator || null,
      hydro_turbine: this.glbModels.hydro_turbine || null,
      pipe_valve: this.glbModels.pipe_valve || null,
      useOceanVfx: true,
      _skipInternalGlbLoad: true,
    });
    this._trimTowerShadows(cached?.group);
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
    const getBronzeMat = () =>
      this._getCollectibleMat(
        'collectible:antiqueBronze',
        () =>
          new THREE.MeshStandardMaterial({
            color: '#c8923c',
            emissive: '#3e2508',
            emissiveIntensity: 0.22,
            metalness: 0.86,
            roughness: 0.24,
          })
      );

    if (type === 'waterSeed' || type === 'starCore') {
      // Sculpted Faceted Imperial Amber-Topaz Pelagian Star-Crystal + Forged Antique-Bronze Astrolabe Gimbal
      const seedGeo = new THREE.OctahedronGeometry(0.22, 0);
      seedGeo.scale(0.86, 1.48, 0.86);
      seedGeo.computeVertexNormals();
      const seed = new THREE.Mesh(
        seedGeo,
        this._getCollectibleMat(
          'waterSeed:core',
          () =>
            new THREE.MeshStandardMaterial({
              color: '#d97706',
              emissive: '#b45309',
              emissiveIntensity: 0.44,
              roughness: 0.12,
              metalness: 0.42,
              flatShading: true,
            })
        )
      );
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.31, 0.022, 8, 24), getBronzeMat());
      g.add(seed, ring);
      g.userData.holoRing = ring;
    } else if (type === 'relic') {
      // Carved Antique-Bronze Framed Pelagian Stele Medallion (double-sided inlaid runes, ZERO blank dark slab!)
      const casingMat = this._getCollectibleMat(
        'relic:tablet',
        () =>
          new THREE.MeshStandardMaterial({
            color: '#9c6e2f',
            emissive: '#2e1b06',
            emissiveIntensity: 0.18,
            roughness: 0.28,
            metalness: 0.82,
          })
      );
      const glyphMat = this._getCollectibleMat(
        'relic:glyph',
        () =>
          new THREE.MeshStandardMaterial({
            map: this.relicTabletTex,
            emissive: '#5efce8',
            emissiveMap: this.relicTabletTex,
            emissiveIntensity: 0.55,
            roughness: 0.22,
            metalness: 0.24,
          })
      );
      const slab = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.44, 0.07), casingMat);
      const faceFront = new THREE.Mesh(new THREE.PlaneGeometry(0.26, 0.38), glyphMat);
      faceFront.position.z = 0.038;
      const faceBack = new THREE.Mesh(new THREE.PlaneGeometry(0.26, 0.38), glyphMat);
      faceBack.position.z = -0.038;
      faceBack.rotation.y = Math.PI;
      const holoRing = new THREE.Mesh(new THREE.TorusGeometry(0.29, 0.018, 8, 24), getBronzeMat());
      g.add(slab, faceFront, faceBack, holoRing);
      g.userData = { holoRing };
    } else if (
      type === 'critterPod' ||
      type === 'critter_pod' ||
      type === 'critter' ||
      type === 'wildlife' ||
      type === 'rescuePod'
    ) {
      // Rescuable Earth Water-Critter Pod (Translucent Sea-Glass Bubble + Forged Bronze Collar + Sculpted Critter Core)
      const bubble = new THREE.Mesh(
        new THREE.SphereGeometry(0.34, 16, 12),
        this._getCollectibleMat(
          'critterPod:bubble',
          () =>
            new THREE.MeshStandardMaterial({
              color: '#38bdf8',
              emissive: '#0284c7',
              emissiveIntensity: 0.34,
              roughness: 0.06,
              metalness: 0.18,
              transparent: true,
              opacity: 0.44,
            })
        )
      );
      const collar = new THREE.Mesh(new THREE.TorusGeometry(0.36, 0.026, 8, 24), getBronzeMat());
      const critterCore = new THREE.Mesh(
        new THREE.CapsuleGeometry(0.10, 0.20, 6, 10),
        this._getCollectibleMat(
          'critterPod:body',
          () =>
            new THREE.MeshStandardMaterial({
              color: '#14b8a6',
              emissive: '#0f766e',
              emissiveIntensity: 0.36,
              roughness: 0.28,
            })
        )
      );
      critterCore.rotation.z = Math.PI * 0.5;
      g.add(bubble, collar, critterCore);
      g.userData = { holoRing: collar };
    } else if (type === 'curio' || type === 'salvage_part' || type === 'compass_key') {
      // Faceted Deep-Emerald Pelagian Compass Jewel + Forged Antique-Bronze Meridian Gimbal
      const orbGeo = new THREE.OctahedronGeometry(0.19, 0);
      orbGeo.scale(0.92, 1.32, 0.92);
      orbGeo.computeVertexNormals();
      const orb = new THREE.Mesh(
        orbGeo,
        this._getCollectibleMat(
          'curio:orb',
          () =>
            new THREE.MeshStandardMaterial({
              color: '#0d9488',
              emissive: '#14b8a6',
              emissiveIntensity: 0.46,
              roughness: 0.10,
              metalness: 0.38,
              flatShading: true,
            })
        )
      );
      const gimbal = new THREE.Mesh(new THREE.TorusGeometry(0.26, 0.020, 8, 24), getBronzeMat());
      g.add(orb, gimbal);
      g.userData = { holoRing: gimbal };
    } else {
      // Sculpted Faceted Pelagian Sapphire Relic Crystal + Carved Antique-Bronze Equator Bezel Ring
      const drop = new THREE.Mesh(this.sharedWaterDropGeo, this.sharedWaterDropMat);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.195, 0.020, 6, 18), getBronzeMat());
      ring.rotation.x = Math.PI * 0.5;
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
    if (cam && cam.quaternion) {
      dm.quaternion.copy(cam.quaternion);
    } else {
      dm.rotation.set(0, 0, 0);
    }
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
    const bestiarySpec = state.bestiaryPreview?.active
      ? state.bestiaryPreview
      : this.bestiaryPreview?.active
      ? this.bestiaryPreview
      : null;
    const isBestiary = Boolean(bestiarySpec);
    const isWardrobe = Boolean(!isBestiary && state.wardrobeSpotlight && hero);
    const cutscene =
      !isWardrobe && !isBestiary && state.cutsceneCam?.active
        ? state.cutsceneCam
        : !isWardrobe && !isBestiary && state.cutscene?.active
        ? state.cutscene
        : !isWardrobe && !isBestiary && this.cutsceneCam?.active
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
      !isBestiary &&
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

    const effCamCol = isWardrobe || isBestiary
      ? pBaseCol
      : isCutscene
      ? pBaseCol + csOrbitCols
      : isTitleShowcase
      ? pBaseCol + Math.sin(time * 0.30) * (aspect < 1.0 ? 0.08 : (0.42 - landBlend * 0.12))
      : camCol;

    // Smooth Title Screen pointer gaze, boot greeting wave, and tap-to-hop celebratory bounce timers
    const gaze = this._titlePointerGaze;
    gaze.x += (gaze.tx - gaze.x) * Math.min(1, dt * 8.5);
    gaze.y += (gaze.ty - gaze.y) * Math.min(1, dt * 8.5);
    if (isTitleShowcase) {
      if (this._titleWaveTimer > 0) this._titleWaveTimer = Math.max(0, this._titleWaveTimer - dt);
      if (this._titleHopTimer > 0) this._titleHopTimer = Math.max(0, this._titleHopTimer - dt);
    }

    // Exterior Spire Floodgate Water-Surge intensity (0..1) for smooth +2.35u camera reveal & hydraulic light sweep
    const surgeFx = state.spireFloodgateSurgeFx;
    const surgeRem = Math.max(
      Number(state.floodgateSurgeTimer) || 0,
      surgeFx?.active ? Math.max(0, (surgeFx.duration || 1.85) - (surgeFx.timer || 0)) : 0
    );
    const surgeDur = Math.max(0.5, Number(surgeFx?.duration) || 1.85);
    const surgeEnv = !isWardrobe && !isBestiary && !isTitleShowcase && surgeRem > 0.001
      ? Math.sin(clamp(1 - surgeRem / surgeDur, 0, 1) * Math.PI)
      : 0;

    // Continuous Aspect-Calibrated Cylindrical Camera Framing (#603 — Single Source of Truth from state.camFloor, ZERO camera snaps!)
    // Desktop 1920x1080 -> fov 46°, camZ 13.80m (5.43F visible, 15% hero height, full cylinder silhouette!)
    // Portrait 412x915  -> fov 52°, camZ 15.60m (7.41F visible, 4.05 cols wide, feet at 64% down safely above thumbs!)
    const isPortrait = aspect < 1.0;
    const tallBlend = clamp((0.95 - aspect) / 0.50, 0, 1);
    const shortLandBlend = clamp((aspect - 1.85) / 0.45, 0, 1) * (this.height < 520 ? 1 : 0);
    const gameplayFov = 46.0 + tallBlend * 6.0;
    const wantFov = isWardrobe || isBestiary
      ? 44
      : isTitleShowcase
      ? 42
      : isCutscene
      ? (isPortrait ? 47 : 44)
      : gameplayFov;
    if (Math.abs(this.towerCam.fov - wantFov) > 0.01) {
      this.towerCam.fov = wantFov;
      this.towerCam.updateProjectionMatrix();
    }

    let camZ = 13.80 + tallBlend * 1.80 - shortLandBlend * 1.10 + surgeEnv * 2.35;

    // Single Source of Truth: drive vertical framing directly from `state.camFloor` (hero-feet floor coords!)
    const resolvedCamFloor = state.camFloor != null ? state.camFloor : (hero ? hero.floor : 0);
    const baseY = resolvedCamFloor * fh;
    const distToHero = Math.max(2.0, camZ - (TOWER_RADIUS + LEDGE_STAND_OFFSET));
    const visH = 2 * distToHero * Math.tan(THREE.MathUtils.degToRad(gameplayFov * 0.5));
    // Anchor grounded soles at 64% down from top (0.14 * visH below viewport center -> clear above mobile thumb zone!)
    const lookYPlay = baseY + visH * 0.14 + surgeEnv * 0.85;
    let camY = lookYPlay + (isPortrait ? 0.42 : 0.36);
    const shake = writeShakeOffset(state.shake, time, this._shakeVec);

    if (isBestiary) {
      // Interactive 3D Bestiary Turntable Camera
      const pFloorY = (hero?.floor || 2) * fh;
      const bFamily = String(bestiarySpec.family || bestiarySpec.type || 'snap_crab').toLowerCase();
      const isBoss = bFamily.includes('warden') || bFamily.includes('boss');
      const bZoom = clamp(Number(bestiarySpec.zoom) || 1.0, 0.55, 1.85);
      const bLand = Math.max(0, Math.min(1, (aspect - 1.05) / 1.0));
      const baseDist = (isBoss ? 4.45 : 3.15) + bLand * 0.45 + (isPortrait ? 1.15 : 0);
      const camDist = baseDist / bZoom;
      const focusY = pFloorY + (isBoss ? (isPortrait ? 0.52 : 0.92) : (isPortrait ? 0.16 : 0.58));
      const camElev = isPortrait ? 0.34 : 0.18;
      this.towerCam.position.set(0, focusY + camElev, TOWER_RADIUS + LEDGE_STAND_OFFSET + camDist);
      this.towerCam.lookAt(0, focusY, TOWER_RADIUS + LEDGE_STAND_OFFSET);
    } else if (isWardrobe) {
      const pFloorY = (hero.floor || 0) * fh;
      const wardLand = Math.max(0, Math.min(1, (aspect - 1.05) / 1.0));
      const wZoom = clamp(Number(state.wardrobeZoom ?? this.wardrobePreview.zoom) || 1.0, 0.6, 1.85);
      const portDist = isPortrait ? 3.88 : 2.82 + wardLand * 0.48;
      const wardLookY = pFloorY + (isPortrait ? 0.24 : 0.58);
      const wardY = pFloorY + (isPortrait ? 0.58 : 0.76 + wardLand * 0.08);
      const wardZ = TOWER_RADIUS + LEDGE_STAND_OFFSET + portDist / wZoom;
      this.towerCam.position.set(0, wardY, wardZ);
      this.towerCam.lookAt(0, wardLookY, TOWER_RADIUS + LEDGE_STAND_OFFSET);
    } else if (isTitleShowcase) {
      // Interactive Title Screen Star Showcase: Gateway 2.0 proudly fills ~39–42% of viewport height
      // on BOTH 1920x1080 desktop AND 412x915 portrait, centered with generous ear-frill margin!
      const pFloorY = (hero?.floor || 0) * fh;
      const starDist = isPortrait ? 4.78 : 4.48;
      const showcaseZ = TOWER_RADIUS + LEDGE_STAND_OFFSET + starDist;
      const showcaseX = Math.sin(time * 0.36) * (isPortrait ? 0.08 : 0.22) + gaze.x * (isPortrait ? 0.08 : 0.18);
      const lookY = pFloorY + (isPortrait ? 0.56 : 0.60);
      camY = lookY + 0.16 + Math.sin(time * 0.65) * 0.03 - gaze.y * 0.08;
      camZ = showcaseZ;
      this.towerCam.position.set(showcaseX, camY, showcaseZ);
      this.towerCam.lookAt(gaze.x * 0.06, lookY, TOWER_RADIUS + LEDGE_STAND_OFFSET);
    } else if (isCutscene) {
      // Hero-First Cutscene Cinematography: Gateway 2.0 stars in crisp 3/4 foreground!
      const pFloorY = (hero?.floor || 0) * fh;
      const towerTopY = Math.max(18, tower.floors * fh);
      const heroCloseZ = TOWER_RADIUS + LEDGE_STAND_OFFSET + (isPortrait ? 4.85 : 4.15);
      const breatheY = Math.sin(time * 0.85) * 0.05;

      if (csKind.includes('purif') || csKind === 'epilogue') {
        const pull = csKind.includes('purif') ? Math.max(0.18, csEase) : Math.max(0, (csEase - 0.35) / 0.65);
        const cz = lerp(heroCloseZ, camZ * 1.05, pull);
        const cx = Math.sin(time * 0.62) * (1.35 * pull + 0.35);
        camY = lerp(pFloorY + 0.92, towerTopY * 0.44, pull) + breatheY;
        this.towerCam.position.set(cx, camY, cz);
        this.towerCam.lookAt(0, lerp(pFloorY + 0.64, towerTopY * 0.34, pull), (TOWER_RADIUS + LEDGE_STAND_OFFSET) * (1 - pull * 0.65));
      } else {
        const startY = Math.min(towerTopY * 0.36, pFloorY + 3.4);
        camY = lerp(startY, pFloorY + 0.82, csEase) + breatheY;
        const cz = lerp(heroCloseZ + 2.4, heroCloseZ, csEase);
        const lookY = lerp(pFloorY + 1.45, pFloorY + 0.62, csEase);
        this.towerCam.position.set(Math.sin(time * 0.45) * 0.48 * (1 - csEase) + 0.38, camY, cz);
        this.towerCam.lookAt(0, lookY, TOWER_RADIUS + LEDGE_STAND_OFFSET);
      }
    } else {
      this.towerCam.position.set(shake.x, camY + shake.y, camZ);
      this.towerCam.lookAt(shake.x, lookYPlay + shake.y, TOWER_RADIUS + LEDGE_STAND_OFFSET);
    }

    // Apply 5-Biome Lighting + Smart `1024x1024` Tight `8m x 8m` Shadow Frustum centered directly on Gateway!
    const rigSpec = BIOME_LIGHT_RIGS[biomeKey] || BIOME_LIGHT_RIGS.canyon_river;
    const blackout = Math.max(0, Math.min(1, state.blackoutFactor || 0));
    const lightning = Math.max(0, Math.min(1.5, state.lightningFlash || 0));
    const lightMult = Math.max(0.32, 1 - blackout * 0.65) + lightning * 1.2 + purify * 0.12;
    const heroYFocus = hero ? hero.floor * fh + 0.65 : camY;
    const shadowFocusY = isWardrobe || isBestiary
      ? (hero?.floor || 2) * fh + 0.65
      : isTitleShowcase
      ? (hero?.floor || 0) * fh + 0.9
      : heroYFocus;

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
    const shadowZCenter = TOWER_RADIUS * 0.65;
    this.keyLight.position.set(
      rigSpec.sunPos[0] * 0.78,
      shadowFocusY + rigSpec.sunPos[1] * 0.78,
      shadowZCenter + rigSpec.sunPos[2] * 0.78
    );
    this.keyLight.target.position.set(0, shadowFocusY, shadowZCenter);
    this.keyLight.target.updateMatrixWorld();

    this.fillLight.color.set(skyPreset?.fillColor || rigSpec.fillCol);
    this.fillLight.intensity = (skyPreset?.fillIntensity ?? rigSpec.fillInt) * lightMult;
    this.rimLight.color.set(skyPreset?.rimColor || rigSpec.rimCol);
    this.rimLight.intensity = ((skyPreset?.rimIntensity ?? rigSpec.rimInt) + (rigSpec.glintInt || 0) * 0.22) * lightMult;

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
      const ovKey = `${tower?.key || tower?.id || 't'}:${tower?.floors || 0}:${tower?.theme || ''}`;
      if (this.oceanVfx && this._lastOceanVfxKey !== ovKey) {
        this._lastOceanVfxKey = ovKey;
        this.oceanVfx.rebuildForTower(tower, fh, TOWER_RADIUS);
      }
      if (this.postfx) {
        this.postfx._lastFrameNow = 0;
        this.postfx._slowFrames = 0;
      }
      cached.compiled = true;
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
    this._applyTowerWorldWeight(cached, state, fh, time);

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
      const focusFloor = resolvedCamFloor;
      if (Math.cos(ct) < -0.08 || Math.abs(colItem.floor - focusFloor) > 5.0) {
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

    // Round 6: Hydro-Ring Speed Gates & 1.85s Exterior Spire Floodgate Water-Surge VFX
    this._syncHydroRings(
      tower?.hydroRings || state.hydroRings,
      effCamCol,
      resolvedCamFloor,
      fh,
      time,
      topple.active ? tg.position.y : 0,
      isWardrobe || isBestiary || isTitleShowcase,
      Boolean(cached?.hasHydroRings)
    );
    this._syncFloodgateSurge(
      state,
      resolvedCamFloor,
      fh,
      time,
      topple.active ? tg.position.y : 0,
      isWardrobe || isBestiary || isTitleShowcase
    );

    // Update Gateway 2.0 `GatewayRig`, Tail-Whip Slash, Tail-Grapple Tether, Tidal Aegis Shield, Overcharge Aura & Title Pedestal
    this.muzzleFlashGroup.visible = false;
    this.wardrobeFxOrb.visible = false;
    this.tailWhipVfxGroup.visible = false;
    this.grappleBeam.visible = false;
    if (this.titlePedestalGroup) this.titlePedestalGroup.visible = false;
    if (this.overchargeAuraGroup) this.overchargeAuraGroup.visible = false;

    if (hero) {
      const pTheta = wrapAngle((hero.col - effCamCol) * COL_ANGLE);
      const standOff = hero.onElevator ? LIFT_STAND_OFFSET : LEDGE_STAND_OFFSET;
      const pr = TOWER_RADIUS + standOff;
      const px = pr * Math.sin(pTheta);
      const pz = pr * Math.cos(pTheta);
      // Plant Gateway's soles 0.00m FLUSH on stone treads & elevator decks (Gateway 2.0 has exact min_y === 0.000m!)
      const isGatewayV2 = typeof this.gatewayRig?.setTargetHeight === 'function';
      const footFlushBias = hero.onGround ? (isGatewayV2 ? 0 : -0.044) : 0;
      const hopU = isTitleShowcase && this._titleHopTimer > 0
        ? 1 - this._titleHopTimer / Math.max(0.01, this._titleHopDuration)
        : 0;
      const titleHopY = hopU > 0 ? Math.sin(hopU * Math.PI) * 0.46 : 0;
      const py = hero.floor * fh + footFlushBias + titleHopY + (topple.active ? tg.position.y : 0);

      const inTunnel = Boolean(hero.hidden && hero.tunnelTimer > 0 && !topple.active);
      this.tunnelVortexGroup.visible = inTunnel;
      if (inTunnel) {
        const vr = TOWER_RADIUS + 0.16;
        this.tunnelVortexGroup.position.set(vr * Math.sin(pTheta), py + 0.64, vr * Math.cos(pTheta));
        this.tunnelVortexGroup.rotation.y = pTheta;
        const vPulse = 0.94 + Math.sin(time * 5.2) * 0.06;
        this.tunnelVortexGroup.scale.setScalar(vPulse);
        this.tunnelVortexGroup.userData.outerRing.rotation.z = time * 2.8;
        this.tunnelVortexGroup.userData.innerRing.rotation.z = -time * 4.4;
      }

      const heroVisible = !hero.hidden && !topple.active && !isBestiary;
      this.gatewayRig.group.visible = heroVisible;
      this.landingRingGroup.visible = heroVisible && !isWardrobe && !isCutscene && !isTitleShowcase;

      // Active Tidal Aegis / Bubble Shield visibility
      const hasAegis = Boolean(
        hero.shield ||
        state.activeSpirePerks?.tidalAegis === true ||
        state.activeSpirePerks?.tidalAegis?.active ||
        state.activeFlowPerks?.tidalAegis?.active ||
        state.activePowerUp === 'bubble_shield' ||
        state.activePowerUp?.kind === 'bubble_shield' ||
        state.activePowerUp?.type === 'bubble_shield'
      );
      this.shieldBubble.visible = Boolean(heroVisible && hasAegis && !isTitleShowcase && !isWardrobe);

      // Hydro-Overcharge / Turbo Current / Hydro-Magnet swirling aura rings around Gateway
      const overchargeOn = Boolean(
        state.activeSpirePerks?.hydroOvercharge === true ||
        state.activeSpirePerks?.hydroOvercharge?.active ||
        state.activeFlowPerks?.hydroOvercharge?.active ||
        state.activePowerUp === 'turbo_current' ||
        state.activePowerUp?.kind === 'turbo_current' ||
        state.activePowerUp?.type === 'turbo_current' ||
        state.activePowerUp === 'hydro_magnet' ||
        state.activePowerUp?.kind === 'hydro_magnet' ||
        state.activePowerUp?.type === 'hydro_magnet'
      );
      if (this.overchargeAuraGroup && heroVisible && overchargeOn && !isTitleShowcase && !isWardrobe) {
        this.overchargeAuraGroup.visible = true;
        this.overchargeAuraGroup.position.set(px, py + 0.14, pz);
        const ud = this.overchargeAuraGroup.userData;
        ud.ringA.rotation.set(Math.PI * 0.5 + Math.sin(time * 2.4) * 0.05, 0, time * 2.2);
        ud.ringB.rotation.set(Math.PI * 0.5 + Math.cos(time * 2.8) * 0.05, 0, -time * 2.9);
        const pulseA = 0.22 + Math.sin(time * 4.5) * 0.05;
        ud.matA.opacity = pulseA;
        ud.matB.opacity = 0.18 + Math.cos(time * 5.2) * 0.04;
        if (ud.motes && ud.moteDummy) {
          const dm = ud.moteDummy;
          for (let mi = 0; mi < ud.moteCount; mi++) {
            const ang = time * 2.8 + (mi / ud.moteCount) * TWO_PI;
            const rad = 0.48 + (mi % 2) * 0.12 + Math.sin(time * 3.6 + mi) * 0.04;
            const my = 0.03 + ((Math.sin(time * 3.2 + mi * 1.7) * 0.5 + 0.5) * 0.28);
            dm.position.set(Math.cos(ang) * rad, my, Math.sin(ang) * rad);
            dm.rotation.set(time * 2.5 + mi, ang, mi);
            dm.scale.setScalar(0.65 + Math.sin(time * 5.0 + mi * 2.1) * 0.28);
            dm.updateMatrix();
            ud.motes.setMatrixAt(mi, dm.matrix);
          }
          ud.motes.instanceMatrix.needsUpdate = true;
        }
      }

      // Carved Sun-Stone Balcony Pedestal underneath Gateway 2.0 on the Title Screen Star Showcase!
      if (this.titlePedestalGroup && heroVisible && isTitleShowcase) {
        this.titlePedestalGroup.visible = true;
        this.titlePedestalGroup.position.set(px, hero.floor * fh, pz);
        this.titlePedestalGroup.userData.glowRing.rotation.z = time * 0.55;
        const burst = this.titlePedestalGroup.userData.hopBurstRing;
        if (hopU > 0) {
          burst.material.opacity = Math.sin(hopU * Math.PI) * 0.85;
          const bScale = 0.85 + hopU * 1.15;
          burst.scale.set(bScale, bScale, 1);
          burst.position.y = 0.12 + hopU * 0.72;
        } else {
          burst.material.opacity = 0;
        }
      }

      // Show illuminated Pelagian Turntable Halo FLUSH right on top of the stone deck underneath Gateway / Bestiary!
      if (this.turntableHalo) {
        this.turntableHalo.visible = isWardrobe || isBestiary;
        if (this.turntableHalo.visible) {
          const haloFloor = isBestiary ? (hero?.floor || 2) : (hero?.floor ?? 0);
          const haloY = haloFloor * fh + 0.014;
          this.turntableHalo.position.set(0, haloY, TOWER_RADIUS + LEDGE_STAND_OFFSET + 0.015);
          this.turntableHalo.userData.outer.rotation.z = time * 0.45;
          this.turntableHalo.userData.inner.rotation.z = -time * 0.72;
        }
      }

      if (heroVisible) {
        // Gateway 2.0 (#611): auto-normalized internally to 1.22m when scale === 1.0 (0.97 Wardrobe, 1.04 Title Showcase).
        // Legacy fallback before Gateway 2.0 merges: 1.04 gameplay (1.232m), 1.00 Wardrobe, 1.06 Title Showcase.
        const heroScale = isGatewayV2
          ? (isWardrobe ? 0.97 : isTitleShowcase ? 1.04 : 1.0)
          : (isWardrobe ? 1.0 : isTitleShowcase ? 1.06 : 1.04);
        this.gatewayRig.group.scale.setScalar(heroScale);
        this.gatewayRig.group.position.set(px, py, pz);

        // Interactive 360° Sanctuary Turntable Orbit & Title Star Gaze/Hop Twirl!
        const reqWardYaw = state.wardrobeOrbitYaw ?? this.wardrobePreview.yaw;
        if (isWardrobe) {
          const targetYaw = reqWardYaw != null ? Number(reqWardYaw) : Math.sin(time * 0.85) * 0.55;
          this._wardrobeYawSmooth += (targetYaw - this._wardrobeYawSmooth) * Math.min(1, dt * 14);
          this.gatewayRig.group.rotation.y = pTheta + this._wardrobeYawSmooth;
        } else if (isTitleShowcase) {
          const hopSpin = hopU > 0 ? hopU * TWO_PI : 0;
          this.gatewayRig.group.rotation.y = pTheta + gaze.x * 0.34 + Math.sin(time * 0.75) * 0.14 + hopSpin;
        } else {
          this.gatewayRig.group.rotation.y = pTheta;
        }

        const mf = Math.max(0, Number(hero.muzzleFlash || hero.hydroFlash) || 0);
        const whipT = Math.max(0, Number(hero.tailWhipTimer || hero.whipTimer) || 0);
        const rawWardAnim = isWardrobe ? (state.wardrobeAnimOverride ?? this.wardrobePreview.anim) : null;
        const resolvedAnim = rawWardAnim
          ? String(rawWardAnim).replace(/[\s_-]+/g, '').toLowerCase()
          : hero.anim || null;
        const animClipMap = {
          idle: 'IdleBreathe',
          idlebreathe: 'IdleBreathe',
          idlecurious: 'IdleCurious',
          curious: 'IdleCurious',
          edgeteeter: 'EdgeTeeter',
          teeter: 'EdgeTeeter',
          springsomersault: 'SpringSomersault',
          somersault: 'SpringSomersault',
          wetshake: 'WetShake',
          run: 'FluidRun',
          fluidrun: 'FluidRun',
          tailwhip: 'TailWhip',
          whip: 'TailWhip',
          frillglide: 'FrillGlide',
          glide: 'FrillGlide',
          freeswim: 'FreeSwim',
          swim: 'FreeSwim',
          coredive: 'CoreDive',
          dive: 'CoreDive',
          celebrate: 'Celebrate',
          herocelebrate: 'Celebrate',
          victory: 'Celebrate',
          hydrocast: 'HydroCast',
          cast: 'HydroCast',
          stairclimb: 'StairClimb',
          wallscamper: 'WallScamper',
        };
        const finalAnim = resolvedAnim ? (animClipMap[resolvedAnim] || rawWardAnim || hero.anim || null) : null;
        const heroMood = isTitleShowcase
          ? (this._titleHopTimer > 0 ? 'joyful' : this._titleWaveTimer > 0 ? 'curious' : 'happy')
          : (hero.mood || state.gatewayMood || (hero.hurtTimer > 0 ? 'hurt' : whipT > 0.02 ? 'determined' : 'happy'));

        this.gatewayRig.update(dt, {
          time,
          vx: isWardrobe && finalAnim === 'FluidRun' ? 3.2 : hero.vx || 0,
          vy: isTitleShowcase && hopU > 0 ? Math.cos(hopU * Math.PI) * 5.2 : hero.vy || 0,
          facing: hero.facing || 1,
          onGround: isTitleShowcase
            ? hopU <= 0
            : isWardrobe && (finalAnim === 'FrillGlide' || finalAnim === 'FreeSwim' || finalAnim === 'CoreDive')
            ? false
            : Boolean(hero.onGround),
          onElevator: hero.onElevator,
          onStairs: Boolean(hero.onStairs),
          stairSlope: hero.stairSlope ?? hero.stairDir ?? 0,
          wallScamper: Boolean(hero.wallScamper || hero.climbing || finalAnim === 'WallScamper'),
          isSwimming: Boolean(hero.isSwimming || finalAnim === 'FreeSwim'),
          coreDive: Boolean(finalAnim === 'CoreDive'),
          tailWhipTimer: isWardrobe && finalAnim === 'TailWhip' ? 0.3 : whipT,
          frillFlare: isWardrobe && finalAnim === 'FrillGlide' ? 1.0 : hero.frillFlare || (overchargeOn ? 0.35 : 0),
          squashX: hero.squashX || 1,
          squashY: hero.squashY || 1,
          landImpact: hero.landImpact || 0,
          landSquash: hero.landSquash || 0,
          skidTimer: hero.skidTimer || 0,
          stairStepBob: hero.stairStepBob || 0,
          muzzleFlash: isWardrobe && finalAnim === 'HydroCast' ? 0.14 : mf,
          hurtTimer: hero.hurtTimer || 0,
          invuln: isWardrobe || isCutscene || isTitleShowcase || state.mode === 'title' ? 0 : hero.invuln || 0,
          enteringDoor: hero.enteringDoor || 0,
          anim: finalAnim,
          mood: heroMood,
          edgeTeeter: Number(hero.edgeTeeter) || 0,
          wetShakeTimer: Number(hero.wetShakeTimer) || 0,
          springSomersault: Boolean(hero.springSomersault || (hero.steamBoostActive && !hero.onGround && hero.vy > -1.0)),
          lookTarget: hero.lookTarget || null,
          pointerGaze: isTitleShowcase ? { x: gaze.x, y: gaze.y } : null,
          titleShowcase: isTitleShowcase,
          titleWave: isTitleShowcase && this._titleWaveTimer > 0,
          titleHop: isTitleShowcase && this._titleHopTimer > 0,
          cutscene: isCutscene && !csKind.includes('epilogue'),
          victory: state.mode === 'victory' || (isCutscene && (csKind === 'epilogue' || csKind.includes('purif'))),
        });

        // 360° Feathered Crescent Hydro-Blade Tail-Whip Slash Arc!
        if (whipT > 0.01 && !isWardrobe) {
          const facingDir = hero.facing || 1;
          this.tailWhipVfxGroup.visible = true;
          this.tailWhipVfxGroup.position.set(px, py + 0.56, pz);
          this.tailWhipVfxGroup.rotation.set(0.08, pTheta + time * 18 * facingDir, -0.10 * facingDir);
          const whipAlpha = Math.min(1, whipT * 3.2);
          const sweepScale = 0.96 + (1 - whipAlpha) * 0.28;
          this.tailWhipVfxGroup.scale.set(sweepScale * facingDir, sweepScale, sweepScale);
          this.tailWhipVfxGroup.userData.slashRing.material.opacity = whipAlpha * 0.94;
          this.tailWhipVfxGroup.userData.innerDisc.material.opacity = whipAlpha * 0.56;
        }

        // Aerial Braided Pelagian Aqua-Gold Tail-Grapple Swing Tether!
        if (hero.grappleTarget && hero.grappleTarget.col != null && hero.grappleTarget.floor != null) {
          const gTheta = wrapAngle((hero.grappleTarget.col + 0.5 - effCamCol) * COL_ANGLE);
          const gr = TOWER_RADIUS + LEDGE_STAND_OFFSET;
          const tailSide = -(hero.facing || 1) * 0.04;
          const tTheta = pTheta + tailSide;
          const tr = pr - 0.05;
          this._grappleStart.set(tr * Math.sin(tTheta), py + 0.50, tr * Math.cos(tTheta));
          this._grappleEnd.set(gr * Math.sin(gTheta), hero.grappleTarget.floor * fh, gr * Math.cos(gTheta));
          const dist = this._grappleStart.distanceTo(this._grappleEnd);
          if (dist > 0.1) {
            this.grappleBeam.visible = true;
            this.grappleBeam.position.copy(this._grappleStart);
            this.grappleBeam.lookAt(this._grappleEnd);
            this.grappleBeam.scale.set(1, 1, 1);
            const gUd = this.grappleBeam.userData;
            if (gUd?.cord) gUd.cord.scale.set(1, 1, dist);
            if (gUd?.sheath) gUd.sheath.scale.set(1, 1, dist);
            if (gUd?.endClasp) {
              gUd.endClasp.position.set(0, 0, dist);
              gUd.endClasp.rotation.z = time * 4.2;
            }
            if (this.braidedTetherTex) {
              this.braidedTetherTex.repeat.set(1, Math.max(2, dist * 2.6));
              this.braidedTetherTex.offset.y = -time * 1.8;
            }
          }
        }

        if (mf > 0.01 && !isWardrobe) {
          const facingDir = hero.facing || 1;
          const mTheta = pTheta + facingDir * 0.105;
          const mr = TOWER_RADIUS + standOff + 0.10;
          const flashScale = Math.min(1.25, 0.58 + mf * 3.8);
          this.muzzleFlashGroup.visible = true;
          this.muzzleFlashGroup.position.set(mr * Math.sin(mTheta), py + 0.64, mr * Math.cos(mTheta));
          this.muzzleFlashGroup.scale.setScalar(flashScale);
          this.muzzleFlashGroup.rotation.set(0, mTheta, time * 10 * facingDir);
          if (this.muzzleFlashGroup.userData?.core) {
            this.muzzleFlashGroup.userData.core.rotation.set(time * 16, time * 12, 0);
          }
          this.heroLight.color.set(activeFx.prismatic ? this._prismColor : activeFx.muzzle);
          this.heroLight.intensity = 1.15;
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
          this.wardrobeFxOrb.scale.setScalar(0.56);
          wUd.icosa.visible = activeFx.shape !== 'prism';
          wUd.prism.visible = activeFx.shape === 'prism';
          wUd.ring.visible = Boolean(activeFx.ring);
          wUd.icosa.rotation.set(time * 4.5, 0.35 + Math.sin(time * 1.8) * 0.22, 0);
          wUd.prism.rotation.set(time * 4.8, 0.35 + Math.sin(time * 1.8) * 0.22, 0);
          wUd.ring.rotation.set(time * 7.5, 0, 0);
          wUd.trailCluster.rotation.set(Math.sin(time * 2.4) * 0.18, time * 3.2, 0);
        }

        if (this.shieldBubble.visible) {
          this.shieldBubble.position.set(px, py + 0.62, pz);
          this.shieldBubble.rotation.y = time * 1.8;
        }

        const waterFl = state.waterFloor != null ? state.waterFloor : -0.55;
        const lf = hero.landingFloor != null ? hero.landingFloor : waterFl;
        const dist = Math.max(0, (hero.floor - lf) * fh);
        // Crisp dark ground-contact AO shadow disc flush on stone/elevator surface right under Gateway's soles!
        this.landingRingGroup.position.set(px, lf * fh - 0.004, pz);
        const aoScale = Math.max(0.42, 1.0 - dist * 0.14);
        this.landingRingGroup.scale.setScalar(aoScale);
        if (this.landingRingGroup.userData.shadow?.material) {
          const overWater = lf <= waterFl + 0.08;
          this.landingRingGroup.userData.shadow.material.opacity = overWater
            ? 0.0
            : Math.max(0.18, 0.92 - dist * 0.22);
        }
      }
    }

    // Update 7 Original Articulated Enemies + Barnacle Mortar Projectiles (`src/enemyRig.js`) + Wave 4 Bestiary Turntable!
    if (this.enemyVisuals) {
      if (isBestiary) {
        const bFamily = String(bestiarySpec.family || bestiarySpec.type || 'snap_crab');
        const bYaw = Number(bestiarySpec.yaw ?? time * 0.65) || 0;
        this._bestiaryYawSmooth += (bYaw - this._bestiaryYawSmooth) * Math.min(1, dt * 14);
        const bFloor = hero?.floor ?? 2;
        if (typeof this.enemyVisuals.setBestiaryShowcase === 'function') {
          this.enemyVisuals.setBestiaryShowcase({
            active: true,
            family: bFamily,
            yaw: this._bestiaryYawSmooth,
            zoom: Number(bestiarySpec.zoom) || 1.0,
            anim: bestiarySpec.anim || null,
            time,
            x: 0,
            y: bFloor * fh,
            z: TOWER_RADIUS + LEDGE_STAND_OFFSET,
          });
        } else {
          // Instant Frame-0 fallback using live weathered PBR `.glb` rig via `syncEnemies`!
          const unit = this._bestiaryEnemyProxy[0];
          unit.type = bFamily;
          unit.col = effCamCol;
          unit.floor = bFloor;
          unit.telegraph = bFamily.includes('warden') ? 0.45 + 0.35 * Math.sin(time * 2.5) : 0;
          unit.shielded = bFamily.includes('warden');
          unit.bossPhase = 2;
          unit.openAmount = bFamily.includes('mortar') ? 0.5 + 0.45 * Math.sin(time * 2.4) : 0;
          unit.inflatePhase = bFamily.includes('hopper') ? 0.5 + 0.45 * Math.sin(time * 3.0) : 0;
          unit.slitherPhase = time * 4.2;
          this._enemyExtraOpts.enemyProjectiles = null;
          this.enemyVisuals.syncEnemies(
            this._bestiaryEnemyProxy,
            effCamCol,
            fh,
            TOWER_RADIUS,
            time,
            0,
            this._enemyExtraOpts
          );
          if (this.enemyVisuals.root) {
            this.enemyVisuals.root.visible = true;
            for (const child of this.enemyVisuals.root.children) {
              if (child && child.visible && child.isGroup) {
                child.rotation.y = this._bestiaryYawSmooth;
              }
            }
          }
        }
        this._trimEnemyShadows();
      } else {
        this.enemyVisuals.setBestiaryShowcase?.({ active: false });
        this._enemyExtraOpts.enemyProjectiles = state.enemyProjectiles || null;
        this._enemyExtraOpts.heroFloor = hero?.floor != null ? hero.floor : resolvedCamFloor;
        this._enemyExtraOpts.camFloor = resolvedCamFloor;
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
    }

    // Round 4: 7-Enemy Personality Visual Tells (skater sparks, eel arcs, crab/stalker steam, parabolic mortar bombs!)
    this._syncEnemyPersonalityVfx(
      state,
      effCamCol,
      fh,
      time,
      topple.active ? tg.position.y : 0,
      resolvedCamFloor,
      isWardrobe || isBestiary
    );

    // Wave 4: 3D Telegraphed Boss Hazards (`state.bossHazards` sweeping hydro-beams & tentacle slams)
    this._updateBossHazards(
      isWardrobe || isBestiary ? null : state.bossHazards,
      effCamCol,
      fh,
      time,
      topple.active ? tg.position.y : 0
    );

    // Fold Floodgate Water-Surge luminance cleanly into heroLight (zero 2nd PointLight overhead!)
    if (surgeEnv > 0.04 && this.heroLight) {
      this.heroLight.color.set('#5efce8');
      this.heroLight.intensity = Math.max(this.heroLight.intensity, (1.4 + surgeEnv * 2.2) * lightMult);
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
      const sbDir = sb.dir || (sb.vx >= 0 ? 1 : -1);
      ud.icosa.visible = activeFx.shape !== 'prism';
      ud.prism.visible = activeFx.shape === 'prism';
      ud.ring.visible = Boolean(activeFx.ring);
      // Orient sculpted water-bolt spearhead & spiraling slipstream along travel direction!
      ud.icosa.scale.x = sbDir;
      ud.prism.scale.x = sbDir;
      ud.ring.scale.x = sbDir;
      ud.icosa.rotation.set(time * 12 * sbDir, 0, 0);
      ud.prism.rotation.set(time * 14 * sbDir, 0, 0);
      ud.ring.rotation.set(time * 16 * sbDir, 0, 0);

      ud.trailCluster.scale.x = sbDir;
      ud.trailCluster.position.y = Math.sin(time * 22 + i) * 0.022;
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
      const nearWaterOrVfx = (hero?.floor || 0) * fh <= waterY + 2.4;
      if (isWardrobe || isBestiary || (isTitleShowcase && (hero?.floor || 0) < 0.85) || !nearWaterOrVfx) {
        this.oceanVfx.setVisible?.(false);
      } else {
        this.oceanVfx.setVisible?.(true);
        this.oceanVfx.update(showcaseState, effCamCol, time, dt);
      }
    }

    // Living Rescued Sea Turtles & River Otters swimming & cheering in the Title Lagoon AND at the Spire Spawn Quay!
    const nearSpireDock = !isWardrobe && !isBestiary && !topple.active && resolvedCamFloor <= 3.6;
    this._updateWildlifeLagoon(
      state,
      time,
      waterY,
      Boolean((isTitleShowcase || nearSpireDock) && !isWardrobe && !isBestiary && !topple.active)
    );

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
    this.collectibleGroup.visible = !isWardrobe && !isBestiary;
    if (isWardrobe && !isBestiary && this.enemyVisuals?.root) {
      this.enemyVisuals.root.visible = false;
    }

    // Pre-compile all exact live shaders ONCE after collectibles, enemies, oceanVfx & arch GLBs are attached,
    // and upload newly-decoded biome sky/arch WebPs as soon as ready -> ZERO cold-biome launch stalls!
    const totalSkyTex = Array.isArray(this.stormSky?._ownedTextures) ? this.stormSky._ownedTextures.length : 0;
    if (
      this._lastUploadedWebpVer !== getBakedArchWebpVersion() ||
      (totalSkyTex > 0 && (this._skyTexUploadedCount || 0) < totalSkyTex)
    ) {
      this._uploadAllReadyTextures();
    }
    const enemiesNowReady = Boolean(this.enemyVisuals?.isReady?.());
    // Never trigger a blocking full-scene shader re-compile on frame 1 of active gameplay launch!
    const allowBackgroundCompile = isTitleShowcase || !this._towerSceneCompiled;
    if (
      allowBackgroundCompile &&
      (!this._towerSceneCompiled ||
        (!this._enemiesGlbCompiled && enemiesNowReady) ||
        this._compiledArchVersion !== this._archPropsVersion)
    ) {
      this._compileAllTowerShaders();
      this._towerSceneCompiled = true;
      this._enemiesGlbCompiled = enemiesNowReady;
      this._compiledArchVersion = this._archPropsVersion;
    }

    // Single-pass analytic water reflection runs inside `src/water.js` (0 extra scene render passes!)
    // Update tight 512x512 hero-only shadow frustum on alternating frames (every 4th on iGPU) for locked 60fps!
    const shadowStep = this._isIntegratedGpu ? 4 : 2;
    if (((this._shadowTick++ % shadowStep) === 0) || this._shadowTick <= 4) {
      this.webgl.shadowMap.needsUpdate = true;
    }
    this._renderWithComposer(this.towerScene, this.towerCam, {
      biome: biomeKey,
      purification: purify,
      flash: lightning,
      darkness: blackout,
    });
  }

  _ensureCoreDescentScene() {
    if (this._coreDescentCtx) return this._coreDescentCtx;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#05212f');
    // Rich deep oceanic exponential depth fog for monumental chiaroscuro reactor depth!
    scene.fog = new THREE.FogExp2('#05212f', 0.031);
    const env = this._getBiomeEnvMap('coral_sea') || this._getBiomeEnvMap(this.biome);
    if (env) {
      scene.environment = env;
      scene.environmentIntensity = 0.90;
    }

    const aspect = Math.max(0.38, this.width / Math.max(1, this.height));
    const camera = new THREE.PerspectiveCamera(58, aspect, 0.14, 120);
    camera.position.set(0, 0.42, 5.4);
    camera.lookAt(0, 0, -22);

    // Lean 60fps Chiaroscuro Lighting Rig (1 Hemi + 2 Dir + 1 Hero PointLight, ZERO shadow pass!)
    // Warm sunlit golden intake + electric turquoise-gold rim light carving Gateway 2.0 & riveted bronze!
    const hemi = new THREE.HemisphereLight('#6ee7f0', '#071f2e', 0.96);
    const sunIntake = new THREE.DirectionalLight('#ffefc2', 2.45);
    sunIntake.position.set(3.8, 5.8, 11.5);
    const rimAqua = new THREE.DirectionalLight('#38f5e6', 1.72);
    rimAqua.position.set(-5.8, -4.6, -5.0);
    const heroKey = new THREE.PointLight('#ffe8a8', 3.1, 11.5, 1.35);
    heroKey.position.set(0, 1.1, 2.2);
    scene.add(hemi, sunIntake, rimAqua, heroKey);

    const SHAFT_SCALE = 0.62; // Inner buttress radius = 8.30 * 0.62 = 5.15m; tile height = 12.0 * 0.62 = 7.44m
    const SHAFT_TILE_LEN = 12.0 * SHAFT_SCALE;

    // 1. Sculpted Pelagian Hydro-Reactor Shaft Container (8 seamlessly tiled `ShaftRing_Main` GLB segments -> 96% fogged by -52m!)
    const shaftGroup = new THREE.Group();
    const shaftRingSlots = [];
    for (let i = 0; i < 8; i++) {
      const slot = new THREE.Group();
      slot.position.z = SHAFT_TILE_LEN - i * SHAFT_TILE_LEN;
      shaftGroup.add(slot);
      shaftRingSlots.push(slot);
    }

    // Subtle Volumetric Cascading Water-Curtain Ribbons hugging the sculpted masonry shaft walls
    const curtainGroup = new THREE.Group();
    const curtainMat = new THREE.MeshBasicMaterial({
      map: this.hydroWakeTex,
      color: '#7af7f0',
      transparent: true,
      opacity: 0.20,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const curtainGeo = new THREE.PlaneGeometry(1.45, SHAFT_TILE_LEN * 1.15);
    const waterCurtains = [];
    for (let c = 0; c < 12; c++) {
      const ang = (c / 12) * TWO_PI + 0.14;
      const tier = c % 3;
      const cm = new THREE.Mesh(curtainGeo, curtainMat);
      const rad = 4.92;
      cm.position.set(Math.cos(ang) * rad, Math.sin(ang) * rad, -tier * 18.5);
      cm.rotation.order = 'ZYX';
      cm.rotation.z = ang + Math.PI * 0.5;
      cm.rotation.x = Math.PI * 0.5;
      curtainGroup.add(cm);
      waterCurtains.push({ mesh: cm, ang, rad, offset: (c * 5.2) % 56 });
    }
    shaftGroup.add(curtainGroup);

    // Zone 1 Upper Sunlit Intake Volumetric God-Ray Cones pouring down from breached Crown Valve
    const intakeBeams = new THREE.Group();
    const beamMat = new THREE.MeshBasicMaterial({
      map: this.glowDotTex,
      color: '#c8f5ff',
      transparent: true,
      opacity: 0.30,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    for (let b = 0; b < 5; b++) {
      const bAng = (b / 5) * TWO_PI + 0.35;
      const bm = new THREE.Mesh(new THREE.PlaneGeometry(1.9, 24), beamMat);
      bm.position.set(Math.cos(bAng) * 2.1, Math.sin(bAng) * 2.1, -5);
      bm.rotation.set(Math.PI * 0.44, 0, bAng);
      intakeBeams.add(bm);
    }
    shaftGroup.add(intakeBeams);
    scene.add(shaftGroup);

    // 2. Pooled Spinning Riveted-Bronze Hydro-Turbines (8 slots mounted with `Turbine_Blades` GLB!)
    const turbineGroup = new THREE.Group();
    const turbinePool = [];
    for (let i = 0; i < 8; i++) {
      const tg = new THREE.Group();
      tg.visible = false;
      turbineGroup.add(tg);
      turbinePool.push(tg);
    }
    scene.add(turbineGroup);

    // 3. Pooled Ornate Astrolabe-Caged Hydro-Crystal Locks (6 slots mounted with `PowerCore_Crystal` GLB!)
    const crystalGroup = new THREE.Group();
    const crystalPool = [];
    const crystalGlowMat = new THREE.SpriteMaterial({
      map: this.glowDotTex,
      color: '#5efce8',
      transparent: true,
      opacity: 0.46,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    for (let i = 0; i < 6; i++) {
      const cg = new THREE.Group();
      cg.visible = false;
      const corePivot = new THREE.Group();
      const glowSprite = new THREE.Sprite(crystalGlowMat);
      glowSprite.scale.set(2.9, 2.9, 1);
      cg.add(corePivot, glowSprite);
      crystalGroup.add(cg);
      crystalPool.push({ group: cg, corePivot, glowSprite });
    }
    scene.add(crystalGroup);

    // 4. Exploding Crystal Shatter Quartz Shards & Expanding Harmonic Shockwave Rings
    const shatterGroup = new THREE.Group();
    const shockwavePool = [];
    const shockGeo = new THREE.RingGeometry(0.84, 1.04, 32);
    const shardGeo = new THREE.TetrahedronGeometry(0.18, 0);
    for (let s = 0; s < 4; s++) {
      const swMat = new THREE.MeshBasicMaterial({
        color: '#5efce8',
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
        depthWrite: false,
      });
      const sw = new THREE.Mesh(shockGeo, swMat);
      sw.visible = false;
      const shards = [];
      for (let k = 0; k < 14; k++) {
        const ang = (k / 14) * TWO_PI;
        const sh = new THREE.Mesh(
          shardGeo,
          new THREE.MeshBasicMaterial({
            color: k % 2 === 0 ? '#5efce8' : '#fde047',
            transparent: true,
            opacity: 0,
          })
        );
        sh.visible = false;
        shatterGroup.add(sh);
        shards.push({
          mesh: sh,
          vx: Math.cos(ang) * (2.6 + (k % 3) * 0.95),
          vy: Math.sin(ang) * (2.6 + (k % 3) * 0.95),
          vz: ((k % 4) - 1.5) * 1.6,
        });
      }
      shatterGroup.add(sw);
      shockwavePool.push({ sw, swMat, shards });
    }
    scene.add(shatterGroup);

    // 5. Pooled Carved Pelagian Bronze Speed-Gate Rings (12 slots mounted with `BoostRing_Bronze` GLB!)
    const ringGroup = new THREE.Group();
    const ringPool = [];
    for (let r = 0; r < 12; r++) {
      const rg = new THREE.Group();
      rg.visible = false;
      ringGroup.add(rg);
      ringPool.push(rg);
    }
    scene.add(ringGroup);

    // Pooled Downward Hydro-Pulses (12 slots)
    const pulseGroup = new THREE.Group();
    const pulsePool = [];
    const pulseGeo = new THREE.IcosahedronGeometry(0.24, 1);
    const pulseMat = new THREE.MeshBasicMaterial({ color: '#7dd3fc' });
    for (let p = 0; p < 12; p++) {
      const pm = new THREE.Mesh(pulseGeo, pulseMat);
      pm.visible = false;
      pulseGroup.add(pm);
      pulsePool.push(pm);
    }
    scene.add(pulseGroup);

    // 6. Distant Glowing Bedrock Sanctuary Dome (`Shaft_BottomSanctuary` GLB + Purification Wave!)
    const sanctuaryGroup = new THREE.Group();
    const sanctuaryMount = new THREE.Group();
    sanctuaryGroup.add(sanctuaryMount);
    const purifySphereMat = new THREE.MeshBasicMaterial({
      color: '#5efce8',
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const purifySphere = new THREE.Mesh(new THREE.SphereGeometry(1.0, 22, 16), purifySphereMat);
    sanctuaryGroup.add(purifySphere);
    scene.add(sanctuaryGroup);

    // 7. Subtle Slipstream Wind-Mist Streaks (InstancedMesh = 1 draw call!)
    const streakCount = 24;
    const streakMat = new THREE.MeshBasicMaterial({
      color: '#d8f9ff',
      transparent: true,
      opacity: 0.22,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const streakGeo = new THREE.PlaneGeometry(0.055, 3.6);
    streakGeo.rotateX(Math.PI * 0.5);
    const streakInst = new THREE.InstancedMesh(streakGeo, streakMat, streakCount);
    streakInst.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    const streakMeta = [];
    const streakDummy = new THREE.Object3D();
    for (let st = 0; st < streakCount; st++) {
      const ang = (st / streakCount) * TWO_PI + (st % 3) * 0.12;
      const rad = 2.6 + (st % 4) * 0.48;
      streakMeta.push({ ang, rad, offset: (st * 3.9) % 38 });
    }
    scene.add(streakInst);

    // 8. Hero-Lit Gateway 2.0 Head-First Skydiving Rig + Aqua Corkscrew Drill-Vortex Cone
    // Note: `CoreDive` clip pitches Pelvis +1.32 rad head-first toward +Z; `diveAlignGroup.rotation.y = Math.PI`
    // directs her head straight DOWN into the -Z shaft while trailing her scarf, frills & tail heroically toward camera!
    const gatewayRig = new GatewayRig(this.skinId);
    const diveAlignGroup = new THREE.Group();
    diveAlignGroup.rotation.y = Math.PI;
    diveAlignGroup.position.set(0, -0.32, 0.34);
    diveAlignGroup.add(gatewayRig.group);

    const heroMount = new THREE.Group();
    heroMount.add(diveAlignGroup);
    const drillMat = new THREE.MeshBasicMaterial({
      map: this.hydroWakeTex,
      color: '#5efce8',
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const drillCone = new THREE.Mesh(new THREE.ConeGeometry(0.92, 2.35, 18, 1, true), drillMat);
    drillCone.rotation.x = -Math.PI * 0.5;
    drillCone.position.z = -0.35;
    heroMount.add(drillCone);
    scene.add(heroMount);

    // Warm luminous turquoise sanctuary vanishing-point halo far down the shaft
    const depthMistHalo = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: this.glowDotTex,
        color: '#2dd4bf',
        transparent: true,
        opacity: 0.38,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    depthMistHalo.position.set(0, 0, -48);
    depthMistHalo.scale.set(16, 16, 1);
    scene.add(depthMistHalo);

    this._coreDescentCtx = {
      scene,
      camera,
      hemi,
      sunIntake,
      rimAqua,
      heroKey,
      shaftScale: SHAFT_SCALE,
      shaftTileLen: SHAFT_TILE_LEN,
      shaftRingSlots,
      waterCurtains,
      curtainMat,
      intakeBeams,
      beamMat,
      turbinePool,
      crystalPool,
      crystalGlowMat,
      shockwavePool,
      ringPool,
      pulsePool,
      sanctuaryGroup,
      sanctuaryMount,
      purifySphere,
      purifySphereMat,
      streakInst,
      streakMeta,
      streakDummy,
      streakMat,
      gatewayRig,
      heroMount,
      drillCone,
      drillMat,
      wallConduitMats: [],
      glbMounted: false,
      smoothFov: 58,
      lastTime: 0,
      zoneFogA: new THREE.Color('#083142'), // Zone 1: Deep sunlit intake turquoise-teal
      zoneFogB: new THREE.Color('#062634'), // Zone 2: Deep atmospheric Pelagian marine shaft
      zoneFogC: new THREE.Color('#0a424d'), // Zone 3: Luminous sunlit turquoise bedrock sanctuary
      tmpCol: new THREE.Color(),
    };

    if (this.glbModels?.env_core_reactor) {
      this._mountCoreReactorGlb(this._coreDescentCtx, this.glbModels.env_core_reactor);
    } else {
      // Ensure GLB loads even if `_ensureCoreDescentScene` was invoked before `_loadBlenderAssets` settled
      try {
        const loader = new GLTFLoader();
        loader.load(
          'assets/models/env_core_reactor.glb',
          (gltf) => {
            if (gltf?.scene) {
              this.glbModels.env_core_reactor = this._prepareGlbScene(gltf.scene);
              if (this._coreDescentCtx && !this._coreDescentCtx.glbMounted) {
                this._mountCoreReactorGlb(this._coreDescentCtx, this.glbModels.env_core_reactor);
              }
            }
          },
          undefined,
          () => {}
        );
      } catch {}
    }

    return this._coreDescentCtx;
  }

  /**
   * Mounts all 5 Blender-sculpted sub-assets from `assets/models/env_core_reactor.glb`
   * (`ShaftRing_Main`, `Turbine_Blades`, `PowerCore_Crystal`, `BoostRing_Bronze`, `Shaft_BottomSanctuary`)
   * with Art-Director chiaroscuro material separation: moody stone walls + radiant foreground bronze/crystals!
   */
  _mountCoreReactorGlb(ctx, glbRoot) {
    if (!ctx || !glbRoot || ctx.glbMounted) return;
    const findPart = (name) => glbRoot.getObjectByName(name) || null;
    const shaftSrc = findPart('ShaftRing_Main');
    const turbineSrc = findPart('Turbine_Blades');
    const crystalSrc = findPart('PowerCore_Crystal');
    const boostSrc = findPart('BoostRing_Bronze');
    const sanctuarySrc = findPart('Shaft_BottomSanctuary');
    if (!shaftSrc) return;

    const SHAFT_SCALE = ctx.shaftScale || 0.62;
    const wallMatCache = new Map();
    const fgMatCache = new Map();
    ctx.wallConduitMats = [];

    const cloneTunedMat = (mat, role) => {
      if (!mat) return mat;
      const cache = role === 'wall' ? wallMatCache : fgMatCache;
      const cacheKey = `${role}:${mat.name || mat.uuid}`;
      if (cache.has(cacheKey)) return cache.get(cacheKey);
      const m = mat.clone();
      const mn = String(m.name || '').toLowerCase();
      if (role === 'wall') {
        if (mn.includes('conduit') || mn.includes('aqua')) {
          m.emissiveIntensity = 0.44;
          m.envMapIntensity = 0.55;
          ctx.wallConduitMats.push(m);
        } else if (mn.includes('bronze')) {
          m.color.multiplyScalar(0.74);
          m.envMapIntensity = 0.68;
        } else {
          // Carved basalt/sandstone shaft walls deeply atmospheric & non-metallic (clamp ORM B-channel chrome!)
          m.color.multiplyScalar(0.68);
          m.envMapIntensity = 0.48;
          if (mn.includes('basalt') || mn.includes('stone') || mn.includes('rock')) {
            m.metalness = 0.06;
            m.roughness = Math.max(m.roughness ?? 0.72, 0.76);
          }
        }
      } else if (role === 'sanctuary') {
        if (mn.includes('pool') || mn.includes('conduit') || mn.includes('aqua')) {
          m.emissiveIntensity = 1.38;
          m.envMapIntensity = 1.25;
        } else if (mn.includes('bronze') || mn.includes('amber')) {
          m.emissiveIntensity = Math.min(1.85, (m.emissiveIntensity || 0.6) * 1.15);
          m.envMapIntensity = 1.25;
        } else {
          m.envMapIntensity = 0.85;
          if (mn.includes('basalt') || mn.includes('stone')) {
            m.metalness = 0.06;
            m.roughness = Math.max(m.roughness ?? 0.72, 0.74);
          }
        }
      } else {
        // High-contrast foreground gameplay readability (Turbine_Blades, PowerCore_Crystal, BoostRing_Bronze)
        if (mn.includes('amber') || mn.includes('hazard')) {
          m.emissiveIntensity = 2.05;
          m.envMapIntensity = 1.1;
        } else if (mn.includes('aqua') || mn.includes('conduit')) {
          m.emissiveIntensity = 1.85;
          m.envMapIntensity = 1.2;
        } else if (mn.includes('bronze')) {
          m.color.multiplyScalar(1.12);
          m.envMapIntensity = 1.42;
        }
      }
      m.userData = { ...(m.userData || {}), shared: true };
      cache.set(cacheKey, m);
      return m;
    };

    const prepareClone = (src, role) => {
      const c = src.clone(true);
      c.position.set(0, 0, 0);
      c.rotation.set(0, 0, 0);
      c.scale.set(1, 1, 1);
      c.traverse((obj) => {
        if (!obj.isMesh) return;
        obj.castShadow = false;
        obj.receiveShadow = false;
        if (Array.isArray(obj.material)) {
          obj.material = obj.material.map((mm) => cloneTunedMat(mm, role));
        } else {
          obj.material = cloneTunedMat(obj.material, role);
        }
      });
      return c;
    };

    // 1. Mount 10 tiled `ShaftRing_Main` sculpted stone/bronze reactor shaft segments
    for (let i = 0; i < ctx.shaftRingSlots.length; i++) {
      const slot = ctx.shaftRingSlots[i];
      slot.clear();
      const seg = prepareClone(shaftSrc, 'wall');
      seg.rotation.x = Math.PI * 0.5;
      seg.scale.setScalar(SHAFT_SCALE);
      // Alternate 30° twist every other segment for organic monumental architectural continuity
      if (i % 2 === 1) seg.rotation.y = Math.PI / 6;
      slot.add(seg);
    }

    // 2. Mount 8 pooled `Turbine_Blades` riveted antique-bronze hydrofoil rotors
    if (turbineSrc) {
      for (let i = 0; i < ctx.turbinePool.length; i++) {
        const slot = ctx.turbinePool[i];
        slot.clear();
        const rotor = prepareClone(turbineSrc, 'fg');
        rotor.rotation.x = Math.PI * 0.5;
        rotor.scale.setScalar(0.64);
        slot.add(rotor);
      }
    }

    // 3. Mount 6 pooled `PowerCore_Crystal` ornate astrolabe-caged faceted crystal clusters
    if (crystalSrc) {
      for (let i = 0; i < ctx.crystalPool.length; i++) {
        const slot = ctx.crystalPool[i];
        slot.corePivot.clear();
        const crys = prepareClone(crystalSrc, 'fg');
        crys.scale.setScalar(1.04);
        slot.corePivot.add(crys);
      }
    }

    // 4. Mount 12 pooled `BoostRing_Bronze` carved Pelagian bronze & crystal speed-gate rings
    if (boostSrc) {
      for (let i = 0; i < ctx.ringPool.length; i++) {
        const slot = ctx.ringPool[i];
        slot.clear();
        const br = prepareClone(boostSrc, 'fg');
        br.rotation.x = Math.PI * 0.5;
        br.scale.setScalar(0.54);
        slot.add(br);
      }
    }

    // 5. Mount `Shaft_BottomSanctuary` submerged bronze dome & glowing bedrock hydro-pool
    if (sanctuarySrc) {
      ctx.sanctuaryMount.clear();
      const sanc = prepareClone(sanctuarySrc, 'sanctuary');
      sanc.rotation.x = Math.PI * 0.5;
      sanc.scale.setScalar(SHAFT_SCALE);
      ctx.sanctuaryMount.add(sanc);
    }

    ctx.glbMounted = true;
  }

  renderCoreDescentScene(state) {
    const cd = state?.coreDescent || state?.descent;
    const hero = state?.gateway || state?.player;
    const nextSkin = hero?.skinId || state?.skinId;
    if (nextSkin && nextSkin !== this.skinId) this.setSkin(nextSkin);
    const ctx = this._ensureCoreDescentScene();
    if (!ctx) return;

    if (!ctx.glbMounted && this.glbModels?.env_core_reactor) {
      this._mountCoreReactorGlb(ctx, this.glbModels.env_core_reactor);
    }

    const time = state?.time ?? cd?.timer ?? 0;
    const dt = Math.min(0.05, Math.max(0.001, time - (ctx.lastTime || 0) || 0.016));
    ctx.lastTime = time;
    this._lastTime = time;

    const progress = clamp(Number(cd?.progress) || 0, 0, 1);
    const depth = Number(cd?.depth) || 0;
    const totalDepth = Math.max(100, Number(cd?.totalDepth) || 360);
    const isBoost = (cd?.boostTimer || 0) > 0.02;
    const isSpin = (cd?.spinTimer || 0) > 0.02 || (cd?.whipTimer || 0) > 0.02;

    // Dynamic FOV rush (58° cruising -> 68° boost / corkscrew drill-spin!)
    const aspect = Math.max(0.38, this.width / Math.max(1, this.height));
    const targetFov = 58 + (isBoost ? 7.0 : 0) + (isSpin ? 4.2 : 0) + progress * 2.4;
    ctx.smoothFov += (targetFov - ctx.smoothFov) * Math.min(1, dt * 8.0);
    if (Math.abs(ctx.camera.fov - ctx.smoothFov) > 0.04 || Math.abs(ctx.camera.aspect - aspect) > 0.002) {
      ctx.camera.fov = ctx.smoothFov;
      ctx.camera.aspect = aspect;
      ctx.camera.updateProjectionMatrix();
    }

    // Deep atmospheric exponential depth fog morph (`#062634` -> sunlit turquoise bedrock highlight)
    if (progress < 0.45) {
      ctx.tmpCol.copy(ctx.zoneFogA).lerp(ctx.zoneFogB, progress / 0.45);
    } else {
      ctx.tmpCol.copy(ctx.zoneFogB).lerp(ctx.zoneFogC, clamp((progress - 0.45) / 0.55, 0, 1));
    }
    ctx.scene.background.copy(ctx.tmpCol);
    ctx.scene.fog.color.copy(ctx.tmpCol);
    ctx.scene.fog.density = 0.0315 - progress * 0.0065;

    const env = this._getBiomeEnvMap('coral_sea') || this._getBiomeEnvMap(this.biome);
    if (env && ctx.scene.environment !== env) ctx.scene.environment = env;

    // Zone 1 sunlit intake rays fade smoothly as Gateway dives past 48% depth
    const intakeAlpha = clamp(1 - progress / 0.48, 0, 1);
    ctx.intakeBeams.visible = intakeAlpha > 0.02;
    ctx.beamMat.opacity = intakeAlpha * 0.30;
    ctx.intakeBeams.rotation.z = time * 0.18;
    ctx.sunIntake.intensity = 2.15 + intakeAlpha * 0.75;

    // Gentle breathing pulse on lower-key shaft wall aqua conduits
    if (ctx.wallConduitMats?.length) {
      const cPulse = 0.42 + Math.sin(time * 4.2) * 0.08 + (isBoost ? 0.20 : 0);
      for (let m = 0; m < ctx.wallConduitMats.length; m++) {
        ctx.wallConduitMats[m].emissiveIntensity = cPulse;
      }
    }

    // Scroll 10 seamless Blender `ShaftRing_Main` segments continuously at exact dive speed (`depth * 0.72`)
    const tileLen = ctx.shaftTileLen || 7.44;
    const scrollZ = ((depth * 0.72) % tileLen + tileLen) % tileLen;
    for (let i = 0; i < ctx.shaftRingSlots.length; i++) {
      const slot = ctx.shaftRingSlots[i];
      slot.position.z = tileLen + scrollZ - i * tileLen;
    }

    // Scroll subtle volumetric cascading water-curtain ribbons down the stone walls
    ctx.curtainMat.opacity = isBoost ? 0.28 : 0.20;
    for (let c = 0; c < ctx.waterCurtains.length; c++) {
      const wc = ctx.waterCurtains[c];
      const wz = 8 - (((wc.offset - depth * 0.92 - time * 5.0) % 56) + 56) % 56;
      wc.mesh.position.z = wz;
    }

    // Heroic Golden-Aqua Rim-Lit Gateway 2.0 Skydiving Head-First Down the Reactor Shaft!
    const tubeScale = 2.75;
    const gx = (cd?.x || 0) * tubeScale;
    const gy = -(cd?.y || 0) * tubeScale;
    const isV2 = typeof ctx.gatewayRig?.setTargetHeight === 'function';
    ctx.gatewayRig.group.scale.setScalar(isV2 ? 1.12 : 1.10);
    ctx.heroMount.position.set(gx, gy, -0.45);
    const spinRoll = isSpin ? time * 24 : 0;
    const bankZ = clamp(-(cd?.vx || 0) * 0.36, -0.65, 0.65) + spinRoll;
    const pitchX = 0.14 + clamp((cd?.vy || 0) * 0.18, -0.28, 0.28);
    ctx.heroMount.rotation.set(pitchX, 0, bankZ);

    ctx.gatewayRig.update(dt, {
      time,
      vx: cd?.vx || 0,
      vy: cd?.vy || 0,
      facing: 1,
      onGround: false,
      coreDive: true,
      tailWhipTimer: cd?.spinTimer || cd?.whipTimer || 0,
      frillFlare: isBoost ? 0.45 : 0.24,
      mood: isSpin ? 'determined' : isBoost ? 'joyful' : 'determined',
      anim: 'CoreDive',
      invuln: cd?.invuln || 0,
    });

    // Aqua Corkscrew Hydro-Drill Vortex Cone during spin-attack / boost!
    ctx.drillCone.visible = isSpin || isBoost;
    ctx.drillMat.opacity = isSpin ? 0.68 : isBoost ? 0.28 : 0;
    ctx.drillCone.rotation.y = time * 16;
    ctx.heroKey.position.set(gx * 0.68 + 0.45, gy * 0.68 + 1.35, 1.9);
    ctx.heroKey.intensity = isSpin ? 4.4 : 3.4;

    // Camera glides behind diving Gateway with crisp perspective down the vaulted shaft
    const shake = writeShakeOffset(state?.shake, time, this._shakeVec);
    ctx.camera.position.set(gx * 0.36 + shake.x * 0.42, gy * 0.36 + 0.42 + shake.y * 0.42, 5.4);
    ctx.camera.lookAt(gx * 0.68, gy * 0.68, -20);

    const depthToZ = (targetDepth) => -0.45 - (targetDepth - depth) * 0.72;

    // Sync Spinning Riveted-Bronze `Turbine_Blades` (cull cleanly behind Gateway at z > 0.35 so hub NEVER blocks camera!)
    const turbines = cd?.turbines || [];
    for (let i = 0; i < ctx.turbinePool.length; i++) {
      const tg = ctx.turbinePool[i];
      if (i >= turbines.length) {
        tg.visible = false;
        continue;
      }
      const tb = turbines[i];
      const tz = depthToZ(tb.depth);
      if (tz > 0.35 || tz < -54) {
        tg.visible = false;
        continue;
      }
      tg.visible = true;
      tg.position.set(0, 0, tz);
      tg.rotation.z = -(tb.rotAngle || 0);
    }

    // Sync Ornate Astrolabe-Caged `PowerCore_Crystal` Locks + Shatter Shards & Shockwaves!
    const crystals = cd?.crystalLocks || [];
    let shockIdx = 0;
    for (let i = 0; i < ctx.crystalPool.length; i++) {
      const slot = ctx.crystalPool[i];
      if (i >= crystals.length) {
        slot.group.visible = false;
        continue;
      }
      const cl = crystals[i];
      const cz = depthToZ(cl.depth);
      if (cl.shattered) {
        slot.group.visible = false;
        if ((cl.shatterTimer || 0) > 0.01 && shockIdx < ctx.shockwavePool.length) {
          const pool = ctx.shockwavePool[shockIdx++];
          const sProg = clamp(1 - cl.shatterTimer / 0.5, 0, 1);
          const sx = (cl.x || 0) * tubeScale;
          const sy = -(cl.y || 0) * tubeScale;
          pool.sw.visible = true;
          pool.sw.position.set(sx, sy, Math.max(-24, cz));
          const swScale = 0.8 + sProg * 5.2;
          pool.sw.scale.set(swScale, swScale, 1);
          pool.swMat.opacity = (1 - sProg) * 0.90;
          for (let k = 0; k < pool.shards.length; k++) {
            const sh = pool.shards[k];
            sh.mesh.visible = true;
            sh.mesh.position.set(sx + sh.vx * sProg, sy + sh.vy * sProg, Math.max(-24, cz) + sh.vz * sProg);
            sh.mesh.rotation.set(time * 9 + k, time * 11, k);
            sh.mesh.material.opacity = 1 - sProg;
          }
        }
        continue;
      }
      if (cz > 0.65 || cz < -54) {
        slot.group.visible = false;
        continue;
      }
      slot.group.visible = true;
      slot.group.position.set((cl.x || 0) * tubeScale, -(cl.y || 0) * tubeScale, cz);
      slot.corePivot.rotation.set(time * 1.45 + i, time * 2.05, Math.sin(time * 1.8 + i) * 0.4);
      const pulse = 1.0 + Math.sin(time * 6.5 + i) * 0.07;
      slot.group.scale.setScalar(pulse);
    }
    for (let s = shockIdx; s < ctx.shockwavePool.length; s++) {
      ctx.shockwavePool[s].sw.visible = false;
      for (let k = 0; k < ctx.shockwavePool[s].shards.length; k++) {
        ctx.shockwavePool[s].shards[k].mesh.visible = false;
      }
    }

    // Sync Carved `BoostRing_Bronze` Pelagian Speed-Gate Rings
    const rings = cd?.rings || [];
    for (let i = 0; i < ctx.ringPool.length; i++) {
      const rm = ctx.ringPool[i];
      if (i >= rings.length || rings[i].collected) {
        rm.visible = false;
        continue;
      }
      const rg = rings[i];
      const rz = depthToZ(rg.depth);
      if (rz > 0.65 || rz < -54) {
        rm.visible = false;
        continue;
      }
      rm.visible = true;
      rm.position.set((rg.x || 0) * tubeScale, -(rg.y || 0) * tubeScale, rz);
      rm.rotation.z = time * 1.35 + i * 0.7;
    }

    // Sync Downward Hydro-Pulses
    const pulses = cd?.pulses || [];
    for (let i = 0; i < ctx.pulsePool.length; i++) {
      const pm = ctx.pulsePool[i];
      if (i >= pulses.length) {
        pm.visible = false;
        continue;
      }
      const pl = pulses[i];
      const pz = depthToZ(pl.depth);
      if (pz > 0.65 || pz < -54) {
        pm.visible = false;
        continue;
      }
      pm.visible = true;
      pm.position.set((pl.x || 0) * tubeScale, -(pl.y || 0) * tubeScale, pz);
    }

    // Distant Glowing `Shaft_BottomSanctuary` Submerged Bronze Dome & Bedrock Hydro-Pool
    const sancZ = Math.max(-58, depthToZ(totalDepth));
    ctx.sanctuaryGroup.visible = true;
    ctx.sanctuaryGroup.position.set(0, 0, sancZ);
    ctx.sanctuaryMount.rotation.z = time * 0.16;
    const pWave = Number(cd?.purificationWave) || 0;
    if (pWave > 0.005) {
      ctx.purifySphere.visible = true;
      ctx.purifySphere.scale.setScalar(1.8 + pWave * 22.0);
      ctx.purifySphereMat.opacity = clamp((1 - pWave * 0.6) * 0.85, 0, 0.85);
    } else {
      ctx.purifySphere.visible = false;
    }

    // Instanced Slipstream Mist Streaks streaming past Gateway (1 draw call!)
    ctx.streakMat.opacity = isSpin ? 0.48 : isBoost ? 0.36 : 0.18;
    const sd = ctx.streakDummy;
    const streakZScale = isBoost || isSpin ? 1.55 : 1.0;
    for (let st = 0; st < ctx.streakMeta.length; st++) {
      const s = ctx.streakMeta[st];
      const zPos = 6 - (((s.offset - depth * (isBoost ? 1.4 : 1.0)) % 38) + 38) % 38;
      sd.position.set(Math.cos(s.ang) * s.rad, Math.sin(s.ang) * s.rad, zPos);
      sd.rotation.set(0, 0, s.ang);
      sd.scale.set(1, 1, streakZScale);
      sd.updateMatrix();
      ctx.streakInst.setMatrixAt(st, sd.matrix);
    }
    ctx.streakInst.instanceMatrix.needsUpdate = true;

    // Render with zero shadow-pass overhead for locked 55–60 fps D3D11!
    const prevShadow = this.webgl.shadowMap.enabled;
    this.webgl.shadowMap.enabled = false;
    try {
      this._renderWithComposer(ctx.scene, ctx.camera, {
        biome: 'storm_ocean',
        purification: Math.max(this.purificationProgress, pWave),
        bloomThreshold: 0.78,
        bloomStrength: isSpin ? 0.42 : 0.30,
        flash: pWave * 0.75,
        exposure: 1.12,
      });
    } finally {
      this.webgl.shadowMap.enabled = prevShadow;
    }
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
    const dt = Math.min(0.05, Math.max(0.001, time - this._lastTime || 0.016));
    this._lastTime = time;
    const biomeKey = resolvePostFxBiome(state.tower?.theme || this.biome || 'coral_sea');
    const envMap = this._getBiomeEnvMap(biomeKey);
    if (sr.scene && envMap && !sr.scene.environment) sr.scene.environment = envMap;
    this.postfxActive = Boolean(this.usePostFX && this.postfx?.enabled);
    sr.render(state, {
      time,
      dt,
      particles: state.particles,
      popups: state.popups,
      shake: state.shake,
      skinId: this.skinId,
      blasterFxId: this.blasterFxId,
      postfx: this.usePostFX ? this.postfx : null,
      envMap,
      biomeKey,
      biomeId: biomeKey,
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
    const time = state.time || 0;
    const dt = Math.min(0.05, Math.max(0.001, time - this._lastTime || 0.016));
    this._lastTime = time;
    const biomeKey = resolvePostFxBiome(state.tower?.theme || this.biome || 'canyon_river');
    const envMap = this._getBiomeEnvMap(biomeKey);
    if (sr.scene && envMap && !sr.scene.environment) sr.scene.environment = envMap;
    this.postfxActive = Boolean(this.usePostFX && this.postfx?.enabled);
    sr.render(state, {
      time,
      dt,
      particles: state.particles,
      popups: state.popups,
      shake: state.shake,
      postfx: this.usePostFX ? this.postfx : null,
      envMap,
      biomeKey,
      biomeId: biomeKey,
    });
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
    const biomeKey = resolvePostFxBiome(state.tower?.theme || this.biome || 'alpine_lake');
    const envMap = this._getBiomeEnvMap(biomeKey);
    if (gr.scene && envMap && !gr.scene.environment) gr.scene.environment = envMap;
    this.postfxActive = Boolean(this.usePostFX && this.postfx?.enabled);

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
        postfx: this.usePostFX ? this.postfx : null,
        envMap,
        biomeKey,
        biomeId: biomeKey,
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
    const biomeKey = resolvePostFxBiome(state.tower?.theme || this.biome || 'canyon_river');
    const envMap = this._getBiomeEnvMap(biomeKey);
    if (pr.scene && envMap && !pr.scene.environment) pr.scene.environment = envMap;
    this.postfxActive = Boolean(this.usePostFX && this.postfx?.enabled);

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
        postfx: this.usePostFX ? this.postfx : null,
        envMap,
        biomeKey,
        biomeId: biomeKey,
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
    const hero = state.gateway || state.player;
    const nextSkin = hero?.skinId || state.skinId;
    if (nextSkin && nextSkin !== this.skinId) this.setSkin(nextSkin);
    const vr = this._ensureVaultRenderer();
    if (!vr) return;
    const time = state.time || 0;
    const dt = Math.min(0.05, Math.max(0.001, time - this._lastTime || 0.016));
    this._lastTime = time;
    const biomeKey = resolvePostFxBiome(state.tower?.theme || this.biome || 'canyon_river');
    const envMap = this._getBiomeEnvMap(biomeKey);
    if (vr.scene && envMap && !vr.scene.environment) vr.scene.environment = envMap;
    this.postfxActive = Boolean(this.usePostFX && this.postfx?.enabled);
    vr.render(state, {
      time,
      dt,
      skinId: this.skinId,
      postfx: this.usePostFX ? this.postfx : null,
      envMap,
      biomeKey,
      biomeId: biomeKey,
    });
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
    this.enemyTellSparkGeo?.dispose();
    this.enemyTellSparkMat?.dispose();
    this.enemyTellSteamGeo?.dispose();
    this.enemyTellSteamMat?.dispose();
    this.shieldBubble?.geometry?.dispose();
    this.shieldBubble?.material?.dispose();
    this._disposeCollectibleMesh(this.grappleBeam, true);
    this._disposeCollectibleMesh(this.turntableHalo, true);
    this._disposeCollectibleMesh(this.muzzleFlashGroup, true);
    this._disposeCollectibleMesh(this.tailWhipVfxGroup, true);
    this._disposeCollectibleMesh(this.purificationEruptionGroup, true);
    this._disposeCollectibleMesh(this.landingRingGroup, true);
    this._disposeCollectibleMesh(this.tunnelVortexGroup, true);
    this._disposeCollectibleMesh(this.titlePedestalGroup, true);
    this._disposeCollectibleMesh(this.overchargeAuraGroup, true);
    this._disposeCollectibleMesh(this.floodgateSurgeGroup, true);
    if (this.hydroRingPool) {
      for (let i = 0; i < this.hydroRingPool.length; i++) {
        this._disposeCollectibleMesh(this.hydroRingPool[i], true);
      }
      this.hydroRingPool.length = 0;
    }
    if (this._coreDescentCtx) {
      this._coreDescentCtx.gatewayRig?.dispose?.();
      this._coreDescentCtx = null;
    }

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
    this.sharedBurstMat?.dispose();
    this.sharedWaterDropMat?.dispose();
    this.glowDotTex?.dispose();
    this.relicTabletTex?.dispose();
    this.turntableHaloTex?.dispose();
    this.hydroSlashTex?.dispose();
    this.hydroWakeTex?.dispose();
    this.hydroBurstTex?.dispose();
    this.braidedTetherTex?.dispose();
    this.tunnelDepthTex?.dispose();
    this.tunnelSpiralTex?.dispose();
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
