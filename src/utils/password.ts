/**
 * Password hashing utilities for Who is the Spy game
 * Uses Web Crypto API (available in Cloudflare Workers)
 * Requirements: 1.2, 2.2
 */

/**
 * Generates a random salt for password hashing.
 * 
 * @returns A hex-encoded salt string
 */
function generateSalt(): string {
  const saltBytes = new Uint8Array(16);
  crypto.getRandomValues(saltBytes);
  return Array.from(saltBytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Converts a string to Uint8Array for crypto operations.
 * 
 * @param str - The string to convert
 * @returns Uint8Array representation
 */
function stringToBytes(str: string): Uint8Array {
  return new TextEncoder().encode(str);
}

/**
 * Converts Uint8Array to hex string.
 * 
 * @param bytes - The bytes to convert
 * @returns Hex-encoded string
 */
function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Hashes a password using SHA-256 with a random salt.
 * Returns the hash in format: salt:hash
 * 
 * @param password - The password to hash
 * @returns A string in format "salt:hash"
 * 
 * Requirements: 1.2 - WHEN creating a room, THE Game_System SHALL require a 4-8 character password
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = generateSalt();
  const saltedPassword = salt + password;
  const hashBuffer = await crypto.subtle.digest('SHA-256', stringToBytes(saltedPassword));
  const hash = bytesToHex(new Uint8Array(hashBuffer));
  return `${salt}:${hash}`;
}

/**
 * Verifies a password against a stored hash.
 * 
 * @param password - The password to verify
 * @param storedHash - The stored hash in format "salt:hash"
 * @returns true if the password matches, false otherwise
 * 
 * Requirements: 2.2 - WHEN a player attempts to join with an incorrect password, 
 * THE Game_System SHALL display an error message and reject the join request
 */
export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  const parts = storedHash.split(':');
  if (parts.length !== 2) {
    return false;
  }
  
  const [salt, expectedHash] = parts;
  const saltedPassword = salt + password;
  const hashBuffer = await crypto.subtle.digest('SHA-256', stringToBytes(saltedPassword));
  const actualHash = bytesToHex(new Uint8Array(hashBuffer));
  
  // Use constant-time comparison to prevent timing attacks
  return constantTimeEqual(actualHash, expectedHash);
}

/**
 * Constant-time string comparison to prevent timing attacks.
 * 
 * @param a - First string
 * @param b - Second string
 * @returns true if strings are equal, false otherwise
 */
function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }
  
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}
