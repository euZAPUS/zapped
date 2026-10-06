import { settings } from '../settings/store';
import { h } from '../ui/dom';
import { reducedMotion } from '../ui/motion';
import type { TextView } from './text-view';

const MAX_SPARKS = 36;
const GLOW_START = 8; // consecutive hits before the aura wakes up
const GLOW_FULL = 70; // …and before it reaches full size

/** Keystroke feedback: letter pop, sparks and the streak aura. */
export class Effects {
  private streak = 0;
  private lastGlow = -1;
  private liveSparks = 0;

  constructor(private readonly view: TextView, private readonly glowEl: HTMLElement) {}

  hit(wordIndex: number, charIndex: number): void {
    const s = settings.get();
    this.streak++;
    const letter = this.view.letter(wordIndex, charIndex);

    if (s.pop && letter && !reducedMotion()) {
      letter.classList.remove('pop');
      void letter.offsetWidth; // restart the animation
      letter.classList.add('pop');
    }
    if (s.sparks && !reducedMotion()) this.spawnSparks();
    this.updateGlow();
  }

  miss(): void {
    this.streak = 0;
    if (this.lastGlow > 0) {
      this.glowEl.classList.add('broken');
      this.setGlow(0);
      window.setTimeout(() => this.glowEl.classList.remove('broken'), 350);
    }
  }

  /** Back to calm at the start/end of a test. */
  reset(): void {
    this.streak = 0;
    this.setGlow(0);
  }

  private updateGlow(): void {
    const s = settings.get();
    if (!s.glow) {
      this.setGlow(0);
      return;
    }
    const level = this.streak < GLOW_START ? 0 : Math.min(1, (this.streak - GLOW_START) / (GLOW_FULL - GLOW_START));
    this.setGlow(level);
  }

  private setGlow(level: number): void {
    const rounded = Math.round(level * 50) / 50;
    if (rounded === this.lastGlow) return;
    this.lastGlow = rounded;
    this.glowEl.style.setProperty('--glow', String(rounded));
  }

  private spawnSparks(): void {
    if (this.liveSparks > MAX_SPARKS) return;
    const { x, y } = this.view.caretCenter();
    const count = 4;
    for (let i = 0; i < count; i++) {
      const spark = h('i', { class: i % 2 ? 'spark alt' : 'spark' });
      spark.style.left = `${x}px`;
      spark.style.top = `${y}px`;
      this.view.fx.appendChild(spark);
      this.liveSparks++;
      const angle = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 1.1;
      const dist = 18 + Math.random() * 30;
      const anim = spark.animate(
        [
          { transform: 'translate(-50%, -50%) scale(1)', opacity: 1 },
          {
            transform: `translate(calc(-50% + ${Math.cos(angle) * dist}px), calc(-50% + ${Math.sin(angle) * dist}px)) scale(0.1)`,
            opacity: 0,
          },
        ],
        { duration: 380 + Math.random() * 260, easing: 'cubic-bezier(.2,.7,.3,1)' },
      );
      anim.onfinish = () => {
        spark.remove();
        this.liveSparks--;
      };
    }
  }
}
