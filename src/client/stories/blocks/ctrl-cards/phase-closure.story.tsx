/**
 * Control block — Phase closure cards.
 *
 * Shows closure proposal, accepted closure replay, review phase completion,
 * and workflow-complete terminal variants.
 */
import { Button } from '@/client/components/app-shell';
import { AcceptedClosureCard, PhaseHandoffCard, PhaseSummaryCard } from '@/client/components/control-cards';
import { ReviewPhaseCompletionCard } from '@/client/components/review-set-card';
import { ScrollArea } from '@/client/components/ui/scroll-area';
import { Separator } from '@/client/components/ui/separator';

export function PhaseClosureStory() {
  return (
    <ScrollArea className="flex-1">
      <div className="mx-auto max-w-5xl p-8">
        <h1 className="text-[22px] leading-none font-medium tracking-[-0.015em] text-ink">
          Control Block — Phase Closure
        </h1>
        <p className="mt-2.5 text-sm leading-relaxed text-sub">
          Closure proposals, accepted confirmations, review completions, and terminal workflow state.
        </p>

        <Separator className="my-8" />

        {/* ── Elicitation closure proposal ──────────────────────────── */}
        <section>
          <h2 className="text-base font-medium text-ink">Elicitation closure proposal</h2>
          <p className="mt-1 text-xs text-hint">PhaseSummaryCard · phase=design · interactive confirm</p>

          <div className="mt-6 max-w-2xl">
            <PhaseSummaryCard
              phase="design"
              summary="The design elicitation has covered all major areas including architecture, data model, and integration points. The interviewer recommends closing this phase."
              onConfirm={() => console.log('confirm:design')}
              disabled={false}
            />
          </div>
        </section>

        <Separator className="my-8" />

        {/* ── Requirements closure proposal ─────────────────────────── */}
        <section>
          <h2 className="text-base font-medium text-ink">Requirements closure proposal</h2>
          <p className="mt-1 text-xs text-hint">PhaseSummaryCard · phase=requirements</p>

          <div className="mt-6 max-w-2xl">
            <PhaseSummaryCard
              phase="requirements"
              summary="All synthesized requirements have been reviewed and accepted. The requirements phase is ready to close."
              onConfirm={() => console.log('confirm:requirements')}
              disabled={false}
            />
          </div>
        </section>

        <Separator className="my-8" />

        {/* ── Accepted closure replay ───────────────────────────────── */}
        <section>
          <h2 className="text-base font-medium text-ink">Accepted closure replay</h2>
          <p className="mt-1 text-xs text-hint">AcceptedClosureCard · phase=design</p>

          <div className="mt-6 max-w-2xl">
            <AcceptedClosureCard
              phase="design"
              summary="Design elicitation concluded after 12 interview turns covering architecture, data model, API surface, and integration strategy."
            />
          </div>
        </section>

        <Separator className="my-8" />

        {/* ── Non-review phase handoff ─────────────────────────────── */}
        <section>
          <h2 className="text-base font-medium text-ink">Non-review phase handoff</h2>
          <p className="mt-1 text-xs text-hint">PhaseHandoffCard · grounding complete with next-phase CTA</p>

          <div className="mt-6 max-w-2xl">
            <PhaseHandoffCard
              phase="grounding"
              nextPhase="design"
              summary="Goals, terms, context, and constraints are sufficiently captured."
            >
              <Button variant="outline" size="sm" className="mt-1">
                Continue to Elicitation
              </Button>
            </PhaseHandoffCard>
          </div>
        </section>

        <Separator className="my-8" />

        {/* ── Review phase completion ───────────────────────────────── */}
        <section>
          <h2 className="text-base font-medium text-ink">Review phase completion</h2>
          <p className="mt-1 text-xs text-hint">ReviewPhaseCompletionCard · requirements complete with CTA</p>

          <div className="mt-6 max-w-2xl">
            <ReviewPhaseCompletionCard
              eyebrow="Review phase complete"
              title="Requirements phase is complete"
              description="All requirements have been reviewed and finalized. You can proceed to acceptance criteria."
              cta="Continue to acceptance criteria"
              onContinue={() => console.log('continue:to-criteria')}
            />
          </div>
        </section>

        <Separator className="my-8" />

        {/* ── Workflow complete (terminal) ──────────────────────────── */}
        <section>
          <h2 className="text-base font-medium text-ink">Workflow complete</h2>
          <p className="mt-1 text-xs text-hint">ReviewPhaseCompletionCard · criteria complete · no CTA</p>

          <div className="mt-6 max-w-2xl">
            <ReviewPhaseCompletionCard
              eyebrow="Workflow complete"
              title="Specification workflow is complete"
              description="All phases — scoping, design elicitation, requirements, and acceptance criteria — have been finalized. Your project specification is ready."
            />
          </div>
        </section>
      </div>
    </ScrollArea>
  );
}
