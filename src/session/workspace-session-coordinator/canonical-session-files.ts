import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

import type { SessionHeader } from '@earendil-works/pi-coding-agent';

import { BRUNCH_DIR, SESSION_DIR } from '../../constants.js';
import { isSessionBindingEntry, SESSION_BINDING_TYPE, type SessionBindingData } from '../session-binding.js';
import type {
  WorkspaceLaunchSession,
  WorkspaceStoreOracleResult,
  WorkspaceUnavailableSession,
} from '../workspace-session-coordinator.js';

interface BoundSessionFile extends Omit<WorkspaceLaunchSession, 'specTitle'> {
  binding: SessionBindingData;
  bindingCount: 1;
  turnCount: number;
}

interface UnavailableSessionFile extends WorkspaceUnavailableSession {
  bindingCount?: number;
}

type CanonicalSessionFile = BoundSessionFile | UnavailableSessionFile;

export async function inspectCanonicalSessionFiles(cwd: string): Promise<CanonicalSessionFile[]> {
  const files = await listSessionFiles(cwd);
  const sessions: CanonicalSessionFile[] = [];
  for (const file of files) {
    sessions.push(await inspectCanonicalSessionFile(file));
  }
  return sessions;
}

export async function verifyCanonicalSessionStore(options: {
  cwd: string;
  expectedSessionCount?: number | undefined;
  defaultSpecId: number | null;
}): Promise<WorkspaceStoreOracleResult> {
  const classifiedSessions = await inspectCanonicalSessionFiles(options.cwd);
  const errors: string[] = [];

  if (
    options.expectedSessionCount !== undefined &&
    classifiedSessions.length !== options.expectedSessionCount
  ) {
    errors.push(
      `Expected ${options.expectedSessionCount} session file(s), found ${classifiedSessions.length}`,
    );
  }

  const sessions: Array<{
    file: string;
    sessionId: string;
    bindingCount: number;
    binding: SessionBindingData;
  }> = [];

  for (const session of classifiedSessions) {
    if (!session.available) {
      errors.push(formatUnavailableSessionError(session));
      continue;
    }
    sessions.push({
      file: session.file,
      sessionId: session.id,
      bindingCount: session.bindingCount,
      binding: session.binding,
    });
  }

  return errors.length === 0 ? { ok: true, specId: options.defaultSpecId, sessions } : { ok: false, errors };
}

async function inspectCanonicalSessionFile(file: string): Promise<CanonicalSessionFile> {
  let entries: unknown[];
  try {
    entries = await readJsonl(file);
  } catch (error) {
    if (isJsonParseError(error)) {
      return { file, reason: 'unreadable', available: false };
    }
    throw error;
  }

  const header = entries.find(isSessionHeader);
  if (!header) {
    return { file, reason: 'missing_header', available: false };
  }

  const bindings = entries.filter(isSessionBindingEntry);
  if (bindings.length === 0) {
    return { file, reason: 'missing_binding', bindingCount: 0, available: false };
  }

  const binding = bindings[0]!;
  if (bindings.length !== 1) {
    return { file, reason: 'incompatible_binding', bindingCount: bindings.length, available: false };
  }

  const name = latestSessionName(entries);

  return {
    id: header.id,
    file,
    specId: binding.data.specId,
    binding: binding.data,
    bindingCount: 1,
    turnCount: countTurnEntries(entries),
    ...(name != null ? { name } : {}),
    available: true,
  };
}

async function listSessionFiles(cwd: string): Promise<string[]> {
  try {
    const entries = await readdir(join(cwd, BRUNCH_DIR, SESSION_DIR), { withFileTypes: true });
    return entries
      .filter((entry) => entry.isFile() && entry.name.endsWith('.jsonl'))
      .map((entry) => join(cwd, BRUNCH_DIR, SESSION_DIR, entry.name))
      .sort();
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return [];
    }
    throw error;
  }
}

async function readJsonl(file: string): Promise<unknown[]> {
  const content = await readFile(file, 'utf8');
  return content
    .split('\n')
    .filter((line) => line.trim().length > 0)
    .map((line) => JSON.parse(line) as unknown);
}

function countTurnEntries(entries: readonly unknown[]): number {
  return entries.filter((entry) => {
    if (!isRecord(entry) || entry.type !== 'message' || !isRecord(entry.message)) return false;
    const role = entry.message.role;
    return role === 'user' || role === 'assistant';
  }).length;
}

function latestSessionName(entries: unknown[]): string | undefined {
  let name: string | undefined;
  for (const entry of entries) {
    if (isSessionInfoEntry(entry) && typeof entry.name === 'string') {
      name = entry.name;
    }
  }
  return name;
}

function formatUnavailableSessionError(session: UnavailableSessionFile): string {
  switch (session.reason) {
    case 'missing_header':
      return `${session.file} has no session header`;
    case 'missing_binding':
      return `${session.file} has ${session.bindingCount ?? 0} ${SESSION_BINDING_TYPE} entries`;
    case 'incompatible_binding':
      return `${session.file} has ${session.bindingCount ?? 'incompatible'} ${SESSION_BINDING_TYPE} entries`;
    case 'unreadable':
      return `${session.file} is unreadable`;
  }
}

function isJsonParseError(error: unknown): error is SyntaxError {
  return error instanceof SyntaxError;
}

function isSessionHeader(value: unknown): value is SessionHeader {
  return isRecord(value) && value.type === 'session' && typeof value.id === 'string';
}

function isSessionInfoEntry(value: unknown): value is { type: 'session_info'; name?: unknown } {
  return isRecord(value) && value.type === 'session_info';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
