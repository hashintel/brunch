import { describe, expect, it } from 'vitest';

import { releaseEnvironmentError } from './check-release-environment.mjs';

const validEnvironment = {
  GITHUB_ACTIONS: 'true',
  GITHUB_REPOSITORY: 'hashintel/brunch',
  GITHUB_REF_NAME: 'next',
  ACTIONS_ID_TOKEN_REQUEST_URL: 'https://example.test/oidc',
  ACTIONS_ID_TOKEN_REQUEST_TOKEN: 'ephemeral-token',
};

describe('release environment guard', () => {
  it('accepts only the next-branch trusted-publishing workflow', () => {
    expect(releaseEnvironmentError(validEnvironment)).toBeUndefined();
  });

  it.each([
    ['a local process', { ...validEnvironment, GITHUB_ACTIONS: undefined }, 'GitHub Actions'],
    ['another repository', { ...validEnvironment, GITHUB_REPOSITORY: 'hashintel/hash' }, 'hashintel/brunch'],
    ['another branch', { ...validEnvironment, GITHUB_REF_NAME: 'main' }, 'next'],
    [
      'a workflow without npm OIDC',
      { ...validEnvironment, ACTIONS_ID_TOKEN_REQUEST_URL: undefined },
      'trusted publishing',
    ],
  ])('rejects %s', (_case, environment, expectedMessage) => {
    expect(releaseEnvironmentError(environment)).toContain(expectedMessage);
  });
});
