/**
 * Control block — Phase recovery cards.
 *
 * Shows recovery variants for each phase that can encounter a missing frontier turn.
 */
import { RecoveryControlCard } from '@/client/components/control-cards';
import { ScrollArea } from '@/client/components/ui/scroll-area';
import { Separator } from '@/client/components/ui/separator';

export function PhaseRecoveryStory() {
  return (
    <ScrollArea className="flex-1">
      <div className="mx-auto max-w-5xl p-8">
        <h1 className="text-[22px] leading-none font-medium tracking-[-0.015em] text-ink">
          Control Block — Phase Recovery
        </h1>
        <p className="mt-2.5 text-sm leading-relaxed text-sub">
          Recovery cards shown when a phase's frontier turn is missing and needs to be restored.
        </p>

        <Separator className="my-8" />

        {/* ── Elicitation recovery ──────────────────────────────────── */}
        <section>
          <h2 className="text-base font-medium text-ink">Elicitation recovery</h2>
          <p className="mt-1 text-xs text-hint">RecoveryControlCard · phase=design</p>

          <div className="mt-6 max-w-2xl">
            <RecoveryControlCard
              phase="design"
              onRecover={() => console.log('recover:design')}
              disabled={false}
            />
          </div>
        </section>

        <Separator className="my-8" />

        {/* ── Requirements recovery ────────────────────────────────── */}
        <section>
          <h2 className="text-base font-medium text-ink">Requirements recovery</h2>
          <p className="mt-1 text-xs text-hint">RecoveryControlCard · phase=requirements</p>

          <div className="mt-6 max-w-2xl">
            <RecoveryControlCard
              phase="requirements"
              onRecover={() => console.log('recover:requirements')}
              disabled={false}
            />
          </div>
        </section>

        <Separator className="my-8" />

        {/* ── Criteria recovery ────────────────────────────────────── */}
        <section>
          <h2 className="text-base font-medium text-ink">Criteria recovery</h2>
          <p className="mt-1 text-xs text-hint">RecoveryControlCard · phase=criteria</p>

          <div className="mt-6 max-w-2xl">
            <RecoveryControlCard
              phase="criteria"
              onRecover={() => console.log('recover:criteria')}
              disabled={false}
            />
          </div>
        </section>
      </div>
    </ScrollArea>
  );
}
