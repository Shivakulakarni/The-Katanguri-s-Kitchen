import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description: 'Privacy Policy for The Katanguri\'s Kitchen',
};

export default function PrivacyPage() {
  return (
    <div className="container" style={{ paddingTop: 32, paddingBottom: 80, maxWidth: 720, margin: '0 auto' }}>
      <h1 style={{ fontSize: 36, fontWeight: 500, marginBottom: 32, letterSpacing: '-0.5px' }}>Privacy Policy</h1>
      <div style={{ fontSize: 14, lineHeight: 1.7, color: 'var(--ink)' }}>
        <p style={{ marginBottom: 16 }}>Last updated: June 2026</p>

        <h2 style={{ fontSize: 20, fontWeight: 600, marginTop: 32, marginBottom: 12 }}>Information We Collect</h2>
        <p style={{ marginBottom: 16 }}>We collect information you provide when placing an order, including your name, delivery address, phone number, and payment details. We also collect order history and usage data to improve our service.</p>

        <h2 style={{ fontSize: 20, fontWeight: 600, marginTop: 32, marginBottom: 12 }}>How We Use Your Information</h2>
        <p style={{ marginBottom: 16 }}>Your information is used to process orders, deliver food, provide customer support, and send order updates. With your consent, we may send promotional offers.</p>

        <h2 style={{ fontSize: 20, fontWeight: 600, marginTop: 32, marginBottom: 12 }}>Data Sharing</h2>
        <p style={{ marginBottom: 16 }}>We share your data only with delivery partners to fulfill orders and payment processors to handle transactions. We do not sell your personal data to third parties.</p>

        <h2 style={{ fontSize: 20, fontWeight: 600, marginTop: 32, marginBottom: 12 }}>Contact</h2>
        <p style={{ marginBottom: 16 }}>For questions about this policy, contact us at <a href="mailto:hello@thekatanguriskitchen.com" style={{ color: 'var(--primary)', fontWeight: 600 }}>hello@thekatanguriskitchen.com</a>.</p>
      </div>
    </div>
  );
}
