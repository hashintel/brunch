// The full-screen Ink view. The wordmark + activity log stream into terminal
// scrollback via <Static> (printed once each, so the full run is preserved and
// nothing "collapses"); a live footer below shows the brigade tracker, the
// single global run timer, and the pending-wait spinner. A thin projection of
// RunStore — all folding lives in the store + the pure phase tracker.

import { Box, Static, Text } from 'ink';
import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';

import { formatElapsed } from '../clock.js';
import { BRIGADE, type BrigadePhase } from '../phase.js';
import type { PendingActivity, RunStore } from '../run-store.js';
import { BRUNCH_ASCII, BRUNCH_ORANGE } from './wordmark.js';

const SPINNER = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
const TICK_MS = 250;

type ScrollItem = { kind: 'mark'; text: string; color: string } | { kind: 'log'; text: string };

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

function PendingPanel({ pending, frame }: { pending: PendingActivity[]; frame: string }) {
  if (pending.length === 0) return null;
  // One global timer lives in the footer; rows show only what's running.
  return (
    <Box flexDirection="column">
      {pending.map((a) => (
        <Text key={a.id} color="cyan">
          {frame} {a.label}
          {a.detail ? ` · ${a.detail}` : ''}
        </Text>
      ))}
    </Box>
  );
}

export function App({ store, now = () => Date.now() }: { store: RunStore; now?: () => number }) {
  const state = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);

  // One ticker drives the spinner and the global elapsed clock while mounted.
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), TICK_MS);
    return () => clearInterval(id);
  }, []);

  // Wordmark (once) + the append-only log → <Static>, so they stream into
  // scrollback rather than redrawing in a bounded box.
  const scroll = useMemo<ScrollItem[]>(
    () => [
      ...BRUNCH_ASCII.map((text, i) => ({
        kind: 'mark' as const,
        text,
        color: BRUNCH_ORANGE[i % BRUNCH_ORANGE.length]!,
      })),
      ...state.lines.map((text) => ({ kind: 'log' as const, text })),
    ],
    [state.lines],
  );

  return (
    <>
      <Static items={scroll}>
        {(item, i) =>
          item.kind === 'mark' ? (
            <Text key={i} color={item.color}>
              {item.text}
            </Text>
          ) : (
            <Text key={i}>{item.text === '' ? ' ' : item.text}</Text>
          )
        }
      </Static>
      <Box flexDirection="column" marginTop={1}>
        <Box>
          <Brigade phase={state.phase} />
          <Text dimColor>
            {'   '}
            {state.command} · {formatElapsed(now() - state.runStart)}
          </Text>
        </Box>
        <PendingPanel pending={state.pending} frame={SPINNER[tick % SPINNER.length]!} />
      </Box>
    </>
  );
}
