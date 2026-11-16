// Post-processing for the tower scene: "toy diorama" tilt-shift, soft bloom on neon/emissive
// parts, and a gentle film grade. Plus an automatic quality manager that watches the frame
// rate and steps resolution / shadows / effects down (or back up) to keep the game smooth.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

// Separable tilt-shift blur: sharp band around `focus` (in uv.y), increasingly blurred above/below
const TiltShiftShader = {
  uniforms: {
    tDiffuse: { value: null },
    delta: { value: new THREE.Vector2(1, 0) },
    focus: { value: 0.42 },
    band: { value: 0.26 },
    amount: { value: 1.0 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform vec2 delta;
    uniform float focus;
    uniform float band;
    uniform float amount;
    varying vec2 vUv;
    void main() {
      // Asymmetric: the climb above you stays readable; the sea below melts into miniature blur
      float above = vUv.y > focus ? 0.35 : 1.0;
      float d = max(0.0, abs(vUv.y - focus) - band);
      float blur = clamp(d * 2.6, 0.0, 1.0) * amount * above;
      if (blur < 0.01) { gl_FragColor = texture2D(tDiffuse, vUv); return; }
      vec4 sum = vec4(0.0);
      float total = 0.0;
      for (int i = -4; i <= 4; i++) {
        float w = 1.0 - abs(float(i)) / 5.0;
        sum += texture2D(tDiffuse, vUv + delta * float(i) * blur * 1.6) * w;
        total += w;
      }
      gl_FragColor = sum / total;
    }
  `,
};

// Final grade: subtle warmth, saturation lift, and animated film grain
const GradeShader = {
  uniforms: {
    tDiffuse: { value: null },
    time: { value: 0 },
    grain: { value: 0.035 },
    warmth: { value: 0.04 },
    saturation: { value: 1.08 },
    flash: { value: 0 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float time;
    uniform float grain;
    uniform float warmth;
    uniform float saturation;
    uniform float flash;
    varying vec2 vUv;
    float rand(vec2 co) { return fract(sin(dot(co, vec2(12.9898, 78.233))) * 43758.5453); }
    void main() {
      vec4 c = texture2D(tDiffuse, vUv);
      float l = dot(c.rgb, vec3(0.299, 0.587, 0.114));
      c.rgb = mix(vec3(l), c.rgb, saturation);
      c.rgb += vec3(warmth, warmth * 0.4, -warmth * 0.6) * (1.0 - l);
      c.rgb += (rand(vUv * 731.0 + fract(time)) - 0.5) * grain;
      c.rgb = mix(c.rgb, vec3(0.85, 0.9, 1.0), flash);
      gl_FragColor = vec4(clamp(c.rgb, 0.0, 1.0), c.a);
    }
  `,
};

export const QUALITY_TIERS = ['low', 'medium', 'high'];

export class PostFX {
  constructor(webgl, { onTierChange } = {}) {
    this.webgl = webgl;
    this.onTierChange = onTierChange;
    this.enabled = true;
    this.composer = null;
    this.scene = null;
    this.camera = null;
    this.width = 1;
    this.height = 1;
    this.diorama = true;
    this.mode = 'auto';
    const coarse = typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches;
    this.autoCeiling = coarse ? 'medium' : 'high';
    this.tier = this.autoCeiling;
    this._acc = 0;
    this._frames = 0;
    this._good = 0;
  }

  attach(scene, camera) {
    this.scene = scene;
    this.camera = camera;
    this._build();
  }

  _build() {
    if (this.composer) this.composer.dispose?.();
    const c = new EffectComposer(this.webgl);
    this.renderPass = new RenderPass(this.scene, this.camera);
    c.addPass(this.renderPass);
    this.bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.55, 0.5, 0.82);
    c.addPass(this.bloom);
    c.addPass(new OutputPass());
    this.tiltH = new ShaderPass(TiltShiftShader);
    this.tiltV = new ShaderPass(TiltShiftShader);
    c.addPass(this.tiltH);
    c.addPass(this.tiltV);
    this.grade = new ShaderPass(GradeShader);
    c.addPass(this.grade);
    this.composer = c;
    this._applyTier();
  }

  setMode(mode) {
    this.mode = mode;
    if (mode !== 'auto') this.tier = mode;
    else this.tier = this.autoCeiling;
    this._applyTier();
  }

  setDiorama(on) {
    this.diorama = on;
    this._applyTier();
  }

  get pixelRatioCap() {
    return this.tier === 'high' ? 2 : this.tier === 'medium' ? 1.5 : 1;
  }

  _applyTier() {
    const t = this.tier;
    this.useComposer = t !== 'low';
    if (this.bloom) this.bloom.enabled = t === 'high' || t === 'medium';
    if (this.bloom) this.bloom.strength = t === 'high' ? 0.6 : 0.45;
    const tilt = this.diorama && t !== 'low';
    if (this.tiltH) this.tiltH.enabled = tilt;
    if (this.tiltV) this.tiltV.enabled = tilt;
    this.onTierChange?.(t);
  }

  resize(w, h, dpr) {
    this.width = w;
    this.height = h;
    if (!this.composer) return;
    this.composer.setPixelRatio(dpr);
    this.composer.setSize(w, h);
    // Bloom at half resolution is plenty and much cheaper
    this.bloom.resolution.set(Math.max(64, w * 0.5), Math.max(64, h * 0.5));
    const px = 1 / Math.max(1, w * dpr);
    const py = 1 / Math.max(1, h * dpr);
    this.tiltH.uniforms.delta.value.set(px * 1.6 * dpr, 0);
    this.tiltV.uniforms.delta.value.set(0, py * 1.6 * dpr);
  }

  // Called once per frame with real (unscaled) dt
  monitor(dt) {
    if (this.mode !== 'auto' || dt <= 0 || dt > 0.25) return;
    this._acc += dt;
    this._frames += 1;
    if (this._acc < 2.5) return;
    const fps = this._frames / this._acc;
    this._acc = 0;
    this._frames = 0;
    const idx = QUALITY_TIERS.indexOf(this.tier);
    if (fps < 44 && idx > 0) {
      this.tier = QUALITY_TIERS[idx - 1];
      this._good = 0;
      this._applyTier();
    } else if (fps > 58) {
      this._good += 1;
      const ceil = QUALITY_TIERS.indexOf(this.autoCeiling);
      if (this._good >= 4 && idx < ceil) {
        this.tier = QUALITY_TIERS[idx + 1];
        this._good = 0;
        this._applyTier();
      }
    } else {
      this._good = 0;
    }
  }

  render({ time = 0, focus = 0.42, flash = 0, darkness = 0 } = {}) {
    if (!this.useComposer || !this.composer) {
      this.webgl.render(this.scene, this.camera);
      return;
    }
    this.tiltH.uniforms.focus.value = focus;
    this.tiltV.uniforms.focus.value = focus;
    this.grade.uniforms.time.value = time;
    this.grade.uniforms.flash.value = flash;
    this.grade.uniforms.warmth.value = darkness > 0.5 ? 0.0 : 0.035;
    this.composer.render();
  }
}
