import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';

import {
  DefaultResourceLoader,
  SessionManager,
  type ExtensionCommandContext,
  type ExtensionContext,
  type ExtensionUIContext,
  type RegisteredCommand,
} from '@earendil-works/pi-coding-agent';
import { describe, expect, it } from 'vitest';

import { groundingFloorGaps } from '../../graph/schema/elicitation-gap-fixtures.js';
import { userMessage } from '../../probes/test-helpers.js';
import {
  createWorkspaceSessionCoordinator,
  verifyWorkspaceSessionStores,
  type WorkspaceLaunchInventory,
  type WorkspaceSessionReadyState,
} from '../../session/workspace-session-coordinator.js';
import {
  BRUNCH_SETTINGS_AUDITED_GETTERS,
  BRUNCH_SETTINGS_POLICY,
  applyBrunchOfflineDefault,
  brunchResourceLoaderOptions,
  createBrunchSettingsManager,
  runBrunchTui,
  runWithScopedBrunchOfflineDefault,
  startupHeaderForActivation,
} from '../brunch-tui.js';
import { runBrunchCli } from '../brunch.js';
import {
  BRUNCH_CONTINUE_COMMAND,
  BRUNCH_EXECUTE_COOK_AGENT_RESULT_TOOL,
  BRUNCH_EXECUTE_COOK_POPULATE_TOOL,
  BRUNCH_EXECUTE_COOK_PLAN_PREVIEW_TOOL,
  BRUNCH_EXECUTE_COOK_REPORT_INIT_TOOL,
  BRUNCH_EXECUTE_COOK_SOURCE_COPY_TOOL,
  BRUNCH_EXECUTE_COOK_SLICE_COMPLETE_TOOL,
  BRUNCH_EXECUTE_COOK_SLICE_EXECUTE_TOOL,
  BRUNCH_EXECUTE_COOK_SLICE_START_TOOL,
  BRUNCH_EXECUTE_COOK_SOURCE_POLICY_TOOL,
  BRUNCH_EXECUTE_COOK_TEST_RESULT_TOOL,
  BRUNCH_EXECUTE_COOK_WORKTREE_CREATE_TOOL,
  BRUNCH_EXECUTE_PLAN_CHECK_TOOL,
  BRUNCH_EXECUTE_PLAN_DRAFT_ARTIFACT_TOOL,
  BRUNCH_EXECUTE_PLAN_DRAFT_TOOL,
  BRUNCH_EXECUTE_PLAN_OUTLINE_ARTIFACT_TOOL,
  BRUNCH_EXECUTE_PLAN_OUTLINE_TOOL,
  BRUNCH_EXECUTE_SNAPSHOT_TOOL,
  BRUNCH_EXECUTE_STATUS_TOOL,
  BRUNCH_INTROSPECTION_COMMAND,
  BRUNCH_LENS_COMMAND,
  BRUNCH_MODE_COMMAND,
  BRUNCH_STRATEGY_COMMAND,
  BRUNCH_SWITCH_COMMAND,
  BRUNCH_SWITCH_SHORTCUT,
  chromeStateForWorkspace,
  createBrunchPiExtensions,
  createInMemoryBrunchIntrospectionStore,
  registerBrunchAlternatives,
  registerBrunchOperationalModePolicy,
  runBrunchWorkspaceCommand,
  runBrunchWorkspaceAction,
} from '../pi-extensions.js';
import { createBrunchPiSettings } from '../pi-settings.js';

describe('Brunch TUI boot', () => {
  it('gates spec selection through the coordinator before launching interactive mode', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-tui-'));
    const events: string[] = [];

    await runBrunchTui({
      cwd,
      selectSpecTitle: async () => {
        events.push('select-spec');
        return 'Gated spec';
      },
      launchInteractive: async ({ workspace }) => {
        events.push(`launch:${workspace.spec.title}`);
      },
    });

    expect(events).toEqual(['select-spec', 'launch:Gated spec']);
    const oracle = await verifyWorkspaceSessionStores({
      cwd,
      expectedSessionCount: 1,
    });
    expect(oracle.ok).toBe(true);
    if (!oracle.ok) {
      expect(oracle.errors).toEqual([]);
    }
  });

  it('runs inspect, preflight, activation, and decision propagation before launching interactive mode', async () => {
    const events: string[] = [];
    const workspace = readyWorkspace('/tmp/project', 'session-ready');

    await runBrunchTui({
      cwd: '/tmp/project',
      coordinator: {
        inspectWorkspace: async () => {
          events.push('inspect');
          return {
            cwd: '/tmp/project',
            currentSpec: workspace.spec,
            currentSessionFile: workspace.session.file,
            needsNewSpec: false,
            specs: [],
            unavailableSessions: [],
          };
        },
        activateWorkspace: async (decision) => {
          events.push(`activate:${decision.action}`);
          return workspace;
        },
        bindCurrentSpecToReplacementSession: async () => workspace,
      },
      runWorkspaceDialogPreflight: async () => {
        events.push('preflight');
        return {
          action: 'continue',
          specId: workspace.spec.id,
          sessionFile: workspace.session.file,
        };
      },
      launchInteractive: async ({ workspace: launched, activationDecision }) => {
        expect(activationDecision).toBeDefined();
        events.push(`launch:${launched.session.id}:${activationDecision?.action}`);
      },
    });

    expect(events).toEqual(['inspect', 'preflight', 'activate:continue', 'launch:session-ready:continue']);
  });

  it('requests startup header chrome for every activated launch decision', () => {
    expect(
      startupHeaderForActivation({ action: 'continue', specId: 1, sessionFile: '/s/one.jsonl' }),
    ).toEqual({
      decision: 'continue',
    });
    expect(
      startupHeaderForActivation({ action: 'openSession', specId: 1, sessionFile: '/s/two.jsonl' }),
    ).toEqual({
      decision: 'openSession',
    });
    expect(startupHeaderForActivation({ action: 'newSession', specId: 1 })).toEqual({
      decision: 'newSession',
    });
    expect(startupHeaderForActivation({ action: 'newSpec', title: 'New spec' })).toEqual({
      decision: 'newSpec',
    });
    expect(startupHeaderForActivation({ action: 'cancel' })).toBeUndefined();
  });

  it('starts a web sidecar on the active spec route with the shared update publisher before interactive mode', async () => {
    const events: string[] = [];
    const workspace = readyWorkspace('/tmp/project', 'session-ready');
    let sharedPublisher:
      | {
          publish(update: unknown): void;
          subscribe(listener: (updates: readonly unknown[]) => void): () => void;
        }
      | undefined;

    await runBrunchTui({
      cwd: '/tmp/project',
      coordinator: {
        inspectWorkspace: async () => {
          events.push('inspect');
          return {
            cwd: '/tmp/project',
            currentSpec: workspace.spec,
            currentSessionFile: workspace.session.file,
            needsNewSpec: false,
            specs: [],
            unavailableSessions: [],
          };
        },
        activateWorkspace: async (decision) => {
          events.push(`activate:${decision.action}`);
          return workspace;
        },
        bindCurrentSpecToReplacementSession: async () => workspace,
      },
      runWorkspaceDialogPreflight: async () => {
        events.push('preflight');
        return {
          action: 'continue',
          specId: workspace.spec.id,
          sessionFile: workspace.session.file,
        };
      },
      webSidecarRunner: async ({ cwd, productUpdates, routePath }) => {
        events.push(`sidecar:${cwd}:${routePath}`);
        sharedPublisher = productUpdates;
        const unsubscribe = productUpdates.subscribe((updates) => {
          events.push(`update:${updates[0]?.topic}`);
        });
        return {
          url: 'http://127.0.0.1:49152',
          async close() {
            unsubscribe();
            events.push('sidecar-close');
          },
        };
      },
      launchInteractive: async ({ productUpdates }) => {
        events.push('launch');
        expect(productUpdates).toBe(sharedPublisher);
        productUpdates!.publish({ topic: 'graph.overview', specId: 1, lsn: 11 });
      },
    });

    expect(events).toEqual([
      'inspect',
      'preflight',
      'activate:continue',
      'sidecar:/tmp/project:/spec/1',
      'launch',
      'update:graph.overview',
      'sidecar-close',
    ]);
  });

  it('mirrors debug cache by default in source runs and gates query tools behind developerTools', async () => {
    const workspace = readyWorkspace('/tmp/project', 'session-ready');
    const observed: unknown[] = [];

    await runBrunchTui({
      cwd: '/tmp/project',
      coordinator: {
        inspectWorkspace: async () => ({
          cwd: '/tmp/project',
          currentSpec: workspace.spec,
          currentSessionFile: workspace.session.file,
          needsNewSpec: false,
          specs: [],
          unavailableSessions: [],
        }),
        activateWorkspace: async () => workspace,
        bindCurrentSpecToReplacementSession: async () => workspace,
      },
      developerTools: true,
      runWorkspaceDialogPreflight: async () => ({
        action: 'continue',
        specId: workspace.spec.id,
        sessionFile: workspace.session.file,
      }),
      webSidecarRunner: async () => null,
      launchInteractive: async ({ introspection }) => {
        observed.push(introspection?.queryTools);
        expect(introspection?.store).toBeDefined();
        expect(introspection?.debugCache).toEqual({ cwd: '/tmp/project' });
      },
    });

    await runBrunchTui({
      cwd: '/tmp/project',
      coordinator: {
        inspectWorkspace: async () => ({
          cwd: '/tmp/project',
          currentSpec: workspace.spec,
          currentSessionFile: workspace.session.file,
          needsNewSpec: false,
          specs: [],
          unavailableSessions: [],
        }),
        activateWorkspace: async () => workspace,
        bindCurrentSpecToReplacementSession: async () => workspace,
      },
      debugMirror: false,
      runWorkspaceDialogPreflight: async () => ({
        action: 'continue',
        specId: workspace.spec.id,
        sessionFile: workspace.session.file,
      }),
      webSidecarRunner: async () => null,
      launchInteractive: async ({ introspection }) => {
        observed.push(introspection);
      },
    });

    expect(observed).toEqual([true, undefined]);
  });

  it('lets programmatic callers enable developer tools when argv omits the flag', async () => {
    let observedDeveloperTools: boolean | undefined;

    const code = await runBrunchCli({
      argv: [],
      cwd: '/tmp/project',
      coordinator: noOpWorkspaceCoordinator('/tmp/project') as never,
      developerTools: true,
      launchTui: async (options) => {
        observedDeveloperTools = options?.developerTools;
      },
    });

    expect(code).toBe(0);
    expect(observedDeveloperTools).toBe(true);
  });

  it('registers TUI-gated introspection last when the launch context enables it', async () => {
    const events: string[] = [];
    const commands: string[] = [];
    const store = createInMemoryBrunchIntrospectionStore();

    await createBrunchPiExtensions(
      chromeStateForWorkspace(readyWorkspace('/tmp/project', 'session-1')),
      undefined,
      {
        coordinator: noOpWorkspaceCoordinator('/tmp/project'),
        introspection: { store },
      },
    )({
      on: (event: string) => events.push(event),
      registerCommand: (name: string) => commands.push(name),
      registerShortcut: (_name: string, _options: unknown) => {},
      registerTool: (_tool: unknown) => {},
      registerMessageRenderer: (_type: string) => {},
      sendMessage: (_message: unknown) => {},
      getAllTools: () => [],
      setActiveTools: (_tools: string[]) => {},
    } as never);

    expect(commands.at(-1)).toBe(BRUNCH_INTROSPECTION_COMMAND);
    expect(events).toEqual(expect.arrayContaining(['before_provider_request', 'tool_result']));
  });

  it('scopes Pi startup update suppression and restores update-check env in finally', async () => {
    const scopedEnv: { PI_OFFLINE?: string; PI_SKIP_VERSION_CHECK?: string } = {};
    await expect(
      runWithScopedBrunchOfflineDefault({
        env: scopedEnv,
        run: async () => {
          expect(scopedEnv.PI_OFFLINE).toBe('1');
          expect(scopedEnv.PI_SKIP_VERSION_CHECK).toBe('1');
        },
      }),
    ).resolves.toBeUndefined();
    expect(scopedEnv.PI_OFFLINE).toBeUndefined();
    expect(scopedEnv.PI_SKIP_VERSION_CHECK).toBeUndefined();

    const overriddenEnv: { PI_OFFLINE?: string; PI_SKIP_VERSION_CHECK?: string } = {
      PI_OFFLINE: 'already-offline',
      PI_SKIP_VERSION_CHECK: 'user-skip',
    };
    await expect(
      runWithScopedBrunchOfflineDefault({
        env: overriddenEnv,
        run: async () => {
          expect(overriddenEnv.PI_OFFLINE).toBe('already-offline');
          expect(overriddenEnv.PI_SKIP_VERSION_CHECK).toBe('user-skip');
          throw new Error('prove finally restore');
        },
      }),
    ).rejects.toThrow('prove finally restore');
    expect(overriddenEnv.PI_OFFLINE).toBe('already-offline');
    expect(overriddenEnv.PI_SKIP_VERSION_CHECK).toBe('user-skip');
  });

  it('keeps src/dev build-excluded', async () => {
    const buildConfig = JSON.parse(
      await readFile(join(import.meta.dirname, '..', '..', '..', 'tsconfig.build.json'), 'utf8'),
    ) as {
      exclude?: string[];
    };

    expect(buildConfig.exclude).toContain('src/dev');
  });

  it('opens the advertised sidecar route only through the injected opener when openWeb is enabled', async () => {
    const events: string[] = [];
    const workspace = readyWorkspace('/tmp/project', 'session-ready');

    await runBrunchTui({
      cwd: '/tmp/project',
      openWeb: true,
      coordinator: {
        inspectWorkspace: async () => ({
          cwd: '/tmp/project',
          currentSpec: workspace.spec,
          currentSessionFile: workspace.session.file,
          needsNewSpec: false,
          specs: [],
          unavailableSessions: [],
        }),
        activateWorkspace: async () => workspace,
        bindCurrentSpecToReplacementSession: async () => workspace,
      },
      runWorkspaceDialogPreflight: async () => ({
        action: 'continue',
        specId: workspace.spec.id,
        sessionFile: workspace.session.file,
      }),
      webSidecarRunner: async () => ({
        url: 'http://127.0.0.1:49152',
        async close() {
          events.push('sidecar-close');
        },
      }),
      advertiseWebSidecar: (url) => {
        events.push(`advertise:${url}`);
      },
      openBrowser: async (url) => {
        events.push(`open:${url}`);
      },
      launchInteractive: async () => {
        events.push('launch');
      },
    });

    expect(events).toEqual([
      'advertise:http://127.0.0.1:49152/spec/1',
      'open:http://127.0.0.1:49152/spec/1',
      'launch',
      'sidecar-close',
    ]);
  });
  it('does not open the browser by default while still advertising the active spec sidecar route', async () => {
    const events: string[] = [];
    const workspace = readyWorkspace('/tmp/project', 'session-ready');

    await runBrunchTui({
      cwd: '/tmp/project',
      coordinator: {
        inspectWorkspace: async () => ({
          cwd: '/tmp/project',
          currentSpec: workspace.spec,
          currentSessionFile: workspace.session.file,
          needsNewSpec: false,
          specs: [],
          unavailableSessions: [],
        }),
        activateWorkspace: async () => workspace,
        bindCurrentSpecToReplacementSession: async () => workspace,
      },
      runWorkspaceDialogPreflight: async () => ({
        action: 'continue',
        specId: workspace.spec.id,
        sessionFile: workspace.session.file,
      }),
      webSidecarRunner: async ({ routePath }) => {
        events.push(`sidecar:${routePath}`);
        return {
          url: 'http://127.0.0.1:49152',
          async close() {
            events.push('sidecar-close');
          },
        };
      },
      openBrowser: async (url) => {
        events.push(`open:${url}`);
      },
      advertiseWebSidecar: (url) => {
        events.push(`advertise:${url}`);
      },
      launchInteractive: async () => {
        events.push('launch');
      },
    });

    expect(events).toEqual([
      'sidecar:/spec/1',
      'advertise:http://127.0.0.1:49152/spec/1',
      'launch',
      'sidecar-close',
    ]);
  });

  it('does not launch interactive mode when startup preflight is cancelled', async () => {
    const events: string[] = [];
    const workspace = readyWorkspace('/tmp/project', 'session-ready');

    await runBrunchTui({
      cwd: '/tmp/project',
      coordinator: {
        inspectWorkspace: async () => {
          events.push('inspect');
          return {
            cwd: '/tmp/project',
            currentSpec: workspace.spec,
            currentSessionFile: workspace.session.file,
            needsNewSpec: false,
            specs: [],
            unavailableSessions: [],
          };
        },
        activateWorkspace: async () => {
          events.push('activate');
          return {
            status: 'cancelled',
            cwd: '/tmp/project',
            chrome: workspace.chrome,
          };
        },
        bindCurrentSpecToReplacementSession: async () => workspace,
      },
      runWorkspaceDialogPreflight: async () => {
        events.push('preflight');
        return { action: 'cancel' };
      },
      launchInteractive: async () => {
        events.push('launch');
      },
    });

    expect(events).toEqual(['inspect', 'preflight', 'activate']);
  });

  it('chooses a new binding-only session instead of implicitly resuming stale transcript', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-tui-'));
    const coordinator = createWorkspaceSessionCoordinator({ cwd });
    const first = await coordinator.createSetupSession({
      specTitle: 'Spec One',
    });
    first.session.manager.appendMessage(userMessage('stale transcript'));
    const firstContent = await readFile(first.session.file, 'utf8');
    let launchedSessionFile: string | undefined;

    await runBrunchTui({
      cwd,
      coordinator,
      runWorkspaceDialogPreflight: async () => ({
        action: 'newSession',
        specId: first.spec.id,
      }),
      launchInteractive: async ({ workspace }) => {
        launchedSessionFile = workspace.session.file;
      },
    });

    expect(launchedSessionFile).toBeDefined();
    expect(launchedSessionFile).not.toBe(first.session.file);
    await expect(readFile(first.session.file, 'utf8')).resolves.toBe(firstContent);
    expect(await readFile(launchedSessionFile!, 'utf8')).not.toContain('stale transcript');
  });

  it('binds replacement sessions through internal session boundary events', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-tui-'));
    const manager = SessionManager.create(cwd, join(cwd, '.brunch', 'sessions'));
    const boundSessionIds: string[] = [];
    const widgets = new Map<string, string[]>();
    const titles: string[] = [];
    const ui: FakeExtensionUi = {
      setHeader: (_factory) => {},
      setFooter: (_factory) => {},
      setStatus: (_key, _text) => {},
      setWidget: (key: string, content: unknown) => {
        if (isStringArray(content)) {
          widgets.set(key, content);
        }
      },
      setWorkingIndicator: (_options) => {},
      setTitle: (title: string) => titles.push(title),
      notify: (_message: string, _type?: 'info' | 'warning' | 'error') => {},
    };
    const ctx: FakeExtensionContext = { sessionManager: manager, ui };
    const sessionStart: Array<(event: unknown, ctx: FakeExtensionContext) => Promise<void>> = [];
    const beforeAgentStart: Array<(event: unknown, ctx: FakeExtensionContext) => Promise<void>> = [];
    const messageStart: Array<(event: unknown, ctx: FakeExtensionContext) => Promise<void>> = [];

    await createBrunchPiExtensions(
      chromeStateForWorkspace(readyWorkspace(cwd, manager.getSessionId())),
      (sessionManager) => {
        boundSessionIds.push(sessionManager.getSessionId());
      },
      {
        coordinator: noOpWorkspaceCoordinator(cwd),
        promptContext: {
          spec: { id: 1, name: 'Spec One' },
          workspace: { cwd },
          graphReads: stubPromptGraphReads(),
        },
      },
    )({
      on: (event: string, handler: never) => {
        if (event === 'session_start') {
          sessionStart.push(handler);
        }
        if (event === 'before_agent_start') {
          beforeAgentStart.push(handler);
        }
        if (event === 'message_start') {
          messageStart.push(handler);
        }
      },
      registerCommand: (_name: string, _options: unknown) => {},
      registerTool: (_tool: unknown) => {},
    } as never);

    for (const handler of sessionStart) await handler({}, ctx);
    for (const handler of beforeAgentStart) await handler({}, ctx);
    for (const handler of messageStart) {
      await handler({ type: 'message_start', message: { role: 'user' } }, ctx);
    }
    for (const handler of messageStart) {
      await handler({ type: 'message_start', message: { role: 'assistant' } }, ctx);
    }

    expect(boundSessionIds).toEqual([manager.getSessionId(), manager.getSessionId(), manager.getSessionId()]);
    expect(widgets.has('brunch.chrome')).toBe(false);
    expect(titles).toEqual([`brunch — ${basename(cwd)} · Spec One`]);
  });

  it('registers the Brunch spec/session picker command and shortcut', async () => {
    const commands = new Map<string, Omit<RegisteredCommand, 'name' | 'sourceInfo'>>();
    const shortcuts = new Map<string, Omit<RegisteredCommand, 'name' | 'sourceInfo'>>();
    const registeredTools: string[] = [];

    const shortcutEvents: string[] = [];
    const publishedUpdates: unknown[] = [];
    const switchTarget = readyWorkspace('/tmp/project', 'session-target');
    const commandContext = fakeCommandContext({
      currentSessionFile: '/sessions/session-old.jsonl',
      decisions: [
        {
          action: 'openSession',
          specId: switchTarget.spec.id,
          sessionFile: switchTarget.session.file,
        },
      ],
      onEvent: (event) => shortcutEvents.push(event),
    });

    await createBrunchPiExtensions(
      chromeStateForWorkspace(readyWorkspace('/tmp/project', 'session-1')),
      undefined,
      {
        coordinator: {
          inspectWorkspace: async () => {
            shortcutEvents.push('inspect');
            return inventoryWithWorkspace(switchTarget);
          },
          activateWorkspace: async (decision) => {
            shortcutEvents.push(`activate:${decision.action}`);
            return switchTarget;
          },
        },
        getCommandContext: () => commandContext,
        productUpdates: {
          publish: (update) => {
            shortcutEvents.push('publish');
            publishedUpdates.push(update);
          },
          subscribe: () => () => {},
        },
      },
    )({
      on: (_event: string, _handler: unknown) => {},
      registerCommand: (name: string, opts: unknown) => commands.set(name, opts as never),
      registerShortcut: (name: string, opts: unknown) => shortcuts.set(name, opts as never),
      registerTool: (tool: { name: string }) => registeredTools.push(tool.name),
      registerMessageRenderer: (_type: string) => {},
      sendMessage: (_message: unknown) => {},
      getAllTools: () => ['read', 'grep', 'find', 'ls', 'bash'].map((name) => ({ name })),
      setActiveTools: (_tools: string[]) => {},
    } as never);

    expect(registeredTools).toEqual([
      'read',
      'grep',
      'find',
      'ls',
      'read_workspace_context',
      'read_specification_context',
      'read_session_context',
      'web_fetch',
      'web_search',
      BRUNCH_EXECUTE_STATUS_TOOL,
      BRUNCH_EXECUTE_COOK_AGENT_RESULT_TOOL,
      BRUNCH_EXECUTE_COOK_POPULATE_TOOL,
      BRUNCH_EXECUTE_COOK_REPORT_INIT_TOOL,
      BRUNCH_EXECUTE_COOK_SOURCE_POLICY_TOOL,
      BRUNCH_EXECUTE_COOK_SOURCE_COPY_TOOL,
      BRUNCH_EXECUTE_COOK_SLICE_COMPLETE_TOOL,
      BRUNCH_EXECUTE_COOK_SLICE_EXECUTE_TOOL,
      BRUNCH_EXECUTE_COOK_SLICE_START_TOOL,
      BRUNCH_EXECUTE_COOK_TEST_RESULT_TOOL,
      BRUNCH_EXECUTE_COOK_WORKTREE_CREATE_TOOL,
      'orchestrator_stub',
      'present_alternatives',
      'present_question',
      'present_review_set',
      'present_candidates',
      'request_response',
    ]);
    expect(registeredTools).not.toContain(BRUNCH_EXECUTE_COOK_PLAN_PREVIEW_TOOL);
    expect(registeredTools).not.toContain(BRUNCH_EXECUTE_PLAN_CHECK_TOOL);
    expect(registeredTools).not.toContain(BRUNCH_EXECUTE_PLAN_DRAFT_ARTIFACT_TOOL);
    expect(registeredTools).not.toContain(BRUNCH_EXECUTE_PLAN_DRAFT_TOOL);
    expect(registeredTools).not.toContain(BRUNCH_EXECUTE_PLAN_OUTLINE_ARTIFACT_TOOL);
    expect(registeredTools).not.toContain(BRUNCH_EXECUTE_PLAN_OUTLINE_TOOL);
    expect(registeredTools).not.toContain(BRUNCH_EXECUTE_SNAPSHOT_TOOL);
    expect(commands.get(BRUNCH_SWITCH_COMMAND)?.description).toBe('Open the Brunch spec/session picker');
    const retiredWorkspaceCommand = ['brunch', 'workspace'].join('-');
    expect(commands.has(retiredWorkspaceCommand)).toBe(false);
    expect(commands.has('brunch')).toBe(false);
    for (const commandName of [BRUNCH_LENS_COMMAND, BRUNCH_STRATEGY_COMMAND, BRUNCH_MODE_COMMAND]) {
      expect(commands.has(commandName)).toBe(true);
    }
    // Disabled until operational: continue is unimplemented.
    expect(commands.has(BRUNCH_CONTINUE_COMMAND)).toBe(false);
    expect(shortcuts.get(BRUNCH_SWITCH_SHORTCUT)?.description).toBe('Open the Brunch spec/session picker');
    expect(shortcuts.has('ctrl+b')).toBe(false);
    // alt+b must stay unregistered: Pi reserves it for cursorWordLeft.
    expect(shortcuts.has('alt+b')).toBe(false);

    // The switch shortcut borrows the command-capable context and completes a
    // real cross-session switch, exactly like /brunch:switch.
    const shortcut = shortcuts.get(BRUNCH_SWITCH_SHORTCUT);
    expect(shortcut).toBeDefined();
    const shortcutHandler = shortcut!.handler as (ctx: unknown) => Promise<void> | void;
    await shortcutHandler({
      ui: fakeUi(() => {}),
    });
    expect(shortcutEvents).toEqual([
      'waitForIdle',
      'inspect',
      'custom',
      'activate:openSession',
      'publish',
      `switch:${switchTarget.session.file}`,
      'notify:info',
    ]);
    // The switch publishes the same selected-session updates as workspace.activate.
    expect(publishedUpdates).toEqual([
      expect.arrayContaining([
        {
          topic: 'workspace.state',
          specId: switchTarget.spec.id,
          sessionId: switchTarget.session.id,
        },
      ]),
    ]);
  });

  it('opens the spec/session picker from the Brunch command', async () => {
    const events: string[] = [];
    const target = readyWorkspace('/tmp/project', 'session-target');
    const ctx = fakeCommandContext({
      currentSessionFile: '/sessions/session-old.jsonl',
      decisions: [
        {
          action: 'openSession',
          specId: target.spec.id,
          sessionFile: target.session.file,
        },
      ],
      onEvent: (event) => events.push(event),
    });

    await runBrunchWorkspaceCommand(ctx, {
      inspectWorkspace: async () => {
        events.push('inspect');
        return inventoryWithWorkspace(target);
      },
      activateWorkspace: async (decision) => {
        events.push(`activate:${decision.action}`);
        return target;
      },
    });

    expect(events).toEqual([
      'waitForIdle',
      'inspect',
      'custom',
      'activate:openSession',
      `switch:${target.session.file}`,
      'notify:info',
    ]);
  });

  it('runs the in-session workspace switch through coordinator activation and replacement context', async () => {
    const events: string[] = [];
    const customOptions: unknown[] = [];
    const target = readyWorkspace('/tmp/project', 'session-target');
    const replacementUi = fakeUi((method) => events.push(`replacement:${method}`));
    const ctx = fakeCommandContext({
      currentSessionFile: '/sessions/session-old.jsonl',
      decision: {
        action: 'openSession',
        specId: target.spec.id,
        sessionFile: target.session.file,
      },
      onCustomOptions: (options) => customOptions.push(options),
      onEvent: (event) => events.push(event),
      replacementUi,
    });

    await runBrunchWorkspaceAction(ctx, {
      inspectWorkspace: async () => {
        events.push('inspect');
        return inventoryWithWorkspace(target);
      },
      activateWorkspace: async (decision) => {
        events.push(`activate:${decision.action}`);
        return target;
      },
    });

    expect(events).toEqual([
      'waitForIdle',
      'inspect',
      'custom',
      'activate:openSession',
      `switch:${target.session.file}`,
      'replacement:setFooter',
      'replacement:setTitle',
      'replacement:notify',
    ]);
    expect(customOptions).toEqual([
      {
        overlay: true,
        overlayOptions: {
          anchor: 'center',
          width: 80,
          maxHeight: '90%',
          margin: 1,
        },
      },
    ]);
  });

  it('opens the spec/session picker from shortcut contexts without waitForIdle', async () => {
    const events: string[] = [];
    const target = readyWorkspace('/tmp/project', 'session-target');
    const ctx = fakeCommandContext({
      currentSessionFile: '/sessions/session-old.jsonl',
      decision: {
        action: 'openSession',
        specId: target.spec.id,
        sessionFile: target.session.file,
      },
      onEvent: (event) => events.push(event),
    });
    delete (ctx as Partial<ExtensionCommandContext>).waitForIdle;

    await runBrunchWorkspaceAction(ctx, {
      inspectWorkspace: async () => {
        events.push('inspect');
        return inventoryWithWorkspace(target);
      },
      activateWorkspace: async (decision) => {
        events.push(`activate:${decision.action}`);
        return target;
      },
    });

    expect(events).toEqual([
      'inspect',
      'custom',
      'activate:openSession',
      `switch:${target.session.file}`,
      'notify:info',
    ]);
  });

  it('leaves the current session untouched when workspace switch is cancelled', async () => {
    const events: string[] = [];
    const ctx = fakeCommandContext({
      currentSessionFile: '/sessions/session-old.jsonl',
      decision: { action: 'cancel' },
      onEvent: (event) => events.push(event),
    });

    await runBrunchWorkspaceAction(ctx, {
      inspectWorkspace: async () => emptyInventory('/tmp/project'),
      activateWorkspace: async () => ({
        status: 'cancelled',
        cwd: '/tmp/project',
        chrome: {
          cwd: '/tmp/project',
          spec: null,
        },
      }),
    });

    expect(events).toEqual(['waitForIdle', 'custom', 'notify:info']);
  });

  it('reports needs-human workspace switch decisions without switching sessions', async () => {
    const events: string[] = [];
    const ctx = fakeCommandContext({
      currentSessionFile: '/sessions/session-old.jsonl',
      decision: {
        action: 'openSession',
        specId: 'missing',
        sessionFile: '/sessions/missing.jsonl',
      },
      onEvent: (event) => events.push(event),
    });

    await runBrunchWorkspaceAction(ctx, {
      inspectWorkspace: async () => emptyInventory('/tmp/project'),
      activateWorkspace: async () => ({
        status: 'needs_human',
        cwd: '/tmp/project',
        reason: 'Selected session is not available.',
        chrome: {
          cwd: '/tmp/project',
          spec: null,
        },
      }),
    });

    expect(events).toEqual(['waitForIdle', 'custom', 'notify:warning']);
  });

  it('cancels Pi fork/clone hooks with a stable user-facing reason while leaving /tree native', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-tui-'));
    const manager = SessionManager.create(cwd, join(cwd, '.brunch', 'sessions'));
    const notifications: Array<{
      message: string;
      type: 'info' | 'warning' | 'error' | undefined;
    }> = [];
    const ctx: FakeExtensionContext = {
      sessionManager: manager,
      ui: {
        setHeader: (_factory) => {},
        setFooter: (_factory) => {},
        setStatus: (_key, _text) => {},
        setWidget: (_key: string, _content: unknown) => {},
        setWorkingIndicator: (_options) => {},
        setTitle: (_title: string) => {},
        notify: (message, type) => notifications.push({ message, type }),
      },
    };
    const handlers = new Map<string, (event: unknown, ctx: FakeExtensionContext) => unknown>();

    await createBrunchPiExtensions(
      chromeStateForWorkspace(readyWorkspace(cwd, manager.getSessionId())),
      undefined,
      { coordinator: noOpWorkspaceCoordinator(cwd) },
    )({
      on: (event: string, handler: (event: unknown, ctx: FakeExtensionContext) => unknown) => {
        handlers.set(event, handler);
      },
      registerCommand: (_name: string, _options: unknown) => {},
      registerTool: (_tool: unknown) => {},
    } as never);

    expect(handlers.has('session_before_tree')).toBe(false);
    await expect(
      Promise.resolve(handlers.get('session_before_fork')?.({ type: 'session_before_fork' }, ctx)),
    ).resolves.toEqual({ cancel: true });
    expect(notifications).toEqual([
      {
        message:
          'Brunch does not support Pi session forks/clones in this POC. Use /new to continue within the selected spec.',
        type: 'warning',
      },
    ]);
  });

  it('registers alternatives cards as a transcript primitive without demo commands', async () => {
    const commands: string[] = [];
    const renderers: string[] = [];
    const tools = new Map<
      string,
      {
        execute: (id: string, params: never) => unknown;
      }
    >();
    const messages: unknown[] = [];

    registerBrunchAlternatives({
      registerMessageRenderer: (type: string) => renderers.push(type),
      registerTool: (tool: { name: string; execute: (id: string, params: never) => unknown }) =>
        tools.set(tool.name, tool),
      registerCommand: (name: string) => commands.push(name),
      sendMessage: (message: unknown) => messages.push(message),
    } as never);

    await expect(
      Promise.resolve(
        tools.get('present_alternatives')?.execute('tool-1', {
          headline: 'Choose',
          alternatives: [{ title: 'A', body: 'Alpha', flavor: 'accent' }],
        } as never),
      ),
    ).resolves.toMatchObject({
      content: [{ type: 'text', text: 'Presented 1 alternative.' }],
      details: { count: 1 },
      terminate: true,
    });

    expect(renderers).toEqual(['alternatives-card-set']);
    expect(messages).toEqual([
      {
        customType: 'alternatives-card-set',
        content: '## Choose\n\n---\n\n### A\n\nAlpha',
        display: true,
        details: {
          headline: 'Choose',
          alternatives: [{ title: 'A', body: 'Alpha', flavor: 'accent' }],
        },
      },
    ]);
    expect(commands).toEqual([]);
  });

  it('wires live selected-spec graph nodes through the Brunch shell mention source', async () => {
    let providerFactory: ((current: FakeAutocompleteProvider) => FakeAutocompleteProvider) | undefined;
    const sessionStart: Array<(event: unknown, ctx: FakeExtensionContext) => Promise<void> | void> = [];

    await createBrunchPiExtensions(
      chromeStateForWorkspace(readyWorkspace('/tmp/project', 'session-1')),
      undefined,
      {
        coordinator: noOpWorkspaceCoordinator('/tmp/project'),
        graph: {
          specId: 1,
          commandExecutor: {} as never,
          reads: {
            queryGraph: () => ({
              nodes: [
                {
                  id: 1,
                  specId: 1,
                  plane: 'intent',
                  kind: 'goal',
                  kindOrdinal: 1,
                  title: 'Live selected-spec goal',
                  body: 'Graph-backed candidate',
                  basis: 'explicit',
                  createdAtLsn: 1,
                  updatedAtLsn: 1,
                },
              ],
              edges: [],
              lsn: 1,
            }),
            getNodes: () => [],
            resolveNodeCode: () => undefined,
            getElicitationGaps: () => [],
            getOpenReconciliationNeeds: () => [],
            latestLsn: () => 1,
          },
        },
      },
    )({
      // Fakes mirror the ContinuityEntryAppender pair: ledger + message carriers.
      on: (event: string, handler: never) => {
        if (event === 'session_start') sessionStart.push(handler);
      },
      registerCommand: (_name: string, _options: unknown) => {},
      registerShortcut: (_name: string, _options: unknown) => {},
      registerTool: (_tool: unknown) => {},
      registerMessageRenderer: (_type: string) => {},
      sendMessage: (_message: unknown) => {},
      getAllTools: () => [],
      setActiveTools: (_tools: string[]) => {},
    } as never);

    const ctx: FakeExtensionContext = {
      sessionManager: {
        getEntries: () => [],
        appendCustomEntry: (_customType: string, _data: unknown) => {},
        appendCustomMessageEntry: (
          _customType: string,
          _content: string,
          _display: boolean,
          _details?: unknown,
        ) => {},
      } as unknown as FakeExtensionContext['sessionManager'],
      ui: {
        setHeader: (_factory) => {},
        setFooter: (_factory) => {},
        setStatus: (_key, _text) => {},
        setWidget: (_key: string, _content: unknown) => {},
        setWorkingIndicator: (_options) => {},
        setTitle: (_title: string) => {},
        notify: (_message: string, _type?: 'info' | 'warning' | 'error') => {},
        addAutocompleteProvider: (factory: typeof providerFactory) => {
          providerFactory = factory;
        },
      } as FakeExtensionUi & {
        addAutocompleteProvider: (factory: typeof providerFactory) => void;
      },
    };

    for (const handler of sessionStart) await handler({}, ctx);

    const fallback: FakeAutocompleteProvider = {
      getSuggestions: async () => ({ items: [], prefix: '' }),
      applyCompletion: (lines) => ({ lines, cursorLine: 0, cursorCol: 0 }),
      shouldTriggerFileCompletion: () => true,
    };
    const provider = providerFactory?.(fallback);

    await expect(provider?.getSuggestions(['Discuss #'], 0, 9, {} as never)).resolves.toMatchObject({
      prefix: '#',
      items: [
        expect.objectContaining({
          value: '#G1',
          label: '#G1 Live selected-spec goal',
          description: 'Graph-backed candidate',
        }),
      ],
    });
  });

  it('does not fall back to dummy mention candidates when graph deps are absent', async () => {
    let providerFactory: ((current: FakeAutocompleteProvider) => FakeAutocompleteProvider) | undefined;
    const sessionStart: Array<(event: unknown, ctx: FakeExtensionContext) => Promise<void> | void> = [];

    await createBrunchPiExtensions(
      chromeStateForWorkspace(readyWorkspace('/tmp/project', 'session-1')),
      undefined,
      { coordinator: noOpWorkspaceCoordinator('/tmp/project') },
    )({
      on: (event: string, handler: never) => {
        if (event === 'session_start') sessionStart.push(handler);
      },
      registerCommand: (_name: string, _options: unknown) => {},
      registerShortcut: (_name: string, _options: unknown) => {},
      registerTool: (_tool: unknown) => {},
      registerMessageRenderer: (_type: string) => {},
      sendMessage: (_message: unknown) => {},
      getAllTools: () => [],
      setActiveTools: (_tools: string[]) => {},
    } as never);

    const ctx: FakeExtensionContext = {
      sessionManager: {
        getEntries: () => [],
        appendCustomEntry: (_customType: string, _data: unknown) => {},
        appendCustomMessageEntry: (
          _customType: string,
          _content: string,
          _display: boolean,
          _details?: unknown,
        ) => {},
      } as unknown as FakeExtensionContext['sessionManager'],
      ui: {
        setHeader: (_factory) => {},
        setFooter: (_factory) => {},
        setStatus: (_key, _text) => {},
        setWidget: (_key: string, _content: unknown) => {},
        setWorkingIndicator: (_options) => {},
        setTitle: (_title: string) => {},
        notify: (_message: string, _type?: 'info' | 'warning' | 'error') => {},
        addAutocompleteProvider: (factory: typeof providerFactory) => {
          providerFactory = factory;
        },
      } as FakeExtensionUi & {
        addAutocompleteProvider: (factory: typeof providerFactory) => void;
      },
    };

    for (const handler of sessionStart) await handler({}, ctx);

    const fallback: FakeAutocompleteProvider = {
      getSuggestions: async () => ({ items: [], prefix: '' }),
      applyCompletion: (lines) => ({ lines, cursorLine: 0, cursorCol: 0 }),
      shouldTriggerFileCompletion: () => true,
    };
    const provider = providerFactory?.(fallback);

    await expect(provider?.getSuggestions(['Discuss #'], 0, 9, {} as never)).resolves.toEqual({
      prefix: '#',
      items: [],
    });
  });

  it('loads the elicit operational-mode tool policy from product code', async () => {
    const events: Record<string, (event: never) => unknown> = {};
    const activeTools: string[][] = [];
    const registeredTools: string[] = [];

    registerBrunchOperationalModePolicy({
      registerTool: (tool: { name: string }) => registeredTools.push(tool.name),
      getAllTools: () =>
        ['read', 'grep', 'find', 'ls', 'present_question', 'request_response', 'bash', 'edit', 'write'].map(
          (name) => ({
            name,
          }),
        ),
      setActiveTools: (tools: string[]) => activeTools.push(tools),
      on: (event: string, handler: (event: never) => unknown) => {
        events[event] = handler;
      },
    } as never);

    expect(registeredTools).toEqual(['read', 'grep', 'find', 'ls']);
    await events.session_start?.({} as never);
    expect(activeTools).toEqual([['read', 'grep', 'find', 'ls', 'present_question', 'request_response']]);
    await expect(
      Promise.resolve(events.before_agent_start?.({ systemPrompt: 'base' } as never)),
    ).resolves.toBeUndefined();
    await expect(Promise.resolve(events.tool_call?.({ toolName: 'write' } as never))).resolves.toMatchObject({
      block: true,
    });
    expect(events.user_bash?.({ command: 'rm -rf .' } as never)).toMatchObject({
      result: {
        exitCode: 1,
        output: 'Brunch tool policy blocks shell commands in elicit mode (bash, edit, write): rm -rf .',
      },
    });
  });

  it('suppresses generic Pi startup resources for the Brunch shell', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-tui-'));
    const settingsManager = createBrunchSettingsManager(cwd, cwd);
    const extension = () => {};
    const resourceOptions = brunchResourceLoaderOptions([extension]);
    const env: { PI_OFFLINE?: string } = {};

    applyBrunchOfflineDefault(env);

    expect(settingsManager.getQuietStartup()).toBe(true);
    expect(resourceOptions).toEqual({
      noContextFiles: true,
      noExtensions: true,
      noPromptTemplates: true,
      noSkills: true,
      noThemes: true,
      // D39-L: ambient APPEND_SYSTEM.md must be sealed (empty pinned source).
      appendSystemPrompt: [],
      extensionFactories: [extension],
    });
    expect(env.PI_OFFLINE).toBe('1');
  });

  it('ignores hostile ambient Pi settings for behavior-shaping profile policy', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-tui-'));
    const agentDir = join(cwd, 'home-pi');
    await writeHostilePiSettings(cwd, agentDir);

    const settingsManager = createBrunchSettingsManager(cwd, agentDir);

    expect(settingsManager.getShellPath()).toBeUndefined();
    expect(settingsManager.getShellCommandPrefix()).toBeUndefined();
    expect(settingsManager.getNpmCommand()).toBeUndefined();
    expect(settingsManager.getPackages()).toEqual([]);
    expect(settingsManager.getExtensionPaths()).toEqual([]);
    expect(settingsManager.getSkillPaths()).toEqual([]);
    expect(settingsManager.getPromptTemplatePaths()).toEqual([]);
    expect(settingsManager.getThemePaths()).toEqual([]);
    expect(settingsManager.getEnableSkillCommands()).toBe(false);
    expect(settingsManager.getDoubleEscapeAction()).toBe('none');
    expect(settingsManager.getCompactionSettings()).toEqual({
      enabled: true,
      reserveTokens: 16384,
      keepRecentTokens: 20000,
    });
    expect(settingsManager.getRetrySettings()).toEqual({
      enabled: true,
      maxRetries: 3,
      baseDelayMs: 2000,
    });
    expect(settingsManager.getProviderRetrySettings()).toEqual({
      timeoutMs: undefined,
      maxRetries: undefined,
      maxRetryDelayMs: 60000,
    });
    expect(settingsManager.getShowImages()).toBe(true);
    expect(settingsManager.getImageWidthCells()).toBe(60);
    expect(settingsManager.getClearOnShrink()).toBe(false);
    expect(settingsManager.getShowTerminalProgress()).toBe(false);
    expect(settingsManager.getImageAutoResize()).toBe(true);
    expect(settingsManager.getBlockImages()).toBe(false);
    expect(settingsManager.getTransport()).toBe('auto');
    expect(settingsManager.getTheme()).toBeUndefined();
    expect(settingsManager.getLastChangelogVersion()).toBeUndefined();
    expect(settingsManager.getCollapseChangelog()).toBe(false);
    expect(settingsManager.getEnableInstallTelemetry()).toBe(false);
    expect(settingsManager.getEnableAnalytics()).toBe(false);
    expect(settingsManager.getTrackingId()).toBeUndefined();
    expect(settingsManager.getDefaultProjectTrust()).toBe('never');
    expect(settingsManager.getShowHardwareCursor()).toBe(false);
    expect(settingsManager.getEditorPaddingX()).toBe(0);
    expect(settingsManager.getAutocompleteMaxVisible()).toBe(5);
  });

  it('keeps sealed Brunch settings after Pi settings reload', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-tui-'));
    const agentDir = join(cwd, 'home-pi');
    await writeHostilePiSettings(cwd, agentDir);
    const settingsManager = createBrunchSettingsManager(cwd, agentDir);

    await settingsManager.reload();

    expect(settingsManager.getQuietStartup()).toBe(true);
    expect(settingsManager.getPackages()).toEqual([]);
    expect(settingsManager.getExtensionPaths()).toEqual([]);
    expect(settingsManager.getSkillPaths()).toEqual([]);
    expect(settingsManager.getPromptTemplatePaths()).toEqual([]);
    expect(settingsManager.getThemePaths()).toEqual([]);
    expect(settingsManager.getEnableSkillCommands()).toBe(false);
    expect(settingsManager.getDoubleEscapeAction()).toBe('none');
    expect(settingsManager.getShellPath()).toBeUndefined();
    expect(settingsManager.getNpmCommand()).toBeUndefined();
  });

  it('keeps ambient resource suppression and explicit product extensions behind one settings boundary', async () => {
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-tui-'));
    const extension = () => {};
    const settings = createBrunchPiSettings({
      cwd,
      agentDir: cwd,
      extensionFactories: [extension],
    });

    expect(settings.settingsManager.getQuietStartup()).toBe(true);
    expect(settings.resourceLoaderOptions).toEqual({
      noContextFiles: true,
      noExtensions: true,
      noPromptTemplates: true,
      noSkills: true,
      noThemes: true,
      // D39-L: ambient APPEND_SYSTEM.md must be sealed (empty pinned source).
      appendSystemPrompt: [],
      extensionFactories: [extension],
    });
  });

  it('seals ambient APPEND_SYSTEM.md out of the real Pi resource loader (D39-L)', async () => {
    // Live oracle: drive Pi's real DefaultResourceLoader through Brunch's seal
    // with an ambient global APPEND_SYSTEM.md planted in agentDir. Without
    // appendSystemPrompt: [], Pi's loader falls through to ambient discovery and
    // the file leaks into the system prompt (the bug the ship-gate runbook hit).
    const cwd = await mkdtemp(join(tmpdir(), 'brunch-seal-cwd-'));
    const agentDir = await mkdtemp(join(tmpdir(), 'brunch-seal-agentdir-'));
    const sentinel = 'AMBIENT_APPEND_SENTINEL_must_not_leak';
    await writeFile(join(agentDir, 'APPEND_SYSTEM.md'), `# Ambient\n\n${sentinel}\n`);

    const settings = createBrunchPiSettings({ cwd, agentDir, extensionFactories: [] });
    const loader = new DefaultResourceLoader({
      cwd,
      agentDir,
      settingsManager: settings.settingsManager,
      ...settings.resourceLoaderOptions,
    });
    await loader.reload();

    expect(loader.getAppendSystemPrompt()).toEqual([]);
    expect(JSON.stringify(loader.getAppendSystemPrompt())).not.toContain(sentinel);
  });

  it('keeps Pi settings/resource policy out of the TUI launcher', async () => {
    const launcherSource = await readFile(join(import.meta.dirname, '..', 'brunch-tui.ts'), 'utf8');
    const settingsSource = await readFile(join(import.meta.dirname, '..', 'pi-settings.ts'), 'utf8');

    expect(launcherSource).toContain('createBrunchPiSettings');
    expect(launcherSource).not.toContain('SettingsManager.create');
    expect(launcherSource).not.toContain('noContextFiles');
    expect(settingsSource).toContain('SettingsManager.inMemory');
    expect(settingsSource).toContain('noContextFiles: true');
  });

  it('keeps the Brunch settings override and audit list in the settings boundary', async () => {
    const launcherSource = await readFile(join(import.meta.dirname, '..', 'brunch-tui.ts'), 'utf8');
    const settingsSource = await readFile(join(import.meta.dirname, '..', 'pi-settings.ts'), 'utf8');
    const settingsManagerTypes = await readFile(
      join(
        import.meta.dirname,
        '..',
        '..',
        '..',
        'node_modules',
        '@earendil-works',
        'pi-coding-agent',
        'dist',
        'core',
        'settings-manager.d.ts',
      ),
      'utf8',
    );
    const getterNames = Array.from(
      settingsManagerTypes.matchAll(/\n    (get[A-Z][A-Za-z0-9]+)\(/g),
      (match) => match[1]!,
    );

    expect(BRUNCH_SETTINGS_POLICY).toMatchObject({
      quietStartup: true,
      packages: [],
      extensions: [],
      skills: [],
      prompts: [],
      themes: [],
      enableSkillCommands: false,
      doubleEscapeAction: 'none',
      defaultProjectTrust: 'never',
      enableAnalytics: false,
    });
    expect(getterNames.sort()).toEqual([...BRUNCH_SETTINGS_AUDITED_GETTERS].sort());
    expect(launcherSource).not.toContain('SettingsManager.inMemory');
    expect(settingsSource).toContain('BRUNCH_SETTINGS_POLICY');
    expect(settingsSource).toContain('SettingsManager.inMemory');
  });
});

async function writeHostilePiSettings(cwd: string, agentDir: string): Promise<void> {
  const hostileSettings = {
    lastChangelogVersion: '999.0.0-hostile',
    defaultProvider: 'hostile-provider',
    defaultModel: 'hostile-model',
    transport: 'websocket',
    theme: 'hostile-theme',
    compaction: {
      enabled: false,
      reserveTokens: 1,
      keepRecentTokens: 2,
    },
    branchSummary: {
      reserveTokens: 3,
      skipPrompt: true,
    },
    retry: {
      enabled: false,
      maxRetries: 99,
      baseDelayMs: 1,
      provider: {
        timeoutMs: 1,
        maxRetries: 99,
        maxRetryDelayMs: 2,
      },
    },
    shellPath: '/tmp/hostile-shell',
    quietStartup: false,
    shellCommandPrefix: 'hostile-prefix',
    npmCommand: ['hostile-npm'],
    collapseChangelog: true,
    enableInstallTelemetry: true,
    defaultProjectTrust: 'always',
    enableAnalytics: true,
    trackingId: 'hostile-tracking-id',
    packages: ['hostile-package'],
    extensions: ['hostile-extension'],
    skills: ['hostile-skill'],
    prompts: ['hostile-prompt'],
    themes: ['hostile-theme-path'],
    enableSkillCommands: true,
    terminal: {
      showImages: false,
      imageWidthCells: 1,
      clearOnShrink: true,
      showTerminalProgress: true,
    },
    images: {
      autoResize: false,
      blockImages: true,
    },
    doubleEscapeAction: 'tree',
    showHardwareCursor: true,
    editorPaddingX: 3,
    autocompleteMaxVisible: 20,
  };

  await mkdir(agentDir, { recursive: true });
  await mkdir(join(cwd, '.pi'), { recursive: true });
  await writeFile(join(agentDir, 'settings.json'), JSON.stringify(hostileSettings, null, 2));
  await writeFile(join(cwd, '.pi', 'settings.json'), JSON.stringify(hostileSettings, null, 2));
}

function readyWorkspace(cwd: string, sessionId: string): WorkspaceSessionReadyState {
  const spec = { id: 1, title: 'Spec One' };
  return {
    status: 'ready',
    cwd,
    spec,
    session: {
      id: sessionId,
      file: `/sessions/${sessionId}.jsonl`,
      manager: {} as WorkspaceSessionReadyState['session']['manager'],
    },
    chrome: {
      cwd,
      spec,
    },
  };
}

function emptyInventory(cwd: string): WorkspaceLaunchInventory {
  return {
    cwd,
    currentSpec: null,
    currentSessionFile: null,
    needsNewSpec: true,
    specs: [],
    unavailableSessions: [],
  };
}

function inventoryWithWorkspace(workspace: WorkspaceSessionReadyState): WorkspaceLaunchInventory {
  return {
    cwd: workspace.cwd,
    currentSpec: workspace.spec,
    currentSessionFile: workspace.session.file,
    needsNewSpec: false,
    specs: [
      {
        spec: workspace.spec,
        sessions: [
          {
            id: workspace.session.id,
            file: workspace.session.file,
            specId: workspace.spec.id,
            specTitle: workspace.spec.title,
            available: true,
          },
        ],
      },
    ],
    unavailableSessions: [],
  };
}

function stubPromptGraphReads() {
  return {
    queryGraph: () => ({ lsn: 1, nodes: [], edges: [] }),
    getNodes: () => [],
    resolveNodeCode: () => undefined,
    getElicitationGaps: () => groundingFloorGaps(),
    getOpenReconciliationNeeds: () => [],
    latestLsn: () => 1,
  };
}

function noOpWorkspaceCoordinator(cwd: string) {
  return {
    inspectWorkspace: async () => emptyInventory(cwd),
    activateWorkspace: async () => readyWorkspace(cwd, 'session-1'),
  };
}

function fakeCommandContext(options: {
  currentSessionFile: string;
  decision?: Awaited<ReturnType<ExtensionUIContext['custom']>>;
  decisions?: Array<Awaited<ReturnType<ExtensionUIContext['custom']>>>;
  onCustomOptions?: (customOptions: unknown) => void;
  onEvent: (event: string) => void;
  replacementUi?: FakeExtensionUi;
}): ExtensionCommandContext {
  const ui = fakeUi((method, type) => {
    if (method === 'notify') {
      options.onEvent(`notify:${type}`);
    }
  });
  const decisions = [...(options.decisions ?? [options.decision])];
  const ctx = {
    cwd: '/tmp/project',
    sessionManager: {
      getSessionFile: () => options.currentSessionFile,
    },
    ui: {
      ...ui,
      custom: async (_component: unknown, customOptions?: unknown) => {
        options.onEvent('custom');
        if (customOptions !== undefined) {
          options.onCustomOptions?.(customOptions);
        }
        return decisions.shift();
      },
    },
    waitForIdle: async () => options.onEvent('waitForIdle'),
    switchSession: async (
      sessionPath: string,
      switchOptions?: Parameters<ExtensionCommandContext['switchSession']>[1],
    ) => {
      options.onEvent(`switch:${sessionPath}`);
      await switchOptions?.withSession?.({
        ...ctx,
        ui: options.replacementUi ?? ui,
        sessionManager: { getSessionFile: () => sessionPath },
      } as never);
      return { cancelled: false };
    },
  };
  return ctx as unknown as ExtensionCommandContext;
}

function fakeUi(
  onCall: (method: string, notifyType?: 'info' | 'warning' | 'error') => void,
): FakeExtensionUi {
  return {
    setHeader: (_factory) => onCall('setHeader'),
    setFooter: (_factory) => onCall('setFooter'),
    setStatus: (_key, _text) => onCall('setStatus'),
    setWidget: (_key, _content, _options) => onCall('setWidget'),
    setWorkingIndicator: (_options) => onCall('setWorkingIndicator'),
    setTitle: (_title) => onCall('setTitle'),
    notify: (_message, type) => onCall('notify', type),
  };
}

type FakeExtensionContext = Pick<ExtensionContext, 'sessionManager'> & {
  ui: FakeExtensionUi;
};

interface FakeAutocompleteItem {
  value: string;
  label: string;
}

interface FakeAutocompleteProvider {
  getSuggestions(lines: string[], cursorLine: number, cursorCol: number, options: never): Promise<unknown>;
  applyCompletion(
    lines: string[],
    cursorLine: number,
    cursorCol: number,
    item: FakeAutocompleteItem,
    prefix: string,
  ): unknown;
  shouldTriggerFileCompletion(lines: string[], cursorLine: number, cursorCol: number): boolean;
}

type FakeExtensionUi = Pick<
  ExtensionUIContext,
  'setFooter' | 'setHeader' | 'setStatus' | 'setWidget' | 'setWorkingIndicator' | 'setTitle' | 'notify'
>;

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}
