// TOWER TOPPLER '26 — UNIFIED CINEMATIC COLOR-GRADING & SELECTIVE-BLOOM PIPELINE (src/postfx.js)
//
// UE5 / PlayStation-grade HDR linear post-processing pipeline built on Three.js EffectComposer:
//   RenderPass (Linear HalfFloat HDR)
//     -> UnrealBloomPass w/ ChromaSelectiveHighPassShader (lush soft halos on colored emissives —
//        #5efce8 fireflies/runes, #ffaa33 cage lifts, #ff7722 sparks, #c026ff amethyst, fire —
//        while suppressing neutral white ocean-glint & seafoam washout!)
//     -> CinematicGradeShader (UE5 chiaroscuro shadow toe for #040812 crevices, wet-stone silver
//        specular pop, 4-tap L1-cached micro-clarity, chroma-protected split-toning & vignette)
//     -> OutputPass (ACESFilmicToneMapping + sRGB transfer directly to screen)
//
// Era Profiles:
// - 'reboot': Deep UE5 chiaroscuro shadow toe (#040812 crevices, strictly zero black-floor lift —
//   NEVER milky grey or washed-out white), crisp wet-stone cool-silver specular sheen, lush
//   chroma-selective bloom halos without ocean washout, localized warm/bio glow preservation, and
//   optical corner vignette framing matching reference_north_star.jpg.
// - 'original': Crisp, punchy, zero-vignette 2007–2010 XBLA HD arcade vibrance.
//
// Guarantees:
// - Automatic bypass to direct WebGLRenderer output on low-DPR fallback (or sustained frame-time drop)
//   so 60fps is locked across mobile & desktop hardware.
// - Zero per-frame heap allocations; strict WebGL state & setRenderTarget(null) hygiene.

import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

export const BLOOM_DEFAULTS = Object.freeze({
  threshold: 0.88,
  strength: 0.26,
  radius: 0.32,
});

const EMPTY_OPTS = Object.freeze({});
const MAX_BLOOM_PHYSICAL_DIM = 2560;

const ERA_PRESETS = Object.freeze({
  reboot: Object.freeze({
    eraMix: 0.0,
    exposure: 1.02,
    // Deep UE5 chiaroscuro pre-ACES toe: carves #040812 mortar crevices, doorway interiors & overhang
    // cast shadows while keeping pure 0.0 at [0,0,0] (strictly zero milky grey lift!)
    shadowToe: 0.80,
    toeKnee: 0.15,
    contrast: 1.12,
    specularPop: 0.10,
    clarity: 0.15,
    saturation: 1.08,
    emissiveBoost: 0.16,
    // Multiplicative abyssal midnight-indigo crevice split-tone (0.0 * tint === 0.0)
    shadowTint: Object.freeze([0.78, 0.88, 1.18]),
    // Crisp cool-silver moonlit wet-slate specular & cloud-rim sheen
    highlightTint: Object.freeze([0.92, 0.98, 1.07]),
    shoulderStrength: 0.26,
    vignetteStrength: 0.28,
    dither: 1.0,
    // Chroma-selective bloom tuning: lush soft halos on fireflies/sparks/lifts/runes, zero ocean wash
    bloomStrength: 0.34,
    bloomRadius: 0.44,
    bloomChromaSelect: 1.0,
    bloomMipTints: Object.freeze([
      [1.0, 1.0, 1.0],
      [1.0, 0.99, 1.0],
      [0.98, 0.99, 1.02],
      [0.95, 0.98, 1.04],
      [0.92, 0.97, 1.06],
    ]),
  }),
  original: Object.freeze({
    eraMix: 1.0,
    exposure: 1.05,
    shadowToe: 0.96,
    toeKnee: 0.12,
    contrast: 1.08,
    specularPop: 0.04,
    clarity: 0.09,
    saturation: 1.17,
    emissiveBoost: 0.09,
    // Pure neutral shadows & highlights so 2008 XBLA jewel-toned bricks stay 100% hue-true
    shadowTint: Object.freeze([1.0, 1.0, 1.0]),
    highlightTint: Object.freeze([1.0, 1.0, 1.0]),
    shoulderStrength: 0.16,
    // Strictly zero vignette in Original 2007–2010 XBLA HD mode
    vignetteStrength: 0.0,
    dither: 0.75,
    bloomStrength: 0.24,
    bloomRadius: 0.30,
    bloomChromaSelect: 0.35,
    bloomMipTints: Object.freeze([
      [1.0, 1.0, 1.0],
      [1.0, 1.0, 1.0],
      [1.0, 1.0, 1.0],
      [1.0, 1.0, 1.0],
      [1.0, 1.0, 1.0],
    ]),
  }),
});

// Custom Chroma-Selective HDR High-Pass Filter for UnrealBloomPass:
// Measures saturated emissives (#5efce8 fireflies/runes, #ff7722 sparks, #ffaa33 cage lifts,
// #c026ff amethyst crystals, brazier fire) by peak spectral radiance with a lower chroma-assisted
// threshold so colored glows get lush soft halos, while raising the threshold on neutral white
// ocean reflections & seafoam so the storm sea NEVER washes out!
const ChromaSelectiveHighPassFragment = /* glsl */ `
  uniform sampler2D tDiffuse;
  uniform float luminosityThreshold;
  uniform float smoothWidth;
  uniform float uChromaSelect;
  varying vec2 vUv;

  void main() {
    vec4 texel = texture2D(tDiffuse, vUv);
    vec3 col = clamp(texel.rgb, vec3(0.0), vec3(24.0));

    float luma = dot(col, vec3(0.2126, 0.7152, 0.0722));
    float maxC = max(col.r, max(col.g, col.b));
    float minC = min(col.r, min(col.g, col.b));
    float chroma = (maxC - minC) / (maxC + 0.001);

    float chromaMask = smoothstep(0.28, 0.72, chroma) * uChromaSelect;
    float achromaticMask = (1.0 - smoothstep(0.04, 0.26, chroma)) * uChromaSelect;

    // Peak-channel weighting ensures violet, deep-orange & cyan emissives bloom equally with gold/green
    float energy = mix(luma, maxC, chromaMask * 0.78);

    // Vivid colored emissives bloom softly from ~0.62; neutral white surf/ocean glare requires > ~1.28
    float effThreshold = luminosityThreshold - chromaMask * 0.26 + achromaticMask * 0.40;
    float knee = mix(smoothWidth, smoothWidth * 2.1, chromaMask);
    float alpha = smoothstep(effThreshold, effThreshold + knee, energy);

    float gain = mix(1.0 - achromaticMask * 0.65, 1.30, chromaMask);
    // Tame extreme single-pixel spark spikes so bloom halos stay velvety rather than streaky
    float softCap = 1.0 / (1.0 + max(0.0, maxC - 3.2) * 0.24);
    gl_FragColor = vec4(col * (alpha * gain * softCap), 1.0);
  }
`;

// Scene-referred Linear HDR Chiaroscuro Color-Grading, Wet-Specular Clarity & Vignette Shader
const CinematicGradeShader = {
  name: 'CinematicGradeShader',
  uniforms: {
    tDiffuse: { value: null },
    uResolution: { value: new THREE.Vector2(1, 1) },
    uTexelSize: { value: new THREE.Vector2(1 / 860, 1 / 1864) },
    uEraMix: { value: 0.0 },
    uExposure: { value: 1.02 },
    uShadowToe: { value: 0.80 },
    uToeKnee: { value: 0.15 },
    uContrast: { value: 1.12 },
    uSpecularPop: { value: 0.10 },
    uClarity: { value: 0.15 },
    uSaturation: { value: 1.08 },
    uEmissiveBoost: { value: 0.16 },
    uShadowTint: { value: new THREE.Vector3(0.78, 0.88, 1.18) },
    uHighlightTint: { value: new THREE.Vector3(0.92, 0.98, 1.07) },
    uShoulderStrength: { value: 0.26 },
    uVignetteStrength: { value: 0.28 },
    uFlash: { value: 0.0 },
    uDarkness: { value: 0.0 },
    uDither: { value: 1.0 },
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
    uniform float uEraMix;
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
    uniform float uFlash;
    uniform float uDarkness;
    uniform float uDither;

    varying vec2 vUv;

    const vec3 LUMA_W = vec3(0.2126, 0.7152, 0.0722);

    void main() {
      vec4 texel = texture2D(tDiffuse, vUv);
      vec3 col = clamp(texel.rgb, vec3(0.0), vec3(32.0));

      // 0. Edge-Aware 4-Tap Cross Micro-Clarity (accentuates #040812 mortar crevices & wet-stone
      //    normal-map bevels while leaving soft HDR bloom halos & pure dark sky completely smooth)
      float basePeak = max(col.r, max(col.g, col.b));
      if (uClarity > 0.001 && basePeak > 0.002 && basePeak < 1.85) {
        vec2 stepUv = uTexelSize * 0.85;
        vec3 nN = clamp(texture2D(tDiffuse, vUv + vec2(0.0, stepUv.y)).rgb, vec3(0.0), vec3(16.0));
        vec3 nS = clamp(texture2D(tDiffuse, vUv - vec2(0.0, stepUv.y)).rgb, vec3(0.0), vec3(16.0));
        vec3 nE = clamp(texture2D(tDiffuse, vUv + vec2(stepUv.x, 0.0)).rgb, vec3(0.0), vec3(16.0));
        vec3 nW = clamp(texture2D(tDiffuse, vUv - vec2(stepUv.x, 0.0)).rgb, vec3(0.0), vec3(16.0));
        float cLuma = dot(col, LUMA_W);
        float blurLuma = dot((nN + nS + nE + nW) * 0.25, LUMA_W);
        float hiFreq = cLuma - blurLuma;
        // Attenuate on high-contrast silhouette edges & bright emissive halos to prevent ringing
        float haloGuard = (1.0 - smoothstep(0.95, 1.75, basePeak)) * smoothstep(0.004, 0.035, cLuma);
        float maxDelta = cLuma * 0.16;
        float clarityDelta = clamp(hiFreq * uClarity * 1.45, -maxDelta, maxDelta) * haloGuard;
        col *= (cLuma + clarityDelta) / max(cLuma, 0.0001);
      }

      // 1. Pre-ACES linear exposure trim + blackout / lightning modulation
      float expGain = uExposure * (1.0 - uDarkness * 0.15) + uFlash * 0.20;
      col *= expGain;

      // Rec.709 linear luminance & normalized chroma
      float luma = dot(col, LUMA_W);
      float maxC = max(col.r, max(col.g, col.b));
      float minC = min(col.r, min(col.g, col.b));
      float chroma = (maxC - minC) / (maxC + 0.0008);

      // Localized warm incandescent mask (#ffaa33 cage lantern, #ff7722 sparks, brazier fire)
      float warmGlow = clamp((col.r - col.b) / (luma + 0.032), 0.0, 1.0);
      // High-chroma localized accent mask (#5efce8 fireflies/runes, #c026ff crystal, emerald hero skin)
      float accentMask = smoothstep(0.28, 0.74, chroma) * smoothstep(0.05, 0.48, maxC);

      // 2. UE5 Chiaroscuro Shadow Toe, S-Curve Contrast & Wet-Stone Specular Sheen Pop
      if (luma > 0.00001) {
        // Deep #040812 crevice & overhang shadow compression (strictly 0-preserving: 0.0 -> 0.0)
        float toeMask = smoothstep(0.0, uToeKnee, luma);
        float toeGain = mix(uShadowToe, 1.0, toeMask);

        float pivot = 0.17;
        float midWeight = (1.0 - smoothstep(0.68, 1.90, luma)) * smoothstep(0.006, 0.055, luma);
        float contrastedLuma = pivot * pow(max(luma / pivot, 0.0001), mix(1.0, uContrast, midWeight));

        // Wet-stone & metallic rim specular pop (boosts moonlit glints at luma 0.22..0.95 without blowing out >1.1)
        float specBand = smoothstep(0.18, 0.52, luma) * (1.0 - smoothstep(0.88, 1.55, luma));
        float specBoost = 1.0 + uSpecularPop * specBand * (1.0 - warmGlow * 0.45);

        float targetLuma = contrastedLuma * toeGain * specBoost;
        // Preserve warm lantern/spark floor washes & emissive halos against shadow-toe crush
        float glowProtect = clamp(warmGlow * 0.52 + smoothstep(0.58, 1.30, maxC) * 0.50, 0.0, 0.80);
        col *= mix(targetLuma / luma, 1.0, glowProtect);
      }

      luma = dot(col, LUMA_W);

      // 3. Chroma-Protected Chiaroscuro Split-Toning:
      //    - Abyssal midnight-indigo (#040812) crevices & storm troughs (0 * tint === 0!)
      //    - Crisp cool-silver moonlit specular sheen on wet slate, cloud rims & wave crests
      float shadowZone = 1.0 - smoothstep(0.010, 0.22, luma);
      float tintAllow = (1.0 - warmGlow * 0.90) * (1.0 - clamp(chroma * 1.15, 0.0, 0.84));
      col *= mix(vec3(1.0), uShadowTint, shadowZone * tintAllow);

      float hiZone = smoothstep(0.30, 1.18, luma) * (1.0 - warmGlow * 0.92) * (1.0 - accentMask * 0.68);
      col *= mix(vec3(1.0), uHighlightTint, hiZone);

      // 4. Chromaticity-Preserving Soft HDR Highlight Shoulder (anti-blowout roll-off above 1.08)
      float peak = max(col.r, max(col.g, col.b));
      const float shoulderKnee = 1.08;
      if (peak > shoulderKnee && uShoulderStrength > 0.001) {
        float excess = peak - shoulderKnee;
        float compressed = shoulderKnee + excess / (1.0 + excess * uShoulderStrength);
        col *= compressed / peak;
      }

      // 5. Era Vibrance & Lush Emissive Glow Preservation (#ffaa33, #ff7722, #5efce8, #c026ff)
      luma = dot(col, LUMA_W);
      float localBoost = uEmissiveBoost * clamp(warmGlow * 0.76 + accentMask * 0.86, 0.0, 1.0);
      float hotCoreTaper = 1.0 - smoothstep(1.75, 3.80, peak) * 0.44;
      float finalSat = mix(1.0, uSaturation + localBoost, hotCoreTaper);
      col = max(vec3(0.0), mix(vec3(luma), col, finalSat));

      // Subtle cool-silver storm lightning flash veil (bounded so HUD & stone never white-out)
      if (uFlash > 0.001) {
        float flashMix = clamp(uFlash * 0.42, 0.0, 0.32);
        col = mix(col, col * vec3(0.92, 0.97, 1.08) + vec3(0.032, 0.044, 0.070) * uFlash, flashMix);
      }

      // 6. Optical Corner Vignette Framing (Reboot ONLY; leaves central 58% diorama 100% clear; 0.0 in Original)
      if (uVignetteStrength > 0.001) {
        vec2 centered = vUv - 0.5;
        float aspect = clamp(uResolution.x / max(uResolution.y, 1.0), 0.55, 1.85);
        vec2 vCoord = vec2(
          centered.x * mix(1.0, aspect, 0.26),
          centered.y * mix(1.0, 1.0 / aspect, 0.16)
        );
        float distSq = dot(vCoord, vCoord) * 2.0;
        float vigMask = smoothstep(0.28, 1.14, distSq) * uVignetteStrength;
        // Bright sparks, lanterns & flank fireflies naturally pierce optical corner falloff
        float pierce = clamp((luma + accentMask * 0.45) * 0.32, 0.0, 0.52);
        vigMask *= (1.0 - pierce);
        vec3 vigFactor = mix(vec3(1.0), vec3(0.68, 0.74, 0.88), vigMask) * (1.0 - vigMask * 0.80);
        col *= vigFactor;
      }

      // 7. Sub-1-LSB Interleaved Gradient Noise Anti-Banding Dither (strictly 0 at pure black)
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
    this.era = 'reboot';
    this.enabled = true;
    this._disposed = false;

    // Pre-allocated scratch vector (zero per-frame / per-resize allocations)
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

    // Low-DPR & sustained frame-time fallback telemetry for guaranteed 60fps
    this._peakDpr = this.dpr;
    this._lowDprBypass = this.dpr < 0.95;
    this._perfBypass = false;
    this._manualBypass = false;
    this._emaFrameMs = 16.6;
    this._slowFrames = 0;
    this._fastFrames = 0;
    this._lastFrameNow = 0;

    // Cached render-target dimensions to avoid redundant FBO reallocations
    this._rtW = 0;
    this._rtH = 0;
    this._rtDpr = 0;

    // Lightweight non-retaining placeholders for RenderPass between frames
    this._dummyScene = new THREE.Scene();
    this._dummyCamera = new THREE.PerspectiveCamera();

    this.composer = null;
    this.renderPass = null;
    this.bloomPass = null;
    this.gradePass = null;
    this.outputPass = null;

    this._initPipeline();
    this.setEra('reboot');
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

      // UnrealBloomPass constructor order: (resolution, strength, radius, threshold)
      const bloomPass = new UnrealBloomPass(
        new THREE.Vector2(safeW, safeH),
        ERA_PRESETS.reboot.bloomStrength,
        ERA_PRESETS.reboot.bloomRadius,
        BLOOM_DEFAULTS.threshold
      );
      bloomPass.threshold = BLOOM_DEFAULTS.threshold;
      bloomPass.strength = ERA_PRESETS.reboot.bloomStrength;
      bloomPass.radius = ERA_PRESETS.reboot.bloomRadius;

      // Upgrade UnrealBloomPass high-pass stage in-place to ChromaSelectiveHighPassFragment
      // (zero extra passes/FBOs: lush soft halos on colored emissives, zero white ocean washout!)
      if (bloomPass.highPassUniforms && bloomPass.materialHighPassFilter) {
        bloomPass.highPassUniforms.smoothWidth.value = 0.12;
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

  setEra(era) {
    const next = era === 'original' ? 'original' : 'reboot';
    this.era = next;
    const preset = ERA_PRESETS[next];

    if (this.gradePass?.uniforms) {
      const u = this.gradePass.uniforms;
      u.uEraMix.value = preset.eraMix;
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
    // Automatic bypass when adaptive resolution drops down to low-DPR fallback (<= 1.0 from higher DPR, or < 0.95)
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
      // Ignore tab switches, pauses, and one-off asset/shader compile hitches
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
    if (o.era && o.era !== this.era) {
      this.setEra(o.era);
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
        this.webgl.toneMappingExposure = this.era === 'original' ? 1.06 : 0.98;
      }

      if (shouldBypass) {
        this.webgl.setRenderTarget(null);
        this.webgl.render(scene, camera);
        return;
      }

      const preset = ERA_PRESETS[this.era];

      if (this.gradePass?.uniforms) {
        const u = this.gradePass.uniforms;
        u.uFlash.value = Number(o.flash) || 0;
        u.uDarkness.value = Number(o.darkness) || 0;
        if (o.vignette !== undefined) {
          u.uVignetteStrength.value =
            this.era === 'original' ? 0.0 : Math.max(0, Number(o.vignette) || 0);
        } else {
          u.uVignetteStrength.value = preset.vignetteStrength;
        }
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
      // Fault-tolerant fallback: render scene directly if composer hits a context-loss / FBO error
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
