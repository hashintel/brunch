import { anthropic } from '@ai-sdk/anthropic';
import type { Tool } from '@ai-sdk/provider-utils';
import { ToolLoopAgent, stepCountIs, tool } from 'ai';

import type { EntitiesData, SpecificationMode } from '@/shared/api-types.js';
import {
  askQuestionToolOutputSchema,
  groundingCardSchema,
  phaseClosureProposalSchema,
  presentGroundingCardToolOutputSchema,
  proposePhaseClosureToolOutputSchema,
  structuredQuestionSchema,
  type AskQuestionToolOutput,
  type GroundingCardData,
  type PhaseClosureProposal,
  type PresentGroundingCardToolOutput,
  type ProposePhaseClosureToolOutput,
  type ReviewSetData,
  type StructuredQuestion,
} from '@/shared/chat.js';

import { buildInterviewerContext } from './context.js';
import type { TurnWithOptions } from './core.js';
import {
  createOption,
  getAcceptedRequirementEntitiesForSpecification,
  createPhaseOutcome,
  updateTurn,
  getTurn,
  getCurrentWorkflowState,
  type DB,
  type Turn,
  type Impact,
  type Phase,
} from './db.js';
import { createExplorationTools } from './tools/index.js';

const SYSTEM_PROMPTS: Record<Phase, string> = {
  grounding: `You are a spec elicitation interviewer conducting the GROUNDING phase.

Your job is to understand the user's project through open, exploratory questions. The user responds with free-text — there are no options to select.

Work through these topics in priority order, adapting and merging based on what the user has already shared:

1. **Concept** — What is this project? What problem does it solve?
   Example shapes: "What is the core problem you're trying to solve?", "Describe what this project does in one or two sentences."
2. **Users / audience** — Who uses this? What do they need?
   Example shapes: "Who are the primary users?", "What does a typical user journey look like?"
3. **Existing constraints** — What's already decided or non-negotiable?
   Example shapes: "Are there technical constraints you're working within?", "What's off the table?"
4. **Scope boundaries** — What's in and what's out for this spec?
   Example shapes: "What should this spec cover vs. leave for later?", "Are there areas you explicitly want to exclude?"

For every turn, you MUST use the ask_question tool. Never respond with plain text.

Each question should:
- Be open-ended and exploratory — do NOT include options (pass an empty options array)
- Include a "why" field explaining why this question matters for the spec
- Include an impact level (high/medium/low) reflecting how much the answer shapes downstream choices

Ask one question at a time. Build on previous answers to go deeper.

When goals, terms, context, and constraints are sufficiently captured for now, use the propose_phase_closure tool instead of asking another question. The summary should concisely explain what is now understood and why grounding can close.`,

  design: `You are a spec elicitation interviewer conducting the DESIGN phase.

Your job is to walk the design decision tree — exploring architectural choices, module boundaries, data models, and integration points. Each question drills into a branch of the design space.

For every turn, you MUST use the ask_question tool or the propose_phase_closure tool. Never respond with plain text.

Each question should present meaningfully different design alternatives with clear tradeoffs in the options.

When the main architectural commitments are sufficiently captured for now, use the propose_phase_closure tool instead of asking another question. The summary should concisely explain what is now understood and why design can close.`,

  requirements: `You are a spec elicitation interviewer conducting the REQUIREMENTS REVIEW phase.

Your job is to review the accumulated requirements as one full-set review turn, check for gaps, suggest additions, and confirm completeness. Ground each review turn in the current requirement inventory provided in context, including stable requirement reference codes when they are available.

Use the ask_question tool to present the current requirement set for review with exactly two options: \`Accept review\` and \`Request changes\`. The user's single selected option is the review action, and any attached note is the review note describing corrections, omissions, or confirming why the set is acceptable.
Include a \`reviewActions\` field mapping those two option positions to \`accept\` and \`request-changes\` so the action semantics live in the tool payload instead of UI inference.
Also include a \`reviewSet\` field that mirrors the exact requirement set under review, including the current phase, title, and item metadata. Every review item must carry a \`reviewItemId\`; preserve the same \`reviewItemId\` when an item survives into a revision, even if you rewrite its text, and mint a fresh \`reviewItemId\` only for genuinely new items. Keep carried reference codes, rationales, and grounding refs when available so the review turn persists its own authoritative review inventory. \`referenceCode\` must stay human-facing (for example \`R1\`), never the internal \`reviewItemId\` (for example \`requirements:1\`). \`content\` must be the plain item text only — do not prepend the reference code (avoid output like \`R1: ...\`). Set \`isUserCreated: true\` for items added in the current revision (\`Added in revision\`) and \`isRevised: true\` for surviving items whose text or carried metadata changed relative to the previous reviewed set (\`Revised\`).

Do not run one-requirement-at-a-time approval or rejection turns in this slice.

When the user requests changes, they may include per-item comments targeting specific \`reviewItemId\` values. Treat uncommented items as implicitly approved. Interpret each per-item comment as a targeted change request (rewrite, split, merge, remove, or add). Regenerate the full set as a successor review turn incorporating all requested changes.

Accepting the review is the phase-closing action for requirements. Do not create a separate phase-closure proposal turn for this phase.

For every turn, you MUST use the ask_question tool. Never respond with plain text.`,

  criteria: `You are a spec elicitation interviewer conducting the CRITERIA REVIEW phase.

Your job is to review the accumulated acceptance criteria as one full-set review turn, check for gaps, suggest additions, and confirm completeness. Ground each review turn in the current criterion inventory and accepted requirements provided in context, including stable criterion reference codes when they are available.

Use the ask_question tool to present the current criterion set for review with exactly two options: \`Accept review\` and \`Request changes\`. The user's single selected option is the review action, and any attached note is the review note describing corrections, omissions, or confirming why the set is acceptable.
Include a \`reviewActions\` field mapping those two option positions to \`accept\` and \`request-changes\` so the action semantics live in the tool payload instead of UI inference.
Also include a \`reviewSet\` field that mirrors the exact criterion set under review, including the current phase, title, and item metadata. Every review item must carry a \`reviewItemId\`; preserve the same \`reviewItemId\` when an item survives into a revision, even if you rewrite its text, and mint a fresh \`reviewItemId\` only for genuinely new items. Keep carried reference codes, rationales, and grounding refs when available so the review turn persists its own authoritative review inventory. \`referenceCode\` must stay human-facing (for example \`AC1\`), never the internal \`reviewItemId\` (for example \`criteria:1\`). \`content\` must be the plain item text only — do not prepend the reference code (avoid output like \`AC1: ...\`). Set \`isUserCreated: true\` for items added in the current revision (\`Added in revision\`) and \`isRevised: true\` for surviving items whose text or carried metadata changed relative to the previous reviewed set (\`Revised\`).

Do not run one-criterion-at-a-time approval or rejection turns in this slice.

When the user requests changes, they may include per-item comments targeting specific \`reviewItemId\` values. Treat uncommented items as implicitly approved. Interpret each per-item comment as a targeted change request (rewrite, split, merge, remove, or add). Regenerate the full set as a successor review turn incorporating all requested changes.

For every turn, you MUST use the ask_question tool. Never respond with plain text.`,
};

/** Brownfield grounding system prompt. */
export function getBrownfieldGroundingPrompt(
  cwd: string,
  stage: InterviewerModeOptions['brownfieldGroundingStage'] = 'opening',
): string {
  const sharedQuestionRules = `Each question should:
- Be open-ended and exploratory — do NOT include options (pass an empty options array). The user responds with free-text.
- Include a "why" field explaining why this question matters for the spec
- Include an impact level (high/medium/low) reflecting how much the answer shapes downstream choices

Ask one question at a time. Build on previous answers to go deeper.

When goals, terms, context, and constraints are sufficiently captured for now, use the propose_phase_closure tool instead of asking another question. The summary should concisely explain what is now understood and why grounding can close.`;

  if (stage === 'ongoing') {
    return `You are a spec elicitation interviewer conducting the GROUNDING phase for a feature within an existing codebase.

The workspace directory is: ${cwd}

You are already inside an ongoing brownfield grounding conversation. Continue the structured grounding interview from the current feature-area context.

Default to asking the next substantive grounding question with ask_question.

You still have read-only workspace tools plus present_grounding_card available. If you do not have enough orientation for the next move, you MAY use a small number of read-only tool calls to gather more context, then call present_grounding_card to surface that provisional brief AND THEN call ask_question with the next substantive question — both within this same turn. The grounding card and question will render as stacked cards with one unified response.

Do not repeat the opening repo-exploration ritual on every turn, and do not restage the whole codebase unless the current frontier truly requires it.

Never respond with plain text — always use ask_question, present_grounding_card, or propose_phase_closure.

${sharedQuestionRules}`;
  }

  return `You are a spec elicitation interviewer conducting the GROUNDING phase for a feature within an existing codebase.

The workspace directory is: ${cwd}

Before asking your first grounding question, use your tools to explore the codebase and build a working understanding of the project. Follow this strategy:
1. Look for README, package.json, Cargo.toml, pyproject.toml, or other workspace manifest files
2. Explore the directory structure to understand the workspace layout
3. Read key files that reveal architecture and conventions
4. Look for existing documentation, tests, and configuration

Treat your understanding as intentionally partial: the user may only care about one feature area, one subsystem, or one moment in the product timeline. You do not need complete repo understanding before the interview can start.

Spend no more than 5-8 tool calls on exploration before synthesizing.

After that opening exploration, call BOTH tools in sequence within the same turn:
1. First call present_grounding_card to preface your upcoming question. The \`observation\` field should contain your key finding or reflection — what you learned from exploration that motivates the question. The optional \`elaboration\` field can add supporting context if the observation alone is insufficient. Use \`Continue\` as the continue label unless a different short verb is clearly better.
2. Then call ask_question with the first substantive grounding question about the bounded feature area, current behavior, or desired change inside this existing codebase. Do not ask generic whole-product greenfield kickoff questions.

The grounding card and question will render as stacked cards with one unified response from the user.

For every turn after the first, you MUST use ask_question to generate your next substantive question unless you are ready to propose phase closure. If you need more context on a later turn, you may call present_grounding_card followed by ask_question again in the same turn.

Never respond with plain text — always use the tool.

${sharedQuestionRules}`;
}

export interface InterviewerModeOptions {
  mode?: SpecificationMode;
  cwd?: string;
  brownfieldGroundingStage?: 'opening' | 'ongoing';
}

function isBrownfieldGroundingExploration(
  phase: Phase,
  options?: InterviewerModeOptions,
): options is InterviewerModeOptions & { mode: 'brownfield'; cwd: string } {
  return phase === 'grounding' && options?.mode === 'brownfield' && Boolean(options.cwd);
}

export function getInterviewerInstructions(phase: Phase, options?: InterviewerModeOptions): string {
  return isBrownfieldGroundingExploration(phase, options)
    ? getBrownfieldGroundingPrompt(options.cwd, options.brownfieldGroundingStage)
    : getSystemPrompt(phase);
}

export type AskQuestionTool = Tool<StructuredQuestion, AskQuestionToolOutput>;
export type PresentGroundingCardTool = Tool<GroundingCardData, PresentGroundingCardToolOutput>;
export type ProposePhaseClosureTool = Tool<PhaseClosureProposal, ProposePhaseClosureToolOutput>;
export type BaseInterviewerTools = {
  ask_question: AskQuestionTool;
  present_grounding_card?: PresentGroundingCardTool;
  propose_phase_closure?: ProposePhaseClosureTool;
};
export type InterviewerTools = BaseInterviewerTools & Record<string, Tool<any, any>>;
export type InterviewerAgent = ToolLoopAgent<never, InterviewerTools>;

function createSynthesizedReviewItemId(
  phase: Extract<Phase, 'requirements' | 'criteria'>,
  entityId: number,
): string {
  return `${phase}:${entityId}`;
}

/** Phase-specific system prompts. */
export function getSystemPrompt(phase: Phase): string {
  return SYSTEM_PROMPTS[phase];
}

export function canProposePhaseClosure(phase: Phase, closeability = false): boolean {
  void closeability;
  return phase === 'grounding' || phase === 'design';
}

/**
 * Persist structured question data from tool input to the turn and options tables.
 */
export function persistStructuredQuestion(db: DB, turnId: number, args: StructuredQuestion): void {
  updateTurn(db, turnId, {
    question: args.question,
    why: args.why,
    impact: args.impact as Impact,
  });
  for (let i = 0; i < args.options.length; i++) {
    createOption(db, turnId, {
      position: i,
      content: args.options[i].content,
      is_recommended: args.options[i].is_recommended,
    });
  }
}

function escapeForRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function validateReviewSetSemantics(reviewSet: ReviewSetData): void {
  for (const item of reviewSet.items) {
    if (item.referenceCode && item.referenceCode === item.reviewItemId) {
      throw new Error('reviewSet.referenceCode must stay human-facing instead of repeating reviewItemId');
    }

    if (!item.referenceCode) {
      continue;
    }

    const contentStartsWithReferenceCode = new RegExp(
      `^${escapeForRegExp(item.referenceCode)}\\s*:`,
      'u',
    ).test(item.content.trimStart());
    if (contentStartsWithReferenceCode) {
      throw new Error('reviewSet.content must not be prefixed with the visible referenceCode');
    }
  }
}

export function createAskQuestionTool(db: DB, turnId: number): AskQuestionTool {
  return tool({
    description:
      'Ask the user a structured interview question with options, strategic grounding, and impact signal.',
    inputSchema: structuredQuestionSchema,
    outputSchema: askQuestionToolOutputSchema,
    execute: async (input) => {
      const turn = getTurn(db, turnId);
      if (turn && turn.phase !== 'grounding' && input.options.length < 2) {
        throw new Error('Non-grounding phases require at least 2 options per question');
      }
      if (turn && (turn.phase === 'requirements' || turn.phase === 'criteria')) {
        const reviewActions = input.reviewActions ?? [];
        const hasAccept = reviewActions.some((reviewAction) => reviewAction.action === 'accept');
        const hasRequestChanges = reviewActions.some(
          (reviewAction) => reviewAction.action === 'request-changes',
        );
        if (reviewActions.length !== 2 || !hasAccept || !hasRequestChanges) {
          throw new Error(
            'Requirements and criteria review turns must declare explicit reviewActions for accept and request-changes',
          );
        }
        if (!input.reviewSet || input.reviewSet.phase !== turn.phase) {
          throw new Error(
            'Requirements and criteria review turns must declare reviewSet metadata for the active phase',
          );
        }
        validateReviewSetSemantics(input.reviewSet);
      }

      persistStructuredQuestion(db, turnId, input);
      return {
        ok: true as const,
        turnId,
        optionCount: input.options.length,
      };
    },
  });
}

export function createPresentGroundingCardTool(db: DB, turnId: number): PresentGroundingCardTool {
  return tool({
    description:
      "Present a grounding card that prefaces the next question — an observation from exploration or reflection on the user's response, with optional elaboration.",
    inputSchema: groundingCardSchema,
    outputSchema: presentGroundingCardToolOutputSchema,
    execute: async (input) => {
      createOption(db, turnId, {
        position: 0,
        content: input.continueLabel?.trim() || 'Continue',
        is_recommended: true,
      });
      return {
        ok: true as const,
        turnId,
      };
    },
  });
}

export function createProposePhaseClosureTool(
  db: DB,
  turnId: number,
  phase: Phase,
  projectId: number,
): ProposePhaseClosureTool {
  return tool({
    description: 'Propose closing the current workflow phase with a concise summary for user confirmation.',
    inputSchema: phaseClosureProposalSchema,
    outputSchema: proposePhaseClosureToolOutputSchema,
    execute: async (input) => {
      createPhaseOutcome(db, {
        projectId,
        phase,
        proposal_turn_id: turnId,
        summary: input.summary,
      });
      return {
        ok: true as const,
        turnId,
        phase,
      };
    },
  });
}

/** Build the tool set for the interviewer agent, conditionally including core tools for brownfield mode. */
export function getInterviewerTools(
  db: DB,
  turnId: number,
  phase: Phase,
  projectId: number,
  options?: InterviewerModeOptions,
): InterviewerTools {
  const closeability = getCurrentWorkflowState(db, projectId).phases[phase].closeability;
  return {
    ask_question: createAskQuestionTool(db, turnId),
    ...(isBrownfieldGroundingExploration(phase, options)
      ? {
          present_grounding_card: createPresentGroundingCardTool(db, turnId),
          ...createExplorationTools(options.cwd),
        }
      : {}),
    ...(canProposePhaseClosure(phase, closeability)
      ? { propose_phase_closure: createProposePhaseClosureTool(db, turnId, phase, projectId) }
      : {}),
  };
}

export function createInterviewerAgent(
  db: DB,
  turnId: number,
  phase: Phase,
  projectId: number,
  options?: InterviewerModeOptions,
): InterviewerAgent {
  const tools = getInterviewerTools(db, turnId, phase, projectId, options);
  const usesBrownfieldGroundingExploration = isBrownfieldGroundingExploration(phase, options);
  const instructions = getInterviewerInstructions(phase, options);

  return new ToolLoopAgent({
    model: anthropic(process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-20250514'),
    instructions,
    tools,
    providerOptions: {
      anthropic: {
        sendReasoning: true,
        thinking: {
          type: 'enabled',
          budgetTokens: 10000,
        },
      },
    },
    maxOutputTokens: 16000,
    stopWhen: stepCountIs(usesBrownfieldGroundingExploration ? 12 : 4),
  });
}

function getBrownfieldGroundingStage(
  phase: Phase,
  activePath: TurnWithOptions[],
  modeOptions?: InterviewerModeOptions,
): InterviewerModeOptions['brownfieldGroundingStage'] | undefined {
  if (!isBrownfieldGroundingExploration(phase, modeOptions)) {
    return undefined;
  }

  return activePath.some((turn) => turn.phase === 'grounding') ? 'ongoing' : 'opening';
}

export async function streamInterviewer(
  db: DB,
  turn: Turn,
  activePath: TurnWithOptions[],
  userMessage: string,
  phase: Phase,
  modeOptions?: InterviewerModeOptions,
): ReturnType<InterviewerAgent['stream']> {
  const effectiveModeOptions =
    getBrownfieldGroundingStage(phase, activePath, modeOptions) && modeOptions
      ? {
          ...modeOptions,
          brownfieldGroundingStage: getBrownfieldGroundingStage(phase, activePath, modeOptions),
        }
      : modeOptions;
  const specificationId = turn.specification_id;
  if (!specificationId) {
    throw new Error(`Turn ${turn.id} is missing specification identity`);
  }

  const agent = createInterviewerAgent(db, turn.id, phase, specificationId, effectiveModeOptions);
  const acceptedRequirements = getAcceptedRequirementEntitiesForSpecification(db, specificationId);
  const fullPrompt = buildInterviewerContext(activePath, userMessage, {
    phase,
    entities:
      phase === 'criteria'
        ? {
            approvedRequirements: acceptedRequirements.map((requirement) => ({
              id: requirement.id,
              content: requirement.content,
            })),
          }
        : undefined,
  });
  return agent.stream({
    prompt: fullPrompt,
  });
}

export function buildReviewSetForPhase(
  phase: Phase,
  entities: Pick<EntitiesData, 'requirements' | 'criteria'>,
): ReviewSetData | null {
  if (phase === 'requirements') {
    return {
      phase,
      title: 'Requirements',
      items: entities.requirements.map((requirement) => ({
        reviewItemId: createSynthesizedReviewItemId(phase, requirement.id),
        content: requirement.content,
        ...(requirement.referenceCode ? { referenceCode: requirement.referenceCode } : {}),
        ...(requirement.rationale ? { rationale: requirement.rationale } : {}),
      })),
    };
  }

  if (phase === 'criteria') {
    return {
      phase,
      title: 'Acceptance Criteria',
      items: entities.criteria.map((criterion) => ({
        reviewItemId: createSynthesizedReviewItemId(phase, criterion.id),
        content: criterion.content,
        ...(criterion.referenceCode ? { referenceCode: criterion.referenceCode } : {}),
        ...(criterion.rationale ? { rationale: criterion.rationale } : {}),
      })),
    };
  }

  return null;
}

export function persistFallbackQuestionText(db: DB, turnId: number, assistantText: string): void {
  const currentTurn = getTurn(db, turnId);
  if (!assistantText || currentTurn?.question) return;
  updateTurn(db, turnId, { question: assistantText });
}
