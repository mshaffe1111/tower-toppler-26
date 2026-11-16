// ORIGINAL (1987) mode: the same 8 tower layouts, each restored to its original identity
// (docs/ORIGINAL-RULES.md). The Reboot campaign layers mechanics, new enemies and assists on top
// of these towers; Original strips all of that back to what the 1987/1988 game was:
//   T1 Tower of Eyes     bouncing cannonballs, flying eyes, flashing blocks
//   T2 Realm of Robots   patrolling robots (immune) + bouncing cannonballs
//   T3 Trap of Tricks    mutant molecules (immune) + bouncing balls, lots of tunnels
//   T4 Slippery Slide    slippery ledges, sliding cannonballs, eyes
//   T5 Broken Path       long chains of crumbling ledges
//   T6 Swimmer's Delight wide gaps over the sea, eyes and cannonballs
//   T7 Nasty One         fast mix of robots, molecules, eyes and sliding cannonballs
//   T8 Edge of Doom      everything, slippery + crumbling, and a four-door summit
// Rules (applied in game.js when tower.original is set): eyes, molecules and robots can't be
// shot; a sliding cannonball can only be stunned, and a stunned one still blocks the ledge;
// bouncing cannonballs pop (100), flashing blocks break (50); no charged shot, rewind,
// checkpoints, edge guard, extra patrols or flyers.
import { COLS } from './levels.js';

const SOLIDIFY = { conveyorL: 'solid', conveyorR: 'solid' };
// the 1987 cast; anything else a generated level places is mapped onto it
const ORIGINAL_CAST = new Set(['bouncer', 'roller', 'eye', 'molecule', 'robot']);
const GROUND = new Set(['bouncer', 'roller', 'robot', 'chaser', 'spiker', 'shieldbug', 'puffer', 'splitter']);
const toCast = (type, mapped) => (ORIGINAL_CAST.has(mapped) ? mapped : GROUND.has(type) ? 'bouncer' : 'eye');

export const ORIGINAL_THEMES = {
  1: {
    enemies: { roller: 'bouncer', molecule: 'eye', bouncer: 'bouncer', eye: 'eye' },
    ledges: { ...SOLIDIFY, crumble: 'solid', ice: 'solid' },
    boxes: 4,
  },
  2: {
    enemies: { roller: 'robot', molecule: 'bouncer', bouncer: 'robot', eye: 'bouncer' },
    ledges: { ...SOLIDIFY, ice: 'solid' },
    boxes: 4,
  },
  3: {
    enemies: { roller: 'bouncer', molecule: 'molecule', bouncer: 'bouncer', eye: 'molecule' },
    ledges: { ...SOLIDIFY, ice: 'solid' },
    boxes: 3,
  },
  4: {
    enemies: { roller: 'roller', molecule: 'eye', bouncer: 'bouncer', eye: 'eye' },
    ledges: { ...SOLIDIFY, crumble: 'ice' },
    boxes: 3,
  },
  5: {
    enemies: { roller: 'bouncer', molecule: 'molecule', bouncer: 'bouncer', eye: 'eye' },
    ledges: { ...SOLIDIFY, ice: 'crumble' },
    crumbleChains: true,
    boxes: 5,
  },
  6: {
    enemies: { roller: 'bouncer', molecule: 'eye', bouncer: 'bouncer', eye: 'eye' },
    ledges: { ...SOLIDIFY, ice: 'solid', crumble: 'solid' },
    boxes: 3,
  },
  7: {
    enemies: { roller: 'roller', molecule: 'molecule', bouncer: 'robot', eye: 'eye' },
    ledges: { ...SOLIDIFY },
    speed: 1.25,
    boxes: 5,
  },
  8: {
    enemies: { roller: 'roller', molecule: 'molecule', bouncer: 'robot', eye: 'eye' },
    ledges: { conveyorL: 'ice', conveyorR: 'ice' },
    speed: 1.15,
    boxes: 5,
    summitDoors: true,
  },
};

const wrap = (c) => ((c % COLS) + COLS) % COLS;

// Contiguous ledge runs per floor: [{ floor, cols: [c0, c1, ...] }] in walking order
function ledgeRuns(ledges) {
  const byFloor = new Map();
  for (const l of ledges) {
    if (!byFloor.has(l.floor)) byFloor.set(l.floor, new Map());
    byFloor.get(l.floor).set(l.col, l);
  }
  const runs = [];
  for (const [floor, cols] of byFloor) {
    const seen = new Set();
    for (const c of cols.keys()) {
      if (seen.has(c)) continue;
      let a = c;
      while (cols.has(wrap(a - 1)) && wrap(a - 1) !== c) a = wrap(a - 1);
      const run = [];
      for (let k = a; cols.has(wrap(k)) && !seen.has(wrap(k)); k++) {
        seen.add(wrap(k));
        run.push(cols.get(wrap(k)));
      }
      runs.push({ floor, ledges: run });
    }
  }
  return runs;
}

// Transform a (raw) campaign tower into its Original-mode version. Pure: returns a new object.
export function makeOriginalTower(raw) {
  const th = ORIGINAL_THEMES[raw.id];
  if (!th) return raw;
  const t = {
    ...raw,
    original: true,
    mechanic: 'none',
    ledges: raw.ledges.map((l) => ({ ...l, type: th.ledges[l.type] || l.type })),
    elevators: raw.elevators.map((e) => ({ ...e })),
    doors: raw.doors.map((d) => ({ ...d, vault: false })),
    enemies: raw.enemies.map((e) => {
      const type = toCast(e.type, th.enemies[e.type] || e.type);
      return {
        ...e,
        type,
        speed: (e.speed || 2.4) * (th.speed || 1),
        // ground walkers sit on their ledge; fliers keep their hover height
        floor: ['robot', 'bouncer', 'roller'].includes(type) ? Math.round(e.floor) : e.floor,
      };
    }),
    spawn: { ...raw.spawn },
    secrets: raw.secrets ? raw.secrets.map((s) => ({ ...s })) : raw.secrets,
  };
  const exitDoor = t.doors.find((d) => d.isExit);
  const exitFloor = exitDoor ? exitDoor.floor : Math.max(...t.ledges.map((l) => l.floor));
  const doorAt = new Set(t.doors.map((d) => `${d.col},${d.floor}`));
  const liftCols = new Set(t.elevators.map((e) => e.col));
  const enemyAt = (col, floor) => t.enemies.some((e) => Math.round(e.floor) === floor && Math.abs(((e.col - col + COLS * 1.5) % COLS) - COLS / 2) < 1.5);
  const safeInterior = (run, i) => {
    const l = run.ledges[i];
    return (
      i > 0 &&
      i < run.ledges.length - 1 &&
      run.floor > t.spawn.floor + 1 &&
      run.floor < exitFloor &&
      !doorAt.has(`${l.col},${l.floor}`) &&
      !liftCols.has(l.col) &&
      l.type === 'solid'
    );
  };
  const runs = ledgeRuns(t.ledges).sort((a, b) => a.floor - b.floor || a.ledges[0].col - b.ledges[0].col);

  // Broken Path: chains of crumbling ledges. The original's crumbling ledges vanish the moment
  // you stand on one, so they are crossed by hopping: every other interior ledge of the longer
  // runs (a 1-column gap is what a 1.5-column jump clears)
  if (th.crumbleChains) {
    for (const run of runs) {
      if (run.ledges.length < 3) continue;
      run.ledges.forEach((l, i) => {
        if (i % 2 === 1 && safeInterior(run, i)) l.type = 'crumble';
      });
    }
  }
  // The same rule for any crumbling stretch the generator made: never two side by side
  for (const run of runs) {
    run.ledges.forEach((l, i) => {
      if (l.type === 'crumble' && i > 0 && run.ledges[i - 1].type === 'crumble') l.type = 'solid';
    });
  }
  // Ice becomes the original's slippery ledges, which push you one way while you stand still
  // (one direction per run, alternating up the tower)
  for (const run of runs) {
    for (const l of run.ledges) if (l.type === 'ice') l.type = run.floor % 2 ? 'slideR' : 'slideL';
  }

  // Flashing blocks: in the middle of long solid runs, spread up the tower, never next to a
  // door, lift, spawn or enemy patrol (they're always shootable, so they never block the route)
  if (th.boxes) {
    const cands = runs.filter((r) => r.ledges.length >= 4 && r.floor > t.spawn.floor + 1 && r.floor < exitFloor - 1);
    const step = Math.max(1, Math.floor(cands.length / (th.boxes + 1)));
    let placed = 0;
    for (let k = step; k < cands.length && placed < th.boxes; k += step) {
      const run = cands[k];
      const i = Math.floor(run.ledges.length / 2);
      const l = run.ledges[i];
      if (!safeInterior(run, i) || enemyAt(l.col, l.floor)) continue;
      l.type = 'box';
      placed++;
    }
  }

  // Edge of Doom: a four-door summit. Only the third door from where you arrive is the control
  // room; the decoys slam and knock you back down.
  if (th.summitDoors && exitDoor && (!raw.procedural || raw.canonical)) {
    const f = exitDoor.floor;
    // you arrive on the summit by the lift that reaches it (else from the exit run's start)
    const lift = t.elevators.find((e) => e.maxFloor === f);
    const arrive = lift ? lift.col : exitDoor.col - 2;
    const has = (c) => t.ledges.some((l) => l.floor === f && l.col === wrap(c));
    // widen the summit walkway so four doors fit two columns apart
    for (let c = arrive - 3; c <= arrive + 7; c++) {
      if (!has(c)) t.ledges.push({ col: wrap(c), floor: f, type: 'solid' });
    }
    // doors at arrive-2 | arrive+2, arrive+4, arrive+6: walking on from the lift, the third
    // door is the real one
    exitDoor.col = wrap(arrive + 6);
    for (const dc of [-2, 2, 4]) {
      t.doors.push({ id: `t${t.id}decoy${dc}`, col: wrap(arrive + dc), floor: f, targetId: null, isExit: false, decoy: true });
    }
  }
  t.cacheKey = `${raw.cacheKey || raw.id}|orig`;
  return t;
}
