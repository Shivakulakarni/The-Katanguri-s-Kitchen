'use client';

import { useState, useEffect } from 'react';

const STORAGE_KEY = 'cookie-consent';

export default function CookieConsent() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const consent = localStorage.getItem(STORAGE_KEY);
    if (!consent) {
      setVisible(true);
    }
  }, []);

  const handleAccept = () => {
    localStorage.setItem(STORAGE_KEY, 'accepted');
    setVisible(false);
  };

  const handleDecline = () => {
    localStorage.setItem(STORAGE_KEY, 'declined');
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div style={{
      position: 'fixed', bottom: 0, left: 0, right: 0,
      background: 'var(--canvas)', padding: '16px 24px',
      borderTop: '1px solid var(--hairline-soft)',
      zIndex: 9999, display: 'flex', justifyContent: 'space-between',
      alignItems: 'center', gap: 16, flexWrap: 'wrap',
    }}>
      <p style={{ margin: 0, fontSize: 14, color: 'var(--steel)' }}>
        We use cookies to enhance your experience. By continuing, you agree to our use of cookies.
      </p>
      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={handleDecline} style={{
          padding: '8px 16px', fontSize: 14, border: '1px solid var(--hairline-soft)',
          background: 'transparent', color: 'var(--steel)', borderRadius: 6, cursor: 'pointer',
        }}>
          Decline
        </button>
        <button onClick={handleAccept} style={{
          padding: '8px 16px', fontSize: 14, border: 'none',
          background: '#e63946', color: '#fff', borderRadius: 6, cursor: 'pointer',
        }}>
          Accept
        </button>
      </div>
    </div>
  );
}
