import { readFile } from 'node:fs/promises';
import { basename, join } from 'node:path';

 type ProjectIdentitySource = 'package.json' | 'pyproject.toml' | 'cargo.toml' | 'go.mod' | 'directory';

export interface ProjectIdentity {
  /** Human-facing project name, as written in the source artifact. */
  name: string;
  /** Stable, filesystem/URL-safe identifier derived from `name`. */
  slug: string;
  /** Which artifact in `cwd` produced `name`. */
  source: ProjectIdentitySource;
}

/**
 * Discover the identity of the project rooted at `cwd`.
 *
 * The search is intentionally shallow — only files directly in `cwd` are
 * consulted, and the directory basename is the final fallback. Brunch treats
 * the launch directory as the project boundary and does not support monorepo
 * walking; users working in a monorepo should launch the tool inside the
 * sub-package they intend to work on.
 *
 * Precedence (first hit wins):
 *   1. package.json   — `name` field
 *   2. pyproject.toml — `[project].name` or `[tool.poetry].name`
 *   3. Cargo.toml     — `[package].name`
 *   4. go.mod         — final segment of the `module` directive
 *   5. directory basename
 */
export async function discoverProjectIdentity(cwd: string): Promise<ProjectIdentity> {
  const detectors: Array<() => Promise<DetectedName<ProjectIdentitySource> | null>> = [
    () => readPackageJsonName(cwd),
    () => readPyprojectName(cwd),
    () => readCargoTomlName(cwd),
    () => readGoModName(cwd),
  ];

  for (const detect of detectors) {
    const hit = await detect();
    if (hit) return { name: hit.name, slug: slugify(hit.name), source: hit.source };
  }

  const name = basename(cwd);
  return { name, slug: slugify(name), source: 'directory' };
}

/**
 * Normalize a project name into a stable slug suitable for filenames, URL
 * path segments, and persistent identifiers.
 *
 * - Lowercased.
 * - Non-alphanumeric runs collapse to a single `-`.
 * - Leading and trailing `-` trimmed.
 * - Empty input returns `"project"` so callers always get a non-empty slug.
 */
export function slugify(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug.length > 0 ? slug : 'project';
}

async function readFileOrNull(path: string): Promise<string | null> {
  try {
    return await readFile(path, 'utf8');
  } catch {
    return null;
  }
}

interface DetectedName<S extends ProjectIdentitySource> {
  name: string;
  source: S;
}

async function readPackageJsonName(cwd: string): Promise<DetectedName<'package.json'> | null> {
  const raw = await readFileOrNull(join(cwd, 'package.json'));
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as { name?: unknown };
    if (typeof parsed.name === 'string' && parsed.name.trim().length > 0) {
      return { name: parsed.name.trim(), source: 'package.json' };
    }
  } catch {
    // Malformed package.json — skip this signal rather than throwing.
  }
  return null;
}

async function readPyprojectName(cwd: string): Promise<DetectedName<'pyproject.toml'> | null> {
  const raw = await readFileOrNull(join(cwd, 'pyproject.toml'));
  if (!raw) return null;
  const fromProject = extractTomlNameInTable(raw, 'project');
  if (fromProject) return { name: fromProject, source: 'pyproject.toml' };
  const fromPoetry = extractTomlNameInTable(raw, 'tool.poetry');
  if (fromPoetry) return { name: fromPoetry, source: 'pyproject.toml' };
  return null;
}

async function readCargoTomlName(cwd: string): Promise<DetectedName<'cargo.toml'> | null> {
  const raw = await readFileOrNull(join(cwd, 'Cargo.toml'));
  if (!raw) return null;
  const name = extractTomlNameInTable(raw, 'package');
  return name ? { name, source: 'cargo.toml' } : null;
}

async function readGoModName(cwd: string): Promise<DetectedName<'go.mod'> | null> {
  const raw = await readFileOrNull(join(cwd, 'go.mod'));
  if (!raw) return null;
  for (const rawLine of raw.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line.startsWith('module')) continue;
    const match = line.match(/^module\s+(\S+)/);
    const captured = match?.[1];
    if (!captured) continue;
    const modulePath = captured.replace(/^["']|["']$/g, '');
    const tail = modulePath.split('/').filter(Boolean).pop();
    if (tail && tail.length > 0) {
      return { name: tail, source: 'go.mod' };
    }
  }
  return null;
}

/**
 * Minimal TOML extraction: find `name = "..."` inside `[tableName]`, stopping
 * at the next top-level table header. Not a real TOML parser — sufficient for
 * the well-formed manifests we care about and cheaper than a dependency.
 */
function extractTomlNameInTable(content: string, tableName: string): string | null {
  const lines = content.split(/\r?\n/);
  const header = `[${tableName}]`;
  let inTable = false;
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (line.startsWith('#') || line.length === 0) continue;
    if (line.startsWith('[') && line.endsWith(']')) {
      inTable = line === header;
      continue;
    }
    if (!inTable) continue;
    const match = line.match(/^name\s*=\s*(["'])(.*?)\1/);
    const captured = match?.[2];
    if (captured && captured.length > 0) return captured;
  }
  return null;
}
