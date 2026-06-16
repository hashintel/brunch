import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { BRUNCH_DIR, STATE_FILE, STATE_SCHEMA_VERSION } from '../constants.js';
import { discoverProjectIdentity } from './project-identity.js';

export interface WorkspaceProjectState {
  name: string;
  slug: string;
}

export interface WorkspacePostureState {
  certainty: string;
  stakes: string;
  audience: string;
  horizon: string;
  migration: string;
  sourcing: string;
}

export interface WorkspaceDefaultState {
  specId: number;
  sessionId: string;
}

export interface WorkspaceStateFile {
  schemaVersion: 1;
  project: WorkspaceProjectState;
  defaults: WorkspaceDefaultState | null;
  posture: WorkspacePostureState;
}

export async function readWorkspaceState(cwd: string): Promise<WorkspaceStateFile | null> {
  try {
    const parsed = JSON.parse(await readFile(statePath(cwd), 'utf8')) as Partial<WorkspaceStateFile>;
    if (
      parsed.schemaVersion === STATE_SCHEMA_VERSION &&
      isProjectState(parsed.project) &&
      (parsed.defaults === null || isDefaultState(parsed.defaults)) &&
      isPostureState(parsed.posture)
    ) {
      return parsed as WorkspaceStateFile;
    }
    return null;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return null;
    }
    throw error;
  }
}

export async function readOrCreateWorkspaceState(cwd: string): Promise<WorkspaceStateFile> {
  const existing = await readWorkspaceState(cwd);
  if (existing) return existing;
  const identity = await discoverProjectIdentity(cwd);
  const state: WorkspaceStateFile = {
    schemaVersion: STATE_SCHEMA_VERSION,
    project: { name: identity.name, slug: identity.slug },
    defaults: null,
    posture: emptyWorkspacePosture(),
  };
  await writeWorkspaceState(cwd, state);
  return state;
}

export async function writeWorkspaceDefaults(
  cwd: string,
  specId: number,
  defaultSessionId: string,
): Promise<void> {
  const existing = await readOrCreateWorkspaceState(cwd);
  await writeWorkspaceState(cwd, {
    ...existing,
    defaults: { specId, sessionId: defaultSessionId },
  });
}

async function writeWorkspaceState(cwd: string, state: WorkspaceStateFile): Promise<void> {
  await mkdir(brunchDir(cwd), { recursive: true });
  await writeFile(statePath(cwd), `${JSON.stringify(state, null, 2)}\n`, 'utf8');
}

function brunchDir(cwd: string): string {
  return join(cwd, BRUNCH_DIR);
}

function statePath(cwd: string): string {
  return join(brunchDir(cwd), STATE_FILE);
}

function isProjectState(value: unknown): value is WorkspaceProjectState {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as { name?: unknown }).name === 'string' &&
    typeof (value as { slug?: unknown }).slug === 'string'
  );
}

function isDefaultState(value: unknown): value is WorkspaceDefaultState {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as { specId?: unknown }).specId === 'number' &&
    Number.isInteger((value as { specId: number }).specId) &&
    typeof (value as { sessionId?: unknown }).sessionId === 'string'
  );
}

function isPostureState(value: unknown): value is WorkspacePostureState {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as { certainty?: unknown }).certainty === 'string' &&
    typeof (value as { stakes?: unknown }).stakes === 'string' &&
    typeof (value as { audience?: unknown }).audience === 'string' &&
    typeof (value as { horizon?: unknown }).horizon === 'string' &&
    typeof (value as { migration?: unknown }).migration === 'string' &&
    typeof (value as { sourcing?: unknown }).sourcing === 'string'
  );
}

function emptyWorkspacePosture(): WorkspacePostureState {
  return { certainty: '', stakes: '', audience: '', horizon: '', migration: '', sourcing: '' };
}
