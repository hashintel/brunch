import { Key, matchesKey, type Component } from '@earendil-works/pi-tui';

import type { QuestionnaireAnswer, QuestionnaireQuestion } from '../../exchanges/schemas/index.js';
import { renderExchangeMarkdownBodyLines } from './exchange-markdown-body.js';
import { projectRoundedBox, roundedBoxInnerWidth, stackSections } from './rounded-box.js';
import { safeLines, type LabTheme } from './tui-lab/index.js';

export interface ExchangeQuestionnaireOptions {
  readonly questions: readonly QuestionnaireQuestion[];
  readonly theme: LabTheme;
  readonly borderColor?: (text: string) => string;
  readonly onDone: (answers?: readonly QuestionnaireAnswer[]) => void;
}

export class ExchangeQuestionnaireComponent implements Component {
  #index = 0;
  #activeOption = 0;
  #text = '';
  readonly #answers = new Map<string, QuestionnaireAnswer>();
  readonly #multi = new Set<string>();

  constructor(private readonly options: ExchangeQuestionnaireOptions) {}

  render(width: number): string[] {
    const question = this.options.questions[this.#index]!;
    const safeWidth = Math.max(20, width);
    const contentWidth = Math.max(1, roundedBoxInnerWidth(safeWidth, { x: 2, top: 1, bottom: 1 }));
    const answerLines =
      question.kind === 'free-text'
        ? [this.#text || this.options.theme.fg('dim', 'Type an answer…')]
        : question.options.map((option, index) => {
            const active = index === this.#activeOption ? '›' : ' ';
            const checked =
              question.kind === 'multi-select'
                ? this.#multi.has(option.id)
                  ? '[x]'
                  : '[ ]'
                : `${index + 1}.`;
            return `${active} ${checked} ${option.label}`;
          });
    const final = this.#index === this.options.questions.length - 1;
    const controls =
      this.#index === 0
        ? `${final ? 'Submit' : 'Next'} · Esc cancel`
        : `Back (←) · ${final ? 'Submit' : 'Next'} (Enter) · Esc cancel`;
    const stacked = stackSections([
      [this.options.theme.fg('accent', `Question ${this.#index + 1} of ${this.options.questions.length}`)],
      renderExchangeMarkdownBodyLines(question.prompt, this.options.theme, contentWidth),
      answerLines,
      [this.options.theme.fg('dim', controls)],
    ]);
    const borderColor = this.options.borderColor ?? ((text: string) => this.options.theme.fg('accent', text));
    const box = projectRoundedBox(
      safeLines(stacked.lines, contentWidth),
      { padding: { x: 2, top: 1, bottom: 1 } },
      safeWidth,
      borderColor,
    );
    box.push('');
    return box;
  }

  handleInput(data: string): void {
    if (matchesKey(data, Key.escape) || matchesKey(data, Key.ctrl('c'))) return this.options.onDone();
    if (matchesKey(data, Key.left) && this.#index > 0) {
      this.#index -= 1;
      this.#loadAnswer();
      return;
    }
    const question = this.options.questions[this.#index]!;
    if (question.kind !== 'free-text') {
      if (matchesKey(data, Key.down)) this.#activeOption = (this.#activeOption + 1) % question.options.length;
      else if (matchesKey(data, Key.up))
        this.#activeOption = (this.#activeOption - 1 + question.options.length) % question.options.length;
      else if (question.kind === 'multi-select' && data === ' ') {
        const id = question.options[this.#activeOption]!.id;
        if (this.#multi.has(id)) this.#multi.delete(id);
        else this.#multi.add(id);
      } else if (matchesKey(data, Key.enter)) this.#advance(question);
      return;
    }
    if (matchesKey(data, Key.enter)) this.#advance(question);
    else if (matchesKey(data, Key.backspace)) this.#text = this.#text.slice(0, -1);
    else if (!data.startsWith('\x1b') && data >= ' ') this.#text += data;
  }

  invalidate(): void {}

  #advance(question: QuestionnaireQuestion): void {
    let answer: QuestionnaireAnswer | undefined;
    if (question.kind === 'free-text' && this.#text.trim())
      answer = { questionId: question.id, kind: 'free-text', text: this.#text.trim() };
    if (question.kind === 'single-select')
      answer = {
        questionId: question.id,
        kind: 'single-select',
        optionId: question.options[this.#activeOption]!.id,
      };
    if (question.kind === 'multi-select' && this.#multi.size)
      answer = {
        questionId: question.id,
        kind: 'multi-select',
        optionIds: question.options.filter((option) => this.#multi.has(option.id)).map((option) => option.id),
      };
    if (!answer) return;
    this.#answers.set(question.id, answer);
    if (this.#index === this.options.questions.length - 1) {
      this.options.onDone(this.options.questions.map((item) => this.#answers.get(item.id)!));
      return;
    }
    this.#index += 1;
    this.#loadAnswer();
  }

  #loadAnswer(): void {
    const question = this.options.questions[this.#index]!;
    const answer = this.#answers.get(question.id);
    this.#activeOption = 0;
    this.#text = answer?.kind === 'free-text' ? answer.text : '';
    this.#multi.clear();
    if (answer?.kind === 'single-select')
      this.#activeOption =
        question.kind === 'single-select'
          ? Math.max(
              0,
              question.options.findIndex((option) => option.id === answer.optionId),
            )
          : 0;
    if (answer?.kind === 'multi-select') answer.optionIds.forEach((id) => this.#multi.add(id));
  }
}
