/**
 * API Router for Who is the Spy game
 */

import type { Env } from './index';
import { createRoom, joinRoom } from './api/room';
import { addBot } from './api/bot';
import { getRoomState } from './api/state';
import { startGame, submitDescription, skipPlayer, startVoting, confirmWord, confirmWordPlayer, submitVote, finalizeVoting, continueGame, restartGame, updateSettings, kickPlayer } from './api/game';

export async function handleRequest(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
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

    // Bot route
    const botMatch = path.match(/^\/api\/room\/([^/]+)\/bot$/);
    if (botMatch && method === 'POST') {
      const roomId = botMatch[1];
      const body = await request.json() as { token: string };
      const { token } = body;

      if (!token) {
        return jsonResponse({ success: false, error: '缺少token参数', code: 'INVALID_INPUT' }, 400, corsHeaders);
      }

      const result = await addBot(roomId, token, env);
      const status = result.success ? 200 : getErrorStatus(result.code);
      return jsonResponse(result, status, corsHeaders);
    }

    // Room state route
    const stateMatch = path.match(/^\/api\/room\/([^/]+)\/state$/);
    if (stateMatch && method === 'GET') {
      const roomId = stateMatch[1];
      const token = url.searchParams.get('token');

      if (!token) {
        return jsonResponse({ success: false, error: '缺少token参数', code: 'INVALID_INPUT' }, 400, corsHeaders);
      }

      const result = await getRoomState(roomId, token, env);
      const status = result.success ? 200 : getErrorStatus(result.code);
      return jsonResponse(result, status, corsHeaders);
    }

    // Room action route
    const actionMatch = path.match(/^\/api\/room\/([^/]+)\/action$/);
    if (actionMatch && method === 'POST') {
      const roomId = actionMatch[1];

      try {
        const body = await request.json() as { token: string; action: { type: string } };
        const { token, action } = body;

        if (!token) {
          return jsonResponse({ success: false, error: '缺少token参数', code: 'INVALID_INPUT' }, 400, corsHeaders);
        }

        if (!action || !action.type) {
          return jsonResponse({ success: false, error: '缺少action参数', code: 'INVALID_INPUT' }, 400, corsHeaders);
        }

        // Handle different action types
        switch (action.type) {
          case 'start-game': {
            const result = await startGame(roomId, token, env);
            const status = result.success ? 200 : getErrorStatus(result.code);
            return jsonResponse(result, status, corsHeaders);
          }
          case 'confirm-word': {
            const result = await confirmWord(roomId, token, env, ctx);
            const status = result.success ? 200 : getErrorStatus(result.code);
            return jsonResponse(result, status, corsHeaders);
          }
          case 'confirm-word-player': {
            const result = await confirmWordPlayer(roomId, token, env);
            const status = result.success ? 200 : getErrorStatus(result.code);
            return jsonResponse(result, status, corsHeaders);
          }
          case 'submit-description': {
            const { text } = action as { type: string; text: string };
            if (!text) {
              return jsonResponse({ success: false, error: '缺少描述文本', code: 'INVALID_INPUT' }, 400, corsHeaders);
            }
            const result = await submitDescription(roomId, token, text, env, ctx);
            const status = result.success ? 200 : getErrorStatus(result.code);
            return jsonResponse(result, status, corsHeaders);
          }
          case 'next-player': {
            const result = await skipPlayer(roomId, token, env, ctx);
            const status = result.success ? 200 : getErrorStatus(result.code);
            return jsonResponse(result, status, corsHeaders);
          }
          case 'start-voting': {
            const result = await startVoting(roomId, token, env, ctx);
            const status = result.success ? 200 : getErrorStatus(result.code);
            return jsonResponse(result, status, corsHeaders);
          }
          case 'vote': {
            const { targetId } = action as { type: string; targetId: string };
            if (!targetId) {
              return jsonResponse({ success: false, error: '缺少目标玩家ID', code: 'INVALID_INPUT' }, 400, corsHeaders);
            }
            const result = await submitVote(roomId, token, targetId, env);
            const status = result.success ? 200 : getErrorStatus(result.code);
            return jsonResponse(result, status, corsHeaders);
          }
          case 'finalize-voting': {
            const result = await finalizeVoting(roomId, token, env);
            const status = result.success ? 200 : getErrorStatus(result.code);
            return jsonResponse(result, status, corsHeaders);
          }
          case 'continue-game': {
            const result = await continueGame(roomId, token, env, ctx);
            const status = result.success ? 200 : getErrorStatus(result.code);
            return jsonResponse(result, status, corsHeaders);
          }
          case 'restart-game': {
            const result = await restartGame(roomId, token, env);
            const status = result.success ? 200 : getErrorStatus(result.code);
            return jsonResponse(result, status, corsHeaders);
          }
          case 'update-settings': {
            const { settings } = action as { type: string; settings: { spyCount?: number } };
            if (!settings) {
              return jsonResponse({ success: false, error: '缺少设置参数', code: 'INVALID_INPUT' }, 400, corsHeaders);
            }
            const result = await updateSettings(roomId, token, settings, env);
            const status = result.success ? 200 : getErrorStatus(result.code);
            return jsonResponse(result, status, corsHeaders);
          }
          case 'kick-player': {
            const { playerId } = action as { type: string; playerId: string };
            if (!playerId) {
              return jsonResponse({ success: false, error: '缺少目标玩家ID', code: 'INVALID_INPUT' }, 400, corsHeaders);
            }
            const result = await kickPlayer(roomId, token, playerId, env);
            const status = result.success ? 200 : getErrorStatus(result.code);
            return jsonResponse(result, status, corsHeaders);
          }
          default:
            return jsonResponse({ success: false, error: '未知操作类型', code: 'INVALID_ACTION' }, 400, corsHeaders);
        }
      } catch (error) {
        return jsonResponse({ success: false, error: '请求格式错误', code: 'INVALID_INPUT' }, 400, corsHeaders);
      }
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
