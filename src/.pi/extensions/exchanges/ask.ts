import { getSelectListTheme, defineTool } from '@earendil-works/pi-coding-agent';
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
  type AskParams,
  type AskQuestionEcho,
  type PresentDetails,
  type RequestDetails,
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

type StandaloneAskParams = AskParams & { readonly exchangeId: string; readonly body: string };
type ContinuationAskParams = AskContinuationParams & { readonly exchangeId: string };
type CollectableAskParams = StandaloneAskParams | ContinuationAskParams;

function choicesFromParams(
  params: CollectableAskParams,
): readonly { readonly id: string; readonly label: string }[] {
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
  params: CollectableAskParams,
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
  params: CollectableAskParams,
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

function continuationTerminal(
  params: { readonly exchangeId: string; readonly body: string },
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

async function collectContinuingAsk(
  params: AskParams & { readonly continues: string },
  ctx: StructuredExchangeUiContext,
): Promise<ToolResult> {
  const branch = ctx.sessionManager?.getBranch();
  if (!branch) {
    return result(
      projectAsk({
        exchangeId: params.continues,
        question: { body: params.preface ?? 'Continue structured exchange' },
        status: 'unavailable',
        message: 'ask continuation requires access to the current session transcript',
      }),
    );
  }
  const pending = findIncompleteStructuredExchangePresents(branch).find(
    (present) => present.details.exchange_id === params.continues,
  );
  if (!pending) {
    return result(
      projectAsk({
        exchangeId: params.continues,
        question: { body: params.preface ?? 'Continue structured exchange' },
        status: 'unavailable',
        message: `No pending structured exchange found for ${params.continues}`,
      }),
    );
  }
  const present = pending.details;
  const declaredContinuation = 'continuation' in present ? present.continuation : undefined;
  const declared = {
    exchangeId: params.continues,
    ...(declaredContinuation?.params ?? fallbackContinuationParams(present)),
  };
  if (present.tool_meta.curr === 'present_candidates') {
    return collectContinuingCandidateChoice(
      declared,
      present as Extract<PresentDetails, { readonly candidates: unknown }>,
      ctx,
    );
  }
  if (present.tool_meta.curr === 'present_digest' || present.tool_meta.curr === 'present_review_set') {
    return collectContinuingReview(
      declared,
      present as Extract<PresentDetails, { readonly review_set: unknown } | { readonly digest: unknown }>,
      ctx,
    );
  }
  return continuationTerminal(declared, present, 'unavailable', 'Unsupported ask continuation');
}

function fallbackContinuationParams(present: PresentDetails): AskContinuationParams {
  if ('candidates' in present) {
    return {
      body: [present.display.heading, present.display.body]
        .filter((part): part is string => part !== undefined && part.length > 0)
        .join('\n\n'),
      options: present.candidates.map((candidate) => ({
        id: candidate.id,
        label: candidate.title,
        description: candidate.user_rubric.recommendation ?? candidate.user_rubric.core_bet,
      })),
    };
  }
  return {
    body: [present.display.heading, present.display.body]
      .filter((part): part is string => part !== undefined && part.length > 0)
      .join('\n\n'),
    options: REVIEW_CHOICES.map((choice) => ({ ...choice })),
    commentPrompt: 'Required change request',
  };
}

async function collectContinuingCandidateChoice(
  params: ContinuationAskParams,
  present: Extract<PresentDetails, { readonly candidates: unknown }>,
  ctx: StructuredExchangeUiContext,
): Promise<ToolResult> {
  if (!ctx.hasUI || typeof ctx.ui?.custom !== 'function' || !params.options) {
    return continuationTerminal(
      params,
      present,
      'unavailable',
      'ask continuation choice requires interactive UI',
    );
  }
  const picked = await withWorkingIndicatorHidden(ctx, () =>
    ctx.ui!.custom!<{ readonly id: string } | undefined>((_tui, theme, _keybindings, done) =>
      createExchangeDecisionPickerComponent({
        prompt: 'Choose one',
        body: params.body,
        choices: choicesFromParams(params),
        theme,
        onDone: done,
      }),
    ),
  );
  if (!picked) return continuationTerminal(params, present, 'cancelled');
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
  params: ContinuationAskParams,
  present: Extract<PresentDetails, { readonly review_set: unknown } | { readonly digest: unknown }>,
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
  const selected = await withWorkingIndicatorHidden(ctx, () =>
    ctx.ui!.custom!<{ readonly id: ReviewDecision } | undefined>((_tui, theme, _keybindings, done) =>
      createExchangeDecisionPickerComponent({
        prompt: 'Review',
        body: params.body,
        choices: REVIEW_CHOICES,
        theme,
        onDone: (value) => done(value as { readonly id: ReviewDecision } | undefined),
      }),
    ),
  );
  if (!selected) return continuationTerminal(params, present, 'cancelled');
  const review = selected.id;
  let comment: string | undefined;
  if (review === 'request_changes') {
    const required = await collectRequiredInput(ctx, params.commentPrompt ?? 'Required change request');
    if (required.status !== 'answered') return continuationTerminal(params, present, required.status);
    comment = required.value;
  } else if (typeof ctx.ui.input === 'function') {
    comment = normalizeOptionalText(await ctx.ui.input('Optional comment'));
  }
  const details = continuationReviewDetails({ present, exchangeId: params.exchangeId, review, comment });
  return { content: [{ type: 'text', text: formatRequestReview(details) }], details };
}

function continuationReviewDetails(input: {
  readonly present: Extract<PresentDetails, { readonly review_set: unknown } | { readonly digest: unknown }>;
  readonly exchangeId: string;
  readonly review: ReviewDecision;
  readonly comment: string | undefined;
}) {
  if ('digest' in input.present) {
    if (input.review === 'approve') {
      return projectRequestReview({
        exchangeId: input.exchangeId,
        respondsToPresentTool: 'present_digest',
        status: 'answered',
        review: input.review,
        acceptedAbstract: input.present.digest.abstract,
        ...(input.comment ? { comment: input.comment } : {}),
      });
    }
    if (input.review === 'request_changes') {
      return projectRequestReview({
        exchangeId: input.exchangeId,
        respondsToPresentTool: 'present_digest',
        status: 'answered',
        review: input.review,
        comment: input.comment ?? '',
      });
    }
    return projectRequestReview({
      exchangeId: input.exchangeId,
      respondsToPresentTool: 'present_digest',
      status: 'answered',
      review: input.review,
      ...(input.comment ? { comment: input.comment } : {}),
    });
  }
  if (input.review === 'request_changes') {
    return projectRequestReview({
      exchangeId: input.exchangeId,
      respondsToPresentTool: 'present_review_set',
      status: 'answered',
      review: input.review,
      comment: input.comment ?? '',
    });
  }
  return projectRequestReview({
    exchangeId: input.exchangeId,
    respondsToPresentTool: 'present_review_set',
    status: 'answered',
    review: input.review,
    ...(input.comment ? { comment: input.comment } : {}),
  });
}

const REVIEW_CHOICES: readonly { readonly id: ReviewDecision; readonly label: string }[] = [
  { id: 'approve', label: 'Approve' },
  { id: 'request_changes', label: 'Request changes' },
  { id: 'reject', label: 'Reject' },
];

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
      'For offer continuations, call ask with continues only; the runtime fills body/options from the present_* declaration.',
    ],
    parameters: piSchema(zAskParams),
    executionMode: 'sequential',

    async execute(_toolCallId, rawParams, _signal, _onUpdate, ctx) {
      const params = zAskParams.parse(rawParams) satisfies AskParams;
      const uiCtx = ctx as unknown as StructuredExchangeUiContext;
      if (params.continues)
        return collectContinuingAsk(params as AskParams & { readonly continues: string }, uiCtx);
      const standalone = params as StandaloneAskParams;
      const question = askQuestionEcho(standalone);
      if (!standalone.options) return collectFreeText(standalone, question, uiCtx, answerBroker);
      if (standalone.multiple) return collectMultiChoice(standalone, question, uiCtx);
      return collectSingleChoice(standalone, question, uiCtx);
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
