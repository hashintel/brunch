import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import { portableCwd } from './portable-report.js';

const PROBE_ID = 'capture-quality' as const;

type CaptureFactKind = 'goal' | 'context' | 'constraint' | 'criterion' | 'requirement' | 'assumption';
type CaptureRecommendation = 'graduate' | 'narrow' | 'keep_parked';

interface CaptureQualityExpectedFact {
  readonly id: string;
  readonly kind: CaptureFactKind;
  readonly title: string;
  readonly shouldCommit: boolean;
  readonly rationale: string;
}

export interface CaptureQualityScenario {
  readonly id: string;
  readonly label: string;
  readonly category: 'free_prose' | 'file_ref' | 'implication_heavy';
  readonly input: string;
  readonly expectedFacts: readonly CaptureQualityExpectedFact[];
}

interface CaptureQualityExtractedFact {
  readonly expectedId?: string;
  readonly kind: CaptureFactKind;
  readonly title: string;
  readonly confidence: 'high' | 'low';
  readonly evidence: string;
}

export interface CaptureQualityScenarioExtraction {
  readonly scenarioId: string;
  readonly facts: readonly CaptureQualityExtractedFact[];
}

interface CaptureQualityScenarioResult {
  readonly scenarioId: string;
  readonly label: string;
  readonly category: CaptureQualityScenario['category'];
  readonly shouldCommitCount: number;
  readonly truePositiveCount: number;
  readonly missedShouldCommit: readonly CaptureQualityExpectedFact[];
  readonly falseCommitCount: number;
  readonly falseCommits: readonly CaptureQualityExtractedFact[];
  readonly lowConfidenceImplicationCount: number;
  readonly extractedFacts: readonly CaptureQualityExtractedFact[];
}

export interface CaptureQualityReport {
  readonly schemaVersion: 1;
  readonly probeId: typeof PROBE_ID;
  readonly runId: string;
  readonly generatedAt: string;
  readonly cwd: string;
  readonly extractorName: string;
  readonly scenarioCount: number;
  readonly totals: {
    readonly shouldCommitCount: number;
    readonly truePositiveCount: number;
    readonly missedShouldCommitCount: number;
    readonly falseCommitCount: number;
    readonly lowConfidenceImplicationCount: number;
    readonly precision: number;
    readonly recall: number;
  };
  readonly scenarioResults: readonly CaptureQualityScenarioResult[];
  readonly verdict: {
    readonly a22ConfidenceShift: string;
    readonly recommendation: CaptureRecommendation;
    readonly summary: string;
  };
  readonly artifacts?: CaptureQualityArtifacts;
}

export interface CaptureQualityArtifacts {
  readonly runDir: string;
  readonly scenariosJson: string;
  readonly extractionsJson: string;
  readonly reportJson: string;
  readonly verdictMarkdown: string;
}

export const CAPTURE_QUALITY_SCENARIOS: readonly CaptureQualityScenario[] = [
  {
    id: 'free-prose-launch-goal',
    label: 'Free prose with explicit acceptance facts',
    category: 'free_prose',
    input:
      'We are building a local spec workspace for solo developers. The first useful outcome is that it should help capture project goals without forcing people into a rigid template. Success means a new contributor can read the graph and explain what problem the project solves.',
    expectedFacts: [
      {
        id: 'workspace-for-solo-developers',
        kind: 'context',
        title: 'The product is for solo developers working in a local spec workspace.',
        shouldCommit: true,
        rationale: 'Direct statement of audience and workspace setting.',
      },
      {
        id: 'capture-goals-without-template',
        kind: 'goal',
        title: 'Capture project goals without forcing a rigid template.',
        shouldCommit: true,
        rationale: 'Directly stated useful outcome.',
      },
      {
        id: 'new-contributor-explains-problem',
        kind: 'criterion',
        title: 'A new contributor can read the graph and explain the problem solved.',
        shouldCommit: true,
        rationale: 'Explicit success criterion.',
      },
    ],
  },
  {
    id: 'file-ref-bearing-answer',
    label: 'Answer grounded in a referenced file',
    category: 'file_ref',
    input:
      'Use docs/architecture/prd.md as the product frame. The non-negotiable is that graph truth must stay in SQLite under .brunch, while transcript evidence can remain JSONL as long as replay can recover the structured exchange results.',
    expectedFacts: [
      {
        id: 'prd-is-product-frame',
        kind: 'context',
        title: 'docs/architecture/prd.md is the product frame for this answer.',
        shouldCommit: true,
        rationale: 'Direct source/reference grounding.',
      },
      {
        id: 'graph-truth-sqlite-brunch',
        kind: 'constraint',
        title: 'Graph truth must stay in SQLite under .brunch.',
        shouldCommit: true,
        rationale: 'Directly labeled as non-negotiable.',
      },
      {
        id: 'jsonl-ok-if-replay-recovers-exchanges',
        kind: 'criterion',
        title: 'JSONL transcript evidence is acceptable only if replay recovers structured exchange results.',
        shouldCommit: true,
        rationale: 'Explicit conditional acceptance criterion.',
      },
      {
        id: 'must-build-full-replay-engine-now',
        kind: 'requirement',
        title: 'Build a full replay engine immediately.',
        shouldCommit: false,
        rationale: 'This is an implication beyond the stated condition.',
      },
    ],
  },
  {
    id: 'implication-heavy-no-overcommit',
    label: 'Implication-heavy answer that should not over-commit',
    category: 'implication_heavy',
    input:
      'If the browser observer gets confusing, I might prefer the terminal view for the demo. The web graph is helpful, but only if it keeps up quickly enough. I have not decided whether review sets belong in the POC story.',
    expectedFacts: [
      {
        id: 'terminal-demo-preference-conditional',
        kind: 'assumption',
        title: 'The user may prefer the terminal view if the browser observer is confusing.',
        shouldCommit: false,
        rationale: 'Conditional preference, not settled graph truth.',
      },
      {
        id: 'web-helpful-if-fast',
        kind: 'criterion',
        title: 'The web graph is helpful only if it keeps up quickly enough.',
        shouldCommit: true,
        rationale: 'Clear acceptance condition for web observer usefulness.',
      },
      {
        id: 'review-sets-in-poc',
        kind: 'requirement',
        title: 'Review sets belong in the POC story.',
        shouldCommit: false,
        rationale: 'Explicitly undecided; should stay out of graph truth.',
      },
    ],
  },
];

export async function runCaptureQualityMeasurement(
  options: {
    readonly fixtureRoot?: string;
    readonly extractionFile?: string;
    readonly runId?: string;
    readonly cwd?: string;
    readonly extractorName?: string;
  } = {},
): Promise<CaptureQualityReport> {
  const fixtureRoot = resolve(
    options.fixtureRoot ?? join(dirname(fileURLToPath(import.meta.url)), '../../.fixtures'),
  );
  const extractionFile =
    options.extractionFile ?? join(fixtureRoot, 'runs', PROBE_ID, 'sample-llm-extractions.json');
  const extractions = await readScenarioExtractions(extractionFile);
  let report = summarizeCaptureQualityRun({
    runId: options.runId ?? defaultRunId(),
    generatedAt: new Date().toISOString(),
    cwd: options.cwd ?? process.cwd(),
    extractorName: options.extractorName ?? 'sample-llm-output',
    scenarios: CAPTURE_QUALITY_SCENARIOS,
    extractions,
  });
  report = {
    ...report,
    artifacts: await writeCaptureQualityArtifacts({
      fixtureRoot,
      report,
      scenarios: CAPTURE_QUALITY_SCENARIOS,
      extractions,
    }),
  };
  return report;
}

export function summarizeCaptureQualityRun(input: {
  readonly runId: string;
  readonly generatedAt: string;
  readonly cwd: string;
  readonly extractorName: string;
  readonly scenarios: readonly CaptureQualityScenario[];
  readonly extractions: readonly CaptureQualityScenarioExtraction[];
}): CaptureQualityReport {
  const extractionByScenario = new Map(input.extractions.map((entry) => [entry.scenarioId, entry]));
  const scenarioResults = input.scenarios.map((scenario) =>
    summarizeScenario(scenario, extractionByScenario.get(scenario.id)?.facts ?? []),
  );
  const totals = scenarioResults.reduce(
    (acc, result) => ({
      shouldCommitCount: acc.shouldCommitCount + result.shouldCommitCount,
      truePositiveCount: acc.truePositiveCount + result.truePositiveCount,
      missedShouldCommitCount: acc.missedShouldCommitCount + result.missedShouldCommit.length,
      falseCommitCount: acc.falseCommitCount + result.falseCommitCount,
      lowConfidenceImplicationCount: acc.lowConfidenceImplicationCount + result.lowConfidenceImplicationCount,
    }),
    {
      shouldCommitCount: 0,
      truePositiveCount: 0,
      missedShouldCommitCount: 0,
      falseCommitCount: 0,
      lowConfidenceImplicationCount: 0,
    },
  );
  const precisionDenominator = totals.truePositiveCount + totals.falseCommitCount;
  const precision = precisionDenominator === 0 ? 0 : round(totals.truePositiveCount / precisionDenominator);
  const recall =
    totals.shouldCommitCount === 0 ? 0 : round(totals.truePositiveCount / totals.shouldCommitCount);
  const verdict = verdictFor({ ...totals, precision, recall });

  return {
    schemaVersion: 1,
    probeId: PROBE_ID,
    runId: input.runId,
    generatedAt: input.generatedAt,
    cwd: input.cwd,
    extractorName: input.extractorName,
    scenarioCount: input.scenarios.length,
    totals: { ...totals, precision, recall },
    scenarioResults,
    verdict,
  };
}

export async function writeCaptureQualityArtifacts(options: {
  readonly fixtureRoot: string;
  readonly report: CaptureQualityReport;
  readonly scenarios: readonly CaptureQualityScenario[];
  readonly extractions: readonly CaptureQualityScenarioExtraction[];
}): Promise<CaptureQualityArtifacts> {
  const runDirRef = `runs/${PROBE_ID}/${options.report.runId}`;
  const artifacts: CaptureQualityArtifacts = {
    runDir: runDirRef,
    scenariosJson: `${runDirRef}/scenarios.json`,
    extractionsJson: `${runDirRef}/extractions.json`,
    reportJson: `${runDirRef}/report.json`,
    verdictMarkdown: `${runDirRef}/verdict.md`,
  };
  const diskPath = (ref: string) => resolve(options.fixtureRoot, ref);
  const report = { ...options.report, cwd: portableCwd(options.report.cwd), artifacts };

  await mkdir(diskPath(artifacts.runDir), { recursive: true });
  await writeFile(
    diskPath(artifacts.scenariosJson),
    `${JSON.stringify(options.scenarios, null, 2)}\n`,
    'utf8',
  );
  await writeFile(
    diskPath(artifacts.extractionsJson),
    `${JSON.stringify(options.extractions, null, 2)}\n`,
    'utf8',
  );
  await writeFile(diskPath(artifacts.reportJson), `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  await writeFile(diskPath(artifacts.verdictMarkdown), verdictMarkdown(report), 'utf8');

  return artifacts;
}

function summarizeScenario(
  scenario: CaptureQualityScenario,
  extractedFacts: readonly CaptureQualityExtractedFact[],
): CaptureQualityScenarioResult {
  const expectedById = new Map(scenario.expectedFacts.map((fact) => [fact.id, fact]));
  const highConfidence = extractedFacts.filter((fact) => fact.confidence === 'high');
  const truePositiveIds = new Set(
    highConfidence.flatMap((fact) => {
      const expected = fact.expectedId === undefined ? undefined : expectedById.get(fact.expectedId);
      return expected?.shouldCommit === true ? [expected.id] : [];
    }),
  );
  const falseCommits = highConfidence.filter((fact) => {
    if (fact.expectedId === undefined) return true;
    return expectedById.get(fact.expectedId)?.shouldCommit !== true;
  });
  const shouldCommitFacts = scenario.expectedFacts.filter((fact) => fact.shouldCommit);
  const missedShouldCommit = shouldCommitFacts.filter((fact) => !truePositiveIds.has(fact.id));
  const lowConfidenceImplicationCount = extractedFacts.filter((fact) => {
    if (fact.confidence !== 'low' || fact.expectedId === undefined) return false;
    return expectedById.get(fact.expectedId)?.shouldCommit === false;
  }).length;

  return {
    scenarioId: scenario.id,
    label: scenario.label,
    category: scenario.category,
    shouldCommitCount: shouldCommitFacts.length,
    truePositiveCount: truePositiveIds.size,
    missedShouldCommit,
    falseCommitCount: falseCommits.length,
    falseCommits,
    lowConfidenceImplicationCount,
    extractedFacts,
  };
}

function verdictFor(totals: CaptureQualityReport['totals']): CaptureQualityReport['verdict'] {
  if (totals.falseCommitCount > 0) {
    return {
      a22ConfidenceShift:
        'negative: the measured extractor committed at least one low-confidence implication',
      recommendation: 'keep_parked',
      summary:
        'Do not graduate generalized capture until the extraction prompt/model can keep undecided implications out of high-confidence graph truth.',
    };
  }
  if (totals.recall < 0.8) {
    return {
      a22ConfidenceShift: 'mixed: precision held, but recall missed too many directly stated facts',
      recommendation: 'narrow',
      summary:
        'Generalized capture can be narrowed to high-confidence directly extractive facts, but should not broaden until recall improves.',
    };
  }
  return {
    a22ConfidenceShift: 'positive: high-confidence capture separated commit-worthy facts from implications',
    recommendation: 'graduate',
    summary:
      'A22-L is fit to graduate into a narrow generalized-capture frontier, preserving an explicit false-commit guard.',
  };
}

async function readScenarioExtractions(path: string): Promise<CaptureQualityScenarioExtraction[]> {
  return JSON.parse(await readFile(path, 'utf8')) as CaptureQualityScenarioExtraction[];
}

function verdictMarkdown(report: CaptureQualityReport): string {
  return `# Capture-quality verdict\n\n- A22-L confidence shift: ${report.verdict.a22ConfidenceShift}\n- Recommendation: ${report.verdict.recommendation}\n- Precision: ${report.totals.precision}\n- Recall: ${report.totals.recall}\n- False commits: ${report.totals.falseCommitCount}\n\n${report.verdict.summary}\n`;
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function defaultRunId(): string {
  return new Date().toISOString().replaceAll(':', '-').replaceAll('.', '-');
}

function parseCliArgs(argv: readonly string[]): Parameters<typeof runCaptureQualityMeasurement>[0] {
  const options: Record<string, string> = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg !== undefined && arg.startsWith('--')) {
      options[arg.slice(2)] = requiredValue(argv, (index += 1), arg);
    }
  }
  return {
    ...(options['fixture-root'] !== undefined ? { fixtureRoot: options['fixture-root'] } : {}),
    ...(options['extraction-file'] !== undefined ? { extractionFile: options['extraction-file'] } : {}),
    ...(options['run-id'] !== undefined ? { runId: options['run-id'] } : {}),
    ...(options.cwd !== undefined ? { cwd: options.cwd } : {}),
    ...(options['extractor-name'] !== undefined ? { extractorName: options['extractor-name'] } : {}),
  };
}

function requiredValue(argv: readonly string[], index: number, flag: string): string {
  const value = argv[index];
  if (value === undefined) {
    throw new Error(`${flag} requires a value`);
  }
  return value;
}

async function main(): Promise<void> {
  const report = await runCaptureQualityMeasurement(parseCliArgs(process.argv.slice(2)));
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  process.exitCode = report.verdict.recommendation === 'keep_parked' ? 1 : 0;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
}
