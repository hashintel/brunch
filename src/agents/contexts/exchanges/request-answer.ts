import type { RequestAnswerDetails } from '../../../projections/exchanges/request-answer.js';
import { joinMarkdownBlocks, markdownHeading } from '../../shared/markdown.js';
import { formatResponseTerminal } from './option-echo.js';

export function formatRequestAnswer(details: RequestAnswerDetails): string {
  if ('cancelled' in details) return formatResponseTerminal('User cancelled the request.');
  if ('unavailable' in details) return formatResponseTerminal(details.unavailable.message);
  // The free-text answer is the user's own voice, not commentary on one — plain
  // text, never a blockquote (blockquote carries the "why" voice in this grammar).
  return joinMarkdownBlocks(markdownHeading(2, 'Answer'), details.answered.text);
}
