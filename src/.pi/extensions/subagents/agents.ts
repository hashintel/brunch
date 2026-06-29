/**
 * Subagent agent definitions (D44-L / D90-L).
 *
 * Background agents are declarative SYSTEM.md files under the shared
 * `src/agents/prompts/<id>/` body home. Each file carries a small frontmatter block
 * plus a system-prompt body. The frontmatter is the registry contract; the body
 * is the subagent's standing instructions and the first section of the assembled
 * child prompt. Frontmatter is validated through a TypeBox schema (D41-L) so a
 * malformed agent fails loud at load time rather than producing a silently
 * misconfigured child session.
 *
 * The format is intentionally tiny (scalar `key: value` lines plus a
 * comma-separated `tools` list) so no YAML dependency is required; Brunch owns
 * these files, so the parser only needs to handle the shapes Brunch authors.
 */

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { Type } from 'typebox';
import { Value } from 'typebox/value';

import { bundledAgentBodyHome } from '../../../agents/registry.js';
import type { BackgroundAgentManifest } from '../../../session/schema/agent-manifest.js';

export const BACKGROUND_SUBAGENT_IDS = ['explorer', 'researcher', 'projector', 'reviewer'] as const;
export type BackgroundSubagentId = (typeof BACKGROUND_SUBAGENT_IDS)[number];

export const SUBAGENT_THINKING_LEVELS = ['low', 'medium', 'high'] as const;

export const SubagentFrontmatterSchema = Type.Object({
  name: Type.String({ minLength: 1 }),
  description: Type.String({ minLength: 1 }),
  /** Allowlist of tool names the child session may use. Empty = no tools. */
  tools: Type.Array(Type.String({ minLength: 1 })),
  /** `default` (inherit the parent's current model) or `provider/model-id`. */
  model: Type.String({ minLength: 1 }),
  thinking: Type.Union(SUBAGENT_THINKING_LEVELS.map((level) => Type.Literal(level))),
});

export interface SubagentFrontmatter {
  name: string;
  description: string;
  tools: string[];
  model: string;
  thinking: (typeof SUBAGENT_THINKING_LEVELS)[number];
}

export interface SubagentDefinition extends BackgroundAgentManifest {
  /** Frontmatter authoring key retained for existing call sites and errors. */
  readonly name: string;
  readonly description: string;
  readonly tools: readonly string[];
  readonly model: SubagentFrontmatter['model'];
  readonly thinking: SubagentFrontmatter['thinking'];
  /** The markdown body — used as the first section of the assembled child prompt. */
  readonly systemPrompt: string;
}

interface ParsedFrontmatter {
  readonly fields: Record<string, string>;
  readonly body: string;
}

const FRONTMATTER_PATTERN = /^\uFEFF?---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/;

function parseFrontmatterBlock(source: string): ParsedFrontmatter {
  const match = FRONTMATTER_PATTERN.exec(source);
  if (!match) {
    throw new Error('missing frontmatter block (expected a leading "---" delimited section)');
  }
  const block = match[1] ?? '';
  const body = match[2] ?? '';
  const fields: Record<string, string> = {};
  for (const rawLine of block.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (line.length === 0 || line.startsWith('#')) continue;
    const separator = line.indexOf(':');
    if (separator === -1) {
      throw new Error(`malformed frontmatter line (expected "key: value"): ${rawLine}`);
    }
    const key = line.slice(0, separator).trim();
    if (Object.hasOwn(fields, key)) {
      throw new Error(`duplicate frontmatter key "${key}"`);
    }
    fields[key] = line.slice(separator + 1).trim();
  }
  return { fields, body };
}

function parseToolList(value: string | undefined): string[] {
  if (!value) return [];
  return value
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}

export function parseSubagentMarkdown(
  source: string,
  options: { sourcePath?: string } = {},
): SubagentDefinition {
  const where = options.sourcePath ? ` in ${options.sourcePath}` : '';
  let parsed: ParsedFrontmatter;
  try {
    parsed = parseFrontmatterBlock(source);
  } catch (error) {
    throw new Error(`Invalid subagent definition${where}: ${(error as Error).message}`);
  }

  const candidate = {
    name: parsed.fields.name ?? '',
    description: parsed.fields.description ?? '',
    tools: parseToolList(parsed.fields.tools),
    model: parsed.fields.model ?? 'default',
    thinking: parsed.fields.thinking ?? 'medium',
  };

  if (!Value.Check(SubagentFrontmatterSchema, candidate)) {
    const detail = [...Value.Errors(SubagentFrontmatterSchema, candidate)]
      .map((issue) => `${issue.instancePath || '/'} ${issue.message}`)
      .join('; ');
    throw new Error(`Invalid subagent frontmatter${where}: ${detail}`);
  }

  const body = parsed.body.trim();
  if (body.length === 0) {
    throw new Error(`Invalid subagent definition${where}: empty system-prompt body`);
  }

  return {
    ...candidate,
    id: candidate.name,
    kind: 'background',
    body: { source: 'markdown', systemPrompt: body },
    skills: { strategies: [], lenses: [], methods: [] },
    canDelegate: [],
    systemPrompt: body,
  };
}

/** Filesystem location of the unified bundled agent body home. */
export function subagentAgentsDir(): string {
  return bundledAgentBodyHome();
}

/**
 * Load the code-owned registry ids from a directory, keyed by agent name. Throws
 * on malformed definitions, duplicate names, or id/frontmatter drift so
 * misconfiguration is caught at registration time.
 */
export async function loadSubagentDefinitions(
  dir: string,
  ids: readonly string[] = BACKGROUND_SUBAGENT_IDS,
): Promise<Map<string, SubagentDefinition>> {
  const definitions = new Map<string, SubagentDefinition>();
  for (const id of ids) {
    const file = join(id, 'SYSTEM.md');
    const source = await readFile(join(dir, file), 'utf8');
    const definition = parseSubagentMarkdown(source, { sourcePath: file });
    if (definition.name !== id) {
      throw new Error(`Subagent registry id "${id}" does not match frontmatter name "${definition.name}".`);
    }
    if (definitions.has(definition.name)) {
      throw new Error(`Duplicate subagent name "${definition.name}" (from ${file})`);
    }
    definitions.set(definition.name, definition);
  }
  return definitions;
}
