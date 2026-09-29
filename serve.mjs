import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = dirname(fileURLToPath(import.meta.url));
const files = new Map([
  ['/', ['index.html', 'text/html; charset=utf-8']],
  ['/index.html', ['index.html', 'text/html; charset=utf-8']],
  ['/style.css', ['style.css', 'text/css; charset=utf-8']],
  ['/demo.js', ['demo.js', 'text/javascript; charset=utf-8']],
  ['/core.js', ['core.js', 'text/javascript; charset=utf-8']],
  ['/gamification.js', ['gamification.js', 'text/javascript; charset=utf-8']]
]);

createServer(async (request, response) => {
  const route = new URL(request.url, 'http://localhost').pathname;
  const file = files.get(route);
  if (!file) {
    response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    response.end('Not found');
    return;
  }
  try {
    const content = await readFile(join(root, file[0]));
    response.writeHead(200, { 'content-type': file[1], 'cache-control': 'no-cache' });
    response.end(content);
  } catch {
    response.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' });
    response.end('Unable to read demo file');
  }
}).listen(Number(process.env.DEMO_PORT || 8000), '127.0.0.1', () => console.log(`Demo: http://localhost:${process.env.DEMO_PORT || 8000}/`));
