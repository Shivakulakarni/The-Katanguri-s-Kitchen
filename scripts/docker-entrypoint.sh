#!/bin/sh
set -e

echo "[Startup] Running database migrations..."

# Run SQL migration files directly using Node.js with createRequire for ESM compatibility
node --input-type=commonjs - <<'MIGRATION_EOF'
const postgres = require('postgres');
const fs = require('fs');
const path = require('path');

async function migrate() {
  const client = postgres(process.env.DATABASE_URL, { max: 1 });

  await client.unsafe(`
    CREATE TABLE IF NOT EXISTS _drizzle_migrations (
      id SERIAL PRIMARY KEY,
      hash TEXT NOT NULL UNIQUE,
      created_at BIGINT DEFAULT EXTRACT(EPOCH FROM NOW()) * 1000
    )
  `);

  const migDir = path.join(path.resolve('.'), 'drizzle');
  if (!fs.existsSync(migDir)) {
    console.log('[Migration] No migration directory found — skipping.');
    await client.end();
    return;
  }

  const files = fs.readdirSync(migDir)
    .filter(f => f.endsWith('.sql'))
    .sort();

  for (const file of files) {
    const hash = file;
    const rows = await client.unsafe(
      'SELECT id FROM _drizzle_migrations WHERE hash = $1', [hash]
    );
    if (rows.length > 0) {
      console.log('[Migration] Already applied:', file);
      continue;
    }

    console.log('[Migration] Applying:', file);
    const sql = fs.readFileSync(path.join(migDir, file), 'utf8');
    const statements = sql.split('--> statement-breakpoint');
    for (const stmt of statements) {
      const trimmed = stmt.trim();
      if (trimmed) await client.unsafe(trimmed);
    }

    await client.unsafe(
      'INSERT INTO _drizzle_migrations (hash) VALUES ($1)', [hash]
    );
    console.log('[Migration] Applied:', file);
  }

  await client.end();
  console.log('[Migration] All migrations complete.');
}

migrate().catch(err => {
  console.error('[Migration] FAILED:', err.message);
  process.exit(1);
});
MIGRATION_EOF

echo "[Startup] Starting API server..."
exec node dist/index.js
