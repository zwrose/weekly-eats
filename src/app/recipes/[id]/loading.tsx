import AuthenticatedLayout from '@/components/AuthenticatedLayout';
import { Box, Container, Skeleton } from '@mui/material';

export default function RecipeDetailLoading() {
  return (
    <AuthenticatedLayout>
      <Container maxWidth="xl" sx={{ py: 3 }}>
        <Skeleton variant="text" width={90} />
        <Box sx={{ display: 'flex', gap: 2, mt: 2, mb: 3 }}>
          <Skeleton variant="rounded" width={72} height={72} />
          <Box sx={{ flex: 1 }}>
            <Skeleton variant="text" width="40%" height={40} />
            <Skeleton variant="text" width="30%" />
          </Box>
        </Box>
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 4 }}>
          <Skeleton variant="rounded" height={240} />
          <Skeleton variant="rounded" height={240} />
        </Box>
      </Container>
    </AuthenticatedLayout>
  );
}
