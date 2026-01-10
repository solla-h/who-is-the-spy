/**
 * Test utilities and helpers for Who is the Spy game tests
 */

/**
 * Generate a random string of specified length
 */
export function randomString(length: number, charset = 'abcdefghijklmnopqrstuvwxyz'): string {
  let result = '';
  for (let i = 0; i < length; i++) {
    result += charset.charAt(Math.floor(Math.random() * charset.length));
  }
  return result;
}

/**
 * Generate a random Chinese name (2-4 characters)
 */
export function randomChineseName(): string {
  const chars = '张王李赵刘陈杨黄周吴明华强伟芳娜秀英敏静丽';
  const length = 2 + Math.floor(Math.random() * 3);
  let name = '';
  for (let i = 0; i < length; i++) {
    name += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return name;
}

/**
 * Generate a random 6-digit room code
 */
export function randomRoomCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

/**
 * Generate a UUID v4
 */
export function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Create a mock player object
 */
export interface MockPlayer {
  id: string;
  name: string;
  token: string;
  role: 'civilian' | 'spy' | null;
  isAlive: boolean;
  isHost: boolean;
}

export function createMockPlayer(overrides: Partial<MockPlayer> = {}): MockPlayer {
  return {
    id: generateUUID(),
    name: randomChineseName(),
    token: generateUUID(),
    role: null,
    isAlive: true,
    isHost: false,
    ...overrides,
  };
}

/**
 * Create multiple mock players
 */
export function createMockPlayers(count: number, hostIndex = 0): MockPlayer[] {
  return Array.from({ length: count }, (_, i) =>
    createMockPlayer({ isHost: i === hostIndex })
  );
}

/**
 * Delay execution for specified milliseconds
 */
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
