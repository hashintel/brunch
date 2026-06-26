import { readFile, readdir } from 'node:fs/promises';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const projectRoot = dirname(dirname(dirname(dirname(fileURLToPath(import.meta.url)))));
const legacyContextPath = join(projectRoot, 'src/.pi/context');

const legacyImportNeedles = [
  ['src', '.pi', 'context'].join('/'),
  'compose' + '-brunch-prompt',
  ['context', 'prompt-packs'].join('/'),
  ['context', 'builders'].join('/'),
];

const runtimeRegistryExpectations = [
  {
    file: 'src/session/schema/kinds.ts',
    required: "export const AGENT_ROLE_IDS = ['elicitor', 'executor'] as const;",
    forbidden: ['reviewer', 'pi-coder'],
  },
  {
    file: 'src/agents/runtime/policy.ts',
    required:
      'export const FOREGROUND_AGENT_ROSTER: Record<OperationalModeId, OperationalModeDefinition> = {',
    // `reviewer` is a non-write background agent that legitimately appears in
    // elicit's code-owned `canDelegate` set (D92-L delegatable-set lives beside
    // the op_mode policy). Only `pi-coder` — an unwired planned foreground —
    // must stay out of the foreground registry here.
    forbidden: ['pi-coder'],
  },
];

const modelTextAdapterDirs = [
  join(projectRoot, 'src/.pi/extensions/brunch-data'),
  join(projectRoot, 'src/.pi/extensions/exchanges'),
];

const allowedModelTextAdapterFiles = new Set([
  'src/.pi/extensions/exchanges/shared/markdown.ts', // TUI display adapter, not provider text ownership.
]);

describe('agents topology', () => {
  it('removes the legacy .pi context source', async () => {
    await expect(readdir(legacyContextPath)).rejects.toThrow();
  });

  it('keeps named future agent bodies out of the runtime registry', async () => {
    for (const expectation of runtimeRegistryExpectations) {
      const content = await readFile(join(projectRoot, expectation.file), 'utf8');
      expect(content).toContain(expectation.required);
      for (const needle of expectation.forbidden) {
        expect(content, `${expectation.file} must not register ${needle}`).not.toContain(needle);
      }
    }
  });

  it('keeps product source imports free of legacy .pi context prompt paths', async () => {
    const files = await listSourceFiles(join(projectRoot, 'src'));

    for (const file of files) {
      const rel = relative(projectRoot, file);
      if (rel.endsWith('.test.ts') || rel.includes('/__tests__/')) continue;
      const content = await readFile(file, 'utf8');
      for (const needle of legacyImportNeedles) {
        expect(content, `${rel} must not reference ${needle}`).not.toContain(needle);
      }
    }
  });

  it('keeps Pi tool adapters from owning Brunch-authored model text', async () => {
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
