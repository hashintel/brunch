import { bold, strikethrough, taskList } from 'md-pen';

import { joinMarkdownBlocks } from '../../shared/markdown.js';

export interface OptionEchoWriteIn {
  readonly kind: 'other' | 'none';
  readonly label: string;
}

/**
 * Shared answer-echo block for option-driven responses: the full offered option
 * field re-renders as a task list (original numbering embedded, rejected options
 * struck), with write-in choices appended as checked `*Other:*` / `*None:*` items.
 */
export function formatOptionEcho(params: {
  readonly selectedIds: ReadonlySet<string>;
  readonly options: readonly { readonly id: string; readonly content: string }[];
  readonly writeIns: readonly OptionEchoWriteIn[];
}): string {
  return taskList([
    ...params.options.map((option, index): [boolean, string] => {
      const selected = params.selectedIds.has(option.id);
      const label = `${index + 1}. ${bold(option.content.trim())}`;
      return [selected, selected ? label : strikethrough(label)];
    }),
    ...params.writeIns.map((writeIn): [boolean, string] => {
      const prefix = writeIn.kind === 'none' ? '*None:*' : '*Other:*';
      return [true, `${prefix} ${writeIn.label.trim()}`];
    }),
  ]);
}

/** Labeled cancellation shared across exchanges and read by both people and the agent. */
export function formatCancelledTerminal(message: string): string {
  return `**Cancelled** — ${message}`;
}

/** Unavailable-state response block shared by the request formatters. */
export function formatResponseTerminal(message: string, heading = 'Response'): string {
  return joinMarkdownBlocks(`## ${heading}`, `_${message}_`);
}
