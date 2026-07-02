import { describe, expect, it } from 'vitest';

import {
  presentQuestionFreeTextFixture,
  presentQuestionOptionsFixture,
} from '../../../../dev/component-preview/exchange-fixtures.js';
import { formatPresentQuestion, PRESENT_QUESTION_CONTENT_ELISIONS } from '../present-question.js';
import { missingRenderedDetailsLeaves } from '../render-honesty.js';

describe('present_question content render-honesty', () => {
  it('declares every details leaf as rendered or intentionally elided (options form)', () => {
    const content = formatPresentQuestion(presentQuestionOptionsFixture.projection);

    expect(
      missingRenderedDetailsLeaves(presentQuestionOptionsFixture.result.details, content, {
        elisions: PRESENT_QUESTION_CONTENT_ELISIONS,
      }),
    ).toEqual([]);
  });

  it('declares every details leaf as rendered or intentionally elided (free-text form)', () => {
    const content = formatPresentQuestion(presentQuestionFreeTextFixture.projection);

    expect(
      missingRenderedDetailsLeaves(presentQuestionFreeTextFixture.result.details, content, {
        elisions: PRESENT_QUESTION_CONTENT_ELISIONS,
      }),
    ).toEqual([]);
  });
});
