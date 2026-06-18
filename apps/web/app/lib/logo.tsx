'use client';

import { useState } from 'react';

export default function Logo({ size = 28 }: { size?: number }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        width: size,
        height: size,
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        transform: hovered ? 'scale(1.05)' : 'scale(1)',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
      }}
    >
      <img
        src="/logo-kitchen.png"
        alt="The Katanguri's Kitchen Logo"
        width={size}
        height={size}
        style={{
          objectFit: 'contain',
          borderRadius: '50%',
        }}
      />
    </div>
  );
}
