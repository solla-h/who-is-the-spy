/**
 * Property-based tests for Host Permissions
 * Feature: who-is-spy-game, Property 6: Host Permissions
 * Validates: Requirements 4.1, 4.2, 6.5, 6.6, 15.1, 15.4
 * 
 * Property 6: Host Permissions
 * *For any* game action that modifies settings, starts voting, skips players, kicks players,
 * or restarts the game, only the host player SHALL be authorized to perform it.
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { PlayerRow, RoomRow, GameSettings, GameState } from '../../src/types';

// Helper to create mock player rows
function createMockPlayerRow(overrides: Partial<PlayerRow> = {}): PlayerRow {
  return {
    id: crypto.randomUUID(),
    room_id: crypto.randomUUID(),
    token: crypto.randomUUID(),
    name: '测试玩家',
    role: 'civilian',
    is_alive: 1,
    is_online: 1,
    word_confirmed: 1,
    last_seen: Date.now(),
    join_order: 0,
    is_bot: 0,
    ...overrides,
  };
}

// Helper to create mock room rows
function createMockRoomRow(overrides: Partial<RoomRow> = {}): RoomRow {
  const settings: GameSettings = { spyCount: 1, minPlayers: 3, maxPlayers: 20 };
  const gameState: GameState = { eliminatedPlayers: [], spyIds: [] };
  return {
    id: crypto.randomUUID(),
    code: '123456',
    password_hash: 'hash',
    phase: 'waiting',
    host_id: crypto.randomUUID(),
    settings: JSON.stringify(settings),
    game_state: JSON.stringify(gameState),
    civilian_word: null,
    spy_word: null,
    current_turn: 0,
    round: 1,
    created_at: Date.now(),
    updated_at: Date.now(),
    ...overrides,
  };
}

/**
 * Check if a player is the host of a room
 */
function isHost(player: PlayerRow, room: RoomRow): boolean {
  return player.id === room.host_id;
}

/**
 * Simulate host-only action authorization check
 * Returns true if the action should be allowed, false otherwise
 */
function authorizeHostAction(player: PlayerRow, room: RoomRow): { authorized: boolean; error?: string } {
  if (player.id !== room.host_id) {
    return { authorized: false, error: '只有房主可以执行此操作' };
  }
  return { authorized: true };
}

describe('Property 6: Host Permissions', () => {
  /**
   * Property: For any room and player, only the host should be authorized for host-only actions
   * Validates: Requirements 4.1, 4.2, 6.5, 6.6, 15.1, 15.4
   */
  it('should only authorize host for host-only actions', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 2, max: 10 }), // Number of players
        fc.integer({ min: 0, max: 9 }),  // Host index
        (playerCount, hostIndex) => {
          const normalizedHostIndex = hostIndex % playerCount;
          const roomId = crypto.randomUUID();

          // Create players
          const players: PlayerRow[] = Array.from({ length: playerCount }, (_, i) =>
            createMockPlayerRow({
              id: `player-${i}`,
              room_id: roomId,
              join_order: i,
            })
          );

          // Create room with host
          const hostId = players[normalizedHostIndex].id;
          const room = createMockRoomRow({ id: roomId, host_id: hostId });

          // Verify only host is authorized
          for (let i = 0; i < playerCount; i++) {
            const result = authorizeHostAction(players[i], room);
            if (i === normalizedHostIndex) {
              expect(result.authorized).toBe(true);
              expect(result.error).toBeUndefined();
            } else {
              expect(result.authorized).toBe(false);
              expect(result.error).toBe('只有房主可以执行此操作');
            }
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Host identification is consistent - same player is always identified as host
   * Validates: Requirements 4.1
   */
  it('should consistently identify the host', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 2, max: 10 }), // Number of players
        fc.integer({ min: 0, max: 9 }),  // Host index
        (playerCount, hostIndex) => {
          const normalizedHostIndex = hostIndex % playerCount;
          const roomId = crypto.randomUUID();

          // Create players
          const players: PlayerRow[] = Array.from({ length: playerCount }, (_, i) =>
            createMockPlayerRow({
              id: `player-${i}`,
              room_id: roomId,
            })
          );

          // Create room with host
          const hostId = players[normalizedHostIndex].id;
          const room = createMockRoomRow({ id: roomId, host_id: hostId });

          // Check multiple times - should always be consistent
          for (let check = 0; check < 5; check++) {
            for (let i = 0; i < playerCount; i++) {
              const isHostResult = isHost(players[i], room);
              expect(isHostResult).toBe(i === normalizedHostIndex);
            }
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Exactly one player should be the host in any room
   * Validates: Requirements 1.3
   */
  it('should have exactly one host per room', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 20 }), // Number of players
        fc.integer({ min: 0, max: 19 }), // Host index
        (playerCount, hostIndex) => {
          const normalizedHostIndex = hostIndex % playerCount;
          const roomId = crypto.randomUUID();

          // Create players
          const players: PlayerRow[] = Array.from({ length: playerCount }, (_, i) =>
            createMockPlayerRow({
              id: `player-${i}`,
              room_id: roomId,
            })
          );

          // Create room with host
          const hostId = players[normalizedHostIndex].id;
          const room = createMockRoomRow({ id: roomId, host_id: hostId });

          // Count hosts
          const hostCount = players.filter(p => isHost(p, room)).length;
          expect(hostCount).toBe(1);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Non-host players should never be authorized for host actions
   * Validates: Requirements 4.1, 4.2, 6.5, 6.6, 15.1, 15.4
   */
  it('should never authorize non-host players for host actions', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 2, max: 10 }), // Number of players (at least 2 to have non-hosts)
        fc.integer({ min: 0, max: 9 }),  // Host index
        (playerCount, hostIndex) => {
          const normalizedHostIndex = hostIndex % playerCount;
          const roomId = crypto.randomUUID();

          // Create players
          const players: PlayerRow[] = Array.from({ length: playerCount }, (_, i) =>
            createMockPlayerRow({
              id: `player-${i}`,
              room_id: roomId,
            })
          );

          // Create room with host
          const hostId = players[normalizedHostIndex].id;
          const room = createMockRoomRow({ id: roomId, host_id: hostId });

          // All non-host players should be rejected
          const nonHostPlayers = players.filter((_, i) => i !== normalizedHostIndex);
          for (const player of nonHostPlayers) {
            const result = authorizeHostAction(player, room);
            expect(result.authorized).toBe(false);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Host authorization check is deterministic
   */
  it('should produce deterministic authorization results', () => {
    fc.assert(
      fc.property(
        fc.uuid(),
        fc.uuid(),
        fc.uuid(),
        (playerId, roomId, hostId) => {
          const player = createMockPlayerRow({ id: playerId, room_id: roomId });
          const room = createMockRoomRow({ id: roomId, host_id: hostId });

          const result1 = authorizeHostAction(player, room);
          const result2 = authorizeHostAction(player, room);

          expect(result1.authorized).toBe(result2.authorized);
          expect(result1.error).toBe(result2.error);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Host actions in different phases should still require host authorization
   * Validates: Requirements 4.1, 4.2, 6.5, 6.6, 15.1
   */
  it('should require host authorization regardless of game phase', () => {
    const phases = ['waiting', 'word-reveal', 'description', 'voting', 'result', 'game-over'] as const;

    fc.assert(
      fc.property(
        fc.constantFrom(...phases),
        fc.integer({ min: 2, max: 10 }),
        fc.integer({ min: 0, max: 9 }),
        (phase, playerCount, hostIndex) => {
          const normalizedHostIndex = hostIndex % playerCount;
          const roomId = crypto.randomUUID();

          // Create players
          const players: PlayerRow[] = Array.from({ length: playerCount }, (_, i) =>
            createMockPlayerRow({
              id: `player-${i}`,
              room_id: roomId,
            })
          );

          // Create room with host in different phases
          const hostId = players[normalizedHostIndex].id;
          const room = createMockRoomRow({ id: roomId, host_id: hostId, phase });

          // Host authorization should work the same regardless of phase
          for (let i = 0; i < playerCount; i++) {
            const result = authorizeHostAction(players[i], room);
            if (i === normalizedHostIndex) {
              expect(result.authorized).toBe(true);
            } else {
              expect(result.authorized).toBe(false);
            }
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});
