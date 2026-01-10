/**
 * Game Action API handlers for Who is the Spy game
 * Requirements: 4.3, 4.4, 5.1, 5.2, 5.3, 5.4, 5.5, 6.1, 6.2, 6.4, 6.5, 6.6, 6.8
 */

import type { Env } from '../index';
import {
  RoomRow,
  PlayerRow,
  WordPairRow,
  VoteRow,
  GameSettings,
  GameState,
  ErrorCode,
} from '../types';

interface ActionResult {
  success: boolean;
  error?: string;
  code?: ErrorCode;
}

/**
 * Validate game start conditions
 * Requirements: 4.3, 4.4
 * - Spy count must be less than total players minus 1 (need at least 2 civilians)
 * - Minimum 3 players required
 */
export function validateGameStart(playerCount: number, spyCount: number): { valid: boolean; error?: string } {
  // Requirement 4.4: Minimum 3 players
  if (playerCount < 3) {
    return { valid: false, error: '至少需要3名玩家才能开始游戏' };
  }

  // Spy count must be at least 1
  if (spyCount < 1) {
    return { valid: false, error: '至少需要1名卧底' };
  }

  // Requirement 4.3: Spy count must leave at least 2 civilians
  // This ensures the game is playable (civilians need majority to have a chance)
  if (spyCount >= playerCount - 1) {
    return { valid: false, error: '卧底数量必须少于玩家总数减1（至少需要2名平民）' };
  }

  return { valid: true };
}

/**
 * Randomly select spy players from the player list
 * Requirements: 5.2 - Randomly assign spy roles
 */
export function selectSpies(playerIds: string[], spyCount: number): string[] {
  // Fisher-Yates shuffle to get random selection
  const shuffled = [...playerIds];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled.slice(0, spyCount);
}

/**
 * Randomly select first player to describe
 * Requirements: 5.5 - Randomly determine first player
 */
export function selectFirstPlayer(playerCount: number): number {
  return Math.floor(Math.random() * playerCount);
}

/**
 * Start game action handler
 * Requirements: 4.3, 4.4, 5.1, 5.2, 5.3, 5.4, 5.5
 */
export async function startGame(
  roomId: string,
  playerToken: string,
  env: Env
): Promise<ActionResult> {
  try {
    // Get room
    const room = await env.DB.prepare(`
      SELECT * FROM rooms WHERE id = ?
    `).bind(roomId).first<RoomRow>();

    if (!room) {
      return {
        success: false,
        error: '房间不存在',
        code: ErrorCode.ROOM_NOT_FOUND,
      };
    }

    // Verify player is host
    const player = await env.DB.prepare(`
      SELECT * FROM players WHERE token = ? AND room_id = ?
    `).bind(playerToken, roomId).first<PlayerRow>();

    if (!player) {
      return {
        success: false,
        error: '玩家不存在',
        code: ErrorCode.PLAYER_NOT_FOUND,
      };
    }

    if (player.id !== room.host_id) {
      return {
        success: false,
        error: '只有房主可以开始游戏',
        code: ErrorCode.NOT_AUTHORIZED,
      };
    }

    // Check room phase
    if (room.phase !== 'waiting') {
      return {
        success: false,
        error: '游戏已经开始',
        code: ErrorCode.INVALID_PHASE,
      };
    }

    // Get all players in room
    const playersResult = await env.DB.prepare(`
      SELECT * FROM players WHERE room_id = ? ORDER BY join_order ASC
    `).bind(roomId).all<PlayerRow>();
    const players = playersResult.results || [];

    // Parse settings
    const settings: GameSettings = JSON.parse(room.settings);

    // Validate game start conditions (Requirements 4.3, 4.4)
    const validation = validateGameStart(players.length, settings.spyCount);
    if (!validation.valid) {
      return {
        success: false,
        error: validation.error,
        code: ErrorCode.INVALID_ACTION,
      };
    }

    // Select random word pair (Requirement 5.1)
    const wordPair = await env.DB.prepare(`
      SELECT * FROM word_pairs ORDER BY RANDOM() LIMIT 1
    `).first<WordPairRow>();

    if (!wordPair) {
      return {
        success: false,
        error: '词库为空，无法开始游戏',
        code: ErrorCode.DATABASE_ERROR,
      };
    }

    // Select spies randomly (Requirement 5.2)
    const playerIds = players.map(p => p.id);
    const spyIds = selectSpies(playerIds, settings.spyCount);

    // Assign roles to players (Requirements 5.2, 5.3)
    for (const p of players) {
      const role = spyIds.includes(p.id) ? 'spy' : 'civilian';
      await env.DB.prepare(`
        UPDATE players SET role = ? WHERE id = ?
      `).bind(role, p.id).run();
    }

    // Select first player randomly (Requirement 5.5)
    const firstPlayer = selectFirstPlayer(players.length);

    // Initialize game state
    const gameState: GameState = {
      eliminatedPlayers: [],
      spyIds: spyIds,
    };

    // Update room to word-reveal phase (Requirement 5.4)
    const timestamp = Date.now();
    await env.DB.prepare(`
      UPDATE rooms SET
        phase = 'word-reveal',
        civilian_word = ?,
        spy_word = ?,
        current_turn = ?,
        round = 1,
        game_state = ?,
        updated_at = ?
      WHERE id = ?
    `).bind(
      wordPair.civilian_word,
      wordPair.spy_word,
      firstPlayer,
      JSON.stringify(gameState),
      timestamp,
      roomId
    ).run();

    return { success: true };
  } catch (error) {
    console.error('Start game error:', error);
    return {
      success: false,
      error: '开始游戏失败，请重试',
      code: ErrorCode.DATABASE_ERROR,
    };
  }
}


/**
 * Validate description text
 * Requirements: 6.2, 6.8
 * - Description must be 5-50 characters
 * - Description must not contain the player's word
 */
export function validateDescription(text: string, playerWord: string): { valid: boolean; error?: string } {
  // Check if text is a string
  if (typeof text !== 'string') {
    return { valid: false, error: '描述必须是文本' };
  }

  // Check length (5-50 characters)
  if (text.length < 5) {
    return { valid: false, error: '描述至少需要5个字符' };
  }
  if (text.length > 50) {
    return { valid: false, error: '描述不能超过50个字符' };
  }

  // Requirement 6.8: Check if description contains the player's word
  if (playerWord && text.includes(playerWord)) {
    return { valid: false, error: '描述不能包含你的词语' };
  }

  return { valid: true };
}

/**
 * Check if it's the player's turn to describe
 * Requirements: 6.1, 6.2
 */
export function isPlayerTurn(
  players: PlayerRow[],
  currentTurn: number,
  playerId: string
): boolean {
  // Get alive players in order
  const alivePlayers = players.filter(p => p.is_alive === 1);
  if (alivePlayers.length === 0) return false;
  
  // Normalize current turn to valid index
  const turnIndex = currentTurn % alivePlayers.length;
  const currentPlayer = alivePlayers[turnIndex];
  
  return currentPlayer?.id === playerId;
}

/**
 * Get the next player turn index
 * Advances to the next alive player
 */
export function getNextTurn(
  players: PlayerRow[],
  currentTurn: number
): number {
  const alivePlayers = players.filter(p => p.is_alive === 1);
  if (alivePlayers.length === 0) return 0;
  
  return (currentTurn + 1) % alivePlayers.length;
}

/**
 * Submit description action handler
 * Requirements: 6.1, 6.2, 6.4, 6.8
 */
export async function submitDescription(
  roomId: string,
  playerToken: string,
  text: string,
  env: Env
): Promise<ActionResult> {
  try {
    // Get room
    const room = await env.DB.prepare(`
      SELECT * FROM rooms WHERE id = ?
    `).bind(roomId).first<RoomRow>();

    if (!room) {
      return {
        success: false,
        error: '房间不存在',
        code: ErrorCode.ROOM_NOT_FOUND,
      };
    }

    // Check room phase - must be in description phase
    if (room.phase !== 'description') {
      return {
        success: false,
        error: '当前不是描述阶段',
        code: ErrorCode.INVALID_PHASE,
      };
    }

    // Get the player
    const player = await env.DB.prepare(`
      SELECT * FROM players WHERE token = ? AND room_id = ?
    `).bind(playerToken, roomId).first<PlayerRow>();

    if (!player) {
      return {
        success: false,
        error: '玩家不存在',
        code: ErrorCode.PLAYER_NOT_FOUND,
      };
    }

    // Check if player is alive
    if (player.is_alive !== 1) {
      return {
        success: false,
        error: '已淘汰的玩家不能描述',
        code: ErrorCode.INVALID_ACTION,
      };
    }

    // Get all players to check turn
    const playersResult = await env.DB.prepare(`
      SELECT * FROM players WHERE room_id = ? ORDER BY join_order ASC
    `).bind(roomId).all<PlayerRow>();
    const players = playersResult.results || [];

    // Check if it's this player's turn (Requirement 6.1, 6.2)
    if (!isPlayerTurn(players, room.current_turn, player.id)) {
      return {
        success: false,
        error: '还没轮到你描述',
        code: ErrorCode.INVALID_ACTION,
      };
    }

    // Get player's word based on role
    const playerWord = player.role === 'spy' ? room.spy_word : room.civilian_word;

    // Validate description (Requirements 6.2, 6.8)
    const validation = validateDescription(text, playerWord || '');
    if (!validation.valid) {
      return {
        success: false,
        error: validation.error,
        code: ErrorCode.INVALID_INPUT,
      };
    }

    // Save description record (Requirement 6.4)
    const descriptionId = crypto.randomUUID();
    const timestamp = Date.now();
    
    await env.DB.prepare(`
      INSERT INTO descriptions (id, room_id, player_id, round, text, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).bind(descriptionId, roomId, player.id, room.round, text, timestamp).run();

    // Advance to next player
    const nextTurn = getNextTurn(players, room.current_turn);

    // Update room with new turn
    await env.DB.prepare(`
      UPDATE rooms SET current_turn = ?, updated_at = ? WHERE id = ?
    `).bind(nextTurn, timestamp, roomId).run();

    return { success: true };
  } catch (error) {
    console.error('Submit description error:', error);
    return {
      success: false,
      error: '提交描述失败，请重试',
      code: ErrorCode.DATABASE_ERROR,
    };
  }
}

/**
 * Skip to next player (host only)
 * Requirements: 6.5
 */
export async function skipPlayer(
  roomId: string,
  playerToken: string,
  env: Env
): Promise<ActionResult> {
  try {
    // Get room
    const room = await env.DB.prepare(`
      SELECT * FROM rooms WHERE id = ?
    `).bind(roomId).first<RoomRow>();

    if (!room) {
      return {
        success: false,
        error: '房间不存在',
        code: ErrorCode.ROOM_NOT_FOUND,
      };
    }

    // Verify player is host
    const player = await env.DB.prepare(`
      SELECT * FROM players WHERE token = ? AND room_id = ?
    `).bind(playerToken, roomId).first<PlayerRow>();

    if (!player) {
      return {
        success: false,
        error: '玩家不存在',
        code: ErrorCode.PLAYER_NOT_FOUND,
      };
    }

    if (player.id !== room.host_id) {
      return {
        success: false,
        error: '只有房主可以跳过玩家',
        code: ErrorCode.NOT_AUTHORIZED,
      };
    }

    // Check room phase - must be in description phase
    if (room.phase !== 'description') {
      return {
        success: false,
        error: '当前不是描述阶段',
        code: ErrorCode.INVALID_PHASE,
      };
    }

    // Get all players
    const playersResult = await env.DB.prepare(`
      SELECT * FROM players WHERE room_id = ? ORDER BY join_order ASC
    `).bind(roomId).all<PlayerRow>();
    const players = playersResult.results || [];

    // Advance to next player
    const nextTurn = getNextTurn(players, room.current_turn);
    const timestamp = Date.now();

    await env.DB.prepare(`
      UPDATE rooms SET current_turn = ?, updated_at = ? WHERE id = ?
    `).bind(nextTurn, timestamp, roomId).run();

    return { success: true };
  } catch (error) {
    console.error('Skip player error:', error);
    return {
      success: false,
      error: '跳过玩家失败，请重试',
      code: ErrorCode.DATABASE_ERROR,
    };
  }
}

/**
 * Start voting phase (host only)
 * Requirements: 6.6
 */
export async function startVoting(
  roomId: string,
  playerToken: string,
  env: Env
): Promise<ActionResult> {
  try {
    // Get room
    const room = await env.DB.prepare(`
      SELECT * FROM rooms WHERE id = ?
    `).bind(roomId).first<RoomRow>();

    if (!room) {
      return {
        success: false,
        error: '房间不存在',
        code: ErrorCode.ROOM_NOT_FOUND,
      };
    }

    // Verify player is host
    const player = await env.DB.prepare(`
      SELECT * FROM players WHERE token = ? AND room_id = ?
    `).bind(playerToken, roomId).first<PlayerRow>();

    if (!player) {
      return {
        success: false,
        error: '玩家不存在',
        code: ErrorCode.PLAYER_NOT_FOUND,
      };
    }

    if (player.id !== room.host_id) {
      return {
        success: false,
        error: '只有房主可以开始投票',
        code: ErrorCode.NOT_AUTHORIZED,
      };
    }

    // Check room phase - must be in description phase
    if (room.phase !== 'description') {
      return {
        success: false,
        error: '当前不是描述阶段',
        code: ErrorCode.INVALID_PHASE,
      };
    }

    // Transition to voting phase
    const timestamp = Date.now();
    await env.DB.prepare(`
      UPDATE rooms SET phase = 'voting', updated_at = ? WHERE id = ?
    `).bind(timestamp, roomId).run();

    return { success: true };
  } catch (error) {
    console.error('Start voting error:', error);
    return {
      success: false,
      error: '开始投票失败，请重试',
      code: ErrorCode.DATABASE_ERROR,
    };
  }
}

/**
 * Confirm word action handler - transitions from word-reveal to description phase
 * Requirements: 5.4
 */
export async function confirmWord(
  roomId: string,
  playerToken: string,
  env: Env
): Promise<ActionResult> {
  try {
    // Get room
    const room = await env.DB.prepare(`
      SELECT * FROM rooms WHERE id = ?
    `).bind(roomId).first<RoomRow>();

    if (!room) {
      return {
        success: false,
        error: '房间不存在',
        code: ErrorCode.ROOM_NOT_FOUND,
      };
    }

    // Check room phase - must be in word-reveal phase
    if (room.phase !== 'word-reveal') {
      return {
        success: false,
        error: '当前不是查看词语阶段',
        code: ErrorCode.INVALID_PHASE,
      };
    }

    // Verify player exists
    const player = await env.DB.prepare(`
      SELECT * FROM players WHERE token = ? AND room_id = ?
    `).bind(playerToken, roomId).first<PlayerRow>();

    if (!player) {
      return {
        success: false,
        error: '玩家不存在',
        code: ErrorCode.PLAYER_NOT_FOUND,
      };
    }

    // For simplicity, any player confirming transitions to description phase
    // In a more complex implementation, we might track individual confirmations
    const timestamp = Date.now();
    await env.DB.prepare(`
      UPDATE rooms SET phase = 'description', updated_at = ? WHERE id = ?
    `).bind(timestamp, roomId).run();

    return { success: true };
  } catch (error) {
    console.error('Confirm word error:', error);
    return {
      success: false,
      error: '确认词语失败，请重试',
      code: ErrorCode.DATABASE_ERROR,
    };
  }
}

/**
 * Validate vote submission
 * Requirements: 7.1, 7.2, 7.3
 * - Only alive players can vote
 * - Players cannot vote for themselves
 * - Players cannot vote for eliminated players
 * - Each player can vote only once per round
 */
export interface VoteValidation {
  valid: boolean;
  error?: string;
}

export function validateVote(
  voterId: string,
  targetId: string,
  voterIsAlive: boolean,
  targetIsAlive: boolean,
  hasAlreadyVoted: boolean
): VoteValidation {
  // Requirement 7.1: Only alive players can vote
  if (!voterIsAlive) {
    return { valid: false, error: '已淘汰的玩家不能投票' };
  }

  // Requirement 7.2: Players cannot vote for themselves
  if (voterId === targetId) {
    return { valid: false, error: '不能投票给自己' };
  }

  // Requirement 7.3: Players cannot vote for eliminated players
  if (!targetIsAlive) {
    return { valid: false, error: '不能投票给已淘汰的玩家' };
  }

  // Requirement 7.3: Each player can vote only once per round
  if (hasAlreadyVoted) {
    return { valid: false, error: '本轮已经投过票了' };
  }

  return { valid: true };
}

/**
 * Submit vote action handler
 * Requirements: 7.1, 7.2, 7.3
 */
export async function submitVote(
  roomId: string,
  playerToken: string,
  targetId: string,
  env: Env
): Promise<ActionResult> {
  try {
    // Get room
    const room = await env.DB.prepare(`
      SELECT * FROM rooms WHERE id = ?
    `).bind(roomId).first<RoomRow>();

    if (!room) {
      return {
        success: false,
        error: '房间不存在',
        code: ErrorCode.ROOM_NOT_FOUND,
      };
    }

    // Check room phase - must be in voting phase
    if (room.phase !== 'voting') {
      return {
        success: false,
        error: '当前不是投票阶段',
        code: ErrorCode.INVALID_PHASE,
      };
    }

    // Get the voter
    const voter = await env.DB.prepare(`
      SELECT * FROM players WHERE token = ? AND room_id = ?
    `).bind(playerToken, roomId).first<PlayerRow>();

    if (!voter) {
      return {
        success: false,
        error: '玩家不存在',
        code: ErrorCode.PLAYER_NOT_FOUND,
      };
    }

    // Get the target player
    const target = await env.DB.prepare(`
      SELECT * FROM players WHERE id = ? AND room_id = ?
    `).bind(targetId, roomId).first<PlayerRow>();

    if (!target) {
      return {
        success: false,
        error: '目标玩家不存在',
        code: ErrorCode.PLAYER_NOT_FOUND,
      };
    }

    // Check if voter has already voted this round
    const existingVote = await env.DB.prepare(`
      SELECT * FROM votes WHERE room_id = ? AND voter_id = ? AND round = ?
    `).bind(roomId, voter.id, room.round).first<VoteRow>();

    // Validate vote (Requirements 7.1, 7.2, 7.3)
    const validation = validateVote(
      voter.id,
      targetId,
      voter.is_alive === 1,
      target.is_alive === 1,
      existingVote !== null
    );

    if (!validation.valid) {
      return {
        success: false,
        error: validation.error,
        code: ErrorCode.INVALID_ACTION,
      };
    }

    // Save vote record
    const voteId = crypto.randomUUID();
    const timestamp = Date.now();

    await env.DB.prepare(`
      INSERT INTO votes (id, room_id, voter_id, target_id, round, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).bind(voteId, roomId, voter.id, targetId, room.round, timestamp).run();

    // Update room timestamp
    await env.DB.prepare(`
      UPDATE rooms SET updated_at = ? WHERE id = ?
    `).bind(timestamp, roomId).run();

    return { success: true };
  } catch (error) {
    console.error('Submit vote error:', error);
    return {
      success: false,
      error: '投票失败，请重试',
      code: ErrorCode.DATABASE_ERROR,
    };
  }
}


/**
 * Vote tally result
 * Requirements: 7.4, 7.5, 7.6
 */
export interface VoteTallyResult {
  voteCounts: Map<string, number>;
  maxVotes: number;
  eliminatedPlayerIds: string[];
}

/**
 * Tally votes and determine eliminated players
 * Requirements: 7.4, 7.5, 7.6
 * - Count all votes
 * - Player(s) with most votes are eliminated
 * - If tie, all tied players are eliminated
 */
export function tallyVotes(votes: { targetId: string }[]): VoteTallyResult {
  // Count votes for each target
  const voteCounts = new Map<string, number>();
  
  for (const vote of votes) {
    const currentCount = voteCounts.get(vote.targetId) || 0;
    voteCounts.set(vote.targetId, currentCount + 1);
  }

  // Find maximum vote count
  let maxVotes = 0;
  for (const count of voteCounts.values()) {
    if (count > maxVotes) {
      maxVotes = count;
    }
  }

  // Find all players with max votes (handles ties - Requirement 7.6)
  const eliminatedPlayerIds: string[] = [];
  if (maxVotes > 0) {
    for (const [playerId, count] of voteCounts.entries()) {
      if (count === maxVotes) {
        eliminatedPlayerIds.push(playerId);
      }
    }
  }

  return {
    voteCounts,
    maxVotes,
    eliminatedPlayerIds,
  };
}

/**
 * Check victory conditions
 * Requirements: 8.1, 8.2
 * - If all spies are eliminated → civilian victory
 * - If alive spies >= alive civilians → spy victory
 * - Otherwise → game continues
 */
export interface VictoryCheckResult {
  gameOver: boolean;
  winner?: 'civilian' | 'spy';
}

export function checkVictoryCondition(
  alivePlayers: { id: string; role: string | null }[],
  spyIds: string[]
): VictoryCheckResult {
  // Count alive spies and civilians
  let aliveSpyCount = 0;
  let aliveCivilianCount = 0;

  for (const player of alivePlayers) {
    if (spyIds.includes(player.id)) {
      aliveSpyCount++;
    } else {
      aliveCivilianCount++;
    }
  }

  // Requirement 8.1: All spies eliminated → civilian victory
  if (aliveSpyCount === 0) {
    return { gameOver: true, winner: 'civilian' };
  }

  // Requirement 8.2: Alive spies >= alive civilians → spy victory
  if (aliveSpyCount >= aliveCivilianCount) {
    return { gameOver: true, winner: 'spy' };
  }

  // Game continues
  return { gameOver: false };
}

/**
 * Finalize voting round - tally votes and eliminate players
 * Requirements: 7.4, 7.5, 7.6, 7.7
 */
export async function finalizeVoting(
  roomId: string,
  playerToken: string,
  env: Env
): Promise<ActionResult> {
  try {
    // Get room
    const room = await env.DB.prepare(`
      SELECT * FROM rooms WHERE id = ?
    `).bind(roomId).first<RoomRow>();

    if (!room) {
      return {
        success: false,
        error: '房间不存在',
        code: ErrorCode.ROOM_NOT_FOUND,
      };
    }

    // Verify player is host (only host can finalize voting)
    const player = await env.DB.prepare(`
      SELECT * FROM players WHERE token = ? AND room_id = ?
    `).bind(playerToken, roomId).first<PlayerRow>();

    if (!player) {
      return {
        success: false,
        error: '玩家不存在',
        code: ErrorCode.PLAYER_NOT_FOUND,
      };
    }

    if (player.id !== room.host_id) {
      return {
        success: false,
        error: '只有房主可以结束投票',
        code: ErrorCode.NOT_AUTHORIZED,
      };
    }

    // Check room phase - must be in voting phase
    if (room.phase !== 'voting') {
      return {
        success: false,
        error: '当前不是投票阶段',
        code: ErrorCode.INVALID_PHASE,
      };
    }

    // Get all votes for current round
    const votesResult = await env.DB.prepare(`
      SELECT * FROM votes WHERE room_id = ? AND round = ?
    `).bind(roomId, room.round).all<VoteRow>();
    const votes = votesResult.results || [];

    // Tally votes (Requirements 7.4, 7.5, 7.6)
    const tallyResult = tallyVotes(votes.map(v => ({ targetId: v.target_id })));

    // Parse current game state
    const gameState: GameState = room.game_state 
      ? JSON.parse(room.game_state) 
      : { eliminatedPlayers: [], spyIds: [] };

    // Eliminate players with most votes (Requirement 7.5, 7.6)
    for (const eliminatedId of tallyResult.eliminatedPlayerIds) {
      // Mark player as eliminated
      await env.DB.prepare(`
        UPDATE players SET is_alive = 0 WHERE id = ?
      `).bind(eliminatedId).run();

      // Add to eliminated list
      if (!gameState.eliminatedPlayers.includes(eliminatedId)) {
        gameState.eliminatedPlayers.push(eliminatedId);
      }
    }

    // Get updated player list to check victory conditions
    const playersResult = await env.DB.prepare(`
      SELECT * FROM players WHERE room_id = ? AND is_alive = 1
    `).bind(roomId).all<PlayerRow>();
    const alivePlayers = (playersResult.results || []).map(p => ({
      id: p.id,
      role: p.role,
    }));

    // Check victory conditions (Requirements 8.1, 8.2)
    const victoryResult = checkVictoryCondition(alivePlayers, gameState.spyIds);

    const timestamp = Date.now();

    if (victoryResult.gameOver) {
      // Game over - set winner and transition to game-over phase (Requirement 8.3)
      gameState.winner = victoryResult.winner;
      
      await env.DB.prepare(`
        UPDATE rooms SET 
          phase = 'game-over',
          game_state = ?,
          updated_at = ?
        WHERE id = ?
      `).bind(JSON.stringify(gameState), timestamp, roomId).run();
    } else {
      // Transition to result phase to show elimination (Requirement 7.7)
      await env.DB.prepare(`
        UPDATE rooms SET 
          phase = 'result',
          game_state = ?,
          updated_at = ?
        WHERE id = ?
      `).bind(JSON.stringify(gameState), timestamp, roomId).run();
    }

    return { success: true };
  } catch (error) {
    console.error('Finalize voting error:', error);
    return {
      success: false,
      error: '结束投票失败，请重试',
      code: ErrorCode.DATABASE_ERROR,
    };
  }
}

/**
 * Continue game after result phase - transition back to description phase
 * Requirements: 5.4, 6.7
 */
export async function continueGame(
  roomId: string,
  playerToken: string,
  env: Env
): Promise<ActionResult> {
  try {
    // Get room
    const room = await env.DB.prepare(`
      SELECT * FROM rooms WHERE id = ?
    `).bind(roomId).first<RoomRow>();

    if (!room) {
      return {
        success: false,
        error: '房间不存在',
        code: ErrorCode.ROOM_NOT_FOUND,
      };
    }

    // Verify player is host
    const player = await env.DB.prepare(`
      SELECT * FROM players WHERE token = ? AND room_id = ?
    `).bind(playerToken, roomId).first<PlayerRow>();

    if (!player) {
      return {
        success: false,
        error: '玩家不存在',
        code: ErrorCode.PLAYER_NOT_FOUND,
      };
    }

    if (player.id !== room.host_id) {
      return {
        success: false,
        error: '只有房主可以继续游戏',
        code: ErrorCode.NOT_AUTHORIZED,
      };
    }

    // Check room phase - must be in result phase
    if (room.phase !== 'result') {
      return {
        success: false,
        error: '当前不是结算阶段',
        code: ErrorCode.INVALID_PHASE,
      };
    }

    // Transition back to description phase for next round
    const timestamp = Date.now();
    const newRound = room.round + 1;

    await env.DB.prepare(`
      UPDATE rooms SET 
        phase = 'description',
        round = ?,
        current_turn = 0,
        updated_at = ?
      WHERE id = ?
    `).bind(newRound, timestamp, roomId).run();

    return { success: true };
  } catch (error) {
    console.error('Continue game error:', error);
    return {
      success: false,
      error: '继续游戏失败，请重试',
      code: ErrorCode.DATABASE_ERROR,
    };
  }
}


/**
 * Restart game - reset to waiting phase while keeping players
 * Requirements: 8.5, 8.7, 15.1, 15.3
 * 
 * - Clear game state (roles, words, votes, descriptions)
 * - Retain player list
 * - Return to waiting phase
 */
export async function restartGame(
  roomId: string,
  playerToken: string,
  env: Env
): Promise<ActionResult> {
  try {
    // Get room
    const room = await env.DB.prepare(`
      SELECT * FROM rooms WHERE id = ?
    `).bind(roomId).first<RoomRow>();

    if (!room) {
      return {
        success: false,
        error: '房间不存在',
        code: ErrorCode.ROOM_NOT_FOUND,
      };
    }

    // Verify player is host (Requirement 15.1 - only host can restart)
    const player = await env.DB.prepare(`
      SELECT * FROM players WHERE token = ? AND room_id = ?
    `).bind(playerToken, roomId).first<PlayerRow>();

    if (!player) {
      return {
        success: false,
        error: '玩家不存在',
        code: ErrorCode.PLAYER_NOT_FOUND,
      };
    }

    if (player.id !== room.host_id) {
      return {
        success: false,
        error: '只有房主可以重新开始游戏',
        code: ErrorCode.NOT_AUTHORIZED,
      };
    }

    const timestamp = Date.now();

    // Reset room to waiting phase (Requirement 8.7, 15.3)
    // Clear game-specific state: words, game_state, current_turn, round
    await env.DB.prepare(`
      UPDATE rooms SET 
        phase = 'waiting',
        civilian_word = NULL,
        spy_word = NULL,
        game_state = NULL,
        current_turn = 0,
        round = 1,
        updated_at = ?
      WHERE id = ?
    `).bind(timestamp, roomId).run();

    // Reset all players: clear roles, set alive, keep in room (Requirement 8.7)
    await env.DB.prepare(`
      UPDATE players SET 
        role = NULL,
        is_alive = 1,
        last_seen = ?
      WHERE room_id = ?
    `).bind(timestamp, roomId).run();

    // Delete all descriptions for this room
    await env.DB.prepare(`
      DELETE FROM descriptions WHERE room_id = ?
    `).bind(roomId).run();

    // Delete all votes for this room
    await env.DB.prepare(`
      DELETE FROM votes WHERE room_id = ?
    `).bind(roomId).run();

    return { success: true };
  } catch (error) {
    console.error('Restart game error:', error);
    return {
      success: false,
      error: '重新开始游戏失败，请重试',
      code: ErrorCode.DATABASE_ERROR,
    };
  }
}

/**
 * Pure function to compute the reset state for a game restart
 * Used for property testing
 * Requirements: 8.7, 15.3
 */
export interface GameResetInput {
  room: RoomRow;
  players: PlayerRow[];
}

export interface GameResetOutput {
  room: {
    phase: 'waiting';
    civilian_word: null;
    spy_word: null;
    game_state: null;
    current_turn: 0;
    round: 1;
  };
  players: {
    id: string;
    name: string;
    role: null;
    is_alive: 1;
  }[];
  descriptionsCleared: boolean;
  votesCleared: boolean;
}

export function computeGameReset(input: GameResetInput): GameResetOutput {
  return {
    room: {
      phase: 'waiting',
      civilian_word: null,
      spy_word: null,
      game_state: null,
      current_turn: 0,
      round: 1,
    },
    players: input.players.map(p => ({
      id: p.id,
      name: p.name,
      role: null,
      is_alive: 1,
    })),
    descriptionsCleared: true,
    votesCleared: true,
  };
}
