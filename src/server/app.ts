import { createUIMessageStream, pipeUIMessageStreamToResponse, validateUIMessages } from 'ai';
import express from 'express';
import type { Request, Response } from 'express';

import type { ProjectState, ProjectListItem, EntitiesData } from '../shared/api-types.js';
import {
  assistantPartsSchema,
  brunchDataPartSchemas,
  brunchValidationTools,
  extractTextFromMessage,
  formatTurnResponseText,
  type BrunchAssistantPart,
  type BrunchUIMessage,
  type BrunchUserPart,
} from '../shared/chat.js';
import {
  extractPrompt,
  finalizeTurn,
  getProjectState,
  listProjectStates,
  createNewProject,
  prepareTurn,
} from './core.js';
import {
  createDb,
  getTurn,
  getOptionsForTurn,
  selectOption,
  updateTurn,
  getEntitiesForProject,
} from './db.js';
import { persistFallbackQuestionText, streamInterviewer } from './interview.js';
import { runObserver } from './observer.js';
import { serializeParts } from './parts.js';

export function createApp(dbPath?: string) {
  const db = createDb(dbPath);
  const app = express();
  app.use(express.json());

  // List all projects
  app.get('/api/projects', (_req: Request, res: Response) => {
    res.json(listProjectStates(db) satisfies ProjectListItem[]);
  });

  // Create a new project
  app.post('/api/projects', (req: Request, res: Response) => {
    const name = typeof req.body.name === 'string' ? req.body.name.trim() : '';
    if (!name) {
      res.status(400).json({ error: 'name is required' });
      return;
    }
    const project = createNewProject(db, name);
    res.status(201).json(project);
  });

  // Get a specific project + active path
  app.get('/api/projects/:id', (req: Request, res: Response) => {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) {
      res.status(400).json({ error: 'Invalid project ID' });
      return;
    }
    const state = getProjectState(db, id);
    if (!state) {
      res.status(404).json({ error: 'Project not found' });
      return;
    }
    res.json(state satisfies ProjectState);
  });

  // Select an option on a turn
  app.post('/api/projects/:id/turns/:turnId/select', (req: Request, res: Response) => {
    const projectId = Number(req.params.id);
    const turnId = Number(req.params.turnId);
    const position = req.body?.position;

    if (Number.isNaN(projectId) || Number.isNaN(turnId)) {
      res.status(400).json({ error: 'Invalid IDs' });
      return;
    }
    if (typeof position !== 'number') {
      res.status(400).json({ error: 'position is required (number)' });
      return;
    }
    const freeText = typeof req.body.freeText === 'string' ? req.body.freeText.trim() : undefined;

    const turn = getTurn(db, turnId);
    if (!turn || turn.project_id !== projectId) {
      res.status(404).json({ error: 'Turn not found' });
      return;
    }

    selectOption(db, turnId, position);

    const options = getOptionsForTurn(db, turnId);
    const selected = options.find((o) => o.position === position);
    const responseText = formatTurnResponseText({
      selectedOptionContents: selected?.content ? [selected.content] : [],
      freeText,
    });

    const dataPart = {
      type: 'data-turn-response',
      data: { turnId, selectedOptionIds: [selected?.id ?? position], ...(freeText ? { freeText } : {}) },
    } as const satisfies Extract<BrunchUserPart, { type: 'data-turn-response' }>;

    updateTurn(db, turnId, {
      answer: responseText,
      user_parts: serializeParts([
        ...(responseText ? ([{ type: 'text', text: responseText }] as const) : []),
        dataPart,
      ] satisfies BrunchUserPart[]),
    });

    res.json({ ok: true });
  });

  // Get entities for a project
  app.get('/api/projects/:id/entities', (req: Request, res: Response) => {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) {
      res.status(400).json({ error: 'Invalid project ID' });
      return;
    }
    res.json(getEntitiesForProject(db, id) satisfies EntitiesData);
  });

  // Conduct turn for a specific project
  app.post('/api/projects/:id/chat', async (req: Request, res: Response) => {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) {
      res.status(400).json({ error: 'Invalid project ID' });
      return;
    }

    let messages: BrunchUIMessage[];
    try {
      messages = await validateUIMessages<BrunchUIMessage>({
        messages: req.body.messages ?? [],
        dataSchemas: brunchDataPartSchemas,
        tools: brunchValidationTools,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Invalid chat payload';
      res.status(400).json({ error: message });
      return;
    }

    const prompt = extractPrompt(messages);
    if (!prompt.trim()) {
      res.status(400).json({ error: 'message content is required' });
      return;
    }

    const lastUserMessage = messages.at(-1);
    const userParts: BrunchUserPart[] =
      lastUserMessage?.role === 'user' && lastUserMessage.parts.length > 0
        ? lastUserMessage.parts.filter(
            (part): part is BrunchUserPart =>
              part.type === 'text' || part.type === 'data-turn-response' || part.type === 'data-confirmation',
          )
        : [{ type: 'text', text: prompt }];

    let prepared: ReturnType<typeof prepareTurn>;
    try {
      prepared = prepareTurn(db, id, prompt, userParts);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      res.status(404).json({ error: message });
      return;
    }

    const stream = createUIMessageStream<BrunchUIMessage>({
      async execute({ writer }) {
        const interviewer = await streamInterviewer(
          db,
          prepared.turn,
          prepared.activePath,
          prompt,
          prepared.turn.phase,
        );

        writer.merge(
          interviewer.toUIMessageStream<BrunchUIMessage>({
            sendReasoning: true,
            sendFinish: false,
          }),
        );

        const finishReason = await interviewer.finishReason;
        finalizeTurn(db, id, prepared.turn.id);

        try {
          const persistedTurn = getTurn(db, prepared.turn.id) ?? prepared.turn;
          const entityIds = await runObserver(db, persistedTurn, id);
          writer.write({
            type: 'data-observer-result',
            data: { entityIds },
          });
        } catch {
          // Observer failures are non-fatal to the interviewer turn.
        }

        writer.write({ type: 'finish', finishReason });
      },
      async onFinish({ responseMessage }) {
        const assistantText = extractTextFromMessage(responseMessage);
        persistFallbackQuestionText(db, prepared.turn.id, assistantText);
        const assistantParts = assistantPartsSchema.parse(responseMessage.parts) as BrunchAssistantPart[];
        updateTurn(db, prepared.turn.id, {
          assistant_parts: serializeParts(assistantParts),
        });
      },
      onError: (error) => (error instanceof Error ? error.message : 'Unknown error'),
    });

    pipeUIMessageStreamToResponse({ response: res, stream });
  });

  return { app, db };
}
