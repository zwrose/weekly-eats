import { Container, Box, Skeleton, Paper } from "@mui/material";
import AuthenticatedLayout from "@/components/AuthenticatedLayout";

export default function RecipesLoading() {
  return (
    <AuthenticatedLayout>
      <Container maxWidth="xl">
        <Box sx={{ py: { xs: 0.5, md: 1 } }}>
          {/* Page header */}
          <Box sx={{ display: "flex", alignItems: "center", gap: 2, mb: 3 }}>
            <Skeleton variant="circular" width={40} height={40} />
            <Skeleton variant="text" width={180} height={48} />
          </Box>

          {/* Search/filter bar */}
          <Skeleton variant="rounded" height={56} sx={{ mb: 3 }} />

          {/* Tab bar */}
          <Skeleton variant="rounded" width={300} height={48} sx={{ mb: 3 }} />

          {/* Recipe cards */}
          <Box sx={{ display: { xs: "block", md: "none" } }}>
            {[...Array(4)].map((_, i) => (
              <Paper key={i} sx={{ p: 2, mb: 2 }}>
                <Box sx={{ display: "flex", gap: 2 }}>
                  <Skeleton variant="circular" width={32} height={32} />
                  <Box sx={{ flex: 1 }}>
                    <Skeleton variant="text" width="60%" height={28} />
                    <Skeleton variant="text" width="40%" height={20} />
                  </Box>
                </Box>
              </Paper>
            ))}
          </Box>

          {/* Table rows (desktop) */}
          <Box sx={{ display: { xs: "none", md: "block" } }}>
            <Skeleton variant="rounded" height={48} sx={{ mb: 1 }} />
            {[...Array(6)].map((_, i) => (
              <Skeleton key={i} variant="rounded" height={52} sx={{ mb: 0.5 }} />
            ))}
          </Box>
        </Box>
      </Container>
    </AuthenticatedLayout>
  );
}
