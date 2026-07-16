import { describe, expect, it } from 'vitest';

import { formatAsk } from '../../../agents/contexts/exchanges/ask.js';
import { projectDigestQuestionnaire } from '../ask.js';

describe('digest questionnaire projection', () => {
  it('echoes each question and keyed answer while using the runtime-resolved abstract', () => {
    const details = projectDigestQuestionnaire({
      exchangeId: 'capture-1',
      acceptsDigest: 'digest-final',
      acceptedAbstract: 'Runtime-owned final abstract',
      questions: [{ id: 'goal', kind: 'free-text', prompt: 'What matters?' }],
      answers: [{ questionId: 'goal', kind: 'free-text', text: 'Clarity' }],
    });
    expect(details).toMatchObject({
      accepts_digest: 'digest-final',
      answered: { submitted: true, accepted_abstract: 'Runtime-owned final abstract' },
      questionnaire: [{ question: { id: 'goal' }, answer: { questionId: 'goal', text: 'Clarity' } }],
    });
    expect(details).not.toHaveProperty('acceptedAbstract');
    expect(details).not.toHaveProperty('accepted_abstract');
  });

  it('renders declared option labels while retaining stable ids in durable details', () => {
    const details = projectDigestQuestionnaire({
      exchangeId: 'capture-labels',
      acceptsDigest: 'digest-final',
      acceptedAbstract: 'Final abstract',
      questions: [
        {
          id: 'route',
          kind: 'single-select',
          prompt: 'Which route?',
          options: [{ id: 'safe', label: 'Safe' }],
        },
      ],
      answers: [{ questionId: 'route', kind: 'single-select', optionId: 'safe' }],
    });

    expect(details.questionnaire[0]?.answer).toMatchObject({ optionId: 'safe' });
    expect(formatAsk(details)).toContain('Safe');
    expect(formatAsk(details)).not.toMatch(/\nsafe(?:\n|$)/);
  });
});
