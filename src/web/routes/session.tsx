import { useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import { createRoute } from '@tanstack/react-router';
import { useEffect, useMemo, useState } from 'react';

import type { SessionPresentationEntry } from '../../projections/session/session-presentation.js';
import type { LiveSessionEvent } from '../../session/live-session-host.js';
import { reduceLiveSessionOverlay } from '../features/session/live-overlay.js';
import { sessionPresentationQueryOptions } from '../queries/session-presentation.js';
import { queryKeys } from '../query-keys.js';
import type { WebSocketRpcNotification } from '../rpc-client.js';
import { rootRoute } from './root.js';

export const sessionRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/session/$specId/$sessionId',
  loader: ({ context, params }) => {
    const target = { specId: Number(params.specId), sessionId: params.sessionId };
    return Promise.all([
      context.rpcClient.request('session.open', target),
      context.queryClient.ensureQueryData(sessionPresentationQueryOptions(context.rpcClient, target)),
    ]);
  },
  component: SessionPage,
});

function SessionPage() {
  const { specId, sessionId } = sessionRoute.useParams();
  const { rpcClient } = sessionRoute.useRouteContext();
  const queryClient = useQueryClient();
  const target = useMemo(() => ({ specId: Number(specId), sessionId }), [specId, sessionId]);
  const { data: result } = useSuspenseQuery(sessionPresentationQueryOptions(rpcClient, target));
  const [overlay, setOverlay] = useState<SessionPresentationEntry[]>([]);
  const [prompt, setPrompt] = useState('');
  const [busy, setBusy] = useState(false);
  const driverId = useMemo(browserDriverId, []);

  useEffect(
    () =>
      rpcClient.subscribe((notification: WebSocketRpcNotification) => {
        if (notification.method !== 'brunch.sessionEvent') return;
        const event = notification.params as LiveSessionEvent;
        const delta = event.delta;
        if (event.target.specId !== target.specId || event.target.sessionId !== target.sessionId) return;
        if (delta.type === 'assistant_text_delta' || delta.type === 'ask_opened') {
          setOverlay((entries) => [...reduceLiveSessionOverlay(entries, event)]);
        }
        if (delta.type === 'agent_settled') {
          setBusy(false);
          setOverlay([]);
          void queryClient.invalidateQueries({ queryKey: queryKeys.session.presentation(target) });
        }
      }),
    [queryClient, rpcClient, target],
  );

  if (result.status !== 'ready') return <main role="alert">Session transcript cannot be displayed.</main>;
  const entries = [...result.presentation.entries, ...overlay];
  return (
    <main className="session-page" aria-busy={busy}>
      <h1>Session {sessionId}</h1>
      <ol aria-label="Session transcript">
        {entries.map((entry) => (
          <li key={entry.cursor}>
            {entry.kind === 'message' ? (
              <p>
                <strong>{entry.role}</strong>: {entry.text}
              </p>
            ) : (
              <Ask
                entry={entry}
                answer={(answer) =>
                  rpcClient.request('session.answerExchange', {
                    ...target,
                    driverId,
                    exchangeId: entry.exchangeId,
                    answer,
                  })
                }
              />
            )}
          </li>
        ))}
      </ol>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (!prompt.trim() || busy) return;
          setBusy(true);
          void rpcClient
            .request('session.driveTurn', { ...target, driverId, prompt })
            .catch(() => setBusy(false));
          setPrompt('');
        }}
      >
        <label>
          Message <textarea value={prompt} onChange={(event) => setPrompt(event.target.value)} />
        </label>
        <button disabled={busy || !prompt.trim()}>Send</button>
      </form>
    </main>
  );
}

const DRIVER_STORAGE_KEY = 'brunch.session.driver-id';

function browserDriverId(): string {
  const existing = sessionStorage.getItem(DRIVER_STORAGE_KEY);
  if (existing) return existing;
  const created = crypto.randomUUID();
  sessionStorage.setItem(DRIVER_STORAGE_KEY, created);
  return created;
}

function Ask({
  entry,
  answer,
}: {
  entry: Extract<SessionPresentationEntry, { kind: 'ask' }>;
  answer(value: string): Promise<unknown>;
}) {
  const [value, setValue] = useState('');
  return (
    <form
      aria-label={entry.question}
      onSubmit={(event) => {
        event.preventDefault();
        if (value.trim()) void answer(value);
      }}
    >
      <label>
        {entry.question}
        <input value={value} onChange={(event) => setValue(event.target.value)} />
      </label>
      <button>Answer</button>
    </form>
  );
}
