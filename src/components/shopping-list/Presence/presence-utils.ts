// Avatar colors are derived client-side from the user's email/name — the realtime
// presence payload is only { email, name } and we must not add fields (no API change).
export const PRESENCE_PALETTE = [
  '#8c5b6d',
  '#5b6d8c',
  '#6d8c5b',
  '#8c7d5b',
  '#5b8c87',
  '#7d5b8c',
] as const;

export function presenceInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '?';
  if (words.length === 1) return words[0][0].toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

export function presenceColor(key: string): string {
  let hash = 0;
  for (let i = 0; i < key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) | 0;
  return PRESENCE_PALETTE[Math.abs(hash) % PRESENCE_PALETTE.length];
}
