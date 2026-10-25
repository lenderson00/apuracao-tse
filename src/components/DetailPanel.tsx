import { useState } from 'react';
import type { ParsedResult } from '../lib/tse/types';
import { fmtUpdatedAt } from '../lib/ui/format';
import { CandidateList } from './CandidateList';
import { DuelBar } from './DuelBar';
import { ResultStatus } from './Hero';
import { TurnoutStats } from './TurnoutStats';
import { Icon } from './ui/Icon';
import { Skeleton } from './ui/Skeleton';
import { Tabs } from './ui/Tabs';

interface HeaderProps {
  context: string;
  title: string;
  data: ParsedResult | null;
  back?: { label: string; onClick: () => void };
}

export function DetailHeader({ context, title, data, back }: HeaderProps) {
  return (
    <div className="min-w-0">
      {back ? (
        <button
          type="button"
          onClick={back.onClick}
          className="eyebrow -ml-1 inline-flex items-center gap-1 rounded-xs px-1 transition-colors hover:text-ink"
        >
          <Icon name="arrow-left" size={12} />
          {back.label}
        </button>
      ) : (
        <p className="eyebrow">{context}</p>
      )}
      <h2 className="mt-1.5 truncate text-title font-medium text-ink sm:text-headline">{title}</h2>
      <div className="mt-2.5 flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
        <ResultStatus data={data} />
        {data && <span className="font-mono text-micro text-ink-3">{fmtUpdatedAt(data.updatedAt)}</span>}
      </div>
    </div>
  );
}

interface Props {
  data: ParsedResult | null;
  loading: boolean;
  error: string | null;
  photoUf: string;
  majority: boolean;
}

type Tab = 'candidatos' | 'participacao';

export function DetailBody({ data, loading, error, photoUf, majority }: Props) {
  const [tab, setTab] = useState<Tab>('candidatos');

  return (
    <div className="pt-4">
      <Tabs<Tab>
        variant="line"
        label="Detalhes do recorte"
        idBase="detalhe"
        value={tab}
        onChange={setTab}
        items={[
          { value: 'candidatos', label: 'Candidatos' },
          { value: 'participacao', label: 'Participação' },
        ]}
      />
      <div id="detalhe-panel" role="tabpanel" className="pt-4">
        {!data && error && !loading ? (
          <div className="card-sunken p-4 text-small text-ink-2">
            <p className="font-medium text-ink">Este recorte não respondeu.</p>
            <p className="mt-1 text-ink-3">Tentamos de novo em um minuto. Enquanto isso, o mapa segue disponível.</p>
          </div>
        ) : !data ? (
          <PanelSkeleton />
        ) : tab === 'candidatos' ? (
          data.candidates.length === 0 ? (
            <p className="text-small text-ink-3">O TSE ainda não publicou candidatos para este recorte.</p>
          ) : (
            <>
              <div className="pb-4">
                <DuelBar candidates={data.candidates} majority={majority} size="sm" maxSegments={5} />
                {!data.turnout.apurationStarted && !data.finished && (
                  <p className="mt-2.5 text-caption text-ink-3">Nenhum voto apurado aqui ainda.</p>
                )}
              </div>
              <CandidateList
                key={`${data.scopeCode}-${data.officeId}-${data.round}`}
                candidates={data.candidates}
                electionId={data.electionId}
                photoUf={photoUf}
              />
            </>
          )
        ) : (
          <TurnoutStats turnout={data.turnout} columns={2} className="pt-1" />
        )}
      </div>
    </div>
  );
}

function PanelSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <Skeleton className="h-2 w-full rounded-full" />
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="flex items-center gap-3" style={{ opacity: 1 - i * 0.2 }}>
          <Skeleton className="size-9 rounded-full" />
          <div className="flex flex-1 flex-col gap-2">
            <Skeleton className="h-3 w-2/3" />
            <Skeleton className="h-1 w-full" />
          </div>
          <Skeleton className="h-4 w-12" />
        </div>
      ))}
    </div>
  );
}
