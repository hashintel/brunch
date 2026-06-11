import { truncateToWidth, visibleWidth } from '@earendil-works/pi-tui';

import { type LabTheme, type LabThemeColor, makeSolidBadge } from './style-palette.js';

export interface TrackSegment {
  readonly label: string;
  readonly color?: LabThemeColor;
}

export function normalizeActiveIndex(activeIndex: number, length: number): number {
  if (length <= 0) return 0;
  return ((activeIndex % length) + length) % length;
}

export function nextSegmentIndex(activeIndex: number, length: number): number {
  return normalizeActiveIndex(activeIndex + 1, length);
}

export function previousSegmentIndex(activeIndex: number, length: number): number {
  return normalizeActiveIndex(activeIndex - 1, length);
}

export function renderSegmentTrack(
  theme: LabTheme,
  segments: readonly TrackSegment[],
  activeIndex: number,
  width = Number.POSITIVE_INFINITY,
): string {
  if (segments.length === 0) return '';
  const active = normalizeActiveIndex(activeIndex, segments.length);
  const line = segments
    .map((segment, index) => {
      const color = segment.color ?? 'accent';
      return index === active ? makeSolidBadge(theme, segment.label, color) : theme.fg(color, segment.label);
    })
    .join(theme.fg('dim', ' | '));
  return Number.isFinite(width) ? truncateToWidth(line, Math.max(1, width)) : line;
}

export function trackVisibleWidth(track: string): number {
  return visibleWidth(track);
}

export const DEMO_MODEL_SEGMENTS: readonly TrackSegment[] = [
  { label: 'smol', color: 'success' },
  { label: 'default', color: 'accent' },
  { label: 'slow', color: 'warning' },
] as const;
