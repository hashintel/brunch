import { defineConfig } from 'drizzle-kit';

import { WORKSPACE_DB_FILENAME } from './src/constants.js';

export default defineConfig({
  out: './drizzle',
  schema: './src/db/schema.ts',
  dialect: 'sqlite',
  dbCredentials: {
    url: process.env.BRUNCH_DB?.trim() || `./.brunch/${WORKSPACE_DB_FILENAME}`,
  },
});
