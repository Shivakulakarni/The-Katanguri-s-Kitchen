import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Contact Us | The Katanguri\'s Kitchen',
  description: 'Get in touch with The Katanguri\'s Kitchen. Send us a message, feedback, or inquire about bulk orders.',
};

export default function ContactLayout({ children }: { children: React.ReactNode }) {
  return children;
}
