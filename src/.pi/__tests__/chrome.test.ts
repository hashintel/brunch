import type { ExtensionUIContext } from '@earendil-works/pi-coding-agent';
import { describe, expect, it } from 'vitest';

import type { WorkspaceSessionReadyState } from '../../session/workspace-session-coordinator.js';
import {
  chromeStateForWorkspace,
  formatBrunchChromeHeaderLines,
  formatChromeWidgetLines,
  projectBrunchChromeFooterLines,
  renderBrunchChrome,
} from '../extensions/chrome.js';

describe('Brunch chrome projection', () => {
  it('uses activated session state instead of fabricating unbound', async () => {
    const state = chromeStateForWorkspace(readyWorkspace('/tmp/project', 'session-real'));

    expect(formatBrunchChromeHeaderLines(state).join('\n')).toContain('session-real');
  });

  it('populates session.label from workspace session name when available', () => {
    const workspace = readyWorkspace('/tmp/project', 'session-abc', 'My spec — session 1');
    const state = chromeStateForWorkspace(workspace);

    expect(state.session.label).toBe('My spec — session 1');
    expect(formatBrunchChromeHeaderLines(state).join('\n')).toContain('My spec — session 1');
  });

  it('formats chrome header as wordmark plus runtime-state summary', async () => {
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
        lens: 'intent',
      },
    };

    expect(formatBrunchChromeHeaderLines(state)).toEqual([
      '█▄▄ █▀█ █ █ █▄ █ █▀▀ █ █',
      '█▄█ █▀▄ █▄█ █ ▀█ █▄▄ █▀█',
      'runtime: elicit-default · role elicitor · claude-sonnet · thinking medium · lens intent',
      'spec: Spec One · session: Interview #1 · phase: elicitation',
    ]);
  });

  it('formats honest Brunch chrome from one product-state snapshot', async () => {
    const state = {
      cwd: '/tmp/project',
      spec: { id: 1, title: 'Spec One' },
      session: { id: 'session-1', label: 'Interview #1' },
      phase: 'elicitation' as const,
      chatMode: 'responding-to-elicitation' as const,
    };

    expect(formatBrunchChromeHeaderLines(state)).toEqual([
      '█▄▄ █▀█ █ █ █▄ █ █▀▀ █ █',
      '█▄█ █▀▄ █▄█ █ ▀█ █▄▄ █▀█',
      'runtime: not reported',
      'spec: Spec One · session: Interview #1 · phase: elicitation',
    ]);
    expect(projectBrunchChromeFooterLines(state)).toEqual([
      'brunch · runtime: not reported · build: not reported',
      'context: not reported',
      'state: responding-to-elicitation · coherence: unknown · worker: not reported',
      'spec: Spec One · session: Interview #1',
      '',
    ]);
    expect(formatChromeWidgetLines(state)).toEqual([
      'brunch: █▄▄ █▀█ █ █ █▄ █ █▀▀ █ █ / █▄█ █▀▄ █▄█ █ ▀█ █▄▄ █▀█',
      'cwd: /tmp/project',
      'spec: Spec One',
      'session: Interview #1',
      'runtime: not reported',
      'context: not reported',
      'chat mode: responding-to-elicitation',
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
        lens: 'intent',
      },
      build: { version: 'v0.0.0', dev: 'dev abc123' },
      contextUsage: { usedTokens: 1024, maxTokens: 2048 },
      worker: { stage: 'observer-review' as const, status: 'queued' as const },
      coherence: 'needs_review' as const,
    };

    expect(projectBrunchChromeFooterLines(state)).toEqual([
      'brunch · runtime: elicit-default · role elicitor · claude-sonnet · thinking medium · lens intent · build: v0.0.0 dev abc123',
      'context: [█████░░░░░] 1,024/2,048 tokens (50%)',
      'state: responding-to-elicitation · coherence: needs_review · worker: observer-review/queued',
      'spec: Spec One · session: Interview #1',
      '',
    ]);
    expect(formatChromeWidgetLines(state)).toContain('context: [█████░░░░░] 1,024/2,048 tokens (50%)');
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
    expect(footer).toContain('Interview #1');
    expect(footer).toContain('main');
    expect(footer).toContain('claude-sonnet');
    expect(footer).toContain('thinking medium');
    expect(footer).toContain('[█████░░░░░] 1,024/2,048 tokens (50%)');
    expect(footer).toContain('reviewer queued');
    expect(footer).not.toContain('should not echo');
  });

  it('renders Brunch chrome through one wrapper over Pi UI calls', async () => {
    const calls: FakeUiCall[] = [];
    const ui: FakeExtensionUi = {
      setHeader: (...args: unknown[]) => calls.push({ method: 'setHeader', args }),
      setFooter: (...args: unknown[]) => calls.push({ method: 'setFooter', args }),
      setStatus: (...args: unknown[]) => calls.push({ method: 'setStatus', args }),
      setWidget: (...args: unknown[]) => calls.push({ method: 'setWidget', args }),
      setWorkingIndicator: (_options) => {},
      setTitle: (...args: unknown[]) => calls.push({ method: 'setTitle', args }),
      notify: (_message: string, _type?: 'info' | 'warning' | 'error') => {},
    };

    renderBrunchChrome(ui, {
      cwd: '/tmp/project',
      spec: { id: 1, title: 'Spec One' },
      session: { id: 'session-1' },
      phase: 'elicitation',
      chatMode: 'responding-to-elicitation',
    });

    expect(calls.map((call) => call.method)).toEqual(['setHeader', 'setFooter', 'setWidget', 'setTitle']);
    expect(calls.find((call) => call.method === 'setFooter')?.args[0]).toEqual(expect.any(Function));
    expect(calls.some((call) => call.method === 'setStatus')).toBe(false);
    expect(calls.find((call) => call.method === 'setWidget')?.args).toEqual([
      'brunch.chrome',
      [
        'brunch: █▄▄ █▀█ █ █ █▄ █ █▀▀ █ █ / █▄█ █▀▄ █▄█ █ ▀█ █▄▄ █▀█',
        'cwd: /tmp/project',
        'spec: Spec One',
        'session: session-1',
        'runtime: not reported',
        'context: not reported',
        'chat mode: responding-to-elicitation',
      ],
      { placement: 'aboveEditor' },
    ]);
    expect(calls.find((call) => call.method === 'setTitle')?.args).toEqual(['brunch — Spec One']);
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

type FakeExtensionUi = Pick<
  ExtensionUIContext,
  'setFooter' | 'setHeader' | 'setStatus' | 'setWidget' | 'setWorkingIndicator' | 'setTitle' | 'notify'
>;
