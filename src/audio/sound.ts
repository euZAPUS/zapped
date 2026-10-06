import { settings } from '../settings/store';
import type { SoundId } from '../settings/schema';

type Ctx = AudioContext;

/** Key sounds synthesised with Web Audio: no audio files, nothing to download. */
class SoundEngine {
  private ctx: Ctx | null = null;
  private master: GainNode | null = null;
  private noise: AudioBuffer | null = null;

  private ensure(): Ctx | null {
    if (!this.ctx) {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return null;
      this.ctx = new Ctor({ latencyHint: 'interactive' });
      this.master = this.ctx.createGain();
      this.master.connect(this.ctx.destination);
      const length = Math.floor(this.ctx.sampleRate * 0.25);
      this.noise = this.ctx.createBuffer(1, length, this.ctx.sampleRate);
      const data = this.noise.getChannelData(0);
      for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
    if (this.master) this.master.gain.value = settings.get().volume ** 2 * 0.9;
    return this.ctx;
  }

  /** A key was typed correctly. */
  key(kind: SoundId = settings.get().sound): void {
    if (kind === 'off') return;
    const ctx = this.ensure();
    if (!ctx) return;
    const t = ctx.currentTime;
    const r = 0.92 + Math.random() * 0.16;
    switch (kind) {
      case 'click':
        this.burst(ctx, t, 'bandpass', 3200 * r, 1.4, 0.03, 0.55);
        this.tone(ctx, t, 'sine', 190 * r, 95 * r, 0.045, 0.28);
        break;
      case 'pop':
        this.tone(ctx, t, 'sine', 560 * r, 170 * r, 0.1, 0.7);
        break;
      case 'typewriter':
        this.burst(ctx, t, 'bandpass', 1700 * r, 0.7, 0.05, 0.75);
        this.burst(ctx, t, 'highpass', 5200, 0.7, 0.012, 0.35);
        this.tone(ctx, t, 'triangle', 150 * r, 62, 0.07, 0.5);
        break;
      case 'bubble': {
        const f0 = (280 + Math.random() * 220) * r;
        this.tone(ctx, t, 'sine', f0, f0 * 2.5, 0.075, 0.55);
        this.tone(ctx, t, 'sine', f0 * 2, f0 * 4.6, 0.05, 0.12);
        break;
      }
    }
  }

  /** Space or Enter: a lower, heavier thud so word boundaries are audible. */
  separator(): void {
    const kind = settings.get().sound;
    if (kind === 'off') return;
    const ctx = this.ensure();
    if (!ctx) return;
    const t = ctx.currentTime;
    this.tone(ctx, t, 'sine', 120, 55, 0.08, kind === 'pop' || kind === 'bubble' ? 0.45 : 0.6);
    if (kind === 'typewriter') this.burst(ctx, t, 'bandpass', 900, 0.6, 0.06, 0.6);
  }

  error(): void {
    const s = settings.get();
    if (s.sound === 'off' || !s.errorSound) return;
    const ctx = this.ensure();
    if (!ctx) return;
    const t = ctx.currentTime;
    this.tone(ctx, t, 'triangle', 190, 85, 0.14, 0.4);
    this.tone(ctx, t, 'square', 96, 90, 0.1, 0.07);
  }

  /** Soft arpeggio when a test ends. */
  finish(): void {
    if (settings.get().sound === 'off') return;
    const ctx = this.ensure();
    if (!ctx) return;
    const t = ctx.currentTime;
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => this.tone(ctx, t + i * 0.085, 'sine', f, f, 0.45, 0.35));
  }

  private envelope(ctx: Ctx, t: number, peak: number, dur: number): GainNode {
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(peak, t + 0.003);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    g.connect(this.master as GainNode);
    return g;
  }

  private tone(ctx: Ctx, t: number, type: OscillatorType, f0: number, f1: number, dur: number, peak: number): void {
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) osc.frequency.exponentialRampToValueAtTime(Math.max(f1, 20), t + dur);
    osc.connect(this.envelope(ctx, t, peak, dur));
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  private burst(ctx: Ctx, t: number, type: BiquadFilterType, freq: number, q: number, dur: number, peak: number): void {
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const filter = ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.value = freq;
    filter.Q.value = q;
    src.connect(filter);
    filter.connect(this.envelope(ctx, t, peak, dur));
    src.start(t, Math.random() * 0.15);
    src.stop(t + dur + 0.02);
  }
}

export const sound = new SoundEngine();
