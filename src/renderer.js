import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { TowerFx } from './towerFx.js';
import { PogoRig } from './pogo.js';
import { Ocean } from './water.js';
import { createTowerStoneMaterial, createLedgeStoneMaterial, setWaterlineY } from './materials.js';
import { PostFX } from './postfx.js';
import { settings, currentSkin } from './settings.js';
import { COLS } from './levels.js';

const TWO_PI = Math.PI * 2;
// Low sun behind and slightly left of the tower (rim light, water glitter path, sky disc)
const SUN_DIR = new THREE.Vector3(-0.2, 0.17, -0.96).normalize();
const COL_ANGLE = TWO_PI / COLS;
const TOWER_RADIUS = 2.55;
const FLOOR_HEIGHT = 1.0;

function wrapAngle(a) {
  let res = a % TWO_PI;
  if (res > Math.PI) res -= TWO_PI;
  if (res < -Math.PI) res += TWO_PI;
  return res;
}

function colDistR(a, b) {
  let d = (((b % COLS) + COLS) % COLS) - (((a % COLS) + COLS) % COLS);
  if (d > COLS / 2) d -= COLS;
  if (d < -COLS / 2) d += COLS;
  return d;
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

// Small deterministic PRNG so every tower's masonry looks the same on every load
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shadeHex(hex, amt) {
  const c = new THREE.Color(hex);
  const hsl = {};
  c.getHSL(hsl);
  c.setHSL(hsl.h, Math.min(1, hsl.s * (1 + amt * 0.4)), Math.max(0, Math.min(1, hsl.l * (1 + amt))));
  return `#${c.getHexString()}`;
}

// Curved slab that hugs the tower: an annular sector spanning `span` radians centred on +Z,
// from radius r0 to r1, `height` tall with its top face at y = 0.
function createArcSlabGeometry(r0, r1, span, height, bevel = 0.025, curveSegments = 6) {
  const a0 = -span / 2 - Math.PI / 2;
  const a1 = span / 2 - Math.PI / 2;
  const shape = new THREE.Shape();
  shape.moveTo(r1 * Math.cos(a0), r1 * Math.sin(a0));
  shape.absarc(0, 0, r1, a0, a1, false);
  shape.lineTo(r0 * Math.cos(a1), r0 * Math.sin(a1));
  shape.absarc(0, 0, r0, a1, a0, true);
  shape.closePath();
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: Math.max(0.001, height - bevel * 2),
    bevelEnabled: bevel > 0,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 2,
    curveSegments,
  });
  // Shape lives in XY with y = -r*cos(a); rotate so extrusion axis becomes +Y and shape -Y becomes +Z
  geo.rotateX(-Math.PI / 2);
  geo.translate(0, -height + bevel, 0);
  geo.computeVertexNormals();
  return geo;
}

function createSoftDotTexture() {
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 64;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.28, 'rgba(255,255,255,0.85)');
  g.addColorStop(0.6, 'rgba(255,255,255,0.25)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function createSkyMaterial() {
  return new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      topColor: { value: new THREE.Color('#02040d') },
      horizonColor: { value: new THREE.Color('#0b1d3d') },
      glowColor: { value: new THREE.Color('#38bdf8') },
      time: { value: 0 },
      yaw: { value: 0 },
      sunDir: { value: SUN_DIR.clone() },
      sunColor: { value: new THREE.Color('#ffb46e') },
      sunAmount: { value: 1 },
    },
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 topColor;
      uniform vec3 horizonColor;
      uniform vec3 glowColor;
      uniform float time;
      uniform float yaw;
      uniform vec3 sunDir;
      uniform vec3 sunColor;
      uniform float sunAmount;
      varying vec3 vDir;

      float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float noise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        vec2 u = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
                   mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
      }
      float fbm(vec2 p) {
        float v = 0.0;
        float a = 0.5;
        for (int i = 0; i < 4; i++) {
          v += a * noise(p);
          p *= 2.03;
          a *= 0.5;
        }
        return v;
      }

      void main() {
        vec3 d = normalize(vDir);
        float h = d.y;
        float ang = atan(d.x, d.z) + yaw;
        // Base vertical gradient
        float t = smoothstep(-0.05, 0.75, h);
        vec3 col = mix(horizonColor, topColor, t);
        // Horizon glow band
        col += glowColor * 0.1 * exp(-abs(h - 0.02) * 10.0);
        // Drifting nebula clouds
        vec2 uv = vec2(ang * 1.4, h * 3.2);
        float n = fbm(uv * 1.6 + vec2(time * 0.01, 0.0));
        float n2 = fbm(uv * 3.1 - vec2(0.0, time * 0.008));
        float neb = smoothstep(0.45, 0.85, n) * smoothstep(-0.1, 0.35, h) * (1.0 - smoothstep(0.55, 0.95, h));
        col += mix(glowColor, vec3(0.85, 0.45, 1.0), n2) * neb * 0.13;
        // Low sun behind the tower: disc, corona, and a warm band along the horizon
        float sd = max(dot(d, normalize(sunDir)), 0.0);
        col += sunColor * sunAmount * (pow(sd, 1600.0) * 3.0 + pow(sd, 90.0) * 0.12 + pow(sd, 10.0) * 0.04);
        col += sunColor * sunAmount * 0.09 * exp(-abs(h - 0.01) * 16.0) * pow(sd, 3.0);
        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  });
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
    this.webgl.toneMappingExposure = 1.05;
    this.webgl.shadowMap.enabled = true;
    this.webgl.shadowMap.type = THREE.PCFSoftShadowMap;
    this._v3 = new THREE.Vector3();
    this._v3b = new THREE.Vector3();
    this.softDotTex = createSoftDotTexture();

    // Reflection map used *only* by metal/chrome materials (not as scene lighting, which washed
    // the whole scene out in an earlier version)
    try {
      const pmrem = new THREE.PMREMGenerator(this.webgl);
      this.chromeEnv = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
      pmrem.dispose();
    } catch (_) {
      this.chromeEnv = null;
    }
    this.webgl.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

    this._initTowerScene();
    this._initSubScene();

    this.fx = new TowerFx(this.towerScene, this, this.softDotTex);
    this.postfx = new PostFX(this.webgl, { onTierChange: (tier) => this._applyQuality(tier) });
    this.postfx.attach(this.towerScene, this.towerCam);
    this.postfx.setMode(settings.quality || 'auto');
    this.postfx.setDiorama(settings.diorama !== false);
  }

  _renderWithComposer(scene, camera) {
    this.webgl.render(scene, camera);
  }

  // Quality tier changed (auto or by the player): resolution, shadows, effects
  _applyQuality(tier) {
    this.qualityTier = tier;
    if (this.ocean) this.ocean.resScale = tier === 'high' ? 0.6 : 0.4;
    if (this.keyLight) {
      const wantShadow = tier !== 'low';
      const size = tier === 'high' ? 2048 : 1024;
      if (this.keyLight.castShadow !== wantShadow || this.keyLight.shadow.mapSize.x !== size) {
        this.keyLight.castShadow = wantShadow;
        this.keyLight.shadow.mapSize.set(size, size);
        if (this.keyLight.shadow.map) {
          this.keyLight.shadow.map.dispose();
          this.keyLight.shadow.map = null;
        }
      }
    }
    if (this._lastSize) this.resize(this._lastSize.w, this._lastSize.h, this._lastSize.dpr);
  }

  // Image-based lighting from the current sky (rebuilt only when the sky's look changes)
  _updateEnvironment(pal, mech, heal) {
    const dark = mech?.darkness || 0;
    const key = `${pal.glow}|${pal.brickA}|${dark.toFixed(1)}|${Math.round((heal || 0) * 4)}`;
    if (this._envKey === key) return;
    this._envKey = key;
    if (!this._pmrem) {
      this._pmrem = new THREE.PMREMGenerator(this.webgl);
      this._envSkyMat = this.skyMat.clone();
      this._envScene = new THREE.Scene();
      this._envScene.add(new THREE.Mesh(new THREE.SphereGeometry(50, 32, 16), this._envSkyMat));
    }
    const src = this.skyMat.uniforms;
    const dst = this._envSkyMat.uniforms;
    for (const k of Object.keys(src)) {
      const v = src[k].value;
      if (v && v.copy) dst[k].value.copy(v);
      else dst[k].value = v;
    }
    const rt = this._pmrem.fromScene(this._envScene, 0.03, 0.1, 100);
    if (this._envRT) this._envRT.dispose();
    this._envRT = rt;
    this.towerScene.environment = rt.texture;
    this.towerScene.environmentIntensity = 0.55 * (1 - dark * 0.7);
  }

  setQualityMode(mode) {
    this.postfx?.setMode(mode);
  }

  setDiorama(on) {
    this.postfx?.setDiorama(on);
  }

  _initTowerScene() {
    this.towerScene = new THREE.Scene();
    this.towerScene.background = new THREE.Color('#030816');
    this.towerScene.fog = new THREE.Fog('#050d1f', 20, 58);

    this.towerCam = new THREE.PerspectiveCamera(46, 360 / 540, 0.1, 140);

    // Gradient + nebula sky dome (follows the camera so it reads as infinitely far away)
    this.skyMat = createSkyMaterial();
    this.skyDome = new THREE.Mesh(new THREE.SphereGeometry(100, 32, 20), this.skyMat);
    this.skyDome.renderOrder = -10;
    this.skyDome.frustumCulled = false;
    this.towerScene.add(this.skyDome);

    // Balanced high-contrast 3-point lighting (no washed-out white fill/bloom)
    const hemi = new THREE.HemisphereLight('#38bdf8', '#020617', 0.35);
    this.hemiLight = hemi;
    this.towerScene.add(hemi);

    // Key light casts real-time shadows (ledges onto the wall, Pogo & enemies onto ledges).
    // It follows the camera vertically so the shadow frustum stays tight around the action.
    const keyLight = new THREE.DirectionalLight('#fff4e0', 1.7);
    keyLight.position.set(6, 14, 12);
    keyLight.castShadow = true;
    const isSmall = Math.min(window.innerWidth, window.innerHeight) < 600;
    keyLight.shadow.mapSize.set(isSmall ? 1024 : 2048, isSmall ? 1024 : 2048);
    const sc = keyLight.shadow.camera;
    sc.left = -5.5;
    sc.right = 5.5;
    sc.top = 7.5;
    sc.bottom = -7.5;
    sc.near = 2;
    sc.far = 40;
    keyLight.shadow.bias = -0.0008;
    keyLight.shadow.normalBias = 0.025;
    keyLight.shadow.radius = 3;
    this.keyLight = keyLight;
    this.towerScene.add(keyLight);
    this.towerScene.add(keyLight.target);

    const fillLight = new THREE.DirectionalLight('#1e3a8a', 0.28);
    fillLight.position.set(-6, 3, 10);
    this.fillLight = fillLight;
    this.towerScene.add(fillLight);

    const rimLight = new THREE.DirectionalLight('#ffd9a8', 1.1);
    rimLight.position.copy(SUN_DIR).multiplyScalar(30);
    this.rimLight = rimLight;
    this.towerScene.add(rimLight);

    this.heroLight = new THREE.PointLight('#38bdf8', 0.65, 6);
    this.towerScene.add(this.heroLight);

    // Pogo's lantern for the dark tower, and a lightning flash light
    this.lantern = new THREE.PointLight('#ffd7a0', 0, 7.5, 1.4);
    this.towerScene.add(this.lantern);
    this.lightningLight = new THREE.DirectionalLight('#dbeafe', 0);
    this.lightningLight.position.set(-6, 20, 8);
    this.towerScene.add(this.lightningLight);

    // 3D Starfield
    const starCount = 520;
    const starPos = new Float32Array(starCount * 3);
    const starCol = new Float32Array(starCount * 3);
    const c1 = new THREE.Color('#e0f2fe');
    const c2 = new THREE.Color('#a5f3fc');
    const c3 = new THREE.Color('#f5d0fe');
    for (let i = 0; i < starCount; i++) {
      const ang = Math.random() * TWO_PI;
      const dist = 24 + Math.random() * 28;
      starPos[i * 3] = Math.cos(ang) * dist;
      starPos[i * 3 + 1] = 1 + Math.random() * 52;
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
      size: 0.34,
      map: this.softDotTex,
      vertexColors: true,
      transparent: true,
      opacity: 0.95,
      depthWrite: false,
      fog: false,
      blending: THREE.AdditiveBlending,
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

    // Reflective ocean (planar reflections, ripples, glitter, foam)
    this.ocean = new Ocean(this.webgl, { towerRadius: TOWER_RADIUS });
    this.seaMesh = this.ocean.mesh;
    this.seaMat = this.ocean.material;
    this.towerScene.add(this.seaMesh);

    // Tower cache & dynamic pools
    this.towerCache = new Map();
    this.currentTowerGroup = null;
    this.conveyorTexR = createConveyorTexture(1);
    this.conveyorTexL = createConveyorTexture(-1);

    this.pogoRig = new PogoRig();
    this.pogoGroup = this.pogoRig.group;
    this._applyChrome(this.pogoGroup);
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

  _isSharedGeo(geo) {
    const c = this._ledgeGeoCache;
    return Boolean(c && Object.values(c).includes(geo));
  }

  _applyChrome(root) {
    if (!this.chromeEnv) return;
    root.traverse((o) => {
      const m = o.material;
      if (o.isMesh && m && m.isMeshStandardMaterial && m.metalness >= 0.55 && !m.envMap) {
        m.envMap = this.chromeEnv;
        m.envMapIntensity = 0.9;
        m.needsUpdate = true;
      }
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

  // Skins & hats (unlocked with medals)
  _applySkin(group, skin) {
    const ud = group.userData;
    if (!ud.mats || ud.skinId === skin.id) return;
    ud.skinId = skin.id;
    if (ud.recolor) ud.recolor(skin.body, skin.boots);
    else {
      ud.mats.bodyMat.color.set(skin.body);
      ud.mats.bodyMat.emissive.set(skin.emissive);
    }
    ud.mats.bodyMat.metalness = skin.metal ? 0.85 : 0.0;
    ud.mats.bodyMat.roughness = skin.metal ? 0.22 : 0.38;
    if (skin.metal && this.chromeEnv) {
      ud.mats.bodyMat.envMap = this.chromeEnv;
      ud.mats.bodyMat.needsUpdate = true;
    }
    ud.mats.lidMat.color.set(skin.body);
    if (ud.mats.limbMat) {
      ud.mats.limbMat.color.set(skin.body);
      ud.mats.limbMat.emissive?.set(skin.emissive);
    }
    ud.mats.lidMat.emissive?.set(skin.emissive);
    if (ud.mats.spotMat) ud.mats.spotMat.color.set(skin.body).multiplyScalar(0.72);
    ud.mats.bootMat.color.set(skin.boots);
    ud.mats.tipMat.emissive.set(skin.emissive);
    const hat = ud.hat;
    hat.scale.setScalar(0.85);
    while (hat.children.length) hat.remove(hat.children[0]);
    const mk = (geo, color, opts = {}) =>
      new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color, roughness: 0.4, metalness: 0.1, ...opts }));
    if (skin.hat === 'beanie') {
      const cap = mk(new THREE.SphereGeometry(0.2, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), '#e0f2fe');
      const band = mk(new THREE.TorusGeometry(0.19, 0.04, 8, 20), '#0284c7');
      band.rotation.x = Math.PI / 2;
      const pom = mk(new THREE.SphereGeometry(0.07, 10, 8), '#f472b6');
      pom.position.y = 0.21;
      hat.add(cap, band, pom);
    } else if (skin.hat === 'horns') {
      for (const z of [-0.12, 0.12]) {
        const horn = mk(new THREE.ConeGeometry(0.05, 0.22, 8), '#fef3c7');
        horn.position.set(0, 0.08, z);
        horn.rotation.x = z * 2.5;
        hat.add(horn);
      }
    } else if (skin.hat === 'visor') {
      const v = mk(new THREE.BoxGeometry(0.12, 0.08, 0.36), '#22d3ee', { emissive: '#06b6d4', emissiveIntensity: 2 });
      v.position.set(0.17, -0.1, 0);
      hat.add(v);
    } else if (skin.hat === 'antenna') {
      const stalk = mk(new THREE.CylinderGeometry(0.015, 0.015, 0.3, 6), '#94a3b8', { metalness: 0.8 });
      stalk.position.y = 0.15;
      const ball = mk(new THREE.SphereGeometry(0.05, 10, 8), '#ef4444', { emissive: '#ef4444', emissiveIntensity: 2 });
      ball.position.y = 0.32;
      hat.add(stalk, ball);
      ud.antennaBall = ball;
    } else if (skin.hat === 'crown') {
      const band = mk(new THREE.CylinderGeometry(0.15, 0.17, 0.1, 16, 1, true), '#facc15', { metalness: 0.9, roughness: 0.2, side: THREE.DoubleSide, envMap: this.chromeEnv || null });
      band.position.y = 0.04;
      hat.add(band);
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        const spike = mk(new THREE.ConeGeometry(0.035, 0.1, 6), '#facc15', { metalness: 0.9, roughness: 0.2, envMap: this.chromeEnv || null });
        spike.position.set(Math.cos(a) * 0.15, 0.13, Math.sin(a) * 0.15);
        hat.add(spike);
      }
      const gem = mk(new THREE.OctahedronGeometry(0.04), '#f43f5e', { emissive: '#e11d48', emissiveIntensity: 1.5 });
      gem.position.set(0.16, 0.05, 0);
      hat.add(gem);
    }
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
    const cacheKey = tower.cacheKey ?? tower.id;
    if (this.towerCache.has(cacheKey)) {
      return this.towerCache.get(cacheKey);
    }
    // Keep memory bounded in endless runs: drop the oldest cached tower geometry
    if (this.towerCache.size >= 3) {
      const [oldKey, old] = this.towerCache.entries().next().value;
      if (old.group !== this.currentTowerGroup) {
        old.group.traverse((o) => {
          if (o.isMesh && o.geometry && !this._isSharedGeo(o.geometry)) o.geometry.dispose();
        });
        this.towerCache.delete(oldKey);
      }
    }

    const pal = tower.palette;
    const group = new THREE.Group();
    const totalH = tower.floors * FLOOR_HEIGHT;

    // 1. Main 3D Cylindrical Tower Body with PBR maps
    // Procedural cut-stone PBR (normal, AO, roughness, palette-tinted albedo, glowing runes)
    const cylMat = createTowerStoneMaterial(pal, tower.id, tower.floors);
    this._stoneMats = this._stoneMats || new Set();
    this._stoneMats.add(cylMat);
    const cylMesh = new THREE.Mesh(
      new THREE.CylinderGeometry(TOWER_RADIUS, TOWER_RADIUS, totalH, 72, 1, false),
      cylMat
    );
    cylMesh.position.y = totalH * 0.5;
    group.add(cylMesh);

    // 2. Real 3D Cornice Rings every 2 floors
    const trimMat = createLedgeStoneMaterial(new THREE.Color(pal.brickB).lerp(new THREE.Color('#b9bec8'), 0.6), {});
    this._stoneMats.add(trimMat);
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
        new THREE.MeshBasicMaterial({ color: door.isExit ? '#713f12' : door.vault ? '#2e1065' : '#020617' })
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
        color: door.isExit ? '#fde047' : door.vault ? '#c084fc' : pal.glow,
        emissive: door.isExit ? '#f59e0b' : door.vault ? '#9333ea' : pal.glow,
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

    // 7. Curved ledges that hug the tower (annular sectors), so runs of ledges join into smooth
    //    walkways instead of flat boxes poking out at angles.
    const LEDGE_IN = TOWER_RADIUS - 0.06;
    const LEDGE_OUT = TOWER_RADIUS + 0.8;
    const span = COL_ANGLE * 0.985;
    const geoCache = this._ledgeGeoCache || (this._ledgeGeoCache = {
      deck: createArcSlabGeometry(LEDGE_IN, LEDGE_OUT, span, 0.2, 0.03, 8),
      lip: createArcSlabGeometry(LEDGE_OUT - 0.1, LEDGE_OUT + 0.025, span * 0.995, 0.07, 0.015, 8),
      corbel: createArcSlabGeometry(LEDGE_IN, TOWER_RADIUS + 0.42, span * 0.7, 0.2, 0.03, 6),
      seg: createArcSlabGeometry(LEDGE_IN, LEDGE_OUT - 0.04, span * 0.3, 0.2, 0.025, 4),
      iceDeck: createArcSlabGeometry(LEDGE_IN, LEDGE_OUT, span, 0.17, 0.05, 8),
    });
    const polar = (a, r) => [r * Math.sin(a), r * Math.cos(a)];
    const ledgeWidth = TOWER_RADIUS * COL_ANGLE * 1.12;
    const boxGeo = new THREE.BoxGeometry(ledgeWidth * 0.86, 0.54, 0.58);

    const solidMat = createLedgeStoneMaterial(new THREE.Color(pal.ledge).lerp(new THREE.Color('#c9ccd3'), 0.45), {});
    this._stoneMats.add(solidMat);
    const solidTopMat = new THREE.MeshStandardMaterial({
      color: pal.ledgeTop,
      emissive: pal.glow,
      emissiveIntensity: 0.55,
      roughness: 0.3,
    });
    const bracketMat = createLedgeStoneMaterial(new THREE.Color(pal.mortar).lerp(new THREE.Color('#5b5f68'), 0.6), {});
    this._stoneMats.add(bracketMat);
    const iceMat = new THREE.MeshStandardMaterial({
      color: '#7dd3fc',
      emissive: '#0284c7',
      emissiveIntensity: 0.25,
      roughness: 0.08,
      metalness: 0.1,
      transparent: true,
      opacity: 0.88,
    });
    const iceTopMat = new THREE.MeshStandardMaterial({
      color: '#e0f2fe',
      emissive: '#38bdf8',
      emissiveIntensity: 0.5,
      roughness: 0.15,
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
      emissiveIntensity: 0.6,
      roughness: 0.3,
    });
    const crumbleTopMat = new THREE.MeshStandardMaterial({
      color: '#fde68a',
      emissive: '#d97706',
      emissiveIntensity: 0.6,
      roughness: 0.4,
    });

    const crystalGeo = new THREE.ConeGeometry(0.07, 0.3, 5);
    const rollerGeo = new THREE.CylinderGeometry(0.06, 0.06, 0.6, 8);
    const conveyorRollers = [];

    const withShadows = (obj, cast = true, receive = true) => {
      obj.traverse((o) => {
        if (o.isMesh) {
          o.castShadow = cast;
          o.receiveShadow = receive;
        }
      });
      return obj;
    };

    const ledgeMeshes = [];
    for (const l of tower.ledges) {
      const phi = (l.col + 0.5) * COL_ANGLE;
      const y = l.floor * FLOOR_HEIGHT;

      const node = new THREE.Group();
      node.position.set(0, y, 0);
      node.rotation.y = phi;

      if (l.type === 'box') {
        const boxMat = new THREE.MeshStandardMaterial({
          color: '#facc15',
          emissive: '#ea580c',
          emissiveIntensity: 0.55,
          roughness: 0.28,
          metalness: 0.45,
        });
        const crate = new THREE.Mesh(boxGeo, boxMat);
        const core = new THREE.Mesh(
          new THREE.BoxGeometry(ledgeWidth * 0.5, 0.28, 0.62),
          new THREE.MeshBasicMaterial({ color: '#fef08a' })
        );
        crate.position.set(0, 0.27, TOWER_RADIUS + 0.34);
        core.position.copy(crate.position);
        node.add(crate, core);
        node.userData = { baseY: y, type: l.type, mainMat: boxMat };
      } else if (l.type === 'crumble') {
        // 3 fractured segments with a glowing amber fault lip
        const cMat = createLedgeStoneMaterial('#d6a256', { emissive: '#b45309', emissiveIntensity: 0.25 });
        for (const k of [-1, 0, 1]) {
          const seg = new THREE.Mesh(geoCache.seg, cMat);
          seg.rotation.y = k * span * 0.335;
          seg.rotation.z = k * 0.03;
          node.add(seg);
        }
        const cap = new THREE.Mesh(geoCache.lip, crumbleTopMat);
        cap.position.y = 0.035;
        node.add(cap);
        node.userData = { baseY: y, type: l.type, mainMat: cMat };
      } else if (l.type === 'ice') {
        const slab = new THREE.Mesh(geoCache.iceDeck, iceMat);
        const cap = new THREE.Mesh(geoCache.lip, iceTopMat);
        cap.position.y = 0.035;
        node.add(slab, cap);
        for (const k of [-0.32, 0.05, 0.3]) {
          const shard = new THREE.Mesh(crystalGeo, iceTopMat);
          const [sx, sz] = polar(k * span, LEDGE_OUT - 0.18);
          shard.position.set(sx, -0.3, sz);
          shard.rotation.z = Math.PI + k * 0.4;
          node.add(shard);
        }
        node.userData = { baseY: y, type: l.type };
      } else if (l.type === 'conveyorR' || l.type === 'conveyorL') {
        const cMat = l.type === 'conveyorR' ? convMatR : convMatL;
        const deck = new THREE.Mesh(geoCache.deck, cMat);
        const cap = new THREE.Mesh(geoCache.lip, convTopMat);
        cap.position.y = 0.035;
        node.add(deck, cap);
        const dir = l.type === 'conveyorR' ? 1 : -1;
        for (const k of [-0.32, 0, 0.32]) {
          // Wrapper aims the roller radially; the roller itself spins about its own axis
          const holder = new THREE.Group();
          holder.rotation.y = k * span;
          const rol = new THREE.Mesh(rollerGeo, bracketMat);
          rol.position.set(0, -0.12, TOWER_RADIUS + 0.4);
          rol.rotation.x = Math.PI / 2;
          holder.add(rol);
          node.add(holder);
          conveyorRollers.push({ mesh: rol, dir });
        }
        node.userData = { baseY: y, type: l.type };
      } else {
        // Solid ledge: stone deck + glowing front lip + support corbel underneath
        const deck = new THREE.Mesh(geoCache.deck, solidMat);
        const cap = new THREE.Mesh(geoCache.lip, solidTopMat);
        cap.position.y = 0.035;
        const corbel = new THREE.Mesh(geoCache.corbel, bracketMat);
        corbel.position.y = -0.2;
        corbel.scale.set(1, 1, 1);
        node.add(deck, cap, corbel);
        node.userData = { baseY: y, type: l.type };
      }

      withShadows(node, true, true);
      group.add(node);
      ledgeMeshes.push(node);
    }

    // Tower plinth rising out of the sea + shadow flags for the rest of the tower group
    const plinth = new THREE.Mesh(
      new THREE.CylinderGeometry(TOWER_RADIUS + 0.12, TOWER_RADIUS + 0.45, 1.6, 48),
      createLedgeStoneMaterial(new THREE.Color(pal.mortar).lerp(new THREE.Color('#4b4f58'), 0.6), {})
    );
    this._stoneMats.add(plinth.material);
    plinth.position.y = -0.8;
    plinth.receiveShadow = true;
    group.add(plinth);
    cylMesh.receiveShadow = true;
    for (const pod of elevatorPods) withShadows(pod, true, true);

    this._applyChrome(group);
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
    this.towerCache.set(cacheKey, cached);
    return cached;
  }

  _createEnemyMesh(type) {
    if (type === 'fireball') {
      const fb = this.fx.createFireballMesh();
      fb.userData.body = fb.userData.core;
      fb.userData.shell = new THREE.Object3D();
      return fb;
    }
    const g = this._createEnemyMeshInner(type);
    g.scale.setScalar(1.2); // read clearly at phone size
    g.traverse((o) => {
      if (o.isMesh && !(o.material && o.material.transparent)) o.castShadow = true;
    });
    return g;
  }

  _createEnemyMeshInner(type) {
    const g = new THREE.Group();
    const body = new THREE.Group(); // animated part (pops / squashes) — keeps halos & shells separate
    g.add(body);
    g.userData.body = body;
    const halo = (color, size) => {
      const sp = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: this.softDotTex,
          color,
          transparent: true,
          opacity: 0.55,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
        })
      );
      sp.scale.setScalar(size);
      g.add(sp);
      g.userData.halo = sp;
      return sp;
    };
    const cartoonEyes = (parent, z, y, spread, size, angry = true) => {
      const white = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.2 });
      const black = new THREE.MeshBasicMaterial({ color: '#0b1020' });
      for (const side of [-1, 1]) {
        const e = new THREE.Mesh(new THREE.SphereGeometry(size, 12, 10), white);
        e.position.set(side * spread, y, z);
        e.scale.z = 0.6;
        const pu = new THREE.Mesh(new THREE.SphereGeometry(size * 0.5, 10, 8), black);
        pu.position.set(side * spread * 0.9, y - size * 0.1, z + size * 0.5);
        parent.add(e, pu);
        if (angry) {
          const brow = new THREE.Mesh(new THREE.BoxGeometry(size * 2.1, size * 0.45, size * 0.5), black);
          brow.position.set(side * spread, y + size * 1.05, z + size * 0.25);
          brow.rotation.z = side * -0.45;
          parent.add(brow);
        }
      }
    };

    if (type === 'molecule') {
      // Flying molecule: glowing nucleus orbited by three charged atoms (shootable)
      const core = new THREE.Mesh(
        new THREE.IcosahedronGeometry(0.13, 1),
        new THREE.MeshStandardMaterial({ color: '#ffffff', emissive: '#fbcfe8', emissiveIntensity: 1.4, roughness: 0.2 })
      );
      body.add(core);
      const colors = ['#ff2a85', '#fbbf24', '#00f0ff'];
      const atoms = [];
      const bondMat = new THREE.MeshBasicMaterial({ color: '#f5d0fe', transparent: true, opacity: 0.6 });
      for (let i = 0; i < 3; i++) {
        const a = new THREE.Mesh(
          new THREE.SphereGeometry(0.115, 14, 12),
          new THREE.MeshStandardMaterial({ color: colors[i], emissive: colors[i], emissiveIntensity: 0.9, roughness: 0.15 })
        );
        const bond = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.2, 6), bondMat);
        body.add(a, bond);
        atoms.push({ a, bond });
      }
      const ring1 = new THREE.Mesh(
        new THREE.TorusGeometry(0.34, 0.016, 6, 32),
        new THREE.MeshBasicMaterial({ color: '#67e8f9', transparent: true, opacity: 0.7 })
      );
      ring1.rotation.x = Math.PI * 0.35;
      const ring2 = new THREE.Mesh(
        new THREE.TorusGeometry(0.34, 0.016, 6, 32),
        new THREE.MeshBasicMaterial({ color: '#f472b6', transparent: true, opacity: 0.65 })
      );
      ring2.rotation.y = Math.PI * 0.35;
      body.add(ring1, ring2);
      g.userData.atoms = atoms;
      g.userData.ring1 = ring1;
      g.userData.ring2 = ring2;
      halo('#f472b6', 1.25);
    } else if (type === 'roller') {
      // Silver rolling ball: chrome shell, glowing equator band, visor eye. Snowballs only freeze it.
      const ball = new THREE.Mesh(
        new THREE.SphereGeometry(0.27, 24, 18),
        new THREE.MeshStandardMaterial({
          color: '#e2e8f0',
          metalness: 0.95,
          roughness: 0.16,
          envMap: this.chromeEnv || null,
          envMapIntensity: 1.1,
        })
      );
      const band = new THREE.Mesh(
        new THREE.TorusGeometry(0.272, 0.03, 8, 32),
        new THREE.MeshStandardMaterial({ color: '#22d3ee', emissive: '#06b6d4', emissiveIntensity: 1.6 })
      );
      const band2 = band.clone();
      band2.rotation.y = Math.PI / 2;
      ball.add(band, band2);
      body.add(ball);
      // Visor stays upright (not rolling) so it reads as "looking" where it goes
      const visor = new THREE.Mesh(
        new THREE.BoxGeometry(0.3, 0.07, 0.1),
        new THREE.MeshStandardMaterial({ color: '#ef4444', emissive: '#ef4444', emissiveIntensity: 2.2 })
      );
      visor.position.set(0, 0.06, 0.25);
      body.add(visor);
      g.userData.ball = ball;
      g.userData.visor = visor;
      halo('#22d3ee', 0.95);
    } else if (type === 'bouncer') {
      // Bouncing ball: glossy rubber with an angry face; squashes on each bounce. Shootable.
      const rubber = new THREE.Mesh(
        new THREE.SphereGeometry(0.26, 24, 18),
        new THREE.MeshPhysicalMaterial({
          color: '#ef4444',
          emissive: '#7f1d1d',
          emissiveIntensity: 0.35,
          roughness: 0.25,
          clearcoat: 1.0,
          clearcoatRoughness: 0.15,
        })
      );
      const stripe = new THREE.Mesh(
        new THREE.TorusGeometry(0.262, 0.035, 8, 32),
        new THREE.MeshStandardMaterial({ color: '#fde047', emissive: '#f59e0b', emissiveIntensity: 0.6 })
      );
      stripe.rotation.x = Math.PI / 2;
      const face = new THREE.Group();
      cartoonEyes(face, 0.2, 0.06, 0.09, 0.065, true);
      body.add(rubber, stripe, face);
      halo('#f87171', 0.95);
    } else if (type === 'spiker') {
      // Spiky fuzzball: hovering guardian of staircases (two hits to pop)
      const hues = ['#facc15', '#38bdf8', '#4ade80', '#22d3ee', '#f472b6'];
      const col = hues[Math.floor(Math.random() * hues.length)];
      const coreMat = new THREE.MeshStandardMaterial({ color: col, emissive: col, emissiveIntensity: 0.35, roughness: 0.55 });
      const core = new THREE.Mesh(new THREE.IcosahedronGeometry(0.17, 2), coreMat);
      body.add(core);
      const spikeGeo = new THREE.ConeGeometry(0.035, 0.2, 5);
      spikeGeo.translate(0, 0.17, 0);
      const dirs = new THREE.IcosahedronGeometry(1, 1).attributes.position;
      const spikes = new THREE.InstancedMesh(spikeGeo, coreMat, 42);
      const seen = new Set();
      const m4 = new THREE.Matrix4();
      const q = new THREE.Quaternion();
      const up = new THREE.Vector3(0, 1, 0);
      const v = new THREE.Vector3();
      let n = 0;
      for (let i = 0; i < dirs.count && n < 42; i++) {
        v.fromBufferAttribute(dirs, i).normalize();
        const key = `${v.x.toFixed(2)},${v.y.toFixed(2)},${v.z.toFixed(2)}`;
        if (seen.has(key)) continue;
        seen.add(key);
        q.setFromUnitVectors(up, v);
        m4.compose(new THREE.Vector3(), q, new THREE.Vector3(1, 0.8 + Math.random() * 0.5, 1));
        spikes.setMatrixAt(n++, m4);
      }
      spikes.count = n;
      body.add(spikes);
      const face = new THREE.Group();
      cartoonEyes(face, 0.15, 0.03, 0.065, 0.05, true);
      body.add(face);
      g.userData.spikes = spikes;
      g.userData.coreMat = coreMat;
      halo(col, 1.0);
    } else if (type === 'chaser') {
      // Chrome robo-eye: patrols, then charges when it spots Pogo (three hits to scrap)
      const shell = new THREE.Mesh(
        new THREE.SphereGeometry(0.25, 28, 20),
        new THREE.MeshStandardMaterial({ color: '#cbd5e1', metalness: 0.95, roughness: 0.18, envMap: this.chromeEnv || null })
      );
      const lensRing = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.025, 8, 24), new THREE.MeshStandardMaterial({ color: '#1e293b', metalness: 0.8, roughness: 0.3 }));
      lensRing.position.z = 0.22;
      const lensMat = new THREE.MeshStandardMaterial({ color: '#22d3ee', emissive: '#06b6d4', emissiveIntensity: 1.8 });
      const lens = new THREE.Mesh(new THREE.SphereGeometry(0.1, 16, 12), lensMat);
      lens.position.z = 0.2;
      lens.scale.z = 0.5;
      const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.18, 6), lensRing.material);
      antenna.position.y = 0.3;
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.035, 10, 8), lensMat);
      bulb.position.y = 0.4;
      const legs = [];
      for (const side of [-1, 1]) {
        const leg = new THREE.Mesh(new THREE.CapsuleGeometry(0.035, 0.1, 3, 6), lensRing.material);
        leg.position.set(side * 0.12, -0.27, 0);
        body.add(leg);
        legs.push(leg);
      }
      body.add(shell, lensRing, lens, antenna, bulb);
      const alert = new THREE.Sprite(new THREE.SpriteMaterial({ map: this._alertTex(), transparent: true, depthWrite: false }));
      alert.scale.set(0.35, 0.35, 1);
      alert.position.y = 0.72;
      g.add(alert);
      g.userData.lensMat = lensMat;
      g.userData.legs = legs;
      g.userData.alert = alert;
      halo('#22d3ee', 0.9);
    } else {
      // Floating eye: invulnerable. Sclera, glowing iris, blinking lids and little bat wings.
      const sclera = new THREE.Mesh(
        new THREE.SphereGeometry(0.25, 20, 16),
        new THREE.MeshStandardMaterial({ color: '#f8fafc', roughness: 0.12 })
      );
      const veinMat = new THREE.MeshBasicMaterial({ color: '#fb7185' });
      for (let i = 0; i < 4; i++) {
        const vein = new THREE.Mesh(new THREE.TorusGeometry(0.252, 0.006, 4, 16, 0.7), veinMat);
        vein.rotation.set(Math.random() * 3, Math.random() * 3, 0);
        sclera.add(vein);
      }
      const iris = new THREE.Mesh(
        new THREE.SphereGeometry(0.13, 16, 12),
        new THREE.MeshStandardMaterial({ color: '#ec4899', emissive: '#db2777', emissiveIntensity: 1.3 })
      );
      iris.position.z = 0.16;
      iris.scale.z = 0.5;
      const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.06, 10, 8), new THREE.MeshBasicMaterial({ color: '#090d16' }));
      pupil.position.z = 0.23;
      const lidMat = new THREE.MeshStandardMaterial({ color: '#7c3aed', roughness: 0.4 });
      const lidTop = new THREE.Mesh(new THREE.SphereGeometry(0.262, 20, 10, 0, TWO_PI, 0, Math.PI / 2), lidMat);
      const lidBot = new THREE.Mesh(new THREE.SphereGeometry(0.262, 20, 10, 0, TWO_PI, 0, Math.PI / 2), lidMat);
      lidBot.rotation.x = Math.PI;
      const wingMat = new THREE.MeshStandardMaterial({ color: '#4c1d95', emissive: '#6d28d9', emissiveIntensity: 0.4, side: THREE.DoubleSide });
      const wingShape = new THREE.Shape();
      wingShape.moveTo(0, 0);
      wingShape.lineTo(0.32, 0.18);
      wingShape.lineTo(0.28, 0.02);
      wingShape.lineTo(0.38, -0.06);
      wingShape.lineTo(0.22, -0.08);
      wingShape.lineTo(0.12, -0.14);
      wingShape.closePath();
      const wingGeo = new THREE.ShapeGeometry(wingShape);
      const wings = [];
      for (const side of [-1, 1]) {
        const w = new THREE.Mesh(wingGeo, wingMat);
        w.position.set(side * 0.2, 0.04, -0.05);
        w.scale.x = side;
        body.add(w);
        wings.push(w);
      }
      body.add(sclera, iris, pupil, lidTop, lidBot);
      g.userData.iris = iris;
      g.userData.pupil = pupil;
      g.userData.lidTop = lidTop;
      g.userData.lidBot = lidBot;
      g.userData.wings = wings;
      halo('#c084fc', 1.1);
    }

    // Ice shell shown while stunned/frozen by a snowball
    // Ice block shown while frozen: flat-topped so it reads as a platform you can stand on
    const shell = new THREE.Mesh(
      new THREE.BoxGeometry(0.66, 0.61, 0.62, 1, 1, 1),
      new THREE.MeshStandardMaterial({
        color: '#bae6fd',
        emissive: '#38bdf8',
        emissiveIntensity: 0.35,
        roughness: 0.05,
        metalness: 0.1,
        transparent: true,
        opacity: 0.55,
        flatShading: true,
        depthWrite: false,
      })
    );
    shell.visible = false;
    g.add(shell);
    g.userData.shell = shell;
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
    this._lastSize = { w, h, dpr };
    const clampedDpr = Math.min(dpr, this.postfx ? this.postfx.pixelRatioCap : 2);
    this.postfx?.resize(w, h, clampedDpr);
    this.ocean?.setSize(w, h, clampedDpr);
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

  // Exact unprojection of a screen pixel onto the plane z = zPlane (works with a tilted camera)
  _screenToWorld(x, y, cam, zPlane = 0) {
    const v = this._v3.set((x / this.width) * 2 - 1, -(y / this.height) * 2 + 1, 0.5).unproject(cam);
    const dir = v.sub(cam.position).normalize();
    const t = Math.abs(dir.z) > 1e-5 ? (zPlane - cam.position.z) / dir.z : 0;
    return { x: cam.position.x + dir.x * t, y: cam.position.y + dir.y * t };
  }

  // Screen-pixel position of a point on the tower surface (used to spawn effects in the right spot)
  projectColFloor(col, floor, camCol, radialOffset = 0.35) {
    const theta = wrapAngle((col - camCol) * COL_ANGLE);
    if (Math.abs(theta) > Math.PI * 0.55) return null;
    const r = TOWER_RADIUS + radialOffset;
    const v = this._v3b.set(r * Math.sin(theta), floor * FLOOR_HEIGHT, r * Math.cos(theta)).project(this.towerCam);
    return { x: (v.x * 0.5 + 0.5) * this.width, y: (0.5 - v.y * 0.5) * this.height };
  }

  _syncParticles(pool, scene, particles, cam, zPlane) {
    while (pool.length < particles.length) {
      const m = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: this.softDotTex,
          color: '#ffffff',
          transparent: true,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
        })
      );
      m.renderOrder = 5;
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
      const lifeT = Math.max(0, p.life / (p.maxLife || 1));
      const s = Math.max(0.08, (p.size || 4) * 0.075) * (0.55 + lifeT * 0.65);
      m.scale.setScalar(s);
      m.material.color.set(p.color || '#ffffff');
      m.material.opacity = Math.min(1, lifeT * 1.4);
    }
  }

  renderTowerScene(state) {
    const { tower, player, camCol, camFloor, time, particles, snowballs, topple } = state;
    const pal = tower.palette;
    const aspect = this.towerCam.aspect;
    // Fit ~3.7 world units either side of the tower axis so the ledges curving around the sides
    // (where you're heading next) stay on screen on narrow phones.
    const halfTan = Math.tan(THREE.MathUtils.degToRad(this.towerCam.fov * 0.5));
    const camZ = Math.max(10.5, Math.min(15.5, 3.7 / (halfTan * Math.max(0.35, aspect))));
    // camFloor is already smoothed & jump-stabilised by the game; a gentle downward tilt shows ledge tops.
    const nowMs = performance.now();
    this._realDt = this._lastFrameMs ? Math.min(0.25, (nowMs - this._lastFrameMs) / 1000) : 0.016;
    this._lastFrameMs = nowMs;
    const mech = state.mech || { kind: 'none', darkness: 0, lightning: 0, waterFloor: -0.62 };
    // Summit / topple: slow cinematic pull-back to show the whole tower against the sky
    let pull = 0;
    if (state.summit) pull = Math.min(1, state.summit.t / state.summit.duration);
    if (topple.active || state.mode === 'results') pull = 1;
    pull = settings.reducedMotion ? pull * 0.4 : pull;
    const ease = pull * pull * (3 - 2 * pull);
    this._pullT = ease;
    const focusY = camFloor * FLOOR_HEIGHT + ease * 1.6;
    const shake = getShakeOffset(state.shake, time);

    // Idle push-in: stand still and the camera drifts closer for a character moment
    const idleGoal = state.mode === 'tower' && (player.idleTime || 0) > 2.5 && !settings.reducedMotion ? 1 : 0;
    this._idleZoom = (this._idleZoom || 0) + (idleGoal - (this._idleZoom || 0)) * Math.min(1, (this._realDt || 0.016) * (idleGoal ? 0.8 : 4));
    const iz = this._idleZoom * this._idleZoom * (3 - 2 * this._idleZoom);
    const pyFocus = player.floor * FLOOR_HEIGHT + 0.6;
    const zoomY = (pyFocus - focusY) * iz * 0.6;
    this.towerCam.position.set(shake.x, focusY + 1.15 + ease * 2.2 + shake.y + zoomY - iz * 0.5, camZ + ease * 7 - iz * camZ * 0.32);
    this.towerCam.lookAt(shake.x, focusY - 0.35 + shake.y + zoomY, 0);
    this.towerCam.updateMatrixWorld();

    // Shadow light tracks the view vertically
    this.keyLight.position.set(6, focusY + 12, 12);
    this.keyLight.target.position.set(0, focusY - 1, 0);
    this.keyLight.target.updateMatrixWorld();

    // Dynamic Per-Tower Biome Sky, Fog, Planet & Ocean Tinting
    this._tempColor.set(pal.mortar);
    this.towerScene.background.copy(this._skyBaseColor).lerp(this._tempColor, 0.38);
    this._tempColor.set(pal.brickA);
    this.towerScene.fog.color.copy(this._fogBaseColor).lerp(this._tempColor, 0.28);
    const sky = this.skyMat.uniforms;
    sky.topColor.value.copy(this.towerScene.background);
    sky.horizonColor.value.copy(this.towerScene.fog.color);
    sky.glowColor.value.set(pal.glow);
    sky.time.value = time;
    sky.yaw.value = -camCol * COL_ANGLE * 0.15;
    this.skyDome.position.copy(this.towerCam.position);
    this.hemiLight.color.set(pal.ledge);
    this.rimLight.color.set('#ffd9a8').lerp(this._tempColor.set(pal.glow), 0.25);
    this.planetMesh.material.color.set(pal.ledge);
    this.planetMesh.material.emissive.set(pal.glow);
    const su = this.seaMat.uniforms;
    su.time.value = time;
    su.skyColor.value.copy(this.towerScene.fog.color);
    su.glowColor.value.set(pal.glow);
    // The sea heals as towers fall: sickly toxic purple-green -> clear turquoise
    const heal = Math.max(0, Math.min(1, state.healing || 0));
    const toxicShallow = this._c1 || (this._c1 = new THREE.Color('#3b5214'));
    const cleanShallow = this._c2 || (this._c2 = new THREE.Color('#0aa5b8'));
    const toxicDeep = this._c3 || (this._c3 = new THREE.Color('#1b0b2a'));
    const cleanDeep = this._c4 || (this._c4 = new THREE.Color('#012a40'));
    su.shallowColor.value.copy(toxicShallow).lerp(cleanShallow, heal).lerp(this._tempColor.set(pal.brickA), 0.15).multiplyScalar(0.75);
    su.deepColor.value.copy(toxicDeep).lerp(cleanDeep, heal);
    const seaY = mech.kind === 'flood' ? mech.waterFloor * FLOOR_HEIGHT : -0.62;
    this.seaMesh.position.y = seaY;
    if (this._stoneMats) setWaterlineY(this._stoneMats, seaY);
    su.sunStrength.value = 1 - (mech.darkness || 0) * 0.8;
    su.sunDir.value.copy(SUN_DIR);
    sky.sunAmount.value = 1 - (mech.darkness || 0) * 0.9;

    // Darkness (night storm) & lightning
    const dark = mech.darkness || 0;
    const bolt = mech.lightning || 0;
    this.hemiLight.intensity = 0.35 * (1 - dark * 0.7) + bolt * 1.4;
    this.keyLight.intensity = 1.7 * (1 - dark * 0.85);

    this.lightningLight.intensity = bolt * 3.5;
    this.fillLight.intensity = 0.28 * (1 - dark * 0.9);
    this.rimLight.intensity = 1.1 * (1 - dark * 0.8);
    this.webgl.toneMappingExposure = 0.95 * (1 - dark * 0.3) + bolt * 0.5;
    this.lantern.intensity = dark > 0 ? 7 + Math.sin(time * 9) * 0.4 : 0;
    this.lantern.distance = 6.5;
    if (this._cachedTower?.cylMat) this._cachedTower.cylMat.emissiveIntensity = 0.35 + dark * 1.4;
    this.lantern.color.set(dark > 0 ? '#ffd7a0' : '#ffffff');
    if (dark > 0) {
      this.towerScene.fog.color.multiplyScalar(1 - dark * 0.7).lerp(this._tempColor.set('#c7d2fe'), bolt * 0.5);
      this.towerScene.fog.near = 20 - dark * 12;
      this.towerScene.fog.far = 58 - dark * 30;
      sky.topColor.value.multiplyScalar(1 - dark * 0.6).lerp(this._tempColor.set('#e0e7ff'), bolt * 0.4);
      sky.horizonColor.value.copy(this.towerScene.fog.color);
    } else {
      this.towerScene.fog.near = 20;
      this.towerScene.fog.far = 58;
    }

    // Swap cached tower group if tower changed
    const cached = this._getOrBuildTowerGroup(tower);
    if (this.currentTowerGroup !== cached.group) {
      if (this.currentTowerGroup) this.towerScene.remove(this.currentTowerGroup);
      this.currentTowerGroup = cached.group;
      this.towerScene.add(this.currentTowerGroup);
    }

    this._cachedTower = cached;
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
      // Height you can feel: the upper tower sways gently in the wind (more in gales)
      const heightFrac = Math.min(1, player.floor / Math.max(1, tower.floors));
      const gustAmp = mech.gust && mech.gust.state === 'blow' ? 2.2 : 1;
      tg.rotation.z = settings.reducedMotion ? 0 : Math.sin(time * 0.7) * 0.0045 * heightFrac * gustAmp;
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
      mesh.visible = !l.gone && !l.collapsed;
      if (!mesh.visible) continue;

      if (l.piston) {
        // Clockwork piston: slides into the wall, blinking red before it goes
        const retract = l.retracted ? 1 : 0;
        mesh.userData.slide = (mesh.userData.slide ?? 0) + (retract - (mesh.userData.slide ?? 0)) * 0.25;
        const k = mesh.userData.slide;
        mesh.scale.set(1 - k * 0.15, 1, 1 - k * 0.15);
        mesh.position.y = mesh.userData.baseY - k * 0.02;
        mesh.visible = k < 0.97;
        if (!mesh.userData.pistonMat) {
          mesh.traverse((o) => {
            if (o.isMesh && !mesh.userData.pistonMat) {
              o.material = o.material.clone();
              mesh.userData.pistonMat = o.material;
            }
          });
        }
        const pm = mesh.userData.pistonMat;
        if (pm && pm.emissive) {
          const warn = l.pistonWarn && Math.sin(time * 30) > 0;
          pm.emissive.set(warn ? '#ef4444' : '#a16207');
          pm.emissiveIntensity = warn ? 1.2 : 0.35;
        }
        continue;
      }

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
    // Flicker while invulnerable after a hit / respawn
    const blinkOff = player.invuln > 0 && player.invuln < 1.6 && Math.floor(time * 18) % 3 === 0;
    this.pogoGroup.visible = pogoVisible && !blinkOff;
    this.landingRingGroup.visible = pogoVisible;
    if (pogoVisible) {
      this._applySkin(this.pogoGroup, currentSkin());
      this.pogoGroup.position.set(px, py + (player.hang ? 0.05 : 0), pz);
      this.pogoGroup.rotation.set(player.hang ? -0.25 : 0, pTheta, 0);
      this.pogoGroup.scale.setScalar(1.25);

      // Nearest threat drives Pogo's eyes and nerves
      let dangerDir = null;
      let dangerUp = 0;
      let danger = 0;
      for (const en of state.enemies) {
        if (en.dead) continue;
        const dc = colDistR(player.col, en.col);
        const df = en.floor - player.floor;
        const d = Math.abs(dc) + Math.abs(df) * 1.5;
        const k = 1 - Math.min(1, d / 3.2);
        if (k > danger) {
          danger = k;
          dangerDir = Math.sign(dc) * (player.facing || 1);
          dangerUp = Math.max(-1, Math.min(1, df));
        }
      }
      const emote = player.emote && player.emote.t > 0 ? player.emote.kind : null;
      this.pogoRig.update(this._realDt || 0.016, {
        time,
        vx: player.vx,
        vy: player.vy,
        facing: player.facing,
        onGround: player.onGround,
        squashX: player.squashX || 1,
        squashY: player.squashY || 1,
        teeter: (player.teeter || 0) > 0,
        stun: player.stunTimer > 0,
        hurt: player.hurtFace > 0.6,
        idle: state.mode === 'tower' ? player.idleTime || 0 : 0,
        celebrate: player.celebrate > 0 && (state.mode === 'summit' || state.mode === 'topple' || state.mode === 'results'),
        emote,
        pound: player.pound,
        hang: Boolean(player.hang),
        charge: player.charge || 0,
        muzzle: player.muzzleFlash || 0,
        frozen: player.frozenSelf > 0,
        danger,
        dangerDir,
        dangerUp,
        lowTime: state.mode === 'tower' && state.timer < 15,
        dark: (mech.darkness || 0) > 0.5,
      });

      this.heroLight.position.set(px, py + 0.8, pz + 0.8);
      this.heroLight.color.set(pal.glow);
      if ((mech.darkness || 0) > 0.5) this.pogoRig.lanternWorld(this.lantern.position);
      else this.lantern.position.set(px + 0.3, py + 1.1, pz + 0.6);

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
    let warnIdx = 0;
    for (let i = 0; i < this.enemyPool.length; i++) {
      const slot = this.enemyPool[i];
      const en = state.enemies[i];
      if (!en || (en.dead && !(en.deathTimer > 0))) {
        slot.mesh.visible = false;
        continue;
      }
      if (slot.type !== en.type) {
        this.towerScene.remove(slot.mesh);
        slot.mesh = this._createEnemyMesh(en.type);
        slot.type = en.type;
        this.towerScene.add(slot.mesh);
      }
      const ud = slot.mesh.userData;
      const body = ud.body;
      slot.mesh.visible = true;
      const eTheta = wrapAngle((en.col - camCol) * COL_ANGLE);
      const er = TOWER_RADIUS + 0.4;
      slot.mesh.position.set(er * Math.sin(eTheta), en.floor * FLOOR_HEIGHT + 0.28, er * Math.cos(eTheta));
      slot.mesh.rotation.set(0, eTheta + (en.dir < 0 ? -0.5 : 0.5), 0);

      // Death pop: swell then vanish
      if (en.dead) {
        const k = 1 - en.deathTimer / 0.5;
        const sc = (1 + k * 0.9) * Math.max(0, 1 - k * 1.4);
        body.scale.setScalar(Math.max(0.001, sc));
        body.rotation.y += 0.4;
        if (ud.halo) ud.halo.material.opacity = 0.9 * (1 - k);
        ud.shell.visible = false;
        continue;
      }

      const frozen = en.stunTimer > 0;
      ud.shell.visible = frozen;
      if (frozen) {
        const crack = en.stunTimer < 1 ? Math.sin(time * 40) * 0.04 : 0;
        ud.shell.rotation.set(0, crack * 3, 0);
        ud.shell.scale.setScalar(1 + crack);
      }
      const flashK = en.hitFlash > 0 ? 1.25 : 1;
      body.scale.setScalar(flashK);
      if (ud.halo) {
        ud.halo.material.opacity = frozen ? 0.15 : 0.45 + Math.sin(time * 6 + i) * 0.12;
      }

      if (en.type === 'molecule' && ud.atoms) {
        const rot = frozen ? 0 : time * 4.2 * (en.dir || 1);
        ud.atoms.forEach(({ a, bond }, idx) => {
          const ang = rot + (idx * TWO_PI) / 3;
          const x = Math.cos(ang) * 0.22;
          const y = Math.sin(ang) * 0.22;
          a.position.set(x, y, 0);
          bond.position.set(x * 0.5, y * 0.5, 0);
          bond.rotation.z = ang + Math.PI / 2;
        });
        if (!frozen) {
          ud.ring1.rotation.z = time * 2.5;
          ud.ring2.rotation.x = -time * 2.1;
        }
      } else if (en.type === 'roller' && ud.ball) {
        if (!frozen) ud.ball.rotation.x += 0.12 * en.speed;
        slot.mesh.rotation.y = eTheta + (en.dir < 0 ? -Math.PI / 2 : Math.PI / 2) * 0.85;
        ud.visor.material.emissiveIntensity = frozen ? 0.2 : 1.8 + Math.sin(time * 12) * 0.6;
      } else if (en.type === 'bouncer') {
        // Squash on ground contact, stretch at speed
        const h = en.floor - Math.round(en.baseFloor);
        const squash = frozen ? 0 : Math.max(0, 0.18 - h) / 0.18;
        body.scale.set(flashK * (1 + squash * 0.3), flashK * (1 - squash * 0.32 + (h > 0.4 ? 0.06 : 0)), flashK * (1 + squash * 0.3));
        body.position.y = -squash * 0.07;
      } else if (en.type === 'spiker' && ud.spikes) {
        const pulse = frozen ? 1 : 1 + Math.sin(time * 8 + i) * 0.08;
        ud.spikes.scale.setScalar(pulse);
        if (!frozen) body.rotation.y = time * 1.2 + i;
        ud.coreMat.emissiveIntensity = en.hp < 2 ? 0.9 + Math.sin(time * 20) * 0.4 : 0.35;
        slot.mesh.rotation.y = eTheta;
      } else if (en.type === 'chaser' && ud.lensMat) {
        const a = en.alert || 0;
        ud.lensMat.color.set(a > 0.3 ? '#ef4444' : '#22d3ee');
        ud.lensMat.emissive.set(a > 0.3 ? '#dc2626' : '#06b6d4');
        ud.alert.visible = a > 0.3 && !frozen;
        ud.alert.position.y = 0.72 + Math.sin(time * 12) * 0.03;
        const step = frozen ? 0 : Math.sin(time * (8 + a * 10) + i);
        ud.legs[0].position.y = -0.27 + Math.max(0, step) * 0.05;
        ud.legs[1].position.y = -0.27 + Math.max(0, -step) * 0.05;
        body.position.y = Math.abs(step) * 0.03;
        slot.mesh.rotation.y = eTheta + (en.dir < 0 ? -Math.PI / 2 : Math.PI / 2) * 0.8;
      } else if (ud.isFireball) {
        ud.core.rotation.set(time * 7, time * 5, 0);
        ud.halo.material.opacity = 0.7 + Math.sin(time * 30 + i) * 0.2;
        ud.trail.forEach((t, k) => t.position.set(-(en.dir || 1) * (k + 1) * 0.16, Math.sin(time * 20 + k) * 0.03, 0));
        slot.mesh.rotation.y = eTheta;
      } else if (en.type === 'eye' && ud.iris) {
        // Iris tracks Pogo
        const look = Math.max(-1, Math.min(1, wrapAngle((player.col - en.col) * COL_ANGLE) * 2));
        const lookY = Math.max(-1, Math.min(1, (player.floor - en.floor) * 0.8));
        ud.iris.position.set(look * 0.07, lookY * 0.06, 0.16);
        ud.pupil.position.set(look * 0.09, lookY * 0.08, 0.23);
        const blink = (time * 0.6 + i * 0.37) % 3.2 > 3.05 ? 1 : 0;
        ud.lidTop.rotation.x = -Math.PI * 0.5 + blink * 0.6 - 0.35;
        ud.lidBot.rotation.x = Math.PI + Math.PI * 0.5 - blink * 0.6 + 0.35;
        const flap = Math.sin(time * 16 + i) * 0.6;
        ud.wings[0].rotation.y = flap;
        ud.wings[1].rotation.y = -flap;
        slot.mesh.rotation.y = eTheta;
      }

      // Off-screen warning for incoming flyers that are still around the curve of the tower
      if (en.spawned && Math.abs(eTheta) > Math.PI * 0.38 && Math.abs(eTheta) < Math.PI * 0.95) {
        const w = this._getWarnSprite(warnIdx++);
        const side = Math.sign(eTheta);
        const halfW = Math.tan(THREE.MathUtils.degToRad(this.towerCam.fov * 0.5)) * this.towerCam.aspect * (this.towerCam.position.z - 2.5);
        w.position.set(side * (halfW - 0.35), en.floor * FLOOR_HEIGHT + 0.3, 2.5);
        const pulse = 0.85 + Math.sin(time * 14) * 0.15;
        w.scale.set(0.62 * pulse, 0.62 * pulse, 1);
        w.material.opacity = 0.95;
        w.visible = true;
      }
    }
    for (let k = warnIdx; k < (this.warnPool || []).length; k++) this.warnPool[k].visible = false;

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
      m.scale.setScalar(1 + (sb.power || 0) * 1.6);
    }

    // Parallax stars & planet
    this.starPoints.rotation.y = -camCol * COL_ANGLE * 0.15;
    this.planetGroup.rotation.y = time * 0.12;

    // Particles & Popups
    this._syncParticles(this.particlePool, this.towerScene, particles, this.towerCam, TOWER_RADIUS + 0.6);
    this._syncPopups(state.popups || [], camCol, this.towerScene, this.towerCam, true);

    // World effects: clouds, birds, weather, props, guardian, ghost
    if (settings.ghosts !== false && state.ghostData) this.fx.ensureGhost(() => new PogoRig({ ghost: true }).group);
    this.fx.update(state, { time, camCol, cam: this.towerCam, focusY, tg, TOWER_RADIUS, FLOOR_HEIGHT, pal });

    // Tilt-shift focus follows Pogo's height on screen
    const pScreen = this._v3b.set(px, py + 0.4, pz).project(this.towerCam);
    const focus = Math.max(0.25, Math.min(0.75, pScreen.y * 0.5 + 0.5));
    this.postfx.monitor(this._realDt || 0.016);
    // Planar reflection pass (sky dome re-centred on the mirrored camera while it renders)
    this.ocean.reflectionEnabled = this.qualityTier !== 'low';
    if (this.ocean.reflectionEnabled) {
      const skyPos = this.skyDome.position.clone();
      this.skyDome.position.set(this.towerCam.position.x, -this.towerCam.position.y + 2 * seaY, this.towerCam.position.z);
      this.fx.setReflectionPass?.(true);
      this.ocean.updateReflection(this.towerScene, this.towerCam);
      this.fx.setReflectionPass?.(false);
      this.skyDome.position.copy(skyPos);
    }
    this._updateEnvironment(pal, mech, heal);
    this.postfx.render({ time, focus, flash: (state.mech?.lightning || 0) * 0.35, darkness: state.mech?.darkness || 0 });
  }

  _alertTex() {
    if (this._alertTexCache) return this._alertTexCache;
    const c = document.createElement('canvas');
    c.width = 64;
    c.height = 64;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#ef4444';
    ctx.beginPath();
    ctx.arc(32, 32, 28, 0, Math.PI * 2);
    ctx.fill();
    ctx.font = '900 44px Orbitron, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#fff';
    ctx.fillText('!', 32, 35);
    this._alertTexCache = new THREE.CanvasTexture(c);
    this._alertTexCache.colorSpace = THREE.SRGBColorSpace;
    return this._alertTexCache;
  }

  _getWarnSprite(idx) {
    if (!this.warnPool) this.warnPool = [];
    if (!this.warnTex) {
      const c = document.createElement('canvas');
      c.width = 128;
      c.height = 128;
      const ctx = c.getContext('2d');
      const g = ctx.createRadialGradient(64, 64, 10, 64, 64, 62);
      g.addColorStop(0, 'rgba(255,60,90,0.95)');
      g.addColorStop(0.65, 'rgba(255,40,80,0.55)');
      g.addColorStop(1, 'rgba(255,40,80,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(64, 64, 62, 0, Math.PI * 2);
      ctx.fill();
      ctx.font = '900 72px Orbitron, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#ffffff';
      ctx.fillText('!', 64, 68);
      this.warnTex = new THREE.CanvasTexture(c);
      this.warnTex.colorSpace = THREE.SRGBColorSpace;
    }
    while (this.warnPool.length <= idx) {
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.warnTex, transparent: true, depthTest: false }));
      sp.renderOrder = 20;
      this.towerScene.add(sp);
      this.warnPool.push(sp);
    }
    return this.warnPool[idx];
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
    this.subCam.updateMatrixWorld();

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
    // Fit the banner to the visible width so the progress bar never runs off-screen on narrow phones
    const visHalfW =
      Math.tan(THREE.MathUtils.degToRad(this.subCam.fov * 0.5)) * (this.subCam.position.z - 2) * this.subCam.aspect;
    const hudW = Math.min(6.2, visHalfW * 2 * 0.94);
    this.subHudSprite.scale.set(hudW, hudW * (0.78 / 6.2), 1);
    this._syncParticles(this.subParticlePool, this.subScene, particles, this.subCam, 0.5);
    this._syncPopups(state.popups || [], 0, this.subScene, this.subCam, false);

    this._renderWithComposer(this.subScene, this.subCam);
  }
}
