// @vitest-environment happy-dom

import { cleanup, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ChatTranscriptPopoverContent } from '../chat-transcript-popover.js';
import { Popover, PopoverAnchor } from '../ui/popover.js';

afterEach(() => {
  cleanup();
});

describe('ChatTranscriptPopoverContent', () => {
  it('renders an empty transcript slot inside the popover when the surrounding Popover root is open', () => {
    function Harness() {
      const [, setSlot] = useState<HTMLDivElement | null>(null);
      return (
        <Popover open>
          <PopoverAnchor asChild>
            <button data-testid="anchor" type="button">
              anchor
            </button>
          </PopoverAnchor>
          <ChatTranscriptPopoverContent slotRef={setSlot} />
        </Popover>
      );
    }
    render(<Harness />);

    expect(screen.getByTestId('anchor')).not.toBeNull();
    expect(screen.getByTestId('chat-transcript-popover-content')).not.toBeNull();
    expect(screen.getByTestId('chat-transcript-popover-slot')).not.toBeNull();
  });

  it('does NOT render the popover content (or its slot) when the surrounding Popover root is closed', () => {
    render(
      <Popover open={false}>
        <PopoverAnchor asChild>
          <button data-testid="anchor" type="button">
            anchor
          </button>
        </PopoverAnchor>
        <ChatTranscriptPopoverContent slotRef={vi.fn()} />
      </Popover>,
    );

    expect(screen.getByTestId('anchor')).not.toBeNull();
    expect(screen.queryByTestId('chat-transcript-popover-content')).toBeNull();
    expect(screen.queryByTestId('chat-transcript-popover-slot')).toBeNull();
  });

  it('invokes slotRef with the slot div once the popover mounts so consumers can portal into it', () => {
    const slotRef = vi.fn();
    render(
      <Popover open>
        <PopoverAnchor asChild>
          <button type="button">anchor</button>
        </PopoverAnchor>
        <ChatTranscriptPopoverContent slotRef={slotRef} />
      </Popover>,
    );

    expect(slotRef).toHaveBeenCalled();
    const lastCall = slotRef.mock.calls.at(-1)!;
    expect(lastCall[0]).toBeInstanceOf(HTMLElement);
  });
});
