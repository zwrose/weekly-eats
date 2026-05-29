'use client';

import { Box, ButtonBase } from '@mui/material';
import type { DayOfWeek, MealType, MealPlanItem } from '@/types/meal-plan';
import { tokens } from '@/lib/design-tokens';
import { MealItemLine } from './MealItemLine';
import { MEAL_LABEL, MEAL_LETTER, mealColorToken, type PlanViewProps } from './meal-display-utils';

function MealRow({
  dow,
  mealType,
  meal,
  onEditMeal,
}: {
  dow: DayOfWeek;
  mealType: MealType;
  meal: MealPlanItem;
  onEditMeal: PlanViewProps['onEditMeal'];
}) {
  const color = mealColorToken(mealType);
  return (
    <ButtonBase
      onClick={() => onEditMeal(dow, mealType)}
      sx={{
        display: 'flex',
        gap: 1.5,
        px: 1.75,
        py: 1.375,
        borderTop: `1px solid ${tokens.border.subtle}`,
        width: '100%',
        textAlign: 'left',
        alignItems: 'flex-start',
        justifyContent: 'flex-start',
      }}
    >
      <Box
        component="span"
        sx={{
          flex: '0 0 18px',
          fontSize: 13,
          color,
          fontWeight: 700,
          fontFamily: 'var(--font-display)',
        }}
      >
        {MEAL_LETTER[mealType]}
      </Box>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        {meal.skipped ? (
          <Box sx={{ fontSize: 13, color: tokens.text.muted, fontStyle: 'italic' }}>
            Skipped{meal.skipReason ? ` · ${meal.skipReason}` : ''}
          </Box>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {meal.items.map((it, i) => (
              <MealItemLine key={i} item={it} />
            ))}
          </Box>
        )}
      </Box>
    </ButtonBase>
  );
}

export function PlanViewMobile({
  mealsByDay,
  daysInOrder,
  dateLabelForDay,
  enabledMeals,
  todayDow,
  onEditMeal,
}: PlanViewProps) {
  return (
    <Box>
      {daysInOrder.map((dow) => {
        const dayMeals = mealsByDay[dow] ?? {};
        const filled = enabledMeals.filter((mt) => {
          const m = dayMeals[mt];
          return m && (m.skipped || (m.items && m.items.length > 0));
        });
        const missing = enabledMeals.filter((mt) => {
          const m = dayMeals[mt];
          return !m || (!m.skipped && (!m.items || m.items.length === 0));
        });
        const isToday = dow === todayDow;
        return (
          <Box
            key={dow}
            sx={{
              bgcolor: 'background.paper',
              borderRadius: `${tokens.radius.xxl}px`,
              overflow: 'hidden',
              mb: 1.5,
              border: isToday ? `1px solid ${tokens.section.plans}55` : '1px solid transparent',
              boxShadow: isToday ? tokens.shadow.card : 'none',
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, px: 1.75, py: 1.25 }}>
              <Box
                sx={{
                  fontFamily: 'var(--font-display)',
                  fontSize: 17,
                  fontWeight: 700,
                  color: isToday ? tokens.section.plans : tokens.text.primary,
                  letterSpacing: '-0.015em',
                }}
              >
                {dateLabelForDay(dow)}
              </Box>
              {isToday && (
                <Box
                  component="span"
                  sx={{
                    fontSize: 9,
                    fontWeight: 700,
                    letterSpacing: '0.16em',
                    color: tokens.section.plans,
                    bgcolor: tokens.accent.muted,
                    px: 1,
                    py: '3px',
                    borderRadius: `${tokens.radius.pill}px`,
                  }}
                >
                  TODAY
                </Box>
              )}
            </Box>
            {filled.map((mt) => (
              <MealRow
                key={mt}
                dow={dow}
                mealType={mt}
                meal={mealsByDay[dow]![mt]!}
                onEditMeal={onEditMeal}
              />
            ))}
            {missing.length > 0 && (
              <Box
                sx={{
                  display: 'flex',
                  gap: 0.75,
                  flexWrap: 'wrap',
                  px: 1.75,
                  py: 1.25,
                  borderTop: filled.length > 0 ? `1px solid ${tokens.border.subtle}` : 'none',
                }}
              >
                {missing.map((mt) => (
                  <ButtonBase
                    key={mt}
                    onClick={() => onEditMeal(dow, mt)}
                    aria-label={`Add ${MEAL_LABEL[mt].toLowerCase()}`}
                    sx={{
                      border: `1px dashed ${tokens.border.subtle}`,
                      color: tokens.text.muted,
                      borderRadius: `${tokens.radius.md}px`,
                      px: 1.25,
                      py: 0.5,
                      fontSize: 12,
                      gap: 0.75,
                    }}
                  >
                    + {MEAL_LABEL[mt]}
                  </ButtonBase>
                ))}
              </Box>
            )}
          </Box>
        );
      })}
    </Box>
  );
}
