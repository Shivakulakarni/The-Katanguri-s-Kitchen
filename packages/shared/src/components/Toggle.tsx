'use client';

interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  label?: string;
  size?: 'sm' | 'md';
}

export function Toggle({ checked, onChange, disabled, label, size = 'md' }: ToggleProps) {
  const isSmall = size === 'sm';
  const trackW = isSmall ? 36 : 44;
  const trackH = isSmall ? 20 : 24;
  const knobSize = isSmall ? 16 : 20;
  const knobOffset = isSmall ? 2 : 2;

  return (
    <label
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 10,
        cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.5 : 1,
        userSelect: 'none',
      }}
    >
      <button
        role="switch"
        aria-checked={checked}
        onClick={() => !disabled && onChange(!checked)}
        style={{
          position: 'relative', width: trackW, height: trackH,
          borderRadius: trackH, border: 'none', cursor: disabled ? 'not-allowed' : 'pointer',
          background: checked ? '#e23744' : '#d1d5db',
          transition: 'background 0.2s',
          padding: 0, flexShrink: 0,
        }}
      >
        <span
          style={{
            position: 'absolute',
            top: knobOffset,
            left: checked ? trackW - knobSize - knobOffset : knobOffset,
            width: knobSize, height: knobSize,
            borderRadius: '50%', background: '#fff',
            boxShadow: '0 1px 3px rgba(0,0,0,0.15)',
            transition: 'left 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
          }}
        />
      </button>
      {label && <span style={{ fontSize: 14, fontWeight: 500, color: '#333' }}>{label}</span>}
    </label>
  );
}
