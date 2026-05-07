import os from 'node:os';

import { createUIMessageStream, pipeUIMessageStreamToResponse, validateUIMessages } from 'ai';
import express from 'express';
import type { ErrorRequestHandler, Express, Request, RequestHandler, Response } from 'express';

import { submitPhaseIntentRequestSchema, submitTurnResponseRequestSchema } from '@/shared/api-types.js';
import type {
  EntitiesData,
  ExportLoaderData,
  MutationErrorResponse,
  SubmitObserverCaptureResponse,
  SubmitPhaseIntentResponse,
  SubmitTurnResponseResponse,
} from '@/shared/api-types.js';
import { brunchDataPartSchemas, brunchValidationTools, extractTextFromMessage } from '@/shared/chat.js';
import type { BrunchAssistantPart, BrunchUIMessage, BrunchUserPart } from '@/shared/chat.js';
import { getPhaseIntentDisplayText } from '@/shared/phase-intents.js';
import { toStructuralArtifactTurnIdSet, turnNeedsObserverCapture } from '@/shared/specification-state.js';
import {
  createSpecificationRequestSchema,
  getSpecificationRecord,
  type SpecificationListItem,
  type SpecificationState,
} from '@/shared/specification.js';

import { handleCreateAnnotation, handleDeleteAnnotation, handleListAnnotations } from './annotation-route.js';
import {
  applyChatRouteTransition,
  type ChatCommand,
  type ChatRouteTransitionErrorKind,
} from './chat-route-transition.js';
import {
  createNewSpecification,
  extractPrompt,
  finalizeTurn,
  getSpecificationState,
  listSpecifications,
} from './core.js';
import {
  createDb,
  findPhaseOutcomeForTurn,
  updateTurn,
  getEntitiesForSpecificationByMode,
  getTurn,
  type DB,
  type EntityProjectionMode,
} from './db.js';
import { isExportReady, renderExportMarkdown } from './export.js';
import { persistFallbackQuestionText, streamInterviewer } from './interview.js';
import { runObserver } from './observer.js';
import { safeDeserializeAssistantParts, serializeParts } from './parts.js';
import { submitPhaseIntentWithRuntimeCompatibility } from './phase-intent-runtime.js';
import { handleSideChatRequest } from './side-chat-route.js';
import { createCoreTools } from './tools/index.js';
import { materializeTurnArtifacts } from './turn-artifacts.js';
import {
  submitTurnResponseTransition,
  type SubmitTurnResponseTransitionErrorKind,
} from './turn-response-transition.js';

export interface AppOptions {
  readonly dbPath?: string;
  readonly projectCwd?: string;
}

export interface AppServices {
  readonly app: Express;
  readonly db: DB;
}

const JSON_BODY_LIMIT = '5mb';

function isPayloadTooLargeError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  const parserError = error as Error & {
    readonly status?: unknown;
    readonly statusCode?: unknown;
    readonly type?: unknown;
  };

  return (
    parserError.type === 'entity.too.large' || parserError.status === 413 || parserError.statusCode === 413
  );
}

const jsonBodyParserErrorHandler: ErrorRequestHandler = (error, _req, res, next) => {
  if (isPayloadTooLargeError(error)) {
    res.status(413).json({ error: 'Request payload too large' } satisfies MutationErrorResponse);
    return;
  }

  next(error);
};

function parseEntityProjectionMode(rawMode: unknown): EntityProjectionMode | null {
  if (rawMode === undefined) {
    return 'active-path';
  }

  return rawMode === 'active-path' || rawMode === 'project-wide' ? rawMode : null;
}

function getChatRouteTransitionErrorStatus(kind: ChatRouteTransitionErrorKind): 400 | 404 | 409 {
  switch (kind) {
    case 'phase-intent-not-available':
      return 409;
    case 'phase-closure-phase-mismatch':
    case 'force-close-not-allowed':
      return 400;
    case 'phase-closure-proposal-not-found':
    case 'specification-not-found':
      return 404;
  }
  return 400;
}

function getTurnResponseTransitionErrorStatus(kind: SubmitTurnResponseTransitionErrorKind): 400 | 404 {
  switch (kind) {
    case 'turn-not-found':
      return 404;
    case 'selected-option-not-found':
    case 'review-action-mismatch':
    case 'review-action-not-allowed':
      return 400;
  }
  return 400;
}

function appendObserverResultToTurn(
  db: DB,
  turnId: number,
  observerResult: Awaited<ReturnType<typeof runObserver>>,
): void {
  const turn = getTurn(db, turnId);
  if (!turn) {
    return;
  }

  const assistantParts: BrunchAssistantPart[] = safeDeserializeAssistantParts(turn.assistant_parts).filter(
    (part) => part.type !== 'data-observer-result',
  );
  assistantParts.push({
    type: 'data-observer-result',
    data: {
      turnId,
      entityIds: observerResult.entityIds,
    },
  });
  updateTurn(db, turnId, {
    assistant_parts: serializeParts(assistantParts),
  });
}

function createObserverCaptureKey(specificationId: number, turnId: number): string {
  return `${specificationId}:${turnId}`;
}

function getStructuralArtifactTurnIdSet(db: DB, specificationId: number): ReadonlySet<number> {
  return toStructuralArtifactTurnIdSet(getSpecificationState(db, specificationId)?.structuralArtifactTurnIds);
}

async function ensureObserverCapture({
  db,
  observerCaptureRegistry,
  specificationId,
  turnId,
  projectCwd,
}: {
  db: DB;
  observerCaptureRegistry: Map<string, Promise<void>>;
  specificationId: number;
  turnId: number;
  projectCwd: string;
}): Promise<'captured' | 'already-captured'> {
  const turn = getTurn(db, turnId);
  if (!turn || turn.specification_id !== specificationId) {
    throw new Error('Turn not found');
  }

  const structuralTurnIds = getStructuralArtifactTurnIdSet(db, specificationId);
  if (!turnNeedsObserverCapture(turn, structuralTurnIds)) {
    return 'already-captured';
  }

  const captureKey = createObserverCaptureKey(specificationId, turnId);
  const existingCapture = observerCaptureRegistry.get(captureKey);
  if (existingCapture) {
    await existingCapture;
    const refreshedStructuralTurnIds = getStructuralArtifactTurnIdSet(db, specificationId);
    return turnNeedsObserverCapture(getTurn(db, turnId), refreshedStructuralTurnIds)
      ? 'captured'
      : 'already-captured';
  }

  const capturePromise = (async () => {
    const observerResult = await runObserver(db, turn, specificationId, projectCwd);
    appendObserverResultToTurn(db, turn.id, observerResult);
  })().finally(() => {
    observerCaptureRegistry.delete(captureKey);
  });

  observerCaptureRegistry.set(captureKey, capturePromise);
  await capturePromise;
  return 'captured';
}

export function createApp(dbPathOrOptions?: string | AppOptions): AppServices {
  const options = typeof dbPathOrOptions === 'string' ? { dbPath: dbPathOrOptions } : (dbPathOrOptions ?? {});
  const db = createDb(options.dbPath);
  const projectCwd = options.projectCwd ?? process.cwd();
  const app = express();
  app.use(express.json({ limit: JSON_BODY_LIMIT }));
  app.use(jsonBodyParserErrorHandler);
  const observerCaptureRegistry = new Map<string, Promise<void>>();

  const specificationCollectionPaths = ['/api/specifications'] as const;
  const specificationResourcePaths = ['/api/specifications/:id'] as const;
  const specificationPhaseIntentPaths = ['/api/specifications/:id/phase-intent'] as const;
  const specificationTurnResponsePaths = ['/api/specifications/:id/turns/:turnId/response'] as const;
  const specificationObserverCapturePaths = [
    '/api/specifications/:id/turns/:turnId/observer-capture',
  ] as const;
  const specificationEntitiesPaths = ['/api/specifications/:id/entities'] as const;
  const specificationExportPaths = ['/api/specifications/:id/export'] as const;
  const specificationChatPaths = ['/api/specifications/:id/chat'] as const;
  const specificationSideChatPaths = ['/api/specifications/:id/side-chat'] as const;
  const specificationAnnotationsPaths = ['/api/specifications/:id/annotations'] as const;
  const annotationResourcePaths = ['/api/annotations/:annotationId'] as const;

  const registerGet = (paths: readonly string[], handler: RequestHandler) => {
    for (const path of paths) {
      app.get(path, handler);
    }
  };

  const registerPost = (paths: readonly string[], handler: RequestHandler) => {
    for (const path of paths) {
      app.post(path, handler);
    }
  };

  const registerDelete = (paths: readonly string[], handler: RequestHandler) => {
    for (const path of paths) {
      app.delete(path, handler);
    }
  };

  // App config (cwd for display in AppLayout)
  app.get('/api/config', (_req: Request, res: Response) => {
    res.json({ cwd: projectCwd, homedir: os.homedir() });
  });

  // List all specifications
  registerGet(specificationCollectionPaths, (_req: Request, res: Response) => {
    res.json(listSpecifications(db) satisfies SpecificationListItem[]);
  });

  // Create a new specification
  registerPost(specificationCollectionPaths, (req: Request, res: Response) => {
    const parsedRequest = createSpecificationRequestSchema.safeParse(req.body);
    if (!parsedRequest.success) {
      res.status(400).json({ error: 'Invalid specification payload' } satisfies MutationErrorResponse);
      return;
    }

    const { name } = parsedRequest.data;
    const mode = parsedRequest.data.mode === 'brownfield' ? ('brownfield' as const) : undefined;
    const specification = createNewSpecification(db, name, mode ? { mode } : {});
    res.status(201).json(specification);
  });

  // Get a specific specification + active path
  registerGet(specificationResourcePaths, (req: Request, res: Response) => {
    const specificationId = Number(req.params.id);
    if (Number.isNaN(specificationId)) {
      res.status(400).json({ error: 'Invalid specification ID' } satisfies MutationErrorResponse);
      return;
    }
    const specificationState = getSpecificationState(db, specificationId);
    if (!specificationState) {
      res.status(404).json({ error: 'Specification not found' } satisfies MutationErrorResponse);
      return;
    }
    res.json(specificationState satisfies SpecificationState);
  });

  registerPost(specificationPhaseIntentPaths, (req: Request, res: Response) => {
    const specificationId = Number(req.params.id);

    if (Number.isNaN(specificationId)) {
      res.status(400).json({ error: 'Invalid specification ID' } satisfies MutationErrorResponse);
      return;
    }

    const parsedRequest = submitPhaseIntentRequestSchema.safeParse(req.body);
    if (!parsedRequest.success) {
      res.status(400).json({ error: 'Invalid phase intent payload' } satisfies MutationErrorResponse);
      return;
    }

    const response = submitPhaseIntentWithRuntimeCompatibility({
      db,
      specificationId,
      request: parsedRequest.data,
    });
    if (!response.ok) {
      res.status(response.status).json({ error: response.error } satisfies MutationErrorResponse);
      return;
    }

    res.json(response satisfies SubmitPhaseIntentResponse);
  });

  // Submit a turn response on a turn.
  registerPost(specificationTurnResponsePaths, (req: Request, res: Response) => {
    const specificationId = Number(req.params.id);
    const turnId = Number(req.params.turnId);

    if (Number.isNaN(specificationId) || Number.isNaN(turnId)) {
      res.status(400).json({ error: 'Invalid IDs' } satisfies MutationErrorResponse);
      return;
    }

    const parsedRequest = submitTurnResponseRequestSchema.safeParse(req.body);
    if (!parsedRequest.success) {
      res.status(400).json({ error: 'Invalid turn response payload' } satisfies MutationErrorResponse);
      return;
    }
    try {
      const response = submitTurnResponseTransition({
        db,
        specificationId,
        turnId,
        request: parsedRequest.data,
      });

      if (!response.ok) {
        res
          .status(getTurnResponseTransitionErrorStatus(response.kind))
          .json({ error: response.message } satisfies MutationErrorResponse);
        return;
      }

      res.json(response satisfies SubmitTurnResponseResponse);
    } catch {
      res.status(500).json({
        error: 'Failed to submit turn response',
      } satisfies MutationErrorResponse);
    }
  });

  registerPost(specificationObserverCapturePaths, async (req: Request, res: Response) => {
    const specificationId = Number(req.params.id);
    const turnId = Number(req.params.turnId);

    if (Number.isNaN(specificationId) || Number.isNaN(turnId)) {
      res.status(400).json({ error: 'Invalid IDs' } satisfies MutationErrorResponse);
      return;
    }

    try {
      const status = await ensureObserverCapture({
        db,
        observerCaptureRegistry,
        specificationId,
        turnId,
        projectCwd,
      });
      res.json({ ok: true, turnId, status } satisfies SubmitObserverCaptureResponse);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to capture observer result';
      const statusCode = message === 'Turn not found' ? 404 : 500;
      res.status(statusCode).json({ error: message } satisfies MutationErrorResponse);
    }
  });

  // Get entities for a specification
  registerGet(specificationEntitiesPaths, (req: Request, res: Response) => {
    const specificationId = Number(req.params.id);
    if (Number.isNaN(specificationId)) {
      res.status(400).json({ error: 'Invalid specification ID' } satisfies MutationErrorResponse);
      return;
    }
    const mode = parseEntityProjectionMode(req.query.mode);
    if (!mode) {
      res.status(400).json({ error: 'Invalid entity projection mode' } satisfies MutationErrorResponse);
      return;
    }
    res.json(getEntitiesForSpecificationByMode(db, specificationId, mode) satisfies EntitiesData);
  });

  // Export a specification as markdown
  registerGet(specificationExportPaths, (req: Request, res: Response) => {
    const specificationId = Number(req.params.id);
    if (Number.isNaN(specificationId)) {
      res.status(400).json({ error: 'Invalid specification ID' } satisfies MutationErrorResponse);
      return;
    }
    const specificationState = getSpecificationState(db, specificationId);
    if (!specificationState) {
      res.status(404).json({ error: 'Specification not found' } satisfies MutationErrorResponse);
      return;
    }
    const ready = isExportReady(specificationState.workflow);
    if (!ready) {
      res.json({ ready: false } satisfies ExportLoaderData);
      return;
    }
    const entities = getEntitiesForSpecificationByMode(db, specificationId, 'active-path');
    const markdown = renderExportMarkdown(
      getSpecificationRecord(specificationState).name,
      entities,
      specificationState.workflow,
    );
    res.json({ ready: true, markdown } satisfies ExportLoaderData);
  });

  // Conduct a turn for a specific specification
  registerPost(specificationChatPaths, async (req: Request, res: Response) => {
    const specificationId = Number(req.params.id);
    if (Number.isNaN(specificationId)) {
      res.status(400).json({ error: 'Invalid specification ID' });
      return;
    }

    let messages: BrunchUIMessage[];
    try {
      messages = await validateUIMessages<BrunchUIMessage>({
        messages: req.body.messages ?? [],
        dataSchemas: brunchDataPartSchemas,
        // The client may echo earlier assistant history that still contains dynamic
        // workspace-tool parts from a live stream (for example `list_directory`).
        // Validate against the full server tool registry so follow-up user turns do
        // not fail before route invalidation collapses those parts into persisted
        // activity summaries.
        tools: {
          ...createCoreTools(projectCwd),
          ...brunchValidationTools,
        },
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
              part.type === 'text' ||
              part.type === 'data-turn-response' ||
              part.type === 'data-confirmation' ||
              part.type === 'data-phase-intent',
          )
        : [{ type: 'text', text: prompt }];
    const confirmationPart = userParts.find(
      (part): part is Extract<BrunchUserPart, { type: 'data-confirmation' }> =>
        part.type === 'data-confirmation',
    );
    const phaseIntentPart = userParts.find(
      (part): part is Extract<BrunchUserPart, { type: 'data-phase-intent' }> =>
        part.type === 'data-phase-intent',
    );
    const phaseIntentPrompt = phaseIntentPart ? getPhaseIntentDisplayText(phaseIntentPart.data) : '';
    const promptText = prompt.trim() || phaseIntentPrompt;
    const persistedUserParts =
      phaseIntentPart && !userParts.some((part) => part.type === 'text')
        ? ([{ type: 'text', text: phaseIntentPrompt }, ...userParts] satisfies BrunchUserPart[])
        : userParts;

    if (!promptText && !confirmationPart && !phaseIntentPart) {
      res.status(400).json({ error: 'message content is required' });
      return;
    }

    let interviewerElapsedMs: number | undefined;
    const chatCommand: ChatCommand =
      confirmationPart?.data.kind === 'confirm-proposed-phase-closure'
        ? {
            kind: 'confirm-phase-closure',
            phase: confirmationPart.data.phase,
            proposalTurnId: confirmationPart.data.proposalTurnId,
            reply: { text: promptText, parts: persistedUserParts },
          }
        : confirmationPart?.data.kind === 'force-close-active-phase'
          ? {
              kind: 'force-close-phase',
              phase: confirmationPart.data.phase,
              reply: { text: promptText, parts: persistedUserParts },
            }
          : phaseIntentPart
            ? {
                kind: 'phase-entry',
                request: phaseIntentPart.data,
              }
            : {
                kind: 'continue',
                reply: { text: promptText, parts: persistedUserParts },
              };
    let transition: ReturnType<typeof applyChatRouteTransition>;
    try {
      transition = applyChatRouteTransition({ db, specificationId }, chatCommand);
    } catch {
      res
        .status(500)
        .json({ error: 'Failed to apply chat route transition' } satisfies MutationErrorResponse);
      return;
    }
    if (!transition.ok) {
      res.status(getChatRouteTransitionErrorStatus(transition.kind)).json({ error: transition.message });
      return;
    }

    const stream = createUIMessageStream<BrunchUIMessage>({
      async execute({ writer }) {
        if (transition.kind !== 'interviewer-turn') {
          writer.write({ type: 'finish', finishReason: 'stop' });
          return;
        }

        const { prepared } = transition;

        const specification = prepared.specification;
        const modeOptions =
          specification.mode === 'brownfield' ? { mode: 'brownfield' as const, cwd: projectCwd } : undefined;

        const interviewerStartedAt = Date.now();
        const interviewer = await streamInterviewer(
          db,
          prepared.turn,
          prepared.activePath,
          promptText,
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
        interviewerElapsedMs = Date.now() - interviewerStartedAt;
        finalizeTurn(db, specificationId, prepared.turn.id);

        const phaseOutcome = findPhaseOutcomeForTurn(db, specificationId, prepared.turn.id);
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

        writer.write({ type: 'finish', finishReason });
      },
      async onFinish({ responseMessage }) {
        if (transition.kind !== 'interviewer-turn') {
          return;
        }
        const { prepared } = transition;
        const assistantText = extractTextFromMessage(responseMessage);
        persistFallbackQuestionText(db, prepared.turn.id, assistantText);
        const persistedAssistantParts = materializeTurnArtifacts({
          phase: prepared.turn.phase,
          responseMessage,
          elapsedMs: interviewerElapsedMs,
        });
        updateTurn(db, prepared.turn.id, {
          assistant_parts: serializeParts(persistedAssistantParts),
        });
      },
      onError: (error) => (error instanceof Error ? error.message : 'Unknown error'),
    });

    pipeUIMessageStreamToResponse({ response: res, stream });
  });

  registerPost(specificationSideChatPaths, async (req: Request, res: Response) => {
    await handleSideChatRequest(db, req, res);
  });

  registerPost(specificationAnnotationsPaths, (req: Request, res: Response) => {
    handleCreateAnnotation(db, req, res);
  });

  registerGet(specificationAnnotationsPaths, (req: Request, res: Response) => {
    handleListAnnotations(db, req, res);
  });

  registerDelete(annotationResourcePaths, (req: Request, res: Response) => {
    handleDeleteAnnotation(db, req, res);
  });

  return { app, db };
}
