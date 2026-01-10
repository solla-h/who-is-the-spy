/**
 * Property-based tests for room join validation
 * 
 * Feature: who-is-spy-game, Property 4: Room Join Validation
 * Validates: Requirements 2.1, 2.2, 2.3, 2.4
 * 
 * *For any* join attempt: valid room code + correct password → success;
 * incorrect password → rejection; non-existent room → rejection;
 * game in progress → rejection for new players.
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { validPassword, validPlayerName, validRoomCode, gamePhase } from '../helpers/fc-arbitraries';

const PBT_CONFIG = { numRuns: 100 };

/**
 * Mock room state for testing join logic
 */
interface MockRoom {
  code: string;
  passwordHash: string;
  phase: string;
  players: { name: string; token: string }[];
}

type JoinResult = 
  | { success: true; isReconnect: boolean }
  | { success: false; error: 'ROOM_NOT_FOUND' | 'WRONG_PASSWORD' | 'GAME_IN_PROGRESS' | 'DUPLICATE_NAME' };

/**
 * Pure function that validates room join logic
 * This tests the core business logic without database dependencies
 */
function validateJoinRoom(
  roomCode: string,
  password: string,
  playerName: string,
  playerToken: string | undefined,
  rooms: Map<string, MockRoom>
): JoinResult {
  // Find room by code (Requirements 2.3)
  const room = rooms.get(roomCode);
  if (!room) {
    return { success: false, error: 'ROOM_NOT_FOUND' };
  }

  // Verify password (Requirements 2.2)
  // In real implementation, this would use hash comparison
  if (room.passwordHash !== password) {
    return { success: false, error: 'WRONG_PASSWORD' };
  }

  // Check for reconnection with existing token
  if (playerToken) {
    const existingPlayer = room.players.find(p => p.token === playerToken);
    if (existingPlayer) {
      return { success: true, isReconnect: true };
    }
  }

  // Check if game is in progress (Requirements 2.4)
  if (room.phase !== 'waiting') {
    return { success: false, error: 'GAME_IN_PROGRESS' };
  }

  // Check for duplicate name
  const nameExists = room.players.some(p => p.name === playerName);
  if (nameExists) {
    return { success: false, error: 'DUPLICATE_NAME' };
  }

  // Success (Requirements 2.1)
  return { success: true, isReconnect: false };
}

describe('Property 4: Room Join Validation', () => {
  /**
   * Property: For any valid room code + correct password + unique name in waiting phase,
   * join SHALL succeed
   */
  it('should allow join with valid credentials in waiting phase', () => {
    fc.assert(
      fc.property(
        validRoomCode,
        validPassword,
        validPlayerName,
        (roomCode, password, playerName) => {
          const rooms = new Map<string, MockRoom>();
          rooms.set(roomCode, {
            code: roomCode,
            passwordHash: password, // Simplified for testing
            phase: 'waiting',
            players: [],
          });

          const result = validateJoinRoom(roomCode, password, playerName, undefined, rooms);
          
          expect(result.success).toBe(true);
          if (result.success) {
            expect(result.isReconnect).toBe(false);
          }
          return true;
        }
      ),
      PBT_CONFIG
    );
  });

  /**
   * Property: For any non-existent room code, join SHALL fail with ROOM_NOT_FOUND
   */
  it('should reject join to non-existent room', () => {
    fc.assert(
      fc.property(
        validRoomCode,
        validPassword,
        validPlayerName,
        (roomCode, password, playerName) => {
          const rooms = new Map<string, MockRoom>(); // Empty - no rooms exist

          const result = validateJoinRoom(roomCode, password, playerName, undefined, rooms);
          
          expect(result.success).toBe(false);
          if (!result.success) {
            expect(result.error).toBe('ROOM_NOT_FOUND');
          }
          return true;
        }
      ),
      PBT_CONFIG
    );
  });

  /**
   * Property: For any incorrect password, join SHALL fail with WRONG_PASSWORD
   */
  it('should reject join with incorrect password', () => {
    fc.assert(
      fc.property(
        validRoomCode,
        validPassword,
        validPassword,
        validPlayerName,
        (roomCode, correctPassword, wrongPassword, playerName) => {
          // Skip if passwords happen to match
          fc.pre(correctPassword !== wrongPassword);

          const rooms = new Map<string, MockRoom>();
          rooms.set(roomCode, {
            code: roomCode,
            passwordHash: correctPassword,
            phase: 'waiting',
            players: [],
          });

          const result = validateJoinRoom(roomCode, wrongPassword, playerName, undefined, rooms);
          
          expect(result.success).toBe(false);
          if (!result.success) {
            expect(result.error).toBe('WRONG_PASSWORD');
          }
          return true;
        }
      ),
      PBT_CONFIG
    );
  });

  /**
   * Property: For any game in progress (non-waiting phase), new player join SHALL fail
   */
  it('should reject new player join when game is in progress', () => {
    const nonWaitingPhases = ['word-reveal', 'description', 'voting', 'result', 'game-over'];
    
    fc.assert(
      fc.property(
        validRoomCode,
        validPassword,
        validPlayerName,
        fc.constantFrom(...nonWaitingPhases),
        (roomCode, password, playerName, phase) => {
          const rooms = new Map<string, MockRoom>();
          rooms.set(roomCode, {
            code: roomCode,
            passwordHash: password,
            phase: phase,
            players: [],
          });

          const result = validateJoinRoom(roomCode, password, playerName, undefined, rooms);
          
          expect(result.success).toBe(false);
          if (!result.success) {
            expect(result.error).toBe('GAME_IN_PROGRESS');
          }
          return true;
        }
      ),
      PBT_CONFIG
    );
  });

  /**
   * Property: For any existing player token, reconnection SHALL succeed regardless of phase
   */
  it('should allow reconnection with valid token in any phase', () => {
    fc.assert(
      fc.property(
        validRoomCode,
        validPassword,
        validPlayerName,
        gamePhase,
        fc.uuid(),
        (roomCode, password, playerName, phase, token) => {
          const rooms = new Map<string, MockRoom>();
          rooms.set(roomCode, {
            code: roomCode,
            passwordHash: password,
            phase: phase,
            players: [{ name: playerName, token: token }],
          });

          const result = validateJoinRoom(roomCode, password, playerName, token, rooms);
          
          expect(result.success).toBe(true);
          if (result.success) {
            expect(result.isReconnect).toBe(true);
          }
          return true;
        }
      ),
      PBT_CONFIG
    );
  });

  /**
   * Property: Password validation is case-sensitive
   */
  it('should be case-sensitive for password validation', () => {
    fc.assert(
      fc.property(
        validRoomCode,
        validPlayerName,
        fc.stringOf(fc.constantFrom(...'abcdefgh'), { minLength: 4, maxLength: 8 }),
        (roomCode, playerName, lowerPassword) => {
          const upperPassword = lowerPassword.toUpperCase();
          // Skip if case doesn't change anything
          fc.pre(lowerPassword !== upperPassword);

          const rooms = new Map<string, MockRoom>();
          rooms.set(roomCode, {
            code: roomCode,
            passwordHash: lowerPassword,
            phase: 'waiting',
            players: [],
          });

          // Correct password should work
          const correctResult = validateJoinRoom(roomCode, lowerPassword, playerName, undefined, rooms);
          expect(correctResult.success).toBe(true);

          // Wrong case should fail
          const wrongCaseResult = validateJoinRoom(roomCode, upperPassword, playerName, undefined, rooms);
          expect(wrongCaseResult.success).toBe(false);
          if (!wrongCaseResult.success) {
            expect(wrongCaseResult.error).toBe('WRONG_PASSWORD');
          }
          return true;
        }
      ),
      PBT_CONFIG
    );
  });
});
