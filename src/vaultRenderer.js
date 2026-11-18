// TOWERING WATERS: GATEWAY'S DESCENT — ANCIENT AQUEDUCT VALVE VAULT 3D RENDERER (`src/vaultRenderer.js`)
//
// Sunlit Temple Aqueduct Rotunda & Concentric Brass Rotary Water-Lock Engine:
//   - Sunlit carved travertine-limestone & verdigris-bronze barrel rotunda illuminated by a warm
//     golden sky oculus, flanking pouring water troughs, and crystal-turquoise aqueduct basin below.
//   - 3 concentric machined Aqueduct-Brass & Sea-Glass Rotary Sluice Valve Rings (`RING_RADII =
//     [2.22, 1.64, 1.08]`) with exact `delta = wrapAngle(ring.angle - ring.targetAngle)` 12-o'clock
//     caliper alignment, meshing planetary gears, and pressurized turquoise water conduits igniting
//     inward toward the central **Harmonic Water Seed Fountain**!
//   - Loads `assets/models/puzzle_props.glb` (`sanctum_brazier` Brass Rotary Aqueduct Valve &
//     Water-Lotus Fountain) with sculpted Frame-0 procedural fallbacks.

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const TAU = Math.PI * 2;
const RING_RADII = [2.22, 1.64, 1.08];
const RING_Z = [0.06, 0.15, 0.24];
const WATER_Y = -2.85;
const MAX_MOTES = 120;
const MAX_STRIKE_GEMS = 5;

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;

function wrapAngle(a) {
  let r = a % TAU;
  if (r > Math.PI) r -= TAU;
  if (r < -Math.PI) r += TAU;
  return r;
}

function buildNotchArcGeo(radius, tube, arcSpan) {
  return new THREE.TorusGeometry(radius, tube, 10, 28, arcSpan);
}

function buildVaultEnvMap(webgl) {
  if (!webgl || typeof THREE.PMREMGenerator !== 'function') return null;
  try {
    const pmrem = new THREE.PMREMGenerator(webgl);
    const s = new THREE.Scene();
    s.background = new THREE.Color('#7dd3fc');
    const sun = new THREE.Mesh(
      new THREE.SphereGeometry(8, 12, 8),
      new THREE.MeshBasicMaterial({ color: '#fffbeb', side: THREE.BackSide })
    );
    sun.position.set(5, 12, 9);
    s.add(sun);
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

function createRotundaStoneTex(size = 256) {
  if (typeof document === 'undefined' || typeof document.createElement !== 'function') {
    const d = new Uint8Array([220, 212, 195, 255]);
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
  ctx.fillStyle = '#dfd6c3';
  ctx.fillRect(0, 0, size, size);
  for (let r = 0; r < 8; r++) {
    const off = (r % 2) * 32;
    for (let col = -1; col <= 4; col++) {
      ctx.strokeStyle = 'rgba(120, 106, 84, 0.42)';
      ctx.lineWidth = 2;
      ctx.strokeRect(col * 64 + off + 2, r * 32 + 2, 60, 28);
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export class VaultRenderer {
  constructor(webgl, opts = {}) {
    this.webgl = webgl;
    this.width = opts.width || 390;
    this.height = opts.height || 620;
    this.dpr = opts.dpr || 1;
    this.envMap = opts.envMap || null;
    this.ownEnvMap = this.envMap ? null : buildVaultEnvMap(webgl);
    if (!this.envMap && this.ownEnvMap) this.envMap = this.ownEnvMap;
    this.stoneTex = createRotundaStoneTex(256);
    this.stoneTex.repeat.set(4, 3);
    this._disposed = false;
    this._dummy = new THREE.Object3D();

    this._initScene();
    this._loadGlbProps();
  }

  setEra(_era) {}

  prewarm() {
    try {
      this.webgl?.compile?.(this.scene, this.camera);
    } catch {
      // Ignore
    }
  }

  resize(width, height, dpr = this.dpr) {
    this.width = Math.max(1, width || 390);
    this.height = Math.max(1, height || 620);
    this.dpr = dpr;
    if (this.camera) {
      this.camera.aspect = this.width / this.height;
      this.camera.updateProjectionMatrix();
    }
  }

  _initScene() {
    this.scene = new THREE.Scene();
    // Sunlit golden-azure temple oculus backdrop!
    this.scene.background = new THREE.Color('#38bdf8');
    this.scene.fog = new THREE.Fog('#bae6fd', 14, 38);
    if (this.envMap) {
      this.scene.environment = this.envMap;
      this.scene.environmentIntensity = 0.65;
    }

    this.camera = new THREE.PerspectiveCamera(46, this.width / Math.max(1, this.height), 0.2, 70);

    // Warm Golden Sunbeam from Oculus + Turquoise Basin Bounce
    this.hemiLight = new THREE.HemisphereLight('#fffbeb', '#06b6d4', 1.25);
    this.scene.add(this.hemiLight);

    this.sunLight = new THREE.DirectionalLight('#fff7ed', 2.45);
    this.sunLight.position.set(4.5, 11.5, 9.5);
    this.scene.add(this.sunLight);

    this.coreLight = new THREE.PointLight('#5efce8', 1.8, 10);
    this.coreLight.position.set(0, 0, 1.5);
    this.scene.add(this.coreLight);

    // Sunlit Carved Travertine-Limestone Concave Rotunda Wall & Pouring Aqueduct Troughs
    const travMat = new THREE.MeshStandardMaterial({ color: '#dfd6c3', roughness: 0.56, metalness: 0.05 });
    const verdigrisMat = new THREE.MeshStandardMaterial({ color: '#3d7a74', roughness: 0.38, metalness: 0.72 });
    const brassMat = new THREE.MeshStandardMaterial({ color: '#d49b3d', roughness: 0.24, metalness: 0.90 });

    const rotunda = new THREE.Mesh(
      new THREE.CylinderGeometry(6.8, 6.8, 12, 28, 1, true, Math.PI * 0.62, Math.PI * 0.76),
      new THREE.MeshStandardMaterial({
        color: '#e6decb',
        map: this.stoneTex,
        bumpMap: this.stoneTex,
        bumpScale: 0.14,
        roughness: 0.56,
        side: THREE.BackSide,
      })
    );
    rotunda.position.set(0, 0.5, 2.2);
    this.scene.add(rotunda);

    // Arch Pilasters & Flowing Water Spouts Flanking the Rotary Valve Dial
    for (const sx of [-3.45, 3.45]) {
      const pilaster = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.38, 8.2, 12), travMat);
      pilaster.position.set(sx, 0.2, -0.65);
      const cap = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.35, 0.95), brassMat);
      cap.position.set(sx, 4.2, -0.65);
      const spout = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.7, 10), verdigrisMat);
      spout.rotation.x = Math.PI * 0.5;
      spout.position.set(sx * 0.88, 2.4, -0.4);
      const waterfall = new THREE.Mesh(
        new THREE.CylinderGeometry(0.10, 0.18, 5.4, 10),
        new THREE.MeshBasicMaterial({ color: '#67e8f9', transparent: true, opacity: 0.72 })
      );
      waterfall.position.set(sx * 0.88, -0.3, -0.15);
      this.scene.add(pilaster, cap, spout, waterfall);
    }

    // Slanting Volumetric Golden Sunbeam from Upper Rotunda Oculus
    const sunbeam = new THREE.Mesh(
      new THREE.ConeGeometry(3.8, 14, 18, 1, true),
      new THREE.MeshBasicMaterial({
        color: '#fef9c3',
        transparent: true,
        opacity: 0.11,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
        depthWrite: false,
      })
    );
    sunbeam.position.set(0.6, 3.2, 0.8);
    sunbeam.rotation.z = -0.18;
    this.scene.add(sunbeam);

    // Sunlit Turquoise Subterranean Aqueduct Basin (`WATER_Y`)
    this.waterMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(24, 18, 24, 18),
      new THREE.MeshStandardMaterial({
        color: '#06b6d4',
        emissive: '#0891b2',
        emissiveIntensity: 0.38,
        roughness: 0.08,
        metalness: 0.2,
      })
    );
    this.waterMesh.rotation.x = -Math.PI * 0.5;
    this.waterMesh.position.set(0, WATER_Y, 1.5);
    this.scene.add(this.waterMesh);

    // Flanking Aqueduct Valve & Water-Lotus Fountains (`sanctum_brazier` from `puzzle_props.glb`)
    this.fountainSlots = [];
    for (const sx of [-2.85, 2.85]) {
      const root = new THREE.Group();
      root.position.set(sx, WATER_Y + 0.05, 0.65);
      root.scale.setScalar(1.25);
      const fb = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.28, 1.1, 12), brassMat);
      fb.position.y = 0.55;
      root.add(fb);
      this.scene.add(root);
      this.fountainSlots.push({ root, fb });
    }

    // Recessed Carved Travertine Backplate + Radial Water-Conduit Channels
    const dialBack = new THREE.Mesh(new THREE.CylinderGeometry(2.68, 2.78, 0.28, 36), verdigrisMat);
    dialBack.rotation.x = Math.PI * 0.5;
    dialBack.position.z = -0.16;
    this.scene.add(dialBack);

    this.conduits = [];
    for (let k = 0; k < 8; k++) {
      const ang = (k / 8) * TAU;
      const condMat = new THREE.MeshStandardMaterial({
        color: '#22d3ee',
        emissive: '#06b6d4',
        emissiveIntensity: 0.35,
        roughness: 0.12,
      });
      const cond = new THREE.Mesh(new THREE.BoxGeometry(0.09, 2.45, 0.06), condMat);
      cond.position.set(Math.cos(ang) * 1.25, Math.sin(ang) * 1.25, -0.01);
      cond.rotation.z = ang - Math.PI * 0.5;
      this.scene.add(cond);
      this.conduits.push(cond);
    }

    // Top 12-O'Clock (+Y) Fixed Aqueduct Sluice Alignment Caliper & Plunger Bolts
    this.topCaliper = new THREE.Group();
    const calFrame = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.42, 0.36), brassMat);
    calFrame.position.set(0, 2.55, 0.18);
    this.caliperGemMat = new THREE.MeshStandardMaterial({
      color: '#5efce8',
      emissive: '#22d3ee',
      emissiveIntensity: 1.4,
      roughness: 0.08,
    });
    const calGem = new THREE.Mesh(new THREE.OctahedronGeometry(0.16, 0), this.caliperGemMat);
    calGem.position.set(0, 2.55, 0.40);
    // Crisp downward pointer chevron showing exact 12-o'clock lock line!
    const pointer = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.26, 4), this.caliperGemMat);
    pointer.rotation.z = Math.PI;
    pointer.position.set(0, 2.34, 0.36);
    this.topCaliper.add(calFrame, calGem, pointer);
    this.scene.add(this.topCaliper);

    // 3 Concentric Machined Brass & Sea-Glass Rotary Sluice Rings!
    this.ringObjs = [];
    for (let i = 0; i < 3; i++) {
      const rad = RING_RADII[i];
      const tol = i === 0 ? 0.42 : i === 1 ? 0.38 : 0.35;
      const rg = new THREE.Group();
      rg.position.z = RING_Z[i];

      const chassisMat = new THREE.MeshStandardMaterial({
        color: '#d49b3d',
        roughness: 0.24,
        metalness: 0.88,
      });
      const torus = new THREE.Mesh(new THREE.TorusGeometry(rad, 0.135, 12, 48), chassisMat);
      rg.add(torus);

      // 4 Rotary Valve Spokes & Rim Knobs
      for (let s = 0; s < 4; s++) {
        const sa = (s * Math.PI) / 2 + Math.PI * 0.25;
        const knob = new THREE.Mesh(new THREE.SphereGeometry(0.085, 10, 8), chassisMat);
        knob.position.set(Math.cos(sa) * (rad + 0.14), Math.sin(sa) * (rad + 0.14), 0.02);
        rg.add(knob);
      }

      // Sweet-spot Alignment Arc centered at 12 o'clock (`+Y`, `theta = Math.PI / 2`) when `delta === 0`!
      const notchMat = new THREE.MeshStandardMaterial({
        color: '#5efce8',
        emissive: '#06b6d4',
        emissiveIntensity: 1.25,
        roughness: 0.1,
      });
      const notchMesh = new THREE.Mesh(buildNotchArcGeo(rad, 0.165, tol * 2), notchMat);
      notchMesh.rotation.z = Math.PI * 0.5 - tol;
      rg.add(notchMesh);

      rg.userData = { rad, builtTol: tol, chassisMat, notchMat, notchMesh };
      this.scene.add(rg);
      this.ringObjs.push(rg);
    }

    // Central Harmonic Water Seed & Tri-Axis Armillary Gimbal
    this.centerSeedGroup = new THREE.Group();
    this.centerSeedGroup.position.z = 0.32;
    const gimbal1 = new THREE.Mesh(new THREE.TorusGeometry(0.58, 0.035, 8, 28), brassMat);
    const gimbal2 = new THREE.Mesh(new THREE.TorusGeometry(0.46, 0.03, 8, 28), brassMat);
    this.seedCoreMat = new THREE.MeshStandardMaterial({
      color: '#e0f7ff',
      emissive: '#22d3ee',
      emissiveIntensity: 1.45,
      roughness: 0.06,
      metalness: 0.2,
    });
    const seedCore = new THREE.Mesh(new THREE.OctahedronGeometry(0.32, 1), this.seedCoreMat);
    this.centerSeedGroup.add(gimbal1, gimbal2, seedCore);
    this.centerSeedGroup.userData = { gimbal1, gimbal2, seedCore };
    this.scene.add(this.centerSeedGroup);

    // Strike Telemetry Crystals below the dial
    this.strikeGems = [];
    for (let i = 0; i < MAX_STRIKE_GEMS; i++) {
      const gm = new THREE.MeshStandardMaterial({
        color: '#5efce8',
        emissive: '#06b6d4',
        emissiveIntensity: 0.9,
        roughness: 0.15,
      });
      const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.11, 0), gm);
      gem.position.set(0, -2.58, 0.35);
      gem.visible = false;
      this.scene.add(gem);
      this.strikeGems.push(gem);
    }

    // Rising Sunlit Water-Droplet & Golden Pollen Motes
    this.moteInst = new THREE.InstancedMesh(
      new THREE.SphereGeometry(0.035, 6, 6),
      new THREE.MeshBasicMaterial({
        color: '#fef9c3',
        transparent: true,
        opacity: 0.78,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
      MAX_MOTES
    );
    this.moteInst.frustumCulled = false;
    this.scene.add(this.moteInst);
  }

  _loadGlbProps() {
    if (typeof window === 'undefined' || typeof fetch !== 'function') return;
    try {
      const loader = new GLTFLoader();
      loader.load(
        'assets/models/puzzle_props.glb',
        (gltf) => {
          if (this._disposed || !gltf?.scene) return;
          const braz = gltf.scene.getObjectByName('sanctum_brazier');
          if (!braz) return;
          for (const slot of this.fountainSlots) {
            slot.fb.visible = false;
            const cl = braz.clone(true);
            cl.position.set(0, 0, 0);
            slot.root.add(cl);
          }
        },
        undefined,
        () => {}
      );
    } catch {
      // Ignore offline fallback
    }
  }

  render(state, opts = {}) {
    if (this._disposed || !this.webgl || !state) return;
    const vault = state.vault || state.sanctumVault;
    if (!vault) return;

    const time = Number(state.time) || 0;
    const rings = vault.rings || [];
    const status = vault.status || 'playing';
    const activeIdx = vault.activeRing || 0;

    let activeInSweetSpot = false;
    let lockedCount = 0;

    for (let i = 0; i < this.ringObjs.length; i++) {
      const ro = this.ringObjs[i];
      const rState = rings[i];
      if (!rState) continue;
      if (rState.locked) lockedCount++;

      const delta = wrapAngle((rState.angle || 0) - (rState.targetAngle || 0));
      ro.rotation.z = delta;

      const tol = rState.tolerance || (i === 0 ? 0.42 : i === 1 ? 0.38 : 0.35);
      const ud = ro.userData;
      if (Math.abs(tol - ud.builtTol) > 0.005) {
        ud.notchMesh.geometry.dispose();
        ud.notchMesh.geometry = buildNotchArcGeo(ud.rad, 0.165, tol * 2);
        ud.notchMesh.rotation.z = Math.PI * 0.5 - tol;
        ud.builtTol = tol;
      }

      const isActive = i === activeIdx && status === 'playing';
      const inZone = Math.abs(delta) <= tol;
      if (isActive && inZone) activeInSweetSpot = true;

      if (status === 'failed') {
        ud.chassisMat.color.set('#7f1d1d');
        ud.notchMat.color.set('#fb7185');
        ud.notchMat.emissive.set('#e11d48');
        ud.notchMat.emissiveIntensity = 1.25;
      } else if (rState.locked || status === 'won') {
        ud.chassisMat.color.set('#eab308');
        ud.notchMat.color.set('#6ee7b7');
        ud.notchMat.emissive.set('#10b981');
        ud.notchMat.emissiveIntensity = 1.35;
      } else if (isActive) {
        ud.chassisMat.color.set('#f59e0b');
        if (inZone) {
          ud.notchMat.color.set('#ffffff');
          ud.notchMat.emissive.set('#5efce8');
          ud.notchMat.emissiveIntensity = 1.9 + Math.sin(time * 22) * 0.25;
        } else {
          ud.notchMat.color.set('#7dd3fc');
          ud.notchMat.emissive.set('#0284c7');
          ud.notchMat.emissiveIntensity = 1.1;
        }
      } else {
        ud.chassisMat.color.set('#b4823c');
        ud.notchMat.color.set('#94a3b8');
        ud.notchMat.emissive.set('#0e7490');
        ud.notchMat.emissiveIntensity = 0.45;
      }
    }

    // Caliper & Conduit Pressurization Feedback
    this.caliperGemMat.emissive.set(
      status === 'failed' ? '#e11d48' : status === 'won' ? '#fde047' : activeInSweetSpot ? '#34d399' : '#06b6d4'
    );
    const pressure = status === 'won' ? 1 : lockedCount / 3;
    for (let i = 0; i < this.conduits.length; i++) {
      this.conduits[i].material.emissiveIntensity = 0.3 + pressure * 1.1 + Math.sin(time * 5 + i) * 0.08;
    }

    // Central Harmonic Seed Gimbal
    const cUd = this.centerSeedGroup.userData;
    const spinBoost = status === 'won' ? 3.4 : 1 + pressure * 1.4;
    cUd.gimbal1.rotation.set(time * 1.1 * spinBoost, time * 0.8 * spinBoost, 0);
    cUd.gimbal2.rotation.set(0, time * 1.4 * spinBoost, time * 1.1 * spinBoost);
    cUd.seedCore.rotation.set(time * 1.6, time * 2.3, 0);
    cUd.seedCore.scale.setScalar(status === 'won' ? 1.32 + Math.sin(time * 10) * 0.08 : 1.0 + pressure * 0.15);
    this.seedCoreMat.emissive.set(status === 'failed' ? '#f43f5e' : status === 'won' ? '#fde047' : '#22d3ee');

    // Strike Gems (`maxStrikes` remaining indicator)
    const maxS = Math.min(MAX_STRIKE_GEMS, vault.maxStrikes || 3);
    const strikes = vault.strikes || 0;
    for (let i = 0; i < MAX_STRIKE_GEMS; i++) {
      const gem = this.strikeGems[i];
      if (i >= maxS) {
        gem.visible = false;
        continue;
      }
      gem.visible = true;
      gem.position.x = (i - (maxS - 1) * 0.5) * 0.42;
      gem.rotation.y = time * 2.2 + i;
      const used = i < strikes;
      gem.material.color.set(used ? '#fb7185' : '#5efce8');
      gem.material.emissive.set(used ? '#e11d48' : '#06b6d4');
    }

    // Sunlit Droplet Motes
    const dm = this._dummy;
    for (let i = 0; i < MAX_MOTES; i++) {
      const mx = Math.sin(i * 2.3 + time * 0.4) * 3.6;
      const my = WATER_Y + 0.2 + ((i * 0.17 + time * 0.55) % 6.2);
      const mz = Math.cos(i * 1.9 + time * 0.35) * 1.8 + 0.5;
      dm.position.set(mx, my, mz);
      dm.scale.setScalar(0.75 + Math.sin(time * 4 + i) * 0.25);
      dm.updateMatrix();
      this.moteInst.setMatrixAt(i, dm.matrix);
    }
    this.moteInst.count = MAX_MOTES;
    this.moteInst.instanceMatrix.needsUpdate = true;

    // Aspect-safe Heroic Camera Push-In as Rings Lock (`0 -> 1 -> 2 -> won`)
    const aspect = this.width / Math.max(1, this.height);
    const baseZ = aspect < 0.78 ? 8.35 : aspect < 1.1 ? 7.25 : 6.45;
    const pushZ = baseZ - pressure * 0.65 - (status === 'won' ? 0.35 : 0);
    const sh = (Number(state.shake) || 0) * 0.02;
    const sx = sh > 0.001 ? Math.sin(time * 73) * sh : 0;
    const sy = sh > 0.001 ? Math.cos(time * 61) * sh : 0;
    this.camera.position.set(Math.sin(time * 0.35) * 0.14 + sx, 0.15 + sy, pushZ);
    this.camera.lookAt(0, 0.05, 0);

    if (opts.postfx) {
      opts.postfx.render(this.scene, this.camera, { biome: 'coral_sea' });
    } else {
      this.webgl.setRenderTarget(null);
      this.webgl.render(this.scene, this.camera);
    }
  }

  dispose() {
    if (this._disposed) return;
    this._disposed = true;
    this.ownEnvMap?.dispose();
    this.stoneTex?.dispose();
  }
}

export { VaultRenderer as SanctumVaultRenderer };
export default VaultRenderer;
