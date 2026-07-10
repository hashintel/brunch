import { Text } from '@earendil-works/pi-tui';

interface ThemeLike {
  fg(kind: string, value: string): string;
  bold(value: string): string;
}

interface ToolResultLike {
  readonly content?: readonly { readonly type?: string; readonly text?: string }[];
  readonly details?: unknown;
}

interface RenderOptions {
  readonly expanded: boolean;
  readonly isPartial: boolean;
}

function renderContextComponent(context: unknown): Text | undefined {
  return context && typeof context === 'object' && 'lastComponent' in context
    ? (context as { lastComponent?: Text }).lastComponent
    : undefined;
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function firstText(result: ToolResultLike): string {
  return result.content?.find((part) => part.type === 'text')?.text ?? '';
}

function stringOrUndefined(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === 'string') : [];
}

function stringOrNumber(value: unknown): string | number | undefined {
  return typeof value === 'string' || typeof value === 'number' ? value : undefined;
}

function countArray(value: unknown): number {
  return Array.isArray(value) ? value.length : 0;
}

function fallbackText(result: ToolResultLike): string {
  return firstText(result).trim() || 'No result';
}

function setText(context: unknown, text: string): Text {
  const component = renderContextComponent(context) ?? new Text('', 0, 0);
  component.setText(text);
  return component;
}

function collapsedToggleHint(theme: ThemeLike): string {
  return theme.fg('muted', 'Ctrl + O to expand');
}

function expandedToggleHint(theme: ThemeLike): string {
  return theme.fg('muted', 'Ctrl + O to collapse');
}

function withExpandHint(summary: string, options: RenderOptions, theme: ThemeLike): string {
  if (options.expanded) return summary;
  return `${summary} · ${collapsedToggleHint(theme)}`;
}

function compactField(value: string | undefined, fallback: string): string {
  return value ?? fallback;
}

function runScope(record: Record<string, unknown> | undefined): string {
  const runId = compactField(stringOrUndefined(record?.['runId']), 'unknown');
  const epicId = compactField(stringOrUndefined(record?.['epicId']), '-');
  const sliceId = compactField(stringOrUndefined(record?.['sliceId']), '-');
  return `run ${runId} · epic ${epicId} · slice ${sliceId}`;
}

interface ActivityEvent {
  readonly source: 'worker' | 'verify';
  readonly kind: string;
  readonly message: string;
  readonly scope: string;
  readonly sequence: number | undefined;
}

function numberOrUndefined(value: unknown): number | undefined {
  return typeof value === 'number' ? value : undefined;
}

function activityEvent(
  source: 'worker' | 'verify',
  record: Record<string, unknown> | undefined,
): ActivityEvent | undefined {
  if (!record) return undefined;
  const kind = stringOrUndefined(record['kind']) ?? 'event';
  const rawMessage = stringOrUndefined(record['message']) ?? 'unknown';
  return {
    source,
    kind,
    message: normalizeActivityMessage(source, kind, rawMessage),
    scope: runScope(record),
    sequence: numberOrUndefined(record['sequence']),
  };
}

function normalizeActivityMessage(source: 'worker' | 'verify', kind: string, message: string): string {
  const trimmed = message.trim() || 'unknown';
  if (source === 'worker' && kind === 'tool') {
    return trimmed.replace(/^tool\s+/u, '') || 'unknown';
  }
  return trimmed;
}

function activityUpdateLabel(event: ActivityEvent): string {
  const sequenceSuffix = event.sequence === undefined ? '' : ` #${event.sequence}`;
  if (event.source === 'worker') {
    if (event.kind === 'tool') return `worker tool call${sequenceSuffix}`;
    if (event.kind === 'status') return `worker status${sequenceSuffix}`;
    return `worker update${sequenceSuffix}`;
  }
  if (event.kind === 'stderr') return `verify error output${sequenceSuffix}`;
  if (event.kind === 'status') return `verify status${sequenceSuffix}`;
  return `verify output${sequenceSuffix}`;
}

function latestActivityLabel(event: ActivityEvent): string {
  if (event.source === 'worker') {
    if (event.kind === 'tool') return 'latest tool call';
    if (event.kind === 'status') return 'latest worker status';
    return 'latest worker update';
  }
  if (event.kind === 'stderr') return 'latest verify error';
  if (event.kind === 'status') return 'latest verify status';
  return 'latest verify output';
}

function activityEvents(details: Record<string, unknown>): ActivityEvent[] {
  return [
    activityEvent('worker', asRecord(details['agentStream'])),
    activityEvent('verify', asRecord(details['verifyStream'])),
  ]
    .filter((event): event is ActivityEvent => event !== undefined)
    .sort((left, right) => {
      if (left.sequence === undefined && right.sequence === undefined) return 0;
      if (left.sequence === undefined) return 1;
      if (right.sequence === undefined) return -1;
      return left.sequence - right.sequence;
    });
}

function activityCountLabel(count: number): string {
  return `activity ${count} event${count === 1 ? '' : 's'}`;
}

function compactExpandHint(summary: string, theme: ThemeLike): string {
  return `${summary}   ${collapsedToggleHint(theme)}`;
}

function orchestrateCollapsed(
  details: Record<string, unknown>,
  options: RenderOptions,
  theme: ThemeLike,
): string {
  const progress = asRecord(details['progress']);
  const outcome = asRecord(details['outcome']);
  const agentStream = asRecord(details['agentStream']);
  const verifyStream = asRecord(details['verifyStream']);
  const events = activityEvents(details);
  const runId =
    stringOrUndefined(progress?.['runId']) ??
    stringOrUndefined(agentStream?.['runId']) ??
    stringOrUndefined(verifyStream?.['runId']);
  const epicId =
    stringOrUndefined(progress?.['activeEpicId']) ??
    stringOrUndefined(agentStream?.['epicId']) ??
    stringOrUndefined(verifyStream?.['epicId']);
  const sliceId =
    stringOrUndefined(progress?.['activeSliceId']) ??
    stringOrUndefined(agentStream?.['sliceId']) ??
    stringOrUndefined(verifyStream?.['sliceId']);
  const step = stringOrUndefined(progress?.['step']) ?? stringOrUndefined(outcome?.['step']);
  const phase = progress
    ? stringOrUndefined(progress['phase'])
    : outcome
      ? outcome['status']?.toString()
      : undefined;
  const completed = countArray(progress?.['completedSliceIds']);
  let tail = `status ${compactField(stringOrUndefined(progress?.['runStatus']), 'unknown')}`;
  if (events.length > 0) {
    const latestEvent = events.at(-1);
    if (latestEvent) {
      tail = `${activityCountLabel(events.length)} · ${latestActivityLabel(latestEvent)} · ${latestEvent.message}`;
    }
  } else if (outcome && stringOrUndefined(outcome['status']) === 'halted') {
    tail = `reason ${compactField(stringOrUndefined(outcome['reason']), 'unknown')}`;
  } else if (outcome) {
    tail = `outcome ${compactField(stringOrUndefined(outcome['status']), 'unknown')}`;
  }
  return [
    orchestrateSummary(details, options),
    `run ${compactField(runId, 'unknown')}   epic ${compactField(epicId, '-')}   slice ${compactField(sliceId, '-')}`,
    `now ${compactField(step, '-')}   ${compactField(phase, 'unknown')}   done ${completed}`,
    compactExpandHint(
      tail.startsWith('reason ')
        ? `reason ${tail.slice('reason '.length)}`
        : tail.startsWith('status ')
          ? `state ${tail.slice('status '.length)}`
          : tail,
      theme,
    ),
  ].join('\n');
}

function standaloneCollapsed(
  lines: [string, string, string],
  options: RenderOptions,
  theme: ThemeLike,
): string {
  return [lines[0], lines[1], lines[2], withExpandHint('no side effects', options, theme)].join('\n');
}

function sectionDivider(title: string): string {
  return `--- ${title} ---`;
}

function orchestrateSummary(details: Record<string, unknown>, options: RenderOptions): string {
  const outcome = asRecord(details['outcome']);
  if (outcome) {
    const status = stringOrUndefined(outcome['status']);
    if (status === 'halted') return `halted · ${stringOrUndefined(outcome['step']) ?? 'unknown'}`;
    if (status === 'completed') return `completed · ${stringOrUndefined(outcome['runStatus']) ?? 'unknown'}`;
    if (status === 'missing_run') return 'missing · run';
  }

  const progress = asRecord(details['progress']);
  if (progress) {
    const step = stringOrUndefined(progress['step']) ?? 'step';
    const slice = stringOrUndefined(progress['activeSliceId']);
    if (options.isPartial) {
      if (step === 'test_result') return `running · slice ${slice ?? 'unknown'} · verify pending`;
      return `running · slice ${slice ?? 'unknown'} · ${step}`;
    }
    return `running · slice ${slice ?? 'unknown'} · ${stringOrUndefined(progress['runStatus']) ?? step}`;
  }

  return 'running · execute';
}

function orchestrateExpanded(
  details: Record<string, unknown>,
  options: RenderOptions,
  theme: ThemeLike,
): string {
  const progress = asRecord(details['progress']);
  const outcome = asRecord(details['outcome']);
  const agentStream = asRecord(details['agentStream']);
  const verifyStream = asRecord(details['verifyStream']);

  const lines: string[] = [
    orchestrateSummary(details, options),
    expandedToggleHint(theme),
    '',
    sectionDivider('Run Status'),
  ];
  const runId =
    stringOrUndefined(progress?.['runId']) ??
    stringOrUndefined(agentStream?.['runId']) ??
    stringOrUndefined(verifyStream?.['runId']);
  if (runId) lines.push(`run id: ${runId}`);
  const activeEpicId =
    stringOrUndefined(progress?.['activeEpicId']) ??
    stringOrUndefined(agentStream?.['epicId']) ??
    stringOrUndefined(verifyStream?.['epicId']);
  if (activeEpicId) lines.push(`active epic: ${activeEpicId}`);
  const activeSliceId =
    stringOrUndefined(progress?.['activeSliceId']) ??
    stringOrUndefined(agentStream?.['sliceId']) ??
    stringOrUndefined(verifyStream?.['sliceId']);
  if (activeSliceId) lines.push(`active slice: ${activeSliceId}`);
  const runStatus =
    stringOrUndefined(progress?.['runStatus']) ?? stringOrUndefined(outcome?.['runStatus']) ?? 'unknown';
  lines.push(`current state: ${runStatus}`);
  lines.push(`current step: ${stringOrUndefined(progress?.['step']) ?? '-'}`);
  lines.push(
    `phase: ${stringOrUndefined(progress?.['phase']) ?? compactField(stringOrUndefined(outcome?.['status']), 'unknown')}`,
  );
  lines.push(`slices completed: ${countArray(progress?.['completedSliceIds'])}`);

  lines.push('', sectionDivider('Timeline'));
  if (progress) {
    const phase = stringOrUndefined(progress['phase']);
    const step = stringOrUndefined(progress['step']) ?? 'unknown';
    const fromStatus = stringOrUndefined(progress['fromStatus']);
    const marker = phase === 'completed' ? '[✓]' : '[>]';
    const transition =
      phase === 'started' && fromStatus ? `${step} started from ${fromStatus}` : `${step} -> ${runStatus}`;
    lines.push(`${marker} ${transition}`);
    lines.push(`phase change: ${phase ?? 'unknown'} from ${fromStatus ?? 'unknown'}`);
    if (stringOrUndefined(outcome?.['runStatus'])) {
      lines.push(`next target: ${stringOrUndefined(outcome?.['runStatus'])}`);
    }
  } else if (outcome) {
    const status = stringOrUndefined(outcome['status']) ?? 'unknown';
    lines.push(`[✓] outcome -> ${status}`);
  } else {
    lines.push('no timeline data');
  }

  lines.push('', sectionDivider('Subtool Activity'));
  const events = activityEvents(details);
  if (events.length === 0) {
    lines.push('none');
  } else {
    lines.push(`recent updates: ${events.length}`);
    for (const event of events) {
      lines.push(`→ ${activityUpdateLabel(event)}`);
      lines.push(`  ${event.scope}`);
      lines.push(`  ${event.message}`);
    }
  }

  lines.push('', sectionDivider('Outcome'));
  if (outcome) {
    const status = stringOrUndefined(outcome['status']) ?? 'unknown';
    lines.push(`outcome: ${status}`);
    if (status === 'halted') {
      lines.push(`halted at: ${stringOrUndefined(outcome['step']) ?? 'unknown'}`);
      lines.push(`reason: ${stringOrUndefined(outcome['reason']) ?? 'unknown'}`);
    } else {
      lines.push(`final state: ${stringOrUndefined(outcome['runStatus']) ?? status}`);
    }
  } else {
    lines.push(`final state: ${runStatus}`);
  }

  return lines.join('\n');
}

export function renderExecuteOrchestrateResult(
  result: ToolResultLike,
  options: RenderOptions,
  theme: ThemeLike,
  context: unknown,
): Text {
  const details = asRecord(result.details);
  if (!details) return setText(context, fallbackText(result));
  return setText(
    context,
    options.expanded
      ? orchestrateExpanded(details, options, theme)
      : orchestrateCollapsed(details, options, theme),
  );
}

export function renderExecuteSnapshotResult(
  result: ToolResultLike,
  options: RenderOptions,
  theme: ThemeLike,
  context: unknown,
): Text {
  const details = asRecord(result.details);
  const snapshot = asRecord(details?.['snapshot']);
  if (!snapshot) return setText(context, fallbackText(result));
  const specId = stringOrNumber(snapshot['specId']) ?? 'unknown';
  const summary = `ready · spec ${specId}`;
  if (!options.expanded) {
    return setText(
      context,
      standaloneCollapsed(
        [
          summary,
          `mode ${compactField(stringOrUndefined(snapshot['mode']), 'unknown')} · graph ${compactField(stringOrNumber(details?.['source'] && asRecord(details['source'])?.['graphLsn'])?.toString(), 'unknown')}`,
          `requirements ${countArray(snapshot['requirements'])} · criteria ${countArray(snapshot['criteria'])}`,
        ],
        options,
        theme,
      ),
    );
  }
  return setText(
    context,
    [
      summary,
      expandedToggleHint(theme),
      '',
      'Status',
      `snapshot status: ${stringOrUndefined(snapshot['mode']) ?? 'unknown'}`,
      `graph lsn: ${stringOrNumber(asRecord(details?.['source'])?.['graphLsn']) ?? 'unknown'}`,
      `requirements: ${countArray(snapshot['requirements'])}`,
      `criteria: ${countArray(snapshot['criteria'])}`,
      '',
      'Side Effects',
      'none',
    ].join('\n'),
  );
}

export function renderExecutePlanCheckResult(
  result: ToolResultLike,
  options: RenderOptions,
  theme: ThemeLike,
  context: unknown,
): Text {
  const details = asRecord(result.details);
  const check = asRecord(details?.['check']);
  if (!check) return setText(context, fallbackText(result));
  const findings = countArray(check['findings']);
  const summary = `${stringOrUndefined(check['status']) ?? 'unknown'} · ${findings} findings`;
  const source = asRecord(details?.['source']);
  if (!options.expanded) {
    const topFinding = asRecord(Array.isArray(check['findings']) ? check['findings'][0] : undefined);
    return setText(
      context,
      [
        summary,
        `graph ${compactField(stringOrNumber(source?.['graphLsn'])?.toString(), 'unknown')} · ${compactField(stringOrUndefined(source?.['visibility']), 'unknown')} view`,
        `requirements ${stringOrNumber(asRecord(check['counts'])?.['requirements']) ?? 0} · criteria ${stringOrNumber(asRecord(check['counts'])?.['criteria']) ?? 0} · verified ${stringOrNumber(asRecord(check['counts'])?.['verifiedRequirements']) ?? 0}`,
        withExpandHint(
          `top issue ${compactField(stringOrUndefined(topFinding?.['message']), 'none')}`,
          options,
          theme,
        ),
      ].join('\n'),
    );
  }
  const lines = [
    summary,
    expandedToggleHint(theme),
    '',
    'Status',
    `check status: ${stringOrUndefined(check['status']) ?? 'unknown'}`,
    `graph lsn: ${stringOrNumber(source?.['graphLsn']) ?? 'unknown'}`,
    `view: ${stringOrUndefined(source?.['visibility']) ?? 'unknown'}`,
    `requirements: ${stringOrNumber(asRecord(check['counts'])?.['requirements']) ?? 0}`,
    `criteria: ${stringOrNumber(asRecord(check['counts'])?.['criteria']) ?? 0}`,
    `verified requirements: ${stringOrNumber(asRecord(check['counts'])?.['verifiedRequirements']) ?? 0}`,
    '',
    'Findings',
  ];
  for (const finding of Array.isArray(check['findings']) ? check['findings'] : []) {
    const record = asRecord(finding);
    lines.push(`- ${stringOrUndefined(record?.['message']) ?? 'unknown finding'}`);
  }
  if (findings === 0) lines.push('none');
  lines.push('', 'Side Effects', 'none');
  return setText(context, lines.join('\n'));
}

export function renderExecuteStatusResult(
  result: ToolResultLike,
  options: RenderOptions,
  theme: ThemeLike,
  context: unknown,
): Text {
  const details = asRecord(result.details);
  if (!details) return setText(context, fallbackText(result));
  const discipline = stringOrUndefined(details['discipline']) ?? 'unknown';
  const summary = `ready · ${discipline}`;
  if (!options.expanded) {
    return setText(
      context,
      [
        summary,
        `disciplines ${stringArray(details['availableDisciplines']).length} · ported ${stringArray(details['portedTools']).length}`,
        `pending ${stringArray(details['pendingTools']).length}`,
        withExpandHint('no side effects', options, theme),
      ].join('\n'),
    );
  }
  return setText(
    context,
    [
      summary,
      expandedToggleHint(theme),
      '',
      'Status',
      `discipline: ${discipline}`,
      `available disciplines: ${stringArray(details['availableDisciplines']).join(', ') || 'none'}`,
      `ported tools: ${stringArray(details['portedTools']).length}`,
      `pending tools: ${stringArray(details['pendingTools']).length}`,
      '',
      'Side Effects',
      'none',
    ].join('\n'),
  );
}
