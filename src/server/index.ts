import { createApp } from './app.js';
import { resolveConfiguredDbPath } from './runtime-config.js';

const PORT = process.env.PORT || 3000;
const DB_PATH = process.env.BRUNCH_DB;

// In dev mode, use BRUNCH_DB env var if set to a non-empty value, otherwise resolve .brunch/ project
const projectCwd = process.cwd();
const dbPath = resolveConfiguredDbPath(DB_PATH, projectCwd);

const { app } = createApp({ dbPath, projectCwd });

app.listen(PORT, () => {
  console.log(`Brunch server listening on http://localhost:${PORT}`);
  console.log(`Database: ${dbPath}`);
});
