// Builds the ORIGINAL mode's towers from the real 1987 layouts (realTowerData.js).
//
// Coordinates: our "floor" is the step-row a cell sits on, counted from the bottom row (0). Pogo
// standing on a step in row r has floor r. Things at body height (doors, flashing blocks, pillars,
// enemies) that occupy row q belong to the floor below them, q - 1.
//
// What each source fact turns into (see docs/RESEARCH.md):
//   steps / crumbling / slippery -> ledges ('solid' | 'crumble' | 'slideR' | 'slideL')
//   '!' pillar runs              -> { type: 'pillar', floor, h } solid, not a platform, not shootable
//   'b' block runs               -> { type: 'box', floor, h } on top of the step below it
//   '#' 3-row doors              -> doors paired with column c + 8 (a tunnel through the core);
//                                   a door with no partner leads nowhere
//   'T'                          -> the exit door
//   '^' ... '+' ... 'v'          -> a lift: platform at its bottom stop, optional middle stops, top stop
//   digits                       -> enemy spawn points (kinds from Toppler's robots.cc)
import { REAL_TOWER_GRIDS } from './realTowerData.js';

const COLS = 16;
const wrap = (c) => ((c % COLS) + COLS) % COLS;

// 7800 time limits, CPC/NES rule: 100 s on Tower 1, +20 per tower (RESEARCH.md 8.1)
export const REAL_TIME_LIMITS = [100, 120, 140, 160, 180, 200, 220, 240];

// Enemy kinds by Toppler code. Speeds are in columns/s (sideways) or rows/s (up and down), from
// the PICO-8 port's units per tick scaled to the 7800's measured pace (1 unit/tick = 2 columns/s
// sideways, 4 rows/s vertically): see RESEARCH.md 6 and docs/ORIGINAL-RULES.md.
const KIND = {
  1: { kind: 'roll', type: 'roller', speed: 2.0 },
  2: { kind: 'bounce', type: 'bouncer', speed: 2.0 },
  3: { kind: 'park', type: 'bouncer', speed: 0 },
  4: { kind: 'vpat', speed: 4.0 },
  5: { kind: 'vpat', speed: 8.0 },
  6: { kind: 'hpat', speed: 2.0 },
  7: { kind: 'hpat', speed: 4.0 },
};

// How each tower's patrollers look. The behaviour is the same on every tower; only the sprite
// changes (RESEARCH.md 6). Tower 1's are the flying eyes and Tower 2's the robots (7800 manual);
// the others are not documented, so they cycle through our immune models.
const PATROL_LOOK = { 1: 'eye', 2: 'robot', 3: 'spiker', 4: 'eye', 5: 'spiker', 6: 'robot', 7: 'spiker', 8: 'eye' };

export function hasRealTower(id) {
  return Boolean(REAL_TOWER_GRIDS[id]);
}

export function buildRealTower(id, base = {}) {
  const top = REAL_TOWER_GRIDS[id];
  if (!top) return null;
  const rows = top.slice().reverse(); // rows[0] is the bottom
  // Toppler stores an empty row under the ground ledge (the sea); our floor 0 is the ground row
  while (rows.length && !rows[0].trim()) rows.shift();
  const H = rows.length;
  const at = (r, c) => (r >= 0 && r < H ? rows[r][wrap(c)] : ' ');
  const ledges = [];
  const doors = [];
  const elevators = [];
  const enemies = [];
  const problems = [];

  // Steps
  for (let r = 0; r < H; r++) {
    for (let c = 0; c < COLS; c++) {
      const ch = at(r, c);
      const type = ch === '-' ? 'solid' : ch === '.' ? 'crumble' : ch === '>' ? 'slideR' : ch === '<' ? 'slideL' : null;
      if (type) ledges.push({ col: c, floor: r, type });
    }
  }

  // Vertical runs of a symbol in one column -> [{ c, r0, n }]
  const runs = (sym) => {
    const out = [];
    for (let c = 0; c < COLS; c++) {
      let r = 0;
      while (r < H) {
        if (sym.includes(at(r, c))) {
          let n = 0;
          while (sym.includes(at(r + n, c))) n++;
          out.push({ c, r0: r, n });
          r += n;
        } else r++;
      }
    }
    return out;
  };

  for (const { c, r0, n } of runs('!')) ledges.push({ col: c, floor: r0 - 1, type: 'pillar', h: n });
  for (const { c, r0, n } of runs('b')) ledges.push({ col: c, floor: r0 - 1, type: 'box', h: n });

  // Doors (3 rows high). '#' and 'T' are separate runs so the summit's '#T##' splits correctly.
  const doorAt = new Map();
  for (const sym of ['#', 'T']) {
    for (const { c, r0, n } of runs(sym)) {
      for (let k = 0; k + 3 <= n; k += 3) {
        const floor = r0 + k - 1;
        const d = { id: `real${id}d${c}f${floor}`, col: c, floor, targetId: null, isExit: sym === 'T' };
        doors.push(d);
        doorAt.set(`${c},${floor}`, d);
      }
      if (n % 3) problems.push(`door run of ${n} at col ${c} row ${r0}`);
    }
  }
  for (const d of doors) {
    if (d.isExit) continue;
    const far = doorAt.get(`${wrap(d.col + 8)},${d.floor}`);
    if (far && !far.isExit) d.targetId = far.id;
  }

  // Lifts: a platform '^' rides up its column through middle stops '+' to the first top stop 'v'
  for (let r = 0; r < H; r++) {
    for (let c = 0; c < COLS; c++) {
      if (at(r, c) !== '^') continue;
      const stops = [r];
      let t = null;
      for (let k = r + 1; k < H; k++) {
        const ch = at(k, c);
        if (ch === '+') stops.push(k);
        else if (ch === 'v') {
          t = k;
          break;
        }
      }
      if (t == null) {
        problems.push(`lift at col ${c} row ${r} has no top stop`);
        continue;
      }
      stops.push(t);
      elevators.push({ col: c, minFloor: r, maxFloor: t, startFloor: r, stops, rowsPerSec: 4, speed: 4 / 1.5 });
    }
  }

  // Enemies
  for (let r = 0; r < H; r++) {
    for (let c = 0; c < COLS; c++) {
      const code = Number(at(r, c));
      if (!KIND[code]) continue;
      const k = KIND[code];
      enemies.push({
        type: k.type || PATROL_LOOK[id] || 'eye',
        kind: k.kind,
        kspeed: k.speed,
        col: c + 0.5,
        floor: r - 1,
        dir: (r + c) % 2 ? 1 : -1,
        spawnKey: `${c},${r}`,
      });
    }
  }

  if (problems.length && typeof console !== 'undefined') console.warn(`real tower ${id}:`, problems);
  const exit = doors.find((d) => d.isExit);
  return {
    id,
    name: base.name || `TOWER ${id}`,
    palette: base.palette,
    timeLimit: REAL_TIME_LIMITS[id - 1] || 100,
    floors: H,
    ledges,
    doors,
    elevators,
    enemies,
    spawn: { col: 0, floor: 0 },
    exitFloor: exit ? exit.floor : H - 4,
    real: true,
    mechanic: 'none',
    cacheKey: `real${id}`,
  };
}
