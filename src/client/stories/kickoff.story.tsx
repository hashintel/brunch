/**
 * Pattern: Kickoff page — goal input with placeholder sidebar.
 *
 * Two-panel layout: left side has a textarea for describing a project goal,
 * right side shows skeleton placeholders simulating analysis in progress.
 *
 * Ported from brunch-ui /kickoff.
 */
import { Send } from 'lucide-react';

import { Button } from '@/client/components/ui/button';
import { ScrollArea } from '@/client/components/ui/scroll-area';
import { Skeleton } from '@/client/components/ui/skeleton';
import { Spinner } from '@/client/components/ui/spinner';
import { Textarea } from '@/client/components/ui/textarea';

export const KickoffPage = () => {
  return (
    <div className="flex flex-1 overflow-hidden">
      {/* Left: goal input */}
      <div className="flex flex-1 flex-col items-center justify-center border-r p-8">
        <div className="w-full max-w-md">
          <h1 className="text-2xl font-medium text-ink">Describe your project goal</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Describe your project goal and I&apos;ll ask clarifying questions to create a detailed specification.
          </p>

          <div className="mt-6 flex gap-2">
            <Textarea placeholder="Type your goal here…" className="min-h-24 flex-1 resize-none text-sm" />
          </div>
          <div className="mt-3 flex justify-end">
            <Button>
              <Send data-icon="inline-start" />
              Generate
            </Button>
          </div>
        </div>
      </div>

      {/* Right: placeholder sidebar */}
      <div className="flex w-80 flex-col items-center justify-center gap-4 p-8">
        <ScrollArea className="h-full">
          <div className="flex w-full items-center gap-3">
            <div className="flex size-6 items-center justify-center rounded-full border text-xs text-muted-foreground">
              ?
            </div>
            <Skeleton className="h-3 flex-1" />
          </div>
          <div className="mt-4 flex w-full items-center gap-3">
            <div className="flex size-6 items-center justify-center rounded-full border text-xs text-muted-foreground">
              ?
            </div>
            <Skeleton className="h-3 flex-1" />
          </div>
          <div className="mt-4 flex w-full items-center gap-3">
            <div className="flex size-6 items-center justify-center rounded-full border text-xs text-muted-foreground">
              ?
            </div>
            <Skeleton className="h-3 flex-1" />
          </div>
          <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
            <Spinner />
            Analyzing project goal…
          </div>
          <p className="mt-2 text-center text-xs text-muted-foreground">
            Describe your project goal to generate a project specification
          </p>
        </ScrollArea>
      </div>
    </div>
  );
};
