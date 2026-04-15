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

  if (!scenarioName) {
    io.error('Usage: seed <scenario|--all> [db-path]');
    io.error(`\nAvailable scenarios:\n${publicScenarioNames.map((name) => `  - ${name}`).join('\n')}`);
    return 1;
  }

  if (scenarioName === '--all') {
    const db = createDb(dbPath);
    try {
      for (const name of publicScenarioNames) {
        const projectId = publicScenarios[name](db);
        io.log(`Seeded "${name}" → project ${projectId}`);
      }
      io.log(`\nAll ${publicScenarioNames.length} scenarios seeded in ${dbPath}`);
      return 0;
    } finally {
      db.$client.close();
    }
  }

  if (!publicScenarios[scenarioName]) {
    io.error(`Unknown scenario: ${scenarioName}`);
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
