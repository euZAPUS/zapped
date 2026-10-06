// Tiny static server for the promo page: serves promo/, the built app assets and a themes.css
// derived from the app's own tokens, so the video uses the real colours.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const dist = path.join(here, 'out', 'css', 'assets');
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2', '.woff': 'font/woff', '.svg': 'image/svg+xml' };

export function appCss() {
  const f = fs.readdirSync(dist).find((n) => n.endsWith('.css'));
  if (!f) throw new Error('Run `npm run promo:css` first: no stylesheet found');
  return f;
}

function themesCss() {
  const tokens = fs.readFileSync(path.join(root, 'src', 'styles', 'tokens.css'), 'utf8');
  // :root[data-theme='x'] -> [data-ptheme='x'] so any element can carry a theme
  return tokens.replace(/:root\[data-theme='(\w+)'\]/g, "[data-ptheme='$1']").replace(/:root\[data-font='(\w+)'\]/g, "[data-pfont='$1']");
}

export function startServer(port = 0) {
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://x');
    let file;
    if (url.pathname === '/') {
      const html = fs.readFileSync(path.join(here, 'index.html'), 'utf8').replace('__APP_CSS__', appCss());
      res.writeHead(200, { 'content-type': 'text/html' }).end(html);
      return;
    }
    if (url.pathname === '/themes.css') {
      res.writeHead(200, { 'content-type': 'text/css' }).end(themesCss());
      return;
    }
    if (url.pathname.startsWith('/assets/')) file = path.join(dist, path.basename(url.pathname));
    else file = path.join(here, url.pathname);
    if (!file.startsWith(here) && !file.startsWith(dist)) return res.writeHead(403).end();
    fs.readFile(file, (err, data) => {
      if (err) return res.writeHead(404).end('not found');
      res.writeHead(200, { 'content-type': types[path.extname(file)] ?? 'application/octet-stream' }).end(data);
    });
  });
  return new Promise((resolve) => server.listen(port, '127.0.0.1', () => resolve({ server, port: server.address().port })));
}
