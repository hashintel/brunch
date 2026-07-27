import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseEnv } from 'node:util';

/**
 * Load `<cwd>/.env` into `process.env` with **shell-wins** precedence: only
 * keys not already present in the shell environment are set (standard dotenv
 * semantics). This prevents a stale `.env` from clobbering an explicit shell
 * prefix such as `PETRINAUT_URL=… brunch cook …` (field bug 2026-06-05: the
 * launcher printed `/?runId=…` because a bare-domain `.env` value overrode the
 * inline `…/brunch` URL). Blank `.env` values are skipped. Tolerates a missing
 * `.env`.
 *
 * Canonical for both the brunch backend (`src/server`) and the orchestrator
 * cook CLI. `src/server` already depends on `src/orchestrator`, so this single
 * source of truth lives in the lower layer rather than being copied per caller.
 */
export function loadLocalEnvFile(cwd: string): void {
  const envFilePath = join(cwd, '.env');
  if (!existsSync(envFilePath)) {
    return;
  }

  const parsed = parseEnv(readFileSync(envFilePath, 'utf8'));
  for (const [key, value] of Object.entries(parsed)) {
    if (value === '') {
      continue;
    }

    // Shell-wins: a value already provided by the environment takes precedence.
    if (process.env[key] !== undefined && process.env[key] !== '') {
      continue;
    }

    process.env[key] = value;
  }
}
