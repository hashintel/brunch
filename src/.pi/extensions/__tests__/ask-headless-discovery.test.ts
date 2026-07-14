import { describe, expect, it } from 'vitest';

import { projectPresentDigest } from '../../../exchanges/projections/present-digest.js';
import { zAskDetails } from '../../../exchanges/schemas/index.js';
import { createLiveAskRegistry } from '../../../session/live-ask-registry.js';
import { createAskTool } from '../exchanges/ask.js';
import type { StructuredExchangeUiContext } from '../exchanges/shared/ui-context.js';

type AskToolResult = {
  readonly content: readonly { readonly type: 'text'; readonly text: string }[];
  readonly details: unknown;
  readonly terminate?: true;
};

const HEADLESS_CTX = { hasUI: false } as unknown as StructuredExchangeUiContext;

function runHeadlessAsk(
  registry: ReturnType<typeof createLiveAskRegistry>,
  params: Record<string, unknown>,
): Promise<AskToolResult> {
  const tool = createAskTool(registry.opener) as ReturnType<typeof createAskTool> & {
    execute: (
      id: string,
      params: Record<string, unknown>,
      signal: AbortSignal | undefined,
      onUpdate: unknown,
      ctx: unknown,
    ) => Promise<AskToolResult>;
  };
  return tool.execute('headless-ask', params, undefined, undefined, HEADLESS_CTX);
}

async function tick(): Promise<void> {
  await new Promise((resolve) => setImmediate(resolve));
}

describe('headless ask discovery + broker answering', () => {
  it('registers a free-text ask and answers it headlessly through the broker', async () => {
    const registry = createLiveAskRegistry();
    const done = runHeadlessAsk(registry, { exchangeId: 'free', body: 'What is the goal?' });
    await tick();

    expect(registry.reader.openAsks()).toEqual([
      { exchangeId: 'free', mode: 'text', question: { body: 'What is the goal?' } },
    ]);

    registry.answerer.submitAnswer({ exchangeId: 'free', answer: 'Ship the registry.' });
    const details = zAskDetails.parse((await done).details);
    expect(details).toMatchObject({
      exchange_id: 'free',
      tool_meta: { curr: 'ask', next: 'capture_answer' },
      answered: { text: 'Ship the registry.' },
    });
    expect(registry.reader.stateOf('free')).toBe('answered');
  });

  it('registers a single-select ask and resolves a listed option id from the broker', async () => {
    const registry = createLiveAskRegistry();
    const done = runHeadlessAsk(registry, {
      exchangeId: 'single',
      body: 'Pick the route',
      options: [
        { id: 'fast', label: 'Fast path' },
        { id: 'safe', label: 'Safe path' },
      ],
    });
    await tick();

    expect(registry.reader.openAsks()).toEqual([
      {
        exchangeId: 'single',
        mode: 'single-select',
        question: {
          body: 'Pick the route',
          options: [
            { id: 'fast', label: 'Fast path' },
            { id: 'safe', label: 'Safe path' },
          ],
        },
      },
    ]);

    registry.answerer.submitAnswer({ exchangeId: 'single', answer: 'safe' });
    const details = zAskDetails.parse((await done).details);
    expect(details).toMatchObject({
      exchange_id: 'single',
      tool_meta: { curr: 'ask', next: 'capture_choice' },
      answered: { choice: { id: 'safe', label: 'Safe path', kind: 'listed' } },
    });
  });

  it('registers a multi-select ask and resolves delimited listed option ids', async () => {
    const registry = createLiveAskRegistry();
    const done = runHeadlessAsk(registry, {
      exchangeId: 'multi',
      body: 'Pick all that apply',
      multiple: true,
      options: [
        { id: 'a', label: 'Alpha' },
        { id: 'b', label: 'Beta' },
        { id: 'c', label: 'Gamma' },
      ],
    });
    await tick();

    expect(registry.reader.openAsks()[0]?.mode).toBe('multi-select');

    registry.answerer.submitAnswer({ exchangeId: 'multi', answer: 'a,c' });
    const details = zAskDetails.parse((await done).details);
    expect(details).toMatchObject({
      exchange_id: 'multi',
      tool_meta: { curr: 'ask', next: 'capture_choices' },
      answered: {
        choices: [
          { id: 'a', label: 'Alpha', kind: 'listed' },
          { id: 'c', label: 'Gamma', kind: 'listed' },
        ],
      },
    });
  });

  it('mints a digest carrier only for the canonical confirmation selection', async () => {
    const digest = projectPresentDigest({
      exchangeId: 'digest-final',
      heading: 'Digest',
      digest: { abstract: 'Runtime abstract.' },
    }).details;
    const params = {
      exchangeId: 'confirm-digest',
      acceptsDigest: 'digest-final',
      body: 'Is this complete?',
      options: [
        { id: 'confirm', label: 'Confirm' },
        { id: 'revise', label: 'Revise' },
      ],
    };
    const run = async (answer: 'confirm' | 'revise') => {
      const registry = createLiveAskRegistry();
      const tool = createAskTool(registry.opener) as ReturnType<typeof createAskTool> & {
        execute: (...args: unknown[]) => Promise<AskToolResult>;
      };
      const done = tool.execute('confirm', params, undefined, undefined, {
        hasUI: false,
        sessionManager: {
          getBranch: () => [{ type: 'message', message: { role: 'toolResult', details: digest } }],
        },
      });
      await tick();
      registry.answerer.submitAnswer({ exchangeId: 'confirm-digest', answer });
      return zAskDetails.parse((await done).details);
    };
    expect(await run('confirm')).toMatchObject({
      accepts_digest: 'digest-final',
      answered: { choice: { id: 'confirm' }, accepted_abstract: 'Runtime abstract.' },
    });
    expect(await run('revise')).toMatchObject({ answered: { choice: { id: 'revise' } } });
    expect(await run('revise')).not.toHaveProperty('accepts_digest');
  });

  it('reports the ask cancelled when the broker resolves with no answer', async () => {
    const registry = createLiveAskRegistry();
    const done = runHeadlessAsk(registry, { exchangeId: 'abandon', body: 'Still there?' });
    await tick();

    registry.cancel('abandon');
    const details = zAskDetails.parse((await done).details);
    expect(details).toMatchObject({ exchange_id: 'abandon', tool_meta: { curr: 'ask' }, cancelled: {} });
    expect(registry.reader.openAsks()).toEqual([]);
  });

  it('falls back to unavailable when no UI and no broker is available (unchanged)', async () => {
    const tool = createAskTool() as ReturnType<typeof createAskTool> & {
      execute: (
        id: string,
        params: Record<string, unknown>,
        signal: AbortSignal | undefined,
        onUpdate: unknown,
        ctx: unknown,
      ) => Promise<AskToolResult>;
    };
    const result = await tool.execute(
      'no-broker',
      { exchangeId: 'lonely', body: 'Anyone home?' },
      undefined,
      undefined,
      HEADLESS_CTX,
    );
    const details = zAskDetails.parse(result.details);
    expect(details).toMatchObject({ exchange_id: 'lonely', unavailable: {} });
  });
});
