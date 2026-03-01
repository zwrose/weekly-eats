import { Container, Box, Skeleton } from '@mui/material';
import AuthenticatedLayout from '@/components/AuthenticatedLayout';

export default function FoodItemsLoading() {
  const widths = [65, 50, 75, 55, 60, 70, 45, 58];

  return (
    <AuthenticatedLayout>
      <Container maxWidth="xl">
        <Box sx={{ py: { xs: 0.5, md: 1 } }}>
          {/* Page title */}
          <Skeleton variant="text" width={120} height={28} sx={{ mb: { xs: 1.5, md: 2 } }} />

          {/* Search bar */}
          <Skeleton variant="rounded" height={36} sx={{ mb: 2 }} />

          {/* Item count */}
          <Skeleton variant="text" width={120} height={16} sx={{ mb: 1 }} />

          {/* Flat row skeletons */}
          {widths.map((w, i) => (
            <Box
              key={i}
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1.5,
                minHeight: 36,
                px: 1.5,
                py: 1,
                borderBottom: '1px solid',
                borderBottomColor: 'divider',
              }}
            >
              {/* Name */}
              <Skeleton variant="text" width={`${w}%`} height={20} sx={{ flex: '1 1 auto' }} />

              {/* Access level chip */}
              <Skeleton
                variant="rounded"
                width={60}
                height={18}
                sx={{ borderRadius: '9px', flexShrink: 0 }}
              />

              {/* Date */}
              <Skeleton variant="text" width={70} height={16} sx={{ flexShrink: 0 }} />
            </Box>
          ))}
        </Box>
      </Container>
    </AuthenticatedLayout>
  );
}
