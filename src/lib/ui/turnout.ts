import type { TurnoutStats } from '../tse/types';

/** A apuração começou neste recorte? Antes disso, a participação fica "—". */
export function hasStarted(t: TurnoutStats | undefined): boolean {
  return !!t && (t.sectionsCounted > 0 || t.validVotes > 0 || t.turnout > 0);
}
