import {
  safeDecodePersistedAssistantParts,
  safeDecodePersistedUserParts,
  type BrunchAssistantPart,
  type BrunchUserPart,
} from '@/shared/chat.js';

export type AssistantPart = BrunchAssistantPart;
export type UserPart = BrunchUserPart;
export type DataTurnResponse = import('@/shared/chat.js').DataTurnResponse;
export type DataConfirmation = import('@/shared/chat.js').DataConfirmation;
export type DataTurnResponsePart = Extract<UserPart, { type: 'data-turn-response' }>;
export type DataConfirmationPart = Extract<UserPart, { type: 'data-confirmation' }>;

/** Serialize parts to JSON for persistence. */
export function serializeParts(parts: AssistantPart[] | UserPart[]): string {
  return JSON.stringify(parts);
}

/** Deserialize parts from persisted JSON. */
export function deserializeAssistantParts(json: string): AssistantPart[] {
  return JSON.parse(json) as AssistantPart[];
}

export function deserializeUserParts(json: string): UserPart[] {
  return JSON.parse(json) as UserPart[];
}

/** Safe deserialization — returns empty array for malformed or null input. */
export function safeDeserializeAssistantParts(json: string | null | undefined): AssistantPart[] {
  return safeDecodePersistedAssistantParts(json);
}

export function safeDeserializeUserParts(json: string | null | undefined): UserPart[] {
  return safeDecodePersistedUserParts(json);
}
