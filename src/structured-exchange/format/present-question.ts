/**
 * Formats projected `present_question` data into durable markdown.
 *
 * Input:
 * - projected output from structured-exchange/project/present-question.ts
 *
 * Output:
 * - durable prompt-side markdown for toolResult.content
 */

import { joinMarkdownBlocks, markdownHeading } from '../../render/markdown.js';
import type { PresentQuestionProjection } from '../project/present-question.js';

export function formatPresentQuestion(projection: PresentQuestionProjection): string {
  return joinMarkdownBlocks(markdownHeading(2, projection.heading), projection.body);
}
