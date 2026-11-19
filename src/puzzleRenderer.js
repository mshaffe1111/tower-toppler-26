// TOWERING WATERS: GATEWAY'S DESCENT — ANCIENT AQUEDUCT SANCTUM 3D RENDERER (`src/puzzleRenderer.js`)
//
// AAA Sunlit Temple Water-Vault & 6-Archetype Aqueduct Logic Chamber Engine:
//   - Weathered travertine ashlar sanctuary wall (`mg_pbr_sanctum_masonry_albedo/normal.webp`),
//     fluted PBR travertine columns (`arch_coral_travertine_albedo/normal.webp`), ornate recessed
//     bronze-framed temple portal with dark relief stone doors & glowing etched aqua seal runes,
//     cascading foam-streak waterfalls, and sculpted antique-bronze tripod braziers holding soft
//     layered additive teardrop flames (ZERO yellow cones, ZERO white snowballs, ZERO flat hexes!).
//   - Bespoke sculpted 3D PBR quality for ALL 6 solvable sanctum archetypes (`lights`, `bells`,
//     `beam`, `blocks`, `pipes`, `tide_locks`) using local PBR albedo+normal textures and instancing
//     to stay <= 60 draw calls and 0 shader-compile spikes > 28ms (`prewarm()` intact!).
//   - Unified main-game golden sun + cool azure hemisphere + soft exponential atmospheric fog,
//     exact 1:1 `room.view` alignment & aspect-safe Monument Valley framing on 412x915 & 1920x1080.

import * as THREE from 'three';
import * as BufferGeometryUtils from 'three/addons/utils/BufferGeometryUtils.js';
import { GatewayRig } from './gateway.js';
import { BELL_COLORS } from './puzzleRoom.js';

const TAU = Math.PI * 2;
const INTRO_T = 1.05;
const BEAM_Y = 0.78;
const WATER_Y = -0.28;

const MAX_TILES = 64;
const MAX_BELLS = 6;
const MAX_MIRRORS = 14;
const MAX_BLOCKS = 12;
const MAX_PLATES = 12;
const MAX_BEAM_SEGS = 32;
const MAX_VALVE_SCONCES = 6;
const MAX_PIPES = 25;
const MAX_TIDE_LOCKS = 6;
const MAX_MOTES = 96;

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const smooth01 = (t) => {
  const x = clamp(t, 0, 1);
  return x * x * (3 - 2 * x);
};

const SKIN_PALETTES = {
  sea_glass_guardian: { scale: '#2dd4bf', belly: '#ccfbf1', frill: '#38bdf8', glow: '#5efce8' },
  coral_reef_empress: { scale: '#fb7185', belly: '#ffe4e6', frill: '#2dd4bf', glow: '#f472b6' },
  canyon_rapids_ranger: { scale: '#0d9488', belly: '#fef3c7', frill: '#f59e0b', glow: '#38bdf8' },
  alpine_glacier_mystic: { scale: '#38bdf8', belly: '#f0f9ff', frill: '#a5f3fc', glow: '#7dd3fc' },
  bayou_biolume: { scale: '#10b981', belly: '#d1fae5', frill: '#eab308', glow: '#34d399' },
  abyssal_leviathan: { scale: '#1d4ed8', belly: '#93c5fd', frill: '#c084fc', glow: '#67e8f9' },
  solar_oasis: { scale: '#f59e0b', belly: '#fef9c3', frill: '#22d3ee', glow: '#fde047' },
  sovereign_starlight: { scale: '#eab308', belly: '#fefce8', frill: '#a855f7', glow: '#5efce8' },
  default_amphibian: { scale: '#2dd4bf', belly: '#ccfbf1', frill: '#38bdf8', glow: '#5efce8' },
};

class AdaptiveSanctumHero {
  constructor(skinId = 'sea_glass_guardian') {
    this.skinId = skinId;
    this.group = new THREE.Group();
    this.liveRig = new GatewayRig(skinId);
    this.fallback = this._buildFallback(skinId);
    this.group.add(this.liveRig.group);
  }

  _buildFallback(skinId) {
    const pal = SKIN_PALETTES[skinId] || SKIN_PALETTES.sea_glass_guardian;
    const root = new THREE.Group();
    const matScale = new THREE.MeshStandardMaterial({ color: pal.scale, roughness: 0.32, metalness: 0.12 });
    const matBelly = new THREE.MeshStandardMaterial({ color: pal.belly, roughness: 0.45 });
    const matFrill = new THREE.MeshStandardMaterial({
      color: pal.frill,
      emissive: pal.glow,
      emissiveIntensity: 0.5,
      roughness: 0.2,
      side: THREE.DoubleSide,
    });

    const spine = new THREE.Group();
    spine.position.set(0, 0.56, 0);
    root.add(spine);

    const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.13, 0.30, 8, 14), matScale);
    spine.add(torso);

    const belly = new THREE.Mesh(new THREE.CapsuleGeometry(0.10, 0.26, 6, 10), matBelly);
    belly.position.set(0, -0.01, 0.045);
    spine.add(belly);

    const head = new THREE.Mesh(new THREE.SphereGeometry(0.13, 14, 12), matScale);
    head.scale.set(0.9, 0.85, 1.25);
    head.position.set(0, 0.31, 0.05);
    spine.add(head);

    for (const sx of [-1, 1]) {
      const frill = new THREE.Mesh(new THREE.ConeGeometry(0.085, 0.26, 5), matFrill);
      frill.position.set(sx * 0.10, 0.34, -0.04);
      frill.rotation.set(-0.9, 0, -sx * 0.55);
      spine.add(frill);

      const leg = new THREE.Mesh(new THREE.CapsuleGeometry(0.048, 0.28, 6, 10), matScale);
      leg.position.set(sx * 0.12, -0.34, 0);
      spine.add(leg);
      if (sx < 0) spine.userData.legL = leg;
      else spine.userData.legR = leg;
    }

    const tailSegs = [];
    let p = spine;
    for (let i = 0; i < 6; i++) {
      const piv = new THREE.Group();
      piv.position.set(0, i === 0 ? -0.14 : 0, i === 0 ? -0.08 : -0.15);
      const seg = new THREE.Mesh(
        new THREE.CapsuleGeometry(lerp(0.082, 0.016, i / 5), 0.12, 6, 10),
        i >= 4 ? matFrill : matScale
      );
      seg.rotation.x = Math.PI * 0.5;
      seg.position.z = -0.07;
      piv.add(seg);
      p.add(piv);
      p = piv;
      tailSegs.push(piv);
    }

    return { root, spine, tailSegs, mats: { matScale, matBelly, matFrill } };
  }

  setSkin(skinId) {
    this.skinId = skinId || 'sea_glass_guardian';
    this.liveRig?.setSkin?.(this.skinId);
    const pal = SKIN_PALETTES[this.skinId] || SKIN_PALETTES.sea_glass_guardian;
    this.fallback.mats.matScale.color.set(pal.scale);
    this.fallback.mats.matBelly.color.set(pal.belly);
    this.fallback.mats.matFrill.color.set(pal.frill);
    this.fallback.mats.matFrill.emissive.set(pal.glow);
  }

  update(dt, pose = {}) {
    if (this.liveRig?.update) {
      try {
        this.liveRig.update(dt, pose);
        return;
      } catch {
        // Fallback
      }
    }
    const t = pose.time || 0;
    const moving = Math.abs(pose.vx || 0) > 0.1;
    const stride = moving ? Math.sin(t * 14) * 0.38 : 0;
    if (this.fallback.spine.userData.legL) {
      this.fallback.spine.userData.legL.rotation.x = stride;
      this.fallback.spine.userData.legR.rotation.x = -stride;
    }
    for (let i = 0; i < this.fallback.tailSegs.length; i++) {
      this.fallback.tailSegs[i].rotation.y = Math.sin(t * 5.5 - i * 0.55) * 0.22;
    }
  }

  dispose() {
    this._disposed = true;
    this.liveRig?.dispose?.();
  }
}

// ------------------------------------------------------------------------------------ Procedural PBR & VFX Textures
function makeSolidAlbedoTex(r, g, b) {
  const data = new Uint8Array([r, g, b, 255, r, g, b, 255, r, g, b, 255, r, g, b, 255]);
  const tex = new THREE.DataTexture(data, 2, 2, THREE.RGBAFormat);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

function makeFlatNormalTex() {
  const data = new Uint8Array([128, 128, 255, 255, 128, 128, 255, 255, 128, 128, 255, 255, 128, 128, 255, 255]);
  const tex = new THREE.DataTexture(data, 2, 2, THREE.RGBAFormat);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.needsUpdate = true;
  return tex;
}

function createWaterRippleNormalTex(size = 256) {
  const data = new Uint8Array(size * size * 4);
  const hAt = (u, v) =>
    Math.sin((u * 3 + v * 2) * TAU) * 0.38 +
    Math.cos((u * 5 - v * 4) * TAU) * 0.28 +
    Math.sin((u * 2 + v * 7) * TAU) * 0.20 +
    Math.cos((u * 8 + v * 3) * TAU) * 0.14;
  const eps = 1 / size;
  const strength = 2.0;
  for (let y = 0; y < size; y++) {
    const v = y / size;
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const dx = (hAt(u + eps, v) - hAt(u - eps, v)) * strength;
      const dy = (hAt(u, v + eps) - hAt(u, v - eps)) * strength;
      const inv = 1 / Math.hypot(-dx, -dy, 1.0);
      const idx = (y * size + x) * 4;
      data[idx] = clamp(Math.round((-dx * inv * 0.5 + 0.5) * 255), 0, 255);
      data[idx + 1] = clamp(Math.round((-dy * inv * 0.5 + 0.5) * 255), 0, 255);
      data[idx + 2] = clamp(Math.round((inv * 0.5 + 0.5) * 255), 0, 255);
      data[idx + 3] = 255;
    }
  }
  const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.needsUpdate = true;
  return tex;
}

function createSanctumCausticTex(size = 256) {
  // Smooth organic multi-wave sunlit ocean caustic field (ZERO circles, ZERO repeating Voronoi hexes!)
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) {
    const v = y / size;
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const w1 = Math.sin((u * 3 + v * 2) * TAU + Math.sin((v * 2 - u) * TAU) * 0.9);
      const w2 = Math.sin((u * 2 - v * 4) * TAU + Math.cos((u * 3 + v) * TAU) * 0.85);
      const w3 = Math.cos((u * 5 + v * 3) * TAU - Math.sin((u * 2 + v * 5) * TAU) * 0.7);
      const w4 = Math.sin((u * 4 - v * 2) * TAU + Math.cos((v * 4 - u * 2) * TAU) * 0.6);
      const field = (w1 + w2 + w3 + w4) * 0.25;
      const caustic = Math.pow(clamp(1 - Math.abs(field) * 2.1, 0, 1), 3.0) * 0.50 + clamp(field * 0.5 + 0.5, 0, 1) * 0.16;
      const idx = (y * size + x) * 4;
      data[idx] = clamp(Math.round(10 + caustic * 84), 0, 255);
      data[idx + 1] = clamp(Math.round(78 + caustic * 155), 0, 255);
      data[idx + 2] = clamp(Math.round(106 + caustic * 138), 0, 255);
      data[idx + 3] = 255;
    }
  }
  const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

function createWaterfallRibbonTex(size = 128) {
  if (typeof document === 'undefined' || typeof document.createElement !== 'function') {
    return makeSolidAlbedoTex(140, 235, 250);
  }
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, size, size);
  const gBase = ctx.createLinearGradient(0, 0, size, 0);
  gBase.addColorStop(0, 'rgba(56, 189, 248, 0.14)');
  gBase.addColorStop(0.3, 'rgba(125, 211, 252, 0.48)');
  gBase.addColorStop(0.5, 'rgba(224, 247, 255, 0.68)');
  gBase.addColorStop(0.7, 'rgba(125, 211, 252, 0.48)');
  gBase.addColorStop(1, 'rgba(56, 189, 248, 0.14)');
  ctx.fillStyle = gBase;
  ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < 24; i++) {
    const sx = (i * 29 + 5) % size;
    const sy = (i * 41) % size;
    const h = 22 + (i % 30);
    for (const oy of [-size, 0, size]) {
      const g = ctx.createLinearGradient(sx, sy + oy, sx, sy + oy + h);
      g.addColorStop(0, 'rgba(255,255,255,0)');
      g.addColorStop(0.5, 'rgba(240, 253, 255, 0.58)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g;
      ctx.fillRect(sx, sy + oy, 3 + (i % 4), h);
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createTeardropFlameTex(size = 128) {
  if (typeof document === 'undefined' || typeof document.createElement !== 'function') {
    return makeSolidAlbedoTex(255, 160, 48);
  }
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, size, size);
  const cx = size * 0.5;

  // Soft outer warm orange-red aura
  const aura = ctx.createRadialGradient(cx, size * 0.60, 2, cx, size * 0.56, size * 0.46);
  aura.addColorStop(0.0, 'rgba(255, 210, 90, 0.72)');
  aura.addColorStop(0.35, 'rgba(249, 115, 22, 0.46)');
  aura.addColorStop(0.70, 'rgba(220, 38, 38, 0.16)');
  aura.addColorStop(1.0, 'rgba(180, 20, 0, 0.0)');
  ctx.fillStyle = aura;
  ctx.fillRect(0, 0, size, size);

  // Soft sculpted teardrop flame body (feathered, never hard-edged!)
  const drawTongue = (ox, oy, rx, ry, innerCol, midCol, outerCol) => {
    ctx.save();
    ctx.translate(cx + ox, size * 0.68 + oy);
    ctx.scale(rx, ry);
    const g = ctx.createRadialGradient(0, 0.12, 0.05, 0, -0.25, 1.0);
    g.addColorStop(0.0, innerCol);
    g.addColorStop(0.38, midCol);
    g.addColorStop(0.76, outerCol);
    g.addColorStop(1.0, 'rgba(234, 88, 12, 0.0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(0, -1.05);
    ctx.bezierCurveTo(0.62, -0.45, 0.85, 0.35, 0, 0.72);
    ctx.bezierCurveTo(-0.85, 0.35, -0.62, -0.45, 0, -1.05);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  };

  drawTongue(0, -4, size * 0.34, size * 0.48, 'rgba(255, 250, 205, 0.92)', 'rgba(251, 146, 60, 0.72)', 'rgba(234, 88, 12, 0.18)');
  drawTongue(-5, -2, size * 0.20, size * 0.36, 'rgba(255, 255, 235, 0.85)', 'rgba(253, 186, 116, 0.55)', 'rgba(249, 115, 22, 0.08)');
  drawTongue(6, 0, size * 0.18, size * 0.33, 'rgba(255, 255, 230, 0.80)', 'rgba(251, 191, 36, 0.50)', 'rgba(249, 115, 22, 0.08)');

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createEmberBedTex(size = 128) {
  if (typeof document === 'undefined' || typeof document.createElement !== 'function') {
    return makeSolidAlbedoTex(180, 62, 18);
  }
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#26140d';
  ctx.fillRect(0, 0, size, size);
  const cx = size * 0.5;
  const g = ctx.createRadialGradient(cx, cx, 4, cx, cx, size * 0.48);
  g.addColorStop(0, '#fde047');
  g.addColorStop(0.32, '#f97316');
  g.addColorStop(0.68, '#9a3412');
  g.addColorStop(1, '#1c100b');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  // Dark charred coal chunks over glowing ember cracks
  for (let i = 0; i < 36; i++) {
    const a = (i * 2.39996) % TAU;
    const r = Math.sqrt(i / 36) * size * 0.44;
    const x = cx + Math.cos(a) * r;
    const y = cx + Math.sin(a) * r;
    ctx.fillStyle = i % 3 === 0 ? 'rgba(24, 14, 10, 0.82)' : 'rgba(42, 20, 12, 0.65)';
    ctx.beginPath();
    ctx.arc(x, y, 5 + (i % 5), 0, TAU);
    ctx.fill();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createSoftGlowSpriteTex(size = 64) {
  if (typeof document === 'undefined' || typeof document.createElement !== 'function') {
    return makeSolidAlbedoTex(220, 250, 255);
  }
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const ctx = c.getContext('2d');
  const cx = size * 0.5;
  const g = ctx.createRadialGradient(cx, cx, 0, cx, cx, cx);
  g.addColorStop(0.0, 'rgba(255, 255, 250, 1.0)');
  g.addColorStop(0.28, 'rgba(186, 248, 255, 0.72)');
  g.addColorStop(0.62, 'rgba(56, 189, 248, 0.22)');
  g.addColorStop(1.0, 'rgba(56, 189, 248, 0.0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createPortalDoorRuneTex(size = 256) {
  if (typeof document === 'undefined' || typeof document.createElement !== 'function') {
    return makeSolidAlbedoTex(94, 252, 232);
  }
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size * 2;
  const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, c.width, c.height);

  // Etched glowing aqua Pelagian sanctuary seal glyphs on each door leaf
  ctx.strokeStyle = 'rgba(110, 252, 240, 0.92)';
  ctx.shadowColor = 'rgba(34, 211, 238, 0.85)';
  ctx.shadowBlur = 12;
  ctx.lineWidth = 4;

  // Inner ornamental border inset
  ctx.strokeRect(24, 28, c.width - 48, c.height - 56);
  ctx.lineWidth = 2.5;
  ctx.strokeRect(38, 42, c.width - 76, c.height - 84);

  // Upper & lower Pelagian hydro-diamond crests
  const drawCrest = (cx, cy, r) => {
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, TAU);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx, cy - r * 0.85);
    ctx.lineTo(cx + r * 0.65, cy);
    ctx.lineTo(cx, cy + r * 0.85);
    ctx.lineTo(cx - r * 0.65, cy);
    ctx.closePath();
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(cx, cy, r * 0.25, 0, TAU);
    ctx.stroke();
  };
  drawCrest(c.width * 0.5, c.height * 0.28, 46);
  drawCrest(c.width * 0.5, c.height * 0.72, 42);

  // Central carved conduit spine & horizontal wave scrolls
  ctx.beginPath();
  ctx.moveTo(c.width * 0.5, c.height * 0.28 + 48);
  ctx.lineTo(c.width * 0.5, c.height * 0.72 - 44);
  ctx.stroke();
  for (let i = 0; i < 3; i++) {
    const yy = c.height * (0.43 + i * 0.07);
    ctx.beginPath();
    ctx.moveTo(58, yy);
    ctx.quadraticCurveTo(c.width * 0.35, yy - 14, c.width * 0.5, yy);
    ctx.quadraticCurveTo(c.width * 0.65, yy + 14, c.width - 58, yy);
    ctx.stroke();
  }

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createPortalInnerGlowTex(size = 256) {
  if (typeof document === 'undefined' || typeof document.createElement !== 'function') {
    return makeSolidAlbedoTex(48, 195, 220);
  }
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(size * 0.5, size * 0.55, 8, size * 0.5, size * 0.52, size * 0.62);
  g.addColorStop(0.0, '#e0fffe');
  g.addColorStop(0.28, '#5efce8');
  g.addColorStop(0.62, '#0284c7');
  g.addColorStop(1.0, '#0c2338');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createLotusRuneTex(size = 256) {
  if (typeof document === 'undefined' || typeof document.createElement !== 'function') {
    return makeSolidAlbedoTex(120, 240, 240);
  }
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const ctx = c.getContext('2d');
  const cx = size * 0.5;
  const bg = ctx.createRadialGradient(cx, cx, 6, cx, cx, cx);
  bg.addColorStop(0.0, '#e6ffff');
  bg.addColorStop(0.45, '#5efce8');
  bg.addColorStop(0.82, '#0e7490');
  bg.addColorStop(1.0, '#0a3346');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, size, size);

  // Carved 8-petal crystalline lotus mandala
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.92)';
  ctx.lineWidth = 4;
  for (let i = 0; i < 8; i++) {
    ctx.save();
    ctx.translate(cx, cx);
    ctx.rotate((i / 8) * TAU);
    ctx.beginPath();
    ctx.moveTo(0, -14);
    ctx.quadraticCurveTo(22, -52, 0, -96);
    ctx.quadraticCurveTo(-22, -52, 0, -14);
    ctx.stroke();
    ctx.restore();
  }
  ctx.beginPath();
  ctx.arc(cx, cx, 22, 0, TAU);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(cx, cx, 102, 0, TAU);
  ctx.stroke();

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createSoundWaveRingTex(size = 128) {
  if (typeof document === 'undefined' || typeof document.createElement !== 'function') {
    return makeSolidAlbedoTex(120, 245, 255);
  }
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, size, size);
  const cx = size * 0.5;
  const g = ctx.createRadialGradient(cx, cx, size * 0.25, cx, cx, size * 0.5);
  g.addColorStop(0.0, 'rgba(94, 252, 232, 0.0)');
  g.addColorStop(0.55, 'rgba(94, 252, 232, 0.12)');
  g.addColorStop(0.78, 'rgba(207, 250, 254, 0.85)');
  g.addColorStop(0.90, 'rgba(56, 189, 248, 0.40)');
  g.addColorStop(1.0, 'rgba(56, 189, 248, 0.0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createMonolithRuneTex(size = 128) {
  if (typeof document === 'undefined' || typeof document.createElement !== 'function') {
    return makeSolidAlbedoTex(245, 200, 90);
  }
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, size, size);
  const cx = size * 0.5;
  const g = ctx.createRadialGradient(cx, cx, 4, cx, cx, size * 0.46);
  g.addColorStop(0, 'rgba(254, 240, 138, 0.95)');
  g.addColorStop(0.5, 'rgba(94, 252, 232, 0.55)');
  g.addColorStop(1, 'rgba(14, 116, 144, 0.0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  ctx.strokeStyle = 'rgba(255, 252, 224, 0.96)';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(cx, 16);
  ctx.lineTo(size - 16, cx);
  ctx.lineTo(cx, size - 16);
  ctx.lineTo(16, cx);
  ctx.closePath();
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(cx, cx, 18, 0, TAU);
  ctx.stroke();
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createPipeFlowTex(size = 128) {
  if (typeof document === 'undefined' || typeof document.createElement !== 'function') {
    return makeSolidAlbedoTex(80, 240, 235);
  }
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#0ea5c0';
  ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < 32; i++) {
    const x = (i * 37) % size;
    const y = (i * 23) % size;
    const w = 18 + (i % 24);
    const h = 4 + (i % 6);
    for (const ox of [-size, 0, size]) {
      const g = ctx.createLinearGradient(x + ox, y, x + ox + w, y);
      g.addColorStop(0, 'rgba(94, 252, 232, 0)');
      g.addColorStop(0.5, 'rgba(224, 255, 252, 0.85)');
      g.addColorStop(1, 'rgba(94, 252, 232, 0)');
      ctx.fillStyle = g;
      ctx.fillRect(x + ox, y, w, h);
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// ------------------------------------------------------------------------------------ Sculpted Geometry Builders
function mergeNorm(geos) {
  const norm = geos.map((g) => {
    const ng = g.index ? g.toNonIndexed() : g;
    if (!ng.attributes.normal) ng.computeVertexNormals();
    if (!ng.attributes.uv) {
      ng.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(ng.attributes.position.count * 2), 2));
    }
    return ng;
  });
  const merged = BufferGeometryUtils.mergeGeometries(norm, false);
  for (const g of norm) g.dispose();
  return merged;
}

function buildFlutedShaftGeo(radiusTop, radiusBot, height, flutes = 12, radialSegs = 40) {
  const geo = new THREE.CylinderGeometry(radiusTop, radiusBot, height, radialSegs, 3, false);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const r = Math.hypot(x, z);
    if (r < 0.001) continue;
    const yNorm = Math.abs(y) / (height * 0.5);
    const fade = clamp((0.90 - yNorm) / 0.14, 0, 1);
    const ang = Math.atan2(z, x);
    const flute = Math.pow(Math.abs(Math.sin(ang * (flutes * 0.5))), 1.3);
    const s = 1 - flute * 0.075 * fade;
    pos.setX(i, x * s);
    pos.setZ(i, z * s);
  }
  geo.computeVertexNormals();
  return geo;
}

function buildSanctumColonadeGeos() {
  const stoneParts = [];
  const bronzeParts = [];
  for (const cx of [-4.45, -1.85, 1.85, 4.45]) {
    const z = -3.96;
    // Stepped stone plinth
    const pl = new THREE.BoxGeometry(0.76, 0.24, 0.76);
    pl.translate(cx, -0.22, z);
    stoneParts.push(pl);

    const baseRing = new THREE.TorusGeometry(0.30, 0.06, 8, 20);
    baseRing.rotateX(Math.PI * 0.5);
    baseRing.translate(cx, -0.06, z);
    stoneParts.push(baseRing);

    // Fluted travertine shaft
    const shaft = buildFlutedShaftGeo(0.24, 0.28, 3.25, 12, 36);
    shaft.translate(cx, 1.56, z);
    stoneParts.push(shaft);

    // Carved flared stone capital
    const ech = new THREE.CylinderGeometry(0.37, 0.25, 0.20, 20);
    ech.translate(cx, 3.22, z);
    stoneParts.push(ech);

    const abacus = new THREE.BoxGeometry(0.76, 0.16, 0.76);
    abacus.translate(cx, 3.38, z);
    stoneParts.push(abacus);

    // Antique bronze collars & capital trim
    for (const [cy, r] of [
      [0.06, 0.29],
      [1.62, 0.265],
      [3.12, 0.255],
    ]) {
      const col = new THREE.TorusGeometry(r, 0.036, 8, 20);
      col.rotateX(Math.PI * 0.5);
      col.translate(cx, cy, z);
      bronzeParts.push(col);
    }
    const capTrim = new THREE.BoxGeometry(0.70, 0.07, 0.70);
    capTrim.translate(cx, 3.31, z);
    bronzeParts.push(capTrim);
  }
  return { stoneGeo: mergeNorm(stoneParts), bronzeGeo: mergeNorm(bronzeParts) };
}

function buildTemplePortalGeos() {
  const stoneParts = [];
  const bronzeParts = [];
  const pz = -4.04;

  // Carved stone stepped arch piers & entablature lintel
  for (const sx of [-1.28, 1.28]) {
    const pier = new THREE.BoxGeometry(0.36, 2.48, 0.42);
    pier.translate(sx, 1.24, pz);
    stoneParts.push(pier);
  }
  const lintelLow = new THREE.BoxGeometry(3.12, 0.28, 0.50);
  lintelLow.translate(0, 2.62, pz + 0.03);
  stoneParts.push(lintelLow);

  const lintelTop = new THREE.BoxGeometry(3.42, 0.22, 0.58);
  lintelTop.translate(0, 2.86, pz + 0.05);
  stoneParts.push(lintelTop);

  // Carved semi-circular voussoir arch blocks + keystone
  const archR = 1.18;
  for (let i = 0; i < 9; i++) {
    const ang = (i / 8) * Math.PI;
    const isKey = i === 4;
    const vBlock = new THREE.BoxGeometry(isKey ? 0.34 : 0.26, isKey ? 0.42 : 0.30, isKey ? 0.46 : 0.38);
    vBlock.rotateZ(ang - Math.PI * 0.5);
    vBlock.translate(Math.cos(ang) * archR, 2.02 + Math.sin(ang) * 0.68, pz + 0.06);
    stoneParts.push(vBlock);
  }

  // Recessed stepped antique-bronze jambs, threshold sill & inner arch molding
  const sill = new THREE.BoxGeometry(2.58, 0.14, 0.56);
  sill.translate(0, 0.04, pz + 0.06);
  bronzeParts.push(sill);

  for (const sx of [-1.09, 1.09]) {
    const jambOuter = new THREE.BoxGeometry(0.14, 2.46, 0.46);
    jambOuter.translate(sx, 1.24, pz + 0.04);
    bronzeParts.push(jambOuter);

    const jambStep = new THREE.BoxGeometry(0.09, 2.38, 0.34);
    jambStep.translate(sx * 0.92, 1.20, pz - 0.03);
    bronzeParts.push(jambStep);

    for (let r = 0; r < 5; r++) {
      const stud = new THREE.SphereGeometry(0.038, 6, 6);
      stud.translate(sx, 0.35 + r * 0.48, pz + 0.27);
      bronzeParts.push(stud);
    }
  }
  const archTrim = new THREE.TorusGeometry(1.06, 0.065, 10, 28, Math.PI);
  archTrim.scale(1.0, 0.58, 1.0);
  archTrim.translate(0, 2.02, pz + 0.08);
  bronzeParts.push(archTrim);

  const friezeTrim = new THREE.BoxGeometry(3.26, 0.09, 0.54);
  friezeTrim.translate(0, 2.75, pz + 0.06);
  bronzeParts.push(friezeTrim);

  return { stoneGeo: mergeNorm(stoneParts), bronzeGeo: mergeNorm(bronzeParts) };
}

function buildPortalDoorLeafGeos(sideSign) {
  // sideSign = -1 for left door leaf (hinge at left edge x=-0.52), +1 for right leaf (hinge at +0.52)
  const stoneParts = [];
  const bronzeParts = [];
  const leafW = 1.02;
  const leafH = 2.42;

  const slab = new THREE.BoxGeometry(leafW, leafH, 0.20);
  slab.translate(0, leafH * 0.5, 0);
  stoneParts.push(slab);

  // Sculpted antique bronze outer framing stiles, rails & raised bosses on the front of the door
  const topRail = new THREE.BoxGeometry(leafW + 0.02, 0.14, 0.25);
  topRail.translate(0, leafH - 0.07, 0.01);
  bronzeParts.push(topRail);

  const midRail = new THREE.BoxGeometry(leafW + 0.02, 0.12, 0.25);
  midRail.translate(0, leafH * 0.5, 0.01);
  bronzeParts.push(midRail);

  const botRail = new THREE.BoxGeometry(leafW + 0.02, 0.16, 0.25);
  botRail.translate(0, 0.08, 0.01);
  bronzeParts.push(botRail);

  for (const sx of [-leafW * 0.5 + 0.055, leafW * 0.5 - 0.055]) {
    const stile = new THREE.BoxGeometry(0.11, leafH, 0.24);
    stile.translate(sx, leafH * 0.5, 0.01);
    bronzeParts.push(stile);
  }

  // Ornate bronze pull-ring boss near center seam
  const ringX = -sideSign * 0.30;
  const pullBoss = new THREE.CylinderGeometry(0.10, 0.12, 0.07, 12);
  pullBoss.rotateX(Math.PI * 0.5);
  pullBoss.translate(ringX, 1.18, 0.13);
  bronzeParts.push(pullBoss);

  const pullRing = new THREE.TorusGeometry(0.11, 0.024, 8, 18);
  pullRing.translate(ringX, 1.07, 0.16);
  bronzeParts.push(pullRing);

  return { stoneGeo: mergeNorm(stoneParts), bronzeGeo: mergeNorm(bronzeParts) };
}

function buildTripodBrazierGeo() {
  const parts = [];
  // Stepped bronze circular plinth foot
  const plinth = new THREE.CylinderGeometry(0.24, 0.30, 0.09, 12);
  plinth.translate(0, 0.045, 0);
  parts.push(plinth);

  // 3 sculpted splayed tripod legs with claw feet
  for (let i = 0; i < 3; i++) {
    const ang = (i / 3) * TAU + Math.PI / 6;
    const leg = new THREE.CylinderGeometry(0.032, 0.044, 0.72, 8);
    leg.rotateZ(0.24);
    leg.translate(0.14, 0.38, 0);
    leg.rotateY(ang);
    parts.push(leg);

    const claw = new THREE.SphereGeometry(0.052, 8, 6);
    claw.scale(1.1, 0.65, 1.1);
    claw.translate(Math.cos(ang) * 0.25, 0.06, Math.sin(ang) * 0.25);
    parts.push(claw);
  }

  // Central fluted pedestal stem + decorative ring collar
  const stem = new THREE.CylinderGeometry(0.065, 0.095, 0.62, 12);
  stem.translate(0, 0.40, 0);
  parts.push(stem);

  const collar = new THREE.TorusGeometry(0.16, 0.028, 8, 18);
  collar.rotateX(Math.PI * 0.5);
  collar.translate(0, 0.46, 0);
  parts.push(collar);

  // Sculpted scalloped antique-bronze fire bowl (LatheGeometry profile!)
  const bowlPts = [
    new THREE.Vector2(0.07, 0.66),
    new THREE.Vector2(0.19, 0.72),
    new THREE.Vector2(0.31, 0.84),
    new THREE.Vector2(0.34, 0.93),
    new THREE.Vector2(0.29, 0.94),
    new THREE.Vector2(0.24, 0.84),
    new THREE.Vector2(0.06, 0.78),
  ];
  parts.push(new THREE.LatheGeometry(bowlPts, 20));

  // Rolled bronze bowl rim with 6 studs
  const rim = new THREE.TorusGeometry(0.325, 0.032, 8, 22);
  rim.rotateX(Math.PI * 0.5);
  rim.translate(0, 0.92, 0);
  parts.push(rim);

  return mergeNorm(parts);
}

function buildLotusPlateGeos() {
  // Carved octagonal stone lotus pressure plinth
  const stoneParts = [];
  const baseSlab = new THREE.CylinderGeometry(0.43, 0.47, 0.065, 8);
  baseSlab.rotateY(Math.PI / 8);
  baseSlab.translate(0, 0.032, 0);
  stoneParts.push(baseSlab);

  // Beveled antique bronze frame collar + 4 corner rivets
  const bronzeParts = [];
  const frameRing = new THREE.TorusGeometry(0.34, 0.044, 8, 8);
  frameRing.rotateX(Math.PI * 0.5);
  frameRing.rotateY(Math.PI / 8);
  frameRing.translate(0, 0.07, 0);
  bronzeParts.push(frameRing);

  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * TAU + Math.PI * 0.25;
    const riv = new THREE.SphereGeometry(0.035, 6, 6);
    riv.translate(Math.cos(a) * 0.36, 0.082, Math.sin(a) * 0.36);
    bronzeParts.push(riv);
  }

  // Recessed glowing crystalline lotus medallion disc
  const coreGeo = new THREE.CylinderGeometry(0.30, 0.31, 0.045, 16);
  coreGeo.translate(0, 0.056, 0);

  return { stoneGeo: mergeNorm(stoneParts), bronzeGeo: mergeNorm(bronzeParts), coreGeo };
}

function buildTempleBellGeos() {
  // 1. Carved stone plinth feet + arched temple yoke lintel
  const yokeStoneParts = [];
  for (const sx of [-0.46, 0.46]) {
    const foot = new THREE.BoxGeometry(0.24, 0.16, 0.30);
    foot.translate(sx, 0.08, 0);
    yokeStoneParts.push(foot);
  }
  const lintel = new THREE.BoxGeometry(1.16, 0.12, 0.22);
  lintel.translate(0, 1.56, 0);
  yokeStoneParts.push(lintel);

  // 2. Sculpted bronze suspension yoke posts, arched brace & finials
  const yokeBronzeParts = [];
  for (const sx of [-0.44, 0.44]) {
    const post = new THREE.CylinderGeometry(0.048, 0.062, 1.40, 12);
    post.translate(sx, 0.84, 0);
    yokeBronzeParts.push(post);

    const finial = new THREE.SphereGeometry(0.075, 10, 8);
    finial.translate(sx, 1.66, 0);
    yokeBronzeParts.push(finial);
  }
  const archBrace = new THREE.TorusGeometry(0.43, 0.042, 8, 22, Math.PI);
  archBrace.translate(0, 1.08, 0);
  yokeBronzeParts.push(archBrace);

  const crownHook = new THREE.TorusGeometry(0.07, 0.024, 8, 14);
  crownHook.translate(0, 1.48, 0);
  yokeBronzeParts.push(crownHook);

  // 3. True LatheGeometry sculpted bronze temple bell profile (pivot at y = 0, hangs downward!)
  const bellPts = [
    new THREE.Vector2(0.04, 0.00),
    new THREE.Vector2(0.09, -0.05),
    new THREE.Vector2(0.16, -0.10),
    new THREE.Vector2(0.18, -0.22),
    new THREE.Vector2(0.21, -0.36),
    new THREE.Vector2(0.27, -0.49),
    new THREE.Vector2(0.34, -0.57),
    new THREE.Vector2(0.32, -0.60),
    new THREE.Vector2(0.27, -0.55),
  ];
  const bellBodyParts = [new THREE.LatheGeometry(bellPts, 24)];
  for (const [ry, r] of [
    [-0.14, 0.175],
    [-0.44, 0.25],
    [-0.56, 0.335],
  ]) {
    const rib = new THREE.TorusGeometry(r, 0.018, 6, 22);
    rib.rotateX(Math.PI * 0.5);
    rib.translate(0, ry, 0);
    bellBodyParts.push(rib);
  }

  // 4. Hanging clapper rod + sphere (swings with bell!)
  const clapperParts = [];
  const rod = new THREE.CylinderGeometry(0.016, 0.016, 0.54, 8);
  rod.translate(0, -0.34, 0);
  clapperParts.push(rod);
  const ball = new THREE.SphereGeometry(0.072, 12, 10);
  ball.translate(0, -0.61, 0);
  clapperParts.push(ball);

  // 5. Harmonic enamel band hugging bell waist (colored per BELL_COLORS!)
  const enamelBandGeo = new THREE.CylinderGeometry(0.20, 0.235, 0.14, 24, 1, true);
  enamelBandGeo.translate(0, -0.32, 0);

  return {
    yokeStoneGeo: mergeNorm(yokeStoneParts),
    yokeBronzeGeo: mergeNorm(yokeBronzeParts),
    bellBodyGeo: mergeNorm(bellBodyParts),
    clapperGeo: mergeNorm(clapperParts),
    enamelBandGeo,
  };
}

function buildPrismPedestalGeos() {
  // Static pedestal base (carved octagonal travertine + collar)
  const baseParts = [];
  const plinth = new THREE.CylinderGeometry(0.34, 0.42, 0.22, 8);
  plinth.translate(0, 0.11, 0);
  baseParts.push(plinth);
  const riser = new THREE.CylinderGeometry(0.27, 0.31, 0.10, 12);
  riser.translate(0, 0.27, 0);
  baseParts.push(riser);

  // Rotating riveted antique-bronze turntable + twin angled crystal cradle prongs
  const turretBronzeParts = [];
  const gearDisc = new THREE.CylinderGeometry(0.33, 0.34, 0.08, 16);
  gearDisc.translate(0, 0.04, 0);
  turretBronzeParts.push(gearDisc);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * TAU;
    const lug = new THREE.BoxGeometry(0.07, 0.065, 0.07);
    lug.rotateY(-a);
    lug.translate(Math.cos(a) * 0.34, 0.04, Math.sin(a) * 0.34);
    turretBronzeParts.push(lug);
  }
  // Ornate bronze mirror frame & twin prongs cradling the faceted sapphire prism
  const botBar = new THREE.BoxGeometry(0.76, 0.08, 0.13);
  botBar.translate(0, 0.12, 0);
  turretBronzeParts.push(botBar);

  const topBar = new THREE.BoxGeometry(0.76, 0.075, 0.12);
  topBar.translate(0, 0.88, 0);
  turretBronzeParts.push(topBar);

  for (const sx of [-0.36, 0.36]) {
    const arm = new THREE.BoxGeometry(0.075, 0.80, 0.12);
    arm.translate(sx, 0.50, 0);
    turretBronzeParts.push(arm);

    const finial = new THREE.OctahedronGeometry(0.065, 0);
    finial.translate(sx, 0.94, 0);
    turretBronzeParts.push(finial);
  }

  // Faceted glowing sapphire prism crystal pane
  const prismParts = [];
  const mainFacet = new THREE.CylinderGeometry(0.34, 0.34, 0.72, 6);
  mainFacet.scale(1.0, 1.0, 0.24);
  mainFacet.translate(0, 0.50, 0);
  prismParts.push(mainFacet);

  const centerGem = new THREE.OctahedronGeometry(0.16, 0);
  centerGem.scale(1.2, 1.6, 0.45);
  centerGem.translate(0, 0.50, 0);
  prismParts.push(centerGem);

  return {
    baseGeo: mergeNorm(baseParts),
    turretBronzeGeo: mergeNorm(turretBronzeParts),
    prismGeo: mergeNorm(prismParts),
  };
}

function buildBeveledMonolithGeos() {
  // Bevel-carved ancient rune monolith cube (`arch_bayou_limestone`)
  const stoneParts = [];
  const core = new THREE.BoxGeometry(0.74, 0.78, 0.74);
  core.translate(0, 0.42, 0);
  stoneParts.push(core);
  // Chamfered waist, top & bottom relief faces (gives real beveled silhouette without flat sharp cube edges!)
  const wideX = new THREE.BoxGeometry(0.80, 0.66, 0.66);
  wideX.translate(0, 0.42, 0);
  stoneParts.push(wideX);
  const wideZ = new THREE.BoxGeometry(0.66, 0.66, 0.80);
  wideZ.translate(0, 0.42, 0);
  stoneParts.push(wideZ);
  const wideY = new THREE.BoxGeometry(0.66, 0.84, 0.66);
  wideY.translate(0, 0.42, 0);
  stoneParts.push(wideY);

  // Inlaid antique bronze armor corner brackets & recessed conduit trim
  const bronzeParts = [];
  for (const sx of [-0.36, 0.36]) {
    for (const sz of [-0.36, 0.36]) {
      for (const sy of [0.08, 0.76]) {
        const cap = new THREE.BoxGeometry(0.13, 0.13, 0.13);
        cap.translate(sx, sy, sz);
        bronzeParts.push(cap);
      }
      const rail = new THREE.BoxGeometry(0.06, 0.64, 0.06);
      rail.translate(sx * 1.01, 0.42, sz * 1.01);
      bronzeParts.push(rail);
    }
  }
  const midBand = new THREE.BoxGeometry(0.82, 0.065, 0.82);
  midBand.translate(0, 0.42, 0);
  bronzeParts.push(midBand);

  // Glowing carved gold-aqua ancient rune plaques inlaid on all 4 sides + top
  const runeParts = [];
  for (const ry of [0, Math.PI * 0.5, Math.PI, Math.PI * 1.5]) {
    const pq = new THREE.PlaneGeometry(0.46, 0.46);
    pq.translate(0, 0.42, 0.412);
    pq.rotateY(ry);
    runeParts.push(pq);
  }
  const topPq = new THREE.PlaneGeometry(0.48, 0.48);
  topPq.rotateX(-Math.PI * 0.5);
  topPq.translate(0, 0.848, 0);
  runeParts.push(topPq);

  return {
    stoneGeo: mergeNorm(stoneParts),
    bronzeGeo: mergeNorm(bronzeParts),
    runeGeo: mergeNorm(runeParts),
  };
}

function buildTargetSocketGeos() {
  // Recessed bronze-rimmed square floor target socket
  const bronzeParts = [];
  for (const s of [-0.38, 0.38]) {
    const barZ = new THREE.BoxGeometry(0.09, 0.055, 0.85);
    barZ.translate(s, 0.026, 0);
    bronzeParts.push(barZ);

    const barX = new THREE.BoxGeometry(0.85, 0.055, 0.09);
    barX.translate(0, 0.026, s);
    bronzeParts.push(barX);
  }
  for (const sx of [-0.38, 0.38]) {
    for (const sz of [-0.38, 0.38]) {
      const bolt = new THREE.CylinderGeometry(0.045, 0.05, 0.075, 8);
      bolt.translate(sx, 0.036, sz);
      bronzeParts.push(bolt);
    }
  }

  const coreGeo = new THREE.PlaneGeometry(0.68, 0.68);
  coreGeo.rotateX(-Math.PI * 0.5);
  coreGeo.translate(0, 0.022, 0);

  return { bronzeGeo: mergeNorm(bronzeParts), coreGeo };
}

function buildFlutedGlassCylinderGeo(radius, height, flutes = 16) {
  const geo = new THREE.CylinderGeometry(radius, radius, height, flutes * 3, 2, true);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const ang = Math.atan2(z, x);
    const flute = Math.sin(ang * flutes) * 0.018;
    const scale = 1 + flute;
    pos.setX(i, x * scale);
    pos.setZ(i, z * scale);
  }
  geo.computeVertexNormals();
  return geo;
}

function buildTideLockGeos() {
  // Stepped octagonal travertine base
  const baseParts = [];
  const plinth = new THREE.CylinderGeometry(0.42, 0.48, 0.16, 8);
  plinth.translate(0, 0.08, 0);
  baseParts.push(plinth);
  const ring = new THREE.CylinderGeometry(0.36, 0.40, 0.08, 16);
  ring.translate(0, 0.20, 0);
  baseParts.push(ring);

  // Ornate bronze hydraulic sluice frame (lower collar + 4 tie-rods + ornate crown + finial)
  const cageParts = [];
  const botCollar = new THREE.TorusGeometry(0.34, 0.048, 8, 22);
  botCollar.rotateX(Math.PI * 0.5);
  botCollar.translate(0, 0.24, 0);
  cageParts.push(botCollar);

  const topCollar = new THREE.TorusGeometry(0.34, 0.052, 10, 24);
  topCollar.rotateX(Math.PI * 0.5);
  topCollar.translate(0, 1.76, 0);
  cageParts.push(topCollar);

  const capDome = new THREE.CylinderGeometry(0.16, 0.34, 0.14, 16);
  capDome.translate(0, 1.84, 0);
  cageParts.push(capDome);

  const capFinial = new THREE.SphereGeometry(0.08, 10, 8);
  capFinial.translate(0, 1.94, 0);
  cageParts.push(capFinial);

  for (let k = 0; k < 4; k++) {
    const a = (k / 4) * TAU + Math.PI * 0.25;
    const rx = Math.cos(a) * 0.355;
    const rz = Math.sin(a) * 0.355;
    const rod = new THREE.CylinderGeometry(0.024, 0.024, 1.54, 8);
    rod.translate(rx, 1.00, rz);
    cageParts.push(rod);

    const midClamp = new THREE.SphereGeometry(0.042, 6, 6);
    midClamp.translate(rx, 1.00, rz);
    cageParts.push(midClamp);
  }

  // Carved bronze valve handwheel mounted on front face of sluice pedestal
  const wheelParts = [];
  const wRim = new THREE.TorusGeometry(0.16, 0.024, 8, 18);
  wheelParts.push(wRim);
  const wHub = new THREE.CylinderGeometry(0.042, 0.042, 0.08, 10);
  wHub.rotateX(Math.PI * 0.5);
  wheelParts.push(wHub);
  for (let s = 0; s < 4; s++) {
    const sp = new THREE.BoxGeometry(0.31, 0.026, 0.024);
    sp.rotateZ((s * Math.PI) / 4);
    wheelParts.push(sp);
  }

  return {
    baseGeo: mergeNorm(baseParts),
    cageGeo: mergeNorm(cageParts),
    wheelGeo: mergeNorm(wheelParts),
  };
}

// ------------------------------------------------------------------------------------ PuzzleRenderer
export class PuzzleRenderer {
  constructor(webgl, opts = {}) {
    this.webgl = webgl;
    this.width = opts.width || 390;
    this.height = opts.height || 620;
    this.dpr = opts.dpr || 1;
    this.skinId = opts.skinId || 'sea_glass_guardian';
    this._disposed = false;
    this._dummy = new THREE.Object3D();
    this._col = new THREE.Color();
    this._heroYaw = 0;
    this._loadedTextures = [];

    // Pre-bound placeholder textures ensure prewarm() compiles final normal-mapped PBR shaders with 0 recompile hitch!
    this._flatNormalTex = makeFlatNormalTex();
    this._stonePlaceholder = makeSolidAlbedoTex(222, 212, 194);
    this._limestonePlaceholder = makeSolidAlbedoTex(188, 180, 162);
    this._basaltPlaceholder = makeSolidAlbedoTex(58, 72, 80);
    this._bronzePlaceholder = makeSolidAlbedoTex(194, 146, 72);

    this.causticWaterTex = createSanctumCausticTex(256);
    this.causticWaterTex.repeat.set(7, 7);
    this.waterNormalTex = createWaterRippleNormalTex(256);
    this.waterNormalTex.repeat.set(8, 8);
    this.waterfallTex = createWaterfallRibbonTex(128);
    this.waterfallTex.repeat.set(1, 2.4);
    this.flameTex = createTeardropFlameTex(128);
    this.emberTex = createEmberBedTex(128);
    this.moteGlowTex = createSoftGlowSpriteTex(64);
    this.portalRuneTex = createPortalDoorRuneTex(256);
    this.portalInnerGlowTex = createPortalInnerGlowTex(256);
    this.lotusRuneTex = createLotusRuneTex(256);
    this.soundWaveTex = createSoundWaveRingTex(128);
    this.monolithRuneTex = createMonolithRuneTex(128);
    this.pipeFlowTex = createPipeFlowTex(128);
    this.pipeFlowTex.repeat.set(2, 1);

    this._initScene();
    this._loadPbrTextures();
  }

  setEra(_era) {}

  setSkin(skinId) {
    if (!skinId || this.skinId === skinId) return;
    this.skinId = skinId;
    this.hero?.setSkin(skinId);
  }

  prewarm() {
    try {
      // Pre-compile every puzzle archetype & InstancedMesh shader (including USE_INSTANCING_COLOR) in ONE pass -> 0ms entry spike!
      const savedVis = [];
      const savedCounts = [];
      this.scene.traverse((o) => {
        if (!o.visible) {
          savedVis.push(o);
          o.visible = true;
        }
        if (o.isInstancedMesh && o.count === 0) {
          savedCounts.push([o, 0]);
          o.count = 1;
        }
      });
      this.webgl?.compile?.(this.scene, this.camera);
      for (const [m, c] of savedCounts) m.count = c;
      for (const o of savedVis) o.visible = false;
    } catch {
      // Ignore
    }
  }

  resize(width, height, dpr = 1) {
    if (!width || !height) return;
    this.width = width;
    this.height = height;
    this.dpr = Number(dpr) || 1;
    this.camera.aspect = Math.max(0.35, width / height);
    this.camera.updateProjectionMatrix();
  }

  _initScene() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#6ec6eb');
    // Unified Main-Game Atmospheric Fog matching sunlit cerulean-turquoise sanctum sky
    this.scene.fog = new THREE.FogExp2('#88cce8', 0.0155);

    this.camera = new THREE.PerspectiveCamera(42, this.width / Math.max(1, this.height), 0.2, 95);

    // Unified Main-Game Lighting Rig: Warm Golden Sun Key + Cool Azure Hemisphere + Turquoise Basin Bounce
    this.hemiLight = new THREE.HemisphereLight('#7cc8f0', '#28455c', 1.26);
    this.scene.add(this.hemiLight);

    this.sunLight = new THREE.DirectionalLight('#fff1d6', 2.35);
    this.sunLight.position.set(7.5, 13.5, 8.5);
    this.sunLight.castShadow = false;
    this.scene.add(this.sunLight);

    this.waterBounce = new THREE.DirectionalLight('#22d3ee', 0.78);
    this.waterBounce.position.set(-6, 2.8, -5);
    this.scene.add(this.waterBounce);

    this.solveLight = new THREE.PointLight('#5efce8', 1.35, 14);
    this.solveLight.position.set(0, 1.8, 0);
    this.scene.add(this.solveLight);

    // Shared PBR Materials (all pre-bound with map + normalMap for 0ms prewarm!)
    this.masonryMat = new THREE.MeshStandardMaterial({
      color: '#eee2ce',
      map: this._stonePlaceholder,
      normalMap: this._flatNormalTex,
      normalScale: new THREE.Vector2(1.25, 1.25),
      roughness: 0.66,
      metalness: 0.05,
    });

    this.travMat = new THREE.MeshStandardMaterial({
      color: '#ece1cd',
      map: this._stonePlaceholder,
      normalMap: this._flatNormalTex,
      normalScale: new THREE.Vector2(1.1, 1.1),
      roughness: 0.58,
      metalness: 0.05,
    });

    this.tileMat = new THREE.MeshStandardMaterial({
      color: '#ffffff',
      map: this._stonePlaceholder,
      normalMap: this._flatNormalTex,
      normalScale: new THREE.Vector2(0.9, 0.9),
      roughness: 0.54,
      metalness: 0.06,
    });

    this.limestoneMat = new THREE.MeshStandardMaterial({
      color: '#ded6c4',
      map: this._limestonePlaceholder,
      normalMap: this._flatNormalTex,
      normalScale: new THREE.Vector2(1.2, 1.2),
      roughness: 0.64,
      metalness: 0.06,
    });

    this.basaltMat = new THREE.MeshStandardMaterial({
      color: '#4c626d',
      map: this._basaltPlaceholder,
      normalMap: this._flatNormalTex,
      normalScale: new THREE.Vector2(1.3, 1.3),
      roughness: 0.52,
      metalness: 0.16,
    });

    this.brassMat = new THREE.MeshStandardMaterial({
      color: '#e5b35a',
      map: this._bronzePlaceholder,
      normalMap: this._flatNormalTex,
      normalScale: new THREE.Vector2(1.05, 1.05),
      emissive: '#382208',
      emissiveIntensity: 0.16,
      roughness: 0.28,
      metalness: 0.72,
    });

    this.darkBronzeMat = new THREE.MeshStandardMaterial({
      color: '#a87d45',
      map: this._bronzePlaceholder,
      normalMap: this._flatNormalTex,
      normalScale: new THREE.Vector2(1.15, 1.15),
      emissive: '#261405',
      emissiveIntensity: 0.14,
      roughness: 0.36,
      metalness: 0.68,
    });

    this.troughWaterMat = new THREE.MeshStandardMaterial({
      color: '#19a7bd',
      map: this.causticWaterTex,
      normalMap: this.waterNormalTex,
      normalScale: new THREE.Vector2(0.7, 0.7),
      emissive: '#06667a',
      emissiveMap: this.causticWaterTex,
      emissiveIntensity: 0.45,
      roughness: 0.12,
      metalness: 0.22,
    });

    // 1. Deep Subtle Reflective Dark-Emerald Ocean Pool (NO bright cartoon squiggly lines!)
    this.waterMat = new THREE.MeshStandardMaterial({
      color: '#09384a',
      map: this.causticWaterTex,
      normalMap: this.waterNormalTex,
      normalScale: new THREE.Vector2(1.15, 1.15),
      emissive: '#042230',
      emissiveIntensity: 0.14,
      roughness: 0.16,
      metalness: 0.38,
    });
    this.waterMesh = new THREE.Mesh(new THREE.PlaneGeometry(140, 140, 24, 24), this.waterMat);
    this.waterMesh.rotation.x = -Math.PI * 0.5;
    this.waterMesh.position.y = WATER_Y;
    this.scene.add(this.waterMesh);

    // 2. North Aqueduct Sanctuary Wall, Fluted Columns, Ornate Recessed Temple Portal & Pouring Spouts
    this.sanctumFrame = new THREE.Group();

    const backWall = new THREE.Mesh(new THREE.BoxGeometry(9.6, 3.8, 0.75), this.masonryMat);
    backWall.position.set(0, 1.5, -4.60);
    const trough = new THREE.Mesh(new THREE.BoxGeometry(9.8, 0.36, 0.96), this.brassMat);
    trough.position.set(0, 3.48, -4.45);
    const troughStream = new THREE.Mesh(new THREE.BoxGeometry(9.5, 0.14, 0.72), this.troughWaterMat);
    troughStream.position.set(0, 3.60, -4.45);
    this.sanctumFrame.add(backWall, trough, troughStream);

    // 4 Fluted Travertine Columns + Carved Capitals + Antique Bronze Collars (2 merged draw calls!)
    const colGeos = buildSanctumColonadeGeos();
    this.sanctumFrame.add(
      new THREE.Mesh(colGeos.stoneGeo, this.travMat),
      new THREE.Mesh(colGeos.bronzeGeo, this.brassMat)
    );

    // Twin pouring waterfall spouts (animated translucent foam ribbons) + spinning antique-bronze rotary valves
    this.rotaryValves = [];
    const cascadeMat = new THREE.MeshBasicMaterial({
      color: '#7dd3fc',
      map: this.waterfallTex,
      transparent: true,
      opacity: 0.54,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const spoutParts = [];
    for (const sx of [-3.32, 3.32]) {
      const sp = new THREE.CylinderGeometry(0.15, 0.17, 0.68, 12);
      sp.rotateX(Math.PI * 0.5);
      sp.translate(sx, 2.82, -3.94);
      spoutParts.push(sp);

      const lip = new THREE.TorusGeometry(0.16, 0.036, 8, 16);
      lip.translate(sx, 2.82, -3.60);
      spoutParts.push(lip);

      const stream = new THREE.Mesh(new THREE.CylinderGeometry(0.10, 0.20, 3.15, 12, 1, true), cascadeMat);
      stream.position.set(sx, 1.24, -3.62);
      this.sanctumFrame.add(stream);

      // Merged rotary bronze valve wheel (1 draw call each!)
      const vwParts = [new THREE.TorusGeometry(0.32, 0.045, 8, 20)];
      for (let k = 0; k < 4; k++) {
        const spoke = new THREE.BoxGeometry(0.62, 0.045, 0.04);
        spoke.rotateZ((k * Math.PI) / 4);
        vwParts.push(spoke);
      }
      const vwHub = new THREE.CylinderGeometry(0.08, 0.08, 0.10, 10);
      vwHub.rotateX(Math.PI * 0.5);
      vwParts.push(vwHub);
      const valveWheel = new THREE.Mesh(mergeNorm(vwParts), this.brassMat);
      valveWheel.position.set(sx * 0.86, 1.46, -4.14);
      this.rotaryValves.push(valveWheel);
      this.sanctumFrame.add(valveWheel);
    }
    this.sanctumFrame.add(new THREE.Mesh(mergeNorm(spoutParts), this.brassMat));

    // Ornate Recessed Bronze-Framed Temple Portal (KILLS flat dark-green doorway rectangle!)
    const portalGeos = buildTemplePortalGeos();
    this.sanctumFrame.add(
      new THREE.Mesh(portalGeos.stoneGeo, this.travMat),
      new THREE.Mesh(portalGeos.bronzeGeo, this.brassMat)
    );

    // Recessed mystical inner sanctum threshold backdrop IN FRONT of backWall (revealed dramatically when doors open!)
    this.portalInnerMat = new THREE.MeshBasicMaterial({
      color: '#5efce8',
      map: this.portalInnerGlowTex,
      transparent: true,
      opacity: 0.96,
    });
    const portalInner = new THREE.Mesh(new THREE.PlaneGeometry(2.14, 2.46), this.portalInnerMat);
    portalInner.position.set(0, 1.24, -4.19);
    this.sanctumFrame.add(portalInner);

    // Twin Dark Relief Stone-and-Bronze Doors with Glowing Etched Aqua Seal Runes
    this.portalRuneMat = new THREE.MeshBasicMaterial({
      color: '#5efce8',
      map: this.portalRuneTex,
      transparent: true,
      opacity: 0.86,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const buildDoorLeaf = (sideSign) => {
      const leafGrp = new THREE.Group();
      const dGeos = buildPortalDoorLeafGeos(sideSign);
      leafGrp.add(
        new THREE.Mesh(dGeos.stoneGeo, this.basaltMat),
        new THREE.Mesh(dGeos.bronzeGeo, this.brassMat)
      );
      const runePlane = new THREE.Mesh(new THREE.PlaneGeometry(0.92, 2.15), this.portalRuneMat);
      runePlane.position.set(0, 1.22, 0.135);
      leafGrp.add(runePlane);
      return leafGrp;
    };
    this.gateDoorL = buildDoorLeaf(-1);
    this.gateDoorR = buildDoorLeaf(1);
    this.gateDoorL.position.set(-0.51, 0.04, -4.06);
    this.gateDoorR.position.set(0.51, 0.04, -4.06);
    this.sanctumFrame.add(this.gateDoorL, this.gateDoorR);

    // Recessed Carved Stone Frieze Tablet above Portal Lintel holding 3D Faceted Crystal Cabochons in Bronze Bezels
    // (KILLS flat dark-blue PowerPoint signboard!)
    this.clueFriezeGroup = new THREE.Group();
    this.clueFriezeGroup.position.set(0, 2.66, -3.72);
    const friezeSlab = new THREE.Mesh(new THREE.BoxGeometry(2.58, 0.92, 0.24), this.masonryMat);
    const friezeTrimParts = [];
    for (const sy of [-0.46, 0.46]) {
      const bar = new THREE.BoxGeometry(2.68, 0.08, 0.30);
      bar.translate(0, sy, 0.02);
      friezeTrimParts.push(bar);
    }
    for (const sx of [-1.30, 1.30]) {
      const side = new THREE.BoxGeometry(0.09, 0.98, 0.30);
      side.translate(sx, 0, 0.02);
      friezeTrimParts.push(side);
    }
    const friezeBronze = new THREE.Mesh(mergeNorm(friezeTrimParts), this.brassMat);
    const bezelGeo = new THREE.TorusGeometry(0.11, 0.024, 8, 12);
    this.clueBezelInst = new THREE.InstancedMesh(bezelGeo, this.brassMat, 16);
    this.clueBezelInst.frustumCulled = false;
    this.clueBezelInst.count = 0;
    const gemGeo = new THREE.OctahedronGeometry(0.095, 0);
    gemGeo.scale(1.0, 1.0, 0.65);
    this.clueGems = [];
    for (let i = 0; i < 16; i++) {
      const gm = new THREE.MeshStandardMaterial({
        color: '#0f172a',
        emissive: '#000000',
        emissiveIntensity: 0.0,
        roughness: 0.85,
        metalness: 0.18,
        flatShading: true,
      });
      const gem = new THREE.Mesh(gemGeo, gm);
      gem.visible = false;
      this.clueFriezeGroup.add(gem);
      this.clueGems.push(gem);
    }
    this.clueFriezeGroup.add(friezeSlab, friezeBronze, this.clueBezelInst);
    this.clueFriezeGroup.visible = false;
    this.sanctumFrame.add(this.clueFriezeGroup);
    this._lastClueKey = '';
    this.scene.add(this.sanctumFrame);

    // 3. Stepped Submerged Stone Island Foundation Terraces + Coastal Limestone Boulders + Travertine Courtyard
    // (KILLS floating sharp-edged board-game tabletop rectangle!)
    this.islandBase = new THREE.Mesh(new THREE.BoxGeometry(6.5, 0.58, 6.5), this.limestoneMat);
    this.islandBase.position.y = -0.32;
    this.scene.add(this.islandBase);

    this.canalFrame = new THREE.Group();
    const canalWater = new THREE.Mesh(new THREE.BoxGeometry(6.95, 0.14, 6.95), this.troughWaterMat);
    canalWater.position.y = -0.15;
    const canalRim = new THREE.Mesh(new THREE.BoxGeometry(7.38, 0.14, 7.38), this.brassMat);
    canalRim.position.y = -0.24;
    // Two wider stepped stone foundation terraces descending naturally into the sea!
    const terraceMid = new THREE.Mesh(new THREE.BoxGeometry(8.55, 0.48, 8.55), this.limestoneMat);
    terraceMid.position.y = -0.52;
    const terraceSub = new THREE.Mesh(new THREE.BoxGeometry(10.4, 0.60, 10.4), this.basaltMat);
    terraceSub.position.y = -0.92;
    this.canalFrame.add(canalWater, canalRim, terraceMid, terraceSub);
    this.scene.add(this.canalFrame);

    // 14 Sculpted Craggy Coastal Limestone Boulders anchoring the temple island into the water (1 draw call!)
    const boulderGeo = new THREE.DodecahedronGeometry(0.85, 1);
    const bPos = boulderGeo.attributes.position;
    for (let i = 0; i < bPos.count; i++) {
      const vx = bPos.getX(i), vy = bPos.getY(i), vz = bPos.getZ(i);
      const n = 0.82 + 0.24 * Math.sin(vx * 3.1 + vz * 2.7) + 0.14 * Math.cos(vy * 4.2 - vx * 2.1);
      bPos.setXYZ(i, vx * n * 1.25, vy * n * 0.68, vz * n * 1.15);
    }
    boulderGeo.computeVertexNormals();
    this.shoreBoulders = new THREE.InstancedMesh(boulderGeo, this.limestoneMat, 14);
    this.shoreBoulders.frustumCulled = false;
    const boulderCoords = [
      [-4.6, -0.58, -1.2, 1.15], [4.6, -0.58, -1.0, 1.20],
      [-4.8, -0.62, 1.4, 1.05], [4.8, -0.60, 1.5, 1.10],
      [-4.2, -0.56, 3.6, 1.28], [4.2, -0.56, 3.5, 1.22],
      [-2.4, -0.64, 4.4, 1.08], [2.4, -0.64, 4.4, 1.12],
      [-5.6, -0.66, -3.2, 1.38], [5.6, -0.66, -3.2, 1.34],
      [-5.8, -0.72, 0.4, 1.42], [5.8, -0.72, 0.6, 1.36],
      [-5.2, -0.68, 2.8, 1.18], [5.2, -0.68, 2.9, 1.24],
    ];
    for (let i = 0; i < boulderCoords.length; i++) {
      const [bx, by, bz, bs] = boulderCoords[i];
      this._dummy.position.set(bx, by, bz);
      this._dummy.rotation.set(i * 0.3, i * 1.15, i * 0.2);
      this._dummy.scale.set(bs, bs * (0.85 + (i % 3) * 0.15), bs);
      this._dummy.updateMatrix();
      this.shoreBoulders.setMatrixAt(i, this._dummy.matrix);
    }
    this.shoreBoulders.instanceMatrix.needsUpdate = true;
    this.scene.add(this.shoreBoulders);

    this.tileInst = new THREE.InstancedMesh(new THREE.BoxGeometry(0.94, 0.16, 0.94), this.tileMat, MAX_TILES);
    this.tileInst.frustumCulled = false;
    this.tileInst.setColorAt(0, this._col.set('#f0e7d6'));
    this.scene.add(this.tileInst);

    // 4. Sculpted Antique-Bronze Tripod Braziers + Glowing Ember Beds + Layered Soft Teardrop Flame Billboards (4 draw calls for all 6!)
    this.brazierBodyInst = new THREE.InstancedMesh(buildTripodBrazierGeo(), this.darkBronzeMat, MAX_VALVE_SCONCES);
    this.brazierBodyInst.frustumCulled = false;
    this.scene.add(this.brazierBodyInst);

    const emberGeo = new THREE.SphereGeometry(0.24, 12, 8, 0, TAU, 0, Math.PI * 0.5);
    emberGeo.scale(1.0, 0.48, 1.0);
    emberGeo.translate(0, 0.84, 0);
    this.brazierEmberMat = new THREE.MeshStandardMaterial({
      color: '#ff9a3c',
      map: this.emberTex,
      emissive: '#f97316',
      emissiveMap: this.emberTex,
      emissiveIntensity: 1.55,
      roughness: 0.65,
    });
    this.brazierEmberInst = new THREE.InstancedMesh(emberGeo, this.brazierEmberMat, MAX_VALVE_SCONCES);
    this.brazierEmberInst.frustumCulled = false;
    this.scene.add(this.brazierEmberInst);

    this.brazierFlameOuterInst = new THREE.InstancedMesh(
      new THREE.PlaneGeometry(0.68, 0.82),
      new THREE.MeshBasicMaterial({
        color: '#ffedd5',
        map: this.flameTex,
        transparent: true,
        opacity: 0.84,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
      MAX_VALVE_SCONCES
    );
    this.brazierFlameOuterInst.frustumCulled = false;
    this.scene.add(this.brazierFlameOuterInst);

    this.brazierFlameInnerInst = new THREE.InstancedMesh(
      new THREE.PlaneGeometry(0.42, 0.56),
      new THREE.MeshBasicMaterial({
        color: '#fef9c3',
        map: this.flameTex,
        transparent: true,
        opacity: 0.92,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
      MAX_VALVE_SCONCES
    );
    this.brazierFlameInnerInst.frustumCulled = false;
    this.scene.add(this.brazierFlameInnerInst);

    // -------------------------------------------------------------------------------- ARCHETYPE 1: `lights`
    // Carved Stone Lotus Pressure Plates + Beveled Antique Bronze Frames + Distinct Lit vs Unlit Crystalline Lotus Medallions (4 draw calls!)
    const lotusGeos = buildLotusPlateGeos();
    this.lightStoneInst = new THREE.InstancedMesh(lotusGeos.stoneGeo, this.travMat, MAX_TILES);
    this.lightBronzeInst = new THREE.InstancedMesh(lotusGeos.bronzeGeo, this.brassMat, MAX_TILES);
    this.lightCoreLitMat = new THREE.MeshStandardMaterial({
      color: '#5efce8',
      map: this.lotusRuneTex,
      emissive: '#06b6d4',
      emissiveMap: this.lotusRuneTex,
      emissiveIntensity: 1.25,
      roughness: 0.12,
      metalness: 0.15,
    });
    this.lightCoreOffMat = new THREE.MeshStandardMaterial({
      color: '#1e3547',
      map: this.lotusRuneTex,
      emissive: '#082032',
      emissiveIntensity: 0.08,
      roughness: 0.42,
      metalness: 0.28,
    });
    this.lightCoreLitInst = new THREE.InstancedMesh(lotusGeos.coreGeo, this.lightCoreLitMat, MAX_TILES);
    this.lightCoreOffInst = new THREE.InstancedMesh(lotusGeos.coreGeo, this.lightCoreOffMat, MAX_TILES);
    this.lightStoneInst.frustumCulled = false;
    this.lightBronzeInst.frustumCulled = false;
    this.lightCoreLitInst.frustumCulled = false;
    this.lightCoreOffInst.frustumCulled = false;
    this.lightStoneInst.count = 0;
    this.lightBronzeInst.count = 0;
    this.lightCoreLitInst.count = 0;
    this.lightCoreOffInst.count = 0;
    this.scene.add(this.lightStoneInst, this.lightBronzeInst, this.lightCoreLitInst, this.lightCoreOffInst);

    // -------------------------------------------------------------------------------- ARCHETYPE 2: `bells`
    // Suspended Sculpted Lathe Bronze Temple Bells + Clappers + Carved Stone/Bronze Yokes + Expanding Soft Aqua Sound-Wave Rings
    const bellGeos = buildTempleBellGeos();
    this.bellSlots = [];
    for (let i = 0; i < MAX_BELLS; i++) {
      const root = new THREE.Group();
      const yokeStone = new THREE.Mesh(bellGeos.yokeStoneGeo, this.travMat);
      const yokeBronze = new THREE.Mesh(bellGeos.yokeBronzeGeo, this.brassMat);

      const bellPiv = new THREE.Group();
      bellPiv.position.y = 1.48;
      const bellBody = new THREE.Mesh(bellGeos.bellBodyGeo, this.brassMat);
      const enamelMat = new THREE.MeshStandardMaterial({
        color: '#c98b32',
        emissive: '#4a2c08',
        emissiveIntensity: 0.24,
        roughness: 0.22,
        metalness: 0.56,
      });
      const enamelBand = new THREE.Mesh(bellGeos.enamelBandGeo, enamelMat);
      const clapperPiv = new THREE.Group();
      const clapper = new THREE.Mesh(bellGeos.clapperGeo, this.darkBronzeMat);
      clapperPiv.add(clapper);
      bellPiv.add(bellBody, enamelBand, clapperPiv);

      // 3D Beveled Antique-Bronze Floor Collar Ring inlaid with metallic jewel-toned enamel (ZERO flat pastel stickers!)
      const badgeMat = new THREE.MeshStandardMaterial({
        color: '#c98b32',
        emissive: '#382206',
        emissiveIntensity: 0.24,
        roughness: 0.24,
        metalness: 0.62,
      });
      const badgeOuter = new THREE.TorusGeometry(0.39, 0.042, 8, 24);
      badgeOuter.rotateX(Math.PI * 0.5);
      const badgeInner = new THREE.TorusGeometry(0.33, 0.022, 8, 24);
      badgeInner.rotateX(Math.PI * 0.5);
      const badge = new THREE.Group();
      const badgeBronzeRim = new THREE.Mesh(badgeOuter, this.brassMat);
      const badgeInlay = new THREE.Mesh(badgeInner, badgeMat);
      badgeInlay.position.y = 0.012;
      badge.add(badgeBronzeRim, badgeInlay);
      badge.position.y = 0.032;

      // Expanding soft aqua acoustic sound-wave ring
      const waveMat = new THREE.MeshBasicMaterial({
        color: '#5efce8',
        map: this.soundWaveTex,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const waveRing = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 1.1), waveMat);
      waveRing.rotation.x = -Math.PI * 0.5;
      waveRing.position.y = 0.42;
      waveRing.visible = false;

      root.add(yokeStone, yokeBronze, bellPiv, badge, waveRing);
      root.visible = false;
      this.scene.add(root);
      this.bellSlots.push({ root, bellPiv, clapperPiv, enamelMat, badgeMat, waveRing, waveMat });
    }

    // -------------------------------------------------------------------------------- ARCHETYPE 3: `beam`
    // Faceted Glowing Sapphire Prism Pedestals on Rotating Riveted Bronze Turntables + Layered Soft Additive Light Beams
    const prismGeos = buildPrismPedestalGeos();
    this.mirrorBaseInst = new THREE.InstancedMesh(prismGeos.baseGeo, this.travMat, MAX_MIRRORS);
    this.mirrorBaseInst.frustumCulled = false;
    this.scene.add(this.mirrorBaseInst);

    // Polished Silvered-Crystal Mirror Plates with Diagonal Specular Sheen (KILLS flat baby-blue TV screens!)
    let mirrorGlintTex = null;
    if (typeof document !== 'undefined' && typeof document.createElement === 'function') {
      const mc = document.createElement('canvas');
      mc.width = 128;
      mc.height = 128;
      const mctx = mc.getContext('2d');
      const mg = mctx.createLinearGradient(0, 0, 128, 128);
      mg.addColorStop(0.0, '#4a687a');
      mg.addColorStop(0.28, '#87a9bc');
      mg.addColorStop(0.46, '#e2f3fa');
      mg.addColorStop(0.54, '#a6c6d6');
      mg.addColorStop(0.76, '#5c7c90');
      mg.addColorStop(1.0, '#375061');
      mctx.fillStyle = mg;
      mctx.fillRect(0, 0, 128, 128);
      // Subtle etched silvered bevel border
      mctx.strokeStyle = 'rgba(235, 248, 255, 0.55)';
      mctx.lineWidth = 4;
      mctx.strokeRect(8, 8, 112, 112);
      mirrorGlintTex = new THREE.CanvasTexture(mc);
      mirrorGlintTex.colorSpace = THREE.SRGBColorSpace;
      this._loadedTextures.push(mirrorGlintTex);
    }
    this.sapphirePrismMat = new THREE.MeshStandardMaterial({
      color: '#c4dce8',
      map: mirrorGlintTex || this._stonePlaceholder,
      emissive: '#0c2d40',
      emissiveIntensity: 0.18,
      roughness: 0.10,
      metalness: 0.88,
    });
    this.mirrorSlots = [];
    for (let i = 0; i < MAX_MIRRORS; i++) {
      const root = new THREE.Group();
      const turret = new THREE.Group();
      turret.position.y = 0.30;
      const bronzeTurret = new THREE.Mesh(prismGeos.turretBronzeGeo, this.brassMat);
      const prismCrystal = new THREE.Mesh(prismGeos.prismGeo, this.sapphirePrismMat);
      turret.add(bronzeTurret, prismCrystal);
      root.add(turret);
      root.visible = false;
      this.scene.add(root);
      this.mirrorSlots.push({ root, turret });
    }

    // Sculpted Beam Source Emitter (carved travertine plinth + bronze projector lens + glowing sapphire aperture)
    this.beamEmitter = new THREE.Group();
    const emStone = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.38, 0.36, 8), this.travMat);
    emStone.position.y = 0.18;
    const emBronzeParts = [];
    const emBarrel = new THREE.CylinderGeometry(0.22, 0.28, 0.54, 14);
    emBarrel.translate(0, 0.62, 0);
    emBronzeParts.push(emBarrel);
    const emCollar = new THREE.TorusGeometry(0.25, 0.045, 8, 20);
    emCollar.rotateX(Math.PI * 0.5);
    emCollar.translate(0, 0.84, 0);
    emBronzeParts.push(emCollar);
    const emBronze = new THREE.Mesh(mergeNorm(emBronzeParts), this.brassMat);
    const emLens = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.20, 1),
      new THREE.MeshStandardMaterial({ color: '#e0f7ff', emissive: '#38bdf8', emissiveIntensity: 1.5, roughness: 0.06 })
    );
    emLens.position.y = 0.86;
    this.beamEmitter.add(emStone, emBronze, emLens);
    this.beamEmitter.visible = false;
    this.scene.add(this.beamEmitter);

    // Sculpted Target Receptor Crystal inside miniature bronze armillary cradle
    this.beamReceptor = new THREE.Group();
    const recBase = new THREE.Mesh(new THREE.CylinderGeometry(0.30, 0.38, 0.24, 8), this.travMat);
    recBase.position.y = 0.12;
    this.recGimbal = new THREE.Mesh(new THREE.TorusGeometry(0.38, 0.032, 8, 24), this.brassMat);
    this.recGimbal.position.y = BEAM_Y;
    this.recCrystal = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.32, 0),
      new THREE.MeshStandardMaterial({ color: '#a5f3fc', emissive: '#06b6d4', emissiveIntensity: 1.45, roughness: 0.08, metalness: 0.22 })
    );
    this.recCrystal.scale.set(0.85, 1.28, 0.85);
    this.recCrystal.position.y = BEAM_Y;
    this.beamReceptor.add(recBase, this.recGimbal, this.recCrystal);
    this.beamReceptor.visible = false;
    this.scene.add(this.beamReceptor);

    // Layered Soft Additive Light Beams (bright focused core + wider soft outer halo + reflection node flares!)
    const beamCoreGeo = new THREE.CylinderGeometry(0.042, 0.042, 1, 8);
    beamCoreGeo.rotateX(Math.PI * 0.5);
    beamCoreGeo.translate(0, 0, 0.5);
    this.beamCoreInst = new THREE.InstancedMesh(
      beamCoreGeo,
      new THREE.MeshBasicMaterial({
        color: '#e0ffff',
        transparent: true,
        opacity: 0.94,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
      MAX_BEAM_SEGS
    );
    this.beamCoreInst.frustumCulled = false;
    this.scene.add(this.beamCoreInst);

    const beamHaloGeo = new THREE.CylinderGeometry(0.14, 0.14, 1, 10, 1, true);
    beamHaloGeo.rotateX(Math.PI * 0.5);
    beamHaloGeo.translate(0, 0, 0.5);
    this.beamHaloInst = new THREE.InstancedMesh(
      beamHaloGeo,
      new THREE.MeshBasicMaterial({
        color: '#22d3ee',
        transparent: true,
        opacity: 0.30,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
      MAX_BEAM_SEGS
    );
    this.beamHaloInst.frustumCulled = false;
    this.scene.add(this.beamHaloInst);

    this.beamFlareInst = new THREE.InstancedMesh(
      new THREE.PlaneGeometry(0.62, 0.62),
      new THREE.MeshBasicMaterial({
        color: '#7dd3fc',
        map: this.moteGlowTex,
        transparent: true,
        opacity: 0.85,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
      MAX_BEAM_SEGS
    );
    this.beamFlareInst.frustumCulled = false;
    this.scene.add(this.beamFlareInst);

    // -------------------------------------------------------------------------------- ARCHETYPE 4: `blocks`
    // Bevel-Carved Ancient Rune Monolith Cubes + Inlaid Gold Bronze Trim + Recessed Bronze-Rimmed Target Sockets (5 draw calls total!)
    const monoGeos = buildBeveledMonolithGeos();
    this.blockStoneInst = new THREE.InstancedMesh(monoGeos.stoneGeo, this.limestoneMat, MAX_BLOCKS);
    this.blockBronzeInst = new THREE.InstancedMesh(monoGeos.bronzeGeo, this.brassMat, MAX_BLOCKS);
    this.blockRuneMat = new THREE.MeshBasicMaterial({
      color: '#fde047',
      map: this.monolithRuneTex,
      transparent: true,
      opacity: 0.92,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this.blockRuneInst = new THREE.InstancedMesh(monoGeos.runeGeo, this.blockRuneMat, MAX_BLOCKS);
    this.blockStoneInst.frustumCulled = false;
    this.blockBronzeInst.frustumCulled = false;
    this.blockRuneInst.frustumCulled = false;
    this.scene.add(this.blockStoneInst, this.blockBronzeInst, this.blockRuneInst);

    const sockGeos = buildTargetSocketGeos();
    this.socketBronzeInst = new THREE.InstancedMesh(sockGeos.bronzeGeo, this.brassMat, MAX_PLATES);
    this.socketCoreMat = new THREE.MeshStandardMaterial({
      color: '#ffffff',
      map: this.lotusRuneTex,
      emissive: '#f59e0b',
      emissiveMap: this.lotusRuneTex,
      emissiveIntensity: 0.85,
      roughness: 0.25,
    });
    this.socketCoreInst = new THREE.InstancedMesh(sockGeos.coreGeo, this.socketCoreMat, MAX_PLATES);
    this.socketBronzeInst.frustumCulled = false;
    this.socketCoreInst.frustumCulled = false;
    this.socketCoreInst.setColorAt(0, this._col.set('#f59e0b'));
    this.socketBronzeInst.count = 0;
    this.socketCoreInst.count = 0;
    this.scene.add(this.socketBronzeInst, this.socketCoreInst);

    // -------------------------------------------------------------------------------- ARCHETYPE 5: `pipes`
    // Weathered Copper/Brass Flanged Aqueduct Conduits + Glowing Turquoise Glass Pressure Sight-Gauges + Flush Recessed Outflow Drain
    const buildPipeGeos = (hasS, hasW) => {
      const brassParts = [];
      const coreParts = [];
      // Central riveted pressure dome manifold
      const hub = new THREE.CylinderGeometry(0.18, 0.20, 0.24, 12);
      brassParts.push(hub);
      const hubRing = new THREE.TorusGeometry(0.185, 0.032, 8, 16);
      hubRing.rotateX(Math.PI * 0.5);
      hubRing.translate(0, 0.10, 0);
      brassParts.push(hubRing);

      // Top pressure sight-gauge bezel glass dome
      const topGauge = new THREE.CylinderGeometry(0.135, 0.145, 0.07, 14);
      topGauge.translate(0, 0.115, 0);
      coreParts.push(topGauge);

      const dirs = [0];
      if (hasS) dirs.push(-Math.PI * 0.5);
      if (hasW) dirs.push(Math.PI);
      for (const ry of dirs) {
        // Lower brass cradle trough & side ribs leaving top sight-gauge cutaway open!
        const armLower = new THREE.CylinderGeometry(0.135, 0.135, 0.46, 12, 1, false, Math.PI * 0.35, Math.PI * 1.3);
        armLower.rotateZ(Math.PI * 0.5);
        armLower.translate(0.24, 0, 0);
        armLower.rotateY(ry);
        brassParts.push(armLower);

        // Bolted octagonal end flange + mid retention collar
        const flEnd = new THREE.CylinderGeometry(0.185, 0.185, 0.065, 8);
        flEnd.rotateZ(Math.PI * 0.5);
        flEnd.translate(0.45, 0, 0);
        flEnd.rotateY(ry);
        brassParts.push(flEnd);

        const flMid = new THREE.TorusGeometry(0.148, 0.026, 6, 14);
        flMid.rotateY(Math.PI * 0.5);
        flMid.translate(0.25, 0, 0);
        flMid.rotateY(ry);
        brassParts.push(flMid);

        // Glowing turquoise glass pressure sight-gauge tube showing flowing water inside!
        const gaugeTube = new THREE.CylinderGeometry(0.095, 0.095, 0.46, 10);
        gaugeTube.rotateZ(Math.PI * 0.5);
        gaugeTube.translate(0.24, 0.04, 0);
        gaugeTube.rotateY(ry);
        coreParts.push(gaugeTube);
      }
      return { brassGeo: mergeNorm(brassParts), coreGeo: mergeNorm(coreParts) };
    };

    const pipeBaseGeo = new THREE.CylinderGeometry(0.42, 0.46, 0.08, 8);
    this.pipeBaseInst = new THREE.InstancedMesh(pipeBaseGeo, this.travMat, MAX_PIPES);
    this.pipeBaseInst.frustumCulled = false;
    this.scene.add(this.pipeBaseInst);

    this.pipeBrassMat = new THREE.MeshStandardMaterial({
      color: '#ffffff',
      map: this._bronzePlaceholder,
      normalMap: this._flatNormalTex,
      normalScale: new THREE.Vector2(1.05, 1.05),
      emissive: '#352008',
      emissiveIntensity: 0.14,
      roughness: 0.28,
      metalness: 0.72,
    });
    this.pipeFlowLitMat = new THREE.MeshStandardMaterial({
      color: '#7efce8',
      map: this.pipeFlowTex,
      emissive: '#06b6d4',
      emissiveMap: this.pipeFlowTex,
      emissiveIntensity: 1.45,
      roughness: 0.08,
      metalness: 0.12,
    });
    this.pipeFlowOffMat = new THREE.MeshStandardMaterial({
      color: '#334c5c',
      roughness: 0.24,
      metalness: 0.32,
    });

    this.pipeShapeInsts = {};
    for (const [key, hasS, hasW] of [
      ['straight', false, true],
      ['elbow', true, false],
      ['tee', true, true],
    ]) {
      const { brassGeo, coreGeo } = buildPipeGeos(hasS, hasW);
      const bInst = new THREE.InstancedMesh(brassGeo, this.pipeBrassMat, MAX_PIPES);
      const litInst = new THREE.InstancedMesh(coreGeo, this.pipeFlowLitMat, MAX_PIPES);
      const offInst = new THREE.InstancedMesh(coreGeo, this.pipeFlowOffMat, MAX_PIPES);
      bInst.frustumCulled = false;
      litInst.frustumCulled = false;
      offInst.frustumCulled = false;
      bInst.setColorAt(0, this._col.set('#f2c166'));
      bInst.count = 0;
      litInst.count = 0;
      offInst.count = 0;
      this.scene.add(bInst, litInst, offInst);
      this.pipeShapeInsts[key] = { bInst, litInst, offInst };
    }

    // Sculpted Bronze Intake Manifold + Spinning Valve Wheel
    this.pipeIntake = new THREE.Group();
    const intakeParts = [];
    const inBase = new THREE.CylinderGeometry(0.26, 0.34, 0.32, 12);
    inBase.translate(0, 0.16, 0);
    intakeParts.push(inBase);
    const inRing = new THREE.TorusGeometry(0.28, 0.042, 8, 18);
    inRing.rotateX(Math.PI * 0.5);
    inRing.translate(0, 0.32, 0);
    intakeParts.push(inRing);
    this.pipeIntake.add(new THREE.Mesh(mergeNorm(intakeParts), this.brassMat));
    const intakeOrb = new THREE.Mesh(
      new THREE.SphereGeometry(0.18, 14, 12),
      new THREE.MeshStandardMaterial({
        color: '#a5f3fc',
        map: this.pipeFlowTex,
        emissive: '#06b6d4',
        emissiveIntensity: 1.35,
        roughness: 0.08,
      })
    );
    intakeOrb.position.y = 0.38;
    this.pipeIntake.add(intakeOrb);
    this.pipeIntake.visible = false;
    this.scene.add(this.pipeIntake);

    // Flush Recessed Bronze Aqueduct Outflow Drain Tile (`y <= 0.044`, ZERO shin clipping on Gateway!)
    this.pipeOutflowSlots = [];
    const drainBronzeParts = [];
    for (const s of [-0.39, 0.39]) {
      const b1 = new THREE.BoxGeometry(0.08, 0.036, 0.86);
      b1.translate(s, 0.018, 0);
      drainBronzeParts.push(b1);
      const b2 = new THREE.BoxGeometry(0.86, 0.036, 0.08);
      b2.translate(0, 0.018, s);
      drainBronzeParts.push(b2);
    }
    for (const gOff of [-0.18, 0, 0.18]) {
      const bar = new THREE.BoxGeometry(0.76, 0.024, 0.035);
      bar.translate(0, 0.026, gOff);
      drainBronzeParts.push(bar);
    }
    const drainBronzeGeo = mergeNorm(drainBronzeParts);
    const drainVortexGeo = new THREE.PlaneGeometry(0.72, 0.72);
    drainVortexGeo.rotateX(-Math.PI * 0.5);
    drainVortexGeo.translate(0, 0.016, 0);
    const drainVortexMat = new THREE.MeshBasicMaterial({
      color: '#fde047',
      map: this.lotusRuneTex,
      transparent: true,
      opacity: 0.92,
    });
    for (let i = 0; i < 3; i++) {
      const g = new THREE.Group();
      g.add(new THREE.Mesh(drainBronzeGeo, this.brassMat), new THREE.Mesh(drainVortexGeo, drainVortexMat));
      g.visible = false;
      this.scene.add(g);
      this.pipeOutflowSlots.push(g);
    }

    // -------------------------------------------------------------------------------- ARCHETYPE 6: `tide_locks`
    // Ornate Bronze-and-Crystal Hydraulic Sluice Columns + Carved Bronze Valve Wheels + Fluted Glass + Animated Rising Water
    const tlGeos = buildTideLockGeos();
    const flutedGlassGeo = buildFlutedGlassCylinderGeo(0.315, 1.52, 16);
    const colWaterGeo = new THREE.CylinderGeometry(0.275, 0.275, 1.0, 16);
    colWaterGeo.translate(0, 0.5, 0);
    const meniscusGeo = new THREE.CircleGeometry(0.278, 18);
    meniscusGeo.rotateX(-Math.PI * 0.5);
    const targetRingGeo = new THREE.TorusGeometry(0.39, 0.044, 8, 24);
    targetRingGeo.rotateX(Math.PI * 0.5);
    const glassMat = new THREE.MeshStandardMaterial({
      color: '#d8f4ff',
      roughness: 0.08,
      metalness: 0.18,
      transparent: true,
      opacity: 0.30,
      side: THREE.DoubleSide,
      depthWrite: false,
    });

    this.tideLockSlots = [];
    for (let i = 0; i < MAX_TIDE_LOCKS; i++) {
      const root = new THREE.Group();
      const base = new THREE.Mesh(tlGeos.baseGeo, this.travMat);
      const cage = new THREE.Mesh(tlGeos.cageGeo, this.brassMat);
      const valveWheel = new THREE.Mesh(tlGeos.wheelGeo, this.brassMat);
      valveWheel.position.set(0, 0.34, 0.42);

      const glass = new THREE.Mesh(flutedGlassGeo, glassMat);
      glass.position.y = 1.00;

      const waterMat = new THREE.MeshStandardMaterial({
        color: '#38d9ea',
        map: this.pipeFlowTex,
        emissive: '#06b6d4',
        emissiveMap: this.pipeFlowTex,
        emissiveIntensity: 1.05,
        roughness: 0.08,
        metalness: 0.12,
      });
      const waterCol = new THREE.Mesh(colWaterGeo, waterMat);
      waterCol.position.y = 0.24;

      const meniscus = new THREE.Mesh(
        meniscusGeo,
        new THREE.MeshBasicMaterial({
          color: '#ccfbf1',
          transparent: true,
          opacity: 0.92,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        })
      );
      meniscus.position.y = 0.6;

      const targetMat = new THREE.MeshStandardMaterial({
        color: '#d9a441',
        map: this._bronzePlaceholder,
        normalMap: this._flatNormalTex,
        normalScale: new THREE.Vector2(1.0, 1.0),
        emissive: '#382206',
        emissiveIntensity: 0.22,
        roughness: 0.22,
        metalness: 0.86,
      });
      const targetRing = new THREE.Mesh(targetRingGeo, targetMat);
      targetRing.position.y = 0.72;

      root.add(base, cage, valveWheel, waterCol, meniscus, glass, targetRing);
      root.visible = false;
      this.scene.add(root);
      this.tideLockSlots.push({ root, valveWheel, waterCol, waterMat, meniscus, targetRing, targetMat });
    }

    // -------------------------------------------------------------------------------- Hero, Contact AO, Reward & Motes
    this.hero = new AdaptiveSanctumHero(this.skinId);
    this.hero.group.scale.setScalar(1.36);
    this.scene.add(this.hero.group);

    let aoTex = null;
    if (typeof document !== 'undefined' && typeof document.createElement === 'function') {
      const ac = document.createElement('canvas');
      ac.width = 64;
      ac.height = 64;
      const actx = ac.getContext('2d');
      const ag = actx.createRadialGradient(32, 32, 4, 32, 32, 30);
      ag.addColorStop(0, 'rgba(8, 24, 36, 0.56)');
      ag.addColorStop(0.55, 'rgba(8, 24, 36, 0.24)');
      ag.addColorStop(1, 'rgba(8, 24, 36, 0)');
      actx.fillStyle = ag;
      actx.fillRect(0, 0, 64, 64);
      aoTex = new THREE.CanvasTexture(ac);
      this._aoTex = aoTex;
    }
    this.heroContactAo = new THREE.Mesh(
      new THREE.PlaneGeometry(0.95, 0.95),
      new THREE.MeshBasicMaterial({
        map: aoTex,
        color: '#ffffff',
        transparent: true,
        opacity: 0.95,
        depthWrite: false,
      })
    );
    this.heroContactAo.rotation.x = -Math.PI * 0.5;
    this.heroContactAo.position.y = 0.015;
    this.scene.add(this.heroContactAo);

    this.rewardOrb = new THREE.Group();
    const orbCrystal = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.32, 0),
      new THREE.MeshStandardMaterial({
        color: '#0ea5e9',
        emissive: '#0284c7',
        emissiveIntensity: 0.45,
        roughness: 0.10,
        metalness: 0.36,
        flatShading: true,
      })
    );
    orbCrystal.scale.set(0.78, 1.32, 0.78);
    const orbBezel = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.036, 8, 24), this.brassMat);
    orbBezel.rotation.x = Math.PI * 0.5;
    this.rewardOrb.add(orbCrystal, orbBezel);
    this.rewardOrb.visible = false;
    this.scene.add(this.rewardOrb);

    this.sealShatterRing = new THREE.Mesh(
      new THREE.PlaneGeometry(2.2, 2.2),
      new THREE.MeshBasicMaterial({
        color: '#fde047',
        map: this.soundWaveTex,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    this.sealShatterRing.rotation.x = -Math.PI * 0.5;
    this.sealShatterRing.visible = false;
    this.scene.add(this.sealShatterRing);

    // Soft Radial Alpha Glowing Water-Mote Sprites (KILLS flat white hexagon dots — 1 draw call!)
    this.moteInst = new THREE.InstancedMesh(
      new THREE.PlaneGeometry(0.16, 0.16),
      new THREE.MeshBasicMaterial({
        color: '#ffffff',
        map: this.moteGlowTex,
        transparent: true,
        opacity: 0.82,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
      MAX_MOTES
    );
    this.moteInst.frustumCulled = false;
    for (let i = 0; i < MAX_MOTES; i++) {
      this._col.set(i % 3 === 0 ? '#fef08a' : '#7dd3fc');
      this.moteInst.setColorAt(i, this._col);
    }
    if (this.moteInst.instanceColor) this.moteInst.instanceColor.needsUpdate = true;
    this.scene.add(this.moteInst);
  }

  _loadPbrTextures() {
    if (typeof window === 'undefined' || typeof document === 'undefined') return;
    const loader = new THREE.TextureLoader();
    const loadTex = (url, isColor, repX, repY, onDone) => {
      loader.load(
        url,
        (t) => {
          if (this._disposed) {
            t.dispose();
            return;
          }
          if (repX > 0 && repY > 0) {
            t.wrapS = THREE.RepeatWrapping;
            t.wrapT = THREE.RepeatWrapping;
            t.repeat.set(repX, repY);
          }
          if (isColor) t.colorSpace = THREE.SRGBColorSpace;
          this._loadedTextures.push(t);
          onDone(t);
        },
        undefined,
        () => {}
      );
    };

    // Sunlit Aqueduct Sanctum Sky Backdrop
    loadTex('assets/textures/mg_bg_sanctum_sky.webp', true, 0, 0, (t) => {
      this.scene.background = t;
    });

    // Studio Weathered Ashlar Masonry for Sanctum Back Wall (replaces cartoon canvas brick!)
    loadTex('assets/textures/mg_pbr_sanctum_masonry_albedo.webp', true, 2.8, 1.4, (t) => {
      this.masonryMat.map = t;
      this.masonryMat.needsUpdate = true;
    });
    loadTex('assets/textures/mg_pbr_sanctum_masonry_normal.webp', false, 2.8, 1.4, (t) => {
      this.masonryMat.normalMap = t;
      this.masonryMat.needsUpdate = true;
    });

    // Carved Coral Travertine for Columns, Portal Arch, Floor Tiles, Lotus Plates, Pedestals
    loadTex('assets/textures/arch_coral_travertine_albedo.webp', true, 2, 2, (t) => {
      this.travMat.map = t;
      this.travMat.needsUpdate = true;
      this.tileMat.map = t;
      this.tileMat.needsUpdate = true;
    });
    loadTex('assets/textures/arch_coral_travertine_normal.webp', false, 2, 2, (t) => {
      this.travMat.normalMap = t;
      this.travMat.needsUpdate = true;
      this.tileMat.normalMap = t;
      this.tileMat.needsUpdate = true;
    });

    // Hammered Antique Bronze for Portal Jambs, Braziers, Bells, Turntables, Pipes, Tide-Lock Cages
    loadTex('assets/textures/arch_antique_bronze_albedo.webp', true, 2, 2, (t) => {
      this.brassMat.map = t;
      this.brassMat.needsUpdate = true;
      this.darkBronzeMat.map = t;
      this.darkBronzeMat.needsUpdate = true;
      this.pipeBrassMat.map = t;
      this.pipeBrassMat.needsUpdate = true;
      for (const s of this.tideLockSlots) {
        s.targetMat.map = t;
        s.targetMat.needsUpdate = true;
      }
    });
    loadTex('assets/textures/arch_antique_bronze_normal.webp', false, 2, 2, (t) => {
      this.brassMat.normalMap = t;
      this.brassMat.needsUpdate = true;
      this.darkBronzeMat.normalMap = t;
      this.darkBronzeMat.needsUpdate = true;
      this.pipeBrassMat.normalMap = t;
      this.pipeBrassMat.needsUpdate = true;
      for (const s of this.tideLockSlots) {
        s.targetMat.normalMap = t;
        s.targetMat.needsUpdate = true;
      }
    });

    // Carved Bayou Limestone for Monolith Cubes & Sanctum Plinth Base
    loadTex('assets/textures/arch_bayou_limestone_albedo.webp', true, 2, 2, (t) => {
      this.limestoneMat.map = t;
      this.limestoneMat.needsUpdate = true;
    });
    loadTex('assets/textures/arch_bayou_limestone_normal.webp', false, 2, 2, (t) => {
      this.limestoneMat.normalMap = t;
      this.limestoneMat.needsUpdate = true;
    });

    // Storm Basalt for Dark Relief Temple Portal Doors
    loadTex('assets/textures/arch_storm_basalt_albedo.webp', true, 1, 2, (t) => {
      this.basaltMat.map = t;
      this.basaltMat.needsUpdate = true;
    });
    loadTex('assets/textures/arch_storm_basalt_normal.webp', false, 1, 2, (t) => {
      this.basaltMat.normalMap = t;
      this.basaltMat.needsUpdate = true;
    });
  }

  _updateClueBoard(room) {
    if (!this.clueFriezeGroup) return;
    const p = room.puzzle;
    const show = Boolean(room.showTarget || room.isPeekingClue || room.solved);
    this.clueFriezeGroup.visible = show && (p.type === 'lights' || p.type === 'bells');
    if (!this.clueFriezeGroup.visible) return;

    const key = `${p.type}_${p.n || ''}_${(p.target || p.order || []).join(',')}`;
    if (this._lastClueKey === key) return;
    this._lastClueKey = key;

    const dm = this._dummy;
    let cnt = 0;
    if (p.type === 'lights' && p.target) {
      const n = p.n || 3;
      const step = n <= 3 ? 0.24 : 0.18;
      const x0 = -((n - 1) * step) * 0.5;
      const y0 = ((n - 1) * step) * 0.5;
      for (let i = 0; i < n * n && cnt < 16; i++) {
        const gx = i % n;
        const gy = (i / n) | 0;
        const px = x0 + gx * step;
        const py = y0 - gy * step;
        const isOn = Boolean(p.target[i]);
        const baseSc = n <= 3 ? 0.86 : 0.68;

        dm.position.set(px, py, 0.14);
        dm.rotation.set(0, 0, Math.PI * 0.25);
        dm.scale.setScalar(baseSc);
        dm.updateMatrix();
        this.clueBezelInst.setMatrixAt(cnt, dm.matrix);

        const gem = this.clueGems[cnt];
        gem.visible = true;
        gem.position.set(px, py, isOn ? 0.15 : 0.11);
        gem.rotation.set(0, 0, Math.PI * 0.25);
        gem.scale.setScalar(isOn ? baseSc * 1.04 : baseSc * 0.64);
        if (isOn) {
          gem.material.color.set('#e0f7ff');
          gem.material.emissive.set('#38bdf8');
          gem.material.emissiveIntensity = 1.55;
          gem.material.roughness = 0.10;
          gem.material.metalness = 0.24;
        } else {
          gem.material.color.set('#0f172a');
          gem.material.emissive.set('#000000');
          gem.material.emissiveIntensity = 0.0;
          gem.material.roughness = 0.88;
          gem.material.metalness = 0.12;
        }
        cnt++;
      }
    } else if (p.type === 'bells' && p.order) {
      const order = p.order;
      const spacing = 1.95 / Math.max(1, order.length);
      const startX = -((order.length - 1) * spacing) * 0.5;
      for (let i = 0; i < order.length && cnt < 16; i++) {
        const bell = room.bells?.[order[i]];
        const col = BELL_COLORS[bell?.color ?? order[i] % BELL_COLORS.length] || '#fde047';
        const px = startX + i * spacing;

        dm.position.set(px, 0, 0.14);
        dm.rotation.set(0, 0, 0);
        dm.scale.setScalar(1.38);
        dm.updateMatrix();
        this.clueBezelInst.setMatrixAt(cnt, dm.matrix);

        const gem = this.clueGems[cnt];
        gem.visible = true;
        gem.position.set(px, 0, 0.155);
        gem.rotation.set(0, 0, 0);
        gem.scale.setScalar(1.38);
        gem.material.color.set(col);
        gem.material.emissive.set(col);
        gem.material.emissiveIntensity = 0.92;
        gem.material.roughness = 0.14;
        gem.material.metalness = 0.26;
        cnt++;
      }
    }
    for (let i = cnt; i < this.clueGems.length; i++) {
      this.clueGems[i].visible = false;
    }
    this.clueBezelInst.count = cnt;
    if (cnt > 0) {
      this.clueBezelInst.instanceMatrix.needsUpdate = true;
    }
  }

  render(roomOrState, ctx = {}) {
    if (this._disposed || !this.webgl || !roomOrState) return;
    let room = roomOrState;
    let opts = ctx || {};
    if (room && !room.puzzle && (room.puzzleRoom || room.room)) {
      opts = room;
      room = room.puzzleRoom || room.room;
    }
    if (!room || !room.puzzle) return;

    const skin = opts.player?.skinId || opts.skinId || this.skinId;
    if (skin && skin !== this.skinId) this.setSkin(skin);

    const time = Number(opts.time ?? room.t) || 0;
    const dt = clamp(Number(opts.dt) || 0.016, 0.001, 0.05);
    const cols = room.cols || 5;
    const rows = room.rows || 5;
    const ox = (cols - 1) * 0.5;
    const oz = (rows - 1) * 0.5;

    // 1. Update Camera First — guarantees 100% of puzzle pieces (including `beam` side-wall emitters/receptors
    //    & outer `bells`) + stone architrave + 3D crystal clue frieze fit cleanly inside 16:9 & 412x915 Portrait!
    const v = room.view;
    if (v && v.eye && v.target) {
      const aspect = Math.max(0.35, this.width / Math.max(1, this.height));
      const portrait = aspect < 0.85;
      const kIn = room.phase === 'intro' ? 1 - smooth01((room.phaseT || 0) / INTRO_T) : 0;
      const camFov = (v.fov || 30) + (portrait ? 3 : 3.5);
      const tx = v.target[0];
      const ty = v.target[1] + (portrait ? 0.42 : 0.78);
      const tz = v.target[2] - (portrait ? 0.10 : 0.35);

      let zoomK = portrait ? 0.78 : 0.74;
      if (portrait) {
        const pTypeCam = room.type || room.puzzle.type;
        let maxAbsX = ox + 0.68;
        if (pTypeCam === 'beam') {
          if (room.source) maxAbsX = Math.max(maxAbsX, Math.abs(room.source.x - ox) + 0.64);
          if (room.crystal) maxAbsX = Math.max(maxAbsX, Math.abs(room.crystal.x - ox) + 0.64);
          const mirrors = room.mirrors || [];
          for (let i = 0; i < mirrors.length; i++) {
            maxAbsX = Math.max(maxAbsX, Math.abs(mirrors[i].x - ox) + 0.58);
          }
        } else if (pTypeCam === 'bells' && room.bells) {
          for (let i = 0; i < room.bells.length; i++) {
            maxAbsX = Math.max(maxAbsX, Math.abs(room.bells[i].x - ox) + 0.68);
          }
        }
        // Keep clue frieze & fluted portal columns comfortably inside Portrait safe width
        maxAbsX = Math.max(maxAbsX, 2.35);
        const rawDx = v.eye[0] - tx;
        const rawDy = v.eye[1] - ty;
        const rawDz = v.eye[2] - tz;
        const rawDist = Math.hypot(rawDx, rawDy, rawDz) || 1;
        const tanHalfH = Math.tan((camFov * 0.5) * (Math.PI / 180)) * aspect;
        const minDistH = maxAbsX / (0.91 * Math.max(0.08, tanHalfH)) + 1.45;
        zoomK = Math.max(zoomK, minDistH / rawDist);
      }

      const dx = (v.eye[0] - tx) * zoomK;
      const dy = (v.eye[1] - ty) * (zoomK * 0.94);
      const dz = (v.eye[2] - tz) * zoomK;
      const sh = (Number(opts.shake) || 0) * 0.018;
      const ex = tx + dx + Math.sin(time * 0.25) * 0.05 + (sh > 0 ? Math.sin(time * 67) * sh : 0);
      const ey = ty + dy - kIn * kIn * 1.0 + (sh > 0 ? Math.cos(time * 59) * sh : 0);
      const ez = tz + dz + kIn * kIn * 1.4;
      this.camera.position.set(ex, ey, ez);
      this.camera.lookAt(tx, ty, tz);
      this.camera.fov = camFov;
      this.camera.aspect = aspect;
      this.camera.updateProjectionMatrix();
    }
    const camQ = this.camera.quaternion;

    // 2. Scale Sanctum Plinth, Canal & Ornate Temple Portal Opening Animation
    const plW = (cols + 0.6) / 6.4;
    const plD = (rows + 0.8) / 6.4;
    this.islandBase.scale.set(plW, 1, plD);
    this.canalFrame.scale.set(plW, 1, plD);
    this.sanctumFrame.position.z = -oz + 3.1;

    const gateOpen = smooth01(room.gateOpen || 0);
    const prog = room.progressRatio || 0;
    this.gateDoorL.position.set(-0.51 - gateOpen * 0.88, 0.04, -4.06 - gateOpen * 0.18);
    this.gateDoorL.rotation.y = gateOpen * 0.68;
    this.gateDoorR.position.set(0.51 + gateOpen * 0.88, 0.04, -4.06 - gateOpen * 0.18);
    this.gateDoorR.rotation.y = -gateOpen * 0.68;
    this.portalRuneMat.opacity = 0.68 + prog * 0.25 + (room.solved ? 0.12 * Math.sin(time * 12) : 0.08 * Math.sin(time * 3.5));
    this.portalRuneMat.color.set(room.solved ? '#fde047' : '#5efce8');
    this.portalInnerMat.color.set(room.solved ? '#fef08a' : '#7dd3fc');

    for (let i = 0; i < this.rotaryValves.length; i++) {
      this.rotaryValves[i].rotation.z = time * (0.8 + prog * 2.8) * (i % 2 ? 1 : -1);
    }
    this._updateClueBoard(room);

    // 3. Position Sculpted Antique-Bronze Tripod Braziers outward (`ox + 1.38`, or `ox + 1.88` on `beam`!)
    //    so brazier flames NEVER obstruct `beam` side-wall emitters/receptors or waterfalls!
    const dm = this._dummy;
    const isBeamRoom = (room.type || room.puzzle.type) === 'beam';
    const brazierOutX = ox + (isBeamRoom ? 1.88 : 1.38);
    this.brazierEmberMat.emissiveIntensity = 1.45 + Math.sin(time * 11.5) * 0.22;
    let brVis = 0;
    for (let i = 0; i < MAX_VALVE_SCONCES; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      const bx = side * brazierOutX;
      const bz = -oz + 0.55 + (Math.floor(i / 2) / 2) * (rows - 1.55);
      if (isBeamRoom) {
        const srcX = room.source ? room.source.x - ox : 99;
        const srcZ = room.source ? room.source.y - oz : 99;
        const cryX = room.crystal ? room.crystal.x - ox : 99;
        const cryZ = room.crystal ? room.crystal.y - oz : 99;
        if (Math.hypot(bx - srcX, bz - srcZ) < 1.15 || Math.hypot(bx - cryX, bz - cryZ) < 1.15) continue;
      }

      dm.position.set(bx, 0, bz);
      dm.rotation.set(0, i * 1.1, 0);
      dm.scale.setScalar(1);
      dm.updateMatrix();
      this.brazierBodyInst.setMatrixAt(brVis, dm.matrix);
      this.brazierEmberInst.setMatrixAt(brVis, dm.matrix);

      // Soft organic flickering flame billboards facing camera (ZERO solid cones!)
      const flkA = Math.sin(time * 9.5 + i * 2.1) * 0.12 + Math.cos(time * 15.3 + i * 1.3) * 0.06;
      const flkB = Math.sin(time * 13.7 + i * 3.4) * 0.14;
      dm.position.set(bx + Math.sin(time * 6.5 + i) * 0.02, 1.18 + flkA * 0.14, bz);
      dm.quaternion.copy(camQ);
      dm.scale.set(0.95 + flkB * 0.35, 1.0 + flkA * 0.65, 1);
      dm.updateMatrix();
      this.brazierFlameOuterInst.setMatrixAt(brVis, dm.matrix);

      dm.position.set(bx - Math.sin(time * 8.2 + i) * 0.015, 1.12 + flkB * 0.10, bz);
      dm.quaternion.copy(camQ);
      dm.scale.set(0.88 - flkA * 0.25, 0.96 + flkB * 0.55, 1);
      dm.updateMatrix();
      this.brazierFlameInnerInst.setMatrixAt(brVis, dm.matrix);
      brVis++;
    }
    this.brazierBodyInst.count = brVis;
    this.brazierEmberInst.count = brVis;
    this.brazierFlameOuterInst.count = brVis;
    this.brazierFlameInnerInst.count = brVis;
    this.brazierBodyInst.instanceMatrix.needsUpdate = true;
    this.brazierEmberInst.instanceMatrix.needsUpdate = true;
    this.brazierFlameOuterInst.instanceMatrix.needsUpdate = true;
    this.brazierFlameInnerInst.instanceMatrix.needsUpdate = true;

    // 4. Build Travertine Floor Tile Grid + Entrance Threshold
    let tCnt = 0;
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols && tCnt < MAX_TILES; x++) {
        dm.position.set(x - ox, -0.08, y - oz);
        dm.rotation.set(0, 0, 0);
        dm.scale.setScalar(1);
        dm.updateMatrix();
        this._col.set((x + y) % 2 === 0 ? '#f0e7d6' : '#ddd1ba');
        this.tileInst.setColorAt(tCnt, this._col);
        this.tileInst.setMatrixAt(tCnt++, dm.matrix);
      }
    }
    if (tCnt < MAX_TILES) {
      dm.position.set((room.doorX ?? 2) - ox, -0.08, rows - oz);
      dm.rotation.set(0, 0, 0);
      dm.scale.setScalar(1);
      dm.updateMatrix();
      this._col.set('#d5e3ec');
      this.tileInst.setColorAt(tCnt, this._col);
      this.tileInst.setMatrixAt(tCnt++, dm.matrix);
    }
    this.tileInst.count = tCnt;
    this.tileInst.instanceMatrix.needsUpdate = true;
    if (this.tileInst.instanceColor) this.tileInst.instanceColor.needsUpdate = true;

    // 5. Reset All 6 Archetype Pools (`lights`, `bells`, `beam`, `blocks`, `pipes`, `tide_locks`)
    let lightCnt = 0;
    let lightLitCnt = 0;
    let lightOffCnt = 0;
    let bSegCnt = 0;
    let bFlareCnt = 0;
    let mirBaseCnt = 0;
    let blkCnt = 0;
    let sockCnt = 0;
    this.beamEmitter.visible = false;
    this.beamReceptor.visible = false;
    this.pipeIntake.visible = false;
    this.pipeBaseInst.count = 0;
    for (const k of ['straight', 'elbow', 'tee']) {
      this.pipeShapeInsts[k].bInst.count = 0;
      this.pipeShapeInsts[k].litInst.count = 0;
      this.pipeShapeInsts[k].offInst.count = 0;
    }
    for (const s of this.bellSlots) s.root.visible = false;
    for (const s of this.mirrorSlots) s.root.visible = false;
    for (const m of this.pipeOutflowSlots) m.visible = false;
    for (const s of this.tideLockSlots) s.root.visible = false;

    const pType = room.type || room.puzzle.type;
    if (pType === 'lights' && room.lit) {
      const n = room.n || room.puzzle.n || 3;
      const gx0 = room.puzzle.gx ?? 1;
      const gy0 = room.puzzle.gy ?? 1;
      for (let i = 0; i < n * n && lightCnt < MAX_TILES; i++) {
        const tx = gx0 + (i % n) - ox;
        const tz = gy0 + ((i / n) | 0) - oz;
        const isLit = Boolean(room.lit[i]);
        const liftY = isLit ? 0.025 + Math.sin(time * 4.5 + i) * 0.008 : 0.0;
        dm.position.set(tx, liftY, tz);
        dm.rotation.set(0, 0, 0);
        dm.scale.set(1, isLit ? 1.12 : 0.88, 1);
        dm.updateMatrix();
        this.lightStoneInst.setMatrixAt(lightCnt, dm.matrix);
        this.lightBronzeInst.setMatrixAt(lightCnt, dm.matrix);
        if (isLit) {
          this.lightCoreLitInst.setMatrixAt(lightLitCnt++, dm.matrix);
        } else {
          this.lightCoreOffInst.setMatrixAt(lightOffCnt++, dm.matrix);
        }
        lightCnt++;
      }
    } else if (pType === 'bells' && room.bells) {
      for (let i = 0; i < room.bells.length && i < MAX_BELLS; i++) {
        const b = room.bells[i];
        const slot = this.bellSlots[i];
        slot.root.visible = true;
        slot.root.position.set(b.x - ox, 0, b.y - oz);
        const colHex = BELL_COLORS[b.color % BELL_COLORS.length] || '#fde047';
        slot.enamelMat.color.set(colHex);
        slot.enamelMat.emissive.set(colHex);
        slot.badgeMat.color.set(colHex);
        slot.badgeMat.emissive.set(colHex);

        const age = time - (b.ringAt ?? -10);
        if (age >= 0 && age < 1.35) {
          const swing = Math.sin(age * 17.5) * Math.exp(-age * 2.8) * 0.46;
          slot.bellPiv.rotation.z = swing;
          slot.clapperPiv.rotation.z = Math.sin(age * 17.5 - 0.55) * Math.exp(-age * 2.6) * 0.28;
          slot.enamelMat.emissiveIntensity = 0.34 + (1 - age / 1.35) * 0.95;
          slot.waveRing.visible = true;
          const wt = age / 1.35;
          slot.waveRing.scale.setScalar(0.55 + wt * 2.45);
          slot.waveRing.position.y = 0.72 - wt * 0.32;
          slot.waveMat.opacity = (1 - wt) * (1 - wt) * 0.92;
          slot.waveMat.color.set(colHex);
        } else {
          slot.bellPiv.rotation.z = Math.sin(time * 1.4 + i) * 0.025;
          slot.clapperPiv.rotation.z = 0;
          slot.enamelMat.emissiveIntensity = 0.22;
          slot.waveRing.visible = false;
        }
      }
    } else if (pType === 'beam') {
      if (room.source) {
        this.beamEmitter.visible = true;
        this.beamEmitter.position.set(room.source.x - ox, 0, room.source.y - oz);
      }
      if (room.crystal) {
        this.beamReceptor.visible = true;
        this.beamReceptor.position.set(room.crystal.x - ox, 0, room.crystal.y - oz);
        this.recCrystal.position.y = BEAM_Y + Math.sin(time * 3.2) * 0.06;
        this.recCrystal.rotation.y = time * 2.2;
        this.recGimbal.rotation.set(time * 1.1, time * 1.6, 0);
      }
      const mirrors = room.mirrors || [];
      for (let i = 0; i < mirrors.length && i < MAX_MIRRORS; i++) {
        const m = mirrors[i];
        const mx = m.x - ox;
        const mz = m.y - oz;
        dm.position.set(mx, 0, mz);
        dm.rotation.set(0, 0, 0);
        dm.scale.setScalar(1);
        dm.updateMatrix();
        this.mirrorBaseInst.setMatrixAt(mirBaseCnt++, dm.matrix);

        const slot = this.mirrorSlots[i];
        slot.root.visible = true;
        slot.root.position.set(mx, 0, mz);
        slot.turret.rotation.y = -(m.angle ?? 0);
      }
      const bm = room.beam;
      if (bm && bm.n >= 2 && bm.pts) {
        const pulseW = 1.0 + Math.sin(time * 14) * 0.14;
        for (let i = 0; i < bm.n - 1 && bSegCnt < MAX_BEAM_SEGS; i++) {
          const x0 = bm.pts[i * 2] - ox;
          const z0 = bm.pts[i * 2 + 1] - oz;
          const x1 = bm.pts[(i + 1) * 2] - ox;
          const z1 = bm.pts[(i + 1) * 2 + 1] - oz;
          const dx = x1 - x0;
          const dz = z1 - z0;
          const len = Math.hypot(dx, dz);
          if (len < 0.01) continue;
          const yaw = Math.atan2(dx, dz);
          dm.position.set(x0, BEAM_Y, z0);
          dm.rotation.set(0, yaw, 0);
          dm.scale.set(1, 1, len);
          dm.updateMatrix();
          this.beamCoreInst.setMatrixAt(bSegCnt, dm.matrix);

          dm.scale.set(pulseW, pulseW, len);
          dm.updateMatrix();
          this.beamHaloInst.setMatrixAt(bSegCnt, dm.matrix);
          bSegCnt++;

          if (bFlareCnt < MAX_BEAM_SEGS) {
            dm.position.set(x1, BEAM_Y, z1);
            dm.quaternion.copy(camQ);
            dm.scale.setScalar(0.85 + Math.sin(time * 12 + i) * 0.18);
            dm.updateMatrix();
            this.beamFlareInst.setMatrixAt(bFlareCnt++, dm.matrix);
          }
        }
      }
    } else if (pType === 'blocks') {
      const plates = room.plates || [];
      for (let i = 0; i < plates.length && sockCnt < MAX_PLATES; i++) {
        const pl = plates[i];
        dm.position.set(pl.x - ox, 0, pl.y - oz);
        dm.rotation.set(0, 0, 0);
        dm.scale.setScalar(1);
        dm.updateMatrix();
        this.socketBronzeInst.setMatrixAt(sockCnt, dm.matrix);
        this.socketCoreInst.setMatrixAt(sockCnt, dm.matrix);
        this._col.set(pl.pressed > 0.5 ? '#34d399' : '#f59e0b');
        this.socketCoreInst.setColorAt(sockCnt, this._col);
        sockCnt++;
      }
      const blocks = room.blocks || [];
      for (let i = 0; i < blocks.length && blkCnt < MAX_BLOCKS; i++) {
        const bl = blocks[i];
        dm.position.set((bl.px ?? bl.x) - ox, 0, (bl.py ?? bl.y) - oz);
        dm.rotation.set(0, 0, 0);
        dm.scale.setScalar(1);
        dm.updateMatrix();
        this.blockStoneInst.setMatrixAt(blkCnt, dm.matrix);
        this.blockBronzeInst.setMatrixAt(blkCnt, dm.matrix);
        this.blockRuneInst.setMatrixAt(blkCnt, dm.matrix);
        blkCnt++;
      }
      this.blockRuneMat.opacity = 0.78 + Math.sin(time * 4.2) * 0.14;
    } else if (pType === 'pipes' && room.pipes) {
      if (room.pipeSource) {
        this.pipeIntake.visible = true;
        this.pipeIntake.position.set(room.pipeSource.x - ox, 0, room.pipeSource.y - oz);
      }
      const targets = room.pipeTargets || [];
      for (let i = 0; i < targets.length && i < this.pipeOutflowSlots.length; i++) {
        const t = targets[i];
        const m = this.pipeOutflowSlots[i];
        m.visible = true;
        m.position.set(t.x - ox, 0, t.y - oz);
      }
      this.pipeFlowLitMat.emissiveIntensity = 1.35 + Math.sin(time * 7) * 0.22;
      const pipes = room.pipes;
      let pbCnt = 0;
      for (let i = 0; i < pipes.length && i < MAX_PIPES; i++) {
        const p = pipes[i];
        const px = p.x - ox;
        const pz = p.y - oz;
        dm.position.set(px, 0.04, pz);
        dm.rotation.set(0, 0, 0);
        dm.scale.setScalar(1);
        dm.updateMatrix();
        this.pipeBaseInst.setMatrixAt(pbCnt++, dm.matrix);

        const shapeKey = p.shape === 'elbow' || p.shape === 'tee' ? p.shape : 'straight';
        const bucket = this.pipeShapeInsts[shapeKey];
        const rotY = -(p.angle ?? (p.rot || 0) * Math.PI * 0.5);
        dm.position.set(px, 0.18, pz);
        dm.rotation.set(0, rotY, 0);
        dm.scale.setScalar(1);
        dm.updateMatrix();
        const lit = Boolean(p.pressurized);
        this._col.set(lit ? '#f2c166' : '#ba8d4d');
        bucket.bInst.setColorAt(bucket.bInst.count, this._col);
        bucket.bInst.setMatrixAt(bucket.bInst.count++, dm.matrix);
        if (lit) {
          bucket.litInst.setMatrixAt(bucket.litInst.count++, dm.matrix);
        } else {
          bucket.offInst.setMatrixAt(bucket.offInst.count++, dm.matrix);
        }
      }
      this.pipeBaseInst.count = pbCnt;
      if (pbCnt > 0) this.pipeBaseInst.instanceMatrix.needsUpdate = true;
      for (const k of ['straight', 'elbow', 'tee']) {
        const b = this.pipeShapeInsts[k];
        if (b.bInst.count > 0) {
          b.bInst.instanceMatrix.needsUpdate = true;
          if (b.bInst.instanceColor) b.bInst.instanceColor.needsUpdate = true;
        }
        if (b.litInst.count > 0) b.litInst.instanceMatrix.needsUpdate = true;
        if (b.offInst.count > 0) b.offInst.instanceMatrix.needsUpdate = true;
      }
    } else if (pType === 'tide_locks' && room.chambers) {
      const maxLvl = Math.max(1, room.maxLevel || 3);
      for (let i = 0; i < room.chambers.length && i < MAX_TIDE_LOCKS; i++) {
        const ch = room.chambers[i];
        const slot = this.tideLockSlots[i];
        slot.root.visible = true;
        slot.root.position.set(ch.x - ox, 0, ch.y - oz);
        const curRatio = clamp((ch.displayLevel ?? ch.level ?? 0) / maxLvl, 0.05, 1.0);
        const tgtRatio = clamp((ch.target ?? 1) / maxLvl, 0.1, 1.0);
        const waterH = 0.12 + curRatio * 1.38;
        slot.waterCol.scale.set(1, waterH, 1);
        slot.meniscus.position.y = 0.24 + waterH + 0.01;
        slot.targetRing.position.y = 0.30 + tgtRatio * 1.36;
        slot.valveWheel.rotation.z = curRatio * TAU * 1.5 + time * 0.45;
        const matched = ch.level === ch.target;
        slot.targetMat.color.set(matched ? '#10b981' : '#d9a441');
        slot.targetMat.emissive.set(matched ? '#065f46' : '#382206');
        slot.targetMat.emissiveIntensity = matched ? 0.55 : 0.22;
        slot.waterMat.emissiveIntensity = matched ? 1.55 : 0.92 + Math.sin(time * 4.2 + i) * 0.15;
      }
    }

    // Commit Instanced Counts & Buffers
    this.lightStoneInst.count = lightCnt;
    this.lightBronzeInst.count = lightCnt;
    this.lightCoreLitInst.count = lightLitCnt;
    this.lightCoreOffInst.count = lightOffCnt;
    if (lightCnt > 0) {
      this.lightStoneInst.instanceMatrix.needsUpdate = true;
      this.lightBronzeInst.instanceMatrix.needsUpdate = true;
    }
    if (lightLitCnt > 0) this.lightCoreLitInst.instanceMatrix.needsUpdate = true;
    if (lightOffCnt > 0) this.lightCoreOffInst.instanceMatrix.needsUpdate = true;

    this.mirrorBaseInst.count = mirBaseCnt;
    if (mirBaseCnt > 0) this.mirrorBaseInst.instanceMatrix.needsUpdate = true;

    this.beamCoreInst.count = bSegCnt;
    this.beamHaloInst.count = bSegCnt;
    this.beamFlareInst.count = bFlareCnt;
    if (bSegCnt > 0) {
      this.beamCoreInst.instanceMatrix.needsUpdate = true;
      this.beamHaloInst.instanceMatrix.needsUpdate = true;
    }
    if (bFlareCnt > 0) this.beamFlareInst.instanceMatrix.needsUpdate = true;

    this.blockStoneInst.count = blkCnt;
    this.blockBronzeInst.count = blkCnt;
    this.blockRuneInst.count = blkCnt;
    if (blkCnt > 0) {
      this.blockStoneInst.instanceMatrix.needsUpdate = true;
      this.blockBronzeInst.instanceMatrix.needsUpdate = true;
      this.blockRuneInst.instanceMatrix.needsUpdate = true;
    }

    this.socketBronzeInst.count = sockCnt;
    this.socketCoreInst.count = sockCnt;
    if (sockCnt > 0) {
      this.socketBronzeInst.instanceMatrix.needsUpdate = true;
      this.socketCoreInst.instanceMatrix.needsUpdate = true;
      if (this.socketCoreInst.instanceColor) this.socketCoreInst.instanceColor.needsUpdate = true;
    }

    // 6. Update Gateway Heroine Position, Grounded Contact Shadow, Facing & Pose
    const gw = room.gateway || room.hero || room.player;
    if (gw) {
      const hx = (gw.px ?? gw.x ?? 0) - ox;
      const hz = (gw.py ?? gw.y ?? 0) - oz;
      const hy = Math.max(0, gw.hop || 0) * 0.48;
      const dirYaws = [Math.PI * 0.5, 0, -Math.PI * 0.5, Math.PI];
      const targetYaw = dirYaws[(gw.facing ?? 3) & 3];
      let dYaw = ((targetYaw - this._heroYaw + Math.PI) % TAU) - Math.PI;
      if (dYaw < -Math.PI) dYaw += TAU;
      this._heroYaw += dYaw * Math.min(1, dt * 14);

      const vis = (gw.alpha ?? 1) > 0.05;
      this.hero.group.visible = vis;
      this.hero.group.position.set(hx, hy, hz);
      this.hero.group.rotation.y = this._heroYaw;
      this.heroContactAo.visible = vis;
      this.heroContactAo.position.set(hx, 0.015, hz);
      this.heroContactAo.scale.setScalar(clamp(1 - hy * 0.45, 0.55, 1.0));
      this.hero.update(dt, {
        time,
        vx: gw.moving ? 2.6 : 0,
        vy: hy > 0.02 ? 1.5 : 0,
        onGround: hy <= 0.02,
        anim: room.solved ? 'Celebrate' : hy > 0.02 ? 'AirRise' : gw.moving ? 'Walk' : 'IdleBreathe',
        victory: Boolean(room.solved),
      });
    }

    // 7. Solved Harmonic Seed Reward Orb & Crown Seal Surge
    if (room.solved) {
      const pulse = (time * 1.45) % 1;
      this.rewardOrb.visible = true;
      this.rewardOrb.position.set(0, 1.32 + Math.sin(time * 3.5) * 0.14, 0);
      this.rewardOrb.rotation.set(time * 1.8, time * 2.6, 0);
      this.sealShatterRing.visible = true;
      this.sealShatterRing.position.set(0, 0.25 + pulse * 1.15, 0);
      this.sealShatterRing.scale.setScalar(0.8 + pulse * 3.2);
      this.sealShatterRing.material.opacity = (1 - pulse) * 0.85;
      this.solveLight.color.set('#fde047');
      this.solveLight.intensity = 2.8 + Math.sin(time * 10) * 0.6;
    } else {
      this.rewardOrb.visible = false;
      this.sealShatterRing.visible = false;
      this.solveLight.color.set('#5efce8');
      this.solveLight.intensity = 1.2 + prog * 1.0;
    }

    // 8. Billboarded Soft Radial Water-Mote & Golden Pollen Sprites
    for (let i = 0; i < MAX_MOTES; i++) {
      const mx = Math.sin(i * 1.7 + time * 0.35) * 4.2;
      const my = 0.25 + ((i * 0.19 + time * 0.28) % 3.2);
      const mz = Math.cos(i * 2.3 + time * 0.3) * 4.2;
      dm.position.set(mx, my, mz);
      dm.quaternion.copy(camQ);
      dm.scale.setScalar(0.72 + Math.sin(time * 3.2 + i) * 0.28);
      dm.updateMatrix();
      this.moteInst.setMatrixAt(i, dm.matrix);
    }
    this.moteInst.count = MAX_MOTES;
    this.moteInst.instanceMatrix.needsUpdate = true;

    // 9. Animated Water Caustic, Ripple Normal, Waterfall & Pipe Sight-Gauge Flow Scroll
    this.causticWaterTex.offset.set((time * 0.03) % 1, (time * 0.02) % 1);
    this.waterNormalTex.offset.set((-time * 0.038) % 1, (time * 0.026) % 1);
    this.waterfallTex.offset.y = (time * 1.35) % 1;
    this.pipeFlowTex.offset.set((-time * 0.85) % 1, (time * 0.35) % 1);
    if (this.waterWebp) {
      this.waterWebp.offset.set((time * 0.035) % 1, (time * 0.025) % 1);
    }

    this.webgl.setRenderTarget(null);
    this.webgl.render(this.scene, this.camera);
  }

  dispose() {
    if (this._disposed) return;
    this._disposed = true;
    this.hero?.dispose();
    this._flatNormalTex?.dispose();
    this._stonePlaceholder?.dispose();
    this._limestonePlaceholder?.dispose();
    this._basaltPlaceholder?.dispose();
    this._bronzePlaceholder?.dispose();
    this.causticWaterTex?.dispose();
    this.waterNormalTex?.dispose();
    this.waterfallTex?.dispose();
    this.flameTex?.dispose();
    this.emberTex?.dispose();
    this.moteGlowTex?.dispose();
    this.portalRuneTex?.dispose();
    this.portalInnerGlowTex?.dispose();
    this.lotusRuneTex?.dispose();
    this.soundWaveTex?.dispose();
    this.monolithRuneTex?.dispose();
    this.pipeFlowTex?.dispose();
    this._aoTex?.dispose();
    this.clueTex?.dispose();
    for (const t of this._loadedTextures) t.dispose();
    this._loadedTextures.length = 0;
  }
}

export { PuzzleRenderer as SanctumPuzzleRenderer };
export default PuzzleRenderer;
