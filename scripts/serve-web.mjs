import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve('dist');
const port = Number(process.env.PORT ?? 4173);
const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.map': 'application/json',
};

const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url ?? '/', 'http://127.0.0.1');
    let pathname = decodeURIComponent(url.pathname);
    if (pathname.endsWith('/')) pathname += 'index.html';
    const filePath = path.normalize(path.join(root, pathname));
    if (!filePath.startsWith(root)) {
      response.writeHead(403).end();
      return;
    }
    let body;
    let extension;
    try {
      body = await readFile(filePath);
      extension = path.extname(filePath);
    } catch {
      body = await readFile(path.join(root, 'index.html'));
      extension = '.html';
    }
    const headers = { 'content-type': types[extension] ?? 'application/octet-stream' };
    if (path.basename(filePath) === 'sw.js' || path.basename(filePath) === 'manifest.webmanifest') {
      headers['cache-control'] = 'no-cache';
    }
    response.writeHead(200, headers);
    response.end(body);
  } catch {
    response.writeHead(500).end('failed to read export');
  }
});

server.listen(port, '127.0.0.1', () => {
  console.log(`serving dist on http://127.0.0.1:${port}`);
});
