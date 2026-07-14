import { getSelectListTheme, defineTool, type Theme } from '@earendil-works/pi-coding-agent';
import type { EditorTheme } from '@earendil-works/pi-tui';

import { formatAsk } from '../../../agents/contexts/exchanges/ask.js';
import {
  askQuestionEcho,
  projectAsk,
  projectDigestConfirmation,
  projectDigestQuestionnaire,
} from '../../../exchanges/projections/ask.js';
import { resolveEligibleDigestAcceptance } from '../../../exchanges/recovery.js';
import {
  parseAskParams,
  QUESTIONNAIRE_SUBMISSION_SCHEMA,
  zAskParams,
  type AskContinuationParams,
  type AskQuestionEcho,
  type QuestionnaireAnswer,
  type QuestionnaireQuestion,
  zQuestionnaireSubmissionFor,
  type RequestDetails,
  type SelectedChoice,
  type StandaloneAskParams,
} from '../../../exchanges/schemas/index.js';
import { normalizeOptionalUnknownText } from '../../../exchanges/text.js';
import { projectBrunchAgentState } from '../../../projections/session/runtime-state.js';
import type { LiveAskOpener } from '../../../session/live-ask-registry.js';
import { ExchangeAnswerEditorComponent } from '../../components/exchange-answer-editor.js';
import { createExchangeDecisionPickerComponent } from '../../components/exchange-decision-picker.js';
import { ExchangeQuestionnaireComponent } from '../../components/exchange-questionnaire.js';
import { operationalModeBorderColor } from '../../components/mode-border-theme.js';
import { createMultiChoicePickerComponent } from '../../components/multi-choice-picker.js';
import { BRUNCH_CONSULT_COMMAND, BRUNCH_MODE_COMMAND, slashCommand } from '../commands/names.js';
import { toolParameters } from '../shared/tool-schema.js';
import { collectContinuingAsk } from './ask/continuation.js';
import type { ReviewSetStructuredExchangeDeps } from './present-review-set.js';
import { requestChoicesViaEditor } from './shared/choices-editor.js';
import { renderEmptyStructuredExchangeCall, renderMarkdownResult } from './shared/markdown.js';
import {
  back,
  collectCommentRequirementStep,
  collectRequiredInput,
  isBack,
  unavailable,
  type StepResult,
} from './shared/required-input.js';
import { withWorkingIndicatorHidden, type StructuredExchangeUiContext } from './shared/ui-context.js';
import { validationFailureResult } from './shared/validation.js';

export const ASK_TOOL = 'ask' as const;
export { collectAskContinuationResponse } from './ask/continuation.js';
const CONSULT_COMMAND_HINT = slashCommand(BRUNCH_CONSULT_COMMAND);
const MODE_COMMAND_HINT = slashCommand(BRUNCH_MODE_COMMAND);

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

type ContinuationCollectParams = AskContinuationParams & { readonly exchangeId: string };
type OrdinaryStandaloneAskParams = StandaloneAskParams & {
  readonly body: string;
  readonly questions?: undefined;
  readonly acceptsDigest?: undefined;
};
type QuestionnaireAskParams = StandaloneAskParams & {
  readonly body: string;
  readonly acceptsDigest: string;
  readonly questions: readonly QuestionnaireQuestion[];
};
type DigestConfirmationAskParams = StandaloneAskParams & {
  readonly body: string;
  readonly acceptsDigest: string;
  readonly questions?: undefined;
  readonly options: NonNullable<StandaloneAskParams['options']>;
};
export type CollectableAskParams =
  | OrdinaryStandaloneAskParams
  | DigestConfirmationAskParams
  | ContinuationCollectParams;
export type CollectableAskWithOptions = CollectableAskParams & {
  readonly options: NonNullable<CollectableAskParams['options']>;
};
type PickedSingleChoice = { readonly id: string };
type PickedMultiChoices = {
  readonly choices: readonly { readonly id: string; readonly label: string }[];
};
type FreeTextCollectionResult =
  | { readonly status: 'answered'; readonly answer: string }
  | { readonly status: 'cancelled' }
  | { readonly status: 'try-next' };

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
  liveAsk: LiveAskOpener | undefined,
  signal: AbortSignal,
): Promise<ToolResult> {
  const collected = await firstAvailableFreeTextCollector([
    () => collectFreeTextViaCustomEditor(params, ctx),
    () => collectFreeTextViaPlainEditor(params, ctx),
    () => collectFreeTextViaLiveAsk(params, question, liveAsk, signal),
  ]);
  if (collected === undefined)
    return terminal(params, question, 'unavailable', 'ask requires interactive UI');
  if (collected.status === 'cancelled') return terminal(params, question, 'cancelled');
  const trimmed = collected.answer.trim();
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

async function firstAvailableFreeTextCollector(
  collectors: readonly (() => Promise<FreeTextCollectionResult>)[],
): Promise<Exclude<FreeTextCollectionResult, { readonly status: 'try-next' }> | undefined> {
  for (const collect of collectors) {
    const result = await collect();
    if (result.status === 'try-next') continue;
    return result;
  }
  return undefined;
}

async function collectFreeTextViaCustomEditor(
  params: CollectableAskParams,
  ctx: StructuredExchangeUiContext,
): Promise<FreeTextCollectionResult> {
  if (!ctx.hasUI || typeof ctx.ui?.custom !== 'function') return { status: 'try-next' };
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
  if (customResult?.status === 'answered') return customResult;
  if (customResult?.status === 'cancelled') return customResult;
  // pi 0.80.x headless custom stubs resolve undefined; try the plain editor next.
  return { status: 'try-next' };
}

async function collectFreeTextViaPlainEditor(
  params: CollectableAskParams,
  ctx: StructuredExchangeUiContext,
): Promise<FreeTextCollectionResult> {
  if (!ctx.hasUI || typeof ctx.ui?.editor !== 'function') return { status: 'try-next' };
  const answer = await withWorkingIndicatorHidden(ctx, () => ctx.ui!.editor!(params.body));
  return answer === undefined ? { status: 'cancelled' } : { status: 'answered', answer };
}

async function collectFreeTextViaLiveAsk(
  params: CollectableAskParams,
  question: AskQuestionEcho,
  liveAsk: LiveAskOpener | undefined,
  signal: AbortSignal,
): Promise<FreeTextCollectionResult> {
  if (!liveAsk) return { status: 'try-next' };
  const answer = await liveAsk.openAsk({ exchangeId: params.exchangeId, mode: 'text', question }, signal);
  return answer === undefined ? { status: 'cancelled' } : { status: 'answered', answer };
}

async function collectSingleChoice(
  params: CollectableAskParams,
  question: AskQuestionEcho,
  ctx: StructuredExchangeUiContext,
  liveAsk: LiveAskOpener | undefined,
  signal: AbortSignal,
): Promise<ToolResult> {
  if (!hasOptions(params)) {
    return terminal(params, question, 'unavailable', 'ask choice requires options');
  }
  if (ctx.hasUI && typeof ctx.ui?.custom === 'function') {
    return collectSingleChoiceWithBackNavigation(params, question, ctx, ctx.ui.custom);
  }
  if (liveAsk) {
    return collectSingleChoiceViaLiveAsk(params, question, liveAsk, signal);
  }
  return terminal(params, question, 'unavailable', 'ask choice requires interactive UI');
}

// ceiling: headless choice answers accept only a listed option id; the Other /
// None escapes and comment sub-steps stay interactive-only (they need ctx.ui
// input steps). Upgrade trigger: when a headless driver needs those escapes,
// widen the broker answer from a bare string into an answer-envelope shape.
async function collectSingleChoiceViaLiveAsk(
  params: CollectableAskWithOptions,
  question: AskQuestionEcho,
  liveAsk: LiveAskOpener,
  signal: AbortSignal,
): Promise<ToolResult> {
  const answer = await liveAsk.openAsk(
    { exchangeId: params.exchangeId, mode: 'single-select', question },
    signal,
  );
  if (answer === undefined) return terminal(params, question, 'cancelled');
  const option = params.options.find((candidate) => candidate.id === answer);
  if (!option) return terminal(params, question, 'unavailable', `ask received unknown option id ${answer}`);
  return result(
    projectAsk({
      exchangeId: params.exchangeId,
      question,
      status: 'answered',
      choice: { id: option.id, label: option.label, kind: 'listed' },
      options: params.options,
    }),
  );
}

async function collectSingleChoiceWithBackNavigation(
  params: CollectableAskWithOptions,
  question: AskQuestionEcho,
  ctx: StructuredExchangeUiContext,
  custom: NonNullable<NonNullable<StructuredExchangeUiContext['ui']>['custom']>,
): Promise<ToolResult> {
  for (;;) {
    const picked = await presentSingleChoicePicker(params, ctx, custom);
    if (!picked) return terminal(params, question, 'cancelled');
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
  const comment = await collectCommentRequirementStep({
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
  liveAsk: LiveAskOpener | undefined,
  signal: AbortSignal,
): Promise<ToolResult> {
  if (!hasOptions(params)) return terminal(params, question, 'unavailable', 'ask choices require options');
  if (ctx.hasUI && typeof ctx.ui?.custom === 'function') {
    return collectMultiChoiceWithBackNavigation(params, question, ctx, ctx.ui.custom);
  }
  if (ctx.hasUI && typeof ctx.ui?.editor === 'function') {
    return collectMultiChoiceViaEditor(params, question, ctx);
  }
  if (liveAsk) {
    return collectMultiChoiceViaLiveAsk(params, question, liveAsk, signal);
  }
  return terminal(params, question, 'unavailable', 'ask choices requires interactive UI');
}

// ceiling: headless multi-select accepts a comma/newline-delimited list of
// listed option ids; Other/None escapes and the comment step stay
// interactive-only. Upgrade trigger: when a headless driver needs those escapes,
// widen the broker answer into an envelope shape (as collectSingleChoiceViaLiveAsk).
async function collectMultiChoiceViaLiveAsk(
  params: CollectableAskWithOptions,
  question: AskQuestionEcho,
  liveAsk: LiveAskOpener,
  signal: AbortSignal,
): Promise<ToolResult> {
  const answer = await liveAsk.openAsk(
    { exchangeId: params.exchangeId, mode: 'multi-select', question },
    signal,
  );
  if (answer === undefined) return terminal(params, question, 'cancelled');
  const ids = answer
    .split(/[,\n]/)
    .map((value) => value.trim())
    .filter((value) => value.length > 0);
  if (ids.length === 0) {
    return terminal(params, question, 'unavailable', 'ask choices requires at least one selection');
  }
  const choices: SelectedChoice[] = [];
  for (const id of ids) {
    const option = params.options.find((candidate) => candidate.id === id);
    if (!option) return terminal(params, question, 'unavailable', `ask received unknown option id ${id}`);
    choices.push({ id: option.id, label: option.label, kind: 'listed' });
  }
  return result(
    projectAsk({
      exchangeId: params.exchangeId,
      question,
      status: 'answered',
      choices,
      options: params.options,
    }),
  );
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
    if (!picked) return terminal(params, question, 'cancelled');
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

  const comment = await collectCommentRequirementStep({
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
  if ('cancelled' in details) return terminal(params, question, 'cancelled', details.cancelled.message);
  return terminal(params, question, 'unavailable', details.unavailable.message);
}

function isQuestionnaireAsk(params: StandaloneAskParams): params is QuestionnaireAskParams {
  return params.acceptsDigest !== undefined && params.questions !== undefined;
}

function isDigestConfirmationAsk(params: StandaloneAskParams): params is DigestConfirmationAskParams {
  return params.acceptsDigest !== undefined && params.questions === undefined && params.options !== undefined;
}

function isOrdinaryStandaloneAsk(params: StandaloneAskParams): params is OrdinaryStandaloneAskParams {
  return params.acceptsDigest === undefined && params.questions === undefined;
}

async function collectDigestQuestionnaire(
  params: QuestionnaireAskParams,
  ctx: StructuredExchangeUiContext,
  liveAsk: LiveAskOpener | undefined,
  signal: AbortSignal,
): Promise<ToolResult> {
  const digest = resolveEligibleDigestAcceptance(ctx.sessionManager?.getBranch() ?? [], params.acceptsDigest);
  if (!digest) {
    return terminal(
      params,
      { body: params.body },
      'unavailable',
      'acceptsDigest must reference the final eligible digest',
    );
  }
  const collected = await collectQuestionnaireAnswers(params, ctx, liveAsk, signal);
  if (collected.status === 'cancelled') return terminal(params, { body: params.body }, 'cancelled');
  if (collected.status === 'invalid') {
    return terminal(params, { body: params.body }, 'unavailable', 'Invalid questionnaire submission.');
  }
  const details = projectDigestQuestionnaire({
    exchangeId: params.exchangeId,
    acceptsDigest: params.acceptsDigest,
    acceptedAbstract: digest.digest.abstract,
    questions: params.questions,
    answers: collected.answers,
  });
  return { content: [{ type: 'text', text: formatAsk(details) }], details };
}

async function collectDigestConfirmation(
  params: DigestConfirmationAskParams,
  ctx: StructuredExchangeUiContext,
  liveAsk: LiveAskOpener | undefined,
  signal: AbortSignal,
): Promise<ToolResult> {
  const digest = resolveEligibleDigestAcceptance(ctx.sessionManager?.getBranch() ?? [], params.acceptsDigest);
  if (!digest) {
    return terminal(
      params,
      { body: params.body, options: params.options },
      'unavailable',
      'acceptsDigest must reference the final eligible digest',
    );
  }
  const collected = await collectSingleChoice(params, askQuestionEcho(params), ctx, liveAsk, signal);
  if (!('answered' in collected.details) || !('choice' in collected.details.answered)) return collected;
  if (collected.details.answered.choice.id !== 'confirm') return collected;
  return result(
    projectDigestConfirmation({
      exchangeId: params.exchangeId,
      acceptsDigest: params.acceptsDigest,
      acceptedAbstract: digest.digest.abstract,
      question: askQuestionEcho(params) as AskQuestionEcho & {
        options: NonNullable<AskQuestionEcho['options']>;
      },
      choice: collected.details.answered.choice,
    }),
  );
}

async function collectQuestionnaireAnswers(
  params: QuestionnaireAskParams,
  ctx: StructuredExchangeUiContext,
  liveAsk: LiveAskOpener | undefined,
  signal: AbortSignal,
): Promise<
  | { readonly status: 'answered'; readonly answers: readonly QuestionnaireAnswer[] }
  | { readonly status: 'cancelled' }
  | { readonly status: 'invalid' }
> {
  if (ctx.hasUI && typeof ctx.ui?.custom === 'function') {
    const custom = ctx.ui.custom;
    const answers = await withWorkingIndicatorHidden(ctx, () =>
      custom<readonly QuestionnaireAnswer[]>(
        (_tui, theme, _keybindings, done) =>
          new ExchangeQuestionnaireComponent({
            questions: params.questions,
            theme,
            borderColor: askBorderColor(ctx, theme),
            onDone: done,
          }),
      ),
    );
    return answers === undefined ? { status: 'cancelled' } : { status: 'answered', answers };
  }
  const envelope = JSON.stringify({ schema: QUESTIONNAIRE_SUBMISSION_SCHEMA, answers: [] }, null, 2);
  const raw =
    ctx.hasUI && typeof ctx.ui?.editor === 'function'
      ? await withWorkingIndicatorHidden(ctx, () => ctx.ui!.editor!(envelope))
      : liveAsk
        ? await liveAsk.openAsk(
            {
              exchangeId: params.exchangeId,
              mode: 'questionnaire',
              question: { body: params.body, questions: params.questions },
            },
            signal,
          )
        : undefined;
  if (raw === undefined) return { status: 'cancelled' };
  try {
    return {
      status: 'answered',
      answers: zQuestionnaireSubmissionFor(params.questions).parse(JSON.parse(raw)).answers,
    };
  } catch {
    return { status: 'invalid' };
  }
}

export function collectAskResponse(
  params: CollectableAskParams,
  question: AskQuestionEcho,
  ctx: StructuredExchangeUiContext,
  liveAsk: LiveAskOpener | undefined,
  signal: AbortSignal,
): Promise<ToolResult> {
  if (!params.options) return collectFreeText(params, question, ctx, liveAsk, signal);
  if (params.multiple) return collectMultiChoice(params, question, ctx, liveAsk, signal);
  return collectSingleChoice(params, question, ctx, liveAsk, signal);
}

function notifyStandaloneAskCancellation(result: ToolResult, ctx: StructuredExchangeUiContext): void {
  if (!('cancelled' in result.details)) return;
  ctx.ui?.notify?.(
    `Ask cancelled. Run ${CONSULT_COMMAND_HINT} to choose a next move or ${MODE_COMMAND_HINT} to switch roles.`,
    'info',
  );
}

export function createAskTool(liveAsk?: LiveAskOpener, reviewDeps?: ReviewSetStructuredExchangeDeps) {
  return defineTool({
    name: ASK_TOOL,
    label: 'Ask',
    description:
      'Ask the user one structured Brunch question. Omit options for free text; include options for single-select; set multiple for multi-select.',
    promptSnippet: 'Ask one structured question; the tool result carries both question and answer.',
    promptGuidelines: [
      'Use ask for ordinary Brunch questions; do not call present_question.',
      'Put the full question in body markdown. Use options[] for finite choices instead of numbered body text.',
      'Never author a listed option that duplicates the built-in Other affordance; set allowOther when an open-ended answer is needed.',
      'Set commentPrompt only when a trailing comment is worth collecting; omitting it skips the optional-comment step.',
      'The ask result is the durable transcript artifact; renderCall is intentionally non-semantic.',
      'For offer continuations, call ask with continues only; the runtime fills body/options from the present_* declaration.',
      "Do not restate a present_* offer's large pretext or digest body in the continuing ask body; the present result remains the pretext.",
    ],
    parameters: toolParameters(zAskParams),
    executionMode: 'sequential',

    async execute(_toolCallId, rawParams, signal, _onUpdate, ctx) {
      const parsed = parseAskParams(rawParams);
      if (!parsed.success) return validationFailureResult(ASK_TOOL, parsed.error);
      const params = parsed.data;
      const uiCtx = ctx as unknown as StructuredExchangeUiContext;
      const liveSignal = signal ?? AbortSignal.abort();
      if ('continues' in params) return collectContinuingAsk(params, uiCtx, liveSignal, liveAsk, reviewDeps);
      const collected = isQuestionnaireAsk(params)
        ? await collectDigestQuestionnaire(params, uiCtx, liveAsk, liveSignal)
        : isDigestConfirmationAsk(params)
          ? await collectDigestConfirmation(params, uiCtx, liveAsk, liveSignal)
          : isOrdinaryStandaloneAsk(params)
            ? await collectAskResponse(params, askQuestionEcho(params), uiCtx, liveAsk, liveSignal)
            : (() => {
                throw new Error('parsed ask parameters do not describe a runtime variant');
              })();
      notifyStandaloneAskCancellation(collected, uiCtx);
      return collected;
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
