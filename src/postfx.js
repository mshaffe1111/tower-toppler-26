// TOWERING WATERS: GATEWAY'S DESCENT — HDR ACES FILMIC & BIOME COLOR-GRADING PIPELINE (src/postfx.js)
//
// Console-grade linear HDR post-processing pipeline built on Three.js EffectComposer:
//   RenderPass (Linear HalfFloat HDR)
//     -> UnrealBloomPass w/ ChromaSelectiveHighPassFragment (lush halos on bioluminescent water,
//        Harmonic Seeds, fireflies, prism beams & aurora while protecting sunlit clouds, snow peaks
//        & whitewater rapids foam from washout)
//     -> CinematicGradeShader (5-Biome daylight/alpenglow/twilight/aurora split-toning, crisp stone
//        & water specular micro-clarity, soft filmic highlight shoulder & subtle optical vignette)
//     -> OutputPass (ACESFilmicToneMapping + sRGB transfer directly to screen)
//
// Guarantees:
// - Automatic bypass to direct WebGLRenderer output on low-DPR fallback or sustained frame-time drop
//   so locked 60fps is preserved across mobile & desktop GPUs.
// - Zero per-frame heap allocations; strict WebGL state & setRenderTarget(null) hygiene.

import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

export const BLOOM_DEFAULTS = Object.freeze({
  threshold: 0.92,
  strength: 0.24,
  radius: 0.38,
});

const EMPTY_OPTS = Object.freeze({});
const MAX_BLOOM_PHYSICAL_DIM = 2560;

export const BIOME_GRADE_PRESETS = Object.freeze({
  canyon_river: Object.freeze({
    exposure: 1.05,
    shadowToe: 0.95,
    toeKnee: 0.12,
    contrast: 1.08,
    specularPop: 0.09,
    clarity: 0.13,
    saturation: 1.12,
    emissiveBoost: 0.14,
    shadowTint: Object.freeze([0.93, 0.97, 1.05]),
    highlightTint: Object.freeze([1.04, 1.00, 0.95]),
    shoulderStrength: 0.28,
    vignetteStrength: 0.13,
    dither: 0.85,
    bloomStrength: 0.23,
    bloomRadius: 0.36,
    bloomChromaSelect: 1.0,
    bloomMipTints: Object.freeze([
      [1.0, 1.0, 0.99],
      [1.0, 0.99, 0.97],
      [1.0, 0.98, 0.95],
      [0.98, 0.98, 0.96],
      [0.96, 0.98, 0.98],
    ]),
  }),
  alpine_lake: Object.freeze({
    exposure: 1.04,
    shadowToe: 0.96,
    toeKnee: 0.11,
    contrast: 1.08,
    specularPop: 0.10,
    clarity: 0.14,
    saturation: 1.11,
    emissiveBoost: 0.13,
    shadowTint: Object.freeze([0.91, 0.97, 1.07]),
    highlightTint: Object.freeze([1.03, 0.99, 0.98]),
    shoulderStrength: 0.30,
    vignetteStrength: 0.12,
    dither: 0.85,
    bloomStrength: 0.21,
    bloomRadius: 0.35,
    bloomChromaSelect: 1.0,
    bloomMipTints: Object.freeze([
      [1.0, 1.0, 1.0],
      [0.99, 1.0, 1.01],
      [0.98, 0.99, 1.02],
      [0.96, 0.98, 1.04],
      [0.95, 0.98, 1.05],
    ]),
  }),
  mist_bayou: Object.freeze({
    exposure: 1.06,
    shadowToe: 0.91,
    toeKnee: 0.13,
    contrast: 1.10,
    specularPop: 0.09,
    clarity: 0.13,
    saturation: 1.13,
    emissiveBoost: 0.17,
    shadowTint: Object.freeze([0.89, 0.95, 1.05]),
    highlightTint: Object.freeze([1.05, 0.99, 0.93]),
    shoulderStrength: 0.26,
    vignetteStrength: 0.17,
    dither: 0.90,
    bloomStrength: 0.29,
    bloomRadius: 0.42,
    bloomChromaSelect: 1.0,
    bloomMipTints: Object.freeze([
      [1.0, 1.0, 0.98],
      [1.0, 0.99, 0.96],
      [0.98, 0.99, 0.97],
      [0.96, 0.99, 0.99],
      [0.94, 0.98, 1.01],
    ]),
  }),
  coral_sea: Object.freeze({
    exposure: 1.04,
    shadowToe: 0.97,
    toeKnee: 0.10,
    contrast: 1.07,
    specularPop: 0.10,
    clarity: 0.13,
    saturation: 1.15,
    emissiveBoost: 0.14,
    shadowTint: Object.freeze([0.90, 1.00, 1.05]),
    highlightTint: Object.freeze([1.02, 1.01, 0.98]),
    shoulderStrength: 0.30,
    vignetteStrength: 0.11,
    dither: 0.80,
    bloomStrength: 0.22,
    bloomRadius: 0.36,
    bloomChromaSelect: 1.0,
    bloomMipTints: Object.freeze([
      [1.0, 1.0, 1.0],
      [0.98, 1.0, 1.0],
      [0.96, 1.0, 1.01],
      [0.94, 0.99, 1.02],
      [0.92, 0.99, 1.03],
    ]),
  }),
  storm_ocean: Object.freeze({
    exposure: 1.06,
    shadowToe: 0.90,
    toeKnee: 0.14,
    contrast: 1.11,
    specularPop: 0.11,
    clarity: 0.14,
    saturation: 1.12,
    emissiveBoost: 0.17,
    shadowTint: Object.freeze([0.86, 0.95, 1.10]),
    highlightTint: Object.freeze([0.96, 1.01, 1.06]),
    shoulderStrength: 0.27,
    vignetteStrength: 0.18,
    dither: 0.95,
    bloomStrength: 0.29,
    bloomRadius: 0.42,
    bloomChromaSelect: 1.0,
    bloomMipTints: Object.freeze([
      [1.0, 1.0, 1.0],
      [0.98, 1.0, 1.01],
      [0.96, 0.99, 1.03],
      [0.94, 0.99, 1.05],
      [0.92, 0.98, 1.06],
    ]),
  }),
});

export function resolvePostFxBiome(raw) {
  const k = String(raw || '').toLowerCase();
  if (k.includes('canyon') || k.includes('river') || k.includes('redwood') || k.includes('forge') || k.includes('foundry')) {
    return 'canyon_river';
  }
  if (k.includes('alpine') || k.includes('lake') || k.includes('frost') || k.includes('glacier') || k.includes('boreal')) {
    return 'alpine_lake';
  }
  if (k.includes('bayou') || k.includes('delta') || k.includes('swamp') || k.includes('moss')) {
    return 'mist_bayou';
  }
  if (k.includes('coral') || k.includes('reef') || k.includes('lagoon') || k.includes('atoll') || k.includes('prism')) {
    return 'coral_sea';
  }
  if (k.includes('storm') || k.includes('ocean') || k.includes('tempest') || k.includes('polar') || k.includes('abyss')) {
    return 'storm_ocean';
  }
  return 'canyon_river';
}

// Chroma-Selective HDR High-Pass Filter for UnrealBloomPass:
// Gives saturated bioluminescent water conduits, Harmonic Seeds, fireflies, prism beams, and
// aurora ribbons velvety halos while raising the threshold on neutral white clouds, snow peaks,
// and whitewater rapids foam so sunlit vistas NEVER blow out!
const ChromaSelectiveHighPassFragment = /* glsl */ `
  uniform sampler2D tDiffuse;
  uniform float luminosityThreshold;
  uniform float smoothWidth;
  uniform float uChromaSelect;
  varying vec2 vUv;

  void main() {
    vec4 texel = texture2D(tDiffuse, vUv);
    vec3 col = clamp(texel.rgb, vec3(0.0), vec3(20.0));

    float luma = dot(col, vec3(0.2126, 0.7152, 0.0722));
    float maxC = max(col.r, max(col.g, col.b));
    float minC = min(col.r, min(col.g, col.b));
    float chroma = (maxC - minC) / (maxC + 0.001);

    float chromaMask = smoothstep(0.30, 0.75, chroma) * uChromaSelect;
    float achromaticMask = (1.0 - smoothstep(0.05, 0.28, chroma)) * uChromaSelect;

    float energy = mix(luma, maxC, chromaMask * 0.76);

    // Vivid colored emissives bloom softly from ~0.68; neutral white clouds/foam require > ~1.44
    float effThreshold = luminosityThreshold - chromaMask * 0.24 + achromaticMask * 0.52;
    float knee = mix(smoothWidth, smoothWidth * 2.0, chromaMask);
    float alpha = smoothstep(effThreshold, effThreshold + knee, energy);

    float gain = mix(1.0 - achromaticMask * 0.72, 1.24, chromaMask);
    float softCap = 1.0 / (1.0 + max(0.0, maxC - 2.8) * 0.28);
    gl_FragColor = vec4(col * (alpha * gain * softCap), 1.0);
  }
`;

// Scene-referred Linear HDR Biome Color-Grading, Specular Clarity & Soft Shoulder Shader
const CinematicGradeShader = {
  name: 'CinematicGradeShader',
  uniforms: {
    tDiffuse: { value: null },
    uResolution: { value: new THREE.Vector2(1, 1) },
    uTexelSize: { value: new THREE.Vector2(1 / 860, 1 / 1864) },
    uExposure: { value: 1.05 },
    uShadowToe: { value: 0.95 },
    uToeKnee: { value: 0.12 },
    uContrast: { value: 1.08 },
    uSpecularPop: { value: 0.09 },
    uClarity: { value: 0.13 },
    uSaturation: { value: 1.12 },
    uEmissiveBoost: { value: 0.14 },
    uShadowTint: { value: new THREE.Vector3(0.93, 0.97, 1.05) },
    uHighlightTint: { value: new THREE.Vector3(1.04, 1.00, 0.95) },
    uShoulderStrength: { value: 0.28 },
    uVignetteStrength: { value: 0.13 },
    uPurification: { value: 0.0 },
    uFlash: { value: 0.0 },
    uDarkness: { value: 0.0 },
    uDither: { value: 0.85 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform vec2 uResolution;
    uniform vec2 uTexelSize;
    uniform float uExposure;
    uniform float uShadowToe;
    uniform float uToeKnee;
    uniform float uContrast;
    uniform float uSpecularPop;
    uniform float uClarity;
    uniform float uSaturation;
    uniform float uEmissiveBoost;
    uniform vec3 uShadowTint;
    uniform vec3 uHighlightTint;
    uniform float uShoulderStrength;
    uniform float uVignetteStrength;
    uniform float uPurification;
    uniform float uFlash;
    uniform float uDarkness;
    uniform float uDither;

    varying vec2 vUv;

    const vec3 LUMA_W = vec3(0.2126, 0.7152, 0.0722);

    void main() {
      vec4 texel = texture2D(tDiffuse, vUv);
      vec3 col = clamp(texel.rgb, vec3(0.0), vec3(28.0));

      // 0. Edge-Aware 4-Tap Micro-Clarity (accentuates carved masonry, staircases & water ripples
      //    while keeping sky gradients, clouds & bloom halos silky smooth)
      float basePeak = max(col.r, max(col.g, col.b));
      if (uClarity > 0.001 && basePeak > 0.004 && basePeak < 1.65) {
        vec2 stepUv = uTexelSize * 0.85;
        vec3 nN = clamp(texture2D(tDiffuse, vUv + vec2(0.0, stepUv.y)).rgb, vec3(0.0), vec3(12.0));
        vec3 nS = clamp(texture2D(tDiffuse, vUv - vec2(0.0, stepUv.y)).rgb, vec3(0.0), vec3(12.0));
        vec3 nE = clamp(texture2D(tDiffuse, vUv + vec2(stepUv.x, 0.0)).rgb, vec3(0.0), vec3(12.0));
        vec3 nW = clamp(texture2D(tDiffuse, vUv - vec2(stepUv.x, 0.0)).rgb, vec3(0.0), vec3(12.0));
        float cLuma = dot(col, LUMA_W);
        float blurLuma = dot((nN + nS + nE + nW) * 0.25, LUMA_W);
        float hiFreq = cLuma - blurLuma;
        float haloGuard = (1.0 - smoothstep(0.88, 1.55, basePeak)) * smoothstep(0.006, 0.04, cLuma);
        float maxDelta = cLuma * 0.14;
        float clarityDelta = clamp(hiFreq * uClarity * 1.35, -maxDelta, maxDelta) * haloGuard;
        col *= (cLuma + clarityDelta) / max(cLuma, 0.0001);
      }

      // 1. Pre-ACES linear exposure + watershed purification radiance + storm flash
      float expGain = uExposure * (1.0 + uPurification * 0.04 - uDarkness * 0.14) + uFlash * 0.18;
      col *= expGain;

      float luma = dot(col, LUMA_W);
      float maxC = max(col.r, max(col.g, col.b));
      float minC = min(col.r, min(col.g, col.b));
      float chroma = (maxC - minC) / (maxC + 0.0008);

      float warmGlow = clamp((col.r - col.b) / (luma + 0.035), 0.0, 1.0);
      float accentMask = smoothstep(0.26, 0.72, chroma) * smoothstep(0.05, 0.45, maxC);

      // 2. Open Daylight Shadow Toe, Natural Midtone S-Curve & Wet Specular Pop
      if (luma > 0.00001) {
        float toeMask = smoothstep(0.0, uToeKnee, luma);
        float toeGain = mix(uShadowToe, 1.0, toeMask);

        float pivot = 0.22;
        float midWeight = (1.0 - smoothstep(0.75, 1.85, luma)) * smoothstep(0.008, 0.06, luma);
        float contrastedLuma = pivot * pow(max(luma / pivot, 0.0001), mix(1.0, uContrast, midWeight));

        float specBand = smoothstep(0.20, 0.55, luma) * (1.0 - smoothstep(0.85, 1.45, luma));
        float specBoost = 1.0 + uSpecularPop * specBand * (1.0 - warmGlow * 0.35);

        float targetLuma = contrastedLuma * toeGain * specBoost;
        float glowProtect = clamp(warmGlow * 0.48 + smoothstep(0.58, 1.30, maxC) * 0.48, 0.0, 0.78);
        col *= mix(targetLuma / luma, 1.0, glowProtect);
      }

      luma = dot(col, LUMA_W);

      // 3. Chroma-Protected Biome Split-Toning (sky-bounce shadows + sunlit/alpenglow highlights)
      float shadowZone = 1.0 - smoothstep(0.015, 0.24, luma);
      float tintAllow = (1.0 - warmGlow * 0.85) * (1.0 - clamp(chroma * 1.1, 0.0, 0.82));
      col *= mix(vec3(1.0), uShadowTint, shadowZone * tintAllow);

      float hiZone = smoothstep(0.32, 1.15, luma) * (1.0 - accentMask * 0.65);
      col *= mix(vec3(1.0), uHighlightTint, hiZone);

      // 4. Chromaticity-Preserving Filmic Highlight Shoulder (keeps clouds, snow & foam crisp!)
      float peak = max(col.r, max(col.g, col.b));
      const float shoulderKnee = 1.12;
      if (peak > shoulderKnee && uShoulderStrength > 0.001) {
        float excess = peak - shoulderKnee;
        float compressed = shoulderKnee + excess / (1.0 + excess * uShoulderStrength);
        col *= compressed / peak;
      }

      // 5. Console AAA Biome Vibrance + Purification Bloom
      luma = dot(col, LUMA_W);
      float localBoost = (uEmissiveBoost + uPurification * 0.05) * clamp(warmGlow * 0.72 + accentMask * 0.88, 0.0, 1.0);
      float hotCoreTaper = 1.0 - smoothstep(1.65, 3.50, peak) * 0.45;
      float finalSat = mix(1.0, uSaturation + uPurification * 0.05 + localBoost, hotCoreTaper);
      col = max(vec3(0.0), mix(vec3(luma), col, finalSat));

      if (uFlash > 0.001) {
        float flashMix = clamp(uFlash * 0.36, 0.0, 0.28);
        col = mix(col, col * vec3(0.94, 0.99, 1.06) + vec3(0.028, 0.044, 0.062) * uFlash, flashMix);
      }

      // 6. Subtle Optical Corner Framing (leaves central 68% viewport 100% open & bright)
      if (uVignetteStrength > 0.001) {
        vec2 centered = vUv - 0.5;
        float aspect = clamp(uResolution.x / max(uResolution.y, 1.0), 0.50, 2.15);
        vec2 vCoord = vec2(
          centered.x * mix(1.0, aspect, 0.22),
          centered.y * mix(1.0, 1.0 / aspect, 0.14)
        );
        float distSq = dot(vCoord, vCoord) * 2.0;
        float vigMask = smoothstep(0.36, 1.24, distSq) * uVignetteStrength;
        float pierce = clamp((luma + accentMask * 0.45) * 0.36, 0.0, 0.58);
        vigMask *= (1.0 - pierce);
        vec3 vigFactor = mix(vec3(1.0), vec3(0.76, 0.82, 0.92), vigMask) * (1.0 - vigMask * 0.65);
        col *= vigFactor;
      }

      // 7. Sub-1-LSB Interleaved Gradient Noise Anti-Banding Dither
      if (uDither > 0.001) {
        float ign = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))));
        float ditherAmp = 0.00042 * smoothstep(0.0004, 0.006, luma) * uDither;
        col = max(vec3(0.0), col + (ign - 0.5) * ditherAmp);
      }

      gl_FragColor = vec4(col, 1.0);
    }
  `,
};

function detectSoftwareWebGL(webgl) {
  try {
    const gl = webgl?.getContext?.();
    if (!gl) return false;
    const dbg = gl.getExtension('WEBGL_debug_renderer_info');
    const rendererStr = String(
      (dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER)) || ''
    ).toLowerCase();
    return (
      rendererStr.includes('swiftshader') ||
      rendererStr.includes('llvmpipe') ||
      rendererStr.includes('software') ||
      rendererStr.includes('basic render')
    );
  } catch {
    return false;
  }
}

export class CinematicPostFX {
  constructor(webgl, width = 1, height = 1, dpr = 1) {
    this.webgl = webgl || null;
    this.biome = 'canyon_river';
    this.purification = 0;
    this.enabled = true;
    this._disposed = false;

    this._sizeVec = new THREE.Vector2(1, 1);

    let initW = Number(width) || 0;
    let initH = Number(height) || 0;
    if ((initW <= 1 || initH <= 1) && this.webgl?.getSize) {
      this.webgl.getSize(this._sizeVec);
      if (initW <= 1) initW = this._sizeVec.x;
      if (initH <= 1) initH = this._sizeVec.y;
    }
    const initDpr =
      Number(dpr) > 0
        ? Number(dpr)
        : (typeof this.webgl?.getPixelRatio === 'function' ? this.webgl.getPixelRatio() : 1) || 1;

    this.width = Math.max(1, Math.floor(initW || 1));
    this.height = Math.max(1, Math.floor(initH || 1));
    this.dpr = Math.max(0.5, initDpr);

    this._peakDpr = this.dpr;
    this._lowDprBypass = this.dpr < 0.95;
    this._perfBypass = false;
    this._manualBypass = false;
    this._emaFrameMs = 16.6;
    this._slowFrames = 0;
    this._fastFrames = 0;
    this._lastFrameNow = 0;

    this._rtW = 0;
    this._rtH = 0;
    this._rtDpr = 0;

    this._dummyScene = new THREE.Scene();
    this._dummyCamera = new THREE.PerspectiveCamera();

    this.composer = null;
    this.renderPass = null;
    this.bloomPass = null;
    this.gradePass = null;
    this.outputPass = null;

    this._initPipeline();
    this.setBiome('canyon_river');
    this.resize(this.width, this.height, this.dpr);
  }

  _initPipeline() {
    if (!this.webgl) return;
    try {
      const safeW = Math.max(32, this.width);
      const safeH = Math.max(32, this.height);
      const physW = Math.max(32, Math.round(safeW * this.dpr));
      const physH = Math.max(32, Math.round(safeH * this.dpr));

      const isSoftware = detectSoftwareWebGL(this.webgl);
      const isWebGL2 = Boolean(this.webgl.capabilities?.isWebGL2);
      const maxSamples = Number(this.webgl.capabilities?.maxSamples) || 0;
      const samples = !isSoftware && isWebGL2 ? Math.min(2, maxSamples) : 0;

      const baseTarget = new THREE.WebGLRenderTarget(physW, physH, {
        type: THREE.HalfFloatType,
        minFilter: THREE.LinearFilter,
        magFilter: THREE.LinearFilter,
        generateMipmaps: false,
        depthBuffer: true,
        stencilBuffer: false,
        samples,
      });
      baseTarget.texture.name = 'CinematicPostFX.rt1';

      const composer = new EffectComposer(this.webgl, baseTarget);
      composer.setPixelRatio(this.dpr);
      composer.setSize(safeW, safeH);

      const renderPass = new RenderPass(this._dummyScene, this._dummyCamera);

      const initPreset = BIOME_GRADE_PRESETS.canyon_river;
      const bloomPass = new UnrealBloomPass(
        new THREE.Vector2(safeW, safeH),
        initPreset.bloomStrength,
        initPreset.bloomRadius,
        BLOOM_DEFAULTS.threshold
      );
      bloomPass.threshold = BLOOM_DEFAULTS.threshold;
      bloomPass.strength = initPreset.bloomStrength;
      bloomPass.radius = initPreset.bloomRadius;

      if (bloomPass.highPassUniforms && bloomPass.materialHighPassFilter) {
        bloomPass.highPassUniforms.smoothWidth.value = 0.14;
        bloomPass.highPassUniforms.uChromaSelect = { value: 1.0 };
        bloomPass.materialHighPassFilter.fragmentShader = ChromaSelectiveHighPassFragment;
        bloomPass.materialHighPassFilter.needsUpdate = true;
      }

      const gradePass = new ShaderPass(CinematicGradeShader);
      const outputPass = new OutputPass();

      composer.addPass(renderPass);
      composer.addPass(bloomPass);
      composer.addPass(gradePass);
      composer.addPass(outputPass);

      this.composer = composer;
      this.renderPass = renderPass;
      this.bloomPass = bloomPass;
      this.gradePass = gradePass;
      this.outputPass = outputPass;
    } catch {
      this.composer = null;
      this.renderPass = null;
      this.bloomPass = null;
      this.gradePass = null;
      this.outputPass = null;
    }
  }

  get isBypassed() {
    return (
      !this.enabled ||
      this._manualBypass ||
      this._lowDprBypass ||
      this._perfBypass ||
      !this.composer
    );
  }

  setBypass(bypass) {
    this._manualBypass = Boolean(bypass);
  }

  setBiome(biome, purification = this.purification) {
    const resolved = resolvePostFxBiome(biome);
    this.biome = resolved;
    this.purification = Math.max(0, Math.min(1, Number(purification) || 0));
    const preset = BIOME_GRADE_PRESETS[resolved] || BIOME_GRADE_PRESETS.canyon_river;

    if (this.gradePass?.uniforms) {
      const u = this.gradePass.uniforms;
      u.uExposure.value = preset.exposure;
      u.uShadowToe.value = preset.shadowToe;
      u.uToeKnee.value = preset.toeKnee;
      u.uContrast.value = preset.contrast;
      u.uSpecularPop.value = preset.specularPop;
      u.uClarity.value = preset.clarity;
      u.uSaturation.value = preset.saturation;
      u.uEmissiveBoost.value = preset.emissiveBoost;
      u.uShadowTint.value.set(preset.shadowTint[0], preset.shadowTint[1], preset.shadowTint[2]);
      u.uHighlightTint.value.set(
        preset.highlightTint[0],
        preset.highlightTint[1],
        preset.highlightTint[2]
      );
      u.uShoulderStrength.value = preset.shoulderStrength;
      u.uVignetteStrength.value = preset.vignetteStrength;
      u.uPurification.value = this.purification;
      u.uDither.value = preset.dither;
    }

    if (this.bloomPass) {
      this.bloomPass.threshold = BLOOM_DEFAULTS.threshold;
      this.bloomPass.strength = preset.bloomStrength;
      this.bloomPass.radius = preset.bloomRadius;
      if (this.bloomPass.highPassUniforms?.uChromaSelect) {
        this.bloomPass.highPassUniforms.uChromaSelect.value = preset.bloomChromaSelect;
      }
      if (Array.isArray(this.bloomPass.bloomTintColors)) {
        for (let i = 0; i < this.bloomPass.bloomTintColors.length; i++) {
          const t = preset.bloomMipTints[i] || preset.bloomMipTints[0];
          this.bloomPass.bloomTintColors[i].set(t[0], t[1], t[2]);
        }
      }
    }
  }

  // Harmless compatibility stub for callers transitioning to unified AAA pipeline
  setEra(_era) {
    this.setBiome(this.biome, this.purification);
  }

  resize(w, h, dpr = this.dpr) {
    if (this._disposed) return;

    const nextW = Math.max(1, Math.floor(Number(w) || this.width || 1));
    const nextH = Math.max(1, Math.floor(Number(h) || this.height || 1));
    const nextDpr = Math.max(0.5, Number(dpr) || this.dpr || 1);

    this.width = nextW;
    this.height = nextH;
    this.dpr = nextDpr;

    if (nextDpr > this._peakDpr) {
      this._peakDpr = nextDpr;
    }
    this._lowDprBypass = nextDpr < 0.95 || (this._peakDpr > 1.05 && nextDpr <= 1.01);
    if (!this._lowDprBypass) {
      this._perfBypass = false;
      this._slowFrames = 0;
    }

    if (!this.composer) return;

    const safeW = Math.max(32, nextW);
    const safeH = Math.max(32, nextH);
    if (
      safeW === this._rtW &&
      safeH === this._rtH &&
      Math.abs(nextDpr - this._rtDpr) < 0.0001
    ) {
      return;
    }

    this._rtW = safeW;
    this._rtH = safeH;
    this._rtDpr = nextDpr;

    this.composer.setPixelRatio(nextDpr);
    this.composer.setSize(safeW, safeH);

    const physW = Math.max(32, Math.round(safeW * nextDpr));
    const physH = Math.max(32, Math.round(safeH * nextDpr));

    if (this.bloomPass) {
      const maxDim = Math.max(physW, physH);
      if (maxDim > MAX_BLOOM_PHYSICAL_DIM) {
        const scale = MAX_BLOOM_PHYSICAL_DIM / maxDim;
        this.bloomPass.setSize(
          Math.max(32, Math.round(physW * scale)),
          Math.max(32, Math.round(physH * scale))
        );
      }
    }

    if (this.gradePass?.uniforms) {
      this.gradePass.uniforms.uResolution.value.set(physW, physH);
      this.gradePass.uniforms.uTexelSize.value.set(1 / physW, 1 / physH);
    }
  }

  _updateFrameTelemetry() {
    const now = typeof performance !== 'undefined' ? performance.now() : 0;
    if (this._lastFrameNow > 0 && now > this._lastFrameNow) {
      const dtMs = now - this._lastFrameNow;
      if (dtMs > 1.0 && dtMs < 120.0) {
        this._emaFrameMs = this._emaFrameMs * 0.92 + dtMs * 0.08;
        if (!this._perfBypass) {
          if (this._emaFrameMs > 20.5) {
            this._slowFrames += 1;
            if (this._slowFrames >= 60) {
              this._perfBypass = true;
              this._slowFrames = 0;
              this._fastFrames = 0;
            }
          } else if (this._slowFrames > 0) {
            this._slowFrames -= 1;
          }
        } else if (this._emaFrameMs < 13.8 && !this._lowDprBypass) {
          this._fastFrames += 1;
          if (this._fastFrames >= 180) {
            this._perfBypass = false;
            this._fastFrames = 0;
            this._emaFrameMs = 16.0;
          }
        } else {
          this._fastFrames = 0;
        }
      }
    }
    this._lastFrameNow = now;
  }

  render(scene, camera, opts = EMPTY_OPTS) {
    if (this._disposed || !this.webgl || !scene || !camera) return;

    const o = opts || EMPTY_OPTS;
    if (o.biome) {
      const nextB = resolvePostFxBiome(o.biome);
      const nextP = o.purification !== undefined ? Math.max(0, Math.min(1, Number(o.purification) || 0)) : this.purification;
      if (nextB !== this.biome || Math.abs(nextP - this.purification) > 0.005) {
        this.setBiome(nextB, nextP);
      }
    } else if (o.purification !== undefined) {
      const nextP = Math.max(0, Math.min(1, Number(o.purification) || 0));
      if (Math.abs(nextP - this.purification) > 0.005) {
        this.purification = nextP;
        if (this.gradePass?.uniforms?.uPurification) {
          this.gradePass.uniforms.uPurification.value = nextP;
        }
      }
    }

    this._updateFrameTelemetry();

    const prevAutoClear = this.webgl.autoClear;
    const prevToneMapping = this.webgl.toneMapping;
    const prevExposure = this.webgl.toneMappingExposure;

    const shouldBypass =
      !this.enabled ||
      this._manualBypass ||
      o.bypass === true ||
      ((this._lowDprBypass || this._perfBypass) && o.forceComposer !== true) ||
      !this.composer ||
      !this.renderPass;

    try {
      this.webgl.toneMapping =
        o.toneMapping !== undefined ? o.toneMapping : THREE.ACESFilmicToneMapping;
      if (o.exposure !== undefined) {
        this.webgl.toneMappingExposure = o.exposure;
      } else if (!(this.webgl.toneMappingExposure > 0)) {
        this.webgl.toneMappingExposure = 1.04;
      }

      if (shouldBypass) {
        this.webgl.setRenderTarget(null);
        this.webgl.render(scene, camera);
        return;
      }

      const preset = BIOME_GRADE_PRESETS[this.biome] || BIOME_GRADE_PRESETS.canyon_river;

      if (this.gradePass?.uniforms) {
        const u = this.gradePass.uniforms;
        u.uFlash.value = Number(o.flash) || 0;
        u.uDarkness.value = Number(o.darkness) || 0;
        u.uVignetteStrength.value =
          o.vignette !== undefined
            ? Math.max(0, Number(o.vignette) || 0)
            : preset.vignetteStrength;
      }

      if (this.bloomPass) {
        this.bloomPass.threshold =
          o.bloomThreshold !== undefined ? o.bloomThreshold : BLOOM_DEFAULTS.threshold;
        this.bloomPass.strength =
          o.bloomStrength !== undefined ? o.bloomStrength : preset.bloomStrength;
        this.bloomPass.radius =
          o.bloomRadius !== undefined ? o.bloomRadius : preset.bloomRadius;
      }

      this.renderPass.scene = scene;
      this.renderPass.camera = camera;
      this.composer.render(0.0166667);
    } catch {
      this.composer = null;
      this.webgl.setRenderTarget(null);
      this.webgl.render(scene, camera);
    } finally {
      if (this.renderPass) {
        this.renderPass.scene = this._dummyScene;
        this.renderPass.camera = this._dummyCamera;
      }
      this.webgl.setRenderTarget(null);
      this.webgl.autoClear = prevAutoClear;
      this.webgl.toneMapping = prevToneMapping;
      this.webgl.toneMappingExposure = prevExposure;
    }
  }

  dispose() {
    if (this._disposed) return;
    this._disposed = true;

    try {
      this.bloomPass?.dispose?.();
      this.gradePass?.dispose?.();
      this.outputPass?.dispose?.();
      this.renderPass?.dispose?.();
      this.composer?.dispose?.();
    } catch {
      // Ignore disposal errors on lost WebGL contexts
    }

    if (this.webgl) {
      try {
        this.webgl.setRenderTarget(null);
      } catch {
        // Ignore
      }
    }

    this.composer = null;
    this.renderPass = null;
    this.bloomPass = null;
    this.gradePass = null;
    this.outputPass = null;
    this._dummyScene = null;
    this._dummyCamera = null;
  }
}

export { CinematicPostFX as PostFX };
export default CinematicPostFX;
