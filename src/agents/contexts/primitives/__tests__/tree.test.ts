import { expect, test } from 'vitest';

import { renderTree, renderTreeBlock } from '../tree.js';

test('tree wrapper renders hierarchical nodes through stringify-tree', () => {
  const root = {
    label: 'docs',
    children: [
      { label: 'README.md' },
      {
        label: 'memory',
        children: [{ label: 'SPEC.md' }, { label: 'PLAN.md' }],
      },
    ],
  };

  expect(renderTree(root)).toBe('┬ docs\n├── README.md\n└─┬ memory\n  ├── SPEC.md\n  └── PLAN.md');
  expect(renderTreeBlock(root)).toBe(
    '```tree\n┬ docs\n├── README.md\n└─┬ memory\n  ├── SPEC.md\n  └── PLAN.md\n```',
  );
});
