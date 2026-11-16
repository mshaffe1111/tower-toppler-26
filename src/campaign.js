// Campaign sequence: 8 towers x LEVELS levels. Level 1 of each tower is its classic hand-built
// layout; levels 2 and 3 are freshly generated layouts in that tower's own style (same id, so the
// same brick colour, enemy theme and, in the Reboot, the same kind of twist), getting harder.
// A new run seed gives new levels 2-3 every campaign; the seed is saved with the run so CONTINUE
// rebuilds exactly the same levels. Only clearing level 3 topples the tower.
export const LEVELS = 3;

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
    if (level === 1) return { ...base, level: 1, levels: LEVELS };
    if (!cache.has(i)) {
      const difficulty = Math.min(0.95, 0.14 + tower * 0.09 + (level - 2) * 0.12);
      const t = procgen.generateTower({
        seed: mix(runSeed >>> 0, tower * 16 + level),
        difficulty,
        id: base.id,
        name: base.name,
        mechanic: variant === 'original' ? 'none' : GEN_MECH[base.mechanic] || 'none',
      });
      t.palette = base.palette;
      t.level = level;
      t.levels = LEVELS;
      cache.set(i, t);
    }
    return cache.get(i);
  };
}
