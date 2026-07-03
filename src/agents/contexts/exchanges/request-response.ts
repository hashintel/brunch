export { formatRequestAnswer } from './request-response/answer.js';
export { formatRequestChoice } from './request-response/choice.js';
export { formatRequestChoices } from './request-response/choices.js';
export { formatRequestReview } from './request-response/review.js';

export interface RequestResponseDiagnosticTextInput {
  readonly message: string;
}

export function formatRequestResponseDiagnostic(input: RequestResponseDiagnosticTextInput): string {
  return `## Response\n\n_${input.message}_`;
}
