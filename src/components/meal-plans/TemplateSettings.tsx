// src/components/meal-plans/TemplateSettings.tsx
'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Box, Button, ButtonBase, CircularProgress, Switch } from '@mui/material';
import { Icon } from '@/components/ui/Icon';
import { tokens } from '@/lib/design-tokens';
import type { DayOfWeek, MealItem, MealType } from '@/types/meal-plan';
import {
  DEFAULT_TEMPLATE,
  fetchMealPlanTemplate,
  updateMealPlanTemplate,
} from '@/lib/meal-plan-utils';
import { MealEditorDialog } from './MealEditorDialog';
import { MealItemLine } from './MealItemLine';
import { MEAL_LABEL, MEAL_ORDER, mealColorToken, mealItemCount } from './meal-display-utils';

const DAY_CHIPS: { label: string; value: DayOfWeek }[] = [
  { label: 'Sun', value: 'sunday' },
  { label: 'Mon', value: 'monday' },
  { label: 'Tue', value: 'tuesday' },
  { label: 'Wed', value: 'wednesday' },
  { label: 'Thu', value: 'thursday' },
  { label: 'Fri', value: 'friday' },
  { label: 'Sat', value: 'saturday' },
];

interface Draft {
  startDay: DayOfWeek;
  meals: Record<MealType, boolean>;
  weeklyStaples: MealItem[];
}

const FieldLabel = ({ children }: { children: React.ReactNode }) => (
  <Box
    sx={{
      fontSize: 10,
      fontWeight: 700,
      letterSpacing: '0.16em',
      textTransform: 'uppercase',
      color: tokens.text.secondary,
      mb: 1,
    }}
  >
    {children}
  </Box>
);

export function TemplateSettings() {
  const router = useRouter();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [staplesOpen, setStaplesOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const applyBase = (
      base:
        | typeof DEFAULT_TEMPLATE
        | { startDay: DayOfWeek; meals: Record<MealType, boolean>; weeklyStaples?: MealItem[] }
    ) => {
      if (cancelled) return;
      setDraft({
        startDay: base.startDay,
        meals: { ...base.meals },
        weeklyStaples: base.weeklyStaples ?? [],
      });
    };
    fetchMealPlanTemplate()
      .then((t) => applyBase(t ?? DEFAULT_TEMPLATE))
      // No template yet (404) → seed the editable draft from the default shape.
      .catch(() => applyBase(DEFAULT_TEMPLATE))
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const back = useCallback(() => router.push('/meal-plans'), [router]);

  const save = async () => {
    if (!draft) return;
    setSaving(true);
    try {
      await updateMealPlanTemplate(draft);
      router.push('/meal-plans');
    } finally {
      setSaving(false);
    }
  };

  const noopFoodItemAdded = useCallback(async () => {}, []);

  const backButton = (
    <Button
      onClick={back}
      startIcon={
        <Box component="span" sx={{ fontSize: 20, lineHeight: 1 }}>
          ‹
        </Box>
      }
      sx={{
        color: tokens.section.plans,
        textTransform: 'none',
        fontWeight: 600,
        px: 1,
        minWidth: 0,
      }}
    >
      Plans
    </Button>
  );

  if (loading || !draft) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
        <CircularProgress sx={{ color: tokens.section.plans }} />
      </Box>
    );
  }

  const groups = draft.weeklyStaples.filter((s) => s.type === 'ingredientGroup');
  const loose = draft.weeklyStaples.filter((s) => s.type !== 'ingredientGroup');
  const totalStaples = mealItemCount(draft.weeklyStaples);
  // Loose staples render under a synthetic "Other" group so they expand the same way.
  const otherGroup: MealItem | null =
    loose.length > 0
      ? {
          type: 'ingredientGroup',
          id: '',
          name: 'Other',
          ingredients: [
            {
              title: 'Other',
              ingredients: loose.map((l) => ({
                type: l.type === 'recipe' ? ('recipe' as const) : ('foodItem' as const),
                id: l.id,
                name: l.name,
                quantity: l.quantity ?? 1,
                unit: l.unit,
              })),
            },
          ],
        }
      : null;

  const card = {
    bgcolor: tokens.surface.raised,
    borderRadius: `${tokens.radius.xl}px`,
    border: `1px solid ${tokens.border.subtle}`,
    p: 2.25,
  } as const;

  return (
    <Box
      sx={{
        maxWidth: 1080,
        mx: 'auto',
        px: { xs: 1.5, md: 3 },
        pt: { xs: 0, md: 3 },
        pb: { xs: 1.5, md: 3 },
      }}
    >
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
        {backButton}
        <Button
          onClick={save}
          disabled={saving}
          sx={{
            fontWeight: 600,
            color: tokens.section.plans,
            '&.Mui-disabled': { color: tokens.text.muted },
          }}
        >
          Save
        </Button>
      </Box>
      <Box sx={{ mb: 2.5 }}>
        <Box
          sx={{
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: '0.16em',
            textTransform: 'uppercase',
            color: tokens.section.plans,
            mb: 0.5,
          }}
        >
          Template
        </Box>
        <Box
          sx={{
            fontFamily: 'var(--font-display)',
            fontSize: { xs: 24, md: 30 },
            fontWeight: 700,
            color: tokens.text.primary,
            lineHeight: 1.1,
          }}
        >
          Your default plan shape
        </Box>
        <Box sx={{ fontSize: 13, color: tokens.text.secondary, mt: 0.5 }}>
          Applied when you create a new meal plan.
        </Box>
      </Box>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
          gap: { xs: 2, md: 3 },
          alignItems: 'flex-start',
        }}
      >
        {/* Week start + meals */}
        <Box sx={card}>
          <FieldLabel>Week starts on</FieldLabel>
          <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap', mb: 2 }}>
            {DAY_CHIPS.map((d) => {
              const selected = draft.startDay === d.value;
              return (
                <ButtonBase
                  key={d.value}
                  aria-label={d.label}
                  aria-pressed={selected}
                  onClick={() => setDraft((p) => p && { ...p, startDay: d.value })}
                  sx={{
                    height: 36,
                    px: 1.75,
                    borderRadius: `${tokens.radius.md}px`,
                    fontSize: 13,
                    fontWeight: 600,
                    bgcolor: selected ? tokens.accent.muted : 'transparent',
                    border: `1px solid ${selected ? tokens.section.plans : tokens.border.subtle}`,
                    color: selected ? tokens.section.plans : tokens.text.primary,
                  }}
                >
                  {d.label}
                </ButtonBase>
              );
            })}
          </Box>

          <FieldLabel>Meals to plan</FieldLabel>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {MEAL_ORDER.map((meal) => (
              <Box
                key={meal}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1.5,
                  px: 1.5,
                  py: 1,
                  bgcolor: tokens.surface.elevated,
                  borderRadius: `${tokens.radius.lg}px`,
                  border: `1px solid ${tokens.border.subtle}`,
                }}
              >
                <Box
                  component="span"
                  sx={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    bgcolor: mealColorToken(meal),
                    flexShrink: 0,
                  }}
                />
                <Box sx={{ flex: 1, fontSize: 14, color: tokens.text.primary }}>
                  {MEAL_LABEL[meal]}
                </Box>
                <Switch
                  checked={Boolean(draft.meals[meal])}
                  onChange={(e) =>
                    setDraft((p) => p && { ...p, meals: { ...p.meals, [meal]: e.target.checked } })
                  }
                  inputProps={{ 'aria-label': MEAL_LABEL[meal] }}
                />
              </Box>
            ))}
          </Box>
        </Box>

        {/* Staples */}
        <Box sx={card}>
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              mb: 1.5,
            }}
          >
            <FieldLabel>Default staples · {totalStaples}</FieldLabel>
            <Button
              onClick={() => setStaplesOpen(true)}
              startIcon={<Icon name="edit" size={16} />}
              sx={{ color: tokens.section.plans, textTransform: 'none', fontWeight: 600 }}
            >
              Edit
            </Button>
          </Box>
          <Box sx={{ fontSize: 12, color: tokens.text.secondary, mb: 1.5 }}>
            Auto-added to every new plan. Organize into groups for shopping.
          </Box>

          {totalStaples === 0 ? (
            <Box sx={{ fontSize: 13, color: tokens.text.muted, py: 1 }}>No staples yet</Box>
          ) : (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.75 }}>
              {groups.map((g, i) => (
                <MealItemLine
                  key={`g${i}`}
                  item={g}
                  expandGroup
                  groupAccent={tokens.meal.staples}
                />
              ))}
              {otherGroup && (
                <MealItemLine item={otherGroup} expandGroup groupAccent={tokens.meal.staples} />
              )}
            </Box>
          )}
        </Box>
      </Box>

      {/* Staples editor */}
      <MealEditorDialog
        isStaples
        open={staplesOpen}
        title="Weekly staples"
        meal={{ items: draft.weeklyStaples, skipped: false, skipReason: '' }}
        onSave={(next) => {
          setDraft((p) => p && { ...p, weeklyStaples: next.items });
          setStaplesOpen(false);
        }}
        onClose={() => setStaplesOpen(false)}
        onFoodItemAdded={noopFoodItemAdded}
      />
    </Box>
  );
}
