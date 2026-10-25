import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import clsx from 'clsx';
import gsap from 'gsap';
import { DUR, EASE, dur } from '../../lib/ui/motion';
import { Icon } from './Icon';

interface Props {
  open: boolean;
  /** desktop: painel lateral dentro do mapa · mobile: bottom sheet */
  mode: 'side' | 'sheet';
  onClose: () => void;
  header: ReactNode;
  children: ReactNode;
  /** muda quando o conteúdo troca (rola para o topo, anima conteúdo) */
  contentKey?: string;
  label: string;
}

/**
 * Painel de detalhes. Fica montado enquanto anima a saída. No mobile vira
 * um bottom sheet com dois tamanhos (espiar / expandido).
 */
export function Panel({ open, mode, onClose, header, children, contentKey, label }: Props) {
  const ref = useRef<HTMLElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(open);
  const [expanded, setExpanded] = useState(false);

  if (open && !mounted) setMounted(true);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const hidden = mode === 'side' ? { x: 28, opacity: 0 } : { yPercent: 100, opacity: 1 };
    const shown = mode === 'side' ? { x: 0, opacity: 1 } : { yPercent: 0, opacity: 1 };
    if (open) {
      gsap.fromTo(el, hidden, { ...shown, duration: dur(DUR.slow + 0.1), ease: EASE.out, overwrite: true });
    } else {
      gsap.to(el, {
        ...hidden,
        duration: dur(DUR.base + 0.08),
        ease: 'power2.in',
        overwrite: true,
        onComplete: () => setMounted(false),
      });
    }
  }, [open, mode, mounted]);

  useEffect(() => {
    const body = bodyRef.current;
    if (!body || !open) return;
    body.scrollTop = 0;
    gsap.fromTo(body, { opacity: 0, y: 6 }, { opacity: 1, y: 0, duration: dur(DUR.slow), ease: EASE.out });
  }, [contentKey, open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!mounted) return null;

  return (
    <aside
      ref={ref}
      aria-label={label}
      className={clsx(
        'flex flex-col bg-raised',
        mode === 'side'
          ? 'absolute inset-y-3 right-3 z-20 w-(--spacing-panel) rounded-xl shadow-lg'
          : clsx(
              'fixed inset-x-0 bottom-0 z-40 rounded-t-xl shadow-lg transition-[height] duration-500 ease-out',
              'pb-[env(safe-area-inset-bottom)]',
              expanded ? 'h-[86dvh]' : 'h-[46dvh]',
            ),
      )}
    >
      {mode === 'sheet' && (
        <button
          type="button"
          className="mx-auto flex h-6 w-full shrink-0 items-center justify-center"
          onClick={() => setExpanded((v) => !v)}
          aria-label={expanded ? 'Recolher painel' : 'Expandir painel'}
        >
          <span className="h-1 w-10 rounded-full bg-line-strong" />
        </button>
      )}
      <div className={clsx('flex shrink-0 items-start gap-3 px-5', mode === 'side' ? 'pt-5' : 'pt-1')}>
        <div className="min-w-0 flex-1">{header}</div>
        <div className="flex shrink-0 items-center gap-1">
          {mode === 'sheet' && (
            <button
              type="button"
              className="btn btn-ghost btn-icon btn-sm"
              onClick={() => setExpanded((v) => !v)}
              aria-label={expanded ? 'Recolher painel' : 'Expandir painel'}
            >
              <Icon name={expanded ? 'collapse' : 'expand'} />
            </button>
          )}
          <button type="button" className="btn btn-ghost btn-icon btn-sm" onClick={onClose} aria-label="Fechar painel">
            <Icon name="close" />
          </button>
        </div>
      </div>
      <div ref={bodyRef} className="scroll-y min-h-0 flex-1 px-5 pb-5">
        {children}
      </div>
    </aside>
  );
}
