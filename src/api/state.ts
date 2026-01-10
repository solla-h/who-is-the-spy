/**
 * Room State API handler for Who is the Spy game
 * Requirements: 5.6, 9.3, 9.4, 9.5
 */

import type { Env } from '../index';
import {
  RoomRow,
  PlayerRow,
  DescriptionRow,
  VoteRow,
  GamePhase,
  GameSettings,
  GameState,
  PlayerInfo,
  RoomStateResponse,
  ErrorCode,
} from '../types';

interface GetRoomStateResult {
  success: boolean;
  state?: RoomStateResponse;
  error?: string;
  code?: ErrorCode;
}

/**
 * GET /api/room/:id/state
 * Gets the current room state for a player
 * 
 * Requirements:
 * - 5.6: Each player can only see their own word
 * - 9.3: Player token stored in localStorage
 * - 9.4: Reconnect with token restores identity
 * - 9.5: Reconnect without valid token treated as new player
 */
export async function getRoomState(
  roomId: string,
  token: string,
  env: Env
): Promise<GetRoomStateResult> {
  try {
    // Find room
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

    // Find requesting player by token
    const requestingPlayer = await env.DB.prepare(`
      SELECT * FROM players WHERE token = ? AND room_id = ?
    `).bind(token, roomId).first<PlayerRow>();

    if (!requestingPlayer) {
      return {
        success: false,
        error: '玩家不存在或token无效',
        code: ErrorCode.PLAYER_NOT_FOUND,
      };
    }

    // Update player's last seen and online status
    await env.DB.prepare(`
      UPDATE players SET is_online = 1, last_seen = ? WHERE id = ?
    `).bind(Date.now(), requestingPlayer.id).run();

    // Get all players in the room
    const playersResult = await env.DB.prepare(`
      SELECT * FROM players WHERE room_id = ? ORDER BY join_order ASC
    `).bind(roomId).all<PlayerRow>();
    const players = playersResult.results || [];

    // Get descriptions for current round
    const descriptionsResult = await env.DB.prepare(`
      SELECT d.*, p.name as player_name FROM descriptions d
      JOIN players p ON d.player_id = p.id
      WHERE d.room_id = ? ORDER BY d.created_at ASC
    `).bind(roomId).all<DescriptionRow & { player_name: string }>();
    const descriptions = descriptionsResult.results || [];

    // Get votes for current round
    const votesResult = await env.DB.prepare(`
      SELECT * FROM votes WHERE room_id = ? AND round = ?
    `).bind(roomId, room.round).all<VoteRow>();
    const votes = votesResult.results || [];

    // Parse settings and game state
    const settings: GameSettings = JSON.parse(room.settings);
    const gameState: GameState | null = room.game_state ? JSON.parse(room.game_state) : null;

    // Build player info list
    const playerInfos: PlayerInfo[] = players.map((p) => {
      const info: PlayerInfo = {
        id: p.id,
        name: p.name,
        isHost: p.id === room.host_id,
        isAlive: p.is_alive === 1,
        isOnline: p.is_online === 1,
        hasVoted: votes.some((v) => v.voter_id === p.id),
        hasDescribed: descriptions.some((d) => d.player_id === p.id && d.round === room.round),
      };

      // Only reveal roles when game is over (Requirements 5.6)
      if (room.phase === 'game-over' && p.role) {
        info.role = p.role;
      }

      return info;
    });

    // Build response
    const state: RoomStateResponse = {
      roomId: room.id,
      roomCode: room.code,
      phase: room.phase,
      players: playerInfos,
      currentTurn: room.current_turn,
      round: room.round,
      descriptions: descriptions.map((d) => ({
        playerId: d.player_id,
        playerName: d.player_name,
        text: d.text,
        round: d.round,
      })),
      votes: room.phase === 'result' || room.phase === 'game-over'
        ? votes.map((v) => ({
            oderId: v.voter_id,
            targetId: v.target_id,
            round: v.round,
          }))
        : [], // Only show votes after voting is complete
      settings,
      isHost: requestingPlayer.id === room.host_id,
    };

    // Add player's own word (Requirements 5.6 - only their own word)
    if (room.phase !== 'waiting' && requestingPlayer.role) {
      state.myRole = requestingPlayer.role;
      // Give the appropriate word based on role
      if (requestingPlayer.role === 'civilian' && room.civilian_word) {
        state.myWord = room.civilian_word;
      } else if (requestingPlayer.role === 'spy' && room.spy_word) {
        state.myWord = room.spy_word;
      }
    }

    // Add game result if game is over
    if (room.phase === 'game-over' && gameState?.winner) {
      state.result = {
        winner: gameState.winner,
      };
    }

    // Add elimination result if in result phase
    if (room.phase === 'result' && gameState?.eliminatedPlayers) {
      const lastEliminated = gameState.eliminatedPlayers[gameState.eliminatedPlayers.length - 1];
      if (lastEliminated) {
        state.result = {
          eliminatedPlayerId: lastEliminated,
        };
      }
    }

    return {
      success: true,
      state,
    };
  } catch (error) {
    console.error('Get room state error:', error);
    return {
      success: false,
      error: '获取房间状态失败',
      code: ErrorCode.DATABASE_ERROR,
    };
  }
}

/**
 * Build a sanitized room state that hides sensitive information
 * This ensures word visibility isolation (Property 9)
 */
export function sanitizeRoomState(
  state: RoomStateResponse,
  requestingPlayerId: string
): RoomStateResponse {
  // The state is already sanitized in getRoomState
  // This function can be used for additional sanitization if needed
  return state;
}
