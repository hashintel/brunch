export { formatRequestAnswer, REQUEST_ANSWER_CONTENT_ELISIONS } from './request-response/answer.js';
export { formatRequestChoice, REQUEST_CHOICE_CONTENT_ELISIONS } from './request-response/choice.js';
export { formatRequestChoices, REQUEST_CHOICES_CONTENT_ELISIONS } from './request-response/choices.js';
export { formatRequestReview, REQUEST_REVIEW_CONTENT_ELISIONS } from './request-response/review.js';

export interface RequestResponseDiagnosticTextInput {
  readonly message: string;
}

export function formatRequestResponseDiagnostic(input: RequestResponseDiagnosticTextInput): string {
  return `## Response\n\n_${input.message}_`;
}
