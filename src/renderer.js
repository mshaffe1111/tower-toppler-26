import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.min.js';
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

  const emCanvas = document.createElement('canvas');
  emCanvas.width = size;
  emCanvas.height = size;
  const eCtx = emCanvas.getContext('2d');

  // Mortar base
  ctx.fillStyle = pal.mortar;
  ctx.fillRect(0, 0, size, size);
  bCtx.fillStyle = '#202020';
  bCtx.fillRect(0, 0, size, size);
  eCtx.fillStyle = '#000000';
  eCtx.fillRect(0, 0, size, size);

  const cols = COLS;
  const rows = 8;
  const bw = size / cols;
  const bh = size / rows;

  for (let r = 0; r < rows; r++) {
    const offset = (r % 2) * (bw * 0.5);
    for (let c = -1; c <= cols; c++) {
      const x = c * bw + offset + 2;
      const y = r * bh + 2;
      const w = bw - 4;
      const h = bh - 4;

      const base = (c + r) % 2 === 0 ? pal.brickA : pal.brickB;
      ctx.fillStyle = base;
      ctx.fillRect(x, y, w, h);

      // Bevel highlights & shadows
      ctx.fillStyle = 'rgba(255,255,255,0.18)';
      ctx.fillRect(x, y, w, 3);
      ctx.fillRect(x, y, 2, h);
      ctx.fillStyle = 'rgba(0,0,0,0.32)';
      ctx.fillRect(x, y + h - 3, w, 3);
      ctx.fillRect(x + w - 2, y, 2, h);

      // Bump face
      bCtx.fillStyle = '#d8d8d8';
      bCtx.fillRect(x, y, w, h);
      bCtx.fillStyle = '#ffffff';
      bCtx.fillRect(x + 2, y + 2, w - 4, 3);

      // Subtle sci-fi seam/glow accent on some bricks
      if ((c + r * 3) % 5 === 0) {
        eCtx.fillStyle = pal.glow;
        eCtx.fillRect(x + w * 0.2, y + h * 0.45, w * 0.6, 2);
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

  const emissiveMap = new THREE.CanvasTexture(emCanvas);
  emissiveMap.wrapS = THREE.RepeatWrapping;
  emissiveMap.wrapT = THREE.RepeatWrapping;

  return { map, bumpMap, emissiveMap };
}

function createConveyorTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#7e22ce';
  ctx.fillRect(0, 0, 128, 64);

  ctx.strokeStyle = '#f5d0fe';
  ctx.lineWidth = 6;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (let x = 16; x < 128; x += 32) {
    ctx.beginPath();
    ctx.moveTo(x - 8, 16);
    ctx.lineTo(x + 8, 32);
    ctx.lineTo(x - 8, 48);
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
  ctx.strokeStyle = 'rgba(2, 6, 23, 0.92)';
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
    this.webgl.toneMappingExposure = 1.15;
    this.webgl.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

    this._initTowerScene();
    this._initSubScene();
  }

  _initTowerScene() {
    this.towerScene = new THREE.Scene();
    this.towerScene.background = new THREE.Color('#030816');
    this.towerScene.fog = new THREE.FogExp2('#050d21', 0.022);

    this.towerCam = new THREE.PerspectiveCamera(46, 360 / 540, 0.1, 140);

    // 3-point + hemisphere + dynamic hero lighting
    const hemi = new THREE.HemisphereLight('#7dd3fc', '#082f49', 0.85);
    this.towerScene.add(hemi);

    const keyLight = new THREE.DirectionalLight('#e0f2fe', 1.85);
    keyLight.position.set(7, 14, 12);
    this.towerScene.add(keyLight);

    const rimLight = new THREE.DirectionalLight('#38bdf8', 1.25);
    rimLight.position.set(-9, 6, -6);
    this.towerScene.add(rimLight);

    this.heroLight = new THREE.PointLight('#67e8f9', 1.6, 8);
    this.towerScene.add(this.heroLight);

    // 3D Starfield
    const starCount = 380;
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
        emissiveIntensity: 0.55,
        roughness: 0.4,
      })
    );
    const ringMesh = new THREE.Mesh(
      new THREE.TorusGeometry(3.4, 0.16, 8, 48),
      new THREE.MeshBasicMaterial({ color: '#bae6fd', transparent: true, opacity: 0.45 })
    );
    ringMesh.rotation.x = Math.PI * 0.38;
    ringMesh.rotation.y = 0.3;
    planetGroup.add(planetMesh, ringMesh);
    this.planetGroup = planetGroup;
    this.towerScene.add(planetGroup);

    // Animated 3D Toxic Ocean Plane
    const seaGeo = new THREE.PlaneGeometry(46, 26, 36, 18);
    seaGeo.rotateX(-Math.PI / 2);
    this.seaBaseY = new Float32Array(seaGeo.attributes.position.count);
    for (let i = 0; i < this.seaBaseY.length; i++) {
      this.seaBaseY[i] = seaGeo.attributes.position.getY(i);
    }
    this.seaMesh = new THREE.Mesh(
      seaGeo,
      new THREE.MeshStandardMaterial({
        color: '#0891b2',
        emissive: '#06b6d4',
        emissiveIntensity: 0.38,
        roughness: 0.18,
        metalness: 0.55,
        flatShading: true,
      })
    );
    this.seaMesh.position.set(0, -0.55, -2);
    this.towerScene.add(this.seaMesh);

    // Tower cache & dynamic pools
    this.towerCache = new Map();
    this.currentTowerGroup = null;
    this.conveyorTex = createConveyorTexture();

    this.pogoGroup = this._buildPogoMesh();
    this.towerScene.add(this.pogoGroup);

    this.enemyPool = [];
    this.snowballPool = [];
    this.particlePool = [];
    this.popupPool = [];
    this.debrisPool = this._buildDebrisPool();
    this.towerScene.add(this.debrisPool.group);

    this.sharedParticleGeo = new THREE.BoxGeometry(0.14, 0.14, 0.14);
    this.sharedSnowballGeo = new THREE.SphereGeometry(0.16, 12, 12);
    this.sharedSnowballMat = new THREE.MeshStandardMaterial({
      color: '#ffffff',
      emissive: '#7dd3fc',
      emissiveIntensity: 1.4,
      roughness: 0.1,
    });
  }

  _buildPogoMesh() {
    const g = new THREE.Group();

    // Body
    const bodyMat = new THREE.MeshStandardMaterial({
      color: '#22c55e',
      emissive: '#14532d',
      emissiveIntensity: 0.25,
      roughness: 0.25,
      metalness: 0.15,
    });
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.32, 20, 16), bodyMat);
    body.scale.set(1.05, 0.95, 1.0);
    body.position.y = 0.42;
    g.add(body);

    // Belly
    const belly = new THREE.Mesh(
      new THREE.SphereGeometry(0.22, 16, 12),
      new THREE.MeshStandardMaterial({ color: '#bbf7d0', roughness: 0.4 })
    );
    belly.position.set(0.12, 0.36, 0);
    g.add(belly);

    // Feet
    const footGeo = new THREE.BoxGeometry(0.18, 0.14, 0.16);
    const footMat = new THREE.MeshStandardMaterial({ color: '#15803d', roughness: 0.4 });
    const footL = new THREE.Mesh(footGeo, footMat);
    footL.position.set(0, 0.07, -0.14);
    const footR = new THREE.Mesh(footGeo, footMat);
    footR.position.set(0, 0.07, 0.14);
    g.add(footL, footR);
    g.userData.footL = footL;
    g.userData.footR = footR;

    // Expressive 3D Eyes
    const eyeGroup = new THREE.Group();
    eyeGroup.position.set(0.16, 0.62, 0);
    const scleraGeo = new THREE.SphereGeometry(0.11, 14, 12);
    const scleraMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.15 });
    const pupilGeo = new THREE.SphereGeometry(0.055, 10, 10);
    const pupilMat = new THREE.MeshBasicMaterial({ color: '#090d16' });

    const makeEye = (zOff) => {
      const eg = new THREE.Group();
      eg.position.z = zOff;
      const sc = new THREE.Mesh(scleraGeo, scleraMat);
      const pu = new THREE.Mesh(pupilGeo, pupilMat);
      pu.position.set(0.075, 0, 0);
      eg.add(sc, pu);
      return eg;
    };
    const eyeL = makeEye(-0.11);
    const eyeR = makeEye(0.11);
    eyeGroup.add(eyeL, eyeR);
    g.add(eyeGroup);
    g.userData.eyeL = eyeL;
    g.userData.eyeR = eyeR;

    // Snowball Cannon Snout + Muzzle Glow
    const snout = new THREE.Mesh(
      new THREE.CylinderGeometry(0.08, 0.1, 0.26, 12),
      new THREE.MeshStandardMaterial({ color: '#16a34a', metalness: 0.4, roughness: 0.3 })
    );
    snout.rotation.z = -Math.PI / 2;
    snout.position.set(0.32, 0.42, 0);
    g.add(snout);

    const muzzle = new THREE.Mesh(
      new THREE.SphereGeometry(0.09, 10, 10),
      new THREE.MeshBasicMaterial({ color: '#7dd3fc' })
    );
    muzzle.position.set(0.46, 0.42, 0);
    g.add(muzzle);
    g.userData.muzzle = muzzle;

    return g;
  }

  _buildDebrisPool() {
    const group = new THREE.Group();
    group.visible = false;
    const chunks = [];
    const geo = new THREE.BoxGeometry(0.28, 0.22, 0.24);
    const mat = new THREE.MeshStandardMaterial({ color: '#60a5fa', roughness: 0.5 });
    for (let i = 0; i < 28; i++) {
      const m = new THREE.Mesh(geo, mat);
      m.userData = {
        rx: ((i % 9) - 4) * 0.72,
        rz: ((i % 5) - 2) * 0.65,
        speed: 0.7 + (i % 5) * 0.25,
        rot: ((i % 2 === 0 ? 1 : -1) * (2.5 + (i % 4))),
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

    // 1. Main 3D Cylindrical Tower Body
    const tex = createBrickTextures(pal);
    tex.map.repeat.set(1, tower.floors / 8);
    tex.bumpMap.repeat.set(1, tower.floors / 8);
    tex.emissiveMap.repeat.set(1, tower.floors / 8);

    const cylGeo = new THREE.CylinderGeometry(TOWER_RADIUS, TOWER_RADIUS, totalH, 48, 1, false);
    const cylMat = new THREE.MeshStandardMaterial({
      map: tex.map,
      bumpMap: tex.bumpMap,
      bumpScale: 0.08,
      emissive: pal.glow,
      emissiveMap: tex.emissiveMap,
      emissiveIntensity: 0.65,
      roughness: 0.55,
      metalness: 0.22,
    });
    const cylMesh = new THREE.Mesh(cylGeo, cylMat);
    cylMesh.position.y = totalH * 0.5;
    group.add(cylMesh);

    // 2. Battlement / Crown at Top
    const crown = new THREE.Mesh(
      new THREE.CylinderGeometry(TOWER_RADIUS + 0.14, TOWER_RADIUS + 0.08, 0.35, 32),
      new THREE.MeshStandardMaterial({
        color: pal.ledge,
        emissive: pal.glow,
        emissiveIntensity: 0.35,
        metalness: 0.5,
        roughness: 0.3,
      })
    );
    crown.position.y = totalH + 0.17;
    group.add(crown);

    // 3. 4 Glowing Vertical Energy Conduits
    const conduitGeo = new THREE.CylinderGeometry(0.055, 0.055, totalH, 8);
    const conduitMat = new THREE.MeshStandardMaterial({
      color: '#ffffff',
      emissive: pal.glow,
      emissiveIntensity: 1.8,
      roughness: 0.1,
    });
    for (let k = 0; k < 4; k++) {
      const phi = k * 4 * COL_ANGLE;
      const cm = new THREE.Mesh(conduitGeo, conduitMat);
      cm.position.set(
        (TOWER_RADIUS + 0.03) * Math.sin(phi),
        totalH * 0.5,
        (TOWER_RADIUS + 0.03) * Math.cos(phi)
      );
      group.add(cm);
    }

    // 4. 3D Doors & Portals
    for (const door of tower.doors) {
      const phi = (door.col + 0.5) * COL_ANGLE;
      const dg = new THREE.Group();
      dg.position.set(
        (TOWER_RADIUS + 0.02) * Math.sin(phi),
        door.floor * FLOOR_HEIGHT + 0.42,
        (TOWER_RADIUS + 0.02) * Math.cos(phi)
      );
      dg.rotation.y = phi;

      const inner = new THREE.Mesh(
        new THREE.BoxGeometry(0.56, 0.82, 0.12),
        new THREE.MeshBasicMaterial({ color: door.isExit ? '#422006' : '#02040a' })
      );
      const frame = new THREE.Mesh(
        new THREE.TorusGeometry(0.36, 0.05, 8, 20, Math.PI),
        new THREE.MeshStandardMaterial({
          color: door.isExit ? '#fde047' : pal.glow,
          emissive: door.isExit ? '#f59e0b' : pal.glow,
          emissiveIntensity: 1.5,
        })
      );
      frame.position.y = 0.1;
      dg.add(inner, frame);
      group.add(dg);
    }

    // 5. 3D Elevator Shaft Rails & Lift Pods
    const elevatorPods = [];
    for (const el of tower.elevators) {
      const phi = (el.col + 0.5) * COL_ANGLE;
      const r = TOWER_RADIUS + 0.28;
      const railH = (el.maxFloor - el.minFloor) * FLOOR_HEIGHT + 0.6;
      const rail = new THREE.Mesh(
        new THREE.CylinderGeometry(0.035, 0.035, railH, 8),
        new THREE.MeshStandardMaterial({ color: '#94a3b8', metalness: 0.7, roughness: 0.25 })
      );
      rail.position.set(
        r * Math.sin(phi),
        ((el.minFloor + el.maxFloor) * 0.5) * FLOOR_HEIGHT,
        r * Math.cos(phi)
      );
      group.add(rail);

      const pod = new THREE.Mesh(
        new THREE.BoxGeometry(0.88, 0.18, 0.62),
        new THREE.MeshStandardMaterial({
          color: '#38bdf8',
          emissive: '#0284c7',
          emissiveIntensity: 0.8,
          metalness: 0.5,
          roughness: 0.2,
        })
      );
      pod.position.set(r * Math.sin(phi), el.startFloor * FLOOR_HEIGHT - 0.1, r * Math.cos(phi));
      pod.rotation.y = phi;
      group.add(pod);
      elevatorPods.push(pod);
    }

    // 6. 3D Extruded Ledges & Boxes
    const ledgeWidth = TOWER_RADIUS * COL_ANGLE * 1.12;
    const ledgeGeo = new THREE.BoxGeometry(ledgeWidth, 0.22, 0.68);
    const boxGeo = new THREE.BoxGeometry(ledgeWidth * 0.88, 0.54, 0.58);

    const solidMat = new THREE.MeshStandardMaterial({
      color: pal.ledge,
      emissive: pal.glow,
      emissiveIntensity: 0.22,
      roughness: 0.32,
      metalness: 0.35,
    });
    const iceMat = new THREE.MeshStandardMaterial({
      color: '#bae6fd',
      emissive: '#0284c7',
      emissiveIntensity: 0.45,
      roughness: 0.08,
      metalness: 0.2,
      transparent: true,
      opacity: 0.86,
    });
    const convMat = new THREE.MeshStandardMaterial({
      map: this.conveyorTex,
      emissive: '#a855f7',
      emissiveIntensity: 0.35,
      roughness: 0.35,
    });

    const ledgeMeshes = [];
    for (const l of tower.ledges) {
      const phi = (l.col + 0.5) * COL_ANGLE;
      const r = TOWER_RADIUS + 0.34;
      let mat = solidMat;
      let geo = ledgeGeo;
      let y = l.floor * FLOOR_HEIGHT - 0.11;

      if (l.type === 'ice') {
        mat = iceMat;
      } else if (l.type === 'conveyorR' || l.type === 'conveyorL') {
        mat = convMat;
      } else if (l.type === 'crumble') {
        mat = new THREE.MeshStandardMaterial({
          color: '#f59e0b',
          emissive: '#b45309',
          emissiveIntensity: 0.3,
          roughness: 0.65,
        });
      } else if (l.type === 'box') {
        geo = boxGeo;
        y = l.floor * FLOOR_HEIGHT + 0.27;
        mat = new THREE.MeshStandardMaterial({
          color: '#facc15',
          emissive: '#ea580c',
          emissiveIntensity: 0.55,
          roughness: 0.3,
          metalness: 0.4,
        });
      }

      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(r * Math.sin(phi), y, r * Math.cos(phi));
      mesh.rotation.y = phi;
      mesh.userData = { baseX: mesh.position.x, baseY: y, type: l.type };
      group.add(mesh);
      ledgeMeshes.push(mesh);
    }

    const cached = { group, ledgeMeshes, elevatorPods, cylMat };
    this.towerCache.set(tower.id, cached);
    return cached;
  }

  _createEnemyMesh(type) {
    const g = new THREE.Group();
    if (type === 'molecule') {
      const core = new THREE.Mesh(
        new THREE.SphereGeometry(0.12, 12, 12),
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
            emissiveIntensity: 0.85,
            roughness: 0.2,
          })
        );
        g.add(a);
        atoms.push(a);
      }
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(0.32, 0.02, 6, 24),
        new THREE.MeshBasicMaterial({ color: '#67e8f9', transparent: true, opacity: 0.65 })
      );
      ring.rotation.x = Math.PI * 0.35;
      g.add(ring);
      g.userData.atoms = atoms;
      g.userData.ring = ring;
    } else if (type === 'roller') {
      const ball = new THREE.Mesh(
        new THREE.SphereGeometry(0.26, 16, 14),
        new THREE.MeshStandardMaterial({
          color: '#f97316',
          emissive: '#9a3412',
          emissiveIntensity: 0.4,
          metalness: 0.75,
          roughness: 0.25,
        })
      );
      const band = new THREE.Mesh(
        new THREE.TorusGeometry(0.26, 0.035, 8, 20),
        new THREE.MeshBasicMaterial({ color: '#fef08a' })
      );
      ball.add(band);
      g.add(ball);
      g.userData.ball = ball;
    } else if (type === 'bouncer') {
      const body = new THREE.Mesh(
        new THREE.SphereGeometry(0.25, 16, 14),
        new THREE.MeshStandardMaterial({
          color: '#ef4444',
          emissive: '#991b1b',
          emissiveIntensity: 0.45,
          roughness: 0.25,
        })
      );
      g.add(body);
    } else {
      // 'eye'
      const sclera = new THREE.Mesh(
        new THREE.SphereGeometry(0.26, 16, 14),
        new THREE.MeshStandardMaterial({ color: '#f8fafc', roughness: 0.15 })
      );
      sclera.scale.set(1.15, 0.85, 0.85);
      const iris = new THREE.Mesh(
        new THREE.SphereGeometry(0.13, 12, 12),
        new THREE.MeshStandardMaterial({
          color: '#ec4899',
          emissive: '#db2777',
          emissiveIntensity: 0.8,
        })
      );
      iris.position.z = 0.16;
      const pupil = new THREE.Mesh(
        new THREE.SphereGeometry(0.06, 8, 8),
        new THREE.MeshBasicMaterial({ color: '#090d16' })
      );
      pupil.position.z = 0.25;
      g.add(sclera, iris, pupil);
    }
    return g;
  }

  _initSubScene() {
    this.subScene = new THREE.Scene();
    this.subScene.background = new THREE.Color('#02182b');
    this.subScene.fog = new THREE.FogExp2('#03243f', 0.045);

    this.subCam = new THREE.PerspectiveCamera(46, 360 / 540, 0.1, 80);
    this.subCam.position.set(0, 0, 12);

    this.subScene.add(new THREE.HemisphereLight('#7dd3fc', '#02101e', 1.1));
    const subKey = new THREE.DirectionalLight('#bae6fd', 1.4);
    subKey.position.set(4, 10, 8);
    this.subScene.add(subKey);

    // Volumetric Underwater Light Shafts
    this.lightShafts = [];
    const shaftGeo = new THREE.PlaneGeometry(1.6, 16);
    for (let i = 0; i < 5; i++) {
      const mat = new THREE.MeshBasicMaterial({
        color: '#38bdf8',
        transparent: true,
        opacity: 0.08,
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

    // Seabed
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

    // MK.7 Mini-Submarine
    const subG = new THREE.Group();
    const hull = new THREE.Mesh(
      new THREE.SphereGeometry(0.45, 20, 16),
      new THREE.MeshStandardMaterial({ color: '#e2e8f0', metalness: 0.6, roughness: 0.25 })
    );
    hull.scale.set(1.55, 0.82, 0.82);
    const stripe = new THREE.Mesh(
      new THREE.CylinderGeometry(0.39, 0.39, 0.1, 18),
      new THREE.MeshStandardMaterial({ color: '#38bdf8', emissive: '#0284c7', emissiveIntensity: 0.9 })
    );
    stripe.rotation.z = Math.PI / 2;
    const dome = new THREE.Mesh(
      new THREE.SphereGeometry(0.28, 16, 12, 0, TWO_PI, 0, Math.PI * 0.5),
      new THREE.MeshStandardMaterial({
        color: '#38bdf8',
        transparent: true,
        opacity: 0.7,
        roughness: 0.1,
      })
    );
    dome.position.set(0.18, 0.22, 0);
    const pogoHead = new THREE.Mesh(
      new THREE.SphereGeometry(0.14, 12, 12),
      new THREE.MeshStandardMaterial({ color: '#4ade80', roughness: 0.3 })
    );
    pogoHead.position.set(0.18, 0.28, 0);
    const prop = new THREE.Mesh(
      new THREE.BoxGeometry(0.08, 0.45, 0.12),
      new THREE.MeshStandardMaterial({ color: '#fbbf24', metalness: 0.5, roughness: 0.3 })
    );
    prop.position.set(-0.76, 0, 0);
    const cone = new THREE.Mesh(
      new THREE.ConeGeometry(0.75, 2.6, 16, 1, true),
      new THREE.MeshBasicMaterial({
        color: '#fde047',
        transparent: true,
        opacity: 0.16,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
      })
    );
    cone.rotation.z = Math.PI / 2;
    cone.position.set(1.9, 0, 0);
    subG.add(hull, stripe, dome, pogoHead, prop, cone);
    subG.userData.prop = prop;
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
    this.webgl.setPixelRatio(Math.min(dpr, 2));
    this.webgl.setSize(w, h, false);

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
      x: ((x / this.width) - 0.5) * 2 * halfW + cam.position.x,
      y: (0.5 - (y / this.height)) * 2 * halfH + cam.position.y,
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
    const camZ = aspect < 0.78 ? 11.4 * (0.78 / Math.max(0.45, aspect)) : 11.4;
    const camY = camFloor * FLOOR_HEIGHT + 0.65;
    const shake = getShakeOffset(state.shake, time);

    this.towerCam.position.set(shake.x, camY + shake.y, camZ);
    this.towerCam.lookAt(shake.x, camY - 0.35 + shake.y, 0);

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

    // Animate conveyor texture
    this.conveyorTex.offset.x = -(time * 1.4) % 1;

    // Update ledges (gone, crumble shake, box pulse)
    for (let i = 0; i < state.ledges.length; i++) {
      const l = state.ledges[i];
      const mesh = cached.ledgeMeshes[i];
      if (!mesh) continue;
      mesh.visible = !l.gone;
      if (!mesh.visible) continue;

      if (l.type === 'crumble') {
        mesh.material.color.set(l.crumbling ? '#ef4444' : '#f59e0b');
        mesh.material.emissive.set(l.crumbling ? '#dc2626' : '#b45309');
        mesh.position.y = mesh.userData.baseY + (l.shake ? Math.sin(time * 55) * 0.05 : 0);
      } else if (l.type === 'box') {
        const flash = Math.sin(time * 10) > 0;
        mesh.material.color.set(flash ? '#facc15' : '#f97316');
      }
    }

    // Update elevator pods
    for (let i = 0; i < state.elevators.length; i++) {
      const el = state.elevators[i];
      const pod = cached.elevatorPods[i];
      if (pod) pod.position.y = el.floor * FLOOR_HEIGHT - 0.1;
    }

    // Update Pogo 3D Hero
    const pogoVisible = !player.hidden && !topple.active;
    this.pogoGroup.visible = pogoVisible;
    if (pogoVisible) {
      const pTheta = wrapAngle((player.col - camCol) * COL_ANGLE);
      const pr = TOWER_RADIUS + 0.38;
      const px = pr * Math.sin(pTheta);
      const pz = pr * Math.cos(pTheta);
      const py = player.floor * FLOOR_HEIGHT + (topple.active ? tg.position.y : 0);

      const moving = player.onGround && Math.abs(player.vx) > 0.2;
      const bob = moving ? Math.abs(Math.sin(time * 18)) * 0.08 : 0;
      const stride = moving ? Math.sin(time * 18) * 0.12 : 0;

      this.pogoGroup.position.set(px, py + bob, pz);
      this.pogoGroup.rotation.y = pTheta + (player.facing < 0 ? Math.PI : 0);
      const sx = player.squashX || 1;
      const sy = player.squashY || 1;
      this.pogoGroup.scale.set(sx, sy, sx);

      this.pogoGroup.userData.footL.position.x = stride;
      this.pogoGroup.userData.footR.position.x = -stride;

      const blinking = ((time * 0.75) % 4.4) > 4.22;
      const eyeScaleY = blinking ? 0.1 : 1;
      this.pogoGroup.userData.eyeL.scale.y = eyeScaleY;
      this.pogoGroup.userData.eyeR.scale.y = eyeScaleY;

      this.pogoGroup.userData.muzzle.scale.setScalar(player.fireCooldown > 0.1 ? 1.5 : 0.75);
      this.heroLight.position.set(px, py + 0.8, pz + 0.8);
      this.heroLight.color.set(pal.glow);
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
        slot.mesh.userData.ring.rotation.z = time * 2.5;
      } else if (en.type === 'roller' && slot.mesh.userData.ball) {
        slot.mesh.userData.ball.rotation.z -= 0.12 * (en.dir || 1);
      } else if (en.type === 'bouncer') {
        const hop = Math.sin(time * 9 + (en.phase || 0));
        slot.mesh.scale.set(1 - hop * 0.14, 1 + hop * 0.14, 1 - hop * 0.14);
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
    }

    // Animate 3D Toxic Ocean waves
    const seaPos = this.seaMesh.geometry.attributes.position;
    for (let i = 0; i < seaPos.count; i++) {
      const x = seaPos.getX(i);
      const z = seaPos.getZ(i);
      seaPos.setY(i, this.seaBaseY[i] + Math.sin(x * 0.65 + time * 3.8) * 0.14 + Math.cos(z * 0.8 + time * 2.9) * 0.08);
    }
    seaPos.needsUpdate = true;
    this.seaMesh.geometry.computeVertexNormals();

    // Parallax stars & planet
    this.starPoints.rotation.y = -camCol * COL_ANGLE * 0.15;
    this.planetGroup.rotation.y = time * 0.12;

    // Particles & Popups
    this._syncParticles(this.particlePool, this.towerScene, particles, this.towerCam, TOWER_RADIUS + 0.6);
    this._syncPopups(state.popups || [], camCol, this.towerScene, this.towerCam, true);

    this.webgl.render(this.towerScene, this.towerCam);
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

    // Fish
    while (this.subFishPool.length < sub.fish.length) {
      const fg = new THREE.Group();
      const body = new THREE.Mesh(
        new THREE.SphereGeometry(0.28, 14, 12),
        new THREE.MeshStandardMaterial({ color: '#f472b6', emissive: '#db2777', emissiveIntensity: 0.5 })
      );
      body.scale.set(1.4, 0.85, 0.65);
      const tail = new THREE.Mesh(
        new THREE.ConeGeometry(0.2, 0.35, 8),
        new THREE.MeshStandardMaterial({ color: '#f472b6', emissive: '#db2777', emissiveIntensity: 0.4 })
      );
      tail.rotation.z = -Math.PI / 2;
      tail.position.set(0.42, 0, 0);
      const bubble = new THREE.Mesh(
        new THREE.SphereGeometry(0.54, 16, 14),
        new THREE.MeshStandardMaterial({
          color: '#a5f3fc',
          transparent: true,
          opacity: 0.32,
          roughness: 0.05,
        })
      );
      fg.add(body, tail, bubble);
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
          emissiveIntensity: 0.5,
          transparent: true,
          opacity: 0.65,
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

    this.webgl.render(this.subScene, this.subCam);
  }
}
