// Writes dist/build-info.json during `npm run build`.
//
// Dev builds (default) bake in the git sha and UTC build time so the TUI can
// show a truthful `(dev <sha> @ <built-at>)` marker. Release builds
// (RELEASE=true, set by the prepack script) emit `dev: false` with no
// metadata, so published installs show the bare version.
import { execSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';

const isRelease = process.env.RELEASE === 'true';

/** @param {Date} date */
function formatUtcBuildTime(date) {
  // toISOString is always UTC; keep the explicit suffix so the TUI displays it as such.
  return date
    .toISOString()
    .replace('T', ' ')
    .replace(/\.\d+Z$/, ' UTC');
}

function getGitSha() {
  try {
    return execSync('git rev-parse --short=7 HEAD', {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    return '';
  }
}

const buildInfo = {
  dev: !isRelease,
  gitSha: isRelease ? '' : getGitSha(),
  buildTime: isRelease ? '' : formatUtcBuildTime(new Date()),
};

mkdirSync('dist', { recursive: true });
writeFileSync('dist/build-info.json', `${JSON.stringify(buildInfo, null, 2)}\n`);
