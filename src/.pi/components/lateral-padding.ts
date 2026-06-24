import { Box, type Component } from '@earendil-works/pi-tui';

/** Wrap a component in transparent horizontal padding for self-shell tool renders. */
export function withLateralPadding(component: Component, columns = 1): Box {
  const box = new Box(columns, 0);
  box.addChild(component);
  return box;
}
