import { isAbsolute, normalize, relative, resolve, sep } from 'node:path';

export function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function nonempty(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

export function safeId(value: unknown): value is string {
  return typeof value === 'string' && /^[a-z0-9][a-z0-9-]*$/u.test(value);
}

export function sha256(value: unknown): value is string {
  return typeof value === 'string' && /^sha256:[a-f0-9]{64}$/u.test(value);
}

export function timestamp(value: unknown): value is string {
  return typeof value === 'string' && Number.isFinite(Date.parse(value));
}

export function positiveInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0;
}

export function nonnegativeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

export function safeRelativePath(value: unknown): value is string {
  if (!nonempty(value) || isAbsolute(value)) return false;
  const normalized = normalize(value);
  return normalized !== '..' && !normalized.startsWith(`..${sep}`);
}

export function containedPath(root: string, selected: string): boolean {
  const selectedRelative = relative(resolve(root), resolve(selected));
  return (
    selectedRelative === '' ||
    (selectedRelative !== '..' && !selectedRelative.startsWith(`..${sep}`) && !isAbsolute(selectedRelative))
  );
}

export function exactSet<T extends string>(value: unknown, expected: readonly T[]): value is readonly T[] {
  return (
    Array.isArray(value) &&
    value.length === expected.length &&
    new Set(value).size === expected.length &&
    value.every((item) => expected.includes(item as T))
  );
}
