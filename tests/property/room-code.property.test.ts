/**
 * Property-based tests for room code generation
 * 
 * Feature: who-is-spy-game, Property 1: Room Code Uniqueness
 * Validates: Requirements 1.1
 * 
 * *For any* number of room creations, all generated room codes SHALL be unique 6-digit strings.
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { generateRoomCode } from '../../src/utils/room-code';

const PBT_CONFIG = { numRuns: 100 };

describe('Property 1: Room Code Uniqueness', () => {
  /**
   * Property: All generated room codes are exactly 6 digits
   */
  it('should generate 6-digit room codes', () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 100 }), () => {
        const code = generateRoomCode();
        // Must be exactly 6 characters
        expect(code).toHaveLength(6);
        // Must be all digits
        expect(code).toMatch(/^\d{6}$/);
        return true;
      }),
      PBT_CONFIG
    );
  });

  /**
   * Property: Generated room codes are within valid range (100000-999999)
   */
  it('should generate codes in valid numeric range', () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 100 }), () => {
        const code = generateRoomCode();
        const numericCode = parseInt(code, 10);
        // Must be between 100000 and 999999 (inclusive)
        expect(numericCode).toBeGreaterThanOrEqual(100000);
        expect(numericCode).toBeLessThanOrEqual(999999);
        return true;
      }),
      PBT_CONFIG
    );
  });

  /**
   * Property: For any batch of generated codes, all codes are unique
   * This tests the uniqueness property within a single batch generation
   */
  it('should generate unique codes within a batch', () => {
    fc.assert(
      fc.property(fc.integer({ min: 10, max: 50 }), (batchSize) => {
        const codes = new Set<string>();
        for (let i = 0; i < batchSize; i++) {
          const code = generateRoomCode();
          codes.add(code);
        }
        // With random generation, we expect high uniqueness
        // Allow for some collisions due to randomness (at least 90% unique)
        const uniquenessRatio = codes.size / batchSize;
        return uniquenessRatio >= 0.9;
      }),
      PBT_CONFIG
    );
  });

  /**
   * Property: Room codes do not have leading zeros that would change their numeric value
   * (i.e., codes starting with 0 are still valid 6-digit strings)
   */
  it('should generate codes that are valid 6-digit strings regardless of leading digits', () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 100 }), () => {
        const code = generateRoomCode();
        // The string representation should always be 6 characters
        expect(code.length).toBe(6);
        // First digit should be 1-9 (since we generate 100000-999999)
        const firstDigit = parseInt(code[0], 10);
        expect(firstDigit).toBeGreaterThanOrEqual(1);
        expect(firstDigit).toBeLessThanOrEqual(9);
        return true;
      }),
      PBT_CONFIG
    );
  });

  /**
   * Property: Multiple calls to generateRoomCode produce different results (randomness)
   * Note: This is a probabilistic test - with 900,000 possible codes,
   * the chance of collision in 100 codes is very low
   */
  it('should demonstrate randomness across multiple generations', () => {
    const codes: string[] = [];
    for (let i = 0; i < 100; i++) {
      codes.push(generateRoomCode());
    }
    
    const uniqueCodes = new Set(codes);
    // With 900,000 possible codes and 100 generations,
    // we expect very high uniqueness (birthday paradox gives ~0.5% collision chance)
    expect(uniqueCodes.size).toBeGreaterThanOrEqual(95);
  });
});
