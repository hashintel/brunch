import type { z } from 'zod/v4';

import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/client/components/ui/collapsible';
import { cn } from '@/client/lib/utils';
import type { secondaryChatStateSchema } from '@/shared/api-types.js';

type SecondaryChat = z.infer<typeof secondaryChatStateSchema>;

export function SecondaryChatCollapsible({ secondaryChat }: { secondaryChat: SecondaryChat }) {
  const kickoffContent = secondaryChat.kickoffTurn?.assistant_parts ?? '';

  return (
    <Collapsible
      data-testid="secondary-chat-collapsible"
      data-secondary-chat-id={secondaryChat.chat.id}
      className={cn('rounded-md border border-rule bg-tint/50 px-3 py-2 text-sm')}
    >
      <CollapsibleTrigger
        data-testid="secondary-chat-collapsible-trigger"
        className="flex w-full items-center justify-between text-left text-sub"
      >
        <span>Secondary chat</span>
        <span aria-hidden className="text-hint">
          ▾
        </span>
      </CollapsibleTrigger>
      <CollapsibleContent
        data-testid="secondary-chat-collapsible-body"
        className="pt-2 whitespace-pre-wrap text-foreground"
      >
        {kickoffContent}
      </CollapsibleContent>
    </Collapsible>
  );
}
