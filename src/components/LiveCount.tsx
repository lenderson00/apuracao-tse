import NumberFlow from '@number-flow/react';
import clsx from 'clsx';
import { usePresence } from '../hooks/usePresence';

const TIMING = { duration: 750, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' };
const EXATO = { maximumFractionDigits: 0, useGrouping: true } as const;
// estimativa: 2 algarismos significativos, "12 mil", "4,3 mil", "1,2 mi"
const ESTIMADO = { notation: 'compact', compactDisplay: 'short', maximumSignificantDigits: 2 } as const;

/**
 * Pill "● 12.483 acompanhando agora". Quando é estimativa por amostragem,
 * mostra "~12 mil" e diz isso no title. Some sozinha se o serviço falhar.
 */
export function LiveCount({ className }: { className?: string }) {
  const presence = usePresence();
  if (!presence) return null;
  const { count, estimated } = presence;
  return (
    <span
      className={clsx('pill pill-done', className)}
      title={estimated ? 'Estimativa por amostragem das abas abertas agora' : 'Abas abertas no site agora'}
    >
      <span className="live-dot" style={{ color: '#5ee0a0' }} aria-hidden />
      <NumberFlow
        value={count}
        locales="pt-BR"
        format={estimated ? ESTIMADO : EXATO}
        prefix={estimated ? '~' : undefined}
        className="nf tnum"
        transformTiming={TIMING}
        spinTiming={TIMING}
        respectMotionPreference
        willChange={false}
      />
      <span>acompanhando agora</span>
    </span>
  );
}
