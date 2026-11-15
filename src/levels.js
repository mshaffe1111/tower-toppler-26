// All 8 Classic Tower Toppler Towers (16-column cylindrical grid)
export const COLS = 16;

function buildTower({
  id,
  name,
  timeLimit,
  palette,
  floors,
  ledges,
  elevators = [],
  doors = [],
  enemies = [],
  spawn = { col: 0, floor: 0 },
}) {
  return { id, name, timeLimit, palette, floors, ledges, elevators, doors, enemies, spawn };
}

// Helper to add a horizontal run of ledges wrapping around the 16-column cylinder
function span(ledges, floor, startCol, count, type = 'solid') {
  for (let i = 0; i < count; i++) {
    const col = ((startCol + i) % COLS + COLS) % COLS;
    ledges.push({ col, floor, type });
  }
}

// Helper to add a spiral staircase of ledges
function spiral(ledges, startFloor, startCol, steps, dir = 1, type = 'solid') {
  for (let i = 0; i < steps; i++) {
    const col = ((startCol + i * dir) % COLS + COLS) % COLS;
    ledges.push({ col, floor: startFloor + i, type });
  }
}

export function createTowers() {
  // 1. THE TOWER OF EYES (Classic Atari 7800 Blue)
  const t1Ledges = [];
  span(t1Ledges, 0, 14, 5, 'solid');
  span(t1Ledges, 1, 3, 4, 'solid');
  span(t1Ledges, 2, 8, 3, 'solid');
  span(t1Ledges, 3, 11, 3, 'solid');
  span(t1Ledges, 4, 15, 3, 'solid');
  span(t1Ledges, 5, 3, 4, 'solid');
  span(t1Ledges, 6, 8, 2, 'crumble');
  span(t1Ledges, 6, 11, 3, 'solid');
  // Tunnel at col 12, floor 6 -> col 4, floor 8
  span(t1Ledges, 8, 3, 4, 'solid');
  span(t1Ledges, 9, 8, 3, 'solid');
  span(t1Ledges, 10, 12, 3, 'solid');
  span(t1Ledges, 11, 0, 4, 'solid');
  span(t1Ledges, 12, 5, 4, 'solid');
  // Elevator at col 8 from floor 12 to 15
  span(t1Ledges, 15, 7, 5, 'solid');
  const t1 = buildTower({
    id: 1,
    name: 'THE TOWER OF EYES',
    timeLimit: 90,
    floors: 17,
    palette: {
      brickA: '#1d4ed8',
      brickB: '#2563eb',
      mortar: '#091536',
      ledge: '#60a5fa',
      ledgeTop: '#bfdbfe',
      glow: '#38bdf8',
    },
    ledges: t1Ledges,
    elevators: [
      { col: 8, minFloor: 12, maxFloor: 15, startFloor: 12, speed: 1.4 },
    ],
    doors: [
      { id: 't1a', col: 12, floor: 6, targetId: 't1b', isExit: false },
      { id: 't1b', col: 4, floor: 8, targetId: 't1a', isExit: false },
      { id: 't1exit', col: 10, floor: 15, targetId: null, isExit: true },
    ],
    enemies: [
      { type: 'roller', col: 5, floor: 1, dir: 1, speed: 1.5 },
      { type: 'molecule', col: 10, floor: 4.5, dir: 1, speed: 1.8, amp: 0.4 },
      { type: 'bouncer', col: 5, floor: 8, dir: -1, speed: 1.4 },
      { type: 'eye', col: 2, floor: 11.4, dir: 1, speed: 1.6 },
      { type: 'molecule', col: 9, floor: 15.5, dir: -1, speed: 2.0, amp: 0.35 },
    ],
  });

  // 2. THE REALM OF ROBOTS (Cyber Violet & Cyan)
  const t2Ledges = [];
  span(t2Ledges, 0, 15, 4, 'solid');
  span(t2Ledges, 1, 4, 3, 'solid');
  span(t2Ledges, 2, 8, 2, 'crumble');
  span(t2Ledges, 2, 11, 3, 'solid');
  span(t2Ledges, 3, 14, 3, 'solid');
  // Elevator at col 1 from floor 3 to 7
  span(t2Ledges, 7, 0, 4, 'solid');
  span(t2Ledges, 8, 5, 3, 'solid');
  span(t2Ledges, 9, 9, 2, 'solid');
  t2Ledges.push({ col: 11, floor: 9, type: 'box' });
  span(t2Ledges, 10, 12, 3, 'solid');
  // Tunnel at col 13, floor 10 -> col 5, floor 12
  span(t2Ledges, 12, 4, 4, 'solid');
  spiral(t2Ledges, 13, 8, 4, 1, 'solid');
  span(t2Ledges, 16, 11, 5, 'solid');
  const t2 = buildTower({
    id: 2,
    name: 'THE REALM OF ROBOTS',
    timeLimit: 95,
    floors: 18,
    palette: {
      brickA: '#6d28d9',
      brickB: '#7c3aed',
      mortar: '#1e0b3b',
      ledge: '#22d3ee',
      ledgeTop: '#a5f3fc',
      glow: '#c084fc',
    },
    ledges: t2Ledges,
    elevators: [
      { col: 1, minFloor: 3, maxFloor: 7, startFloor: 3, speed: 1.6 },
    ],
    doors: [
      { id: 't2a', col: 13, floor: 10, targetId: 't2b', isExit: false },
      { id: 't2b', col: 5, floor: 12, targetId: 't2a', isExit: false },
      { id: 't2exit', col: 14, floor: 16, targetId: null, isExit: true },
    ],
    enemies: [
      { type: 'roller', col: 6, floor: 1, dir: -1, speed: 1.8 },
      { type: 'molecule', col: 12, floor: 3.5, dir: 1, speed: 2.1, amp: 0.45 },
      { type: 'bouncer', col: 2, floor: 7, dir: 1, speed: 1.7 },
      { type: 'eye', col: 13, floor: 10.6, dir: -1, speed: 2.0 },
      { type: 'roller', col: 6, floor: 12, dir: 1, speed: 2.0 },
      { type: 'molecule', col: 13, floor: 16.5, dir: 1, speed: 2.2, amp: 0.4 },
    ],
  });

  // 3. TRAP OF TRICKS (Emerald & Gold — featuring trick loop doors!)
  const t3Ledges = [];
  span(t3Ledges, 0, 14, 5, 'solid');
  span(t3Ledges, 1, 4, 4, 'solid');
  span(t3Ledges, 2, 9, 3, 'crumble');
  span(t3Ledges, 3, 13, 3, 'solid');
  span(t3Ledges, 4, 0, 4, 'solid');
  // Door A (real) at col 3, floor 4 -> col 11, floor 7
  // Trick door at col 1, floor 4 -> loops back to col 15, floor 0!
  span(t3Ledges, 7, 10, 4, 'solid');
  span(t3Ledges, 8, 15, 3, 'solid');
  span(t3Ledges, 9, 3, 2, 'crumble');
  span(t3Ledges, 9, 6, 3, 'solid');
  span(t3Ledges, 10, 10, 3, 'solid');
  // Elevator at col 12 from floor 10 to 14
  span(t3Ledges, 14, 11, 4, 'solid');
  span(t3Ledges, 15, 0, 3, 'crumble');
  span(t3Ledges, 16, 4, 5, 'solid');
  const t3 = buildTower({
    id: 3,
    name: 'TRAP OF TRICKS',
    timeLimit: 100,
    floors: 18,
    palette: {
      brickA: '#047857',
      brickB: '#059669',
      mortar: '#04261c',
      ledge: '#fbbf24',
      ledgeTop: '#fde68a',
      glow: '#34d399',
    },
    ledges: t3Ledges,
    elevators: [
      { col: 12, minFloor: 10, maxFloor: 14, startFloor: 10, speed: 1.7 },
    ],
    doors: [
      { id: 't3trick', col: 1, floor: 4, targetId: 't3base', isExit: false },
      { id: 't3base', col: 15, floor: 0, targetId: 't3trick', isExit: false },
      { id: 't3a', col: 3, floor: 4, targetId: 't3b', isExit: false },
      { id: 't3b', col: 11, floor: 7, targetId: 't3a', isExit: false },
      { id: 't3exit', col: 7, floor: 16, targetId: null, isExit: true },
    ],
    enemies: [
      { type: 'bouncer', col: 6, floor: 1, dir: 1, speed: 1.8 },
      { type: 'molecule', col: 14, floor: 3.5, dir: -1, speed: 2.2, amp: 0.4 },
      { type: 'roller', col: 12, floor: 7, dir: -1, speed: 2.1 },
      { type: 'eye', col: 7, floor: 9.5, dir: 1, speed: 2.2 },
      { type: 'molecule', col: 13, floor: 14.5, dir: 1, speed: 2.3, amp: 0.5 },
      { type: 'roller', col: 6, floor: 16, dir: -1, speed: 2.0 },
    ],
  });

  // 4. SLIPPERY SLIDE (Frost Ice Blue & White)
  const t4Ledges = [];
  span(t4Ledges, 0, 14, 5, 'solid');
  span(t4Ledges, 1, 3, 5, 'ice');
  span(t4Ledges, 2, 9, 4, 'ice');
  span(t4Ledges, 3, 14, 3, 'solid');
  span(t4Ledges, 4, 2, 4, 'ice');
  // Elevator at col 6 from floor 4 to 8
  span(t4Ledges, 8, 5, 4, 'ice');
  span(t4Ledges, 9, 10, 3, 'solid');
  span(t4Ledges, 10, 14, 3, 'ice');
  // Tunnel col 15, floor 10 -> col 7, floor 12
  span(t4Ledges, 12, 6, 4, 'ice');
  span(t4Ledges, 13, 11, 3, 'crumble');
  span(t4Ledges, 14, 15, 3, 'ice');
  span(t4Ledges, 15, 3, 3, 'solid');
  span(t4Ledges, 16, 7, 5, 'ice');
  const t4 = buildTower({
    id: 4,
    name: 'SLIPPERY SLIDE',
    timeLimit: 100,
    floors: 18,
    palette: {
      brickA: '#0284c7',
      brickB: '#0ea5e9',
      mortar: '#08263b',
      ledge: '#e0f2fe',
      ledgeTop: '#ffffff',
      glow: '#7dd3fc',
    },
    ledges: t4Ledges,
    elevators: [
      { col: 6, minFloor: 4, maxFloor: 8, startFloor: 4, speed: 1.8 },
    ],
    doors: [
      { id: 't4a', col: 15, floor: 10, targetId: 't4b', isExit: false },
      { id: 't4b', col: 7, floor: 12, targetId: 't4a', isExit: false },
      { id: 't4exit', col: 10, floor: 16, targetId: null, isExit: true },
    ],
    enemies: [
      { type: 'roller', col: 5, floor: 1, dir: 1, speed: 2.0 },
      { type: 'molecule', col: 11, floor: 2.5, dir: -1, speed: 2.3, amp: 0.45 },
      { type: 'bouncer', col: 7, floor: 8, dir: 1, speed: 1.9 },
      { type: 'eye', col: 11, floor: 9.6, dir: -1, speed: 2.3 },
      { type: 'molecule', col: 8, floor: 12.6, dir: 1, speed: 2.4, amp: 0.4 },
      { type: 'roller', col: 9, floor: 16, dir: -1, speed: 2.2 },
    ],
  });

  // 5. BROKEN PATH (Crimson & Obsidian — crumbling bridges)
  const t5Ledges = [];
  span(t5Ledges, 0, 14, 5, 'solid');
  span(t5Ledges, 1, 3, 2, 'crumble');
  span(t5Ledges, 2, 6, 3, 'solid');
  span(t5Ledges, 3, 10, 2, 'crumble');
  span(t5Ledges, 4, 13, 3, 'solid');
  // Tunnel col 14, floor 4 -> col 2, floor 7
  span(t5Ledges, 7, 1, 4, 'solid');
  span(t5Ledges, 8, 6, 2, 'crumble');
  span(t5Ledges, 9, 9, 3, 'solid');
  // Elevator col 11, floor 9 -> 13
  span(t5Ledges, 13, 10, 4, 'solid');
  span(t5Ledges, 14, 15, 2, 'crumble');
  span(t5Ledges, 15, 2, 3, 'solid');
  span(t5Ledges, 16, 6, 2, 'crumble');
  span(t5Ledges, 17, 9, 5, 'solid');
  const t5 = buildTower({
    id: 5,
    name: 'BROKEN PATH',
    timeLimit: 105,
    floors: 19,
    palette: {
      brickA: '#991b1b',
      brickB: '#dc2626',
      mortar: '#260606',
      ledge: '#fca5a5',
      ledgeTop: '#fee2e2',
      glow: '#f87171',
    },
    ledges: t5Ledges,
    elevators: [
      { col: 11, minFloor: 9, maxFloor: 13, startFloor: 9, speed: 1.9 },
    ],
    doors: [
      { id: 't5a', col: 14, floor: 4, targetId: 't5b', isExit: false },
      { id: 't5b', col: 2, floor: 7, targetId: 't5a', isExit: false },
      { id: 't5exit', col: 12, floor: 17, targetId: null, isExit: true },
    ],
    enemies: [
      { type: 'molecule', col: 7, floor: 2.5, dir: 1, speed: 2.3, amp: 0.45 },
      { type: 'roller', col: 14, floor: 4, dir: -1, speed: 2.2 },
      { type: 'bouncer', col: 3, floor: 7, dir: 1, speed: 2.1 },
      { type: 'eye', col: 10, floor: 9.6, dir: 1, speed: 2.4 },
      { type: 'molecule', col: 12, floor: 13.5, dir: -1, speed: 2.5, amp: 0.5 },
      { type: 'roller', col: 11, floor: 17, dir: -1, speed: 2.3 },
    ],
  });

  // 6. SWIMMER'S DELIGHT (Toxic Teal & Lime — conveyors & precision jumps)
  const t6Ledges = [];
  span(t6Ledges, 0, 14, 5, 'solid');
  span(t6Ledges, 1, 3, 4, 'conveyorR');
  span(t6Ledges, 2, 8, 3, 'solid');
  span(t6Ledges, 3, 12, 3, 'conveyorL');
  // Elevator col 15, floor 3 -> 7
  span(t6Ledges, 7, 14, 4, 'solid');
  span(t6Ledges, 8, 3, 3, 'crumble');
  span(t6Ledges, 9, 7, 4, 'ice');
  // Tunnel col 9, floor 9 -> col 1, floor 12
  span(t6Ledges, 12, 0, 4, 'solid');
  span(t6Ledges, 13, 5, 3, 'conveyorR');
  span(t6Ledges, 14, 9, 3, 'solid');
  span(t6Ledges, 15, 13, 2, 'crumble');
  span(t6Ledges, 16, 0, 3, 'solid');
  span(t6Ledges, 17, 4, 5, 'solid');
  const t6 = buildTower({
    id: 6,
    name: "SWIMMER'S DELIGHT",
    timeLimit: 110,
    floors: 19,
    palette: {
      brickA: '#0f766e',
      brickB: '#14b8a6',
      mortar: '#042220',
      ledge: '#a3e635',
      ledgeTop: '#ecfccb',
      glow: '#2dd4bf',
    },
    ledges: t6Ledges,
    elevators: [
      { col: 15, minFloor: 3, maxFloor: 7, startFloor: 3, speed: 2.0 },
    ],
    doors: [
      { id: 't6a', col: 9, floor: 9, targetId: 't6b', isExit: false },
      { id: 't6b', col: 1, floor: 12, targetId: 't6a', isExit: false },
      { id: 't6exit', col: 7, floor: 17, targetId: null, isExit: true },
    ],
    enemies: [
      { type: 'roller', col: 5, floor: 1, dir: 1, speed: 2.2 },
      { type: 'molecule', col: 13, floor: 3.5, dir: -1, speed: 2.5, amp: 0.45 },
      { type: 'bouncer', col: 8, floor: 9, dir: 1, speed: 2.1 },
      { type: 'eye', col: 2, floor: 12.6, dir: 1, speed: 2.5 },
      { type: 'molecule', col: 10, floor: 14.5, dir: -1, speed: 2.6, amp: 0.5 },
      { type: 'roller', col: 6, floor: 17, dir: -1, speed: 2.4 },
    ],
  });

  // 7. NASTY ONE (Magma Orange & Charcoal)
  const t7Ledges = [];
  span(t7Ledges, 0, 14, 5, 'solid');
  span(t7Ledges, 1, 3, 3, 'ice');
  span(t7Ledges, 2, 7, 2, 'crumble');
  span(t7Ledges, 3, 10, 3, 'solid');
  // Elevator col 13, floor 3 -> 8
  span(t7Ledges, 8, 12, 4, 'solid');
  span(t7Ledges, 9, 1, 3, 'conveyorL');
  span(t7Ledges, 10, 5, 3, 'solid');
  // Tunnel col 6, floor 10 -> col 14, floor 13
  span(t7Ledges, 13, 13, 4, 'solid');
  span(t7Ledges, 14, 2, 2, 'crumble');
  span(t7Ledges, 15, 5, 3, 'ice');
  span(t7Ledges, 16, 9, 3, 'solid');
  span(t7Ledges, 17, 13, 2, 'crumble');
  span(t7Ledges, 18, 0, 5, 'solid');
  const t7 = buildTower({
    id: 7,
    name: 'NASTY ONE',
    timeLimit: 115,
    floors: 20,
    palette: {
      brickA: '#c2410c',
      brickB: '#ea580c',
      mortar: '#290f04',
      ledge: '#fde047',
      ledgeTop: '#fef9c3',
      glow: '#fb923c',
    },
    ledges: t7Ledges,
    elevators: [
      { col: 13, minFloor: 3, maxFloor: 8, startFloor: 3, speed: 2.1 },
    ],
    doors: [
      { id: 't7a', col: 6, floor: 10, targetId: 't7b', isExit: false },
      { id: 't7b', col: 14, floor: 13, targetId: 't7a', isExit: false },
      { id: 't7exit', col: 3, floor: 18, targetId: null, isExit: true },
    ],
    enemies: [
      { type: 'molecule', col: 4, floor: 1.5, dir: 1, speed: 2.6, amp: 0.45 },
      { type: 'roller', col: 11, floor: 3, dir: -1, speed: 2.4 },
      { type: 'bouncer', col: 14, floor: 8, dir: 1, speed: 2.2 },
      { type: 'eye', col: 6, floor: 10.6, dir: -1, speed: 2.6 },
      { type: 'molecule', col: 15, floor: 13.5, dir: 1, speed: 2.7, amp: 0.5 },
      { type: 'roller', col: 10, floor: 16, dir: -1, speed: 2.5 },
      { type: 'molecule', col: 2, floor: 18.6, dir: 1, speed: 2.6, amp: 0.4 },
    ],
  });

  // 8. EDGE OF DOOM (Neon Magenta & Midnight — The Grand Finale!)
  const t8Ledges = [];
  span(t8Ledges, 0, 14, 5, 'solid');
  span(t8Ledges, 1, 3, 2, 'crumble');
  span(t8Ledges, 2, 6, 3, 'ice');
  span(t8Ledges, 3, 10, 3, 'conveyorR');
  span(t8Ledges, 4, 14, 3, 'solid');
  // Elevator col 1, floor 4 -> 9
  span(t8Ledges, 9, 0, 4, 'solid');
  span(t8Ledges, 10, 5, 2, 'crumble');
  span(t8Ledges, 11, 8, 3, 'solid');
  // Tunnel col 10, floor 11 -> col 2, floor 14
  span(t8Ledges, 14, 1, 4, 'ice');
  span(t8Ledges, 15, 6, 2, 'crumble');
  span(t8Ledges, 16, 9, 3, 'solid');
  // Elevator col 11, floor 16 -> 19
  span(t8Ledges, 19, 10, 5, 'solid');
  const t8 = buildTower({
    id: 8,
    name: 'EDGE OF DOOM',
    timeLimit: 120,
    floors: 21,
    palette: {
      brickA: '#9d174d',
      brickB: '#db2777',
      mortar: '#240515',
      ledge: '#38bdf8',
      ledgeTop: '#e0f2fe',
      glow: '#f472b6',
    },
    ledges: t8Ledges,
    elevators: [
      { col: 1, minFloor: 4, maxFloor: 9, startFloor: 4, speed: 2.2 },
      { col: 11, minFloor: 16, maxFloor: 19, startFloor: 16, speed: 2.2 },
    ],
    doors: [
      { id: 't8a', col: 10, floor: 11, targetId: 't8b', isExit: false },
      { id: 't8b', col: 2, floor: 14, targetId: 't8a', isExit: false },
      { id: 't8exit', col: 13, floor: 19, targetId: null, isExit: true },
    ],
    enemies: [
      { type: 'roller', col: 7, floor: 2, dir: 1, speed: 2.5 },
      { type: 'molecule', col: 12, floor: 3.5, dir: -1, speed: 2.7, amp: 0.45 },
      { type: 'bouncer', col: 2, floor: 9, dir: 1, speed: 2.3 },
      { type: 'eye', col: 9, floor: 11.6, dir: -1, speed: 2.7 },
      { type: 'molecule', col: 3, floor: 14.5, dir: 1, speed: 2.8, amp: 0.5 },
      { type: 'roller', col: 10, floor: 16, dir: -1, speed: 2.6 },
      { type: 'molecule', col: 12, floor: 19.6, dir: 1, speed: 2.9, amp: 0.4 },
    ],
  });

  return [t1, t2, t3, t4, t5, t6, t7, t8];
}
