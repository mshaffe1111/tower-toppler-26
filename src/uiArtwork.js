// Tower Toppler '26 — Operation Nebulus
// Bespoke Diegetic Menu Illustrations, Sculpted 3D Box-Art Crest & Interactive Sea Chart
// Pure ES6 module — zero external dependencies, zero emojis.

let _svgUidCounter = 0;
function nextUid(prefix = 'ua') {
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

// ============================================================================
// PRECISION PROCEDURAL CLOCKWORK, ASTROLABE & RUNE GEOMETRY HELPERS
// ============================================================================

function buildClockworkGearPath(cx, cy, rOuter, rRoot, rRimIn, rHubOut, rBore, teeth = 12, spokes = 4, rotDeg = 0) {
  const step = (Math.PI * 2) / teeth;
  const rot = (rotDeg * Math.PI) / 180;
  let d = '';

  for (let i = 0; i < teeth; i++) {
    const a0 = rot + i * step;
    const a1 = a0 + step * 0.17;
    const a2 = a0 + step * 0.27;
    const a3 = a0 + step * 0.53;
    const a4 = a0 + step * 0.63;

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
// CHISELED 3D-EXTRUDED MONOLITH DISPLAY GLYPHS ("TOWER" + "TOPPLER")
// ============================================================================

const CHISELED_GLYPHS = {
  T: {
    w: 80,
    polys: [
      [
        [0, 0], [80, 0], [76, 28], [67, 23], [53, 23], [53, 56], [50, 59], [53, 62],
        [53, 91], [58, 100], [22, 100], [27, 91], [27, 23], [13, 23], [4, 28],
      ],
    ],
    ridges: [
      [[8, 12], [72, 12]],
      [[40, 12], [40, 93]],
    ],
    cracks: [
      [[18, 0], [21, 9], [17, 15]],
      [[53, 59], [44, 63], [41, 70]],
    ],
  },
  O: {
    w: 84,
    polys: [
      [
        [18, 0], [66, 0], [84, 18], [84, 47], [80, 50], [84, 54], [84, 82],
        [66, 100], [18, 100], [0, 82], [0, 18],
      ],
      [
        [29, 23], [55, 23], [59, 28], [59, 72], [55, 77], [29, 77], [25, 72], [25, 28],
      ],
    ],
    ridges: [
      [[22, 11], [62, 11], [72, 22], [72, 78], [62, 89], [22, 89], [12, 78], [12, 22], [22, 11]],
    ],
    cracks: [
      [[0, 36], [9, 39], [14, 35]],
      [[58, 100], [55, 90], [60, 85]],
    ],
  },
  W: {
    w: 104,
    polys: [
      [
        [0, 0], [25, 0], [35, 61], [45, 16], [59, 16], [69, 61], [79, 0], [104, 0],
        [84, 100], [61, 100], [52, 57], [43, 100], [20, 100],
      ],
    ],
    ridges: [
      [[13, 8], [31, 90], [52, 34], [73, 90], [91, 8]],
    ],
    cracks: [
      [[9, 44], [18, 47], [22, 43]],
      [[88, 58], [80, 62]],
    ],
  },
  E: {
    w: 76,
    polys: [
      [
        [0, 0], [75, 0], [72, 24], [64, 22], [26, 22], [26, 39], [60, 39], [66, 50],
        [60, 61], [26, 61], [26, 78], [65, 78], [73, 75], [76, 100], [0, 100],
        [0, 62], [4, 58], [0, 54],
      ],
    ],
    ridges: [
      [[66, 11], [13, 11], [13, 89], [67, 89]],
      [[13, 50], [58, 50]],
    ],
    cracks: [
      [[46, 0], [43, 9], [48, 14]],
      [[4, 58], [13, 55], [18, 60]],
    ],
  },
  R: {
    w: 84,
    polys: [
      [
        [0, 0], [59, 0], [80, 16], [80, 44], [63, 57], [84, 100], [56, 100],
        [39, 61], [26, 61], [26, 92], [30, 100], [0, 100],
      ],
      [
        [26, 21], [51, 21], [55, 25], [55, 38], [51, 42], [26, 42],
      ],
    ],
    ridges: [
      [[13, 92], [13, 11], [54, 11], [68, 21], [68, 39], [54, 51], [13, 51]],
      [[49, 53], [70, 93]],
    ],
    cracks: [
      [[80, 29], [71, 32], [67, 29]],
      [[66, 82], [58, 86]],
    ],
  },
  P: {
    w: 80,
    polys: [
      [
        [0, 0], [58, 0], [80, 16], [80, 47], [58, 63], [26, 63],
        [26, 91], [31, 100], [0, 100],
      ],
      [
        [26, 21], [50, 21], [55, 25], [55, 39], [50, 43], [26, 43],
      ],
    ],
    ridges: [
      [[13, 92], [13, 11], [54, 11], [67, 22], [67, 42], [54, 52], [13, 52]],
    ],
    cracks: [
      [[0, 70], [9, 67], [13, 72]],
      [[42, 0], [45, 9]],
    ],
  },
  L: {
    w: 72,
    polys: [
      [
        [0, 0], [29, 0], [26, 8], [26, 76], [61, 76], [72, 70], [69, 100], [0, 100],
      ],
    ],
    ridges: [
      [[13, 8], [13, 88], [62, 88]],
    ],
    cracks: [
      [[26, 36], [17, 40], [14, 46]],
      [[46, 100], [43, 90]],
    ],
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
  isOriginal,
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

  const slices = 8;
  let extrudeMarkup = '';
  const extrudePaletteReboot = [
    '#03060e', '#060c1b', '#0a1328', '#101d3a',
    '#16274b', '#1d325d', '#264173', '#32538c',
  ];
  const extrudePaletteOrig = [
    '#050618', '#0b1033', '#121d52', '#1a2c73',
    '#253f99', '#3b5bdb', '#6a4c12', '#b8861b',
  ];
  const palette = isOriginal ? extrudePaletteOrig : extrudePaletteReboot;

  for (let s = slices; s >= 1; s--) {
    const t = s / slices;
    const col = palette[slices - s] || palette[0];
    let sliceD = '';
    for (const { g, x0 } of glyphPlacements) {
      sliceD +=
        polysToPath(g.polys, (gx, gy) => {
          const bx = x0 + gx * sx;
          const by = topY + gy * sy;
          const px = bx + (vpX - bx) * (0.046 * t);
          const py = by + (vpY - by) * (0.028 * t) + extrudeDepth * t;
          return [px, py];
        }) + ' ';
    }
    extrudeMarkup += `<path d="${sliceD.trim()}" fill="${col}" fill-rule="evenodd" stroke="${col}" stroke-width="1.35" stroke-linejoin="round"/>`;
  }

  let frontFacesD = '';
  let ridgesD = '';
  let ridgesShadowD = '';
  let cracksD = '';
  let cracksHighlightD = '';

  for (const { g, x0 } of glyphPlacements) {
    const mapFront = (gx, gy) => [x0 + gx * sx, topY + gy * sy];
    const mapShadow = (gx, gy) => [x0 + gx * sx + 0.85, topY + gy * sy + 1.15];
    const mapCrackHi = (gx, gy) => [x0 + gx * sx + 0.65, topY + gy * sy + 0.65];

    frontFacesD += polysToPath(g.polys, mapFront) + ' ';
    ridgesD += linesToPath(g.ridges, mapFront) + ' ';
    ridgesShadowD += linesToPath(g.ridges, mapShadow) + ' ';
    cracksD += linesToPath(g.cracks, mapFront) + ' ';
    cracksHighlightD += linesToPath(g.cracks, mapCrackHi) + ' ';
  }

  const ridgeStroke = isOriginal ? 'rgba(255,250,210,0.84)' : 'rgba(195,244,255,0.72)';
  const ridgeShadow = isOriginal ? 'rgba(10,18,56,0.75)' : 'rgba(5,10,22,0.8)';
  const crackDetails = isOriginal
    ? ''
    : `
      <path d="${cracksHighlightD.trim()}" fill="none" stroke="rgba(165,235,255,0.44)" stroke-width="0.9" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="${cracksD.trim()}" fill="none" stroke="#050914" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round"/>
    `;

  return `
    <g class="crest-word-3d">
      ${extrudeMarkup}
      <path d="${frontFacesD.trim()}" fill="url(#${faceGradId})" fill-rule="evenodd" stroke="url(#${bevelGradId})" stroke-width="2.35" stroke-linejoin="round"/>
      <path d="${frontFacesD.trim()}" fill="none" stroke="rgba(4,9,20,0.68)" stroke-width="0.85" stroke-linejoin="round"/>
      <path d="${ridgesShadowD.trim()}" fill="none" stroke="${ridgeShadow}" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="${ridgesD.trim()}" fill="none" stroke="${ridgeStroke}" stroke-width="1.15" stroke-linecap="round" stroke-linejoin="round"/>
      ${crackDetails}
    </g>
  `;
}

// ============================================================================
// 1. TITLE CREST EMBLEM — getTitleCrestSVG(era = 'reboot')
// ============================================================================

export function getTitleCrestSVG(era = 'reboot') {
  const isOriginal = era === 'original';
  const uid = nextUid('crest');

  const cx = 280;
  const cy = 97.5;
  const astrolabeGearOuter = buildClockworkGearPath(cx, cy, 86, 80, 74, 54, 48, 28, 8, 6.4);
  const astrolabeGearInner = buildClockworkGearPath(cx, cy, 62, 57.5, 52, 34, 28, 16, 4, 22.5);
  const astrolabeTicks = buildDegreeTicksPath(cx, cy, 66, 73, 48, 6, 0);
  const wingGearL = buildClockworkGearPath(150, 82, 22, 18.5, 15, 8, 4, 12, 4, 14);
  const wingGearR = buildClockworkGearPath(410, 82, 22, 18.5, 15, 8, 4, 12, 4, -14);
  const starCoreCrown = buildStarBurstPath(280, 21, 13.5, 4.4, 8, 0);
  const starCoreInner = buildStarBurstPath(280, 21, 7.5, 2.8, 4, 45);

  const cardinalRunes = [0, 90, 180, 270]
    .map((deg) => {
      const rad = (deg * Math.PI) / 180;
      const rx = cx + Math.cos(rad) * 84;
      const ry = cy + Math.sin(rad) * 84;
      return `<polygon points="${fmt(rx)},${fmt(ry - 4.5)} ${fmt(rx + 4.5)},${fmt(ry)} ${fmt(rx)},${fmt(ry + 4.5)} ${fmt(rx - 4.5)},${fmt(ry)}" fill="url(#${uid}-cyan)" stroke="#081426" stroke-width="0.9"/>`;
    })
    .join('');

  const towerWordSvg = renderChiseledWord({
    word: 'TOWER',
    centerX: 280,
    topY: 40,
    sx: 0.45,
    sy: 0.38,
    gap: 13,
    vpX: 280,
    vpY: 186,
    extrudeDepth: 6.2,
    faceGradId: `${uid}-word-top`,
    bevelGradId: `${uid}-bevel`,
    isOriginal,
  });

  const topplerWordSvg = renderChiseledWord({
    word: 'TOPPLER',
    centerX: 280,
    topY: 85,
    sx: 0.65,
    sy: 0.52,
    gap: 11,
    vpX: 280,
    vpY: 190,
    extrudeDepth: 8.6,
    faceGradId: `${uid}-word-bot`,
    bevelGradId: `${uid}-bevel`,
    isOriginal,
  });

  const ribbonLabel = isOriginal ? "NEBULUS ARCHIVE · '87" : "OPERATION NEBULUS · '26";
  const accentCyan = isOriginal ? '#00f0ff' : '#63f5ff';
  const accentGold = isOriginal ? '#ffe600' : '#ffcf67';

  return `
<svg class="title-crest-svg ui-crest-svg ${isOriginal ? 'era-original' : 'era-reboot'}" viewBox="0 0 560 195" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Tower Toppler — ${ribbonLabel}">
  <title>Tower Toppler — ${ribbonLabel}</title>
  <defs>
    <radialGradient id="${uid}-aura" cx="50%" cy="48%" r="48%">
      <stop offset="0%" stop-color="${isOriginal ? '#2563eb' : '#2dd4bf'}" stop-opacity="0.32"/>
      <stop offset="50%" stop-color="${isOriginal ? '#1e1b4b' : '#0f2342'}" stop-opacity="0.2"/>
      <stop offset="100%" stop-color="#040812" stop-opacity="0"/>
    </radialGradient>

    <radialGradient id="${uid}-star-glow" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#ffffff" stop-opacity="0.96"/>
      <stop offset="32%" stop-color="${accentCyan}" stop-opacity="0.78"/>
      <stop offset="70%" stop-color="${isOriginal ? '#3b82f6' : '#c026ff'}" stop-opacity="0.28"/>
      <stop offset="100%" stop-color="#040812" stop-opacity="0"/>
    </radialGradient>

    <linearGradient id="${uid}-brass" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${isOriginal ? '#fff7b2' : '#ffe8a3'}"/>
      <stop offset="28%" stop-color="${isOriginal ? '#facc15' : '#d99b38'}"/>
      <stop offset="56%" stop-color="${isOriginal ? '#ca8a04' : '#7c4d15'}"/>
      <stop offset="82%" stop-color="${isOriginal ? '#fde047' : '#c6882c'}"/>
      <stop offset="100%" stop-color="${isOriginal ? '#854d0e' : '#4a2c0a'}"/>
    </linearGradient>

    <linearGradient id="${uid}-wing-plate" x1="0%" y1="0%" x2="100%" y2="80%">
      <stop offset="0%" stop-color="${isOriginal ? '#1d4ed8' : '#263556'}"/>
      <stop offset="55%" stop-color="${isOriginal ? '#0f172a' : '#111b32'}"/>
      <stop offset="100%" stop-color="#050914"/>
    </linearGradient>

    <linearGradient id="${uid}-cyan" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#ffffff"/>
      <stop offset="45%" stop-color="${accentCyan}"/>
      <stop offset="100%" stop-color="${isOriginal ? '#0284c7' : '#0d9488'}"/>
    </linearGradient>

    <linearGradient id="${uid}-tower-sil" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${isOriginal ? '#3b82f6' : '#4e5d8c'}"/>
      <stop offset="45%" stop-color="${isOriginal ? '#1d4ed8' : '#252c4d'}"/>
      <stop offset="100%" stop-color="#090e1c"/>
    </linearGradient>

    <linearGradient id="${uid}-word-top" x1="0%" y1="0%" x2="0%" y2="100%">
      ${
        isOriginal
          ? `
        <stop offset="0%" stop-color="#ffffff"/>
        <stop offset="28%" stop-color="#93c5fd"/>
        <stop offset="50%" stop-color="#1e3a8a"/>
        <stop offset="54%" stop-color="#fde047"/>
        <stop offset="82%" stop-color="#f59e0b"/>
        <stop offset="100%" stop-color="#fffbeb"/>`
          : `
        <stop offset="0%" stop-color="#f1f8ff"/>
        <stop offset="24%" stop-color="#a5d8f3"/>
        <stop offset="52%" stop-color="#4e628f"/>
        <stop offset="56%" stop-color="#25304f"/>
        <stop offset="84%" stop-color="#3a4c78"/>
        <stop offset="100%" stop-color="#7be8ff"/>`
      }
    </linearGradient>

    <linearGradient id="${uid}-word-bot" x1="0%" y1="0%" x2="0%" y2="100%">
      ${
        isOriginal
          ? `
        <stop offset="0%" stop-color="#ffffff"/>
        <stop offset="22%" stop-color="#7dd3fc"/>
        <stop offset="47%" stop-color="#1d4ed8"/>
        <stop offset="51%" stop-color="#091538"/>
        <stop offset="68%" stop-color="#facc15"/>
        <stop offset="90%" stop-color="#fb923c"/>
        <stop offset="100%" stop-color="#fef9c3"/>`
          : `
        <stop offset="0%" stop-color="#ffffff"/>
        <stop offset="19%" stop-color="#bae6fd"/>
        <stop offset="46%" stop-color="#5a6f9e"/>
        <stop offset="51%" stop-color="#1c243d"/>
        <stop offset="76%" stop-color="#32416b"/>
        <stop offset="93%" stop-color="#5882a8"/>
        <stop offset="100%" stop-color="#7ef9ff"/>`
      }
    </linearGradient>

    <linearGradient id="${uid}-bevel" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#ffffff"/>
      <stop offset="38%" stop-color="${isOriginal ? '#fde047' : '#9bdaf2'}"/>
      <stop offset="70%" stop-color="${isOriginal ? '#b45309' : '#1e2942'}"/>
      <stop offset="100%" stop-color="${accentCyan}"/>
    </linearGradient>

    <linearGradient id="${uid}-ribbon-bg" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#070d1b"/>
      <stop offset="20%" stop-color="${isOriginal ? '#172554' : '#111d36'}"/>
      <stop offset="50%" stop-color="${isOriginal ? '#1e3a8a' : '#172847'}"/>
      <stop offset="80%" stop-color="${isOriginal ? '#172554' : '#111d36'}"/>
      <stop offset="100%" stop-color="#070d1b"/>
    </linearGradient>
  </defs>

  <ellipse cx="280" cy="96" rx="250" ry="88" fill="url(#${uid}-aura)"/>

  <!-- Rotating Tarnished-Brass & Cyan-Rune Astrolabe Halo (Symmetric around 280, 97.5) -->
  <g class="crest-astrolabe-spin">
    <circle cx="280" cy="97.5" r="89.5" fill="none" stroke="rgba(123,232,255,0.18)" stroke-width="0.9" stroke-dasharray="5 4"/>
    <path d="${astrolabeGearOuter}" fill="url(#${uid}-brass)" fill-rule="evenodd" opacity="0.88" stroke="#09101f" stroke-width="0.9"/>
    <circle cx="280" cy="97.5" r="76.5" fill="none" stroke="${accentCyan}" stroke-width="1.2" stroke-dasharray="14 6 3 6" opacity="0.82"/>
    <path d="${astrolabeTicks}" stroke="url(#${uid}-brass)" stroke-width="1.1" stroke-linecap="round" opacity="0.85"/>
    <path d="${astrolabeGearInner}" fill="url(#${uid}-brass)" fill-rule="evenodd" opacity="0.58"/>
    <polygon points="280,14 286,25 274,25" fill="${accentGold}"/>
    <polygon points="280,181 286,170 274,170" fill="${accentGold}"/>
    <polygon points="196.5,97.5 207.5,91.5 207.5,103.5" fill="${accentGold}"/>
    <polygon points="363.5,97.5 352.5,91.5 352.5,103.5" fill="${accentGold}"/>
    ${cardinalRunes}
  </g>

  <!-- Flanking Sculpted Obsidian, Clockwork-Brass & Kraken-Scroll Storm Filigree Wings -->
  <g class="crest-filigree-wings">
    <!-- Interlocking Wing Clockwork Sub-Gears -->
    <path d="${wingGearL}" fill="url(#${uid}-brass)" fill-rule="evenodd" opacity="0.76" stroke="#060b16" stroke-width="0.9"/>
    <path d="${wingGearR}" fill="url(#${uid}-brass)" fill-rule="evenodd" opacity="0.76" stroke="#060b16" stroke-width="0.9"/>

    <!-- Left Wing Obsidian-Slate Backing & Tarnished-Brass Filigree Ribs -->
    <path d="M 196 68 C 150 44, 86 38, 18 52 C 44 59, 68 68, 86 78 C 48 74, 24 80, 12 91 C 42 93, 72 100, 98 110 C 66 110, 42 117, 28 128 C 76 128, 138 118, 192 102 Z"
          fill="url(#${uid}-wing-plate)" stroke="url(#${uid}-brass)" stroke-width="1.8" stroke-linejoin="round"/>
    <!-- Left Chiseled Brass Feather Spines & Glowing Cyan Rune Channels -->
    <path d="M 186 71 C 144 50, 90 45, 28 53 L 64 64 C 106 58, 148 63, 182 77 Z" fill="url(#${uid}-brass)" opacity="0.88"/>
    <path d="M 178 84 C 134 74, 78 74, 24 88 L 58 93 C 98 85, 138 86, 174 92 Z" fill="url(#${uid}-brass)" opacity="0.82"/>
    <path d="M 164 56 C 142 35, 108 35, 100 52 C 94 64, 110 72, 121 63 C 128 57, 122 48, 114 51"
          fill="none" stroke="url(#${uid}-brass)" stroke-width="2.4" stroke-linecap="round"/>
    <path d="M 164 56 C 142 35, 108 35, 100 52 C 94 64, 110 72, 121 63"
          fill="none" stroke="${accentCyan}" stroke-width="1.15" stroke-linecap="round"/>
    <path d="M 148 78 C 108 68, 68 68, 38 74 M 142 98 C 106 104, 72 112, 42 122"
          fill="none" stroke="${accentCyan}" stroke-width="1.15" stroke-dasharray="8 4" opacity="0.78"/>
    <circle cx="58" cy="61" r="2.2" fill="${accentCyan}"/>
    <circle cx="42" cy="89" r="2" fill="${accentGold}"/>
    <circle cx="72" cy="116" r="1.8" fill="${accentCyan}"/>

    <!-- Right Wing Obsidian-Slate Backing & Tarnished-Brass Filigree Ribs -->
    <path d="M 364 68 C 410 44, 474 38, 542 52 C 516 59, 492 68, 474 78 C 512 74, 536 80, 548 91 C 518 93, 488 100, 462 110 C 494 110, 518 117, 532 128 C 484 128, 422 118, 368 102 Z"
          fill="url(#${uid}-wing-plate)" stroke="url(#${uid}-brass)" stroke-width="1.8" stroke-linejoin="round"/>
    <path d="M 374 71 C 416 50, 470 45, 532 53 L 496 64 C 454 58, 412 63, 378 77 Z" fill="url(#${uid}-brass)" opacity="0.88"/>
    <path d="M 382 84 C 426 74, 482 74, 536 88 L 502 93 C 462 85, 422 86, 386 92 Z" fill="url(#${uid}-brass)" opacity="0.82"/>
    <path d="M 396 56 C 418 35, 452 35, 460 52 C 466 64, 450 72, 439 63 C 432 57, 438 48, 446 51"
          fill="none" stroke="url(#${uid}-brass)" stroke-width="2.4" stroke-linecap="round"/>
    <path d="M 396 56 C 418 35, 452 35, 460 52 C 466 64, 450 72, 439 63"
          fill="none" stroke="${accentCyan}" stroke-width="1.15" stroke-linecap="round"/>
    <path d="M 412 78 C 452 68, 492 68, 522 74 M 418 98 C 454 104, 488 112, 518 122"
          fill="none" stroke="${accentCyan}" stroke-width="1.15" stroke-dasharray="8 4" opacity="0.78"/>
    <circle cx="502" cy="61" r="2.2" fill="${accentCyan}"/>
    <circle cx="518" cy="89" r="2" fill="${accentGold}"/>
    <circle cx="488" cy="116" r="1.8" fill="${accentCyan}"/>
  </g>

  <!-- Central Craggy Nebulus Watchtower Silhouette + Crown Star Core -->
  <g class="crest-watchtower">
    <path d="M 244 150 L 252 54 L 245 50 L 245 45 L 255 45 L 257 31 L 252 28 L 252 22 L 260 22 L 260 27 L 267 27 L 267 21 L 274 21 L 274 27 L 286 27 L 286 21 L 293 21 L 293 27 L 300 27 L 300 22 L 308 22 L 308 28 L 303 31 L 305 45 L 315 45 L 315 50 L 308 54 L 316 150 Z"
          fill="url(#${uid}-tower-sil)" stroke="url(#${uid}-brass)" stroke-width="1.2" stroke-linejoin="round"/>
    <!-- Chiseled Masonry Courses on Watchtower -->
    <path d="M 255 34 H 305 M 254 40 H 306 M 252 58 H 308 M 251 66 H 309" stroke="#080e1d" stroke-width="0.9" opacity="0.7"/>
    <path d="M 275 42 A 5 5 0 0 1 285 42 L 285 52 L 275 52 Z" fill="#060c1a" stroke="${accentCyan}" stroke-width="0.95"/>
    <rect x="292" y="34" width="5" height="9" rx="1" fill="#ffbe3b"/>
    <circle cx="264" cy="48" r="2.2" fill="#fb923c"/>
    <path d="M 264 23 C 264 11, 271 6, 276 5 M 296 23 C 296 11, 289 6, 284 5" fill="none" stroke="url(#${uid}-brass)" stroke-width="2" stroke-linecap="round"/>
    <circle cx="280" cy="21" r="21" fill="url(#${uid}-star-glow)"/>
    <path d="${starCoreCrown}" fill="url(#${uid}-cyan)" stroke="#ffffff" stroke-width="0.7"/>
    <path d="${starCoreInner}" fill="#ffffff"/>
  </g>

  <!-- Sculpted 3D-Extruded Chiseled Stone & Steel Display Lettering -->
  ${towerWordSvg}
  ${topplerWordSvg}

  <!-- Lower Forged-Brass & Obsidian Scroll Ribbon -->
  <g class="crest-scroll-ribbon">
    <polygon points="86,156 122,152 122,181 86,185 98,170.5" fill="#091122" stroke="url(#${uid}-brass)" stroke-width="1.5" stroke-linejoin="round"/>
    <polygon points="474,156 438,152 438,181 474,185 462,170.5" fill="#091122" stroke="url(#${uid}-brass)" stroke-width="1.5" stroke-linejoin="round"/>
    <polygon points="114,179 124,179 124,186" fill="#03060d"/>
    <polygon points="446,179 436,179 436,186" fill="#03060d"/>

    <polygon points="124,148 436,148 448,164 436,180 124,180 112,164"
             fill="url(#${uid}-ribbon-bg)" stroke="url(#${uid}-brass)" stroke-width="2.1" stroke-linejoin="round"/>
    <polygon points="128,151.5 432,151.5 441.5,164 432,176.5 128,176.5 118.5,164"
             fill="none" stroke="${accentCyan}" stroke-width="0.75" stroke-opacity="0.55"/>

    <circle cx="129" cy="164" r="2.3" fill="url(#${uid}-brass)"/>
    <circle cx="431" cy="164" r="2.3" fill="url(#${uid}-brass)"/>

    <text x="280" y="168.5" text-anchor="middle"
          font-family="'Orbitron', 'Rajdhani', sans-serif" font-size="13.2" font-weight="800"
          letter-spacing="3.2" fill="${isOriginal ? '#ffe600' : '#eaf6ff'}"
          stroke="#040812" stroke-width="2.4" paint-order="stroke fill">${ribbonLabel}</text>
  </g>
</svg>`.trim();
}

// ============================================================================
// 2. HERO PLAY MEDALLION FRAME — getPlayMedallionSVG(era = 'reboot')
// ============================================================================

export function getPlayMedallionSVG(era = 'reboot') {
  const isOriginal = era === 'original';
  const uid = nextUid('playmed');
  const cyan = isOriginal ? '#00f0ff' : '#63f5ff';
  const gold = isOriginal ? '#ffe600' : '#fbbf24';

  const gearL = buildClockworkGearPath(46, 55, 33, 28.5, 24, 13, 7, 14, 5, 12);
  const gearLSmall = buildClockworkGearPath(78, 25, 13.5, 11, 8.5, 5, 2.6, 9, 0, 20);
  const gearR = buildClockworkGearPath(334, 55, 33, 28.5, 24, 13, 7, 14, 5, -12);
  const gearRSmall = buildClockworkGearPath(302, 25, 13.5, 11, 8.5, 5, 2.6, 9, 0, -20);
  const centerTicks = buildDegreeTicksPath(190, 55, 42, 47, 36, 3, 0);

  return `
<svg class="play-medallion-svg ${isOriginal ? 'era-original' : 'era-reboot'}" viewBox="0 0 380 110" preserveAspectRatio="none" style="position:absolute;inset:0;width:100%;height:100%;z-index:-1;pointer-events:none;" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <defs>
    <linearGradient id="${uid}-brass" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${isOriginal ? '#fff7b2' : '#ffe9a6'}"/>
      <stop offset="28%" stop-color="${isOriginal ? '#facc15' : '#d99b38'}"/>
      <stop offset="58%" stop-color="${isOriginal ? '#a16207' : '#744612'}"/>
      <stop offset="84%" stop-color="${isOriginal ? '#fde047' : '#ca8c2e'}"/>
      <stop offset="100%" stop-color="#3d2308"/>
    </linearGradient>

    <linearGradient id="${uid}-plate" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="${isOriginal ? '#172554' : '#13223d'}"/>
      <stop offset="50%" stop-color="${isOriginal ? '#0b132b' : '#081122'}"/>
      <stop offset="100%" stop-color="${isOriginal ? '#1e1b4b' : '#0d1b33'}"/>
    </linearGradient>

    <radialGradient id="${uid}-core-glow" cx="50%" cy="50%" r="55%">
      <stop offset="0%" stop-color="${cyan}" stop-opacity="0.22"/>
      <stop offset="65%" stop-color="${gold}" stop-opacity="0.08"/>
      <stop offset="100%" stop-color="#050a14" stop-opacity="0"/>
    </radialGradient>
  </defs>

  <polygon points="34,6 346,6 374,55 346,104 34,104 6,55"
           fill="#040812" stroke="url(#${uid}-brass)" stroke-width="3" stroke-linejoin="round"/>
  <polygon points="38,11 342,11 367,55 342,99 38,99 13,55"
           fill="url(#${uid}-plate)" stroke="${cyan}" stroke-width="1.15" stroke-opacity="0.65" stroke-linejoin="round"/>
  <ellipse cx="190" cy="55" rx="152" ry="42" fill="url(#${uid}-core-glow)"/>

  <g opacity="0.34">
    <path d="${centerTicks}" stroke="${gold}" stroke-width="1" stroke-linecap="round"/>
    <path d="M 78 55 L 122 55 M 258 55 L 302 55" stroke="${cyan}" stroke-width="1" stroke-dasharray="4 3"/>
    <circle cx="190" cy="55" r="40" fill="none" stroke="url(#${uid}-brass)" stroke-width="0.9" stroke-dasharray="10 5"/>
  </g>

  <g transform="translate(46,55) scale(0.78,1) translate(-46,-55)">
    <path d="${gearLSmall}" fill="url(#${uid}-brass)" fill-rule="evenodd" opacity="0.72" stroke="#060b16" stroke-width="0.8"/>
    <path d="${gearL}" fill="url(#${uid}-brass)" fill-rule="evenodd" stroke="#060b16" stroke-width="1.1"/>
    <circle cx="46" cy="55" r="5.2" fill="${cyan}" stroke="#ffffff" stroke-width="0.8"/>
    <polygon points="82,55 69,49.5 72,55 69,60.5" fill="${gold}"/>
  </g>
  <g transform="translate(334,55) scale(0.78,1) translate(-334,-55)">
    <path d="${gearRSmall}" fill="url(#${uid}-brass)" fill-rule="evenodd" opacity="0.72" stroke="#060b16" stroke-width="0.8"/>
    <path d="${gearR}" fill="url(#${uid}-brass)" fill-rule="evenodd" stroke="#060b16" stroke-width="1.1"/>
    <circle cx="334" cy="55" r="5.2" fill="${cyan}" stroke="#ffffff" stroke-width="0.8"/>
    <polygon points="298,55 311,49.5 308,55 311,60.5" fill="${gold}"/>
  </g>

  <polygon points="190,2 197,9 190,15 183,9" fill="${cyan}" stroke="url(#${uid}-brass)" stroke-width="1.2"/>
  <polygon points="190,95 197,101 190,108 183,101" fill="${gold}" stroke="url(#${uid}-brass)" stroke-width="1.2"/>
  <circle cx="43" cy="17" r="2" fill="url(#${uid}-brass)"/>
  <circle cx="337" cy="17" r="2" fill="url(#${uid}-brass)"/>
  <circle cx="43" cy="93" r="2" fill="url(#${uid}-brass)"/>
  <circle cx="337" cy="93" r="2" fill="url(#${uid}-brass)"/>
</svg>`.trim();
}

// ============================================================================
// 3. EXPEDITION SPIRE DIORAMAS — getExpeditionArtSVG(modeId, era = 'reboot')
// ============================================================================

export function getExpeditionArtSVG(modeId = 'daily', era = 'reboot') {
  const isOriginal = era === 'original';
  const norm = String(modeId || 'daily').toLowerCase();
  const kind = norm.includes('casual') ? 'casual' : norm.includes('endless') ? 'endless' : 'daily';
  const uid = nextUid(`exp-${kind}`);

  let skyStops = '';
  let sceneBody = '';

  if (kind === 'daily') {
    const clockGear = buildClockworkGearPath(110, 74, 52, 47.5, 42, 26, 20, 24, 6, 7.5);
    const compassGear = buildClockworkGearPath(110, 162, 20, 17, 13.5, 7, 3.5, 12, 4, 0);
    const dialTicks = buildDegreeTicksPath(110, 74, 55, 61, 24, 0, 0);
    const compassStar = buildStarBurstPath(110, 162, 16, 3.8, 4, 0);

    skyStops = `
      <stop offset="0%" stop-color="${isOriginal ? '#07143a' : '#040a18'}"/>
      <stop offset="48%" stop-color="${isOriginal ? '#1d4ed8' : '#0f2747'}"/>
      <stop offset="100%" stop-color="${isOriginal ? '#0a2342' : '#1b496e'}"/>
    `;

    sceneBody = `
      <!-- Silver-Rimmed Moonlit Storm Cloud Banks -->
      <path d="M 0 58 Q 38 42 74 54 T 156 48 T 220 58 L 220 98 L 0 98 Z" fill="#132645" opacity="0.72"/>
      <path d="M 0 58 Q 38 42 74 54 T 156 48 T 220 58" fill="none" stroke="#93c5fd" stroke-width="1" opacity="0.38"/>

      <!-- Celestial UTC Solar-Lunar Astrolabe Halo -->
      <circle cx="110" cy="74" r="64" fill="url(#${uid}-focal-glow)"/>
      <path d="${dialTicks}" stroke="#fbbf24" stroke-width="1.2" stroke-linecap="round" opacity="0.82"/>
      <path d="${clockGear}" fill="url(#${uid}-brass)" fill-rule="evenodd" opacity="0.82" stroke="#060c18" stroke-width="0.8"/>
      <circle cx="110" cy="74" r="22" fill="#e2e8f0"/>
      <circle cx="117" cy="70" r="18.5" fill="#0b1d38"/>

      <!-- Sweeping Volumetric Lighthouse Beams -->
      <polygon points="110,64 4,32 4,68" fill="#7be8ff" opacity="0.18"/>
      <polygon points="110,64 216,32 216,68" fill="#fde047" opacity="0.16"/>

      <!-- Chiseled 20F Watchtower Monolith + Masonry Courses + Romanesque Corbels -->
      <path d="M 74 186 L 84 66 L 78 62 L 78 56 L 91 56 L 93 48 L 127 48 L 129 56 L 142 56 L 142 62 L 136 66 L 146 186 Z"
            fill="url(#${uid}-monolith)" stroke="#050a14" stroke-width="1.4"/>
      <path d="M 83 78 H 137 M 81 94 H 139 M 79 110 H 141 M 78 126 H 142 M 76 142 H 144 M 75 158 H 145"
            stroke="#080e1d" stroke-width="1.1" opacity="0.72"/>
      <path d="M 84 66 L 74 186" stroke="#93c5fd" stroke-width="1.1" opacity="0.45"/>

      <!-- Romanesque Curved Ledges & Furnace Pipe -->
      <path d="M 66 94 H 116 C 114 100, 108 103, 102 104 H 74 C 70 101, 67 98, 66 94 Z" fill="#3b4c73" stroke="#93c5fd" stroke-width="0.7"/>
      <path d="M 100 120 H 154 C 152 126, 146 129, 140 130 H 106 Z" fill="#324166" stroke="#7be8ff" stroke-width="0.7"/>
      <path d="M 64 146 H 114 C 111 152, 105 154, 98 155 H 72 Z" fill="#3b4c73" stroke="#93c5fd" stroke-width="0.7"/>

      <!-- Golden Cage Lift, Misty Cyan Doorway & Heroic Pogo Silhouette -->
      <circle cx="125" cy="105" r="12" fill="#fbbf24" opacity="0.28"/>
      <rect x="120" y="98" width="10" height="14" rx="1.5" fill="#ffbe3b" stroke="#fffbeb" stroke-width="0.8"/>
      <path d="M 95 72 A 4.5 4.5 0 0 1 104 72 V 83 H 95 Z" fill="#071529" stroke="#63f5ff" stroke-width="1"/>
      <path d="M 102 132 A 5 5 0 0 1 112 132 V 146 H 102 Z" fill="#071529" stroke="#63f5ff" stroke-width="1"/>
      <circle cx="84" cy="89" r="3.6" fill="#4ade80"/>

      <!-- Bioluminescent Firefly Motes -->
      <circle cx="42" cy="86" r="2.2" fill="#5efce8"/>
      <circle cx="54" cy="118" r="1.7" fill="#42f5aa"/>
      <circle cx="168" cy="92" r="2.4" fill="#5efce8"/>
      <circle cx="176" cy="128" r="1.8" fill="#fde047"/>

      <!-- Multi-Layered Storm Swells, Whitewater Surf Plumes & Brass Meridian Compass -->
      <path d="M 56 172 C 62 154, 70 152, 78 168 M 164 172 C 158 154, 150 152, 142 168" fill="none" stroke="#e0f2fe" stroke-width="2.6" stroke-linecap="round" opacity="0.78"/>
      <path d="M 0 166 Q 38 154 76 166 T 152 165 T 220 164 L 220 250 L 0 250 Z" fill="#09233f"/>
      <path d="M 0 176 Q 45 166 90 176 T 180 174 T 220 177" fill="none" stroke="#bae6fd" stroke-width="1.8" opacity="0.65"/>
      <path d="${compassGear}" fill="url(#${uid}-brass)" fill-rule="evenodd" stroke="#050914" stroke-width="1"/>
      <path d="${compassStar}" fill="#7be8ff" stroke="#ffffff" stroke-width="0.7"/>
    `;
  } else if (kind === 'endless') {
    const vortexTicks = buildDegreeTicksPath(110, 68, 46, 54, 32, 0, 11);
    const coreStar = buildStarBurstPath(110, 68, 15, 4.5, 6, 15);

    skyStops = `
      <stop offset="0%" stop-color="#050412"/>
      <stop offset="46%" stop-color="${isOriginal ? '#3b0764' : '#1d113b'}"/>
      <stop offset="100%" stop-color="#0b2842"/>
    `;

    sceneBody = `
      <!-- Brooding Storm Clouds & Infinity Vortex -->
      <path d="M 0 52 Q 55 34 110 48 T 220 44 L 220 88 L 0 88 Z" fill="#150d30" opacity="0.78"/>
      <circle cx="110" cy="68" r="66" fill="url(#${uid}-focal-glow)"/>
      <ellipse cx="110" cy="68" rx="56" ry="34" transform="rotate(-18 110 68)" fill="none" stroke="#c026ff" stroke-width="2.2" stroke-dasharray="16 6" opacity="0.78"/>
      <ellipse cx="110" cy="68" rx="42" ry="24" transform="rotate(22 110 68)" fill="none" stroke="#5ef2ff" stroke-width="1.9" stroke-dasharray="12 5" opacity="0.88"/>
      <path d="${vortexTicks}" stroke="#e879f9" stroke-width="1" opacity="0.6"/>

      <!-- Glowing Infinity Conduit -->
      <path d="M 110 68 C 96 50, 66 52, 66 68 C 66 84, 96 86, 110 68 C 124 50, 154 52, 154 68 C 154 84, 124 86, 110 68 Z"
            fill="none" stroke="#63f5ff" stroke-width="3.6" stroke-linecap="round"/>
      <path d="M 110 68 C 96 50, 66 52, 66 68 C 66 84, 96 86, 110 68 C 124 50, 154 52, 154 68 C 154 84, 124 86, 110 68 Z"
            fill="none" stroke="#ffffff" stroke-width="1.2"/>
      <path d="${coreStar}" fill="#f0abfc" stroke="#ffffff" stroke-width="0.6"/>

      <!-- Multi-Forked Storm Lightning -->
      <polyline points="42,14 58,40 49,44 68,76" fill="none" stroke="#e0f2fe" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
      <polyline points="58,40 40,58" fill="none" stroke="#7be8ff" stroke-width="1.1"/>
      <polyline points="178,18 162,42 170,46 152,78" fill="none" stroke="#f5d0fe" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>

      <!-- Receding Horizon Spires + Fractured Central Abyssal Monolith -->
      <polygon points="22,174 27,122 40,122 45,174" fill="#0e162e" opacity="0.68"/>
      <polygon points="48,176 54,104 70,104 76,176" fill="#162140" opacity="0.82"/>
      <polygon points="144,176 150,100 166,100 172,176" fill="#162140" opacity="0.82"/>
      <polygon points="176,174 181,120 194,120 198,174" fill="#0e162e" opacity="0.68"/>

      <path d="M 80 184 L 90 86 L 130 86 L 140 184 Z" fill="url(#${uid}-monolith)" stroke="#060914" stroke-width="1.4"/>
      <path d="M 88 104 H 132 M 86 122 H 134 M 84 140 H 136 M 82 158 H 138" stroke="#080d1c" stroke-width="1.1" opacity="0.72"/>
      <path d="M 74 114 H 104 L 100 120 H 78 Z M 116 136 H 146 L 142 142 H 120 Z" fill="#323d66" stroke="#c084fc" stroke-width="0.7"/>

      <!-- Amethyst & Cyan Reactor Rift Climbing Up Monolith -->
      <polyline points="104,178 114,150 105,128 116,106 110,86" fill="none" stroke="#c026ff" stroke-width="4.2" stroke-linecap="round" stroke-linejoin="round" opacity="0.55"/>
      <polyline points="104,178 114,150 105,128 116,106 110,86" fill="none" stroke="#63f5ff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>

      <!-- Colossal Swirling Abyssal Whirlpool -->
      <ellipse cx="110" cy="180" rx="98" ry="25" fill="#051326" stroke="#38bdf8" stroke-width="1.4" stroke-dasharray="20 6"/>
      <ellipse cx="110" cy="181" rx="70" ry="16" fill="none" stroke="#c084fc" stroke-width="1.5" stroke-dasharray="14 5"/>
      <ellipse cx="110" cy="182" rx="42" ry="9" fill="none" stroke="#bae6fd" stroke-width="1.3" stroke-dasharray="9 4"/>
      <ellipse cx="110" cy="183" rx="18" ry="4.5" fill="#5ef2ff" opacity="0.65"/>
    `;
  } else {
    const craftGear = buildClockworkGearPath(76, 162, 16, 13, 10.5, 5.5, 2.8, 10, 4, 15);
    const smallGear = buildClockworkGearPath(96, 168, 9.5, 7.8, 6, 3.2, 1.6, 8, 0, 8);
    const beaconStar = buildStarBurstPath(110, 54, 18, 5, 8, 0);

    skyStops = `
      <stop offset="0%" stop-color="#051622"/>
      <stop offset="50%" stop-color="#0d3547"/>
      <stop offset="100%" stop-color="#155263"/>
    `;

    sceneBody = `
      <!-- Bioluminescent Aurora Curtains & Veiled Full Moon -->
      <path d="M 8 62 Q 62 24 112 50 T 212 38 L 212 92 Q 156 108 108 82 T 8 96 Z"
            fill="url(#${uid}-aurora)" opacity="0.58"/>
      <circle cx="166" cy="46" r="19" fill="#fef9c3" opacity="0.9"/>
      <circle cx="161" cy="42" r="4" fill="#fde68a" opacity="0.55"/>
      <circle cx="110" cy="54" r="48" fill="url(#${uid}-focal-glow)"/>

      <!-- Moss-Draped Sanctuary Lighthouse Spire + Masonry + Terrace -->
      <path d="M 76 180 L 87 66 L 133 66 L 144 180 Z" fill="url(#${uid}-monolith)" stroke="#06101c" stroke-width="1.4"/>
      <path d="M 86 84 H 134 M 84 102 H 136 M 82 120 H 138 M 80 138 H 140" stroke="#081221" stroke-width="1.1" opacity="0.68"/>
      <rect x="92" y="48" width="36" height="18" rx="3" fill="#422006" stroke="url(#${uid}-brass)" stroke-width="1.5"/>
      <polygon points="86,48 110,32 134,48" fill="url(#${uid}-brass)" stroke="#06101c" stroke-width="1.1"/>
      <path d="${beaconStar}" fill="#fde047"/>

      <!-- Warm Lantern Tinker Workbench Archway & Moss -->
      <circle cx="110" cy="140" r="18" fill="#fbbf24" opacity="0.28"/>
      <path d="M 100 132 A 10 10 0 0 1 120 132 V 152 H 100 Z" fill="#fef3c7" stroke="url(#${uid}-brass)" stroke-width="1.3"/>
      <path d="M 68 152 H 152 L 146 159 H 74 Z" fill="#2d4a5e" stroke="#6bf2ff" stroke-width="0.7"/>
      <path d="M 84 96 Q 96 106 108 95 Q 120 105 135 96 L 136 103 Q 118 112 106 103 Q 94 111 83 103 Z" fill="#34d399" opacity="0.72"/>

      <!-- Firefly Constellations -->
      <circle cx="42" cy="82" r="2.5" fill="#6bf2ff"/>
      <circle cx="58" cy="112" r="2" fill="#42f5aa"/>
      <circle cx="166" cy="94" r="2.6" fill="#fde047"/>
      <circle cx="154" cy="122" r="2.1" fill="#6bf2ff"/>
      <circle cx="48" cy="140" r="1.8" fill="#fde047"/>

      <!-- Calm Tidepool + Golden Gears + Sunken Treasure Chest + Prism Curio -->
      <path d="M 0 168 Q 55 161 110 168 T 220 168 L 220 250 L 0 250 Z" fill="#072233"/>
      <ellipse cx="110" cy="175" rx="64" ry="7" fill="#fde047" opacity="0.24"/>
      <path d="${craftGear}" fill="url(#${uid}-brass)" fill-rule="evenodd" stroke="#050c16" stroke-width="0.9"/>
      <path d="${smallGear}" fill="url(#${uid}-brass)" fill-rule="evenodd" stroke="#050c16" stroke-width="0.8"/>
      <rect x="114" y="154" width="20" height="14" rx="2" fill="#78350f" stroke="url(#${uid}-brass)" stroke-width="1.2"/>
      <circle cx="124" cy="161" r="2" fill="#fde047"/>
      <polygon points="148,140 159,151 154,168 142,168 137,151" fill="#5efce8" stroke="#ffffff" stroke-width="1"/>
      <path d="M148 140 L148 168 M137 151 L159 151" stroke="#0d9488" stroke-width="0.9" fill="none"/>
    `;
  }

  const focalColor = kind === 'endless' ? '#c026ff' : kind === 'casual' ? '#fbbf24' : '#5ef2ff';

  return `
<svg class="spire-art-bg spire-art-${kind}" viewBox="0 0 220 250" preserveAspectRatio="xMidYMid slice" style="position:absolute;inset:1.6px;width:calc(100% - 3.2px);height:calc(100% - 3.2px);z-index:1;clip-path:var(--poly-spire-arch,none);pointer-events:none;" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <defs>
    <linearGradient id="${uid}-sky" x1="0%" y1="0%" x2="0%" y2="100%">
      ${skyStops}
    </linearGradient>

    <radialGradient id="${uid}-focal-glow" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="${focalColor}" stop-opacity="0.54"/>
      <stop offset="55%" stop-color="#38bdf8" stop-opacity="0.18"/>
      <stop offset="100%" stop-color="#040812" stop-opacity="0"/>
    </radialGradient>

    <linearGradient id="${uid}-aurora" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#34d399" stop-opacity="0.15"/>
      <stop offset="50%" stop-color="#5efce8" stop-opacity="0.88"/>
      <stop offset="100%" stop-color="#fde047" stop-opacity="0.25"/>
    </linearGradient>

    <linearGradient id="${uid}-monolith" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#455582"/>
      <stop offset="45%" stop-color="#242c4c"/>
      <stop offset="100%" stop-color="#0b1122"/>
    </linearGradient>

    <linearGradient id="${uid}-brass" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#ffe89e"/>
      <stop offset="45%" stop-color="#d99b38"/>
      <stop offset="100%" stop-color="#6b3f10"/>
    </linearGradient>

    <linearGradient id="${uid}-veil" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#040812" stop-opacity="0"/>
      <stop offset="60%" stop-color="#040812" stop-opacity="0.3"/>
      <stop offset="82%" stop-color="#040812" stop-opacity="0.86"/>
      <stop offset="100%" stop-color="#03060e" stop-opacity="0.96"/>
    </linearGradient>
  </defs>

  <rect width="220" height="250" fill="url(#${uid}-sky)"/>
  ${sceneBody}

  <rect width="220" height="250" fill="url(#${uid}-veil)"/>

  <path d="M 7 243 L 7 88 Q 7 24 110 7 Q 213 24 213 88 L 213 243 Z"
        fill="none" stroke="url(#${uid}-brass)" stroke-width="2" opacity="0.74"/>
  <path d="M 12 238 L 12 90 Q 12 31 110 14 Q 208 31 208 90 L 208 238 Z"
        fill="none" stroke="#63f5ff" stroke-width="0.75" opacity="0.4"/>
  <polygon points="110,3 115,11 110,19 105,11" fill="#63f5ff" stroke="url(#${uid}-brass)" stroke-width="0.9"/>
</svg>`.trim();
}

// ============================================================================
// 4. MINI-GAME PORTAL VIGNETTES — getMinigamePortalSVG(gameId, era = 'reboot')
// ============================================================================

export function getMinigamePortalSVG(gameId = 'submarine', era = 'reboot') {
  const isOriginal = era === 'original';
  const raw = String(gameId || 'submarine').toLowerCase();
  const id = raw.includes('glide')
    ? 'glide'
    : raw.includes('skim')
    ? 'skimmer'
    : raw.includes('puz') || raw.includes('rune')
    ? 'puzzle'
    : raw.includes('vault') || raw.includes('core')
    ? 'vault'
    : 'submarine';

  const uid = nextUid(`mg-${id}`);
  let scene = '';

  if (id === 'submarine') {
    const subBodyFill = isOriginal ? '#facc15' : '#253552';
    const subTrim = isOriginal ? '#ca8a04' : '#d99b38';
    scene = `
      <rect width="380" height="132" fill="url(#${uid}-bg)"/>
      <!-- Dancing Volumetric Moon-Shaft God-Rays -->
      <polygon points="45,0 98,0 148,132 72,132" fill="#5efce8" opacity="0.08"/>
      <polygon points="168,0 226,0 292,132 208,132" fill="#7be8ff" opacity="0.1"/>
      <polygon points="278,0 318,0 368,132 318,132" fill="#5efce8" opacity="0.06"/>

      <!-- Seabed Ridge & Voronoi Caustic Net -->
      <path d="M 0 112 Q 70 100 145 110 T 290 106 T 380 112 L 380 132 L 0 132 Z" fill="#061729"/>
      <path d="M 24 118 Q 62 112 98 120 T 176 117 T 258 121" fill="none" stroke="#5efce8" stroke-width="0.9" opacity="0.32"/>

      <!-- Beveled-Block Sunken Watchtower Archway & Staghorn Reef -->
      <path d="M 276 126 L 282 28 L 368 28 L 374 126 L 344 126 L 344 70 A 20 20 0 0 0 304 70 L 304 126 Z"
            fill="#0e2038" stroke="#3b5e85" stroke-width="1.3"/>
      <path d="M 280 42 H 369 M 279 56 H 370 M 278 70 H 304 M 344 70 H 371 M 277 88 H 304 M 344 88 H 372" stroke="#071120" stroke-width="1"/>
      <path d="M 284 124 C 284 108, 272 98, 266 88 M 284 114 C 292 104, 298 96, 300 88 M 352 124 C 352 110, 360 100, 366 92"
            fill="none" stroke="#f472b6" stroke-width="2.6" stroke-linecap="round"/>
      <path d="M 284 124 C 284 108, 272 98, 266 88" fill="none" stroke="#fbcfe8" stroke-width="0.9" stroke-linecap="round"/>

      <!-- Chained Horned Sea Mine -->
      <line x1="232" y1="34" x2="232" y2="112" stroke="#284b70" stroke-width="1.4" stroke-dasharray="3 2"/>
      <circle cx="232" cy="27" r="8.5" fill="#17253d" stroke="#64748b" stroke-width="1.2"/>
      <path d="M 232 15 V 19 M 232 35 V 39 M 220 27 H 224 M 240 27 H 244 M 223 18 L 226 21 M 241 36 L 238 33 M 241 18 L 238 21 M 223 36 L 226 33" stroke="#94a3b8" stroke-width="1.4" stroke-linecap="round"/>

      <!-- Volumetric Twin-Cone Headlight Beam -->
      <polygon points="148,57 354,18 354,116 148,68" fill="url(#${uid}-beam)"/>
      <polygon points="148,60 318,38 318,92 148,65" fill="url(#${uid}-beam)" opacity="0.65"/>

      <!-- Sinuous Subsurface-Lit Giant Kelp Forest -->
      <path d="M 22 132 C 14 102, 32 82, 20 48 C 30 76, 40 100, 32 132 Z" fill="#0f766e" opacity="0.62"/>
      <path d="M 198 132 C 188 102, 210 80, 196 46 C 208 74, 218 98, 208 132 Z" fill="#0d9488" stroke="#5efce8" stroke-width="0.85" opacity="0.88"/>
      <path d="M 214 132 C 206 108, 226 88, 216 60 C 226 84, 232 106, 224 132 Z" fill="#115e59" stroke="#2dd4bf" stroke-width="0.75" opacity="0.84"/>

      <!-- Bioluminescent Anglerfish + Boid Fish School + Cryo-Bubbles -->
      <g transform="translate(260, 70)">
        <path d="M 20 0 C 10 -13, -12 -12, -22 -2 L -13 2 L -21 6 C -11 13, 10 12, 20 0 Z" fill="#1e3a8a" stroke="#63f5ff" stroke-width="1.3" stroke-linejoin="round"/>
        <polygon points="18,0 29,-8 26,0 29,8" fill="#38bdf8"/>
        <path d="M -14 0 L -18 -2 M -16 4 L -19 2" stroke="#ffffff" stroke-width="1.1" stroke-linecap="round"/>
        <path d="M -10 -8 C -18 -20, -30 -18, -30 -8" fill="none" stroke="#7be8ff" stroke-width="1.3"/>
        <circle cx="-30" cy="-7" r="7.5" fill="#5efce8" opacity="0.38"/>
        <circle cx="-30" cy="-7" r="3.4" fill="#ffffff"/>
        <circle cx="-11" cy="-3" r="2.2" fill="#fde047"/>
      </g>
      <!-- Ambient Boid School -->
      <ellipse cx="182" cy="40" rx="4" ry="1.8" fill="#67e8f9" opacity="0.7"/>
      <ellipse cx="192" cy="44" rx="3.5" ry="1.6" fill="#67e8f9" opacity="0.6"/>
      <ellipse cx="175" cy="46" rx="3.2" ry="1.5" fill="#67e8f9" opacity="0.55"/>
      <circle cx="190" cy="58" r="4.8" fill="rgba(165,243,252,0.16)" stroke="#a5f3fc" stroke-width="1.1"/>
      <circle cx="174" cy="70" r="3" fill="rgba(165,243,252,0.16)" stroke="#a5f3fc" stroke-width="1"/>

      <!-- MK.7 Manta-Bathysphere + Explorer Pogo in Clear Nose Dome -->
      <g transform="translate(96, 61)">
        <ellipse cx="-46" cy="2" rx="3.5" ry="9" fill="none" stroke="#63f5ff" stroke-width="1.3" opacity="0.75"/>
        <path d="M -74 -3 L -42 -1 M -84 3 L -44 3 M -68 9 L -40 7" stroke="#63f5ff" stroke-width="1.8" stroke-linecap="round" opacity="0.8"/>
        <path d="M -42 2 L -24 -14 L 18 -13 C 38 -13, 52 -5, 54 3 C 52 11, 36 15, 14 15 L -28 12 Z"
              fill="${subBodyFill}" stroke="${subTrim}" stroke-width="1.7" stroke-linejoin="round"/>
        <path d="M -22 3 L -6 14 L 12 11 Z" fill="#17253d" stroke="${subTrim}" stroke-width="1.1"/>
        <path d="M -12 -13 L -4 -23 L 10 -23 L 14 -13" fill="${subBodyFill}" stroke="${subTrim}" stroke-width="1.4"/>
        <path d="M 22 -10 C 40 -10, 51 -4, 52 3 C 51 9, 40 12, 22 12 Z" fill="rgba(123,232,255,0.3)" stroke="#bae6fd" stroke-width="1.2"/>
        <circle cx="34" cy="1" r="5.2" fill="#4ade80"/>
        <circle cx="36" cy="-0.5" r="1.4" fill="#050b16"/>
        <circle cx="52" cy="1" r="3.2" fill="#ffffff"/>
        <circle cx="48" cy="6" r="2.2" fill="#7be8ff"/>
      </g>
    `;
  } else if (id === 'glide') {
    const gateRing = buildClockworkGearPath(222, 44, 19, 17, 14.5, 13, 12.5, 12, 0, 10);
    scene = `
      <rect width="380" height="132" fill="url(#${uid}-bg)"/>
      <!-- Giant Cratered Moon + Silver-Rimmed Storm Cloud Banks -->
      <circle cx="316" cy="36" r="44" fill="url(#${uid}-focal)"/>
      <circle cx="316" cy="36" r="25" fill="#e2e8f0"/>
      <circle cx="307" cy="29" r="5" fill="#94a3b8" opacity="0.65"/>
      <circle cx="324" cy="41" r="6.5" fill="#94a3b8" opacity="0.55"/>
      <path d="M 252 46 Q 286 33 318 43 T 380 39 L 380 58 L 252 58 Z" fill="#142440" opacity="0.86"/>
      <path d="M 252 46 Q 286 33 318 43 T 380 39" fill="none" stroke="#bae6fd" stroke-width="1.1" opacity="0.55"/>

      <!-- Colossal Archipelago Watchtowers & Sweeping Lighthouse Beams -->
      <polygon points="268,48 164,20 164,42" fill="#fde047" opacity="0.16"/>
      <polygon points="262,106 265,46 273,46 276,106" fill="#172746" stroke="#334e78" stroke-width="0.8"/>
      <circle cx="269" cy="47" r="2.8" fill="#fde047"/>
      <polygon points="342,106 345,62 351,62 354,106" fill="#111d36"/>
      <circle cx="348" cy="63" r="1.8" fill="#63f5ff"/>

      <!-- Churning Storm Ocean & Wet-Basalt Sea-Stack Arch -->
      <path d="M 0 100 Q 95 92 190 100 T 380 98 L 380 132 L 0 132 Z" fill="#07192e"/>
      <ellipse cx="314" cy="108" rx="34" ry="4" fill="#cbd5e1" opacity="0.22"/>
      <path d="M 180 116 L 191 62 L 220 53 L 246 66 L 256 116 L 235 116 L 231 85 A 13 13 0 0 0 205 85 L 201 116 Z"
            fill="#1c2a48" stroke="#587099" stroke-width="1.2"/>
      <path d="M 174 115 Q 190 108 204 115 M 232 115 Q 246 108 262 115" fill="none" stroke="#e0f2fe" stroke-width="2" stroke-linecap="round" opacity="0.72"/>

      <!-- Brass-and-Cyan Celestial Ring Gate & Warm Storm Lanterns -->
      <g transform="translate(222, 44) scale(0.66, 1.05) translate(-222, -44)">
        <path d="${gateRing}" fill="url(#${uid}-brass)" fill-rule="evenodd" stroke="#060c18" stroke-width="0.9"/>
        <circle cx="222" cy="44" r="12.5" fill="rgba(99,245,255,0.2)" stroke="#63f5ff" stroke-width="1.4"/>
      </g>

      <path d="M 132 94 Q 178 76 222 44 T 302 68" fill="none" stroke="#5efce8" stroke-width="1.4" stroke-dasharray="4 4" opacity="0.82"/>
      <g>
        <circle cx="168" cy="76" r="10" fill="#fbbf24" opacity="0.32"/>
        <rect x="165" y="72" width="6" height="8" rx="1.5" fill="#fef08a" stroke="#d97706" stroke-width="0.9"/>
        <circle cx="286" cy="70" r="11" fill="#fbbf24" opacity="0.34"/>
        <rect x="283" y="66" width="6" height="8" rx="1.5" fill="#fef08a" stroke="#d97706" stroke-width="0.9"/>
      </g>

      <!-- Pogo's Stitched-Canvas & Brass Sky-Wing + Cryo-Cyan Wingtip Ribbons -->
      <path d="M 14 52 Q 48 38 74 45 M 26 78 Q 68 68 116 61" fill="none" stroke="#63f5ff" stroke-width="2" stroke-linecap="round" opacity="0.86"/>
      <g transform="translate(114, 47) rotate(-8)">
        <polygon points="-14,6 -28,10 -12,11" fill="#63f5ff"/>
        <polygon points="-48,-2 4,-23 54,4 8,4 -6,15" fill="#e2e8f0" stroke="url(#${uid}-brass)" stroke-width="1.7" stroke-linejoin="round"/>
        <polygon points="-48,-2 4,-23 6,-2" fill="#94a3b8"/>
        <path d="M -22 -12 L -12 0 M 24 -12 L 20 3" stroke="#64748b" stroke-width="0.9"/>
        <line x1="4" y1="-23" x2="6" y2="12" stroke="url(#${uid}-brass)" stroke-width="2"/>
        <circle cx="4" cy="11" r="5" fill="#4ade80" stroke="#06101e" stroke-width="1"/>
      </g>
    `;
  } else if (id === 'skimmer') {
    const gateGear = buildClockworkGearPath(286, 64, 44, 39, 34, 30, 29, 18, 0, 10);
    const subGear = buildClockworkGearPath(244, 94, 13, 10.8, 8.5, 4.5, 2.2, 9, 0, 15);
    scene = `
      <rect width="380" height="132" fill="url(#${uid}-bg)"/>
      <!-- Diagonal Driving Storm Rain & Forked Lightning -->
      <g stroke="#93c5fd" stroke-width="0.7" opacity="0.22">
        <line x1="42" y1="0" x2="18" y2="54"/><line x1="96" y1="0" x2="72" y2="54"/>
        <line x1="148" y1="0" x2="124" y2="54"/><line x1="218" y1="0" x2="194" y2="54"/>
        <line x1="342" y1="0" x2="318" y2="54"/>
      </g>
      <polyline points="182,0 166,28 178,31 154,66" fill="none" stroke="#ffffff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
      <polyline points="166,28 148,48" fill="none" stroke="#63f5ff" stroke-width="1.3" stroke-linecap="round"/>

      <!-- Stone Sea-Arch Framing Distant Beacon Watchtower + Searchlight -->
      <path d="M 38 92 L 46 28 L 118 28 L 126 92 L 106 92 L 104 52 A 22 20 0 0 0 60 52 L 58 92 Z" fill="#101d36" opacity="0.85"/>
      <polygon points="84,42 158,18 158,42" fill="#fde047" opacity="0.16"/>
      <polygon points="78,92 81,40 87,40 90,92" fill="#1d3154"/>
      <circle cx="84" cy="41" r="2.5" fill="#fde047"/>

      <!-- Churning 3D Storm Swells -->
      <path d="M 0 86 Q 75 74 150 86 T 300 84 T 380 88 L 380 132 L 0 132 Z" fill="#071a30"/>
      <path d="M 180 98 Q 220 90 260 98 T 360 96" fill="none" stroke="#bae6fd" stroke-width="1.3" opacity="0.4"/>

      <!-- Burnished-Brass Planetary-Geared 4X Boost Gate -->
      <circle cx="286" cy="64" r="50" fill="url(#${uid}-focal)"/>
      <path d="${subGear}" fill="url(#${uid}-brass)" fill-rule="evenodd" stroke="#060c18" stroke-width="0.9"/>
      <path d="${gateGear}" fill="url(#${uid}-brass)" fill-rule="evenodd" stroke="#060c18" stroke-width="1.1"/>
      <circle cx="286" cy="64" r="29" fill="rgba(99,245,255,0.18)" stroke="#63f5ff" stroke-width="1.9" stroke-dasharray="9 4"/>
      <rect x="267" y="42" width="38" height="17" rx="3" fill="#071224" stroke="url(#${uid}-brass)" stroke-width="1.3"/>
      <text x="286" y="54.5" text-anchor="middle" font-family="'Orbitron', sans-serif" font-size="11.5" font-weight="900" fill="#ffe600">4X</text>

      <!-- Iron-Bound Barnacle Salvage Cask in Foam -->
      <g transform="translate(212, 103) rotate(11)">
        <rect x="-8.5" y="-7" width="17" height="14" rx="2.5" fill="#451a03" stroke="#d99b38" stroke-width="1.3"/>
        <line x1="-8.5" y1="0" x2="8.5" y2="0" stroke="#d99b38" stroke-width="1"/>
        <circle cx="0" cy="0" r="2.6" fill="#63f5ff"/>
      </g>

      <!-- Riveted Gunmetal & Brass Hydro-Skimmer + Rooster-Tail Spray + Mach Ring -->
      <path d="M 10 118 Q 68 92 124 90 L 136 104 Q 78 116 20 129 Z" fill="url(#${uid}-beam)"/>
      <path d="M 8 108 C 36 86, 68 82, 98 89 M 18 120 C 52 98, 86 96, 118 98" fill="none" stroke="#f0f9ff" stroke-width="2.8" stroke-linecap="round"/>
      <ellipse cx="104" cy="90" rx="5.5" ry="14" transform="rotate(-14 104 90)" fill="none" stroke="#63f5ff" stroke-width="1.9"/>

      <g transform="translate(150, 83) rotate(-9)">
        <polygon points="-34,-2 -70,-9 -60,0 -72,7 -34,5" fill="#63f5ff"/>
        <polygon points="-34,0 -54,-3.5 -54,4" fill="#ffffff"/>
        <path d="M -34 -5 L 6 -12.5 L 44 -1 L 14 9.5 L -32 8 Z" fill="#222c3d" stroke="url(#${uid}-brass)" stroke-width="1.8" stroke-linejoin="round"/>
        <path d="M -12 -9 L 18 -7 L 30 -1 L -8 1.5 Z" fill="#475569"/>
        <line x1="-22" y1="3" x2="18" y2="3" stroke="#63f5ff" stroke-width="1.4"/>
        <circle cx="4" cy="-9" r="5" fill="#4ade80" stroke="#06101e" stroke-width="1"/>
      </g>
    `;
  } else if (id === 'puzzle') {
    scene = `
      <rect width="380" height="132" fill="url(#${uid}-bg)"/>
      <!-- Carved Ashlar Sanctum Masonry & Flooded Moat -->
      <g stroke="#1b2642" stroke-width="0.9" opacity="0.55">
        <line x1="44" y1="24" x2="336" y2="24"/><line x1="44" y1="48" x2="336" y2="48"/><line x1="44" y1="72" x2="336" y2="72"/>
      </g>
      <rect x="16" y="0" width="28" height="132" fill="#12192e" stroke="#314166" stroke-width="1.1"/>
      <rect x="336" y="0" width="28" height="132" fill="#12192e" stroke="#314166" stroke-width="1.1"/>
      <rect x="0" y="96" width="380" height="36" fill="#050f1f"/>

      <!-- Multi-Layered Volumetric Wall Braziers + Rising Embers + Water Reflection -->
      <g>
        <circle cx="44" cy="50" r="26" fill="#fb923c" opacity="0.32"/>
        <polygon points="36,58 52,58 48,66 40,66" fill="url(#${uid}-brass)"/>
        <path d="M 44 33 C 52 42, 52 54, 44 58 C 36 54, 36 42, 44 33 Z" fill="#ea580c"/>
        <path d="M 44 39 C 49 45, 49 53, 44 57 C 39 53, 39 45, 44 39 Z" fill="#fde047"/>
        <circle cx="41" cy="27" r="1.3" fill="#fde047"/><circle cx="48" cy="23" r="1" fill="#fb923c"/>
        <ellipse cx="44" cy="108" rx="14" ry="4" fill="#fb923c" opacity="0.28"/>

        <circle cx="336" cy="50" r="26" fill="#fb923c" opacity="0.32"/>
        <polygon points="328,58 344,58 340,66 332,66" fill="url(#${uid}-brass)"/>
        <path d="M 336 33 C 344 42, 344 54, 336 58 C 328 54, 328 42, 336 33 Z" fill="#ea580c"/>
        <path d="M 336 39 C 341 45, 341 53, 336 57 C 331 53, 331 45, 336 39 Z" fill="#fde047"/>
        <circle cx="333" cy="26" r="1.3" fill="#fde047"/><circle cx="340" cy="22" r="1" fill="#fb923c"/>
        <ellipse cx="336" cy="108" rx="14" ry="4" fill="#fb923c" opacity="0.28"/>
      </g>

      <!-- Suspended Pentatonic Bronze Bells + Clappers + Harmonic Rings -->
      <g>
        <line x1="156" y1="0" x2="156" y2="19" stroke="#94a3b8" stroke-width="1.2"/>
        <path d="M 147 36 L 150 19 H 162 L 165 36 Z" fill="url(#${uid}-brass)" stroke="#090f1d" stroke-width="1"/>
        <circle cx="156" cy="37.5" r="2.2" fill="#fde047"/>

        <line x1="190" y1="0" x2="190" y2="15" stroke="#94a3b8" stroke-width="1.3"/>
        <path d="M 179 36 L 183 15 H 197 L 201 36 Z" fill="url(#${uid}-brass)" stroke="#090f1d" stroke-width="1"/>
        <circle cx="190" cy="38" r="2.5" fill="#fde047"/>
        <circle cx="190" cy="29" r="18" fill="none" stroke="#fde047" stroke-width="1" stroke-dasharray="4 3" opacity="0.72"/>
        <circle cx="190" cy="29" r="25" fill="none" stroke="#63f5ff" stroke-width="0.8" stroke-dasharray="3 4" opacity="0.45"/>

        <line x1="224" y1="0" x2="224" y2="21" stroke="#94a3b8" stroke-width="1.2"/>
        <path d="M 216 36 L 218 21 H 230 L 232 36 Z" fill="url(#${uid}-brass)" stroke="#090f1d" stroke-width="1"/>
        <circle cx="224" cy="37.5" r="2.2" fill="#fde047"/>
      </g>

      <!-- Perspective Beveled Rune Dais & Illuminated Rune Tiles -->
      <polygon points="102,83 278,83 308,112 72,112" fill="#1d2947" stroke="#5a73a8" stroke-width="1.3"/>
      <polygon points="72,112 308,112 308,121 72,121" fill="#0b1224"/>
      <polygon points="148,89 184,89 188,105 142,105" fill="rgba(99,245,255,0.3)" stroke="#63f5ff" stroke-width="1.1"/>
      <polygon points="196,89 232,89 238,105 192,105" fill="rgba(99,245,255,0.24)" stroke="#63f5ff" stroke-width="1.1"/>
      <polygon points="166,93 171,97 166,101 161,97" fill="#ffffff"/>
      <polygon points="214,93 219,97 214,101 209,97" fill="#63f5ff"/>

      <!-- Refracting Cyan Prism Laser Beam & Angled Brass Mirrors -->
      <polyline points="90,76 154,48 234,76 294,51" fill="none" stroke="#63f5ff" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" opacity="0.42"/>
      <polyline points="90,76 154,48 234,76 294,51" fill="none" stroke="#ffffff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
      <polygon points="84,86 90,65 96,86" fill="#334155" stroke="url(#${uid}-brass)" stroke-width="1.2"/>
      <rect x="149" y="40" width="10" height="16" rx="1.5" transform="rotate(-22 154 48)" fill="#bae6fd" stroke="url(#${uid}-brass)" stroke-width="1.5"/>
      <rect x="229" y="68" width="10" height="16" rx="1.5" transform="rotate(20 234 76)" fill="#bae6fd" stroke="url(#${uid}-brass)" stroke-width="1.5"/>
      <circle cx="294" cy="51" r="14" fill="url(#${uid}-focal)"/>
      <polygon points="294,39 302,51 294,63 286,51" fill="#63f5ff" stroke="#ffffff" stroke-width="1.1"/>
    `;
  } else {
    const ringOuter = buildClockworkGearPath(190, 48, 43, 39.5, 35.5, 31, 30.5, 24, 0, 5);
    const ringMid = buildClockworkGearPath(190, 48, 29, 26, 22.5, 19, 18.5, 16, 0, -14);
    const ringInner = buildClockworkGearPath(190, 48, 17, 14.8, 12, 8, 7.5, 10, 0, 22);
    const ringTicks = buildDegreeTicksPath(190, 48, 31.5, 35, 24, 0, 0);
    const coreStar = buildStarBurstPath(190, 48, 11.5, 4, 8, 0);

    scene = `
      <rect width="380" height="132" fill="url(#${uid}-bg)"/>
      <!-- Carved Normal-Lit Basalt Vault Arch & Flanking Torches -->
      <path d="M 32 90 A 158 86 0 0 1 348 90" fill="none" stroke="#262145" stroke-width="12"/>
      <path d="M 32 90 A 158 86 0 0 1 348 90" fill="none" stroke="#0c091c" stroke-width="12" stroke-dasharray="2 16"/>
      <path d="M 52 90 A 138 74 0 0 1 328 90" fill="none" stroke="#433875" stroke-width="1.6"/>

      <circle cx="54" cy="64" r="18" fill="#fb923c" opacity="0.28"/>
      <path d="M 54 52 C 59 58, 59 65, 54 68 C 49 65, 49 58, 54 52 Z" fill="#fde047"/>
      <circle cx="326" cy="64" r="18" fill="#fb923c" opacity="0.28"/>
      <path d="M 326 52 C 331 58, 331 65, 326 68 C 321 65, 321 58, 326 52 Z" fill="#fde047"/>

      <!-- Concentric Golden Astrolabe Rings + Amethyst Jewels + Arcane Energy Arcs -->
      <circle cx="190" cy="48" r="54" fill="url(#${uid}-focal)"/>
      <path d="${ringOuter}" fill="url(#${uid}-brass)" fill-rule="evenodd" stroke="#090714" stroke-width="0.9"/>
      <path d="${ringTicks}" stroke="#fef08a" stroke-width="0.8" opacity="0.7"/>
      <path d="${ringMid}" fill="url(#${uid}-brass)" fill-rule="evenodd" stroke="#090714" stroke-width="0.9"/>
      <path d="${ringInner}" fill="url(#${uid}-brass)" fill-rule="evenodd" stroke="#090714" stroke-width="0.8"/>

      <!-- Faceted Amethyst Sockets & Crackling Locking Arcs -->
      <polygon points="190,4 194,10 190,16 186,10" fill="#e879f9" stroke="#ffffff" stroke-width="0.8"/>
      <polygon points="190,80 194,86 190,92 186,86" fill="#e879f9" stroke="#ffffff" stroke-width="0.8"/>
      <polygon points="146,48 152,44 158,48 152,52" fill="#e879f9" stroke="#ffffff" stroke-width="0.8"/>
      <polygon points="234,48 228,44 222,48 228,52" fill="#e879f9" stroke="#ffffff" stroke-width="0.8"/>

      <polyline points="142,32 162,40 172,36 190,48" fill="none" stroke="#63f5ff" stroke-width="1.5"/>
      <polyline points="238,32 218,40 208,36 190,48" fill="none" stroke="#63f5ff" stroke-width="1.5"/>
      <polyline points="156,48 172,52 180,46 190,48" fill="none" stroke="#fde047" stroke-width="1.2"/>
      <polyline points="224,48 208,52 200,46 190,48" fill="none" stroke="#fde047" stroke-width="1.2"/>

      <path d="${coreStar}" fill="#f0abfc" stroke="#ffffff" stroke-width="0.9"/>
      <circle cx="190" cy="48" r="3.6" fill="#ffffff"/>

      <!-- Dark Subterranean Mirror Water & Shimmering Astrolabe Reflection -->
      <rect x="0" y="90" width="380" height="42" fill="#060816"/>
      <ellipse cx="54" cy="104" rx="12" ry="3.5" fill="#fb923c" opacity="0.25"/>
      <ellipse cx="326" cy="104" rx="12" ry="3.5" fill="#fb923c" opacity="0.25"/>
      <g opacity="0.5">
        <ellipse cx="190" cy="109" rx="46" ry="15.5" fill="none" stroke="#fbbf24" stroke-width="2.4" stroke-dasharray="10 4"/>
        <ellipse cx="190" cy="109" rx="30" ry="10" fill="none" stroke="#e879f9" stroke-width="1.9" stroke-dasharray="7 3"/>
        <ellipse cx="190" cy="109" rx="14" ry="5" fill="#f0abfc"/>
      </g>
      <path d="M 20 91 H 360 M 84 99 H 296 M 118 109 H 262 M 96 120 H 284" stroke="#63f5ff" stroke-width="0.8" opacity="0.38"/>
    `;
  }

  const bgTop = id === 'vault' ? '#080617' : id === 'puzzle' ? '#070b18' : '#040a17';
  const bgBot = id === 'vault' ? '#1c1238' : id === 'submarine' ? '#0a2e4a' : '#13294b';
  const focalHue = id === 'vault' ? '#c026ff' : id === 'glide' ? '#bae6fd' : '#5ef2ff';

  return `
<svg class="portal-art-bg portal-art-${id}" viewBox="0 0 380 132" preserveAspectRatio="xMidYMid slice" style="position:absolute;inset:1.8px;width:calc(100% - 3.6px);height:calc(100% - 3.6px);z-index:1;clip-path:var(--poly-portal-arch,none);pointer-events:none;" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <defs>
    <linearGradient id="${uid}-bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${bgTop}"/>
      <stop offset="100%" stop-color="${bgBot}"/>
    </linearGradient>

    <radialGradient id="${uid}-focal" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="${focalHue}" stop-opacity="0.48"/>
      <stop offset="100%" stop-color="#040812" stop-opacity="0"/>
    </radialGradient>

    <linearGradient id="${uid}-beam" x1="0%" y1="50%" x2="100%" y2="50%">
      <stop offset="0%" stop-color="#7ef9ff" stop-opacity="0.54"/>
      <stop offset="55%" stop-color="#38bdf8" stop-opacity="0.2"/>
      <stop offset="100%" stop-color="#38bdf8" stop-opacity="0"/>
    </linearGradient>

    <linearGradient id="${uid}-brass" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#ffe9a6"/>
      <stop offset="48%" stop-color="#d99b38"/>
      <stop offset="100%" stop-color="#6b3e0e"/>
    </linearGradient>

    <linearGradient id="${uid}-veil" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#040812" stop-opacity="0.04"/>
      <stop offset="68%" stop-color="#040812" stop-opacity="0.14"/>
      <stop offset="100%" stop-color="#030711" stop-opacity="0.48"/>
    </linearGradient>
  </defs>

  <rect width="380" height="132" fill="url(#${uid}-bg)"/>
  <g transform="translate(42, 0) scale(0.89, 1)">
    ${scene}
  </g>
  <rect width="380" height="132" fill="url(#${uid}-veil)"/>
</svg>`.trim();
}

// ============================================================================
// 5. TROPHY SHIELD MEDALLIONS — getTrophyShieldSVG(tier, unlocked = true)
// ============================================================================

const TROPHY_TIERS = {
  aluminum: {
    rimA: '#f1f5f9',
    rimB: '#64748b',
    rimC: '#1e293b',
    faceTop: '#334155',
    faceBot: '#0f172a',
    core: '#7be8ff',
    glow: 'rgba(123,232,255,0.28)',
  },
  copper: {
    rimA: '#ffedd5',
    rimB: '#ea580c',
    rimC: '#5c2408',
    faceTop: '#431e09',
    faceBot: '#1c0c04',
    core: '#fbbf24',
    glow: 'rgba(251,191,36,0.3)',
  },
  platinum: {
    rimA: '#ffffff',
    rimB: '#7dd3fc',
    rimC: '#1e3a5f',
    faceTop: '#16304f',
    faceBot: '#091426',
    core: '#5efce8',
    glow: 'rgba(94,252,232,0.36)',
  },
  diamond: {
    rimA: '#ffffff',
    rimB: '#e879f9',
    rimC: '#312e81',
    faceTop: '#2a1c54',
    faceBot: '#0d0924',
    core: '#a5f3fc',
    glow: 'rgba(232,121,249,0.42)',
  },
};

export function getTrophyShieldSVG(tier = 'aluminum', unlocked = true) {
  const norm = TROPHY_TIERS[tier] ? tier : 'aluminum';
  const pal = TROPHY_TIERS[norm];
  const uid = nextUid(`tr-${norm}`);

  if (!unlocked) {
    return `
<svg class="trophy-shield-svg tier-${norm} is-locked" viewBox="0 0 56 64" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <defs>
    <linearGradient id="${uid}-lk" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#475569"/>
      <stop offset="55%" stop-color="#1e293b"/>
      <stop offset="100%" stop-color="#090e1a"/>
    </linearGradient>
  </defs>
  <polygon points="28,3 50,13 48,41 28,60 8,41 6,13" fill="url(#${uid}-lk)" stroke="#050912" stroke-width="1.5" stroke-linejoin="round"/>
  <polygon points="28,8 45,16 43.5,39 28,54 12.5,39 11,16" fill="#0b1221" stroke="#334155" stroke-width="1" stroke-linejoin="round"/>
  <circle cx="13" cy="18" r="1.4" fill="#475569"/>
  <circle cx="43" cy="18" r="1.4" fill="#475569"/>
  <circle cx="28" cy="51" r="1.4" fill="#475569"/>
  <path d="M 23 29 V 24.5 A 5 5 0 0 1 33 24.5 V 29" fill="none" stroke="#64748b" stroke-width="2" stroke-linecap="round"/>
  <rect x="20" y="29" width="16" height="12" rx="2" fill="#1e293b" stroke="#64748b" stroke-width="1.4"/>
  <circle cx="28" cy="34.5" r="1.7" fill="#94a3b8"/>
</svg>`.trim();
  }

  let crownWings = '';
  let centerEmblem = '';

  if (norm === 'diamond') {
    crownWings = `
      <polygon points="28,0 33,7 28,11 23,7" fill="#fde047"/>
      <polygon points="3,17 9,11 9,23" fill="#e879f9"/>
      <polygon points="53,17 47,11 47,23" fill="#e879f9"/>
    `;
    centerEmblem = `
      <polygon points="21,21 35,21 40,29 28,45 16,29" fill="${pal.core}" stroke="#ffffff" stroke-width="1.2" stroke-linejoin="round"/>
      <path d="M16 29 L40 29 M21 21 L25 29 L28 45 L31 29 L35 21" fill="none" stroke="#ffffff" stroke-width="0.95"/>
    `;
  } else if (norm === 'platinum') {
    crownWings = `<polygon points="20,6 28,1 36,6 33,10 23,10" fill="#bae6fd"/>`;
    const star = buildStarBurstPath(28, 31, 12, 4.5, 6, 0);
    centerEmblem = `
      <circle cx="28" cy="31" r="13" fill="none" stroke="#7dd3fc" stroke-width="1" stroke-dasharray="5 2.5"/>
      <path d="${star}" fill="${pal.core}" stroke="#ffffff" stroke-width="0.9"/>
    `;
  } else if (norm === 'copper') {
    const gear = buildClockworkGearPath(28, 31, 11.5, 9.5, 7, 4, 2.2, 8, 0, 22.5);
    centerEmblem = `
      <path d="${gear}" fill="${pal.core}" fill-rule="evenodd" stroke="#fffbeb" stroke-width="0.7"/>
      <circle cx="28" cy="31" r="3.4" fill="#ffffff"/>
    `;
  } else {
    const star = buildStarBurstPath(28, 31, 10.5, 4.2, 5, 0);
    centerEmblem = `<path d="${star}" fill="${pal.core}" stroke="#e0f2fe" stroke-width="0.8"/>`;
  }

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

  ${crownWings}
  <polygon points="28,3 51,13 48,42 28,61 8,42 5,13" fill="url(#${uid}-rim)" stroke="#050914" stroke-width="1.4" stroke-linejoin="round"/>
  <polygon points="28,3 5,13 8,42 12,39 10,16 28,8" fill="rgba(255,255,255,0.28)"/>
  <polygon points="28,8.5 46,16.5 43.5,39.5 28,55 12.5,39.5 10,16.5" fill="url(#${uid}-face)" stroke="${pal.core}" stroke-width="0.95" stroke-opacity="0.75" stroke-linejoin="round"/>
  <circle cx="28" cy="31" r="14.5" fill="${pal.glow}"/>

  <circle cx="13.5" cy="18.5" r="1.5" fill="${pal.rimA}"/>
  <circle cx="42.5" cy="18.5" r="1.5" fill="${pal.rimA}"/>
  <circle cx="15.5" cy="38.5" r="1.4" fill="${pal.rimB}"/>
  <circle cx="40.5" cy="38.5" r="1.4" fill="${pal.rimB}"/>

  ${centerEmblem}
</svg>`.trim();
}

// ============================================================================
// 6. INTERACTIVE ARCHIPELAGO SEA CHART — renderArchipelagoSeaChart(container, opts)
// ============================================================================

const CHART_NODES = [
  { x: 86, y: 486, sectorIdx: 0, cutKey: 'prologue', cutLabel: 'PROLOGUE', cutOffset: [0, -45], biome: 'mist' },
  { x: 228, y: 444, sectorIdx: 0, cutKey: null, cutLabel: '', cutOffset: [0, 0], biome: 'sinking' },
  { x: 332, y: 352, sectorIdx: 1, cutKey: 'sector2', cutLabel: 'ACT II', cutOffset: [0, -45], biome: 'foundry' },
  { x: 132, y: 314, sectorIdx: 1, cutKey: null, cutLabel: '', cutOffset: [0, 0], biome: 'blizzard' },
  { x: 114, y: 210, sectorIdx: 2, cutKey: 'sector3', cutLabel: 'ACT III', cutOffset: [0, -45], biome: 'prism' },
  { x: 314, y: 182, sectorIdx: 2, cutKey: null, cutLabel: '', cutOffset: [0, 0], biome: 'piston' },
  { x: 146, y: 116, sectorIdx: 3, cutKey: 'sector4', cutLabel: 'ACT IV', cutOffset: [-56, -18], biome: 'blackout' },
  { x: 268, y: 60, sectorIdx: 3, cutKey: 'epilogue', cutLabel: 'EPILOGUE', cutOffset: [74, -2], biome: 'apex' },
];

const CHART_ROUTES = [
  { from: 0, to: 1, mode: 'submarine', label: 'SUB', path: 'M 104 482 Q 160 486 210 452', bx: 158, by: 476 },
  { from: 1, to: 2, mode: 'glide', label: 'GLIDE', path: 'M 244 434 Q 308 414 328 368', bx: 298, by: 406 },
  { from: 2, to: 3, mode: 'skimmer', label: 'SKIM', path: 'M 312 348 Q 232 322 152 316', bx: 232, by: 330 },
  { from: 3, to: 4, mode: 'glide', label: 'GLIDE', path: 'M 122 298 Q 84 262 106 224', bx: 94, by: 262 },
  { from: 4, to: 5, mode: 'submarine', label: 'SUB', path: 'M 134 206 Q 218 182 294 182', bx: 214, by: 190 },
  { from: 5, to: 6, mode: 'glide', label: 'GLIDE', path: 'M 302 166 Q 248 126 166 118', bx: 242, by: 136 },
  { from: 6, to: 7, mode: 'skimmer', label: 'SKIM', path: 'M 164 106 Q 208 74 248 64', bx: 206, by: 82 },
];

// Positioned in open sea pockets so zero island spires or cinema badges overlap
const SECTOR_REGIONS = [
  { code: 'SECTOR I', name: 'THE DROWNED WATCH', origName: 'CLASSIC PAIR I', x: 22, y: 534, align: 'start', color: '#5efce8' },
  { code: 'SECTOR II', name: 'SMELTER & BOREAL REACH', origName: 'CLASSIC PAIR II', x: 22, y: 386, align: 'start', color: '#67e8f9' },
  { code: 'SECTOR III', name: 'ARCANE & HYDRAULIC TRENCH', origName: 'CLASSIC PAIR III', x: 398, y: 246, align: 'end', color: '#e879f9' },
  { code: 'SECTOR IV', name: 'MAELSTROM CORE', origName: 'CLASSIC PAIR IV', x: 398, y: 24, align: 'end', color: '#fbbf24' },
];

const REBOOT_TOWER_BRIEFS = [
  'Moonlit storm watchtower. Master Romanesque ledges, golden cage-lifts, and decipher the hidden Rune Chamber.',
  'Ballasted limestone reliquary sinking into the surge. Turn brass drain valves and crack the Core Lock Vault.',
  'Automated steam foundry. Ride pressurized boiler updrafts, reverse iron conveyors, and brave furnace sparks.',
  'Gale-force polar monolith. Time boreal crosswinds across sheer glacial ice slabs and cryo-vents.',
  'Crystalline resonator spire. Toggle phase-shifted bridges and outmaneuver floating Amethyst Molecules.',
  'Offshore hydraulic derrick. Synchronize climbs with lunar-perigee pistons and unlock the sunken Core Vault.',
  'Tempest fortress under Tesla blackout cycles. Follow warm cage-lift halos through periodic storm darkness.',
  'Master reactor at the Eye of the Maelstrom. Survive surging tides, gales, and laser gates to save Nebulus.',
];

const ORIGINAL_TOWER_BRIEFS = [
  'Authentic 1987 Tower 1 (47F, 100s). Classic spiral ledges, extendable lifts, and patrolling Flying Eyes.',
  'Authentic 1987 Tower 2 (71F, 120s). Automaton garrison guarded by horizontal & vertical sentinel robots.',
  'Authentic 1987 Tower 3 (140s). Deceptive crumbling bricks, slippery slides, and multi-tier doorway mazes.',
  'Authentic 1987 Tower 4 (160s). High-speed glacier slide runs and tight vertical lift transfers.',
  'Authentic 1987 Tower 5 (180s). Shattered gaps demanding crisp 1.5-column classic arcade jump timing.',
  'Authentic 1987 Tower 6 (200s). High-altitude abyssal climb flanked by MK.7 Mini-Submarine bonus seas.',
  'Authentic 1987 Tower 7 (220s). Relentless late-game gauntlet of bouncers, rollers, and narrow ledges.',
  'Authentic 1987 Tower 8 (240s). The legendary final demolition climb — topple Destructo Inc. once and for all.',
];

function buildSpireSilhouetteSVG(biome, unlocked, accent) {
  const fill = unlocked ? '#2a3c63' : '#131b2e';
  const hi = unlocked ? accent : '#475569';
  if (biome === 'apex') {
    return `
      <polygon points="-16,10 -11,-23 -5,-23 -3,-32 3,-32 5,-23 11,-23 16,10" fill="${fill}" stroke="#fbbf24" stroke-width="1.3"/>
      <polygon points="0,-41 4.5,-32 0,-27 -4.5,-32" fill="${unlocked ? '#fde047' : '#64748b'}"/>
      <rect x="-3" y="-15" width="6" height="10" rx="2" fill="${hi}" opacity="0.9"/>
    `;
  }
  if (biome === 'foundry' || biome === 'piston') {
    return `
      <polygon points="-14,10 -10,-17 10,-17 14,10" fill="${fill}" stroke="#d99b38" stroke-width="1.1"/>
      <rect x="-8.5" y="-25" width="4.5" height="9" fill="#334155"/>
      <rect x="4" y="-23" width="4.5" height="7" fill="#334155"/>
      <rect x="-4" y="-9" width="8" height="6" rx="1" fill="${unlocked ? '#fb923c' : '#475569'}"/>
    `;
  }
  if (biome === 'prism' || biome === 'blizzard') {
    return `
      <polygon points="-13,10 -8.5,-19 0,-28 8.5,-19 13,10" fill="${fill}" stroke="${hi}" stroke-width="1.1"/>
      <polygon points="0,-24 4,-12 0,-4 -4,-12" fill="${hi}" opacity="0.78"/>
    `;
  }
  return `
    <polygon points="-13,10 -9.5,-20 -12.5,-22 -12.5,-25 12.5,-25 12.5,-22 9.5,-20 13,10" fill="${fill}" stroke="${hi}" stroke-width="1.1"/>
    <rect x="-2.5" y="-14" width="5" height="8" rx="2" fill="${hi}" opacity="0.9"/>
  `;
}

function buildRouteVehicleGlyph(mode) {
  if (mode === 'glide') {
    return `<path d="M -6 1 L 0 -3.5 L 6 1 L 1.5 1 L 0 3.5 L -1.5 1 Z" fill="currentColor"/>`;
  }
  if (mode === 'skimmer') {
    return `<path d="M -6 2 L -1 -2.5 L 6 0 L 2 3 L -6 2 Z" fill="currentColor"/>`;
  }
  return `<rect x="-5.5" y="-2.5" width="11" height="5.5" rx="2.7" fill="currentColor"/><path d="M -1.5 -2.5 V -4.8 H 1.5 V -2.5" stroke="currentColor" stroke-width="1.2"/>`;
}

function normalizeStars(raw) {
  if (typeof raw === 'number') {
    return {
      clear: raw >= 1,
      vault: raw >= 2,
      speed: raw >= 3,
      nohit: false,
      combo: false,
      count: Math.max(0, Math.min(3, Math.floor(raw))),
    };
  }
  const clear = Boolean(raw?.clear);
  const vault = Boolean(raw?.vault);
  const speed = Boolean(raw?.speed);
  const nohit = Boolean(raw?.nohit);
  const combo = Boolean(raw?.combo);
  const count = raw?.count ?? ((clear ? 1 : 0) + (vault ? 1 : 0) + (speed ? 1 : 0));
  return { clear, vault, speed, nohit, combo, count };
}

export function renderArchipelagoSeaChart(container, opts = {}) {
  if (!container) return;

  const {
    era = 'reboot',
    towers = [],
    selectedIdx = 0,
    isTowerUnlocked = (idx) => idx === 0,
    getStars = () => ({ clear: false, vault: false, speed: false, count: 0 }),
    getMasteryCount = null,
    isRelicFound = () => false,
    onSelectTower = null,
    onDeployTower = null,
    onPlayCutscene = null,
    onPlayRoute = null,
    isCutsceneUnlocked = null,
  } = opts || {};

  const isOriginal = era === 'original';
  const count = Math.min(8, Math.max(towers.length, 8));
  let activeIdx = Math.max(0, Math.min(count - 1, Number(selectedIdx) || 0));
  const uid = nextUid('chart');

  const checkUnlocked = (idx) => {
    const t = towers[idx] || { id: idx + 1 };
    return Boolean(isTowerUnlocked(idx, t));
  };

  const readStars = (idx) => {
    const t = towers[idx] || { id: idx + 1 };
    return normalizeStars(getStars(idx, t));
  };

  const readMastery = (idx, starsObj) => {
    const t = towers[idx] || { id: idx + 1 };
    if (typeof getMasteryCount === 'function') {
      const val = Number(getMasteryCount(idx, t));
      if (!Number.isNaN(val)) return Math.max(0, Math.min(5, Math.floor(val)));
    }
    return [starsObj.clear, starsObj.vault, starsObj.speed, starsObj.nohit, starsObj.combo].filter(Boolean).length;
  };

  const readRelic = (idx) => {
    if (isOriginal) return false;
    const t = towers[idx] || { id: idx + 1 };
    return Boolean(isRelicFound(idx, t));
  };

  const checkCutsceneReady = (cutKey, idx) => {
    if (isOriginal || !cutKey) return false;
    if (typeof isCutsceneUnlocked === 'function') {
      return Boolean(isCutsceneUnlocked(cutKey, idx));
    }
    if (cutKey === 'epilogue') {
      return Boolean(readStars(7).clear);
    }
    return checkUnlocked(idx);
  };

  const renderDOM = () => {
    const compassOuter = buildStarBurstPath(356, 492, 34, 8, 8, 0);
    const compassInner = buildStarBurstPath(356, 492, 21, 5, 4, 45);
    const compassTicks = buildDegreeTicksPath(356, 492, 36, 41, 32, 4, 0);
    const maelstromTicks = buildDegreeTicksPath(268, 60, 44, 50, 28, 0, 8);

    let borderTicks = '';
    for (let x = 30; x <= 390; x += 30) {
      borderTicks += `M ${x} 7 V 12 M ${x} 548 V 553 `;
    }
    for (let y = 35; y <= 525; y += 35) {
      borderTicks += `M 7 ${y} H 12 M 408 ${y} H 413 `;
    }

    const regionsSvg = SECTOR_REGIONS.map((reg) => {
      const label = isOriginal ? reg.origName : reg.name;
      return `
        <g class="sea-sector-label">
          <text x="${reg.x}" y="${reg.y}" text-anchor="${reg.align}" font-family="'Orbitron', sans-serif" font-size="8.4" font-weight="800" letter-spacing="1.8" fill="${reg.color}" opacity="0.9">${reg.code}</text>
          <text x="${reg.x}" y="${reg.y + 11.5}" text-anchor="${reg.align}" font-family="'Rajdhani', sans-serif" font-size="10.2" font-weight="700" letter-spacing="1.1" fill="#a8c0de" opacity="0.84">${escapeHtml(label)}</text>
        </g>
      `;
    }).join('');

    const routesSvg = CHART_ROUTES.map((rt, rIdx) => {
      const routeMode = isOriginal ? 'submarine' : rt.mode;
      const routeLbl = isOriginal ? 'SUB' : rt.label;
      const routeActive = readStars(rt.from).clear;
      const strokeCol = routeActive
        ? routeMode === 'glide'
          ? '#fde047'
          : '#5ef2ff'
        : 'rgba(148,169,201,0.28)';

      return `
        <g class="sea-route-group ${routeActive ? 'unlocked' : 'locked'}">
          <path d="${rt.path}" fill="none" stroke="${strokeCol}" stroke-width="${routeActive ? '2.4' : '1.5'}" stroke-dasharray="5 5" stroke-linecap="round"/>
          <g class="sea-route-pill ${routeActive ? 'unlocked' : 'locked'}" data-route-idx="${rIdx}" transform="translate(${rt.bx}, ${rt.by})" style="cursor: pointer;">
            <rect x="-24" y="-8.5" width="48" height="17" rx="8.5" fill="#071326" stroke="${strokeCol}" stroke-width="1.1"/>
            <g transform="translate(-12, 0)" style="color: ${strokeCol};">
              ${buildRouteVehicleGlyph(routeMode)}
            </g>
            <text x="6" y="3.2" text-anchor="middle" font-family="'Orbitron', sans-serif" font-size="7.4" font-weight="800" letter-spacing="0.7" fill="${routeActive ? '#eaf6ff' : '#64748b'}">${routeLbl}</text>
          </g>
        </g>
      `;
    }).join('');

    const nodesSvg = CHART_NODES.map((nd, idx) => {
      const t = towers[idx] || { id: idx + 1, name: `MONOLITH ${idx + 1}` };
      const unlocked = checkUnlocked(idx);
      const stars = readStars(idx);
      const isSelected = idx === activeIdx;
      const hasRelic = readRelic(idx);
      const accent = SECTOR_REGIONS[nd.sectorIdx]?.color || '#5ef2ff';

      const starPips = [stars.clear, stars.vault, stars.speed]
        .map((on, sIdx) => {
          const sx = (sIdx - 1) * 10.5;
          const p = buildStarBurstPath(sx, 26, 4.4, 1.9, 5, 0);
          return `<path d="${p}" fill="${on ? '#fde047' : '#0b1426'}" stroke="${on ? '#fffbeb' : '#475569'}" stroke-width="0.8"/>`;
        })
        .join('');

      const cutKey = !isOriginal ? nd.cutKey : null;
      const cutReady = checkCutsceneReady(cutKey, idx);
      const [cxOff, cyOff] = nd.cutOffset;
      const cutBadgeSvg = cutKey
        ? `
          <g class="sea-cutscene-badge ${cutReady ? 'unlocked' : 'locked'}" data-cutscene-key="${cutKey}" data-cutscene-idx="${idx}" transform="translate(${cxOff}, ${cyOff})" style="cursor: pointer;">
            <rect x="-35" y="-8.5" width="70" height="17" rx="4.5" fill="${cutReady ? '#102342' : '#09101f'}" stroke="${cutReady ? '#fbbf24' : '#334155'}" stroke-width="1.1"/>
            <polygon points="-28,-3.5 -22,0 -28,3.5" fill="${cutReady ? '#fbbf24' : '#475569'}"/>
            <text x="5" y="3" text-anchor="middle" font-family="'Orbitron', sans-serif" font-size="6.8" font-weight="800" letter-spacing="0.5" fill="${cutReady ? '#fef08a' : '#64748b'}">${nd.cutLabel}</text>
          </g>
        `
        : '';

      const stateClasses = [
        'sea-spire-node',
        isSelected ? 'selected active' : '',
        stars.clear ? 'cleared' : '',
        !unlocked ? 'locked' : 'unlocked',
      ]
        .filter(Boolean)
        .join(' ');

      return `
        <g class="${stateClasses}" data-tower-idx="${idx}" transform="translate(${nd.x}, ${nd.y})" role="button" tabindex="0" aria-label="Tower ${idx + 1}: ${escapeHtml(t.name)}" style="cursor: pointer;">
          <ellipse cx="0" cy="11" rx="34" ry="12.5" fill="none" stroke="${unlocked ? accent : '#334155'}" stroke-width="0.85" stroke-dasharray="4 3" opacity="0.48"/>
          <ellipse cx="0" cy="10" rx="25" ry="9" fill="${unlocked ? '#102845' : '#0b1424'}" stroke="${unlocked ? '#bae6fd' : '#1e293b'}" stroke-width="1" opacity="0.92"/>

          ${
            isSelected
              ? `
            <circle class="spire-beacon-ring" cx="0" cy="-2" r="31" fill="rgba(99,245,255,0.11)" stroke="#63f5ff" stroke-width="1.8" stroke-dasharray="9 4"/>
            <circle cx="0" cy="-2" r="36" fill="none" stroke="#fbbf24" stroke-width="1" stroke-dasharray="3 5" opacity="0.88"/>
          `
              : ''
          }

          <polygon points="-21,11 -15,3 15,3 21,11 9,14.5 -9,14.5" fill="#1d2945" stroke="#060c18" stroke-width="1"/>
          ${buildSpireSilhouetteSVG(isOriginal ? 'mist' : nd.biome, unlocked, accent)}

          <rect x="-15" y="4" width="30" height="13" rx="3.5" fill="${isSelected ? '#fbbf24' : '#081224'}" stroke="${isSelected ? '#ffffff' : unlocked ? accent : '#475569'}" stroke-width="1.1"/>
          <text x="0" y="13.2" text-anchor="middle" font-family="'Orbitron', sans-serif" font-size="8.6" font-weight="900" fill="${isSelected ? '#050914' : unlocked ? '#f8fafc' : '#64748b'}">T${idx + 1}</text>

          ${
            unlocked
              ? starPips
              : `
            <g transform="translate(0, -8)">
              <rect x="-6" y="-4" width="12" height="9" rx="1.8" fill="#0f172a" stroke="#94a3b8" stroke-width="1.2"/>
              <path d="M -3.5 -4 V -6.8 A 3.5 3.5 0 0 1 3.5 -6.8 V -4" fill="none" stroke="#94a3b8" stroke-width="1.2"/>
            </g>
          `
          }

          ${
            hasRelic
              ? `<polygon points="21,-8 25,-3 21,2 17,-3" fill="#5efce8" stroke="#ffffff" stroke-width="0.7"/>`
              : ''
          }

          ${cutBadgeSvg}
        </g>
      `;
    }).join('');

    const selTower = towers[activeIdx] || { id: activeIdx + 1, name: `MONOLITH ${activeIdx + 1}`, subtitle: '' };
    const selUnlocked = checkUnlocked(activeIdx);
    const selStars = readStars(activeIdx);
    const selMastery = readMastery(activeIdx, selStars);
    const selRelic = readRelic(activeIdx);
    const selNode = CHART_NODES[activeIdx] || CHART_NODES[0];
    const selSec = SECTOR_REGIONS[selNode.sectorIdx] || SECTOR_REGIONS[0];

    const sectorHeading = selTower.subtitle || `${selSec.code} • ${isOriginal ? selSec.origName : selSec.name}`;
    const briefCopy = isOriginal
      ? ORIGINAL_TOWER_BRIEFS[activeIdx] || ORIGINAL_TOWER_BRIEFS[0]
      : REBOOT_TOWER_BRIEFS[activeIdx] || REBOOT_TOWER_BRIEFS[0];

    const sectorEntryIdx = Math.floor(activeIdx / 2) * 2;
    const assocCutKey = !isOriginal
      ? activeIdx === 7 && checkCutsceneReady('epilogue', 7)
        ? 'epilogue'
        : CHART_NODES[sectorEntryIdx]?.cutKey
      : null;
    const assocCutLabel =
      assocCutKey === 'epilogue'
        ? 'EPILOGUE'
        : CHART_NODES[sectorEntryIdx]?.cutLabel || 'CINEMA';
    const assocCutUnlocked = checkCutsceneReady(assocCutKey, assocCutKey === 'epilogue' ? 7 : sectorEntryIdx);

    const starMedalsHtml = [
      { on: selStars.clear, lbl: 'CLEAR' },
      { on: selStars.vault, lbl: isOriginal ? 'BONUS' : 'SECRET' },
      { on: selStars.speed, lbl: 'SPEED' },
    ]
      .map(
        (st) => `
        <span class="spyglass-star-chip ${st.on ? 'on' : 'off'}" style="display:inline-flex;align-items:center;gap:3px;font-size:11px;font-weight:700;color:${st.on ? '#fde047' : '#64748b'};">
          <svg width="13" height="13" viewBox="0 0 24 24" aria-hidden="true">
            <path fill="${st.on ? '#fde047' : 'none'}" stroke="${st.on ? '#fef9c3' : '#475569'}" stroke-width="1.8" d="M12 2.2 14.8 8.8l7.1.6-5.4 4.7 1.6 7L12 17.3l-6.1 3.8 1.6-7-5.4-4.7 7.1-.6L12 2.2Z"/>
          </svg>
          <span>${st.lbl}</span>
        </span>`
      )
      .join('');

    const masteryDiamondsHtml = Array.from({ length: 5 }, (_, mIdx) => {
      const on = mIdx < selMastery;
      return `
        <svg width="12" height="12" viewBox="0 0 16 16" aria-hidden="true">
          <polygon points="8,1.5 14,8 8,14.5 2,8" fill="${on ? '#63f5ff' : 'rgba(15,23,42,0.7)'}" stroke="${on ? '#ffffff' : '#475569'}" stroke-width="1.3"/>
        </svg>`;
    }).join('');

    container.innerHTML = `
      <div class="sea-chart-shell">
        <div class="sea-chart-frame">
          <svg class="sea-chart-svg" viewBox="0 0 420 560" xmlns="http://www.w3.org/2000/svg" role="region" aria-label="Nebulus Archipelago Nautical Sea Chart">
            <defs>
              <radialGradient id="${uid}-sea" cx="50%" cy="45%" r="62%">
                <stop offset="0%" stop-color="#0d2644"/>
                <stop offset="58%" stop-color="#07162b"/>
                <stop offset="100%" stop-color="#030914"/>
              </radialGradient>
              <radialGradient id="${uid}-maelstrom" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stop-color="#c026ff" stop-opacity="0.34"/>
                <stop offset="52%" stop-color="#38bdf8" stop-opacity="0.16"/>
                <stop offset="100%" stop-color="#030914" stop-opacity="0"/>
              </radialGradient>
              <linearGradient id="${uid}-brass" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stop-color="#ffe8a3"/>
                <stop offset="50%" stop-color="#d99b38"/>
                <stop offset="100%" stop-color="#6b3f10"/>
              </linearGradient>
            </defs>

            <rect width="420" height="560" rx="10" fill="url(#${uid}-sea)"/>

            <path d="M -10 410 C 90 380, 175 280, 250 245 C 325 210, 380 140, 430 105 L 430 155 C 365 190, 310 250, 235 282 C 155 316, 75 425, -10 450 Z"
                  fill="#030a17" opacity="0.68"/>
            <path d="M 18 518 C 85 430, 260 495, 290 425 M 78 352 C 165 285, 295 395, 378 320 M 64 240 C 160 165, 265 235, 368 158"
                  fill="none" stroke="#38bdf8" stroke-width="0.75" stroke-dasharray="8 5" opacity="0.22"/>

            <g stroke="rgba(123,232,255,0.09)" stroke-width="0.7">
              <line x1="356" y1="492" x2="20" y2="120"/>
              <line x1="356" y1="492" x2="210" y2="10"/>
              <line x1="356" y1="492" x2="10" y2="360"/>
              <circle cx="210" cy="280" r="175" fill="none" stroke-dasharray="4 6"/>
            </g>

            <circle cx="268" cy="60" r="62" fill="url(#${uid}-maelstrom)"/>
            <path d="${maelstromTicks}" stroke="#fbbf24" stroke-width="0.9" opacity="0.45"/>
            <circle cx="268" cy="60" r="39" fill="none" stroke="#c084fc" stroke-width="1" stroke-dasharray="10 5" opacity="0.5"/>

            <g transform="translate(22, 24)" opacity="0.84">
              <text x="0" y="0" font-family="'Orbitron', sans-serif" font-size="7.8" font-weight="800" letter-spacing="1.6" fill="#d99b38">NEBULUS SONAR CHART</text>
              <text x="0" y="10.5" font-family="'Rajdhani', sans-serif" font-size="9.2" font-weight="600" letter-spacing="1" fill="#7fa1c7">DEPTH 4,800M • 8 MONOLITHS</text>
              <path d="M 0 16 H 64 M 0 14 V 18 M 32 14.5 V 17.5 M 64 14 V 18" stroke="#63f5ff" stroke-width="0.9"/>
            </g>

            <g opacity="0.92">
              <circle cx="356" cy="492" r="36" fill="rgba(4,10,22,0.55)" stroke="url(#${uid}-brass)" stroke-width="1.1"/>
              <path d="${compassTicks}" stroke="#63f5ff" stroke-width="0.85" opacity="0.65"/>
              <path d="${compassInner}" fill="#38bdf8" opacity="0.65"/>
              <path d="${compassOuter}" fill="url(#${uid}-brass)" stroke="#050a14" stroke-width="0.8"/>
              <circle cx="356" cy="492" r="4" fill="#63f5ff" stroke="#ffffff" stroke-width="0.7"/>
              <text x="356" y="451" text-anchor="middle" font-family="'Orbitron', sans-serif" font-size="7.5" font-weight="800" fill="#ffe8a3">N</text>
            </g>

            <rect x="6" y="6" width="408" height="548" rx="7" fill="none" stroke="url(#${uid}-brass)" stroke-width="1.8" opacity="0.78"/>
            <path d="${borderTicks}" stroke="#d99b38" stroke-width="0.85" opacity="0.55"/>

            ${regionsSvg}
            ${routesSvg}
            ${nodesSvg}
          </svg>
        </div>

        <div class="spyglass-plaque" style="min-width:0;">
          <div class="spyglass-top-row">
            <div style="min-width:0;flex:1 1 160px;">
              <div class="spyglass-kicker spyglass-sector">${escapeHtml(sectorHeading)}</div>
              <div class="spyglass-title">T${activeIdx + 1} • ${escapeHtml(selTower.name)}</div>
            </div>
            ${
              assocCutKey && onPlayCutscene
                ? `<button type="button" class="spyglass-cinema-btn ${assocCutUnlocked ? '' : 'locked'}" data-spyglass-cut="${assocCutKey}" ${assocCutUnlocked ? '' : 'disabled'}>
                    <svg width="12" height="12" viewBox="0 0 24 24" aria-hidden="true">
                      <rect x="3" y="5" width="18" height="14" rx="2.5" fill="none" stroke="currentColor" stroke-width="1.8"/>
                      <path fill="currentColor" d="M10 9l6 3-6 3V9Z"/>
                    </svg>
                    <span>${assocCutLabel}</span>
                  </button>`
                : ''
            }
          </div>

          <p class="spyglass-desc spyglass-brief">${escapeHtml(briefCopy)}</p>

          <div class="spyglass-meta-row spyglass-telemetry-row" style="justify-content:space-between;">
            <div class="spyglass-stars" style="display:inline-flex;align-items:center;gap:8px;">${starMedalsHtml}</div>
            <div class="spyglass-badges-right" style="display:inline-flex;align-items:center;gap:10px;">
              <span class="spyglass-mastery" title="Mastery Diamonds (${selMastery}/5)" style="display:inline-flex;align-items:center;gap:3px;">
                ${masteryDiamondsHtml}
              </span>
              ${
                !isOriginal
                  ? `<span class="spyglass-relic ${selRelic ? 'found' : 'missing'}" style="display:inline-flex;align-items:center;gap:4px;font-size:10.5px;font-weight:700;color:${selRelic ? '#5efce8' : '#64748b'};">
                      <svg width="12" height="12" viewBox="0 0 24 24" aria-hidden="true">
                        <path fill="none" stroke="currentColor" stroke-width="1.8" d="M6.5 2.8h9L19 6.3V20a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 5 20V4.3A1.5 1.5 0 0 1 6.5 2.8ZM8.5 9h7M8.5 13h5"/>
                      </svg>
                      <span>${selRelic ? 'RELIC LOG' : 'ENCRYPTED'}</span>
                    </span>`
                  : ''
              }
            </div>
          </div>

          <div class="spyglass-actions-row">
            <button type="button" class="spyglass-deploy-btn btn-primary ${selUnlocked ? '' : 'locked'}" ${selUnlocked ? '' : 'disabled'} style="width:100%;">
              <span>${selUnlocked ? `DEPLOY TO MONOLITH • T${activeIdx + 1}` : `LOCKED • CLEAR T${activeIdx} FIRST`}</span>
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
        if (checkUnlocked(idx)) {
          onDeployTower?.(idx, towers[idx]);
        }
      });
    });

    container.querySelectorAll('.sea-cutscene-badge').forEach((badgeEl) => {
      badgeEl.addEventListener('click', (ev) => {
        ev.stopPropagation();
        const cutKey = badgeEl.getAttribute('data-cutscene-key');
        const cutIdx = Number(badgeEl.getAttribute('data-cutscene-idx')) || 0;
        if (cutKey && checkCutsceneReady(cutKey, cutIdx)) {
          onPlayCutscene?.(cutKey, cutIdx, towers[cutIdx]);
        }
      });
    });

    container.querySelectorAll('.sea-route-pill').forEach((pillEl) => {
      pillEl.addEventListener('click', (ev) => {
        ev.stopPropagation();
        const rIdx = Number(pillEl.getAttribute('data-route-idx')) || 0;
        const rt = CHART_ROUTES[rIdx];
        if (!rt) return;
        const mode = isOriginal ? 'submarine' : rt.mode;
        if (readStars(rt.from).clear && typeof onPlayRoute === 'function') {
          onPlayRoute(mode, rt.from, rt.to);
        } else {
          activeIdx = rt.to;
          renderDOM();
          onSelectTower?.(rt.to, towers[rt.to]);
        }
      });
    });

    const cinemaBtn = container.querySelector('.spyglass-cinema-btn');
    if (cinemaBtn) {
      cinemaBtn.addEventListener('click', () => {
        const cutKey = cinemaBtn.getAttribute('data-spyglass-cut');
        const cutIdx = cutKey === 'epilogue' ? 7 : sectorEntryIdx;
        if (cutKey && checkCutsceneReady(cutKey, cutIdx)) {
          onPlayCutscene?.(cutKey, cutIdx, towers[cutIdx]);
        }
      });
    }

    const deployBtn = container.querySelector('.spyglass-deploy-btn');
    if (deployBtn) {
      deployBtn.addEventListener('click', () => {
        if (checkUnlocked(activeIdx)) {
          onDeployTower?.(activeIdx, towers[activeIdx]);
        }
      });
    }
  };

  renderDOM();
}
