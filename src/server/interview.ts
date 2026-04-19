import { anthropic } from '@ai-sdk/anthropic';
import type { Tool } from '@ai-sdk/provider-utils';
import { ToolLoopAgent, stepCountIs, tool } from 'ai';

import type { EntitiesData, ProjectMode } from '@/shared/api-types.js';
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
  getAcceptedRequirementEntitiesForProject,
  getDraftCriterionEntitiesForProject,
  getDraftRequirementEntitiesForProject,
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
  scope: `You are a spec elicitation interviewer conducting the SCOPE phase.

Your job is to understand the user's project goals, key terms, operating context, and high-level constraints through structured questions. Work from broad scope questions toward specific boundaries.

For every turn, you MUST use the ask_question tool to generate your question. Never respond with plain text — always use the tool.

Each question should:
- Be clear and specific, not vague or open-ended
- Include 2-4 options that represent meaningfully different directions
- Mark exactly one option as recommended based on what you know so far
- Include a "why" field explaining why this question matters for the spec
- Include an impact level (high/medium/low) reflecting how much this decision affects downstream choices

Ask one question at a time. Build on previous answers to go deeper.

When goals, terms, context, and constraints are sufficiently captured for now, use the propose_phase_closure tool instead of asking another question. The summary should concisely explain what is now understood and why scope can close.`,

  design: `You are a spec elicitation interviewer conducting the DESIGN phase.

Your job is to walk the design decision tree — exploring architectural choices, module boundaries, data models, and integration points. Each question drills into a branch of the design space.

For every turn, you MUST use the ask_question tool or the propose_phase_closure tool. Never respond with plain text.

Each question should present meaningfully different design alternatives with clear tradeoffs in the options.

When the main architectural commitments are sufficiently captured for now, use the propose_phase_closure tool instead of asking another question. The summary should concisely explain what is now understood and why design can close.`,

  requirements: `You are a spec elicitation interviewer conducting the REQUIREMENTS REVIEW phase.

Your job is to review the accumulated requirements as one full-set review turn, check for gaps, suggest additions, and confirm completeness. Ground each review turn in the current requirement inventory provided in context, including stable requirement reference codes when they are available.

Use the ask_question tool to present the current requirement set for review with exactly two options: \`Accept review\` and \`Request changes\`. The user's single selected option is the review action, and any attached note is the review note describing corrections, omissions, or confirming why the set is acceptable.
Include a \`reviewActions\` field mapping those two option positions to \`accept\` and \`request-changes\` so the action semantics live in the tool payload instead of UI inference.
Also include a \`reviewSet\` field that mirrors the exact requirement set under review, including the current phase, title, and item metadata (reference codes and rationales when available), so the review turn persists its own authoritative review inventory.

Do not run one-requirement-at-a-time approval or rejection turns in this slice.

Accepting the review is the phase-closing action for requirements. Do not create a separate phase-closure proposal turn for this phase.

For every turn, you MUST use the ask_question tool. Never respond with plain text.`,

  criteria: `You are a spec elicitation interviewer conducting the CRITERIA REVIEW phase.

Your job is to review the accumulated acceptance criteria as one full-set review turn, check for gaps, suggest additions, and confirm completeness. Ground each review turn in the current criterion inventory and accepted requirements provided in context, including stable criterion reference codes when they are available.

Use the ask_question tool to present the current criterion set for review with exactly two options: \`Accept review\` and \`Request changes\`. The user's single selected option is the review action, and any attached note is the review note describing corrections, omissions, or confirming why the set is acceptable.
Include a \`reviewActions\` field mapping those two option positions to \`accept\` and \`request-changes\` so the action semantics live in the tool payload instead of UI inference.
Also include a \`reviewSet\` field that mirrors the exact criterion set under review, including the current phase, title, and item metadata (reference codes and rationales when available), so the review turn persists its own authoritative review inventory.

Do not run one-criterion-at-a-time approval or rejection turns in this slice.

For every turn, you MUST use the ask_question tool. Never respond with plain text.`,
};

/** Brownfield scope system prompt. Instructs the agent to explore the codebase before asking its first scope question. */
export function getBrownfieldScopePrompt(cwd: string): string {
  return `You are a spec elicitation interviewer conducting the SCOPE phase for a feature within an existing codebase.

The project directory is: ${cwd}

Before asking your first scope question, use your tools to explore the codebase and build a working understanding of the project. Follow this strategy:
1. Look for README, package.json, Cargo.toml, pyproject.toml, or other project manifest files
2. Explore the directory structure to understand the project layout
3. Read key files that reveal architecture and conventions
4. Look for existing documentation, tests, and configuration

Treat your understanding as intentionally partial: the user may only care about one feature area, one subsystem, or one moment in the product timeline. You do not need complete repo understanding before the interview can start.

Spend no more than 5-8 tool calls on exploration before synthesizing.

Once you have a working understanding, begin the structured scope interview grounded in that context — your questions should reflect what you discovered about the codebase.

After that opening exploration, your FIRST durable turn MUST use the present_grounding_card tool — not ask_question.
- Put the concise user-facing repo brief in the grounding card \`summary\` and optional \`detail\` fields.
- Keep it provisional and bounded to the likely feature area; do not dump raw file listings.
- Use \`Continue\` as the continue label unless a different short verb is clearly better.

Only AFTER the user continues from that grounding card should you use ask_question to ask the first substantive scope question about the bounded feature area, current behavior, or desired change inside this existing codebase. Do not ask generic whole-product greenfield kickoff questions.

For every turn after the grounding card handoff, you MUST use the ask_question tool to generate your next substantive question unless you are ready to propose phase closure. Never respond with plain text — always use the tool.

Each question should:
- Be clear and specific, not vague or open-ended
- Include 2-4 options that represent meaningfully different directions
- Mark exactly one option as recommended based on what you know so far
- Include a "why" field explaining why this question matters for the spec
- Include an impact level (high/medium/low) reflecting how much this decision affects downstream choices

Ask one question at a time. Build on previous answers to go deeper.

When goals, terms, context, and constraints are sufficiently captured for now, use the propose_phase_closure tool instead of asking another question. The summary should concisely explain what is now understood and why scope can close.`;
}

export interface InterviewerModeOptions {
  mode?: ProjectMode;
  cwd?: string;
}

function isBrownfieldScopeExploration(
  phase: Phase,
  options?: InterviewerModeOptions,
): options is InterviewerModeOptions & { mode: 'brownfield'; cwd: string } {
  return phase === 'scope' && options?.mode === 'brownfield' && Boolean(options.cwd);
}

export function getInterviewerInstructions(phase: Phase, options?: InterviewerModeOptions): string {
  return isBrownfieldScopeExploration(phase, options)
    ? getBrownfieldScopePrompt(options.cwd)
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

/** Phase-specific system prompts. */
export function getSystemPrompt(phase: Phase): string {
  return SYSTEM_PROMPTS[phase];
}

export function canProposePhaseClosure(phase: Phase, closeability = false): boolean {
  void closeability;
  return phase === 'scope' || phase === 'design';
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

export function createAskQuestionTool(db: DB, turnId: number): AskQuestionTool {
  return tool({
    description:
      'Ask the user a structured interview question with options, strategic grounding, and impact signal.',
    inputSchema: structuredQuestionSchema,
    outputSchema: askQuestionToolOutputSchema,
    execute: async (input) => {
      const turn = getTurn(db, turnId);
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
      'Present provisional repo or feature-area context as a grounding card before the next question.',
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
    ...(isBrownfieldScopeExploration(phase, options)
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
  const usesBrownfieldScopeExploration = isBrownfieldScopeExploration(phase, options);
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
    stopWhen: stepCountIs(usesBrownfieldScopeExploration ? 12 : 4),
  });
}

export async function streamInterviewer(
  db: DB,
  turn: Turn,
  activePath: TurnWithOptions[],
  userMessage: string,
  phase: Phase,
  modeOptions?: InterviewerModeOptions,
): ReturnType<InterviewerAgent['stream']> {
  const agent = createInterviewerAgent(db, turn.id, phase, turn.project_id, modeOptions);
  const draftRequirements = getDraftRequirementEntitiesForProject(db, turn.project_id);
  const draftCriteria = getDraftCriterionEntitiesForProject(db, turn.project_id);
  const acceptedRequirements = getAcceptedRequirementEntitiesForProject(db, turn.project_id);
  const fullPrompt = buildInterviewerContext(activePath, userMessage, {
    phase,
    entities:
      phase === 'requirements'
        ? {
            requirements: draftRequirements.map((requirement) => ({
              id: requirement.id,
              content: requirement.content,
            })),
          }
        : phase === 'criteria'
          ? {
              approvedRequirements: acceptedRequirements.map((requirement) => ({
                id: requirement.id,
                content: requirement.content,
              })),
              criteria: draftCriteria.map((criterion) => ({
                id: criterion.id,
                content: criterion.content,
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
