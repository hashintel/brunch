import { describe, expect, it } from 'vitest';

import { renderSubagentSessionDigest } from '../pi-subagents.js';

describe('renderSubagentSessionDigest', () => {
  const entries = [
    { type: 'message', message: { role: 'user', content: 'first' } },
    { type: 'message', message: { role: 'assistant', content: 'second' } },
    { type: 'custom', customType: 'structured_exchange', data: { content: 'third' } },
  ];

  it('does not render entry summaries for a zero bound', () => {
    expect(renderSubagentSessionDigest(entries, 0)).toBe(
      '- omitted earlier entries: 3\n- recent entries: none',
    );
  });

  it('does not render entry summaries for a negative bound', () => {
    expect(renderSubagentSessionDigest(entries, -1)).toBe(
      '- omitted earlier entries: 3\n- recent entries: none',
    );
  });

  it('keeps tail entries and omitted-count rendering for positive bounds', () => {
    expect(renderSubagentSessionDigest(entries, 2)).toBe(
      '- omitted earlier entries: 1\n- recent entries:\n  - 2: message/assistant: {"role":"assistant","content":"second"}\n  - 3: custom/structured_exchange: {"content":"third"}',
    );
  });
});
