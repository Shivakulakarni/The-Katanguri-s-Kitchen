function Error({ statusCode }: { statusCode?: number }) {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ textAlign: 'center' }}>
        <h1 style={{ fontSize: 72, fontWeight: 800, margin: 0 }}>{statusCode || 'Error'}</h1>
        <p style={{ color: '#666', marginTop: 16 }}>
          {statusCode === 404 ? 'Page not found' : 'An unexpected error occurred'}
        </p>
        <a href="/admin" style={{ color: '#ff4757', textDecoration: 'none', fontWeight: 600, marginTop: 16, display: 'inline-block' }}>
          Go to admin
        </a>
      </div>
    </div>
  );
}

Error.getInitialProps = ({ res, err }: { res: any; err: any }) => {
  const statusCode = res ? res.statusCode : err ? err.statusCode : 404;
  return { statusCode };
};

export default Error;
