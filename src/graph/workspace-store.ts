import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';

import { createDb } from '../db/connection.js';
import { CommandExecutor } from './command-executor.js';

const BRUNCH_DIR = '.brunch';
const DATA_DB_FILE = 'data.db';

export async function openWorkspaceCommandExecutor(cwd: string): Promise<CommandExecutor> {
  const brunchDir = join(cwd, BRUNCH_DIR);
  await mkdir(brunchDir, { recursive: true });
  return new CommandExecutor(createDb(join(brunchDir, DATA_DB_FILE)));
}
