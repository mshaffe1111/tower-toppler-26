// ============================================================================
// TOWER TOPPLER '26 — LEAD GRAPHICS COMPOSITOR (`src/renderer.js`)
// Composes all 8 dedicated WebGL2 Dual-Era ('reboot' & 'original') subsystems:
//   1. `CinematicPostFX` (`./postfx.js`): 4-pass HDR ACES Filmic + Selective Bloom + Vignette
//   2. `StormAtmosphere` (`./stormSky.js`): GLSL Moonlit Storm Sky Dome, Clouds, Fireflies & Weather
//   3. `Ocean` (`./water.js`): Real-time Planar-Reflecting GLSL Fresnel Ocean & Moon Glitter
//   4. `TowerFluidAndSparkVFX` (`./oceanVfx.js`): Surf Apron, Sea-Spray, Mist & Ballistic Sparks
//   5. `towerArchitecture.js`: Curved Beveled 3D Masonry `InstancedMesh` Courses, Ledges & Lifts
//   6. `EnemyVisualPool` (`./enemyRig.js`): `.glb` + Articulated Procedural Creatures & Cryo-Ice Blocks
//   7. `SubRenderer` (`./subRenderer.js`): Living Caustics, 124-Boid Fauna, `reboot_sub_mk7.glb` + `PogoRig`
//   8. `SkimmerRenderer`, `VaultRenderer`, `GlideRenderer`, `PuzzleRenderer`: Full 3D Mini-Stages
// ============================================================================

import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { mergeGeometries as _rawMergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { PogoRig } from './pogo.js';
import { COLS } from './levels.js';
import { GlideRenderer } from './glideRenderer.js';
import { PuzzleRenderer } from './puzzleRenderer.js';
import { CinematicPostFX } from './postfx.js';
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

const TWO_PI = Math.PI * 2;
const COL_ANGLE = TWO_PI / COLS;
const TOWER_RADIUS = 2.55;
const FLOOR_HEIGHT = 1.0;
const STEP_ORIGINAL = 0.43; // Authentic 1987/7800 step-row world height (ORIGIN_CLASSIC_AUDIT.md §3.3)

const BLASTER_FX_STYLES = {
  standard_cryo: {
    core: '#e0f2fe',
    emissive: '#38bdf8',
    muzzle: '#7dd3fc',
    trail: '#bae6fd',
    ring: null,
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
    emissive: '#f97316',
    muzzle: '#fbbf24',
    trail: '#fdba74',
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
  retro_voxel: {
    core: '#ffffff',
    emissive: '#22d3ee',
    muzzle: '#fde047',
    trail: '#67e8f9',
    ring: null,
    shape: 'voxel',
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

const CRYO_DEFAULT_HEXES = new Set([
  '#e0f2fe',
  '#bae6fd',
  '#7dd3fc',
  '#38bdf8',
  '#67e8f9',
  '#a5f3fc',
  '#cffafe',
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

function getTowerStepHeight(tower, isOrig) {
  return isOrig && tower?.real ? STEP_ORIGINAL : FLOOR_HEIGHT;
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
    out.x = (shake.x || 0) * 0.022;
    out.y = (shake.y || 0) * 0.022;
    return out;
  }
  const mag = (Number(shake) || 0) * 0.022;
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
  g.addColorStop(0.28, 'rgba(220, 252, 255, 0.78)');
  g.addColorStop(0.62, 'rgba(125, 235, 255, 0.22)');
  g.addColorStop(1, 'rgba(125, 235, 255, 0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createRelicTabletTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 192;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#091322';
  ctx.fillRect(0, 0, 128, 192);

  // Outer etched circuit-rune border
  ctx.strokeStyle = '#5efce8';
  ctx.lineWidth = 3;
  ctx.strokeRect(10, 10, 108, 172);
  ctx.strokeStyle = 'rgba(250, 204, 21, 0.75)';
  ctx.lineWidth = 1.6;
  ctx.strokeRect(17, 17, 94, 158);

  // Central Nebulus Monolith & Hologram Eye Emblem
  ctx.strokeStyle = '#5efce8';
  ctx.lineWidth = 3.2;
  ctx.beginPath();
  ctx.arc(64, 62, 22, 0, TWO_PI);
  ctx.stroke();

  ctx.fillStyle = '#fde047';
  ctx.beginPath();
  ctx.moveTo(64, 46);
  ctx.lineTo(76, 62);
  ctx.lineTo(64, 78);
  ctx.lineTo(52, 62);
  ctx.closePath();
  ctx.fill();

  // Etched Destructo Inc. data log glyph bars
  const rows = [102, 116, 130, 144, 158];
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
  canvas.width = 256;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  ctx.font = '900 28px Orbitron, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineWidth = 7;
  ctx.strokeStyle = 'rgba(2, 6, 23, 0.94)';
  ctx.strokeText(text, 128, 32);
  ctx.fillStyle = color || '#fde047';
  ctx.fillText(text, 128, 32);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export class GameRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.width = 360;
    this.height = 540;
    this.era = 'reboot';
    this.skinId = 'default_amphibian';
    this.blasterFxId = 'standard_cryo';
    this.cutsceneCam = null;
    this._cutscenePhaseSmooth = 0;
    this._lastCutsceneKind = '';
    this._lastTime = 0;
    this._skyStateProxy = {};

    // Adaptive Dynamic Resolution Scaling (Auto-DPR for locked 60fps on mobile)
    this.maxDpr = Math.min((typeof window !== 'undefined' && window.devicePixelRatio) || 1, 1.75);
    this.currentDpr = this.maxDpr;
    this._frameEmaMs = 16.6;
    this._slowFrameCount = 0;
    this._lastPerfNow = 0;

    // Delegated specialist stage renderers ('submarine', 'skimmer', 'glide', 'puzzle', 'vault')
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
    this.webgl.toneMappingExposure = 0.98;
    this.webgl.shadowMap.enabled = true;
    this.webgl.shadowMap.type = THREE.PCFSoftShadowMap;
    this.webgl.shadowMap.autoUpdate = false;
    this.webgl.setPixelRatio(this.currentDpr);

    this._initEnvironment();
    this._initSharedAssets();
    this._initTowerScene();
    this._initPostProcessing();
    this._loadBlenderAssets();
  }

  _ensureSubRenderer() {
    if (this.subRenderer) return this.subRenderer;
    this.subRenderer = new SubRenderer(this.webgl, {
      softDotTex: this.glowDotTex,
      era: this.era,
      skinId: this.skinId,
      blasterFxId: this.blasterFxId,
      showHud: false,
    });
    this.subRenderer.resize?.(this.width, this.height);
    this.subRenderer.setEra?.(this.era);
    this.subRenderer.setSkin?.(this.skinId);
    this.subRenderer.setBlasterFx?.(this.blasterFxId);
    return this.subRenderer;
  }

  _ensureGlideRenderer() {
    if (this.glideRenderer) return this.glideRenderer;
    this.glideRenderer = new GlideRenderer(this.webgl, {
      softDotTex: this.glowDotTex,
      skinId: this.skinId,
      era: this.era,
    });
    this.glideRenderer.resize?.(this.width, this.height, this.currentDpr);
    this.glideRenderer.setEra?.(this.era);
    this.glideRenderer.setSkin?.(this.skinId);
    this.glideRenderer.prewarm?.();
    return this.glideRenderer;
  }

  _ensurePuzzleRenderer() {
    if (this.puzzleRenderer) return this.puzzleRenderer;
    this.puzzleRenderer = new PuzzleRenderer(this.webgl, {
      softDotTex: this.glowDotTex,
      skinId: this.skinId,
      era: this.era,
    });
    this.puzzleRenderer.resize?.(this.width, this.height, this.currentDpr);
    this.puzzleRenderer.setEra?.(this.era);
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
      era: this.era,
      skinId: this.skinId,
      blasterFxId: this.blasterFxId,
      envMap: this.envTex,
      softDotTex: this.glowDotTex,
    });
    this.skimmerRenderer.resize?.(this.width, this.height, this.currentDpr);
    this.skimmerRenderer.setEra?.(this.era);
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
      era: this.era,
      envMap: this.envTex,
      softDotTex: this.glowDotTex,
    });
    this.vaultRenderer.resize?.(this.width, this.height, this.currentDpr);
    this.vaultRenderer.setEra?.(this.era);
    this.vaultRenderer.prewarm?.();
    return this.vaultRenderer;
  }

  _initEnvironment() {
    this.envTex = null;
    try {
      const pmrem = new THREE.PMREMGenerator(this.webgl);
      const roomEnv = new RoomEnvironment();
      this.envTex = pmrem.fromScene(roomEnv, 0.04).texture;
      roomEnv.dispose();
      pmrem.dispose();
    } catch {
      this.envTex = null;
    }
  }

  _initSharedAssets() {
    this.glowDotTex = createGlowDotTexture();
    this.relicTabletTex = createRelicTabletTexture();

    this.sharedParticleGeo = new THREE.BoxGeometry(0.13, 0.13, 0.13);
    this.sharedSnowballGeo = new THREE.IcosahedronGeometry(0.15, 1);
    this.sharedVoxelGeo = new THREE.BoxGeometry(0.21, 0.21, 0.21);
    this.sharedPrismGeo = new THREE.OctahedronGeometry(0.185, 0);
    this.sharedFxRingGeo = new THREE.TorusGeometry(0.23, 0.018, 6, 20);
    this.sharedTrailDotGeo = new THREE.SphereGeometry(0.065, 8, 8);

    // Merged single-draw-call comet trail cluster (1 draw call instead of 3 per snowball!)
    const trailParts = [];
    const orbitParts = [];
    for (let t = 1; t <= 3; t++) {
      const sc = 1.0 - t * 0.22;
      const tp = new THREE.SphereGeometry(0.065 * sc, 8, 8);
      tp.translate(-t * 0.145, 0, -0.02 * t);
      trailParts.push(tp);

      const ang = ((t - 1) * TWO_PI) / 3;
      const op = new THREE.SphereGeometry(0.065 * sc, 8, 8);
      op.translate(Math.cos(ang) * 0.24, Math.sin(ang) * 0.09, Math.sin(ang) * 0.2);
      orbitParts.push(op);
    }
    this.sharedTrailClusterGeo = mergeRigidGeos(trailParts);
    this.sharedOrbitalTrailGeo = mergeRigidGeos(orbitParts);
    this.sharedTrailClusterGeo.userData.shared = true;
    this.sharedOrbitalTrailGeo.userData.shared = true;

    // Merged single-draw-call Golden Gear geometry (1 draw call instead of 7!)
    const gearParts = [new THREE.TorusGeometry(0.17, 0.055, 8, 16)];
    for (let t = 0; t < 6; t++) {
      const ang = (t / 6) * TWO_PI;
      const tg = new THREE.BoxGeometry(0.06, 0.08, 0.06);
      tg.rotateZ(ang);
      tg.translate(Math.cos(ang) * 0.22, Math.sin(ang) * 0.22, 0);
      gearParts.push(tg);
    }
    this.sharedGearGeo = mergeRigidGeos(gearParts);
    this.sharedGearGeo.userData.shared = true;
    this.sharedGearMat = new THREE.MeshStandardMaterial({
      color: '#fbbf24',
      emissive: '#b45309',
      emissiveIntensity: 0.55,
      metalness: 0.85,
      roughness: 0.2,
    });
    this.sharedGearMat.userData.shared = true;

    for (const g of [
      this.sharedParticleGeo,
      this.sharedSnowballGeo,
      this.sharedVoxelGeo,
      this.sharedPrismGeo,
      this.sharedFxRingGeo,
      this.sharedTrailDotGeo,
    ]) {
      g.userData.shared = true;
    }

    this.sharedSnowballMat = new THREE.MeshStandardMaterial({
      color: '#e0f2fe',
      emissive: '#38bdf8',
      emissiveIntensity: 1.4,
      roughness: 0.12,
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
      opacity: 0.58,
    });
    this.sharedHaloSpriteMat = new THREE.SpriteMaterial({
      map: this.glowDotTex,
      color: '#7dd3fc',
      transparent: true,
      opacity: 0.62,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    for (const m of [
      this.sharedSnowballMat,
      this.sharedFxRingMat,
      this.sharedTrailDotMat,
      this.sharedHaloSpriteMat,
    ]) {
      m.userData.shared = true;
    }

    this.popupPool = [];
    this._skyBaseReboot = new THREE.Color('#060a14');
    this._fogBaseReboot = new THREE.Color('#0b1526');
    this._skyBaseOrig = new THREE.Color('#040a20');
    this._fogBaseOrig = new THREE.Color('#071430');
    this._tempColor = new THREE.Color();
    this._prismColor = new THREE.Color();

    // Zero-allocation per-frame scratch math objects
    this._ndcVec = new THREE.Vector3();
    this._rayDir = new THREE.Vector3();
    this._shakeVec = { x: 0, y: 0 };
    this._worldPt = { x: 0, y: 0 };
    this._debrisDummy = new THREE.Object3D();

    this.glbModels = {};
    this._rebootPropsVersion = 0;
    this._collectibleMats = new Map();
  }

  _prepareGlbScene(scene) {
    // Clamp HDR emission strengths and mark shared GLB templates so cache eviction never disposes live programs
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

    // Tower architectural props (`enemyRig`, `subRenderer`, `skimmerRenderer`, `glideRenderer`, `puzzleRenderer`
    // manage and cache their own `.glb` assets directly to eliminate duplicate network/VRAM loads)
    const specs = [
      { key: 'corbel_ledge', url: 'assets/models/corbel_ledge.glb' },
      { key: 'cage_elevator', url: 'assets/models/cage_elevator.glb' },
    ];

    for (const sp of specs) {
      loader.load(
        sp.url,
        (gltf) => {
          if (!gltf || !gltf.scene) return;
          this.glbModels[sp.key] = this._prepareGlbScene(gltf.scene);
          this._rebootPropsVersion++;
        },
        undefined,
        () => {
          // Graceful procedural fallback when running offline
        }
      );
    }
  }

  _initPostProcessing() {
    this.postfx = null;
    try {
      this.postfx = new CinematicPostFX(this.webgl, this.width, this.height, this.currentDpr);
      this.postfx.setEra(this.era);
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

  setEra(era) {
    const next = era === 'original' ? 'original' : 'reboot';
    if (this.era === next) return;
    this.era = next;
    const isOrig = next === 'original';

    this.webgl.toneMappingExposure = isOrig ? 1.06 : 0.98;
    if (this.towerScene) {
      this.towerScene.environmentIntensity = isOrig ? 0.52 : 0.14;
    }
    if (this.postfx) this.postfx.setEra(next);
    if (this.stormSky) this.stormSky.setEra(next);
    if (this.ocean) this.ocean.setEra(next, this._lastOceanBiome || 'moonlit_storm');
    if (this.oceanVfx) this.oceanVfx.setEra(next);
    if (this.enemyVisuals) this.enemyVisuals.setEra(next);
    if (this.pogoRig) this.pogoRig.setEraStyle(next);
    this.subRenderer?.setEra?.(next);
    this.glideRenderer?.setEra?.(next);
    this.puzzleRenderer?.setEra?.(next);
    this.skimmerRenderer?.setEra?.(next);
    this.vaultRenderer?.setEra?.(next);
  }

  setSkin(skinId) {
    if (!skinId || this.skinId === skinId) return;
    this.skinId = skinId;
    if (this.pogoRig) this.pogoRig.setSkin(skinId);
    this.subRenderer?.setSkin?.(skinId);
    this.glideRenderer?.setSkin?.(skinId);
    this.puzzleRenderer?.setSkin?.(skinId);
    this.skimmerRenderer?.setSkin?.(skinId);
  }

  setBlasterFx(fxId) {
    const resolved = fxId && BLASTER_FX_STYLES[fxId] ? fxId : 'standard_cryo';
    this.blasterFxId = resolved;
    this.subRenderer?.setBlasterFx?.(resolved);
    this.skimmerRenderer?.setBlasterFx?.(resolved);
  }

  setCutsceneCam(cfg = null) {
    this.cutsceneCam = cfg && cfg.active ? cfg : null;
  }

  _syncBlasterFxMaterials(time = 0) {
    const fx = BLASTER_FX_STYLES[this.blasterFxId] || BLASTER_FX_STYLES.standard_cryo;
    if (fx.prismatic) {
      const hue = (time * 0.42) % 1;
      this._prismColor.setHSL(hue, 0.92, 0.68);
      this.sharedSnowballMat.color.set('#ffffff');
      this.sharedSnowballMat.emissive.copy(this._prismColor);
      this.sharedHaloSpriteMat.color.copy(this._prismColor);
      this.sharedTrailDotMat.color.setHSL((hue + 0.16) % 1, 0.9, 0.72);
      this.sharedFxRingMat.color.setHSL((hue + 0.48) % 1, 0.95, 0.65);
    } else {
      this.sharedSnowballMat.color.set(fx.core);
      this.sharedSnowballMat.emissive.set(fx.emissive);
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
    this.width = w;
    this.height = h;
    this.maxDpr = Math.min(dpr, 1.75);
    this.currentDpr = this.maxDpr;
    this._slowFrameCount = 0;
    this._frameEmaMs = 16.6;
    this._applyPixelRatio(this.currentDpr);

    const aspect = Math.max(0.4, w / Math.max(1, h));
    if (this.towerCam) {
      this.towerCam.aspect = aspect;
      this.towerCam.updateProjectionMatrix();
    }
  }

  renderScene(state) {
    if (!state) return;
    this._trackFramePerformance();
    if (state.era && state.era !== this.era) {
      this.setEra(state.era);
    }
    if (state.player?.skinId && state.player.skinId !== this.skinId) {
      this.setSkin(state.player.skinId);
    }
    const nextFx = state.player?.blasterFxId || state.blasterFxId;
    if (nextFx && nextFx !== this.blasterFxId) {
      this.setBlasterFx(nextFx);
    }
    const activeMode = state.mode === 'paused' ? (state.pausedFrom || 'tower') : state.mode;
    if (activeMode === 'submarine') {
      this.renderSubmarineScene(state);
    } else if (activeMode === 'skimmer') {
      this.renderSkimmerScene(state);
    } else if (activeMode === 'glide') {
      this.renderGlideScene(state);
    } else if (activeMode === 'puzzle') {
      this.renderPuzzleScene(state);
    } else if (activeMode === 'vault') {
      this.renderVaultScene(state);
    } else if (state.tower) {
      this.renderTowerScene(state);
    }
  }

  _initTowerScene() {
    this.towerScene = new THREE.Scene();
    this.towerScene.background = new THREE.Color('#060a14');
    this.towerScene.fog = new THREE.Fog('#0b1526', 28, 88);
    if (this.envTex) {
      this.towerScene.environment = this.envTex;
      this.towerScene.environmentIntensity = this.era === 'original' ? 0.52 : 0.14;
    }

    this.towerCam = new THREE.PerspectiveCamera(52, 360 / 540, 0.1, 220);

    // Reference-matched Moonlit Chiaroscuro 3-Point Rig + 1536x1536 PCFSoftShadowMap
    this.hemiLight = new THREE.HemisphereLight('#385278', '#050b14', 0.54);
    this.towerScene.add(this.hemiLight);

    this.keyLight = new THREE.DirectionalLight('#d8eaff', 2.08);
    this.keyLight.position.set(6.8, 10.6, 8.2);
    this.keyLight.castShadow = true;
    this.keyLight.shadow.mapSize.set(1536, 1536);
    this.keyLight.shadow.camera.near = 2.0;
    this.keyLight.shadow.camera.far = 25.0;
    this.keyLight.shadow.camera.left = -5.4;
    this.keyLight.shadow.camera.right = 5.4;
    this.keyLight.shadow.camera.top = 7.6;
    this.keyLight.shadow.camera.bottom = -7.6;
    this.keyLight.shadow.bias = -0.0005;
    this.keyLight.shadow.normalBias = 0.024;
    this.keyLight.shadow.radius = 2.0;
    this.towerScene.add(this.keyLight);
    this.towerScene.add(this.keyLight.target);

    this.fillLight = new THREE.DirectionalLight('#2dd4bf', 0.34);
    this.fillLight.position.set(-7.0, 2.2, 7.5);
    this.towerScene.add(this.fillLight);

    this.rimLight = new THREE.DirectionalLight('#7dd3fc', 0.86);
    this.rimLight.position.set(-8.0, 6.2, -7.2);
    this.towerScene.add(this.rimLight);

    // Back-right moonlight specular water-glint source
    this.moonGlintLight = new THREE.DirectionalLight('#cbe3ff', 1.38);
    this.moonGlintLight.position.set(3.2, 7.5, -12.0);
    this.towerScene.add(this.moonGlintLight);

    this.heroLight = new THREE.PointLight('#7be8ff', 0.38, 5.5);
    this.towerScene.add(this.heroLight);

    // Localized Front-Hemisphere Accent PointLight Pool on Wet Stone (complements enemyRig _dynLights + cageLight + forgeLights)
    this.amberPoolLight = new THREE.PointLight('#ff9428', 0, 6.2, 1.7);
    this.towerScene.add(this.amberPoolLight);

    // Custom GLSL Moonlit Storm Sky Dome, Rim-Lined Storm Clouds, Archipelago Horizons, 96 Fireflies & Weather (`src/stormSky.js`)
    this.stormSky = new StormAtmosphere(this.towerScene, {
      towerRadius: TOWER_RADIUS,
      floorHeight: FLOOR_HEIGHT,
    });
    this.stormSky.setEra(this.era);

    // Real-Time Planar-Reflecting GLSL Fresnel Ocean (`src/water.js`: `segments: 64` = 8,192 tris + 4 normal layers + moon glitter)
    this.ocean = new Ocean(this.webgl, {
      towerRadius: TOWER_RADIUS,
      preset: 'moonlit_storm',
      era: this.era,
      size: 185,
      segments: 64,
      waterY: -0.55,
    });
    this.ocean.setSize(this.width, this.height, this.currentDpr);
    this.towerScene.add(this.ocean.mesh);
    this._lastOceanBiome = 'mist';
    this._lastOceanKey = '';

    // Crashing Whitewater Surf, Volumetric Doorway Mist & Ballistic Bouncing Furnace Sparks (`src/oceanVfx.js`)
    this.oceanVfx = new TowerFluidAndSparkVFX(this.towerScene);
    this.oceanVfx.setEra(this.era);

    // Tower Cache & Dynamic Object Pools
    this.towerCache = new Map();
    this.currentTowerGroup = null;

    // Next-Gen Hierarchical Skeletal PogoRig + Cryo-Shield + Landing Ring + Tunnel Vortex
    this.pogoRig = new PogoRig(this.skinId);
    this._lastPogoShadowKey = null;
    this._trimPogoShadows();
    this.towerScene.add(this.pogoRig.group);

    this.shieldBubble = new THREE.Mesh(
      new THREE.SphereGeometry(0.56, 20, 16),
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

    this.tunnelVortexGroup = this._buildTunnelVortex();
    this.towerScene.add(this.tunnelVortexGroup);

    this.landingRingGroup = this._buildLandingRing();
    this.towerScene.add(this.landingRingGroup);

    this.muzzleFlashGroup = this._buildMuzzleFlashGroup();
    this.towerScene.add(this.muzzleFlashGroup);

    this.wardrobeFxOrb = this._buildSnowballFxNode(true);
    this.wardrobeFxOrb.visible = false;
    this.towerScene.add(this.wardrobeFxOrb);

    this.enemyVisuals = new EnemyVisualPool(this.towerScene, { chromeEnv: this.envTex });
    this.enemyVisuals.setEra(this.era);

    // Dedicated container groups so planar reflection pass toggles dynamic pools in O(1)
    this.collectibleGroup = new THREE.Group();
    this.snowballGroup = new THREE.Group();
    this.particleGroup = new THREE.Group();
    this.popupGroup = new THREE.Group();
    this.towerScene.add(this.collectibleGroup, this.snowballGroup, this.particleGroup, this.popupGroup);

    this.snowballPool = [];
    for (let i = 0; i < 2; i++) {
      const fxNode = this._buildSnowballFxNode();
      fxNode.visible = false;
      this.snowballGroup.add(fxNode);
      this.snowballPool.push(fxNode);
    }
    for (let i = 0; i < 2; i++) {
      const spMat = new THREE.SpriteMaterial({
        map: createPopupTexture(i === 0 ? '+100' : '+250', '#fde047'),
        transparent: true,
        depthTest: false,
      });
      const sp = new THREE.Sprite(spMat);
      sp.visible = false;
      this.popupGroup.add(sp);
      this.popupPool.push({ sprite: sp, key: `${i === 0 ? '+100' : '+250'}_#fde047` });
    }
    this.collectiblePool = [];
    this.particlePool = [];
    this._initParticleInstancer(96);
    this.debrisPool = this._buildDebrisPool();
    this.towerScene.add(this.debrisPool.inst);
  }

  _trimPogoShadows() {
    const rig = this.pogoRig;
    const b = rig?.bones;
    if (!rig?.group || !b) return;
    const keepBones = new Set([b.chest, b.head, b.backpack, b.thighL, b.thighR, b.footL, b.footR]);
    const allBones = new Set(Object.values(b));
    rig.group.traverse((obj) => {
      if (!obj.isMesh) return;
      let p = obj.parent;
      while (p && p !== rig.group && !allBones.has(p)) {
        p = p.parent;
      }
      const m = Array.isArray(obj.material) ? obj.material[0] : obj.material;
      obj.castShadow = Boolean(keepBones.has(p) && m && !m.transparent && !m.isMeshBasicMaterial);
    });
    this._lastPogoShadowKey = b.chest?.children?.[0] || null;
  }

  _trimEnemyShadows() {
    const root = this.enemyVisuals?.root;
    if (!root) return;
    const kids = root.children;
    for (let i = 0; i < kids.length; i++) {
      const rig = kids[i];
      if (!rig || !rig.isGroup) continue;
      const bodyRoot = rig.userData?.body || rig;
      const sigKey = bodyRoot.children?.[0] || bodyRoot;
      if (rig._shadowTrimKey === sigKey) continue;
      rig._shadowTrimKey = sigKey;

      const cryoNode = rig.userData?.cryoIce || null;
      let best1 = null;
      let best1Weight = 0;
      let best2 = null;
      let best2Weight = 0;

      rig.traverse((o) => {
        if (!o.isMesh) return;
        o.castShadow = false;
        let p = o;
        while (p && p !== rig) {
          if (p === cryoNode) return;
          p = p.parent;
        }
        const m = Array.isArray(o.material) ? o.material[0] : o.material;
        if (!m || m.transparent || m.isMeshBasicMaterial) return;
        const geo = o.geometry;
        const w = geo?.index ? geo.index.count : geo?.attributes?.position?.count || 0;
        if (w > best1Weight) {
          best2 = best1;
          best2Weight = best1Weight;
          best1 = o;
          best1Weight = w;
        } else if (w > best2Weight) {
          best2 = o;
          best2Weight = w;
        }
      });

      if (best1) best1.castShadow = true;
      if (best2 && best2Weight >= Math.max(180, best1Weight * 0.52)) {
        best2.castShadow = true;
      }
    }
  }

  _initParticleInstancer(maxCount = 96) {
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
    const core = new THREE.Mesh(this.sharedPrismGeo, this.sharedSnowballMat);
    core.scale.setScalar(0.75);
    const flare = new THREE.Sprite(this.sharedHaloSpriteMat);
    flare.scale.set(0.85, 0.85, 1);
    g.add(core, flare);
    g.userData = { core, flare };
    return g;
  }

  _buildSnowballFxNode(isOrbital = false) {
    const g = new THREE.Group();
    const icosa = new THREE.Mesh(this.sharedSnowballGeo, this.sharedSnowballMat);
    const voxel = new THREE.Mesh(this.sharedVoxelGeo, this.sharedSnowballMat);
    const prism = new THREE.Mesh(this.sharedPrismGeo, this.sharedSnowballMat);
    const ring = new THREE.Mesh(this.sharedFxRingGeo, this.sharedFxRingMat);
    const halo = new THREE.Sprite(this.sharedHaloSpriteMat);
    halo.scale.set(0.58, 0.58, 1);

    const trailCluster = new THREE.Mesh(
      isOrbital ? this.sharedOrbitalTrailGeo : this.sharedTrailClusterGeo,
      this.sharedTrailDotMat
    );

    g.add(icosa, voxel, prism, ring, halo, trailCluster);
    g.userData = { icosa, voxel, prism, ring, halo, trailCluster };
    return g;
  }

  _buildLandingRing() {
    const g = new THREE.Group();
    const shadow = new THREE.Mesh(
      new THREE.CircleGeometry(0.25, 20),
      new THREE.MeshBasicMaterial({ color: '#020617', transparent: true, opacity: 0.55, depthWrite: false })
    );
    shadow.rotation.x = -Math.PI / 2;

    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.27, 0.34, 24),
      new THREE.MeshBasicMaterial({
        color: '#5efce8',
        transparent: true,
        opacity: 0.72,
        side: THREE.DoubleSide,
        depthWrite: false,
      })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.005;

    g.add(shadow, ring);
    g.userData = { shadow, ring };
    return g;
  }

  _buildTunnelVortex() {
    const g = new THREE.Group();
    g.visible = false;
    const outerRing = new THREE.Mesh(
      new THREE.TorusGeometry(0.4, 0.04, 8, 24),
      new THREE.MeshBasicMaterial({ color: '#5efce8', transparent: true, opacity: 0.85 })
    );
    const innerRing = new THREE.Mesh(
      new THREE.TorusGeometry(0.25, 0.03, 8, 20),
      new THREE.MeshBasicMaterial({ color: '#fbbf24', transparent: true, opacity: 0.8 })
    );
    const core = new THREE.Mesh(
      new THREE.CircleGeometry(0.21, 20),
      new THREE.MeshBasicMaterial({ color: '#bae6fd', transparent: true, opacity: 0.45, side: THREE.DoubleSide })
    );
    g.add(outerRing, innerRing, core);
    g.userData = { outerRing, innerRing, core };
    return g;
  }

  _buildDebrisPool() {
    // Single InstancedMesh for all 30 topple masonry chunks (1 draw call instead of 30!)
    const geo = new THREE.BoxGeometry(0.32, 0.24, 0.26);
    const mat = new THREE.MeshStandardMaterial({ color: '#3b4266', roughness: 0.65, metalness: 0.15 });
    const inst = new THREE.InstancedMesh(geo, mat, 30);
    inst.visible = false;
    const meta = [];
    for (let i = 0; i < 30; i++) {
      meta.push({
        rx: ((i % 9) - 4) * 0.74,
        rz: ((i % 5) - 2) * 0.65,
        speed: 0.68 + (i % 5) * 0.24,
        rot: (i % 2 === 0 ? 1 : -1) * (2.4 + (i % 4)),
      });
    }
    return { inst, geo, mat, meta };
  }

  _getOrBuildTowerGroup(tower, era) {
    const isOrig = era === 'original';
    const isRealOrig = Boolean(isOrig && tower.real);
    const rbTheme = isOrig ? 'classic' : resolveArchTheme(tower);
    const propVer = isOrig ? 0 : this._rebootPropsVersion;
    const clue = tower.clue;
    const clueSig = clue
      ? `${clue.kind}_${clue.col}_${clue.floor}_${clue.n || ''}_${(clue.pattern || clue.order || []).join('')}`
      : 'noclue';
    const basePrefix = `${era}_${isRealOrig ? 'real' : 'std'}_${rbTheme}_`;
    const towerSuffix = `_${tower.key || tower.id}_${clueSig}`;
    const cacheKey = `${basePrefix}p${propVer}${towerSuffix}`;
    if (this.towerCache.has(cacheKey)) {
      return this.towerCache.get(cacheKey);
    }

    // Evict any stale pre-GLB (`p0`/`p1`) entry for this exact tower so zero GPU geometries leak
    for (const [k, old] of this.towerCache.entries()) {
      if (k !== cacheKey && k.startsWith(basePrefix) && k.endsWith(towerSuffix) && old.group !== this.currentTowerGroup) {
        disposeTowerArchitecture(old);
        this.towerCache.delete(k);
      }
    }

    // Bound cache size for Endless mode & Campaign sector transitions
    if (this.towerCache.size > 10) {
      for (const [oldestKey, oldEntry] of this.towerCache.entries()) {
        if (oldEntry && oldEntry.group !== this.currentTowerGroup) {
          disposeTowerArchitecture(oldEntry);
          this.towerCache.delete(oldestKey);
          break;
        }
      }
    }

    const cached = buildDetailedTowerGroup(tower, era, {
      corbel_ledge: this.glbModels.corbel_ledge || null,
      cage_elevator: this.glbModels.cage_elevator || null,
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
    if (type === 'starCore') {
      const star = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.24, 0),
        this._getCollectibleMat(
          'starCore:star',
          () =>
            new THREE.MeshStandardMaterial({
              color: '#fde047',
              emissive: '#f59e0b',
              emissiveIntensity: 1.2,
              roughness: 0.1,
              metalness: 0.4,
            })
        )
      );
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(0.32, 0.025, 8, 24),
        this._getCollectibleMat('starCore:ring', () => new THREE.MeshBasicMaterial({ color: '#5efce8' }))
      );
      g.add(star, ring);
      g.userData.ring = ring;
    } else if (type === 'relic') {
      // 3D Etched Ancient Stone & Hologram Data Tablet (Nebulus Lore Relic)
      const tabletMat = this._getCollectibleMat(
        'relic:tablet',
        () =>
          new THREE.MeshStandardMaterial({
            color: '#1e2638',
            roughness: 0.44,
            metalness: 0.36,
          })
      );
      const goldTrimMat = this._getCollectibleMat(
        'relic:goldTrim',
        () =>
          new THREE.MeshStandardMaterial({
            color: '#eab308',
            emissive: '#b45309',
            emissiveIntensity: 0.35,
            metalness: 0.86,
            roughness: 0.22,
          })
      );
      const glyphMat = this._getCollectibleMat(
        'relic:glyph',
        () =>
          new THREE.MeshStandardMaterial({
            map: this.relicTabletTex,
            emissive: '#ffffff',
            emissiveMap: this.relicTabletTex,
            emissiveIntensity: 1.25,
            roughness: 0.18,
          })
      );

      const slab = new THREE.Mesh(new THREE.BoxGeometry(0.29, 0.42, 0.065), tabletMat);
      const topCap = new THREE.BoxGeometry(0.33, 0.045, 0.085);
      topCap.translate(0, 0.22, 0);
      const botPlinth = new THREE.BoxGeometry(0.34, 0.05, 0.09);
      botPlinth.translate(0, -0.22, 0);
      const trimMesh = new THREE.Mesh(mergeRigidGeos([topCap, botPlinth]), goldTrimMat);

      const fGeo = new THREE.PlaneGeometry(0.24, 0.34);
      fGeo.translate(0, 0, 0.035);
      const bGeo = new THREE.PlaneGeometry(0.24, 0.34);
      bGeo.rotateY(Math.PI);
      bGeo.translate(0, 0, -0.035);
      const facesMesh = new THREE.Mesh(mergeRigidGeos([fGeo, bGeo]), glyphMat);

      const holoRing = new THREE.Mesh(
        new THREE.TorusGeometry(0.29, 0.016, 8, 28),
        this._getCollectibleMat(
          'relic:holoRing',
          () => new THREE.MeshBasicMaterial({ color: '#5efce8', transparent: true, opacity: 0.78 })
        )
      );
      holoRing.rotation.x = Math.PI * 0.35;

      const holoGem = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.065, 0),
        this._getCollectibleMat('relic:holoGem', () => new THREE.MeshBasicMaterial({ color: '#fde047' }))
      );
      holoGem.position.y = 0.32;

      const aura = new THREE.Sprite(
        this._getCollectibleMat(
          'relic:aura',
          () =>
            new THREE.SpriteMaterial({
              map: this.glowDotTex,
              color: '#5efce8',
              transparent: true,
              opacity: 0.46,
              blending: THREE.AdditiveBlending,
              depthWrite: false,
            })
        )
      );
      aura.scale.set(0.85, 0.95, 1);

      g.add(slab, trimMesh, facesMesh, holoRing, holoGem, aura);
      g.userData = { holoRing, holoGem };
    } else if (type === 'salvage_part') {
      // 3D Brass Shaft + Wound Copper Induction Coils + Glowing Cyan Prism Core
      const shaft = new THREE.Mesh(
        new THREE.CylinderGeometry(0.048, 0.048, 0.38, 10),
        this._getCollectibleMat(
          'salvage:shaft',
          () => new THREE.MeshStandardMaterial({ color: '#eab308', metalness: 0.88, roughness: 0.2 })
        )
      );
      shaft.rotation.z = 0.42;

      const coilMat = this._getCollectibleMat(
        'salvage:coil',
        () =>
          new THREE.MeshStandardMaterial({
            color: '#ea580c',
            emissive: '#9a3412',
            emissiveIntensity: 0.35,
            metalness: 0.85,
            roughness: 0.22,
          })
      );
      const coilParts = [];
      for (const cy of [-0.09, 0, 0.09]) {
        const cg = new THREE.TorusGeometry(0.13, 0.026, 8, 20);
        cg.rotateX(Math.PI / 2);
        cg.translate(0, cy, 0);
        coilParts.push(cg);
      }
      const coilsMesh = new THREE.Mesh(mergeRigidGeos(coilParts), coilMat);
      coilsMesh.rotation.z = 0.42;

      const prismCore = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.105, 0),
        this._getCollectibleMat(
          'salvage:prism',
          () =>
            new THREE.MeshStandardMaterial({
              color: '#5efce8',
              emissive: '#06b6d4',
              emissiveIntensity: 1.35,
              roughness: 0.12,
            })
        )
      );
      const aura = new THREE.Sprite(
        this._getCollectibleMat(
          'salvage:aura',
          () =>
            new THREE.SpriteMaterial({
              map: this.glowDotTex,
              color: '#fbbf24',
              transparent: true,
              opacity: 0.42,
              blending: THREE.AdditiveBlending,
              depthWrite: false,
            })
        )
      );
      aura.scale.set(0.75, 0.75, 1);

      g.add(shaft, coilsMesh, prismCore, aura);
      g.userData = { holoGem: prismCore };
    } else if (type === 'compass_key') {
      // 3D Glowing Ornate Golden Compass Key with Cyan Star Jewel
      const keyGoldMat = this._getCollectibleMat(
        'key:gold',
        () =>
          new THREE.MeshStandardMaterial({
            color: '#fde047',
            emissive: '#f59e0b',
            emissiveIntensity: 0.88,
            metalness: 0.88,
            roughness: 0.15,
          })
      );
      const bow = new THREE.TorusGeometry(0.13, 0.03, 8, 22);
      bow.translate(0, 0.13, 0);
      const stem = new THREE.CylinderGeometry(0.025, 0.025, 0.28, 8);
      stem.translate(0, -0.11, 0);
      const bitTop = new THREE.BoxGeometry(0.09, 0.034, 0.03);
      bitTop.translate(0.048, -0.17, 0);
      const bitBot = new THREE.BoxGeometry(0.11, 0.038, 0.03);
      bitBot.translate(0.056, -0.225, 0);
      const keyBody = new THREE.Mesh(mergeRigidGeos([bow, stem, bitTop, bitBot]), keyGoldMat);

      const starJewel = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.068, 0),
        this._getCollectibleMat(
          'key:jewel',
          () =>
            new THREE.MeshStandardMaterial({
              color: '#5efce8',
              emissive: '#0ea5e9',
              emissiveIntensity: 1.35,
              roughness: 0.1,
            })
        )
      );
      starJewel.position.y = 0.13;

      const aura = new THREE.Sprite(
        this._getCollectibleMat(
          'key:aura',
          () =>
            new THREE.SpriteMaterial({
              map: this.glowDotTex,
              color: '#fde047',
              transparent: true,
              opacity: 0.5,
              blending: THREE.AdditiveBlending,
              depthWrite: false,
            })
        )
      );
      aura.scale.set(0.82, 0.88, 1);

      g.add(keyBody, starJewel, aura);
    } else if (type === 'curio') {
      // 3D Glowing Crystal / Ancient Astrolabe Artifact Orb
      const orb = new THREE.Mesh(
        new THREE.IcosahedronGeometry(0.165, 1),
        this._getCollectibleMat(
          'curio:orb',
          () =>
            new THREE.MeshStandardMaterial({
              color: '#c084fc',
              emissive: '#8b5cf6',
              emissiveIntensity: 1.2,
              roughness: 0.08,
              metalness: 0.3,
            })
        )
      );
      const gimbalMat = this._getCollectibleMat(
        'curio:gimbal',
        () =>
          new THREE.MeshStandardMaterial({
            color: '#f59e0b',
            emissive: '#b45309',
            emissiveIntensity: 0.4,
            metalness: 0.88,
            roughness: 0.18,
          })
      );
      const holoRing = new THREE.Mesh(new THREE.TorusGeometry(0.225, 0.02, 8, 24), gimbalMat);
      const gimbalRing2 = new THREE.Mesh(
        new THREE.TorusGeometry(0.26, 0.015, 8, 24),
        this._getCollectibleMat(
          'curio:ring2',
          () => new THREE.MeshBasicMaterial({ color: '#5efce8', transparent: true, opacity: 0.82 })
        )
      );
      gimbalRing2.rotation.y = Math.PI * 0.5;

      const aura = new THREE.Sprite(
        this._getCollectibleMat(
          'curio:aura',
          () =>
            new THREE.SpriteMaterial({
              map: this.glowDotTex,
              color: '#e879f9',
              transparent: true,
              opacity: 0.48,
              blending: THREE.AdditiveBlending,
              depthWrite: false,
            })
        )
      );
      aura.scale.set(0.85, 0.85, 1);

      g.add(orb, holoRing, gimbalRing2, aura);
      g.userData = { holoRing, gimbalRing2 };
    } else {
      // Single-draw-call merged Golden Gear (`this.sharedGearGeo` + `this.sharedGearMat`)
      g.add(new THREE.Mesh(this.sharedGearGeo, this.sharedGearMat));
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
    const fx = BLASTER_FX_STYLES[this.blasterFxId] || BLASTER_FX_STYLES.standard_cryo;
    const tintCryo = this.blasterFxId !== 'standard_cryo';
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
        const r = TOWER_RADIUS + 0.45;
        dm.position.set(r * Math.sin(theta), p.floor * fh, r * Math.cos(theta));
      } else {
        const wp = this._screenToWorld(p.x || 0, p.y || 0, cam, zPlane);
        dm.position.set(wp.x, wp.y, zPlane);
      }

      const s = Math.max(0.25, (p.size || 4) * 0.2);
      dm.scale.setScalar(s);
      dm.updateMatrix();
      inst.setMatrixAt(visCount, dm.matrix);

      const rawHex = typeof p.color === 'string' ? p.color.toLowerCase() : '#ffffff';
      if (tintCryo && CRYO_DEFAULT_HEXES.has(rawHex)) {
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
        if (slot.sprite.material.map) slot.sprite.material.map.dispose();
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
        const r = TOWER_RADIUS + 0.85;
        slot.sprite.position.set(
          r * Math.sin(nudgedTheta),
          pop.floor * fh + 1.15 * fh + t * 0.95,
          r * Math.cos(nudgedTheta)
        );
        slot.sprite.scale.set(1.28, 0.32, 1);
      } else if (pop.x != null && pop.y != null) {
        const wp = this._screenToWorld(pop.x, pop.y, cam, 1.5);
        slot.sprite.position.set(wp.x, wp.y + 0.18 + t * 0.72, 1.5);
        slot.sprite.scale.set(1.48, 0.37, 1);
      } else {
        slot.sprite.visible = false;
      }
    }
  }

  renderTowerScene(state) {
    const { tower, player, camCol = 0, camFloor = 2, time = 0 } = state;
    if (!tower) return;

    const era = state.era || this.era || 'reboot';
    if (era !== this.era) this.setEra(era);
    if (player?.skinId && player.skinId !== this.skinId) this.setSkin(player.skinId);
    const reqBlasterFx = player?.blasterFxId || state.blasterFxId;
    if (reqBlasterFx && reqBlasterFx !== this.blasterFxId) this.setBlasterFx(reqBlasterFx);
    const activeFx = this._syncBlasterFxMaterials(time);

    const dt = Math.min(0.05, Math.max(0.001, time - this._lastTime || 0.016));
    this._lastTime = time;

    const isOrig = era === 'original';
    const isRealOrig = Boolean(isOrig && tower.real);
    const fh = getTowerStepHeight(tower, isOrig);
    const pal = tower.palette || {};
    const aspect = this.towerCam.aspect;
    const isWardrobe = Boolean(state.wardrobeSpotlight && player);
    const cutscene =
      !isWardrobe && state.cutsceneCam?.active
        ? state.cutsceneCam
        : !isWardrobe && this.cutsceneCam?.active
        ? this.cutsceneCam
        : null;
    const isCutscene = Boolean(cutscene);
    const isTitleShowcase =
      !isWardrobe &&
      !isCutscene &&
      (Boolean(state.titleShowcase) || (state.titleShowcase !== false && state.mode === 'title'));

    // Smoothly damp discrete dialogue-step phase jumps into a fluid Steadicam crane/orbit glide
    let csEase = 0;
    let csKind = '';
    if (isCutscene) {
      csKind = cutscene.kind || 'prologue';
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

    const pBaseCol = player ? player.col : 0.5;
    const landBlend = Math.max(0, Math.min(1, (aspect - 0.95) / 1.15));
    // Smooth phone-portrait blend: 1.0 on 19.5:9 tall phones (0.46), 0.5 on 16:9 SE (0.56), 0.0 on 3:4 iPad (0.75+)
    const tallPhoneBlend = Math.max(0, Math.min(1, (0.72 - aspect) / 0.26));
    const csOrbitCols = isCutscene
      ? csKind === 'epilogue'
        ? Math.sin(time * 0.65) * 0.55 * (1 - csEase * 0.5)
        : (csKind === 'sector2' || csKind === 'sector4' ? 2.6 : -2.6) * (1 - csEase) + Math.sin(time * 0.45) * 0.14
      : 0;
    const effCamCol = isWardrobe
      ? pBaseCol
      : isCutscene
      ? pBaseCol + csOrbitCols
      : isTitleShowcase
      ? pBaseCol + Math.sin(time * 0.32) * (0.34 - landBlend * 0.1) - (0.09 - landBlend * 0.04)
      : camCol;

    // Aspect-calibrated FOV across Phone Portrait (52.5->48), Tablet (44), and Phone Landscape (40->37)
    const portraitGameFov = 44 + tallPhoneBlend * 8.5;
    const landscapeGameFov = 44 - Math.max(0, Math.min(1, (aspect - 1.33) / 0.84)) * 7;
    const gameplayFov =
      Math.round((portraitGameFov * (1 - landBlend) + landscapeGameFov * landBlend) * 2) * 0.5;
    const portraitShowcaseFov = 45 + tallPhoneBlend * 6.5;
    const landscapeShowcaseFov = 43 - Math.max(0, Math.min(1, (aspect - 1.33) / 0.84)) * 4;
    const showcaseFov =
      Math.round((portraitShowcaseFov * (1 - landBlend) + landscapeShowcaseFov * landBlend) * 2) * 0.5;
    const wantFov =
      isRealOrig && !isWardrobe && !isCutscene && !isTitleShowcase
        ? 18
        : isWardrobe || isCutscene
        ? 48
        : isTitleShowcase
        ? showcaseFov
        : gameplayFov;
    if (this.towerCam.fov !== wantFov) {
      this.towerCam.fov = wantFov;
      this.towerCam.updateProjectionMatrix();
    }

    let camZ;
    if (isRealOrig && !isWardrobe && !isCutscene && !isTitleShowcase) {
      const halfTan = Math.tan(THREE.MathUtils.degToRad(9));
      const lens = Math.tan(THREE.MathUtils.degToRad(24)) / halfTan;
      const minOrigZ = (aspect >= 1.05 ? 10.6 + Math.min(1.2, (aspect - 1.0) * 0.8) : 9.4) * lens;
      camZ = Math.max(minOrigZ, Math.min(16.2 * lens, 3.45 / (halfTan * Math.max(0.45, aspect))));
    } else if (!isOrig && !isWardrobe && !isCutscene && !isTitleShowcase) {
      // Closer Phone Portrait (13.9m SE .. 14.85m 19.5:9 -> ~76-84% tower width + storm flanks, bold 8.5-10% Pogo)
      // & Landscape (12.95m 4:3 iPad -> 11.4m 19.5:9 phone -> ledges strictly inside 27.8..72.2% iPad / 31.1..68.9% phone!)
      if (aspect < 0.95) {
        camZ = 12.95 + tallPhoneBlend * 1.9;
      } else {
        const wideLand = Math.max(0, Math.min(1, (aspect - 1.33) / 0.84));
        camZ = 12.95 - wideLand * 1.55;
      }
    } else if (isOrig && !isWardrobe && !isCutscene && !isTitleShowcase) {
      if (aspect < 0.95) {
        camZ = 12.7 + tallPhoneBlend * 1.85;
      } else {
        const wideLand = Math.max(0, Math.min(1, (aspect - 1.33) / 0.84));
        camZ = 12.65 - wideLand * 1.35;
      }
    } else {
      camZ = aspect < 0.82 ? Math.min(15.2, 9.2 * (0.76 / Math.max(0.45, aspect))) : 9.6;
    }

    // Frame Pogo's feet at screenY ~ 72.5-74.5% on Phone Portrait & ~71% on Phone Landscape
    const portraitPosOffY = 0.62 + tallPhoneBlend * 0.34;
    const portraitTiltUpY = 0.44 + tallPhoneBlend * 0.2;
    const rebootPosOffY = portraitPosOffY * (1 - landBlend) + -0.02 * landBlend;
    const rebootTiltUpY = portraitTiltUpY * (1 - landBlend) + 0.22 * landBlend;
    const origPosOffY = isRealOrig
      ? aspect >= 1.05
        ? 0.28
        : 0.58
      : (0.72 + tallPhoneBlend * 0.22) * (1 - landBlend) + 0.06 * landBlend;
    let camY = camFloor * fh + (isOrig ? origPosOffY : rebootPosOffY);
    const shake = writeShakeOffset(state.shake, time, this._shakeVec);

    if (isWardrobe) {
      const pFloorY = (player.floor || 0) * fh;
      const wardLand = Math.max(0, Math.min(1, (aspect - 1.05) / 1.0));
      const wardY = pFloorY + 0.04 + wardLand * 0.11;
      const wardZ = TOWER_RADIUS + 2.55 + wardLand * 0.42;
      this.towerCam.position.set(0, wardY, wardZ);
      this.towerCam.lookAt(0, wardY, TOWER_RADIUS + 0.38);
    } else if (isTitleShowcase) {
      // Bold, heroic Start-Screen Diorama across Phone Portrait (12.9m SE .. 14.3m), Tablet (11.2m), & Phone Landscape (10.6m)
      const pFloorY = (player?.floor || 0) * fh;
      const wideLand = Math.max(0, Math.min(1, (aspect - 1.33) / 0.84));
      const showcaseZ =
        aspect < 0.95 ? 12.1 + tallPhoneBlend * 2.2 : 11.2 - wideLand * 0.6;
      const showcaseX = Math.sin(time * 0.32) * (0.38 - landBlend * 0.1);
      camY = pFloorY + (0.58 * (1 - landBlend) + 0.5 * landBlend) + Math.sin(time * 0.55) * 0.045;
      const showcaseLookY =
        pFloorY + ((1.38 + tallPhoneBlend * 0.24) * (1 - landBlend) + (0.94 - wideLand * 0.06) * landBlend);
      camZ = showcaseZ;
      this.towerCam.position.set(showcaseX, camY, showcaseZ);
      this.towerCam.lookAt(0, showcaseLookY, TOWER_RADIUS * 0.35);
    } else if (isCutscene) {
      const pFloorY = (player?.floor || 0) * fh;
      const towerTopY = Math.max(12, tower.floors * fh);
      const heroCloseZ = aspect < 0.82 ? TOWER_RADIUS + 4.35 : TOWER_RADIUS + 3.45;
      const breatheY = Math.sin(time * 0.85) * 0.05;

      if (csKind === 'epilogue') {
        const pull = Math.max(0, (csEase - 0.45) / 0.55);
        const cz = (TOWER_RADIUS + 3.25) * (1 - pull) + (camZ * 0.92) * pull;
        const cx = Math.sin(time * 0.72) * (1.25 * (1 - pull * 0.5));
        camY = pFloorY + 0.62 + pull * 2.4 + breatheY;
        this.towerCam.position.set(cx, camY, cz);
        this.towerCam.lookAt(0, pFloorY + 0.28 + pull * 1.1, (TOWER_RADIUS + 0.38) * (1 - pull * 0.7));
      } else if (csKind === 'sector2') {
        const startY = pFloorY + 0.55;
        const midSweepY = towerTopY * 0.42 * Math.sin(csEase * Math.PI) * 0.55;
        camY = startY + midSweepY + csEase * 0.18 + breatheY;
        const cz = (camZ * 0.96) * (1 - csEase) + heroCloseZ * csEase;
        const lookY = (towerTopY * 0.44) * (1 - csEase) + (pFloorY + 0.26) * csEase;
        const lookZ = (TOWER_RADIUS + 0.36) * csEase;
        this.towerCam.position.set(Math.sin(time * 0.5) * 0.3 * (1 - csEase), camY, cz);
        this.towerCam.lookAt(0, lookY, lookZ);
      } else if (csKind === 'sector3') {
        const startY = towerTopY * 0.72;
        camY = startY * (1 - csEase) + (pFloorY + 0.72) * csEase + breatheY;
        const cz = (camZ * 0.98) * (1 - csEase) + heroCloseZ * csEase;
        const lookY = (towerTopY * 0.56) * (1 - csEase) + (pFloorY + 0.26) * csEase;
        this.towerCam.position.set(-0.45 * (1 - csEase), camY, cz);
        this.towerCam.lookAt(0, lookY, (TOWER_RADIUS + 0.36) * csEase);
      } else if (csKind === 'sector4') {
        const startY = towerTopY * 0.56;
        camY = startY * (1 - csEase) + (pFloorY + 0.72) * csEase + breatheY;
        const cz = (camZ * 1.05) * (1 - csEase) + heroCloseZ * csEase;
        const lookY = (towerTopY * 0.38) * (1 - csEase) + (pFloorY + 0.26) * csEase;
        this.towerCam.position.set(0.55 * (1 - csEase), camY, cz);
        this.towerCam.lookAt(0, lookY, (TOWER_RADIUS + 0.36) * csEase);
      } else {
        const startY = towerTopY * 0.58;
        camY = startY * (1 - csEase) + (pFloorY + 0.72) * csEase + breatheY;
        const cz = (camZ * 1.08) * (1 - csEase) + heroCloseZ * csEase;
        const lookY = (towerTopY * 0.38) * (1 - csEase) + (pFloorY + 0.26) * csEase;
        this.towerCam.position.set(-0.6 * (1 - csEase), camY, cz);
        this.towerCam.lookAt(0, lookY, (TOWER_RADIUS + 0.36) * csEase);
      }
    } else if (!isOrig) {
      // Subtle upward lighthouse perspective tilt framing Pogo at y ~ 63-66% with 5.5-6+ floors look-ahead
      this.towerCam.position.set(shake.x, camY + shake.y, camZ);
      this.towerCam.lookAt(shake.x, camY + rebootTiltUpY + shake.y, 0);
    } else {
      this.towerCam.position.set(shake.x, camY + shake.y, camZ);
      this.towerCam.lookAt(shake.x, camY + (isRealOrig ? -0.05 : 0.12) + shake.y, 0);
    }

    // Era Sky, Chiaroscuro Shadows, Blackout & Lightning Modulation (`StormAtmosphere` GLSL dome + weather)
    const blackout = Math.max(0, Math.min(1, state.blackoutFactor || 0));
    const lightning = Math.max(0, Math.min(1.5, state.lightningFlash || 0));
    const lightMult = Math.max(0.16, 1 - blackout * 0.82) + lightning * 1.9;
    const shadowFocusY = isWardrobe
      ? (player.floor || 0) * fh
      : isTitleShowcase
      ? (player?.floor || 0) * fh + 2.0
      : camY;

    if (isOrig) {
      this._tempColor.set(pal.mortar || '#091536');
      this.towerScene.background.copy(this._skyBaseOrig).lerp(this._tempColor, 0.35);
      this.towerScene.fog.color.copy(this._fogBaseOrig).lerp(this._tempColor, 0.25);
      this.towerScene.fog.near = isRealOrig ? camZ + 10 : 32;
      this.towerScene.fog.far = isRealOrig ? camZ + 68 : 85;

      this.hemiLight.color.set('#7dd3fc');
      this.hemiLight.groundColor.set('#0b1926');
      this.hemiLight.intensity = 0.78;
      this.keyLight.color.set('#ffffff');
      this.keyLight.intensity = 1.42;
      this.keyLight.castShadow = false;
      this.keyLight.position.set(7.5, shadowFocusY + 10.0, 8.5);
      this.keyLight.target.position.set(0, shadowFocusY, 0);
      this.keyLight.target.updateMatrixWorld();
      this.fillLight.color.set('#93c5fd');
      this.fillLight.intensity = 0.55;
      this.rimLight.color.set(pal.glow || '#38bdf8');
      this.rimLight.intensity = 0.85;
      this.amberPoolLight.intensity = 0;
    } else {
      this._tempColor.set(pal.skyTop || pal.mortar || '#060a14');
      this.towerScene.background.copy(this._skyBaseReboot).lerp(this._tempColor, 0.45);
      if (lightning > 0.05) {
        this._tempColor.set('#64748b');
        this.towerScene.background.lerp(this._tempColor, Math.min(0.65, lightning * 0.5));
      }
      this._tempColor.set(pal.fog || '#0b1526');
      this.towerScene.fog.color.copy(this._fogBaseReboot).lerp(this._tempColor, 0.5);
      this.towerScene.fog.near = Math.max(26, camZ + 9);
      this.towerScene.fog.far = Math.max(82, camZ + 70);

      this.hemiLight.color.set('#385278');
      this.hemiLight.groundColor.set('#050b14');
      this.hemiLight.intensity = 0.54 * lightMult;
      this.keyLight.color.set(isCutscene && csKind === 'epilogue' ? '#fde68a' : '#d8eaff');
      this.keyLight.intensity = (isCutscene && csKind === 'epilogue' ? 2.18 : 2.08) * lightMult;
      this.keyLight.castShadow = true;
      this.keyLight.position.set(6.8, shadowFocusY + 8.6, 8.2);
      this.keyLight.target.position.set(0, shadowFocusY, 0);
      this.keyLight.target.updateMatrixWorld();
      this.fillLight.color.set(isCutscene && csKind === 'epilogue' ? '#fbbf24' : '#2dd4bf');
      this.fillLight.intensity = 0.34 * lightMult;
      this.rimLight.color.set(pal.glow || '#7dd3fc');
      this.rimLight.intensity = 0.86 * lightMult;
      if (isCutscene && csKind === 'epilogue') {
        this._tempColor.set('#1e1b4b');
        this.towerScene.background.lerp(this._tempColor, 0.35 + csEase * 0.25);
      }
    }

    let showcaseState = state;
    if (isTitleShowcase && !state.titleShowcase) {
      const sp = this._skyStateProxy;
      sp.tower = state.tower;
      sp.era = era;
      sp.camCol = effCamCol;
      sp.camFloor = camFloor;
      sp.waterFloor = state.waterFloor;
      sp.windCurrent = state.windCurrent;
      sp.ledges = state.ledges;
      sp.topple = state.topple;
      sp.player = state.player;
      sp.blackoutFactor = state.blackoutFactor;
      sp.lightningFlash = state.lightningFlash;
      sp.titleShowcase = true;
      showcaseState = sp;
    }

    if (this.stormSky) {
      this.stormSky.update(showcaseState, this.towerCam, time, dt);
      if (isWardrobe) {
        if (this.stormSky.fireflyPoints) this.stormSky.fireflyPoints.visible = false;
        if (this.stormSky.weatherPoints) this.stormSky.weatherPoints.visible = false;
        if (this.stormSky.streakLines) this.stormSky.streakLines.visible = false;
        if (this.stormSky.seaSprayPoints) this.stormSky.seaSprayPoints.visible = false;
        if (this.stormSky.flankMistMesh) this.stormSky.flankMistMesh.visible = false;
      }
    }

    // Swap cached Tower 3D Group + Pre-compile shaders to eliminate first-frame hitches
    const cached = this._getOrBuildTowerGroup(tower, era);
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
          // Ignore compile fallback if driver unsupported
        }
        cached.compiled = true;
      }
    }

    const tg = cached.group;
    tg.rotation.y = -effCamCol * COL_ANGLE;

    // Tower Topple Sequence (1 InstancedMesh draw call for all 30 masonry debris chunks)
    const topple = state.topple || { active: false, progress: 0 };
    if (topple.active) {
      tg.position.y = -topple.progress * tower.floors * fh * 1.05;
      tg.rotation.z = Math.sin(time * 38) * 0.045 * (1 - topple.progress) + topple.progress * 0.14;
      tg.position.x = Math.sin(time * 48) * 0.16 * (1 - topple.progress);

      const dp = this.debrisPool;
      dp.inst.visible = true;
      dp.mat.color.set(pal.brickA || '#2e3158');
      const dm = this._debrisDummy;
      for (let i = 0; i < dp.meta.length; i++) {
        const d = dp.meta[i];
        dm.position.set(
          d.rx + Math.sin(time * 3 + d.rx) * 0.6 * topple.progress,
          camY - 3 + Math.max(-0.5, (1 - ((topple.progress * d.speed) % 1)) * 7),
          TOWER_RADIUS + 0.4 + d.rz * 0.4
        );
        dm.rotation.set(time * d.rot, time * d.rot * 0.7, 0);
        dm.updateMatrix();
        dp.inst.setMatrixAt(i, dm.matrix);
      }
      dp.inst.instanceMatrix.needsUpdate = true;
    } else {
      tg.position.set(0, 0, 0);
      tg.rotation.z = 0;
      this.debrisPool.inst.visible = false;
    }

    // Animate 3D Beveled Masonry Architecture, Ledges, Lifts, Switches, Clues, Rune Doors, Workbench & Chest (`src/towerArchitecture.js`)
    updateTowerArchitecture(cached, state, time, dt);

    // Update Collectibles (front-cylinder & vertical frustum culled + leak-free type swap!)
    const collectibles = state.collectibles || [];
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
      if (Math.abs(ct) > 1.56 || Math.abs(colItem.floor - camFloor) > (isRealOrig ? 20 : 12)) {
        slot.mesh.visible = false;
        continue;
      }
      slot.mesh.visible = true;
      const cr = TOWER_RADIUS + 0.38;
      slot.mesh.position.set(
        cr * Math.sin(ct),
        colItem.floor * fh + 0.42 + Math.sin(time * 3.5 + i) * 0.08 + (topple.active ? tg.position.y : 0),
        cr * Math.cos(ct)
      );
      slot.mesh.rotation.y = ct + time * (colItem.type === 'relic' ? 1.9 : 2.6);
      if (slot.mesh.userData.holoRing) {
        slot.mesh.userData.holoRing.rotation.x = Math.PI * 0.35 + Math.sin(time * 2.8 + i) * 0.24;
        slot.mesh.userData.holoRing.rotation.z = time * 2.4;
      }
      if (slot.mesh.userData.gimbalRing2) {
        slot.mesh.userData.gimbalRing2.rotation.y = -time * 3.1;
        slot.mesh.userData.gimbalRing2.rotation.x = Math.cos(time * 2.2 + i) * 0.45;
      }
      if (slot.mesh.userData.holoGem) {
        slot.mesh.userData.holoGem.rotation.y = -time * 3.8;
        if (colItem.type === 'relic') {
          slot.mesh.userData.holoGem.position.y = 0.31 + Math.sin(time * 4.5 + i) * 0.025;
        }
      }
    }

    // Update Skeletal PogoRig, Shield, Muzzle Flash, Wardrobe Blaster Preview, Tunnel Vortex & Landing Ring
    this.muzzleFlashGroup.visible = false;
    this.wardrobeFxOrb.visible = false;
    if (player) {
      const pTheta = wrapAngle((player.col - effCamCol) * COL_ANGLE);
      const pr = TOWER_RADIUS + 0.38;
      const px = pr * Math.sin(pTheta);
      const pz = pr * Math.cos(pTheta);
      const py = player.floor * fh + (topple.active ? tg.position.y : 0);

      const inTunnel = Boolean(player.hidden && player.tunnelTimer > 0 && !topple.active);
      this.tunnelVortexGroup.visible = inTunnel;
      if (inTunnel) {
        this.tunnelVortexGroup.position.set(px, py + 0.42, pz);
        this.tunnelVortexGroup.rotation.y = pTheta;
        this.tunnelVortexGroup.userData.outerRing.rotation.z = time * 8;
        this.tunnelVortexGroup.userData.innerRing.rotation.z = -time * 11;
      }

      const pogoVisible = !player.hidden && !topple.active;
      this.pogoRig.group.visible = pogoVisible;
      this.landingRingGroup.visible = pogoVisible && !isWardrobe && !isCutscene && !isTitleShowcase;
      this.shieldBubble.visible = Boolean(pogoVisible && player.shield);

      if (pogoVisible) {
        const pogoHeroScale = !isOrig && !isWardrobe ? 1.14 : 1.0;
        this.pogoRig.group.scale.setScalar(pogoHeroScale);
        this.pogoRig.group.position.set(px, py, pz);
        this.pogoRig.group.rotation.y =
          pTheta + (isWardrobe ? Math.sin(time * 0.85) * 0.55 : isTitleShowcase ? Math.sin(time * 0.65) * 0.22 : 0);
        const mf = player.muzzleFlash || 0;
        this.pogoRig.update(dt, {
          time,
          vx: player.vx || 0,
          vy: player.vy || 0,
          facing: player.facing || 1,
          onGround: Boolean(player.onGround),
          onElevator: player.onElevator,
          squashX: player.squashX || 1,
          squashY: player.squashY || 1,
          landImpact: player.landImpact || 0,
          muzzleFlash: mf,
          hurtTimer: player.hurtTimer || 0,
          invuln: isWardrobe || isCutscene || isTitleShowcase || state.mode === 'title' ? 0 : player.invuln || 0,
          enteringDoor: player.enteringDoor || 0,
          victory: state.mode === 'victory' || (isCutscene && csKind === 'epilogue'),
        });
        if ((this.pogoRig.bones?.chest?.children?.[0] || null) !== this._lastPogoShadowKey) {
          this._trimPogoShadows();
        }

        if (mf > 0.01 && !isWardrobe) {
          const facingDir = player.facing || 1;
          const mTheta = pTheta + facingDir * 0.13;
          const mr = TOWER_RADIUS + 0.46;
          const flashScale = Math.min(1.35, 0.55 + mf * 4.5);
          this.muzzleFlashGroup.visible = true;
          this.muzzleFlashGroup.position.set(mr * Math.sin(mTheta), py + 0.42 * pogoHeroScale, mr * Math.cos(mTheta));
          this.muzzleFlashGroup.scale.setScalar(flashScale);
          this.muzzleFlashGroup.rotation.set(time * 14, mTheta, time * 18);
          this.heroLight.color.set(activeFx.prismatic ? this._prismColor : activeFx.muzzle);
          this.heroLight.intensity = 1.05;
        } else {
          this.heroLight.color.set('#7be8ff');
          this.heroLight.intensity = blackout > 0.2 ? 0.78 : isTitleShowcase ? 0.54 : 0.36;
        }
        this.heroLight.position.set(px, py + 1.05 * pogoHeroScale, pz + 1.15);

        if (isWardrobe) {
          const wUd = this.wardrobeFxOrb.userData;
          const wardLand = Math.max(0, Math.min(1, (aspect - 1.05) / 1.0));
          this.wardrobeFxOrb.visible = true;
          this.wardrobeFxOrb.position.set(
            0.27 + wardLand * 0.18,
            py + 0.46 + Math.sin(time * 3.2) * 0.03,
            TOWER_RADIUS + 0.46
          );
          this.wardrobeFxOrb.scale.setScalar(0.36);
          wUd.icosa.visible = activeFx.shape === 'icosa';
          wUd.voxel.visible = activeFx.shape === 'voxel';
          wUd.prism.visible = activeFx.shape === 'prism';
          wUd.ring.visible = Boolean(activeFx.ring);
          wUd.icosa.rotation.set(time * 3.5, time * 4.8, 0);
          wUd.voxel.rotation.set(time * 2.8, time * 3.6, 0);
          wUd.prism.rotation.set(time * 3.2, time * 5.0, 0);
          wUd.ring.rotation.set(Math.PI * 0.3 + time * 3.0, time * 4.2, 0);
          wUd.trailCluster.rotation.set(Math.sin(time * 2.4) * 0.18, time * 4.2, 0);
        }

        if (this.shieldBubble.visible) {
          this.shieldBubble.scale.setScalar(pogoHeroScale);
          this.shieldBubble.position.set(px, py + 0.44 * pogoHeroScale, pz);
          this.shieldBubble.rotation.y = time * 1.8;
        }

        const waterFl = state.waterFloor != null ? state.waterFloor : -0.55;
        const lf = player.landingFloor != null ? player.landingFloor : waterFl;
        const dist = Math.max(0, (player.floor - lf) * fh);
        this.landingRingGroup.position.set(px, lf * fh + 0.03, pz);
        this.landingRingGroup.scale.setScalar(Math.max(0.55, 1.12 - dist * 0.11));
        const overSea = lf <= waterFl + 0.08;
        this.landingRingGroup.userData.ring.material.color.set(overSea ? '#fb7185' : '#5efce8');
        this.landingRingGroup.userData.ring.material.opacity = Math.max(0.22, 0.78 - dist * 0.14);
      }
    }

    // Update Enemies via Next-Gen `EnemyVisualPool` (`src/enemyRig.js`) + Hitbox-Honest Scale & Shadow Trim
    if (this.enemyVisuals) {
      this.enemyVisuals.syncEnemies(
        state.enemies,
        effCamCol,
        fh,
        TOWER_RADIUS,
        time,
        topple.active ? tg.position.y : 0
      );
      if (!isOrig) {
        const eKids = this.enemyVisuals.root?.children;
        if (eKids) {
          for (let i = 0; i < eKids.length; i++) {
            const rig = eKids[i];
            if (!rig || !rig.isGroup || !rig.visible) continue;
            const fam = rig.userData?.family;
            // Calibrate 3D visual silhouette 1:1 with `src/game.js` 0.52-col / 0.56-floor collision radii
            if (fam === 0) {
              // `eye` (trims 1.38x * 1.42x double-inflation by ~29% & keeps creeping tendrils grounded on flagstones)
              rig.scale.multiplyScalar(0.71);
              rig.position.y -= 0.1;
            } else if (fam === 1) {
              // `molecule`
              rig.scale.multiplyScalar(0.86);
              rig.position.y -= 0.025;
            } else if (fam === 2) {
              // `roller`
              rig.scale.multiplyScalar(0.88);
              rig.position.y -= 0.032;
            } else if (fam === 3) {
              // `bouncer`
              rig.scale.multiplyScalar(0.86);
              rig.position.y -= 0.036;
            } else if (fam === 4) {
              // `robot` (`robotH` / `robotV`)
              rig.scale.multiplyScalar(0.85);
              rig.position.y -= 0.03;
            }
          }
        }
        this._trimEnemyShadows();
      }
    }

    // Update Zero-Allocation Front-Hemisphere Architectural PointLight Pool on Wet Stone
    // (Complements oceanVfx sparkArch PointLights + enemyRig _dynLights)
    if (!isOrig && !isWardrobe) {
      const toppleOffY = topple.active ? tg.position.y : 0;
      let bestDist = 999;
      let poolX = 0;
      let poolY = 0;
      let poolZ = 0;
      let poolHex = '#ffaa2b';
      let poolBaseInt = 1.85;

      const pods = cached.elevatorPods;
      if (pods) {
        for (let i = 0; i < pods.length; i++) {
          const pod = pods[i];
          const pCol = pod.userData?.col;
          if (pCol == null) continue;
          const eTheta = wrapAngle((pCol + 0.5 - effCamCol) * COL_ANGLE);
          if (Math.abs(eTheta) > 1.32) continue;
          const ey = pod.position.y + 0.55 + toppleOffY;
          const dist = Math.abs(ey - shadowFocusY) + Math.abs(eTheta) * 1.45;
          if (dist < bestDist) {
            bestDist = dist;
            const lr = TOWER_RADIUS + 0.68;
            poolX = lr * Math.sin(eTheta);
            poolY = ey;
            poolZ = lr * Math.cos(eTheta);
            poolHex = '#ffaa2b';
            poolBaseInt = 1.88;
          }
        }
      }
      const doors = tower.doors;
      if (doors) {
        for (let i = 0; i < doors.length; i++) {
          const d = doors[i];
          const isRuneDoor = Boolean(d.isRune || d.rune);
          const isVaultDoor = Boolean(d.isVault || d.vault);
          if (!d.isExit && !isRuneDoor && !isVaultDoor) continue;
          const dTheta = wrapAngle((d.col + 0.5 - effCamCol) * COL_ANGLE);
          if (Math.abs(dTheta) > 1.32) continue;
          const dy = d.floor * fh + 0.46 + toppleOffY;
          const dist = Math.abs(dy - shadowFocusY) + Math.abs(dTheta) * 1.5;
          if (dist + 0.25 < bestDist) {
            bestDist = dist;
            const lr = TOWER_RADIUS + 0.62;
            poolX = lr * Math.sin(dTheta);
            poolY = dy;
            poolZ = lr * Math.cos(dTheta);
            poolHex = isRuneDoor ? '#2efce0' : isVaultDoor ? '#c026ff' : '#ffb020';
            poolBaseInt = 1.65;
          }
        }
      }
      if (bestDist < 9.5) {
        this.amberPoolLight.color.set(poolHex);
        this.amberPoolLight.intensity = poolBaseInt * lightMult;
        this.amberPoolLight.position.set(poolX, poolY, poolZ);
      } else {
        this.amberPoolLight.intensity = 0;
      }
    } else if (isWardrobe) {
      this.amberPoolLight.intensity = 0;
    }

    // Update Snowballs / Cryo-Bolts
    const snowballs = state.snowballs || [];
    while (this.snowballPool.length < snowballs.length) {
      const fxNode = this._buildSnowballFxNode();
      this.snowballGroup.add(fxNode);
      this.snowballPool.push(fxNode);
    }
    for (let i = 0; i < this.snowballPool.length; i++) {
      const m = this.snowballPool[i];
      if (i >= snowballs.length) {
        m.visible = false;
        continue;
      }
      const sb = snowballs[i];
      const st = wrapAngle((sb.col - effCamCol) * COL_ANGLE);
      if (Math.abs(st) > 1.58) {
        m.visible = false;
        continue;
      }
      m.visible = true;
      const sr = TOWER_RADIUS + 0.38;
      m.position.set(sr * Math.sin(st), sb.floor * fh + (isRealOrig ? 0.32 : 0.28), sr * Math.cos(st));
      m.rotation.y = st;

      const ud = m.userData;
      ud.icosa.visible = activeFx.shape === 'icosa';
      ud.voxel.visible = activeFx.shape === 'voxel';
      ud.prism.visible = activeFx.shape === 'prism';
      ud.ring.visible = Boolean(activeFx.ring);
      ud.icosa.rotation.set(time * 6, time * 8, 0);
      ud.voxel.rotation.set(time * 7, time * 9, 0);
      ud.prism.rotation.set(time * 6, time * 10, 0);
      ud.ring.rotation.set(Math.PI * 0.32 + time * 6, time * 8, 0);

      const sbDir = sb.dir || (sb.vx >= 0 ? 1 : -1);
      ud.trailCluster.scale.x = sbDir;
      ud.trailCluster.position.y = Math.sin(time * 22 + i) * 0.02;
    }

    // Real-Time Planar-Reflecting GLSL Fresnel Ocean (`src/water.js`) + Dynamic Rising Waterline (`state.waterFloor`)
    const waterY = (state.waterFloor != null ? state.waterFloor : -0.55) * fh;
    if (this.moonGlintLight) {
      this.moonGlintLight.intensity = isOrig ? 0.85 : 1.38 * lightMult;
    }
    if (this.ocean) {
      const oceanBiome = isOrig ? 'original_hd' : resolveArchTheme(tower);
      const oceanKey = `${era}_${oceanBiome}`;
      if (this._lastOceanKey !== oceanKey) {
        this._lastOceanKey = oceanKey;
        this._lastOceanBiome = oceanBiome;
        this.ocean.setEra(era, oceanBiome);
      }
      if (!isOrig && this.stormSky) {
        this.ocean.setMoonlight({ direction: this.stormSky.getMoonDirection() });
      }
      this.ocean.update(time, {
        waterY,
        lightningFlash: lightning,
        towerRadius: TOWER_RADIUS,
      });
    }

    if (this.oceanVfx) {
      if (isWardrobe) {
        this.oceanVfx.setVisible?.(false);
      } else {
        this.oceanVfx.setVisible?.(true);
        this.oceanVfx.update(showcaseState, effCamCol, time, dt);
      }
    }

    this._syncParticles(this.particlePool, this.particleGroup, state.particles, this.towerCam, TOWER_RADIUS + 0.55, effCamCol, true, fh);
    this._syncPopups(state.popups, effCamCol, this.popupGroup, this.towerCam, true, fh);
    this.collectibleGroup.visible = !isWardrobe;
    if (isWardrobe && this.enemyVisuals?.root) {
      this.enemyVisuals.root.visible = false;
    }

    // Planar Water Reflection Pass (culling fine micro-props & dynamic pools so reflection renders only sky + moon + monolith)
    if (this.ocean) {
      const prevWeatherVis = this.stormSky?.weatherPoints?.visible ?? false;
      const prevStreakVis = this.stormSky?.streakLines?.visible ?? false;
      const prevSprayVis = this.stormSky?.seaSprayPoints?.visible ?? false;
      const prevFireflyVis = this.stormSky?.fireflyPoints?.visible ?? false;
      const prevFlankMistVis = this.stormSky?.flankMistMesh?.visible ?? false;
      const prevEnemyRootVis = this.enemyVisuals?.root?.visible ?? !isWardrobe;
      const prevPogoVis = this.pogoRig.group.visible;
      const prevShieldVis = this.shieldBubble.visible;
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
        this.stormSky?.setReflectionPass(true);
        if (this.stormSky?.seaSprayPoints) this.stormSky.seaSprayPoints.visible = false;
        if (this.stormSky?.fireflyPoints) this.stormSky.fireflyPoints.visible = false;
        this.pogoRig.group.visible = false;
        this.shieldBubble.visible = false;
        this.landingRingGroup.visible = false;
        this.tunnelVortexGroup.visible = false;
        this.muzzleFlashGroup.visible = false;
        this.wardrobeFxOrb.visible = false;
        this.debrisPool.inst.visible = false;
        this.oceanVfx?.setVisible?.(false);
        this.collectibleGroup.visible = false;
        this.snowballGroup.visible = false;
        this.particleGroup.visible = false;
        this.popupGroup.visible = false;

        this.ocean.updateReflection(this.towerScene, this.towerCam);
      } finally {
        cached.setReflectionPass?.(false);
        if (this.enemyVisuals) {
          if (this.enemyVisuals.setReflectionPass) this.enemyVisuals.setReflectionPass(isWardrobe);
          if (this.enemyVisuals.root) this.enemyVisuals.root.visible = prevEnemyRootVis;
        }
        this.stormSky?.setReflectionPass(false);
        if (this.stormSky?.weatherPoints) this.stormSky.weatherPoints.visible = prevWeatherVis;
        if (this.stormSky?.streakLines) this.stormSky.streakLines.visible = prevStreakVis;
        if (this.stormSky?.seaSprayPoints) this.stormSky.seaSprayPoints.visible = prevSprayVis;
        if (this.stormSky?.fireflyPoints) this.stormSky.fireflyPoints.visible = prevFireflyVis;
        if (this.stormSky?.flankMistMesh) this.stormSky.flankMistMesh.visible = prevFlankMistVis;
        this.pogoRig.group.visible = prevPogoVis;
        this.shieldBubble.visible = prevShieldVis;
        this.landingRingGroup.visible = prevRingVis;
        this.tunnelVortexGroup.visible = prevTunnelVis;
        this.muzzleFlashGroup.visible = prevFlashVis;
        this.wardrobeFxOrb.visible = prevWardrobeVis;
        this.debrisPool.inst.visible = prevDebrisVis;
        this.oceanVfx?.setVisible?.(prevVfxVis);
        this.collectibleGroup.visible = prevCollectibleVis;
        this.snowballGroup.visible = true;
        this.particleGroup.visible = true;
        this.popupGroup.visible = true;
        this.keyLight.castShadow = prevKeyShadow;
      }
    }

    if (!isOrig) {
      this.webgl.shadowMap.needsUpdate = true;
    }
    this._renderWithComposer(this.towerScene, this.towerCam);
  }

  renderSubmarineScene(state) {
    if (!state?.sub && !state?.subStage) return;
    if (state.era && state.era !== this.era) this.setEra(state.era);
    const nextSkin = state.player?.skinId || state.skinId;
    if (nextSkin && nextSkin !== this.skinId) this.setSkin(nextSkin);
    const reqBlasterFx = state.player?.blasterFxId || state.blasterFxId;
    if (reqBlasterFx && reqBlasterFx !== this.blasterFxId) this.setBlasterFx(reqBlasterFx);

    const sr = this._ensureSubRenderer();
    if (!sr) return;
    if (typeof state.showSubHud === 'boolean') {
      sr.showHud = state.showSubHud;
    }
    const time = state.time ?? state.subStage?.t ?? state.sub?.timer ?? 0;
    this._lastTime = time;
    sr.render(state, {
      time,
      particles: state.particles,
      popups: state.popups,
      shake: state.shake,
      era: this.era,
      skinId: this.skinId,
      blasterFxId: this.blasterFxId,
    });
  }

  renderSkimmerScene(state) {
    if (!state?.skimmer) return;
    if (state.era && state.era !== this.era) this.setEra(state.era);
    const nextSkin = state.player?.skinId || state.skinId;
    if (nextSkin && nextSkin !== this.skinId) this.setSkin(nextSkin);
    const reqBlasterFx = state.player?.blasterFxId || state.blasterFxId;
    if (reqBlasterFx && reqBlasterFx !== this.blasterFxId) this.setBlasterFx(reqBlasterFx);

    const sr = this._ensureSkimmerRenderer();
    if (!sr) return;
    sr.render(state, { postfx: this.postfx });
  }

  renderGlideScene(state) {
    const stage = state?.glideStage || state?.glide;
    if (!stage) return;
    if (state.era && state.era !== this.era) this.setEra(state.era);
    const nextSkin = state.player?.skinId || state.skinId;
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
        era: this.era,
        skinId: this.skinId,
        player: state.player,
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
    if (state.era && state.era !== this.era) this.setEra(state.era);
    const nextSkin = state.player?.skinId || state.skinId;
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
        era: this.era,
        skinId: this.skinId,
        player: state.player,
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
    if (!state?.vault) return;
    if (state.era && state.era !== this.era) this.setEra(state.era);

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
    this.pogoRig?.dispose?.();
    this.subRenderer?.dispose?.();
    this.skimmerRenderer?.dispose?.();
    this.vaultRenderer?.dispose?.();
    this.glideRenderer?.dispose?.();
    this.puzzleRenderer?.dispose?.();

    this.debrisPool?.geo?.dispose();
    this.debrisPool?.mat?.dispose();
    this.shieldBubble?.geometry?.dispose();
    this.shieldBubble?.material?.dispose();
    this._disposeCollectibleMesh(this.landingRingGroup, true);
    this._disposeCollectibleMesh(this.tunnelVortexGroup, true);

    this.sharedParticleGeo?.dispose();
    this.sharedSnowballGeo?.dispose();
    this.sharedVoxelGeo?.dispose();
    this.sharedPrismGeo?.dispose();
    this.sharedFxRingGeo?.dispose();
    this.sharedTrailDotGeo?.dispose();
    this.sharedTrailClusterGeo?.dispose();
    this.sharedOrbitalTrailGeo?.dispose();
    this.sharedGearGeo?.dispose();
    this.sharedSnowballMat?.dispose();
    this.sharedFxRingMat?.dispose();
    this.sharedTrailDotMat?.dispose();
    this.sharedHaloSpriteMat?.dispose();
    this.sharedGearMat?.dispose();
    this.glowDotTex?.dispose();
    this.relicTabletTex?.dispose();
    this.keyLight?.shadow?.map?.dispose?.();
    this.envTex?.dispose();
    this.webgl?.dispose();
  }
}
