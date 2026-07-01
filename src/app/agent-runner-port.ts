import type { AgentRunnerPort } from '../executor/execution-ports.js';

export function createAgentRunnerPort(): AgentRunnerPort {
  return {
    async run() {
      return {
        status: 'failed',
        message: 'AgentRunnerPort is not implemented yet; inject a runner to execute agent slices.',
      };
    },
  };
}
