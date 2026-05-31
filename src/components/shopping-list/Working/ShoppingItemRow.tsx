'use client';

import { Box, ButtonBase } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Icon } from '@/components/ui/Icon';
import { tokens } from '@/lib/design-tokens';
import { getUnitForm } from '@/lib/food-items-utils';
import type { ShoppingListItem } from '@/types/shopping-list';

export interface ShoppingItemRowProps {
  item: ShoppingListItem;
  onToggle: (foodItemId: string) => void;
  onEdit: (item: ShoppingListItem) => void;
}

export function ShoppingItemRow({ item, onToggle, onEdit }: ShoppingItemRowProps) {
  const theme = useTheme();

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.foodItemId,
  });

  const unitText =
    item.unit && item.unit !== 'each'
      ? getUnitForm(item.unit, item.quantity)
      : item.unit === 'each'
        ? 'each'
        : '';

  return (
    <Box
      ref={setNodeRef}
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: { xs: 1.5, md: 1.75 },
        px: { xs: '14px', md: '18px' },
        py: '12px',
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.6 : item.checked ? { xs: 0.6, md: 0.55 } : 1,
      }}
    >
      {/* Real checkbox input — visually hidden but accessible */}
      <Box
        component="label"
        sx={{
          position: 'relative',
          width: 22,
          height: 22,
          flexShrink: 0,
          cursor: 'pointer',
        }}
      >
        {/* Native input — provides real .checked semantics for tests */}
        <Box
          component="input"
          type="checkbox"
          aria-label={item.name}
          checked={item.checked}
          onChange={() => onToggle(item.foodItemId)}
          sx={{
            position: 'absolute',
            opacity: 0,
            width: '100%',
            height: '100%',
            margin: 0,
            cursor: 'pointer',
            zIndex: 1,
          }}
        />
        {/* Visual checkbox box */}
        <Box
          aria-hidden
          sx={{
            position: 'absolute',
            inset: 0,
            borderRadius: `${tokens.radius.sm}px`,
            border: item.checked
              ? `1.5px solid ${theme.palette.primary.main}`
              : `1.5px solid ${tokens.border.strong}`,
            bgcolor: item.checked ? theme.palette.primary.main : 'transparent',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            pointerEvents: 'none',
          }}
        >
          {item.checked && (
            <Icon name="check" size={14} color={tokens.onAccent.shop} weight={600} />
          )}
        </Box>
      </Box>

      {/* Row body — tapping calls onEdit */}
      <ButtonBase
        onClick={() => onEdit(item)}
        sx={{
          flex: 1,
          minWidth: 0,
          display: 'flex',
          alignItems: 'baseline',
          justifyContent: 'flex-start',
          gap: 1,
          textAlign: 'left',
          py: 0.25,
        }}
      >
        <Box
          component="span"
          style={{ textDecoration: item.checked ? 'line-through' : 'none' }}
          sx={{
            fontSize: { xs: 14.5, md: 15 },
            fontWeight: 500,
            color: tokens.text.primary,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {item.name}
        </Box>
        <Box
          component="span"
          sx={{
            fontSize: { xs: 11.5, md: 12.5 },
            color: tokens.text.muted,
            fontVariantNumeric: 'tabular-nums',
            whiteSpace: 'nowrap',
            flexShrink: 0,
          }}
        >
          {item.quantity} {unitText}
        </Box>
      </ButtonBase>

      {/* Drag handle */}
      <Box
        component="button"
        type="button"
        aria-label="Reorder"
        {...attributes}
        {...listeners}
        sx={{
          background: 'none',
          border: 'none',
          padding: '4px',
          cursor: 'grab',
          touchAction: 'none',
          color: tokens.text.muted,
          display: 'flex',
          alignItems: 'center',
          flexShrink: 0,
          ml: 'auto',
          '&:active': { cursor: 'grabbing' },
        }}
      >
        <Icon name="drag_indicator" size={18} />
      </Box>
    </Box>
  );
}
