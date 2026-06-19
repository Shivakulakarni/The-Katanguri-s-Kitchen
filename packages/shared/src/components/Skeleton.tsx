'use client';

import React from 'react';

interface SkeletonProps {
  width?: number | string;
  height?: number | string;
  borderRadius?: number | string;
  style?: React.CSSProperties;
}

export function Skeleton({ width, height = 16, borderRadius = 6, style }: SkeletonProps) {
  return (
    <>
      <style>{`
        @keyframes kitchenShimmer {
          0% { background-position: -200px 0; }
          100% { background-position: calc(200px + 100%) 0; }
        }
      `}</style>
      <div
        aria-hidden="true"
        style={{
          width, height, borderRadius,
          background: 'linear-gradient(90deg, #f0f0f0 8%, #e0e0e0 18%, #f0f0f0 33%)',
          backgroundSize: '200px 100%',
          animation: 'kitchenShimmer 1.5s infinite linear',
          ...style,
        }}
      />
    </>
  );
}

export function SkeletonCard({ lines = 3, imageHeight = 200 }: { lines?: number; imageHeight?: number }) {
  return (
    <div style={{ borderRadius: 12, overflow: 'hidden', border: '1px solid #f0f0f0' }}>
      <Skeleton width="100%" height={imageHeight} borderRadius={0} />
      <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <Skeleton width="60%" height={18} />
        {Array.from({ length: lines }).map((_, i) => (
          <Skeleton key={i} width={i === lines - 1 ? '40%' : '100%'} height={14} />
        ))}
      </div>
    </div>
  );
}

export function SkeletonTable({ rows = 5, columns = 4 }: { rows?: number; columns?: number }) {
  return (
    <div style={{ borderRadius: 12, overflow: 'hidden', border: '1px solid #f0f0f0', background: '#fff' }}>
      <div style={{ padding: '12px 16px', background: '#f9fafb', display: 'flex', gap: 16 }}>
        {Array.from({ length: columns }).map((_, i) => (
          <Skeleton key={i} width={`${100 / columns}%`} height={14} />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, row) => (
        <div key={row} style={{ padding: '14px 16px', display: 'flex', gap: 16, borderBottom: '1px solid #f5f5f5' }}>
          {Array.from({ length: columns }).map((_, col) => (
            <Skeleton key={col} width={`${100 / columns}%`} height={14} />
          ))}
        </div>
      ))}
    </div>
  );
}

export function SkeletonKpi({ count = 4 }: { count?: number }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${count}, 1fr)`, gap: 16 }}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} style={{ padding: 20, borderRadius: 12, border: '1px solid #f0f0f0', background: '#fff' }}>
          <Skeleton width={40} height={40} borderRadius={8} />
          <Skeleton width="50%" height={12} style={{ marginTop: 12 }} />
          <Skeleton width="70%" height={24} style={{ marginTop: 8 }} />
        </div>
      ))}
    </div>
  );
}
