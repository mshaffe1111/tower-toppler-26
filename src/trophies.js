// Trophies: account-wide achievements, lots of them, so there's always another one to chase.
// Stats live in progress.stats; a trophy unlocks once (progress.trophies[id] = time) and the game
// shows a toast the moment it happens.
import { progress, saveProgress, totalMedals, MEDALS } from './settings.js';

const TOWER_NAMES = ['Tower of Eyes', 'Realm of Robots', 'Trap of Tricks', 'Slippery Slide', 'Broken Path', "Swimmer's Delight", 'Nasty One', 'Edge of Doom'];

function stats() {
  progress.stats = progress.stats || {};
  const s = progress.stats;
  for (const k of ['blocks', 'balls', 'fish', 'doors', 'lifts', 'steps', 'molecules', 'extraLives', 'starfish', 'freezes', 'bestScore']) s[k] = s[k] || 0;
  s.toppledO = s.toppledO || {};
  s.toppledR = s.toppledR || {};
  s.dailyDays = s.dailyDays || [];
  return s;
}

export function bumpStat(key, n = 1) {
  const s = stats();
  s[key] = (s[key] || 0) + n;
  saveProgress();
}

export function maxStat(key, v) {
  const s = stats();
  if (v > (s[key] || 0)) {
    s[key] = v;
    saveProgress();
  }
}

export function getStats() {
  return stats();
}

// Longest run of consecutive days in the list of 'YYYY-MM-DD' daily clears
export function dailyStreak() {
  const days = [...new Set(stats().dailyDays)].sort();
  let best = 0;
  let run = 0;
  let prev = null;
  for (const d of days) {
    const t = Date.parse(d + 'T00:00:00Z');
    run = prev != null && t - prev === 86400000 ? run + 1 : 1;
    best = Math.max(best, run);
    prev = t;
  }
  return best;
}

const count = (o) => Object.keys(o || {}).length;
// medals of one kind won on the 8 towers of a campaign ('or' Original keys, 'c' Reboot keys)
const medalCount = (prefix, id) => {
  let n = 0;
  for (let t = 1; t <= 8; t++) if ((progress.medals[`${prefix}${t}`] || {})[id]) n++;
  return n;
};
const allMedals = (prefix, list) => {
  let n = 0;
  for (let t = 1; t <= 8; t++) {
    const m = progress.medals[`${prefix}${t}`] || {};
    for (const md of list) if (m[md.id]) n++;
  }
  return n;
};
// the Reboot worlds campaign: towers 101..150 (worlds.js), 5 per world
const REBOOT_IDS = Array.from({ length: 50 }, (_, i) => 101 + i);
const rebootMedalCount = (id) => REBOOT_IDS.filter((t) => (progress.medals[`c${t}`] || {})[id]).length;
const rebootAllMedals = (list) => REBOOT_IDS.reduce((n, t) => n + list.filter((md) => (progress.medals[`c${t}`] || {})[md.id]).length, 0);
const WORLD_NAMES = ['Sunrise Shoals', 'Clockwork Keep', 'Frostbite Spire', 'Crumbling Mesa', 'Lantern Night', 'Rising Tide', 'Gale Plains', 'Stormcrown', 'Abyss Rise', 'Edge of Doom'];
const tiers = (base, icon, name, desc, goals, value, group) =>
  goals.map((g, i) => ({
    id: `${base}-${g}`,
    icon,
    name: `${name}${goals.length > 1 ? ' ' + ['I', 'II', 'III', 'IV'][i] : ''}`,
    desc: desc.replace('{n}', g.toLocaleString()),
    goal: g,
    value,
    group,
  }));

const O = 'ORIGINAL';
const R = 'REBOOT';
const D = 'DAILY & ENDLESS';
const C = 'COLLECTOR';

// goal + value() give a progress bar; a trophy unlocks when value() reaches goal
export const TROPHIES = [
  // --- Original: every tower, and the feats of the 1987 game
  ...TOWER_NAMES.map((n, i) => ({ id: `o-t${i + 1}`, icon: '🗼', name: n, desc: `Topple the original ${n}.`, goal: 1, value: () => (stats().toppledO[i + 1] ? 1 : 0), group: O })),
  { id: 'orig-all', icon: '👑', name: 'The 1987 Mission', desc: 'Topple all 8 original towers.', goal: 8, value: () => count(stats().toppledO), group: O },
  { id: 'third-door', icon: '🚪', name: 'The Third Door', desc: 'Pick the right door at the top of the Edge of Doom.', goal: 1, value: () => (stats().toppledO[8] ? 1 : 0), group: O },
  { id: 'iron-frog', icon: '🐸', name: 'Iron Frog', desc: 'Finish the Original from Tower 1 without losing a life.', goal: 1, value: () => stats().ironFrog || 0, group: O },
  { id: 'perfect', icon: '💎', name: 'Perfect Climb', desc: 'Win the 👑 Perfect medal on any original tower.', goal: 1, value: () => stats().perfect || 0, group: O },
  { id: 'perfect-all', icon: '🌟', name: 'Flawless Mission', desc: 'Win 👑 Perfect on all 8 original towers.', goal: 8, value: () => medalCount('or', 'perfect'), group: O },
  { id: 'speed-all', icon: '⏱️', name: 'Against the Clock', desc: 'Win ⏱️ Speed on all 8 original towers.', goal: 8, value: () => medalCount('or', 'time'), group: O },
  { id: 'marks-all', icon: '🎯', name: 'Dead Eye', desc: 'Win 🎯 Marksman on all 8 original towers.', goal: 8, value: () => medalCount('or', 'marksman'), group: O },
  { id: 'untouched-all', icon: '🛡️', name: 'Untouchable', desc: 'Win 🛡️ Untouched on all 8 original towers.', goal: 8, value: () => medalCount('or', 'nohit'), group: O },
  { id: 'close-shave', icon: '😅', name: 'Close Shave', desc: 'Topple a tower with under 10 seconds left.', goal: 1, value: () => stats().closeShave || 0, group: O },
  { id: 'comeback', icon: '💪', name: 'Comeback', desc: 'Topple a tower after losing 2 lives on it.', goal: 1, value: () => stats().comeback || 0, group: O },
  { id: 'beat-clock', icon: '⚡', name: 'Beat the Clock', desc: 'Topple a tower with half the time still on the clock.', goal: 1, value: () => stats().beatClock || 0, group: O },
  ...tiers('blocks', '🧱', 'Wall Breaker', 'Shoot {n} flashing blocks.', [10, 50, 200], () => stats().blocks, O),
  ...tiers('balls', '💥', 'Cannonball Crusher', 'Destroy {n} bouncing balls.', [10, 100, 500], () => stats().balls, O),
  ...tiers('molecules', '⚛️', 'Molecule Dodger', 'Let {n} molecules fly past without touching you.', [10, 50, 200], () => stats().molecules, O),
  ...tiers('doors', '🌀', 'Tunnel Rat', 'Go through {n} doors.', [25, 100, 500], () => stats().doors, O),
  ...tiers('lifts', '🛗', 'Lift Operator', 'Ride {n} lifts.', [25, 100, 500], () => stats().lifts, O),
  ...tiers('steps', '🪜', 'Stair Master', 'Climb {n} new stair steps.', [100, 1000, 10000], () => stats().steps, O),

  // --- Reboot
  ...WORLD_NAMES.map((n, w) => ({ id: `r-w${w + 1}`, icon: '🌍', name: `World ${w + 1}: ${n}`, desc: `Clear all five towers of ${n}.`, goal: 5, value: () => Math.max(0, Math.min(5, (progress.rebootCleared ?? -1) + 1 - w * 5)), group: R })),
  { id: 'reboot-all', icon: '🏆', name: 'Reboot Champion', desc: 'Clear all 50 towers of the Reboot.', goal: 50, value: () => Math.min(50, (progress.rebootCleared ?? -1) + 1), group: R },
  { id: 'reboot-purist', icon: '⏪', name: 'No Second Chances', desc: 'Finish the Reboot from World 1 without rewinding.', goal: 1, value: () => stats().rebootPurist || 0, group: R },
  ...tiers('combo-r', '🔥', 'Combo Master', 'Win 🔥 Combo on {n} Reboot towers.', [10, 25, 50], () => rebootMedalCount('combo'), R),
  ...tiers('explorer-r', '🧭', 'Explorer', 'Win ⭐ Explorer on {n} Reboot towers.', [10, 25, 50], () => rebootMedalCount('secrets'), R),
  ...tiers('starfish', '⭐', 'Star-fish Hunter', 'Find {n} hidden star-fish.', [10, 50, 150], () => stats().starfish, R),
  ...tiers('puzzles', '🧩', 'Rune Reader', 'Solve {n} hidden puzzle rooms.', [1, 10, 20], () => stats().puzzles || 0, R),
  ...tiers('freezes', '🧊', 'Ice Sculptor', 'Freeze {n} enemies with charged shots.', [10, 50, 200], () => stats().freezes, R),

  // --- Daily & Endless
  ...tiers('daily', '📅', 'Tower of the Day', 'Clear {n} daily towers.', [1, 10, 50], () => stats().dailyDays.length, D),
  ...tiers('streak', '🔥', 'On a Roll', 'Clear the daily tower {n} days in a row.', [3, 7, 30], () => dailyStreak(), D),
  ...tiers('endless', '🌀', 'Higher and Higher', 'Reach tower {n} in Endless.', [5, 10, 20], () => progress.endlessBestTower || 0, D),

  // --- Collector
  ...tiers('toppled', '🗼', 'Demolition Crew', 'Topple {n} towers.', [1, 25, 100], () => progress.towersCleared || 0, C),
  ...tiers('medals', '🏅', 'Medal Collector', 'Win {n} medals.', [10, 40, 80], () => totalMedals(), C),
  { id: 'cabinet-o', icon: '🥇', name: 'Original Cabinet', desc: 'Win all 40 medals on the original towers.', goal: 40, value: () => allMedals('or', MEDALS.original), group: C },
  { id: 'cabinet-r', icon: '🥈', name: 'Reboot Cabinet', desc: 'Win all 250 medals on the Reboot towers.', goal: 250, value: () => rebootAllMedals(MEDALS.reboot), group: C },
  ...tiers('fish', '🐟', 'Gone Fishing', 'Catch {n} fish from the sub.', [25, 100, 500], () => stats().fish, C),
  ...tiers('lives', '❤️', 'Extra Life', 'Earn {n} extra lives.', [1, 10, 50], () => stats().extraLives, C),
  ...tiers('score', '💯', 'High Roller', 'Score {n} points in one run.', [10000, 50000, 150000], () => stats().bestScore, C),
];

export const TROPHY_GROUPS = [O, R, D, C];

export function trophyState(t) {
  const v = Math.min(t.goal, t.value());
  return { value: v, goal: t.goal, unlocked: Boolean((progress.trophies || {})[t.id]) };
}

// Unlock everything newly earned; returns the trophies unlocked by this call
export function checkTrophies() {
  progress.trophies = progress.trophies || {};
  const fresh = [];
  for (const t of TROPHIES) {
    if (progress.trophies[t.id]) continue;
    if (t.value() >= t.goal) {
      progress.trophies[t.id] = Date.now();
      fresh.push(t);
    }
  }
  if (fresh.length) saveProgress();
  return fresh;
}

export function trophyCount() {
  return Object.keys(progress.trophies || {}).filter((id) => TROPHIES.some((t) => t.id === id)).length;
}
