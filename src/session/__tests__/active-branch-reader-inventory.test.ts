import { readFile, readdir } from 'node:fs/promises';
import { join, relative, resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const ROOT = resolve(import.meta.dirname, '../../..');
const PRODUCTION_ROOTS = [
  'src/session',
  'src/rpc',
  'src/app',
  'src/projections',
  'src/.pi/extensions',
  'src/dev',
  'src/probes',
] as const;

type ReaderClassification = {
  readonly rationale: string;
  readonly requiredOwner: string;
};

export const ACTIVE_BRANCH_DIAGNOSTIC_READER_ALLOW_LIST: Record<string, ReaderClassification> = {
  'src/session/session-transcript.ts': {
    rationale: 'append-order diagnostic rendering; never a product current-state projection',
    requiredOwner: 'renderAllHistoryDiagnosticTranscript',
  },
  'src/dev/tier-2-harness.ts': {
    rationale: 'returns persisted JSONL as raw Tier-2 run evidence',
    requiredOwner: 'parseJsonl',
  },
  'src/probes/structured-exchange-rpc-proof.ts': {
    rationale: 'inspects source JSONL as durable all-history probe evidence',
    requiredOwner: 'readProofDetails',
  },
  'src/probes/structured-exchange-ordering-proof.ts': {
    rationale: 'inspects source JSONL as durable all-history probe evidence',
    requiredOwner: 'readToolResults',
  },
  'src/probes/public-rpc-parity-proof.ts': {
    rationale: 'compares public RPC output with the source JSONL probe artifact',
    requiredOwner: 'toolResultEntries',
  },
  'src/dev/generate-fan-out-witness.ts': {
    rationale: 'reads append-order transcript evidence for a developer witness, never product state',
    requiredOwner: 'toolTranscriptEvents',
  },
  'src/probes/fixture-curation-loop.ts': {
    rationale: 'reads append-order tool attempts from a probe artifact, never product state',
    requiredOwner: 'mutateGraphAttemptsFromSession',
  },
  'src/probes/project-graph-review-cycle-proof.ts': {
    rationale: 'reads append-order tool results from a probe artifact, never product state',
    requiredOwner: 'toolResultMessages',
  },
  'src/probes/propose-graph-commit-proof.ts': {
    rationale: 'reads append-order mutation attempts from a probe artifact, never product state',
    requiredOwner: 'mutateGraphAttemptsFromSession',
  },
} as const;

const SYNTAX_VALIDATORS: Record<string, ReaderClassification> = {
  'src/session/workspace-session-coordinator/canonical-session-files.ts': {
    rationale:
      'validates non-empty JSONL line syntax only; Pi owns header, binding, name, turn, and tree semantics',
    requiredOwner: 'validateSessionJsonlSyntax',
  },
};

const NON_SESSION_JSON_PARSERS: Record<string, ReaderClassification> = {
  'src/dev/trajectory-report.ts': {
    rationale: 'parses the dev-only normalized trajectory NDJSON artifact, never Pi session JSONL',
    requiredOwner: 'readEvents',
  },
  'src/dev/execution-comparison/host-landing-oracle/fixture.ts': {
    rationale: 'parses public candidate JSON-RPC stdout responses, never Pi session JSONL',
    requiredOwner: 'runCandidateRpc',
  },
};

const ALL_CLASSIFICATIONS: Record<string, ReaderClassification> = {
  ...ACTIVE_BRANCH_DIAGNOSTIC_READER_ALLOW_LIST,
  ...SYNTAX_VALIDATORS,
  ...NON_SESSION_JSON_PARSERS,
};

describe('active-branch production reader inventory', () => {
  it('classifies every getEntries() and direct session JSONL parser', async () => {
    const findings: string[] = [];
    for (const root of PRODUCTION_ROOTS) {
      for (const file of await productionTypescriptFiles(join(ROOT, root))) {
        const source = await readFile(file, 'utf8');
        const path = relative(ROOT, file);
        const hasGetEntriesCall = /\.getEntries\s*\(/u.test(withoutComments(source));
        const hasRawJsonlParser =
          /JSON\.parse/u.test(source) &&
          /\.split\(\s*['"]\\n['"]\s*\)/u.test(source) &&
          /(session|transcript|jsonl)/iu.test(source);
        if (hasGetEntriesCall || hasRawJsonlParser) {
          findings.push(path);
          const classification = ALL_CLASSIFICATIONS[path];
          expect(classification, `${path} needs an exact reader classification`).toBeDefined();
          expect(source, `${path} no longer contains its classified owner`).toContain(
            classification?.requiredOwner,
          );
        }
      }
    }

    expect(findings.sort()).toEqual(
      [
        ...Object.keys(ACTIVE_BRANCH_DIAGNOSTIC_READER_ALLOW_LIST),
        ...Object.keys(SYNTAX_VALIDATORS),
        ...Object.keys(NON_SESSION_JSON_PARSERS),
      ].sort(),
    );
    expect(Object.values(ALL_CLASSIFICATIONS).every(({ rationale }) => rationale.length > 20)).toBe(true);
  });
});

async function productionTypescriptFiles(root: string): Promise<string[]> {
  const files: string[] = [];
  for (const entry of await readdir(root, { withFileTypes: true })) {
    if (entry.name === '__tests__' || entry.name.endsWith('.test.ts')) continue;
    const path = join(root, entry.name);
    if (entry.isDirectory()) files.push(...(await productionTypescriptFiles(path)));
    else if (entry.isFile() && entry.name.endsWith('.ts')) files.push(path);
  }
  return files;
}

function withoutComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//gu, '').replace(/\/\/.*$/gmu, '');
}
