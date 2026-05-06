import { anthropic } from '@ai-sdk/anthropic';
import { streamText } from 'ai';
import type { Request, Response } from 'express';
import * as z from 'zod/v4';

import type { EntitiesData, MutationErrorResponse } from '@/shared/api-types.js';
import { knowledgeKinds, type KnowledgeKind } from '@/shared/knowledge.js';

import { getEntitiesForSpecificationByMode, getSpecification, type DB } from './db.js';
import { buildSideChatPrompt, type SideChatPinnedItem } from './side-chat-prompt.js';

const sideChatPriorTurnSchema = z.object({
  role: z.enum(['user', 'assistant']),
  text: z.string().min(1),
});

const sideChatRequestSchema = z.object({
  itemKind: z.enum(knowledgeKinds),
  itemId: z.number().int().positive(),
  message: z.string().trim().min(1),
  history: z.array(sideChatPriorTurnSchema).optional(),
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

  const { system, messages } = buildSideChatPrompt(
    item,
    parsed.data.message,
    {
      specName: specification.name,
      groundingSummary: null,
    },
    parsed.data.history ?? [],
  );

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
    abortSignal: abortController.signal,
  });

  try {
    for await (const chunk of result.textStream) {
      if (abortController.signal.aborted) {
        break;
      }
      res.write(`data: ${JSON.stringify({ type: 'text-delta', delta: chunk })}\n\n`);
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
