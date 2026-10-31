import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

// Deliberately serve only the encrypted artifact, never the repository or .private.
const index = fileURLToPath(new URL('../dist/index.html', import.meta.url));
const server = http.createServer(async (request, response) => {
  if (!['GET','HEAD'].includes(request.method)) { response.writeHead(405).end(); return; }
  const pathname = new URL(request.url,'http://localhost').pathname;
  if (!['/', '/index.html', '/Majung/', '/Majung/index.html', '/large-text/'].includes(pathname)) {
    response.writeHead(404).end('Not found'); return;
  }
  try {
    const html = await readFile(pathname === '/large-text/' ? fileURLToPath(new URL('../.private/large-text.html',import.meta.url)) : index);
    response.writeHead(200, {'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff'});
    response.end(request.method === 'HEAD' ? undefined : html);
  } catch { response.writeHead(503).end('Run npm run demo or npm run build first.'); }
});
server.listen(4173,'127.0.0.1',()=>console.log('Local: http://127.0.0.1:4173/Majung/'));
