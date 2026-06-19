// The full-screen Ink view: brunch wordmark header, brigade phase tracker, and a
// bounded live activity log. A thin projection of RunStore — all folding
// lives in the store + the pure phase tracker, so this stays declarative.

import { Box, Text } from 'ink';
import { useEffect, useState, useSyncExternalStore } from 'react';

import { formatElapsed } from '../clock.js';
import { BRIGADE, type BrigadePhase } from '../phase.js';
import type { PendingActivity, RunStore } from '../run-store.js';
import { BRUNCH_WORDMARK } from './wordmark.js';

const LOG_TAIL = 15;
const SPINNER = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
const TICK_MS = 250;

function Header({ command }: { command: string }) {
  return (
    <Box>
      {BRUNCH_WORDMARK.map(({ ch, color }) => (
        <Text key={ch} bold color={color}>
          {ch}
        </Text>
      ))}
      <Text dimColor> {command}</Text>
    </Box>
  );
}

const STATUS_ICON = { done: '✓', active: '◐', pending: '○' } as const;

function Brigade({ phase }: { phase: BrigadePhase }) {
  const active = BRIGADE.indexOf(phase);
  return (
    <Box>
      {BRIGADE.map((p, i) => {
        const status = i < active ? 'done' : i === active ? 'active' : 'pending';
        const color = status === 'active' ? 'cyan' : status === 'done' ? 'green' : 'gray';
        return (
          <Text key={p} color={color}>
            {p} {STATUS_ICON[status]}
            {i < BRIGADE.length - 1 ? '  ' : ''}
          </Text>
        );
      })}
    </Box>
  );
}

function ActivityLog({ lines }: { lines: string[] }) {
  return (
    <Box flexDirection="column">
      {lines.slice(-LOG_TAIL).map((line, i) => (
        <Text key={i}>{line === '' ? ' ' : line}</Text>
      ))}
    </Box>
  );
}

function PendingPanel({
  pending,
  now,
  frame,
}: {
  pending: PendingActivity[];
  now: () => number;
  frame: string;
}) {
  if (pending.length === 0) return null;
  return (
    <Box flexDirection="column" marginTop={1}>
      {pending.map((a) => (
        <Text key={a.id} color="cyan">
          {frame} {a.label} · {formatElapsed(now() - a.startedAt)}
          {a.detail ? ` · ${a.detail}` : ''}
        </Text>
      ))}
    </Box>
  );
}

export function App({ store, now = () => Date.now() }: { store: RunStore; now?: () => number }) {
  const state = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);

  // Tick only while something is pending, so the spinner/elapsed advance even
  // between events; the interval is torn down as soon as the waits clear.
  const [tick, setTick] = useState(0);
  const hasPending = state.pending.length > 0;
  useEffect(() => {
    if (!hasPending) return;
    const id = setInterval(() => setTick((t) => t + 1), TICK_MS);
    return () => clearInterval(id);
  }, [hasPending]);

  return (
    <Box flexDirection="column">
      <Header command={state.command} />
      <Box marginY={1}>
        <Brigade phase={state.phase} />
      </Box>
      <ActivityLog lines={state.lines} />
      <PendingPanel pending={state.pending} now={now} frame={SPINNER[tick % SPINNER.length]!} />
    </Box>
  );
}
