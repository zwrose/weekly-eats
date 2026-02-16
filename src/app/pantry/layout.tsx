import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Pantry",
};

export default function PantryLayout({ children }: { children: React.ReactNode }) {
  return children;
}
