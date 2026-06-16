import type { SessionEntry, SessionHeader } from '@earendil-works/pi-coding-agent';

import { isSessionBindingEntry, type SessionBindingData } from '../../../session/session-binding.js';

export interface SessionManagerLike {
  getHeader(): SessionHeader | null;
  getEntries(): readonly SessionEntry[];
}

export type SelectedSpecBindingResolution =
  | {
      readonly status: 'ready';
      readonly header: SessionHeader;
      readonly binding: SessionBindingData;
      readonly entries: readonly SessionEntry[];
    }
  | {
      readonly status: 'not_ready';
      readonly reason: 'missing_session_header' | 'missing_binding';
      readonly sessionId: string | null;
    };

export function resolveSelectedSpecBinding(
  sessionManager: SessionManagerLike | undefined,
): SelectedSpecBindingResolution {
  if (!sessionManager) {
    return { status: 'not_ready', reason: 'missing_session_header', sessionId: null };
  }
  const header = sessionManager.getHeader() ?? undefined;
  if (!header) {
    return { status: 'not_ready', reason: 'missing_session_header', sessionId: null };
  }

  const entries = sessionManager.getEntries();
  const binding = entries.find(isSessionBindingEntry);
  if (!binding) {
    return { status: 'not_ready', reason: 'missing_binding', sessionId: header.id };
  }

  return { status: 'ready', header, binding: binding.data, entries };
}
