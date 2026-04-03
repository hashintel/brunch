import { readdir } from 'node:fs/promises';
import { resolve, relative } from 'node:path';

import { tool } from 'ai';
import * as z from 'zod/v4';

const DEFAULT_LIMIT = 200;

const inputSchema = z.object({
  path: z.string().optional().describe('Directory path (defaults to working directory)'),
  limit: z.number().int().min(1).optional().describe(`Maximum entries to return (default ${DEFAULT_LIMIT})`),
});

const outputSchema = z.object({
  entries: z.string(),
  count: z.number(),
});

export function createLsTool(cwd: string) {
  return tool({
    description: 'List files and directories. Directories are marked with a trailing /.',
    inputSchema,
    outputSchema,
    execute: async ({ path: dirPath, limit }) => {
      const absolutePath = resolve(cwd, dirPath ?? '.');
      const displayPath = relative(cwd, absolutePath) || '.';
      const maxEntries = limit ?? DEFAULT_LIMIT;

      const entries = await readdir(absolutePath, { withFileTypes: true });
      entries.sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()));

      const lines: string[] = [];
      for (const entry of entries.slice(0, maxEntries)) {
        lines.push(entry.isDirectory() ? `${entry.name}/` : entry.name);
      }

      const header =
        entries.length > maxEntries
          ? `${displayPath}/ (showing ${maxEntries} of ${entries.length} entries):`
          : `${displayPath}/:`;

      return {
        entries: `${header}\n${lines.join('\n')}`,
        count: lines.length,
      };
    },
  });
}
