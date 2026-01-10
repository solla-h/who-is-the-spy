/**
 * API Router for Who is the Spy game
 */

import type { Env } from './index';
import { createRoom, joinRoom } from './api/room';

export async function handleRequest(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname;
  const method = request.method;

  // Add CORS headers
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  // Handle preflight requests
  if (method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Room routes
    if (path === '/api/room/create' && method === 'POST') {
      const result = await createRoom(request, env);
      const status = result.success ? 200 : getErrorStatus(result.code);
      return jsonResponse(result, status, corsHeaders);
    }
    
    if (path === '/api/room/join' && method === 'POST') {
      const result = await joinRoom(request, env);
      const status = result.success ? 200 : getErrorStatus(result.code);
      return jsonResponse(result, status, corsHeaders);
    }
    
    // Room state route
    const stateMatch = path.match(/^\/api\/room\/([^/]+)\/state$/);
    if (stateMatch && method === 'GET') {
      // TODO: Implement in task 5.1
      return jsonResponse({ error: 'Not implemented' }, 501, corsHeaders);
    }
    
    // Room action route
    const actionMatch = path.match(/^\/api\/room\/([^/]+)\/action$/);
    if (actionMatch && method === 'POST') {
      // TODO: Implement in later tasks
      return jsonResponse({ error: 'Not implemented' }, 501, corsHeaders);
    }

    return jsonResponse({ error: 'Not found' }, 404, corsHeaders);
  } catch (error) {
    console.error('Request error:', error);
    return jsonResponse({ error: 'Internal server error' }, 500, corsHeaders);
  }
}

/**
 * Get HTTP status code from error code
 */
function getErrorStatus(code?: string): number {
  switch (code) {
    case 'INVALID_INPUT':
      return 400;
    case 'NOT_AUTHORIZED':
      return 401;
    case 'WRONG_PASSWORD':
      return 401;
    case 'ROOM_NOT_FOUND':
    case 'PLAYER_NOT_FOUND':
      return 404;
    case 'GAME_IN_PROGRESS':
    case 'DUPLICATE_NAME':
    case 'INVALID_PHASE':
    case 'INVALID_ACTION':
      return 409;
    case 'DATABASE_ERROR':
    default:
      return 500;
  }
}

/**
 * Create JSON response with headers
 */
function jsonResponse(
  data: unknown,
  status = 200,
  additionalHeaders: Record<string, string> = {}
): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...additionalHeaders,
    },
  });
}
