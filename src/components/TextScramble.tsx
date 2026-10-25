import { useEffect, useRef } from 'react';
import { prefersReducedMotion } from '../lib/ui/motion';

const GLYPHS = '░▒▓/\\|_-+=<>01';

interface Props {
  text: string;
  className?: string;
}

/**
 * Embaralha os caracteres por um instante sempre que o texto muda.
 * Usado com parcimônia: só em rótulos mono pequenos.
 */
export function TextScramble({ text, className }: Props) {
  const ref = useRef<HTMLSpanElement>(null);
  const first = useRef(true);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (prefersReducedMotion()) {
      el.textContent = text;
      return;
    }
    const delay = first.current ? 250 : 0;
    first.current = false;
    let frame = 0;
    const total = 18;
    let raf = 0;
    let last = 0;
    const tick = (t: number) => {
      if (t - last < 34) {
        raf = requestAnimationFrame(tick);
        return;
      }
      last = t;
      frame += 1;
      const revealed = Math.floor((frame / total) * text.length);
      let out = '';
      for (let i = 0; i < text.length; i++) {
        const ch = text[i];
        out += ch === ' ' || i < revealed ? ch : GLYPHS[(Math.random() * GLYPHS.length) | 0];
      }
      el.textContent = out;
      if (frame < total) raf = requestAnimationFrame(tick);
      else el.textContent = text;
    };
    const timer = window.setTimeout(() => {
      raf = requestAnimationFrame(tick);
    }, delay);
    return () => {
      window.clearTimeout(timer);
      cancelAnimationFrame(raf);
      el.textContent = text;
    };
  }, [text]);

  return (
    <span ref={ref} className={className} aria-label={text}>
      {text}
    </span>
  );
}
