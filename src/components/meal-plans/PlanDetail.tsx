// src/components/meal-plans/PlanDetail.tsx
'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Box, Button, CircularProgress, IconButton, Menu, MenuItem } from '@mui/material';
import { Icon } from '@/components/ui/Icon';
import { tokens } from '@/lib/design-tokens';
import type {
  DayOfWeek,
  MealItem,
  MealPlanItem,
  MealPlanWithTemplate,
  MealType,
} from '@/types/meal-plan';
import {
  fetchMealPlan,
  updateMealPlan,
  updateMealPlanTemplate,
  deleteMealPlan,
} from '@/lib/meal-plan-utils';
import {
  getDaysInOrder,
  getDateForDay,
  getEnabledMeals,
  computeTodayDow,
} from './meal-display-utils';
import { StaplesBar } from './StaplesBar';
import { PlanViewDesktop } from './PlanViewDesktop';
import { PlanViewMobile } from './PlanViewMobile';
import { MealEditorDialog, type EditableMeal } from './MealEditorDialog';
import { ConfirmDialog } from './ConfirmDialog';

export interface PlanDetailProps {
  planId: string;
}

const cap = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);

export function PlanDetail({ planId }: PlanDetailProps) {
  const router = useRouter();
  const [plan, setPlan] = useState<MealPlanWithTemplate | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);
  const [editing, setEditing] = useState<{ dow: DayOfWeek; mealType: MealType } | null>(null);
  const [editingStaples, setEditingStaples] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setNotFound(false);
    fetchMealPlan(planId)
      .then((p) => {
        if (!cancelled) setPlan(p);
      })
      .catch(() => {
        if (!cancelled) setNotFound(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [planId]);

  const mealsByDay = useMemo(() => {
    const map: Record<string, Partial<Record<MealType, MealPlanItem>>> = {};
    (plan?.items ?? []).forEach((mpi) => {
      (map[mpi.dayOfWeek] ??= {})[mpi.mealType] = mpi;
    });
    return map;
  }, [plan]);

  const enabledMeals = getEnabledMeals(
    plan?.template?.meals ?? plan?.templateSnapshot?.meals ?? {}
  );
  const staples = plan?.template?.weeklyStaples ?? [];
  const startDay = plan?.template?.startDay ?? plan?.templateSnapshot?.startDay ?? 'monday';
  const daysInOrder = plan ? getDaysInOrder(startDay) : [];
  const todayDow = computeTodayDow(plan);

  const dateLabelForDay = useCallback(
    (dow: DayOfWeek): string => (plan ? getDateForDay(plan.startDate, dow, startDay) : ''),
    [plan, startDay]
  );

  const onEditMeal = useCallback((dow: DayOfWeek, mealType: MealType) => {
    setEditing({ dow, mealType });
  }, []);

  const handleSaveMeal = async (dow: DayOfWeek, mealType: MealType, next: EditableMeal) => {
    if (!plan) return;
    const existing = plan.items;
    const idx = existing.findIndex((it) => it.dayOfWeek === dow && it.mealType === mealType);
    const merged: MealPlanItem =
      idx >= 0
        ? {
            ...existing[idx],
            items: next.items,
            skipped: next.skipped,
            skipReason: next.skipReason,
          }
        : {
            _id: '',
            mealPlanId: plan._id,
            dayOfWeek: dow,
            mealType,
            items: next.items,
            skipped: next.skipped,
            skipReason: next.skipReason,
          };
    const items =
      idx >= 0 ? existing.map((it, i) => (i === idx ? merged : it)) : [...existing, merged];
    const sanitized = items.map((mi) => ({
      ...mi,
      items: mi.items.map((x) => (x.type === 'recipe' ? { ...x, unit: undefined } : x)),
    }));
    await updateMealPlan(plan._id, { items: sanitized });
    setPlan(await fetchMealPlan(plan._id));
  };

  const handleSaveStaples = async (items: MealItem[]) => {
    if (!plan) return;
    await updateMealPlanTemplate({ weeklyStaples: items });
    setPlan(await fetchMealPlan(plan._id));
  };

  const handleDelete = async () => {
    if (!plan) return;
    await deleteMealPlan(plan._id);
    router.push('/meal-plans');
  };

  const noopFoodItemAdded = useCallback(async () => {}, []);

  const backButton = (
    <Button
      onClick={() => router.push('/meal-plans')}
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

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
        <CircularProgress sx={{ color: tokens.section.plans }} />
      </Box>
    );
  }

  if (notFound || !plan) {
    return (
      <Box sx={{ maxWidth: 720, mx: 'auto', px: 2, py: 6, textAlign: 'center' }}>
        <Box sx={{ mb: 2, display: 'flex', justifyContent: 'flex-start' }}>{backButton}</Box>
        <Box
          sx={{
            fontFamily: 'var(--font-display)',
            fontSize: 22,
            fontWeight: 700,
            color: tokens.text.primary,
            mb: 1,
          }}
        >
          Plan not found
        </Box>
        <Box sx={{ fontSize: 14, color: tokens.text.secondary }}>
          This meal plan may have been deleted, or you don&apos;t have access to it.
        </Box>
      </Box>
    );
  }

  const editingMeal: EditableMeal = (() => {
    if (!editing) return { items: [], skipped: false, skipReason: '' };
    const mpi = mealsByDay[editing.dow]?.[editing.mealType];
    return {
      items: mpi?.items ?? [],
      skipped: mpi?.skipped ?? false,
      skipReason: mpi?.skipReason ?? '',
    };
  })();

  return (
    <Box sx={{ maxWidth: 1080, mx: 'auto', px: { xs: 1.5, md: 3 }, py: { xs: 1.5, md: 3 } }}>
      {/* Back */}
      <Box sx={{ mb: 1.5 }}>{backButton}</Box>

      {/* Header */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 1.5,
          mb: 2.5,
        }}
      >
        <Box sx={{ minWidth: 0 }}>
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
            Meal Plan
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
            {plan.name}
          </Box>
          <Box sx={{ fontSize: 13, color: tokens.text.secondary, mt: 0.5 }}>
            {getDateForDay(plan.startDate, daysInOrder[0], startDay)} —{' '}
            {getDateForDay(plan.startDate, daysInOrder[daysInOrder.length - 1], startDay)}
          </Box>
        </Box>
        <IconButton
          aria-label="Plan options"
          onClick={(e) => setMenuAnchor(e.currentTarget)}
          sx={{ color: tokens.text.secondary }}
        >
          <Icon name="more_horiz" size={22} />
        </IconButton>
        <Menu
          anchorEl={menuAnchor}
          open={Boolean(menuAnchor)}
          onClose={() => setMenuAnchor(null)}
          slotProps={{ paper: { sx: { bgcolor: tokens.surface.sheet } } }}
        >
          <MenuItem
            onClick={() => {
              setMenuAnchor(null);
              setDeleteOpen(true);
            }}
            sx={{ color: tokens.state.danger, fontSize: 14 }}
          >
            Delete plan
          </MenuItem>
        </Menu>
      </Box>

      {/* Body */}
      <StaplesBar staples={staples} onEdit={() => setEditingStaples(true)} />

      <Box sx={{ display: { xs: 'none', md: 'block' } }}>
        <PlanViewDesktop
          mealsByDay={mealsByDay}
          daysInOrder={daysInOrder}
          dateLabelForDay={dateLabelForDay}
          enabledMeals={enabledMeals}
          todayDow={todayDow}
          onEditMeal={onEditMeal}
        />
      </Box>
      <Box sx={{ display: { xs: 'block', md: 'none' } }}>
        <PlanViewMobile
          mealsByDay={mealsByDay}
          daysInOrder={daysInOrder}
          dateLabelForDay={dateLabelForDay}
          enabledMeals={enabledMeals}
          todayDow={todayDow}
          onEditMeal={onEditMeal}
        />
      </Box>

      {/* Per-meal editor */}
      <MealEditorDialog
        open={!!editing}
        title={editing ? `${cap(editing.dow)} ${editing.mealType}` : ''}
        subtitle={editing ? dateLabelForDay(editing.dow) : undefined}
        meal={editingMeal}
        onSave={(next) => {
          if (editing) handleSaveMeal(editing.dow, editing.mealType, next);
          setEditing(null);
        }}
        onClose={() => setEditing(null)}
        onFoodItemAdded={noopFoodItemAdded}
      />

      {/* Staples editor */}
      <MealEditorDialog
        isStaples
        open={editingStaples}
        title="Weekly staples"
        meal={{ items: staples, skipped: false, skipReason: '' }}
        onSave={(n) => {
          handleSaveStaples(n.items);
          setEditingStaples(false);
        }}
        onClose={() => setEditingStaples(false)}
        onFoodItemAdded={noopFoodItemAdded}
      />

      {/* Delete confirm */}
      <ConfirmDialog
        open={deleteOpen}
        title="Delete this plan?"
        body={`"${plan.name}" and all its meals will be permanently removed.`}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        onConfirm={() => {
          setDeleteOpen(false);
          handleDelete();
        }}
        onCancel={() => setDeleteOpen(false)}
      />
    </Box>
  );
}
