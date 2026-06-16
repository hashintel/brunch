// CookEvent → display lines. The single formatting authority, shared by the
// plain backend (writes each line to stderr) and the Ink backend (accumulates
// them into the activity log), so the two can never drift. `cook-start` seeds
// the clock and yields no lines.

import type { ElapsedClock } from './clock.js';
import type { CookEvent } from './events.js';

const RULE = '  ──────────────────────────────────────';

export function formatCookEvent(event: CookEvent, clock: ElapsedClock): string[] {
  switch (event.kind) {
    case 'plan-start':
      return ['', '  brunch plan', RULE, `  spec       ${event.specId}`, `  out        ${event.outDir}`, ''];
    case 'plan-written':
      return [`  ✓  plan      ${event.path}`, `     ${event.epics} epics, ${event.slices} slices`, ''];
    case 'plan-warnings':
      if (event.messages.length === 0) return [];
      return [`  ${event.messages.length} warnings:`, ...event.messages.map((m) => `  !  ${m}`), ''];
    case 'cook-start':
      clock.seed(event.runStart);
      return [];
    case 'action':
      return [`  ${clock.elapsed()}  ${event.icon}  ${event.message}`];
    case 'verbose': {
      const trimmed = event.text.trim();
      if (!trimmed) return [];
      return ['', ...trimmed.split('\n').map((line) => `             │ ${line}`), ''];
    }
    case 'line':
      return [event.text];
  }
}
