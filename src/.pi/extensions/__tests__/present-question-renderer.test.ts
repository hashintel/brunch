import { describe, expect, it } from 'vitest';

import {
  presentQuestionFreeTextFixture,
  presentQuestionOptionsFixture,
} from '../../../dev/component-preview/exchange-fixtures.js';
import {
  PRESENT_QUESTION_RENDER_ELISIONS,
  PRESENT_QUESTION_RENDER_REPRESENTATIONS,
  projectPresentQuestionResultLines,
} from '../exchanges/present-question-renderer.js';
import { missingRenderedDetailsLeaves } from '../exchanges/shared/render-honesty.js';

const identityColor = (text: string) => text;

describe('present_question result renderer', () => {
  it('projects option details directly into transcript lines', () => {
    expect(
      projectPresentQuestionResultLines(presentQuestionOptionsFixture.result.details, 80, identityColor),
    ).toEqual([
      '╭─────────────────────────────────────────────────────────── present_question ─╮',
      '│ Which direction should the next slice take?                                  │',
      '│ Pick the answer that best matches the current product risk.                  │',
      '│                                                                              │',
      '│ Choose one or more:                                                          │',
      '│ 1. Thin vertical proof                                                       │',
      '│    why: Proves the seam before styling the neighborhood.                     │',
      '│ 2. Renderer sweep                                                            │',
      '│    why: Closes the family once the head slice lands.                         │',
      '│ Other: write a different answer.                                             │',
      '│ None: none of these fit.                                                     │',
      '│ Comment: Add any constraint the options miss.                                │',
      '╰──────────────────────────────────────────────────────────────────────────────╯',
    ]);
  });

  it('projects free-text details directly into transcript lines', () => {
    expect(
      projectPresentQuestionResultLines(presentQuestionFreeTextFixture.result.details, 72, identityColor),
    ).toEqual([
      '╭─────────────────────────────────────────────────── present_question ─╮',
      '│ What would make this useful?                                         │',
      '│ Answer in the vocabulary of the current Brunch session.              │',
      '│                                                                      │',
      '│ Answer freely.                                                       │',
      '╰──────────────────────────────────────────────────────────────────────╯',
    ]);
  });

  it('declares every details leaf as rendered, represented, or intentionally elided', () => {
    const rendered = projectPresentQuestionResultLines(
      presentQuestionOptionsFixture.result.details,
      100,
      identityColor,
    ).join('\n');

    expect(
      missingRenderedDetailsLeaves(presentQuestionOptionsFixture.result.details, rendered, {
        elisions: PRESENT_QUESTION_RENDER_ELISIONS,
        representations: PRESENT_QUESTION_RENDER_REPRESENTATIONS,
      }),
    ).toEqual([]);
  });

  it('renders only serializable details', () => {
    const live = projectPresentQuestionResultLines(
      presentQuestionOptionsFixture.result.details,
      80,
      identityColor,
    );
    const reconstructed = projectPresentQuestionResultLines(
      JSON.parse(JSON.stringify(presentQuestionOptionsFixture.result.details)),
      80,
      identityColor,
    );

    expect(reconstructed).toEqual(live);
  });
});
