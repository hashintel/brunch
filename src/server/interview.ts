import { query, createSdkMcpServer, tool } from '@anthropic-ai/claude-agent-sdk';
/**
 * Interview module — structured question schema, phase prompts, MCP tool server,
 * and runInterviewer() generator that owns the full interviewer pipeline.
 *
 * Pure domain: structuredQuestionSchema, getSystemPrompt, SYSTEM_PROMPTS.
 * Shell boundary: createInterviewMcpServer, runInterviewer.
 */
import { z } from 'zod';

import { buildInterviewerContext } from './context.js';
import type { TurnWithOptions, DomainEvent } from './core.js';
import { createOption, updateTurn, getTurn, type DB, type Turn, type Impact, type Phase } from './db.js';
import { assembleAssistantParts, serializeParts } from './parts.js';
import { createStreamTranslator, extractMetrics, type SdkResultMessage } from './sdk.js';

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
 * Create an in-process MCP server with the ask_question tool.
 * The tool handler persists structured data to the given turn.
 */
export function createInterviewMcpServer(db: DB, turnId: number) {
  return createSdkMcpServer({
    name: 'interview',
    tools: [
      tool(
        'ask_question',
        'Ask the user a structured interview question with options, strategic grounding, and impact signal.',
        structuredQuestionSchema.shape,
        async (args) => {
          // Persist structured data to the turn
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
          return {
            content: [{ type: 'text' as const, text: 'Question presented to user.' }],
          };
        },
      ),
    ],
  });
}

/**
 * Run the interviewer agent. Streams DomainEvents from the SDK query
 * and persists turn-level data (assistant text, parts) when done.
 * Each call owns its full pipeline: prompt, tools, streaming, persistence.
 */
export async function* runInterviewer(
  db: DB,
  turn: Turn,
  activePath: TurnWithOptions[],
  userMessage: string,
  phase: Phase,
): AsyncGenerator<DomainEvent> {
  const fullPrompt = buildInterviewerContext(activePath, userMessage);
  const interviewServer = createInterviewMcpServer(db, turn.id);
  const { translate } = createStreamTranslator();

  let assistantText = '';
  const collectedEvents: DomainEvent[] = [];

  const stream = query({
    prompt: fullPrompt,
    options: {
      model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-20250514',
      maxTurns: 1,
      includePartialMessages: true,
      systemPrompt: getSystemPrompt(phase),
      mcpServers: { interview: interviewServer },
      persistSession: false,
    },
  });

  for await (const msg of stream) {
    // Translate SDK stream events to DomainEvents
    for (const event of translate(msg)) {
      collectedEvents.push(event);
      if (event.type === 'text-delta') {
        assistantText += event.delta;
      }
      yield event;
    }

    // Capture ResultMessage for metrics
    if ((msg as Record<string, unknown>).type === 'result') {
      yield extractMetrics('interviewer', msg as unknown as SdkResultMessage);
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
}
