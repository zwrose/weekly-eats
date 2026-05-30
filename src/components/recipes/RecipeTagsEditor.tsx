// src/components/recipes/RecipeTagsEditor.tsx
'use client';

import { useId, useRef, useState } from 'react';
import { Box, ButtonBase, InputBase } from '@mui/material';
import { tokens } from '@/lib/design-tokens';

export interface RecipeTagsEditorProps {
  value: string[];
  onChange: (tags: string[]) => void;
  availableTags?: string[];
}

export function RecipeTagsEditor({ value, onChange, availableTags = [] }: RecipeTagsEditorProps) {
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState('');
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);

  const commit = () => {
    const tag = draft.trim();
    if (tag && !value.includes(tag)) onChange([...value, tag]);
    setDraft('');
  };

  return (
    <Box sx={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
      {value.map((tag) => (
        <Box
          key={tag}
          sx={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            fontSize: 11,
            color: tokens.text.primary,
            pl: '10px',
            pr: '8px',
            py: '4px',
            bgcolor: tokens.surface.elevated,
            borderRadius: `${tokens.radius.pill}px`,
          }}
        >
          {tag}
          <ButtonBase
            aria-label={`Remove ${tag}`}
            onClick={() => onChange(value.filter((t) => t !== tag))}
            sx={{ color: tokens.text.secondary, fontSize: 11, borderRadius: '50%', px: '2px' }}
          >
            ✕
          </ButtonBase>
        </Box>
      ))}

      {adding ? (
        <>
          <InputBase
            inputRef={inputRef}
            autoFocus
            value={draft}
            placeholder="Add a tag…"
            inputProps={{ list: listId, 'aria-label': 'Add a tag' }}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                commit();
              } else if (e.key === 'Escape') {
                setAdding(false);
                setDraft('');
              }
            }}
            onBlur={() => {
              commit();
              setAdding(false);
            }}
            sx={{
              fontSize: 11,
              color: tokens.text.primary,
              px: '10px',
              py: '3px',
              border: `1px dashed ${tokens.border.strong}`,
              borderRadius: `${tokens.radius.pill}px`,
            }}
          />
          <datalist id={listId}>
            {availableTags.map((t) => (
              <option key={t} value={t} />
            ))}
          </datalist>
        </>
      ) : (
        <ButtonBase
          onClick={() => setAdding(true)}
          sx={{
            fontSize: 11,
            color: tokens.text.secondary,
            px: '10px',
            py: '4px',
            border: `1px dashed ${tokens.border.subtle}`,
            borderRadius: `${tokens.radius.pill}px`,
          }}
        >
          + Add tag
        </ButtonBase>
      )}
    </Box>
  );
}
