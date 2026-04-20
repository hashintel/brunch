/**
 * Knowledge badges — KindBadge for all 8 knowledge kinds and CountBadge variants.
 */
import { CountBadge, KindBadge } from '@/client/components/knowledge-card';
import { ScrollArea } from '@/client/components/ui/scroll-area';
import { Separator } from '@/client/components/ui/separator';

export function BadgesStory() {
  return (
    <ScrollArea className="flex-1">
      <div className="mx-auto max-w-5xl p-8">
        <h1 className="text-[22px] leading-none font-medium tracking-[-0.015em] text-ink">
          Knowledge Badges
        </h1>
        <p className="mt-2.5 text-sm leading-relaxed text-sub">
          KindBadge for all 8 knowledge kinds and CountBadge variants.
        </p>

        <Separator className="my-8" />

        {/* ── Kind badges ──────────────────────────────────────────── */}
        <section>
          <h2 className="text-base font-medium text-ink">Kind badges</h2>
          <p className="mt-1 text-sm text-sub">One badge per knowledge kind.</p>

          <div className="mt-6 flex gap-2">
            <KindBadge kind="goal" />
            <KindBadge kind="term" />
            <KindBadge kind="context" />
            <KindBadge kind="constraint" />
            <KindBadge kind="assumption" />
            <KindBadge kind="decision" />
            <KindBadge kind="requirement" />
            <KindBadge kind="criterion" />
          </div>
        </section>

        <Separator className="my-8" />

        {/* ── Count badges ─────────────────────────────────────────── */}
        <section>
          <h2 className="text-base font-medium text-ink">Count badges</h2>
          <p className="mt-1 text-sm text-sub">Numeric count indicators.</p>

          <div className="mt-6 flex gap-2">
            <CountBadge count={3} />
            <CountBadge count={12} />
            <CountBadge count={0} />
          </div>
        </section>
      </div>
    </ScrollArea>
  );
}
