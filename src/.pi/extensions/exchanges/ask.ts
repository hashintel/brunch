import { getSelectListTheme, defineTool, type Theme } from '@earendil-works/pi-coding-agent';
import type { EditorTheme } from '@earendil-works/pi-tui';

import { formatAsk } from '../../../agents/contexts/exchanges/ask.js';
import {
  formatRequestChoice,
  formatRequestReview,
} from '../../../agents/contexts/exchanges/request-response.js';
import { askQuestionEcho, projectAsk } from '../../../exchanges/projections/ask.js';
import {
  projectRequestChoice,
  projectRequestReview,
  type ReviewDecision,
} from '../../../exchanges/projections/request-response.js';
import { findIncompleteStructuredExchangePresents } from '../../../exchanges/recovery.js';
import {
  structuredExchangeResponseRequiresComment,
  zAskParams,
  type AskContinuationParams,
  type AskQuestionEcho,
  type ContinuingAskParams,
  type PresentCandidatesDetails,
  type PresentDetails,
  type PresentDigestDetails,
  type PresentReviewSetDetails,
  type RequestDetails,
  type SelectedChoice,
  type StandaloneAskParams,
} from '../../../exchanges/schemas/index.js';
import { normalizeOptionalUnknownText } from '../../../exchanges/text.js';
import { projectBrunchAgentState } from '../../../projections/session/runtime-state.js';
import type { LiveExchangeAwaiter } from '../../../session/live-exchange-broker.js';
import { ExchangeAnswerEditorComponent } from '../../components/exchange-answer-editor.js';
import { createExchangeDecisionPickerComponent } from '../../components/exchange-decision-picker.js';
import { operationalModeBorderColor } from '../../components/mode-border-theme.js';
import { createMultiChoicePickerComponent } from '../../components/multi-choice-picker.js';
import { piSchema } from './pi-schema.js';
import { requestChoicesViaEditor } from './shared/choices-editor.js';
import { renderEmptyStructuredExchangeCall, renderMarkdownResult } from './shared/markdown.js';
import {
  back,
  collectCommentStep,
  collectRequiredInput,
  isBack,
  unavailable,
  type StepResult,
} from './shared/required-input.js';
import { withWorkingIndicatorHidden, type StructuredExchangeUiContext } from './shared/ui-context.js';

export const ASK_TOOL = 'ask' as const;
const CONTINUE_STATUS_KEY = 'brunch.continue';
const CONTINUE_COMMAND_HINT = '/brunch:continue';

type AskResultDetails = RequestDetails;

type ToolResult = {
  readonly content: { readonly type: 'text'; readonly text: string }[];
  readonly details: AskResultDetails;
  readonly terminate?: true;
};

function result(details: ReturnType<typeof projectAsk>, terminate = false): ToolResult {
  return {
    content: [{ type: 'text', text: formatAsk(details) }],
    details,
    ...(terminate ? { terminate: true } : {}),
  };
}

function terminal(
  params: { readonly exchangeId: string },
  question: AskQuestionEcho,
  status: 'cancelled' | 'unavailable',
  message?: string,
): ToolResult {
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

function surfaceContinueHint(ctx: StructuredExchangeUiContext): void {
  ctx.ui?.setStatus?.(CONTINUE_STATUS_KEY, `Interrupted ask. Run ${CONTINUE_COMMAND_HINT} to resume.`);
}

type ContinuationCollectParams = AskContinuationParams & { readonly exchangeId: string };
export type CollectableAskParams = StandaloneAskParams | ContinuationCollectParams;
export type CollectableAskWithOptions = CollectableAskParams & {
  readonly options: NonNullable<CollectableAskParams['options']>;
};
type PickedSingleChoice = { readonly id: string };
type PickedMultiChoices = {
  readonly choices: readonly { readonly id: string; readonly label: string }[];
};
type RequestReviewProjectionInput = Parameters<typeof projectRequestReview>[0];
type AskCommentInput =
  | {
      readonly choiceKinds: readonly SelectedChoice['kind'][];
      readonly reviewDecision?: never;
    }
  | {
      readonly choiceKinds?: never;
      readonly reviewDecision: ReviewDecision;
    };

function askBorderColor(ctx: StructuredExchangeUiContext, theme: Pick<Theme, 'fg'>) {
  const mode = projectBrunchAgentState(ctx.sessionManager?.getBranch() ?? []).operationalMode;
  return operationalModeBorderColor(theme, mode);
}

function hasOptions(params: CollectableAskParams): params is CollectableAskWithOptions {
  return params.options !== undefined;
}

function choicesFromParams(
  params: CollectableAskParams,
): readonly { readonly id: string; readonly label: string; readonly description?: string }[] {
  return [
    ...(params.options?.map((option) => ({
      id: option.id,
      label: option.label,
      ...(option.description ? { description: option.description } : {}),
    })) ?? []),
    ...(params.allowOther ? [{ id: 'other', label: 'Other' }] : []),
    ...(params.allowNone ? [{ id: 'none', label: 'None' }] : []),
  ];
}

function selectedChoice(id: string, label: string, listedIds: ReadonlySet<string>): SelectedChoice {
  if (id === 'other') return { id, label, kind: 'other' };
  if (id === 'none') return { id, label, kind: 'none' };
  return { id, label, kind: listedIds.has(id) ? 'listed' : 'other' };
}

async function collectFreeText(
  params: CollectableAskParams,
  question: AskQuestionEcho,
  ctx: StructuredExchangeUiContext,
  answerBroker: LiveExchangeAwaiter | undefined,
): Promise<ToolResult> {
  let answer: string | undefined;
  if (ctx.hasUI && typeof ctx.ui?.custom === 'function') {
    const custom = ctx.ui.custom;
    const customResult = await withWorkingIndicatorHidden(ctx, () =>
      custom<{ readonly status: 'answered'; readonly answer: string } | { readonly status: 'cancelled' }>(
        (tui, theme, _keybindings, done) => {
          const borderColor = askBorderColor(ctx, theme);
          const editorTheme: EditorTheme = {
            borderColor,
            selectList: getSelectListTheme(),
          };
          return new ExchangeAnswerEditorComponent(tui, editorTheme, {
            body: params.body,
            theme,
            borderColor,
            onDone: (value) =>
              done(value === undefined ? { status: 'cancelled' } : { status: 'answered', answer: value }),
          });
        },
      ),
    );
    if (customResult?.status === 'answered') answer = customResult.answer;
    else if (customResult?.status === 'cancelled') {
      surfaceContinueHint(ctx);
      return terminal(params, question, 'cancelled');
    } else if (typeof ctx.ui?.editor === 'function') {
      answer = await withWorkingIndicatorHidden(ctx, () => ctx.ui!.editor!(params.body));
      if (answer === undefined) {
        surfaceContinueHint(ctx);
        return terminal(params, question, 'cancelled');
      }
    }
  } else if (ctx.hasUI && typeof ctx.ui?.editor === 'function') {
    answer = await withWorkingIndicatorHidden(ctx, () => ctx.ui!.editor!(params.body));
    if (answer === undefined) {
      surfaceContinueHint(ctx);
      return terminal(params, question, 'cancelled');
    }
  } else if (answerBroker) {
    answer = await answerBroker.awaitAnswer({ exchangeId: params.exchangeId });
  } else {
    return terminal(params, question, 'unavailable', 'ask requires interactive UI');
  }

  if (answer === undefined) {
    surfaceContinueHint(ctx);
    return terminal(params, question, 'cancelled');
  }
  const trimmed = answer.trim();
  if (trimmed.length === 0) return terminal(params, question, 'unavailable', 'ask answer cannot be empty');
  let comment: string | undefined;
  if (params.commentPrompt && typeof ctx.ui?.input === 'function') {
    comment = normalizeOptionalUnknownText(await ctx.ui.input(params.commentPrompt));
  }
  return result(
    projectAsk({
      exchangeId: params.exchangeId,
      question,
      status: 'answered',
      answer: trimmed,
      ...(comment ? { comment } : {}),
    }),
  );
}

async function collectSingleChoice(
  params: CollectableAskParams,
  question: AskQuestionEcho,
  ctx: StructuredExchangeUiContext,
): Promise<ToolResult> {
  if (!ctx.hasUI || typeof ctx.ui?.custom !== 'function' || !hasOptions(params)) {
    return terminal(params, question, 'unavailable', 'ask choice requires interactive UI');
  }
  return collectSingleChoiceWithBackNavigation(params, question, ctx, ctx.ui.custom);
}

async function collectSingleChoiceWithBackNavigation(
  params: CollectableAskWithOptions,
  question: AskQuestionEcho,
  ctx: StructuredExchangeUiContext,
  custom: NonNullable<NonNullable<StructuredExchangeUiContext['ui']>['custom']>,
): Promise<ToolResult> {
  for (;;) {
    const picked = await presentSingleChoicePicker(params, ctx, custom);
    if (!picked) {
      surfaceContinueHint(ctx);
      return terminal(params, question, 'cancelled');
    }
    const collected = await collectPickedSingleChoice(params, picked, ctx);
    if (isBack(collected)) continue;
    if (collected.status === 'unavailable')
      return terminal(params, question, 'unavailable', collected.message);
    return result(
      projectAsk({
        exchangeId: params.exchangeId,
        question,
        status: 'answered',
        choice: collected.value.choice,
        options: params.options,
        ...(collected.value.comment ? { comment: collected.value.comment } : {}),
      }),
    );
  }
}

async function presentSingleChoicePicker(
  params: CollectableAskWithOptions,
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

async function collectPickedSingleChoice(
  params: CollectableAskWithOptions,
  picked: PickedSingleChoice,
  ctx: StructuredExchangeUiContext,
): Promise<StepResult<{ readonly choice: SelectedChoice; readonly comment?: string }>> {
  const listed = new Set(params.options.map((option) => option.id));
  const option = choicesFromParams(params).find((choice) => choice.id === picked.id);
  if (!option) return unavailable(`ask received unknown option id ${picked.id}`);

  let choice = selectedChoice(option.id, option.label, listed);
  if (choice.kind === 'other') {
    const other = await collectRequiredInput(ctx, 'Other', 'Describe your answer');
    if (other.status === 'back') return back();
    if (other.status === 'unavailable') return unavailable('ask choice input unavailable');
    choice = { ...choice, label: other.value };
  }
  const comment = await collectAskComment({
    choiceKinds: [choice.kind],
    ctx,
    requiredPrompt: params.commentPrompt ?? 'Required comment',
    optionalPrompt: params.commentPrompt,
    unavailableMessage: 'ask comment unavailable',
  });
  if (isBack(comment)) return back();
  if (comment.status === 'unavailable') return unavailable(comment.message);

  return {
    status: 'answered',
    value: { choice, ...(comment.value.comment ? { comment: comment.value.comment } : {}) },
  };
}

async function collectMultiChoice(
  params: CollectableAskParams,
  question: AskQuestionEcho,
  ctx: StructuredExchangeUiContext,
): Promise<ToolResult> {
  if (!hasOptions(params)) return terminal(params, question, 'unavailable', 'ask choices require options');
  if (!ctx.hasUI) return terminal(params, question, 'unavailable', 'ask choices requires interactive UI');
  if (typeof ctx.ui?.custom !== 'function') {
    if (typeof ctx.ui?.editor === 'function') return collectMultiChoiceViaEditor(params, question, ctx);
    return terminal(params, question, 'unavailable', 'ask choices requires interactive UI');
  }
  return collectMultiChoiceWithBackNavigation(params, question, ctx, ctx.ui.custom);
}

async function collectMultiChoiceWithBackNavigation(
  params: CollectableAskWithOptions,
  question: AskQuestionEcho,
  ctx: StructuredExchangeUiContext,
  custom: NonNullable<NonNullable<StructuredExchangeUiContext['ui']>['custom']>,
): Promise<ToolResult> {
  let selectedChoiceIds: readonly string[] = [];
  for (;;) {
    const picked = await presentMultiChoicePicker(params, ctx, custom, selectedChoiceIds);
    if (!picked) {
      surfaceContinueHint(ctx);
      return terminal(params, question, 'cancelled');
    }
    selectedChoiceIds = picked.choices.map((choice) => choice.id);
    const collected = await collectPickedMultiChoices(params, picked, ctx);
    if (isBack(collected)) continue;
    if (collected.status === 'unavailable')
      return terminal(params, question, 'unavailable', collected.message);
    return result(
      projectAsk({
        exchangeId: params.exchangeId,
        question,
        status: 'answered',
        choices: collected.value.choices,
        options: params.options,
        ...(collected.value.comment ? { comment: collected.value.comment } : {}),
      }),
    );
  }
}

async function presentMultiChoicePicker(
  params: CollectableAskWithOptions,
  ctx: StructuredExchangeUiContext,
  custom: NonNullable<NonNullable<StructuredExchangeUiContext['ui']>['custom']>,
  selectedChoiceIds: readonly string[],
): Promise<PickedMultiChoices | undefined> {
  return withWorkingIndicatorHidden(ctx, () =>
    custom<PickedMultiChoices | undefined>((_tui, theme, _keybindings, done) =>
      createMultiChoicePickerComponent({
        prompt: 'Choose all that apply',
        body: params.body,
        choices: choicesFromParams(params),
        ...(selectedChoiceIds.length > 0 ? { initialSelectedChoiceIds: selectedChoiceIds } : {}),
        ...(params.allowNone ? { exclusiveChoiceIds: ['none'] } : {}),
        ...(params.topLabel ? { topLabel: params.topLabel } : {}),
        ...(params.bottomLabel ? { bottomLabel: params.bottomLabel } : {}),
        theme,
        borderColor: askBorderColor(ctx, theme),
        onDone: done,
      }),
    ),
  );
}

async function collectPickedMultiChoices(
  params: CollectableAskWithOptions,
  picked: PickedMultiChoices,
  ctx: StructuredExchangeUiContext,
): Promise<StepResult<{ readonly choices: readonly SelectedChoice[]; readonly comment?: string }>> {
  const listed = new Set(params.options.map((option) => option.id));
  const selected: SelectedChoice[] = [];
  for (const item of picked.choices) {
    let choice = selectedChoice(item.id, item.label, listed);
    if (choice.kind === 'other') {
      const other = await collectRequiredInput(ctx, 'Other', 'Describe your answer');
      if (other.status === 'back') return back();
      if (other.status === 'unavailable') return unavailable('ask choice input unavailable');
      choice = { ...choice, label: other.value };
    }
    selected.push(choice);
  }
  if (selected.some((choice) => choice.kind === 'none') && selected.length > 1) {
    return unavailable('ask choices cannot combine None with other selections');
  }

  const comment = await collectAskComment({
    choiceKinds: selected.map((choice) => choice.kind),
    ctx,
    requiredPrompt: params.commentPrompt ?? 'Required comment',
    optionalPrompt: params.commentPrompt,
    unavailableMessage: 'ask comment unavailable',
  });
  if (isBack(comment)) return back();
  if (comment.status === 'unavailable') return unavailable(comment.message);

  return {
    status: 'answered',
    value: { choices: selected, ...(comment.value.comment ? { comment: comment.value.comment } : {}) },
  };
}

async function collectMultiChoiceViaEditor(
  params: CollectableAskParams,
  question: AskQuestionEcho,
  ctx: StructuredExchangeUiContext,
): Promise<ToolResult> {
  const editorResult = await requestChoicesViaEditor(
    {
      exchangeId: params.exchangeId,
      prompt: params.body,
      choices: params.options!.map((option) => ({
        id: option.id,
        label: option.label,
        ...(option.description ? { description: option.description } : {}),
      })),
      options: params.options!.map((option) => ({
        id: option.id,
        content: option.label,
        ...(option.description ? { rationale: option.description } : {}),
      })),
      ...(params.allowOther !== undefined ? { allowOther: params.allowOther } : {}),
      ...(params.allowNone !== undefined ? { allowNone: params.allowNone } : {}),
      ...(params.commentPrompt !== undefined ? { commentPrompt: params.commentPrompt } : {}),
    },
    (prefill) => ctx.ui!.editor!(prefill),
  );
  const details = editorResult.details;
  if ('answered' in details) {
    return result(
      projectAsk({
        exchangeId: params.exchangeId,
        question,
        status: 'answered',
        choices: details.answered.choices,
        options: params.options!,
        ...(details.answered.comment ? { comment: details.answered.comment } : {}),
      }),
    );
  }
  if ('cancelled' in details) {
    surfaceContinueHint(ctx);
    return terminal(params, question, 'cancelled', details.cancelled.message);
  }
  return terminal(params, question, 'unavailable', details.unavailable.message);
}

function continuationTerminal(
  params: ContinuationCollectParams,
  present: PresentDetails,
  status: 'cancelled' | 'unavailable',
  message?: string,
): ToolResult {
  const question = askQuestionEcho(params);
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
  return terminal(params, question, status, message);
}

type DeclaredContinuationPresent =
  | (PresentCandidatesDetails & {
      readonly continuation: NonNullable<PresentCandidatesDetails['continuation']>;
    })
  | (PresentDigestDetails & { readonly continuation: NonNullable<PresentDigestDetails['continuation']> })
  | (PresentReviewSetDetails & {
      readonly continuation: NonNullable<PresentReviewSetDetails['continuation']>;
    });

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

async function collectContinuingAsk(
  params: ContinuingAskParams,
  ctx: StructuredExchangeUiContext,
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
  if (isDeclaredCandidatePresent(present)) return collectContinuingCandidateChoice(declared, present, ctx);
  if (isDeclaredReviewPresent(present)) return collectContinuingReview(declared, present, ctx);
  return present satisfies never;
}

async function collectContinuingCandidateChoice(
  params: ContinuationCollectParams,
  present: PresentCandidatesDetails,
  ctx: StructuredExchangeUiContext,
): Promise<ToolResult> {
  if (!ctx.hasUI || typeof ctx.ui?.custom !== 'function' || !hasOptions(params)) {
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
  return { content: [{ type: 'text', text: formatRequestChoice(details) }], details };
}

async function collectContinuingReview(
  params: ContinuationCollectParams,
  present: PresentDigestDetails | PresentReviewSetDetails,
  ctx: StructuredExchangeUiContext,
): Promise<ToolResult> {
  if (!ctx.hasUI || typeof ctx.ui?.custom !== 'function') {
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
    return { content: [{ type: 'text', text: formatRequestReview(details) }], details };
  }
}

async function collectContinuationReviewComment(
  params: ContinuationCollectParams,
  review: ReviewDecision,
  ctx: StructuredExchangeUiContext,
): Promise<StepResult<{ readonly comment?: string }>> {
  return collectAskComment({
    reviewDecision: review,
    ctx,
    requiredPrompt: params.commentPrompt ?? 'Required change request',
    optionalPrompt: 'Optional comment',
    unavailableMessage: 'ask review comment unavailable',
  });
}

async function collectAskComment(
  input: AskCommentInput & {
    readonly ctx: StructuredExchangeUiContext;
    readonly requiredPrompt: string;
    readonly optionalPrompt?: string | undefined;
    readonly unavailableMessage: string;
  },
): Promise<StepResult<{ readonly comment?: string }>> {
  const requirement = structuredExchangeResponseRequiresComment(
    input.reviewDecision !== undefined
      ? { reviewDecision: input.reviewDecision }
      : { choiceKinds: input.choiceKinds },
  )
    ? 'required'
    : 'optional';
  if (requirement === 'optional') {
    if (input.optionalPrompt === undefined) return { status: 'answered', value: {} };
    return collectCommentStep({
      requirement,
      prompt: input.optionalPrompt,
      ctx: input.ctx,
      unavailableMessage: input.unavailableMessage,
    });
  }
  return collectCommentStep({
    requirement,
    prompt: input.requiredPrompt,
    ctx: input.ctx,
    unavailableMessage: input.unavailableMessage,
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

type ParsedAskParams = ReturnType<typeof zAskParams.parse>;

function isContinuingAskParams(params: ParsedAskParams): params is ContinuingAskParams {
  return typeof params.continues === 'string';
}

function standaloneAskParams(params: ParsedAskParams): StandaloneAskParams {
  if (!params.exchangeId || !params.body) throw new Error('validated standalone ask is missing payload');
  return {
    exchangeId: params.exchangeId,
    body: params.body,
    ...(params.options !== undefined ? { options: params.options } : {}),
    ...(params.multiple !== undefined ? { multiple: params.multiple } : {}),
    ...(params.allowOther !== undefined ? { allowOther: params.allowOther } : {}),
    ...(params.allowNone !== undefined ? { allowNone: params.allowNone } : {}),
    ...(params.commentPrompt !== undefined ? { commentPrompt: params.commentPrompt } : {}),
    ...(params.topLabel !== undefined ? { topLabel: params.topLabel } : {}),
    ...(params.bottomLabel !== undefined ? { bottomLabel: params.bottomLabel } : {}),
  };
}

export function collectAskResponse(
  params: CollectableAskParams,
  question: AskQuestionEcho,
  ctx: StructuredExchangeUiContext,
  answerBroker?: LiveExchangeAwaiter,
): Promise<ToolResult> {
  if (!params.options) return collectFreeText(params, question, ctx, answerBroker);
  if (params.multiple) return collectMultiChoice(params, question, ctx);
  return collectSingleChoice(params, question, ctx);
}

export function collectAskContinuationResponse(
  exchangeId: string,
  ctx: StructuredExchangeUiContext,
): Promise<ToolResult> {
  return collectContinuingAsk({ continues: exchangeId }, ctx);
}

export function createAskTool(answerBroker?: LiveExchangeAwaiter) {
  return defineTool({
    name: ASK_TOOL,
    label: 'Ask',
    description:
      'Ask the user one structured Brunch question. Omit options for free text; include options for single-select; set multiple for multi-select.',
    promptSnippet: 'Ask one structured question; the tool result carries both question and answer.',
    promptGuidelines: [
      'Use ask for ordinary Brunch questions; do not call present_question.',
      'Put the full question in body markdown. Use options[] for finite choices instead of numbered body text.',
      'Set commentPrompt only when a trailing comment is worth collecting; omitting it skips the optional-comment step.',
      'The ask result is the durable transcript artifact; renderCall is intentionally non-semantic.',
      'For offer continuations, call ask with continues only; the runtime fills body/options from the present_* declaration.',
    ],
    parameters: piSchema(zAskParams),
    executionMode: 'sequential',

    async execute(_toolCallId, rawParams, _signal, _onUpdate, ctx) {
      const params = zAskParams.parse(rawParams);
      const uiCtx = ctx as unknown as StructuredExchangeUiContext;
      if (isContinuingAskParams(params)) return collectContinuingAsk(params, uiCtx);
      const standalone = standaloneAskParams(params);
      const question = askQuestionEcho(standalone);
      return collectAskResponse(standalone, question, uiCtx, answerBroker);
    },

    renderCall() {
      return renderEmptyStructuredExchangeCall();
    },

    renderResult(resultValue, _options, theme) {
      return renderMarkdownResult(resultValue, theme);
    },
  });
}

export const askTool = createAskTool();
