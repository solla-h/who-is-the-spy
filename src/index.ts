import { handleRequest } from './router';
import { syncWordPairs } from './sync-words';

export interface Env {
  DB: D1Database;
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    
    // Sync word pairs on first request (lazy initialization)
    ctx.waitUntil(syncWordPairs(env.DB));
    
    // Handle API routes
    if (url.pathname.startsWith('/api/')) {
      return handleRequest(request, env);
    }
    
    // Serve static files (handled by Cloudflare Sites)
    return new Response('Not Found', { status: 404 });
  },
};
