import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { isAbsolute, relative, resolve } from 'node:path';

import { openWorkspaceGraphRuntime } from '../graph/workspace-store.js';
import { openActiveSessionBranch } from '../session/active-session-branch.js';

const RUBRIC_IDS = [
  'consequential_fact_completeness',
  'item_groundedness',
  'settlement_correctness',
  'forbidden_rival_absence',
  'private_leakage_absence',
  'duplicate_effect_absence',
] as const;

type RubricId = (typeof RUBRIC_IDS)[number];
type Verdict = 'pass' | 'fail';

export interface ConsequentialFactScenario {
  readonly schemaVersion: 1;
  readonly scenarioId: string;
  readonly publicBrief: string;
  readonly hiddenFact: {
    readonly id: string;
    readonly verbatim: string;
    readonly revealMarker: string;
    readonly approvalMarker: string;
  };
  readonly graph: {
    readonly required: {
      readonly kind: string;
      readonly title: string;
      readonly bodyIncludes: string;
      readonly settlement: 'settled';
    };
    readonly forbidden: { readonly bodyIncludes: string };
  };
  readonly rubric: readonly RubricId[];
}

export interface ConsequentialFactRun {
  readonly runId: string;
  readonly transcript: readonly EvidenceText[];
  readonly trajectory: readonly EvidenceText[];
  readonly graph: readonly GraphEvidence[];
}

interface EvidenceText {
  readonly ref: string;
  readonly text: string;
  readonly role?: string;
}
interface GraphEvidence {
  readonly ref: string;
  readonly kind: string;
  readonly title: string;
  readonly body: string;
  readonly settlement: string;
}
interface Reason {
  readonly code: string;
  readonly text: string;
  readonly evidence: readonly string[];
}
interface Judgment {
  readonly rubricId: RubricId;
  readonly verdict: Verdict;
  readonly reasons: readonly Reason[];
}
export interface ConsequentialFactReport {
  readonly schemaVersion: 1;
  readonly scenarioId: string;
  readonly runId: string;
  readonly boundedClaim: string;
  readonly judgments: readonly Judgment[];
}

export interface ConsequentialFactEvaluationInput {
  readonly repoRoot: string;
  readonly workspace: string;
  readonly sessionFile: string;
  readonly specId: number;
  readonly scenarioFile: string;
  readonly runId: string;
}

export async function writeConsequentialFactEvaluation(
  input: ConsequentialFactEvaluationInput,
): Promise<string> {
  const workspace = resolve(input.workspace);
  const sessionFile = resolve(input.sessionFile);
  if (!contained(resolve(workspace, '.brunch', 'sessions'), sessionFile)) {
    throw new Error('evaluation session file must belong to the workspace sessions root');
  }
  const scenario = parseConsequentialFactScenario(
    JSON.parse(await readFile(resolve(input.scenarioFile), 'utf8')) as unknown,
  );
  const branch = openActiveSessionBranch(sessionFile).entries;
  const runtime = await openWorkspaceGraphRuntime(workspace);
  const readers = runtime.forSpec(input.specId);
  const slice = readers.queryGraph();
  const run: ConsequentialFactRun = {
    runId: input.runId,
    transcript: branch.flatMap((entry) => {
      if (entry.type !== 'message' || !('message' in entry)) return [];
      const message = entry.message as { role?: unknown; content?: unknown };
      const text = messageText(message.content);
      return typeof message.role === 'string' && text
        ? [{ ref: `transcript:${entry.id}`, role: message.role, text }]
        : [];
    }),
    trajectory: [
      { ref: `trajectory:graph-lsn:${slice.lsn}`, text: `spec-scoped graph read at LSN ${slice.lsn}` },
    ],
    graph: slice.nodes.map((node) => ({
      ref: `graph:${node.kind}:${node.kindOrdinal}`,
      kind: node.kind,
      title: node.title,
      body: node.body ?? '',
      settlement: node.settlement,
    })),
  };
  const report = scoreConsequentialFactRun(scenario, run);
  const output = resolve(input.repoRoot, '.fixtures', 'scratch', 'evaluations', input.runId);
  if (!contained(resolve(input.repoRoot, '.fixtures', 'scratch'), output)) {
    throw new Error('evaluation output must remain beneath repo scratch');
  }
  await mkdir(output, { recursive: true });
  await writeFile(resolve(output, 'verdict.json'), `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  await writeFile(
    resolve(output, 'report.md'),
    `# Consequential-fact evaluation ${report.runId}\n\n> ${report.boundedClaim}\n\n${report.judgments.map((item) => `- **${item.rubricId}: ${item.verdict}** — ${item.reasons.map((reason) => `${reason.text} (${reason.evidence.join(', ')})`).join('; ')}`).join('\n')}\n`,
    'utf8',
  );
  return output;
}

export function parseConsequentialFactScenario(value: unknown): ConsequentialFactScenario {
  if (!record(value) || value.schemaVersion !== 1 || !portable(value.scenarioId)) {
    throw new Error('invalid consequential-fact scenario identity');
  }
  if (!nonempty(value.publicBrief) || !record(value.hiddenFact) || !record(value.graph)) {
    throw new Error('malformed consequential-fact ledger');
  }
  const hidden = value.hiddenFact;
  const graph = value.graph;
  if (
    ![hidden.id, hidden.verbatim, hidden.revealMarker, hidden.approvalMarker].every(nonempty) ||
    !record(graph.required) ||
    !record(graph.forbidden) ||
    ![
      graph.required.kind,
      graph.required.title,
      graph.required.bodyIncludes,
      graph.forbidden.bodyIncludes,
    ].every(nonempty) ||
    graph.required.settlement !== 'settled'
  ) {
    throw new Error('malformed consequential-fact ledger');
  }
  if (
    !Array.isArray(value.rubric) ||
    value.rubric.length !== RUBRIC_IDS.length ||
    value.rubric.some((id, index) => id !== RUBRIC_IDS[index])
  ) {
    throw new Error('unsupported rubric predicate');
  }
  return value as unknown as ConsequentialFactScenario;
}

export function scoreConsequentialFactRun(
  scenarioValue: unknown,
  runValue: ConsequentialFactRun,
): ConsequentialFactReport {
  const scenario = parseConsequentialFactScenario(scenarioValue);
  validateRun(runValue);
  const all = [...runValue.transcript, ...runValue.trajectory, ...runValue.graph];
  const fallback = runValue.trajectory[0]?.ref ?? runValue.transcript[0]?.ref ?? runValue.graph[0]!.ref;
  const revealIndex = runValue.transcript.findIndex((item) =>
    item.text.includes(scenario.hiddenFact.revealMarker),
  );
  const approvalIndex = runValue.transcript.findIndex((item) =>
    item.text.includes(scenario.hiddenFact.approvalMarker),
  );
  const required = runValue.graph.filter(
    (item) =>
      item.kind === scenario.graph.required.kind &&
      item.title === scenario.graph.required.title &&
      item.body.includes(scenario.graph.required.bodyIncludes),
  );
  const forbidden = runValue.graph.filter((item) =>
    item.body.toLowerCase().includes(scenario.graph.forbidden.bodyIncludes.toLowerCase()),
  );
  const leaked = runValue.transcript
    .slice(0, revealIndex < 0 ? undefined : revealIndex)
    .filter((item) => item.text.includes(scenario.hiddenFact.verbatim));

  const judgments: Judgment[] = [
    judgment(
      'consequential_fact_completeness',
      revealIndex >= 0 && required.length === 1,
      revealIndex >= 0 && required.length === 1 ? 'fact_revealed_and_represented' : 'missing_reveal',
      revealIndex >= 0
        ? [runValue.transcript[revealIndex]!.ref, ...(required[0] ? [required[0].ref] : [])]
        : [fallback],
    ),
    judgment(
      'item_groundedness',
      revealIndex >= 0 && approvalIndex > revealIndex,
      revealIndex >= 0 && approvalIndex > revealIndex
        ? 'reveal_precedes_approval'
        : 'missing_warrant_before_commit',
      revealIndex >= 0 && approvalIndex >= 0
        ? [runValue.transcript[revealIndex]!.ref, runValue.transcript[approvalIndex]!.ref]
        : [fallback],
    ),
    judgment(
      'settlement_correctness',
      required.length === 1 && required[0]!.settlement === 'settled',
      required.length === 1 && required[0]!.settlement === 'settled'
        ? 'single_settled_constraint'
        : 'settled_constraint_missing',
      required.length ? required.map((item) => item.ref) : [fallback],
    ),
    judgment(
      'forbidden_rival_absence',
      forbidden.length === 0,
      forbidden.length === 0 ? 'forbidden_rival_absent' : 'forbidden_rival_present',
      forbidden.length ? forbidden.map((item) => item.ref) : [fallback],
    ),
    judgment(
      'private_leakage_absence',
      leaked.length === 0,
      leaked.length === 0 ? 'private_fact_absent_before_reveal' : 'private_fact_leaked',
      leaked.length ? leaked.map((item) => item.ref) : [fallback],
    ),
    judgment(
      'duplicate_effect_absence',
      required.length <= 1,
      required.length <= 1 ? 'no_duplicate_constraint' : 'duplicate_constraint',
      required.length ? required.map((item) => item.ref) : [fallback],
    ),
  ];
  const refs = new Set(all.map((item) => item.ref));
  if (
    judgments.some((item) => item.reasons.some((reason) => reason.evidence.some((ref) => !refs.has(ref))))
  ) {
    throw new Error('unreferenced reason evidence');
  }
  return {
    schemaVersion: 1,
    scenarioId: scenario.scenarioId,
    runId: runValue.runId,
    boundedClaim:
      'This report supports deterministic diagnostic discrimination only; joined evidence is not standalone causality or campaign evidence.',
    judgments,
  };
}

function judgment(rubricId: RubricId, passes: boolean, code: string, evidence: readonly string[]): Judgment {
  return {
    rubricId,
    verdict: passes ? 'pass' : 'fail',
    reasons: [{ code, text: code.replaceAll('_', ' '), evidence }],
  };
}

function validateRun(run: ConsequentialFactRun): void {
  if (!portable(run.runId)) throw new Error('consequential-fact run id must be portable');
  const evidence = [...run.transcript, ...run.trajectory, ...run.graph];
  if (
    evidence.length === 0 ||
    run.transcript.some((item) => !nonempty(item.ref) || !nonempty(item.text)) ||
    run.trajectory.some((item) => !nonempty(item.ref) || !nonempty(item.text)) ||
    run.graph.some((item) => !nonempty(item.ref) || !nonempty(item.body))
  ) {
    throw new Error('unreferenced reason evidence');
  }
  if (new Set(evidence.map((item) => item.ref)).size !== evidence.length) {
    throw new Error('ambiguous evidence reference');
  }
}
function contained(root: string, candidate: string): boolean {
  const path = relative(root, candidate);
  return path !== '' && !path.startsWith('..') && !isAbsolute(path);
}
function messageText(value: unknown): string {
  if (typeof value === 'string') return value;
  if (!Array.isArray(value)) return '';
  return value
    .flatMap((item) => (record(item) && typeof item.text === 'string' ? [item.text] : []))
    .join('\n');
}
function portable(value: unknown): value is string {
  return typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9._-]{0,79}$/u.test(value);
}
function nonempty(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}
function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
