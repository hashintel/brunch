import { createApp } from './app.js';
import { resolveBrunchProject } from './project.js';

const PORT = process.env.PORT || 3000;
const DB_PATH = process.env.BRUNCH_DB;

// In dev mode, use BRUNCH_DB env var if set, otherwise resolve .brunch/ project
const dbPath = DB_PATH ?? resolveBrunchProject(process.cwd()).dbPath;

const { app } = createApp(dbPath);

app.listen(PORT, () => {
  console.log(`Brunch server listening on http://localhost:${PORT}`);
  console.log(`Database: ${dbPath}`);
});
