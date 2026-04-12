#!/usr/bin/env node

import { launch } from './launcher.js';

launch(process.cwd()).catch((error) => {
  console.error('Failed to start brunch:', error);
  process.exit(1);
});
