import { existsSync, mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, parse } from 'node:path';

const BRUNCH_DIR = '.brunch';
const DB_FILENAME = 'brunch.db';
const MAX_WALK_UP = 5;

export interface BrunchProject {
  root: string;
  dbPath: string;
  cwd: string;
}

function toBrunchProject(brunchDir: string, cwd: string): BrunchProject {
  return {
    root: brunchDir,
    dbPath: join(brunchDir, DB_FILENAME),
    cwd,
  };
}

function isStopDirectory(dir: string): boolean {
  const home = homedir();
  const { root } = parse(dir);
  return dir === root || dir === home;
}

export function findBrunchProject(startDir: string): BrunchProject | null {
  let current = startDir;

  for (let i = 0; i <= MAX_WALK_UP; i++) {
    const candidate = join(current, BRUNCH_DIR);
    if (existsSync(candidate)) {
      return toBrunchProject(candidate, current);
    }

    if (isStopDirectory(current)) {
      return null;
    }

    const parent = dirname(current);
    if (parent === current) {
      return null;
    }
    current = parent;
  }

  return null;
}

export function initBrunchProject(cwd: string): BrunchProject {
  const brunchDir = join(cwd, BRUNCH_DIR);
  if (existsSync(brunchDir)) {
    throw new Error(`.brunch/ already exists in ${cwd}`);
  }
  mkdirSync(brunchDir, { recursive: true });
  return toBrunchProject(brunchDir, cwd);
}

export function resolveBrunchProject(cwd: string): BrunchProject {
  const existing = findBrunchProject(cwd);
  if (existing) {
    return existing;
  }
  return initBrunchProject(cwd);
}
