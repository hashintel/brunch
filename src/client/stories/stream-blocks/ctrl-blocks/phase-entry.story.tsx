/**
 * Control block — Phase entry cards.
 *
 * Shows the merged phase-entry concept: interactive kickoff state
 * (when a phase has zero turns) and continue-phase variant.
 */
import { KickoffTurnCard } from '@/client/components/control-cards';
import { ScrollArea } from '@/client/components/ui/scroll-area';
import { Separator } from '@/client/components/ui/separator';

export function PhaseEntryStory() {
  return (
    <ScrollArea className="flex-1">
      <div className="mx-auto max-w-5xl p-8">
        <h1 className="text-[22px] leading-none font-medium tracking-[-0.015em] text-ink">
          Control Block — Phase Entry
        </h1>
        <p className="mt-2.5 text-sm leading-relaxed text-sub">
          Kickoff and continue variants for each workflow phase, including strategy selection for grounding.
        </p>

        <Separator className="my-8" />

        {/* ── Grounding kickoff (strategy choice) ───────────────────── */}
        <section>
          <h2 className="text-base font-medium text-ink">Grounding kickoff (strategy choice)</h2>
          <p className="mt-1 text-xs text-hint">
            KickoffTurnCard · phase=scope · mode=start · onSelectStrategy provided
          </p>

          <div className="mt-6 max-w-2xl">
            <KickoffTurnCard
              phase="scope"
              mode="start"
              onProceed={() => console.log('proceed:scope')}
              onSelectStrategy={(mode) => console.log('selectStrategy', mode)}
              disabled={false}
            />
          </div>
        </section>

        <Separator className="my-8" />

        {/* ── Elicitation kickoff (simple proceed) ──────────────────── */}
        <section>
          <h2 className="text-base font-medium text-ink">Elicitation kickoff (simple proceed)</h2>
          <p className="mt-1 text-xs text-hint">KickoffTurnCard · phase=design · mode=start · no strategy</p>

          <div className="mt-6 max-w-2xl">
            <KickoffTurnCard
              phase="design"
              mode="start"
              onProceed={() => console.log('proceed:design')}
              disabled={false}
            />
          </div>
        </section>

        <Separator className="my-8" />

        {/* ── Continue phase ────────────────────────────────────────── */}
        <section>
          <h2 className="text-base font-medium text-ink">Continue phase</h2>
          <p className="mt-1 text-xs text-hint">KickoffTurnCard · phase=design · mode=continue</p>

          <div className="mt-6 max-w-2xl">
            <KickoffTurnCard
              phase="design"
              mode="continue"
              onProceed={() => console.log('proceed:design:continue')}
              disabled={false}
            />
          </div>
        </section>

        <Separator className="my-8" />

        {/* ── Requirements review kickoff ───────────────────────────── */}
        <section>
          <h2 className="text-base font-medium text-ink">Requirements review kickoff</h2>
          <p className="mt-1 text-xs text-hint">KickoffTurnCard · phase=requirements · mode=start</p>

          <div className="mt-6 max-w-2xl">
            <KickoffTurnCard
              phase="requirements"
              mode="start"
              onProceed={() => console.log('proceed:requirements')}
              disabled={false}
            />
          </div>
        </section>

        <Separator className="my-8" />

        {/* ── Acceptance criteria review kickoff ────────────────────── */}
        <section>
          <h2 className="text-base font-medium text-ink">Acceptance criteria review kickoff</h2>
          <p className="mt-1 text-xs text-hint">KickoffTurnCard · phase=criteria · mode=start</p>

          <div className="mt-6 max-w-2xl">
            <KickoffTurnCard
              phase="criteria"
              mode="start"
              onProceed={() => console.log('proceed:criteria')}
              disabled={false}
            />
          </div>
        </section>
      </div>
    </ScrollArea>
  );
}
