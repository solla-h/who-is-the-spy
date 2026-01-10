/**
 * Room code generation utilities for Who is the Spy game
 * Requirements: 1.1
 */

/**
 * Generates a unique 6-digit room code.
 * 
 * @returns A 6-digit string room code
 * 
 * Requirements: 1.1 - WHEN a player clicks the create room button, 
 * THE Game_System SHALL generate a unique 6-digit room code
 */
export function generateRoomCode(): string {
  // Generate a random 6-digit number (100000 - 999999)
  const code = Math.floor(100000 + Math.random() * 900000);
  return code.toString();
}

/**
 * Checks if a room code already exists in the database.
 * Used to ensure uniqueness before creating a room.
 * 
 * @param db - D1 database instance
 * @param code - The room code to check
 * @returns true if the code exists, false otherwise
 */
export async function roomCodeExists(db: D1Database, code: string): Promise<boolean> {
  const result = await db.prepare('SELECT 1 FROM rooms WHERE code = ?').bind(code).first();
  return result !== null;
}

/**
 * Generates a unique room code that doesn't exist in the database.
 * Retries with different codes if collision occurs.
 * 
 * @param db - D1 database instance
 * @param maxRetries - Maximum number of retry attempts (default: 10)
 * @returns A unique 6-digit room code
 * @throws Error if unable to generate unique code after max retries
 * 
 * Requirements: 1.5 - IF the room code generation fails, 
 * THEN THE Game_System SHALL retry with a different code
 */
export async function generateUniqueRoomCode(
  db: D1Database,
  maxRetries: number = 10
): Promise<string> {
  for (let i = 0; i < maxRetries; i++) {
    const code = generateRoomCode();
    const exists = await roomCodeExists(db, code);
    if (!exists) {
      return code;
    }
  }
  throw new Error('Failed to generate unique room code after maximum retries');
}
