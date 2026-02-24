import { Container, Box, Skeleton } from '@mui/material';
import AuthenticatedLayout from '@/components/AuthenticatedLayout';

export default function MealPlanSettingsLoading() {
  return (
    <AuthenticatedLayout>
      <Container maxWidth="lg">
        <Box sx={{ py: { xs: 1, md: 2 } }}>
          {/* Back button */}
          <Skeleton variant="rounded" width={100} height={28} sx={{ mb: 2 }} />

          {/* Title */}
          <Skeleton variant="text" width="40%" height={36} sx={{ mb: 3 }} />

          {/* Start Day select */}
          <Skeleton variant="rounded" width={200} height={40} sx={{ mb: 3 }} />

          {/* Meals to Include label */}
          <Skeleton variant="text" width={120} height={20} sx={{ mb: 1 }} />

          {/* Checkboxes */}
          {[130, 100, 110, 140].map((width, i) => (
            <Box key={i} sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
              <Skeleton variant="rounded" width={20} height={20} />
              <Skeleton variant="text" width={width} height={24} />
            </Box>
          ))}

          {/* Divider area */}
          <Skeleton variant="text" width="100%" height={1} sx={{ my: 3 }} />

          {/* Weekly Staples section */}
          <Skeleton variant="text" width={140} height={20} sx={{ mb: 0.5 }} />
          <Skeleton variant="text" width="60%" height={16} sx={{ mb: 2 }} />

          {/* Editor placeholder */}
          <Skeleton variant="rounded" width="100%" height={80} sx={{ mb: 3 }} />

          {/* Action buttons */}
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Skeleton variant="rounded" width={80} height={32} />
            <Skeleton variant="rounded" width={120} height={32} />
          </Box>
        </Box>
      </Container>
    </AuthenticatedLayout>
  );
}
