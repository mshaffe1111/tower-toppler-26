// Campaign sequences.
// ORIGINAL: the 1987 game, the 8 real towers, one climb each (realTowers.js).
// REBOOT: 10 worlds x 5 towers (worlds.js), every tower from the grid generator with a fixed seed.
import { WORLDS, TOWERS_PER_WORLD, CAMPAIGN_TOWERS, worldTowerPlan, worldOfIndex, placeRuneDoor } from './worlds.js';
export const LEVELS = TOWERS_PER_WORLD; // Reboot: towers per world (the old 8 x 3 layout is gone)
export const levelsFor = (variant) => (variant === 'original' ? 1 : TOWERS_PER_WORLD);
export const campaignLength = (variant) => (variant === 'original' ? 8 : CAMPAIGN_TOWERS);
export { WORLDS, TOWERS_PER_WORLD, CAMPAIGN_TOWERS, worldTowerPlan, worldOfIndex };
// Tower heights in steps, from the design spec (docs/SPEC.md): T1 24 ... T8 46
export const SPEC_FLOORS = [24, 28, 26, 32, 36, 34, 40, 46];

// Reboot twists the generator knows (vault and the guardian are hand-built only)
const GEN_MECH = { none: 'none', pistons: 'pistons', vault: 'none', blizzard: 'blizzard', collapse: 'collapse', flood: 'flood', dark: 'dark', storm: 'wind', wind: 'wind' };

import { buildRealTower, hasRealTower } from './realTowers.js';
import { makeGeneratedTower } from './towergen.js';

export function towerOfIndex(i, variant) {
  const n = levelsFor(variant);
  return { tower: Math.floor(i / n), level: (i % n) + 1 };
}

// procgen may be null (still loading): then the campaign is the classic towers only
export function makeCampaignProvider({ towers, procgen, runSeed, variant }) {
  const cache = new Map();
  return (i) => {
    if (variant === 'original') {
      const base = towers[i];
      if (!base || !hasRealTower(base.id)) return null;
      if (!cache.has(i)) {
        const t = buildRealTower(base.id, base);
        t.level = 1;
        t.levels = 1;
        t.canonical = true;
        cache.set(i, t);
      }
      return cache.get(i);
    }
    // REBOOT: the worlds campaign
    if (!cache.has(i)) {
      const plan = worldTowerPlan(i);
      if (!plan) return null;
      const base = towers[plan.palette % towers.length];
      const mech = GEN_MECH[plan.twist] || 'none';
      const t =
        makeGeneratedTower({
          seed: plan.seed,
          height: plan.height,
          difficulty: plan.difficulty,
          id: plan.id,
          name: plan.name,
          look: plan.look,
          palette: base.palette,
          mechanic: mech,
        }) ||
        (procgen &&
          procgen.generateTower({ seed: plan.seed, difficulty: plan.difficulty, id: plan.id, name: plan.name, mechanic: mech, floors: Math.round(plan.height / 2), style: 'modern' }));
      if (!t) return null;
      t.palette = base.palette;
      t.material = plan.material;
      t.scenery = plan.scenery;
      t.label = plan.label;
      t.world = plan.world;
      t.worldName = WORLDS[plan.world].name.toUpperCase();
      t.level = plan.tower + 1;
      t.levels = TOWERS_PER_WORLD;
      t.canonical = true;
      t.summit = plan.summit;
      t.difficulty = plan.difficulty;
      // the very last tower keeps the storm and its guardian
      if (plan.final) t.mechanic = 'storm';
      // a hidden puzzle room behind a rune door (towers II and IV of each world)
      if (plan.puzzle && t.grid) {
        const at = placeRuneDoor(t.grid, plan.seed);
        if (at) {
          t.puzzle = { type: plan.puzzle, seed: plan.seed ^ 0x9e37, difficulty: plan.difficulty };
          t.doors.push({ id: `${plan.label}-rune`, col: at.col, floor: at.floor, rune: true, targetId: null });
        }
      }
      cache.set(i, t);
    }
    return cache.get(i);
  };
}
