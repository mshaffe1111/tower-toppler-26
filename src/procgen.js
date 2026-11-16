// Procedural tower generator for Tower Toppler '26 (daily / endless / seeded towers).
//
// Output has the same shape as the hand-made towers in levels.js (after buildTower), plus
// `mechanic`, `secrets` and `checkpoints`:
//   { id, name, timeLimit, palette, floors, ledges, elevators, doors, enemies, spawn,
//     mechanic, secrets, checkpoints, seed, difficulty, procedural: true }
//
// Design approach (constructive, so every tower is completable by construction):
//   1. MAIN ROUTE. Starting from a solid run at floor 0, the route is grown one "move" at a time
//      from the end of the current ledge run, always using moves that are known to be safe with
//      the engine physics (see game.js PHYS, measured in the real engine):
//        STEP      next run one floor up in the adjacent column (auto step-up). Stair steps are
//                  always >= 2 columns wide: 1-wide stairs are unreliable with the step cooldown.
//        JUMP_UP   +1 floor jump over one empty column, onto a >= 3 wide run.
//        JUMP_FLAT same-floor jump over 1 (or 2 at higher difficulty) empty columns.
//        BOX       same-floor 1-column hurdle with a shootable box in it (shoot it or hop it).
//        LIFT      an elevator in the next column rising 3..5 floors.
//        TUNNEL    a door pair through the tower (8 columns round, 1..3 floors up).
//      The route keeps a winding direction so it spirals round the cylinder; lifts and tunnels
//      may reverse it. Every move reserves the "air" it needs (jump gaps, the zone where the
//      ledge-hang assist could grab a lip, lift shafts). New route ledges keep clear of older
//      parts of the route: never within one column and one floor (could block a step-up or catch
//      a jump), and never within jump reach of a run three or more runs back (no short-circuits).
//   2. EXTRAS that can never block the route: secret branches (back-step spurs, pits under jump
//      gaps, lift stops, tunnel nooks, secret tunnels), decoy ledges, special ledge types on
//      route-run interiors only (short, with solid ledges either side), and enemies. Extras stay
//      out of reserved cells and one column/floor clear of the route, and every cluster of extras
//      may only touch route runs that are close together in route order, so decoys are dead ends
//      rather than stepping stones past the route.
//   3. If the route generator paints itself into a corner it retries with a derived seed;
//      every attempt is deterministic, so the same seed always yields the same tower.
//
// Verified with an engine-driven reachability checker (real game.update(), walks and jumps from
// every ledge, BFS from spawn to the exit door), under both modern and classic rules.

import { COLS } from './levels.js';

export const MECHANICS = ['none', 'pistons', 'blizzard', 'collapse', 'flood', 'dark', 'wind'];

// ---------------------------------------------------------------------------------------------
// Deterministic randomness
// ---------------------------------------------------------------------------------------------

// 32-bit integer hash of any number of values (strings are folded in character by character).
function hash32(...vals) {
  let h = 0x811c9dc5 ^ vals.length;
  for (const v of vals) {
    const s = typeof v === 'number' ? [v | 0, Math.floor(v / 4294967296) | 0] : String(v).split('').map((ch) => ch.charCodeAt(0));
    for (const x of s) {
      h = Math.imul(h ^ x, 0x01000193);
      h ^= h >>> 15;
      h = Math.imul(h, 0x2c1b3c6d);
      h ^= h >>> 12;
    }
  }
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  return h >>> 0;
}

// mulberry32 PRNG with a few convenience helpers
class Rng {
  constructor(seed) {
    this.s = seed >>> 0;
  }
  next() {
    let t = (this.s = (this.s + 0x6d2b79f5) >>> 0);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  range(a, b) {
    return a + (b - a) * this.next();
  }
  int(a, b) {
    return a + Math.floor(this.next() * (b - a + 1));
  }
  chance(p) {
    return this.next() < p;
  }
  pick(arr) {
    return arr[Math.floor(this.next() * arr.length)];
  }
  shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }
  // Weighted order: returns the items sorted by a weighted random draw (best first)
  weightedOrder(items) {
    const pool = items.filter((it) => it.w > 0);
    const out = [];
    while (pool.length) {
      const total = pool.reduce((s, it) => s + it.w, 0);
      let r = this.next() * total;
      let i = 0;
      while (i < pool.length - 1 && r >= pool[i].w) r -= pool[i++].w;
      out.push(pool.splice(i, 1)[0]);
    }
    return out;
  }
}

const lerp = (a, b, t) => a + (b - a) * t;
const clamp01 = (x) => Math.max(0, Math.min(1, x));
const wrap = (c) => ((c % COLS) + COLS) % COLS;
const colDist = (a, b) => {
  let d = wrap(b) - wrap(a);
  if (d > COLS / 2) d -= COLS;
  if (d < -COLS / 2) d += COLS;
  return d;
};
const key = (c, f) => `${wrap(c)},${f}`;

// Could a player get from one of these cells to the other in a single hop? Measured in the
// engine: a running jump covers ~4 columns on the level or one floor up, and with the modern
// ledge-hang assist it climbs two floors within ~4 columns. Dropping down is always possible.
// Distinct parts of the route (and every cluster of extras) are kept out of each other's reach
// so nothing short-circuits the spiral.
function inReach(c1, f1, c2, f2) {
  const df = Math.abs(f1 - f2);
  const dc = Math.abs(colDist(c1, c2));
  return df <= 2 && dc <= 4;
}
// Extras may link route runs at most this far apart in route order (a tiny shortcut at most).
const MAX_SPAN = 2;

// ---------------------------------------------------------------------------------------------
// Layout grid: occupied cells, reserved air, and the clearance rules
// ---------------------------------------------------------------------------------------------

class Layout {
  constructor() {
    this.cells = new Map(); // key -> { col, floor, type, role, runId }
    this.air = new Set(); // keys that must stay empty (jump gaps, hang zones, lift shafts)
    this.route = []; // route + branch cells (for clearance checks)
    this.extras = []; // standable extra cells: { col, floor, comp }
    this.comps = []; // extra clusters: { min, max } = span of route runs they touch (in route order)
  }
  occupied(c, f) {
    return this.cells.has(key(c, f));
  }
  free(c, f) {
    return !this.cells.has(key(c, f)) && !this.air.has(key(c, f));
  }
  // Clearance for a new cell of route run `runId` against older parts of the route.
  //  * nothing within 1 column and 1 floor of a run two or more runs back (could block a
  //    step-up or catch a jump);
  //  * nothing within reach (see inReach) of a run three or more runs back: that would let the
  //    player skip a big part of the route.
  // The previous run (age 1) is exempt: the move that joins them defines that relationship.
  routeClash(c, f, runId) {
    for (const r of this.route) {
      if (r.role !== 'route') continue;
      const age = runId - r.runId;
      if (age <= 1) continue;
      const dc = Math.abs(colDist(r.col, c));
      const df = Math.abs(r.floor - f);
      if (dc <= 1 && df <= 1) return true;
      if (age >= 3 && inReach(r.col, r.floor, c, f)) return true;
    }
    return false;
  }
  // Clearance for an extra (branch / decoy) cell: keep 1 column / 1 floor clear of the route and
  // of branches, so an extra can never block a step-up or catch a route jump.
  extraClash(c, f, ignoreRuns = null) {
    for (const r of this.route) {
      if (ignoreRuns && ignoreRuns.has(r.runId)) continue;
      if (Math.abs(colDist(r.col, c)) <= 1 && Math.abs(r.floor - f) <= 1) return true;
    }
    return false;
  }
  // Span check for a new group of extra cells: the cluster it would join (itself plus any extras
  // within reach) must only touch route runs that are close together in route order, so extras
  // stay dead ends instead of becoming stepping stones past the route. `links` are run ids the
  // group is joined to by other means (a lift, a tunnel door).
  extraSpan(cells, links = []) {
    let min = Infinity;
    let max = -Infinity;
    const merge = new Set();
    for (const id of links) {
      min = Math.min(min, id);
      max = Math.max(max, id);
    }
    for (const [c, f] of cells) {
      for (const r of this.route) {
        if (r.role === 'route' && inReach(r.col, r.floor, c, f)) {
          min = Math.min(min, r.runId);
          max = Math.max(max, r.runId);
        }
      }
      for (const x of this.extras) if (inReach(x.col, x.floor, c, f)) merge.add(x.comp);
    }
    for (const id of merge) {
      min = Math.min(min, this.comps[id].min);
      max = Math.max(max, this.comps[id].max);
    }
    return { ok: !(max - min > MAX_SPAN), min, max, merge };
  }
  addExtras(cells, type, role, span) {
    const comp = this.comps.length;
    this.comps.push({ min: span.min, max: span.max });
    for (const x of this.extras) if (span.merge.has(x.comp)) x.comp = comp;
    for (const [c, f] of cells) {
      this.add(c, f, type, role);
      if (type !== 'box') this.extras.push({ col: wrap(c), floor: f, comp });
    }
  }
  add(c, f, type, role, runId = -1) {
    const cell = { col: wrap(c), floor: f, type, role, runId };
    this.cells.set(key(c, f), cell);
    if (role === 'route' || role === 'branch') this.route.push(cell); // branches are protected too
    return cell;
  }
  reserve(c, f) {
    if (f >= 0) this.air.add(key(c, f));
  }
}

// ---------------------------------------------------------------------------------------------
// Main route
// ---------------------------------------------------------------------------------------------

const MOVE = {
  STEP: 'step',
  JUMP_UP: 'jumpUp',
  JUMP_FLAT: 'jumpFlat',
  BOX: 'box',
  LIFT: 'lift',
  TUNNEL: 'tunnel',
};

function runCells(start, dir, width) {
  const out = [];
  for (let i = 0; i < width; i++) out.push(wrap(start + dir * i));
  return out;
}

// Attempt to grow a complete route from floor 0 to the exit floor. Returns null if it gets stuck.
function buildRoute(rng, D, exitFloor, mech, idTag) {
  const L = new Layout();
  const runs = [];
  const moves = [];
  const elevators = [];
  const doors = [];
  const nooks = []; // dead-end cells created next to tunnel doors (secret candidates)
  const maxGap = mech === 'wind' || mech === 'blizzard' ? 1 : D >= 0.35 ? 2 : 1;
  const maxLifts = D < 0.34 ? 3 : D < 0.67 ? 2 : 1;
  const maxTunnels = D < 0.5 ? 2 : 1;
  let lifts = 0;
  let tunnels = 0;
  let stairStreak = 0;
  let lastMove = null;
  let doorSeq = 0;

  // Can a run of `cols` on `floor` be placed as the next route run?
  const runOk = (cols, floor) =>
    cols.every((c) => L.free(c, floor) && !L.routeClash(c, floor, runs.length)) &&
    new Set(cols).size === cols.length;
  const addRun = (cols, floor, dir, arrive) => {
    const run = { id: runs.length, floor, cells: cols.slice(), dir, arrive, depart: null, doors: new Set() };
    for (const c of cols) L.add(c, floor, 'solid', 'route', run.id);
    runs.push(run);
    return run;
  };
  const doorClear = (c, f) => doors.every((d) => d.floor !== f || Math.abs(colDist(d.col, c)) >= 2);
  // A jump from floor f peaks about 1.5 floors up, where the ledge-hang assist can grab a lip
  // two floors up within ~1 column ahead. Keep that zone empty so no decoy can catch the jump.
  const hangZoneFree = (e, d, f, n) => {
    for (let i = 1; i <= n; i++) if (L.occupied(e + d * i, f + 2)) return false;
    return true;
  };
  const reserveHangZone = (e, d, f, n) => {
    for (let i = 1; i <= n; i++) L.reserve(e + d * i, f + 2);
  };

  // Spawn run at floor 0
  let dir = rng.chance(0.5) ? 1 : -1;
  const c0 = rng.int(0, COLS - 1);
  const run0 = addRun(runCells(c0, dir, rng.int(4, 5)), 0, dir, 'spawn');
  const spawnCol = run0.cells[rng.int(0, 1)];

  let cur = run0;
  let guard = 0;
  while (cur.floor < exitFloor) {
    if (++guard > 200) return null;
    const f = cur.floor;
    const d = cur.dir;
    const e = cur.cells[cur.cells.length - 1];
    const remaining = exitFloor - f;
    const flatLast = lastMove === MOVE.JUMP_FLAT || lastMove === MOVE.BOX;
    // Encourage at least one lift or tunnel per tower for variety
    const shortcutBoost = lifts + tunnels === 0 && f > exitFloor * 0.4 ? 2.2 : 1;
    const options = rng.weightedOrder([
      { m: MOVE.STEP, w: stairStreak >= 4 ? 0 : 1.0 - 0.35 * D },
      { m: MOVE.JUMP_UP, w: 0.35 + 0.45 * D },
      { m: MOVE.JUMP_FLAT, w: flatLast || remaining < 2 ? 0 : 0.22 + 0.25 * D },
      { m: MOVE.BOX, w: flatLast || remaining < 2 ? 0 : 0.06 + 0.2 * D },
      { m: MOVE.LIFT, w: lifts < maxLifts && remaining >= 3 && lastMove !== MOVE.LIFT ? (0.42 - 0.25 * D) * shortcutBoost : 0 },
      { m: MOVE.TUNNEL, w: tunnels < maxTunnels && lastMove !== MOVE.TUNNEL && cur.cells.length >= 2 ? (0.3 - 0.12 * D) * shortcutBoost : 0 },
    ]);
    // Width of the run that a move lands on
    const landWidth = (floor, min = 3) => {
      if (floor === exitFloor) return rng.int(4, 5);
      return rng.int(min, D < 0.5 ? 5 : 4);
    };

    let next = null;
    for (const { m } of options) {
      if (m === MOVE.STEP) {
        const nf = f + 1;
        const w = nf === exitFloor ? landWidth(nf) : rng.chance(0.62) ? 2 : landWidth(nf);
        const cols = runCells(e + d, d, w);
        if (!runOk(cols, nf)) continue;
        next = addRun(cols, nf, d, m);
      } else if (m === MOVE.JUMP_UP) {
        const nf = f + 1;
        const gapFree = !L.occupied(e + d, f) && !L.occupied(e + d, nf) && hangZoneFree(e, d, f, 3);
        const cols = runCells(e + 2 * d, d, landWidth(nf));
        if (!gapFree || !runOk(cols, nf)) continue;
        L.reserve(e + d, f);
        L.reserve(e + d, nf);
        reserveHangZone(e, d, f, 3);
        next = addRun(cols, nf, d, m);
      } else if (m === MOVE.JUMP_FLAT || m === MOVE.BOX) {
        const g = m === MOVE.BOX ? 1 : rng.chance(lerp(0.1, 0.7, D)) ? maxGap : 1;
        let gapFree = true;
        for (let i = 1; i <= g; i++) {
          if (L.occupied(e + d * i, f) || L.occupied(e + d * i, f + 1) || L.routeClash(e + d * i, f, runs.length)) gapFree = false;
        }
        if (!hangZoneFree(e, d, f, g + 2)) gapFree = false;
        const cols = runCells(e + d * (g + 1), d, landWidth(f));
        if (!gapFree || !runOk(cols, f)) continue;
        for (let i = 1; i <= g; i++) {
          if (m === MOVE.JUMP_FLAT) L.reserve(e + d * i, f);
          L.reserve(e + d * i, f + 1);
        }
        reserveHangZone(e, d, f, g + 2);
        if (m === MOVE.BOX) L.add(e + d, f, 'box', 'box');
        next = addRun(cols, f, d, m);
        next.gap = g;
      } else if (m === MOVE.LIFT) {
        const h = Math.min(remaining, rng.int(3, 5));
        if (h < 3) continue;
        const s = e + d;
        let shaftOk = true;
        for (let k = f; k <= f + h + 1; k++) if (!L.free(s, k)) shaftOk = false;
        for (let k = Math.max(0, f - 3); k < f; k++) if (L.occupied(s, k)) shaftOk = false;
        if (!shaftOk) continue;
        const flip = rng.chance(0.3);
        const d2 = flip ? -d : d;
        const nf = f + h;
        const cols = runCells(s + d2, d2, landWidth(nf));
        if (!runOk(cols, nf)) continue;
        for (let k = Math.max(0, f - 3); k <= f + h + 1; k++) L.reserve(s, k);
        const speed = +(lerp(1.4, 2.2, D) + rng.range(-0.1, 0.1)).toFixed(2);
        elevators.push({ col: wrap(s), minFloor: f, maxFloor: nf, startFloor: f, speed });
        lifts++;
        next = addRun(cols, nf, d2, m);
        next.lift = elevators[elevators.length - 1];
        next.liftBoardDir = d;
      } else if (m === MOVE.TUNNEL) {
        const r = Math.min(remaining, rng.int(1, 3));
        if (r < 1) continue;
        if (!doorClear(e, f)) continue;
        const nf = f + r;
        const b = e + COLS / 2;
        const d2 = rng.chance(0.35) ? -d : d;
        const back = rng.chance(0.4) ? 1 : 0;
        const w = back + (nf === exitFloor ? rng.int(4, 5) : rng.int(3, 4));
        const cols = runCells(b - d2 * back, d2, w);
        if (!runOk(cols, nf) || !doorClear(b, nf)) continue;
        // Optional dead-end nook beyond door A (a secret hides there)
        let nookCol = null;
        if (rng.chance(0.5) && L.free(e + d, f) && !L.routeClash(e + d, f, cur.id) && Math.abs(colDist(e + d, b)) > 2) {
          nookCol = wrap(e + d);
        }
        const idA = `${idTag}d${doorSeq++}`;
        const idB = `${idTag}d${doorSeq++}`;
        doors.push({ id: idA, col: wrap(e), floor: f, targetId: idB, isExit: false });
        doors.push({ id: idB, col: wrap(b), floor: nf, targetId: idA, isExit: false });
        cur.doors.add(wrap(e));
        if (nookCol !== null) {
          L.add(nookCol, f, 'solid', 'route', cur.id);
          cur.cells.push(nookCol);
          cur.nook = nookCol;
          nooks.push({ col: nookCol, floor: f, runId: cur.id });
        }
        tunnels++;
        next = addRun(cols, nf, d2, m);
        next.doors.add(wrap(b));
        next.tunnelFrom = { col: wrap(e), floor: f };
      }
      if (next) {
        cur.depart = m;
        moves.push({ m, from: cur.id, to: next.id });
        stairStreak = m === MOVE.STEP ? stairStreak + 1 : 0;
        lastMove = m;
        break;
      }
    }
    if (!next) return null;
    cur = next;
  }

  // Exit door on the top run, away from any tunnel door that arrives there
  const top = cur;
  if (top.cells.length < 3) return null;
  let exitCol = null;
  for (const i of [2, 1, 3, top.cells.length - 1]) {
    const c = top.cells[Math.min(i, top.cells.length - 1)];
    if (doorClear(c, top.floor)) {
      exitCol = c;
      break;
    }
  }
  if (exitCol === null) return null;
  doors.push({ id: `${idTag}exit`, col: exitCol, floor: top.floor, targetId: null, isExit: true });
  top.doors.add(exitCol);
  top.isExit = true;

  return { L, runs, moves, elevators, doors, nooks, spawn: { col: spawnCol, floor: 0 }, doorSeq };
}

// ---------------------------------------------------------------------------------------------
// Extras: secrets, specials, decoys, enemies
// ---------------------------------------------------------------------------------------------

// Can an extra (non-route) ledge go at (c, f)? It must avoid reserved air and keep one column /
// one floor clear of the route (except for the runs named in `ignore`).
function extraOk(L, c, f, ignore = null, maxFloor = Infinity) {
  return f >= 1 && f <= maxFloor && L.free(c, f) && !L.extraClash(c, f, ignore);
}

function placeSecrets(rng, R, D, exitFloor, idTag, cpFloors) {
  const { L, runs, elevators, doors, nooks } = R;
  const secrets = [];
  const used = new Set(); // runs already used as a branch anchor
  // First pass: branches must stay dead ends (span rule). If that leaves us short of three
  // secrets, a second pass lets a branch double as a small secret shortcut (a fair reward).
  let relaxed = false;
  const ok = (c, fl, ignore = null) => extraOk(L, c, fl, ignore, exitFloor);
  // Commit a branch if its cluster passes the span rule (always, in the relaxed pass)
  const commit = (cells, links) => {
    const span = L.extraSpan(cells, links);
    if (!span.ok && !relaxed) return false;
    L.addExtras(cells, 'solid', 'branch', span);
    return true;
  };
  const doorClear = (c, f) => doors.every((d) => d.floor !== f || Math.abs(colDist(d.col, c)) >= 2);

  // Generators: each tries to build one branch and returns the secret position or null
  const gens = {
    // Back-step spur: from the first cell of a route run, a 2-wide step going backwards,
    // sometimes followed by a second step. The forward walk never triggers it.
    spur(run) {
      if (run.isExit || used.has(run.id)) return null;
      const s = run.cells[0];
      const d = run.dir;
      const f = run.floor;
      const ignore = new Set([run.id]);
      // variants: two 2-wide steps, one 2-wide step, or a single perch (in that order of taste)
      const step = (k) => [[s - d * (1 + 2 * k), f + 1 + k], [s - d * (2 + 2 * k), f + 1 + k]];
      const variants = rng.chance(0.4) ? [[...step(0), ...step(1)], step(0)] : [step(0), [...step(0), ...step(1)]];
      variants.push([[s - d, f + 1]]);
      const cells = variants.find((v) => v.every(([c, fl]) => ok(c, fl, ignore) && !cpFloors.has(fl)) && L.extraSpan(v, [run.id]).ok);
      const fallback = relaxed && variants.find((v) => v.every(([c, fl]) => ok(c, fl, ignore) && !cpFloors.has(fl)));
      if (!(cells || fallback) || !commit(cells || fallback, [run.id])) return null;
      used.add(run.id);
      const [sc, sf] = (cells || fallback)[(cells || fallback).length - 1];
      return { col: wrap(sc), floor: sf, kind: 'spur' };
    },
    // Pit: a little platform hidden just below a 2-column jump gap. Dropping in lands you there
    // (instead of in the sea) and a step-up on either side climbs back onto the route. (Under a
    // 1-column gap the ledge-hang assist would always carry you across, so it would be unreachable.)
    pit(run) {
      if (run.arrive !== MOVE.JUMP_FLAT || run.gap !== 2 || used.has(run.id) || run.floor < 2) return null;
      const s = run.cells[0];
      const d = run.dir;
      const fl = run.floor - 1;
      if (cpFloors.has(fl)) return null;
      const cells = [];
      for (let i = 1; i <= run.gap; i++) cells.push(s - d * i);
      const ignore = new Set([run.id, run.id - 1]);
      if (!cells.every((c) => ok(c, fl, ignore)) || !commit(cells.map((c) => [c, fl]), [run.id - 1, run.id])) return null;
      used.add(run.id);
      return { col: wrap(cells[cells.length - 1]), floor: fl, kind: 'pit' };
    },
    // Lift stop: a little dead-end platform beside a lift shaft, part-way up
    liftStop(run) {
      if (!run.lift || used.has(run.id)) return null;
      const el = run.lift;
      const h = el.maxFloor - el.minFloor;
      if (h < 3) return null;
      for (const side of rng.shuffle([-run.liftBoardDir, run.liftBoardDir])) {
        for (const k of rng.shuffle([2, h - 1].filter((x, i, a) => x >= 2 && a.indexOf(x) === i))) {
          const fl = el.minFloor + k;
          if (cpFloors.has(fl)) continue;
          const cells = [el.col + side, el.col + 2 * side];
          if (!cells.every((c) => ok(c, fl)) || !commit(cells.map((c) => [c, fl]), [run.id - 1, run.id])) continue;
          used.add(run.id);
          return { col: wrap(cells[1]), floor: fl, kind: 'liftStop' };
        }
      }
      return null;
    },
    // Secret tunnel: an extra door in a route run leads to a tiny platform on the far side
    tunnel(run) {
      if (run.isExit || run.id === 0 || used.has(run.id) || run.cells.length < 3) return null;
      const f = run.floor;
      for (const i of rng.shuffle(run.cells.slice(1, -1).map((_, j) => j + 1))) {
        const a = run.cells[i];
        if (run.doors.has(a) || !doorClear(a, f)) continue;
        for (const dfl of rng.shuffle([1, 2, 3, 0, -1, -2])) {
          const fl = f + dfl;
          if (fl < 1 || fl > exitFloor - 1 || cpFloors.has(fl)) continue;
          const b = a + COLS / 2;
          const d2 = rng.chance(0.5) ? 1 : -1;
          const cells = [b, b + d2, b + 2 * d2].slice(0, rng.int(2, 3));
          if (!cells.every((c) => ok(c, fl)) || !doorClear(b, fl) || !commit(cells.map((c) => [c, fl]), [run.id])) continue;
          const idA = `${idTag}d${R.doorSeq++}`;
          const idB = `${idTag}d${R.doorSeq++}`;
          doors.push({ id: idA, col: wrap(a), floor: f, targetId: idB, isExit: false });
          doors.push({ id: idB, col: wrap(b), floor: fl, targetId: idA, isExit: false });
          run.doors.add(wrap(a));
          used.add(run.id);
          return { col: wrap(cells[cells.length - 1]), floor: fl, kind: 'tunnel' };
        }
      }
      return null;
    },
  };

  // Spread the three secrets over the low / middle / high thirds of the tower
  const bands = [
    [0, exitFloor / 3],
    [exitFloor / 3, (2 * exitFloor) / 3],
    [(2 * exitFloor) / 3, exitFloor + 1],
  ];
  const nookPool = rng.shuffle(nooks);
  const KINDS = ['spur', 'liftStop', 'tunnel', 'nook', 'pit'];
  const kinds = rng.shuffle(KINDS);
  const tryBand = (lo, hi, preferKind) => {
    const order = [preferKind, ...rng.shuffle(KINDS.filter((k) => k !== preferKind))];
    for (const kind of order) {
      if (kind === 'nook') {
        const n = nookPool.find((x) => x.floor >= lo && x.floor < hi && !used.has(x.runId));
        if (n) {
          used.add(n.runId);
          nookPool.splice(nookPool.indexOf(n), 1);
          return { col: n.col, floor: n.floor, kind: 'nook' };
        }
        continue;
      }
      for (const run of rng.shuffle(runs.filter((r) => r.floor >= lo && r.floor < hi))) {
        const s = gens[kind](run);
        if (s) return s;
      }
    }
    return null;
  };
  const missing = [];
  for (let i = 0; i < 3; i++) {
    const s = tryBand(bands[i][0], bands[i][1], kinds[i]) || tryBand(0, exitFloor + 1, kinds[(i + 3) % KINDS.length]);
    if (s) secrets.push(s);
    else missing.push(i);
  }
  relaxed = true;
  for (const i of missing) {
    const s = tryBand(bands[i][0], bands[i][1], kinds[i]) || tryBand(0, exitFloor + 1, kinds[(i + 3) % KINDS.length]);
    if (s) secrets.push(s);
  }
  return secrets.sort((a, b) => a.floor - b.floor);
}

// Special ledge types on route run interiors (never the first/last cell of a run, never under a
// door, the spawn run or the exit run), in short stretches with solid ledges on both sides.
function placeSpecials(rng, R, D) {
  const { L, runs } = R;
  const p = lerp(0.06, 0.3, D);
  const maxRun = D < 0.6 ? 1 : 2;
  const types = ['crumble', 'crumble', 'ice', 'conveyor'];
  let count = 0;
  for (const run of runs) {
    if (run.id === 0 || run.isExit || run.cells.length < 3) continue;
    let streak = 0;
    let streakType = null;
    const last = run.nook != null ? run.cells.length - 2 : run.cells.length - 1;
    for (let i = 1; i < last; i++) {
      const c = run.cells[i];
      if (run.doors.has(c) || streak >= maxRun || !rng.chance(p)) {
        streak = 0;
        continue;
      }
      let t = streak > 0 ? streakType : rng.pick(types);
      if (t === 'conveyor') t = rng.chance(0.5) ? 'conveyorR' : 'conveyorL';
      L.cells.get(key(c, run.floor)).type = t;
      streak++;
      streakType = t;
      count++;
    }
  }
  return count;
}

// Decoy ledges: short runs near the route that lead nowhere useful (some crumble, some ice).
function placeDecoys(rng, R, D, exitFloor, cpFloors) {
  const { L } = R;
  const target = Math.round((exitFloor + 2) * lerp(0.4, 0.55, D));
  let placed = 0;
  for (let tries = 0; tries < target * 40 && placed < target; tries++) {
    const r = rng.pick(L.route);
    const side = rng.chance(0.5) ? 1 : -1;
    const c = r.col + side * rng.int(2, 3);
    const f = r.floor + rng.int(-1, 2);
    const w = rng.int(1, 3);
    const cols = runCells(c, side, w);
    if (!cols.every((x) => extraOk(L, x, f, null, exitFloor - 1))) continue;
    const cells = cols.map((x) => [x, f]);
    const span = L.extraSpan(cells);
    if (!span.ok) continue;
    const roll = rng.next();
    let type = roll < lerp(0.15, 0.4, D) ? 'crumble' : roll < lerp(0.25, 0.55, D) ? 'ice' : 'solid';
    if (cpFloors.has(f)) type = 'crumble';
    L.addExtras(cells, type, 'decoy', span);
    // A shootable box on the far end of some wider decoys (bonus points, never in the way)
    if (w >= 2 && rng.chance(lerp(0.1, 0.35, D))) {
      const bc = cols[cols.length - 1] + side;
      if (extraOk(L, bc, f, null, exitFloor - 1)) L.add(bc, f, 'box', 'decoy');
    }
    placed++;
  }
  return placed;
}

function placeEnemies(rng, R, D, floors) {
  const { L, runs } = R;
  const total = Math.round(floors * lerp(0.24, 0.42, D));
  const nGround = Math.round(total * 0.5);
  const nFly = total - nGround;
  const enemies = [];
  // Ground patrols need a run >= 3 wide of standable cells, away from doors (tunnel exits) and spawn
  const groundRuns = rng.shuffle(
    runs.filter((r) => r.floor >= 2 && r.cells.length >= 3 && r.doors.size === 0 && (!r.isExit || D > 0.7))
  );
  for (const run of groundRuns.slice(0, nGround)) {
    const standable = run.cells.filter((c) => L.cells.get(key(c, run.floor))?.type !== 'box');
    if (standable.length < 3) continue;
    const c = standable[Math.floor(standable.length / 2)];
    enemies.push({
      type: rng.chance(0.5) ? 'roller' : 'bouncer',
      col: wrap(c) + 0.5,
      floor: run.floor,
      dir: rng.chance(0.5) ? 1 : -1,
      speed: +(lerp(1.4, 2.5, D) + rng.range(-0.15, 0.15)).toFixed(2),
    });
  }
  const flyRuns = rng.shuffle(runs.filter((r) => r.floor >= 1));
  for (const run of flyRuns.slice(0, nFly)) {
    const eye = D >= 0.25 && rng.chance(lerp(0.2, 0.45, D));
    const e = {
      type: eye ? 'eye' : 'molecule',
      col: wrap(rng.pick(run.cells)) + 0.5,
      floor: +(run.floor + rng.range(0.45, 0.65)).toFixed(2),
      dir: rng.chance(0.5) ? 1 : -1,
      speed: +(lerp(1.7, 2.9, D) + rng.range(-0.15, 0.15)).toFixed(2),
    };
    if (!eye) e.amp = +rng.range(0.35, 0.5).toFixed(2);
    enemies.push(e);
  }
  return enemies.sort((a, b) => a.floor - b.floor);
}

// ---------------------------------------------------------------------------------------------
// Names, palettes, timing, mechanics
// ---------------------------------------------------------------------------------------------

const NAME_ADJ = [
  'GLASS', 'IRON', 'SILENT', 'BROKEN', 'HOLLOW', 'SUNKEN', 'CRIMSON', 'FROZEN', 'GILDED', 'WHISPERING',
  'SHATTERED', 'ENDLESS', 'TWISTED', 'FORGOTTEN', 'BURNING', 'ASHEN', 'VELVET', 'NEON', 'ELECTRIC',
  'COBALT', 'OBSIDIAN', 'EMERALD', 'RUSTED', 'HAUNTED', 'DIZZY', 'CRYSTAL', 'MOLTEN', 'LONELY', 'RESTLESS',
];
const NAME_NOUN = [
  'SPIRE', 'NEEDLE', 'TOWER', 'PILLAR', 'COLUMN', 'BEACON', 'MINARET', 'OBELISK', 'CITADEL', 'LIGHTHOUSE',
  'STAIRWAY', 'HELIX', 'BELFRY', 'KEEP', 'TURRET', 'CHIMNEY', 'MONOLITH', 'LADDER', 'SPINDLE', 'ZIGGURAT',
];
const NAME_OF = [
  'ECHOES', 'STORMS', 'WHISPERS', 'GEARS', 'MIRRORS', 'EMBERS', 'TIDES', 'SHADOWS', 'BUBBLES', 'GHOSTS',
  'THUNDER', 'FROST', 'SPARKS', 'LANTERNS', 'BONES', 'STARS', 'VERTIGO', 'MADNESS', 'RUST', 'SORROW',
  'CLOCKWORK', 'THE DEEP', 'NO RETURN', 'A THOUSAND STEPS', 'THE LAST LIGHT',
];
const MECH_WORDS = {
  blizzard: ['FROZEN', 'FROST', 'SNOWBOUND'],
  wind: ['HOWLING', 'GALES', 'STORMS'],
  flood: ['SUNKEN', 'TIDES', 'DROWNED'],
  dark: ['SHADOWS', 'MIDNIGHT', 'LIGHTLESS'],
  collapse: ['CRUMBLING', 'BROKEN', 'RUIN'],
  pistons: ['CLOCKWORK', 'GEARS', 'PISTONS'],
};

function makeName(rng, mech) {
  const flavour = MECH_WORDS[mech] && rng.chance(0.45) ? rng.pick(MECH_WORDS[mech]) : null;
  const adjOk = (w) => NAME_ADJ.includes(w) || ['SNOWBOUND', 'HOWLING', 'DROWNED', 'LIGHTLESS', 'CRUMBLING', 'MIDNIGHT'].includes(w);
  const adj = flavour && adjOk(flavour) ? flavour : rng.pick(NAME_ADJ);
  const of = flavour && !adjOk(flavour) ? flavour : rng.pick(NAME_OF);
  const noun = rng.pick(NAME_NOUN);
  switch (rng.int(0, 3)) {
    case 0:
      return `THE ${adj} ${noun}`;
    case 1:
      return `${noun} OF ${of}`;
    case 2:
      return `THE ${adj} ${noun} OF ${of}`.length <= 30 ? `THE ${adj} ${noun} OF ${of}` : `${adj} ${noun}`;
    default:
      return `THE ${noun} OF ${of}`;
  }
}

function hslToHex(h, s, l) {
  h = ((h % 360) + 360) % 360;
  s /= 100;
  l /= 100;
  const k = (n) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  const hex = (x) => Math.round(x * 255).toString(16).padStart(2, '0');
  return `#${hex(f(0))}${hex(f(8))}${hex(f(4))}`;
}

// Harmonious palettes: saturated mid-dark bricks, a contrasting bright ledge colour (complement,
// split-complement or triad), near-black mortar of the brick hue and a glow near the brick hue.
function makePalette(rng, mech) {
  let h = rng.range(0, 360);
  if (mech === 'blizzard') h = rng.range(185, 225);
  if (mech === 'flood') h = rng.range(160, 200);
  const dark = mech === 'dark' ? 9 : 0;
  const s = rng.range(58, 78);
  const lA = rng.range(34, 42) - dark;
  const ledgeHue = h + rng.pick([180, 150, 210, 120, 240, 60]);
  const ledgeL = rng.range(63, 71);
  return {
    brickA: hslToHex(h, s, lA),
    brickB: hslToHex(h + rng.range(-6, 6), s + 4, lA + 6),
    mortar: hslToHex(h, s * 0.8, rng.range(7, 10)),
    ledge: hslToHex(ledgeHue, rng.range(80, 94), ledgeL),
    ledgeTop: hslToHex(ledgeHue, 92, rng.range(86, 92)),
    glow: hslToHex(h + rng.pick([-35, 25, 40]), 85, 62),
  };
}

function pickMechanic(rng, D) {
  const pNone = lerp(0.6, 0.15, D);
  if (rng.chance(pNone)) return 'none';
  return rng.pick(MECHANICS.slice(1));
}

// Generous estimate (seconds) of how long the main route takes a careful player
function estimateRouteTime(R, enemies, specials, mech) {
  const { runs, moves, elevators } = R;
  let t = 12; // getting going, reading the tower
  for (const run of runs) t += run.cells.length / 2.2;
  for (const { m, to } of moves) {
    if (m === MOVE.STEP) t += 0.6;
    else if (m === MOVE.JUMP_UP) t += 1.6;
    else if (m === MOVE.JUMP_FLAT) t += 1.4 + (runs[to].gap - 1) * 0.8;
    else if (m === MOVE.BOX) t += 2.4;
    else if (m === MOVE.TUNNEL) t += 1.6;
  }
  for (const el of elevators) {
    const h = el.maxFloor - el.minFloor;
    t += (h / el.speed) * 2 + 2; // wait for it on average + ride + boarding
  }
  t += enemies.length * 2.5 + specials * 0.6;
  if (mech !== 'none') t *= 1.08;
  return t;
}

// ---------------------------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------------------------

/**
 * Generate a complete, completable tower.
 * @param {object} o
 * @param {number|string} o.seed      any integer (or string); same seed -> same tower
 * @param {number} [o.difficulty=0.5] 0 (gentle) .. 1 (brutal)
 * @param {number} [o.id=100]         tower id (used for door ids / audio theme)
 * @param {string} [o.name]           tower name; generated from the seed if null
 * @param {string} [o.mechanic]       one of MECHANICS; picked from the seed if null
 */
export function generateTower({ seed, difficulty = 0.5, id = 100, name = null, mechanic = null } = {}) {
  const D = clamp01(Number.isFinite(+difficulty) ? +difficulty : 0.5);
  const baseSeed = typeof seed === 'number' && Number.isFinite(seed) ? seed : hash32(String(seed ?? 0));
  const sub = (tag) => new Rng(hash32(baseSeed, tag, Math.round(D * 1000)));

  const metaRng = sub('meta');
  const mech = MECHANICS.includes(mechanic) ? mechanic : pickMechanic(metaRng, D);
  const floors = Math.max(12, Math.min(28, Math.round(14 + 12 * D) + metaRng.int(-1, 1)));
  const exitFloor = floors - 2;
  const idTag = `p${id}`;

  // Route attempts are each deterministic; the first one that completes wins.
  let R = null;
  for (let attempt = 0; attempt < 200 && !R; attempt++) {
    R = buildRoute(new Rng(hash32(baseSeed, 'route', attempt, Math.round(D * 1000))), D, exitFloor, mech, idTag);
  }
  if (!R) throw new Error(`procgen: could not build a route for seed ${seed}`);

  // Checkpoints: roughly every 5 floors, on a floor where the main route has a solid ledge.
  // (The game flags the middle solid/ice ledge of that floor, so extras placed later on these
  // floors are never solid or ice: the flag always lands on the main route.)
  const routeFloors = [...new Set(R.L.route.map((c) => c.floor))].sort((a, b) => a - b);
  const checkpoints = [];
  for (let k = 5; k < exitFloor - 1; k += 5) {
    let best = null;
    for (const fl of routeFloors) {
      if (fl <= 0 || fl >= exitFloor) continue;
      if (best === null || Math.abs(fl - k) < Math.abs(best - k) || (Math.abs(fl - k) === Math.abs(best - k) && fl < best)) best = fl;
    }
    if (best !== null && !checkpoints.includes(best) && Math.abs(best - k) <= 2) checkpoints.push(best);
  }
  const cpFloors = new Set(checkpoints);

  const extraRng = sub('extras');
  const secrets = placeSecrets(extraRng, R, D, exitFloor, idTag, cpFloors);
  const specials = placeSpecials(sub('specials'), R, D);
  placeDecoys(sub('decoys'), R, D, exitFloor, cpFloors);
  const enemies = placeEnemies(sub('enemies'), R, D, floors);

  const est = estimateRouteTime(R, enemies, specials, mech);
  const timeLimit = Math.max(60, Math.round((est * lerp(1.6, 1.25, D)) / 5) * 5);

  const ledges = [...R.L.cells.values()]
    .map((c) => ({ col: c.col, floor: c.floor, type: c.type }))
    .sort((a, b) => a.floor - b.floor || a.col - b.col);

  const tower = {
    id,
    name: name || makeName(sub('name'), mech),
    timeLimit,
    palette: makePalette(sub('palette'), mech),
    floors,
    ledges,
    elevators: R.elevators,
    doors: R.doors,
    enemies,
    spawn: R.spawn,
    mechanic: mech,
    secrets: secrets.map(({ col, floor }) => ({ col, floor })),
    checkpoints,
    seed: baseSeed,
    difficulty: D,
    procedural: true,
  };
  return tower;
}

/** Stable integer seed for the UTC calendar day of `date` (same for everyone, all day). */
export function dailySeed(date = new Date()) {
  const ymd = date.getUTCFullYear() * 10000 + (date.getUTCMonth() + 1) * 100 + date.getUTCDate();
  return hash32(ymd, 'tt26-daily') % 2147483647;
}

/** Tower #index (0-based) of an endless run. Difficulty ramps from 0.1 up to 1.0 by tower 17. */
export function endlessTower(index, runSeed) {
  const i = Math.max(0, Math.floor(index));
  const difficulty = Math.min(1, 0.1 + i * 0.053);
  return generateTower({
    seed: hash32(runSeed ?? 0, 'endless', i),
    difficulty,
    id: 100 + i,
    mechanic: i === 0 ? 'none' : null,
  });
}

/**
 * Structural sanity checks (used by tests; cheap enough to run in game too).
 * Returns an array of problem strings (empty when the tower is well-formed).
 */
export function validateTower(t) {
  const problems = [];
  const at = new Map();
  for (const l of t.ledges) {
    const k = key(l.col, l.floor);
    if (at.has(k)) problems.push(`duplicate ledge at ${k}`);
    at.set(k, l);
  }
  const standable = (c, f) => {
    const l = at.get(key(c, f));
    return l && l.type !== 'box';
  };
  const sp = at.get(key(t.spawn.col, t.spawn.floor));
  if (!sp || sp.type !== 'solid' || t.spawn.floor !== 0) problems.push('spawn not on a solid floor-0 ledge');
  const exits = t.doors.filter((d) => d.isExit);
  if (exits.length !== 1) problems.push(`expected 1 exit door, got ${exits.length}`);
  for (const d of t.doors) {
    if (!standable(d.col, d.floor)) problems.push(`door ${d.id} not on a ledge`);
    if (d.targetId && !t.doors.some((x) => x.id === d.targetId && x.targetId === d.id)) problems.push(`door ${d.id} unpaired`);
  }
  for (const el of t.elevators) {
    for (let f = el.minFloor + 1; f < el.maxFloor; f++) if (at.has(key(el.col, f))) problems.push(`ledge inside shaft ${el.col}@${f}`);
  }
  for (const e of t.enemies) {
    if (e.type === 'roller' || e.type === 'bouncer') {
      if (!Number.isInteger(e.floor)) problems.push(`ground enemy at fractional floor ${e.floor}`);
      // contiguous standable run around the enemy's column
      const c0 = Math.floor(e.col);
      if (!standable(c0, e.floor)) problems.push(`ground enemy not on a ledge (${e.col},${e.floor})`);
      let w = 1;
      for (let c = c0 + 1; standable(c, e.floor) && w < COLS; c++) w++;
      for (let c = c0 - 1; standable(c, e.floor) && w < COLS; c--) w++;
      if (w < 3) problems.push(`ground enemy run too short (${e.col},${e.floor})`);
    } else if (Number.isInteger(e.floor)) problems.push(`flyer at integer floor ${e.floor}`);
  }
  for (const s of t.secrets || []) if (!standable(s.col, s.floor)) problems.push(`secret not above a ledge (${s.col},${s.floor})`);
  return problems;
}
