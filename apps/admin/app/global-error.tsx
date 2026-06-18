'use client';

import { useState, useEffect } from 'react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const [showLogs, setShowLogs] = useState(false);

  useEffect(() => {
    console.error('[Telemetry] Admin Dashboard critical exception:', error);
  }, [error]);

  return (
    <html lang="en" style={{ height: '100%' }}>
      <body style={{
        margin: 0,
        padding: 0,
        height: '100%',
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'radial-gradient(circle at center, #111827 0%, #030712 100%)',
        color: '#ffffff',
        fontFamily: '"Outfit", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      }}>
        <div style={{
          maxWidth: '580px',
          width: 'calc(100% - 48px)',
          background: 'rgba(255, 255, 255, 0.02)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          border: '1px solid rgba(239, 68, 68, 0.2)',
          borderRadius: '24px',
          padding: '40px',
          boxShadow: '0 25px 60px rgba(0, 0, 0, 0.6)',
          textAlign: 'center',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
        }}>
          {/* Animated Error Badge */}
          <div style={{
            position: 'relative',
            width: '80px',
            height: '80px',
            borderRadius: '50%',
            background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.15) 0%, rgba(185, 28, 28, 0.15) 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '24px',
            border: '1px solid rgba(239, 68, 68, 0.4)',
          }}>
            <span style={{ fontSize: '36px', animation: 'pulse 2s infinite' }}>🚨</span>
          </div>

          <h1 style={{
            fontSize: '30px',
            fontWeight: 700,
            background: 'linear-gradient(135deg, #ffffff 0%, #9ca3af 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            margin: '0 0 12px 0',
            letterSpacing: '-0.5px',
          }}>
            Console Critical Failure
          </h1>
          
          <p style={{
            fontSize: '15px',
            lineHeight: '1.6',
            color: '#9ca3af',
            margin: '0 0 32px 0',
            maxWidth: '440px',
          }}>
            A root-level supervisor thread terminated abnormally. Dashboard state recovery triggered.
          </p>

          {/* Action Buttons */}
          <div style={{
            display: 'flex',
            gap: '16px',
            width: '100%',
            justifyContent: 'center',
            marginBottom: '32px',
          }}>
            <button
              onClick={reset}
              style={{
                flex: 1,
                maxWidth: '180px',
                padding: '14px 28px',
                borderRadius: '12px',
                border: 'none',
                background: 'linear-gradient(135deg, #ef4444 0%, #b91c1c 100%)',
                color: '#ffffff',
                fontSize: '15px',
                fontWeight: 600,
                cursor: 'pointer',
                boxShadow: '0 4px 15px rgba(239, 68, 68, 0.3)',
                transition: 'transform 0.2s, box-shadow 0.2s',
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = '0 6px 20px rgba(239, 68, 68, 0.4)';
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 4px 15px rgba(239, 68, 68, 0.3)';
              }}
            >
              Cold-Reboot Console
            </button>
            
            <a
              href="/"
              style={{
                flex: 1,
                maxWidth: '180px',
                padding: '14px 28px',
                borderRadius: '12px',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                background: 'rgba(255, 255, 255, 0.04)',
                color: '#ffffff',
                fontSize: '15px',
                fontWeight: 600,
                textDecoration: 'none',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'background 0.2s, border 0.2s',
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)';
                e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.15)';
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.04)';
                e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.08)';
              }}
            >
              Control Center
            </a>
          </div>

          {/* Diagnostic Logs */}
          <div style={{ width: '100%', textAlign: 'left' }}>
            <button
              onClick={() => setShowLogs(!showLogs)}
              style={{
                width: '100%',
                background: 'none',
                border: 'none',
                color: '#6b7280',
                fontSize: '13px',
                fontWeight: 500,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px 16px',
                borderRadius: '8px',
                backgroundColor: 'rgba(255, 255, 255, 0.01)',
                transition: 'color 0.2s, background 0.2s',
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.color = '#9ca3af';
                e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.03)';
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.color = '#6b7280';
                e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.01)';
              }}
            >
              <span>Console Telemetry Log</span>
              <span>{showLogs ? '▲' : '▼'}</span>
            </button>

            {showLogs && (
              <div style={{
                marginTop: '12px',
                padding: '16px',
                borderRadius: '12px',
                backgroundColor: '#030712',
                border: '1px solid rgba(239, 68, 68, 0.1)',
                maxHeight: '200px',
                overflowY: 'auto',
                fontFamily: 'SFMono-Regular, Consolas, "Liberation Mono", Menlo, monospace',
                fontSize: '12px',
                color: '#f87171',
                lineHeight: '1.5',
                whiteSpace: 'pre-wrap',
              }}>
                <div><strong>Console Status:</strong> Core Exception</div>
                <div style={{ marginTop: '4px' }}><strong>Trace Digest:</strong> {error.digest || 'DASHBOARD-CRIT-UNRESOLVED'}</div>
                <div style={{ marginTop: '4px', color: '#e5e7eb' }}><strong>Payload:</strong> {error.message || 'No description provided.'}</div>
                {error.stack && process.env.NODE_ENV !== 'production' && (
                  <div style={{ marginTop: '8px', color: '#6b7280', fontSize: '11px', borderTop: '1px solid rgba(255, 255, 255, 0.05)', paddingTop: '8px' }}>
                    {error.stack.split('\n').slice(0, 5).join('\n')}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
        
        <style dangerouslySetInnerHTML={{__html: `
          @keyframes pulse {
            0% { transform: scale(1); opacity: 1; }
            50% { transform: scale(1.05); opacity: 0.8; }
            100% { transform: scale(1); opacity: 1; }
          }
        `}} />
      </body>
    </html>
  );
}
