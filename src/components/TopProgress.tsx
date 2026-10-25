import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { dur } from '../lib/ui/motion';

/** Linha fina no topo enquanto há dados chegando. */
export function TopProgress({ active }: { active: boolean }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (active) {
      gsap.set(el, { opacity: 1 });
      gsap.fromTo(el, { scaleX: 0.04 }, { scaleX: 0.85, duration: dur(6), ease: 'power2.out', overwrite: true });
    } else {
      gsap
        .timeline()
        .to(el, { scaleX: 1, duration: dur(0.3), ease: 'power2.out', overwrite: true })
        .to(el, { opacity: 0, duration: dur(0.4) });
    }
  }, [active]);

  return (
    <div
      ref={ref}
      className="pointer-events-none fixed inset-x-0 top-0 z-[60] h-0.5 origin-left bg-accent"
      style={{ transform: 'scaleX(0)', opacity: 0 }}
      aria-hidden
    />
  );
}
