import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { resolveBrunchBuildInfo } from '../../build-info.js';
import type { BrunchVersionInfo } from './brunch-identity.js';

// Single source of truth for the TUI's version + dev-build marker. The startup
// header and the workspace dialog both render this, so they must derive "is
// this a dev build" the same way — never from `package.json` `private`/version
// heuristics, which silently break once the package ships a real version.
const PACKAGE_ROOT_URL = new URL('../../../', import.meta.url);
const PACKAGE_JSON_URL = new URL('package.json', PACKAGE_ROOT_URL);

interface PackageJson {
  version?: unknown;
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
  const buildInfo = resolveBrunchBuildInfo();
  if (!buildInfo.dev) return { version: `v${version}`, dev: null };

  const devMeta = [buildInfo.gitSha, buildInfo.buildTime ? `@ ${buildInfo.buildTime}` : '']
    .filter(Boolean)
    .join(' ');
  return { version: `v${version}`, dev: devMeta ? `(dev ${devMeta})` : '(dev)' };
}

function readPackage(): PackageJson {
  try {
    return JSON.parse(readFileSync(fileURLToPath(PACKAGE_JSON_URL), 'utf8')) as PackageJson;
  } catch {
    return {};
  }
}
