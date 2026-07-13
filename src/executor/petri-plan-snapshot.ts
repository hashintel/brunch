import { readFile, rename, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { runDirPath } from './run.js';

export function petriPlanSnapshotPath(cwd: string, runId: string): string {
  return join(runDirPath(cwd, runId), 'petrinaut', 'plan.json');
}

export async function readPetriPlanSnapshot(cwd: string, runId: string): Promise<string | undefined> {
  try {
    return await readFile(petriPlanSnapshotPath(cwd, runId), 'utf8');
  } catch {
    return undefined;
  }
}

export async function freezePetriPlanSnapshot(args: {
  readonly cwd: string;
  readonly runId: string;
  readonly sourcePath: string;
}): Promise<string> {
  const existing = await readPetriPlanSnapshot(args.cwd, args.runId);
  if (existing !== undefined) return existing;
  const content = await readFile(args.sourcePath, 'utf8');
  const path = petriPlanSnapshotPath(args.cwd, args.runId);
  const tempPath = `${path}.tmp`;
  await rm(tempPath, { force: true });
  await writeFile(tempPath, content, { encoding: 'utf8', flag: 'wx' });
  try {
    await rename(tempPath, path);
  } catch (error) {
    await rm(tempPath, { force: true });
    const raced = await readPetriPlanSnapshot(args.cwd, args.runId);
    if (raced !== undefined) return raced;
    throw error;
  }
  return content;
}
