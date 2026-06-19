'use client';

import React from 'react';

type ButtonVariant = 'primary' | 'success' | 'danger' | 'ghost' | 'outline';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  icon?: React.ReactNode;
}

const VARIANT_STYLES: Record<ButtonVariant, React.CSSProperties> = {
  primary: { background: '#e23744', color: '#fff', border: 'none' },
  success: { background: '#16a34a', color: '#fff', border: 'none' },
  danger: { background: '#dc2626', color: '#fff', border: 'none' },
  ghost: { background: '#f1f5f9', color: '#475569', border: '1px solid #e2e8f0' },
  outline: { background: '#fff', color: '#1c1c1c', border: '1.5px solid #e2e8f0' },
};

const SIZE_STYLES: Record<ButtonSize, React.CSSProperties> = {
  sm: { padding: '7px 16px', fontSize: 12, minHeight: 32 },
  md: { padding: '10px 20px', fontSize: 14, minHeight: 40 },
  lg: { padding: '12px 28px', fontSize: 15, minHeight: 48 },
};

export function Button({
  variant = 'ghost', size = 'md', loading, icon, disabled, children, style, ...props
}: ButtonProps) {
  const v = VARIANT_STYLES[variant];
  const s = SIZE_STYLES[size];

  return (
    <button
      disabled={disabled || loading}
      style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        borderRadius: 8, fontWeight: 700, cursor: disabled || loading ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1, transition: 'all 0.15s', fontFamily: 'inherit',
        whiteSpace: 'nowrap',
        ...v, ...s, ...style,
      }}
      {...props}
    >
      {loading ? (
        <span style={{
          width: 16, height: 16, border: '2px solid currentColor', borderTopColor: 'transparent',
          borderRadius: '50%', animation: 'kitchenSpin 0.6s linear infinite',
          display: 'inline-block',
        }} />
      ) : icon}
      {children}
    </button>
  );
}
