import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { PETRINAUT_FOCUSED_PREPARATION } from '../petrinaut-optimization-oracle.js';
import { assessPetrinautFocusedObservation } from '../petrinaut-optimization-oracle/claims.js';
import { startDeterministicFakeOptimizer } from '../petrinaut-optimization-oracle/fake-optimizer.js';

const oracleRoot = fileURLToPath(new URL('../petrinaut-optimization-oracle/', import.meta.url));
const oracleEntry = fileURLToPath(new URL('../petrinaut-optimization-oracle.ts', import.meta.url));

describe('controller-owned Petrinaut optimization oracle boundary', () => {
  it('frames deterministic optimizer events as the upstream Optuna SSE contract', async () => {
    const fake = await startDeterministicFakeOptimizer();
    try {
      const response = await fetch(`${fake.origin}/optimize/all`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: 'source fidelity' }),
      });

      expect(response.headers.get('content-type')).toBe('text/event-stream');
      const stream = await response.text();
      expect(stream).toContain('data: {"step":0,"params":{"rate":4},"metric":12,"state":"COMPLETE"}');
      expect(stream).toContain('data: {"step":1,"params":{"rate":6},"metric":10,"state":"COMPLETE"}');
      expect(stream).toContain('event: done\ndata: {}');
    } finally {
      await fake.close();
    }
  });

  it('keeps the declared Refractive workspace build directly before Petrinaut UI', () => {
    expect(PETRINAUT_FOCUSED_PREPARATION).toEqual([
      {
        id: 'design-system-codegen',
        command: 'yarn',
        args: ['workspace', '@hashintel/ds-components', 'codegen'],
      },
      {
        id: 'design-system-build',
        command: 'yarn',
        args: ['workspace', '@hashintel/ds-components', 'build'],
      },
      {
        id: 'petrinaut-core-build',
        command: 'yarn',
        args: ['workspace', '@hashintel/petrinaut-core', 'build'],
      },
      {
        id: 'optimizer-client-build',
        command: 'yarn',
        args: ['workspace', '@local/petrinaut-optimizer-client', 'build'],
      },
      {
        id: 'refractive-build',
        command: 'yarn',
        args: ['workspace', '@hashintel/refractive', 'build'],
      },
      {
        id: 'petrinaut-ui-build',
        command: 'yarn',
        args: ['workspace', '@hashintel/petrinaut', 'build'],
      },
    ]);
  });

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

  it('keeps D138 mechanical interactions on declared or calibration-derived addresses', async () => {
    const browserSource = await readFile(join(oracleRoot, 'browser.ts'), 'utf8');
    expect(browserSource).toMatch(/mechanicalAddresses/u);
    expect(browserSource).toMatch(/locate\(page, addresses\.create\)/u);
    expect(browserSource).toMatch(/locate\(page, addresses\.metricCode\)/u);
    expect(browserSource).toMatch(/addresses\.scenarioSelected/u);
    expect(browserSource).toMatch(/addresses\.metricCustomOption/u);
    expect(browserSource).toMatch(/addresses\.optimizationName/u);
    expect(browserSource).toMatch(/parseCalibrationInputs/u);
    expect(browserSource).not.toMatch(/Create optimization/u);
    expect(browserSource).not.toMatch(/getByRole\('heading', \{ name: 'Optimizations'/u);
    expect(browserSource).not.toMatch(/getByRole\('tab', \{ name: 'Optimizations'/u);
    expect(browserSource).not.toMatch(/getByRole\('checkbox'/u);
    expect(browserSource).not.toMatch(/getByRole\('combobox'\)\.first/u);
    expect(browserSource).not.toMatch(
      /Seasonal Flu|High Virulence Outbreak|Optimize infected_ratio|Infected Fraction/u,
    );
    expect(browserSource).not.toMatch(/OPTIMIZATION_NAME_ADDRESS|CUSTOM_METRIC_OPTION/u);
  });

  it.each([
    [
      'missing-route',
      {
        check: 'route-and-accessibility',
        pathname: '/processes/draft',
        expectedPathname: '/optimization',
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
