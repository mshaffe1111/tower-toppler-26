import { sound } from './audio.js';
import { InputController } from './input.js';
import { GameRenderer } from './renderer.js';
import { TowerTopplerGame } from './game.js';
import { settings, setSetting, progress, saveProgress, getMedals, totalMedals, SKINS, skinUnlocked, currentSkin, MEDALS } from './settings.js';
import { applyControls, bindControlsInput, ControlEditor } from './controls.js';
import { OptionsMenu } from './options.js';
import { LEVELS, levelsFor, makeCampaignProvider, towerOfIndex, campaignLength, WORLDS, TOWERS_PER_WORLD, CAMPAIGN_TOWERS, worldTowerPlan } from './campaign.js';
import { TROPHIES, TROPHY_GROUPS, trophyState, trophyCount, checkTrophies } from './trophies.js';
import { makeGeneratedTower, dailyPlan } from './towergen.js';
import { materialForSeed } from './props.js';

const $ = (id) => document.getElementById(id);
const canvas = $('game-canvas');
const stageWrap = $('stage-wrap');
const appEl = $('app');

const scoreEl = $('score-display');
const hiScoreEl = $('hi-score-display');
const livesEl = $('lives-display');
const timerEl = $('timer-display');
const dirArrowEl = $('dir-arrow');
const towerBadgeEl = $('tower-badge');
const bannerEl = $('stage-banner');
const bannerSubEl = $('banner-sub');
const bannerTitleEl = $('banner-title');
const altMeterEl = $('altitude-meter');
const altFillEl = $('alt-fill');
const altPipEl = $('alt-pip');
const actionPromptEl = $('action-prompt');
const statusStrip = $('status-strip');
const stSecrets = $('st-secrets');
const stRewind = $('st-rewind');
const stRewindFill = $('st-rewind-fill');
const stHazard = $('st-hazard');
const bossBar = $('boss-bar');
const bossFill = $('boss-fill');
const hitFlashEl = $('hit-flash');

const overlays = {
  title: $('overlay-title'),
  pause: $('overlay-pause'),
  gameover: $('overlay-gameover'),
  settings: $('overlay-settings'),
  skins: $('overlay-skins'),
  howto: $('overlay-howto'),
  results: $('overlay-results'),
  trophies: $('overlay-trophies'),
  worlds: $('overlay-worlds'),
};
const show = (name) => overlays[name].classList.remove('hidden');
const hide = (name) => overlays[name].classList.add('hidden');

const input = new InputController();
bindControlsInput(input);
const renderer = new GameRenderer(canvas);

const hintEl = $('hint-card');
const hintText = $('hint-text');
let hintTimeout = null;

// ---------------- Banner ----------------
let bannerTimeout = null;
function showBanner(sub, title) {
  bannerSubEl.textContent = sub;
  bannerTitleEl.textContent = title;
  bannerEl.classList.remove('hidden');
  clearTimeout(bannerTimeout);
  bannerTimeout = setTimeout(() => bannerEl.classList.add('hidden'), 2300);
}

const formatScore = (n) => String(Math.max(0, Math.floor(n))).padStart(8, '0');
function formatTimer(sec) {
  const s = Math.max(0, sec);
  const whole = Math.floor(s);
  return `${String(whole).padStart(3, '0')}:${Math.floor((s - whole) * 10)}`;
}
function formatClock(sec) {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

// ---------------- Game ----------------
let lastSummary = null;
let lastRunConfig = { mode: 'campaign', startTower: 0 };

const game = new TowerTopplerGame(renderer, input, {
  onHud(hud) {
    scoreEl.textContent = formatScore(hud.score);
    hiScoreEl.textContent = formatScore(hud.hiScore);
    timerEl.textContent = formatTimer(hud.timer);
    appEl.classList.toggle('classic-rules', Boolean(settings.classic) || game.original);
    timerEl.parentElement?.classList.toggle('clock-off', settings.clock === false);
    timerEl.classList.toggle('urgent', hud.timer <= 15 && hud.mode === 'tower');
    towerBadgeEl.textContent = hud.mode === 'submarine' ? 'SUB' : hud.mode === 'puzzle' ? 'ROOM' : hud.mode === 'glide' ? 'GLIDE' : hud.towerLabel;
    dirArrowEl.textContent = hud.dirHint;
    const playing = ['tower', 'summit', 'levelclear', 'topple', 'results', 'submarine', 'puzzle', 'glide'].includes(hud.mode);
    sound.setMusicActive(playing);

    const lives = hud.lives === Infinity ? 1 : hud.lives;
    const livesKey = hud.lives === Infinity ? 'inf' : String(lives);
    if (livesEl.dataset.k !== livesKey) {
      livesEl.dataset.k = livesKey;
      livesEl.innerHTML = '';
      if (hud.lives === Infinity) {
        livesEl.textContent = '∞';
      } else {
        for (let i = 0; i < lives; i++) {
          const pip = document.createElement('span');
          pip.className = 'life-pip';
          livesEl.appendChild(pip);
        }
      }
    }

    const pct = Math.max(0, Math.min(100, hud.altitudePct ?? 0));
    altFillEl.style.height = `${pct}%`;
    altPipEl.style.bottom = `${pct}%`;
    const inTower = hud.mode === 'tower' || hud.mode === 'summit';
    altMeterEl.classList.toggle('hidden', !inTower);
    statusStrip.classList.toggle('hidden', !inTower);

    if (hud.actionPrompt && hud.mode === 'tower') {
      actionPromptEl.textContent = hud.actionPrompt;
      actionPromptEl.classList.remove('hidden');
    } else {
      actionPromptEl.classList.add('hidden');
    }

    if (hud.secrets) {
      stSecrets.textContent = `★ ${hud.secrets.got}/${hud.secrets.total}`;
      stSecrets.classList.toggle('hidden', !hud.secrets.total);
    }
    if (hud.rewind) {
      stRewind.classList.toggle('hidden', !hud.rewind.enabled);
      stRewindFill.style.width = `${hud.rewind.infinite ? 100 : Math.round(hud.rewind.frac * 100)}%`;
      stRewind.classList.toggle('active', hud.rewind.active);
      stageWrap.classList.toggle('rewinding', hud.rewind.active);
    }
    if (hud.hazard) {
      stHazard.classList.remove('hidden');
      const ico = hud.hazard.kind === 'flood' ? '🌊' : '🧱';
      stHazard.textContent = `${ico} ${hud.hazard.below.toFixed(1)} below`;
      stHazard.classList.toggle('danger', hud.hazard.below < 2);
    } else {
      stHazard.classList.add('hidden');
    }
    if (hud.boss) {
      bossBar.classList.remove('hidden');
      bossFill.style.width = `${(hud.boss.hp / hud.boss.max) * 100}%`;
    } else {
      bossBar.classList.add('hidden');
    }
  },
  onBanner: showBanner,
  onTrophies(list) {
    trophyQueue.push(...list);
    if (!trophyShowing) showNextTrophy();
  },
  onHint(text) {
    hintText.textContent = text;
    hintEl.classList.remove('hidden');
    hintEl.classList.remove('show');
    requestAnimationFrame(() => hintEl.classList.add('show'));
    clearTimeout(hintTimeout);
    hintTimeout = setTimeout(() => hintEl.classList.remove('show'), 4300);
  },
  onTowerResults(r) {
    $('res-label').textContent = `${r.towerLabel} TOPPLED`;
    $('res-name').textContent = r.towerName;
    // this mode's 5 medals: lit if won this climb, pulsing if won for the first time
    const row = $('medal-row');
    row.innerHTML = '';
    for (const md of MEDALS[r.original ? 'original' : 'reboot']) {
      const el = document.createElement('div');
      el.className = 'medal';
      el.title = md.desc;
      el.innerHTML = `<span class="medal-ico">${md.icon}</span><span class="medal-lbl">${md.name}</span>`;
      const won = Boolean(r.earned[md.id]);
      el.classList.toggle('earned', won);
      if (won && (r.fresh[md.id] || r.mode === 'endless')) requestAnimationFrame(() => el.classList.add('fresh'));
      row.appendChild(el);
    }
    $('res-time').textContent = formatClock(r.timeTaken);
    $('res-bonus').textContent = `+${r.bonus.toLocaleString()}`;
    $('res-secrets-lbl').textContent = r.original ? 'TARGETS' : 'STAR-FISH';
    $('res-secrets').textContent = r.original ? `${r.blocks.got}/${r.blocks.total}` : `${r.secrets.got}/${r.secrets.total}`;
    $('res-score').textContent = r.score.toLocaleString();
    let ghostTxt = '';
    if (r.newGhost && r.ghostTime) ghostTxt = `👻 New best run! Beat your ghost by ${(r.ghostTime - r.timeTaken).toFixed(1)}s`;
    else if (r.newGhost) ghostTxt = '👻 Ghost saved — race it next time!';
    else if (r.ghostTime) ghostTxt = `👻 Your ghost: ${formatClock(r.ghostTime)}`;
    $('res-ghost').textContent = ghostTxt;
    $('btn-continue').textContent = r.last ? 'FINISH ▸' : 'RIDE TO NEXT TOWER ▸';
    setTimeout(() => show('results'), 250);
  },
  onGameOver(victory, score, hiScore, summary) {
    lastSummary = { victory, score, hiScore, ...summary };
    actionPromptEl.classList.add('hidden');
    $('go-badge').textContent = victory ? (summary?.mode === 'daily' ? 'DAILY TOWER CLEARED!' : 'THE SEAS ARE HEALED!') : 'MISSION ENDED';
    $('go-title').textContent = victory ? (summary?.mode === 'daily' ? 'TOPPLED!' : 'ALL TOWERS TOPPLED!') : 'GAME OVER';
    $('go-score').textContent = score.toLocaleString();
    $('go-hi').textContent = hiScore.toLocaleString();
    show('gameover');
  },
});
// Dev hook for automated tests: open with ?debug
if (new URLSearchParams(location.search).has('debug')) window.__tt = { game, input, renderer };

// Preview tower behind the menu
game.loadTower(0);

// ---------------- Optional modules (loaded if present) ----------------
let procgen = null;
import('./procgen.js')
  .then((m) => {
    procgen = m;
    refreshMenu();
  })
  .catch(() => {});

let subRenderer = null;
Promise.all([import('./subStage.js'), import('./subRenderer.js')])
  .then(([stageMod, rendMod]) => {
    subRenderer = new rendMod.SubRenderer(renderer.webgl, { softDotTex: renderer.softDotTex });
    subRenderer.resize(renderer.width, renderer.height);
    game.subStageFactory = () => new stageMod.SubStage();
    renderer.renderSubStage = (g) => {
      subRenderer.render(g.subStage, { time: g.time, particles: g.particles, popups: g.popups, shake: g.shake });
    };
  })
  .catch(() => {});

// THE GLIDE: the hang-glider ride between worlds (Reboot campaign)
let glideRenderer = null;
const GLIDE_ENABLED = false; // switched on once the glide stage is finished and reviewed
(GLIDE_ENABLED ? Promise.all([import('./glideStage.js'), import('./glideRenderer.js')]) : Promise.reject(new Error('glide off')))
  .then(([stageMod, rendMod]) => {
    glideRenderer = new rendMod.GlideRenderer(renderer.webgl, { softDotTex: renderer.softDotTex });
    glideRenderer.resize(renderer.width, renderer.height);
    game.glideStageFactory = () => new stageMod.GlideStage();
    renderer.renderGlideStage = (g) => {
      glideRenderer.render(g.glideStage, { time: g.time, particles: g.particles, popups: g.popups, shake: g.shake });
    };
  })
  .catch(() => {});

// Hidden puzzle rooms behind rune doors (Reboot campaign)
let puzzleRenderer = null;
Promise.all([import('./puzzleRoom.js'), import('./puzzleRenderer.js')])
  .then(([roomMod, rendMod]) => {
    puzzleRenderer = new rendMod.PuzzleRenderer(renderer.webgl, { softDotTex: renderer.softDotTex });
    puzzleRenderer.resize(renderer.width, renderer.height);
    game.makePuzzle = roomMod.makePuzzle;
    game.puzzleRoomFactory = () => new roomMod.PuzzleRoom();
    renderer.renderPuzzleRoom = (g) => {
      puzzleRenderer.render(g.puzzleRoom, { time: g.time, particles: g.particles, popups: g.popups, shake: g.shake });
    };
  })
  .catch(() => {});

import('./pwa.js')
  .then((m) => {
    m.registerPWA?.();
    m.setupInstallPrompt?.($('btn-install'));
  })
  .catch(() => {});

// ---------------- Layout ----------------
let controlEditor = null; // created with the Options menu below
function handleResize() {
  const rect = stageWrap.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  renderer.resize(rect.width, rect.height, dpr);
  subRenderer?.resize(rect.width, rect.height);
  game.subStage?.resize?.(rect.width, rect.height);
  puzzleRenderer?.resize(rect.width, rect.height);
  glideRenderer?.resize(rect.width, rect.height);
  game.glideStage?.resize?.(rect.width, rect.height);
  game.puzzleRoom?.resize?.(rect.width, rect.height);
  applyControls();
  controlEditor?.onResize();
}
window.addEventListener('resize', handleResize);
window.addEventListener('orientationchange', () => setTimeout(handleResize, 150));
handleResize();

// ---------------- Settings / Options menu ----------------
function applySettings() {
  appEl.classList.toggle('classic-rules', Boolean(settings.classic));
  input.hapticsEnabled = settings.haptics !== false;
  renderer.setQualityMode(settings.quality || 'auto');
  renderer.setDiorama(settings.diorama !== false);
  sound.setVolumes?.(settings.musicVolume ?? 0.8, settings.sfxVolume ?? 1);
  applyControls();
}

let settingsReturn = 'title';
const optionsMenu = new OptionsMenu({
  tabsEl: $('opt-tabs'),
  bodyEl: $('opt-body'),
  tap: () => sound.uiTap?.(),
  onChange(key, value) {
    // Assist and Classic rules are opposites
    if (key === 'classic' && value && settings.assist) setSetting('assist', false);
    if (key === 'assist' && value && settings.classic) setSetting('classic', false);
    applySettings();
    if (key === 'controls.scheme') handleResize(); // the control deck changes height
    if (key === 'mirror' && game.mode === 'title') game.loadTower(Number($('start-tower').value) || 0);
  },
  onAction(action, btn) {
    if (action === 'reset-hints') {
      progress.hintsSeen = {};
      saveProgress();
      btn.textContent = '✓ HINTS WILL SHOW AGAIN';
    } else if (action === 'edit-layout') {
      hide('settings');
      controlEditor.open();
    }
  },
});
controlEditor = new ControlEditor({
  input,
  tap: () => sound.uiTap?.(),
  onClose: () => {
    optionsMenu.show('controls');
    show('settings');
  },
});
applySettings();

function openSettings(from) {
  settingsReturn = from;
  optionsMenu.show();
  hide(from);
  show('settings');
}
$('btn-settings').addEventListener('click', () => openSettings('title'));
$('btn-pause-settings').addEventListener('click', () => openSettings('pause'));
$('btn-settings-close').addEventListener('click', () => {
  sound.uiBack?.();
  hide('settings');
  show(settingsReturn);
});
$('btn-howto').addEventListener('click', () => {
  hide('title');
  show('howto');
});
$('btn-howto-close').addEventListener('click', () => {
  hide('howto');
  show('title');
});

// ---------------- Skins ----------------
function renderSkins() {
  const grid = $('skin-grid');
  grid.innerHTML = '';
  const medals = totalMedals();
  for (const skin of SKINS) {
    const unlocked = skinUnlocked(skin);
    const b = document.createElement('button');
    b.type = 'button';
    b.className = `skin-card${currentSkin().id === skin.id ? ' selected' : ''}${unlocked ? '' : ' locked'}`;
    b.innerHTML = `<span class="skin-dot" style="background: radial-gradient(circle at 35% 30%, #fff8 0%, ${skin.body} 45%, ${skin.emissive} 100%)"></span>
      <span class="skin-name">${skin.name}</span>
      <span class="skin-need">${unlocked ? (skin.hat ? `+ ${skin.hat}` : 'default') : `🔒 ${skin.need} 🏅 (${medals})`}</span>`;
    b.addEventListener('click', () => {
      if (!unlocked) {
        sound.uiBack?.();
        return;
      }
      sound.uiTap?.();
      setSetting('skin', skin.id);
      renderSkins();
    });
    grid.appendChild(b);
  }
}
$('btn-skins').addEventListener('click', () => {
  renderSkins();
  hide('title');
  show('skins');
});
$('btn-skins-close').addEventListener('click', () => {
  hide('skins');
  show('title');
});

// ---------------- Trophy room ----------------
function renderTrophyRoom() {
  const medalsEl = $('tr-medals');
  medalsEl.innerHTML = '';
  for (const [label, prefix, list] of [['ORIGINAL', 'or', MEDALS.original]]) {
    const row = document.createElement('div');
    row.className = 'tr-mrow';
    const lab = document.createElement('div');
    lab.className = 'tr-mlabel';
    lab.textContent = label;
    row.appendChild(lab);
    game.campaignTowers.forEach((t, i) => {
      const m = getMedals(`${prefix}${t.id}`);
      const cell = document.createElement('div');
      cell.className = 'tr-mcell';
      cell.style.setProperty('--c', t.palette?.brickB || '#7dd3fc');
      cell.title = `${i + 1}. ${titleCase(t.name)}`;
      cell.innerHTML = `<span class="tr-mnum">${i + 1}</span><span class="tr-mdots">${list.map((md) => `<i class="${m[md.id] ? 'on' : ''}">${md.icon}</i>`).join('')}</span>`;
      row.appendChild(cell);
    });
    medalsEl.appendChild(row);
  }
  // Reboot: medals per world (5 towers x 5 medals)
  {
    const row = document.createElement('div');
    row.className = 'tr-mrow tr-mrow-worlds';
    row.innerHTML = '<div class="tr-mlabel">REBOOT</div>';
    WORLDS.forEach((W, w) => {
      let n = 0;
      for (let t = 0; t < TOWERS_PER_WORLD; t++) {
        const m = getMedals(`c${worldTowerPlan(w * TOWERS_PER_WORLD + t).id}`);
        n += MEDALS.reboot.filter((md) => m[md.id]).length;
      }
      const pal = game.campaignTowers[W.palette % game.campaignTowers.length]?.palette || {};
      const cell = document.createElement('div');
      cell.className = 'tr-mcell';
      cell.style.setProperty('--c', pal.brickB || '#7dd3fc');
      cell.title = `World ${w + 1}: ${W.name}`;
      cell.innerHTML = `<span class="tr-mnum">W${w + 1}</span><span class="tr-wcount${n ? ' on' : ''}">${n}<small>/25</small></span>`;
      row.appendChild(cell);
    });
    medalsEl.appendChild(row);
  }
  const list = $('tr-list');
  list.innerHTML = '';
  let got = 0;
  let group = null;
  for (const t of TROPHIES) {
    if (t.group !== group) {
      group = t.group;
      const h = document.createElement('div');
      h.className = 'tr-group';
      h.textContent = group;
      list.appendChild(h);
    }
    const st = trophyState(t);
    if (st.unlocked) got++;
    const row = document.createElement('div');
    row.className = `tr-item${st.unlocked ? ' on' : ''}`;
    const pct = Math.round((st.value / st.goal) * 100);
    row.innerHTML = `<span class="tr-icon">${t.icon}</span><span class="tr-body"><span class="tr-name">${t.name}</span><span class="tr-desc">${t.desc}</span>${
      st.unlocked ? '' : t.goal > 1 ? `<span class="tr-bar"><i style="width:${pct}%"></i></span><span class="tr-prog">${st.value} / ${st.goal}</span>` : ''
    }</span><span class="tr-check">${st.unlocked ? '✓' : ''}</span>`;
    list.appendChild(row);
  }
  $('tr-count').textContent = `${got} / ${TROPHIES.length}`;
}
$('medal-summary').addEventListener('click', () => {
  checkTrophies(); // pick up anything earned before trophies existed
  renderTrophyRoom();
  hide('title');
  show('trophies');
});
$('btn-trophies-close').addEventListener('click', () => {
  hide('trophies');
  refreshMenu();
  show('title');
});

// ---------------- Reboot world map ----------------
// 10 worlds x 5 towers. A tower is open once the one before it is cleared; tap any open tower to
// play from there, or PLAY to carry on from the next one you haven't cleared.
const rebootNext = () => Math.min(CAMPAIGN_TOWERS - 1, (progress.rebootCleared ?? -1) + 1);
function renderWorldMap() {
  const cleared = progress.rebootCleared ?? -1;
  const next = rebootNext();
  const list = $('wm-list');
  list.innerHTML = '';
  WORLDS.forEach((W, w) => {
    const first = w * TOWERS_PER_WORLD;
    const open = first <= cleared + 1;
    const pal = game.campaignTowers[W.palette % game.campaignTowers.length]?.palette || {};
    const card = document.createElement('div');
    card.className = `wm-world${open ? '' : ' locked'}${next >= first && next < first + TOWERS_PER_WORLD ? ' current' : ''}`;
    card.style.setProperty('--c', pal.glow || '#38bdf8');
    card.style.setProperty('--c2', pal.brickB || '#7dd3fc');
    const twist = Array.isArray(W.twist) ? 'Mixed twists' : { none: 'No twist', pistons: 'Clockwork ledges', blizzard: 'Blizzard', collapse: 'Crumbling base', dark: 'Night storm', flood: 'Rising sea', wind: 'Gale' }[W.twist];
    let done = 0;
    let medals = 0;
    const pips = [];
    for (let t = 0; t < TOWERS_PER_WORLD; t++) {
      const i = first + t;
      const plan = worldTowerPlan(i);
      const m = getMedals(`c${plan.id}${settings.mirror ? 'm' : ''}`);
      const got = MEDALS.reboot.filter((md) => m[md.id]).length;
      medals += got;
      if (i <= cleared) done++;
      const state = i <= cleared ? 'cleared' : i === cleared + 1 ? 'next' : 'locked';
      pips.push(
        `<button class="wm-t ${state}${plan.summit ? ' summit' : ''}" type="button" data-i="${i}" ${state === 'locked' ? 'disabled' : ''} aria-label="${titleCase(plan.name)}${state === 'locked' ? ' (locked)' : ''}"><b>${['I', 'II', 'III', 'IV', 'V'][t]}</b><span class="wm-tm">${state === 'cleared' ? `${got}/5` : state === 'next' ? 'NEXT' : '🔒'}</span></button>`
      );
    }
    card.innerHTML = `<div class="wm-num">${w + 1}</div><div class="wm-body"><div class="wm-name">${W.name.toUpperCase()}</div><div class="wm-meta">${twist} · ${done}/5 cleared${medals ? ` · 🏅 ${medals}` : ''}</div><div class="wm-blurb">${open ? W.blurb : 'Clear the world before this one to open it.'}</div><div class="wm-towers">${pips.join('')}</div></div>`;
    list.appendChild(card);
  });
  const total = Math.max(0, cleared + 1);
  $('wm-prog-text').textContent = `${total} / ${CAMPAIGN_TOWERS} towers`;
  $('wm-prog-bar').style.width = `${Math.round((total / CAMPAIGN_TOWERS) * 100)}%`;
  const np = worldTowerPlan(next);
  $('wm-play-sub').textContent = total >= CAMPAIGN_TOWERS ? 'Play the last tower again' : `World ${np.world + 1} · ${titleCase(np.name)}`;
  // keep the current world in view
  requestAnimationFrame(() => list.querySelector('.wm-world.current')?.scrollIntoView({ block: 'center' }));
}
function openWorldMap() {
  renderWorldMap();
  hide('title');
  show('worlds');
  sound.uiTap?.();
}
$('btn-worlds-close').addEventListener('click', () => {
  hide('worlds');
  refreshMenu();
  show('title');
});
$('wm-list').addEventListener('click', (e) => {
  const b = e.target.closest('.wm-t');
  if (!b || b.disabled) return;
  startRun({ mode: 'campaign', variant: 'reboot', startTower: Number(b.dataset.i) });
});
$('btn-worlds-play').addEventListener('click', () => startRun({ mode: 'campaign', variant: 'reboot', startTower: rebootNext() }));
const trophyQueue = [];
let trophyShowing = false;
function showNextTrophy() {
  const t = trophyQueue.shift();
  const el = $('trophy-toast');
  if (!t) {
    trophyShowing = false;
    el.classList.add('hidden');
    return;
  }
  trophyShowing = true;
  el.querySelector('.tt-icon').textContent = t.icon;
  el.querySelector('.tt-name').textContent = t.name;
  el.classList.remove('hidden', 'show');
  void el.offsetWidth;
  el.classList.add('show');
  sound.medal?.(3);
  setTimeout(showNextTrophy, 3200);
}

// ---------------- Menu ----------------
function refreshMenu() {
  const sel = $('start-tower');
  const prevVal = sel.value;
  sel.innerHTML = '';
  game.campaignTowers.forEach((t, i) => {
    const m = getMedals(`c${t.id}${settings.mirror ? 'm' : ''}`);
    const icons = `${m.time ? '⏱️' : ''}${m.nohit ? '🛡️' : ''}${m.secrets ? '⭐' : ''}`;
    const opt = document.createElement('option');
    opt.value = String(i);
    opt.textContent = `${i + 1}. ${titleCase(t.name)} ${icons}`;
    sel.appendChild(opt);
  });
  if (prevVal) sel.value = prevVal;
  showTowerPick(0);
  // Continue a saved campaign / endless run
  const saved = progress.savedRun;
  const contBtn = $('btn-continue-run');
  // saves from before towers had 3 levels stored the tower number: convert once
  if (saved && saved.mode === 'campaign' && !saved.levels) {
    saved.towerIndex *= LEVELS;
    saved.levels = LEVELS;
    saveProgress();
  }
  // Original runs saved before it became the 8 real towers (one climb each): back to that tower
  if (saved && saved.mode === 'campaign' && saved.variant === 'original' && saved.levels === LEVELS) {
    saved.towerIndex = Math.floor(saved.towerIndex / LEVELS);
    saved.levels = 1;
    saveProgress();
  }
  // Reboot runs saved before the worlds campaign don't map onto it: drop them
  if (saved && saved.mode === 'campaign' && (saved.variant || 'reboot') === 'reboot' && saved.campaign !== 'worlds') {
    progress.savedRun = null;
    saveProgress();
  }
  const canContinue =
    progress.savedRun && Boolean(procgen) && (saved.mode !== 'campaign' || saved.towerIndex < campaignLength(saved.variant || 'reboot'));
  contBtn.classList.toggle('hidden', !canContinue);
  if (canContinue) {
    const where =
      saved.mode === 'campaign'
        ? saved.variant === 'original'
          ? `Original · T${saved.towerIndex + 1} ${titleCase(saved.towerName || '')}`
          : `Reboot · W${towerOfIndex(saved.towerIndex, 'reboot').tower + 1}-${towerOfIndex(saved.towerIndex, 'reboot').level} ${titleCase(saved.towerName || '')}`
        : `Endless · tower ${saved.towerIndex + 1}`;
    const lives = '♥'.repeat(Math.min(6, saved.lives || 1));
    $('continue-sub').textContent = `${where.replace(/\s+/g, ' ').trim()} · ${(saved.score || 0).toLocaleString()} pts · ${lives}`;
  }
  const n = totalMedals();
  $('medal-summary').textContent = `🏆 ${trophyCount()}/${TROPHIES.length} trophies · 🏅 ${n} medal${n === 1 ? '' : 's'} ›`;
  const daily = $('btn-daily');
  const endless = $('btn-endless');
  daily.disabled = !procgen;
  endless.disabled = !procgen;
  if (procgen) {
    const seed = procgen.dailySeed();
    const best = progress.dailyBest[seed];
    const plan = dailyPlan(seed);
    $('daily-sub').textContent = best ? `Best ${best.toLocaleString()} · ${plan.label}` : `${plan.label} · ${plan.height} rows`;
    const eb = progress.endlessBestTower || 0;
    $('endless-sub').textContent = eb ? `Best: tower ${eb}` : 'How high can you go?';
  } else {
    $('daily-sub').textContent = 'Loading…';
    $('endless-sub').textContent = 'Loading…';
  }
}
const SMALL_WORDS = new Set(['of', 'the', 'a', 'an', 'and', 'in', 'on', 'to']);
function titleCase(s) {
  return s
    .toLowerCase()
    .split(' ')
    .map((w, i) => (/^[ivx]+$/.test(w) && i > 0 ? w.toUpperCase() : i > 0 && SMALL_WORDS.has(w) ? w : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(' ');
}
refreshMenu();
// Title: hide the in-game HUD and replay the logo's '26 stamp each time the menu opens
function replayLogo() {
  const logo = document.querySelector('.logo');
  if (!logo) return;
  logo.classList.remove('stamp');
  void logo.offsetWidth; // restart the CSS animations
  logo.classList.add('stamp');
}
appEl.classList.add('on-title');
handleResize();
replayLogo();
$('start-tower').addEventListener('change', () => {
  if (game.mode === 'title') game.loadTower(Number($('start-tower').value) || 0);
  showTowerPick(0);
});

// Tower picker on the title: ‹ TOWER n / 8 › with the name and a dot per tower in its colour.
// The arrows step through; a sideways swipe anywhere on the title does the same.
function showTowerPick(dir) {
  const towers = game.campaignTowers;
  const i = Number($('start-tower').value) || 0;
  const t = towers[i];
  if (!t) return;
  $('tp-n').textContent = String(i + 1);
  // medals won on this tower: Original and Reboot, out of 5 each
  const won = (key, list) => list.filter((md) => getMedals(key)[md.id]).length;
  const mo = won(`or${t.id}`, MEDALS.original);
  const mr = won(`c${t.id}${settings.mirror ? 'm' : ''}`, MEDALS.reboot);
  const icons = mo || mr ? `🏅 ${mo}·${mr}` : '';
  const name = $('tp-name');
  name.textContent = titleCase(t.name);
  if (icons) {
    const sp = document.createElement('span');
    sp.className = 'tp-medals';
    sp.textContent = icons;
    name.appendChild(sp);
  }
  const dots = $('tp-dots');
  if (dots.children.length !== towers.length) {
    dots.innerHTML = '';
    for (const tw of towers) {
      const d = document.createElement('i');
      d.style.setProperty('--c', tw.palette?.brickB || '#7dd3fc');
      dots.appendChild(d);
    }
  }
  [...dots.children].forEach((d, k) => d.classList.toggle('on', k === i));
  const pick = document.querySelector('.tower-pick');
  pick.style.setProperty('--tp-glow', `${t.palette?.glow || '#38bdf8'}99`);
  $('tp-prev').disabled = i <= 0;
  $('tp-next').disabled = i >= towers.length - 1;
  if (dir) {
    pick.classList.remove('flip-l', 'flip-r');
    void pick.offsetWidth;
    pick.classList.add(dir > 0 ? 'flip-r' : 'flip-l');
  }
}
function pickTower(delta) {
  const sel = $('start-tower');
  const cur = Number(sel.value) || 0;
  const next = Math.max(0, Math.min(game.campaignTowers.length - 1, cur + delta));
  if (next === cur) return;
  sel.value = String(next);
  if (game.mode === 'title') game.loadTower(next);
  showTowerPick(delta);
  sound.uiTap?.();
}
$('tp-prev').addEventListener('click', () => pickTower(-1));
$('tp-next').addEventListener('click', () => pickTower(1));
{
  const card = document.querySelector('#overlay-title .title-screen');
  let sw = null;
  card.addEventListener('pointerdown', (e) => {
    if (e.target.closest('button')) return;
    sw = { x: e.clientX, y: e.clientY, t: performance.now() };
  });
  card.addEventListener('pointerup', (e) => {
    if (!sw) return;
    const dx = e.clientX - sw.x;
    const dy = e.clientY - sw.y;
    const quick = performance.now() - sw.t < 700;
    sw = null;
    if (quick && Math.abs(dx) > 44 && Math.abs(dx) > Math.abs(dy) * 1.4) pickTower(dx < 0 ? 1 : -1);
  });
  card.addEventListener('pointercancel', () => (sw = null));
}

// ---------------- Full screen ----------------
// Phones lose a lot of screen to the browser bars. Android / desktop browsers can go full screen
// from a tap; iPhone Safari can't (Add to Home Screen does the same there), so the controls hide.
const fsRoot = document.documentElement;
const fsRequest = fsRoot.requestFullscreen || fsRoot.webkitRequestFullscreen;
const fsExit = document.exitFullscreen || document.webkitExitFullscreen;
const isStandalone = () => window.matchMedia?.('(display-mode: standalone), (display-mode: fullscreen)').matches || navigator.standalone === true;
const canFullscreen = Boolean(fsRequest) && document.fullscreenEnabled !== false && !isStandalone();
const isFullscreen = () => Boolean(document.fullscreenElement || document.webkitFullscreenElement);
const isPhone = () => window.matchMedia?.('(pointer: coarse)').matches;
function enterFullscreen() {
  if (!canFullscreen || isFullscreen()) return;
  try {
    const r = fsRequest.call(fsRoot, { navigationUI: 'hide' });
    if (r && r.catch) r.catch(() => {});
  } catch (_) {}
}
function toggleFullscreen() {
  if (isFullscreen()) {
    try {
      const r = fsExit && fsExit.call(document);
      if (r && r.catch) r.catch(() => {});
    } catch (_) {}
  } else enterFullscreen();
}
function syncFullscreenUi() {
  const full = isFullscreen();
  const tb = $('btn-fullscreen');
  tb.classList.toggle('hidden', !canFullscreen);
  tb.classList.toggle('is-full', full);
  tb.querySelector('span').textContent = full ? 'EXIT FULL' : 'FULL SCREEN';
  const pb = $('btn-pause-fullscreen');
  pb.classList.toggle('hidden', !canFullscreen);
  pb.textContent = full ? '⛶ EXIT FULL SCREEN' : '⛶ FULL SCREEN';
}
$('btn-fullscreen').addEventListener('click', toggleFullscreen);
$('btn-pause-fullscreen').addEventListener('click', toggleFullscreen);
document.addEventListener('fullscreenchange', () => {
  syncFullscreenUi();
  handleResize();
});
document.addEventListener('webkitfullscreenchange', () => {
  syncFullscreenUi();
  handleResize();
});
syncFullscreenUi();

function startRun(cfg) {
  lastRunConfig = cfg;
  // starting a game is a tap, so the browser lets us go full screen here
  if (settings.autoFullscreen !== false && isPhone()) enterFullscreen();
  appEl.classList.remove('on-title');
  handleResize(); // the HUD is back, so the playfield is shorter
  sound.unlock();
  for (const k of Object.keys(overlays)) hide(k);
  let provider = null;
  if (cfg.mode === 'daily' && procgen) {
    // the tower of the day, built from the original's pieces (towergen.js), the same for everyone
    const plan = dailyPlan(procgen.dailySeed());
    const base = game.campaignTowers[plan.weekday % game.campaignTowers.length];
    const tower =
      makeGeneratedTower({ seed: plan.seed, height: plan.height, difficulty: plan.difficulty, mechanic: plan.mechanic, palette: base.palette, name: `DAILY · ${plan.label.toUpperCase()}`, look: ['eye', 'robot', 'spiker'][plan.weekday % 3] }) ||
      procgen.generateTower({ seed: plan.seed, difficulty: 0.55, id: 900, name: null });
    tower.seed = plan.seed;
    tower.material = materialForSeed(plan.seed, plan.mechanic);
    provider = (i) => (i === 0 ? tower : null);
  } else if (cfg.mode === 'campaign') {
    // Original: the 8 real towers. Reboot: the worlds campaign (worlds.js), 50 fixed towers
    const runSeed = cfg.runSeed ?? ((Date.now() & 0xffffff) ^ 0x2f1a3b);
    cfg.runSeed = runSeed;
    provider = makeCampaignProvider({ towers: game.campaignTowers, procgen, runSeed, variant: cfg.variant || 'reboot' });
  } else if (cfg.mode === 'endless' && procgen) {
    const runSeed = cfg.runSeed ?? (Date.now() & 0xffffff) ^ 0x5bd1e9;
    cfg.runSeed = runSeed;
    const cache = new Map();
    provider = (i) => {
      if (!cache.has(i)) {
        // endless: grid towers growing taller and meaner, a random twist from the second one
        const seed = ((runSeed >>> 0) * 31 + i * 7919 + 17) >>> 0;
        const twists = ['none', 'pistons', 'blizzard', 'dark', 'flood', 'collapse', 'wind'];
        const t =
          makeGeneratedTower({
            seed,
            height: Math.min(90, 46 + i * 4),
            difficulty: Math.min(0.95, 0.15 + i * 0.06),
            id: 100 + i,
            name: `ENDLESS · TOWER ${i + 1}`,
            look: ['eye', 'robot', 'spiker'][i % 3],
            palette: game.campaignTowers[i % game.campaignTowers.length].palette,
            mechanic: i === 0 ? 'none' : twists[seed % twists.length],
          }) || procgen.endlessTower(i, runSeed);
        t.seed = t.seed ?? runSeed * 31 + i;
        t.material = t.material || materialForSeed((runSeed >>> 0) + i * 7919, t.mechanic);
        cache.set(i, t);
      }
      return cache.get(i);
    };
  }
  game.startNewGame({ mode: cfg.mode, startTower: cfg.startTower || 0, provider, runSeed: cfg.runSeed ?? null, resume: cfg.resume || null, variant: cfg.variant || 'reboot' });
}

const campaignStart = (variant) => (Number($('start-tower').value) || 0) * (procgen ? levelsFor(variant) : 1);
$('btn-start').addEventListener('click', openWorldMap);
$('btn-original').addEventListener('click', () => startRun({ mode: 'campaign', variant: 'original', startTower: campaignStart('original') }));
$('btn-daily').addEventListener('click', () => procgen && startRun({ mode: 'daily' }));
$('btn-continue-run').addEventListener('click', () => {
  const saved = progress.savedRun;
  if (!saved) return;
  if (saved.mode === 'endless' && !procgen) return;
  // A run continues with the mirror setting it was started with
  if (Boolean(settings.mirror) !== Boolean(saved.mirror)) setSetting('mirror', Boolean(saved.mirror));
  startRun({ mode: saved.mode, variant: saved.variant || 'reboot', startTower: saved.towerIndex, runSeed: saved.runSeed, resume: saved });
});
$('btn-endless').addEventListener('click', () => procgen && startRun({ mode: 'endless' }));

// ---------------- Pause ----------------
function togglePause() {
  // Esc / Start while editing the layout = DONE (never un-pauses behind the editor)
  if (controlEditor?.isOpen) {
    controlEditor.close(true);
    return;
  }
  if (!['tower', 'submarine', 'summit', 'puzzle', 'glide', 'paused'].includes(game.mode)) return;
  input.releaseAll();
  const paused = game.togglePause();
  sound.setMusicActive(!paused);
  if (paused) {
    actionPromptEl.classList.add('hidden');
    $('pause-tower-name').textContent = game.tower ? game.tower.name : '';
    show('pause');
  } else {
    hide('pause');
    hide('settings');
  }
}
$('btn-pause').addEventListener('click', togglePause);
input.onPause = togglePause;
document.addEventListener('visibilitychange', () => {
  if (document.hidden && ['tower', 'submarine', 'summit', 'puzzle', 'glide'].includes(game.mode)) togglePause();
});
$('btn-resume').addEventListener('click', () => {
  sound.unlock();
  if (settings.autoFullscreen !== false && isPhone()) enterFullscreen(); // back to full screen if you'd left it
  hide('pause');
  game.togglePause();
  sound.setMusicActive(true);
});
function toMenu() {
  for (const k of Object.keys(overlays)) hide(k);
  actionPromptEl.classList.add('hidden');
  bossBar.classList.add('hidden');
  statusStrip.classList.add('hidden');
  stageWrap.classList.remove('rewinding');
  game.mode = 'title';
  appEl.classList.add('on-title');
  handleResize();
  replayLogo();
  game.subStage = null;
  sound.setMusicActive(false);
  sound.stopAmbience?.();
  sound.setUnderwater?.(false);
  sound.setTowerTheme?.('title');
  game.runMode = 'campaign';
  game.healing = 0;
  game.towerProvider = (i) => game.campaignTowers[i] || null;
  game.loadTower(Number($('start-tower').value) || 0);
  refreshMenu();
  show('title');
}
$('btn-restart').addEventListener('click', toMenu);
$('btn-menu').addEventListener('click', toMenu);
$('btn-play-again').addEventListener('click', () => startRun(lastRunConfig));
$('btn-continue').addEventListener('click', () => {
  sound.uiTap?.();
  hide('results');
  game.continueAfterResults();
});

// ---------------- Share card ----------------
$('btn-share').addEventListener('click', async () => {
  const blob = await makeScoreCard(lastSummary || { score: game.score, hiScore: game.hiScore, mode: game.runMode, towers: 0 });
  const file = new File([blob], 'tower-toppler-26-score.png', { type: 'image/png' });
  const text = `I scored ${(lastSummary?.score ?? game.score).toLocaleString()} in Tower Toppler '26!`;
  try {
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], title: "Tower Toppler '26", text });
      return;
    }
  } catch (_) {
    return; // user cancelled
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = file.name;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    URL.revokeObjectURL(a.href);
    a.remove();
  }, 1000);
});

function makeScoreCard(s) {
  const W = 1080;
  const H = 1350;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const ctx = c.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#050a1f');
  g.addColorStop(0.55, '#0c1d48');
  g.addColorStop(1, '#03263a');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  // Stars
  for (let i = 0; i < 160; i++) {
    ctx.fillStyle = `rgba(224,242,254,${0.2 + Math.random() * 0.7})`;
    ctx.fillRect(Math.random() * W, Math.random() * H * 0.6, 2, 2);
  }
  // Tower silhouette
  const tg = ctx.createLinearGradient(380, 0, 700, 0);
  tg.addColorStop(0, '#1e3a8a');
  tg.addColorStop(0.5, '#3b82f6');
  tg.addColorStop(1, '#1e3a8a');
  ctx.fillStyle = tg;
  ctx.fillRect(400, 330, 280, 820);
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  for (let y = 350; y < 1150; y += 40) for (let x = 400 + ((y / 40) % 2) * 20; x < 680; x += 40) ctx.fillRect(x, y, 2, 36);
  ctx.fillStyle = '#93c5fd';
  for (let k = 0; k < 6; k++) ctx.fillRect(k % 2 ? 380 : 560, 420 + k * 120, 140, 18);
  // Pogo
  const skin = currentSkin();
  ctx.fillStyle = skin.body;
  ctx.beginPath();
  ctx.ellipse(540, 300, 70, 62, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#fff';
  for (const x of [512, 568]) {
    ctx.beginPath();
    ctx.arc(x, 285, 20, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = '#0b1020';
  for (const x of [518, 574]) {
    ctx.beginPath();
    ctx.arc(x, 288, 9, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.strokeStyle = skin.body;
  ctx.lineWidth = 8;
  for (const x of [515, 565]) {
    ctx.beginPath();
    ctx.moveTo(x, 245);
    ctx.lineTo(x + (x < 540 ? -14 : 14), 205);
    ctx.stroke();
  }
  // Sea
  ctx.fillStyle = 'rgba(14,165,233,0.35)';
  ctx.fillRect(0, 1150, W, 200);
  // Text
  ctx.textAlign = 'center';
  ctx.fillStyle = '#e0f2fe';
  ctx.font = '900 92px Orbitron, sans-serif';
  ctx.fillText("TOWER TOPPLER '26", W / 2, 120);
  ctx.font = '700 44px Rajdhani, sans-serif';
  ctx.fillStyle = '#7dd3fc';
  const modeLabel = s.mode === 'daily' ? 'DAILY TOWER' : s.mode === 'endless' ? 'ENDLESS CLIMB' : 'CAMPAIGN';
  ctx.fillText(`${modeLabel} · ${s.towers || 0} TOWER${s.towers === 1 ? '' : 'S'} TOPPLED`, W / 2, 180);
  ctx.fillStyle = 'rgba(2,6,23,0.75)';
  ctx.fillRect(170, 1170, 740, 140);
  ctx.fillStyle = '#39ff14';
  ctx.font = '900 96px Orbitron, sans-serif';
  ctx.fillText((s.score || 0).toLocaleString(), W / 2, 1270);
  ctx.fillStyle = '#fde68a';
  ctx.font = '700 36px Rajdhani, sans-serif';
  ctx.fillText(`🏅 ${totalMedals()} medals${s.mirror ? ' · mirror' : ''}${s.classic ? ' · classic rules' : ''}`, W / 2, 1335);
  return new Promise((res) => c.toBlob((b) => res(b), 'image/png'));
}

// M toggles music (the volume sliders live in Options > Audio)
window.addEventListener('keydown', (e) => {
  if (e.code === 'KeyM' && !e.repeat) {
    sound.unlock();
    const vol = settings.musicVolume > 0 ? 0 : settings.lastMusicVolume || 0.8;
    if (settings.musicVolume > 0) setSetting('lastMusicVolume', settings.musicVolume);
    setSetting('musicVolume', vol);
    applySettings();
  }
});

// ---------------- Main loop ----------------
let lastTs = performance.now();
let lastFlash = -1;
function loop(ts) {
  const dt = (ts - lastTs) / 1000;
  lastTs = ts;
  input.poll();

  if (game.mode === 'title') {
    game.time += Math.min(0.05, dt);
    game.camCol = (game.camCol + dt * 0.5) % 16;
    game.camFloor = 2 + (Math.sin(game.time * 0.15) * 0.5 + 0.5) * Math.max(0, (game.exitFloor || 8) - 4);
  } else {
    game.update(dt);
  }
  game.render();

  const f = settings.reducedMotion ? 0 : game.flash || 0;
  if (f !== lastFlash) {
    hitFlashEl.style.opacity = String(Math.min(1, f).toFixed(3));
    lastFlash = f;
  }
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
