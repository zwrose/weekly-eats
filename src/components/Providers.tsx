"use client";

import { SessionProvider } from "next-auth/react";
import CssBaseline from "@mui/material/CssBaseline";
import { ThemeProviderWrapper } from "../lib/theme-context";
import { ThemeColorMeta } from "./ThemeColorMeta";

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <ThemeProviderWrapper>
        <CssBaseline />
        <ThemeColorMeta />
        {children}
      </ThemeProviderWrapper>
    </SessionProvider>
  );
} 