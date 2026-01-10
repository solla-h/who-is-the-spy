/**
 * Unit tests for password hashing utilities
 * Requirements: 1.2, 2.2
 */

import { describe, it, expect } from 'vitest';
import { hashPassword, verifyPassword } from '../../src/utils/password';

describe('Password Hashing (Requirements 1.2, 2.2)', () => {
  it('should hash a password and return salt:hash format', async () => {
    const password = 'test1234';
    const hash = await hashPassword(password);
    
    // Should be in format salt:hash
    expect(hash).toContain(':');
    const parts = hash.split(':');
    expect(parts).toHaveLength(2);
    
    // Salt should be 32 hex characters (16 bytes)
    expect(parts[0]).toHaveLength(32);
    expect(parts[0]).toMatch(/^[0-9a-f]+$/);
    
    // Hash should be 64 hex characters (SHA-256 = 32 bytes)
    expect(parts[1]).toHaveLength(64);
    expect(parts[1]).toMatch(/^[0-9a-f]+$/);
  });

  it('should verify correct password', async () => {
    const password = 'mypassword';
    const hash = await hashPassword(password);
    
    const isValid = await verifyPassword(password, hash);
    expect(isValid).toBe(true);
  });

  it('should reject incorrect password', async () => {
    const password = 'mypassword';
    const hash = await hashPassword(password);
    
    const isValid = await verifyPassword('wrongpassword', hash);
    expect(isValid).toBe(false);
  });

  it('should generate different hashes for same password (due to random salt)', async () => {
    const password = 'samepassword';
    const hash1 = await hashPassword(password);
    const hash2 = await hashPassword(password);
    
    // Hashes should be different due to different salts
    expect(hash1).not.toBe(hash2);
    
    // But both should verify correctly
    expect(await verifyPassword(password, hash1)).toBe(true);
    expect(await verifyPassword(password, hash2)).toBe(true);
  });

  it('should reject invalid hash format', async () => {
    const isValid = await verifyPassword('password', 'invalidhashformat');
    expect(isValid).toBe(false);
  });

  it('should handle empty password', async () => {
    const hash = await hashPassword('');
    expect(hash).toContain(':');
    expect(await verifyPassword('', hash)).toBe(true);
    expect(await verifyPassword('notempty', hash)).toBe(false);
  });

  it('should handle special characters in password', async () => {
    const password = '!@#$%^&*()中文';
    const hash = await hashPassword(password);
    
    expect(await verifyPassword(password, hash)).toBe(true);
    expect(await verifyPassword('different', hash)).toBe(false);
  });
});
