import { getSelectListTheme, defineTool, type Theme } from '@earendil-works/pi-coding-agent';
import type { EditorTheme } from '@earendil-works/pi-tui';

import { formatAsk } from '../../../agents/contexts/exchanges/ask.js';
import { askQuestionEcho, projectAsk } from '../../../exchanges/projections/ask.js';
import {
  zAskParams,
  type AskContinuationParams,
  type AskQuestionEcho,
  type ContinuingAskParams,
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
import { toolParameters } from '../shared/tool-schema.js';
import { collectContinuingAsk } from './ask/continuation.js';
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
export { clearContinueHint, collectAskContinuationResponse } from './ask/continuation.js';

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
export type CollectableAskParams = StandaloneAskParams | ContinuationCollectParams;
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
  answerBroker: LiveExchangeAwaiter | undefined,
): Promise<ToolResult> {
  const collected = await firstAvailableFreeTextCollector([
    () => collectFreeTextViaCustomEditor(params, ctx),
    () => collectFreeTextViaPlainEditor(params, ctx),
    () => collectFreeTextViaAnswerBroker(params, answerBroker),
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

async function collectFreeTextViaAnswerBroker(
  params: CollectableAskParams,
  answerBroker: LiveExchangeAwaiter | undefined,
): Promise<FreeTextCollectionResult> {
  if (!answerBroker) return { status: 'try-next' };
  const answer = await answerBroker.awaitAnswer({ exchangeId: params.exchangeId });
  return answer === undefined ? { status: 'cancelled' } : { status: 'answered', answer };
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
      'Never author a listed option that duplicates the built-in Other affordance; set allowOther when an open-ended answer is needed.',
      'Set commentPrompt only when a trailing comment is worth collecting; omitting it skips the optional-comment step.',
      'The ask result is the durable transcript artifact; renderCall is intentionally non-semantic.',
      'For offer continuations, call ask with continues only; the runtime fills body/options from the present_* declaration.',
      "Do not restate a present_* offer's large pretext or digest body in the continuing ask body; the present result remains the pretext.",
    ],
    parameters: toolParameters(zAskParams),
    executionMode: 'sequential',

    async execute(_toolCallId, rawParams, _signal, _onUpdate, ctx) {
      const parsed = zAskParams.safeParse(rawParams);
      if (!parsed.success) return validationFailureResult(ASK_TOOL, parsed.error);
      const params = parsed.data;
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
