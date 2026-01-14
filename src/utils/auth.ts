/**
 * Authentication and authorization utilities
 * Extracts common validation logic to reduce code duplication
 */

import type { Env } from '../index';
import { RoomRow, PlayerRow, GamePhase, ErrorCode } from '../types';

interface ActionResult {
  success: boolean;
  error?: string;
  code?: ErrorCode;
}

export interface AuthContext {
  room: RoomRow;
  player: PlayerRow;
  isHost: boolean;
}

export interface AuthResult extends ActionResult {
  context?: AuthContext;
}

export interface AuthOptions {
  requireHost?: boolean;
  allowedPhases?: GamePhase[];
}

/**
 * Authenticate a player action and optionally verify host permissions
 * 
 * @param roomId - The room ID
 * @param playerToken - The player's token
 * @param env - Cloudflare environment
 * @param options - Optional requirements (host check, phase check)
 * @returns AuthResult with context if successful
 */
export async function authenticateAction(
  roomId: string,
  playerToken: string,
  env: Env,
  options: AuthOptions = {}
): Promise<AuthResult> {
  const { requireHost = false, allowedPhases } = options;

  // Get room
  const room = await env.DB.prepare(`
    SELECT * FROM rooms WHERE id = ?
  `).bind(roomId).first<RoomRow>();

  if (!room) {
    return {
      success: false,
      error: '房间不存在',
      code: ErrorCode.ROOM_NOT_FOUND,
    };
  }

  // Get player
  const player = await env.DB.prepare(`
    SELECT * FROM players WHERE token = ? AND room_id = ?
  `).bind(playerToken, roomId).first<PlayerRow>();

  if (!player) {
    return {
      success: false,
      error: '玩家不存在',
      code: ErrorCode.PLAYER_NOT_FOUND,
    };
  }

  const isHost = player.id === room.host_id;

  // Check host requirement
  if (requireHost && !isHost) {
    return {
      success: false,
      error: '只有房主可以执行此操作',
      code: ErrorCode.NOT_AUTHORIZED,
    };
  }

  // Check phase requirement
  if (allowedPhases && !allowedPhases.includes(room.phase)) {
    return {
      success: false,
      error: '当前游戏阶段不允许此操作',
      code: ErrorCode.INVALID_PHASE,
    };
  }

  return {
    success: true,
    context: { room, player, isHost },
  };
}
