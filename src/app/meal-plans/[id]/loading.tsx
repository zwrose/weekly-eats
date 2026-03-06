import { Container, Box, Skeleton } from '@mui/material';
import AuthenticatedLayout from '@/components/AuthenticatedLayout';

export default function MealPlanDetailLoading() {
  return (
    <AuthenticatedLayout>
      <Container maxWidth="lg">
        <Box sx={{ py: { xs: 1, md: 2 } }}>
          {/* Back button + edit button */}
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              mb: 2,
            }}
          >
            <Skeleton variant="rounded" width={100} height={28} />
            <Box sx={{ flex: 1 }} />
            <Skeleton variant="rounded" width={32} height={32} />
          </Box>

          {/* Title */}
          <Skeleton variant="text" width="50%" height={36} sx={{ mb: 2 }} />

          {/* Collapsible sections (weekly staples + day meals) */}
          {[0, 1, 2, 3, 4, 5, 6].map((i) => {
            const headerWidths = [120, '35%', '40%', '30%', '45%', '38%', '33%'];
            return (
              <Box
                key={i}
                sx={{
                  borderBottom: '1px solid',
                  borderBottomColor: 'divider',
                  mb: 0,
                }}
              >
                {/* Section header */}
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    px: 1.5,
                    py: 1,
                    gap: 0.75,
                  }}
                >
                  <Skeleton variant="circular" width={18} height={18} />
                  <Skeleton
                    variant="text"
                    width={headerWidths[i]}
                    height={24}
                  />
                </Box>

                {/* Expanded content for first 2 */}
                {i < 2 && (
                  <Box sx={{ px: 2, pb: 2 }}>
                    {[60, 75, 45].map((width, j) => (
                      <Box key={j} sx={{ display: 'flex', alignItems: 'center', mb: 0.5 }}>
                        <Skeleton
                          variant="circular"
                          width={6}
                          height={6}
                          sx={{ mr: 1, flexShrink: 0 }}
                        />
                        <Skeleton
                          variant="text"
                          width={`${width}%`}
                          height={18}
                        />
                      </Box>
                    ))}
                  </Box>
                )}
              </Box>
            );
          })}
        </Box>
      </Container>
    </AuthenticatedLayout>
  );
}
