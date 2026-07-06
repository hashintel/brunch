import { getSelectListTheme } from '@earendil-works/pi-coding-agent';
import type { EditorTheme } from '@earendil-works/pi-tui';

import { formatRequestAnswer } from '../../../../agents/contexts/exchanges/request-response.js';
import { projectRequestAnswer } from '../../../../exchanges/projections/request-response.js';
import type { LiveExchangeAwaiter } from '../../../../session/live-exchange-broker.js';
import { ExchangeAnswerEditorComponent } from '../../../components/exchange-answer-editor.js';
import { withWorkingIndicatorHidden, type StructuredExchangeUiContext } from './ui-context.js';

type CustomAnswerEditorResult =
  | { readonly status: 'answered'; readonly answer: string }
  | { readonly status: 'cancelled' };

export interface CollectAnswerParams {
  readonly ctx: StructuredExchangeUiContext;
  readonly answerBroker?: LiveExchangeAwaiter | undefined;
  readonly exchangeId: string;
  readonly prompt: string;
  readonly unavailableMessage: string;
}

export async function collectAnswerFromSources({
  ctx,
  answerBroker,
  exchangeId,
  prompt,
  unavailableMessage,
}: CollectAnswerParams) {
  let answer: string | undefined;
  if (ctx.hasUI && typeof ctx.ui?.custom === 'function') {
    const customResult = await withWorkingIndicatorHidden(ctx, () =>
      ctx.ui!.custom!<CustomAnswerEditorResult>((tui, theme, _keybindings, done) => {
        const editorTheme: EditorTheme = {
          borderColor: (text) => theme.fg('border', text),
          selectList: getSelectListTheme(),
        };
        return new ExchangeAnswerEditorComponent(tui, editorTheme, {
          prompt,
          theme,
          onDone: (result) =>
            done(result === undefined ? { status: 'cancelled' } : { status: 'answered', answer: result }),
        });
      }),
    );
    if (customResult?.status === 'answered') answer = customResult.answer;
    else if (customResult?.status === 'cancelled') answer = undefined;
    else if (typeof ctx.ui?.editor === 'function') {
      answer = await withWorkingIndicatorHidden(ctx, () => ctx.ui!.editor!(prompt));
    }
  } else if (ctx.hasUI && typeof ctx.ui?.editor === 'function') {
    answer = await withWorkingIndicatorHidden(ctx, () => ctx.ui!.editor!(prompt));
  } else if (answerBroker) {
    answer = await answerBroker.awaitAnswer({ exchangeId });
  } else {
    const details = projectRequestAnswer({ exchangeId, status: 'unavailable', message: unavailableMessage });
    return { content: [{ type: 'text' as const, text: formatRequestAnswer(details) }], details };
  }

  const details =
    answer === undefined
      ? projectRequestAnswer({ exchangeId, status: 'cancelled' })
      : projectRequestAnswer({ exchangeId, status: 'answered', answer });
  return {
    content: [{ type: 'text' as const, text: formatRequestAnswer(details) }],
    details,
    // A user cancel means "leave me inert": end the turn on this tool result
    // instead of letting the model spend a follow-up turn reacting to it.
    ...(answer === undefined ? { terminate: true } : {}),
  };
}
