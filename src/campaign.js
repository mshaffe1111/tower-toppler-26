// Campaign sequence: 8 towers x LEVELS levels, all generated and verified completable.
// Level 1 of each tower is its own FIXED tall layout (same every time, so medals and ghost races
// mean something); levels 2-3 are fresh every campaign. Every level keeps the tower's identity
// (id -> brick colour and, in the Original, its enemy cast; in the Reboot, its twist). The run seed
// is saved with the run so CONTINUE rebuilds the same levels. Only level 3 topples the tower.
export const LEVELS = 3;
// Tower heights in steps, from the design spec (docs/SPEC.md): T1 24 ... T8 46
export const SPEC_FLOORS = [24, 28, 26, 32, 36, 34, 40, 46];

// Reboot twists the generator knows (vault and the guardian are hand-built only)
const GEN_MECH = { none: 'none', pistons: 'pistons', vault: 'none', blizzard: 'blizzard', collapse: 'collapse', flood: 'flood', dark: 'dark', storm: 'wind' };

const mix = (a, b) => (Math.imul(a ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(b + 0x632be5ab, 0xc2b2ae35)) >>> 0;

export function towerOfIndex(i) {
  return { tower: Math.floor(i / LEVELS), level: (i % LEVELS) + 1 };
}

// procgen may be null (still loading): then the campaign is the classic towers only
export function makeCampaignProvider({ towers, procgen, runSeed, variant }) {
  const cache = new Map();
  return (i) => {
    if (!procgen) {
      const t = towers[i];
      return t ? { ...t, level: 1, levels: 1 } : null;
    }
    const { tower, level } = towerOfIndex(i);
    const base = towers[tower];
    if (!base) return null;
    if (!cache.has(i)) {
      // Level 1: the tower's own fixed layout (same every time: medals & ghost races). Levels 2-3:
      // fresh each campaign. Tall, staircase-led towers at the spec heights.
      const canonical = level === 1;
      const difficulty = Math.min(0.95, 0.12 + tower * 0.09 + (level - 1) * 0.08);
      const t = procgen.generateTower({
        seed: canonical ? mix(0x7800 + (variant === 'original' ? 0 : 0x101), tower) : mix(runSeed >>> 0, tower * 16 + level),
        difficulty,
        id: base.id,
        name: base.name,
        mechanic: variant === 'original' ? 'none' : GEN_MECH[base.mechanic] || 'none',
        floors: SPEC_FLOORS[tower] + (level === 3 ? 4 : 0),
        style: variant === 'original' ? 'classic' : 'modern',
      });
      t.palette = base.palette;
      t.level = level;
      t.levels = LEVELS;
      t.canonical = canonical;
      // the Reboot's final tower keeps its storm and guardian
      if (variant !== 'original' && base.mechanic === 'storm' && canonical) t.mechanic = 'storm';
      cache.set(i, t);
    }
    return cache.get(i);
  };
}
