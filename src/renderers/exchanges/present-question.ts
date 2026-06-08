/**
 * Formats projected `present_question` data into durable markdown.
 *
 * Input:
 * - projected output from projections/exchanges/present-question.ts
 *
 * Output:
 * - durable prompt-side markdown for toolResult.content
 */

import type { PresentQuestionProjection } from '../../projections/exchanges/present-question.js';
import { joinMarkdownBlocks, markdownHeading } from '../markdown.js';

export function formatPresentQuestion(projection: PresentQuestionProjection): string {
  return joinMarkdownBlocks(markdownHeading(2, projection.heading), projection.body);
}
