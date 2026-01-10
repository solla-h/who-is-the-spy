/**
 * Room API handlers for Who is the Spy game
 * Requirements: 1.1, 1.2, 1.3, 1.4, 2.1, 2.2, 2.3, 2.4, 3.1, 3.2, 3.4
 */

import type { Env } from '../index';
import {
  CreateRoomRequest,
  CreateRoomResponse,
  JoinRoomRequest,
  JoinRoomResponse,
  ErrorCode,
  RoomRow,
  PlayerRow,
  GameSettings,
} from '../types';
import { validatePassword, validatePlayerName, validateRoomCode } from '../utils/validation';
import { generateUniqueRoomCode } from '../utils/room-code';
import { hashPassword, verifyPassword } from '../utils/password';

/**
 * Generate a UUID v4
 */
function generateUUID(): string {
  return crypto.randomUUID();
}

/**
 * Get current timestamp in milliseconds
 */
function now(): number {
  return Date.now();
}

/**
 * Default game settings
 */
const DEFAULT_SETTINGS: GameSettings = {
  spyCount: 1,
  minPlayers: 3,
  maxPlayers: 20,
};

/**
 * POST /api/room/create
 * Creates a new game room
 * 
 * Requirements:
 * - 1.1: Generate unique 6-digit room code
 * - 1.2: Require 4-8 character password
 * - 1.3: Set creator as room host
 * - 1.4: Initialize room in waiting phase
 */
export async function createRoom(
  request: Request,
  env: Env
): Promise<CreateRoomResponse> {
  try {
    // Parse request body
    const body = await request.json() as CreateRoomRequest;
    const { password, playerName } = body;

    // Validate password (Requirements 1.2)
    if (!validatePassword(password)) {
      return {
        success: false,
        error: '密码必须是4-8个字符',
        code: ErrorCode.INVALID_INPUT,
      };
    }

    // Validate player name (Requirements 3.1, 3.4)
    if (!validatePlayerName(playerName)) {
      return {
        success: false,
        error: '昵称必须是2-10个非空白字符',
        code: ErrorCode.INVALID_INPUT,
      };
    }

    // Generate unique room code (Requirements 1.1)
    const roomCode = await generateUniqueRoomCode(env.DB);

    // Hash password
    const passwordHash = await hashPassword(password);

    // Generate IDs
    const roomId = generateUUID();
    const playerId = generateUUID();
    const playerToken = generateUUID();
    const timestamp = now();

    // Create room (Requirements 1.3, 1.4)
    await env.DB.prepare(`
      INSERT INTO rooms (id, code, password_hash, phase, host_id, settings, created_at, updated_at)
      VALUES (?, ?, ?, 'waiting', ?, ?, ?, ?)
    `).bind(
      roomId,
      roomCode,
      passwordHash,
      playerId,
      JSON.stringify(DEFAULT_SETTINGS),
      timestamp,
      timestamp
    ).run();

    // Create host player
    await env.DB.prepare(`
      INSERT INTO players (id, room_id, token, name, last_seen, join_order)
      VALUES (?, ?, ?, ?, ?, 0)
    `).bind(playerId, roomId, playerToken, playerName, timestamp).run();

    return {
      success: true,
      roomCode,
      roomId,
      playerToken,
    };
  } catch (error) {
    console.error('Create room error:', error);
    return {
      success: false,
      error: '创建房间失败，请重试',
      code: ErrorCode.DATABASE_ERROR,
    };
  }
}

/**
 * POST /api/room/join
 * Joins an existing room or reconnects
 * 
 * Requirements:
 * - 2.1: Valid room code + correct password → success
 * - 2.2: Incorrect password → rejection
 * - 2.3: Non-existent room → rejection
 * - 2.4: Game in progress → rejection for new players
 * - 3.2: Player name must be unique in room
 */
export async function joinRoom(
  request: Request,
  env: Env
): Promise<JoinRoomResponse> {
  try {
    // Parse request body
    const body = await request.json() as JoinRoomRequest;
    const { roomCode, password, playerName, playerToken } = body;

    // Validate room code
    if (!validateRoomCode(roomCode)) {
      return {
        success: false,
        error: '房间号必须是6位数字',
        code: ErrorCode.INVALID_INPUT,
      };
    }

    // Validate password
    if (!validatePassword(password)) {
      return {
        success: false,
        error: '密码必须是4-8个字符',
        code: ErrorCode.INVALID_INPUT,
      };
    }

    // Validate player name
    if (!validatePlayerName(playerName)) {
      return {
        success: false,
        error: '昵称必须是2-10个非空白字符',
        code: ErrorCode.INVALID_INPUT,
      };
    }

    // Find room by code (Requirements 2.3)
    const room = await env.DB.prepare(`
      SELECT * FROM rooms WHERE code = ?
    `).bind(roomCode).first<RoomRow>();

    if (!room) {
      return {
        success: false,
        error: '房间不存在',
        code: ErrorCode.ROOM_NOT_FOUND,
      };
    }

    // Verify password (Requirements 2.2)
    const passwordValid = await verifyPassword(password, room.password_hash);
    if (!passwordValid) {
      return {
        success: false,
        error: '密码错误',
        code: ErrorCode.WRONG_PASSWORD,
      };
    }

    // Check for reconnection with existing token
    if (playerToken) {
      const existingPlayer = await env.DB.prepare(`
        SELECT * FROM players WHERE token = ? AND room_id = ?
      `).bind(playerToken, room.id).first<PlayerRow>();

      if (existingPlayer) {
        // Update last seen and online status
        await env.DB.prepare(`
          UPDATE players SET is_online = 1, last_seen = ? WHERE id = ?
        `).bind(now(), existingPlayer.id).run();

        return {
          success: true,
          roomId: room.id,
          playerToken: existingPlayer.token,
          isReconnect: true,
        };
      }
    }

    // Check if game is in progress (Requirements 2.4)
    if (room.phase !== 'waiting') {
      return {
        success: false,
        error: '游戏已开始，无法加入',
        code: ErrorCode.GAME_IN_PROGRESS,
      };
    }

    // Check for duplicate name (Requirements 3.2)
    const existingName = await env.DB.prepare(`
      SELECT 1 FROM players WHERE room_id = ? AND name = ?
    `).bind(room.id, playerName).first();

    if (existingName) {
      return {
        success: false,
        error: '该昵称已被使用，请换一个',
        code: ErrorCode.DUPLICATE_NAME,
      };
    }

    // Get current player count for join_order
    const playerCount = await env.DB.prepare(`
      SELECT COUNT(*) as count FROM players WHERE room_id = ?
    `).bind(room.id).first<{ count: number }>();

    // Create new player
    const newPlayerId = generateUUID();
    const newPlayerToken = generateUUID();
    const timestamp = now();

    await env.DB.prepare(`
      INSERT INTO players (id, room_id, token, name, last_seen, join_order)
      VALUES (?, ?, ?, ?, ?, ?)
    `).bind(
      newPlayerId,
      room.id,
      newPlayerToken,
      playerName,
      timestamp,
      playerCount?.count ?? 0
    ).run();

    // Update room timestamp
    await env.DB.prepare(`
      UPDATE rooms SET updated_at = ? WHERE id = ?
    `).bind(timestamp, room.id).run();

    return {
      success: true,
      roomId: room.id,
      playerToken: newPlayerToken,
      isReconnect: false,
    };
  } catch (error) {
    console.error('Join room error:', error);
    return {
      success: false,
      error: '加入房间失败，请重试',
      code: ErrorCode.DATABASE_ERROR,
    };
  }
}
