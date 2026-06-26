import type { CreateAgentSessionFromServicesOptions } from '@earendil-works/pi-coding-agent';

const BRUNCH_WITHHELD_BUILTIN_TOOL_NAMES = ['bash', 'edit', 'write'] as const;

export interface BrunchPiSessionPolicyInput {
  readonly sessionStartEvent?: CreateAgentSessionFromServicesOptions['sessionStartEvent'];
  readonly thinkingLevel: NonNullable<CreateAgentSessionFromServicesOptions['thinkingLevel']>;
  readonly model?: CreateAgentSessionFromServicesOptions['model'];
}

type BrunchPiSessionPolicyOptions = Pick<
  CreateAgentSessionFromServicesOptions,
  'excludeTools' | 'model' | 'noTools' | 'sessionStartEvent' | 'thinkingLevel'
>;

export function projectBrunchPiSessionOptions(
  input: BrunchPiSessionPolicyInput,
): BrunchPiSessionPolicyOptions {
  return {
    ...(input.sessionStartEvent ? { sessionStartEvent: input.sessionStartEvent } : {}),
    noTools: 'builtin',
    excludeTools: [...BRUNCH_WITHHELD_BUILTIN_TOOL_NAMES],
    thinkingLevel: input.thinkingLevel,
    ...(input.model ? { model: input.model } : {}),
  };
}
