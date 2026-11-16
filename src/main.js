import { sound } from './audio.js';
import { InputController } from './input.js';
import { GameRenderer } from './renderer.js';
import { TowerTopplerGame } from './game.js';
import { settings, setSetting, progress, saveProgress, getMedals, totalMedals, SKINS, skinUnlocked, currentSkin } from './settings.js';

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
};
const show = (name) => overlays[name].classList.remove('hidden');
const hide = (name) => overlays[name].classList.add('hidden');

const input = new InputController();
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
    timerEl.classList.toggle('urgent', hud.timer <= 15 && hud.mode === 'tower');
    towerBadgeEl.textContent = hud.mode === 'submarine' ? 'SUB' : hud.towerLabel;
    dirArrowEl.textContent = hud.dirHint;
    const playing = ['tower', 'summit', 'topple', 'results', 'submarine'].includes(hud.mode);
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
    const setMedal = (id, earned, fresh) => {
      const el = $(id);
      el.classList.toggle('earned', earned);
      el.classList.remove('fresh');
      if (fresh) requestAnimationFrame(() => el.classList.add('fresh'));
    };
    const prev = r.mode === 'endless' ? { time: false, nohit: false, secrets: false } : null;
    setMedal('medal-time', r.earned.time, r.fresh.time || (prev && r.earned.time));
    setMedal('medal-nohit', r.earned.nohit, r.fresh.nohit || (prev && r.earned.nohit));
    setMedal('medal-secrets', r.earned.secrets, r.fresh.secrets || (prev && r.earned.secrets));
    $('res-time').textContent = formatClock(r.timeTaken);
    $('res-bonus').textContent = `+${r.bonus.toLocaleString()}`;
    $('res-secrets').textContent = `${r.secrets.got}/${r.secrets.total}`;
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

import('./pwa.js')
  .then((m) => {
    m.registerPWA?.();
    m.setupInstallPrompt?.($('btn-install'));
    m.requestFullscreenOnFirstTap?.();
  })
  .catch(() => {});

// ---------------- Layout ----------------
function handleResize() {
  const rect = stageWrap.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  renderer.resize(rect.width, rect.height, dpr);
  subRenderer?.resize(rect.width, rect.height);
  game.subStage?.resize?.(rect.width, rect.height);
}
window.addEventListener('resize', handleResize);
window.addEventListener('orientationchange', () => setTimeout(handleResize, 150));
handleResize();

// ---------------- Settings ----------------
function applySettings() {
  $('touch-controls')?.classList.toggle('swapped', settings.stickSide === 'left');
  $('btn-swap').textContent = settings.stickSide === 'left' ? '⇄ STICK ON RIGHT' : '⇄ STICK ON LEFT';
  appEl.classList.toggle('classic-rules', Boolean(settings.classic));
  input.hapticsEnabled = settings.haptics !== false;
  renderer.setQualityMode(settings.quality || 'auto');
  renderer.setDiorama(settings.diorama !== false);
}
applySettings();

function syncSettingsForm() {
  for (const el of overlays.settings.querySelectorAll('[data-setting]')) {
    const key = el.dataset.setting;
    if (key === 'stickLeft') el.checked = settings.stickSide === 'left';
    else if (el.type === 'checkbox') el.checked = Boolean(settings[key]);
    else el.value = String(settings[key]);
  }
}
for (const el of overlays.settings.querySelectorAll('[data-setting]')) {
  el.addEventListener('change', () => {
    sound.uiTap?.();
    const key = el.dataset.setting;
    if (key === 'stickLeft') setSetting('stickSide', el.checked ? 'left' : 'right');
    else if (key === 'gameSpeed') setSetting('gameSpeed', Number(el.value));
    else if (el.type === 'checkbox') setSetting(key, el.checked);
    else setSetting(key, el.value);
    if (key === 'classic' && el.checked && settings.assist) {
      setSetting('assist', false);
      syncSettingsForm();
    }
    if (key === 'assist' && el.checked && settings.classic) {
      setSetting('classic', false);
      syncSettingsForm();
    }
    applySettings();
    if (key === 'mirror' && game.mode === 'title') game.loadTower(Number($('start-tower').value) || 0);
  });
}
let settingsReturn = 'title';
function openSettings(from) {
  settingsReturn = from;
  syncSettingsForm();
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
$('btn-reset-hints').addEventListener('click', () => {
  progress.hintsSeen = {};
  saveProgress();
  $('btn-reset-hints').textContent = '💡 HINTS WILL SHOW AGAIN';
  sound.uiTap?.();
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
  const n = totalMedals();
  $('medal-summary').textContent = `🏅 ${n} medal${n === 1 ? '' : 's'} · ${progress.towersCleared || 0} towers toppled`;
  const daily = $('btn-daily');
  const endless = $('btn-endless');
  daily.disabled = !procgen;
  endless.disabled = !procgen;
  if (procgen) {
    const seed = procgen.dailySeed();
    const best = progress.dailyBest[seed];
    $('daily-sub').textContent = best ? `Today's best: ${best.toLocaleString()}` : 'New every day';
    const eb = progress.endlessBestTower || 0;
    $('endless-sub').textContent = eb ? `Best: tower ${eb}` : 'How high can you go?';
  } else {
    $('daily-sub').textContent = 'Loading…';
    $('endless-sub').textContent = 'Loading…';
  }
}
function titleCase(s) {
  return s.toLowerCase().replace(/(^|\s|')\S/g, (c) => c.toUpperCase());
}
refreshMenu();
$('start-tower').addEventListener('change', () => {
  if (game.mode === 'title') game.loadTower(Number($('start-tower').value) || 0);
});

function startRun(cfg) {
  lastRunConfig = cfg;
  sound.unlock();
  for (const k of Object.keys(overlays)) hide(k);
  let provider = null;
  if (cfg.mode === 'daily' && procgen) {
    const seed = procgen.dailySeed();
    const tower = procgen.generateTower({ seed, difficulty: 0.55, id: 900, name: null });
    tower.seed = seed;
    provider = (i) => (i === 0 ? tower : null);
  } else if (cfg.mode === 'endless' && procgen) {
    const runSeed = (Date.now() & 0xffffff) ^ 0x5bd1e9;
    const cache = new Map();
    provider = (i) => {
      if (!cache.has(i)) {
        const t = procgen.endlessTower(i, runSeed);
        t.seed = t.seed ?? runSeed * 31 + i;
        cache.set(i, t);
      }
      return cache.get(i);
    };
  }
  game.startNewGame({ mode: cfg.mode, startTower: cfg.startTower || 0, provider });
}

$('btn-start').addEventListener('click', () => startRun({ mode: 'campaign', startTower: Number($('start-tower').value) || 0 }));
$('btn-daily').addEventListener('click', () => procgen && startRun({ mode: 'daily' }));
$('btn-endless').addEventListener('click', () => procgen && startRun({ mode: 'endless' }));

// ---------------- Pause ----------------
function togglePause() {
  if (!['tower', 'submarine', 'summit', 'paused'].includes(game.mode)) return;
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
  if (document.hidden && ['tower', 'submarine', 'summit'].includes(game.mode)) togglePause();
});
$('btn-resume').addEventListener('click', () => {
  sound.unlock();
  hide('pause');
  game.togglePause();
  sound.setMusicActive(true);
});
$('btn-swap').addEventListener('click', () => {
  setSetting('stickSide', settings.stickSide === 'left' ? 'right' : 'left');
  applySettings();
});
function toMenu() {
  for (const k of Object.keys(overlays)) hide(k);
  actionPromptEl.classList.add('hidden');
  bossBar.classList.add('hidden');
  statusStrip.classList.add('hidden');
  stageWrap.classList.remove('rewinding');
  game.mode = 'title';
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

// Music toggles
$('btn-sound').addEventListener('click', () => {
  sound.unlock();
  const muted = sound.toggleMute();
  $('btn-sound').textContent = muted ? '🔇' : '🔊';
});
$('btn-music').addEventListener('click', () => {
  sound.unlock();
  const enabled = sound.toggleMusic();
  $('btn-music').textContent = enabled ? '🎵' : '🔕';
});
window.addEventListener('keydown', (e) => {
  if (e.code === 'KeyM' && !e.repeat) {
    sound.unlock();
    const enabled = sound.toggleMusic();
    $('btn-music').textContent = enabled ? '🎵' : '🔕';
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
