/**
 * Pattern: Thinking / activity placeholders — meta block cards shown
 * while the model is working (thinking, using tools, generating).
 */
import { ActivityPlaceholder, GeneratingTurnPlaceholder } from '@/client/components/question-cards';
import { ScrollArea } from '@/client/components/ui/scroll-area';
import { Separator } from '@/client/components/ui/separator';

export function ThinkingStory() {
  return (
    <ScrollArea className="flex-1">
      <div className="mx-auto max-w-5xl p-8">
        <h1 className="text-[22px] leading-none font-medium tracking-[-0.015em] text-ink">
          Pattern — Thinking / Activity Placeholders
        </h1>
        <p className="mt-2.5 text-sm leading-relaxed text-sub">
          Meta block cards displayed while the model is thinking, invoking tools, or generating a turn.
        </p>

        <Separator className="my-8" />

        {/* ── Section 1: Live thinking ──────────────────────────────── */}
        <section>
          <h2 className="text-base font-medium text-ink">Live thinking (no elapsed time)</h2>
          <p className="mt-1 text-sm text-sub">Default state with no props — shows "Thinking…".</p>

          <div className="mt-6 max-w-2xl">
            <ActivityPlaceholder />
          </div>
        </section>

        <Separator className="my-8" />

        {/* ── Section 2: Elapsed thinking ───────────────────────────── */}
        <section>
          <h2 className="text-base font-medium text-ink">Elapsed thinking</h2>
          <p className="mt-1 text-sm text-sub">Shows a 7-second elapsed timer.</p>

          <div className="mt-6 max-w-2xl">
            <ActivityPlaceholder seconds={7} />
          </div>
        </section>

        <Separator className="my-8" />

        {/* ── Section 3: Thinking with tool use ─────────────────────── */}
        <section>
          <h2 className="text-base font-medium text-ink">Thinking with tool use</h2>
          <p className="mt-1 text-sm text-sub">Elapsed timer plus active tool badges.</p>

          <div className="mt-6 max-w-2xl">
            <ActivityPlaceholder seconds={12} tools={['Read', 'Bash']} />
          </div>
        </section>

        <Separator className="my-8" />

        {/* ── Section 4: Tools only ─────────────────────────────────── */}
        <section>
          <h2 className="text-base font-medium text-ink">Tools only</h2>
          <p className="mt-1 text-sm text-sub">Tool badges without an elapsed timer.</p>

          <div className="mt-6 max-w-2xl">
            <ActivityPlaceholder tools={['Read', 'Grep']} />
          </div>
        </section>

        <Separator className="my-8" />

        {/* ── Section 5: Generating turn placeholder ────────────────── */}
        <section>
          <h2 className="text-base font-medium text-ink">Generating turn placeholder</h2>
          <p className="mt-1 text-sm text-sub">
            Full skeleton card with live timer, shown while a turn is being generated.
          </p>

          <div className="mt-6 max-w-2xl">
            <GeneratingTurnPlaceholder />
          </div>
        </section>
      </div>
    </ScrollArea>
  );
}
