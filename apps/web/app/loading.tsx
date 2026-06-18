export default function Loading() {
  return (
    <div aria-live="polite" role="status" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{
          width: 48, height: 48, borderRadius: '50%', border: '3px solid var(--hairline-soft)',
          borderTopColor: 'var(--primary)', animation: 'spin 0.8s linear infinite', margin: '0 auto 16px',
        }} />
        <p style={{ fontSize: 14, color: 'var(--steel)' }}>Loading...</p>
      </div>
    </div>
  );
}
