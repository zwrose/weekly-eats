import { Container, Box, Skeleton, Paper } from "@mui/material";
import AuthenticatedLayout from "@/components/AuthenticatedLayout";

export default function RecipesLoading() {
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
              <Skeleton variant="text" width={140} height={48} />
            </Box>
            <Box sx={{ display: "flex", gap: 2 }}>
              <Skeleton variant="rounded" width={160} height={36} />
              <Skeleton variant="rounded" width={40} height={36} />
            </Box>
          </Box>

          {/* Search + content */}
          <Paper sx={{ p: 3, mb: 4, maxWidth: "md", mx: "auto" }}>
            <Skeleton variant="rounded" height={56} sx={{ mb: 3 }} />
            {[...Array(5)].map((_, i) => (
              <Box key={i} sx={{ display: "flex", alignItems: "center", gap: 2, mb: 2 }}>
                <Skeleton variant="circular" width={32} height={32} />
                <Box sx={{ flex: 1 }}>
                  <Skeleton variant="text" width="55%" height={24} />
                  <Skeleton variant="text" width="30%" height={18} />
                </Box>
              </Box>
            ))}
          </Paper>
        </Box>
      </Container>
    </AuthenticatedLayout>
  );
}
