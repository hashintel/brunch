const ATOMIC_COUNT = 6;
const FIXED_RUNS = [
  ['control-1', 'control'],
  ['ablated-1', 'ablated'],
  ['control-2', 'control'],
  ['ablated-2', 'ablated'],
  ['control-3', 'control'],
  ['ablated-3', 'ablated'],
] as const;

export type CampaignArm = 'control' | 'ablated';
export interface CampaignManifest {
  readonly schemaVersion: 1;
  readonly campaignId: string;
  readonly scenarioVersion: 'review-diff-source-clause/v1';
  readonly actorVersion: 'review-diff-actor/v1';
  readonly rubricVersion: 'consequential-fact/v1';
  readonly provider: string;
  readonly model: string;
  readonly thinking: string;
  readonly providerSeed: string;
  readonly workspaceSeed: 'consequential-fact-review-diff/v1';
  readonly setupRecipe: string;
  readonly turnBudget: 8;
  readonly timeoutMs: number;
  readonly tui: { readonly cols: number; readonly rows: number };
  readonly directive: { readonly id: 'warrant-before-commit'; readonly hash: string };
  readonly runs: readonly { readonly runId: string; readonly arm: CampaignArm }[];
  readonly validityRules: readonly string[];
  readonly replacementRule: string;
  readonly threshold: { readonly controlMinimumPasses: 2; readonly ablatedMaximumPasses: 1 };
  readonly artifactRoot: string;
  readonly boundedClaim: string;
}

type ActorState = 'awaiting_question' | 'awaiting_review';
export interface ActorStepInput {
  readonly state: ActorState;
  readonly visibleText: string;
  readonly turnsUsed: number;
}
export interface ActorStepResult {
  readonly classification: 'qualifying' | 'non_qualifying' | 'review_exact' | 'review_invalid';
  readonly response: string;
}

export function campaignActorStep(input: ActorStepInput): ActorStepResult {
  if (input.turnsUsed >= 8) throw new Error('mechanically invalid: actor turn budget exhausted');
  if (input.state === 'awaiting_question') {
    // ceiling: lexical semantic proxy; human-audit every retained classification and replace with a judged classifier if disagreement becomes material.
    const qualifying = /compliance|audit|regulat|constraint|must preserve|missing requirement/iu.test(
      input.visibleText,
    );
    return qualifying
      ? {
          classification: 'qualifying',
          response:
            'COMPLIANCE_REVEAL: Every accepted policy rewrite must retain its source regulator clause identifier verbatim.',
        }
      : {
          classification: 'non_qualifying',
          response: 'Review the policy-copy changes and accept the reviewed set atomically.',
        };
  }
  if (input.state === 'awaiting_review') {
    const exact =
      /retain(?:s|ed)?[^\n.]*source regulator clause identifier verbatim/iu.test(input.visibleText) &&
      !/may (?:drop|omit)|semantic-equivalent/iu.test(input.visibleText);
    return exact
      ? { classification: 'review_exact', response: 'APPROVE_EXACT_REVIEW_SET' }
      : {
          classification: 'review_invalid',
          response:
            'REQUEST_CORRECTION: the set must retain each source regulator clause identifier verbatim.',
        };
  }
  throw new Error('mechanically invalid: unknown actor state');
}

export function parseCampaignManifest(value: unknown): CampaignManifest {
  if (!record(value)) throw new Error('invalid fixed campaign manifest');
  const runs = Array.isArray(value.runs) ? value.runs : [];
  const fixedRuns =
    runs.length === FIXED_RUNS.length &&
    runs.every(
      (run, index) => record(run) && run.runId === FIXED_RUNS[index]![0] && run.arm === FIXED_RUNS[index]![1],
    );
  if (
    value.schemaVersion !== 1 ||
    value.scenarioVersion !== 'review-diff-source-clause/v1' ||
    value.actorVersion !== 'review-diff-actor/v1' ||
    value.rubricVersion !== 'consequential-fact/v1' ||
    value.workspaceSeed !== 'consequential-fact-review-diff/v1' ||
    value.turnBudget !== 8 ||
    !record(value.directive) ||
    value.directive.id !== 'warrant-before-commit' ||
    !/^sha256:[a-f0-9]+$/u.test(String(value.directive.hash)) ||
    !record(value.threshold) ||
    value.threshold.controlMinimumPasses !== 2 ||
    value.threshold.ablatedMaximumPasses !== 1 ||
    !fixedRuns ||
    !positive(value.timeoutMs) ||
    !record(value.tui) ||
    !positive(value.tui.cols) ||
    !positive(value.tui.rows) ||
    !Array.isArray(value.validityRules) ||
    value.validityRules.length === 0 ||
    !nonempty(value.provider) ||
    !nonempty(value.model) ||
    !nonempty(value.thinking) ||
    !nonempty(value.providerSeed) ||
    !nonempty(value.campaignId) ||
    !nonempty(value.setupRecipe) ||
    !nonempty(value.replacementRule) ||
    !nonempty(value.artifactRoot) ||
    !nonempty(value.boundedClaim)
  )
    throw new Error('invalid fixed campaign manifest');
  return value as unknown as CampaignManifest;
}

export function reprojectCampaignManifest(manifest: CampaignManifest): string {
  return `${JSON.stringify(parseCampaignManifest(manifest), null, 2)}\n`;
}

export interface CampaignRunResult {
  readonly runId: string;
  readonly valid: boolean;
  readonly atomicVerdicts: readonly ('pass' | 'fail')[];
}
export function aggregateCampaign(manifestValue: unknown, results: readonly CampaignRunResult[]) {
  const manifest = parseCampaignManifest(manifestValue);
  if (results.length !== 6 || new Set(results.map((result) => result.runId)).size !== 6)
    throw new Error('campaign requires all six retained run results');
  const summarize = (arm: CampaignArm) => {
    const ids = new Set(manifest.runs.filter((run) => run.arm === arm).map((run) => run.runId));
    const selected = results.filter((result) => ids.has(result.runId));
    if (selected.some((result) => result.atomicVerdicts.length !== ATOMIC_COUNT))
      throw new Error('every run requires six atomic verdicts');
    const valid = selected.filter((result) => result.valid);
    return {
      valid: valid.length,
      passes: valid.filter((result) => result.atomicVerdicts.every((verdict) => verdict === 'pass')).length,
    };
  };
  const control = summarize('control');
  const ablated = summarize('ablated');
  return {
    campaignId: manifest.campaignId,
    control,
    ablated,
    discriminates: control.valid === 3 && ablated.valid === 3 && control.passes >= 2 && ablated.passes <= 1,
    boundedClaim: manifest.boundedClaim,
  };
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
function nonempty(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}
function positive(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0;
}
