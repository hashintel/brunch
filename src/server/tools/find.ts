import { execSync } from 'node:child_process';
import { resolve, relative } from 'node:path';

import { tool } from 'ai';
import { z } from 'zod';

const DEFAULT_LIMIT = 200;
const MAX_BYTES = 64 * 1024;

const inputSchema = z.object({
  pattern: z.string().describe('Glob pattern to match (e.g. "**/*.ts", "src/**/*.test.ts")'),
  path: z.string().optional().describe('Directory to search in (defaults to working directory)'),
  limit: z.number().int().min(1).optional().describe(`Maximum results (default ${DEFAULT_LIMIT})`),
});

const outputSchema = z.object({
  files: z.string(),
  count: z.number(),
  truncated: z.boolean(),
});

export function createFindTool(cwd: string) {
  return tool({
    description:
      'Find files matching a glob pattern. Ignores node_modules and .git. Returns paths relative to working directory.',
    inputSchema,
    outputSchema,
    execute: async ({ pattern, path: searchPath, limit }) => {
      const absolutePath = resolve(cwd, searchPath ?? '.');
      const maxResults = limit ?? DEFAULT_LIMIT;

      // Use fd if available, fall back to find
      let output: string;
      try {
        output = execSync(`fd --glob '${pattern}' --type f --exclude node_modules --exclude .git`, {
          cwd: absolutePath,
          encoding: 'utf-8',
          maxBuffer: MAX_BYTES,
          timeout: 10_000,
        }).trim();
      } catch {
        // fd not found or failed — fall back to find + grep
        output = execSync(
          `find . -type f -name '${pattern}' -not -path '*/node_modules/*' -not -path '*/.git/*' 2>/dev/null`,
          {
            cwd: absolutePath,
            encoding: 'utf-8',
            maxBuffer: MAX_BYTES,
            timeout: 10_000,
          },
        ).trim();
      }

      if (!output) {
        return { files: 'No files found.', count: 0, truncated: false };
      }

      const allFiles = output.split('\n').filter(Boolean);
      const truncated = allFiles.length > maxResults;
      const files = allFiles.slice(0, maxResults);

      // Make paths relative to cwd
      const relativeFiles = files.map((f) => {
        const abs = resolve(absolutePath, f);
        return relative(cwd, abs);
      });

      return {
        files: relativeFiles.join('\n'),
        count: relativeFiles.length,
        truncated,
      };
    },
  });
}
