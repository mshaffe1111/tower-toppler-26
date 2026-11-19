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

    // Adaptive Dynamic Resolution Scaling for locked 60fps across integrated GPUs & mobile
    this._isIntegratedGpu = false;
    this.maxDpr = Math.min((typeof window !== 'undefined' && window.devicePixelRatio) || 1, 1.25);
    this.currentDpr = this.maxDpr;
    this.usePostFX = false; // Single-pass direct hardware ACESFilmic rendering by default!
    this._frameEmaMs = 12.0;
    this._slowFrameCount = 0;
    this._lastPerfNow = 0;
    this._shadowTick = 0;

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
    this.webgl.shadowMap.type = THREE.PCFShadowMap;
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

  _getBiomeEnvMap(_biomeKey) {
    if (this._sharedEnvTex) return this._sharedEnvTex;
    this._sharedEnvTex = buildBiomePmremTexture(this.webgl, BIOME_LIGHT_RIGS.canyon_river);
    return this._sharedEnvTex;
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
    if (Array.isArray(skyTexList)) {
      for (let i = 0; i < skyTexList.length; i++) {
        const t = skyTexList[i];
        if (t && !t.userData?._gpuUploaded && (t.image || t.source?.data)) {
          t.userData = t.userData || {};
          t.userData._gpuUploaded = true;
          try {
            this.webgl.initTexture(t);
          } catch {}
        }
      }
    }
    this._lastUploadedWebpVer = getBakedArchWebpVersion();
  }

  prewarmTowerGroup(tower, compileScene = false) {
    if (!tower) return null;
    const cached = this._getOrBuildTowerGroup(tower);
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
    const added = [];
    try {
      for (let i = 0; i < groups.length; i++) {
        const g = groups[i];
        if (g && g.parent !== this.towerScene) {
          this.towerScene.add(g);
          added.push(g);
        }
      }
      this._compileAllTowerShaders();
    } finally {
      for (let i = 0; i < added.length; i++) {
        if (added[i].parent === this.towerScene) {
          this.towerScene.remove(added[i]);
        }
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
      this.usePostFX && this.postfx && this.postfx.composer?.readBuffer
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
            aoMap: m.aoMap || null,
            aoMapIntensity: m.aoMapIntensity ?? 1.0,
            emissive: m.emissive ? m.emissive.clone() : new THREE.Color('#000000'),
            emissiveMap: m.emissiveMap || null,
            emissiveIntensity: Math.min(1.85, m.emissiveIntensity ?? 1.0),
            roughness: typeof m.roughness === 'number' ? m.roughness : 0.4,
            metalness: typeof m.metalness === 'number' ? m.metalness : 0.2,
            transparent: Boolean(m.transparent),
            opacity: typeof m.opacity === 'number' ? m.opacity : 1.0,
            side: m.side,
          });
          m.dispose();
        } else if (typeof out.emissiveIntensity === 'number' && out.emissiveIntensity > 1.85) {
          out.emissiveIntensity = 1.85;
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
  }

  _initPostProcessing() {
    this.postfx = null;
    if (!this.usePostFX) return;
    try {
      this.postfx = new CinematicPostFX(this.webgl, this.width, this.height, this.currentDpr, { enabled: true });
      this.postfx.setBiome(this.biome, this.purificationProgress);
    } catch {
      this.postfx = null;
    }
  }

  _renderWithComposer(scene, camera, opts) {
    if (this.usePostFX && this.postfx && !this.postfx.isBypassed) {
      try {
        this.postfx.render(scene, camera, opts);
        return;
      } catch {
        this.postfx = null;
      }
    }
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
    // scale smoothly to 0.78 DPR at >= 1.2M px (~1498x842 w/ MSAA) while keeping portrait 412x915 at 1.0!
    const dprCap = this._isIntegratedGpu ? (pxArea >= 1200000 ? 0.78 : 1.0) : 1.25;
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

    // 5-Biome Daylight / Alpenglow / Twilight / Lagoon / Aurora Rig + Smart 1024x1024 PCFShadowMap (tight 8m x 8m hero frustum!)
    this.hemiLight = new THREE.HemisphereLight('#cbeafe', '#a85238', 0.96);
    this.towerScene.add(this.hemiLight);

    this.keyLight = new THREE.DirectionalLight('#fff3d1', 2.52);
    this.keyLight.position.set(11.2, 14.5, 11.4);
    this.keyLight.castShadow = true;
    this.keyLight.shadow.mapSize.set(512, 512);
    this.keyLight.shadow.camera.near = 3.0;
    this.keyLight.shadow.camera.far = 24.0;
    this.keyLight.shadow.camera.left = -3.75;
    this.keyLight.shadow.camera.right = 3.75;
    this.keyLight.shadow.camera.top = 3.75;
    this.keyLight.shadow.camera.bottom = -3.75;
    this.keyLight.shadow.bias = -0.00055;
    this.keyLight.shadow.normalBias = 0.022;
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

    // Single-Pass Analytic Fresnel Living Water (`src/water.js` — 0 reflection render passes!)
    this.ocean = new Ocean(this.webgl, {
      towerRadius: TOWER_RADIUS,
      preset: 'canyon_river',
      size: 240,
      segments: 36,
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

    // Round 4: Pooled 7-Enemy Personality Visual Tells & Mortar Trailing Droplets (ZERO PointLights, <= 2 draw calls!)
    this._initEnemyTellVfxPools();
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
    const rawCount = Number(
      state.rescuedCritterCount ??
        state.critterCount ??
        state.prog?.getCritterCount?.() ??
        state.progression?.getCritterCount?.() ??
        0
    ) || 0;
    const purify = Number(state.purificationProgress ?? state.tower?.healing ?? 0) || 0;
    const activeCount =
      rawCount > 0 ? clamp(Math.ceil((rawCount / 30) * 12) + 1, 2, 12) : purify > 0.12 ? 2 : 0;

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

  _getOrBuildTowerGroup(tower) {
    const MAX_TOWER_CACHE = 16;
    const rbTheme = resolveArchTheme(tower);
    const propVer = this._archPropsVersion;
    const clue = tower.clue;
    const clueSig = clue
      ? `${clue.kind}_${clue.col}_${clue.floor}_${clue.n || ''}_${(clue.pattern || clue.order || []).join('')}`
      : 'noclue';
    const basePrefix = `v3_${rbTheme}_`;
    const towerIdentity = `${tower.cacheKey || tower.key || tower.id}_${tower.floors || 0}_${tower.ledges?.length || 0}`;
    const towerSuffix = `_${towerIdentity}_${clueSig}`;
    const cacheKey = `${basePrefix}p${propVer}${towerSuffix}`;
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
      ? pBaseCol + Math.sin(time * 0.30) * (0.42 - landBlend * 0.12)
      : camCol;

    // CLOSE-UP ACTION CAMERA (`TOWER_RADIUS = 3.75`, hero stands at `z = 4.21m`):
    //   - Desktop / Landscape (`aspect >= 1.0`): `fov = 45°`, `camZ = 9.85m` (~5.64m from Gateway)
    //   - Portrait Phone (`aspect < 1.0`):       `fov = 48°`, `camZ = 11.5m` (~7.29m from Gateway)
    const isPortrait = aspect < 1.0;
    const gameplayFov = isPortrait ? 48 : 45;
    const wantFov = isWardrobe || isBestiary ? 44 : isCutscene ? (isPortrait ? 48 : 45) : gameplayFov;
    if (this.towerCam.fov !== wantFov) {
      this.towerCam.fov = wantFov;
      this.towerCam.updateProjectionMatrix();
    }

    let camZ = isPortrait ? 11.5 : 9.85;

    // Anchor gameplay camera vertically directly to Gateway's floor (`hero.floor * fh`) so her soles
    // always sit cleanly at ~72-75% of viewport height (ZERO bottom clipping on 1080p OR 412x915 portrait!)
    const rawHeroY = hero ? hero.floor * fh : camFloor * fh;
    if (this._smoothHeroY === undefined || Math.abs(rawHeroY - this._smoothHeroY) > 4.2) {
      this._smoothHeroY = rawHeroY;
    } else {
      this._smoothHeroY += (rawHeroY - this._smoothHeroY) * Math.min(1, dt * 11.0);
    }
    const lookYPlay = this._smoothHeroY + (isPortrait ? 1.24 : 0.93);
    let camY = this._smoothHeroY + (isPortrait ? 1.40 : 1.09);
    const shake = writeShakeOffset(state.shake, time, this._shakeVec);

    if (isBestiary) {
      // Interactive 3D Bestiary Turntable Camera (extra zoom-out headroom for wide enemies on 412x915 Portrait & towering boss!)
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
      // On Portrait (`aspect < 1`), pull camera back & lower lookAt so 100% of Gateway head-to-toe +
      // turntable halo sits cleanly in upper-center `16%–64%` Y (completely clear above bottom UI cards!)
      const portDist = isPortrait ? 3.92 : 2.85 + wardLand * 0.50;
      const wardLookY = pFloorY + (isPortrait ? 0.22 : 0.62);
      const wardY = pFloorY + (isPortrait ? 0.58 : 0.78 + wardLand * 0.08);
      const wardZ = TOWER_RADIUS + LEDGE_STAND_OFFSET + portDist / wZoom;
      this.towerCam.position.set(0, wardY, wardZ);
      this.towerCam.lookAt(0, wardLookY, TOWER_RADIUS + LEDGE_STAND_OFFSET);
    } else if (isTitleShowcase) {
      // Close-Up Heroic Title Screen Camera (`~9.6m` desktop / `~11.0m` portrait) framing Gateway squarely in center!
      const pFloorY = (hero?.floor || 0) * fh;
      const showcaseZ = isPortrait ? 11.0 : 9.6;
      const showcaseX = Math.sin(time * 0.30) * 0.34;
      camY = pFloorY + (isPortrait ? 1.24 : 0.96) + Math.sin(time * 0.55) * 0.04;
      const lookY = pFloorY + (isPortrait ? 1.08 : 0.84);
      camZ = showcaseZ;
      this.towerCam.position.set(showcaseX, camY, showcaseZ);
      this.towerCam.lookAt(0, lookY, TOWER_RADIUS + LEDGE_STAND_OFFSET);
    } else if (isCutscene) {
      const pFloorY = (hero?.floor || 0) * fh;
      const towerTopY = Math.max(18, tower.floors * fh);
      const heroCloseZ = isPortrait ? 10.6 : 9.0;
      const breatheY = Math.sin(time * 0.85) * 0.06;

      if (csKind.includes('purif') || csKind === 'epilogue') {
        const pull = csKind.includes('purif') ? Math.max(0.25, csEase) : Math.max(0, (csEase - 0.35) / 0.65);
        const cz = lerp(heroCloseZ, camZ * 1.18, pull);
        const cx = Math.sin(time * 0.62) * (1.6 * pull + 0.4);
        camY = lerp(pFloorY + 1.0, towerTopY * 0.48, pull) + breatheY;
        this.towerCam.position.set(cx, camY, cz);
        this.towerCam.lookAt(0, lerp(pFloorY + 0.72, towerTopY * 0.36, pull), 0);
      } else {
        const startY = Math.min(towerTopY * 0.55, pFloorY + 6.5);
        camY = lerp(startY, pFloorY + 0.92, csEase) + breatheY;
        const cz = lerp(camZ * 1.08, heroCloseZ, csEase);
        const lookY = lerp(startY - 1.2, pFloorY + 0.68, csEase);
        this.towerCam.position.set(Math.sin(time * 0.45) * 0.65 * (1 - csEase), camY, cz);
        this.towerCam.lookAt(0, lookY, (TOWER_RADIUS + LEDGE_STAND_OFFSET) * csEase);
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
      const focusFloor = hero?.floor != null ? hero.floor : camFloor;
      if (Math.cos(ct) < 0.16 || Math.abs(colItem.floor - focusFloor) > 2.6) {
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
      // Plant Gateway's soles 0.00m FLUSH on stone treads & elevator decks (accounts for bevel top & IdleBreathe foot bone offset!)
      const footFlushBias = hero.onGround ? -0.044 : 0;
      const py = hero.floor * fh + footFlushBias + (topple.active ? tg.position.y : 0);

      const inTunnel = Boolean(hero.hidden && hero.tunnelTimer > 0 && !topple.active);
      this.tunnelVortexGroup.visible = inTunnel;
      if (inTunnel) {
        // Tuck subtly recessed against spire stonework (NOT floating out in mid-air!)
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
      this.shieldBubble.visible = Boolean(heroVisible && hero.shield);

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
        // 1.28x Hero Visual Stature (`1.185 * 1.28 = 1.517u`, cleanly clearing `1.66u` elevator hoist yokes!)
        const heroScale = isWardrobe ? 1.12 : 1.28;
        this.gatewayRig.group.scale.setScalar(heroScale);
        this.gatewayRig.group.position.set(px, py, pz);

        // Interactive 360° Sanctuary Turntable Orbit (`state.wardrobeOrbitYaw` / `setWardrobePreview`)
        const reqWardYaw = state.wardrobeOrbitYaw ?? this.wardrobePreview.yaw;
        if (isWardrobe) {
          const targetYaw = reqWardYaw != null ? Number(reqWardYaw) : Math.sin(time * 0.85) * 0.55;
          this._wardrobeYawSmooth += (targetYaw - this._wardrobeYawSmooth) * Math.min(1, dt * 14);
          this.gatewayRig.group.rotation.y = pTheta + this._wardrobeYawSmooth;
        } else {
          this.gatewayRig.group.rotation.y = pTheta + (isTitleShowcase ? Math.sin(time * 0.65) * 0.22 : 0);
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
          victory: 'Celebrate',
          hydrocast: 'HydroCast',
          cast: 'HydroCast',
          stairclimb: 'StairClimb',
          wallscamper: 'WallScamper',
        };
        const finalAnim = resolvedAnim ? (animClipMap[resolvedAnim] || rawWardAnim || hero.anim || null) : null;

        this.gatewayRig.update(dt, {
          time,
          vx: isWardrobe && finalAnim === 'FluidRun' ? 3.2 : hero.vx || 0,
          vy: hero.vy || 0,
          facing: hero.facing || 1,
          onGround: isWardrobe && (finalAnim === 'FrillGlide' || finalAnim === 'FreeSwim' || finalAnim === 'CoreDive') ? false : Boolean(hero.onGround),
          onElevator: hero.onElevator,
          onStairs: Boolean(hero.onStairs),
          stairSlope: hero.stairSlope ?? hero.stairDir ?? 0,
          wallScamper: Boolean(hero.wallScamper || hero.climbing || finalAnim === 'WallScamper'),
          isSwimming: Boolean(hero.isSwimming || finalAnim === 'FreeSwim'),
          coreDive: Boolean(finalAnim === 'CoreDive'),
          tailWhipTimer: isWardrobe && finalAnim === 'TailWhip' ? 0.3 : whipT,
          frillFlare: isWardrobe && finalAnim === 'FrillGlide' ? 1.0 : hero.frillFlare || 0,
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
        this._enemyExtraOpts.heroFloor = hero?.floor != null ? hero.floor : camFloor;
        this._enemyExtraOpts.camFloor = this._enemyExtraOpts.heroFloor;
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
      hero?.floor != null ? hero.floor : camFloor,
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

    // Wave 4: Joyful Rescued Sea Turtles & River Otters swimming & leaping in the Title Sanctuary Lagoon!
    this._updateWildlifeLagoon(
      state,
      time,
      waterY,
      Boolean(isTitleShowcase && !isWardrobe && !isBestiary && !topple.active)
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
    // and incrementally re-warm once when async Arch or Enemy GLBs finish loading -> ZERO mid-climb freezes!
    if (this._lastUploadedWebpVer !== getBakedArchWebpVersion() || isTitleShowcase) {
      this._uploadAllReadyTextures();
    }
    const enemiesNowReady = Boolean(this.enemyVisuals?.isReady?.());
    if (
      !this._towerSceneCompiled ||
      (!this._enemiesGlbCompiled && enemiesNowReady) ||
      this._compiledArchVersion !== this._archPropsVersion
    ) {
      this._compileAllTowerShaders();
      this._towerSceneCompiled = true;
      this._enemiesGlbCompiled = enemiesNowReady;
      this._compiledArchVersion = this._archPropsVersion;
    }

    // Single-pass analytic water reflection runs inside `src/water.js` (0 extra scene render passes!)
    // Update tight 512x512 hero shadow frustum on alternating frames (30Hz shadows = 2x faster GPU, visually identical!)
    if (((this._shadowTick++ & 1) === 0) || this._shadowTick <= 4) {
      this.webgl.shadowMap.needsUpdate = true;
    }
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
