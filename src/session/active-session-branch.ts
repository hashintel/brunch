import { SessionManager, type SessionEntry, type SessionHeader } from '@earendil-works/pi-coding-agent';

export interface ActiveSessionBranch {
  header: SessionHeader;
  entries: SessionEntry[];
}

/** Opens Pi's persisted tree and returns only its canonical active root-to-leaf path. */
export function openActiveSessionBranch(file: string): ActiveSessionBranch {
  const manager = SessionManager.open(file);
  const header = manager.getHeader();
  if (!header) {
    throw new Error('Invalid Pi JSONL transcript: expected a Pi session header');
  }
  return { header, entries: manager.getBranch() };
}
