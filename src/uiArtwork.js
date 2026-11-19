// Towering Waters: Gateway's Descent — Created by Matt Shaffer
// Bespoke Hydro-Glass Menu Illustrations, Chiseled 3D Crest, Expressive Cutscene Portraits & Living World Watershed Map
// Pure ES6 module — zero external dependencies, zero network fetches, zero emojis.

let _svgUidCounter = 0;
function nextUid(prefix = 'tw') {
  _svgUidCounter = (_svgUidCounter + 1) % 999999;
  return `${prefix}-${_svgUidCounter}`;
}

function fmt(n) {
  return Number(n).toFixed(2).replace(/\.00$/, '');
}

function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function clamp01(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

function lerpHex(hexA, hexB, t) {
  const u = clamp01(t);
  const a = parseInt(String(hexA).replace('#', ''), 16);
  const b = parseInt(String(hexB).replace('#', ''), 16);
  const ar = (a >> 16) & 255;
  const ag = (a >> 8) & 255;
  const ab = a & 255;
  const br = (b >> 16) & 255;
  const bg = (b >> 8) & 255;
  const bb = b & 255;
  const r = Math.round(ar + (br - ar) * u);
  const g = Math.round(ag + (bg - ag) * u);
  const bl = Math.round(ab + (bb - ab) * u);
  return `#${((1 << 24) | (r << 16) | (g << 8) | bl).toString(16).slice(1)}`;
}

// ============================================================================
// PRECISION PROCEDURAL HYDRO-TURBINE, ASTROLABE & WATER-SEED GEOMETRY HELPERS
// ============================================================================

function buildTurbineWheelPath(cx, cy, rOuter, rRoot, rRimIn, rHubOut, rBore, blades = 12, spokes = 5, rotDeg = 0) {
  const step = (Math.PI * 2) / blades;
  const rot = (rotDeg * Math.PI) / 180;
  let d = '';

  for (let i = 0; i < blades; i++) {
    const a0 = rot + i * step;
    const a1 = a0 + step * 0.16;
    const a2 = a0 + step * 0.28;
    const a3 = a0 + step * 0.54;
    const a4 = a0 + step * 0.66;

    const p0x = cx + Math.cos(a0) * rRoot;
    const p0y = cy + Math.sin(a0) * rRoot;
    const p1x = cx + Math.cos(a1) * rRoot;
    const p1y = cy + Math.sin(a1) * rRoot;
    const p2x = cx + Math.cos(a2) * rOuter;
    const p2y = cy + Math.sin(a2) * rOuter;
    const p3x = cx + Math.cos(a3) * rOuter;
    const p3y = cy + Math.sin(a3) * rOuter;
    const p4x = cx + Math.cos(a4) * rRoot;
    const p4y = cy + Math.sin(a4) * rRoot;

    d += i === 0 ? `M ${fmt(p0x)} ${fmt(p0y)} ` : `L ${fmt(p0x)} ${fmt(p0y)} `;
    d += `L ${fmt(p1x)} ${fmt(p1y)} L ${fmt(p2x)} ${fmt(p2y)} L ${fmt(p3x)} ${fmt(p3y)} L ${fmt(p4x)} ${fmt(p4y)} `;
  }
  d += 'Z ';

  if (spokes > 0 && rRimIn > rHubOut + 1.5) {
    const sStep = (Math.PI * 2) / spokes;
    const padAngle = Math.min(0.24, sStep * 0.19);
    for (let s = 0; s < spokes; s++) {
      const sa0 = rot + s * sStep + padAngle;
      const sa1 = rot + (s + 1) * sStep - padAngle;
      if (sa1 <= sa0 + 0.05) continue;
      const x0 = cx + Math.cos(sa0) * rHubOut;
      const y0 = cy + Math.sin(sa0) * rHubOut;
      const x1 = cx + Math.cos(sa0) * rRimIn;
      const y1 = cy + Math.sin(sa0) * rRimIn;
      const x2 = cx + Math.cos(sa1) * rRimIn;
      const y2 = cy + Math.sin(sa1) * rRimIn;
      const x3 = cx + Math.cos(sa1) * rHubOut;
      const y3 = cy + Math.sin(sa1) * rHubOut;
      d += `M ${fmt(x0)} ${fmt(y0)} L ${fmt(x1)} ${fmt(y1)} A ${fmt(rRimIn)} ${fmt(rRimIn)} 0 0 1 ${fmt(x2)} ${fmt(y2)} L ${fmt(x3)} ${fmt(y3)} A ${fmt(rHubOut)} ${fmt(rHubOut)} 0 0 0 ${fmt(x0)} ${fmt(y0)} Z `;
    }
  }

  if (rBore > 0.5) {
    d += `M ${fmt(cx + rBore)} ${fmt(cy)} A ${fmt(rBore)} ${fmt(rBore)} 0 1 0 ${fmt(cx - rBore)} ${fmt(cy)} A ${fmt(rBore)} ${fmt(rBore)} 0 1 0 ${fmt(cx + rBore)} ${fmt(cy)} Z`;
  }
  return d.trim();
}

function buildStarBurstPath(cx, cy, rMajor, rMinor, points = 8, rotDeg = 0) {
  const total = points * 2;
  const rot = (rotDeg * Math.PI) / 180 - Math.PI / 2;
  let d = '';
  for (let i = 0; i < total; i++) {
    const r = i % 2 === 0 ? rMajor : rMinor;
    const a = rot + (i * Math.PI) / points;
    const x = cx + Math.cos(a) * r;
    const y = cy + Math.sin(a) * r;
    d += `${i === 0 ? 'M' : 'L'} ${fmt(x)} ${fmt(y)} `;
  }
  return `${d}Z`;
}

function buildDegreeTicksPath(cx, cy, rIn, rOut, count = 36, skipEvery = 0, rotDeg = 0) {
  const rot = (rotDeg * Math.PI) / 180;
  let d = '';
  for (let i = 0; i < count; i++) {
    if (skipEvery > 0 && i % skipEvery === 0) continue;
    const a = rot + (i * Math.PI * 2) / count;
    const c = Math.cos(a);
    const s = Math.sin(a);
    const r0 = i % 3 === 0 ? rIn - (rOut - rIn) * 0.35 : rIn;
    d += `M ${fmt(cx + c * r0)} ${fmt(cy + s * r0)} L ${fmt(cx + c * rOut)} ${fmt(cy + s * rOut)} `;
  }
  return d.trim();
}

// ============================================================================
// CHISELED 3D-EXTRUDED HYDRO-SANCTUM DISPLAY GLYPHS ("TOWERING" + "WATERS")
// ============================================================================

const CHISELED_GLYPHS = {
  T: {
    w: 78,
    polys: [
      [
        [0, 0], [78, 0], [74, 26], [65, 22], [52, 22], [52, 91], [57, 100],
        [21, 100], [26, 91], [26, 22], [13, 22], [4, 26],
      ],
    ],
    ridges: [[[8, 11], [70, 11]], [[39, 11], [39, 93]]],
    veins: [[[17, 0], [20, 10], [16, 16]], [[52, 58], [43, 63], [40, 71]]],
  },
  O: {
    w: 82,
    polys: [
      [
        [18, 0], [64, 0], [82, 18], [82, 82], [64, 100], [18, 100], [0, 82], [0, 18],
      ],
      [
        [28, 22], [54, 22], [58, 27], [58, 73], [54, 78], [28, 78], [24, 73], [24, 27],
      ],
    ],
    ridges: [[[21, 11], [61, 11], [71, 21], [71, 79], [61, 89], [21, 89], [11, 79], [11, 21], [21, 11]]],
    veins: [[[0, 38], [10, 41], [15, 36]], [[57, 100], [54, 89], [59, 84]]],
  },
  W: {
    w: 102,
    polys: [
      [
        [0, 0], [24, 0], [34, 61], [44, 16], [58, 16], [68, 61], [78, 0], [102, 0],
        [83, 100], [60, 100], [51, 57], [42, 100], [19, 100],
      ],
    ],
    ridges: [[[12, 8], [30, 90], [51, 34], [72, 90], [90, 8]]],
    veins: [[[9, 44], [18, 47], [22, 43]], [[86, 58], [78, 62]]],
  },
  E: {
    w: 74,
    polys: [
      [
        [0, 0], [73, 0], [70, 23], [62, 21], [25, 21], [25, 39], [58, 39], [64, 50],
        [58, 61], [25, 61], [25, 79], [63, 79], [71, 76], [74, 100], [0, 100],
      ],
    ],
    ridges: [[[64, 11], [12, 11], [12, 89], [65, 89]], [[12, 50], [56, 50]]],
    veins: [[[44, 0], [41, 9], [46, 14]], [[4, 58], [13, 55], [18, 60]]],
  },
  R: {
    w: 82,
    polys: [
      [
        [0, 0], [58, 0], [78, 16], [78, 44], [62, 57], [82, 100], [55, 100],
        [38, 61], [25, 61], [25, 92], [29, 100], [0, 100],
      ],
      [
        [25, 21], [50, 21], [54, 25], [54, 38], [50, 42], [25, 42],
      ],
    ],
    ridges: [[[12, 92], [12, 11], [53, 11], [66, 21], [66, 39], [53, 51], [12, 51]], [[48, 53], [68, 93]]],
    veins: [[[78, 29], [69, 32], [65, 29]], [[64, 82], [56, 86]]],
  },
  I: {
    w: 36,
    polys: [
      [
        [2, 0], [34, 0], [30, 12], [30, 88], [34, 100], [2, 100], [6, 88], [6, 12],
      ],
    ],
    ridges: [[[18, 8], [18, 92]]],
    veins: [[[6, 46], [15, 50], [19, 45]]],
  },
  N: {
    w: 84,
    polys: [
      [
        [0, 0], [25, 0], [59, 60], [59, 0], [84, 0], [84, 100], [59, 100], [25, 40], [25, 100], [0, 100],
      ],
    ],
    ridges: [[[12, 92], [12, 12], [72, 88], [72, 8]]],
    veins: [[[25, 66], [16, 70]], [[84, 34], [74, 38]]],
  },
  G: {
    w: 84,
    polys: [
      [
        [18, 0], [68, 0], [82, 16], [74, 30], [58, 22], [27, 22], [24, 27], [24, 73],
        [28, 78], [58, 78], [58, 60], [42, 60], [38, 44], [84, 44], [84, 84], [66, 100],
        [18, 100], [0, 82], [0, 18],
      ],
    ],
    ridges: [[[66, 12], [20, 12], [11, 22], [11, 78], [20, 89], [64, 89], [72, 78], [72, 52], [46, 52]]],
    veins: [[[0, 48], [10, 52], [15, 47]]],
  },
  A: {
    w: 86,
    polys: [
      [
        [30, 0], [56, 0], [86, 100], [59, 100], [53, 76], [33, 76], [27, 100], [0, 100],
      ],
      [
        [43, 24], [50, 56], [36, 56],
      ],
    ],
    ridges: [[[14, 92], [43, 10], [72, 92]], [[31, 66], [55, 66]]],
    veins: [[[18, 62], [27, 65]], [[69, 72], [61, 75]]],
  },
  S: {
    w: 78,
    polys: [
      [
        [16, 0], [66, 0], [78, 14], [70, 28], [56, 21], [26, 21], [23, 26], [23, 37],
        [27, 40], [62, 43], [78, 57], [78, 84], [62, 100], [12, 100], [0, 86], [8, 71],
        [24, 79], [52, 79], [55, 74], [55, 63], [51, 59], [16, 56], [0, 42], [0, 16],
      ],
    ],
    ridges: [[[64, 12], [20, 12], [11, 22], [11, 38], [66, 54], [66, 80], [56, 89], [14, 89]]],
    veins: [[[78, 68], [68, 71]], [[0, 28], [10, 31]]],
  },
};

function polysToPath(polys, mapPt) {
  let d = '';
  for (const ring of polys) {
    for (let i = 0; i < ring.length; i++) {
      const [px, py] = mapPt(ring[i][0], ring[i][1]);
      d += `${i === 0 ? 'M' : 'L'} ${fmt(px)} ${fmt(py)} `;
    }
    d += 'Z ';
  }
  return d.trim();
}

function linesToPath(lines, mapPt) {
  let d = '';
  for (const seg of lines) {
    for (let i = 0; i < seg.length; i++) {
      const [px, py] = mapPt(seg[i][0], seg[i][1]);
      d += `${i === 0 ? 'M' : 'L'} ${fmt(px)} ${fmt(py)} `;
    }
  }
  return d.trim();
}

function renderChiseledWord({
  word,
  centerX,
  topY,
  sx,
  sy,
  gap,
  vpX,
  vpY,
  extrudeDepth,
  faceGradId,
  bevelGradId,
}) {
  const chars = word.split('').filter((c) => CHISELED_GLYPHS[c]);
  const totalRawW = chars.reduce((acc, c, idx) => acc + CHISELED_GLYPHS[c].w + (idx > 0 ? gap : 0), 0);
  const startX = centerX - (totalRawW * sx) * 0.5;

  const glyphPlacements = [];
  let cursor = 0;
  for (const ch of chars) {
    const g = CHISELED_GLYPHS[ch];
    glyphPlacements.push({ g, x0: startX + cursor * sx });
    cursor += g.w + gap;
  }

  const slices = 7;
  let extrudeMarkup = '';
  const extrudePalette = [
    '#041322', '#072036', '#0b2e4c', '#104166',
    '#165580', '#1e6d9c', '#2989b8',
  ];

  for (let s = slices; s >= 1; s--) {
    const t = s / slices;
    const col = extrudePalette[slices - s] || extrudePalette[0];
    let sliceD = '';
    for (const { g, x0 } of glyphPlacements) {
      sliceD +=
        polysToPath(g.polys, (gx, gy) => {
          const bx = x0 + gx * sx;
          const by = topY + gy * sy;
          const px = bx + (vpX - bx) * (0.044 * t);
          const py = by + (vpY - by) * (0.026 * t) + extrudeDepth * t;
          return [px, py];
        }) + ' ';
    }
    extrudeMarkup += `<path d="${sliceD.trim()}" fill="${col}" fill-rule="evenodd" stroke="${col}" stroke-width="1.3" stroke-linejoin="round"/>`;
  }

  let frontFacesD = '';
  let ridgesD = '';
  let ridgesShadowD = '';
  let veinsD = '';
  let veinsGlowD = '';

  for (const { g, x0 } of glyphPlacements) {
    const mapFront = (gx, gy) => [x0 + gx * sx, topY + gy * sy];
    const mapShadow = (gx, gy) => [x0 + gx * sx + 0.85, topY + gy * sy + 1.1];
    const mapVeinGlow = (gx, gy) => [x0 + gx * sx + 0.6, topY + gy * sy + 0.6];

    frontFacesD += polysToPath(g.polys, mapFront) + ' ';
    ridgesD += linesToPath(g.ridges, mapFront) + ' ';
    ridgesShadowD += linesToPath(g.ridges, mapShadow) + ' ';
    veinsD += linesToPath(g.veins || [], mapFront) + ' ';
    veinsGlowD += linesToPath(g.veins || [], mapVeinGlow) + ' ';
  }

  return `
    <g class="crest-word-3d">
      ${extrudeMarkup}
      <path d="${frontFacesD.trim()}" fill="url(#${faceGradId})" fill-rule="evenodd" stroke="url(#${bevelGradId})" stroke-width="2.25" stroke-linejoin="round"/>
      <path d="${frontFacesD.trim()}" fill="none" stroke="rgba(4,18,32,0.55)" stroke-width="0.8" stroke-linejoin="round"/>
      <path d="${ridgesShadowD.trim()}" fill="none" stroke="rgba(6,24,42,0.68)" stroke-width="1.55" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="${ridgesD.trim()}" fill="none" stroke="rgba(230,253,255,0.86)" stroke-width="1.15" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="${veinsGlowD.trim()}" fill="none" stroke="rgba(94,252,232,0.68)" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="${veinsD.trim()}" fill="none" stroke="#083344" stroke-width="0.95" stroke-linecap="round" stroke-linejoin="round"/>
    </g>
  `;
}

// ============================================================================
// 1. TITLE CREST EMBLEM — getTitleCrestSVG(biome = 'canyon_river')
// ============================================================================

export function getTitleCrestSVG(biome = 'canyon_river') {
  const uid = nextUid('tw-crest');
  const cx = 280;
  const cy = 96;

  const turbineOuter = buildTurbineWheelPath(cx, cy, 85, 79, 73, 53, 47, 24, 6, 7.5);
  const turbineInner = buildTurbineWheelPath(cx, cy, 61, 56.5, 51, 33, 27, 16, 4, 22.5);
  const astrolabeTicks = buildDegreeTicksPath(cx, cy, 65, 72, 48, 6, 0);
  const wingTurbineL = buildTurbineWheelPath(136, 82, 20, 17, 13.5, 7.5, 3.8, 10, 4, 14);
  const wingTurbineR = buildTurbineWheelPath(424, 82, 20, 17, 13.5, 7.5, 3.8, 10, 4, -14);
  const seedStar = buildStarBurstPath(280, 19, 13.5, 4.4, 8, 0);
  const seedInner = buildStarBurstPath(280, 19, 7.2, 2.6, 4, 45);

  const toweringWordSvg = renderChiseledWord({
    word: 'TOWERING',
    centerX: 280,
    topY: 38,
    sx: 0.43,
    sy: 0.37,
    gap: 10.5,
    vpX: 280,
    vpY: 184,
    extrudeDepth: 5.8,
    faceGradId: `${uid}-word-top`,
    bevelGradId: `${uid}-bevel`,
  });

  const watersWordSvg = renderChiseledWord({
    word: 'WATERS',
    centerX: 280,
    topY: 83,
    sx: 0.68,
    sy: 0.53,
    gap: 11.5,
    vpX: 280,
    vpY: 188,
    extrudeDepth: 8.2,
    faceGradId: `${uid}-word-bot`,
    bevelGradId: `${uid}-bevel`,
  });

  const accentAqua = '#5efce8';
  const accentGold = '#ffd875';
  const accentCoral = '#fb7185';

  return `
<svg class="title-crest-svg ui-crest-svg" viewBox="0 0 560 196" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Towering Waters: Gateway's Descent — Created by Matt Shaffer">
  <title>Towering Waters: Gateway's Descent</title>
  <defs>
    <radialGradient id="${uid}-aura" cx="50%" cy="48%" r="48%">
      <stop offset="0%" stop-color="#2dd4bf" stop-opacity="0.38"/>
      <stop offset="52%" stop-color="#0284c7" stop-opacity="0.18"/>
      <stop offset="100%" stop-color="#041222" stop-opacity="0"/>
    </radialGradient>

    <radialGradient id="${uid}-seed-glow" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#ffffff" stop-opacity="0.98"/>
      <stop offset="34%" stop-color="${accentAqua}" stop-opacity="0.82"/>
      <stop offset="72%" stop-color="#38bdf8" stop-opacity="0.28"/>
      <stop offset="100%" stop-color="#041222" stop-opacity="0"/>
    </radialGradient>

    <linearGradient id="${uid}-bronze" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#fff4c2"/>
      <stop offset="30%" stop-color="#f4c158"/>
      <stop offset="58%" stop-color="#b7791f"/>
      <stop offset="84%" stop-color="#e5a93c"/>
      <stop offset="100%" stop-color="#5c390e"/>
    </linearGradient>

    <linearGradient id="${uid}-frill-wing" x1="0%" y1="0%" x2="100%" y2="85%">
      <stop offset="0%" stop-color="#0d9488"/>
      <stop offset="48%" stop-color="#0e4f6e"/>
      <stop offset="82%" stop-color="#163252"/>
      <stop offset="100%" stop-color="#fb7185" stop-opacity="0.88"/>
    </linearGradient>

    <linearGradient id="${uid}-aqua" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#ffffff"/>
      <stop offset="45%" stop-color="${accentAqua}"/>
      <stop offset="100%" stop-color="#0284c7"/>
    </linearGradient>

    <linearGradient id="${uid}-spire-sil" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#38bdf8"/>
      <stop offset="42%" stop-color="#155e75"/>
      <stop offset="100%" stop-color="#082f49"/>
    </linearGradient>

    <linearGradient id="${uid}-word-top" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#ffffff"/>
      <stop offset="28%" stop-color="#d5f9ff"/>
      <stop offset="54%" stop-color="#5cc8e8"/>
      <stop offset="60%" stop-color="#1d5b79"/>
      <stop offset="86%" stop-color="#38a3c7"/>
      <stop offset="100%" stop-color="#99f6e4"/>
    </linearGradient>

    <linearGradient id="${uid}-word-bot" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#ffffff"/>
      <stop offset="22%" stop-color="#ccfbf1"/>
      <stop offset="48%" stop-color="#2dd4bf"/>
      <stop offset="53%" stop-color="#0f4c65"/>
      <stop offset="78%" stop-color="#0ea5e9"/>
      <stop offset="94%" stop-color="#67e8f9"/>
      <stop offset="100%" stop-color="#fef08a"/>
    </linearGradient>

    <linearGradient id="${uid}-bevel" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#ffffff"/>
      <stop offset="40%" stop-color="#99f6e4"/>
      <stop offset="72%" stop-color="#b7791f"/>
      <stop offset="100%" stop-color="${accentGold}"/>
    </linearGradient>

    <linearGradient id="${uid}-ribbon-bg" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#062238" stop-opacity="0.94"/>
      <stop offset="25%" stop-color="#0c3b59" stop-opacity="0.96"/>
      <stop offset="50%" stop-color="#0f4e70" stop-opacity="0.98"/>
      <stop offset="75%" stop-color="#0c3b59" stop-opacity="0.96"/>
      <stop offset="100%" stop-color="#062238" stop-opacity="0.94"/>
    </linearGradient>
  </defs>

  <ellipse cx="280" cy="94" rx="252" ry="86" fill="url(#${uid}-aura)"/>

  <!-- Rotating Hydro-Turbine & Harmonic Water-Seed Astrolabe Halo -->
  <g class="crest-astrolabe-spin">
    <circle cx="280" cy="96" r="88.5" fill="none" stroke="rgba(94,252,232,0.28)" stroke-width="1" stroke-dasharray="6 4"/>
    <path d="${turbineOuter}" fill="url(#${uid}-bronze)" fill-rule="evenodd" opacity="0.88" stroke="#062033" stroke-width="0.9"/>
    <circle cx="280" cy="96" r="75.5" fill="none" stroke="${accentAqua}" stroke-width="1.25" stroke-dasharray="14 5 3 5" opacity="0.88"/>
    <path d="${astrolabeTicks}" stroke="url(#${uid}-bronze)" stroke-width="1.1" stroke-linecap="round" opacity="0.86"/>
    <path d="${turbineInner}" fill="url(#${uid}-bronze)" fill-rule="evenodd" opacity="0.54"/>
  </g>

  <!-- Gateway's Iridescent Aquatic Head-Frill Filigree Wings & Water-Turbines -->
  <g class="crest-filigree-wings">
    <path d="${wingTurbineL}" fill="url(#${uid}-bronze)" fill-rule="evenodd" opacity="0.78" stroke="#051c2c" stroke-width="0.9"/>
    <path d="${wingTurbineR}" fill="url(#${uid}-bronze)" fill-rule="evenodd" opacity="0.78" stroke="#051c2c" stroke-width="0.9"/>

    <!-- Left Iridescent Hydro-Frill Wing -->
    <path d="M 192 68 C 146 40, 82 34, 16 50 C 44 58, 68 68, 86 79 C 46 74, 22 80, 10 92 C 42 94, 72 101, 98 111 C 64 111, 40 118, 26 129 C 76 128, 138 117, 190 101 Z"
          fill="url(#${uid}-frill-wing)" stroke="url(#${uid}-bronze)" stroke-width="1.75" stroke-linejoin="round"/>
    <path d="M 182 72 C 140 50, 86 45, 28 53 M 176 86 C 132 76, 78 76, 24 89 M 166 99 C 122 103, 78 111, 40 123"
          fill="none" stroke="${accentAqua}" stroke-width="1.3" stroke-linecap="round" opacity="0.86"/>
    <circle cx="52" cy="59" r="2.4" fill="${accentAqua}"/>
    <circle cx="38" cy="89" r="2.1" fill="${accentCoral}"/>
    <circle cx="68" cy="117" r="2" fill="${accentGold}"/>

    <!-- Right Iridescent Hydro-Frill Wing -->
    <path d="M 368 68 C 414 40, 478 34, 544 50 C 516 58, 492 68, 474 79 C 514 74, 538 80, 550 92 C 518 94, 488 101, 462 111 C 496 111, 520 118, 534 129 C 484 128, 422 117, 370 101 Z"
          fill="url(#${uid}-frill-wing)" stroke="url(#${uid}-bronze)" stroke-width="1.75" stroke-linejoin="round"/>
    <path d="M 378 72 C 420 50, 474 45, 532 53 M 384 86 C 428 76, 482 76, 536 89 M 394 99 C 438 103, 482 111, 520 123"
          fill="none" stroke="${accentAqua}" stroke-width="1.3" stroke-linecap="round" opacity="0.86"/>
    <circle cx="508" cy="59" r="2.4" fill="${accentAqua}"/>
    <circle cx="522" cy="89" r="2.1" fill="${accentCoral}"/>
    <circle cx="492" cy="117" r="2" fill="${accentGold}"/>
  </g>

  <!-- Central Tapered Hydro-Sanctum Spire Silhouette + Harmonic Water Seed Crown -->
  <g class="crest-hydro-spire">
    <path d="M 244 148 L 256 48 L 250 44 L 253 36 L 264 36 L 268 24 L 292 24 L 296 36 L 307 36 L 310 44 L 304 48 L 316 148 Z"
          fill="url(#${uid}-spire-sil)" stroke="url(#${uid}-bronze)" stroke-width="1.3" stroke-linejoin="round"/>
    <!-- Glowing Transparent Water Conduits Inside Spire -->
    <line x1="266" y1="36" x2="258" y2="144" stroke="${accentAqua}" stroke-width="2" opacity="0.85"/>
    <line x1="294" y1="36" x2="302" y2="144" stroke="${accentAqua}" stroke-width="2" opacity="0.85"/>
    <path d="M 275 42 A 5 5 0 0 1 285 42 L 285 54 L 275 54 Z" fill="#042438" stroke="${accentAqua}" stroke-width="1"/>
    <!-- Harmonic Water Droplet & Star Seed -->
    <circle cx="280" cy="19" r="21" fill="url(#${uid}-seed-glow)"/>
    <path d="M 280 3 C 272 13, 270 19, 270 23 A 10 10 0 0 0 290 23 C 290 19, 288 13, 280 3 Z" fill="url(#${uid}-aqua)" stroke="#ffffff" stroke-width="0.9"/>
    <path d="${seedStar}" fill="url(#${uid}-aqua)" opacity="0.85"/>
    <path d="${seedInner}" fill="#ffffff"/>
  </g>

  <!-- Sculpted 3D-Extruded Sea-Glass & Sunlit-Bronze Display Lettering -->
  ${toweringWordSvg}
  ${watersWordSvg}

  <!-- Lower Hydro-Glass & Sunlit-Bronze Scroll Ribbon -->
  <g class="crest-scroll-ribbon">
    <polygon points="74,155 112,151 112,181 74,185 87,170" fill="#072a42" stroke="url(#${uid}-bronze)" stroke-width="1.5" stroke-linejoin="round"/>
    <polygon points="486,155 448,151 448,181 486,185 473,170" fill="#072a42" stroke="url(#${uid}-bronze)" stroke-width="1.5" stroke-linejoin="round"/>
    <polygon points="112,147 448,147 460,164 448,181 112,181 100,164"
             fill="url(#${uid}-ribbon-bg)" stroke="url(#${uid}-bronze)" stroke-width="2.1" stroke-linejoin="round"/>
    <polygon points="116,150.5 444,150.5 453.5,164 444,177.5 116,177.5 106.5,164"
             fill="none" stroke="${accentAqua}" stroke-width="0.85" stroke-opacity="0.65"/>

    <circle cx="122" cy="164" r="2.4" fill="${accentAqua}"/>
    <circle cx="438" cy="164" r="2.4" fill="${accentAqua}"/>

    <text x="280" y="162.5" text-anchor="middle"
          font-family="'Cinzel', 'Orbitron', 'Outfit', sans-serif" font-size="11.8" font-weight="800"
          letter-spacing="3.2" fill="#ffffff"
          stroke="#041829" stroke-width="2.2" paint-order="stroke fill">GATEWAY'S DESCENT</text>
    <text x="280" y="174.2" text-anchor="middle"
          font-family="'Outfit', 'Rajdhani', sans-serif" font-size="8.4" font-weight="700"
          letter-spacing="2.4" fill="${accentGold}">CREATED BY MATT SHAFFER</text>
  </g>
</svg>`.trim();
}

// ============================================================================
// 2. HERO PLAY MEDALLION FRAME — getPlayMedallionSVG(modeId = 'campaign')
// ============================================================================

export function getPlayMedallionSVG(modeId = 'campaign') {
  const uid = nextUid('tw-playmed');
  const aqua = modeId === 'purist' ? '#ffd875' : modeId === 'flood_rush' ? '#fb7185' : '#5efce8';
  const gold = '#f6c453';

  const wheelL = buildTurbineWheelPath(46, 55, 32, 28, 23.5, 12.5, 6.8, 12, 5, 12);
  const wheelLSmall = buildTurbineWheelPath(78, 25, 13, 10.6, 8.2, 4.8, 2.4, 8, 0, 20);
  const wheelR = buildTurbineWheelPath(334, 55, 32, 28, 23.5, 12.5, 6.8, 12, 5, -12);
  const wheelRSmall = buildTurbineWheelPath(302, 25, 13, 10.6, 8.2, 4.8, 2.4, 8, 0, -20);
  const centerTicks = buildDegreeTicksPath(190, 55, 42, 47, 36, 3, 0);

  return `
<svg class="play-medallion-svg" viewBox="0 0 380 110" preserveAspectRatio="none" style="position:absolute;inset:0;width:100%;height:100%;z-index:-1;pointer-events:none;" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <defs>
    <linearGradient id="${uid}-bronze" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#fff4c2"/>
      <stop offset="30%" stop-color="#eab308"/>
      <stop offset="60%" stop-color="#854d0e"/>
      <stop offset="85%" stop-color="#f59e0b"/>
      <stop offset="100%" stop-color="#451a03"/>
    </linearGradient>

    <linearGradient id="${uid}-glass" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#0e4a68" stop-opacity="0.92"/>
      <stop offset="50%" stop-color="#082c44" stop-opacity="0.95"/>
      <stop offset="100%" stop-color="#062034" stop-opacity="0.97"/>
    </linearGradient>

    <radialGradient id="${uid}-glow" cx="50%" cy="50%" r="55%">
      <stop offset="0%" stop-color="${aqua}" stop-opacity="0.30"/>
      <stop offset="65%" stop-color="#0ea5e9" stop-opacity="0.12"/>
      <stop offset="100%" stop-color="#041524" stop-opacity="0"/>
    </radialGradient>
  </defs>

  <polygon points="34,6 346,6 374,55 346,104 34,104 6,55"
           fill="#051c2e" stroke="url(#${uid}-bronze)" stroke-width="2.8" stroke-linejoin="round"/>
  <polygon points="38,11 342,11 367,55 342,99 38,99 13,55"
           fill="url(#${uid}-glass)" stroke="${aqua}" stroke-width="1.25" stroke-opacity="0.78" stroke-linejoin="round"/>
  <ellipse cx="190" cy="55" rx="152" ry="42" fill="url(#${uid}-glow)"/>

  <g opacity="0.38">
    <path d="${centerTicks}" stroke="${gold}" stroke-width="1" stroke-linecap="round"/>
    <path d="M 78 55 L 122 55 M 258 55 L 302 55" stroke="${aqua}" stroke-width="1.1" stroke-dasharray="4 3"/>
    <circle cx="190" cy="55" r="40" fill="none" stroke="${aqua}" stroke-width="0.9" stroke-dasharray="10 5"/>
  </g>

  <g transform="translate(46,55) scale(0.78,1) translate(-46,-55)">
    <path d="${wheelLSmall}" fill="url(#${uid}-bronze)" fill-rule="evenodd" opacity="0.74" stroke="#051826" stroke-width="0.8"/>
    <path d="${wheelL}" fill="url(#${uid}-bronze)" fill-rule="evenodd" stroke="#051826" stroke-width="1.1"/>
    <circle cx="46" cy="55" r="5.4" fill="${aqua}" stroke="#ffffff" stroke-width="0.9"/>
    <polygon points="82,55 69,49.5 72,55 69,60.5" fill="${gold}"/>
  </g>
  <g transform="translate(334,55) scale(0.78,1) translate(-334,-55)">
    <path d="${wheelRSmall}" fill="url(#${uid}-bronze)" fill-rule="evenodd" opacity="0.74" stroke="#051826" stroke-width="0.8"/>
    <path d="${wheelR}" fill="url(#${uid}-bronze)" fill-rule="evenodd" stroke="#051826" stroke-width="1.1"/>
    <circle cx="334" cy="55" r="5.4" fill="${aqua}" stroke="#ffffff" stroke-width="0.9"/>
    <polygon points="298,55 311,49.5 308,55 311,60.5" fill="${gold}"/>
  </g>

  <polygon points="190,2 197,9 190,15 183,9" fill="${aqua}" stroke="url(#${uid}-bronze)" stroke-width="1.2"/>
  <polygon points="190,95 197,101 190,108 183,101" fill="${gold}" stroke="url(#${uid}-bronze)" stroke-width="1.2"/>
</svg>`.trim();
}

// ============================================================================
// 3. 6 DISTINCT GAME MODES ARTWORK — getGameModeArtSVG(modeId)
//    (Also exported as getExpeditionArtSVG for full backward compatibility)
// ============================================================================

export function getGameModeArtSVG(modeId = 'campaign') {
  const raw = String(modeId || 'campaign').toLowerCase();
  let kind = 'campaign';
  if (raw.includes('gauntlet') || raw.includes('warden') || raw.includes('boss')) kind = 'warden_gauntlet';
  else if (raw.includes('master')) kind = 'master_watershed';
  else if (raw.includes('purist') || raw.includes('arcade')) kind = 'purist';
  else if (raw.includes('flood') || raw.includes('rush') || raw.includes('survival')) kind = 'flood_rush';
  else if (raw.includes('sanctum') || raw.includes('trial') || raw.includes('puzzle') || raw.includes('casual')) kind = 'sanctum_trials';
  else if (raw.includes('expedition') || raw.includes('endless') || raw.includes('rogue')) kind = 'expedition';
  else if (raw.includes('daily') || raw.includes('tide')) kind = 'daily_tide';

  const uid = nextUid(`mode-${kind}`);
  let skyStops = '';
  let focalColor = '#5efce8';
  let sceneBody = '';

  if (kind === 'campaign') {
    focalColor = '#5efce8';
    skyStops = `
      <stop offset="0%" stop-color="#0ea5e9"/>
      <stop offset="48%" stop-color="#38bdf8"/>
      <stop offset="100%" stop-color="#fde68a"/>
    `;
    sceneBody = `
      <!-- Warm Golden Morning Sun & Canyon God-Rays -->
      <circle cx="158" cy="52" r="42" fill="#fef08a" opacity="0.48"/>
      <circle cx="158" cy="52" r="20" fill="#fffbeb"/>
      <polygon points="158,52 24,150 86,150" fill="#fef9c3" opacity="0.18"/>
      <!-- Red-Rock Sandstone Canyon Cliffs & Redwood Pines -->
      <polygon points="0,175 0,78 46,92 64,132 76,175" fill="#9a3412"/>
      <polygon points="220,175 220,72 172,88 154,130 142,175" fill="#7c2d12"/>
      <path d="M 18 90 V 170 M 196 86 V 170" stroke="#e0f2fe" stroke-width="4" stroke-linecap="round" opacity="0.85"/>
      <!-- Tapered Copper & Sandstone Hydro-Spire with Flowing Water Conduits -->
      <path d="M 80 182 L 90 58 L 130 58 L 140 182 Z" fill="url(#${uid}-spire)" stroke="#451a03" stroke-width="1.3"/>
      <line x1="98" y1="62" x2="92" y2="176" stroke="#5efce8" stroke-width="2.4"/>
      <line x1="122" y1="62" x2="128" y2="176" stroke="#5efce8" stroke-width="2.4"/>
      <!-- Gateway Silhouette Leaping with S-Curved Lizard Tail & Flared Frills -->
      <path d="M 62 118 C 46 126, 40 112, 52 106" fill="none" stroke="#2dd4bf" stroke-width="3.2" stroke-linecap="round"/>
      <ellipse cx="68" cy="112" rx="7" ry="4.5" transform="rotate(-22 68 112)" fill="#5efce8"/>
      <circle cx="75" cy="107" r="4" fill="#99f6e4"/>
      <!-- Rushing Emerald-Turquoise Whitewater River -->
      <path d="M 0 166 Q 55 154 110 166 T 220 164 L 220 250 L 0 250 Z" fill="#0d9488"/>
      <path d="M 10 176 Q 60 166 110 176 T 210 174" fill="none" stroke="#ccfbf1" stroke-width="2.4" stroke-linecap="round"/>
    `;
  } else if (kind === 'purist') {
    focalColor = '#fbbf24';
    const dialGear = buildTurbineWheelPath(110, 74, 50, 45, 39, 25, 19, 20, 4, 9);
    const dialTicks = buildDegreeTicksPath(110, 74, 53, 60, 24, 0, 0);
    skyStops = `
      <stop offset="0%" stop-color="#1e1b4b"/>
      <stop offset="52%" stop-color="#7c2d12"/>
      <stop offset="100%" stop-color="#f59e0b"/>
    `;
    sceneBody = `
      <circle cx="110" cy="74" r="62" fill="url(#${uid}-focal-glow)"/>
      <path d="${dialTicks}" stroke="#fde047" stroke-width="1.4" stroke-linecap="round"/>
      <path d="${dialGear}" fill="url(#${uid}-bronze)" fill-rule="evenodd" opacity="0.88" stroke="#451a03" stroke-width="0.9"/>
      <!-- High-Stakes Chronometer Hands -->
      <circle cx="110" cy="74" r="20" fill="#091526" stroke="#fde047" stroke-width="1.5"/>
      <polyline points="110,60 110,74 121,80" fill="none" stroke="#5efce8" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>
      <!-- Steep Gauntlet Spire with Real Multi-Riser Stair Flights -->
      <path d="M 82 186 L 92 78 L 128 78 L 138 186 Z" fill="url(#${uid}-spire)" stroke="#451a03" stroke-width="1.4"/>
      <polyline points="72,152 82,146 92,140 102,134 112,128 122,122" fill="none" stroke="#fde047" stroke-width="3" stroke-linecap="round"/>
      <polyline points="146,114 134,108 122,102 110,96 98,90" fill="none" stroke="#5efce8" stroke-width="3" stroke-linecap="round"/>
      <path d="M 0 170 Q 55 160 110 170 T 220 168 L 220 250 L 0 250 Z" fill="#0c4a6e"/>
    `;
  } else if (kind === 'flood_rush') {
    focalColor = '#fb7185';
    skyStops = `
      <stop offset="0%" stop-color="#0f172a"/>
      <stop offset="50%" stop-color="#4c1d95"/>
      <stop offset="100%" stop-color="#be123c"/>
    `;
    sceneBody = `
      <circle cx="110" cy="64" r="58" fill="url(#${uid}-focal-glow)"/>
      <polyline points="48,14 64,42 54,47 74,80" fill="none" stroke="#fda4af" stroke-width="2" stroke-linecap="round"/>
      <polyline points="174,18 158,44 168,49 148,82" fill="none" stroke="#67e8f9" stroke-width="2" stroke-linecap="round"/>
      <!-- Tall Escape Spire + Updraft Geyser Plumes + Grapple Ring -->
      <path d="M 84 180 L 94 46 L 126 46 L 136 180 Z" fill="url(#${uid}-spire)" stroke="#1e1b4b" stroke-width="1.4"/>
      <circle cx="66" cy="78" r="9" fill="none" stroke="#fde047" stroke-width="2.2"/>
      <path d="M 74 96 Q 66 84 66 78" fill="none" stroke="#5efce8" stroke-width="2" stroke-dasharray="3 2"/>
      <path d="M 52 162 C 50 128, 56 108, 60 94" fill="none" stroke="#99f6e4" stroke-width="4" stroke-linecap="round" opacity="0.8"/>
      <!-- Towering Rising Corrupted Surge Waves -->
      <path d="M 0 144 Q 36 122 72 142 T 148 138 T 220 140 L 220 250 L 0 250 Z" fill="#881337" opacity="0.92"/>
      <path d="M 0 144 Q 36 122 72 142 T 148 138 T 220 140" fill="none" stroke="#fda4af" stroke-width="3" stroke-linecap="round"/>
      <path d="M 0 162 Q 55 148 110 162 T 220 160 L 220 250 L 0 250 Z" fill="#4c0519"/>
    `;
  } else if (kind === 'sanctum_trials') {
    focalColor = '#34d399';
    const valveWheel = buildTurbineWheelPath(110, 118, 22, 19, 15, 7, 3.5, 8, 4, 0);
    skyStops = `
      <stop offset="0%" stop-color="#064e3b"/>
      <stop offset="52%" stop-color="#0f766e"/>
      <stop offset="100%" stop-color="#5eead4"/>
    `;
    sceneBody = `
      <circle cx="110" cy="70" r="56" fill="url(#${uid}-focal-glow)"/>
      <!-- Ancient Carved Aqueduct Arches & Flowing Water Channels -->
      <path d="M 16 112 H 204 V 176 H 176 V 134 A 18 18 0 0 0 140 134 V 176 H 80 V 134 A 18 18 0 0 0 44 134 V 176 H 16 Z"
            fill="#134e4a" stroke="#99f6e4" stroke-width="1.2"/>
      <!-- Refracting Crystal Prism Beam -->
      <polygon points="110,32 126,56 110,80 94,56" fill="#a7f3d0" stroke="#ffffff" stroke-width="1.3"/>
      <polyline points="38,76 110,56 182,76" fill="none" stroke="#fef08a" stroke-width="2.4" stroke-linecap="round"/>
      <!-- Central Brass Rotary Pipe-Valve -->
      <path d="${valveWheel}" fill="url(#${uid}-bronze)" fill-rule="evenodd" stroke="#042f2e" stroke-width="1"/>
      <circle cx="110" cy="118" r="5" fill="#5efce8"/>
      <path d="M 0 168 Q 55 160 110 168 T 220 168 L 220 250 L 0 250 Z" fill="#065f46"/>
    `;
  } else if (kind === 'expedition') {
    focalColor = '#38bdf8';
    const evoStar = buildStarBurstPath(110, 64, 17, 5, 6, 0);
    skyStops = `
      <stop offset="0%" stop-color="#082f49"/>
      <stop offset="48%" stop-color="#0369a1"/>
      <stop offset="100%" stop-color="#2dd4bf"/>
    `;
    sceneBody = `
      <circle cx="110" cy="64" r="60" fill="url(#${uid}-focal-glow)"/>
      <!-- Bio-Mutation Double Helix & Iridescent Frill Halo -->
      <path d="M 68 38 C 92 38, 128 90, 152 90 M 68 90 C 92 90, 128 38, 152 38"
            fill="none" stroke="#5efce8" stroke-width="3" stroke-linecap="round"/>
      <path d="M 82 48 V 80 M 110 54 V 74 M 138 48 V 80" stroke="#fde047" stroke-width="1.8" stroke-linecap="round"/>
      <path d="${evoStar}" fill="#99f6e4" stroke="#ffffff" stroke-width="0.9"/>
      <!-- Multi-Biome Horizon Spires (Canyon, Alpine, Coral) -->
      <polygon points="34,174 42,108 62,108 70,174" fill="#9a3412" opacity="0.86"/>
      <polygon points="150,174 158,104 178,104 186,174" fill="#0284c7" opacity="0.86"/>
      <path d="M 84 182 L 94 86 L 126 86 L 136 182 Z" fill="url(#${uid}-spire)" stroke="#082f49" stroke-width="1.3"/>
      <path d="M 0 168 Q 55 156 110 168 T 220 166 L 220 250 L 0 250 Z" fill="#0e7490"/>
    `;
  } else {
    focalColor = '#67e8f9';
    const sunGear = buildTurbineWheelPath(110, 68, 46, 41, 36, 22, 16, 18, 6, 10);
    skyStops = `
      <stop offset="0%" stop-color="#0c4a6e"/>
      <stop offset="50%" stop-color="#0284c7"/>
      <stop offset="100%" stop-color="#38bdf8"/>
    `;
    sceneBody = `
      <circle cx="110" cy="68" r="58" fill="url(#${uid}-focal-glow)"/>
      <path d="${sunGear}" fill="url(#${uid}-bronze)" fill-rule="evenodd" opacity="0.84" stroke="#082f49" stroke-width="0.9"/>
      <circle cx="110" cy="68" r="16" fill="#fef9c3"/>
      <!-- Sunlit Coral Sea Arch & Daily Tide Spire -->
      <path d="M 28 172 C 34 118, 72 114, 78 172" fill="none" stroke="#fed7aa" stroke-width="8" stroke-linecap="round"/>
      <path d="M 84 182 L 93 74 L 127 74 L 136 182 Z" fill="url(#${uid}-spire)" stroke="#082f49" stroke-width="1.3"/>
      <path d="M 0 166 Q 55 154 110 166 T 220 164 L 220 250 L 0 250 Z" fill="#0891b2"/>
      <path d="M 14 178 Q 65 168 116 178 T 208 176" fill="none" stroke="#cffafe" stroke-width="2"/>
    `;
  }

  const modePlateMap = {
    campaign: './assets/textures/story_keyframe_prologue.webp',
    purist: './assets/textures/story_keyframe_act2.webp',
    flood_rush: './assets/textures/story_keyframe_finale.webp',
    sanctum_trials: './assets/textures/story_keyframe_act3.webp',
    expedition: './assets/textures/story_portrait_gateway.webp',
    daily_tide: './assets/textures/story_keyframe_purification.webp',
    warden_gauntlet: './assets/textures/story_portrait_warden.webp',
    master_watershed: './assets/textures/story_keyframe_act4.webp',
  };
  const plateHref = modePlateMap[kind] || modePlateMap.campaign;

  return `
<svg class="spire-art-bg spire-art-${kind}" viewBox="0 0 220 250" preserveAspectRatio="xMidYMid slice" style="position:absolute;inset:1.6px;width:calc(100% - 3.2px);height:calc(100% - 3.2px);z-index:1;clip-path:var(--poly-spire-arch,none);pointer-events:none;" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <defs>
    <linearGradient id="${uid}-sky" x1="0%" y1="0%" x2="0%" y2="100%">
      ${skyStops}
    </linearGradient>
    <radialGradient id="${uid}-focal-glow" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="${focalColor}" stop-opacity="0.58"/>
      <stop offset="60%" stop-color="#38bdf8" stop-opacity="0.18"/>
      <stop offset="100%" stop-color="#041524" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="${uid}-spire" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#38bdf8"/>
      <stop offset="45%" stop-color="#155e75"/>
      <stop offset="100%" stop-color="#083344"/>
    </linearGradient>
    <linearGradient id="${uid}-bronze" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#fef08a"/>
      <stop offset="48%" stop-color="#eab308"/>
      <stop offset="100%" stop-color="#78350f"/>
    </linearGradient>
    <linearGradient id="${uid}-veil" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#041828" stop-opacity="0"/>
      <stop offset="56%" stop-color="#041828" stop-opacity="0.22"/>
      <stop offset="80%" stop-color="#041828" stop-opacity="0.82"/>
      <stop offset="100%" stop-color="#03111d" stop-opacity="0.95"/>
    </linearGradient>
  </defs>

  <rect width="220" height="250" fill="url(#${uid}-sky)"/>
  <g opacity="0.46">${sceneBody}</g>
  <image href="${plateHref}" x="0" y="0" width="220" height="218" preserveAspectRatio="xMidYMid slice" opacity="0.72"/>
  <rect width="220" height="250" fill="url(#${uid}-veil)"/>
  <path d="M 7 243 L 7 88 Q 7 24 110 7 Q 213 24 213 88 L 213 243 Z"
        fill="none" stroke="url(#${uid}-bronze)" stroke-width="1.9" opacity="0.84"/>
</svg>`.trim();
}

export const getExpeditionArtSVG = getGameModeArtSVG;

// ============================================================================
// 4. 5 GATEWAY-STARRING MINI-GAME PORTAL VIGNETTES — getMinigamePortalSVG(gameId)
//    (ZERO submarines, ZERO hang-gliders — 100% Gateway!)
// ============================================================================

export function getMinigamePortalSVG(gameId = 'core_descent') {
  const raw = String(gameId || 'core_descent').toLowerCase();
  const id = raw.includes('core') || raw.includes('descent')
    ? 'core_descent'
    : raw.includes('reef') || raw.includes('swim') || raw.includes('sub')
    ? 'reef_swim'
    : raw.includes('rapid') || raw.includes('surf') || raw.includes('skim')
    ? 'rapids_surf'
    : raw.includes('frill') || raw.includes('glide')
    ? 'frill_glide'
    : 'aqueduct_sanctum';

  const uid = nextUid(`mg-${id}`);
  let bgTop = '#06324d';
  let bgBot = '#0d9488';
  let focalHue = '#5efce8';
  let scene = '';

  if (id === 'core_descent') {
    bgTop = '#062038';
    bgBot = '#0e7490';
    focalHue = '#5efce8';
    const bladeWheel = buildTurbineWheelPath(262, 66, 48, 42, 36, 18, 12, 8, 4, 18);
    scene = `
      <!-- Flooded Central Glass-and-Bronze Reactor Shaft -->
      <line x1="88" y1="0" x2="118" y2="132" stroke="#5efce8" stroke-width="2.2" opacity="0.55"/>
      <line x1="358" y1="0" x2="328" y2="132" stroke="#5efce8" stroke-width="2.2" opacity="0.55"/>
      <circle cx="262" cy="66" r="56" fill="url(#${uid}-focal)"/>
      <path d="${bladeWheel}" fill="url(#${uid}-bronze)" fill-rule="evenodd" opacity="0.82" stroke="#041b2d" stroke-width="1"/>
      <!-- Siphon Crystal Lock Shattering -->
      <polygon points="262,48 276,66 262,84 248,66" fill="#fb7185" stroke="#ffffff" stroke-width="1.2"/>
      <!-- Gateway Diving Headfirst with Flowing Lizard Tail & Bioluminescent Bubbles -->
      <g transform="translate(182, 54) rotate(28)">
        <path d="M -54 -6 C -34 -18, -18 8, 0 0" fill="none" stroke="#2dd4bf" stroke-width="5" stroke-linecap="round"/>
        <ellipse cx="14" cy="0" rx="16" ry="7.5" fill="#14b8a6" stroke="#99f6e4" stroke-width="1.2"/>
        <path d="M 22 -6 L 10 -17 L 18 -4 M 22 6 L 10 17 L 18 4" fill="#fb7185" stroke="#fde047" stroke-width="0.9"/>
        <ellipse cx="31" cy="0" rx="7.5" ry="5.2" fill="#5efce8"/>
        <circle cx="34" cy="-1.6" r="1.8" fill="#fef08a"/>
      </g>
      <circle cx="136" cy="30" r="4" fill="none" stroke="#a5f3fc" stroke-width="1.2"/>
      <circle cx="152" cy="22" r="2.6" fill="none" stroke="#a5f3fc" stroke-width="1.1"/>
    `;
  } else if (id === 'reef_swim') {
    bgTop = '#0284c7';
    bgBot = '#0f766e';
    focalHue = '#99f6e4';
    scene = `
      <!-- Sunlit Tropical Caustic Light Shafts -->
      <polygon points="110,0 165,0 215,132 138,132" fill="#e0f2fe" opacity="0.18"/>
      <polygon points="235,0 288,0 342,132 268,132" fill="#99f6e4" opacity="0.16"/>
      <!-- Lush Staghorn Coral Shelf & Freed Sea Turtle -->
      <path d="M 60 132 Q 160 104 260 116 T 380 108 L 380 132 Z" fill="#064e3b"/>
      <path d="M 292 124 C 292 102, 278 92, 272 80 M 292 114 C 302 100, 310 92, 314 82" fill="none" stroke="#fb7185" stroke-width="4" stroke-linecap="round"/>
      <ellipse cx="326" cy="56" rx="12" ry="8" fill="#34d399" stroke="#fef08a" stroke-width="1.1"/>
      <path d="M 322 48 L 314 38 L 328 49 M 322 64 L 314 74 L 328 63" fill="#10b981"/>
      <!-- Gateway Free-Swimming Directly Underwater (Undulating Lizard Spine & Tail!) -->
      <g transform="translate(196, 66)">
        <path d="M -68 4 C -46 -14, -24 16, -2 2" fill="none" stroke="#2dd4bf" stroke-width="5.5" stroke-linecap="round"/>
        <ellipse cx="16" cy="0" rx="18" ry="8" fill="#0d9488" stroke="#5efce8" stroke-width="1.3"/>
        <path d="M 26 -6 L 12 -19 L 22 -3 M 26 6 L 12 19 L 22 3" fill="#5efce8" opacity="0.88"/>
        <ellipse cx="35" cy="-1" rx="8.5" ry="5.8" fill="#5efce8"/>
        <circle cx="38" cy="-2.2" r="2" fill="#fde047"/>
        <circle cx="54" cy="0" r="12" fill="none" stroke="#99f6e4" stroke-width="1.6" stroke-dasharray="5 3"/>
      </g>
    `;
  } else if (id === 'rapids_surf') {
    bgTop = '#0ea5e9';
    bgBot = '#0d9488';
    focalHue = '#fef08a';
    const boostGate = buildTurbineWheelPath(302, 64, 38, 33, 28, 24, 23, 16, 0, 8);
    scene = `
      <!-- Canyon Gorge Walls & Roaring Whitewater Rapids -->
      <polygon points="68,94 86,26 128,42 144,94" fill="#9a3412" opacity="0.85"/>
      <path d="M 98 34 V 92" stroke="#e0f2fe" stroke-width="3.5" stroke-linecap="round"/>
      <circle cx="302" cy="64" r="46" fill="url(#${uid}-focal)"/>
      <path d="${boostGate}" fill="url(#${uid}-bronze)" fill-rule="evenodd" stroke="#082f49" stroke-width="1"/>
      <circle cx="302" cy="64" r="23" fill="rgba(94,252,232,0.22)" stroke="#5efce8" stroke-width="2" stroke-dasharray="7 4"/>
      <!-- Gateway Tail-Surfing Crystalline Hydro-Wake -->
      <path d="M 76 112 Q 142 82 212 88 L 224 106 Q 150 116 84 128 Z" fill="url(#${uid}-beam)"/>
      <path d="M 88 104 C 124 80, 162 78, 198 86" fill="none" stroke="#ffffff" stroke-width="3.2" stroke-linecap="round"/>
      <g transform="translate(206, 78) rotate(-12)">
        <path d="M -42 8 C -26 -8, -12 12, 2 4" fill="none" stroke="#2dd4bf" stroke-width="5" stroke-linecap="round"/>
        <ellipse cx="14" cy="-2" rx="13" ry="7" fill="#14b8a6" stroke="#99f6e4" stroke-width="1.2"/>
        <circle cx="24" cy="-8" r="6" fill="#5efce8"/>
        <path d="M 22 -12 L 10 -22 L 18 -10" fill="#fb7185"/>
      </g>
    `;
  } else if (id === 'frill_glide') {
    bgTop = '#38bdf8';
    bgBot = '#f59e0b';
    focalHue = '#fef9c3';
    scene = `
      <!-- Golden-Hour Canyon Sun, Rainbow Mist & Thermal Updraft Rings -->
      <circle cx="318" cy="40" r="38" fill="url(#${uid}-focal)"/>
      <circle cx="318" cy="40" r="18" fill="#fffbeb"/>
      <path d="M 196 124 A 68 68 0 0 1 324 124" fill="none" stroke="#5efce8" stroke-width="3" opacity="0.45"/>
      <path d="M 204 124 A 60 60 0 0 1 316 124" fill="none" stroke="#fde047" stroke-width="3" opacity="0.45"/>
      <ellipse cx="268" cy="58" rx="14" ry="24" fill="none" stroke="#fde047" stroke-width="2.4" stroke-dasharray="6 3"/>
      <!-- Gateway Gliding with Wide Flared Iridescent Neck/Rib Frills & Streaming Water Ribbons! -->
      <path d="M 84 68 Q 132 48 182 56 M 92 84 Q 140 72 186 68" fill="none" stroke="#99f6e4" stroke-width="2.4" stroke-linecap="round"/>
      <g transform="translate(196, 58) rotate(-8)">
        <polygon points="-8,-4 16,-28 34,-6" fill="#2dd4bf" stroke="#fde047" stroke-width="1.2"/>
        <polygon points="-8,4 16,28 34,6" fill="#fb7185" stroke="#fde047" stroke-width="1.2"/>
        <path d="M -52 2 C -32 -8, -16 10, 0 0" fill="none" stroke="#5efce8" stroke-width="4.5" stroke-linecap="round"/>
        <ellipse cx="14" cy="0" rx="16" ry="6.5" fill="#0d9488" stroke="#ffffff" stroke-width="1"/>
        <circle cx="31" cy="0" r="5.5" fill="#5efce8"/>
      </g>
    `;
  } else {
    bgTop = '#0f4c65';
    bgBot = '#115e59';
    focalHue = '#5efce8';
    const valveGear = buildTurbineWheelPath(192, 54, 28, 24, 19, 10, 5, 12, 4, 15);
    scene = `
      <!-- Sunlit Temple Aqueduct Troughs, Rotary Pipe-Valves & Prism Mirrors -->
      <rect x="76" y="94" width="290" height="38" fill="#064e3b"/>
      <path d="M 86 98 H 356" stroke="#5efce8" stroke-width="3" opacity="0.78"/>
      <circle cx="192" cy="54" r="44" fill="url(#${uid}-focal)"/>
      <path d="${valveGear}" fill="url(#${uid}-bronze)" fill-rule="evenodd" stroke="#042f2e" stroke-width="1"/>
      <polyline points="118,82 192,54 276,80 318,46" fill="none" stroke="#5efce8" stroke-width="3.5" stroke-linecap="round"/>
      <polyline points="118,82 192,54 276,80 318,46" fill="none" stroke="#ffffff" stroke-width="1.4" stroke-linecap="round"/>
      <polygon points="318,32 328,46 318,60 308,46" fill="#fef08a" stroke="#ffffff" stroke-width="1.1"/>
    `;
  }

  return `
<svg class="portal-art-bg portal-art-${id}" viewBox="0 0 380 132" preserveAspectRatio="xMidYMid slice" style="position:absolute;inset:1.8px;width:calc(100% - 3.6px);height:calc(100% - 3.6px);z-index:1;clip-path:var(--poly-portal-arch,none);pointer-events:none;" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <defs>
    <linearGradient id="${uid}-bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${bgTop}"/>
      <stop offset="100%" stop-color="${bgBot}"/>
    </linearGradient>
    <radialGradient id="${uid}-focal" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="${focalHue}" stop-opacity="0.54"/>
      <stop offset="100%" stop-color="#041524" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="${uid}-beam" x1="0%" y1="50%" x2="100%" y2="50%">
      <stop offset="0%" stop-color="#99f6e4" stop-opacity="0.62"/>
      <stop offset="60%" stop-color="#38bdf8" stop-opacity="0.22"/>
      <stop offset="100%" stop-color="#38bdf8" stop-opacity="0"/>
    </linearGradient>
    <linearGradient id="${uid}-bronze" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#fef08a"/>
      <stop offset="48%" stop-color="#eab308"/>
      <stop offset="100%" stop-color="#78350f"/>
    </linearGradient>
  </defs>
  <rect width="380" height="132" fill="url(#${uid}-bg)"/>
  ${scene}
</svg>`.trim();
}

// ============================================================================
// 5. EXPRESSIVE STORY CUTSCENE PORTRAITS — getCutscenePortraitSVG(speaker, mood)
// ============================================================================

const PORTRAIT_SVG_CACHE = Object.create(null);

export function getCutscenePortraitSVG(speaker = 'gateway') {
  const raw = String(speaker || 'gateway').toLowerCase();
  const key = raw.includes('naiad')
    ? 'naiad'
    : raw.includes('guardian')
    ? 'guardian'
    : raw.includes('warden')
    ? 'warden'
    : 'gateway';
  if (PORTRAIT_SVG_CACHE[key]) return PORTRAIT_SVG_CACHE[key];

  const clipId = `tw-port-hex-${key}`;
  const rimPalette = {
    gateway: { stroke: '#5efce8', inner: '#fde047', bg: '#083344' },
    naiad: { stroke: '#7dd3fc', inner: '#e0f2fe', bg: '#082f49' },
    guardian: { stroke: '#fde047', inner: '#6ee7b7', bg: '#064e3b' },
    warden: { stroke: '#fb7185', inner: '#fda4af', bg: '#2e1065' },
  }[key];

  const markup = `
    <svg viewBox="0 0 128 128" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <defs>
        <clipPath id="${clipId}">
          <polygon points="32,6 96,6 124,64 96,122 32,122 4,64"/>
        </clipPath>
      </defs>
      <polygon points="32,6 96,6 124,64 96,122 32,122 4,64" fill="${rimPalette.bg}"/>
      <image href="./assets/textures/story_portrait_${key}.webp" x="2" y="2" width="124" height="124" preserveAspectRatio="xMidYMid slice" clip-path="url(#${clipId})"/>
      <polygon points="32,6 96,6 124,64 96,122 32,122 4,64" fill="none" stroke="${rimPalette.stroke}" stroke-width="4" stroke-linejoin="round"/>
      <polygon points="36,12 92,12 117,64 92,116 36,116 11,64" fill="none" stroke="${rimPalette.inner}" stroke-width="1.5" opacity="0.74" stroke-linejoin="round"/>
    </svg>`.trim();
  PORTRAIT_SVG_CACHE[key] = markup;
  return markup;
}

// ============================================================================
// 6. BIO-MUTATION EVOLUTION ICONS — getMutationIconSVG(mutationId)
// ============================================================================

export function getMutationIconSVG(mutationId = 'triple_whip') {
  const id = String(mutationId || '').toLowerCase();
  if (id.includes('whip') || id.includes('tail')) {
    return `<svg viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="20" r="17" fill="rgba(45,212,191,0.18)" stroke="#5efce8" stroke-width="1.5"/><path d="M 8 24 C 14 10, 26 30, 32 14" fill="none" stroke="#fde047" stroke-width="3" stroke-linecap="round"/><path d="M 10 29 C 18 16, 26 24, 34 19" fill="none" stroke="#5efce8" stroke-width="2" stroke-linecap="round"/></svg>`;
  }
  if (id.includes('jet') || id.includes('jump') || id.includes('frill')) {
    return `<svg viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="20" r="17" fill="rgba(56,189,248,0.18)" stroke="#38bdf8" stroke-width="1.5"/><path d="M 11 23 L 20 11 L 29 23 M 14 30 L 20 22 L 26 30" fill="none" stroke="#5efce8" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  }
  if (id.includes('gecko') || id.includes('sprint') || id.includes('climb')) {
    return `<svg viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="20" r="17" fill="rgba(52,211,153,0.18)" stroke="#34d399" stroke-width="1.5"/><path d="M 20 29 V 15 M 20 15 L 13 11 M 20 15 L 20 9 M 20 15 L 27 11" fill="none" stroke="#6ee7b7" stroke-width="2.5" stroke-linecap="round"/><circle cx="13" cy="11" r="2.2" fill="#fde047"/><circle cx="20" cy="9" r="2.2" fill="#fde047"/><circle cx="27" cy="11" r="2.2" fill="#fde047"/></svg>`;
  }
  if (id.includes('aegis') || id.includes('bubble') || id.includes('shield') || id.includes('shell')) {
    return `<svg viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="20" r="17" fill="rgba(165,243,252,0.22)" stroke="#a5f3fc" stroke-width="1.8"/><circle cx="15" cy="14" r="3.5" fill="#ffffff" opacity="0.75"/><polygon points="20,11 27,20 20,29 13,20" fill="none" stroke="#fde047" stroke-width="1.8"/></svg>`;
  }
  if (id.includes('prism') || id.includes('split') || id.includes('multi') || id.includes('volley')) {
    return `<svg viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="20" r="17" fill="rgba(251,113,133,0.18)" stroke="#fda4af" stroke-width="1.5"/><polygon points="20,9 29,26 11,26" fill="none" stroke="#5efce8" stroke-width="2"/><line x1="20" y1="18" x2="32" y2="12" stroke="#fde047" stroke-width="2"/><line x1="20" y1="18" x2="33" y2="20" stroke="#5efce8" stroke-width="2"/></svg>`;
  }
  if (id.includes('chrono') || id.includes('time') || id.includes('clock') || id.includes('tide')) {
    return `<svg viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="20" r="17" fill="rgba(253,224,71,0.18)" stroke="#fde047" stroke-width="1.5"/><circle cx="20" cy="20" r="10" fill="none" stroke="#5efce8" stroke-width="1.8"/><polyline points="20,14 20,20 25,23" fill="none" stroke="#ffffff" stroke-width="2" stroke-linecap="round"/></svg>`;
  }
  return `<svg viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="20" r="17" fill="rgba(251,191,36,0.18)" stroke="#fde047" stroke-width="1.5"/><polygon points="20,8 24,17 33,20 24,23 20,32 16,23 7,20 16,17" fill="#5efce8" stroke="#ffffff" stroke-width="1"/></svg>`;
}

// ============================================================================
// 7. TROPHY SHIELD MEDALLIONS — getTrophyShieldSVG(tier, unlocked = true)
// ============================================================================

const TROPHY_TIERS = {
  aluminum: { rimA: '#f1f5f9', rimB: '#64748b', rimC: '#1e293b', faceTop: '#1e3a5f', faceBot: '#082036', core: '#7be8ff', glow: 'rgba(123,232,255,0.3)' },
  copper: { rimA: '#ffedd5', rimB: '#ea580c', rimC: '#5c2408', faceTop: '#54270e', faceBot: '#1f0d05', core: '#fbbf24', glow: 'rgba(251,191,36,0.32)' },
  platinum: { rimA: '#ffffff', rimB: '#38bdf8', rimC: '#0c4a6e', faceTop: '#0e4f6e', faceBot: '#062338', core: '#5efce8', glow: 'rgba(94,252,232,0.38)' },
  diamond: { rimA: '#ffffff', rimB: '#2dd4bf', rimC: '#0f766e', faceTop: '#115e59', faceBot: '#042f2e', core: '#fef08a', glow: 'rgba(254,240,138,0.44)' },
};

export function getTrophyShieldSVG(tier = 'aluminum', unlocked = true) {
  const norm = TROPHY_TIERS[tier] ? tier : 'aluminum';
  const pal = TROPHY_TIERS[norm];
  const uid = nextUid(`tr-${norm}`);

  if (!unlocked) {
    return `
<svg class="trophy-shield-svg tier-${norm} is-locked" viewBox="0 0 56 64" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <polygon points="28,3 50,13 48,41 28,60 8,41 6,13" fill="#1e293b" stroke="#081826" stroke-width="1.5" stroke-linejoin="round"/>
  <polygon points="28,8 45,16 43.5,39 28,54 12.5,39 11,16" fill="#0b1d2e" stroke="#334155" stroke-width="1"/>
  <path d="M 23 29 V 24.5 A 5 5 0 0 1 33 24.5 V 29" fill="none" stroke="#64748b" stroke-width="2" stroke-linecap="round"/>
  <rect x="20" y="29" width="16" height="12" rx="2" fill="#1e293b" stroke="#64748b" stroke-width="1.4"/>
</svg>`.trim();
  }

  const star = buildStarBurstPath(28, 31, norm === 'diamond' ? 12.5 : 11, 4.4, norm === 'diamond' ? 8 : 6, 0);
  return `
<svg class="trophy-shield-svg tier-${norm} is-unlocked" viewBox="0 0 56 64" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <defs>
    <linearGradient id="${uid}-rim" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${pal.rimA}"/>
      <stop offset="45%" stop-color="${pal.rimB}"/>
      <stop offset="100%" stop-color="${pal.rimC}"/>
    </linearGradient>
    <linearGradient id="${uid}-face" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="${pal.faceTop}"/>
      <stop offset="100%" stop-color="${pal.faceBot}"/>
    </linearGradient>
  </defs>
  <polygon points="28,3 51,13 48,42 28,61 8,42 5,13" fill="url(#${uid}-rim)" stroke="#051829" stroke-width="1.4" stroke-linejoin="round"/>
  <polygon points="28,8.5 46,16.5 43.5,39.5 28,55 12.5,39.5 10,16.5" fill="url(#${uid}-face)" stroke="${pal.core}" stroke-width="1" stroke-linejoin="round"/>
  <circle cx="28" cy="31" r="14.5" fill="${pal.glow}"/>
  <path d="${star}" fill="${pal.core}" stroke="#ffffff" stroke-width="0.9"/>
</svg>`.trim();
}

// ============================================================================
// 8. INTERACTIVE LIVING WORLD WATERSHED MAP — renderWatershedWorldMap(container, opts)
//    Visually transforms from Parched Grey-Ochre (0%) -> Vibrant Turquoise-Emerald (100%)!
// ============================================================================

const WATERSHED_BIOME_BANDS = [
  {
    actIdx: 0,
    code: 'ACT I • REDWOOD CANYON RIVERS',
    shortName: 'CANYON RIVERS',
    theme: 'canyon_river',
    yTop: 448,
    yBot: 554,
    parchedFill: '#5c4d3c',
    restoredFill: '#115e59',
    waterParched: '#786652',
    waterRestored: '#2dd4bf',
    accent: '#5efce8',
    cutKey: 'prologue',
    cutLabel: 'PROLOGUE',
  },
  {
    actIdx: 1,
    code: 'ACT II • CRYSTAL ALPINE LAKES',
    shortName: 'ALPINE LAKES',
    theme: 'alpine_lake',
    yTop: 338,
    yBot: 448,
    parchedFill: '#57534e',
    restoredFill: '#0e4f6e',
    waterParched: '#78716c',
    waterRestored: '#38bdf8',
    accent: '#7dd3fc',
    cutKey: 'act2_intro',
    cutLabel: 'ACT II',
  },
  {
    actIdx: 2,
    code: 'ACT III • EMERALD MIST BAYOUS',
    shortName: 'MIST BAYOUS',
    theme: 'mist_bayou',
    yTop: 228,
    yBot: 338,
    parchedFill: '#4f4a3e',
    restoredFill: '#065f46',
    waterParched: '#6b6353',
    waterRestored: '#34d399',
    accent: '#6ee7b7',
    cutKey: 'act3_intro',
    cutLabel: 'ACT III',
  },
  {
    actIdx: 3,
    code: 'ACT IV • SUNLIT CORAL SEAS',
    shortName: 'CORAL SEAS',
    theme: 'coral_sea',
    yTop: 118,
    yBot: 228,
    parchedFill: '#615548',
    restoredFill: '#0284c7',
    waterParched: '#7c6f60',
    waterRestored: '#22d3ee',
    accent: '#67e8f9',
    cutKey: 'act4_intro',
    cutLabel: 'ACT IV',
  },
  {
    actIdx: 4,
    code: 'ACT V • POLAR & TEMPEST OCEANS',
    shortName: 'TEMPEST OCEANS',
    theme: 'storm_ocean',
    yTop: 6,
    yBot: 118,
    parchedFill: '#3f3f46',
    restoredFill: '#1e3a8a',
    waterParched: '#52525b',
    waterRestored: '#60a5fa',
    accent: '#fde047',
    cutKey: 'act5_intro',
    cutLabel: 'FINALE',
  },
];

const NODE_COORDS_10 = [
  { x: 102, y: 506, actIdx: 0, routeNext: 'rapids_surf', routeLbl: 'SURF' },
  { x: 306, y: 476, actIdx: 0, routeNext: 'frill_glide', routeLbl: 'GLIDE' },
  { x: 296, y: 398, actIdx: 1, routeNext: 'reef_swim', routeLbl: 'SWIM' },
  { x: 112, y: 368, actIdx: 1, routeNext: 'frill_glide', routeLbl: 'GLIDE' },
  { x: 118, y: 292, actIdx: 2, routeNext: 'rapids_surf', routeLbl: 'SURF' },
  { x: 308, y: 262, actIdx: 2, routeNext: 'reef_swim', routeLbl: 'SWIM' },
  { x: 298, y: 184, actIdx: 3, routeNext: 'rapids_surf', routeLbl: 'SURF' },
  { x: 114, y: 152, actIdx: 3, routeNext: 'frill_glide', routeLbl: 'GLIDE' },
  { x: 126, y: 82, actIdx: 4, routeNext: 'reef_swim', routeLbl: 'SWIM' },
  { x: 292, y: 48, actIdx: 4, routeNext: null, routeLbl: '' },
];

const DEFAULT_SPIRE_BRIEFS = [
  'Redwood Canyon Gorge. Route copper river-valves to power real mechanical lifts and awaken waterfall rapids.',
  'Grand Timber Dam Spire. Spin hydro-turbines with Gateway’s Tail-Whip and plunge down the Reactor Core.',
  'Snow-Capped Mirror Basin. Ascend carved granite staircases and align crystal aqueduct prisms.',
  'Alpenglow Glacial Viaduct. Scamper up wet crystal wall strips and free the frozen mountain headwaters.',
  'Sunken Cypress Sanctum. Ride warm firefly lanterns across mossy stone decks and floodgate locks.',
  'Bioluminescent Delta Root-Spire. Defeat the Bayou Siphon Warden to restore emerald lotus channels.',
  'Turquoise Atoll Lagoon. Leap between mother-of-pearl terraces above shallow sunlit coral reefs.',
  'Tidal Sea-Glass Citadel. Flip Snap-Claw Dredgers onto their backs to vault into the Crown Sanctum.',
  'Aurora Iceberg Trench. Brave howling polar crosswinds and grapple across glacial chasm rings.',
  'The Mother Siphon Leviathan. Shatter the master offshore siphon core to heal Earth’s global hydrosphere!',
];

function normalizeStars(raw) {
  if (typeof raw === 'number') {
    const c = Math.max(0, Math.min(3, Math.floor(raw)));
    return { clear: c >= 1, vault: c >= 2, speed: c >= 3, nohit: false, combo: false, count: c };
  }
  const clear = Boolean(raw?.clear);
  const vault = Boolean(raw?.vault);
  const speed = Boolean(raw?.speed);
  const nohit = Boolean(raw?.nohit);
  const combo = Boolean(raw?.combo);
  const count = raw?.count ?? ((clear ? 1 : 0) + (vault ? 1 : 0) + (speed ? 1 : 0));
  return { clear, vault, speed, nohit, combo, count };
}

export function renderWatershedWorldMap(container, opts = {}) {
  if (!container) return;

  const {
    towers = [],
    selectedIdx = 0,
    isTowerUnlocked = (idx) => idx === 0,
    getStars = () => ({ clear: false, vault: false, speed: false, count: 0 }),
    getActRestoration = null,
    isRelicFound = () => false,
    onSelectTower = null,
    onDeployTower = null,
    onPlayCutscene = null,
    onPlayRoute = null,
    isCutsceneUnlocked = null,
  } = opts || {};

  const totalSpires = Math.max(8, Math.min(10, towers.length || 10));
  let activeIdx = Math.max(0, Math.min(totalSpires - 1, Number(selectedIdx) || 0));
  const uid = nextUid('watershed');

  const coordsList = totalSpires <= 8
    ? [
        NODE_COORDS_10[0], NODE_COORDS_10[1],
        NODE_COORDS_10[2], NODE_COORDS_10[3],
        NODE_COORDS_10[4], NODE_COORDS_10[5],
        NODE_COORDS_10[6], { ...NODE_COORDS_10[9], actIdx: 4 },
      ]
    : NODE_COORDS_10.slice(0, totalSpires);

  const checkUnlocked = (idx) => Boolean(isTowerUnlocked(idx, towers[idx] || { id: idx + 1 }));
  const readStars = (idx) => normalizeStars(getStars(idx, towers[idx] || { id: idx + 1 }));
  const readLogFound = (idx) => Boolean(isRelicFound(idx, towers[idx] || { id: idx + 1 }));

  const computeActPct = (actIdx) => {
    if (typeof getActRestoration === 'function') {
      const v = Number(getActRestoration(actIdx));
      if (Number.isFinite(v)) return Math.max(0, Math.min(100, Math.round(v)));
    }
    const actNodeIndices = coordsList
      .map((nd, i) => (nd.actIdx === actIdx ? i : -1))
      .filter((i) => i >= 0);
    if (actNodeIndices.length === 0) return 0;
    const cleared = actNodeIndices.filter((i) => readStars(i).clear).length;
    return Math.round((cleared / actNodeIndices.length) * 100);
  };

  const renderDOM = () => {
    const actPcts = WATERSHED_BIOME_BANDS.map((b) => computeActPct(b.actIdx));
    const globalPct = Math.round(actPcts.reduce((s, v) => s + v, 0) / WATERSHED_BIOME_BANDS.length);

    // 1. Render 5 Living Biome Bands (Parched Grey-Ochre -> Lush Turquoise-Emerald!)
    const bandsSvg = WATERSHED_BIOME_BANDS.map((b) => {
      const pct = actPcts[b.actIdx] / 100;
      const landCol = lerpHex(b.parchedFill, b.restoredFill, pct);
      const waterCol = lerpHex(b.waterParched, b.waterRestored, pct);
      const badgeCol = pct >= 0.99 ? '#34d399' : pct > 0 ? '#38bdf8' : '#a8a29e';
      const statusTxt = pct >= 0.99 ? '100% RESTORED' : pct > 0 ? `${Math.round(pct * 100)}% FLOWING` : '0% PARCHED';
      const h = b.yBot - b.yTop;

      // Cracked parched lines fade out as pct -> 1; lush foliage/coral blooms fade in!
      const cracksOpacity = fmt((1 - pct) * 0.42);
      const bloomOpacity = fmt(0.15 + pct * 0.85);

      return `
        <g class="watershed-biome-band" data-act="${b.actIdx}">
          <rect x="6" y="${b.yTop}" width="408" height="${h}" fill="${landCol}"/>
          <!-- Winding Watershed River / Lagoon Channel Across Band -->
          <path d="M 6 ${b.yTop + h * 0.58} Q 110 ${b.yTop + h * 0.28} 210 ${b.yTop + h * 0.54} T 414 ${b.yTop + h * 0.44}"
                fill="none" stroke="${waterCol}" stroke-width="${12 + pct * 10}" stroke-linecap="round" opacity="0.72"/>
          ${
            pct > 0.05
              ? `<path class="watershed-live-current" d="M 10 ${b.yTop + h * 0.58} Q 110 ${b.yTop + h * 0.28} 210 ${b.yTop + h * 0.54} T 410 ${b.yTop + h * 0.44}"
                       fill="none" stroke="#e0f2fe" stroke-width="2" stroke-dasharray="10 8" opacity="${bloomOpacity}"/>`
              : `<path d="M 38 ${b.yTop + 20} L 54 ${b.yTop + 34} L 46 ${b.yTop + 48} M 348 ${b.yTop + 24} L 364 ${b.yTop + 38}"
                       fill="none" stroke="#292524" stroke-width="1.3" opacity="${cracksOpacity}"/>`
          }
          <line x1="6" y1="${b.yTop}" x2="414" y2="${b.yTop}" stroke="rgba(255,255,255,0.14)" stroke-width="1"/>
          <text x="18" y="${b.yTop + 16}" font-family="'Cinzel', 'Orbitron', sans-serif" font-size="7.6" font-weight="800" letter-spacing="1.4" fill="#f8fafc" opacity="0.92">${b.code}</text>
          <rect x="322" y="${b.yTop + 6}" width="82" height="14" rx="7" fill="rgba(4,16,28,0.72)" stroke="${badgeCol}" stroke-width="0.9"/>
          <text x="363" y="${b.yTop + 15.5}" text-anchor="middle" font-family="'Outfit', 'Rajdhani', sans-serif" font-size="7.6" font-weight="800" letter-spacing="0.7" fill="${badgeCol}">${statusTxt}</text>
        </g>
      `;
    }).join('');

    // 2. Inter-Spire Living Water Travel Routes
    const routesSvg = coordsList
      .slice(0, -1)
      .map((nd, idx) => {
        const nx = coordsList[idx + 1];
        const routeActive = readStars(idx).clear;
        const mx = (nd.x + nx.x) * 0.5;
        const my = (nd.y + nx.y) * 0.5 - 8;
        const strokeCol = routeActive ? '#5efce8' : 'rgba(214,211,209,0.34)';
        return `
          <g class="sea-route-group ${routeActive ? 'unlocked' : 'locked'}">
            <path d="M ${nd.x} ${nd.y} Q ${mx} ${my} ${nx.x} ${nx.y}" fill="none" stroke="${strokeCol}" stroke-width="${routeActive ? '2.8' : '1.6'}" stroke-dasharray="${routeActive ? 'none' : '5 5'}" stroke-linecap="round"/>
            ${
              nd.routeNext
                ? `<g class="sea-route-pill ${routeActive ? 'unlocked' : 'locked'}" data-route-idx="${idx}" transform="translate(${fmt(mx)}, ${fmt(my)})" style="cursor:pointer;">
                    <rect x="-24" y="-8" width="48" height="16" rx="8" fill="#062236" stroke="${strokeCol}" stroke-width="1.1"/>
                    <text x="0" y="3" text-anchor="middle" font-family="'Outfit', sans-serif" font-size="7.4" font-weight="800" letter-spacing="0.8" fill="${routeActive ? '#ccfbf1' : '#94a3b8'}">${nd.routeLbl}</text>
                  </g>`
                : ''
            }
          </g>
        `;
      })
      .join('');

    // 3. Spire Sanctuary Nodes
    const nodesSvg = coordsList
      .map((nd, idx) => {
        const t = towers[idx] || { id: idx + 1, name: `SPIRE ${idx + 1}` };
        const unlocked = checkUnlocked(idx);
        const stars = readStars(idx);
        const isSelected = idx === activeIdx;
        const band = WATERSHED_BIOME_BANDS[nd.actIdx] || WATERSHED_BIOME_BANDS[0];
        const spireCol = stars.clear ? '#2dd4bf' : unlocked ? '#38bdf8' : '#57534e';

        const starPips = [stars.clear, stars.vault, stars.speed]
          .map((on, sIdx) => {
            const sx = (sIdx - 1) * 9.5;
            const p = buildStarBurstPath(sx, 23, 3.8, 1.6, 5, 0);
            return `<path d="${p}" fill="${on ? '#fde047' : '#082032'}" stroke="${on ? '#ffffff' : '#64748b'}" stroke-width="0.7"/>`;
          })
          .join('');

        const isActStart = idx === 0 || coordsList[idx - 1]?.actIdx !== nd.actIdx;
        const cutKey = idx === totalSpires - 1 && stars.clear ? 'epilogue' : isActStart ? band.cutKey : null;
        const cutReady = cutKey
          ? typeof isCutsceneUnlocked === 'function'
            ? Boolean(isCutsceneUnlocked(cutKey, idx))
            : unlocked
          : false;

        return `
          <g class="sea-spire-node ${isSelected ? 'selected active' : ''} ${stars.clear ? 'cleared' : ''} ${unlocked ? 'unlocked' : 'locked'}"
             data-tower-idx="${idx}" transform="translate(${nd.x}, ${nd.y})" role="button" tabindex="0"
             aria-label="Spire ${idx + 1}: ${escapeHtml(t.name)}" style="cursor:pointer;">
            <ellipse cx="0" cy="9" rx="24" ry="8.5" fill="${stars.clear ? '#0d9488' : '#1c2b3a'}" stroke="${unlocked ? band.accent : '#57534e'}" stroke-width="1.1"/>
            ${
              isSelected
                ? `<circle class="spire-beacon-ring" cx="0" cy="-2" r="28" fill="rgba(94,252,232,0.16)" stroke="#5efce8" stroke-width="1.8" stroke-dasharray="7 4"/>`
                : ''
            }
            <polygon points="-11,9 -7,-19 0,-26 7,-19 11,9" fill="${spireCol}" stroke="#ffffff" stroke-width="${isSelected ? '1.5' : '0.9'}"/>
            <line x1="0" y1="-20" x2="0" y2="6" stroke="${stars.clear ? '#fef08a' : '#bae6fd'}" stroke-width="1.8"/>
            <rect x="-14" y="3" width="28" height="12" rx="4" fill="${isSelected ? '#fde047' : '#062032'}" stroke="${unlocked ? '#ffffff' : '#64748b'}" stroke-width="1"/>
            <text x="0" y="11.8" text-anchor="middle" font-family="'Outfit', sans-serif" font-size="8.4" font-weight="900" fill="${isSelected ? '#041828' : '#ffffff'}">S${idx + 1}</text>
            ${unlocked ? starPips : ''}
            ${
              cutKey
                ? `<g class="sea-cutscene-badge ${cutReady ? 'unlocked' : 'locked'}" data-cutscene-key="${cutKey}" data-cutscene-idx="${idx}" transform="translate(0, -35)">
                    <rect x="-31" y="-7.5" width="62" height="15" rx="7.5" fill="${cutReady ? '#0c3b59' : '#1e293b'}" stroke="${cutReady ? '#fde047' : '#475569'}" stroke-width="1"/>
                    <text x="0" y="2.8" text-anchor="middle" font-family="'Outfit', sans-serif" font-size="6.8" font-weight="800" fill="${cutReady ? '#fef08a' : '#94a3b8'}">▶ ${idx === totalSpires - 1 && stars.clear ? 'EPILOGUE' : band.cutLabel}</text>
                  </g>`
                : ''
            }
          </g>
        `;
      })
      .join('');

    const selTower = towers[activeIdx] || { id: activeIdx + 1, name: `HYDRO-SPIRE ${activeIdx + 1}` };
    const selUnlocked = checkUnlocked(activeIdx);
    const selStars = readStars(activeIdx);
    const selLog = readLogFound(activeIdx);
    const selCoord = coordsList[activeIdx] || coordsList[0];
    const selBand = WATERSHED_BIOME_BANDS[selCoord.actIdx] || WATERSHED_BIOME_BANDS[0];
    const selActPct = actPcts[selCoord.actIdx] ?? 0;
    const briefCopy = selTower.blurb || selTower.description || DEFAULT_SPIRE_BRIEFS[activeIdx] || DEFAULT_SPIRE_BRIEFS[0];

    const purifyCutKey = `purify_${selBand.theme}`;
    const assocCutKey = selStars.clear ? purifyCutKey : selBand.cutKey;
    const assocCutLabel = selStars.clear ? 'REPLAY PURIFICATION' : `STORY • ${selBand.cutLabel}`;
    const assocCutReady = typeof isCutsceneUnlocked === 'function'
      ? Boolean(isCutsceneUnlocked(assocCutKey, activeIdx))
      : selUnlocked || selStars.clear;

    const starChipsHtml = [
      { on: selStars.clear, lbl: 'PURIFIED' },
      { on: selStars.vault, lbl: 'SANCTUM' },
      { on: selStars.speed, lbl: 'SWIFT FLOW' },
    ]
      .map(
        (st) => `
        <span class="spyglass-star-chip ${st.on ? 'on' : 'off'}" style="display:inline-flex;align-items:center;gap:4px;font-size:10.5px;font-weight:800;color:${st.on ? '#fde047' : '#94a3b8'};">
          <span>${st.on ? '★' : '☆'}</span><span>${st.lbl}</span>
        </span>`
      )
      .join('');

    container.innerHTML = `
      <div class="sea-chart-shell watershed-map-shell">
        <!-- Global Earth Hydrosphere Restoration Progress Strip -->
        <div class="watershed-global-banner">
          <div class="wg-top-row">
            <span class="wg-lbl">EARTH HYDROSPHERE RESTORATION</span>
            <span class="wg-pct">${globalPct}% HEALED</span>
          </div>
          <div class="wg-track">
            <div class="wg-fill" style="width:${globalPct}%"></div>
          </div>
        </div>

        <div class="sea-chart-frame watershed-svg-frame">
          <svg class="sea-chart-svg" viewBox="0 0 420 560" xmlns="http://www.w3.org/2000/svg" role="region" aria-label="Earth Living Watershed Restoration Map">
            <defs>
              <clipPath id="${uid}-clip">
                <rect x="6" y="6" width="408" height="548" rx="10"/>
              </clipPath>
            </defs>
            <g clip-path="url(#${uid}-clip)">
              ${bandsSvg}
              ${routesSvg}
              ${nodesSvg}
            </g>
            <rect x="6" y="6" width="408" height="548" rx="10" fill="none" stroke="#eab308" stroke-width="1.8" opacity="0.82"/>
          </svg>
        </div>

        <div class="spyglass-plaque" style="min-width:0;">
          <div class="spyglass-top-row">
            <div style="min-width:0;flex:1 1 160px;">
              <div class="spyglass-kicker">${escapeHtml(selBand.code)} • ${selActPct}% RESTORED</div>
              <div class="spyglass-title">SPIRE ${activeIdx + 1} • ${escapeHtml(selTower.name)}</div>
            </div>
            ${
              assocCutKey && onPlayCutscene
                ? `<button type="button" class="spyglass-cinema-btn ${assocCutReady ? '' : 'locked'}" data-spyglass-cut="${assocCutKey}" ${assocCutReady ? '' : 'disabled'}>
                    <span>▶ ${assocCutLabel}</span>
                  </button>`
                : ''
            }
          </div>

          <p class="spyglass-desc">${escapeHtml(briefCopy)}</p>

          <div class="spyglass-meta-row" style="justify-content:space-between;">
            <div class="spyglass-stars" style="display:inline-flex;align-items:center;gap:9px;">${starChipsHtml}</div>
            <span class="spyglass-relic ${selLog ? 'found' : 'missing'}" style="font-size:10.5px;font-weight:800;color:${selLog ? '#5efce8' : '#94a3b8'};">
              ${selLog ? '◆ FIELD LOG RECOVERED' : '◇ FIELD LOG HIDDEN'}
            </span>
          </div>

          <div class="spyglass-actions-row">
            <button type="button" class="spyglass-deploy-btn btn-primary ${selUnlocked ? '' : 'locked'}" ${selUnlocked ? '' : 'disabled'} style="width:100%;">
              <span>${selUnlocked ? `DESCEND & PURIFY • SPIRE ${activeIdx + 1}` : `LOCKED • RESTORE SPIRE ${activeIdx} FIRST`}</span>
            </button>
          </div>
        </div>
      </div>
    `;

    container.querySelectorAll('.sea-spire-node').forEach((nodeEl) => {
      const idx = Number(nodeEl.getAttribute('data-tower-idx')) || 0;
      const selectHandler = () => {
        activeIdx = idx;
        renderDOM();
        onSelectTower?.(idx, towers[idx]);
      };
      nodeEl.addEventListener('click', selectHandler);
      nodeEl.addEventListener('keydown', (ev) => {
        if (ev.key === 'Enter' || ev.key === ' ') {
          ev.preventDefault();
          selectHandler();
        }
      });
      nodeEl.addEventListener('dblclick', () => {
        if (checkUnlocked(idx)) onDeployTower?.(idx, towers[idx]);
      });
    });

    container.querySelectorAll('.sea-cutscene-badge').forEach((badgeEl) => {
      badgeEl.addEventListener('click', (ev) => {
        ev.stopPropagation();
        const cutKey = badgeEl.getAttribute('data-cutscene-key');
        const cutIdx = Number(badgeEl.getAttribute('data-cutscene-idx')) || 0;
        if (cutKey) onPlayCutscene?.(cutKey, cutIdx, towers[cutIdx]);
      });
    });

    container.querySelectorAll('.sea-route-pill').forEach((pillEl) => {
      pillEl.addEventListener('click', (ev) => {
        ev.stopPropagation();
        const rIdx = Number(pillEl.getAttribute('data-route-idx')) || 0;
        const nd = coordsList[rIdx];
        if (nd?.routeNext && readStars(rIdx).clear && typeof onPlayRoute === 'function') {
          onPlayRoute(nd.routeNext, rIdx, rIdx + 1);
        }
      });
    });

    container.querySelector('.spyglass-cinema-btn')?.addEventListener('click', (ev) => {
      const cutKey = ev.currentTarget.getAttribute('data-spyglass-cut');
      if (cutKey) onPlayCutscene?.(cutKey, activeIdx, towers[activeIdx]);
    });

    container.querySelector('.spyglass-deploy-btn')?.addEventListener('click', () => {
      if (checkUnlocked(activeIdx)) onDeployTower?.(activeIdx, towers[activeIdx]);
    });
  };

  renderDOM();
}

export const renderArchipelagoSeaChart = renderWatershedWorldMap;
