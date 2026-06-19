'use client';

import React from 'react';

type BadgeVariant = 'default' | 'success' | 'warning' | 'danger' | 'info' | 'primary';

const BADGE_STYLES: Record<BadgeVariant, { bg: string; color: string; border?: string }> = {
  default: { bg: '#f1f5f9', color: '#64748b' },
  success: { bg: '#dcfce7', color: '#166534', border: '#bbf7d0' },
  warning: { bg: '#fef3c7', color: '#92400e', border: '#fde68a' },
  danger: { bg: '#fee2e2', color: '#991b1b', border: '#fca5a5' },
  info: { bg: '#dbeafe', color: '#1e40af', border: '#bfdbfe' },
  primary: { bg: 'rgba(226,55,68,0.08)', color: '#e23744', border: 'rgba(226,55,68,0.2)' },
};

interface BadgeProps {
  variant?: BadgeVariant;
  children: React.ReactNode;
  pulse?: boolean;
  style?: React.CSSProperties;
}

export function Badge({ variant = 'default', children, pulse, style }: BadgeProps) {
  const s = BADGE_STYLES[variant];
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      padding: '4px 12px', borderRadius: 100, fontSize: 12, fontWeight: 700,
      background: s.bg, color: s.color,
      border: s.border ? `1px solid ${s.border}` : 'none',
      whiteSpace: 'nowrap',
      ...style,
    }}>
      {pulse && <span style={{
        width: 7, height: 7, borderRadius: '50%', background: 'currentColor',
        animation: 'kitchenPulse 1.5s infinite',
      }} />}
      {children}
    </span>
  );
}

const STATUS_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  PENDING:          { bg: '#fef3c7', text: '#92400e', border: '#fde68a' },
  CONFIRMED:        { bg: '#dbeafe', text: '#1e40af', border: '#bfdbfe' },
  PREPARING:        { bg: '#ede9fe', text: '#5b21b6', border: '#ddd6fe' },
  READY:            { bg: '#cffafe', text: '#155e75', border: '#a5f3fc' },
  OUT_FOR_DELIVERY: { bg: '#dcfce7', text: '#14532d', border: '#86efac' },
  DELIVERED:        { bg: '#f0fdf4', text: '#166534', border: '#bbf7d0' },
  CANCELLED:        { bg: '#fee2e2', text: '#991b1b', border: '#fca5a5' },
  OK:               { bg: '#dcfce7', text: '#166534', border: '#bbf7d0' },
  LOW:              { bg: '#fef3c7', text: '#92400e', border: '#fde68a' },
  OUT:              { bg: '#fee2e2', text: '#991b1b', border: '#fca5a5' },
  CRITICAL:         { bg: '#fee2e2', text: '#991b1b', border: '#fca5a5' },
};

export function StatusBadge({ status }: { status: string }) {
  const s = STATUS_COLORS[status] || { bg: '#f1f5f9', text: '#64748b', border: '#e2e8f0' };
  return (
    <span style={{
      padding: '4px 12px', borderRadius: 100, fontSize: 11, fontWeight: 700,
      background: s.bg, color: s.text, border: `1px solid ${s.border}`,
      whiteSpace: 'nowrap',
    }}>
      {status.replace(/_/g, ' ')}
    </span>
  );
}
