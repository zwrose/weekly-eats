'use client';

import { createContext, useContext, useEffect, useState } from 'react';

/**
 * Recipe `_id` -> emoji, joined at READ time. Meal items only persist
 * type/id/name/quantity, so the emoji is looked up live from the recipes —
 * no payload change, no staleness, and legacy items get it too.
 * Defaults to an empty map so components render fine without a provider (e.g. tests).
 */
const RecipeEmojiContext = createContext<Record<string, string>>({});

export function RecipeEmojiProvider({
  value,
  children,
}: {
  value: Record<string, string>;
  children: React.ReactNode;
}) {
  return <RecipeEmojiContext.Provider value={value}>{children}</RecipeEmojiContext.Provider>;
}

/** A recipe's emoji by id (undefined when unknown or not a recipe). */
export function useRecipeEmoji(id: string | undefined): string | undefined {
  const map = useContext(RecipeEmojiContext);
  return id ? map[id] : undefined;
}

/** Fetch the recipe id->emoji map once. Fire-and-forget; failures yield an empty map. */
export function useRecipeEmojiMap(): Record<string, string> {
  const [map, setMap] = useState<Record<string, string>>({});
  useEffect(() => {
    let active = true;
    fetch('/api/recipes?limit=1000')
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => {
        const list = Array.isArray(data) ? data : (data?.data ?? []);
        const next: Record<string, string> = {};
        for (const r of list) if (r?._id && r?.emoji) next[r._id] = r.emoji;
        if (active) setMap(next);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);
  return map;
}
