/**
 * Property-based tests for input validation
 * 
 * Feature: who-is-spy-game, Property 2: Input Validation
 * Validates: Requirements 1.2, 3.1, 3.4
 * 
 * *For any* password input, the system SHALL accept only strings of 4-8 characters;
 * *for any* player name input, the system SHALL accept only strings of 2-10 non-whitespace characters.
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { validatePassword, validatePlayerName, validateRoomCode } from '../../src/utils/validation';
import {
  validPassword,
  invalidPassword,
  validPlayerName,
  invalidPlayerName,
  validRoomCode,
  invalidRoomCode,
} from '../helpers/fc-arbitraries';

const PBT_CONFIG = { numRuns: 100 };

describe('Property 2: Input Validation', () => {
  describe('Password Validation (Requirements 1.2)', () => {
    /**
     * Property: For any valid password (4-8 characters), validatePassword returns true
     */
    it('should accept all valid passwords (4-8 characters)', () => {
      fc.assert(
        fc.property(validPassword, (password) => {
          return validatePassword(password) === true;
        }),
        PBT_CONFIG
      );
    });

    /**
     * Property: For any password with length < 4 or > 8, validatePassword returns false
     */
    it('should reject all invalid passwords (length < 4 or > 8)', () => {
      fc.assert(
        fc.property(invalidPassword, (password) => {
          return validatePassword(password) === false;
        }),
        PBT_CONFIG
      );
    });

    /**
     * Property: Password length boundaries are correctly enforced
     */
    it('should enforce exact length boundaries (4 and 8)', () => {
      fc.assert(
        fc.property(fc.string(), (str) => {
          const result = validatePassword(str);
          const expectedValid = str.length >= 4 && str.length <= 8;
          return result === expectedValid;
        }),
        PBT_CONFIG
      );
    });
  });

  describe('Player Name Validation (Requirements 3.1, 3.4)', () => {
    /**
     * Property: For any valid player name (2-10 non-whitespace chars), validatePlayerName returns true
     */
    it('should accept all valid player names (2-10 non-whitespace characters)', () => {
      fc.assert(
        fc.property(validPlayerName, (name) => {
          return validatePlayerName(name) === true;
        }),
        PBT_CONFIG
      );
    });

    /**
     * Property: For any whitespace-only string, validatePlayerName returns false
     */
    it('should reject whitespace-only names', () => {
      fc.assert(
        fc.property(
          fc.stringOf(fc.constantFrom(' ', '\t', '\n', '\r'), { minLength: 1, maxLength: 10 }),
          (whitespaceOnly) => {
            return validatePlayerName(whitespaceOnly) === false;
          }
        ),
        PBT_CONFIG
      );
    });

    /**
     * Property: For any name with length < 2 or > 10, validatePlayerName returns false
     */
    it('should reject names with invalid length', () => {
      // Too short (0-1 characters)
      fc.assert(
        fc.property(
          fc.stringOf(fc.char(), { minLength: 0, maxLength: 1 }),
          (shortName) => {
            return validatePlayerName(shortName) === false;
          }
        ),
        PBT_CONFIG
      );

      // Too long (> 10 characters)
      fc.assert(
        fc.property(
          fc.stringOf(fc.char(), { minLength: 11, maxLength: 30 }),
          (longName) => {
            return validatePlayerName(longName) === false;
          }
        ),
        PBT_CONFIG
      );
    });

    /**
     * Property: Empty string is always rejected
     */
    it('should reject empty string', () => {
      expect(validatePlayerName('')).toBe(false);
    });
  });

  describe('Room Code Validation (Requirements 1.1)', () => {
    /**
     * Property: For any valid 6-digit room code, validateRoomCode returns true
     */
    it('should accept all valid 6-digit room codes', () => {
      fc.assert(
        fc.property(validRoomCode, (code) => {
          return validateRoomCode(code) === true;
        }),
        PBT_CONFIG
      );
    });

    /**
     * Property: For any string that is not exactly 6 digits, validateRoomCode returns false
     */
    it('should reject invalid room codes', () => {
      fc.assert(
        fc.property(invalidRoomCode, (code) => {
          return validateRoomCode(code) === false;
        }),
        PBT_CONFIG
      );
    });

    /**
     * Property: Room code must be exactly 6 characters
     */
    it('should enforce exact 6-character length', () => {
      fc.assert(
        fc.property(
          fc.stringOf(fc.constantFrom(...'0123456789'), { minLength: 0, maxLength: 10 }),
          (digitString) => {
            const result = validateRoomCode(digitString);
            const expectedValid = digitString.length === 6;
            return result === expectedValid;
          }
        ),
        PBT_CONFIG
      );
    });

    /**
     * Property: Room code must contain only digits
     */
    it('should reject codes with non-digit characters', () => {
      fc.assert(
        fc.property(
          fc.stringOf(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz!@#$%'), { minLength: 6, maxLength: 6 }),
          (nonDigitCode) => {
            return validateRoomCode(nonDigitCode) === false;
          }
        ),
        PBT_CONFIG
      );
    });
  });
});
