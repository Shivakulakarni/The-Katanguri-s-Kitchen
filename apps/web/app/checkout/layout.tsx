import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Checkout | The Katanguri\'s Kitchen',
  description: 'Complete your order with delivery address and payment. Secure checkout for The Katanguri\'s Kitchen.',
};

export default function CheckoutLayout({ children }: { children: React.ReactNode }) {
  return children;
}
