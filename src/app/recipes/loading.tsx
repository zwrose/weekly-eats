import { Container, Box, Skeleton } from '@mui/material';
import AuthenticatedLayout from '@/components/AuthenticatedLayout';
import { tokens } from '@/lib/design-tokens';

export default function RecipesLoading() {
  return (
    <AuthenticatedLayout>
      <Container maxWidth="xl">
        <Box sx={{ py: { xs: 0.5, md: 1 } }}>
          {/* Page header */}
          <Box
            sx={{
              display: 'flex',
              flexDirection: { xs: 'column', sm: 'row' },
              justifyContent: 'space-between',
              alignItems: { xs: 'flex-start', sm: 'center' },
              gap: { xs: 2, sm: 0 },
              mb: { xs: 2, md: 4 },
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Skeleton
                variant="circular"
                width={40}
                height={40}
                sx={{ bgcolor: tokens.surface.elevated }}
              />
              <Skeleton
                variant="text"
                width={140}
                height={48}
                sx={{ bgcolor: tokens.surface.elevated }}
              />
            </Box>
            <Box sx={{ display: 'flex', gap: 2 }}>
              <Skeleton
                variant="rounded"
                width={160}
                height={36}
                sx={{ bgcolor: tokens.surface.elevated }}
              />
              <Skeleton
                variant="rounded"
                width={40}
                height={36}
                sx={{ bgcolor: tokens.surface.elevated }}
              />
            </Box>
          </Box>

          {/* Filter bar */}
          <Skeleton
            variant="rounded"
            height={56}
            sx={{ mb: 2, borderRadius: `${tokens.radius.lg}px`, bgcolor: tokens.surface.raised }}
          />

          {/* Recipe rows */}
          {[...Array(5)].map((_, i) => (
            <Box
              key={i}
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 2,
                mb: 1,
                px: 1.5,
                py: 1,
                borderRadius: `${tokens.radius.lg}px`,
                bgcolor: tokens.surface.raised,
              }}
            >
              <Skeleton
                variant="circular"
                width={32}
                height={32}
                sx={{ bgcolor: tokens.surface.elevated, flexShrink: 0 }}
              />
              <Box sx={{ flex: 1 }}>
                <Skeleton
                  variant="text"
                  width="55%"
                  height={22}
                  sx={{ bgcolor: tokens.surface.elevated }}
                />
                <Skeleton
                  variant="text"
                  width="30%"
                  height={16}
                  sx={{ bgcolor: tokens.surface.elevated }}
                />
              </Box>
            </Box>
          ))}
        </Box>
      </Container>
    </AuthenticatedLayout>
  );
}
