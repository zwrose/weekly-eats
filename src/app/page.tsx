"use client";

import { useSession } from "next-auth/react";
import { redirect } from "next/navigation";
import {
  Box,
  Typography,
  Container,
  Paper,
  ThemeProvider,
  Button,
} from "@mui/material";
import SignInButton from "../components/SignInButton";
import { lightTheme } from "../lib/theme";
import { Suspense } from "react";
import Image from "next/image";

export default function Home() {
  const { data: session, status } = useSession();

  // Show loading state while session is being fetched
  if (status === "loading") {
    return (
      <ThemeProvider theme={lightTheme}>
        <Box
          sx={{
            minHeight: "100vh",
            bgcolor: "background.default",
            display: "grid",
            placeItems: "center",
            p: 4,
          }}
        >
          <Container maxWidth="sm">
            <Typography
              variant="h4"
              component="h1"
              sx={{ textAlign: "center", color: "text.primary", mb: 4 }}
            >
              Loading...
            </Typography>
          </Container>
        </Box>
      </ThemeProvider>
    );
  }

  // If user is signed in, redirect to /meal-plans
  if (session) {
    redirect("/meal-plans");
  }

  return (
    <ThemeProvider theme={lightTheme}>
      <Box
        sx={{
          minHeight: "100vh",
          bgcolor: "#f5f5f5",
          color: "text.primary",
        }}
      >
        {/* Top nav */}
        <Box
          component="header"
          sx={{
            borderBottom: "1px solid",
            borderColor: "divider",
            bgcolor: "rgba(255,255,255,0.85)",
            backdropFilter: "blur(8px)",
            position: "sticky",
            top: 0,
            zIndex: 10,
          }}
        >
          <Container maxWidth="lg">
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                py: 2,
              }}
            >
              <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                <Box sx={{ display: { xs: "none", sm: "block" } }}>
                  <Image
                    src="/icon0.svg"
                    alt="Weekly Eats"
                    width={32}
                    height={32}
                    style={{ minWidth: 32, display: "block" }}
                    priority
                  />
                </Box>
                <Typography
                  variant="h4"
                  component="div"
                  sx={{ fontWeight: "bold" }}
                >
                  Weekly Eats
                </Typography>
              </Box>
              <Box
                sx={{
                  display: { xs: "none", sm: "flex" },
                  gap: 3,
                  alignItems: "center",
                  color: "text.secondary",
                  fontSize: "0.9rem",
                }}
              >
                <Button
                  href="#features"
                  color="inherit"
                  size="small"
                  sx={{ textTransform: "none" }}
                >
                  Features
                </Button>
                <Button
                  href="#how-it-works"
                  color="inherit"
                  size="small"
                  sx={{ textTransform: "none" }}
                >
                  How it works
                </Button>
                <Button
                  href="#for-who"
                  color="inherit"
                  size="small"
                  sx={{ textTransform: "none" }}
                >
                  Who it’s for
                </Button>
                <Suspense fallback={null}>
                  <SignInButton />
                </Suspense>
              </Box>
            </Box>
          </Container>
        </Box>

        {/* Hero + sections */}
        <Container maxWidth="lg" sx={{ py: { xs: 6, md: 10 } }}>
          {/* Hero */}
          <Paper
            elevation={4}
            sx={{
              position: "relative",
              overflow: "hidden",
              borderRadius: { xs: 3, md: 4 },
              mb: { xs: 8, md: 10 },
              px: { xs: 3, md: 6 },
              py: { xs: 4, md: 6 },
              bgcolor: "background.paper",
            }}
          >
            {/* Background hero image */}
            <Box
              sx={{
                position: "absolute",
                inset: 0,
                pointerEvents: "none",
              }}
            >
              <Box
                sx={{
                  position: "absolute",
                  inset: 0,
                  opacity: 0.7,
                }}
              >
                <Image
                  src="/home_hero.png"
                  alt="Overhead view of a table with fresh ingredients and a meal plan"
                  fill
                  priority
                  style={{ objectFit: "cover" }}
                />
              </Box>
              {/* Subtle gradient overlay for readability */}
              <Box
                sx={{
                  position: "absolute",
                  inset: 0,
                  background:
                    "linear-gradient(135deg, rgba(255,255,255,0.96) 0%, rgba(255,255,255,0.78) 35%, rgba(255,255,255,0.6) 100%)",
                }}
              />
            </Box>

            <Box
              sx={{
                position: "relative",
                display: "flex",
                flexDirection: "column",
                alignItems: { xs: "flex-start", md: "flex-start" },
                gap: 4,
              }}
            >
              <Box sx={{ maxWidth: 520 }}>
                <Typography
                  variant="h2"
                  component="h1"
                  sx={{
                    fontSize: { xs: "2.4rem", md: "3.2rem" },
                    fontWeight: 800,
                    mb: 2,
                    color: "text.primary",
                    lineHeight: 1.1,
                  }}
                >
                  Simplify getting meals on the table.
                </Typography>
                <Typography
                  variant="h6"
                  sx={{
                    color: "text.secondary",
                    fontWeight: 400,
                    mb: 3,
                    maxWidth: 480,
                  }}
                >
                  Weekly Eats turns your weekly meal plan into a live, shared
                  shopping list, streamling meal prep logistics.
                </Typography>

                <Box
                  sx={{
                    display: "flex",
                    flexDirection: { xs: "column", sm: "row" },
                    gap: 2,
                    alignItems: { xs: "stretch", sm: "center" },
                    mb: 2,
                  }}
                >
                  <Suspense fallback={null}>
                    <SignInButton />
                  </Suspense>
                  <Button
                    href="#how-it-works"
                    variant="contained"
                    color="inherit"
                    size="large"
                    sx={{
                      textTransform: "none",
                      bgcolor: "background.paper",
                      color: "text.primary",
                      boxShadow: "0 1px 3px rgba(0,0,0,0.12)",
                      "&:hover": {
                        bgcolor: "grey.100",
                      },
                    }}
                  >
                    See how it works
                  </Button>
                </Box>

                <Typography variant="caption" sx={{ color: "text.secondary" }}>
                  Currently in limited beta - your account will require
                  approval.
                </Typography>
              </Box>
            </Box>
          </Paper>

          {/* Features */}
          <Box id="features" sx={{ mb: { xs: 8, md: 10 } }}>
            <Typography
              variant="overline"
              sx={{ color: "primary.main", fontWeight: 600 }}
            >
              FEATURES
            </Typography>
            <Typography variant="h5" sx={{ fontWeight: 600, mb: 3 }}>
              Everything you need from planning to pantry.
            </Typography>

            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: {
                  xs: "1fr",
                  md: "repeat(3, minmax(0, 1fr))",
                },
                gap: 3,
              }}
            >
              <Paper
                variant="outlined"
                sx={{ p: 3, borderRadius: 2, bgcolor: "background.paper" }}
              >
                <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>
                  Smart weekly meal plans
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Build flexible plans that match your real life—recipes,
                  staples, and ingredient groups all in one view.
                </Typography>
              </Paper>
              <Paper
                variant="outlined"
                sx={{ p: 3, borderRadius: 2, bgcolor: "background.paper" }}
              >
                <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>
                  Live, shared shopping lists
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Everyone sees the same list. Check items off and watch them
                  disappear in real time across devices.
                </Typography>
              </Paper>
              <Paper
                variant="outlined"
                sx={{ p: 3, borderRadius: 2, bgcolor: "background.paper" }}
              >
                <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>
                  Unit-aware & pantry-friendly
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Keep units and quantities consistent, resolve conflicts, and
                  quickly adjust based on what&apos;s already in your pantry.
                </Typography>
              </Paper>
            </Box>
          </Box>

          {/* How it works */}
          <Box
            id="how-it-works"
            sx={{
              mb: { xs: 8, md: 10 },
              scrollMarginTop: { xs: 80, sm: 96 },
            }}
          >
            <Typography
              variant="overline"
              sx={{ color: "primary.main", fontWeight: 600 }}
            >
              HOW IT WORKS
            </Typography>
            <Typography variant="h5" sx={{ fontWeight: 600, mb: 3 }}>
              From idea to aisle in four steps.
            </Typography>

            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: {
                  xs: "1fr",
                  md: "repeat(4, minmax(0, 1fr))",
                },
                gap: 3,
              }}
            >
              {[
                {
                  title: "Plan",
                  body: "Create your weekly meal plan with recipes, staples, and custom notes.",
                },
                {
                  title: "Generate",
                  body: "Turn your plan into a grouped shopping list for your favorite stores.",
                },
                {
                  title: "Share",
                  body: "Invite family or roommates so everyone shops from the same live list.",
                },
                {
                  title: "Shop",
                  body: "Check off items as you go. Your list stays in sync for everyone in real time.",
                },
              ].map((step, index) => (
                <Paper
                  key={step.title}
                  variant="outlined"
                  sx={{ p: 3, borderRadius: 2, bgcolor: "background.paper" }}
                >
                  <Typography
                    variant="overline"
                    sx={{ color: "text.secondary" }}
                  >
                    Step {index + 1}
                  </Typography>
                  <Typography
                    variant="subtitle1"
                    sx={{ fontWeight: 600, mb: 1 }}
                  >
                    {step.title}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {step.body}
                  </Typography>
                </Paper>
              ))}
            </Box>
          </Box>

          {/* Who it's for */}
          <Box id="for-who" sx={{ mb: { xs: 8, md: 10 } }}>
            <Typography
              variant="overline"
              sx={{ color: "primary.main", fontWeight: 600 }}
            >
              BUILT FOR REAL LIFE
            </Typography>
            <Typography variant="h5" sx={{ fontWeight: 600, mb: 3 }}>
              Great for households, roommates, and anyone tired of winging it.
            </Typography>
            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: {
                  xs: "1fr",
                  md: "repeat(2, minmax(0, 1fr))",
                },
                gap: 3,
              }}
            >
              <Paper
                variant="outlined"
                sx={{ p: 3, borderRadius: 2, bgcolor: "background.paper" }}
              >
                <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>
                  Busy families
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Share the plan, share the list, and let anyone jump in to help
                  with the shopping without losing track.
                </Typography>
              </Paper>
              <Paper
                variant="outlined"
                sx={{ p: 3, borderRadius: 2, bgcolor: "background.paper" }}
              >
                <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>
                  Roommates & partners
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Coordinate meals and staples so you stop buying duplicate milk
                  and forgetting the basics.
                </Typography>
              </Paper>
            </Box>
          </Box>

          {/* Final CTA */}
          <Box sx={{ textAlign: "center" }}>
            <Typography variant="h5" sx={{ fontWeight: 600, mb: 2 }}>
              Ready to make next week easier?
            </Typography>
            <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
              Take the step to simplify your meal prep.
            </Typography>
            <Suspense fallback={null}>
              <SignInButton />
            </Suspense>
          </Box>
        </Container>
      </Box>
    </ThemeProvider>
  );
}
