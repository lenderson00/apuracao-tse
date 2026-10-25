import NumberFlow from '@number-flow/react';
import clsx from 'clsx';

/**
 * Números animados (NumberFlow). Morfam entre recortes (Brasil → estado →
 * município) e nas atualizações. Respeitam prefers-reduced-motion.
 */

const PCT = { minimumFractionDigits: 2, maximumFractionDigits: 2 } as const;
const INT = { maximumFractionDigits: 0, useGrouping: true } as const;
const TIMING = { duration: 750, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' };
const SPIN = { duration: 750, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' };

interface Props {
  value: number;
  className?: string;
  /** desliga a animação (ex.: linhas fora da tela numa lista longa) */
  static?: boolean;
}

export function Pct({ value, className, static: still }: Props) {
  return (
    <NumberFlow
      value={Number.isFinite(value) ? value : 0}
      locales="pt-BR"
      format={PCT}
      suffix="%"
      className={clsx('nf tnum', className)}
      transformTiming={TIMING}
      spinTiming={SPIN}
      animated={!still}
      respectMotionPreference
      willChange={false}
    />
  );
}

export function Int({ value, className, static: still }: Props) {
  return (
    <NumberFlow
      value={Number.isFinite(value) ? Math.round(value) : 0}
      locales="pt-BR"
      format={INT}
      className={clsx('nf tnum', className)}
      transformTiming={TIMING}
      spinTiming={SPIN}
      animated={!still}
      respectMotionPreference
      willChange={false}
    />
  );
}
