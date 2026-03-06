import { Container, Box, Skeleton } from '@mui/material';
import AuthenticatedLayout from '@/components/AuthenticatedLayout';

export default function ShoppingListsLoading() {
  const widths = [55, 65, 50, 70];

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
              <Skeleton variant="text" width={140} height={28} />
            </Box>
            <Skeleton variant="rounded" width={100} height={32} />
          </Box>

          {/* Search + content */}
          <Box sx={{ maxWidth: 'md', mx: 'auto' }}>
            <Skeleton variant="rounded" height={36} sx={{ mb: 2 }} />

            {/* Flat row skeletons matching store list layout */}
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
                {/* Emoji */}
                <Skeleton variant="text" width={24} height={24} sx={{ mr: 1, flexShrink: 0 }} />

                {/* Store name */}
                <Skeleton variant="text" width={`${w}%`} height={20} sx={{ flex: '1 1 auto' }} />

                {/* Item count */}
                <Skeleton variant="text" width={30} height={16} sx={{ flexShrink: 0, ml: 1 }} />

                {/* Action icons */}
                <Box sx={{ display: 'flex', gap: 0.5, ml: 1 }}>
                  <Skeleton variant="circular" width={20} height={20} />
                  <Skeleton variant="circular" width={20} height={20} />
                </Box>
              </Box>
            ))}
          </Box>
        </Box>
      </Container>
    </AuthenticatedLayout>
  );
}
