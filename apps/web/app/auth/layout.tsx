import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Sign In | The Katanguri\'s Kitchen',
  description: 'Sign in or create an account to order from The Katanguri\'s Kitchen. Fast OTP-based login via phone or email.',
};

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return children;
}
