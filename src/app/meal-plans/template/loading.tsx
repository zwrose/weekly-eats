import { Box, Skeleton } from '@mui/material';
import AuthenticatedLayout from '@/components/AuthenticatedLayout';
import { tokens } from '@/lib/design-tokens';

export default function MealPlanTemplateLoading() {
  return (
    <AuthenticatedLayout>
      <Box
        sx={{
          maxWidth: 1080,
          mx: 'auto',
          px: { xs: 1.5, md: 3 },
          pt: { xs: 0, md: 3 },
          pb: { xs: 1.5, md: 3 },
        }}
      >
        <Skeleton variant="text" width={80} height={32} sx={{ mb: 1.5 }} data-testid="skeleton" />
        <Box sx={{ mb: 2.5 }}>
          <Skeleton variant="text" width={90} height={16} />
          <Skeleton variant="text" width={260} height={40} />
          <Skeleton variant="text" width={220} height={20} />
        </Box>
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
            gap: { xs: 2, md: 3 },
          }}
        >
          {[0, 1].map((i) => (
            <Skeleton
              key={i}
              variant="rounded"
              height={220}
              sx={{ borderRadius: `${tokens.radius.xl}px` }}
            />
          ))}
        </Box>
      </Box>
    </AuthenticatedLayout>
  );
}
