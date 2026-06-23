import type { ReactElement } from 'react';

export function ArrowheadShape({ size, color }: { size: number; color: string }): ReactElement {
  return <polygon points={`0,0 ${size},${size / 2} 0,${size}`} fill={color} />;
}
