import { describe, expect, it } from 'vitest';

import { presentCandidatesFixture } from '../../../dev/component-preview/exchange-fixtures.js';
import { ExchangeCandidatesResultComponent } from '../exchange-candidates-result.js';

const plainTheme = {
  fg: (_color: string, text: string) => text,
  bold: (text: string) => text,
};

const taggedTheme = {
  fg: (color: string, text: string) => `<${color}>${text}</${color}>`,
  bold: (text: string) => `**${text}**`,
};

describe('ExchangeCandidatesResultComponent', () => {
  it('renders candidate details as proposal cards at narrow and wide widths', () => {
    const component = new ExchangeCandidatesResultComponent(
      presentCandidatesFixture.projection.details,
      plainTheme,
    );

    expect(component.render(52).join('\n')).toMatchInlineSnapshot(`
      "Which architecture path should we try?
      Compare the options before making the
      recognition-only choice.
      
      ╭─ 1. Local-first workbench ───────────────────────╮
      │ Status: Recognition proposal                     │
      │ Summary: Choose this while the product shape is… │
      │ Core bet: Use the local graph as the product sp… │
      │ Main risks: Does not prove collaborative cloud … │
      ╰──────────────────────────────────────────────────╯
      
      ╭─ 2. Cloud handoff path ──────────────────────────╮
      │ Status: Recognition proposal                     │
      │ Summary: Prove collaboration and remote continu… │
      │ Core bet: Prove collaboration and remote contin… │
      │ Main risks: Can distract from the elicitation l… │
      ╰──────────────────────────────────────────────────╯"
    `);
    expect(component.render(96).join('\n')).toMatchInlineSnapshot(`
      "Which architecture path should we try?
      Compare the options before making the recognition-only choice.

      ╭─ 1. Local-first workbench ───────────────────────────────────────────────────────────────────╮
      │ Status: Recognition proposal                                                                 │
      │ Summary: Choose this while the product shape is still moving.                                │
      │ Core bet: Use the local graph as the product spine.                                          │
      │ Main risks: Does not prove collaborative cloud semantics.                                    │
      ╰──────────────────────────────────────────────────────────────────────────────────────────────╯

      ╭─ 2. Cloud handoff path ──────────────────────────────────────────────────────────────────────╮
      │ Status: Recognition proposal                                                                 │
      │ Summary: Prove collaboration and remote continuity first.                                    │
      │ Core bet: Prove collaboration and remote continuity first.                                   │
      │ Main risks: Can distract from the elicitation loop.                                          │
      ╰──────────────────────────────────────────────────────────────────────────────────────────────╯"
    `);
  });

  it('uses theme roles for candidate-card borders', () => {
    const component = new ExchangeCandidatesResultComponent(
      presentCandidatesFixture.projection.details,
      taggedTheme,
    );

    expect(component.render(52).join('\n')).toContain('<accent>╭─</accent>');
    expect(component.render(52).join('\n')).toContain('**1. Local-first workbench**');
  });
});
