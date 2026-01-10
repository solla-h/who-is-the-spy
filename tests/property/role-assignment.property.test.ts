/**
 * Property-based tests for Role Assignment Correctness
 * Feature: who-is-spy-game, Property 8: Role Assignment Correctness
 * Validates: Requirements 5.2, 5.3
 * 
 * Property 8: Role Assignment Correctness
 * *For any* game start with N players and S configured spies, exactly S players SHALL be assigned
 * the spy role with the spy word, and exactly (N-S) players SHALL be assigned the civilian role
 * with the civilian word.
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { selectSpies, selectFirstPlayer } from '../../src/api/game';

describe('Property 8: Role Assignment Correctness', () => {
  /**
   * Property: For any valid game configuration, exactly spyCount players are selected as spies
   * Validates: Requirements 5.2
   */
  it('should select exactly the configured number of spies', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 3, max: 20 }), // Player count
        (playerCount) => {
          // Generate player IDs
          const playerIds = Array.from({ length: playerCount }, (_, i) => `player-${i}`);
          
          // Test with various valid spy counts
          for (let spyCount = 1; spyCount < playerCount; spyCount++) {
            const spyIds = selectSpies(playerIds, spyCount);
            expect(spyIds.length).toBe(spyCount);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: All selected spies are from the original player list
   * Validates: Requirements 5.2
   */
  it('should only select spies from the provided player list', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 3, max: 20 }), // Player count
        fc.integer({ min: 1, max: 19 }), // Spy count (will be clamped)
        (playerCount, rawSpyCount) => {
          const spyCount = Math.min(rawSpyCount, playerCount - 1);
          const playerIds = Array.from({ length: playerCount }, (_, i) => `player-${i}`);
          
          const spyIds = selectSpies(playerIds, spyCount);
          
          // All spy IDs should be in the original player list
          for (const spyId of spyIds) {
            expect(playerIds).toContain(spyId);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: All selected spies are unique (no duplicates)
   * Validates: Requirements 5.2
   */
  it('should select unique spies with no duplicates', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 3, max: 20 }), // Player count
        fc.integer({ min: 1, max: 19 }), // Spy count (will be clamped)
        (playerCount, rawSpyCount) => {
          const spyCount = Math.min(rawSpyCount, playerCount - 1);
          const playerIds = Array.from({ length: playerCount }, (_, i) => `player-${i}`);
          
          const spyIds = selectSpies(playerIds, spyCount);
          const uniqueSpyIds = new Set(spyIds);
          
          expect(uniqueSpyIds.size).toBe(spyIds.length);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Civilian count equals total players minus spy count
   * Validates: Requirements 5.3
   */
  it('should result in correct civilian count (N - S civilians)', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 3, max: 20 }), // Player count
        fc.integer({ min: 1, max: 19 }), // Spy count (will be clamped)
        (playerCount, rawSpyCount) => {
          const spyCount = Math.min(rawSpyCount, playerCount - 1);
          const playerIds = Array.from({ length: playerCount }, (_, i) => `player-${i}`);
          
          const spyIds = selectSpies(playerIds, spyCount);
          const spyIdSet = new Set(spyIds);
          
          // Count civilians (players not in spy list)
          const civilianCount = playerIds.filter(id => !spyIdSet.has(id)).length;
          
          expect(civilianCount).toBe(playerCount - spyCount);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Every player is either a spy or a civilian (complete partition)
   * Validates: Requirements 5.2, 5.3
   */
  it('should partition all players into spies and civilians', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 3, max: 20 }), // Player count
        fc.integer({ min: 1, max: 19 }), // Spy count (will be clamped)
        (playerCount, rawSpyCount) => {
          const spyCount = Math.min(rawSpyCount, playerCount - 1);
          const playerIds = Array.from({ length: playerCount }, (_, i) => `player-${i}`);
          
          const spyIds = selectSpies(playerIds, spyCount);
          const spyIdSet = new Set(spyIds);
          
          // Every player should be either a spy or a civilian
          for (const playerId of playerIds) {
            const isSpy = spyIdSet.has(playerId);
            const isCivilian = !spyIdSet.has(playerId);
            // XOR: exactly one should be true
            expect(isSpy !== isCivilian).toBe(true);
          }
          
          // Total should equal player count
          const civilianIds = playerIds.filter(id => !spyIdSet.has(id));
          expect(spyIds.length + civilianIds.length).toBe(playerCount);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: First player selection is within valid range
   * Validates: Requirements 5.5
   */
  it('should select first player within valid range [0, playerCount)', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 3, max: 20 }), // Player count
        (playerCount) => {
          // Run multiple times to test randomness
          for (let i = 0; i < 10; i++) {
            const firstPlayer = selectFirstPlayer(playerCount);
            expect(firstPlayer).toBeGreaterThanOrEqual(0);
            expect(firstPlayer).toBeLessThan(playerCount);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Spy selection shows randomness (not always the same players)
   * This is a statistical property - over many runs, different players should be selected
   */
  it('should show randomness in spy selection', () => {
    const playerCount = 10;
    const spyCount = 2;
    const playerIds = Array.from({ length: playerCount }, (_, i) => `player-${i}`);
    
    // Track which players are selected as spies across multiple runs
    const spySelectionCounts = new Map<string, number>();
    const numRuns = 100;
    
    for (let i = 0; i < numRuns; i++) {
      const spyIds = selectSpies(playerIds, spyCount);
      for (const spyId of spyIds) {
        spySelectionCounts.set(spyId, (spySelectionCounts.get(spyId) || 0) + 1);
      }
    }
    
    // At least some players should have been selected as spies
    expect(spySelectionCounts.size).toBeGreaterThan(1);
    
    // No single player should be selected every time (would indicate non-randomness)
    for (const [, count] of spySelectionCounts) {
      expect(count).toBeLessThan(numRuns);
    }
  });
});
