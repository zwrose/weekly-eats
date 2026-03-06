import { Container, Box, Skeleton } from '@mui/material';
import AuthenticatedLayout from '@/components/AuthenticatedLayout';

export default function RecipeDetailLoading() {
  return (
    <AuthenticatedLayout>
      <Container maxWidth="lg">
        <Box sx={{ py: { xs: 1, md: 2 } }}>
          {/* Back button + title + edit button */}
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

          {/* Title area */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
            <Skeleton variant="rounded" width={40} height={40} />
            <Skeleton variant="text" width="45%" height={36} />
          </Box>

          {/* Tags skeleton */}
          <Box sx={{ display: 'flex', gap: 0.5, mb: 2 }}>
            <Skeleton variant="rounded" width={60} height={24} sx={{ borderRadius: '12px' }} />
            <Skeleton variant="rounded" width={80} height={24} sx={{ borderRadius: '12px' }} />
            <Skeleton variant="rounded" width={50} height={24} sx={{ borderRadius: '12px' }} />
          </Box>

          {/* Rating skeleton */}
          <Box sx={{ display: 'flex', gap: 0.5, mb: 3 }}>
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} variant="circular" width={24} height={24} />
            ))}
          </Box>

          {/* Access level chip */}
          <Skeleton
            variant="rounded"
            width={120}
            height={24}
            sx={{ borderRadius: '12px', mb: 3 }}
          />

          {/* Divider */}
          <Skeleton variant="rectangular" height={1} sx={{ mb: 3 }} />

          {/* Ingredients + Instructions side by side on desktop */}
          <Box
            sx={{
              display: 'flex',
              gap: 3,
              flexDirection: { xs: 'column', md: 'row' },
            }}
          >
            {/* Ingredients */}
            <Box sx={{ flex: { xs: 'none', md: '0 0 25%' } }}>
              <Skeleton variant="text" width={120} height={32} sx={{ mb: 1 }} />
              {[...Array(6)].map((_, i) => (
                <Box key={i} sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                  <Skeleton
                    variant="circular"
                    width={6}
                    height={6}
                    sx={{ mr: 1, flexShrink: 0 }}
                  />
                  <Skeleton variant="text" width={`${50 + Math.random() * 40}%`} height={20} />
                </Box>
              ))}
            </Box>

            {/* Instructions */}
            <Box sx={{ flex: { xs: 'none', md: '1 1 auto' } }}>
              <Skeleton variant="text" width={120} height={32} sx={{ mb: 1 }} />
              {[...Array(8)].map((_, i) => (
                <Skeleton
                  key={i}
                  variant="text"
                  width={`${60 + Math.random() * 35}%`}
                  height={20}
                  sx={{ mb: 0.5 }}
                />
              ))}
            </Box>
          </Box>
        </Box>
      </Container>
    </AuthenticatedLayout>
  );
}
