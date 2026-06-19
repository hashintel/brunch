/**
 * Subagent extension config (D44-L).
 *
 * The concurrency cap lives in an externalized `config.json` so it can be
 * reviewed and edited without SPEC churn. It is validated through a TypeBox
 * schema (D41-L) when loaded. Unknown keys (e.g. a `$comment` documenting the
 * file) are tolerated.
 */

import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import { Type, type Static } from 'typebox';
import { Value } from 'typebox/value';

export const SubagentConfigSchema = Type.Object(
  {
    version: Type.Integer({ minimum: 1 }),
    maxConcurrency: Type.Integer({ minimum: 1 }),
  },
  { additionalProperties: true },
);

export type SubagentConfig = Static<typeof SubagentConfigSchema>;

export const DEFAULT_SUBAGENT_CONFIG: SubagentConfig = { version: 1, maxConcurrency: 4 };

/** Filesystem location of the bundled `config.json`. */
export function subagentConfigPath(): string {
  return fileURLToPath(new URL('./config.json', import.meta.url));
}

export function parseSubagentConfig(raw: unknown, options: { sourcePath?: string } = {}): SubagentConfig {
  const where = options.sourcePath ? ` in ${options.sourcePath}` : '';
  if (!Value.Check(SubagentConfigSchema, raw)) {
    const detail = [...Value.Errors(SubagentConfigSchema, raw)]
      .map((issue) => `${issue.instancePath || '/'} ${issue.message}`)
      .join('; ');
    throw new Error(`Invalid subagent config${where}: ${detail}`);
  }
  return { version: raw.version, maxConcurrency: raw.maxConcurrency };
}

export async function loadSubagentConfig(path: string): Promise<SubagentConfig> {
  let raw: unknown;
  try {
    raw = JSON.parse(await readFile(path, 'utf8'));
  } catch (error) {
    throw new Error(`Invalid subagent config in ${path}: ${(error as Error).message}`);
  }
  return parseSubagentConfig(raw, { sourcePath: path });
}
