import { anthropic } from '@ai-sdk/anthropic';
import { streamText } from 'ai';
import type { Request, Response } from 'express';
import * as z from 'zod/v4';

import type { EntitiesData, MutationErrorResponse } from '@/shared/api-types.js';
import { knowledgeKinds, type KnowledgeKind } from '@/shared/knowledge.js';

import {
  getDownstreamItems,
  getEntitiesForSpecificationByMode,
  getSpecification,
  isItemInActiveReviewSet,
  type DB,
} from './db.js';
import { classifyEditImpact, type EditImpactTier } from './edit-impact.js';
import {
  buildSideChatPrompt,
  getSideChatTools,
  proposeDrillDownToolName,
  proposeEdgeToolName,
  proposeEditToolName,
  type SideChatPinnedItem,
} from './side-chat-prompt.js';

const sideChatPriorTurnSchema = z.object({
  role: z.enum(['user', 'assistant']),
  text: z.string().min(1),
});

const activeAnnotationSchema = z.object({
  referenceCode: z.string().min(1),
  snapshot: z.string().min(1),
  body: z.string().nullable(),
});

const sideChatRequestSchema = z.object({
  itemKind: z.enum(knowledgeKinds),
  itemId: z.number().int().positive(),
  message: z.string().trim().min(1),
  history: z.array(sideChatPriorTurnSchema).optional(),
  activeAnnotations: z.array(activeAnnotationSchema).optional(),
  spanHint: z.string().min(1).optional(),
  mode: z.enum(['explore', 'edit']).optional(),
});

interface ResolvedEntity {
  referenceCode: string;
  content: string;
  rationale: string | null;
}

function resolveEntity(entities: EntitiesData, kind: KnowledgeKind, id: number): ResolvedEntity | null {
  if (kind === 'assumption') {
    const match = entities.assumptions.find((item) => item.id === id);
    if (!match || !match.referenceCode) {
      return null;
    }
    return { referenceCode: match.referenceCode, content: match.content, rationale: null };
  }

  const withRationale = (() => {
    switch (kind) {
      case 'goal':
        return entities.goals;
      case 'term':
        return entities.terms;
      case 'context':
        return entities.contexts;
      case 'constraint':
        return entities.constraints;
      case 'requirement':
        return entities.requirements;
      case 'criterion':
        return entities.criteria;
      case 'decision':
        return entities.decisions;
    }
  })();

  const match = withRationale.find((item) => item.id === id);
  if (!match || !match.referenceCode) {
    return null;
  }
  return {
    referenceCode: match.referenceCode,
    content: match.content,
    rationale: match.rationale ?? null,
  };
}

function badRequest(res: Response, error: string): void {
  res.status(400).json({ error } satisfies MutationErrorResponse);
}

function notFound(res: Response, error: string): void {
  res.status(404).json({ error } satisfies MutationErrorResponse);
}

function writeSideChatStreamError(res: Response): void {
  res.write(
    `data: ${JSON.stringify({
      type: 'error',
      message: 'Side-chat stream failed before completion',
    })}\n\n`,
  );
}

export async function handleSideChatRequest(db: DB, req: Request, res: Response): Promise<void> {
  const specificationId = Number(req.params.id);
  if (Number.isNaN(specificationId)) {
    badRequest(res, 'Invalid specification ID');
    return;
  }

  const specification = getSpecification(db, specificationId);
  if (!specification) {
    notFound(res, 'Specification not found');
    return;
  }

  const parsed = sideChatRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    badRequest(res, 'Invalid side-chat payload');
    return;
  }

  const entities = getEntitiesForSpecificationByMode(db, specificationId, 'project-wide');
  const entity = resolveEntity(entities, parsed.data.itemKind, parsed.data.itemId);
  if (!entity) {
    notFound(res, 'Item not found in specification');
    return;
  }

  const item: SideChatPinnedItem = {
    kind: parsed.data.itemKind,
    referenceCode: entity.referenceCode,
    content: entity.content,
    rationale: entity.rationale,
  };

  const mode = parsed.data.mode ?? 'explore';

  const { system, messages } = buildSideChatPrompt(
    item,
    parsed.data.message,
    {
      specName: specification.name,
      groundingSummary: null,
    },
    parsed.data.history ?? [],
    {
      activeAnnotations: parsed.data.activeAnnotations,
      spanHint: parsed.data.spanHint,
      mode,
    },
  );

  const tools = getSideChatTools(mode);

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const abortController = new AbortController();
  const onClientClose = (): void => {
    if (!res.writableEnded) {
      abortController.abort();
    }
  };
  res.on('close', onClientClose);

  const result = streamText({
    model: anthropic(process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-20250514'),
    system,
    messages: messages.map((message) => ({ role: message.role, content: message.content })),
    tools,
    abortSignal: abortController.signal,
  });

  // Pre-compute the edit-impact tier for the active item once per request so
  // patch-proposal chunks for propose_edit can carry it through to the client
  // (design §4.1: each edit patch shows its impact tier in the patch list).
  // Computed lazily — only when an edit-mode request actually targets the
  // pinned item — and reused for every propose_edit chunk in this stream.
  const computeEditImpact = (): EditImpactTier => {
    const downstream = getDownstreamItems(db, specificationId, parsed.data.itemId);
    const inReviewSet =
      isItemInActiveReviewSet(db, specificationId, parsed.data.itemId) ||
      downstream.some((downstreamItem) => isItemInActiveReviewSet(db, specificationId, downstreamItem.id));
    return classifyEditImpact(downstream.length, inReviewSet);
  };
  let cachedEditImpact: EditImpactTier | null = null;

  try {
    for await (const part of result.fullStream) {
      if (abortController.signal.aborted) {
        break;
      }
      const sseChunk = sideChatStreamChunkFromPart(part, () => {
        if (cachedEditImpact === null) {
          cachedEditImpact = computeEditImpact();
        }
        return cachedEditImpact;
      });
      if (sseChunk) {
        res.write(`data: ${JSON.stringify(sseChunk)}\n\n`);
      }
    }
    if (!abortController.signal.aborted) {
      res.write('data: [DONE]\n\n');
    }
  } catch {
    if (!abortController.signal.aborted && !res.writableEnded) {
      writeSideChatStreamError(res);
    }
  } finally {
    res.off('close', onClientClose);
    if (!res.writableEnded) {
      res.end();
    }
  }
}

interface TextDeltaPart {
  type: 'text-delta';
  text: string;
}

interface ToolCallPart {
  type: 'tool-call';
  toolCallId: string;
  toolName: string;
  input: unknown;
}

type SideChatToolName =
  | typeof proposeEditToolName
  | typeof proposeEdgeToolName
  | typeof proposeDrillDownToolName;

type SideChatSseChunk =
  | { type: 'text-delta'; delta: string }
  | {
      type: 'patch-proposal';
      toolCallId: string;
      toolName: SideChatToolName;
      input: unknown;
      // Pre-classified for propose_edit only (design §4.1) so the client can
      // render an impact tier chip on the patch entry before Apply runs.
      // Omitted for propose_edge / propose_drill_down (no impact concept).
      impact?: EditImpactTier;
    };

const SIDE_CHAT_TOOL_NAMES = new Set<string>([
  proposeEditToolName,
  proposeEdgeToolName,
  proposeDrillDownToolName,
]);

function sideChatStreamChunkFromPart(
  part: unknown,
  getEditImpact: () => EditImpactTier,
): SideChatSseChunk | null {
  if (!part || typeof part !== 'object' || !('type' in part)) {
    return null;
  }
  const typed = part as { type: unknown };
  if (typed.type === 'text-delta') {
    const delta = (part as Partial<TextDeltaPart>).text;
    if (typeof delta !== 'string') {
      return null;
    }
    return { type: 'text-delta', delta };
  }
  if (typed.type === 'tool-call') {
    const call = part as Partial<ToolCallPart>;
    if (typeof call.toolName !== 'string' || !SIDE_CHAT_TOOL_NAMES.has(call.toolName)) {
      return null;
    }
    if (typeof call.toolCallId !== 'string') {
      return null;
    }
    const isEdit = call.toolName === proposeEditToolName;
    return {
      type: 'patch-proposal',
      toolCallId: call.toolCallId,
      toolName: call.toolName as SideChatToolName,
      input: call.input ?? null,
      ...(isEdit ? { impact: getEditImpact() } : {}),
    };
  }
  return null;
}
