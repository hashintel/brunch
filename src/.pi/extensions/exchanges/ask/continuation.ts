import { type Theme } from '@earendil-works/pi-coding-agent';

import { formatAsk } from '../../../../agents/contexts/exchanges/ask.js';
import {
  formatRequestChoice,
  formatRequestReview,
} from '../../../../agents/contexts/exchanges/request-response.js';
import { askQuestionEcho, projectAsk } from '../../../../exchanges/projections/ask.js';
import {
  projectRequestChoice,
  projectRequestReview,
  type ReviewDecision,
} from '../../../../exchanges/projections/request-response.js';
import { findIncompleteStructuredExchangePresents } from '../../../../exchanges/recovery.js';
import {
  type AskContinuationParams,
  type ContinuingAskParams,
  type PresentCandidatesDetails,
  type PresentDetails,
  type PresentDigestDetails,
  type PresentReviewSetDetails,
  type RequestDetails,
} from '../../../../exchanges/schemas/index.js';
import { projectBrunchAgentState } from '../../../../projections/session/runtime-state.js';
import type { LiveAskOpener } from '../../../../session/live-ask-registry.js';
import { createExchangeDecisionPickerComponent } from '../../../components/exchange-decision-picker.js';
import { operationalModeBorderColor } from '../../../components/mode-border-theme.js';
import {
  BRUNCH_CONSULT_COMMAND,
  BRUNCH_CONTINUE_COMMAND,
  BRUNCH_MODE_COMMAND,
  slashCommand,
} from '../../commands/names.js';
import { collectCommentRequirementStep, isBack, type StepResult } from '../shared/required-input.js';
import { withWorkingIndicatorHidden, type StructuredExchangeUiContext } from '../shared/ui-context.js';

const CONTINUE_STATUS_KEY = 'brunch.continue';
const CONTINUE_COMMAND_HINT = slashCommand(BRUNCH_CONTINUE_COMMAND);
const CONSULT_COMMAND_HINT = slashCommand(BRUNCH_CONSULT_COMMAND);
const MODE_COMMAND_HINT = slashCommand(BRUNCH_MODE_COMMAND);

type AskResultDetails = RequestDetails;
type RequestReviewProjectionInput = Parameters<typeof projectRequestReview>[0];
type ContinuationCollectParams = AskContinuationParams & { readonly exchangeId: string };
type PickedSingleChoice = { readonly id: string };
type ToolResult = {
  readonly content: { readonly type: 'text'; readonly text: string }[];
  readonly details: AskResultDetails;
  readonly terminate?: true;
};

type DeclaredContinuationPresent =
  | (PresentCandidatesDetails & {
      readonly continuation: NonNullable<PresentCandidatesDetails['continuation']>;
    })
  | (PresentDigestDetails & { readonly continuation: NonNullable<PresentDigestDetails['continuation']> })
  | (PresentReviewSetDetails & {
      readonly continuation: NonNullable<PresentReviewSetDetails['continuation']>;
    });

function result(details: ReturnType<typeof projectAsk>, terminate = false): ToolResult {
  return {
    content: [{ type: 'text', text: formatAsk(details) }],
    details,
    ...(terminate ? { terminate: true } : {}),
  };
}

function terminal(
  params: ContinuationCollectParams,
  status: 'cancelled' | 'unavailable',
  message?: string,
): ToolResult {
  const question = askQuestionEcho(params);
  const details =
    status === 'cancelled'
      ? projectAsk({ exchangeId: params.exchangeId, question, status, ...(message ? { message } : {}) })
      : projectAsk({
          exchangeId: params.exchangeId,
          question,
          status,
          message: message ?? 'ask unavailable',
        });
  return result(details, status === 'cancelled');
}

export function surfaceContinueHint(ctx: StructuredExchangeUiContext): void {
  ctx.ui?.setStatus?.(
    CONTINUE_STATUS_KEY,
    `Interrupted ask. Run ${CONTINUE_COMMAND_HINT} to resume, ${CONSULT_COMMAND_HINT} to choose a next move, or ${MODE_COMMAND_HINT} to switch roles.`,
  );
}

export function clearContinueHint(ctx: StructuredExchangeUiContext): void {
  ctx.ui?.setStatus?.(CONTINUE_STATUS_KEY, undefined);
}

function askBorderColor(ctx: StructuredExchangeUiContext, theme: Pick<Theme, 'fg'>) {
  const mode = projectBrunchAgentState(ctx.sessionManager?.getBranch() ?? []).operationalMode;
  return operationalModeBorderColor(theme, mode);
}

function choicesFromParams(
  params: ContinuationCollectParams,
): readonly { readonly id: string; readonly label: string; readonly description?: string }[] {
  return [
    ...params.options.map((option) => ({
      id: option.id,
      label: option.label,
      ...(option.description ? { description: option.description } : {}),
    })),
    ...(params.allowOther ? [{ id: 'other', label: 'Other' }] : []),
    ...(params.allowNone ? [{ id: 'none', label: 'None' }] : []),
  ];
}

async function presentSingleChoicePicker(
  params: ContinuationCollectParams,
  ctx: StructuredExchangeUiContext,
  custom: NonNullable<NonNullable<StructuredExchangeUiContext['ui']>['custom']>,
): Promise<PickedSingleChoice | undefined> {
  return withWorkingIndicatorHidden(ctx, () =>
    custom<PickedSingleChoice | undefined>((_tui, theme, _keybindings, done) =>
      createExchangeDecisionPickerComponent({
        prompt: 'Choose one',
        body: params.body,
        choices: choicesFromParams(params),
        ...(params.topLabel ? { topLabel: params.topLabel } : {}),
        ...(params.bottomLabel ? { bottomLabel: params.bottomLabel } : {}),
        theme,
        borderColor: askBorderColor(ctx, theme),
        onDone: done,
      }),
    ),
  );
}

function continuationTerminal(
  params: ContinuationCollectParams,
  present: PresentDetails,
  status: 'cancelled' | 'unavailable',
  message?: string,
): ToolResult {
  if (present.tool_meta.curr === 'present_candidates') {
    const details = projectRequestChoice({
      exchangeId: params.exchangeId,
      respondsToPresentTool: 'present_candidates',
      status,
      message,
    });
    return {
      content: [{ type: 'text', text: formatRequestChoice(details) }],
      details,
      ...(status === 'cancelled' ? { terminate: true } : {}),
    };
  }
  if (present.tool_meta.curr === 'present_digest' || present.tool_meta.curr === 'present_review_set') {
    const details = projectRequestReview({
      exchangeId: params.exchangeId,
      respondsToPresentTool: present.tool_meta.curr,
      status,
      message,
    });
    return {
      content: [{ type: 'text', text: formatRequestReview(details) }],
      details,
      ...(status === 'cancelled' ? { terminate: true } : {}),
    };
  }
  return terminal(params, status, message);
}

function hasDeclaredContinuation(present: PresentDetails): present is DeclaredContinuationPresent {
  return 'continuation' in present && present.continuation !== undefined;
}

function isDeclaredCandidatePresent(
  present: DeclaredContinuationPresent,
): present is PresentCandidatesDetails & {
  readonly continuation: NonNullable<PresentCandidatesDetails['continuation']>;
} {
  return present.tool_meta.curr === 'present_candidates';
}

function isDeclaredReviewPresent(present: DeclaredContinuationPresent): present is
  | (PresentDigestDetails & { readonly continuation: NonNullable<PresentDigestDetails['continuation']> })
  | (PresentReviewSetDetails & {
      readonly continuation: NonNullable<PresentReviewSetDetails['continuation']>;
    }) {
  return present.tool_meta.curr === 'present_digest' || present.tool_meta.curr === 'present_review_set';
}

function continuingAskUnavailable(params: ContinuingAskParams, message: string): ToolResult {
  return result(
    projectAsk({
      exchangeId: params.continues,
      question: { body: params.preface ?? 'Continue structured exchange' },
      status: 'unavailable',
      message,
    }),
  );
}

export async function collectContinuingAsk(
  params: ContinuingAskParams,
  ctx: StructuredExchangeUiContext,
  liveAsk?: LiveAskOpener,
): Promise<ToolResult> {
  const branch = ctx.sessionManager?.getBranch();
  if (!branch)
    return continuingAskUnavailable(
      params,
      'ask continuation requires access to the current session transcript',
    );
  const pending = findIncompleteStructuredExchangePresents(branch).find(
    (present) => present.details.exchange_id === params.continues,
  );
  if (!pending)
    return continuingAskUnavailable(params, `No pending structured exchange found for ${params.continues}`);
  const present = pending.details;
  if (!hasDeclaredContinuation(present))
    return continuingAskUnavailable(
      params,
      `Structured exchange ${params.continues} does not declare an ask continuation`,
    );
  const declared = { exchangeId: params.continues, ...present.continuation.params };
  if (isDeclaredCandidatePresent(present))
    return collectContinuingCandidateChoice(declared, present, ctx, liveAsk);
  if (isDeclaredReviewPresent(present)) return collectContinuingReview(declared, present, ctx, liveAsk);
  return present satisfies never;
}

async function collectContinuingCandidateChoice(
  params: ContinuationCollectParams,
  present: PresentCandidatesDetails,
  ctx: StructuredExchangeUiContext,
  liveAsk?: LiveAskOpener,
): Promise<ToolResult> {
  if (!ctx.hasUI || typeof ctx.ui?.custom !== 'function') {
    if (liveAsk) return collectHeadlessCandidateChoice(params, present, ctx, liveAsk);
    return continuationTerminal(
      params,
      present,
      'unavailable',
      'ask continuation choice requires interactive UI',
    );
  }
  const picked = await presentSingleChoicePicker(params, ctx, ctx.ui.custom);
  if (!picked) {
    surfaceContinueHint(ctx);
    return continuationTerminal(params, present, 'cancelled');
  }
  const option = params.options.find((choice) => choice.id === picked.id);
  if (!option)
    return continuationTerminal(
      params,
      present,
      'unavailable',
      `ask received unknown option id ${picked.id}`,
    );
  const details = projectRequestChoice({
    exchangeId: params.exchangeId,
    respondsToPresentTool: 'present_candidates',
    status: 'answered',
    choice: { id: option.id, label: option.label, kind: 'listed' },
    options: present.candidates.map((candidate) => ({ id: candidate.id, content: candidate.title })),
  });
  clearContinueHint(ctx);
  return { content: [{ type: 'text', text: formatRequestChoice(details) }], details };
}

// ceiling: headless candidate answers accept only a declared candidate id; the
// Other/None escapes stay interactive-only, mirroring the standalone ask
// headless choice path.
async function collectHeadlessCandidateChoice(
  params: ContinuationCollectParams,
  present: PresentCandidatesDetails,
  ctx: StructuredExchangeUiContext,
  liveAsk: LiveAskOpener,
): Promise<ToolResult> {
  const answer = await liveAsk.openAsk({
    exchangeId: params.exchangeId,
    mode: 'single-select',
    question: askQuestionEcho(params),
  });
  if (answer === undefined) {
    surfaceContinueHint(ctx);
    return continuationTerminal(params, present, 'cancelled');
  }
  const option = params.options.find((choice) => choice.id === answer);
  if (!option)
    return continuationTerminal(params, present, 'unavailable', `ask received unknown option id ${answer}`);
  const details = projectRequestChoice({
    exchangeId: params.exchangeId,
    respondsToPresentTool: 'present_candidates',
    status: 'answered',
    choice: { id: option.id, label: option.label, kind: 'listed' },
    options: present.candidates.map((candidate) => ({ id: candidate.id, content: candidate.title })),
  });
  clearContinueHint(ctx);
  return { content: [{ type: 'text', text: formatRequestChoice(details) }], details };
}

// ceiling: headless review answers carry the decision, optionally suffixed
// `:comment` (request_changes requires the comment). Richer review payloads
// stay interactive-only.
async function collectHeadlessReview(
  params: ContinuationCollectParams,
  present: PresentDigestDetails | PresentReviewSetDetails,
  ctx: StructuredExchangeUiContext,
  liveAsk: LiveAskOpener,
): Promise<ToolResult> {
  const answer = await liveAsk.openAsk({
    exchangeId: params.exchangeId,
    mode: 'review',
    question: askQuestionEcho(params),
  });
  if (answer === undefined) {
    surfaceContinueHint(ctx);
    return continuationTerminal(params, present, 'cancelled');
  }
  const separator = answer.indexOf(':');
  const decision = (separator >= 0 ? answer.slice(0, separator) : answer).trim();
  const comment = separator >= 0 ? answer.slice(separator + 1).trim() || undefined : undefined;
  if (decision !== 'approve' && decision !== 'request_changes' && decision !== 'reject') {
    return continuationTerminal(
      params,
      present,
      'unavailable',
      `ask received unknown review decision ${answer}`,
    );
  }
  if (decision === 'request_changes' && comment === undefined) {
    return continuationTerminal(params, present, 'unavailable', 'Review request_changes requires a comment');
  }
  const details = continuationReviewDetails({
    present,
    exchangeId: params.exchangeId,
    review: decision,
    comment,
  });
  clearContinueHint(ctx);
  return { content: [{ type: 'text', text: formatRequestReview(details) }], details };
}

async function collectContinuingReview(
  params: ContinuationCollectParams,
  present: PresentDigestDetails | PresentReviewSetDetails,
  ctx: StructuredExchangeUiContext,
  liveAsk?: LiveAskOpener,
): Promise<ToolResult> {
  if (!ctx.hasUI || typeof ctx.ui?.custom !== 'function') {
    if (liveAsk) return collectHeadlessReview(params, present, ctx, liveAsk);
    return continuationTerminal(
      params,
      present,
      'unavailable',
      'ask continuation review requires interactive UI',
    );
  }
  const custom = ctx.ui.custom;
  for (;;) {
    const selected = await withWorkingIndicatorHidden(ctx, () =>
      custom<{ readonly id: ReviewDecision } | undefined>((_tui, theme, _keybindings, done) =>
        createExchangeDecisionPickerComponent({
          prompt: 'Review',
          body: params.body,
          choices: choicesFromParams(params),
          theme,
          borderColor: askBorderColor(ctx, theme),
          onDone: (value) => done(value as { readonly id: ReviewDecision } | undefined),
        }),
      ),
    );
    if (!selected) {
      surfaceContinueHint(ctx);
      return continuationTerminal(params, present, 'cancelled');
    }
    const collected = await collectContinuationReviewComment(params, selected.id, ctx);
    if (isBack(collected)) continue;
    if (collected.status === 'unavailable')
      return continuationTerminal(params, present, 'unavailable', collected.message);
    const details = continuationReviewDetails({
      present,
      exchangeId: params.exchangeId,
      review: selected.id,
      comment: collected.value.comment,
    });
    clearContinueHint(ctx);
    return { content: [{ type: 'text', text: formatRequestReview(details) }], details };
  }
}

async function collectContinuationReviewComment(
  params: ContinuationCollectParams,
  review: ReviewDecision,
  ctx: StructuredExchangeUiContext,
): Promise<StepResult<{ readonly comment?: string }>> {
  return collectCommentRequirementStep({
    reviewDecision: review,
    ctx,
    requiredPrompt: params.commentPrompt ?? 'Required change request',
    optionalPrompt: 'Optional comment',
    unavailableMessage: 'ask review comment unavailable',
  });
}

function continuationReviewDetails(input: {
  readonly present: PresentDigestDetails | PresentReviewSetDetails;
  readonly exchangeId: string;
  readonly review: ReviewDecision;
  readonly comment: string | undefined;
}) {
  return projectRequestReview(continuationReviewDetailsInput(input));
}

function continuationReviewDetailsInput(input: {
  readonly present: PresentDigestDetails | PresentReviewSetDetails;
  readonly exchangeId: string;
  readonly review: ReviewDecision;
  readonly comment: string | undefined;
}): RequestReviewProjectionInput {
  const isDigestReview = 'digest' in input.present;
  const respondsToPresentTool = isDigestReview ? 'present_digest' : 'present_review_set';
  const base = {
    exchangeId: input.exchangeId,
    respondsToPresentTool,
    status: 'answered',
  } as const;
  if (input.review === 'request_changes') {
    return { ...base, review: input.review, comment: input.comment ?? '' };
  }
  if (input.review === 'approve') {
    if (isDigestReview) {
      return {
        ...base,
        respondsToPresentTool: 'present_digest',
        review: input.review,
        acceptedAbstract: input.present.digest.abstract,
        ...(input.comment ? { comment: input.comment } : {}),
      };
    }
    return {
      ...base,
      respondsToPresentTool: 'present_review_set',
      review: input.review,
      ...(input.comment ? { comment: input.comment } : {}),
    };
  }
  return { ...base, review: input.review, ...(input.comment ? { comment: input.comment } : {}) };
}

export function collectAskContinuationResponse(
  exchangeId: string,
  ctx: StructuredExchangeUiContext,
): Promise<ToolResult> {
  return collectContinuingAsk({ continues: exchangeId }, ctx);
}
