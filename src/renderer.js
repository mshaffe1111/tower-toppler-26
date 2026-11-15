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

export class GameRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.width = 360;
    this.height = 540;
    this.stars = Array.from({ length: 55 }, () => ({
      x: Math.random(),
      y: Math.random() * 0.8,
      r: 0.6 + Math.random() * 1.4,
      twinkle: Math.random() * TWO_PI,
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

    // 1. Alien Nebulus Night Sky
    const skyGrad = ctx.createLinearGradient(0, 0, 0, height);
    skyGrad.addColorStop(0, '#030614');
    skyGrad.addColorStop(0.65, '#07122b');
    skyGrad.addColorStop(1, '#0b2239');
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, width, height);

    // Stars
    for (const s of this.stars) {
      const alpha = 0.35 + 0.45 * Math.sin(time * 2.2 + s.twinkle);
      ctx.fillStyle = `rgba(210, 235, 255, ${alpha.toFixed(2)})`;
      ctx.beginPath();
      ctx.arc(s.x * width, s.y * height, s.r, 0, TWO_PI);
      ctx.fill();
    }

    // Distant Nebulus Moon
    ctx.save();
    const moonGrad = ctx.createRadialGradient(width * 0.82, height * 0.14, 4, width * 0.82, height * 0.14, 34);
    moonGrad.addColorStop(0, 'rgba(180, 240, 255, 0.9)');
    moonGrad.addColorStop(0.6, 'rgba(56, 189, 248, 0.25)');
    moonGrad.addColorStop(1, 'rgba(56, 189, 248, 0)');
    ctx.fillStyle = moonGrad;
    ctx.beginPath();
    ctx.arc(width * 0.82, height * 0.14, 34, 0, TWO_PI);
    ctx.fill();
    ctx.restore();

    // Geometry constants
    const centerX = width * 0.5 + (topple.active ? Math.sin(time * 42) * 5 * (1 - topple.progress) : 0);
    const radius = Math.min(width * 0.33, 132);
    const floorPx = 42;
    const playerScreenY = height * 0.56;
    const toppleDrop = topple.active ? topple.progress * tower.floors * floorPx * 1.15 : 0;

    const floorToY = (f) => playerScreenY - (f - camFloor) * floorPx + toppleDrop;

    // 2. Cylindrical Tower Body (Bricks + Cylindrical Shading)
    const towerTopY = Math.max(0, floorToY(tower.floors));
    const seaY = Math.min(height - 36, floorToY(-0.55));
    const towerBottomY = Math.max(towerTopY, Math.min(height, seaY + 20));

    if (towerBottomY > towerTopY) {
      // Draw vertical column strips for true 3D cylindrical brick pattern
      const minFloorVis = Math.max(0, Math.floor(camFloor - 7));
      const maxFloorVis = Math.min(tower.floors - 1, Math.ceil(camFloor + 9));

      // Tower silhouette backdrop
      ctx.fillStyle = pal.mortar;
      ctx.fillRect(centerX - radius, towerTopY, radius * 2, towerBottomY - towerTopY);

      for (let f = minFloorVis; f <= maxFloorVis; f++) {
        const yTop = floorToY(f + 1);
        const yBot = floorToY(f);
        const h = yBot - yTop;
        if (yBot < 0 || yTop > height) continue;

        const rowOffset = (f % 2) * 0.5;
        for (let c = 0; c < COLS; c++) {
          const a0 = wrapAngle((c + rowOffset - camCol) * COL_ANGLE);
          const a1 = wrapAngle((c + 1 + rowOffset - camCol) * COL_ANGLE);
          // Skip back-facing bricks
          if (Math.abs(a0) > Math.PI * 0.58 && Math.abs(a1) > Math.PI * 0.58) continue;
          const ca0 = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, a0));
          const ca1 = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, a1));
          if (ca1 <= ca0) continue;

          const x0 = centerX + radius * Math.sin(ca0);
          const x1 = centerX + radius * Math.sin(ca1);
          const w = x1 - x0;
          if (w <= 0.5) continue;

          const midA = (ca0 + ca1) * 0.5;
          const light = 0.35 + 0.72 * Math.cos(midA);
          const baseColor = (c + f) % 2 === 0 ? pal.brickA : pal.brickB;
          ctx.fillStyle = shadeColor(baseColor, light);
          ctx.fillRect(x0 + 0.6, yTop + 0.8, Math.max(0, w - 1.2), Math.max(0, h - 1.6));
        }
      }

      // Battlement / Crown at the top of the tower
      if (towerTopY > -30 && towerTopY < height) {
        ctx.fillStyle = pal.ledge;
        ctx.fillRect(centerX - radius - 2, towerTopY - 6, radius * 2 + 4, 6);
      }

      // Subtle cylindrical edge glow
      const rimGrad = ctx.createLinearGradient(centerX - radius, 0, centerX + radius, 0);
      rimGrad.addColorStop(0, 'rgba(0,0,0,0.45)');
      rimGrad.addColorStop(0.2, 'rgba(255,255,255,0.06)');
      rimGrad.addColorStop(0.5, 'rgba(255,255,255,0.12)');
      rimGrad.addColorStop(0.8, 'rgba(255,255,255,0.06)');
      rimGrad.addColorStop(1, 'rgba(0,0,0,0.45)');
      ctx.fillStyle = rimGrad;
      ctx.fillRect(centerX - radius, towerTopY, radius * 2, towerBottomY - towerTopY);
    }

    // 3. Doors & Tunnels (Recessed into the cylinder)
    for (const door of tower.doors) {
      const theta = wrapAngle((door.col + 0.5 - camCol) * COL_ANGLE);
      if (Math.abs(theta) > Math.PI * 0.5) continue;
      const x = centerX + radius * Math.sin(theta);
      const y = floorToY(door.floor);
      const dw = 22 * Math.cos(theta);
      const dh = 32;
      if (y < -40 || y > height + 40) continue;

      ctx.save();
      ctx.fillStyle = '#02040a';
      ctx.beginPath();
      ctx.roundRect(x - dw * 0.5, y - dh, dw, dh, [dw * 0.45, dw * 0.45, 2, 2]);
      ctx.fill();

      ctx.lineWidth = 2;
      if (door.isExit) {
        const pulse = 0.65 + 0.35 * Math.sin(time * 6);
        ctx.strokeStyle = `rgba(255, 215, 0, ${pulse})`;
        ctx.fillStyle = `rgba(255, 215, 0, ${0.22 * pulse})`;
        ctx.fill();
        ctx.stroke();
        // Exit beacon star
        ctx.fillStyle = '#fff9c4';
        ctx.font = 'bold 10px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('EXIT', x, y - dh - 5);
      } else {
        ctx.strokeStyle = pal.glow;
        ctx.stroke();
      }
      ctx.restore();
    }

    // 4. Elevator Shafts & Platforms
    for (const el of state.elevators) {
      const theta = wrapAngle((el.col + 0.5 - camCol) * COL_ANGLE);
      if (Math.abs(theta) > Math.PI * 0.52) continue;
      const x = centerX + radius * 1.04 * Math.sin(theta);
      const yMin = floorToY(el.maxFloor);
      const yMax = floorToY(el.minFloor);
      const yCur = floorToY(el.floor);
      const w = Math.max(8, 28 * Math.cos(theta));

      // Vertical shaft rail
      ctx.strokeStyle = 'rgba(255,255,255,0.22)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x, yMin - 8);
      ctx.lineTo(x, yMax + 4);
      ctx.stroke();

      // Moving platform
      ctx.fillStyle = '#38bdf8';
      ctx.fillRect(x - w * 0.55, yCur, w * 1.1, 8);
      ctx.fillStyle = '#e0f2fe';
      ctx.fillRect(x - w * 0.55, yCur, w * 1.1, 3);
    }

    // 5. Ledges (Extruded 3D around cylinder)
    const ledgeRadius = radius * 1.12;
    const ledgesToDraw = [];
    for (const l of state.ledges) {
      if (l.gone) continue;
      const theta = wrapAngle((l.col + 0.5 - camCol) * COL_ANGLE);
      if (Math.abs(theta) > Math.PI * 0.58) continue;
      ledgesToDraw.push({ l, theta, depth: Math.cos(theta) });
    }
    // Sort back-to-front by depth
    ledgesToDraw.sort((a, b) => a.depth - b.depth);

    for (const { l, theta, depth } of ledgesToDraw) {
      const y = floorToY(l.floor) + (l.shake ? Math.sin(time * 55) * 2 : 0);
      if (y < -20 || y > height + 20) continue;

      const a0 = theta - COL_ANGLE * 0.48;
      const a1 = theta + COL_ANGLE * 0.48;
      const x0 = centerX + ledgeRadius * Math.sin(a0);
      const x1 = centerX + ledgeRadius * Math.sin(a1);
      const w = Math.max(4, x1 - x0);
      const light = 0.45 + 0.55 * Math.max(0, depth);

      if (l.type === 'box') {
        // Flashing destructible block
        const flash = Math.sin(time * 10) > 0;
        ctx.fillStyle = flash ? '#facc15' : '#f97316';
        ctx.fillRect(x0, y - 22, w, 22);
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(x0 + 1, y - 21, w - 2, 20);
        continue;
      }

      let bodyCol = pal.ledge;
      let topCol = pal.ledgeTop;
      if (l.type === 'crumble') {
        bodyCol = l.crumbling ? '#ef4444' : '#f59e0b';
        topCol = '#fef08a';
      } else if (l.type === 'ice') {
        bodyCol = '#7dd3fc';
        topCol = '#ffffff';
      } else if (l.type === 'conveyorR' || l.type === 'conveyorL') {
        bodyCol = '#a855f7';
        topCol = '#f0abfc';
      }

      ctx.fillStyle = shadeColor(bodyCol, light);
      ctx.fillRect(x0, y, w, 10);
      ctx.fillStyle = shadeColor(topCol, light);
      ctx.fillRect(x0, y, w, 3.5);

      if (l.type === 'conveyorR' || l.type === 'conveyorL') {
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 9px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(l.type === 'conveyorR' ? '»' : '«', (x0 + x1) * 0.5, y + 9);
      }
    }

    // 6. Enemies (Mutant Molecules, Rollers, Bouncers, Eyes)
    for (const en of state.enemies) {
      if (en.dead) continue;
      const theta = wrapAngle((en.col - camCol) * COL_ANGLE);
      if (Math.abs(theta) > Math.PI * 0.55) continue;
      const er = radius * 1.1;
      const x = centerX + er * Math.sin(theta);
      const y = floorToY(en.floor) - 13;
      const scale = 0.65 + 0.35 * Math.max(0, Math.cos(theta));

      ctx.save();
      ctx.translate(x, y);
      ctx.scale(scale, scale);

      if (en.stunTimer > 0) {
        ctx.globalAlpha = 0.65 + 0.35 * Math.sin(time * 24);
      }

      if (en.type === 'molecule') {
        // Pulsing 3-node mutant molecule
        const rot = time * 4 * en.dir;
        for (let i = 0; i < 3; i++) {
          const ang = rot + (i * TWO_PI) / 3;
          ctx.fillStyle = i === 0 ? '#ff2a85' : i === 1 ? '#fbbf24' : '#00f0ff';
          ctx.beginPath();
          ctx.arc(Math.cos(ang) * 7, Math.sin(ang) * 7, 5.5, 0, TWO_PI);
          ctx.fill();
        }
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(0, 0, 4, 0, TWO_PI);
        ctx.fill();
      } else if (en.type === 'roller') {
        ctx.fillStyle = '#f97316';
        ctx.beginPath();
        ctx.arc(0, 0, 10, 0, TWO_PI);
        ctx.fill();
        ctx.strokeStyle = '#fef08a';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(0, 0, 6, time * 8, time * 8 + Math.PI);
        ctx.stroke();
      } else if (en.type === 'bouncer') {
        ctx.fillStyle = '#ef4444';
        ctx.beginPath();
        ctx.arc(0, 0, 10, 0, TWO_PI);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(-3, -3, 3, 0, TWO_PI);
        ctx.fill();
      } else if (en.type === 'eye') {
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.ellipse(0, 0, 11, 8, 0, 0, TWO_PI);
        ctx.fill();
        ctx.fillStyle = '#ec4899';
        ctx.beginPath();
        ctx.arc(en.dir * 3, 0, 4.5, 0, TWO_PI);
        ctx.fill();
        ctx.fillStyle = '#090d16';
        ctx.beginPath();
        ctx.arc(en.dir * 3.5, 0, 2, 0, TWO_PI);
        ctx.fill();
      }
      ctx.restore();
    }

    // 7. Snowball Projectiles
    for (const sb of snowballs) {
      const theta = wrapAngle((sb.col - camCol) * COL_ANGLE);
      if (Math.abs(theta) > Math.PI * 0.56) continue;
      const x = centerX + radius * 1.12 * Math.sin(theta);
      const y = floorToY(sb.floor) - 12;
      ctx.fillStyle = '#ffffff';
      ctx.shadowColor = '#7dd3fc';
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.arc(x, y, 5, 0, TWO_PI);
      ctx.fill();
      ctx.shadowBlur = 0;
    }

    // 8. Pogo the Frog-Hero (Centered horizontally!)
    if (!player.hidden && !topple.active) {
      const py = floorToY(player.floor);
      const px = centerX;
      ctx.save();
      ctx.translate(px, py);

      if (player.invuln > 0 && Math.floor(time * 16) % 2 === 0) {
        ctx.globalAlpha = 0.45;
      }

      const flip = player.facing < 0 ? -1 : 1;
      ctx.scale(flip, 1);

      // Walk bob
      const bob = player.onGround && Math.abs(player.vx) > 0.2 ? Math.abs(Math.sin(time * 18)) * 3 : 0;

      // Legs
      ctx.fillStyle = '#16a34a';
      const stride = player.onGround && Math.abs(player.vx) > 0.2 ? Math.sin(time * 18) * 5 : 0;
      ctx.fillRect(-7 + stride, -6, 6, 6);
      ctx.fillRect(1 - stride, -6, 6, 6);

      // Body
      ctx.fillStyle = '#4ade80';
      ctx.beginPath();
      ctx.ellipse(0, -14 - bob, 11, 10, 0, 0, TWO_PI);
      ctx.fill();
      ctx.strokeStyle = '#14532d';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Big Pogo Eye
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(4, -19 - bob, 5.5, 0, TWO_PI);
      ctx.fill();
      ctx.fillStyle = '#090d16';
      ctx.beginPath();
      ctx.arc(5.5, -19 - bob, 2.5, 0, TWO_PI);
      ctx.fill();

      // Snowball Gun Snout
      ctx.fillStyle = '#22c55e';
      ctx.fillRect(7, -14 - bob, 7, 5);
      ctx.restore();
    }

    // 9. Toxic Alien Ocean at Bottom
    const waterTop = Math.min(height - 38, Math.max(height * 0.78, seaY));
    const seaGrad = ctx.createLinearGradient(0, waterTop, 0, height);
    seaGrad.addColorStop(0, '#06b6d4');
    seaGrad.addColorStop(0.35, '#0e7490');
    seaGrad.addColorStop(1, '#082f49');
    ctx.fillStyle = seaGrad;
    ctx.beginPath();
    ctx.moveTo(0, height);
    ctx.lineTo(0, waterTop);
    for (let x = 0; x <= width; x += 14) {
      const wy = waterTop + Math.sin(x * 0.04 + time * 4) * 4;
      ctx.lineTo(x, wy);
    }
    ctx.lineTo(width, height);
    ctx.closePath();
    ctx.fill();

    // Glowing water crest
    ctx.strokeStyle = '#67e8f9';
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let x = 0; x <= width; x += 14) {
      const wy = waterTop + Math.sin(x * 0.04 + time * 4) * 4;
      if (x === 0) ctx.moveTo(x, wy);
      else ctx.lineTo(x, wy);
    }
    ctx.stroke();

    // 10. Particles
    for (const p of particles) {
      ctx.fillStyle = p.color;
      ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
      ctx.fillRect(p.x - p.size * 0.5, p.y - p.size * 0.5, p.size, p.size);
    }
    ctx.globalAlpha = 1;
  }

  renderSubmarineScene(state) {
    const { ctx, width, height } = this;
    const { sub, time, particles } = state;

    // Deep Underwater Gradient
    const bg = ctx.createLinearGradient(0, 0, 0, height);
    bg.addColorStop(0, '#021a2e');
    bg.addColorStop(0.5, '#042f4b');
    bg.addColorStop(1, '#021120');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, width, height);

    // Parallax Seaweed / Light Rays
    ctx.fillStyle = 'rgba(56, 189, 248, 0.06)';
    for (let i = 0; i < 4; i++) {
      const rx = ((i * 120 - time * 30) % (width + 120) + width + 120) % (width + 120) - 60;
      ctx.beginPath();
      ctx.moveTo(rx, 0);
      ctx.lineTo(rx + 40, 0);
      ctx.lineTo(rx - 30, height);
      ctx.lineTo(rx - 70, height);
      ctx.closePath();
      ctx.fill();
    }

    // Seafloor
    ctx.fillStyle = '#062033';
    ctx.fillRect(0, height - 34, width, 34);

    // Progress Bar at top of sub stage
    const pct = Math.min(1, sub.timer / sub.duration);
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    ctx.fillRect(24, 14, width - 48, 8);
    ctx.fillStyle = '#38bdf8';
    ctx.fillRect(24, 14, (width - 48) * pct, 8);
    ctx.fillStyle = '#e0f2fe';
    ctx.font = 'bold 10px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('MK.7 MINI-SUBMARINE • CATCH BUBBLED FISH!', width * 0.5, 36);

    // Fish
    for (const f of sub.fish) {
      if (f.caught) continue;
      ctx.save();
      ctx.translate(f.x, f.y);
      // Fish body
      ctx.fillStyle = f.color;
      ctx.beginPath();
      ctx.ellipse(0, 0, 14, 9, 0, 0, TWO_PI);
      ctx.fill();
      // Tail
      ctx.beginPath();
      ctx.moveTo(12, 0);
      ctx.lineTo(22, -7);
      ctx.lineTo(22, 7);
      ctx.closePath();
      ctx.fill();
      // Eye
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(-6, -2, 3, 0, TWO_PI);
      ctx.fill();
      ctx.fillStyle = '#000';
      ctx.beginPath();
      ctx.arc(-7, -2, 1.5, 0, TWO_PI);
      ctx.fill();

      // Encased in air bubble!
      if (f.bubbled) {
        ctx.strokeStyle = '#a5f3fc';
        ctx.fillStyle = 'rgba(165, 243, 252, 0.25)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(0, 0, 22, 0, TWO_PI);
        ctx.fill();
        ctx.stroke();
      }
      ctx.restore();
    }

    // Air Bubbles
    for (const b of sub.bubbles) {
      ctx.strokeStyle = '#e0f2fe';
      ctx.fillStyle = 'rgba(125, 211, 252, 0.3)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(b.x, b.y, 7, 0, TWO_PI);
      ctx.fill();
      ctx.stroke();
    }

    // MK.7 Mini-Submarine
    ctx.save();
    ctx.translate(sub.x, sub.y);
    // Hull
    ctx.fillStyle = '#e2e8f0';
    ctx.beginPath();
    ctx.ellipse(0, 0, 26, 14, 0, 0, TWO_PI);
    ctx.fill();
    // Cockpit dome
    ctx.fillStyle = '#38bdf8';
    ctx.beginPath();
    ctx.arc(6, -8, 9, Math.PI, 0);
    ctx.fill();
    // Pogo inside
    ctx.fillStyle = '#4ade80';
    ctx.beginPath();
    ctx.arc(6, -10, 4.5, 0, TWO_PI);
    ctx.fill();
    // Propeller
    ctx.fillStyle = '#fbbf24';
    ctx.fillRect(-30, -8 + Math.sin(time * 30) * 3, 5, 16);
    ctx.restore();

    // Particles
    for (const p of particles) {
      ctx.fillStyle = p.color;
      ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
      ctx.fillRect(p.x - p.size * 0.5, p.y - p.size * 0.5, p.size, p.size);
    }
    ctx.globalAlpha = 1;
  }
}
