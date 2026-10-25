import { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { TextScramble } from './TextScramble';

export function LoadingScreen({ visible }: { visible: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const progressRef = useRef({ v: 0 });
  const [mounted, setMounted] = useState(visible);

  useEffect(() => {
    if (visible) setMounted(true);
  }, [visible]);

  useEffect(() => {
    if (!ref.current || !mounted) return;
    if (visible) {
      ref.current.style.visibility = 'visible';
      gsap.to(ref.current, { opacity: 1, duration: 0.35, pointerEvents: 'auto' });
      progressRef.current.v = 0;
      if (barRef.current) {
        gsap.to(progressRef.current, {
          v: 88,
          duration: 2.2,
          ease: 'power1.inOut',
          onUpdate: () => {
            if (barRef.current) barRef.current.style.width = `${progressRef.current.v}%`;
          },
        });
      }
    } else {
      if (barRef.current) {
        gsap.to(progressRef.current, {
          v: 100,
          duration: 0.35,
          onUpdate: () => {
            if (barRef.current) barRef.current.style.width = `${progressRef.current.v}%`;
          },
        });
      }
      gsap.to(ref.current, {
        opacity: 0,
        duration: 0.55,
        delay: 0.1,
        pointerEvents: 'none',
        onComplete: () => setMounted(false),
      });
    }
  }, [visible, mounted]);

  if (!mounted) return null;

  return (
    <div
      ref={ref}
      className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-8 bg-[var(--color-surface)]"
      aria-busy={visible}
      aria-label="Carregando apuração"
    >
      <div className="pointer-events-none absolute inset-0 opacity-40 grid-lines" aria-hidden />
      <div className="flex flex-col items-center gap-6 px-6 text-center">
        <div className="label-mono label-accent flex items-center gap-2">
          <span className="live-dot" aria-hidden />
          TSE · resultados oficiais
        </div>
        <p className="max-w-sm font-mono text-sm text-[var(--color-ink-secondary)]">
          <TextScramble text="sincronizando_apuracao.json" playOnMount={visible} />
        </p>
        <div className="w-56">
          <div className="h-px overflow-hidden rounded-full bg-[var(--color-border)]">
            <div ref={barRef} className="h-full bg-[var(--color-accent)]" style={{ width: '0%' }} />
          </div>
        </div>
        <p className="text-sm text-[var(--color-muted)]">Preparando mapa e painéis…</p>
      </div>
    </div>
  );
}
