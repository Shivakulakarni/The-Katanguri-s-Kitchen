'use client';

import React, { useState, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import StitchesRegistry from './StitchesRegistry';
import { ErrorBoundary } from './components/ErrorBoundary';
import { useAdminAuthStore } from '../lib/auth-store';
import { styled, globalCss } from '@kitchen/shared';
import {
  LayoutDashboard,
  ChefHat,
  ClipboardList,
  Package,
  Zap,
  TrendingUp,
  Bot,
  MessageSquare,
  Users,
  Utensils,
  Sliders,
  MapPin,
  Map,
  Camera,
  Link2,
  Activity,
  ShieldAlert,
  RefreshCw,
  Settings,
  ChevronRight,
  ChevronLeft,
  X,
  Menu as MenuIcon
} from 'lucide-react';

const globalStyles = globalCss({
  body: {
    margin: 0,
    padding: 0,
    fontFamily: '$system',
    backgroundColor: '$background',
    color: '$text',
    boxSizing: 'border-box',
    WebkitFontSmoothing: 'antialiased',
  },
  '*, *::before, *::after': {
    boxSizing: 'inherit',
  },
  '@media (max-width: 768px)': {
    '.sidebar-desktop': {
      // Mobile sidebar visibility controlled by React state via inline styles
    },
    '.admin-main': {
      marginLeft: 0,
      width: '100%',
    },
  },
});

const LayoutContainer = styled('div', {
  display: 'flex',
  minHeight: '100vh',
});

const Sidebar = styled('aside', {
  background: 'linear-gradient(180deg, #1e2538 0%, #111521 100%)',
  color: '#ffffff',
  padding: '$6 0',
  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
  display: 'flex',
  flexDirection: 'column',
  boxShadow: '4px 0 24px rgba(0, 0, 0, 0.15)',
  borderRight: '1px solid rgba(255, 255, 255, 0.05)',
  variants: {
    collapsed: {
      true: {
        width: '72px',
      },
      false: {
        width: '260px',
      },
    },
  },
});

const SidebarHeader = styled('div', {
  padding: '0 $5',
  marginBottom: '$8',
  fontWeight: '$bold',
  letterSpacing: '0.5px',
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  textAlign: 'center',
  variants: {
    collapsed: {
      true: {
        fontSize: '$5',
        justifyContent: 'center',
        padding: '0',
      },
      false: {
        fontSize: '$4',
        textAlign: 'left',
        background: 'linear-gradient(90deg, #ffffff 0%, #a4b0be 100%)',
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
      },
    },
  },
});

const NavList = styled('nav', {
  display: 'flex',
  flexDirection: 'column',
  gap: '4px',
});

const navItemStyles = {
  display: 'flex',
  alignItems: 'center',
  padding: '12px 18px',
  color: '#a4b0be',
  textDecoration: 'none',
  fontSize: '14px',
  fontWeight: 500,
  transition: 'all 0.2s ease',
  borderLeft: '4px solid transparent',
  gap: '12px',
  borderRadius: '0 8px 8px 0',
  marginRight: '12px',
} as const;

const navItemCollapsedStyles = {
  ...navItemStyles,
  justifyContent: 'center',
  gap: 0,
  padding: '12px',
  marginRight: 0,
  borderRadius: '8px',
  margin: '2px 8px',
} as const;

const CollapseButton = styled('button', {
  marginTop: 'auto',
  padding: '$3',
  background: 'none',
  border: 'none',
  color: '$textMuted',
  cursor: 'pointer',
  fontSize: '$3',
  fontWeight: '$semibold',
  transition: '$all',
  textAlign: 'center',
  width: '100%',
  '&:hover': {
    color: '#ffffff',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
});

const Main = styled('main', {
  flex: 1,
  padding: '$5',
  backgroundColor: '$surface',
  overflowY: 'auto',
});

const navItems = [
  { href: '/',              label: 'Dashboard',              icon: <LayoutDashboard size={18} /> },
  { href: '/kds',           label: 'Kitchen (KDS)',          icon: <ChefHat size={18} /> },
  { href: '/orders',        label: 'Orders',                 icon: <ClipboardList size={18} /> },
  { href: '/inventory',     label: 'Inventory',              icon: <Package size={18} /> },
  { href: '/automation',    label: 'Automation',             icon: <Zap size={18} /> },
  { href: '/analytics',     label: 'Analytics',              icon: <TrendingUp size={18} /> },
  { href: '/ai-insights',   label: 'AI Insights',            icon: <Bot size={18} /> },
  { href: '/ai-chat',       label: 'AI Manager Chat',        icon: <MessageSquare size={18} /> },
  { href: '/customers',     label: 'Customers',              icon: <Users size={18} /> },
  { href: '/menu',          label: 'Menu',                   icon: <Utensils size={18} /> },
  { href: '/menu-modifiers', label: 'Modifiers',             icon: <Sliders size={18} /> },
  { href: '/delivery',      label: 'Delivery Zones',         icon: <MapPin size={18} /> },
  { href: '/riders',         label: 'Live Rider Map',         icon: <Map size={18} /> },
  { href: '/photos',        label: 'Photos',                 icon: <Camera size={18} /> },
  { href: '/webhooks',      label: 'Webhooks',               icon: <Link2 size={18} /> },
  { href: '/webhooks/analytics', label: 'WH Analytics',      icon: <TrendingUp size={18} /> },
  { href: '/webhooks/health', label: 'WH Health',            icon: <Activity size={18} /> },
  { href: '/webhooks/alerts', label: 'WH Alerts',            icon: <ShieldAlert size={18} /> },
  { href: '/webhooks/replay', label: 'WH Replay',            icon: <RefreshCw size={18} /> },
  { href: '/settings',      label: 'Settings',               icon: <Settings size={18} /> },
];

export default function AdminShell({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const user = useAdminAuthStore(s => s.user);
  const isLoading = useAdminAuthStore(s => s.isLoading);

  globalStyles();

  const pathname = usePathname();
  const router = useRouter();
  const isLoginPage = pathname === '/login';

  // Determine if we're on mobile via media query
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const mql = window.matchMedia('(max-width: 768px)');
    setIsMobile(mql.matches);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, []);

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!isLoading && !isLoginPage && !user) {
      router.push('/login');
    }
  }, [user, isLoading, isLoginPage, router]);

  // Show nothing while checking auth (avoids flash of sidebar)
  if (!isLoginPage && (isLoading || !user)) {
    return (
      <StitchesRegistry>
        <main style={{ minHeight: '100vh', background: '#f5f6fa', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ textAlign: 'center', color: '#999' }}>Checking authentication...</div>
        </main>
      </StitchesRegistry>
    );
  }

  if (isLoginPage) {
    return (
      <StitchesRegistry>
        <main style={{ minHeight: '100vh', background: '#f5f6fa', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {children}
        </main>
      </StitchesRegistry>
    );
  }

  return (
    <StitchesRegistry>
      {/* Mobile Header */}
      <div className="mobile-header" style={{
            display: isMobile ? 'flex' : 'none', position: 'sticky', top: 0, zIndex: 200,
            background: 'linear-gradient(180deg, #1e2538 0%, #111521 100%)',
            color: '#ffffff', padding: '0 16px', height: 56,
            alignItems: 'center', justifyContent: 'space-between',
            borderBottom: '1px solid rgba(255,255,255,0.05)',
          }}>
            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={mobileOpen}
              style={{ background: 'none', border: 'none', color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 4 }}
            >
              {mobileOpen ? <X size={20} /> : <MenuIcon size={20} />}
            </button>
            <span style={{ fontWeight: 700, fontSize: 16 }}>Admin Panel</span>
            <div style={{ width: 32 }} />
          </div>

          {/* Mobile Overlay */}
          {mobileOpen && (
            <div
              onClick={() => setMobileOpen(false)}
              style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 150 }}
              aria-hidden="true"
            />
          )}

          <LayoutContainer>
            {/* Mobile Sidebar (slides in) */}
            <Sidebar
              collapsed={false}
              className="sidebar-desktop"
              aria-label="Admin navigation"
              style={{
                position: isMobile ? 'fixed' : undefined,
                top: isMobile ? 0 : undefined,
                left: isMobile ? 0 : undefined,
                bottom: isMobile ? 0 : undefined,
                zIndex: isMobile ? 300 : undefined,
                transform: isMobile ? (mobileOpen ? 'translateX(0)' : 'translateX(-100%)') : undefined,
                display: isMobile && !mobileOpen ? 'none' : undefined,
              }}
            >
              <SidebarHeader collapsed={collapsed}>
                {collapsed ? (
                  <div style={{ display: 'flex', justifyContent: 'center' }}>
                    <img src="/logo-kitchen.png" alt="Logo" style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover', border: '2px solid rgba(255,255,255,0.3)' }} />
                  </div>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <img src="/logo-kitchen.png" alt="Logo" style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover', border: '2px solid rgba(255,255,255,0.3)', flexShrink: 0 }} />
                    <span>The Katanguri's Kitchen</span>
                  </div>
                )}
              </SidebarHeader>
              <NavList aria-label="Admin links">
                {navItems.map(item => {
                  const isActive = pathname === item.href;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      aria-current={isActive ? 'page' : undefined}
                      onClick={() => setMobileOpen(false)}
                      style={{
                        ...(collapsed ? navItemCollapsedStyles : navItemStyles),
                        ...(isActive ? {
                          color: '#ffffff',
                          backgroundColor: 'rgba(255, 71, 87, 0.15)',
                          borderLeftColor: '#ff4757',
                          fontWeight: 700,
                        } : {}),
                      }}
                      onMouseEnter={e => {
                        if (!isActive) {
                          (e.currentTarget as HTMLAnchorElement).style.color = '#ffffff';
                          (e.currentTarget as HTMLAnchorElement).style.backgroundColor = 'rgba(255,255,255,0.08)';
                          (e.currentTarget as HTMLAnchorElement).style.borderLeftColor = 'rgba(255, 71, 87, 0.5)';
                        }
                      }}
                      onMouseLeave={e => {
                        if (!isActive) {
                          (e.currentTarget as HTMLAnchorElement).style.color = '#a4b0be';
                          (e.currentTarget as HTMLAnchorElement).style.backgroundColor = 'transparent';
                          (e.currentTarget as HTMLAnchorElement).style.borderLeftColor = 'transparent';
                        }
                      }}
                      onFocus={e => {
                        if (!isActive) {
                          (e.currentTarget as HTMLAnchorElement).style.outline = '2px solid #ff4757';
                          (e.currentTarget as HTMLAnchorElement).style.outlineOffset = '2px';
                        }
                      }}
                      onBlur={e => {
                        if (!isActive) {
                          (e.currentTarget as HTMLAnchorElement).style.outline = 'none';
                        }
                      }}
                    >
                      <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>{item.icon}</span>
                      {!collapsed && <span>{item.label}</span>}
                    </Link>
                  );
                })}
              </NavList>
              <CollapseButton onClick={() => setCollapsed(!collapsed)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                {collapsed ? <ChevronRight size={18} /> : <><ChevronLeft size={18} /> Collapse</>}
              </CollapseButton>
            </Sidebar>
            <Main className="admin-main">
              <ErrorBoundary pageName="Admin">
                {children}
              </ErrorBoundary>
            </Main>
          </LayoutContainer>
    </StitchesRegistry>
  );
}
