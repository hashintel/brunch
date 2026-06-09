import { readdir, readFile } from 'node:fs/promises';
import { basename, join, relative, resolve, sep } from 'node:path';

import { openWorkspaceGraphRuntime, type ReadinessGrade } from '../graph/index.js';
import { inspectCanonicalSessionFiles } from './workspace-session-coordinator/boot-session-store.js';

interface WorkspaceSessionFileInventory {
  readonly file: string;
  readonly lineCount: number;
  readonly byteCount: number;
}

interface WorkspaceTreeEntryInventory {
  readonly name: string;
  readonly kind: 'file' | 'directory';
  readonly fileCount: number;
}

interface WorkspaceMarkdownFileInventory {
  readonly path: string;
  readonly lineCount: number;
  readonly byteCount: number;
}

export interface WorkspaceCwdInventory {
  readonly status: 'ready';
  readonly cwd: string;
  readonly hasBrunchDir: boolean;
  readonly sessionFiles: readonly WorkspaceSessionFileInventory[];
  readonly topLevelEntries: readonly WorkspaceTreeEntryInventory[];
  readonly markdownFiles: readonly WorkspaceMarkdownFileInventory[];
}

interface WorkspaceSpecOverview {
  readonly id: number;
  readonly title: string;
  readonly nodeCount: number;
  readonly sessionCount: number;
}

interface WorkspaceSessionOverview {
  readonly id: string;
  readonly file: string;
  readonly specId: number;
  readonly specTitle: string;
  readonly turnCount: number;
  readonly readinessGrade: ReadinessGrade;
}

export interface WorkspaceOverview {
  readonly status: 'ready';
  readonly cwd: string;
  readonly specs: readonly WorkspaceSpecOverview[];
  readonly sessions: readonly WorkspaceSessionOverview[];
}

interface GitignoreRule {
  readonly negated: boolean;
  readonly directoryOnly: boolean;
  readonly rooted: boolean;
  readonly regex: RegExp;
}

const BRUNCH_DIR = '.brunch';
const DEFAULT_IGNORED_TOP_LEVEL = new Set(['.git']);

export async function inspectWorkspaceCwdInventory(cwd: string): Promise<WorkspaceCwdInventory> {
  const resolvedCwd = resolve(cwd);
  const shouldIgnore = await createGitignoreMatcher(resolvedCwd);
  const topLevelEntries = await collectTopLevelEntries(resolvedCwd, shouldIgnore);
  const markdownFiles = await collectMarkdownFiles(resolvedCwd, shouldIgnore);
  const sessionFiles = await collectSessionFiles(resolvedCwd);

  return {
    status: 'ready',
    cwd: resolvedCwd,
    hasBrunchDir: topLevelEntries.some((entry) => entry.name === BRUNCH_DIR),
    sessionFiles,
    topLevelEntries,
    markdownFiles,
  };
}

export async function inspectWorkspaceOverview(cwd: string): Promise<WorkspaceOverview> {
  const resolvedCwd = resolve(cwd);
  const graph = await openWorkspaceGraphRuntime(resolvedCwd);
  const specs = graph.commandExecutor
    .listSpecs()
    .map((spec) => ({
      id: spec.id,
      title: spec.name,
      readinessGrade: spec.readinessGrade,
      nodeCount: graph.forSpec(spec.id).queryGraph().nodes.length,
    }))
    .sort((left, right) => left.title.localeCompare(right.title));
  const specsById = new Map(specs.map((spec) => [spec.id, spec]));
  const sessions = await inspectCanonicalSessionFiles(resolvedCwd);
  const availableSessions = await Promise.all(
    sessions
      .filter((session) => session.available)
      .map(async (session) => {
        const spec = specsById.get(session.specId);
        if (!spec) {
          return null;
        }
        const entries = await readJsonl(session.file);
        return {
          id: session.id,
          file: basename(session.file),
          specId: session.specId,
          specTitle: spec.title,
          turnCount: countTurnEntries(entries),
          readinessGrade: spec.readinessGrade,
        } satisfies WorkspaceSessionOverview;
      }),
  );
  const sessionsBySpecId = new Map<number, number>();
  const visibleSessions = availableSessions
    .filter((session): session is WorkspaceSessionOverview => session != null)
    .sort((left, right) => left.file.localeCompare(right.file));

  for (const session of visibleSessions) {
    sessionsBySpecId.set(session.specId, (sessionsBySpecId.get(session.specId) ?? 0) + 1);
  }

  return {
    status: 'ready',
    cwd: resolvedCwd,
    specs: specs.map((spec) => ({
      id: spec.id,
      title: spec.title,
      nodeCount: spec.nodeCount,
      sessionCount: sessionsBySpecId.get(spec.id) ?? 0,
    })),
    sessions: visibleSessions,
  };
}

async function collectTopLevelEntries(
  cwd: string,
  shouldIgnore: (relativePath: string, isDirectory: boolean) => boolean,
): Promise<WorkspaceTreeEntryInventory[]> {
  const entries = await readdir(cwd, { withFileTypes: true });
  const inventories: WorkspaceTreeEntryInventory[] = [];

  for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
    if (DEFAULT_IGNORED_TOP_LEVEL.has(entry.name)) {
      continue;
    }

    const relativePath = entry.name;
    if (shouldIgnore(relativePath, entry.isDirectory())) {
      continue;
    }

    const fileCount = entry.isDirectory()
      ? await countVisibleFiles(join(cwd, entry.name), cwd, shouldIgnore)
      : 1;

    inventories.push({
      name: entry.name,
      kind: entry.isDirectory() ? 'directory' : 'file',
      fileCount,
    });
  }

  return inventories;
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

async function collectMarkdownFiles(
  cwd: string,
  shouldIgnore: (relativePath: string, isDirectory: boolean) => boolean,
): Promise<WorkspaceMarkdownFileInventory[]> {
  const inventories: WorkspaceMarkdownFileInventory[] = [];
  await walkVisibleFiles(cwd, cwd, shouldIgnore, async (filePath) => {
    if (!isMarkdownLike(filePath)) {
      return;
    }
    const content = await readFile(filePath, 'utf8');
    inventories.push({
      path: toRelativePath(cwd, filePath),
      lineCount: countLines(content),
      byteCount: Buffer.byteLength(content),
    });
  });
  return inventories.sort((left, right) => left.path.localeCompare(right.path));
}

async function walkVisibleFiles(
  directory: string,
  cwd: string,
  shouldIgnore: (relativePath: string, isDirectory: boolean) => boolean,
  onFile: (filePath: string) => Promise<void>,
): Promise<void> {
  const entries = await readdir(directory, { withFileTypes: true });
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
      await walkVisibleFiles(path, cwd, shouldIgnore, onFile);
      continue;
    }
    await onFile(path);
  }
}

async function collectSessionFiles(cwd: string): Promise<WorkspaceSessionFileInventory[]> {
  const sessions = await inspectCanonicalSessionFiles(cwd);
  const inventories: WorkspaceSessionFileInventory[] = [];
  for (const session of sessions) {
    const content = await readFile(session.file, 'utf8');
    inventories.push({
      file: basename(session.file),
      lineCount: countLines(content),
      byteCount: Buffer.byteLength(content),
    });
  }
  return inventories.sort((left, right) => left.file.localeCompare(right.file));
}

async function readJsonl(file: string): Promise<unknown[]> {
  const content = await readFile(file, 'utf8');
  return content
    .split('\n')
    .filter((line) => line.trim().length > 0)
    .map((line) => JSON.parse(line) as unknown);
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

function countLines(content: string): number {
  if (content.length === 0) {
    return 0;
  }
  return content.split(/\r?\n/).length;
}

function countTurnEntries(entries: readonly unknown[]): number {
  return entries.filter((entry) => {
    const type = (entry as { type?: unknown }).type;
    return type === 'user' || type === 'assistant';
  }).length;
}
