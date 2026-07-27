// Mirror of Petrinaut Core's `brunchNetDefinition` schema — the `.strict()`
// shape Petrinaut's "actual/live" Brunch route validates the streamed
// `definition` frame against. Kept in sync by hand; Petrinaut owns the source
// of truth. Brunch's `projectNetDefinition` output must `.parse` clean here
// (see petrinaut-stream-export.test.ts), so a Petrinaut-side tightening fails
// a brunch test instead of silently breaking the live demo. Temporary until
// the standardized Brunch/Petrinaut protocol is owned in Petrinaut Core.

import { z } from 'zod';

export const brunchInputArcSchema = z
  .object({
    placeId: z.string(),
    weight: z.number(),
    type: z.enum(['standard', 'read', 'inhibitor']).optional().default('standard'),
  })
  .strict();

export const brunchOutputArcSchema = z
  .object({
    placeId: z.string(),
    weight: z.number(),
  })
  .strict();

export const brunchPlaceSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    x: z.number().optional(),
    y: z.number().optional(),
  })
  .strict();

export const brunchTransitionSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    inputArcs: z.array(brunchInputArcSchema),
    outputArcs: z.array(brunchOutputArcSchema),
    x: z.number().optional(),
    y: z.number().optional(),
  })
  .strict();

export const brunchNetDefinitionSchema = z
  .object({
    version: z.number().optional().default(1),
    meta: z
      .object({
        generator: z.string().optional(),
        generatorVersion: z.string().optional(),
      })
      .optional(),
    title: z.string().optional().default('Brunch run'),
    places: z.array(brunchPlaceSchema),
    transitions: z.array(brunchTransitionSchema),
  })
  .strict();

export type BrunchNetDefinition = z.output<typeof brunchNetDefinitionSchema>;
