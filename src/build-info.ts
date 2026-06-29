import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const PACKAGE_ROOT_URL = new URL('../', import.meta.url);
const BUILD_INFO_URL = new URL('./build-info.json', import.meta.url);

export interface BrunchBuildInfo {
  readonly dev: boolean;
  readonly gitSha: string;
  readonly buildTime: string;
}

export function isBrunchDevelopmentRuntime(): boolean {
  return resolveBrunchBuildInfo().dev;
}

export function resolveBrunchBuildInfo(): BrunchBuildInfo {
  const buildInfo = readBuildInfo();
  if (buildInfo) {
    return buildInfo;
  }
  return {
    dev: true,
    gitSha: getGitSha(),
    buildTime: formatUtcBuildTime(new Date()),
  };
}

export function formatUtcBuildTime(date: Date): string {
  // toISOString is always UTC; keep the explicit suffix so it displays as such.
  return date
    .toISOString()
    .replace('T', ' ')
    .replace(/\.\d+Z$/, ' UTC');
}

function readBuildInfo(): BrunchBuildInfo | null {
  try {
    const raw = JSON.parse(readFileSync(fileURLToPath(BUILD_INFO_URL), 'utf8')) as Partial<BrunchBuildInfo>;
    return {
      dev: raw.dev === true,
      gitSha: typeof raw.gitSha === 'string' ? raw.gitSha : '',
      buildTime: typeof raw.buildTime === 'string' ? raw.buildTime : '',
    };
  } catch {
    return null;
  }
}

function getGitSha(): string {
  try {
    return execSync('git rev-parse --short=7 HEAD', {
      cwd: fileURLToPath(PACKAGE_ROOT_URL),
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    return '';
  }
}
