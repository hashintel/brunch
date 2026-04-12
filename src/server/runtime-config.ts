import { resolveBrunchProject } from './project.js';

export function resolveConfiguredDbPath(configuredPath: string | undefined, cwd: string): string {
  const normalizedPath = configuredPath?.trim();
  return normalizedPath ? normalizedPath : resolveBrunchProject(cwd).dbPath;
}
