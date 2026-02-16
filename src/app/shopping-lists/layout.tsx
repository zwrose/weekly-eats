import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Shopping Lists",
};

export default function ShoppingListsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
