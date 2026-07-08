export function normalizeOptionalText(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

export function normalizeOptionalUnknownText(value: unknown): string | undefined {
  return typeof value === 'string' ? normalizeOptionalText(value) : undefined;
}
