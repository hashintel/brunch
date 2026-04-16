import { createApp } from './app.js';
import { listenOnLocalhost, resolveBackendPort, resolveConfiguredDbPath } from './runtime-config.js';

const DB_PATH = process.env.BRUNCH_DB;

// In dev mode, use BRUNCH_DB env var if set to a non-empty value, otherwise resolve .brunch/ project
const projectCwd = process.cwd();
const dbPath = resolveConfiguredDbPath(DB_PATH, projectCwd);
const port = resolveBackendPort(process.env);

const { app } = createApp({ dbPath, projectCwd });

void listenOnLocalhost(app, port)
  .then(({ url }) => {
    console.log(`Brunch server listening on ${url}`);
    console.log(`Database: ${dbPath}`);
  })
  .catch((error) => {
    console.error('Failed to start brunch server:', error);
    process.exit(1);
  });
