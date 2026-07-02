import type { Component } from '@earendil-works/pi-tui';

import { projectRoundedBox } from '../../components/rounded-box.js';
import type { PresentQuestionDetails } from './schemas/index.js';
import type { RenderElision, RenderRepresentations } from './shared/render-honesty.js';

interface ThemeLike {
  fg?: (color: never, text: string) => string;
}

export const PRESENT_QUESTION_RENDER_ELISIONS: readonly RenderElision[] = [
  { path: 'schema', reason: 'structural details schema tag' },
  { path: 'v', reason: 'structural details schema version' },
  { path: 'exchange_id', reason: 'structural exchange correlation id' },
  { path: 'tool_meta.curr', reason: 'structural tool-chain marker' },
  { path: 'tool_meta.next', reason: 'structural tool-chain marker' },
  { path: 'response_kind', reason: 'represented by the rendered answer affordance' },
  { path: 'options.*.id', reason: 'stable answer ids are represented by visible option numbering' },
];

export const PRESENT_QUESTION_RENDER_REPRESENTATIONS: RenderRepresentations = {
  response_kind: ['Answer freely', 'Choose one', 'Choose one or more'],
  allow_other: ['Other'],
  allow_none: ['None'],
};

export function renderPresentQuestionResult(details: PresentQuestionDetails, theme?: ThemeLike): Component {
  return {
    render: (width) => projectPresentQuestionResultLines(details, width, borderColor(theme)),
    invalidate: () => {},
  };
}

export function projectPresentQuestionResultLines(
  details: PresentQuestionDetails,
  width: number,
  colorBorder: (text: string) => string,
): string[] {
  return projectRoundedBox(
    presentQuestionContentLines(details),
    { topLabel: 'present_question' },
    width,
    colorBorder,
  );
}

function presentQuestionContentLines(details: PresentQuestionDetails): string[] {
  const lines = [details.display.heading.trim()];
  const preface = details.display.preface?.trim();
  const body = details.display.body?.trim();
  if (preface) lines.push(preface);
  if (body) lines.push(body);

  if (details.response_kind === 'answer') {
    lines.push('', 'Answer freely.');
    return lines;
  }

  lines.push('', details.response_kind === 'choices' ? 'Choose one or more:' : 'Choose one:');
  details.options.forEach((option, index) => {
    lines.push(`${index + 1}. ${option.content.trim()}`);
    const rationale = option.rationale?.trim();
    if (rationale) lines.push(`   why: ${rationale}`);
  });

  if (details.allow_other) lines.push('Other: write a different answer.');
  if (details.allow_none) lines.push('None: none of these fit.');
  const commentPrompt = details.comment_prompt?.trim();
  if (commentPrompt) lines.push(`Comment: ${commentPrompt}`);

  return lines;
}

function borderColor(theme: ThemeLike | undefined): (text: string) => string {
  return (text) => (theme?.fg ? theme.fg('mdHr' as never, text) : text);
}
