import { formatRequestChoice } from '../../../../agents/contexts/exchanges/request-response.js';
import { projectRequestChoice } from '../../../../exchanges/projections/request-response.js';
import {
  structuredExchangeResponseRequiresComment,
  type AnsweredOptionEcho,
  type SelectedChoice,
} from '../../../../exchanges/schemas/index.js';
import { createExchangeDecisionPickerComponent } from '../../../components/exchange-decision-picker.js';
import { normalizeOptionalText } from './markdown.js';
import { collectRequiredInput } from './required-input.js';
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
    return {
      content: [{ type: 'text' as const, text: formatRequestChoice(details) }],
      details,
      // A user cancel means "leave me inert": end the turn on this tool
      // result. Unavailable stays reactive so the model can reroute.
      ...(status === 'cancelled' ? { terminate: true } : {}),
    };
  };

  if (!params.ctx.hasUI || typeof params.ctx.ui?.custom !== 'function') {
    return terminal('unavailable', 'request_response choice requires interactive UI');
  }

  const choices = selectableChoices(params.choices);
  const pickerChoices = [
    ...choices.map(({ choice, selectLabel }) => ({ id: choice.id, label: selectLabel })),
    ...(params.allowOther ? [{ id: 'other', label: 'Other' }] : []),
  ];
  const selected = await params.ctx.ui.custom<{ readonly id: string } | undefined>(
    (_tui, theme, _keybindings, done) =>
      createExchangeDecisionPickerComponent({
        prompt: params.prompt,
        choices: pickerChoices,
        theme,
        onDone: done,
      }),
  );
  if (selected === undefined) return terminal('cancelled');

  const picked = choiceBySelection(choices, selected.id);
  let choice: SelectedChoice;
  let comment = '';
  if (!picked) {
    if (!params.allowOther || selected.id !== 'other') {
      return terminal('unavailable', `request_response choice received unknown option id ${selected.id}`);
    }
    const other = await collectRequiredInput(params.ctx, 'Other', 'Describe your answer');
    if (other === undefined) return terminal('cancelled');
    choice = { id: 'other', label: other, kind: 'other' };
    if (structuredExchangeResponseRequiresComment({ choiceKinds: [choice.kind] })) {
      const required = await collectRequiredInput(params.ctx, params.commentPrompt ?? 'Required comment');
      if (required === undefined) return terminal('cancelled');
      comment = required;
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
