import { writeFile, mkdir } from 'node:fs/promises';
import { resolve, dirname, relative } from 'node:path';

import { tool } from 'ai';
import * as z from 'zod/v4';

const inputSchema = z.object({
  path: z.string().describe('File path (absolute or relative to working directory)'),
  content: z.string().describe('Content to write to the file'),
});

const outputSchema = z.object({
  bytesWritten: z.number(),
  path: z.string(),
});

export function createWriteTool(cwd: string) {
  return tool({
    description: 'Write content to a file. Creates parent directories if needed. Overwrites existing files.',
    inputSchema,
    outputSchema,
    execute: async ({ path: filePath, content }) => {
      const absolutePath = resolve(cwd, filePath);
      const displayPath = relative(cwd, absolutePath) || filePath;

      await mkdir(dirname(absolutePath), { recursive: true });
      await writeFile(absolutePath, content, 'utf-8');

      return {
        bytesWritten: Buffer.byteLength(content, 'utf-8'),
        path: displayPath,
      };
    },
  });
}
