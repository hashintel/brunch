import { Button } from '@/client/components/app-shell';
import { ScrollArea } from '@/client/components/ui/scroll-area';
import { Separator } from '@/client/components/ui/separator';

export const ButtonsStory = () => {
  return (
    <ScrollArea className="h-screen">
      <div className="mx-auto max-w-2xl px-8 py-12">
        <h1 className="text-base font-medium text-ink">Buttons</h1>
        <p className="mt-1 text-sm text-sub">
          <code className="rounded bg-tint px-1 text-xs">Button</code> from{' '}
          <code className="rounded bg-tint px-1 text-xs">@/client/components/app-shell</code> is the canonical
          button — not shadcn <code className="rounded bg-tint px-1 text-xs">Button</code>.
        </p>

        <Separator className="my-8" />

        {/* ── Variants ─────────────────────────────────────────────── */}
        <h2 className="text-sm font-medium text-ink">Variants</h2>
        <div className="mt-4 flex gap-3">
          <Button variant="ghost">Ghost</Button>
          <Button variant="outline">Outline</Button>
          <Button variant="primary">Primary</Button>
        </div>

        <Separator className="my-8" />

        {/* ── Sizes ────────────────────────────────────────────────── */}
        <h2 className="text-sm font-medium text-ink">Sizes</h2>
        <p className="mt-1 text-xs-plus text-sub">
          <code className="rounded bg-tint px-1 text-xs">sm</code> is used in inline control cards;{' '}
          <code className="rounded bg-tint px-1 text-xs">md</code> is the default.
        </p>
        <div className="mt-4 flex items-center gap-3">
          <Button variant="outline" size="sm">
            Small
          </Button>
          <Button variant="outline" size="md">
            Medium
          </Button>
        </div>

        <Separator className="my-8" />

        {/* ── Disabled ─────────────────────────────────────────────── */}
        <h2 className="text-sm font-medium text-ink">Disabled</h2>
        <div className="mt-4 flex gap-3">
          <Button variant="ghost" disabled>
            Ghost
          </Button>
          <Button variant="outline" disabled>
            Outline
          </Button>
          <Button variant="primary" disabled>
            Primary
          </Button>
        </div>
      </div>
    </ScrollArea>
  );
};
