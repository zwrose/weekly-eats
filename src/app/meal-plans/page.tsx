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
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Divider,
} from "@mui/material";
import { Add, CalendarMonth, Settings, Edit } from "@mui/icons-material";
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
  updateMealPlanTemplate,
  DEFAULT_TEMPLATE
} from "../../lib/meal-plan-utils";
import { DatePicker, LocalizationProvider } from '@mui/x-date-pickers';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { calculateEndDateAsString, parseLocalDate } from "../../lib/date-utils";
import { addDays } from 'date-fns';
import { checkMealPlanOverlap, findNextAvailableMealPlanStartDate } from "../../lib/meal-plan-utils";
import { useSearchPagination, useDialog, useConfirmDialog } from '@/lib/hooks';
import SearchBar from '@/components/optimized/SearchBar';
import Pagination from '@/components/optimized/Pagination';
import { DialogActions } from '@/components/ui/DialogActions';
import { formatDateForAPI } from '@/lib/date-utils';
import { dayOfWeekToIndex } from "../../lib/date-utils";

export default function MealPlansPage() {
  const { status } = useSession();
  const [loading, setLoading] = useState(true);
  const [mealPlans, setMealPlans] = useState<MealPlanWithTemplate[]>([]);
  const [template, setTemplate] = useState<MealPlanTemplate | null>(null);
  const createDialog = useDialog();
  const templateDialog = useDialog();
  const deleteConfirmDialog = useConfirmDialog();
  const viewDialog = useDialog();
  const editDialog = useDialog();
  const [selectedMealPlan, setSelectedMealPlan] = useState<MealPlanWithTemplate | null>(null);
  const [editMode, setEditMode] = useState(false);
  
  // Create meal plan form state
  const [newMealPlan, setNewMealPlan] = useState<CreateMealPlanRequest>({
    startDate: ''
  });

  // Validation state
  const [validationError, setValidationError] = useState<string | null>(null);

  // Template form state
  const [templateForm, setTemplateForm] = useState<{
    startDay: DayOfWeek;
    meals: {
      [key in MealType]: boolean;
    };
  }>({
    startDay: DEFAULT_TEMPLATE.startDay,
    meals: DEFAULT_TEMPLATE.meals
  });

  // Search and pagination
  const mealPlanPagination = useSearchPagination({
    data: mealPlans,
    itemsPerPage: 10,
    searchFields: ['name']
  });

  // State to track if we skipped a default due to overlap
  const [skippedDefault, setSkippedDefault] = useState<{ skipped: boolean; skippedFrom?: string; earliestAvailable: string | null } | null>(null);

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
    const startDay = template ? template.startDay : DEFAULT_TEMPLATE.startDay;
    const { startDate, skipped, skippedFrom } = findNextAvailableMealPlanStartDate(startDay, mealPlans);
    setNewMealPlan({ startDate });
    setSkippedDefault(skipped ? { skipped, skippedFrom, earliestAvailable: startDate } : null);
    createDialog.openDialog();
  };

  const handleCreateMealPlan = async () => {
    try {
      await createMealPlan(newMealPlan);
      createDialog.closeDialog();
      setNewMealPlan({ startDate: '' });
      setValidationError(null);
      loadData();
    } catch (error) {
      console.error('Error creating meal plan:', error);
      alert('Failed to create meal plan');
    }
  };

  const handleCloseCreateDialog = () => {
    createDialog.closeDialog();
    setNewMealPlan({ startDate: '' });
    setValidationError(null);
    setSkippedDefault(null);
  };

  const handleUpdateTemplate = async () => {
    try {
      await updateMealPlanTemplate(templateForm);
      templateDialog.closeDialog();
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
      deleteConfirmDialog.closeDialog();
      setSelectedMealPlan(null);
      loadData();
    } catch (error) {
      console.error('Error deleting meal plan:', error);
      alert('Failed to delete meal plan');
    }
  };

  // Handle edit meal plan (placeholder for now)
  const handleEditMealPlan = (mealPlan: MealPlanWithTemplate) => {
    setSelectedMealPlan(mealPlan);
    setEditMode(false);
    viewDialog.openDialog();
  };

  const handleEditMealPlanMode = () => {
    setEditMode(true);
    editDialog.openDialog();
  };

  const handleUpdateMealPlan = async () => {
    if (!selectedMealPlan?._id) return;
    
    try {
      // TODO: Implement update meal plan API call
      console.log('Updating meal plan:', selectedMealPlan);
      viewDialog.closeDialog();
      setSelectedMealPlan(null);
      setEditMode(false);
      loadData(); // Refresh the lists
    } catch (error) {
      console.error('Error updating meal plan:', error);
    }
  };

  const handleCloseViewDialog = () => {
    viewDialog.closeDialog();
    editDialog.closeDialog();
    setSelectedMealPlan(null);
    setEditMode(false);
  };



  // Helper function to get meal type display name
  const getMealTypeName = (mealType: string): string => {
    return mealType.charAt(0).toUpperCase() + mealType.slice(1);
  };

  // Helper function to get the date for a specific day of week in the meal plan
  const getDateForDay = (dayOfWeek: string): string => {
    const startDate = parseLocalDate(selectedMealPlan?.startDate || '');
    const targetDayIndex = dayOfWeekToIndex(dayOfWeek as DayOfWeek);
    const startDayIndex = dayOfWeekToIndex(selectedMealPlan?.template.startDay || 'saturday');
    
    // Calculate days to add to get to the target day
    let daysToAdd = targetDayIndex - startDayIndex;
    if (daysToAdd < 0) daysToAdd += 7;
    
    const targetDate = addDays(startDate, daysToAdd);
    
    return targetDate.toLocaleDateString('en-US', { 
      weekday: 'long', 
      month: 'short', 
      day: 'numeric' 
    });
  };

  // Helper function to get days in order of the meal plan
  const getDaysInOrder = (): string[] => {
    if (!selectedMealPlan) return [];
    
    const startDay = selectedMealPlan.template.startDay;
    const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
    const startIndex = days.indexOf(startDay);
    
    // Reorder days starting from the meal plan's start day
    return [...days.slice(startIndex), ...days.slice(0, startIndex)];
  };

  // Check for overlapping meal plans
  const checkForOverlaps = useCallback((startDate: string): string | null => {
    if (!startDate) return null;
    
    const overlapResult = checkMealPlanOverlap(startDate, mealPlans);
    if (overlapResult.isOverlapping && overlapResult.conflict) {
      return `This meal plan (${startDate} to ${calculateEndDateAsString(startDate)}) would overlap with "${overlapResult.conflict.planName}" (${overlapResult.conflict.startDate} to ${overlapResult.conflict.endDate})`;
    }
    
    return null;
  }, [mealPlans]);

  // Update validation when start date changes
  useEffect(() => {
    const error = checkForOverlaps(newMealPlan.startDate);
    setValidationError(error);
    
    // Recalculate if this date was skipped due to overlap
    if (newMealPlan.startDate) {
      const startDay = template ? template.startDay : DEFAULT_TEMPLATE.startDay;
      const { startDate, skippedFrom } = findNextAvailableMealPlanStartDate(startDay, mealPlans);
      
      // If the current date is not the earliest available, update the skipped info
      if (startDate !== newMealPlan.startDate) {
        setSkippedDefault({ 
          skipped: true, 
          skippedFrom: skippedFrom || newMealPlan.startDate,
          earliestAvailable: startDate
        });
      } else if (skippedFrom) {
        // If dates match but there was a skipped date, keep the skipped info
        setSkippedDefault({ 
          skipped: true, 
          skippedFrom: skippedFrom,
          earliestAvailable: startDate
        });
      } else {
        setSkippedDefault(null);
      }
    } else {
      setSkippedDefault(null);
    }
  }, [newMealPlan.startDate, checkForOverlaps, template, mealPlans]);

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
                onClick={() => templateDialog.openDialog()}
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
            <SearchBar
              value={mealPlanPagination.searchTerm}
              onChange={mealPlanPagination.setSearchTerm}
            />

            {loading ? (
              <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
                <CircularProgress />
              </Box>
            ) : (
              <>
                {mealPlans.length > 0 ? (
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
                            {mealPlanPagination.paginatedData.map((mealPlan) => (
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
                      {mealPlanPagination.paginatedData.map((mealPlan) => (
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
                    
                    {mealPlans.length > 10 && (
                      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
                        <Pagination
                          count={mealPlanPagination.totalPages}
                          page={mealPlanPagination.currentPage}
                          onChange={mealPlanPagination.setCurrentPage}
                        />
                      </Box>
                    )}
                  </>
                ) : (
                  <Alert severity="info">
                    {mealPlanPagination.searchTerm ? 'No meal plans match your search criteria' : 'No meal plans found. Create your first meal plan to get started!'}
                  </Alert>
                )}
              </>
            )}
          </Paper>

          {/* Create Meal Plan Dialog */}
          <Dialog 
            open={createDialog.open} 
            onClose={handleCloseCreateDialog}
            maxWidth="sm"
            fullWidth
          >
            <DialogTitle>Create Meal Plan</DialogTitle>
            <DialogContent>
              <Box sx={{ pt: 2 }}>
                <LocalizationProvider dateAdapter={AdapterDateFns}>
                  <DatePicker
                    label="Start Date"
                    value={newMealPlan.startDate ? parseLocalDate(newMealPlan.startDate) : null}
                    onChange={(date) => {
                      // Only set the date if it's a valid Date object
                      if (date && date instanceof Date && !isNaN(date.getTime())) {
                        const formattedDate = formatDateForAPI(date);
                        setNewMealPlan({ startDate: formattedDate });
                      } else {
                        // Clear the date if invalid
                        setNewMealPlan({ startDate: '' });
                      }
                    }}
                    slotProps={{
                      textField: {
                        fullWidth: true,
                        sx: { mb: 3 },
                        required: true,
                        error: !!validationError,
                        helperText: validationError || '',
                        inputProps: {
                          readOnly: true,
                          inputMode: 'none',
                        },
                      },
                    }}
                  />
                </LocalizationProvider>
                
                {validationError && (
                  <Alert severity="error" sx={{ mb: 3 }}>
                    {validationError}
                  </Alert>
                )}
                
                {skippedDefault?.skipped && (
                  <Alert severity="info" sx={{ mb: 2 }}>
                    The earliest available start date that does not overlap with your existing meal plans is <b>{skippedDefault.earliestAvailable}</b>.
                  </Alert>
                )}
                
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
                
                {!template && (
                  <Box sx={{ 
                    mb: 3, 
                    p: 2, 
                    bgcolor: 'background.paper', 
                    border: '1px solid',
                    borderColor: 'divider',
                    borderRadius: 1 
                  }}>
                    <Typography variant="subtitle2" gutterBottom>
                      Using default template settings:
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      • Starts on {DEFAULT_TEMPLATE.startDay.charAt(0).toUpperCase() + DEFAULT_TEMPLATE.startDay.slice(1)}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      • Includes: {Object.entries(DEFAULT_TEMPLATE.meals).filter(([, enabled]) => enabled).map(([meal]) => meal).join(', ')}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 1, fontStyle: 'italic' }}>
                      You can customize these defaults in Template Settings
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
                  onClick={handleCloseCreateDialog}
                  sx={{ width: { xs: '100%', sm: 'auto' } }}
                >
                  Cancel
                </Button>
                <Button 
                  onClick={handleCreateMealPlan}
                  variant="contained"
                  disabled={!newMealPlan.startDate || !!validationError}
                  sx={{ width: { xs: '100%', sm: 'auto' } }}
                >
                  Create Plan
                </Button>
              </Box>
            </DialogContent>
          </Dialog>

          {/* Template Settings Dialog */}
          <Dialog 
            open={templateDialog.open} 
            onClose={templateDialog.closeDialog}
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
                  onClick={templateDialog.closeDialog}
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

          {/* View/Edit Meal Plan Dialog */}
          <Dialog 
            open={viewDialog.open} 
            onClose={handleCloseViewDialog}
            maxWidth="lg"
            fullWidth
          >
            <DialogTitle>
              {selectedMealPlan?.name || 'This Meal Plan'}
            </DialogTitle>
            <DialogContent>
              {selectedMealPlan && (
                <Box sx={{ mt: 2 }}>
                  {editMode ? (
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      <TextField
                        label="Meal Plan Name"
                        value={selectedMealPlan.name || ''}
                        onChange={(e) => setSelectedMealPlan({ ...selectedMealPlan, name: e.target.value })}
                        fullWidth
                      />
                      {/* TODO: Add meal plan items editing interface */}
                      <Typography variant="body2" color="text.secondary">
                        Meal plan items editing will be implemented in the next iteration.
                      </Typography>
                    </Box>
                  ) : (
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      {/* <Box>
                        <Typography variant="h6" gutterBottom>{selectedMealPlan.name}</Typography>
                      </Box> */}
                      <Divider />
                      
                      {/* Show meals by day */}
                      {getDaysInOrder().map((dayOfWeek) => {
                        const dayItems = selectedMealPlan.items.filter(item => item.dayOfWeek === dayOfWeek);
                        
                        return (
                          <Box key={dayOfWeek} sx={{ mb: 3 }}>
                            <Typography variant="h6" sx={{ mb: 2, color: 'primary.main' }}>
                              {getDateForDay(dayOfWeek)}
                            </Typography>
                            
                            <Box sx={{ pl: 2 }}>
                              {(['breakfast', 'lunch', 'dinner'] as MealType[]).map((mealType) => {
                                const isMealIncluded = selectedMealPlan.template.meals[mealType];
                                const mealItems = dayItems.filter(item => item.mealType === mealType);
                                
                                return (
                                  <Box key={mealType} sx={{ mb: 2 }}>
                                    <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
                                      {getMealTypeName(mealType)}
                                    </Typography>
                                    {isMealIncluded ? (
                                      mealItems.length > 0 ? (
                                        <Box sx={{ pl: 2 }}>
                                          {mealItems.map((item, index) => (
                                            <Box key={index}>
                                              {item.items.map((mealItem, mealIndex) => (
                                                <Typography key={mealIndex} variant="body2" sx={{ mb: 0.5 }}>
                                                  • {mealItem.name}
                                                  {mealItem.quantity && mealItem.unit && (
                                                    <span style={{ color: 'text.secondary' }}>
                                                      {' '}({mealItem.quantity} {mealItem.unit})
                                                    </span>
                                                  )}
                                                </Typography>
                                              ))}
                                              {item.notes && (
                                                <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic', ml: 2 }}>
                                                  Note: {item.notes}
                                                </Typography>
                                              )}
                                            </Box>
                                          ))}
                                        </Box>
                                      ) : (
                                        <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic', pl: 2 }}>
                                          No items planned yet
                                        </Typography>
                                      )
                                    ) : (
                                      <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic', pl: 2 }}>
                                        Not included in this meal plan
                                      </Typography>
                                    )}
                                  </Box>
                                );
                              })}
                            </Box>
                          </Box>
                        );
                      })}
                    </Box>
                  )}
                </Box>
              )}
              
              <DialogActions>
                {editMode ? (
                  <>
                    <Button 
                      onClick={() => {
                        setEditMode(false);
                        editDialog.closeDialog();
                      }}
                      sx={{ width: { xs: '100%', sm: 'auto' } }}
                    >
                      Cancel
                    </Button>
                    <Button 
                      onClick={handleUpdateMealPlan} 
                      variant="contained"
                      sx={{ width: { xs: '100%', sm: 'auto' } }}
                    >
                      Save
                    </Button>
                  </>
                ) : (
                  <>
                    <Button 
                      onClick={handleCloseViewDialog}
                      sx={{ width: { xs: '100%', sm: 'auto' } }}
                    >
                      Close
                    </Button>
                    <Button 
                      onClick={handleEditMealPlanMode} 
                      startIcon={<Edit />}
                      sx={{ width: { xs: '100%', sm: 'auto' } }}
                    >
                      Edit
                    </Button>
                  </>
                )}
              </DialogActions>
            </DialogContent>
          </Dialog>

          {/* Delete Confirmation Dialog */}
          <Dialog
            open={deleteConfirmDialog.open}
            onClose={deleteConfirmDialog.closeDialog}
          >
            <DialogTitle>Delete Meal Plan</DialogTitle>
            <DialogContent>
              <Typography>
                Are you sure you want to delete &quot;{selectedMealPlan?.name}&quot;? This action cannot be undone.
              </Typography>
              
              <DialogActions>
                <Button 
                  onClick={deleteConfirmDialog.closeDialog}
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
              </DialogActions>
            </DialogContent>
          </Dialog>
        </Box>
      </Container>
    </AuthenticatedLayout>
  );
} 