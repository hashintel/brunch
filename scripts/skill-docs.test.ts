import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

const lnPrReviewSkill = readFileSync(
  new URL('../.agents/skills/ln-pr-review/SKILL.md', import.meta.url),
  'utf8',
);

describe('ln-pr-review skill safety contract', () => {
  it('binds review commands to the selected PR identity', () => {
    expect(lnPrReviewSkill).toContain('Keep a full PR URL as the `<pr>` token');
    expect(lnPrReviewSkill).toContain('-R <owner/repo>');
  });

  it('stops instead of guessing when the review queue or PR load is empty', () => {
    expect(lnPrReviewSkill).toContain('If the list is empty, stop');
    expect(lnPrReviewSkill).toContain(
      'If any load command fails, if the PR target is ambiguous, or if the diff is unavailable or empty, stop',
    );
  });

  it('preserves formal review verdict semantics', () => {
    expect(lnPrReviewSkill).toContain('A request-changes verdict is a merge gate');
    expect(lnPrReviewSkill).toContain('gh pr review <pr> --approve');
    expect(lnPrReviewSkill).toContain('gh pr review <pr> --comment');
    expect(lnPrReviewSkill).toContain('gh pr review <pr> --request-changes');
    expect(lnPrReviewSkill).toContain('Do not use `gh pr comment`');
  });

  it('avoids heredoc truncation when writing review bodies', () => {
    expect(lnPrReviewSkill).toContain('Use your file-write/editor tool');
    expect(lnPrReviewSkill).not.toContain("<<'EOF'");
    expect(lnPrReviewSkill).not.toMatch(/cat\s*>\s*\/tmp\/prNNN-review\.md/);
  });
});
