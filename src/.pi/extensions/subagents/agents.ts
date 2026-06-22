/**
 * Subagent agent definitions (D44-L).
 *
 * Agents are declarative markdown files with a small frontmatter block plus a
 * system-prompt body. The frontmatter is the registry contract; the body is the
 * subagent's standing instructions (it becomes the child session's system
 * prompt). Frontmatter is validated through a TypeBox schema (D41-L) so a
 * malformed agent fails loud at load time rather than producing a silently
 * misconfigured child session.
 *
 * The format is intentionally tiny (scalar `key: value` lines plus a
 * comma-separated `tools` list) so no YAML dependency is required; Brunch owns
 * these files, so the parser only needs to handle the shapes Brunch authors.
 */

import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { Type, type Static } from 'typebox';
import { Value } from 'typebox/value';

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

export type SubagentFrontmatter = Static<typeof SubagentFrontmatterSchema>;

export interface SubagentDefinition extends SubagentFrontmatter {
  /** The markdown body — used verbatim as the child session's system prompt. */
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

  return { ...candidate, systemPrompt: body };
}

/** Filesystem location of the bundled agent markdown resources. */
export function subagentAgentsDir(): string {
  return fileURLToPath(new URL('./agents', import.meta.url));
}

/**
 * Load every `*.md` agent definition from a directory, keyed by agent name.
 * Throws on a malformed definition or a duplicate name so misconfiguration is
 * caught at registration time.
 */
export async function loadSubagentDefinitions(dir: string): Promise<Map<string, SubagentDefinition>> {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith('.md') && entry.name !== 'README.md')
    .map((entry) => entry.name)
    .sort();

  const definitions = new Map<string, SubagentDefinition>();
  for (const file of files) {
    const source = await readFile(join(dir, file), 'utf8');
    const definition = parseSubagentMarkdown(source, { sourcePath: file });
    if (definitions.has(definition.name)) {
      throw new Error(`Duplicate subagent name "${definition.name}" (from ${file})`);
    }
    definitions.set(definition.name, definition);
  }
  return definitions;
}
