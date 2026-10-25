import { useEffect, useId, useMemo, useRef, useState } from 'react';
import clsx from 'clsx';
import type { MunicipalityRef } from '../lib/tse/types';
import { titleCase } from '../lib/ui/format';
import { Icon } from './ui/Icon';

interface Props {
  items: MunicipalityRef[];
  onPick: (m: MunicipalityRef) => void;
  className?: string;
  autoFocus?: boolean;
  onDone?: () => void;
}

const norm = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();

export function MunicipalitySearch({ items, onPick, className, autoFocus, onDone }: Props) {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = useId();

  const indexed = useMemo(() => items.map((m) => ({ m, key: norm(m.name) })), [items]);

  const results = useMemo(() => {
    const term = norm(q.trim());
    if (term.length < 2) return [];
    const starts: MunicipalityRef[] = [];
    const contains: MunicipalityRef[] = [];
    for (const { m, key } of indexed) {
      if (key.startsWith(term)) starts.push(m);
      else if (key.includes(term)) contains.push(m);
      if (starts.length >= 8) break;
    }
    return [...starts.sort((a, b) => Number(b.capital) - Number(a.capital)), ...contains].slice(0, 8);
  }, [q, indexed]);

  useEffect(() => {
    if (autoFocus) inputRef.current?.focus();
  }, [autoFocus]);

  /* atalho "/" para buscar */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (e.key === '/' && tag !== 'INPUT' && tag !== 'TEXTAREA') {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const pick = (m: MunicipalityRef) => {
    onPick(m);
    setQ('');
    setOpen(false);
    inputRef.current?.blur();
    onDone?.();
  };

  const showList = open && q.trim().length >= 2;

  return (
    <div className={clsx('relative', className)}>
      <label className="sr-only" htmlFor={`${listId}-input`}>
        Buscar município
      </label>
      <Icon name="search" size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-3" />
      <input
        ref={inputRef}
        id={`${listId}-input`}
        type="search"
        role="combobox"
        aria-expanded={showList}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={showList && results[active] ? `${listId}-${active}` : undefined}
        autoComplete="off"
        placeholder={items.length ? 'Buscar município' : 'Carregando municípios…'}
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setActive(0);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => window.setTimeout(() => setOpen(false), 120)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            setActive((a) => Math.min(results.length - 1, a + 1));
          } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setActive((a) => Math.max(0, a - 1));
          } else if (e.key === 'Enter' && results[active]) {
            e.preventDefault();
            pick(results[active]);
          } else if (e.key === 'Escape') {
            setQ('');
            inputRef.current?.blur();
            onDone?.();
          }
        }}
        className="field pl-9 pr-9"
      />
      <span className="kbd pointer-events-none absolute right-2.5 top-1/2 hidden -translate-y-1/2 lg:inline-grid" aria-hidden>
        /
      </span>
      {showList && (
        <ul
          id={listId}
          role="listbox"
          className="tooltip pointer-events-auto absolute inset-x-0 top-full z-50 mt-2 max-h-80 overflow-auto p-1.5"
        >
          {results.length === 0 && <li className="px-3 py-2.5 text-small text-ink-3">Nenhum município com esse nome</li>}
          {results.map((m, i) => (
            <li key={`${m.uf}-${m.tseCode}`} id={`${listId}-${i}`} role="option" aria-selected={i === active}>
              <button
                type="button"
                tabIndex={-1}
                className={clsx(
                  'flex w-full items-center justify-between gap-3 rounded-sm px-3 py-2 text-left text-small transition-colors',
                  i === active ? 'bg-hover text-ink' : 'text-ink-2',
                )}
                onMouseEnter={() => setActive(i)}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pick(m)}
              >
                <span className="truncate">
                  {titleCase(m.name)}
                  {m.capital && <span className="ml-2 text-caption text-ink-3">capital</span>}
                </span>
                <span className="font-mono text-micro text-ink-3">{m.uf}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
