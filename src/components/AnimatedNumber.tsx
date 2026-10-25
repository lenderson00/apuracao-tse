import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { dur } from '../lib/ui/motion';

interface Props {
  value: number;
  format?: (n: number) => string;
  className?: string;
  /** valor inicial da contagem na primeira renderização */
  from?: number;
  duration?: number;
}

/** Número que conta suavemente até o novo valor quando os dados mudam. */
export function AnimatedNumber({ value, format, className, from, duration = 0.9 }: Props) {
  const ref = useRef<HTMLSpanElement>(null);
  const current = useRef(from ?? value);
  const fmt = format ?? ((n: number) => String(Math.round(n)));

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obj = { v: current.current };
    const tween = gsap.to(obj, {
      v: value,
      duration: dur(duration),
      ease: 'power3.out',
      onUpdate: () => {
        current.current = obj.v;
        el.textContent = fmt(obj.v);
      },
      onComplete: () => {
        current.current = value;
        el.textContent = fmt(value);
      },
    });
    return () => {
      tween.kill();
    };
    // fmt é estável o bastante; mudar só o formato não deve reiniciar a contagem
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, duration]);

  return (
    <span ref={ref} className={className}>
      {fmt(current.current)}
    </span>
  );
}
