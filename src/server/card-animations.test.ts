/**
 * Oracle for the `card-animations` slice.
 *
 * The slice adds a stylesheet (`graphNode.css`) that animates the graph node's
 * *state changes* — selection emphasis (`.is-selected` / `.is-dimmed`), a hover
 * lift, and an expand/collapse card overlay — using CSS transitions. It must NOT
 * introduce per-tick position animation (transitioning `left`/`top`/`all`, which
 * would animate React Flow's per-frame node repositioning) nor a fly-in entrance
 * animation on the node itself.
 *
 * These tests read the stylesheet as text and assert on the rules it declares,
 * so they survive refactors of the React component but pin the documented
 * animation contract.
 */

import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '..', '..');

// The stylesheet is co-located with the GraphNode card it animates.
const candidatePaths = [resolve(repoRoot, 'src/views/graph/graphNode.css')];

function cssPath(): string {
  const found = candidatePaths.find((p) => existsSync(p));
  if (found === undefined) {
    throw new Error(`graphNode.css not found. Looked in:\n${candidatePaths.join('\n')}`);
  }
  return found;
}

/** Raw stylesheet text with /* … *\/ comments stripped. */
function css(): string {
  return readFileSync(cssPath(), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
}

/**
 * Flat-rule extractor: returns the declaration bodies of every rule whose
 * selector text matches `selectorRe`. Keyframe step blocks (`0% { … }`) are
 * naturally matched too, which is fine — callers scope by selector.
 */
function ruleBodies(source: string, selectorRe: RegExp): string[] {
  const bodies: string[] = [];
  for (const m of source.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const selector = m[1]?.trim() ?? '';
    const body = m[2] ?? '';
    if (selectorRe.test(selector)) bodies.push(body);
  }
  return bodies;
}

/** Declarations on the base `.graph-node` rule (selector exactly the node, no extra state). */
function graphNodeBaseBodies(source: string): string[] {
  return ruleBodies(source, /^\.graph-node$/);
}

/** Every `transition` declaration value across the whole stylesheet. */
function transitionValues(source: string): string[] {
  return [...source.matchAll(/transition(?:-property)?\s*:\s*([^;{}]+)/g)].map((m) =>
    (m[1] ?? '').trim().toLowerCase(),
  );
}

describe('card-animations — stylesheet exists and is transition-driven', () => {
  it('ships a graphNode.css stylesheet', () => {
    expect(() => css()).not.toThrow();
  });

  it('animates state via CSS transitions, not JS', () => {
    expect(transitionValues(css()).length).toBeGreaterThan(0);
  });
});

describe('card-animations — selection emphasis (.is-selected / .is-dimmed)', () => {
  it('styles the selected state under an .is-selected rule', () => {
    const selected = ruleBodies(css(), /\.is-selected/);
    expect(selected.length).toBeGreaterThan(0);
    // Emphasis is a visible change: a transform, ring/shadow, or border/outline.
    expect(selected.join('\n')).toMatch(/transform|box-shadow|outline|border|scale/i);
  });

  it('dims de-emphasised neighbours via opacity under an .is-dimmed rule', () => {
    const dimmed = ruleBodies(css(), /\.is-dimmed/);
    expect(dimmed.length).toBeGreaterThan(0);
    expect(dimmed.join('\n')).toMatch(/opacity\s*:/i);
  });

  it('transitions the properties that selection/dim change (opacity and/or transform/shadow)', () => {
    const base = graphNodeBaseBodies(css()).join('\n').toLowerCase();
    expect(base).toMatch(/transition/);
    expect(base).toMatch(/opacity|transform|box-shadow/);
  });
});

describe('card-animations — hover lift', () => {
  it('applies a transform on hover so the node visibly lifts', () => {
    const hover = ruleBodies(css(), /\.graph-node:hover/);
    expect(hover.length).toBeGreaterThan(0);
    expect(hover.join('\n')).toMatch(/transform\s*:/i);
    expect(hover.join('\n')).toMatch(/translate|scale/i);
  });

  it('transitions transform so the lift eases rather than snapping', () => {
    expect(transitionValues(css()).join(' ')).toMatch(/transform|\ball\b/);
  });
});

describe('card-animations — expand/collapse card overlay', () => {
  it('animates the card overlay with a transition or keyframe animation', () => {
    const source = css();
    const overlayRule =
      ruleBodies(source, /overlay|card/i).join('\n') +
      (/@keyframes/.test(source) ? '\n@keyframes-present' : '');
    expect(overlayRule).toMatch(/transition|animation|@keyframes-present/i);
  });

  it('animates a property suited to expand/collapse (height/scale/opacity/transform)', () => {
    const overlay = ruleBodies(css(), /overlay|card/i)
      .join('\n')
      .toLowerCase();
    expect(overlay).toMatch(/height|max-height|transform|scale|opacity|clip-path/);
  });
});

describe('card-animations — excludes per-tick position animation and fly-in entrance', () => {
  it('never transitions positional properties (left/top/all) that would animate per-frame layout', () => {
    for (const value of transitionValues(css())) {
      expect(value).not.toMatch(/\bleft\b/);
      expect(value).not.toMatch(/\btop\b/);
      expect(value).not.toMatch(/\ball\b/);
    }
  });

  it('declares no fly-in / entrance keyframe animation', () => {
    const names = [...css().matchAll(/@keyframes\s+([\w-]+)/g)].map((m) => (m[1] ?? '').toLowerCase());
    for (const name of names) {
      expect(name).not.toMatch(/fly|enter|entrance|appear|drop-?in|slide-?in/);
    }
  });

  it('does not run an entrance animation on the node element itself', () => {
    const base = graphNodeBaseBodies(css()).join('\n').toLowerCase();
    expect(base).not.toMatch(/animation\s*:/);
    expect(base).not.toMatch(/animation-name\s*:/);
  });
});
