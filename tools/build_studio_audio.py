#!/usr/bin/env python3
"""
Studio Acoustic Score & Natural Water Soundscape Pipeline
for Towering Waters: Gateway's Descent (Created by Matt Shaffer).

Synthesizes warm, multi-section (76.8s - 80.0s) physical-modeling / multi-harmonic
acoustic scores and 40.0s multi-band natural stereo water ambience stems, convolved
through stereo Feedback-Delay-Network / Concert-Hall & Canyon impulse responses,
mastered with circular zero-phase warm tape filtering (< 5.4 kHz, zero harsh > 6 kHz
energy), and encoded to compact Vorbis .ogg stems in assets/audio/.
"""

from __future__ import annotations

import json
import math
import os
import shutil
import subprocess
import tempfile
import wave
from pathlib import Path
from typing import Dict, List, Sequence, Tuple

import numpy as np
from scipy import signal

SR = 44100
TWO_PI = 2.0 * math.pi

ROOT_DIR = Path(__file__).resolve().parent.parent
OUT_DIR = ROOT_DIR / "assets" / "audio"

FFMPEG_CANDIDATES = [
    r"C:\Program Files\DownloadHelper App\ffmpeg.exe",
    shutil.which("ffmpeg") or "",
]


def find_ffmpeg() -> str:
    for cand in FFMPEG_CANDIDATES:
        if cand and os.path.isfile(cand):
            return cand
    raise FileNotFoundError("ffmpeg executable not found.")


def find_ffprobe(ffmpeg_path: str) -> str:
    sibling = str(Path(ffmpeg_path).with_name("ffprobe.exe"))
    if os.path.isfile(sibling):
        return sibling
    which_probe = shutil.which("ffprobe")
    return which_probe or ""


def midi_to_hz(midi: float) -> float:
    return 440.0 * (2.0 ** ((midi - 69.0) / 12.0))


def pan_gains(pan: float) -> Tuple[float, float]:
    """Equal-power stereo panning (-1.0 left .. +1.0 right)."""
    p = max(-1.0, min(1.0, float(pan)))
    angle = (p + 1.0) * (math.pi * 0.25)
    return math.cos(angle), math.sin(angle)


def biquad_peaking_sos(freq: float, q: float, db_gain: float, fs: int = SR) -> np.ndarray:
    a = 10.0 ** (db_gain / 40.0)
    w0 = TWO_PI * freq / fs
    alpha = math.sin(w0) / (2.0 * q)
    cos_w0 = math.cos(w0)

    b0 = 1.0 + alpha * a
    b1 = -2.0 * cos_w0
    b2 = 1.0 - alpha * a
    a0 = 1.0 + alpha / a
    a1 = -2.0 * cos_w0
    a2 = 1.0 - alpha / a
    return np.array([[b0 / a0, b1 / a0, b2 / a0, 1.0, a1 / a0, a2 / a0]], dtype=np.float64)


def biquad_highshelf_sos(freq: float, db_gain: float, s: float = 0.85, fs: int = SR) -> np.ndarray:
    a = 10.0 ** (db_gain / 40.0)
    w0 = TWO_PI * freq / fs
    cos_w0 = math.cos(w0)
    sin_w0 = math.sin(w0)
    alpha = sin_w0 * 0.5 * math.sqrt((a + 1.0 / a) * (1.0 / s - 1.0) + 2.0)
    two_sqrt_a_alpha = 2.0 * math.sqrt(a) * alpha

    b0 = a * ((a + 1.0) + (a - 1.0) * cos_w0 + two_sqrt_a_alpha)
    b1 = -2.0 * a * ((a - 1.0) + (a + 1.0) * cos_w0)
    b2 = a * ((a + 1.0) + (a - 1.0) * cos_w0 - two_sqrt_a_alpha)
    a0 = (a + 1.0) - (a - 1.0) * cos_w0 + two_sqrt_a_alpha
    a1 = 2.0 * ((a - 1.0) - (a + 1.0) * cos_w0)
    a2 = (a + 1.0) - (a - 1.0) * cos_w0 - two_sqrt_a_alpha
    return np.array([[b0 / a0, b1 / a0, b2 / a0, 1.0, a1 / a0, a2 / a0]], dtype=np.float64)


# ---------------------------------------------------------------------------
# Stereo Concert-Hall & Canyon FDN / Multi-Reflection Impulse Response Builder
# ---------------------------------------------------------------------------


def build_space_ir(
    rt60: float = 3.8,
    pre_delay_ms: float = 22.0,
    hf_damping_hz: float = 2300.0,
    canyon_echo: bool = False,
    seed: int = 101,
) -> np.ndarray:
    """
    Generates a lush, velvet-smooth stereo acoustic hall / canyon impulse response
    combining discrete early architectural/gorge reflections with diffuse exponentially
    damped late reverberation (frequency-dependent air absorption, zero metallic ringing).
    """
    rng = np.random.default_rng(seed)
    ir_len = int(SR * min(5.2, rt60 * 1.18))
    t = np.arange(ir_len, dtype=np.float64) / SR
    ir = np.zeros((ir_len, 2), dtype=np.float64)

    # 1. Early reflections (concert hall wooden side walls / canyon stone ledges)
    early_taps = [
        (0.017, 0.34, -0.45),
        (0.026, 0.29, 0.48),
        (0.037, 0.24, -0.28),
        (0.049, 0.21, 0.35),
        (0.064, 0.18, -0.55),
        (0.081, 0.15, 0.52),
        (0.103, 0.12, -0.22),
        (0.129, 0.10, 0.26),
    ]
    if canyon_echo:
        early_taps.extend(
            [
                (0.185, 0.13, -0.62),
                (0.245, 0.11, 0.60),
                (0.370, 0.075, -0.40),
                (0.490, 0.052, 0.42),
            ]
        )

    pre_samp = int(pre_delay_ms * 0.001 * SR)
    for delay_s, amp, pan in early_taps:
        idx = pre_samp + int(delay_s * SR)
        if idx + 64 < ir_len:
            gl, gr = pan_gains(pan)
            # Soft 1.2ms velvet pulse instead of 1-sample Dirac spike so reflections stay warm
            w = np.hanning(48) * amp
            ir[idx : idx + 48, 0] += w * gl
            ir[idx : idx + 48, 1] += w * gr

    # 2. Multi-band air-absorbed late diffuse tail (decorrelated stereo velvet field)
    decay_rate = 6.907755 / max(0.4, rt60)
    onset = np.clip((t - pre_delay_ms * 0.001) / 0.085, 0.0, 1.0) ** 1.4
    env_low = onset * np.exp(-decay_rate * 0.86 * t)
    env_mid = onset * np.exp(-decay_rate * 1.08 * t)
    env_air = onset * np.exp(-decay_rate * 1.85 * t)

    sos_low = signal.butter(2, 340.0, btype="low", fs=SR, output="sos")
    sos_mid = signal.butter(2, [340.0, min(4200.0, hf_damping_hz)], btype="band", fs=SR, output="sos")
    sos_air = signal.butter(
        2,
        [min(1800.0, hf_damping_hz * 0.75), min(4400.0, hf_damping_hz * 1.45)],
        btype="band",
        fs=SR,
        output="sos",
    )

    for ch in range(2):
        noise = rng.standard_normal(ir_len)
        # Subtle chorus-like slow modulation via sinusoidal all-pass shimmer
        mod = 1.0 + 0.06 * np.sin(TWO_PI * (0.43 + 0.17 * ch) * t + ch * 1.3)
        low = signal.sosfilt(sos_low, noise) * env_low * 0.55
        mid = signal.sosfilt(sos_mid, noise) * env_mid * 0.72 * mod
        air = signal.sosfilt(sos_air, noise) * env_air * 0.24
        ir[:, ch] += (low + mid + air) * 0.36

    # Gentle HPF at 85 Hz so hall reverb never muddies sub-bass
    sos_hp = signal.butter(2, 85.0, btype="high", fs=SR, output="sos")
    ir = signal.sosfilt(sos_hp, ir, axis=0)

    # Normalize IR energy so wet send levels behave predictably
    energy = math.sqrt(float(np.mean(np.sum(ir * ir, axis=1))) * ir_len / SR + 1e-12)
    ir /= max(energy * 2.2, 1e-6)
    return ir.astype(np.float32)


# ---------------------------------------------------------------------------
# Score Canvas Mixer (Supports Seamless Tail-Wrapped Looping)
# ---------------------------------------------------------------------------


class StudioCanvas:
    def __init__(self, loop_seconds: float, tail_seconds: float = 8.0):
        self.loop_seconds = float(loop_seconds)
        self.loop_samples = int(round(self.loop_seconds * SR))
        self.tail_samples = int(round(tail_seconds * SR))
        self.total_samples = self.loop_samples + self.tail_samples
        self.dry = np.zeros((self.total_samples, 2), dtype=np.float32)
        self.wet_send = np.zeros((self.total_samples, 2), dtype=np.float32)

    def add_Mono(
        self,
        wave_mono: np.ndarray,
        start_sec: float,
        gain: float = 1.0,
        pan: float = 0.0,
        reverb_send: float = 0.35,
    ) -> None:
        if start_sec < 0.0:
            start_sec += self.loop_seconds
        idx0 = int(round(start_sec * SR))
        if idx0 >= self.loop_samples or len(wave_mono) == 0:
            return
        idx1 = min(self.total_samples, idx0 + len(wave_mono))
        seg = wave_mono[: idx1 - idx0]
        gl, gr = pan_gains(pan)
        dl = (seg * (gain * gl)).astype(np.float32)
        dr = (seg * (gain * gr)).astype(np.float32)
        self.dry[idx0:idx1, 0] += dl
        self.dry[idx0:idx1, 1] += dr
        if reverb_send > 0.001:
            rs = float(reverb_send)
            self.wet_send[idx0:idx1, 0] += dl * rs
            self.wet_send[idx0:idx1, 1] += dr * rs

    def add_Stereo(
        self,
        wave_stereo: np.ndarray,
        start_sec: float,
        gain: float = 1.0,
        reverb_send: float = 0.35,
    ) -> None:
        if start_sec < 0.0:
            start_sec += self.loop_seconds
        idx0 = int(round(start_sec * SR))
        if idx0 >= self.loop_samples or len(wave_stereo) == 0:
            return
        idx1 = min(self.total_samples, idx0 + len(wave_stereo))
        seg = wave_stereo[: idx1 - idx0] * float(gain)
        seg32 = seg.astype(np.float32)
        self.dry[idx0:idx1] += seg32
        if reverb_send > 0.001:
            self.wet_send[idx0:idx1] += seg32 * float(reverb_send)

    def render_seamless(self, ir: np.ndarray, wet_mix: float = 0.42, cutoff_hz: float = 5200.0) -> np.ndarray:
        # FFT-convolve stereo reverb bus
        wet_l = signal.fftconvolve(self.wet_send[:, 0], ir[:, 0], mode="full")[: self.total_samples]
        wet_r = signal.fftconvolve(self.wet_send[:, 1], ir[:, 1], mode="full")[: self.total_samples]
        # Cross-feed 18% between L/R reverb tails for true concert-hall spaciousness
        hall_l = wet_l * 0.88 + wet_r * 0.18
        hall_r = wet_r * 0.88 + wet_l * 0.18

        mix = np.zeros((self.total_samples, 2), dtype=np.float64)
        mix[:, 0] = self.dry[:, 0] + hall_l * wet_mix
        mix[:, 1] = self.dry[:, 1] + hall_r * wet_mix

        # Wrap [L : L + tail] onto [0 : tail] for 100% click-free seamless looping!
        out = mix[: self.loop_samples].copy()
        tail = mix[self.loop_samples : self.loop_samples + self.tail_samples].copy()
        # Smooth fade at the very end of the 8s tail so residual sub-noise vanishes cleanly
        fade_n = min(SR // 2, len(tail))
        if fade_n > 0:
            tail[-fade_n:] *= np.linspace(1.0, 0.0, fade_n)[:, None]
        out[: self.tail_samples] += tail

        return master_circular_stereo(out, cutoff_hz=cutoff_hz, target_rms_db=-18.2)


def master_circular_stereo(
    audio: np.ndarray,
    cutoff_hz: float = 5200.0,
    target_rms_db: float = -18.2,
) -> np.ndarray:
    """
    Applies studio EQ, warm analog tape saturation, and steep zero-phase anti-fatigue
    low-pass (< 5.2 kHz, zero harsh > 6 kHz frequencies!) using circular wrap padding
    so sample N-1 -> sample 0 remains 100% phase-continuous and click-free.
    """
    pad = min(len(audio) // 4, SR * 2)
    wrapped = np.pad(audio, ((pad, pad), (0, 0)), mode="wrap")

    # 1. Clean sub-rumble below 28 Hz
    sos_hp = signal.butter(2, 28.0, btype="high", fs=SR, output="sos")
    # 2. Gentle boxiness dip around 265 Hz (-1.6 dB) + warm presence silk shelf above 3100 Hz (-3.2 dB)
    sos_mud = biquad_peaking_sos(265.0, 1.1, -1.6, fs=SR)
    sos_silk = biquad_highshelf_sos(3100.0, -3.2, s=0.8, fs=SR)
    # 3. Steep anti-harshness 4th-order zero-phase lowpass (8th-order effective via sosfiltfilt!)
    sos_lp = signal.butter(4, cutoff_hz, btype="low", fs=SR, output="sos")

    sos_chain = np.vstack([sos_hp, sos_mud, sos_silk, sos_lp])
    filtered = signal.sosfiltfilt(sos_chain, wrapped, axis=0)[pad : pad + len(audio)]

    # 4. Initial level calibration before gentle warm tape saturation
    rms = math.sqrt(float(np.mean(filtered * filtered)) + 1e-12)
    target_rms = 10.0 ** (target_rms_db / 20.0)
    scaled = filtered * (target_rms / max(rms, 1e-6))

    # 5. Gentle analog tape soft-knee saturation + final post-tape silk LPF
    drive = 1.22
    saturated = np.tanh(scaled * drive) / math.tanh(drive)
    wrapped2 = np.pad(saturated, ((pad // 2, pad // 2), (0, 0)), mode="wrap")
    clean = signal.sosfiltfilt(sos_lp, wrapped2, axis=0)[pad // 2 : pad // 2 + len(audio)]

    # 6. True-peak ceiling safety at -1.6 dBFS (0.8318)
    peak = float(np.max(np.abs(clean)))
    ceiling = 0.8318
    if peak > ceiling:
        clean *= ceiling / peak

    return clean.astype(np.float32)


# ---------------------------------------------------------------------------
# Physical-Modeling & Multi-Harmonic Acoustic Instrument Synthesizers
# ---------------------------------------------------------------------------


def synth_felt_piano(freq: float, dur: float, vel: float = 0.75, rng: np.random.Generator | None = None) -> np.ndarray:
    """Nils-Frahm / Ori inspired warm wool-felt upright piano with duplex string warmth."""
    n_samp = int(round((dur + 1.4) * SR))
    t = np.arange(n_samp, dtype=np.float64) / SR
    out = np.zeros(n_samp, dtype=np.float64)

    inharm_b = 0.00026
    # Soft felt hammer restricts upper harmonics naturally
    max_h = min(9, int(4400.0 / max(freq, 40.0)))
    for h in range(1, max_h + 1):
        fh = freq * h * math.sqrt(1.0 + inharm_b * h * h)
        if fh > 4600.0:
            break
        amp = (vel ** (0.85 + 0.12 * h)) / (h ** 1.68)
        tau = max(0.18, (dur * 1.15 + 0.9) / (1.0 + 0.58 * ((h - 1) ** 1.35)))
        # Subtle unison string beating on harmonics 1..4
        if h <= 4 and freq > 130.0:
            det = 2.0 ** (0.95 / 1200.0)
            wave_h = 0.52 * np.sin(TWO_PI * fh * t) + 0.48 * np.sin(TWO_PI * (fh * det) * t + 0.35 * h)
        else:
            wave_h = np.sin(TWO_PI * fh * t + 0.2 * h)
        out += amp * wave_h * np.exp(-t / tau)

    # Soft wool-felt hammer body thump (140-420 Hz, 22ms velvet cushion, zero click)
    if rng is not None:
        thump_n = min(n_samp, int(0.045 * SR))
        tt = t[:thump_n]
        felt_noise = rng.standard_normal(thump_n)
        sos_felt = signal.butter(2, [110.0, 420.0], btype="band", fs=SR, output="sos")
        felt = signal.sosfilt(sos_felt, felt_noise) * np.sin(math.pi * np.clip(tt / 0.022, 0.0, 1.0)) ** 2
        out[:thump_n] += felt * (0.045 * vel)

    # Smooth 9ms wool-felt attack & gentle release tail
    att = 1.0 - np.exp(-t / 0.009)
    rel = 1.0 / (1.0 + np.exp((t - (dur + 0.55)) / 0.18))
    return (out * att * rel * 0.42).astype(np.float32)


def synth_wooden_marimba(freq: float, dur: float = 1.2, vel: float = 0.8) -> np.ndarray:
    """Carved rosewood marimba bar (1.0 : 3.99 : 9.2 arch-undercut modes + gourd resonator)."""
    n_samp = int(round(max(0.55, dur + 0.65) * SR))
    t = np.arange(n_samp, dtype=np.float64) / SR

    # Yarn mallet soft strike (7ms rounded attack)
    att = 1.0 - np.exp(-t / 0.0065)
    tau0 = max(0.24, min(1.35, 0.85 * (260.0 / max(freq, 80.0)) ** 0.35))

    m1 = np.sin(TWO_PI * freq * t) * np.exp(-t / tau0)
    # Warm resonator 2nd harmonic bloom + authentic 4.0x rosewood bar overtone
    m2 = 0.18 * np.sin(TWO_PI * (freq * 2.0) * t + 0.4) * np.exp(-t / (tau0 * 0.55))
    m4 = (0.34 * vel) * np.sin(TWO_PI * (freq * 3.992) * t + 0.9) * np.exp(-t / (tau0 * 0.24))
    m9 = (0.07 * vel) * (
        np.sin(TWO_PI * min(4500.0, freq * 9.15) * t + 1.4) * np.exp(-t / 0.032)
        if freq * 9.15 < 4500.0
        else 0.0
    )

    # Warm wood strike resonance
    wood = 0.12 * np.sin(TWO_PI * (freq * 0.5) * t) * np.exp(-t / 0.045)
    wave_out = (m1 + m2 + m4 + m9 + wood) * att * vel * 0.44
    fade = min(n_samp // 6, int(0.08 * SR))
    if fade > 0:
        wave_out[-fade:] *= np.linspace(1.0, 0.0, fade)
    return wave_out.astype(np.float32)


def synth_tongue_drum(freq: float, dur: float = 2.0, vel: float = 0.78) -> np.ndarray:
    """Sunlit harmonic tongue drum / handpan (1 : 2 : 2.998 : 4.01 singing overtones)."""
    n_samp = int(round((dur + 1.2) * SR))
    t = np.arange(n_samp, dtype=np.float64) / SR
    att = 1.0 - np.exp(-t / 0.011)
    beat_lfo = 1.0 + 0.07 * np.sin(TWO_PI * 1.8 * t)

    p1 = np.sin(TWO_PI * freq * t) * np.exp(-t / 1.55) * beat_lfo
    p2 = 0.44 * np.sin(TWO_PI * (freq * 2.0) * t + 0.3) * np.exp(-t / 1.10)
    p3 = 0.22 * np.sin(TWO_PI * (freq * 2.998) * t + 1.1) * np.exp(-t / 0.72)
    p4 = 0.08 * np.sin(TWO_PI * min(4200.0, freq * 4.006) * t + 1.9) * np.exp(-t / 0.36)

    out = (p1 + p2 + p3 + p4) * att * vel * 0.38
    rel = 1.0 / (1.0 + np.exp((t - (dur + 0.6)) / 0.16))
    return (out * rel).astype(np.float32)


def synth_kalimba(freq: float, dur: float = 1.5, vel: float = 0.76) -> np.ndarray:
    """Crystalline African mahogany kalimba with warm hollow gourd resonance (< 4.3 kHz)."""
    n_samp = int(round((dur + 0.9) * SR))
    t = np.arange(n_samp, dtype=np.float64) / SR
    att = 1.0 - np.exp(-t / 0.0048)

    # Gentle pitch settle on thumb release (authentic tine elasticity)
    phase0 = TWO_PI * freq * t + 0.08 * np.exp(-t / 0.018)
    f1 = np.sin(phase0) * np.exp(-t / 1.15)
    f2 = 0.24 * np.sin(TWO_PI * (freq * 2.0) * t + 0.5) * np.exp(-t / 0.62)
    # Characteristic tine bell mode (~5.8x) gently capped < 4300 Hz
    f_tine = freq * 5.82
    tine = (
        0.15 * vel * np.sin(TWO_PI * f_tine * t + 0.9) * np.exp(-t / 0.055)
        if f_tine < 4300.0
        else 0.06 * vel * np.sin(TWO_PI * min(3800.0, freq * 3.0) * t) * np.exp(-t / 0.07)
    )
    # Mahogany soundbox air-hole warmth (~285 Hz)
    box = 0.14 * np.sin(TWO_PI * 286.0 * t) * np.exp(-t / 0.038)

    out = (f1 + f2 + tine + box) * att * vel * 0.40
    rel = 1.0 / (1.0 + np.exp((t - (dur + 0.45)) / 0.14))
    return (out * rel).astype(np.float32)


def synth_glass_harp(freq: float, dur: float = 3.2, vel: float = 0.65) -> np.ndarray:
    """Singing rubbed crystal bowls / glass harp with silky slow bloom & stereo shimmer."""
    n_samp = int(round((dur + 1.4) * SR))
    t = np.arange(n_samp, dtype=np.float64) / SR

    swell = (0.5 - 0.5 * np.cos(math.pi * np.clip(t / max(0.35, dur * 0.38), 0.0, 1.0))) ** 1.3
    decay = 1.0 / (1.0 + np.exp((t - dur) / 0.32))
    env = swell * decay

    rot_l = 1.0 + 0.14 * np.sin(TWO_PI * 0.85 * t)
    rot_r = 1.0 - 0.14 * np.sin(TWO_PI * 0.85 * t)

    h1_l = np.sin(TWO_PI * (freq * 0.9993) * t)
    h1_r = np.sin(TWO_PI * (freq * 1.0007) * t + 0.6)
    h2 = 0.28 * np.sin(TWO_PI * min(4300.0, freq * 2.002) * t + 1.1) if freq * 2.0 < 4300.0 else 0.0

    stereo = np.zeros((n_samp, 2), dtype=np.float32)
    stereo[:, 0] = ((h1_l * rot_l + h2) * env * vel * 0.24).astype(np.float32)
    stereo[:, 1] = ((h1_r * rot_r + h2) * env * vel * 0.24).astype(np.float32)
    return stereo


def synth_acoustic_pluck(freq: float, dur: float = 1.8, vel: float = 0.78) -> np.ndarray:
    """Warm cedar nylon guitar / Celtic folk harp string with natural harmonic damping."""
    n_samp = int(round((dur + 0.9) * SR))
    t = np.arange(n_samp, dtype=np.float64) / SR
    out = np.zeros(n_samp, dtype=np.float64)

    # Finger-plucked at ~1/5 string length suppresses every 5th harmonic -> warm woody roundness!
    pluck_pos = 0.21
    max_h = min(11, int(3900.0 / max(freq, 45.0)))
    for h in range(1, max_h + 1):
        fh = freq * h * math.sqrt(1.0 + 0.00012 * h * h)
        if fh > 4100.0:
            break
        pos_weight = abs(math.sin(math.pi * h * pluck_pos))
        amp = pos_weight * (vel ** (0.8 + 0.09 * h)) / (h ** 1.32)
        tau = max(0.14, (dur * 0.95 + 0.55) / (1.0 + 0.48 * ((h - 1) ** 1.28)))
        out += amp * np.sin(TWO_PI * fh * t + 0.15 * h) * np.exp(-t / tau)

    # Cedar soundboard warm body tap (~195 Hz)
    body = 0.11 * vel * np.sin(TWO_PI * 196.0 * t) * np.exp(-t / 0.042)
    att = 1.0 - np.exp(-t / 0.0042)
    rel = 1.0 / (1.0 + np.exp((t - (dur + 0.45)) / 0.14))
    return ((out + body) * att * rel * 0.42).astype(np.float32)


def synth_bamboo_flute(
    freq: float,
    dur: float,
    vel: float = 0.72,
    rng: np.random.Generator | None = None,
    grace_semi: float = 0.0,
) -> np.ndarray:
    """Breathy canyon cedar/bamboo flute with gentle portamento grace-bend and human vibrato."""
    n_samp = int(round((dur + 0.45) * SR))
    t = np.arange(n_samp, dtype=np.float64) / SR

    # Delayed expressive breath vibrato (4.6 Hz, ramps in after 0.28s)
    vib_depth = 0.0058 * np.clip((t - 0.24) / 0.35, 0.0, 1.0)
    vib = 1.0 + vib_depth * np.sin(TWO_PI * 4.65 * t)

    # Optional expressive grace-note slide in first 90ms
    if abs(grace_semi) > 0.01:
        bend_ratio = (2.0 ** (grace_semi / 12.0) - 1.0) * np.exp(-t / 0.042)
    else:
        bend_ratio = -0.008 * np.exp(-t / 0.028)

    inst_freq = freq * (1.0 + bend_ratio) * vib
    phase = np.cumsum(TWO_PI * inst_freq / SR)

    # Cylindrical/conical wood flute harmonic warmth (strong fundamental + soft 2nd & 3rd)
    tone = (
        np.sin(phase)
        + 0.34 * np.sin(2.0 * phase + 0.4)
        + (0.12 * np.sin(3.0 * phase + 0.9) if freq * 3.0 < 3800.0 else 0.0)
        + (0.04 * np.sin(4.0 * phase + 1.3) if freq * 4.0 < 4000.0 else 0.0)
    )

    # Soft embouchure air breath + delicate onset chiff (strictly < 3.1 kHz, silky & organic)
    breath = np.zeros(n_samp, dtype=np.float64)
    if rng is not None:
        raw_n = rng.standard_normal(n_samp)
        bp_lo = max(280.0, min(1800.0, freq * 0.9))
        bp_hi = max(bp_lo + 350.0, min(3000.0, freq * 2.4))
        sos_bp = signal.butter(2, [bp_lo, bp_hi], btype="band", fs=SR, output="sos")
        chiff_env = 0.14 * np.exp(-t / 0.055) + 0.052
        breath = signal.sosfilt(sos_bp, raw_n) * chiff_env

    # Expressive breath phrase envelope
    att_t = min(0.14, max(0.055, dur * 0.18))
    att = (0.5 - 0.5 * np.cos(math.pi * np.clip(t / att_t, 0.0, 1.0))) ** 1.1
    swell = 0.88 + 0.12 * np.sin(math.pi * np.clip(t / max(0.2, dur), 0.0, 1.0))
    rel = 1.0 / (1.0 + np.exp((t - dur) / 0.095))
    return ((tone + breath) * att * swell * rel * vel * 0.31).astype(np.float32)


def synth_solo_cello(
    freq: float,
    dur: float,
    vel: float = 0.78,
    slide_from_hz: float | None = None,
) -> np.ndarray:
    """Expressive bowed solo cello / viola with spruce/maple body formants and warm vibrato."""
    n_samp = int(round((dur + 0.65) * SR))
    t = np.arange(n_samp, dtype=np.float64) / SR

    vib_depth = 0.0068 * np.clip((t - 0.22) / 0.38, 0.0, 1.0)
    vib = 1.0 + vib_depth * np.sin(TWO_PI * 5.05 * t)

    if slide_from_hz is not None and abs(slide_from_hz - freq) > 0.5:
        glide = np.exp(-t / 0.065)
        base_f = freq + (slide_from_hz - freq) * glide
    else:
        base_f = np.full_like(t, freq)

    phase = np.cumsum(TWO_PI * (base_f * vib) / SR)

    # Bowed Helmholtz-inspired warm harmonic series capped smoothly below 3,400 Hz
    sig = np.zeros(n_samp, dtype=np.float64)
    max_h = min(14, int(3300.0 / max(freq, 55.0)))
    for h in range(1, max_h + 1):
        amp = 1.0 / (h ** 1.24)
        sig += amp * np.sin(h * phase + 0.22 * h)

    # Cello wooden body resonances (240 Hz air cavity, 470 Hz back plate, 960 Hz warm bridge)
    sos_b1 = biquad_peaking_sos(242.0, 2.1, 4.5, fs=SR)
    sos_b2 = biquad_peaking_sos(475.0, 1.8, 3.2, fs=SR)
    sos_b3 = biquad_peaking_sos(960.0, 1.5, 2.0, fs=SR)
    sos_lp = signal.butter(3, min(2650.0, max(1200.0, freq * 7.5)), btype="low", fs=SR, output="sos")
    voiced = signal.sosfilt(np.vstack([sos_b1, sos_b2, sos_b3, sos_lp]), sig)

    att_t = min(0.24, max(0.085, dur * 0.24))
    att = (0.5 - 0.5 * np.cos(math.pi * np.clip(t / att_t, 0.0, 1.0))) ** 1.2
    arc = 0.82 + 0.22 * np.sin(math.pi * np.clip(t / max(0.25, dur), 0.0, 1.0))
    rel = 1.0 / (1.0 + np.exp((t - dur) / 0.14))
    return (voiced * att * arc * rel * vel * 0.18).astype(np.float32)


def synth_spiccato_cello(freq: float, dur: float = 0.38, vel: float = 0.76) -> np.ndarray:
    """Warm orchestral bowed short cello/bass ostinato stroke (pure acoustic warmth)."""
    n_samp = int(round((dur + 0.28) * SR))
    t = np.arange(n_samp, dtype=np.float64) / SR
    sig = np.zeros(n_samp, dtype=np.float64)
    max_h = min(9, int(2200.0 / max(freq, 40.0)))
    for h in range(1, max_h + 1):
        # Dynamic bow brightness decays slightly after initial rosin grip
        bright_env = np.exp(-t / (0.45 / (1.0 + 0.35 * (h - 1))))
        sig += (1.0 / (h ** 1.32)) * np.sin(TWO_PI * (freq * h) * t + 0.3 * h) * bright_env

    sos_body = biquad_peaking_sos(215.0, 1.8, 3.8, fs=SR)
    sos_lp = signal.butter(3, min(1850.0, max(680.0, freq * 6.5)), btype="low", fs=SR, output="sos")
    voiced = signal.sosfilt(np.vstack([sos_body, sos_lp]), sig)

    att = 1.0 - np.exp(-t / 0.022)
    rel = np.exp(-np.maximum(0.0, t - dur * 0.55) / 0.12)
    return (voiced * att * rel * vel * 0.24).astype(np.float32)


def synth_french_horn(freq: float, dur: float, vel: float = 0.75) -> np.ndarray:
    """Noble warm orchestral French horn with smooth bell-flare harmonic bloom (zero buzz)."""
    n_samp = int(round((dur + 0.65) * SR))
    t = np.arange(n_samp, dtype=np.float64) / SR

    swell = np.sin(math.pi * np.clip(t / max(0.3, dur), 0.0, 1.0)) ** 0.85
    vib = 1.0 + 0.0032 * np.clip((t - 0.3) / 0.4, 0.0, 1.0) * np.sin(TWO_PI * 4.4 * t)
    phase = np.cumsum(TWO_PI * (freq * vib) / SR)

    sig = np.zeros(n_samp, dtype=np.float64)
    # Conical brass bore favors warm fundamental + 2nd + 3rd + 4th harmonics blooming with swell
    weights = [1.0, 0.82, 0.54, 0.34, 0.19, 0.10, 0.05]
    for idx, w in enumerate(weights, start=1):
        if freq * idx > 2600.0:
            break
        dyn_bloom = (0.35 + 0.65 * swell) ** max(0, idx - 2)
        sig += w * dyn_bloom * np.sin(idx * phase + 0.18 * idx)

    # French horn bell formant (~380 Hz & ~740 Hz warm golden glow, steep roll-off > 1750 Hz)
    sos_f1 = biquad_peaking_sos(385.0, 1.7, 3.8, fs=SR)
    sos_f2 = biquad_peaking_sos(740.0, 1.6, 2.4, fs=SR)
    sos_lp = signal.butter(3, 1750.0, btype="low", fs=SR, output="sos")
    voiced = signal.sosfilt(np.vstack([sos_f1, sos_f2, sos_lp]), sig)

    att_t = min(0.28, max(0.11, dur * 0.25))
    att = (0.5 - 0.5 * np.cos(math.pi * np.clip(t / att_t, 0.0, 1.0))) ** 1.15
    rel = 1.0 / (1.0 + np.exp((t - dur) / 0.16))
    return (voiced * att * rel * vel * 0.175).astype(np.float32)


def synth_warm_string_pad(
    chord_midis: Sequence[float],
    dur: float,
    vel: float = 0.65,
    choir_blend: float = 0.0,
    seed: int = 7,
) -> np.ndarray:
    """Lush wide-stereo chamber string section + optional Pelagian human choir formant."""
    rng = np.random.default_rng(seed)
    n_samp = int(round((dur + 1.6) * SR))
    t = np.arange(n_samp, dtype=np.float64) / SR
    stereo = np.zeros((n_samp, 2), dtype=np.float64)

    for m in chord_midis:
        f0 = midi_to_hz(m)
        # 4 ensemble voices per chord note spread gently across stereo stage
        for v_idx, (cents, pan) in enumerate([(-6.5, -0.68), (-2.2, -0.25), (2.4, 0.28), (6.8, 0.68)]):
            fv = f0 * (2.0 ** (cents / 1200.0))
            lfo_rate = 0.35 + 0.11 * v_idx + rng.uniform(-0.04, 0.04)
            lfo_ph = rng.uniform(0.0, TWO_PI)
            drift = 1.0 + 0.0024 * np.sin(TWO_PI * lfo_rate * t + lfo_ph)
            ph = np.cumsum(TWO_PI * (fv * drift) / SR) + rng.uniform(0.0, TWO_PI)

            voice = (
                np.sin(ph)
                + 0.48 * np.sin(2.0 * ph + 0.5)
                + (0.24 * np.sin(3.0 * ph + 1.1) if fv * 3.0 < 3000.0 else 0.0)
                + (0.11 * np.sin(4.0 * ph + 1.8) if fv * 4.0 < 3200.0 else 0.0)
                + (0.05 * np.sin(5.0 * ph + 2.3) if fv * 5.0 < 3400.0 else 0.0)
            )
            gl, gr = pan_gains(pan)
            stereo[:, 0] += voice * gl * 0.25
            stereo[:, 1] += voice * gr * 0.25

    if choir_blend > 0.02:
        # Warm "Ooo/Ahh" choir vowel formants (F1=440 Hz, F2=920 Hz, F3=2150 Hz)
        sos_v1 = signal.butter(2, [340.0, 560.0], btype="band", fs=SR, output="sos")
        sos_v2 = signal.butter(2, [760.0, 1120.0], btype="band", fs=SR, output="sos")
        choir = signal.sosfilt(sos_v1, stereo, axis=0) * 1.35 + signal.sosfilt(sos_v2, stereo, axis=0) * 0.85
        stereo = stereo * (1.0 - 0.55 * choir_blend) + choir * (0.95 * choir_blend)

    sos_lp = signal.butter(3, 1950.0, btype="low", fs=SR, output="sos")
    stereo = signal.sosfilt(sos_lp, stereo, axis=0)

    att_t = min(1.35, max(0.45, dur * 0.28))
    att = (0.5 - 0.5 * np.cos(math.pi * np.clip(t / att_t, 0.0, 1.0))) ** 1.25
    breath = 0.88 + 0.12 * np.sin(TWO_PI * (1.0 / max(2.5, dur * 0.5)) * t)
    rel = 1.0 / (1.0 + np.exp((t - dur) / 0.38))
    env = (att * breath * rel * (vel * 0.14 / max(1.0, math.sqrt(len(chord_midis)))))[:, None]
    return (stereo * env).astype(np.float32)


def synth_rhodes_chord(chord_midis: Sequence[float], dur: float, vel: float = 0.72) -> np.ndarray:
    """Warm vintage Rhodes aquatic electric piano with gentle stereo autopan shimmer."""
    n_samp = int(round((dur + 1.1) * SR))
    t = np.arange(n_samp, dtype=np.float64) / SR
    mono = np.zeros(n_samp, dtype=np.float64)

    for idx, m in enumerate(chord_midis):
        # Subtle 18ms rolled chord humanization across notes
        delay_s = idx * 0.018
        td = np.maximum(0.0, t - delay_s)
        gate = (t >= delay_s).astype(np.float64)
        f = midi_to_hz(m)
        att = (1.0 - np.exp(-td / 0.008)) * gate
        # Warm tonebar fundamental + delicate 2x & 3x tine kiss on attack
        tonebar = np.sin(TWO_PI * f * td) * np.exp(-td / max(1.4, dur * 0.85))
        tine2 = 0.22 * vel * np.sin(TWO_PI * (f * 2.0) * td + 0.4) * np.exp(-td / 0.35)
        tine7 = (
            0.035 * vel * np.sin(TWO_PI * (f * 6.0) * td) * np.exp(-td / 0.045)
            if f * 6.0 < 3800.0
            else 0.0
        )
        mono += (tonebar + tine2 + tine7) * att

    # Gentle warm tube saturation
    mono = np.tanh(mono * 0.85) * (vel * 0.22 / max(1.0, math.sqrt(len(chord_midis))))
    rel = 1.0 / (1.0 + np.exp((t - (dur + 0.35)) / 0.22))
    mono *= rel

    # Lush slow suitcase stereo tremolo (0.55 Hz)
    trem_l = 0.78 + 0.22 * np.sin(TWO_PI * 0.55 * t)
    trem_r = 0.78 - 0.22 * np.sin(TWO_PI * 0.55 * t)
    stereo = np.zeros((n_samp, 2), dtype=np.float32)
    stereo[:, 0] = (mono * trem_l).astype(np.float32)
    stereo[:, 1] = (mono * trem_r).astype(np.float32)
    return stereo


def synth_sub_bass(freq: float, dur: float, vel: float = 0.72) -> np.ndarray:
    """Deep, silky warm acoustic/orchestral double-bass & sub cushion."""
    n_samp = int(round((dur + 0.45) * SR))
    t = np.arange(n_samp, dtype=np.float64) / SR
    att = (0.5 - 0.5 * np.cos(math.pi * np.clip(t / 0.045, 0.0, 1.0)))
    rel = 1.0 / (1.0 + np.exp((t - dur) / 0.14))
    sig = (
        np.sin(TWO_PI * freq * t) * 0.82
        + np.sin(TWO_PI * (freq * 2.0) * t + 0.3) * 0.28 * np.exp(-t / (dur * 0.7 + 0.3))
        + np.sin(TWO_PI * (freq * 3.0) * t + 0.7) * 0.08 * np.exp(-t / 0.35)
    )
    return (sig * att * rel * vel * 0.32).astype(np.float32)


# --- Soft Tactile Organic Hand-Percussion & Water Droplets ---


def synth_udu_pot(pitch_hz: float = 82.0, vel: float = 0.65) -> np.ndarray:
    """Earthy clay water-pot (Udu) air-cavity pulse."""
    n_samp = int(0.36 * SR)
    t = np.arange(n_samp, dtype=np.float64) / SR
    f_curve = pitch_hz * (1.0 + 0.38 * np.exp(-t / 0.024) - 0.14 * np.exp(-t / 0.095))
    ph = np.cumsum(TWO_PI * f_curve / SR)
    body = np.sin(ph) * np.exp(-t / 0.115)
    palm = 0.25 * np.sin(TWO_PI * (pitch_hz * 2.35) * t) * np.exp(-t / 0.022)
    att = 1.0 - np.exp(-t / 0.0045)
    return ((body + palm) * att * vel * 0.34).astype(np.float32)


def synth_soft_woodblock(freq: float = 520.0, vel: float = 0.55) -> np.ndarray:
    """Hollow carved temple woodblock tap (warm, rounded, zero high click)."""
    n_samp = int(0.16 * SR)
    t = np.arange(n_samp, dtype=np.float64) / SR
    att = 1.0 - np.exp(-t / 0.003)
    w1 = np.sin(TWO_PI * freq * t) * np.exp(-t / 0.032)
    w2 = 0.42 * np.sin(TWO_PI * (freq * 1.48) * t + 0.5) * np.exp(-t / 0.018)
    return ((w1 + w2) * att * vel * 0.24).astype(np.float32)


def synth_gentle_shaker(rng: np.random.Generator, vel: float = 0.45, dur: float = 0.13) -> np.ndarray:
    """Whisper-soft ocean-sand / seed-pod brush (< 3,600 Hz, tucked warmly in mix)."""
    n_samp = int(round(dur * SR))
    t = np.arange(n_samp, dtype=np.float64) / SR
    noise = rng.standard_normal(n_samp)
    sos_bp = signal.butter(2, [1350.0, 3400.0], btype="band", fs=SR, output="sos")
    shaped = signal.sosfilt(sos_bp, noise)
    env = np.sin(math.pi * np.clip(t / dur, 0.0, 1.0)) ** 1.8
    return (shaped * env * vel * 0.065).astype(np.float32)


def synth_orchestral_tom(pitch_hz: float = 54.0, vel: float = 0.75) -> np.ndarray:
    """Deep resonant orchestral concert bass drum / low tom swell."""
    n_samp = int(0.95 * SR)
    t = np.arange(n_samp, dtype=np.float64) / SR
    f_curve = pitch_hz * (1.0 + 0.42 * np.exp(-t / 0.045))
    ph = np.cumsum(TWO_PI * f_curve / SR)
    head = np.sin(ph) * np.exp(-t / 0.28)
    shell = 0.28 * np.sin(TWO_PI * (pitch_hz * 1.58) * t) * np.exp(-t / 0.14)
    att = 1.0 - np.exp(-t / 0.008)
    return ((head + shell) * att * vel * 0.38).astype(np.float32)


def synth_water_droplet(freq: float = 680.0, vel: float = 0.55) -> np.ndarray:
    """Physical Minnaert resonant water-bubble droplet (upward spherical cavity chirp)."""
    n_samp = int(0.22 * SR)
    t = np.arange(n_samp, dtype=np.float64) / SR
    tau = max(0.018, min(0.065, 22.0 / max(freq, 220.0)))
    # Minnaert bubble physics: upward pitch bend as bubble rises to surface
    f_inst = freq * (1.0 + 0.26 * np.clip(t / (tau * 1.4), 0.0, 1.3))
    ph = np.cumsum(TWO_PI * np.minimum(f_inst, 3400.0) / SR)
    att = 1.0 - np.exp(-t / 0.0025)
    sig = np.sin(ph) * np.exp(-t / tau) * att
    return (sig * vel * 0.22).astype(np.float32)


# ---------------------------------------------------------------------------
# 6 Evolving Multi-Section Acoustic Compositions (76.8s - 80.0s Each!)
# ---------------------------------------------------------------------------


def compose_sanctum_menu() -> np.ndarray:
    """
    1. music_sanctum_menu.ogg (76.8s, 24 bars @ 75 BPM in D Lydian / B minor9)
    Ethereal felt piano, warm solo cello swell, glass harp & gentle water droplets.
    """
    rng = np.random.default_rng(1001)
    bpm = 75.0
    beat = 60.0 / bpm  # 0.8s
    bar_len = 4.0 * beat  # 3.2s
    n_bars = 24
    loop_sec = n_bars * bar_len  # 76.8s exact!
    canvas = StudioCanvas(loop_sec, tail_seconds=8.5)

    # 4 evolving 6-bar sections (A: Sanctuary Awakening, B: Cello Aria, C: Pelagian Bloom, D: Nocturne Resolve)
    prog = [
        # Section A (bars 0..5): Dmaj9(#11) -> Bm11 -> Gmaj9 -> Asus4 -> Dmaj9 -> Gmaj7(#11)
        (38, [50, 57, 61, 66, 68]),
        (35, [47, 54, 57, 62, 64]),
        (31, [43, 50, 54, 59, 62]),
        (33, [45, 52, 57, 62, 64]),
        (38, [50, 57, 62, 66, 69]),
        (31, [43, 50, 55, 59, 66]),
        # Section B (bars 6..11): Solo Cello enters warmly
        (38, [50, 57, 61, 66, 69]),
        (42, [54, 57, 61, 64, 69]),
        (43, [43, 50, 54, 59, 62]),
        (40, [40, 47, 52, 55, 62]),
        (35, [47, 54, 57, 62, 66]),
        (33, [45, 52, 57, 61, 64]),
        # Section C (bars 12..17): Sacred Choir & Glass Harp Bloom
        (40, [52, 55, 59, 62, 66]),
        (42, [50, 54, 57, 62, 66]),
        (31, [43, 50, 55, 59, 66]),
        (33, [45, 52, 57, 62, 66]),
        (35, [47, 54, 59, 62, 66]),
        (31, [43, 50, 54, 59, 64]),
        # Section D (bars 18..23): Gentle sanctuary reflection resolving back to D Lydian
        (38, [50, 57, 61, 64, 66]),
        (35, [47, 54, 57, 61, 64]),
        (31, [43, 50, 54, 59, 62]),
        (40, [40, 47, 52, 55, 59]),
        (33, [45, 52, 55, 57, 62]),
        (33, [45, 52, 57, 61, 64]),
    ]

    arp_patterns = [
        [(0.0, 0), (0.5, 1), (1.0, 2), (1.5, 4), (2.5, 3), (3.25, 2)],
        [(0.0, 0), (0.75, 2), (1.5, 3), (2.0, 4), (3.0, 1)],
        [(0.0, 0), (0.5, 1), (1.0, 3), (2.0, 4), (2.75, 2), (3.5, 3)],
        [(0.0, 0), (1.0, 2), (1.75, 4), (2.5, 3)],
    ]

    for b, (bass_m, chord) in enumerate(prog):
        t0 = b * bar_len
        sec = b // 6  # 0..3
        phrase_dyn = 0.72 + 0.18 * math.sin(math.pi * ((b % 6) + 0.5) / 6.0)

        # Warm sub cushion
        canvas.add_Mono(synth_sub_bass(midi_to_hz(bass_m), bar_len * 0.92, 0.52 * phrase_dyn), t0, pan=0.0, reverb_send=0.18)

        # Lush strings + Pelagian choir bloom in Sections B, C, D
        if sec >= 1:
            pad_vel = [0.0, 0.45, 0.72, 0.42][sec] * phrase_dyn
            choir_amt = 0.58 if sec == 2 else 0.22
            pad = synth_warm_string_pad(chord, bar_len * 1.04, vel=pad_vel, choir_blend=choir_amt, seed=100 + b)
            canvas.add_Stereo(pad, t0, gain=1.0, reverb_send=0.55)

        # Ethereal Felt Piano arpeggios with gentle human rubato
        pat = arp_patterns[(b + sec) % len(arp_patterns)]
        for beat_off, note_idx in pat:
            jitter = float(rng.uniform(-0.014, 0.014)) if beat_off > 0 else 0.0
            m_note = chord[note_idx % len(chord)] + (12 if note_idx == 4 and sec == 2 else 0)
            vel = (0.64 if beat_off == 0 else 0.48) * phrase_dyn * float(rng.uniform(0.92, 1.06))
            pan = -0.22 + 0.11 * note_idx
            piano = synth_felt_piano(midi_to_hz(m_note), beat * 2.4, vel=vel, rng=rng)
            canvas.add_Mono(piano, t0 + beat_off * beat + jitter, gain=0.82, pan=pan, reverb_send=0.52)

        # Shimmering Glass Harp harmonics on alternating bars
        if b % 2 == 1 or sec == 2:
            gh_midi = chord[-1] + 12
            gh = synth_glass_harp(midi_to_hz(gh_midi), bar_len * 0.88, vel=0.46 * phrase_dyn)
            canvas.add_Stereo(gh, t0 + 0.5 * beat, gain=0.72, reverb_send=0.68)

        # Delicate water droplets in Sanctuary cavern (Sections A & D + sparse in B)
        if sec in (0, 3) or (b % 3 == 0):
            n_drops = 2 if sec in (0, 3) else 1
            for _ in range(n_drops):
                d_off = float(rng.uniform(0.3, bar_len - 0.3))
                d_midi = rng.choice(chord) + 24
                drop = synth_water_droplet(min(1850.0, midi_to_hz(d_midi)), vel=float(rng.uniform(0.32, 0.52)))
                canvas.add_Mono(drop, t0 + d_off, gain=0.55, pan=float(rng.uniform(-0.65, 0.65)), reverb_send=0.78)

    # Expressive Solo Cello Lyrical Melody (Sections B, C, and whisper in D)
    cello_melody = [
        # Section B (bars 6..11)
        (6, 0.0, 62, 2.5, 0.72, None),
        (6, 2.5, 66, 1.5, 0.68, 62),
        (7, 0.0, 69, 3.0, 0.78, 66),
        (7, 3.0, 66, 1.0, 0.62, None),
        (8, 0.0, 67, 2.0, 0.75, None),
        (8, 2.0, 66, 1.0, 0.66, None),
        (8, 3.0, 62, 1.0, 0.64, None),
        (9, 0.0, 64, 3.5, 0.74, 62),
        (10, 0.0, 62, 2.0, 0.70, None),
        (10, 2.0, 59, 2.0, 0.68, 62),
        (11, 0.0, 61, 3.6, 0.66, None),
        # Section C soaring climax (bars 12..17)
        (12, 0.0, 64, 2.0, 0.78, None),
        (12, 2.0, 67, 2.0, 0.80, 64),
        (13, 0.0, 69, 2.5, 0.84, 67),
        (13, 2.5, 74, 1.5, 0.86, 69),
        (14, 0.0, 73, 1.5, 0.82, None),
        (14, 1.5, 71, 2.5, 0.80, 73),
        (15, 0.0, 69, 3.5, 0.82, None),
        (16, 0.0, 66, 2.0, 0.76, None),
        (16, 2.0, 69, 2.0, 0.78, 66),
        (17, 0.0, 67, 2.5, 0.74, None),
        (17, 2.5, 64, 1.5, 0.66, None),
        # Section D peaceful farewell (bars 18..20)
        (18, 0.5, 62, 3.2, 0.62, None),
        (19, 0.5, 61, 3.0, 0.56, 62),
        (20, 0.0, 59, 3.8, 0.52, None),
    ]
    for bar_i, b_off, m_note, b_dur, vel, prev_m in cello_melody:
        prev_hz = midi_to_hz(prev_m) if prev_m is not None else None
        c_wave = synth_solo_cello(midi_to_hz(m_note), b_dur * beat, vel=vel, slide_from_hz=prev_hz)
        canvas.add_Mono(c_wave, bar_i * bar_len + b_off * beat, gain=0.88, pan=0.14, reverb_send=0.58)

    ir = build_space_ir(rt60=4.4, pre_delay_ms=28.0, hf_damping_hz=2150.0, canyon_echo=False, seed=201)
    return canvas.render_seamless(ir, wet_mix=0.46, cutoff_hz=5000.0)


def compose_canyon_river() -> np.ndarray:
    """
    2. music_canyon_river.ogg (76.8s, 32 bars @ 100 BPM in G Mixolydian / Major Pentatonic)
    Warm wooden marimba, acoustic guitar/harp plucks, breathy canyon bamboo flute & soft hand-percussion.
    """
    rng = np.random.default_rng(1002)
    bpm = 100.0
    beat = 60.0 / bpm  # 0.6s
    bar_len = 4.0 * beat  # 2.4s
    n_bars = 32
    loop_sec = n_bars * bar_len  # 76.8s exact!
    canvas = StudioCanvas(loop_sec, tail_seconds=8.0)

    sec_chords = [
        # Sec A (0..7): Gadd9 -> D/F# -> Em7 -> Cadd9 (x2)
        [(43, [55, 59, 62, 67, 69]), (42, [54, 57, 62, 66, 69]), (40, [52, 55, 59, 62, 67]), (36, [48, 55, 60, 62, 67])] * 2,
        # Sec B (8..15): Gadd9 -> Fmaj9(Mixolydian!) -> Cadd9 -> D9sus (x2)
        [(43, [55, 59, 62, 67, 69]), (41, [53, 57, 60, 64, 67]), (36, [48, 55, 60, 62, 67]), (38, [50, 55, 57, 60, 67])] * 2,
        # Sec C (16..23): Cmaj9 -> G/B -> Am11 -> D9sus -> Em9 -> Bm7 -> Cadd9 -> D13sus
        [
            (36, [48, 55, 59, 62, 67]),
            (35, [47, 55, 59, 62, 67]),
            (33, [45, 52, 55, 60, 62]),
            (38, [50, 55, 57, 60, 67]),
            (40, [52, 55, 59, 62, 66]),
            (35, [47, 54, 57, 62, 66]),
            (36, [48, 55, 60, 62, 67]),
            (38, [50, 55, 59, 62, 67]),
        ],
        # Sec D (24..31): Gentle river bend sunset return
        [(43, [55, 59, 62, 67, 69]), (40, [52, 55, 59, 62, 67]), (36, [48, 55, 60, 62, 67]), (38, [50, 55, 57, 62, 67])] * 2,
    ]
    prog = [item for sublist in sec_chords for item in sublist]

    guitar_pick = [(0.0, 0), (0.5, 2), (1.0, 3), (1.5, 1), (2.0, 4), (2.5, 2), (3.0, 3), (3.5, 1)]
    marimba_groove = [(0.0, 0, 0.72), (0.75, 2, 0.58), (1.5, 4, 0.68), (2.5, 3, 0.56), (3.25, 1, 0.52)]

    for b, (bass_m, chord) in enumerate(prog):
        t0 = b * bar_len
        sec = b // 8  # 0..3
        dyn = 0.74 + 0.16 * math.sin(math.pi * ((b % 8) + 0.5) / 8.0)

        # Warm acoustic bass pluck + sub breath
        canvas.add_Mono(synth_sub_bass(midi_to_hz(bass_m), bar_len * 0.82, vel=0.50 * dyn), t0, pan=-0.05, reverb_send=0.15)
        canvas.add_Mono(synth_acoustic_pluck(midi_to_hz(bass_m + 12), beat * 2.2, vel=0.62 * dyn), t0, pan=-0.12, reverb_send=0.28)

        # Cedar acoustic guitar / Celtic harp fingerpicking
        for b_off, idx in guitar_pick:
            if sec == 3 and b >= 29 and b_off >= 2.5:
                continue  # Spacious breathing room at loop turnaround
            m_n = chord[idx % len(chord)] + (12 if sec == 2 and idx == 4 else 0)
            jit = float(rng.uniform(-0.008, 0.008)) if b_off > 0 else 0.0
            pluck = synth_acoustic_pluck(midi_to_hz(m_n), beat * 1.9, vel=0.55 * dyn * float(rng.uniform(0.9, 1.06)))
            canvas.add_Mono(pluck, t0 + b_off * beat + jit, gain=0.72, pan=-0.34 + 0.12 * idx, reverb_send=0.38)

        # Warm Wooden Marimba flowing river patterns (Sections B, C, and light in A2/D1)
        if sec in (1, 2) or (sec == 0 and b >= 4) or (sec == 3 and b < 28):
            m_scale = 0.85 if sec in (1, 2) else 0.55
            for b_off, idx, v_base in marimba_groove:
                m_n = chord[(idx + (b % 2)) % len(chord)] + 12
                mar = synth_wooden_marimba(midi_to_hz(m_n), beat * 1.4, vel=v_base * m_scale * dyn)
                canvas.add_Mono(mar, t0 + b_off * beat, gain=0.75, pan=0.28 - 0.1 * (idx % 4), reverb_send=0.44)

        # Warm sunlit string pad in Sections B & C
        if sec in (1, 2):
            pad = synth_warm_string_pad(chord, bar_len * 1.04, vel=(0.56 if sec == 2 else 0.36) * dyn, choir_blend=0.15, seed=200 + b)
            canvas.add_Stereo(pad, t0, gain=0.92, reverb_send=0.48)

        # Soft tactile Udu clay water-pot & whisper seed shaker (never grating!)
        if b < 30:
            udu1 = synth_udu_pot(78.0, vel=0.58 * dyn)
            canvas.add_Mono(udu1, t0, gain=0.68, pan=-0.15, reverb_send=0.26)
            if sec in (1, 2):
                udu2 = synth_udu_pot(104.0, vel=0.44 * dyn)
                canvas.add_Mono(udu2, t0 + 1.5 * beat, gain=0.58, pan=0.18, reverb_send=0.28)
                udu3 = synth_udu_pot(88.0, vel=0.48 * dyn)
                canvas.add_Mono(udu3, t0 + 2.5 * beat, gain=0.60, pan=-0.12, reverb_send=0.26)
                for sh_beat in (0.5, 1.5, 2.5, 3.5):
                    sh = synth_gentle_shaker(rng, vel=0.38 * dyn)
                    canvas.add_Mono(sh, t0 + sh_beat * beat, gain=0.55, pan=0.32, reverb_send=0.22)
                if b % 2 == 1:
                    wb = synth_soft_woodblock(495.0, vel=0.40 * dyn)
                    canvas.add_Mono(wb, t0 + 3.0 * beat, gain=0.52, pan=-0.28, reverb_send=0.36)

    # Breathy Canyon Bamboo Flute Melody (Sections B, C & farewell motif in D)
    flute_phrases = [
        # Sec B: Sunlit canyon theme (G Mixolydian: G5=79, A5=81, B5=83, D5=74, E5=76, F5=77)
        (8, 0.5, 74, 2.0, 0.72, -2.0),
        (8, 2.5, 76, 1.5, 0.68, 0.0),
        (9, 0.0, 79, 2.5, 0.76, -2.0),
        (9, 2.5, 77, 1.5, 0.70, 2.0),
        (10, 0.0, 76, 1.5, 0.70, 0.0),
        (10, 1.5, 74, 2.2, 0.68, 2.0),
        (12, 0.5, 79, 1.5, 0.74, -2.0),
        (12, 2.0, 81, 2.0, 0.78, -2.0),
        (13, 0.0, 79, 1.5, 0.74, 2.0),
        (13, 1.5, 77, 1.5, 0.70, 0.0),
        (13, 3.0, 76, 1.0, 0.66, 0.0),
        (14, 0.0, 74, 3.5, 0.72, -2.0),
        # Sec C: Golden-hour vista counter-melody
        (16, 0.0, 76, 2.5, 0.76, -2.0),
        (16, 2.5, 79, 1.5, 0.78, 0.0),
        (17, 0.0, 83, 2.5, 0.82, -2.0),
        (17, 2.5, 81, 1.5, 0.76, 2.0),
        (18, 0.0, 79, 2.0, 0.78, 0.0),
        (18, 2.0, 76, 2.0, 0.72, 2.0),
        (19, 0.0, 74, 3.2, 0.74, 0.0),
        (20, 0.5, 76, 1.5, 0.74, -2.0),
        (20, 2.0, 79, 2.0, 0.78, 0.0),
        (21, 0.0, 81, 2.5, 0.80, -2.0),
        (21, 2.5, 79, 1.5, 0.74, 2.0),
        (22, 0.0, 76, 2.0, 0.72, 0.0),
        (22, 2.0, 74, 1.8, 0.68, 2.0),
        (23, 0.0, 79, 3.4, 0.74, -2.0),
        # Sec D: Intimate canyon echo
        (25, 1.0, 74, 2.8, 0.60, -2.0),
        (26, 0.5, 76, 1.5, 0.58, 0.0),
        (26, 2.0, 74, 2.0, 0.55, 2.0),
        (27, 0.0, 71, 3.4, 0.54, 0.0),
    ]
    for bar_i, b_off, m_n, b_dur, vel, grace in flute_phrases:
        fl = synth_bamboo_flute(midi_to_hz(m_n), b_dur * beat, vel=vel, rng=rng, grace_semi=grace)
        canvas.add_Mono(fl, bar_i * bar_len + b_off * beat, gain=0.84, pan=0.16, reverb_send=0.62)

    ir = build_space_ir(rt60=3.5, pre_delay_ms=24.0, hf_damping_hz=2350.0, canyon_echo=True, seed=202)
    return canvas.render_seamless(ir, wet_mix=0.42, cutoff_hz=5100.0)


def compose_alpine_lake() -> np.ndarray:
    """
    3. music_alpine_lake.ogg (80.0s exact, 28 bars @ 84 BPM in F Lydian / D minor9)
    Crystalline kalimba, celesta/felt-bell, lush warm string pad & French horn warmth.
    """
    rng = np.random.default_rng(1003)
    bpm = 84.0
    beat = 60.0 / bpm  # 0.7142857s
    bar_len = 4.0 * beat  # 2.8571428s -> 28 bars = 80.000s exact!
    n_bars = 28
    loop_sec = n_bars * bar_len  # 80.0s exact!
    canvas = StudioCanvas(loop_sec, tail_seconds=8.5)

    # 4 sections of 7 bars (A: Crystal Mirror, B: Alpenglow Horn, C: Summit Wonder, D: Stillness)
    base_cycle = [
        (41, [53, 57, 60, 64, 67]),  # Fmaj9
        (40, [52, 55, 60, 64, 67]),  # C/E
        (38, [50, 53, 57, 60, 64]),  # Dm9
        (34, [46, 53, 57, 60, 65]),  # Bbmaj9
        (43, [55, 58, 62, 65, 69]),  # Gm9
        (41, [53, 57, 60, 65, 69]),  # F6/9
        (36, [48, 55, 57, 60, 65]),  # C13sus
    ]
    prog = base_cycle * 4

    kalimba_pat_a = [(0.0, 0), (0.5, 2), (1.0, 4), (1.5, 3), (2.0, 1), (2.5, 4), (3.0, 2), (3.5, 3)]
    kalimba_pat_c = [(0.0, 0), (0.333, 1), (0.667, 2), (1.0, 4), (1.5, 3), (2.0, 2), (2.667, 4), (3.333, 1)]

    for b, (bass_m, chord) in enumerate(prog):
        t0 = b * bar_len
        sec = b // 7  # 0..3
        dyn = 0.70 + 0.20 * math.sin(math.pi * ((b % 7) + 0.5) / 7.0)

        # Deep mirror-lake sub & lush alpine string orchestra
        canvas.add_Mono(synth_sub_bass(midi_to_hz(bass_m), bar_len * 0.92, vel=0.50 * dyn), t0, pan=0.0, reverb_send=0.20)
        pad_v = [0.46, 0.60, 0.76, 0.48][sec] * dyn
        pad = synth_warm_string_pad(chord, bar_len * 1.06, vel=pad_v, choir_blend=(0.35 if sec == 2 else 0.12), seed=300 + b)
        canvas.add_Stereo(pad, t0, gain=0.95, reverb_send=0.56)

        # Crystalline Kalimba patterns
        pat = kalimba_pat_c if sec == 2 else kalimba_pat_a
        for b_off, idx in pat:
            if sec == 3 and b >= 26 and b_off >= 2.0:
                continue
            m_n = chord[idx % len(chord)] + 12
            kal = synth_kalimba(midi_to_hz(m_n), beat * 1.8, vel=0.54 * dyn * float(rng.uniform(0.92, 1.05)))
            canvas.add_Mono(kal, t0 + b_off * beat + float(rng.uniform(-0.006, 0.006)), gain=0.72, pan=-0.35 + 0.16 * (idx % 5), reverb_send=0.52)

        # Soft Felt Piano / Celesta droplets answering from across the lake
        if b % 2 == 0 or sec in (1, 2):
            cel_m = chord[-1] + 12
            cel = synth_felt_piano(midi_to_hz(cel_m), beat * 2.8, vel=0.52 * dyn, rng=rng)
            canvas.add_Mono(cel, t0 + 1.5 * beat, gain=0.68, pan=0.34, reverb_send=0.60)
            if sec == 2:
                cel2 = synth_felt_piano(midi_to_hz(chord[2] + 24), beat * 2.4, vel=0.45 * dyn, rng=rng)
                canvas.add_Mono(cel2, t0 + 3.0 * beat, gain=0.60, pan=-0.28, reverb_send=0.62)

    # Noble Warm French Horn Melody (Sections B & C + gentle echo in D)
    horn_notes = [
        # Sec B (bars 7..13)
        (7, 0.0, 60, 2.5, 0.72),
        (7, 2.5, 65, 1.5, 0.74),
        (8, 0.0, 67, 3.0, 0.78),
        (8, 3.0, 64, 1.0, 0.68),
        (9, 0.0, 65, 2.5, 0.75),
        (9, 2.5, 62, 1.5, 0.68),
        (10, 0.0, 60, 3.6, 0.72),
        (11, 0.5, 62, 2.0, 0.72),
        (11, 2.5, 65, 1.5, 0.75),
        (12, 0.0, 69, 3.0, 0.80),
        (13, 0.0, 67, 3.6, 0.74),
        # Sec C soaring summit theme (bars 14..20)
        (14, 0.0, 65, 2.0, 0.78),
        (14, 2.0, 69, 2.0, 0.82),
        (15, 0.0, 72, 3.0, 0.86),
        (15, 3.0, 69, 1.0, 0.76),
        (16, 0.0, 67, 2.0, 0.80),
        (16, 2.0, 65, 2.0, 0.76),
        (17, 0.0, 62, 3.6, 0.76),
        (18, 0.0, 65, 2.0, 0.78),
        (18, 2.0, 67, 2.0, 0.80),
        (19, 0.0, 69, 2.5, 0.82),
        (19, 2.5, 65, 1.5, 0.74),
        (20, 0.0, 67, 3.8, 0.76),
        # Sec D mountain echo (bars 21..23)
        (21, 0.5, 65, 3.2, 0.60),
        (22, 0.5, 64, 3.2, 0.55),
        (23, 0.0, 60, 3.8, 0.50),
    ]
    for bar_i, b_off, m_n, b_dur, vel in horn_notes:
        hn = synth_french_horn(midi_to_hz(m_n), b_dur * beat, vel=vel)
        canvas.add_Mono(hn, bar_i * bar_len + b_off * beat, gain=0.88, pan=-0.16, reverb_send=0.62)

    ir = build_space_ir(rt60=4.2, pre_delay_ms=26.0, hf_damping_hz=2400.0, canyon_echo=True, seed=203)
    return canvas.render_seamless(ir, wet_mix=0.45, cutoff_hz=5100.0)


def compose_mist_bayou() -> np.ndarray:
    """
    4. music_mist_bayou.ogg (76.8s, 24 bars @ 75 BPM in E Dorian)
    Expressive solo cello/viola, warm Rhodes-like aquatic pad, gentle woodblocks & twilight shimmer.
    """
    rng = np.random.default_rng(1004)
    bpm = 75.0
    beat = 60.0 / bpm  # 0.8s
    bar_len = 4.0 * beat  # 3.2s
    n_bars = 24
    loop_sec = n_bars * bar_len  # 76.8s exact!
    canvas = StudioCanvas(loop_sec, tail_seconds=8.5)

    prog = [
        # Sec A (0..5): Em9 -> A13sus -> Cmaj9 -> Bm7 -> Em9 -> A13sus
        (40, [52, 55, 59, 62, 66]),
        (33, [45, 52, 55, 59, 66]),
        (36, [48, 55, 59, 62, 67]),
        (35, [47, 54, 57, 62, 66]),
        (40, [52, 55, 59, 62, 66]),
        (33, [45, 52, 55, 61, 66]),
        # Sec B (6..11): Solo Viola/Cello winding through mossy arches
        (40, [52, 55, 59, 62, 66]),
        (38, [50, 54, 57, 62, 66]),
        (36, [48, 55, 59, 62, 66]),
        (33, [45, 52, 55, 61, 66]),
        (40, [52, 55, 59, 62, 67]),
        (35, [47, 54, 57, 62, 66]),
        # Sec C (12..17): Bioluminescent lotus sanctuary bloom
        (36, [48, 55, 59, 62, 66]),
        (38, [50, 54, 59, 62, 66]),
        (40, [52, 55, 59, 62, 67]),
        (42, [54, 57, 60, 64, 69]),
        (36, [48, 55, 59, 62, 66]),
        (35, [47, 54, 57, 62, 66]),
        # Sec D (18..23): Firefly drift home
        (40, [52, 55, 59, 62, 66]),
        (33, [45, 52, 55, 59, 66]),
        (36, [48, 55, 59, 62, 67]),
        (38, [50, 55, 57, 62, 66]),
        (40, [52, 55, 59, 62, 66]),
        (35, [47, 54, 57, 62, 64]),
    ]

    for b, (bass_m, chord) in enumerate(prog):
        t0 = b * bar_len
        sec = b // 6
        dyn = 0.72 + 0.18 * math.sin(math.pi * ((b % 6) + 0.5) / 6.0)

        # Warm sub & Rhodes aquatic suitcase pad
        canvas.add_Mono(synth_sub_bass(midi_to_hz(bass_m), bar_len * 0.90, vel=0.54 * dyn), t0, pan=0.0, reverb_send=0.18)
        rh = synth_rhodes_chord(chord, bar_len * 0.96, vel=0.70 * dyn)
        canvas.add_Stereo(rh, t0, gain=0.88, reverb_send=0.45)

        # Warm twilight string/choir halo in Sections B & C
        if sec in (1, 2):
            pad = synth_warm_string_pad(chord, bar_len * 1.05, vel=(0.58 if sec == 2 else 0.38) * dyn, choir_blend=0.28, seed=400 + b)
            canvas.add_Stereo(pad, t0, gain=0.86, reverb_send=0.54)

        # Firefly twilight shimmer (kalimba + glass harp harmonics)
        for f_off, idx in [(0.75, 4), (2.25, 2), (3.25, 3)]:
            if sec == 3 and b >= 22 and f_off > 2.0:
                continue
            kal = synth_kalimba(midi_to_hz(chord[idx % len(chord)] + 12), beat * 1.7, vel=0.42 * dyn)
            canvas.add_Mono(kal, t0 + f_off * beat, gain=0.62, pan=float(rng.uniform(-0.48, 0.48)), reverb_send=0.58)

        if b % 2 == 0:
            gh = synth_glass_harp(midi_to_hz(chord[3] + 12), bar_len * 0.85, vel=0.38 * dyn)
            canvas.add_Stereo(gh, t0 + 0.5 * beat, gain=0.65, reverb_send=0.66)

        # Gentle hollow woodblocks & clay udu bayou pulse
        if b < 22:
            canvas.add_Mono(synth_udu_pot(74.0, vel=0.50 * dyn), t0, gain=0.62, pan=-0.16, reverb_send=0.28)
            canvas.add_Mono(synth_soft_woodblock(460.0, vel=0.42 * dyn), t0 + 1.5 * beat, gain=0.52, pan=0.26, reverb_send=0.40)
            if b % 2 == 1:
                canvas.add_Mono(synth_soft_woodblock(585.0, vel=0.36 * dyn), t0 + 2.75 * beat, gain=0.48, pan=-0.24, reverb_send=0.42)
                canvas.add_Mono(synth_udu_pot(96.0, vel=0.42 * dyn), t0 + 3.25 * beat, gain=0.54, pan=0.14, reverb_send=0.30)

    # Expressive Solo Viola / Cello Bayou Melody (E Dorian: E4=64, F#4=66, G4=67, A4=69, B4=71, C#5=73, D5=74, E5=76)
    viola_line = [
        (6, 0.0, 64, 2.0, 0.74, None),
        (6, 2.0, 67, 1.0, 0.70, 64),
        (6, 3.0, 71, 1.0, 0.74, 67),
        (7, 0.0, 73, 2.5, 0.78, 71),
        (7, 2.5, 71, 1.5, 0.72, None),
        (8, 0.0, 67, 2.5, 0.74, 71),
        (8, 2.5, 69, 1.5, 0.70, None),
        (9, 0.0, 66, 3.6, 0.72, 69),
        (10, 0.5, 64, 1.5, 0.70, None),
        (10, 2.0, 67, 2.0, 0.74, 64),
        (11, 0.0, 66, 3.6, 0.68, None),
        # Sec C lotus bloom
        (12, 0.0, 71, 2.0, 0.80, None),
        (12, 2.0, 74, 2.0, 0.82, 71),
        (13, 0.0, 76, 2.5, 0.85, 74),
        (13, 2.5, 73, 1.5, 0.78, 76),
        (14, 0.0, 74, 2.0, 0.80, None),
        (14, 2.0, 71, 2.0, 0.76, 74),
        (15, 0.0, 69, 3.5, 0.78, None),
        (16, 0.0, 67, 2.0, 0.74, None),
        (16, 2.0, 71, 2.0, 0.76, 67),
        (17, 0.0, 66, 3.6, 0.72, 71),
        # Sec D twilight whisper
        (18, 0.5, 64, 3.2, 0.60, None),
        (19, 0.5, 66, 1.5, 0.56, None),
        (19, 2.0, 64, 2.0, 0.54, 66),
        (20, 0.0, 59, 3.8, 0.52, None),
    ]
    for bar_i, b_off, m_n, b_dur, vel, prev_m in viola_line:
        prev_hz = midi_to_hz(prev_m) if prev_m is not None else None
        vc = synth_solo_cello(midi_to_hz(m_n), b_dur * beat, vel=vel, slide_from_hz=prev_hz)
        canvas.add_Mono(vc, bar_i * bar_len + b_off * beat, gain=0.86, pan=0.12, reverb_send=0.58)

    ir = build_space_ir(rt60=3.7, pre_delay_ms=22.0, hf_damping_hz=1950.0, canyon_echo=False, seed=204)
    return canvas.render_seamless(ir, wet_mix=0.44, cutoff_hz=4900.0)


def compose_coral_sea() -> np.ndarray:
    """
    5. music_coral_sea.ogg (76.8s, 32 bars @ 100 BPM in A Major / Lydian)
    Sunlit tropical marimba/steel-tongue drum harmonic waves, airy choir pad & gentle shaker.
    """
    rng = np.random.default_rng(1005)
    bpm = 100.0
    beat = 60.0 / bpm  # 0.6s
    bar_len = 4.0 * beat  # 2.4s
    n_bars = 32
    loop_sec = n_bars * bar_len  # 76.8s exact!
    canvas = StudioCanvas(loop_sec, tail_seconds=8.0)

    sec_a = [(45, [57, 61, 64, 68, 71]), (44, [56, 59, 64, 68, 71]), (42, [54, 57, 61, 64, 69]), (38, [50, 57, 61, 64, 69])] * 2
    sec_b = [(45, [57, 61, 64, 68, 71]), (38, [50, 57, 62, 66, 69]), (42, [54, 57, 61, 64, 69]), (40, [52, 57, 59, 64, 69])] * 2
    sec_c = [
        (35, [47, 54, 57, 62, 66]),
        (37, [49, 56, 59, 64, 68]),
        (38, [50, 57, 61, 64, 68]),
        (40, [52, 57, 61, 64, 69]),
        (42, [54, 57, 61, 64, 69]),
        (38, [50, 57, 62, 66, 69]),
        (45, [57, 61, 64, 68, 71]),
        (40, [52, 57, 59, 64, 68]),
    ]
    sec_d = [(45, [57, 61, 64, 68, 71]), (38, [50, 57, 61, 64, 69]), (42, [54, 57, 61, 64, 69]), (40, [52, 57, 59, 64, 68])] * 2
    prog = sec_a + sec_b + sec_c + sec_d

    wave_pat = [(0.0, 0, 0.74), (0.5, 1, 0.56), (1.0, 2, 0.62), (1.5, 4, 0.68), (2.25, 3, 0.60), (3.0, 2, 0.58), (3.5, 1, 0.52)]

    for b, (bass_m, chord) in enumerate(prog):
        t0 = b * bar_len
        sec = b // 8
        dyn = 0.74 + 0.16 * math.sin(math.pi * ((b % 8) + 0.5) / 8.0)

        # Warm lagoon bass
        canvas.add_Mono(synth_sub_bass(midi_to_hz(bass_m), bar_len * 0.88, vel=0.52 * dyn), t0, pan=0.0, reverb_send=0.18)

        # Airy Pelagian Choir Pad ("Ahh/Ooo" vocal halo)
        choir_v = [0.42, 0.64, 0.78, 0.48][sec] * dyn
        pad = synth_warm_string_pad(chord, bar_len * 1.05, vel=choir_v, choir_blend=0.68, seed=500 + b)
        canvas.add_Stereo(pad, t0, gain=0.95, reverb_send=0.56)

        # Sunlit Steel-Tongue Drum & Rosewood Marimba Harmonic Waves
        for b_off, idx, v_base in wave_pat:
            if sec == 3 and b >= 30 and b_off >= 2.5:
                continue
            m_n = chord[(idx + (b % 2)) % len(chord)]
            jit = float(rng.uniform(-0.007, 0.007)) if b_off > 0 else 0.0
            td = synth_tongue_drum(midi_to_hz(m_n + 12), beat * 2.2, vel=v_base * 0.64 * dyn)
            canvas.add_Mono(td, t0 + b_off * beat + jit, gain=0.68, pan=-0.38 + 0.16 * (idx % 5), reverb_send=0.48)
            if sec in (1, 2) and b_off in (0.0, 1.5, 3.0):
                mar = synth_wooden_marimba(midi_to_hz(m_n), beat * 1.5, vel=v_base * 0.62 * dyn)
                canvas.add_Mono(mar, t0 + b_off * beat, gain=0.66, pan=0.30 - 0.12 * (idx % 4), reverb_send=0.42)

        # Nylon acoustic guitar sunlit off-beat strums in Sections B & C
        if sec in (1, 2):
            for s_idx, m_c in enumerate(chord[:4]):
                pl = synth_acoustic_pluck(midi_to_hz(m_c), beat * 1.8, vel=0.44 * dyn)
                canvas.add_Mono(pl, t0 + 1.5 * beat + s_idx * 0.022, gain=0.58, pan=-0.25, reverb_send=0.36)

        # Gentle ocean-sand shaker & udu lagoon pulse
        if b < 30:
            canvas.add_Mono(synth_udu_pot(84.0, vel=0.48 * dyn), t0, gain=0.58, pan=-0.10, reverb_send=0.25)
            if sec in (1, 2):
                canvas.add_Mono(synth_udu_pot(108.0, vel=0.40 * dyn), t0 + 2.25 * beat, gain=0.50, pan=0.14, reverb_send=0.25)
                for sh_b in (0.5, 1.0, 1.5, 2.5, 3.0, 3.5):
                    v_sh = (0.42 if sh_b in (1.0, 3.0) else 0.26) * dyn
                    canvas.add_Mono(synth_gentle_shaker(rng, vel=v_sh), t0 + sh_b * beat, gain=0.52, pan=0.28, reverb_send=0.22)

    # Sunlit Bamboo Flute & Glass Harp Reef Melody (Sections B & C)
    reef_melody = [
        (8, 0.0, 73, 1.5, 0.70, -2.0),
        (8, 1.5, 76, 2.5, 0.74, 0.0),
        (9, 0.5, 78, 1.5, 0.74, -2.0),
        (9, 2.0, 76, 2.0, 0.70, 2.0),
        (10, 0.0, 73, 2.0, 0.72, 0.0),
        (10, 2.0, 69, 2.0, 0.68, 2.0),
        (12, 0.0, 76, 1.5, 0.74, -2.0),
        (12, 1.5, 80, 2.5, 0.78, -2.0),
        (13, 0.0, 78, 2.0, 0.76, 2.0),
        (13, 2.0, 76, 2.0, 0.72, 0.0),
        (14, 0.0, 73, 3.5, 0.72, -2.0),
        # Sec C underwater cathedral soar
        (16, 0.0, 74, 2.0, 0.74, -2.0),
        (16, 2.0, 78, 2.0, 0.78, 0.0),
        (17, 0.0, 80, 2.5, 0.80, -2.0),
        (17, 2.5, 76, 1.5, 0.74, 2.0),
        (18, 0.0, 81, 2.5, 0.84, -1.0),
        (18, 2.5, 80, 1.5, 0.78, 0.0),
        (19, 0.0, 76, 3.5, 0.78, 2.0),
        (20, 0.5, 78, 1.5, 0.76, -2.0),
        (20, 2.0, 81, 2.0, 0.82, 0.0),
        (21, 0.0, 78, 2.0, 0.76, 2.0),
        (21, 2.0, 74, 2.0, 0.72, 0.0),
        (22, 0.0, 76, 3.6, 0.76, -2.0),
    ]
    for bar_i, b_off, m_n, b_dur, vel, grace in reef_melody:
        fl = synth_bamboo_flute(midi_to_hz(m_n), b_dur * beat, vel=vel, rng=rng, grace_semi=grace)
        canvas.add_Mono(fl, bar_i * bar_len + b_off * beat, gain=0.80, pan=0.15, reverb_send=0.58)

    ir = build_space_ir(rt60=3.6, pre_delay_ms=20.0, hf_damping_hz=2450.0, canyon_echo=False, seed=205)
    return canvas.render_seamless(ir, wet_mix=0.43, cutoff_hz=5100.0)


def compose_storm_ocean() -> np.ndarray:
    """
    6. music_storm_ocean.ogg (76.8s, 32 bars @ 100 BPM in C Minor / Eb Major Heroic)
    Deep cinematic orchestral brass/cello ostinato, sub-bass pulse & soaring heroic melody
    (dramatic yet warm orchestral, ZERO harsh saw buzz!).
    """
    rng = np.random.default_rng(1006)
    bpm = 100.0
    beat = 60.0 / bpm  # 0.6s
    bar_len = 4.0 * beat  # 2.4s
    n_bars = 32
    loop_sec = n_bars * bar_len  # 76.8s exact!
    canvas = StudioCanvas(loop_sec, tail_seconds=8.5)

    sec_a = [(36, [48, 55, 60, 62, 63]), (44, [44, 51, 56, 60, 63]), (41, [41, 48, 53, 56, 60]), (43, [43, 50, 55, 58, 62])] * 2
    sec_b = [(36, [48, 55, 60, 63, 67]), (44, [44, 51, 56, 60, 67]), (39, [39, 46, 51, 55, 62]), (43, [43, 50, 55, 60, 62])] * 2
    sec_c = [
        (39, [51, 55, 58, 62, 67]),  # Ebmaj9 heroic lift!
        (34, [46, 53, 58, 62, 65]),  # Bb/D
        (41, [41, 48, 53, 56, 63]),  # Fm9
        (36, [48, 55, 58, 63, 67]),  # Cm7
        (44, [44, 51, 56, 60, 67]),  # Abmaj9
        (39, [51, 55, 58, 63, 67]),  # Eb
        (41, [41, 48, 53, 56, 60]),  # Fm7
        (43, [43, 50, 55, 60, 62]),  # G7sus4
    ]
    sec_d = [(36, [48, 55, 60, 62, 63]), (44, [44, 51, 56, 60, 63]), (41, [41, 48, 53, 56, 60]), (43, [43, 50, 55, 60, 62])] * 2
    prog = sec_a + sec_b + sec_c + sec_d

    # Bowed cello spiccato ostinato (8th-note warm acoustic pulse, accented 3+3+2 feel)
    ost_steps = [(0.0, 0, 0.80), (0.5, 1, 0.52), (1.0, 2, 0.58), (1.5, 0, 0.76), (2.0, 1, 0.52), (2.5, 2, 0.58), (3.0, 3, 0.72), (3.5, 1, 0.50)]

    for b, (bass_m, chord) in enumerate(prog):
        t0 = b * bar_len
        sec = b // 8
        dyn = 0.76 + 0.18 * math.sin(math.pi * ((b % 8) + 0.5) / 8.0)

        # Warm oceanic sub-bass pulse (downbeat + beat 2.5)
        canvas.add_Mono(synth_sub_bass(midi_to_hz(bass_m), beat * 2.2, vel=0.68 * dyn), t0, pan=0.0, reverb_send=0.16)
        if sec < 3 or b < 28:
            canvas.add_Mono(synth_sub_bass(midi_to_hz(bass_m), beat * 1.4, vel=0.54 * dyn), t0 + 2.5 * beat, pan=0.0, reverb_send=0.16)

        # Bowed Cello / Viola Orchestral Ostinato
        ost_scale = 0.55 if (sec == 3 and b >= 28) else 0.85
        for b_off, idx, v_base in ost_steps:
            if sec == 3 and b >= 30 and b_off >= 2.0:
                continue
            m_n = chord[idx % len(chord)]
            spic = synth_spiccato_cello(midi_to_hz(m_n), beat * 0.52, vel=v_base * ost_scale * dyn)
            canvas.add_Mono(spic, t0 + b_off * beat + float(rng.uniform(-0.005, 0.005)), gain=0.72, pan=-0.28 + 0.18 * (idx % 4), reverb_send=0.38)

        # Lush Symphony Strings & Polar Aurora Choir Pad
        pad_v = [0.46, 0.65, 0.84, 0.52][sec] * dyn
        pad = synth_warm_string_pad(chord, bar_len * 1.05, vel=pad_v, choir_blend=(0.48 if sec == 2 else 0.18), seed=600 + b)
        canvas.add_Stereo(pad, t0, gain=0.96, reverb_send=0.52)

        # Felt Piano dramatic low-mid chord anchor on bar downbeats (Sections B & C)
        if sec in (1, 2) and b % 2 == 0:
            fp = synth_felt_piano(midi_to_hz(chord[0]), beat * 3.5, vel=0.66 * dyn, rng=rng)
            canvas.add_Mono(fp, t0, gain=0.72, pan=-0.22, reverb_send=0.48)
            fp_hi = synth_felt_piano(midi_to_hz(chord[-1] + 12), beat * 2.8, vel=0.54 * dyn, rng=rng)
            canvas.add_Mono(fp_hi, t0 + 1.5 * beat, gain=0.62, pan=0.28, reverb_send=0.54)

        # Deep Orchestral Concert Bass Drum / Tom Swells
        if b < 30:
            tom_v = (0.72 if sec == 2 else 0.56) * dyn
            canvas.add_Mono(synth_orchestral_tom(49.0, vel=tom_v), t0, gain=0.68, pan=0.0, reverb_send=0.34)
            if sec in (1, 2):
                canvas.add_Mono(synth_orchestral_tom(64.0, vel=0.46 * dyn), t0 + 1.5 * beat, gain=0.56, pan=-0.18, reverb_send=0.32)
                canvas.add_Mono(synth_orchestral_tom(56.0, vel=0.52 * dyn), t0 + 3.0 * beat, gain=0.60, pan=0.18, reverb_send=0.32)

    # Soaring Heroic French Horn + Solo Cello Unison Theme (Sections B & C + noble coda in D)
    hero_theme = [
        # Sec B: Rising through the tempest (Cm -> Ab -> Eb -> Gsus)
        (8, 0.0, 60, 2.5, 0.78),
        (8, 2.5, 63, 1.5, 0.76),
        (9, 0.0, 67, 3.0, 0.84),
        (9, 3.0, 65, 1.0, 0.74),
        (10, 0.0, 63, 2.0, 0.78),
        (10, 2.0, 62, 2.0, 0.76),
        (11, 0.0, 60, 3.6, 0.76),
        (12, 0.0, 67, 2.5, 0.84),
        (12, 2.5, 70, 1.5, 0.82),
        (13, 0.0, 68, 2.5, 0.82),
        (13, 2.5, 67, 1.5, 0.78),
        (14, 0.0, 63, 2.0, 0.78),
        (14, 2.0, 65, 2.0, 0.80),
        (15, 0.0, 67, 3.6, 0.84),
        # Sec C: Polar Aurora Heroic Climax (Eb major / C minor soar!)
        (16, 0.0, 67, 2.0, 0.86),
        (16, 2.0, 70, 2.0, 0.88),
        (17, 0.0, 74, 3.0, 0.90),
        (17, 3.0, 72, 1.0, 0.82),
        (18, 0.0, 72, 2.0, 0.86),
        (18, 2.0, 68, 2.0, 0.82),
        (19, 0.0, 67, 3.6, 0.84),
        (20, 0.0, 68, 2.0, 0.84),
        (20, 2.0, 72, 2.0, 0.88),
        (21, 0.0, 75, 2.5, 0.90),
        (21, 2.5, 74, 1.5, 0.84),
        (22, 0.0, 72, 2.0, 0.84),
        (22, 2.0, 68, 2.0, 0.80),
        (23, 0.0, 67, 3.8, 0.86),
        # Sec D: Majestic oceanic resolve
        (24, 0.0, 60, 3.6, 0.68),
        (25, 0.5, 63, 3.2, 0.64),
        (26, 0.5, 62, 3.2, 0.60),
        (27, 0.0, 60, 3.8, 0.58),
    ]
    for bar_i, b_off, m_n, b_dur, vel in hero_theme:
        t_pos = bar_i * bar_len + b_off * beat
        hn = synth_french_horn(midi_to_hz(m_n), b_dur * beat, vel=vel)
        canvas.add_Mono(hn, t_pos, gain=0.84, pan=-0.18, reverb_send=0.58)
        # Double melody with warm lyrical solo cello an octave or unison in climax
        vc = synth_solo_cello(midi_to_hz(m_n), b_dur * beat, vel=vel * 0.85)
        canvas.add_Mono(vc, t_pos, gain=0.76, pan=0.22, reverb_send=0.56)

    ir = build_space_ir(rt60=3.9, pre_delay_ms=25.0, hf_damping_hz=2250.0, canyon_echo=False, seed=206)
    return canvas.render_seamless(ir, wet_mix=0.42, cutoff_hz=5000.0)


# ---------------------------------------------------------------------------
# 5 Natural Stereo Water Ambience Loops (40.0s Seamless Periodic Soundscapes)
# ---------------------------------------------------------------------------


def periodic_pink_noise(n_samples: int, rng: np.random.Generator, slope: float = 0.5) -> np.ndarray:
    """
    Synthesizes exact circularly periodic 1/f^(2*slope) noise in the frequency domain!
    Guaranteed 100.000% seamless at loop wrap with zero crossfade artifact.
    """
    n_bins = n_samples // 2 + 1
    phases = rng.uniform(0.0, TWO_PI, size=n_bins)
    mags = rng.rayleigh(scale=1.0, size=n_bins)
    freqs = np.arange(n_bins, dtype=np.float64)
    freqs[0] = 1.0
    mags /= freqs ** slope
    mags[0] = 0.0
    spec = mags * np.exp(1j * phases)
    wave_t = np.fft.irfft(spec, n=n_samples)
    wave_t /= max(float(np.std(wave_t)), 1e-8)
    return wave_t


def periodic_band(
    n_samples: int,
    rng: np.random.Generator,
    lo_hz: float,
    hi_hz: float,
    slope: float = 0.55,
) -> np.ndarray:
    """Circularly filtered multi-band natural water/air flow layer."""
    raw = periodic_pink_noise(n_samples, rng, slope=slope)
    pad = min(n_samples // 4, SR * 2)
    wrapped = np.pad(raw, (pad, pad), mode="wrap")
    sos = signal.butter(3, [max(25.0, lo_hz), min(4500.0, hi_hz)], btype="band", fs=SR, output="sos")
    out = signal.sosfiltfilt(sos, wrapped)[pad : pad + n_samples]
    out /= max(float(np.std(out)), 1e-8)
    return out


def periodic_swell(n_samples: int, cycles_weights: Sequence[Tuple[int, float, float]]) -> np.ndarray:
    """Smooth strictly periodic wave-swell envelope over n_samples using integer harmonic cycles."""
    theta = TWO_PI * np.arange(n_samples, dtype=np.float64) / n_samples
    env = np.zeros(n_samples, dtype=np.float64)
    total_w = 0.0
    for k_cyc, weight, phase in cycles_weights:
        env += weight * (0.5 + 0.5 * np.sin(k_cyc * theta + phase))
        total_w += weight
    return env / max(total_w, 1e-8)


def sprinkle_water_droplets(
    stereo_buf: np.ndarray,
    rng: np.random.Generator,
    count: int,
    freq_range: Tuple[float, float],
    vel_range: Tuple[float, float],
    prob_env: np.ndarray | None = None,
) -> None:
    """Adds circularly wrapped Minnaert liquid droplets / riffle bubbles across stereo space."""
    n_samp = len(stereo_buf)
    for _ in range(count):
        idx = int(rng.integers(0, n_samp))
        if prob_env is not None and rng.random() > float(prob_env[idx]):
            continue
        f_drop = float(rng.uniform(freq_range[0], freq_range[1]))
        vel = float(rng.uniform(vel_range[0], vel_range[1]))
        drop = synth_water_droplet(f_drop, vel=vel)
        pan = float(rng.uniform(-0.82, 0.82))
        gl, gr = pan_gains(pan)
        d_len = len(drop)
        end_idx = idx + d_len
        if end_idx <= n_samp:
            stereo_buf[idx:end_idx, 0] += drop * gl
            stereo_buf[idx:end_idx, 1] += drop * gr
        else:
            first = n_samp - idx
            rem = d_len - first
            stereo_buf[idx:, 0] += drop[:first] * gl
            stereo_buf[idx:, 1] += drop[:first] * gr
            stereo_buf[:rem, 0] += drop[first:] * gl
            stereo_buf[:rem, 1] += drop[first:] * gr


def finalize_ambience(stereo_raw: np.ndarray, ir: np.ndarray, wet_mix: float, cutoff_hz: float, rms_db: float) -> np.ndarray:
    """Circularly convolves water ambience with natural space IR and masters cleanly."""
    n_samp = len(stereo_raw)
    pad = len(ir)
    wrapped = np.pad(stereo_raw, ((pad, pad), (0, 0)), mode="wrap")
    wet_l = signal.fftconvolve(wrapped[:, 0], ir[:, 0], mode="full")[pad : pad + n_samp]
    wet_r = signal.fftconvolve(wrapped[:, 1], ir[:, 1], mode="full")[pad : pad + n_samp]
    mix = np.zeros((n_samp, 2), dtype=np.float64)
    mix[:, 0] = stereo_raw[:, 0] + (wet_l * 0.85 + wet_r * 0.15) * wet_mix
    mix[:, 1] = stereo_raw[:, 1] + (wet_r * 0.85 + wet_l * 0.15) * wet_mix
    return master_circular_stereo(mix, cutoff_hz=cutoff_hz, target_rms_db=rms_db)


def build_amb_river_rapids(dur_sec: float = 40.0) -> np.ndarray:
    """1. amb_river_rapids.ogg: Canyon river flow, distant waterfall mist, riffle droplets & pine breeze."""
    rng = np.random.default_rng(2001)
    n = int(round(dur_sec * SR))
    out = np.zeros((n, 2), dtype=np.float64)

    swell_l = 0.58 + 0.42 * periodic_swell(n, [(5, 1.0, 0.2), (11, 0.55, 1.4), (19, 0.3, 2.8)])
    swell_r = 0.58 + 0.42 * periodic_swell(n, [(5, 1.0, 1.7), (13, 0.55, 0.5), (23, 0.3, 4.1)])
    breeze = 0.35 + 0.65 * periodic_swell(n, [(3, 1.0, 0.8), (7, 0.5, 2.4)])

    # Deep river current + mid boulder wash + distant waterfall velvet mist + canyon breeze
    for ch, sw in enumerate([swell_l, swell_r]):
        deep_flow = periodic_band(n, rng, 95.0, 320.0, slope=0.70) * 0.34 * sw
        rapid_body = periodic_band(n, rng, 310.0, 920.0, slope=0.55) * 0.26 * (0.7 + 0.3 * sw)
        mist = periodic_band(n, rng, 880.0, 2150.0, slope=0.65) * 0.11
        air = periodic_band(n, rng, 380.0, 1250.0, slope=0.60) * 0.09 * breeze
        out[:, ch] = deep_flow + rapid_body + mist + air

    # Liquid boulder-eddy babble & droplets
    sprinkle_water_droplets(out, rng, count=460, freq_range=(360.0, 1480.0), vel_range=(0.08, 0.24), prob_env=swell_l)
    ir = build_space_ir(rt60=2.4, pre_delay_ms=18.0, hf_damping_hz=2100.0, canyon_echo=True, seed=301)
    return finalize_ambience(out, ir, wet_mix=0.34, cutoff_hz=4400.0, rms_db=-22.5)


def build_amb_alpine_lap(dur_sec: float = 40.0) -> np.ndarray:
    """2. amb_alpine_lap.ogg: Serene alpine lake shore laps, smooth granite ripples & high-meadow breeze."""
    rng = np.random.default_rng(2002)
    n = int(round(dur_sec * SR))
    out = np.zeros((n, 2), dtype=np.float64)

    # Gentle 6.6s - 8s shore lap crests moving smoothly across stones
    lap_l = periodic_swell(n, [(6, 1.0, 0.0), (11, 0.38, 1.2)]) ** 2.2
    lap_r = periodic_swell(n, [(6, 1.0, 1.3), (13, 0.38, 2.7)]) ** 2.2
    breeze = periodic_swell(n, [(2, 1.0, 0.4), (5, 0.6, 2.1)]) ** 1.4

    for ch, lap in enumerate([lap_l, lap_r]):
        water_body = periodic_band(n, rng, 140.0, 520.0, slope=0.68) * (0.12 + 0.32 * lap)
        shore_wash = periodic_band(n, rng, 480.0, 1380.0, slope=0.62) * (0.04 + 0.20 * lap)
        pine_wind = periodic_band(n, rng, 260.0, 880.0, slope=0.65) * (0.07 + 0.12 * breeze)
        out[:, ch] = water_body + shore_wash + pine_wind

    sprinkle_water_droplets(out, rng, count=210, freq_range=(420.0, 1550.0), vel_range=(0.07, 0.22), prob_env=0.25 + 0.75 * lap_l)
    ir = build_space_ir(rt60=3.1, pre_delay_ms=22.0, hf_damping_hz=2200.0, canyon_echo=False, seed=302)
    return finalize_ambience(out, ir, wet_mix=0.40, cutoff_hz=4200.0, rms_db=-23.5)


def build_amb_bayou_night(dur_sec: float = 40.0) -> np.ndarray:
    """3. amb_bayou_night.ogg: Lazy delta currents, cypress moss water drips & warm twilight reed shimmer."""
    rng = np.random.default_rng(2003)
    n = int(round(dur_sec * SR))
    t = np.arange(n, dtype=np.float64) / SR
    out = np.zeros((n, 2), dtype=np.float64)

    swirl_l = 0.45 + 0.55 * periodic_swell(n, [(4, 1.0, 0.3), (9, 0.45, 1.9)])
    swirl_r = 0.45 + 0.55 * periodic_swell(n, [(4, 1.0, 2.1), (7, 0.45, 0.7)])

    for ch, sw in enumerate([swirl_l, swirl_r]):
        channel = periodic_band(n, rng, 110.0, 410.0, slope=0.72) * 0.28 * sw
        reeds = periodic_band(n, rng, 360.0, 960.0, slope=0.66) * 0.11 * (1.1 - 0.4 * sw)
        out[:, ch] = channel + reeds

    # Ultra-gentle, warm twilight harmonic chorus (2,050 Hz & 2,440 Hz pulsed softly — warm, NEVER piercing!)
    shimmer_env_l = (periodic_swell(n, [(3, 1.0, 0.0), (8, 0.6, 1.5)]) ** 2.6) * (0.5 + 0.5 * np.sin(TWO_PI * 3.5 * t))
    shimmer_env_r = (periodic_swell(n, [(3, 1.0, 2.4), (7, 0.6, 0.6)]) ** 2.6) * (0.5 + 0.5 * np.sin(TWO_PI * 3.25 * t + 1.1))
    out[:, 0] += np.sin(TWO_PI * 1980.0 * t) * shimmer_env_l * 0.018
    out[:, 1] += np.sin(TWO_PI * 2220.0 * t) * shimmer_env_r * 0.018

    # Resonant cypress-moss water drips into deep bayou pools
    sprinkle_water_droplets(out, rng, count=165, freq_range=(340.0, 1280.0), vel_range=(0.10, 0.28))
    ir = build_space_ir(rt60=2.9, pre_delay_ms=20.0, hf_damping_hz=1850.0, canyon_echo=False, seed=303)
    return finalize_ambience(out, ir, wet_mix=0.42, cutoff_hz=4000.0, rms_db=-23.5)


def build_amb_coral_surf(dur_sec: float = 40.0) -> np.ndarray:
    """4. amb_coral_surf.ogg: Sunlit 8s turquoise atoll reef swells, warm sandy wash & trade-wind palms."""
    rng = np.random.default_rng(2004)
    n = int(round(dur_sec * SR))
    out = np.zeros((n, 2), dtype=np.float64)

    # 5 main soothing reef waves across 40s (~8.0s wave period!) rolling smoothly from L to R shore
    wave_l = periodic_swell(n, [(5, 1.0, 0.0), (9, 0.32, 1.1)]) ** 1.9
    wave_r = periodic_swell(n, [(5, 1.0, 0.95), (9, 0.32, 2.0)]) ** 1.9
    foam_l = periodic_swell(n, [(5, 1.0, -0.55), (11, 0.25, 0.4)]) ** 2.4
    foam_r = periodic_swell(n, [(5, 1.0, 0.40), (11, 0.25, 1.3)]) ** 2.4
    trade_wind = 0.45 + 0.55 * periodic_swell(n, [(3, 1.0, 0.7), (7, 0.4, 2.5)])

    for ch, (wv, fm) in enumerate([(wave_l, foam_l), (wave_r, foam_r)]):
        reef_swell = periodic_band(n, rng, 75.0, 340.0, slope=0.72) * (0.16 + 0.42 * wv)
        sandy_foam = periodic_band(n, rng, 380.0, 1650.0, slope=0.60) * (0.04 + 0.24 * fm)
        palms = periodic_band(n, rng, 320.0, 1050.0, slope=0.65) * 0.08 * trade_wind
        out[:, ch] = reef_swell + sandy_foam + palms

    sprinkle_water_droplets(out, rng, count=260, freq_range=(390.0, 1520.0), vel_range=(0.06, 0.20), prob_env=foam_l)
    ir = build_space_ir(rt60=2.6, pre_delay_ms=18.0, hf_damping_hz=2250.0, canyon_echo=False, seed=304)
    return finalize_ambience(out, ir, wet_mix=0.35, cutoff_hz=4300.0, rms_db=-22.5)


def build_amb_ocean_swell(dur_sec: float = 40.0) -> np.ndarray:
    """5. amb_ocean_swell.ogg: Deep majestic 10s polar ocean swells, glacier wash & open-sea aurora wind."""
    rng = np.random.default_rng(2005)
    n = int(round(dur_sec * SR))
    out = np.zeros((n, 2), dtype=np.float64)

    # 4 majestic 10-second deep-water swells across 40.0s
    swell_l = periodic_swell(n, [(4, 1.0, 0.0), (7, 0.38, 1.6)]) ** 1.7
    swell_r = periodic_swell(n, [(4, 1.0, 1.1), (7, 0.38, 2.8)]) ** 1.7
    aurora_wind = periodic_swell(n, [(3, 1.0, 0.5), (5, 0.55, 2.2), (9, 0.25, 0.9)]) ** 1.5

    for ch, sw in enumerate([swell_l, swell_r]):
        abyss_swell = periodic_band(n, rng, 48.0, 240.0, slope=0.78) * (0.24 + 0.46 * sw)
        surge_wash = periodic_band(n, rng, 240.0, 980.0, slope=0.62) * (0.08 + 0.24 * sw)
        sea_wind = periodic_band(n, rng, 220.0, 860.0, slope=0.68) * (0.09 + 0.16 * aurora_wind)
        out[:, ch] = abyss_swell + surge_wash + sea_wind

    sprinkle_water_droplets(out, rng, count=190, freq_range=(280.0, 1120.0), vel_range=(0.07, 0.20), prob_env=swell_l)
    ir = build_space_ir(rt60=3.2, pre_delay_ms=24.0, hf_damping_hz=1950.0, canyon_echo=False, seed=305)
    return finalize_ambience(out, ir, wet_mix=0.38, cutoff_hz=4100.0, rms_db=-22.0)


# ---------------------------------------------------------------------------
# WAV Export, Vorbis OGG Encoding & Automated Acoustic QA Verification
# ---------------------------------------------------------------------------


def write_wav_16bit_tpdf(path: Path, stereo: np.ndarray, rng: np.random.Generator) -> None:
    """Writes 44.1 kHz stereo 16-bit PCM WAV with triangular TPDF dither."""
    dither = (rng.random(stereo.shape) - rng.random(stereo.shape)) * (1.0 / 32768.0)
    pcm = np.clip(np.round((stereo + dither) * 32767.0), -32768, 32767).astype(np.int16)
    with wave.open(str(path), "wb") as wf:
        wf.setnchannels(2)
        wf.setsampwidth(2)
        wf.setframerate(SR)
        wf.writeframes(pcm.tobytes())


def inspect_spectrum_and_seam(stereo: np.ndarray) -> Dict[str, float]:
    """Verifies zero harsh > 6 kHz energy and click-free loop wrap."""
    mono = 0.5 * (stereo[:, 0] + stereo[:, 1])
    # Measure spectral band ratio (> 6 kHz vs 80 - 4500 Hz body)
    spec = np.abs(np.fft.rfft(mono)) ** 2
    freqs = np.fft.rfftfreq(len(mono), d=1.0 / SR)
    body_e = float(np.sum(spec[(freqs >= 80.0) & (freqs <= 4500.0)])) + 1e-18
    harsh_e = float(np.sum(spec[freqs > 6000.0])) + 1e-18
    hf_ratio_db = 10.0 * math.log10(harsh_e / body_e)

    seam_jump = float(np.max(np.abs(stereo[-1] - stereo[0])))
    rms_db = 20.0 * math.log10(math.sqrt(float(np.mean(stereo * stereo)) + 1e-12))
    peak_db = 20.0 * math.log10(float(np.max(np.abs(stereo))) + 1e-12)
    return {
        "duration_s": round(len(stereo) / SR, 3),
        "rms_db": round(rms_db, 2),
        "peak_db": round(peak_db, 2),
        "above_6khz_rel_db": round(hf_ratio_db, 2),
        "loop_seam_delta": round(seam_jump, 5),
    }


def encode_and_verify_ogg(
    ffmpeg_path: str,
    ffprobe_path: str,
    wav_path: Path,
    ogg_path: Path,
    q_level: str = "3.6",
) -> int:
    cmd = [
        ffmpeg_path,
        "-y",
        "-v",
        "error",
        "-i",
        str(wav_path),
        "-c:a",
        "libvorbis",
        "-q:a",
        q_level,
        "-ar",
        str(SR),
        "-ac",
        "2",
        str(ogg_path),
    ]
    subprocess.run(cmd, check=True)

    # Full-stream decode verification (must produce 0 decode errors!)
    verify_cmd = [ffmpeg_path, "-v", "error", "-i", str(ogg_path), "-f", "null", "-"]
    subprocess.run(verify_cmd, check=True)

    if ffprobe_path:
        probe_cmd = [
            ffprobe_path,
            "-v",
            "error",
            "-show_entries",
            "stream=codec_name,channels,sample_rate,duration",
            "-of",
            "json",
            str(ogg_path),
        ]
        subprocess.run(probe_cmd, check=True, stdout=subprocess.DEVNULL)

    return ogg_path.stat().st_size


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    ffmpeg_path = find_ffmpeg()
    ffprobe_path = find_ffprobe(ffmpeg_path)
    dither_rng = np.random.default_rng(9090)

    jobs = [
        ("music_sanctum_menu.ogg", compose_sanctum_menu, "3.7"),
        ("music_canyon_river.ogg", compose_canyon_river, "3.7"),
        ("music_alpine_lake.ogg", compose_alpine_lake, "3.7"),
        ("music_mist_bayou.ogg", compose_mist_bayou, "3.7"),
        ("music_coral_sea.ogg", compose_coral_sea, "3.7"),
        ("music_storm_ocean.ogg", compose_storm_ocean, "3.7"),
        ("amb_river_rapids.ogg", build_amb_river_rapids, "3.3"),
        ("amb_alpine_lap.ogg", build_amb_alpine_lap, "3.3"),
        ("amb_bayou_night.ogg", build_amb_bayou_night, "3.3"),
        ("amb_coral_surf.ogg", build_amb_coral_surf, "3.3"),
        ("amb_ocean_swell.ogg", build_amb_ocean_swell, "3.3"),
    ]

    report: List[Dict[str, object]] = []
    total_bytes = 0

    with tempfile.TemporaryDirectory() as tmp_dir:
        tmp_root = Path(tmp_dir)
        for filename, builder, q_val in jobs:
            print(f"[audio_studio] Synthesizing & mastering {filename} ...", flush=True)
            stereo = builder()
            metrics = inspect_spectrum_and_seam(stereo)
            if metrics["above_6khz_rel_db"] > -35.0:
                raise RuntimeError(f"Harsh HF check failed on {filename}: {metrics}")

            wav_path = tmp_root / (filename + ".wav")
            ogg_path = OUT_DIR / filename
            write_wav_16bit_tpdf(wav_path, stereo, dither_rng)
            size_b = encode_and_verify_ogg(ffmpeg_path, ffprobe_path, wav_path, ogg_path, q_level=q_val)
            total_bytes += size_b

            entry = {
                "file": filename,
                "size_kb": round(size_b / 1024.0, 1),
                **metrics,
            }
            report.append(entry)
            print(
                f"  -> OK {filename}: {entry['size_kb']} KB | {entry['duration_s']}s | "
                f"RMS {entry['rms_db']} dB | >6kHz {entry['above_6khz_rel_db']} dB | seam {entry['loop_seam_delta']}",
                flush=True,
            )

    total_mb = total_bytes / (1024.0 * 1024.0)
    print(f"\n[audio_studio] Total assets/audio/ payload: {total_mb:.2f} MB ({total_bytes:,} bytes)", flush=True)
    if total_mb >= 9.8:
        raise RuntimeError(f"Audio payload exceeded 9.8 MB budget ({total_mb:.2f} MB)!")

    summary_json = json.dumps({"total_mb": round(total_mb, 3), "tracks": report}, indent=2)
    print(summary_json, flush=True)


if __name__ == "__main__":
    main()
