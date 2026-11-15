import { COLS, createTowers } from './levels.js';
import { sound } from './audio.js';

function wrapCol(c) {
  return ((c % COLS) + COLS) % COLS;
}

function colDist(a, b) {
  let d = wrapCol(b) - wrapCol(a);
  if (d > COLS / 2) d -= COLS;
  if (d < -COLS / 2) d += COLS;
  return d;
}

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
      squashX: 1,
      squashY: 1,
      coyoteTimer: 0,
      jumpBufferTimer: 0,
    };

    this.camCol = 0;
    this.camFloor = 2;

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
    this.topple = { active: false, progress: 0, duration: 2.6 };

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

    this.enemies = t.enemies.map((e) => ({
      ...e,
      baseFloor: e.floor,
      phase: Math.random() * Math.PI * 2,
      stunTimer: 0,
      dead: false,
    }));

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
      squashX: 1,
      squashY: 1,
      coyoteTimer: 0,
      jumpBufferTimer: 0,
    };

    this.camCol = this.player.col;
    this.camFloor = Math.max(2, this.player.floor + 1.5);
    this.cb.onBanner?.(`TOWER ${t.id}`, t.name);
    this._syncHud();
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
    let dirHint = '▲';
    if (exitDoor && this.mode === 'tower') {
      const d = colDist(this.player.col, exitDoor.col + 0.5);
      if (Math.abs(d) < 0.7) dirHint = '▲';
      else dirHint = d > 0 ? '▶' : '◀';
    }
    this.cb.onHud?.({
      score: this.score,
      hiScore: this.hiScore,
      lives: this.lives,
      timer: this.timer,
      towerId: this.tower ? this.tower.id : 1,
      dirHint,
      mode: this.mode,
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

    // Decay screen shake
    if (this.shake > 0) {
      this.shake *= Math.exp(-9 * clampedDt);
      if (this.shake < 0.15) this.shake = 0;
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

    // Horizontal movement
    const moveSpeed = 3.9;
    let targetVx = 0;
    if (inp.left) {
      targetVx = -moveSpeed;
      p.facing = -1;
    } else if (inp.right) {
      targetVx = moveSpeed;
      p.facing = 1;
    }

    if (isIce && p.onGround) {
      p.vx = p.vx * 0.94 + targetVx * 0.08;
    } else {
      p.vx = targetVx + convPush;
    }

    const nextCol = wrapCol(p.col + p.vx * dt);
    // Check horizontal block ('box' type)
    const blockingBox = this.ledges.find(
      (l) => !l.gone && l.type === 'box' && Math.abs(l.floor - p.floor) < 0.6 && Math.abs(colDist(nextCol, l.col + 0.5)) < 0.52
    );
    if (!blockingBox) {
      p.col = nextCol;
    } else {
      p.vx = 0;
    }

    // Door / Exit interaction with UP
    if (this.input.consumeJustPressed('up') && p.onGround) {
      const door = this.tower.doors.find(
        (d) => Math.abs(d.floor - p.floor) < 0.5 && Math.abs(colDist(p.col, d.col + 0.5)) < 0.55
      );
      if (door) {
        if (door.isExit) {
          this._triggerTowerTopple();
          return;
        } else if (door.targetId) {
          const target = this.tower.doors.find((d) => d.id === door.targetId);
          if (target) {
            p.hidden = true;
            p.tunnelTimer = 0.35;
            p.tunnelTarget = target;
            sound.door();
            return;
          }
        }
      }
    }

    // Coyote time (0.11s) & Jump buffering (0.12s)
    if (p.onGround) {
      p.coyoteTimer = 0.11;
    } else {
      p.coyoteTimer = Math.max(0, p.coyoteTimer - dt);
    }

    if (this.input.consumeJustPressed('jump')) {
      p.jumpBufferTimer = 0.12;
    } else {
      p.jumpBufferTimer = Math.max(0, p.jumpBufferTimer - dt);
    }

    // Jump
    if (p.jumpBufferTimer > 0 && (p.onGround || p.coyoteTimer > 0)) {
      p.vy = 6.7;
      p.onGround = false;
      p.onElevator = null;
      p.coyoteTimer = 0;
      p.jumpBufferTimer = 0;
      p.squashX = 0.76;
      p.squashY = 1.28;
      sound.jump();
    }

    // Fire Snowball (or recall nearby elevator!)
    if (this.input.consumeJustPressed('fire') && p.fireCooldown <= 0) {
      p.fireCooldown = 0.25;
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
        p.floor = el.floor;
        p.vy = 0;
        p.onGround = true;
      }
    }

    if (!p.onElevator) {
      const prevFloor = p.floor;
      p.vy -= 17.5 * dt;
      p.floor += p.vy * dt;
      p.onGround = false;

      // Landing on ledges (when falling)
      if (p.vy <= 0) {
        const landed = this._findLedgeLanding(p.col, prevFloor, p.floor);
        if (landed) {
          p.floor = landed.floor;
          p.vy = 0;
          p.onGround = true;
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
              Math.abs(colDist(p.col, el.col + 0.5)) < 0.62 &&
              prevFloor >= el.floor - 0.25 &&
              p.floor <= el.floor + 0.15
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
        this.addScore(50);
        this.addShake(3.5);
        this.addPopup({ col: box.col + 0.5, floor: box.floor + 0.5, text: '+50', color: '#fde047' });
        const pos = this._colFloorToScreen(box.col + 0.5, box.floor + 0.3, 12);
        if (pos) this._spawnParticles(pos.x, pos.y, '#bae6fd', 8, 95);
        sound.hitEnemy();
        this.snowballs.splice(i, 1);
        continue;
      }

      // Check enemy hit
      let hit = false;
      for (const en of this.enemies) {
        if (en.dead) continue;
        if (Math.abs(en.floor - sb.floor) < 0.65 && Math.abs(colDist(sb.col, en.col)) < 0.55) {
          hit = true;
          const pos = this._colFloorToScreen(en.col, en.floor + 0.3, 14);
          if (en.type === 'roller') {
            en.dead = true;
            this.addScore(100);
            this.addShake(4.0);
            this.addPopup({ col: en.col, floor: en.floor + 0.5, text: '+100', color: '#38bdf8' });
            if (pos) this._spawnParticles(pos.x, pos.y, '#67e8f9', 10, 110);
            sound.hitEnemy();
          } else if (en.type === 'bouncer') {
            en.stunTimer = 3.0;
            this.addScore(50);
            this.addShake(2.2);
            this.addPopup({ col: en.col, floor: en.floor + 0.5, text: '+50', color: '#a7f3d0' });
            if (pos) this._spawnParticles(pos.x, pos.y, '#a7f3d0', 7, 80);
            sound.stunEnemy();
          } else {
            // Indestructible molecule / eye
            this.addShake(1.5);
            if (pos) this._spawnParticles(pos.x, pos.y, '#e0f2fe', 5, 65);
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
    for (const en of this.enemies) {
      if (en.dead) continue;
      if (en.stunTimer > 0) {
        en.stunTimer = Math.max(0, en.stunTimer - dt);
        continue;
      }

      en.col = wrapCol(en.col + en.dir * en.speed * dt);
      if (en.type === 'molecule') {
        en.floor = en.baseFloor + Math.sin(this.time * 3 + en.phase) * (en.amp || 0.4);
      } else if (en.type === 'bouncer') {
        en.floor = en.baseFloor + Math.abs(Math.sin(this.time * 4.5 + en.phase)) * 0.65;
      }

      // Player collision
      if (
        p.invuln <= 0 &&
        Math.abs(en.floor - p.floor) < 0.55 &&
        Math.abs(colDist(en.col, p.col)) < 0.52
      ) {
        sound.hurt();
        this.addShake(9);
        this.input.haptic(40);
        p.invuln = 1.6;
        p.vy = 4.2;
        p.onGround = false;
        p.onElevator = null;
        p.coyoteTimer = 0;
        p.squashX = 1.25;
        p.squashY = 0.78;
        p.vx = (colDist(en.col, p.col) >= 0 ? 1 : -1) * 3.5;
      }
    }

    this._updateCamera(dt);
    this._syncHud();
  }

  _findLedgeAt(col, floor) {
    return this.ledges.find(
      (l) => !l.gone && l.type !== 'box' && Math.abs(l.floor - floor) < 0.12 && Math.abs(colDist(col, l.col + 0.5)) < 0.56
    );
  }

  _findLedgeLanding(col, prevFloor, nextFloor) {
    return this.ledges.find(
      (l) =>
        !l.gone &&
        l.type !== 'box' &&
        prevFloor >= l.floor - 0.15 &&
        nextFloor <= l.floor + 0.05 &&
        Math.abs(colDist(col, l.col + 0.5)) < 0.56
    );
  }

  _updateCamera(dt) {
    const d = colDist(this.camCol, this.player.col);
    this.camCol = wrapCol(this.camCol + d * Math.min(1, dt * 12));
    const targetFloor = Math.max(2, this.player.floor + 1.2);
    this.camFloor += (targetFloor - this.camFloor) * Math.min(1, dt * 7);
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
          this.addScore(250);
          this.addPopup({ x: f.x, y: f.y - 12, text: '+250', color: '#4ade80' });
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
