import * as z from 'zod';

// Mirrors Petrinaut staging's strict Brunch definition contract at the streamed consumer boundary.
const inputArcSchema = z
  .object({
    placeId: z.string().min(1),
    weight: z.number().int().positive(),
    type: z.enum(['standard', 'inhibitor']),
  })
  .strict();

const outputArcSchema = z
  .object({ placeId: z.string().min(1), weight: z.number().int().positive() })
  .strict();

export const petrinautBrunchDefinitionSchema = z
  .object({
    version: z.number().int().positive(),
    meta: z.object({ generator: z.string().min(1), generatorVersion: z.string().optional() }).strict(),
    title: z.string().min(1),
    places: z.array(
      z
        .object({
          id: z.string().min(1),
          name: z.string().min(1),
          x: z.number(),
          y: z.number(),
        })
        .strict(),
    ),
    transitions: z.array(
      z
        .object({
          id: z.string().min(1),
          name: z.string().min(1),
          x: z.number(),
          y: z.number(),
          inputArcs: z.array(inputArcSchema),
          outputArcs: z.array(outputArcSchema),
        })
        .strict(),
    ),
  })
  .strict();
