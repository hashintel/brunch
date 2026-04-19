/**
 * Pattern: Tool use display — placeholder for future tool-use rendering
 * patterns that will be developed as the merged stream projector lands.
 */
import { TranscriptMetaPlaceholder } from '@/client/components/control-cards';
import { ScrollArea } from '@/client/components/ui/scroll-area';
import { Separator } from '@/client/components/ui/separator';

export function ToolUseStory() {
  return (
    <ScrollArea className="flex-1">
      <div className="mx-auto max-w-5xl p-8">
        <h1 className="text-[22px] leading-none font-medium tracking-[-0.015em] text-ink">
          Pattern — Tool Use Display
        </h1>
        <p className="mt-2.5 text-sm leading-relaxed text-sub">
          Placeholder for tool-use rendering patterns in the merged stream.
        </p>

        <Separator className="my-8" />

        <section>
          <h2 className="text-base font-medium text-ink">Placeholder</h2>
          <p className="mt-1 text-sm text-sub">Meta placeholder indicating future work.</p>

          <div className="mt-6 max-w-2xl">
            <TranscriptMetaPlaceholder
              label="Tool use display"
              detail="Tool use rendering patterns will be developed as the merged stream projector lands."
            />
          </div>
        </section>
      </div>
    </ScrollArea>
  );
}
