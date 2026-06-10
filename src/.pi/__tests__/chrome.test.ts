import type { ExtensionUIContext } from '@earendil-works/pi-coding-agent';
import { visibleWidth } from '@earendil-works/pi-tui';
import { describe, expect, it } from 'vitest';

import type { WorkspaceSessionReadyState } from '../../session/workspace-session-coordinator.js';
import { BrunchStartupHeader } from '../components/chrome-header.js';
import {
  chromeStateForWorkspace,
  projectBrunchChromeFooterLines,
  renderBrunchChrome,
} from '../extensions/chrome/index.js';

describe('Brunch chrome projection', () => {
  it('uses activated session state instead of fabricating unbound', async () => {
    const state = chromeStateForWorkspace(readyWorkspace('/tmp/project', 'session-real'));

    expect(state.session.id).toBe('session-real');
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

    expect(projectBrunchChromeFooterLines(state)[2]).toBe(
      'proj: Package App | spec: Spec One | mode: not reported | strategy: not reported | lens: not reported',
    );
  });

  it('formats honest Brunch chrome from one product-state snapshot', async () => {
    const state = {
      cwd: '/tmp/project',
      spec: { id: 1, title: 'Spec One' },
      session: { id: 'session-1', label: 'Interview #1' },
      phase: 'elicitation' as const,
      chatMode: 'responding-to-elicitation' as const,
    };

    expect(projectBrunchChromeFooterLines(state)).toEqual([
      '/tmp/project  no model',
      'no branch  ctx ──────────── ?% ?/0',
      'proj: project | spec: Spec One | mode: not reported | strategy: not reported | lens: not reported',
      '',
    ]);
  });

  it('formats rich optional runtime and context metadata without fabricating missing fields', () => {
    const state = {
      cwd: '/tmp/project',
      spec: { id: 1, title: 'Spec One' },
      session: { id: 'session-1', label: 'Interview #1' },
      phase: 'elicitation' as const,
      chatMode: 'responding-to-elicitation' as const,
      runtime: {
        bundle: 'elicit-default',
        role: 'elicitor',
        model: 'claude-sonnet',
        thinking: 'medium',
        lens: 'intent' as const,
      },
      build: { version: 'v0.0.0', dev: 'dev abc123' },
      contextUsage: { usedTokens: 1024, maxTokens: 2048 },
      worker: { stage: 'observer-review' as const, status: 'queued' as const },
      coherence: 'needs_review' as const,
    };

    expect(projectBrunchChromeFooterLines(state)).toEqual([
      '/tmp/project  claude-sonnet • medium',
      'no branch  ctx ━━━━━━────── 50% 1.0k/2.0k',
      'proj: project | spec: Spec One | mode: not reported | strategy: not reported | lens: intent',
      '',
    ]);
  });

  it('projects footer telemetry and foreign statuses without publishing a chrome status key', async () => {
    const footer = projectBrunchChromeFooterLines(
      {
        cwd: '/tmp/project',
        spec: { id: 1, title: 'Spec One' },
        session: { id: 'session-1', label: 'Interview #1' },
        phase: 'elicitation',
        chatMode: 'responding-to-elicitation',
        runtime: {
          bundle: 'elicit-default',
          role: 'elicitor',
          model: 'claude-sonnet',
          thinking: 'medium',
        },
        contextUsage: { usedTokens: 1024, maxTokens: 2048 },
      },
      {
        gitBranch: 'main',
        statuses: new Map([
          ['brunch.reviewer', 'reviewer queued'],
          ['brunch.chrome', 'should not echo'],
        ]),
      },
      200,
    ).join('\n');

    expect(footer).toContain('Spec One');
    expect(footer).toContain('main');
    expect(footer).toContain('claude-sonnet');
    expect(footer).toContain('medium');
    expect(footer).toContain('ctx ━━━━━━────── 50% 1.0k/2.0k');
    expect(footer).toContain(
      'proj: project | spec: Spec One | mode: not reported | strategy: not reported | lens: not reported',
    );
    expect(footer).toContain('reviewer queued');
    expect(footer).not.toContain('should not echo');
  });

  it('renders Brunch chrome through one wrapper over Pi UI calls', async () => {
    const calls: FakeUiCall[] = [];
    const ui = fakeChromeUi(calls);

    renderBrunchChrome(ui, {
      cwd: '/tmp/project',
      spec: { id: 1, title: 'Spec One' },
      session: { id: 'session-1' },
      phase: 'elicitation',
      chatMode: 'responding-to-elicitation',
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
      phase: 'elicitation',
      chatMode: 'responding-to-elicitation',
      webSidecarUrl: 'http://127.0.0.1:49152/spec/1',
      startupHeader: { decision: 'newSession' },
    });

    const headerFactory = calls.find((call) => call.method === 'setHeader')?.args[0];
    expect(headerFactory).toEqual(expect.any(Function));

    const component = (headerFactory as (tui: unknown, theme: FakeTheme) => BrunchStartupHeader)(
      undefined,
      fakeTheme,
    );
    expect(component.render(80).join('\n')).toContain('brunch — Project One');
    expect(component.render(80).join('\n')).toContain('Spec One');
    expect(component.render(80).join('\n')).toContain('Spec One — session 1');
    expect(component.render(80).join('\n')).toContain('http://127.0.0.1:49152/spec/1');
    component.setExpanded(true);
    expect(component.render(80).join('\n')).toContain('Current session');
    expect(component.render(80).join('\n')).toContain('Graph capture');

    const resumedCalls: FakeUiCall[] = [];
    renderBrunchChrome(fakeChromeUi(resumedCalls), {
      cwd: '/tmp/project',
      spec: { id: 1, title: 'Spec One' },
      session: { id: 'session-1' },
      phase: 'elicitation',
      chatMode: 'responding-to-elicitation',
    });
    expect(resumedCalls.some((call) => call.method === 'setHeader')).toBe(false);
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
    component.setExpanded(true);
    expect(component.render(36).every((line) => !/[\r\n\t]/.test(line))).toBe(true);
  });

  it('projects the active web sidecar URL into an upper widget only when present', async () => {
    const calls: FakeUiCall[] = [];

    renderBrunchChrome(fakeChromeUi(calls), {
      cwd: '/tmp/project',
      spec: { id: 1, title: 'Spec One' },
      session: { id: 'session-1' },
      phase: 'elicitation',
      chatMode: 'responding-to-elicitation',
      webSidecarUrl: 'http://127.0.0.1:49152/spec/1\nignored',
    });

    expect(calls.find((call) => call.method === 'setWidget')?.args).toEqual([
      'brunch.sidecar',
      ['Web dashboard: http://127.0.0.1:49152/spec/1 ignored'],
      { placement: 'aboveEditor' },
    ]);

    const withoutSidecarCalls: FakeUiCall[] = [];
    renderBrunchChrome(fakeChromeUi(withoutSidecarCalls), {
      cwd: '/tmp/project',
      spec: { id: 1, title: 'Spec One' },
      session: { id: 'session-1' },
      phase: 'elicitation',
      chatMode: 'responding-to-elicitation',
    });

    expect(withoutSidecarCalls.some((call) => call.method === 'setWidget')).toBe(false);
  });
});

function readyWorkspace(cwd: string, sessionId: string, sessionName?: string): WorkspaceSessionReadyState {
  const spec = { id: 1, title: 'Spec One' };
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
      phase: 'elicitation',
      chatMode: 'responding-to-elicitation',
    },
  };
}

interface FakeUiCall {
  method: string;
  args: unknown[];
}

function fakeChromeUi(calls: FakeUiCall[]): FakeExtensionUi {
  return {
    setHeader: (...args: unknown[]) => calls.push({ method: 'setHeader', args }),
    setFooter: (...args: unknown[]) => calls.push({ method: 'setFooter', args }),
    setStatus: (...args: unknown[]) => calls.push({ method: 'setStatus', args }),
    setWidget: (...args: unknown[]) => calls.push({ method: 'setWidget', args }),
    setWorkingIndicator: (_options) => {},
    setTitle: (...args: unknown[]) => calls.push({ method: 'setTitle', args }),
    notify: (_message: string, _type?: 'info' | 'warning' | 'error') => {},
  };
}

const fakeTheme = {
  fg: (_color: string, text: string) => text,
  bold: (text: string) => text,
};

type FakeTheme = typeof fakeTheme;

type FakeExtensionUi = Pick<
  ExtensionUIContext,
  'setFooter' | 'setHeader' | 'setStatus' | 'setWidget' | 'setWorkingIndicator' | 'setTitle' | 'notify'
>;
