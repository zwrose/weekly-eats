import { Container, Box, Skeleton } from '@mui/material';
import AuthenticatedLayout from '@/components/AuthenticatedLayout';

export default function MealPlansLoading() {
  return (
    <AuthenticatedLayout>
      <Container maxWidth="xl">
        <Box sx={{ py: { xs: 0.5, md: 1 } }}>
          {/* Compact page header */}
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              mb: { xs: 1.5, md: 2 },
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Skeleton variant="circular" width={28} height={28} />
              <Skeleton variant="text" width={100} height={28} />
            </Box>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Skeleton variant="rounded" width={140} height={32} />
              <Skeleton variant="rounded" width={32} height={32} />
              <Skeleton variant="rounded" width={32} height={32} />
            </Box>
          </Box>

          {/* Meal plan count */}
          <Skeleton variant="text" width={120} height={16} sx={{ mb: 1 }} />

          {/* Flat row skeletons for current meal plans */}
          {[55, 45, 60].map((width, i) => (
            <Box
              key={i}
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1,
                minHeight: 36,
                px: 1.5,
                py: 1,
                borderBottom: '1px solid',
                borderBottomColor: 'divider',
              }}
            >
              {/* Calendar icon */}
              <Skeleton variant="rounded" width={20} height={20} />

              {/* Name */}
              <Skeleton variant="text" width={`${width}%`} height={20} />
            </Box>
          ))}

          {/* History section */}
          <Box sx={{ mt: 3 }}>
            <Skeleton variant="text" width={140} height={20} sx={{ mb: 1 }} />
            <Skeleton variant="rounded" height={36} sx={{ mb: 1 }} />
            {[40, 50].map((width, i) => (
              <Box
                key={i}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1,
                  minHeight: 36,
                  px: 1.5,
                  py: 1,
                  borderBottom: '1px solid',
                  borderBottomColor: 'divider',
                }}
              >
                <Skeleton variant="rounded" width={20} height={20} />
                <Skeleton variant="text" width={`${width}%`} height={20} />
              </Box>
            ))}
          </Box>
        </Box>
      </Container>
    </AuthenticatedLayout>
  );
}
