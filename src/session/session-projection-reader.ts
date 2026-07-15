import { readdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';

import { readBrunchSessionEnvelope, type BrunchSessionEnvelope } from './brunch-session-envelope.js';

export interface ExplicitSessionProjectionParams {
  sessionId: string;
  specId?: number;
}

export type SessionProjectionTarget =
  | {
      ok: true;
      envelope: BrunchSessionEnvelope;
    }
  | {
      ok: false;
      code: number;
      message: string;
    };

export async function resolveExplicitSessionProjectionTarget(
  cwd: string,
  params: ExplicitSessionProjectionParams,
): Promise<SessionProjectionTarget> {
  const files = await listSessionFiles(cwd);
  for (const file of files) {
    const readResult = await readBrunchSessionEnvelope(file);
    if (!sessionIds(readResult).includes(params.sessionId)) {
      continue;
    }
    if (!readResult.ok) {
      return invalidSessionSelfDescription();
    }

    const binding = readResult.envelope.binding;
    if (params.specId && binding.specId !== params.specId) {
      return {
        ok: false,
        code: -32003,
        message: 'Brunch session does not belong to requested spec',
      };
    }
    return {
      ok: true,
      envelope: readResult.envelope,
    };
  }

  return { ok: false, code: -32004, message: 'Brunch session not found' };
}

function sessionIds(readResult: Awaited<ReturnType<typeof readBrunchSessionEnvelope>>): string[] {
  return readResult.ok ? [readResult.envelope.header.id] : readResult.observedSessionIds;
}

function invalidSessionSelfDescription(): SessionProjectionTarget {
  return {
    ok: false,
    code: -32005,
    message: 'Brunch session self-description is invalid',
  };
}

async function listSessionFiles(cwd: string): Promise<string[]> {
  const sessionRoot = join(resolve(cwd), '.brunch', 'sessions');
  try {
    const entries = await readdir(sessionRoot, { withFileTypes: true });
    return entries
      .filter((entry) => entry.isFile() && entry.name.endsWith('.jsonl'))
      .map((entry) => join(sessionRoot, entry.name))
      .sort();
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return [];
    }
    throw error;
  }
}
