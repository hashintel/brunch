export const BRUNCH_ELICITATION_STYLE_CUSTOM_TYPE = 'brunch.elicitation_style';

export const ELICITATION_STYLES = ['interrogate', 'disambiguate', 'propose'] as const;
export type ElicitationStyle = (typeof ELICITATION_STYLES)[number];

export interface ElicitationStyleEntryData {
  readonly schemaVersion: 1;
  readonly style: ElicitationStyle;
}

interface CustomEntryLike {
  readonly type?: unknown;
  readonly customType?: unknown;
  readonly data?: unknown;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function parseElicitationStyleEntryData(value: unknown): ElicitationStyleEntryData | undefined {
  if (!isRecord(value) || value.schemaVersion !== 1) return undefined;
  if (typeof value.style !== 'string' || !(ELICITATION_STYLES as readonly string[]).includes(value.style)) {
    return undefined;
  }
  return { schemaVersion: 1, style: value.style as ElicitationStyle };
}

export function latestElicitationStyle(entries: readonly CustomEntryLike[]): ElicitationStyle | undefined {
  for (let index = entries.length - 1; index >= 0; index--) {
    const entry = entries[index]!;
    if (entry.type !== 'custom' || entry.customType !== BRUNCH_ELICITATION_STYLE_CUSTOM_TYPE) continue;
    const parsed = parseElicitationStyleEntryData(entry.data);
    if (parsed) return parsed.style;
  }
  return undefined;
}

export interface ElicitationStyleEntryManager {
  appendCustomEntry(customType: string, data: ElicitationStyleEntryData): void;
}

export function appendElicitationStyleEntry(
  manager: ElicitationStyleEntryManager,
  style: ElicitationStyle,
): void {
  manager.appendCustomEntry(BRUNCH_ELICITATION_STYLE_CUSTOM_TYPE, { schemaVersion: 1, style });
}
