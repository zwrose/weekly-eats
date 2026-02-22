import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Recipes',
};

export default function RecipesLayout({ children }: { children: React.ReactNode }) {
  return children;
}
