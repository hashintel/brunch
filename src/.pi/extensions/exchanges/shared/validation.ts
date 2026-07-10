import type * as z from 'zod';

interface ToolTextContent {
  readonly type: 'text';
  readonly text: string;
}

export interface ExchangeValidationFailureDetails {
  readonly status: 'validation_failed';
  readonly tool: string;
  readonly diagnostics: readonly { readonly field: string; readonly message: string }[];
}

export interface ExchangeValidationFailureResult {
  readonly content: ToolTextContent[];
  readonly details: ExchangeValidationFailureDetails;
}

export function formatExchangeValidationFailure(details: ExchangeValidationFailureDetails): string {
  return [
    '# TOOL_INPUT_INVALID',
    '',
    `The ${details.tool} tool could not use the supplied arguments. Fix the fields below and retry.`,
    '',
    ...details.diagnostics.map((diagnostic) => `- ${diagnostic.field}: ${diagnostic.message}`),
  ].join('\n');
}

export function validationFailureResult(tool: string, error: z.ZodError): ExchangeValidationFailureResult {
  const diagnostics = error.issues.slice(0, 8).map((issue) => ({
    field: issue.path.length > 0 ? issue.path.join('.') : '(root)',
    message: issue.message,
  }));
  const details: ExchangeValidationFailureDetails = {
    status: 'validation_failed',
    tool,
    diagnostics:
      diagnostics.length > 0
        ? diagnostics
        : [{ field: '(root)', message: 'Arguments did not match the tool schema.' }],
  };
  return {
    content: [{ type: 'text', text: formatExchangeValidationFailure(details) }],
    details,
  };
}
