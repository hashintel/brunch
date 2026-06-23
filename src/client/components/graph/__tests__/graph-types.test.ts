import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import ts from 'typescript';
import { describe, expect, it } from 'vitest';

// src/client/components/graph/__tests__/graph-types.test.ts -> repo root
const packageRoot = dirname(dirname(dirname(dirname(dirname(dirname(fileURLToPath(import.meta.url)))))));
const typesPath = resolve(packageRoot, 'src/client/components/graph/types.ts');
const probePath = resolve(packageRoot, 'src/client/components/graph/__graph_types_probe__.ts');

const compilerOptions: ts.CompilerOptions = {
  target: ts.ScriptTarget.ES2022,
  module: ts.ModuleKind.ESNext,
  moduleResolution: ts.ModuleResolutionKind.Bundler,
  strict: true,
  noEmit: true,
  skipLibCheck: true,
  jsx: ts.JsxEmit.ReactJSX,
  baseUrl: packageRoot,
  paths: { '@/*': ['src/*'] },
};

/**
 * Type-check a probe snippet against the real graph types module.
 *
 * The probe is served as a virtual file rooted in the graph view directory so
 * that both the relative `./types.js` import and the `@/` path alias resolve
 * exactly as they do in the application build. Returns the human-readable
 * compiler error messages produced while checking the probe's import graph.
 */
function typeCheckProbe(source: string): string[] {
  const host = ts.createCompilerHost(compilerOptions, true);
  const originalGetSourceFile = host.getSourceFile.bind(host);
  const originalReadFile = host.readFile.bind(host);
  const originalFileExists = host.fileExists.bind(host);

  host.getSourceFile = (fileName, languageVersion, onError, shouldCreate) => {
    if (resolve(fileName) === probePath) {
      return ts.createSourceFile(fileName, source, languageVersion, true);
    }
    return originalGetSourceFile(fileName, languageVersion, onError, shouldCreate);
  };
  host.readFile = (fileName) => {
    if (resolve(fileName) === probePath) {
      return source;
    }
    return originalReadFile(fileName);
  };
  host.fileExists = (fileName) => {
    if (resolve(fileName) === probePath) {
      return true;
    }
    return originalFileExists(fileName);
  };

  const program = ts.createProgram([probePath], compilerOptions, host);
  const diagnostics = [
    ...program.getSyntacticDiagnostics(),
    ...program.getSemanticDiagnostics(),
    ...program.getGlobalDiagnostics(),
  ];

  return diagnostics.map((d) => ts.flattenDiagnosticMessageText(d.messageText, '\n'));
}

/**
 * Errors that signal the type contract itself was violated, excluding errors
 * that merely mean the module could not be resolved. This keeps the negative
 * tests honest: a missing `types.ts` must produce a "cannot find module" error
 * (which we drop here), so a missing module can never masquerade as a
 * satisfied "rejects bad input" expectation.
 */
function contractViolations(source: string): string[] {
  return typeCheckProbe(source).filter((message) => !message.includes('Cannot find module'));
}

const knowledgeKinds = [
  'goal',
  'term',
  'context',
  'constraint',
  'requirement',
  'criterion',
  'decision',
  'assumption',
] as const;

const edgeRelations = ['depends_on', 'derived_from', 'constrains', 'verifies', 'refines'] as const;

describe('graph view types module', () => {
  it('exists at src/client/components/graph/types.ts as the root graph type module', () => {
    expect(existsSync(typesPath)).toBe(true);
  });

  it('exports GraphNodeData and GraphEdgeData that type-check cleanly when used', () => {
    const errors = typeCheckProbe(`
      import type { GraphNodeData, GraphEdgeData } from './types.js';

      const node: GraphNodeData = {
        kind: 'goal',
        degree: 3,
        selected: false,
        dimmed: true,
        referenceCode: 'G1',
        content: 'A goal',
        rationale: '',
      };

      const edge: GraphEdgeData = {
        relationship: 'depends_on',
      };

      void node;
      void edge;
    `);

    expect(errors).toEqual([]);
  });

  it('accepts every knowledge entity kind as GraphNodeData.kind', () => {
    const assignments = knowledgeKinds
      .map(
        (kind, index) =>
          `const n${index}: GraphNodeData = { kind: '${kind}', degree: 0, selected: false, dimmed: false, referenceCode: '', content: '', rationale: '' }; void n${index};`,
      )
      .join('\n');

    const errors = typeCheckProbe(`
      import type { GraphNodeData } from './types.js';
      ${assignments}
    `);

    expect(errors).toEqual([]);
  });

  it('rejects a GraphNodeData.kind that is not a knowledge entity kind', () => {
    const errors = contractViolations(`
      import type { GraphNodeData } from './types.js';
      const node: GraphNodeData = { kind: 'banana', degree: 1, selected: false, dimmed: false, referenceCode: '', content: '', rationale: '' };
      void node;
    `);

    expect(errors.length).toBeGreaterThan(0);
  });

  it('requires degree to be a number', () => {
    const errors = contractViolations(`
      import type { GraphNodeData } from './types.js';
      const node: GraphNodeData = { kind: 'goal', degree: 'three', selected: false, dimmed: false, referenceCode: '', content: '', rationale: '' };
      void node;
    `);

    expect(errors.length).toBeGreaterThan(0);
  });

  it('requires the selected and dimmed flags to be booleans', () => {
    const errors = contractViolations(`
      import type { GraphNodeData } from './types.js';
      const node: GraphNodeData = { kind: 'goal', degree: 1, selected: 'yes', dimmed: 0, referenceCode: '', content: '', rationale: '' };
      void node;
    `);

    expect(errors.length).toBeGreaterThan(0);
  });

  it('requires GraphNodeData to carry kind, degree, selected, and dimmed', () => {
    const errors = contractViolations(`
      import type { GraphNodeData } from './types.js';
      const node: GraphNodeData = { kind: 'goal' };
      void node;
    `);

    expect(errors.length).toBeGreaterThan(0);
  });

  it('requires GraphNodeData to carry the projected referenceCode, content, and rationale', () => {
    const errors = contractViolations(`
      import type { GraphNodeData } from './types.js';
      const node: GraphNodeData = { kind: 'goal', degree: 1, selected: false, dimmed: false };
      void node;
    `);

    expect(errors.length).toBeGreaterThan(0);
  });

  it('accepts every edge relationship type as GraphEdgeData.relationship', () => {
    const assignments = edgeRelations
      .map(
        (relation, index) =>
          `const e${index}: GraphEdgeData = { relationship: '${relation}' }; void e${index};`,
      )
      .join('\n');

    const errors = typeCheckProbe(`
      import type { GraphEdgeData } from './types.js';
      ${assignments}
    `);

    expect(errors).toEqual([]);
  });

  it('rejects a GraphEdgeData.relationship that is not a known relationship type', () => {
    const errors = contractViolations(`
      import type { GraphEdgeData } from './types.js';
      const edge: GraphEdgeData = { relationship: 'mentions' };
      void edge;
    `);

    expect(errors.length).toBeGreaterThan(0);
  });
});
