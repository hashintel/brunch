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
