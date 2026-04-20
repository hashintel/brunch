import * as z from 'zod/v4';

import {
  createProjectRequestSchema,
  createProjectResponseSchema,
  projectListItemSchema,
  projectListItemsSchema,
  projectModeSchema,
  projectSchema,
  projectStateSchema,
  projectStateTurnSchema,
  type CreateProjectRequest,
  type CreateProjectResponse,
  type Project,
  type ProjectListItem,
  type ProjectMode,
} from './api-types.js';

export const specificationModeSchema = projectModeSchema;
export const specificationSchema = projectSchema;

const canonicalSpecificationTurnSchema = projectStateTurnSchema.omit({ project_id: true }).extend({
  specification_id: projectStateTurnSchema.shape.project_id,
});

export const specificationTurnSchema = z
  .union([canonicalSpecificationTurnSchema, projectStateTurnSchema])
  .transform((turn) => {
    if ('project_id' in turn) {
      const { project_id, ...rest } = turn;
      return {
        ...rest,
        specification_id: project_id,
      };
    }

    return turn;
  });

const canonicalSpecificationStateInputSchema = projectStateSchema
  .omit({ project: true, turns: true })
  .extend({
    specification: specificationSchema,
    turns: z.array(specificationTurnSchema),
  });

export const specificationListItemSchema = projectListItemSchema;
export const specificationListSchema = projectListItemsSchema;
export const specificationStateSchema = z
  .union([canonicalSpecificationStateInputSchema, projectStateSchema])
  .transform((state) => {
    if ('project' in state) {
      const { project, turns, ...rest } = state;
      return {
        ...rest,
        specification: project,
        turns: turns.map((turn) => specificationTurnSchema.parse(turn)),
      };
    }

    return {
      ...state,
      turns: state.turns.map((turn) => specificationTurnSchema.parse(turn)),
    };
  });
export const createSpecificationRequestSchema = createProjectRequestSchema;
export const createSpecificationResponseSchema = createProjectResponseSchema;

export type SpecificationMode = ProjectMode;
export type Specification = Project;
type CanonicalSpecificationTurn = z.output<typeof specificationTurnSchema>;
export type SpecificationTurn = Omit<CanonicalSpecificationTurn, 'specification_id'> & {
  specification_id?: number;
  project_id?: number;
};
export type SpecificationListItem = ProjectListItem;
type CanonicalSpecificationState = z.output<typeof specificationStateSchema>;
export type SpecificationState = Omit<CanonicalSpecificationState, 'specification' | 'turns'> & {
  specification?: Specification;
  project?: Specification;
  turns: SpecificationTurn[];
};
export type CreateSpecificationRequest = CreateProjectRequest;
export type CreateSpecificationResponse = CreateProjectResponse;

export function getSpecificationRecord(
  state: SpecificationState | { specification?: Specification; project?: Specification },
): Specification {
  const specification = 'specification' in state ? state.specification : undefined;
  const project = 'project' in state ? state.project : undefined;

  if (specification) {
    return specification;
  }
  if (project) {
    return project;
  }

  throw new Error('Specification record is missing');
}
