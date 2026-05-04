import { createApp } from './app.js';
import {
  listenOnLocalhost,
  loadLocalEnvFile,
  resolveBackendPort,
  resolveConfiguredDbPath,
} from './runtime-config.js';

// In dev mode, use BRUNCH_DB env var if set to a non-empty value, otherwise resolve .brunch/ project
const projectCwd = process.cwd();
loadLocalEnvFile(projectCwd);

const DB_PATH = process.env.BRUNCH_DB;
const dbPath = resolveConfiguredDbPath(DB_PATH, projectCwd);
const port = resolveBackendPort(process.env);

void (async () => {
  try {
    const { app } = await createApp({ dbPath, projectCwd });
    const { url } = await listenOnLocalhost(app, port);
    console.log(`Brunch server listening on ${url}`);
    console.log(`Database: ${dbPath}`);
  } catch (error) {
    console.error('Failed to start brunch server:', error);
    process.exit(1);
  }
})();
