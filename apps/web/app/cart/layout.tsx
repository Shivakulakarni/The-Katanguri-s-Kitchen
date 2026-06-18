import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Cart | The Katanguri\'s Kitchen',
  description: 'Review your order before checkout. Adjust quantities, add items, and proceed to secure payment.',
};

export default function CartLayout({ children }: { children: React.ReactNode }) {
  return children;
}
