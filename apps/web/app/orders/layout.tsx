import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'My Orders | The Katanguri\'s Kitchen',
  description: 'View your order history with real-time tracking for active orders. Re-order your favorites anytime.',
};

export default function OrdersLayout({ children }: { children: React.ReactNode }) {
  return children;
}
