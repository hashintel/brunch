import { EmptyCard, ShellButton } from '@/client/components/app-shell';
import { ScrollArea } from '@/client/components/ui/scroll-area';
import { Separator } from '@/client/components/ui/separator';

export const EmptyStatesStory = () => {
  return (
    <ScrollArea className="h-screen">
      <div className="mx-auto max-w-2xl px-8 py-12">
        <h1 className="text-base font-medium text-ink">Empty States</h1>
        <p className="mt-1 text-sm text-sub">Five empty state patterns for different contexts.</p>

        <Separator className="my-8" />

        {/* Pattern 1: Text only */}
        <h2 className="text-sm font-medium text-ink">1. Simple — text only</h2>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <EmptyCard title="Purpose" description="Purpose will be defined based on your answers." />
          <EmptyCard title="Success Criteria" description="No success criteria defined yet." />
        </div>

        <Separator className="my-8" />

        {/* Pattern 2: With CTA */}
        <h2 className="text-sm font-medium text-ink">2. With call to action</h2>
        <div className="mt-4 max-w-md">
          <EmptyCard
            title="Specification"
            description="Start the interview to generate your first spec draft."
          >
            <div className="mt-3">
              <ShellButton variant="primary">Start interview</ShellButton>
            </div>
          </EmptyCard>
        </div>

        <Separator className="my-8" />

        {/* Pattern 3: Centered hero */}
        <h2 className="text-sm font-medium text-ink">3. Centered hero</h2>
        <div className="mt-4 flex flex-col items-center gap-3 rounded-xl border border-dashed border-rule bg-[#f7f7f7] px-8 py-16 text-center">
          <p className="text-base font-medium tracking-[-0.015em] text-sub">No conversation yet</p>
          <p className="max-w-sm text-sm leading-relaxed text-sub">
            Begin the interview to start building your specification.
          </p>
          <div className="mt-2">
            <ShellButton variant="primary">Begin interview</ShellButton>
          </div>
        </div>

        <Separator className="my-8" />

        {/* Pattern 4: Inline within a list */}
        <h2 className="text-sm font-medium text-ink">4. Inline within a list</h2>
        <div className="mt-4 max-w-md overflow-hidden rounded-xl border border-rule">
          <div className="border-b border-rule bg-white p-4">
            <p className="text-sm font-medium text-ink">Assumptions</p>
          </div>
          <div className="bg-tint p-4">
            <p className="text-sm text-hint italic">
              No assumptions recorded yet. They'll appear here as the interview surfaces implicit beliefs.
            </p>
          </div>
        </div>

        <Separator className="my-8" />

        {/* Pattern 5: Attention / warning */}
        <h2 className="text-sm font-medium text-ink">5. Attention — missing required section</h2>
        <div className="mt-4 max-w-md">
          <div className="flex gap-3 rounded-xl border border-dashed border-[#ffe7c6] bg-[rgba(255,157,28,0.04)] p-4">
            <div>
              <p className="text-base font-medium tracking-[-0.015em] text-ink">No verification criteria</p>
              <p className="mt-1 text-sm leading-relaxed text-sub">
                This requirement has no criteria yet. Add at least one to make the spec exportable.
              </p>
            </div>
          </div>
        </div>
      </div>
    </ScrollArea>
  );
};
