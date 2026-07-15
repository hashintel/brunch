import { useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import { createRoute } from '@tanstack/react-router';
import { useEffect, useMemo, useState } from 'react';

import type { QuestionnaireAnswer, QuestionnaireQuestion } from '../../exchanges/schemas/questionnaire.js';
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

function questionnaireAnswerText(question: QuestionnaireQuestion, answer: QuestionnaireAnswer): string {
  if (answer.kind === 'free-text') return answer.text;
  const optionIds = answer.kind === 'single-select' ? [answer.optionId] : answer.optionIds;
  if (!('options' in question)) return '';
  const selectedLabels: string[] = [];
  for (const id of optionIds) {
    const option = question.options.find((candidate) => candidate.id === id);
    if (option) selectedLabels.push(option.label);
  }
  return selectedLabels.join(', ');
}

function Ask({
  entry,
  answer,
}: {
  entry: Extract<SessionPresentationEntry, { kind: 'ask' }>;
  answer(value: string): Promise<unknown>;
}) {
  const [value, setValue] = useState('');
  const [values, setValues] = useState<string[]>([]);
  if (entry.terminal) {
    const terminal = entry.terminal;
    return (
      <section aria-label={entry.question}>
        <p>{entry.question}</p>
        {terminal.status === 'answered' ? (
          <>
            {'questionnaire' in terminal.value ? (
              <>
                <dl>
                  {terminal.value.questionnaire.map(({ question, answer }) => (
                    <div key={question.id}>
                      <dt>{question.prompt}</dt>
                      <dd>{questionnaireAnswerText(question, answer)}</dd>
                    </div>
                  ))}
                </dl>
                <p>Accepted abstract: {terminal.value.acceptedAbstract}</p>
              </>
            ) : 'text' in terminal.value ? (
              <p>Answered: {terminal.value.text}</p>
            ) : 'choices' in terminal.value ? (
              terminal.value.choices.map((choice) => (
                <p key={`${choice.kind}:${choice.id}`}>
                  {choice.kind === 'other' ? 'Selected Other' : 'Selected'}: {choice.label}
                </p>
              ))
            ) : (
              <p>
                {terminal.value.choice.kind === 'other' ? 'Selected Other' : 'Selected'}:{' '}
                {terminal.value.choice.label}
              </p>
            )}
            {'comment' in terminal.value && terminal.value.comment ? (
              <p>Comment: {terminal.value.comment}</p>
            ) : null}
          </>
        ) : (
          <p>
            {terminal.status === 'cancelled' ? 'Cancelled' : 'Unavailable'}
            {terminal.value.message ? `: ${terminal.value.message}` : ''}
          </p>
        )}
      </section>
    );
  }
  return (
    <form
      aria-label={entry.question}
      onSubmit={(event) => {
        event.preventDefault();
        const answerValue = entry.mode === 'multi-select' ? values.join(',') : value;
        if (answerValue.trim()) void answer(answerValue);
      }}
    >
      {entry.options ? (
        <fieldset>
          <legend>{entry.question}</legend>
          {entry.options.map((option) => (
            <label key={option.id}>
              <input
                type={entry.mode === 'multi-select' ? 'checkbox' : 'radio'}
                name={entry.exchangeId}
                value={option.id}
                checked={entry.mode === 'multi-select' ? values.includes(option.id) : value === option.id}
                onChange={(event) => {
                  if (entry.mode !== 'multi-select') {
                    setValue(event.target.value);
                    return;
                  }
                  setValues((selected) =>
                    event.target.checked
                      ? [...selected, option.id]
                      : selected.filter((id) => id !== option.id),
                  );
                }}
              />
              {option.label}
              {option.description ? ` — ${option.description}` : ''}
            </label>
          ))}
        </fieldset>
      ) : (
        <label>
          {entry.question}
          <input value={value} onChange={(event) => setValue(event.target.value)} />
        </label>
      )}
      <button disabled={entry.mode === 'multi-select' ? values.length === 0 : !value.trim()}>Answer</button>
    </form>
  );
}
