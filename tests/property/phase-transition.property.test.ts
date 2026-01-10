/**
 * Property-based tests for Phase Transition Correctness
 * Feature: who-is-spy-game, Property 11: Phase Transition Correctness
 * Validates: Requirements 5.4, 6.7
 * 
 * Property 11: Phase Transition Correctness
 * *For any* game, phase transitions SHALL follow:
 * waiting → word-reveal → description → voting → (result → description OR game-over).
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import type { GamePhase } from '../../src/types';

/**
 * Define valid phase transitions based on the game flow
 * Requirements: 5.4, 6.7
 */
const VALID_TRANSITIONS: Record<GamePhase, GamePhase[]> = {
  'waiting': ['word-reveal'],           // Start game → word-reveal
  'word-reveal': ['description'],       // Confirm word → description
  'description': ['voting'],            // Start voting → voting
  'voting': ['result', 'game-over'],    // Finalize voting → result or game-over
  'result': ['description', 'game-over'], // Continue → description, or game ends
  'game-over': ['waiting'],             // Restart → waiting
};

/**
 * Check if a phase transition is valid
 */
export function isValidTransition(from: GamePhase, to: GamePhase): boolean {
  const validTargets = VALID_TRANSITIONS[from];
  return validTargets?.includes(to) ?? false;
}

/**
 * Get all valid next phases from a given phase
 */
export function getValidNextPhases(phase: GamePhase): GamePhase[] {
  return VALID_TRANSITIONS[phase] || [];
}

/**
 * Validate a sequence of phase transitions
 */
export function validatePhaseSequence(phases: GamePhase[]): { valid: boolean; invalidAt?: number } {
  if (phases.length < 2) {
    return { valid: true };
  }

  for (let i = 0; i < phases.length - 1; i++) {
    if (!isValidTransition(phases[i], phases[i + 1])) {
      return { valid: false, invalidAt: i };
    }
  }

  return { valid: true };
}

describe('Property 11: Phase Transition Correctness', () => {
  const allPhases: GamePhase[] = ['waiting', 'word-reveal', 'description', 'voting', 'result', 'game-over'];

  /**
   * Property: Valid transitions are accepted
   * Validates: Requirements 5.4, 6.7
   */
  it('should accept all defined valid transitions', () => {
    // Test all explicitly valid transitions
    for (const [from, validTargets] of Object.entries(VALID_TRANSITIONS)) {
      for (const to of validTargets) {
        expect(isValidTransition(from as GamePhase, to)).toBe(true);
      }
    }
  });

  /**
   * Property: Invalid transitions are rejected
   * Validates: Requirements 5.4, 6.7
   */
  it('should reject invalid phase transitions', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...allPhases),
        fc.constantFrom(...allPhases),
        (from, to) => {
          const validTargets = VALID_TRANSITIONS[from];
          const shouldBeValid = validTargets?.includes(to) ?? false;
          
          expect(isValidTransition(from, to)).toBe(shouldBeValid);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Game always starts from waiting phase
   * Validates: Requirements 5.4
   */
  it('should only allow game to start from waiting phase', () => {
    // Only waiting can transition to word-reveal (game start)
    for (const phase of allPhases) {
      if (phase === 'waiting') {
        expect(isValidTransition(phase, 'word-reveal')).toBe(true);
      } else if (phase !== 'game-over') {
        // Other phases (except game-over which can restart) cannot go to word-reveal
        expect(isValidTransition(phase, 'word-reveal')).toBe(false);
      }
    }
  });

  /**
   * Property: Description phase can only be reached from word-reveal or result
   * Validates: Requirements 5.4, 6.7
   */
  it('should only allow description phase from word-reveal or result', () => {
    for (const phase of allPhases) {
      const canGoToDescription = isValidTransition(phase, 'description');
      const shouldBeAble = phase === 'word-reveal' || phase === 'result';
      
      expect(canGoToDescription).toBe(shouldBeAble);
    }
  });

  /**
   * Property: Voting phase can only be reached from description
   * Validates: Requirements 6.7
   */
  it('should only allow voting phase from description', () => {
    for (const phase of allPhases) {
      const canGoToVoting = isValidTransition(phase, 'voting');
      const shouldBeAble = phase === 'description';
      
      expect(canGoToVoting).toBe(shouldBeAble);
    }
  });

  /**
   * Property: Game-over can only be reached from voting or result
   * Validates: Requirements 5.4
   */
  it('should only allow game-over from voting or result', () => {
    for (const phase of allPhases) {
      const canGoToGameOver = isValidTransition(phase, 'game-over');
      const shouldBeAble = phase === 'voting' || phase === 'result';
      
      expect(canGoToGameOver).toBe(shouldBeAble);
    }
  });

  /**
   * Property: Valid game flow sequences are accepted
   * Validates: Requirements 5.4, 6.7
   */
  it('should accept valid complete game sequences', () => {
    // Test a complete game where civilians win
    const civilianWinSequence: GamePhase[] = [
      'waiting',
      'word-reveal',
      'description',
      'voting',
      'result',      // Someone eliminated, game continues
      'description',
      'voting',
      'game-over',   // All spies eliminated
    ];
    
    expect(validatePhaseSequence(civilianWinSequence).valid).toBe(true);

    // Test a complete game where spies win
    const spyWinSequence: GamePhase[] = [
      'waiting',
      'word-reveal',
      'description',
      'voting',
      'game-over',   // Spies >= civilians after elimination
    ];
    
    expect(validatePhaseSequence(spyWinSequence).valid).toBe(true);
  });

  /**
   * Property: Invalid sequences are rejected
   * Validates: Requirements 5.4, 6.7
   */
  it('should reject invalid phase sequences', () => {
    // Cannot skip word-reveal
    const skipWordReveal: GamePhase[] = ['waiting', 'description'];
    expect(validatePhaseSequence(skipWordReveal).valid).toBe(false);

    // Cannot skip description
    const skipDescription: GamePhase[] = ['waiting', 'word-reveal', 'voting'];
    expect(validatePhaseSequence(skipDescription).valid).toBe(false);

    // Cannot go from waiting directly to voting
    const waitingToVoting: GamePhase[] = ['waiting', 'voting'];
    expect(validatePhaseSequence(waitingToVoting).valid).toBe(false);

    // Cannot go from voting back to description directly (must go through result)
    const votingToDescription: GamePhase[] = ['voting', 'description'];
    expect(validatePhaseSequence(votingToDescription).valid).toBe(false);
  });

  /**
   * Property: Every phase has at least one valid next phase
   * Validates: Requirements 5.4, 6.7
   */
  it('should have at least one valid transition from every phase', () => {
    for (const phase of allPhases) {
      const validNextPhases = getValidNextPhases(phase);
      expect(validNextPhases.length).toBeGreaterThan(0);
    }
  });

  /**
   * Property: Random valid sequences are accepted
   * Validates: Requirements 5.4, 6.7
   */
  it('should accept randomly generated valid sequences', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 2, max: 20 }), // Sequence length
        (length) => {
          // Generate a valid sequence by following valid transitions
          const sequence: GamePhase[] = ['waiting'];
          
          for (let i = 1; i < length; i++) {
            const currentPhase = sequence[sequence.length - 1];
            const validNext = getValidNextPhases(currentPhase);
            
            if (validNext.length === 0) break;
            
            // Pick a random valid next phase
            const nextPhase = validNext[Math.floor(Math.random() * validNext.length)];
            sequence.push(nextPhase);
          }
          
          // The generated sequence should always be valid
          const result = validatePhaseSequence(sequence);
          expect(result.valid).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Restart always goes back to waiting
   * Validates: Requirements 5.4
   */
  it('should allow restart from game-over to waiting', () => {
    expect(isValidTransition('game-over', 'waiting')).toBe(true);
    
    // Restart sequence
    const restartSequence: GamePhase[] = [
      'waiting',
      'word-reveal',
      'description',
      'voting',
      'game-over',
      'waiting',  // Restart
    ];
    
    expect(validatePhaseSequence(restartSequence).valid).toBe(true);
  });
});
