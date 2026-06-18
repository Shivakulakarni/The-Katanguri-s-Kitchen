'use client';

import React from 'react';

/* ═══════════════════════════════════════════════════
   DESIGN TOKENS — The Katanguri's Kitchen Admin
   ═══════════════════════════════════════════════════ */

export const T = {
  // Core palette
  ink:       '#0f172a',
  inkSoft:   '#1e293b',
  slate:     '#334155',
  steel:     '#64748b',
  muted:     '#94a3b8',
  hairline:  '#e2e8f0',
  ghost:     '#f1f5f9',
  snow:      '#f8fafc',
  white:     '#ffffff',
  surface:   '#f1f4f7',
  text:      '#2f3542',
  textMuted: '#747d8c',

  // Accent
  primary:   '#ff4757',
  primaryBg: 'rgba(255,71,87,0.08)',
  success:   '#16a34a',
  successBg: '#dcfce7',
  warning:   '#f59e0b',
  warningBg: '#fef3c7',
  danger:    '#dc2626',
  dangerBg:  '#fee2e2',
  info:      '#2563eb',
  infoBg:    '#dbeafe',

  // Radius
  r1: 6, r2: 8, r3: 12, r4: 16, r5: 20, r6: 24,

  // Shadows
  shadowSm: '0 1px 3px rgba(0,0,0,0.06)',
  shadowMd: '0 4px 12px rgba(0,0,0,0.07)',
  shadowLg: '0 8px 24px rgba(0,0,0,0.08)',
} as const;

/* ═══════════════════════════════════════════════════
   PageHeader — consistent top section for every page
   ═══════════════════════════════════════════════════ */

type PageHeaderProps = {
  icon?: string;
  title: string;
  subtitle?: React.ReactNode;
  right?: React.ReactNode;
};

export function PageHeader({ icon, title, subtitle, right }: PageHeaderProps) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28 }}>
      <div>
        <h1 style={{
          fontFamily: 'Outfit, sans-serif', fontSize: 28, fontWeight: 800,
          color: T.ink, letterSpacing: '-0.5px', margin: 0,
        }}>
          {icon && <span style={{ marginRight: 10 }}>{icon}</span>}
          {title}
        </h1>
        {subtitle && (
          <div style={{ fontSize: 14, color: T.steel, marginTop: 4, fontWeight: 500 }}>{subtitle}</div>
        )}
      </div>
      {right && <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>{right}</div>}
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   Card — unified container
   ═══════════════════════════════════════════════════ */

type CardProps = {
  children: React.ReactNode;
  padding?: number | string;
  dark?: boolean;
  style?: React.CSSProperties;
};

export function Card({ children, padding = 24, dark = false, style }: CardProps) {
  return (
    <div style={{
      background: dark ? T.ink : T.white,
      borderRadius: T.r4,
      padding,
      border: dark ? 'none' : `1px solid ${T.hairline}`,
      boxShadow: dark ? T.shadowLg : T.shadowSm,
      ...style,
    }}>
      {children}
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   SectionTitle — card section headings
   ═══════════════════════════════════════════════════ */

type SectionTitleProps = {
  icon?: string;
  title: string;
  subtitle?: string | React.ReactNode;
  value?: string | number;
  right?: React.ReactNode;
  color?: string;
};

export function SectionTitle({ icon, title, subtitle, value, right, color }: SectionTitleProps) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
      <div>
        <h2 style={{
          fontFamily: 'Outfit, sans-serif', fontSize: 17, fontWeight: 700,
          color: color || T.ink, margin: 0,
        }}>
          {icon && <span style={{ marginRight: 8 }}>{icon}</span>}
          {title}
          {value !== undefined && <span style={{ marginLeft: 8, color: T.steel, fontWeight: 500, fontSize: 14 }}>({value})</span>}
        </h2>
        {subtitle && <div style={{ fontSize: 12, color: T.steel, marginTop: 4 }}>{subtitle}</div>}
      </div>
      {right}
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   Badge — status pills
   ═══════════════════════════════════════════════════ */

type BadgeVariant = 'default' | 'success' | 'warning' | 'danger' | 'info' | 'muted' | 'primary';

const BADGE_STYLES: Record<BadgeVariant, { bg: string; color: string; border?: string }> = {
  default: { bg: T.ghost, color: T.steel },
  success: { bg: T.successBg, color: '#166534', border: '#bbf7d0' },
  warning: { bg: T.warningBg, color: '#92400e', border: '#fde68a' },
  danger:  { bg: T.dangerBg,  color: '#991b1b', border: '#fca5a5' },
  info:    { bg: T.infoBg,    color: '#1e40af', border: '#bfdbfe' },
  muted:   { bg: T.ghost,     color: T.muted },
  primary: { bg: T.primaryBg,  color: T.primary, border: 'rgba(255,71,87,0.2)' },
};

type BadgeProps = {
  variant?: BadgeVariant;
  children: React.ReactNode;
  pulse?: boolean;
  style?: React.CSSProperties;
};

export function Badge({ variant = 'default', children, pulse, style }: BadgeProps) {
  const s = BADGE_STYLES[variant];
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      padding: '4px 12px', borderRadius: T.r5, fontSize: 12, fontWeight: 700,
      background: s.bg, color: s.color, border: s.border ? `1px solid ${s.border}` : 'none',
      whiteSpace: 'nowrap',
      ...style,
    }}>
      {pulse && <span style={{
        width: 7, height: 7, borderRadius: '50%', background: 'currentColor',
        animation: 'uiPulse 1.5s infinite',
      }} />}
      {children}
    </span>
  );
}

/* ═══════════════════════════════════════════════════
   KpiCard — stat tiles for dashboards
   ═══════════════════════════════════════════════════ */

type KpiCardProps = {
  icon: React.ReactNode;
  label: string;
  value: string;
  change?: string;
  color: string;
  up?: boolean;
};

export function KpiCard({ icon, label, value, change, color, up }: KpiCardProps) {
  return (
    <div className="card animate" style={{
      display: 'flex', alignItems: 'center', gap: 18,
      background: T.white, padding: 20,
    }}>
      <div style={{
        width: 52, height: 52, borderRadius: T.r3, background: color,
        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24,
        flexShrink: 0,
      }}>{icon}</div>
      <div>
        <div style={{ fontSize: 11, fontWeight: 700, color: T.steel, textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: 3 }}>{label}</div>
        <div style={{ fontSize: 24, fontWeight: 800, color: T.ink, letterSpacing: '-0.4px' }}>{value}</div>
        {change && <div style={{ fontSize: 12, color: up ? T.success : T.danger, fontWeight: 600, marginTop: 2 }}>{change}</div>}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   DataTable — unified table wrapper
   ═══════════════════════════════════════════════════ */

type DataTableProps = {
  headers: string[];
  children: React.ReactNode;
  emptyIcon?: string;
  emptyText?: string;
};

export function DataTable({ headers, children, emptyIcon, emptyText }: DataTableProps) {
  return (
    <div style={{
      background: T.white, borderRadius: T.r4, overflow: 'hidden',
      border: `1px solid ${T.hairline}`, boxShadow: T.shadowSm,
    }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ background: T.snow, borderBottom: `2px solid ${T.hairline}` }}>
            {headers.map(h => (
              <th key={h} style={{
                textAlign: 'left', padding: '12px 16px', fontSize: 11,
                fontWeight: 700, color: T.muted, textTransform: 'uppercase', letterSpacing: '0.5px',
              }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
      {emptyIcon && emptyText && (
        <div style={{ textAlign: 'center', padding: 60, color: T.muted }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>{emptyIcon}</div>
          <div style={{ fontWeight: 600, color: T.steel }}>{emptyText}</div>
        </div>
      )}
    </div>
  );
}

export function Tr({ children, style, className }: { children: React.ReactNode; style?: React.CSSProperties; className?: string }) {
  return <tr style={{ borderBottom: `1px solid ${T.snow}`, ...style }} className={className}>{children}</tr>;
}

export function Td({ children, style, bold, muted, colSpan }: { children: React.ReactNode; style?: React.CSSProperties; bold?: boolean; muted?: boolean; colSpan?: number }) {
  let color: string = bold ? T.ink : T.steel;
  if (muted) color = T.muted;
  return <td colSpan={colSpan} style={{ padding: '14px 16px', fontSize: 14, fontWeight: bold ? 700 : 400, color, ...style }}>{children}</td>;
}

/* ═══════════════════════════════════════════════════
   Buttons
   ═══════════════════════════════════════════════════ */

type BtnProps = {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'success' | 'danger' | 'ghost' | 'outline';
  size?: 'sm' | 'md' | 'small';
  disabled?: boolean;
  style?: React.CSSProperties;
};

const BTN_VARIANTS = {
  primary:  { bg: T.primary, color: T.white, border: 'none' },
  success:  { bg: '#22c55e', color: T.white, border: 'none' },
  danger:   { bg: T.danger, color: T.white, border: 'none' },
  ghost:    { bg: T.ghost, color: T.steel, border: `1px solid ${T.hairline}` },
  outline:  { bg: T.white, color: T.ink, border: `1.5px solid ${T.hairline}` },
};

export function Btn({ children, onClick, variant = 'ghost', size = 'sm', disabled, style }: BtnProps) {
  const v = BTN_VARIANTS[variant];
  const isSmall = size === 'sm' || size === 'small';
  return (
    <button onClick={onClick} disabled={disabled} style={{
      padding: isSmall ? '7px 16px' : '10px 22px',
      borderRadius: T.r2, border: v.border,
      background: v.bg, color: v.color,
      cursor: disabled ? 'not-allowed' : 'pointer',
      fontWeight: 700, fontSize: isSmall ? 12 : 13,
      opacity: disabled ? 0.5 : 1,
      transition: 'all 0.15s',
      fontFamily: 'inherit',
      ...style,
    }}>
      {children}
    </button>
  );
}

/* ═══════════════════════════════════════════════════
   FilterBar — pill-style status filters
   ═══════════════════════════════════════════════════ */

type FilterBarProps = {
  options?: { label: string; value: string; color?: string; border?: string }[];
  active?: string;
  onChange?: (v: string) => void;
  children?: React.ReactNode;
};

export function FilterBar({ options, active, onChange, children }: FilterBarProps) {
  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
      {children ? children : options?.map(opt => {
        const isActive = active === opt.value;
        return (
          <button key={opt.value} onClick={() => onChange?.(opt.value)} style={{
            padding: '6px 16px', borderRadius: T.r5,
            border: `1.5px solid ${isActive ? (opt.border || T.primary) : T.hairline}`,
            background: isActive ? (opt.color || T.primaryBg) : T.white,
            color: isActive ? (opt.border || T.primary) : T.steel,
            cursor: 'pointer', fontWeight: isActive ? 700 : 500, fontSize: 12,
            whiteSpace: 'nowrap', transition: 'all 0.15s', fontFamily: 'inherit',
          }}>
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   StatusBadge — order/inventory status with colors
   ═══════════════════════════════════════════════════ */

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
  const s = STATUS_COLORS[status] || { bg: T.ghost, color: T.steel, border: T.hairline };
  return (
    <span style={{
      padding: '4px 12px', borderRadius: T.r5, fontSize: 11, fontWeight: 700,
      background: s.bg, color: s.text, border: `1px solid ${s.border}`,
      whiteSpace: 'nowrap',
    }}>
      {status.replace(/_/g, ' ')}
    </span>
  );
}

/* ═══════════════════════════════════════════════════
   Input / FormField
   ═══════════════════════════════════════════════════ */

type FieldProps = {
  label: string;
  value?: string;
  onChange?: (v: string) => void;
  type?: string;
  placeholder?: string;
  children?: React.ReactNode;
};

export function Field({ label, value, onChange, type = 'text', placeholder, children }: FieldProps) {
  return (
    <div>
      <label style={{ fontSize: 12, fontWeight: 700, color: T.steel, marginBottom: 5, display: 'block' }}>{label}</label>
      {children ? children : (
        <input type={type} value={value ?? ''} onChange={e => onChange?.(e.target.value)} placeholder={placeholder}
          style={{
            width: '100%', padding: '10px 14px', border: `1.5px solid ${T.hairline}`,
            borderRadius: T.r2, fontSize: 14, outline: 'none', boxSizing: 'border-box' as const,
            transition: 'border-color 0.15s',
            fontFamily: 'inherit',
          }}
          onFocus={e => { (e.target as HTMLInputElement).style.borderColor = T.primary; }}
          onBlur={e => { (e.target as HTMLInputElement).style.borderColor = T.hairline; }}
        />
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   Global Animations
   ═══════════════════════════════════════════════════ */

export const AdminStyles = () => (
  <style>{`
    @keyframes uiPulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
    @keyframes uiFlash { 0%{background:#fef9c3} 100%{background:transparent} }
    @keyframes uiSlideDown { from{opacity:0;transform:translateY(-8px)} to{opacity:1;transform:translateY(0)} }
    .ui-flash { animation: uiFlash 1.5s ease; }
    .ui-slide { animation: uiSlideDown 0.25s ease; }
  `}</style>
);
