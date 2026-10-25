import { useState } from 'react';
import type { MunicipalityRef } from '../lib/tse/types';
import { MunicipalitySearch } from './MunicipalitySearch';
import { ThemeToggle } from './ThemeToggle';
import { Button } from './ui/Button';
import { Icon } from './ui/Icon';

interface Props {
  munIndex: MunicipalityRef[];
  onPick: (m: MunicipalityRef) => void;
  onHome: () => void;
}

export function TopBar({ munIndex, onPick, onHome }: Props) {
  const [searching, setSearching] = useState(false);

  return (
    <div className="sticky top-0 z-50 px-3 pt-3 sm:px-4">
      <nav
        className="mx-auto flex h-14 max-w-[1240px] items-center gap-3 rounded-xl bg-(--glass) pl-3 pr-2 shadow-md backdrop-blur-xl backdrop-saturate-150 sm:pl-4"
        aria-label="Principal"
      >
        {searching ? (
          <>
            <MunicipalitySearch
              items={munIndex}
              onPick={onPick}
              className="flex-1"
              autoFocus
              onDone={() => setSearching(false)}
            />
            <Button variant="ghost" size="sm" onClick={() => setSearching(false)}>
              Cancelar
            </Button>
          </>
        ) : (
          <>
            <button type="button" onClick={onHome} className="flex items-center gap-2.5 rounded-sm text-left" aria-label="Início: Brasil">
              <Mark />
              <span className="flex flex-col leading-none">
                <span className="text-small font-semibold tracking-[-0.01em] text-ink">Apuração 2026</span>
                <span className="mt-1 font-mono text-[0.625rem] text-ink-3">eleições gerais · dados do TSE</span>
              </span>
            </button>
            <div className="ml-auto flex items-center gap-1">
              <MunicipalitySearch items={munIndex} onPick={onPick} className="hidden w-72 md:block" />
              <Button
                variant="ghost"
                icon
                className="md:hidden"
                aria-label="Buscar município"
                onClick={() => setSearching(true)}
              >
                <Icon name="search" size={17} />
              </Button>
              <ThemeToggle />
            </div>
          </>
        )}
      </nav>
    </div>
  );
}

function Mark() {
  return (
    <span className="grid size-8 place-items-center rounded-sm bg-inverse text-inverse-ink" aria-hidden>
      <svg width="16" height="16" viewBox="0 0 16 16">
        <rect x="2" y="7" width="3" height="7" rx="0.75" fill="currentColor" />
        <rect x="6.5" y="2" width="3" height="12" rx="0.75" fill="currentColor" />
        <rect x="11" y="5" width="3" height="9" rx="0.75" fill="var(--accent)" />
      </svg>
    </span>
  );
}
