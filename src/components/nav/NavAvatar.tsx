// src/components/nav/NavAvatar.tsx
'use client';

import { CachedAvatar } from '../CachedAvatar';

/** Up to two initials from a display name; '?' when empty. */
export function initialsFromName(name?: string | null): string {
  const parts = (name ?? '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export interface NavAvatarProps {
  name?: string | null;
  /** Profile image URL (e.g. session.user.image). Initials are the fallback when absent or it fails to load. */
  image?: string | null;
  size?: number;
}

/**
 * Profile-image avatar with an initials-gradient fallback. Uses CachedAvatar so Google
 * profile images go through the caching proxy and fall back gracefully (the gradient +
 * initials show when there's no image or the image errors).
 */
export function NavAvatar({ name, image, size = 28 }: NavAvatarProps) {
  return (
    <CachedAvatar
      src={image}
      alt={name ?? 'Account'}
      fallbackIcon={initialsFromName(name)}
      sx={{
        width: size,
        height: size,
        fontSize: size * 0.4,
        fontWeight: 600,
        background: 'linear-gradient(135deg, #5b6d8c, #3d4a64)',
        color: 'text.primary',
      }}
    />
  );
}
