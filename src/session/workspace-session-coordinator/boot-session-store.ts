import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

import type { SessionHeader } from '@earendil-works/pi-coding-agent';

import { isSessionBindingEntry, SESSION_BINDING_TYPE, type SessionBindingData } from '../session-binding.js';
import type {
  WorkspaceLaunchSession,
  WorkspaceStoreOracleResult,
  WorkspaceUnavailableSession,
} from '../workspace-session-coordinator.js';

const BRUNCH_DIR = '.brunch';
const SESSION_DIR = 'sessions';

interface BoundSessionFile extends Omit<WorkspaceLaunchSession, 'specTitle'> {
  binding: SessionBindingData;
  bindingCount: 1;
}

type CanonicalSessionFile = BoundSessionFile | WorkspaceUnavailableSession;

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
  currentSpecId: number | null;
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
    if (options.currentSpecId !== null && session.specId !== options.currentSpecId) {
      errors.push(
        `${session.file} binding spec ${session.specId} does not match state ${options.currentSpecId}`,
      );
    }
    sessions.push({
      file: session.file,
      sessionId: session.id,
      bindingCount: session.bindingCount,
      binding: session.binding,
    });
  }

  return errors.length === 0 ? { ok: true, specId: options.currentSpecId, sessions } : { ok: false, errors };
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
    return { file, reason: 'missing_binding', available: false };
  }

  const binding = bindings[0]!;
  if (bindings.length !== 1) {
    return { file, reason: 'incompatible_binding', available: false };
  }

  const name = latestSessionName(entries);

  return {
    id: header.id,
    file,
    specId: binding.data.specId,
    binding: binding.data,
    bindingCount: 1,
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

function latestSessionName(entries: unknown[]): string | undefined {
  let name: string | undefined;
  for (const entry of entries) {
    if (isSessionInfoEntry(entry) && typeof entry.name === 'string') {
      name = entry.name;
    }
  }
  return name;
}

function formatUnavailableSessionError(session: WorkspaceUnavailableSession): string {
  switch (session.reason) {
    case 'missing_header':
      return `${session.file} has no session header`;
    case 'missing_binding':
      return `${session.file} has 0 ${SESSION_BINDING_TYPE} entries`;
    case 'incompatible_binding':
      return `${session.file} has incompatible ${SESSION_BINDING_TYPE} entries`;
    case 'unreadable':
      return `${session.file} is unreadable`;
  }
}

function isJsonParseError(error: unknown): error is SyntaxError {
  return error instanceof SyntaxError;
}

function isSessionHeader(value: unknown): value is SessionHeader {
  return (
    typeof value === 'object' &&
    value !== null &&
    (value as { type?: unknown }).type === 'session' &&
    typeof (value as { id?: unknown }).id === 'string'
  );
}

function isSessionInfoEntry(value: unknown): value is { type: 'session_info'; name?: unknown } {
  return typeof value === 'object' && value !== null && (value as { type?: unknown }).type === 'session_info';
}
