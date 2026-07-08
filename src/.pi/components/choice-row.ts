import type { LabTheme } from './tui-lab/index.js';

export interface DescribedChoice {
  readonly description?: string;
}

export function describedChoiceLines(input: {
  readonly firstLine: string;
  readonly continuationIndent: number;
  readonly choice: DescribedChoice;
  readonly theme: LabTheme;
}): readonly string[] {
  const description = input.choice.description?.trim();
  if (!description) return [input.firstLine];
  return [input.firstLine, input.theme.fg('dim', `${' '.repeat(input.continuationIndent)}${description}`)];
}
