import { getSelectListTheme, type ExtensionUIContext } from '@earendil-works/pi-coding-agent';
import type { EditorTheme } from '@earendil-works/pi-tui';
import { visibleWidth } from '@earendil-works/pi-tui';
import { describe, expect, it } from 'vitest';

import { appendBrunchAgentRuntimeSwitch } from '../../../session/runtime-state.js';
import type { WorkspaceSessionReadyState } from '../../../session/workspace-session-coordinator.js';
import { BrunchEditorComponent } from '../../components/brunch-editor.js';
import { BrunchStartupHeader } from '../../components/chrome-header.js';
import { formatChromeShortcutHint } from '../../components/chrome-shortcuts.js';
import { operationalModeBorderColorRole } from '../../components/mode-border-theme.js';
import chromeExtension, {
  chromeStateForWorkspace,
  projectBrunchChromeFooterLines,
  registerBrunchChrome,
  renderBrunchChrome,
} from '../chrome/index.js';
import { BRUNCH_MENU_COMMAND, BRUNCH_MODE_COMMAND, BRUNCH_MODE_PICKER_SHORTCUT } from '../commands/index.js';

describe('Brunch chrome projection', () => {
  it('uses activated session state instead of fabricating unbound', async () => {
    const state = chromeStateForWorkspace(readyWorkspace('/tmp/project', 'session-real'));

    expect(state.session.id).toBe('session-real');
    expect(state).not.toHaveProperty('phase');
    expect(state).not.toHaveProperty('chatMode');
  });

  it('populates session.label from workspace session name when available', () => {
    const workspace = readyWorkspace('/tmp/project', 'session-abc', 'My spec — session 1');
    const state = chromeStateForWorkspace(workspace);

    expect(state.session.label).toBe('My spec — session 1');
  });

  it('uses discovered workspace project identity when the coordinator supplies it', () => {
    const workspace = readyWorkspace('/tmp/project', 'session-abc');
    workspace.chrome.project = { name: 'Package App', slug: 'package-app' };
    const state = chromeStateForWorkspace(workspace);

    const calls: FakeUiCall[] = [];
    renderBrunchChrome(fakeChromeUi(calls), state);
    expect(calls.find((call) => call.method === 'setTitle')?.args).toEqual([
      'brunch — Package App · Spec One',
    ]);
  });

  it('formats honest Brunch chrome from one product-state snapshot', async () => {
    const state = {
      cwd: '/tmp/project',
      spec: { id: 1, title: 'Spec One' },
      session: { id: 'session-1', label: 'Interview #1' },
      webSidecarUrl: 'http://127.0.0.1:49152/spec/1',
    };

    expect(projectBrunchChromeFooterLines(state)).toEqual([
      ' ui: http://127.0.0.1:49152/spec/1 | model no model | thinking off | context ?%',
      '',
    ]);
  });

  it('styles the complete one-column-inset footer with one outer dim transition', () => {
    const lines = projectBrunchChromeFooterLines(
      {
        cwd: '/tmp/project',
        spec: { id: 1, title: 'Spec One' },
        session: { id: 'session-1' },
        webSidecarUrl: 'http://localhost:49152',
      },
      undefined,
      200,
      roleTheme,
    );

    expect(lines[0]).toBe('dim: ui: http://localhost:49152 | model no model | thinking off | context ?%');
    expect(lines[0]?.match(/dim:/g)).toHaveLength(1);
  });

  it('prefers projected runtime telemetry over launch-time runtime fallback', () => {
    const state = {
      cwd: '/tmp/project',
      spec: { id: 1, title: 'Spec One' },
      session: { id: 'session-1', label: 'Interview #1' },
      phase: 'elicitation' as const,
      chatMode: 'responding-to-elicitation' as const,
      runtime: {
        mode: 'specify' as const,
        role: 'elicitor',
      },
    };

    const footer = projectBrunchChromeFooterLines(state, {
      agentState: {
        schemaVersion: 1,
        operationalMode: 'specify',
        agentRole: 'elicitor',
      },
    }).join('\n');

    expect(footer).toBe(' model no model | thinking off | context ?%\n');
    expect(footer).not.toContain('mode [');
    expect(footer).not.toContain('role');
  });

  it('formats rich optional runtime and context metadata without fabricating missing fields', () => {
    const state = {
      cwd: '/tmp/project',
      spec: { id: 1, title: 'Spec One' },
      session: { id: 'session-1', label: 'Interview #1' },
      runtime: {
        bundle: 'elicit-default',
        role: 'elicitor',
        model: 'claude-sonnet',
        thinking: 'medium',
      },
      build: { version: 'v0.0.0', dev: 'dev abc123' },
      contextUsage: { usedTokens: 1024, maxTokens: 2048 },
      worker: { stage: 'observer-review' as const, status: 'queued' as const },
      coherence: 'needs_review' as const,
    };

    expect(projectBrunchChromeFooterLines(state)).toEqual([
      ' model claude-sonnet | thinking medium | context 50%',
      '',
    ]);
  });

  it('projects footer telemetry and foreign statuses without publishing a chrome status key', async () => {
    const footer = projectBrunchChromeFooterLines(
      {
        cwd: '/tmp/project',
        spec: { id: 1, title: 'Spec One' },
        session: { id: 'session-1', label: 'Interview #1' },
        runtime: {
          bundle: 'elicit-default',
          role: 'elicitor',
          model: 'claude-sonnet',
          thinking: 'medium',
        },
        contextUsage: { usedTokens: 1024, maxTokens: 2048 },
      },
      {
        statuses: new Map([
          ['brunch.reviewer', 'reviewer queued'],
          ['brunch.chrome', 'should not echo'],
        ]),
      },
      200,
    ).join('\n');

    expect(footer).toBe(' model claude-sonnet | thinking medium | context 50%\n');
    expect(footer).not.toContain('reviewer queued');
    expect(footer).not.toContain('should not echo');
  });

  it('renders Brunch chrome through one wrapper over Pi UI calls', async () => {
    const calls: FakeUiCall[] = [];
    const ui = fakeChromeUi(calls);

    renderBrunchChrome(ui, {
      cwd: '/tmp/project',
      spec: { id: 1, title: 'Spec One' },
      session: { id: 'session-1' },
    });

    expect(calls.map((call) => call.method)).toEqual(['setFooter', 'setTitle']);
    expect(calls.find((call) => call.method === 'setFooter')?.args[0]).toEqual(expect.any(Function));
    expect(calls.some((call) => call.method === 'setStatus')).toBe(false);
    expect(calls.find((call) => call.method === 'setTitle')?.args).toEqual(['brunch — project · Spec One']);
  });

  it('installs the full startup header only when chrome state requests it', async () => {
    const calls: FakeUiCall[] = [];

    renderBrunchChrome(fakeChromeUi(calls), {
      cwd: '/tmp/project',
      project: { name: 'Project One', slug: 'project-one' },
      spec: { id: 1, title: 'Spec One' },
      session: { id: 'session-1', label: 'Spec One — session 1' },
      webSidecarUrl: 'http://127.0.0.1:49152/spec/1',
      startupHeader: { decision: 'newSession' },
    });

    const headerFactory = calls.find((call) => call.method === 'setHeader')?.args[0];
    expect(headerFactory).toEqual(expect.any(Function));
    expect(calls.some((call) => call.method === 'setWidget')).toBe(false);

    const component = (headerFactory as (tui: unknown, theme: FakeTheme) => BrunchStartupHeader)(
      undefined,
      fakeTheme,
    );
    const collapsedLines = component.render(120);
    const welcomeLines = collapsedLines.slice(collapsedLines.findIndex((line) => line.includes('Welcome')));
    expect(collapsedLines.slice(0, 6)).toEqual(['', '', '', '', '', '']);
    expect(collapsedLines.join('\n')).toMatch(/brunch v1\.0\.0-alpha\.\d+/);
    expect(collapsedLines.join('\n')).toContain('built on Pi v');
    expect(collapsedLines.join('\n')).not.toContain('escape interrupt');
    expect(collapsedLines.join('\n')).toContain('Welcome to Brunch.');
    expect(welcomeLines.join('\n')).toContain('Welcome to Brunch.');
    expect(welcomeLines.join('\n')).toContain('assistant will open with a grounded question');
    expect(welcomeLines.join('\n')).toContain(
      `/${BRUNCH_MODE_COMMAND} or ${formatChromeShortcutHint(BRUNCH_MODE_PICKER_SHORTCUT)} changes Specify / Execute`,
    );
    expect(welcomeLines.join('\n')).not.toContain(BRUNCH_MODE_PICKER_SHORTCUT);
    expect(welcomeLines.join('\n')).toContain(`/${BRUNCH_MENU_COMMAND} or alt-s opens`);
    expect(collapsedLines.join('\n')).toContain('web-ui: http://127.0.0.1:49152/spec/1');
    expect(collapsedLines.join('\n')).not.toContain('Press ctrl+o');
    expect(collapsedLines.join('\n')).not.toContain('Spec One — session 1');
    expect(component.render(120).join('\n')).toContain('web-ui: http://127.0.0.1:49152/spec/1');

    const resumedCalls: FakeUiCall[] = [];
    renderBrunchChrome(fakeChromeUi(resumedCalls), {
      cwd: '/tmp/project',
      spec: { id: 1, title: 'Spec One' },
      session: { id: 'session-1' },
    });
    expect(resumedCalls.some((call) => call.method === 'setHeader')).toBe(false);
  });

  it('suppresses the welcome copy for resumed startup headers', () => {
    const component = new BrunchStartupHeader(
      {
        project: 'Project One',
        spec: 'Spec One',
        session: 'Session One',
        decision: 'openSession',
      },
      fakeTheme,
    );

    const text = component.render(120).join('\n');
    expect(text).not.toContain('Welcome to Brunch.');
    expect(text).not.toContain('/brunch:mode');
    expect(text).toContain('Graph capture flows through Brunch commands and structured exchanges.');
  });

  it('installs BrunchEditorComponent during session_start when the UI supports editor swaps', async () => {
    const calls: FakeUiCall[] = [];
    const handlers = new Map<string, Array<(event: unknown, ctx: FakeChromeContext) => unknown>>();
    const entries: Array<{ type?: unknown; customType?: unknown; data?: unknown }> = [];

    registerBrunchChrome(
      {
        on: (event: string, handler: never) => {
          handlers.set(event, [...(handlers.get(event) ?? []), handler]);
        },
        getThinkingLevel: () => 'low',
      } as never,
      {
        cwd: '/tmp/project',
        spec: { id: 1, title: 'Spec One' },
        session: { id: 'session-1', label: 'Interview #1' },
        webSidecarUrl: 'http://127.0.0.1:49152/spec/1',
      },
    );

    await handlers.get('session_start')?.[0]?.(
      {},
      {
        ui: fakeChromeUi(calls, { withEditorSwap: true }),
        sessionManager: {
          getBranch: () => entries,
          getSessionName: () => 'Interview #1',
          appendCustomEntry: (customType, data) => entries.push({ type: 'custom', customType, data }),
        },
        getContextUsage: () => undefined,
        model: null,
      },
    );

    const factory = calls.find((call) => call.method === 'setEditorComponent')?.args[0];
    expect(factory).toEqual(expect.any(Function));
    const component = (
      factory as (tui: never, theme: EditorTheme, keybindings: never) => BrunchEditorComponent
    )(undefined as never, fakeEditorTheme, undefined as never);
    expect(component).toBeInstanceOf(BrunchEditorComponent);
    const labels = (component as unknown as { getLabels: () => unknown }).getLabels();
    expect(labels).toEqual({
      topRight: '[ Specify ]',
      bottomRight: 'Spec One',
    });
  });

  it('keeps editor labels and border color fresh when runtime state changes', async () => {
    const calls: FakeUiCall[] = [];
    const handlers = new Map<string, Array<(event: unknown, ctx: FakeChromeContext) => unknown>>();
    const entries: Array<{ type?: unknown; customType?: unknown; data?: unknown }> = [];
    const sessionManager = {
      getBranch: () => entries,
      getSessionName: () => null,
      appendCustomEntry: (customType: string, data: unknown) => {
        entries.push({ type: 'custom', customType, data });
      },
    };

    registerBrunchChrome(
      {
        on: (event: string, handler: never) => {
          handlers.set(event, [...(handlers.get(event) ?? []), handler]);
        },
        getThinkingLevel: () => 'low',
      } as never,
      { cwd: '/tmp/project', spec: { id: 1, title: 'Spec One' }, session: { id: 'session-1' } },
    );

    await handlers.get('session_start')?.[0]?.(
      {},
      {
        ui: fakeChromeUi(calls, { withEditorSwap: true, theme: roleTheme }),
        sessionManager,
        getContextUsage: () => undefined,
        model: null,
      },
    );
    const factory = calls.find((call) => call.method === 'setEditorComponent')?.args[0] as (
      tui: never,
      theme: EditorTheme,
      keybindings: never,
    ) => BrunchEditorComponent;
    const component = factory(undefined as never, fakeEditorTheme, undefined as never);
    expect((component as unknown as { getLabels: () => { topRight?: string } }).getLabels().topRight).toBe(
      '[ Specify ]',
    );
    expect(
      (component as unknown as { getBorderColor: () => (text: string) => string }).getBorderColor()('x'),
    ).toBe(`${operationalModeBorderColorRole('specify')}:x`);

    appendBrunchAgentRuntimeSwitch(sessionManager, { schemaVersion: 1, operationalMode: 'execute' }, 'user');

    expect((component as unknown as { getLabels: () => { topRight?: string } }).getLabels().topRight).toBe(
      '[ Execute ]',
    );
    expect(
      (component as unknown as { getBorderColor: () => (text: string) => string }).getBorderColor()('x'),
    ).toBe(`${operationalModeBorderColorRole('execute')}:x`);
  });

  it('does not install the editor in no-UI/stub contexts', async () => {
    const calls: FakeUiCall[] = [];
    const handlers = new Map<string, Array<(event: unknown, ctx: FakeChromeContext) => unknown>>();

    registerBrunchChrome(
      {
        on: (event: string, handler: never) => {
          handlers.set(event, [...(handlers.get(event) ?? []), handler]);
        },
        getThinkingLevel: () => 'low',
      } as never,
      { cwd: '/tmp/project', spec: { id: 1, title: 'Spec One' }, session: { id: 'session-1' } },
    );

    await expect(
      handlers.get('session_start')?.[0]?.(
        {},
        {
          ui: fakeChromeUi(calls),
          sessionManager: { getBranch: () => [], getSessionName: () => null },
          getContextUsage: () => undefined,
          model: null,
        },
      ),
    ).resolves.toBeUndefined();

    expect(calls.map((call) => call.method)).not.toContain('setEditorComponent');
  });

  it('never re-publishes the retired brunch.kick status key', async () => {
    const calls: FakeUiCall[] = [];
    const handlers = new Map<string, Array<(event: unknown, ctx: { ui: FakeExtensionUi }) => unknown>>();

    registerBrunchChrome(
      {
        on: (event: string, handler: never) => {
          handlers.set(event, [...(handlers.get(event) ?? []), handler]);
        },
      } as never,
      { cwd: '/tmp/project', spec: { id: 1, title: 'Spec One' }, session: { id: 'session-1' } },
    );

    await handlers.get('message_start')?.[0]?.(
      { message: { role: 'assistant' } },
      { ui: fakeChromeUi(calls) },
    );

    expect(calls.some((call) => call.method === 'setStatus')).toBe(false);
  });

  it('refreshes at turn_end but clears the kick-scoped working message only at agent_settled', async () => {
    const calls: FakeUiCall[] = [];
    const handlers = new Map<string, Array<(event: unknown, ctx: FakeChromeContext) => unknown>>();
    const ctx: FakeChromeContext = {
      ui: fakeChromeUi(calls),
      sessionManager: { getBranch: () => [], getSessionName: () => null },
      getContextUsage: () => undefined,
      model: null,
    };

    registerBrunchChrome(
      {
        on: (event: string, handler: never) => {
          handlers.set(event, [...(handlers.get(event) ?? []), handler]);
        },
        getThinkingLevel: () => 'low',
      } as never,
      { cwd: '/tmp/project', spec: { id: 1, title: 'Spec One' }, session: { id: 'session-1' } },
    );

    await handlers.get('session_start')?.[0]?.({}, ctx);
    const footerFactory = calls.find((call) => call.method === 'setFooter')?.args[0] as (
      tui: { requestRender: () => void },
      theme: FakeTheme,
      footerData: {
        getExtensionStatuses: () => ReadonlyMap<string, string>;
        getAvailableProviderCount: () => number;
      },
    ) => unknown;
    let footerRefreshes = 0;
    footerFactory({ requestRender: () => (footerRefreshes += 1) }, fakeTheme, {
      getExtensionStatuses: () => new Map(),
      getAvailableProviderCount: () => 1,
    });
    calls.length = 0;

    await handlers.get('turn_end')?.[0]?.({}, ctx);
    expect(footerRefreshes).toBe(1);
    expect(calls).not.toContainEqual({ method: 'setWorkingMessage', args: [undefined] });

    await handlers.get('agent_settled')?.[0]?.({}, ctx);
    expect(footerRefreshes).toBe(2);
    expect(calls).toContainEqual({ method: 'setWorkingMessage', args: [undefined] });
  });

  it('applies a scrollback-safe working indicator on session_start (≤1 frame → no animation interval)', async () => {
    const calls: FakeUiCall[] = [];
    const handlers = new Map<string, Array<(event: unknown, ctx: { ui: FakeExtensionUi }) => unknown>>();

    registerBrunchChrome(
      {
        on: (event: string, handler: never) => {
          handlers.set(event, [...(handlers.get(event) ?? []), handler]);
        },
      } as never,
      { cwd: '/tmp/project', spec: { id: 1, title: 'Spec One' }, session: { id: 'session-1' } },
    );

    await handlers.get('session_start')?.[0]?.({}, { ui: fakeChromeUi(calls) });

    const indicatorCall = calls.find((call) => call.method === 'setWorkingIndicator');
    expect(indicatorCall).toBeDefined();
    const options = indicatorCall!.args[0] as { frames?: string[] } | undefined;
    // Loader.restartAnimation starts no interval when frames.length <= 1 —
    // the contract that keeps scrollback free of periodic spinner writes.
    expect(options?.frames).toBeDefined();
    expect(options!.frames!.length).toBeLessThanOrEqual(1);
  });

  it('backfills the working indicator at turn_start (missed-agent_start guard)', async () => {
    const calls: FakeUiCall[] = [];
    const handlers = new Map<string, Array<(event: unknown, ctx: { ui: FakeExtensionUi }) => unknown>>();

    registerBrunchChrome(
      {
        on: (event: string, handler: never) => {
          handlers.set(event, [...(handlers.get(event) ?? []), handler]);
        },
      } as never,
      { cwd: '/tmp/project', spec: { id: 1, title: 'Spec One' }, session: { id: 'session-1' } },
    );

    await handlers.get('turn_start')?.[0]?.({}, { ui: fakeChromeUi(calls) });

    expect(calls).toContainEqual({ method: 'setWorkingVisible', args: [true] });
  });

  it('renders no welcome or resume card for resumed sessions', () => {
    const component = new BrunchStartupHeader(
      { project: 'Project One', spec: 'Spec One', session: 'Session One', decision: 'openSession' },
      fakeTheme,
    );

    const text = component.render(80).join('\n');
    expect(text).not.toContain('Welcome to Brunch.');
    expect(text).not.toContain('Resumed spec:');
  });

  it('installs dev fallback header through the src/.pi extension entrypoint', async () => {
    const calls: FakeUiCall[] = [];
    const sessionStart: Array<(event: unknown, ctx: { ui: FakeExtensionUi }) => Promise<void> | void> = [];

    chromeExtension({
      on: (event: string, handler: never) => {
        if (event === 'session_start') sessionStart.push(handler);
      },
    } as never);

    expect(sessionStart).toHaveLength(1);
    await sessionStart[0]!({}, { ui: fakeChromeUi(calls) });

    expect(calls.map((call) => call.method)).toEqual([
      'setWorkingIndicator',
      'setFooter',
      'setHeader',
      'setTitle',
    ]);
  });

  it('keeps startup header text width-safe and newline-safe', () => {
    const component = new BrunchStartupHeader(
      {
        project: 'Project\nOne',
        spec: 'Spec\rOne',
        session: 'Session\tOne',
        sidecarUrl: 'http://127.0.0.1:49152/spec/1\nignored',
      },
      fakeTheme,
    );

    expect(component.render(36).every((line) => !/[\r\n\t]/.test(line))).toBe(true);
    expect(component.render(36).every((line) => visibleWidth(line) <= 36)).toBe(true);
    expect(component.render(36).every((line) => !/[\r\n\t]/.test(line))).toBe(true);
  });

  it('does not project the active web sidecar URL into an upper widget', async () => {
    const calls: FakeUiCall[] = [];

    renderBrunchChrome(fakeChromeUi(calls), {
      cwd: '/tmp/project',
      spec: { id: 1, title: 'Spec One' },
      session: { id: 'session-1' },
      webSidecarUrl: 'http://127.0.0.1:49152/spec/1\nignored',
    });

    expect(calls.some((call) => call.method === 'setWidget')).toBe(false);
  });
});

function readyWorkspace(cwd: string, sessionId: string, sessionName?: string): WorkspaceSessionReadyState {
  const spec = {
    id: 1,
    title: 'Spec One',
    kind: 'product',
    origin: 'greenfield',
    relatesToSpecId: null,
  } as const;
  return {
    status: 'ready',
    cwd,
    spec,
    session: {
      id: sessionId,
      file: `/sessions/${sessionId}.jsonl`,
      name: sessionName,
      manager: {} as WorkspaceSessionReadyState['session']['manager'],
    },
    chrome: {
      cwd,
      spec,
    },
  };
}

interface FakeUiCall {
  method: string;
  args: unknown[];
}

function fakeChromeUi(
  calls: FakeUiCall[],
  options: { readonly withEditorSwap?: boolean; readonly theme?: FakeTheme } = {},
): FakeExtensionUi {
  return {
    theme: options.theme ?? fakeTheme,
    setHeader: (...args: unknown[]) => calls.push({ method: 'setHeader', args }),
    setFooter: (...args: unknown[]) => calls.push({ method: 'setFooter', args }),
    setStatus: (...args: unknown[]) => calls.push({ method: 'setStatus', args }),
    setWidget: (...args: unknown[]) => calls.push({ method: 'setWidget', args }),
    setWorkingIndicator: (...args: unknown[]) => calls.push({ method: 'setWorkingIndicator', args }),
    setWorkingMessage: (...args: unknown[]) => calls.push({ method: 'setWorkingMessage', args }),
    setWorkingVisible: (...args: unknown[]) => calls.push({ method: 'setWorkingVisible', args }),
    ...(options.withEditorSwap
      ? { setEditorComponent: (...args: unknown[]) => calls.push({ method: 'setEditorComponent', args }) }
      : {}),
    setTitle: (...args: unknown[]) => calls.push({ method: 'setTitle', args }),
    notify: (_message: string, _type?: 'info' | 'warning' | 'error') => {},
  };
}

const fakeEditorTheme: EditorTheme = {
  borderColor: (text) => text,
  selectList: getSelectListTheme(),
};

const fakeTheme = {
  fg: (_color: string, text: string) => text,
  bold: (text: string) => text,
};

const roleTheme = {
  fg: (color: string, text: string) => `${color}:${text}`,
  bold: (text: string) => text,
};

type FakeTheme = typeof fakeTheme;

type FakeExtensionUi = Pick<
  ExtensionUIContext,
  | 'setFooter'
  | 'setHeader'
  | 'setStatus'
  | 'setWidget'
  | 'setWorkingIndicator'
  | 'setWorkingMessage'
  | 'setWorkingVisible'
  | 'setTitle'
  | 'notify'
> &
  Partial<Pick<ExtensionUIContext, 'setEditorComponent'>> & { readonly theme: FakeTheme };

type FakeChromeContext = {
  readonly ui: FakeExtensionUi;
  readonly sessionManager: {
    getBranch: () => readonly unknown[];
    getSessionName: () => string | null;
    appendCustomEntry?: (customType: string, data: unknown) => void;
  };
  readonly getContextUsage: () => undefined;
  readonly model: null;
};
