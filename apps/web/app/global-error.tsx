'use client';

import { useState, useEffect } from 'react';

const isProduction = typeof window !== 'undefined' ? window.location.hostname !== 'localhost' && !window.location.hostname.startsWith('127.') : true;

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const [showLogs, setShowLogs] = useState(false);

  useEffect(() => {
    if (process.env.NODE_ENV === 'development') console.error('[Telemetry] Caught by React Global Error Boundary:', error);
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
        background: 'radial-gradient(circle at center, #1a1a2e 0%, #0f0f15 100%)',
        color: '#ffffff',
        fontFamily: '"Outfit", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      }}>
        <div style={{
          maxWidth: '560px',
          width: 'calc(100% - 48px)',
          background: 'rgba(255, 255, 255, 0.03)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: '24px',
          padding: '40px',
          boxShadow: '0 20px 50px rgba(0, 0, 0, 0.4)',
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
            background: 'linear-gradient(135deg, rgba(226, 55, 68, 0.2) 0%, rgba(198, 40, 40, 0.2) 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '24px',
            border: '1px solid rgba(226, 55, 68, 0.4)',
          }}>
            <span style={{ fontSize: '36px', animation: 'pulse 2s infinite' }}>🚨</span>
          </div>

          <h1 style={{
            fontSize: '32px',
            fontWeight: 700,
            background: 'linear-gradient(135deg, #ffffff 0%, #a5a5b1 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            margin: '0 0 12px 0',
            letterSpacing: '-0.5px',
          }}>
            Critical System Failure
          </h1>
          
          <p style={{
            fontSize: '16px',
            lineHeight: '1.6',
            color: '#a0a0ab',
            margin: '0 0 32px 0',
            maxWidth: '400px',
          }}>
            A root-level runtime crash has been isolated. The application has halted execution to prevent corruption.
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
                background: 'linear-gradient(135deg, #e23744 0%, #c62828 100%)',
                color: '#ffffff',
                fontSize: '15px',
                fontWeight: 600,
                cursor: 'pointer',
                boxShadow: '0 4px 15px rgba(226, 55, 68, 0.3)',
                transition: 'transform 0.2s, box-shadow 0.2s',
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = '0 6px 20px rgba(226, 55, 68, 0.4)';
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 4px 15px rgba(226, 55, 68, 0.3)';
              }}
            >
              Reboot App
            </button>
            
            <a
              href="/"
              style={{
                flex: 1,
                maxWidth: '180px',
                padding: '14px 28px',
                borderRadius: '12px',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                background: 'rgba(255, 255, 255, 0.05)',
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
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
                e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)';
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)';
              }}
            >
              Go to Home
            </a>
          </div>

          {/* Diagnostic Logs */}
          {!isProduction && (
          <div style={{ width: '100%', textAlign: 'left' }}>
            <button
              onClick={() => setShowLogs(!showLogs)}
              style={{
                width: '100%',
                background: 'none',
                border: 'none',
                color: '#71717a',
                fontSize: '13px',
                fontWeight: 500,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px 16px',
                borderRadius: '8px',
                backgroundColor: 'rgba(255, 255, 255, 0.02)',
                transition: 'color 0.2s, background 0.2s',
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.color = '#a1a1aa';
                e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.04)';
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.color = '#71717a';
                e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.02)';
              }}
            >
              <span>Telemetry Diagnostic Details</span>
              <span>{showLogs ? '▲' : '▼'}</span>
            </button>

            {showLogs && (
              <div style={{
                marginTop: '12px',
                padding: '16px',
                borderRadius: '12px',
                backgroundColor: '#0a0a0f',
                border: '1px solid rgba(255, 255, 255, 0.05)',
                maxHeight: '200px',
                overflowY: 'auto',
                fontFamily: 'SFMono-Regular, Consolas, "Liberation Mono", Menlo, monospace',
                fontSize: '12px',
                color: '#f43f5e',
                lineHeight: '1.5',
                whiteSpace: 'pre-wrap',
              }}>
                <div><strong>Error Signature:</strong> {error.name || 'RuntimeException'}</div>
                <div style={{ marginTop: '4px' }}><strong>Trace Code:</strong> {error.digest || 'ERR-TR-UNRESOLVED'}</div>
                <div style={{ marginTop: '4px', color: '#e4e4e7' }}><strong>Message:</strong> {error.message || 'No specific description provided.'}</div>
                {error.stack && (
                  <div style={{ marginTop: '8px', color: '#71717a', fontSize: '11px', borderTop: '1px solid rgba(255, 255, 255, 0.05)', paddingTop: '8px' }}>
                    {error.stack.split('\n').slice(0, 5).join('\n')}
                  </div>
                )}
              </div>
            )}
          </div>
          )}
          {isProduction && error.digest && (
          <div style={{ width: '100%', textAlign: 'center', marginTop: 16 }}>
            <p style={{ fontSize: 13, color: '#71717a' }}>Error reference: {error.digest}</p>
          </div>
          )}
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
