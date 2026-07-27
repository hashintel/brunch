// Pure line-builders for `brunch cook`'s banner and completion summary.
//
// Extracted from runCook so the exact text is golden-testable without booting
// the engine (ln-review #3 — the strings had no oracle). runCook feeds these
// lines to the presentation bus.

export type CookBannerInput = {
  policy: string;
  epicCount: number;
  sliceCount: number;
  maxRetries: number;
  sandboxDir: string;
  reportsPath: string;
};

export function cookBannerLines(input: CookBannerInput): string[] {
  return [
    '',
    '  brunch cook',
    '  ──────────────────────────────────────',
    `  policy     ${input.policy}`,
    `  plan       ${input.epicCount} epics, ${input.sliceCount} slices`,
    `  retries    ${input.maxRetries}`,
    `  sandbox    ${input.sandboxDir}`,
    `  reports    ${input.reportsPath}`,
    '',
  ];
}

export type CookSummaryInput = {
  status: string;
  reason?: string;
  duration: string;
  warnings: string[];
  epics: { epicId: string; status: string }[];
  slices: { sliceId: string; status: string }[];
  planSlices: { id: string; epic_id: string }[];
  reportCount: number;
  reportsPath: string;
};

export function cookSummaryLines(input: CookSummaryInput): string[] {
  const ok = input.status === 'completed';
  const lines: string[] = [
    '',
    '  ──────────────────────────────────────',
    `  ${ok ? '✓' : '✗'}  ${input.status}${input.reason ? ` — ${input.reason}` : ''}  (${input.duration})`,
  ];
  for (const warning of input.warnings) lines.push(`  !  ${warning}`);
  lines.push('');

  for (const epic of input.epics) {
    const icon = epic.status === 'completed' ? '✓' : '✗';
    const sliceSummary = input.slices
      .filter((s) => input.planSlices.find((ps) => ps.id === s.sliceId)?.epic_id === epic.epicId)
      .map((s) => `${s.status === 'completed' ? '✓' : '✗'} ${s.sliceId}`)
      .join('  ');
    lines.push(`  ${icon}  ${epic.epicId}`, `     ${sliceSummary}`);
  }

  lines.push('', `  ${input.reportCount} events → ${input.reportsPath}`, '');
  return lines;
}

/** How a brownfield `--land` resolved, when `--land` was passed. */
export type CookFinishLand =
  | { kind: 'landed'; branch: string; mode: string }
  | { kind: 'refused'; reason: string }
  | { kind: 'conflict'; branch: string };

export type CookFinishInput = {
  /** Brownfield results live in the repo (merge when ready); greenfield is a fresh tree. */
  shape: 'brownfield' | 'greenfield';
  /** Navigable directory the result landed in (repo root, or the --out target). */
  dir: string;
  branch: string;
  /** Full commit hash; rendered as its 8-char short form. */
  commit: string;
  land?: CookFinishLand;
};

/**
 * Final block printed when a run promotes: where it landed, the commit, and
 * copy-paste commands to drive the next action. Pure + golden-tested for the
 * same reason as the other builders here — the strings are the contract.
 * Halt/conflict/error paths keep their own inline lines; this is the success seam.
 */
export function cookFinishLines(input: CookFinishInput): string[] {
  const landed = input.land?.kind === 'landed' ? input.land : undefined;
  const lines: string[] = [
    '  ──────────────────────────────────────',
    `  ✓  cook → ${landed ? 'promoted + landed' : 'promoted'}`,
    '',
    `  ${'dir'.padEnd(6)}  ${input.dir}`,
    `  ${'branch'.padEnd(6)}  ${input.branch}`,
    `  ${'commit'.padEnd(6)}  ${input.commit.slice(0, 8)}`,
  ];
  if (landed) lines.push(`  ${'landed'.padEnd(6)}  ${landed.branch} (${landed.mode})`);

  const next: string[] = [];
  let hint = '';
  if (input.shape === 'greenfield') {
    next.push(`cd ${input.dir}`, 'git log -1');
  } else if (landed) {
    hint = `landed on ${landed.branch}`;
    next.push('git log --oneline -10');
  } else if (input.land?.kind === 'refused') {
    hint = `not landed (working tree ${input.land.reason}); merge when ready`;
    next.push(`git merge ${input.branch}`);
  } else if (input.land?.kind === 'conflict') {
    hint = 'not landed (merge conflict); resolve manually';
    next.push(`git merge ${input.branch}`);
  } else {
    hint = 'merge into your branch when ready';
    next.push(`git log --oneline ${input.branch} -10`, `git merge ${input.branch}`);
  }

  lines.push('', `  next${hint ? `  — ${hint}` : ''}`);
  for (const cmd of next) lines.push(`    ${cmd}`);
  lines.push('');
  return lines;
}
