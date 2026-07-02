/**
 * Deterministic structured-exchange permutation script — probe/dev machinery.
 *
 * Relocated out of product origination (D78-L/D49-L revised 2026-06-12): the
 * product never fabricates a `present_*` offer — the assistant authors
 * openings live from seeded graph facts and the session-local elicitation scratchpad. This
 * script survives solely as the generator for the R24 public-RPC
 * structured-exchange permutation evidence (`public-rpc-parity-proof`) and
 * for fixture-driven exchange tests: probes/tests mint present pairs here
 * (the synthetic call+result writers live in this module — the product only
 * *reads* present pairs) and drive responses through the public RPC surface.
 *
 * Never import this from product code.
 */

import { SessionManager } from '@earendil-works/pi-coding-agent';

import type { PresentDetails } from '../.pi/extensions/exchanges/schemas/index.js';
import { formatPresentQuestion } from '../agents/contexts/exchanges/present-question.js';
import { projectPresentQuestion } from '../projections/exchanges/present-question.js';
import { flushSessionManagerToFile } from '../session/flush-session-manager.js';
import {
  syntheticExchangeToolCallMessage,
  type PendingStructuredExchange,
} from '../session/structured-exchange-loop.js';

/**
 * Mint one deterministic present pair into a session file and flush it —
 * probe/test fixture setup. Opens the file fresh so the mint never clobbers
 * entries other manager instances (RPC handlers) have flushed since.
 */
export function mintDeterministicExchangeIntoSessionFile(
  sessionFile: string,
  completedCount: number,
): PendingStructuredExchange {
  const manager = SessionManager.open(sessionFile);
  const exchange = mintDeterministicExchange(manager, completedCount);
  flushSessionManagerToFile(manager, sessionFile);
  return exchange;
}

/**
 * Mint one deterministic present pair into a session manager — probe/test
 * fixture setup standing in for an assistant-authored offer. Returns the
 * pending exchange so the caller can drive the response through public RPC.
 */
export function mintDeterministicExchange(
  manager: { appendMessage(message: never): unknown },
  completedCount: number,
): PendingStructuredExchange {
  const exchange = nextDeterministicStructuredExchange(completedCount);
  for (const message of presentExchangeMessages(exchange)) {
    manager.appendMessage(message as never);
  }
  return exchange;
}

/**
 * The provider-legal message pair for a synthetic `present_*` offer:
 * synthetic assistant tool call first, then its toolResult referencing the
 * call's id. Append both in order — a bare toolResult is rejected by real
 * providers. Fixture stand-in for an assistant-authored offer; the product
 * never mints these (D78-L revised 2026-06-12).
 */
export function presentExchangeMessages(exchange: PendingStructuredExchange) {
  const projection = presentProjection(exchange);
  const toolCallMessage = syntheticExchangeToolCallMessage(exchange.exchangeId, projection.toolName);
  const toolResultMessage = {
    role: 'toolResult' as const,
    toolCallId: toolCallMessage.content[0].id,
    toolName: projection.toolName,
    content: [{ type: 'text' as const, text: projection.markdown }],
    details: projection.details,
    isError: false as const,
    timestamp: 0 as const,
  };
  return [toolCallMessage, toolResultMessage] as const;
}

function presentProjection(exchange: PendingStructuredExchange): {
  toolName: 'present_question';
  markdown: string;
  details: PresentDetails;
} {
  if (exchange.mode === 'text') {
    const projection = projectPresentQuestion({
      exchangeId: exchange.exchangeId,
      heading: exchange.prompt,
      body: exchange.details,
    });
    return {
      toolName: 'present_question',
      markdown: formatPresentQuestion(projection),
      details: projection.details,
    };
  }

  const projection = projectPresentQuestion({
    exchangeId: exchange.exchangeId,
    heading: exchange.prompt,
    body: exchange.details,
    options: exchange.options,
    multiple: exchange.mode === 'multi-select',
  });
  return {
    toolName: 'present_question',
    markdown: formatPresentQuestion(projection),
    details: projection.details,
  };
}

export function nextDeterministicStructuredExchange(completedCount: number): PendingStructuredExchange {
  const turnNumber = completedCount + 1;
  const script: PendingStructuredExchange[] = [
    {
      exchangeId: `deterministic-grounding-choice-${turnNumber}`,
      lens: 'intent',
      mode: 'single-select',
      prompt: 'Is this a new product or feature from scratch?',
      details: 'Choose the best starting context so later elicitation can ask useful follow-ups.',
      options: [
        {
          id: 'new-from-scratch',
          label: 'Yes — this is new from scratch',
          content: 'Start a new spec workspace from a blank slate.',
          rationale: 'This keeps the parity run focused on initial grounding.',
        },
        {
          id: 'existing-codebase',
          label: 'No — this builds on existing code',
          content: 'Ground the spec in existing implementation constraints.',
          rationale: 'Existing code changes what the elicitor should inspect next.',
        },
        {
          id: 'relates-to-existing-spec',
          label: 'It relates to an existing spec',
          content: 'Connect this work to a prior specification thread.',
          rationale: 'Continuity matters when prior graph intent exists.',
        },
      ],
      note: { allowed: true },
    },
    {
      exchangeId: `deterministic-grounding-text-${turnNumber}`,
      lens: 'intent',
      mode: 'text',
      prompt: 'What are we specifying?',
      details:
        "This covers the text-answer permutation in Brunch's deterministic public-RPC structured-exchange parity proof.",
      options: [],
      note: { allowed: true },
    },
    {
      exchangeId: `deterministic-grounding-multi-${turnNumber}`,
      lens: 'intent',
      mode: 'multi-select',
      prompt: 'Which proof qualities matter for this parity run?',
      details:
        'Select all qualities the deterministic structured-exchange permutation proof should preserve.',
      options: [
        {
          id: 'transcript',
          label: 'Transcript fidelity',
          content: 'Pi JSONL keeps every present/request tuple recoverable.',
          rationale: 'The transcript is the durable source of truth.',
        },
        {
          id: 'projection',
          label: 'Projection fidelity',
          content: 'Brunch projections preserve semantic option artifacts.',
          rationale: 'Public clients depend on projected structured exchange data.',
        },
        {
          id: 'other',
          label: 'Other',
          content: 'Another proof quality should be captured in the note.',
          rationale: 'Other requires a comment so the transcript stays explicit.',
        },
        {
          id: 'none',
          label: 'None',
          content: 'No additional proof qualities matter for this run.',
          rationale: 'None requires a comment to avoid silent dismissal.',
        },
      ],
      note: { allowed: true },
    },
  ];
  return script[completedCount % script.length]!;
}
