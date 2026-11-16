import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
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

function createBrickTextures(pal, seed = 1) {
  const size = 512;
  const rand = mulberry32(seed * 9973 + 17);
  const mk = () => {
    const c = document.createElement('canvas');
    c.width = size;
    c.height = size;
    return [c, c.getContext('2d')];
  };
  const [colCanvas, ctx] = mk();
  const [bumpCanvas, bCtx] = mk();
  const [roughCanvas, rCtx] = mk();
  const [emCanvas, eCtx] = mk();

  // Recessed mortar with soft grime
  ctx.fillStyle = pal.mortar;
  ctx.fillRect(0, 0, size, size);
  bCtx.fillStyle = '#202020';
  bCtx.fillRect(0, 0, size, size);
  rCtx.fillStyle = '#f0f0f0';
  rCtx.fillRect(0, 0, size, size);
  eCtx.fillStyle = '#000000';
  eCtx.fillRect(0, 0, size, size);

  const cols = 24;
  const rows = 12;
  const bw = size / cols;
  const bh = size / rows;
  const gap = 3;

  for (let r = 0; r < rows; r++) {
    const offset = (r % 2) * (bw * 0.5);
    for (let c = -1; c <= cols; c++) {
      const x = c * bw + offset + gap * 0.5;
      const y = r * bh + gap * 0.5;
      const w = bw - gap;
      const h = bh - gap;

      // Per-brick tone variation so the wall doesn't read as a flat checkerboard
      const base = rand() < 0.5 ? pal.brickA : pal.brickB;
      const tone = shadeHex(base, (rand() - 0.5) * 0.36);
      const grad = ctx.createLinearGradient(x, y, x, y + h);
      grad.addColorStop(0, shadeHex(tone, 0.22));
      grad.addColorStop(0.55, tone);
      grad.addColorStop(1, shadeHex(tone, -0.28));
      ctx.fillStyle = grad;
      ctx.fillRect(x, y, w, h);

      // Bevel highlights / shadows
      ctx.fillStyle = 'rgba(255,255,255,0.22)';
      ctx.fillRect(x, y, w, 2);
      ctx.fillRect(x, y, 2, h);
      ctx.fillStyle = 'rgba(0,0,0,0.38)';
      ctx.fillRect(x, y + h - 2.5, w, 2.5);
      ctx.fillRect(x + w - 2, y, 2, h);

      // Speckle / weathering
      for (let k = 0; k < 10; k++) {
        const sx = x + rand() * w;
        const sy = y + rand() * h;
        ctx.fillStyle = rand() < 0.5 ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.12)';
        ctx.fillRect(sx, sy, 1 + rand() * 3, 1 + rand() * 2);
      }
      // Occasional chipped corner
      if (rand() < 0.18) {
        ctx.fillStyle = pal.mortar;
        const cs = 3 + rand() * 5;
        const cx = rand() < 0.5 ? x : x + w - cs;
        const cy = rand() < 0.5 ? y : y + h - cs;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx + cs, cy);
        ctx.lineTo(cx, cy + cs);
        ctx.fill();
      }

      // Bump: domed brick face
      const bg = bCtx.createLinearGradient(x, y, x, y + h);
      bg.addColorStop(0, '#ffffff');
      bg.addColorStop(0.25, '#e6e6e6');
      bg.addColorStop(1, '#a8a8a8');
      bCtx.fillStyle = bg;
      bCtx.fillRect(x, y, w, h);

      const rv = Math.floor(110 + rand() * 60);
      rCtx.fillStyle = `rgb(${rv},${rv},${rv})`;
      rCtx.fillRect(x, y, w, h);

      // Sparse glowing rune seams
      if (rand() < 0.07) {
        eCtx.fillStyle = pal.glow;
        eCtx.fillRect(x + w * 0.2, y + h * 0.46, w * 0.6, 2);
      }
    }
  }

  // Vertical grime streaks
  for (let i = 0; i < 26; i++) {
    const x = rand() * size;
    const g = ctx.createLinearGradient(0, 0, 0, size);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(rand(), 'rgba(0,0,0,0.16)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(x, 0, 2 + rand() * 7, size);
  }

  const wrap = (canvas, srgb = false) => {
    const t = new THREE.CanvasTexture(canvas);
    t.wrapS = THREE.RepeatWrapping;
    t.wrapT = THREE.RepeatWrapping;
    t.anisotropy = 4;
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    return t;
  };

  return {
    map: wrap(colCanvas, true),
    bumpMap: wrap(bumpCanvas),
    roughnessMap: wrap(roughCanvas),
    emissiveMap: wrap(emCanvas, true),
  };
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
        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  });
}

function createSeaMaterial() {
  const uniforms = THREE.UniformsUtils.merge([
    THREE.UniformsLib.fog,
    {
      time: { value: 0 },
      deepColor: { value: new THREE.Color('#010b16') },
      shallowColor: { value: new THREE.Color('#0b4f6c') },
      skyColor: { value: new THREE.Color('#0b1d3d') },
      glowColor: { value: new THREE.Color('#38bdf8') },
      sunDir: { value: new THREE.Vector3(0.45, 0.6, 0.66).normalize() },
      towerRadius: { value: TOWER_RADIUS },
    },
  ]);
  return new THREE.ShaderMaterial({
    uniforms,
    fog: true,
    vertexShader: /* glsl */ `
      uniform float time;
      varying vec3 vWorld;
      varying vec3 vNormal;
      varying float vHeight;
      #include <fog_pars_vertex>

      // Sum of directional waves; returns height and analytic slope
      vec3 waves(vec2 p) {
        float h = 0.0; float dx = 0.0; float dz = 0.0;
        vec2 dirs[4];
        dirs[0] = normalize(vec2(1.0, 0.35));
        dirs[1] = normalize(vec2(-0.6, 1.0));
        dirs[2] = normalize(vec2(0.25, -1.0));
        dirs[3] = normalize(vec2(-1.0, -0.4));
        float amps[4]; amps[0] = 0.12; amps[1] = 0.07; amps[2] = 0.045; amps[3] = 0.03;
        float freqs[4]; freqs[0] = 0.55; freqs[1] = 0.9; freqs[2] = 1.6; freqs[3] = 2.4;
        float speeds[4]; speeds[0] = 1.6; speeds[1] = 2.1; speeds[2] = 2.9; speeds[3] = 3.6;
        for (int i = 0; i < 4; i++) {
          float ph = dot(dirs[i], p) * freqs[i] + time * speeds[i];
          h += sin(ph) * amps[i];
          float c = cos(ph) * amps[i] * freqs[i];
          dx += c * dirs[i].x;
          dz += c * dirs[i].y;
        }
        return vec3(h, dx, dz);
      }

      void main() {
        vec4 wp = modelMatrix * vec4(position, 1.0);
        // Calm the swell right next to the tower base and far away (cheaper on the eye)
        float r = length(wp.xz);
        float calm = smoothstep(2.4, 4.0, r);
        vec3 w = waves(wp.xz) * calm;
        wp.y += w.x;
        vHeight = w.x;
        vNormal = normalize(vec3(-w.y, 1.0, -w.z));
        vWorld = wp.xyz;
        vec4 mvPosition = viewMatrix * wp;
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float time;
      uniform vec3 deepColor;
      uniform vec3 shallowColor;
      uniform vec3 skyColor;
      uniform vec3 glowColor;
      uniform vec3 sunDir;
      uniform float towerRadius;
      varying vec3 vWorld;
      varying vec3 vNormal;
      varying float vHeight;
      #include <fog_pars_fragment>

      float hash(vec2 p) { return fract(sin(dot(p, vec2(41.3, 289.1))) * 15731.743); }
      float noise(vec2 p) {
        vec2 i = floor(p); vec2 f = fract(p);
        vec2 u = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
                   mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
      }

      void main() {
        vec3 n = normalize(vNormal);
        vec3 v = normalize(cameraPosition - vWorld);
        float fres = pow(1.0 - max(dot(n, v), 0.0), 3.0);
        vec3 col = mix(deepColor, shallowColor, clamp(vHeight * 3.0 + 0.45, 0.0, 1.0));
        col = mix(col, skyColor * 0.9 + glowColor * 0.06, fres * 0.6);
        // Sun glint
        vec3 hv = normalize(sunDir + v);
        float spec = pow(max(dot(n, hv), 0.0), 160.0);
        col += vec3(0.9, 0.97, 1.0) * spec * 0.55;
        // Foam collar around the tower base + wave crests
        float r = length(vWorld.xz);
        float ang = atan(vWorld.x, vWorld.z);
        float fn = noise(vec2(ang * 9.0, r * 3.0 - time * 1.4));
        float collar = smoothstep(towerRadius + 0.75, towerRadius + 0.3, r + fn * 0.3);
        float ripple = smoothstep(0.9, 0.99, sin(r * 6.0 - time * 2.6) * 0.5 + 0.5)
          * smoothstep(towerRadius + 1.8, towerRadius + 0.5, r) * fn;
        float crest = smoothstep(0.15, 0.22, vHeight) * smoothstep(0.55, 0.9, noise(vWorld.xz * 2.5 + time * 0.3));
        float foam = clamp(collar * 0.9 + ripple * 0.35 + crest * 0.35, 0.0, 1.0);
        col = mix(col, vec3(0.75, 0.92, 1.0), foam * 0.6);
        col += glowColor * 0.025;
        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        #include <fog_fragment>
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
  }

  _renderWithComposer(scene, camera) {
    this.webgl.render(scene, camera);
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
    const hemi = new THREE.HemisphereLight('#38bdf8', '#020617', 0.6);
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
    this.towerScene.add(fillLight);

    const rimLight = new THREE.DirectionalLight('#38bdf8', 0.75);
    rimLight.position.set(-9, 6, -6);
    this.rimLight = rimLight;
    this.towerScene.add(rimLight);

    this.heroLight = new THREE.PointLight('#38bdf8', 0.65, 6);
    this.towerScene.add(this.heroLight);

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

    // GPU-animated ocean: waves, fresnel sky reflection, sun glints and a foam collar at the tower base.
    // Large enough that its edge always disappears into the fog/horizon.
    const seaGeo = new THREE.PlaneGeometry(140, 140, 180, 180);
    seaGeo.rotateX(-Math.PI / 2);
    this.seaMat = createSeaMaterial();
    this.seaMesh = new THREE.Mesh(seaGeo, this.seaMat);
    this.seaMesh.position.set(0, -0.62, 0);
    this.towerScene.add(this.seaMesh);

    // Tower cache & dynamic pools
    this.towerCache = new Map();
    this.currentTowerGroup = null;
    this.conveyorTexR = createConveyorTexture(1);
    this.conveyorTexL = createConveyorTexture(-1);

    this.pogoGroup = this._buildPogoMesh();
    this.pogoGroup.traverse((o) => {
      if (o.isMesh) o.castShadow = true;
    });
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
    const tex = createBrickTextures(pal, tower.id);
    tex.map.repeat.set(1, tower.floors / 4);
    tex.bumpMap.repeat.set(1, tower.floors / 4);
    tex.roughnessMap.repeat.set(1, tower.floors / 4);
    tex.emissiveMap.repeat.set(1, tower.floors / 4);

    const cylMat = new THREE.MeshStandardMaterial({
      map: tex.map,
      bumpMap: tex.bumpMap,
      bumpScale: 1.6,
      roughnessMap: tex.roughnessMap,
      emissive: pal.glow,
      emissiveMap: tex.emissiveMap,
      emissiveIntensity: 0.35,
      roughness: 0.78,
      metalness: 0.08,
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

    const solidMat = new THREE.MeshStandardMaterial({
      color: pal.ledge,
      emissive: pal.glow,
      emissiveIntensity: 0.06,
      roughness: 0.5,
      metalness: 0.25,
    });
    const solidTopMat = new THREE.MeshStandardMaterial({
      color: pal.ledgeTop,
      emissive: pal.glow,
      emissiveIntensity: 0.55,
      roughness: 0.3,
    });
    const bracketMat = new THREE.MeshStandardMaterial({
      color: shadeHex(pal.mortar, 0.9),
      metalness: 0.4,
      roughness: 0.6,
    });
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
        const cMat = new THREE.MeshStandardMaterial({
          color: '#f59e0b',
          emissive: '#b45309',
          emissiveIntensity: 0.35,
          roughness: 0.75,
        });
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
      new THREE.MeshStandardMaterial({ color: shadeHex(pal.mortar, 1.2), roughness: 0.85, metalness: 0.1 })
    );
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
    this.towerCache.set(tower.id, cached);
    return cached;
  }

  _createEnemyMesh(type) {
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
    const shell = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.4, 0),
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
    const focusY = camFloor * FLOOR_HEIGHT;
    const shake = getShakeOffset(state.shake, time);

    this.towerCam.position.set(shake.x, focusY + 1.15 + shake.y, camZ);
    this.towerCam.lookAt(shake.x, focusY - 0.35 + shake.y, 0);
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
    this.rimLight.color.set(pal.glow);
    this.planetMesh.material.color.set(pal.ledge);
    this.planetMesh.material.emissive.set(pal.glow);
    const su = this.seaMat.uniforms;
    su.time.value = time;
    su.skyColor.value.copy(this.towerScene.fog.color);
    su.glowColor.value.set(pal.glow);
    su.shallowColor.value.set(pal.brickA).lerp(this._tempColor.set('#0b4f6c'), 0.65).multiplyScalar(0.8);
    su.deepColor.value.set(pal.mortar).lerp(this._tempColor.set('#010810'), 0.6);

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
    // Flicker while invulnerable after a hit / respawn
    const blinkOff = player.invuln > 0 && player.invuln < 1.6 && Math.floor(time * 18) % 3 === 0;
    this.pogoGroup.visible = pogoVisible && !blinkOff;
    this.landingRingGroup.visible = pogoVisible;
    if (pogoVisible) {
      const moving = player.onGround && Math.abs(player.vx) > 0.2;
      const bob = moving ? Math.abs(Math.sin(time * 18)) * 0.08 : 0;
      const stride = moving ? Math.sin(time * 18) * 0.14 : 0;

      this.pogoGroup.position.set(px, py + bob, pz);
      // Angle Pogo 3/4 toward the camera (+Z) so both big eyes, belly & blaster are clearly visible!
      const faceYaw = player.facing < 0 ? Math.PI - 0.42 : 0.42;
      this.pogoGroup.rotation.y = pTheta + faceYaw;
      // Arms-out wobble when the edge guard stops you at a drop into the sea
      const teeter = Math.min(1, (player.teeter || 0) / 0.25);
      this.pogoGroup.rotation.z = teeter > 0 ? -Math.sin(time * 26) * 0.16 * teeter : 0;
      if (player.stunTimer > 0) {
        // Knocked silly: tumble as he drops to the ledge below
        this.pogoGroup.rotation.z = Math.sin(time * 30) * 0.35;
        this.pogoGroup.rotation.y += time * 14;
      }
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
        ud.shell.rotation.set(0.3, time * 0.4, crack * 4);
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
    }

    // Parallax stars & planet
    this.starPoints.rotation.y = -camCol * COL_ANGLE * 0.15;
    this.planetGroup.rotation.y = time * 0.12;

    // Particles & Popups
    this._syncParticles(this.particlePool, this.towerScene, particles, this.towerCam, TOWER_RADIUS + 0.6);
    this._syncPopups(state.popups || [], camCol, this.towerScene, this.towerCam, true);

    this._renderWithComposer(this.towerScene, this.towerCam);
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
