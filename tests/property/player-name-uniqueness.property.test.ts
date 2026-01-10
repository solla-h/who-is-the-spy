/**
 * Property-based tests for player name uniqueness
 * 
 * Feature: who-is-spy-game, Property 5: Player Name Uniqueness
 * Validates: Requirements 3.2
 * 
 * *For any* room, no two players SHALL have the same display name.
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { validPlayerName, validRoomCode, validPassword } from '../helpers/fc-arbitraries';

const PBT_CONFIG = { numRuns: 100 };

/**
 * Mock room with players for testing name uniqueness
 */
interface MockRoom {
  code: string;
  players: { id: string; name: string }[];
}

type AddPlayerResult = 
  | { success: true; playerId: string }
  | { success: false; error: 'DUPLICATE_NAME' };

/**
 * Pure function that validates player name uniqueness
 */
function addPlayerToRoom(
  room: MockRoom,
  playerName: string
): AddPlayerResult {
  // Check for duplicate name (Requirements 3.2)
  const nameExists = room.players.some(p => p.name === playerName);
  if (nameExists) {
    return { success: false, error: 'DUPLICATE_NAME' };
  }

  // Add player
  const playerId = crypto.randomUUID();
  room.players.push({ id: playerId, name: playerName });
  return { success: true, playerId };
}

/**
 * Check if all player names in a room are unique
 */
function allNamesUnique(room: MockRoom): boolean {
  const names = room.players.map(p => p.name);
  const uniqueNames = new Set(names);
  return names.length === uniqueNames.size;
}

describe('Property 5: Player Name Uniqueness', () => {
  /**
   * Property: For any room, all player names SHALL be unique
   */
  it('should maintain unique player names in any room', () => {
    fc.assert(
      fc.property(
        fc.array(validPlayerName, { minLength: 1, maxLength: 10 }),
        (playerNames) => {
          const room: MockRoom = { code: '123456', players: [] };
          
          for (const name of playerNames) {
            addPlayerToRoom(room, name);
          }
          
          // All names in the room must be unique
          expect(allNamesUnique(room)).toBe(true);
          return true;
        }
      ),
      PBT_CONFIG
    );
  });

  /**
   * Property: Adding a player with an existing name SHALL fail
   */
  it('should reject duplicate player names', () => {
    fc.assert(
      fc.property(validPlayerName, (playerName) => {
        const room: MockRoom = { code: '123456', players: [] };
        
        // First add should succeed
        const firstResult = addPlayerToRoom(room, playerName);
        expect(firstResult.success).toBe(true);
        
        // Second add with same name should fail
        const secondResult = addPlayerToRoom(room, playerName);
        expect(secondResult.success).toBe(false);
        if (!secondResult.success) {
          expect(secondResult.error).toBe('DUPLICATE_NAME');
        }
        
        // Room should still have only one player with that name
        const playersWithName = room.players.filter(p => p.name === playerName);
        expect(playersWithName.length).toBe(1);
        
        return true;
      }),
      PBT_CONFIG
    );
  });

  /**
   * Property: Different names SHALL be allowed in the same room
   */
  it('should allow different player names in same room', () => {
    fc.assert(
      fc.property(
        validPlayerName,
        validPlayerName,
        (name1, name2) => {
          // Skip if names are the same
          fc.pre(name1 !== name2);
          
          const room: MockRoom = { code: '123456', players: [] };
          
          const result1 = addPlayerToRoom(room, name1);
          const result2 = addPlayerToRoom(room, name2);
          
          expect(result1.success).toBe(true);
          expect(result2.success).toBe(true);
          expect(room.players.length).toBe(2);
          
          return true;
        }
      ),
      PBT_CONFIG
    );
  });

  /**
   * Property: Name comparison SHALL be exact (case-sensitive)
   */
  it('should treat names as case-sensitive', () => {
    fc.assert(
      fc.property(
        fc.stringOf(fc.constantFrom(...'abcdefghij'), { minLength: 2, maxLength: 10 }),
        (lowerName) => {
          const upperName = lowerName.toUpperCase();
          // Skip if case doesn't change anything
          fc.pre(lowerName !== upperName);
          
          const room: MockRoom = { code: '123456', players: [] };
          
          // Both should succeed as they are different names
          const result1 = addPlayerToRoom(room, lowerName);
          const result2 = addPlayerToRoom(room, upperName);
          
          expect(result1.success).toBe(true);
          expect(result2.success).toBe(true);
          expect(room.players.length).toBe(2);
          
          return true;
        }
      ),
      PBT_CONFIG
    );
  });

  /**
   * Property: Same name in different rooms SHALL be allowed
   */
  it('should allow same name in different rooms', () => {
    fc.assert(
      fc.property(
        validPlayerName,
        validRoomCode,
        validRoomCode,
        (playerName, code1, code2) => {
          // Skip if room codes are the same
          fc.pre(code1 !== code2);
          
          const room1: MockRoom = { code: code1, players: [] };
          const room2: MockRoom = { code: code2, players: [] };
          
          const result1 = addPlayerToRoom(room1, playerName);
          const result2 = addPlayerToRoom(room2, playerName);
          
          // Same name should be allowed in different rooms
          expect(result1.success).toBe(true);
          expect(result2.success).toBe(true);
          
          return true;
        }
      ),
      PBT_CONFIG
    );
  });

  /**
   * Property: After multiple join attempts, room player count equals unique names added
   */
  it('should have player count equal to unique names successfully added', () => {
    fc.assert(
      fc.property(
        fc.array(validPlayerName, { minLength: 1, maxLength: 20 }),
        (playerNames) => {
          const room: MockRoom = { code: '123456', players: [] };
          let successCount = 0;
          
          for (const name of playerNames) {
            const result = addPlayerToRoom(room, name);
            if (result.success) {
              successCount++;
            }
          }
          
          // Player count should equal successful additions
          expect(room.players.length).toBe(successCount);
          
          // All names should be unique
          expect(allNamesUnique(room)).toBe(true);
          
          return true;
        }
      ),
      PBT_CONFIG
    );
  });
});
