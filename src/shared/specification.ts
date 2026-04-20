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
  createSpecificationRequestSchema,
  createSpecificationResponseSchema,
  specificationListItemSchema,
  specificationListItemsSchema,
  specificationModeSchema,
  specificationSchema,
  specificationStateSchema,
  specificationStateTurnSchema,
} from './api-types.js';

export {
  specificationModeSchema,
  specificationSchema,
  specificationStateSchema,
  specificationStateTurnSchema,
};
export { createSpecificationRequestSchema, createSpecificationResponseSchema, specificationListItemSchema };
export const specificationListSchema = specificationListItemsSchema;
export const specificationTurnSchema = specificationStateTurnSchema;

export type SpecificationMode = ApiSpecificationMode;
export type Specification = ApiSpecification;
export type SpecificationTurn = ApiSpecificationStateTurn;
export type SpecificationListItem = ApiSpecificationListItem;
export type SpecificationState = ApiSpecificationState;
export type CreateSpecificationRequest = ApiCreateSpecificationRequest;
export type CreateSpecificationResponse = ApiCreateSpecificationResponse;

export function getSpecificationRecord(state: Pick<SpecificationState, 'specification'>): Specification {
  return state.specification;
}
