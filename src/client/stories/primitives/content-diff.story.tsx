import { ContentDiff } from '@/client/components/content-diff';
import { ScrollArea } from '@/client/components/ui/scroll-area';
import { Separator } from '@/client/components/ui/separator';

interface VariantProps {
  name: string;
  description: string;
  before: string;
  after: string;
  label?: string;
}

function Variant({ name, description, before, after, label }: VariantProps) {
  return (
    <section className="mt-8">
      <h2 className="text-base font-medium text-ink">{name}</h2>
      <p className="mt-1 text-sm text-sub">{description}</p>
      <div className="mt-6 max-w-2xl rounded-md bg-wash/60 p-3">
        <ContentDiff before={before} after={after} label={label} />
      </div>
    </section>
  );
}

export const ContentDiffStory = () => {
  return (
    <ScrollArea className="flex-1">
      <div className="mx-auto max-w-5xl p-8">
        <h1 className="text-[22px] leading-none font-medium tracking-[-0.015em] text-ink">Content Diff</h1>
        <p className="mt-2.5 text-sm leading-relaxed text-sub">
          Word-level before-vs-after diff. Currently powers two consumers — the side-chat staged-patch row's{' '}
          <code>&lt;details&gt;</code> expander and the canonical <code>PatchListOverlay</code>
          expand-to-detail list (top of the spec workspace) — with the future direct-edit row preview as the
          next consumer. Tints come from the existing wash / accent palette: warm for removed, cool blue for
          added. Never saturated GitHub red/green.
        </p>

        <Separator className="my-8" />

        <Variant
          name="Single-word swap"
          description="The most common case: a one-word terminology change."
          before="Use SQLite for the local store."
          after="Use Postgres for the local store."
        />

        <Variant
          name="Multi-word phrase replacement"
          description="A longer span swapped while surrounding context remains stable."
          before="Households of two or more adults sharing one financial pool."
          after="Cohabiting households of any size sharing one combined financial pool."
        />

        <Variant
          name="Multi-paragraph rewrite"
          description="Larger edits still preserve unchanged whitespace and punctuation verbatim."
          before={`Goal: support solo travellers and small groups.\n\nThe trip planner should accept arbitrary date ranges and surface conflicts inline.`}
          after={`Goal: support solo travellers, couples, and small groups up to six people.\n\nThe trip planner should accept arbitrary date ranges, surface conflicts inline, and remember per-traveller preferences.`}
        />

        <Variant
          name="Pure addition"
          description="Empty before — the entire content renders as added."
          before=""
          after="A new constraint added by the side-chat conversation."
        />

        <Variant
          name="Pure removal"
          description="Empty after — the entire content renders as removed."
          before="A constraint that the user wants to drop entirely."
          after=""
        />

        <Variant
          name="With label (Content)"
          description="Optional label rendered above the diff — used when stacking multiple diff sections in one card (e.g. content + rationale)."
          before="Use SQLite for the local store."
          after="Use Postgres for the local store."
          label="Content"
        />

        <Variant
          name="With label (Rationale)"
          description="The same component, second instance with a different label."
          before="SQLite ships with the runtime and needs no setup."
          after="Postgres handles concurrent writes and matches the production database."
          label="Rationale"
        />
      </div>
    </ScrollArea>
  );
};
