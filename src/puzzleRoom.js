// Hidden puzzle rooms: small chambers inside a tower, behind a rune door.
//
// Pure gameplay logic (no THREE), mirroring the submarine stage (src/subStage.js): the room lives on
// a small tile grid, and everything the game's fx systems need (particles, popups) is handed over in
// CSS-pixel screen coordinates through the `fx` callbacks. The view (camera) that maps the grid to
// the screen is defined HERE, in plain maths (`this.view`, `project()`), and `PuzzleRenderer`
// (src/puzzleRenderer.js) copies it into its THREE camera, so what you see is exactly where the
// popups land.
//
// Grid: x = 0..cols-1 (left to right), y = 0..rows-1 (back wall to front). The way out is below the
// front row: the ENTRANCE tile is (doorX, rows-1) and the DOOR is (doorX, rows). World space used by
// the renderer: 1 unit per tile, floor at y = 0, X = x - (cols-1)/2, Z = y - (rows-1)/2.
//
// Puzzle types (all generated from a seed and always solvable, see makePuzzle):
//  'lights' rune floor: stomp (tap) on a rune to flip it and its 4 neighbours; match the mural
//  'bells'  ring the coloured bells (tap next to one) in the order painted on the tower outside
//  'beam'   turn mirrors (tap next to one) so the light beam reaches the crystal
//  'blocks' push the rune blocks onto the pressure plates (tap = undo the last push)

const TAU = Math.PI * 2;
const MOVE_T = 0.15; // seconds per tile step
const PUSH_T = 0.21; // a step that pushes a block
const REPEAT_DELAY = 0.3; // a held direction starts auto-stepping after this long
const HOP_T = 0.3; // stomp / hop
const HOP_LAND = 0.2; // the stomp lands (rune flips) this far into the hop
const INTRO_T = 1.05;
const SOLVED_T = 3.4; // celebration before Pogo walks out on his own
const LEAVE_T = 0.95;
const MIRROR_TURN_SPEED = 9; // rad/s
const BEAM_MAX_PTS = 48;
const MAX_VFX = 48;

export const PUZZLE_TYPES = ['lights', 'bells', 'beam', 'blocks'];

// Bell colours (the clue banners painted on the tower must use these, by index) and their notes
// (semitones above the chamber's root, a major pentatonic so any order sounds musical).
export const BELL_COLORS = ['#ff4f64', '#ffb02e', '#3fe07e', '#3ab0ff', '#c77dff'];
export const BELL_COLOR_NAMES = ['RED', 'GOLD', 'GREEN', 'BLUE', 'VIOLET'];
export const BELL_NOTES = [0, 2, 4, 7, 9];

const TITLES = {
  lights: ['RUNE FLOOR', 'Tap to stomp a rune · match the mural'],
  bells: ['BELL CHAMBER', 'Tap by a bell to ring it · the banners outside know the order'],
  beam: ['LIGHT BEAM', 'Tap by a mirror to turn it · light the crystal'],
  blocks: ['STONE PLATES', 'Push the rune blocks onto the plates · tap to undo'],
};

// directions: 0 east (+x), 1 south (+y, toward the door), 2 west, 3 north (back wall)
const DX = [1, 0, -1, 0];
const DY = [0, 1, 0, -1];
// discrete mirror reflection, kind 0 = '/', kind 1 = '\'
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
    // a left-right symmetric rune pattern, 30-65% lit (it reads like a glyph when painted outside)
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
    if (diff < 3) continue; // presses that (nearly) cancel out make a dull puzzle
    break;
  }
  return {
    cols,
    rows,
    doorX: cols >> 1,
    solid: [],
    n,
    gx: 1, // rune grid origin inside the room (a one-tile walkway runs around it)
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

function genBells(rng, d) {
  const count = clamp(3 + Math.round(d * 2.2), 3, 5);
  const cols = 5;
  const rows = 5;
  const colors = shuffle(rng, [0, 1, 2, 3, 4]).slice(0, count);
  const bells = BELL_SLOTS[count].map(([x, y], i) => ({ x, y, color: colors[i], note: BELL_NOTES[colors[i]] }));
  const order = shuffle(rng, [...Array(count).keys()]);
  if (d > 0.65) {
    // one bell rings twice (never twice in a row)
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
    solution: order.slice(),
    clue: { kind: 'bells', order: order.map((b) => bells[b].color), colors: order.map((b) => BELL_COLORS[bells[b].color]) },
  };
}

// ------------------------------------------------------------------------------------ beam
// Trace the beam through the grid with the given mirror kinds (0 '/', 1 '\'). Returns
// { hit, cells } where cells are the grid cells the beam crosses.
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
    if (x < 0 || y < 0 || x >= cols || y >= rows) return { hit: x === crystal.x && y === crystal.y, cells, exitX: x, exitY: y };
    cells.push(y * cols + x);
    const m = at.get(y * cols + x);
    if (m !== undefined) dir = REFLECT[kinds[m]][dir];
  }
  return { hit: false, cells, exitX: x, exitY: y };
}

function genBeam(rng, d) {
  const size = d < 0.5 ? 5 : 6;
  const cols = size;
  const rows = size;
  const doorX = cols >> 1;
  const entrance = (rows - 1) * cols + doorX;
  const M = clamp(2 + Math.round(d * 3), 2, 5);
  const inGrid = (x, y) => x >= 0 && y >= 0 && x < cols && y < rows;
  for (let attempt = 0; attempt < 4000; attempt++) {
    // source on the west, east or north wall (never the front: that's the door side)
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
    const legOf = new Map(); // cell -> index of the beam leg that crossed it
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
      // a mirror can't sit where an earlier leg passed straight through (it would bend that too)
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
    // run straight out of the grid
    while (inGrid(x, y)) {
      if (mirrorAt.has(y * cols + x)) {
        ok = false;
        break;
      }
      x += DX[dir];
      y += DY[dir];
    }
    if (!ok) continue;
    // the crystal sits on a side or back wall, never the door side, never on the source
    if (y >= rows || (x === sx && y === sy)) continue;
    const p = { cols, rows, source: { x: sx, y: sy, dir: dir0 }, crystal: { x, y }, mirrors: mirrors.map((mm) => ({ x: mm.x, y: mm.y })) };
    const sol = mirrors.map((mm) => mm.kind);
    if (!traceBeamDiscrete(p, sol).hit) continue;
    // every mirror must be reachable on foot (stand next to it)
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
    // scramble: flip some mirrors so the beam misses
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
    // mirror rotation (quarter turns): kind = rot % 2 ('/' at even, '\\' at odd)
    p.mirrors.forEach((mm, i) => {
      mm.rot = start[i];
    });
    p.doorX = doorX;
    p.solid = [];
    p.solution = sol;
    p.clue = null;
    return p;
  }
  throw new Error('beam generation failed');
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

// ------------------------------------------------------------------------------------ blocks
// Forward BFS over (player cell, block cells). Returns { moves: 'ENSW...', pushes } or null.
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
    // plates away from the walls a little (so a block on a plate isn't hopeless to get off a wall)
    const plates = [];
    for (let tries = 0; plates.length < nBlocks && tries < 60; tries++) {
      const x = randInt(rng, 0, cols - 1);
      const y = randInt(rng, 0, rows - 2);
      const c = y * cols + x;
      if (solidSet.has(c) || keepFree.has(c) || plates.some((q) => q.y * cols + q.x === c)) continue;
      plates.push({ x, y });
    }
    if (plates.length < nBlocks) continue;
    // reverse play: blocks start on the plates, Pogo PULLS them around
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
          // player stands at b + dir, walks to b + 2 dir, dragging the block to b + dir
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
    // Pogo walks in through the door: the entrance must be free and connected to where he ended
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
    clue: null,
  };
}

// ------------------------------------------------------------------------------------ public
/**
 * Build a plain, serialisable puzzle description.
 * @param {{type?: 'lights'|'bells'|'beam'|'blocks', seed?: number|string, difficulty?: number, hideTarget?: boolean}} o
 *   difficulty 0..1. hideTarget (lights only): don't show the target mural inside the chamber (the
 *   player has to read the pattern painted on the tower).
 */
export function makePuzzle({ type = 'lights', seed = 1, difficulty = 0.3, hideTarget = false } = {}) {
  if (!PUZZLE_TYPES.includes(type)) type = 'lights';
  const d = clamp(Number(difficulty) || 0, 0, 1);
  const rng = mulberry32(hashSeed(seed, type));
  let p;
  if (type === 'lights') p = genLights(rng, d, hideTarget);
  else if (type === 'bells') p = genBells(rng, d);
  else if (type === 'beam') p = genBeam(rng, d);
  else p = genBlocks(rng, d);
  const [title, hint] = TITLES[type];
  return { v: 1, type, seed, difficulty: d, title, hint, ...p };
}

/** True when the puzzle state in `room` is solved (also used by tests). */
export function isPuzzleSolvedState(p, st) {
  if (p.type === 'lights') return st.lit.every((v, i) => v === p.target[i]);
  if (p.type === 'bells') return st.progress >= p.order.length;
  if (p.type === 'beam') return traceBeamDiscrete(p, st.rots.map((r) => r & 1)).hit;
  const plateSet = new Set(p.plates.map((q) => q.y * p.cols + q.x));
  return st.blocks.every((b) => plateSet.has(b.y * p.cols + b.x));
}

// ------------------------------------------------------------------------------------ view maths
// Perspective projection identical to THREE.PerspectiveCamera + lookAt(target) with up = +Y.
function makeView() {
  return { fov: 40, eye: [0, 8, 6], target: [0, 0, 0], aspect: 1, r: [1, 0, 0], u: [0, 1, 0], f: [0, 0, -1], tanH: 0.36 };
}

function setViewBasis(v) {
  const fx = v.target[0] - v.eye[0];
  const fy = v.target[1] - v.eye[1];
  const fz = v.target[2] - v.eye[2];
  const fl = Math.hypot(fx, fy, fz) || 1;
  v.f[0] = fx / fl;
  v.f[1] = fy / fl;
  v.f[2] = fz / fl;
  // r = f x up(0,1,0)
  let rx = -v.f[2];
  let rz = v.f[0];
  const rl = Math.hypot(rx, rz) || 1;
  rx /= rl;
  rz /= rl;
  v.r[0] = rx;
  v.r[1] = 0;
  v.r[2] = rz;
  // u = r x f
  v.u[0] = 0 * v.f[2] - rz * v.f[1];
  v.u[1] = rz * v.f[0] - rx * v.f[2];
  v.u[2] = rx * v.f[1] - 0 * v.f[0];
  v.tanH = Math.tan((v.fov * Math.PI) / 360);
}

// ------------------------------------------------------------------------------------ the room
const SEEN = { up: false }; // has this player ever sent a real `up` (arrow / d-pad)? (jumpIsUp 'auto')

export class PuzzleRoom {
  constructor() {
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
    // What the `jump` action means in here. The slide scheme pulses `jump` for a push up, keyboards
    // and pads send `jump` for Space / A. true = move up, false = interact, 'auto' = move up until
    // a real `up` input (arrow key, d-pad, stick) has been seen, then interact. The host can also set
    // it per frame, e.g. room.jumpIsUp = input.lastDevice === 'touch'.
    this.jumpIsUp = 'auto';
    this.puzzle = null;
    this.type = 'lights';
    this.cols = 5;
    this.rows = 5;
    this.doorX = 2;
    this.pogo = this._makePogo();
    this.hud = { title: '', line: '', status: '', rev: 0 };
    this.beam = { pts: new Float32Array(BEAM_MAX_PTS * 2), n: 0, hit: false, sweeping: false, rev: 0 };
    this._sp = { x: 0, y: 0 };
    this._held = [0, 0, 0, 0];
    this._was = [false, false, false, false];
    this._dirs = [false, false, false, false];
    this._wasJump = false;
  }

  _makePogo() {
    return {
      x: 0,
      y: 0,
      px: 0, // smoothed tile position (float)
      py: 0,
      fromX: 0,
      fromY: 0,
      moveT: 1,
      moveDur: MOVE_T,
      moving: false,
      facing: 3,
      hop: 0, // height above the floor (tiles)
      hopT: -1,
      bump: 0, // 0..1 nudge toward `facing` when walking into something
      bumpT: -1,
      speed: 0, // tiles / s (walk animation)
      acts: 0, // interaction counter (the renderer swings his arm on change)
      stomps: 0,
      pushes: 0,
      idle: 0,
      alpha: 1, // fades as he walks out of the door
      outside: 0, // 0..1 how far through the door
      celebrate: false,
      emote: null,
      emoteT: 0,
    };
  }

  // ------------------------------------------------------------------ lifecycle
  /**
   * @param {{width:number,height:number,puzzle:object,worldIndex?:number,palette?:object,alreadySolved?:boolean,solveBonus?:number}} o
   */
  start({ width = 390, height = 620, puzzle = null, worldIndex = 0, palette = null, alreadySolved = false, solveBonus = 0 } = {}) {
    this.width = Math.max(200, width);
    this.height = Math.max(240, height);
    this.s = clamp(Math.sqrt((this.width * this.height) / (390 * 700)), 0.8, 1.6);
    const p = puzzle || makePuzzle({ type: 'lights', seed: 1, difficulty: 0.2 });
    this.puzzle = p;
    this.type = p.type;
    this.cols = p.cols;
    this.rows = p.rows;
    this.doorX = p.doorX;
    this.worldIndex = worldIndex | 0;
    this.palette = palette || { glow: '#5eead4' };
    this.glow = this.palette.glow || '#5eead4';
    this.solveBonus = solveBonus || 0;
    this.active = true;
    this.phase = 'intro';
    this.t = 0;
    this.playT = 0;
    this.phaseT = 0;
    this.solved = false;
    this.wasSolved = !!alreadySolved;
    this.solvedT = 0;
    this.fade = 1;
    this.moves = 0;
    this.wrongs = 0;
    this.hintLevel = 0;
    this.rewardT = -1; // stage time the reward appeared
    this.collectT = -1; // stage time Pogo grabbed it
    this._finished = false;
    this._introBanner = false;
    this._autoWalking = false;
    this._nothingCount = 0;
    this._wasHit = false;
    this._leaveBy = 'door';
    this._autoPath = null;
    this._fireBuf = false;
    this._buffer = -1;
    this._pendingStomp = false;
    this.vfx.length = 0;
    this._held.fill(0);
    this._was.fill(true); // ignore whatever is held on entry (he came in pushing up)
    this._wasJump = true;
    this.tileCount = this.cols * this.rows;
    this.solid = new Uint8Array(this.tileCount);
    for (const c of p.solid || []) this.solid[c] = 1;
    this.entranceCell = (this.rows - 1) * this.cols + this.doorX;

    // ---- puzzle state
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
      this.rung = []; // colour indices rung so far in the current attempt
    } else if (p.type === 'beam') {
      this.mirrors = p.mirrors.map((m) => ({ x: m.x, y: m.y, rot: m.rot, angle: -Math.PI / 4 + m.rot * (Math.PI / 2), turnAt: -10, lit: 0 }));
      for (const m of this.mirrors) this.solid[m.y * this.cols + m.x] = 1;
      this.source = { ...p.source };
      this.crystal = { ...p.crystal };
      this.charge = 0;
      this.hitAt = -10;
    } else {
      this.blocks = p.blocks.map((b) => ({ x: b.x, y: b.y, px: b.x, py: b.y, fromX: b.x, fromY: b.y, moveT: 1, onPlate: false, plateAt: -10 }));
      this.plates = p.plates.map((q) => ({ x: q.x, y: q.y, pressed: 0 }));
      this.history = [];
      this._updatePlates(null, null, true);
    }
    if (this.wasSolved) this._applySolution();

    // ---- Pogo walks in from the door
    const po = this.pogo;
    Object.assign(po, this._makePogo());
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
    this._setHud(title, this.wasSolved ? 'Already solved · walk out through the door' : line, '');
    if (p.type === 'lights' && !p.showTarget) this._setHud(title, 'Stomp the runes into the pattern painted outside', '');
    this._layout();
    this._traceBeam();
    this._lastFx = null;
  }

  _applySolution() {
    const p = this.puzzle;
    this.solved = true;
    if (p.type === 'lights') this.lit = Uint8Array.from(p.target);
    else if (p.type === 'bells') {
      this.progress = p.order.length;
      this.rung = p.order.map((b) => p.bells[b].color);
    }
    else if (p.type === 'beam') {
      this.mirrors.forEach((m, i) => {
        m.rot = p.solution[i];
        m.angle = -Math.PI / 4 + m.rot * (Math.PI / 2);
      });
      this.charge = 1;
    } else {
      // blocks rest on the plates
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
    return {
      type: this.type,
      solved: this.solved && !this.wasSolved, // freshly solved this visit (award the star-fish + key)
      everSolved: this.solved,
      time: this.playT,
      moves: this.moves,
      wrongs: this.wrongs,
      hintUsed: this.hintLevel > 0,
      reward: this.solved && !this.wasSolved ? { starfish: 1, key: 1, bonus: this.solveBonus } : null,
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
  // Room-centred world coordinates of a tile (x right, z toward the camera)
  worldX(x) {
    return x - (this.cols - 1) / 2;
  }

  worldZ(y) {
    return y - (this.rows - 1) / 2;
  }

  /** Room radius (round chamber walls) in world units. */
  get radius() {
    return Math.hypot(this.cols / 2 + 0.9, this.rows / 2 + 0.6) + 0.35;
  }

  // Frame the chamber: tilt more top-down on wide screens, show more of the back wall on tall ones,
  // and pull the camera back until the floor (+ door threshold, + the back wall's puzzle pieces)
  // fits inside the safe area under the HUD panel.
  _layout() {
    const v = this.view;
    const W = this.width;
    const H = this.height;
    const aspect = W / H;
    v.aspect = aspect;
    v.fov = aspect < 0.75 ? 36 : aspect < 1.2 ? 38 : 34;
    const cols = this.cols;
    const rows = this.rows;
    const hx = cols / 2 + (this.type === 'beam' ? 1.0 : 0.3); // the beam's emitter + crystal stand outside the grid
    const zBack = -rows / 2 - 0.5;
    const zFront = rows / 2 + 0.9; // the door threshold
    const backH = this.type === 'lights' ? 2.55 : this.type === 'bells' ? 2.2 : 1.5;
    const pts = (this._fitPts = this._fitPts || []);
    pts.length = 0;
    pts.push([-hx, 0, zFront], [hx, 0, zFront], [-hx, 0, zBack], [hx, 0, zBack], [-hx * 0.8, backH, zBack - 0.35], [hx * 0.8, backH, zBack - 0.35], [0, backH, zBack - 0.55]);
    // the HUD panel: a full-width strip on tall screens, a compact top-left card on wide ones
    const topSafe = aspect > 1.1 ? 12 * this.s : (64 + 12) * this.s;
    const botSafe = 14 * this.s;
    const sideSafe = 8 * this.s;
    // Try a range of tilts and keep the one that shows the floor biggest (a slight bias toward the
    // lower, more atmospheric angles): tall phones end up steeper, wide screens flatter.
    let best = null;
    for (let deg = 42; deg <= 70; deg += 2) {
      const pitch = (deg * Math.PI) / 180;
      const dist = this._fitDist(pitch, pts, topSafe, botSafe, sideSafe);
      // on-screen size of the centre tile (width x depth: steeper = less foreshortened)
      const ax = this.project(-0.5, 0, 0, this._sp).x;
      const bx = this.project(0.5, 0, 0, this._sp).x;
      const ay = this.project(0, 0, -0.5, this._sp).y;
      const by = this.project(0, 0, 0.5, this._sp).y;
      const score = Math.sqrt(Math.abs(bx - ax) * Math.abs(by - ay)) * (1 - (deg - 42) * 0.008);
      if (!best || score > best.score) best = { score, pitch, dist };
    }
    this._fitDist(best.pitch, pts, topSafe, botSafe, sideSafe);
    v.pitch = best.pitch;
    v.dist = best.dist;
  }

  // pull the camera back (at this tilt) until everything fits, then centre it in the safe band
  _fitDist(pitch, pts, topSafe, botSafe, sideSafe) {
    const v = this.view;
    const W = this.width;
    const H = this.height;
    const tz = 0.1;
    let lo = 3;
    let hi = 80;
    const place = (dist, shift) => {
      v.target[0] = 0;
      v.target[1] = 0.25;
      v.target[2] = tz;
      v.eye[0] = 0;
      v.eye[1] = v.target[1] + Math.sin(pitch) * dist;
      v.eye[2] = tz + Math.cos(pitch) * dist;
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
    for (let it = 0; it < 28; it++) {
      const dist = (lo + hi) / 2;
      place(dist, 0);
      const [minX, maxX, minY, maxY] = extent();
      const fits = minX >= sideSafe && maxX <= W - sideSafe && maxY - minY <= H - topSafe - botSafe;
      if (fits) hi = dist;
      else lo = dist;
    }
    place(hi, 0);
    // centre vertically: moving the camera along its up vector moves the picture down
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

  /** World point -> CSS-pixel screen position (same maths as the renderer's camera). */
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

  /** Screen position of a tile (x, y) at height h. */
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
    for (let i = 0; i < this.blocks.length; i++) if (this.blocks[i].x === x && this.blocks[i].y === y) return i;
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

    // input edges (directions + the slide's push-up `jump` pulse)
    this._readInput(input, dt);
    let fire = !!firePressed;
    const jump = !!input.jump;
    const jumpEdge = jump && !this._wasJump;
    if (jumpEdge) {
      if (!this._jumpUp()) fire = true; // keyboard Space / gamepad A = interact
      // a host that passes `fire || jump` as firePressed (like the sub stage): when the press was
      // only the slide's push-up (jump without fire held), it is a step up, not an interaction
      else if (!input.fire) fire = false;
    }
    this._wasJump = jump;

    const po = this.pogo;
    if (this.phase === 'intro') {
      this.fade = Math.max(0, 1 - this.phaseT / 0.55);
      if (this.phaseT >= INTRO_T * 0.35 && !this._introBanner) {
        this._introBanner = true;
        fx.banner?.(this.wasSolved ? 'SOLVED' : 'HIDDEN CHAMBER', this.puzzle.title);
        sound?.puzzleEnter ? sound.puzzleEnter() : sound?.door?.();
      }
      this._stepPogo(dt, sound);
      if (this.phaseT >= INTRO_T) {
        this.phase = 'play';
        this.phaseT = 0;
        this._buffer = -1;
      }
    } else if (this.phase === 'play' || this.phase === 'solved') {
      this.fade = 0;
      if (this.phase === 'play') this.playT += dt;
      this._stepPogo(dt, sound);
      if (fire) this._fireBuf = true;
      if (!po.moving && po.hopT < 0 && this.phase !== 'leaving') {
        if (this._fireBuf) {
          this._fireBuf = false;
          this._interact(fx, sound);
        } else this._tryInputMove(fx, sound);
      }
      if (this.phase === 'solved') {
        this.solvedT += dt;
        if (this.collectT < 0 && this.solvedT >= 2.3) {
          this.collectT = this.t;
          this._vfx('collect', po.px, po.py, { life: 0.8 });
          sound?.collect?.(4);
          sound?.pogoCheer?.();
          this._popupAt(fx, po.px, po.py, 1.6, 'STAR-FISH + KEY', '#fde047');
          fx.particles?.(this.tileScreen(po.px, po.py, 1.1).x, this._sp.y, '#fde047', 18, 140 * this.s);
        }
        if (this.solvedT >= SOLVED_T && !po.moving && po.hopT < 0 && this.phase === 'solved') this._beginAutoExit(sound);
      }
    } else if (this.phase === 'leaving') {
      this._stepLeaving(dt, sound);
    }

    this._updatePuzzle(dt, fx, sound);
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

  _readInput(input, dt) {
    const ax = Number(input.axisX) || 0;
    const ay = Number(input.axisY) || 0;
    const d = this._dirs;
    d[0] = ax > 0.25 || (!ax && !!input.right);
    d[2] = ax < -0.25 || (!ax && !!input.left);
    d[1] = ay > 0.4 || (!ay && !!input.down);
    if (input.up) SEEN.up = true;
    d[3] = ay < -0.4 || (!ay && (!!input.up || (this._jumpUp() && !!input.jump)));
    for (let k = 0; k < 4; k++) {
      if (d[k]) {
        if (!this._was[k]) {
          this._held[k] = 0;
          this._buffer = k; // newest press wins, executed as soon as Pogo is free
          this._bufferFresh = true;
        } else this._held[k] += dt;
      } else this._held[k] = 0;
      this._was[k] = d[k];
    }
    if (this._buffer >= 0 && !d[this._buffer] && this._held[this._buffer] === 0 && !this._bufferFresh) this._buffer = -1;
  }

  _jumpUp() {
    const j = this.jumpIsUp;
    return j === 'auto' ? !SEEN.up : !!j;
  }

  _tryInputMove(fx, sound) {
    let dir = -1;
    let fresh = false;
    if (this._buffer >= 0) {
      dir = this._buffer;
      fresh = true;
      this._buffer = -1;
      this._bufferFresh = false;
    } else {
      // auto-repeat: the held direction pressed most recently (smallest hold time) past the delay
      let best = Infinity;
      for (let k = 0; k < 4; k++) {
        if (this._dirs[k] && this._held[k] >= REPEAT_DELAY && this._held[k] < best) {
          best = this._held[k];
          dir = k;
        }
      }
    }
    if (dir >= 0) this._tryMove(dir, fresh, fx, sound);
  }

  // ------------------------------------------------------------------ Pogo
  _stepPogo(dt, sound) {
    const po = this.pogo;
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
    const po = this.pogo;
    po.facing = dir;
    // the way out: down from the entrance tile (a fresh press, so holding down never walks you out)
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
    if (this.moves % 2 === 0 || bi >= 0) sound?.footstep?.('stone');
  }

  _bump(fresh, sound) {
    const po = this.pogo;
    if (!fresh) return;
    po.bumpT = 0;
    this._vfx('bump', po.x + DX[po.facing] * 0.5, po.y + DY[po.facing] * 0.5, { life: 0.35, a: po.facing });
    sound?.puzzleBump ? sound.puzzleBump() : sound?.land?.(0.25);
  }

  _hop() {
    const po = this.pogo;
    po.hopT = 0;
    po.hop = 0;
  }

  _land(sound) {
    const po = this.pogo;
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
        this._vfx('stomp', po.x, po.y, { life: 0.7, a: this.lit[idx] });
        fx.shake?.(2.2);
        this._fxAt(fx, po.x, po.y, 0.1, this.lit[idx] ? this.glow : '#c8b6a6', 10, 110);
        sound?.puzzleTile ? sound.puzzleTile(this.lit[idx] ? 1 : 0) : sound?.land?.(0.7);
        this._checkLights(fx, sound);
        return;
      }
    }
    this._vfx('hopland', po.x, po.y, { life: 0.4 });
    sound?.land?.(0.35);
  }

  _interact(fx, sound) {
    const po = this.pogo;
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
    // bells & mirrors: the faced neighbour first, then any other neighbour
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
        this._nothingHint('Stand next to a bell, then tap');
        return;
      }
      po.acts++;
      this._ringBell(bi, fx, sound);
    } else if (type === 'beam') {
      const mi = pick((x, y) => this.mirrors.findIndex((m) => m.x === x && m.y === y));
      if (mi < 0) {
        this._hop();
        this._nothingHint('Stand next to a mirror, then tap');
        return;
      }
      po.acts++;
      const m = this.mirrors[mi];
      m.rot = (m.rot + 1) & 3;
      m.turnAt = this.t;
      this.moves++;
      this._vfx('rotate', m.x, m.y, { life: 0.5, b: mi });
      sound?.puzzleMirror ? sound.puzzleMirror() : sound?.elevator?.();
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
    const po = this.pogo;
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

  // after the celebration Pogo strolls to the door on his own (BFS path, blocks permitting)
  _beginAutoExit(sound) {
    const po = this.pogo;
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
    const po = this.pogo;
    if (this._autoWalking) {
      this._stepPogo(dt * 1.25, sound);
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
          this.phase = 'solved'; // let _beginLeaving switch it
          this._beginLeaving('auto', sound);
        }
      }
      return;
    }
    this._stepPogo(dt, sound);
    const k = clamp(this.phaseT / LEAVE_T, 0, 1);
    po.outside = clamp((po.py - (this.rows - 1)) / 1.9, 0, 1);
    po.alpha = 1 - smooth(clamp((k - 0.55) / 0.4, 0, 1));
    this.fade = smooth(clamp((k - 0.35) / 0.6, 0, 1));
    if (this.phaseT >= LEAVE_T) this.phase = 'done';
  }

  // ------------------------------------------------------------------ puzzles
  _updatePuzzle(dt, fx, sound) {
    if (this.type === 'beam') this._updateBeam(dt, fx, sound);
    else if (this.type === 'bells') {
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
      // gentle reset: the bells hum down; a wrong bell that happens to be the first one starts over
      this.wrongs++;
      this.wrongAt = this.t;
      b.wrongAt = this.t;
      this._vfx('wrong', b.x, b.y, { life: 1.0, b: bi });
      sound?.puzzleWrong ? sound.puzzleWrong() : sound?.uiBack?.();
      this.rung.length = 0;
      this.progress = 0;
      if (bi === p.order[0]) {
        this.progress = 1;
        this.rung.push(b.color);
      }
      if (this.wrongs >= 3 && this.hintLevel === 0) {
        this.hintLevel = 1;
        this._setHud(null, 'Hint: the glowing bell rings first. Check the banners outside!', null);
        this._vfx('hint', 0, 0, { life: 1 });
      }
      if (this.wrongs >= 6 && this.hintLevel === 1) {
        this.hintLevel = 2;
        this._setHud(null, 'Hint: follow the glowing bell, one after another', null);
      }
      if (this.hintLevel === 1) this.hintBell = this.progress === 0 ? p.order[0] : -1;
      else if (this.hintLevel >= 2) this.hintBell = p.order[this.progress];
    }
  }

  _undo(fx, sound) {
    const po = this.pogo;
    const h = this.history.pop();
    if (!h) {
      this._hop();
      this._nothingHint('Walk into a block to push it');
      return;
    }
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
    sound?.puzzleUndo ? sound.puzzleUndo() : sound?.rewindStart?.();
  }

  _settleBlocks() {
    this._updatePlates(this._fx, this._fx?.sound, false);
  }

  _updatePlates(fx, sound, silent) {
    const cols = this.cols;
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
          if (fx) this._fxAt(fx, b.x, b.y, 0.5, this.glow, 12, 120);
          sound?.puzzlePlate ? sound.puzzlePlate() : sound?.checkpoint?.();
        }
      }
    }
    this.platesOn = on;
    if (!silent) this._setHud(null, null, `${on}/${this.plates.length}`);
    else this.hud.status = `${on}/${this.plates.length}`;
    if (!silent && on === this.plates.length && this.phase === 'play') this._solve(fx || {}, sound);
    void cols;
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
    put(x + DX[dir] * 0.42, y + DY[dir] * 0.42); // emitter lens
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
        } else put(x - DX[dir] * 0.52, y - DY[dir] * 0.52);
        break;
      }
      let mi = -1;
      for (let i = 0; i < this.mirrors.length; i++) if (this.mirrors[i].x === x && this.mirrors[i].y === y) mi = i;
      if (mi < 0) continue;
      const m = this.mirrors[mi];
      hitMirror[mi] = 1;
      put(x, y);
      const settle = -Math.PI / 4 + m.rot * (Math.PI / 2);
      if (Math.abs(m.angle - settle) > 0.02) {
        // mid-turn: the reflection sweeps continuously, the beam flies off until the wall
        const ux = Math.cos(m.angle);
        const uy = Math.sin(m.angle);
        const ddx = DX[dir];
        const ddy = DY[dir];
        const dot = ddx * ux + ddy * uy;
        const rx = 2 * dot * ux - ddx;
        const ry = 2 * dot * uy - ddy;
        // march to the room boundary box
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
    for (let i = 0; i < this.mirrors.length; i++) this.mirrors[i].lit = hitMirror[i];
    if (bm.n !== n || bm.hit !== hit || bm.sweeping !== sweeping) bm.rev++;
    bm.n = n;
    bm.hit = hit;
    bm.sweeping = sweeping;
  }

  _updateBeam(dt, fx, sound) {
    let settled = true;
    for (const m of this.mirrors) {
      const target = -Math.PI / 4 + m.rot * (Math.PI / 2);
      // rot wraps 3 -> 0: keep turning forward (the visual angle just keeps growing)
      let want = target;
      while (want < m.angle - 1e-6) want += TAU;
      const d = want - m.angle;
      if (d > 1e-4) {
        m.angle += Math.min(d, MIRROR_TURN_SPEED * dt);
        settled = false;
      }
      // keep the angle bounded but on the same residue
      if (m.angle > TAU * 2) m.angle -= TAU;
      if (Math.abs(want - m.angle) <= 1e-4) m.angle = want;
    }
    // normalise target comparisons used by the trace
    for (const m of this.mirrors) {
      const target = -Math.PI / 4 + m.rot * (Math.PI / 2);
      if (Math.abs(((m.angle - target) % TAU + TAU) % TAU) < 1e-3) m.angle = target;
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
    const po = this.pogo;
    po.celebrate = true;
    po.emote = 'joy';
    po.emoteT = 1.6;
    this._vfx('solve', (this.cols - 1) / 2, (this.rows - 1) / 2, { life: 2.6 });
    this._setHud(null, 'Solved! A star-fish and a key appear', 'SOLVED');
    fx.banner?.('CHAMBER SOLVED', 'STAR-FISH + KEY');
    fx.shake?.(5);
    const c = this.tileScreen((this.cols - 1) / 2, (this.rows - 1) / 2, 1.4);
    fx.particles?.(c.x, c.y, this.glow, 26, 190 * this.s);
    fx.particles?.(c.x, c.y, '#fde047', 16, 150 * this.s);
    if (this.solveBonus > 0) {
      fx.addScore?.(this.solveBonus);
      this._popupAt(fx, (this.cols - 1) / 2, (this.rows - 1) / 2, 2.2, `+${this.solveBonus}`, '#fde047');
    }
    sound?.puzzleSolve ? sound.puzzleSolve() : sound?.secret?.();
  }
}
