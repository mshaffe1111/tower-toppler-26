// TOWERING WATERS: GATEWAY'S DESCENT — ANCIENT AQUEDUCT SANCTUM 3D RENDERER (`src/puzzleRenderer.js`)
//
// Sunlit Temple Water-Vault & Aqueduct Logic Chamber Engine:
//   - Warm sunlit carved travertine-limestone & verdigris-bronze sanctum island surrounded by
//     flowing crystal-turquoise aqueduct water channels, pouring bronze water spouts, and spinning
//     brass rotary pipe valves (ZERO dark subterranean dungeons!).
//   - Exact 1:1 `room.view` (`v.fov`, `v.eye`, `v.target`) camera alignment (`X = x - (cols-1)/2`,
//     `Z = y - (rows-1)/2`, `floor y = 0`) so touch tap-to-tile & swipe navigation remain pixel-true.
//   - Supports all 4 solvable sanctum puzzle archetypes (`'lights'`, `'bells'`, `'beam'`, `'blocks'`)
//     using `assets/models/puzzle_props.glb` (`temple_bell` Harmonic Water-Bell, `prism_mirror`
//     Crystal Prism Turret, `push_monolith` Carved Sluice Block, `sanctum_brazier` Brass Rotary
//     Aqueduct Valve Sconce) + `GatewayRig` from `./gateway.js`.

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
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

let _gatewayModPromise = null;
function loadGatewayMod() {
  if (!_gatewayModPromise) _gatewayModPromise = import('./gateway.js').catch(() => null);
  return _gatewayModPromise;
}

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
    torso.castShadow = true;
    spine.add(torso);

    const belly = new THREE.Mesh(new THREE.CapsuleGeometry(0.10, 0.26, 6, 10), matBelly);
    belly.position.set(0, -0.01, 0.045);
    spine.add(belly);

    const head = new THREE.Mesh(new THREE.SphereGeometry(0.13, 14, 12), matScale);
    head.scale.set(0.9, 0.85, 1.25);
    head.position.set(0, 0.31, 0.05);
    head.castShadow = true;
    spine.add(head);

    for (const sx of [-1, 1]) {
      const frill = new THREE.Mesh(new THREE.ConeGeometry(0.085, 0.26, 5), matFrill);
      frill.position.set(sx * 0.10, 0.34, -0.04);
      frill.rotation.set(-0.9, 0, -sx * 0.55);
      spine.add(frill);

      const leg = new THREE.Mesh(new THREE.CapsuleGeometry(0.048, 0.28, 6, 10), matScale);
      leg.position.set(sx * 0.12, -0.34, 0);
      leg.castShadow = true;
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
      seg.castShadow = true;
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

function createAshlarLimestoneTexture(size = 256) {
  if (typeof document === 'undefined' || typeof document.createElement !== 'function') {
    const d = new Uint8Array([224, 215, 198, 255]);
    const t = new THREE.DataTexture(d, 1, 1, THREE.RGBAFormat);
    t.wrapS = THREE.RepeatWrapping;
    t.wrapT = THREE.RepeatWrapping;
    t.needsUpdate = true;
    return t;
  }
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#e2d9c6';
  ctx.fillRect(0, 0, size, size);
  const rows = 6;
  const cols = 4;
  const rh = size / rows;
  const cw = size / cols;
  for (let r = 0; r < rows; r++) {
    const off = (r % 2) * (cw * 0.5);
    for (let col = -1; col <= cols; col++) {
      const bx = col * cw + off;
      const by = r * rh;
      const shade = 218 + (((r * 7 + col * 13) & 3) - 1.5) * 6;
      ctx.fillStyle = `rgb(${Math.round(shade * 1.03)}, ${Math.round(shade * 0.99)}, ${Math.round(shade * 0.91)})`;
      ctx.fillRect(bx + 2, by + 2, cw - 4, rh - 4);
      ctx.strokeStyle = 'rgba(128, 114, 92, 0.42)';
      ctx.lineWidth = 2;
      ctx.strokeRect(bx + 2, by + 2, cw - 4, rh - 4);
    }
  }
  // Turquoise mosaic frieze band near top
  ctx.fillStyle = 'rgba(20, 184, 166, 0.42)';
  ctx.fillRect(0, 10, size, 12);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createSanctumCausticTex(size = 256) {
  if (typeof document === 'undefined' || typeof document.createElement !== 'function') {
    const d = new Uint8Array([34, 211, 238, 255]);
    const t = new THREE.DataTexture(d, 1, 1, THREE.RGBAFormat);
    t.wrapS = THREE.RepeatWrapping;
    t.wrapT = THREE.RepeatWrapping;
    t.needsUpdate = true;
    return t;
  }
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#0891b2';
  ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < 84; i++) {
    const x = (i * 59) % size;
    const y = (i * 97) % size;
    const r = 14 + (i % 24);
    const g = ctx.createRadialGradient(x, y, 2, x, y, r);
    g.addColorStop(0, 'rgba(207, 250, 254, 0.46)');
    g.addColorStop(0.6, 'rgba(94, 252, 232, 0.16)');
    g.addColorStop(1, 'rgba(8, 145, 178, 0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function buildSanctumEnvMap(webgl) {
  if (!webgl || typeof THREE.PMREMGenerator !== 'function') return null;
  try {
    const pmrem = new THREE.PMREMGenerator(webgl);
    const s = new THREE.Scene();
    s.background = new THREE.Color('#7dd3fc');
    const sun = new THREE.Mesh(
      new THREE.SphereGeometry(8, 12, 8),
      new THREE.MeshBasicMaterial({ color: '#fffbeb', side: THREE.BackSide })
    );
    sun.position.set(6, 12, 8);
    s.add(sun);
    const travBounce = new THREE.Mesh(
      new THREE.SphereGeometry(10, 12, 8),
      new THREE.MeshBasicMaterial({ color: '#f5efe2', side: THREE.BackSide })
    );
    travBounce.position.set(-6, 4, -6);
    s.add(travBounce);
    const pool = new THREE.Mesh(
      new THREE.PlaneGeometry(40, 40),
      new THREE.MeshBasicMaterial({ color: '#22d3ee', side: THREE.DoubleSide })
    );
    pool.rotation.x = -Math.PI * 0.5;
    pool.position.y = -3;
    s.add(pool);
    const rt = pmrem.fromScene(s, 0.04);
    pmrem.dispose();
    return rt.texture;
  } catch {
    return null;
  }
}

function createTravertineTileTexture(size = 256) {
  if (typeof document === 'undefined' || typeof document.createElement !== 'function') {
    const d = new Uint8Array([220, 212, 195, 255]);
    const t = new THREE.DataTexture(d, 1, 1, THREE.RGBAFormat);
    t.needsUpdate = true;
    return t;
  }
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#ddd4c1';
  ctx.fillRect(0, 0, size, size);
  ctx.strokeStyle = 'rgba(120, 108, 88, 0.45)';
  ctx.lineWidth = 6;
  ctx.strokeRect(8, 8, size - 16, size - 16);
  ctx.strokeStyle = 'rgba(255, 252, 244, 0.55)';
  ctx.lineWidth = 2;
  ctx.strokeRect(16, 16, size - 32, size - 32);
  // Subtle turquoise aqueduct inlay corner accents
  ctx.fillStyle = 'rgba(45, 212, 191, 0.35)';
  for (const [cx, cy] of [
    [24, 24],
    [size - 34, 24],
    [24, size - 34],
    [size - 34, size - 34],
  ]) {
    ctx.fillRect(cx, cy, 10, 10);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

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

    this.tileTex = createTravertineTileTexture(256);
    this.wallTex = createAshlarLimestoneTexture(256);
    this.wallTex.repeat.set(3, 1.5);
    this.causticWaterTex = createSanctumCausticTex(256);
    this.causticWaterTex.repeat.set(8, 8);
    this.envTex = buildSanctumEnvMap(webgl);
    this._initScene();
    this._loadPropsGlb();
  }

  setEra(_era) {}

  setSkin(skinId) {
    if (!skinId || this.skinId === skinId) return;
    this.skinId = skinId;
    this.hero?.setSkin(skinId);
  }

  prewarm() {
    try {
      this.webgl?.compile?.(this.scene, this.camera);
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
    // Bright sunlit turquoise-cerulean open temple atrium sky!
    this.scene.background = new THREE.Color('#7dd3fc');
    this.scene.fog = new THREE.Fog('#bae6fd', 20, 52);
    if (this.envTex) {
      this.scene.environment = this.envTex;
      this.scene.environmentIntensity = 0.72;
    }

    this.camera = new THREE.PerspectiveCamera(42, this.width / Math.max(1, this.height), 0.2, 95);

    // Sunlit Aqueduct Atrium Lighting + Real-Time Soft Shadows
    this.hemiLight = new THREE.HemisphereLight('#fffbeb', '#2dd4bf', 1.25);
    this.scene.add(this.hemiLight);

    this.sunLight = new THREE.DirectionalLight('#fff7ed', 2.35);
    this.sunLight.position.set(6.5, 12.5, 7.5);
    this.sunLight.castShadow = true;
    this.sunLight.shadow.mapSize.set(1024, 1024);
    this.sunLight.shadow.camera.near = 2;
    this.sunLight.shadow.camera.far = 28;
    this.sunLight.shadow.camera.left = -6.5;
    this.sunLight.shadow.camera.right = 6.5;
    this.sunLight.shadow.camera.top = 6.5;
    this.sunLight.shadow.camera.bottom = -6.5;
    this.sunLight.shadow.bias = -0.0006;
    this.scene.add(this.sunLight);

    this.waterBounce = new THREE.DirectionalLight('#22d3ee', 0.72);
    this.waterBounce.position.set(-6, 3, -5);
    this.scene.add(this.waterBounce);

    // Flowing Sunlit Turquoise Aqueduct Water Pool around the Sanctum Terrace
    this.waterMat = new THREE.MeshStandardMaterial({
      color: '#22d3ee',
      map: this.causticWaterTex,
      bumpMap: this.causticWaterTex,
      bumpScale: 0.08,
      emissive: '#0891b2',
      emissiveMap: this.causticWaterTex,
      emissiveIntensity: 0.42,
      roughness: 0.09,
      metalness: 0.18,
      transparent: true,
      opacity: 0.94,
    });
    this.waterMesh = new THREE.Mesh(new THREE.PlaneGeometry(46, 46, 28, 28), this.waterMat);
    this.waterMesh.rotation.x = -Math.PI * 0.5;
    this.waterMesh.position.y = WATER_Y;
    this.waterMesh.receiveShadow = true;
    this.scene.add(this.waterMesh);

    // Perimeter Sunlit Travertine Colonade Arches, Flowing Water Troughs & Pouring Spouts
    this.sanctumFrame = new THREE.Group();
    const travMat = new THREE.MeshStandardMaterial({
      color: '#ebe3d3',
      map: this.wallTex,
      bumpMap: this.wallTex,
      bumpScale: 0.12,
      roughness: 0.52,
    });
    const brassMat = new THREE.MeshStandardMaterial({
      color: '#e5a945',
      emissive: '#3d2508',
      emissiveIntensity: 0.16,
      roughness: 0.22,
      metalness: 0.82,
    });
    const troughWaterMat = new THREE.MeshStandardMaterial({
      color: '#22d3ee',
      emissive: '#06b6d4',
      emissiveIntensity: 0.65,
      roughness: 0.08,
    });

    // North Aqueduct Sanctuary Wall, Fluted Travertine Columns, Overhead Water Trough & Rising Gate
    const backWall = new THREE.Mesh(new THREE.BoxGeometry(9.6, 3.8, 0.75), travMat);
    backWall.position.set(0, 1.5, -4.4);
    backWall.receiveShadow = true;
    const trough = new THREE.Mesh(new THREE.BoxGeometry(9.8, 0.35, 0.95), brassMat);
    trough.position.set(0, 3.45, -4.35);
    const troughStream = new THREE.Mesh(new THREE.BoxGeometry(9.6, 0.14, 0.72), troughWaterMat);
    troughStream.position.set(0, 3.58, -4.35);
    this.sanctumFrame.add(backWall, trough, troughStream);

    for (const cx of [-4.45, -1.75, 1.75, 4.45]) {
      const colMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.28, 3.7, 14), travMat);
      colMesh.position.set(cx, 1.48, -3.98);
      colMesh.castShadow = true;
      const capMesh = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.22, 0.68), brassMat);
      capMesh.position.set(cx, 3.28, -3.98);
      this.sanctumFrame.add(colMesh, capMesh);
    }

    // Twin pouring waterfall spouts flanking the Sanctum Gate + Spinning Brass Rotary Valves!
    this.rotaryValves = [];
    for (const sx of [-3.4, 3.4]) {
      const spout = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.65, 10), brassMat);
      spout.rotation.x = Math.PI * 0.5;
      spout.position.set(sx, 2.8, -3.95);
      const stream = new THREE.Mesh(
        new THREE.CylinderGeometry(0.11, 0.18, 3.2, 10),
        new THREE.MeshBasicMaterial({ color: '#67e8f9', transparent: true, opacity: 0.75 })
      );
      stream.position.set(sx, 1.2, -3.72);

      const valveWheel = new THREE.Group();
      valveWheel.position.set(sx * 0.68, 1.45, -3.98);
      valveWheel.add(new THREE.Mesh(new THREE.TorusGeometry(0.32, 0.045, 8, 18), brassMat));
      for (let k = 0; k < 4; k++) {
        const spoke = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.045, 0.04), brassMat);
        spoke.rotation.z = (k * Math.PI) / 4;
        valveWheel.add(spoke);
      }
      this.rotaryValves.push(valveWheel);
      this.sanctumFrame.add(spout, stream, valveWheel);
    }

    // Rising Carved Sanctum Gate Slab & Clue Mural Canvas
    this.gateSlab = new THREE.Mesh(
      new THREE.BoxGeometry(2.2, 2.6, 0.32),
      new THREE.MeshStandardMaterial({ color: '#3d7a74', roughness: 0.38, metalness: 0.65 })
    );
    this.gateSlab.position.set(0, 1.3, -4.15);
    this.sanctumFrame.add(this.gateSlab);

    this.clueCanvas = typeof document !== 'undefined' ? document.createElement('canvas') : null;
    if (this.clueCanvas) {
      this.clueCanvas.width = 256;
      this.clueCanvas.height = 128;
      this.clueTex = new THREE.CanvasTexture(this.clueCanvas);
      this.clueTex.colorSpace = THREE.SRGBColorSpace;
      this.clueBoard = new THREE.Mesh(
        new THREE.PlaneGeometry(2.4, 1.2),
        new THREE.MeshBasicMaterial({ map: this.clueTex, transparent: true })
      );
      this.clueBoard.position.set(0, 2.55, -3.98);
      this.sanctumFrame.add(this.clueBoard);
    }
    this._lastClueKey = '';
    this.scene.add(this.sanctumFrame);

    // Stepped Travertine Puzzle Plinth & Tile Grid (`MAX_TILES`)
    this.islandBase = new THREE.Mesh(
      new THREE.BoxGeometry(6.4, 0.55, 6.4),
      new THREE.MeshStandardMaterial({ color: '#c8bea8', roughness: 0.62 })
    );
    this.islandBase.position.y = -0.32;
    this.islandBase.receiveShadow = true;
    this.scene.add(this.islandBase);

    this.tileInst = new THREE.InstancedMesh(
      new THREE.BoxGeometry(0.94, 0.16, 0.94),
      new THREE.MeshStandardMaterial({
        color: '#ffffff',
        map: this.tileTex,
        roughness: 0.48,
        metalness: 0.06,
      }),
      MAX_TILES
    );
    this.tileInst.receiveShadow = true;
    this.tileInst.frustumCulled = false;
    this.scene.add(this.tileInst);

    // Glowing Hydro-Glyph Overlays for `'lights'` Mosaic & `'blocks'` Sluice Basins
    this.glyphInst = new THREE.InstancedMesh(
      new THREE.BoxGeometry(0.68, 0.04, 0.68),
      new THREE.MeshStandardMaterial({
        color: '#ffffff',
        emissive: '#22d3ee',
        emissiveIntensity: 0.95,
        roughness: 0.15,
      }),
      MAX_TILES
    );
    this.glyphInst.frustumCulled = false;
    this.scene.add(this.glyphInst);

    // 4-Archetype Prop Pools (`temple_bell`, `prism_mirror`, `push_monolith`, `sanctum_brazier` + Emitter/Crystal/Beam)
    this.bellSlots = [];
    for (let i = 0; i < MAX_BELLS; i++) {
      const root = new THREE.Group();
      const yoke = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.05, 8, 16, Math.PI), brassMat);
      yoke.position.y = 0.85;
      const bellPiv = new THREE.Group();
      bellPiv.position.y = 1.18;
      const bellCone = new THREE.Mesh(
        new THREE.ConeGeometry(0.28, 0.52, 16),
        new THREE.MeshStandardMaterial({ color: '#fbbf24', metalness: 0.82, roughness: 0.22 })
      );
      bellCone.position.y = -0.26;
      bellCone.castShadow = true;
      bellPiv.add(bellCone);
      const badge = new THREE.Mesh(
        new THREE.RingGeometry(0.32, 0.44, 20),
        new THREE.MeshBasicMaterial({ color: '#ffffff', side: THREE.DoubleSide })
      );
      badge.rotation.x = -Math.PI * 0.5;
      badge.position.y = 0.02;
      root.add(yoke, bellPiv, badge);
      root.visible = false;
      this.scene.add(root);
      this.bellSlots.push({ root, yoke, bellPiv, badge });
    }

    this.mirrorSlots = [];
    const crystalMirrorMat = new THREE.MeshStandardMaterial({
      color: '#e0f7ff',
      emissive: '#38bdf8',
      emissiveIntensity: 0.45,
      metalness: 0.88,
      roughness: 0.05,
    });
    for (let i = 0; i < MAX_MIRRORS; i++) {
      const root = new THREE.Group();
      const base = new THREE.Mesh(new THREE.CylinderGeometry(0.30, 0.36, 0.28, 12), travMat);
      base.position.y = 0.14;
      const turret = new THREE.Group();
      turret.position.y = 0.28;
      const pane = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.82, 0.06), crystalMirrorMat);
      pane.position.y = 0.48;
      pane.castShadow = true;
      turret.add(pane);
      root.add(base, turret);
      root.visible = false;
      this.scene.add(root);
      this.mirrorSlots.push({ root, base, turret });
    }

    this.blockSlots = [];
    for (let i = 0; i < MAX_BLOCKS; i++) {
      const root = new THREE.Group();
      const fb = new THREE.Mesh(
        new THREE.BoxGeometry(0.80, 0.84, 0.80),
        new THREE.MeshStandardMaterial({ color: '#c8bea8', roughness: 0.5, metalness: 0.1 })
      );
      fb.position.y = 0.42;
      fb.castShadow = true;
      root.add(fb);
      root.visible = false;
      this.scene.add(root);
      this.blockSlots.push({ root, fb });
    }

    this.valveSconces = [];
    for (let i = 0; i < MAX_VALVE_SCONCES; i++) {
      const root = new THREE.Group();
      const col = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.22, 0.9, 10), brassMat);
      col.position.y = 0.45;
      root.add(col);
      this.scene.add(root);
      this.valveSconces.push({ root, fb: col });
    }

    // Prism Source Emitter, Target Receptor Crystal & Volumetric Prism Light Beam!
    this.beamEmitter = new THREE.Mesh(
      new THREE.CylinderGeometry(0.24, 0.32, 0.95, 12),
      new THREE.MeshStandardMaterial({ color: '#d49b3d', emissive: '#38bdf8', emissiveIntensity: 0.65, metalness: 0.82 })
    );
    this.beamEmitter.visible = false;
    this.scene.add(this.beamEmitter);

    this.beamReceptor = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.38, 0),
      new THREE.MeshStandardMaterial({ color: '#5efce8', emissive: '#06b6d4', emissiveIntensity: 1.4, roughness: 0.08 })
    );
    this.beamReceptor.visible = false;
    this.scene.add(this.beamReceptor);

    const beamGeo = new THREE.CylinderGeometry(0.065, 0.065, 1, 8);
    beamGeo.rotateX(Math.PI * 0.5);
    beamGeo.translate(0, 0, 0.5);
    this.beamInst = new THREE.InstancedMesh(
      beamGeo,
      new THREE.MeshBasicMaterial({
        color: '#5efce8',
        transparent: true,
        opacity: 0.88,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
      MAX_BEAM_SEGS
    );
    this.beamInst.frustumCulled = false;
    this.scene.add(this.beamInst);

    // Gateway Heroine + Rising Solved Harmonic Seed Orb + Sunlit Water-Mist Motes
    this.hero = new AdaptiveSanctumHero(this.skinId);
    this.hero.group.scale.setScalar(1.08);
    this.scene.add(this.hero.group);

    this.rewardOrb = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.28, 1),
      new THREE.MeshStandardMaterial({
        color: '#fde047',
        emissive: '#5efce8',
        emissiveIntensity: 1.6,
        roughness: 0.08,
      })
    );
    this.rewardOrb.visible = false;
    this.scene.add(this.rewardOrb);

    this.moteInst = new THREE.InstancedMesh(
      new THREE.SphereGeometry(0.04, 6, 6),
      new THREE.MeshBasicMaterial({
        color: '#fef9c3',
        transparent: true,
        opacity: 0.72,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
      MAX_MOTES
    );
    this.moteInst.frustumCulled = false;
    this.scene.add(this.moteInst);
  }

  _loadPropsGlb() {
    if (typeof window === 'undefined' || typeof fetch !== 'function') return;
    try {
      const loader = new GLTFLoader();
      loader.load(
        'assets/models/puzzle_props.glb',
        (gltf) => {
          if (this._disposed || !gltf?.scene) return;
          const scene = gltf.scene;
          const bellSrc = scene.getObjectByName('temple_bell');
          const mirSrc = scene.getObjectByName('prism_mirror');
          const monoSrc = scene.getObjectByName('push_monolith');
          const brazSrc = scene.getObjectByName('sanctum_brazier');

          if (bellSrc) {
            for (const slot of this.bellSlots) {
              slot.yoke.visible = false;
              slot.bellPiv.clear();
              const cl = bellSrc.clone(true);
              cl.position.set(0, 0, 0);
              cl.traverse((o) => {
                if (o.isMesh) o.castShadow = true;
              });
              const body = cl.getObjectByName('bell_body');
              if (body) {
                slot.bellPiv.position.copy(body.position);
                body.position.set(0, 0, 0);
                slot.bellPiv.add(body);
              }
              slot.root.add(cl);
            }
          }
          if (mirSrc) {
            for (const slot of this.mirrorSlots) {
              slot.base.visible = false;
              slot.turret.clear();
              const cl = mirSrc.clone(true);
              cl.position.set(0, 0, 0);
              cl.traverse((o) => {
                if (o.isMesh) o.castShadow = true;
              });
              const tur = cl.getObjectByName('mirror_turret');
              if (tur) {
                slot.turret.position.copy(tur.position);
                tur.position.set(0, 0, 0);
                slot.turret.add(tur);
              }
              slot.root.add(cl);
            }
          }
          if (monoSrc) {
            for (const slot of this.blockSlots) {
              slot.fb.visible = false;
              const cl = monoSrc.clone(true);
              cl.position.set(0, 0, 0);
              cl.traverse((o) => {
                if (o.isMesh) o.castShadow = true;
              });
              slot.root.add(cl);
            }
          }
          if (brazSrc) {
            for (const slot of this.valveSconces) {
              slot.fb.visible = false;
              const cl = brazSrc.clone(true);
              cl.position.set(0, 0, 0);
              slot.root.add(cl);
            }
          }
        },
        undefined,
        () => {}
      );
    } catch {
      // Ignore offline fallback
    }
  }

  _updateClueBoard(room) {
    if (!this.clueCanvas) return;
    const p = room.puzzle;
    const show = Boolean(room.showTarget || room.isPeekingClue || room.solved);
    this.clueBoard.visible = show && (p.type === 'lights' || p.type === 'bells');
    if (!this.clueBoard.visible) return;

    const key = `${p.type}_${p.n || ''}_${(p.target || p.order || []).join(',')}`;
    if (this._lastClueKey === key) return;
    this._lastClueKey = key;

    const ctx = this.clueCanvas.getContext('2d');
    ctx.fillStyle = 'rgba(15, 42, 58, 0.88)';
    ctx.fillRect(0, 0, 256, 128);
    ctx.strokeStyle = '#5efce8';
    ctx.lineWidth = 4;
    ctx.strokeRect(6, 6, 244, 116);

    if (p.type === 'lights' && p.target) {
      const n = p.n || 3;
      const cell = Math.floor(92 / n);
      const x0 = 128 - (n * cell) * 0.5;
      const y0 = 64 - (n * cell) * 0.5;
      for (let i = 0; i < n * n; i++) {
        const gx = i % n;
        const gy = (i / n) | 0;
        ctx.fillStyle = p.target[i] ? '#5efce8' : '#1e3a4c';
        ctx.fillRect(x0 + gx * cell + 2, y0 + gy * cell + 2, cell - 4, cell - 4);
      }
    } else if (p.type === 'bells' && p.order) {
      const order = p.order;
      const spacing = 190 / Math.max(1, order.length);
      for (let i = 0; i < order.length; i++) {
        const bell = room.bells?.[order[i]];
        const col = BELL_COLORS[bell?.color ?? order[i] % BELL_COLORS.length] || '#fde047';
        ctx.fillStyle = col;
        ctx.beginPath();
        ctx.arc(33 + (i + 0.5) * spacing, 64, 15, 0, TAU);
        ctx.fill();
      }
    }
    this.clueTex.needsUpdate = true;
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

    // Scale island plinth & back aqueduct arch cleanly to puzzle room dimensions
    this.islandBase.scale.set((cols + 0.6) / 6.4, 1, (rows + 0.8) / 6.4);
    this.sanctumFrame.position.z = -oz + 3.1;
    this.gateSlab.position.y = 1.3 + (room.gateOpen || 0) * 2.15;
    for (let i = 0; i < this.rotaryValves.length; i++) {
      this.rotaryValves[i].rotation.z = time * (0.8 + (room.progressRatio || 0) * 2.5) * (i % 2 ? 1 : -1);
    }
    this._updateClueBoard(room);

    // Position Perimeter Aqueduct Valve Sconces
    for (let i = 0; i < MAX_VALVE_SCONCES; i++) {
      const sc = this.valveSconces[i];
      const side = i % 2 === 0 ? -1 : 1;
      const rowOff = -oz + (Math.floor(i / 2) / 2) * (rows - 1);
      sc.root.position.set(side * (ox + 0.95), 0, rowOff);
    }

    // Build Tile Grid + Entrance Threshold
    const dm = this._dummy;
    let tCnt = 0;
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols && tCnt < MAX_TILES; x++) {
        dm.position.set(x - ox, -0.08, y - oz);
        dm.rotation.set(0, 0, 0);
        dm.scale.setScalar(1);
        dm.updateMatrix();
        this._col.set((x + y) % 2 === 0 ? '#ebe3d3' : '#dcd2be');
        this.tileInst.setColorAt(tCnt, this._col);
        this.tileInst.setMatrixAt(tCnt++, dm.matrix);
      }
    }
    if (tCnt < MAX_TILES) {
      dm.position.set((room.doorX ?? 2) - ox, -0.08, rows - oz);
      dm.scale.setScalar(1);
      dm.updateMatrix();
      this._col.set('#cbd5e1');
      this.tileInst.setColorAt(tCnt, this._col);
      this.tileInst.setMatrixAt(tCnt++, dm.matrix);
    }
    this.tileInst.count = tCnt;
    this.tileInst.instanceMatrix.needsUpdate = true;
    if (this.tileInst.instanceColor) this.tileInst.instanceColor.needsUpdate = true;

    // Reset Archetype Pools
    let gCnt = 0;
    let bSegCnt = 0;
    this.beamEmitter.visible = false;
    this.beamReceptor.visible = false;
    for (const s of this.bellSlots) s.root.visible = false;
    for (const s of this.mirrorSlots) s.root.visible = false;
    for (const s of this.blockSlots) s.root.visible = false;

    const pType = room.type || room.puzzle.type;
    if (pType === 'lights' && room.lit) {
      const n = room.n || room.puzzle.n || 3;
      const gx0 = room.puzzle.gx ?? 1;
      const gy0 = room.puzzle.gy ?? 1;
      for (let i = 0; i < n * n && gCnt < MAX_TILES; i++) {
        const tx = gx0 + (i % n) - ox;
        const tz = gy0 + ((i / n) | 0) - oz;
        const isLit = Boolean(room.lit[i]);
        dm.position.set(tx, 0.02, tz);
        dm.rotation.set(0, 0, 0);
        dm.scale.set(1, isLit ? 1.4 : 0.7, 1);
        dm.updateMatrix();
        this._col.set(isLit ? '#22d3ee' : '#64748b');
        this.glyphInst.setColorAt(gCnt, this._col);
        this.glyphInst.setMatrixAt(gCnt++, dm.matrix);
      }
    } else if (pType === 'bells' && room.bells) {
      for (let i = 0; i < room.bells.length && i < MAX_BELLS; i++) {
        const b = room.bells[i];
        const slot = this.bellSlots[i];
        slot.root.visible = true;
        slot.root.position.set(b.x - ox, 0, b.y - oz);
        const colHex = BELL_COLORS[b.color % BELL_COLORS.length] || '#fde047';
        slot.badge.material.color.set(colHex);
        const age = time - (b.ringAt ?? -10);
        slot.bellPiv.rotation.z = age >= 0 && age < 1.2 ? Math.sin(age * 18) * Math.exp(-age * 3) * 0.45 : 0;
      }
    } else if (pType === 'beam') {
      if (room.source) {
        this.beamEmitter.visible = true;
        this.beamEmitter.position.set(room.source.x - ox, 0.48, room.source.y - oz);
      }
      if (room.crystal) {
        this.beamReceptor.visible = true;
        this.beamReceptor.position.set(room.crystal.x - ox, BEAM_Y + Math.sin(time * 3) * 0.06, room.crystal.y - oz);
        this.beamReceptor.rotation.y = time * 2.2;
      }
      const mirrors = room.mirrors || [];
      for (let i = 0; i < mirrors.length && i < MAX_MIRRORS; i++) {
        const m = mirrors[i];
        const slot = this.mirrorSlots[i];
        slot.root.visible = true;
        slot.root.position.set(m.x - ox, 0, m.y - oz);
        slot.turret.rotation.y = -(m.angle ?? 0);
      }
      const bm = room.beam;
      if (bm && bm.n >= 2 && bm.pts) {
        for (let i = 0; i < bm.n - 1 && bSegCnt < MAX_BEAM_SEGS; i++) {
          const x0 = bm.pts[i * 2] - ox;
          const z0 = bm.pts[i * 2 + 1] - oz;
          const x1 = bm.pts[(i + 1) * 2] - ox;
          const z1 = bm.pts[(i + 1) * 2 + 1] - oz;
          const dx = x1 - x0;
          const dz = z1 - z0;
          const len = Math.hypot(dx, dz);
          if (len < 0.01) continue;
          dm.position.set(x0, BEAM_Y, z0);
          dm.rotation.set(0, Math.atan2(dx, dz), 0);
          dm.scale.set(1, 1, len);
          dm.updateMatrix();
          this.beamInst.setMatrixAt(bSegCnt++, dm.matrix);
        }
      }
    } else if (pType === 'blocks') {
      const plates = room.plates || [];
      for (let i = 0; i < plates.length && gCnt < MAX_TILES; i++) {
        const pl = plates[i];
        dm.position.set(pl.x - ox, 0.02, pl.y - oz);
        dm.rotation.set(0, 0, 0);
        dm.scale.setScalar(1.08);
        dm.updateMatrix();
        this._col.set(pl.pressed > 0.5 ? '#34d399' : '#f59e0b');
        this.glyphInst.setColorAt(gCnt, this._col);
        this.glyphInst.setMatrixAt(gCnt++, dm.matrix);
      }
      const blocks = room.blocks || [];
      for (let i = 0; i < blocks.length && i < MAX_BLOCKS; i++) {
        const bl = blocks[i];
        const slot = this.blockSlots[i];
        slot.root.visible = true;
        slot.root.position.set((bl.px ?? bl.x) - ox, 0, (bl.py ?? bl.y) - oz);
      }
    }

    this.glyphInst.count = gCnt;
    this.beamInst.count = bSegCnt;
    if (gCnt > 0) {
      this.glyphInst.instanceMatrix.needsUpdate = true;
      if (this.glyphInst.instanceColor) this.glyphInst.instanceColor.needsUpdate = true;
    }
    if (bSegCnt > 0) this.beamInst.instanceMatrix.needsUpdate = true;

    // Update Gateway Heroine Position, Facing & Pose on the Sanctum Grid
    const gw = room.gateway || room.hero || room.player;
    if (gw) {
      const hx = (gw.px ?? gw.x ?? 0) - ox;
      const hz = (gw.py ?? gw.y ?? 0) - oz;
      const hy = Math.max(0, gw.hop || 0) * 0.48;
      // Directions in PuzzleRoom: 0 east (+X), 1 south (+Z), 2 west (-X), 3 north (-Z)
      const dirYaws = [Math.PI * 0.5, 0, -Math.PI * 0.5, Math.PI];
      const targetYaw = dirYaws[(gw.facing ?? 3) & 3];
      let dYaw = ((targetYaw - this._heroYaw + Math.PI) % TAU) - Math.PI;
      if (dYaw < -Math.PI) dYaw += TAU;
      this._heroYaw += dYaw * Math.min(1, dt * 14);

      this.hero.group.visible = (gw.alpha ?? 1) > 0.05;
      this.hero.group.position.set(hx, hy, hz);
      this.hero.group.rotation.y = this._heroYaw;
      this.hero.update(dt, {
        time,
        vx: gw.moving ? 2.6 : 0,
        vy: hy > 0.02 ? 1.5 : 0,
        onGround: hy <= 0.02,
        anim: room.solved ? 'Celebrate' : hy > 0.02 ? 'AirRise' : gw.moving ? 'Walk' : 'IdleBreathe',
        victory: Boolean(room.solved),
      });
    }

    // Solved Harmonic Seed Reward Orb
    if (room.solved) {
      this.rewardOrb.visible = true;
      this.rewardOrb.position.set(0, 1.25 + Math.sin(time * 3.5) * 0.14, 0);
      this.rewardOrb.rotation.set(time * 1.8, time * 2.6, 0);
    } else {
      this.rewardOrb.visible = false;
    }

    // Sunlit Aqueduct Mist Motes
    for (let i = 0; i < MAX_MOTES; i++) {
      const mx = Math.sin(i * 1.7 + time * 0.35) * 4.2;
      const my = 0.25 + ((i * 0.19 + time * 0.28) % 3.2);
      const mz = Math.cos(i * 2.3 + time * 0.3) * 4.2;
      dm.position.set(mx, my, mz);
      dm.scale.setScalar(0.8 + Math.sin(time * 3 + i) * 0.3);
      dm.updateMatrix();
      this.moteInst.setMatrixAt(i, dm.matrix);
    }
    this.moteInst.count = MAX_MOTES;
    this.moteInst.instanceMatrix.needsUpdate = true;

    // Sync Camera 1:1 with `room.view` so tap-to-tile & swipe coordinates match identically!
    const v = room.view;
    if (v && v.eye && v.target) {
      const kIn = room.phase === 'intro' ? 1 - smooth01((room.phaseT || 0) / INTRO_T) : 0;
      const sh = (Number(opts.shake) || 0) * 0.018;
      const ex = v.eye[0] + Math.sin(time * 0.25) * 0.05 + (sh > 0 ? Math.sin(time * 67) * sh : 0);
      const ey = v.eye[1] - kIn * kIn * 1.2 + (sh > 0 ? Math.cos(time * 59) * sh : 0);
      const ez = v.eye[2] + kIn * kIn * 1.8;
      this.camera.position.set(ex, ey, ez);
      this.camera.lookAt(v.target[0], v.target[1], v.target[2]);
      this.camera.fov = v.fov || 42;
      this.camera.aspect = Math.max(0.35, this.width / Math.max(1, this.height));
      this.camera.updateProjectionMatrix();
    }

    this.causticWaterTex?.offset.set((time * 0.03) % 1, (time * 0.02) % 1);
    this.webgl.setRenderTarget(null);
    this.webgl.render(this.scene, this.camera);
  }

  dispose() {
    if (this._disposed) return;
    this._disposed = true;
    this.hero?.dispose();
    this.tileTex?.dispose();
    this.wallTex?.dispose();
    this.causticWaterTex?.dispose();
    this.envTex?.dispose();
    this.clueTex?.dispose();
  }
}

export { PuzzleRenderer as SanctumPuzzleRenderer };
export default PuzzleRenderer;
