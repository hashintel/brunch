import { projectRequestChoice } from '../../../../projections/exchanges/request-choice.js';
import { formatRequestChoice } from '../../../../renderers/exchanges/request-choice.js';
import type { SelectedChoice } from '../schemas/index.js';
import { normalizeOptionalText } from './markdown.js';
import type { StructuredExchangeUiContext } from './ui-context.js';

export interface StructuredExchangeChoice {
  readonly id: string;
  readonly label: string;
}

function choiceByLabel(
  choices: readonly StructuredExchangeChoice[],
  selected: string,
): StructuredExchangeChoice | undefined {
  return choices.find((choice) => choice.label === selected || choice.id === selected);
}

function selectedChoice(choice: StructuredExchangeChoice, kind: SelectedChoice['kind']): SelectedChoice {
  return { id: choice.id, label: choice.label, kind };
}

export interface CollectChoiceParams {
  readonly exchangeId: string;
  readonly prompt: string;
  readonly choices: readonly StructuredExchangeChoice[];
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

  const labels = [...params.choices.map((choice) => choice.label), ...(params.allowOther ? ['Other'] : [])];
  const selected = await params.ctx.ui.select(params.prompt, labels);
  if (selected === undefined) return terminal('cancelled');

  const picked = choiceByLabel(params.choices, selected);
  let choice: SelectedChoice;
  let comment = '';
  if (!picked) {
    const other =
      typeof params.ctx.ui.input === 'function'
        ? await params.ctx.ui.input('Other', 'Describe your answer')
        : undefined;
    if (other === undefined || other.trim().length === 0) return terminal('cancelled');
    choice = { id: 'other', label: other.trim(), kind: 'other' };
    comment = other.trim();
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
    comment: normalizeOptionalText(comment),
  });
  return { content: [{ type: 'text' as const, text: formatRequestChoice(details) }], details };
}
