import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'FAQ | The Katanguri\'s Kitchen',
  description: 'Frequently asked questions about ordering, delivery, payment, and more at The Katanguri\'s Kitchen.',
};

export default function FaqLayout({ children }: { children: React.ReactNode }) {
  return children;
}
