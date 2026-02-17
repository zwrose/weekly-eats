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
  Paper,
} from '@mui/material';
import { ExpandMore, ExpandLess, CalendarMonth, FolderOpen } from '@mui/icons-material';
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

  const handleYearClick = useCallback((year: number) => {
    if (expandedYear === year) {
      setExpandedYear(null);
      setExpandedMonth(null);
    } else {
      setExpandedYear(year);
    }
  }, [expandedYear]);

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

  // Shared card sx for mobile — matches the Recent Meal Plans card style
  const mobileCardSx = {
    p: 3,
    mb: 2,
    cursor: 'pointer',
    boxShadow: 2,
    border: '1px solid',
    borderColor: 'divider',
    borderRadius: 2,
    '&:hover': {
      backgroundColor: 'action.hover',
      transform: 'translateY(-2px)',
      boxShadow: 4
    },
    transition: 'all 0.2s ease-in-out'
  };

  return (
    <Box>
      {years.map(year => {
        const isYearExpanded = expandedYear === year;
        const yearPlanCount = byYear[year].reduce((sum, m) => sum + m.count, 0);

        return (
          <React.Fragment key={year}>
            {/* Year row — card on mobile */}
            <Paper
              onClick={() => handleYearClick(year)}
              elevation={0}
              sx={{
                ...mobileCardSx,
                display: { xs: 'flex', md: 'none' },
                alignItems: 'center',
                gap: 1,
              }}
            >
              <FolderOpen sx={{ fontSize: 24, color: 'text.secondary' }} />
              <Typography variant="h6" sx={{ fontWeight: 'medium', flex: 1 }}>
                {year}
              </Typography>
              <Chip label={yearPlanCount} size="small" variant="outlined" sx={{ mr: 1 }} />
              {isYearExpanded ? <ExpandLess color="action" /> : <ExpandMore color="action" />}
            </Paper>

            {/* Year row — list item on desktop */}
            <ListItemButton
              onClick={() => handleYearClick(year)}
              sx={{ display: { xs: 'none', md: 'flex' }, minHeight: 40, py: 0.5 }}
            >
              <FolderOpen sx={{ mr: 1.5, fontSize: 20, color: 'text.secondary' }} />
              <ListItemText primary={String(year)} primaryTypographyProps={{ fontWeight: 600 }} />
              <Chip label={yearPlanCount} size="small" variant="outlined" sx={{ mr: 1 }} />
              {isYearExpanded ? <ExpandLess /> : <ExpandMore />}
            </ListItemButton>

            <Collapse in={isYearExpanded} timeout="auto" unmountOnExit>
              <Box sx={{ pl: { xs: 0, md: 0 } }}>
                {byYear[year].map(item => {
                  const key = `${item.year}-${item.month}`;
                  const isExpanded = expandedMonth === key;
                  const plans = monthPlans[key] || [];
                  const isLoadingPlans = loadingMonth === key;

                  return (
                    <React.Fragment key={key}>
                      {/* Month row — card on mobile, list item on desktop */}
                      <Paper
                        onClick={() => handleMonthClick(item.year, item.month)}
                        elevation={0}
                        sx={{
                          ...mobileCardSx,
                          ml: { xs: 2, md: 0 },
                          mr: { xs: 0, md: 0 },
                          display: { xs: 'flex', md: 'none' },
                          alignItems: 'center',
                          gap: 1,
                        }}
                      >
                        <CalendarMonth sx={{ fontSize: 24, color: 'text.secondary' }} />
                        <Typography variant="h6" sx={{ fontWeight: 'medium', flex: 1 }}>
                          {monthNames[item.month - 1]}
                        </Typography>
                        <Chip label={item.count} size="small" variant="outlined" sx={{ mr: 1 }} />
                        {isExpanded ? <ExpandLess color="action" /> : <ExpandMore color="action" />}
                      </Paper>

                      <ListItemButton
                        onClick={() => handleMonthClick(item.year, item.month)}
                        sx={{ display: { xs: 'none', md: 'flex' }, pl: 3, minHeight: 40, py: 0.5 }}
                      >
                        <CalendarMonth sx={{ mr: 1.5, fontSize: 18, color: 'text.secondary' }} />
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
                          <Box>
                            {plans.map((plan: MealPlanWithTemplate) => (
                              <React.Fragment key={plan._id}>
                                {/* Plan row — card on mobile, list item on desktop */}
                                <Paper
                                  onClick={() => onPlanSelect(plan)}
                                  elevation={0}
                                  sx={{
                                    ...mobileCardSx,
                                    ml: { xs: 4, md: 0 },
                                    mr: { xs: 0, md: 0 },
                                    display: { xs: 'flex', md: 'none' },
                                    alignItems: 'center',
                                    gap: 1,
                                  }}
                                >
                                  <CalendarMonth sx={{ fontSize: 24, color: 'text.secondary' }} />
                                  <Typography variant="h6" sx={{ fontWeight: 'medium' }}>
                                    {plan.name}
                                  </Typography>
                                </Paper>

                                <ListItemButton
                                  onClick={() => onPlanSelect(plan)}
                                  sx={{ display: { xs: 'none', md: 'flex' }, pl: 6, minHeight: 40, py: 0.5 }}
                                >
                                  <ListItemText primary={plan.name} />
                                </ListItemButton>
                              </React.Fragment>
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

MealPlanBrowser.displayName = 'MealPlanBrowser';
export default MealPlanBrowser;
