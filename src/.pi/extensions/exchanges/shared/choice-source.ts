import { formatRequestChoice } from '../../../../agents/contexts/exchanges/request-choice.js';
import { projectRequestChoice } from '../../../../projections/exchanges/request-choice.js';
import {
  structuredExchangeResponseRequiresComment,
  type AnsweredOptionEcho,
  type SelectedChoice,
} from '../schemas/index.js';
import { normalizeOptionalText } from './markdown.js';
import type { StructuredExchangeUiContext } from './ui-context.js';

export interface StructuredExchangeChoice {
  readonly id: string;
  readonly label: string;
}

interface SelectableChoice {
  readonly choice: StructuredExchangeChoice;
  readonly selectLabel: string;
}

function selectableChoices(choices: readonly StructuredExchangeChoice[]): readonly SelectableChoice[] {
  const labelCounts = new Map<string, number>();
  for (const choice of choices) labelCounts.set(choice.label, (labelCounts.get(choice.label) ?? 0) + 1);
  return choices.map((choice, index) => ({
    choice,
    selectLabel: labelCounts.get(choice.label) === 1 ? choice.label : `${index + 1}. ${choice.label}`,
  }));
}

function choiceBySelection(
  choices: readonly SelectableChoice[],
  selected: string,
): StructuredExchangeChoice | undefined {
  return choices.find(
    ({ choice, selectLabel }) =>
      selectLabel === selected || choice.label === selected || choice.id === selected,
  )?.choice;
}

function selectedChoice(choice: StructuredExchangeChoice, kind: SelectedChoice['kind']): SelectedChoice {
  return { id: choice.id, label: choice.label, kind };
}

export interface CollectChoiceParams {
  readonly exchangeId: string;
  readonly prompt: string;
  readonly choices: readonly StructuredExchangeChoice[];
  readonly options: readonly AnsweredOptionEcho[];
  readonly respondsToPresentTool?: 'present_question' | 'present_candidates';
  readonly allowOther?: boolean;
  readonly commentPrompt?: string;
  readonly ctx: StructuredExchangeUiContext;
}

export async function collectChoiceFromUi(params: CollectChoiceParams) {
  const respondsToPresentTool = params.respondsToPresentTool ?? 'present_question';
  const terminal = (status: 'cancelled' | 'unavailable', message?: string) => {
    const details = projectRequestChoice({
      exchangeId: params.exchangeId,
      respondsToPresentTool,
      status,
      message,
    });
    return { content: [{ type: 'text' as const, text: formatRequestChoice(details) }], details };
  };

  if (!params.ctx.hasUI || typeof params.ctx.ui?.select !== 'function') {
    return terminal('unavailable', 'request_response choice requires interactive UI');
  }

  const choices = selectableChoices(params.choices);
  const labels = [...choices.map((choice) => choice.selectLabel), ...(params.allowOther ? ['Other'] : [])];
  const selected = await params.ctx.ui.select(params.prompt, labels);
  if (selected === undefined) return terminal('cancelled');

  const picked = choiceBySelection(choices, selected);
  let choice: SelectedChoice;
  let comment = '';
  if (!picked) {
    const other =
      typeof params.ctx.ui.input === 'function'
        ? await params.ctx.ui.input('Other', 'Describe your answer')
        : undefined;
    if (other === undefined || other.trim().length === 0) return terminal('cancelled');
    choice = { id: 'other', label: other.trim(), kind: 'other' };
    if (structuredExchangeResponseRequiresComment({ choiceKinds: [choice.kind] })) {
      comment = (await params.ctx.ui.input?.(params.commentPrompt ?? 'Required comment')) ?? '';
      if (comment.trim().length === 0) {
        return terminal('unavailable', 'request_choice requires a comment for Other or None selections');
      }
    }
  } else {
    choice = selectedChoice(picked, 'listed');
    if (typeof params.ctx.ui.input === 'function') {
      comment = (await params.ctx.ui.input(params.commentPrompt ?? 'Optional comment')) ?? '';
    }
  }

  const details = projectRequestChoice({
    exchangeId: params.exchangeId,
    respondsToPresentTool,
    status: 'answered',
    choice,
    options: params.options,
    comment: normalizeOptionalText(comment),
  });
  return { content: [{ type: 'text' as const, text: formatRequestChoice(details) }], details };
}
