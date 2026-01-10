/**
 * fast-check arbitraries for property-based testing
 * Custom generators for game-specific data types
 */

import fc from 'fast-check';

/**
 * Generate valid password (4-8 characters)
 */
export const validPassword = fc.stringOf(
  fc.constantFrom(...'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'),
  { minLength: 4, maxLength: 8 }
);

/**
 * Generate invalid password (too short or too long)
 */
export const invalidPassword = fc.oneof(
  fc.stringOf(fc.char(), { minLength: 0, maxLength: 3 }),
  fc.stringOf(fc.char(), { minLength: 9, maxLength: 20 })
);

/**
 * Generate valid player name (2-10 non-whitespace characters)
 */
export const validPlayerName = fc.stringOf(
  fc.constantFrom(...'张王李赵刘陈杨黄周吴明华强伟芳娜秀英敏静丽abcdefghijklmnopqrstuvwxyz'),
  { minLength: 2, maxLength: 10 }
);

/**
 * Generate invalid player name (too short, too long, or whitespace only)
 */
export const invalidPlayerName = fc.oneof(
  fc.constant(''),
  fc.constant(' '),
  fc.stringOf(fc.constant(' '), { minLength: 1, maxLength: 10 }),
  fc.stringOf(fc.char(), { minLength: 11, maxLength: 20 })
);

/**
 * Generate valid 6-digit room code
 */
export const validRoomCode = fc.stringOf(fc.constantFrom(...'0123456789'), {
  minLength: 6,
  maxLength: 6,
});

/**
 * Generate invalid room code
 */
export const invalidRoomCode = fc.oneof(
  fc.stringOf(fc.constantFrom(...'0123456789'), { minLength: 0, maxLength: 5 }),
  fc.stringOf(fc.constantFrom(...'0123456789'), { minLength: 7, maxLength: 10 }),
  fc.stringOf(fc.char(), { minLength: 6, maxLength: 6 })
);

/**
 * Generate player count for game (3-20)
 */
export const validPlayerCount = fc.integer({ min: 3, max: 20 });

/**
 * Generate spy count based on player count
 */
export const validSpyCount = (playerCount: number) =>
  fc.integer({ min: 1, max: Math.max(1, playerCount - 2) });

/**
 * Generate game phase
 */
export const gamePhase = fc.constantFrom(
  'waiting',
  'word-reveal',
  'description',
  'voting',
  'result',
  'game-over'
);

/**
 * Generate player role
 */
export const playerRole = fc.constantFrom('civilian', 'spy');

/**
 * Generate UUID-like string
 */
export const uuid = fc.uuid();

/**
 * Generate word pair
 */
export const wordPair = fc.record({
  civilian: fc.stringOf(fc.constantFrom(...'苹果梨子火锅麻辣烫饺子馄饨'), { minLength: 2, maxLength: 4 }),
  spy: fc.stringOf(fc.constantFrom(...'苹果梨子火锅麻辣烫饺子馄饨'), { minLength: 2, maxLength: 4 }),
  category: fc.constantFrom('食物', '动物', '物品', '地点', '品牌', '娱乐'),
});

/**
 * Generate description text (5-50 characters, no word included)
 */
export const validDescription = fc.stringOf(
  fc.constantFrom(...'这是一个很好的东西我喜欢它非常有趣味道不错颜色漂亮'),
  { minLength: 5, maxLength: 50 }
);

/**
 * Generate array of unique player names
 */
export const uniquePlayerNames = (count: number) =>
  fc.uniqueArray(validPlayerName, { minLength: count, maxLength: count });
