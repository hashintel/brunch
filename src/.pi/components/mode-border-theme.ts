import type { Theme, ThemeColor } from '@earendil-works/pi-coding-agent';

import { type OperationalModeId } from '../../session/schema/kinds.js';

export type OperationalModeBorderColorRole = 'modeSpecifyBorder' | 'modeExecuteBorder';

export const OPERATIONAL_MODE_BORDER_COLOR_ROLES = {
  specify: 'modeSpecifyBorder',
  execute: 'modeExecuteBorder',
} as const satisfies Record<OperationalModeId, OperationalModeBorderColorRole>;

export function operationalModeBorderColorRole(mode: OperationalModeId): OperationalModeBorderColorRole {
  return OPERATIONAL_MODE_BORDER_COLOR_ROLES[mode];
}

export function operationalModeBorderColor(theme: Pick<Theme, 'fg'>, mode: OperationalModeId) {
  const role = operationalModeBorderColorRole(mode);
  return (text: string): string => theme.fg(role as ThemeColor, text);
}
