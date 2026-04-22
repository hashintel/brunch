import { createUIMessageStream, pipeUIMessageStreamToResponse, validateUIMessages } from 'ai';
import express from 'express';
import type { Express, Request, RequestHandler, Response } from 'express';

import { submitPhaseIntentRequestSchema, submitTurnResponseRequestSchema } from '@/shared/api-types.js';
import type {
  EntitiesData,
  ExportLoaderData,
  MutationErrorResponse,
  SubmitObserverCaptureResponse,
  SubmitPhaseIntentResponse,
  SubmitTurnResponseResponse,
} from '@/shared/api-types.js';
import {
  brunchDataPartSchemas,
  brunchValidationTools,
  extractTextFromMessage,
  formatTurnResponseText,
} from '@/shared/chat.js';
import type { BrunchAssistantPart, BrunchUIMessage, BrunchUserPart } from '@/shared/chat.js';
import {
  getGroundingStrategyModeForPosition,
  isGroundingStrategyKickoffTurn,
} from '@/shared/grounding-strategy.js';
import {
  getForceCloseActionErrorMessage,
  getForceClosePhaseAction,
  getForcedPhaseClosureSummary,
  parsePhaseClosureCommand,
} from '@/shared/phase-close.js';
import { getPhaseIntentDisplayText } from '@/shared/phase-intents.js';
import {
  getPersistedGroundingCard,
  getPersistedTurnResponse,
  getReviewActionForSelectedPositions,
  toStructuralArtifactTurnIdSet,
  turnNeedsObserverCapture,
} from '@/shared/specification-state.js';
import {
  createSpecificationRequestSchema,
  getSpecificationRecord,
  type SpecificationListItem,
  type SpecificationState,
} from '@/shared/specification.js';

import {
  createNewSpecification,
  extractPrompt,
  finalizeTurn,
  getSpecificationState,
  listSpecifications,
  prepareSuccessorTurn,
  prepareTurn,
  resolveTurn,
} from './core.js';
import {
  applyTurnResponseSelections,
  confirmPhaseOutcome,
  createConfirmedPhaseOutcome,
  createDb,
  findPhaseOutcomeForTurn,
  findProposedPhaseOutcomeByTurn,
  getCurrentPhase,
  getCurrentWorkflowState,
  getStructuralArtifactTurnIds,
  getTurn,
  getOptionsForTurn,
  materializeAcceptedCriteriaReviewSet,
  materializeAcceptedRequirementsReviewSet,
  updateSpecificationMode,
  updateTurn,
  getEntitiesForSpecificationByMode,
  supersedePhaseOutcome,
  type DB,
  type EntityProjectionMode,
  type Turn,
} from './db.js';
import { isExportReady, renderExportMarkdown } from './export.js';
import { persistFallbackQuestionText, streamInterviewer } from './interview.js';
import { runObserver } from './observer.js';
import { safeDeserializeAssistantParts, safeDeserializeUserParts, serializeParts } from './parts.js';
import {
  getPhaseIntentRuntimeAvailabilityError,
  submitPhaseIntentWithRuntimeCompatibility,
} from './phase-intent-runtime.js';
import { materializeTurnArtifacts } from './turn-artifacts.js';

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

  const structuralTurnIds = toStructuralArtifactTurnIdSet(getStructuralArtifactTurnIds(db, specificationId));
  if (!turnNeedsObserverCapture(turn, structuralTurnIds)) {
    return 'already-captured';
  }

  const captureKey = createObserverCaptureKey(specificationId, turnId);
  const existingCapture = observerCaptureRegistry.get(captureKey);
  if (existingCapture) {
    await existingCapture;
    const refreshedStructuralTurnIds = toStructuralArtifactTurnIdSet(
      getStructuralArtifactTurnIds(db, specificationId),
    );
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

function getPersistedFullSetReviewAction(
  turn: Pick<Turn, 'phase' | 'user_parts'>,
): 'accept' | 'request-changes' | null {
  if (turn.phase !== 'requirements' && turn.phase !== 'criteria') {
    return null;
  }

  const responsePart = safeDeserializeUserParts(turn.user_parts).find(
    (part): part is Extract<BrunchUserPart, { type: 'data-turn-response' }> =>
      part.type === 'data-turn-response',
  );

  return responsePart?.data.reviewAction ?? null;
}

function acceptRequirementsReview(
  db: DB,
  specificationId: number,
  turnId: number,
): SubmitTurnResponseResponse {
  materializeAcceptedRequirementsReviewSet(db, specificationId, turnId);

  createConfirmedPhaseOutcome(db, {
    projectId: specificationId,
    phase: 'requirements',
    proposal_turn_id: turnId,
    confirmation_turn_id: turnId,
    summary: 'The reviewed requirement set is accepted and ready for acceptance criteria.',
  });

  return { ok: true, advancedToPhase: 'criteria' };
}

function acceptCriteriaReview(db: DB, specificationId: number, turnId: number): SubmitTurnResponseResponse {
  materializeAcceptedCriteriaReviewSet(db, specificationId, turnId);

  createConfirmedPhaseOutcome(db, {
    projectId: specificationId,
    phase: 'criteria',
    proposal_turn_id: turnId,
    confirmation_turn_id: turnId,
    summary: 'The reviewed criteria set is accepted and the specification is ready for output.',
  });

  return { ok: true, workflowCompleted: true };
}

export function createApp(dbPathOrOptions?: string | AppOptions): AppServices {
  const options = typeof dbPathOrOptions === 'string' ? { dbPath: dbPathOrOptions } : (dbPathOrOptions ?? {});
  const db = createDb(options.dbPath);
  const projectCwd = options.projectCwd ?? process.cwd();
  const app = express();
  app.use(express.json());
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

  // App config (cwd for display in AppLayout)
  app.get('/api/config', (_req: Request, res: Response) => {
    res.json({ cwd: projectCwd });
  });

  // List all projects
  registerGet(specificationCollectionPaths, (_req: Request, res: Response) => {
    res.json(listSpecifications(db) satisfies SpecificationListItem[]);
  });

  // Create a new project
  registerPost(specificationCollectionPaths, (req: Request, res: Response) => {
    const parsedRequest = createSpecificationRequestSchema.safeParse(req.body);
    if (!parsedRequest.success) {
      res.status(400).json({ error: 'Invalid project payload' } satisfies MutationErrorResponse);
      return;
    }

    const { name } = parsedRequest.data;
    const mode = parsedRequest.data.mode === 'brownfield' ? ('brownfield' as const) : undefined;
    const specification = createNewSpecification(db, name, mode ? { mode } : {});
    res.status(201).json(specification);
  });

  // Get a specific project + active path
  registerGet(specificationResourcePaths, (req: Request, res: Response) => {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) {
      res.status(400).json({ error: 'Invalid project ID' } satisfies MutationErrorResponse);
      return;
    }
    const specificationState = getSpecificationState(db, id);
    if (!specificationState) {
      res.status(404).json({ error: 'Project not found' } satisfies MutationErrorResponse);
      return;
    }
    res.json(specificationState satisfies SpecificationState);
  });

  registerPost(specificationPhaseIntentPaths, (req: Request, res: Response) => {
    const projectId = Number(req.params.id);

    if (Number.isNaN(projectId)) {
      res.status(400).json({ error: 'Invalid project ID' } satisfies MutationErrorResponse);
      return;
    }

    const parsedRequest = submitPhaseIntentRequestSchema.safeParse(req.body);
    if (!parsedRequest.success) {
      res.status(400).json({ error: 'Invalid phase intent payload' } satisfies MutationErrorResponse);
      return;
    }

    const response = submitPhaseIntentWithRuntimeCompatibility({
      db,
      projectId,
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
    if (!turn || turn.specification_id !== projectId) {
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

    if (isGroundingStrategyKickoffTurn(turn)) {
      const selectedMode =
        uniquePositions.length === 1 ? getGroundingStrategyModeForPosition(uniquePositions[0]!) : null;
      if (selectedMode) {
        updateSpecificationMode(db, projectId, selectedMode);
      }
    }

    const selectedOptionIds = selectedOptions.map((option) => option.id);
    const selectedOptionContents = selectedOptions.map((option) => option.content);
    const responseText = formatTurnResponseText({
      selectedOptionContents,
      freeText,
    });

    const reviewAction =
      parsedRequest.data.kind === 'select-options' ? parsedRequest.data.reviewAction : null;
    const expectedReviewAction =
      parsedRequest.data.kind === 'select-options'
        ? getReviewActionForSelectedPositions(turn, uniquePositions)
        : null;

    if (expectedReviewAction && reviewAction !== expectedReviewAction) {
      res
        .status(400)
        .json({ error: 'Review turns must submit the explicit reviewAction for the selected option' });
      return;
    }

    if (!expectedReviewAction && reviewAction) {
      res.status(400).json({ error: 'reviewAction is only valid for review turns' });
      return;
    }

    const itemComments =
      parsedRequest.data.kind === 'select-options' ? parsedRequest.data.itemComments : undefined;

    const dataPart = {
      type: 'data-turn-response',
      data: {
        turnId,
        selectedOptionIds,
        ...(freeText ? { freeText } : {}),
        ...(expectedReviewAction ? { reviewAction: expectedReviewAction } : {}),
        ...(itemComments?.length ? { itemComments } : {}),
      },
    } as const satisfies Extract<BrunchUserPart, { type: 'data-turn-response' }>;

    updateTurn(db, turnId, {
      answer: responseText,
      user_parts: serializeParts([
        ...(responseText ? ([{ type: 'text', text: responseText }] as const) : []),
        dataPart,
      ] satisfies BrunchUserPart[]),
    });

    const fullSetReviewAction = getPersistedFullSetReviewAction(getTurn(db, turnId) ?? turn);
    if (fullSetReviewAction === 'accept') {
      try {
        const response =
          turn.phase === 'requirements'
            ? acceptRequirementsReview(db, projectId, turnId)
            : turn.phase === 'criteria'
              ? acceptCriteriaReview(db, projectId, turnId)
              : ({ ok: true } satisfies SubmitTurnResponseResponse);
        res.json(response satisfies SubmitTurnResponseResponse);
      } catch (error) {
        res
          .status(500)
          .json({ error: error instanceof Error ? error.message : 'Failed to accept review set' });
      }
      return;
    }

    res.json({ ok: true } satisfies SubmitTurnResponseResponse);
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

  // Get entities for a project
  registerGet(specificationEntitiesPaths, (req: Request, res: Response) => {
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
    res.json(getEntitiesForSpecificationByMode(db, id, mode) satisfies EntitiesData);
  });

  // Export spec as markdown
  registerGet(specificationExportPaths, (req: Request, res: Response) => {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) {
      res.status(400).json({ error: 'Invalid project ID' } satisfies MutationErrorResponse);
      return;
    }
    const specificationState = getSpecificationState(db, id);
    if (!specificationState) {
      res.status(404).json({ error: 'Project not found' } satisfies MutationErrorResponse);
      return;
    }
    const ready = isExportReady(specificationState.workflow);
    if (!ready) {
      res.json({ ready: false } satisfies ExportLoaderData);
      return;
    }
    const entities = getEntitiesForSpecificationByMode(db, id, 'active-path');
    const markdown = renderExportMarkdown(
      getSpecificationRecord(specificationState).name,
      entities,
      specificationState.workflow,
    );
    res.json({ ready: true, markdown } satisfies ExportLoaderData);
  });

  // Conduct turn for a specific project
  registerPost(specificationChatPaths, async (req: Request, res: Response) => {
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
    const phaseClosureCommand = confirmationPart ? parsePhaseClosureCommand(confirmationPart.data) : null;
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

    let prepared: ReturnType<typeof prepareTurn> | ReturnType<typeof prepareSuccessorTurn> | null = null;
    let confirmedClosureTurnId: number | null = null;
    let observedTurnId: number | null = null;
    let skipObserverForCurrentChatTurn = false;
    let deferObserverCaptureToRuntime = false;
    let interviewerElapsedMs: number | undefined;
    try {
      if (confirmationTarget) {
        const proposalTurn = getTurn(db, confirmationTarget.proposal_turn_id);
        if (!proposalTurn || proposalTurn.specification_id !== id) {
          res.status(404).json({ error: 'Phase closure proposal not found' });
          return;
        }
        resolveTurn(db, proposalTurn.id, promptText, persistedUserParts);
        confirmedClosureTurnId = proposalTurn.id;
      } else if (forceClosePhase) {
        prepared = prepareTurn(db, id, promptText, persistedUserParts, forceClosePhase);
      } else if (phaseIntentPart) {
        const specificationState = getSpecificationState(db, id);
        if (!specificationState) {
          res.status(404).json({ error: 'Project not found' });
          return;
        }

        const availabilityError = getPhaseIntentRuntimeAvailabilityError(
          phaseIntentPart.data,
          specificationState.landing,
        );
        if (availabilityError) {
          res.status(availabilityError.status).json({ error: availabilityError.error });
          return;
        }

        prepared = prepareSuccessorTurn(
          db,
          id,
          phaseIntentPart.data.phase,
          getSpecificationRecord(specificationState).active_turn_id ?? null,
        );
      } else {
        const specificationState = getSpecificationState(db, id);
        if (!specificationState) {
          res.status(404).json({ error: 'Project not found' });
          return;
        }

        const currentPhase = getCurrentPhase(db, id);
        const activeTurnId = getSpecificationRecord(specificationState).active_turn_id;
        const activeTurn = activeTurnId ? getTurn(db, activeTurnId) : undefined;

        const activeOutcome = activeTurn ? findPhaseOutcomeForTurn(db, id, activeTurn.id) : undefined;
        if (activeOutcome?.status === 'proposed') {
          supersedePhaseOutcome(db, activeOutcome.id);
        }

        if (activeTurn) {
          skipObserverForCurrentChatTurn =
            Boolean(getPersistedGroundingCard(activeTurn)) && !activeTurn.question?.trim();
          deferObserverCaptureToRuntime =
            getPersistedTurnResponse(activeTurn) !== null &&
            (activeTurn.phase === 'grounding' || activeTurn.phase === 'design');
          const successorPhase = activeTurn.answer === null ? activeTurn.phase : currentPhase;
          if (activeTurn.answer === null) {
            resolveTurn(db, activeTurn.id, promptText, persistedUserParts);
          }
          observedTurnId = activeTurn.id;
          finalizeTurn(db, id, activeTurn.id);
          prepared = prepareSuccessorTurn(db, id, successorPhase, activeTurn.id);
        } else {
          const answeredTurn = prepareTurn(db, id, promptText, persistedUserParts, currentPhase);
          finalizeTurn(db, id, answeredTurn.turn.id);
          observedTurnId = answeredTurn.turn.id;
          prepared = prepareSuccessorTurn(db, id, currentPhase, answeredTurn.turn.id);
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      res.status(404).json({ error: message });
      return;
    }

    const stream = createUIMessageStream<BrunchUIMessage>({
      async execute({ writer }) {
        if (confirmationTarget) {
          if (confirmedClosureTurnId === null) {
            throw new Error('Expected confirmed closure turn');
          }
          confirmPhaseOutcome(db, confirmationTarget.id, confirmedClosureTurnId);
          finalizeTurn(db, id, confirmedClosureTurnId);
          writer.write({ type: 'finish', finishReason: 'stop' });
          return;
        }

        if (forceClosePhase) {
          if (!prepared) {
            throw new Error('Expected prepared force-close turn');
          }

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

        if (!prepared) {
          throw new Error('Expected prepared interviewer turn');
        }

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
          const observedTurn = observedTurnId ? getTurn(db, observedTurnId) : undefined;
          const shouldObserve =
            observedTurn &&
            observedTurn.answer !== null &&
            !deferObserverCaptureToRuntime &&
            !skipObserverForCurrentChatTurn &&
            !(getPersistedGroundingCard(observedTurn) && !observedTurn.question?.trim()) &&
            !persistedUserParts.some((part) => part.type === 'data-confirmation') &&
            !safeDeserializeAssistantParts(observedTurn.assistant_parts).some(
              (part) =>
                part.type === 'data-observer-result' &&
                typeof part.data === 'object' &&
                part.data !== null &&
                'turnId' in part.data &&
                part.data.turnId === observedTurn.id,
            );

          if (shouldObserve && observedTurn) {
            const observerResult = await runObserver(db, observedTurn, id, projectCwd);
            appendObserverResultToTurn(db, observedTurn.id, observerResult);
            writer.write({
              type: 'data-observer-result',
              data: {
                turnId: observedTurn.id,
                entityIds: observerResult.entityIds,
              },
            });
          }
        } catch {
          // Observer failures are non-fatal to the interviewer turn.
        }

        writer.write({ type: 'finish', finishReason });
      },
      async onFinish({ responseMessage }) {
        if (confirmationTarget || forceClosePhase || !prepared) {
          return;
        }
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

  return { app, db };
}
