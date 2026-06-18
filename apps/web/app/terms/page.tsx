import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Terms of Service',
  description: 'Terms of Service for The Katanguri\'s Kitchen',
};

export default function TermsPage() {
  return (
    <div className="container" style={{ paddingTop: 32, paddingBottom: 80, maxWidth: 720, margin: '0 auto' }}>
      <h1 style={{ fontSize: 36, fontWeight: 500, marginBottom: 32, letterSpacing: '-0.5px' }}>Terms of Service</h1>
      <div style={{ fontSize: 14, lineHeight: 1.7, color: 'var(--ink)' }}>
        <p style={{ marginBottom: 16 }}>Last updated: June 2026</p>

        <h2 style={{ fontSize: 20, fontWeight: 600, marginTop: 32, marginBottom: 12 }}>Ordering & Payment</h2>
        <p style={{ marginBottom: 16 }}>All orders are subject to availability and confirmation. Prices are in INR and include applicable taxes. Payment must be completed before order preparation begins.</p>

        <h2 style={{ fontSize: 20, fontWeight: 600, marginTop: 32, marginBottom: 12 }}>Delivery</h2>
        <p style={{ marginBottom: 16 }}>Delivery times are estimates. We are not responsible for delays outside our control. Free delivery applies to orders above ₹500 within our service area in Hanamkonda, Warangal.</p>

        <h2 style={{ fontSize: 20, fontWeight: 600, marginTop: 32, marginBottom: 12 }}>Cancellations & Refunds</h2>
        <p style={{ marginBottom: 16 }}>Orders can be cancelled within 5 minutes of placement. Refunds for cancelled or failed deliveries will be processed within 5-7 business days to the original payment method.</p>

        <h2 style={{ fontSize: 20, fontWeight: 600, marginTop: 32, marginBottom: 12 }}>Contact</h2>
        <p style={{ marginBottom: 16 }}>For questions about these terms, contact us at <a href="mailto:hello@thekatanguriskitchen.com" style={{ color: 'var(--primary)', fontWeight: 600 }}>hello@thekatanguriskitchen.com</a>.</p>
      </div>
    </div>
  );
}
