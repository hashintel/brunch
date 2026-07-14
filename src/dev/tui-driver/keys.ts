/**
 * Key names the driver's control protocol accepts (`key:<name>` lines).
 * Must stay in sync with `sendkey` in `driver.exp` — the expect side is the
 * single sender; this table exists so the CLI can validate before writing to
 * the fifo instead of silently dropping an unknown name inside the pump.
 */
export const TUI_DRIVER_KEYS = [
  'Enter',
  'Esc',
  'Up',
  'Down',
  'Right',
  'Left',
  'Tab',
  'Space',
  'Backspace',
  'C-c',
  'C-d',
] as const;

export type TuiDriverKey = (typeof TUI_DRIVER_KEYS)[number];

export function isTuiDriverKey(value: string): value is TuiDriverKey {
  return (TUI_DRIVER_KEYS as readonly string[]).includes(value);
}

/** Encode one control line for the fifo. Text must be newline-free: the fifo protocol is line-delimited. */
export function encodeControlLine(
  input: { type: 'key'; key: TuiDriverKey } | { type: 'text'; text: string },
): string {
  if (input.type === 'key') return `key:${input.key}`;
  if (input.text.includes('\n')) {
    throw new Error('Control text cannot contain newlines; send key:Enter between lines instead.');
  }
  return `type:${input.text}`;
}
