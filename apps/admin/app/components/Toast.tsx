'use client';

import { useToastStore, type Toast as ToastItem } from '../../lib/toast-store';

const TOAST_STYLES: Record<string, { bg: string; border: string; icon: string }> = {
  success: { bg: '#f0fdf4', border: '#86efac', icon: '✓' },
  error: { bg: '#fef2f2', border: '#fca5a5', icon: '✕' },
  warning: { bg: '#fffbeb', border: '#fcd34d', icon: '⚠' },
  info: { bg: '#eff6ff', border: '#93c5fd', icon: 'ℹ' },
};

function ToastCard({ toastItem }: { toastItem: ToastItem }) {
  const { removeToast } = useToastStore();
  const style = TOAST_STYLES[toastItem.type] || TOAST_STYLES.info;

  return (
    <div
      role="alert"
      aria-live="assertive"
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 12,
        padding: '14px 16px',
        background: style.bg,
        border: `1px solid ${style.border}`,
        borderRadius: 12,
        boxShadow: '0 4px 24px rgba(0,0,0,0.12)',
        minWidth: 320,
        maxWidth: 420,
        animation: 'adminToastSlideIn 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
        transition: 'opacity 0.2s, transform 0.2s',
      }}
    >
      <span style={{
        width: 24, height: 24, borderRadius: '50%',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 14, fontWeight: 700, flexShrink: 0,
        background: toastItem.type === 'error' ? '#dc2626' : toastItem.type === 'success' ? '#16a34a' : toastItem.type === 'warning' ? '#d97706' : '#2563eb',
        color: '#fff',
      }}>
        {style.icon}
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: '#1c1c1c', marginBottom: toastItem.message ? 2 : 0 }}>
          {toastItem.title}
        </div>
        {toastItem.message && (
          <div style={{ fontSize: 13, color: '#666', lineHeight: 1.4, marginTop: 2 }}>
            {toastItem.message}
          </div>
        )}
        {toastItem.action && (
          <button
            onClick={() => { toastItem.action!.onClick(); removeToast(toastItem.id); }}
            style={{
              marginTop: 8, padding: '4px 12px', fontSize: 13, fontWeight: 700,
              color: '#2563eb', background: 'transparent', border: '1px solid #93c5fd',
              borderRadius: 6, cursor: 'pointer',
            }}
          >
            {toastItem.action.label}
          </button>
        )}
      </div>
      <button
        onClick={() => removeToast(toastItem.id)}
        aria-label="Dismiss notification"
        style={{
          width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 16, color: '#999', background: 'transparent', border: 'none', cursor: 'pointer',
          borderRadius: 4, flexShrink: 0, padding: 4,
        }}
        onMouseEnter={e => { (e.target as HTMLElement).style.color = '#333'; }}
        onMouseLeave={e => { (e.target as HTMLElement).style.color = '#999'; }}
      >
        ×
      </button>
    </div>
  );
}

export function ToastContainer() {
  const { toasts } = useToastStore();

  if (toasts.length === 0) return null;

  return (
    <>
      <style>{`
        @keyframes adminToastSlideIn {
          from { opacity: 0; transform: translateX(100%) scale(0.95); }
          to { opacity: 1; transform: translateX(0) scale(1); }
        }
      `}</style>
      <div
        aria-label="Notifications"
        style={{
          position: 'fixed',
          top: 80,
          right: 20,
          zIndex: 9999,
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
          pointerEvents: 'none',
        }}
      >
        {toasts.map((t) => (
          <div key={t.id} style={{ pointerEvents: 'auto' }}>
            <ToastCard toastItem={t} />
          </div>
        ))}
      </div>
    </>
  );
}
