import { COLS } from './levels.js';

const TWO_PI = Math.PI * 2;
const COL_ANGLE = TWO_PI / COLS;

function wrapAngle(a) {
  let res = a % TWO_PI;
  if (res > Math.PI) res -= TWO_PI;
  if (res < -Math.PI) res += TWO_PI;
  return res;
}

function shadeColor(hex, factor) {
  const num = parseInt(hex.replace('#', ''), 16);
  const r = Math.min(255, Math.max(0, Math.round(((num >> 16) & 255) * factor)));
  const g = Math.min(255, Math.max(0, Math.round(((num >> 8) & 255) * factor)));
  const b = Math.min(255, Math.max(0, Math.round((num & 255) * factor)));
  return `rgb(${r},${g},${b})`;
}

function hexToRgba(hex, alpha) {
  const num = parseInt(hex.replace('#', ''), 16);
  const r = (num >> 16) & 255;
  const g = (num >> 8) & 255;
  const b = num & 255;
  return `rgba(${r},${g},${b},${alpha})`;
}

function getShakeOffset(shake, time) {
  if (!shake) return { x: 0, y: 0 };
  if (typeof shake === 'object') {
    return { x: shake.x || 0, y: shake.y || 0 };
  }
  const mag = Number(shake) || 0;
  if (mag <= 0.05) return { x: 0, y: 0 };
  return {
    x: Math.sin(time * 73.7) * mag,
    y: Math.cos(time * 61.3) * mag * 0.85,
  };
}

export class GameRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.width = 360;
    this.height = 540;

    // Multi-layer parallax starfield
    this.stars = Array.from({ length: 85 }, (_, i) => {
      const layer = i % 3; // 0: far, 1: mid, 2: near
      return {
        x: Math.random(),
        y: Math.random() * 0.82,
        r: layer === 0 ? 0.6 + Math.random() * 0.6 : layer === 1 ? 0.9 + Math.random() * 0.9 : 1.3 + Math.random() * 1.1,
        layer,
        twinkle: Math.random() * TWO_PI,
        speed: 1.5 + Math.random() * 2.5,
        tint: i % 7 === 0 ? '#a5f3fc' : i % 11 === 0 ? '#f5d0fe' : '#e0f2fe',
      };
    });

    // Distant horizon spire silhouettes
    this.horizonSpires = Array.from({ length: 18 }, (_, i) => ({
      u: i / 18,
      w: 0.04 + (i % 4) * 0.018,
      h: 22 + ((i * 37) % 48),
      type: i % 3,
    }));

    // Topple debris chunks (deterministic pool)
    this.debrisChunks = Array.from({ length: 26 }, (_, i) => ({
      seed: i * 1.618,
      rx: ((i % 9) - 4) * 0.24,
      speedY: 0.6 + (i % 5) * 0.28,
      rotSpeed: ((i % 2 === 0 ? 1 : -1) * (2.5 + (i % 4) * 1.4)),
      size: 6 + (i % 4) * 3,
    }));
  }

  resize(w, h, dpr = 1) {
    this.width = w;
    this.height = h;
    this.canvas.width = Math.floor(w * dpr);
    this.canvas.height = Math.floor(h * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  renderTowerScene(state) {
    const { ctx, width, height } = this;
    const { tower, player, camCol, camFloor, time, particles, snowballs, topple } = state;
    const pal = tower.palette;
    const shake = getShakeOffset(state.shake, time);

    ctx.save();
    ctx.translate(shake.x, shake.y);

    // 1. Parallax Nebulus Sky
    this._drawNebulusSky(ctx, width, height, camCol, time, pal);

    // Geometry constants
    const toppleShake = topple.active ? Math.sin(time * 46) * 6 * (1 - topple.progress) : 0;
    const centerX = width * 0.5 + toppleShake;
    const radius = Math.min(width * 0.33, 132);
    const floorPx = 42;
    const playerScreenY = height * 0.56;
    const toppleDrop = topple.active ? topple.progress * tower.floors * floorPx * 1.15 : 0;

    const floorToY = (f) => playerScreenY - (f - camFloor) * floorPx + toppleDrop;

    // 2. True 3D Cylindrical Tower Body
    const towerTopY = Math.max(-40, floorToY(tower.floors));
    const seaY = Math.min(height - 36, floorToY(-0.55));
    const towerBottomY = Math.max(towerTopY, Math.min(height, seaY + 24));

    if (towerBottomY > towerTopY) {
      this._drawTowerCylinder(
        ctx,
        tower,
        pal,
        centerX,
        radius,
        towerTopY,
        towerBottomY,
        camCol,
        camFloor,
        floorToY,
        time,
        height
      );
    }

    // 3. Doors & Tunnels (Recessed into the cylinder)
    this._drawDoors(ctx, tower.doors, pal, centerX, radius, camCol, floorToY, time, height);

    // 4. Elevator Shafts & Platforms
    this._drawElevators(ctx, state.elevators, pal, centerX, radius, camCol, floorToY, time, height);

    // 5. 3D-Extruded Ledges & Boxes
    this._drawLedges(ctx, state.ledges, pal, centerX, radius, camCol, floorToY, time, height);

    // 6. AAA Enemies
    this._drawEnemies(ctx, state.enemies, centerX, radius, camCol, floorToY, time, height);

    // 7. Snowball Projectiles with Icy Trail
    this._drawSnowballs(ctx, snowballs, centerX, radius, camCol, floorToY, time);

    // 8. Expressive Pogo Character
    if (!player.hidden && !topple.active) {
      this._drawPogo(ctx, player, centerX, floorToY(player.floor), time);
    }

    // 9. Dramatic Tower Topple Debris
    if (topple.active) {
      this._drawToppleDebris(ctx, pal, centerX, radius, seaY, towerTopY, topple.progress, time);
    }

    // 10. Glowing Water Reflections & Multi-Layer Toxic Alien Ocean
    this._drawToxicOcean(ctx, width, height, centerX, radius, seaY, pal, time);

    // 11. Particles
    this._drawParticles(ctx, particles);

    // 12. Floating Score & Event Popups
    if (state.popups && state.popups.length > 0) {
      this._drawPopups(ctx, state.popups, centerX, radius, camCol, floorToY);
    }

    // 13. Subtle Screen Vignette
    const vig = ctx.createRadialGradient(
      width * 0.5,
      height * 0.48,
      Math.min(width, height) * 0.34,
      width * 0.5,
      height * 0.5,
      Math.max(width, height) * 0.78
    );
    vig.addColorStop(0, 'rgba(0,0,0,0)');
    vig.addColorStop(1, 'rgba(2,6,18,0.42)');
    ctx.fillStyle = vig;
    ctx.fillRect(-20, -20, width + 40, height + 40);

    ctx.restore();
  }

  _drawNebulusSky(ctx, width, height, camCol, time, pal) {
    // Deep space gradient
    const skyGrad = ctx.createLinearGradient(0, 0, 0, height);
    skyGrad.addColorStop(0, '#02040d');
    skyGrad.addColorStop(0.45, '#061128');
    skyGrad.addColorStop(0.78, '#0b2240');
    skyGrad.addColorStop(1, '#102e4a');
    ctx.fillStyle = skyGrad;
    ctx.fillRect(-16, -16, width + 32, height + 32);

    // Parallax Alien Nebula Clouds
    const nebShift = ((camCol / COLS) * width * 0.25) % width;
    const nebulae = [
      { x: 0.24, y: 0.22, r: width * 0.42, c1: hexToRgba(pal.glow, 0.14), c2: 'rgba(139, 92, 246, 0)' },
      { x: 0.76, y: 0.34, r: width * 0.38, c1: 'rgba(236, 72, 153, 0.10)', c2: 'rgba(236, 72, 153, 0)' },
      { x: 0.52, y: 0.15, r: width * 0.34, c1: 'rgba(34, 211, 238, 0.09)', c2: 'rgba(34, 211, 238, 0)' },
    ];
    for (let i = 0; i < nebulae.length; i++) {
      const n = nebulae[i];
      const nx = (((n.x * width - nebShift * (0.4 + i * 0.15)) % width) + width) % width;
      const ny = n.y * height + Math.sin(time * 0.3 + i) * 6;
      const g = ctx.createRadialGradient(nx, ny, 4, nx, ny, n.r);
      g.addColorStop(0, n.c1);
      g.addColorStop(1, n.c2);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(nx, ny, n.r, 0, TWO_PI);
      ctx.fill();
    }

    // Twinkling Multi-Size Parallax Stars
    for (const s of this.stars) {
      const parallax = s.layer === 0 ? 0.06 : s.layer === 1 ? 0.14 : 0.24;
      const sx = (((s.x * width - (camCol / COLS) * width * parallax) % width) + width) % width;
      const sy = s.y * height;
      const alpha = 0.28 + 0.65 * (0.5 + 0.5 * Math.sin(time * s.speed + s.twinkle));
      ctx.fillStyle = s.tint;
      ctx.globalAlpha = alpha;
      ctx.beginPath();
      ctx.arc(sx, sy, s.r, 0, TWO_PI);
      ctx.fill();

      // Subtle cross-flare on bright near stars
      if (s.layer === 2 && alpha > 0.75) {
        ctx.globalAlpha = (alpha - 0.75) * 1.4;
        ctx.fillRect(sx - s.r * 2.2, sy - 0.4, s.r * 4.4, 0.8);
        ctx.fillRect(sx - 0.4, sy - s.r * 2.2, 0.8, s.r * 4.4);
      }
    }
    ctx.globalAlpha = 1;

    // Distant Nebulus Ringed Planet / Moon
    const moonX = (((width * 0.82 - (camCol / COLS) * width * 0.12) % (width + 80)) + width + 80) % (width + 80) - 40;
    const moonY = height * 0.15;
    ctx.save();
    const moonHalo = ctx.createRadialGradient(moonX, moonY, 8, moonX, moonY, 44);
    moonHalo.addColorStop(0, 'rgba(186, 230, 253, 0.95)');
    moonHalo.addColorStop(0.32, 'rgba(56, 189, 248, 0.42)');
    moonHalo.addColorStop(0.65, 'rgba(56, 189, 248, 0.12)');
    moonHalo.addColorStop(1, 'rgba(56, 189, 248, 0)');
    ctx.fillStyle = moonHalo;
    ctx.beginPath();
    ctx.arc(moonX, moonY, 44, 0, TWO_PI);
    ctx.fill();

    // Planet body
    const bodyGrad = ctx.createLinearGradient(moonX - 14, moonY - 14, moonX + 14, moonY + 14);
    bodyGrad.addColorStop(0, '#e0f2fe');
    bodyGrad.addColorStop(0.55, '#38bdf8');
    bodyGrad.addColorStop(1, '#0c4a6e');
    ctx.fillStyle = bodyGrad;
    ctx.beginPath();
    ctx.arc(moonX, moonY, 15, 0, TWO_PI);
    ctx.fill();

    // Tilted planetary ring
    ctx.strokeStyle = 'rgba(186, 230, 253, 0.48)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(moonX, moonY, 27, 6.5, -0.28, 0, TWO_PI);
    ctx.stroke();
    ctx.restore();

    // Distant Horizon Silhouette (Alien Spires)
    const horizonY = height * 0.82;
    const spireShift = ((camCol / COLS) * width * 0.35) % width;
    ctx.fillStyle = 'rgba(5, 16, 36, 0.85)';
    ctx.beginPath();
    ctx.moveTo(-16, height);
    for (const sp of this.horizonSpires) {
      const sx = (((sp.u * width - spireShift) % width) + width) % width;
      const sw = sp.w * width;
      ctx.lineTo(sx - sw * 0.5, horizonY);
      if (sp.type === 0) {
        ctx.lineTo(sx, horizonY - sp.h);
      } else {
        ctx.lineTo(sx - sw * 0.18, horizonY - sp.h);
        ctx.lineTo(sx + sw * 0.18, horizonY - sp.h * 0.88);
      }
      ctx.lineTo(sx + sw * 0.5, horizonY);
    }
    ctx.lineTo(width + 16, horizonY);
    ctx.lineTo(width + 16, height);
    ctx.closePath();
    ctx.fill();
  }

  _drawTowerCylinder(ctx, tower, pal, centerX, radius, towerTopY, towerBottomY, camCol, camFloor, floorToY, time, height) {
    const minFloorVis = Math.max(0, Math.floor(camFloor - 7));
    const maxFloorVis = Math.min(tower.floors - 1, Math.ceil(camFloor + 9));

    // Recessed mortar backdrop
    ctx.fillStyle = pal.mortar;
    ctx.fillRect(centerX - radius, towerTopY, radius * 2, towerBottomY - towerTopY);

    // Beveled 3D bricks
    for (let f = minFloorVis; f <= maxFloorVis; f++) {
      const yTop = floorToY(f + 1);
      const yBot = floorToY(f);
      const h = yBot - yTop;
      if (yBot < -4 || yTop > height + 4) continue;

      const rowOffset = (f % 2) * 0.5;
      for (let c = 0; c < COLS; c++) {
        const a0 = wrapAngle((c + rowOffset - camCol) * COL_ANGLE);
        const a1 = wrapAngle((c + 1 + rowOffset - camCol) * COL_ANGLE);
        if (Math.abs(a0) > Math.PI * 0.58 && Math.abs(a1) > Math.PI * 0.58) continue;
        const ca0 = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, a0));
        const ca1 = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, a1));
        if (ca1 <= ca0) continue;

        const x0 = centerX + radius * Math.sin(ca0);
        const x1 = centerX + radius * Math.sin(ca1);
        const w = x1 - x0;
        if (w <= 0.6) continue;

        const midA = (ca0 + ca1) * 0.5;
        const cosA = Math.cos(midA);
        const light = 0.34 + 0.72 * cosA;
        const baseColor = (c + f) % 2 === 0 ? pal.brickA : pal.brickB;

        const bx = x0 + 0.7;
        const by = yTop + 0.9;
        const bw = Math.max(0, w - 1.4);
        const bh = Math.max(0, h - 1.8);

        ctx.fillStyle = shadeColor(baseColor, light);
        ctx.fillRect(bx, by, bw, bh);

        // Top & left highlight bevel
        if (bw > 3 && bh > 4) {
          ctx.fillStyle = `rgba(255,255,255,${(0.16 * cosA).toFixed(2)})`;
          ctx.fillRect(bx, by, bw, 2);
          ctx.fillRect(bx, by, 1.5, bh);

          // Bottom & right shadow bevel
          ctx.fillStyle = 'rgba(0,0,0,0.30)';
          ctx.fillRect(bx, by + bh - 2, bw, 2);
          ctx.fillRect(bx + bw - 1.5, by, 1.5, bh);
        }
      }
    }

    // Glowing Vertical Energy Conduits (4 evenly spaced around cylinder)
    for (let k = 0; k < 4; k++) {
      const conduitCol = k * 4;
      const theta = wrapAngle((conduitCol - camCol) * COL_ANGLE);
      if (Math.abs(theta) > Math.PI * 0.49) continue;
      const cx = centerX + radius * Math.sin(theta);
      const cw = Math.max(2, 6 * Math.cos(theta));

      ctx.fillStyle = 'rgba(4, 10, 24, 0.75)';
      ctx.fillRect(cx - cw * 0.5, towerTopY, cw, towerBottomY - towerTopY);

      const pulse = 0.55 + 0.45 * Math.sin(time * 4 + k);
      ctx.fillStyle = hexToRgba(pal.glow, (0.55 * pulse * Math.cos(theta)).toFixed(2));
      ctx.fillRect(cx - cw * 0.22, towerTopY, Math.max(1, cw * 0.44), towerBottomY - towerTopY);

      // Animated rising energy nodes
      const nodeY = towerBottomY - (((time * 90 + k * 85) % Math.max(40, towerBottomY - towerTopY)));
      ctx.fillStyle = '#ffffff';
      ctx.globalAlpha = 0.7 * Math.cos(theta);
      ctx.fillRect(cx - cw * 0.35, nodeY, cw * 0.7, 5);
      ctx.globalAlpha = 1;
    }

    // Battlement / Crown at the top of the tower
    if (towerTopY > -30 && towerTopY < height) {
      ctx.fillStyle = shadeColor(pal.ledge, 0.78);
      ctx.fillRect(centerX - radius - 3, towerTopY - 8, radius * 2 + 6, 8);
      ctx.fillStyle = pal.ledgeTop;
      ctx.fillRect(centerX - radius - 3, towerTopY - 8, radius * 2 + 6, 2.5);
      ctx.fillStyle = hexToRgba(pal.glow, 0.55);
      ctx.fillRect(centerX - radius - 3, towerTopY - 2, radius * 2 + 6, 2);
    }

    // Cylindrical Rim Lighting & Specular Shading
    const rimGrad = ctx.createLinearGradient(centerX - radius, 0, centerX + radius, 0);
    rimGrad.addColorStop(0, 'rgba(0,0,0,0.52)');
    rimGrad.addColorStop(0.06, hexToRgba(pal.glow, 0.16));
    rimGrad.addColorStop(0.22, 'rgba(255,255,255,0.05)');
    rimGrad.addColorStop(0.46, 'rgba(255,255,255,0.14)');
    rimGrad.addColorStop(0.78, 'rgba(0,0,0,0.08)');
    rimGrad.addColorStop(0.94, hexToRgba(pal.glow, 0.16));
    rimGrad.addColorStop(1, 'rgba(0,0,0,0.52)');
    ctx.fillStyle = rimGrad;
    ctx.fillRect(centerX - radius, towerTopY, radius * 2, towerBottomY - towerTopY);
  }

  _drawDoors(ctx, doors, pal, centerX, radius, camCol, floorToY, time, height) {
    for (const door of doors) {
      const theta = wrapAngle((door.col + 0.5 - camCol) * COL_ANGLE);
      if (Math.abs(theta) > Math.PI * 0.5) continue;
      const x = centerX + radius * Math.sin(theta);
      const y = floorToY(door.floor);
      const cosT = Math.cos(theta);
      const dw = 24 * cosT;
      const dh = 33;
      if (y < -40 || y > height + 40) continue;

      ctx.save();
      // Outer recessed frame
      ctx.fillStyle = '#02040a';
      ctx.beginPath();
      ctx.roundRect(x - dw * 0.5, y - dh, dw, dh, [dw * 0.45, dw * 0.45, 2, 2]);
      ctx.fill();

      ctx.lineWidth = 2.2;
      if (door.isExit) {
        const pulse = 0.65 + 0.35 * Math.sin(time * 6);
        const portalGrad = ctx.createLinearGradient(x, y - dh, x, y);
        portalGrad.addColorStop(0, `rgba(253, 224, 71, ${0.45 * pulse})`);
        portalGrad.addColorStop(1, `rgba(245, 158, 11, ${0.18 * pulse})`);
        ctx.fillStyle = portalGrad;
        ctx.fill();
        ctx.strokeStyle = `rgba(255, 215, 0, ${pulse})`;
        ctx.stroke();

        ctx.fillStyle = '#fef08a';
        ctx.font = 'bold 10px sans-serif';
        ctx.textAlign = 'center';
        ctx.shadowColor = '#f59e0b';
        ctx.shadowBlur = 8;
        ctx.fillText('EXIT', x, y - dh - 6);
        ctx.shadowBlur = 0;
      } else {
        ctx.strokeStyle = pal.glow;
        ctx.stroke();
        // Inner tunnel depth lines
        ctx.strokeStyle = hexToRgba(pal.glow, 0.28);
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect(x - dw * 0.32, y - dh + 4, dw * 0.64, dh - 6, [dw * 0.3, dw * 0.3, 1, 1]);
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  _drawElevators(ctx, elevators, pal, centerX, radius, camCol, floorToY, time, height) {
    for (const el of elevators) {
      const theta = wrapAngle((el.col + 0.5 - camCol) * COL_ANGLE);
      if (Math.abs(theta) > Math.PI * 0.52) continue;
      const x = centerX + radius * 1.04 * Math.sin(theta);
      const yMin = floorToY(el.maxFloor);
      const yMax = floorToY(el.minFloor);
      const yCur = floorToY(el.floor);
      if (yMax < -20 || yMin > height + 20) continue;
      const cosT = Math.cos(theta);
      const w = Math.max(10, 30 * cosT);

      // Dual shaft rails
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.35)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x - w * 0.28, yMin - 8);
      ctx.lineTo(x - w * 0.28, yMax + 6);
      ctx.moveTo(x + w * 0.28, yMin - 8);
      ctx.lineTo(x + w * 0.28, yMax + 6);
      ctx.stroke();

      // Anti-grav thruster glow below platform
      const glowGrad = ctx.createRadialGradient(x, yCur + 10, 1, x, yCur + 10, w * 0.65);
      glowGrad.addColorStop(0, 'rgba(56, 189, 248, 0.55)');
      glowGrad.addColorStop(1, 'rgba(56, 189, 248, 0)');
      ctx.fillStyle = glowGrad;
      ctx.fillRect(x - w * 0.65, yCur + 6, w * 1.3, 14);

      // 3D Moving platform
      ctx.fillStyle = '#0284c7';
      ctx.fillRect(x - w * 0.55, yCur + 3, w * 1.1, 6);
      ctx.fillStyle = '#e0f2fe';
      ctx.fillRect(x - w * 0.55, yCur, w * 1.1, 3.5);
    }
  }

  _drawLedges(ctx, ledges, pal, centerX, radius, camCol, floorToY, time, height) {
    const ledgeRadius = radius * 1.13;
    const ledgesToDraw = [];
    for (const l of ledges) {
      if (l.gone) continue;
      const theta = wrapAngle((l.col + 0.5 - camCol) * COL_ANGLE);
      if (Math.abs(theta) > Math.PI * 0.58) continue;
      ledgesToDraw.push({ l, theta, depth: Math.cos(theta) });
    }
    // Sort back-to-front by depth
    ledgesToDraw.sort((a, b) => a.depth - b.depth);

    for (const { l, theta, depth } of ledgesToDraw) {
      const y = floorToY(l.floor) + (l.shake ? Math.sin(time * 55) * 2.2 : 0);
      if (y < -28 || y > height + 28) continue;

      const a0 = theta - COL_ANGLE * 0.48;
      const a1 = theta + COL_ANGLE * 0.48;
      const x0 = centerX + ledgeRadius * Math.sin(a0);
      const x1 = centerX + ledgeRadius * Math.sin(a1);
      const w = Math.max(4, x1 - x0);
      const light = 0.44 + 0.56 * Math.max(0, depth);

      if (l.type === 'box') {
        // 3D Flashing Destructible Box
        const pulse = 0.5 + 0.5 * Math.sin(time * 10);
        const bx = x0;
        const by = y - 22;
        const bh = 22;

        // Shadow under box
        ctx.fillStyle = 'rgba(0,0,0,0.35)';
        ctx.fillRect(bx + 2, y, w - 2, 4);

        ctx.fillStyle = pulse > 0.5 ? '#facc15' : '#f97316';
        ctx.fillRect(bx, by, w, bh);
        // Top bevel
        ctx.fillStyle = 'rgba(255,255,255,0.45)';
        ctx.fillRect(bx, by, w, 3);
        // Inner X-brace
        ctx.strokeStyle = 'rgba(124, 45, 18, 0.75)';
        ctx.lineWidth = 1.6;
        ctx.strokeRect(bx + 1, by + 1, w - 2, bh - 2);
        ctx.beginPath();
        ctx.moveTo(bx + 2, by + 2);
        ctx.lineTo(bx + w - 2, by + bh - 2);
        ctx.moveTo(bx + w - 2, by + 2);
        ctx.lineTo(bx + 2, by + bh - 2);
        ctx.stroke();
        continue;
      }

      let bodyCol = pal.ledge;
      let topCol = pal.ledgeTop;
      if (l.type === 'crumble') {
        bodyCol = l.crumbling ? '#dc2626' : '#d97706';
        topCol = l.crumbling ? '#fca5a5' : '#fde047';
      } else if (l.type === 'ice') {
        bodyCol = '#38bdf8';
        topCol = '#f0f9ff';
      } else if (l.type === 'conveyorR' || l.type === 'conveyorL') {
        bodyCol = '#9333ea';
        topCol = '#f0abfc';
      }

      // 1) Underside drop shadow
      ctx.fillStyle = 'rgba(2, 6, 18, 0.45)';
      ctx.fillRect(x0 + 1, y + 10, w - 1, 5);

      // 2) Front extruded thickness
      ctx.fillStyle = shadeColor(bodyCol, light * 0.85);
      ctx.fillRect(x0, y + 3, w, 8);

      // 3) Top 3D face
      ctx.fillStyle = shadeColor(topCol, light);
      ctx.fillRect(x0, y, w, 4);

      // 4) Bottom edge shadow
      ctx.fillStyle = 'rgba(0,0,0,0.32)';
      ctx.fillRect(x0, y + 9.5, w, 1.5);

      // Type-specific surface details
      if (l.type === 'crumble') {
        ctx.strokeStyle = 'rgba(30, 10, 5, 0.7)';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(x0 + w * 0.25, y + 1);
        ctx.lineTo(x0 + w * 0.4, y + 6);
        ctx.lineTo(x0 + w * 0.33, y + 10);
        ctx.moveTo(x0 + w * 0.72, y + 2);
        ctx.lineTo(x0 + w * 0.62, y + 8);
        ctx.stroke();
      } else if (l.type === 'ice') {
        // Crystalline sheen
        ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
        ctx.beginPath();
        ctx.moveTo(x0 + w * 0.2, y + 1);
        ctx.lineTo(x0 + w * 0.38, y + 1);
        ctx.lineTo(x0 + w * 0.26, y + 10);
        ctx.lineTo(x0 + w * 0.12, y + 10);
        ctx.closePath();
        ctx.fill();
      } else if (l.type === 'conveyorR' || l.type === 'conveyorL') {
        // Animated scrolling chevrons
        const dir = l.type === 'conveyorR' ? 1 : -1;
        const shift = (((time * 26 * dir) % 10) + 10) % 10;
        ctx.save();
        ctx.beginPath();
        ctx.rect(x0 + 1, y + 3, Math.max(0, w - 2), 8);
        ctx.clip();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.4;
        for (let cx = x0 - 10 + shift; cx < x1 + 10; cx += 10) {
          ctx.beginPath();
          ctx.moveTo(cx - 2 * dir, y + 4.5);
          ctx.lineTo(cx + 2 * dir, y + 7);
          ctx.lineTo(cx - 2 * dir, y + 9.5);
          ctx.stroke();
        }
        ctx.restore();
      }
    }
  }

  _drawEnemies(ctx, enemies, centerX, radius, camCol, floorToY, time, height) {
    for (const en of enemies) {
      if (en.dead) continue;
      const theta = wrapAngle((en.col - camCol) * COL_ANGLE);
      if (Math.abs(theta) > Math.PI * 0.55) continue;
      const er = radius * 1.11;
      const x = centerX + er * Math.sin(theta);
      const y = floorToY(en.floor) - 13;
      if (y < -40 || y > height + 40) continue;
      const scale = 0.65 + 0.35 * Math.max(0, Math.cos(theta));

      ctx.save();
      ctx.translate(x, y);
      ctx.scale(scale, scale);

      if (en.stunTimer > 0) {
        ctx.globalAlpha = 0.55 + 0.4 * Math.sin(time * 26);
      }

      if (en.type === 'molecule') {
        // Orbiting energy ring
        ctx.strokeStyle = 'rgba(103, 232, 249, 0.4)';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.ellipse(0, 0, 13, 6, time * 2, 0, TWO_PI);
        ctx.stroke();

        const rot = time * 4.2 * (en.dir || 1);
        const colors = ['#ff2a85', '#fbbf24', '#00f0ff'];
        for (let i = 0; i < 3; i++) {
          const ang = rot + (i * TWO_PI) / 3;
          const ax = Math.cos(ang) * 7.5;
          const ay = Math.sin(ang) * 7.5;
          ctx.fillStyle = colors[i];
          ctx.shadowColor = colors[i];
          ctx.shadowBlur = 6;
          ctx.beginPath();
          ctx.arc(ax, ay, 5.2, 0, TWO_PI);
          ctx.fill();
          ctx.shadowBlur = 0;
          ctx.fillStyle = 'rgba(255,255,255,0.75)';
          ctx.beginPath();
          ctx.arc(ax - 1.5, ay - 1.5, 1.5, 0, TWO_PI);
          ctx.fill();
        }
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(0, 0, 4, 0, TWO_PI);
        ctx.fill();
      } else if (en.type === 'roller') {
        // Armored rolling cannonball
        const grad = ctx.createRadialGradient(-3, -3, 1, 0, 0, 11);
        grad.addColorStop(0, '#fed7aa');
        grad.addColorStop(0.45, '#f97316');
        grad.addColorStop(1, '#7c2d12');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(0, 0, 10.5, 0, TWO_PI);
        ctx.fill();

        // Rotating armor seam
        const spin = time * 8 * (en.dir || 1);
        ctx.strokeStyle = '#fef08a';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(0, 0, 6.2, spin, spin + Math.PI * 0.85);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(0, 0, 6.2, spin + Math.PI, spin + Math.PI * 1.85);
        ctx.stroke();
      } else if (en.type === 'bouncer') {
        // Hopping bouncer with squash
        const hop = Math.sin(time * 9 + (en.phase || 0));
        const bsx = 1 - hop * 0.14;
        const bsy = 1 + hop * 0.14;
        ctx.scale(bsx, bsy);

        const bGrad = ctx.createRadialGradient(-3, -4, 1, 0, 0, 11);
        bGrad.addColorStop(0, '#fca5a5');
        bGrad.addColorStop(0.5, '#ef4444');
        bGrad.addColorStop(1, '#7f1d1d');
        ctx.fillStyle = bGrad;
        ctx.beginPath();
        ctx.arc(0, 0, 10.5, 0, TWO_PI);
        ctx.fill();

        // Expressive angry eyes
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(-3.5, -2, 2.8, 0, TWO_PI);
        ctx.arc(3.5, -2, 2.8, 0, TWO_PI);
        ctx.fill();
        ctx.fillStyle = '#090d16';
        ctx.beginPath();
        ctx.arc(-3.2, -2, 1.3, 0, TWO_PI);
        ctx.arc(3.2, -2, 1.3, 0, TWO_PI);
        ctx.fill();
      } else if (en.type === 'eye') {
        // Tracking alien eye with eerie aura
        ctx.shadowColor = '#ec4899';
        ctx.shadowBlur = 10;
        const eGrad = ctx.createRadialGradient(-2, -2, 2, 0, 0, 12);
        eGrad.addColorStop(0, '#ffffff');
        eGrad.addColorStop(1, '#cbd5e1');
        ctx.fillStyle = eGrad;
        ctx.beginPath();
        ctx.ellipse(0, 0, 12, 8.5, 0, 0, TWO_PI);
        ctx.fill();
        ctx.shadowBlur = 0;

        const lookX = (en.dir || 1) * 3.4;
        ctx.fillStyle = '#ec4899';
        ctx.beginPath();
        ctx.arc(lookX, 0, 4.8, 0, TWO_PI);
        ctx.fill();
        ctx.fillStyle = '#090d16';
        ctx.beginPath();
        ctx.ellipse(lookX * 1.1, 0, 1.6, 3.6, 0, 0, TWO_PI);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(lookX - 1.4, -1.8, 1.2, 0, TWO_PI);
        ctx.fill();
      }
      ctx.restore();
    }
  }

  _drawSnowballs(ctx, snowballs, centerX, radius, camCol, floorToY, time) {
    for (const sb of snowballs) {
      const theta = wrapAngle((sb.col - camCol) * COL_ANGLE);
      if (Math.abs(theta) > Math.PI * 0.56) continue;
      const x = centerX + radius * 1.12 * Math.sin(theta);
      const y = floorToY(sb.floor) - 12;

      // Icy trail
      const dir = sb.vx ? Math.sign(sb.vx) : sb.dir || 1;
      for (let t = 1; t <= 3; t++) {
        const trailTheta = wrapAngle((sb.col - dir * t * 0.08 - camCol) * COL_ANGLE);
        const tx = centerX + radius * 1.12 * Math.sin(trailTheta);
        ctx.fillStyle = `rgba(125, 211, 252, ${(0.42 - t * 0.1).toFixed(2)})`;
        ctx.beginPath();
        ctx.arc(tx, y + Math.sin(time * 25 + t) * 1.2, 4.5 - t * 0.9, 0, TWO_PI);
        ctx.fill();
      }

      // Glowing snowball core
      ctx.save();
      ctx.shadowColor = '#38bdf8';
      ctx.shadowBlur = 10;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(x, y, 5.2, 0, TWO_PI);
      ctx.fill();
      ctx.restore();
    }
  }

  _drawPogo(ctx, player, px, py, time) {
    ctx.save();
    ctx.translate(px, py);

    // Ground shadow (scales slightly when airborne)
    const shadowAlpha = player.onGround ? 0.42 : 0.22;
    ctx.fillStyle = `rgba(2, 6, 18, ${shadowAlpha})`;
    ctx.beginPath();
    ctx.ellipse(0, 1, player.onGround ? 12 : 8, 3.5, 0, 0, TWO_PI);
    ctx.fill();

    if (player.invuln > 0 && Math.floor(time * 16) % 2 === 0) {
      ctx.globalAlpha = 0.45;
    }

    const flip = player.facing < 0 ? -1 : 1;
    const sx = player.squashX || 1;
    const sy = player.squashY || 1;
    ctx.scale(flip * sx, sy);

    const moving = player.onGround && Math.abs(player.vx) > 0.2;
    const bob = moving ? Math.abs(Math.sin(time * 18)) * 3 : 0;
    const stride = moving ? Math.sin(time * 18) * 5.5 : 0;

    // Animated feet
    ctx.fillStyle = '#15803d';
    ctx.beginPath();
    ctx.roundRect(-8 + stride, -6, 7, 6, 2);
    ctx.roundRect(1 - stride, -6, 7, 6, 2);
    ctx.fill();

    // Body with emerald gradient
    const bodyGrad = ctx.createRadialGradient(-3, -18 - bob, 2, 0, -14 - bob, 13);
    bodyGrad.addColorStop(0, '#86efac');
    bodyGrad.addColorStop(0.55, '#22c55e');
    bodyGrad.addColorStop(1, '#14532d');
    ctx.fillStyle = bodyGrad;
    ctx.beginPath();
    ctx.ellipse(0, -14 - bob, 11.5, 10.5, 0, 0, TWO_PI);
    ctx.fill();
    ctx.strokeStyle = '#052e16';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Belly highlight
    ctx.fillStyle = 'rgba(220, 252, 231, 0.55)';
    ctx.beginPath();
    ctx.ellipse(3, -11 - bob, 5.5, 5.5, 0, 0, TWO_PI);
    ctx.fill();

    // Expressive Blinking Eye
    const blinking = ((time * 0.75) % 4.4) > 4.22;
    if (blinking) {
      ctx.strokeStyle = '#052e16';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, -19 - bob);
      ctx.lineTo(8, -19 - bob);
      ctx.stroke();
    } else {
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(4, -19 - bob, 5.8, 0, TWO_PI);
      ctx.fill();
      ctx.fillStyle = '#0f172a';
      ctx.beginPath();
      ctx.arc(5.6, -19 - bob, 2.6, 0, TWO_PI);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(6.5, -20.2 - bob, 1, 0, TWO_PI);
      ctx.fill();
    }

    // Snowball Cannon Snout with muzzle glow
    ctx.fillStyle = '#16a34a';
    ctx.beginPath();
    ctx.roundRect(7, -15 - bob, 8.5, 5.5, 2);
    ctx.fill();
    const muzzlePulse = player.fireCooldown > 0.1 ? 0.95 : 0.35 + 0.2 * Math.sin(time * 8);
    ctx.fillStyle = `rgba(125, 211, 252, ${muzzlePulse})`;
    ctx.beginPath();
    ctx.arc(15.5, -12.2 - bob, player.fireCooldown > 0.1 ? 4 : 2.2, 0, TWO_PI);
    ctx.fill();

    ctx.restore();
  }

  _drawToppleDebris(ctx, pal, centerX, radius, seaY, towerTopY, progress, time) {
    ctx.save();
    for (const d of this.debrisChunks) {
      const dx = centerX + d.rx * radius * 1.45 + Math.sin(time * 3 + d.seed) * 24 * progress;
      const dy = Math.min(seaY + 10, towerTopY + (seaY - towerTopY) * ((progress * d.speedY + d.seed * 0.17) % 1));
      ctx.save();
      ctx.translate(dx, dy);
      ctx.rotate(time * d.rotSpeed);
      ctx.fillStyle = d.seed % 2 > 1 ? pal.brickA : pal.brickB;
      ctx.fillRect(-d.size * 0.5, -d.size * 0.35, d.size, d.size * 0.7);
      ctx.restore();
    }

    // Rising shockwave dust & sparks at sea level
    const dustAlpha = Math.sin(progress * Math.PI) * 0.55;
    if (dustAlpha > 0.02) {
      const dustGrad = ctx.createRadialGradient(centerX, seaY, 8, centerX, seaY, radius * 1.45);
      dustGrad.addColorStop(0, `rgba(186, 230, 253, ${dustAlpha})`);
      dustGrad.addColorStop(0.5, hexToRgba(pal.glow, (dustAlpha * 0.55).toFixed(2)));
      dustGrad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = dustGrad;
      ctx.beginPath();
      ctx.arc(centerX, seaY, radius * 1.45, Math.PI, 0);
      ctx.fill();
    }
    ctx.restore();
  }

  _drawToxicOcean(ctx, width, height, centerX, radius, seaY, pal, time) {
    const waterTop = Math.min(height - 38, Math.max(height * 0.78, seaY));

    // Back wave layer
    ctx.fillStyle = '#0a4f6e';
    ctx.beginPath();
    ctx.moveTo(-16, height + 16);
    for (let x = -16; x <= width + 16; x += 14) {
      const wy = waterTop - 3 + Math.sin(x * 0.032 - time * 2.8) * 3.5;
      ctx.lineTo(x, wy);
    }
    ctx.lineTo(width + 16, height + 16);
    ctx.closePath();
    ctx.fill();

    // Main toxic sea gradient
    const seaGrad = ctx.createLinearGradient(0, waterTop, 0, height);
    seaGrad.addColorStop(0, '#06b6d4');
    seaGrad.addColorStop(0.35, '#0e7490');
    seaGrad.addColorStop(1, '#041e30');
    ctx.fillStyle = seaGrad;
    ctx.beginPath();
    ctx.moveTo(-16, height + 16);
    for (let x = -16; x <= width + 16; x += 12) {
      const wy = waterTop + Math.sin(x * 0.042 + time * 4.2) * 4;
      ctx.lineTo(x, wy);
    }
    ctx.lineTo(width + 16, height + 16);
    ctx.closePath();
    ctx.fill();

    // Glowing tower & moon water reflections
    ctx.save();
    for (let i = 0; i < 6; i++) {
      const ry = waterTop + 8 + i * 7;
      if (ry > height) break;
      const rw = radius * (0.95 - i * 0.1) + Math.sin(time * 5 + i) * 8;
      ctx.fillStyle = hexToRgba(pal.glow, (0.22 - i * 0.03).toFixed(2));
      ctx.fillRect(centerX - rw + Math.sin(time * 4 + i * 1.5) * 5, ry, rw * 2, 2.5);
    }
    ctx.restore();

    // Foreground neon crest
    ctx.strokeStyle = '#67e8f9';
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    for (let x = -16; x <= width + 16; x += 12) {
      const wy = waterTop + Math.sin(x * 0.042 + time * 4.2) * 4;
      if (x === -16) ctx.moveTo(x, wy);
      else ctx.lineTo(x, wy);
    }
    ctx.stroke();
  }

  _drawParticles(ctx, particles) {
    for (const p of particles) {
      ctx.fillStyle = p.color;
      ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
      ctx.fillRect(p.x - p.size * 0.5, p.y - p.size * 0.5, p.size, p.size);
    }
    ctx.globalAlpha = 1;
  }

  _drawPopups(ctx, popups, centerX, radius, camCol, floorToY) {
    ctx.save();
    ctx.textAlign = 'center';
    for (const pop of popups) {
      const t = 1 - Math.max(0, pop.life / (pop.maxLife || 1));
      let px = pop.x;
      let py = pop.y;
      if (px == null && pop.col != null) {
        const theta = wrapAngle((pop.col - camCol) * COL_ANGLE);
        px = centerX + radius * 1.15 * Math.sin(theta);
      }
      if (py == null && pop.floor != null) {
        py = floorToY(pop.floor) - 18;
      }
      if (px == null || py == null) continue;

      const alpha = Math.max(0, 1 - t * t);
      const scale = 0.85 + 0.3 * Math.sin(Math.min(1, t * 3) * Math.PI * 0.5);
      ctx.save();
      ctx.translate(px, py - t * 28);
      ctx.scale(scale, scale);
      ctx.globalAlpha = alpha;
      ctx.font = 'bold 13px Orbitron, sans-serif';
      ctx.lineWidth = 3;
      ctx.strokeStyle = 'rgba(2, 6, 23, 0.9)';
      ctx.strokeText(pop.text, 0, 0);
      ctx.fillStyle = pop.color || '#fde047';
      ctx.fillText(pop.text, 0, 0);
      ctx.restore();
    }
    ctx.restore();
  }

  renderSubmarineScene(state) {
    const { ctx, width, height } = this;
    const { sub, time, particles } = state;
    const shake = getShakeOffset(state.shake, time);

    ctx.save();
    ctx.translate(shake.x, shake.y);

    // 1. Deep Underwater Gradient
    const bg = ctx.createLinearGradient(0, 0, 0, height);
    bg.addColorStop(0, '#021d33');
    bg.addColorStop(0.5, '#043352');
    bg.addColorStop(1, '#02101e');
    ctx.fillStyle = bg;
    ctx.fillRect(-16, -16, width + 32, height + 32);

    // 2. Volumetric Underwater Light Shafts
    for (let i = 0; i < 5; i++) {
      const rx = (((i * 115 - time * 24) % (width + 140)) + width + 140) % (width + 140) - 70;
      const beamGrad = ctx.createLinearGradient(rx, 0, rx - 50, height);
      beamGrad.addColorStop(0, 'rgba(125, 211, 252, 0.14)');
      beamGrad.addColorStop(0.65, 'rgba(56, 189, 248, 0.04)');
      beamGrad.addColorStop(1, 'rgba(56, 189, 248, 0)');
      ctx.fillStyle = beamGrad;
      ctx.beginPath();
      ctx.moveTo(rx, 0);
      ctx.lineTo(rx + 46, 0);
      ctx.lineTo(rx - 28, height);
      ctx.lineTo(rx - 74, height);
      ctx.closePath();
      ctx.fill();
    }

    // 3. Distant Seabed Silhouettes
    ctx.fillStyle = '#031929';
    ctx.beginPath();
    ctx.moveTo(0, height);
    for (let x = 0; x <= width; x += 28) {
      const sy = height - 48 - Math.sin(x * 0.025 + time * 0.4) * 10 - Math.cos(x * 0.07) * 8;
      ctx.lineTo(x, sy);
    }
    ctx.lineTo(width, height);
    ctx.closePath();
    ctx.fill();

    // Foreground Seafloor
    ctx.fillStyle = '#06263d';
    ctx.fillRect(0, height - 34, width, 34);
    ctx.fillStyle = 'rgba(56, 189, 248, 0.16)';
    ctx.fillRect(0, height - 34, width, 2);

    // 4. Progress Bar at top of sub stage
    const pct = Math.min(1, sub.timer / sub.duration);
    ctx.fillStyle = 'rgba(15, 23, 42, 0.65)';
    ctx.beginPath();
    ctx.roundRect(24, 14, width - 48, 9, 4);
    ctx.fill();
    ctx.fillStyle = '#38bdf8';
    ctx.beginPath();
    ctx.roundRect(24, 14, Math.max(6, (width - 48) * pct), 9, 4);
    ctx.fill();
    ctx.fillStyle = '#e0f2fe';
    ctx.font = 'bold 10px Orbitron, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('MK.7 MINI-SUBMARINE • CATCH BUBBLED FISH!', width * 0.5, 37);

    // 5. Animated Bioluminescent Alien Fish
    for (const f of sub.fish) {
      if (f.caught) continue;
      ctx.save();
      ctx.translate(f.x, f.y);
      const wag = Math.sin(time * 12 + f.x * 0.08) * 3.5;

      // Bioluminescent aura
      ctx.shadowColor = f.color;
      ctx.shadowBlur = 10;
      ctx.fillStyle = f.color;
      ctx.beginPath();
      ctx.ellipse(0, 0, 14.5, 9, 0, 0, TWO_PI);
      ctx.fill();
      ctx.shadowBlur = 0;

      // Undulating Tail
      ctx.beginPath();
      ctx.moveTo(12, 0);
      ctx.lineTo(23, -7 + wag);
      ctx.lineTo(23, 7 + wag);
      ctx.closePath();
      ctx.fill();

      // Glowing bioluminescent spots
      ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
      ctx.beginPath();
      ctx.arc(0, -2, 2, 0, TWO_PI);
      ctx.arc(5, 1, 1.5, 0, TWO_PI);
      ctx.fill();

      // Eye
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(-6.5, -2, 3.2, 0, TWO_PI);
      ctx.fill();
      ctx.fillStyle = '#090d16';
      ctx.beginPath();
      ctx.arc(-7.3, -2, 1.5, 0, TWO_PI);
      ctx.fill();

      // Encased in iridescent air bubble
      if (f.bubbled) {
        ctx.strokeStyle = '#a5f3fc';
        ctx.fillStyle = 'rgba(165, 243, 252, 0.22)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(0, 0, 22, 0, TWO_PI);
        ctx.fill();
        ctx.stroke();

        ctx.strokeStyle = 'rgba(255,255,255,0.65)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(0, 0, 18, -2.4, -1.5);
        ctx.stroke();
      }
      ctx.restore();
    }

    // 6. Air Bubbles
    for (const b of sub.bubbles) {
      ctx.strokeStyle = '#e0f2fe';
      ctx.fillStyle = 'rgba(125, 211, 252, 0.3)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(b.x, b.y, 7, 0, TWO_PI);
      ctx.fill();
      ctx.stroke();
    }

    // 7. Detailed Glowing MK.7 Mini-Submarine + Bubble Wake
    for (let i = 1; i <= 4; i++) {
      const wx = sub.x - 32 - i * 10 - ((time * 40) % 10);
      const wy = sub.y + Math.sin(time * 10 + i * 2) * 3;
      ctx.fillStyle = `rgba(186, 230, 253, ${(0.45 - i * 0.09).toFixed(2)})`;
      ctx.beginPath();
      ctx.arc(wx, wy, 4.5 - i * 0.7, 0, TWO_PI);
      ctx.fill();
    }

    ctx.save();
    ctx.translate(sub.x, sub.y);

    // Headlight beam cone
    const coneGrad = ctx.createLinearGradient(24, 0, 120, 0);
    coneGrad.addColorStop(0, 'rgba(253, 224, 71, 0.35)');
    coneGrad.addColorStop(1, 'rgba(253, 224, 71, 0)');
    ctx.fillStyle = coneGrad;
    ctx.beginPath();
    ctx.moveTo(24, -2);
    ctx.lineTo(120, -24);
    ctx.lineTo(120, 24);
    ctx.lineTo(24, 4);
    ctx.closePath();
    ctx.fill();

    // Hull
    const hullGrad = ctx.createLinearGradient(0, -14, 0, 14);
    hullGrad.addColorStop(0, '#f8fafc');
    hullGrad.addColorStop(0.5, '#cbd5e1');
    hullGrad.addColorStop(1, '#475569');
    ctx.fillStyle = hullGrad;
    ctx.beginPath();
    ctx.ellipse(0, 0, 27, 14, 0, 0, TWO_PI);
    ctx.fill();

    // Neon trim stripe
    ctx.fillStyle = '#38bdf8';
    ctx.fillRect(-18, -1, 36, 3);

    // Cockpit dome
    ctx.fillStyle = 'rgba(56, 189, 248, 0.78)';
    ctx.beginPath();
    ctx.arc(6, -8, 9.5, Math.PI, 0);
    ctx.fill();

    // Pogo inside
    ctx.fillStyle = '#4ade80';
    ctx.beginPath();
    ctx.arc(6, -10, 4.5, 0, TWO_PI);
    ctx.fill();

    // Spinning Propeller
    ctx.fillStyle = '#fbbf24';
    ctx.fillRect(-31, -8 + Math.sin(time * 32) * 3.5, 5, 16);
    ctx.restore();

    // 8. Particles & Popups
    this._drawParticles(ctx, particles);
    if (state.popups && state.popups.length > 0) {
      this._drawPopups(ctx, state.popups, width * 0.5, 100, 0, () => height * 0.5);
    }

    ctx.restore();
  }
}
