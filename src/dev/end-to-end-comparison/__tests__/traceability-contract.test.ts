import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { redactRequirementLedger } from '../redaction.js';
import {
  parseRequirementLedger,
  parseRequirementRegistry,
  type RequirementLedger,
} from '../traceability-contract.js';

const HASH = `sha256:${'e'.repeat(64)}`;
const cell = {
  implementation: 'satisfied' as const,
  verification: 'passed' as const,
  assessment: 'explicit-and-implemented' as const,
  evidence: [
    { id: 'browser/mount.json', audience: 'public' as const },
    { id: 'controller/fixtures/expected.json', audience: 'controller_only' as const },
  ],
};

function ledger(): RequirementLedger {
  return {
    schemaVersion: 1,
    studyContractSha256: HASH,
    rows: [
      {
        id: 'AC14',
        publicConcern: 'Application startup',
        origin: 'controller_only',
        controller: {
          wording: 'The hidden exact startup expectation.',
          revealPolicy: 'Reveal only after a qualifying startup question.',
          expectedState: 'No module failures.',
          fixtureRefs: ['controller/fixtures/known-good'],
        },
        elicitation: {
          brunch_spec: { status: 'explicit', evidence: ['elicitation/brunch/spec.md#startup'] },
          claude_spec: { status: 'omitted', evidence: ['elicitation/claude/spec.md'] },
        },
        handoff: {
          brunch_spec: { status: 'present', evidence: 'handoffs/brunch_spec/handoff.json' },
          claude_spec: { status: 'absent', evidence: 'handoffs/claude_spec/handoff.json' },
        },
        cells: {
          'brunch_spec--brunch': cell,
          'brunch_spec--claude_code': cell,
          'claude_spec--brunch': { ...cell, assessment: 'unelicited-but-inferred' },
          'claude_spec--claude_code': { ...cell, assessment: 'unelicited-but-inferred' },
        },
      },
    ],
  };
}

describe('end-to-end requirement traceability', () => {
  it('parses the tracked controller requirement registry before provider runs', async () => {
    const path = fileURLToPath(
      new URL(
        '../../../../testing/end-to-end-comparisons/cases/minimal-petri-net-editor/controller/requirement-registry.json',
        import.meta.url,
      ),
    );
    const registry = parseRequirementRegistry(JSON.parse(await readFile(path, 'utf8')) as unknown);
    expect(registry.rows.map((row) => row.id)).toEqual([
      'AC14',
      'AC15',
      'AC16',
      'AC17',
      'AC18',
      'AC19',
      'AC20',
      'AC21',
      'AC22',
      'AC23',
      'AC24',
      'AC25',
      'AC26',
    ]);
  });

  it('freezes unique requirement ids and controller detail before provider runs', () => {
    const registry = {
      schemaVersion: 1,
      caseId: 'minimal-petri-net-editor-v1',
      rows: [
        {
          id: 'AC14',
          publicConcern: 'Application startup',
          origin: 'controller_only',
          controller: ledger().rows[0]!.controller,
        },
      ],
    };
    expect(parseRequirementRegistry(registry)).toEqual(registry);
    expect(() =>
      parseRequirementRegistry({ ...registry, rows: [registry.rows[0], registry.rows[0]] }),
    ).toThrow('invalid end-to-end requirement registry');
  });

  it('requires every row to close both elicitation paths, both handoffs, and all four execution cells', () => {
    expect(parseRequirementLedger(ledger())).toEqual(ledger());
    expect(() =>
      parseRequirementLedger({
        ...ledger(),
        rows: [
          {
            ...ledger().rows[0],
            cells: {
              'brunch_spec--brunch': cell,
            },
          },
        ],
      }),
    ).toThrow('invalid end-to-end requirement ledger');
  });

  it('rejects inferred success without passing common output evidence', () => {
    expect(() =>
      parseRequirementLedger({
        ...ledger(),
        rows: [
          {
            ...ledger().rows[0],
            cells: {
              ...ledger().rows[0]!.cells,
              'claude_spec--brunch': {
                implementation: 'not_assessable',
                verification: 'not_assessable',
                assessment: 'unelicited-but-inferred',
                evidence: [],
              },
            },
          },
        ],
      }),
    ).toThrow('invalid end-to-end requirement ledger');
  });

  it('removes controller wording, fixtures, expectations, reveal policy, and private evidence', () => {
    const redacted = redactRequirementLedger(ledger());
    expect(redacted.rows[0]).not.toHaveProperty('controller');
    expect(JSON.stringify(redacted)).not.toContain('hidden exact');
    expect(JSON.stringify(redacted)).not.toContain('controller/fixtures');
    expect(redacted.rows[0]!.cells['brunch_spec--brunch'].evidence).toEqual([
      { id: 'browser/mount.json', audience: 'public' },
    ]);
  });
});
