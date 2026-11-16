import { COLS, createTowers } from './levels.js';
import { sound } from './audio.js';

function wrapCol(c) {
  return ((c % COLS) + COLS) % COLS;
}

function approach(v, target, delta) {
  if (v < target) return Math.min(target, v + delta);
  if (v > target) return Math.max(target, v - delta);
  return v;
}

function colDist(a, b) {
  let d = wrapCol(b) - wrapCol(a);
  if (d > COLS / 2) d -= COLS;
  if (d < -COLS / 2) d += COLS;
  return d;
}

// Classic-paced movement tuning (deliberate like the 7800 original, but with modern assists)
const PHYS = {
  walkSpeed: 2.9, // columns / second on the ground
  airSpeed: 3.3, // a running jump carries a little extra distance
  gravity: 15,
  jumpVy: 6.9, // ~1.6 floors high
  stepVy: 5.7, // auto step-up hop onto the next stair
  maxFall: 11,
};
// Global enemy pace multiplier
const ENEMY_PACE = 0.72;

export class TowerTopplerGame {
  constructor(renderer, input, callbacks) {
    this.renderer = renderer;
    this.input = input;
    this.cb = callbacks;

    this.towers = createTowers();
    this.mode = 'title'; // title | tower | topple | submarine | paused | gameover | victory
    this.pausedFrom = null;

    this.towerIndex = 0;
    this.score = 0;
    this.nextExtraLife = 5000;
    this.hiScore = Number(localStorage.getItem('tt26_hiscore') || 0);
    this.lives = 3;
    this.time = 0;
    this.timer = 90;

    this.particles = [];
    this.popups = [];
    this.snowballs = [];
    this.ledges = [];
    this.elevators = [];
    this.enemies = [];
    this.shake = 0;
    this.comboCount = 0;
    this.comboTimer = 0;

    this.player = {
      col: 0,
      floor: 0,
      vx: 0,
      vy: 0,
      facing: 1,
      onGround: true,
      onElevator: null,
      invuln: 0,
      hidden: false,
      tunnelTimer: 0,
      tunnelTarget: null,
      safeCol: 0,
      safeFloor: 0,
      fireCooldown: 0,
      muzzleFlash: 0,
      stepUpCooldown: 0,
      squashX: 1,
      squashY: 1,
      coyoteTimer: 0,
      jumpBufferTimer: 0,
      knockbackTimer: 0,
      landingFloor: 0,
      doorLock: false,
      teeter: 0,
      stunTimer: 0,
      dropThrough: null,
      bestFloor: 0,
    };

    this.camCol = 0;
    this.camFloor = 2;
    this.camAnchor = 0;

    this.topple = {
      active: false,
      progress: 0,
      duration: 2.6,
    };

    this.sub = {
      x: 80,
      y: 220,
      timer: 0,
      duration: 14,
      bubbles: [],
      fish: [],
      spawnTimer: 0,
      fireCooldown: 0,
    };
  }

  startNewGame(startTowerIdx = 0) {
    this.score = 0;
    this.nextExtraLife = 5000;
    this.lives = 3;
    this.towerIndex = startTowerIdx;
    this.loadTower(this.towerIndex);
    this.mode = 'tower';
    this._syncHud();
  }

  loadTower(idx) {
    const t = this.towers[idx];
    this.tower = t;
    this.timer = t.timeLimit;
    this.particles = [];
    this.popups = [];
    this.snowballs = [];
    this.shake = 0;
    this.comboCount = 0;
    this.comboTimer = 0;
    this.topple = { active: false, progress: 0, duration: 2.6 };
    sound.setTowerTheme?.(t.id);

    // Clone mutable ledges, elevators, enemies
    this.ledges = t.ledges.map((l) => ({
      ...l,
      crumbling: false,
      crumbleTimer: 0,
      shake: false,
      gone: false,
      respawnTimer: 0,
    }));

    this.elevators = t.elevators.map((e) => ({
      ...e,
      floor: e.startFloor,
      dir: 1,
      recallTarget: null,
    }));

    this.enemies = t.enemies.map((e) => this._makeEnemy(e));
    this.flyerTimer = 5.5;
    this.hitStop = 0;
    this.flash = 0;

    this.player = {
      col: t.spawn.col + 0.5,
      floor: t.spawn.floor,
      vx: 0,
      vy: 0,
      facing: 1,
      onGround: true,
      onElevator: null,
      invuln: 1.0,
      hidden: false,
      tunnelTimer: 0,
      tunnelTarget: null,
      safeCol: t.spawn.col + 0.5,
      safeFloor: t.spawn.floor,
      fireCooldown: 0,
      muzzleFlash: 0,
      stepUpCooldown: 0,
      squashX: 1,
      squashY: 1,
      coyoteTimer: 0,
      jumpBufferTimer: 0,
      knockbackTimer: 0,
      landingFloor: t.spawn.floor,
      doorLock: false,
      teeter: 0,
      stunTimer: 0,
      dropThrough: null,
      bestFloor: t.spawn.floor,
    };

    this.player.landingFloor = this._computeLandingFloor(this.player.col, this.player.floor);
    this.camCol = this.player.col;
    this.camAnchor = this.player.floor;
    this.camFloor = Math.max(2, this.player.floor + 1.0);
    this.cb.onBanner?.(`TOWER ${t.id}`, t.name);
    this._syncHud();
  }

  _makeEnemy(e) {
    return {
      ...e,
      speed: (e.speed || 1.5) * ENEMY_PACE,
      baseFloor: e.floor,
      phase: Math.random() * Math.PI * 2,
      stunTimer: 0,
      dead: false,
      deathTimer: 0,
      fallVy: 0,
      hitFlash: 0,
    };
  }

  // Classic "flying nasty": appears from around the curve of the tower at Pogo's height and
  // sweeps across toward him. Molecules can be shot; eyes are invulnerable and must be dodged.
  _spawnFlyer() {
    const p = this.player;
    const active = this.enemies.filter((e) => e.spawned && !e.dead).length;
    if (active >= 2) return;
    const side = Math.random() < 0.5 ? -1 : 1;
    const type = this.towerIndex >= 2 && Math.random() < 0.35 ? 'eye' : 'molecule';
    const speed = 2.4 + this.towerIndex * 0.12;
    this.enemies.push(
      this._makeEnemy({
        type,
        col: wrapCol(p.col + side * 7.2),
        floor: Math.max(0.35, p.floor + 0.35),
        dir: -side,
        speed: speed / ENEMY_PACE,
        amp: 0.18,
        spawned: true,
        travel: 0,
      })
    );
    sound.flyerWarn?.();
  }

  startSubmarineStage() {
    this.mode = 'submarine';
    const w = this.renderer.width;
    const h = this.renderer.height;
    this.sub = {
      x: w * 0.22,
      y: h * 0.5,
      timer: 0,
      duration: 13.5,
      bubbles: [],
      fish: [],
      spawnTimer: 0.4,
      fireCooldown: 0,
    };
    this.particles = [];
    this.popups = [];
    this.shake = 0;
    this.comboCount = 0;
    this.comboTimer = 0;
    this.cb.onBanner?.('BONUS STAGE', 'MK.7 MINI-SUBMARINE');
    this._syncHud();
  }

  togglePause() {
    if (this.mode === 'tower' || this.mode === 'submarine') {
      this.pausedFrom = this.mode;
      this.mode = 'paused';
      return true;
    } else if (this.mode === 'paused') {
      this.mode = this.pausedFrom || 'tower';
      return false;
    }
    return false;
  }

  addScore(pts) {
    this.score += pts;
    if (this.score > this.hiScore) {
      this.hiScore = this.score;
      localStorage.setItem('tt26_hiscore', String(this.hiScore));
    }
    if (this.score >= this.nextExtraLife) {
      this.lives = Math.min(6, this.lives + 1);
      this.nextExtraLife += 5000;
      sound.extraLife();
      if (this.mode === 'submarine') {
        this.addPopup({ x: this.sub.x, y: this.sub.y - 26, text: 'EXTRA LIFE!', color: '#f472b6', maxLife: 1.35 });
      } else {
        this.addPopup({ col: this.player.col, floor: this.player.floor + 1.1, text: 'EXTRA LIFE!', color: '#f472b6', maxLife: 1.35 });
      }
    }
    this._syncHud();
  }

  addShake(amount) {
    this.shake = Math.min(18, Math.max(this.shake, amount));
  }

  _scoreComboHit(basePts, popupPos, baseColor) {
    this.comboCount = Math.min(4, (this.comboCount || 0) + 1);
    this.comboTimer = 3.2;
    const mult = this.comboCount;
    const pts = basePts * mult;
    this.addScore(pts);
    const label = mult > 1 ? `+${pts} (${mult}x!)` : `+${pts}`;
    this.addPopup({
      ...popupPos,
      text: label,
      color: mult > 1 ? '#f472b6' : baseColor,
    });
  }

  addPopup({ col = null, floor = null, x = null, y = null, text, color = '#ffffff', maxLife = 0.95 }) {
    this.popups.push({
      col,
      floor,
      x,
      y,
      text,
      color,
      life: maxLife,
      maxLife,
    });
  }

  _colFloorToScreen(col, floor, radiusOffset = 14) {
    if (this.renderer.projectColFloor) {
      return this.renderer.projectColFloor(col, floor, this.camCol, radiusOffset / 40);
    }
    const width = this.renderer.width;
    const height = this.renderer.height;
    const centerX = width * 0.5;
    const radius = Math.min(width * 0.33, 132) + radiusOffset;
    const floorPx = 42;
    const playerScreenY = height * 0.56;
    const a = colDist(this.camCol, col) * ((Math.PI * 2) / COLS);
    if (Math.abs(a) > Math.PI * 0.58) return null;
    return {
      x: centerX + radius * Math.sin(a),
      y: playerScreenY - (floor - this.camFloor) * floorPx,
    };
  }

  _spawnSplashDroplets(x, y) {
    const colors = ['#67e8f9', '#22d3ee', '#a5f3fc', '#e0f2fe'];
    for (let i = 0; i < 24; i++) {
      const spread = (Math.random() - 0.5) * 260;
      const upSpeed = -(130 + Math.random() * 190);
      const life = 0.42 + Math.random() * 0.38;
      this.particles.push({
        x: x + (Math.random() - 0.5) * 26,
        y: y + (Math.random() - 0.5) * 8,
        vx: spread,
        vy: upSpeed,
        gravity: 380,
        size: 3 + Math.random() * 4.5,
        color: colors[i % colors.length],
        life,
        maxLife: life,
      });
    }
  }

  _syncHud() {
    const exitDoor = this.tower?.doors.find((d) => d.isExit);
    const exitFloor = exitDoor ? exitDoor.floor : Math.max(1, (this.tower?.floors || 16) - 2);
    const p = this.player;
    const altitudePct = Math.max(0, Math.min(100, Math.round((p.floor / Math.max(1, exitFloor)) * 100)));

    let dirHint = '▲';
    let actionPrompt = null;
    if (this.mode === 'tower' && this.tower) {
      if (exitDoor) {
        const d = colDist(p.col, exitDoor.col + 0.5);
        if (Math.abs(d) < 0.7) dirHint = '▲';
        else dirHint = d > 0 ? '▶' : '◀';
      }
      if (!p.hidden) {
        const nearDoor =
          (p.onGround || p.coyoteTimer > 0) &&
          this.tower.doors.find(
            (d) => Math.abs(d.floor - p.floor) < 0.5 && Math.abs(colDist(p.col, d.col + 0.5)) < 0.72
          );
        if (nearDoor) {
          actionPrompt = nearDoor.isExit ? '▲ EXIT TOWER!' : '▲ ENTER PORTAL';
        } else if (p.onElevator) {
          actionPrompt = '▲▼ RIDE LIFT';
        } else {
          const nearEl = this.elevators.find((el) => Math.abs(colDist(p.col, el.col + 0.5)) < 1.15);
          if (nearEl && Math.abs(nearEl.floor - p.floor) > 0.35) {
            actionPrompt = '❄️ CALL LIFT';
          }
        }
      }
    }

    this.cb.onHud?.({
      score: this.score,
      hiScore: this.hiScore,
      lives: this.lives,
      timer: this.timer,
      towerId: this.tower ? this.tower.id : 1,
      dirHint,
      mode: this.mode,
      altitudePct,
      actionPrompt,
    });
  }

  _spawnParticles(x, y, color, count = 10, speed = 90, gravity = 180) {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = (0.3 + Math.random() * 0.7) * speed;
      const life = 0.4 + Math.random() * 0.35;
      this.particles.push({
        x,
        y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s - 25,
        gravity,
        size: 3 + Math.random() * 4,
        color,
        life,
        maxLife: life,
      });
    }
  }

  update(dt) {
    const clampedDt = Math.min(0.05, dt);
    this.time += clampedDt;
    if (this.flash > 0) this.flash = Math.max(0, this.flash - clampedDt * 3.5);

    // Hit-stop: freeze the simulation for a few frames on big impacts for extra punch
    if (this.hitStop > 0) {
      this.hitStop = Math.max(0, this.hitStop - clampedDt);
      this.input.clearFrame();
      return;
    }

    // Decay screen shake
    if (this.shake > 0) {
      this.shake *= Math.exp(-9 * clampedDt);
      if (this.shake < 0.15) this.shake = 0;
    }

    // Decay combo timer
    if (this.comboTimer > 0) {
      this.comboTimer = Math.max(0, this.comboTimer - clampedDt);
      if (this.comboTimer <= 0) this.comboCount = 0;
    }

    // Update floating score/status popups
    for (let i = this.popups.length - 1; i >= 0; i--) {
      const pop = this.popups[i];
      pop.life -= clampedDt;
      if (pop.floor !== null && pop.floor !== undefined) {
        pop.floor += clampedDt * 0.85;
      }
      if (pop.y !== null && pop.y !== undefined) {
        pop.y -= clampedDt * 34;
      }
      if (pop.life <= 0) {
        this.popups.splice(i, 1);
      }
    }

    // Update particles in all active modes
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx * clampedDt;
      p.y += p.vy * clampedDt;
      p.vy += (p.gravity ?? 180) * clampedDt;
      p.life -= clampedDt;
      if (p.life <= 0) this.particles.splice(i, 1);
    }

    if (this.mode === 'tower') {
      this._updateTower(clampedDt);
    } else if (this.mode === 'topple') {
      this._updateTopple(clampedDt);
    } else if (this.mode === 'submarine') {
      this._updateSubmarine(clampedDt);
    }

    this.input.clearFrame();
  }

  _updateTower(dt) {
    const p = this.player;
    const inp = this.input.state;

    // Countdown timer
    this.timer = Math.max(0, this.timer - dt);
    if (this.timer <= 0) {
      this._loseLife('TIME UP!');
      return;
    }

    if (p.invuln > 0) p.invuln = Math.max(0, p.invuln - dt);
    if (p.fireCooldown > 0) p.fireCooldown = Math.max(0, p.fireCooldown - dt);
    if (p.knockbackTimer > 0) p.knockbackTimer = Math.max(0, p.knockbackTimer - dt);
    if (p.muzzleFlash > 0) p.muzzleFlash = Math.max(0, p.muzzleFlash - dt);
    if (p.stepUpCooldown > 0) p.stepUpCooldown = Math.max(0, p.stepUpCooldown - dt);
    if (p.stunTimer > 0) p.stunTimer = Math.max(0, p.stunTimer - dt);
    const stunned = p.stunTimer > 0;

    // Spring squash & stretch back to 1.0
    const springRate = Math.min(1, dt * 14);
    p.squashX += (1 - p.squashX) * springRate;
    p.squashY += (1 - p.squashY) * springRate;

    // Tunnel transition
    if (p.hidden) {
      p.tunnelTimer -= dt;
      if (p.tunnelTimer <= 0 && p.tunnelTarget) {
        p.col = p.tunnelTarget.col + 0.5;
        p.floor = p.tunnelTarget.floor;
        p.vx = 0;
        p.vy = 0;
        p.hidden = false;
        p.tunnelTarget = null;
        p.safeCol = p.col;
        p.safeFloor = p.floor;
        sound.door();
      }
      this._updateCamera(dt);
      this._syncHud();
      return;
    }

    // Update crumbling ledges
    for (const l of this.ledges) {
      if (l.crumbling && !l.gone) {
        l.crumbleTimer -= dt;
        if (l.crumbleTimer <= 0) {
          l.gone = true;
          l.crumbling = false;
          l.shake = false;
          l.respawnTimer = 4.0;
          sound.crumble();
          this.addShake(4.5);
          const pos = this._colFloorToScreen(l.col + 0.5, l.floor, 10);
          if (pos) {
            this._spawnParticles(pos.x, pos.y, '#f59e0b', 10, 85);
          }
        }
      } else if (l.gone) {
        l.respawnTimer -= dt;
        if (l.respawnTimer <= 0) {
          l.gone = false;
        }
      }
    }

    // Update elevators
    for (const el of this.elevators) {
      if (el.recallTarget !== null) {
        const diff = el.recallTarget - el.floor;
        if (Math.abs(diff) < 0.05) {
          el.floor = el.recallTarget;
          el.recallTarget = null;
        } else {
          el.floor += Math.sign(diff) * el.speed * 1.6 * dt;
        }
      } else {
        el.floor += el.dir * el.speed * dt;
        if (el.floor >= el.maxFloor) {
          el.floor = el.maxFloor;
          el.dir = -1;
        } else if (el.floor <= el.minFloor) {
          el.floor = el.minFloor;
          el.dir = 1;
        }
      }
    }

    // Check current surface friction / conveyor
    const underLedge = p.onGround ? this._findLedgeAt(p.col, p.floor) : null;
    const isIce = underLedge && underLedge.type === 'ice';
    const convPush = underLedge
      ? underLedge.type === 'conveyorR'
        ? 1.5
        : underLedge.type === 'conveyorL'
        ? -1.5
        : 0
      : 0;

    // Horizontal movement: quick acceleration ramp instead of instant full speed so taps give
    // precise small steps, while holding still reaches full speed in ~0.1s.
    const maxSpeed = p.onGround ? PHYS.walkSpeed : PHYS.airSpeed;
    // Analog stick gives proportional speed (min 35% so a light push still walks); digital = full speed
    const axis = typeof inp.axisX === 'number' && inp.axisX !== 0 ? inp.axisX : (inp.right ? 1 : 0) - (inp.left ? 1 : 0);
    let targetVx = 0;
    if (!stunned && Math.abs(axis) > 0.05) {
      const mag = Math.min(1, Math.max(0.35, Math.abs(axis)));
      targetVx = Math.sign(axis) * maxSpeed * mag;
      p.facing = Math.sign(axis);
    }

    if ((p.knockbackTimer || 0) <= 0) {
      let rate;
      if (isIce && p.onGround) {
        rate = 5.5; // slippery
      } else if (!p.onGround) {
        rate = targetVx === 0 ? 10 : 24; // a little air control damping
      } else if (targetVx === 0) {
        rate = 34; // stop quickly
      } else if (Math.sign(targetVx) !== Math.sign(p.vx) && Math.abs(p.vx) > 0.2) {
        rate = 52; // snappy turn-around
      } else {
        rate = 26;
      }
      p.vx = approach(p.vx, targetVx, rate * dt);
    }

    const moveDelta = (p.vx + (p.onGround ? convPush : 0)) * dt;
    let nextCol = wrapCol(p.col + moveDelta);

    // Edge guard: never *walk* off a solid ledge straight into the toxic sea. Deliberate drops onto
    // a lower ledge and all jumps are unaffected; ice and conveyors keep their classic danger.
    p.teeter = Math.max(0, (p.teeter || 0) - dt);
    if (p.onGround && !p.onElevator && underLedge && !isIce && !convPush && moveDelta !== 0) {
      const stillSupported = this._findLedgeAt(nextCol, p.floor);
      if (!stillSupported && this._computeLandingFloor(nextCol, p.floor) <= -0.5) {
        nextCol = p.col;
        p.vx = 0;
        p.teeter = 0.25;
      }
    }

    // Check horizontal block ('box' type)
    const blockingBox = this.ledges.find(
      (l) => !l.gone && l.type === 'box' && Math.abs(l.floor - p.floor) < 0.6 && Math.abs(colDist(nextCol, l.col + 0.5)) < 0.52
    );
    if (!blockingBox) {
      p.col = nextCol;
    } else {
      p.vx = 0;
    }

    // Door / Exit interaction with UP (held or tapped). After popping out of a tunnel, UP must be
    // released first so holding it doesn't bounce you straight back through the linked door.
    const upTapped = this.input.consumeJustPressed('up');
    if (!inp.up) p.doorLock = false;
    if (!stunned && (upTapped || (inp.up && !p.doorLock)) && (p.onGround || p.coyoteTimer > 0)) {
      const door = this.tower.doors.find(
        (d) => Math.abs(d.floor - p.floor) < 0.5 && Math.abs(colDist(p.col, d.col + 0.5)) < 0.72
      );
      if (door) {
        if (door.isExit) {
          this._triggerTowerTopple();
          return;
        } else if (door.targetId) {
          const target = this.tower.doors.find((d) => d.id === door.targetId);
          if (target) {
            p.hidden = true;
            p.doorLock = true;
            p.tunnelTimer = 0.35;
            p.tunnelTarget = target;
            sound.door();
            return;
          }
        }
      }
    }

    // Coyote time (0.12s) & Jump buffering (0.12s)
    if (p.onGround) {
      p.coyoteTimer = 0.14;
    } else {
      p.coyoteTimer = Math.max(0, p.coyoteTimer - dt);
    }

    if (this.input.consumeJustPressed('jump')) {
      p.jumpBufferTimer = 0.15;
    } else {
      p.jumpBufferTimer = Math.max(0, p.jumpBufferTimer - dt);
    }

    // Jump
    if (!stunned && p.jumpBufferTimer > 0 && (p.onGround || p.coyoteTimer > 0)) {
      p.vy = PHYS.jumpVy;
      // A jump launches at full air speed in the held direction (classic fixed-arc feel)
      if (targetVx !== 0) p.vx = Math.sign(targetVx) * Math.max(Math.abs(p.vx), PHYS.walkSpeed);
      p.onGround = false;
      p.onElevator = null;
      p.coyoteTimer = 0;
      p.jumpBufferTimer = 0;
      p.autoHop = false;
      p.squashX = 0.76;
      p.squashY = 1.28;
      sound.jump();
    }

    // Classic Atari 7800 Auto-Step-Up (+1 floor when walking into an adjacent ledge)
    if (p.onGround && Math.abs(targetVx) > 0 && (p.stepUpCooldown || 0) <= 0) {
      const stepFloor = Math.round(p.floor) + 1;
      const blockedOverhead = this.ledges.some(
        (b) => !b.gone && Math.abs(b.floor - stepFloor) < 0.25 && Math.abs(colDist(p.col, b.col + 0.5)) < 0.35
      );
      if (!blockedOverhead) {
        const stepLedge = this.ledges.find((l) => {
          if (l.gone || l.type === 'box' || Math.abs(l.floor - stepFloor) > 0.2) return false;
          const dc = colDist(p.col, l.col + 0.5);
          return Math.sign(dc) === p.facing && Math.abs(dc) > 0.14 && Math.abs(dc) <= 0.62;
        });
        if (stepLedge) {
          p.vy = PHYS.stepVy;
          p.onGround = false;
          p.onElevator = null;
          p.coyoteTimer = 0;
          p.stepUpCooldown = 0.22;
          p.autoHop = true; // full-height hop: not subject to the short-hop jump cut
          p.squashX = 0.82;
          p.squashY = 1.2;
          sound.stepUp();
        }
      }
    }

    // Variable jump cut for crisp short hops vs full jumps (only for real jumps, never auto step-ups)
    if (p.onGround) p.autoHop = false;
    if (!inp.jump && !p.autoHop && !p.onGround && !p.onElevator && p.vy > 3.2) {
      p.vy *= Math.pow(0.85, dt * 60);
    }

    // Fire Snowball (or recall nearby elevator!)
    const fireTapped = this.input.consumeJustPressed('fire');
    if (!stunned && (fireTapped || inp.fire) && p.fireCooldown <= 0) {
      p.fireCooldown = fireTapped ? 0.22 : 0.3;
      p.muzzleFlash = 0.14;
      // Recall elevator if standing near a shaft
      const nearEl = this.elevators.find((el) => Math.abs(colDist(p.col, el.col + 0.5)) < 1.15);
      if (nearEl && Math.abs(nearEl.floor - p.floor) > 0.35) {
        nearEl.recallTarget = Math.max(nearEl.minFloor, Math.min(nearEl.maxFloor, p.floor));
        sound.elevator();
      }
      // Shoot snowball
      this.snowballs.push({
        col: wrapCol(p.col + p.facing * 0.4),
        floor: p.floor + 0.3,
        dir: p.facing,
        life: 1.1,
      });
      sound.snowball();
    }

    // Vertical physics & gravity
    const wasOnGround = p.onGround;
    const prevVy = p.vy;
    if (p.onElevator) {
      const el = p.onElevator;
      if (Math.abs(colDist(p.col, el.col + 0.5)) > 0.65) {
        p.onElevator = null;
        p.onGround = false;
      } else {
        if (inp.up) {
          el.recallTarget = null;
          el.dir = 1;
          el.floor = Math.min(el.maxFloor, el.floor + el.speed * 0.45 * dt);
        } else if (inp.down) {
          el.recallTarget = null;
          el.dir = -1;
          el.floor = Math.max(el.minFloor, el.floor - el.speed * 0.45 * dt);
        }
        p.floor = el.floor;
        p.vy = 0;
        p.onGround = true;
      }
    }

    if (!p.onElevator) {
      const prevFloor = p.floor;
      p.vy = Math.max(-PHYS.maxFall, p.vy - PHYS.gravity * dt);
      p.floor += p.vy * dt;
      p.onGround = false;

      // Landing on ledges (when falling)
      if (p.dropThrough != null && p.floor < p.dropThrough - 0.3) p.dropThrough = null;
      if (p.vy <= 0) {
        const landed = this._findLedgeLanding(p.col, prevFloor, p.floor, p.dropThrough);
        if (landed) {
          p.floor = landed.floor;
          p.vy = 0;
          p.onGround = true;
          p.dropThrough = null;
          this._onReachFloor(landed.floor);
          if (!wasOnGround && prevVy < -1.2) {
            const impact = Math.min(1, Math.abs(prevVy) / 10);
            p.squashX = 1 + 0.28 * Math.max(0.45, impact);
            p.squashY = 1 - 0.24 * Math.max(0.45, impact);
            if (Math.abs(prevVy) > 3.2) sound.land(impact);
          }
          if (landed.type === 'solid' || landed.type === 'ice') {
            p.safeCol = landed.col + 0.5;
            p.safeFloor = landed.floor;
          }
          if (landed.type === 'crumble' && !landed.crumbling) {
            landed.crumbling = true;
            landed.shake = true;
            landed.crumbleTimer = 0.48;
          }
        } else {
          // Check elevator platform landing
          for (const el of this.elevators) {
            if (
              (p.dropThrough == null || el.floor < p.dropThrough - 0.05) &&
              Math.abs(colDist(p.col, el.col + 0.5)) < 0.62 &&
              prevFloor >= el.floor - 0.45 &&
              p.floor <= el.floor + 0.35
            ) {
              p.floor = el.floor;
              p.vy = 0;
              p.onGround = true;
              p.onElevator = el;
              if (!wasOnGround && prevVy < -1.2) {
                const impact = Math.min(1, Math.abs(prevVy) / 10);
                p.squashX = 1 + 0.28 * Math.max(0.45, impact);
                p.squashY = 1 - 0.24 * Math.max(0.45, impact);
                if (Math.abs(prevVy) > 3.2) sound.land(impact);
              }
              break;
            }
          }
        }
      }

      // Forgiving ledge-edge mantle (snap onto ledge top if within 0.3 floor below while moving toward it)
      if (!p.onGround && p.dropThrough == null && !stunned && p.vy <= 1.6 && Math.abs(p.vx) > 0.3) {
        const mantleLedge = this.ledges.find((l) => {
          if (l.gone || l.type === 'box') return false;
          const floorGap = l.floor - p.floor;
          if (floorGap <= 0 || floorGap > 0.3) return false;
          const dc = colDist(p.col, l.col + 0.5);
          return Math.abs(dc) < 0.72 && Math.sign(p.vx) === Math.sign(dc);
        });
        if (mantleLedge) {
          p.floor = mantleLedge.floor;
          p.vy = 0;
          p.onGround = true;
          this._onReachFloor(mantleLedge.floor);
          p.squashX = 1.14;
          p.squashY = 0.88;
          sound.stepUp();
          if (mantleLedge.type === 'solid' || mantleLedge.type === 'ice') {
            p.safeCol = mantleLedge.col + 0.5;
            p.safeFloor = mantleLedge.floor;
          }
          if (mantleLedge.type === 'crumble' && !mantleLedge.crumbling) {
            mantleLedge.crumbling = true;
            mantleLedge.shake = true;
            mantleLedge.crumbleTimer = 0.48;
          }
        }
      }
    }

    // Fell into Toxic Sea!
    if (p.floor < -0.55) {
      sound.splash();
      this.addShake(10);
      this._spawnSplashDroplets(this.renderer.width * 0.5, this.renderer.height * 0.78);
      this._loseLife('SPLASH!');
      return;
    }

    // Update Snowballs
    for (let i = this.snowballs.length - 1; i >= 0; i--) {
      const sb = this.snowballs[i];
      sb.col = wrapCol(sb.col + sb.dir * 8.5 * dt);
      sb.life -= dt;
      if (sb.life <= 0) {
        this.snowballs.splice(i, 1);
        continue;
      }

      // Icy snowball trail particles
      sb.trailTimer = (sb.trailTimer || 0) - dt;
      if (sb.trailTimer <= 0) {
        sb.trailTimer = 0.028;
        const pos = this._colFloorToScreen(sb.col, sb.floor, 14);
        if (pos) {
          const life = 0.22 + Math.random() * 0.14;
          this.particles.push({
            x: pos.x + (Math.random() - 0.5) * 4,
            y: pos.y + (Math.random() - 0.5) * 4,
            vx: -sb.dir * (18 + Math.random() * 20),
            vy: (Math.random() - 0.5) * 18,
            gravity: 28,
            size: 2.5 + Math.random() * 2,
            color: Math.random() < 0.5 ? '#e0f2fe' : '#67e8f9',
            life,
            maxLife: life,
          });
        }
      }

      // Check box hit
      const box = this.ledges.find(
        (l) => !l.gone && l.type === 'box' && Math.abs(l.floor - sb.floor) < 0.7 && Math.abs(colDist(sb.col, l.col + 0.5)) < 0.5
      );
      if (box) {
        box.gone = true;
        box.respawnTimer = 999;
        this._scoreComboHit(50, { col: box.col + 0.5, floor: box.floor + 0.5 }, '#fde047');
        this.addShake(3.5);
        const pos = this._colFloorToScreen(box.col + 0.5, box.floor + 0.3, 12);
        if (pos) this._spawnParticles(pos.x, pos.y, '#bae6fd', 8, 95);
        sound.hitEnemy();
        this.snowballs.splice(i, 1);
        continue;
      }

      // Check enemy hit (classic rules: bouncing balls & molecules pop, silver rollers only freeze, eyes are immune)
      let hit = false;
      for (const en of this.enemies) {
        if (en.dead) continue;
        if (Math.abs(en.floor - sb.floor) < 0.65 && Math.abs(colDist(sb.col, en.col)) < 0.55) {
          hit = true;
          const pos = this._colFloorToScreen(en.col, en.floor + 0.3, 14);
          en.hitFlash = 0.18;
          if (en.type === 'bouncer' || en.type === 'molecule') {
            en.dead = true;
            en.deathTimer = 0.5;
            const pts = en.type === 'molecule' ? 150 : 100;
            this._scoreComboHit(pts, { col: en.col, floor: en.floor + 0.5 }, en.type === 'molecule' ? '#f472b6' : '#fca5a5');
            this.addShake(4.0);
            this.hitStop = 0.045;
            if (pos) {
              this._spawnParticles(pos.x, pos.y, en.type === 'molecule' ? '#f472b6' : '#f87171', 14, 140);
              this._spawnParticles(pos.x, pos.y, '#e0f2fe', 8, 90);
            }
            sound.hitEnemy();
          } else if (en.type === 'roller') {
            en.stunTimer = 3.2;
            this._scoreComboHit(25, { col: en.col, floor: en.floor + 0.5 }, '#a5f3fc');
            this.addShake(2.0);
            if (pos) this._spawnParticles(pos.x, pos.y, '#a5f3fc', 9, 80);
            sound.stunEnemy();
          } else {
            // Invulnerable eye: snowball shatters harmlessly
            this.addShake(1.0);
            if (pos) this._spawnParticles(pos.x, pos.y, '#e0f2fe', 6, 65);
            sound.stunEnemy();
          }
          break;
        }
      }
      if (hit) {
        this.snowballs.splice(i, 1);
      }
    }

    // Update Enemies
    this.flyerTimer -= dt;
    if (this.flyerTimer <= 0) {
      this.flyerTimer = Math.max(4.5, 9 - this.towerIndex * 0.55) + Math.random() * 3;
      if (p.floor > 0.5 || this.towerIndex > 0) this._spawnFlyer();
    }
    for (let ei = this.enemies.length - 1; ei >= 0; ei--) {
      const en = this.enemies[ei];
      if (en.hitFlash > 0) en.hitFlash = Math.max(0, en.hitFlash - dt);
      if (en.dead) {
        if (en.deathTimer > 0) en.deathTimer = Math.max(0, en.deathTimer - dt);
        if (en.spawned && en.deathTimer <= 0) this.enemies.splice(ei, 1);
        continue;
      }
      if (en.stunTimer > 0) {
        en.stunTimer = Math.max(0, en.stunTimer - dt);
        continue;
      }

      if (en.type === 'roller' || en.type === 'bouncer') {
        // Ground enemies patrol their ledge run, turning around at edges and solid blocks.
        const floorLvl = Math.round(en.baseFloor);
        const support = (c) =>
          this.ledges.find(
            (l) => !l.gone && l.type !== 'box' && l.floor === floorLvl && Math.abs(colDist(c, l.col + 0.5)) <= 0.52
          );
        if (en.falling || !support(en.col)) {
          // Ledge crumbled away underneath: tumble into the sea
          en.falling = true;
          en.fallVy -= PHYS.gravity * dt;
          en.baseFloor += en.fallVy * dt;
          en.floor = en.baseFloor;
          if (en.floor < -0.6) {
            en.dead = true;
            const pos = this._colFloorToScreen(en.col, 0, 14);
            if (pos) this._spawnSplashDroplets(pos.x, pos.y);
          }
          continue;
        }
        const nextCol = wrapCol(en.col + en.dir * en.speed * dt);
        const blocked = this.ledges.some(
          (l) => !l.gone && l.type === 'box' && l.floor === floorLvl && Math.abs(colDist(nextCol, l.col + 0.5)) < 0.75
        );
        if (blocked || !support(nextCol)) {
          en.dir *= -1;
        } else {
          en.col = nextCol;
        }
        if (en.type === 'bouncer') {
          // Real ballistic-looking bounce (abs-sine arc), peaking a little over head height
          en.floor = floorLvl + Math.abs(Math.sin(this.time * 3.2 + en.phase)) * 0.95;
        } else {
          en.floor = floorLvl;
        }
      } else {
        en.col = wrapCol(en.col + en.dir * en.speed * dt);
        if (en.type === 'molecule') {
          en.floor = en.baseFloor + Math.sin(this.time * 3 + en.phase) * (en.amp || 0.4);
        } else if (en.type === 'eye') {
          en.floor = en.baseFloor + Math.sin(this.time * 1.7 + en.phase) * (en.amp || 0.3);
        }
        if (en.spawned) {
          // Homing flyers drift toward Pogo's height, then leave after sweeping past
          en.baseFloor += Math.sign(p.floor + 0.35 - en.baseFloor) * Math.min(Math.abs(p.floor + 0.35 - en.baseFloor), 0.5 * dt);
          en.travel += en.speed * dt;
          if (en.travel > 14.5) {
            this.enemies.splice(ei, 1);
            continue;
          }
        }
      }

      // Player collision: knocked back down to the ledge below (into the sea if there's none)
      if (
        p.invuln <= 0 &&
        !p.hidden &&
        Math.abs(en.floor - p.floor) < 0.55 &&
        Math.abs(colDist(en.col, p.col)) < 0.5
      ) {
        this._knockDown(colDist(en.col, p.col) >= 0 ? 1 : -1);
      }
    }

    p.landingFloor = this._computeLandingFloor(p.col, p.floor);
    this._updateCamera(dt);
    this._syncHud();
  }

  _knockDown(dir) {
    const p = this.player;
    sound.hurt();
    this.addShake(9);
    this.input.haptic(40);
    this.hitStop = 0.08;
    this.flash = 0.6;
    p.invuln = 1.7;
    p.stunTimer = 0.5;
    p.vy = 2.6;
    p.vx = dir * 0.9;
    p.onGround = false;
    p.onElevator = null;
    p.coyoteTimer = 0;
    p.jumpBufferTimer = 0;
    p.knockbackTimer = 0.5;
    p.dropThrough = Math.round(p.floor);
    p.squashX = 1.25;
    p.squashY = 0.78;
    this.comboCount = 0;
    this.comboTimer = 0;
  }

  // Classic climb scoring: points the first time you reach each new floor
  _onReachFloor(floor) {
    const p = this.player;
    const f = Math.round(floor);
    if (f > (p.bestFloor || 0)) {
      const gained = f - (p.bestFloor || 0);
      p.bestFloor = f;
      if (this.mode === 'tower') {
        this.addScore(25 * gained);
        sound.climb?.();
        this.addPopup({ col: p.col, floor: f + 1.0, text: `+${25 * gained}`, color: '#a7f3d0', maxLife: 0.7 });
      }
    }
  }

  _computeLandingFloor(col, floor) {
    let best = -0.55;
    for (const l of this.ledges) {
      if (!l.gone && l.type !== 'box' && l.floor <= floor + 0.12 && Math.abs(colDist(col, l.col + 0.5)) < 0.66) {
        if (l.floor > best) best = l.floor;
      }
    }
    for (const el of this.elevators) {
      if (el.floor <= floor + 0.15 && Math.abs(colDist(col, el.col + 0.5)) < 0.64) {
        if (el.floor > best) best = el.floor;
      }
    }
    return best;
  }

  _findLedgeAt(col, floor) {
    return this.ledges.find(
      (l) => !l.gone && l.type !== 'box' && Math.abs(l.floor - floor) < 0.12 && Math.abs(colDist(col, l.col + 0.5)) < 0.66
    );
  }

  _findLedgeLanding(col, prevFloor, nextFloor, dropThrough = null) {
    return this.ledges.find(
      (l) =>
        !l.gone &&
        l.type !== 'box' &&
        (dropThrough == null || l.floor < dropThrough - 0.05) &&
        prevFloor >= l.floor - 0.15 &&
        nextFloor <= l.floor + 0.05 &&
        Math.abs(colDist(col, l.col + 0.5)) < 0.66
    );
  }

  _updateCamera(dt) {
    const p = this.player;
    // Horizontal: follow with a small lead in the walking direction so you see what's coming.
    const lead = Math.max(-0.6, Math.min(0.6, p.vx * 0.12));
    const d = colDist(this.camCol, p.col + lead);
    this.camCol = wrapCol(this.camCol + d * Math.min(1, dt * 9));

    // Vertical: anchor to the last floor stood on, so ordinary hops don't bob the whole screen.
    // Follow immediately when falling below it or after landing somewhere new.
    if (p.onGround || p.hidden) {
      this.camAnchor = p.floor;
    }
    let focus = this.camAnchor;
    if (!p.onGround && !p.hidden) {
      if (p.floor < this.camAnchor) focus = p.floor;
      else focus = this.camAnchor + (p.floor - this.camAnchor) * 0.3;
    }
    const targetFloor = Math.max(2, focus + 1.0);
    const rate = targetFloor < this.camFloor ? 6.5 : 4.5;
    this.camFloor += (targetFloor - this.camFloor) * Math.min(1, dt * rate);
  }

  _loseLife(reason) {
    this.lives -= 1;
    this.input.haptic(60);
    if (this.lives <= 0) {
      this.mode = 'gameover';
      this._syncHud();
      this.cb.onGameOver?.(false, this.score, this.hiScore);
      return;
    }
    this.cb.onBanner?.(reason, `${this.lives} ${this.lives === 1 ? 'LIFE' : 'LIVES'} LEFT`);
    // Reset timer if time ran out, otherwise respawn at safe ledge
    if (this.timer <= 0) {
      this.timer = this.tower.timeLimit;
    }
    this.player.col = this.player.safeCol;
    this.player.floor = this.player.safeFloor;
    this.player.vx = 0;
    this.player.vy = 0;
    this.player.onGround = true;
    this.player.onElevator = null;
    this.player.invuln = 1.8;
    this.player.squashX = 1;
    this.player.squashY = 1;
    this.player.coyoteTimer = 0;
    this.player.jumpBufferTimer = 0;
    this.player.knockbackTimer = 0;
    this.player.muzzleFlash = 0;
    this.player.stepUpCooldown = 0;
    this.player.teeter = 0;
    this.player.stunTimer = 0;
    this.player.dropThrough = null;
    this.enemies = this.enemies.filter((e) => !e.spawned);
    this.flyerTimer = 6;
    this.camAnchor = this.player.floor;
    this.comboCount = 0;
    this.comboTimer = 0;
    this.player.landingFloor = this._computeLandingFloor(this.player.col, this.player.floor);
    this._syncHud();
  }

  _triggerTowerTopple() {
    this.mode = 'topple';
    this.topple = { active: true, progress: 0, duration: 2.6 };
    const timeBonus = Math.ceil(this.timer) * 10;
    this.addScore(500 + timeBonus);
    this.addShake(12);
    this.addPopup({ col: this.player.col, floor: this.player.floor + 1.2, text: `+${500 + timeBonus}`, color: '#fbbf24', maxLife: 1.3 });
    sound.towerTopple();
    this.input.haptic([30, 40, 60]);
    this.cb.onBanner?.('TOWER TOPPLED!', `+${500 + timeBonus} BONUS`);
  }

  _updateTopple(dt) {
    this.topple.progress += dt / this.topple.duration;
    this.shake = Math.max(this.shake, 5 * (1 - this.topple.progress));
    if (Math.random() < 0.45) {
      this._spawnParticles(
        this.renderer.width * (0.3 + Math.random() * 0.4),
        this.renderer.height * (0.25 + Math.random() * 0.45),
        this.tower.palette.ledge,
        4,
        110
      );
    }
    if (this.topple.progress >= 1) {
      if (this.towerIndex >= this.towers.length - 1) {
        this.mode = 'victory';
        this.cb.onGameOver?.(true, this.score, this.hiScore);
      } else {
        this.startSubmarineStage();
      }
    }
  }

  _updateSubmarine(dt) {
    const s = this.sub;
    const inp = this.input.state;
    const w = this.renderer.width;
    const h = this.renderer.height;

    s.timer += dt;
    if (s.timer >= s.duration) {
      this.towerIndex += 1;
      this.loadTower(this.towerIndex);
      this.mode = 'tower';
      return;
    }

    // Steer submarine
    const speed = 190;
    if (inp.left) s.x -= speed * dt;
    if (inp.right) s.x += speed * dt;
    if (inp.up) s.y -= speed * dt;
    if (inp.down) s.y += speed * dt;
    s.x = Math.max(36, Math.min(w - 40, s.x));
    s.y = Math.max(54, Math.min(h - 52, s.y));

    if (s.fireCooldown > 0) s.fireCooldown -= dt;
    if ((this.input.consumeJustPressed('fire') || this.input.consumeJustPressed('jump')) && s.fireCooldown <= 0) {
      s.fireCooldown = 0.24;
      s.bubbles.push({ x: s.x + 26, y: s.y, vx: 260 });
      sound.bubble();
    }

    // Spawn alien fish
    s.spawnTimer -= dt;
    if (s.spawnTimer <= 0) {
      s.spawnTimer = 0.7 + Math.random() * 0.7;
      const colors = ['#fbbf24', '#f472b6', '#4ade80', '#38bdf8'];
      s.fish.push({
        x: w + 30,
        y: 65 + Math.random() * (h - 130),
        vx: -(75 + Math.random() * 65),
        color: colors[Math.floor(Math.random() * colors.length)],
        bubbled: false,
        caught: false,
      });
    }

    // Update bubbles
    for (let i = s.bubbles.length - 1; i >= 0; i--) {
      const b = s.bubbles[i];
      b.x += b.vx * dt;
      if (b.x > w + 20) {
        s.bubbles.splice(i, 1);
        continue;
      }
      for (const f of s.fish) {
        if (!f.caught && !f.bubbled && Math.hypot(b.x - f.x, b.y - f.y) < 22) {
          f.bubbled = true;
          f.vx *= 0.35;
          s.bubbles.splice(i, 1);
          sound.stunEnemy();
          break;
        }
      }
    }

    // Update fish & catch bubbled ones
    for (let i = s.fish.length - 1; i >= 0; i--) {
      const f = s.fish[i];
      f.x += f.vx * dt;
      if (f.bubbled) {
        f.y -= 18 * dt;
        if (Math.hypot(s.x - f.x, s.y - f.y) < 32) {
          f.caught = true;
          this._scoreComboHit(250, { x: f.x, y: f.y - 12 }, '#4ade80');
          sound.catchFish();
          this._spawnParticles(f.x, f.y, '#a5f3fc', 10, 90);
          s.fish.splice(i, 1);
          continue;
        }
      }
      if (f.x < -40 || f.y < 30) {
        s.fish.splice(i, 1);
      }
    }
  }

  render() {
    if (this.mode === 'submarine' || (this.mode === 'paused' && this.pausedFrom === 'submarine')) {
      this.renderer.renderSubmarineScene(this);
    } else if (this.tower) {
      this.renderer.renderTowerScene(this);
    }
  }
}
