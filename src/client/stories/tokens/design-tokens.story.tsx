import { ScrollArea } from '@/client/components/ui/scroll-area';
import { Separator } from '@/client/components/ui/separator';

export const DesignTokensStory = () => {
  return (
    <ScrollArea className="h-screen">
      <div className="mx-auto max-w-2xl px-8 py-12">
        <h1 className="text-base font-medium text-ink">Design Tokens</h1>
        <p className="mt-1 text-sm text-sub">
          The project's design tokens — typography scale, font weights, color ramp, and shadow primitives.
        </p>

        <Separator className="my-8" />

        {/* ── Typography scale ──────────────────────────────────────── */}
        <h2 className="text-sm font-medium text-ink">Typography scale</h2>
        <div className="mt-4 flex flex-col gap-3 rounded-xl border border-rule p-4">
          <p className="text-xxs text-hint">text-xxs (11px) — impact badges, tag labels</p>
          <p className="text-xs text-sub">text-xs (12px) — built-in, secondary text</p>
          <p className="text-xs-plus text-sub">text-xs-plus (13px) — secondary body, "why" text</p>
          <p className="text-sm text-ink">text-sm (14px) — built-in, body text</p>
          <p className="text-sm-plus font-medium text-ink">
            text-sm-plus (15px) — card headings, question text
          </p>
          <p className="text-base font-medium text-ink">text-base (16px) — built-in, section headings</p>
        </div>

        <Separator className="my-8" />

        {/* ── Font weights ──────────────────────────────────────────── */}
        <h2 className="text-sm font-medium text-ink">Font weights</h2>
        <div className="mt-4 flex flex-col gap-3 rounded-xl border border-rule p-4">
          <p className="text-sm font-normal text-ink">font-normal (400) — regular body text</p>
          <p className="text-sm font-medium text-ink">font-medium (500) — emphasized text, labels</p>
          <p className="text-sm font-semibold text-ink">font-semibold (600) — strong emphasis</p>
        </div>

        <Separator className="my-8" />

        {/* ── Color ramp ───────────────────────────────────────────── */}
        <h2 className="text-sm font-medium text-ink">Color ramp</h2>
        <div className="mt-4 flex flex-col gap-2 rounded-xl border border-rule p-4">
          <div className="flex items-center gap-3">
            <span className="size-6 rounded bg-ink" />
            <span className="text-sm text-ink">ink (#202020) — primary text</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="size-6 rounded bg-sub" />
            <span className="text-sm text-sub">sub (#5b5b5b) — subtitles, section headers</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="size-6 rounded bg-hint" />
            <span className="text-sm text-hint">hint (#a6a6a6) — IDs, placeholders</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="size-6 rounded border border-rule bg-rule" />
            <span className="text-sm text-sub">rule (#e3e3e3) — borders, dividers</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="size-6 rounded border border-rule bg-wash" />
            <span className="text-sm text-sub">wash (#f0f0f0) — ghost fills, tracks</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="size-6 rounded border border-rule bg-tint" />
            <span className="text-sm text-sub">tint (#fafafa) — subtle background</span>
          </div>
        </div>

        <Separator className="my-8" />

        {/* ── Shadow tokens ────────────────────────────────────────── */}
        <h2 className="text-sm font-medium text-ink">Shadow tokens</h2>
        <div className="mt-4 flex gap-4 p-4">
          <div className="rounded-xl bg-white p-4 shadow-[var(--shadow-card)]">
            <p className="text-sm text-sub">shadow-card</p>
          </div>
          <div className="rounded-xl bg-white p-4 shadow-[var(--shadow-ring)]">
            <p className="text-sm text-sub">shadow-ring</p>
          </div>
          <div className="rounded-xl bg-white p-4 shadow-[var(--shadow-card-ring)]">
            <p className="text-sm text-sub">shadow-card-ring</p>
          </div>
        </div>
      </div>
    </ScrollArea>
  );
};
