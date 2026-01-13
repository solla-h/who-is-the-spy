import { handleRequest } from './router';
import { syncWordPairs } from './sync-words';
import { getAssetFromKV, NotFoundError, MethodNotAllowedError } from '@cloudflare/kv-asset-handler';

export interface Env {
  DB: D1Database;
  __STATIC_CONTENT: KVNamespace;
}

// Manifest for static assets (injected by wrangler)
// @ts-ignore
import manifestJSON from '__STATIC_CONTENT_MANIFEST';

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    // Sync word pairs on first request (lazy initialization)
    ctx.waitUntil(syncWordPairs(env.DB));

    // Handle API routes
    if (url.pathname.startsWith('/api/')) {
      return handleRequest(request, env);
    }

    // Serve static files from KV
    try {
      // Parse the manifest
      const manifest = JSON.parse(manifestJSON);

      return await getAssetFromKV(
        {
          request,
          waitUntil: ctx.waitUntil.bind(ctx),
        },
        {
          ASSET_NAMESPACE: env.__STATIC_CONTENT,
          ASSET_MANIFEST: manifest,
          // Serve index.html for root path
          mapRequestToAsset: (req) => {
            const url = new URL(req.url);
            // Serve index.html for root path or paths without extension
            if (url.pathname === '/' || !url.pathname.includes('.')) {
              return new Request(`${url.origin}/index.html`, req);
            }
            return req;
          },
        }
      );
    } catch (e) {
      console.error('Static asset handling error:', e);
      if (e instanceof NotFoundError) {
        // For SPA routing, serve index.html for any non-file path
        try {
          const manifest = JSON.parse(manifestJSON);
          return await getAssetFromKV(
            {
              request: new Request(`${url.origin}/index.html`, request),
              waitUntil: ctx.waitUntil.bind(ctx),
            },
            {
              ASSET_NAMESPACE: env.__STATIC_CONTENT,
              ASSET_MANIFEST: manifest,
            }
          );
        } catch (spaError) {
          console.error('SPA fallback error:', spaError);
          return new Response('Not Found', { status: 404 });
        }
      } else if (e instanceof MethodNotAllowedError) {
        return new Response('Method Not Allowed', { status: 405 });
      }

      const errorMessage = e instanceof Error ? e.message : String(e);
      const errorStack = e instanceof Error ? e.stack : '';
      return new Response(`Internal Server Error: ${errorMessage}\n${errorStack}`, { status: 500 });
    }
  },

  // Scheduled handler for room cleanup (runs every hour)
  async scheduled(_event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(cleanupInactiveRooms(env.DB));
  },
};

/**
 * Clean up rooms that have been inactive for more than 24 hours
 * Requirements: 12.2
 */
async function cleanupInactiveRooms(db: D1Database): Promise<void> {
  const twentyFourHoursAgo = Date.now() - 24 * 60 * 60 * 1000;

  try {
    // Delete rooms that haven't been updated in 24 hours
    // CASCADE will automatically delete related players, descriptions, and votes
    await db.prepare(`
      DELETE FROM rooms 
      WHERE updated_at < ?
    `).bind(twentyFourHoursAgo).run();

    console.log('Room cleanup completed successfully');
  } catch (error) {
    console.error('Room cleanup failed:', error);
  }
}
