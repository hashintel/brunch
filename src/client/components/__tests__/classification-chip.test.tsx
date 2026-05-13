// @vitest-environment happy-dom

import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { ClassificationChip, __testing } from '../classification-chip.js';

afterEach(() => {
  cleanup();
});

describe('ClassificationChip', () => {
  it('renders nothing when agent_status is null', () => {
    const { container } = render(
      <ClassificationChip agentStatus={null} agentClassification={null} agentProposal={null} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders a queued chip when agent_status is queued', () => {
    const { container } = render(
      <ClassificationChip agentStatus="queued" agentClassification={null} agentProposal={null} />,
    );
    const chip = container.querySelector('[data-classification-chip]');
    expect(chip?.getAttribute('data-classification-chip')).toBe('queued');
    expect(chip?.textContent).toContain('queued');
  });

  it('renders a classifying chip when agent_status is classifying', () => {
    const { container } = render(
      <ClassificationChip agentStatus="classifying" agentClassification={null} agentProposal={null} />,
    );
    expect(container.querySelector('[data-classification-chip="classifying"]')).not.toBeNull();
  });

  it('renders an auto-confirm chip on classified + auto-confirm', () => {
    const { container } = render(
      <ClassificationChip agentStatus="classified" agentClassification="auto-confirm" agentProposal={null} />,
    );
    const chip = container.querySelector('[data-classification-chip]');
    expect(chip?.getAttribute('data-classification-chip')).toBe('auto-confirm');
    expect(chip?.textContent).toContain('auto-confirm');
  });

  it('renders an auto-edit chip on classified + auto-edit', () => {
    const { container } = render(
      <ClassificationChip
        agentStatus="classified"
        agentClassification="auto-edit"
        agentProposal="Replace foo with bar"
      />,
    );
    expect(container.querySelector('[data-classification-chip="auto-edit"]')).not.toBeNull();
  });

  it('renders a substantive chip on classified + substantive', () => {
    const { container } = render(
      <ClassificationChip agentStatus="classified" agentClassification="substantive" agentProposal={null} />,
    );
    expect(container.querySelector('[data-classification-chip="substantive"]')).not.toBeNull();
  });

  it('renders a failed chip on failed status and shows agent_proposal as tooltip', () => {
    const { container } = render(
      <ClassificationChip agentStatus="failed" agentClassification={null} agentProposal="LLM unavailable" />,
    );
    const chip = container.querySelector('[data-classification-chip="failed"]');
    expect(chip).not.toBeNull();
    expect(chip?.getAttribute('title')).toBe('LLM unavailable');
  });

  it('failed chip falls back to label tooltip when agent_proposal is null', () => {
    const { container } = render(
      <ClassificationChip agentStatus="failed" agentClassification={null} agentProposal={null} />,
    );
    expect(container.querySelector('[data-classification-chip="failed"]')?.getAttribute('title')).toBe(
      'failed',
    );
  });
});

describe('variantFor', () => {
  it('null status returns null variant', () => {
    expect(__testing.variantFor(null, null)).toBeNull();
  });

  it('classified without a classification returns null (unexpected lifecycle)', () => {
    expect(__testing.variantFor('classified', null)).toBeNull();
  });

  it('classifying status overrides any classification', () => {
    expect(__testing.variantFor('classifying', 'auto-confirm')).toBe('classifying');
  });

  it('failed status overrides any classification', () => {
    expect(__testing.variantFor('failed', 'auto-edit')).toBe('failed');
  });
});
