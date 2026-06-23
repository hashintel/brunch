import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { arrowheadConfig, edgeStyle } from '@/client/components/graph/graphStyle';
import { kindAccentHex } from '@/client/components/knowledge-card';

const packageRoot = dirname(dirname(dirname(dirname(dirname(dirname(fileURLToPath(import.meta.url)))))));
const graphEdgeCssPath = resolve(packageRoot, 'src/client/components/graph/graphEdge.css');

// Node accent colors now live in nodeColor.ts (see node-color-mapping.test.ts)
// and the uniform card box in cardFootprint.ts (see card-footprint.test.ts);
// nodeStyle.ts is now only the neutral edge styling.

describe('edgeStyle', () => {
  it('exposes a neutral stroke color as a hex string', () => {
    expect(typeof edgeStyle.stroke).toBe('string');
    expect(edgeStyle.stroke).toMatch(/^#[0-9a-fA-F]{6}$/);
  });

  it('uses a positive stroke width', () => {
    expect(typeof edgeStyle.strokeWidth).toBe('number');
    expect(edgeStyle.strokeWidth).toBeGreaterThan(0);
  });

  it('is neutral — not tinted with any kind accent color', () => {
    const accents = Object.values(kindAccentHex).map((c) => c.toLowerCase());
    expect(accents).not.toContain(edgeStyle.stroke.toLowerCase());
  });
});

describe('arrowheadConfig', () => {
  it('describes a directional arrowhead with positive dimensions', () => {
    expect(arrowheadConfig.width).toBeGreaterThan(0);
    expect(arrowheadConfig.height).toBeGreaterThan(0);
  });

  it('carries a color string for the arrowhead', () => {
    expect(typeof arrowheadConfig.color).toBe('string');
    expect(arrowheadConfig.color).toMatch(/^#[0-9a-fA-F]{6}$/);
  });
});

describe('graph edge CSS states', () => {
  it('defines a visible de-emphasis style for dimmed edges', () => {
    const css = readFileSync(graphEdgeCssPath, 'utf8');

    expect(css).toMatch(/\.graph-edge--dimmed\s*\{/);
    expect(css).toMatch(/opacity:\s*0\.\d+/);
  });
});
