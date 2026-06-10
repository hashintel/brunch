import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { fauxAssistantMessage, type Context } from '@earendil-works/pi-ai';
import { createAgentSessionRuntime } from '@earendil-works/pi-coding-agent';

import { createBrunchAgentSessionRuntimeFactory, runBrunchTui } from '../app/brunch-tui.js';
import { renderSessionTranscriptFile } from '../session/session-transcript.js';
import { createWorkspaceSessionCoordinator } from '../session/workspace-session-coordinator.js';
import { latestAssistantText } from './agent-messages.js';
import {
  createBrunchFauxHarness,
  snapshotProviderContext,
  type ProviderContextSnapshot,
} from './faux-harness.js';

export interface Tier2RealBootTurnResult {
  readonly cwd: string;
  readonly sessionFile: string;
  readonly prompt: string;
  readonly assistantText: string;
  readonly providerPayload: ProviderContextSnapshot | undefined;
  readonly providerContexts: readonly ProviderContextSnapshot[];
  readonly activeToolNames: readonly string[];
  readonly transcriptEntries: readonly unknown[];
  readonly renderedTranscript: string;
}

export async function runTier2RealBootFauxTurn(
  options: {
    readonly cwd?: string;
    readonly specTitle?: string;
    readonly prompt?: string;
    readonly responseText?: string;
  } = {},
): Promise<Tier2RealBootTurnResult> {
  const cwd = options.cwd ?? (await mkdtemp(join(tmpdir(), 'brunch-tier-2-')));
  const specTitle = options.specTitle ?? 'Tier 2 scaffold spec';
  const prompt = options.prompt ?? 'Run the FE-847 Tier-2 faux turn.';
  const responseText = options.responseText ?? 'FE-847 faux turn complete.';
  const coordinator = createWorkspaceSessionCoordinator({ cwd });
  let sessionFile: string | undefined;
  let providerPayload: ProviderContextSnapshot | undefined;
  let assistantText = '';

  await runBrunchTui({
    cwd,
    autoOpen: false,
    coordinator,
    selectSpecTitle: async () => specTitle,
    webSidecarRunner: async () => null,
    launchInteractive: async ({ workspace }) => {
      sessionFile = workspace.session.file;
      const harness = await createBrunchFauxHarness({
        cwd,
        responses: [
          (context: Context) => {
            providerPayload = snapshotProviderContext(context);
            return fauxAssistantMessage(responseText);
          },
        ],
      });
      try {
        await harness.session.prompt(prompt, { expandPromptTemplates: false, source: 'rpc' });
        assistantText = latestAssistantText(harness.session.messages);
        for (const message of harness.session.messages) {
          workspace.session.manager.appendMessage(message as never);
        }
        flushSessionEntries(workspace.session.manager, workspace.session.file);
      } finally {
        harness.dispose();
      }
    },
  });

  if (!sessionFile) throw new Error('Tier-2 real boot did not activate a session file.');
  const transcriptEntries = parseJsonl(await readFile(sessionFile, 'utf8'));
  return {
    cwd,
    sessionFile,
    prompt,
    assistantText,
    providerPayload,
    providerContexts: providerPayload === undefined ? [] : [providerPayload],
    activeToolNames: providerPayload?.activeToolNames ?? [],
    transcriptEntries,
    renderedTranscript: await renderSessionTranscriptFile(sessionFile),
  };
}

export async function bootTier2RuntimeThroughRunBrunchTui(options: { readonly dev: boolean }) {
  const cwd = await mkdtemp(join(tmpdir(), `brunch-boot-seam-${options.dev ? 'dev' : 'prod'}-`));
  const agentDir = await mkdtemp(join(tmpdir(), 'brunch-agent-dir-'));
  await writeFile(join(cwd, 'boot-seam.md'), '# Boot seam\n');

  const previousDev = process.env.BRUNCH_DEV;
  const hadPreviousDev = Object.hasOwn(process.env, 'BRUNCH_DEV');
  if (options.dev) {
    process.env.BRUNCH_DEV = '1';
  } else {
    delete process.env.BRUNCH_DEV;
  }

  const restoreEnv = () => {
    if (hadPreviousDev && previousDev !== undefined) {
      process.env.BRUNCH_DEV = previousDev;
    } else {
      delete process.env.BRUNCH_DEV;
    }
  };

  let runtime: Awaited<ReturnType<typeof createAgentSessionRuntime>> | undefined;
  try {
    await runBrunchTui({
      cwd,
      autoOpen: false,
      runWorkspaceDialogPreflight: async () => ({ action: 'newSpec', title: 'Boot seam smoke' }),
      webSidecarRunner: async () => null,
      launchInteractive: async (context) => {
        runtime = await createAgentSessionRuntime(createBrunchAgentSessionRuntimeFactory(context), {
          cwd,
          agentDir,
          sessionManager: context.workspace.session.manager,
        });
      },
    });
  } catch (error) {
    restoreEnv();
    throw error;
  }

  if (!runtime) {
    restoreEnv();
    throw new Error('runBrunchTui did not reach launchInteractive');
  }

  return { cwd, runtime, restoreEnv };
}

export async function resumeTier2Fixture(options: {
  readonly cwd?: string;
  readonly fixtureJsonl: string;
  readonly specTitle?: string;
}): Promise<{
  readonly cwd: string;
  readonly originalSessionFile: string;
  readonly sessionFile: string;
  readonly resumedSameSessionFile: boolean;
  readonly transcriptEntries: readonly unknown[];
}> {
  const cwd = options.cwd ?? (await mkdtemp(join(tmpdir(), 'brunch-tier-2-resume-')));
  const coordinator = createWorkspaceSessionCoordinator({ cwd });
  const workspace = await coordinator.createSetupSession({
    specTitle: options.specTitle ?? 'Tier 2 fixture spec',
    createNewSpec: true,
  });
  for (const entry of parseJsonl(options.fixtureJsonl)) {
    workspace.session.manager.appendMessage(entry as never);
  }
  flushSessionEntries(workspace.session.manager, workspace.session.file);
  const resumed = await coordinator.activateWorkspace({
    action: 'openSession',
    specId: workspace.spec.id,
    sessionFile: workspace.session.file,
  });
  if (resumed.status !== 'ready') throw new Error('Tier-2 fixture resume did not return a ready session.');
  return {
    cwd,
    originalSessionFile: workspace.session.file,
    sessionFile: resumed.session.file,
    resumedSameSessionFile: resumed.session.file === workspace.session.file,
    transcriptEntries: parseJsonl(await readFile(resumed.session.file, 'utf8')),
  };
}

function parseJsonl(jsonl: string): readonly unknown[] {
  return jsonl
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line) as unknown);
}

interface FlushableSessionManager {
  _rewriteFile(): void;
  setSessionFile(file: string): void;
}

function flushSessionEntries(manager: unknown, sessionFile: string): void {
  const flushable = manager as FlushableSessionManager;
  flushable._rewriteFile();
  flushable.setSessionFile(sessionFile);
}
