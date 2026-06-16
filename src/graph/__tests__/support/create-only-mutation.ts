import type { MutateGraphDryRunResult, MutateGraphInput, MutateGraphResult } from '../../command-executor.js';
import type { CommandExecutor } from '../../command-executor.js';
import type { CreateGraphEdgeInput, CreateGraphInput } from '../../command-executor/graph-mutation-types.js';
import { roleNamedEdgeDraftFromCreateEdgeInput } from '../../command-executor/role-named-edge-draft.js';

export type CreateOnlyMutationInput = CreateGraphInput;

export function runCreateOnlyMutation(
  executor: CommandExecutor,
  input: CreateOnlyMutationInput,
): MutateGraphResult {
  return executor.mutateGraph(toMutateGraphInput(input));
}

export function dryRunCreateOnlyMutation(
  executor: CommandExecutor,
  input: CreateOnlyMutationInput,
): MutateGraphDryRunResult {
  return executor.dryRunMutateGraph(toMutateGraphInput(input));
}

function toMutateGraphInput(input: CreateOnlyMutationInput): MutateGraphInput {
  return {
    specId: input.specId,
    createBasis: input.basis,
    ops: [
      ...input.nodes.map((node) => ({ op: 'create_node' as const, ...node })),
      ...input.edges.map((edge) => toCreateEdgeOp(edge)),
    ],
  };
}

function toCreateEdgeOp(edge: CreateGraphEdgeInput): MutateGraphInput['ops'][number] {
  try {
    return { op: 'create_edge', ...roleNamedEdgeDraftFromCreateEdgeInput(edge) };
  } catch {
    // Preserve create-only regression tests that intentionally feed invalid
    // categories through the transitional helper so mutateGraph can reject them.
    return { op: 'create_edge', ...edge } as unknown as MutateGraphInput['ops'][number];
  }
}
