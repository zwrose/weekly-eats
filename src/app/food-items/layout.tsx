import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Food Items',
};

export default function FoodItemsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
