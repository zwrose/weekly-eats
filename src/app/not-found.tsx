"use client";

import { Container, Box, Typography, Button } from "@mui/material";
import Link from "next/link";

export default function NotFound() {
  return (
    <Container maxWidth="sm">
      <Box sx={{ py: 8, textAlign: "center" }}>
        <Typography variant="h1" sx={{ fontSize: 96, fontWeight: 700, color: "text.secondary", mb: 2 }}>
          404
        </Typography>
        <Typography variant="h5" sx={{ mb: 1 }}>
          Page Not Found
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </Typography>
        <Button component={Link} href="/" variant="contained">
          Back to Home
        </Button>
      </Box>
    </Container>
  );
}
