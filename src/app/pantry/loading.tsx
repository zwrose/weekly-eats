import { Container, Box, Skeleton } from '@mui/material';
import AuthenticatedLayout from '@/components/AuthenticatedLayout';

export default function PantryLoading() {
  const widths = [60, 45, 70, 55, 65];

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
            <Skeleton variant="text" width={160} height={28} />
            <Skeleton variant="rounded" width={90} height={32} />
          </Box>

          {/* Search bar */}
          <Box sx={{ maxWidth: 'md', mx: 'auto' }}>
            <Skeleton variant="rounded" height={36} sx={{ mb: 2 }} />

            {/* Flat row skeletons */}
            {widths.map((w, i) => (
              <Box
                key={i}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  minHeight: 40,
                  px: 1.5,
                  py: 1,
                  borderBottom: '1px solid',
                  borderBottomColor: 'divider',
                }}
              >
                {/* Name */}
                <Skeleton variant="text" width={`${w}%`} height={20} sx={{ flex: '1 1 auto' }} />

                {/* Delete icon */}
                <Skeleton variant="circular" width={24} height={24} sx={{ flexShrink: 0, ml: 1 }} />
              </Box>
            ))}
          </Box>
        </Box>
      </Container>
    </AuthenticatedLayout>
  );
}
