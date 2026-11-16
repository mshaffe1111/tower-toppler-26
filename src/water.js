// Ocean for the tower scene.
//  - Planar reflection of the tower, sky and everything else (rendered at reduced resolution
//    with an oblique clip plane, the same technique as three.js' Reflector)
//  - Fine ripples from a procedurally generated, tileable normal map scrolled in several layers,
//    on top of a gentle vertex swell
//  - Schlick fresnel, sun glitter path, subsurface glow on wave crests, depth-tinted body colour
//  - Foam collar where the swell meets the tower, plus crest foam
// The reflection is skipped on the low quality tier (falls back to a sky-colour reflection).
import * as THREE from 'three';

// Tileable water normal map: sum of periodic waves with integer frequencies over the tile
function createWaterNormalTexture(size = 256) {
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(size, size);
  const waves = [];
  let seed = 7;
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 26; i++) {
    const kx = Math.round((rand() - 0.5) * (6 + i * 1.6));
    const ky = Math.round((rand() - 0.5) * (6 + i * 1.6));
    if (kx === 0 && ky === 0) continue;
    const k = Math.hypot(kx, ky);
    waves.push({ kx, ky, amp: 1 / Math.pow(k, 1.25), ph: rand() * Math.PI * 2 });
  }
  const TWO_PI = Math.PI * 2;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const v = y / size;
      let dx = 0;
      let dy = 0;
      for (const w of waves) {
        const a = TWO_PI * (w.kx * u + w.ky * v) + w.ph;
        const cs = Math.cos(a) * w.amp;
        dx += cs * w.kx;
        dy += cs * w.ky;
      }
      // normal = normalize(-dh/dx, -dh/dy, 1)
      const s = 0.09;
      let nx = -dx * s;
      let ny = -dy * s;
      const nz = 1;
      const len = Math.hypot(nx, ny, nz);
      const i4 = (y * size + x) * 4;
      img.data[i4] = ((nx / len) * 0.5 + 0.5) * 255;
      img.data[i4 + 1] = ((ny / len) * 0.5 + 0.5) * 255;
      img.data[i4 + 2] = ((nz / len) * 0.5 + 0.5) * 255;
      img.data[i4 + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 8;
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  return tex;
}

export class Ocean {
  constructor(webgl, { towerRadius = 2.55 } = {}) {
    this.webgl = webgl;
    this.reflectionEnabled = true;
    this.normalTex = createWaterNormalTexture(256);

    const geo = new THREE.PlaneGeometry(180, 180, 200, 200);
    geo.rotateX(-Math.PI / 2);

    this.rt = new THREE.WebGLRenderTarget(256, 256, { type: THREE.HalfFloatType, samples: 0 });
    this.rt.texture.generateMipmaps = false;
    this.textureMatrix = new THREE.Matrix4();

    const uniforms = THREE.UniformsUtils.merge([
      THREE.UniformsLib.fog,
      {
        time: { value: 0 },
        normalMap: { value: null },
        reflectionMap: { value: null },
        textureMatrix: { value: new THREE.Matrix4() },
        useReflection: { value: 1 },
        deepColor: { value: new THREE.Color('#012a40') },
        shallowColor: { value: new THREE.Color('#0aa5b8') },
        skyColor: { value: new THREE.Color('#0b1d3d') },
        sunColor: { value: new THREE.Color('#fff1d6') },
        sunDir: { value: new THREE.Vector3(-0.45, 0.28, -0.85).normalize() },
        glowColor: { value: new THREE.Color('#38bdf8') },
        towerRadius: { value: towerRadius },
        swell: { value: 1 },
        sunStrength: { value: 1 },
        ripples: { value: Array.from({ length: 12 }, () => new THREE.Vector4(0, 0, -100, 0)) },
      },
    ]);
    uniforms.normalMap.value = this.normalTex;
    uniforms.reflectionMap.value = this.rt.texture;
    uniforms.textureMatrix.value = this.textureMatrix;

    this.material = new THREE.ShaderMaterial({
      uniforms,
      fog: true,
      vertexShader: /* glsl */ `
        uniform float time;
        uniform float swell;
        uniform mat4 textureMatrix;
        varying vec3 vWorld;
        varying vec3 vSwellN;
        varying float vHeight;
        varying vec4 vReflCoord;
        #include <fog_pars_vertex>

        vec3 waves(vec2 p) {
          float h = 0.0; float dx = 0.0; float dz = 0.0;
          vec2 dirs[4];
          dirs[0] = normalize(vec2(1.0, 0.3));
          dirs[1] = normalize(vec2(-0.5, 1.0));
          dirs[2] = normalize(vec2(0.3, -1.0));
          dirs[3] = normalize(vec2(-1.0, -0.6));
          float amps[4]; amps[0] = 0.11; amps[1] = 0.06; amps[2] = 0.035; amps[3] = 0.022;
          float freqs[4]; freqs[0] = 0.42; freqs[1] = 0.75; freqs[2] = 1.3; freqs[3] = 2.1;
          float speeds[4]; speeds[0] = 1.1; speeds[1] = 1.5; speeds[2] = 2.1; speeds[3] = 2.8;
          for (int i = 0; i < 4; i++) {
            float ph = dot(dirs[i], p) * freqs[i] + time * speeds[i];
            h += sin(ph) * amps[i];
            float c = cos(ph) * amps[i] * freqs[i];
            dx += c * dirs[i].x;
            dz += c * dirs[i].y;
          }
          return vec3(h, dx, dz);
        }

        void main() {
          vec4 wp = modelMatrix * vec4(position, 1.0);
          float r = length(wp.xz);
          float calm = smoothstep(2.6, 4.5, r) * swell;
          vec3 w = waves(wp.xz) * calm;
          wp.y += w.x;
          vHeight = w.x;
          vSwellN = normalize(vec3(-w.y, 1.0, -w.z));
          vWorld = wp.xyz;
          vReflCoord = textureMatrix * vec4(position, 1.0);
          vec4 mvPosition = viewMatrix * wp;
          gl_Position = projectionMatrix * mvPosition;
          #include <fog_vertex>
        }
      `,
      fragmentShader: /* glsl */ `
        uniform float time;
        uniform sampler2D normalMap;
        uniform sampler2D reflectionMap;
        uniform float useReflection;
        uniform vec3 deepColor;
        uniform vec3 shallowColor;
        uniform vec3 skyColor;
        uniform vec3 sunColor;
        uniform vec3 sunDir;
        uniform vec3 glowColor;
        uniform float towerRadius;
        uniform float sunStrength;
        uniform vec4 ripples[12]; // x, z, start time, strength
        varying vec3 vWorld;
        varying vec3 vSwellN;
        varying float vHeight;
        varying vec4 vReflCoord;
        #include <fog_pars_fragment>

        vec3 sampleN(vec2 uv) { return texture2D(normalMap, uv).xyz * 2.0 - 1.0; }

        float hash(vec2 p) { return fract(sin(dot(p, vec2(41.3, 289.1))) * 15731.743); }
        float noise(vec2 p) {
          vec2 i = floor(p); vec2 f = fract(p);
          vec2 u = f * f * (3.0 - 2.0 * f);
          return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
        }

        void main() {
          vec2 p = vWorld.xz;
          // Four scrolling ripple layers at different scales/directions
          vec3 n1 = sampleN(p * 0.11 + vec2(time * 0.021, time * 0.013));
          vec3 n2 = sampleN(p * 0.23 + vec2(-time * 0.017, time * 0.026));
          vec3 n3 = sampleN(p * 0.47 + vec2(time * 0.035, -time * 0.029));
          vec3 n4 = sampleN(p * 0.9 + vec2(-time * 0.05, -time * 0.041));
          vec3 rip = n1 + n2 * 0.8 + n3 * 0.6 + n4 * 0.35;
          vec3 viewVec = cameraPosition - vWorld;
          float dist = length(viewVec);
          vec3 v = viewVec / dist;
          // Ripples fade with distance to avoid shimmer at the horizon
          float detail = mix(1.0, 0.25, smoothstep(12.0, 60.0, dist));
          // Expanding ring ripples (splashes, rain, landings) + a constant ring train rolling
          // away from the tower base: perturb the normal along the radial direction
          vec2 rn = vec2(0.0);
          float ringFoam = 0.0;
          for (int i = 0; i < 12; i++) {
            vec4 R = ripples[i];
            float age = time - R.z;
            if (age < 0.0 || age > 4.0) continue;
            vec2 dv = p - R.xy;
            float d = length(dv) + 1e-4;
            float c = age * 1.7;
            float env = R.w * exp(-age * 0.9) * exp(-pow((d - c) / (0.35 + age * 0.25), 2.0));
            float ph = (d - c) * 11.0;
            rn += (dv / d) * cos(ph) * env * 0.9;
            ringFoam += max(0.0, sin(ph)) * env * 0.6;
          }
          float rr = length(p);
          float baseEnv = exp(-max(0.0, rr - towerRadius - 0.4) * 0.22) * smoothstep(towerRadius + 0.2, towerRadius + 0.8, rr);
          float bph = rr * 4.2 - time * 2.4;
          rn += (p / max(rr, 1e-3)) * cos(bph) * baseEnv * 0.32;
          ringFoam += smoothstep(0.93, 1.0, sin(bph)) * baseEnv * 0.25;
          vec3 n = normalize(vSwellN + vec3(rip.x + rn.x, 0.0, rip.y + rn.y) * 0.16 * detail + vec3(rn.x, 0.0, rn.y) * 0.12);

          // Fresnel (Schlick, water F0 = 0.02)
          float cosT = clamp(dot(n, v), 0.0, 1.0);
          float fres = 0.02 + 0.98 * pow(1.0 - cosT, 5.0);
          fres = clamp(fres, 0.0, 0.92);

          // Reflection: planar reflection texture, distorted by the ripples
          vec3 refl = skyColor * 1.1;
          if (useReflection > 0.5) {
            vec2 rc = vReflCoord.xy / vReflCoord.w;
            rc += n.xz * 0.045 * detail;
            refl = texture2D(reflectionMap, rc).rgb;
          }

          // Body colour: deep water, brighter turquoise where the swell lifts toward the light
          float crest = clamp(vHeight * 4.0 + 0.5, 0.0, 1.0);
          vec3 body = mix(deepColor, shallowColor, crest * 0.55);
          // Subsurface scattering: sunlight through the backs of waves
          float sss = pow(clamp(dot(v, -sunDir) * 0.5 + 0.5, 0.0, 1.0), 3.0) * crest;
          body += shallowColor * sss * 0.6;

          vec3 col = mix(body, refl, fres);

          // Sun glitter path
          vec3 h = normalize(sunDir + v);
          float spec = pow(max(dot(n, h), 0.0), 420.0) * 2.2 + pow(max(dot(n, h), 0.0), 70.0) * 0.12;
          col += sunColor * spec * sunStrength;

          // Foam: collar hugging the tower base, broken by noise; plus crest foam out to sea
          float r = length(vWorld.xz);
          float ang = atan(vWorld.x, vWorld.z);
          float fn = noise(vec2(ang * 12.0, r * 4.0 - time * 1.1)) * 0.6 + noise(vec2(ang * 31.0, r * 9.0 + time * 0.7)) * 0.4;
          float collar = smoothstep(towerRadius + 0.75, towerRadius + 0.3, r + fn * 0.35);
          float lace = smoothstep(0.55, 0.75, fn) * smoothstep(towerRadius + 2.4, towerRadius + 0.6, r);
          float crestFoam = smoothstep(0.1, 0.17, vHeight) * smoothstep(0.5, 0.8, noise(p * 2.2 + time * 0.25));
          float foam = clamp(collar * (0.55 + fn * 0.6) + lace * 0.45 + crestFoam * 0.45 + ringFoam, 0.0, 1.0);
          col = mix(col, vec3(0.8, 0.9, 0.95), foam * 0.65);

          gl_FragColor = vec4(col, 1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
          #include <fog_fragment>
        }
      `,
    });

    this.mesh = new THREE.Mesh(geo, this.material);
    this.mesh.position.y = -0.62;

    // Reflection camera state
    this._virtualCam = new THREE.PerspectiveCamera();
    this._plane = new THREE.Plane();
    this._normal = new THREE.Vector3();
    this._reflectorWorld = new THREE.Vector3();
    this._camWorld = new THREE.Vector3();
    this._rot = new THREE.Matrix4();
    this._lookAt = new THREE.Vector3();
    this._clip = new THREE.Vector4();
    this._view = new THREE.Vector3();
    this._target = new THREE.Vector3();
    this._q = new THREE.Vector4();
  }

  // Spawn an expanding ring ripple at world (x, z)
  addRipple(x, z, strength = 1, time = this.material.uniforms.time.value) {
    const arr = this.material.uniforms.ripples.value;
    this._ri = ((this._ri || 0) + 1) % arr.length;
    arr[this._ri].set(x, z, time, strength);
  }

  setSize(w, h, dpr) {
    // Reduced-resolution reflection is plenty under the ripple distortion (tier-dependent)
    const scale = this.resScale || 0.4;
    this.rt.setSize(Math.max(64, Math.floor(w * dpr * scale)), Math.max(64, Math.floor(h * dpr * scale)));
  }

  // Renders the mirrored scene into the reflection texture. Call before the main render.
  updateReflection(scene, camera) {
    this.material.uniforms.useReflection.value = this.reflectionEnabled ? 1 : 0;
    if (!this.reflectionEnabled) return;
    const mesh = this.mesh;
    mesh.updateMatrixWorld();
    camera.updateMatrixWorld();
    this._reflectorWorld.setFromMatrixPosition(mesh.matrixWorld);
    this._camWorld.setFromMatrixPosition(camera.matrixWorld);
    this._rot.extractRotation(mesh.matrixWorld);
    this._normal.set(0, 1, 0);
    this._view.subVectors(this._reflectorWorld, this._camWorld);
    if (this._view.dot(this._normal) > 0) return; // camera below the water
    this._view.reflect(this._normal).negate();
    this._view.add(this._reflectorWorld);

    this._rot.extractRotation(camera.matrixWorld);
    this._lookAt.set(0, 0, -1).applyMatrix4(this._rot).add(this._camWorld);
    this._target.subVectors(this._reflectorWorld, this._lookAt);
    this._target.reflect(this._normal).negate();
    this._target.add(this._reflectorWorld);

    const vc = this._virtualCam;
    vc.position.copy(this._view);
    vc.up.set(0, 1, 0).applyMatrix4(this._rot).reflect(this._normal);
    vc.lookAt(this._target);
    vc.far = camera.far;
    vc.updateMatrixWorld();
    vc.projectionMatrix.copy(camera.projectionMatrix);

    this.textureMatrix.set(0.5, 0, 0, 0.5, 0, 0.5, 0, 0.5, 0, 0, 0.5, 0.5, 0, 0, 0, 1);
    this.textureMatrix.multiply(vc.projectionMatrix);
    this.textureMatrix.multiply(vc.matrixWorldInverse);
    this.textureMatrix.multiply(mesh.matrixWorld);

    // Oblique near plane = the water surface, so nothing below the water is reflected
    this._plane.setFromNormalAndCoplanarPoint(this._normal, this._reflectorWorld);
    this._plane.applyMatrix4(vc.matrixWorldInverse);
    this._clip.set(this._plane.normal.x, this._plane.normal.y, this._plane.normal.z, this._plane.constant);
    const pm = vc.projectionMatrix.elements;
    this._q.x = (Math.sign(this._clip.x) + pm[8]) / pm[0];
    this._q.y = (Math.sign(this._clip.y) + pm[9]) / pm[5];
    this._q.z = -1.0;
    this._q.w = (1.0 + pm[10]) / pm[14];
    this._clip.multiplyScalar(2.0 / this._clip.dot(this._q));
    pm[2] = this._clip.x;
    pm[6] = this._clip.y;
    pm[10] = this._clip.z + 1.0 - 0.003;
    pm[14] = this._clip.w;

    const r = this.webgl;
    const prevTarget = r.getRenderTarget();
    const prevXr = r.xr.enabled;
    const prevShadowAuto = r.shadowMap.autoUpdate;
    r.xr.enabled = false;
    r.shadowMap.autoUpdate = false;
    mesh.visible = false;
    r.setRenderTarget(this.rt);
    r.state.buffers.depth.setMask(true);
    if (r.autoClear === false) r.clear();
    r.render(scene, vc);
    mesh.visible = true;
    r.xr.enabled = prevXr;
    r.shadowMap.autoUpdate = prevShadowAuto;
    r.setRenderTarget(prevTarget);
  }
}
