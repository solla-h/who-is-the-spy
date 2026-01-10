/**
 * Property-based tests for Victory Condition Correctness
 * Feature: who-is-spy-game, Property 14: Victory Condition Correctness
 * Validates: Requirements 8.1, 8.2
 * 
 * Property 14: Victory Condition Correctness
 * *For any* game state after elimination: if all spies are eliminated → civilian victory;
 * if alive spies >= alive civilians → spy victory; otherwise → game continues.
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { checkVictoryCondition } from '../../src/api/game';

describe('Property 14: Victory Condition Correctness', () => {
  /**
   * Property: Civilian victory when all spies are eliminated
   * Validates: Requirements 8.1
   */
  it('should declare civilian victory when all spies are eliminated', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 10 }), // Number of alive civilians
        fc.integer({ min: 1, max: 5 }),  // Number of spies (all eliminated)
        (civilianCount, spyCount) => {
          // Generate player IDs
          const civilianIds = Array.from({ length: civilianCount }, (_, i) => `civilian-${i}`);
          const spyIds = Array.from({ length: spyCount }, (_, i) => `spy-${i}`);
          
          // Only civilians are alive (all spies eliminated)
          const alivePlayers = civilianIds.map(id => ({ id, role: 'civilian' as const }));
          
          const result = checkVictoryCondition(alivePlayers, spyIds);
          
          // Requirement 8.1: All spies eliminated → civilian victory
          expect(result.gameOver).toBe(true);
          expect(result.winner).toBe('civilian');
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Spy victory when alive spies >= alive civilians
   * Validates: Requirements 8.2
   */
  it('should declare spy victory when alive spies >= alive civilians', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 5 }),  // Number of alive spies
        fc.integer({ min: 0, max: 5 }),  // Number of alive civilians (less than or equal to spies)
        (aliveSpyCount, aliveCivilianCount) => {
          // Ensure spies >= civilians for this test
          const actualCivilianCount = Math.min(aliveCivilianCount, aliveSpyCount);
          
          // Generate player IDs
          const spyIds = Array.from({ length: aliveSpyCount }, (_, i) => `spy-${i}`);
          const civilianIds = Array.from({ length: actualCivilianCount }, (_, i) => `civilian-${i}`);
          
          // All these players are alive
          const alivePlayers = [
            ...spyIds.map(id => ({ id, role: 'spy' as const })),
            ...civilianIds.map(id => ({ id, role: 'civilian' as const })),
          ];
          
          const result = checkVictoryCondition(alivePlayers, spyIds);
          
          // Requirement 8.2: Alive spies >= alive civilians → spy victory
          expect(result.gameOver).toBe(true);
          expect(result.winner).toBe('spy');
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Game continues when civilians outnumber spies
   * Validates: Requirements 8.1, 8.2 (inverse)
   */
  it('should continue game when civilians outnumber alive spies', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 5 }),  // Number of alive spies
        fc.integer({ min: 2, max: 10 }), // Number of alive civilians (more than spies)
        (aliveSpyCount, extraCivilians) => {
          // Ensure civilians > spies
          const aliveCivilianCount = aliveSpyCount + extraCivilians;
          
          // Generate player IDs
          const spyIds = Array.from({ length: aliveSpyCount }, (_, i) => `spy-${i}`);
          const civilianIds = Array.from({ length: aliveCivilianCount }, (_, i) => `civilian-${i}`);
          
          // All these players are alive
          const alivePlayers = [
            ...spyIds.map(id => ({ id, role: 'spy' as const })),
            ...civilianIds.map(id => ({ id, role: 'civilian' as const })),
          ];
          
          const result = checkVictoryCondition(alivePlayers, spyIds);
          
          // Game should continue
          expect(result.gameOver).toBe(false);
          expect(result.winner).toBeUndefined();
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Spy victory with equal numbers
   * Validates: Requirements 8.2
   */
  it('should declare spy victory when spies equal civilians', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 5 }), // Equal number of spies and civilians
        (count) => {
          // Generate equal numbers of spies and civilians
          const spyIds = Array.from({ length: count }, (_, i) => `spy-${i}`);
          const civilianIds = Array.from({ length: count }, (_, i) => `civilian-${i}`);
          
          // All players are alive
          const alivePlayers = [
            ...spyIds.map(id => ({ id, role: 'spy' as const })),
            ...civilianIds.map(id => ({ id, role: 'civilian' as const })),
          ];
          
          const result = checkVictoryCondition(alivePlayers, spyIds);
          
          // Requirement 8.2: Alive spies >= alive civilians → spy victory
          expect(result.gameOver).toBe(true);
          expect(result.winner).toBe('spy');
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Victory condition is deterministic
   * Validates: Requirements 8.1, 8.2
   */
  it('should return consistent results for the same input', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 5 }),  // Number of alive spies
        fc.integer({ min: 0, max: 10 }), // Number of alive civilians
        (aliveSpyCount, aliveCivilianCount) => {
          // Skip invalid case (no players)
          if (aliveSpyCount === 0 && aliveCivilianCount === 0) {
            return true;
          }
          
          // Generate player IDs
          const spyIds = Array.from({ length: aliveSpyCount }, (_, i) => `spy-${i}`);
          const civilianIds = Array.from({ length: aliveCivilianCount }, (_, i) => `civilian-${i}`);
          
          // All these players are alive
          const alivePlayers = [
            ...spyIds.map(id => ({ id, role: 'spy' as const })),
            ...civilianIds.map(id => ({ id, role: 'civilian' as const })),
          ];
          
          // Call twice with same input
          const result1 = checkVictoryCondition(alivePlayers, spyIds);
          const result2 = checkVictoryCondition(alivePlayers, spyIds);
          
          // Results should be identical
          expect(result1.gameOver).toBe(result2.gameOver);
          expect(result1.winner).toBe(result2.winner);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: No false positives - game doesn't end prematurely
   * Validates: Requirements 8.1, 8.2
   */
  it('should not end game when there are more civilians than spies', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 3 }),  // Number of alive spies
        (aliveSpyCount) => {
          // Always have more civilians than spies
          const aliveCivilianCount = aliveSpyCount + 1;
          
          // Generate player IDs
          const spyIds = Array.from({ length: aliveSpyCount }, (_, i) => `spy-${i}`);
          const civilianIds = Array.from({ length: aliveCivilianCount }, (_, i) => `civilian-${i}`);
          
          // All these players are alive
          const alivePlayers = [
            ...spyIds.map(id => ({ id, role: 'spy' as const })),
            ...civilianIds.map(id => ({ id, role: 'civilian' as const })),
          ];
          
          const result = checkVictoryCondition(alivePlayers, spyIds);
          
          // Game should NOT be over
          expect(result.gameOver).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });
});
