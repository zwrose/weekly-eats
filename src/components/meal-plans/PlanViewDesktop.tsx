// src/components/meal-plans/PlanViewDesktop.tsx
'use client';

import { Box, ButtonBase } from '@mui/material';
import type { DayOfWeek, MealType, MealPlanItem } from '@/types/meal-plan';
import { tokens } from '@/lib/design-tokens';
import { MealItemLine } from './MealItemLine';
import { MEAL_LABEL, MEAL_LETTER, mealColorToken } from './meal-display-utils';
import type { PlanViewProps } from './meal-display-utils';

function Hero({
  dow,
  dateLabel,
  dayMeals,
  enabledMeals,
  onEditMeal,
}: {
  dow: DayOfWeek;
  dateLabel: string;
  dayMeals: Partial<Record<MealType, MealPlanItem>>;
  enabledMeals: MealType[];
  onEditMeal: PlanViewProps['onEditMeal'];
}) {
  return (
    <Box
      sx={{
        bgcolor: 'background.paper',
        borderRadius: `${tokens.radius.xxxl}px`,
        p: '22px 26px',
        border: `1px solid ${tokens.section.plans}55`,
        boxShadow: tokens.shadow.card,
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1.25 }}>
        <Box
          sx={{
            fontFamily: 'var(--font-display)',
            fontSize: 32,
            fontWeight: 700,
            color: tokens.section.plans,
            letterSpacing: '-0.02em',
          }}
        >
          {dateLabel}
        </Box>
        <Box
          component="span"
          sx={{
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: '0.18em',
            color: tokens.section.plans,
            bgcolor: tokens.accent.muted,
            px: 1,
            py: '3px',
            borderRadius: `${tokens.radius.pill}px`,
          }}
        >
          TODAY
        </Box>
      </Box>
      <Box sx={{ mt: 2.25, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 3 }}>
        {enabledMeals.map((mt) => {
          const meal = dayMeals[mt];
          const has = meal && (meal.skipped || (meal.items && meal.items.length > 0));
          return (
            <Box key={mt}>
              <Box
                sx={{
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: '0.18em',
                  color: mealColorToken(mt),
                  textTransform: 'uppercase',
                  mb: 1,
                }}
              >
                {MEAL_LABEL[mt]}
              </Box>
              {has ? (
                <ButtonBase
                  onClick={() => onEditMeal(dow, mt)}
                  sx={{ display: 'block', textAlign: 'left', width: '100%' }}
                >
                  {meal!.skipped ? (
                    <Box sx={{ fontSize: 13, color: tokens.text.muted, fontStyle: 'italic' }}>
                      Skipped
                    </Box>
                  ) : (
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
                      {meal!.items.map((it, i) => (
                        <MealItemLine key={i} item={it} />
                      ))}
                    </Box>
                  )}
                </ButtonBase>
              ) : (
                <ButtonBase
                  onClick={() => onEditMeal(dow, mt)}
                  aria-label={`Add ${MEAL_LABEL[mt].toLowerCase()}`}
                  sx={{
                    border: `1px dashed ${tokens.border.subtle}`,
                    color: tokens.text.muted,
                    borderRadius: `${tokens.radius.md}px`,
                    px: 1.25,
                    py: 0.5,
                    fontSize: 12,
                  }}
                >
                  + Add
                </ButtonBase>
              )}
            </Box>
          );
        })}
      </Box>
    </Box>
  );
}

function StripCell({
  dow,
  dateLabel,
  dayMeals,
  enabledMeals,
  past,
  onEditMeal,
}: {
  dow: DayOfWeek;
  dateLabel: string;
  dayMeals: Partial<Record<MealType, MealPlanItem>>;
  enabledMeals: MealType[];
  past: boolean;
  onEditMeal: PlanViewProps['onEditMeal'];
}) {
  const ink = past ? tokens.text.past : tokens.text.primary;
  const mute = past ? tokens.text.muted : tokens.text.secondary;
  // Render EVERY enabled meal — empty ones included — so each is tappable to edit.
  // (An enabled-but-empty meal is "nominally planned": show it with an Add affordance,
  // distinct from meals the template doesn't include at all, which aren't in enabledMeals.)
  const rows = enabledMeals.map((mt) => {
    const m = dayMeals[mt];
    const has = Boolean(m && (m.skipped || (m.items && m.items.length > 0)));
    return { mt, m, has };
  });
  return (
    <Box
      sx={{
        bgcolor: past ? tokens.surface.sunken : 'background.paper',
        borderRadius: `${tokens.radius.lg}px`,
        p: '10px 12px',
        opacity: past ? 0.72 : 1,
        minHeight: 130,
      }}
    >
      <Box
        sx={{
          fontFamily: 'var(--font-display)',
          fontSize: 14,
          fontWeight: 700,
          color: ink,
          mb: 0.75,
        }}
      >
        {dateLabel}
      </Box>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.375 }}>
        {rows.map(({ mt, m, has }) => (
          <ButtonBase
            key={mt}
            onClick={() => onEditMeal(dow, mt)}
            aria-label={has ? undefined : `Add ${MEAL_LABEL[mt].toLowerCase()} for ${dateLabel}`}
            sx={{
              display: 'block',
              textAlign: 'left',
              width: '100%',
              fontSize: 11,
              color: ink,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            <Box
              component="span"
              sx={{
                color: mealColorToken(mt),
                fontWeight: 700,
                fontFamily: 'var(--font-display)',
                mr: 0.5,
              }}
            >
              {MEAL_LETTER[mt]}
            </Box>
            {!has ? (
              <Box component="span" sx={{ color: mute, fontStyle: 'italic' }}>
                + Add
              </Box>
            ) : m!.skipped ? (
              <Box component="span" sx={{ color: mute, fontStyle: 'italic' }}>
                Skipped
              </Box>
            ) : (
              m!.items[0]?.name
            )}
            {has && !m!.skipped && m!.items.length > 1 && (
              <Box component="span" sx={{ color: mute }}>
                {' '}
                +{m!.items.length - 1}
              </Box>
            )}
          </ButtonBase>
        ))}
      </Box>
    </Box>
  );
}

function TodayPill() {
  return (
    <Box
      sx={{
        bgcolor: tokens.accent.muted,
        border: `1px solid ${tokens.section.plans}55`,
        borderRadius: `${tokens.radius.lg}px`,
        py: '10px',
        minHeight: 130,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 0.75,
      }}
    >
      <Box sx={{ color: tokens.section.plans, fontSize: 14, fontWeight: 700, lineHeight: 1 }}>
        ↑
      </Box>
      <Box
        sx={{
          fontFamily: 'var(--font-display)',
          fontSize: 11,
          fontWeight: 700,
          color: tokens.section.plans,
          writingMode: 'vertical-rl',
          transform: 'rotate(180deg)',
          letterSpacing: '0.18em',
        }}
      >
        TODAY
      </Box>
    </Box>
  );
}

export function PlanViewDesktop({
  mealsByDay,
  daysInOrder,
  dateLabelForDay,
  enabledMeals,
  todayDow,
  onEditMeal,
}: PlanViewProps) {
  const todayIdx = todayDow ? daysInOrder.indexOf(todayDow) : -1;
  const stripDays = todayIdx >= 0 ? daysInOrder.filter((d) => d !== todayDow) : daysInOrder;
  // calendar-order split for the pill: days before today vs after
  const before = todayIdx >= 0 ? daysInOrder.slice(0, todayIdx) : [];
  const after = todayIdx >= 0 ? daysInOrder.slice(todayIdx + 1) : [];
  const showPill = todayIdx >= 0;
  const gridCols = showPill
    ? `${before.map(() => '1fr').join(' ')} 28px ${after.map(() => '1fr').join(' ')}`.trim()
    : `repeat(${daysInOrder.length}, 1fr)`;

  const renderCell = (dow: DayOfWeek) => {
    const past = todayIdx >= 0 && daysInOrder.indexOf(dow) < todayIdx;
    return (
      <StripCell
        key={dow}
        dow={dow}
        dateLabel={dateLabelForDay(dow)}
        dayMeals={mealsByDay[dow] || {}}
        enabledMeals={enabledMeals}
        past={past}
        onEditMeal={onEditMeal}
      />
    );
  };

  return (
    <Box>
      {showPill && (
        <Hero
          dow={todayDow!}
          dateLabel={dateLabelForDay(todayDow!)}
          dayMeals={mealsByDay[todayDow!] || {}}
          enabledMeals={enabledMeals}
          onEditMeal={onEditMeal}
        />
      )}
      <Box sx={{ mt: 2.75 }}>
        <Box
          sx={{
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: '0.16em',
            color: tokens.text.secondary,
            textTransform: 'uppercase',
            px: 0.5,
            pb: 1,
          }}
        >
          This week
        </Box>
        <Box
          sx={{ display: 'grid', gridTemplateColumns: gridCols, gap: 1.25, alignItems: 'stretch' }}
        >
          {showPill ? (
            <>
              {before.map(renderCell)}
              <TodayPill />
              {after.map(renderCell)}
            </>
          ) : (
            stripDays.map(renderCell)
          )}
        </Box>
      </Box>
    </Box>
  );
}
