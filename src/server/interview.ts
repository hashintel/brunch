import { anthropic } from '@ai-sdk/anthropic';
import type { Tool } from '@ai-sdk/provider-utils';
import { ToolLoopAgent, stepCountIs, tool } from 'ai';

import type { ProjectMode } from '@/shared/api-types.js';
import {
  askQuestionToolOutputSchema,
  phaseClosureProposalSchema,
  proposePhaseClosureToolOutputSchema,
  structuredQuestionSchema,
  type AskQuestionToolOutput,
  type PhaseClosureProposal,
  type ProposePhaseClosureToolOutput,
  type StructuredQuestion,
} from '@/shared/chat.js';

import { buildInterviewerContext } from './context.js';
import type { TurnWithOptions } from './core.js';
import {
  createOption,
  createPhaseOutcome,
  updateTurn,
  getTurn,
  getEntitiesForProject,
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

Do not run one-requirement-at-a-time approval or rejection turns in this slice.

When every current requirement has explicit review coverage and the set appears complete for now, use the \`propose_phase_closure\` tool instead of another question. The summary should explain why requirements can close and criteria review can begin.

For every turn, you MUST use the ask_question tool or the propose_phase_closure tool. Never respond with plain text.`,

  criteria: `You are a spec elicitation interviewer conducting the CRITERIA REVIEW phase.

Your job is to review the accumulated acceptance criteria as one full-set review turn, check for gaps, suggest additions, and confirm completeness. Ground each review turn in the current criterion inventory and approved requirements provided in context, including stable criterion reference codes when they are available.

Use the ask_question tool to present the current criterion set for review with exactly two options: \`Accept review\` and \`Request changes\`. The user's single selected option is the review action, and any attached note is the review note describing corrections, omissions, or confirming why the set is acceptable.

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

Your first ask_question call is the durable kickoff handoff. Use it to do two jobs at once:
1. In the \`why\` field, begin with \`Grounding:\` and give a concise 1-2 sentence summary of the durable repo facts you found that matter for this feature-area conversation. Then explain why this question matters.
2. Make the first question about the bounded feature area, current behavior, or desired change inside this existing codebase. Do not ask generic whole-product greenfield kickoff questions.

For every turn after the exploration, you MUST use the ask_question tool to generate your question. Never respond with plain text — always use the tool.

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
export type ProposePhaseClosureTool = Tool<PhaseClosureProposal, ProposePhaseClosureToolOutput>;
export type BaseInterviewerTools = {
  ask_question: AskQuestionTool;
  propose_phase_closure?: ProposePhaseClosureTool;
};
export type InterviewerTools = BaseInterviewerTools & Record<string, Tool<any, any>>;
export type InterviewerAgent = ToolLoopAgent<never, InterviewerTools>;

/** Phase-specific system prompts. */
export function getSystemPrompt(phase: Phase): string {
  return SYSTEM_PROMPTS[phase];
}

export function canProposePhaseClosure(phase: Phase, closeability = false): boolean {
  return phase === 'scope' || phase === 'design' || (phase === 'requirements' && closeability);
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
      persistStructuredQuestion(db, turnId, input);
      return {
        ok: true as const,
        turnId,
        optionCount: input.options.length,
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
    ...(canProposePhaseClosure(phase, closeability)
      ? { propose_phase_closure: createProposePhaseClosureTool(db, turnId, phase, projectId) }
      : {}),
    ...(isBrownfieldScopeExploration(phase, options) ? createExplorationTools(options.cwd) : {}),
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
  const entities = getEntitiesForProject(db, turn.project_id);
  const fullPrompt = buildInterviewerContext(activePath, userMessage, {
    phase,
    entities:
      phase === 'requirements'
        ? {
            requirements: entities.requirements.map((requirement) => ({
              id: requirement.id,
              content: requirement.content,
            })),
          }
        : phase === 'criteria'
          ? {
              approvedRequirements: entities.requirements
                .filter((requirement) => requirement.reviewStatus === 'approved')
                .map((requirement) => ({
                  id: requirement.id,
                  content: requirement.content,
                })),
              criteria: entities.criteria.map((criterion) => ({
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

export function persistFallbackQuestionText(db: DB, turnId: number, assistantText: string): void {
  const currentTurn = getTurn(db, turnId);
  if (!assistantText || currentTurn?.question) return;
  updateTurn(db, turnId, { question: assistantText });
}
