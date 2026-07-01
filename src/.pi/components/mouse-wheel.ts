export type WheelDirection = 'up' | 'down';

const SGR_MOUSE_PREFIX = '\u001b[<';
const SGR_MOUSE_BODY = /^(?<button>\d+);(?<column>\d+);(?<row>\d+)(?<state>[Mm])$/;
const MOTION_FLAG = 32;
const WHEEL_FLAG = 64;
const WHEEL_UP_BUTTON = 0;
const WHEEL_DOWN_BUTTON = 1;

export function parseWheelEvent(data: string): WheelDirection | undefined {
  if (!data.startsWith(SGR_MOUSE_PREFIX)) return undefined;

  const match = SGR_MOUSE_BODY.exec(data.slice(SGR_MOUSE_PREFIX.length));
  if (!match?.groups || match.groups.state !== 'M') return undefined;

  const buttonCode = Number.parseInt(match.groups.button, 10);
  if (!Number.isSafeInteger(buttonCode)) return undefined;
  if ((buttonCode & MOTION_FLAG) !== 0) return undefined;
  if ((buttonCode & WHEEL_FLAG) === 0) return undefined;

  const wheelButton = buttonCode & ~(WHEEL_FLAG | MOTION_FLAG);
  if (wheelButton === WHEEL_UP_BUTTON) return 'up';
  if (wheelButton === WHEEL_DOWN_BUTTON) return 'down';
  return undefined;
}
