"use client";

import {
  Container,
  Typography,
  Box,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  CircularProgress,
  Alert,
  Paper,
  TextField,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Pagination,
} from "@mui/material";
import { Add, CalendarMonth, Settings } from "@mui/icons-material";
import { useSession } from "next-auth/react";
import { useState, useCallback, useEffect } from "react";
import AuthenticatedLayout from "../../components/AuthenticatedLayout";
import { 
  MealPlanWithTemplate, 
  MealPlanTemplate, 
  CreateMealPlanRequest,
  DayOfWeek,
  MealType
} from "../../types/meal-plan";
import { 
  fetchMealPlans, 
  createMealPlan, 
  deleteMealPlan,
  fetchMealPlanTemplate,
  updateMealPlanTemplate
} from "../../lib/meal-plan-utils";
import { DatePicker, LocalizationProvider } from '@mui/x-date-pickers';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { 
  dayOfWeekToIndex, 
  getNextDayOfWeek, 
  formatDateForAPI 
} from "../../lib/date-utils";

export default function MealPlansPage() {
  const { status } = useSession();
  const [loading, setLoading] = useState(true);
  const [mealPlans, setMealPlans] = useState<MealPlanWithTemplate[]>([]);
  const [template, setTemplate] = useState<MealPlanTemplate | null>(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [selectedMealPlan, setSelectedMealPlan] = useState<MealPlanWithTemplate | null>(null);
  
  // Create meal plan form state
  const [newMealPlan, setNewMealPlan] = useState<CreateMealPlanRequest>({
    startDate: ''
  });

  // Template form state
  const [templateForm, setTemplateForm] = useState<{
    startDay: DayOfWeek;
    meals: {
      [key in MealType]: boolean;
    };
  }>({
    startDay: 'saturday',
    meals: {
      breakfast: true,
      lunch: true,
      dinner: true
    }
  });

  // Search and pagination
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(1);
  const itemsPerPage = 10;

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [plans, userTemplate] = await Promise.all([
        fetchMealPlans(),
        fetchMealPlanTemplate()
      ]);
      setMealPlans(plans);
      setTemplate(userTemplate);
      
      // Initialize template form with current template values
      if (userTemplate) {
        setTemplateForm({
          startDay: userTemplate.startDay,
          meals: {
            breakfast: userTemplate.meals.breakfast ?? true,
            lunch: userTemplate.meals.lunch ?? true,
            dinner: userTemplate.meals.dinner ?? true
          }
        });
      }
    } catch (error) {
      console.error('Error loading meal plans:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (status === 'authenticated') {
      loadData();
    }
  }, [status, loadData]);

  // Open create dialog and set default start date
  const handleOpenCreateDialog = () => {
    if (template) {
      const today = new Date();
      const dayIndex = dayOfWeekToIndex(template.startDay);
      const nextStart = getNextDayOfWeek(today, dayIndex);
      
      // Format date as YYYY-MM-DD in local timezone
      const formattedDate = formatDateForAPI(nextStart);
      
      setNewMealPlan({ startDate: formattedDate });
    } else {
      setNewMealPlan({ startDate: '' });
    }
    setCreateDialogOpen(true);
  };

  const handleCreateMealPlan = async () => {
    try {
      await createMealPlan(newMealPlan);
      setCreateDialogOpen(false);
      setNewMealPlan({ startDate: '' });
      loadData();
    } catch (error) {
      console.error('Error creating meal plan:', error);
      alert('Failed to create meal plan');
    }
  };

  const handleUpdateTemplate = async () => {
    try {
      await updateMealPlanTemplate(templateForm);
      setTemplateDialogOpen(false);
      loadData();
    } catch (error) {
      console.error('Error updating template:', error);
      alert('Failed to update template');
    }
  };

  const handleDeleteMealPlan = async () => {
    if (!selectedMealPlan?._id) return;
    
    try {
      await deleteMealPlan(selectedMealPlan._id);
      setDeleteConfirmOpen(false);
      setSelectedMealPlan(null);
      loadData();
    } catch (error) {
      console.error('Error deleting meal plan:', error);
      alert('Failed to delete meal plan');
    }
  };

  // Handle edit meal plan (placeholder for now)
  const handleEditMealPlan = (mealPlan: MealPlanWithTemplate) => {
    // TODO: Implement edit functionality
    console.log('Edit meal plan:', mealPlan);
  };

  // Filter meal plans based on search term
  const filteredMealPlans = mealPlans.filter(mealPlan =>
    mealPlan.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Paginate meal plans
  const paginatedMealPlans = filteredMealPlans.slice(
    (page - 1) * itemsPerPage,
    page * itemsPerPage
  );

  // Show loading state while session is being fetched
  if (status === "loading") {
    return (
      <AuthenticatedLayout>
        <Container maxWidth="md">
          <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
            <CircularProgress />
          </Box>
        </Container>
      </AuthenticatedLayout>
    );
  }

  // Only redirect if session is definitely not available
  if (status === "unauthenticated") {
    return null; // Will be handled by AuthenticatedLayout
  }

  return (
    <AuthenticatedLayout>
      <Container maxWidth="xl">
        <Box sx={{ py: { xs: 2, md: 4 } }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 2, mb: { xs: 2, md: 4 } }}>
            <CalendarMonth sx={{ fontSize: 40, color: "#1976d2" }} />
            <Typography variant="h3" component="h1" sx={{ color: "#1976d2" }}>
              Meal Plans
            </Typography>
          </Box>

          <Box sx={{ 
            display: "flex", 
            flexDirection: { xs: 'column', sm: 'row' },
            justifyContent: "space-between", 
            alignItems: { xs: 'flex-start', sm: 'center' }, 
            gap: { xs: 2, sm: 0 },
            mb: { xs: 2, md: 4 } 
          }}>
            <Typography variant="h5" gutterBottom>
              Your Meal Plans
            </Typography>
            <Box sx={{ display: 'flex', gap: 2 }}>
              <Button 
                variant="outlined"
                startIcon={<Settings />}
                onClick={() => setTemplateDialogOpen(true)}
                sx={{ borderColor: "#1976d2", color: "#1976d2", "&:hover": { borderColor: "#1565c0" } }}
              >
                Template Settings
              </Button>
              <Button 
                variant="contained" 
                startIcon={<Add />}
                onClick={handleOpenCreateDialog}
                sx={{ bgcolor: "#1976d2", "&:hover": { bgcolor: "#1565c0" } }}
              >
                Create Meal Plan
              </Button>
            </Box>
          </Box>

          <Paper sx={{ p: 3, mb: 4, maxWidth: 'md', mx: 'auto' }}>
            {/* Search Bar */}
            <Box sx={{ mb: 4 }}>
              <TextField
                fullWidth
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Start typing to filter meal plans by name..."
                autoComplete="off"
              />
            </Box>

            {loading ? (
              <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
                <CircularProgress />
              </Box>
            ) : (
              <>
                {filteredMealPlans.length > 0 ? (
                  <>
                    {/* Desktop Table View */}
                    <Box sx={{ display: { xs: 'none', md: 'block' } }}>
                      <TableContainer>
                        <Table>
                          <TableHead>
                            <TableRow>
                              <TableCell sx={{ fontWeight: 'bold' }}>Meal Plan</TableCell>
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {paginatedMealPlans.map((mealPlan) => (
                              <TableRow 
                                key={mealPlan._id}
                                onClick={() => handleEditMealPlan(mealPlan)}
                                sx={{ cursor: 'pointer', '&:hover': { backgroundColor: 'action.hover' } }}
                              >
                                <TableCell>
                                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                    <CalendarMonth sx={{ fontSize: 24, color: 'text.secondary' }} />
                                    <Typography variant="body1">{mealPlan.name}</Typography>
                                  </Box>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </TableContainer>
                    </Box>

                    {/* Mobile Card View */}
                    <Box sx={{ display: { xs: 'block', md: 'none' } }}>
                      {paginatedMealPlans.map((mealPlan) => (
                        <Paper
                          key={mealPlan._id}
                          onClick={() => handleEditMealPlan(mealPlan)}
                          sx={{
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
                          }}
                        >
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <CalendarMonth sx={{ fontSize: 24, color: 'text.secondary' }} />
                            <Typography variant="h6" sx={{ fontWeight: 'medium' }}>
                              {mealPlan.name}
                            </Typography>
                          </Box>
                        </Paper>
                      ))}
                    </Box>
                    
                    {filteredMealPlans.length > itemsPerPage && (
                      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
                        <Pagination
                          count={Math.ceil(filteredMealPlans.length / itemsPerPage)}
                          page={page}
                          onChange={(_, newPage) => setPage(newPage)}
                          color="primary"
                        />
                      </Box>
                    )}
                  </>
                ) : (
                  <Alert severity="info">
                    {searchTerm ? 'No meal plans match your search criteria' : 'No meal plans found. Create your first meal plan to get started!'}
                  </Alert>
                )}
              </>
            )}
          </Paper>

          {/* Create Meal Plan Dialog */}
          <Dialog 
            open={createDialogOpen} 
            onClose={() => setCreateDialogOpen(false)}
            maxWidth="sm"
            fullWidth
          >
            <DialogTitle>Create Meal Plan</DialogTitle>
            <DialogContent>
              <Box sx={{ pt: 2 }}>
                <LocalizationProvider dateAdapter={AdapterDateFns}>
                  <DatePicker
                    label="Start Date"
                    value={newMealPlan.startDate ? (() => {
                      const [year, month, day] = newMealPlan.startDate.split('-').map(Number);
                      return new Date(year, month - 1, day);
                    })() : null}
                    onChange={(date) => {
                      const formattedDate = date ? date.toISOString().slice(0, 10) : '';
                      setNewMealPlan({ startDate: formattedDate });
                    }}
                    slotProps={{
                      textField: {
                        fullWidth: true,
                        sx: { mb: 3 },
                        required: true,
                        inputProps: {
                          readOnly: true,
                          inputMode: 'none',
                        },
                      },
                    }}
                  />
                </LocalizationProvider>
                
                {template && (
                  <Box sx={{ 
                    mb: 3, 
                    p: 2, 
                    bgcolor: 'background.paper', 
                    border: '1px solid',
                    borderColor: 'divider',
                    borderRadius: 1 
                  }}>
                    <Typography variant="subtitle2" gutterBottom>
                      Using your template settings:
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      • Starts on {template.startDay.charAt(0).toUpperCase() + template.startDay.slice(1)}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      • Includes: {Object.entries(template.meals).filter(([, enabled]) => enabled).map(([meal]) => meal).join(', ')}
                    </Typography>
                  </Box>
                )}
              </Box>
              
              <Box sx={{ 
                display: 'flex',
                flexDirection: { xs: 'column', sm: 'row' },
                gap: { xs: 1, sm: 0 },
                justifyContent: { xs: 'stretch', sm: 'flex-end' }
              }}>
                <Button 
                  onClick={() => setCreateDialogOpen(false)}
                  sx={{ width: { xs: '100%', sm: 'auto' } }}
                >
                  Cancel
                </Button>
                <Button 
                  onClick={handleCreateMealPlan}
                  variant="contained"
                  disabled={!newMealPlan.startDate}
                  sx={{ width: { xs: '100%', sm: 'auto' } }}
                >
                  Create Plan
                </Button>
              </Box>
            </DialogContent>
          </Dialog>

          {/* Template Settings Dialog */}
          <Dialog 
            open={templateDialogOpen} 
            onClose={() => setTemplateDialogOpen(false)}
            maxWidth="sm"
            fullWidth
          >
            <DialogTitle>Template Settings</DialogTitle>
            <DialogContent>
              <Box sx={{ pt: 2 }}>
                <FormControl fullWidth sx={{ mb: 3 }}>
                  <InputLabel>Start Day</InputLabel>
                  <Select
                    value={templateForm.startDay}
                    label="Start Day"
                    onChange={(e) => setTemplateForm({ ...templateForm, startDay: e.target.value as DayOfWeek })}
                  >
                    <MenuItem value="monday">Monday</MenuItem>
                    <MenuItem value="tuesday">Tuesday</MenuItem>
                    <MenuItem value="wednesday">Wednesday</MenuItem>
                    <MenuItem value="thursday">Thursday</MenuItem>
                    <MenuItem value="friday">Friday</MenuItem>
                    <MenuItem value="saturday">Saturday</MenuItem>
                    <MenuItem value="sunday">Sunday</MenuItem>
                  </Select>
                </FormControl>
                
                <Typography variant="subtitle2" gutterBottom>
                  Meals to Include:
                </Typography>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mb: 3 }}>
                  {(['breakfast', 'lunch', 'dinner'] as MealType[]).map((meal) => (
                    <Box key={meal} sx={{ display: 'flex', alignItems: 'center' }}>
                      <input
                        type="checkbox"
                        id={meal}
                        checked={templateForm.meals?.[meal] || false}
                        onChange={(e) => setTemplateForm({
                          ...templateForm,
                          meals: { ...templateForm.meals, [meal]: e.target.checked }
                        })}
                      />
                      <label htmlFor={meal} style={{ marginLeft: 8, textTransform: 'capitalize' }}>
                        {meal}
                      </label>
                    </Box>
                  ))}
                </Box>
              </Box>
              
              <Box sx={{ 
                display: 'flex',
                flexDirection: { xs: 'column', sm: 'row' },
                gap: { xs: 1, sm: 0 },
                justifyContent: { xs: 'stretch', sm: 'flex-end' }
              }}>
                <Button 
                  onClick={() => setTemplateDialogOpen(false)}
                  sx={{ width: { xs: '100%', sm: 'auto' } }}
                >
                  Cancel
                </Button>
                <Button 
                  onClick={handleUpdateTemplate}
                  variant="contained"
                  sx={{ width: { xs: '100%', sm: 'auto' } }}
                >
                  Save Settings
                </Button>
              </Box>
            </DialogContent>
          </Dialog>

          {/* Delete Confirmation Dialog */}
          <Dialog
            open={deleteConfirmOpen}
            onClose={() => setDeleteConfirmOpen(false)}
          >
            <DialogTitle>Delete Meal Plan</DialogTitle>
            <DialogContent>
              <Typography>
                Are you sure you want to delete &quot;{selectedMealPlan?.name}&quot;? This action cannot be undone.
              </Typography>
              
              <Box sx={{ 
                display: 'flex',
                flexDirection: { xs: 'column', sm: 'row' },
                gap: { xs: 1, sm: 0 },
                mt: 3,
                pt: 2,
                justifyContent: { xs: 'stretch', sm: 'flex-end' }
              }}>
                <Button 
                  onClick={() => setDeleteConfirmOpen(false)}
                  sx={{ width: { xs: '100%', sm: 'auto' } }}
                >
                  Cancel
                </Button>
                <Button 
                  onClick={handleDeleteMealPlan} 
                  color="error" 
                  variant="contained"
                  sx={{ width: { xs: '100%', sm: 'auto' } }}
                >
                  Delete
                </Button>
              </Box>
            </DialogContent>
          </Dialog>
        </Box>
      </Container>
    </AuthenticatedLayout>
  );
} 