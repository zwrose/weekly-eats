"use client";

import { signIn } from "next-auth/react";
import { Button } from "@mui/material";
import { useSearchParams } from "next/navigation";

export default function SignInButton() {
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/meal-plans";

  return (
    <Button
      variant="contained"
      color="inherit"
      size="large"
      onClick={() => signIn("google", { callbackUrl })}
      sx={{
        textTransform: "none",
        bgcolor: "background.paper",
        color: "text.primary",
        boxShadow: "0 1px 3px rgba(0,0,0,0.12)",
        "&:hover": {
          bgcolor: "grey.100",
        },
      }}
      startIcon={
        <svg width="18" height="18" viewBox="0 0 18 18">
          <path
            fill="#4285F4"
            d="M17.785 9.169c0-.738-.06-1.276-.189-1.834h-8.42v3.328h4.842c-.1.828-.638 2.328-1.834 3.263l2.953 2.258c1.732-1.591 2.648-3.927 2.648-7.015z"
          />
          <path
            fill="#34A853"
            d="M9.175 17.938c2.476 0 4.567-.816 6.086-2.226l-2.953-2.258c-.816.551-1.858.886-3.133.886-2.414 0-4.456-1.632-5.186-3.823H1.254v2.332c1.591 3.158 4.856 5.089 7.921 5.089z"
          />
          <path
            fill="#FBBC05"
            d="M4.989 10.737c-.18-.551-.282-1.133-.282-1.737s.102-1.186.282-1.737V4.933H1.254C.456 6.159 0 7.581 0 9s.456 2.841 1.254 4.067l3.735-2.33z"
          />
          <path
            fill="#EA4335"
            d="M9.175 3.581c1.365 0 2.314.591 2.845 1.084l2.078-2.078C13.743 1.254 11.651 0 9.175 0 6.11 0 2.845 1.931 1.254 5.089l3.735 2.332c.73-2.191 2.772-3.84 5.186-3.84z"
          />
        </svg>
      }
    >
      Sign in with Google
    </Button>
  );
}
