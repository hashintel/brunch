import { execSync } from 'node:child_process';
import { resolve, relative } from 'node:path';

import { tool } from 'ai';
import * as z from 'zod/v4';

const DEFAULT_LIMIT = 100;
const MAX_BYTES = 64 * 1024;

const inputSchema = z.object({
  pattern: z.string().describe('Search pattern (regex by default)'),
  path: z.string().optional().describe('File or directory to search in (defaults to working directory)'),
  glob: z.string().optional().describe('Glob to filter files (e.g. "*.ts", "*.{ts,tsx}")'),
  ignoreCase: z.boolean().optional().describe('Case-insensitive search'),
  context: z.number().int().min(0).optional().describe('Lines of context before and after each match'),
  limit: z.number().int().min(1).optional().describe(`Maximum matches (default ${DEFAULT_LIMIT})`),
});

const outputSchema = z.object({
  matches: z.string(),
  matchCount: z.number(),
  truncated: z.boolean(),
});

export function createGrepTool(cwd: string) {
  return tool({
    description:
      'Search file contents using ripgrep. Returns matching lines with file paths and line numbers.',
    inputSchema,
    outputSchema,
    execute: async ({ pattern, path: searchPath, glob: globPattern, ignoreCase, context, limit }) => {
      const absolutePath = resolve(cwd, searchPath ?? '.');
      const maxMatches = limit ?? DEFAULT_LIMIT;

      const args = ['--line-number', '--color=never', '--no-heading', '--hidden'];
      args.push(`--max-count=${maxMatches}`);

      if (ignoreCase) args.push('--ignore-case');
      if (context) args.push(`--context=${context}`);
      if (globPattern) args.push(`--glob=${globPattern}`);

      args.push('--', pattern, '.');

      let output: string;
      try {
        output = execSync(`rg ${args.map((a) => `'${a}'`).join(' ')}`, {
          cwd: absolutePath,
          encoding: 'utf-8',
          maxBuffer: MAX_BYTES,
          timeout: 15_000,
        }).trim();
      } catch (err: unknown) {
        // rg exits 1 on no matches
        const error = err as { status?: number; stdout?: string };
        if (error.status === 1) {
          return { matches: 'No matches found.', matchCount: 0, truncated: false };
        }
        throw err;
      }

      if (!output) {
        return { matches: 'No matches found.', matchCount: 0, truncated: false };
      }

      const lines = output.split('\n');
      const matchLines = lines.filter((l) => /^\.\/.+:\d+:/.test(l));
      const truncated = matchLines.length >= maxMatches;

      // Make paths relative to cwd
      const displayOutput = output.replace(/^\.\//gm, () => {
        return relative(cwd, absolutePath) ? `${relative(cwd, absolutePath)}/` : '';
      });

      return {
        matches: displayOutput,
        matchCount: matchLines.length,
        truncated,
      };
    },
  });
}
