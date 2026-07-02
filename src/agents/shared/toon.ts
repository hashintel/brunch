/**
 * Shared TOON formatting substrate for Brunch LLM-facing structured context data.
 *
 * Owns:
 * - thin wrapper helpers around @toon-format/toon
 * - shared encode options and fenced `toon` block conventions
 * - no graph/session/exchange domain semantics
 */

import { encode, type JsonObject } from '@toon-format/toon';
import { codeBlock } from 'md-pen';

export type ToonRecord = JsonObject;

export function renderToonRecords(records: ToonRecord[]): string {
  return encode(records);
}

export function renderToonBlock(records: ToonRecord[]): string {
  return codeBlock(renderToonRecords(records), 'toon');
}
