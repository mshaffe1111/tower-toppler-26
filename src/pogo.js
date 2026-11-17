import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { mergeGeometries as rawMergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/**
 * TOWER TOPPLER '26 — Next-Gen Hierarchical Skeletal Hero & Skins (src/pogo.js)
 *
 * Studio-Grade Dual-Layer Sculpted Character Architecture:
 * 1. Zero-Primitive Sculpted Organic Rig (Instant Frame-0 & Fallback):
 *    - Continuous RBF-sculpted Gecko-Frog Head with tilted almond supraorbital/infraorbital
 *      sockets, nostril swells, sculpted smile crease, and smooth two-tone vertex skin/belly/AO.
 *    - Continuous sculpted torso/pelvis, anatomical muscular LatheGeometry thighs/calves/arms,
 *      3-fingered adhesive-pad gecko hands, and 3-toed scalloped-webbed amphibian feet.
 *    - Saddle-stitched weathered leather chest harness with brushed-brass explorer buckle,
 *      pillowed woven-canvas rucksack with Cryo-Cell canister, and contoured Cryo-Blaster.
 * 2. Asynchronous Blender `.glb` Integration (`assets/models/pogo.glb`):
 *    - Loads `assets/models/pogo.glb` once via GLTFLoader, calibrates/aligns each named node
 *      into its exact PogoRig bone space (`M_bone_bind^-1 * M_part_world`), and binds named
 *      material slots (`mat_body`, `mat_belly`, `mat_crest`, `mat_harness`, `mat_pack`,
 *      `mat_eye`, `mat_accent`) directly to PogoRig's live PBR materials across all 8 skins
 *      and both `'reboot'` / `'original'` eras.
 */

export const POGO_SKINS = [
  {
    id: 'default_amphibian',
    name: 'Explorer Pogo',
    bodyColor: '#66c478',
    bellyColor: '#e6dca0',
    crestColor: '#78d28c',
    vestColor: '#ccb68c',
    harnessColor: '#422616',
    packColor: '#c4ae82',
    eyeGlow: '#9e6628',
    accentColor: '#38bdf8',
    metallic: 0,
  },
  {
    id: 'deep_diver',
    name: 'Abyssal Diver',
    bodyColor: '#0f4c5c',
    bellyColor: '#8db4c0',
    crestColor: '#22d3ee',
    vestColor: '#64748b',
    harnessColor: '#b47b38',
    packColor: '#334155',
    eyeGlow: '#38bdf8',
    accentColor: '#67e8f9',
    metallic: 0.18,
  },
  {
    id: 'poison_dart',
    name: 'Cobalt Dart',
    bodyColor: '#1d4ed8',
    bellyColor: '#93c5fd',
    crestColor: '#f97316',
    vestColor: '#475569',
    harnessColor: '#1e293b',
    packColor: '#273449',
    eyeGlow: '#fb923c',
    accentColor: '#facc15',
    metallic: 0,
  },
  {
    id: 'clockwork_brass',
    name: 'Foundry Automaton',
    bodyColor: '#b45309',
    bellyColor: '#f59e0b',
    crestColor: '#d97706',
    vestColor: '#92400e',
    harnessColor: '#3f3f46',
    packColor: '#78350f',
    eyeGlow: '#fbbf24',
    accentColor: '#fb923c',
    metallic: 0.88,
  },
  {
    id: 'frost_warden',
    name: 'Glacier Warden',
    bodyColor: '#67e8f9',
    bellyColor: '#ecfeff',
    crestColor: '#e0f2fe',
    vestColor: '#cbd5e1',
    harnessColor: '#475569',
    packColor: '#0284c7',
    eyeGlow: '#a5f3fc',
    accentColor: '#38bdf8',
    metallic: 0.16,
  },
  {
    id: 'shadow_infiltrator',
    name: 'Night Ops',
    bodyColor: '#1e1b4b',
    bellyColor: '#475569',
    crestColor: '#312e81',
    vestColor: '#334155',
    harnessColor: '#0f172a',
    packColor: '#1e293b',
    eyeGlow: '#10b981',
    accentColor: '#34d399',
    metallic: 0.24,
  },
  {
    id: 'retro_1987',
    name: "Classic '87 Tribute",
    bodyColor: '#22c55e',
    bellyColor: '#fde047',
    crestColor: '#4ade80',
    vestColor: '#facc15',
    harnessColor: '#ea580c',
    packColor: '#f8fafc',
    eyeGlow: '#38bdf8',
    accentColor: '#ef4444',
    metallic: 0,
  },
  {
    id: 'golden_toppler',
    name: 'Sovereign Gold',
    bodyColor: '#eab308',
    bellyColor: '#fef08a',
    crestColor: '#9333ea',
    vestColor: '#fde047',
    harnessColor: '#581c87',
    packColor: '#6b21a8',
    eyeGlow: '#e879f9',
    accentColor: '#c084fc',
    metallic: 0.92,
  },
];

const SKIN_MAP = new Map(POGO_SKINS.map((s) => [s.id, s]));
SKIN_MAP.set('explorer', POGO_SKINS[0]);

// Explorer Pogo V3/V3.5 kinematic constants (exact 1:1 meter bind alignment with pogo.glb)
const LEG_UPPER_LEN = 0.112;
const LEG_LOWER_LEN = 0.108;
const HIP_OFFSET_Y = -0.008;
const FOOT_SOLE_HEIGHT = 0.024;
const BASE_PELVIS_Y = 0.252;

let _sharedSurfaceMaps = null;
let _sharedPogoGlbPromise = null;
const _derivedTexPool = new Map();
// Unused UV zone at (u = 0.50, v_gltf = 0.985) between feet: zero trunk/limb overlap even with full mipmaps!
const SKIN_WHITE_UV_U = 0.5;
const SKIN_WHITE_UV_V = 0.985;
// Rear eyeball socket pole (173°–180° inside skull) & solid iris emissive swatch
const EYE_CATCH_UV_U = 0.96;
const EYE_CATCH_UV_V = 0.04;
const EYE_SOLID_IRIS_UV_U = 0.14;
const EYE_SOLID_IRIS_UV_V = 0.95;
const EYE_SOLID_NONE_UV_U = 0.06;
const EYE_SOLID_NONE_UV_V = 0.04;

function linearToSrgbByte(c) {
  const v = c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
  return Math.max(0, Math.min(255, Math.round(v * 255)));
}

/**
 * Builds a derived CanvasTexture (`mode === 'skinWhite' | 'desat' | 'desatRepeat' | 'eyeWhite' | 'velvetRough'`)
 * with full trilinear mipmaps enabled (`LinearMipmapLinearFilter`) and reference-counted cleanup
 * so `dispose()` guarantees `dTex = 0`.
 */
function buildDerivedGlbMap(srcTex, mode) {
  if (!srcTex || !srcTex.image) {
    return mode === 'skinWhite' || mode === 'eyeWhite' || mode === 'velvetRough' ? srcTex || null : null;
  }
  if (typeof document === 'undefined' || typeof document.createElement !== 'function') {
    return mode === 'skinWhite' || mode === 'eyeWhite' || mode === 'velvetRough' ? srcTex : null;
  }

  try {
    const img = srcTex.image;
    const isDesat = mode === 'desat' || mode === 'desatRepeat';
    const w = isDesat ? Math.min(512, img.width || 256) : img.width || 256;
    const h = isDesat ? Math.min(512, img.height || 256) : img.height || 256;
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return srcTex;

    ctx.drawImage(img, 0, 0, w, h);

    if (isDesat) {
      const imgData = ctx.getImageData(0, 0, w, h);
      const d = imgData.data;
      let sumL = 0;
      const n = w * h;
      for (let i = 0; i < d.length; i += 4) {
        sumL += 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];
      }
      const avgL = Math.max(1, sumL / Math.max(1, n));
      for (let i = 0; i < d.length; i += 4) {
        const lum = 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];
        const v = Math.max(92, Math.min(255, Math.round(212 * Math.pow(lum / avgL, 0.65))));
        d[i] = v;
        d[i + 1] = v;
        d[i + 2] = v;
      }
      ctx.putImageData(imgData, 0, 0);
    } else if (mode === 'velvetRough') {
      // Preserve V3's baked 0.60..0.72 velvety matte amphibian roughness while clamping any shiny outliers >= 0.58!
      const imgData = ctx.getImageData(0, 0, w, h);
      const d = imgData.data;
      for (let i = 0; i < d.length; i += 4) {
        const raw = d[i + 1];
        const v = raw >= 145 ? Math.min(204, raw) : Math.max(148, Math.round(148 + (raw / 145) * 28));
        d[i] = v;
        d[i + 1] = v;
        d[i + 2] = v;
      }
      ctx.putImageData(imgData, 0, 0);
    }

    if (mode === 'eyeWhite') {
      const patch = Math.max(8, Math.round(w * 0.07));
      const rectY = srcTex.flipY ? Math.max(0, h - patch) : 0;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(Math.max(0, w - patch), rectY, patch, patch);
    } else if (mode !== 'desatRepeat') {
      // Stamp swatch in empty space between feet (u = 0.50, v_gltf -> 1.0)
      const pw = Math.max(10, Math.round(w * 0.08));
      const ph = Math.max(10, Math.round(h * 0.08));
      const rx = Math.max(0, Math.round(w * 0.5 - pw * 0.5));
      const ry = srcTex.flipY ? 0 : Math.max(0, h - ph);
      ctx.fillStyle = mode === 'velvetRough' ? '#aeaeae' : '#ffffff';
      ctx.fillRect(rx, ry, pw, ph);
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.flipY = Boolean(srcTex.flipY);
    if (mode === 'desatRepeat') {
      tex.wrapS = srcTex.wrapS || THREE.RepeatWrapping;
      tex.wrapT = srcTex.wrapT || THREE.RepeatWrapping;
    } else {
      tex.wrapS = THREE.ClampToEdgeWrapping;
      tex.wrapT = THREE.ClampToEdgeWrapping;
    }
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.generateMipmaps = true;
    tex.repeat.copy(srcTex.repeat);
    tex.offset.copy(srcTex.offset);
    if (mode !== 'velvetRough') {
      tex.colorSpace = THREE.SRGBColorSpace;
    }
    return tex;
  } catch {
    return mode === 'desat' || mode === 'desatRepeat' ? null : srcTex;
  }
}

/**
 * Normalizes and merges an array of BufferGeometries into a single draw-call geometry,
 * disposing temporary intermediate clones cleanly.
 */
function mergeNormalizedGeometries(geos, withColor = false) {
  if (!geos || geos.length === 0) return null;
  const norm = [];
  for (let i = 0; i < geos.length; i++) {
    const src = geos[i];
    if (!src || !src.attributes || !src.attributes.position) continue;
    const g = src.index ? src.toNonIndexed() : src.clone();
    const count = g.attributes.position.count;
    if (!g.attributes.normal) g.computeVertexNormals();
    if (!g.attributes.uv) {
      g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(count * 2), 2));
    } else if (g.attributes.uv.itemSize !== 2) {
      const uv2 = new Float32Array(count * 2);
      for (let k = 0; k < count; k++) {
        uv2[k * 2] = g.attributes.uv.getX(k);
        uv2[k * 2 + 1] = g.attributes.uv.getY(k);
      }
      g.setAttribute('uv', new THREE.BufferAttribute(uv2, 2));
    }
    if (withColor && !g.attributes.color) {
      const cols = new Float32Array(count * 3);
      cols.fill(1);
      g.setAttribute('color', new THREE.BufferAttribute(cols, 3));
    } else if (withColor && g.attributes.color.itemSize !== 3) {
      const cols = new Float32Array(count * 3);
      for (let k = 0; k < count; k++) {
        cols[k * 3] = g.attributes.color.getX(k);
        cols[k * 3 + 1] = g.attributes.color.getY(k);
        cols[k * 3 + 2] = g.attributes.color.getZ(k);
      }
      g.setAttribute('color', new THREE.BufferAttribute(cols, 3));
    }
    for (const attrName of Object.keys(g.attributes)) {
      const keep =
        attrName === 'position' ||
        attrName === 'normal' ||
        attrName === 'uv' ||
        (withColor && attrName === 'color');
      if (!keep) g.deleteAttribute(attrName);
    }
    g.morphAttributes = {};
    norm.push(g);
  }
  if (norm.length === 0) return null;
  const merged = norm.length === 1 ? norm[0].clone() : rawMergeGeometries(norm, false);
  for (let i = 0; i < norm.length; i++) norm[i].dispose();
  return merged;
}

function fillConstantUv(geo, u, v) {
  const count = geo.attributes.position.count;
  let uvAttr = geo.attributes.uv;
  if (!uvAttr || uvAttr.itemSize !== 2) {
    uvAttr = new THREE.BufferAttribute(new Float32Array(count * 2), 2);
    geo.setAttribute('uv', uvAttr);
  }
  const arr = uvAttr.array;
  for (let i = 0; i < count; i++) {
    arr[i * 2] = u;
    arr[i * 2 + 1] = v;
  }
  uvAttr.needsUpdate = true;
}

/**
 * Loads `assets/models/pogo.glb` once per session when running in a browser environment.
 */
function loadSharedPogoGlb() {
  if (_sharedPogoGlbPromise !== null) return _sharedPogoGlbPromise;
  if (typeof window === 'undefined' || typeof fetch !== 'function') {
    _sharedPogoGlbPromise = Promise.resolve(null);
    return _sharedPogoGlbPromise;
  }

  _sharedPogoGlbPromise = new Promise((resolve) => {
    try {
      const loader = new GLTFLoader();
      loader.load(
        'assets/models/pogo.glb',
        (gltf) => resolve(gltf && gltf.scene ? gltf.scene : null),
        undefined,
        () => resolve(null)
      );
    } catch {
      resolve(null);
    }
  });
  return _sharedPogoGlbPromise;
}

/**
 * Generates shared procedural micro-detail maps:
 * 1. Amphibian dermal pebble bump + dampness roughness map
 * 2. Saddle-stitched leather grain bump map for harness straps
 * 3. Woven explorer canvas bump map for backpack
 * Safely returns null in headless Node environments without Canvas 2D.
 */
function getSharedSurfaceMaps() {
  if (_sharedSurfaceMaps !== null) return _sharedSurfaceMaps;
  if (typeof document === 'undefined' || typeof document.createElement !== 'function') {
    _sharedSurfaceMaps = false;
    return null;
  }

  try {
    const size = 128;
    const bumpCanvas = document.createElement('canvas');
    bumpCanvas.width = size;
    bumpCanvas.height = size;
    const bCtx = bumpCanvas.getContext('2d');

    const roughCanvas = document.createElement('canvas');
    roughCanvas.width = size;
    roughCanvas.height = size;
    const rCtx = roughCanvas.getContext('2d');

    const leatherCanvas = document.createElement('canvas');
    leatherCanvas.width = size;
    leatherCanvas.height = size;
    const lCtx = leatherCanvas.getContext('2d');

    const canvasWeave = document.createElement('canvas');
    canvasWeave.width = 64;
    canvasWeave.height = 64;
    const wCtx = canvasWeave.getContext('2d');

    if (!bCtx || !rCtx || !lCtx || !wCtx) {
      _sharedSurfaceMaps = false;
      return null;
    }

    // 1. Amphibian micro-dermal pores (velvety matte-satin micro-roughness, zero oily vinyl glare!)
    bCtx.fillStyle = '#787878';
    bCtx.fillRect(0, 0, size, size);
    rCtx.fillStyle = '#eaeaea';
    rCtx.fillRect(0, 0, size, size);

    let seed = 0x51f2a9c3;
    const rand = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 4294967296;
    };

    for (let i = 0; i < 320; i++) {
      const x = rand() * size;
      const y = rand() * size;
      const r = 1.6 + rand() * 2.7;
      const shade = Math.floor(138 + rand() * 75);
      const damp = Math.floor(218 + rand() * 34);

      for (const ox of [-size, 0, size]) {
        for (const oy of [-size, 0, size]) {
          const px = x + ox;
          const py = y + oy;
          if (px < -r || px > size + r || py < -r || py > size + r) continue;

          bCtx.fillStyle = `rgb(${shade},${shade},${shade})`;
          bCtx.beginPath();
          bCtx.arc(px, py, r, 0, Math.PI * 2);
          bCtx.fill();

          rCtx.fillStyle = `rgb(${damp},${damp},${damp})`;
          bCtx.beginPath();
          rCtx.arc(px, py, r * 1.15, 0, Math.PI * 2);
          rCtx.fill();
        }
      }
    }

    // 2. Saddle-stitched leather strap bump (creased borders + dashed edge stitches)
    lCtx.fillStyle = '#808080';
    lCtx.fillRect(0, 0, size, size);
    for (let i = 0; i < 240; i++) {
      const lx = rand() * size;
      const ly = rand() * size;
      const lv = Math.floor(110 + rand() * 45);
      lCtx.fillStyle = `rgb(${lv},${lv},${lv})`;
      lCtx.fillRect(lx, ly, 3, 2);
    }
    lCtx.fillStyle = '#484848';
    lCtx.fillRect(0, 10, size, 3);
    lCtx.fillRect(0, size - 13, size, 3);
    lCtx.fillStyle = '#e8e8e8';
    for (let sx = 4; sx < size; sx += 12) {
      lCtx.fillRect(sx, 14, 6, 2.5);
      lCtx.fillRect(sx, size - 16.5, 6, 2.5);
    }

    // 3. Heavy woven canvas explorer pack bump
    wCtx.fillStyle = '#7c7c7c';
    wCtx.fillRect(0, 0, 64, 64);
    for (let y = 0; y < 64; y += 4) {
      for (let x = 0; x < 64; x += 4) {
        const bright = ((x + y) / 4) % 2 === 0 ? '#a8a8a8' : '#585858';
        wCtx.fillStyle = bright;
        wCtx.fillRect(x, y, 3, 3);
      }
    }

    const skinBump = new THREE.CanvasTexture(bumpCanvas);
    skinBump.wrapS = THREE.RepeatWrapping;
    skinBump.wrapT = THREE.RepeatWrapping;
    skinBump.repeat.set(3, 3);

    const skinRough = new THREE.CanvasTexture(roughCanvas);
    skinRough.wrapS = THREE.RepeatWrapping;
    skinRough.wrapT = THREE.RepeatWrapping;
    skinRough.repeat.set(3, 3);

    const leatherBump = new THREE.CanvasTexture(leatherCanvas);
    leatherBump.wrapS = THREE.RepeatWrapping;
    leatherBump.wrapT = THREE.RepeatWrapping;
    leatherBump.repeat.set(4, 1);

    const packBump = new THREE.CanvasTexture(canvasWeave);
    packBump.wrapS = THREE.RepeatWrapping;
    packBump.wrapT = THREE.RepeatWrapping;
    packBump.repeat.set(3, 3);

    _sharedSurfaceMaps = { skinBump, skinRough, leatherBump, packBump };
    return _sharedSurfaceMaps;
  } catch {
    _sharedSurfaceMaps = false;
    return null;
  }
}

function damp(current, target, lambda, dt) {
  return THREE.MathUtils.lerp(current, target, 1 - Math.exp(-lambda * dt));
}

function dampAngle(current, target, lambda, dt) {
  let delta = (target - current) % (Math.PI * 2);
  if (delta > Math.PI) delta -= Math.PI * 2;
  if (delta < -Math.PI) delta += Math.PI * 2;
  return current + delta * (1 - Math.exp(-lambda * dt));
}

function smoothstep(edge0, edge1, x) {
  const t = THREE.MathUtils.clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

function gaussian3(dx, dy, dz, invSigmaSq) {
  return Math.exp(-(dx * dx + dy * dy + dz * dz) * invSigmaSq);
}

/**
 * Continuous RBF-sculpted Gecko-Frog Head BufferGeometry:
 * Broad heart/wedge skull, tilted almond supraorbital & infraorbital sockets,
 * tapered friendly snout, subtle nostril swells, and per-vertex skin/belly/AO weights.
 */
function createSculptedHeadGeometry() {
  const geo = new THREE.SphereGeometry(1, 40, 28);
  const pos = geo.attributes.position;
  const count = pos.count;
  const bellyWeights = new Float32Array(count);
  const shadeWeights = new Float32Array(count);
  const colors = new Float32Array(count * 3);

  for (let i = 0; i < count; i++) {
    const nx = pos.getX(i);
    const ny = pos.getY(i);
    const nz = pos.getZ(i);

    let x = nx * 0.148;
    let y = ny * 0.106 + 0.082;
    let z = nz * 0.134 - 0.004;

    // 1. Sleek heart-shaped temporal/cheek flare
    const cheekFlare =
      Math.exp(-((ny + 0.1) * (ny + 0.1)) * 3.4) *
      Math.exp(-((nz - 0.06) * (nz - 0.06)) * 2.3);
    x *= 1 + 0.17 * cheekFlare;

    // 2. Tapered friendly frog/gecko snout (+Z)
    const snoutZone = smoothstep(-0.04, 0.96, nz) * Math.exp(-((ny + 0.16) * (ny + 0.16)) * 2.5);
    z += snoutZone * 0.05;
    x *= 1 - snoutZone * 0.17;
    y -= snoutZone * 0.011;

    // 3. Tilted Almond Supraorbital Brow Domes (sweeping higher toward outer temples!)
    const outerTiltL = (nx - 0.35) * 0.18;
    const outerTiltR = (-nx - 0.35) * 0.18;
    const domeL = gaussian3(nx - 0.56, ny - (0.5 + outerTiltL), nz - 0.35, 5.2);
    const domeR = gaussian3(nx + 0.56, ny - (0.5 + outerTiltR), nz - 0.35, 5.2);
    const domes = domeL + domeR;
    y += domes * 0.046;
    x += (domeL - domeR) * 0.02;
    z += domes * 0.013;

    // Infraorbital smiling cheek shelves hugging lower rim of almond eyes
    const cheekRimL = gaussian3(nx - 0.54, ny + 0.02, nz - 0.66, 9.0);
    const cheekRimR = gaussian3(nx + 0.54, ny + 0.02, nz - 0.66, 9.0);
    y += (cheekRimL + cheekRimR) * 0.009;
    z += (cheekRimL + cheekRimR) * 0.011;

    // Recessed almond orbital sockets
    const socketL = gaussian3(nx - 0.56, ny - 0.25, nz - 0.68, 10.2);
    const socketR = gaussian3(nx + 0.56, ny - 0.25, nz - 0.68, 10.2);
    const sockets = socketL + socketR;
    z -= sockets * 0.024;

    // 4. Twin subtle nostril mounds near snout tip
    const nostL = gaussian3(nx - 0.21, ny - 0.02, nz - 0.92, 34.0);
    const nostR = gaussian3(nx + 0.21, ny - 0.02, nz - 0.92, 34.0);
    y += (nostL + nostR) * 0.0085;
    z += (nostL + nostR) * 0.0065;

    // 5. Clean underside jaw shelf so articulated mandible nests seamlessly
    if (ny < -0.34 && nz > -0.1) {
      const underFlatten = smoothstep(-0.34, -0.95, ny) * smoothstep(-0.1, 0.52, nz);
      y += underFlatten * 0.027;
    }

    pos.setXYZ(i, x, y, z);

    const underLip = smoothstep(0.06, -0.56, ny) * smoothstep(-0.25, 0.68, nz);
    bellyWeights[i] = THREE.MathUtils.clamp(underLip * 0.94, 0, 1);

    const crownShade = smoothstep(0.36, 0.95, ny) * 0.22;
    const socketAO = sockets * 0.45 + (nostL + nostR) * 0.24;
    shadeWeights[i] = THREE.MathUtils.clamp(crownShade + socketAO, 0, 0.65);

    colors[i * 3] = 1;
    colors[i * 3 + 1] = 1;
    colors[i * 3 + 2] = 1;
  }

  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  geo.userData.bellyWeights = bellyWeights;
  geo.userData.shadeWeights = shadeWeights;
  return geo;
}

/**
 * Continuous sculpted athletic amphibian torso segment (`pelvis`, `spine`, `chest`, `neck`).
 */
function createSculptedTorsoGeometry(profilePts, bellyBulgeZ = 0.018) {
  const geo = new THREE.LatheGeometry(profilePts, 28);
  const pos = geo.attributes.position;
  const count = pos.count;
  const bellyWeights = new Float32Array(count);
  const shadeWeights = new Float32Array(count);
  const colors = new Float32Array(count * 3);

  let minY = Infinity;
  let maxY = -Infinity;
  for (let i = 0; i < count; i++) {
    const py = pos.getY(i);
    if (py < minY) minY = py;
    if (py > maxY) maxY = py;
  }
  const spanY = Math.max(0.001, maxY - minY);

  for (let i = 0; i < count; i++) {
    let x = pos.getX(i);
    const y = pos.getY(i);
    let z = pos.getZ(i);
    const r = Math.hypot(x, z);
    const nz = r > 0.0001 ? z / r : 0;
    const nx = r > 0.0001 ? x / r : 0;
    const vNorm = (y - minY) / spanY;

    x *= 1.08;
    z *= 0.86;
    if (nz > 0) {
      const midArc = Math.sin(vNorm * Math.PI);
      z += nz * nz * bellyBulgeZ * (0.45 + 0.55 * midArc);
    } else {
      const spineGroove = Math.exp(-(nx * nx) * 8.0) * (-nz);
      z += spineGroove * 0.008;
    }

    pos.setXYZ(i, x, y, z);

    const frontMask = smoothstep(0.18, 0.78, nz) * (0.65 + 0.35 * Math.sin(vNorm * Math.PI));
    bellyWeights[i] = THREE.MathUtils.clamp(frontMask, 0, 1);
    shadeWeights[i] = THREE.MathUtils.clamp(smoothstep(0.1, -0.85, nz) * 0.24, 0, 0.45);

    colors[i * 3] = 1;
    colors[i * 3 + 1] = 1;
    colors[i * 3 + 2] = 1;
  }

  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  geo.userData.bellyWeights = bellyWeights;
  geo.userData.shadeWeights = shadeWeights;
  return geo;
}

/**
 * Builds an anatomical muscular limb LatheGeometry extending downward from `y = 0` to `y = -length`
 * (zero straight cylinders!).
 */
function createMuscularLimbGeometry(length, rProximal, rBelly, bellyFrac, rDistal) {
  const pts = [
    new THREE.Vector2(0.001, 0.012),
    new THREE.Vector2(rProximal * 0.85, 0.008),
    new THREE.Vector2(rProximal, -length * 0.08),
    new THREE.Vector2(rBelly, -length * bellyFrac),
    new THREE.Vector2((rBelly + rDistal) * 0.5, -length * 0.76),
    new THREE.Vector2(rDistal, -length * 0.96),
    new THREE.Vector2(rDistal * 0.72, -length * 1.02),
    new THREE.Vector2(0.001, -length * 1.03),
  ];
  return new THREE.LatheGeometry(pts, 18);
}

/**
 * Builds a pillowed, rounded-corner organic Explorer Rucksack geometry (zero sharp BoxGeometry!).
 */
function createRoundedPackGeometry(w, h, d, radius = 0.024) {
  const geo = new THREE.SphereGeometry(1, 22, 18);
  const pos = geo.attributes.position;
  const hw = w * 0.5;
  const hh = h * 0.5;
  const hd = d * 0.5;
  // Superellipsoid (p = 3.4) produces lush rounded-leather/canvas pillowed corners
  const exp = 0.58;
  for (let i = 0; i < pos.count; i++) {
    const nx = pos.getX(i);
    const ny = pos.getY(i);
    const nz = pos.getZ(i);
    const sx = Math.sign(nx) * Math.pow(Math.abs(nx), exp) * hw;
    const sy = Math.sign(ny) * Math.pow(Math.abs(ny), exp) * hh * (ny < 0 ? 1.06 : 0.95);
    const sz = Math.sign(nz) * Math.pow(Math.abs(nz), exp) * hd;
    pos.setXYZ(i, sx, sy, sz + (radius - 0.024));
  }
  geo.computeVertexNormals();
  return geo;
}

/**
 * Builds a double-sided scalloped, curved multi-segment interdigital webbing fan between two amphibian toes.
 */
function createScallopedWebbingGeometry(origin, tipA, tipB, segs = 6) {
  const positions = [];
  for (let s = 0; s < segs; s++) {
    const t0 = s / segs;
    const t1 = (s + 1) / segs;
    const scallop0 = 1 - Math.sin(t0 * Math.PI) * 0.22;
    const scallop1 = 1 - Math.sin(t1 * Math.PI) * 0.22;

    const x0 = origin[0] + (tipA[0] + (tipB[0] - tipA[0]) * t0 - origin[0]) * scallop0;
    const y0 = origin[1] + (tipA[1] + (tipB[1] - tipA[1]) * t0 - origin[1]) * scallop0;
    const z0 = origin[2] + (tipA[2] + (tipB[2] - tipA[2]) * t0 - origin[2]) * scallop0;

    const x1 = origin[0] + (tipA[0] + (tipB[0] - tipA[0]) * t1 - origin[0]) * scallop1;
    const y1 = origin[1] + (tipA[1] + (tipB[1] - tipA[1]) * t1 - origin[1]) * scallop1;
    const z1 = origin[2] + (tipA[2] + (tipB[2] - tipA[2]) * t1 - origin[2]) * scallop1;

    // Top face + underside face so FrontSide batching renders both sides cleanly
    positions.push(origin[0], origin[1], origin[2], x0, y0, z0, x1, y1, z1);
    positions.push(origin[0], origin[1] - 0.001, origin[2], x1, y1 - 0.001, z1, x0, y0 - 0.001, z0);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.computeVertexNormals();
  return geo;
}

/**
 * Builds a beveled ergonomic Cryo-Blaster silhouette via ExtrudeGeometry (zero boxy blocks!).
 */
function createBlasterReceiverGeometry() {
  const shape = new THREE.Shape();
  shape.moveTo(-0.025, -0.052); // Bottom of angled grip
  shape.lineTo(0.008, -0.052);
  shape.lineTo(0.024, -0.008);  // Trigger guard rear
  shape.lineTo(0.055, -0.008);  // Under-barrel rail
  shape.lineTo(0.095, 0.004);   // Tapered lower nose
  shape.lineTo(0.098, 0.034);   // Muzzle face
  shape.lineTo(-0.028, 0.038);  // Rear sight / hammer shroud
  shape.lineTo(-0.036, 0.012);  // Beaver-tail grip backstrap
  shape.closePath();

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: 0.024,
    bevelEnabled: true,
    bevelThickness: 0.006,
    bevelSize: 0.005,
    bevelSegments: 3,
    curveSegments: 8,
  });
  // Rotate so shape X (+forward) aligns with +Z, shape Y aligns with +Y, centered on X = 0
  geo.translate(0, 0, -0.012);
  geo.rotateY(-Math.PI / 2);
  geo.computeVertexNormals();
  return geo;
}

export class PogoRig {
  /**
   * @param {string | { skinId?: string, era?: 'reboot' | 'original' }} [skinId='default_amphibian']
   */
  constructor(skinId = 'default_amphibian') {
    const initSkinId =
      typeof skinId === 'object' && skinId !== null ? skinId.skinId || 'default_amphibian' : skinId;
    const initEra =
      typeof skinId === 'object' && skinId !== null && skinId.era === 'original' ? 'original' : 'reboot';

    this.group = new THREE.Group();
    this.group.name = 'PogoRig';

    this._disposed = false;
    this._glbApplied = false;
    this._glbTex = {};
    this._geometries = new Set();
    this._materials = new Set();
    this._textures = new Set();
    this._derivedTexKeys = new Set();
    this._vertexBlendedGeos = [];
    this._slottedSkinGeos = [];
    this._slottedEyeGeos = [];
    this._proceduralPartGroups = new Map();

    this.currentSkinId = null;
    this.currentEra = 'reboot';

    this._scratchColorA = new THREE.Color();
    this._scratchColorB = new THREE.Color();
    this._scratchColorC = new THREE.Color();
    this._lastPoseState = { time: 0, vx: 0, vy: 0, facing: 1, onGround: true };

    this._internalTime = 0;
    this._walkPhase = 0;
    this._yaw = 0.28;
    this._pelvisY = BASE_PELVIS_Y;
    this._chestLeanX = 0.04;
    this._chestTwistY = 0;
    this._headYaw = 0;
    this._headPitch = 0;
    this._headRoll = 0.145;
    this._aimBlend = 0;
    this._recoil = 0;
    this._landCompression = 0;
    this._takeoffSnap = 0;
    this._wasOnGround = true;
    this._lastVy = 0;

    this._initMaterials();
    this._buildSkeletonAndMesh();

    this.setSkin(initSkinId);
    this.setEraStyle(initEra);
    this.update(0, this._lastPoseState);

    loadSharedPogoGlb().then((glbScene) => {
      if (glbScene && !this._disposed && !this._glbApplied) {
        this._applyBlenderGlb(glbScene);
      }
    });
  }

  _trackGeo(geo) {
    this._geometries.add(geo);
    return geo;
  }

  _trackMat(mat) {
    this._materials.add(mat);
    return mat;
  }

  _trackTex(tex) {
    this._textures.add(tex);
    return tex;
  }

  _useDerivedTex(srcTex, mode) {
    if (!srcTex) return null;
    const key = `${mode}:${srcTex.uuid}`;
    let entry = _derivedTexPool.get(key);
    if (!entry) {
      const tex = buildDerivedGlbMap(srcTex, mode);
      if (!tex || tex === srcTex) return tex;
      entry = { tex, refs: 0 };
      _derivedTexPool.set(key, entry);
    }
    if (!this._derivedTexKeys.has(key)) {
      this._derivedTexKeys.add(key);
      entry.refs += 1;
    }
    return entry.tex;
  }

  _mesh(geo, mat, castShadow = false) {
    const m = new THREE.Mesh(this._trackGeo(geo), mat);
    m.castShadow = castShadow;
    return m;
  }

  _partGroup(boneName) {
    let pg = this._proceduralPartGroups.get(boneName);
    if (!pg) {
      pg = new THREE.Group();
      pg.name = `proc_${boneName}`;
      this.bones[boneName].add(pg);
      this._proceduralPartGroups.set(boneName, pg);
    }
    return pg;
  }

  _initMaterials() {
    const maps = getSharedSurfaceMaps();

    // 8x2 NearestFilter PBR LUT textures consolidate multi-material props (harness, backpack, blaster) into 1 draw call each!
    const makeLut = (isSrgb) => {
      const data = new Uint8Array(8 * 2 * 4);
      const tex = new THREE.DataTexture(data, 8, 2, THREE.RGBAFormat, THREE.UnsignedByteType);
      tex.minFilter = THREE.NearestFilter;
      tex.magFilter = THREE.NearestFilter;
      tex.wrapS = THREE.ClampToEdgeWrapping;
      tex.wrapT = THREE.ClampToEdgeWrapping;
      tex.generateMipmaps = false;
      if (isSrgb) tex.colorSpace = THREE.SRGBColorSpace;
      tex.needsUpdate = true;
      return this._trackTex(tex);
    };
    this._gearAlbedoLut = makeLut(true);
    this._gearOrmLut = makeLut(false);
    this._gearEmissiveLut = makeLut(true);

    // 64x64 eye emissive map: 0 on sclera & pupil, subtle iris glow band, 1.0 pure white on catchlight corner!
    const eyeEmiData = new Uint8Array(64 * 64 * 4);
    const eyeEmiTex = new THREE.DataTexture(eyeEmiData, 64, 64, THREE.RGBAFormat, THREE.UnsignedByteType);
    eyeEmiTex.minFilter = THREE.LinearFilter;
    eyeEmiTex.magFilter = THREE.LinearFilter;
    eyeEmiTex.wrapS = THREE.ClampToEdgeWrapping;
    eyeEmiTex.wrapT = THREE.ClampToEdgeWrapping;
    eyeEmiTex.generateMipmaps = false;
    eyeEmiTex.colorSpace = THREE.SRGBColorSpace;
    eyeEmiTex.needsUpdate = true;
    this._eyeEmissiveTex = this._trackTex(eyeEmiTex);

    this.mats = {
      skinBlended: this._trackMat(
        new THREE.MeshStandardMaterial({
          color: '#ffffff',
          vertexColors: true,
          roughness: 0.64,
          metalness: 0.0,
          bumpMap: maps ? maps.skinBump : null,
          bumpScale: maps ? 0.012 : 0,
          roughnessMap: maps ? maps.skinRough : null,
        })
      ),
      skinVertex: this._trackMat(
        new THREE.MeshStandardMaterial({
          color: '#ffffff',
          vertexColors: true,
          roughness: 0.64,
          metalness: 0.0,
          bumpMap: maps ? maps.skinBump : null,
          bumpScale: maps ? 0.012 : 0,
          roughnessMap: maps ? maps.skinRough : null,
        })
      ),
      eyeUnified: this._trackMat(
        new THREE.MeshStandardMaterial({
          color: '#ffffff',
          vertexColors: true,
          emissive: '#ffffff',
          emissiveMap: this._eyeEmissiveTex,
          emissiveIntensity: 1.0,
          roughness: 0.07,
          metalness: 0.02,
        })
      ),
      gearPalette: this._trackMat(
        new THREE.MeshStandardMaterial({
          color: '#ffffff',
          map: this._gearAlbedoLut,
          roughness: 1.0,
          roughnessMap: this._gearOrmLut,
          metalness: 1.0,
          metalnessMap: this._gearOrmLut,
          emissive: '#ffffff',
          emissiveMap: this._gearEmissiveLut,
          emissiveIntensity: 1.15,
        })
      ),
      skin: this._trackMat(
        new THREE.MeshStandardMaterial({
          color: '#58b866',
          roughness: 0.64,
          metalness: 0.0,
          bumpMap: maps ? maps.skinBump : null,
          bumpScale: maps ? 0.012 : 0,
          roughnessMap: maps ? maps.skinRough : null,
        })
      ),
      skinShade: this._trackMat(
        new THREE.MeshStandardMaterial({
          color: '#387d44',
          roughness: 0.66,
          metalness: 0.0,
          bumpMap: maps ? maps.skinBump : null,
          bumpScale: maps ? 0.012 : 0,
        })
      ),
      belly: this._trackMat(
        new THREE.MeshStandardMaterial({
          color: '#e3d7a0',
          roughness: 0.7,
          metalness: 0.0,
        })
      ),
      lipWarm: this._trackMat(
        new THREE.MeshStandardMaterial({
          color: '#d4a67a',
          roughness: 0.66,
          metalness: 0.0,
        })
      ),
      crest: this._trackMat(
        new THREE.MeshStandardMaterial({
          color: '#76d684',
          roughness: 0.58,
          metalness: 0.0,
        })
      ),
      webbing: this._trackMat(
        new THREE.MeshStandardMaterial({
          color: '#9fd483',
          roughness: 0.62,
          metalness: 0.0,
          side: THREE.DoubleSide,
          transparent: true,
          opacity: 0.92,
        })
      ),
      vest: this._trackMat(
        new THREE.MeshStandardMaterial({
          color: '#c2a778',
          roughness: 0.86,
          metalness: 0.02,
          bumpMap: maps ? maps.packBump : null,
          bumpScale: maps ? 0.016 : 0,
        })
      ),
      harness: this._trackMat(
        new THREE.MeshStandardMaterial({
          color: '#4e3320',
          roughness: 0.78,
          metalness: 0.06,
          bumpMap: maps ? maps.leatherBump : null,
          bumpScale: maps ? 0.018 : 0,
        })
      ),
      pack: this._trackMat(
        new THREE.MeshStandardMaterial({
          color: '#a88c62',
          roughness: 0.86,
          metalness: 0.04,
          bumpMap: maps ? maps.packBump : null,
          bumpScale: maps ? 0.02 : 0,
        })
      ),
      brass: this._trackMat(
        new THREE.MeshStandardMaterial({
          color: '#c89b48',
          roughness: 0.28,
          metalness: 0.84,
        })
      ),
      eyeRim: this._trackMat(
        new THREE.MeshStandardMaterial({
          color: '#4ff0d2',
          emissive: '#14b8a6',
          emissiveIntensity: 0.34,
          roughness: 0.06,
          metalness: 0.08,
        })
      ),
      sclera: this._trackMat(
        new THREE.MeshStandardMaterial({
          color: '#e8efe2',
          roughness: 0.08,
          metalness: 0.02,
        })
      ),
      pupil: this._trackMat(
        new THREE.MeshStandardMaterial({
          color: '#04080f',
          roughness: 0.03,
          metalness: 0.14,
        })
      ),
      catchlight: this._trackMat(
        new THREE.MeshBasicMaterial({
          color: '#ffffff',
        })
      ),
      mouthDark: this._trackMat(
        new THREE.MeshStandardMaterial({
          color: '#1b2b1d',
          roughness: 0.65,
          metalness: 0.02,
        })
      ),
      blasterBody: this._trackMat(
        new THREE.MeshStandardMaterial({
          color: '#334155',
          roughness: 0.26,
          metalness: 0.82,
        })
      ),
      accentGlow: this._trackMat(
        new THREE.MeshStandardMaterial({
          color: '#38bdf8',
          emissive: '#0ea5e9',
          emissiveIntensity: 1.15,
          roughness: 0.14,
          metalness: 0.2,
        })
      ),
      muzzleFlash: this._trackMat(
        new THREE.MeshBasicMaterial({
          color: '#e0f2fe',
          transparent: true,
          opacity: 0.92,
        })
      ),
    };
  }

  _buildSkeletonAndMesh() {
    const m = this.mats;

    // 1. Instantiate all 33 contract bones
    const root = new THREE.Group();
    const pelvis = new THREE.Group();
    const spine = new THREE.Group();
    const chest = new THREE.Group();
    const neck = new THREE.Group();
    const head = new THREE.Group();
    const crest = new THREE.Group();
    const browL = new THREE.Group();
    const browR = new THREE.Group();
    const eyeL = new THREE.Group();
    const eyeR = new THREE.Group();
    const eyelidL = new THREE.Group();
    const eyelidR = new THREE.Group();
    const jaw = new THREE.Group();
    const harness = new THREE.Group();
    const backpack = new THREE.Group();

    const shoulderL = new THREE.Group();
    const upperArmL = new THREE.Group();
    const forearmL = new THREE.Group();
    const handL = new THREE.Group();

    const shoulderR = new THREE.Group();
    const upperArmR = new THREE.Group();
    const forearmR = new THREE.Group();
    const handR = new THREE.Group();

    const blaster = new THREE.Group();
    const muzzle = new THREE.Group();
    const muzzleLight = new THREE.PointLight('#67e8f9', 0, 4.0, 1.8);

    const thighL = new THREE.Group();
    const shinL = new THREE.Group();
    const footL = new THREE.Group();

    const thighR = new THREE.Group();
    const shinR = new THREE.Group();
    const footR = new THREE.Group();

    this.bones = {
      root,
      pelvis,
      spine,
      chest,
      neck,
      head,
      crest,
      browL,
      browR,
      eyeL,
      eyeR,
      eyelidL,
      eyelidR,
      jaw,
      harness,
      backpack,
      shoulderL,
      upperArmL,
      forearmL,
      handL,
      shoulderR,
      upperArmR,
      forearmR,
      handR,
      blaster,
      muzzle,
      muzzleLight,
      thighL,
      shinL,
      footL,
      thighR,
      shinR,
      footR,
    };

    // 2. Wire exact Explorer Pogo V3 hierarchical bone tree (1:1 meter bind offsets!)
    this._eyeBaseYaw = 0.18;
    this.group.add(root);
    root.add(pelvis);

    pelvis.position.set(0, BASE_PELVIS_Y, 0);
    pelvis.add(spine, thighL, thighR);

    spine.position.set(0, 0.034, 0);
    spine.add(chest);

    chest.position.set(0, 0.07, 0);
    chest.add(harness, backpack, neck, shoulderL, shoulderR);

    neck.position.set(0, 0.068, 0.01);
    neck.add(head);

    head.position.set(0, 0.028, 0.012);
    head.add(crest, browL, browR, eyeL, eyeR, eyelidL, eyelidR, jaw);

    shoulderL.position.set(0.096, 0.074, -0.004);
    shoulderL.add(upperArmL);
    upperArmL.add(forearmL);
    forearmL.position.set(0, -0.106, 0);
    forearmL.add(handL);
    handL.position.set(0, -0.102, 0);

    shoulderR.position.set(-0.096, 0.074, -0.004);
    shoulderR.add(upperArmR);
    upperArmR.add(forearmR);
    forearmR.position.set(0, -0.106, 0);
    forearmR.add(handR);
    handR.position.set(0, -0.102, 0);
    handR.add(blaster);

    blaster.position.set(-0.004, -0.032, 0.038);
    blaster.add(muzzle, muzzleLight);
    muzzle.position.set(0, 0.024, 0.158);
    muzzleLight.position.set(0, 0.026, 0.21);

    thighL.position.set(0.068, HIP_OFFSET_Y, 0.004);
    thighL.add(shinL);
    shinL.position.set(0, -LEG_UPPER_LEN, 0);
    shinL.add(footL);
    footL.position.set(0, -LEG_LOWER_LEN, 0);

    thighR.position.set(-0.068, HIP_OFFSET_Y, 0.004);
    thighR.add(shinR);
    shinR.position.set(0, -LEG_UPPER_LEN, 0);
    shinR.add(footR);
    footR.position.set(0, -LEG_LOWER_LEN, 0);

    // -------------------------------------------------------------------------
    // 3. Continuous Sculpted Pelvis & Torso (Seamless Two-Tone Vertex Blending)
    // -------------------------------------------------------------------------
    const pelvisGeo = createSculptedTorsoGeometry(
      [
        new THREE.Vector2(0.01, -0.052),
        new THREE.Vector2(0.068, -0.042),
        new THREE.Vector2(0.098, -0.012),
        new THREE.Vector2(0.102, 0.024),
        new THREE.Vector2(0.092, 0.052),
      ],
      0.014
    );
    this._vertexBlendedGeos.push(pelvisGeo);
    const pelvisGroup = this._partGroup('pelvis');
    pelvisGroup.add(this._mesh(pelvisGeo, m.skinBlended));

    const tailCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0.008, -0.062),
      new THREE.Vector3(0, -0.012, -0.098),
      new THREE.Vector3(0, -0.004, -0.128),
    ]);
    pelvisGroup.add(this._mesh(new THREE.TubeGeometry(tailCurve, 10, 0.022, 8, false), m.skinShade));

    const spineGeo = createSculptedTorsoGeometry(
      [
        new THREE.Vector2(0.088, -0.018),
        new THREE.Vector2(0.102, 0.025),
        new THREE.Vector2(0.098, 0.072),
        new THREE.Vector2(0.086, 0.106),
      ],
      0.024
    );
    this._vertexBlendedGeos.push(spineGeo);
    this._partGroup('spine').add(this._mesh(spineGeo, m.skinBlended));

    const chestGeo = createSculptedTorsoGeometry(
      [
        new THREE.Vector2(0.084, -0.014),
        new THREE.Vector2(0.112, 0.032),
        new THREE.Vector2(0.118, 0.068),
        new THREE.Vector2(0.088, 0.102),
        new THREE.Vector2(0.046, 0.116),
      ],
      0.016
    );
    this._vertexBlendedGeos.push(chestGeo);
    this._partGroup('chest').add(this._mesh(chestGeo, m.skinBlended));

    this._divingCollar = this._mesh(new THREE.TorusGeometry(0.068, 0.016, 10, 20), m.brass);
    this._divingCollar.rotation.x = Math.PI * 0.48;
    this._divingCollar.position.set(0, 0.104, 0.008);
    this._divingCollar.visible = false;
    chest.add(this._divingCollar);

    // -------------------------------------------------------------------------
    // 4. Saddle-Stitched Leather Harness & Pillowed Woven-Canvas Explorer Pack
    // -------------------------------------------------------------------------
    const harnessGroup = this._partGroup('harness');
    for (const side of [-1, 1]) {
      const strapCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(side * 0.068, 0.085, -0.085),
        new THREE.Vector3(side * 0.086, 0.098, -0.012),
        new THREE.Vector3(side * 0.066, 0.066, 0.078),
        new THREE.Vector3(0, 0.022, 0.102),
      ]);
      harnessGroup.add(this._mesh(new THREE.TubeGeometry(strapCurve, 18, 0.0138, 10, false), m.harness));

      const ribCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(0, 0.018, 0.101),
        new THREE.Vector3(side * 0.082, 0.008, 0.072),
        new THREE.Vector3(side * 0.114, 0.012, 0.0),
        new THREE.Vector3(side * 0.078, 0.018, -0.088),
      ]);
      harnessGroup.add(this._mesh(new THREE.TubeGeometry(ribCurve, 16, 0.0118, 10, false), m.harness));

      // Brushed-brass shoulder D-ring clasps
      const dRing = this._mesh(new THREE.TorusGeometry(0.015, 0.0038, 8, 14), m.brass);
      dRing.position.set(side * 0.066, 0.066, 0.082);
      dRing.rotation.y = side * 0.35;
      harnessGroup.add(dRing);
    }

    const bucklePlate = this._mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.012, 16), m.brass);
    bucklePlate.rotation.x = Math.PI / 2;
    bucklePlate.position.set(0, 0.022, 0.102);
    const buckleRing = this._mesh(new THREE.TorusGeometry(0.025, 0.0055, 10, 18), m.brass);
    buckleRing.position.set(0, 0.022, 0.106);
    const buckleGem = this._mesh(new THREE.SphereGeometry(0.011, 10, 10), m.accentGlow);
    buckleGem.scale.set(1, 1, 0.55);
    buckleGem.position.set(0, 0.022, 0.109);
    harnessGroup.add(bucklePlate, buckleRing, buckleGem);

    // Pillowed leather hip utility satchel (sculpted rounded pouch, zero sharp BoxGeometry)
    const hipPouch = this._mesh(createRoundedPackGeometry(0.04, 0.05, 0.03), m.harness);
    hipPouch.position.set(0.11, -0.022, 0.024);
    hipPouch.rotation.y = 0.35;
    const pouchStud = this._mesh(new THREE.SphereGeometry(0.0065, 8, 8), m.brass);
    pouchStud.position.set(0.124, -0.016, 0.033);
    harnessGroup.add(hipPouch, pouchStud);

    // Sculpted Pillowed Explorer Rucksack on back (-Z of chest, peeking over shoulder!)
    backpack.position.set(0, 0.072, -0.1);
    const packGroup = this._partGroup('backpack');
    const packMain = this._mesh(createRoundedPackGeometry(0.168, 0.19, 0.094), m.pack);
    const packTopFlap = this._mesh(createRoundedPackGeometry(0.172, 0.056, 0.098), m.harness);
    packTopFlap.position.set(0, 0.076, 0.002);

    // Rolled explorer bedroll & brass end-straps above pack
    const bedroll = this._mesh(new THREE.CapsuleGeometry(0.025, 0.12, 8, 14), m.pack);
    bedroll.rotation.z = Math.PI / 2;
    bedroll.position.set(0, 0.118, -0.01);

    for (const sx of [-0.048, 0.048]) {
      const strapCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(sx, 0.095, 0.038),
        new THREE.Vector3(sx, 0.088, -0.048),
        new THREE.Vector3(sx, -0.068, -0.049),
        new THREE.Vector3(sx, -0.088, 0.02),
      ]);
      packGroup.add(this._mesh(new THREE.TubeGeometry(strapCurve, 14, 0.009, 8, false), m.harness));

      const buckleLoop = this._mesh(new THREE.TorusGeometry(0.012, 0.0035, 8, 12), m.brass);
      buckleLoop.position.set(sx, 0.016, -0.05);
      packGroup.add(buckleLoop);
    }

    // Glowing Cryo-Cell canister mounted vertically along pack center-rear
    const cellGlass = this._mesh(new THREE.CylinderGeometry(0.023, 0.023, 0.122, 14), m.accentGlow);
    cellGlass.position.set(0, -0.006, -0.054);
    const cellCapTop = this._mesh(new THREE.CylinderGeometry(0.027, 0.027, 0.018, 14), m.brass);
    cellCapTop.position.set(0, 0.058, -0.054);
    const cellCapBot = this._mesh(new THREE.CylinderGeometry(0.027, 0.027, 0.018, 14), m.brass);
    cellCapBot.position.set(0, -0.07, -0.054);
    packGroup.add(packMain, packTopFlap, bedroll, cellGlass, cellCapTop, cellCapBot);

    // -------------------------------------------------------------------------
    // 5. Neck & Continuous RBF-Sculpted Gecko-Frog Head
    // -------------------------------------------------------------------------
    const neckGeo = createSculptedTorsoGeometry(
      [
        new THREE.Vector2(0.052, -0.01),
        new THREE.Vector2(0.045, 0.024),
        new THREE.Vector2(0.042, 0.058),
      ],
      0.006
    );
    this._vertexBlendedGeos.push(neckGeo);
    this._partGroup('neck').add(this._mesh(neckGeo, m.skinBlended));

    const headGeo = createSculptedHeadGeometry();
    this._vertexBlendedGeos.push(headGeo);
    const headGroup = this._partGroup('head');
    headGroup.add(this._mesh(headGeo, m.skinBlended));

    const smileCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-0.08, 0.044, 0.082),
      new THREE.Vector3(-0.045, 0.028, 0.15),
      new THREE.Vector3(0, 0.025, 0.174),
      new THREE.Vector3(0.045, 0.028, 0.15),
      new THREE.Vector3(0.08, 0.044, 0.082),
    ]);
    headGroup.add(this._mesh(new THREE.TubeGeometry(smileCurve, 18, 0.0042, 8, false), m.mouthDark));

    // Prominent Sculpted Dorsal Crown Fin
    crest.position.set(0, 0.292, 0.002);
    const crestGroup = this._partGroup('crest');
    const crestKeelCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, -0.024, 0.078),
      new THREE.Vector3(0, 0.048, 0.024),
      new THREE.Vector3(0, 0.082, -0.018),
      new THREE.Vector3(0, 0.032, -0.082),
      new THREE.Vector3(0, -0.048, -0.124),
    ]);
    const crestRidge = this._mesh(new THREE.TubeGeometry(crestKeelCurve, 20, 0.017, 10, false), m.crest);
    crestRidge.scale.set(0.65, 1.15, 1.0);
    crestGroup.add(crestRidge);

    // Fleshy Chameleon Supraorbital Brow Ridges (asymmetric cocked right brow!)
    const buildBrow = (side) => {
      const bCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(-side * 0.05, -0.018, 0.022),
        new THREE.Vector3(0, 0.012, 0.036),
        new THREE.Vector3(side * 0.054, -0.018, -0.008),
      ]);
      return this._mesh(new THREE.TubeGeometry(bCurve, 14, 0.015, 8, false), m.crest);
    };
    browL.position.set(0.098, 0.248, 0.096);
    this._partGroup('browL').add(buildBrow(1));
    browR.position.set(-0.098, 0.242, 0.096);
    this._partGroup('browR').add(buildBrow(-1));

    this._visorPips = new THREE.Group();
    for (const vx of [-0.065, 0, 0.065]) {
      const pip = this._mesh(new THREE.SphereGeometry(0.013, 8, 8), m.accentGlow);
      pip.position.set(vx, 0.256, 0.148 - Math.abs(vx) * 0.18);
      this._visorPips.add(pip);
    }
    this._visorPips.visible = false;
    head.add(this._visorPips);

    // Creamy-Sclera Pixar Turret Eyes (~60% warm ivory sclera + hazel iris + focused pupil + catchlights)
    const buildEye = (boneName, lidName, side) => {
      const bone = this.bones[boneName];
      const lidBone = this.bones[lidName];
      bone.position.set(side * 0.098, 0.178, 0.096);
      bone.rotation.set(0, side * 0.18, 0);

      const eyeGroup = this._partGroup(boneName);
      const scleraSphere = this._mesh(new THREE.SphereGeometry(0.067, 20, 16), m.sclera);
      scleraSphere.scale.set(0.98, 1.02, 0.96);

      const irisDisc = this._mesh(new THREE.SphereGeometry(0.042, 18, 14), m.eyeRim);
      irisDisc.scale.set(1.0, 1.0, 0.55);
      irisDisc.position.set(0, 0, 0.044);

      const pupilDome = this._mesh(new THREE.SphereGeometry(0.029, 16, 12), m.pupil);
      pupilDome.scale.set(1.0, 1.0, 0.5);
      pupilDome.position.set(0, 0, 0.056);

      const catchMain = this._mesh(new THREE.SphereGeometry(0.009, 10, 8), m.catchlight);
      catchMain.scale.set(1, 1, 0.45);
      catchMain.position.set(-0.011, 0.015, 0.068);

      const catchSub = this._mesh(new THREE.SphereGeometry(0.0045, 8, 6), m.catchlight);
      catchSub.scale.set(1, 1, 0.45);
      catchSub.position.set(0.013, -0.011, 0.067);

      eyeGroup.add(scleraSphere, irisDisc, pupilDome, catchMain, catchSub);

      lidBone.position.copy(bone.position);
      lidBone.rotation.set(0, side * 0.18, 0);
      const lidShell = this._mesh(
        new THREE.SphereGeometry(0.0715, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.52),
        m.skin
      );
      lidShell.rotation.x = -Math.PI * 0.08;
      this._partGroup(lidName).add(lidShell);
    };
    buildEye('eyeL', 'eyelidL', 1);
    buildEye('eyeR', 'eyelidR', -1);

    // Conformal Chin / Gular Throat Sac
    jaw.position.set(0, 0.03, 0.024);
    const jawGroup = this._partGroup('jaw');
    const lowerJawMesh = this._mesh(new THREE.SphereGeometry(0.084, 20, 14), m.belly);
    lowerJawMesh.scale.set(1.02, 0.42, 1.24);
    lowerJawMesh.position.set(0, -0.008, 0.036);
    const innerMouth = this._mesh(new THREE.SphereGeometry(0.068, 14, 10), m.mouthDark);
    innerMouth.scale.set(0.95, 0.25, 1.08);
    innerMouth.position.set(0, 0.004, 0.038);
    jawGroup.add(lowerJawMesh, innerMouth);

    // -------------------------------------------------------------------------
    // 6. Anatomical Muscular Arms, 3-Fingered Gecko Hands & Contoured Cryo-Blaster
    // -------------------------------------------------------------------------
    const buildArm = (upperName, foreName, handName, side) => {
      const upperGroup = this._partGroup(upperName);
      upperGroup.add(this._mesh(createMuscularLimbGeometry(0.128, 0.034, 0.029, 0.42, 0.022), m.skin));

      const foreGroup = this._partGroup(foreName);
      const elbowCap = this._mesh(new THREE.SphereGeometry(0.024, 12, 10), m.skinShade);
      const foreLimb = this._mesh(createMuscularLimbGeometry(0.118, 0.025, 0.027, 0.34, 0.019), m.skin);
      foreGroup.add(elbowCap, foreLimb);

      const handGroup = this._partGroup(handName);
      const palm = this._mesh(new THREE.SphereGeometry(0.026, 12, 10), m.skin);
      palm.scale.set(1.06, 0.72, 1.15);
      palm.position.set(0, -0.012, 0.008);
      handGroup.add(palm);

      const fingerAngles = [-0.44, 0, 0.44];
      const fingerTips = [];
      for (let i = 0; i < 3; i++) {
        const ang = fingerAngles[i] * side;
        const fg = new THREE.Group();
        fg.position.set(Math.sin(ang) * 0.016, -0.02, 0.014);
        fg.rotation.z = ang * 0.65;
        fg.rotation.x = 0.42;

        const digit = this._mesh(new THREE.CapsuleGeometry(0.0082, 0.025, 6, 8), m.skin);
        digit.position.set(0, -0.016, 0.004);
        const pad = this._mesh(new THREE.SphereGeometry(0.013, 10, 8), m.belly);
        pad.scale.set(1.12, 0.72, 1.16);
        pad.position.set(0, -0.033, 0.006);
        fg.add(digit, pad);
        handGroup.add(fg);

        fingerTips.push([
          Math.sin(ang) * 0.03,
          -0.038,
          0.024 + Math.cos(ang) * 0.01,
        ]);
      }

      // Subtle basal gecko hand webbing
      const handWebOrigin = [0, -0.02, 0.012];
      handGroup.add(
        this._mesh(createScallopedWebbingGeometry(handWebOrigin, fingerTips[0], fingerTips[1], 4), m.webbing),
        this._mesh(createScallopedWebbingGeometry(handWebOrigin, fingerTips[1], fingerTips[2], 4), m.webbing)
      );
    };
    buildArm('upperArmL', 'forearmL', 'handL', 1);
    buildArm('upperArmR', 'forearmR', 'handR', -1);

    // Beveled Contoured Cryo-Blaster in Right Hand
    const blasterGroup = this._partGroup('blaster');
    const frameMesh = this._mesh(createBlasterReceiverGeometry(), m.blasterBody);
    frameMesh.position.set(0, 0.016, 0.022);

    const gripPanels = this._mesh(createRoundedPackGeometry(0.031, 0.056, 0.026), m.harness);
    gripPanels.rotation.x = 0.28;
    gripPanels.position.set(0, -0.016, 0.008);

    const cryoCore = this._mesh(new THREE.CylinderGeometry(0.023, 0.023, 0.068, 14), m.accentGlow);
    cryoCore.rotation.x = Math.PI / 2;
    cryoCore.position.set(0, 0.028, 0.058);

    this._blasterSlide = this._mesh(new THREE.CylinderGeometry(0.017, 0.022, 0.092, 14), m.blasterBody);
    this._blasterSlide.rotation.x = Math.PI / 2;
    this._blasterSlide.position.set(0, 0.026, 0.122);

    const nozzleRing = this._mesh(new THREE.TorusGeometry(0.019, 0.005, 8, 16), m.brass);
    nozzleRing.position.set(0, 0.026, 0.168);

    blasterGroup.add(frameMesh, gripPanels, cryoCore, this._blasterSlide, nozzleRing);

    const flashStar = this._mesh(new THREE.OctahedronGeometry(0.055, 0), m.muzzleFlash);
    flashStar.scale.set(1, 1, 1.65);
    const flashCore = this._mesh(new THREE.SphereGeometry(0.034, 10, 10), m.accentGlow);
    muzzle.add(flashStar, flashCore);
    muzzle.visible = false;

    // -------------------------------------------------------------------------
    // 7. Anatomical Muscular Amphibian Legs & 3-Toed Scalloped-Webbed Feet
    // -------------------------------------------------------------------------
    const buildLeg = (thighName, shinName, footName, side) => {
      const thighGroup = this._partGroup(thighName);
      thighGroup.add(
        this._mesh(createMuscularLimbGeometry(LEG_UPPER_LEN, 0.046, 0.048, 0.36, 0.031), m.skin)
      );

      const shinGroup = this._partGroup(shinName);
      const kneeCap = this._mesh(new THREE.SphereGeometry(0.032, 12, 10), m.skinShade);
      const shinLimb = this._mesh(
        createMuscularLimbGeometry(LEG_LOWER_LEN, 0.031, 0.035, 0.32, 0.022),
        m.skin
      );
      shinGroup.add(kneeCap, shinLimb);

      // Sculpted organic tarsus/heel dome (sole sits flat at y = -FOOT_SOLE_HEIGHT = -0.024)
      const footGroup = this._partGroup(footName);
      const tarsusDome = this._mesh(
        new THREE.SphereGeometry(0.036, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.56),
        m.skin
      );
      tarsusDome.scale.set(0.86, 0.68, 1.38);
      tarsusDome.position.set(0, -0.024, 0.016);
      footGroup.add(tarsusDome);

      const toeSpecs = [
        { yaw: side * 0.35, len: 0.09 },
        { yaw: 0, len: 0.108 },
        { yaw: -side * 0.37, len: 0.088 },
      ];
      const tipCoords = [];

      for (const ts of toeSpecs) {
        const dx = Math.sin(ts.yaw);
        const dz = Math.cos(ts.yaw);
        const midX = dx * (ts.len * 0.52);
        const midZ = 0.032 + dz * (ts.len * 0.52);
        const tipX = dx * ts.len;
        const tipZ = 0.032 + dz * ts.len;
        tipCoords.push([tipX * 0.88, -0.016, 0.032 + dz * (ts.len * 0.86)]);

        const toeShaft = this._mesh(new THREE.CapsuleGeometry(0.0092, ts.len * 0.72, 6, 10), m.skin);
        toeShaft.rotation.x = Math.PI / 2;
        toeShaft.rotation.z = -ts.yaw;
        toeShaft.position.set(midX, -0.015, midZ);

        const toePad = this._mesh(new THREE.SphereGeometry(0.0165, 12, 10), m.belly);
        toePad.scale.set(1.14, 0.54, 1.2);
        toePad.position.set(tipX, -0.015, tipZ);

        footGroup.add(toeShaft, toePad);
      }

      // Scalloped curved webbing fans between Toe 0-1 and Toe 1-2
      const basePt = [0, -0.015, 0.032];
      footGroup.add(
        this._mesh(createScallopedWebbingGeometry(basePt, tipCoords[0], tipCoords[1], 6), m.webbing),
        this._mesh(createScallopedWebbingGeometry(basePt, tipCoords[1], tipCoords[2], 6), m.webbing)
      );
    };
    buildLeg('thighL', 'shinL', 'footL', 1);
    buildLeg('thighR', 'shinR', 'footR', -1);

    // -------------------------------------------------------------------------
    // 8. Sovereign Gold Starlight Motes (visible only when skin === 'golden_toppler')
    // -------------------------------------------------------------------------
    this._starMotesGroup = new THREE.Group();
    this._starMotes = [];
    for (let i = 0; i < 5; i++) {
      const mote = this._mesh(new THREE.OctahedronGeometry(0.016, 0), m.accentGlow);
      this._starMotesGroup.add(mote);
      this._starMotes.push(mote);
    }
    this._starMotesGroup.visible = false;
    chest.add(this._starMotesGroup);

    this._batchProceduralPartGroups();
  }

  _disposeTrackedSourceMeshes(meshes) {
    for (let i = 0; i < meshes.length; i++) {
      const srcMesh = meshes[i];
      if (srcMesh.parent) srcMesh.parent.remove(srcMesh);
      const geo = srcMesh.geometry;
      if (geo && this._geometries.has(geo)) {
        geo.dispose();
        this._geometries.delete(geo);
        const vbIdx = this._vertexBlendedGeos.indexOf(geo);
        if (vbIdx !== -1) this._vertexBlendedGeos.splice(vbIdx, 1);
      }
    }
  }

  _removeContainerMeshesOnly(meshes) {
    for (let i = 0; i < meshes.length; i++) {
      if (meshes[i].parent) meshes[i].parent.remove(meshes[i]);
    }
  }

  _consolidateSameMaterial(container, disposeSources = false) {
    if (!container) return;
    container.updateMatrixWorld(true);
    const invRoot = new THREE.Matrix4().copy(container.matrixWorld).invert();
    const buckets = new Map();
    const allMeshes = [];

    container.traverse((obj) => {
      if (!obj.isMesh || !obj.geometry || !obj.material || Array.isArray(obj.material)) return;
      let list = buckets.get(obj.material);
      if (!list) {
        list = [];
        buckets.set(obj.material, list);
      }
      list.push(obj);
      allMeshes.push(obj);
    });

    if (allMeshes.length <= buckets.size) return;

    for (const [mat, list] of buckets.entries()) {
      const geos = [];
      let castShadow = false;
      for (let i = 0; i < list.length; i++) {
        const mesh = list[i];
        if (mesh.castShadow) castShadow = true;
        const relMat = new THREE.Matrix4().multiplyMatrices(invRoot, mesh.matrixWorld);
        const g = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry.clone();
        g.applyMatrix4(relMat);
        geos.push(g);
      }
      const merged = mergeNormalizedGeometries(geos, Boolean(mat.vertexColors));
      for (let i = 0; i < geos.length; i++) geos[i].dispose();
      if (merged) {
        container.add(this._mesh(merged, mat, castShadow));
      }
    }

    if (disposeSources) this._disposeTrackedSourceMeshes(allMeshes);
    else this._removeContainerMeshesOnly(allMeshes);
  }

  _consolidateGearContainer(container, excludeSet = null, disposeSources = false, skipMatSet = null) {
    if (!container) return;
    const m = this.mats;
    container.updateMatrixWorld(true);
    const invRoot = new THREE.Matrix4().copy(container.matrixWorld).invert();
    const srcMeshes = [];
    const preparedGeos = [];
    let castShadow = false;

    const resolveGearSlot = (mat) => {
      if (mat === m.harness) return 0;
      if (mat === m.pack) return 1;
      if (mat === m.brass) return 2;
      if (mat === m.blasterBody) return 3;
      if (mat === m.accentGlow) return 4;
      if (mat === m.vest) return 5;
      if (mat === m.catchlight) return 6;
      return -1;
    };

    container.traverse((obj) => {
      if (!obj.isMesh || !obj.geometry || !obj.material || Array.isArray(obj.material)) return;
      if (excludeSet && excludeSet.has(obj)) return;
      if (skipMatSet && skipMatSet.has(obj.material)) return;
      const slot = resolveGearSlot(obj.material);
      if (slot < 0) return;
      if (obj.castShadow) castShadow = true;
      const relMat = new THREE.Matrix4().multiplyMatrices(invRoot, obj.matrixWorld);
      const g = obj.geometry.index ? obj.geometry.toNonIndexed() : obj.geometry.clone();
      g.applyMatrix4(relMat);
      fillConstantUv(g, (slot + 0.5) / 8, 0.5);
      preparedGeos.push(g);
      srcMeshes.push(obj);
    });

    if (preparedGeos.length <= 1 && (!disposeSources || preparedGeos.length === 0)) {
      for (let i = 0; i < preparedGeos.length; i++) preparedGeos[i].dispose();
      return;
    }

    const merged = mergeNormalizedGeometries(preparedGeos, false);
    for (let i = 0; i < preparedGeos.length; i++) preparedGeos[i].dispose();
    if (!merged) return;

    if (disposeSources) this._disposeTrackedSourceMeshes(srcMeshes);
    else this._removeContainerMeshesOnly(srcMeshes);

    container.add(this._mesh(merged, m.gearPalette, castShadow));
  }

  _consolidateEyeContainer(container, isGlb, disposeSources = false) {
    if (!container) return;
    const m = this.mats;
    container.updateMatrixWorld(true);
    const invRoot = new THREE.Matrix4().copy(container.matrixWorld).invert();
    const srcMeshes = [];
    const preparedGeos = [];
    const slotChunks = [];
    let totalVerts = 0;

    const resolveEyeSlot = (mat) => {
      if (mat === m.sclera) return 0;
      if (mat === m.eyeRim) return 1;
      if (mat === m.pupil) return 2;
      if (mat === m.catchlight) return 3;
      return -1;
    };

    container.traverse((obj) => {
      if (!obj.isMesh || !obj.geometry || !obj.material || Array.isArray(obj.material)) return;
      const slot = resolveEyeSlot(obj.material);
      if (slot < 0) return;
      const relMat = new THREE.Matrix4().multiplyMatrices(invRoot, obj.matrixWorld);
      const g = obj.geometry.index ? obj.geometry.toNonIndexed() : obj.geometry.clone();
      g.applyMatrix4(relMat);
      if (slot === 3) {
        fillConstantUv(g, EYE_CATCH_UV_U, EYE_CATCH_UV_V);
      } else if (!isGlb) {
        if (slot === 1) fillConstantUv(g, EYE_SOLID_IRIS_UV_U, EYE_SOLID_IRIS_UV_V);
        else fillConstantUv(g, EYE_SOLID_NONE_UV_U, EYE_SOLID_NONE_UV_V);
      }
      const vCount = g.attributes.position.count;
      slotChunks.push({ slot, count: vCount });
      totalVerts += vCount;
      preparedGeos.push(g);
      srcMeshes.push(obj);
    });

    if (preparedGeos.length <= 1) {
      for (let i = 0; i < preparedGeos.length; i++) preparedGeos[i].dispose();
      return;
    }

    const merged = mergeNormalizedGeometries(preparedGeos, true);
    for (let i = 0; i < preparedGeos.length; i++) preparedGeos[i].dispose();
    if (!merged) return;

    const slotIds = new Uint8Array(totalVerts);
    let offset = 0;
    for (let i = 0; i < slotChunks.length; i++) {
      const { slot, count } = slotChunks[i];
      slotIds.fill(slot, offset, offset + count);
      offset += count;
    }
    merged.userData.eyeSlotIds = slotIds;
    merged.userData.isGlbEye = Boolean(isGlb);
    this._slottedEyeGeos.push(merged);

    if (disposeSources) this._disposeTrackedSourceMeshes(srcMeshes);
    else this._removeContainerMeshesOnly(srcMeshes);

    container.add(this._mesh(merged, m.eyeUnified, false));
  }

  _consolidateSkinContainer(container, isGlb, disposeSources = false) {
    if (!container) return;
    const m = this.mats;
    container.updateMatrixWorld(true);
    const invRoot = new THREE.Matrix4().copy(container.matrixWorld).invert();
    const srcMeshes = [];
    const preparedGeos = [];
    const slotChunks = [];
    let totalVerts = 0;
    let hasSculptWeights = false;

    const resolveSkinSlot = (mat) => {
      if (mat === m.skin) return 0;
      if (mat === m.belly) return isGlb ? 1 : 5;
      if (mat === m.webbing) return 2;
      if (mat === m.skinShade) return 3;
      if (mat === m.mouthDark) return 4;
      if (mat === m.skinBlended) return 6;
      if (mat === m.lipWarm) return 7;
      if (mat === m.harness) return 8;
      return -1;
    };

    container.traverse((obj) => {
      if (!obj.isMesh || !obj.geometry || !obj.material || Array.isArray(obj.material)) return;
      const slot = resolveSkinSlot(obj.material);
      if (slot < 0) return;

      const rawGeo = obj.geometry;
      const idxAttr = rawGeo.index;
      const g = idxAttr ? rawGeo.toNonIndexed() : rawGeo.clone();
      const relMat = new THREE.Matrix4().multiplyMatrices(invRoot, obj.matrixWorld);
      g.applyMatrix4(relMat);

      if (!isGlb || (slot !== 0 && slot !== 1)) {
        fillConstantUv(g, SKIN_WHITE_UV_U, SKIN_WHITE_UV_V);
      }

      const vCount = g.attributes.position.count;
      let bwChunk = null;
      let swChunk = null;
      if (slot === 6 && rawGeo.userData && rawGeo.userData.bellyWeights && rawGeo.userData.shadeWeights) {
        hasSculptWeights = true;
        const srcBw = rawGeo.userData.bellyWeights;
        const srcSw = rawGeo.userData.shadeWeights;
        bwChunk = new Float32Array(vCount);
        swChunk = new Float32Array(vCount);
        for (let k = 0; k < vCount; k++) {
          const origIdx = idxAttr ? idxAttr.getX(k) : k;
          bwChunk[k] = srcBw[origIdx] || 0;
          swChunk[k] = srcSw[origIdx] || 0;
        }
      }

      slotChunks.push({ slot, count: vCount, bwChunk, swChunk });
      totalVerts += vCount;
      preparedGeos.push(g);
      srcMeshes.push(obj);
    });

    if (preparedGeos.length <= 1) {
      for (let i = 0; i < preparedGeos.length; i++) preparedGeos[i].dispose();
      return;
    }

    const merged = mergeNormalizedGeometries(preparedGeos, true);
    for (let i = 0; i < preparedGeos.length; i++) preparedGeos[i].dispose();
    if (!merged) return;

    const slotIds = new Uint8Array(totalVerts);
    const bellyWeights = hasSculptWeights ? new Float32Array(totalVerts) : null;
    const shadeWeights = hasSculptWeights ? new Float32Array(totalVerts) : null;
    let offset = 0;
    for (let i = 0; i < slotChunks.length; i++) {
      const { slot, count, bwChunk, swChunk } = slotChunks[i];
      slotIds.fill(slot, offset, offset + count);
      if (hasSculptWeights && bwChunk && swChunk) {
        bellyWeights.set(bwChunk, offset);
        shadeWeights.set(swChunk, offset);
      }
      offset += count;
    }

    merged.userData.skinSlotIds = slotIds;
    merged.userData.isGlbSkin = Boolean(isGlb);
    if (hasSculptWeights) {
      merged.userData.bellyWeights = bellyWeights;
      merged.userData.shadeWeights = shadeWeights;
    }
    this._slottedSkinGeos.push(merged);

    if (disposeSources) this._disposeTrackedSourceMeshes(srcMeshes);
    else this._removeContainerMeshesOnly(srcMeshes);

    container.add(this._mesh(merged, m.skinVertex, false));
  }

  _batchProceduralPartGroups() {
    this.group.updateMatrixWorld(true);
    if (this._visorPips) this._consolidateSameMaterial(this._visorPips, true);

    this._consolidateGearContainer(this._proceduralPartGroups.get('harness'), null, true);
    this._consolidateGearContainer(this._proceduralPartGroups.get('backpack'), null, true);
    this._consolidateGearContainer(
      this._proceduralPartGroups.get('blaster'),
      this._blasterSlide ? new Set([this._blasterSlide]) : null,
      true
    );

    this._consolidateEyeContainer(this._proceduralPartGroups.get('eyeL'), false, true);
    this._consolidateEyeContainer(this._proceduralPartGroups.get('eyeR'), false, true);

    const procSkinBones = [
      'pelvis',
      'head',
      'jaw',
      'forearmL',
      'forearmR',
      'handL',
      'handR',
      'shinL',
      'shinR',
      'footL',
      'footR',
    ];
    for (let i = 0; i < procSkinBones.length; i++) {
      this._consolidateSkinContainer(this._proceduralPartGroups.get(procSkinBones[i]), false, true);
    }

    this._applyShadowFlags();
  }

  _applyShadowFlags() {
    const b = this.bones;
    this._browBaseYL = b.browL ? b.browL.position.y : 0.158;
    this._browBaseYR = b.browR ? b.browR.position.y : 0.158;
    // Match renderer's 7 primary silhouette shadow-caster bones (-15 shadow draw calls/frame!)
    const castBones = new Set([b.chest, b.head, b.backpack, b.thighL, b.thighR, b.footL, b.footR]);
    const unlitFx = new Set([b.muzzle, this._starMotesGroup, this._visorPips]);

    const walk = (node, activeBone, skipRecv) => {
      if (!node) return;
      const nextBone = castBones.has(node)
        ? node
        : node !== b.root && Object.values(b).includes(node)
          ? node
          : activeBone;
      const sr = skipRecv || unlitFx.has(node);
      if (node.isMesh) {
        node.castShadow = castBones.has(nextBone) && !sr;
        node.receiveShadow = !sr;
      }
      const kids = node.children;
      for (let i = 0; i < kids.length; i++) {
        walk(kids[i], nextBone, sr);
      }
    };
    walk(b.root, null, false);
  }

  _resolveGlbMaterial(srcMat) {
    const name = ((srcMat && srcMat.name) || '').toLowerCase();
    const m = this.mats;
    const gt = this._glbTex;

    // Capture embedded Blender PBR textures (`map`, `normalMap`, `roughnessMap`) for live skin/era shading
    if (srcMat) {
      if (name.includes('body') || (!name && srcMat.map)) {
        if (srcMat.map && !gt.bodyMap) gt.bodyMap = srcMat.map;
        if (srcMat.normalMap && !gt.bodyNormal) gt.bodyNormal = srcMat.normalMap;
        if (srcMat.roughnessMap && !gt.bodyRough) gt.bodyRough = srcMat.roughnessMap;
      } else if (name.includes('belly')) {
        if (srcMat.map && !gt.bellyMap) gt.bellyMap = srcMat.map;
      } else if (name.includes('crest') || name.includes('fin')) {
        if (srcMat.map && !gt.crestMap) gt.crestMap = srcMat.map;
      } else if ((name.includes('shade') || name.includes('brow')) && !name.includes('sclera')) {
        if (srcMat.normalMap && !gt.shadeNormal) gt.shadeNormal = srcMat.normalMap;
      } else if (name.includes('vest') || name.includes('chamois') || name.includes('tunic')) {
        if (srcMat.map && !gt.vestMap) gt.vestMap = srcMat.map;
        if (srcMat.normalMap && !gt.vestNormal) gt.vestNormal = srcMat.normalMap;
      } else if (name.includes('harness') || name.includes('leather') || name.includes('strap') || name.includes('bracer')) {
        if (srcMat.map && !gt.harnessMap) gt.harnessMap = srcMat.map;
        if (srcMat.normalMap && !gt.harnessNormal) gt.harnessNormal = srcMat.normalMap;
      } else if (name.includes('pack') || name.includes('canvas') || name.includes('rucksack')) {
        if (srcMat.map && !gt.packMap) gt.packMap = srcMat.map;
        if (srcMat.normalMap && !gt.packNormal) gt.packNormal = srcMat.normalMap;
      } else if (name.includes('eye') || name.includes('iris') || name.includes('sclera')) {
        if (srcMat.map && !gt.eyeMap) gt.eyeMap = srcMat.map;
      }
    }

    if (name.includes('vest') || name.includes('chamois') || name.includes('tunic')) return m.vest;
    if (name.includes('lip') || name.includes('cheek') || name.includes('ochre') || name.includes('rosy')) return m.lipWarm;
    if (name.includes('belly') || name.includes('throat') || name.includes('pad')) return m.belly;
    if (name.includes('crest') || name.includes('fin')) return m.crest;
    if (name.includes('harness') || name.includes('leather') || name.includes('strap') || name.includes('bracer') || name.includes('pouch')) return m.harness;
    if (name.includes('pack') || name.includes('canvas') || name.includes('bag') || name.includes('rucksack') || name.includes('bedroll')) return m.pack;
    if (name.includes('pupil') || name.includes('cornea_dark') || name.includes('black')) return m.pupil;
    if (name.includes('catch') || name.includes('spec') || name.includes('white')) return m.catchlight;
    if (name.includes('sclera')) return m.sclera;
    if (name.includes('eye') || name.includes('iris')) return m.eyeRim;
    if (name.includes('accent') || name.includes('cryo') || name.includes('glow') || name.includes('core')) return m.accentGlow;
    if (name.includes('brass') || name.includes('buckle') || name.includes('gold') || name.includes('compass')) return m.brass;
    if (name.includes('blaster') || name.includes('gun') || name.includes('iron') || name.includes('steel')) return m.blasterBody;
    if (name.includes('web')) return m.webbing;
    if (name.includes('mouth') || name.includes('nostril') || name.includes('smirk')) return m.mouthDark;
    if (name.includes('shade') || name.includes('brow') || name.includes('dark')) return m.skinShade;
    return m.skin;
  }

  /**
   * Attaches sculpted Blender `.glb` nodes onto `PogoRig` hierarchical bones
   * via exact bind-space matrix inversion (`M_bone_bind^-1 * M_part_world`).
   */
  _applyBlenderGlb(glbTemplate) {
    const b = this.bones;
    const cloneRoot = glbTemplate.clone(true);

    cloneRoot.position.set(0, 0, 0);
    cloneRoot.rotation.set(0, 0, 0);
    cloneRoot.scale.set(1, 1, 1);
    cloneRoot.updateMatrixWorld(true);

    const bounds = new THREE.Box3().setFromObject(cloneRoot);
    if (bounds.isEmpty()) return;
    const rawHeight = bounds.max.y - bounds.min.y;
    if (rawHeight <= 0.01) return;

    const normScale = rawHeight < 0.62 || rawHeight > 1.08 ? 0.855 / rawHeight : 1.0;
    cloneRoot.scale.setScalar(normScale);
    cloneRoot.position.y = -bounds.min.y * normScale;
    cloneRoot.updateMatrixWorld(true);

    b.root.position.set(0, 0, 0);
    b.root.rotation.set(0, 0, 0);
    b.root.scale.set(1, 1, 1);
    b.pelvis.position.set(0, BASE_PELVIS_Y, 0);
    b.browL.position.set(0.098, 0.248, 0.096);
    b.browR.position.set(-0.098, 0.242, 0.096);
    for (const key of Object.keys(b)) {
      const node = b[key];
      if (node && node !== b.root && node.isObject3D && !node.isLight) {
        node.rotation.set(0, 0, 0);
        node.scale.set(1, 1, 1);
      }
    }
    const bindEyeYaw = this._eyeBaseYaw != null ? this._eyeBaseYaw : 0.18;
    b.eyeL.rotation.set(0, bindEyeYaw, 0);
    b.eyeR.rotation.set(0, -bindEyeYaw, 0);
    b.eyelidL.rotation.set(0, bindEyeYaw, 0);
    b.eyelidR.rotation.set(0, -bindEyeYaw, 0);
    b.root.updateMatrixWorld(true);

    const rootWorldInv = new THREE.Matrix4().copy(b.root.matrixWorld).invert();
    const boneBindInv = new Map();
    for (const [boneName, boneObj] of Object.entries(b)) {
      if (!boneObj || !boneObj.isObject3D) continue;
      const relBoneMat = new THREE.Matrix4().multiplyMatrices(rootWorldInv, boneObj.matrixWorld);
      boneBindInv.set(boneName, relBoneMat.invert());
    }

    const PART_TO_BONE = {
      pelvis: 'pelvis',
      hips: 'pelvis',
      spine: 'spine',
      torso: 'chest',
      chest: 'chest',
      belly: 'chest',
      neck: 'neck',
      head: 'head',
      crest: 'crest',
      browl: 'browL',
      brow_l: 'browL',
      browr: 'browR',
      brow_r: 'browR',
      eyel: 'eyeL',
      eye_l: 'eyeL',
      eyer: 'eyeR',
      eye_r: 'eyeR',
      eyelidl: 'eyelidL',
      eyelid_l: 'eyelidL',
      eyelidr: 'eyelidR',
      eyelid_r: 'eyelidR',
      jaw: 'head',
      harness: 'harness',
      backpack: 'backpack',
      pack: 'backpack',
      upperarml: 'upperArmL',
      upper_arm_l: 'upperArmL',
      forearml: 'forearmL',
      forearm_l: 'forearmL',
      handl: 'handL',
      hand_l: 'handL',
      upperarmr: 'upperArmR',
      upper_arm_r: 'upperArmR',
      forearmr: 'forearmR',
      forearm_r: 'forearmR',
      handr: 'handR',
      hand_r: 'handR',
      blaster: 'blaster',
      thighl: 'thighL',
      thigh_l: 'thighL',
      shinl: 'shinL',
      shin_l: 'shinL',
      footl: 'footL',
      foot_l: 'footL',
      thighr: 'thighR',
      thigh_r: 'thighR',
      shinr: 'shinR',
      shin_r: 'shinR',
      footr: 'footR',
      foot_r: 'footR',
    };

    const matchedTopNodes = [];
    cloneRoot.traverse((obj) => {
      if (obj === cloneRoot) return;
      let p = obj.parent;
      while (p && p !== cloneRoot) {
        const pk = (p.name || '').toLowerCase().replace(/[^a-z0-9_]/g, '');
        if (PART_TO_BONE[pk]) return;
        p = p.parent;
      }
      const cleanKey = (obj.name || '').toLowerCase().replace(/[^a-z0-9_]/g, '');
      const targetBoneName = PART_TO_BONE[cleanKey];
      if (targetBoneName && b[targetBoneName]) {
        matchedTopNodes.push({ obj, cleanKey, targetBoneName });
      }
    });

    if (matchedTopNodes.length === 0) return;

    const replacedBones = new Set();
    const glbBoneGroups = new Map();

    for (const { obj, cleanKey, targetBoneName } of matchedTopNodes) {
      const invMat = boneBindInv.get(targetBoneName);
      if (!invMat) continue;

      const worldMat = obj.matrixWorld.clone();
      const partClone = obj.clone(true);

      partClone.traverse((child) => {
        if (child.isMesh) {
          if (Array.isArray(child.material)) {
            child.material = child.material.map((mt) => this._resolveGlbMaterial(mt));
          } else {
            child.material = this._resolveGlbMaterial(child.material);
          }
        }
      });

      const localMat = new THREE.Matrix4().multiplyMatrices(invMat, worldMat);
      localMat.decompose(partClone.position, partClone.quaternion, partClone.scale);

      let glbGroup = glbBoneGroups.get(targetBoneName);
      if (!glbGroup) {
        glbGroup = new THREE.Group();
        glbGroup.name = `glb_${targetBoneName}`;
        b[targetBoneName].add(glbGroup);
        glbBoneGroups.set(targetBoneName, glbGroup);
      }
      glbGroup.add(partClone);

      replacedBones.add(targetBoneName);
      if (cleanKey === 'jaw') {
        replacedBones.add('jaw');
      }
      if (cleanKey === 'torso' || cleanKey === 'belly') {
        replacedBones.add('pelvis');
        replacedBones.add('spine');
        replacedBones.add('chest');
        replacedBones.add('neck');
      }
    }

    for (const boneName of replacedBones) {
      const proc = this._proceduralPartGroups.get(boneName);
      if (proc) proc.visible = false;
    }

    // Consolidate GLB sub-meshes per bone (<= 27 draw calls while preserving 512x512 stitched vest/strap/pack UVs!)
    const m = this.mats;
    this.group.updateMatrixWorld(true);
    this._consolidateGearContainer(glbBoneGroups.get('harness'), null, false, new Set([m.vest, m.harness]));
    this._consolidateSameMaterial(glbBoneGroups.get('harness'), false);

    this._consolidateGearContainer(glbBoneGroups.get('backpack'), null, false, new Set([m.pack]));
    this._consolidateSameMaterial(glbBoneGroups.get('backpack'), false);

    this._consolidateGearContainer(glbBoneGroups.get('blaster'), null, false, null);

    this._consolidateEyeContainer(glbBoneGroups.get('eyeL'), true, false);
    this._consolidateEyeContainer(glbBoneGroups.get('eyeR'), true, false);

    const glbSkinBones = ['chest', 'head', 'forearmL', 'footL', 'footR'];
    for (let i = 0; i < glbSkinBones.length; i++) {
      this._consolidateSkinContainer(glbBoneGroups.get(glbSkinBones[i]), true, false);
    }
    for (const [boneName, glbGroup] of glbBoneGroups.entries()) {
      if (
        boneName !== 'harness' &&
        boneName !== 'backpack' &&
        boneName !== 'blaster' &&
        boneName !== 'eyeL' &&
        boneName !== 'eyeR' &&
        !glbSkinBones.includes(boneName)
      ) {
        this._consolidateSameMaterial(glbGroup, false);
      }
    }

    this._applyShadowFlags();
    this._glbApplied = true;
    this._refreshMaterials();
    this.update(0, this._lastPoseState);
  }

  _updateGearPaletteLuts(skin, isOrig) {
    const m = this.mats;
    const alb = this._gearAlbedoLut.image.data;
    const orm = this._gearOrmLut.image.data;
    const emi = this._gearEmissiveLut.image.data;

    const writeSlot = (colIdx, albedoColor, rough, metal, emissiveColor) => {
      const ar = linearToSrgbByte(albedoColor.r);
      const ag = linearToSrgbByte(albedoColor.g);
      const ab = linearToSrgbByte(albedoColor.b);
      const rg = Math.max(0, Math.min(255, Math.round(rough * 255)));
      const mb = Math.max(0, Math.min(255, Math.round(metal * 255)));
      const er = emissiveColor ? linearToSrgbByte(emissiveColor.r) : 0;
      const eg = emissiveColor ? linearToSrgbByte(emissiveColor.g) : 0;
      const eb = emissiveColor ? linearToSrgbByte(emissiveColor.b) : 0;

      for (let row = 0; row < 2; row++) {
        const idx = (row * 8 + colIdx) * 4;
        alb[idx] = ar;
        alb[idx + 1] = ag;
        alb[idx + 2] = ab;
        alb[idx + 3] = 255;

        orm[idx] = 255;
        orm[idx + 1] = rg;
        orm[idx + 2] = mb;
        orm[idx + 3] = 255;

        emi[idx] = er;
        emi[idx + 1] = eg;
        emi[idx + 2] = eb;
        emi[idx + 3] = 255;
      }
    };

    const cHarness = this._scratchColorA.set(skin.harnessColor);
    const cPack = this._scratchColorB.set(skin.packColor);
    const cVest = this._scratchColorC.set(skin.vestColor || '#ccb68c');
    writeSlot(0, cHarness, isOrig ? 0.28 : 0.78, isOrig ? 0.16 : 0.06, null);
    writeSlot(1, cPack, isOrig ? 0.3 : 0.86, isOrig ? 0.16 : 0.04, null);
    writeSlot(2, m.brass.color, 0.28, 0.84, null);
    writeSlot(3, m.blasterBody.color, 0.26, 0.82, null);
    writeSlot(4, m.accentGlow.color, 0.14, 0.2, m.accentGlow.emissive);
    writeSlot(5, cVest, isOrig ? 0.32 : 0.86, isOrig ? 0.12 : 0.02, null);
    const cWhite = this._scratchColorC.set('#f8f6ef');
    writeSlot(6, cWhite, 0.22, 0.05, null);

    this._gearAlbedoLut.needsUpdate = true;
    this._gearOrmLut.needsUpdate = true;
    this._gearEmissiveLut.needsUpdate = true;
    m.gearPalette.emissiveIntensity = isOrig ? 1.45 : 1.15;
    m.gearPalette.needsUpdate = true;
  }

  _updateEyeEmissiveTex(skin, isOrig, useEyeTex) {
    const data = this._eyeEmissiveTex.image.data;
    data.fill(0);
    for (let i = 3; i < data.length; i += 4) data[i] = 255;

    const cGlow = this._scratchColorC.set(skin.eyeGlow);
    const glowFactor = isOrig ? 0.68 : useEyeTex ? 0.08 : 0.32;
    const ir = linearToSrgbByte(cGlow.r * glowFactor);
    const ig = linearToSrgbByte(cGlow.g * glowFactor);
    const ib = linearToSrgbByte(cGlow.b * glowFactor);

    for (let y = 0; y < 64; y++) {
      const v = y / 63;
      for (let x = 0; x < 64; x++) {
        const u = x / 63;
        const idx = (y * 64 + x) * 4;
        if (u >= 0.88 && v <= 0.12) {
          // Pure 1.0 unlit white catchlight swatch at (0.96, 0.04)
          data[idx] = 255;
          data[idx + 1] = 255;
          data[idx + 2] = 255;
        } else if (u >= 0.08 && u <= 0.2 && v >= 0.9) {
          // Solid procedural iris emissive swatch at (0.14, 0.95)
          data[idx] = ir;
          data[idx + 1] = ig;
          data[idx + 2] = ib;
        } else if (!useEyeTex && v >= 0.82 && v <= 0.9) {
          // V3/V3.5 radial GLB iris emissive band (18..32 deg -> v_gltf 0.82..0.90; leaves sclera & pupil strictly 0!)
          data[idx] = ir;
          data[idx + 1] = ig;
          data[idx + 2] = ib;
        }
      }
    }
    this._eyeEmissiveTex.needsUpdate = true;
  }

  _updateSlottedVertexColors(skin, isOrig, gt) {
    const m = this.mats;
    const isDefaultSkin = skin.id === 'default_amphibian';
    const hasBodyMap = Boolean(!isOrig && gt && gt.bodyMap);
    const isDefaultBodyTex = Boolean(hasBodyMap && isDefaultSkin);

    const cBody = this._scratchColorA.set(skin.bodyColor);
    const cBelly = this._scratchColorB.set(skin.bellyColor);
    const cDark = this._scratchColorC.set('#07110b');

    const bodyR = cBody.r;
    const bodyG = cBody.g;
    const bodyB = cBody.b;
    const bellyR = cBelly.r;
    const bellyG = cBelly.g;
    const bellyB = cBelly.b;
    const darkR = cDark.r;
    const darkG = cDark.g;
    const darkB = cDark.b;

    const webR = m.webbing.color.r;
    const webG = m.webbing.color.g;
    const webB = m.webbing.color.b;

    const shadeR = m.skinShade.color.r;
    const shadeG = m.skinShade.color.g;
    const shadeB = m.skinShade.color.b;

    const mouthR = m.mouthDark.color.r;
    const mouthG = m.mouthDark.color.g;
    const mouthB = m.mouthDark.color.b;

    const lipR = m.lipWarm.color.r;
    const lipG = m.lipWarm.color.g;
    const lipB = m.lipWarm.color.b;

    const cBracer = this._scratchColorC.set(skin.harnessColor);
    const harnR = cBracer.r;
    const harnG = cBracer.g;
    const harnB = cBracer.b;

    for (let gIdx = 0; gIdx < this._slottedSkinGeos.length; gIdx++) {
      const geo = this._slottedSkinGeos[gIdx];
      const colAttr = geo.attributes.color;
      const slots = geo.userData.skinSlotIds;
      if (!colAttr || !slots) continue;

      const isGlb = Boolean(geo.userData.isGlbSkin);
      const useWhiteTexOnSkin = Boolean(isGlb && isDefaultBodyTex);
      const s0R = useWhiteTexOnSkin ? 1 : bodyR;
      const s0G = useWhiteTexOnSkin ? 1 : bodyG;
      const s0B = useWhiteTexOnSkin ? 1 : bodyB;
      const s1R = useWhiteTexOnSkin ? 1 : bellyR;
      const s1G = useWhiteTexOnSkin ? 1 : bellyG;
      const s1B = useWhiteTexOnSkin ? 1 : bellyB;

      const bellyW = geo.userData.bellyWeights;
      const shadeW = geo.userData.shadeWeights;
      const arr = colAttr.array;
      const count = Math.min(colAttr.count, slots.length);

      for (let i = 0; i < count; i++) {
        const s = slots[i];
        let r = s0R;
        let g = s0G;
        let b = s0B;
        if (s === 1) {
          r = s1R;
          g = s1G;
          b = s1B;
        } else if (s === 2) {
          r = webR;
          g = webG;
          b = webB;
        } else if (s === 3) {
          r = shadeR;
          g = shadeG;
          b = shadeB;
        } else if (s === 4) {
          r = mouthR;
          g = mouthG;
          b = mouthB;
        } else if (s === 5) {
          r = bellyR;
          g = bellyG;
          b = bellyB;
        } else if (s === 6 && bellyW && shadeW) {
          const bw = bellyW[i];
          const sw = shadeW[i];
          r = bodyR + (bellyR - bodyR) * bw;
          g = bodyG + (bellyG - bodyG) * bw;
          b = bodyB + (bellyB - bodyB) * bw;
          r += (darkR - r) * sw;
          g += (darkG - g) * sw;
          b += (darkB - b) * sw;
        } else if (s === 7) {
          r = lipR;
          g = lipG;
          b = lipB;
        } else if (s === 8) {
          r = harnR;
          g = harnG;
          b = harnB;
        }
        arr[i * 3] = r;
        arr[i * 3 + 1] = g;
        arr[i * 3 + 2] = b;
      }
      colAttr.needsUpdate = true;
    }

    const useEyeTex = Boolean(!isOrig && isDefaultSkin && gt && gt.eyeMap);
    this._updateEyeEmissiveTex(skin, isOrig, useEyeTex);

    const cIris = this._scratchColorC.set(skin.eyeGlow);
    const irisR = cIris.r;
    const irisG = cIris.g;
    const irisB = cIris.b;
    const sclR = m.sclera.color.r;
    const sclG = m.sclera.color.g;
    const sclB = m.sclera.color.b;
    const pupR = m.pupil.color.r;
    const pupG = m.pupil.color.g;
    const pupB = m.pupil.color.b;

    for (let gIdx = 0; gIdx < this._slottedEyeGeos.length; gIdx++) {
      const geo = this._slottedEyeGeos[gIdx];
      const colAttr = geo.attributes.color;
      const slots = geo.userData.eyeSlotIds;
      if (!colAttr || !slots) continue;

      const texEye = Boolean(useEyeTex && geo.userData.isGlbEye);
      const arr = colAttr.array;
      const count = Math.min(colAttr.count, slots.length);

      for (let i = 0; i < count; i++) {
        const s = slots[i];
        if (s === 3 || texEye) {
          arr[i * 3] = 1;
          arr[i * 3 + 1] = 1;
          arr[i * 3 + 2] = 1;
        } else if (s === 0) {
          arr[i * 3] = sclR;
          arr[i * 3 + 1] = sclG;
          arr[i * 3 + 2] = sclB;
        } else if (s === 1) {
          arr[i * 3] = irisR;
          arr[i * 3 + 1] = irisG;
          arr[i * 3 + 2] = irisB;
        } else {
          arr[i * 3] = pupR;
          arr[i * 3 + 1] = pupG;
          arr[i * 3 + 2] = pupB;
        }
      }
      colAttr.needsUpdate = true;
    }
  }

  _updateSculptedVertexColors(skin) {
    const cBody = this._scratchColorA.set(skin.bodyColor);
    const cBelly = this._scratchColorB.set(skin.bellyColor);
    const cDark = this._scratchColorC.set('#07110b');

    for (const geo of this._vertexBlendedGeos) {
      const colAttr = geo.attributes.color;
      const bellyW = geo.userData.bellyWeights;
      const shadeW = geo.userData.shadeWeights;
      if (!colAttr || !bellyW || !shadeW) continue;

      const arr = colAttr.array;
      for (let i = 0; i < bellyW.length; i++) {
        const bw = bellyW[i];
        const sw = shadeW[i];
        let r = cBody.r + (cBelly.r - cBody.r) * bw;
        let g = cBody.g + (cBelly.g - cBody.g) * bw;
        let bl = cBody.b + (cBelly.b - cBody.b) * bw;

        r += (cDark.r - r) * sw;
        g += (cDark.g - g) * sw;
        bl += (cDark.b - bl) * sw;

        arr[i * 3] = r;
        arr[i * 3 + 1] = g;
        arr[i * 3 + 2] = bl;
      }
      colAttr.needsUpdate = true;
    }
  }

  /**
   * Applies one of the 8 POGO_SKINS palettes live without recreating geometry.
   * @param {string} skinId
   */
  setSkin(skinId) {
    const skin = SKIN_MAP.get(skinId) || POGO_SKINS[0];
    if (this.currentSkinId === skin.id) return;
    this.currentSkinId = skin.id;
    this._activeSkin = skin;
    this._updateSculptedVertexColors(skin);
    this._refreshMaterials();
  }

  /**
   * Switches shader/material finish between 'reboot' (damp organic amphibian + stitched leather)
   * and 'original' (glossy 2008 XBLA HD arcade cabinet finish).
   * @param {'reboot' | 'original'} era
   */
  setEraStyle(era) {
    const resolved = era === 'original' ? 'original' : 'reboot';
    if (this.currentEra === resolved) return;
    this.currentEra = resolved;
    this._refreshMaterials();
  }

  _refreshMaterials() {
    const skin = this._activeSkin || POGO_SKINS[0];
    const isOrig = this.currentEra === 'original';
    const m = this.mats;
    const maps = getSharedSurfaceMaps();
    const metalVal = typeof skin.metallic === 'number' ? skin.metallic : skin.metallic ? 0.85 : 0;

    m.skin.color.set(skin.bodyColor);
    this._scratchColorA.set(skin.bodyColor);
    if (skin.id === 'default_amphibian') {
      m.skinShade.color.set('#37603f');
      m.mouthDark.color.set('#241610');
    } else {
      this._scratchColorB.set('#08120c');
      m.skinShade.color.copy(this._scratchColorA).lerp(this._scratchColorB, 0.34);
      this._scratchColorC.set('#0d0908');
      m.mouthDark.color.copy(this._scratchColorA).lerp(this._scratchColorC, 0.68);
    }

    m.belly.color.set(skin.bellyColor);
    this._scratchColorB.set(skin.bellyColor);
    m.webbing.color.copy(this._scratchColorA).lerp(this._scratchColorB, 0.58);
    this._scratchColorC.set('#d9966b');
    m.lipWarm.color.copy(this._scratchColorB).lerp(this._scratchColorC, skin.id === 'default_amphibian' ? 0.52 : 0.25);

    m.crest.color.set(skin.crestColor);
    m.vest.color.set(skin.vestColor || '#c2a778');
    m.harness.color.set(skin.harnessColor);
    m.pack.color.set(skin.packColor);

    m.eyeRim.color.set(skin.eyeGlow);
    m.eyeRim.emissive.set(skin.eyeGlow);
    m.accentGlow.color.set(skin.accentColor);
    m.accentGlow.emissive.set(skin.accentColor);
    this.bones.muzzleLight.color.set(skin.accentColor);

    if (skin.id === 'retro_1987') {
      m.blasterBody.color.set('#f1f5f9');
      m.brass.color.set('#ef4444');
    } else if (skin.id === 'clockwork_brass') {
      m.blasterBody.color.set('#78350f');
      m.brass.color.set('#fbbf24');
    } else if (skin.id === 'golden_toppler') {
      m.blasterBody.color.set('#581c87');
      m.brass.color.set('#fde047');
    } else {
      m.blasterBody.color.set('#334155');
      m.brass.color.set('#c89b48');
    }

    m.skin.emissive.set(skin.bodyColor);
    m.skinBlended.emissive.set(skin.bodyColor);
    m.skinVertex.emissive.set(skin.bodyColor);
    m.skinShade.emissive.copy(m.skinShade.color);
    m.crest.emissive.set(skin.crestColor);

    const gt = this._glbTex || {};
    const isDefaultSkin = skin.id === 'default_amphibian';

    if (isOrig) {
      m.skin.map = null;
      m.skinVertex.map = null;
      m.belly.map = null;
      m.crest.map = null;
      m.vest.map = null;
      m.harness.map = null;
      m.pack.map = null;
      m.eyeRim.map = null;
      m.eyeUnified.map = null;
      m.sclera.map = null;
      m.pupil.map = null;
      for (const sm of [m.skin, m.skinBlended, m.skinVertex, m.skinShade, m.belly, m.crest]) {
        sm.normalMap = null;
        sm.bumpMap = null;
        sm.roughnessMap = null;
        sm.bumpScale = 0;
      }
      m.vest.normalMap = null;
      m.vest.bumpMap = null;
      m.vest.bumpScale = 0;
      m.harness.normalMap = null;
      m.harness.bumpMap = null;
      m.harness.bumpScale = 0;
      m.pack.normalMap = null;
      m.pack.bumpMap = null;
      m.pack.bumpScale = 0;

      m.skin.color.set(skin.bodyColor);
      m.belly.color.set(skin.bellyColor);
      m.crest.color.set(skin.crestColor);
      m.eyeRim.color.set(skin.eyeGlow);
      m.sclera.color.set('#f2f6ee');
      m.pupil.color.set('#04080f');

      m.skin.roughness = metalVal > 0.5 ? 0.16 : 0.2;
      m.skin.metalness = Math.max(0.16, metalVal);
      m.skin.emissiveIntensity = 0.16;

      m.skinBlended.roughness = m.skin.roughness;
      m.skinBlended.metalness = m.skin.metalness;
      m.skinBlended.emissiveIntensity = 0.12;

      m.skinVertex.roughness = m.skin.roughness;
      m.skinVertex.metalness = m.skin.metalness;
      m.skinVertex.emissiveIntensity = 0.16;

      m.skinShade.roughness = 0.22;
      m.skinShade.metalness = Math.max(0.14, metalVal);
      m.skinShade.emissiveIntensity = 0.12;

      m.belly.roughness = 0.22;
      m.belly.metalness = Math.max(0.1, metalVal * 0.65);

      m.crest.roughness = 0.18;
      m.crest.metalness = Math.max(0.18, metalVal * 0.7);
      m.crest.emissiveIntensity = 0.24;

      m.harness.roughness = 0.26;
      m.harness.metalness = 0.18;
      m.pack.roughness = 0.28;
      m.pack.metalness = 0.18;

      m.eyeRim.emissiveIntensity = 0.68;
      m.eyeUnified.roughness = 0.04;
      m.accentGlow.emissiveIntensity = 1.45;
    } else {
      // Velvety matte-satin amphibian skin (0.58..0.72 roughness — zero oily vinyl plastic shine!)
      if (gt.bodyMap) {
        const desat = isDefaultSkin ? null : this._useDerivedTex(gt.bodyMap, 'desat');
        m.skin.map = isDefaultSkin ? gt.bodyMap : desat;
        m.skin.color.set(isDefaultSkin ? '#ffffff' : skin.bodyColor);
        m.skinVertex.map = isDefaultSkin ? this._useDerivedTex(gt.bodyMap, 'skinWhite') : desat;

        const bellySrc = gt.bellyMap || gt.bodyMap;
        m.belly.map = isDefaultSkin ? bellySrc : this._useDerivedTex(bellySrc, 'desat');
        m.belly.color.set(isDefaultSkin ? '#ffffff' : skin.bellyColor);

        const crestSrc = gt.crestMap || gt.bodyMap;
        m.crest.map = isDefaultSkin ? crestSrc : this._useDerivedTex(crestSrc, 'desat');
        m.crest.color.set(isDefaultSkin ? '#ffffff' : skin.crestColor);
      } else {
        m.skin.map = null;
        m.skinVertex.map = null;
        m.belly.map = null;
        m.crest.map = null;
        m.skin.color.set(skin.bodyColor);
        m.belly.color.set(skin.bellyColor);
        m.crest.color.set(skin.crestColor);
      }

      if (gt.eyeMap && isDefaultSkin) {
        m.eyeRim.map = gt.eyeMap;
        m.eyeRim.color.set('#ffffff');
        m.sclera.map = gt.eyeMap;
        m.sclera.color.set('#ffffff');
        m.pupil.map = gt.eyeMap;
        m.pupil.color.set('#ffffff');
        m.eyeUnified.map = this._useDerivedTex(gt.eyeMap, 'eyeWhite');
      } else {
        m.eyeRim.map = null;
        m.eyeRim.color.set(skin.eyeGlow);
        m.sclera.map = null;
        m.sclera.color.set('#f2ede0');
        m.pupil.map = null;
        m.pupil.color.set('#05080f');
        m.eyeUnified.map = null;
      }

      m.vest.map = gt.vestMap ? (isDefaultSkin ? gt.vestMap : this._useDerivedTex(gt.vestMap, 'desatRepeat')) : null;
      m.vest.color.set(gt.vestMap && isDefaultSkin ? '#ffffff' : skin.vestColor || '#ccb68c');
      m.harness.map = gt.harnessMap
        ? isDefaultSkin
          ? gt.harnessMap
          : this._useDerivedTex(gt.harnessMap, 'desatRepeat')
        : null;
      m.harness.color.set(gt.harnessMap && isDefaultSkin ? '#ffffff' : skin.harnessColor);
      m.pack.map = gt.packMap ? (isDefaultSkin ? gt.packMap : this._useDerivedTex(gt.packMap, 'desatRepeat')) : null;
      m.pack.color.set(gt.packMap && isDefaultSkin ? '#ffffff' : skin.packColor);

      const useDermal = Boolean(maps && metalVal < 0.5);
      if (gt.bodyNormal && metalVal < 0.5) {
        m.skin.normalMap = gt.bodyNormal;
        m.skin.normalScale.set(0.2, 0.2);
        m.skin.bumpMap = null;
        m.skin.bumpScale = 0;

        m.skinVertex.normalMap = gt.bodyNormal;
        m.skinVertex.normalScale.set(0.18, 0.18);
        m.skinVertex.bumpMap = null;
        m.skinVertex.bumpScale = 0;

        m.belly.normalMap = gt.bodyNormal;
        m.belly.normalScale.set(0.12, 0.12);
        m.crest.normalMap = gt.bodyNormal;
        m.crest.normalScale.set(0.18, 0.18);
      } else {
        m.skin.normalMap = null;
        m.skinVertex.normalMap = null;
        m.belly.normalMap = null;
        m.crest.normalMap = null;
        m.skin.bumpMap = useDermal ? maps.skinBump : null;
        m.skin.bumpScale = useDermal ? 0.012 : 0;
        m.skinVertex.bumpMap = useDermal ? maps.skinBump : null;
        m.skinVertex.bumpScale = useDermal ? 0.012 : 0;
      }

      const velvetRgh = gt.bodyRough && metalVal < 0.5 ? this._useDerivedTex(gt.bodyRough, 'velvetRough') : null;
      m.skin.roughnessMap = velvetRgh || (useDermal ? maps.skinRough : null);
      m.skinVertex.roughnessMap = velvetRgh || (useDermal ? maps.skinRough : null);
      m.belly.roughnessMap = velvetRgh || null;

      m.skinBlended.bumpMap = useDermal ? maps.skinBump : null;
      m.skinBlended.roughnessMap = useDermal ? maps.skinRough : null;
      m.skinBlended.bumpScale = useDermal ? 0.012 : 0;

      if ((gt.shadeNormal || gt.bodyNormal) && metalVal < 0.5) {
        m.skinShade.normalMap = gt.shadeNormal || gt.bodyNormal;
        m.skinShade.normalScale.set(0.28, 0.28);
        m.skinShade.bumpMap = null;
      } else {
        m.skinShade.normalMap = null;
        m.skinShade.bumpMap = useDermal ? maps.skinBump : null;
        m.skinShade.bumpScale = useDermal ? 0.012 : 0;
      }

      m.vest.normalMap = gt.vestNormal || null;
      if (gt.vestNormal) m.vest.normalScale.set(0.58, 0.58);
      m.vest.bumpMap = gt.vestNormal ? null : maps ? maps.packBump : null;
      m.vest.bumpScale = gt.vestNormal ? 0 : maps ? 0.016 : 0;

      m.harness.normalMap = gt.harnessNormal || null;
      if (gt.harnessNormal) m.harness.normalScale.set(0.55, 0.55);
      m.harness.bumpMap = gt.harnessNormal ? null : maps ? maps.leatherBump : null;
      m.harness.bumpScale = gt.harnessNormal ? 0 : maps ? 0.018 : 0;

      m.pack.normalMap = gt.packNormal || null;
      if (gt.packNormal) m.pack.normalScale.set(0.55, 0.55);
      m.pack.bumpMap = gt.packNormal ? null : maps ? maps.packBump : null;
      m.pack.bumpScale = gt.packNormal ? 0 : maps ? 0.02 : 0;

      m.skin.roughness = metalVal > 0.5 ? 0.26 : velvetRgh ? 1.0 : 0.64;
      m.skin.metalness = metalVal > 0 ? metalVal : 0.0;
      m.skin.emissiveIntensity = 0.04;

      m.skinBlended.roughness = metalVal > 0.5 ? 0.26 : 0.64;
      m.skinBlended.metalness = m.skin.metalness;
      m.skinBlended.emissiveIntensity = 0.04;

      m.skinVertex.roughness = m.skin.roughness;
      m.skinVertex.metalness = m.skin.metalness;
      m.skinVertex.emissiveIntensity = 0.04;

      m.skinShade.roughness = metalVal > 0.5 ? 0.3 : 0.66;
      m.skinShade.metalness = m.skin.metalness;
      m.skinShade.emissiveIntensity = 0.03;

      m.belly.roughness = metalVal > 0.5 ? 0.3 : velvetRgh ? 1.0 : 0.7;
      m.belly.metalness = metalVal * 0.55;
      m.lipWarm.roughness = metalVal > 0.5 ? 0.3 : 0.66;
      m.lipWarm.metalness = metalVal * 0.5;

      m.crest.roughness = metalVal > 0.5 ? 0.26 : 0.58;
      m.crest.metalness = metalVal > 0 ? metalVal * 0.5 : 0.0;
      m.crest.emissiveIntensity = 0.08;

      m.vest.roughness = 0.86;
      m.vest.metalness = 0.02;
      m.harness.roughness = 0.78;
      m.harness.metalness = 0.06;
      m.pack.roughness = 0.86;
      m.pack.metalness = 0.04;

      m.eyeRim.emissiveIntensity = 0.34;
      m.eyeUnified.roughness = 0.07;
      m.accentGlow.emissiveIntensity = 1.15;
    }

    this._updateGearPaletteLuts(skin, isOrig);
    this._updateSlottedVertexColors(skin, isOrig, gt);

    m.skin.needsUpdate = true;
    m.skinBlended.needsUpdate = true;
    m.skinVertex.needsUpdate = true;
    m.skinShade.needsUpdate = true;
    m.belly.needsUpdate = true;
    m.crest.needsUpdate = true;
    m.vest.needsUpdate = true;
    m.harness.needsUpdate = true;
    m.pack.needsUpdate = true;
    m.eyeRim.needsUpdate = true;
    m.eyeUnified.needsUpdate = true;
    m.sclera.needsUpdate = true;
    m.pupil.needsUpdate = true;

    if (this._divingCollar) {
      this._divingCollar.visible = skin.id === 'deep_diver' || skin.id === 'clockwork_brass';
    }
    if (this._visorPips) {
      this._visorPips.visible = skin.id === 'shadow_infiltrator';
    }
    if (this._starMotesGroup) {
      this._starMotesGroup.visible = skin.id === 'golden_toppler';
    }
  }

  /**
   * Procedural skeletal pose update called once per frame (zero heap allocations).
   * @param {number} dt - frame delta seconds
   * @param {object} [poseState]
   */
  update(dt, poseState) {
    const ps = poseState || this._lastPoseState;
    this._lastPoseState = ps;

    const safeDt = Number.isFinite(dt) ? Math.min(Math.max(dt, 0), 0.1) : 0.016;
    this._internalTime += safeDt;

    if (ps.skinId) this.setSkin(ps.skinId);
    if (ps.era) this.setEraStyle(ps.era);

    const time = Number.isFinite(ps.time) ? ps.time : this._internalTime;
    const vx = Number(ps.vx) || 0;
    const vy = Number(ps.vy) || 0;
    const dir = (ps.facing != null ? Number(ps.facing) : 1) < 0 ? -1 : 1;
    const onGround = ps.onGround !== undefined ? Boolean(ps.onGround) : true;
    const onElevator = Boolean(ps.onElevator);
    const doorBlend = THREE.MathUtils.clamp(Number(ps.enteringDoor) || 0, 0, 1);
    const hurtTimer = Math.max(0, Number(ps.hurtTimer) || 0);
    const invuln = Math.max(0, Number(ps.invuln) || 0);
    const muzzleFlash = Math.max(0, Number(ps.muzzleFlash) || 0);
    const victory = Boolean(ps.victory);

    const speed = Math.abs(vx);
    const speedNorm = THREE.MathUtils.clamp(speed / 4.5, 0, 1);
    const b = this.bones;

    if (!this._wasOnGround && onGround && this._lastVy < -1.2) {
      const autoImpact = THREE.MathUtils.clamp(-this._lastVy / 11.5, 0.22, 1.0);
      this._landCompression = Math.max(this._landCompression, autoImpact);
    } else if (this._wasOnGround && !onGround && vy > 2.0) {
      this._takeoffSnap = 1.0;
    }
    this._wasOnGround = onGround;
    this._lastVy = vy;

    const extImpact = THREE.MathUtils.clamp(Number(ps.landImpact) || 0, 0, 1);
    this._landCompression = Math.max(extImpact, damp(this._landCompression, 0, 16, safeDt));
    this._takeoffSnap = damp(this._takeoffSnap, 0, 12, safeDt);

    const firing = muzzleFlash > 0.001;
    this._aimBlend = damp(this._aimBlend, firing ? 1 : 0, firing ? 34 : 10, safeDt);
    this._recoil = firing ? Math.min(1, muzzleFlash / 0.12) : damp(this._recoil, 0, 20, safeDt);

    if ((onGround && speed > 0.12) || doorBlend > 0.05) {
      const effSpeed = Math.max(speed, doorBlend * 3.2);
      this._walkPhase += safeDt * (4.4 + effSpeed * 2.15);
    }

    let targetYaw = dir * (0.28 + speedNorm * 0.58);
    if (!onGround && speed > 0.2) {
      targetYaw = dir * (0.58 + speedNorm * 0.28);
    }
    if (this._aimBlend > 0.15) {
      targetYaw = THREE.MathUtils.lerp(targetYaw, dir * 0.78, this._aimBlend);
    }
    if (victory) {
      targetYaw = Math.sin(time * 3.2) * 0.25;
    }
    if (doorBlend > 0.001) {
      const doorYaw = dir >= 0 ? Math.PI : -Math.PI;
      targetYaw = THREE.MathUtils.lerp(targetYaw, doorYaw, Math.min(1, doorBlend * 1.35));
    }

    this._yaw = dampAngle(this._yaw, targetYaw, 15, safeDt);
    b.root.rotation.set(0, this._yaw, 0);
    b.root.position.set(0, 0, -doorBlend * 0.28);

    const sx = THREE.MathUtils.clamp(Number(ps.squashX) || 1, 0.88, 1.12);
    const sy = THREE.MathUtils.clamp(Number(ps.squashY) || 1, 0.88, 1.12);
    b.root.scale.set(sx, sy, sx);

    b.root.visible = true;
    const baseEmissive = this.currentEra === 'original' ? 0.16 : 0.04;
    if (invuln > 0) {
      const shimmer = 0.5 + 0.5 * Math.sin(time * 32);
      this.mats.skin.emissiveIntensity = baseEmissive + shimmer * 0.42;
      this.mats.skinBlended.emissiveIntensity = baseEmissive + shimmer * 0.42;
      this.mats.skinVertex.emissiveIntensity = baseEmissive + shimmer * 0.42;
    } else if (this.mats.skin.emissiveIntensity !== baseEmissive) {
      this.mats.skin.emissiveIntensity = baseEmissive;
      this.mats.skinBlended.emissiveIntensity = this.currentEra === 'original' ? 0.12 : 0.04;
      this.mats.skinVertex.emissiveIntensity = baseEmissive;
    }

    const breath = Math.sin(time * 3.6);
    const runBlend =
      onGround || doorBlend > 0.05
        ? THREE.MathUtils.clamp((Math.max(speed, doorBlend * 2.8) - 0.12) / 1.4, 0, 1)
        : 0;
    const wp = this._walkPhase;
    const strideSin = Math.sin(wp);
    const strideCos = Math.cos(wp);

    const runBounce = Math.abs(strideCos) * 0.028 * runBlend;
    // Reference V3 diamond frog crouch: pelvis drops 0.040m -> y = 0.212m, z = -0.010m in rest stance!
    const frogRestCrouch = (1 - runBlend * 0.45) * 0.04;
    const idleBreathDip = (1 - runBlend) * (breath * 0.006) - frogRestCrouch - (onElevator ? 0.014 : 0);
    const impactDip = this._landCompression * 0.088;
    const victoryHop = victory ? Math.abs(Math.sin(time * 8.5)) * 0.11 : 0;

    let targetPelvisY = BASE_PELVIS_Y + idleBreathDip - impactDip + runBounce + victoryHop;
    if (!onGround && !victory) {
      targetPelvisY = BASE_PELVIS_Y - 0.012;
    }
    this._pelvisY = damp(this._pelvisY, targetPelvisY, 24, safeDt);
    b.pelvis.position.set(0, this._pelvisY, -0.01 * (1 - runBlend * 0.6));

    let pelvisPitch = 0;
    const pelvisYaw = strideSin * 0.16 * runBlend;
    let pelvisRoll = strideCos * 0.06 * runBlend;

    const chestBreathScale = 1 + breath * 0.022 * (1 - runBlend * 0.5);
    b.chest.scale.set(1 + breath * 0.018, chestBreathScale, 1 + breath * 0.026);

    let targetLeanX = 0.04 + runBlend * 0.18 + this._landCompression * 0.16 + doorBlend * 0.12;
    if (!onGround) {
      if (vy > 2.2) targetLeanX = -0.08;
      else if (vy < -2.2) targetLeanX = 0.14;
      else targetLeanX = 0.08;
    }
    if (victory) targetLeanX = -0.12;

    const targetTwistY = -strideSin * 0.18 * runBlend - this._recoil * dir * 0.16;
    this._chestLeanX = damp(this._chestLeanX, targetLeanX, 16, safeDt);
    this._chestTwistY = damp(this._chestTwistY, targetTwistY, 16, safeDt);

    b.spine.rotation.set(this._chestLeanX * 0.45, this._chestTwistY * 0.45, 0);
    b.chest.rotation.set(this._chestLeanX * 0.55, this._chestTwistY * 0.55, -pelvisRoll * 0.6);

    b.backpack.rotation.x =
      -this._chestLeanX * 0.18 + Math.sin(wp * 2) * 0.04 * runBlend + this._landCompression * 0.12;
    const airCrestFlutter = !onGround ? THREE.MathUtils.clamp(-vy * 0.035, -0.18, 0.28) : 0;
    b.crest.rotation.x = airCrestFlutter + Math.sin(time * 5.2) * 0.03 - this._landCompression * 0.12;
    b.crest.rotation.z = Math.cos(time * 3.8) * 0.035;

    const legSpan = LEG_UPPER_LEN + LEG_LOWER_LEN;
    const groundHipH = THREE.MathUtils.clamp(
      this._pelvisY + HIP_OFFSET_Y - FOOT_SOLE_HEIGHT - victoryHop,
      0.095,
      legSpan - 0.006
    );
    const ikHalfBend = Math.acos(
      THREE.MathUtils.clamp(groundHipH / legSpan, 0.25, 0.992)
    );

    // Exact V3 Reference Diamond Frog-Crouch (`thigh = (-0.54, ±0.40, ±0.50)`, `shin = (+0.98, 0, ∓0.38)`, `foot = (-0.44, ±0.32, ∓0.12)`)
    const crouchBlend = onGround && !victory ? 1 - runBlend * 0.52 : 0;
    const extraKnee = Math.max(0, ikHalfBend - 0.49);
    let thighLX = -(0.54 * crouchBlend + ikHalfBend * (1 - crouchBlend) + extraKnee * 0.85);
    let shinLX = 0.98 * crouchBlend + ikHalfBend * 2 * (1 - crouchBlend) + extraKnee * 1.7;
    let footLX = -(0.44 * crouchBlend + ikHalfBend * (1 - crouchBlend) + extraKnee * 0.85);
    let thighLY = 0.4 * crouchBlend + 0.16 * (1 - crouchBlend);
    let thighLZ = 0.5 * crouchBlend + 0.18 * (1 - crouchBlend) + (onElevator ? 0.04 : 0);
    let shinLZ = -0.38 * crouchBlend - 0.1 * (1 - crouchBlend);
    let footLY = 0.32 * crouchBlend + 0.1 * (1 - crouchBlend);
    let footLZ = -0.12 * crouchBlend - 0.08 * (1 - crouchBlend);

    let thighRX = thighLX;
    let shinRX = shinLX;
    let footRX = footLX;
    let thighRY = -thighLY;
    let thighRZ = -thighLZ;
    let shinRZ = -shinLZ;
    let footRY = -footLY;
    let footRZ = -footLZ;

    if (victory) {
      const cheer = Math.sin(time * 8.5);
      thighLX = -0.48 + cheer * 0.25;
      shinLX = 0.88 - cheer * 0.2;
      footLX = -0.28;
      thighRX = -0.48 - cheer * 0.25;
      shinRX = 0.88 + cheer * 0.2;
      footRX = -0.28;
      thighLZ = 0.36;
      thighRZ = -0.36;
      shinLZ = -0.24;
      shinRZ = 0.24;
    } else if (!onGround) {
      if (vy > 2.2) {
        const launchT = THREE.MathUtils.clamp((vy - 2.2) / 5.5, 0, 1);
        thighLX = THREE.MathUtils.lerp(-0.58, 0.18, launchT);
        shinLX = THREE.MathUtils.lerp(1.08, 0.24, launchT);
        footLX = THREE.MathUtils.lerp(-0.28, 0.48, launchT);

        thighRX = THREE.MathUtils.lerp(-0.68, 0.1, launchT);
        shinRX = THREE.MathUtils.lerp(1.18, 0.32, launchT);
        footRX = THREE.MathUtils.lerp(-0.28, 0.44, launchT);
      } else if (vy >= -2.2) {
        thighLX = -0.82;
        shinLX = 1.42;
        footLX = -0.38;

        thighRX = -0.74;
        shinRX = 1.32;
        footRX = -0.34;
      } else {
        const fallT = THREE.MathUtils.clamp((-vy - 2.2) / 7.5, 0, 1);
        const leadIsLeft = dir > 0;
        const leadThigh = THREE.MathUtils.lerp(-0.68, -0.34, fallT);
        const leadShin = THREE.MathUtils.lerp(1.18, 0.48, fallT);
        const leadFoot = THREE.MathUtils.lerp(-0.28, -0.1, fallT);

        const trailThigh = -0.78;
        const trailShin = 1.36;
        const trailFoot = -0.32;

        thighLX = leadIsLeft ? leadThigh : trailThigh;
        shinLX = leadIsLeft ? leadShin : trailShin;
        footLX = leadIsLeft ? leadFoot : trailFoot;

        thighRX = leadIsLeft ? trailThigh : leadThigh;
        shinRX = leadIsLeft ? trailShin : leadShin;
        footRX = leadIsLeft ? trailFoot : leadFoot;
      }
      thighLY = 0.28;
      thighRY = -0.28;
      thighLZ = 0.34;
      thighRZ = -0.34;
      shinLZ = -0.22;
      shinRZ = 0.22;
      footLY = 0.2;
      footRY = -0.2;
      footLZ = -0.1;
      footRZ = 0.1;
    } else if (runBlend > 0.001) {
      const swingL = strideSin;
      const liftL = Math.max(0, strideCos);
      const swingR = -strideSin;
      const liftR = Math.max(0, -strideCos);

      thighLX += (-swingL * 0.58 - liftL * 0.26) * runBlend;
      shinLX += (liftL * 0.78 + Math.max(0, -swingL) * 0.2) * runBlend;
      footLX += (swingL * 0.3 - liftL * 0.22) * runBlend;

      thighRX += (-swingR * 0.58 - liftR * 0.26) * runBlend;
      shinRX += (liftR * 0.78 + Math.max(0, -swingR) * 0.2) * runBlend;
      footRX += (swingR * 0.3 - liftR * 0.22) * runBlend;
    }

    if (hurtTimer > 0) {
      const hurtBlend = THREE.MathUtils.clamp(hurtTimer / 0.25, 0, 1);
      const flail = Math.sin(time * 28);
      pelvisPitch = -0.38 * hurtBlend;
      pelvisRoll = Math.cos(time * 22) * 0.28 * hurtBlend;
      thighLX = THREE.MathUtils.lerp(thighLX, -0.6 + flail * 0.55, hurtBlend);
      thighRX = THREE.MathUtils.lerp(thighRX, -0.6 - flail * 0.55, hurtBlend);
      shinLX = THREE.MathUtils.lerp(shinLX, 0.9, hurtBlend);
      shinRX = THREE.MathUtils.lerp(shinRX, 0.9, hurtBlend);
    }

    b.pelvis.rotation.set(pelvisPitch, pelvisYaw, pelvisRoll);

    b.thighL.rotation.set(thighLX, thighLY, thighLZ);
    b.shinL.rotation.set(shinLX, 0, shinLZ);
    b.footL.rotation.set(footLX, footLY, footLZ);

    b.thighR.rotation.set(thighRX, thighRY, thighRZ);
    b.shinR.rotation.set(shinRX, 0, shinRZ);
    b.footR.rotation.set(footRX, footRY, footRZ);

    // Exact V3.5 Ready-Arm Pose (`upperArm = (0.10/0.08, ±0.14, ±0.48)`, `forearm = (-0.56/-0.58, ±0.08, ±0.14)`, `hand = (-0.06, ±0.18, ∓0.16)`)
    let armLPitch = 0.1 - breath * 0.022;
    let armLRoll = 0.48 + breath * 0.02;
    let foreLPitch = -0.56;

    let armRPitch = 0.08 - breath * 0.022;
    let armRRoll = -0.48 - breath * 0.02;
    let armRYaw = 0;
    let foreRPitch = -0.58;

    if (victory) {
      const pump = Math.sin(time * 8.5);
      armLPitch = -2.45 + pump * 0.28;
      armLRoll = 0.35;
      foreLPitch = -0.35;

      armRPitch = -2.55 - pump * 0.28;
      armRRoll = -0.35;
      foreRPitch = -0.3;
    } else if (hurtTimer > 0) {
      const w = Math.sin(time * 26);
      armLPitch = -1.35 + w * 0.35;
      armLRoll = 0.72;
      armRPitch = -1.35 - w * 0.35;
      armRRoll = -0.72;
    } else if (!onGround) {
      const airLift = THREE.MathUtils.clamp(Math.abs(vy) / 8, 0.25, 1);
      armLPitch = vy > 1.5 ? 0.36 : -0.36 * airLift;
      armLRoll = 0.64 + 0.2 * airLift;
      foreLPitch = -0.6;

      armRPitch = vy > 1.5 ? 0.28 : -0.34 * airLift;
      armRRoll = -0.62 - 0.2 * airLift;
      foreRPitch = -0.62;
    } else if (runBlend > 0.001) {
      armLPitch = THREE.MathUtils.lerp(0.1, strideSin * 0.68, runBlend);
      armLRoll = THREE.MathUtils.lerp(0.48, 0.42 + Math.abs(strideSin) * 0.1, runBlend);
      foreLPitch = -0.56 - Math.max(0, -strideSin) * 0.28 * runBlend;

      armRPitch = THREE.MathUtils.lerp(0.08, -strideSin * 0.56, runBlend);
      armRRoll = THREE.MathUtils.lerp(-0.48, -0.44 - Math.abs(strideSin) * 0.1, runBlend);
      foreRPitch = -0.58 - Math.max(0, strideSin) * 0.26 * runBlend;
    }

    if (this._aimBlend > 0.001) {
      const aimShoulderPitch = -1.24 + this._recoil * 0.28;
      const aimShoulderYaw = dir < 0 ? 0.24 : -0.12;
      const aimShoulderRoll = -0.2;
      const aimForePitch = -0.26 - this._recoil * 0.22;

      armRPitch = THREE.MathUtils.lerp(armRPitch, aimShoulderPitch, this._aimBlend);
      armRYaw = THREE.MathUtils.lerp(armRYaw, aimShoulderYaw, this._aimBlend);
      armRRoll = THREE.MathUtils.lerp(armRRoll, aimShoulderRoll, this._aimBlend);
      foreRPitch = THREE.MathUtils.lerp(foreRPitch, aimForePitch, this._aimBlend);
    }

    b.shoulderL.rotation.set(0, 0, 0);
    b.upperArmL.rotation.set(armLPitch, 0.14 * (1 - runBlend * 0.5), armLRoll);
    b.forearmL.rotation.set(foreLPitch, 0.08 * (1 - runBlend * 0.5), 0.14 * (1 - runBlend * 0.4));
    b.handL.rotation.set(-0.06, 0.18, -0.16);

    b.shoulderR.rotation.set(0, armRYaw, 0);
    b.upperArmR.rotation.set(armRPitch, -0.14 * (1 - runBlend * 0.5) * (1 - this._aimBlend), armRRoll);
    b.forearmR.rotation.set(
      foreRPitch,
      -0.08 * (1 - runBlend * 0.5) * (1 - this._aimBlend),
      -0.14 * (1 - runBlend * 0.4) * (1 - this._aimBlend)
    );
    b.handR.rotation.set(
      THREE.MathUtils.lerp(-0.06, 1.34, this._aimBlend),
      THREE.MathUtils.lerp(-0.18, 0, this._aimBlend),
      THREE.MathUtils.lerp(0.16, 0.08, this._aimBlend)
    );

    if (this._blasterSlide) {
      this._blasterSlide.position.z = 0.122 - this._recoil * 0.042;
    }
    if (muzzleFlash > 0.001) {
      b.muzzle.visible = true;
      b.muzzle.scale.setScalar(0.72 + this._recoil * 0.95);
      b.muzzle.rotation.z = time * 32;
      b.muzzleLight.intensity = 2.4 * this._recoil;
    } else {
      b.muzzle.visible = false;
      b.muzzleLight.intensity = 0;
    }

    // Curious +8.3 deg (`0.145 rad`) head cock (`pogo_v3_hero_3q.png`) & quick saccadic turret-eye glances
    const idleScanY = (Math.sin(time * 1.15) * 0.15 + Math.sin(time * 2.55) * 0.05) * (1 - runBlend);
    const idleTiltZ = (dir * 0.145 + Math.cos(time * 1.35) * 0.035) * (1 - runBlend * 0.65);

    let targetHeadPitch = -this._chestLeanX * 0.6 + Math.sin(time * 1.9) * 0.03 * (1 - runBlend);
    if (!onGround) {
      targetHeadPitch = THREE.MathUtils.clamp(-vy * 0.038, -0.22, 0.24);
    } else if (onElevator && Math.abs(vy) > 0.1) {
      targetHeadPitch = THREE.MathUtils.clamp(-vy * 0.08, -0.22, 0.22);
    }
    if (victory) targetHeadPitch = -0.2 + Math.sin(time * 8.5) * 0.08;

    const targetHeadYaw = -this._chestTwistY * 0.6 + idleScanY;

    this._headPitch = damp(this._headPitch, targetHeadPitch, 14, safeDt);
    this._headYaw = damp(this._headYaw, targetHeadYaw, 14, safeDt);
    this._headRoll = damp(this._headRoll, idleTiltZ, 10, safeDt);

    b.neck.rotation.set(this._headPitch * 0.35, this._headYaw * 0.35, 0);
    b.head.rotation.set(this._headPitch * 0.65, this._headYaw * 0.65, this._headRoll);

    const sacPhase = time * 0.88;
    const sacStep = Math.floor(sacPhase);
    const sacT = Math.min(1, (sacPhase - sacStep) * 4.8);
    const sacSmooth = sacT * sacT * (3 - 2 * sacT);
    const glanceA = Math.sin(sacStep * 2.39996) * 0.13;
    const glanceB = Math.sin((sacStep + 1) * 2.39996) * 0.13;
    const sacYaw = THREE.MathUtils.lerp(glanceA, glanceB, sacSmooth) * (1 - runBlend);
    const sacPitch = Math.cos(sacStep * 1.71) * 0.04 * (1 - runBlend);

    const eyeLookY = dir * 0.06 * runBlend + sacYaw + idleScanY * 0.22;
    const baseEyeYaw = this._eyeBaseYaw != null ? this._eyeBaseYaw : 0.18;
    b.eyeL.rotation.set(sacPitch, baseEyeYaw + eyeLookY, 0);
    b.eyeR.rotation.set(sacPitch, -baseEyeYaw + eyeLookY, 0);

    // Exact V3.5 cocked asymmetric chameleon brows (`browL.rz = +0.08`, `browR.rz = -0.14` in rest)
    const baseBrowYL = this._browBaseYL != null ? this._browBaseYL : 0.248;
    const baseBrowYR = this._browBaseYR != null ? this._browBaseYR : 0.242;
    const idleAsym = 1 - Math.min(1, runBlend * 1.4 + this._aimBlend);
    let browTiltL = 0.08 * idleAsym + Math.sin(time * 1.4) * 0.025 * idleAsym;
    let browTiltR = -0.14 * idleAsym - Math.sin(time * 1.4) * 0.025 * idleAsym;
    let browOffsetL = 0;
    let browOffsetR = 0.002 * idleAsym;

    if (hurtTimer > 0) {
      browTiltL = 0.32;
      browTiltR = -0.32;
      browOffsetL = -0.006;
      browOffsetR = -0.006;
    } else if (!onGround && vy > 1.8) {
      browTiltL = 0.12;
      browTiltR = -0.12;
      browOffsetL = 0.008;
      browOffsetR = 0.008;
    } else if (runBlend > 0.25 || this._aimBlend > 0.2) {
      const focus = Math.max(runBlend, this._aimBlend);
      browTiltL = -0.2 * focus;
      browTiltR = 0.2 * focus;
      browOffsetL = -0.004 * focus;
      browOffsetR = -0.004 * focus;
    }
    b.browL.position.y = baseBrowYL + browOffsetL;
    b.browR.position.y = baseBrowYR + browOffsetR;
    b.browL.rotation.z = browTiltL;
    b.browR.rotation.z = browTiltR;

    const blinkCycle = time % 4.2;
    const isDoubleCycle = Math.floor(time / 4.2) % 3 === 1;
    let blinkAmt = 0;
    if (blinkCycle < 0.13) {
      blinkAmt = Math.sin((blinkCycle / 0.13) * Math.PI);
    } else if (isDoubleCycle && blinkCycle > 0.22 && blinkCycle < 0.34) {
      blinkAmt = Math.sin(((blinkCycle - 0.22) / 0.12) * Math.PI);
    }

    const squintL = hurtTimer > 0 ? 0.68 : this._recoil * 0.25;
    const squintR = hurtTimer > 0 ? 0.68 : this._recoil * 0.55;
    b.eyelidL.rotation.set(THREE.MathUtils.lerp(-1.08, 0.18, Math.max(blinkAmt, squintL)), baseEyeYaw, 0);
    b.eyelidR.rotation.set(THREE.MathUtils.lerp(-1.02, 0.18, Math.max(blinkAmt, squintR)), -baseEyeYaw, 0);

    // Subtle gular throat-pouch breathing on `jaw` bone (conformal chin stays fused to `head`!)
    const gularPulse = (0.5 + 0.5 * Math.sin(time * 4.6)) * (1 - runBlend);
    b.jaw.rotation.x = 0.008 + gularPulse * 0.018;
    b.jaw.scale.set(1 + gularPulse * 0.025, 1 + gularPulse * 0.06, 1 + gularPulse * 0.035);

    if (this._starMotesGroup && this._starMotesGroup.visible) {
      for (let i = 0; i < this._starMotes.length; i++) {
        const mote = this._starMotes[i];
        const a = time * 1.9 + (i * Math.PI * 2) / this._starMotes.length;
        const radius = 0.2 + Math.sin(time * 2.7 + i) * 0.03;
        mote.position.set(
          Math.cos(a) * radius,
          0.08 + Math.sin(time * 3.1 + i * 1.4) * 0.11,
          Math.sin(a) * radius
        );
        mote.rotation.set(time * 2.4 + i, time * 1.8, 0);
        mote.scale.setScalar(0.72 + Math.sin(time * 5 + i * 2) * 0.28);
      }
    }
  }

  /**
   * Cleanly disposes all instance geometries and materials.
   */
  dispose() {
    this._disposed = true;
    for (const geo of this._geometries) {
      geo.dispose();
    }
    this._geometries.clear();

    for (const mat of this._materials) {
      mat.dispose();
    }
    this._materials.clear();

    for (const tex of this._textures) {
      tex.dispose();
    }
    this._textures.clear();

    for (const key of this._derivedTexKeys) {
      const entry = _derivedTexPool.get(key);
      if (entry) {
        entry.refs -= 1;
        if (entry.refs <= 0) {
          entry.tex.dispose();
          _derivedTexPool.delete(key);
        }
      }
    }
    this._derivedTexKeys.clear();
    this._slottedSkinGeos.length = 0;
    this._slottedEyeGeos.length = 0;
    this._vertexBlendedGeos.length = 0;
  }
}
