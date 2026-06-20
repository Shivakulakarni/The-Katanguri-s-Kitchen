// boot.mjs — Pure JavaScript boot file, loaded BEFORE any TypeScript/ESM imports
// This file is NOT compiled by TypeScript. It runs instantly as-is.
// Render scans for open ports — this file opens the port in <50ms.

import { createServer } from 'node:http';

const PORT = parseInt(process.env.PORT || '10000', 10);

const server = createServer((_req, res) => {
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ status: 'ok', service: 'kitchen-api', bootstrapping: true }));
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`[BOOT] Port ${PORT} opened in <50ms — Render health check should pass`);
  // Store reference so the main app can close it before Fastify binds
  globalThis.__bootServer = server;

  // Now load the actual application (all heavy imports happen here, AFTER port is open)
  import('./dist/index.js').catch((err) => {
    console.error('[BOOT] Fatal: Failed to load application:', err);
    process.exit(1);
  });
});
