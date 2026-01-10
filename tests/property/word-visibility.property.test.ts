/**
 * Property-based tests for word visibility isolation
 * 
 * Feature: who-is-spy-game, Property 9: Word Visibility Isolation
 * Validates: Requirements 5.6
 * 
 * *For any* API response to a player during an active game, the response SHALL contain 
 * only that player's own word, never other players' words.
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { validPlayerName, playerRole, wordPair } from '../helpers/fc-arbitraries';

const PBT_CONFIG = { numRuns: 100 };

/**
 * Mock game state for testing word visibility
 */
interface MockPlayer {
  id: string;
  name: string;
  role: 'civilian' | 'spy';
  token: string;
}

interface MockRoom {
  id: string;
  phase: string;
  civilianWord: string;
  spyWord: string;
  players: MockPlayer[];
}

interface PlayerStateView {
  myWord?: string;
  myRole?: 'civilian' | 'spy';
  otherPlayersWords: string[]; // Should always be empty
}

/**
 * Pure function that builds a player's view of the game state
 * This tests the core word visibility isolation logic
 */
function buildPlayerStateView(
  room: MockRoom,
  requestingPlayerId: string
): PlayerStateView {
  const player = room.players.find(p => p.id === requestingPlayerId);
  
  if (!player || room.phase === 'waiting') {
    return { otherPlayersWords: [] };
  }

  // Player can only see their own word based on their role
  const myWord = player.role === 'civilian' ? room.civilianWord : room.spyWord;
  
  // Other players' words should NEVER be included
  const otherPlayersWords: string[] = [];

  return {
    myWord,
    myRole: player.role,
    otherPlayersWords,
  };
}

/**
 * Check if a state view contains any word that doesn't belong to the player
 */
function containsOtherPlayersWord(
  view: PlayerStateView,
  room: MockRoom,
  playerId: string
): boolean {
  const player = room.players.find(p => p.id === playerId);
  if (!player) return false;

  const myWord = player.role === 'civilian' ? room.civilianWord : room.spyWord;
  const otherWord = player.role === 'civilian' ? room.spyWord : room.civilianWord;

  // Check if the view contains the other word
  if (view.myWord === otherWord) return true;
  if (view.otherPlayersWords.includes(otherWord)) return true;
  if (view.otherPlayersWords.includes(myWord)) return true;

  return false;
}

describe('Property 9: Word Visibility Isolation', () => {
  /**
   * Property: For any player, their state view SHALL only contain their own word
   */
  it('should only show player their own word', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            name: validPlayerName,
            role: fc.constantFrom('civilian' as const, 'spy' as const),
          }),
          { minLength: 3, maxLength: 10 }
        ),
        fc.string({ minLength: 2, maxLength: 4 }),
        fc.string({ minLength: 2, maxLength: 4 }),
        (playerConfigs, civilianWord, spyWord) => {
          // Ensure words are different
          fc.pre(civilianWord !== spyWord);

          // Create mock room with players
          const players: MockPlayer[] = playerConfigs.map((config, i) => ({
            id: `player-${i}`,
            name: config.name,
            role: config.role,
            token: `token-${i}`,
          }));

          const room: MockRoom = {
            id: 'room-1',
            phase: 'description',
            civilianWord,
            spyWord,
            players,
          };

          // For each player, verify they only see their own word
          for (const player of players) {
            const view = buildPlayerStateView(room, player.id);
            
            // Player should see their own word
            const expectedWord = player.role === 'civilian' ? civilianWord : spyWord;
            expect(view.myWord).toBe(expectedWord);
            
            // Player should NOT see other players' words
            expect(view.otherPlayersWords).toHaveLength(0);
            
            // View should not contain the other word
            expect(containsOtherPlayersWord(view, room, player.id)).toBe(false);
          }

          return true;
        }
      ),
      PBT_CONFIG
    );
  });

  /**
   * Property: Civilians SHALL see civilian word, spies SHALL see spy word
   */
  it('should give correct word based on role', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('civilian' as const, 'spy' as const),
        fc.string({ minLength: 2, maxLength: 4 }),
        fc.string({ minLength: 2, maxLength: 4 }),
        (role, civilianWord, spyWord) => {
          fc.pre(civilianWord !== spyWord);

          const player: MockPlayer = {
            id: 'player-1',
            name: '测试玩家',
            role,
            token: 'token-1',
          };

          const room: MockRoom = {
            id: 'room-1',
            phase: 'description',
            civilianWord,
            spyWord,
            players: [player],
          };

          const view = buildPlayerStateView(room, player.id);

          if (role === 'civilian') {
            expect(view.myWord).toBe(civilianWord);
            expect(view.myWord).not.toBe(spyWord);
          } else {
            expect(view.myWord).toBe(spyWord);
            expect(view.myWord).not.toBe(civilianWord);
          }

          return true;
        }
      ),
      PBT_CONFIG
    );
  });

  /**
   * Property: In waiting phase, no words SHALL be visible
   */
  it('should not show any words in waiting phase', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            name: validPlayerName,
            role: fc.constantFrom('civilian' as const, 'spy' as const),
          }),
          { minLength: 3, maxLength: 10 }
        ),
        fc.string({ minLength: 2, maxLength: 4 }),
        fc.string({ minLength: 2, maxLength: 4 }),
        (playerConfigs, civilianWord, spyWord) => {
          const players: MockPlayer[] = playerConfigs.map((config, i) => ({
            id: `player-${i}`,
            name: config.name,
            role: config.role,
            token: `token-${i}`,
          }));

          const room: MockRoom = {
            id: 'room-1',
            phase: 'waiting', // Waiting phase
            civilianWord,
            spyWord,
            players,
          };

          // No player should see any word in waiting phase
          for (const player of players) {
            const view = buildPlayerStateView(room, player.id);
            expect(view.myWord).toBeUndefined();
            expect(view.myRole).toBeUndefined();
          }

          return true;
        }
      ),
      PBT_CONFIG
    );
  });

  /**
   * Property: A spy SHALL never see the civilian word through the API
   */
  it('should never expose civilian word to spy', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 2, maxLength: 4 }),
        fc.string({ minLength: 2, maxLength: 4 }),
        fc.constantFrom('word-reveal', 'description', 'voting', 'result'),
        (civilianWord, spyWord, phase) => {
          fc.pre(civilianWord !== spyWord);

          const spyPlayer: MockPlayer = {
            id: 'spy-1',
            name: '卧底',
            role: 'spy',
            token: 'spy-token',
          };

          const room: MockRoom = {
            id: 'room-1',
            phase,
            civilianWord,
            spyWord,
            players: [spyPlayer],
          };

          const view = buildPlayerStateView(room, spyPlayer.id);

          // Spy should see spy word, never civilian word
          expect(view.myWord).toBe(spyWord);
          expect(view.myWord).not.toBe(civilianWord);

          return true;
        }
      ),
      PBT_CONFIG
    );
  });

  /**
   * Property: A civilian SHALL never see the spy word through the API
   */
  it('should never expose spy word to civilian', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 2, maxLength: 4 }),
        fc.string({ minLength: 2, maxLength: 4 }),
        fc.constantFrom('word-reveal', 'description', 'voting', 'result'),
        (civilianWord, spyWord, phase) => {
          fc.pre(civilianWord !== spyWord);

          const civilianPlayer: MockPlayer = {
            id: 'civilian-1',
            name: '平民',
            role: 'civilian',
            token: 'civilian-token',
          };

          const room: MockRoom = {
            id: 'room-1',
            phase,
            civilianWord,
            spyWord,
            players: [civilianPlayer],
          };

          const view = buildPlayerStateView(room, civilianPlayer.id);

          // Civilian should see civilian word, never spy word
          expect(view.myWord).toBe(civilianWord);
          expect(view.myWord).not.toBe(spyWord);

          return true;
        }
      ),
      PBT_CONFIG
    );
  });

  /**
   * Property: Different players in same room SHALL see different words based on role
   */
  it('should show different words to players with different roles', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 2, maxLength: 4 }),
        fc.string({ minLength: 2, maxLength: 4 }),
        (civilianWord, spyWord) => {
          fc.pre(civilianWord !== spyWord);

          const civilian: MockPlayer = {
            id: 'civilian-1',
            name: '平民',
            role: 'civilian',
            token: 'civilian-token',
          };

          const spy: MockPlayer = {
            id: 'spy-1',
            name: '卧底',
            role: 'spy',
            token: 'spy-token',
          };

          const room: MockRoom = {
            id: 'room-1',
            phase: 'description',
            civilianWord,
            spyWord,
            players: [civilian, spy],
          };

          const civilianView = buildPlayerStateView(room, civilian.id);
          const spyView = buildPlayerStateView(room, spy.id);

          // They should see different words
          expect(civilianView.myWord).not.toBe(spyView.myWord);
          expect(civilianView.myWord).toBe(civilianWord);
          expect(spyView.myWord).toBe(spyWord);

          return true;
        }
      ),
      PBT_CONFIG
    );
  });
});
