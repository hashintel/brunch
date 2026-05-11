import { createInterface } from 'node:readline/promises';
import type { Readable, Writable } from 'node:stream';

import { z } from 'zod';

import { CapabilityDispatchError, dispatchCapability } from './capabilities.js';
import type { DB } from './db.js';

const agentJsonlRequestSchema = z.object({
  id: z.string().min(1),
  capability: z.string().min(1),
  input: z.unknown().optional(),
});

export interface AgentJsonlSessionOptions {
  db: DB;
  input: Readable;
  output: Writable;
}

type AgentJsonlResponse =
  | { id: string; ok: true; output: unknown }
  | { id: string | null; ok: false; error: { code: string; message: string } };

function writeResponse(output: Writable, response: AgentJsonlResponse): void {
  output.write(`${JSON.stringify(response)}\n`);
}

function toErrorResponse(id: string | null, code: string, message: string): AgentJsonlResponse {
  return {
    id,
    ok: false,
    error: { code, message },
  };
}

function getRecoverableErrorCode(error: unknown): string {
  if (error instanceof CapabilityDispatchError) {
    return error.code;
  }
  return 'handler_failed';
}

export async function runAgentJsonlSession({ db, input, output }: AgentJsonlSessionOptions): Promise<void> {
  const lines = createInterface({ input, crlfDelay: Infinity });

  for await (const line of lines) {
    if (line.trim() === '') {
      continue;
    }

    let rawRequest: unknown;
    try {
      rawRequest = JSON.parse(line);
    } catch {
      writeResponse(output, toErrorResponse(null, 'invalid_json', 'Invalid JSONL request'));
      continue;
    }

    const parsedRequest = agentJsonlRequestSchema.safeParse(rawRequest);
    const requestId =
      rawRequest && typeof rawRequest === 'object' && 'id' in rawRequest && typeof rawRequest.id === 'string'
        ? rawRequest.id
        : null;

    if (!parsedRequest.success) {
      writeResponse(output, toErrorResponse(requestId, 'invalid_request', 'Invalid JSONL request envelope'));
      continue;
    }

    try {
      const result = await dispatchCapability({
        db,
        capability: parsedRequest.data.capability,
        input: parsedRequest.data.input,
      });
      writeResponse(output, { id: parsedRequest.data.id, ok: true, output: result });
    } catch (error) {
      writeResponse(
        output,
        toErrorResponse(
          parsedRequest.data.id,
          getRecoverableErrorCode(error),
          error instanceof Error ? error.message : 'Capability dispatch failed',
        ),
      );
    }
  }
}
