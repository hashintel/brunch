export const STRUCTURED_EXCHANGE_PRESENT_SCHEMA = 'brunch.structured_exchange.present' as const;
export const STRUCTURED_EXCHANGE_REQUEST_SCHEMA = 'brunch.structured_exchange.request' as const;

export type PresentToolName =
  | 'present_question'
  | 'present_options'
  | 'present_review_set'
  | 'present_candidates';
export type RequestToolName = 'request_answer' | 'request_choice' | 'request_choices' | 'request_review';

export type StructuredExchangePresentKind = 'question' | 'options' | 'review_set' | 'candidates';

export interface StructuredExchangeExpectedRequest {
  tool: RequestToolName;
  required: boolean;
}

export interface StructuredExchangePresentDetails {
  schema: typeof STRUCTURED_EXCHANGE_PRESENT_SCHEMA;
  schemaVersion: 1;
  exchangeId: string;
  presentTool: PresentToolName;
  kind: StructuredExchangePresentKind;
  status: 'presented';
  expectedRequest?: StructuredExchangeExpectedRequest;
  createdAtToolCallId: string;
}

export interface StructuredExchangeChoice {
  id: string;
  label: string;
}

export interface StructuredExchangeRequestDetails {
  schema: typeof STRUCTURED_EXCHANGE_REQUEST_SCHEMA;
  schemaVersion: 1;
  exchangeId: string;
  requestTool: RequestToolName;
  status: 'answered' | 'cancelled' | 'unavailable';
  respondsTo: {
    exchangeId: string;
    presentTool: PresentToolName;
  };
  choice?: StructuredExchangeChoice;
  choices?: StructuredExchangeChoice[];
  answer?: string;
  review?: 'approve' | 'change-request' | 'reject';
  comment?: string;
  message?: string;
  createdAtToolCallId: string;
}

export interface ToolTextContent {
  type: 'text';
  text: string;
}

export interface ToolTextResult<TDetails> {
  content: ToolTextContent[];
  details: TDetails;
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
