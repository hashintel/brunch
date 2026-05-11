import { z } from 'zod';

import { getCapabilityContract, type CapabilityId } from './capability-registry.js';
import { createNewSpecification, getSpecificationState } from './core.js';
import type { DB } from './db.js';

const specCreateInputSchema = z.object({
  name: z.string().trim().min(1),
  mode: z.enum(['greenfield', 'brownfield']).optional(),
});

const specGetStatusInputSchema = z.object({
  specId: z.number().int().positive(),
});

const capabilityInputSchemas = {
  'spec.create': specCreateInputSchema,
  'spec.getStatus': specGetStatusInputSchema,
} as const;

export class CapabilityDispatchError extends Error {
  constructor(
    message: string,
    public readonly code: 'unknown_capability' | 'invalid_input' | 'handler_failed',
  ) {
    super(message);
    this.name = 'CapabilityDispatchError';
  }
}

export interface CapabilityDispatchContext {
  db: DB;
}

export interface DispatchCapabilityInput extends CapabilityDispatchContext {
  capability: string;
  input: unknown;
}

type SpecCreateInput = z.infer<typeof specCreateInputSchema>;
type SpecGetStatusInput = z.infer<typeof specGetStatusInputSchema>;
type SpecCreateOutput = ReturnType<typeof createSpecificationFromCapability>;
type SpecGetStatusOutput = ReturnType<typeof getSpecificationStatusFromCapability>;

function parseSpecCreateInput(input: unknown): SpecCreateInput {
  const parsed = specCreateInputSchema.safeParse(input);
  if (!parsed.success) {
    throw new CapabilityDispatchError('Invalid input for capability spec.create', 'invalid_input');
  }
  return parsed.data;
}

function parseSpecGetStatusInput(input: unknown): SpecGetStatusInput {
  const parsed = specGetStatusInputSchema.safeParse(input);
  if (!parsed.success) {
    throw new CapabilityDispatchError('Invalid input for capability spec.getStatus', 'invalid_input');
  }
  return parsed.data;
}

function assertExecutableCapability(
  capability: string,
): asserts capability is keyof typeof capabilityInputSchemas {
  try {
    getCapabilityContract(capability as CapabilityId);
  } catch {
    throw new CapabilityDispatchError(`Unknown capability ${capability}`, 'unknown_capability');
  }

  if (!(capability in capabilityInputSchemas)) {
    throw new CapabilityDispatchError(
      `Capability ${capability} has no executable handler`,
      'unknown_capability',
    );
  }
}

function createSpecificationFromCapability(db: DB, input: SpecCreateInput) {
  const specification = createNewSpecification(
    db,
    input.name,
    input.mode === 'brownfield' ? { mode: input.mode } : {},
  );
  return {
    specId: specification.id,
    specification,
  };
}

function getSpecificationStatusFromCapability(db: DB, input: SpecGetStatusInput) {
  const state = getSpecificationState(db, input.specId);
  if (!state) {
    throw new CapabilityDispatchError(`Specification ${input.specId} not found`, 'handler_failed');
  }
  return state;
}

export function dispatchCapability(input: {
  db: DB;
  capability: 'spec.create';
  input: unknown;
}): Promise<SpecCreateOutput>;
export function dispatchCapability(input: {
  db: DB;
  capability: 'spec.getStatus';
  input: unknown;
}): Promise<SpecGetStatusOutput>;
export function dispatchCapability(input: DispatchCapabilityInput): Promise<unknown>;
export async function dispatchCapability({
  db,
  capability,
  input,
}: DispatchCapabilityInput): Promise<unknown> {
  assertExecutableCapability(capability);

  if (capability === 'spec.create') {
    return createSpecificationFromCapability(db, parseSpecCreateInput(input));
  }

  if (capability === 'spec.getStatus') {
    return getSpecificationStatusFromCapability(db, parseSpecGetStatusInput(input));
  }

  throw new CapabilityDispatchError('Capability has no executable handler', 'unknown_capability');
}
