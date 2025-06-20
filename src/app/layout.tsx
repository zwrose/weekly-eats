import type { Metadata } from "next";
import { Ysabeau_Infant } from "next/font/google";
import "./globals.css";
import Providers from "../components/Providers";

const ysabeauInfant = Ysabeau_Infant({
  subsets: ["latin"],
  weight: ["1", "100", "200", "300", "400", "500", "600", "700", "800", "900", "1000"],
  variable: "--font-ysabeau-infant",
});

export const metadata: Metadata = {
  title: "Weekly Eats",
  description: "Plan your meals, make your list, and head to the store with confidence.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={ysabeauInfant.variable}>
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
