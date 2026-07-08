import { describe, expect, it } from 'vitest';

import { presentReviewSetFixture } from '../../../dev/component-preview/exchange-fixtures.js';
import { ExchangeReviewSetResultComponent } from '../exchange-review-set-result.js';

const plainTheme = {
  fg: (_color: string, text: string) => text,
  bold: (text: string) => text,
};

const taggedTheme = {
  fg: (color: string, text: string) => `<${color}>${text}</${color}>`,
  bold: (text: string) => `**${text}**`,
};

describe('ExchangeReviewSetResultComponent', () => {
  it('renders review-set node and edge drafts as proposal cards at narrow and wide widths', () => {
    const component = new ExchangeReviewSetResultComponent(
      presentReviewSetFixture.projection.details,
      plainTheme,
    );

    expect(component.render(56).join('\n')).toMatchInlineSnapshot(`
      "Launch readiness review set
      Review the launch-readiness commitments together.

      ╭─ G2 · goal ──────────────────────────────────────────╮
      │ Status: Review-set proposal                          │
      │ Title: Launch safely                                 │
      │ Depends on: REQ5                                     │
      ╰──────────────────────────────────────────────────────╯

      ╭─ REQ5 · requirement ─────────────────────────────────╮
      │ Status: Review-set proposal                          │
      │ Title: Rollback is required                          │
      │ Body: Rollback must be available before launch.      │
      ╰──────────────────────────────────────────────────────╯

      ╭─ CH3 · check ────────────────────────────────────────╮
      │ Status: Review-set proposal                          │
      │ Title: Observe rollback path                         │
      │ Witnesses: G2 — (for) — The check proves the rollba… │
      ╰──────────────────────────────────────────────────────╯"
    `);
    expect(component.render(96).join('\n')).toMatchInlineSnapshot(`
      "Launch readiness review set
      Review the launch-readiness commitments together.

      ╭─ G2 · goal ──────────────────────────────────────────────────────────────────────────────────╮
      │ Status: Review-set proposal                                                                  │
      │ Title: Launch safely                                                                         │
      │ Depends on: REQ5                                                                             │
      ╰──────────────────────────────────────────────────────────────────────────────────────────────╯

      ╭─ REQ5 · requirement ─────────────────────────────────────────────────────────────────────────╮
      │ Status: Review-set proposal                                                                  │
      │ Title: Rollback is required                                                                  │
      │ Body: Rollback must be available before launch.                                              │
      ╰──────────────────────────────────────────────────────────────────────────────────────────────╯

      ╭─ CH3 · check ────────────────────────────────────────────────────────────────────────────────╮
      │ Status: Review-set proposal                                                                  │
      │ Title: Observe rollback path                                                                 │
      │ Witnesses: G2 — (for) — The check proves the rollback path is visible.                       │
      ╰──────────────────────────────────────────────────────────────────────────────────────────────╯"
    `);
  });

  it('uses theme roles for proposal-card borders', () => {
    const component = new ExchangeReviewSetResultComponent(
      presentReviewSetFixture.projection.details,
      taggedTheme,
    );

    expect(component.render(56).join('\n')).toContain('<accent>╭─</accent>');
    expect(component.render(56).join('\n')).toContain('**G2 · goal**');
  });
});
