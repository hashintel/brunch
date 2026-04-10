import { createDb } from '../db.js';
import { scenarioNames, scenarios } from './scenarios.js';

const args = process.argv.slice(2);
const scenarioName = args[0];
const dbPath = args[1] ?? './brunch.db';

if (!scenarioName || !scenarios[scenarioName]) {
  console.error(scenarioName ? `Unknown scenario: ${scenarioName}` : 'Usage: seed <scenario> [db-path]');
  console.error(`\nAvailable scenarios:\n${scenarioNames.map((n) => `  - ${n}`).join('\n')}`);
  process.exit(1);
}

const db = createDb(dbPath);
const projectId = scenarios[scenarioName](db);
console.log(`Seeded "${scenarioName}" → project ${projectId} in ${dbPath}`);
