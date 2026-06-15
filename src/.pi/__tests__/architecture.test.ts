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

const resourceExpectations = [
  {
    file: 'src/.pi/skills/methods/run-structured-exchange.md',
    needles: ['details.schema', 'schema` plus `v', 'answered`, `cancelled`, or `unavailable`'],
  },
  {
    file: 'src/.pi/skills/methods/infer-and-capture.md',
    needles: ['transcript-native analysis', 'not graph mutation', 'must never imply a graph bypass'],
  },
  {
    file: 'src/.pi/skills/methods/generate-proposal.md',
    needles: ['legibility_cost_of_knowing', 'core_bet', 'graph_refs', '`{ node_id: string }` only'],
  },
];

describe('agents topology', () => {
  it('keeps prompt guidance in .pi resources and removes the legacy .pi context source', async () => {
    await expect(readdir(legacyContextPath)).rejects.toThrow();

    for (const expectation of resourceExpectations) {
      const content = await readFile(join(projectRoot, expectation.file), 'utf8');
      for (const needle of expectation.needles) {
        expect(content).toContain(needle);
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
