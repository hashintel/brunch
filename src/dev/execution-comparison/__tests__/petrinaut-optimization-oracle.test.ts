import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { assessPetrinautFocusedObservation } from '../petrinaut-optimization-oracle/claims.js';

const oracleRoot = fileURLToPath(new URL('../petrinaut-optimization-oracle/', import.meta.url));
const oracleEntry = fileURLToPath(new URL('../petrinaut-optimization-oracle.ts', import.meta.url));

describe('controller-owned Petrinaut optimization oracle boundary', () => {
  it('contains no historical, candidate-internal, or runtime-selected implementation dependency', async () => {
    const sources = await sourceFiles(oracleRoot);
    const source = (
      await Promise.all([
        readFile(oracleEntry, 'utf8'),
        ...sources.map(async (path) => await readFile(path, 'utf8')),
      ])
    ).join('\n');
    const imports = source
      .split('\n')
      .filter((line) => line.startsWith('import ') || line.startsWith('} from '))
      .join('\n');

    expect(imports).not.toMatch(
      /apps\/petrinaut|libs\/@hashintel\/petrinaut|create-optimization|optimizations-view|provider\.js/iu,
    );
    expect(source).not.toMatch(/FE-1162|9051|276e17d7|historical solution|merged reference/iu);
    expect(source).not.toMatch(/implementationPath|oraclePath|pluginPath|manifest\.(?:command|path)/u);
  });

  it.each([
    [
      'missing-route',
      {
        check: 'route-and-accessibility',
        pathname: '/processes/draft',
        expectedPathname: '/optimization',
        controlsReachable: true,
      } as const,
      'focused route missing',
    ],
    [
      'final-only',
      {
        check: 'progress-and-completion',
        progressiveTrialCount: 0,
        bestSoFarVisible: false,
        completionVisible: true,
      } as const,
      'progressive trials missing',
    ],
    [
      'direct-private-origin',
      {
        check: 'private-origin-secrecy',
        candidateOrigin: 'http://candidate.test',
        browserRequestUrls: ['http://candidate.test/optimization', 'http://optimizer.private/optimize/all'],
        domText: 'Optimizations',
        privateOrigin: 'http://optimizer.private',
      } as const,
      'browser contacted private origin',
    ],
    [
      'UI-only-cancel',
      {
        check: 'cancel-and-abort',
        cancelControlVisible: true,
        cancelledVisible: true,
        hostRequestAborted: false,
      } as const,
      'host request was not aborted',
    ],
  ])('%s rival fails its focused claim', (_name, observation, expectedFailure) => {
    expect(assessPetrinautFocusedObservation(observation)).toContain(expectedFailure);
  });
});

async function sourceFiles(root: string): Promise<string[]> {
  const files: string[] = [];
  for (const entry of await readdir(root, { withFileTypes: true })) {
    const path = join(root, entry.name);
    if (entry.isDirectory()) files.push(...(await sourceFiles(path)));
    else if (entry.isFile() && entry.name.endsWith('.ts')) files.push(path);
  }
  return files;
}
