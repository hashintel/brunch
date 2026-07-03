import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { projectRequestAnswer } from '../../exchanges/projections/request-response.js';

describe('exchange capture contract proof', () => {
  it('treats answered free-text requests as answer-only capture material', async () => {
    const temptingOfferText =
      'Maybe Brunch should silently create a CAPTURE_OK receipt and persist every offered option.';
    const answerText = 'Keep capture as elicitor conduct; do not add a capture receipt.';

    const parsed = projectRequestAnswer({
      exchangeId: 'cc-01-answer-only',
      status: 'answered',
      answer: answerText,
    });

    expect('answered' in parsed).toBe(true);
    if (!('answered' in parsed)) throw new Error('expected answered request details');
    expect(parsed.answered.text).toBe(answerText);
    expect(JSON.stringify(parsed)).not.toContain(temptingOfferText);

    const ingestGuidance = await readFile(join(process.cwd(), 'src/agents/skills/ingest/SKILL.md'), 'utf8');
    expect(ingestGuidance).toContain('Answered free-text requests route only `answered.text`');
    expect(ingestGuidance).toContain(
      'The surrounding prompt or offer text is render context, not capture payload',
    );
  });
});
