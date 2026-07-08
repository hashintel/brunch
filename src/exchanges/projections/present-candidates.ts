import type {
  AskContinuationDeclaration,
  PresentCandidatesDetails,
  PresentCandidatesParams,
} from '../schemas/index.js';
import { STRUCTURED_EXCHANGE_PRESENT_DETAILS_SCHEMA } from '../schemas/index.js';
import { normalizeOptionalText } from '../text.js';

export interface PresentCandidatesProjection {
  readonly heading: string;
  readonly body?: string;
  readonly details: PresentCandidatesDetails;
}

export function projectPresentCandidates(input: PresentCandidatesParams): PresentCandidatesProjection {
  const heading = input.heading.trim();
  const body = normalizeOptionalText(input.body);
  const details: PresentCandidatesDetails = {
    schema: STRUCTURED_EXCHANGE_PRESENT_DETAILS_SCHEMA,
    v: 1,
    exchange_id: input.exchangeId,
    tool_meta: { curr: 'present_candidates', next: 'ask' },
    display: {
      heading,
      ...(body ? { body } : {}),
    },
    continuation: candidatesContinuation({ heading, body, candidates: input.candidates }),
    candidates: input.candidates.map((candidate) => ({
      id: candidate.id,
      title: candidate.title.trim(),
      user_rubric: candidate.user_rubric,
      meta_rubric: candidate.meta_rubric,
      graph_refs: candidate.graph_refs,
    })),
  };
  return { heading, ...(body ? { body } : {}), details };
}

function candidatesContinuation(input: {
  readonly heading: string;
  readonly body: string | undefined;
  readonly candidates: PresentCandidatesParams['candidates'];
}): AskContinuationDeclaration {
  return {
    tool: 'ask',
    params: {
      body: [input.heading, input.body].filter((part) => part && part.length > 0).join('\n\n'),
      options: input.candidates.map((candidate) => ({
        id: candidate.id,
        label: candidate.title.trim(),
        description: candidate.user_rubric.recommendation ?? candidate.user_rubric.core_bet,
      })),
    },
  };
}
