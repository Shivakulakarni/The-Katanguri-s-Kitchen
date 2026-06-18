'use client';

import { useState, useEffect } from 'react';

export default function ThemeToggle({ mobile = false }: { mobile?: boolean }) {
  const [dark, setDark] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem('theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const isDark = stored ? stored === 'dark' : prefersDark;
    setDark(isDark);
    document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
    setMounted(true);
  }, []);

  const toggle = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.setAttribute('data-theme', next ? 'dark' : 'light');
    localStorage.setItem('theme', next ? 'dark' : 'light');
  };

  if (mobile) {
    return (
      <button onClick={toggle} aria-label="Toggle dark mode" style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        gap: 2, fontSize: 10, color: 'var(--stone)', fontWeight: 700,
        background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', padding: 0,
      }}>
        <span style={{ fontSize: 20 }}>{!mounted ? '🌙' : dark ? '☀️' : '🌙'}</span>
        Theme
      </button>
    );
  }

  return (
    <button
      onClick={toggle}
      aria-label={!mounted ? 'Switch to dark mode' : dark ? 'Switch to light mode' : 'Switch to dark mode'}
      style={{
        width: 44, height: 44, minWidth: 44, minHeight: 44, borderRadius: 'var(--rounded-circle)',
        border: '1px solid var(--hairline)', background: 'var(--canvas)',
        cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 18, transition: 'all 0.15s ease', color: 'var(--ink)',
      }}
      onMouseEnter={e => { e.currentTarget.style.background = 'var(--surface-soft)'; }}
      onMouseLeave={e => { e.currentTarget.style.background = 'var(--canvas)'; }}
    >
      {!mounted ? '🌙' : dark ? '☀️' : '🌙'}
    </button>
  );
}
