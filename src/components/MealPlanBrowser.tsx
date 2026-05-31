'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Box, Typography, Collapse, CircularProgress } from '@mui/material';
import { ExpandMore, ExpandLess, FolderOpen } from '@mui/icons-material';
import { Icon } from '@/components/ui/Icon';
import { tokens } from '@/lib/design-tokens';
import type { MealPlanWithTemplate } from '@/types/meal-plan';

interface MonthSummary {
  year: number;
  month: number;
  count: number;
  earliest: string;
  latest: string;
}

interface MealPlanBrowserProps {
  onPlanSelect: (plan: MealPlanWithTemplate) => void;
}

const monthNames = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

function getLastDayOfMonth(year: number, month: number): string {
  const lastDay = new Date(year, month, 0).getDate();
  return `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
}

// Pill badge for plan/month counts
function CountBadge({ count }: { count: number }) {
  return (
    <Box
      component="span"
      sx={{
        fontSize: 11,
        fontWeight: 700,
        lineHeight: 1,
        px: 1,
        py: '3px',
        borderRadius: `${tokens.radius.pill}px`,
        bgcolor: `${tokens.section.plans}22`,
        color: tokens.section.plans,
        border: `1px solid ${tokens.section.plans}44`,
        minWidth: 22,
        textAlign: 'center',
      }}
    >
      {count}
    </Box>
  );
}

// Accent-tinted square icon container
function AccentIconBox({ children }: { children: React.ReactNode }) {
  return (
    <Box
      sx={{
        width: 28,
        height: 28,
        borderRadius: `${tokens.radius.sm}px`,
        bgcolor: `${tokens.section.plans}1a`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        color: tokens.section.plans,
      }}
    >
      {children}
    </Box>
  );
}

// Shared row sx for clickable accordion rows
const rowSx = {
  display: 'flex',
  alignItems: 'center',
  gap: 1.5,
  px: 2,
  py: 1.25,
  cursor: 'pointer',
  borderRadius: `${tokens.radius.xl}px`,
  bgcolor: tokens.surface.raised,
  border: `1px solid ${tokens.border.subtle}`,
  mb: 1,
  transition: 'background-color 0.15s ease, border-color 0.15s ease',
  '&:hover': {
    bgcolor: tokens.surface.elevated,
    borderColor: tokens.border.strong,
  },
};

// Plan row sx — adds the section ring for current plan look
const planRowSx = {
  ...rowSx,
  border: `1px solid ${tokens.section.plans}55`,
  boxShadow: tokens.shadow.card,
};

const MealPlanBrowserComponent = React.memo<MealPlanBrowserProps>(({ onPlanSelect }) => {
  const [summary, setSummary] = useState<MonthSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedYear, setExpandedYear] = useState<number | null>(null);
  const [expandedMonth, setExpandedMonth] = useState<string | null>(null);
  const [monthPlans, setMonthPlans] = useState<Record<string, MealPlanWithTemplate[]>>({});
  const [loadingMonth, setLoadingMonth] = useState<string | null>(null);

  useEffect(() => {
    const loadSummary = async () => {
      try {
        const res = await fetch('/api/meal-plans/summary');
        if (res.ok) {
          const data = await res.json();
          setSummary(data);
        }
      } catch (error) {
        console.error('Error loading meal plan summary:', error);
      } finally {
        setLoading(false);
      }
    };
    loadSummary();
  }, []);

  const handleYearClick = useCallback(
    (year: number) => {
      if (expandedYear === year) {
        setExpandedYear(null);
        setExpandedMonth(null);
      } else {
        setExpandedYear(year);
      }
    },
    [expandedYear]
  );

  const handleMonthClick = useCallback(
    async (year: number, month: number) => {
      const key = `${year}-${month}`;

      if (expandedMonth === key) {
        setExpandedMonth(null);
        return;
      }

      setExpandedMonth(key);

      // Lazy-load plans if not cached
      if (!monthPlans[key]) {
        setLoadingMonth(key);
        try {
          const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
          const endDate = getLastDayOfMonth(year, month);
          const res = await fetch(`/api/meal-plans?startDate=${startDate}&endDate=${endDate}`);
          if (res.ok) {
            const data = await res.json();
            setMonthPlans((prev) => ({ ...prev, [key]: data }));
          }
        } catch (error) {
          console.error('Error loading month plans:', error);
        } finally {
          setLoadingMonth(null);
        }
      }
    },
    [expandedMonth, monthPlans]
  );

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
        <CircularProgress size={24} sx={{ color: tokens.section.plans }} />
      </Box>
    );
  }

  if (summary.length === 0) {
    return (
      <Typography variant="body2" sx={{ color: tokens.text.secondary, py: 2, textAlign: 'center' }}>
        No meal plan history
      </Typography>
    );
  }

  // Group by year
  const byYear: Record<number, MonthSummary[]> = {};
  for (const item of summary) {
    if (!byYear[item.year]) byYear[item.year] = [];
    byYear[item.year].push(item);
  }

  const years = Object.keys(byYear)
    .map(Number)
    .sort((a, b) => b - a);

  return (
    <Box>
      {years.map((year) => {
        const isYearExpanded = expandedYear === year;
        const yearPlanCount = byYear[year].reduce((sum, m) => sum + m.count, 0);

        return (
          <React.Fragment key={year}>
            {/* Year row */}
            <Box onClick={() => handleYearClick(year)} sx={rowSx} role="button" tabIndex={0}>
              <FolderOpen sx={{ fontSize: 18, color: tokens.text.secondary, flexShrink: 0 }} />
              <Typography
                sx={{
                  fontWeight: 600,
                  fontSize: 14,
                  color: tokens.text.primary,
                  flex: 1,
                }}
              >
                {year}
              </Typography>
              <CountBadge count={yearPlanCount} />
              {isYearExpanded ? (
                <ExpandLess sx={{ fontSize: 18, color: tokens.text.muted }} />
              ) : (
                <ExpandMore sx={{ fontSize: 18, color: tokens.text.muted }} />
              )}
            </Box>

            <Collapse in={isYearExpanded} timeout="auto" unmountOnExit>
              <Box sx={{ pl: 2 }}>
                {byYear[year].map((item) => {
                  const key = `${item.year}-${item.month}`;
                  const isExpanded = expandedMonth === key;
                  const plans = monthPlans[key] || [];
                  const isLoadingPlans = loadingMonth === key;

                  return (
                    <React.Fragment key={key}>
                      {/* Month row */}
                      <Box
                        onClick={() => handleMonthClick(item.year, item.month)}
                        sx={rowSx}
                        role="button"
                        tabIndex={0}
                      >
                        <AccentIconBox>
                          <Icon name="calendar_month" size={16} aria-label="calendar" />
                        </AccentIconBox>
                        <Typography
                          sx={{
                            fontWeight: 500,
                            fontSize: 13,
                            color: tokens.text.primary,
                            flex: 1,
                          }}
                        >
                          {monthNames[item.month - 1]}
                        </Typography>
                        <CountBadge count={item.count} />
                        {isExpanded ? (
                          <ExpandLess sx={{ fontSize: 16, color: tokens.text.muted }} />
                        ) : (
                          <ExpandMore sx={{ fontSize: 16, color: tokens.text.muted }} />
                        )}
                      </Box>

                      <Collapse in={isExpanded} timeout="auto" unmountOnExit>
                        {isLoadingPlans ? (
                          <Box sx={{ display: 'flex', justifyContent: 'center', py: 1 }}>
                            <CircularProgress size={20} sx={{ color: tokens.section.plans }} />
                          </Box>
                        ) : (
                          <Box sx={{ pl: 2 }}>
                            {plans.map((plan: MealPlanWithTemplate) => (
                              <Box
                                key={plan._id}
                                onClick={() => onPlanSelect(plan)}
                                sx={planRowSx}
                                role="button"
                                tabIndex={0}
                              >
                                <AccentIconBox>
                                  <Icon name="calendar_month" size={16} aria-label="calendar" />
                                </AccentIconBox>
                                <Typography
                                  sx={{
                                    fontWeight: 500,
                                    fontSize: 13,
                                    color: tokens.text.primary,
                                    flex: 1,
                                  }}
                                >
                                  {plan.name}
                                </Typography>
                              </Box>
                            ))}
                          </Box>
                        )}
                      </Collapse>
                    </React.Fragment>
                  );
                })}
              </Box>
            </Collapse>
          </React.Fragment>
        );
      })}
    </Box>
  );
});

MealPlanBrowserComponent.displayName = 'MealPlanBrowser';

// Named export for future imports — keeps default export for back-compat.
export { MealPlanBrowserComponent as MealPlanBrowser };
export default MealPlanBrowserComponent;
