// Enemy character models for Tower Toppler '26 — built to the same "designer vinyl toy" bar as Pogo:
// sculpted single-surface bodies (SDF + Surface Nets with baked occlusion and vertex paint),
// painted eyeballs with catchlights, lids and brows, inverted-hull cartoon outlines, a warm rim
// light, and per-instance hit-flash / freeze tints. Every enemy also gets a faceted ice block that
// doubles as a platform while it is frozen.
//
// API
//   createEnemyModel(type, { chromeEnv, softDotTex }) -> THREE.Group (origin = enemy centre, face = +Z)
//   animateEnemy(group, en, ctx)          ctx = { time, dt, eTheta, player: {col, floor}, camCol, COLS }
//   createGuardianModel({ chromeEnv, softDotTex }) -> THREE.Group (~1.6 units across)
//   animateGuardian(group, boss, ctx)     ctx = { time, dt, player: {col, floor}, COLS }
//   warmEnemyModels()                     optional: pre-build every cached geometry/texture (loading screen)
//
// Geometry, textures and shared materials are built once per type and reused by every instance.
// Local units: the renderer scales an enemy group by 1.2 and puts its origin 0.28 above the floor,
// so a walker's ledge is at local y = GROUND and a frozen block's top must sit at ICE_TOP.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { ConvexGeometry } from 'three/addons/geometries/ConvexGeometry.js';
import { meshSDF, sdSphere, sdEllipsoid, sdCapsule, smin, ssub, traceSurface } from './sculpt.js';

const TWO_PI = Math.PI * 2;
const GROUND = -0.233; // (floor - (floor + 0.28)) / 1.2
const ICE_TOP = 0.367; // game ICE_TOP 0.72 floors above the floor -> (0.72 - 0.28) / 1.2
const ICE_BOTTOM = -0.245;
const RING_R = 2.95; // radius the renderer places enemies at (TOWER_RADIUS + 0.4)
const GROUP_SCALE = 1.2;

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const smooth = (e0, e1, x) => {
  const t = clamp((x - e0) / (e1 - e0), 0, 1);
  return t * t * (3 - 2 * t);
};
const mix = (a, b, t) => a + (b - a) * t;
const damp = (a, b, k, dt) => a + (b - a) * (1 - Math.exp(-k * dt));
function colDist(a, b, cols) {
  const w = (c) => ((c % cols) + cols) % cols;
  let d = w(b) - w(a);
  if (d > cols / 2) d -= cols;
  if (d < -cols / 2) d += cols;
  return d;
}
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const C = (hex) => new THREE.Color(hex);

// ------------------------------------------------------------------------------------------------
// Extra SDF primitives
// ------------------------------------------------------------------------------------------------
function sdRoundCone(x, y, z, ax, ay, az, bx, by, bz, ra, rb) {
  const pax = x - ax;
  const pay = y - ay;
  const paz = z - az;
  const bax = bx - ax;
  const bay = by - ay;
  const baz = bz - az;
  const h = clamp((pax * bax + pay * bay + paz * baz) / (bax * bax + bay * bay + baz * baz), 0, 1);
  return Math.hypot(pax - bax * h, pay - bay * h, paz - baz * h) - (ra + (rb - ra) * h);
}
// capped cylinder along an axis ('x' | 'y' | 'z'), centred at c, radius r, half length h, edge round e
function sdCyl(x, y, z, axis, cx, cy, cz, r, h, e = 0) {
  const px = x - cx;
  const py = y - cy;
  const pz = z - cz;
  let a;
  let rad;
  if (axis === 'x') {
    a = px;
    rad = Math.hypot(py, pz);
  } else if (axis === 'y') {
    a = py;
    rad = Math.hypot(px, pz);
  } else {
    a = pz;
    rad = Math.hypot(px, py);
  }
  const dx = rad - (r - e);
  const dy = Math.abs(a) - (h - e);
  return Math.min(Math.max(dx, dy), 0) + Math.hypot(Math.max(dx, 0), Math.max(dy, 0)) - e;
}
const smax = (a, b, k) => -smin(-a, -b, k);

// Fibonacci-sphere directions
function fibDirs(n, seed = 0) {
  const out = [];
  const ga = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < n; i++) {
    const y = 1 - ((i + 0.5) / n) * 2;
    const r = Math.sqrt(1 - y * y);
    const a = i * ga + seed;
    out.push([Math.cos(a) * r, y, Math.sin(a) * r]);
  }
  return out;
}

// ------------------------------------------------------------------------------------------------
// Caches
// ------------------------------------------------------------------------------------------------
const CACHE = new Map();
function cached(key, fn) {
  let v = CACHE.get(key);
  if (v === undefined) {
    v = fn();
    CACHE.set(key, v);
  }
  return v;
}

// Mesh an SDF and paint it. paintFn(x, y, z, out) writes a linear colour into `out` and returns a
// metal mask (0 = painted/enamel, 1 = bare metal) that metal-masked materials read from vertex alpha.
function sculpt(key, sdf, min, max, cell, paintFn, { aoScale = 1, aoMin = 0.55, hullCell = cell * 2 } = {}) {
  return cached('sculpt:' + key, () => {
    const { geo, ao } = meshSDF(sdf, min, max, cell, { aoScale });
    // a coarse copy of the surface for the cartoon outline hull (silhouette only)
    if (hullCell) geo.userData.hull = meshSDF(sdf, min, max, hullCell, { project: 2, aoScale: 0.1 }).geo;
    const pos = geo.attributes.position.array;
    const n = pos.length / 3;
    const col = new Float32Array(n * 4);
    const c = new THREE.Color();
    for (let i = 0; i < n; i++) {
      c.setRGB(1, 1, 1);
      const m = paintFn(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2], c, i) ?? 0;
      const k = Math.max(aoMin, ao[i]);
      col[i * 4] = c.r * k;
      col[i * 4 + 1] = c.g * k;
      col[i * 4 + 2] = c.b * k;
      col[i * 4 + 3] = m;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(col, 4));
    geo.userData.ao = ao;
    return geo;
  });
}

// ------------------------------------------------------------------------------------------------
// Canvas textures
// ------------------------------------------------------------------------------------------------
function canvasTex(w, h, draw, { srgb = true, repeat = false } = {}) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

function softDot() {
  return cached('tex:softdot', () =>
    canvasTex(64, 64, (ctx) => {
      const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
      g.addColorStop(0, 'rgba(255,255,255,1)');
      g.addColorStop(0.28, 'rgba(255,255,255,0.85)');
      g.addColorStop(0.6, 'rgba(255,255,255,0.25)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 64, 64);
    })
  );
}

function ringTex() {
  return cached('tex:ring', () =>
    canvasTex(128, 128, (ctx) => {
      const g = ctx.createRadialGradient(64, 64, 30, 64, 64, 62);
      g.addColorStop(0, 'rgba(255,255,255,0)');
      g.addColorStop(0.55, 'rgba(255,255,255,0.15)');
      g.addColorStop(0.82, 'rgba(255,255,255,1)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 128, 128);
      // little star-burst ticks
      ctx.strokeStyle = 'rgba(255,255,255,0.9)';
      ctx.lineCap = 'round';
      ctx.lineWidth = 5;
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * TWO_PI + 0.2;
        ctx.beginPath();
        ctx.moveTo(64 + Math.cos(a) * 34, 64 + Math.sin(a) * 34);
        ctx.lineTo(64 + Math.cos(a) * 46, 64 + Math.sin(a) * 46);
        ctx.stroke();
      }
    })
  );
}

function exclaimTex() {
  return cached('tex:exclaim', () =>
    canvasTex(128, 128, (ctx) => {
      ctx.fillStyle = '#0b1226';
      ctx.beginPath();
      ctx.arc(64, 64, 58, 0, TWO_PI);
      ctx.fill();
      ctx.fillStyle = '#ef4444';
      ctx.beginPath();
      ctx.arc(64, 64, 50, 0, TWO_PI);
      ctx.fill();
      ctx.fillStyle = '#fff7ed';
      ctx.beginPath();
      ctx.roundRect(54, 22, 20, 56, 9);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(64, 96, 11, 0, TWO_PI);
      ctx.fill();
    })
  );
}

// Equirectangular eyeball paint (iris at u = v = 0.5; the eyeball geometry is turned so that
// this point faces +Z, and the ball rotates to look around).
//  o: { key, sclera: [c0, c1, c2], iris: [[stop, colour]...], irisR, fibre, limbal, limbalW,
//       pupil: 'round' | 'slit', pupilR, pupilW, pupilH, veins, veinColor, ring, glow }
function eyeTexture(o) {
  return cached('tex:eye:' + o.key, () => {
    const W = 512;
    const H = 256;
    const cx = W / 2;
    const cy = H / 2;
    const R = o.irisR || 54;
    const paint = (ctx, glowOnly) => {
      if (glowOnly) {
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, W, H);
      } else {
        const g = ctx.createRadialGradient(cx, cy, 8, cx, cy, W * 0.5);
        g.addColorStop(0, o.sclera[0]);
        g.addColorStop(0.42, o.sclera[1]);
        g.addColorStop(1, o.sclera[2]);
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, W, H);
        if (o.veins) {
          const rand = rng(o.veins * 977 + R);
          ctx.lineCap = 'round';
          const vein = (x, y, ang, len, w, depth) => {
            ctx.strokeStyle = o.veinColor || 'rgba(220,38,38,0.75)';
            let px = x;
            let py = y;
            for (let s = 0; s < len; s++) {
              const dx = cx - px;
              const dy = cy - py;
              const d = Math.hypot(dx, dy);
              if (d < R + 5) break;
              ang += (Math.atan2(dy, dx) - ang) * 0.12 + (rand() - 0.5) * 0.7;
              const nx = px + Math.cos(ang) * 6;
              const ny = py + Math.sin(ang) * 6;
              ctx.lineWidth = Math.max(0.6, w * (1 - s / len));
              ctx.beginPath();
              ctx.moveTo(px, py);
              ctx.lineTo(nx, ny);
              ctx.stroke();
              px = nx;
              py = ny;
              if (depth < 2 && rand() < 0.12) vein(px, py, ang + (rand() - 0.5) * 1.6, len * 0.45, w * 0.6, depth + 1);
            }
          };
          for (let i = 0; i < o.veins; i++) {
            const a = (i / o.veins) * TWO_PI + rand() * 0.4;
            const dist = R + 70 + rand() * 90;
            vein(cx + Math.cos(a) * dist * 1.25, cy + Math.sin(a) * dist * 0.7, a + Math.PI, 26, 3.2, 0);
          }
        }
      }
      // iris
      const ig = ctx.createRadialGradient(cx, cy - R * 0.12, R * 0.05, cx, cy, R);
      for (const [s, col] of o.iris) ig.addColorStop(s, col);
      ctx.fillStyle = ig;
      ctx.beginPath();
      ctx.ellipse(cx, cy, R, R * 1.02, 0, 0, TWO_PI);
      ctx.fill();
      if (o.fibre) {
        ctx.strokeStyle = o.fibre;
        ctx.lineWidth = 2;
        for (let a = 0; a < TWO_PI; a += Math.PI / 20) {
          ctx.beginPath();
          ctx.moveTo(cx + Math.cos(a) * R * 0.36, cy + Math.sin(a) * R * 0.36);
          ctx.lineTo(cx + Math.cos(a + 0.05) * R * 0.9, cy + Math.sin(a + 0.05) * R * 0.9);
          ctx.stroke();
        }
      }
      if (o.ring) {
        ctx.strokeStyle = o.ring;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(cx, cy, R * 0.62, 0, TWO_PI);
        ctx.stroke();
      }
      ctx.lineWidth = o.limbalW || 6;
      ctx.strokeStyle = glowOnly ? '#000' : o.limbal || '#1a0a05';
      ctx.beginPath();
      ctx.ellipse(cx, cy, R - 2, R * 1.02 - 2, 0, 0, TWO_PI);
      ctx.stroke();
      ctx.fillStyle = '#04050a';
      ctx.beginPath();
      if (o.pupil === 'slit') ctx.ellipse(cx, cy, o.pupilW || 9, o.pupilH || R * 0.85, 0, 0, TWO_PI);
      else ctx.ellipse(cx, cy, o.pupilR || 22, (o.pupilR || 22) * 1.05, 0, 0, TWO_PI);
      ctx.fill();
    };
    const t = canvasTex(W, H, (ctx) => paint(ctx, false));
    if (o.glow) t.userData.glow = canvasTex(W, H, (ctx) => paint(ctx, true));
    return t;
  });
}

// ------------------------------------------------------------------------------------------------
// Material hooks: warm rim light, hit flash, freeze tint, and an optional metal mask from vertex
// alpha (so one sculpted mesh can mix bare chrome with enamel paint).
// ------------------------------------------------------------------------------------------------
function fxHook(mat, { rim = '#ffd9a8', rimStrength = 0.32, metalMask = false, paintRough = 0.38 } = {}) {
  const u = {
    uFlash: { value: 0 },
    uFreeze: { value: 0 },
    uRim: { value: C(rim) },
    uRimStr: { value: rimStrength },
  };
  mat.userData.fx = u;
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, u);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uFlash;\nuniform float uFreeze;\nuniform vec3 uRim;\nuniform float uRimStr;')
      .replace(
        '#include <opaque_fragment>',
        `float fxRim = pow(1.0 - clamp(dot(normal, normalize(vViewPosition)), 0.0, 1.0), 3.0);
        outgoingLight += uRim * fxRim * uRimStr;
        vec3 fxIcy = outgoingLight * vec3(0.5, 0.78, 1.1) + vec3(0.03, 0.1, 0.18) + vec3(0.3, 0.65, 0.9) * fxRim * 0.5;
        outgoingLight = mix(outgoingLight, fxIcy, uFreeze);
        outgoingLight = mix(outgoingLight, vec3(1.0, 0.96, 0.9) * 1.1, uFlash);
        #include <opaque_fragment>`
      );
    if (metalMask) {
      sh.fragmentShader = sh.fragmentShader.replace(
        '#include <metalnessmap_fragment>',
        `#include <metalnessmap_fragment>
        #ifdef USE_COLOR_ALPHA
          metalnessFactor *= vColor.a;
          roughnessFactor = mix(${paintRough.toFixed(3)}, roughnessFactor, vColor.a);
        #endif`
      );
    }
  };
  mat.customProgramCacheKey = () => 'enm-fx-' + (metalMask ? 'm' + paintRough.toFixed(3) : 'n');
  return mat;
}

// Inverted-hull cartoon outline (pushes the back faces out along the vertex normal)
const OUTLINES = new Map();
function outlineMat(th) {
  let m = OUTLINES.get(th);
  if (!m) {
    m = new THREE.MeshBasicMaterial({ color: '#0b1226', side: THREE.BackSide });
    m.onBeforeCompile = (sh) => {
      sh.vertexShader = sh.vertexShader.replace('#include <project_vertex>', `transformed += normalize(normal) * ${th.toFixed(4)};\n#include <project_vertex>`);
    };
    m.customProgramCacheKey = () => 'enm-outline-' + th.toFixed(4);
    OUTLINES.set(th, m);
  }
  return m;
}
function addOutline(mesh, th = 0.013) {
  const o = new THREE.Mesh(mesh.geometry.userData.hull || mesh.geometry, outlineMat(th));
  o.castShadow = false;
  o.userData.outline = true;
  mesh.add(o);
  return o;
}

// ------------------------------------------------------------------------------------------------
// Eyes: textured eyeball (+Z front), upper/lower lids on pivots, shared catchlights
// ------------------------------------------------------------------------------------------------
function eyeballGeo(r) {
  return cached('geo:eyeball:' + r, () => {
    const g = new THREE.SphereGeometry(r, r > 0.1 ? 32 : 24, r > 0.1 ? 22 : 16);
    g.rotateY(-Math.PI / 2);
    return g;
  });
}
function lidGeo(r, lower = false) {
  return cached('geo:lid:' + r + (lower ? 'L' : 'U'), () => {
    const g = new THREE.SphereGeometry(r, r > 0.1 ? 28 : 20, 8, 0, TWO_PI, lower ? Math.PI / 2 : 0, Math.PI / 2);
    return g;
  });
}
function eyeMaterial(tex, glowColor = null, glowI = 0) {
  const m = new THREE.MeshPhysicalMaterial({ map: tex, roughness: 0.12, clearcoat: 1, clearcoatRoughness: 0.04 });
  if (glowColor && tex.userData.glow) {
    m.emissive = C(glowColor);
    m.emissiveMap = tex.userData.glow;
    m.emissiveIntensity = glowI;
  }
  return fxHook(m, { rimStrength: 0.15 });
}
const GLINT_MAT = new THREE.MeshBasicMaterial({ color: '#ffffff' });
// merged catchlights for a set of eyes: list of [x, y, z, r]
function glintGeo(key, list) {
  return cached('geo:glint:' + key, () => {
    const parts = list.map(([x, y, z, r]) => {
      const s = new THREE.SphereGeometry(r, 10, 8);
      s.translate(x, y, z);
      return s;
    });
    return mergeGeometries(parts);
  });
}
// An eye: { eg, ball, up (pivot), lo (pivot), slant (pivot), side }
function makeEye(parent, { x, y, z, r, mat, lidMat, lower = false, lidR = 1.08, lash = null }) {
  const eg = new THREE.Group();
  eg.position.set(x, y, z);
  parent.add(eg);
  const ball = new THREE.Mesh(eyeballGeo(r), mat);
  eg.add(ball);
  const slant = new THREE.Group();
  eg.add(slant);
  const up = new THREE.Group();
  slant.add(up);
  const upLid = new THREE.Mesh(lidGeo(+(r * lidR).toFixed(4)), lidMat);
  up.add(upLid);
  if (lash) {
    const lr = +(r * lidR).toFixed(4);
    const line = new THREE.Mesh(cached('geo:lash:' + lr, () => new THREE.TorusGeometry(lr, lr * 0.07, 5, 24, Math.PI)), lash);
    line.rotation.x = Math.PI / 2;
    line.userData.noShadow = true;
    up.add(line);
  }
  let lo = null;
  if (lower) {
    lo = new THREE.Group();
    slant.add(lo);
    lo.add(new THREE.Mesh(lidGeo(+(r * (lidR - 0.01)).toFixed(4), true), lidMat));
  }
  return { eg, ball, slant, up, lo, side: Math.sign(x) || 1, upLid };
}
// upper lid edge elevation (rad): +1.4 wide open .. -1.57 shut; lower lid: -1.4 open .. +1.57 shut
function setLids(e, upEdge, loEdge = -1.3) {
  e.up.rotation.x = -upEdge;
  if (e.lo) e.lo.rotation.x = -loEdge;
}
// rotate an eyeball toward a local look direction (lx: right, ly: up), clamped
function aimEye(ball, yaw, pitch) {
  ball.rotation.set(-pitch, yaw, 0, 'YXZ');
}

// ------------------------------------------------------------------------------------------------
// Ice block: faceted, flat-topped (a platform), frosted edges, inner glow; cracks in its last second
// ------------------------------------------------------------------------------------------------
function frostTexture(cracked) {
  return cached('tex:frost:' + (cracked ? 'c' : 'n'), () =>
    canvasTex(256, 256, (ctx, W, H) => {
      ctx.clearRect(0, 0, W, H);
      // clear centre, frosted borders
      const img = ctx.createImageData(W, H);
      const rand = rng(cracked ? 99 : 7);
      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
          const ex = Math.min(x, W - 1 - x) / (W * 0.5);
          const ey = Math.min(y, H - 1 - y) / (H * 0.5);
          const e = Math.min(ex, ey);
          const frost = Math.pow(1 - smooth(0.0, 0.32, e), 1.6);
          const n = rand();
          const a = 0.16 + frost * 0.62 + (n - 0.5) * 0.08;
          const i = (y * W + x) * 4;
          const b = 225 + frost * 30;
          img.data[i] = b - 20 + n * 10;
          img.data[i + 1] = b - 4;
          img.data[i + 2] = 255;
          img.data[i + 3] = clamp(a, 0, 1) * 255;
        }
      }
      ctx.putImageData(img, 0, 0);
      // internal fracture planes and bubbles
      ctx.strokeStyle = 'rgba(255,255,255,0.35)';
      ctx.lineWidth = 1.5;
      for (let i = 0; i < 6; i++) {
        ctx.beginPath();
        let x = rand() * W;
        let y = rand() * H;
        ctx.moveTo(x, y);
        for (let k = 0; k < 4; k++) {
          x += (rand() - 0.5) * 90;
          y += (rand() - 0.5) * 90;
          ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
      ctx.fillStyle = 'rgba(255,255,255,0.55)';
      for (let i = 0; i < 26; i++) {
        ctx.beginPath();
        ctx.arc(30 + rand() * (W - 60), 30 + rand() * (H - 60), 1 + rand() * 3, 0, TWO_PI);
        ctx.fill();
      }
      if (cracked) {
        ctx.lineCap = 'round';
        const crack = (x, y, a, len, w) => {
          for (let s = 0; s < len; s++) {
            const nx = x + Math.cos(a) * 9;
            const ny = y + Math.sin(a) * 9;
            ctx.strokeStyle = 'rgba(255,255,255,0.95)';
            ctx.lineWidth = w;
            ctx.beginPath();
            ctx.moveTo(x, y);
            ctx.lineTo(nx, ny);
            ctx.stroke();
            x = nx;
            y = ny;
            a += (rand() - 0.5) * 0.9;
            if (rand() < 0.18) crack(x, y, a + (rand() - 0.5) * 2, len * 0.4, w * 0.6);
          }
        };
        for (let i = 0; i < 5; i++) crack(W * 0.5 + (rand() - 0.5) * 40, H * 0.5 + (rand() - 0.5) * 40, rand() * TWO_PI, 16, 3.5);
      }
    })
  );
}

function iceGeometry() {
  return cached('geo:ice', () => {
    const W = 0.33;
    const D = 0.31;
    const top = ICE_TOP;
    const bot = ICE_BOTTOM;
    const c = 0.045;
    const rand = rng(31);
    const pts = [];
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        for (const [y, sy] of [
          [top, 1],
          [bot, -1],
        ]) {
          const j = () => (rand() - 0.5) * 0.02;
          pts.push(new THREE.Vector3(sx * (W - c) + j(), y, sz * (D - c) + j()));
          pts.push(new THREE.Vector3(sx * W, y - sy * c, sz * (D - c) + j()));
          pts.push(new THREE.Vector3(sx * (W - c) + j(), y - sy * c, sz * D));
        }
      }
    }
    // bulge each side face into a few facets (never above the flat top)
    const mid = (top + bot) / 2;
    for (const [nx, nz] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      for (let k = 0; k < 3; k++) {
        const u = (rand() - 0.5) * 0.36;
        const y = mid + (rand() - 0.5) * 0.36;
        const out = 0.012 + rand() * 0.016;
        if (nx) pts.push(new THREE.Vector3(nx * (W + out), y, u * (D / W)));
        else pts.push(new THREE.Vector3(u, y, nz * (D + out)));
      }
    }
    let g = new ConvexGeometry(pts);
    g = g.index ? g.toNonIndexed() : g;
    g.computeVertexNormals();
    // per-face planar UVs spanning the block so the frost hugs every face's border
    const p = g.attributes.position;
    const n = g.attributes.normal;
    const uv = new Float32Array(p.count * 2);
    for (let i = 0; i < p.count; i += 3) {
      const ax = Math.abs(n.getX(i));
      const ay = Math.abs(n.getY(i));
      const az = Math.abs(n.getZ(i));
      for (let k = 0; k < 3; k++) {
        const x = p.getX(i + k);
        const y = p.getY(i + k);
        const z = p.getZ(i + k);
        let u;
        let v;
        if (ay >= ax && ay >= az) {
          u = (x + W) / (2 * W);
          v = (z + D) / (2 * D);
        } else if (ax >= az) {
          u = (z + D) / (2 * D);
          v = (y - bot) / (top - bot);
        } else {
          u = (x + W) / (2 * W);
          v = (y - bot) / (top - bot);
        }
        uv[(i + k) * 2] = u;
        uv[(i + k) * 2 + 1] = v;
      }
    }
    g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    return g;
  });
}

function iceMaterials(cracked) {
  return cached('mat:ice:' + (cracked ? 'c' : 'n'), () => {
    const tex = frostTexture(cracked);
    const back = new THREE.MeshStandardMaterial({
      color: '#7dd3fc',
      emissive: '#0ea5e9',
      emissiveIntensity: 0.35,
      roughness: 0.2,
      transparent: true,
      opacity: 0.32,
      side: THREE.BackSide,
      depthWrite: false,
      flatShading: true,
    });
    const front = new THREE.MeshPhysicalMaterial({
      color: '#e0f7ff',
      map: tex,
      emissive: '#38bdf8',
      emissiveIntensity: 0.22,
      emissiveMap: tex,
      roughness: 0.06,
      metalness: 0,
      clearcoat: 1,
      clearcoatRoughness: 0.05,
      transparent: true,
      depthWrite: false,
      flatShading: true,
      envMapIntensity: 1.4,
    });
    // keep specular glints bright on the clear faces (alpha would otherwise dim them)
    front.onBeforeCompile = (sh) => {
      sh.fragmentShader = sh.fragmentShader.replace(
        '#include <opaque_fragment>',
        `float iceF = pow(1.0 - clamp(abs(dot(normal, normalize(vViewPosition))), 0.0, 1.0), 2.0);
        float iceSpec = dot(reflectedLight.directSpecular + reflectedLight.indirectSpecular, vec3(0.333));
        diffuseColor.a = clamp(diffuseColor.a + iceF * 0.35 + iceSpec * 0.9, 0.0, 1.0);
        outgoingLight += vec3(0.55, 0.85, 1.0) * iceF * 0.25;
        #include <opaque_fragment>`
      );
    };
    front.customProgramCacheKey = () => 'enm-ice';
    return { back, front };
  });
}

function makeIce() {
  const g = new THREE.Group();
  const geo = iceGeometry();
  const mats = iceMaterials(false);
  const back = new THREE.Mesh(geo, mats.back);
  back.renderOrder = 2;
  const front = new THREE.Mesh(geo, mats.front);
  front.renderOrder = 3;
  g.add(back, front);
  g.visible = false;
  g.userData.meshes = { back, front };
  return g;
}

// ------------------------------------------------------------------------------------------------
// Shared small helpers for building a model
// ------------------------------------------------------------------------------------------------
function additiveSprite(tex, color, size, opacity = 0.6) {
  const sp = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: tex, color, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending })
  );
  sp.scale.setScalar(size);
  return sp;
}
function basic(color, extra = {}) {
  return new THREE.MeshBasicMaterial({ color, ...extra });
}

// Per-instance hooked material registry (hit flash + freeze tint driven per frame)
function reg(ud, mat) {
  if (mat.userData.fx) ud.fx.push(mat.userData.fx);
  return mat;
}
function physical(ud, opts, hook = {}) {
  return reg(ud, fxHook(new THREE.MeshPhysicalMaterial(opts), hook));
}

// ================================================================================================
// 1. ROLLER — armoured chrome ball rolling inside a stationary gunmetal yoke with a red visor and a
//    V-shaped scanner slit (stays upright while the shell rolls). Shooting only freezes it.
// ================================================================================================
const ROLL_R = 0.226;
const ROLL_D = [Math.sin(0.36), Math.cos(0.36)]; // visor direction (up, forward) in the YZ plane
const ROLL_RM = ROLL_R + 0.042;
const ROLL_VC = ROLL_RM + 0.012;

function rollerBallSDF(x, y, z) {
  const l = Math.hypot(x, y, z);
  let d = l - ROLL_R;
  const inner = ROLL_R - 0.03 - l;
  d = ssub(d, Math.max(Math.abs(x) - 0.017, inner), 0.007);
  d = ssub(d, Math.max(Math.abs(y) - 0.017, inner), 0.007);
  d = ssub(d, Math.max(Math.abs(z) - 0.017, inner), 0.007);
  const s = (ROLL_R + 0.002) / Math.sqrt(3);
  d = smin(d, sdSphere(Math.abs(x), Math.abs(y), Math.abs(z), s, s, s, 0.034), 0.016);
  return d;
}
function rollerYokeSDF(x, y, z) {
  const [sd, cd] = ROLL_D;
  const v = y * sd + z * cd; // along the visor direction
  const w = y * cd - z * sd; // up-back
  const l = Math.hypot(x, y, z);
  let d = smax(smax(Math.abs(l - (ROLL_R + 0.03)) - 0.017, Math.abs(w) - 0.062, 0.02), -v, 0.02);
  for (const s of [-1, 1]) d = smin(d, sdCyl(x, y, z, 'x', s * (ROLL_R + 0.03), 0, 0, 0.088, 0.026, 0.012), 0.02);
  // hub bolt
  for (const s of [-1, 1]) d = smin(d, sdCyl(x, y, z, 'x', s * (ROLL_R + 0.058), 0, 0, 0.035, 0.012, 0.006), 0.008);
  // visor plate
  d = smin(d, sdEllipsoid(x, v, w, 0, ROLL_VC - 0.004, 0.01, 0.165, 0.055, 0.125), 0.035);
  // chin guard below the slit
  d = smin(d, sdEllipsoid(x, v, w, 0, ROLL_VC - 0.012, -0.085, 0.07, 0.04, 0.05), 0.03);
  // swept-back brow horns
  for (const s of [-1, 1]) d = smin(d, sdRoundCone(x, v, w, s * 0.09, ROLL_VC + 0.004, 0.07, s * 0.175, ROLL_VC - 0.05, 0.19, 0.034, 0.007), 0.024);
  // angry V scanner slit
  for (const s of [-1, 1]) d = ssub(d, sdCapsule(x, v, w, 0, ROLL_VC + 0.055, -0.014, s * 0.115, ROLL_VC + 0.052, 0.022, 0.022), 0.008);
  // rivets along both edges of the band
  for (const a of [0.42, 0.85, 2.29, 2.72]) {
    for (const ww of [-0.042, 0.042]) {
      const rr = ROLL_R + 0.047;
      d = smin(d, sdSphere(x, v, w, Math.cos(a) * rr, Math.sin(a) * rr, ww, 0.013), 0.006);
    }
  }
  return d;
}
function rollerSlitPoint(t) {
  // t in [-1, 1] along the V slit; returns local xyz
  const [sd, cd] = ROLL_D;
  const x = t * 0.108;
  const v = ROLL_VC + 0.046;
  const w = -0.014 + Math.abs(t) * 0.034;
  return [x, v * sd + w * cd, v * cd - w * sd];
}

function buildRoller(g, body, ud, env) {
  const ballGeo = sculpt('rollerBall', rollerBallSDF, [-0.28, -0.28, -0.28], [0.28, 0.28, 0.28], 0.015, (x, y, z, c) => {
    const l = Math.hypot(x, y, z);
    const ax = Math.abs(x);
    const ay = Math.abs(y);
    const az = Math.abs(z);
    const s = (ROLL_R + 0.002) / Math.sqrt(3);
    const stud = Math.hypot(ax - s, ay - s, az - s);
    if (stud < 0.047) {
      c.set('#fbbf24');
      return 1;
    }
    const groove = smooth(ROLL_R - 0.006, ROLL_R - 0.018, l);
    const odd = x * y * z > 0;
    c.set(odd ? '#f8fafc' : '#7c8aa5');
    c.lerp(C('#0b1020'), groove);
    return 1 - groove * 0.8;
  });
  const yokeGeo = sculpt('rollerYoke', rollerYokeSDF, [-0.34, -0.13, -0.14], [0.34, 0.37, 0.36], 0.0135, (x, y, z, c) => {
    const [sd, cd] = ROLL_D;
    const v = y * sd + z * cd;
    const w = y * cd - z * sd;
    const visor = smooth(0.15, 0.1, Math.hypot(x / 1.3, (w - 0.0) / 1.0)) * smooth(ROLL_RM - 0.03, ROLL_RM, v);
    c.set('#3b4659');
    if (Math.abs(x) > ROLL_R + 0.045 && Math.hypot(y, z) < 0.04) {
      c.set('#fbbf24');
      return 1;
    }
    if (Math.abs(x) > ROLL_R + 0.04 && Math.hypot(y, z) > 0.062) c.set('#b91c1c');
    c.lerp(C('#1a1f2e'), visor);
    // gold rivets
    if (Math.abs(Math.abs(w) - 0.042) < 0.014 && Math.hypot(x, y, z) > ROLL_R + 0.05 && visor < 0.3) c.set('#fbbf24');
    // red war-paint stripe down the middle of the mask
    if (visor > 0.5 && Math.abs(x) < 0.016 && w > 0.03) c.set('#dc2626');
    // slit interior
    const slitD = Math.min(
      sdCapsule(x, v, w, 0, ROLL_VC + 0.055, -0.014, 0.115, ROLL_VC + 0.052, 0.022, 0.022),
      sdCapsule(x, v, w, 0, ROLL_VC + 0.055, -0.014, -0.115, ROLL_VC + 0.052, 0.022, 0.022)
    );
    if (slitD < 0.004) {
      c.set('#14060a');
      return 0;
    }
    // horn tips lighter
    if (w > 0.13) c.lerp(C('#e2e8f0'), smooth(0.13, 0.18, w));
    return 1;
  });
  const chrome = physical(
    ud,
    { vertexColors: true, metalness: 1, roughness: 0.2, envMap: env.chromeEnv, envMapIntensity: 1.25, clearcoat: 0.6, clearcoatRoughness: 0.12 },
    { metalMask: true, paintRough: 0.5, rim: '#ffd9a8', rimStrength: 0.25 }
  );
  const yokeMat = physical(
    ud,
    { vertexColors: true, metalness: 0.85, roughness: 0.32, envMap: env.chromeEnv, envMapIntensity: 1.0, clearcoat: 0.8, clearcoatRoughness: 0.2 },
    { metalMask: true, paintRough: 0.28, rimStrength: 0.35 }
  );
  const spin = new THREE.Group();
  body.add(spin);
  const ball = new THREE.Mesh(ballGeo, chrome);
  spin.add(ball);
  addOutline(ball, 0.011);
  const seamGeo = cached('geo:rollerSeams', () => {
    const parts = [];
    for (let i = 0; i < 3; i++) {
      const t = new THREE.TorusGeometry(ROLL_R - 0.016, 0.0105, 6, 64);
      if (i === 1) t.rotateY(Math.PI / 2);
      if (i === 2) t.rotateX(Math.PI / 2);
      parts.push(t);
    }
    return mergeGeometries(parts);
  });
  const seamMat = basic(C('#22d3ee').multiplyScalar(2.2));
  const seams = new THREE.Mesh(seamGeo, seamMat);
  seams.userData.noShadow = true;
  spin.add(seams);
  const yoke = new THREE.Mesh(yokeGeo, yokeMat);
  body.add(yoke);
  addOutline(yoke, 0.011);
  // scanner slit glow + moving "pupil"
  const slitGeo = cached('geo:rollerSlit', () => {
    const pts = [];
    for (let i = 0; i <= 12; i++) pts.push(new THREE.Vector3(...rollerSlitPoint(-1 + (i / 12) * 2)));
    return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 24, 0.0145, 6, false);
  });
  const slitMat = basic(C('#ff2d2d').multiplyScalar(1.6));
  const slit = new THREE.Mesh(slitGeo, slitMat);
  slit.userData.noShadow = true;
  body.add(slit);
  const dot = new THREE.Mesh(cached('geo:rollerDot', () => new THREE.SphereGeometry(0.023, 12, 8)), basic(C('#fff3b0').multiplyScalar(2.2)));
  dot.userData.noShadow = true;
  body.add(dot);
  const halo = additiveSprite(env.dot, '#ff3b3b', 0.34, 0.5);
  body.add(halo);
  Object.assign(ud, { spin, ball, seams, seamMat, slit, slitMat, dot, halo, popColor: '#a5f3fc' });
}

function animRoller(g, ud, en, st, ctx, f) {
  const colW = (TWO_PI * RING_R) / (ctx.COLS || 16);
  if (!f.frozen) st.roll = (st.roll || 0) + ((en.speed || 1) * colW * f.dt) / GROUP_SCALE / ROLL_R;
  ud.spin.rotation.x = st.roll || 0;
  // a little rocking of the yoke against the roll, plus a heavy bob
  ud.body.rotation.x = f.frozen ? ud.body.rotation.x : Math.sin(st.t * 9) * 0.035;
  ud.body.position.y = f.frozen ? ud.body.position.y : Math.abs(Math.sin(st.t * 9)) * 0.006;
  // scanner: sweeps, locks toward Pogo when he is near
  const lk = f.look;
  const lock = smooth(5.5, 2.5, lk.dist);
  const sweep = Math.sin(st.t * 3.2);
  st.scan = damp(st.scan ?? 0, mix(sweep, clamp(lk.yaw * 1.6, -1, 1), lock), 10, f.dt);
  const p = rollerSlitPoint(clamp(st.scan, -0.95, 0.95));
  ud.dot.position.set(p[0], p[1], p[2] + 0.004);
  const glow = f.frozen ? 0.15 : 1 + Math.sin(st.t * 14) * 0.15 + lock * 0.4;
  ud.slitMat.color.setRGB(1.0 * glow * 1.6, 0.12 * glow, 0.12 * glow);
  ud.dot.visible = !f.frozen;
  ud.seamMat.color.setRGB(0.02, 0.62, 1.0).multiplyScalar(f.frozen ? 0.3 : 1.25 + Math.sin(st.t * 6) * 0.3);
  ud.halo.position.set(p[0], p[1], p[2] + 0.03);
  ud.halo.material.opacity = f.frozen ? 0 : 0.35 + lock * 0.3;
}

// ================================================================================================
// 2. BOUNCER — glossy red rubber ball with a yellow band, valve nub, sculpted angry brows, a
//    toothy crescent grin and big textured eyes. Squashes on landing. Pops when shot.
// ================================================================================================
const BNC_R = 0.212;
const BNC_EYE = { x: 0.07, y: 0.032, z: 0.162, r: 0.058 };
function bouncerSDF(x, y, z) {
  const ax = Math.abs(x);
  let d = sdSphere(x, y, z, 0, 0, 0, BNC_R);
  d = smin(d, sdSphere(ax, y, z, 0.095, -0.05, 0.135, 0.085), 0.05); // cheeks
  d = smin(d, sdCapsule(ax, y, z, 0.15, 0.125, 0.12, 0.028, 0.082, 0.19, 0.026), 0.035); // angry brows
  d = ssub(d, sdSphere(ax, y, z, BNC_EYE.x, BNC_EYE.y, BNC_EYE.z, 0.066), 0.016); // sockets
  const mA = sdEllipsoid(x, y, z, 0, -0.078, 0.205, 0.128, 0.07, 0.09);
  const mB = sdEllipsoid(x, y, z, 0, -0.022, 0.225, 0.158, 0.064, 0.13);
  d = ssub(d, Math.max(mA, -mB), 0.012); // crescent grin
  d = smin(d, sdCapsule(x, y, z, 0, BNC_R - 0.02, -0.03, 0, BNC_R + 0.022, -0.04, 0.02), 0.022); // valve
  return d;
}
function bouncerMouthTop(x) {
  return -0.022 - 0.064 * Math.sqrt(Math.max(0, 1 - (x / 0.158) ** 2));
}
function buildBouncer(g, body, ud, env) {
  const geo = sculpt('bouncer', bouncerSDF, [-0.27, -0.25, -0.25], [0.27, 0.27, 0.28], 0.0135, (x, y, z, c) => {
    const ax = Math.abs(x);
    c.set('#ef2b3c');
    // darker underneath, hot highlight on top
    c.lerp(C('#9f1239'), smooth(0.0, -0.2, y) * 0.55);
    // yellow band with white pinstripes, tilted over the crown
    const bd = y * 0.26 - z * 0.966 + 0.03;
    const band = smooth(0.036, 0.03, Math.abs(bd));
    const pin = smooth(0.008, 0.004, Math.abs(Math.abs(bd) - 0.047));
    c.lerp(C('#facc15'), band);
    c.lerp(C('#fff7ed'), pin);
    // brows: dark rubber
    const brow = sdCapsule(ax, y, z, 0.15, 0.125, 0.12, 0.028, 0.082, 0.19, 0.026);
    c.lerp(C('#3b0a12'), smooth(0.012, 0.002, brow));
    // mouth interior + tongue
    const mA = sdEllipsoid(x, y, z, 0, -0.078, 0.205, 0.128, 0.07, 0.09);
    const mB = sdEllipsoid(x, y, z, 0, -0.022, 0.225, 0.158, 0.064, 0.13);
    const inMouth = smooth(0.012, 0.004, Math.max(mA, -mB));
    c.lerp(C('#2a0509'), inMouth);
    c.lerp(C('#fb7185'), inMouth * smooth(0.03, 0.0, sdEllipsoid(x, y, z, 0, -0.14, 0.17, 0.07, 0.03, 0.05)));
    // valve
    if (y > BNC_R - 0.01 && Math.hypot(x, z + 0.035) < 0.03) c.set('#fde047');
    return 0;
  });
  const squash = new THREE.Group(); // pivot at the contact point
  squash.position.y = GROUND;
  body.add(squash);
  const inner = new THREE.Group();
  inner.position.y = BNC_R + 0.002;
  squash.add(inner);
  const rubber = physical(ud, {
    vertexColors: true,
    roughness: 0.32,
    clearcoat: 1,
    clearcoatRoughness: 0.08,
    sheen: 0.3,
    sheenColor: C('#ffd1d1'),
  });
  const ball = new THREE.Mesh(geo, rubber);
  inner.add(ball);
  addOutline(ball, 0.012);
  // teeth: a row of sharp uppers and two lower fangs
  const teethGeo = cached('geo:bouncerTeeth', () => {
    const parts = [];
    const n = 6;
    for (let i = 0; i < n; i++) {
      const x = -0.088 + (i / (n - 1)) * 0.176;
      const y = bouncerMouthTop(x) + 0.004;
      const z = Math.sqrt(Math.max(0, BNC_R * BNC_R - x * x - y * y)) - 0.006;
      const t = new THREE.ConeGeometry(0.0135, 0.034, 5);
      t.rotateX(Math.PI);
      t.translate(x, y - 0.014, z);
      parts.push(t);
    }
    for (const x of [-0.06, 0.06]) {
      const y = -0.135 + Math.abs(x) * 0.25;
      const z = Math.sqrt(Math.max(0, BNC_R * BNC_R - x * x - y * y)) - 0.012;
      const t = new THREE.ConeGeometry(0.012, 0.03, 5);
      t.translate(x, y + 0.012, z);
      parts.push(t);
    }
    return mergeGeometries(parts.map((p) => p.toNonIndexed()));
  });
  const teeth = new THREE.Mesh(teethGeo, physical(ud, { color: '#fffaf0', roughness: 0.2, clearcoat: 1 }));
  inner.add(teeth);
  // eyes
  const tex = eyeTexture({
    key: 'bouncer',
    sclera: ['#ffffff', '#fbf7f0', '#d6c8c0'],
    iris: [
      [0, '#fff7ae'],
      [0.45, '#facc15'],
      [0.85, '#ea580c'],
      [1, '#431407'],
    ],
    irisR: 50,
    fibre: 'rgba(124,45,18,0.45)',
    limbal: '#2a0f05',
    pupilR: 16,
    veins: 6,
    veinColor: 'rgba(225,29,72,0.55)',
  });
  const eyeMat = eyeMaterial(tex);
  reg(ud, eyeMat);
  const lidMat = physical(ud, { color: '#e11d2e', roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.1 });
  const eyes = [-1, 1].map((s) =>
    makeEye(inner, { x: s * BNC_EYE.x, y: BNC_EYE.y, z: BNC_EYE.z, r: BNC_EYE.r, mat: eyeMat, lidMat, lidR: 1.1 })
  );
  for (const e of eyes) e.slant.rotation.z = e.side * 0.38;
  const glints = new THREE.Mesh(
    glintGeo('bouncer', [
      [-BNC_EYE.x - 0.02, BNC_EYE.y + 0.024, BNC_EYE.z + 0.05, 0.012],
      [BNC_EYE.x - 0.02, BNC_EYE.y + 0.024, BNC_EYE.z + 0.05, 0.012],
      [-BNC_EYE.x + 0.016, BNC_EYE.y - 0.016, BNC_EYE.z + 0.054, 0.006],
      [BNC_EYE.x + 0.016, BNC_EYE.y - 0.016, BNC_EYE.z + 0.054, 0.006],
    ]),
    GLINT_MAT
  );
  glints.userData.noShadow = true;
  inner.add(glints);
  Object.assign(ud, { squash, inner, eyes, popColor: '#fda4af' });
}

function blinkAmount(st, dt, frozen) {
  if (frozen) return st.blink > 0 ? 1 : 0;
  st.blinkT -= dt;
  if (st.blinkT <= 0) {
    st.blink = 0.13;
    st.blinkT = 1.6 + Math.random() * 3.2;
  }
  st.blink = Math.max(0, st.blink - dt);
  return st.blink > 0 ? Math.sin((st.blink / 0.13) * Math.PI) : 0;
}
function lookEyes(eyes, st, f, maxYaw = 0.55, maxPitch = 0.4) {
  if (!f.frozen) {
    st.lookX = damp(st.lookX, clamp(f.look.yaw, -maxYaw, maxYaw), 9, f.dt);
    st.lookY = damp(st.lookY, clamp(f.look.pitch, -maxPitch, maxPitch), 9, f.dt);
  }
  for (const e of eyes) aimEye(e.ball, st.lookX, st.lookY);
}

function animBouncer(g, ud, en, st, ctx, f) {
  const base = Math.round(en.baseFloor ?? en.floor);
  const h = Math.max(0, en.floor - base);
  if (!f.frozen) {
    const vy = f.dt > 0 ? (h - (st.prevH ?? h)) / f.dt : 0;
    st.vy = damp(st.vy ?? 0, vy, 20, f.dt);
    st.prevH = h;
  }
  const contact = f.frozen ? st.contact ?? 0 : smooth(0.16, 0.0, h);
  st.contact = contact;
  const stretch = f.frozen ? 0 : clamp(Math.abs(st.vy || 0) * 0.018, 0, 0.1) * smooth(0.18, 0.4, h);
  const sq = contact * 0.3;
  ud.squash.scale.set(1 + sq * 0.85 - stretch * 0.5, 1 - sq + stretch, 1 + sq * 0.85 - stretch * 0.5);
  // lean into the hop, tiny spin wobble in the air
  const lean = f.frozen ? ud.squash.rotation.x : smooth(0.1, 0.5, h) * 0.12;
  ud.squash.rotation.x = lean;
  ud.squash.rotation.z = f.frozen ? ud.squash.rotation.z : Math.sin(st.t * 5) * 0.06 * smooth(0.2, 0.6, h);
  // the ball sits on its contact point; airborne it centres on the enemy origin
  ud.squash.position.y = GROUND;
  const blink = blinkAmount(st, f.dt, f.frozen);
  const squint = contact * 0.45;
  for (const e of ud.eyes) {
    setLids(e, mix(0.32, -1.5, Math.max(blink, squint)));
  }
  lookEyes(ud.eyes, st, f);
}


// Re-paint a cached sculpt with another palette (shares position/normal/index buffers)
function repaint(base, key, paintFn, aoMin = 0.55) {
  return cached('repaint:' + key, () => {
    const g = new THREE.BufferGeometry();
    g.setIndex(base.index);
    g.setAttribute('position', base.attributes.position);
    g.setAttribute('normal', base.attributes.normal);
    const pos = base.attributes.position.array;
    const ao = base.userData.ao;
    const n = pos.length / 3;
    const col = new Float32Array(n * 4);
    const c = new THREE.Color();
    for (let i = 0; i < n; i++) {
      c.setRGB(1, 1, 1);
      const m = paintFn(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2], c, i) ?? 0;
      const k = Math.max(aoMin, ao[i]);
      col[i * 4] = c.r * k;
      col[i * 4 + 1] = c.g * k;
      col[i * 4 + 2] = c.b * k;
      col[i * 4 + 3] = m;
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 4));
    g.boundingSphere = base.boundingSphere;
    g.userData.hull = base.userData.hull;
    g.userData.ao = ao;
    return g;
  });
}

// ================================================================================================
// 3. SPIKER — a fluffy, velvety fuzzball with soft rounded spikes (tips in a hotter hue), big
//    grumpy heavy-lidded eyes, a frown with one snaggle fang. Random hue. Two hits: band-aid.
// ================================================================================================
const SPIKER_PAL = [
  { body: '#facc15', tip: '#f97316', muzzle: '#fef9c3' },
  { body: '#a3e635', tip: '#facc15', muzzle: '#f7fee7' },
  { body: '#f472b6', tip: '#a855f7', muzzle: '#fdf2f8' },
  { body: '#a78bfa', tip: '#f472b6', muzzle: '#f5f3ff' },
  { body: '#2dd4bf', tip: '#3b82f6', muzzle: '#f0fdfa' },
];
const SPK_EYE = { x: 0.066, y: 0.03, z: 0.128, r: 0.065 };
const SPK_DIRS = (() => {
  const out = [];
  const rand = rng(5);
  for (const d of fibDirs(30, 0.4)) {
    const face = d[2] * 0.95 + d[1] * 0.12;
    if (face > 0.62) continue; // keep the face clear
    out.push({ d, len: 0.275 + rand() * 0.03 });
  }
  return out;
})();
function spikerSDF(x, y, z) {
  const ax = Math.abs(x);
  const l = Math.hypot(x, y, z);
  let d = l - 0.158;
  for (const { d: v, len } of SPK_DIRS) {
    const along = x * v[0] + y * v[1] + z * v[2];
    if (along < 0 || l * l - along * along > 0.0133) continue;
    d = smin(d, sdRoundCone(x, y, z, v[0] * 0.1, v[1] * 0.1, v[2] * 0.1, v[0] * len, v[1] * len, v[2] * len, 0.062, 0.017), 0.05);
  }
  // fuzz
  d += 0.0028 * Math.sin(x * 61) * Math.sin(y * 57 + 1) * Math.sin(z * 67 + 2);
  // muzzle pad
  d = smin(d, sdEllipsoid(x, y, z, 0, -0.045, 0.1, 0.1, 0.07, 0.07), 0.04);
  // heavy brow ridges (flat, slightly frowning)
  d = smin(d, sdCapsule(ax, y, z, 0.13, 0.118, 0.085, 0.024, 0.1, 0.14, 0.024), 0.03);
  d = ssub(d, sdSphere(ax, y, z, SPK_EYE.x, SPK_EYE.y, SPK_EYE.z, 0.071), 0.016);
  // frown
  d = ssub(d, Math.min(sdCapsule(x, y, z, -0.048, -0.088, 0.152, 0, -0.07, 0.165, 0.011), sdCapsule(x, y, z, 0, -0.07, 0.165, 0.048, -0.088, 0.152, 0.011)), 0.008);
  // snaggle fang
  d = smin(d, sdRoundCone(x, y, z, 0.026, -0.072, 0.158, 0.03, -0.1, 0.156, 0.011, 0.004), 0.004);
  return d;
}
function spikerPaint(pal) {
  const body = C(pal.body);
  const tip = C(pal.tip);
  const deep = body.clone().multiplyScalar(0.62);
  const muz = C(pal.muzzle);
  const dark = C('#1c0a14');
  return (x, y, z, c) => {
    const l = Math.hypot(x, y, z);
    c.copy(body);
    c.lerp(deep, smooth(0.05, -0.16, y) * 0.5);
    c.lerp(tip, smooth(0.2, 0.3, l));
    c.lerp(muz, smooth(0.02, -0.01, sdEllipsoid(x, y, z, 0, -0.045, 0.11, 0.095, 0.065, 0.07)) * 0.85);
    const brow = sdCapsule(Math.abs(x), y, z, 0.13, 0.118, 0.085, 0.024, 0.1, 0.14, 0.024);
    c.lerp(body.clone().multiplyScalar(0.45), smooth(0.012, 0.0, brow));
    const frown = Math.min(sdCapsule(x, y, z, -0.048, -0.088, 0.152, 0, -0.07, 0.165, 0.011), sdCapsule(x, y, z, 0, -0.07, 0.165, 0.048, -0.088, 0.152, 0.011));
    c.lerp(dark, smooth(0.006, 0.0, frown));
    const fang = sdRoundCone(x, y, z, 0.026, -0.072, 0.158, 0.03, -0.1, 0.156, 0.011, 0.004);
    if (fang < 0.003 && z > 0.155) c.set('#fffbeb');
    // fur speckle
    const n = Math.sin(x * 170) * Math.sin(y * 163 + 1) * Math.sin(z * 157 + 2);
    c.multiplyScalar(0.94 + n * 0.08);
    return 0;
  };
}
function bandaidTex() {
  return cached('tex:bandaid', () =>
    canvasTex(128, 48, (ctx) => {
      ctx.fillStyle = '#f5d0a9';
      ctx.beginPath();
      ctx.roundRect(2, 4, 124, 40, 18);
      ctx.fill();
      ctx.fillStyle = '#e8b98a';
      ctx.fillRect(44, 8, 40, 32);
      ctx.fillStyle = 'rgba(120,70,40,0.35)';
      for (let i = 0; i < 12; i++) {
        ctx.beginPath();
        ctx.arc(14 + (i % 3) * 9 + (i > 5 ? 82 : 0), 14 + Math.floor((i % 6) / 3) * 18, 2, 0, TWO_PI);
        ctx.fill();
      }
    })
  );
}
function buildSpiker(g, body, ud, env) {
  const pi = Math.floor(Math.random() * SPIKER_PAL.length);
  const pal = SPIKER_PAL[pi];
  const base = sculpt('spiker', spikerSDF, [-0.34, -0.34, -0.34], [0.34, 0.34, 0.34], 0.0135, spikerPaint(SPIKER_PAL[0]), { aoScale: 1.3 });
  const geo = pi === 0 ? base : repaint(base, 'spiker' + pi, spikerPaint(pal));
  const fluff = physical(
    ud,
    { vertexColors: true, roughness: 0.62, sheen: 0.7, sheenRoughness: 0.45, sheenColor: C(pal.body).lerp(C('#ffffff'), 0.35), clearcoat: 0.08 },
    { rim: pal.muzzle, rimStrength: 0.22 }
  );
  const wob = new THREE.Group();
  body.add(wob);
  const ball = new THREE.Mesh(geo, fluff);
  wob.add(ball);
  addOutline(ball, 0.012);
  const tex = eyeTexture({
    key: 'spiker',
    sclera: ['#ffffff', '#f8fafc', '#cbd5e1'],
    iris: [
      [0, '#fecdd3'],
      [0.4, '#fb7185'],
      [0.85, '#be123c'],
      [1, '#4c0519'],
    ],
    irisR: 52,
    fibre: 'rgba(76,5,25,0.4)',
    limbal: '#2b0510',
    pupilR: 22,
  });
  const eyeMat = reg(ud, eyeMaterial(tex));
  const lidMat = physical(ud, { color: C(pal.body).multiplyScalar(0.85), roughness: 0.7, sheen: 1, sheenColor: C(pal.muzzle) });
  const eyes = [-1, 1].map((s) => makeEye(wob, { x: s * SPK_EYE.x, y: SPK_EYE.y, z: SPK_EYE.z, r: SPK_EYE.r, mat: eyeMat, lidMat, lower: true, lidR: 1.1 }));
  const glints = new THREE.Mesh(
    glintGeo('spiker', [
      [-SPK_EYE.x - 0.02, SPK_EYE.y + 0.012, SPK_EYE.z + 0.054, 0.012],
      [SPK_EYE.x - 0.02, SPK_EYE.y + 0.012, SPK_EYE.z + 0.054, 0.012],
      [-SPK_EYE.x + 0.017, SPK_EYE.y - 0.022, SPK_EYE.z + 0.052, 0.006],
      [SPK_EYE.x + 0.017, SPK_EYE.y - 0.022, SPK_EYE.z + 0.052, 0.006],
    ]),
    GLINT_MAT
  );
  glints.userData.noShadow = true;
  wob.add(glints);
  // band-aid cross shown once it has been hit
  const bandGeo = cached('geo:bandaid', () => {
    const a = new THREE.PlaneGeometry(0.13, 0.05);
    const b = new THREE.PlaneGeometry(0.13, 0.05);
    b.rotateZ(Math.PI / 2);
    b.translate(0, 0, 0.002);
    return mergeGeometries([a, b]);
  });
  const band = new THREE.Mesh(bandGeo, new THREE.MeshStandardMaterial({ map: bandaidTex(), roughness: 0.8, side: THREE.DoubleSide }));
  const bp = traceSurface(spikerSDF, [0, 0, 0], [-0.62, 0.62, 0.48], 0.4);
  band.position.set(bp[0] * 1.03, bp[1] * 1.03, bp[2] * 1.03);
  band.lookAt(bp[0] * 3, bp[1] * 3, bp[2] * 3);
  band.rotateZ(0.5);
  band.visible = false;
  band.userData.noShadow = true;
  wob.add(band);
  const halo = additiveSprite(env.dot, pal.body, 0.95, 0.0);
  body.add(halo);
  Object.assign(ud, { wob, ball, eyes, band, halo, popColor: pal.body, ownsBodyScale: true });
}
function animSpiker(g, ud, en, st, ctx, f) {
  const t = st.t;
  const near = smooth(3.2, 1.2, f.look.dist);
  st.angry = damp(st.angry ?? 0, Math.max(near, en.hp < 2 ? 0.6 : 0), 4, f.dt);
  const hurt = en.hp < 2;
  if (!f.frozen) {
    ud.wob.rotation.set(Math.sin(t * 1.7) * 0.08, Math.sin(t * 1.25) * 0.32, Math.sin(t * 2.1) * 0.09 + (hurt ? Math.sin(t * 23) * 0.04 : 0));
    const puff = 1 + Math.sin(t * 5.5) * 0.025 + st.angry * 0.06;
    ud.ball.scale.set(puff, puff * (1 - Math.sin(t * 5.5) * 0.015), puff);
  }
  const blink = blinkAmount(st, f.dt, f.frozen);
  for (const e of ud.eyes) {
    const up = mix(0.42, 0.12, st.angry);
    setLids(e, mix(up, -1.5, blink), mix(-0.95, -0.7, st.angry));
    e.slant.rotation.z = e.side * mix(0.12, 0.32, st.angry);
  }
  lookEyes(ud.eyes, st, f, 0.5, 0.35);
  ud.band.visible = hurt;
  ud.halo.material.opacity = f.frozen ? 0 : hurt ? 0.25 + Math.sin(t * 18) * 0.15 : 0.12;
  if (!f.flash) ud.body.scale.setScalar(1);
}

// ================================================================================================
// 4. CHASER — "robo-eye": a chrome camera-bot on four pattering legs with one big lens (aperture
//    iris that dilates and turns red when it spots Pogo), a lens hood brow, hazard-striped ear caps
//    and a springy antenna. Three hits to scrap.
// ================================================================================================
const CH_LENS_Z = 0.176;
function chaserHeadSDF(x, y, z) {
  const ax = Math.abs(x);
  let d = sdEllipsoid(x, y, z, 0, 0, 0, 0.168, 0.158, 0.158);
  d = smin(d, sdCyl(x, y, z, 'z', 0, 0.006, 0.125, 0.112, 0.058, 0.022), 0.03); // lens housing
  d = ssub(d, sdCyl(x, y, z, 'z', 0, 0.006, CH_LENS_Z + 0.045, 0.086, 0.045, 0.004), 0.006); // recess
  // lens hood: an arched brow over the lens that dips in the middle (scowl)
  const hood = Math.max(Math.abs(Math.hypot(x, y - 0.006) - 0.122) - 0.012, Math.abs(z - 0.17) - 0.045, 0.035 - y - Math.abs(x) * 0.25);
  d = smin(d, hood, 0.012);
  d = smin(d, sdCyl(ax, y, z, 'x', 0.158, -0.005, -0.012, 0.064, 0.024, 0.012), 0.022); // ear caps
  d = smin(d, sdCyl(x, y, z, 'y', 0, 0.152, -0.03, 0.03, 0.022, 0.01), 0.02); // antenna socket
  d = ssub(d, Math.max(Math.abs(y + 0.04) - 0.006, 0.145 - Math.hypot(x, y, z)), 0.004); // panel seam
  // vents on the back
  for (const vy of [0.02, 0.055]) d = ssub(d, sdCapsule(x, y, z, -0.05, vy, -0.17, 0.05, vy, -0.17, 0.009), 0.006);
  return d;
}
function chaserLegSDF(x, y, z) {
  let d = sdSphere(x, y, z, 0, 0, 0, 0.032);
  d = smin(d, sdCapsule(x, y, z, 0, 0, 0, 0, -0.07, 0.012, 0.021), 0.014);
  d = smin(d, sdEllipsoid(x, y, z, 0, -0.088, 0.018, 0.036, 0.021, 0.05), 0.02);
  return Math.max(d, -(y + 0.104));
}
function lensTex() {
  return cached('tex:lens', () =>
    canvasTex(256, 256, (ctx) => {
      const c = 128;
      const g = ctx.createRadialGradient(c, c, 0, c, c, 128);
      g.addColorStop(0, '#ffffff');
      g.addColorStop(0.35, '#f1f5f9');
      g.addColorStop(0.7, '#94a3b8');
      g.addColorStop(0.92, '#334155');
      g.addColorStop(1, '#0f172a');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 256, 256);
      ctx.strokeStyle = 'rgba(15,23,42,0.75)';
      for (const [r, w] of [
        [44, 3],
        [78, 2],
        [104, 4],
      ]) {
        ctx.lineWidth = w;
        ctx.beginPath();
        ctx.arc(c, c, r, 0, TWO_PI);
        ctx.stroke();
      }
      // aperture blades
      ctx.strokeStyle = 'rgba(15,23,42,0.55)';
      ctx.lineWidth = 3;
      for (let i = 0; i < 7; i++) {
        const a = (i / 7) * TWO_PI;
        ctx.beginPath();
        ctx.moveTo(c + Math.cos(a) * 40, c + Math.sin(a) * 40);
        ctx.quadraticCurveTo(c + Math.cos(a + 0.5) * 70, c + Math.sin(a + 0.5) * 70, c + Math.cos(a + 1.1) * 100, c + Math.sin(a + 1.1) * 100);
        ctx.stroke();
      }
      // scale ticks on the outer ring
      ctx.strokeStyle = 'rgba(255,255,255,0.55)';
      ctx.lineWidth = 2;
      for (let i = 0; i < 36; i++) {
        const a = (i / 36) * TWO_PI;
        ctx.beginPath();
        ctx.moveTo(c + Math.cos(a) * 110, c + Math.sin(a) * 110);
        ctx.lineTo(c + Math.cos(a) * (i % 3 ? 116 : 122), c + Math.sin(a) * (i % 3 ? 116 : 122));
        ctx.stroke();
      }
    })
  );
}
function buildChaser(g, body, ud, env) {
  const headGeo = sculpt('chaserHead', chaserHeadSDF, [-0.21, -0.18, -0.2], [0.21, 0.2, 0.25], 0.012, (x, y, z, c) => {
    const ax = Math.abs(x);
    const r = Math.hypot(x, y - 0.006);
    // lens housing + hood: dark gunmetal
    if (z > 0.075 && r < 0.14) {
      c.set('#273449');
      if (r > 0.118 && y > 0.03) c.set('#facc15');
      return r > 0.118 && y > 0.03 ? 0 : 0.9;
    }
    if (ax > 0.15) {
      // hazard-striped ear caps
      const stripe = Math.sin((y + z) * 52) > 0;
      c.set(Math.hypot(y + 0.005, z + 0.012) < 0.028 ? '#94a3b8' : stripe ? '#facc15' : '#111827');
      return Math.hypot(y + 0.005, z + 0.012) < 0.028 ? 1 : 0;
    }
    if (y > 0.14 && Math.hypot(x, z + 0.03) < 0.04) {
      c.set('#fbbf24');
      return 1;
    }
    c.set(y > -0.035 ? '#f1f5f9' : '#64748b');
    if (Math.abs(y + 0.04) < 0.008) c.set('#0b1020');
    if (z < -0.13 && Math.abs(x) < 0.07 && (Math.abs(y - 0.02) < 0.012 || Math.abs(y - 0.055) < 0.012)) c.set('#0b1020');
    return 1;
  });
  const legGeo = cached('geo:chaserLegs', () => {
    const one = sculpt('chaserLeg', chaserLegSDF, [-0.05, -0.12, -0.045], [0.05, 0.045, 0.08], 0.0095, (x, y, z, c) => {
      c.set(y > -0.02 ? '#fbbf24' : y < -0.09 ? '#f97316' : '#334155');
      return y < -0.09 ? 0 : 1;
    }, { hullCell: 0 });
    const mk = (pairs) =>
      mergeGeometries(
        pairs.map(([px, pz]) => {
          const c = one.clone();
          c.translate(px, 0, pz);
          return c;
        })
      );
    return [
      mk([
        [-0.095, 0.065],
        [0.095, -0.065],
      ]),
      mk([
        [0.095, 0.065],
        [-0.095, -0.065],
      ]),
    ];
  });
  const metal = { vertexColors: true, metalness: 1, roughness: 0.18, envMap: env.chromeEnv, envMapIntensity: 1.2, clearcoat: 0.7, clearcoatRoughness: 0.1 };
  const headMat = physical(ud, metal, { metalMask: true, paintRough: 0.3, rimStrength: 0.3 });
  const legMat = physical(ud, { ...metal, roughness: 0.3 }, { metalMask: true, paintRough: 0.45, rimStrength: 0.2 });
  const scaler = new THREE.Group(); // 12% larger, scaled about the feet
  scaler.scale.setScalar(1.12);
  scaler.position.y = GROUND * (1 - 1.12);
  body.add(scaler);
  const hip = new THREE.Group(); // bobbing chassis (legs stay planted)
  scaler.add(hip);
  const head = new THREE.Group();
  head.position.set(0, 0.035, 0);
  hip.add(head);
  const shell = new THREE.Mesh(headGeo, headMat);
  head.add(shell);
  addOutline(shell, 0.011);
  const legs = legGeo.map((lg) => {
    const m = new THREE.Mesh(lg, legMat);
    m.position.y = GROUND + 0.104;
    scaler.add(m);
    return m;
  });
  // the lens
  const lens = new THREE.Group();
  lens.position.set(0, 0.006, CH_LENS_Z);
  head.add(lens);
  const irisMat = basic('#22d3ee', { map: lensTex() });
  const iris = new THREE.Mesh(cached('geo:chIris', () => new THREE.CircleGeometry(0.084, 40)), irisMat);
  lens.add(iris);
  const pupil = new THREE.Mesh(cached('geo:chPupil', () => new THREE.CircleGeometry(0.027, 28)), basic('#05070d'));
  pupil.position.z = 0.002;
  lens.add(pupil);
  const glass = new THREE.Mesh(
    cached('geo:chGlass', () => {
      const s = new THREE.SphereGeometry(0.088, 28, 10, 0, TWO_PI, 0, 0.75);
      s.rotateX(Math.PI / 2);
      s.scale(1, 1, 0.55);
      s.translate(0, 0, -0.035);
      return s;
    }),
    new THREE.MeshPhysicalMaterial({ color: '#cbd5e1', roughness: 0.02, metalness: 0, clearcoat: 1, transparent: true, opacity: 0.18, envMap: env.chromeEnv, envMapIntensity: 2.2, depthWrite: false })
  );
  lens.add(glass);
  const glint = new THREE.Mesh(cached('geo:chGlint', () => new THREE.SphereGeometry(0.014, 10, 8)), GLINT_MAT);
  glint.position.set(-0.03, 0.032, 0.022);
  glint.scale.set(1.3, 1, 0.4);
  glint.userData.noShadow = true;
  lens.add(glint);
  // antenna on a spring
  const ant = new THREE.Group();
  ant.position.set(0, 0.168, -0.03);
  head.add(ant);
  const stalk = new THREE.Mesh(
    cached('geo:chStalk', () => {
      const c = new THREE.CylinderGeometry(0.0065, 0.009, 0.12, 6);
      c.translate(0, 0.06, 0);
      return c;
    }),
    legMat
  );
  ant.add(stalk);
  const bulbMat = basic(C('#22d3ee').multiplyScalar(1.8));
  const bulb = new THREE.Mesh(cached('geo:chBulb', () => new THREE.SphereGeometry(0.025, 14, 10)), bulbMat);
  bulb.position.y = 0.128;
  bulb.userData.noShadow = true;
  ant.add(bulb);
  const alert = new THREE.Sprite(new THREE.SpriteMaterial({ map: exclaimTex(), transparent: true, depthWrite: false }));
  alert.scale.setScalar(0.2);
  alert.position.set(0, 0.5, 0);
  alert.visible = false;
  g.add(alert);
  const halo = additiveSprite(env.dot, '#22d3ee', 0.42, 0.35);
  halo.position.set(0, 0.04, 0.24);
  head.add(halo);
  Object.assign(ud, { hip, head, shell, legs, lens, iris, irisMat, pupil, ant, bulb, bulbMat, alert, halo, popColor: '#e2e8f0' });
}
const CYAN = C('#22d3ee');
const RED = C('#ff2d2d');
function animChaser(g, ud, en, st, ctx, f) {
  const a = clamp(en.alert || 0, 0, 1);
  st.alertS = f.frozen ? st.alertS ?? 0 : damp(st.alertS ?? 0, a, 10, f.dt);
  const A = st.alertS;
  if (!f.frozen) st.step = (st.step || 0) + f.dt * (11 + A * 13);
  const ph = st.step || 0;
  const s = Math.sin(ph);
  ud.legs[0].position.set(0, GROUND + 0.104 + Math.max(0, s) * 0.03, Math.cos(ph) * 0.022);
  ud.legs[1].position.set(0, GROUND + 0.104 + Math.max(0, -s) * 0.03, -Math.cos(ph) * 0.022);
  ud.hip.position.y = Math.abs(s) * 0.012 - A * 0.012;
  ud.hip.rotation.x = A * 0.2 + (f.frozen ? 0 : Math.sin(ph * 2) * 0.02);
  ud.hip.rotation.z = Math.sin(ph) * 0.035;
  // head pans toward Pogo; jitters when alert
  const yaw = clamp(f.look.yaw, -0.6, 0.6) * 0.55 + (A > 0.5 && !f.frozen ? Math.sin(st.t * 40) * 0.015 : 0);
  ud.head.rotation.y = f.frozen ? ud.head.rotation.y : damp(ud.head.rotation.y, yaw, 8, f.dt);
  ud.head.rotation.x = f.frozen ? ud.head.rotation.x : damp(ud.head.rotation.x, -clamp(f.look.pitch, -0.3, 0.3) * 0.5, 8, f.dt);
  // iris: cyan idle -> red alert, aperture dilates
  const glow = f.frozen ? 0.35 : 1.15 + A * 0.25 + Math.sin(st.t * 7) * 0.08;
  ud.irisMat.color.copy(CYAN).lerp(RED, Math.sqrt(A)).multiplyScalar(glow);
  const dil = 1 + A * 0.75 + Math.sin(st.t * 3.1) * 0.06 * (1 - A);
  ud.pupil.scale.setScalar(dil);
  ud.iris.rotation.z = st.t * (0.4 + A * 3);
  // antenna spring + bulb blink
  ud.ant.rotation.x = f.frozen ? ud.ant.rotation.x : -0.25 * A + Math.sin(ph * 2) * 0.12 + (en.hp <= 1 ? 0.5 : 0);
  ud.ant.rotation.z = f.frozen ? ud.ant.rotation.z : Math.cos(ph) * 0.12;
  const blinkOn = A > 0.3 ? Math.sin(st.t * 22) > 0 : Math.sin(st.t * 3) > 0.6;
  const spark = en.hp <= 1 && Math.sin(st.t * 37) * Math.sin(st.t * 13) > 0.4;
  ud.bulbMat.color.copy(CYAN).lerp(RED, Math.sqrt(A)).multiplyScalar(f.frozen ? 0.3 : blinkOn || spark ? 2.2 : 0.5);
  ud.halo.material.color.copy(CYAN).lerp(RED, Math.sqrt(A));
  ud.halo.material.opacity = f.frozen ? 0 : 0.25 + A * 0.4;
  ud.alert.visible = A > 0.3 && !f.frozen;
  if (ud.alert.visible) {
    const pop = smooth(0.3, 0.6, A);
    ud.alert.scale.setScalar(0.2 * pop * (1 + Math.sin(st.t * 14) * 0.08));
    ud.alert.position.y = 0.5 + Math.sin(st.t * 10) * 0.015;
  }
}


// ------------------------------------------------------------------------------------------------
// Energy shaders (plasma spheres, electric beams, fire) — unlit, animated by a per-instance clock
// ------------------------------------------------------------------------------------------------
const NOISE_GLSL = /* glsl */ `
  float hash13(vec3 p) { p = fract(p * 0.1031); p += dot(p, p.zyx + 31.32); return fract((p.x + p.y) * p.z); }
  float vnoise(vec3 p) {
    vec3 i = floor(p); vec3 f = fract(p); f = f * f * (3.0 - 2.0 * f);
    float n000 = hash13(i), n100 = hash13(i + vec3(1,0,0)), n010 = hash13(i + vec3(0,1,0)), n110 = hash13(i + vec3(1,1,0));
    float n001 = hash13(i + vec3(0,0,1)), n101 = hash13(i + vec3(1,0,1)), n011 = hash13(i + vec3(0,1,1)), n111 = hash13(i + vec3(1,1,1));
    return mix(mix(mix(n000, n100, f.x), mix(n010, n110, f.x), f.y), mix(mix(n001, n101, f.x), mix(n011, n111, f.x), f.y), f.z);
  }
  float fbm(vec3 p) { return vnoise(p) * 0.55 + vnoise(p * 2.03 + 7.1) * 0.3 + vnoise(p * 4.1 + 3.3) * 0.15; }
`;
const ENERGY_VS = /* glsl */ `
  varying vec3 vN; varying vec3 vV; varying vec3 vP; varying vec2 vUv;
  void main() {
    vP = position; vUv = uv;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vV = -mv.xyz; vN = normalMatrix * normal;
    gl_Position = projectionMatrix * mv;
  }
`;
function energyMat(kind, uniforms, { additive = false, side = THREE.FrontSide } = {}) {
  const frag = {
    // bright plasma ball: white-hot core, coloured fresnel edge, boiling noise
    plasma: `
      void main() {
        vec3 n = normalize(vN); vec3 v = normalize(vV);
        float f = 1.0 - abs(dot(n, v));
        float nz = fbm(vP * uScale + vec3(0.0, uTime * 1.7, uSeed));
        float filaments = smoothstep(0.42, 0.5, fbm(vP * uScale * 1.9 - vec3(uTime * 1.1, 0.0, uSeed)));
        vec3 col = mix(uA, uB, smoothstep(0.15, 0.95, f + (nz - 0.5) * 0.6));
        col += uA * filaments * 0.6 * (1.0 - f);
        col *= (0.85 + nz * 0.5) * uI;
        col = mix(col, vec3(1.0) * 1.6, uFlash);
        col = mix(col, vec3(0.55, 0.85, 1.0) * dot(col, vec3(0.33)), uFreeze * 0.85);
        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
    // additive fresnel corona around a plasma ball
    corona: `
      void main() {
        vec3 n = normalize(vN); vec3 v = normalize(vV);
        float f = 1.0 - abs(dot(n, v));
        float nz = fbm(vP * uScale + vec3(uTime * 0.9, -uTime * 1.3, uSeed));
        float a = pow(f, 1.6) * (0.55 + nz * 0.7) * smoothstep(1.0, 0.75, f);
        vec3 col = mix(uA, uB, f) * a * uI * (1.0 - uFreeze * 0.8);
        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
    // electric beam: bright flickering core line along v (uv.y), colour A -> B
    beam: `
      void main() {
        vec3 n = normalize(vN); vec3 v = normalize(vV);
        float facing = abs(dot(n, v));
        float flick = fbm(vec3(vUv.y * 9.0 - uTime * 14.0, uTime * 6.0, uSeed));
        float pulse = smoothstep(0.35, 0.8, fbm(vec3(vUv.y * 4.0 - uTime * 8.0, uSeed, 0.0)));
        float a = pow(facing, 1.6) * (0.5 + flick * 1.0 + pulse * 1.0);
        a *= smoothstep(0.0, 0.12, vUv.y) * smoothstep(1.0, 0.85, vUv.y);
        vec3 col = mix(uA, uB, vUv.y) * a * uI * (1.0 - uFreeze * 0.85);
        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
    // fire: hot core -> orange -> red edge, licking noise rising against travel
    fire: `
      void main() {
        vec3 n = normalize(vN); vec3 v = normalize(vV);
        float f = 1.0 - abs(dot(n, v));
        float nz = fbm(vP * uScale + vec3(uTime * 3.0, -uTime * 5.0, uSeed));
        float t = clamp(f * 1.25 + (nz - 0.5) * 0.8 + 0.12, 0.0, 1.0);
        vec3 col = mix(vec3(1.0, 0.93, 0.6), vec3(1.0, 0.55, 0.08), smoothstep(0.0, 0.3, t));
        col = mix(col, vec3(0.95, 0.2, 0.03), smoothstep(0.35, 0.8, t));
        col = mix(col, vec3(0.6, 0.06, 0.02), smoothstep(0.85, 1.0, t));
        gl_FragColor = vec4(col * uI, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
    // flame tongue: additive teardrop trailing along -X
    flame: `
      void main() {
        vec3 n = normalize(vN); vec3 v = normalize(vV);
        float f = 1.0 - abs(dot(n, v));
        float along = clamp(-vP.x / uLen, 0.0, 1.0);
        float nz = fbm(vec3(vP.x * 7.0 + uTime * 9.0, vP.y * 9.0, vP.z * 9.0 + uSeed));
        float body = pow(1.0 - f, 1.2);
        float a = body * smoothstep(0.1, 0.65, nz + (1.0 - along) * 0.55) * (1.0 - along);
        vec3 col = mix(vec3(1.0, 0.62, 0.12), vec3(0.9, 0.12, 0.02), smoothstep(0.0, 0.6, along + (1.0 - nz) * 0.3));
        gl_FragColor = vec4(col * a * uI, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
    // wind gust cone: streaks rushing out along +Z, fading at both ends
    wind: `
      void main() {
        float ang = atan(vP.x, vP.y);
        float along = vUv.y;
        float s1 = smoothstep(0.55, 0.95, vnoise(vec3(ang * 3.0, along * 3.0 - uTime * 5.5, uSeed)));
        float s2 = smoothstep(0.6, 0.98, vnoise(vec3(ang * 5.0 + 4.0, along * 5.0 - uTime * 8.0, uSeed + 2.0)));
        float a = (s1 * 0.8 + s2 * 0.6) * smoothstep(0.0, 0.12, along) * smoothstep(1.0, 0.55, along);
        gl_FragColor = vec4(uA * a * uI, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  }[kind];
  const u = Object.assign(
    { uTime: { value: 0 }, uA: { value: C('#ffffff') }, uB: { value: C('#ffffff') }, uI: { value: 1 }, uSeed: { value: Math.random() * 10 }, uScale: { value: 8 }, uFlash: { value: 0 }, uFreeze: { value: 0 }, uLen: { value: 0.5 } },
    uniforms
  );
  const m = new THREE.ShaderMaterial({
    uniforms: u,
    vertexShader: ENERGY_VS,
    fragmentShader: 'uniform float uTime; uniform vec3 uA; uniform vec3 uB; uniform float uI; uniform float uSeed; uniform float uScale; uniform float uFlash; uniform float uFreeze; uniform float uLen;\nvarying vec3 vN; varying vec3 vV; varying vec3 vP; varying vec2 vUv;\n' + NOISE_GLSL + frag,
    transparent: additive,
    depthWrite: !additive,
    blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    side,
  });
  m.toneMapped = true;
  return m;
}

// ================================================================================================
// 5. MOLECULE — a living plasma molecule: a boiling white-hot nucleus with a scowl, a crackling
//    corona, and three charged atoms (magenta / cyan / gold) on tilted orbits, tethered by
//    flickering electric bonds. Pops when shot.
// ================================================================================================
const MOL_ORBIT = 0.24;
const MOL_ORBITS = [0, 1, 2].map((i) => {
  const o = new THREE.Object3D();
  o.rotation.set(1.15, 0, (i * TWO_PI) / 3, 'ZXY');
  o.updateMatrix();
  return o.matrix.clone();
});
function buildMolecule(g, body, ud, env) {
  const spin = new THREE.Group();
  body.add(spin);
  const sph = (r, w = 32, h = 20) => cached('geo:sph:' + r + ':' + w, () => new THREE.SphereGeometry(r, w, h));
  const nucMat = energyMat('plasma', { uA: { value: C('#fff1fb') }, uB: { value: C('#e11d8f') }, uScale: { value: 16 }, uI: { value: 1.05 } });
  const nucleus = new THREE.Mesh(sph(0.118), nucMat);
  body.add(nucleus);
  const corMat = energyMat('corona', { uA: { value: C('#ff2fa0') }, uB: { value: C('#8b5cf6') }, uScale: { value: 11 }, uI: { value: 1.5 } }, { additive: true });
  const corona = new THREE.Mesh(sph(0.165), corMat);
  corona.userData.noShadow = true;
  body.add(corona);
  // scowling eyes on the nucleus
  const faceGeo = cached('geo:molFace', () => {
    const parts = [];
    for (const s of [-1, 1]) {
      const e = new THREE.SphereGeometry(0.024, 14, 10);
      e.scale(1.25, 0.66, 0.5);
      e.rotateZ(s * 0.4);
      e.translate(s * 0.04, 0.018, 0.111);
      parts.push(e);
      const b = new THREE.CapsuleGeometry(0.008, 0.03, 3, 6);
      b.rotateZ(Math.PI / 2 + s * 0.55);
      b.translate(s * 0.038, 0.056, 0.1);
      parts.push(b);
    }
    const m = new THREE.TorusGeometry(0.024, 0.006, 5, 12, Math.PI * 0.8);
    m.rotateZ(Math.PI * 0.1);
    m.translate(0, -0.047, 0.108);
    parts.push(m);
    return mergeGeometries(parts.map((p) => p.toNonIndexed()));
  });
  const face = new THREE.Mesh(faceGeo, basic('#2a0636'));
  face.userData.noShadow = true;
  body.add(face);
  const cols = [
    ['#ff1f7a', '#ff9ccb'],
    ['#00c8ff', '#9df3ff'],
    ['#ffb000', '#ffe27a'],
  ];
  const atoms = [];
  const ringGeo = cached('geo:molRings', () =>
    mergeGeometries(
      MOL_ORBITS.map((mtx) => {
        const t = new THREE.TorusGeometry(MOL_ORBIT, 0.0045, 4, 72);
        t.applyMatrix4(mtx);
        return t;
      })
    )
  );
  const rings = new THREE.Mesh(ringGeo, basic('#d8b4fe', { transparent: true, opacity: 0.45, blending: THREE.AdditiveBlending, depthWrite: false }));
  rings.userData.noShadow = true;
  spin.add(rings);
  const beamGeo = cached('geo:molBeam', () => {
    const c = new THREE.CylinderGeometry(0.036, 0.036, 1, 10, 1, true);
    c.translate(0, 0.5, 0);
    return c;
  });
  for (let i = 0; i < 3; i++) {
    const orbit = new THREE.Group();
    orbit.matrixAutoUpdate = false;
    orbit.matrix.copy(MOL_ORBITS[i]);
    spin.add(orbit);
    const atom = new THREE.Mesh(
      sph(0.064, 24, 16),
      energyMat('plasma', { uA: { value: C(cols[i][0]) }, uB: { value: C(cols[i][1]) }, uScale: { value: 22 }, uI: { value: 1.0 } })
    );
    const beam = new THREE.Mesh(beamGeo, energyMat('beam', { uA: { value: C('#ff7ad1') }, uB: { value: C(cols[i][0]) }, uI: { value: 1.6 } }, { additive: true }));
    beam.userData.noShadow = true;
    atom.userData.noShadow = true;
    orbit.add(atom, beam);
    atoms.push({ atom, beam, phase: (i * TWO_PI) / 3, speed: 1 + i * 0.18 });
  }
  const halo = additiveSprite(env.dot, '#db2777', 0.9, 0.4);
  body.add(halo);
  const shaderMats = [nucMat, corMat, ...atoms.flatMap((a) => [a.atom.material, a.beam.material])];
  Object.assign(ud, { spin, nucleus, corona, face, atoms, halo, shaderMats, popColor: '#f9a8d4', ownsBodyScale: false });
}
function animMolecule(g, ud, en, st, ctx, f) {
  const t = st.t;
  const dir = en.dir < 0 ? -1 : 1;
  for (const m of ud.shaderMats) {
    m.uniforms.uTime.value = t;
    m.uniforms.uFlash.value = f.flash;
    m.uniforms.uFreeze.value = st.freeze;
  }
  ud.spin.rotation.y = t * 0.6 * dir;
  ud.spin.rotation.x = Math.sin(t * 0.7) * 0.25;
  for (const a of ud.atoms) {
    const ang = a.phase + t * 3.6 * a.speed * dir;
    const x = Math.cos(ang) * MOL_ORBIT;
    const y = Math.sin(ang) * MOL_ORBIT;
    a.atom.position.set(x, y, 0);
    a.beam.rotation.z = ang - Math.PI / 2;
    a.beam.scale.set(1, MOL_ORBIT - 0.05, 1);
    a.beam.position.set(Math.cos(ang) * 0.06, Math.sin(ang) * 0.06, 0);
    const pulse = 1 + Math.sin(t * 9 + a.phase * 3) * 0.08;
    a.atom.scale.setScalar(pulse);
  }
  const breathe = 1 + Math.sin(t * 6) * 0.05;
  ud.nucleus.scale.setScalar(breathe);
  ud.face.scale.setScalar(breathe);
  // the nucleus glares toward Pogo
  if (!f.frozen) {
    st.lookX = damp(st.lookX, clamp(f.look.yaw, -0.6, 0.6), 6, f.dt);
    st.lookY = damp(st.lookY, clamp(f.look.pitch, -0.4, 0.4), 6, f.dt);
  }
  ud.face.rotation.set(-st.lookY, st.lookX, 0, 'YXZ');
  ud.corona.scale.setScalar(1 + Math.sin(t * 11) * 0.04);
  ud.halo.material.opacity = f.frozen ? 0.06 : 0.32 + Math.sin(t * 7) * 0.08;
}

// ================================================================================================
// 6. FIREBALL — the guardian's spit: a boiling fire core with a furious little face, an additive
//    flame tongue streaming behind it, and a trail of embers.
// ================================================================================================
function buildFireball(g, body, ud, env) {
  const core = new THREE.Mesh(
    cached('geo:fbCore', () => new THREE.SphereGeometry(0.13, 32, 20)),
    energyMat('fire', { uScale: { value: 13 }, uI: { value: 0.95 } })
  );
  core.userData.noShadow = true;
  body.add(core);
  const flameGeo = cached('geo:fbFlame', () => {
    const s = new THREE.SphereGeometry(0.17, 36, 18);
    const p = s.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i);
      if (x < 0) {
        const k = -x / 0.17;
        p.setX(i, x * (1 + 1.9 * k * k));
        p.setY(i, p.getY(i) * (1 - 0.55 * k));
        p.setZ(i, p.getZ(i) * (1 - 0.55 * k));
      }
    }
    s.computeVertexNormals();
    return s;
  });
  const flameMat = energyMat('flame', { uLen: { value: 0.5 }, uI: { value: 1.0 } }, { additive: true });
  const flamePivot = new THREE.Group();
  body.add(flamePivot);
  const flame = new THREE.Mesh(flameGeo, flameMat);
  flame.userData.noShadow = true;
  flamePivot.add(flame);
  const outerMat = energyMat('flame', { uLen: { value: 0.6 }, uI: { value: 0.55 }, uSeed: { value: 3.3 } }, { additive: true });
  const outer = new THREE.Mesh(flameGeo, outerMat);
  outer.scale.set(1.25, 1.35, 1.35);
  outer.userData.noShadow = true;
  flamePivot.add(outer);
  const faceGeo = cached('geo:fbFace', () => {
    const parts = [];
    for (const s of [-1, 1]) {
      const e = new THREE.SphereGeometry(0.026, 14, 10);
      e.scale(1.2, 0.55, 0.5);
      e.rotateZ(s * 0.5);
      e.translate(s * 0.042, 0.018, 0.12);
      parts.push(e);
    }
    const m = new THREE.SphereGeometry(0.03, 14, 10);
    m.scale(1.3, 0.55, 0.45);
    m.translate(0, -0.045, 0.118);
    parts.push(m);
    return mergeGeometries(parts);
  });
  const face = new THREE.Mesh(faceGeo, basic('#3a0a02'));
  face.userData.noShadow = true;
  body.add(face);
  const trail = [];
  for (let i = 0; i < 6; i++) {
    const sp = additiveSprite(env.dot, i < 2 ? '#ff9a2e' : i < 4 ? '#f2541b' : '#b91c1c', 0.24 - i * 0.03, 0.55 - i * 0.07);
    g.add(sp);
    trail.push(sp);
  }
  const halo = additiveSprite(env.dot, '#ff6a00', 0.8, 0.45);
  body.add(halo);
  Object.assign(ud, { core, flame, flamePivot, face, trail, halo, shaderMats: [core.material, flameMat, outerMat], popColor: '#fdba74', eyeHeight: 0 });
}
function animFireball(g, ud, en, st, ctx, f) {
  const t = st.t;
  for (const m of ud.shaderMats) m.uniforms.uTime.value = t;
  // travel direction in the group's frame: along the tower (+X = increasing col) and up/down
  const dir = en.dir < 0 ? -1 : 1;
  const vy = f.dt > 0 && st.prevFloor != null ? (en.floor - st.prevFloor) / f.dt : 0;
  st.prevFloor = en.floor;
  st.vy = damp(st.vy ?? 0, vy, 6, f.dt);
  const ang = Math.atan2(clamp(st.vy, -2, 2) * 0.35, dir * 1.0);
  ud.flamePivot.rotation.z = ang;
  const flick = 1 + Math.sin(t * 31) * 0.06 + Math.sin(t * 17) * 0.05;
  ud.flame.scale.set(flick, 1, 1);
  ud.core.scale.setScalar(1 + Math.sin(t * 23) * 0.04);
  ud.core.rotation.set(t * 2, t * 3, 0);
  ud.halo.material.opacity = 0.4 + Math.sin(t * 30) * 0.1;
  // face glares toward travel
  ud.face.rotation.set(0, dir * 0.35, 0);
  const cx = Math.cos(ang);
  const cy = Math.sin(ang);
  ud.trail.forEach((sp, k) => {
    const d = 0.16 + k * 0.11;
    const wob = Math.sin(t * 20 + k * 1.7) * 0.02 * (k + 1) * 0.5;
    sp.position.set(-cx * d - cy * wob, -cy * d + cx * wob, -0.02);
    const life = (t * 6 + k * 0.37) % 1;
    sp.material.opacity = (0.55 - k * 0.08) * (0.8 + Math.sin(life * Math.PI) * 0.2);
  });
}

// ================================================================================================
// 7. EYE — floating bloodshot eye in a leathery hooded skull-cap with little horns, a devil tail and
//    two bat wings; blinking lids; slit pupil that tracks Pogo. INVULNERABLE (dodge it).
// ================================================================================================
const EYE_R = 0.158;
const EYE_C = [0, 0.02, 0.035];
function eyeHoodSDF(x, y, z) {
  const ax = Math.abs(x);
  let d = smax(sdSphere(x, y, z, 0, 0.02, -0.01, 0.182), z - 0.01, 0.03);
  d = smin(d, sdSphere(x, y, z, 0, 0.03, -0.06, 0.15), 0.04); // skull back
  // curled horns
  d = smin(d, sdRoundCone(ax, y, z, 0.075, 0.15, -0.02, 0.135, 0.245, -0.05, 0.034, 0.018), 0.025);
  d = smin(d, sdRoundCone(ax, y, z, 0.135, 0.245, -0.05, 0.13, 0.31, -0.02, 0.018, 0.004), 0.012);
  // shoulder knobs where the wings attach
  d = smin(d, sdSphere(ax, y, z, 0.158, 0.05, -0.07, 0.04), 0.03);
  // devil tail with a spade tip
  d = smin(d, sdRoundCone(x, y, z, 0, -0.1, -0.13, 0, -0.2, -0.2, 0.03, 0.014), 0.03);
  d = smin(d, sdRoundCone(x, y, z, 0, -0.2, -0.2, 0.0, -0.255, -0.17, 0.014, 0.01), 0.015);
  d = smin(d, sdEllipsoid(x, y, z, 0, -0.272, -0.15, 0.03, 0.03, 0.012), 0.012);
  return d;
}
function wingTex() {
  return cached('tex:wing', () =>
    canvasTex(256, 256, (ctx) => {
      // wing space: shoulder at (8, 128); x to the right is outward, y up = canvas up
      const P = (x, y) => [8 + x * 600, 128 - y * 600];
      const wrist = [0.15, 0.13];
      const tips = [
        [0.37, 0.165],
        [0.39, 0.02],
        [0.3, -0.11],
      ];
      ctx.clearRect(0, 0, 256, 256);
      // membrane with scalloped trailing edge
      ctx.beginPath();
      ctx.moveTo(...P(0, 0.03));
      ctx.lineTo(...P(...wrist));
      ctx.lineTo(...P(...tips[0]));
      ctx.quadraticCurveTo(...P(0.3, 0.085), ...P(...tips[1]));
      ctx.quadraticCurveTo(...P(0.29, -0.025), ...P(...tips[2]));
      ctx.quadraticCurveTo(...P(0.17, -0.04), ...P(0.03, -0.075));
      ctx.closePath();
      const g = ctx.createRadialGradient(...P(0.12, 0.05), 6, ...P(0.12, 0.05), 160);
      g.addColorStop(0, '#7c3aed');
      g.addColorStop(0.5, '#6d28d9');
      g.addColorStop(1, '#c084fc');
      ctx.fillStyle = g;
      ctx.fill();
      ctx.save();
      ctx.clip();
      // veins
      ctx.strokeStyle = 'rgba(46,16,101,0.45)';
      ctx.lineWidth = 1.5;
      for (let i = 0; i < 14; i++) {
        const a = -1.2 + i * 0.16;
        ctx.beginPath();
        ctx.moveTo(...P(...wrist));
        ctx.quadraticCurveTo(...P(wrist[0] + Math.cos(a) * 0.08, wrist[1] + Math.sin(a) * 0.08 - 0.02), ...P(wrist[0] + Math.cos(a) * 0.22, wrist[1] + Math.sin(a) * 0.22));
        ctx.stroke();
      }
      // darker trailing-edge rim
      ctx.lineWidth = 7;
      ctx.strokeStyle = 'rgba(46,16,101,0.6)';
      ctx.stroke();
      ctx.restore();
      // bones
      ctx.strokeStyle = '#2e1065';
      ctx.lineCap = 'round';
      ctx.lineWidth = 11;
      ctx.beginPath();
      ctx.moveTo(...P(0, 0.03));
      ctx.lineTo(...P(...wrist));
      ctx.stroke();
      ctx.lineWidth = 6;
      for (const tp of tips) {
        ctx.beginPath();
        ctx.moveTo(...P(...wrist));
        ctx.lineTo(...P(...tp));
        ctx.stroke();
      }
      // thumb claw
      ctx.fillStyle = '#fde68a';
      ctx.beginPath();
      ctx.moveTo(...P(wrist[0] - 0.01, wrist[1] + 0.005));
      ctx.lineTo(...P(wrist[0] + 0.0, wrist[1] + 0.05));
      ctx.lineTo(...P(wrist[0] + 0.02, wrist[1] + 0.005));
      ctx.fill();
    })
  );
}
function wingGeo() {
  return cached('geo:wing', () => {
    // canvas spans 256px = 256/600 units; shoulder at px (8, 128)
    const S = 256 / 600;
    const g = new THREE.PlaneGeometry(S, S, 16, 16);
    g.translate(S / 2 - 8 / 600, 0, 0);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i);
      const y = p.getY(i);
      p.setZ(i, -x * x * 0.9 - Math.abs(y) * x * 0.25);
    }
    g.computeVertexNormals();
    return g;
  });
}
function buildEye(g, body, ud, env) {
  const hoodGeo = sculpt('eyeHood', eyeHoodSDF, [-0.24, -0.3, -0.27], [0.24, 0.34, 0.1], 0.0125, (x, y, z, c) => {
    const ax = Math.abs(x);
    c.set('#5b21b6');
    c.lerp(C('#2e1065'), smooth(0.0, -0.18, y) * 0.5);
    // leathery mottling
    const n = Math.sin(x * 60) * Math.sin(y * 55 + 1) * Math.sin(z * 50 + 2);
    c.multiplyScalar(0.9 + n * 0.12);
    // horns: bone with dark tips
    const horn = Math.min(
      sdRoundCone(ax, y, z, 0.075, 0.15, -0.02, 0.135, 0.245, -0.05, 0.034, 0.018),
      sdRoundCone(ax, y, z, 0.135, 0.245, -0.05, 0.13, 0.31, -0.02, 0.018, 0.004)
    );
    if (horn < 0.004 && y > 0.16) {
      c.set('#fde68a');
      c.lerp(C('#451a03'), smooth(0.25, 0.31, y));
    }
    // rim of the hood around the eye: darker
    if (z > -0.02 && y > -0.15 && y < 0.2) c.lerp(C('#1e0b45'), smooth(-0.03, 0.01, z) * 0.6);
    if (y < -0.24) c.set('#2e1065');
    return 0;
  });
  const leather = physical(ud, { vertexColors: true, roughness: 0.55, clearcoat: 0.35, clearcoatRoughness: 0.4, sheen: 0.4, sheenColor: C('#c4b5fd') }, { rim: '#e9d5ff', rimStrength: 0.35 });
  const float = new THREE.Group();
  body.add(float);
  const hood = new THREE.Mesh(hoodGeo, leather);
  float.add(hood);
  addOutline(hood, 0.011);
  const tex = eyeTexture({
    key: 'batEye',
    sclera: ['#fffbeb', '#fde7e7', '#f0a3a3'],
    iris: [
      [0, '#f7fee7'],
      [0.35, '#bef264'],
      [0.75, '#65a30d'],
      [1, '#1a2e05'],
    ],
    irisR: 44,
    fibre: 'rgba(26,46,5,0.45)',
    limbal: '#0f1a03',
    pupil: 'slit',
    pupilW: 8,
    pupilH: 38,
    veins: 22,
    veinColor: 'rgba(205,18,45,0.85)',
    glow: true,
  });
  const eyeMat = reg(ud, eyeMaterial(tex, '#a3e635', 0.45));
  const lidMat = physical(ud, { color: '#8b5cf6', roughness: 0.45, clearcoat: 0.5, sheen: 0.4, sheenColor: C('#ddd6fe') }, { rim: '#e9d5ff', rimStrength: 0.3 });
  const eye = makeEye(float, { x: 0, y: EYE_C[1], z: EYE_C[2], r: EYE_R, mat: eyeMat, lidMat, lower: true, lidR: 1.06, lash: basic('#1e0b45') });
  eye.side = 1;
  // Like the 1987 flying eye, the EYEBALL must read first at phone size: a bigger eye pushed
  // forward, with the hood shrunk back to a brow-and-horns frame behind it
  eye.eg.scale.setScalar(1.3);
  eye.eg.position.z += 0.05;
  hood.scale.setScalar(0.82);
  hood.position.z = -0.05;
  addOutline(eye.ball, 0.009);
  const glints = new THREE.Mesh(
    glintGeo('batEye', [
      [-0.05, EYE_C[1] + 0.06, EYE_C[2] + 0.14, 0.022],
      [0.035, EYE_C[1] - 0.035, EYE_C[2] + 0.152, 0.011],
    ]),
    GLINT_MAT
  );
  glints.userData.noShadow = true;
  // same transform as the enlarged eyeball (scale 1.3 about the eye centre, +0.05 forward)
  glints.scale.setScalar(1.3);
  glints.position.set(0, EYE_C[1] - EYE_C[1] * 1.3, EYE_C[2] + 0.05 - EYE_C[2] * 1.3);
  float.add(glints);
  const wMat = physical(
    ud,
    { map: wingTex(), alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.6, sheen: 0.5, sheenColor: C('#e9d5ff'), emissive: '#7c3aed', emissiveIntensity: 0.25, emissiveMap: wingTex() },
    { rim: '#f5d0fe', rimStrength: 0.3 }
  );
  const wings = [-1, 1].map((s) => {
    const pivot = new THREE.Group();
    pivot.position.set(s * 0.16, 0.06, -0.075);
    const w = new THREE.Mesh(wingGeo(), wMat);
    w.scale.x = s;
    w.castShadow = true;
    pivot.add(w);
    float.add(pivot);
    return pivot;
  });
  const halo = additiveSprite(env.dot, '#a855f7', 1.0, 0.3);
  halo.position.z = -0.1;
  body.add(halo);
  Object.assign(ud, { float, hood, eye, wings, halo, popColor: '#c4b5fd' });
}
function animEye(g, ud, en, st, ctx, f) {
  const t = st.t;
  // flap: quick downstroke, slower recovery; the body bobs against each stroke
  const ph = t * 9.5 + st.seed * 6;
  const flap = Math.sin(ph) + 0.25 * Math.sin(ph * 2);
  for (const [i, w] of ud.wings.entries()) {
    const s = i === 0 ? -1 : 1;
    if (f.frozen) {
      w.rotation.set(0, s * 0.9, s * -0.35); // folded against the body inside the ice
    } else {
      w.rotation.set(0, s * (0.25 - flap * 0.12), s * (0.15 + flap * 0.55));
    }
  }
  ud.float.position.y = f.frozen ? ud.float.position.y : -Math.sin(ph) * 0.018;
  ud.float.rotation.z = f.frozen ? ud.float.rotation.z : Math.sin(t * 1.3) * 0.07;
  const blink = blinkAmount(st, f.dt, f.frozen);
  const glare = smooth(4, 1.5, f.look.dist);
  setLids(ud.eye, mix(mix(0.95, 0.62, glare), -0.25, blink), mix(mix(-0.95, -0.78, glare), -0.25, blink));
  lookEyes([ud.eye], st, f, 0.65, 0.5);
  ud.halo.material.opacity = f.frozen ? 0.05 : 0.22 + glare * 0.15;
}


// Mirror a geometry across X (fixes winding and normals)
function mirrorX(geo) {
  const g = geo.clone();
  g.scale(-1, 1, 1);
  const idx = g.index;
  if (idx) {
    const a = idx.array;
    for (let i = 0; i < a.length; i += 3) {
      const t = a[i + 1];
      a[i + 1] = a[i + 2];
      a[i + 2] = t;
    }
  }
  return g;
}
// Emissive glow follows the vertex paint (for glowing creature parts)
function emissiveFromColor(mat) {
  const prev = mat.onBeforeCompile;
  mat.onBeforeCompile = (sh, r) => {
    prev(sh, r);
    sh.fragmentShader = sh.fragmentShader.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n#ifdef USE_COLOR\ntotalEmissiveRadiance *= vColor.rgb;\n#endif');
  };
  const key = mat.customProgramCacheKey();
  mat.customProgramCacheKey = () => key + '-emc';
  return mat;
}
// Fan-shaped fin / membrane texture with alpha (rays from the root at the left-middle)
function finTex(key, base, edge, ray) {
  return cached('tex:fin:' + key, () =>
    canvasTex(128, 128, (ctx) => {
      ctx.clearRect(0, 0, 128, 128);
      const o = [6, 64];
      ctx.beginPath();
      ctx.moveTo(o[0], o[1] - 14);
      const n = 6;
      for (let i = 0; i <= n; i++) {
        const a = -0.95 + (i / n) * 1.9;
        const r = 112;
        const px = o[0] + Math.cos(a) * r;
        const py = o[1] + Math.sin(a) * r;
        if (i === 0) ctx.lineTo(px, py);
        else {
          const am = a - 0.95 / n;
          ctx.quadraticCurveTo(o[0] + Math.cos(am) * r * 0.82, o[1] + Math.sin(am) * r * 0.82, px, py);
        }
      }
      ctx.lineTo(o[0], o[1] + 14);
      ctx.closePath();
      const g = ctx.createRadialGradient(o[0], o[1], 4, o[0], o[1], 118);
      g.addColorStop(0, base);
      g.addColorStop(1, edge);
      ctx.fillStyle = g;
      ctx.fill();
      ctx.save();
      ctx.clip();
      ctx.strokeStyle = ray;
      ctx.lineWidth = 3.5;
      for (let i = 0; i <= 12; i++) {
        const a = -0.95 + (i / 12) * 1.9;
        ctx.beginPath();
        ctx.moveTo(o[0], o[1]);
        ctx.lineTo(o[0] + Math.cos(a) * 120, o[1] + Math.sin(a) * 120);
        ctx.stroke();
      }
      ctx.restore();
    })
  );
}
function finGeo(key, w, h, curl = 0.3) {
  return cached('geo:fin:' + key, () => {
    const g = new THREE.PlaneGeometry(w, h, 8, 8);
    g.translate(w / 2 - (w * 6) / 128, 0, 0);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i);
      p.setZ(i, Math.sin((p.getY(i) / h) * Math.PI) * x * curl * 0.3);
    }
    g.computeVertexNormals();
    return g;
  });
}

// ================================================================================================
// 8. SHIELDBUG — a rhino beetle that carries an iridescent, gold-rimmed riot shield on its FRONT
//    (snowballs ding off it) and has a soft, glowing firefly abdomen at its BACK (the weak spot).
//    Eyes on stalks peek over the shield. Charged shots crack the shield.
// ================================================================================================
const SB_CS = [0, -0.012, -0.22];
const SB_RS = 0.45;
function sbShieldDist(x, y, z) {
  const l = Math.hypot(x - SB_CS[0], y - SB_CS[1], z - SB_CS[2]);
  const e = (Math.hypot(x / 0.2, (y - SB_CS[1]) / 0.212) - 1) * 0.2;
  return { l, e };
}
function shieldbugSDF(x, y, z) {
  const ax = Math.abs(x);
  const { l, e } = sbShieldDist(x, y, z);
  let d = smax(Math.abs(l - SB_RS) - 0.02, e, 0.018);
  d = smin(d, Math.hypot(e + 0.013, l - SB_RS - 0.018) - 0.017, 0.008); // rim bead
  d = smin(d, sdSphere(x, y, z, 0, -0.03, SB_CS[2] + SB_RS + 0.004, 0.05), 0.03); // boss
  // rhino horn rising from the top of the shield
  d = smin(d, sdRoundCone(x, y, z, 0, 0.13, 0.19, 0, 0.25, 0.25, 0.042, 0.022), 0.03);
  d = smin(d, sdRoundCone(x, y, z, 0, 0.25, 0.25, 0, 0.31, 0.2, 0.022, 0.006), 0.015);
  // thorax / elytra dome behind the shield
  let body = sdEllipsoid(x, y, z, 0, -0.03, -0.02, 0.17, 0.15, 0.2);
  body = smax(body, -(y + 0.16), 0.03);
  body = ssub(body, Math.max(Math.abs(x) - 0.005, 0.12 - Math.hypot(x, y + 0.03, (z + 0.02) * 0.85), z - 0.12), 0.006); // elytra seam
  d = smin(d, body, 0.02);
  // head + eye stalks peeking over the shield
  d = smin(d, sdEllipsoid(x, y, z, 0, 0.06, 0.1, 0.1, 0.08, 0.08), 0.03);
  d = smin(d, sdRoundCone(ax, y, z, 0.05, 0.1, 0.12, 0.1, 0.22, 0.17, 0.028, 0.02), 0.02);
  return d;
}
function sbAbdomenSDF(x, y, z) {
  let d = sdEllipsoid(x, y, z, 0, -0.045, -0.2, 0.15, 0.14, 0.155);
  d -= 0.008 * Math.max(0, Math.cos((z + 0.2) * 48));
  return smax(d, -(y + 0.17), 0.02);
}
function sbLegSDF(x, y, z) {
  let d = sdCapsule(x, y, z, 0, 0, 0, 0.085, 0.04, 0.02, 0.024);
  d = smin(d, sdCapsule(x, y, z, 0.085, 0.04, 0.02, 0.118, -0.102, 0.04, 0.018), 0.014);
  d = smin(d, sdSphere(x, y, z, 0.12, -0.104, 0.042, 0.021), 0.012);
  return Math.max(d, -(y + 0.124));
}
const SB_EYE = { x: 0.105, y: 0.245, z: 0.17, r: 0.05 };
function sbCrackGeo() {
  return cached('geo:sbCracks', () => {
    const rand = rng(17);
    const pos = [];
    const surf = (x, y) => {
      const zz = Math.sqrt(Math.max(0, (SB_RS + 0.026) ** 2 - x * x - (y - SB_CS[1]) ** 2)) + SB_CS[2];
      return zz;
    };
    const col = [];
    const dark = C('#12060a');
    const hot = C('#ffb15c');
    const seg = (x0, y0, x1, y1, w) => {
      const dx = x1 - x0;
      const dy = y1 - y0;
      const l = Math.hypot(dx, dy) || 1;
      for (const [k, cc, lift] of [
        [1, dark, 0],
        [0.35, hot, 0.0015],
      ]) {
        const nx = (-dy / l) * w * k;
        const ny = (dx / l) * w * k;
        const a = [x0 + nx, y0 + ny];
        const b = [x0 - nx, y0 - ny];
        const c = [x1 - nx * 0.6, y1 - ny * 0.6];
        const dd = [x1 + nx * 0.6, y1 + ny * 0.6];
        for (const [p, q, r] of [
          [a, b, c],
          [a, c, dd],
        ]) {
          pos.push(p[0], p[1], surf(p[0], p[1]) + lift, q[0], q[1], surf(q[0], q[1]) + lift, r[0], r[1], surf(r[0], r[1]) + lift);
          for (let i = 0; i < 3; i++) col.push(cc.r, cc.g, cc.b);
        }
      }
    };
    const inside = (x, y) => Math.hypot(x / 0.19, (y - SB_CS[1]) / 0.2) < 1;
    const crack = (x, y, a, n, w) => {
      for (let i = 0; i < n; i++) {
        const nx = x + Math.cos(a) * 0.022;
        const ny = y + Math.sin(a) * 0.022;
        if (!inside(nx, ny)) break;
        seg(x, y, nx, ny, w);
        x = nx;
        y = ny;
        a += (rand() - 0.5) * 0.9;
        w *= 0.93;
        if (rand() < 0.2) crack(x, y, a + (rand() < 0.5 ? -1 : 1) * (0.6 + rand() * 0.5), n - i - 2, w * 0.7);
      }
    };
    const ox = -0.045;
    const oy = 0.035;
    for (let i = 0; i < 6; i++) crack(ox, oy, (i / 6) * TWO_PI + rand() * 0.6, 9, 0.0085);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    return g;
  });
}
function buildShieldbug(g, body, ud, env) {
  const shellGeo = sculpt('shieldbug', shieldbugSDF, [-0.26, -0.2, -0.26], [0.26, 0.34, 0.3], 0.0145, (x, y, z, c) => {
    const { l, e } = sbShieldDist(x, y, z);
    const onShield = e < 0.004 && l > SB_RS - 0.03 && z > 0.05;
    const rim = onShield && e > -0.03 && l > SB_RS + 0.005;
    const boss = Math.hypot(x, y + 0.03, z - (SB_CS[2] + SB_RS + 0.004)) < 0.062;
    const horn = y > 0.15 && Math.abs(x) < 0.05 && z > 0.15;
    if (rim || boss || horn) {
      c.set('#fbbf24');
      if (horn) c.lerp(C('#fef3c7'), smooth(0.24, 0.31, y));
      return 1;
    }
    if (onShield) {
      c.set('#14b8a6');
      // engraved chevrons on the shield face
      const ch = Math.abs(((y - Math.abs(x) * 0.7 + 1) * 18) % 2 - 1);
      c.lerp(C('#134e4a'), smooth(0.75, 0.9, ch) * smooth(-0.02, -0.06, e) * 0.85);
      return 0.55;
    }
    const stalk = y > 0.06 && z > 0.06;
    if (stalk) {
      c.set('#312e81');
      return 0.3;
    }
    c.set('#134e4a');
    if (Math.abs(x) < 0.008 && y > -0.02) c.set('#022c22');
    return 0.75;
  });
  const shellMat = physical(
    ud,
    {
      vertexColors: true,
      metalness: 1,
      roughness: 0.24,
      iridescence: 1,
      iridescenceIOR: 1.55,
      iridescenceThicknessRange: [220, 560],
      clearcoat: 1,
      clearcoatRoughness: 0.08,
      envMap: env.chromeEnv,
      envMapIntensity: 1.1,
    },
    { metalMask: true, paintRough: 0.35, rimStrength: 0.3 }
  );
  const abdGeo = sculpt('sbAbdomen', sbAbdomenSDF, [-0.18, -0.2, -0.38], [0.18, 0.12, -0.02], 0.014, (x, y, z, c) => {
    const band = Math.max(0, Math.cos((z + 0.2) * 48));
    c.set('#bef264').lerp(C('#3f6212'), band * 0.6);
    c.lerp(C('#fde047'), smooth(-0.24, -0.34, z) * 0.8);
    return 0;
  });
  const abdMat = emissiveFromColor(
    physical(ud, { vertexColors: true, roughness: 0.35, clearcoat: 0.6, sheen: 0.3, sheenColor: C('#ecfccb'), emissive: '#a3e635', emissiveIntensity: 0.6 }, { rim: '#ecfccb', rimStrength: 0.25 })
  );
  const legGeos = cached('geo:sbLegs', () => {
    const one = sculpt('sbLeg', sbLegSDF, [-0.03, -0.13, -0.03], [0.16, 0.07, 0.07], 0.012, (x, y, z, c) => {
      c.set(y < -0.09 ? '#0f172a' : '#1e1b4b');
      return 0.3;
    }, { hullCell: 0 });
    const L = mirrorX(one);
    const place = (geo, x, z, rotY) => {
      const c2 = geo.clone();
      c2.rotateY(rotY);
      c2.translate(x, 0, z);
      return c2;
    };
    const A = mergeGeometries([place(L, -0.11, 0.09, 0.35), place(one, 0.11, 0.0, 0), place(L, -0.11, -0.1, -0.35)]);
    const B = mergeGeometries([place(one, 0.11, 0.09, -0.35), place(L, -0.11, 0.0, 0), place(one, 0.11, -0.1, 0.35)]);
    return [A, B];
  });
  const legMat = physical(ud, { vertexColors: true, roughness: 0.4, clearcoat: 0.6 });
  const hip = new THREE.Group();
  body.add(hip);
  const shell = new THREE.Mesh(shellGeo, shellMat);
  hip.add(shell);
  addOutline(shell, 0.011);
  const abd = new THREE.Mesh(abdGeo, abdMat);
  hip.add(abd);
  addOutline(abd, 0.009);
  const legs = legGeos.map((lg) => {
    const m = new THREE.Mesh(lg, legMat);
    m.position.y = GROUND + 0.124;
    body.add(m);
    return m;
  });
  const tex = eyeTexture({
    key: 'shieldbug',
    sclera: ['#ffffff', '#fbfbf2', '#d4d4c8'],
    iris: [
      [0, '#fef08a'],
      [0.5, '#f59e0b'],
      [0.9, '#9a3412'],
      [1, '#2a0f05'],
    ],
    irisR: 50,
    fibre: 'rgba(120,53,15,0.4)',
    pupilR: 20,
  });
  const eyeMat = reg(ud, eyeMaterial(tex));
  const lidMat = physical(ud, { color: '#312e81', roughness: 0.35, clearcoat: 1 });
  const eyes = [-1, 1].map((sd) => makeEye(hip, { x: sd * SB_EYE.x, y: SB_EYE.y, z: SB_EYE.z, r: SB_EYE.r, mat: eyeMat, lidMat, lidR: 1.1 }));
  for (const e of eyes) e.slant.rotation.z = e.side * 0.3;
  const glints = new THREE.Mesh(
    glintGeo('shieldbug', [
      [-SB_EYE.x - 0.016, SB_EYE.y + 0.016, SB_EYE.z + 0.042, 0.01],
      [SB_EYE.x - 0.016, SB_EYE.y + 0.016, SB_EYE.z + 0.042, 0.01],
    ]),
    GLINT_MAT
  );
  glints.userData.noShadow = true;
  hip.add(glints);
  const crackMat = basic('#ffffff', { side: THREE.DoubleSide, vertexColors: true });
  const cracks = new THREE.Mesh(sbCrackGeo(), crackMat);
  cracks.visible = false;
  cracks.userData.noShadow = true;
  hip.add(cracks);
  const sparks = [];
  for (let i = 0; i < 6; i++) {
    const sp = additiveSprite(env.dot, i % 2 ? '#fff7cc' : '#7dd3fc', 0.1, 0);
    sp.visible = false;
    hip.add(sp);
    sparks.push(sp);
  }
  const halo = additiveSprite(env.dot, '#bef264', 0.55, 0.4);
  halo.position.set(0, -0.04, -0.24);
  hip.add(halo);
  Object.assign(ud, { hip, shell, shellMat, abd, abdMat, legs, eyes, cracks, sparks, halo, popColor: '#d9f99d' });
}
function animShieldbug(g, ud, en, st, ctx, f) {
  const t = st.t;
  if (!f.frozen) st.step = (st.step || 0) + f.dt * 15;
  const ph = st.step || 0;
  const s = Math.sin(ph);
  ud.legs[0].position.set(0, GROUND + 0.124 + Math.max(0, s) * 0.028, Math.cos(ph) * 0.026);
  ud.legs[1].position.set(0, GROUND + 0.124 + Math.max(0, -s) * 0.028, -Math.cos(ph) * 0.026);
  ud.hip.position.y = Math.abs(Math.sin(ph)) * 0.008;
  ud.hip.rotation.z = Math.sin(ph) * 0.03;
  // the soft glowing abdomen breathes and pulses
  const pulse = 0.5 + 0.5 * Math.sin(t * 4.2);
  ud.abd.scale.set(1 + pulse * 0.035, 1 + pulse * 0.03, 1 + pulse * 0.05);
  ud.abdMat.emissiveIntensity = f.frozen ? 0.15 : 0.35 + pulse * 0.45;
  ud.halo.material.opacity = f.frozen ? 0 : 0.18 + pulse * 0.25;
  // shield ding: flash + sparks
  const sf = clamp((en.shieldFlash || 0) / 0.3, 0, 1);
  ud.shellMat.userData.fx.uFlash.value = Math.max(ud.shellMat.userData.fx.uFlash.value, sf * 0.75);
  if (sf > 0 && !st.sparkSeed) st.sparkSeed = Math.random() * 10;
  if (sf <= 0) st.sparkSeed = 0;
  ud.sparks.forEach((sp, i) => {
    sp.visible = sf > 0.02;
    if (!sp.visible) return;
    const k = 1 - sf;
    const a = st.sparkSeed + i * 1.13;
    const r = 0.06 + k * 0.32;
    sp.position.set(Math.cos(a) * r, 0.02 + Math.sin(a) * r * 0.8 + k * 0.05, 0.27 + k * 0.08);
    sp.scale.setScalar(0.12 * (1 - k * 0.6));
    sp.material.opacity = sf;
  });
  ud.cracks.visible = Boolean(en.cracked);
  if (en.cracked) ud.cracks.material.color.setScalar(1.2 + Math.sin(t * 9) * 0.3);
  const blink = blinkAmount(st, f.dt, f.frozen);
  for (const e of ud.eyes) setLids(e, mix(en.cracked ? 0.6 : 0.3, -1.5, blink));
  lookEyes(ud.eyes, st, f, 0.6, 0.4);
}

// ================================================================================================
// 9. PUFFER — a chubby golden pufferfish squatting on a ledge. It sucks in air (morphs from fish to
//    ball), spikes pop out, then it puckers up and BLOWS a gust along the floor.
// ================================================================================================
const PUF_R = 0.232;
function pufferFishSDF(x, y, z) {
  let d = sdEllipsoid(x, y, z, 0, 0, -0.01, 0.15, 0.125, 0.2);
  d = smin(d, sdEllipsoid(x, y, z, 0, -0.01, 0.06, 0.14, 0.122, 0.14), 0.05);
  return d;
}
const PUF_EYE_DIR = new THREE.Vector3(0.5, 0.42, 0.75).normalize();
function pufferMorphPoint(dir) {
  return traceSurface(pufferFishSDF, [0, 0, 0], dir, 0.5);
}
function pufferBodyGeo() {
  return cached('geo:pufBody', () => {
    const g = new THREE.SphereGeometry(PUF_R, 44, 30);
    const p = g.attributes.position;
    const n = p.count;
    const mp = new Float32Array(n * 3);
    const mn = new Float32Array(n * 3);
    const col = new Float32Array(n * 3);
    const rand = rng(23);
    const spots = [];
    for (let i = 0; i < 16; i++) {
      const v = new THREE.Vector3(rand() - 0.5, rand() * 0.9 - 0.15, rand() - 0.5).normalize();
      if (v.z > 0.7) continue;
      spots.push([v, 0.13 + rand() * 0.1]);
    }
    const top = C('#f6b21b');
    const belly = C('#fff1cf');
    const spot = C('#9a5b0f');
    const c = new THREE.Color();
    const v = new THREE.Vector3();
    const e = 0.003;
    for (let i = 0; i < n; i++) {
      v.set(p.getX(i), p.getY(i), p.getZ(i)).normalize();
      const q = pufferMorphPoint([v.x, v.y, v.z]);
      mp.set(q, i * 3);
      const gx = pufferFishSDF(q[0] + e, q[1], q[2]) - pufferFishSDF(q[0] - e, q[1], q[2]);
      const gy = pufferFishSDF(q[0], q[1] + e, q[2]) - pufferFishSDF(q[0], q[1] - e, q[2]);
      const gz = pufferFishSDF(q[0], q[1], q[2] + e) - pufferFishSDF(q[0], q[1], q[2] - e);
      const gl = Math.hypot(gx, gy, gz) || 1;
      mn.set([gx / gl, gy / gl, gz / gl], i * 3);
      c.copy(top).lerp(belly, smooth(0.0, -0.45, v.y));
      for (const [sv, sr] of spots) {
        const d = v.distanceTo(sv);
        c.lerp(spot, smooth(sr * 0.75, sr * 0.55, d) * 0.9 * smooth(-0.3, 0.0, v.y));
      }
      // tiny freckles
      if (Math.sin(v.x * 80) * Math.sin(v.y * 77) * Math.sin(v.z * 83) > 0.82 && v.y > -0.2) c.lerp(spot, 0.6);
      c.multiplyScalar(0.75 + 0.25 * smooth(-1, 0.4, v.y));
      col.set([c.r, c.g, c.b], i * 3);
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    g.morphAttributes.position = [new THREE.BufferAttribute(mp, 3)];
    g.morphAttributes.normal = [new THREE.BufferAttribute(mn, 3)];
    return g;
  });
}
function pufferSpikeGeo() {
  return cached('geo:pufSpikes', () => {
    const parts = [];
    const morph = [];
    const up = new THREE.Vector3(0, 1, 0);
    const q = new THREE.Quaternion();
    const v = new THREE.Vector3();
    const eyeL = PUF_EYE_DIR.clone().setX(-PUF_EYE_DIR.x);
    for (const d of fibDirs(46, 0.7)) {
      v.set(...d);
      if (v.z > 0.72 || v.y < -0.62 || v.z < -0.86) continue;
      if (v.angleTo(PUF_EYE_DIR) < 0.42 || v.angleTo(eyeL) < 0.42) continue;
      const cone = new THREE.ConeGeometry(0.02, 0.078, 6).toNonIndexed();
      cone.translate(0, 0.039, 0);
      q.setFromUnitVectors(up, v);
      cone.applyQuaternion(q);
      cone.translate(v.x * (PUF_R - 0.012), v.y * (PUF_R - 0.012), v.z * (PUF_R - 0.012));
      const n = cone.attributes.position.count;
      const col = new Float32Array(n * 3);
      const tipC = C('#7c2d12');
      const baseC = C('#fde68a');
      const c = new THREE.Color();
      const mp = new Float32Array(n * 3);
      const inner = pufferMorphPoint([v.x, v.y, v.z]);
      for (let i = 0; i < n; i++) {
        const px = cone.attributes.position.getX(i);
        const py = cone.attributes.position.getY(i);
        const pz = cone.attributes.position.getZ(i);
        const h = (px * v.x + py * v.y + pz * v.z - (PUF_R - 0.012)) / 0.078;
        c.copy(baseC).lerp(tipC, smooth(0.45, 1, h));
        col.set([c.r, c.g, c.b], i * 3);
        mp.set([inner[0] * 0.82, inner[1] * 0.82, inner[2] * 0.82], i * 3);
      }
      cone.setAttribute('color', new THREE.BufferAttribute(col, 3));
      parts.push(cone);
      morph.push(mp);
    }
    const g = mergeGeometries(parts);
    const total = morph.reduce((a, m) => a + m.length, 0);
    const mp = new Float32Array(total);
    let o = 0;
    for (const m of morph) {
      mp.set(m, o);
      o += m.length;
    }
    g.morphAttributes.position = [new THREE.BufferAttribute(mp, 3)];
    return g;
  });
}
function pufferLipsGeo() {
  return cached('geo:pufLips', () => {
    const lip = new THREE.TorusGeometry(0.034, 0.017, 10, 24).toNonIndexed();
    const hole = new THREE.CircleGeometry(0.036, 20).toNonIndexed();
    hole.translate(0, 0, -0.004);
    const paint = (g, hex) => {
      const c = C(hex);
      const n = g.attributes.position.count;
      const a = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) a.set([c.r, c.g, c.b], i * 3);
      g.setAttribute('color', new THREE.BufferAttribute(a, 3));
      g.deleteAttribute('uv');
    };
    paint(lip, '#fb7185');
    paint(hole, '#3b0712');
    return mergeGeometries([lip, hole]);
  });
}
function buildPuffer(g, body, ud, env) {
  const skin = physical(ud, { vertexColors: true, roughness: 0.42, clearcoat: 0.8, clearcoatRoughness: 0.2, sheen: 0.3, sheenColor: C('#fff7d6') }, { rim: '#fff1c2', rimStrength: 0.3 });
  const puff = new THREE.Group();
  body.add(puff);
  const fish = new THREE.Mesh(pufferBodyGeo(), skin);
  puff.add(fish);
  const outline = addOutline(fish, 0.012);
  outline.geometry = fish.geometry;
  outline.updateMorphTargets();
  const spikes = new THREE.Mesh(pufferSpikeGeo(), physical(ud, { vertexColors: true, roughness: 0.4, clearcoat: 0.6 }));
  puff.add(spikes);
  const lips = new THREE.Mesh(pufferLipsGeo(), physical(ud, { vertexColors: true, roughness: 0.3, clearcoat: 1 }));
  puff.add(lips);
  const tex = eyeTexture({
    key: 'puffer',
    sclera: ['#ffffff', '#f8fafc', '#cbd5e1'],
    iris: [
      [0, '#a5f3fc'],
      [0.5, '#0891b2'],
      [0.9, '#164e63'],
      [1, '#06202a'],
    ],
    irisR: 52,
    fibre: 'rgba(8,47,73,0.4)',
    pupilR: 25,
  });
  const eyeMat = reg(ud, eyeMaterial(tex));
  const lidMat = physical(ud, { color: '#f2a516', roughness: 0.4, clearcoat: 0.8 });
  const eyes = [-1, 1].map((sd) => makeEye(puff, { x: sd * 0.1, y: 0.1, z: 0.15, r: 0.062, mat: eyeMat, lidMat, lidR: 1.1, lash: basic('#5a3307') }));
  const glints = [];
  for (const e of eyes) {
    const gl = new THREE.Mesh(
      glintGeo('puffer', [
        [-0.022, 0.026, 0.056, 0.013],
        [0.018, -0.016, 0.06, 0.006],
      ]),
      GLINT_MAT
    );
    gl.userData.noShadow = true;
    e.eg.add(gl);
    glints.push(gl);
  }
  const finMat = physical(ud, { map: finTex('puffer', '#0d9488', '#99f6e4', 'rgba(15,60,60,0.45)'), alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.5, sheen: 0.5, sheenColor: C('#ccfbf1') });
  const tail = new THREE.Group();
  puff.add(tail);
  const tailFin = new THREE.Mesh(finGeo('pufTail', 0.2, 0.2, 0.2), finMat);
  tailFin.rotation.y = Math.PI / 2; // fan extends toward -Z, vertical
  tail.add(tailFin);
  const fins = [-1, 1].map((sd) => {
    const piv = new THREE.Group();
    puff.add(piv);
    const m = new THREE.Mesh(finGeo('pufPec', 0.11, 0.1, 0.4), finMat);
    m.scale.x = sd;
    m.rotation.y = sd * 0.5;
    piv.add(m);
    return piv;
  });
  const windMat = windStreakMat();
  const wind = new THREE.Mesh(windStreakGeo(), windMat);
  wind.frustumCulled = false;
  wind.visible = false;
  wind.userData.noShadow = true;
  body.add(wind);
  Object.assign(ud, { puff, fish, outline, spikes, lips, eyes, glints, tail, fins, wind, windMat, popColor: '#fde68a', ownsBodyScale: false });
}
// Wind gust: speed-line ribbons (each a crossed pair of quads) that stream out of the mouth
function windStreakGeo() {
  return cached('geo:windStreaks', () => {
    const rand = rng(41);
    const pos = [];
    const t = [];
    const seed = [];
    const N = 11;
    for (let i = 0; i < N; i++) {
      const a = (i / N) * TWO_PI + rand() * 0.4;
      const r = 0.03 + rand() * 0.09;
      const len = 0.2 + rand() * 0.22;
      const w = 0.004 + rand() * 0.004;
      const cx = Math.cos(a) * r;
      const cy = Math.sin(a) * r * 0.7;
      const sd = rand();
      for (const [wx, wy] of [
        [Math.cos(a) * w, Math.sin(a) * w],
        [-Math.sin(a) * w, Math.cos(a) * w],
      ]) {
        const quad = [
          [cx - wx, cy - wy, 0, 0],
          [cx + wx, cy + wy, 0, 0],
          [cx + wx, cy + wy, len, 1],
          [cx - wx, cy - wy, 0, 0],
          [cx + wx, cy + wy, len, 1],
          [cx - wx, cy - wy, len, 1],
        ];
        for (const [x, y, z, tt] of quad) {
          pos.push(x, y, z);
          t.push(tt);
          seed.push(sd);
        }
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('aT', new THREE.Float32BufferAttribute(t, 1));
    g.setAttribute('aSeed', new THREE.Float32BufferAttribute(seed, 1));
    return g;
  });
}
function windStreakMat() {
  const m = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uI: { value: 0 } },
    vertexShader: /* glsl */ `
      attribute float aT; attribute float aSeed;
      uniform float uTime;
      varying float vA; varying float vT;
      void main() {
        float ph = fract(uTime * 1.6 + aSeed);
        vec3 p = position;
        float z0 = ph * 1.05;
        p.z += z0;
        p.xy *= 1.0 + p.z * 1.1;
        p.y += sin(p.z * 9.0 + aSeed * 6.0 + uTime * 6.0) * 0.012;
        vA = sin(ph * 3.14159);
        vT = aT;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      uniform float uI; varying float vA; varying float vT;
      void main() {
        float a = vA * uI * (0.1 + vT * 0.5);
        gl_FragColor = vec4(vec3(0.7, 0.9, 1.0) * a, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
  });
  return m;
}
const _pv = new THREE.Vector3();
function animPuffer(g, ud, en, st, ctx, f) {
  const t = st.t;
  const P = clamp(en.puff || 0, 0, 1);
  st.P = f.frozen ? st.P ?? P : damp(st.P ?? P, P, 14, f.dt);
  const k = st.P;
  const inflate = smooth(0, 1, k);
  const blowing = P >= 0.98 && !f.frozen;
  st.blow = damp(st.blow ?? 0, blowing ? 1 : 0, blowing ? 10 : 6, f.dt);
  ud.fish.morphTargetInfluences[0] = 1 - inflate;
  ud.outline.morphTargetInfluences[0] = 1 - inflate;
  const spikeOut = smooth(0.55, 0.92, k);
  ud.spikes.morphTargetInfluences[0] = 1 - spikeOut;
  ud.spikes.visible = spikeOut > 0.02;
  const pop = spikeOut > 0 && spikeOut < 1 ? 1 + Math.sin(spikeOut * Math.PI) * 0.06 : 1;
  ud.spikes.scale.setScalar(pop);
  // body: sits on its belly; idle bob, shiver while blowing
  const restY = mix(0.125, PUF_R, inflate);
  const bob = f.frozen ? 0 : (1 - k) * Math.sin(t * 3) * 0.008;
  const shiver = st.blow * Math.sin(t * 60) * 0.006;
  ud.puff.position.set(shiver, GROUND + restY + bob, 0);
  ud.puff.rotation.x = f.frozen ? ud.puff.rotation.x : (1 - k) * Math.sin(t * 2.2) * 0.04 - st.blow * 0.08;
  // place parts on the morphing surface
  const at = (dir, out) => {
    const r0 = pufferMorphPoint(dir);
    return out.set(mix(r0[0], dir[0] * PUF_R, inflate), mix(r0[1], dir[1] * PUF_R, inflate), mix(r0[2], dir[2] * PUF_R, inflate));
  };
  for (const e of ud.eyes) {
    at([PUF_EYE_DIR.x * e.side, PUF_EYE_DIR.y, PUF_EYE_DIR.z], _pv);
    e.eg.position.copy(_pv).multiplyScalar(0.94);
    e.eg.rotation.y = e.side * 0.42;
    e.eg.scale.setScalar(1 + inflate * 0.12);
  }
  at([0, -0.08, 1], _pv);
  ud.lips.position.set(0, _pv.y, _pv.z - 0.004);
  const pucker = 0.8 + k * 0.35 + st.blow * 0.3 + (f.frozen ? 0 : Math.sin(t * 5) * 0.04 * (1 - k));
  ud.lips.scale.set(pucker, pucker * (1 + st.blow * 0.15), 1 + k * 0.4);
  at([0, 0.05, -1], _pv);
  ud.tail.position.set(0, _pv.y, _pv.z + 0.01);
  ud.tail.rotation.y = f.frozen ? ud.tail.rotation.y : Math.sin(t * (6 + st.blow * 14)) * (0.35 - inflate * 0.15);
  ud.fins.forEach((fin, i) => {
    const sd = i === 0 ? -1 : 1;
    at([sd * 0.92, -0.25, 0.25], _pv);
    fin.position.copy(_pv);
    fin.rotation.z = f.frozen ? fin.rotation.z : sd * (Math.sin(t * 9 + i) * 0.4 - 0.2);
  });
  // face: sleepy fish -> wide-eyed balloon -> squeezed tight while blowing
  const blink = blinkAmount(st, f.dt, f.frozen);
  const lid = mix(mix(0.15, 0.95, smooth(0.1, 0.7, k)), -0.6, st.blow);
  for (const e of ud.eyes) {
    setLids(e, mix(lid, -1.5, blink));
    e.slant.rotation.z = e.side * mix(0.15, 0.4, st.blow);
  }
  lookEyes(ud.eyes, st, f, 0.4, 0.35);
  // gust
  ud.wind.visible = st.blow > 0.02;
  ud.windMat.uniforms.uI.value = st.blow;
  ud.windMat.uniforms.uTime.value = t;
  ud.wind.position.set(0, ud.puff.position.y - 0.03, PUF_R + 0.03);
}

// ================================================================================================
// 10. SPLITTER — a wobbly translucent jelly drop with a curled tip, a glowing plasma nucleus,
//     floating bubbles, glossy mischievous eyes and a wide grin. Pops into two minis.
// ================================================================================================
function jellySDF(x, y, z) {
  let d = sdEllipsoid(x, y, z, 0, -0.06, 0, 0.215, 0.15, 0.2);
  d = smin(d, sdRoundCone(x, y, z, 0, -0.02, 0, 0.015, 0.15, -0.02, 0.13, 0.026), 0.08);
  d = smin(d, sdRoundCone(x, y, z, 0.015, 0.15, -0.02, -0.035, 0.2, 0.005, 0.026, 0.012), 0.025);
  d = smax(d, -(y + 0.2), 0.04);
  return d;
}
const JELLY = {
  big: { body: '#2dd4bf', deep: '#0b4f4a', nucA: '#ffe4f3', nucB: '#ff2d95' },
  mini: { body: '#60a5fa', deep: '#172f7a', nucA: '#fff7d6', nucB: '#ffb000' },
};
function buildSplitter(g, body, ud, env) {
  const geo = sculpt('jelly', jellySDF, [-0.25, -0.22, -0.24], [0.25, 0.24, 0.24], 0.0135, (x, y, z, c) => {
    c.setRGB(1, 1, 1);
    c.multiplyScalar(0.8 + 0.2 * smooth(-0.2, 0.15, y));
    return 1; // vertex alpha multiplies opacity on transparent materials
  }, { aoMin: 0.85 });
  const jelly = new THREE.MeshPhysicalMaterial({
    vertexColors: true,
    color: JELLY.big.body,
    roughness: 0.06,
    metalness: 0,
    clearcoat: 1,
    clearcoatRoughness: 0.04,
    transparent: true,
    opacity: 0.66,
    depthWrite: false,
    envMapIntensity: 1.3,
    emissive: JELLY.big.body,
    emissiveIntensity: 0.42,
    sheen: 0.6,
    sheenColor: C('#ffffff'),
  });
  const ju = { uWob: { value: 0 }, uTime: { value: 0 }, uJig: { value: new THREE.Vector2() }, uDeep: { value: C(JELLY.big.deep) } };
  fxHook(jelly, { rim: '#ccfbf1', rimStrength: 0.5 });
  const prev = jelly.onBeforeCompile;
  jelly.onBeforeCompile = (sh, r) => {
    prev(sh, r);
    Object.assign(sh.uniforms, ju);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uWob; uniform float uTime; uniform vec2 uJig;')
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        float jw = sin(uTime * 7.0 + position.y * 26.0 + position.x * 9.0) * 0.5 + sin(uTime * 5.3 + position.x * 21.0 - position.z * 13.0) * 0.5;
        transformed += normal * jw * uWob;
        float jh = clamp((position.y + 0.2) / 0.42, 0.0, 1.0);
        transformed.x += uJig.x * jh * jh;
        transformed.z += uJig.y * jh * jh;`
      );
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform vec3 uDeep;')
      .replace(
        '#include <opaque_fragment>',
        `float jF = pow(1.0 - clamp(abs(dot(normal, normalize(vViewPosition))), 0.0, 1.0), 2.0);
        float jS = dot(reflectedLight.directSpecular + reflectedLight.indirectSpecular, vec3(0.333));
        float jEdge = smoothstep(0.25, 0.8, jF);
        outgoingLight = mix(outgoingLight, uDeep * 0.5, jEdge * 0.85);
        diffuseColor.a = clamp(diffuseColor.a + jF * 0.5 + jEdge * 0.4 + jS * 0.8, 0.0, 1.0);
        #include <opaque_fragment>`
      );
  };
  jelly.customProgramCacheKey = () => 'enm-jelly';
  reg(ud, jelly);
  const squash = new THREE.Group();
  body.add(squash);
  const blob = new THREE.Mesh(geo, jelly);
  blob.renderOrder = 1;
  blob.userData.noShadow = true;
  squash.add(blob);
  // shadow proxy (jelly is transparent): an invisible-in-colour mesh that only casts
  const shadowProxy = new THREE.Mesh(geo.userData.hull || geo, new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false }));
  shadowProxy.castShadow = true;
  shadowProxy.userData.shadowOnly = true;
  squash.add(shadowProxy);
  const nucMat = energyMat('plasma', { uA: { value: C(JELLY.big.nucA) }, uB: { value: C(JELLY.big.nucB) }, uScale: { value: 18 }, uI: { value: 1.0 } });
  const nucleus = new THREE.Mesh(cached('geo:sph:jn', () => new THREE.SphereGeometry(0.072, 24, 16)), nucMat);
  nucleus.position.set(0, -0.06, -0.02);
  nucleus.userData.noShadow = true;
  squash.add(nucleus);
  const bubbles = new THREE.Mesh(
    cached('geo:jellyBubbles', () => {
      const rand = rng(8);
      const parts = [];
      for (let i = 0; i < 7; i++) {
        const b = new THREE.SphereGeometry(0.008 + rand() * 0.012, 8, 6);
        b.translate((rand() - 0.5) * 0.26, -0.15 + rand() * 0.22, -0.08 + (rand() - 0.5) * 0.14);
        parts.push(b);
      }
      return mergeGeometries(parts);
    }),
    basic('#f0fdfa', { transparent: true, opacity: 0.75 })
  );
  bubbles.userData.noShadow = true;
  squash.add(bubbles);
  // face
  const tex = eyeTexture({
    key: 'jelly',
    sclera: ['#ffffff', '#f8fafc', '#e2e8f0'],
    iris: [
      [0, '#4c1d95'],
      [0.6, '#1e1b4b'],
      [1, '#0b0820'],
    ],
    irisR: 66,
    limbal: '#05030f',
    pupilR: 30,
  });
  const eyeMat = reg(ud, eyeMaterial(tex));
  const eyes = [-1, 1].map((sd) => {
    const p = traceSurface(jellySDF, [sd * 0.06, 0.0, 0], [sd * 0.35, 0.18, 1], 0.4);
    const eg = new THREE.Group();
    eg.position.set(p[0] * 0.97, p[1], p[2] - 0.022);
    const ball = new THREE.Mesh(eyeballGeo(0.05), eyeMat);
    eg.add(ball);
    squash.add(eg);
    return { eg, ball, side: sd };
  });
  const glints = new THREE.Mesh(
    glintGeo(
      'jelly',
      eyes.flatMap((e) => [
        [e.eg.position.x - 0.016, e.eg.position.y + 0.012, e.eg.position.z + 0.045, 0.012],
        [e.eg.position.x + 0.014, e.eg.position.y - 0.016, e.eg.position.z + 0.046, 0.006],
      ])
    ),
    GLINT_MAT
  );
  glints.userData.noShadow = true;
  squash.add(glints);
  // grin: a half-disc wrapped onto the surface, with a tongue
  const mouthGeo = cached('geo:jellyMouth', () => {
    const m = new THREE.CircleGeometry(0.06, 22, Math.PI, Math.PI).toNonIndexed();
    m.scale(1.15, 0.85, 1);
    const tongue = new THREE.CircleGeometry(0.03, 14, Math.PI, Math.PI).toNonIndexed();
    tongue.translate(0, -0.024, 0.001);
    // mischievous brows, slanted in toward the middle
    const brows = [-1, 1].map((sd) => {
      const b = new THREE.PlaneGeometry(0.06, 0.016).toNonIndexed();
      b.rotateZ(sd * 0.42);
      b.translate(sd * 0.072, 0.175, 0);
      return b;
    });
    const cols = [];
    const all = mergeGeometries([m, tongue, ...brows]);
    const p = all.attributes.position;
    const mN = m.attributes.position.count;
    const tN = mN + tongue.attributes.position.count;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i);
      const y = p.getY(i) - 0.065;
      const s = traceSurface(jellySDF, [x * 0.5, y, 0], [0, 0, 1], 0.4);
      p.setXYZ(i, x, y, s[2] + (i >= mN && i < tN ? 0.003 : 0.0015));
      const c = i >= mN && i < tN ? C('#fb7185') : C('#2a0a24');
      cols.push(c.r, c.g, c.b);
    }
    all.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
    all.deleteAttribute('uv');
    all.deleteAttribute('normal');
    return all;
  });
  const mouth = new THREE.Mesh(mouthGeo, basic('#ffffff', { vertexColors: true, side: THREE.DoubleSide }));
  mouth.userData.noShadow = true;
  squash.add(mouth);
  const halo = additiveSprite(env.dot, JELLY.big.nucB, 0.55, 0.45);
  halo.position.copy(nucleus.position);
  squash.add(halo);
  Object.assign(ud, { squash, blob, jelly, ju, nucleus, nucMat, bubbles, eyes, halo, popColor: JELLY.big.body, ownsBodyScale: false, mini: null });
}
function animSplitter(g, ud, en, st, ctx, f) {
  const t = st.t;
  const mini = Boolean(en.mini);
  if (ud.mini !== mini) {
    ud.mini = mini;
    const pal = mini ? JELLY.mini : JELLY.big;
    ud.jelly.color.set(pal.body);
    ud.jelly.emissive.set(pal.body);
    ud.ju.uDeep.value.set(pal.deep);
    ud.nucMat.uniforms.uA.value.set(pal.nucA);
    ud.nucMat.uniforms.uB.value.set(pal.nucB);
    ud.halo.material.color.set(pal.nucB);
    ud.pop.material.color.set(pal.body);
  }
  const sc = mini ? 0.6 : 1;
  const base = Math.round(en.baseFloor ?? en.floor);
  const h = Math.max(0, en.floor - base);
  if (!f.frozen) {
    const vy = f.dt > 0 ? (h - (st.prevH ?? h)) / f.dt : 0;
    st.vy = damp(st.vy ?? 0, vy, 20, f.dt);
    st.prevH = h;
  }
  const contact = f.frozen ? st.contact ?? 0 : smooth(0.14, 0.0, h);
  st.contact = contact;
  // jelly spring: squash on contact, stretch in flight, and a damped wobble after landing
  if (!f.frozen) {
    if (contact > 0.6 && !st.landed) {
      st.landed = true;
      st.wobT = 0;
    }
    if (contact < 0.2) st.landed = false;
    st.wobT = (st.wobT ?? 9) + f.dt;
  }
  const wob = Math.exp(-(st.wobT ?? 9) * 4) * Math.sin((st.wobT ?? 9) * 26) * 0.12;
  const stretch = f.frozen ? 0 : clamp(Math.abs(st.vy || 0) * 0.02, 0, 0.12) * smooth(0.15, 0.4, h);
  const sq = contact * 0.22;
  const sy = 1 - sq + stretch + wob + (f.frozen ? 0 : Math.sin(t * 4) * 0.02);
  const sxz = 1 + sq * 0.8 - stretch * 0.45 - wob * 0.6;
  ud.squash.scale.set(sxz * sc, sy * sc, sxz * sc);
  ud.squash.position.y = GROUND + 0.2 * sc * (1 - contact * 0.0);
  ud.ju.uTime.value = t;
  ud.ju.uWob.value = f.frozen ? 0 : 0.004 + Math.abs(wob) * 0.03;
  ud.ju.uJig.value.set(f.frozen ? 0 : Math.sin(t * 3.1) * 0.012 + (st.vy || 0) * 0.0, f.frozen ? 0 : Math.cos(t * 2.7) * 0.008);
  ud.nucMat.uniforms.uTime.value = t;
  ud.nucMat.uniforms.uFlash.value = f.flash;
  ud.nucMat.uniforms.uFreeze.value = st.freeze;
  ud.nucleus.position.set(Math.sin(t * 1.3) * 0.015, -0.06 + Math.sin(t * 2.1) * 0.012, -0.02);
  ud.nucleus.scale.setScalar(1 + Math.sin(t * 5) * 0.08);
  ud.bubbles.rotation.y = t * 0.6;
  ud.bubbles.position.y = ((t * 0.05) % 0.04) - 0.02;
  ud.halo.position.copy(ud.nucleus.position);
  ud.halo.material.opacity = f.frozen ? 0.05 : 0.4 + Math.sin(t * 5) * 0.1;
  const blink = blinkAmount(st, f.dt, f.frozen);
  for (const e of ud.eyes) e.eg.scale.set(1, Math.max(0.12, 1 - blink - contact * 0.25), 1);
  lookEyes(ud.eyes, st, f, 0.5, 0.4);
}

// ================================================================================================
// Registry + public API
// ================================================================================================
const BUILD = {
  roller: buildRoller,
  bouncer: buildBouncer,
  spiker: buildSpiker,
  chaser: buildChaser,
  molecule: buildMolecule,
  fireball: buildFireball,
  eye: buildEye,
  shieldbug: buildShieldbug,
  puffer: buildPuffer,
  splitter: buildSplitter,
};
const ANIM = {
  roller: animRoller,
  bouncer: animBouncer,
  spiker: animSpiker,
  chaser: animChaser,
  molecule: animMolecule,
  fireball: animFireball,
  eye: animEye,
  shieldbug: animShieldbug,
  puffer: animPuffer,
  splitter: animSplitter,
};
// facing offset (radians, added to eTheta) per type: + turns the face toward travel direction
const FACE = {
  roller: (en) => (en.dir < 0 ? -1 : 1) * 0.72,
  bouncer: (en) => (en.dir < 0 ? -1 : 1) * 0.42,
  chaser: (en) => (en.dir < 0 ? -1 : 1) * 0.62,
  spiker: () => 0,
  molecule: () => 0,
  eye: (en) => (en.dir < 0 ? -1 : 1) * 0.2,
  fireball: () => 0,
  shieldbug: (en) => (en.dir < 0 ? -1 : 1) * 1.08,
  puffer: (en) => ((en.blowDir ?? en.dir) < 0 ? -1 : 1) * 0.95,
  splitter: (en) => (en.dir < 0 ? -1 : 1) * 0.4,
};

export function createEnemyModel(type, { chromeEnv = null, softDotTex = null } = {}) {
  const env = { chromeEnv, dot: softDotTex || softDot() };
  const kind = BUILD[type] ? type : 'bouncer';
  const g = new THREE.Group();
  g.name = 'enemy:' + type;
  const body = new THREE.Group();
  g.add(body);
  const ud = {
    type: kind,
    body,
    halo: null,
    shell: null,
    fx: [],
    st: {
      t: Math.random() * 10,
      face: null,
      blinkT: 0.5 + Math.random() * 3,
      blink: 0,
      lookX: 0,
      lookY: 0,
      flash: 0,
      freeze: 0,
      deathMax: 0,
      iceT: 0,
      wasFrozen: false,
      seed: Math.random(),
    },
  };
  g.userData = ud;
  BUILD[kind](g, body, ud, env);
  ud.shell = kind === 'fireball' ? new THREE.Object3D() : makeIce();
  g.add(ud.shell);
  const pop = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: ringTex(), color: ud.popColor || '#ffffff', transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending })
  );
  pop.visible = false;
  g.add(pop);
  ud.pop = pop;
  g.traverse((o) => {
    if (!o.isMesh || o.userData.outline || o.userData.noShadow || o.userData.shadowOnly) return;
    const m = o.material;
    if (m && !m.transparent && !m.isShaderMaterial && m.blending === THREE.NormalBlending) o.castShadow = true;
  });
  return g;
}

const _look = { yaw: 0, pitch: 0, dist: 99, tx: 0, ty: 0 };
function lookAtPogo(en, ctx, faceOff, eyeHeight = 0.28) {
  const p = ctx.player;
  _look.yaw = 0;
  _look.pitch = 0;
  _look.dist = 99;
  if (!p) return _look;
  const cols = ctx.COLS || 16;
  const colW = (TWO_PI * RING_R) / cols;
  const tx = colDist(en.col, p.col, cols) * colW;
  const ty = p.floor + 0.62 - (en.floor + eyeHeight);
  const tz = 1.1; // lean the gaze out toward the camera so faces stay readable
  const c = Math.cos(-faceOff);
  const s = Math.sin(-faceOff);
  const lx = tx * c + tz * s;
  const lz = -tx * s + tz * c;
  _look.yaw = Math.atan2(lx, lz);
  _look.pitch = Math.atan2(ty, Math.hypot(lx, lz));
  _look.dist = Math.hypot(tx, ty);
  _look.tx = tx;
  _look.ty = ty;
  return _look;
}

export function animateEnemy(group, en, ctx = {}) {
  const ud = group.userData;
  const st = ud.st;
  const time = ctx.time ?? 0;
  let dt = ctx.dt;
  if (!(dt >= 0)) dt = st.lastTime != null ? time - st.lastTime : 1 / 60;
  st.lastTime = time;
  dt = clamp(dt, 0, 0.1);

  // facing (quick turn when the direction flips)
  const goal = (FACE[ud.type] || FACE.bouncer)(en);
  st.face = st.face == null ? goal : damp(st.face, goal, 9, dt);
  group.rotation.y = (ctx.eTheta || 0) + st.face;

  // death pop: swell, flash white, burst ring, vanish
  if (en.dead) {
    if (!(en.deathTimer > 0)) {
      group.visible = false;
      return;
    }
    group.visible = true;
    st.deathMax = Math.max(st.deathMax, en.deathTimer);
    const k = 1 - en.deathTimer / (st.deathMax || 0.5);
    const sc = k < 0.4 ? 1 + 0.5 * smooth(0, 0.4, k) : 1.5 * (1 - smooth(0.4, 0.95, k));
    ud.body.scale.setScalar(Math.max(0.001, sc));
    ud.body.rotation.z = Math.sin(k * 40) * 0.15 * (1 - k);
    for (const u of ud.fx) {
      u.uFlash.value = clamp(k * 3, 0, 1) * 0.9;
      u.uFreeze.value = 0;
    }
    ud.shell.visible = false;
    ud.pop.visible = true;
    ud.pop.position.set(0, 0.05, 0.1);
    ud.pop.scale.setScalar(0.25 + smooth(0.2, 1, k) * 1.1);
    ud.pop.material.opacity = k < 0.25 ? 0 : (1 - smooth(0.25, 1, k)) * 0.95;
    if (ud.halo) {
      ud.halo.material.opacity = Math.max(0, 1 - k) * 0.9;
    }
    if (ud.shaderMats) for (const m of ud.shaderMats) m.uniforms.uFlash.value = clamp(k * 3, 0, 1) * 0.8;
    if (ud.alert) ud.alert.visible = false;
    if (ud.wind) ud.wind.visible = false;
    if (ud.trail) for (const sp of ud.trail) sp.material.opacity *= 0.8;
    return;
  }
  group.visible = true;
  ud.pop.visible = false;
  if (st.deathMax) {
    // recycled into a live enemy again
    st.deathMax = 0;
    ud.body.scale.setScalar(1);
    ud.body.rotation.z = 0;
  }

  const frozen = en.stunTimer > 0 && ud.type !== 'fireball';
  if (!frozen) st.t += dt;
  const flash = en.hitFlash > 0 ? clamp(en.hitFlash / 0.12, 0, 1) : 0;
  st.freeze = damp(st.freeze, frozen ? 1 : 0, frozen ? 16 : 5, dt);
  for (const u of ud.fx) {
    u.uFlash.value = flash * 0.72;
    u.uFreeze.value = st.freeze * 0.8;
  }
  const look = lookAtPogo(en, ctx, st.face, ud.eyeHeight ?? 0.28);
  const f = { dt, frozen, look, flash, time };
  ANIM[ud.type](group, ud, en, st, ctx, f);

  // hit punch (on top of whatever the type did)
  if (flash > 0 && !frozen) {
    const p = 1 + flash * 0.16;
    ud.body.scale.set(p, p, p);
    ud.body.position.x = Math.sin(time * 90) * 0.012 * flash;
  } else if (!ud.ownsBodyScale) {
    ud.body.scale.set(1, 1, 1);
    ud.body.position.x = 0;
  }
  updateIce(ud, st, en, frozen, dt, time);
}

function updateIce(ud, st, en, frozen, dt, time) {
  const ice = ud.shell;
  const meshes = ice.userData.meshes;
  if (!meshes) return;
  if (frozen && !st.wasFrozen) st.iceT = 0;
  st.wasFrozen = frozen;
  ice.visible = frozen;
  if (!frozen) return;
  st.iceT += dt;
  const k = clamp(st.iceT / 0.2, 0, 1);
  const pop = k < 1 ? 0.7 + 0.3 * k + Math.sin(k * Math.PI) * 0.12 : 1;
  const ending = en.stunTimer < 1;
  const amp = ending ? 0.006 + (1 - en.stunTimer) * 0.012 : 0;
  ice.scale.set(pop, k < 1 ? pop : 1, pop);
  ice.position.set(Math.sin(time * 61) * amp, 0, Math.cos(time * 47) * amp * 0.6);
  ice.rotation.y = ending ? Math.sin(time * 38) * amp * 2 : 0;
  const mats = iceMaterials(ending);
  if (meshes.front.material !== mats.front) {
    meshes.front.material = mats.front;
    meshes.back.material = mats.back;
  }
}

// ================================================================================================
// GUARDIAN OF DOOM — a colossal eye (~1.6 units across) in an obsidian-and-gold armoured frame:
// heavy spiked lids that grind open and shut, a molten iris with a slit pupil that tracks Pogo,
// a crown ring of eight great spikes holding eight HP gems, light leaking from the lid seam while
// shut, hit flashes, and a dramatic death (shudder, lids blown wide, spin, implode, burst).
// Local: centre at the origin, face toward +Z. The renderer owns the outer group's transform.
// ================================================================================================
const G_EYE_R = 0.425;
const G_LID_R = 0.49;
const G_RING_R = 0.635;
function gLidSDF(x, y, z) {
  const l = Math.hypot(x, y, z);
  let d = Math.abs(l - G_LID_R) - 0.03;
  d = smax(d, -y, 0.025);
  // heavy rolled edge
  d = smin(d, Math.hypot(Math.hypot(x, z) - G_LID_R - 0.004, y - 0.02) - 0.036, 0.02);
  // armour plate seams (latitude grooves)
  for (const lat of [0.62, 1.05]) {
    const ry = Math.sin(lat) * l;
    d = ssub(d, Math.max(Math.abs(y - ry) - 0.009, G_LID_R + 0.012 - l), 0.008);
  }
  // crest ridge over the top
  d = smin(d, smax(smax(Math.abs(x) - 0.03, Math.abs(l - G_LID_R - 0.03) - 0.03, 0.02), 0.7 * l - y, 0.03), 0.02);
  // crest horns, raking back
  for (const [th, len] of [
    [0.88, 0.24],
    [1.26, 0.33],
    [1.64, 0.25],
  ]) {
    const px = 0;
    const py = Math.sin(th) * (G_LID_R + 0.02);
    const pz = Math.cos(th) * (G_LID_R + 0.02);
    const ux = Math.sin(th);
    const uz = Math.cos(th);
    d = smin(d, sdRoundCone(x, y, z, px, py, pz, px, py + ux * len, pz + uz * len - 0.09, 0.058, 0.008), 0.03);
  }
  // rivets along the edge
  if (Math.abs(y - 0.052) < 0.05) for (let i = -4; i <= 4; i++) {
    const a = (i / 4) * 1.2;
    d = smin(d, sdSphere(x, y, z, Math.sin(a) * (G_LID_R + 0.036), 0.052, Math.cos(a) * (G_LID_R + 0.036), 0.015), 0.008);
  }
  return d;
}
function gRingSDF(x, y, z) {
  const rr = Math.hypot(x, y);
  let d = Math.hypot(rr - G_RING_R, (z + 0.06) * 1.35) / 1.35 - 0.052;
  // gem sockets
  for (let i = 0; i < 8; i++) {
    const a = Math.PI / 2 - (i / 8) * TWO_PI;
    d = smin(d, sdCyl(x, y, z, 'z', Math.cos(a) * G_RING_R, Math.sin(a) * G_RING_R, -0.03, 0.078, 0.04, 0.018), 0.02);
  }
  return d;
}
function gSpikeSDF(x, y, z) {
  let d = 1e9;
  const k0 = Math.round(((Math.PI / 2 - Math.atan2(y, x)) / TWO_PI) * 8 - 0.5);
  for (let i = k0 - 1; i <= k0 + 1; i++) {
    const a = Math.PI / 2 - ((i + 0.5) / 8) * TWO_PI;
    const c = Math.cos(a);
    const s = Math.sin(a);
    d = Math.min(d, sdRoundCone(x, y, z, c * 0.62, s * 0.62, -0.07, c * 0.87, s * 0.87, -0.11, 0.07, 0.008));
  }
  return d;
}
function guardianEyeTex() {
  return eyeTexture({
    key: 'guardian',
    sclera: ['#fff7ed', '#fde2d4', '#c2410c'],
    iris: [
      [0, '#fff7c2'],
      [0.25, '#fdba3a'],
      [0.6, '#ea580c'],
      [0.88, '#9f1239'],
      [1, '#2a0508'],
    ],
    irisR: 62,
    fibre: 'rgba(120,20,10,0.5)',
    ring: 'rgba(255,240,160,0.55)',
    limbal: '#1a0204',
    limbalW: 8,
    pupil: 'slit',
    pupilW: 11,
    pupilH: 50,
    veins: 26,
    veinColor: 'rgba(190,18,40,0.8)',
    glow: true,
  });
}

export function createGuardianModel({ chromeEnv = null, softDotTex = null } = {}) {
  const env = { chromeEnv, dot: softDotTex || softDot() };
  const g = new THREE.Group();
  g.name = 'guardian';
  const rig = new THREE.Group();
  g.add(rig);
  const ud = { rig, fx: [], st: { open: 0, t: 0, flash: 0, look: [0, 0], seam: 0 } };
  g.userData = ud;
  const armour = (rough = 0.28) =>
    physical(
      ud,
      { vertexColors: true, metalness: 1, roughness: rough, envMap: env.chromeEnv, envMapIntensity: 1.1, clearcoat: 0.8, clearcoatRoughness: 0.15 },
      { metalMask: true, paintRough: 0.35, rim: '#ffb27a', rimStrength: 0.4 }
    );
  // eyeball
  const tex = guardianEyeTex();
  const eyeMat = reg(ud, eyeMaterial(tex, '#ff7a1a', 0.9));
  eyeMat.roughness = 0.08;
  const ball = new THREE.Mesh(
    cached('geo:gBall', () => {
      const s = new THREE.SphereGeometry(G_EYE_R, 48, 32);
      s.rotateY(-Math.PI / 2);
      return s;
    }),
    eyeMat
  );
  rig.add(ball);
  addOutline(ball, 0.014);
  const glints = new THREE.Mesh(
    glintGeo('guardian', [
      [-0.14, 0.15, 0.375, 0.045],
      [0.11, -0.09, 0.4, 0.02],
    ]),
    GLINT_MAT
  );
  glints.userData.noShadow = true;
  rig.add(glints);
  // lids
  const lidGeoU = sculpt('gLid', gLidSDF, [-0.56, -0.06, -0.62], [0.56, 0.86, 0.62], 0.025, (x, y, z, c) => {
    const l = Math.hypot(x, y, z);
    const ax = Math.abs(x);
    c.set('#33245e');
    c.lerp(C('#140c28'), smooth(0.2, 0.8, y / l));
    // gold trim on the rolled edge and rivets; dark crest; horns with blood-red tips
    const edge = y < 0.06 && Math.hypot(x, z) > G_LID_R - 0.02;
    const horn = l > G_LID_R + 0.07;
    if (horn) {
      c.set('#241640').lerp(C('#dc2626'), smooth(0.66, 0.76, l));
      return smooth(0.76, 0.66, l);
    }
    if (edge) {
      c.set('#f59e0b');
      return 1;
    }
    if (ax < 0.034 && l > G_LID_R + 0.02) c.set('#1a1030');
    // seams
    if (l < G_LID_R + 0.02) c.set('#07040f');
    return 0.85;
  }, { aoScale: 2 });
  const lidGeoL = cached('geo:gLidLower', () => {
    const m = lidGeoU.clone();
    m.userData = { ao: lidGeoU.userData.ao }; // clone() shares userData by reference
    m.scale(1, -1, 1);
    const a = m.index.array;
    for (let i = 0; i < a.length; i += 3) {
      const t = a[i + 1];
      a[i + 1] = a[i + 2];
      a[i + 2] = t;
    }
    if (lidGeoU.userData.hull) {
      const h = lidGeoU.userData.hull.clone();
      h.scale(1, -1, 1);
      const b = h.index.array;
      for (let i = 0; i < b.length; i += 3) {
        const t = b[i + 1];
        b[i + 1] = b[i + 2];
        b[i + 2] = t;
      }
      m.userData.hull = h;
    }
    return m;
  });
  const lidMat = armour(0.3);
  const upper = new THREE.Group();
  const lower = new THREE.Group();
  rig.add(upper, lower);
  const lidU = new THREE.Mesh(lidGeoU, lidMat);
  const lidL = new THREE.Mesh(lidGeoL, lidMat);
  upper.add(lidU);
  lower.add(lidL);
  addOutline(lidU, 0.014);
  addOutline(lidL, 0.014);
  // light leaking through the seam while shut
  const seamMat = basic(C('#ff5a1f').multiplyScalar(1.6), { transparent: true, opacity: 1, depthWrite: false, blending: THREE.AdditiveBlending });
  const seam = new THREE.Mesh(
    cached('geo:gSeam', () => {
      const t = new THREE.TorusGeometry(G_EYE_R + 0.03, 0.018, 6, 48, Math.PI * 0.9);
      t.rotateZ(Math.PI * 0.05);
      t.rotateX(Math.PI / 2);
      return t;
    }),
    seamMat
  );
  seam.userData.noShadow = true;
  rig.add(seam);
  // crown ring, spikes, HP gems
  const ringGeo = sculpt('gRing', gRingSDF, [-0.74, -0.74, -0.16], [0.74, 0.74, 0.06], 0.019, (x, y, z, c) => {
    const rr = Math.hypot(x, y);
    c.set('#251944');
    if (Math.abs(rr - G_RING_R) > 0.04 && z > -0.09) c.set('#f59e0b');
    let sock = 9;
    for (let i = 0; i < 8; i++) {
      const a = Math.PI / 2 - (i / 8) * TWO_PI;
      sock = Math.min(sock, Math.hypot(x - Math.cos(a) * G_RING_R, y - Math.sin(a) * G_RING_R));
    }
    if (sock < 0.08 && z > -0.03) c.set('#d97706');
    if (sock < 0.05 && z > -0.02) c.set('#140a1f');
    return sock < 0.05 ? 0.2 : 1;
  });
  const ring = new THREE.Mesh(ringGeo, armour(0.25));
  rig.add(ring);
  addOutline(ring, 0.012);
  const spikeGeo = sculpt('gSpikes', gSpikeSDF, [-0.92, -0.92, -0.2], [0.92, 0.92, 0.04], 0.018, (x, y, z, c) => {
    const rr = Math.hypot(x, y);
    c.set('#2e2152').lerp(C('#ef4444'), smooth(0.72, 0.86, rr));
    return smooth(0.86, 0.72, rr);
  });
  const spikeMat = emissiveFromColor(armour(0.3));
  spikeMat.emissive = C('#ff3b1f');
  spikeMat.emissiveIntensity = 0;
  const spikes = new THREE.Mesh(spikeGeo, spikeMat);
  rig.add(spikes);
  addOutline(spikes, 0.012);
  const gemGeo = cached('geo:gGem', () => {
    const o = new THREE.OctahedronGeometry(0.075, 0);
    o.scale(0.8, 1.15, 0.6);
    return o;
  });
  const gemLit = new THREE.MeshStandardMaterial({ color: '#ffd166', emissive: '#ff8a00', emissiveIntensity: 1.6, roughness: 0.15, metalness: 0.2, flatShading: true });
  const gemOut = new THREE.MeshStandardMaterial({ color: '#2a2238', emissive: '#000000', roughness: 0.4, metalness: 0.6, flatShading: true, envMap: env.chromeEnv });
  const gems = [];
  for (let i = 0; i < 8; i++) {
    const a = Math.PI / 2 - (i / 8) * TWO_PI;
    const gem = new THREE.Mesh(gemGeo, gemLit);
    gem.position.set(Math.cos(a) * G_RING_R, Math.sin(a) * G_RING_R, 0.03);
    gem.rotation.z = a - Math.PI / 2;
    gem.userData.base = gem.position.clone();
    rig.add(gem);
    gems.push(gem);
  }
  const gemHalos = [];
  for (const gem of gems) {
    const h = additiveSprite(env.dot, '#ffb020', 0.36, 0.7);
    h.position.copy(gem.position).setZ(0.07);
    rig.add(h);
    gemHalos.push(h);
  }
  const halo = additiveSprite(env.dot, '#ff3d2e', 3.4, 0.5);
  halo.position.z = -0.35;
  rig.add(halo);
  const burst = new THREE.Sprite(new THREE.SpriteMaterial({ map: ringTex(), color: '#ffd27a', transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
  burst.visible = false;
  burst.position.z = 0.4;
  rig.add(burst);
  rig.traverse((o) => {
    if (!o.isMesh || o.userData.outline || o.userData.noShadow) return;
    const m = o.material;
    if (m && !m.transparent && !m.isShaderMaterial) o.castShadow = true;
  });
  Object.assign(ud, { ball, eyeMat, upper, lower, lidMat, seam, seamMat, ring, spikes, spikeMat, gems, gemLit, gemOut, gemHalos, halo, burst, body: rig, shell: null });
  return g;
}

const G_HALO_SLEEP = C('#7c2d12');
const G_HALO_AWAKE = C('#ff3d2e');
export function animateGuardian(group, boss, ctx = {}) {
  const ud = group.userData;
  const st = ud.st;
  const time = ctx.time ?? 0;
  let dt = ctx.dt;
  if (!(dt >= 0)) dt = st.lastTime != null ? time - st.lastTime : 1 / 60;
  st.lastTime = time;
  dt = clamp(dt, 0, 0.1);
  st.t += dt;
  const t = st.t;
  const rig = ud.rig;
  if (!boss) {
    group.visible = false;
    return;
  }
  const dead = Boolean(boss.dead);
  const D = dead ? boss.deathT || 0 : 0;
  if (dead && D >= 1.25) {
    group.visible = false;
    return;
  }
  group.visible = true;
  const asleep = !boss.awake && !dead;
  const hit = boss.hitFlash > 0 ? clamp(boss.hitFlash / 0.25, 0, 1) : 0;

  // lids: shut while asleep or guarding, wide open when vulnerable, blown open on death
  const openGoal = dead ? 1.15 : asleep ? 0 : boss.open ? 1 : 0;
  st.open = damp(st.open, openGoal, boss.open || dead ? 9 : 6, dt);
  const o = st.open;
  const flinch = hit * 0.25; // squint on a hit
  // awake but guarding: a thin glowing slit stays open between the lids
  const shut = asleep ? 0.0 : 0.15;
  const upEdge = mix(shut - 0.03, 0.95, o) - flinch;
  const loEdge = mix(-shut + 0.03, -0.85, o) + flinch * 0.8;
  ud.upper.rotation.x = -upEdge;
  ud.lower.rotation.x = -loEdge;

  // iris tracks Pogo (Pogo is between the guardian and the tower: bias the gaze out)
  const p = ctx.player;
  let yaw = 0;
  let pitch = 0;
  if (p && !asleep) {
    const cols = ctx.COLS || 16;
    const tx = colDist(boss.col ?? 0, p.col, cols) * ((TWO_PI * 3.2) / cols);
    const ty = p.floor + 0.6 - ((boss.floor ?? p.floor) + 0.5);
    yaw = clamp(Math.atan2(tx, 2.2), -0.6, 0.6);
    pitch = clamp(Math.atan2(ty, Math.hypot(tx, 2.2)), -0.45, 0.45);
  }
  if (dead) {
    yaw = Math.sin(t * 37) * 0.3;
    pitch = Math.cos(t * 29) * 0.25;
  }
  st.look[0] = damp(st.look[0], yaw, 7, dt);
  st.look[1] = damp(st.look[1], pitch, 7, dt);
  aimEye(ud.ball, st.look[0], st.look[1]);

  // glow & flashes
  const wake = asleep ? 0 : 1;
  const pulse = 0.5 + 0.5 * Math.sin(t * (asleep ? 1.2 : 4));
  ud.eyeMat.emissiveIntensity = (0.7 + pulse * 0.4) * (asleep ? 0.3 : 1) + hit * 2.5 + (dead ? 1.5 : 0);
  const flash = Math.max(hit * 0.42, dead ? clamp(1 - D * 2.5, 0, 1) * 0.7 + (Math.sin(D * 50) > 0.6 ? 0.3 : 0) : 0);
  for (const u of ud.fx) {
    u.uFlash.value = flash;
    u.uFreeze.value = 0;
  }
  ud.spikeMat.emissiveIntensity = asleep ? 0.15 + pulse * 0.1 : 0.6 + pulse * 0.5 + hit * 2;
  const seamOn = (1 - smooth(0.05, 0.25, o)) * (asleep ? 0.35 + pulse * 0.25 : 0.8 + pulse * 0.4);
  ud.seam.visible = seamOn > 0.02;
  ud.seamMat.opacity = seamOn;
  ud.halo.material.opacity = asleep ? 0.12 + pulse * 0.06 : 0.35 + o * 0.2 + pulse * 0.1 + hit * 0.5;
  ud.halo.material.color.copy(asleep ? G_HALO_SLEEP : G_HALO_AWAKE);

  // HP gems: lit while remaining, dark when spent; the next to go flickers
  const hp = boss.hp ?? 8;
  ud.gems.forEach((gem, i) => {
    const lit = !dead && i < hp && boss.awake !== false;
    gem.material = lit ? ud.gemLit : ud.gemOut;
    const h = ud.gemHalos[i];
    h.visible = lit;
    if (lit) {
      const last = i === hp - 1 && hp < (boss.maxHp ?? 8);
      h.material.opacity = 0.45 + Math.sin(t * 6 + i) * 0.12 + (last ? Math.sin(t * 20) * 0.25 : 0);
    }
    gem.rotation.y = t * 1.5 + i;
    if (!dead) gem.position.copy(gem.userData.base);
  });
  ud.gemLit.emissiveIntensity = 1.3 + Math.sin(t * 5) * 0.3;

  // body motion
  if (dead) {
    // shudder, then spin up, swell and implode with a burst; gems and spikes fly off
    const k1 = smooth(0, 0.45, D);
    const k2 = smooth(0.45, 1.15, D);
    const shake = (1 - k2) * 0.05;
    rig.position.set(Math.sin(t * 61) * shake, Math.cos(t * 53) * shake, 0);
    rig.rotation.z = k2 * k2 * 9;
    rig.rotation.x = Math.sin(t * 40) * 0.05 * (1 - k2);
    const sc = (1 + k1 * 0.18) * (1 - k2 * k2);
    rig.scale.setScalar(Math.max(0.001, sc));
    ud.spikes.scale.setScalar(1 + k2 * 0.9);
    ud.gems.forEach((gem, i) => {
      gem.position.copy(gem.userData.base).multiplyScalar(1 + k2 * 1.6);
      gem.position.z = k2 * 0.4;
    });
    ud.burst.visible = D > 0.35;
    const kb = smooth(0.35, 1.2, D);
    ud.burst.scale.setScalar(0.5 + kb * 4.5);
    ud.burst.material.opacity = (1 - kb) * 0.95;
    ud.halo.material.opacity = 0.6 + k1 * 0.6 - k2 * 0.8;
    ud.halo.scale.setScalar(3.4 + k1 * 1.5);
  } else {
    const bob = asleep ? Math.sin(t * 0.9) * 0.02 : Math.sin(t * 1.7) * 0.035;
    const recoil = hit * 0.06;
    rig.position.set(Math.sin(t * 70) * hit * 0.03, bob, -recoil);
    const breathe = asleep ? 0.9 + Math.sin(t * 0.9) * 0.015 : 1 + hit * 0.06;
    rig.scale.setScalar(breathe);
    rig.rotation.set(asleep ? 0.12 : -st.look[1] * 0.15, asleep ? 0 : st.look[0] * 0.2, asleep ? Math.sin(t * 0.6) * 0.04 : Math.sin(t * 0.8) * 0.03);
    ud.spikes.scale.setScalar(1 + (asleep ? 0 : Math.sin(t * 4) * 0.01));
    ud.burst.visible = false;
    ud.halo.scale.setScalar(3.4 * (asleep ? 0.8 : 1));
  }
}

// Build every cached geometry/texture up front (e.g. behind a loading screen) so the first
// appearance of an enemy type never hitches.
export function warmEnemyModels(opts = {}) {
  for (const type of Object.keys(BUILD)) createEnemyModel(type, opts);
  createGuardianModel(opts);
}
// Same, but one model per frame/idle slot so a menu or loading screen keeps animating.
// Resolves when everything is cached. `types` limits it (e.g. to the next tower's roster).
export function warmEnemyModelsAsync(opts = {}, types = [...Object.keys(BUILD), 'guardian']) {
  const queue = [...types];
  const later = (fn) => (typeof requestIdleCallback === 'function' ? requestIdleCallback(fn, { timeout: 120 }) : setTimeout(fn, 16));
  return new Promise((resolve) => {
    const step = () => {
      const t = queue.shift();
      if (!t) return resolve();
      try {
        if (t === 'guardian') createGuardianModel(opts);
        else createEnemyModel(t, opts);
      } catch (e) {
        console.warn('enemy warm-up failed for', t, e);
      }
      later(step);
    };
    later(step);
  });
}
