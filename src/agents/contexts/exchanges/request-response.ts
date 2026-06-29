export interface RequestResponseDiagnosticTextInput {
  readonly message: string;
}

export function formatRequestResponseDiagnostic(input: RequestResponseDiagnosticTextInput): string {
  return `# Response\n\n_${input.message}_`;
}
