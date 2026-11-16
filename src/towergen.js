// Reboot tower generator (docs/GENERATOR.md). Builds towers in the same cell-grid format as the
// real 1987 towers (realTowerData.js), from pieces seen in those towers, route first, and proves
// each one beatable with a grid solver that uses the Reboot's measured move table.
import { buildGridTower } from './realTowers.js';

const W = 16;
const wrap = (c) => ((c % W) + W) % W;

// Reboot moves, measured in the engine (scratchpad movetable.js): from the end of a run, a cell dx
// columns on and dy rows up/down is reachable when ...
//   dy = 0 or +1: dx <= 4      dy >= +2: never      dy < 0: dx <= 5
// The generator uses tighter limits than these so every move has margin.
export function rebootReach(dx, dy) {
  if (dx < 1) return false;
  if (dy >= 2) return false;
  if (dy >= 0) return dx <= 4;
  return dx <= 5;
}

function rng(seed) {
  let a = seed >>> 0 || 1;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    int: (lo, hi) => lo + Math.floor(next() * (hi - lo + 1)),
    chance: (p) => next() < p,
    pick: (arr) => arr[Math.floor(next() * arr.length)],
    weighted: (entries) => {
      const total = entries.reduce((s, [, w]) => s + w, 0);
      let x = next() * total;
      for (const [v, w] of entries) if ((x -= w) <= 0) return v;
      return entries[entries.length - 1][0];
    },
  };
}

const PLATFORM = new Set(['-', '.', '>', '<']);
const isPlat = (ch) => PLATFORM.has(ch);

class Grid {
  constructor(H) {
    this.H = H;
    this.cells = Array.from({ length: H }, () => Array(W).fill(' '));
    this.reserved = Array.from({ length: H }, () => Array(W).fill(false));
  }
  in(r) {
    return r >= 0 && r < this.H;
  }
  get(c, r) {
    return this.in(r) ? this.cells[r][wrap(c)] : ' ';
  }
  set(c, r, ch) {
    if (this.in(r)) this.cells[r][wrap(c)] = ch;
  }
  free(c, r) {
    return this.in(r) && this.cells[r][wrap(c)] === ' ' && !this.reserved[r][wrap(c)];
  }
  reserve(c, r) {
    if (this.in(r)) this.reserved[r][wrap(c)] = true;
  }
  // a standing cell needs itself and Pogo's body space (2 rows) above it clear
  canStand(c, r) {
    return this.free(c, r) && this.free(c, r + 1) && this.free(c, r + 2);
  }
  stand(c, r, ch = '-') {
    this.set(c, r, ch);
    this.reserve(c, r + 1);
    this.reserve(c, r + 2);
  }
  rows() {
    return this.cells.map((row) => row.join('')).reverse(); // top row first, like the real data
  }
}

// ---------- the solver: which standing cells can Pogo reach? ----------
// Nodes are standing cells ('c,r'); lifts add their stops. Returns { reached:Set, exit:boolean }.
export function solveGrid(rowsTop, reach = rebootReach) {
  const rows = rowsTop.slice().reverse();
  const H = rows.length;
  const at = (c, r) => (r >= 0 && r < H ? rows[r][wrap(c)] : ' ');
  const standable = (c, r) => isPlat(at(c, r)) && at(c, r + 1) !== '!' && at(c, r + 2) !== '!';
  const key = (c, r) => `${wrap(c)},${r}`;
  // ledges are solid from below: a jump or hop under a ledge 3 rows up bumps Pogo's head (2 rows
  // tall) on its slab at once, so it can't be counted on
  const ceilingClear = (c0, dir, dx, r) => {
    for (let k = 0; k <= dx; k++) {
      const ch = at(c0 + dir * k, r + 3);
      if (isPlat(ch) || ch === 'b') return false;
    }
    return true;
  };
  const seen = new Set();
  const queue = [];
  const push = (c, r) => {
    const k = key(c, r);
    if (!seen.has(k)) {
      seen.add(k);
      queue.push([wrap(c), r]);
    }
  };
  // lift stops: platform '^' at r -> stops above in its column
  const liftStops = (c, r) => {
    const out = [];
    for (let k = r + 1; k < H; k++) {
      const ch = at(c, k);
      if (ch === '+') out.push(k);
      if (ch === 'v') {
        out.push(k);
        break;
      }
    }
    return out;
  };
  let exit = false;
  push(0, 0);
  while (queue.length) {
    const [c, r] = queue.shift();
    if (at(c, r + 1) === 'T') exit = true;
    // the run this cell is in (pillars at body height split runs; flashing blocks can be shot)
    const runOk = (cc) => standable(cc, r);
    let a = c;
    while (runOk(a - 1) && wrap(a - 1) !== c) a--;
    let b = c;
    while (runOk(b + 1) && wrap(b + 1) !== wrap(a)) b++;
    for (let k = a; k <= b; k++) push(k, r);
    // moves from both ends of the run
    for (const [end, dir] of [
      [b, 1],
      [a, -1],
    ]) {
      for (let dx = 1; dx <= 5; dx++) {
        for (let dy = -14; dy <= 1; dy++) {
          if (!reach(dx, dy)) continue;
          if ((dy >= 0 || dx >= 2) && !ceilingClear(end, dir, dx, r)) continue;
          const tc = end + dir * dx;
          if (standable(tc, r + dy)) push(tc, r + dy);
        }
      }
    }
    // a lift platform: ride to its stops; each stop is a one-cell run you can move on from
    // ('^' sits at body height on the ledge cell the lift rests in, so you board it standing there)
    if (at(c, r + 1) === '^') for (const s of liftStops(c, r + 1)) {
      for (const dir of [1, -1]) {
        for (let dx = 1; dx <= 5; dx++) {
          for (let dy = -14; dy <= 1; dy++) {
            if (!reach(dx, dy)) continue;
            if ((dy >= 0 || dx >= 2) && !ceilingClear(c, dir, dx, s)) continue;
            const tc = c + dir * dx;
            if (standable(tc, s + dy)) push(tc, s + dy);
          }
        }
      }
      if (at(c, s + 1) === 'T') exit = true;
      if (at(c, s + 1) === '#') {
        const far = c + 8;
        let fr = s;
        while (fr >= 0 && !standable(far, fr)) fr--;
        if (fr >= 0) push(far, fr);
      }
    }
    // a door above this cell: through the core to column c + 8 (dropping if nothing is there)
    if (at(c, r + 1) === '#') {
      const far = c + 8;
      let fr = r;
      while (fr >= 0 && !standable(far, fr)) fr--;
      if (fr >= 0) push(far, fr);
    }
  }
  // how much of the tower is reachable (every piece should be)
  let total = 0;
  let got = 0;
  for (let r = 0; r < H; r++) for (let c = 0; c < W; c++) if (standable(c, r)) {
    total++;
    if (seen.has(key(c, r))) got++;
  }
  return { reached: seen, exit, coverage: total ? got / total : 1 };
}

// ---------- the generator ----------
// opts: { seed, height (rows), difficulty 0..1, twist, look }
export function generateGridTower({ seed = 1, height = 60, difficulty = 0.5 } = {}) {
  for (let attempt = 0; attempt < 40; attempt++) {
    const out = tryGenerate(seed * 7919 + attempt * 104729, height, difficulty);
    if (!out) continue;
    const sol = solveGrid(out.rows);
    if (sol.exit && sol.coverage >= 0.97) return { ...out, attempt, coverage: sol.coverage };
  }
  return null;
}

function tryGenerate(seed, H, D) {
  const R = rng(seed);
  const g = new Grid(H);
  const route = []; // standing cells on the main route, in order
  const lifts = [];
  const longLedges = [];
  const stairTops = [];
  // base: the ground ledge from column 0 (where Pogo starts)
  const baseLen = R.int(4, 7);
  for (let c = 0; c < baseLen; c++) {
    g.stand(c, 0);
    route.push([c, 0]);
  }
  let cur = { c: baseLen - 1, r: 0, dir: 1 };
  const top = H - 5; // the summit ledge row
  let guard = 0;
  let lastPiece = null;
  while (cur.r < top - 1 && guard++ < 400) {
    const act = cur.r / H < 0.3 ? 1 : cur.r / H < 0.75 ? 2 : 3;
    const piece = R.weighted([
      ['stairs', 5],
      ['ledge', lastPiece === 'ledge' ? 0 : 2],
      ['hop', act >= 2 ? 3 : 1.5],
      ['lift', 3.2],
      ['tunnel', act >= 2 ? 2.6 : 1],
      ['crumble', act >= 2 ? 1.6 * D + 0.4 : 0],
      ['gate', act >= 2 ? 1 : 0],
      ['drop', act >= 2 ? 0.5 : 0],
      ['turn', 0.8],
    ]);
    const next = PIECES[piece](g, cur, R, { H, D, act, top, route, lifts, longLedges, stairTops });
    if (next) {
      cur = next;
      lastPiece = piece;
    }
  }
  if (cur.r < top - 1) return null;
  // Summit: a short ledge and the exit door three rows above its far cell
  let sc = cur.c;
  let made = 0;
  for (let i = 1; i <= 3; i++) {
    const c = cur.c + cur.dir * i;
    if (!g.canStand(c, cur.r) || !g.free(c, cur.r + 3)) break;
    g.stand(c, cur.r);
    route.push([wrap(c), cur.r]);
    sc = c;
    made++;
  }
  if (made === 0) return null;
  for (let k = 1; k <= 3; k++) g.set(sc, cur.r + k, 'T');
  // Branches: decoy doors and dead-end ledges off the route ("read the tower")
  addBranches(g, R, route, D);
  // Enemies by act, at the original's favourite spots
  addEnemies(g, R, { lifts, longLedges, stairTops, D, H });
  return { rows: g.rows(), H };
}

// Each piece returns the new cursor, or null if it doesn't fit (nothing is changed then)
const PIECES = {
  stairs(g, cur, R, { route, stairTops }) {
    const n = R.int(2, 6);
    const cells = [];
    for (let i = 1; i <= n; i++) {
      const c = cur.c + cur.dir * i;
      const r = cur.r + i;
      if (!g.canStand(c, r)) break;
      cells.push([c, r]);
    }
    if (cells.length < 2) return null;
    for (const [c, r] of cells) {
      g.stand(c, r);
      route.push([wrap(c), r]);
    }
    const [lc, lr] = cells[cells.length - 1];
    stairTops.push([lc, lr]);
    return { c: lc, r: lr, dir: cur.dir };
  },
  ledge(g, cur, R, { route, longLedges }) {
    const n = R.int(2, 5);
    const cells = [];
    for (let i = 1; i <= n; i++) {
      const c = cur.c + cur.dir * i;
      if (!g.canStand(c, cur.r)) break;
      cells.push([c, cur.r]);
    }
    if (cells.length < 2) return null;
    for (const [c, r] of cells) {
      g.stand(c, r);
      route.push([wrap(c), r]);
    }
    if (cells.length >= 4) longLedges.push(cells.map(([c, r]) => [wrap(c), r]));
    const [lc, lr] = cells[cells.length - 1];
    return { c: lc, r: lr, dir: cur.dir };
  },
  // a gap to a stepping stone: same height, one up, or a little down (margin under the measured max)
  hop(g, cur, R, { route }) {
    const dy = R.weighted([
      [1, 3],
      [0, 2],
      [-1, 1],
      [-2, 0.6],
    ]);
    const dx = R.int(2, dy >= 0 ? 3 : 4);
    if (!rebootReach(dx, dy)) return null;
    const c = cur.c + cur.dir * dx;
    const r = cur.r + dy;
    // the gap and the flight path stay clear
    for (let i = 1; i < dx; i++) for (let k = 0; k <= 3; k++) if (!g.free(cur.c + cur.dir * i, Math.min(cur.r, r) + k)) return null;
    if (!g.canStand(c, r)) return null;
    for (let i = 1; i < dx; i++) for (let k = 0; k <= 3; k++) g.reserve(cur.c + cur.dir * i, Math.min(cur.r, r) + k);
    g.stand(c, r);
    route.push([wrap(c), r]);
    // sometimes a second stone to make a little run
    let lc = c;
    if (R.chance(0.45) && g.canStand(c + cur.dir, r)) {
      g.stand(c + cur.dir, r);
      route.push([wrap(c + cur.dir), r]);
      lc = c + cur.dir;
    }
    return { c: lc, r, dir: cur.dir };
  },
  // a lift level with the route (walk on), rising 3-12 rows, with an exit ledge at the top. Like
  // the real towers, '^' is drawn at body height on the ledge cell the platform rests in.
  lift(g, cur, R, { route, lifts, act, top }) {
    const rise = Math.min(top - cur.r - 1, R.int(3, act === 1 ? 7 : 12));
    if (rise < 3) return null;
    const lc = cur.c + cur.dir;
    const pr = cur.r + 1;
    const tr = pr + rise;
    if (!g.canStand(lc, cur.r)) return null;
    for (let r = pr + 2; r <= tr + 2; r++) if (!g.free(lc, r)) return null;
    const ec = lc + cur.dir;
    if (!g.canStand(ec, tr)) return null;
    g.stand(lc, cur.r);
    route.push([wrap(lc), cur.r]);
    for (let r = pr; r <= tr + 2; r++) g.reserve(lc, r);
    g.set(lc, pr, '^');
    g.set(lc, tr, 'v');
    g.stand(ec, tr);
    route.push([wrap(ec), tr]);
    lifts.push({ c: wrap(lc), r0: pr, r1: tr });
    return { c: ec, r: tr, dir: cur.dir };
  },
  // a door on the route: through the core to the far side (column + 8), the route carries on there
  tunnel(g, cur, R, { route }) {
    const c = cur.c;
    const far = c + 8;
    for (let k = 1; k <= 3; k++) if (g.get(c, cur.r + k) !== ' ' || !g.free(far, cur.r + k)) return null;
    if (!g.free(far, cur.r)) return null;
    const dir = R.chance(0.5) ? 1 : -1;
    if (!g.canStand(far + dir, cur.r)) return null;
    for (let k = 1; k <= 3; k++) {
      g.set(c, cur.r + k, '#');
      g.set(far, cur.r + k, '#');
    }
    g.set(far, cur.r, '-');
    g.stand(far + dir, cur.r);
    route.push([wrap(far), cur.r], [wrap(far + dir), cur.r]);
    return { c: far + dir, r: cur.r, dir };
  },
  // a bridge of single crumbling cells between solid ones (never two crumbling cells together)
  crumble(g, cur, R, { route }) {
    const n = R.int(1, 3);
    const len = 2 * n + 1;
    for (let i = 1; i <= len; i++) if (!g.canStand(cur.c + cur.dir * i, cur.r)) return null;
    for (let i = 1; i <= len; i++) {
      const c = cur.c + cur.dir * i;
      g.stand(c, cur.r, i % 2 === 1 && i < len ? '.' : '-');
      route.push([wrap(c), cur.r]);
    }
    return { c: cur.c + cur.dir * len, r: cur.r, dir: cur.dir };
  },
  // a flashing block across a ledge: shoot it to get past
  gate(g, cur, R, { route }) {
    const n = 4;
    for (let i = 1; i <= n; i++) if (!g.canStand(cur.c + cur.dir * i, cur.r)) return null;
    for (let i = 1; i <= n; i++) {
      const c = cur.c + cur.dir * i;
      g.stand(c, cur.r);
      route.push([wrap(c), cur.r]);
    }
    const bc = cur.c + cur.dir * 2;
    g.set(bc, cur.r + 1, 'b');
    g.set(bc, cur.r + 2, 'b');
    return { c: cur.c + cur.dir * n, r: cur.r, dir: cur.dir };
  },
  // step off onto a lower ledge: a one-way move
  drop(g, cur, R, { route }) {
    const dy = -R.int(2, 4);
    const dx = R.int(1, 3);
    const c = cur.c + cur.dir * dx;
    const r = cur.r + dy;
    if (r < 1 || !g.canStand(c, r) || !g.canStand(c + cur.dir, r)) return null;
    for (let i = 1; i <= dx; i++) for (let k = r + 1; k <= cur.r + 2; k++) if (!g.free(cur.c + cur.dir * i, k) && !(i === dx && k <= r + 2)) return null;
    g.stand(c, r);
    g.stand(c + cur.dir, r);
    route.push([wrap(c), r], [wrap(c + cur.dir), r]);
    return { c: c + cur.dir, r, dir: cur.dir };
  },
  // turn round: the route doubles back one step up
  turn(g, cur, R, { route }) {
    const c = cur.c;
    const r = cur.r + 1;
    // a step up behind: the run's back end is the cursor itself, so step up next to it
    const dir = -cur.dir;
    const sc = c + dir;
    if (!g.canStand(sc, r)) return null;
    g.stand(sc, r);
    route.push([wrap(sc), r]);
    return { c: sc, r, dir };
  },
};

function addBranches(g, R, route, D) {
  const tries = 6 + Math.round(D * 6);
  for (let t = 0; t < tries; t++) {
    const [c, r] = R.pick(route);
    if (r < 3) continue;
    const dir = R.chance(0.5) ? 1 : -1;
    const kind = R.weighted([
      ['decoy', 1.2],
      ['spur', 1],
    ]);
    if (kind === 'decoy') {
      // a short ledge with a door whose far side has no floor: it drops you (Trap of Tricks)
      const c1 = c + dir;
      if (!g.canStand(c1, r) || !g.canStand(c1 + dir, r)) continue;
      const dc = c1 + dir;
      const far = dc + 8;
      let ok = true;
      for (let k = 1; k <= 3; k++) if (!g.free(dc, r + k) || !g.free(far, r + k)) ok = false;
      if (!ok) continue;
      // something below the far door must catch you, or it's just a pit into the sea
      let below = false;
      for (let k = r - 1; k >= 0; k--) if (isPlat(g.get(far, k))) below = true;
      if (!below) continue;
      g.stand(c1, r);
      g.stand(dc, r);
      for (let k = 1; k <= 3; k++) {
        g.set(dc, r + k, '#');
        g.set(far, r + k, '#');
      }
    } else {
      // a dead-end spur of 2-3 cells (somewhere for a reward, or just a wrong turn)
      const n = R.int(2, 3);
      const cells = [];
      for (let i = 1; i <= n; i++) {
        if (!g.canStand(c + dir * i, r)) break;
        cells.push(c + dir * i);
      }
      if (cells.length < 2) continue;
      for (const cc of cells) g.stand(cc, r);
    }
  }
}

function addEnemies(g, R, { lifts, longLedges, stairTops, D, H }) {
  const put = (c, r, ch) => {
    if (g.get(c, r) === ' ') g.set(c, r, ch);
  };
  // vertical patrollers beside lift shafts, past the base
  for (const L of lifts) {
    if (L.r0 < H * 0.2 || !R.chance(0.5 + D * 0.4)) continue;
    const side = R.chance(0.5) ? 1 : -1;
    const c = L.c + side;
    const r = Math.floor((L.r0 + L.r1) / 2);
    if (g.free(c, r) && g.free(c, r + 1)) put(c, r, D > 0.6 && R.chance(0.5) ? '5' : '4');
  }
  // rolling balls and patrols on long ledges
  for (const run of longLedges) {
    const [c, r] = run[Math.floor(run.length / 2)];
    if (r < H * 0.15 || !R.chance(0.65 + D * 0.3)) continue;
    put(c, r + 1, R.weighted([
      ['1', 1],
      ['2', 1],
      ['6', 0.8],
    ]));
  }
  // parked balls at the top of some staircases
  for (const [c, r] of stairTops) {
    if (r < H * 0.25 || !R.chance(0.35 + D * 0.35)) continue;
    put(c, r + 1, '3');
  }
}

// The tower of the day: the same for everyone on a given (UTC) date. A weekly arc: Monday short and
// gentle with no twist, building to a tall, mean Sunday; the twist rotates through the week.
const WEEK = [
  // [rows, difficulty, twist, label]  (index = UTC weekday, 0 = Sunday)
  [90, 0.85, 'wind', 'Gale force'],
  [46, 0.25, 'none', 'Plain sailing'],
  [52, 0.35, 'pistons', 'Clockwork ledges'],
  [58, 0.45, 'blizzard', 'Blizzard'],
  [64, 0.55, 'dark', 'Night climb'],
  [72, 0.65, 'flood', 'Sinking tower'],
  [80, 0.75, 'collapse', 'Crumbling base'],
];
export function dailyPlan(seed, date = new Date()) {
  const [height, difficulty, mechanic, label] = WEEK[date.getUTCDay()];
  return { seed, height, difficulty, mechanic, label, weekday: date.getUTCDay() };
}

// A playable tower object for the game (same shape as the real towers)
export function makeGeneratedTower({ seed, height, difficulty, id = 900, name = 'DAILY TOWER', look = 'eye', palette, mechanic = 'none', timeLimit } = {}) {
  const res = generateGridTower({ seed, height, difficulty });
  if (!res) return null;
  const t = buildGridTower(res.rows, { id, look, idTag: `gen${seed}` });
  return {
    ...t,
    name,
    palette,
    mechanic,
    timeLimit: timeLimit || Math.round(60 + res.H * 1.6),
    generated: true,
    procedural: true,
    grid: res.rows,
    seed,
    cacheKey: `gen${seed}`,
  };
}
