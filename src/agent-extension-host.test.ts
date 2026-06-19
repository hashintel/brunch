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
  it('the contract module is dependency-free, which is what keeps it mode-neutral', () => {
    const src = readFileSync(join(here, 'agent-extension-host.ts'), 'utf8');
    // No imports is the load-bearing guarantee: a module that imports nothing
    // cannot reference an `execute`-only type (Slice/Epic/Plan/Toolchain/worktree…)
    // or an SDK type. That makes neutrality structural rather than a denylist of
    // names we have to remember to update.
    expect(src).not.toMatch(/^\s*import[\s{*]/m);
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

  it('the interview exploration plugin matches the real tool surface exactly', () => {
    // `createExplorationTools` is DB-free, so this family is proven bidirectionally
    // against live code: the witness may neither omit a real tool nor invent a
    // phantom one. The three native interviewer tools (ask_question /
    // present_preface / propose_phase_closure) can't be checked this way —
    // constructing them needs a live DB — so their coverage is type-level only
    // (the `keyof InterviewerTools` assertion below), which is superset-only: it
    // proves the witness omits no real tool, not that it invents none.
    const explorationPlugin = interviewWitness.plugins.find((p) => p.id === 'elicit.workspace-exploration');
    const witnessed = new Set(explorationPlugin?.capabilities.map((c) => c.id));
    const actual = new Set(Object.keys(createExplorationTools(here)));
    expect(witnessed).toEqual(actual);
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
