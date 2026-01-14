/**
 * Property-based tests for Description Validation
 * Feature: who-is-spy-game, Property 10: Description Validation
 * Validates: Requirements 6.2, 6.8
 * 
 * Property 10: Description Validation
 * *For any* description submission, only the current turn player SHALL be allowed to submit;
 * *for any* description text containing the player's actual word, the submission SHALL be rejected.
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { validateDescription, isPlayerTurn } from '../../src/api/game';
import { PlayerRow } from '../../src/types';

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
    ...overrides,
  };
}

describe('Property 10: Description Validation', () => {
  /**
   * Property: For any description containing the player's word, it should be rejected
   * Validates: Requirements 6.8
   */
  it('should reject descriptions containing the player word', () => {
    fc.assert(
      fc.property(
        // Generate a word (2-4 Chinese characters)
        fc.stringOf(fc.constantFrom(...'苹果梨子火锅麻辣烫饺子馄饨可乐雪碧牛奶豆浆'), { minLength: 2, maxLength: 4 }),
        // Generate prefix and suffix for the description
        fc.stringOf(fc.constantFrom(...'这是一个很好的东西我喜欢它非常有趣'), { minLength: 0, maxLength: 20 }),
        fc.stringOf(fc.constantFrom(...'味道不错颜色漂亮形状特别'), { minLength: 0, maxLength: 20 }),
        (word, prefix, suffix) => {
          // Create a description that contains the word
          const descriptionWithWord = prefix + word + suffix;

          // Only test if the description is within valid length range
          if (descriptionWithWord.length >= 2 && descriptionWithWord.length <= 50) {
            const result = validateDescription(descriptionWithWord, word);
            expect(result.valid).toBe(false);
            expect(result.error).toBe('描述不能包含你的词语');
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: For any valid description not containing the word, it should be accepted
   * Validates: Requirements 6.2
   */
  it('should accept valid descriptions not containing the player word', () => {
    fc.assert(
      fc.property(
        // Generate a word that won't appear in the description
        fc.constant('特殊词语'),
        // Generate description text (2-50 characters, using different characters)
        fc.stringOf(fc.constantFrom(...'这是一个很好的东西我喜欢它非常有趣味道不错颜色漂亮'), { minLength: 2, maxLength: 50 }),
        (word, description) => {
          // Only test if description doesn't contain the word
          if (!description.includes(word)) {
            const result = validateDescription(description, word);
            expect(result.valid).toBe(true);
            expect(result.error).toBeUndefined();
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: For any description shorter than 2 characters, it should be rejected
   * Validates: Requirements 6.2
   */
  it('should reject descriptions shorter than 2 characters', () => {
    fc.assert(
      fc.property(
        fc.stringOf(fc.char(), { minLength: 0, maxLength: 1 }),
        (shortDescription) => {
          const result = validateDescription(shortDescription, '测试词');
          expect(result.valid).toBe(false);
          expect(result.error).toBe('描述至少需要2个字符');
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: For any description longer than 50 characters, it should be rejected
   * Validates: Requirements 6.2
   */
  it('should reject descriptions longer than 50 characters', () => {
    fc.assert(
      fc.property(
        fc.stringOf(fc.char(), { minLength: 51, maxLength: 100 }),
        (longDescription) => {
          const result = validateDescription(longDescription, '测试词');
          expect(result.valid).toBe(false);
          expect(result.error).toBe('描述不能超过50个字符');
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Only the current turn player should be allowed to describe
   * Validates: Requirements 6.2
   */
  it('should only allow current turn player to describe', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 3, max: 10 }), // Number of players
        fc.integer({ min: 0, max: 9 }),  // Current turn index
        (playerCount, currentTurn) => {
          // Create mock players
          const players: PlayerRow[] = Array.from({ length: playerCount }, (_, i) =>
            createMockPlayerRow({
              id: `player-${i}`,
              join_order: i,
              is_alive: 1,
            })
          );

          // Normalize current turn to valid range
          const normalizedTurn = currentTurn % playerCount;

          // The current turn player should be allowed
          const currentPlayerId = players[normalizedTurn].id;
          expect(isPlayerTurn(players, normalizedTurn, currentPlayerId)).toBe(true);

          // Other players should not be allowed
          for (let i = 0; i < playerCount; i++) {
            if (i !== normalizedTurn) {
              expect(isPlayerTurn(players, normalizedTurn, players[i].id)).toBe(false);
            }
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Eliminated players should be skipped in turn order
   * Validates: Requirements 6.2 (implicit - only alive players can describe)
   */
  it('should skip eliminated players in turn order', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 3, max: 10 }), // Number of players
        fc.integer({ min: 1, max: 5 }),  // Number of eliminated players
        (playerCount, eliminatedCount) => {
          // Ensure we don't eliminate more players than exist
          const actualEliminated = Math.min(eliminatedCount, playerCount - 1);

          // Create mock players with some eliminated
          const players: PlayerRow[] = Array.from({ length: playerCount }, (_, i) =>
            createMockPlayerRow({
              id: `player-${i}`,
              join_order: i,
              is_alive: i >= actualEliminated ? 1 : 0, // First N players are eliminated
            })
          );

          const alivePlayers = players.filter(p => p.is_alive === 1);

          // For any turn index, only alive players should be considered
          for (let turn = 0; turn < alivePlayers.length; turn++) {
            const expectedPlayer = alivePlayers[turn];
            expect(isPlayerTurn(players, turn, expectedPlayer.id)).toBe(true);

            // Eliminated players should never be the current turn
            for (let i = 0; i < actualEliminated; i++) {
              expect(isPlayerTurn(players, turn, players[i].id)).toBe(false);
            }
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Validation is deterministic - same inputs always produce same result
   */
  it('should produce deterministic validation results', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 0, maxLength: 60 }),
        fc.string({ minLength: 1, maxLength: 10 }),
        (description, word) => {
          const result1 = validateDescription(description, word);
          const result2 = validateDescription(description, word);
          expect(result1.valid).toBe(result2.valid);
          expect(result1.error).toBe(result2.error);
        }
      ),
      { numRuns: 100 }
    );
  });
});
