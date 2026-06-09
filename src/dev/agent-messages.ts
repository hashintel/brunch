import type { AgentSession } from '@earendil-works/pi-coding-agent';

export type BrunchAgentMessages = AgentSession['messages'];
type BrunchAgentMessage = BrunchAgentMessages[number];
type BrunchAssistantMessage = Extract<BrunchAgentMessage, { role: 'assistant' }>;

export function latestAssistantText(messages: BrunchAgentMessages): string {
  for (let index = messages.length - 1; index >= 0; index--) {
    const message = messages[index];
    if (!isAssistantMessage(message)) continue;
    return message.content.flatMap((block) => (block.type === 'text' ? [block.text] : [])).join('\n');
  }
  return '';
}

function isAssistantMessage(message: BrunchAgentMessage | undefined): message is BrunchAssistantMessage {
  return message?.role === 'assistant';
}
