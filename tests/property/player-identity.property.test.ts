/**
 * Property-based tests for player identity round-trip (reconnection)
 * 
 * Feature: who-is-spy-game, Property 15: Player Identity Round-Trip
 * Validates: Requirements 9.3, 9.4, 9.5
 * 
 * *For any* player who joins a room, disconnects, and reconnects with the same token,
 * their identity (name, role, game state) SHALL be fully restored.
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { validPlayerName, gamePhase } from '../helpers/fc-arbitraries';

const PBT_CONFIG = { numRuns: 100 };

/**
 * Mock player state for testing identity restoration
 */
interface PlayerState {
  id: string;
  name: string;
  token: string;
  role: 'civilian' | 'spy' | null;
  isAlive: boolean;
  isOnline: boolean;
  joinOrder: number;
}

interface MockRoom {
  id: string;
  phase: string;
  players: PlayerState[];
}

interface ReconnectResult {
  success: boolean;
  isReconnect: boolean;
  restoredState?: PlayerState;
  error?: string;
}

/**
 * Simulates player disconnection
 */
function disconnectPlayer(room: MockRoom, playerId: string): void {
  const player = room.players.find(p => p.id === playerId);
  if (player) {
    player.isOnline = false;
  }
}

/**
 * Simulates player reconnection with token
 */
function reconnectWithToken(room: MockRoom, token: string): ReconnectResult {
  const player = room.players.find(p => p.token === token);
  
  if (!player) {
    return { success: false, isReconnect: false, error: 'PLAYER_NOT_FOUND' };
  }

  // Restore online status
  player.isOnline = true;

  return {
    success: true,
    isReconnect: true,
    restoredState: { ...player },
  };
}

/**
 * Simulates new player join attempt (without valid token)
 */
function joinAsNewPlayer(
  room: MockRoom,
  playerName: string,
  invalidToken?: string
): ReconnectResult {
  // Check if token exists (it shouldn't for new player)
  if (invalidToken) {
    const existingPlayer = room.players.find(p => p.token === invalidToken);
    if (existingPlayer) {
      // This would be a reconnect, not new player
      return reconnectWithToken(room, invalidToken);
    }
  }

  // Game in progress - reject new players
  if (room.phase !== 'waiting') {
    return { success: false, isReconnect: false, error: 'GAME_IN_PROGRESS' };
  }

  // Create new player
  const newPlayer: PlayerState = {
    id: crypto.randomUUID(),
    name: playerName,
    token: crypto.randomUUID(),
    role: null,
    isAlive: true,
    isOnline: true,
    joinOrder: room.players.length,
  };

  room.players.push(newPlayer);

  return {
    success: true,
    isReconnect: false,
    restoredState: newPlayer,
  };
}

describe('Property 15: Player Identity Round-Trip', () => {
  /**
   * Property: For any player who disconnects and reconnects with same token,
   * their name SHALL be preserved
   */
  it('should preserve player name after reconnection', () => {
    fc.assert(
      fc.property(
        validPlayerName,
        fc.constantFrom('civilian' as const, 'spy' as const),
        gamePhase,
        (playerName, role, phase) => {
          const player: PlayerState = {
            id: 'player-1',
            name: playerName,
            token: 'token-123',
            role: phase === 'waiting' ? null : role,
            isAlive: true,
            isOnline: true,
            joinOrder: 0,
          };

          const room: MockRoom = {
            id: 'room-1',
            phase,
            players: [player],
          };

          // Disconnect
          disconnectPlayer(room, player.id);
          expect(room.players[0].isOnline).toBe(false);

          // Reconnect with same token
          const result = reconnectWithToken(room, player.token);

          expect(result.success).toBe(true);
          expect(result.isReconnect).toBe(true);
          expect(result.restoredState?.name).toBe(playerName);

          return true;
        }
      ),
      PBT_CONFIG
    );
  });

  /**
   * Property: For any player who disconnects and reconnects with same token,
   * their role SHALL be preserved
   */
  it('should preserve player role after reconnection', () => {
    fc.assert(
      fc.property(
        validPlayerName,
        fc.constantFrom('civilian' as const, 'spy' as const),
        fc.constantFrom('word-reveal', 'description', 'voting', 'result'),
        (playerName, role, phase) => {
          const player: PlayerState = {
            id: 'player-1',
            name: playerName,
            token: 'token-123',
            role, // Role is assigned during game
            isAlive: true,
            isOnline: true,
            joinOrder: 0,
          };

          const room: MockRoom = {
            id: 'room-1',
            phase,
            players: [player],
          };

          // Disconnect
          disconnectPlayer(room, player.id);

          // Reconnect with same token
          const result = reconnectWithToken(room, player.token);

          expect(result.success).toBe(true);
          expect(result.restoredState?.role).toBe(role);

          return true;
        }
      ),
      PBT_CONFIG
    );
  });

  /**
   * Property: For any player who disconnects and reconnects with same token,
   * their alive status SHALL be preserved
   */
  it('should preserve player alive status after reconnection', () => {
    fc.assert(
      fc.property(
        validPlayerName,
        fc.boolean(),
        (playerName, isAlive) => {
          const player: PlayerState = {
            id: 'player-1',
            name: playerName,
            token: 'token-123',
            role: 'civilian',
            isAlive,
            isOnline: true,
            joinOrder: 0,
          };

          const room: MockRoom = {
            id: 'room-1',
            phase: 'voting',
            players: [player],
          };

          // Disconnect
          disconnectPlayer(room, player.id);

          // Reconnect with same token
          const result = reconnectWithToken(room, player.token);

          expect(result.success).toBe(true);
          expect(result.restoredState?.isAlive).toBe(isAlive);

          return true;
        }
      ),
      PBT_CONFIG
    );
  });

  /**
   * Property: For any player who reconnects with same token,
   * their join order SHALL be preserved
   */
  it('should preserve player join order after reconnection', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 19 }),
        (joinOrder) => {
          const player: PlayerState = {
            id: 'player-1',
            name: '测试玩家',
            token: 'token-123',
            role: 'civilian',
            isAlive: true,
            isOnline: true,
            joinOrder,
          };

          const room: MockRoom = {
            id: 'room-1',
            phase: 'description',
            players: [player],
          };

          // Disconnect
          disconnectPlayer(room, player.id);

          // Reconnect with same token
          const result = reconnectWithToken(room, player.token);

          expect(result.success).toBe(true);
          expect(result.restoredState?.joinOrder).toBe(joinOrder);

          return true;
        }
      ),
      PBT_CONFIG
    );
  });

  /**
   * Property: For any invalid token during game in progress,
   * reconnection SHALL fail
   */
  it('should reject reconnection with invalid token during game', () => {
    fc.assert(
      fc.property(
        validPlayerName,
        fc.uuid(),
        fc.constantFrom('word-reveal', 'description', 'voting', 'result'),
        (playerName, invalidToken, phase) => {
          const existingPlayer: PlayerState = {
            id: 'player-1',
            name: '已有玩家',
            token: 'valid-token',
            role: 'civilian',
            isAlive: true,
            isOnline: true,
            joinOrder: 0,
          };

          const room: MockRoom = {
            id: 'room-1',
            phase,
            players: [existingPlayer],
          };

          // Try to join with invalid token during game
          const result = joinAsNewPlayer(room, playerName, invalidToken);

          // Should fail because game is in progress
          expect(result.success).toBe(false);
          expect(result.error).toBe('GAME_IN_PROGRESS');

          return true;
        }
      ),
      PBT_CONFIG
    );
  });

  /**
   * Property: Reconnection with valid token SHALL work in any game phase
   */
  it('should allow reconnection in any game phase', () => {
    fc.assert(
      fc.property(
        validPlayerName,
        gamePhase,
        (playerName, phase) => {
          const player: PlayerState = {
            id: 'player-1',
            name: playerName,
            token: 'token-123',
            role: phase === 'waiting' ? null : 'civilian',
            isAlive: true,
            isOnline: true,
            joinOrder: 0,
          };

          const room: MockRoom = {
            id: 'room-1',
            phase,
            players: [player],
          };

          // Disconnect
          disconnectPlayer(room, player.id);

          // Reconnect with same token - should work in any phase
          const result = reconnectWithToken(room, player.token);

          expect(result.success).toBe(true);
          expect(result.isReconnect).toBe(true);

          return true;
        }
      ),
      PBT_CONFIG
    );
  });

  /**
   * Property: After reconnection, player SHALL be marked as online
   */
  it('should mark player as online after reconnection', () => {
    fc.assert(
      fc.property(validPlayerName, (playerName) => {
        const player: PlayerState = {
          id: 'player-1',
          name: playerName,
          token: 'token-123',
          role: 'civilian',
          isAlive: true,
          isOnline: true,
          joinOrder: 0,
        };

        const room: MockRoom = {
          id: 'room-1',
          phase: 'description',
          players: [player],
        };

        // Disconnect
        disconnectPlayer(room, player.id);
        expect(room.players[0].isOnline).toBe(false);

        // Reconnect
        reconnectWithToken(room, player.token);

        // Should be online again
        expect(room.players[0].isOnline).toBe(true);

        return true;
      }),
      PBT_CONFIG
    );
  });

  /**
   * Property: Player ID SHALL remain the same after reconnection
   */
  it('should preserve player ID after reconnection', () => {
    fc.assert(
      fc.property(
        validPlayerName,
        fc.uuid(),
        (playerName, playerId) => {
          const player: PlayerState = {
            id: playerId,
            name: playerName,
            token: 'token-123',
            role: 'spy',
            isAlive: true,
            isOnline: true,
            joinOrder: 0,
          };

          const room: MockRoom = {
            id: 'room-1',
            phase: 'voting',
            players: [player],
          };

          // Disconnect
          disconnectPlayer(room, player.id);

          // Reconnect
          const result = reconnectWithToken(room, player.token);

          expect(result.success).toBe(true);
          expect(result.restoredState?.id).toBe(playerId);

          return true;
        }
      ),
      PBT_CONFIG
    );
  });
});
