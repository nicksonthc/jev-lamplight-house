import type { IncomingMessage, ServerResponse } from 'node:http';
import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
// Explicit `.ts` here and down this one import chain: Vite's native config
// loader cannot resolve an extensionless specifier, and this is the only
// application code the config itself pulls in.
import { judgeHouse, type GatewayCredentials } from './src/server/judge.ts';

/**
 * `POST /api/jev` on the dev and preview servers. Production gets the same
 * handler from `api/jev.ts`; this is here so the page is not a different page
 * locally, and so the credential stays in the Node process either way — both
 * variables are read without a `VITE_` prefix precisely so that Vite cannot
 * inline them into the browser bundle.
 *
 * `VERCEL_OIDC_TOKEN` is what `vercel link` writes into `.env.local`, and is
 * the credential a free account can actually use; `AI_GATEWAY_API_KEY` is the
 * override. `src/server/judge.ts` decides between them.
 */
const jevApi = (credentials: GatewayCredentials): Plugin => {
  const handle = async (req: IncomingMessage, res: ServerResponse, next: () => void) => {
    if (!req.url?.split('?')[0].endsWith('/api/jev')) return next();
    if (req.method !== 'POST') {
      res.writeHead(405, { allow: 'POST' }).end('Method Not Allowed');
      return;
    }
    const chunks: Buffer[] = [];
    for await (const chunk of req) chunks.push(chunk as Buffer);
    let body: unknown = {};
    try {
      body = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
    } catch {
      // An unparseable body judges an all-off house, which is a fine answer.
    }
    const reply = await judgeHouse(body, credentials);
    res.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' });
    res.end(JSON.stringify(reply));
  };
  return {
    name: 'jev-api',
    configureServer: (server) => void server.middlewares.use(handle),
    configurePreviewServer: (server) => void server.middlewares.use(handle),
  };
};

export default defineConfig(({ mode }) => {
  // The empty prefix loads every variable, not just `VITE_`; neither
  // credential leaves this Node process.
  const env = loadEnv(mode, process.cwd(), '');

  return {
    plugins: [
      react(),
      tailwindcss(),
      jevApi({ oidcToken: env.VERCEL_OIDC_TOKEN, apiKey: env.AI_GATEWAY_API_KEY }),
    ],
    build: {
      rollupOptions: {
        output: {
          // Three.js and the React renderer dominate the bundle; splitting
          // them keeps the application chunk small enough to iterate on.
          manualChunks(id: string) {
            if (id.includes('node_modules/three')) return 'three';
            if (/node_modules\/(react|react-dom|scheduler)\//.test(id)) return 'react';
          },
        },
      },
    },
  };
});
