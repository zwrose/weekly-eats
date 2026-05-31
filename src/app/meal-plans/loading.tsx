import { Container, Box, Skeleton } from '@mui/material';
import { tokens } from '@/lib/design-tokens';
import AuthenticatedLayout from '@/components/AuthenticatedLayout';

export default function MealPlansLoading() {
  return (
    <AuthenticatedLayout>
      <Container maxWidth="md">
        <Box sx={{ py: { xs: 1.5, md: 3 } }}>
          {/* Header row: title + icon buttons + "New plan" button */}
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 1.5,
              mb: { xs: 2.5, md: 3.5 },
            }}
          >
            <Skeleton
              variant="text"
              width={160}
              height={42}
              sx={{ bgcolor: tokens.surface.elevated }}
            />
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
              <Skeleton
                variant="circular"
                width={36}
                height={36}
                sx={{ bgcolor: tokens.surface.elevated }}
              />
              <Skeleton
                variant="circular"
                width={36}
                height={36}
                sx={{ bgcolor: tokens.surface.elevated }}
              />
              <Skeleton
                variant="rounded"
                width={104}
                height={36}
                sx={{ bgcolor: tokens.surface.elevated }}
              />
            </Box>
          </Box>

          {/* Current section */}
          <Box sx={{ mb: 4 }}>
            <Skeleton
              variant="text"
              width={72}
              height={16}
              sx={{ mb: 1, bgcolor: tokens.surface.elevated }}
            />
            {[...Array(2)].map((_, i) => (
              <Skeleton
                key={i}
                variant="rounded"
                height={52}
                sx={{
                  mb: 1,
                  borderRadius: `${tokens.radius.lg}px`,
                  bgcolor: tokens.surface.raised,
                }}
              />
            ))}
          </Box>

          {/* Past section */}
          <Box sx={{ mb: 4 }}>
            <Skeleton
              variant="text"
              width={48}
              height={16}
              sx={{ mb: 1, bgcolor: tokens.surface.elevated }}
            />
            {[...Array(3)].map((_, i) => (
              <Skeleton
                key={i}
                variant="rounded"
                height={52}
                sx={{
                  mb: 1,
                  borderRadius: `${tokens.radius.lg}px`,
                  bgcolor: tokens.surface.raised,
                }}
              />
            ))}
          </Box>
        </Box>
      </Container>
    </AuthenticatedLayout>
  );
}
