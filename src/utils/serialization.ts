/**
 * Game State Serialization utilities for Who is the Spy game
 * Requirements: 12.3 - JSON serialization for complex data structures
 * 
 * Property 16: Game State Serialization Round-Trip
 * For any valid game state object, serializing to JSON and deserializing back
 * SHALL produce an equivalent object.
 */

import type {
  GamePhase,
  GameSettings,
  GameState,
  PlayerRole,
  RoomStateResponse,
  PlayerInfo,
} from '../types';

/**
 * Serializable game state structure
 * This represents the complete state that can be serialized/deserialized
 */
export interface SerializableGameState {
  // Room information
  roomId: string;
  roomCode: string;
  phase: GamePhase;
  currentTurn: number;
  round: number;
  
  // Words (only present during active game)
  civilianWord: string | null;
  spyWord: string | null;
  
  // Game state
  gameState: GameState | null;
  
  // Settings
  settings: GameSettings;
  
  // Players
  players: SerializablePlayer[];
  
  // Descriptions
  descriptions: SerializableDescription[];
  
  // Votes
  votes: SerializableVote[];
  
  // Timestamps
  createdAt: number;
  updatedAt: number;
}

export interface SerializablePlayer {
  id: string;
  name: string;
  token: string;
  role: PlayerRole | null;
  isAlive: boolean;
  isOnline: boolean;
  isHost: boolean;
  joinOrder: number;
  lastSeen: number;
}

export interface SerializableDescription {
  id: string;
  playerId: string;
  round: number;
  text: string;
  createdAt: number;
}

export interface SerializableVote {
  id: string;
  voterId: string;
  targetId: string;
  round: number;
  createdAt: number;
}

/**
 * Serialize a game state object to JSON string
 * Handles all nested objects and ensures proper type conversion
 */
export function gameStateToJSON(state: SerializableGameState): string {
  // Create a clean copy to ensure all values are JSON-serializable
  const serializable = {
    roomId: state.roomId,
    roomCode: state.roomCode,
    phase: state.phase,
    currentTurn: state.currentTurn,
    round: state.round,
    civilianWord: state.civilianWord,
    spyWord: state.spyWord,
    gameState: state.gameState,
    settings: {
      spyCount: state.settings.spyCount,
      minPlayers: state.settings.minPlayers,
      maxPlayers: state.settings.maxPlayers,
    },
    players: state.players.map(p => ({
      id: p.id,
      name: p.name,
      token: p.token,
      role: p.role,
      isAlive: p.isAlive,
      isOnline: p.isOnline,
      isHost: p.isHost,
      joinOrder: p.joinOrder,
      lastSeen: p.lastSeen,
    })),
    descriptions: state.descriptions.map(d => ({
      id: d.id,
      playerId: d.playerId,
      round: d.round,
      text: d.text,
      createdAt: d.createdAt,
    })),
    votes: state.votes.map(v => ({
      id: v.id,
      voterId: v.voterId,
      targetId: v.targetId,
      round: v.round,
      createdAt: v.createdAt,
    })),
    createdAt: state.createdAt,
    updatedAt: state.updatedAt,
  };

  return JSON.stringify(serializable);
}

/**
 * Deserialize a JSON string back to a game state object
 * Validates and reconstructs the proper types
 */
export function gameStateFromJSON(json: string): SerializableGameState {
  const parsed = JSON.parse(json);
  
  // Validate and reconstruct with proper types
  const state: SerializableGameState = {
    roomId: String(parsed.roomId),
    roomCode: String(parsed.roomCode),
    phase: validatePhase(parsed.phase),
    currentTurn: Number(parsed.currentTurn),
    round: Number(parsed.round),
    civilianWord: parsed.civilianWord !== null ? String(parsed.civilianWord) : null,
    spyWord: parsed.spyWord !== null ? String(parsed.spyWord) : null,
    gameState: parsed.gameState !== null ? validateGameState(parsed.gameState) : null,
    settings: validateSettings(parsed.settings),
    players: Array.isArray(parsed.players) 
      ? parsed.players.map(validatePlayer) 
      : [],
    descriptions: Array.isArray(parsed.descriptions) 
      ? parsed.descriptions.map(validateDescription) 
      : [],
    votes: Array.isArray(parsed.votes) 
      ? parsed.votes.map(validateVote) 
      : [],
    createdAt: Number(parsed.createdAt),
    updatedAt: Number(parsed.updatedAt),
  };

  return state;
}

/**
 * Validate and convert phase string to GamePhase type
 */
function validatePhase(phase: unknown): GamePhase {
  const validPhases: GamePhase[] = ['waiting', 'word-reveal', 'description', 'voting', 'result', 'game-over'];
  if (typeof phase === 'string' && validPhases.includes(phase as GamePhase)) {
    return phase as GamePhase;
  }
  return 'waiting'; // Default fallback
}

/**
 * Validate and convert role string to PlayerRole type
 */
function validateRole(role: unknown): PlayerRole | null {
  if (role === 'civilian' || role === 'spy') {
    return role;
  }
  return null;
}

/**
 * Validate and reconstruct GameState object
 */
function validateGameState(gs: unknown): GameState {
  if (typeof gs !== 'object' || gs === null) {
    return { eliminatedPlayers: [], spyIds: [] };
  }
  
  const obj = gs as Record<string, unknown>;
  
  return {
    eliminatedPlayers: Array.isArray(obj.eliminatedPlayers) 
      ? obj.eliminatedPlayers.map(String) 
      : [],
    spyIds: Array.isArray(obj.spyIds) 
      ? obj.spyIds.map(String) 
      : [],
    winner: obj.winner === 'civilian' || obj.winner === 'spy' 
      ? obj.winner 
      : undefined,
  };
}

/**
 * Validate and reconstruct GameSettings object
 */
function validateSettings(settings: unknown): GameSettings {
  if (typeof settings !== 'object' || settings === null) {
    return { spyCount: 1, minPlayers: 3, maxPlayers: 20 };
  }
  
  const obj = settings as Record<string, unknown>;
  
  return {
    spyCount: typeof obj.spyCount === 'number' ? obj.spyCount : 1,
    minPlayers: typeof obj.minPlayers === 'number' ? obj.minPlayers : 3,
    maxPlayers: typeof obj.maxPlayers === 'number' ? obj.maxPlayers : 20,
  };
}

/**
 * Validate and reconstruct SerializablePlayer object
 */
function validatePlayer(player: unknown): SerializablePlayer {
  if (typeof player !== 'object' || player === null) {
    throw new Error('Invalid player data');
  }
  
  const obj = player as Record<string, unknown>;
  
  return {
    id: String(obj.id ?? ''),
    name: String(obj.name ?? ''),
    token: String(obj.token ?? ''),
    role: validateRole(obj.role),
    isAlive: Boolean(obj.isAlive),
    isOnline: Boolean(obj.isOnline),
    isHost: Boolean(obj.isHost),
    joinOrder: Number(obj.joinOrder ?? 0),
    lastSeen: Number(obj.lastSeen ?? 0),
  };
}

/**
 * Validate and reconstruct SerializableDescription object
 */
function validateDescription(desc: unknown): SerializableDescription {
  if (typeof desc !== 'object' || desc === null) {
    throw new Error('Invalid description data');
  }
  
  const obj = desc as Record<string, unknown>;
  
  return {
    id: String(obj.id ?? ''),
    playerId: String(obj.playerId ?? ''),
    round: Number(obj.round ?? 1),
    text: String(obj.text ?? ''),
    createdAt: Number(obj.createdAt ?? 0),
  };
}

/**
 * Validate and reconstruct SerializableVote object
 */
function validateVote(vote: unknown): SerializableVote {
  if (typeof vote !== 'object' || vote === null) {
    throw new Error('Invalid vote data');
  }
  
  const obj = vote as Record<string, unknown>;
  
  return {
    id: String(obj.id ?? ''),
    voterId: String(obj.voterId ?? ''),
    targetId: String(obj.targetId ?? ''),
    round: Number(obj.round ?? 1),
    createdAt: Number(obj.createdAt ?? 0),
  };
}

/**
 * Check if two game states are equivalent
 * Used for testing round-trip serialization
 */
export function areGameStatesEquivalent(
  a: SerializableGameState,
  b: SerializableGameState
): boolean {
  // Compare primitive fields
  if (a.roomId !== b.roomId) return false;
  if (a.roomCode !== b.roomCode) return false;
  if (a.phase !== b.phase) return false;
  if (a.currentTurn !== b.currentTurn) return false;
  if (a.round !== b.round) return false;
  if (a.civilianWord !== b.civilianWord) return false;
  if (a.spyWord !== b.spyWord) return false;
  if (a.createdAt !== b.createdAt) return false;
  if (a.updatedAt !== b.updatedAt) return false;

  // Compare settings
  if (a.settings.spyCount !== b.settings.spyCount) return false;
  if (a.settings.minPlayers !== b.settings.minPlayers) return false;
  if (a.settings.maxPlayers !== b.settings.maxPlayers) return false;

  // Compare game state
  if (!areGameStatesInnerEquivalent(a.gameState, b.gameState)) return false;

  // Compare players
  if (a.players.length !== b.players.length) return false;
  for (let i = 0; i < a.players.length; i++) {
    if (!arePlayersEquivalent(a.players[i], b.players[i])) return false;
  }

  // Compare descriptions
  if (a.descriptions.length !== b.descriptions.length) return false;
  for (let i = 0; i < a.descriptions.length; i++) {
    if (!areDescriptionsEquivalent(a.descriptions[i], b.descriptions[i])) return false;
  }

  // Compare votes
  if (a.votes.length !== b.votes.length) return false;
  for (let i = 0; i < a.votes.length; i++) {
    if (!areVotesEquivalent(a.votes[i], b.votes[i])) return false;
  }

  return true;
}

function areGameStatesInnerEquivalent(a: GameState | null, b: GameState | null): boolean {
  if (a === null && b === null) return true;
  if (a === null || b === null) return false;
  
  if (a.winner !== b.winner) return false;
  if (a.eliminatedPlayers.length !== b.eliminatedPlayers.length) return false;
  if (a.spyIds.length !== b.spyIds.length) return false;
  
  for (let i = 0; i < a.eliminatedPlayers.length; i++) {
    if (a.eliminatedPlayers[i] !== b.eliminatedPlayers[i]) return false;
  }
  
  for (let i = 0; i < a.spyIds.length; i++) {
    if (a.spyIds[i] !== b.spyIds[i]) return false;
  }
  
  return true;
}

function arePlayersEquivalent(a: SerializablePlayer, b: SerializablePlayer): boolean {
  return (
    a.id === b.id &&
    a.name === b.name &&
    a.token === b.token &&
    a.role === b.role &&
    a.isAlive === b.isAlive &&
    a.isOnline === b.isOnline &&
    a.isHost === b.isHost &&
    a.joinOrder === b.joinOrder &&
    a.lastSeen === b.lastSeen
  );
}

function areDescriptionsEquivalent(a: SerializableDescription, b: SerializableDescription): boolean {
  return (
    a.id === b.id &&
    a.playerId === b.playerId &&
    a.round === b.round &&
    a.text === b.text &&
    a.createdAt === b.createdAt
  );
}

function areVotesEquivalent(a: SerializableVote, b: SerializableVote): boolean {
  return (
    a.id === b.id &&
    a.voterId === b.voterId &&
    a.targetId === b.targetId &&
    a.round === b.round &&
    a.createdAt === b.createdAt
  );
}
