import { ShellButton } from '@/client/components/app-shell';
import { ScrollArea } from '@/client/components/ui/scroll-area';
import { Separator } from '@/client/components/ui/separator';

export const ButtonsStory = () => {
  return (
    <ScrollArea className="h-screen">
      <div className="mx-auto max-w-2xl px-8 py-12">
        <h1 className="text-base font-medium text-ink">Buttons</h1>
        <p className="mt-1 text-sm text-sub">
          <code className="rounded bg-tint px-1 text-xs">ShellButton</code> from{' '}
          <code className="rounded bg-tint px-1 text-xs">@/client/components/app-shell</code> is the canonical
          button — not shadcn <code className="rounded bg-tint px-1 text-xs">Button</code>.
        </p>

        <Separator className="my-8" />

        {/* ── Variants ─────────────────────────────────────────────── */}
        <h2 className="text-sm font-medium text-ink">Variants</h2>
        <div className="mt-4 flex gap-3">
          <ShellButton variant="ghost">Ghost</ShellButton>
          <ShellButton variant="outline">Outline</ShellButton>
          <ShellButton variant="primary">Primary</ShellButton>
        </div>

        <Separator className="my-8" />

        {/* ── Disabled ─────────────────────────────────────────────── */}
        <h2 className="text-sm font-medium text-ink">Disabled</h2>
        <div className="mt-4 flex gap-3">
          <ShellButton variant="ghost" disabled>
            Ghost
          </ShellButton>
          <ShellButton variant="outline" disabled>
            Outline
          </ShellButton>
          <ShellButton variant="primary" disabled>
            Primary
          </ShellButton>
        </div>
      </div>
    </ScrollArea>
  );
};
