/**
 * API Router for Who is the Spy game
 */

import type { Env } from './index';
import { createRoom, joinRoom } from './api/room';
import { addBot } from './api/bot';
import { getProviders } from './api/providers';
import { getAllProviders, addProvider, updateProvider, deleteProvider } from './api/admin';
import { getRoomState } from './api/state';
import { startGame, submitDescription, skipPlayer, startVoting, confirmWord, confirmWordPlayer, submitVote, finalizeVoting, continueGame, restartGame, updateSettings, kickPlayer } from './api/game';
import { getAILogs, getAILogStats, cleanupOldLogs } from './api/debug';

export async function handleRequest(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname;
  const method = request.method;

  // Add CORS headers
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
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

    // LLM Providers route (for dynamic provider list)
    if (path === '/api/providers' && method === 'GET') {
      const result = await getProviders(env);
      return jsonResponse(result, result.success ? 200 : 500, corsHeaders);
    }

    // Admin routes for managing providers
    if (path === '/api/admin/providers') {
      if (method === 'GET') {
        const result = await getAllProviders(request, env);
        return jsonResponse(result, result.success ? 200 : 401, corsHeaders);
      }
      if (method === 'POST') {
        const result = await addProvider(request, env);
        return jsonResponse(result, result.success ? 201 : 400, corsHeaders);
      }
    }

    const adminProviderMatch = path.match(/^\/api\/admin\/providers\/([^/]+)$/);
    if (adminProviderMatch) {
      const providerId = adminProviderMatch[1];
      if (method === 'PUT') {
        const result = await updateProvider(request, env, providerId);
        return jsonResponse(result, result.success ? 200 : 400, corsHeaders);
      }
      if (method === 'DELETE') {
        const result = await deleteProvider(request, env, providerId);
        return jsonResponse(result, result.success ? 200 : 400, corsHeaders);
      }
    }

    // ========== Debug Routes (需要管理员密码) ==========
    if (path === '/api/debug/logs' && method === 'GET') {
      const adminKey = url.searchParams.get('key');
      if (!adminKey || adminKey !== env.ADMIN_PASSWORD) {
        return jsonResponse({ success: false, error: 'Unauthorized' }, 401, corsHeaders);
      }

      const query = {
        roomId: url.searchParams.get('roomId') || undefined,
        botId: url.searchParams.get('botId') || undefined,
        status: url.searchParams.get('status') || undefined,
        limit: parseInt(url.searchParams.get('limit') || '50'),
        offset: parseInt(url.searchParams.get('offset') || '0'),
      };

      const result = await getAILogs(env, query);
      return jsonResponse(result, 200, corsHeaders);
    }

    if (path === '/api/debug/stats' && method === 'GET') {
      const adminKey = url.searchParams.get('key');
      if (!adminKey || adminKey !== env.ADMIN_PASSWORD) {
        return jsonResponse({ success: false, error: 'Unauthorized' }, 401, corsHeaders);
      }

      const roomId = url.searchParams.get('roomId') || undefined;
      const result = await getAILogStats(env, roomId);
      return jsonResponse(result, 200, corsHeaders);
    }

    if (path === '/api/debug/cleanup' && method === 'POST') {
      const adminKey = url.searchParams.get('key');
      if (!adminKey || adminKey !== env.ADMIN_PASSWORD) {
        return jsonResponse({ success: false, error: 'Unauthorized' }, 401, corsHeaders);
      }

      const daysToKeep = parseInt(url.searchParams.get('days') || '7');
      const result = await cleanupOldLogs(env, daysToKeep);
      return jsonResponse(result, 200, corsHeaders);
    }

    // Bot route
    const botMatch = path.match(/^\/api\/room\/([^/]+)\/bot$/);
    if (botMatch && method === 'POST') {
      const roomId = botMatch[1];
      const body = await request.json() as { token: string; config?: any };
      const { token, config } = body;

      if (!token) {
        return jsonResponse({ success: false, error: '缺少token参数', code: 'INVALID_INPUT' }, 400, corsHeaders);
      }

      const result = await addBot(roomId, token, env, config);
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
            const result = await confirmWord(roomId, token, env, ctx, url.origin);
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
            const result = await submitDescription(roomId, token, text, env, ctx, url.origin);
            const status = result.success ? 200 : getErrorStatus(result.code);
            return jsonResponse(result, status, corsHeaders);
          }
          case 'next-player': {
            const result = await skipPlayer(roomId, token, env, ctx, url.origin);
            const status = result.success ? 200 : getErrorStatus(result.code);
            return jsonResponse(result, status, corsHeaders);
          }
          case 'start-voting': {
            const result = await startVoting(roomId, token, env, ctx, url.origin);
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
            const result = await continueGame(roomId, token, env, ctx, url.origin);
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
