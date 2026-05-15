import { spawn } from 'node:child_process';

import { createModelBackedUserPolicy, type SimulatedUserModelAdapter } from './llm-user.js';
import {
  runProcessBackedProbe,
  type ProbeProcessSpawner,
  type ProbeRunError,
  type SimulatedUserEvent,
} from './probe-runner.js';

export interface PackagedLlmUserSmokeSummary {
  outputDir: string;
  turnsAnswered: number;
  finalFrontierState: string | null;
  errors: ProbeRunError[];
}

export type SmokeBuildCommandRunner = (command: string, args: string[]) => Promise<void>;

export interface PackagedLlmUserSmokeOptions {
  outputDir: string;
  model: SimulatedUserModelAdapter;
  runBuildCommand?: SmokeBuildCommandRunner;
  spawnProcess?: ProbeProcessSpawner;
}

export async function runPackagedLlmUserSmoke({
  outputDir,
  model,
  runBuildCommand = runCommand,
  spawnProcess,
}: PackagedLlmUserSmokeOptions): Promise<PackagedLlmUserSmokeSummary> {
  await runBuildCommand('npm', ['run', 'build']);

  const simulatedUserEvents: SimulatedUserEvent[] = [];
  const result = await runProcessBackedProbe({
    scenario: {
      name: 'packaged-llm-user-smoke',
      specName: 'LLM user smoke fixture candidate',
      brief: 'Answer as a concise user who wants Brunch to help clarify a software specification.',
    },
    scriptedAnswers: [],
    outputDir,
    preserveWorkspaceState: true,
    responsePolicy: createModelBackedUserPolicy({ model, events: simulatedUserEvents }),
    simulatedUserEvents,
    spawnProcess,
  });

  return {
    outputDir,
    turnsAnswered: result.summary.turnsAnswered,
    finalFrontierState: result.summary.finalFrontierState,
    errors: result.errors,
  };
}

export function formatSmokeSummary(summary: PackagedLlmUserSmokeSummary): string {
  return `${JSON.stringify(summary)}\n`;
}

function runCommand(command: string, args: string[]): Promise<void> {
  return new Promise((resolveCommand, rejectCommand) => {
    const child = spawn(command, args, { stdio: 'inherit' });
    child.on('error', rejectCommand);
    child.on('exit', (code) => {
      if (code === 0) {
        resolveCommand();
        return;
      }
      rejectCommand(new Error(`${command} ${args.join(' ')} exited with code ${code ?? 'unknown'}`));
    });
  });
}
