/**
 * Property-based tests for game state serialization
 * 
 * Feature: who-is-spy-game, Property 16: Game State Serialization Round-Trip
 * Validates: Requirements 12.3
 * 
 * *For any* valid game state object, serializing to JSON and deserializing back
 * SHALL produce an equivalent object.
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import {
  gameStateToJSON,
  gameStateFromJSON,
  areGameStatesEquivalent,
  type SerializableGameState,
  type SerializablePlayer,
  type SerializableDescription,
  type SerializableVote,
} from '../../src/utils/serialization';
import type { GamePhase, PlayerRole } from '../../src/types';
import { uuid } from '../helpers/fc-arbitraries';

const PBT_CONFIG = { numRuns: 100 };

// Typed arbitraries for game-specific types
const typedGamePhase: fc.Arbitrary<GamePhase> = fc.constantFrom(
  'waiting' as const,
  'word-reveal' as const,
  'description' as const,
  'voting' as const,
  'result' as const,
  'game-over' as const
);

const typedPlayerRole: fc.Arbitrary<PlayerRole> = fc.constantFrom(
  'civilian' as const,
  'spy' as const
);

/**
 * Arbitrary for SerializablePlayer
 */
const serializablePlayer: fc.Arbitrary<SerializablePlayer> = fc.record({
  id: uuid,
  name: fc.string({ minLength: 2, maxLength: 10 }),
  token: uuid,
  role: fc.option(typedPlayerRole, { nil: null }),
  isAlive: fc.boolean(),
  isOnline: fc.boolean(),
  isHost: fc.boolean(),
  joinOrder: fc.nat({ max: 100 }),
  lastSeen: fc.nat(),
});

/**
 * Arbitrary for SerializableDescription
 */
const serializableDescription: fc.Arbitrary<SerializableDescription> = fc.record({
  id: uuid,
  playerId: uuid,
  round: fc.integer({ min: 1, max: 100 }),
  text: fc.string({ minLength: 5, maxLength: 50 }),
  createdAt: fc.nat(),
});

/**
 * Arbitrary for SerializableVote
 */
const serializableVote: fc.Arbitrary<SerializableVote> = fc.record({
  id: uuid,
  voterId: uuid,
  targetId: uuid,
  round: fc.integer({ min: 1, max: 100 }),
  createdAt: fc.nat(),
});

/**
 * Arbitrary for GameState (inner)
 */
const gameStateInner = fc.record({
  eliminatedPlayers: fc.array(uuid, { maxLength: 10 }),
  spyIds: fc.array(uuid, { maxLength: 5 }),
  winner: fc.option(fc.constantFrom('civilian' as const, 'spy' as const), { nil: undefined }),
});

/**
 * Arbitrary for GameSettings
 */
const gameSettings = fc.record({
  spyCount: fc.integer({ min: 1, max: 10 }),
  minPlayers: fc.integer({ min: 3, max: 10 }),
  maxPlayers: fc.integer({ min: 10, max: 50 }),
});

/**
 * Arbitrary for complete SerializableGameState
 */
const serializableGameState: fc.Arbitrary<SerializableGameState> = fc.record({
  roomId: uuid,
  roomCode: fc.string({ minLength: 6, maxLength: 6 }).filter(s => /^\d{6}$/.test(s) || true).map(() => 
    String(Math.floor(100000 + Math.random() * 900000))
  ),
  phase: typedGamePhase,
  currentTurn: fc.nat({ max: 20 }),
  round: fc.integer({ min: 1, max: 100 }),
  civilianWord: fc.option(fc.string({ minLength: 2, maxLength: 10 }), { nil: null }),
  spyWord: fc.option(fc.string({ minLength: 2, maxLength: 10 }), { nil: null }),
  gameState: fc.option(gameStateInner, { nil: null }),
  settings: gameSettings,
  players: fc.array(serializablePlayer, { minLength: 0, maxLength: 10 }),
  descriptions: fc.array(serializableDescription, { minLength: 0, maxLength: 20 }),
  votes: fc.array(serializableVote, { minLength: 0, maxLength: 20 }),
  createdAt: fc.nat(),
  updatedAt: fc.nat(),
});

describe('Property 16: Game State Serialization Round-Trip', () => {
  /**
   * Property: For any valid game state, serializing to JSON and deserializing back
   * SHALL produce an equivalent object
   */
  it('should produce equivalent object after round-trip serialization', () => {
    fc.assert(
      fc.property(serializableGameState, (state) => {
        // Serialize to JSON
        const json = gameStateToJSON(state);
        
        // Deserialize back
        const restored = gameStateFromJSON(json);
        
        // Check equivalence
        const equivalent = areGameStatesEquivalent(state, restored);
        expect(equivalent).toBe(true);
        
        return equivalent;
      }),
      PBT_CONFIG
    );
  });

  /**
   * Property: Serialization should produce valid JSON
   */
  it('should produce valid JSON string', () => {
    fc.assert(
      fc.property(serializableGameState, (state) => {
        const json = gameStateToJSON(state);
        
        // Should be a non-empty string
        expect(typeof json).toBe('string');
        expect(json.length).toBeGreaterThan(0);
        
        // Should be parseable JSON
        expect(() => JSON.parse(json)).not.toThrow();
        
        return true;
      }),
      PBT_CONFIG
    );
  });

  /**
   * Property: Room ID should be preserved after round-trip
   */
  it('should preserve roomId after round-trip', () => {
    fc.assert(
      fc.property(serializableGameState, (state) => {
        const json = gameStateToJSON(state);
        const restored = gameStateFromJSON(json);
        
        expect(restored.roomId).toBe(state.roomId);
        return true;
      }),
      PBT_CONFIG
    );
  });

  /**
   * Property: Phase should be preserved after round-trip
   */
  it('should preserve phase after round-trip', () => {
    fc.assert(
      fc.property(serializableGameState, (state) => {
        const json = gameStateToJSON(state);
        const restored = gameStateFromJSON(json);
        
        expect(restored.phase).toBe(state.phase);
        return true;
      }),
      PBT_CONFIG
    );
  });

  /**
   * Property: Players array should be preserved after round-trip
   */
  it('should preserve players array after round-trip', () => {
    fc.assert(
      fc.property(serializableGameState, (state) => {
        const json = gameStateToJSON(state);
        const restored = gameStateFromJSON(json);
        
        expect(restored.players.length).toBe(state.players.length);
        
        for (let i = 0; i < state.players.length; i++) {
          expect(restored.players[i].id).toBe(state.players[i].id);
          expect(restored.players[i].name).toBe(state.players[i].name);
          expect(restored.players[i].role).toBe(state.players[i].role);
          expect(restored.players[i].isAlive).toBe(state.players[i].isAlive);
        }
        
        return true;
      }),
      PBT_CONFIG
    );
  });

  /**
   * Property: Settings should be preserved after round-trip
   */
  it('should preserve settings after round-trip', () => {
    fc.assert(
      fc.property(serializableGameState, (state) => {
        const json = gameStateToJSON(state);
        const restored = gameStateFromJSON(json);
        
        expect(restored.settings.spyCount).toBe(state.settings.spyCount);
        expect(restored.settings.minPlayers).toBe(state.settings.minPlayers);
        expect(restored.settings.maxPlayers).toBe(state.settings.maxPlayers);
        
        return true;
      }),
      PBT_CONFIG
    );
  });

  /**
   * Property: Words should be preserved after round-trip (including null values)
   */
  it('should preserve words after round-trip', () => {
    fc.assert(
      fc.property(serializableGameState, (state) => {
        const json = gameStateToJSON(state);
        const restored = gameStateFromJSON(json);
        
        expect(restored.civilianWord).toBe(state.civilianWord);
        expect(restored.spyWord).toBe(state.spyWord);
        
        return true;
      }),
      PBT_CONFIG
    );
  });

  /**
   * Property: Game state (inner) should be preserved after round-trip
   */
  it('should preserve game state after round-trip', () => {
    fc.assert(
      fc.property(serializableGameState, (state) => {
        const json = gameStateToJSON(state);
        const restored = gameStateFromJSON(json);
        
        if (state.gameState === null) {
          expect(restored.gameState).toBeNull();
        } else {
          expect(restored.gameState).not.toBeNull();
          expect(restored.gameState!.winner).toBe(state.gameState.winner);
          expect(restored.gameState!.eliminatedPlayers).toEqual(state.gameState.eliminatedPlayers);
          expect(restored.gameState!.spyIds).toEqual(state.gameState.spyIds);
        }
        
        return true;
      }),
      PBT_CONFIG
    );
  });

  /**
   * Property: Descriptions should be preserved after round-trip
   */
  it('should preserve descriptions after round-trip', () => {
    fc.assert(
      fc.property(serializableGameState, (state) => {
        const json = gameStateToJSON(state);
        const restored = gameStateFromJSON(json);
        
        expect(restored.descriptions.length).toBe(state.descriptions.length);
        
        for (let i = 0; i < state.descriptions.length; i++) {
          expect(restored.descriptions[i].id).toBe(state.descriptions[i].id);
          expect(restored.descriptions[i].text).toBe(state.descriptions[i].text);
          expect(restored.descriptions[i].round).toBe(state.descriptions[i].round);
        }
        
        return true;
      }),
      PBT_CONFIG
    );
  });

  /**
   * Property: Votes should be preserved after round-trip
   */
  it('should preserve votes after round-trip', () => {
    fc.assert(
      fc.property(serializableGameState, (state) => {
        const json = gameStateToJSON(state);
        const restored = gameStateFromJSON(json);
        
        expect(restored.votes.length).toBe(state.votes.length);
        
        for (let i = 0; i < state.votes.length; i++) {
          expect(restored.votes[i].id).toBe(state.votes[i].id);
          expect(restored.votes[i].voterId).toBe(state.votes[i].voterId);
          expect(restored.votes[i].targetId).toBe(state.votes[i].targetId);
        }
        
        return true;
      }),
      PBT_CONFIG
    );
  });

  /**
   * Property: Timestamps should be preserved after round-trip
   */
  it('should preserve timestamps after round-trip', () => {
    fc.assert(
      fc.property(serializableGameState, (state) => {
        const json = gameStateToJSON(state);
        const restored = gameStateFromJSON(json);
        
        expect(restored.createdAt).toBe(state.createdAt);
        expect(restored.updatedAt).toBe(state.updatedAt);
        
        return true;
      }),
      PBT_CONFIG
    );
  });
});
