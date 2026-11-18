// TOWERING WATERS: GATEWAY'S DESCENT — ANCIENT AQUEDUCT SANCTUM CHAMBERS
// Pure gameplay logic & verified solvable puzzle generator leaf module (zero imports).
//
// Sunlit temple interior aqueduct sanctums behind glowing carved Sanctum Doors (`door.isRune = true`).
// Grid: x = 0..cols-1 (west to east), y = 0..rows-1 (north back wall to south entrance).
// Entrance tile is (doorX, rows-1); exit doorway threshold is (doorX, rows).
// World coordinates used by `PuzzleRenderer` (src/puzzleRenderer.js):
//   1 unit per tile, floor at y = 0, X = x - (cols-1)/2, Z = y - (rows-1)/2.
//
// Puzzle types (all deterministically generated from `seed` and verified solvable):
//  - 'lights': stomp hydro-glyph tiles to toggle self + 4 orthogonal neighbours to match the mural/clue
//  - 'bells':  chime coloured bronze water-bells in the exact order shown on exterior spire banners
//  - 'beam':   rotate brass sea-glass mirrors so the hydro-light beam ignites the target crystal
//  - 'blocks': slide carved sluice blocks onto pressure basins (tap/fire/whip = undo last push)

const TAU = Math.PI * 2;
const MOVE_T = 0.145; // crisp single-tile step duration
const PUSH_T = 0.205; // step that slides a sluice block
const REPEAT_DELAY = 0.34; // touch-tuned repeat threshold: 1 swipe = 1 exact tile step, hold = steady march
const REPEAT_STEP_GAP = 0.035; // brief settle gap between held repeat steps so thumb stops never overshoot
const HOP_T = 0.3; // stomp / hop duration
const HOP_LAND = 0.2; // stomp impact moment inside hop
const INTRO_T = 1.05;
const SOLVED_T = 2.1; // celebration before Gateway exits automatically
const LEAVE_T = 0.95;
const MIRROR_TURN_SPEED = 9; // rad/s
const BEAM_MAX_PTS = 48;
const MAX_VFX = 48;

export const PUZZLE_TYPES = ['lights', 'bells', 'beam', 'blocks'];

export const BELL_COLORS = ['#ff4f64', '#ffb02e', '#3fe07e', '#3ab0ff', '#c77dff'];
export const BELL_COLOR_NAMES = ['CORAL', 'GOLD', 'EMERALD', 'AZURE', 'VIOLET'];
export const BELL_NOTES = [0, 2, 4, 7, 9];

const TITLES = {
  lights: ['AQUEDUCT MOSAIC', 'Match the glowing Hydro-Glyph Tablet above the outer archway • Step to doorway to peek'],
  bells: ['HARMONIC BELLS', 'Chime water-bells in left-to-right order from the archway crest • Step to doorway to peek'],
  beam: ['SEA-GLASS PRISM', 'Tap or Whip beside a mirror to rotate it • ignite the harmonic crystal'],
  blocks: ['SLUICE BASINS', 'Slide the carved sluice stones onto the basins • tap or whip to undo'],
};

// Directions: 0 east (+x), 1 south (+y, toward doorway), 2 west (-x), 3 north (-y, back wall)
const DX = [1, 0, -1, 0];
const DY = [0, 1, 0, -1];
// Discrete mirror reflection: kind 0 = '/', kind 1 = '\'
const REFLECT = [
  [3, 2, 1, 0],
  [1, 0, 3, 2],
];

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (t) => t * t * (3 - 2 * t);

function removeOrdered(arr, i) {
  for (let k = i; k < arr.length - 1; k++) arr[k] = arr[k + 1];
  arr.pop();
}

// ------------------------------------------------------------------------------------ seeded RNG
function hashSeed(seed, salt) {
  let h = 2166136261 >>> 0;
  const s = `${seed}|${salt}`;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

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

const randInt = (rng, a, b) => a + Math.floor(rng() * (b - a + 1));
function shuffle(rng, arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const t = arr[i];
    arr[i] = arr[j];
    arr[j] = t;
  }
  return arr;
}

// ------------------------------------------------------------------------------------ lights
export function applyLightsPress(lit, n, idx) {
  const x = idx % n;
  const y = (idx / n) | 0;
  lit[idx] ^= 1;
  if (x > 0) lit[idx - 1] ^= 1;
  if (x < n - 1) lit[idx + 1] ^= 1;
  if (y > 0) lit[idx - n] ^= 1;
  if (y < n - 1) lit[idx + n] ^= 1;
  return lit;
}

function genLights(rng, d, hideTarget) {
  const n = d < 0.45 ? 3 : 4;
  const cols = n + 2;
  const rows = n + 2;
  const N = n * n;
  const k = clamp(2 + Math.round(d * 5), 2, N - 2);
  let target;
  let start;
  let presses;
  for (let attempt = 0; attempt < 200; attempt++) {
    target = new Array(N).fill(0);
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < Math.ceil(n / 2); x++) {
        const on = rng() < 0.5 ? 1 : 0;
        target[y * n + x] = on;
        target[y * n + (n - 1 - x)] = on;
      }
    }
    const lit = target.reduce((a, b) => a + b, 0);
    if (lit < Math.ceil(N * 0.3) || lit > Math.floor(N * 0.65)) continue;
    const cells = shuffle(rng, [...Array(N).keys()]);
    presses = cells.slice(0, k).sort((a, b) => a - b);
    start = target.slice();
    for (const p of presses) applyLightsPress(start, n, p);
    let diff = 0;
    for (let i = 0; i < N; i++) diff += start[i] !== target[i] ? 1 : 0;
    if (diff < 3) continue;
    break;
  }
  return {
    cols,
    rows,
    doorX: cols >> 1,
    solid: [],
    n,
    gx: 1,
    gy: 1,
    target,
    start,
    showTarget: !hideTarget,
    solution: presses,
    clue: { kind: 'lights', n, pattern: target.slice() },
  };
}

// ------------------------------------------------------------------------------------ bells
const BELL_SLOTS = {
  3: [
    [0, 1],
    [2, 0],
    [4, 1],
  ],
  4: [
    [0, 2],
    [1, 0],
    [3, 0],
    [4, 2],
  ],
  5: [
    [0, 3],
    [0, 1],
    [2, 0],
    [4, 1],
    [4, 3],
  ],
};

function genBells(rng, d, hideTarget = false) {
  const count = clamp(3 + Math.round(d * 2.2), 3, 5);
  const cols = 5;
  const rows = 5;
  const colors = shuffle(rng, [0, 1, 2, 3, 4]).slice(0, count);
  const bells = BELL_SLOTS[count].map(([x, y], i) => ({
    x,
    y,
    color: colors[i],
    note: BELL_NOTES[colors[i]],
  }));
  const order = shuffle(rng, [...Array(count).keys()]);
  if (d > 0.65) {
    let extra;
    do extra = Math.floor(rng() * count);
    while (extra === order[order.length - 1]);
    order.push(extra);
  }
  return {
    cols,
    rows,
    doorX: cols >> 1,
    solid: [],
    bells,
    order,
    showTarget: !hideTarget,
    solution: order.slice(),
    clue: {
      kind: 'bells',
      order: order.map((b) => bells[b].color),
      colors: order.map((b) => BELL_COLORS[bells[b].color]),
      bellIndices: order.slice(),
    },
  };
}

// ------------------------------------------------------------------------------------ beam
export function traceBeamDiscrete(p, kinds) {
  const { cols, rows, source, crystal, mirrors } = p;
  const at = new Map();
  for (let i = 0; i < mirrors.length; i++) at.set(mirrors[i].y * cols + mirrors[i].x, i);
  let x = source.x;
  let y = source.y;
  let dir = source.dir;
  const cells = [];
  for (let step = 0; step < 200; step++) {
    x += DX[dir];
    y += DY[dir];
    if (x < 0 || y < 0 || x >= cols || y >= rows) {
      return { hit: x === crystal.x && y === crystal.y, cells, exitX: x, exitY: y };
    }
    cells.push(y * cols + x);
    const m = at.get(y * cols + x);
    if (m !== undefined) dir = REFLECT[kinds[m]][dir];
  }
  return { hit: false, cells, exitX: x, exitY: y };
}

function floodFill(cols, rows, from, blocked) {
  const seen = new Set([from]);
  const q = [from];
  while (q.length) {
    const c = q.pop();
    const x = c % cols;
    const y = (c / cols) | 0;
    for (let k = 0; k < 4; k++) {
      const nx = x + DX[k];
      const ny = y + DY[k];
      if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue;
      const n = ny * cols + nx;
      if (seen.has(n) || blocked.has(n)) continue;
      seen.add(n);
      q.push(n);
    }
  }
  return seen;
}

function genBeam(rng, d) {
  const size = d < 0.5 ? 5 : 6;
  const cols = size;
  const rows = size;
  const doorX = cols >> 1;
  const entrance = (rows - 1) * cols + doorX;
  const wantM = clamp(3 + Math.round(d * 2), 3, 5);
  const inGrid = (x, y) => x >= 0 && y >= 0 && x < cols && y < rows;
  for (let attempt = 0; attempt < 4000; attempt++) {
    const M = attempt > 2400 ? Math.max(2, wantM - 1) : wantM;
    let sx;
    let sy;
    let dir0;
    const wall = Math.floor(rng() * 3);
    if (wall === 0) {
      sx = -1;
      sy = randInt(rng, 0, rows - 2);
      dir0 = 0;
    } else if (wall === 1) {
      sx = cols;
      sy = randInt(rng, 0, rows - 2);
      dir0 = 2;
    } else {
      sx = randInt(rng, 0, cols - 1);
      sy = -1;
      dir0 = 1;
    }
    let dir = dir0;
    const legOf = new Map();
    const mirrorAt = new Map();
    const mirrors = [];
    let leg = 0;
    let x = sx + DX[dir];
    let y = sy + DY[dir];
    let ok = true;
    legOf.set(y * cols + x, leg);
    for (let m = 0; m < M && ok; m++) {
      const run = randInt(rng, 0, 2);
      for (let s = 0; s < run; s++) {
        const nx = x + DX[dir];
        const ny = y + DY[dir];
        if (!inGrid(nx, ny) || mirrorAt.has(ny * cols + nx)) break;
        x = nx;
        y = ny;
        if (!legOf.has(y * cols + x)) legOf.set(y * cols + x, leg);
      }
      const c = y * cols + x;
      if (mirrorAt.has(c) || c === entrance || (legOf.has(c) && legOf.get(c) !== leg)) {
        ok = false;
        break;
      }
      const nd = (dir + (rng() < 0.5 ? 1 : 3)) % 4;
      const kind = REFLECT[0][dir] === nd ? 0 : 1;
      mirrorAt.set(c, mirrors.length);
      mirrors.push({ x, y, kind });
      dir = nd;
      leg++;
      const nx = x + DX[dir];
      const ny = y + DY[dir];
      x = nx;
      y = ny;
      if (!inGrid(nx, ny)) {
        if (m < M - 1) ok = false;
        break;
      }
      if (mirrorAt.has(ny * cols + nx)) {
        ok = false;
        break;
      }
      if (!legOf.has(y * cols + x)) legOf.set(y * cols + x, leg);
    }
    if (!ok || mirrors.length !== M) continue;
    while (inGrid(x, y)) {
      if (mirrorAt.has(y * cols + x)) {
        ok = false;
        break;
      }
      x += DX[dir];
      y += DY[dir];
    }
    if (!ok) continue;
    if (y >= rows || (x === sx && y === sy)) continue;
    const p = {
      cols,
      rows,
      source: { x: sx, y: sy, dir: dir0 },
      crystal: { x, y },
      mirrors: mirrors.map((mm) => ({ x: mm.x, y: mm.y })),
    };
    const sol = mirrors.map((mm) => mm.kind);
    if (!traceBeamDiscrete(p, sol).hit) continue;
    const blocked = new Set(mirrors.map((mm) => mm.y * cols + mm.x));
    const reach = floodFill(cols, rows, entrance, blocked);
    let reachable = true;
    for (const mm of mirrors) {
      let any = false;
      for (let k = 0; k < 4; k++) {
        const ax = mm.x + DX[k];
        const ay = mm.y + DY[k];
        if (inGrid(ax, ay) && reach.has(ay * cols + ax)) any = true;
      }
      if (!any) reachable = false;
    }
    if (!reachable) continue;
    let start = null;
    for (let tries = 0; tries < 40; tries++) {
      const s = sol.map((k) => (rng() < 0.6 ? 1 - k : k));
      const flips = s.reduce((a, k, i) => a + (k !== sol[i] ? 1 : 0), 0);
      if (flips < (M >= 3 ? 2 : 1)) continue;
      if (traceBeamDiscrete(p, s).hit) continue;
      start = s;
      break;
    }
    if (!start) continue;
    p.mirrors.forEach((mm, i) => {
      mm.rot = start[i];
    });
    p.doorX = doorX;
    p.solid = [];
    p.solution = sol;
    p.clue = { kind: 'beam', mirrors: p.mirrors.length };
    return p;
  }
  throw new Error('beam generation failed');
}

// ------------------------------------------------------------------------------------ blocks
export function solveBlocks(p, blocksIn, playerIn, maxStates = 400000) {
  const { cols, rows } = p;
  const N = cols * rows;
  const solid = new Uint8Array(N);
  for (const c of p.solid) solid[c] = 1;
  const plateSet = new Set(p.plates.map((q) => q.y * cols + q.x));
  const nb = blocksIn.length;
  const enc = (pl, bs) => {
    let k = pl;
    for (let i = 0; i < nb; i++) k = k * N + bs[i];
    return k;
  };
  const start = blocksIn.map((b) => b.y * cols + b.x).sort((a, b) => a - b);
  const p0 = playerIn.y * cols + playerIn.x;
  const k0 = enc(p0, start);
  const prev = new Map([[k0, -1]]);
  const how = new Map();
  const push = new Map([[k0, 0]]);
  let frontier = [[p0, start]];
  const isGoal = (bs) => bs.every((b) => plateSet.has(b));
  if (isGoal(start)) return { moves: '', pushes: 0 };
  const LET = 'ESWN';
  while (frontier.length) {
    const next = [];
    for (const [pl, bs] of frontier) {
      const key = enc(pl, bs);
      const px = pl % cols;
      const py = (pl / cols) | 0;
      for (let k = 0; k < 4; k++) {
        const nx = px + DX[k];
        const ny = py + DY[k];
        if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue;
        const n = ny * cols + nx;
        if (solid[n]) continue;
        let nbs = bs;
        let pushed = 0;
        const bi = bs.indexOf(n);
        if (bi >= 0) {
          const bx = nx + DX[k];
          const by = ny + DY[k];
          if (bx < 0 || by < 0 || bx >= cols || by >= rows) continue;
          const b2 = by * cols + bx;
          if (solid[b2] || bs.includes(b2)) continue;
          nbs = bs.slice();
          nbs[bi] = b2;
          nbs.sort((a, b) => a - b);
          pushed = 1;
        }
        const nk = enc(n, nbs);
        if (prev.has(nk)) continue;
        prev.set(nk, key);
        how.set(nk, k);
        push.set(nk, push.get(key) + pushed);
        if (pushed && isGoal(nbs)) {
          let s = '';
          let c = nk;
          while (prev.get(c) !== -1) {
            s = LET[how.get(c)] + s;
            c = prev.get(c);
          }
          return { moves: s, pushes: push.get(nk) };
        }
        next.push([n, nbs]);
        if (prev.size > maxStates) return null;
      }
    }
    frontier = next;
  }
  return null;
}

function genBlocks(rng, d) {
  const nBlocks = d < 0.55 ? 1 : 2;
  const cols = 5;
  const rows = d < 0.3 ? 5 : 6;
  const N = cols * rows;
  const doorX = cols >> 1;
  const entrance = (rows - 1) * cols + doorX;
  const wantPushes = Math.round(lerp(3, 9, d)) + (nBlocks - 1) * 2;
  let best = null;
  for (let attempt = 0; attempt < 400; attempt++) {
    const solid = [];
    const nPill = randInt(rng, 1, 2 + Math.round(d * 2));
    const keepFree = new Set([entrance, entrance - cols]);
    for (let i = 0; i < nPill; i++) {
      const c = Math.floor(rng() * N);
      if (keepFree.has(c) || solid.includes(c)) continue;
      solid.push(c);
    }
    const solidSet = new Set(solid);
    const plates = [];
    for (let tries = 0; plates.length < nBlocks && tries < 60; tries++) {
      const x = randInt(rng, 0, cols - 1);
      const y = randInt(rng, 0, rows - 2);
      const c = y * cols + x;
      if (solidSet.has(c) || keepFree.has(c) || plates.some((q) => q.y * cols + q.x === c)) continue;
      plates.push({ x, y });
    }
    if (plates.length < nBlocks) continue;
    let blocks = plates.map((q) => q.y * cols + q.x);
    let player = -1;
    {
      const occ = new Set([...solid, ...blocks]);
      const free = [...Array(N).keys()].filter((c) => !occ.has(c));
      player = free[Math.floor(rng() * free.length)];
    }
    const pulls = randInt(rng, 6, 10 + Math.round(d * 24));
    for (let s = 0; s < pulls; s++) {
      const blocked = new Set([...solid, ...blocks]);
      const reach = floodFill(cols, rows, player, blocked);
      const opts = [];
      for (let bi = 0; bi < blocks.length; bi++) {
        const bx = blocks[bi] % cols;
        const by = (blocks[bi] / cols) | 0;
        for (let k = 0; k < 4; k++) {
          const cx = bx + DX[k];
          const cy = by + DY[k];
          const ex = bx + 2 * DX[k];
          const ey = by + 2 * DY[k];
          if (ex < 0 || ey < 0 || ex >= cols || ey >= rows) continue;
          const c = cy * cols + cx;
          const e = ey * cols + ex;
          if (!reach.has(c) || blocked.has(e)) continue;
          opts.push([bi, c, e]);
        }
      }
      if (!opts.length) break;
      const [bi, c, e] = opts[Math.floor(rng() * opts.length)];
      blocks = blocks.slice();
      blocks[bi] = c;
      player = e;
    }
    if (blocks.includes(entrance)) continue;
    if (blocks.some((b) => plates.some((q) => q.y * cols + q.x === b))) continue;
    const reach = floodFill(cols, rows, player, new Set([...solid, ...blocks]));
    if (!reach.has(entrance)) continue;
    const p = { cols, rows, solid, plates };
    const blockObjs = blocks.map((b) => ({ x: b % cols, y: (b / cols) | 0 }));
    const sol = solveBlocks(p, blockObjs, { x: doorX, y: rows - 1 });
    if (!sol) continue;
    const score = Math.abs(sol.pushes - wantPushes);
    if (!best || score < best.score) best = { score, p, blockObjs, sol };
    if (score <= 1 && sol.pushes >= 2) break;
  }
  if (!best) throw new Error('blocks generation failed');
  return {
    cols: best.p.cols,
    rows: best.p.rows,
    doorX,
    solid: best.p.solid,
    plates: best.p.plates,
    blocks: best.blockObjs,
    solution: best.sol.moves,
    pushes: best.sol.pushes,
    clue: { kind: 'blocks', plates: best.p.plates.length, blocks: best.blockObjs.length },
  };
}

function resolvePuzzleType(seed = 1, forcedType = null, fallbackType = null) {
  if (forcedType && PUZZLE_TYPES.includes(forcedType)) return forcedType;
  if (fallbackType && PUZZLE_TYPES.includes(fallbackType)) return fallbackType;
  return PUZZLE_TYPES[Math.abs(hashSeed(seed, 'pick')) % PUZZLE_TYPES.length] || 'lights';
}

// ------------------------------------------------------------------------------------ public API
/**
 * Builds a deterministic, verified-solvable puzzle description.
 * @param {{ type?: 'lights'|'bells'|'beam'|'blocks'|null, forcedType?: 'lights'|'bells'|'beam'|'blocks'|null, seed?: number|string, difficulty?: number, hideTarget?: boolean }} [o]
 */
export function makePuzzle({
  type = null,
  forcedType = null,
  seed = 1,
  difficulty = 0.3,
  hideTarget = false,
} = {}) {
  const resolvedType =
    forcedType && PUZZLE_TYPES.includes(forcedType)
      ? forcedType
      : type && PUZZLE_TYPES.includes(type)
        ? type
        : type === null && forcedType === null
          ? 'lights'
          : resolvePuzzleType(seed, forcedType, type);
  const d = clamp(Number(difficulty) || 0, 0, 1);
  const rng = mulberry32(hashSeed(seed, resolvedType));
  let p;
  if (resolvedType === 'lights') p = genLights(rng, d, hideTarget);
  else if (resolvedType === 'bells') p = genBells(rng, d, hideTarget);
  else if (resolvedType === 'beam') p = genBeam(rng, d);
  else p = genBlocks(rng, d);
  let parMoves = 12;
  if (resolvedType === 'lights') {
    parMoves = Math.max(6, (p.solution?.length || 3) * 4 + 4);
  } else if (resolvedType === 'bells') {
    parMoves = Math.max(8, (p.order?.length || 3) * 4 + 4);
  } else if (resolvedType === 'beam') {
    const flips = (p.mirrors || []).reduce((a, m, i) => a + ((m.rot & 1) !== p.solution[i] ? 1 : 0), 0);
    parMoves = Math.max(8, flips * 5 + 5);
  } else {
    parMoves = Math.max(8, Math.ceil((p.solution?.length || 8) * 1.45) + 3);
  }
  const parTime = Math.max(14, Math.round(12 + parMoves * 1.6));
  const [title, hint] = TITLES[resolvedType];
  return { v: 1, type: resolvedType, seed, difficulty: d, title, hint, parMoves, parTime, ...p };
}

/**
 * Pure deterministic exterior clue helper running the exact same RNG & puzzle generation path
 * as `makePuzzle` and `new PuzzleRoom({ seed, difficulty, forcedType, door: { isRune: true } })`.
 * @param {{ seed?: number|string, difficulty?: number, forcedType?: 'lights'|'bells'|'beam'|'blocks'|null, type?: 'lights'|'bells'|'beam'|'blocks'|null }} [o]
 */
export function peekPuzzleClue({ seed = 1, difficulty = 0, forcedType = null, type = null } = {}) {
  const resolvedType = resolvePuzzleType(seed, forcedType, type);
  const p = makePuzzle({
    type: resolvedType,
    seed,
    difficulty,
    hideTarget: resolvedType === 'lights' || resolvedType === 'bells',
  });
  return {
    type: p.type,
    clue: p.clue,
    parMoves: p.parMoves,
    parTime: p.parTime,
  };
}

/** Returns true when `st` represents a solved state for puzzle `p`. */
export function isPuzzleSolvedState(p, st) {
  if (p.type === 'lights') return st.lit.every((v, i) => v === p.target[i]);
  if (p.type === 'bells') return st.progress >= p.order.length;
  if (p.type === 'beam') return traceBeamDiscrete(p, st.rots.map((r) => r & 1)).hit;
  const plateSet = new Set(p.plates.map((q) => q.y * p.cols + q.x));
  return st.blocks.every((b) => plateSet.has(b.y * p.cols + b.x));
}

// ------------------------------------------------------------------------------------ view maths
function makeView() {
  return {
    fov: 40,
    eye: [0, 8, 6],
    target: [0, 0, 0],
    aspect: 1,
    r: [1, 0, 0],
    u: [0, 1, 0],
    f: [0, 0, -1],
    tanH: 0.36,
  };
}

function setViewBasis(v) {
  const fx = v.target[0] - v.eye[0];
  const fy = v.target[1] - v.eye[1];
  const fz = v.target[2] - v.eye[2];
  const fl = Math.hypot(fx, fy, fz) || 1;
  v.f[0] = fx / fl;
  v.f[1] = fy / fl;
  v.f[2] = fz / fl;
  let rx = -v.f[2];
  let rz = v.f[0];
  const rl = Math.hypot(rx, rz) || 1;
  rx /= rl;
  rz /= rl;
  v.r[0] = rx;
  v.r[1] = 0;
  v.r[2] = rz;
  v.u[0] = 0 * v.f[2] - rz * v.f[1];
  v.u[1] = rz * v.f[0] - rx * v.f[2];
  v.u[2] = rx * v.f[1] - 0 * v.f[0];
  v.tanH = Math.tan((v.fov * Math.PI) / 360);
}

// ------------------------------------------------------------------------------------ PuzzleRoom
export class PuzzleRoom {
  /**
   * @param {{ seed?: number|string, difficulty?: number, forcedType?: string|null, type?: string|null, door?: object|null, puzzle?: object|null, width?: number, height?: number, worldIndex?: number, palette?: object|null, alreadySolved?: boolean, solveBonus?: number, hideTarget?: boolean }} [opts]
   */
  constructor(opts = null) {
    this.width = 390;
    this.height = 620;
    this.s = 1;
    this.active = false;
    this.phase = 'idle'; // idle | intro | play | solved | leaving | done
    this.solved = false;
    this.t = 0;
    this.vfx = [];
    this._vfxId = 0;
    this.view = makeView();
    // In Next-Gen 4-Mode InputController, controlled upward slide/stick/D-pad always emits `up`/`analogY`,
    // while quick TAP or FIRE/JUMP triggers the context action (`jumpIsUp = false`).
    this.jumpIsUp = false;
    this.puzzle = null;
    this.type = 'lights';
    this.cols = 5;
    this.rows = 5;
    this.doorX = 2;
    this.showTarget = true;
    this.peekAlpha = 1;
    this.isPeekingClue = false;
    this._peekHoldT = 0;
    this.gateway = this._makeHero();
    this.pogo = this.gateway; // compatibility alias for PuzzleRenderer
    this.hud = { title: '', line: '', status: '', rev: 0 };
    this.beam = {
      pts: new Float32Array(BEAM_MAX_PTS * 2),
      n: 0,
      hit: false,
      sweeping: false,
      rev: 0,
    };
    this._sp = { x: 0, y: 0 };
    this._held = [0, 0, 0, 0];
    this._was = [false, false, false, false];
    this._dirs = [false, false, false, false];
    this._wasJump = false;
    this._wasFire = false;
    this._wasWhip = false;

    if (
      opts &&
      typeof opts === 'object' &&
      (opts.puzzle || opts.seed !== undefined || opts.forcedType || opts.type || opts.door)
    ) {
      this.start(opts);
    }
  }

  _makeHero() {
    return {
      x: 0,
      y: 0,
      px: 0,
      py: 0,
      fromX: 0,
      fromY: 0,
      moveT: 1,
      moveDur: MOVE_T,
      moving: false,
      facing: 3,
      hop: 0,
      hopT: -1,
      bump: 0,
      bumpT: -1,
      speed: 0,
      acts: 0,
      stomps: 0,
      pushes: 0,
      idle: 0,
      alpha: 1,
      outside: 0,
      celebrate: false,
      emote: null,
      emoteT: 0,
    };
  }

  /**
   * @param {{ width?: number, height?: number, puzzle?: object|null, seed?: number|string, difficulty?: number, forcedType?: string|null, type?: string|null, door?: object|null, hideTarget?: boolean, worldIndex?: number, palette?: object|null, alreadySolved?: boolean, solveBonus?: number }} [o]
   */
  start({
    width = 390,
    height = 620,
    puzzle = null,
    seed = undefined,
    difficulty = undefined,
    forcedType = null,
    type = null,
    door = null,
    hideTarget = undefined,
    worldIndex = 0,
    palette = null,
    alreadySolved = false,
    solveBonus = 0,
  } = {}) {
    this.width = Math.max(200, width);
    this.height = Math.max(240, height);
    this.s = clamp(Math.sqrt((this.width * this.height) / (390 * 700)), 0.8, 1.6);
    let p = puzzle || door?._puzzle || null;
    if (!p) {
      const effSeed = seed ?? door?.puzzleSeed ?? 1;
      const effDiff = difficulty ?? door?.puzzleDifficulty ?? 0.3;
      const hasExplicitSeedOrType =
        seed !== undefined || forcedType !== null || type !== null || Boolean(door);
      const effType = hasExplicitSeedOrType
        ? resolvePuzzleType(effSeed, forcedType ?? door?.puzzleType ?? null, type)
        : 'lights';
      const effHide =
        hideTarget !== undefined
          ? Boolean(hideTarget)
          : Boolean(door?.isRune && (effType === 'lights' || effType === 'bells'));
      p = makePuzzle({ type: effType, seed: effSeed, difficulty: effDiff, hideTarget: effHide });
    }
    this.puzzle = p;
    this.type = p.type;
    this.puzzleType = p.type;
    this.cols = p.cols;
    this.rows = p.rows;
    this.doorX = p.doorX;
    this.showTarget = p.showTarget !== false;
    this.target = p.target || null;
    this.order = p.order || null;
    this.clue = p.clue || null;
    this.worldIndex = worldIndex | 0;
    this.palette = palette || { glow: '#5efce8' };
    this.glow = this.palette.glow || '#5efce8';
    this.solveBonus = solveBonus || 0;
    this.active = true;
    this.phase = 'intro';
    this.t = 0;
    this.playT = 0;
    this.timeSec = 0;
    this.phaseT = 0;
    this.solved = false;
    this.wasSolved = !!alreadySolved;
    this.solvedT = 0;
    this.fade = 1;
    this.moves = 0;
    this.parMoves = p.parMoves || 12;
    this.parTime = p.parTime || Math.max(14, Math.round(12 + this.parMoves * 1.6));
    this.parCleared = false;
    const hiddenClue = !this.showTarget && (p.type === 'lights' || p.type === 'bells');
    this._peekHoldT = hiddenClue && !this.wasSolved ? 2.8 : 0;
    this.peekAlpha = !hiddenClue || this.wasSolved ? 1 : 0.94;
    this.isPeekingClue = hiddenClue && !this.wasSolved;
    this.progressRatio = alreadySolved ? 1 : 0;
    this.gateOpen = alreadySolved ? 1 : 0;
    this.undos = 0;
    this.wrongs = 0;
    this.hintLevel = 0;
    this.rewardT = -1;
    this.collectT = -1;
    this._finished = false;
    this._introBanner = false;
    this._autoWalking = false;
    this._nothingCount = 0;
    this._wasHit = false;
    this._leaveBy = 'door';
    this._autoPath = null;
    this._fireBuf = false;
    this._buffer = -1;
    this._bufferFresh = false;
    this._pendingStomp = false;
    this.vfx.length = 0;
    this._held.fill(0);
    this._was.fill(true); // ignore entry slide-up until released or redirected
    this._wasJump = true;
    this._wasFire = true;
    this._wasWhip = true;
    this.tileCount = this.cols * this.rows;
    this.solid = new Uint8Array(this.tileCount);
    for (const c of p.solid || []) this.solid[c] = 1;
    this.entranceCell = (this.rows - 1) * this.cols + this.doorX;

    if (p.type === 'lights') {
      this.n = p.n;
      this.lit = Uint8Array.from(p.start);
      this.flipAt = new Float32Array(p.n * p.n).fill(-10);
      this.matched = 0;
    } else if (p.type === 'bells') {
      this.bells = p.bells.map((b) => ({ ...b, ringAt: -10, swing: 0, wrongAt: -10 }));
      for (const b of this.bells) this.solid[b.y * this.cols + b.x] = 1;
      this.progress = 0;
      this.progressAt = -10;
      this.wrongAt = -10;
      this.hintBell = -1;
      this.rung = [];
    } else if (p.type === 'beam') {
      this.mirrors = p.mirrors.map((m) => ({
        x: m.x,
        y: m.y,
        rot: m.rot,
        angle: -Math.PI / 4 + m.rot * (Math.PI / 2),
        turnAt: -10,
        lit: 0,
      }));
      for (const m of this.mirrors) this.solid[m.y * this.cols + m.x] = 1;
      this.source = { ...p.source };
      this.crystal = { ...p.crystal };
      this.charge = 0;
      this.hitAt = -10;
    } else {
      this.blocks = p.blocks.map((b) => ({
        x: b.x,
        y: b.y,
        px: b.x,
        py: b.y,
        fromX: b.x,
        fromY: b.y,
        moveT: 1,
        onPlate: false,
        plateAt: -10,
      }));
      this.plates = p.plates.map((q) => ({ x: q.x, y: q.y, pressed: 0 }));
      this.history = [];
      this._updatePlates(null, null, true);
    }
    if (this.wasSolved) this._applySolution();

    const po = this.gateway;
    Object.assign(po, this._makeHero());
    this.pogo = this.gateway;
    po.x = this.doorX;
    po.y = this.rows - 1;
    po.fromX = this.doorX;
    po.fromY = this.rows;
    po.px = this.doorX;
    po.py = this.rows;
    po.moveT = 0;
    po.moveDur = INTRO_T * 0.75;
    po.moving = true;
    po.facing = 3;

    const [title, line] = TITLES[p.type];
    this._setHud(
      title,
      this.wasSolved ? 'Aqueduct Sanctum open • step down through the archway' : line,
      this.wasSolved ? 'OPEN' : `PAR ${this.parMoves}`
    );
    if (p.type === 'lights' && p.showTarget && !this.wasSolved) {
      this._setHud(title, 'Tap, Whip, or Jump on a glyph to stomp it • match the glowing stele', `PAR ${this.parMoves}`);
    } else if (p.type === 'bells' && p.showTarget && !this.wasSolved) {
      this._setHud(title, 'Tap or Whip beside a water-bell to chime it • match the stele sequence', `PAR ${this.parMoves}`);
    }
    this._layout();
    this._traceBeam();
    this._refreshProgressRatio();
    this._updateViewFollow(1);
  }

  /**
   * Illuminates the hidden outer doorway clue on the interior mural stele for `duration` seconds.
   * Called automatically on doorway entry/threshold step, or via the HUD `[PEEK CLUE]` button.
   */
  peekClue(duration = 3.2) {
    if (!this.puzzle) return 0;
    const hold = Math.max(0.8, Number(duration) || 3.2);
    this._peekHoldT = Math.max(this._peekHoldT || 0, hold);
    this.isPeekingClue = true;
    this.peekAlpha = Math.max(this.peekAlpha || 0, 0.45);
    return this.peekAlpha;
  }

  isAtDoorwayThreshold() {
    const po = this.gateway;
    if (!po) return false;
    if (this.phase === 'intro' || this.t <= 1.4) return true;
    return po.y >= this.rows - 1 && Math.abs(po.x - this.doorX) <= 1;
  }

  _updatePeekClue(dt) {
    const hiddenClue = !this.showTarget && (this.type === 'lights' || this.type === 'bells');
    if (!hiddenClue || this.solved || this.wasSolved) {
      this.peekAlpha = clamp((this.peekAlpha ?? 1) + dt * 6, 0, 1);
      this.isPeekingClue = false;
      this._peekHoldT = 0;
      return;
    }
    const atDoor = this.isAtDoorwayThreshold();
    if (atDoor) {
      this._peekHoldT = Math.max(this._peekHoldT || 0, 2.8);
    } else {
      this._peekHoldT = Math.max(0, (this._peekHoldT || 0) - dt);
    }
    const wantPeek = atDoor || this._peekHoldT > 0;
    this.isPeekingClue = wantPeek;
    if (wantPeek) {
      this.peekAlpha = clamp((this.peekAlpha || 0) + dt * 5.8, 0, 1);
    } else {
      this.peekAlpha = clamp((this.peekAlpha || 0) - dt * 2.1, 0, 1);
    }
  }

  _applySolution() {
    const p = this.puzzle;
    this.solved = true;
    if (p.type === 'lights') this.lit = Uint8Array.from(p.target);
    else if (p.type === 'bells') {
      this.progress = p.order.length;
      this.rung = p.order.map((b) => p.bells[b].color);
    } else if (p.type === 'beam') {
      this.mirrors.forEach((m, i) => {
        m.rot = p.solution[i];
        m.angle = -Math.PI / 4 + m.rot * (Math.PI / 2);
      });
      this.charge = 1;
    } else {
      this.blocks.forEach((b, i) => {
        b.x = b.px = b.fromX = p.plates[i].x;
        b.y = b.py = b.fromY = p.plates[i].y;
      });
      this._updatePlates(null, null, true);
    }
  }

  get finished() {
    return this._finished;
  }

  get results() {
    const freshlySolved = this.solved && !this.wasSolved;
    return {
      type: this.type,
      puzzleType: this.type,
      solved: freshlySolved,
      everSolved: this.solved,
      time: this.playT,
      timeSec: this.playT,
      moves: this.moves,
      parMoves: this.parMoves,
      parCleared: this.parCleared,
      undos: this.undos,
      wrongs: this.wrongs,
      hintUsed: this.hintLevel > 0,
      reward: freshlySolved
        ? {
            starCore: 1,
            gears: 10 + (this.parCleared ? 5 : 0),
            parBonusGears: this.parCleared ? 5 : 0,
            timeBonus: 15,
            starfish: 1,
            key: 1,
            bonus: this.solveBonus + (this.parCleared ? 500 : 0),
          }
        : null,
      leftBy: this._leaveBy,
    };
  }

  resize(width, height) {
    if (!width || !height) return;
    this.width = Math.max(200, width);
    this.height = Math.max(240, height);
    this.s = clamp(Math.sqrt((this.width * this.height) / (390 * 700)), 0.8, 1.6);
    if (this.puzzle) this._layout();
  }

  // ------------------------------------------------------------------ view / mapping
  worldX(x) {
    return x - (this.cols - 1) / 2;
  }

  worldZ(y) {
    return y - (this.rows - 1) / 2;
  }

  get radius() {
    return Math.hypot(this.cols / 2 + 0.9, this.rows / 2 + 0.6) + 0.35;
  }

  _layout() {
    const v = this.view;
    const W = this.width;
    const H = this.height;
    const aspect = W / H;
    const wide = aspect > 1.15;
    v.aspect = aspect;
    // Tight heroic telephoto FOV minimizes perspective distortion while framing stele + archway cleanly
    v.fov = aspect < 0.75 ? 30 : aspect < 1.2 ? 31 : 29;
    const cols = this.cols;
    const rows = this.rows;
    const hx = cols * 0.48 + (this.type === 'beam' ? 0.58 : 0.22);
    const zBack = -rows * 0.5 - 0.25;
    const zFront = rows * 0.5 + 0.58;
    const steleX = -Math.max(2.15, cols * 0.46) - 0.62;
    const steleZ = this.worldZ(0) - 0.95;
    const steleTop = this.type === 'beam' ? 1.65 : 2.52;
    const pts = (this._fitPts = this._fitPts || []);
    pts.length = 0;
    pts.push(
      [-hx, 0, zFront],
      [hx, 0, zFront],
      [0, -0.1, zFront + 0.28],
      [-hx, 0, zBack],
      [hx, 0, zBack],
      [steleX, 0, steleZ],
      [steleX, steleTop, steleZ],
      [0, 2.38, steleZ - 0.22],
      [hx * 0.85, 1.85, zBack - 0.22]
    );
    // Portrait reserves top space for `#hud` + `#puzzle-hud` / `hudPanel` and bottom touch controls;
    // Landscape docks HUD into left/right side gutters (`0..24%` and `76..100%`) so center top/bottom stay open!
    const topSafe = wide ? Math.max(18, H * 0.055) : 162 * Math.min(1.18, this.s);
    const botSafe = wide ? Math.max(38, H * 0.105) : 112 * Math.min(1.18, this.s);
    const sideSafe = wide ? Math.max(20, W * 0.185) : 10 * this.s;
    let best = null;
    // Heroic 3/4 isometric angle (36..44 deg pitch with subtle -10 deg azimuth)
    for (let deg = 36; deg <= 44; deg += 2) {
      const pitch = (deg * Math.PI) / 180;
      const dist = this._fitDist(pitch, pts, topSafe, botSafe, sideSafe);
      const ax = this.project(-0.5, 0, 0, this._sp).x;
      const bx = this.project(0.5, 0, 0, this._sp).x;
      const ay = this.project(0, 0, -0.5, this._sp).y;
      const by = this.project(0, 0, 0.5, this._sp).y;
      const score = Math.sqrt(Math.abs(bx - ax) * Math.abs(by - ay)) * (1 - Math.abs(deg - 38) * 0.012);
      if (!best || score > best.score) best = { score, pitch, dist };
    }
    // In landscape, keep 1.00x exact fit so stele + full grid + south exit archway never clip;
    // in portrait, pull slightly closer (0.95x) while keeping stele & archway inside safe bounds.
    const heroDist = wide ? best.dist : best.dist * 0.95;
    this._fitDist(best.pitch, pts, topSafe, botSafe, sideSafe, heroDist);
    v.pitch = best.pitch;
    v.dist = heroDist;
    v.baseEye = [v.eye[0], v.eye[1], v.eye[2]];
    v.baseTarget = [v.target[0], v.target[1], v.target[2]];
  }

  _fitDist(pitch, pts, topSafe, botSafe, sideSafe, forcedDist = 0) {
    const v = this.view;
    const W = this.width;
    const H = this.height;
    const tz = 0.08;
    const az = -0.175; // subtle 3/4 isometric azimuth so 2 stone faces & Gateway's 3/4 profile read crisply
    const sinAz = Math.sin(az);
    const cosAz = Math.cos(az);
    let lo = 2.5;
    let hi = 70;
    const place = (dist, shift) => {
      v.target[0] = 0;
      v.target[1] = 0.32;
      v.target[2] = tz;
      const horiz = Math.cos(pitch) * dist;
      v.eye[0] = sinAz * horiz;
      v.eye[1] = v.target[1] + Math.sin(pitch) * dist;
      v.eye[2] = tz + cosAz * horiz;
      setViewBasis(v);
      if (shift) {
        for (let k = 0; k < 3; k++) {
          v.target[k] += v.u[k] * shift;
          v.eye[k] += v.u[k] * shift;
        }
      }
    };
    const extent = () => {
      let minX = Infinity;
      let maxX = -Infinity;
      let minY = Infinity;
      let maxY = -Infinity;
      for (const p of pts) {
        const sp = this.project(p[0], p[1], p[2], this._sp);
        minX = Math.min(minX, sp.x);
        maxX = Math.max(maxX, sp.x);
        minY = Math.min(minY, sp.y);
        maxY = Math.max(maxY, sp.y);
      }
      return [minX, maxX, minY, maxY];
    };
    if (forcedDist > 0) {
      hi = forcedDist;
    } else {
      for (let it = 0; it < 28; it++) {
        const dist = (lo + hi) / 2;
        place(dist, 0);
        const [minX, maxX, minY, maxY] = extent();
        const fits = minX >= sideSafe && maxX <= W - sideSafe && maxY - minY <= H - topSafe - botSafe;
        if (fits) hi = dist;
        else lo = dist;
      }
    }
    place(hi, 0);
    for (let it = 0; it < 2; it++) {
      const [, , minY, maxY] = extent();
      const want = (topSafe + (H - botSafe)) / 2;
      const have = (minY + maxY) / 2;
      const pxToWorld = (2 * v.tanH * hi) / H;
      const shift = (want - have) * pxToWorld;
      for (let k = 0; k < 3; k++) {
        v.target[k] += v.u[k] * shift;
        v.eye[k] += v.u[k] * shift;
      }
      setViewBasis(v);
    }
    return hi;
  }

  _updateViewFollow(dt) {
    const v = this.view;
    if (!v.baseEye || !v.baseTarget) return;
    const po = this.gateway;
    const wide = this.width / this.height > 1.15;
    const wx = clamp(this.worldX(po.px ?? po.x), -2.2, 2.2);
    const wz = clamp(this.worldZ(po.py ?? po.y), -2.2, 2.4);
    const follow = wide ? 0.09 : this.phase === 'solved' ? 0.15 : 0.22;
    const solvedShift = wide ? 0.18 : 0.38;
    const wantTx = v.baseTarget[0] + wx * follow;
    const wantTz = v.baseTarget[2] + wz * follow * 0.82 - (this.phase === 'solved' ? solvedShift : 0);
    const wantEx = v.baseEye[0] + wx * follow * 0.72;
    const wantEz = v.baseEye[2] + wz * follow * 0.65 - (this.phase === 'solved' ? solvedShift * 1.25 : 0);
    const k = dt >= 0.9 ? 1 : 1 - Math.exp(-5.5 * dt);
    v.target[0] += (wantTx - v.target[0]) * k;
    v.target[2] += (wantTz - v.target[2]) * k;
    v.eye[0] += (wantEx - v.eye[0]) * k;
    v.eye[2] += (wantEz - v.eye[2]) * k;
    setViewBasis(v);
  }

  _refreshProgressRatio() {
    if (this.solved) {
      this.progressRatio = 1;
      return;
    }
    if (this.type === 'lights' && this.lit && this.puzzle?.target) {
      let m = 0;
      for (let i = 0; i < this.lit.length; i++) if (this.lit[i] === this.puzzle.target[i]) m++;
      this.matched = m;
      this.progressRatio = this.lit.length ? m / this.lit.length : 0;
    } else if (this.type === 'bells' && this.puzzle?.order) {
      this.progressRatio = this.puzzle.order.length ? this.progress / this.puzzle.order.length : 0;
    } else if (this.type === 'beam' && this.mirrors) {
      let litCount = 0;
      for (const m of this.mirrors) if (m.lit) litCount++;
      const mRatio = this.mirrors.length ? (litCount / this.mirrors.length) * 0.78 : 0;
      this.progressRatio = clamp(this.beam.hit ? 1 : mRatio + (this.charge || 0) * 0.22, 0, 1);
    } else if (this.plates) {
      this.progressRatio = this.plates.length ? (this.platesOn || 0) / this.plates.length : 0;
    }
  }

  project(x, y, z, out = { x: 0, y: 0 }) {
    const v = this.view;
    const dx = x - v.eye[0];
    const dy = y - v.eye[1];
    const dz = z - v.eye[2];
    const cx = dx * v.r[0] + dy * v.r[1] + dz * v.r[2];
    const cy = dx * v.u[0] + dy * v.u[1] + dz * v.u[2];
    const cz = Math.max(1e-3, dx * v.f[0] + dy * v.f[1] + dz * v.f[2]);
    const nx = cx / cz / (v.tanH * v.aspect);
    const ny = cy / cz / v.tanH;
    out.x = (nx + 1) * 0.5 * this.width;
    out.y = (1 - ny) * 0.5 * this.height;
    return out;
  }

  tileScreen(x, y, h = 0, out = this._sp) {
    return this.project(this.worldX(x), h, this.worldZ(y), out);
  }

  // ------------------------------------------------------------------ helpers
  _setHud(title, line, status) {
    const h = this.hud;
    if (title !== null && title !== undefined) h.title = title;
    if (line !== null && line !== undefined) h.line = line;
    if (status !== null && status !== undefined) h.status = status;
    h.rev++;
  }

  _vfx(kind, x, y, { life = 0.6, a = 0, b = 0, color = '' } = {}) {
    if (this.vfx.length >= MAX_VFX) this.vfx.shift();
    this.vfx.push({ id: ++this._vfxId, kind, x, y, life, maxLife: life, a, b, color });
  }

  _fxAt(fx, x, y, h, color, count, spd) {
    const sp = this.tileScreen(x, y, h);
    fx.particles?.(sp.x, sp.y, color, count, spd * this.s);
  }

  _popupAt(fx, x, y, h, text, color) {
    const sp = this.tileScreen(x, y, h);
    fx.popup?.(sp.x, sp.y, text, color);
  }

  _inGrid(x, y) {
    return x >= 0 && y >= 0 && x < this.cols && y < this.rows;
  }

  _blockAt(x, y) {
    if (this.type !== 'blocks') return -1;
    for (let i = 0; i < this.blocks.length; i++) {
      if (this.blocks[i].x === x && this.blocks[i].y === y) return i;
    }
    return -1;
  }

  _free(x, y) {
    return this._inGrid(x, y) && !this.solid[y * this.cols + x] && this._blockAt(x, y) < 0;
  }

  // ------------------------------------------------------------------ main update
  update(dt, input = {}, firePressed = false, fx = {}) {
    if (!this.active) return this._finished;
    if (this._finished) return true;
    dt = clamp(Number(dt) || 0, 0, 0.05);
    const sound = fx.sound || null;
    this.t += dt;
    this.phaseT += dt;
    this._fx = fx;

    const src = input && typeof input === 'object' && input.state ? input.state : (input || {});
    this._readInput(input, src, dt);

    const jp = input?.justPressed || src?.justPressed || null;
    const jump = !!src.jump;
    const jumpEdge = (jump && !this._wasJump) || Boolean(jp?.jump);
    const fireNow = !!src.fire;
    const fireEdge = (fireNow && !this._wasFire) || Boolean(jp?.fire);
    const whipNow = !!src.whip;
    const whipEdge = (whipNow && !this._wasWhip) || Boolean(jp?.whip);
    this._wasJump = jump;
    this._wasFire = fireNow;
    this._wasWhip = whipNow;

    const fire =
      Boolean(firePressed) || whipEdge || (this.jumpIsUp === true ? fireEdge : fireEdge || jumpEdge);

    const po = this.gateway;
    if (this.phase === 'intro') {
      this.fade = Math.max(0, 1 - this.phaseT / 0.55);
      if (this.phaseT >= INTRO_T * 0.35 && !this._introBanner) {
        this._introBanner = true;
        fx.banner?.(this.wasSolved ? 'SOLVED' : 'AQUEDUCT SANCTUM', this.puzzle.title);
        sound?.puzzleEnter ? sound.puzzleEnter() : sound?.door?.();
      }
      this._stepHero(dt, sound);
      if (this.phaseT >= INTRO_T) {
        this.phase = 'play';
        this.phaseT = 0;
        this._buffer = -1;
        this._fireBuf = false;
      }
    } else if (this.phase === 'play' || this.phase === 'solved') {
      this.fade = 0;
      if (this.phase === 'play') {
        this.playT += dt;
        this.timeSec = this.playT;
      }
      this._stepHero(dt, sound);
      if (this._repeatGapT > 0) this._repeatGapT = Math.max(0, this._repeatGapT - dt);
      if (fire) this._fireBuf = true;
      // Zero-lag action response: allow buffered tap to trigger immediately once hop impact (`HOP_LAND`) has landed
      if (!po.moving && (po.hopT < 0 || (this._fireBuf && po.hopT >= HOP_LAND)) && this.phase !== 'leaving') {
        if (this._fireBuf) {
          this._fireBuf = false;
          po.hopT = -1;
          po.hop = 0;
          this._interact(fx, sound);
        } else if (po.hopT < 0) {
          this._tryInputMove(fx, sound);
        }
      }
      if (this.phase === 'solved') {
        this.solvedT += dt;
        if (this.collectT < 0 && this.solvedT >= 1.15) {
          this.collectT = this.t;
          this._vfx('collect', po.px, po.py, { life: 0.8 });
          (sound?.collectStar || sound?.collect)?.call(sound, 4);
          (sound?.gatewayCheer || sound?.victory)?.call(sound);
          this._popupAt(fx, po.px, po.py, 1.6, 'HARMONIC SEED +10 GEARS', '#fde047');
          fx.particles?.(
            this.tileScreen(po.px, po.py, 1.1).x,
            this._sp.y,
            '#fde047',
            18,
            140 * this.s
          );
        }
        const earlyExit = fire && this.solvedT >= 1.25;
        if ((this.solvedT >= SOLVED_T || earlyExit) && !po.moving && po.hopT < 0 && this.phase === 'solved') {
          this._fireBuf = false;
          this._beginAutoExit(sound);
        }
      }
    } else if (this.phase === 'leaving') {
      this._stepLeaving(dt, sound);
    }

    this._updatePuzzle(dt, fx, sound);
    this._updatePeekClue(dt);
    this._refreshProgressRatio();
    if (this.solved) {
      this.gateOpen = clamp(this.gateOpen + dt * 0.72, 0, 1);
    }
    this._updateViewFollow(dt);
    if (po.emoteT > 0) {
      po.emoteT -= dt;
      if (po.emoteT <= 0) po.emote = null;
    }

    for (let i = this.vfx.length - 1; i >= 0; i--) {
      const e = this.vfx[i];
      e.life -= dt;
      if (e.life <= 0) removeOrdered(this.vfx, i);
    }
    if (this.phase === 'done') {
      this._finished = true;
      return true;
    }
    return false;
  }

  _readInput(rawInput, src, dt) {
    // 4-Mode Dual-Compatible Touch & Gesture Adapter (`analogX`/`analogY` + `left`/`right`/`up`/`down` + `justPressed`)
    const ax = Number(src.analogX ?? src.axisX ?? rawInput?.analogX ?? rawInput?.axisX) || 0;
    const ay = Number(src.analogY ?? src.axisY ?? rawInput?.analogY ?? rawInput?.axisY) || 0;
    const jp = rawInput?.justPressed || src?.justPressed || null;
    const d = this._dirs;
    d[0] = ax > 0.25 || !!src.right || !!jp?.right;
    d[2] = ax < -0.25 || !!src.left || !!jp?.left;
    d[1] = ay > 0.34 || !!src.down || !!jp?.down;
    d[3] = ay < -0.34 || !!src.up || !!jp?.up || (this.jumpIsUp === true && !!src.jump);

    for (let k = 0; k < 4; k++) {
      if (d[k]) {
        if (!this._was[k]) {
          this._held[k] = 0;
          this._buffer = k;
          this._bufferFresh = true;
        } else {
          this._held[k] += dt;
        }
      } else {
        this._held[k] = 0;
      }
      this._was[k] = d[k];
    }
    if (this._buffer >= 0 && !d[this._buffer] && this._held[this._buffer] === 0 && !this._bufferFresh) {
      this._buffer = -1;
    }
  }

  _tryInputMove(fx, sound) {
    let dir = -1;
    let fresh = false;
    if (this._buffer >= 0) {
      dir = this._buffer;
      fresh = true;
      this._buffer = -1;
      this._bufferFresh = false;
      this._repeatGapT = 0;
    } else if (!(this._repeatGapT > 0)) {
      let best = Infinity;
      for (let k = 0; k < 4; k++) {
        if (this._dirs[k] && this._held[k] >= REPEAT_DELAY && this._held[k] < best) {
          best = this._held[k];
          dir = k;
        }
      }
      if (dir >= 0) this._repeatGapT = REPEAT_STEP_GAP;
    }
    if (dir >= 0) this._tryMove(dir, fresh, fx, sound);
  }

  // ------------------------------------------------------------------ Gateway stepping
  _stepHero(dt, sound) {
    const po = this.gateway;
    if (po.moving) {
      po.moveT = Math.min(1, po.moveT + dt / po.moveDur);
      const k = this.phase === 'intro' ? smooth(po.moveT) : po.moveT;
      const ox = po.px;
      const oy = po.py;
      po.px = lerp(po.fromX, po.x, k);
      po.py = lerp(po.fromY, po.y, k);
      po.speed = dt > 0 ? Math.hypot(po.px - ox, po.py - oy) / dt : 0;
      if (this.type === 'blocks') {
        for (const b of this.blocks) {
          if (b.moveT < 1) {
            b.moveT = Math.min(1, b.moveT + dt / po.moveDur);
            b.px = lerp(b.fromX, b.x, b.moveT);
            b.py = lerp(b.fromY, b.y, b.moveT);
          }
        }
      }
      if (po.moveT >= 1) {
        po.moving = false;
        po.px = po.x;
        po.py = po.y;
        if (this.type === 'blocks') this._settleBlocks();
      }
      po.idle = 0;
    } else {
      po.speed *= Math.exp(-14 * dt);
      po.idle += dt;
    }

    if (po.hopT >= 0) {
      const prev = po.hopT;
      po.hopT += dt;
      const k = clamp(po.hopT / HOP_LAND, 0, 1);
      po.hop = po.hopT < HOP_LAND ? Math.sin(k * Math.PI) * 0.42 : 0;
      if (prev < HOP_LAND && po.hopT >= HOP_LAND) this._land(sound);
      if (po.hopT >= HOP_T) {
        po.hopT = -1;
        po.hop = 0;
      }
      po.idle = 0;
    }

    if (po.bumpT >= 0) {
      po.bumpT += dt;
      po.bump = Math.sin(clamp(po.bumpT / 0.16, 0, 1) * Math.PI) * 0.16;
      if (po.bumpT >= 0.16) {
        po.bumpT = -1;
        po.bump = 0;
      }
    }
  }

  _tryMove(dir, fresh, fx, sound) {
    const po = this.gateway;
    po.facing = dir;
    if (po.x === this.doorX && po.y === this.rows - 1 && dir === 1) {
      if (fresh) this._beginLeaving('door', sound);
      return;
    }
    const nx = po.x + DX[dir];
    const ny = po.y + DY[dir];
    if (!this._inGrid(nx, ny) || this.solid[ny * this.cols + nx]) {
      this._bump(fresh, sound);
      return;
    }
    const bi = this._blockAt(nx, ny);
    let dur = MOVE_T;
    if (bi >= 0) {
      const bx = nx + DX[dir];
      const by = ny + DY[dir];
      if (!this._free(bx, by) || this.phase === 'solved') {
        this._bump(fresh, sound);
        return;
      }
      const b = this.blocks[bi];
      this.history.push({ bi, fx: b.x, fy: b.y, px: po.x, py: po.y });
      b.fromX = b.x;
      b.fromY = b.y;
      b.x = bx;
      b.y = by;
      b.moveT = 0;
      dur = PUSH_T;
      po.pushes++;
      this._vfx('push', nx, ny, { life: 0.5, a: dir, b: bi });
      sound?.puzzleBlock ? sound.puzzleBlock() : sound?.crumble?.();
    }
    po.fromX = po.x;
    po.fromY = po.y;
    po.x = nx;
    po.y = ny;
    po.moveT = 0;
    po.moveDur = dur;
    po.moving = true;
    this.moves++;
    if (this.moves % 2 === 0 || bi >= 0) {
      sound?.footstep ? sound.footstep('stone') : sound?.stepUp?.();
    }
    void fx;
  }

  _bump(fresh, sound) {
    const po = this.gateway;
    if (!fresh) return;
    po.bumpT = 0;
    this._vfx('bump', po.x + DX[po.facing] * 0.5, po.y + DY[po.facing] * 0.5, {
      life: 0.35,
      a: po.facing,
    });
    sound?.puzzleBump ? sound.puzzleBump() : sound?.land?.(0.25);
  }

  _hop() {
    const po = this.gateway;
    po.hopT = 0;
    po.hop = 0;
  }

  _land(sound) {
    const po = this.gateway;
    const fx = this._fx || {};
    if (this._pendingStomp && this.type === 'lights') {
      this._pendingStomp = false;
      const gx = po.x - this.puzzle.gx;
      const gy = po.y - this.puzzle.gy;
      const n = this.n;
      if (gx >= 0 && gy >= 0 && gx < n && gy < n) {
        const idx = gy * n + gx;
        applyLightsPress(this.lit, n, idx);
        this.flipAt[idx] = this.t;
        const nb = [idx - 1, idx + 1, idx - n, idx + n];
        const ok = [gx > 0, gx < n - 1, gy > 0, gy < n - 1];
        for (let k = 0; k < 4; k++) if (ok[k]) this.flipAt[nb[k]] = this.t + 0.075;
        po.stomps++;
        this.moves++;
        this._vfx('stomp', po.x, po.y, { life: 0.7, a: this.lit[idx] });
        this._vfx('conduit_surge', po.x, po.y, { life: 0.65, a: this.lit[idx] });
        fx.shake?.(2.2);
        fx.haptic?.(14);
        this._fxAt(fx, po.x, po.y, 0.1, this.lit[idx] ? this.glow : '#94a9c9', 10, 110);
        sound?.puzzleTile ? sound.puzzleTile(this.lit[idx] ? 1 : 0) : sound?.land?.(0.7);
        this._setHud(null, null, `PAR ${this.moves}/${this.parMoves}`);
        this._checkLights(fx, sound);
        return;
      }
    }
    this._vfx('hopland', po.x, po.y, { life: 0.4 });
    sound?.land?.(0.35);
  }

  _interact(fx, sound) {
    const po = this.gateway;
    const type = this.type;
    if (this.phase === 'solved' && type !== 'lights') {
      this._hop();
      return;
    }
    if (type === 'lights') {
      this._pendingStomp = this.phase === 'play';
      this._hop();
      sound?.jump?.();
      return;
    }
    if (type === 'blocks') {
      this._undo(fx, sound);
      return;
    }
    const pick = (test) => {
      for (let j = 0; j < 4; j++) {
        const k = (po.facing + j) % 4;
        const i = test(po.x + DX[k], po.y + DY[k]);
        if (i >= 0) {
          po.facing = k;
          return i;
        }
      }
      return -1;
    };
    if (type === 'bells') {
      const bi = pick((x, y) => this.bells.findIndex((b) => b.x === x && b.y === y));
      if (bi < 0) {
        this._hop();
        this._nothingHint('Stand adjacent to a bell, then tap');
        return;
      }
      po.acts++;
      this._ringBell(bi, fx, sound);
    } else if (type === 'beam') {
      const mi = pick((x, y) => this.mirrors.findIndex((m) => m.x === x && m.y === y));
      if (mi < 0) {
        this._hop();
        this._nothingHint('Stand adjacent to a mirror, then tap');
        return;
      }
      po.acts++;
      const m = this.mirrors[mi];
      m.rot = (m.rot + 1) & 3;
      m.turnAt = this.t;
      this.moves++;
      this._vfx('rotate', m.x, m.y, { life: 0.5, b: mi });
      fx.haptic?.(12);
      this._setHud(null, null, `PAR ${this.moves}/${this.parMoves}`);
      sound?.puzzleMirror ? sound.puzzleMirror() : sound?.switchToggle?.();
    }
  }

  _nothingHint(text) {
    this._nothingCount = (this._nothingCount || 0) + 1;
    if (this._nothingCount >= 2) this._setHud(null, text, null);
  }

  // ------------------------------------------------------------------ leaving
  _beginLeaving(by, sound) {
    if (this.phase === 'leaving' || this.phase === 'done') return;
    this.phase = 'leaving';
    this.phaseT = 0;
    this._leaveBy = by;
    const po = this.gateway;
    po.facing = 1;
    po.fromX = po.x;
    po.fromY = po.y;
    po.x = this.doorX;
    po.y = this.rows + 0.9;
    po.moveT = 0;
    po.moveDur = LEAVE_T * 0.85;
    po.moving = true;
    this._vfx('exit', this.doorX, this.rows, { life: LEAVE_T });
    sound?.puzzleLeave ? sound.puzzleLeave() : sound?.door?.();
  }

  _beginAutoExit(sound) {
    const po = this.gateway;
    const path = this._pathTo(po.x, po.y, this.doorX, this.rows - 1);
    if (path === null) {
      this._beginLeaving('auto', sound);
      return;
    }
    this._autoPath = path;
    this.phase = 'leaving';
    this.phaseT = 0;
    this._leaveBy = 'auto';
    this._autoWalking = true;
  }

  _pathTo(sx, sy, tx, ty) {
    const cols = this.cols;
    const start = sy * cols + sx;
    const goal = ty * cols + tx;
    if (start === goal) return [];
    const prev = new Int32Array(this.tileCount).fill(-2);
    prev[start] = -1;
    const q = [start];
    while (q.length) {
      const c = q.shift();
      if (c === goal) break;
      const x = c % cols;
      const y = (c / cols) | 0;
      for (let k = 0; k < 4; k++) {
        const nx = x + DX[k];
        const ny = y + DY[k];
        if (!this._free(nx, ny)) continue;
        const n = ny * cols + nx;
        if (prev[n] !== -2) continue;
        prev[n] = c;
        q.push(n);
      }
    }
    if (prev[goal] === -2) return null;
    const path = [];
    for (let c = goal; c !== start; c = prev[c]) path.unshift(c);
    return path;
  }

  _stepLeaving(dt, sound) {
    const po = this.gateway;
    if (this._autoWalking) {
      this._stepHero(dt * 1.25, sound);
      if (!po.moving) {
        if (this._autoPath.length) {
          const c = this._autoPath.shift();
          const nx = c % this.cols;
          const ny = (c / this.cols) | 0;
          po.facing = nx > po.x ? 0 : nx < po.x ? 2 : ny > po.y ? 1 : 3;
          po.fromX = po.x;
          po.fromY = po.y;
          po.x = nx;
          po.y = ny;
          po.moveT = 0;
          po.moveDur = MOVE_T;
          po.moving = true;
        } else {
          this._autoWalking = false;
          this.phase = 'solved';
          this._beginLeaving('auto', sound);
        }
      }
      return;
    }
    this._stepHero(dt, sound);
    const k = clamp(this.phaseT / LEAVE_T, 0, 1);
    po.outside = clamp((po.py - (this.rows - 1)) / 1.9, 0, 1);
    po.alpha = 1 - smooth(clamp((k - 0.55) / 0.4, 0, 1));
    this.fade = smooth(clamp((k - 0.35) / 0.6, 0, 1));
    if (this.phaseT >= LEAVE_T) this.phase = 'done';
  }

  // ------------------------------------------------------------------ puzzles
  _updatePuzzle(dt, fx, sound) {
    if (this.type === 'beam') {
      this._updateBeam(dt, fx, sound);
    } else if (this.type === 'bells') {
      for (const b of this.bells) {
        const since = this.t - b.ringAt;
        b.swing = since < 3 ? Math.sin(since * 9) * Math.exp(-since * 1.6) * 0.5 : 0;
      }
    }
  }

  _checkLights(fx, sound) {
    let m = 0;
    for (let i = 0; i < this.lit.length; i++) if (this.lit[i] === this.puzzle.target[i]) m++;
    this.matched = m;
    if (m === this.lit.length && this.phase === 'play') this._solve(fx, sound);
  }

  _ringBell(bi, fx, sound) {
    const p = this.puzzle;
    const b = this.bells[bi];
    b.ringAt = this.t;
    this.moves++;
    this._vfx('ring', b.x, b.y, { life: 1.6, b: bi, color: BELL_COLORS[b.color] });
    sound?.puzzleBell ? sound.puzzleBell(b.note, b.color) : sound?.collect?.(b.note);
    if (this.phase !== 'play') return;
    const want = p.order[this.progress];
    if (bi === want) {
      this.progress++;
      this.progressAt = this.t;
      this.rung.push(b.color);
      this._fxAt(fx, b.x, b.y, 1.3, BELL_COLORS[b.color], 8, 90);
      if (this.progress >= p.order.length) {
        this._solve(fx, sound);
        return;
      }
      if (this.hintLevel >= 2) this.hintBell = p.order[this.progress];
      else this.hintBell = -1;
    } else {
      this.wrongs++;
      this.wrongAt = this.t;
      b.wrongAt = this.t;
      this._vfx('wrong', b.x, b.y, { life: 1.0, b: bi });
      sound?.puzzleWrong ? sound.puzzleWrong() : sound?.vaultFail?.();
      this.rung.length = 0;
      this.progress = 0;
      if (bi === p.order[0]) {
        this.progress = 1;
        this.rung.push(b.color);
      }
      if (this.wrongs >= 3 && this.hintLevel === 0) {
        this.hintLevel = 1;
        this._setHud(null, 'Hint: the glowing bell rings first • step to doorway to peek crest', null);
        this._vfx('hint', 0, 0, { life: 1 });
      }
      if (this.wrongs >= 6 && this.hintLevel === 1) {
        this.hintLevel = 2;
        this._setHud(null, 'Hint: follow each glowing bell in sequence', null);
      }
      if (this.hintLevel === 1) this.hintBell = this.progress === 0 ? p.order[0] : -1;
      else if (this.hintLevel >= 2) this.hintBell = p.order[this.progress];
    }
  }

  _undo(fx, sound) {
    const po = this.gateway;
    const h = this.history.pop();
    if (!h) {
      this._hop();
      this._nothingHint('Walk into a rune block to push it');
      return;
    }
    this.undos++;
    const b = this.blocks[h.bi];
    b.fromX = b.x;
    b.fromY = b.y;
    b.x = h.fx;
    b.y = h.fy;
    b.moveT = 0;
    po.fromX = po.x;
    po.fromY = po.y;
    po.x = h.px;
    po.y = h.py;
    po.moveT = 0;
    po.moveDur = PUSH_T;
    po.moving = true;
    po.facing = h.fx > h.px ? 0 : h.fx < h.px ? 2 : h.fy > h.py ? 1 : 3;
    this._vfx('undo', b.x, b.y, { life: 0.6, b: h.bi });
    sound?.puzzleUndo ? sound.puzzleUndo() : sound?.switchToggle?.();
    void fx;
  }

  _settleBlocks() {
    this._updatePlates(this._fx, this._fx?.sound, false);
  }

  _updatePlates(fx, sound, silent) {
    let on = 0;
    for (const q of this.plates) q.pressed = 0;
    for (let i = 0; i < this.blocks.length; i++) {
      const b = this.blocks[i];
      const qi = this.plates.findIndex((q) => q.x === b.x && q.y === b.y);
      const was = b.onPlate;
      b.onPlate = qi >= 0;
      if (qi >= 0) {
        this.plates[qi].pressed = 1;
        on++;
        if (!was && !silent) {
          b.plateAt = this.t;
          this._vfx('plate', b.x, b.y, { life: 0.9, b: i });
          this._vfx('conduit_surge', b.x, b.y, { life: 0.75, b: i });
          if (fx) {
            this._fxAt(fx, b.x, b.y, 0.5, this.glow, 12, 120);
            fx.haptic?.(18);
          }
          sound?.puzzlePlate ? sound.puzzlePlate() : sound?.vaultTick?.(true);
        }
      }
    }
    this.platesOn = on;
    const statusTxt = `${on}/${this.plates.length} • ${this.moves}/${this.parMoves}`;
    if (!silent) this._setHud(null, null, statusTxt);
    else this.hud.status = statusTxt;
    if (!silent && on === this.plates.length && this.phase === 'play') {
      this._solve(fx || {}, sound);
    }
  }

  _traceBeam() {
    if (this.type !== 'beam') return;
    const bm = this.beam;
    const pts = bm.pts;
    const cols = this.cols;
    const rows = this.rows;
    const src = this.source;
    let n = 0;
    const put = (x, y) => {
      if (n < BEAM_MAX_PTS) {
        pts[n * 2] = x;
        pts[n * 2 + 1] = y;
        n++;
      }
    };
    let dir = src.dir;
    let x = src.x;
    let y = src.y;
    put(x + DX[dir] * 0.42, y + DY[dir] * 0.42);
    let hit = false;
    let sweeping = false;
    const hitMirror = this._mirrorLit || (this._mirrorLit = new Uint8Array(8));
    hitMirror.fill(0);
    for (let step = 0; step < 120; step++) {
      x += DX[dir];
      y += DY[dir];
      if (x < 0 || y < 0 || x >= cols || y >= rows) {
        if (x === this.crystal.x && y === this.crystal.y) {
          hit = true;
          put(x - DX[dir] * 0.12, y - DY[dir] * 0.12);
        } else {
          put(x - DX[dir] * 0.52, y - DY[dir] * 0.52);
        }
        break;
      }
      let mi = -1;
      for (let i = 0; i < this.mirrors.length; i++) {
        if (this.mirrors[i].x === x && this.mirrors[i].y === y) mi = i;
      }
      if (mi < 0) continue;
      const m = this.mirrors[mi];
      hitMirror[mi] = 1;
      put(x, y);
      const settle = -Math.PI / 4 + m.rot * (Math.PI / 2);
      if (Math.abs(m.angle - settle) > 0.02) {
        const ux = Math.cos(m.angle);
        const uy = Math.sin(m.angle);
        const ddx = DX[dir];
        const ddy = DY[dir];
        const dot = ddx * ux + ddy * uy;
        const rx = 2 * dot * ux - ddx;
        const ry = 2 * dot * uy - ddy;
        let tMax = 30;
        const x0 = -0.5;
        const x1 = cols - 0.5;
        const y0 = -0.5;
        const y1 = rows - 0.5;
        if (rx > 1e-4) tMax = Math.min(tMax, (x1 - x) / rx);
        else if (rx < -1e-4) tMax = Math.min(tMax, (x0 - x) / rx);
        if (ry > 1e-4) tMax = Math.min(tMax, (y1 - y) / ry);
        else if (ry < -1e-4) tMax = Math.min(tMax, (y0 - y) / ry);
        put(x + rx * tMax, y + ry * tMax);
        sweeping = true;
        break;
      }
      dir = REFLECT[m.rot & 1][dir];
    }
    let bounces = 0;
    for (let i = 0; i < this.mirrors.length; i++) {
      const wasLit = this.mirrors[i].lit;
      this.mirrors[i].lit = hitMirror[i];
      if (hitMirror[i]) bounces++;
      if (!wasLit && hitMirror[i] && this.phase === 'play' && this.t > 0.2) {
        this._vfx('prism_bounce', this.mirrors[i].x, this.mirrors[i].y, {
          life: 0.55,
          b: i,
          a: bounces,
        });
      }
    }
    bm.bounces = bounces;
    if (bm.n !== n || bm.hit !== hit || bm.sweeping !== sweeping) bm.rev++;
    bm.n = n;
    bm.hit = hit;
    bm.sweeping = sweeping;
  }

  _updateBeam(dt, fx, sound) {
    let settled = true;
    for (const m of this.mirrors) {
      const target = -Math.PI / 4 + m.rot * (Math.PI / 2);
      let want = target;
      while (want < m.angle - 1e-6) want += TAU;
      const d = want - m.angle;
      if (d > 1e-4) {
        m.angle += Math.min(d, MIRROR_TURN_SPEED * dt);
        settled = false;
      }
      if (m.angle > TAU * 2) m.angle -= TAU;
      if (Math.abs(want - m.angle) <= 1e-4) m.angle = want;
    }
    for (const m of this.mirrors) {
      const target = -Math.PI / 4 + m.rot * (Math.PI / 2);
      if (Math.abs((((m.angle - target) % TAU) + TAU) % TAU) < 1e-3) m.angle = target;
    }
    this._traceBeam();
    const wasHit = this._wasHit;
    const hit = this.beam.hit && settled;
    this._wasHit = hit;
    this.charge = clamp(this.charge + (hit ? dt * 1.6 : -dt * 3), 0, 1);
    if (hit && !wasHit) {
      this.hitAt = this.t;
      this._vfx('crystal', this.crystal.x, this.crystal.y, { life: 1.2 });
      if (this.phase === 'play') this._solve(fx, sound);
    }
  }

  _solve(fx, sound) {
    if (this.solved) return;
    this.solved = true;
    this.phase = 'solved';
    this.phaseT = 0;
    this.solvedT = 0;
    this.rewardT = this.t;
    this.hintBell = -1;
    const withinPar = !this.wasSolved && this.moves <= this.parMoves;
    this.parCleared = withinPar;
    const po = this.gateway;
    po.celebrate = true;
    po.emote = 'joy';
    po.emoteT = 1.6;
    this._vfx('solve', (this.cols - 1) / 2, (this.rows - 1) / 2, { life: 2.6 });
    this._vfx('gate_open', (this.cols - 1) / 2, -0.6, { life: 2.8 });
    if (withinPar) {
      fx.addGears?.(5);
      fx.addScore?.(500);
      this._setHud(null, 'Par Mastery • Aqueduct Sanctum Open • +5 Bonus Gears!', 'PAR +5G');
      fx.banner?.('AQUEDUCT SANCTUM OPEN', 'HARMONIC SEED • PAR BONUS +5 GEARS');
      this._popupAt(
        fx,
        (this.cols - 1) / 2,
        (this.rows - 1) / 2,
        1.85,
        'PAR MASTER +5 GEARS!',
        '#5efce8'
      );
    } else {
      this._setHud(null, 'Aqueduct Sanctum Open • Harmonic Seed & Gears unlocked', 'SOLVED');
      fx.banner?.('AQUEDUCT SANCTUM OPEN', 'HARMONIC SEED UNLOCKED');
    }
    fx.shake?.(5.5);
    fx.haptic?.(30);
    const c = this.tileScreen((this.cols - 1) / 2, (this.rows - 1) / 2, 1.4);
    fx.particles?.(c.x, c.y, this.glow, 28, 195 * this.s);
    fx.particles?.(c.x, c.y, '#fde047', 20, 160 * this.s);
    if (this.solveBonus > 0) {
      fx.addScore?.(this.solveBonus);
      this._popupAt(
        fx,
        (this.cols - 1) / 2,
        (this.rows - 1) / 2,
        2.35,
        `+${this.solveBonus}`,
        '#fde047'
      );
    }
    sound?.puzzleSolve ? sound.puzzleSolve() : sound?.vaultUnlock?.();
  }
}
