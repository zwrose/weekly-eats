import type { Metadata } from 'next';
import { Bricolage_Grotesque, Outfit } from 'next/font/google';
import { AppRouterCacheProvider } from '@mui/material-nextjs/v15-appRouter';
import './globals.css';
import Providers from '../components/Providers';

const display = Bricolage_Grotesque({
  subsets: ['latin'],
  weight: ['500', '600', '700'],
  variable: '--font-display',
  display: 'swap',
});

const body = Outfit({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-body',
  display: 'swap',
});

export const metadata: Metadata = {
  title: { template: '%s - Weekly Eats', default: 'Weekly Eats' },
  description: 'Plan your meals, make your list, and head to the store with confidence.',
  manifest: '/manifest.json',
  icons: {
    icon: [
      { url: '/icon0.svg', type: 'image/svg+xml' },
      { url: '/web-app-manifest-192x192.png', sizes: '192x192', type: 'image/png' },
      { url: '/web-app-manifest-512x512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: '/apple-icon.png',
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <head>
        {/* Material Symbols Outlined is not available via next/font/google's font registry,
            so it is loaded as a stylesheet. The Icon component applies it via the --font-icons
            CSS var (defined in globals.css) plus the required font-variation-settings.
            Both font lint rules are disabled deliberately: next/font cannot host this icon face,
            and `display=block` (not swap/optional) is correct for icons — it avoids flashing the
            raw ligature text (e.g. "delete") as words before the glyphs load. */}
        {/* eslint-disable @next/next/no-page-custom-font, @next/next/google-font-display */}
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&display=block"
        />
        {/* eslint-enable @next/next/no-page-custom-font, @next/next/google-font-display */}
      </head>
      <body className={`${display.variable} ${body.variable}`}>
        <AppRouterCacheProvider>
          <Providers>{children}</Providers>
        </AppRouterCacheProvider>
      </body>
    </html>
  );
}
