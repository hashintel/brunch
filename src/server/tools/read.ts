import { readFile, access, constants } from 'node:fs/promises';
import { resolve, relative } from 'node:path';

import { tool } from 'ai';
import * as z from 'zod/v4';

const MAX_LINES = 500;
const MAX_BYTES = 64 * 1024;

const inputSchema = z.object({
  path: z.string().describe('File path (absolute or relative to working directory)'),
  offset: z.number().int().min(1).optional().describe('Start reading from this line number (1-indexed)'),
  limit: z.number().int().min(1).optional().describe('Maximum number of lines to read'),
});

const outputSchema = z.object({
  content: z.string(),
  lines: z.number(),
  totalLines: z.number(),
  truncated: z.boolean(),
});

function isBinary(buffer: Buffer): boolean {
  for (let i = 0; i < Math.min(buffer.length, 8192); i++) {
    if (buffer[i] === 0) return true;
  }
  return false;
}

export function createReadTool(cwd: string) {
  return tool({
    description:
      'Read a file from the filesystem. Returns line-numbered content. Use offset and limit for large files.',
    inputSchema,
    outputSchema,
    execute: async ({ path: filePath, offset, limit }) => {
      const absolutePath = resolve(cwd, filePath);
      const displayPath = relative(cwd, absolutePath) || filePath;

      await access(absolutePath, constants.R_OK);

      const buffer = await readFile(absolutePath);

      if (isBinary(buffer)) {
        return {
          content: `[Binary file: ${displayPath} (${buffer.length} bytes)]`,
          lines: 0,
          totalLines: 0,
          truncated: false,
        };
      }

      const text = buffer.toString('utf-8').replace(/^\uFEFF/, '');
      const allLines = text.split('\n');
      const totalLines = allLines.length;

      const startLine = offset ? offset - 1 : 0;
      const maxLines = limit ?? MAX_LINES;
      const sliced = allLines.slice(startLine, startLine + maxLines);

      let truncated = false;
      let resultLines = sliced;

      // Truncate by byte size
      let byteCount = 0;
      for (let i = 0; i < resultLines.length; i++) {
        byteCount += resultLines[i].length + 1;
        if (byteCount > MAX_BYTES) {
          resultLines = resultLines.slice(0, i);
          truncated = true;
          break;
        }
      }

      if (sliced.length < allLines.length - startLine) {
        truncated = true;
      }

      // Prepend line numbers (1-indexed)
      const numbered = resultLines.map((line, i) => `${startLine + i + 1}\t${line}`);
      const content = numbered.join('\n');

      return {
        content,
        lines: resultLines.length,
        totalLines,
        truncated,
      };
    },
  });
}
