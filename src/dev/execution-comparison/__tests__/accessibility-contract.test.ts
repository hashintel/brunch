// @vitest-environment jsdom

import { describe, expect, it } from 'vitest';

import { assertAccessibilityContract } from '../accessibility-contract.js';
import type { ExecutionCasePublicContract } from '../case-contract.js';

const accessibility = {
  application: { role: 'application', name: 'Petri net editor' },
  canvas: { role: 'region', name: 'Petri net canvas' },
  controls: [
    { role: 'button', name: 'Add place' },
    { role: 'button', name: 'Add transition' },
    { role: 'button', name: 'Draw arc' },
    { role: 'button', name: 'Fire selected transition' },
    { role: 'button', name: 'Delete selection' },
    { role: 'button', name: 'New net' },
    { role: 'button', name: 'Reset marking' },
    { role: 'button', name: 'Export JSON' },
    { role: 'button', name: 'Import JSON' },
  ],
  dynamic: {
    place: { role: 'button', namePattern: '^Place: .+$' },
    transition: { role: 'button', namePattern: '^Transition: .+ \\((enabled|disabled)\\)$' },
    arc: { role: 'button', namePattern: '^Arc: .+ to .+$' },
  },
  inspectorFields: [
    { role: 'textbox', name: 'Label' },
    { role: 'spinbutton', name: 'Initial tokens' },
    { role: 'spinbutton', name: 'Current tokens' },
    { role: 'spinbutton', name: 'Arc weight' },
  ],
  feedbackRoles: ['status', 'alert'],
} satisfies ExecutionCasePublicContract['accessibility'];

function buttons(): string {
  return accessibility.controls.map(({ name }) => `<button type="button">${name}</button>`).join('');
}

describe('execution comparison accessibility contract', () => {
  it('locates the same semantics in structurally different DOM implementations', () => {
    document.body.innerHTML = `
      <main role="application" aria-label="Petri net editor">
        <nav>${buttons()}</nav>
        <section role="region" aria-label="Petri net canvas">
          <button aria-label="Place: Input"></button>
          <button aria-label="Transition: Fire (enabled)"></button>
          <button aria-label="Arc: Input to Fire"></button>
        </section>
        <aside>
          <label>Label<input /></label>
          <label>Initial tokens<input type="number" /></label>
        </aside>
        <output role="status"></output>
      </main>
    `;
    expect(
      assertAccessibilityContract(document.body, accessibility, {
        dynamic: ['place', 'transition', 'arc'],
        inspectorFields: ['Label', 'Initial tokens'],
      }),
    ).toMatchObject({ controls: 9, dynamic: 3, inspectorFields: 2 });

    document.body.innerHTML = `
      <div>
        <header>${buttons()}</header>
        <div role="application" aria-label="Petri net editor">
          <div role="region" aria-label="Petri net canvas">
            <svg>
              <g role="button" tabindex="0" aria-label="Place: Queue"></g>
              <g role="button" tabindex="0" aria-label="Transition: Send (disabled)"></g>
              <path role="button" tabindex="0" aria-label="Arc: Queue to Send"></path>
            </svg>
          </div>
          <div>
            <input aria-label="Label" />
            <input type="number" aria-label="Initial tokens" />
          </div>
        </div>
        <div role="alert"></div>
      </div>
    `;
    expect(
      assertAccessibilityContract(document.body, accessibility, {
        dynamic: ['place', 'transition', 'arc'],
        inspectorFields: ['Label', 'Initial tokens'],
      }),
    ).toMatchObject({ controls: 9, dynamic: 3, inspectorFields: 2 });
  });

  it('fails closed on missing or duplicate required semantics', () => {
    document.body.innerHTML = `
      <main role="application" aria-label="Petri net editor">
        <button>Add place</button>
        <button>Add place</button>
        <section role="region" aria-label="Petri net canvas"></section>
      </main>
    `;
    expect(() => assertAccessibilityContract(document.body, accessibility)).toThrow(
      'Add place: expected exactly one',
    );
  });
});
