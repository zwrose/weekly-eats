import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Meal Plans",
};

export default function MealPlansLayout({ children }: { children: React.ReactNode }) {
  return children;
}
