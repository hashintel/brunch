export function normalizeToolSchema(value: unknown, parentKey?: string): unknown {
  if (Array.isArray(value)) {
    if (parentKey === 'required' && value.every((item): item is string => typeof item === 'string')) {
      return [...value].sort((left, right) => left.localeCompare(right));
    }
    return value.map((item) => normalizeToolSchema(item));
  }
  if (typeof value !== 'object' || value === null) return value;

  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => key !== '$schema')
      .map(([key, nested]) => [key, normalizeToolSchema(nested, key)]),
  );
}
