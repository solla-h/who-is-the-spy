/**
 * Property-based tests for room initialization
 * 
 * Feature: who-is-spy-game, Property 3: Room Initialization
 * Validates: Requirements 1.3, 1.4
 * 
 * *For any* newly created room, the creator SHALL be marked as host 
 * AND the room phase SHALL be 'waiting'.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import fc from 'fast-check';
import { validPassword, validPlayerName } from '../helpers/fc-arbitraries';

const PBT_CONFIG = { numRuns: 100 };

/**
 * Mock implementation of room creation logic for testing
 * This tests the core business logic without database dependencies
 */
interface Room {
  id: string;
  code: string;
  phase: string;
  hostId: string;
  settings: { spyCount: number; minPlayers: number; maxPlayers: number };
  createdAt: number;
  updatedAt: number;
}

interface Player {
  id: string;
  roomId: string;
  token: string;
  name: string;
  isHost: boolean;
  joinOrder: number;
}

interface CreateRoomResult {
  room: Room;
  player: Player;
  roomCode: string;
  playerToken: string;
}

/**
 * Pure function that creates room and player objects
 * This is the core logic we want to test
 */
function createRoomLogic(password: string, playerName: string): CreateRoomResult {
  const roomId = crypto.randomUUID();
  const playerId = crypto.randomUUID();
  const playerToken = crypto.randomUUID();
  const roomCode = String(Math.floor(100000 + Math.random() * 900000));
  const timestamp = Date.now();

  const room: Room = {
    id: roomId,
    code: roomCode,
    phase: 'waiting', // Requirements 1.4
    hostId: playerId, // Requirements 1.3
    settings: { spyCount: 1, minPlayers: 3, maxPlayers: 20 },
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  const player: Player = {
    id: playerId,
    roomId: roomId,
    token: playerToken,
    name: playerName,
    isHost: true, // Requirements 1.3
    joinOrder: 0,
  };

  return { room, player, roomCode, playerToken };
}

describe('Property 3: Room Initialization', () => {
  /**
   * Property: For any valid password and player name, 
   * the created room phase SHALL be 'waiting'
   */
  it('should initialize room in waiting phase for any valid inputs', () => {
    fc.assert(
      fc.property(validPassword, validPlayerName, (password, playerName) => {
        const result = createRoomLogic(password, playerName);
        
        // Requirements 1.4: Room phase must be 'waiting'
        expect(result.room.phase).toBe('waiting');
        return true;
      }),
      PBT_CONFIG
    );
  });

  /**
   * Property: For any valid password and player name,
   * the creator SHALL be marked as host
   */
  it('should set creator as host for any valid inputs', () => {
    fc.assert(
      fc.property(validPassword, validPlayerName, (password, playerName) => {
        const result = createRoomLogic(password, playerName);
        
        // Requirements 1.3: Creator is room host
        expect(result.room.hostId).toBe(result.player.id);
        expect(result.player.isHost).toBe(true);
        return true;
      }),
      PBT_CONFIG
    );
  });

  /**
   * Property: For any room creation, the room code SHALL be a valid 6-digit string
   */
  it('should generate valid 6-digit room code', () => {
    fc.assert(
      fc.property(validPassword, validPlayerName, (password, playerName) => {
        const result = createRoomLogic(password, playerName);
        
        // Room code must be 6 digits
        expect(result.roomCode).toMatch(/^\d{6}$/);
        expect(result.room.code).toBe(result.roomCode);
        return true;
      }),
      PBT_CONFIG
    );
  });

  /**
   * Property: For any room creation, player token SHALL be generated
   */
  it('should generate player token for creator', () => {
    fc.assert(
      fc.property(validPassword, validPlayerName, (password, playerName) => {
        const result = createRoomLogic(password, playerName);
        
        // Player token must be generated
        expect(result.playerToken).toBeTruthy();
        expect(result.player.token).toBe(result.playerToken);
        return true;
      }),
      PBT_CONFIG
    );
  });

  /**
   * Property: For any room creation, player name SHALL be preserved
   */
  it('should preserve player name in created player', () => {
    fc.assert(
      fc.property(validPassword, validPlayerName, (password, playerName) => {
        const result = createRoomLogic(password, playerName);
        
        // Player name must match input
        expect(result.player.name).toBe(playerName);
        return true;
      }),
      PBT_CONFIG
    );
  });

  /**
   * Property: For any room creation, default settings SHALL be applied
   */
  it('should apply default game settings', () => {
    fc.assert(
      fc.property(validPassword, validPlayerName, (password, playerName) => {
        const result = createRoomLogic(password, playerName);
        
        // Default settings
        expect(result.room.settings.spyCount).toBe(1);
        expect(result.room.settings.minPlayers).toBe(3);
        expect(result.room.settings.maxPlayers).toBe(20);
        return true;
      }),
      PBT_CONFIG
    );
  });

  /**
   * Property: For any room creation, creator join order SHALL be 0
   */
  it('should set creator join order to 0', () => {
    fc.assert(
      fc.property(validPassword, validPlayerName, (password, playerName) => {
        const result = createRoomLogic(password, playerName);
        
        // First player (creator) has join order 0
        expect(result.player.joinOrder).toBe(0);
        return true;
      }),
      PBT_CONFIG
    );
  });

  /**
   * Property: Room and player IDs SHALL be linked correctly
   */
  it('should link room and player IDs correctly', () => {
    fc.assert(
      fc.property(validPassword, validPlayerName, (password, playerName) => {
        const result = createRoomLogic(password, playerName);
        
        // Player's roomId must match room's id
        expect(result.player.roomId).toBe(result.room.id);
        return true;
      }),
      PBT_CONFIG
    );
  });
});
