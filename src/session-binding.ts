import type { CustomEntry } from '@earendil-works/pi-coding-agent';

export const SESSION_BINDING_TYPE = 'brunch.session_binding';
export const SESSION_BINDING_SCHEMA_VERSION = 1;

export interface SessionBindingData {
  schemaVersion: typeof SESSION_BINDING_SCHEMA_VERSION;
  specId: number;
}

export type SessionBindingEntry = CustomEntry<SessionBindingData> & {
  customType: typeof SESSION_BINDING_TYPE;
  data: SessionBindingData;
};

export function createSessionBindingData(options: { specId: number }): SessionBindingData {
  return {
    schemaVersion: SESSION_BINDING_SCHEMA_VERSION,
    specId: options.specId,
  };
}

export function isSessionBindingEntry(value: unknown): value is SessionBindingEntry {
  if (
    typeof value !== 'object' ||
    value === null ||
    (value as { type?: unknown }).type !== 'custom' ||
    (value as { customType?: unknown }).customType !== SESSION_BINDING_TYPE
  ) {
    return false;
  }

  const data = (value as { data?: unknown }).data;
  return isSessionBindingData(data);
}

export function isSessionBindingData(value: unknown): value is SessionBindingData {
  return (
    typeof value === 'object' &&
    value !== null &&
    (value as { schemaVersion?: unknown }).schemaVersion === SESSION_BINDING_SCHEMA_VERSION &&
    typeof (value as { specId?: unknown }).specId === 'number' &&
    Number.isInteger((value as { specId: number }).specId)
  );
}
