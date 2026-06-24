import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { arrowheadConfig, edgeStyle } from '@/client/components/graph/graphStyle';

const packageRoot = dirname(dirname(dirname(dirname(dirname(dirname(fileURLToPath(import.meta.url)))))));
const graphEdgeCssPath = resolve(packageRoot, 'src/client/components/graph/graphEdge.css');

// Node accent colors now live in nodeColor.ts (see node-color-mapping.test.ts)
// and the uniform card box in cardFootprint.ts (see card-footprint.test.ts);
// nodeStyle.ts is now only the neutral edge styling.

describe('edgeStyle', () => {
  it('uses a positive stroke width', () => {
    expect(typeof edgeStyle.strokeWidth).toBe('number');
    expect(edgeStyle.strokeWidth).toBeGreaterThan(0);
  });
});

describe('arrowheadConfig', () => {
  it('describes a directional arrowhead with positive dimensions', () => {
    expect(arrowheadConfig.width).toBeGreaterThan(0);
    expect(arrowheadConfig.height).toBeGreaterThan(0);
  });
});

describe('graph edge CSS states', () => {
  it('defines a visible de-emphasis style for dimmed edges', () => {
    const css = readFileSync(graphEdgeCssPath, 'utf8');

    expect(css).toMatch(/\.graph-edge--dimmed\s*\{/);
    expect(css).toMatch(/opacity:\s*0\.\d+/);
  });
});
