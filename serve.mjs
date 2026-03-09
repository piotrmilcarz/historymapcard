/**
 * Minimal static HTTP server used by Playwright integration tests.
 * Serves the project root at http://127.0.0.1:3737
 * with permissive CORS headers so ES module imports work across paths.
 *
 * Usage:  node serve.mjs
 */
import { createServer } from 'http';
import { readFileSync, existsSync, statSync } from 'fs';
import { extname, join, resolve } from 'path';
import { fileURLToPath } from 'url';

const ROOT = resolve(fileURLToPath(import.meta.url), '..');
const PORT = 3737;

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js':   'text/javascript; charset=utf-8',
  '.mjs':  'text/javascript; charset=utf-8',
  '.ts':   'text/typescript; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.png':  'image/png',
  '.svg':  'image/svg+xml',
  '.json': 'application/json; charset=utf-8',
};

const server = createServer((req, res) => {
  const safePath = req.url.split('?')[0].replace(/\.\./g, '');
  const filePath = join(ROOT, safePath);

  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Cross-Origin-Opener-Policy': 'same-origin',
  };

  if (!existsSync(filePath)) {
    res.writeHead(404, headers);
    res.end('Not found');
    return;
  }

  if (statSync(filePath).isDirectory()) {
    // Return 200 for directory requests (used by Playwright's webServer health check)
    res.writeHead(200, { ...headers, 'Content-Type': 'text/plain' });
    res.end('OK');
    return;
  }

  const mime = MIME_TYPES[extname(filePath)] ?? 'application/octet-stream';
  res.writeHead(200, { ...headers, 'Content-Type': mime });
  res.end(readFileSync(filePath));
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`Test server listening on http://127.0.0.1:${PORT}`);
});
