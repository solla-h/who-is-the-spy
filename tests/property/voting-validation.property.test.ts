/**
 * Property-based tests for Voting Validation
 * Feature: who-is-spy-game, Property 12: Voting Validation
 * Validates: Requirements 7.1, 7.2, 7.3
 * 
 * Property 12: Voting Validation
 * *For any* vote submission: only alive players can vote; players cannot vote for themselves;
 * players cannot vote for eliminated players; each player can vote only once per round.
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { validateVote } from '../../src/api/game';

describe('Property 12: Voting Validation', () => {
  /**
   * Property: Only alive players can vote
   * Validates: Requirements 7.1
   */
  it('should reject votes from eliminated players', () => {
    fc.assert(
      fc.property(
        fc.uuid(), // voterId
        fc.uuid(), // targetId
        (voterId, targetId) => {
          // Ensure different IDs for valid self-vote check
          const actualTargetId = voterId === targetId ? `${targetId}-different` : targetId;
          
          const result = validateVote(
            voterId,
            actualTargetId,
            false, // voter is NOT alive (eliminated)
            true,  // target is alive
            false  // has not voted yet
          );
          
          expect(result.valid).toBe(false);
          expect(result.error).toBe('已淘汰的玩家不能投票');
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Players cannot vote for themselves
   * Validates: Requirements 7.2
   */
  it('should reject self-votes', () => {
    fc.assert(
      fc.property(
        fc.uuid(), // playerId (same for voter and target)
        (playerId) => {
          const result = validateVote(
            playerId,
            playerId, // voting for self
            true,     // voter is alive
            true,     // target is alive (same person)
            false     // has not voted yet
          );
          
          expect(result.valid).toBe(false);
          expect(result.error).toBe('不能投票给自己');
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Players cannot vote for eliminated players
   * Validates: Requirements 7.3
   */
  it('should reject votes for eliminated players', () => {
    fc.assert(
      fc.property(
        fc.uuid(), // voterId
        fc.uuid(), // targetId
        (voterId, targetId) => {
          // Ensure different IDs
          const actualTargetId = voterId === targetId ? `${targetId}-different` : targetId;
          
          const result = validateVote(
            voterId,
            actualTargetId,
            true,  // voter is alive
            false, // target is NOT alive (eliminated)
            false  // has not voted yet
          );
          
          expect(result.valid).toBe(false);
          expect(result.error).toBe('不能投票给已淘汰的玩家');
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Each player can vote only once per round
   * Validates: Requirements 7.3
   */
  it('should reject duplicate votes in the same round', () => {
    fc.assert(
      fc.property(
        fc.uuid(), // voterId
        fc.uuid(), // targetId
        (voterId, targetId) => {
          // Ensure different IDs
          const actualTargetId = voterId === targetId ? `${targetId}-different` : targetId;
          
          const result = validateVote(
            voterId,
            actualTargetId,
            true, // voter is alive
            true, // target is alive
            true  // has ALREADY voted
          );
          
          expect(result.valid).toBe(false);
          expect(result.error).toBe('本轮已经投过票了');
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Valid votes are accepted
   * Validates: Requirements 7.1, 7.2, 7.3
   */
  it('should accept valid votes from alive players for alive targets', () => {
    fc.assert(
      fc.property(
        fc.uuid(), // voterId
        fc.uuid(), // targetId
        (voterId, targetId) => {
          // Ensure different IDs for valid vote
          const actualTargetId = voterId === targetId ? `${targetId}-different` : targetId;
          
          const result = validateVote(
            voterId,
            actualTargetId,
            true,  // voter is alive
            true,  // target is alive
            false  // has not voted yet
          );
          
          expect(result.valid).toBe(true);
          expect(result.error).toBeUndefined();
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Validation error priority - eliminated voter checked first
   * When multiple validation failures occur, eliminated voter should be caught first
   */
  it('should prioritize eliminated voter error over other errors', () => {
    fc.assert(
      fc.property(
        fc.uuid(), // playerId
        (playerId) => {
          // Eliminated voter trying to vote for themselves (multiple violations)
          const result = validateVote(
            playerId,
            playerId, // self-vote
            false,    // voter is eliminated
            false,    // target is also eliminated (same person)
            true      // has already voted
          );
          
          // Should catch eliminated voter first
          expect(result.valid).toBe(false);
          expect(result.error).toBe('已淘汰的玩家不能投票');
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Validation error priority - self-vote checked before target status
   * When voter is alive but voting for self, self-vote error should be caught
   */
  it('should prioritize self-vote error over eliminated target error', () => {
    fc.assert(
      fc.property(
        fc.uuid(), // playerId
        (playerId) => {
          // Alive voter trying to vote for themselves
          const result = validateVote(
            playerId,
            playerId, // self-vote
            true,     // voter is alive
            true,     // target is alive (same person)
            false     // has not voted yet
          );
          
          // Should catch self-vote
          expect(result.valid).toBe(false);
          expect(result.error).toBe('不能投票给自己');
        }
      ),
      { numRuns: 100 }
    );
  });
});
