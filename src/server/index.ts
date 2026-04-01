import { createApp } from './app.js';

const PORT = process.env.PORT || 3000;
const DB_PATH = process.env.BRUNCH_DB || './brunch.db';

const { app } = createApp(DB_PATH);

app.listen(PORT, () => {
  console.log(`Brunch server listening on http://localhost:${PORT}`);
  console.log(`Database: ${DB_PATH}`);
});
