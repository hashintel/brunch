import type { CommandExecutor } from '../command-executor.js';
import type {
  CommitGraphInput,
  CreatedGraphNodes,
  Diagnostic,
} from '../command-executor/commit-graph-types.js';
import type { NodePlane } from '../schema/nodes.js';

const CAPTURE_SOURCE_PREFIX = 'structured_exchange_response:';
const LABELED_FACTS: Record<string, { readonly kind: string; readonly ref: string } | undefined> = {
  goal: { kind: 'goal', ref: 'goal' },
  context: { kind: 'context', ref: 'context' },
  constraint: { kind: 'constraint', ref: 'constraint' },
  criterion: { kind: 'criterion', ref: 'criterion' },
};

const INTENT_PLANE: NodePlane = 'intent';

export type StructuredResponseCaptureOutcome =
  | {
      readonly status: 'captured';
      readonly lsn: number;
      readonly nodeCount: number;
      readonly createdNodes: CreatedGraphNodes;
    }
  | {
      readonly status: 'no_capture';
      readonly reason: string;
    }
  | {
      readonly status: 'structural_illegal';
      readonly diagnostics: readonly Diagnostic[];
    };

export interface StructuredResponseCaptureInput {
  readonly specId: number;
  readonly exchangeId: string;
  readonly answer: unknown;
  readonly commandExecutor: CommandExecutor;
}

export function captureStructuredResponseFacts(
  input: StructuredResponseCaptureInput,
): StructuredResponseCaptureOutcome {
  const text = textAnswer(input.answer);
  if (text === undefined) {
    return { status: 'no_capture', reason: 'Only text structured exchange answers are capture candidates.' };
  }

  const nodes = extractLabeledIntentNodes(text, input.exchangeId);
  if (nodes.length === 0) {
    return {
      status: 'no_capture',
      reason: 'No directly labeled high-confidence graph facts found.',
    };
  }

  const command: CommitGraphInput = {
    specId: input.specId,
    basis: 'explicit',
    nodes,
    edges: [],
  };
  const result = input.commandExecutor.commitGraph(command);
  if (result.status === 'structural_illegal') return result;

  return {
    status: 'captured',
    lsn: result.lsn,
    nodeCount: Object.keys(result.createdNodes).length,
    createdNodes: result.createdNodes,
  };
}

function textAnswer(answer: unknown): string | undefined {
  if (typeof answer !== 'object' || answer === null) return undefined;
  const value = (answer as { readonly text?: unknown }).text;
  return typeof value === 'string' ? value : undefined;
}

type CapturedNode = CommitGraphInput['nodes'][number];

function extractLabeledIntentNodes(text: string, exchangeId: string): CapturedNode[] {
  const captured: CapturedNode[] = [];
  const seenRefs = new Set<string>();

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim().replace(/^[-*]\s+/, '');
    const match = /^(goal|context|constraint|criterion):\s*(.+)$/i.exec(line);
    if (!match) continue;

    const label = match[1]!.toLowerCase();
    const title = match[2]!.trim();
    const fact = LABELED_FACTS[label];
    if (!fact || title.length === 0 || seenRefs.has(fact.ref)) continue;
    seenRefs.add(fact.ref);
    captured.push({
      ref: fact.ref,
      plane: INTENT_PLANE,
      kind: fact.kind,
      title,
      source: `${CAPTURE_SOURCE_PREFIX}${exchangeId}`,
    });
  }

  return captured;
}
