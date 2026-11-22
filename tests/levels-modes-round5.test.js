import { describe, it, expect, vi } from 'vitest';
import * as THREE from '../vendor/three/build/three.module.min.js';
import {
  COLS,
  wrapCol,
  createTowers,
  createCampaignTowers,
  createSanctumTowers,
  createWardenGauntletTowers,
  createDailyTower,
  generateProceduralTower,
  verifyTowerSolvable,
  isCanonicalStairStep,
  PROCEDURAL_SET_PIECE_CHUNKS,
} from '../src/levels.js';
import { ToweringWatersGame, FIXED_STEP } from '../src/game.js';
import { InputController } from '../src/input.js';

vi.mock('three', () => import('../vendor/three/build/three.module.min.js'));
vi.mock('three/addons/geometries/RoundedBoxGeometry.js', () =>
  import('../vendor/three/examples/jsm/geometries/RoundedBoxGeometry.js')
);
vi.mock('three/addons/loaders/GLTFLoader.js', () =>
  import('../vendor/three/examples/jsm/loaders/GLTFLoader.js')
);
vi.mock('three/addons/utils/BufferGeometryUtils.js', () =>
  import('../vendor/three/examples/jsm/utils/BufferGeometryUtils.js')
);

function createMockInput() {
  const state = {
    left: false,
    right: false,
    up: false,
    down: false,
    jump: false,
    fire: false,
    whip: false,
    analogX: 0,
    analogY: 0,
  };
  const edges = {
    jump: false,
    fire: false,
    whip: false,
    up: false,
    down: false,
    left: false,
    right: false,
  };
  return {
    controlMode: 'gesture',
    state,
    edges,
    press(key) {
      state[key] = true;
      edges[key] = true;
    },
    release(key) {
      state[key] = false;
    },
    consumeJustPressed(key) {
      const v = Boolean(edges[key]);
      edges[key] = false;
      return v;
    },
    isLiveHorizHeld() {
      return Boolean(state.left || state.right || Math.abs(state.analogX || 0) > 0.05);
    },
    update() {},
    clearFrame() {},
    resetState() {
      for (const k of Object.keys(state)) state[k] = typeof state[k] === 'number' ? 0 : false;
      for (const k of Object.keys(edges)) edges[k] = false;
    },
    setGameMode() {},
    setInteractContext() {},
    haptic() {},
  };
}

function createSilentProgression() {
  const settings = { zenMode: false, skinId: 'sea_glass_guardian', blasterFxId: 'tidal_pearl' };
  return {
    getSettings: () => ({ ...settings }),
    updateSettings: (s) => Object.assign(settings, s),
    getEquippedSkin: () => settings.skinId,
    getEquippedBlasterFx: () => settings.blasterFxId,
    getHighScore: () => 0,
    recordScore: () => {},
    getGears: () => 0,
    addGears: () => {},
    getSkillRank: () => 0,
    getAllSkillRanks: () => ({}),
    getCollectedRelics: () => [],
    getRescuedCritters: () => [],
    getCritterCount: () => 0,
    getWatershedHealth: () => 50,
    getOverallWatershedHealth: () => 50,
    drainPendingTrophies: () => [],
    recordGameplayEvent: () => null,
    unlockTrophy: () => null,
  };
}

function assertCanonicalStairInvariants(tower, label) {
  const walkableTypes = new Set([
    'solid',
    'stair',
    'stairR',
    'stairL',
    'ice',
    'crumble',
    'conveyorL',
    'conveyorR',
    'phaseBlock',
    'steamVent',
    'piston',
  ]);
  const solidStairTypes = new Set(['solid', 'stair', 'stairR', 'stairL']);

  const walkableAt = new Map();
  for (const l of tower.ledges) {
    if (walkableTypes.has(l.type)) {
      walkableAt.set(`${wrapCol(l.col)}:${Math.round(l.floor)}`, l);
    }
  }

  for (const l of tower.ledges) {
    if (l.type === 'box' || l.type === 'pillar' || l.type === 'laserGate') continue;
    const canR = isCanonicalStairStep(tower.ledges, tower.elevators, l.col, l.floor, 1);
    const canL = isCanonicalStairStep(tower.ledges, tower.elevators, l.col, l.floor, -1);
    expect(canR && canL, `${label}: ledge (${l.col},${l.floor}) cannot climb both directions`).toBe(false);

    const expectedDir = canR ? 1 : canL ? -1 : 0;
    expect(l.stairDir, `${label}: (${l.col},${l.floor}) stairDir mismatch`).toBe(expectedDir);
    expect(Boolean(l.isStair), `${label}: (${l.col},${l.floor}) isStair mismatch`).toBe(expectedDir !== 0);
    expect(Boolean(l.isExplicitStair), `${label}: (${l.col},${l.floor}) isExplicitStair mismatch`).toBe(
      expectedDir !== 0
    );

    if (l.stairDir !== 0) {
      expect(
        solidStairTypes.has(l.type),
        `${label}: (${l.col},${l.floor}) non-solid type ${l.type} marked as stair`
      ).toBe(true);
      const nc = wrapCol(l.col + l.stairDir);
      const up = walkableAt.get(`${nc}:${l.floor + 1}`);
      expect(up, `${label}: (${l.col},${l.floor}) missing upper solid landing`).toBeDefined();
      expect(
        solidStairTypes.has(up.type),
        `${label}: (${l.col},${l.floor}) climbs into non-solid ${up?.type}`
      ).toBe(true);
      expect(
        walkableAt.has(`${nc}:${l.floor}`),
        `${label}: (${l.col},${l.floor}) has flat bridge at (${nc},${l.floor})`
      ).toBe(false);
      expect(
        walkableAt.has(`${l.col}:${l.floor + 1}`),
        `${label}: (${l.col},${l.floor}) has overhead ceiling at (${l.col},${l.floor + 1})`
      ).toBe(false);
    }
  }
}

describe('Round 5 Deliverable 1: Canonical 1:1 Staircase Invariant & isCanonicalStairStep', () => {
  it('enforces all 5 canonical staircase clauses in isCanonicalStairStep (rejects non-solid, flat bridge, blockers, shafts, and unflagged terrace jumps)', () => {
    // Valid explicit solid -> solid stair
    const baseValid = [
      { col: 2, floor: 0, type: 'solid', stairDir: 1, isExplicitStair: true, explicitStairDir: 1 },
      { col: 3, floor: 1, type: 'solid', stairDir: 0 },
    ];
    expect(isCanonicalStairStep(baseValid, [], 2, 0, 1)).toBe(true);
    expect(isCanonicalStairStep(baseValid, [], 2, 0, -1)).toBe(false);

    // Unflagged solid -> solid terrace jump step (stairDir === 0) must NOT be treated as a staircase
    const unflaggedJump = [
      { col: 2, floor: 0, type: 'solid', stairDir: 0, isExplicitStair: false },
      { col: 3, floor: 1, type: 'solid', stairDir: 0 },
    ];
    expect(isCanonicalStairStep(unflaggedJump, [], 2, 0, 1)).toBe(false);

    // Non-solid upper or lower tiles must NEVER be treated as staircases
    for (const nonSolid of ['phaseBlock', 'conveyorR', 'conveyorL', 'crumble', 'ice', 'steamVent', 'piston']) {
      const toNonSolid = [
        { col: 2, floor: 0, type: 'solid', stairDir: 1, isExplicitStair: true, explicitStairDir: 1 },
        { col: 3, floor: 1, type: nonSolid, stairDir: 0 },
      ];
      expect(isCanonicalStairStep(toNonSolid, [], 2, 0, 1)).toBe(false);

      const fromNonSolid = [
        { col: 2, floor: 0, type: nonSolid, stairDir: 1, isExplicitStair: true, explicitStairDir: 1 },
        { col: 3, floor: 1, type: 'solid', stairDir: 0 },
      ];
      expect(isCanonicalStairStep(fromNonSolid, [], 2, 0, 1)).toBe(false);

      // Any walkable flat bridge at (3, 0) invalidates stair at (2, 0) -> (3, 1)
      const withFlatBridge = [...baseValid, { col: 3, floor: 0, type: nonSolid }];
      expect(isCanonicalStairStep(withFlatBridge, [], 2, 0, 1)).toBe(false);
    }

    // Overhead ceiling, pillar, box, laserGate, and elevator shaft obstructions must reject stairs
    expect(isCanonicalStairStep([...baseValid, { col: 2, floor: 1, type: 'solid' }], [], 2, 0, 1)).toBe(false);
    expect(isCanonicalStairStep([...baseValid, { col: 2, floor: 1, type: 'pillar', h: 2 }], [], 2, 0, 1)).toBe(false);
    expect(isCanonicalStairStep([...baseValid, { col: 3, floor: 1, type: 'box' }], [], 2, 0, 1)).toBe(false);
    expect(isCanonicalStairStep([...baseValid, { col: 3, floor: 1, type: 'laserGate', h: 2 }], [], 2, 0, 1)).toBe(
      false
    );
    expect(isCanonicalStairStep(baseValid, [{ col: 3, minFloor: 1, maxFloor: 5 }], 2, 0, 1)).toBe(false);
    expect(isCanonicalStairStep(baseValid, [{ col: 2, minFloor: 1, maxFloor: 4 }], 2, 0, 1)).toBe(false);
  });

  it('guarantees 0 unintended stairDir flags across all 100 spires (10 Campaign, 15 Sanctums, 5 Gauntlets, 30 Daily, 20 Expedition, 20 Flood Rush)', () => {
    const campaign = createCampaignTowers();
    const sanctums = createSanctumTowers(15);
    const gauntlets = createWardenGauntletTowers();

    campaign.forEach((t) => assertCanonicalStairInvariants(t, t.key));
    sanctums.forEach((t) => assertCanonicalStairInvariants(t, t.key));
    gauntlets.forEach((t) => assertCanonicalStairInvariants(t, t.key));

    // Specifically verify Campaign Spire 4's (5,2)->(6,3) jump step and Spire 1's (5,13)->(6,14) bonus perch have stairDir === 0
    const s4Step = campaign[3].ledges.find((l) => l.col === 5 && l.floor === 2);
    expect(s4Step?.stairDir).toBe(0);
    const s1PerchEdge = campaign[0].ledges.find((l) => l.col === 5 && l.floor === 13);
    expect(s1PerchEdge?.stairDir).toBe(0);

    // 30 UTC Daily Tide dates including 2026-11-19
    for (let d = 0; d < 30; d++) {
      const date = new Date(Date.UTC(2026, 10, 1 + d));
      const daily = createDailyTower(date);
      assertCanonicalStairInvariants(daily, daily.key);
    }

    // 20 Expedition & 20 Flood Rush procedural spires
    for (let i = 1; i <= 20; i++) {
      const exp = generateProceduralTower({
        seed: 202600 + i * 73,
        index: i,
        difficulty: 1 + (i % 5) * 0.35,
        modeHint: 'expedition',
      });
      assertCanonicalStairInvariants(exp, exp.key);

      const flood = generateProceduralTower({
        seed: 808800 + i * 97,
        index: i,
        difficulty: 1 + (i % 5) * 0.35,
        modeHint: 'flood_rush',
      });
      assertCanonicalStairInvariants(flood, flood.key);
    }
  });
});

describe('Round 5 Deliverable 2 & 3: Fast (< 3ms) Single-BFS Procedural Composer, Spawn Quay Safety & Flood Rush Pacing', () => {
  it('generates solvable procedural spires across all modes in < 3ms average (replacing the 80x BFS loop)', () => {
    // Warm up V8 JIT
    for (let w = 1; w <= 8; w++) {
      generateProceduralTower({ seed: w * 13, index: w, modeHint: 'sanctum_trials', casual: true });
    }

    const modes = ['daily_tide', 'expedition', 'flood_rush', 'sanctum_trials'];
    const samples = 40;
    const t0 = performance.now();
    for (let i = 0; i < samples; i++) {
      const modeHint = modes[i % modes.length];
      const tower = generateProceduralTower({
        seed: 44000 + i * 137,
        index: (i % 10) + 1,
        difficulty: 1.4 + (i % 4) * 0.3,
        modeHint,
        casual: modeHint === 'sanctum_trials',
      });
      expect(tower.ledges.length).toBeGreaterThan(25);
    }
    const avgMs = (performance.now() - t0) / samples;
    expect(avgMs).toBeLessThan(3.0);
  });

  it('builds a safe 5-col Spawn Quay [18,19,0,1,2], preserves spawnDir (±1), places safe interior switches, and climbs smoothly to Floor 2 at 120Hz across 30 Daily Tide dates', () => {
    let sawClockwise = false;
    let sawCounterClockwise = false;

    for (let d = 0; d < 30; d++) {
      const date = new Date(Date.UTC(2026, 10, 1 + d));
      const daily = createDailyTower(date);

      expect(daily.spawn).toEqual({ col: 0, floor: 0 });
      expect([1, -1]).toContain(daily.spawnDir);
      if (daily.spawnDir === 1) sawClockwise = true;
      if (daily.spawnDir === -1) sawCounterClockwise = true;

      // Verify 5-column solid Spawn Quay [18, 19, 0, 1, 2]
      for (const qc of [18, 19, 0, 1, 2]) {
        const tile = daily.ledges.find((l) => l.col === qc && l.floor === 0 && l.type === 'solid');
        expect(tile, `${daily.key}: missing Spawn Quay solid tile at col ${qc}`).toBeDefined();
      }

      // First staircase step launches cleanly at col 3 (dir = +1) or col 17 (dir = -1)
      const launchCol = daily.spawnDir > 0 ? 3 : 17;
      expect(isCanonicalStairStep(daily.ledges, daily.elevators, launchCol, 0, daily.spawnDir)).toBe(true);

      // Every toggle / conveyorFlip / pipeValve switch sits on a solid tile with solid neighbors (no cliff-lip double-toggle trap)
      for (const sw of daily.switches) {
        if (sw.mode === 'toggle' || sw.mode === 'conveyorFlip' || sw.mode === 'pipeValve') {
          const onSolid = daily.ledges.some(
            (l) => l.col === sw.col && l.floor === sw.floor && l.type === 'solid'
          );
          const adjSolidCount = [-1, 1].filter((dc) =>
            daily.ledges.some(
              (l) => l.col === wrapCol(sw.col + dc) && l.floor === sw.floor && l.type === 'solid'
            )
          ).length;
          expect(onSolid, `${daily.key}: switch ${sw.id} must sit on solid tile`).toBe(true);
          expect(adjSolidCount, `${daily.key}: switch ${sw.id} must sit on interior of solid terrace`).toBe(2);
        }
      }

      // Live 120Hz ToweringWatersGame spawn walk in daily.spawnDir reaches Floor 2 with 0 cliff drops!
      const inp = createMockInput();
      const game = new ToweringWatersGame(null, inp, {}, createSilentProgression());
      game.mode = 'tower';
      game.loadTower(daily);
      inp.state.analogX = daily.spawnDir;
      if (daily.spawnDir > 0) inp.state.right = true;
      else inp.state.left = true;

      let fellOffQuay = false;
      let maxFloorReached = 0;
      for (let step = 0; step < 264; step++) {
        game.update(FIXED_STEP);
        if (game.gateway.floor < -0.1) fellOffQuay = true;
        if (game.gateway.floor > maxFloorReached) maxFloorReached = game.gateway.floor;
      }
      expect(fellOffQuay, `${daily.key}: Gateway fell walking in spawnDir ${daily.spawnDir}`).toBe(false);
      expect(maxFloorReached, `${daily.key}: Gateway failed to climb opening flight`).toBeGreaterThanOrEqual(1.98);
    }

    expect(sawClockwise).toBe(true);
    expect(sawCounterClockwise).toBe(true);
  });

  it('calibrates Flood Rush waterRiseRate to Math.min(0.28, 0.14 + index * 0.018) with >= 2 reachable drainValve wheels per spire', () => {
    for (let idx = 1; idx <= 20; idx++) {
      const spire = generateProceduralTower({
        seed: 710000 + idx * 89,
        index: idx,
        difficulty: 1 + idx * 0.15,
        modeHint: 'flood_rush',
      });
      const expectedRate = Number(Math.min(0.28, 0.14 + idx * 0.018).toFixed(3));
      expect(spire.mechanics.waterRiseRate).toBe(expectedRate);
      expect(spire.mechanics.waterRiseRate).toBeLessThanOrEqual(0.28);

      const drains = spire.switches.filter((sw) => sw.mode === 'drainValve');
      expect(drains.length, `${spire.key}: must provide >= 2 drainValves`).toBeGreaterThanOrEqual(2);
      for (const dv of drains) {
        const probe = {
          ...spire,
          doors: [
            ...spire.doors.map((d) => ({ ...d, isExit: false })),
            { id: '__dv__', col: dv.col, floor: dv.floor, isExit: true },
          ],
        };
        expect(verifyTowerSolvable(probe).solvable, `${spire.key}: drainValve ${dv.id} reachable`).toBe(true);
      }
    }
  });
});

describe('Round 5 Deliverable 4: Sanctum 6/9/12 Fixes & 100% Solvability Across All 8 Game Modes', () => {
  it('fixes Sanctum 6 & 9 Vault mission flags (requiresVault: true, requiresRune: false) and Sanctum 12 Tide-Locks subtitle', () => {
    const sanctums = createSanctumTowers(15);
    const s6 = sanctums.find((t) => t.id === 6);
    const s9 = sanctums.find((t) => t.id === 9);
    const s12 = sanctums.find((t) => t.id === 12);

    expect(s6.vaultDoor).not.toBeNull();
    expect(s6.runeDoors).toHaveLength(0);
    expect(s6.casualMission.requiresVault).toBe(true);
    expect(s6.casualMission.requiresRune).toBe(false);

    expect(s9.vaultDoor).not.toBeNull();
    expect(s9.runeDoors).toHaveLength(0);
    expect(s9.casualMission.requiresVault).toBe(true);
    expect(s9.casualMission.requiresRune).toBe(false);

    expect(s12.runeDoors[0]?.puzzleType).toBe('tide_locks');
    expect(s12.casualMission.subtitle).toContain('Harmonize Coral Tide-Locks Sanctum');
  });

  it('verifies 100% solvability across Campaign (1-10), Purist, Master Watershed, Sanctum Trials (1-15 + proc), Warden Gauntlet (1-5 + 120Hz stairs), Daily Tide (30d), Expedition (20), and Flood Rush (20)', () => {
    // 1-3. Campaign / Purist / Master Watershed share the 10 Varied Anti-Repetition Watershed Spires
    const expectedSealsBySpire = [1, 2, 2, 3, 2, 2, 2, 3, 3, 3];
    for (const mode of ['campaign', 'purist', 'master_watershed']) {
      const towers = createTowers(mode);
      expect(towers).toHaveLength(10);
      towers.forEach((spire, idx) => {
        expect(spire.spawnDir).toBe(1);
        const solved = verifyTowerSolvable(spire, { enforceSeals: true, allowSanctumSolve: true });
        expect(solved.solvable, `${mode} ${spire.key} solvable`).toBe(true);
        expect(solved.crownSealsTotal, `${mode} ${spire.key} seal count`).toBe(expectedSealsBySpire[idx]);

        const hasMandatorySanctum = spire.crownSeals.some((s) => s.kind === 'sanctum');
        if (hasMandatorySanctum) {
          const bypass = verifyTowerSolvable(spire, { enforceSeals: true, allowSanctumSolve: false });
          expect(bypass.solvable, `${mode} ${spire.key} zero Sanctum bypass`).toBe(false);
        }
      });
    }

    // 4. Sanctum Trials (15 handcrafted + 10 procedural)
    const sanctums = createTowers('sanctum_trials');
    expect(sanctums).toHaveLength(15);
    for (const st of sanctums) {
      expect(verifyTowerSolvable(st).solvable, `${st.key} solvable`).toBe(true);
      if (st.casualMission?.requiresVault) {
        expect(st.vaultDoor, `${st.key} must have a vaultDoor`).not.toBeNull();
      }
      if (st.casualMission?.requiresRune) {
        expect(st.runeDoors.length, `${st.key} must have >= 1 runeDoor`).toBeGreaterThan(0);
      }
    }
    for (let p = 1; p <= 10; p++) {
      const procSt = generateProceduralTower({
        seed: 330000 + p * 61,
        index: 15 + p,
        difficulty: 1.5,
        modeHint: 'sanctum_trials',
        casual: true,
      });
      expect(verifyTowerSolvable(procSt).solvable, `${procSt.key} solvable`).toBe(true);
      expect(procSt.casual).toBe(true);
      expect(procSt.casualMission).not.toBeNull();
    }

    // 5. Warden Gauntlet (5 Boss Rush arenas + live 120Hz uninterrupted stairway ascent f=1 -> f=4)
    const gauntlets = createTowers('warden_gauntlet');
    expect(gauntlets).toHaveLength(5);
    for (const wg of gauntlets) {
      expect(verifyTowerSolvable(wg).solvable, `${wg.key} solvable`).toBe(true);
      const inp = createMockInput();
      const game = new ToweringWatersGame(null, inp, {}, createSilentProgression());
      game.mode = 'tower';
      game.loadTower(wg);
      game.enemies = [];
      inp.state.analogX = 1;
      inp.state.right = true;
      for (let i = 0; i < 240; i++) game.update(FIXED_STEP);
      expect(game.gateway.floor, `${wg.key}: 120Hz twin stairway climb reaches f=4`).toBeCloseTo(4.0, 2);
    }

    // 6. Daily Tide (30 UTC dates including 2026-11-19)
    for (let d = 0; d < 30; d++) {
      const daily = createDailyTower(new Date(Date.UTC(2026, 10, 1 + d)));
      expect(verifyTowerSolvable(daily).solvable, `${daily.key} solvable`).toBe(true);
    }

    // 7 & 8. Expedition (20 seeds incl. every-3rd-spire boss) & Flood Rush (20 seeds)
    for (let s = 1; s <= 20; s++) {
      const exp = generateProceduralTower({
        seed: 550000 + s * 43,
        index: s,
        difficulty: 1 + s * 0.15,
        modeHint: 'expedition',
      });
      expect(verifyTowerSolvable(exp).solvable, `${exp.key} solvable`).toBe(true);
      if (s % 3 === 0) {
        expect(exp.enemies.some((e) => e.type === 'siphon_warden')).toBe(true);
      }

      const flood = generateProceduralTower({
        seed: 660000 + s * 59,
        index: s,
        difficulty: 1 + s * 0.15,
        modeHint: 'flood_rush',
      });
      expect(verifyTowerSolvable(flood).solvable, `${flood.key} solvable`).toBe(true);
    }
  });

  it('passes exhaustive #573 scenario audit: 0 trapped crates/switches, >=2 open loft cols directly above Campaign snap_crabs, 0 enemies inside barriers/shafts, and 100% single-polarity procedural sluices across 180 spires', () => {
    const campaign = createCampaignTowers();
    const sanctums = createSanctumTowers(15);
    const gauntlets = createWardenGauntletTowers();
    const procedurals = [
      ...Array.from({ length: 50 }, (_, i) => createDailyTower(new Date(Date.UTC(2026, 9, 1 + i)))),
      ...Array.from({ length: 50 }, (_, i) =>
        generateProceduralTower({ seed: 30000 + i * 79, index: (i % 10) + 1, difficulty: 1.5, modeHint: 'expedition' })
      ),
      ...Array.from({ length: 50 }, (_, i) =>
        generateProceduralTower({ seed: 70000 + i * 113, index: (i % 10) + 1, difficulty: 1.5, modeHint: 'flood_rush' })
      ),
    ];

    // Check Campaign Crab-Springboard High Valve Lofts (Spires 1, 2, 4, 6, 10) have >= 2 unobstructed open solid cols directly overhead
    for (const spireId of [1, 2, 4, 6, 10]) {
      const spire = campaign.find((t) => t.id === spireId);
      const crab = spire.enemies.find((e) => e.type === 'snap_crab');
      const crabCol = Math.floor(crab.col);
      const loftFloor = Math.round(crab.floor) + 3;
      const boxColsOnLoft = new Set(
        spire.ledges.filter((l) => l.type === 'box' && l.floor === loftFloor).map((l) => l.col)
      );
      expect(
        boxColsOnLoft.has(crabCol),
        `${spire.key}: crate at (${crabCol},${loftFloor}) would block vertical carapace bounce from col ${crab.col}`
      ).toBe(false);
      const openLoftTiles = spire.ledges.filter(
        (l) => l.type === 'solid' && l.floor === loftFloor && !boxColsOnLoft.has(l.col)
      );
      expect(openLoftTiles.length, `${spire.key}: High Valve Loft needs >= 3 open solid tiles`).toBeGreaterThanOrEqual(
        3
      );
    }

    // Procedural phaseBlocks & laserGates are 100% single-polarity (inverted === false)
    for (const pt of procedurals) {
      for (const l of pt.ledges) {
        if (l.type === 'phaseBlock' || l.type === 'laserGate') {
          expect(l.inverted, `${pt.key}: procedural ${l.type} must be single-polarity`).toBe(false);
        }
      }
    }

    const allSpires = [...campaign, ...sanctums, ...gauntlets, ...procedurals];
    for (const t of allSpires) {
      const barriers = t.ledges.filter((l) => l.type === 'box' || l.type === 'pillar' || l.type === 'laserGate');
      const walkMap = new Map(
        t.ledges
          .filter((l) => l.type !== 'box' && l.type !== 'pillar' && l.type !== 'laserGate')
          .map((l) => [`${l.col}:${l.floor}`, l])
      );

      for (const bx of barriers.filter((b) => b.type === 'box')) {
        expect(t.switches.some((sw) => sw.col === bx.col && sw.floor === bx.floor), `${t.key} box on switch`).toBe(
          false
        );
        expect(t.doors.some((d) => d.col === bx.col && d.floor === bx.floor), `${t.key} box on door`).toBe(false);
        const openNeighbor = [-1, 1].some((dc) => {
          const nc = wrapCol(bx.col + dc);
          return (
            walkMap.has(`${nc}:${bx.floor}`) &&
            !barriers.some((b) => b.col === nc && Math.abs(b.floor - bx.floor) < 0.8)
          );
        });
        expect(openNeighbor, `${t.key} box (${bx.col},${bx.floor}) has whip/pulse room`).toBe(true);
      }

      for (const en of t.enemies) {
        for (const b of barriers) {
          const bh = Math.max(1, Number(b.h || 1));
          const vHit = en.floor + 0.5 > b.floor && en.floor - 0.3 < b.floor + bh;
          const dist = Math.abs((((en.col - (b.col + 0.5)) % COLS) + COLS + COLS / 2) % COLS - COLS / 2);
          expect(vHit && dist < 0.72, `${t.key} enemy ${en.type} overlaps ${b.type} at (${b.col},${b.floor})`).toBe(
            false
          );
        }
      }
    }
  });
});

describe('Round 5 Deliverable 5 (#575/#576): sparkArch VFX Zero-Crash & Tilt Mode Puzzle/Mini-Game Controls', () => {
  it('rebuilds and steps TowerFluidAndSparkVFX cleanly on sparkArch spires (daily_20261119 & sanctum_11) with sparkLights=[] and 0 errors', async () => {
    const gradStub = { addColorStop: () => {} };
    const ctxProxy = new Proxy(
      {
        createImageData: (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }),
        getImageData: (x, y, w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }),
        createRadialGradient: () => gradStub,
        createLinearGradient: () => gradStub,
      },
      { get: (target, prop) => (prop in target ? target[prop] : () => {}) }
    );
    globalThis.document = {
      createElement: () => ({
        width: 128,
        height: 128,
        getContext: () => ctxProxy,
      }),
    };
    const { TowerFluidAndSparkVFX } = await import('../src/oceanVfx.js');
    const scene = new THREE.Scene();
    const vfx = new TowerFluidAndSparkVFX(scene, { cols: COLS });
    expect(vfx.sparkLights).toHaveLength(0);

    const sanctum11 = createSanctumTowers(15).find((t) => t.id === 11);
    const daily = createDailyTower('2026-11-19T00:00:00Z');
    // Ensure at least one tested tower explicitly contains sparkArch doors
    expect(sanctum11.doors.some((d) => d.tunnelStyle === 'sparkArch')).toBe(true);

    for (const tower of [sanctum11, daily]) {
      expect(() => vfx.rebuildForTower(tower, 1.5, 3.75)).not.toThrow();
      for (let frame = 0; frame < 10; frame++) {
        expect(() =>
          vfx.update({ waterFloor: -0.55, waterPurified: false }, 0.5 + frame * 0.4, frame * 0.016, 0.016)
        ).not.toThrow();
      }
    }
    vfx.dispose();
  });

  it('routes Tilt mode stage touches through crisp cardinal/steering gestures inside Sanctum Puzzles and Mini-Games (0 misfired tilt_slash whips or jump flicks)', () => {
    const listeners = new Map();
    const makeEl = (id, tag = 'div') => {
      const classes = new Set();
      const el = {
        id,
        tagName: tag.toUpperCase(),
        dataset: {},
        style: {},
        parentElement: null,
        classList: {
          add: (...n) => n.forEach((x) => classes.add(x)),
          remove: (...n) => n.forEach((x) => classes.delete(x)),
          toggle: (n, f) => (f === undefined ? (classes.has(n) ? classes.delete(n) : classes.add(n)) : f ? classes.add(n) : classes.delete(n)),
          contains: (n) => classes.has(n),
        },
        setAttribute: () => {},
        getAttribute: () => null,
        getBoundingClientRect: () => ({ left: 0, top: 0, width: 412, height: 915, right: 412, bottom: 915 }),
        matches: (sel) =>
          sel
            .split(',')
            .map((s) => s.trim())
            .some((s) => (s.startsWith('#') ? el.id === s.slice(1) : s.startsWith('.') ? classes.has(s.slice(1)) : false)),
        closest(sel) {
          let c = el;
          while (c) {
            if (c.matches(sel)) return c;
            c = c.parentElement;
          }
          return null;
        },
        querySelector: () => null,
        querySelectorAll: () => [],
        setPointerCapture: () => {},
        getContext: () => null,
      };
      return el;
    };

    const body = makeEl('body', 'body');
    const app = makeEl('app', 'div');
    const stageWrap = makeEl('stage-wrap', 'main');
    const canvas = makeEl('game-canvas', 'canvas');
    app.parentElement = body;
    stageWrap.parentElement = app;
    canvas.parentElement = stageWrap;
    const byId = new Map([
      ['app', app],
      ['stage-wrap', stageWrap],
      ['game-canvas', canvas],
    ]);

    globalThis.Element = Object;
    globalThis.window = {
      innerWidth: 412,
      innerHeight: 915,
      devicePixelRatio: 1,
      DeviceOrientationEvent: function () {},
      DeviceMotionEvent: function () {},
      addEventListener: (t, fn) => {
        if (!listeners.has(t)) listeners.set(t, []);
        listeners.get(t).push(fn);
      },
      removeEventListener: () => {},
      dispatchEvent: (t, evt) => (listeners.get(t) || []).forEach((fn) => fn(evt)),
      getComputedStyle: () => ({ display: 'flex', visibility: 'visible', pointerEvents: 'auto', opacity: '1' }),
    };
    globalThis.document = {
      body,
      hidden: false,
      getElementById: (id) => byId.get(id) || null,
      querySelector: () => null,
      querySelectorAll: () => [],
      addEventListener: () => {},
    };
    Object.defineProperty(globalThis, 'navigator', {
      value: { vibrate: () => true, userActivation: { hasBeenActive: true } },
      configurable: true,
      writable: true,
    });

    const firePtr = (type, { pointerId = 1, clientX = 200, clientY = 500, timeStamp = 100 } = {}) => {
      globalThis.window.dispatchEvent(type, {
        pointerId,
        pointerType: 'touch',
        button: 0,
        clientX,
        clientY,
        timeStamp,
        target: canvas,
        cancelable: true,
        preventDefault: () => {},
      });
    };

    const ctrl = new InputController({ mode: 'tilt', hapticsEnabled: false });
    ctrl.setControlMode('tilt');

    // 1. Inside Aqueduct Sanctum ('puzzle'): horizontal swipe steps RIGHT without misfiring whip!
    ctrl.setGameMode('puzzle');
    firePtr('pointerdown', { pointerId: 1, clientX: 180, clientY: 500, timeStamp: 100 });
    firePtr('pointermove', { pointerId: 1, clientX: 228, clientY: 502, timeStamp: 145 });
    expect(ctrl.state.right).toBe(true);
    expect(ctrl.state.whip).toBe(false);
    firePtr('pointerup', { pointerId: 1, clientX: 228, clientY: 502, timeStamp: 165 });
    expect(ctrl.state.whip).toBe(false);

    // Fast upward swipe in 'puzzle' steps UP without misfiring jump!
    ctrl.clearFrame();
    firePtr('pointerdown', { pointerId: 2, clientX: 200, clientY: 520, timeStamp: 300 });
    firePtr('pointermove', { pointerId: 2, clientX: 200, clientY: 468, timeStamp: 345 });
    expect(ctrl.state.up).toBe(true);
    expect(ctrl.state.jump).toBe(false);
    firePtr('pointerup', { pointerId: 2, clientX: 200, clientY: 468, timeStamp: 365 });
    expect(ctrl.state.jump).toBe(false);

    // 2. Inside vehicle mini-games ('core_descent', 'reef_swim', 'frill_glide', 'rapids_surf'): touch drag steers analogX with 0 whip misfires!
    for (const mg of ['core_descent', 'reef_swim', 'frill_glide', 'rapids_surf']) {
      ctrl.resetState();
      ctrl.setGameMode(mg);
      firePtr('pointerdown', { pointerId: 3, clientX: 180, clientY: 500, timeStamp: 500 });
      firePtr('pointermove', { pointerId: 3, clientX: 245, clientY: 500, timeStamp: 540 });
      expect(ctrl.state.whip, `${mg}: horizontal touch drag must steer, not whip`).toBe(false);
      expect(ctrl.state.analogX, `${mg}: horizontal touch drag must steer positive analogX`).toBeGreaterThan(0.2);
      firePtr('pointerup', { pointerId: 3, clientX: 245, clientY: 500, timeStamp: 580 });
    }

    ctrl.resetState();
  });
});

describe('Wave 2 World Variety, Hydro-Rings, Siphon Supply Crates, 18+ Procedural Chunks & Widened 3D Spire Architecture', () => {
  it('abolishes the uniform 3-seal mold: 10 Campaign Spires span 15F-27F with distinct seals (1-3), varied boss cadence, Hydro-Ring speed lines, glowing Supply Crates & 100% reachable items', () => {
    const campaign = createCampaignTowers();
    expect(campaign).toHaveLength(10);

    // Distinct heights spanning 14..28F (no cookie-cutter 20-24F copy-paste!)
    const heights = campaign.map((t) => t.floors);
    expect(Math.min(...heights)).toBeGreaterThanOrEqual(14);
    expect(Math.min(...heights)).toBeLessThanOrEqual(16);
    expect(Math.max(...heights)).toBeGreaterThanOrEqual(26);
    expect(Math.max(...heights)).toBeLessThanOrEqual(28);
    expect(new Set(heights).size).toBeGreaterThanOrEqual(6);

    // Distinct seal counts (1, 2, and 3 seals across the 10 spires)
    const sealCounts = campaign.map((t) => t.crownSealsTotal);
    expect(sealCounts[0]).toBe(1); // Spire 1 breezy 1-seal onboarding!
    expect(new Set(sealCounts)).toEqual(new Set([1, 2, 3]));

    // Boss cadence: Act Bosses on Spires 2, 4, 6, 8, Polar Lock-Keeper on 9, Grand Finale on 10; NO boss on Spires 1, 3, 5, 7!
    const hasBoss = campaign.map((t) => t.enemies.some((e) => e.type === 'siphon_warden'));
    expect(hasBoss).toEqual([false, true, false, true, false, true, false, true, true, true]);
    expect(campaign[9].enemies.find((e) => e.type === 'siphon_warden')?.hp).toBe(4);

    // Every Campaign Spire has >= 6 Hydro-Rings & >= 2 Supply Crates covering all 3 power-up types across the campaign
    const seenPowerUps = new Set();
    for (const t of campaign) {
      expect(Array.isArray(t.hydroRings)).toBe(true);
      expect(t.hydroRings.length, `${t.key} hydroRings`).toBeGreaterThanOrEqual(6);
      const supplyCrates = t.ledges.filter((l) => l.type === 'box' && l.powerUp);
      expect(supplyCrates.length, `${t.key} Supply Crates`).toBeGreaterThanOrEqual(2);
      for (const sc of supplyCrates) {
        expect(['turbo_current', 'bubble_shield', 'hydro_magnet']).toContain(sc.powerUp);
        seenPowerUps.add(sc.powerUp);
      }

      // Every door, switch, and collectible on every Campaign Spire is 100% reachable
      const targets = [
        ...t.doors.map((d) => ({ col: d.col, floor: d.floor, id: d.id })),
        ...t.switches.map((s) => ({ col: s.col, floor: s.floor, id: s.id })),
        ...t.collectibles.map((c) => ({ col: c.col, floor: Math.round(c.floor), id: c.id })),
      ];
      for (const tgt of targets) {
        const probe = {
          ...t,
          crownSeals: [],
          doors: [
            ...t.doors.map((d) => ({ ...d, isExit: false })),
            { id: '__reach__', col: tgt.col, floor: tgt.floor, isExit: true },
          ],
        };
        expect(
          verifyTowerSolvable(probe, { enforceSeals: false, allowSanctumSolve: true }).solvable,
          `${t.key} item ${tgt.id} at (${tgt.col},${tgt.floor}) reachable`
        ).toBe(true);
      }
    }
    expect(seenPowerUps).toEqual(new Set(['turbo_current', 'bubble_shield', 'hydro_magnet']));
  });

  it('expands procedural composer to >= 18 distinct architectural set-piece chunks with Hydro-Rings, Supply Crates, 100% solvability & 0 stair mismatches across 90 spires', () => {
    expect(PROCEDURAL_SET_PIECE_CHUNKS.length).toBeGreaterThanOrEqual(18);

    const seenChunks = new Set();
    const seenPowerUps = new Set();
    for (let i = 0; i < 30; i++) {
      const towers = [
        createDailyTower(new Date(Date.UTC(2026, 8, 1 + i))),
        generateProceduralTower({ seed: 120000 + i * 137, index: (i % 10) + 1, difficulty: 1.5, modeHint: 'expedition' }),
        generateProceduralTower({ seed: 240000 + i * 149, index: (i % 10) + 1, difficulty: 1.5, modeHint: 'flood_rush' }),
      ];
      for (const t of towers) {
        expect(verifyTowerSolvable(t).solvable, `${t.key} solvable`).toBe(true);
        assertCanonicalStairInvariants(t, t.key);
        expect(t.hydroRings.length, `${t.key} hydroRings`).toBeGreaterThanOrEqual(4);
        const crates = t.ledges.filter((l) => l.type === 'box' && l.powerUp);
        expect(crates.length, `${t.key} Supply Crates`).toBeGreaterThanOrEqual(1);
        crates.forEach((c) => seenPowerUps.add(c.powerUp));
        (t.proceduralChunks || []).forEach((ch) => seenChunks.add(ch));
      }
    }
    expect(seenChunks.size).toBeGreaterThanOrEqual(18);
    expect(seenPowerUps).toEqual(new Set(['turbo_current', 'bubble_shield', 'hydro_magnet']));
  });

  it('widens VIS_ALT_WINDOW >= 7.0, builds 1:1 visual stairs, 3D Hydro-Rings, glowing Supply Crates & Floodgate Water-Surge Cascade in < 35ms', async () => {
    const {
      VIS_ALT_WINDOW,
      buildDetailedTowerGroup,
      prewarmArchSurfaces,
      updateTowerArchitecture,
      disposeTowerArchitecture,
      buildArchShaderWarmupGroup,
    } = await import('../src/towerArchitecture.js');

    expect(VIS_ALT_WINDOW).toBeGreaterThanOrEqual(7.0);
    expect(VIS_ALT_WINDOW).toBeCloseTo(7.2, 2);

    const gradStub = { addColorStop: () => {} };
    const ctxProxy = new Proxy(
      {
        createImageData: (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }),
        getImageData: (x, y, w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }),
        createRadialGradient: () => gradStub,
        createLinearGradient: () => gradStub,
      },
      { get: (target, prop) => (prop in target ? target[prop] : () => {}) }
    );
    globalThis.document = {
      createElement: () => ({
        width: 128,
        height: 128,
        getContext: () => ctxProxy,
      }),
    };

    prewarmArchSurfaces();
    const warmGrp = buildArchShaderWarmupGroup();
    expect(warmGrp.children.length).toBeGreaterThan(10);

    const campaign = createCampaignTowers();
    // Warm up shared geometry & V8 JIT once (matches startup prewarm)
    const warmSpire = buildDetailedTowerGroup(campaign[0]);
    disposeTowerArchitecture(warmSpire);

    let totalBuildMs = 0;
    for (const spire of campaign) {
      const t0 = performance.now();
      const cached = buildDetailedTowerGroup(spire);
      totalBuildMs += performance.now() - t0;

      // 1:1:1 Canonical Visual Stair Parity against isCanonicalStairStep
      const canonicalStairs = spire.ledges.filter(
        (l) =>
          isCanonicalStairStep(spire.ledges, spire.elevators, l.col, l.floor, 1) ||
          isCanonicalStairStep(spire.ledges, spire.elevators, l.col, l.floor, -1)
      );
      expect(cached.visualStairCount, `${spire.key} 1:1 visual stair parity`).toBe(canonicalStairs.length);

      // 3D Hydro-Rings built 1:1
      expect(cached.hasEmbeddedHydroRings).toBe(true);
      expect(cached.hydroRingNodes).toHaveLength(spire.hydroRings.length);

      // Glowing Siphon Supply Crates built for every `l.powerUp` box
      const expectedCrates = spire.ledges.filter((l) => l.type === 'box' && l.powerUp).length;
      const builtCrates = cached.ledgeMeshes.filter((m) => m?.userData?.isSupplyCrate).length;
      expect(builtCrates, `${spire.key} 3D Supply Crates`).toBe(expectedCrates);

      // Exterior Spire Floodgate Water-Surge Cascade hook responds to `state.floodgateSurgeTimer`
      expect(cached.hasFloodgateSurgeMesh).toBe(true);
      expect(cached.floodgateSurgeFx.group.visible).toBe(false);

      const liveRings = spire.hydroRings.map((r) => ({ ...r, collected: false }));
      const liveLedges = spire.ledges.map((l) => ({ ...l, gone: false, visualSlideCol: 0 }));

      // Idle frame: surge hidden, rings visible in front frustum
      updateTowerArchitecture(
        cached,
        {
          tower: spire,
          camFloor: 2,
          camCol: 2.5,
          ledges: liveLedges,
          hydroRings: liveRings,
          floodgateSurgeTimer: 0,
        },
        1.0,
        0.016
      );
      expect(cached.floodgateSurgeFx.group.visible).toBe(false);

      // Active Exterior Floodgate Water-Surge frame (`floodgateSurgeTimer > 0`) + collected ring + smashed crate
      liveRings[0].collected = true;
      const firstCrateIdx = liveLedges.findIndex((l) => l.type === 'box' && l.powerUp);
      if (firstCrateIdx >= 0) liveLedges[firstCrateIdx].gone = true;
      updateTowerArchitecture(
        cached,
        {
          tower: spire,
          camFloor: 4,
          camCol: 2.5,
          ledges: liveLedges,
          hydroRings: liveRings,
          floodgateSurgeTimer: 1.25,
        },
        1.5,
        0.016
      );
      expect(cached.floodgateSurgeFx.group.visible).toBe(true);
      expect(cached.floodgateSurgeFx.cascadeMat.uniforms.uIntensity.value).toBeGreaterThan(0.2);
      expect(cached.floodgateSurgeFx.collarMat.opacity).toBeGreaterThan(0.15);
      expect(cached.hydroRingNodes[0].group.visible).toBe(false);
      if (firstCrateIdx >= 0) {
        expect(cached.ledgeMeshes[firstCrateIdx].visible).toBe(false);
      }

      disposeTowerArchitecture(cached);
    }

    const avgBuildMs = totalBuildMs / campaign.length;
    expect(avgBuildMs).toBeLessThan(35.0);
  });
});
