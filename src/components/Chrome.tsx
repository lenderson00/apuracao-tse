import { useEffect, useRef, useState, type ReactNode } from 'react';
import clsx from 'clsx';
import { Icon } from './ui/Icon';

export const TSE_URL = 'https://resultados.tse.jus.br';

/* ------------------------------------------------------------------ marca */

export function Mark({ size = 28 }: { size?: number }) {
  return (
    <span
      className="grid shrink-0 place-items-center rounded-[9px] bg-overlay shadow-[inset_0_0_0_1px_var(--line-strong)]"
      style={{ width: size, height: size }}
      aria-hidden
    >
      <svg width={size * 0.55} height={size * 0.55} viewBox="0 0 16 16">
        <rect x="2" y="7" width="3" height="7" rx="0.75" fill="var(--text)" />
        <rect x="6.5" y="2" width="3" height="12" rx="0.75" fill="var(--text)" />
        <rect x="11" y="5" width="3" height="9" rx="0.75" fill="var(--accent)" />
      </svg>
    </span>
  );
}

/** Marca + aviso de independência (sempre visível no topo). */
export function Brand({ compact, onAbout }: { compact?: boolean; onAbout?: () => void }) {
  if (compact) {
    // mobile: o bloco todo abre o "Sobre" (com o link para o TSE) e é um alvo de toque grande
    return (
      <button type="button" onClick={onAbout} className="flex h-14 min-w-0 items-center gap-2.5 text-left" aria-label="Sobre este site e fonte dos dados">
        <Mark size={30} />
        <span className="min-w-0 leading-none">
          <span className="block truncate text-small font-semibold tracking-[-0.01em] text-ink">Apuração 2026</span>
          <span className="mt-1 block truncate text-[0.6875rem] text-ink-3">
            <span className="text-ink-2">Dados públicos do TSE</span> · sem vínculo com o TSE
          </span>
        </span>
      </button>
    );
  }
  return (
    <div className="flex min-w-0 items-center gap-2.5">
      <Mark size={compact ? 30 : 28} />
      <div className="min-w-0 leading-none">
        <p className="truncate text-small font-semibold tracking-[-0.01em] text-ink">
          Apuração 2026
          <span className="font-normal text-ink-3"> · </span>
          <a
            href={TSE_URL}
            target="_blank"
            rel="noreferrer"
            className="font-normal text-ink-2 underline decoration-line-loud underline-offset-2 hover:text-ink hover:decoration-ink-3"
          >
            Dados públicos do TSE
          </a>
        </p>
        <p className="mt-1 truncate font-mono text-nano text-ink-3">
          Site independente, sem vínculo com o TSE
        </p>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------- breadcrumb */

export interface Crumb {
  label: string;
  onClick?: () => void;
}

export function Breadcrumb({ items, className }: { items: Crumb[]; className?: string }) {
  return (
    <nav aria-label="Você está em" className={clsx('float flex h-9 items-center gap-0.5 rounded-pill px-1 pointer-coarse:h-11 pointer-coarse:px-0', className)}>
      {items.map((c, i) => {
        const last = i === items.length - 1;
        return (
          <span key={i} className="flex min-w-0 items-center gap-0.5">
            {i > 0 && <Icon name="chevron-right" size={12} className="shrink-0 text-ink-4" />}
            <button
              type="button"
              onClick={c.onClick}
              disabled={last}
              aria-current={last ? 'location' : undefined}
              className={clsx(
                'max-w-44 truncate rounded-pill px-2.5 py-1 text-caption font-medium transition-colors pointer-coarse:flex pointer-coarse:h-11 pointer-coarse:items-center pointer-coarse:px-3 pointer-coarse:text-small',
                last ? 'text-ink' : 'text-ink-3 hover:bg-hover hover:text-ink',
              )}
            >
              {c.label}
            </button>
          </span>
        );
      })}
    </nav>
  );
}

/* ---------------------------------------------------------------- zoom */

export function ZoomControls({
  onIn,
  onOut,
  onRecenter,
  className,
}: {
  onIn: () => void;
  onOut: () => void;
  onRecenter: () => void;
  className?: string;
}) {
  return (
    <div className={clsx('float flex flex-col gap-px rounded-xl p-1', className)} role="group" aria-label="Zoom do mapa">
      <button type="button" className="btn btn-icon" onClick={onIn} aria-label="Aproximar" title="Aproximar (+)">
        <Icon name="plus" size={15} />
      </button>
      <button type="button" className="btn btn-icon" onClick={onOut} aria-label="Afastar" title="Afastar (−)">
        <Icon name="minus" size={15} />
      </button>
      <span className="mx-1.5 my-0.5 h-px bg-line" aria-hidden />
      <button type="button" className="btn btn-icon" onClick={onRecenter} aria-label="Recentralizar" title="Recentralizar (0)">
        <Icon name="target" size={15} />
      </button>
    </div>
  );
}

/* --------------------------------------------------------------- popover */

export function Popover({
  open,
  onClose,
  children,
  className,
}: {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    const id = window.setTimeout(() => window.addEventListener('pointerdown', onDown), 0);
    window.addEventListener('keydown', onKey);
    return () => {
      window.clearTimeout(id);
      window.removeEventListener('pointerdown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div ref={ref} role="dialog" className={clsx('tooltip pointer-events-auto absolute z-50 p-4 text-caption text-ink-2', className)}>
      {children}
    </div>
  );
}

export function AboutContent() {
  return (
    <div className="flex flex-col gap-2.5 leading-relaxed">
      <p className="text-small font-medium text-ink">Sobre este site</p>
      <p>
        Projeto independente, sem vínculo com o TSE. Os números vêm dos arquivos públicos de{' '}
        <a href={TSE_URL} target="_blank" rel="noreferrer" className="text-ink underline underline-offset-2">
          resultados.tse.jus.br
        </a>{' '}
        e atualizam a cada minuto.
      </p>
      <p>Para o resultado oficial, consulte o TSE. Antes das 17h de Brasília, todos os candidatos aparecem com 0%.</p>
    </div>
  );
}

export function ShortcutsContent() {
  const rows: Array<[string, string]> = [
    ['Arrastar', 'mover o mapa'],
    ['Roda ou pinça', 'zoom'],
    ['Enter', 'abrir estado ou município'],
    ['Esc', 'voltar um nível'],
    ['+  −', 'zoom'],
    ['0', 'recentralizar'],
    ['/', 'buscar município'],
  ];
  return (
    <div>
      <p className="mb-2.5 text-small font-medium text-ink">Atalhos</p>
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5">
        {rows.map(([k, v]) => (
          <div key={k} className="contents">
            <dt className="font-mono text-nano text-ink">{k}</dt>
            <dd className="text-ink-3">{v}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

/* ------------------------------------------------------------------- rail */

export interface RailAction {
  id: string;
  label: string;
  icon: Parameters<typeof Icon>[0]['name'];
  onClick: () => void;
  active?: boolean;
}

export function Rail({ top, bottom }: { top: RailAction[]; bottom: RailAction[] }) {
  const [tip, setTip] = useState<string | null>(null);
  const btn = (a: RailAction) => (
    <li key={a.id} className="relative">
      <button
        type="button"
        onClick={a.onClick}
        aria-label={a.label}
        aria-pressed={a.active}
        onPointerEnter={() => setTip(a.id)}
        onPointerLeave={() => setTip(null)}
        onFocus={() => setTip(a.id)}
        onBlur={() => setTip(null)}
        className={clsx(
          'grid size-9 place-items-center rounded-[10px] transition-colors duration-150',
          a.active ? 'bg-hover text-ink shadow-[inset_0_0_0_1px_var(--line-strong)]' : 'text-ink-3 hover:bg-hover hover:text-ink',
        )}
      >
        <Icon name={a.icon} size={17} />
      </button>
      {tip === a.id && (
        <span className="tooltip absolute left-full top-1/2 z-50 ml-2.5 -translate-y-1/2 whitespace-nowrap px-2 py-1 text-caption">
          {a.label}
        </span>
      )}
    </li>
  );
  return (
    <aside className="flex w-12 shrink-0 flex-col items-center py-2" aria-label="Atalhos">
      <Mark size={32} />
      <span className="my-3 h-px w-6 bg-line" aria-hidden />
      <ul className="flex flex-col gap-1.5">{top.map(btn)}</ul>
      <ul className="mt-auto flex flex-col gap-1.5">{bottom.map(btn)}</ul>
    </aside>
  );
}
