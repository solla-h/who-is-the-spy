/**
 * Property-based tests for Vote Tallying Correctness
 * Feature: who-is-spy-game, Property 13: Vote Tallying Correctness
 * Validates: Requirements 7.5, 7.6
 * 
 * Property 13: Vote Tallying Correctness
 * *For any* completed voting round, the player(s) with the maximum vote count SHALL be eliminated;
 * if multiple players tie for maximum, all tied players SHALL be eliminated.
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { tallyVotes } from '../../src/api/game';

describe('Property 13: Vote Tallying Correctness', () => {
  /**
   * Property: Player with most votes is eliminated
   * Validates: Requirements 7.5
   */
  it('should eliminate the player with the most votes', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 3, max: 10 }), // Number of players
        fc.integer({ min: 1, max: 20 }), // Number of votes
        (playerCount, voteCount) => {
          // Generate player IDs
          const playerIds = Array.from({ length: playerCount }, (_, i) => `player-${i}`);
          
          // Generate random votes
          const votes: { targetId: string }[] = [];
          for (let i = 0; i < voteCount; i++) {
            const targetIndex = Math.floor(Math.random() * playerCount);
            votes.push({ targetId: playerIds[targetIndex] });
          }
          
          const result = tallyVotes(votes);
          
          // If there are votes, eliminated players should have max votes
          if (votes.length > 0 && result.maxVotes > 0) {
            for (const eliminatedId of result.eliminatedPlayerIds) {
              expect(result.voteCounts.get(eliminatedId)).toBe(result.maxVotes);
            }
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: All players with max votes are eliminated (tie handling)
   * Validates: Requirements 7.6
   */
  it('should eliminate all players tied for maximum votes', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 2, max: 10 }), // Number of players
        fc.integer({ min: 2, max: 5 }),  // Number of tied players
        fc.integer({ min: 1, max: 5 }),  // Votes per tied player
        (playerCount, tiedCount, votesPerTied) => {
          const actualTiedCount = Math.min(tiedCount, playerCount);
          const playerIds = Array.from({ length: playerCount }, (_, i) => `player-${i}`);
          
          // Create votes where first N players are tied
          const votes: { targetId: string }[] = [];
          for (let i = 0; i < actualTiedCount; i++) {
            for (let j = 0; j < votesPerTied; j++) {
              votes.push({ targetId: playerIds[i] });
            }
          }
          
          // Add fewer votes for remaining players
          for (let i = actualTiedCount; i < playerCount; i++) {
            for (let j = 0; j < votesPerTied - 1; j++) {
              votes.push({ targetId: playerIds[i] });
            }
          }
          
          const result = tallyVotes(votes);
          
          // All tied players should be eliminated
          expect(result.eliminatedPlayerIds.length).toBe(actualTiedCount);
          
          // Each eliminated player should have max votes
          for (const eliminatedId of result.eliminatedPlayerIds) {
            expect(result.voteCounts.get(eliminatedId)).toBe(result.maxVotes);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Vote counts are accurate
   * Validates: Requirements 7.4
   */
  it('should accurately count votes for each player', () => {
    fc.assert(
      fc.property(
        fc.array(fc.integer({ min: 0, max: 9 }), { minLength: 1, maxLength: 50 }), // Vote targets as indices
        (voteTargets) => {
          const playerIds = Array.from({ length: 10 }, (_, i) => `player-${i}`);
          const votes = voteTargets.map(idx => ({ targetId: playerIds[idx] }));
          
          // Manually count votes
          const expectedCounts = new Map<string, number>();
          for (const vote of votes) {
            expectedCounts.set(vote.targetId, (expectedCounts.get(vote.targetId) || 0) + 1);
          }
          
          const result = tallyVotes(votes);
          
          // Verify counts match
          for (const [playerId, expectedCount] of expectedCounts.entries()) {
            expect(result.voteCounts.get(playerId)).toBe(expectedCount);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: No elimination with zero votes
   * Validates: Requirements 7.5
   */
  it('should not eliminate anyone when there are no votes', () => {
    const result = tallyVotes([]);
    
    expect(result.eliminatedPlayerIds.length).toBe(0);
    expect(result.maxVotes).toBe(0);
    expect(result.voteCounts.size).toBe(0);
  });

  /**
   * Property: Single vote eliminates that player
   * Validates: Requirements 7.5
   */
  it('should eliminate the only voted player when there is a single vote', () => {
    fc.assert(
      fc.property(
        fc.uuid(), // Target player ID
        (targetId) => {
          const votes = [{ targetId }];
          const result = tallyVotes(votes);
          
          expect(result.eliminatedPlayerIds).toContain(targetId);
          expect(result.eliminatedPlayerIds.length).toBe(1);
          expect(result.maxVotes).toBe(1);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Players with fewer votes are not eliminated
   * Validates: Requirements 7.5
   */
  it('should not eliminate players with fewer than max votes', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 3, max: 10 }), // Number of players
        (playerCount) => {
          const playerIds = Array.from({ length: playerCount }, (_, i) => `player-${i}`);
          
          // Give first player 3 votes, second player 2 votes, rest 1 vote
          const votes: { targetId: string }[] = [
            { targetId: playerIds[0] },
            { targetId: playerIds[0] },
            { targetId: playerIds[0] },
            { targetId: playerIds[1] },
            { targetId: playerIds[1] },
          ];
          
          // Add 1 vote for remaining players
          for (let i = 2; i < playerCount; i++) {
            votes.push({ targetId: playerIds[i] });
          }
          
          const result = tallyVotes(votes);
          
          // Only player 0 should be eliminated (has 3 votes, max)
          expect(result.eliminatedPlayerIds).toContain(playerIds[0]);
          expect(result.eliminatedPlayerIds.length).toBe(1);
          expect(result.maxVotes).toBe(3);
          
          // Player 1 and others should NOT be eliminated
          expect(result.eliminatedPlayerIds).not.toContain(playerIds[1]);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Total votes equals sum of all vote counts
   * Validates: Requirements 7.4
   */
  it('should have vote counts that sum to total votes', () => {
    fc.assert(
      fc.property(
        fc.array(fc.uuid(), { minLength: 0, maxLength: 50 }), // Vote targets
        (targetIds) => {
          const votes = targetIds.map(id => ({ targetId: id }));
          const result = tallyVotes(votes);
          
          // Sum all vote counts
          let totalCounted = 0;
          for (const count of result.voteCounts.values()) {
            totalCounted += count;
          }
          
          expect(totalCounted).toBe(votes.length);
        }
      ),
      { numRuns: 100 }
    );
  });
});
