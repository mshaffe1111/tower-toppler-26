// World-building effects for the tower scene: the feeling of height (clouds below you, birds,
// sway), weather (snow / rain / embers / gust streaks), and gameplay props (checkpoint flags,
// secret star-fish, the guardian eye & its fireballs, the ghost of your best run, pound rings).
import * as THREE from 'three';
import { COLS } from './levels.js';

const TWO_PI = Math.PI * 2;
const COL_ANGLE = TWO_PI / COLS;

function wrapAngle(a) {
  let r = a % TWO_PI;
  if (r > Math.PI) r -= TWO_PI;
  if (r < -Math.PI) r += TWO_PI;
  return r;
}

function cloudTexture() {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 128;
  const ctx = c.getContext('2d');
  const puffs = [
    [70, 78, 42],
    [118, 60, 52],
    [168, 74, 44],
    [205, 86, 30],
    [40, 90, 26],
    [128, 88, 40],
  ];
  for (const [x, y, r] of puffs) {
    const g = ctx.createRadialGradient(x, y, r * 0.2, x, y, r);
    g.addColorStop(0, 'rgba(255,255,255,0.95)');
    g.addColorStop(0.6, 'rgba(255,255,255,0.55)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TWO_PI);
    ctx.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export class TowerFx {
  constructor(scene, renderer, softDotTex) {
    this.scene = scene;
    this.renderer = renderer;
    this.softDotTex = softDotTex;
    this._tmpColor = new THREE.Color();

    this._buildClouds();
    this._buildHorizon();
    this._buildBirds();
    this._buildWeather();
    this._buildGustStreaks();
    this._buildPoundRing();
    this._buildBoss();

    this.fireballMats = null;
    this.propsGroup = null;
    this.propsFor = null;
    this.ghost = null;
  }

  // ---------------- Height: clouds & birds ----------------
  _buildClouds() {
    const tex = cloudTexture();
    this.clouds = [];
    this.cloudGroup = new THREE.Group();
    // Layers at increasing altitude: as you climb, these drift past and end up below you
    const layers = [3.5, 8, 12.5, 17, 22, 27];
    for (const h of layers) {
      for (let i = 0; i < 7; i++) {
        const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, opacity: 0.35, fog: true });
        const sp = new THREE.Sprite(mat);
        const s = 4 + Math.random() * 5;
        sp.scale.set(s * 2, s, 1);
        sp.userData = {
          h: h + (Math.random() - 0.5) * 1.6,
          ang: Math.random() * TWO_PI,
          r: 9 + Math.random() * 9,
          speed: (0.015 + Math.random() * 0.025) * (Math.random() < 0.5 ? -1 : 1),
          base: 0.16 + Math.random() * 0.2,
        };
        this.cloudGroup.add(sp);
        this.clouds.push(sp);
      }
    }
    this.scene.add(this.cloudGroup);
  }

  // The wider world: rocky islands and the other towers of Nebulus on the horizon.
  // The group turns with the tower, so walking round reveals different views.
  _buildHorizon() {
    const g = new THREE.Group();
    const rockMat = new THREE.MeshStandardMaterial({ color: '#1b2433', roughness: 0.95, flatShading: true });
    const grassMat = new THREE.MeshStandardMaterial({ color: '#1f3b2c', roughness: 0.9, flatShading: true });
    let seed = 3;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < 9; i++) {
      const ang = (i / 9) * Math.PI * 2 + rnd() * 0.4;
      const r = 34 + rnd() * 14;
      const isl = new THREE.Group();
      const h = 2 + rnd() * 5;
      const base = new THREE.Mesh(new THREE.ConeGeometry(3 + rnd() * 4, h, 7, 2), rockMat);
      base.position.y = h / 2 - 0.9;
      base.rotation.y = rnd() * 3;
      base.scale.z = 0.6 + rnd() * 0.5;
      const cap = new THREE.Mesh(new THREE.ConeGeometry(1.4 + rnd() * 1.5, 1.2, 6), grassMat);
      cap.position.y = h - 0.6;
      isl.add(base, cap);
      isl.position.set(Math.sin(ang) * r, 0, Math.cos(ang) * r);
      g.add(isl);
    }
    // Distant towers (one per tower still standing in the campaign)
    this.farTowers = [];
    const towerGeo = new THREE.CylinderGeometry(1.1, 1.3, 1, 16, 1);
    towerGeo.translate(0, 0.5, 0);
    for (let i = 0; i < 8; i++) {
      const ang = Math.PI + (i - 3.5) * 0.55 + (i % 2 ? 0.12 : -0.08);
      const r = 40 + (i % 3) * 5;
      const t = new THREE.Group();
      const body = new THREE.Mesh(towerGeo, new THREE.MeshStandardMaterial({ color: '#2a3550', roughness: 0.8 }));
      const height = 18 + (i % 4) * 4;
      body.scale.y = height;
      const beacon = new THREE.Sprite(
        new THREE.SpriteMaterial({ map: this.softDotTex, color: '#38bdf8', transparent: true, opacity: 0.9, depthWrite: false, blending: THREE.AdditiveBlending })
      );
      beacon.scale.setScalar(4);
      beacon.position.y = height + 0.6;
      const windows = new THREE.Mesh(
        new THREE.CylinderGeometry(1.12, 1.12, height * 0.9, 16, 6, true),
        new THREE.MeshBasicMaterial({ color: '#38bdf8', transparent: true, opacity: 0.12, wireframe: true, fog: true })
      );
      windows.position.y = height * 0.5;
      t.add(body, windows, beacon);
      t.position.set(Math.sin(ang) * r, -0.6, Math.cos(ang) * r);
      t.userData = { body, beacon, windows, height };
      g.add(t);
      this.farTowers.push(t);
    }
    this.horizon = g;
    this.scene.add(g);
  }

  _buildBirds() {
    this.birds = [];
    const wingGeo = new THREE.BufferGeometry();
    wingGeo.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 0.32, 0.06, -0.08, 0.05, 0, 0.12], 3));
    wingGeo.computeVertexNormals();
    const mat = new THREE.MeshBasicMaterial({ color: '#0b1226', side: THREE.DoubleSide, fog: true });
    for (let f = 0; f < 2; f++) {
      const flock = new THREE.Group();
      flock.userData = { h: 9 + f * 9, r: 8 + f * 2.5, ang: Math.random() * TWO_PI, speed: 0.18 + f * 0.05 };
      for (let i = 0; i < 5; i++) {
        const bird = new THREE.Group();
        const wl = new THREE.Mesh(wingGeo, mat);
        const wr = new THREE.Mesh(wingGeo, mat);
        wr.scale.x = -1;
        bird.add(wl, wr);
        bird.position.set((i % 2 ? 1 : -1) * Math.ceil(i / 2) * 0.45, Math.random() * 0.3, -Math.ceil(i / 2) * 0.5);
        bird.userData = { wl, wr, ph: Math.random() * TWO_PI };
        flock.add(bird);
      }
      this.scene.add(flock);
      this.birds.push(flock);
    }
  }

  // ---------------- Weather ----------------
  _buildWeather() {
    const N = 600;
    this.wN = N;
    const pos = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 16;
      pos[i * 3 + 1] = (Math.random() - 0.5) * 22;
      pos[i * 3 + 2] = -2 + Math.random() * 9;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.flakeMat = new THREE.PointsMaterial({
      size: 0.12,
      map: this.softDotTex,
      color: '#ffffff',
      transparent: true,
      depthWrite: false,
      opacity: 0.9,
      blending: THREE.AdditiveBlending,
    });
    this.flakes = new THREE.Points(geo, this.flakeMat);
    this.flakes.frustumCulled = false;
    this.flakes.visible = false;
    this.scene.add(this.flakes);

    // Rain: short line segments
    const R = 380;
    this.rN = R;
    const rpos = new Float32Array(R * 6);
    for (let i = 0; i < R; i++) {
      const x = (Math.random() - 0.5) * 16;
      const y = (Math.random() - 0.5) * 22;
      const z = -2 + Math.random() * 9;
      rpos.set([x, y, z, x + 0.05, y - 0.55, z], i * 6);
    }
    const rgeo = new THREE.BufferGeometry();
    rgeo.setAttribute('position', new THREE.BufferAttribute(rpos, 3));
    this.rain = new THREE.LineSegments(
      rgeo,
      new THREE.LineBasicMaterial({ color: '#9fb7d8', transparent: true, opacity: 0.35, depthWrite: false })
    );
    this.rain.frustumCulled = false;
    this.rain.visible = false;
    this.scene.add(this.rain);
  }

  _buildGustStreaks() {
    const S = 40;
    this.sN = S;
    const pos = new Float32Array(S * 6);
    this.streakData = [];
    for (let i = 0; i < S; i++) {
      this.streakData.push({ x: (Math.random() - 0.5) * 18, y: (Math.random() - 0.5) * 16, z: -1 + Math.random() * 7, len: 0.8 + Math.random() * 1.6, sp: 9 + Math.random() * 8 });
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.streaks = new THREE.LineSegments(
      geo,
      new THREE.LineBasicMaterial({ color: '#e0f2fe', transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending })
    );
    this.streaks.frustumCulled = false;
    this.scene.add(this.streaks);
  }

  _buildPoundRing() {
    this.poundRing = new THREE.Mesh(
      new THREE.RingGeometry(0.2, 0.32, 40),
      new THREE.MeshBasicMaterial({ color: '#e0f2fe', transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending })
    );
    this.poundRing.rotation.x = -Math.PI / 2;
    this.scene.add(this.poundRing);
  }

  // ---------------- Guardian ----------------
  _buildBoss() {
    const g = new THREE.Group();
    const scleraMat = new THREE.MeshStandardMaterial({ color: '#fdf2f8', roughness: 0.15, emissive: '#3b0a1f', emissiveIntensity: 0.3 });
    const sclera = new THREE.Mesh(new THREE.SphereGeometry(0.8, 40, 28), scleraMat);
    const irisMat = new THREE.MeshStandardMaterial({ color: '#f43f5e', emissive: '#e11d48', emissiveIntensity: 1.6 });
    const iris = new THREE.Mesh(new THREE.SphereGeometry(0.42, 28, 20), irisMat);
    iris.position.z = 0.48;
    iris.scale.z = 0.55;
    const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.19, 20, 14), new THREE.MeshBasicMaterial({ color: '#05060c' }));
    pupil.position.z = 0.72;
    pupil.scale.set(0.55, 1.1, 0.5);
    const lidMat = new THREE.MeshStandardMaterial({ color: '#4a044e', roughness: 0.5, metalness: 0.3, emissive: '#701a75', emissiveIntensity: 0.3 });
    const lidTop = new THREE.Mesh(new THREE.SphereGeometry(0.83, 36, 18, 0, TWO_PI, 0, Math.PI / 2), lidMat);
    const lidBot = new THREE.Mesh(new THREE.SphereGeometry(0.83, 36, 18, 0, TWO_PI, 0, Math.PI / 2), lidMat);
    // Spiked crown ring
    const spikes = new THREE.Group();
    const spikeGeo = new THREE.ConeGeometry(0.09, 0.42, 6);
    const spikeMat = new THREE.MeshStandardMaterial({ color: '#1e1b4b', metalness: 0.7, roughness: 0.3, emissive: '#f472b6', emissiveIntensity: 0.25 });
    for (let i = 0; i < 12; i++) {
      const s = new THREE.Mesh(spikeGeo, spikeMat);
      const a = (i / 12) * TWO_PI;
      s.position.set(Math.cos(a) * 0.86, Math.sin(a) * 0.86, -0.1);
      s.rotation.z = a - Math.PI / 2;
      spikes.add(s);
    }
    const halo = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: this.softDotTex, color: '#f43f5e', transparent: true, opacity: 0.6, depthWrite: false, blending: THREE.AdditiveBlending })
    );
    halo.scale.setScalar(4);
    // HP pips
    const pips = new THREE.Group();
    const pipGeo = new THREE.SphereGeometry(0.07, 8, 6);
    for (let i = 0; i < 8; i++) {
      const pip = new THREE.Mesh(pipGeo, new THREE.MeshBasicMaterial({ color: '#fde047' }));
      pip.position.set((i - 3.5) * 0.2, 1.25, 0.2);
      pips.add(pip);
    }
    g.add(halo, sclera, iris, pupil, lidTop, lidBot, spikes, pips);
    g.userData = { iris, pupil, lidTop, lidBot, spikes, halo, pips, irisMat, scleraMat };
    g.visible = false;
    this.bossMesh = g;
    this.scene.add(g);
  }

  createFireballMesh() {
    const g = new THREE.Group();
    const core = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.2, 2),
      new THREE.MeshStandardMaterial({ color: '#fff7ed', emissive: '#fb923c', emissiveIntensity: 2.4 })
    );
    g.add(core);
    const halo = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: this.softDotTex, color: '#f97316', transparent: true, opacity: 0.85, depthWrite: false, blending: THREE.AdditiveBlending })
    );
    halo.scale.setScalar(1.3);
    g.add(halo);
    const trail = [];
    for (let i = 0; i < 4; i++) {
      const t = new THREE.Sprite(
        new THREE.SpriteMaterial({ map: this.softDotTex, color: i < 2 ? '#fdba74' : '#ef4444', transparent: true, opacity: 0.6 - i * 0.12, depthWrite: false, blending: THREE.AdditiveBlending })
      );
      t.scale.setScalar(0.7 - i * 0.12);
      g.add(t);
      trail.push(t);
    }
    g.userData = { core, halo, trail, isFireball: true };
    return g;
  }

  // ---------------- Per-tower props (live inside the rotating tower group) ----------------
  syncProps(towerGroup, state, TOWER_RADIUS, FLOOR_HEIGHT) {
    if (this.propsFor === state.checkpoints && this.propsGroup && this.propsGroup.parent === towerGroup) return;
    if (this.propsGroup) this.propsGroup.parent?.remove(this.propsGroup);
    this.propsFor = state.checkpoints;
    const g = new THREE.Group();
    this.flags = [];
    this.stars = [];
    const poleMat = new THREE.MeshStandardMaterial({ color: '#cbd5e1', metalness: 0.8, roughness: 0.25 });
    for (const c of state.checkpoints) {
      const phi = c.col * COL_ANGLE;
      const holder = new THREE.Group();
      holder.rotation.y = phi;
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.03, 1.1, 8), poleMat);
      pole.position.set(0.32, c.floor * FLOOR_HEIGHT + 0.55, TOWER_RADIUS + 0.62);
      const clothGeo = new THREE.PlaneGeometry(0.46, 0.28, 8, 3);
      clothGeo.translate(0.23, 0, 0);
      const clothMat = new THREE.MeshStandardMaterial({ color: '#64748b', emissive: '#000000', side: THREE.DoubleSide, roughness: 0.7 });
      const cloth = new THREE.Mesh(clothGeo, clothMat);
      cloth.position.set(0.34, c.floor * FLOOR_HEIGHT + 0.94, TOWER_RADIUS + 0.62);
      const base = clothGeo.attributes.position.array.slice();
      holder.add(pole, cloth);
      g.add(holder);
      this.flags.push({ c, cloth, clothMat, base });
    }
    const starShape = new THREE.Shape();
    for (let i = 0; i < 10; i++) {
      const r = i % 2 === 0 ? 0.22 : 0.1;
      const a = (i / 10) * TWO_PI + Math.PI / 2;
      if (i === 0) starShape.moveTo(Math.cos(a) * r, Math.sin(a) * r);
      else starShape.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    const starGeo = new THREE.ExtrudeGeometry(starShape, { depth: 0.06, bevelEnabled: true, bevelThickness: 0.025, bevelSize: 0.02, bevelSegments: 2 });
    starGeo.center();
    const starMat = new THREE.MeshStandardMaterial({ color: '#fde047', emissive: '#f59e0b', emissiveIntensity: 1.1, metalness: 0.4, roughness: 0.25 });
    for (const s of state.secrets) {
      const holder = new THREE.Group();
      holder.rotation.y = s.col * COL_ANGLE;
      const star = new THREE.Mesh(starGeo, starMat);
      star.position.set(0, s.floor * FLOOR_HEIGHT + 0.55, TOWER_RADIUS + 0.42);
      const halo = new THREE.Sprite(
        new THREE.SpriteMaterial({ map: this.softDotTex, color: '#fde047', transparent: true, opacity: 0.6, depthWrite: false, blending: THREE.AdditiveBlending })
      );
      halo.scale.setScalar(0.9);
      halo.position.copy(star.position);
      holder.add(star, halo);
      g.add(holder);
      this.stars.push({ s, star, halo, baseY: star.position.y });
    }
    towerGroup.add(g);
    this.propsGroup = g;
  }

  // ---------------- Ghost ----------------
  ensureGhost(buildPogo) {
    if (this.ghost) return this.ghost;
    const g = buildPogo();
    const mat = new THREE.MeshBasicMaterial({ color: '#7dd3fc', transparent: true, opacity: 0.28, depthWrite: false, blending: THREE.AdditiveBlending });
    g.traverse((o) => {
      if (o.isMesh) {
        o.material = mat;
        o.castShadow = false;
      }
      if (o.isLight) o.intensity = 0;
    });
    g.visible = false;
    this.scene.add(g);
    this.ghost = g;
    return g;
  }

  // Weather & streaks are skipped in the water's reflection pass (cheaper, and they'd double up)
  setReflectionPass(on) {
    if (on) {
      this._vis = [this.flakes.visible, this.rain.visible, this.streaks.visible];
      this.flakes.visible = false;
      this.rain.visible = false;
      this.streaks.visible = false;
    } else if (this._vis) {
      [this.flakes.visible, this.rain.visible, this.streaks.visible] = this._vis;
    }
  }

  // ---------------- Per-frame update ----------------
  update(state, ctx) {
    const { time, camCol, cam, focusY, tg, TOWER_RADIUS, FLOOR_HEIGHT, pal } = ctx;
    const mech = state.mech || { kind: 'none', gust: { state: 'idle' } };
    const dt = Math.min(0.05, Math.max(0, time - (this._lastTime ?? time)));
    this._lastTime = time;

    // Clouds orbit slowly; brightness follows the biome; thicker in storms
    const stormy = mech.kind === 'storm' || mech.kind === 'dark';
    // Clouds take the sky's colour so they read as atmosphere, not grey haze
    this._tmpColor.set(pal.mortar).lerp(new THREE.Color('#9fb3d9'), 0.55);
    if (stormy) this._tmpColor.multiplyScalar(0.5);
    for (const sp of this.clouds) {
      const u = sp.userData;
      u.ang += u.speed * dt;
      const a = u.ang - camCol * COL_ANGLE * 0.35;
      const x = Math.sin(a) * u.r;
      const z = Math.cos(a) * u.r - 4;
      sp.position.set(x, u.h, Math.min(z, 1.5));
      sp.material.color.copy(this._tmpColor);
      // Fade clouds that would drift between the camera and the tower
      const front = z > -1 && Math.abs(x) < 4.5 && Math.abs(u.h - focusY) < 4 ? 0.12 : 1;
      sp.material.opacity = u.base * front * (stormy ? 1.3 : 1);
    }

    // Horizon turns with the tower; only towers still standing are on it
    if (this.horizon) {
      this.horizon.rotation.y = -camCol * COL_ANGLE;
      const towers = state.campaignTowers || [];
      const standing = state.runMode === 'campaign' ? Math.max(0, 7 - (state.towerIndex || 0)) : 5;
      this.farTowers.forEach((ft, i) => {
        ft.visible = i < standing;
        const pal2 = towers[Math.min(towers.length - 1, (state.towerIndex || 0) + 1 + i)]?.palette;
        if (pal2) {
          ft.userData.beacon.material.color.set(pal2.glow);
          ft.userData.windows.material.color.set(pal2.glow);
          ft.userData.body.material.color.set(pal2.brickA).lerp(this._tmpColor2 || (this._tmpColor2 = new THREE.Color()), 0).multiplyScalar(0.35);
        }
        ft.userData.beacon.material.opacity = 0.65 + Math.sin(time * 2 + i) * 0.25;
      });
    }

    for (const flock of this.birds) {
      const u = flock.userData;
      u.ang += u.speed * dt;
      flock.position.set(Math.sin(u.ang) * u.r, u.h + Math.sin(time * 0.4 + u.r) * 0.6, Math.cos(u.ang) * u.r - 2);
      flock.rotation.y = u.ang + Math.PI / 2;
      flock.visible = !stormy;
      for (const b of flock.children) {
        const f = Math.sin(time * 9 + b.userData.ph) * 0.6;
        b.userData.wl.rotation.z = f;
        b.userData.wr.rotation.z = -f;
      }
    }

    // Weather
    const snow = mech.kind === 'blizzard';
    const embers = mech.kind === 'storm';
    const rain = mech.kind === 'dark' || mech.kind === 'storm' || mech.kind === 'flood';
    this.flakes.visible = snow || embers;
    this.rain.visible = rain;
    const gustV = mech.gust && mech.gust.state === 'blow' ? mech.gust.dir * mech.gust.strength * 2.4 : 0;
    if (this.flakes.visible) {
      this.flakeMat.color.set(embers ? '#fb923c' : '#ffffff');
      this.flakeMat.size = embers ? 0.1 : 0.13;
      const arr = this.flakes.geometry.attributes.position.array;
      for (let i = 0; i < this.wN; i++) {
        const k = i * 3;
        if (embers) {
          arr[k + 1] += (0.9 + (i % 5) * 0.2) * dt;
          arr[k] += (Math.sin(time * 1.3 + i) * 0.4 + gustV) * dt;
        } else {
          arr[k + 1] -= (0.9 + (i % 7) * 0.12) * dt;
          arr[k] += (Math.sin(time * 0.8 + i * 0.37) * 0.35 + gustV) * dt;
        }
        if (arr[k + 1] < -11) arr[k + 1] += 22;
        if (arr[k + 1] > 11) arr[k + 1] -= 22;
        if (arr[k] < -8) arr[k] += 16;
        if (arr[k] > 8) arr[k] -= 16;
      }
      this.flakes.geometry.attributes.position.needsUpdate = true;
      this.flakes.position.set(0, focusY, 0);
    }
    if (rain) {
      const arr = this.rain.geometry.attributes.position.array;
      const slant = 0.05 + gustV * 0.06;
      this.rain.material.opacity = mech.kind === 'flood' ? 0.18 : 0.32;
      for (let i = 0; i < this.rN; i++) {
        const k = i * 6;
        let y = arr[k + 1] - 16 * dt;
        let x = arr[k] + gustV * dt;
        if (y < -11) y += 22;
        if (x < -8) x += 16;
        if (x > 8) x -= 16;
        arr[k] = x;
        arr[k + 1] = y;
        arr[k + 3] = x + slant;
        arr[k + 4] = y - 0.55;
      }
      this.rain.geometry.attributes.position.needsUpdate = true;
      this.rain.position.set(0, focusY, 0);
    }

    // Gust streaks (telegraph during 'warn', strong during 'blow')
    const g = mech.gust || { state: 'idle' };
    const streakTarget = g.state === 'blow' ? 0.55 : g.state === 'warn' ? 0.22 : 0;
    const sm = this.streaks.material;
    sm.opacity += (streakTarget - sm.opacity) * Math.min(1, dt * 6);
    this.streaks.visible = sm.opacity > 0.01;
    if (this.streaks.visible) {
      const arr = this.streaks.geometry.attributes.position.array;
      for (let i = 0; i < this.sN; i++) {
        const s = this.streakData[i];
        s.x += (g.dir || 1) * s.sp * dt;
        if (s.x > 10) s.x -= 20;
        if (s.x < -10) s.x += 20;
        arr.set([s.x, s.y, s.z, s.x - (g.dir || 1) * s.len, s.y, s.z], i * 6);
      }
      this.streaks.geometry.attributes.position.needsUpdate = true;
      this.streaks.position.set(0, focusY, 0);
    }

    // Props inside the tower group
    if (tg && state.checkpoints) {
      this.syncProps(tg, state, TOWER_RADIUS, FLOOR_HEIGHT);
      for (const f of this.flags) {
        const arr = f.cloth.geometry.attributes.position.array;
        for (let i = 0; i < arr.length; i += 3) {
          const x = f.base[i];
          arr[i + 2] = f.base[i + 2] + Math.sin(time * 6 + x * 9) * 0.05 * (x / 0.46);
        }
        f.cloth.geometry.attributes.position.needsUpdate = true;
        f.clothMat.color.set(f.c.active ? '#22c55e' : '#64748b');
        f.clothMat.emissive.set(f.c.active ? '#16a34a' : '#000000');
        f.clothMat.emissiveIntensity = f.c.active ? 0.8 : 0;
      }
      for (const st of this.stars) {
        st.star.visible = !st.s.got;
        st.halo.visible = !st.s.got;
        st.star.rotation.y = time * 2.2;
        st.star.position.y = st.baseY + Math.sin(time * 2.5 + st.baseY) * 0.08;
        st.halo.position.y = st.star.position.y;
        st.halo.material.opacity = 0.45 + Math.sin(time * 5) * 0.15;
      }
    }

    // Pound shockwave ring
    const pr = mech.poundRing || 0;
    this.poundRing.visible = pr > 0;
    if (pr > 0) {
      const k = 1 - pr / 0.45;
      const p = state.player;
      const th = wrapAngle((p.col - camCol) * COL_ANGLE);
      const r = TOWER_RADIUS + 0.4;
      this.poundRing.position.set(r * Math.sin(th), p.floor * FLOOR_HEIGHT + 0.04, r * Math.cos(th));
      this.poundRing.scale.setScalar(1 + k * 5);
      this.poundRing.material.opacity = 0.9 * (1 - k);
    }

    // Guardian eye
    const b = state.boss;
    const bm = this.bossMesh;
    bm.visible = Boolean(b && (!b.dead || b.deathT < 1.2));
    if (bm.visible) {
      const ud = bm.userData;
      const th = wrapAngle((b.col - camCol) * COL_ANGLE);
      const r = TOWER_RADIUS + 1.35;
      bm.position.set(r * Math.sin(th), b.floor * FLOOR_HEIGHT + 0.5 + (tg ? tg.position.y : 0), r * Math.cos(th));
      bm.rotation.y = th;
      const asleep = !b.awake;
      const openAmt = b.dead ? 1 : asleep ? 0 : b.open ? 1 : 0;
      ud.open = (ud.open ?? 0) + (openAmt - (ud.open ?? 0)) * Math.min(1, dt * 8);
      const o = ud.open;
      ud.lidTop.rotation.x = -Math.PI / 2 - o * 0.95;
      ud.lidBot.rotation.x = Math.PI / 2 + o * 0.95;
      const p = state.player;
      const look = Math.max(-1, Math.min(1, wrapAngle((p.col - b.col) * COL_ANGLE) * 2));
      const lookY = Math.max(-1, Math.min(1, (p.floor - b.floor) * 0.4));
      ud.iris.position.set(look * 0.18, lookY * 0.16, 0.48);
      ud.pupil.position.set(look * 0.24, lookY * 0.2, 0.72);
      ud.spikes.rotation.z = time * (b.open ? 1.4 : 0.4);
      ud.irisMat.emissiveIntensity = 1.2 + Math.sin(time * 10) * 0.4 + (b.hitFlash > 0 ? 3 : 0);
      ud.scleraMat.emissive.set(b.hitFlash > 0 ? '#ffffff' : '#3b0a1f');
      ud.halo.material.opacity = asleep ? 0.15 : 0.45 + Math.sin(time * 4) * 0.15;
      ud.pips.children.forEach((pip, i) => (pip.visible = b.awake && !b.dead && i < b.hp));
      if (b.dead) {
        const k = Math.min(1, b.deathT / 1.2);
        bm.scale.setScalar(Math.max(0.01, (1 + k * 0.6) * (1 - k)));
        bm.rotation.z = k * 6;
      } else {
        bm.scale.setScalar(asleep ? 0.85 : 1 + (b.hitFlash > 0 ? 0.08 : 0));
        bm.rotation.z = 0;
      }
    }

    // Ghost of your best run
    if (this.ghost) {
      const gs = state.ghost;
      const vis = Boolean(gs && gs.visible && state.mode === 'tower');
      this.ghost.visible = vis;
      if (vis) {
        const th = wrapAngle((gs.col - camCol) * COL_ANGLE);
        const r = TOWER_RADIUS + 0.5;
        this.ghost.position.set(r * Math.sin(th), gs.floor * FLOOR_HEIGHT, r * Math.cos(th));
        this.ghost.rotation.y = th + (gs.facing < 0 ? Math.PI + 0.85 : -0.85);
      }
    }
  }
}
