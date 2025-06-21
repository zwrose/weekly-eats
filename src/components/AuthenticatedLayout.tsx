import { Box } from "@mui/material";
import Header from "./Header";

export default function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "background.default" }}>
      <Header />
      <Box component="main" sx={{ pt: { xs: 2, sm: 4, md: 8 } }}>
        {children}
      </Box>
    </Box>
  );
} 