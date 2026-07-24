import { access, readFile, readdir } from 'node:fs/promises';
import { relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const root = fileURLToPath(new URL('..', import.meta.url));
const packageJson = JSON.parse(await readFile(resolve(root, 'package.json'), 'utf8'));

const comparisonTests = [
  'src/dev/end-to-end-comparison/__tests__/factorial-browser-oracle.slow.test.ts',
  'src/dev/execution-comparison/__tests__/browser-oracle.slow.test.ts',
  'src/dev/execution-comparison/__tests__/host-landing-oracle.slow.test.ts',
  'src/dev/execution-comparison/__tests__/petrinaut-optimization-oracle.slow.test.ts',
  'src/dev/execution-comparison/__tests__/prospect-research-workspace-oracle.slow.test.ts',
];

async function collectSlowTests(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const paths = await Promise.all(
    entries.map(async (entry) => {
      const path = resolve(directory, entry.name);
      if (entry.isDirectory()) return await collectSlowTests(path);
      return entry.name.endsWith('.slow.test.ts') ? [relative(root, path)] : [];
    }),
  );
  return paths.flat();
}

describe('comparison test lane inventory', () => {
  it('owns every expensive comparison oracle exactly once', async () => {
    const discovered = (
      await Promise.all([
        collectSlowTests(resolve(root, 'src/dev/execution-comparison')),
        collectSlowTests(resolve(root, 'src/dev/end-to-end-comparison')),
      ])
    )
      .flat()
      .sort((left, right) => left.localeCompare(right));

    expect(discovered).toEqual(comparisonTests);
    for (const path of comparisonTests) {
      expect(packageJson.scripts['test:comparison'].split(path)).toHaveLength(2);
    }
  });

  it('routes the prospect full-stack oracle out of the default lane', async () => {
    await expect(
      access(
        resolve(
          root,
          'src/dev/execution-comparison/__tests__/prospect-research-workspace-oracle.slow.test.ts',
        ),
      ),
    ).resolves.toBeUndefined();
    await expect(
      access(
        resolve(root, 'src/dev/execution-comparison/__tests__/prospect-research-workspace-oracle.test.ts'),
      ),
    ).rejects.toThrow();
    expect(packageJson.scripts.test).toContain('**/*.slow.test.ts');
  });

  it('keeps non-comparison slow tests in the mandatory core lane', async () => {
    const allSlowTests = (await collectSlowTests(resolve(root, 'src'))).sort((left, right) =>
      left.localeCompare(right),
    );
    const coreSlowTests = allSlowTests.filter((path) => !comparisonTests.includes(path));

    expect(coreSlowTests).toContain('src/app/__tests__/git-slice-integration-port.slow.test.ts');
    expect(packageJson.scripts['test:slow:core']).toContain('.slow.test.ts');
    expect(packageJson.scripts['test:slow:core']).toContain(
      "--exclude='src/dev/execution-comparison/**/*.slow.test.ts'",
    );
    expect(packageJson.scripts['test:slow:core']).toContain(
      "--exclude='src/dev/end-to-end-comparison/**/*.slow.test.ts'",
    );
  });

  it('composes the complete suite from default, core-slow, and comparison lanes', () => {
    expect(packageJson.scripts['test:slow']).toBe('npm run test:slow:core && npm run test:comparison');
    expect(packageJson.scripts['test:full']).toBe('npm run test && npm run test:slow');
  });
});
