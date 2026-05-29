import { Box, Skeleton } from '@mui/material';
import AuthenticatedLayout from '@/components/AuthenticatedLayout';
import { tokens } from '@/lib/design-tokens';

export default function MealPlanDetailLoading() {
  return (
    <AuthenticatedLayout>
      <Box sx={{ maxWidth: 1080, mx: 'auto', px: { xs: 1.5, md: 3 }, py: { xs: 1.5, md: 3 } }}>
        {/* Back */}
        <Skeleton variant="text" width={80} height={32} sx={{ mb: 1.5 }} />

        {/* Header */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: 1.5,
            mb: 2.5,
          }}
        >
          <Box sx={{ flex: 1 }}>
            <Skeleton variant="text" width={90} height={16} />
            <Skeleton variant="text" width={220} height={40} />
            <Skeleton variant="text" width={160} height={20} />
          </Box>
          <Skeleton variant="circular" width={40} height={40} />
        </Box>

        {/* Staples bar */}
        <Skeleton
          variant="rounded"
          height={48}
          sx={{ mb: 2.25, borderRadius: `${tokens.radius.xl}px` }}
        />

        {/* Plan grid */}
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          {[...Array(4)].map((_, i) => (
            <Skeleton
              key={i}
              variant="rounded"
              height={120}
              sx={{ borderRadius: `${tokens.radius.xxxl}px` }}
            />
          ))}
        </Box>
      </Box>
    </AuthenticatedLayout>
  );
}
