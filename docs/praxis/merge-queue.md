# Merge queue & review-dismissal setup

Branch protection and merge-queue behavior for `hashintel/brunch` live in GitHub rulesets, not in this repo's tracked files. This doc records what's configured, why, and the known gap on `main`, so the setup is legible without querying the GitHub API.

## Ruleset landscape

Query with `gh api repos/hashintel/brunch/rulesets`. Two sources apply and **aggregate — the strictest rule from either source wins**; a repo ruleset cannot loosen an org ruleset.

| Ruleset | Source | Targets | Notes |
| --- | --- | --- | --- |
| Branch protection (deletion, non-fast-forward) | org (`hashintel`) | `~DEFAULT_BRANCH` | |
| Required approval (`pull_request` rule) | org | `~DEFAULT_BRANCH` | `dismiss_stale_reviews_on_push: true`, `require_last_push_approval: true` — see [Stale-review dismissal](#stale-review-dismissal-on-main) below |
| Preflight Checks (`required_status_checks`) | org | `~DEFAULT_BRANCH` | `Dependencies / Review`, `Todo comments / Scan`, `PR title / Linear Issue ID` |
| Linear History | org | `~DEFAULT_BRANCH` | |
| Signed commits, Reserved branch names, Tag protection | org | various | |
| Copilot Review | org | all branches | |
| Merge Queue (`merge_queue` rule) | repo (`hashintel/brunch`) | `~DEFAULT_BRANCH` | `merge_method: SQUASH`, `grouping_strategy: ALLGREEN` |

`~DEFAULT_BRANCH` resolves to `main` (the repo's default branch). **`next` — the current stacked-work integration trunk — had zero rulesets** before this change (only the all-branches Copilot rule applied). `.github/workflows/preflight.yml`'s `merge_group` trigger is branch-agnostic and already produces the three required-check contexts on any branch's queue, so nothing on the CI side needed to change — only the ruleset.

## `next` integration-trunk ruleset

Applied as a **repository-level** ruleset (repo admin required to create it — see [Applying](#applying)). Deliberately excludes an approval requirement: `next` is a fast-moving integration trunk, not a release branch, so the gate is "checks pass" not "checks pass and a human signed off." Includes a repo-admin bypass so maintenance pushes (e.g. syncing `next` from `main`) aren't blocked by the merge-queue rule.

```json
{
  "name": "next integration trunk",
  "target": "branch",
  "enforcement": "active",
  "conditions": {
    "ref_name": {
      "include": ["refs/heads/next"],
      "exclude": []
    }
  },
  "bypass_actors": [
    {
      "actor_id": 5,
      "actor_type": "RepositoryRole",
      "bypass_mode": "always"
    }
  ],
  "rules": [
    { "type": "deletion" },
    { "type": "non_fast_forward" },
    { "type": "required_linear_history" },
    {
      "type": "required_status_checks",
      "parameters": {
        "do_not_enforce_on_create": false,
        "strict_required_status_checks_policy": false,
        "required_status_checks": [
          { "context": "Dependencies / Review", "integration_id": 15368 },
          { "context": "Todo comments / Scan", "integration_id": 15368 },
          { "context": "PR title / Linear Issue ID", "integration_id": 15368 }
        ]
      }
    },
    {
      "type": "merge_queue",
      "parameters": {
        "check_response_timeout_minutes": 60,
        "grouping_strategy": "ALLGREEN",
        "max_entries_to_build": 5,
        "max_entries_to_merge": 5,
        "merge_method": "SQUASH",
        "min_entries_to_merge": 1,
        "min_entries_to_merge_wait_minutes": 5
      }
    }
  ]
}
```

The `required_status_checks` contexts and `merge_queue` parameters mirror `main`'s equivalent rulesets (ids `17126010` and `17126578`) exactly, so behavior is consistent across both trunks.

### Applying

Requires **repo admin** on `hashintel/brunch` (write access, which is what most contributors have, cannot create rulesets):

```bash
gh api -X POST repos/hashintel/brunch/rulesets --input - <<'EOF'
{...payload above...}
EOF
```

Verify: `gh api repos/hashintel/brunch/rules/branches/next` should list `deletion`, `non_fast_forward`, `required_linear_history`, `required_status_checks`, and `merge_queue`.

## Stale-review dismissal on `main`

**Symptom:** Graphite merges a stack through `main`'s merge queue by rebasing each downstream PR onto the newly-merged parent (force-push). The org's "Required approval" ruleset dismisses approvals on every push (`dismiss_stale_reviews_on_push: true`, `require_last_push_approval: true`) — including pure rebases with no content change — so the next PR in the stack loses its approval and drops out of mergeable state. This breaks the "approve the whole stack, let Graphite land it" flow.

**History:** the org used to solve this with a diff-aware dismissal action — [`dismiss-stale-approvals`](https://github.com/hashintel/.github) — which ran `git range-diff` between the previous and current push and only dismissed approvals when the actual diff changed, not on pure rebases. It was deleted in **SRE-737** (June 2026; brunch PR [#164](https://github.com/hashintel/brunch/pull/164) dropped the corresponding `stale-approvals` job from `preflight.yml`) in favor of the GitHub-native flags above. The native flags are diff-blind — they fire on *every* push — which is the regression breaking Graphite restacks.

The deleted action is still reachable at `hashintel/.github@a0df113e5602f3b721bf306bf6050ee2a0866956` under `.github/actions/dismiss-stale-approvals/` (and the calling reusable workflow at `.github/workflows/preflight-stale-approvals.yml` in the same repo/ref).

**Why this can't be fixed repo-locally:** the offending flags live in an **org-level** ruleset. Org and repo rulesets aggregate to the strictest, so a repo ruleset on `brunch` cannot relax `dismiss_stale_reviews_on_push` or `require_last_push_approval` — only an org-level change (or an org-ruleset exclusion naming `brunch`) can.

**Proposed fix (not yet filed):** restore range-diff-aware dismissal, either by re-adding the deleted reusable workflow + action in `hashintel/.github` (pinned to the reachable SHA, or ported forward) and turning off the two native flags for repos that opt in, or by scoping an org-ruleset exclusion for `brunch` while brunch runs its own diff-aware dismissal job. This should be proven out on `next` first (once `next` carries an approval rule, which it currently deliberately does not — see above) before taking it to the org side.

**Interim workaround:** merge stacked PRs into `main` one at a time via the queue, re-approving each downstream PR after its parent lands and it gets restacked, rather than approving the whole stack up front.
