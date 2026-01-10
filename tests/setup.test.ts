/**
 * Basic test to verify test framework setup
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { randomString, generateUUID, createMockPlayer } from './helpers/test-utils';
import { validPassword, validPlayerName, validRoomCode } from './helpers/fc-arbitraries';

describe('Test Framework Setup', () => {
  it('should run basic assertions', () => {
    expect(1 + 1).toBe(2);
    expect('hello').toContain('ell');
  });

  it('should use test utilities', () => {
    const str = randomString(10);
    expect(str).toHaveLength(10);

    const uuid = generateUUID();
    expect(uuid).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);

    const player = createMockPlayer({ name: '测试玩家' });
    expect(player.name).toBe('测试玩家');
    expect(player.isAlive).toBe(true);
  });

  it('should run fast-check property tests', () => {
    fc.assert(
      fc.property(fc.integer(), fc.integer(), (a, b) => {
        return a + b === b + a; // Commutative property
      }),
      { numRuns: 100 }
    );
  });

  it('should use custom arbitraries', () => {
    fc.assert(
      fc.property(validPassword, (password) => {
        return password.length >= 4 && password.length <= 8;
      }),
      { numRuns: 100 }
    );

    fc.assert(
      fc.property(validPlayerName, (name) => {
        return name.length >= 2 && name.length <= 10 && name.trim().length > 0;
      }),
      { numRuns: 100 }
    );

    fc.assert(
      fc.property(validRoomCode, (code) => {
        return /^\d{6}$/.test(code);
      }),
      { numRuns: 100 }
    );
  });
});
