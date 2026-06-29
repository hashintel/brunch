import { readFile, readdir } from 'node:fs/promises';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const projectRoot = dirname(dirname(dirname(dirname(fileURLToPath(import.meta.url)))));

const modelTextAdapterDirs = [
  join(projectRoot, 'src/.pi/extensions/brunch-data'),
  join(projectRoot, 'src/.pi/extensions/exchanges'),
];

const allowedModelTextAdapterFiles = new Set([
  'src/.pi/extensions/exchanges/shared/markdown.ts', // TUI display adapter, not provider text ownership.
]);

describe('agents topology', () => {
  it('keeps Pi tool adapters from owning Brunch-authored provider text', async () => {
    // D39-L/D60-L: `.pi/extensions` is the harness adapter surface; Brunch-authored
    // model/provider text belongs under `src/agents/contexts` or prompt composition.
    // This is a named architecture sentinel, not a generic source-prose lock.
    const files = (await Promise.all(modelTextAdapterDirs.map((dir) => listSourceFiles(dir)))).flat();

    for (const file of files) {
      const rel = relative(projectRoot, file);
      if (rel.endsWith('.test.ts') || rel.includes('/__tests__/') || allowedModelTextAdapterFiles.has(rel)) {
        continue;
      }
      const content = await readFile(file, 'utf8');
      expect(content, `${rel} must import model-facing formatters from src/agents/contexts`).not.toMatch(
        /function\s+format[A-Z]/,
      );
      expect(content, `${rel} must not inline provider text content`).not.toMatch(
        /content:\s*\[\{\s*type:\s*'text'\s+as\s+const,\s*text:\s*`/,
      );
    }
  });
});

async function listSourceFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await listSourceFiles(path)));
      continue;
    }
    if (entry.isFile() && /\.(?:ts|tsx)$/.test(entry.name)) {
      files.push(path);
    }
  }

  return files;
}
