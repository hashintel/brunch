import { blockquote, bold, heading, ol } from 'md-pen';

import type { PresentQuestionProjection } from '../../../exchanges/projections/present-question.js';
import { joinMarkdownBlocks } from '../../shared/markdown.js';
import type { RenderElision } from './render-honesty.js';

export function formatPresentQuestion(projection: PresentQuestionProjection): string {
  const question = joinMarkdownBlocks(
    heading(`Question: ${projection.heading.trim()}`, 2),
    projection.body ? blockquote(projection.body) : undefined,
  );

  if ('options' in projection.details) {
    const options = projection.details.options.map((option) => {
      const content = bold(option.content.trim());
      const rationale = option.rationale?.trim();
      return rationale ? `${content} — ${rationale}` : content;
    });
    return joinMarkdownBlocks(question, ol(options));
  }

  return question;
}

/**
 * Render-honesty elision list for the present_question content formatter: every
 * populated details leaf not listed here must appear in the formatted content.
 */
export const PRESENT_QUESTION_CONTENT_ELISIONS: readonly RenderElision[] = [
  { path: 'schema', reason: 'structural details schema tag' },
  { path: 'v', reason: 'structural details schema version' },
  { path: 'exchange_id', reason: 'structural exchange correlation id' },
  { path: 'tool_meta.curr', reason: 'structural tool-chain marker' },
  { path: 'tool_meta.next', reason: 'structural tool-chain marker' },
  { path: 'response_kind', reason: 'answering-surface concern; the response entry echoes the field' },
  { path: 'options.*.id', reason: 'stable answer ids are represented by visible option numbering' },
  { path: 'allow_other', reason: 'answering affordance — collection-UI concern, not transcript content' },
  { path: 'allow_none', reason: 'answering affordance — collection-UI concern, not transcript content' },
  { path: 'comment_prompt', reason: 'answering affordance — collection-UI concern, not transcript content' },
];
