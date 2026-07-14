import { type FileEntry, type SessionEntry, type SessionHeader } from '@earendil-works/pi-coding-agent';

import { openActiveSessionBranch } from './active-session-branch.js';
import { isSessionBindingEntry, type SessionBindingData } from './session-binding.js';

export interface BrunchSessionEnvelope {
  header: SessionHeader;
  binding: SessionBindingData;
  entries: FileEntry[];
}

export type BrunchSessionEnvelopeReadResult =
  | {
      ok: true;
      envelope: BrunchSessionEnvelope;
    }
  | {
      ok: false;
      observedSessionIds: string[];
    };

export async function readBrunchSessionEnvelope(file: string): Promise<BrunchSessionEnvelopeReadResult> {
  let branch: ReturnType<typeof openActiveSessionBranch>;
  try {
    branch = openActiveSessionBranch(file);
  } catch {
    return { ok: false, observedSessionIds: [] };
  }

  const bindings = branch.entries.filter(isSessionBindingEntry).map((entry) => entry.data);
  if (bindings.length !== 1) {
    return { ok: false, observedSessionIds: [branch.header.id] };
  }

  return {
    ok: true,
    envelope: {
      header: branch.header,
      binding: bindings[0]!,
      entries: branch.entries,
    },
  };
}

export async function loadJsonlTranscriptEntries(file: string): Promise<FileEntry[]> {
  return openActiveSessionBranch(file).entries;
}

export function isSessionEntry(value: unknown): value is SessionEntry {
  return isTranscriptEntry(value) && hasStringOrNullParentId(value);
}

export function isTranscriptEntry(value: unknown): value is SessionEntry {
  return (
    typeof value === 'object' &&
    value !== null &&
    (value as { type?: unknown }).type !== 'session' &&
    typeof (value as { id?: unknown }).id === 'string' &&
    typeof (value as { type?: unknown }).type === 'string'
  );
}

export function hasStringOrNullParentId(value: unknown): boolean {
  return (
    (value as { parentId?: unknown }).parentId === null ||
    typeof (value as { parentId?: unknown }).parentId === 'string'
  );
}
