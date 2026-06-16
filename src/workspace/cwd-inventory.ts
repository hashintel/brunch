import { readdir, readFile } from 'node:fs/promises';
import { basename, join, relative, resolve, sep } from 'node:path';

import { BRUNCH_DIR } from '../constants.js';
import { discoverProjectIdentity, type ProjectIdentity } from './project-identity.js';

export interface WorkspaceTopologyEntry {
  readonly name: string;
  readonly kind: 'file' | 'directory';
  readonly fileCount: number;
  readonly children?: readonly WorkspaceTopologyEntry[];
}

export interface WorkspaceCwdInventory {
  readonly status: 'ready';
  readonly cwd: string;
  readonly project: ProjectIdentity;
  readonly hasBrunchDir: boolean;
  readonly topology: WorkspaceTopologyEntry;
}

interface GitignoreRule {
  readonly negated: boolean;
  readonly directoryOnly: boolean;
  readonly rooted: boolean;
  readonly regex: RegExp;
}

const DEFAULT_IGNORED_TOP_LEVEL = new Set(['.git']);

export async function inspectWorkspaceCwdInventory(cwd: string): Promise<WorkspaceCwdInventory> {
  const resolvedCwd = resolve(cwd);
  const shouldIgnore = await createGitignoreMatcher(resolvedCwd);
  const project = await discoverProjectIdentity(resolvedCwd);
  const topology = await collectTopology(resolvedCwd, shouldIgnore);

  return {
    status: 'ready',
    cwd: resolvedCwd,
    project,
    hasBrunchDir: topology.children?.some((entry) => entry.name === BRUNCH_DIR) ?? false,
    topology,
  };
}

async function countVisibleFiles(
  directory: string,
  cwd: string,
  shouldIgnore: (relativePath: string, isDirectory: boolean) => boolean,
): Promise<number> {
  let fileCount = 0;
  const entries = await readdir(directory, { withFileTypes: true });

  for (const entry of entries) {
    const path = join(directory, entry.name);
    const relativePath = toRelativePath(cwd, path);
    if (shouldIgnore(relativePath, entry.isDirectory())) {
      continue;
    }
    fileCount += entry.isDirectory() ? await countVisibleFiles(path, cwd, shouldIgnore) : 1;
  }

  return fileCount;
}

async function collectTopology(
  cwd: string,
  shouldIgnore: (relativePath: string, isDirectory: boolean) => boolean,
): Promise<WorkspaceTopologyEntry> {
  return {
    name: '.',
    kind: 'directory',
    fileCount: await countVisibleFiles(cwd, cwd, shouldIgnore),
    children: await collectTopologyChildren(cwd, cwd, shouldIgnore, 0),
  };
}

async function collectTopologyChildren(
  directory: string,
  cwd: string,
  shouldIgnore: (relativePath: string, isDirectory: boolean) => boolean,
  depth: number,
): Promise<WorkspaceTopologyEntry[]> {
  if (depth >= 2) {
    return [];
  }

  const entries = await readdir(directory, { withFileTypes: true });
  const topologyEntries: WorkspaceTopologyEntry[] = [];

  for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
    const path = join(directory, entry.name);
    const relativePath = toRelativePath(cwd, path);
    if (DEFAULT_IGNORED_TOP_LEVEL.has(entry.name) && directory === cwd) {
      continue;
    }
    if (shouldIgnore(relativePath, entry.isDirectory())) {
      continue;
    }

    if (entry.isDirectory()) {
      const fileCount = await countVisibleFiles(path, cwd, shouldIgnore);
      const children =
        depth < 1 ? await collectTopologyChildren(path, cwd, shouldIgnore, depth + 1) : undefined;
      topologyEntries.push({
        name: entry.name,
        kind: 'directory',
        fileCount,
        ...(children ? { children } : {}),
      });
      continue;
    }

    if (isMarkdownLike(path)) {
      topologyEntries.push({ name: entry.name, kind: 'file', fileCount: 1 });
    }
  }

  return topologyEntries;
}

async function createGitignoreMatcher(
  cwd: string,
): Promise<(relativePath: string, isDirectory: boolean) => boolean> {
  const gitignorePath = join(cwd, '.gitignore');
  try {
    const content = await readFile(gitignorePath, 'utf8');
    const rules = content
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0 && !line.startsWith('#'))
      .map(parseGitignoreRule);

    return (relativePath, isDirectory) => {
      const normalizedPath = normalizeRelativePath(relativePath);
      let ignored = false;
      for (const rule of rules) {
        if (rule.directoryOnly && !isDirectory) {
          continue;
        }
        const candidates = rule.rooted ? [normalizedPath] : [normalizedPath, basename(normalizedPath)];
        if (!candidates.some((candidate) => rule.regex.test(candidate))) {
          continue;
        }
        ignored = !rule.negated;
      }
      return ignored;
    };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return () => false;
    }
    throw error;
  }
}

function parseGitignoreRule(pattern: string): GitignoreRule {
  const negated = pattern.startsWith('!');
  const rawPattern = negated ? pattern.slice(1) : pattern;
  const directoryOnly = rawPattern.endsWith('/');
  const normalized = directoryOnly ? rawPattern.slice(0, -1) : rawPattern;
  const rooted = normalized.startsWith('/');
  const body = rooted ? normalized.slice(1) : normalized;

  return {
    negated,
    directoryOnly,
    rooted,
    regex: globToRegExp(body),
  };
}

function globToRegExp(glob: string): RegExp {
  const escaped = glob
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*\*/g, '::DOUBLE_STAR::')
    .replace(/\*/g, '[^/]*')
    .replace(/::DOUBLE_STAR::/g, '.*')
    .replace(/\?/g, '[^/]');
  return new RegExp(`^${escaped}$`);
}

function toRelativePath(cwd: string, path: string): string {
  return normalizeRelativePath(relative(cwd, path));
}

function normalizeRelativePath(path: string): string {
  return path.split(sep).join('/');
}

function isMarkdownLike(path: string): boolean {
  const name = basename(path).toLowerCase();
  return name.endsWith('.md') || name === 'readme' || name.startsWith('readme.');
}
