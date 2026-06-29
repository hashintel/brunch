import type {
  MutateGraphResult,
  MutateGraphSuccess,
  StructuralIllegal,
} from '../../../graph/command-executor.js';

/** Format a mutate_graph result as model-facing tool-result text. */
export function formatMutateGraphResult(result: MutateGraphResult): string {
  if (result.status === 'success') return formatCommitSuccess(result);
  return formatStructuralIllegal(result);
}

function formatCommitSuccess(result: MutateGraphSuccess): string {
  const nodeEntries = Object.entries(result.createdNodes);
  const lines: string[] = [`Graph mutated successfully (LSN ${result.lsn}).`];

  if (nodeEntries.length > 0) {
    const createdNodes = nodeEntries.map(([ref, node]) => `${ref} → ${node.code}`);
    lines.push(`Nodes created: ${createdNodes.join(', ')}`);
  }
  if (result.createdEdges.length > 0)
    lines.push(`Edges created: ${result.createdEdges.map((id) => `#${id}`).join(', ')}`);
  if (result.updatedNodes.length > 0)
    lines.push(`Nodes updated: ${result.updatedNodes.map((id) => `#${id}`).join(', ')}`);
  if (result.updatedEdges.length > 0)
    lines.push(`Edges updated: ${result.updatedEdges.map((id) => `#${id}`).join(', ')}`);
  if (result.deletedNodes.length > 0)
    lines.push(`Nodes deleted: ${result.deletedNodes.map((id) => `#${id}`).join(', ')}`);
  if (result.deletedEdges.length > 0)
    lines.push(`Edges deleted: ${result.deletedEdges.map((id) => `#${id}`).join(', ')}`);

  return lines.join('\n');
}

export function formatStructuralIllegal(result: StructuralIllegal): string {
  const lines: string[] = [
    'STRUCTURAL_ILLEGAL: The batch was rejected. Fix the following issues and retry:',
    '',
  ];

  for (const diagnostic of result.diagnostics) {
    lines.push(`- ${diagnostic.field}: ${diagnostic.message}`);
  }

  return lines.join('\n');
}
