/**
 * Spike: Core filesystem tools with ToolLoopAgent
 *
 * Question: Can a ToolLoopAgent with generic filesystem tools reliably
 * explore and characterize an existing project?
 *
 * Run: npx tsx --env-file=.env spike/filesystem-tools.ts [target-dir]
 *
 * Defaults to the brunch project root if no target dir is given.
 */
import { resolve } from 'node:path';

import { anthropic } from '@ai-sdk/anthropic';
import { ToolLoopAgent, stepCountIs } from 'ai';

import { createCoreTools } from '../src/server/tools/index.js';

const targetDir = resolve(process.argv[2] ?? '.');

console.log(`\n═══ Filesystem Tools Spike ═══`);
console.log(`Target: ${targetDir}`);
console.log(`Model: ${process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-20250514'}\n`);

const tools = createCoreTools(targetDir);

const agent = new ToolLoopAgent({
  model: anthropic(process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-20250514'),
  instructions: `You are a project analyst. You have access to filesystem tools to explore a codebase.

Your job is to explore the project at the working directory and produce a structured characterization.

Strategy:
1. Start with list_directory to see the top-level structure
2. Read key files (package.json, README, config files) to understand the tech stack
3. Use find_files and grep to understand the architecture
4. Read a few key source files to understand the domain

Produce a summary covering:
- Project name and purpose
- Tech stack (languages, frameworks, key dependencies)
- Architecture (main modules, entry points, data flow)
- Key abstractions and domain concepts
- Current state (what's built, what's in progress)`,
  tools,
  providerOptions: {
    anthropic: {
      sendReasoning: true,
      thinking: {
        type: 'enabled',
        budgetTokens: 8000,
      },
    },
  },
  maxOutputTokens: 8000,
  stopWhen: stepCountIs(30),
});

async function run() {
  const startMs = Date.now();
  let stepCount = 0;

  const result = await agent.generate({
    prompt: `Explore and characterize the project in the current working directory. Use the available tools to understand its structure, purpose, and current state.`,
    onStepFinish: (step) => {
      stepCount++;
      const toolCalls = step.toolCalls?.length ?? 0;
      const toolNames = step.toolCalls?.map((tc) => tc.toolName).join(', ') ?? 'none';
      console.log(`  Step ${stepCount}: ${toolCalls} tool call(s) [${toolNames}]`);
    },
  });

  const durationMs = Date.now() - startMs;

  console.log(`\n═══ Results ═══`);
  console.log(`Steps: ${stepCount}`);
  console.log(`Duration: ${(durationMs / 1000).toFixed(1)}s`);
  const u = result.usage;
  console.log(`Tokens: ${u.totalTokens} (${u.promptTokens} prompt, ${u.completionTokens} completion)`);
  console.log(`Finish reason: ${result.finishReason}`);
  console.log(`\n═══ Agent Summary ═══\n`);
  console.log(result.text);
}

run().catch((err) => {
  console.error('Spike failed:', err);
  process.exit(1);
});
