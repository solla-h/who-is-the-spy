import type { Env } from './index';

export async function handleRequest(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname;
  const method = request.method;

  try {
    // Room routes
    if (path === '/api/room/create' && method === 'POST') {
      // TODO: Implement in task 4.1
      return jsonResponse({ error: 'Not implemented' }, 501);
    }
    
    if (path === '/api/room/join' && method === 'POST') {
      // TODO: Implement in task 4.3
      return jsonResponse({ error: 'Not implemented' }, 501);
    }
    
    // Room state route
    const stateMatch = path.match(/^\/api\/room\/([^/]+)\/state$/);
    if (stateMatch && method === 'GET') {
      // TODO: Implement in task 5.1
      return jsonResponse({ error: 'Not implemented' }, 501);
    }
    
    // Room action route
    const actionMatch = path.match(/^\/api\/room\/([^/]+)\/action$/);
    if (actionMatch && method === 'POST') {
      // TODO: Implement in later tasks
      return jsonResponse({ error: 'Not implemented' }, 501);
    }

    return jsonResponse({ error: 'Not found' }, 404);
  } catch (error) {
    console.error('Request error:', error);
    return jsonResponse({ error: 'Internal server error' }, 500);
  }
}

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
