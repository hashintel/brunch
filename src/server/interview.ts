import { anthropic } from '@ai-sdk/anthropic';
import { ToolLoopAgent, stepCountIs, tool } from 'ai';

import type { EntitiesData, SpecificationMode } from '@/shared/api-types.js';
import {
  askQuestionToolOutputSchema,
  phaseClosureProposalSchema,
  prefaceSchema,
  presentPrefaceToolOutputSchema,
  proposePhaseClosureToolOutputSchema,
  structuredQuestionSchema,
  type ReviewSetData,
  type StructuredQuestion,
} from '@/shared/chat.js';

import { buildInterviewerContext } from './context.js';
import type { TurnWithOptions } from './core.js';
import {
  advanceHead,
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
import { renderPromptAsset } from './prompt-loader.js';
import { createExplorationTools } from './tools/index.js';

const SYSTEM_PROMPT_IDS = {
  grounding: 'interviewer.grounding',
  design: 'interviewer.design',
  requirements: 'interviewer.requirements',
  criteria: 'interviewer.criteria',
} as const satisfies Record<Phase, Parameters<typeof renderPromptAsset>[0]>;

/** Brownfield grounding system prompt. */
export function getBrownfieldGroundingPrompt(
  cwd: string,
  stage: InterviewerModeOptions['brownfieldGroundingStage'] = 'opening',
): string {
  const sharedQuestionRules = `Each question should:
- Start with open questions. As the user's responses narrow the space, you may add suggestive options as orientation aids — not binding choices. Whether to include options on any given question is your call based on conversational trajectory.
- Include a "why" field explaining what understanding you are seeking and how the answer helps formulate subsequent questions
- Include an impact level (high/medium/low) reflecting how much the answer shapes downstream choices

Ask one question at a time. Build on previous answers to go deeper.

When goals, terms, context, and constraints are sufficiently captured for now, use the propose_phase_closure tool instead of asking another question. The summary should concisely explain what is now understood and why grounding can close.`;

  if (stage === 'ongoing') {
    return `You are a spec elicitation interviewer conducting the GROUNDING phase. The user is specifying a feature or change within an existing codebase.

The workspace directory is: ${cwd}

Continue the structured grounding interview from the current feature-area context.

Default to asking the next substantive grounding question with ask_question.

You still have read-only workspace tools plus present_preface available. If you do not have enough orientation for the next move, you MAY use a small number of read-only tool calls to gather more context, then call present_preface to surface what you found AND THEN call ask_question — both within this same turn. When a preface precedes the question, keep the question concise: do NOT repeat or paraphrase observations from the preface. The preface contextualizes the question; the user responds only to the question, not to the preface. present_preface MUST always be followed by ask_question in the same turn.

Do not repeat the opening exploration on every turn, and do not restage the whole codebase unless the current frontier truly requires it.

Never respond with plain text — always use ask_question or propose_phase_closure.

${sharedQuestionRules}`;
  }

  return `You are a spec elicitation interviewer conducting the GROUNDING phase. The user is specifying a feature or change within an existing codebase.

The workspace directory is: ${cwd}

Before asking your first grounding question, use your tools to explore the codebase and build a working understanding of the project. Follow this strategy:
1. Look for README, package.json, Cargo.toml, pyproject.toml, or other project manifest files to understand what the project is and what it uses
2. Explore the top-level directory structure to understand the workspace layout
3. Read key files that reveal architecture, conventions, and domain concepts
4. Look for existing documentation, tests, and configuration

Treat your understanding as intentionally partial: the user may only care about one feature area, one subsystem, or one moment in the product timeline. You do not need complete repo understanding before the interview can start.

Spend no more than 5-8 tool calls on exploration before synthesizing.

After exploration, call BOTH tools in sequence within the same turn:
1. First call present_preface. The \`observation\` field should describe what you found — the concrete facts about the project that motivate your question (e.g. "This is a TypeScript monorepo with a Vite frontend and an Express API layer. The src/server directory contains route handlers for..."). Report what you observed, not what process you followed. The optional \`elaboration\` field can add supporting detail.
2. Then call ask_question with a concise, focused question. The preface has already established context — do NOT repeat or paraphrase observations from the preface in the question or its \`why\` field. The question should refer to the preface's context, not restate it.

The preface contextualizes the question — the user responds only to the question, not to the preface. present_preface MUST always be followed by ask_question in the same turn.

For every turn after the first, you MUST use ask_question to generate your next substantive question unless you are ready to propose phase closure. If you need more context on a later turn, you may call present_preface followed by ask_question again in the same turn.

Never respond with plain text — always use ask_question or propose_phase_closure.

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

/** Whether the interviewer has access to workspace exploration tools in this configuration. */
function hasExplorationCapability(
  options?: InterviewerModeOptions,
): options is InterviewerModeOptions & { cwd: string } {
  return Boolean(options?.cwd);
}

export function getInterviewerInstructions(phase: Phase, options?: InterviewerModeOptions): string {
  if (isBrownfieldGroundingExploration(phase, options)) {
    return getBrownfieldGroundingPrompt(options.cwd, options.brownfieldGroundingStage);
  }
  const base = getSystemPrompt(phase);
  if (hasExplorationCapability(options)) {
    return base + getContextGatheringAddendum(options.cwd);
  }
  return base;
}

/** Lightweight addendum appended to any phase prompt when workspace exploration tools are available. */
function getContextGatheringAddendum(cwd: string): string {
  return `

You have read-only workspace tools (read_file, grep, find_files, list_directory) and present_preface available. The workspace directory is: ${cwd}

If you need more orientation to formulate your next question or review — for instance to check implementation details, verify assumptions, or understand existing code — you may use a small number of read-only tool calls, then call present_preface to surface what you found, followed by ask_question. The preface contextualizes the question; do not repeat observations from the preface in the question. present_preface MUST always be followed by ask_question in the same turn. Do not explore unless the current frontier genuinely requires it.`;
}

function createSynthesizedReviewItemId(
  phase: Extract<Phase, 'requirements' | 'criteria'>,
  entityId: number,
): string {
  return `${phase}:${entityId}`;
}

/** Phase-specific system prompts. */
export function getSystemPrompt(phase: Phase): string {
  return renderPromptAsset(SYSTEM_PROMPT_IDS[phase]);
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

export function createAskQuestionTool(db: DB, turnId: number, specificationId: number) {
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
      advanceHead(db, specificationId, turnId);
      return {
        ok: true as const,
        turnId,
        optionCount: input.options.length,
      };
    },
  });
}

export function createPresentPrefaceTool(db: DB, turnId: number) {
  return tool({
    description:
      "Present a preface that prefaces the next question — an observation from exploration or reflection on the user's response, with optional elaboration.",
    inputSchema: prefaceSchema,
    outputSchema: presentPrefaceToolOutputSchema,
    execute: async () => {
      return {
        ok: true as const,
        turnId,
      };
    },
  });
}

export function createProposePhaseClosureTool(db: DB, turnId: number, phase: Phase, projectId: number) {
  return tool({
    description: 'Propose closing the current workflow phase with a concise summary for user confirmation.',
    inputSchema: phaseClosureProposalSchema,
    outputSchema: proposePhaseClosureToolOutputSchema,
    execute: async (input) => {
      createPhaseOutcome(db, {
        specificationId: projectId,
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

export type AskQuestionTool = ReturnType<typeof createAskQuestionTool>;
export type PresentPrefaceTool = ReturnType<typeof createPresentPrefaceTool>;
export type ProposePhaseClosureTool = ReturnType<typeof createProposePhaseClosureTool>;
export type BaseInterviewerTools = {
  ask_question: AskQuestionTool;
  present_preface?: PresentPrefaceTool;
  propose_phase_closure?: ProposePhaseClosureTool;
};
type ExplorationTools = ReturnType<typeof createExplorationTools>;
export type InterviewerTools = BaseInterviewerTools & Partial<ExplorationTools>;
export type InterviewerAgent = ToolLoopAgent<never, InterviewerTools>;

/** Build the tool set for the interviewer agent, conditionally including exploration tools when cwd is available. */
export function getInterviewerTools(
  db: DB,
  turnId: number,
  phase: Phase,
  projectId: number,
  options?: InterviewerModeOptions,
): InterviewerTools {
  const closeability = getCurrentWorkflowState(db, projectId).phases[phase].closeability;
  return {
    ask_question: createAskQuestionTool(db, turnId, projectId),
    ...(hasExplorationCapability(options)
      ? {
          present_preface: createPresentPrefaceTool(db, turnId),
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
  const usesExploration = hasExplorationCapability(options);
  const instructions = getInterviewerInstructions(phase, options);

  return new ToolLoopAgent({
    model: anthropic(process.env.ANTHROPIC_MODEL || 'claude-opus-4-8'),
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
    stopWhen: stepCountIs(usesExploration ? 12 : 4),
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
