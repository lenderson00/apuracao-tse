import type { OfficeId, OfficeOption, Round } from './types';

const FEDERAL: Record<Round, string> = { 1: '6257', 2: '6258' };
const STATE: Record<Round, string> = { 1: '6259', 2: '6260' };

export const ROUND_OPTIONS: { round: Round; label: string }[] = [
  { round: 2, label: '2º turno' },
  { round: 1, label: '1º turno' },
];

export const OFFICES: OfficeOption[] = [
  {
    id: '1',
    label: 'Presidente',
    electionCode: (r) => FEDERAL[r],
    scope: 'federal',
  },
  {
    id: '3',
    label: 'Governador',
    electionCode: (r) => STATE[r],
    scope: 'state',
  },
  { id: '5', label: 'Senador', electionCode: () => STATE[1], scope: 'state' },
  { id: '6', label: 'Dep. Federal', electionCode: () => STATE[1], scope: 'state' },
  { id: '7', label: 'Dep. Estadual', electionCode: () => STATE[1], scope: 'state' },
];

/** UFs with governador no 2º turno em 2026 (pleito 3221 / ele 6260) */
export const GOV_RUNOFF_UFS = new Set(['ac', 'am', 'df', 'es', 'rn', 'to']);

export function officeForRound(officeId: OfficeId, round: Round): OfficeOption | undefined {
  const office = OFFICES.find((o) => o.id === officeId);
  if (!office) return undefined;
  if (round === 2 && officeId !== '1' && officeId !== '3') return undefined;
  if (round === 2 && officeId === '3') return office;
  return office;
}

export const UF_LIST = [
  { sigla: 'AC', slug: 'ac', name: 'Acre' },
  { sigla: 'AL', slug: 'al', name: 'Alagoas' },
  { sigla: 'AP', slug: 'ap', name: 'Amapá' },
  { sigla: 'AM', slug: 'am', name: 'Amazonas' },
  { sigla: 'BA', slug: 'ba', name: 'Bahia' },
  { sigla: 'CE', slug: 'ce', name: 'Ceará' },
  { sigla: 'DF', slug: 'df', name: 'Distrito Federal' },
  { sigla: 'ES', slug: 'es', name: 'Espírito Santo' },
  { sigla: 'GO', slug: 'go', name: 'Goiás' },
  { sigla: 'MA', slug: 'ma', name: 'Maranhão' },
  { sigla: 'MT', slug: 'mt', name: 'Mato Grosso' },
  { sigla: 'MS', slug: 'ms', name: 'Mato Grosso do Sul' },
  { sigla: 'MG', slug: 'mg', name: 'Minas Gerais' },
  { sigla: 'PA', slug: 'pa', name: 'Pará' },
  { sigla: 'PB', slug: 'pb', name: 'Paraíba' },
  { sigla: 'PR', slug: 'pr', name: 'Paraná' },
  { sigla: 'PE', slug: 'pe', name: 'Pernambuco' },
  { sigla: 'PI', slug: 'pi', name: 'Piauí' },
  { sigla: 'RJ', slug: 'rj', name: 'Rio de Janeiro' },
  { sigla: 'RN', slug: 'rn', name: 'Rio Grande do Norte' },
  { sigla: 'RS', slug: 'rs', name: 'Rio Grande do Sul' },
  { sigla: 'RO', slug: 'ro', name: 'Rondônia' },
  { sigla: 'RR', slug: 'rr', name: 'Roraima' },
  { sigla: 'SC', slug: 'sc', name: 'Santa Catarina' },
  { sigla: 'SP', slug: 'sp', name: 'São Paulo' },
  { sigla: 'SE', slug: 'se', name: 'Sergipe' },
  { sigla: 'TO', slug: 'to', name: 'Tocantins' },
] as const;

export const PARTY_COLORS: Record<string, string> = {
  '13': '#e11d48',
  PT: '#e11d48',
  '22': '#1d4ed8',
  PL: '#1d4ed8',
  '11': '#2563eb',
  '15': '#0ea5e9',
  '40': '#f59e0b',
  '44': '#10b981',
  '45': '#6366f1',
};

export function candidateColor(partySigla: string, number: string): string {
  return PARTY_COLORS[partySigla] ?? PARTY_COLORS[number] ?? '#64748b';
}
