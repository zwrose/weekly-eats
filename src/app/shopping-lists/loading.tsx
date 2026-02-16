import { Container, Box, Skeleton, Paper } from "@mui/material";
import AuthenticatedLayout from "@/components/AuthenticatedLayout";

export default function ShoppingListsLoading() {
  return (
    <AuthenticatedLayout>
      <Container maxWidth="xl">
        <Box sx={{ py: { xs: 0.5, md: 1 } }}>
          {/* Page header */}
          <Box
            sx={{
              display: "flex",
              flexDirection: { xs: "column", sm: "row" },
              justifyContent: "space-between",
              alignItems: { xs: "flex-start", sm: "center" },
              gap: { xs: 2, sm: 0 },
              mb: { xs: 2, md: 4 },
            }}
          >
            <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
              <Skeleton variant="circular" width={40} height={40} />
              <Skeleton variant="text" width={220} height={48} />
            </Box>
            <Skeleton variant="rounded" width={120} height={36} />
          </Box>

          {/* Search bar + content */}
          <Paper sx={{ p: 3, mb: 4, maxWidth: "md", mx: "auto" }}>
            <Skeleton variant="rounded" height={56} sx={{ mb: 3 }} />

            {/* Desktop table rows */}
            <Box sx={{ display: { xs: "none", md: "block" } }}>
              <Skeleton variant="rounded" height={48} sx={{ mb: 1 }} />
              {[...Array(4)].map((_, i) => (
                <Skeleton key={i} variant="rounded" height={52} sx={{ mb: 0.5 }} />
              ))}
            </Box>

            {/* Mobile store cards */}
            <Box sx={{ display: { xs: "block", md: "none" } }}>
              {[...Array(3)].map((_, i) => (
                <Box key={i} sx={{ mb: 2 }}>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
                    <Skeleton variant="circular" width={32} height={32} />
                    <Skeleton variant="text" width="50%" height={28} />
                  </Box>
                  <Skeleton variant="text" width="30%" height={20} />
                </Box>
              ))}
            </Box>
          </Paper>
        </Box>
      </Container>
    </AuthenticatedLayout>
  );
}
