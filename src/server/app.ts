import express from 'express';
import type { Request, Response } from 'express';

import { conductTurn, extractPrompt, getProjectState, listProjectStates, createNewProject } from './core.js';
import { createDb, getTurn, getOptionsForTurn, selectOption, updateTurn } from './db.js';
import { serializeParts, type DataOptionSelectionPart } from './parts.js';
import { createDomainAdapter, formatSSE } from './sse-adapter.js';

export function createApp(dbPath?: string) {
  const db = createDb(dbPath);
  const app = express();
  app.use(express.json());

  // List all projects
  app.get('/api/projects', (_req: Request, res: Response) => {
    res.json(listProjectStates(db));
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
    res.json(state);
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

    const turn = getTurn(db, turnId);
    if (!turn || turn.project_id !== projectId) {
      res.status(404).json({ error: 'Turn not found' });
      return;
    }

    selectOption(db, turnId, position);

    const options = getOptionsForTurn(db, turnId);
    const selected = options.find((o) => o.position === position);

    const dataPart: DataOptionSelectionPart = {
      type: 'data-option-selection',
      data: { turnId, selectedOptionId: position },
    };

    updateTurn(db, turnId, {
      answer: selected?.content ?? '',
      user_parts: serializeParts([dataPart]),
    });

    res.json({ ok: true });
  });

  // Conduct turn for a specific project
  app.post('/api/projects/:id/chat', async (req: Request, res: Response) => {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) {
      res.status(400).json({ error: 'Invalid project ID' });
      return;
    }

    const prompt = extractPrompt(req.body.messages ?? []);
    if (!prompt.trim()) {
      res.status(400).json({ error: 'message content is required' });
      return;
    }
    console.log(`POST /api/projects/${id}/chat — prompt:`, JSON.stringify(prompt).substring(0, 100));

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const { translate } = createDomainAdapter();

    try {
      for await (const domainEvent of conductTurn(db, id, prompt)) {
        for (const sseEvent of translate(domainEvent)) {
          res.write(formatSSE(sseEvent));
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      res.write(formatSSE({ type: 'error', errorText: message }));
    }

    // Protocol termination: finish-step + finish after all events (including observer)
    res.write(formatSSE({ type: 'finish-step' }));
    res.write(formatSSE({ type: 'finish', finishReason: 'stop' }));
    res.write(formatSSE('[DONE]'));
    res.end();
  });

  return { app, db };
}
