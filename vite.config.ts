import type { IncomingMessage, ServerResponse } from 'node:http';
import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
// Explicit `.js` here and down this one import chain, pointing at the `.ts`
// files beside them — the ESM spelling that TypeScript, esbuild and Node all
// understand. It is load-bearing twice over: Vite's config loader cannot
// resolve an extensionless specifier, and Vercel transpiles each server file
// in place without rewriting its imports, so an extensionless or `.ts`
// specifier is left in the emitted `.js` and the function dies at runtime
// with ERR_MODULE_NOT_FOUND.
import { handleJevRequest } from './src/server/handler.js';
import type { GatewayCredentials } from './src/server/judge.js';

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
  const handle = (req: IncomingMessage, res: ServerResponse, next: () => void) => {
    if (!req.url?.split('?')[0].endsWith('/api/jev')) return next();
    void handleJevRequest(req, res, credentials);
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
