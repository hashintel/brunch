import type { OpenAsk } from './live-ask-registry.js';
import type { LiveExchangeAnswerOutcome } from './live-exchange-broker.js';

export interface SessionTarget {
  readonly specId: number;
  readonly sessionId: string;
}

export type SessionPresentationDelta =
  | { readonly type: 'assistant_text_delta'; readonly runId: string; readonly text: string }
  | { readonly type: 'agent_settled' }
  | { readonly type: 'ask_opened'; readonly ask: OpenAsk };

export interface LiveSessionEvent {
  readonly target: SessionTarget;
  readonly seq: number;
  readonly delta: SessionPresentationDelta;
}

export interface LiveSessionRuntime {
  prompt(text: string): Promise<void>;
  openAsks(): readonly OpenAsk[];
  answerExchange(exchangeId: string, answer: string): LiveExchangeAnswerOutcome;
  subscribe(listener: (delta: SessionPresentationDelta) => void): () => void;
  dispose(): Promise<void>;
}

export type LiveSessionHostResult = {
  readonly status:
    | 'opened'
    | 'attached'
    | 'completed'
    | 'closed'
    | 'busy'
    | 'not_open'
    | 'ask_closed'
    | 'invalid_answer'
    | 'driver_conflict';
};

export interface LiveSessionHost {
  open(target: SessionTarget): Promise<LiveSessionHostResult>;
  close(target: SessionTarget): Promise<LiveSessionHostResult>;
  driveTurn(target: SessionTarget, driverId: string, prompt: string): Promise<LiveSessionHostResult>;
  openAsks(target: SessionTarget): readonly OpenAsk[] | undefined;
  answerExchange(
    target: SessionTarget,
    driverId: string,
    exchangeId: string,
    answer: string,
  ): LiveSessionHostResult;
  subscribeAll(listener: (event: LiveSessionEvent) => void): () => void;
  dispose(): Promise<void>;
}

interface RuntimeCell {
  readonly target: SessionTarget;
  readonly runtime: LiveSessionRuntime;
  detach: () => void;
  seq: number;
  driving: boolean;
  driverId: string | null;
}

export class ActiveLiveSessionError extends Error {
  constructor(readonly targets: readonly SessionTarget[]) {
    super('Cannot dispose LiveSessionHost while a turn is active');
    this.name = 'ActiveLiveSessionError';
  }
}

export function sessionTargetKey(target: SessionTarget): string {
  return `${target.specId}\u0000${target.sessionId}`;
}

export function sameSessionTarget(left: SessionTarget, right: SessionTarget): boolean {
  return left.specId === right.specId && left.sessionId === right.sessionId;
}

export function createLiveSessionHost(options: {
  createRuntime(target: SessionTarget): Promise<LiveSessionRuntime>;
}): LiveSessionHost {
  const cells = new Map<string, RuntimeCell>();
  const opening = new Map<string, Promise<LiveSessionHostResult>>();
  const listeners = new Set<(event: LiveSessionEvent) => void>();
  let disposed = false;

  async function open(target: SessionTarget): Promise<LiveSessionHostResult> {
    const key = sessionTargetKey(target);
    if (cells.has(key)) return { status: 'attached' };
    const pending = opening.get(key);
    if (pending) return pending.then(() => ({ status: 'attached' }));
    const operation = options.createRuntime(target).then(async (runtime) => {
      if (disposed) {
        await runtime.dispose();
        return { status: 'opened' as const };
      }
      const cell: RuntimeCell = {
        target,
        runtime,
        seq: 0,
        driving: false,
        driverId: null,
        detach: () => {},
      };
      cell.detach = runtime.subscribe((delta) => {
        const event = { target, seq: cell.seq++, delta } satisfies LiveSessionEvent;
        for (const listener of listeners) listener(event);
      });
      cells.set(key, cell);
      return { status: 'opened' as const };
    });
    opening.set(key, operation);
    try {
      return await operation;
    } finally {
      opening.delete(key);
    }
  }

  function cellFor(target: SessionTarget): RuntimeCell | undefined {
    return cells.get(sessionTargetKey(target));
  }

  async function teardownCell(key: string, cell: RuntimeCell): Promise<void> {
    cells.delete(key);
    cell.detach();
    await cell.runtime.dispose();
  }

  return {
    open,
    async close(target) {
      const key = sessionTargetKey(target);
      const cell = cells.get(key);
      if (!cell) return { status: 'not_open' };
      if (cell.driving) return { status: 'busy' };
      await teardownCell(key, cell);
      return { status: 'closed' };
    },
    async driveTurn(target, driverId, prompt) {
      const cell = cellFor(target);
      if (!cell) return { status: 'not_open' };
      if (cell.driverId !== null && cell.driverId !== driverId) return { status: 'driver_conflict' };
      if (cell.driving) return { status: 'busy' };
      cell.driverId = driverId;
      cell.driving = true;
      try {
        await cell.runtime.prompt(prompt);
        return { status: 'completed' };
      } finally {
        cell.driving = false;
      }
    },
    openAsks(target) {
      return cellFor(target)?.runtime.openAsks();
    },
    answerExchange(target, driverId, exchangeId, answer) {
      const cell = cellFor(target);
      if (!cell) return { status: 'not_open' };
      if (cell.driverId !== null && cell.driverId !== driverId) return { status: 'driver_conflict' };
      cell.driverId = driverId;
      const outcome = cell.runtime.answerExchange(exchangeId, answer);
      if (outcome.submitted) return { status: 'completed' };
      return { status: outcome.reason === 'invalid_answer' ? 'invalid_answer' : 'ask_closed' };
    },
    subscribeAll(listener) {
      listeners.add(listener);
      let subscribed = true;
      return () => {
        if (!subscribed) return;
        subscribed = false;
        listeners.delete(listener);
      };
    },
    async dispose() {
      disposed = true;
      await Promise.allSettled(opening.values());
      const activeTargets = [...cells.values()].filter((cell) => cell.driving).map((cell) => cell.target);
      if (activeTargets.length > 0) throw new ActiveLiveSessionError(activeTargets);
      await Promise.all(
        [...cells.keys()].map(async (key) => {
          const cell = cells.get(key);
          if (!cell) return;
          await teardownCell(key, cell);
        }),
      );
    },
  };
}
