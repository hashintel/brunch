import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { type AgentExtensionConsumerWitness, flattenCapabilityIds } from './agent-extension-host.js';
import { createPiActions } from './orchestrator/src/pi-actions.js';
import type { InterviewerTools } from './server/interview.js';
import { createExplorationTools } from './server/tools/index.js';

const here = dirname(fileURLToPath(import.meta.url));

// The cook (`execute`) consumer, described as host plugins — one cook action per
// capability. Proven below against the real `createPiActions()` surface.
const cookWitness = {
  consumerId: 'cook',
  mode: 'execute',
  plugins: [
    {
      id: 'execute.evaluate-done',
      mode: 'execute',
      capabilities: [
        {
          id: 'evaluate-done',
          summary: 'Decide a slice is done by running its verification targets.',
          handler: null,
        },
      ],
    },
    {
      id: 'execute.write-tests',
      mode: 'execute',
      capabilities: [{ id: 'write-tests', summary: 'Write failing tests for a slice.', handler: null }],
    },
    {
      id: 'execute.write-code',
      mode: 'execute',
      capabilities: [{ id: 'write-code', summary: 'Write code to make a slice pass.', handler: null }],
    },
    {
      id: 'execute.assess-semantic',
      mode: 'execute',
      capabilities: [
        { id: 'assess-semantic', summary: 'Assess semantic satisfaction of a slice.', handler: null },
      ],
    },
    {
      id: 'execute.verify-epic',
      mode: 'execute',
      capabilities: [{ id: 'verify-epic', summary: 'Write + run an epic integration test.', handler: null }],
    },
  ],
} as const satisfies AgentExtensionConsumerWitness;

// The interview (`elicit`) consumer as the neutrality WITNESS. The interview keeps
// its own runtime (Vercel AI SDK); this only proves its capability surface fits
// the same host contract. `as const` preserves the literal ids for the type-level
// coverage proof below.
const interviewWitness = {
  consumerId: 'interview',
  mode: 'elicit',
  plugins: [
    {
      id: 'elicit.ask-question',
      mode: 'elicit',
      capabilities: [{ id: 'ask_question', summary: 'Ask the user a structured question.', handler: null }],
    },
    {
      id: 'elicit.preface',
      mode: 'elicit',
      capabilities: [
        { id: 'present_preface', summary: 'Present a provisional context preface.', handler: null },
      ],
    },
    {
      id: 'elicit.phase-closure',
      mode: 'elicit',
      capabilities: [
        { id: 'propose_phase_closure', summary: 'Propose closing the current phase.', handler: null },
      ],
    },
    {
      id: 'elicit.workspace-exploration',
      mode: 'elicit',
      capabilities: [
        { id: 'read_file', summary: 'Read a workspace file.', handler: null },
        { id: 'grep', summary: 'Search workspace file contents.', handler: null },
        { id: 'find_files', summary: 'Find workspace files.', handler: null },
        { id: 'list_directory', summary: 'List a workspace directory.', handler: null },
      ],
    },
  ],
} as const satisfies AgentExtensionConsumerWitness;

describe('agent-extension-host contract is a mode-neutral core', () => {
  it('the contract module is dependency-free and names no execute-only concept', () => {
    const src = readFileSync(join(here, 'agent-extension-host.ts'), 'utf8');
    // Mode-neutral and SDK-agnostic ⇒ no imports at all.
    expect(src).not.toMatch(/^\s*import[\s{*]/m);
    // No `execute`-only domain concepts may leak into the neutral core. Tokens are
    // checked outside the doc comment so the explanatory prose above can name them.
    const code = src
      .split('\n')
      .filter((line) => !line.trimStart().startsWith('//'))
      .join('\n');
    const forbidden = [
      'Slice',
      'Epic',
      'Plan',
      'TestRunner',
      'Toolchain',
      'worktree',
      'sandboxDir',
      'pi-coding-agent',
      'ToolLoopAgent',
    ];
    for (const token of forbidden) {
      expect(code, `neutral core must not mention "${token}"`).not.toContain(token);
    }
  });

  it('a consumer witness only loads plugins of its own mode (per-mode registration)', () => {
    for (const witness of [cookWitness, interviewWitness]) {
      for (const plugin of witness.plugins) {
        expect(plugin.mode).toBe(witness.mode);
      }
    }
  });
});

describe('two-consumer proof — both real surfaces fit the host contract', () => {
  it('the cook execute surface matches the registered capabilities exactly', () => {
    const registered = new Set(flattenCapabilityIds(cookWitness));
    const actual = new Set(Object.keys(createPiActions()));
    expect(registered).toEqual(actual);
  });

  it('the interview elicit exploration family matches the real tool surface', () => {
    // `createExplorationTools` is DB-free, so the exploration capability ids are
    // proven against live code rather than hardcoded — guarding against drift.
    const actualExploration = Object.keys(createExplorationTools(here));
    const registered = new Set(flattenCapabilityIds(interviewWitness));
    for (const id of actualExploration) {
      expect(registered.has(id), `witness missing interview tool "${id}"`).toBe(true);
    }
  });

  it('the interview witness covers every interviewer tool id (type-enforced under lint --type-check)', () => {
    type ElicitCapabilityId = (typeof interviewWitness.plugins)[number]['capabilities'][number]['id'];
    // If the interview adds a tool not represented in the witness, `Covered`
    // becomes `false` and this assignment fails the type-aware lint gate.
    type Covered = keyof InterviewerTools extends ElicitCapabilityId ? true : false;
    const covered: Covered = true;
    expect(covered).toBe(true);
  });
});
