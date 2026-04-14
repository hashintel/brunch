import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { createDb } from '../db.js';
import { resolveConfiguredDbPath } from '../runtime-config.js';
import { publicScenarios, publicScenarioNames } from './scenarios.js';

type SeedCliIo = Pick<typeof console, 'log' | 'error'>;

export function runSeedCli(
  args: string[],
  io: SeedCliIo = console,
  cwd: string = process.cwd(),
  configuredDbPath: string | undefined = process.env.BRUNCH_DB,
): number {
  const scenarioName = args[0];
  const explicitDbPath = args[1]?.trim();
  const dbPath = explicitDbPath || resolveConfiguredDbPath(configuredDbPath, cwd);

  if (!scenarioName || !publicScenarios[scenarioName]) {
    io.error(scenarioName ? `Unknown scenario: ${scenarioName}` : 'Usage: seed <scenario> [db-path]');
    io.error(`\nAvailable scenarios:\n${publicScenarioNames.map((name) => `  - ${name}`).join('\n')}`);
    return 1;
  }

  const db = createDb(dbPath);
  try {
    const projectId = publicScenarios[scenarioName](db);
    io.log(`Seeded "${scenarioName}" → project ${projectId} in ${dbPath}`);
    return 0;
  } finally {
    db.$client.close();
  }
}

const isMainModule =
  process.argv[1] != null && resolve(fileURLToPath(import.meta.url)) === resolve(process.argv[1]);

if (isMainModule) {
  process.exit(runSeedCli(process.argv.slice(2)));
}
