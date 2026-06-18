import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Track Order | The Katanguri\'s Kitchen',
  description: 'Track your order in real-time with live status updates and rider location. Know exactly when your food arrives.',
};

export default function TrackLayout({ children }: { children: React.ReactNode }) {
  return children;
}
