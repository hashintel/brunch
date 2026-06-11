import { describe, expect, it } from 'vitest';

import { projectRequestChoices } from '../../projections/exchanges/request-choices.js';
import {
  buildRequestChoicesEditorPrefill,
  parseRequestChoicesEditorResponse,
} from '../extensions/exchanges/request-choices.js';
import { zRequestChoicesEditorEnvelope } from '../extensions/exchanges/schemas/index.js';

describe('request_choices editor envelope', () => {
  it('round-trips prefill, edited response, parse, and projection through the one schema', () => {
    const prefill = buildRequestChoicesEditorPrefill({
      prompt: 'Select all priorities.',
      choices: [
        { id: 'speed', label: 'Move quickly' },
        { id: 'safety', label: 'Keep the transcript safe' },
      ],
      allowOther: true,
      commentPrompt: 'Optional comment',
    });

    const envelope = zRequestChoicesEditorEnvelope.parse(JSON.parse(prefill));
    expect(envelope).toMatchObject({
      schema: 'brunch.structured_exchange.request_choices.editor',
      schemaVersion: 1,
      mode: 'multi-choice',
      choices: [
        { id: 'speed', label: 'Move quickly' },
        { id: 'safety', label: 'Keep the transcript safe' },
        { id: 'other', label: 'Other' },
      ],
      response: { status: 'cancelled', choices: [], comment: '' },
    });

    const edited = JSON.stringify({
      ...envelope,
      response: {
        status: 'answered',
        choices: [{ id: 'speed' }, { id: 'other', label: 'Other' }],
        comment: 'Also keep the proof deterministic.',
      },
    });

    const response = parseRequestChoicesEditorResponse(edited);
    if (response?.status !== 'answered') throw new Error('expected an answered editor response');

    const offeredLabels = new Map(envelope.choices.map((choice) => [choice.id, choice.label]));
    const details = projectRequestChoices({
      exchangeId: 'priorities',
      status: 'answered',
      choices: response.choices.map((choice) => ({
        id: choice.id,
        label: choice.label ?? offeredLabels.get(choice.id) ?? choice.id,
        kind: choice.id === 'other' ? ('other' as const) : ('listed' as const),
      })),
      comment: response.comment,
    });

    expect(details).toMatchObject({
      schema: 'brunch.structured_exchange.request',
      v: 1,
      exchange_id: 'priorities',
      tool_meta: { prev: 'present_options', curr: 'request_choices', next: 'capture_choices' },
      answered: {
        choices: [
          { id: 'speed', label: 'Move quickly', kind: 'listed' },
          { id: 'other', label: 'Other', kind: 'other' },
        ],
        comment: 'Also keep the proof deterministic.',
      },
    });
  });
});
