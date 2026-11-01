import { createServer } from 'node:http';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

// Sin frameworks, plugins, base de datos ni tareas periódicas.
const PUBLIC_ROOT = resolve(fileURLToPath(new URL('../public/', import.meta.url)));
const STARTED = Date.now();
const API_VERSION = '0.1.0';
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8'
};

function sendJson(res, code, payload, head = false) {
  const body = JSON.stringify(payload);
  res.writeHead(code, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store'
  });
  res.end(head ? undefined : body);
}

async function readJson(req, maxBytes = 16_384) {
  if (!String(req.headers['content-type'] ?? '').toLowerCase().startsWith('application/json')) {
    const error = new Error('Enviá Content-Type: application/json');
    error.status = 415;
    throw error;
  }
  let size = 0;
  const chunks = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > maxBytes) {
      const error = new Error('El JSON supera el límite de 16 KB');
      error.status = 413;
      throw error;
    }
    chunks.push(chunk);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    const error = new Error('JSON no válido');
    error.status = 400;
    throw error;
  }
}

async function sendStatic(req, res, pathname) {
  let path;
  try {
    path = decodeURIComponent(pathname);
  } catch {
    return sendJson(res, 400, { ok: false, error: 'URL no válida' });
  }

  if (path.includes('\0') || path.split('/').some(p => p.startsWith('.'))) {
    return sendJson(res, 404, { ok: false, error: 'No encontrado' });
  }

  const target = resolve(PUBLIC_ROOT, '.' + (path === '/' ? '/index.html' : path));
  if (!target.startsWith(PUBLIC_ROOT + sep)) {
    return sendJson(res, 404, { ok: false, error: 'No encontrado' });
  }
  const contentType = MIME[extname(target).toLowerCase()];
  if (!contentType) {
    return sendJson(res, 404, { ok: false, error: 'No encontrado' });
  }

  try {
    const info = await stat(target);
    if (!info.isFile()) throw Object.assign(new Error('No es un archivo'), { code: 'ENOENT' });
    res.writeHead(200, {
      'Content-Type': contentType,
      'Content-Length': info.size,
      'Cache-Control': extname(target) === '.html' ? 'no-cache' : 'public, max-age=300'
    });
    if (req.method === 'HEAD') return res.end();
    createReadStream(target).on('error', () => res.destroy()).pipe(res);
  } catch (error) {
    if (error.code === 'ENOENT' || error.code === 'ENOTDIR') {
      sendJson(res, 404, { ok: false, error: 'No encontrado' }, req.method === 'HEAD');
    } else {
      throw error;
    }
  }
}

export function createApp({ limitPerMinute } = {}) {
  const parsedLimit = Number(limitPerMinute ?? process.env.RATE_LIMIT_PER_MINUTE ?? 120);
  const limit = Number.isInteger(parsedLimit) && parsedLimit > 0 ? Math.min(parsedLimit, 10000) : 120;
  const clients = new Map();

  const server = createServer(async (req, res) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'same-origin');
    res.setHeader('X-Frame-Options', 'DENY');

    try {
      const url = new URL(req.url ?? '/', 'http://localhost');
      const path = url.pathname;
      const method = req.method ?? 'GET';
      const head = method === 'HEAD';

      // Limita endpoints de API; guarda como máximo 2.048 IP en RAM.
      if (path.startsWith('/api/v1/')) {
        // Render pasa la IP del visitante en X-Forwarded-For. Solo usar
        // este encabezado detrás de un proxy de confianza (como Render).
        const forwarded = req.headers['x-forwarded-for'];
        const ip = (typeof forwarded === 'string' ? forwarded.split(',')[0]?.trim() : '')
          || req.socket.remoteAddress || 'unknown';
        const now = Date.now();
        let entry = clients.get(ip);
        if (!entry || now >= entry.expires) {
          if (!entry && clients.size >= 2048) {
            for (const [k, v] of clients) {
              if (v.expires <= now) clients.delete(k);
            }
            if (clients.size >= 2048) clients.delete(clients.keys().next().value);
          }
          entry = { count: 0, expires: now + 60_000 };
          clients.set(ip, entry);
        }
        entry.count++;
        if (entry.count > limit) {
          res.setHeader('Retry-After', String(Math.ceil((entry.expires - now) / 1000)));
          return sendJson(res, 429, { ok: false, error: 'Demasiadas solicitudes. Intentá más tarde.' }, head);
        }
      }

      if (method === 'GET' && path === '/healthz') {
        return sendJson(res, 200, { ok: true, status: 'up' });
      }
      if (method === 'GET' && (path === '/api' || path === '/api/docs')) {
        return sendJson(res, 200, {
          ok: true,
          name: 'Locos API',
          version: API_VERSION,
          endpoints: [
            { method: 'GET', path: '/healthz', description: 'Salud para Render' },
            { method: 'GET', path: '/api/v1/ping', description: 'Prueba de conexión' },
            { method: 'GET', path: '/api/v1/info', description: 'Información básica' },
            { method: 'POST', path: '/api/v1/echo', description: 'Ejemplo JSON: {"message":"hola"}' }
          ]
        });
      }
      if (method === 'GET' && path === '/api/v1/ping') {
        return sendJson(res, 200, { ok: true, message: 'pong' });
      }
      if (method === 'GET' && path === '/api/v1/info') {
        return sendJson(res, 200, {
          ok: true,
          name: 'Locos API',
          version: API_VERSION,
          uptime_seconds: Math.floor((Date.now() - STARTED) / 1000)
        });
      }
      if (method === 'POST' && path === '/api/v1/echo') {
        const data = await readJson(req);
        if (!data || typeof data !== 'object' || Array.isArray(data)
            || typeof data.message !== 'string'
            || data.message.length < 1 || data.message.length > 250) {
          return sendJson(res, 400, { ok: false, error: 'message debe ser texto de 1 a 250 caracteres' });
        }
        return sendJson(res, 200, { ok: true, message: data.message });
      }
      if (path === '/api' || path.startsWith('/api/')) {
        return sendJson(res, 404, { ok: false, error: 'Endpoint no encontrado' }, head);
      }
      if (method !== 'GET' && method !== 'HEAD') {
        return sendJson(res, 405, { ok: false, error: 'Método no permitido' }, head);
      }
      return await sendStatic(req, res, path);
    } catch (error) {
      if (res.headersSent) return res.destroy();
      if (!error.status || error.status >= 500) console.error('Error de servidor:', error);
      sendJson(res, error.status ?? 500, {
        ok: false,
        error: error.status ? error.message : 'Error interno del servidor'
      });
    }
  });

  server.requestTimeout = 15_000;
  server.headersTimeout = 20_000;
  return server;
}
