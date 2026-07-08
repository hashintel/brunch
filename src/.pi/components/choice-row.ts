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

export function accumulateChoiceLines<T>(input: {
  readonly choices: readonly T[];
  readonly activeIndex: number;
  readonly renderChoice: (choice: T, index: number) => readonly string[];
}): { readonly choiceLines: readonly string[]; readonly activeLineIndex: number } {
  const choiceLines: string[] = [];
  let activeLineIndex = 0;
  input.choices.forEach((choice, index) => {
    if (index === input.activeIndex) activeLineIndex = choiceLines.length;
    choiceLines.push(...input.renderChoice(choice, index));
  });
  return { choiceLines, activeLineIndex };
}
