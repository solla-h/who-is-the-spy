/**
 * Input validation utilities for Who is the Spy game
 * Requirements: 1.2, 3.1, 3.4
 */

/**
 * Validates a room password.
 * Password must be 4-8 characters.
 * 
 * @param password - The password to validate
 * @returns true if valid, false otherwise
 * 
 * Requirements: 1.2 - WHEN creating a room, THE Game_System SHALL require a 4-8 character password
 */
export function validatePassword(password: string): boolean {
  if (typeof password !== 'string') {
    return false;
  }
  const length = password.length;
  return length >= 4 && length <= 8;
}

/**
 * Validates a player display name.
 * Name must be 2-10 characters and cannot be only whitespace.
 * 
 * @param name - The player name to validate
 * @returns true if valid, false otherwise
 * 
 * Requirements: 3.1 - THE Game_System SHALL require a display name between 2-10 characters
 * Requirements: 3.4 - WHEN a player name contains only whitespace, THE Game_System SHALL reject the name
 */
export function validatePlayerName(name: string): boolean {
  if (typeof name !== 'string') {
    return false;
  }
  
  // Check if name is only whitespace
  const trimmed = name.trim();
  if (trimmed.length === 0) {
    return false;
  }
  
  // Check length (2-10 characters)
  const length = name.length;
  return length >= 2 && length <= 10;
}

/**
 * Validates a room code.
 * Room code must be exactly 6 digits.
 * 
 * @param code - The room code to validate
 * @returns true if valid, false otherwise
 * 
 * Requirements: 1.1 - THE Game_System SHALL generate a unique 6-digit room code
 */
export function validateRoomCode(code: string): boolean {
  if (typeof code !== 'string') {
    return false;
  }
  
  // Must be exactly 6 characters and all digits
  return /^\d{6}$/.test(code);
}
