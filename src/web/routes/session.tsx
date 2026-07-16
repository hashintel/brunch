import { useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import { createRoute } from '@tanstack/react-router';
import { useEffect, useMemo, useState } from 'react';

import type { QuestionnaireAnswer, QuestionnaireQuestion } from '../../exchanges/schemas/questionnaire.js';
import type { SessionPresentationEntry } from '../../projections/session/session-presentation.js';
import { openAsksResultSchema } from '../../rpc/live-session-contract.js';
import type { LiveSessionEvent, LiveSessionHostResult } from '../../session/live-session-host.js';
import { reduceLiveSessionOverlay } from '../features/session/live-overlay.js';
import { sessionPresentationQueryOptions } from '../queries/session-presentation.js';
import { queryKeys } from '../query-keys.js';
import { parseSpecId } from '../spec-id.js';
import { rootRoute } from './root.js';

export const sessionRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/session/$specId/$sessionId',
  loader: async ({ context, params }) => {
    const specId = parseSpecId(params.specId);
    if (specId === undefined) return { error: 'Invalid spec id.' } as const;
    const target = { specId, sessionId: params.sessionId };
    const presentation = context.queryClient.ensureQueryData(
      sessionPresentationQueryOptions(context.rpcClient, target),
    );
    await context.rpcClient.request('session.open', target);
    const close = async () => {
      try {
        await context.rpcClient.request('session.close', target);
      } catch {
        // Best-effort release must not mask the load failure.
      }
    };
    try {
      // Hydrate asks already open before this attachment: their ask_opened events
      // fired before load, so only the live registry — not the transcript or the
      // live stream — can surface them to a reconnecting client.
      const openAsks = openAsksResultSchema.safeParse(
        await context.rpcClient.request('session.openAsks', target),
      );
      await presentation;
      if (!openAsks.success) {
        await close();
        return { error: 'Session protocol load failed.' } as const;
      }
      return { target, openAsks: openAsks.data.openAsks } as const;
    } catch (error) {
      await close();
      throw error;
    }
  },
  component: SessionPage,
});

function SessionPage() {
  const loaderData = sessionRoute.useLoaderData();
  if ('error' in loaderData) return <main role="alert">{loaderData.error}</main>;
  return <ReadySessionPage target={loaderData.target} openAsks={loaderData.openAsks} />;
}

function ReadySessionPage({
  target,
  openAsks,
}: {
  target: { specId: number; sessionId: string };
  openAsks: ReturnType<typeof openAsksResultSchema.parse>['openAsks'];
}) {
  const { rpcClient } = sessionRoute.useRouteContext();
  const queryClient = useQueryClient();
  const { data: result } = useSuspenseQuery(sessionPresentationQueryOptions(rpcClient, target));
  const [overlay, setOverlay] = useState<SessionPresentationEntry[]>(() =>
    openAsks.reduce<SessionPresentationEntry[]>(
      (entries, ask) => [
        ...reduceLiveSessionOverlay(entries, { target, seq: 0, delta: { type: 'ask_opened', ask } }),
      ],
      [],
    ),
  );
  const [prompt, setPrompt] = useState('');
  const [busy, setBusy] = useState(false);
  const [turnError, setTurnError] = useState<string>();
  const driverId = useMemo(browserDriverId, []);

  useEffect(() => {
    const unsubscribe = rpcClient.subscribeSessionEvents(
      target,
      (event: LiveSessionEvent) => {
        const delta = event.delta;
        if (delta.type === 'assistant_text_delta' || delta.type === 'ask_opened') {
          setOverlay((entries) => [...reduceLiveSessionOverlay(entries, event)]);
        }
        if (delta.type === 'agent_settled') {
          setBusy(false);
          setOverlay([]);
          void queryClient.invalidateQueries({ queryKey: queryKeys.session.presentation(target) });
        }
      },
      {
        onProtocolError(error: Error) {
          console.error('Brunch live-session protocol error', error);
        },
      },
    );
    return () => {
      unsubscribe();
      try {
        void rpcClient.request('session.close', target).catch(() => {});
      } catch {
        // Best-effort release must not block route cleanup.
      }
    };
  }, [queryClient, rpcClient, target]);

  if (result.status !== 'ready') return <main role="alert">Session transcript cannot be displayed.</main>;
  const entries = [...result.presentation.entries, ...overlay];
  return (
    <main className="session-page" aria-busy={busy}>
      <h1>Session {target.sessionId}</h1>
      <ol aria-label="Session transcript">
        {entries.map((entry) => (
          <li key={entry.cursor}>
            {entry.kind === 'message' ? (
              <p>
                <strong>{entry.role}</strong>: {entry.text}
              </p>
            ) : entry.kind === 'present_candidates' ? (
              <CandidateOffer entry={entry} />
            ) : entry.kind === 'present_review_set' ? (
              <ReviewSetOffer entry={entry} />
            ) : entry.kind === 'present_digest' ? (
              <DigestOffer entry={entry} />
            ) : (
              <Ask
                entry={entry}
                answer={(answer) =>
                  rpcClient.request<LiveSessionHostResult>('session.answerExchange', {
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
          setTurnError(undefined);
          void rpcClient
            .request<LiveSessionHostResult>('session.driveTurn', { ...target, driverId, prompt })
            .then((outcome) => {
              if (outcome.status === 'completed') {
                setPrompt('');
                return;
              }
              setBusy(false);
              setTurnError(`Turn could not start (${outcome.status.replaceAll('_', ' ')}).`);
            })
            .catch(() => {
              setBusy(false);
              setTurnError('Turn failed. Please retry.');
            });
        }}
      >
        {turnError ? <p role="alert">{turnError}</p> : null}
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

function CandidateOffer({
  entry,
}: {
  entry: Extract<SessionPresentationEntry, { kind: 'present_candidates' }>;
}) {
  return (
    <section aria-label={entry.heading}>
      <h2>{entry.heading}</h2>
      {entry.body ? <p>{entry.body}</p> : null}
      {entry.candidates.map((candidate) => (
        <article key={candidate.id} aria-label={candidate.title}>
          <h3>{candidate.title}</h3>
          <dl>
            <dt>Core bet</dt>
            <dd>{candidate.user_rubric.core_bet}</dd>
            <dt>Best fit</dt>
            <dd>{candidate.user_rubric.best_fit}</dd>
            <dt>Cost and complexity</dt>
            <dd>{candidate.user_rubric.cost_complexity}</dd>
            <dt>Covers well</dt>
            <dd>{candidate.user_rubric.covers_well}</dd>
            <dt>Main risks</dt>
            <dd>{candidate.user_rubric.main_risks}</dd>
            <dt>Lock-in and constraints</dt>
            <dd>{candidate.user_rubric.lock_in_constraints}</dd>
            {candidate.user_rubric.recommendation ? (
              <>
                <dt>Recommendation</dt>
                <dd>{candidate.user_rubric.recommendation}</dd>
              </>
            ) : null}
            {Object.entries(candidate.meta_rubric).map(([facet, text]) => (
              <div key={facet}>
                <dt>{facet.replaceAll('_', ' ')}</dt>
                <dd>{text}</dd>
              </div>
            ))}
            {candidate.graph_refs.map((reference) => (
              <div key={reference.node_id}>
                <dt>Graph reference</dt>
                <dd>{reference.node_id}</dd>
              </div>
            ))}
          </dl>
        </article>
      ))}
    </section>
  );
}

function ReviewSetOffer({
  entry,
}: {
  entry: Extract<SessionPresentationEntry, { kind: 'present_review_set' }>;
}) {
  return (
    <section aria-label={entry.heading}>
      <h2>{entry.heading}</h2>
      {entry.body ? <p>{entry.body}</p> : null}
      {entry.reviewSet.nodes.map((node) => (
        <article key={node.draft_id} aria-label={`${node.proposed_code} ${node.title}`}>
          <h3>{node.title}</h3>
          <dl>
            <dt>Proposed code</dt>
            <dd>{node.proposed_code}</dd>
            <dt>Plane</dt>
            <dd>{node.plane}</dd>
            <dt>Kind</dt>
            <dd>{node.kind}</dd>
            {node.body ? (
              <>
                <dt>Body</dt>
                <dd>{node.body}</dd>
              </>
            ) : null}
            {node.detail ? (
              <>
                <dt>Detail</dt>
                <dd>{JSON.stringify(node.detail)}</dd>
              </>
            ) : null}
          </dl>
          <ReviewSetConsequences draftId={node.draft_id} entry={entry} />
        </article>
      ))}
      {entry.reviewSet.edges.filter((edge) => !edgeHostDraftId(edge)).length > 0 ? (
        <section aria-label="Other proposed consequences">
          <h3>Other proposed consequences</h3>
          <ul>
            {entry.reviewSet.edges
              .filter((edge) => !edgeHostDraftId(edge))
              .map((edge, index) => (
                <li key={index}>{reviewEdgeText(edge)}</li>
              ))}
          </ul>
        </section>
      ) : null}
    </section>
  );
}

function ReviewSetConsequences({
  draftId,
  entry,
}: {
  draftId: string;
  entry: Extract<SessionPresentationEntry, { kind: 'present_review_set' }>;
}) {
  const edges = entry.reviewSet.edges.filter((edge) => edgeHostDraftId(edge) === draftId);
  return edges.length > 0 ? (
    <section aria-label="Proposed consequences">
      <h4>Proposed consequences</h4>
      <ul>
        {edges.map((edge, index) => (
          <li key={index}>{reviewEdgeText(edge)}</li>
        ))}
      </ul>
    </section>
  ) : null;
}

function edgeHostDraftId(
  edge: Extract<SessionPresentationEntry, { kind: 'present_review_set' }>['reviewSet']['edges'][number],
): string | undefined {
  const endpoint =
    edge.category === 'dependency'
      ? edge.dependent
      : edge.category === 'witness'
        ? edge.oracle
        : edge.category === 'rationale'
          ? edge.support
          : edge.category === 'realization' || edge.category === 'refinement'
            ? edge.concrete
            : edge.category === 'exclusion'
              ? edge.boundary
              : edge.category === 'composition'
                ? edge.part
                : edge.category === 'cross_reference'
                  ? edge.a
                  : edge.successor;
  return 'draft_id' in endpoint ? endpoint.draft_id : undefined;
}

function reviewEdgeText(
  edge: Extract<SessionPresentationEntry, { kind: 'present_review_set' }>['reviewSet']['edges'][number],
): string {
  return `${edge.category.replaceAll('_', ' ')}${edge.rationale ? ` — ${edge.rationale}` : ''}`;
}

function digestDecisionLabel(decision: 'approve' | 'request_changes' | 'reject'): string {
  const label = decision.replace('_', ' ');
  return label[0]!.toUpperCase() + label.slice(1);
}

function DigestOffer({ entry }: { entry: Extract<SessionPresentationEntry, { kind: 'present_digest' }> }) {
  return (
    <section aria-label={entry.heading}>
      <h2>{entry.heading}</h2>
      {entry.body ? <p>{entry.body}</p> : null}
      <h3>Abstract</h3>
      <p>{entry.digest.abstract}</p>
      {entry.digest.analysis ? (
        <>
          <h3>Analysis</h3>
          <p>{entry.digest.analysis}</p>
        </>
      ) : null}
      {entry.digest.recommendation ? (
        <>
          <h3>Recommendation</h3>
          <p>{entry.digest.recommendation}</p>
        </>
      ) : null}
    </section>
  );
}

function Ask({
  entry,
  answer,
}: {
  entry: Extract<SessionPresentationEntry, { kind: 'ask' }>;
  answer: (value: string) => Promise<LiveSessionHostResult>;
}) {
  const [value, setValue] = useState('');
  const [values, setValues] = useState<string[]>([]);
  const [error, setError] = useState<string>();
  const [submitting, setSubmitting] = useState(false);
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
            ) : 'decision' in terminal.value ? (
              <>
                <p>Decision: {digestDecisionLabel(terminal.value.decision)}</p>
                {'acceptedAbstract' in terminal.value && terminal.value.acceptedAbstract ? (
                  <p>Accepted abstract: {terminal.value.acceptedAbstract}</p>
                ) : null}
                {'receipt' in terminal.value && terminal.value.receipt ? (
                  <dl aria-label="Graph commit receipt">
                    <dt>LSN</dt>
                    <dd>{terminal.value.receipt.lsn}</dd>
                    <dt>Created nodes</dt>
                    <dd>
                      {Object.values<{ id: number; code: string }>(terminal.value.receipt.createdNodes)
                        .map((node) => node.code)
                        .join(', ') || 'None'}
                    </dd>
                    <dt>Created edges</dt>
                    <dd>{terminal.value.receipt.createdEdges.join(', ') || 'None'}</dd>
                    <dt>Updated nodes</dt>
                    <dd>{terminal.value.receipt.updatedNodes.join(', ') || 'None'}</dd>
                    <dt>Updated edges</dt>
                    <dd>{terminal.value.receipt.updatedEdges.join(', ') || 'None'}</dd>
                    <dt>Deleted nodes</dt>
                    <dd>{terminal.value.receipt.deletedNodes.join(', ') || 'None'}</dd>
                    <dt>Deleted edges</dt>
                    <dd>{terminal.value.receipt.deletedEdges.join(', ') || 'None'}</dd>
                  </dl>
                ) : null}
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
            {'acceptedAbstract' in terminal.value &&
            !('questionnaire' in terminal.value) &&
            !('decision' in terminal.value) ? (
              <p>Accepted abstract: {terminal.value.acceptedAbstract}</p>
            ) : null}
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
  if (entry.questions) {
    return (
      <section aria-label={entry.question}>
        <p>{entry.question}</p>
        <ol aria-label="Questionnaire questions">
          {entry.questions.map((question) => (
            <li key={question.id}>{question.prompt}</li>
          ))}
        </ol>
        <p role="status">Questionnaire answering is not available in the web interface.</p>
      </section>
    );
  }
  return (
    <form
      aria-label={entry.question}
      onSubmit={(event) => {
        event.preventDefault();
        const answerValue = entry.mode === 'multi-select' ? values.join(',') : value;
        if (!answerValue.trim() || submitting) return;
        setSubmitting(true);
        setError(undefined);
        void answer(answerValue)
          .then((outcome) => {
            if (outcome.status !== 'completed') {
              setError(`Answer could not be submitted (${outcome.status.replaceAll('_', ' ')}).`);
            }
          })
          .catch(() => setError('Answer failed. Please retry.'))
          .finally(() => setSubmitting(false));
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
      {error ? <p role="alert">{error}</p> : null}
      <button disabled={submitting || (entry.mode === 'multi-select' ? values.length === 0 : !value.trim())}>
        Answer
      </button>
    </form>
  );
}
