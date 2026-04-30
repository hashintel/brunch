let viewport: HTMLElement | null = null;

export function bindChatScrollViewport(el: HTMLElement | null): void {
  viewport = el;
}

export function readChatScrollY(): number | null {
  return viewport ? viewport.scrollTop : null;
}

export function writeChatScrollY(y: number): void {
  if (viewport) viewport.scrollTop = y;
}
