/**
 * Type definitions for Who is the Spy game
 */

// Game phases
export type GamePhase = 'waiting' | 'word-reveal' | 'description' | 'voting' | 'result' | 'game-over';

// Player roles
export type PlayerRole = 'civilian' | 'spy';

// Game settings
export interface GameSettings {
  spyCount: number;
  minPlayers: number;
  maxPlayers: number;
}

// Game state stored in rooms.game_state
export interface GameState {
  eliminatedPlayers: string[];
  spyIds: string[];
  winner?: 'civilian' | 'spy';
  lastRoundEliminated?: string[];  // Players eliminated in the last voting round
}

// Database row types
export interface RoomRow {
  id: string;
  code: string;
  password_hash: string;
  phase: GamePhase;
  host_id: string;
  settings: string; // JSON string of GameSettings
  game_state: string | null; // JSON string of GameState
  civilian_word: string | null;
  spy_word: string | null;
  current_turn: number;
  round: number;
  created_at: number;
  updated_at: number;
}

export interface PlayerRow {
  id: string;
  room_id: string;
  token: string;
  name: string;
  role: PlayerRole | null;
  is_alive: number; // SQLite boolean
  is_online: number; // SQLite boolean
  word_confirmed: number; // SQLite boolean - whether player confirmed seeing their word
  last_seen: number;
  join_order: number;
}

export interface DescriptionRow {
  id: string;
  room_id: string;
  player_id: string;
  round: number;
  text: string;
  created_at: number;
}

export interface VoteRow {
  id: string;
  room_id: string;
  voter_id: string;
  target_id: string;
  round: number;
  created_at: number;
}

export interface WordPairRow {
  id: number;
  civilian_word: string;
  spy_word: string;
  category: string;
}

// API Request/Response types
export interface CreateRoomRequest {
  playerName: string;
}

export interface CreateRoomResponse {
  success: boolean;
  roomCode?: string;
  roomId?: string;
  roomPassword?: string;
  playerToken?: string;
  error?: string;
  code?: ErrorCode;
}

export interface JoinRoomRequest {
  roomCode: string;
  password: string;
  playerName: string;
  playerToken?: string;
}

export interface JoinRoomResponse {
  success: boolean;
  roomId?: string;
  playerToken?: string;
  isReconnect?: boolean;
  error?: string;
  code?: ErrorCode;
}

// Player info for API responses
export interface PlayerInfo {
  id: string;
  name: string;
  isHost: boolean;
  isAlive: boolean;
  isOnline: boolean;
  role?: PlayerRole;
  hasVoted?: boolean;
  hasDescribed?: boolean;
  hasConfirmedWord?: boolean;  // Whether player has confirmed seeing their word
}

// Room state for API responses
export interface RoomStateResponse {
  roomId: string;
  roomCode: string;
  phase: GamePhase;
  players: PlayerInfo[];
  currentTurn: number;
  round: number;
  descriptions: { playerId: string; playerName: string; text: string; round: number }[];
  votes: { voterId: string; targetId: string; round: number }[];
  result?: {
    eliminatedPlayerIds?: string[];  // Changed from single ID to array
    winner?: 'civilian' | 'spy';
  };
  settings: GameSettings;
  myPlayerId: string;  // Current player's ID
  myWord?: string;
  myRole?: PlayerRole;
  isHost: boolean;
  // Words revealed after game over (Requirements 8.3)
  civilianWord?: string;
  spyWord?: string;
}

// Error codes
export enum ErrorCode {
  INVALID_INPUT = 'INVALID_INPUT',
  ROOM_NOT_FOUND = 'ROOM_NOT_FOUND',
  WRONG_PASSWORD = 'WRONG_PASSWORD',
  GAME_IN_PROGRESS = 'GAME_IN_PROGRESS',
  NOT_AUTHORIZED = 'NOT_AUTHORIZED',
  INVALID_ACTION = 'INVALID_ACTION',
  PLAYER_NOT_FOUND = 'PLAYER_NOT_FOUND',
  DUPLICATE_NAME = 'DUPLICATE_NAME',
  INVALID_PHASE = 'INVALID_PHASE',
  DATABASE_ERROR = 'DATABASE_ERROR',
}
