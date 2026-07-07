import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { fauxAssistantMessage, registerFauxProvider, type Context } from '@earendil-works/pi-ai';
import { AuthStorage, createAgentSessionRuntime, ModelRegistry } from '@earendil-works/pi-coding-agent';

import {
  createBrunchAgentSessionRuntimeFactory,
  runBrunchTui,
  type BrunchAgentServicesOverride,
} from '../app/brunch-tui.js';
import { openWorkspaceGraphRuntime, type CommandExecutor } from '../graph/index.js';
import {
  BRUNCH_FAUX_HARNESS_API_KEY,
  brunchFauxProviderConfig,
  defaultBrunchFauxModel,
} from '../probes/faux-provider.js';
import { flushSessionManagerToFile } from '../session/flush-session-manager.js';
import { writeDebugSessionTranscript } from '../session/session-transcript.js';
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
  readonly debugTranscriptFile: string;
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
        flushSessionManagerToFile(workspace.session.manager, workspace.session.file);
      } finally {
        harness.dispose();
      }
    },
  });

  if (!sessionFile) throw new Error('Tier-2 real boot did not activate a session file.');
  const transcriptEntries = parseJsonl(await readFile(sessionFile, 'utf8'));
  await writeDebugSessionTranscript({ cwd, sessionFile });
  return {
    cwd,
    sessionFile,
    prompt,
    assistantText,
    providerPayload,
    providerContexts: providerPayload === undefined ? [] : [providerPayload],
    activeToolNames: providerPayload?.activeToolNames ?? [],
    transcriptEntries,
    debugTranscriptFile: join(cwd, '.brunch', 'debug', 'transcript.md'),
  };
}

/**
 * Card 5: harnesses that build a runtime via `createAgentSessionRuntime`
 * never enter a Pi run mode, so `session.bindExtensions(...)` never fires
 * and the session-orientation registrar's boot handler (`session_start`
 * reason `startup`, the J1 juncture) never runs — meaning no orientation
 * dialog, no `brunch.session_orientation` entry, and no kick. Production
 * paths (`InteractiveMode`, RPC, print) call `bindExtensions` inside their
 * `run()` method with a real UI context; test harnesses have no such
 * context, so this helper binds extensions with no `uiContext`, matching
 * the pinned no-UI degraded row of the chart: `hasUI === false` ⇒ no
 * dialog, no entry, kick still fires via the default boot path.
 *
 * This is the explicit "harness answers or degrades J1" contract from
 * `memory/cards/session-entry-orientation--slices.md` Card 5 — real TUI
 * behaviour stays user-driven; RPC keeps its 60s timeout floor; only the
 * harness picks the degraded path, deterministically.
 */
export async function emitStartupOrientationForHarness(runtime: {
  readonly session: { readonly bindExtensions: (bindings: Record<string, never>) => Promise<void> };
}): Promise<void> {
  await runtime.session.bindExtensions({});
}

export async function bootTier2RuntimeThroughRunBrunchTui(options: {
  readonly dev: boolean;
  readonly agentServices?: BrunchAgentServicesOverride;
}) {
  const cwd = await mkdtemp(join(tmpdir(), `brunch-boot-seam-${options.dev ? 'dev' : 'prod'}-`));
  const agentDir = await mkdtemp(join(tmpdir(), 'brunch-agent-dir-'));
  await writeFile(join(cwd, 'boot-seam.md'), '# Boot seam\n');

  const restoreEnv = () => {};

  let runtime: Awaited<ReturnType<typeof createAgentSessionRuntime>> | undefined;
  try {
    await runBrunchTui({
      cwd,
      debugMirror: options.dev,
      developerTools: options.dev,
      runWorkspaceDialogPreflight: async () => ({ action: 'newSpec', title: 'Boot seam smoke' }),
      webSidecarRunner: async () => null,
      launchInteractive: async (context) => {
        runtime = await createAgentSessionRuntime(
          createBrunchAgentSessionRuntimeFactory({
            ...context,
            agentServices: options.agentServices ?? createNoModelAgentServices(),
          }),
          {
            cwd,
            agentDir,
            sessionManager: context.workspace.session.manager,
          },
        );
        await emitStartupOrientationForHarness(runtime);
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

export type Tier2FixtureEntry =
  | { readonly type: 'message'; readonly message: unknown }
  | { readonly type: 'custom'; readonly customType: string; readonly data: unknown }
  | {
      readonly type: 'custom_message';
      readonly customType: string;
      readonly content: string;
      readonly details: unknown;
    };

/**
 * Boot the real runBrunchTui runtime over a pre-seeded fixture transcript —
 * the resume-side counterpart of bootTier2RuntimeThroughRunBrunchTui. The
 * fixture builder receives the created spec id so continuity entries can
 * carry real {specId, lsn} facts.
 */
export async function bootTier2RuntimeFromFixture(options: {
  readonly fixtureEntries: (specId: number) => readonly Tier2FixtureEntry[];
  readonly specTitle?: string;
  readonly dev?: boolean;
  readonly agentDir?: string;
  /** Faux backend so resume-kick decisions are observable as real turns. */
  readonly agentServices?: BrunchAgentServicesOverride;
}) {
  const cwd = await mkdtemp(join(tmpdir(), 'brunch-tier-2-resume-boot-'));
  const agentDir = options.agentDir ?? (await mkdtemp(join(tmpdir(), 'brunch-agent-dir-')));

  const restoreEnv = () => {};

  try {
    const coordinator = createWorkspaceSessionCoordinator({ cwd });
    const workspace = await coordinator.createSetupSession({
      specTitle: options.specTitle ?? 'Tier 2 resume fixture spec',
      createNewSpec: true,
    });
    for (const entry of options.fixtureEntries(workspace.spec.id)) {
      if (entry.type === 'custom') {
        workspace.session.manager.appendCustomEntry(entry.customType, entry.data);
      } else if (entry.type === 'custom_message') {
        workspace.session.manager.appendCustomMessageEntry(
          entry.customType,
          entry.content,
          false,
          entry.details,
        );
      } else {
        workspace.session.manager.appendMessage(entry.message as never);
      }
    }
    flushSessionManagerToFile(workspace.session.manager, workspace.session.file);

    let runtime: Awaited<ReturnType<typeof createAgentSessionRuntime>> | undefined;
    await runBrunchTui({
      cwd,
      debugMirror: options.dev === true,
      developerTools: options.dev === true,
      coordinator,
      runWorkspaceDialogPreflight: async () => ({
        action: 'openSession',
        specId: workspace.spec.id,
        sessionFile: workspace.session.file,
      }),
      webSidecarRunner: async () => null,
      launchInteractive: async (context) => {
        runtime = await createAgentSessionRuntime(
          createBrunchAgentSessionRuntimeFactory({
            ...context,
            agentServices: options.agentServices ?? createNoModelAgentServices(),
          }),
          {
            cwd,
            agentDir,
            sessionManager: context.workspace.session.manager,
          },
        );
        await emitStartupOrientationForHarness(runtime);
      },
    });
    if (!runtime) {
      restoreEnv();
      throw new Error('runBrunchTui did not reach launchInteractive for the fixture resume boot');
    }
    return { cwd, specId: workspace.spec.id, sessionFile: workspace.session.file, runtime, restoreEnv };
  } catch (error) {
    restoreEnv();
    throw error;
  }
}

/**
 * Re-boot the real runtime over an existing session — the actual-restart half
 * of the I47 idempotence proof. Pi defers JSONL writes until an assistant
 * message exists, so the prior runtime's entries are flushed to the session
 * file first; the reboot then reads continuity purely from transcript
 * projection (no hidden flags survive the restart).
 */
/**
 * Faux provider + in-memory auth/registry packaged as the product factory's
 * `agentServices` override. Only the provider backend is substituted; the
 * session, extensions, and origination choreography stay product wiring.
 */
/**
 * Run a test body against registered faux agent services, unregistering the
 * faux provider on the way out — the with-style form of
 * `createTier2FauxAgentServices` for tests that boot multiple runtimes.
 */
export async function withTier2FauxAgentServices<T>(
  fn: (faux: ReturnType<typeof createTier2FauxAgentServices>) => Promise<T>,
): Promise<T> {
  const faux = createTier2FauxAgentServices();
  try {
    return await fn(faux);
  } finally {
    faux.unregister();
  }
}

function createNoModelAgentServices(): BrunchAgentServicesOverride {
  const authStorage = AuthStorage.inMemory({});
  const modelRegistry = ModelRegistry.inMemory(authStorage);
  modelRegistry.getAvailable = () => [];
  return { authStorage, modelRegistry };
}

export function createTier2FauxAgentServices(options: { readonly responseText?: string } = {}): {
  readonly agentServices: BrunchAgentServicesOverride;
  readonly providerContexts: readonly ProviderContextSnapshot[];
  readonly unregister: () => void;
} {
  const model = defaultBrunchFauxModel();
  const provider = registerFauxProvider({
    provider: model.provider,
    api: `${model.api}-faux-source`,
    models: [{ id: model.modelId, name: model.modelName, input: ['text'] }],
  });
  const providerContexts: ProviderContextSnapshot[] = [];
  provider.setResponses([
    (context: Context) => {
      providerContexts.push(snapshotProviderContext(context));
      return fauxAssistantMessage(options.responseText ?? 'Opening offer from the product-originated turn.');
    },
  ]);
  const authStorage = AuthStorage.inMemory({
    [model.provider]: { type: 'api_key', key: BRUNCH_FAUX_HARNESS_API_KEY },
  });
  const modelRegistry = ModelRegistry.inMemory(authStorage);
  modelRegistry.registerProvider(
    model.provider,
    brunchFauxProviderConfig(model, provider, BRUNCH_FAUX_HARNESS_API_KEY),
  );
  const registeredModel = modelRegistry.find(model.provider, model.modelId);
  if (!registeredModel) {
    provider.unregister();
    throw new Error(`Tier-2 faux model was not registered: ${model.provider}/${model.modelId}`);
  }
  return {
    agentServices: { authStorage, modelRegistry, model: registeredModel },
    providerContexts,
    unregister: () => provider.unregister(),
  };
}

/**
 * The origination-kick-live oracle boot: enter through the real runBrunchTui
 * path with a faux provider substituted at the agentServices seam, and wait
 * for the product itself to originate the opening turn. This function never
 * calls `session.prompt` — a provider capture here proves the product kicked
 * on its own bones.
 */
export async function bootTier2ProductOriginatedTurn(
  options: {
    readonly activation?: 'newSpec' | 'pickerNewSession';
    readonly responseText?: string;
    readonly waitForProviderCallMs?: number | false;
    readonly dev?: boolean;
    /** Seed graph truth into the picker-path spec before boot (pickerNewSession only). */
    readonly seedGraph?: (executor: CommandExecutor, specId: number) => void;
  } = {},
) {
  const cwd = await mkdtemp(join(tmpdir(), 'brunch-kick-live-'));
  const agentDir = await mkdtemp(join(tmpdir(), 'brunch-agent-dir-'));

  const restoreEnv = () => {};

  const faux = createTier2FauxAgentServices(
    options.responseText === undefined ? {} : { responseText: options.responseText },
  );
  try {
    const coordinator = createWorkspaceSessionCoordinator({ cwd });
    let preflight: { action: 'newSpec'; title: string } | { action: 'newSession'; specId: number };
    if (options.activation === 'pickerNewSession') {
      const setup = await coordinator.createSetupSession({
        specTitle: 'Kick live picker spec',
        createNewSpec: true,
      });
      if (options.seedGraph) {
        const graphRuntime = await openWorkspaceGraphRuntime(cwd);
        options.seedGraph(graphRuntime.commandExecutor, setup.spec.id);
      }
      preflight = { action: 'newSession', specId: setup.spec.id };
    } else {
      preflight = { action: 'newSpec', title: 'Kick live spec' };
    }

    let runtime: Awaited<ReturnType<typeof createAgentSessionRuntime>> | undefined;
    let sessionFile: string | undefined;
    let specId: number | undefined;
    await runBrunchTui({
      cwd,
      coordinator,
      runWorkspaceDialogPreflight: async () => preflight,
      webSidecarRunner: async () => null,
      launchInteractive: async (context) => {
        sessionFile = context.workspace.session.file;
        specId = context.workspace.spec.id;
        runtime = await createAgentSessionRuntime(
          createBrunchAgentSessionRuntimeFactory({ ...context, agentServices: faux.agentServices }),
          { cwd, agentDir, sessionManager: context.workspace.session.manager },
        );
        await emitStartupOrientationForHarness(runtime);
      },
    });
    if (!runtime || !sessionFile || specId === undefined) {
      throw new Error('runBrunchTui did not reach launchInteractive for the product-originated boot');
    }

    if (options.waitForProviderCallMs !== false) {
      await waitForCondition(
        () => faux.providerContexts.length > 0,
        options.waitForProviderCallMs ?? 8000,
        'product-originated provider call (the kick never fired)',
      );
    }

    return {
      cwd,
      specId,
      sessionFile,
      runtime,
      providerContexts: faux.providerContexts,
      agentServices: faux.agentServices,
      restoreEnv,
      dispose: async () => {
        await runtime!.dispose();
        faux.unregister();
        restoreEnv();
      },
    };
  } catch (error) {
    faux.unregister();
    restoreEnv();
    throw error;
  }
}

export async function waitForCondition(
  predicate: () => boolean,
  timeoutMs: number,
  what: string,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (!predicate()) {
    if (Date.now() > deadline) throw new Error(`Timed out after ${timeoutMs}ms waiting for ${what}`);
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
}

export async function rebootTier2Runtime(options: {
  readonly cwd: string;
  readonly specId: number;
  readonly sessionFile: string;
  readonly flushManager?: unknown;
  readonly agentServices?: BrunchAgentServicesOverride;
}) {
  if (options.flushManager) flushSessionManagerToFile(options.flushManager, options.sessionFile);
  const coordinator = createWorkspaceSessionCoordinator({ cwd: options.cwd });
  const agentDir = await mkdtemp(join(tmpdir(), 'brunch-agent-dir-'));
  let runtime: Awaited<ReturnType<typeof createAgentSessionRuntime>> | undefined;
  await runBrunchTui({
    cwd: options.cwd,
    coordinator,
    runWorkspaceDialogPreflight: async () => ({
      action: 'openSession',
      specId: options.specId,
      sessionFile: options.sessionFile,
    }),
    webSidecarRunner: async () => null,
    launchInteractive: async (context) => {
      runtime = await createAgentSessionRuntime(
        createBrunchAgentSessionRuntimeFactory({
          ...context,
          agentServices: options.agentServices ?? createNoModelAgentServices(),
        }),
        {
          cwd: options.cwd,
          agentDir,
          sessionManager: context.workspace.session.manager,
        },
      );
      await emitStartupOrientationForHarness(runtime);
    },
  });
  if (!runtime) throw new Error('runBrunchTui did not reach launchInteractive for the reboot');
  return { runtime };
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
  flushSessionManagerToFile(workspace.session.manager, workspace.session.file);
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
