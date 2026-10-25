import { useLayoutEffect, useRef, type KeyboardEvent, type ReactNode } from 'react';
import clsx from 'clsx';
import gsap from 'gsap';
import { dur } from '../../lib/ui/motion';

/** Indicador deslizante: curto e decidido. */
const SLIDE = { duration: 0.35, ease: 'power3.out' } as const;

export interface TabItem<T extends string | number> {
  value: T;
  label: ReactNode;
  disabled?: boolean;
}

interface Props<T extends string | number> {
  items: TabItem<T>[];
  value: T;
  onChange: (value: T) => void;
  label: string;
  variant?: 'pill' | 'line';
  className?: string;
  /** id base para ligar tabs aos painéis (aria-controls) */
  idBase?: string;
}

export function Tabs<T extends string | number>({
  items,
  value,
  onChange,
  label,
  variant = 'pill',
  className,
  idBase,
}: Props<T>) {
  const listRef = useRef<HTMLDivElement>(null);
  const indRef = useRef<HTMLSpanElement>(null);
  const placed = useRef(false);

  useLayoutEffect(() => {
    const list = listRef.current;
    const ind = indRef.current;
    if (!list || !ind) return;
    const place = (animate: boolean) => {
      const active = list.querySelector<HTMLButtonElement>('[aria-selected="true"]');
      if (!active) {
        gsap.set(ind, { opacity: 0 });
        return;
      }
      const vars = { x: active.offsetLeft, width: active.offsetWidth, opacity: 1 };
      if (animate && placed.current) {
        gsap.to(ind, { ...vars, duration: dur(SLIDE.duration), ease: SLIDE.ease, overwrite: true });
      } else {
        gsap.set(ind, vars);
      }
      placed.current = true;
    };
    place(true);
    const ro = new ResizeObserver(() => place(false));
    ro.observe(list);
    return () => ro.disconnect();
  }, [value, items.length]);

  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const enabled = items.filter((i) => !i.disabled);
    if (!enabled.length) return;
    const idx = enabled.findIndex((i) => i.value === value);
    let next: TabItem<T> | undefined;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = enabled[(idx + 1) % enabled.length];
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') next = enabled[(idx - 1 + enabled.length) % enabled.length];
    else if (e.key === 'Home') next = enabled[0];
    else if (e.key === 'End') next = enabled[enabled.length - 1];
    if (!next) return;
    e.preventDefault();
    if (next.value !== value) onChange(next.value);
    requestAnimationFrame(() =>
      listRef.current?.querySelector<HTMLButtonElement>('[aria-selected="true"]')?.focus(),
    );
  };

  return (
    <div
      ref={listRef}
      role="tablist"
      aria-label={label}
      aria-orientation="horizontal"
      onKeyDown={onKey}
      className={clsx(variant === 'pill' ? 'tabs' : 'tabs-line', className)}
    >
      <span ref={indRef} className="tabs-indicator" aria-hidden style={{ opacity: 0 }} />
      {items.map((item) => {
        const selected = item.value === value;
        return (
          <button
            key={String(item.value)}
            type="button"
            role="tab"
            id={idBase ? `${idBase}-tab-${item.value}` : undefined}
            aria-controls={idBase ? `${idBase}-panel` : undefined}
            aria-selected={selected}
            tabIndex={selected ? 0 : -1}
            disabled={item.disabled}
            className="tab"
            onClick={() => onChange(item.value)}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
