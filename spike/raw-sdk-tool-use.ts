/**
 * Spike: Raw Anthropic SDK tool execution
 *
 * Question: Can we replace @anthropic-ai/claude-agent-sdk query() with
 * @anthropic-ai/sdk client.messages.stream() for reliable tool calls?
 *
 * Run: npx tsx --env-file=.env spike/raw-sdk-tool-use.ts
 */
import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic();

// Hand-written tool schema (oracle advice: avoid Zod-to-JSON-Schema edge cases for spike)
const ASK_QUESTION_TOOL: Anthropic.Messages.Tool = {
  name: 'ask_question',
  description:
    'Ask the user a structured interview question with options, strategic grounding, and impact signal.',
  input_schema: {
    type: 'object' as const,
    properties: {
      question: { type: 'string', description: 'The interview question' },
      why: { type: 'string', description: 'Why this question matters for the spec' },
      impact: { type: 'string', enum: ['high', 'medium', 'low'] },
      options: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            content: { type: 'string' },
            is_recommended: { type: 'boolean' },
          },
          required: ['content', 'is_recommended'],
        },
        minItems: 2,
      },
    },
    required: ['question', 'why', 'impact', 'options'],
  },
};

// ── Test 1: Forced tool call with streaming ──────────────────────────

async function testForcedToolCall() {
  console.log('\n═══ Test 1: Forced tool_choice with streaming ═══\n');

  const startMs = Date.now();

  const stream = client.messages.stream({
    model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-20250514',
    max_tokens: 1024,
    system: `You are a spec elicitation interviewer conducting the SCOPE phase.
Your job is to understand the user's project goal through structured questions.
For every turn, you MUST use the ask_question tool. Never respond with plain text.`,
    messages: [{ role: 'user', content: 'I want to build a local-first note-taking app' }],
    tools: [ASK_QUESTION_TOOL],
    tool_choice: { type: 'tool' as const, name: 'ask_question' },
  });

  // Collect streaming events to verify format
  const eventTypes: string[] = [];
  let toolCallId = '';
  let toolName = '';
  let jsonChunks = '';

  stream.on('message_start', () => eventTypes.push('message_start'));
  stream.on('contentBlockStart', (block) => {
    eventTypes.push(`content_block_start:${block.content_block.type}`);
    if (block.content_block.type === 'tool_use') {
      toolCallId = block.content_block.id;
      toolName = block.content_block.name;
    }
  });
  stream.on('inputJson', (_delta, snapshot) => {
    jsonChunks = snapshot;
  });
  stream.on('contentBlockStop', () => eventTypes.push('content_block_stop'));
  stream.on('message_stop', () => eventTypes.push('message_stop'));

  const finalMessage = await stream.finalMessage();
  const durationMs = Date.now() - startMs;

  // Extract results
  const toolUse = finalMessage.content.find(
    (block): block is Anthropic.Messages.ToolUseBlock =>
      block.type === 'tool_use' && block.name === 'ask_question',
  );

  console.log('Event types observed:', eventTypes);
  console.log('Stop reason:', finalMessage.stop_reason);
  console.log('Tool call ID:', toolCallId);
  console.log('Tool name:', toolName);
  console.log('Tool use block found:', !!toolUse);
  console.log('Duration:', durationMs, 'ms');
  console.log(
    'Usage:',
    `in=${finalMessage.usage.input_tokens} out=${finalMessage.usage.output_tokens}`,
  );

  if (toolUse) {
    const args = toolUse.input as Record<string, unknown>;
    console.log('\n── Tool call args ──');
    console.log('  question:', args.question);
    console.log('  why:', args.why);
    console.log('  impact:', args.impact);
    console.log('  options:', JSON.stringify(args.options, null, 2));
    console.log('\n✅ PASS: Model called ask_question with structured args');
  } else {
    console.log('\n❌ FAIL: Model did not call ask_question');
  }

  return !!toolUse;
}

// ── Test 2: Raw stream events match translator expectations ──────────

async function testRawStreamEvents() {
  console.log('\n═══ Test 2: Raw stream event format (for translator compat) ═══\n');

  // Use the low-level streaming API to get raw SSE events
  const rawStream = await client.messages.create({
    model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-20250514',
    max_tokens: 1024,
    stream: true,
    system: 'Ask one structured question using the ask_question tool.',
    messages: [{ role: 'user', content: 'I want to build a CLI password manager' }],
    tools: [ASK_QUESTION_TOOL],
    tool_choice: { type: 'tool' as const, name: 'ask_question' },
  });

  // Collect raw events to check shape
  const rawEvents: Array<{ type: string; hasIndex: boolean; hasContentBlock: boolean; hasDelta: boolean }> = [];

  for await (const event of rawStream) {
    rawEvents.push({
      type: event.type,
      hasIndex: 'index' in event,
      hasContentBlock: 'content_block' in event,
      hasDelta: 'delta' in event,
    });
  }

  console.log('Raw event shapes:');
  for (const e of rawEvents) {
    console.log(`  ${e.type} | index: ${e.hasIndex} | content_block: ${e.hasContentBlock} | delta: ${e.hasDelta}`);
  }

  // Check: events are directly typed (NOT wrapped in { type: 'stream_event', event: {...} })
  const hasMessageStart = rawEvents.some((e) => e.type === 'message_start');
  const hasContentBlockStart = rawEvents.some((e) => e.type === 'content_block_start');
  const hasContentBlockDelta = rawEvents.some((e) => e.type === 'content_block_delta');
  const hasContentBlockStop = rawEvents.some((e) => e.type === 'content_block_stop');
  const hasMessageDelta = rawEvents.some((e) => e.type === 'message_delta');
  const hasMessageStop = rawEvents.some((e) => e.type === 'message_stop');

  console.log('\nEvent coverage:');
  console.log('  message_start:', hasMessageStart);
  console.log('  content_block_start:', hasContentBlockStart);
  console.log('  content_block_delta:', hasContentBlockDelta);
  console.log('  content_block_stop:', hasContentBlockStop);
  console.log('  message_delta:', hasMessageDelta);
  console.log('  message_stop:', hasMessageStop);

  const allPresent =
    hasMessageStart &&
    hasContentBlockStart &&
    hasContentBlockDelta &&
    hasContentBlockStop &&
    hasMessageStop;

  if (allPresent) {
    console.log(
      '\n✅ PASS: All expected event types present. Translator needs: remove stream_event envelope, consume events directly',
    );
  } else {
    console.log('\n❌ FAIL: Missing expected event types');
  }

  return allPresent;
}

// ── Test 3: Observer structured output ───────────────────────────────

async function testObserverStructuredOutput() {
  console.log('\n═══ Test 3: Observer structured output via raw API ═══\n');

  // Test if we can get structured JSON output without the Agent SDK
  const response = await client.messages.create({
    model: process.env.OBSERVER_MODEL || 'claude-haiku-4-5-20251001',
    max_tokens: 2048,
    system: `Extract decisions and assumptions from this interview exchange.
Return JSON matching the schema exactly.`,
    messages: [
      {
        role: 'user',
        content: `Q: What platform are you targeting?
A: Desktop only, macOS and Linux. No mobile.

Q: What database should we use?
A: SQLite — I want it to be local-first with no server.

Existing entities: (none)

Extract any NEW decisions and assumptions from these exchanges.`,
      },
    ],
  });

  const textBlock = response.content.find(
    (b): b is Anthropic.Messages.TextBlock => b.type === 'text',
  );

  console.log('Stop reason:', response.stop_reason);
  console.log('Has text block:', !!textBlock);
  console.log(
    'Usage:',
    `in=${response.usage.input_tokens} out=${response.usage.output_tokens}`,
  );

  if (textBlock) {
    console.log('\nRaw response (first 500 chars):', textBlock.text.slice(0, 500));

    // Try to parse as JSON
    try {
      // Strip markdown code fences if present
      const jsonStr = textBlock.text.replace(/^```json\n?/, '').replace(/\n?```$/, '');
      const parsed = JSON.parse(jsonStr);
      console.log('\n✅ PASS: Response parses as valid JSON');
      console.log('  decisions count:', parsed.decisions?.length ?? 'missing');
      console.log('  assumptions count:', parsed.assumptions?.length ?? 'missing');
    } catch {
      console.log('\n⚠️  WARNING: Response is not valid JSON — may need output_config.format');
    }
  }

  return !!textBlock;
}

// ── Run all tests ────────────────────────────────────────────────────

async function main() {
  console.log('Spike: Raw Anthropic SDK Tool Use');
  console.log('=================================\n');

  const results = {
    forcedToolCall: await testForcedToolCall(),
    rawStreamEvents: await testRawStreamEvents(),
    observerOutput: await testObserverStructuredOutput(),
  };

  console.log('\n═══ Summary ═══');
  console.log('Forced tool call:', results.forcedToolCall ? '✅' : '❌');
  console.log('Stream events:', results.rawStreamEvents ? '✅' : '❌');
  console.log('Observer output:', results.observerOutput ? '✅' : '❌');

  const allPass = Object.values(results).every(Boolean);
  console.log('\nOverall:', allPass ? '✅ ALL PASS' : '❌ SOME FAILED');
  process.exit(allPass ? 0 : 1);
}

main().catch((err) => {
  console.error('Spike failed:', err);
  process.exit(1);
});
