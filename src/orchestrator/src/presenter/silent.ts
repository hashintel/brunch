// Renders nothing. Used for `brunch agent`, whose stdout is the JSONL
// protocol and must never carry presentation noise.

import type { CookEvent, Presenter } from './events.js';

export class SilentPresenter implements Presenter {
  onEvent(_event: CookEvent): void {}
  dispose(): void {}
}
