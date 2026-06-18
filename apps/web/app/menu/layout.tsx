import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Menu | The Katanguri\'s Kitchen',
  description: 'Browse our delicious menu of Indian dishes, from Dum Biryani to Starters. Order online for delivery in Warangal.',
};

export default function MenuLayout({ children }: { children: React.ReactNode }) {
  return children;
}
