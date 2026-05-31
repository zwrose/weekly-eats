'use client';

import * as React from 'react';
import { styled } from '@mui/material/styles';
import type { SxProps, Theme } from '@mui/material/styles';

const IconRoot = styled('span')({
  fontWeight: 'normal',
  fontStyle: 'normal',
  lineHeight: 1,
  letterSpacing: 'normal',
  textTransform: 'none',
  display: 'inline-flex',
  whiteSpace: 'nowrap',
  wordWrap: 'normal',
  direction: 'ltr',
  WebkitFontSmoothing: 'antialiased',
});

export interface IconProps {
  /** Material Symbols ligature name (snake_case), e.g. "kitchen", "shopping_cart". */
  name: string;
  /** Font size in px (also drives the optical-size axis). Default 24. */
  size?: number;
  /** CSS color. Defaults to inherit (`currentColor`). */
  color?: string;
  /** Filled vs outlined (FILL axis). Default false (outlined). */
  fill?: boolean;
  /** Stroke weight (wght axis), 100–700. Default 400. */
  weight?: number;
  /** Provide only for standalone meaningful icons; defaults to decorative (aria-hidden). */
  'aria-label'?: string;
  className?: string;
  sx?: SxProps<Theme>;
}

export const Icon: React.FC<IconProps> = ({
  name,
  size = 24,
  color = 'inherit',
  fill = false,
  weight = 400,
  className,
  sx,
  'aria-label': ariaLabel,
}) => {
  const decorative = ariaLabel === undefined;
  return (
    <IconRoot
      className={className}
      aria-hidden={decorative ? true : undefined}
      aria-label={ariaLabel}
      role={ariaLabel ? 'img' : undefined}
      style={{
        fontFamily: 'var(--font-icons)',
        fontSize: `${size}px`,
        color,
        fontVariationSettings: `'FILL' ${fill ? 1 : 0}, 'wght' ${weight}, 'GRAD' 0, 'opsz' ${size}`,
      }}
      sx={sx}
    >
      {name}
    </IconRoot>
  );
};
