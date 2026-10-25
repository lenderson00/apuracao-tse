import { useState } from 'react';
import clsx from 'clsx';
import { photoUrl } from '../lib/tse/client';
import type { CandidateRow } from '../lib/tse/types';
import { candFill } from '../lib/ui/color';
import { initials } from '../lib/ui/format';

interface Props {
  candidate: CandidateRow;
  electionId: string;
  photoUf: string;
  size?: number;
  ring?: boolean;
  className?: string;
}

/** Foto oficial do TSE com iniciais por baixo enquanto carrega (ou se faltar). */
export function CandidateAvatar({ candidate, electionId, photoUf, size = 40, ring = true, className }: Props) {
  const [state, setState] = useState<'loading' | 'ok' | 'error'>('loading');
  const src = photoUrl(electionId, photoUf, candidate.sqcand);
  const ringW = size >= 64 ? 2.5 : 2;

  return (
    <span
      className={clsx('relative inline-grid shrink-0 place-items-center rounded-full bg-sunken', className)}
      style={{
        width: size,
        height: size,
        boxShadow: ring
          ? `0 0 0 ${ringW}px var(--surface), 0 0 0 ${ringW * 2}px ${candFill(candidate.color)}`
          : 'inset 0 0 0 1px var(--line)',
        margin: ring ? ringW * 2 : 0,
      }}
    >
      <span
        className="font-mono font-medium text-ink-3 uppercase"
        style={{ fontSize: Math.max(10, size * 0.3) }}
        aria-hidden
      >
        {initials(candidate.shortName)}
      </span>
      {state !== 'error' && (
        <img
          key={src}
          src={src}
          alt=""
          loading="lazy"
          decoding="async"
          onLoad={() => setState('ok')}
          onError={() => setState('error')}
          className={clsx(
            'absolute inset-0 size-full rounded-full object-cover object-top transition-opacity duration-500',
            state === 'ok' ? 'opacity-100' : 'opacity-0',
          )}
        />
      )}
    </span>
  );
}
