/**
 * Interview module — structured question schema, phase prompts, tool schema,
 * and runInterviewer() generator that owns the full interviewer pipeline.
 *
 * Pure domain: structuredQuestionSchema, getSystemPrompt, SYSTEM_PROMPTS, ASK_QUESTION_TOOL.
 * Shell boundary: persistStructuredQuestion, runInterviewer.
 */
import type Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';

import { buildInterviewerContext } from './context.js';
import type { TurnWithOptions, DomainEvent } from './core.js';
import { createOption, updateTurn, getTurn, type DB, type Turn, type Impact, type Phase } from './db.js';
import { assembleAssistantParts, serializeParts } from './parts.js';
import { createAnthropicClient, createStreamTranslator, extractMetrics } from './sdk.js';

/** Zod schema for the ask_question tool output. */
export const structuredQuestionSchema = z.object({
  question: z.string().min(1),
  why: z.string().min(1),
  impact: z.enum(['high', 'medium', 'low']),
  options: z
    .array(
      z.object({
        content: z.string().min(1),
        is_recommended: z.boolean(),
      }),
    )
    .min(2),
});

export type StructuredQuestion = z.infer<typeof structuredQuestionSchema>;

/**
 * Hand-written JSON schema for the ask_question tool.
 * Kept in sync with structuredQuestionSchema by test (A27).
 * Hand-written to avoid Zod-to-JSON-Schema edge cases (minItems, etc.).
 */
export const ASK_QUESTION_TOOL: Anthropic.Messages.Tool = {
  name: 'ask_question',
  description:
    'Ask the user a structured interview question with options, strategic grounding, and impact signal.',
  input_schema: {
    type: 'object' as const,
    properties: {
      question: { type: 'string', description: 'The interview question' },
      why: { type: 'string', description: 'Why this question matters for the spec' },
      impact: { type: 'string', enum: ['high', 'medium', 'low'] },
      options: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            content: { type: 'string' },
            is_recommended: { type: 'boolean' },
          },
          required: ['content', 'is_recommended'],
        },
        minItems: 2,
      },
    },
    required: ['question', 'why', 'impact', 'options'],
  },
};

const SYSTEM_PROMPTS: Record<Phase, string> = {
  scope: `You are a spec elicitation interviewer conducting the SCOPE phase.

Your job is to understand the user's project goal, target audience, and high-level constraints through structured questions. Work from broad framing questions toward specific scope boundaries.

For every turn, you MUST use the ask_question tool to generate your question. Never respond with plain text — always use the tool.

Each question should:
- Be clear and specific, not vague or open-ended
- Include 2-4 options that represent meaningfully different directions
- Mark exactly one option as recommended based on what you know so far
- Include a "why" field explaining why this question matters for the spec
- Include an impact level (high/medium/low) reflecting how much this decision affects downstream choices

Ask one question at a time. Build on previous answers to go deeper.`,

  design: `You are a spec elicitation interviewer conducting the DESIGN phase.

Your job is to walk the design decision tree — exploring architectural choices, module boundaries, data models, and integration points. Each question drills into a branch of the design space.

For every turn, you MUST use the ask_question tool. Never respond with plain text.

Each question should present meaningfully different design alternatives with clear tradeoffs in the options.`,

  requirements: `You are a spec elicitation interviewer conducting the REQUIREMENTS REVIEW phase.

Your job is to walk the accumulated requirements, check for gaps, suggest additions, and confirm completeness. Present requirements for the user to confirm, modify, or flag as missing.

For every turn, you MUST use the ask_question tool. Never respond with plain text.`,

  criteria: `You are a spec elicitation interviewer conducting the CRITERIA phase.

Your job is to propose testable acceptance criteria for each confirmed requirement. Criteria should be specific, observable, and verifiable.

For every turn, you MUST use the ask_question tool. Never respond with plain text.`,
};

/** Phase-specific system prompts. */
export function getSystemPrompt(phase: Phase): string {
  return SYSTEM_PROMPTS[phase];
}

/**
 * Persist structured question data from tool call args to the turn and options tables.
 * Extracted as a helper for testability — called after parsing tool_use block from stream.
 */
export function persistStructuredQuestion(db: DB, turnId: number, args: StructuredQuestion) {
  updateTurn(db, turnId, {
    question: args.question,
    why: args.why,
    impact: args.impact as Impact,
  });
  for (let i = 0; i < args.options.length; i++) {
    createOption(db, turnId, {
      position: i,
      content: args.options[i].content,
      is_recommended: args.options[i].is_recommended,
    });
  }
}

/**
 * Run the interviewer agent. Streams DomainEvents from the raw Anthropic SDK
 * and persists turn-level data (assistant text, parts, structured question) when done.
 * Each call owns its full pipeline: prompt, tools, streaming, persistence.
 */
export async function* runInterviewer(
  db: DB,
  turn: Turn,
  activePath: TurnWithOptions[],
  userMessage: string,
  phase: Phase,
): AsyncGenerator<DomainEvent> {
  const client = createAnthropicClient();
  const fullPrompt = buildInterviewerContext(activePath, userMessage);
  const { translate } = createStreamTranslator();

  let assistantText = '';
  const collectedEvents: DomainEvent[] = [];
  let toolCallArgs = '';

  const startMs = Date.now();

  const stream = client.messages.stream({
    model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-20250514',
    max_tokens: 16000,
    thinking: { type: 'enabled', budget_tokens: 10000 },
    system: getSystemPrompt(phase),
    messages: [{ role: 'user', content: fullPrompt }],
    tools: [ASK_QUESTION_TOOL],
    tool_choice: { type: 'auto' },
  });

  for await (const rawEvent of stream) {
    for (const event of translate(rawEvent)) {
      collectedEvents.push(event);
      if (event.type === 'text-delta') {
        assistantText += event.delta;
      }
      if (event.type === 'tool-call-delta') {
        toolCallArgs += event.delta;
      }
      yield event;
    }
  }

  const durationMs = Date.now() - startMs;

  // Parse and persist structured question from tool call
  if (toolCallArgs) {
    try {
      const parsed = structuredQuestionSchema.parse(JSON.parse(toolCallArgs));
      persistStructuredQuestion(db, turn.id, parsed);
    } catch {
      // Tool args failed validation — fall through to text-based persistence
    }
  }

  // Persist turn-level data
  const currentTurn = getTurn(db, turn.id);
  const parts = assembleAssistantParts(collectedEvents);

  updateTurn(db, turn.id, {
    ...(assistantText && (!currentTurn?.question || currentTurn.question === '')
      ? { question: assistantText }
      : {}),
    ...(parts.length > 0 ? { assistant_parts: serializeParts(parts) } : {}),
  });

  // Yield metrics from raw API
  const finalMessage = await stream.finalMessage();
  yield extractMetrics('interviewer', {
    inputTokens: finalMessage.usage.input_tokens,
    outputTokens: finalMessage.usage.output_tokens,
    durationMs,
  });
}
