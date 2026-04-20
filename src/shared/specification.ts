import type {
  CreateSpecificationRequest as ApiCreateSpecificationRequest,
  CreateSpecificationResponse as ApiCreateSpecificationResponse,
  Specification as ApiSpecification,
  SpecificationListItem as ApiSpecificationListItem,
  SpecificationMode as ApiSpecificationMode,
  SpecificationState as ApiSpecificationState,
  SpecificationStateTurn as ApiSpecificationStateTurn,
} from './api-types.js';
import {
  createProjectRequestSchema,
  createProjectResponseSchema,
  createSpecificationRequestSchema,
  createSpecificationResponseSchema,
  projectListItemSchema,
  projectListItemsSchema,
  specificationModeSchema,
  specificationSchema,
  specificationStateSchema,
  specificationStateTurnSchema,
} from './api-types.js';

export { specificationModeSchema, specificationSchema };
export const specificationListItemSchema = projectListItemSchema;
export const specificationListSchema = projectListItemsSchema;
export const specificationTurnSchema = specificationStateTurnSchema;
export { specificationStateSchema, specificationStateTurnSchema };
export { createSpecificationRequestSchema, createSpecificationResponseSchema };

export type SpecificationMode = ApiSpecificationMode;
export type Specification = ApiSpecification;
export type SpecificationTurn = Omit<ApiSpecificationStateTurn, 'specification_id'> & {
  specification_id?: number;
  project_id?: number;
};
export type SpecificationListItem = ApiSpecificationListItem;
export type SpecificationState = Omit<ApiSpecificationState, 'specification' | 'turns'> & {
  specification?: Specification;
  project?: Specification;
  turns: SpecificationTurn[];
};
export type CreateSpecificationRequest = ApiCreateSpecificationRequest;
export type CreateSpecificationResponse = ApiCreateSpecificationResponse;

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

export { createProjectRequestSchema, createProjectResponseSchema };
