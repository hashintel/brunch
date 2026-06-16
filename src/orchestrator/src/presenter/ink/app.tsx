// The full-screen Ink view: egg-logo header, brigade phase tracker, and a
// bounded live activity log. A thin projection of RunStore — all folding
// lives in the store + the pure phase tracker, so this stays declarative.

import { Box, Text } from 'ink';
import { useSyncExternalStore } from 'react';

import { BRIGADE, type BrigadePhase } from '../phase.js';
import type { RunStore } from '../run-store.js';
import { EGG_LOGO } from './egg-logo.js';

const LOG_TAIL = 15;

function Header({ command }: { command: string }) {
  return (
    <Box flexDirection="row">
      <Box flexDirection="column" marginRight={1}>
        {EGG_LOGO.map((line, i) => (
          <Text key={i} color="yellow">
            {line}
          </Text>
        ))}
      </Box>
      <Box>
        <Text bold>brunch {command}</Text>
      </Box>
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

export function App({ store }: { store: RunStore }) {
  const state = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
  return (
    <Box flexDirection="column">
      <Header command={state.command} />
      <Box marginY={1}>
        <Brigade phase={state.phase} />
      </Box>
      <ActivityLog lines={state.lines} />
    </Box>
  );
}
