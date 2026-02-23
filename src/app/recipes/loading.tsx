import { Container, Box, Skeleton } from '@mui/material';
import AuthenticatedLayout from '@/components/AuthenticatedLayout';

export default function RecipesLoading() {
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
              <Skeleton variant="rounded" width={100} height={32} />
              <Skeleton variant="rounded" width={32} height={32} />
            </Box>
          </Box>

          {/* Filter bar skeleton */}
          <Skeleton variant="rounded" height={36} sx={{ mb: 2 }} />

          {/* Recipe count */}
          <Skeleton variant="text" width={100} height={16} sx={{ mb: 1 }} />

          {/* Flat row skeletons */}
          {[...Array(8)].map((_, i) => (
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
              {/* Emoji */}
              <Skeleton variant="rounded" width={24} height={24} />

              {/* Name */}
              <Skeleton variant="text" width={`${30 + Math.random() * 30}%`} height={20} />

              {/* Spacer */}
              <Box sx={{ flex: 1 }} />

              {/* Tag pills */}
              <Box sx={{ display: { xs: 'none', md: 'flex' }, gap: 0.5 }}>
                {Math.random() > 0.3 && (
                  <Skeleton
                    variant="rounded"
                    width={50}
                    height={18}
                    sx={{ borderRadius: '9px' }}
                  />
                )}
                {Math.random() > 0.5 && (
                  <Skeleton
                    variant="rounded"
                    width={40}
                    height={18}
                    sx={{ borderRadius: '9px' }}
                  />
                )}
              </Box>

              {/* Rating */}
              <Skeleton variant="text" width={30} height={16} />

              {/* Date */}
              <Skeleton variant="text" width={70} height={16} />
            </Box>
          ))}
        </Box>
      </Container>
    </AuthenticatedLayout>
  );
}
