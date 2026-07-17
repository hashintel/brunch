// The model-authored plan candidate (FE-1197 slice B). The schema deliberately has no
// command surface: the planner references capability ids and graph provenance only;
// deterministic providers resolve what may run (D130-L).

import { Type, type Static } from 'typebox';
import { Value } from 'typebox/value';

const NonBlankString = Type.String({ minLength: 1, pattern: '\\S' });

export const CandidatePlanSchema = Type.Object(
  {
    schemaVersion: Type.Integer({ minimum: 1, maximum: 1 }),
    specId: NonBlankString,
    epics: Type.Array(
      Type.Object(
        {
          id: NonBlankString,
          title: NonBlankString,
          dependsOn: Type.Array(Type.String()),
          verificationCriterionIds: Type.Array(Type.String()),
        },
        { additionalProperties: false },
      ),
    ),
    slices: Type.Array(
      Type.Object(
        {
          id: NonBlankString,
          epicId: NonBlankString,
          // The wire contract accepts absent/null/blank scope ids; admission
          // normalizes all three to absence before validation.
          scopeId: Type.Optional(Type.Union([Type.String(), Type.Null()])),
          title: NonBlankString,
          goal: NonBlankString,
          doneCriteria: Type.Array(Type.String()),
          requirementIds: Type.Array(Type.String()),
          criterionIds: Type.Array(Type.String()),
          dependsOn: Type.Array(Type.String()),
          designItemIds: Type.Array(Type.String()),
          verificationItemIds: Type.Array(Type.String()),
        },
        { additionalProperties: false },
      ),
    ),
    requiredCapabilities: Type.Array(
      Type.Object(
        {
          id: NonBlankString,
          sourceItemId: NonBlankString,
        },
        { additionalProperties: false },
      ),
    ),
  },
  { additionalProperties: false },
);

type DeepReadonly<Value> = Value extends readonly (infer Item)[]
  ? readonly DeepReadonly<Item>[]
  : Value extends object
    ? { readonly [Key in keyof Value]: DeepReadonly<Value[Key]> }
    : Value;

type CandidatePlanWire = Static<typeof CandidatePlanSchema>;
type CandidatePlanWireSlice = CandidatePlanWire['slices'][number];
type NormalizedCandidatePlan = Omit<CandidatePlanWire, 'slices'> & {
  slices: (Omit<CandidatePlanWireSlice, 'scopeId'> & { scopeId?: string })[];
};

export type CandidatePlan = DeepReadonly<NormalizedCandidatePlan>;

export type ParseCandidatePlanResult =
  | { readonly status: 'ok'; readonly candidate: CandidatePlan }
  | { readonly status: 'malformed_candidate'; readonly message: string };

export function parseCandidatePlan(input: unknown): ParseCandidatePlanResult {
  const malformed = (message: string): ParseCandidatePlanResult => ({
    status: 'malformed_candidate',
    message,
  });
  if (typeof input === 'string') {
    try {
      return parseCandidatePlan(JSON.parse(input));
    } catch (error) {
      return malformed(
        `candidate is not valid JSON: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
  if (
    typeof input === 'object' &&
    input !== null &&
    !Array.isArray(input) &&
    'schemaVersion' in input &&
    input.schemaVersion !== 1
  ) {
    return malformed(`unsupported candidate schema version: ${String(input.schemaVersion)}`);
  }
  if (!Value.Check(CandidatePlanSchema, input)) {
    const detail = [...Value.Errors(CandidatePlanSchema, input)]
      .map((issue) => `${issue.instancePath || '/'} ${issue.message}`)
      .join('; ');
    return malformed(`candidate does not match schema: ${detail}`);
  }

  const wire = Value.Parse(CandidatePlanSchema, input);
  return {
    status: 'ok',
    candidate: {
      ...wire,
      slices: wire.slices.map(({ scopeId, ...slice }) => ({
        ...slice,
        ...(typeof scopeId === 'string' && scopeId.trim().length > 0 ? { scopeId } : {}),
      })),
    },
  };
}
