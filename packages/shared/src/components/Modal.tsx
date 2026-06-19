'use client';

import React, { useEffect, useRef } from 'react';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  maxWidth?: number;
  footer?: React.ReactNode;
}

export function Modal({ open, onClose, title, children, maxWidth = 480, footer }: ModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleEscape);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  useEffect(() => {
    if (open && panelRef.current) {
      panelRef.current.focus();
    }
  }, [open]);

  if (!open) return null;

  return (
    <div
      ref={overlayRef}
      onClick={(e) => { if (e.target === overlayRef.current) onClose(); }}
      style={{
        position: 'fixed', inset: 0, zIndex: 10000,
        background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 20,
        animation: 'kitchenModalOverlayIn 0.2s ease',
      }}
    >
      <style>{`
        @keyframes kitchenModalOverlayIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes kitchenModalPanelIn {
          from { opacity: 0; transform: scale(0.95) translateY(10px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }
      `}</style>
      <div
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        style={{
          background: '#fff', borderRadius: 16, width: '100%', maxWidth,
          maxHeight: 'calc(100vh - 40px)', overflow: 'auto',
          boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
          animation: 'kitchenModalPanelIn 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
          outline: 'none',
        }}
      >
        {title && (
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '20px 24px 0 24px',
          }}>
            <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#1c1c1c' }}>{title}</h3>
            <button
              onClick={onClose}
              aria-label="Close"
              style={{
                width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: 'transparent', border: 'none', borderRadius: 8, cursor: 'pointer',
                fontSize: 20, color: '#767676',
              }}
            >
              ×
            </button>
          </div>
        )}
        <div style={{ padding: title ? '16px 24px 24px 24px' : '24px' }}>
          {children}
        </div>
        {footer && (
          <div style={{
            display: 'flex', justifyContent: 'flex-end', gap: 10,
            padding: '16px 24px', borderTop: '1px solid #e5e7eb',
          }}>
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'primary';
}

export function ConfirmDialog({
  open, onClose, onConfirm, title, message,
  confirmLabel = 'Confirm', cancelLabel = 'Cancel', variant = 'danger',
}: ConfirmDialogProps) {
  const confirmColor = variant === 'danger' ? '#dc2626' : '#e23744';

  return (
    <Modal open={open} onClose={onClose} title={title} maxWidth={400}>
      <p style={{ margin: 0, fontSize: 14, color: '#555', lineHeight: 1.6 }}>{message}</p>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
        <button
          onClick={onClose}
          style={{
            padding: '10px 20px', borderRadius: 8, border: '1px solid #e5e7eb',
            background: '#fff', color: '#333', fontWeight: 600, fontSize: 14,
            cursor: 'pointer', fontFamily: 'inherit', minHeight: 44,
          }}
        >
          {cancelLabel}
        </button>
        <button
          onClick={() => { onConfirm(); onClose(); }}
          style={{
            padding: '10px 20px', borderRadius: 8, border: 'none',
            background: confirmColor, color: '#fff', fontWeight: 700, fontSize: 14,
            cursor: 'pointer', fontFamily: 'inherit', minHeight: 44,
          }}
        >
          {confirmLabel}
        </button>
      </div>
    </Modal>
  );
}
