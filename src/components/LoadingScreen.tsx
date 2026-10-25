import { useEffect, useRef } from 'react';
import gsap from 'gsap';

export function LoadingScreen({ visible }: { visible: boolean }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    if (visible) {
      gsap.to(ref.current, { opacity: 1, duration: 0.3 });
    } else {
      gsap.to(ref.current, { opacity: 0, duration: 0.5, pointerEvents: 'none' });
    }
  }, [visible]);

  if (!visible) return null;

  return (
    <div
      ref={ref}
      className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-6 bg-[var(--color-surface)]"
    >
      <div className="relative h-14 w-14">
        <div className="absolute inset-0 rounded-full border-2 border-[var(--color-border)]" />
        <div className="absolute inset-0 animate-spin rounded-full border-2 border-transparent border-t-[var(--color-accent)]" />
      </div>
      <p className="text-sm text-[var(--color-muted)]">Carregando a apuração…</p>
    </div>
  );
}
