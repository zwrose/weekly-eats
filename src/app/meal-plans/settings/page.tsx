'use client';

import { useSession } from 'next-auth/react';
import { useState, useEffect, useCallback, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import {
  Container,
  Box,
  Typography,
  Button,
  MenuItem,
  Divider,
  Checkbox,
  FormControlLabel,
  Skeleton,
  Snackbar,
  Alert,
} from '@mui/material';
import { ArrowBack } from '@mui/icons-material';
import dynamic from 'next/dynamic';
import AuthenticatedLayout from '@/components/AuthenticatedLayout';
import { DayOfWeek, MealType, MealItem } from '@/types/meal-plan';
import {
  fetchMealPlanTemplate,
  updateMealPlanTemplate,
  DEFAULT_TEMPLATE,
} from '@/lib/meal-plan-utils';
import { CompactSelect } from '@/components/ui';

const MealEditor = dynamic(() => import('@/components/MealEditor'), { ssr: false });

const DAYS_OF_WEEK: DayOfWeek[] = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

function isDayOfWeek(value: string): value is DayOfWeek {
  return (DAYS_OF_WEEK as string[]).includes(value);
}

function MealPlanSettingsContent() {
  const { status } = useSession();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [templateForm, setTemplateForm] = useState<{
    startDay: DayOfWeek;
    meals: { [key in MealType]: boolean };
    weeklyStaples: MealItem[];
  }>({
    startDay: DEFAULT_TEMPLATE.startDay,
    meals: {
      ...DEFAULT_TEMPLATE.meals,
      staples: false,
    },
    weeklyStaples: [],
  });

  // Snackbar
  const [snackbar, setSnackbar] = useState<{
    open: boolean;
    message: string;
    severity: 'success' | 'error';
  }>({
    open: false,
    message: '',
    severity: 'success',
  });

  const showSnackbar = (message: string, severity: 'success' | 'error') => {
    setSnackbar({ open: true, message, severity });
  };

  const loadTemplate = useCallback(async () => {
    try {
      setLoading(true);
      const userTemplate = await fetchMealPlanTemplate();
      if (userTemplate) {
        setTemplateForm({
          startDay: userTemplate.startDay,
          meals: {
            breakfast: userTemplate.meals.breakfast ?? true,
            lunch: userTemplate.meals.lunch ?? true,
            dinner: userTemplate.meals.dinner ?? true,
            staples: false,
          },
          weeklyStaples: userTemplate.weeklyStaples || [],
        });
      }
    } catch (err) {
      console.error('Error loading template:', err);
      showSnackbar('Failed to load template settings', 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (status === 'authenticated') {
      loadTemplate();
    }
  }, [status, loadTemplate]);

  const handleSave = async () => {
    try {
      await updateMealPlanTemplate(templateForm);
      showSnackbar('Settings saved successfully', 'success');
      // Navigate back after short delay
      setTimeout(() => router.push('/meal-plans'), 500);
    } catch (err) {
      console.error('Error updating template:', err);
      showSnackbar('Failed to save settings', 'error');
    }
  };

  if (status === 'loading' || loading) {
    return (
      <AuthenticatedLayout>
        <Container maxWidth="lg">
          <Box sx={{ py: { xs: 1, md: 2 } }}>
            <Skeleton variant="rounded" width={100} height={28} sx={{ mb: 2 }} />
            <Skeleton variant="text" width="40%" height={36} sx={{ mb: 3 }} />
            <Skeleton variant="rounded" width={200} height={40} sx={{ mb: 3 }} />
            <Skeleton variant="text" width={120} height={20} sx={{ mb: 1 }} />
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} variant="text" width={140} height={28} sx={{ mb: 0.5 }} />
            ))}
          </Box>
        </Container>
      </AuthenticatedLayout>
    );
  }

  if (status === 'unauthenticated') {
    return null;
  }

  return (
    <AuthenticatedLayout>
      <Container maxWidth="lg">
        <Box sx={{ py: { xs: 1, md: 2 } }}>
          {/* Page header */}
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              mb: 2,
            }}
          >
            <Button
              startIcon={<ArrowBack />}
              onClick={() => router.push('/meal-plans')}
              size="small"
              sx={{ color: 'text.secondary' }}
            >
              Meal Plans
            </Button>
          </Box>

          <Typography variant="h5" sx={{ mb: 3 }}>
            Template Settings
          </Typography>

          {/* Start Day */}
          <Box sx={{ mb: 3, maxWidth: 300 }}>
            <CompactSelect
              label="Start Day"
              value={templateForm.startDay}
              onChange={(e) => {
                const value = e.target.value;
                if (isDayOfWeek(value)) {
                  setTemplateForm({
                    ...templateForm,
                    startDay: value,
                  });
                }
              }}
            >
              <MenuItem value="monday">Monday</MenuItem>
              <MenuItem value="tuesday">Tuesday</MenuItem>
              <MenuItem value="wednesday">Wednesday</MenuItem>
              <MenuItem value="thursday">Thursday</MenuItem>
              <MenuItem value="friday">Friday</MenuItem>
              <MenuItem value="saturday">Saturday</MenuItem>
              <MenuItem value="sunday">Sunday</MenuItem>
            </CompactSelect>
          </Box>

          {/* Meals to Include */}
          <Typography variant="subtitle2" sx={{ mb: 1 }}>
            Meals to Include:
          </Typography>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, mb: 3 }}>
            {(['breakfast', 'lunch', 'dinner', 'staples'] as MealType[]).map((meal) => (
              <FormControlLabel
                key={meal}
                control={
                  <Checkbox
                    size="small"
                    checked={templateForm.meals?.[meal] || false}
                    onChange={(e) =>
                      setTemplateForm({
                        ...templateForm,
                        meals: { ...templateForm.meals, [meal]: e.target.checked },
                      })
                    }
                  />
                }
                label={meal === 'staples' ? 'Weekly Staples' : meal.charAt(0).toUpperCase() + meal.slice(1)}
              />
            ))}
          </Box>

          {/* Weekly Staples - only shown when staples checkbox is checked */}
          {templateForm.meals.staples && (
            <>
              <Divider sx={{ my: 3 }} />

              <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
                Weekly Staples:
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                These items will be automatically added once to new meal plans.
              </Typography>

              <MealEditor
                mealItems={templateForm.weeklyStaples}
                onChange={(newStaples) => {
                  setTemplateForm({ ...templateForm, weeklyStaples: newStaples });
                }}
              />
            </>
          )}

          {/* Action buttons */}
          <Box
            sx={{
              display: 'flex',
              gap: 1,
              mt: 3,
              flexDirection: { xs: 'column', sm: 'row' },
            }}
          >
            <Button
              onClick={() => router.push('/meal-plans')}
              size="small"
              sx={{ width: { xs: '100%', sm: 'auto' } }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              variant="contained"
              size="small"
              sx={{ width: { xs: '100%', sm: 'auto' } }}
            >
              Save Settings
            </Button>
          </Box>
        </Box>

        {/* Snackbar */}
        <Snackbar
          open={snackbar.open}
          autoHideDuration={6000}
          onClose={() => setSnackbar({ ...snackbar, open: false })}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        >
          <Alert
            onClose={() => setSnackbar({ ...snackbar, open: false })}
            severity={snackbar.severity}
            sx={{ width: '100%' }}
          >
            {snackbar.message}
          </Alert>
        </Snackbar>
      </Container>
    </AuthenticatedLayout>
  );
}

export default function MealPlanSettingsPage() {
  return (
    <Suspense
      fallback={
        <AuthenticatedLayout>
          <Container maxWidth="lg">
            <Box sx={{ py: { xs: 1, md: 2 } }}>
              <Skeleton variant="rounded" width={100} height={28} sx={{ mb: 2 }} />
              <Skeleton variant="text" width="40%" height={36} sx={{ mb: 3 }} />
              <Skeleton variant="rounded" width={200} height={40} sx={{ mb: 3 }} />
              <Skeleton variant="text" width={120} height={20} sx={{ mb: 1 }} />
              {[0, 1, 2, 3].map((i) => (
                <Skeleton key={i} variant="text" width={140} height={28} sx={{ mb: 0.5 }} />
              ))}
            </Box>
          </Container>
        </AuthenticatedLayout>
      }
    >
      <MealPlanSettingsContent />
    </Suspense>
  );
}
