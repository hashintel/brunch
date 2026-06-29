import type { Diagnostic, ReconciliationNeed, StructuralIllegal } from '../../../graph/index.js';

export function formatReconciliationNeeds(needs: readonly ReconciliationNeed[]): string {
  if (needs.length === 0) return '[Reconciliation needs] No reconciliation needs are currently open.';
  return [
    `[Reconciliation needs] ${needs.length} open item(s):`,
    ...needs.map(
      (need, index) =>
        `${index + 1}. ${need.kind} ${formatTarget(need.target)}${need.rationale ? ` — ${oneLine(need.rationale)}` : ''}`,
    ),
  ].join('\n');
}

type ReconciliationUpdateResult = { readonly status: 'success'; readonly lsn: number } | StructuralIllegal;

export function formatReconciliationUpdateResult(
  result: ReconciliationUpdateResult,
  action: 'create' | 'resolve',
): string {
  if (result.status === 'success') {
    return `${action === 'create' ? 'Created reconciliation need' : 'Resolved reconciliation need'} (lsn ${result.lsn}).`;
  }
  return formatStructuralIllegal(result.diagnostics);
}

function formatStructuralIllegal(diagnostics: readonly Diagnostic[]): string {
  return `STRUCTURAL_ILLEGAL\n${diagnostics.map((diagnostic) => `- ${diagnostic.field}: ${diagnostic.message}`).join('\n')}`;
}

function formatTarget(target: ReconciliationNeed['target']): string {
  return target.kind === 'edge' ? `(edge ${target.edgeId})` : `(nodes ${target.aId} ↔ ${target.bId})`;
}

function oneLine(value: string): string {
  return value.trim().replaceAll(/\s+/g, ' ');
}
