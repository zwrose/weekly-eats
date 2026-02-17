'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  List,
  ListItemButton,
  ListItemText,
  Collapse,
  CircularProgress,
  Chip,
} from '@mui/material';
import { ExpandMore, ExpandLess, CalendarMonth } from '@mui/icons-material';
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
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function getLastDayOfMonth(year: number, month: number): string {
  const lastDay = new Date(year, month, 0).getDate();
  return `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
}

const MealPlanBrowser = React.memo<MealPlanBrowserProps>(({ onPlanSelect }) => {
  const [summary, setSummary] = useState<MonthSummary[]>([]);
  const [loading, setLoading] = useState(true);
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

  const handleMonthClick = useCallback(async (year: number, month: number) => {
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
          setMonthPlans(prev => ({ ...prev, [key]: data }));
        }
      } catch (error) {
        console.error('Error loading month plans:', error);
      } finally {
        setLoadingMonth(null);
      }
    }
  }, [expandedMonth, monthPlans]);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
        <CircularProgress size={24} />
      </Box>
    );
  }

  if (summary.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary" sx={{ py: 2, textAlign: 'center' }}>
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

  const years = Object.keys(byYear).map(Number).sort((a, b) => b - a);

  return (
    <Box>
      {years.map(year => (
        <Box key={year} sx={{ mb: 1 }}>
          <Typography variant="subtitle2" sx={{ px: 2, py: 0.5, color: 'text.secondary', fontWeight: 600 }}>
            {year}
          </Typography>
          <List disablePadding dense>
            {byYear[year].map(item => {
              const key = `${item.year}-${item.month}`;
              const isExpanded = expandedMonth === key;
              const plans = monthPlans[key] || [];
              const isLoadingPlans = loadingMonth === key;

              return (
                <React.Fragment key={key}>
                  <ListItemButton
                    onClick={() => handleMonthClick(item.year, item.month)}
                    sx={{ pl: 3 }}
                  >
                    <CalendarMonth sx={{ mr: 1, fontSize: 18, color: 'text.secondary' }} />
                    <ListItemText primary={monthNames[item.month - 1]} />
                    <Chip label={item.count} size="small" variant="outlined" sx={{ mr: 1 }} />
                    {isExpanded ? <ExpandLess /> : <ExpandMore />}
                  </ListItemButton>
                  <Collapse in={isExpanded} timeout="auto" unmountOnExit>
                    {isLoadingPlans ? (
                      <Box sx={{ display: 'flex', justifyContent: 'center', py: 1 }}>
                        <CircularProgress size={20} />
                      </Box>
                    ) : (
                      <List disablePadding dense>
                        {plans.map((plan: MealPlanWithTemplate) => (
                          <ListItemButton
                            key={plan._id}
                            sx={{ pl: 6 }}
                            onClick={() => onPlanSelect(plan)}
                          >
                            <ListItemText
                              primary={plan.name}
                              secondary={`${plan.startDate} — ${plan.endDate}`}
                            />
                          </ListItemButton>
                        ))}
                      </List>
                    )}
                  </Collapse>
                </React.Fragment>
              );
            })}
          </List>
        </Box>
      ))}
    </Box>
  );
});

MealPlanBrowser.displayName = 'MealPlanBrowser';
export default MealPlanBrowser;
