/**
 * Property-based tests for Game Restart State Reset
 * Feature: who-is-spy-game, Property 17: Game Restart State Reset
 * Validates: Requirements 8.7, 15.3
 * 
 * Property 17: Game Restart State Reset
 * *For any* game restart (from any phase), the game SHALL return to waiting phase
 * with all current players retained but all game-specific state (roles, words, votes, descriptions) cleared.
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { PlayerRow, RoomRow, GameSettings, GameState, GamePhase } from '../../src/types';
import { computeGameReset, GameResetInput } from '../../src/api/game';

// Helper to create mock player rows
function createMockPlayerRow(overrides: Partial<PlayerRow> = {}): PlayerRow {
  return {
    id: crypto.randomUUID(),
    room_id: crypto.randomUUID(),
    token: crypto.randomUUID(),
    name: '测试玩家',
    role: null,
    is_alive: 1,
    is_online: 1,
    last_seen: Date.now(),
    join_order: 0,
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

describe('Property 17: Game Restart State Reset', () => {
  const allPhases: GamePhase[] = ['waiting', 'word-reveal', 'description', 'voting', 'result', 'game-over'];
  const playerRoles: ('civilian' | 'spy' | null)[] = ['civilian', 'spy', null];

  /**
   * Property: After restart, room phase is always 'waiting'
   * Validates: Requirements 8.7, 15.3
   */
  it('should reset room phase to waiting from any phase', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...allPhases),
        fc.integer({ min: 3, max: 10 }),
        (initialPhase, playerCount) => {
          const roomId = crypto.randomUUID();
          
          // Create players with various states
          const players: PlayerRow[] = Array.from({ length: playerCount }, (_, i) =>
            createMockPlayerRow({
              id: `player-${i}`,
              room_id: roomId,
              name: `玩家${i}`,
              role: i < 2 ? 'spy' : 'civilian',
              is_alive: i % 2 === 0 ? 1 : 0, // Some eliminated
              join_order: i,
            })
          );
          
          // Create room in various phases
          const room = createMockRoomRow({
            id: roomId,
            phase: initialPhase,
            civilian_word: '苹果',
            spy_word: '梨子',
            game_state: JSON.stringify({
              eliminatedPlayers: players.filter(p => p.is_alive === 0).map(p => p.id),
              spyIds: players.filter(p => p.role === 'spy').map(p => p.id),
              winner: initialPhase === 'game-over' ? 'civilian' : undefined,
            }),
            current_turn: 3,
            round: 5,
          });
          
          const input: GameResetInput = { room, players };
          const output = computeGameReset(input);
          
          // Room phase should always be 'waiting'
          expect(output.room.phase).toBe('waiting');
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: After restart, all game-specific room state is cleared
   * Validates: Requirements 8.7, 15.3
   */
  it('should clear all game-specific room state', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...allPhases),
        fc.integer({ min: 3, max: 10 }),
        fc.integer({ min: 1, max: 10 }), // round
        fc.integer({ min: 0, max: 9 }),  // current_turn
        (initialPhase, playerCount, round, currentTurn) => {
          const roomId = crypto.randomUUID();
          
          const players: PlayerRow[] = Array.from({ length: playerCount }, (_, i) =>
            createMockPlayerRow({
              id: `player-${i}`,
              room_id: roomId,
              name: `玩家${i}`,
              role: i === 0 ? 'spy' : 'civilian',
              is_alive: 1,
              join_order: i,
            })
          );
          
          const room = createMockRoomRow({
            id: roomId,
            phase: initialPhase,
            civilian_word: '火锅',
            spy_word: '麻辣烫',
            game_state: JSON.stringify({
              eliminatedPlayers: ['some-id'],
              spyIds: ['player-0'],
            }),
            current_turn: currentTurn,
            round: round,
          });
          
          const input: GameResetInput = { room, players };
          const output = computeGameReset(input);
          
          // All game-specific state should be cleared
          expect(output.room.civilian_word).toBeNull();
          expect(output.room.spy_word).toBeNull();
          expect(output.room.game_state).toBeNull();
          expect(output.room.current_turn).toBe(0);
          expect(output.room.round).toBe(1);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: After restart, all players are retained
   * Validates: Requirements 8.7
   */
  it('should retain all players after restart', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...allPhases),
        fc.integer({ min: 3, max: 15 }),
        (initialPhase, playerCount) => {
          const roomId = crypto.randomUUID();
          
          const players: PlayerRow[] = Array.from({ length: playerCount }, (_, i) =>
            createMockPlayerRow({
              id: `player-${i}`,
              room_id: roomId,
              name: `玩家${i}`,
              role: i < Math.floor(playerCount / 3) ? 'spy' : 'civilian',
              is_alive: i % 3 !== 0 ? 1 : 0, // Some eliminated
              join_order: i,
            })
          );
          
          const room = createMockRoomRow({
            id: roomId,
            phase: initialPhase,
          });
          
          const input: GameResetInput = { room, players };
          const output = computeGameReset(input);
          
          // All players should be retained
          expect(output.players.length).toBe(playerCount);
          
          // Player IDs should match
          const inputIds = players.map(p => p.id).sort();
          const outputIds = output.players.map(p => p.id).sort();
          expect(outputIds).toEqual(inputIds);
          
          // Player names should be preserved
          for (const player of players) {
            const outputPlayer = output.players.find(p => p.id === player.id);
            expect(outputPlayer).toBeDefined();
            expect(outputPlayer!.name).toBe(player.name);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: After restart, all player roles are cleared
   * Validates: Requirements 8.7, 15.3
   */
  it('should clear all player roles after restart', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...allPhases),
        fc.integer({ min: 3, max: 10 }),
        (initialPhase, playerCount) => {
          const roomId = crypto.randomUUID();
          
          // Create players with assigned roles
          const players: PlayerRow[] = Array.from({ length: playerCount }, (_, i) =>
            createMockPlayerRow({
              id: `player-${i}`,
              room_id: roomId,
              name: `玩家${i}`,
              role: i === 0 ? 'spy' : 'civilian', // All have roles
              is_alive: 1,
              join_order: i,
            })
          );
          
          const room = createMockRoomRow({
            id: roomId,
            phase: initialPhase,
          });
          
          const input: GameResetInput = { room, players };
          const output = computeGameReset(input);
          
          // All player roles should be null
          for (const player of output.players) {
            expect(player.role).toBeNull();
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: After restart, all players are alive
   * Validates: Requirements 8.7
   */
  it('should set all players to alive after restart', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...allPhases),
        fc.integer({ min: 3, max: 10 }),
        fc.array(fc.boolean(), { minLength: 3, maxLength: 10 }),
        (initialPhase, playerCount, aliveStates) => {
          const roomId = crypto.randomUUID();
          const actualPlayerCount = Math.min(playerCount, aliveStates.length);
          
          // Create players with various alive states
          const players: PlayerRow[] = Array.from({ length: actualPlayerCount }, (_, i) =>
            createMockPlayerRow({
              id: `player-${i}`,
              room_id: roomId,
              name: `玩家${i}`,
              role: 'civilian',
              is_alive: aliveStates[i] ? 1 : 0, // Random alive states
              join_order: i,
            })
          );
          
          const room = createMockRoomRow({
            id: roomId,
            phase: initialPhase,
          });
          
          const input: GameResetInput = { room, players };
          const output = computeGameReset(input);
          
          // All players should be alive (is_alive = 1)
          for (const player of output.players) {
            expect(player.is_alive).toBe(1);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: After restart, descriptions and votes are cleared
   * Validates: Requirements 8.7, 15.3
   */
  it('should indicate descriptions and votes are cleared', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...allPhases),
        fc.integer({ min: 3, max: 10 }),
        (initialPhase, playerCount) => {
          const roomId = crypto.randomUUID();
          
          const players: PlayerRow[] = Array.from({ length: playerCount }, (_, i) =>
            createMockPlayerRow({
              id: `player-${i}`,
              room_id: roomId,
              name: `玩家${i}`,
              join_order: i,
            })
          );
          
          const room = createMockRoomRow({
            id: roomId,
            phase: initialPhase,
          });
          
          const input: GameResetInput = { room, players };
          const output = computeGameReset(input);
          
          // Descriptions and votes should be marked as cleared
          expect(output.descriptionsCleared).toBe(true);
          expect(output.votesCleared).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Restart is idempotent - restarting twice produces same result
   * Validates: Requirements 8.7, 15.3
   */
  it('should be idempotent - multiple restarts produce same result', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...allPhases),
        fc.integer({ min: 3, max: 10 }),
        (initialPhase, playerCount) => {
          const roomId = crypto.randomUUID();
          
          const players: PlayerRow[] = Array.from({ length: playerCount }, (_, i) =>
            createMockPlayerRow({
              id: `player-${i}`,
              room_id: roomId,
              name: `玩家${i}`,
              role: i === 0 ? 'spy' : 'civilian',
              is_alive: i % 2 === 0 ? 1 : 0,
              join_order: i,
            })
          );
          
          const room = createMockRoomRow({
            id: roomId,
            phase: initialPhase,
            civilian_word: '苹果',
            spy_word: '梨子',
          });
          
          const input: GameResetInput = { room, players };
          const output1 = computeGameReset(input);
          
          // Create a "reset" room and players based on first output
          const resetPlayers: PlayerRow[] = output1.players.map((p, i) =>
            createMockPlayerRow({
              id: p.id,
              room_id: roomId,
              name: p.name,
              role: p.role,
              is_alive: p.is_alive,
              join_order: i,
            })
          );
          
          const resetRoom = createMockRoomRow({
            id: roomId,
            phase: output1.room.phase,
            civilian_word: output1.room.civilian_word,
            spy_word: output1.room.spy_word,
            game_state: output1.room.game_state,
            current_turn: output1.room.current_turn,
            round: output1.room.round,
          });
          
          const input2: GameResetInput = { room: resetRoom, players: resetPlayers };
          const output2 = computeGameReset(input2);
          
          // Both outputs should be equivalent
          expect(output2.room).toEqual(output1.room);
          expect(output2.players.length).toBe(output1.players.length);
          expect(output2.descriptionsCleared).toBe(output1.descriptionsCleared);
          expect(output2.votesCleared).toBe(output1.votesCleared);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Restart preserves player count regardless of initial state
   * Validates: Requirements 8.7
   */
  it('should preserve exact player count through restart', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...allPhases),
        fc.integer({ min: 1, max: 20 }),
        (initialPhase, playerCount) => {
          const roomId = crypto.randomUUID();
          
          const players: PlayerRow[] = Array.from({ length: playerCount }, (_, i) =>
            createMockPlayerRow({
              id: `player-${i}`,
              room_id: roomId,
              name: `玩家${i}`,
              join_order: i,
            })
          );
          
          const room = createMockRoomRow({
            id: roomId,
            phase: initialPhase,
          });
          
          const input: GameResetInput = { room, players };
          const output = computeGameReset(input);
          
          expect(output.players.length).toBe(playerCount);
        }
      ),
      { numRuns: 100 }
    );
  });
});
