// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type {
  SessionPresentationEntry,
  SessionPresentationResult,
} from '../../projections/session/session-presentation.js';
import { liveSessionEventSchema } from '../../rpc/live-session-contract.js';
import type { LiveSessionEvent } from '../../session/live-session-host.js';
import { BrunchWebApp, createBrunchWebRuntime } from '../app.js';
import type { WebSocketRpcClient, WebSocketRpcNotificationListener } from '../rpc-client.js';

afterEach(() => {
  cleanup();
  sessionStorage.clear();
});

function fixture(
  terminalEntries: readonly SessionPresentationEntry[] = [],
  openAsks: readonly unknown[] = [],
  outcomes: {
    driveTurn?: unknown;
    answerExchange?: unknown;
  } = {},
) {
  const listeners = new Set<WebSocketRpcNotificationListener>();
  const calls: Array<{ method: string; params?: unknown }> = [];
  let reads = 0;
  const client = {
    async request<T>(method: string, params?: unknown): Promise<T> {
      calls.push({ method, params });
      if (method === 'session.openAsks') return { openAsks } as T;
      if (method === 'workspace.state') {
        return {
          status: 'ready',
          cwd: '/tmp',
          spec: { id: 1, title: 'Spec' },
          session: { id: 's1', file: '/tmp/s1.jsonl' },
          chrome: {},
        } as T;
      }
      if (method === 'session.open') return { status: 'opened' } as T;
      if (method === 'session.driveTurn' || method === 'session.answerExchange') {
        const outcome = outcomes[method === 'session.driveTurn' ? 'driveTurn' : 'answerExchange'];
        if (outcome instanceof Error) throw outcome;
        return (outcome ?? { status: 'completed' }) as T;
      }
      if (method === 'session.presentation') {
        reads += 1;
        return {
          status: 'ready',
          presentation: {
            target: { specId: 1, sessionId: 's1' },
            cursor: reads > 1 ? 'durable:assistant' : 'durable:user',
            entries: [
              { id: 'u1', cursor: 'durable:user', kind: 'message', role: 'user', text: 'History' },
              ...terminalEntries,
              ...(reads > 1
                ? [
                    {
                      id: 'a1',
                      cursor: 'durable:assistant',
                      kind: 'message' as const,
                      role: 'assistant' as const,
                      text: 'Hello',
                    },
                  ]
                : []),
            ],
          },
        } satisfies SessionPresentationResult as T;
      }
      throw new Error(`unexpected ${method}`);
    },
    subscribe(listener: WebSocketRpcNotificationListener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    subscribeSessionEvents(
      target: { specId: number; sessionId: string },
      handler: (event: LiveSessionEvent) => void,
      options?: { onProtocolError?: (error: Error) => void },
    ) {
      const listener: WebSocketRpcNotificationListener = (notification) => {
        if (notification.method !== 'brunch.liveSessionEvent') return;
        const parsed = liveSessionEventSchema.safeParse(notification.params);
        if (!parsed.success) {
          options?.onProtocolError?.(new Error('Invalid live session event'));
          return;
        }
        const event = parsed.data;
        if (event.target.specId === target.specId && event.target.sessionId === target.sessionId)
          handler(event);
      };
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    close: vi.fn(),
  } as unknown as WebSocketRpcClient;
  const emit = (event: LiveSessionEvent) => {
    for (const listener of listeners)
      listener({ jsonrpc: '2.0', method: 'brunch.liveSessionEvent', params: event });
  };
  const emitNotification = (method: string, params: unknown) => {
    for (const listener of listeners) listener({ jsonrpc: '2.0', method, params });
  };
  return { client, calls, emit, emitNotification, reads: () => reads };
}

describe('session route', () => {
  it.each(['0', '01', 'not-a-number'])('rejects invalid spec token %s before session RPC', async (token) => {
    window.history.pushState(null, '', `/session/${token}/s1`);
    const f = fixture();
    render(<BrunchWebApp runtime={createBrunchWebRuntime({ rpcClient: f.client })} />);

    expect((await screen.findByRole('alert')).textContent).toMatch(/invalid spec/i);
    expect(f.calls.filter(({ method }) => method.startsWith('session.'))).toEqual([]);
  });

  it('reports malformed open-ask hydration instead of treating it as empty', async () => {
    window.history.pushState(null, '', '/session/1/s1');
    const f = fixture([], [{ exchangeId: '', mode: 'text', question: { body: 'Broken' } }]);
    render(<BrunchWebApp runtime={createBrunchWebRuntime({ rpcClient: f.client })} />);

    expect((await screen.findByRole('alert')).textContent).toMatch(/protocol|load/i);
    expect(screen.queryByLabelText('Session transcript')).toBeNull();
  });

  it.each([
    ['refusal', { status: 'driver_conflict' }],
    ['rejection', new Error('offline')],
  ])('clears turn busy and permits retry after %s', async (_case, outcome) => {
    window.history.pushState(null, '', '/session/1/s1');
    const f = fixture([], [], { driveTurn: outcome });
    render(<BrunchWebApp runtime={createBrunchWebRuntime({ rpcClient: f.client })} />);
    await screen.findByText(/History/u);

    fireEvent.change(screen.getByRole('textbox', { name: 'Message' }), { target: { value: 'Go' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));

    expect((await screen.findByRole('alert')).textContent).toMatch(/could not|failed|conflict/i);
    expect(screen.getByRole('main').getAttribute('aria-busy')).toBe('false');
    expect(screen.getByRole<HTMLTextAreaElement>('textbox', { name: 'Message' }).value).toBe('Go');
    expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Send' }).disabled).toBe(false);
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));
    await waitFor(() =>
      expect(f.calls.filter(({ method }) => method === 'session.driveTurn')).toHaveLength(2),
    );
  });

  it.each([
    ['refusal', { status: 'ask_closed' }],
    ['rejection', new Error('offline')],
  ])('keeps ask failure local and permits retry after %s', async (_case, outcome) => {
    window.history.pushState(null, '', '/session/1/s1');
    const f = fixture([], [{ exchangeId: 'pending', mode: 'text', question: { body: 'Proceed?' } }], {
      answerExchange: outcome,
    });
    render(<BrunchWebApp runtime={createBrunchWebRuntime({ rpcClient: f.client })} />);
    const input = await screen.findByRole('textbox', { name: 'Proceed?' });
    fireEvent.change(input, { target: { value: 'Yes' } });
    fireEvent.click(screen.getByRole('button', { name: 'Answer' }));

    expect((await screen.findByRole('alert')).textContent).toMatch(/could not|failed|closed/i);
    expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Answer' }).disabled).toBe(false);
    fireEvent.click(screen.getByRole('button', { name: 'Answer' }));
    await waitFor(() =>
      expect(f.calls.filter(({ method }) => method === 'session.answerExchange')).toHaveLength(2),
    );
  });

  it('uses the semantic subscription surface and ignores wrong, malformed, and cross-target frames', async () => {
    window.history.pushState(null, '', '/session/1/s1');
    const f = fixture();
    const protocolError = vi.spyOn(console, 'error').mockImplementation(() => {});
    render(<BrunchWebApp runtime={createBrunchWebRuntime({ rpcClient: f.client })} />);
    expect(await screen.findByText(/History/u)).toBeTruthy();

    await act(async () => {
      f.emitNotification('brunch.sessionEvent', {
        target: { specId: 1, sessionId: 's1' },
        seq: 0,
        delta: { type: 'assistant_text_delta', runId: 'wrong-method', text: 'Wrong method' },
      });
      f.emitNotification('brunch.liveSessionEvent', { target: 'malformed' });
      f.emitNotification('brunch.liveSessionEvent', {
        target: { specId: 2, sessionId: 'other' },
        seq: 0,
        delta: { type: 'assistant_text_delta', runId: 'wrong-target', text: 'Wrong target' },
      });
    });

    expect(protocolError).toHaveBeenCalledWith('Brunch live-session protocol error', expect.any(Error));
    protocolError.mockRestore();
    expect(screen.queryByText(/Wrong method/u)).toBeNull();
    expect(screen.queryByText(/Wrong target/u)).toBeNull();
    expect(screen.getByText(/History/u)).toBeTruthy();
  });

  it('renders every projected free-text ask terminal without decoding details', async () => {
    window.history.pushState(null, '', '/session/1/s1');
    const ask = (
      id: string,
      terminal: Extract<SessionPresentationEntry, { kind: 'ask' }>['terminal'],
    ): SessionPresentationEntry => ({
      id,
      cursor: `durable:${id}`,
      kind: 'ask',
      exchangeId: id,
      question: `Question ${id}`,
      ...(terminal ? { terminal } : {}),
    });
    const f = fixture([
      ask('answered', {
        status: 'answered',
        value: { text: 'Canonical JSONL.', comment: 'Keep the source visible.' },
      }),
      ask('cancelled-message', { status: 'cancelled', value: { message: 'No longer needed.' } }),
      ask('cancelled', { status: 'cancelled', value: {} }),
      ask('unavailable', { status: 'unavailable', value: { message: 'Source unavailable.' } }),
    ]);

    render(<BrunchWebApp runtime={createBrunchWebRuntime({ rpcClient: f.client })} />);

    expect(await screen.findByText('Answered: Canonical JSONL.')).toBeTruthy();
    expect(screen.getByText('Comment: Keep the source visible.')).toBeTruthy();
    expect(screen.getByText('Cancelled: No longer needed.')).toBeTruthy();
    expect(screen.getByText('Cancelled')).toBeTruthy();
    expect(screen.getByText('Unavailable: Source unavailable.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Answer' })).toBeNull();
  });

  it('renders durable single-choice selections and answers a live choice through the session contract', async () => {
    window.history.pushState(null, '', '/session/1/s1');
    const options = [
      { id: 'fast', label: 'Fast path', description: 'Optimize for speed.' },
      { id: 'safe', label: 'Safe path' },
    ];
    const f = fixture([
      {
        id: 'choice-listed',
        cursor: 'durable:choice-listed',
        kind: 'ask',
        exchangeId: 'choice-listed',
        question: 'Prior route',
        options,
        terminal: {
          status: 'answered',
          value: {
            choice: { id: 'safe', label: 'Safe path', kind: 'listed' },
            options: [
              { id: 'fast', content: 'Fast path', rationale: 'Optimize for speed.' },
              { id: 'safe', content: 'Safe path' },
            ],
          },
        },
      },
      {
        id: 'choice-other',
        cursor: 'durable:choice-other',
        kind: 'ask',
        exchangeId: 'choice-other',
        question: 'Alternative route',
        options,
        terminal: {
          status: 'answered',
          value: {
            choice: { id: 'other', label: 'A measured path', kind: 'other' },
            options: [
              { id: 'fast', content: 'Fast path', rationale: 'Optimize for speed.' },
              { id: 'safe', content: 'Safe path' },
            ],
            comment: 'Blend safety with a bounded experiment.',
          },
        },
      },
    ]);

    render(<BrunchWebApp runtime={createBrunchWebRuntime({ rpcClient: f.client })} />);

    expect(await screen.findByText('Selected: Safe path')).toBeTruthy();
    expect(screen.getByText('Selected Other: A measured path')).toBeTruthy();
    expect(screen.getByText('Comment: Blend safety with a bounded experiment.')).toBeTruthy();

    await act(async () => {
      f.emit({
        target: { specId: 1, sessionId: 's1' },
        seq: 0,
        delta: {
          type: 'ask_opened',
          ask: {
            exchangeId: 'live-choice',
            mode: 'single-select',
            question: { body: 'Pick the route', options },
          },
        },
      });
    });
    fireEvent.click(screen.getByRole('radio', { name: /Safe path/u }));
    fireEvent.click(screen.getByRole('button', { name: 'Answer' }));

    expect(f.calls).toContainEqual({
      method: 'session.answerExchange',
      params: expect.objectContaining({ exchangeId: 'live-choice', answer: 'safe' }),
    });
  });

  it('renders durable multi-choice selections and submits a live checkbox selection list', async () => {
    window.history.pushState(null, '', '/session/1/s1');
    const options = [
      { id: 'fast', label: 'Fast path', description: 'Optimize for speed.' },
      { id: 'safe', label: 'Safe path' },
    ];
    const f = fixture([
      {
        id: 'choices',
        cursor: 'durable:choices',
        kind: 'ask',
        exchangeId: 'choices',
        question: 'Prior routes',
        mode: 'multi-select',
        options,
        terminal: {
          status: 'answered',
          value: {
            choices: [
              { id: 'fast', label: 'Fast path', kind: 'listed' },
              { id: 'other', label: 'A measured path', kind: 'other' },
            ],
            options: [
              { id: 'fast', content: 'Fast path', rationale: 'Optimize for speed.' },
              { id: 'safe', content: 'Safe path' },
            ],
            comment: 'Pair speed with a bounded experiment.',
          },
        },
      },
    ]);

    render(<BrunchWebApp runtime={createBrunchWebRuntime({ rpcClient: f.client })} />);

    expect(await screen.findByText('Selected: Fast path')).toBeTruthy();
    expect(screen.getByText('Selected Other: A measured path')).toBeTruthy();
    expect(screen.getByText('Comment: Pair speed with a bounded experiment.')).toBeTruthy();

    await act(async () => {
      f.emit({
        target: { specId: 1, sessionId: 's1' },
        seq: 0,
        delta: {
          type: 'ask_opened',
          ask: {
            exchangeId: 'live-choices',
            mode: 'multi-select',
            question: { body: 'Pick every route', options, multiple: true },
          },
        },
      });
    });
    fireEvent.click(screen.getByRole('checkbox', { name: /Fast path/u }));
    fireEvent.click(screen.getByRole('checkbox', { name: /Safe path/u }));
    fireEvent.click(screen.getByRole('button', { name: 'Answer' }));

    expect(f.calls).toContainEqual({
      method: 'session.answerExchange',
      params: expect.objectContaining({ exchangeId: 'live-choices', answer: 'fast,safe' }),
    });
  });

  it('renders candidate proposal cards while the existing ask owns the choice continuation', async () => {
    window.history.pushState(null, '', '/session/1/s1');
    const f = fixture([
      {
        id: 'offer',
        cursor: 'durable:offer',
        kind: 'present_candidates',
        exchangeId: 'candidate-direction',
        heading: 'Choose a direction',
        body: 'Compare the proposals.',
        candidates: [
          {
            id: 'local',
            title: 'Local workbench',
            user_rubric: {
              core_bet: 'Make local graph work the thesis.',
              best_fit: 'Focused POC.',
              cost_complexity: 'Own local state.',
              covers_well: 'Transcript and graph coherence.',
              main_risks: 'No cloud collaboration.',
              lock_in_constraints: 'Local-first semantics.',
              recommendation: 'Choose for the POC.',
            },
            meta_rubric: { commitment: 'Defers cloud.' },
            graph_refs: [{ node_id: 'node-1' }],
          },
        ],
        continuation: {
          tool: 'ask',
          request: 'request_choice',
          exchangeId: 'candidate-direction',
          question: 'Choose a direction',
          options: [{ id: 'local', label: 'Local workbench', description: 'Choose for the POC.' }],
        },
      },
      {
        id: 'choice',
        cursor: 'durable:choice',
        kind: 'ask',
        exchangeId: 'candidate-direction',
        question: 'Choose a direction',
        options: [{ id: 'local', label: 'Local workbench', description: 'Choose for the POC.' }],
      },
    ]);

    render(<BrunchWebApp runtime={createBrunchWebRuntime({ rpcClient: f.client })} />);

    expect(await screen.findByRole('heading', { name: 'Choose a direction' })).toBeTruthy();
    expect(screen.getByRole('article', { name: 'Local workbench' })).toBeTruthy();
    expect(screen.getByText('Make local graph work the thesis.')).toBeTruthy();
    fireEvent.click(screen.getByRole('radio', { name: /Local workbench/u }));
    fireEvent.click(screen.getByRole('button', { name: 'Answer' }));
    expect(f.calls).toContainEqual({
      method: 'session.answerExchange',
      params: expect.objectContaining({ exchangeId: 'candidate-direction', answer: 'local' }),
    });
  });

  it('renders a proposition-first review set and exact approved receipt without acceptance controls', async () => {
    window.history.pushState(null, '', '/session/1/s1');
    const f = fixture([
      {
        id: 'review-offer',
        cursor: 'durable:review-offer',
        kind: 'present_review_set',
        exchangeId: 'review-set',
        heading: 'Approve graph changes',
        body: 'One cohesive set.',
        reviewSet: {
          nodes: [
            { draft_id: 'goal', proposed_code: 'G1', plane: 'intent', kind: 'goal', title: 'Clear outcome' },
            {
              draft_id: 'req',
              proposed_code: 'REQ1',
              plane: 'intent',
              kind: 'requirement',
              title: 'Atomic approval',
              body: 'Commit once.',
              detail: { priority: 'high' },
            },
          ],
          edges: [
            {
              category: 'dependency',
              dependency: { draft_id: 'goal' },
              dependent: { draft_id: 'req' },
              rationale: 'Requirement serves goal.',
            },
          ],
        },
        continuation: {
          tool: 'ask',
          params: { body: 'Approve graph changes', options: [{ id: 'approve', label: 'Approve' }] },
        },
      },
      {
        id: 'review-terminal',
        cursor: 'durable:review-terminal',
        kind: 'ask',
        exchangeId: 'review-set',
        question: 'Review decision',
        terminal: {
          status: 'answered',
          value: {
            decision: 'approve',
            receipt: {
              status: 'success',
              lsn: 7,
              createdNodes: { req: { id: 2, code: 'REQ1' } },
              createdEdges: [3],
              updatedNodes: [4],
              updatedEdges: [5],
              deletedNodes: [6],
              deletedEdges: [7],
            },
          },
        },
      },
    ]);

    render(<BrunchWebApp runtime={createBrunchWebRuntime({ rpcClient: f.client })} />);

    expect(await screen.findByRole('region', { name: 'Approve graph changes' })).toBeTruthy();
    expect(screen.getAllByRole('article').map((article) => article.getAttribute('aria-label'))).toEqual([
      'G1 Clear outcome',
      'REQ1 Atomic approval',
    ]);
    expect(screen.getByRole('region', { name: 'Proposed consequences' }).textContent).toContain(
      'dependency — Requirement serves goal.',
    );
    expect(screen.getByText('Decision: Approve')).toBeTruthy();
    expect(screen.getByLabelText('Graph commit receipt').textContent).toContain('LSN7');
    expect(screen.getByLabelText('Graph commit receipt').textContent).toContain('REQ1');
    expect(screen.queryByRole('button', { name: /approve|accept|reject/u })).toBeNull();
  });

  it('renders digest prose and feedback terminals while the existing ask owns continuation answers', async () => {
    window.history.pushState(null, '', '/session/1/s1');
    const f = fixture([
      {
        id: 'digest',
        cursor: 'durable:digest',
        kind: 'present_digest',
        exchangeId: 'digest-final',
        heading: 'Review source digest',
        body: 'Confirm before capture.',
        digest: {
          abstract: 'One shared semantic projection.',
          analysis: 'Independent decoding would drift.',
          recommendation: 'Render the projection.',
        },
        continuation: { tool: 'ask', params: { body: 'Does this understanding sound right?' } },
      },
      {
        id: 'confirmation',
        cursor: 'durable:confirmation',
        kind: 'ask',
        exchangeId: 'digest-confirmation',
        question: 'Does this understanding sound right?',
        terminal: {
          status: 'answered',
          value: {
            choice: { id: 'yes', label: 'Yes', kind: 'listed' },
            options: [
              { id: 'yes', content: 'Yes' },
              { id: 'changes', content: 'Needs changes' },
            ],
            acceptsDigest: 'digest-final',
            acceptedAbstract: 'One shared semantic projection.',
          },
        },
      },
      {
        id: 'review',
        cursor: 'durable:review',
        kind: 'ask',
        exchangeId: 'digest-final',
        question: 'Digest review',
        terminal: {
          status: 'answered',
          value: { decision: 'request_changes', comment: 'Keep it advisory.' },
        },
      },
      {
        id: 'feedback',
        cursor: 'durable:feedback',
        kind: 'ask',
        exchangeId: 'digest-final',
        question: 'Add corrections',
      },
    ]);

    render(<BrunchWebApp runtime={createBrunchWebRuntime({ rpcClient: f.client })} />);

    expect(await screen.findByRole('region', { name: 'Review source digest' })).toBeTruthy();
    expect(screen.getByText('One shared semantic projection.')).toBeTruthy();
    expect(screen.getByText('Independent decoding would drift.')).toBeTruthy();
    expect(screen.getByText('Render the projection.')).toBeTruthy();
    expect(screen.getByText('Accepted abstract: One shared semantic projection.')).toBeTruthy();
    expect(screen.getByText('Decision: Request changes')).toBeTruthy();
    expect(screen.getByText('Comment: Keep it advisory.')).toBeTruthy();
    fireEvent.change(screen.getByRole('textbox', { name: 'Add corrections' }), {
      target: { value: 'Clarify the source.' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Answer' }));
    expect(f.calls).toContainEqual({
      method: 'session.answerExchange',
      params: expect.objectContaining({ exchangeId: 'digest-final', answer: 'Clarify the source.' }),
    });
  });

  it('renders an ordered questionnaire read-back from the shared semantic projection', async () => {
    window.history.pushState(null, '', '/session/1/s1');
    const f = fixture([
      {
        id: 'questionnaire',
        cursor: 'durable:questionnaire',
        kind: 'ask',
        exchangeId: 'questionnaire',
        question: 'Digest questionnaire',
        terminal: {
          status: 'answered',
          value: {
            questionnaire: [
              {
                question: { id: 'goal', kind: 'free-text', prompt: 'What matters?' },
                answer: { questionId: 'goal', kind: 'free-text', text: 'Clarity' },
              },
              {
                question: {
                  id: 'route',
                  kind: 'single-select',
                  prompt: 'Which route?',
                  options: [{ id: 'safe', label: 'Safe path' }],
                },
                answer: { questionId: 'route', kind: 'single-select', optionId: 'safe' },
              },
              {
                question: {
                  id: 'checks',
                  kind: 'multi-select',
                  prompt: 'Which checks?',
                  options: [
                    { id: 'tests', label: 'Tests' },
                    { id: 'types', label: 'Types' },
                  ],
                },
                answer: { questionId: 'checks', kind: 'multi-select', optionIds: ['types', 'tests'] },
              },
            ],
            acceptsDigest: 'digest-final',
            acceptedAbstract: 'The accepted digest abstract.',
          },
        },
      },
    ]);

    render(<BrunchWebApp runtime={createBrunchWebRuntime({ rpcClient: f.client })} />);

    const answers = await screen.findAllByRole('listitem');
    expect(answers.map((answer) => answer.textContent)).toEqual([
      'user: History',
      'Digest questionnaireWhat matters?ClarityWhich route?Safe pathWhich checks?Types, TestsAccepted abstract: The accepted digest abstract.',
    ]);
    expect(screen.queryByRole('button', { name: 'Answer' })).toBeNull();
  });

  it('hydrates an already-open ask on load so a reconnecting client can answer it', async () => {
    window.history.pushState(null, '', '/session/1/s1');
    const options = [
      { id: 'yes', label: 'Yes' },
      { id: 'no', label: 'No' },
    ];
    const f = fixture(
      [],
      [{ exchangeId: 'pending-ask', mode: 'single-select', question: { body: 'Still pending?', options } }],
    );

    render(<BrunchWebApp runtime={createBrunchWebRuntime({ rpcClient: f.client })} />);

    // No live event is emitted: the ask must surface purely from the load-time
    // session.openAsks hydration.
    expect(await screen.findByRole('radio', { name: /Yes/u })).toBeTruthy();
    fireEvent.click(screen.getByRole('radio', { name: /Yes/u }));
    fireEvent.click(screen.getByRole('button', { name: 'Answer' }));
    expect(f.calls).toContainEqual({
      method: 'session.answerExchange',
      params: expect.objectContaining({ exchangeId: 'pending-ask', answer: 'yes' }),
    });
  });

  it('hydrates, drives, reduces targeted live state, answers, settles, and recovers durably', async () => {
    window.history.pushState(null, '', '/session/1/s1');
    const f = fixture();
    const runtime = createBrunchWebRuntime({ rpcClient: f.client });
    const rendered = render(<BrunchWebApp runtime={runtime} />);

    expect(await screen.findByText(/History/u)).toBeTruthy();
    const textarea = screen.getByRole<HTMLTextAreaElement>('textbox', { name: 'Message' });
    fireEvent.change(textarea, { target: { value: 'Go' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));
    expect(screen.getByRole('main').getAttribute('aria-busy')).toBe('true');
    expect(f.calls.some((call) => call.method === 'session.driveTurn')).toBe(true);
    await waitFor(() => expect(textarea.value).toBe(''));

    await act(async () => {
      f.emit({
        target: { specId: 2, sessionId: 'other' },
        seq: 0,
        delta: { type: 'assistant_text_delta', runId: 'run:1', text: 'Wrong' },
      });
      f.emit({
        target: { specId: 1, sessionId: 's1' },
        seq: 0,
        delta: { type: 'assistant_text_delta', runId: 'run:1', text: 'Hel' },
      });
      f.emit({
        target: { specId: 1, sessionId: 's1' },
        seq: 1,
        delta: { type: 'assistant_text_delta', runId: 'run:1', text: 'lo' },
      });
      f.emit({
        target: { specId: 1, sessionId: 's1' },
        seq: 2,
        delta: {
          type: 'ask_opened',
          ask: { exchangeId: 'ask-1', mode: 'text', question: { body: 'Proceed?' } },
        },
      });
    });
    expect(screen.getByText(/Hello/u)).toBeTruthy();
    expect(screen.queryByText(/Wrong/u)).toBeNull();
    fireEvent.change(screen.getByRole('textbox', { name: 'Proceed?' }), { target: { value: 'Yes' } });
    fireEvent.click(screen.getByRole('button', { name: 'Answer' }));
    expect(f.calls.some((call) => call.method === 'session.answerExchange')).toBe(true);

    await act(async () => {
      f.emit({ target: { specId: 1, sessionId: 's1' }, seq: 3, delta: { type: 'agent_settled' } });
    });
    await waitFor(() => expect(f.reads()).toBeGreaterThan(1));
    expect(screen.getByRole('main').getAttribute('aria-busy')).toBe('false');
    expect(screen.getByText(/Hello/u)).toBeTruthy();

    rendered.unmount();
    render(<BrunchWebApp runtime={createBrunchWebRuntime({ rpcClient: f.client })} />);
    expect(await screen.findByText(/Hello/u)).toBeTruthy();
  });
});
