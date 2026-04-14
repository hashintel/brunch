import { createUIMessageStream, pipeUIMessageStreamToResponse, validateUIMessages } from 'ai';
import express from 'express';
import type { Express, Request, Response } from 'express';

import { createProjectRequestSchema, submitTurnResponseRequestSchema } from '@/shared/api-types.js';
import type {
  EntitiesData,
  ExportLoaderData,
  MutationErrorResponse,
  ProjectListItem,
  ProjectState,
  SubmitTurnResponseResponse,
} from '@/shared/api-types.js';
import {
  brunchDataPartSchemas,
  brunchValidationTools,
  extractTextFromMessage,
  filterAssistantParts,
  formatTurnResponseText,
} from '@/shared/chat.js';
import type { BrunchUIMessage, BrunchUserPart } from '@/shared/chat.js';
import {
  getForceCloseActionErrorMessage,
  getForceClosePhaseAction,
  getForcedPhaseClosureSummary,
  parsePhaseClosureCommand,
} from '@/shared/phase-close.js';

import {
  extractPrompt,
  finalizeTurn,
  getProjectState,
  listProjectStates,
  createNewProject,
  prepareTurn,
} from './core.js';
import {
  applyTurnResponseSelections,
  confirmPhaseOutcome,
  createConfirmedPhaseOutcome,
  createDb,
  findPhaseOutcomeForTurn,
  findProposedPhaseOutcomeByTurn,
  getCurrentWorkflowState,
  getTurn,
  getOptionsForTurn,
  updateTurn,
  getEntitiesForProjectByMode,
  recordReviewFromTurnResponse,
  type DB,
  type EntityProjectionMode,
} from './db.js';
import { isExportReady, renderExportMarkdown } from './export.js';
import { persistFallbackQuestionText, streamInterviewer } from './interview.js';
import { runObserver } from './observer.js';
import { serializeParts } from './parts.js';

export interface AppOptions {
  readonly dbPath?: string;
  readonly projectCwd?: string;
}

export interface AppServices {
  readonly app: Express;
  readonly db: DB;
}

function parseEntityProjectionMode(rawMode: unknown): EntityProjectionMode | null {
  if (rawMode === undefined) {
    return 'active-path';
  }

  return rawMode === 'active-path' || rawMode === 'project-wide' ? rawMode : null;
}

export function createApp(dbPathOrOptions?: string | AppOptions): AppServices {
  const options = typeof dbPathOrOptions === 'string' ? { dbPath: dbPathOrOptions } : (dbPathOrOptions ?? {});
  const db = createDb(options.dbPath);
  const projectCwd = options.projectCwd ?? process.cwd();
  const app = express();
  app.use(express.json());

  // App config (cwd for display in AppLayout)
  app.get('/api/config', (_req: Request, res: Response) => {
    res.json({ cwd: projectCwd });
  });

  // List all projects
  app.get('/api/projects', (_req: Request, res: Response) => {
    res.json(listProjectStates(db) satisfies ProjectListItem[]);
  });

  // Create a new project
  app.post('/api/projects', (req: Request, res: Response) => {
    const parsedRequest = createProjectRequestSchema.safeParse(req.body);
    if (!parsedRequest.success) {
      res.status(400).json({ error: 'Invalid project payload' } satisfies MutationErrorResponse);
      return;
    }

    const { name } = parsedRequest.data;
    const mode = parsedRequest.data.mode === 'brownfield' ? ('brownfield' as const) : undefined;
    const cwd = mode === 'brownfield' ? projectCwd : undefined;
    const project = createNewProject(db, name, { mode, cwd });
    res.status(201).json(project);
  });

  // Get a specific project + active path
  app.get('/api/projects/:id', (req: Request, res: Response) => {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) {
      res.status(400).json({ error: 'Invalid project ID' } satisfies MutationErrorResponse);
      return;
    }
    const state = getProjectState(db, id);
    if (!state) {
      res.status(404).json({ error: 'Project not found' } satisfies MutationErrorResponse);
      return;
    }
    res.json(state satisfies ProjectState);
  });

  // Submit a turn response on a turn.
  app.post('/api/projects/:id/turns/:turnId/response', (req: Request, res: Response) => {
    const projectId = Number(req.params.id);
    const turnId = Number(req.params.turnId);

    if (Number.isNaN(projectId) || Number.isNaN(turnId)) {
      res.status(400).json({ error: 'Invalid IDs' } satisfies MutationErrorResponse);
      return;
    }

    const parsedRequest = submitTurnResponseRequestSchema.safeParse(req.body);
    if (!parsedRequest.success) {
      res.status(400).json({ error: 'Invalid turn response payload' } satisfies MutationErrorResponse);
      return;
    }

    const uniquePositions =
      parsedRequest.data.kind === 'select-options' ? [...new Set(parsedRequest.data.positions)] : [];
    const freeText = parsedRequest.data.freeText;

    const turn = getTurn(db, turnId);
    if (!turn || turn.project_id !== projectId) {
      res.status(404).json({ error: 'Turn not found' } satisfies MutationErrorResponse);
      return;
    }

    const options = getOptionsForTurn(db, turnId);
    const selectedOptions = options.filter((option) => uniquePositions.includes(option.position));
    if (selectedOptions.length !== uniquePositions.length) {
      res.status(400).json({ error: 'Selected option not found' } satisfies MutationErrorResponse);
      return;
    }
    applyTurnResponseSelections(db, turnId, uniquePositions);
    recordReviewFromTurnResponse(db, turn, uniquePositions, 'requirementReview', 'requirement');
    recordReviewFromTurnResponse(db, turn, uniquePositions, 'criterionReview', 'criterion');

    const selectedOptionIds = selectedOptions.map((option) => option.id);
    const selectedOptionContents = selectedOptions.map((option) => option.content);
    const responseText = formatTurnResponseText({
      selectedOptionContents,
      freeText,
    });

    const dataPart = {
      type: 'data-turn-response',
      data: { turnId, selectedOptionIds, ...(freeText ? { freeText } : {}) },
    } as const satisfies Extract<BrunchUserPart, { type: 'data-turn-response' }>;

    updateTurn(db, turnId, {
      answer: responseText,
      user_parts: serializeParts([
        ...(responseText ? ([{ type: 'text', text: responseText }] as const) : []),
        dataPart,
      ] satisfies BrunchUserPart[]),
    });

    res.json({ ok: true } satisfies SubmitTurnResponseResponse);
  });

  // Get entities for a project
  app.get('/api/projects/:id/entities', (req: Request, res: Response) => {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) {
      res.status(400).json({ error: 'Invalid project ID' } satisfies MutationErrorResponse);
      return;
    }
    const mode = parseEntityProjectionMode(req.query.mode);
    if (!mode) {
      res.status(400).json({ error: 'Invalid entity projection mode' } satisfies MutationErrorResponse);
      return;
    }
    res.json(getEntitiesForProjectByMode(db, id, mode) satisfies EntitiesData);
  });

  // Export spec as markdown
  app.get('/api/projects/:id/export', (req: Request, res: Response) => {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) {
      res.status(400).json({ error: 'Invalid project ID' } satisfies MutationErrorResponse);
      return;
    }
    const projectState = getProjectState(db, id);
    if (!projectState) {
      res.status(404).json({ error: 'Project not found' } satisfies MutationErrorResponse);
      return;
    }
    const ready = isExportReady(projectState.workflow);
    if (!ready) {
      res.json({ ready: false } satisfies ExportLoaderData);
      return;
    }
    const entities = getEntitiesForProjectByMode(db, id, 'active-path');
    const markdown = renderExportMarkdown(projectState.project.name, entities, projectState.workflow);
    res.json({ ready: true, markdown } satisfies ExportLoaderData);
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
    const lastUserMessage = messages.at(-1);
    const userParts: BrunchUserPart[] =
      lastUserMessage?.role === 'user' && lastUserMessage.parts.length > 0
        ? lastUserMessage.parts.filter(
            (part): part is BrunchUserPart =>
              part.type === 'text' || part.type === 'data-turn-response' || part.type === 'data-confirmation',
          )
        : [{ type: 'text', text: prompt }];
    const confirmationPart = userParts.find(
      (part): part is Extract<BrunchUserPart, { type: 'data-confirmation' }> =>
        part.type === 'data-confirmation',
    );
    const phaseClosureCommand = confirmationPart ? parsePhaseClosureCommand(confirmationPart.data) : null;

    if (!prompt.trim() && !confirmationPart) {
      res.status(400).json({ error: 'message content is required' });
      return;
    }

    if (confirmationPart && !phaseClosureCommand) {
      res.status(400).json({ error: 'Invalid phase-close command' });
      return;
    }

    const forceClosePhase =
      phaseClosureCommand?.kind === 'force-close-active-phase' ? phaseClosureCommand.phase : undefined;
    const confirmationTarget =
      phaseClosureCommand?.kind === 'confirm-proposed-phase-closure'
        ? findProposedPhaseOutcomeByTurn(db, id, phaseClosureCommand.proposalTurnId)
        : undefined;

    if (forceClosePhase) {
      const workflow = getCurrentWorkflowState(db, id);
      const forceCloseAction = getForceClosePhaseAction(workflow, forceClosePhase);
      const forceCloseError = getForceCloseActionErrorMessage(forceCloseAction);
      if (forceCloseError) {
        res.status(400).json({ error: forceCloseError });
        return;
      }
    } else if (confirmationPart && !confirmationTarget) {
      res.status(404).json({ error: 'Phase closure proposal not found' });
      return;
    } else if (
      confirmationTarget &&
      phaseClosureCommand?.kind === 'confirm-proposed-phase-closure' &&
      confirmationTarget.phase !== phaseClosureCommand.phase
    ) {
      res.status(400).json({ error: 'Phase closure confirmation phase mismatch' });
      return;
    }

    let prepared: ReturnType<typeof prepareTurn>;
    try {
      prepared = prepareTurn(db, id, prompt, userParts, forceClosePhase);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      res.status(404).json({ error: message });
      return;
    }

    const stream = createUIMessageStream<BrunchUIMessage>({
      async execute({ writer }) {
        if (confirmationTarget) {
          confirmPhaseOutcome(db, confirmationTarget.id, prepared.turn.id);
          finalizeTurn(db, id, prepared.turn.id);
          writer.write({ type: 'finish', finishReason: 'stop' });
          return;
        }

        if (forceClosePhase) {
          createConfirmedPhaseOutcome(db, {
            projectId: id,
            phase: forceClosePhase,
            proposal_turn_id: prepared.turn.id,
            confirmation_turn_id: prepared.turn.id,
            summary: getForcedPhaseClosureSummary(forceClosePhase),
          });
          finalizeTurn(db, id, prepared.turn.id);
          writer.write({ type: 'finish', finishReason: 'stop' });
          return;
        }

        const project = prepared.project;
        const modeOptions =
          project.mode === 'brownfield' && project.cwd
            ? { mode: 'brownfield' as const, cwd: project.cwd }
            : undefined;

        const interviewer = await streamInterviewer(
          db,
          prepared.turn,
          prepared.activePath,
          prompt,
          prepared.turn.phase,
          modeOptions,
        );

        writer.merge(
          interviewer.toUIMessageStream<BrunchUIMessage>({
            sendReasoning: true,
            sendFinish: false,
          }),
        );

        const finishReason = await interviewer.finishReason;
        finalizeTurn(db, id, prepared.turn.id);

        const phaseOutcome = findPhaseOutcomeForTurn(db, id, prepared.turn.id);
        if (phaseOutcome && phaseOutcome.status === 'proposed') {
          writer.write({
            type: 'data-phase-summary',
            data: {
              turnId: phaseOutcome.proposal_turn_id,
              phase: phaseOutcome.phase,
              summary: phaseOutcome.summary,
            },
          });
        }

        try {
          const persistedTurn = getTurn(db, prepared.turn.id) ?? prepared.turn;
          const entityIds = await runObserver(db, persistedTurn, id);
          writer.write({
            type: 'data-observer-result',
            data: {
              turnId: persistedTurn.id,
              entityIds,
            },
          });
        } catch {
          // Observer failures are non-fatal to the interviewer turn.
        }

        writer.write({ type: 'finish', finishReason });
      },
      async onFinish({ responseMessage }) {
        if (confirmationTarget) {
          return;
        }
        const assistantText = extractTextFromMessage(responseMessage);
        persistFallbackQuestionText(db, prepared.turn.id, assistantText);
        const assistantParts = filterAssistantParts(responseMessage.parts);
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
