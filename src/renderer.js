import * as THREE from 'three';
import { COLS } from './levels.js';

const TWO_PI = Math.PI * 2;
const COL_ANGLE = TWO_PI / COLS;
const TOWER_RADIUS = 2.55;
const FLOOR_HEIGHT = 1.0;

function wrapAngle(a) {
  let res = a % TWO_PI;
  if (res > Math.PI) res -= TWO_PI;
  if (res < -Math.PI) res += TWO_PI;
  return res;
}

function getShakeOffset(shake, time) {
  if (!shake) return { x: 0, y: 0 };
  if (typeof shake === 'object') {
    return { x: (shake.x || 0) * 0.025, y: (shake.y || 0) * 0.025 };
  }
  const mag = (Number(shake) || 0) * 0.025;
  if (mag <= 0.001) return { x: 0, y: 0 };
  return {
    x: Math.sin(time * 73.7) * mag,
    y: Math.cos(time * 61.3) * mag * 0.85,
  };
}

function createBrickTextures(pal) {
  const size = 512;
  const colCanvas = document.createElement('canvas');
  colCanvas.width = size;
  colCanvas.height = size;
  const ctx = colCanvas.getContext('2d');

  const bumpCanvas = document.createElement('canvas');
  bumpCanvas.width = size;
  bumpCanvas.height = size;
  const bCtx = bumpCanvas.getContext('2d');

  const roughCanvas = document.createElement('canvas');
  roughCanvas.width = size;
  roughCanvas.height = size;
  const rCtx = roughCanvas.getContext('2d');

  const emCanvas = document.createElement('canvas');
  emCanvas.width = size;
  emCanvas.height = size;
  const eCtx = emCanvas.getContext('2d');

  // Deep recessed mortar
  ctx.fillStyle = pal.mortar;
  ctx.fillRect(0, 0, size, size);
  bCtx.fillStyle = '#141414';
  bCtx.fillRect(0, 0, size, size);
  rCtx.fillStyle = '#e0e0e0';
  rCtx.fillRect(0, 0, size, size);
  eCtx.fillStyle = '#000000';
  eCtx.fillRect(0, 0, size, size);

  const cols = 32;
  const rows = 16;
  const bw = size / cols;
  const bh = size / rows;

  for (let r = 0; r < rows; r++) {
    const offset = (r % 2) * (bw * 0.5);
    for (let c = -1; c <= cols; c++) {
      const x = c * bw + offset + 2.5;
      const y = r * bh + 2.5;
      const w = bw - 5;
      const h = bh - 5;

      const base = (c + r) % 2 === 0 ? pal.brickA : pal.brickB;
      ctx.fillStyle = base;
      ctx.fillRect(x, y, w, h);

      // High-contrast bevels & sci-fi panel seam
      ctx.fillStyle = 'rgba(255,255,255,0.26)';
      ctx.fillRect(x, y, w, 3);
      ctx.fillRect(x, y, 2.5, h);
      ctx.fillStyle = 'rgba(0,0,0,0.42)';
      ctx.fillRect(x, y + h - 3, w, 3);
      ctx.fillRect(x + w - 2.5, y, 2.5, h);

      // Corner rivets
      ctx.fillStyle = 'rgba(255,255,255,0.22)';
      ctx.fillRect(x + 4, y + 4, 2, 2);
      ctx.fillRect(x + w - 6, y + 4, 2, 2);

      // Bump & roughness variation
      bCtx.fillStyle = '#dcdcdc';
      bCtx.fillRect(x, y, w, h);
      bCtx.fillStyle = '#ffffff';
      bCtx.fillRect(x + 2, y + 2, w - 4, 4);

      rCtx.fillStyle = (c + r) % 2 === 0 ? '#888888' : '#686868';
      rCtx.fillRect(x, y, w, h);

      // Glowing sci-fi runic seam accents
      if ((c + r * 3) % 5 === 0) {
        eCtx.fillStyle = pal.glow;
        eCtx.fillRect(x + w * 0.18, y + h * 0.45, w * 0.64, 2.5);
      }
    }
  }

  const map = new THREE.CanvasTexture(colCanvas);
  map.wrapS = THREE.RepeatWrapping;
  map.wrapT = THREE.RepeatWrapping;
  map.colorSpace = THREE.SRGBColorSpace;

  const bumpMap = new THREE.CanvasTexture(bumpCanvas);
  bumpMap.wrapS = THREE.RepeatWrapping;
  bumpMap.wrapT = THREE.RepeatWrapping;

  const roughnessMap = new THREE.CanvasTexture(roughCanvas);
  roughnessMap.wrapS = THREE.RepeatWrapping;
  roughnessMap.wrapT = THREE.RepeatWrapping;

  const emissiveMap = new THREE.CanvasTexture(emCanvas);
  emissiveMap.wrapS = THREE.RepeatWrapping;
  emissiveMap.wrapT = THREE.RepeatWrapping;

  return { map, bumpMap, roughnessMap, emissiveMap };
}

function createConveyorTexture(dir = 1) {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#6b21a8';
  ctx.fillRect(0, 0, 128, 64);

  ctx.strokeStyle = '#f5d0fe';
  ctx.lineWidth = 6;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (let x = 16; x < 128; x += 32) {
    ctx.beginPath();
    ctx.moveTo(x - 8 * dir, 16);
    ctx.lineTo(x + 8 * dir, 32);
    ctx.lineTo(x - 8 * dir, 48);
    ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createPopupTexture(text, color) {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  ctx.font = '900 30px Orbitron, sans-serif';
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

    this.webgl = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: 'high-performance',
    });
    this.webgl.toneMapping = THREE.ACESFilmicToneMapping;
    this.webgl.toneMappingExposure = 0.92;
    this.webgl.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

    this._initTowerScene();
    this._initSubScene();
  }

  _renderWithComposer(scene, camera) {
    this.webgl.render(scene, camera);
  }

  _initTowerScene() {
    this.towerScene = new THREE.Scene();
    this.towerScene.background = new THREE.Color('#030816');
    this.towerScene.fog = new THREE.Fog('#050d1f', 20, 58);

    this.towerCam = new THREE.PerspectiveCamera(46, 360 / 540, 0.1, 140);

    // Balanced high-contrast 3-point lighting (no washed-out white fill/bloom)
    const hemi = new THREE.HemisphereLight('#38bdf8', '#020617', 0.5);
    this.hemiLight = hemi;
    this.towerScene.add(hemi);

    const keyLight = new THREE.DirectionalLight('#f8fafc', 1.15);
    keyLight.position.set(8, 14, 10);
    this.towerScene.add(keyLight);

    const fillLight = new THREE.DirectionalLight('#1e3a8a', 0.28);
    fillLight.position.set(-6, 3, 10);
    this.towerScene.add(fillLight);

    const rimLight = new THREE.DirectionalLight('#38bdf8', 0.75);
    rimLight.position.set(-9, 6, -6);
    this.rimLight = rimLight;
    this.towerScene.add(rimLight);

    this.heroLight = new THREE.PointLight('#38bdf8', 0.65, 6);
    this.towerScene.add(this.heroLight);

    // 3D Starfield
    const starCount = 420;
    const starPos = new Float32Array(starCount * 3);
    const starCol = new Float32Array(starCount * 3);
    const c1 = new THREE.Color('#e0f2fe');
    const c2 = new THREE.Color('#a5f3fc');
    const c3 = new THREE.Color('#f5d0fe');
    for (let i = 0; i < starCount; i++) {
      const ang = Math.random() * TWO_PI;
      const dist = 24 + Math.random() * 28;
      starPos[i * 3] = Math.cos(ang) * dist;
      starPos[i * 3 + 1] = -8 + Math.random() * 44;
      starPos[i * 3 + 2] = Math.sin(ang) * dist - 10;
      const col = i % 5 === 0 ? c2 : i % 9 === 0 ? c3 : c1;
      starCol[i * 3] = col.r;
      starCol[i * 3 + 1] = col.g;
      starCol[i * 3 + 2] = col.b;
    }
    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
    starGeo.setAttribute('color', new THREE.BufferAttribute(starCol, 3));
    const starMat = new THREE.PointsMaterial({
      size: 0.22,
      vertexColors: true,
      transparent: true,
      opacity: 0.9,
    });
    this.starPoints = new THREE.Points(starGeo, starMat);
    this.towerScene.add(this.starPoints);

    // Distant Nebulus Ringed Planet
    const planetGroup = new THREE.Group();
    planetGroup.position.set(7.5, 11, -22);
    const planetMesh = new THREE.Mesh(
      new THREE.SphereGeometry(2.1, 24, 24),
      new THREE.MeshStandardMaterial({
        color: '#38bdf8',
        emissive: '#0284c7',
        emissiveIntensity: 0.6,
        roughness: 0.35,
      })
    );
    const ringMesh = new THREE.Mesh(
      new THREE.TorusGeometry(3.4, 0.16, 8, 48),
      new THREE.MeshBasicMaterial({ color: '#bae6fd', transparent: true, opacity: 0.5 })
    );
    ringMesh.rotation.x = Math.PI * 0.38;
    ringMesh.rotation.y = 0.3;
    planetGroup.add(planetMesh, ringMesh);
    this.planetGroup = planetGroup;
    this.planetMesh = planetMesh;
    this.planetRing = ringMesh;
    this.towerScene.add(planetGroup);

    // Multi-Octave Animated 3D Toxic Ocean Plane + Tower Foam Collar
    const seaGeo = new THREE.PlaneGeometry(50, 28, 44, 22);
    seaGeo.rotateX(-Math.PI / 2);
    this.seaBaseY = new Float32Array(seaGeo.attributes.position.count);
    for (let i = 0; i < this.seaBaseY.length; i++) {
      this.seaBaseY[i] = seaGeo.attributes.position.getY(i);
    }
    this.seaMesh = new THREE.Mesh(
      seaGeo,
      new THREE.MeshStandardMaterial({
        color: '#0369a1',
        emissive: '#0284c7',
        emissiveIntensity: 0.08,
        roughness: 0.25,
        metalness: 0.5,
        flatShading: true,
      })
    );
    this.seaMesh.position.set(0, -0.68, -2);
    this.towerScene.add(this.seaMesh);

    this.foamRing = new THREE.Mesh(
      new THREE.TorusGeometry(TOWER_RADIUS + 0.22, 0.08, 10, 48),
      new THREE.MeshBasicMaterial({ color: '#38bdf8', transparent: true, opacity: 0.45 })
    );
    this.foamRing.rotation.x = Math.PI / 2;
    this.foamRing.position.set(0, -0.56, 0);
    this.towerScene.add(this.foamRing);

    // Tower cache & dynamic pools
    this.towerCache = new Map();
    this.currentTowerGroup = null;
    this.conveyorTexR = createConveyorTexture(1);
    this.conveyorTexL = createConveyorTexture(-1);

    this.pogoGroup = this._buildPogoMesh();
    this.towerScene.add(this.pogoGroup);

    // 3D Tunnel Portal Vortex when Pogo traverses a tunnel
    this.tunnelVortexGroup = this._buildTunnelVortex();
    this.towerScene.add(this.tunnelVortexGroup);

    // 3D Landing Target / Shadow Ring projected beneath Pogo
    this.landingRingGroup = this._buildLandingRing();
    this.towerScene.add(this.landingRingGroup);

    this._skyBaseColor = new THREE.Color('#020512');
    this._fogBaseColor = new THREE.Color('#061024');
    this._tempColor = new THREE.Color();

    this.enemyPool = [];
    this.snowballPool = [];
    this.particlePool = [];
    this.popupPool = [];
    this.debrisPool = this._buildDebrisPool();
    this.towerScene.add(this.debrisPool.group);

    this.sharedParticleGeo = new THREE.BoxGeometry(0.14, 0.14, 0.14);
    this.sharedSnowballGeo = new THREE.IcosahedronGeometry(0.16, 1);
    this.sharedSnowballMat = new THREE.MeshStandardMaterial({
      color: '#ffffff',
      emissive: '#7dd3fc',
      emissiveIntensity: 1.5,
      roughness: 0.1,
    });
  }

  _buildLandingRing() {
    const g = new THREE.Group();
    const shadow = new THREE.Mesh(
      new THREE.CircleGeometry(0.26, 20),
      new THREE.MeshBasicMaterial({ color: '#020617', transparent: true, opacity: 0.55, depthWrite: false })
    );
    shadow.rotation.x = -Math.PI / 2;

    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.28, 0.36, 24),
      new THREE.MeshBasicMaterial({
        color: '#38bdf8',
        transparent: true,
        opacity: 0.85,
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
      new THREE.TorusGeometry(0.42, 0.045, 8, 24),
      new THREE.MeshBasicMaterial({ color: '#38bdf8', transparent: true, opacity: 0.9 })
    );
    const innerRing = new THREE.Mesh(
      new THREE.TorusGeometry(0.26, 0.035, 8, 20),
      new THREE.MeshBasicMaterial({ color: '#fde047', transparent: true, opacity: 0.85 })
    );
    const core = new THREE.Mesh(
      new THREE.CircleGeometry(0.22, 20),
      new THREE.MeshBasicMaterial({
        color: '#a5f3fc',
        transparent: true,
        opacity: 0.55,
        side: THREE.DoubleSide,
      })
    );
    g.add(outerRing, innerRing, core);
    g.userData = { outerRing, innerRing, core };
    return g;
  }

  _buildPogoMesh() {
    const g = new THREE.Group();

    const bodyMat = new THREE.MeshStandardMaterial({
      color: '#4ade80',
      emissive: '#16a34a',
      emissiveIntensity: 0.14,
      roughness: 0.35,
      metalness: 0.15,
    });

    // Sculpted LatheGeometry torso (pear-shaped athletic frog hero)
    const lathePts = [
      new THREE.Vector2(0.01, 0.12),
      new THREE.Vector2(0.24, 0.16),
      new THREE.Vector2(0.35, 0.34),
      new THREE.Vector2(0.32, 0.54),
      new THREE.Vector2(0.23, 0.68),
      new THREE.Vector2(0.01, 0.72),
    ];
    const body = new THREE.Mesh(new THREE.LatheGeometry(lathePts, 20), bodyMat);
    g.add(body);

    // Sculpted Belly Armor Plate
    const belly = new THREE.Mesh(
      new THREE.SphereGeometry(0.23, 16, 12),
      new THREE.MeshStandardMaterial({ color: '#dcfce7', roughness: 0.3, metalness: 0.1 })
    );
    belly.scale.set(0.7, 1.05, 0.92);
    belly.position.set(0.17, 0.36, 0);
    g.add(belly);

    // Backpack Cryo-Tank with glowing cyan energy core
    const tank = new THREE.Mesh(
      new THREE.CylinderGeometry(0.11, 0.11, 0.32, 12),
      new THREE.MeshStandardMaterial({ color: '#475569', metalness: 0.8, roughness: 0.2 })
    );
    tank.position.set(-0.28, 0.42, 0);
    const tankCore = new THREE.Mesh(
      new THREE.CylinderGeometry(0.06, 0.06, 0.22, 10),
      new THREE.MeshBasicMaterial({ color: '#38bdf8' })
    );
    tankCore.position.set(-0.34, 0.42, 0);
    g.add(tank, tankCore);

    // Spring Antennae + glowing orbs
    const stalkGeo = new THREE.CylinderGeometry(0.025, 0.035, 0.24, 8);
    const tipMat = new THREE.MeshStandardMaterial({
      color: '#bef264',
      emissive: '#4ade80',
      emissiveIntensity: 0.9,
      roughness: 0.15,
    });
    for (const zSide of [-0.14, 0.14]) {
      const stalk = new THREE.Mesh(stalkGeo, bodyMat);
      stalk.position.set(-0.04, 0.78, zSide);
      stalk.rotation.x = zSide * 1.4;
      const tip = new THREE.Mesh(new THREE.SphereGeometry(0.075, 10, 10), tipMat);
      tip.position.set(-0.04, 0.91, zSide * 1.3);
      g.add(stalk, tip);
    }

    // Articulated Legs & Boots
    const bootMat = new THREE.MeshStandardMaterial({ color: '#0f766e', metalness: 0.45, roughness: 0.3 });
    const makeLeg = (zOff) => {
      const lg = new THREE.Group();
      lg.position.set(0, 0.16, zOff);
      const shin = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.12, 8), bodyMat);
      shin.position.y = -0.05;
      const boot = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.1, 0.15), bootMat);
      boot.position.set(0.04, -0.11, 0);
      lg.add(shin, boot);
      return lg;
    };
    const footL = makeLeg(-0.14);
    const footR = makeLeg(0.14);
    g.add(footL, footR);
    g.userData.footL = footL;
    g.userData.footR = footR;

    // Detailed 3D Eyes (sclera, iris, pupil, eyelid)
    const eyeGroup = new THREE.Group();
    eyeGroup.position.set(0.18, 0.6, 0);
    const scleraMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.1 });
    const irisMat = new THREE.MeshStandardMaterial({ color: '#0ea5e9', emissive: '#0284c7', emissiveIntensity: 0.4 });
    const pupilMat = new THREE.MeshBasicMaterial({ color: '#090d16' });
    const lidMat = new THREE.MeshStandardMaterial({ color: '#22c55e', roughness: 0.3 });

    const makeEye = (zOff) => {
      const eg = new THREE.Group();
      eg.position.z = zOff;
      const sc = new THREE.Mesh(new THREE.SphereGeometry(0.11, 14, 12), scleraMat);
      const ir = new THREE.Mesh(new THREE.SphereGeometry(0.072, 10, 10), irisMat);
      ir.position.set(0.058, 0, 0);
      const pu = new THREE.Mesh(new THREE.SphereGeometry(0.042, 8, 8), pupilMat);
      pu.position.set(0.088, 0, 0);
      const lid = new THREE.Mesh(
        new THREE.SphereGeometry(0.118, 12, 8, 0, TWO_PI, 0, Math.PI * 0.55),
        lidMat
      );
      lid.scale.y = 0.05;
      eg.add(sc, ir, pu, lid);
      eg.userData.lid = lid;
      return eg;
    };
    const eyeL = makeEye(-0.11);
    const eyeR = makeEye(0.11);
    eyeGroup.add(eyeL, eyeR);
    g.add(eyeGroup);
    g.userData.eyeL = eyeL;
    g.userData.eyeR = eyeR;

    // 2-Tone Cryo-Blaster
    const barrel = new THREE.Mesh(
      new THREE.CylinderGeometry(0.085, 0.11, 0.32, 12),
      new THREE.MeshStandardMaterial({ color: '#334155', metalness: 0.85, roughness: 0.2 })
    );
    barrel.rotation.z = -Math.PI / 2;
    barrel.position.set(0.35, 0.42, 0);
    const cryoChamber = new THREE.Mesh(
      new THREE.CylinderGeometry(0.095, 0.095, 0.12, 12),
      new THREE.MeshStandardMaterial({ color: '#38bdf8', emissive: '#0ea5e9', emissiveIntensity: 1.2 })
    );
    cryoChamber.rotation.z = -Math.PI / 2;
    cryoChamber.position.set(0.33, 0.42, 0);
    const muzzle = new THREE.Mesh(
      new THREE.SphereGeometry(0.1, 10, 10),
      new THREE.MeshBasicMaterial({ color: '#e0f2fe' })
    );
    muzzle.position.set(0.53, 0.42, 0);
    const muzzleLight = new THREE.PointLight('#67e8f9', 0, 4.2);
    muzzleLight.position.set(0.6, 0.42, 0);
    g.add(barrel, cryoChamber, muzzle, muzzleLight);
    g.userData.barrel = barrel;
    g.userData.cryoChamber = cryoChamber;
    g.userData.muzzle = muzzle;
    g.userData.muzzleLight = muzzleLight;

    return g;
  }

  _buildDebrisPool() {
    const group = new THREE.Group();
    group.visible = false;
    const chunks = [];
    const geo = new THREE.BoxGeometry(0.28, 0.22, 0.24);
    const mat = new THREE.MeshStandardMaterial({ color: '#60a5fa', roughness: 0.45, metalness: 0.2 });
    for (let i = 0; i < 28; i++) {
      const m = new THREE.Mesh(geo, mat);
      m.userData = {
        rx: ((i % 9) - 4) * 0.72,
        rz: ((i % 5) - 2) * 0.65,
        speed: 0.7 + (i % 5) * 0.25,
        rot: (i % 2 === 0 ? 1 : -1) * (2.5 + (i % 4)),
      };
      group.add(m);
      chunks.push(m);
    }
    return { group, chunks, mat };
  }

  _getOrBuildTowerGroup(tower) {
    if (this.towerCache.has(tower.id)) {
      return this.towerCache.get(tower.id);
    }

    const pal = tower.palette;
    const group = new THREE.Group();
    const totalH = tower.floors * FLOOR_HEIGHT;

    // 1. Main 3D Cylindrical Tower Body with PBR maps
    const tex = createBrickTextures(pal);
    tex.map.repeat.set(1, tower.floors / 4);
    tex.bumpMap.repeat.set(1, tower.floors / 4);
    tex.roughnessMap.repeat.set(1, tower.floors / 4);
    tex.emissiveMap.repeat.set(1, tower.floors / 4);

    const cylMat = new THREE.MeshStandardMaterial({
      map: tex.map,
      bumpMap: tex.bumpMap,
      bumpScale: 0.12,
      roughnessMap: tex.roughnessMap,
      emissive: pal.glow,
      emissiveMap: tex.emissiveMap,
      emissiveIntensity: 0.12,
      roughness: 0.68,
      metalness: 0.18,
    });
    const cylMesh = new THREE.Mesh(
      new THREE.CylinderGeometry(TOWER_RADIUS, TOWER_RADIUS, totalH, 48, 1, false),
      cylMat
    );
    cylMesh.position.y = totalH * 0.5;
    group.add(cylMesh);

    // 2. Real 3D Cornice Rings every 2 floors
    const trimMat = new THREE.MeshStandardMaterial({
      color: pal.brickB,
      metalness: 0.35,
      roughness: 0.48,
    });
    const collarMat = new THREE.MeshStandardMaterial({
      color: pal.ledge,
      emissive: pal.glow,
      emissiveIntensity: 0.25,
      roughness: 0.35,
    });
    const corniceGeo = new THREE.TorusGeometry(TOWER_RADIUS + 0.035, 0.045, 8, 48);

    for (let f = 2; f < tower.floors; f += 2) {
      const ring = new THREE.Mesh(corniceGeo, trimMat);
      ring.rotation.x = Math.PI / 2;
      ring.position.y = f * FLOOR_HEIGHT - 0.04;
      group.add(ring);
    }

    // 3. Subtle Vertical Pilaster Ribs (no blinding vertical neon bars)
    const ribGeo = new THREE.BoxGeometry(0.12, totalH, 0.08);
    for (let k = 0; k < 8; k++) {
      const phi = (k * 2 + 0.5) * COL_ANGLE;
      const rib = new THREE.Mesh(ribGeo, trimMat);
      rib.position.set(
        (TOWER_RADIUS + 0.02) * Math.sin(phi),
        totalH * 0.5,
        (TOWER_RADIUS + 0.02) * Math.cos(phi)
      );
      rib.rotation.y = phi;
      group.add(rib);
    }

    // 4. Detailed 3D Crenellated Battlements + Beacon Spires at Crown
    const crownBase = new THREE.Mesh(
      new THREE.CylinderGeometry(TOWER_RADIUS + 0.18, TOWER_RADIUS + 0.1, 0.34, 32),
      new THREE.MeshStandardMaterial({
        color: pal.ledge,
        emissive: pal.glow,
        emissiveIntensity: 0.4,
        metalness: 0.55,
        roughness: 0.25,
      })
    );
    crownBase.position.y = totalH + 0.16;
    group.add(crownBase);

    const merlonGeo = new THREE.BoxGeometry(0.45, 0.32, 0.24);
    for (let m = 0; m < COLS; m += 2) {
      const phi = m * COL_ANGLE;
      const merlon = new THREE.Mesh(merlonGeo, trimMat);
      merlon.position.set(
        (TOWER_RADIUS + 0.06) * Math.sin(phi),
        totalH + 0.46,
        (TOWER_RADIUS + 0.06) * Math.cos(phi)
      );
      merlon.rotation.y = phi;
      group.add(merlon);
    }

    const spireGeo = new THREE.ConeGeometry(0.11, 0.65, 8);
    for (let s = 0; s < 4; s++) {
      const phi = s * 4 * COL_ANGLE;
      const spire = new THREE.Mesh(spireGeo, collarMat);
      spire.position.set(
        (TOWER_RADIUS + 0.08) * Math.sin(phi),
        totalH + 0.72,
        (TOWER_RADIUS + 0.08) * Math.cos(phi)
      );
      group.add(spire);
    }

    // 5. Recessed 3D Stone/Tech Archways + 3D Holographic Beacons on Doors & Exit
    const doorMarkers = [];
    const exitRings = [];
    const markerGeo = new THREE.OctahedronGeometry(0.14, 0);
    for (const door of tower.doors) {
      const phi = (door.col + 0.5) * COL_ANGLE;
      const dg = new THREE.Group();
      dg.position.set(
        (TOWER_RADIUS + 0.03) * Math.sin(phi),
        door.floor * FLOOR_HEIGHT + 0.42,
        (TOWER_RADIUS + 0.03) * Math.cos(phi)
      );
      dg.rotation.y = phi;

      const pillarGeo = new THREE.BoxGeometry(0.12, 0.78, 0.18);
      const pillarMat = new THREE.MeshStandardMaterial({ color: '#334155', metalness: 0.6, roughness: 0.3 });
      const pL = new THREE.Mesh(pillarGeo, pillarMat);
      pL.position.set(-0.32, -0.02, 0.04);
      const pR = new THREE.Mesh(pillarGeo, pillarMat);
      pR.position.set(0.32, -0.02, 0.04);

      const inner = new THREE.Mesh(
        new THREE.BoxGeometry(0.54, 0.8, 0.1),
        new THREE.MeshBasicMaterial({ color: door.isExit ? '#713f12' : '#020617' })
      );
      const portalEnergy = new THREE.Mesh(
        new THREE.PlaneGeometry(0.46, 0.72),
        new THREE.MeshBasicMaterial({
          color: door.isExit ? '#fde047' : pal.glow,
          transparent: true,
          opacity: door.isExit ? 0.65 : 0.35,
          side: THREE.DoubleSide,
        })
      );
      portalEnergy.position.z = 0.06;

      const archMat = new THREE.MeshStandardMaterial({
        color: door.isExit ? '#fde047' : pal.glow,
        emissive: door.isExit ? '#f59e0b' : pal.glow,
        emissiveIntensity: 1.8,
      });
      const arch = new THREE.Mesh(
        new THREE.TorusGeometry(0.34, 0.06, 8, 20, Math.PI),
        archMat
      );
      arch.position.set(0, 0.12, 0.05);

      // Floating 3D Holographic Diamond/Chevron Marker above every door
      const marker = new THREE.Mesh(markerGeo, archMat);
      marker.position.set(0, 0.78, 0.16);
      dg.add(pL, pR, inner, portalEnergy, arch, marker);
      doorMarkers.push({ mesh: marker, baseY: 0.78 });

      // Tall Golden 3D Light-Pillar Beacon + Spinning Crown Ring above Exit Door
      if (door.isExit) {
        const beam = new THREE.Mesh(
          new THREE.CylinderGeometry(0.26, 0.38, 4.2, 16, 1, true),
          new THREE.MeshBasicMaterial({
            color: '#fde047',
            transparent: true,
            opacity: 0.24,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            side: THREE.DoubleSide,
          })
        );
        beam.position.set(0, 2.2, 0.1);
        const crownRing = new THREE.Mesh(
          new THREE.TorusGeometry(0.46, 0.045, 8, 24),
          archMat
        );
        crownRing.rotation.x = Math.PI / 2;
        crownRing.position.set(0, 1.05, 0.14);
        dg.add(beam, crownRing);
        exitRings.push(crownRing);
      }

      group.add(dg);
    }

    // 6. 3D Elevator Shaft Dual Rails, Hovering Lift Pods & Thruster Cones
    const elevatorPods = [];
    const elevatorThrusters = [];
    const thrusterGeo = new THREE.ConeGeometry(0.14, 0.32, 10);
    const thrusterMat = new THREE.MeshBasicMaterial({
      color: '#67e8f9',
      transparent: true,
      opacity: 0.8,
      blending: THREE.AdditiveBlending,
    });
    for (const el of tower.elevators) {
      const phi = (el.col + 0.5) * COL_ANGLE;
      const r = TOWER_RADIUS + 0.3;
      const railH = (el.maxFloor - el.minFloor) * FLOOR_HEIGHT + 0.65;
      for (const offset of [-0.26, 0.26]) {
        const rail = new THREE.Mesh(
          new THREE.CylinderGeometry(0.03, 0.03, railH, 8),
          new THREE.MeshStandardMaterial({ color: '#94a3b8', metalness: 0.75, roughness: 0.2 })
        );
        const tangentX = Math.cos(phi) * offset;
        const tangentZ = -Math.sin(phi) * offset;
        rail.position.set(
          r * Math.sin(phi) + tangentX,
          (el.minFloor + el.maxFloor) * 0.5 * FLOOR_HEIGHT,
          r * Math.cos(phi) + tangentZ
        );
        group.add(rail);
      }

      const pod = new THREE.Group();
      const deck = new THREE.Mesh(
        new THREE.BoxGeometry(0.92, 0.16, 0.66),
        new THREE.MeshStandardMaterial({
          color: '#38bdf8',
          emissive: '#0284c7',
          emissiveIntensity: 0.9,
          metalness: 0.6,
          roughness: 0.2,
        })
      );
      const trim = new THREE.Mesh(
        new THREE.BoxGeometry(0.96, 0.05, 0.7),
        new THREE.MeshBasicMaterial({ color: '#e0f2fe' })
      );
      trim.position.y = 0.08;
      pod.add(deck, trim);

      for (const tx of [-0.26, 0.26]) {
        const th = new THREE.Mesh(thrusterGeo, thrusterMat);
        th.rotation.x = Math.PI;
        th.position.set(tx, -0.22, 0);
        pod.add(th);
        elevatorThrusters.push(th);
      }

      pod.position.set(r * Math.sin(phi), el.startFloor * FLOOR_HEIGHT - 0.1, r * Math.cos(phi));
      pod.rotation.y = phi;
      group.add(pod);
      elevatorPods.push(pod);
    }

    // 7. 3D Cantilever Ledges (Support Bracket + Beveled Deck + Glowing Top Rail)
    const ledgeWidth = TOWER_RADIUS * COL_ANGLE * 1.12;
    const ledgeGeo = new THREE.BoxGeometry(ledgeWidth, 0.18, 0.66);
    const topRailGeo = new THREE.BoxGeometry(ledgeWidth * 1.03, 0.06, 0.7);
    const bracketGeo = new THREE.BoxGeometry(ledgeWidth * 0.35, 0.22, 0.42);
    const boxGeo = new THREE.BoxGeometry(ledgeWidth * 0.86, 0.54, 0.58);

    const solidMat = new THREE.MeshStandardMaterial({
      color: pal.ledge,
      emissive: pal.glow,
      emissiveIntensity: 0.12,
      roughness: 0.42,
      metalness: 0.35,
    });
    const solidTopMat = new THREE.MeshStandardMaterial({
      color: pal.ledgeTop,
      emissive: pal.glow,
      emissiveIntensity: 0.22,
      roughness: 0.28,
    });
    const bracketMat = new THREE.MeshStandardMaterial({
      color: '#334155',
      metalness: 0.6,
      roughness: 0.4,
    });
    const iceMat = new THREE.MeshStandardMaterial({
      color: '#38bdf8',
      emissive: '#0284c7',
      emissiveIntensity: 0.2,
      roughness: 0.15,
      metalness: 0.2,
      transparent: true,
      opacity: 0.85,
    });
    const iceTopMat = new THREE.MeshStandardMaterial({
      color: '#bae6fd',
      emissive: '#38bdf8',
      emissiveIntensity: 0.25,
      roughness: 0.2,
    });
    const convMatR = new THREE.MeshStandardMaterial({
      map: this.conveyorTexR,
      emissive: '#a855f7',
      emissiveIntensity: 0.2,
      roughness: 0.4,
    });
    const convMatL = new THREE.MeshStandardMaterial({
      map: this.conveyorTexL,
      emissive: '#a855f7',
      emissiveIntensity: 0.2,
      roughness: 0.4,
    });
    const convTopMat = new THREE.MeshStandardMaterial({
      color: '#e879f9',
      emissive: '#a855f7',
      emissiveIntensity: 0.25,
      roughness: 0.3,
    });
    const crumbleTopMat = new THREE.MeshStandardMaterial({
      color: '#fbbf24',
      emissive: '#d97706',
      emissiveIntensity: 0.25,
      roughness: 0.4,
    });

    const crystalGeo = new THREE.ConeGeometry(0.08, 0.28, 5);
    const rollerGeo = new THREE.CylinderGeometry(0.06, 0.06, 0.68, 8);
    const segGeo = new THREE.BoxGeometry(ledgeWidth * 0.3, 0.18, 0.64);
    const conveyorRollers = [];

    const ledgeMeshes = [];
    for (const l of tower.ledges) {
      const phi = (l.col + 0.5) * COL_ANGLE;
      const r = TOWER_RADIUS + 0.34;
      const y = l.type === 'box' ? l.floor * FLOOR_HEIGHT + 0.27 : l.floor * FLOOR_HEIGHT - 0.11;

      const node = new THREE.Group();
      node.position.set(r * Math.sin(phi), y, r * Math.cos(phi));
      node.rotation.y = phi;

      if (l.type === 'box') {
        const boxMat = new THREE.MeshStandardMaterial({
          color: '#facc15',
          emissive: '#ea580c',
          emissiveIntensity: 0.65,
          roughness: 0.28,
          metalness: 0.45,
        });
        const crate = new THREE.Mesh(boxGeo, boxMat);
        const core = new THREE.Mesh(
          new THREE.BoxGeometry(ledgeWidth * 0.5, 0.28, 0.62),
          new THREE.MeshBasicMaterial({ color: '#fef08a' })
        );
        node.add(crate, core);
        node.userData = { baseY: y, type: l.type, mainMat: boxMat };
      } else if (l.type === 'crumble') {
        // 3 fractured stone segments with glowing amber fault core
        const cMat = new THREE.MeshStandardMaterial({
          color: '#f59e0b',
          emissive: '#b45309',
          emissiveIntensity: 0.4,
          roughness: 0.6,
        });
        for (const sx of [-0.32, 0, 0.32]) {
          const seg = new THREE.Mesh(segGeo, cMat);
          seg.position.x = sx * ledgeWidth;
          node.add(seg);
        }
        const cap = new THREE.Mesh(topRailGeo, crumbleTopMat);
        cap.position.y = 0.09;
        node.add(cap);
        node.userData = { baseY: y, type: l.type, mainMat: cMat };
      } else if (l.type === 'ice') {
        const slab = new THREE.Mesh(ledgeGeo, iceMat);
        const cap = new THREE.Mesh(topRailGeo, iceTopMat);
        cap.position.y = 0.09;
        node.add(slab, cap);
        for (const cx of [-0.3, 0.08, 0.34]) {
          const shard = new THREE.Mesh(crystalGeo, iceTopMat);
          shard.position.set(cx * ledgeWidth, -0.14, 0.2);
          shard.rotation.z = Math.PI + cx * 0.4;
          node.add(shard);
        }
        node.userData = { baseY: y, type: l.type };
      } else if (l.type === 'conveyorR' || l.type === 'conveyorL') {
        const cMat = l.type === 'conveyorR' ? convMatR : convMatL;
        const deck = new THREE.Mesh(ledgeGeo, cMat);
        const cap = new THREE.Mesh(topRailGeo, convTopMat);
        cap.position.y = 0.09;
        node.add(deck, cap);
        const dir = l.type === 'conveyorR' ? 1 : -1;
        for (const rx of [-0.32, 0, 0.32]) {
          const rol = new THREE.Mesh(rollerGeo, bracketMat);
          rol.rotation.x = Math.PI / 2;
          rol.position.set(rx * ledgeWidth, -0.02, 0.02);
          node.add(rol);
          conveyorRollers.push({ mesh: rol, dir });
        }
        node.userData = { baseY: y, type: l.type };
      } else {
        // Solid cantilever ledge with underside support bracket
        const deck = new THREE.Mesh(ledgeGeo, solidMat);
        const cap = new THREE.Mesh(topRailGeo, solidTopMat);
        cap.position.y = 0.09;
        const bracket = new THREE.Mesh(bracketGeo, bracketMat);
        bracket.position.set(0, -0.17, -0.14);
        bracket.rotation.x = 0.45;
        node.add(deck, cap, bracket);
        node.userData = { baseY: y, type: l.type };
      }

      group.add(node);
      ledgeMeshes.push(node);
    }

    const cached = {
      group,
      ledgeMeshes,
      elevatorPods,
      elevatorThrusters,
      doorMarkers,
      exitRings,
      conveyorRollers,
      cylMat,
    };
    this.towerCache.set(tower.id, cached);
    return cached;
  }

  _createEnemyMesh(type) {
    const g = new THREE.Group();
    if (type === 'molecule') {
      const core = new THREE.Mesh(
        new THREE.IcosahedronGeometry(0.14, 0),
        new THREE.MeshBasicMaterial({ color: '#ffffff' })
      );
      g.add(core);
      const colors = ['#ff2a85', '#fbbf24', '#00f0ff'];
      const atoms = [];
      for (let i = 0; i < 3; i++) {
        const a = new THREE.Mesh(
          new THREE.SphereGeometry(0.13, 12, 12),
          new THREE.MeshStandardMaterial({
            color: colors[i],
            emissive: colors[i],
            emissiveIntensity: 1.0,
            roughness: 0.15,
          })
        );
        g.add(a);
        atoms.push(a);
      }
      const ring1 = new THREE.Mesh(
        new THREE.TorusGeometry(0.32, 0.022, 6, 24),
        new THREE.MeshBasicMaterial({ color: '#67e8f9', transparent: true, opacity: 0.75 })
      );
      ring1.rotation.x = Math.PI * 0.35;
      const ring2 = new THREE.Mesh(
        new THREE.TorusGeometry(0.32, 0.022, 6, 24),
        new THREE.MeshBasicMaterial({ color: '#f472b6', transparent: true, opacity: 0.7 })
      );
      ring2.rotation.y = Math.PI * 0.35;
      g.add(ring1, ring2);
      g.userData.atoms = atoms;
      g.userData.ring1 = ring1;
      g.userData.ring2 = ring2;
    } else if (type === 'roller') {
      const ball = new THREE.Mesh(
        new THREE.SphereGeometry(0.26, 16, 14),
        new THREE.MeshStandardMaterial({
          color: '#f97316',
          emissive: '#9a3412',
          emissiveIntensity: 0.45,
          metalness: 0.8,
          roughness: 0.2,
        })
      );
      const band = new THREE.Mesh(
        new THREE.TorusGeometry(0.26, 0.038, 8, 20),
        new THREE.MeshBasicMaterial({ color: '#fef08a' })
      );
      const boltGeo = new THREE.SphereGeometry(0.05, 8, 8);
      const boltMat = new THREE.MeshStandardMaterial({ color: '#cbd5e1', metalness: 0.9, roughness: 0.2 });
      for (const side of [-0.25, 0.25]) {
        const b = new THREE.Mesh(boltGeo, boltMat);
        b.position.z = side;
        ball.add(b);
      }
      ball.add(band);
      g.add(ball);
      g.userData.ball = ball;
    } else if (type === 'bouncer') {
      const spring = new THREE.Mesh(
        new THREE.TorusGeometry(0.14, 0.035, 8, 16),
        new THREE.MeshStandardMaterial({ color: '#fde047', metalness: 0.7, roughness: 0.25 })
      );
      spring.rotation.x = Math.PI / 2;
      spring.position.y = -0.2;
      const body = new THREE.Mesh(
        new THREE.SphereGeometry(0.25, 16, 14),
        new THREE.MeshStandardMaterial({
          color: '#ef4444',
          emissive: '#991b1b',
          emissiveIntensity: 0.55,
          roughness: 0.2,
        })
      );
      g.add(spring, body);
    } else {
      // 'eye'
      const housing = new THREE.Mesh(
        new THREE.TorusGeometry(0.25, 0.035, 8, 20),
        new THREE.MeshStandardMaterial({ color: '#475569', metalness: 0.8, roughness: 0.2 })
      );
      const sclera = new THREE.Mesh(
        new THREE.SphereGeometry(0.25, 16, 14),
        new THREE.MeshStandardMaterial({ color: '#f8fafc', roughness: 0.12 })
      );
      sclera.scale.set(1.12, 0.88, 0.85);
      const iris = new THREE.Mesh(
        new THREE.SphereGeometry(0.13, 12, 12),
        new THREE.MeshStandardMaterial({
          color: '#ec4899',
          emissive: '#db2777',
          emissiveIntensity: 1.0,
        })
      );
      iris.position.z = 0.15;
      const pupil = new THREE.Mesh(
        new THREE.SphereGeometry(0.06, 8, 8),
        new THREE.MeshBasicMaterial({ color: '#090d16' })
      );
      pupil.position.z = 0.24;
      g.add(housing, sclera, iris, pupil);
      g.userData.iris = iris;
      g.userData.pupil = pupil;
    }
    return g;
  }

  _initSubScene() {
    this.subScene = new THREE.Scene();
    this.subScene.background = new THREE.Color('#02182b');
    this.subScene.fog = new THREE.FogExp2('#03243f', 0.042);
    if (this.envTex) {
      this.subScene.environment = this.envTex;
      this.subScene.environmentIntensity = 0.75;
    }

    this.subCam = new THREE.PerspectiveCamera(46, 360 / 540, 0.1, 80);
    this.subCam.position.set(0, 0, 12);

    this.subScene.add(new THREE.HemisphereLight('#38bdf8', '#02101e', 0.65));
    const subKey = new THREE.DirectionalLight('#bae6fd', 1.05);
    subKey.position.set(4, 10, 8);
    this.subScene.add(subKey);

    // Volumetric Underwater Light Shafts
    this.lightShafts = [];
    const shaftGeo = new THREE.PlaneGeometry(1.6, 16);
    for (let i = 0; i < 5; i++) {
      const mat = new THREE.MeshBasicMaterial({
        color: '#38bdf8',
        transparent: true,
        opacity: 0.09,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
      });
      const m = new THREE.Mesh(shaftGeo, mat);
      m.position.set((i - 2) * 3.2, 1.5, -4 - (i % 2) * 2);
      m.rotation.z = -0.22;
      this.subScene.add(m);
      this.lightShafts.push(m);
    }

    // Seabed + Glowing Alien Coral Clusters
    const bedGeo = new THREE.PlaneGeometry(24, 12, 24, 8);
    bedGeo.rotateX(-Math.PI / 2);
    const pos = bedGeo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      pos.setY(i, Math.sin(pos.getX(i) * 0.7) * 0.35 + Math.cos(pos.getZ(i) * 0.9) * 0.25);
    }
    bedGeo.computeVertexNormals();
    const bed = new THREE.Mesh(
      bedGeo,
      new THREE.MeshStandardMaterial({ color: '#06263d', roughness: 0.85, flatShading: true })
    );
    bed.position.set(0, -4.4, -2);
    this.subScene.add(bed);

    const coralColors = ['#ec4899', '#22d3ee', '#a855f7', '#fbbf24'];
    for (let c = 0; c < 10; c++) {
      const coral = new THREE.Mesh(
        new THREE.ConeGeometry(0.18 + (c % 3) * 0.08, 0.7 + (c % 4) * 0.25, 6),
        new THREE.MeshStandardMaterial({
          color: coralColors[c % coralColors.length],
          emissive: coralColors[c % coralColors.length],
          emissiveIntensity: 0.5,
          roughness: 0.4,
        })
      );
      coral.position.set(-7 + c * 1.55, -4.1, -1.5 - (c % 3) * 0.9);
      this.subScene.add(coral);
    }

    // Sculpted LatheGeometry MK.7 Mini-Submarine
    const subG = new THREE.Group();
    const hullPts = [
      new THREE.Vector2(0.01, -0.78),
      new THREE.Vector2(0.24, -0.62),
      new THREE.Vector2(0.38, -0.2),
      new THREE.Vector2(0.38, 0.28),
      new THREE.Vector2(0.24, 0.65),
      new THREE.Vector2(0.01, 0.78),
    ];
    const hullGeo = new THREE.LatheGeometry(hullPts, 20);
    hullGeo.rotateZ(-Math.PI / 2);
    const hull = new THREE.Mesh(
      hullGeo,
      new THREE.MeshStandardMaterial({ color: '#e2e8f0', metalness: 0.72, roughness: 0.2 })
    );

    const stripe = new THREE.Mesh(
      new THREE.CylinderGeometry(0.395, 0.395, 0.14, 18),
      new THREE.MeshStandardMaterial({ color: '#38bdf8', emissive: '#0284c7', emissiveIntensity: 1.1 })
    );
    stripe.rotation.z = Math.PI / 2;

    const dome = new THREE.Mesh(
      new THREE.SphereGeometry(0.28, 16, 12, 0, TWO_PI, 0, Math.PI * 0.5),
      new THREE.MeshStandardMaterial({
        color: '#7dd3fc',
        transparent: true,
        opacity: 0.65,
        roughness: 0.05,
        metalness: 0.1,
      })
    );
    dome.position.set(0.16, 0.26, 0);

    const pogoHead = new THREE.Mesh(
      new THREE.SphereGeometry(0.14, 12, 12),
      new THREE.MeshStandardMaterial({ color: '#4ade80', emissive: '#16a34a', emissiveIntensity: 0.35 })
    );
    pogoHead.position.set(0.16, 0.31, 0);

    // Side hydroplanes & tail fin
    const finMat = new THREE.MeshStandardMaterial({ color: '#0284c7', metalness: 0.6, roughness: 0.3 });
    const tailFin = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.42, 0.06), finMat);
    tailFin.position.set(-0.62, 0.18, 0);

    const propGroup = new THREE.Group();
    propGroup.position.set(-0.82, 0, 0);
    const bladeMat = new THREE.MeshStandardMaterial({ color: '#fbbf24', metalness: 0.7, roughness: 0.25 });
    for (let b = 0; b < 3; b++) {
      const blade = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.28, 0.09), bladeMat);
      blade.rotation.x = (b * TWO_PI) / 3;
      blade.position.y = Math.cos(blade.rotation.x) * 0.12;
      blade.position.z = Math.sin(blade.rotation.x) * 0.12;
      propGroup.add(blade);
    }

    const cone = new THREE.Mesh(
      new THREE.ConeGeometry(0.75, 2.8, 16, 1, true),
      new THREE.MeshBasicMaterial({
        color: '#fde047',
        transparent: true,
        opacity: 0.18,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
      })
    );
    cone.rotation.z = Math.PI / 2;
    cone.position.set(2.05, 0, 0);

    subG.add(hull, stripe, dome, pogoHead, tailFin, propGroup, cone);
    subG.userData.prop = propGroup;
    this.subGroup = subG;
    this.subScene.add(subG);

    // Sub HUD Progress Bar Sprite
    this.subHudCanvas = document.createElement('canvas');
    this.subHudCanvas.width = 512;
    this.subHudCanvas.height = 64;
    this.subHudTex = new THREE.CanvasTexture(this.subHudCanvas);
    this.subHudTex.colorSpace = THREE.SRGBColorSpace;
    this.subHudSprite = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: this.subHudTex, transparent: true, depthTest: false })
    );
    this.subScene.add(this.subHudSprite);

    this.subFishPool = [];
    this.subBubblePool = [];
    this.subParticlePool = [];
  }

  resize(w, h, dpr = 1) {
    this.width = w;
    this.height = h;
    const clampedDpr = Math.min(dpr, 2);
    this.webgl.setPixelRatio(clampedDpr);
    this.webgl.setSize(w, h, false);

    if (this.composer) {
      this.composer.setPixelRatio(clampedDpr);
      this.composer.setSize(w, h);
    }
    if (this.bloomPass) {
      this.bloomPass.resolution.set(w, h);
    }

    const aspect = Math.max(0.4, w / Math.max(1, h));
    this.towerCam.aspect = aspect;
    this.towerCam.updateProjectionMatrix();

    this.subCam.aspect = aspect;
    this.subCam.updateProjectionMatrix();
  }

  _screenToWorld(x, y, cam, zPlane = 0) {
    const dist = cam.position.z - zPlane;
    const halfH = Math.tan(THREE.MathUtils.degToRad(cam.fov * 0.5)) * dist;
    const halfW = halfH * cam.aspect;
    return {
      x: (x / this.width - 0.5) * 2 * halfW + cam.position.x,
      y: (0.5 - y / this.height) * 2 * halfH + cam.position.y,
    };
  }

  _syncParticles(pool, scene, particles, cam, zPlane) {
    while (pool.length < particles.length) {
      const m = new THREE.Mesh(
        this.sharedParticleGeo,
        new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true })
      );
      scene.add(m);
      pool.push(m);
    }
    for (let i = 0; i < pool.length; i++) {
      const m = pool[i];
      if (i >= particles.length) {
        m.visible = false;
        continue;
      }
      const p = particles[i];
      m.visible = true;
      const wp = this._screenToWorld(p.x, p.y, cam, zPlane);
      m.position.set(wp.x, wp.y, zPlane);
      const s = Math.max(0.3, (p.size || 4) * 0.22);
      m.scale.setScalar(s);
      m.material.color.set(p.color || '#ffffff');
      m.material.opacity = Math.max(0, p.life / (p.maxLife || 1));
    }
  }

  renderTowerScene(state) {
    const { tower, player, camCol, camFloor, time, particles, snowballs, topple } = state;
    const pal = tower.palette;
    const aspect = this.towerCam.aspect;
    const camZ = aspect < 0.78 ? Math.min(12.4, 10.2 * (0.78 / Math.max(0.45, aspect))) : 10.2;
    const camY = (player.floor * 0.4 + camFloor * 0.6) * FLOOR_HEIGHT + 0.15;
    const shake = getShakeOffset(state.shake, time);

    this.towerCam.position.set(shake.x, camY + shake.y, camZ);
    this.towerCam.lookAt(shake.x, camY - 0.25 + shake.y, 0);

    // Dynamic Per-Tower Biome Sky, Fog, Planet & Ocean Tinting
    this._tempColor.set(pal.mortar);
    this.towerScene.background.copy(this._skyBaseColor).lerp(this._tempColor, 0.38);
    this._tempColor.set(pal.brickA);
    this.towerScene.fog.color.copy(this._fogBaseColor).lerp(this._tempColor, 0.28);
    this.hemiLight.color.set(pal.ledge);
    this.rimLight.color.set(pal.glow);
    this.planetMesh.material.color.set(pal.ledge);
    this.planetMesh.material.emissive.set(pal.glow);
    this.seaMesh.material.emissive.set(pal.glow);
    this.seaMesh.material.emissiveIntensity = 0.12 + Math.sin(time * 2.4) * 0.04;
    this.foamRing.material.color.set(pal.glow);

    // Swap cached tower group if tower changed
    const cached = this._getOrBuildTowerGroup(tower);
    if (this.currentTowerGroup !== cached.group) {
      if (this.currentTowerGroup) this.towerScene.remove(this.currentTowerGroup);
      this.currentTowerGroup = cached.group;
      this.towerScene.add(this.currentTowerGroup);
    }

    // Rotate tower cylinder around Y so camCol faces +Z
    const tg = cached.group;
    tg.rotation.y = -camCol * COL_ANGLE;

    // Tower topple animation
    if (topple.active) {
      tg.position.y = -topple.progress * tower.floors * FLOOR_HEIGHT * 1.05;
      tg.rotation.z = Math.sin(time * 38) * 0.045 * (1 - topple.progress) + topple.progress * 0.14;
      tg.position.x = Math.sin(time * 48) * 0.16 * (1 - topple.progress);

      this.debrisPool.group.visible = true;
      this.debrisPool.mat.color.set(pal.brickA);
      for (const ch of this.debrisPool.chunks) {
        const d = ch.userData;
        ch.position.x = d.rx + Math.sin(time * 3 + d.rx) * 0.6 * topple.progress;
        ch.position.y = Math.max(-0.5, (1 - ((topple.progress * d.speed) % 1)) * 6);
        ch.position.z = TOWER_RADIUS + 0.4 + d.rz * 0.4;
        ch.rotation.set(time * d.rot, time * d.rot * 0.7, 0);
      }
    } else {
      tg.position.set(0, 0, 0);
      tg.rotation.z = 0;
      this.debrisPool.group.visible = false;
    }

    // Animate conveyor textures & physical rollers
    this.conveyorTexR.offset.x = -(time * 1.4) % 1;
    this.conveyorTexL.offset.x = (time * 1.4) % 1;
    for (const r of cached.conveyorRollers) {
      r.mesh.rotation.y = time * 6 * r.dir;
    }

    // Update ledges (gone, crumble shake, box pulse)
    for (let i = 0; i < state.ledges.length; i++) {
      const l = state.ledges[i];
      const mesh = cached.ledgeMeshes[i];
      if (!mesh) continue;
      mesh.visible = !l.gone;
      if (!mesh.visible) continue;

      if (l.type === 'crumble' && mesh.userData.mainMat) {
        mesh.userData.mainMat.color.set(l.crumbling ? '#ef4444' : '#f59e0b');
        mesh.userData.mainMat.emissive.set(l.crumbling ? '#dc2626' : '#b45309');
        mesh.position.y = mesh.userData.baseY + (l.shake ? Math.sin(time * 55) * 0.05 : 0);
      } else if (l.type === 'box' && mesh.userData.mainMat) {
        const flash = Math.sin(time * 10) > 0;
        mesh.userData.mainMat.color.set(flash ? '#facc15' : '#f97316');
      }
    }

    // Update elevator pods, thruster cones & holographic door/exit beacons
    for (let i = 0; i < state.elevators.length; i++) {
      const el = state.elevators[i];
      const pod = cached.elevatorPods[i];
      if (pod) pod.position.y = el.floor * FLOOR_HEIGHT - 0.1;
    }
    const thrustPulse = 0.75 + 0.35 * Math.sin(time * 24);
    for (const th of cached.elevatorThrusters) {
      th.scale.set(1, thrustPulse, 1);
    }
    for (let i = 0; i < cached.doorMarkers.length; i++) {
      const dm = cached.doorMarkers[i];
      dm.mesh.position.y = dm.baseY + Math.sin(time * 4 + i) * 0.08;
      dm.mesh.rotation.y = time * 2.4 + i;
    }
    for (const er of cached.exitRings) {
      er.rotation.z = time * 3.2;
      er.scale.setScalar(1 + Math.sin(time * 5) * 0.08);
    }

    // Update Pogo 3D Hero + Muzzle Flash + Tunnel Vortex + Landing Ring
    const pTheta = wrapAngle((player.col - camCol) * COL_ANGLE);
    const pr = TOWER_RADIUS + 0.38;
    const px = pr * Math.sin(pTheta);
    const pz = pr * Math.cos(pTheta);
    const py = player.floor * FLOOR_HEIGHT + (topple.active ? tg.position.y : 0);

    const inTunnel = Boolean(player.hidden && player.tunnelTimer > 0 && !topple.active);
    this.tunnelVortexGroup.visible = inTunnel;
    if (inTunnel) {
      this.tunnelVortexGroup.position.set(px, py + 0.42, pz);
      this.tunnelVortexGroup.rotation.y = pTheta;
      this.tunnelVortexGroup.userData.outerRing.rotation.z = time * 8;
      this.tunnelVortexGroup.userData.innerRing.rotation.z = -time * 11;
      const vScale = 0.85 + 0.25 * Math.sin(time * 18);
      this.tunnelVortexGroup.scale.setScalar(vScale);
    }

    const pogoVisible = !player.hidden && !topple.active;
    this.pogoGroup.visible = pogoVisible;
    this.landingRingGroup.visible = pogoVisible;
    if (pogoVisible) {
      const moving = player.onGround && Math.abs(player.vx) > 0.2;
      const bob = moving ? Math.abs(Math.sin(time * 18)) * 0.08 : 0;
      const stride = moving ? Math.sin(time * 18) * 0.14 : 0;

      this.pogoGroup.position.set(px, py + bob, pz);
      // Angle Pogo 3/4 toward the camera (+Z) so both big eyes, belly & blaster are clearly visible!
      const faceYaw = player.facing < 0 ? Math.PI - 0.42 : 0.42;
      this.pogoGroup.rotation.y = pTheta + faceYaw;
      const sx = player.squashX || 1;
      const sy = player.squashY || 1;
      this.pogoGroup.scale.set(sx, sy, sx);

      this.pogoGroup.userData.footL.position.x = stride;
      this.pogoGroup.userData.footR.position.x = -stride;

      const blinking = (time * 0.75) % 4.4 > 4.22;
      const lidScaleY = blinking ? 1.0 : 0.05;
      this.pogoGroup.userData.eyeL.userData.lid.scale.y = lidScaleY;
      this.pogoGroup.userData.eyeR.userData.lid.scale.y = lidScaleY;

      const mf = Math.max(0, player.muzzleFlash != null ? player.muzzleFlash : player.fireCooldown > 0.1 ? 0.1 : 0);
      const flashRatio = Math.min(1, mf / 0.14);
      this.pogoGroup.userData.barrel.position.x = 0.35 - flashRatio * 0.08;
      this.pogoGroup.userData.cryoChamber.position.x = 0.33 - flashRatio * 0.08;
      this.pogoGroup.userData.muzzle.scale.setScalar(0.75 + flashRatio * 1.35);
      this.pogoGroup.userData.muzzleLight.intensity = flashRatio * 2.6;

      this.heroLight.position.set(px, py + 0.8, pz + 0.8);
      this.heroLight.color.set(pal.glow);

      // Landing Target / Shadow Ring at player.landingFloor
      const lf = player.landingFloor != null ? player.landingFloor : -0.55;
      const dist = Math.max(0, player.floor - lf);
      this.landingRingGroup.position.set(px, lf * FLOOR_HEIGHT + 0.03, pz);
      const ringScale = Math.max(0.55, 1.15 - dist * 0.12);
      this.landingRingGroup.scale.setScalar(ringScale);
      const overSea = lf <= -0.5;
      this.landingRingGroup.userData.ring.material.color.set(overSea ? '#f43f5e' : '#38bdf8');
      this.landingRingGroup.userData.ring.material.opacity = Math.max(0.25, 0.9 - dist * 0.16);
    }

    // Update Enemies
    while (this.enemyPool.length < state.enemies.length) {
      const en = state.enemies[this.enemyPool.length];
      const m = this._createEnemyMesh(en.type);
      this.towerScene.add(m);
      this.enemyPool.push({ mesh: m, type: en.type });
    }
    for (let i = 0; i < this.enemyPool.length; i++) {
      const slot = this.enemyPool[i];
      if (i >= state.enemies.length || state.enemies[i].dead) {
        slot.mesh.visible = false;
        continue;
      }
      const en = state.enemies[i];
      if (slot.type !== en.type) {
        this.towerScene.remove(slot.mesh);
        slot.mesh = this._createEnemyMesh(en.type);
        slot.type = en.type;
        this.towerScene.add(slot.mesh);
      }
      slot.mesh.visible = !(en.stunTimer > 0 && Math.floor(time * 16) % 2 === 0);
      const eTheta = wrapAngle((en.col - camCol) * COL_ANGLE);
      const er = TOWER_RADIUS + 0.36;
      slot.mesh.position.set(er * Math.sin(eTheta), en.floor * FLOOR_HEIGHT + 0.28, er * Math.cos(eTheta));
      slot.mesh.rotation.y = eTheta;

      if (en.type === 'molecule' && slot.mesh.userData.atoms) {
        const rot = time * 4.2 * (en.dir || 1);
        slot.mesh.userData.atoms.forEach((a, idx) => {
          const ang = rot + (idx * TWO_PI) / 3;
          a.position.set(Math.cos(ang) * 0.2, Math.sin(ang) * 0.2, 0);
        });
        slot.mesh.userData.ring1.rotation.z = time * 2.5;
        slot.mesh.userData.ring2.rotation.x = -time * 2.1;
      } else if (en.type === 'roller' && slot.mesh.userData.ball) {
        slot.mesh.userData.ball.rotation.z -= 0.14 * (en.dir || 1);
      } else if (en.type === 'bouncer') {
        const hop = Math.sin(time * 9 + (en.phase || 0));
        slot.mesh.scale.set(1 - hop * 0.14, 1 + hop * 0.14, 1 - hop * 0.14);
      } else if (en.type === 'eye' && slot.mesh.userData.iris) {
        const lookX = (en.dir || 1) * 0.06;
        slot.mesh.userData.iris.position.x = lookX;
        slot.mesh.userData.pupil.position.x = lookX * 1.3;
      }
    }

    // Update Snowballs
    while (this.snowballPool.length < snowballs.length) {
      const m = new THREE.Mesh(this.sharedSnowballGeo, this.sharedSnowballMat);
      this.towerScene.add(m);
      this.snowballPool.push(m);
    }
    for (let i = 0; i < this.snowballPool.length; i++) {
      const m = this.snowballPool[i];
      if (i >= snowballs.length) {
        m.visible = false;
        continue;
      }
      const sb = snowballs[i];
      m.visible = true;
      const st = wrapAngle((sb.col - camCol) * COL_ANGLE);
      const sr = TOWER_RADIUS + 0.38;
      m.position.set(sr * Math.sin(st), sb.floor * FLOOR_HEIGHT + 0.28, sr * Math.cos(st));
      m.rotation.set(time * 6, time * 8, 0);
    }

    // Multi-octave Animated 3D Toxic Ocean waves + Foam Ring
    const seaPos = this.seaMesh.geometry.attributes.position;
    for (let i = 0; i < seaPos.count; i++) {
      const x = seaPos.getX(i);
      const z = seaPos.getZ(i);
      const wave =
        Math.sin(x * 0.65 + time * 3.8) * 0.14 +
        Math.cos(z * 0.8 + time * 2.9) * 0.08 +
        Math.sin((x + z) * 1.4 - time * 5.2) * 0.04;
      seaPos.setY(i, this.seaBaseY[i] + wave);
    }
    seaPos.needsUpdate = true;
    this.seaMesh.geometry.computeVertexNormals();
    this.foamRing.scale.setScalar(1 + Math.sin(time * 4) * 0.025);

    // Parallax stars & planet
    this.starPoints.rotation.y = -camCol * COL_ANGLE * 0.15;
    this.planetGroup.rotation.y = time * 0.12;

    // Particles & Popups
    this._syncParticles(this.particlePool, this.towerScene, particles, this.towerCam, TOWER_RADIUS + 0.6);
    this._syncPopups(state.popups || [], camCol, this.towerScene, this.towerCam, true);

    this._renderWithComposer(this.towerScene, this.towerCam);
  }

  _syncPopups(popups, camCol, scene, cam, isTower) {
    while (this.popupPool.length < popups.length) {
      const sp = new THREE.Sprite(
        new THREE.SpriteMaterial({ transparent: true, depthTest: false })
      );
      scene.add(sp);
      this.popupPool.push({ sprite: sp, key: '' });
    }
    for (let i = 0; i < this.popupPool.length; i++) {
      const slot = this.popupPool[i];
      if (i >= popups.length) {
        slot.sprite.visible = false;
        continue;
      }
      const pop = popups[i];
      if (slot.sprite.parent !== scene) {
        scene.add(slot.sprite);
      }
      const key = `${pop.text}_${pop.color}`;
      if (slot.key !== key) {
        if (slot.sprite.material.map) slot.sprite.material.map.dispose();
        slot.sprite.material.map = createPopupTexture(pop.text, pop.color);
        slot.sprite.material.needsUpdate = true;
        slot.key = key;
      }
      const t = 1 - Math.max(0, pop.life / (pop.maxLife || 1));
      slot.sprite.visible = true;
      slot.sprite.material.opacity = Math.max(0, 1 - t * t);

      if (isTower && pop.col != null && pop.floor != null) {
        const theta = wrapAngle((pop.col - camCol) * COL_ANGLE);
        const r = TOWER_RADIUS + 0.85;
        slot.sprite.position.set(r * Math.sin(theta), pop.floor * FLOOR_HEIGHT + 0.6 + t * 0.85, r * Math.cos(theta));
        slot.sprite.scale.set(1.6, 0.4, 1);
      } else if (pop.x != null && pop.y != null) {
        const wp = this._screenToWorld(pop.x, pop.y, cam, 1.5);
        slot.sprite.position.set(wp.x, wp.y + t * 0.7, 1.5);
        slot.sprite.scale.set(1.8, 0.45, 1);
      } else {
        slot.sprite.visible = false;
      }
    }
  }

  renderSubmarineScene(state) {
    const { sub, time, particles } = state;
    const shake = getShakeOffset(state.shake, time);
    this.subCam.position.set(shake.x, shake.y, 12);

    // Light shafts drift
    for (let i = 0; i < this.lightShafts.length; i++) {
      const m = this.lightShafts[i];
      m.position.x = (((i * 3.5 - time * 0.9) % 17.5) + 17.5) % 17.5 - 8.75;
    }

    // Submarine position
    const sw = this._screenToWorld(sub.x, sub.y, this.subCam, 0);
    this.subGroup.position.set(sw.x, sw.y, 0);
    this.subGroup.rotation.z = Math.sin(time * 4) * 0.04;
    this.subGroup.userData.prop.rotation.x = time * 28;

    // Articulated 3D Alien Fish
    while (this.subFishPool.length < sub.fish.length) {
      const fg = new THREE.Group();
      const bodyMat = new THREE.MeshStandardMaterial({ color: '#f472b6', emissive: '#db2777', emissiveIntensity: 0.55 });
      const body = new THREE.Mesh(new THREE.SphereGeometry(0.28, 14, 12), bodyMat);
      body.scale.set(1.45, 0.85, 0.65);

      const dorsal = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.24, 6), bodyMat);
      dorsal.position.set(0.05, 0.24, 0);
      dorsal.rotation.z = 0.35;

      const tail = new THREE.Mesh(
        new THREE.ConeGeometry(0.22, 0.38, 8),
        new THREE.MeshStandardMaterial({ color: '#f472b6', emissive: '#db2777', emissiveIntensity: 0.45 })
      );
      tail.rotation.z = -Math.PI / 2;
      tail.position.set(0.45, 0, 0);

      const eye = new THREE.Mesh(
        new THREE.SphereGeometry(0.06, 8, 8),
        new THREE.MeshBasicMaterial({ color: '#ffffff' })
      );
      eye.position.set(-0.22, 0.06, 0.14);

      const bubble = new THREE.Mesh(
        new THREE.SphereGeometry(0.55, 16, 14),
        new THREE.MeshStandardMaterial({
          color: '#a5f3fc',
          emissive: '#38bdf8',
          emissiveIntensity: 0.3,
          transparent: true,
          opacity: 0.34,
          roughness: 0.05,
        })
      );
      fg.add(body, dorsal, tail, eye, bubble);
      fg.userData = { body, tail, bubble };
      this.subScene.add(fg);
      this.subFishPool.push(fg);
    }
    for (let i = 0; i < this.subFishPool.length; i++) {
      const fg = this.subFishPool[i];
      if (i >= sub.fish.length || sub.fish[i].caught) {
        fg.visible = false;
        continue;
      }
      const f = sub.fish[i];
      fg.visible = true;
      const fw = this._screenToWorld(f.x, f.y, this.subCam, 0);
      fg.position.set(fw.x, fw.y, 0);
      fg.userData.body.material.color.set(f.color);
      fg.userData.body.material.emissive.set(f.color);
      fg.userData.tail.material.color.set(f.color);
      fg.userData.tail.rotation.y = Math.sin(time * 12 + f.x * 0.1) * 0.45;
      fg.userData.bubble.visible = !!f.bubbled;
    }

    // Bubbles
    while (this.subBubblePool.length < sub.bubbles.length) {
      const b = new THREE.Mesh(
        new THREE.SphereGeometry(0.16, 12, 12),
        new THREE.MeshStandardMaterial({
          color: '#e0f2fe',
          emissive: '#38bdf8',
          emissiveIntensity: 0.65,
          transparent: true,
          opacity: 0.7,
        })
      );
      this.subScene.add(b);
      this.subBubblePool.push(b);
    }
    for (let i = 0; i < this.subBubblePool.length; i++) {
      const bMesh = this.subBubblePool[i];
      if (i >= sub.bubbles.length) {
        bMesh.visible = false;
        continue;
      }
      bMesh.visible = true;
      const bw = this._screenToWorld(sub.bubbles[i].x, sub.bubbles[i].y, this.subCam, 0);
      bMesh.position.set(bw.x, bw.y, 0);
    }

    // Update Top HUD Progress Bar
    const pct = Math.min(1, sub.timer / Math.max(0.01, sub.duration));
    const hCtx = this.subHudCanvas.getContext('2d');
    hCtx.clearRect(0, 0, 512, 64);
    hCtx.fillStyle = 'rgba(15, 23, 42, 0.75)';
    hCtx.fillRect(16, 8, 480, 14);
    hCtx.fillStyle = '#38bdf8';
    hCtx.fillRect(16, 8, Math.max(6, 480 * pct), 14);
    hCtx.fillStyle = '#e0f2fe';
    hCtx.font = 'bold 18px Orbitron, sans-serif';
    hCtx.textAlign = 'center';
    hCtx.fillText('MK.7 MINI-SUBMARINE • CATCH BUBBLED FISH!', 256, 46);
    this.subHudTex.needsUpdate = true;

    const hudPos = this._screenToWorld(this.width * 0.5, 28, this.subCam, 2);
    this.subHudSprite.position.set(hudPos.x, hudPos.y, 2);
    this.subHudSprite.scale.set(6.2, 0.78, 1);

    this._syncParticles(this.subParticlePool, this.subScene, particles, this.subCam, 0.5);
    this._syncPopups(state.popups || [], 0, this.subScene, this.subCam, false);

    this._renderWithComposer(this.subScene, this.subCam);
  }
}
