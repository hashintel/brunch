import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  out: './drizzle',
  schema: './src/server/schema.ts',
  dialect: 'sqlite',
  dbCredentials: {
    url: process.env.BRUNCH_DB || './brunch.db',
  },
});
