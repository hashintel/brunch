import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import type { BrunchVersionInfo } from './brunch-identity.js';

// Single source of truth for the TUI's version + dev-build marker. The startup
// header and the workspace dialog both render this, so they must derive "is
// this a dev build" the same way — never from `package.json` `private`/version
// heuristics, which silently break once the package ships a real version.
const PACKAGE_ROOT_URL = new URL('../../../', import.meta.url);
const PACKAGE_JSON_URL = new URL('package.json', PACKAGE_ROOT_URL);
// Written by scripts/write-build-info.mjs during `npm run build`. Resolves to
// dist/build-info.json when running compiled output; from source (tsx, vitest)
// it points at src/build-info.json, which never exists.
const BUILD_INFO_URL = new URL('../../build-info.json', import.meta.url);

interface PackageJson {
  version?: unknown;
}

interface BuildInfo {
  dev: boolean;
  gitSha: string;
  buildTime: string;
}

/**
 * Resolve the version line + dev marker. Compiled output ships build-info.json
 * (dev for local builds, `dev: false` for `RELEASE=true` builds). Running
 * straight from source (tsx, vitest) has no build-info; sha and build time are
 * computed live, which is accurate since the source is transpiled at launch.
 */
export function resolveBrunchVersion(): BrunchVersionInfo {
  const pkg = readPackage();
  const version = typeof pkg.version === 'string' ? pkg.version : '0.0.0';
  const buildInfo = readBuildInfo() ?? {
    dev: true,
    gitSha: getGitSha(),
    buildTime: formatUtcBuildTime(new Date()),
  };
  if (!buildInfo.dev) return { version: `v${version}`, dev: null };

  const devMeta = [buildInfo.gitSha, buildInfo.buildTime ? `@ ${buildInfo.buildTime}` : '']
    .filter(Boolean)
    .join(' ');
  return { version: `v${version}`, dev: devMeta ? `(dev ${devMeta})` : '(dev)' };
}

function formatUtcBuildTime(date: Date): string {
  // toISOString is always UTC; keep the explicit suffix so it displays as such.
  return date
    .toISOString()
    .replace('T', ' ')
    .replace(/\.\d+Z$/, ' UTC');
}

function readPackage(): PackageJson {
  try {
    return JSON.parse(readFileSync(fileURLToPath(PACKAGE_JSON_URL), 'utf8')) as PackageJson;
  } catch {
    return {};
  }
}

function readBuildInfo(): BuildInfo | null {
  try {
    const raw = JSON.parse(readFileSync(fileURLToPath(BUILD_INFO_URL), 'utf8')) as Partial<BuildInfo>;
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
