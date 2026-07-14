import * as z from 'zod';

import { zNonBlankMarkdown } from './shared.js';

const zQuestionId = z
  .string()
  .trim()
  .min(1)
  .regex(/^[A-Za-z0-9_-]+$/);
const zQuestionOption = z.object({ id: zQuestionId, label: zNonBlankMarkdown }).strict();

export const zQuestionnaireQuestion = z.discriminatedUnion('kind', [
  z.object({ id: zQuestionId, kind: z.literal('free-text'), prompt: zNonBlankMarkdown }).strict(),
  z
    .object({
      id: zQuestionId,
      kind: z.literal('single-select'),
      prompt: zNonBlankMarkdown,
      options: z.array(zQuestionOption).min(1),
    })
    .strict(),
  z
    .object({
      id: zQuestionId,
      kind: z.literal('multi-select'),
      prompt: zNonBlankMarkdown,
      options: z.array(zQuestionOption).min(1),
    })
    .strict(),
]);
export type QuestionnaireQuestion = z.infer<typeof zQuestionnaireQuestion>;

export const zQuestionnaireQuestions = z
  .array(zQuestionnaireQuestion)
  .min(1)
  .superRefine((questions, ctx) => {
    const ids = new Set<string>();
    questions.forEach((question, index) => {
      if (ids.has(question.id))
        ctx.addIssue({ code: 'custom', path: [index, 'id'], message: 'duplicate question id' });
      ids.add(question.id);
      if ('options' in question) {
        const optionIds = new Set<string>();
        question.options.forEach((option, optionIndex) => {
          if (optionIds.has(option.id))
            ctx.addIssue({
              code: 'custom',
              path: [index, 'options', optionIndex, 'id'],
              message: 'duplicate option id',
            });
          optionIds.add(option.id);
        });
      }
    });
  });

export const zQuestionnaireAnswer = z.discriminatedUnion('kind', [
  z.object({ questionId: zQuestionId, kind: z.literal('free-text'), text: zNonBlankMarkdown }).strict(),
  z.object({ questionId: zQuestionId, kind: z.literal('single-select'), optionId: zQuestionId }).strict(),
  z
    .object({
      questionId: zQuestionId,
      kind: z.literal('multi-select'),
      optionIds: z.array(zQuestionId).min(1),
    })
    .strict(),
]);
export type QuestionnaireAnswer = z.infer<typeof zQuestionnaireAnswer>;

export function zQuestionnaireAnswersFor(questions: readonly QuestionnaireQuestion[]) {
  return z.array(zQuestionnaireAnswer).superRefine((answers, ctx) => {
    const byId = new Map(questions.map((question) => [question.id, question]));
    const seen = new Set<string>();
    answers.forEach((answer, index) => {
      const question = byId.get(answer.questionId);
      if (!question) {
        ctx.addIssue({ code: 'custom', path: [index, 'questionId'], message: 'unknown question id' });
        return;
      }
      if (seen.has(answer.questionId))
        ctx.addIssue({ code: 'custom', path: [index, 'questionId'], message: 'duplicate answer id' });
      seen.add(answer.questionId);
      if (answer.kind !== question.kind) {
        ctx.addIssue({
          code: 'custom',
          path: [index, 'kind'],
          message: 'answer kind does not match question',
        });
        return;
      }
      if ('options' in question) {
        const allowed = new Set(question.options.map((option) => option.id));
        const selected =
          answer.kind === 'single-select'
            ? [answer.optionId]
            : answer.kind === 'multi-select'
              ? answer.optionIds
              : [];
        if (selected.some((id) => !allowed.has(id)))
          ctx.addIssue({ code: 'custom', path: [index], message: 'invalid questionnaire option' });
        if (new Set(selected).size !== selected.length)
          ctx.addIssue({ code: 'custom', path: [index], message: 'duplicate selected option' });
      }
    });
    questions.forEach((question) => {
      if (!seen.has(question.id))
        ctx.addIssue({ code: 'custom', path: [], message: `missing required answer: ${question.id}` });
    });
  });
}

export const QUESTIONNAIRE_SUBMISSION_SCHEMA = 'brunch.ask.questionnaire-answer' as const;

export function zQuestionnaireSubmissionFor(questions: readonly QuestionnaireQuestion[]) {
  return z
    .object({
      schema: z.literal(QUESTIONNAIRE_SUBMISSION_SCHEMA),
      answers: zQuestionnaireAnswersFor(questions),
    })
    .strict();
}
