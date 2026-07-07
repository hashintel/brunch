import { getSelectListTheme, defineTool } from '@earendil-works/pi-coding-agent';
import type { EditorTheme } from '@earendil-works/pi-tui';

import { formatAsk } from '../../../agents/contexts/exchanges/ask.js';
import { askQuestionEcho, projectAsk } from '../../../exchanges/projections/ask.js';
import {
  structuredExchangeResponseRequiresComment,
  zAskParams,
  type AskParams,
  type AskQuestionEcho,
  type SelectedChoice,
} from '../../../exchanges/schemas/index.js';
import type { LiveExchangeAwaiter } from '../../../session/live-exchange-broker.js';
import { ExchangeAnswerEditorComponent } from '../../components/exchange-answer-editor.js';
import { createExchangeDecisionPickerComponent } from '../../components/exchange-decision-picker.js';
import { createMultiChoicePickerComponent } from '../../components/multi-choice-picker.js';
import { piSchema } from './pi-schema.js';
import {
  normalizeOptionalText,
  renderEmptyStructuredExchangeCall,
  renderMarkdownResult,
} from './shared/markdown.js';
import { collectRequiredInput } from './shared/required-input.js';
import { withWorkingIndicatorHidden, type StructuredExchangeUiContext } from './shared/ui-context.js';

export const ASK_TOOL = 'ask' as const;

type ToolResult = {
  readonly content: { readonly type: 'text'; readonly text: string }[];
  readonly details: ReturnType<typeof projectAsk>;
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
  params: Pick<AskParams, 'exchangeId'>,
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

function choicesFromParams(params: AskParams): readonly { readonly id: string; readonly label: string }[] {
  return [
    ...(params.options ?? []),
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
  params: AskParams,
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
          const editorTheme: EditorTheme = {
            borderColor: (text) => theme.fg('border', text),
            selectList: getSelectListTheme(),
          };
          return new ExchangeAnswerEditorComponent(tui, editorTheme, {
            prompt: params.body,
            theme,
            onDone: (value) =>
              done(value === undefined ? { status: 'cancelled' } : { status: 'answered', answer: value }),
          });
        },
      ),
    );
    if (customResult?.status === 'answered') answer = customResult.answer;
    else if (customResult?.status === 'cancelled') return terminal(params, question, 'cancelled');
  } else if (ctx.hasUI && typeof ctx.ui?.editor === 'function') {
    answer = await withWorkingIndicatorHidden(ctx, () => ctx.ui!.editor!(params.body));
    if (answer === undefined) return terminal(params, question, 'cancelled');
  } else if (answerBroker) {
    answer = await answerBroker.awaitAnswer({ exchangeId: params.exchangeId });
  } else {
    return terminal(params, question, 'unavailable', 'ask requires interactive UI');
  }

  if (answer === undefined) return terminal(params, question, 'cancelled');
  const trimmed = answer.trim();
  if (trimmed.length === 0) return terminal(params, question, 'unavailable', 'ask answer cannot be empty');
  return result(projectAsk({ exchangeId: params.exchangeId, question, status: 'answered', answer: trimmed }));
}

async function collectSingleChoice(
  params: AskParams,
  question: AskQuestionEcho,
  ctx: StructuredExchangeUiContext,
): Promise<ToolResult> {
  if (!ctx.hasUI || typeof ctx.ui?.custom !== 'function' || !params.options) {
    return terminal(params, question, 'unavailable', 'ask choice requires interactive UI');
  }
  const custom = ctx.ui.custom;
  const picked = await withWorkingIndicatorHidden(ctx, () =>
    custom<{ readonly id: string } | undefined>((_tui, theme, _keybindings, done) =>
      createExchangeDecisionPickerComponent({
        prompt: 'Choose one',
        body: params.body,
        choices: choicesFromParams(params),
        ...(params.topLabel ? { topLabel: params.topLabel } : {}),
        ...(params.bottomLabel ? { bottomLabel: params.bottomLabel } : {}),
        theme,
        onDone: done,
      }),
    ),
  );
  if (!picked) return terminal(params, question, 'cancelled');

  const listed = new Set(params.options.map((option) => option.id));
  const option = choicesFromParams(params).find((choice) => choice.id === picked.id);
  if (!option)
    return terminal(params, question, 'unavailable', `ask received unknown option id ${picked.id}`);

  let choice = selectedChoice(option.id, option.label, listed);
  if (choice.kind === 'other') {
    const other = await collectRequiredInput(ctx, 'Other', 'Describe your answer');
    if (other.status !== 'answered') return terminal(params, question, other.status);
    choice = { ...choice, label: other.value };
  }
  let comment: string | undefined;
  if (structuredExchangeResponseRequiresComment({ choiceKinds: [choice.kind] })) {
    const required = await collectRequiredInput(ctx, params.commentPrompt ?? 'Required comment');
    if (required.status !== 'answered') return terminal(params, question, required.status);
    comment = required.value;
  } else if (typeof ctx.ui.input === 'function') {
    comment = normalizeOptionalText(await ctx.ui.input(params.commentPrompt ?? 'Optional comment'));
  }

  return result(
    projectAsk({
      exchangeId: params.exchangeId,
      question,
      status: 'answered',
      choice,
      options: params.options,
      ...(comment ? { comment } : {}),
    }),
  );
}

async function collectMultiChoice(
  params: AskParams,
  question: AskQuestionEcho,
  ctx: StructuredExchangeUiContext,
): Promise<ToolResult> {
  if (!ctx.hasUI || typeof ctx.ui?.custom !== 'function' || !params.options) {
    return terminal(params, question, 'unavailable', 'ask choices requires interactive UI');
  }
  const custom = ctx.ui.custom;
  const picked = await withWorkingIndicatorHidden(ctx, () =>
    custom<{ readonly choices: readonly { readonly id: string; readonly label: string }[] } | undefined>(
      (_tui, theme, _keybindings, done) =>
        createMultiChoicePickerComponent({
          prompt: 'Choose all that apply',
          body: params.body,
          choices: choicesFromParams(params),
          ...(params.allowNone ? { exclusiveChoiceIds: ['none'] } : {}),
          ...(params.topLabel ? { topLabel: params.topLabel } : {}),
          ...(params.bottomLabel ? { bottomLabel: params.bottomLabel } : {}),
          theme,
          onDone: done,
        }),
    ),
  );
  if (!picked) return terminal(params, question, 'cancelled');

  const listed = new Set(params.options.map((option) => option.id));
  const selected: SelectedChoice[] = [];
  for (const item of picked.choices) {
    let choice = selectedChoice(item.id, item.label, listed);
    if (choice.kind === 'other') {
      const other = await collectRequiredInput(ctx, 'Other', 'Describe your answer');
      if (other.status !== 'answered') return terminal(params, question, other.status);
      choice = { ...choice, label: other.value };
    }
    selected.push(choice);
  }
  if (selected.some((choice) => choice.kind === 'none') && selected.length > 1) {
    return terminal(params, question, 'unavailable', 'ask choices cannot combine None with other selections');
  }

  let comment: string | undefined;
  if (structuredExchangeResponseRequiresComment({ choiceKinds: selected.map((choice) => choice.kind) })) {
    const required = await collectRequiredInput(ctx, params.commentPrompt ?? 'Required comment');
    if (required.status !== 'answered') return terminal(params, question, required.status);
    comment = required.value;
  } else if (typeof ctx.ui.input === 'function') {
    comment = normalizeOptionalText(await ctx.ui.input(params.commentPrompt ?? 'Optional comment'));
  }

  return result(
    projectAsk({
      exchangeId: params.exchangeId,
      question,
      status: 'answered',
      choices: selected,
      options: params.options,
      ...(comment ? { comment } : {}),
    }),
  );
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
      'The ask result is the durable transcript artifact; renderCall is intentionally non-semantic.',
    ],
    parameters: piSchema(zAskParams),
    executionMode: 'sequential',

    async execute(_toolCallId, rawParams, _signal, _onUpdate, ctx) {
      const params = zAskParams.parse(rawParams) satisfies AskParams;
      const question = askQuestionEcho(params);
      const uiCtx = ctx as unknown as StructuredExchangeUiContext;
      if (!params.options) return collectFreeText(params, question, uiCtx, answerBroker);
      if (params.multiple) return collectMultiChoice(params, question, uiCtx);
      return collectSingleChoice(params, question, uiCtx);
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
