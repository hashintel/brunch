import { expect, test } from 'vitest';

import { renderTree, renderTreeBlock } from '../tree.js';

test('tree wrapper renders hierarchical nodes as a fenced ASCII tree', () => {
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

test('a childless root renders as a single leaf line', () => {
  expect(renderTree({ label: 'solo' })).toBe('─ solo');
  expect(renderTree({ label: 'solo', children: [] })).toBe('─ solo');
});

test('non-final branches carry a vertical continuation prefix through their descendants', () => {
  const root = {
    label: 'root',
    children: [
      { label: 'a.txt' },
      {
        label: 'mid',
        children: [
          { label: 'm1.txt' },
          { label: 'deep', children: [{ label: 'd1.txt' }, { label: 'd2.txt' }] },
        ],
      },
      { label: 'empty', children: [] },
      { label: 'last', children: [{ label: 'l1.txt' }] },
    ],
  };

  expect(renderTree(root)).toBe(
    [
      '┬ root',
      '├── a.txt',
      '├─┬ mid',
      '│ ├── m1.txt',
      '│ └─┬ deep',
      '│   ├── d1.txt',
      '│   └── d2.txt',
      '├── empty',
      '└─┬ last',
      '  └── l1.txt',
    ].join('\n'),
  );
});
