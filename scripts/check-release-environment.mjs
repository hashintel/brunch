#!/usr/bin/env node

import { pathToFileURL } from 'node:url';

export function releaseEnvironmentError(environment) {
  if (environment.GITHUB_ACTIONS !== 'true') {
    return 'Publishing is allowed only from GitHub Actions.';
  }
  if (environment.GITHUB_REPOSITORY !== 'hashintel/brunch') {
    return 'Publishing is allowed only from the hashintel/brunch repository.';
  }
  if (environment.GITHUB_REF_NAME !== 'next') {
    return 'Alpha publishing is allowed only from the next branch.';
  }
  if (!environment.ACTIONS_ID_TOKEN_REQUEST_URL || !environment.ACTIONS_ID_TOKEN_REQUEST_TOKEN) {
    return 'npm trusted publishing requires the GitHub Actions OIDC environment.';
  }
  return undefined;
}

function main() {
  const error = releaseEnvironmentError(process.env);
  if (error) {
    process.stderr.write(`${error}\n`);
    process.exitCode = 1;
    return;
  }
  process.stdout.write('Release environment OK — next branch with npm trusted publishing\n');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
