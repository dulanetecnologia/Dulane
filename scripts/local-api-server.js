// Minimal local stand-in for the Vercel serverless runtime: serves the same
// handlers under /api over plain Node http, so the quote form can be tested
// end-to-end (npm start + npm run api) without a Vercel account/login.
// Production still runs these same handler files on Vercel itself.
const http = require('http');
const { existsSync, readFileSync } = require('fs');
const path = require('path');

const PORT = 3557;

function loadEnvLocal() {
  const envPath = path.join(__dirname, '..', '.env.local');
  if (!existsSync(envPath)) return;

  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
    if (!match) continue;

    let [, key, value = ''] = match;
    value = value.trim().replace(/^(['"])(.*)\1$/, '$2');
    process.env[key] = value;
  }
}

loadEnvLocal();

const handlers = {
  '/api/send-email': require('../api/send-email'),
};

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (chunk) => (raw += chunk));
    req.on('end', () => {
      if (!raw) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch (error) {
        reject(error);
      }
    });
    req.on('error', reject);
  });
}

const server = http.createServer(async (req, res) => {
  const handler = handlers[req.url];
  if (!handler) {
    res.writeHead(404).end('Not found');
    return;
  }

  // The handlers were written for Vercel's Express-like req/res, which plain
  // Node http doesn't provide on its own.
  res.status = (code) => {
    res.statusCode = code;
    return res;
  };
  res.json = (body) => {
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(body));
  };

  try {
    req.body = req.method === 'POST' ? await readJsonBody(req) : undefined;
  } catch {
    res.status(400).json({ error: 'JSON inválido' });
    return;
  }

  await handler(req, res);
});

server.listen(PORT, () => {
  console.log(`Local API ready at http://localhost:${PORT}`);
});
