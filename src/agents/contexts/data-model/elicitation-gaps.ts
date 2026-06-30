import type { Diagnostic, ElicitationGap, StructuralIllegal } from '../../../graph/index.js';

export function formatElicitationAgenda(
  agenda: readonly ElicitationGap[],
  others: readonly ElicitationGap[] | undefined,
): string {
  const lines: string[] = [];
  if (agenda.length === 0) {
    lines.push('[Elicitation agenda] No elicitation gaps are currently open for the selected spec.');
  } else {
    lines.push(`[Elicitation agenda] ${agenda.length} open question(s), ranked:`);
    agenda.forEach((gap, index) => {
      lines.push(
        `${index + 1}. ${oneLine(gap.question)} (refers to: ${gap.refersTo} · band: ${gap.band} · importance: ${gap.importance} · coverage: ${gap.coverage})`,
      );
    });
  }
  if (others && others.length > 0) {
    lines.push('');
    lines.push(`[Not on the agenda] ${others.length} gap(s):`);
    for (const gap of others) {
      const state = gap.answered ? 'answered' : gap.disposition;
      lines.push(`- ${oneLine(gap.question)} (${state})`);
    }
  }
  return lines.join('\n');
}

type ElicitationUpdateResult = { readonly status: 'success'; readonly lsn: number } | StructuralIllegal;

export function formatElicitationUpdateResult(
  result: ElicitationUpdateResult,
  action: 'spawn' | 'set_disposition',
): string {
  if (result.status === 'success')
    return `${action === 'spawn' ? 'Spawned gap' : 'Updated gap disposition'} (lsn ${result.lsn}).`;
  return formatStructuralIllegal(result.diagnostics);
}

function formatStructuralIllegal(diagnostics: readonly Diagnostic[]): string {
  return `STRUCTURAL_ILLEGAL\n${diagnostics.map((diagnostic) => `- ${diagnostic.field}: ${diagnostic.message}`).join('\n')}`;
}

function oneLine(value: string): string {
  return value.trim().replaceAll(/\s+/g, ' ');
}
