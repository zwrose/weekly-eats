// src/components/nav/AppIcon.tsx
import { tokens } from '@/lib/design-tokens';

const BLOCKS = [
  { color: tokens.section.plans, x: 12, w: 32 },
  { color: tokens.section.recipes, x: 16, w: 36 },
  { color: tokens.section.shop, x: 12, w: 26 },
  { color: tokens.section.pantry, x: 18, w: 32 },
];

export interface AppIconProps {
  size?: number;
  /** Wrap the logomark in a black squircle background (marketing/home). */
  squircled?: boolean;
}

export function AppIcon({ size = 30, squircled = false }: AppIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      aria-hidden="true"
      style={{ display: 'block', flexShrink: 0 }}
    >
      {squircled && (
        <rect data-squircle="true" x="0" y="0" width="64" height="64" rx="16" fill="#000" />
      )}
      {BLOCKS.map((b, i) => (
        <rect key={i} x={b.x} y={12 + i * 8} width={b.w} height="5" rx="1" fill={b.color} />
      ))}
      <path d="M 8 47 L 56 47 Q 56 56 32 56 Q 8 56 8 47 Z" fill="#3a3d44" />
      <rect x="8" y="47" width="48" height="1.5" fill="rgba(255,255,255,0.20)" />
    </svg>
  );
}
