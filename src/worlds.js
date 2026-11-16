// REBOOT campaign: 10 worlds x 5 towers. Each world brings in one twist (towers 1-3), remixes an
// earlier one (tower 4), and ends on a taller summit tower (5). The last world mixes everything
// and ends at the Edge of Doom with its guardian. Towers come from the grid generator (towergen.js:
// built from the real towers' pieces and proven climbable); every seed is fixed, so a tower is the
// same every time you play it (medals and ghost races mean something).
//
// Pacing: heights grow from 40 to ~100 rows and difficulty from 0.12 to 0.95. At roughly two to
// four minutes a tower plus the rides between, the whole campaign is several hours.

export const TOWERS_PER_WORLD = 5;

export const WORLDS = [
  {
    name: 'Sunrise Shoals',
    blurb: 'Learn the climb: stairs, lifts and doors.',
    twist: 'none',
    materials: ['rock', 'timber', 'shingle', 'rock', 'marble'],
    scenery: 'islands',
    look: 'eye',
    palette: 0,
  },
  {
    name: 'Clockwork Keep',
    blurb: 'Ledges that slide into the wall. Watch for the red blink.',
    twist: 'pistons',
    materials: ['brass', 'metal', 'copper', 'brass', 'metal'],
    scenery: 'city',
    look: 'robot',
    palette: 1,
  },
  {
    name: 'Frostbite Spire',
    blurb: 'Blizzard gusts shove you along the ledges.',
    twist: 'blizzard',
    materials: ['ice', 'crystal', 'ice', 'siding', 'crystal'],
    scenery: 'icebergs',
    look: 'spiker',
    palette: 3,
  },
  {
    name: 'Crumbling Mesa',
    blurb: 'The tower falls apart from the bottom up. Keep moving.',
    twist: 'collapse',
    materials: ['sandstone', 'straw', 'sandstone', 'rock', 'sandstone'],
    scenery: 'mesas',
    look: 'eye',
    palette: 4,
  },
  {
    name: 'Lantern Night',
    blurb: 'A night storm. Your lantern lights the way; lightning shows the rest.',
    twist: 'dark',
    materials: ['obsidian', 'metal', 'crystal', 'obsidian', 'metal'],
    scenery: 'volcano',
    look: 'robot',
    palette: 6,
  },
  {
    name: 'Rising Tide',
    blurb: 'The sea is climbing too. The water is the clock.',
    twist: 'flood',
    materials: ['shingle', 'siding', 'copper', 'timber', 'shingle'],
    scenery: 'islands',
    look: 'spiker',
    palette: 5,
  },
  {
    name: 'Gale Plains',
    blurb: 'Wind pushes you off the edges. Lean into it.',
    twist: 'wind',
    materials: ['straw', 'bamboo', 'straw', 'timber', 'bamboo'],
    scenery: 'dunes',
    look: 'eye',
    palette: 2,
  },
  {
    name: 'Stormcrown',
    blurb: 'Everything so far, in a storm.',
    twist: ['wind', 'dark', 'pistons', 'blizzard', 'dark'],
    materials: ['metal', 'obsidian', 'brass', 'ice', 'obsidian'],
    scenery: 'peaks',
    look: 'robot',
    palette: 7,
  },
  {
    name: 'Abyss Rise',
    blurb: 'Rising water, falling stone, clockwork and night.',
    twist: ['flood', 'collapse', 'pistons', 'dark', 'flood'],
    materials: ['copper', 'sandstone', 'brass', 'obsidian', 'shingle'],
    scenery: 'forest',
    look: 'spiker',
    palette: 5,
  },
  {
    name: 'Edge of Doom',
    blurb: 'The last climb. The guardian waits at the top.',
    twist: ['blizzard', 'collapse', 'wind', 'flood', 'storm'],
    materials: ['crystal', 'rock', 'obsidian', 'marble', 'obsidian'],
    scenery: 'volcano',
    look: 'eye',
    palette: 7,
  },
];

export const CAMPAIGN_TOWERS = WORLDS.length * TOWERS_PER_WORLD;
export const PUZZLE_TYPES = ['lights', 'bells', 'beam'];

// A rune door for a puzzle room: a quiet ledge cell in the middle part of the tower with room for
// a 3-row doorway above it, away from other doors. `rows` is the tower grid, top row first.
export function placeRuneDoor(rows, seed) {
  const g = rows.slice().reverse();
  const H = g.length;
  const at = (c, r) => (r >= 0 && r < H ? g[r][((c % 16) + 16) % 16] : ' ');
  const find = (lo, hi, dcs) => {
    const out = [];
    for (let r = Math.floor(H * lo); r < Math.floor(H * hi); r++) {
      for (let c = 0; c < 16; c++) {
        if (!'-'.includes(at(c, r))) continue;
        if (at(c, r + 1) !== ' ' || at(c, r + 2) !== ' ' || at(c, r + 3) !== ' ') continue;
        let near = false;
        for (let dr = -3; dr <= 3; dr++) for (const dc of dcs) if ('#T^v!'.includes(at(c + dc, r + 1 + dr))) near = true;
        if (!near) out.push([c, r]);
      }
    }
    return out;
  };
  // first choice: the middle half, clear of other doors and lifts nearby; then anywhere sensible
  let cands = find(0.25, 0.75, [-1, 0, 1, 8]);
  if (!cands.length) cands = find(0.12, 0.88, [0, 8]);
  if (!cands.length) return null;
  const k = Math.abs(Math.imul(seed | 0, 2654435761) >>> 7) % cands.length;
  return { col: cands[k][0], floor: cands[k][1] };
}
const ROMAN = ['I', 'II', 'III', 'IV', 'V'];


export function worldOfIndex(i) {
  const w = Math.floor(i / TOWERS_PER_WORLD);
  return { world: w, tower: i % TOWERS_PER_WORLD };
}

// The plan for campaign tower i (0-based): everything the generator needs, plus labels
export function worldTowerPlan(i) {
  const { world: w, tower: t } = worldOfIndex(i);
  const W = WORLDS[w];
  if (!W) return null;
  let twist = Array.isArray(W.twist) ? W.twist[t] : W.twist;
  // tower 4 of worlds 2-7 brings back the previous world's twist
  if (!Array.isArray(W.twist) && t === 3 && w > 0) twist = WORLDS[w - 1].twist;
  const summit = t === 4;
  const height = Math.min(100, 40 + w * 5 + t * 3 + (summit ? 6 : 0));
  const difficulty = Math.min(0.95, 0.12 + w * 0.085 + t * 0.03 + (summit ? 0.04 : 0));
  return {
    index: i,
    world: w,
    tower: t,
    id: 101 + i,
    name: `${W.name.toUpperCase()} ${ROMAN[t]}`,
    label: `W${w + 1}-${t + 1}`,
    twist,
    material: W.materials[t],
    scenery: W.scenery,
    look: W.look,
    palette: W.palette,
    height,
    difficulty,
    summit,
    seed: (0x5eed00 + w * 97 + t * 13) >>> 0,
    final: i === CAMPAIGN_TOWERS - 1,
    // towers II and IV hide a rune door to a puzzle room (20 rooms; the types take turns)
    puzzle: t === 1 || t === 3 ? PUZZLE_TYPES[(w * 2 + (t === 3 ? 1 : 0)) % PUZZLE_TYPES.length] : null,
  };
}
