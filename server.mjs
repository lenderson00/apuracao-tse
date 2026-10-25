/**
 * Static file server with TSE API proxy (no CORS in browser).
 * Usage: npm run build && node server.mjs
 */
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { request as httpsRequest } from 'node:https';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const DIST = join(__dirname, 'dist');
const PORT = Number(process.env.PORT) || 4321;
const TSE = 'resultados.tse.jus.br';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
};

function proxyTse(path, res) {
  const opts = {
    hostname: TSE,
    path,
    method: 'GET',
    headers: { Accept: 'application/json' },
  };
  httpsRequest(opts, (upstream) => {
    res.writeHead(upstream.statusCode ?? 502, {
      'Content-Type': upstream.headers['content-type'] ?? 'application/json',
      'Cache-Control': 'public, max-age=30',
    });
    upstream.pipe(res);
  }).on('error', () => {
    res.writeHead(502);
    res.end('Proxy error');
  }).end();
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', `http://${req.headers.host}`);

  if (url.pathname.startsWith('/api/tse/')) {
    proxyTse(url.pathname.replace('/api/tse', ''), res);
    return;
  }

  let filePath = join(DIST, url.pathname === '/' ? 'index.html' : url.pathname);
  try {
    const st = await stat(filePath);
    if (st.isDirectory()) filePath = join(filePath, 'index.html');
    const ext = extname(filePath);
    res.writeHead(200, { 'Content-Type': MIME[ext] ?? 'application/octet-stream' });
    createReadStream(filePath).pipe(res);
  } catch {
    try {
      const fallback = join(DIST, 'index.html');
      const html = await readFile(fallback);
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(html);
    } catch {
      res.writeHead(404);
      res.end('Not found');
    }
  }
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`http://127.0.0.1:${PORT}`);
});
