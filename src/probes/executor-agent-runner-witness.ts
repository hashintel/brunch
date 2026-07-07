import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';

import { fauxAssistantMessage, fauxToolCall } from '@earendil-works/pi-ai';
import { registerFauxProvider } from '@earendil-works/pi-ai/compat';
import { AuthStorage, ModelRegistry } from '@earendil-works/pi-coding-agent';

import {
  loadSubagentConfig,
  loadSubagentDefinitions,
  subagentAgentsDir,
  subagentConfigPath,
} from '../.pi/extensions/subagents/index.js';
import type { BrunchSubagentsDeps } from '../.pi/extensions/subagents/index.js';
import { createAgentRunnerPort } from '../app/agent-runner-port.js';
import { brunchResourceLoaderOptions, createBrunchSettingsManager } from '../app/pi-settings.js';
import {
  BRUNCH_FAUX_HARNESS_API_KEY,
  brunchFauxProviderConfig,
  defaultBrunchFauxModel,
} from './faux-provider.js';

const PROBE_ID = 'executor-agent-runner-witness';

export interface ExecutorAgentRunnerWitnessReport {
  readonly schemaVersion: 1;
  readonly probeId: typeof PROBE_ID;
  readonly runId: string;
  readonly worktreeChanged: boolean;
  readonly workerSummary: string;
  readonly toolNames: readonly string[];
  readonly artifacts?: {
    readonly runDir: string;
    readonly requestJson: string;
    readonly resultJson: string;
    readonly worktreeProofTxt: string;
    readonly reportJson: string;
  };
}

export async function runExecutorAgentRunnerWitness(
  options: {
    readonly fixtureRoot?: string;
    readonly runId?: string;
  } = {},
): Promise<ExecutorAgentRunnerWitnessReport> {
  const runId = options.runId ?? new Date().toISOString().replace(/[:]/gu, '-');
  assertPortableRunId(runId);
  const worktreeDir = await mkdtemp(join(tmpdir(), 'brunch-executor-agent-worker-'));
  const requestPath = join(worktreeDir, 'request.json');
  const resultPath = join(worktreeDir, 'result.json');
  await writeFile(requestPath, JSON.stringify({ task: 'write worker-proof.txt' }), 'utf8');

  const model = defaultBrunchFauxModel();
  const provider = registerFauxProvider({
    provider: model.provider,
    api: `${model.api}-executor-agent-runner-witness`,
    models: [{ id: model.modelId, name: model.modelName, input: ['text'] }],
  });
  const toolNames: string[][] = [];
  provider.setResponses([
    (context) => {
      toolNames.push((context.tools ?? []).map((tool) => tool.name));
      return fauxAssistantMessage(
        [
          fauxToolCall(
            'write_worktree_file',
            { path: 'worker-proof.txt', content: 'changed by sealed worker\n' },
            { id: 'write-proof' },
          ),
        ],
        { stopReason: 'toolUse' },
      );
    },
    (context) => {
      toolNames.push((context.tools ?? []).map((tool) => tool.name));
      return fauxAssistantMessage('Wrote worker-proof.txt');
    },
  ]);

  try {
    const authStorage = AuthStorage.inMemory({
      [model.provider]: { type: 'api_key', key: BRUNCH_FAUX_HARNESS_API_KEY },
    });
    const modelRegistry = ModelRegistry.inMemory(authStorage);
    modelRegistry.registerProvider(
      model.provider,
      brunchFauxProviderConfig(model, provider, BRUNCH_FAUX_HARNESS_API_KEY),
    );
    const registeredModel = modelRegistry.find(model.provider, model.modelId);
    if (!registeredModel) throw new Error('faux model not registered');
    const subagents = await loadWitnessSubagents(worktreeDir);
    const port = createAgentRunnerPort({ subagents });
    const result = await port.run({
      worktreeDir,
      requestPath,
      resultPath,
      runId,
      epicId: 'frontier-1',
      sliceId: 'task-1',
      runtime: { modelRegistry, model: registeredModel },
    });
    if (result.status === 'failed') throw new Error(result.message);
    const proof = await readFile(join(worktreeDir, 'worker-proof.txt'), 'utf8');
    const report: ExecutorAgentRunnerWitnessReport = {
      schemaVersion: 1,
      probeId: PROBE_ID,
      runId,
      worktreeChanged: proof === 'changed by sealed worker\n',
      workerSummary: result.summary ?? '',
      toolNames: [...new Set(toolNames.flat())].sort(),
    };
    return options.fixtureRoot
      ? await writeArtifacts(options.fixtureRoot, report, { requestPath, resultPath, worktreeDir })
      : report;
  } finally {
    provider.unregister();
  }
}

async function loadWitnessSubagents(cwd: string): Promise<BrunchSubagentsDeps> {
  const [definitions, config] = await Promise.all([
    loadSubagentDefinitions(subagentAgentsDir()),
    loadSubagentConfig(subagentConfigPath()),
  ]);
  return {
    definitions,
    delegatableAgents: [],
    maxConcurrency: config.maxConcurrency,
    agentDir: cwd,
    createSettingsManager: () => createBrunchSettingsManager(cwd, cwd),
    resourceLoaderOptions: brunchResourceLoaderOptions([]),
  };
}

async function writeArtifacts(
  fixtureRoot: string,
  report: ExecutorAgentRunnerWitnessReport,
  paths: { readonly requestPath: string; readonly resultPath: string; readonly worktreeDir: string },
): Promise<ExecutorAgentRunnerWitnessReport> {
  const runDir = join('runs', PROBE_ID, report.runId);
  const requestJson = join(runDir, 'request.json');
  const resultJson = join(runDir, 'result.json');
  const worktreeProofTxt = join(runDir, 'worker-proof.txt');
  const reportJson = join(runDir, 'report.json');
  const artifacts = { runDir, requestJson, resultJson, worktreeProofTxt, reportJson };
  const persisted = { ...report, artifacts } satisfies ExecutorAgentRunnerWitnessReport;
  const diskPath = (ref: string): string => resolve(fixtureRoot, ref);
  await mkdir(diskPath(runDir), { recursive: true });
  await writeFile(diskPath(requestJson), await readFile(paths.requestPath, 'utf8'), 'utf8');
  await writeFile(diskPath(resultJson), await readFile(paths.resultPath, 'utf8'), 'utf8');
  await writeFile(
    diskPath(worktreeProofTxt),
    await readFile(join(paths.worktreeDir, 'worker-proof.txt'), 'utf8'),
    'utf8',
  );
  await writeFile(diskPath(reportJson), `${JSON.stringify(persisted, null, 2)}\n`, 'utf8');
  return persisted;
}

function assertPortableRunId(runId: string): void {
  if (runId.length === 0 || basename(runId) !== runId || dirname(runId) !== '.') {
    throw new Error('Artifact runId must be a portable single path segment');
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runExecutorAgentRunnerWitness({ fixtureRoot: '.fixtures' })
    .then((report) => process.stdout.write(`${JSON.stringify(report, null, 2)}\n`))
    .catch((error: unknown) => {
      process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
      process.exitCode = 1;
    });
}
