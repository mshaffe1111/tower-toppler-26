import { sound } from './audio.js';
import { InputController } from './input.js';
import { GameRenderer } from './renderer.js';
import { TowerTopplerGame } from './game.js';

const canvas = document.getElementById('game-canvas');
const stageWrap = document.getElementById('stage-wrap');

const scoreEl = document.getElementById('score-display');
const hiScoreEl = document.getElementById('hi-score-display');
const livesEl = document.getElementById('lives-display');
const timerEl = document.getElementById('timer-display');
const dirArrowEl = document.getElementById('dir-arrow');
const towerBadgeEl = document.getElementById('tower-badge');

const bannerEl = document.getElementById('stage-banner');
const bannerSubEl = document.getElementById('banner-sub');
const bannerTitleEl = document.getElementById('banner-title');

const overlayTitle = document.getElementById('overlay-title');
const overlayPause = document.getElementById('overlay-pause');
const overlayGameOver = document.getElementById('overlay-gameover');
const pauseTowerName = document.getElementById('pause-tower-name');

const goBadge = document.getElementById('go-badge');
const goTitle = document.getElementById('go-title');
const goScore = document.getElementById('go-score');
const goHi = document.getElementById('go-hi');

const btnStart = document.getElementById('btn-start');
const startTowerSelect = document.getElementById('start-tower');
const btnResume = document.getElementById('btn-resume');
const btnRestart = document.getElementById('btn-restart');
const btnPlayAgain = document.getElementById('btn-play-again');
const btnSound = document.getElementById('btn-sound');
const btnMusic = document.getElementById('btn-music');
const btnPause = document.getElementById('btn-pause');

const altMeterEl = document.getElementById('altitude-meter');
const altFillEl = document.getElementById('alt-fill');
const altPipEl = document.getElementById('alt-pip');
const actionPromptEl = document.getElementById('action-prompt');

const input = new InputController();
const renderer = new GameRenderer(canvas);

let bannerTimeout = null;
function showBanner(sub, title) {
  bannerSubEl.textContent = sub;
  bannerTitleEl.textContent = title;
  bannerEl.classList.remove('hidden');
  clearTimeout(bannerTimeout);
  bannerTimeout = setTimeout(() => {
    bannerEl.classList.add('hidden');
  }, 2200);
}

function formatScore(n) {
  return String(Math.max(0, Math.floor(n))).padStart(8, '0');
}

function formatTimer(sec) {
  const s = Math.max(0, sec);
  const whole = Math.floor(s);
  const tenths = Math.floor((s - whole) * 10);
  return `${String(whole).padStart(3, '0')}:${tenths}`;
}

const game = new TowerTopplerGame(renderer, input, {
  onHud(hud) {
    scoreEl.textContent = formatScore(hud.score);
    hiScoreEl.textContent = formatScore(hud.hiScore);
    timerEl.textContent = formatTimer(hud.timer);
    timerEl.classList.toggle('urgent', hud.timer <= 15 && hud.mode === 'tower');
    towerBadgeEl.textContent = hud.mode === 'submarine' ? 'SUB' : `T${hud.towerId}`;
    dirArrowEl.textContent = hud.dirHint;
    sound.setMusicActive(hud.mode === 'tower' || hud.mode === 'submarine');

    // Render life pips
    if (livesEl.childElementCount !== hud.lives) {
      livesEl.innerHTML = '';
      for (let i = 0; i < hud.lives; i++) {
        const pip = document.createElement('span');
        pip.className = 'life-pip';
        livesEl.appendChild(pip);
      }
    }

    // Tower Altitude Meter & Contextual Action Prompt
    const pct = Math.max(0, Math.min(100, hud.altitudePct ?? 0));
    if (altFillEl) altFillEl.style.height = `${pct}%`;
    if (altPipEl) altPipEl.style.bottom = `${pct}%`;
    if (altMeterEl) {
      altMeterEl.classList.toggle('hidden', hud.mode === 'submarine');
    }
    if (actionPromptEl) {
      if (hud.actionPrompt && hud.mode === 'tower') {
        actionPromptEl.textContent = hud.actionPrompt;
        actionPromptEl.classList.remove('hidden');
      } else {
        actionPromptEl.classList.add('hidden');
      }
    }
  },
  onBanner: showBanner,
  onGameOver(victory, score, hiScore) {
    sound.setMusicActive(false);
    if (actionPromptEl) actionPromptEl.classList.add('hidden');
    goBadge.textContent = victory ? 'PLANET NEBULUS SAVED!' : 'MISSION ENDED';
    goTitle.textContent = victory ? 'ALL TOWERS TOPPLED!' : 'GAME OVER';
    goScore.textContent = score.toLocaleString();
    goHi.textContent = hiScore.toLocaleString();
    overlayGameOver.classList.remove('hidden');
  },
});

// Load Tower 1 behind title screen for live background preview
game.loadTower(0);

function handleResize() {
  const rect = stageWrap.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  renderer.resize(rect.width, rect.height, dpr);
}
window.addEventListener('resize', handleResize);
handleResize();

// Buttons
btnStart.addEventListener('click', () => {
  sound.unlock();
  overlayTitle.classList.add('hidden');
  const idx = Number(startTowerSelect.value) || 0;
  game.startNewGame(idx);
});

btnSound.addEventListener('click', () => {
  sound.unlock();
  const muted = sound.toggleMute();
  btnSound.textContent = muted ? '🔇' : '🔊';
});

btnMusic?.addEventListener('click', () => {
  sound.unlock();
  const enabled = sound.toggleMusic();
  btnMusic.textContent = enabled ? '🎵' : '🔕';
});

btnPause.addEventListener('click', () => {
  if (game.mode === 'title' || game.mode === 'gameover' || game.mode === 'victory') return;
  const paused = game.togglePause();
  sound.setMusicActive(!paused && (game.mode === 'tower' || game.mode === 'submarine'));
  if (paused) {
    if (actionPromptEl) actionPromptEl.classList.add('hidden');
    pauseTowerName.textContent = `Tower ${game.tower.id}: ${game.tower.name}`;
    overlayPause.classList.remove('hidden');
  } else {
    overlayPause.classList.add('hidden');
  }
});

btnResume.addEventListener('click', () => {
  sound.unlock();
  overlayPause.classList.add('hidden');
  game.togglePause();
  sound.setMusicActive(game.mode === 'tower' || game.mode === 'submarine');
});

btnRestart.addEventListener('click', () => {
  overlayPause.classList.add('hidden');
  overlayTitle.classList.remove('hidden');
  if (actionPromptEl) actionPromptEl.classList.add('hidden');
  game.mode = 'title';
  sound.setMusicActive(false);
  game.loadTower(0);
});

btnPlayAgain.addEventListener('click', () => {
  sound.unlock();
  overlayGameOver.classList.add('hidden');
  const idx = Number(startTowerSelect.value) || 0;
  game.startNewGame(idx);
});

window.addEventListener('keydown', (e) => {
  if (e.code === 'KeyM' && !e.repeat) {
    sound.unlock();
    const enabled = sound.toggleMusic();
    if (btnMusic) btnMusic.textContent = enabled ? '🎵' : '🔕';
  }
});

// Main 60fps loop
let lastTs = performance.now();
function loop(ts) {
  const dt = (ts - lastTs) / 1000;
  lastTs = ts;

  if (game.mode === 'title') {
    // Gently rotate preview tower on title screen
    game.time += Math.min(0.05, dt);
    game.camCol = (game.camCol + dt * 0.6) % 16;
  } else {
    game.update(dt);
  }

  game.render();
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
