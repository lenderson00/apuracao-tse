import { useEffect, useId, useMemo, useRef, useState } from 'react';
import clsx from 'clsx';
import type { MunicipalityRef } from '../lib/tse/types';
import { titleCase } from '../lib/ui/format';
import { CandidateAvatar } from './CandidateAvatar';
import type { CandidatePick } from './CandidateMode';
import { Icon } from './ui/Icon';

interface Props {
  candidates?: CandidatePick[];
  onCandidate?: (c: CandidatePick) => void;
  items: MunicipalityRef[];
  onPick: (m: MunicipalityRef) => void;
  className?: string;
  autoFocus?: boolean;
  onDone?: () => void;
}

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export function MunicipalitySearch({ items, onPick, className, autoFocus, onDone, candidates = [], onCandidate }: Props) {
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

  const candidateResults = candidates
    .filter(({ candidate: c }) => norm(`${c.name} ${c.shortName}`).includes(norm(q.trim())) || c.number.startsWith(q.trim()))
    .slice(0, 8);
  const chooseCandidate = (c: CandidatePick) => {
    onCandidate?.(c);
    setQ('');
    setOpen(false);
    onDone?.();
  };
  const showList = open && q.trim().length >= 2;

  return (
    <div className={clsx('relative', className)}>
      <label className="sr-only" htmlFor={`${listId}-input`}>
        Buscar candidato ou município
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
        aria-activedescendant={
          showList && (candidateResults[active] || results[active - candidateResults.length]) ? `${listId}-${active}` : undefined
        }
        autoComplete="off"
        placeholder={items.length ? 'Buscar candidato ou município' : 'Carregando municípios…'}
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
            setActive((a) => Math.min(results.length + candidateResults.length - 1, a + 1));
          } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setActive((a) => Math.max(0, a - 1));
          } else if (e.key === 'Enter' && (candidateResults[active] || results[active - candidateResults.length])) {
            e.preventDefault();
            if (active < candidateResults.length) chooseCandidate(candidateResults[active]);
            else if (results[active - candidateResults.length]) pick(results[active - candidateResults.length]);
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
          className="tooltip pointer-events-auto fixed inset-x-2 top-[4.25rem] z-50 max-h-[60dvh] overflow-auto p-1.5 lg:absolute lg:inset-x-auto lg:right-0 lg:top-full lg:mt-2 lg:w-[340px]"
        >
          {candidateResults.length > 0 && <li className="eyebrow px-3 py-2">Candidatos</li>}
          {candidateResults.map((p, i) => (
            <li key={`${p.uf}-${p.candidate.sqcand}`} id={`${listId}-${i}`} role="option" aria-selected={active === i}>
              <button
                className={clsx('flex w-full items-center gap-3 rounded-sm p-2 text-left text-small', active === i && 'bg-hover')}
                onMouseDown={(e) => e.preventDefault()}
                onMouseEnter={() => setActive(i)}
                onClick={() => chooseCandidate(p)}
              >
                <CandidateAvatar candidate={p.candidate} electionId={p.electionId} photoUf={p.uf} size={26} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate">{titleCase(p.candidate.shortName)}</span>
                  <span className="text-nano text-ink-3">
                    {p.candidate.number} · {p.candidate.party} · {p.uf.toUpperCase()}
                  </span>
                </span>
                <span className="text-caption">{p.candidate.percent.toLocaleString('pt-BR')}%</span>
              </button>
            </li>
          ))}
          {results.length > 0 && <li className="eyebrow px-3 py-2">Municípios</li>}
          {results.length === 0 && candidateResults.length === 0 && (
            <li className="px-3 py-2.5 text-small text-ink-3">Nenhum candidato ou município encontrado</li>
          )}
          {results.map((m, i) => (
            <li
              key={`${m.uf}-${m.tseCode}`}
              id={`${listId}-${i + candidateResults.length}`}
              role="option"
              aria-selected={i + candidateResults.length === active}
            >
              <button
                type="button"
                tabIndex={-1}
                className={clsx(
                  'flex w-full items-center justify-between gap-3 rounded-sm px-3 py-2 text-left text-small transition-colors',
                  i + candidateResults.length === active ? 'bg-hover text-ink' : 'text-ink-2',
                )}
                onMouseEnter={() => setActive(i + candidateResults.length)}
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
