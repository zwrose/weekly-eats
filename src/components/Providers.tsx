"use client";

import { SessionProvider } from "next-auth/react";
import CssBaseline from "@mui/material/CssBaseline";
import { ThemeProviderWrapper } from "../lib/theme-context";
import { ThemeColorMeta } from "./ThemeColorMeta";

export default function Providers({
  children,
  initialIsDark = false,
}: {
  children: React.ReactNode;
  initialIsDark?: boolean;
}) {
  return (
    <SessionProvider>
      <ThemeProviderWrapper initialIsDark={initialIsDark}>
        <CssBaseline />
        <ThemeColorMeta />
        {children}
      </ThemeProviderWrapper>
    </SessionProvider>
  );
}
