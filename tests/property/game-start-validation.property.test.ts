/**
 * Property-based tests for Game Start Validation
 * Feature: who-is-spy-game, Property 7: Game Start Validation
 * Validates: Requirements 4.3, 4.4
 * 
 * Property 7: Game Start Validation
 * *For any* game start attempt, the system SHALL reject if spy count >= total players OR total players < 3.
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { validateGameStart } from '../../src/api/game';

describe('Property 7: Game Start Validation', () => {
  /**
   * Property: For any player count < 3, game start should be rejected
   * Validates: Requirements 4.4
   */
  it('should reject game start when player count is less than 3', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 2 }), // Invalid player count (0, 1, or 2)
        fc.integer({ min: 1, max: 10 }), // Any spy count
        (playerCount, spyCount) => {
          const result = validateGameStart(playerCount, spyCount);
          expect(result.valid).toBe(false);
          expect(result.error).toBeDefined();
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: For any spy count >= player count, game start should be rejected
   * Validates: Requirements 4.3
   */
  it('should reject game start when spy count is greater than or equal to player count', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 3, max: 20 }), // Valid player count
        (playerCount) => {
          // Test spy count equal to player count
          const resultEqual = validateGameStart(playerCount, playerCount);
          expect(resultEqual.valid).toBe(false);
          expect(resultEqual.error).toBeDefined();

          // Test spy count greater than player count
          const resultGreater = validateGameStart(playerCount, playerCount + 1);
          expect(resultGreater.valid).toBe(false);
          expect(resultGreater.error).toBeDefined();
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: For any valid configuration (playerCount >= 3 AND spyCount < playerCount AND spyCount >= 1),
   * game start should be accepted
   * Validates: Requirements 4.3, 4.4
   */
  it('should accept game start when configuration is valid', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 3, max: 20 }), // Valid player count
        (playerCount) => {
          // Generate valid spy count (1 to playerCount - 1)
          const maxSpyCount = playerCount - 1;
          for (let spyCount = 1; spyCount <= maxSpyCount; spyCount++) {
            const result = validateGameStart(playerCount, spyCount);
            expect(result.valid).toBe(true);
            expect(result.error).toBeUndefined();
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: For any spy count < 1, game start should be rejected
   * Validates: Requirements 4.3 (implicit - need at least 1 spy)
   */
  it('should reject game start when spy count is less than 1', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 3, max: 20 }), // Valid player count
        fc.integer({ min: -10, max: 0 }), // Invalid spy count (0 or negative)
        (playerCount, spyCount) => {
          const result = validateGameStart(playerCount, spyCount);
          expect(result.valid).toBe(false);
          expect(result.error).toBeDefined();
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
        fc.integer({ min: 0, max: 30 }),
        fc.integer({ min: 0, max: 30 }),
        (playerCount, spyCount) => {
          const result1 = validateGameStart(playerCount, spyCount);
          const result2 = validateGameStart(playerCount, spyCount);
          expect(result1.valid).toBe(result2.valid);
          expect(result1.error).toBe(result2.error);
        }
      ),
      { numRuns: 100 }
    );
  });
});
