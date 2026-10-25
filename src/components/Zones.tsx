import { useEffect, useRef, useState } from 'react';
import { fetchZoneResult } from '../lib/tse/client';
import { parseResult } from '../lib/tse/parse';
import { fetchSectionIndex, fetchSectionFiles, fetchBoletim, type SectionRef } from '../lib/tse/urna';
import { fmtBuDate, type BoletimUrna } from '../lib/tse/bu';
import { OFFICES } from '../lib/tse/config';
import type { CandidateRow, MunicipalityRef, OfficeId, ParsedResult, Round } from '../lib/tse/types';
import { candFill } from '../lib/ui/color';
import { sectionAuxUrl } from '../lib/tse/urna';
import { fmtPct, titleCase } from '../lib/ui/format';
import { Int, Pct } from './ui/Num';
import { Skeleton } from './ui/Skeleton';
import { Tabs } from './ui/Tabs';
// Compartilhado entre montagens, inclusive a repetição de efeitos do Strict Mode.
let activeZones = 0;
const zoneWaiters: (() => void)[] = [];
async function withZoneSlot<T>(load: () => Promise<T>): Promise<T> {
  if (activeZones >= 6) await new Promise<void>((resolve) => zoneWaiters.push(resolve));
  else activeZones++;
  try {
    return await load();
  } finally {
    const next = zoneWaiters.shift();
    if (next) next();
    else activeZones--;
  }
}
export function Zones({
  municipality: m,
  round,
  officeId,
  candidates,
  selected,
}: {
  municipality: MunicipalityRef;
  round: Round;
  officeId: OfficeId;
  candidates: CandidateRow[];
  selected?: CandidateRow;
}) {
  const [results, setResults] = useState<Record<string, ParsedResult | null>>({});
  const [zone, setZone] = useState<string | null>(m.zones.length === 1 ? m.zones[0] : null);
  useEffect(() => {
    let alive = true;
    let next = 0;
    async function worker() {
      while (alive && next < m.zones.length) {
        const z = m.zones[next++];
        try {
          const raw = await withZoneSlot(() =>
            alive ? fetchZoneResult(round, officeId, m.uf.toLowerCase(), m.tseCode, z) : Promise.resolve(null),
          );
          if (!raw || !alive) continue;
          const d = parseResult(raw, {
            round,
            officeId,
            scopeLabel: `Zona ${z}`,
          });
          if (alive) setResults((p) => ({ ...p, [z]: d }));
        } catch {
          if (alive) setResults((p) => ({ ...p, [z]: null }));
        }
      }
    }
    void Promise.all(Array.from({ length: Math.min(6, m.zones.length) }, worker));
    return () => {
      alive = false;
    };
  }, [m, round, officeId]);
  const loaded = Object.values(results).filter(Boolean);
  const leader = selected ?? [...candidates].sort((a, b) => b.votes - a.votes)[0];
  const leads = loaded.filter((r) => r && r.candidates[0]?.votes > 0 && r.candidates[0]?.sqcand === leader?.sqcand).length;
  const d = zone ? results[zone] : undefined;
  if (zone)
    return (
      <ZoneDetail
        key={zone}
        {...{ round, officeId, zone }}
        municipality={m}
        data={d}
        candidates={d?.candidates ?? candidates}
        onBack={() => setZone(null)}
      />
    );
  return (
    <div>
      <p className="mb-2 text-caption text-ink-3">
        {m.zones.length} zonas · {leader ? `${titleCase(leader.shortName)} líder em ${leads}` : 'aguardando resultados'}
        {Object.keys(results).length < m.zones.length ? ` (${Object.keys(results).length} carregadas)` : ''}
      </p>
      <div className="grid grid-cols-1 gap-x-5 lg:grid-cols-3">
        {[...m.zones].sort().map((z) => {
          const r = results[z];
          const c = selected ? r?.candidates.find((c) => c.sqcand === selected.sqcand) : r?.candidates[0];
          return (
            <button key={z} onClick={() => setZone(z)} className="min-w-0 py-2 text-left hover:bg-hover" aria-label={`Zona ${z}`}>
              <div className="flex items-baseline gap-1.5 text-caption">
                <strong className="shrink-0 font-medium">Zona {z}</strong>
                <span className="min-w-0 flex-1 truncate text-ink-2">
                  {r
                    ? c && c.votes > 0
                      ? `${titleCase(c.shortName)} ${fmtPct(c.percent)}`
                      : 'Sem votos'
                    : r === null
                      ? 'Indisponível'
                      : 'Carregando…'}
                </span>
                <span className="shrink-0 font-mono text-nano text-ink-3" title="Apurado">
                  {r ? fmtPct(r.turnout.sectionsPct) : '…'}
                </span>
              </div>
              {r === undefined ? (
                <Skeleton className="mt-1 h-0.5 w-full" />
              ) : (
                <div className="mt-1 flex h-0.5 overflow-hidden bg-hover">
                  {r?.candidates.slice(0, 2).map((c) => (
                    <span key={c.sqcand} style={{ width: `${c.percent}%`, background: candFill(c.color) }} />
                  ))}
                </div>
              )}
            </button>
          );
        })}
      </div>
      {!m.zones.length && <p className="text-small text-ink-3">O TSE não informou as zonas deste município.</p>}
    </div>
  );
}
function CandidateRows({ rows }: { rows: CandidateRow[] }) {
  return (
    <ol>
      {rows.map((c, i) => (
        <li key={c.sqcand} className="flex justify-between gap-2 py-1 text-caption">
          <span className="truncate">
            {i + 1}º · {c.number} · {titleCase(c.shortName)} <span className="text-ink-3">{c.party}</span>
          </span>
          <span className="shrink-0">
            <Int value={c.votes} /> · <Pct value={c.percent} />
          </span>
        </li>
      ))}
    </ol>
  );
}
function ZoneDetail({
  municipality: m,
  round,
  officeId,
  zone,
  data,
  candidates,
  onBack,
}: {
  municipality: MunicipalityRef;
  round: Round;
  officeId: OfficeId;
  zone: string;
  data: ParsedResult | null | undefined;
  candidates: CandidateRow[];
  onBack: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [sections, setSections] = useState<SectionRef[] | null>(null);
  const [section, setSection] = useState<string | null>(null);
  const [error, setError] = useState('');
  const gridRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    let alive = true;
    fetchSectionIndex(round, m.uf.toLowerCase())
      .then((idx) => {
        if (alive) {
          setError('');
          setSections([...(idx.get(m.tseCode)?.get(zone) ?? [])].sort((a, b) => Number(a.ns) - Number(b.ns)));
        }
      })
      .catch(() => {
        if (alive) setError('Não foi possível carregar o índice de seções.');
      });
    return () => {
      alive = false;
    };
  }, [open, round, m, zone]);
  const index = sections?.findIndex((s) => s.ns === section) ?? -1;
  function move(step: number) {
    if (!sections || index < 0) return;
    const next = sections[index + step];
    if (next) setSection(next.ns);
  }
  useEffect(() => {
    if (!section || !sections) return;
    const key = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName) || el.closest('[role="tablist"]')) return;
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      e.preventDefault();
      const next = sections[index + (e.key === 'ArrowRight' ? 1 : -1)];
      if (next) setSection(next.ns);
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [section, sections, index]);
  useEffect(() => {
    const grid = gridRef.current;
    const active = grid?.querySelector<HTMLElement>('[aria-pressed="true"]');
    if (grid && active) {
      const delta = active.getBoundingClientRect().top - grid.getBoundingClientRect().top;
      if (delta < 0 || delta + active.offsetHeight > grid.clientHeight) grid.scrollTop += delta;
    }
  }, [section]);
  return (
    <div className="zone-detail">
      <nav aria-label="Navegação da zona" className="mb-2 flex h-7 shrink-0 items-center gap-2 text-caption text-ink-3">
        <button onClick={onBack} className="hover:text-ink">
          Zonas
        </button>
        <span>/</span>
        <button
          className="text-ink"
          onClick={() => {
            setOpen(false);
            setSection(null);
          }}
        >
          Zona {zone}
        </button>
        {section && (
          <>
            <span>/</span>
            <span className="text-ink">Seção {section}</span>
          </>
        )}
        <span className="ml-auto hidden font-mono text-nano lg:inline">{data ? `${fmtPct(data.turnout.sectionsPct)} apurado` : ''}</span>
      </nav>
      {!open ? (
        <>
          {data === undefined ? (
            <Skeleton className="h-24 w-full" />
          ) : data === null ? (
            <p className="text-small text-ink-3">Não foi possível obter o resultado desta zona no TSE.</p>
          ) : (
            <CandidateRows rows={data.candidates} />
          )}
          <button className="btn btn-solid mt-2" onClick={() => setOpen(true)}>
            Seções
          </button>
          {['SP', 'MG', 'RJ'].includes(m.uf.toUpperCase()) && (
            <span className="ml-2 text-nano text-ink-3">Índice da UF inteira{m.uf.toUpperCase() === 'SP' ? ' · cerca de 460 KB' : ''}</span>
          )}
        </>
      ) : error ? (
        <p className="text-small">{error}</p>
      ) : !sections ? (
        <Skeleton className="h-32 w-full" />
      ) : (
        <div className="section-workspace">
          <aside className="flex min-h-0 flex-col">
            <div className="mb-2 flex items-center justify-between text-nano text-ink-3">
              <span>{sections.length} seções</span>
              <span>Esmaecidas: não recebidas</span>
            </div>
            <div ref={gridRef} className="section-grid scroll-y">
              {sections.map((s) => (
                <button
                  key={s.ns}
                  aria-label={`Seção ${s.ns}`}
                  aria-pressed={section === s.ns}
                  onClick={() => setSection(s.ns)}
                  className={`section-chip ${section === s.ns ? 'is-active' : ''} ${s.receivedAt ? '' : 'opacity-40'}`}
                >
                  {s.ns}
                </button>
              ))}
            </div>
          </aside>
          <div className="flex min-h-0 min-w-0 flex-col">
            {section ? (
              <>
                <div className="mb-1 flex shrink-0 items-center gap-2 text-caption">
                  <h3 className="flex-1 font-medium">Boletim · Seção {section}</h3>
                  <span className="text-nano text-ink-3">
                    {index + 1}/{sections.length}
                  </span>
                  <button className="section-arrow" aria-label="Seção anterior" disabled={index <= 0} onClick={() => move(-1)}>
                    ←
                  </button>
                  <button
                    className="section-arrow"
                    aria-label="Próxima seção"
                    disabled={index >= sections.length - 1}
                    onClick={() => move(1)}
                  >
                    →
                  </button>
                </div>
                <Boletim key={section} {...{ round, officeId, zone, section, candidates }} municipality={m} />
              </>
            ) : (
              <p className="m-auto text-small text-ink-3">Escolha uma seção para abrir o boletim.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
function Boletim({
  municipality: m,
  round,
  officeId,
  zone,
  section,
  candidates,
}: {
  municipality: MunicipalityRef;
  round: Round;
  officeId: OfficeId;
  zone: string;
  section: string;
  candidates: CandidateRow[];
}) {
  const [bu, setBu] = useState<BoletimUrna | null>(null);
  const [url, setUrl] = useState('');
  const [error, setError] = useState('');
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const files = await fetchSectionFiles(round, m.uf.toLowerCase(), m.tseCode, zone, section);
        if (!alive) return;
        if (!files?.bu) {
          setError('O TSE ainda não publicou o boletim desta seção.');
          return;
        }
        setUrl(files.bu);
        try {
          const decoded = await fetchBoletim(files.bu);
          if (alive) setBu(decoded);
        } catch {
          if (alive) setError('Não foi possível decodificar o boletim publicado pelo TSE.');
        }
      } catch {
        if (alive) setError('Não foi possível buscar o boletim no TSE.');
      }
    })();
    return () => {
      alive = false;
    };
  }, [m, round, officeId, zone, section]);
  const election = bu?.elections.find((e) => e.electionId === Number(OFFICES.find((o) => o.id === officeId)!.electionCode(round)));
  const office = election?.offices.find((o) => o.officeCode === Number(officeId));
  const nominal = office?.votes.filter((v) => v.kind === 'nominal').sort((a, b) => b.votes - a.votes) ?? [];
  const valid = nominal.reduce((sum, v) => sum + v.votes, 0);
  const pct = (n: number, total: number) => (total ? (n / total) * 100 : 0);
  const original = url || sectionAuxUrl(round, m.uf.toLowerCase(), m.tseCode, zone, section);
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="mb-1 flex shrink-0 flex-wrap items-center justify-between gap-x-3 gap-y-1 text-nano">
        <span className="text-ink-3">
          Zona {zone} · Local {bu?.local ?? 'não informado'}
        </span>
        <a className="text-accent" target="_blank" rel="noreferrer" href={original}>
          Arquivo original no TSE ↗
        </a>
      </div>
      {bu?.emittedAt && <p className="mb-2 shrink-0 text-nano text-ink-3">Emitido em {fmtBuDate(bu.emittedAt)}</p>}
      <div className="scroll-y min-h-0 flex-1">
        {error ? (
          <p className="py-3 text-small text-ink-2">{error}</p>
        ) : !bu ? (
          <Skeleton className="h-24 w-full" />
        ) : !office || !election ? (
          <p className="text-small">Este boletim não contém o cargo e turno selecionados.</p>
        ) : (
          <>
            <div className="mb-2 flex flex-wrap gap-x-4 gap-y-1 text-nano text-ink-2">
              <span>
                Aptos <Int value={election.electorate} />
              </span>
              <span>
                Comparecimento <Int value={office.turnout} />
              </span>
              <span>
                Abstenção <Int value={election.electorate - office.turnout} />
              </span>
            </div>
            <p className="mb-1 text-nano text-ink-3">Votos nominais · % dos válidos nominais</p>
            <ol>
              {nominal.map((v, i) => {
                const c = candidates.find((c) => Number(c.number) === v.number);
                const percent = pct(v.votes, valid);
                return (
                  <li key={i} className="bu-vote">
                    <div className="grid grid-cols-[2.5rem_minmax(0,1fr)_auto_auto] items-baseline gap-2 text-caption">
                      <span className="font-mono text-ink-3">{v.number}</span>
                      <span className="truncate">
                        {c ? titleCase(c.shortName) : `Número ${v.number}`}{' '}
                        <small className="text-nano text-ink-3">{c?.party ?? (v.party ? `Partido ${v.party}` : '')}</small>
                      </span>
                      <Int value={v.votes} />
                      <Pct className="w-16 text-right" value={percent} />
                    </div>
                    <div className="mt-1 h-0.5 bg-hover">
                      <div className="h-full" style={{ width: `${percent}%`, background: c ? candFill(c.color) : '#a1a1aa' }} />
                    </div>
                  </li>
                );
              })}
            </ol>
            <div className="mt-2 border-t border-line pt-1">
              {office.votes
                .filter((v) => v.kind !== 'nominal')
                .map((v, i) => (
                  <div key={i} className="flex items-baseline gap-2 py-1 text-caption">
                    <span className="flex-1 text-ink-3">
                      {
                        {
                          branco: 'Brancos',
                          nulo: 'Nulos',
                          legenda: `Legenda ${v.number ?? v.party ?? ''}`,
                          semCandidato: 'Sem candidato',
                        }[v.kind as 'branco' | 'nulo' | 'legenda' | 'semCandidato']
                      }
                    </span>
                    <Int value={v.votes} />
                    <Pct className="w-16 text-right" value={pct(v.votes, office.turnout)} />
                  </div>
                ))}
              <p className="text-right text-nano text-ink-3">% do comparecimento</p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
export function DetailTabs({
  result,
  candidate,
  candidateLabel,
  zones,
  evolution,
}: {
  result: React.ReactNode;
  candidate?: React.ReactNode;
  candidateLabel?: string;
  zones?: React.ReactNode;
  evolution?: React.ReactNode;
}) {
  const [tab, setTab] = useState(candidate ? 'candidate' : 'result');
  return (
    <>
      <Tabs
        variant="line"
        label="Dados do recorte"
        value={tab}
        onChange={setTab}
        items={[
          { value: 'result', label: 'Resultado' },
          ...(candidate ? [{ value: 'candidate', label: candidateLabel ?? 'Perfil' }] : []),
          ...(zones ? [{ value: 'zones', label: 'Zonas' }] : []),
          ...(evolution ? [{ value: 'evo', label: 'Evolução' }] : []),
        ]}
      />
      <div className="scroll-y min-h-0 max-h-[42dvh] py-2" data-dock-anim>
        {tab === 'zones' && zones ? zones : tab === 'candidate' && candidate ? candidate : tab === 'evo' && evolution ? evolution : result}
      </div>
    </>
  );
}
