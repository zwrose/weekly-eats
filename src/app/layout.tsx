import type { Metadata } from "next";
import { Figtree } from "next/font/google";
import { cookies } from "next/headers";
import { AppRouterCacheProvider } from "@mui/material-nextjs/v15-appRouter";
import "./globals.css";
import Providers from "../components/Providers";
import type { ThemeMode } from "../lib/user-settings";

const figtree = Figtree({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800", "900"],
  variable: "--font-figtree",
});

export const metadata: Metadata = {
  title: {
    template: "%s - Weekly Eats",
    default: "Weekly Eats",
  },
  description: "Plan your meals, make your list, and head to the store with confidence.",
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/icon0.svg", type: "image/svg+xml" },
      { url: "/web-app-manifest-192x192.png", sizes: "192x192", type: "image/png" },
      { url: "/web-app-manifest-512x512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: "/apple-icon.png",
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cookieStore = await cookies();
  const initialMode = (cookieStore.get("theme-mode")?.value as ThemeMode) || undefined;
  const initialIsDark = cookieStore.get("theme-isDark")?.value === "1";

  return (
    <html lang="en">
      <body className={figtree.variable}>
        <AppRouterCacheProvider>
          <Providers initialMode={initialMode} initialIsDark={initialIsDark}>
            {children}
          </Providers>
        </AppRouterCacheProvider>
      </body>
    </html>
  );
}
