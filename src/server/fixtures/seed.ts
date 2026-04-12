import { createDb } from '../db.js';
import { allScenarios, scenarioNames } from './scenarios.js';

const args = process.argv.slice(2);
const scenarioName = args[0];
const dbPath = args[1] ?? './brunch.db';

if (!scenarioName || !allScenarios[scenarioName]) {
  console.error(scenarioName ? `Unknown scenario: ${scenarioName}` : 'Usage: seed <scenario> [db-path]');
  console.error(`\nAvailable scenarios:\n${scenarioNames.map((n) => `  - ${n}`).join('\n')}`);
  process.exit(1);
}

const db = createDb(dbPath);
const projectId = allScenarios[scenarioName](db);
console.log(`Seeded "${scenarioName}" → project ${projectId} in ${dbPath}`);
