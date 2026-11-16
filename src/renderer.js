import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { TowerFx } from './towerFx.js';
import { createPropMaterials, buildTowerBody, buildDoor, buildLiftTrack, buildLiftPod, buildLedge, animateConveyorTextures } from './props.js';
import { PogoRig } from './pogo.js';
import { Ocean } from './water.js';
import { createTowerStoneMaterial, createLedgeStoneMaterial, setWaterlineY } from './materials.js';
import { PostFX } from './postfx.js';
import { settings, currentSkin } from './settings.js';
import { COLS } from './levels.js';
import { createEnemyModel, animateEnemy, warmEnemyModelsAsync } from './enemyModels.js';

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
      sunset: { value: 0 }, // 1 = the 1987 look: black starry sky over a banded sunset
      mountains: { value: 0 }, // 1 = ring of mountain silhouettes on the horizon
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
      uniform float sunset;
      uniform float mountains;
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
        col += mix(glowColor, vec3(0.85, 0.45, 1.0), n2) * neb * 0.13 * (1.0 - sunset * 0.85);
        // The 1987 sky: near-black above, a banded sunset (yellow > orange > red > dusk) at the
        // horizon, with faint copper-bar banding as a nod to the Amiga
        if (sunset > 0.0) {
          float hb = clamp(h, 0.0, 1.0);
          vec3 band = mix(vec3(1.0, 0.84, 0.32), vec3(1.0, 0.45, 0.06), smoothstep(0.0, 0.045, hb));
          band = mix(band, vec3(0.82, 0.07, 0.1), smoothstep(0.045, 0.1, hb));
          band = mix(band, vec3(0.22, 0.02, 0.1), smoothstep(0.1, 0.19, hb));
          band = mix(band, vec3(0.006, 0.007, 0.02), smoothstep(0.19, 0.36, hb));
          float bars = 1.0 - 0.07 * step(0.5, fract(hb * 64.0)) * (1.0 - smoothstep(0.02, 0.2, hb));
          col = mix(col, band * bars, sunset);
        }
        // Mountain silhouettes ringing the horizon (ridged noise), lighter at the peaks
        if (mountains > 0.0) {
          float a = ang * 2.2;
          float ridge = 1.0 - abs(2.0 * fbm(vec2(a * 2.4, 7.3)) - 1.0);
          float m = 0.006 + 0.07 * pow(ridge, 2.2) + 0.012 * noise(vec2(a * 18.0, 2.0));
          float inside = 1.0 - smoothstep(m - 0.003, m + 0.003, h);
          float peak = smoothstep(m - 0.035, m, h);
          vec3 mc = mix(vec3(0.03, 0.05, 0.14), vec3(0.24, 0.3, 0.55), peak * 0.8);
          col = mix(col, mc, inside * mountains * step(-0.03, h));
        }
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
    // Build every enemy model in idle frames up front, so a tower never hitches on first sight
    try {
      warmEnemyModelsAsync({ chromeEnv: this.chromeEnv, softDotTex: this.softDotTex });
    } catch (_) {}
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
    const key = `${pal.glow}|${pal.brickA}|${dark.toFixed(1)}|${Math.round((heal || 0) * 4)}|${this.skyMat.uniforms.sunset.value}`;
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
          if (o.isMesh && o.geometry && !o.geometry.userData.shared && !this._isSharedGeo(o.geometry)) o.geometry.dispose();
        });
        this.towerCache.delete(oldKey);
      }
    }

    const pal = tower.palette;
    const group = new THREE.Group();
    this._stoneMats = this._stoneMats || new Set();
    const mats = createPropMaterials(pal, this.chromeEnv);
    for (const m of mats.stoneList) this._stoneMats.add(m);

    // Tower body: instanced cut stones (style per tower), string courses, crown, plinth
    const body = buildTowerBody(tower, pal, mats, this.softDotTex, this.chromeEnv);
    group.add(body.group);
    for (const m of body.stoneMats) this._stoneMats.add(m);
    const updaters = [body.update];

    // Doors: carved archways with black-hole portals
    for (const door of tower.doors) {
      const d = buildDoor(door, pal, mats, this.softDotTex);
      group.add(d.group);
      updaters.push(d.update);
    }

    // Lifts: recessed track + hover platform
    const elevatorPods = [];
    for (const el of tower.elevators) {
      group.add(buildLiftTrack(el, pal, mats));
      const pod = buildLiftPod(el, pal, mats, this.softDotTex);
      pod.position.y = el.startFloor * FLOOR_HEIGHT;
      group.add(pod);
      elevatorPods.push(pod);
      updaters.push(pod.userData.update);
    }

    // Ledges
    const ledgeMeshes = [];
    for (const l of tower.ledges) {
      const node = buildLedge(l, pal, mats);
      group.add(node);
      ledgeMeshes.push(node);
    }

    const cached = {
      group,
      ledgeMeshes,
      elevatorPods,
      elevatorThrusters: [],
      doorMarkers: [],
      exitRings: [],
      conveyorRollers: [],
      cylMat: body.coreMat,
      updaters,
      styleName: body.styleName,
    };
    this.towerCache.set(cacheKey, cached);
    return cached;
  }

  // Enemies come from src/enemyModels.js (sculpted, outlined, rim-lit, with their own idle /
  // freeze / hit / death animation). The Original's robots use the chrome robot model.
  _createEnemyMesh(type) {
    const model = type === 'robot' ? 'chaser' : type;
    const g = createEnemyModel(model, { chromeEnv: this.chromeEnv, softDotTex: this.softDotTex });
    g.scale.setScalar(1.2); // read clearly at phone size
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
    // ORIGINAL mode: black starry sky, sunset band, mountains, clean blue sea (the 1987 look)
    const orig = Boolean(state.original);
    sky.sunset.value = orig ? 1 : 0;
    sky.mountains.value = orig ? 1 : 0;
    if (orig) {
      sky.topColor.value.set('#020309');
      this.towerScene.fog.color.set('#1c0a22');
    }
    this.planetGroup.visible = !orig;
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
    const heal = state.original ? 1 : Math.max(0, Math.min(1, state.healing || 0));
    const toxicShallow = this._c1 || (this._c1 = new THREE.Color('#3b5214'));
    const cleanShallow = this._c2 || (this._c2 = new THREE.Color('#0aa5b8'));
    const toxicDeep = this._c3 || (this._c3 = new THREE.Color('#1b0b2a'));
    const cleanDeep = this._c4 || (this._c4 = new THREE.Color('#012a40'));
    su.shallowColor.value.copy(toxicShallow).lerp(cleanShallow, heal).lerp(this._tempColor.set(pal.brickA), 0.15).multiplyScalar(0.75);
    su.deepColor.value.copy(toxicDeep).lerp(cleanDeep, heal);
    const seaY = mech.kind === 'flood' ? mech.waterFloor * FLOOR_HEIGHT : -0.62;
    // Ripples: splashes from the game, raindrops in storms, and the occasional lapping ring
    if (state.waterEvents && state.waterEvents.length) {
      for (const ev of state.waterEvents) {
        const th = wrapAngle((ev.col - camCol) * COL_ANGLE);
        const r = TOWER_RADIUS + 1.0;
        this.ocean.addRipple(Math.sin(th) * r, Math.cos(th) * r, ev.strength, time);
      }
      state.waterEvents.length = 0;
    }
    const raining = mech.kind === 'dark' || mech.kind === 'storm' || mech.kind === 'flood';
    this._rainT = (this._rainT || 0) - (this._realDt || 0.016);
    if (this._rainT <= 0) {
      this._rainT = raining ? 0.12 : 1.4;
      const a = (Math.random() - 0.5) * 1.6;
      const r = TOWER_RADIUS + 1.2 + Math.random() * 6;
      this.ocean.addRipple(Math.sin(a) * r, Math.cos(a) * r, raining ? 0.35 : 0.5, time);
    }
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

    // Animated props: conveyor treads, portals, lift thrusters, crown brazier
    animateConveyorTextures(time);
    for (const fn of cached.updaters) fn(time);

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

      if (l.type === 'crumble') {
        // fissures flare and the stones shudder when it's about to give way
        mesh.position.y = mesh.userData.baseY + (l.shake ? Math.sin(time * 55) * 0.05 : 0);
        mesh.position.x = l.shake ? Math.sin(time * 47) * 0.02 : 0;
        if (!mesh.userData.ownMat && l.crumbling) {
          const m = mesh.children[0].material.clone();
          mesh.traverse((o) => {
            if (o.isMesh && o.material === mesh.children[0].material) o.material = m;
          });
          mesh.userData.ownMat = m;
        }
        if (mesh.userData.ownMat) mesh.userData.ownMat.emissiveIntensity = l.crumbling ? 2 + Math.sin(time * 30) * 1 : 0.9;
      } else if (l.type === 'box' && mesh.userData.mainMat) {
        mesh.userData.mainMat.emissiveIntensity = 1.1 + Math.sin(time * 6) * 0.5;
      }
    }

    // Update elevator pods, thruster cones & holographic door/exit beacons
    for (let i = 0; i < state.elevators.length; i++) {
      const el = state.elevators[i];
      const pod = cached.elevatorPods[i];
      if (pod) pod.position.y = el.floor * FLOOR_HEIGHT;
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
      this.pogoGroup.scale.setScalar(1.1); // the plumper body is wider: keep him about one ledge wide, like the original

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
        slot.groundOffset = undefined;
        this.towerScene.add(slot.mesh);
      }
      slot.mesh.visible = true;
      const eTheta = wrapAngle((en.col - camCol) * COL_ANGLE);
      const er = TOWER_RADIUS + 0.4;
      // Ground enemies sit exactly on the ledge surface (measured from the model's own bounds)
      if (slot.groundOffset === undefined) slot.groundOffset = this._enemyGroundOffset(slot.mesh, en.type);
      slot.mesh.position.set(er * Math.sin(eTheta), en.floor * FLOOR_HEIGHT + slot.groundOffset, er * Math.cos(eTheta));
      const animEn = en.type === 'robot' ? { ...en, type: 'chaser', alert: 0 } : en;
      animateEnemy(slot.mesh, animEn, { time, dt: this._realDt || 1 / 60, eTheta, player: { col: player.col, floor: player.floor }, camCol, COLS });

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

  // Distance from an enemy model's origin down to its lowest point (after the group scale),
  // so walkers/rollers/bouncers touch the ledge instead of sinking into it. Flyers keep a hover.
  _enemyGroundOffset(mesh, type) {
    const ground = ['roller', 'bouncer', 'chaser', 'robot', 'shieldbug', 'puffer', 'splitter'];
    if (!ground.includes(type)) return 0.28;
    const body = mesh.userData.body || mesh;
    const box = new THREE.Box3();
    mesh.updateMatrixWorld(true);
    const inv = new THREE.Matrix4().copy(mesh.matrixWorld).invert();
    const tmp = new THREE.Box3();
    body.traverse((o) => {
      if (!o.isMesh || o.userData.outline) return;
      if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
      tmp.copy(o.geometry.boundingBox).applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld));
      box.union(tmp);
    });
    if (box.isEmpty()) return 0.28;
    return -box.min.y * mesh.scale.y + 0.005;
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
