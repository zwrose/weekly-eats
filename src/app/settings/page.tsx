"use client";

import { useSession } from "next-auth/react";
import { redirect } from "next/navigation";
import { useState, useEffect } from "react";
import { 
  Container, 
  Typography, 
  Box, 
  CircularProgress, 
  Paper,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  SelectChangeEvent,
  Alert,
  Snackbar
} from "@mui/material";
import AuthenticatedLayout from "../../components/AuthenticatedLayout";
import { ThemeMode, UserSettings, DEFAULT_USER_SETTINGS } from "../../lib/user-settings";
import { fetchMealPlanOwners, SharedUser } from "../../lib/meal-plan-sharing-utils";

export default function SettingsPage() {
  const { data: session, status } = useSession();
  const [settings, setSettings] = useState<UserSettings>(DEFAULT_USER_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [mealPlanOwners, setMealPlanOwners] = useState<SharedUser[]>([]);
  
  const currentUserId = (session?.user as { id?: string })?.id;

  useEffect(() => {
    if (session?.user?.email) {
      loadUserSettings();
      loadMealPlanOwners();
    }
  }, [session?.user?.email]);

  const loadUserSettings = async () => {
    try {
      const response = await fetch('/api/user/settings');
      if (response.ok) {
        const data = await response.json();
        setSettings(data.settings || DEFAULT_USER_SETTINGS);
      }
    } catch (error) {
      console.error('Failed to load settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadMealPlanOwners = async () => {
    try {
      const owners = await fetchMealPlanOwners();
      setMealPlanOwners(owners);
    } catch (error) {
      console.error('Failed to load meal plan owners:', error);
    }
  };

  const saveUserSettings = async (newSettings: UserSettings) => {
    setSaving(true);
    try {
      const response = await fetch('/api/user/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ settings: newSettings }),
      });

      if (response.ok) {
        setSettings(newSettings);
        setShowSuccess(true);
        // Update the theme context
        window.dispatchEvent(new CustomEvent('themeChange', { detail: newSettings.themeMode }));
      }
    } catch (error) {
      console.error('Failed to save settings:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleThemeChange = (event: SelectChangeEvent<ThemeMode>) => {
    const newThemeMode = event.target.value as ThemeMode;
    const newSettings = { ...settings, themeMode: newThemeMode };
    saveUserSettings(newSettings);
  };

  const handleDefaultOwnerChange = (event: SelectChangeEvent<string>) => {
    const newDefaultOwner = event.target.value;
    const newSettings = { 
      ...settings, 
      defaultMealPlanOwner: newDefaultOwner === currentUserId ? undefined : newDefaultOwner 
    };
    saveUserSettings(newSettings);
  };

  // Show loading state while session is being fetched
  if (status === "loading") {
    return (
      <AuthenticatedLayout>
        <Container maxWidth="xl" sx={{ py: 4 }}>
          <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
            <CircularProgress />
          </Box>
        </Container>
      </AuthenticatedLayout>
    );
  }

  // Only redirect if session is definitely not available
  if (status === "unauthenticated") {
    redirect("/");
  }

  if (loading) {
    return (
      <AuthenticatedLayout>
        <Container maxWidth="xl" sx={{ py: 4 }}>
          <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
            <CircularProgress />
          </Box>
        </Container>
      </AuthenticatedLayout>
    );
  }

  return (
    <AuthenticatedLayout>
      <Container maxWidth="xl" sx={{ py: 4 }}>
        <Paper
          elevation={2}
          sx={{
            p: 6,
            borderRadius: 3,
            bgcolor: "background.paper",
          }}
        >
          <Typography variant="h4" component="h1" color="primary.main" gutterBottom>
            User Settings
          </Typography>
          
          <Box sx={{ mt: 4, display: "flex", flexDirection: "column", gap: 4 }}>
            <Box>
              <Typography variant="h6" color="text.primary" gutterBottom sx={{ mb: 2 }}>
                Appearance
              </Typography>
              <FormControl fullWidth>
                <InputLabel id="theme-select-label">Theme</InputLabel>
                <Select
                  labelId="theme-select-label"
                  id="theme-select"
                  value={settings.themeMode}
                  label="Theme"
                  onChange={handleThemeChange}
                  disabled={saving}
                >
                  <MenuItem value="light">Light Mode</MenuItem>
                  <MenuItem value="dark">Dark Mode</MenuItem>
                  <MenuItem value="system">System Default</MenuItem>
                </Select>
              </FormControl>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                Choose your preferred theme. System Default will follow your operating system&apos;s theme setting.
              </Typography>
            </Box>

            {mealPlanOwners.length > 0 && (
              <Box>
                <Typography variant="h6" color="text.primary" gutterBottom sx={{ mb: 2 }}>
                  Meal Plans
                </Typography>
                <FormControl fullWidth>
                  <InputLabel id="default-owner-label">Default Owner for New Meal Plans</InputLabel>
                  <Select
                    labelId="default-owner-label"
                    id="default-owner-select"
                    value={settings.defaultMealPlanOwner || currentUserId || ''}
                    label="Default Owner for New Meal Plans"
                    onChange={handleDefaultOwnerChange}
                    disabled={saving}
                  >
                    <MenuItem value={currentUserId || ''}>Your Meal Plans</MenuItem>
                    {mealPlanOwners.map((owner) => (
                      <MenuItem key={owner.userId} value={owner.userId}>
                        {owner.name || owner.email}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                  Set the default owner when creating new meal plans. This determines which &quot;Create For&quot; option is pre-selected.
                </Typography>
              </Box>
            )}
          </Box>
        </Paper>
      </Container>

      <Snackbar
        open={showSuccess}
        autoHideDuration={3000}
        onClose={() => setShowSuccess(false)}
      >
        <Alert onClose={() => setShowSuccess(false)} severity="success">
          Settings saved successfully!
        </Alert>
      </Snackbar>
    </AuthenticatedLayout>
  );
} 