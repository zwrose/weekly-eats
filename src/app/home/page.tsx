"use client";

import { useSession } from "next-auth/react";
import { 
  Container, 
  Typography, 
  Box, 
  CircularProgress, 
  Card,
  CardContent,
  CardActionArea
} from "@mui/material";
import { 
  CalendarMonth, 
  ShoppingCart, 
  Restaurant, 
  Kitchen 
} from "@mui/icons-material";
import AuthenticatedLayout from "../../components/AuthenticatedLayout";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

interface FeatureCard {
  title: string;
  description: string;
  icon: React.ReactNode;
  color: string;
  path: string;
}

const featureCards: FeatureCard[] = [
  {
    title: "Meal Plans",
    description: "Manage your weekly plans",
    icon: <CalendarMonth sx={{ fontSize: { xs: 40, sm: 50, md: 60 }, color: "white" }} />,
    color: "#1976d2",
    path: "/meal-plans"
  },
  {
    title: "Shopping Lists",
    description: "Shop with confidence",
    icon: <ShoppingCart sx={{ fontSize: { xs: 40, sm: 50, md: 60 }, color: "white" }} />,
    color: "#2e7d32",
    path: "/shopping-lists"
  },
  {
    title: "Recipes",
    description: "Manage your recipes",
    icon: <Restaurant sx={{ fontSize: { xs: 40, sm: 50, md: 60 }, color: "white" }} />,
    path: "/recipes",
    color: "#ed6c02"
  },
  {
    title: "Pantry",
    description: "Track your pantry items",
    icon: <Kitchen sx={{ fontSize: { xs: 40, sm: 50, md: 60 }, color: "white" }} />,
    path: "/pantry",
    color: "#9c27b0"
  }
];

export default function HomePage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  // Handle redirects based on authentication and approval status
  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/");
    } else if (status === "authenticated") {
      const isApproved = (session?.user as { isApproved?: boolean })?.isApproved;
      const isAdmin = (session?.user as { isAdmin?: boolean })?.isAdmin;
      
      // Redirect unapproved users (except admins)
      if (!isApproved && !isAdmin) {
        router.push('/pending-approval');
      }
    }
  }, [status, session, router]);

  // Show loading state while session is being fetched
  if (status === "loading" || 
      status === "unauthenticated" || 
      (status === "authenticated" && !(session?.user as { isApproved?: boolean })?.isApproved && 
       !(session?.user as { isAdmin?: boolean })?.isAdmin)) {
    return (
      <AuthenticatedLayout>
        <Container maxWidth="md">
          <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
            <CircularProgress />
          </Box>
        </Container>
      </AuthenticatedLayout>
    );
  }

  const handleCardClick = (path: string) => {
    router.push(path);
  };

  return (
    <AuthenticatedLayout>
      <Container maxWidth="xl" sx={{ py: 4 }}>
        <Box sx={{ py: { xs: 0, sm: 2, md: 4 } }}>

          <Box 
            sx={{ 
              display: "grid", 
              gridTemplateColumns: { xs: "1fr", sm: "repeat(2, 1fr)", md: "repeat(4, 1fr)" },
              gap: { xs: 2, sm: 3, md: 3 } 
            }}
          >
            {featureCards.map((card) => (
              <Card 
                key={card.title}
                sx={{ 
                  height: "100%",
                  transition: "transform 0.2s, box-shadow 0.2s",
                  "&:hover": {
                    transform: "translateY(-4px)",
                    boxShadow: "0 8px 25px rgba(0,0,0,0.15)",
                  }
                }}
              >
                <CardActionArea 
                  onClick={() => handleCardClick(card.path)}
                  sx={{ height: "100%", display: "flex", flexDirection: "column" }}
                >
                  <Box
                    sx={{
                      height: { xs: 80, sm: 100, md: 120 },
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      bgcolor: card.color,
                      width: "100%",
                    }}
                  >
                    {card.icon}
                  </Box>
                  <CardContent sx={{ flexGrow: 1, textAlign: "center", py: { xs: 1.5, sm: 2 } }}>
                    <Typography variant="h6" component="h2" gutterBottom>
                      {card.title}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {card.description}
                    </Typography>
                  </CardContent>
                </CardActionArea>
              </Card>
            ))}
          </Box>
        </Box>
      </Container>
    </AuthenticatedLayout>
  );
} 