import { readFile, writeFile } from 'node:fs/promises';
import { resolve, relative } from 'node:path';

import { tool } from 'ai';
import * as z from 'zod/v4';

const inputSchema = z.object({
  path: z.string().describe('File path (absolute or relative to working directory)'),
  edits: z
    .array(
      z.object({
        oldText: z.string().describe('Exact text to find (must be unique in the file)'),
        newText: z.string().describe('Replacement text'),
      }),
    )
    .min(1)
    .describe('List of replacements to apply'),
});

const outputSchema = z.object({
  replacements: z.number(),
  path: z.string(),
});

function detectLineEnding(text: string): '\r\n' | '\r' | '\n' {
  const crlf = (text.match(/\r\n/g) || []).length;
  const cr = (text.match(/\r(?!\n)/g) || []).length;
  const lf = (text.match(/(?<!\r)\n/g) || []).length;
  if (crlf >= cr && crlf >= lf) return '\r\n';
  if (cr >= lf) return '\r';
  return '\n';
}

export function createEditTool(cwd: string) {
  return tool({
    description:
      'Make targeted edits to a file by replacing exact text matches. Each oldText must appear exactly once in the file.',
    inputSchema,
    outputSchema,
    execute: async ({ path: filePath, edits }) => {
      const absolutePath = resolve(cwd, filePath);
      const displayPath = relative(cwd, absolutePath) || filePath;

      const raw = await readFile(absolutePath, 'utf-8');
      const lineEnding = detectLineEnding(raw);
      let content = raw.replace(/\r\n|\r/g, '\n');

      let replacements = 0;
      for (const edit of edits) {
        const normalizedOld = edit.oldText.replace(/\r\n|\r/g, '\n');
        const occurrences = content.split(normalizedOld).length - 1;

        if (occurrences === 0) {
          throw new Error(
            `oldText not found in ${displayPath}: ${JSON.stringify(edit.oldText.slice(0, 80))}`,
          );
        }
        if (occurrences > 1) {
          throw new Error(
            `oldText appears ${occurrences} times in ${displayPath} (must be unique): ${JSON.stringify(edit.oldText.slice(0, 80))}`,
          );
        }

        const normalizedNew = edit.newText.replace(/\r\n|\r/g, '\n');
        content = content.replace(normalizedOld, normalizedNew);
        replacements++;
      }

      // Restore original line endings
      if (lineEnding !== '\n') {
        content = content.replace(/\n/g, lineEnding);
      }

      await writeFile(absolutePath, content, 'utf-8');

      return {
        replacements,
        path: displayPath,
      };
    },
  });
}
