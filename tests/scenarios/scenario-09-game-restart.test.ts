/**
 * 场景9 (⭐⭐⭐⭐⭐ 地狱级): 游戏重启后状态一致性测试
 * 
 * 测试目标：验证游戏重启后的状态完整性
 * - 玩家列表保留
 * - 游戏状态完全重置
 * - 角色和词语清除
 * - 投票和描述记录清除
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { computeGameReset, GameResetInput } from '../../src/api/game';
import { RoomRow, PlayerRow, GamePhase } from '../../src/types';

describe('场景9: 游戏重启后状态一致性测试', () => {

  describe('房间状态重置', () => {
    it('重启后房间应该回到waiting阶段', () => {
      fc.assert(
        fc.property(
          fc.constantFrom<GamePhase>('word-reveal', 'description', 'voting', 'result', 'game-over'),
          (currentPhase) => {
            const input = createMockGameState(currentPhase, 5);
            const output = computeGameReset(input);

            expect(output.room.phase).toBe('waiting');
          }
        ),
        { numRuns: 50 }
      );
    });

    it('重启后词语应该被清除', () => {
      const input = createMockGameState('game-over', 5);
      const output = computeGameReset(input);

      expect(output.room.civilian_word).toBeNull();
      expect(output.room.spy_word).toBeNull();
    });

    it('重启后游戏状态应该被清除', () => {
      const input = createMockGameState('game-over', 5);
      const output = computeGameReset(input);

      expect(output.room.game_state).toBeNull();
    });

    it('重启后回合和轮次应该重置', () => {
      const input = createMockGameState('game-over', 5);
      input.room.current_turn = 3;
      input.room.round = 5;

      const output = computeGameReset(input);

      expect(output.room.current_turn).toBe(0);
      expect(output.room.round).toBe(1);
    });
  });

  describe('玩家状态重置', () => {
    it('重启后所有玩家应该保留', () => {
      fc.assert(
        fc.property(fc.integer({ min: 3, max: 20 }), (playerCount) => {
          const input = createMockGameState('game-over', playerCount);
          const output = computeGameReset(input);

          expect(output.players.length).toBe(playerCount);
        }),
        { numRuns: 50 }
      );
    });

    it('重启后所有玩家角色应该被清除', () => {
      fc.assert(
        fc.property(fc.integer({ min: 3, max: 20 }), (playerCount) => {
          const input = createMockGameState('game-over', playerCount);
          // 设置一些玩家为卧底
          input.players[0].role = 'spy';
          input.players[1].role = 'civilian';

          const output = computeGameReset(input);

          for (const player of output.players) {
            expect(player.role).toBeNull();
          }
        }),
        { numRuns: 50 }
      );
    });

    it('重启后所有玩家应该恢复存活状态', () => {
      fc.assert(
        fc.property(fc.integer({ min: 3, max: 20 }), (playerCount) => {
          const input = createMockGameState('game-over', playerCount);
          // 淘汰一些玩家
          input.players[0].is_alive = 0;
          input.players[1].is_alive = 0;

          const output = computeGameReset(input);

          for (const player of output.players) {
            expect(player.is_alive).toBe(1);
          }
        }),
        { numRuns: 50 }
      );
    });

    it('重启后玩家ID和名称应该保持不变', () => {
      fc.assert(
        fc.property(fc.integer({ min: 3, max: 20 }), (playerCount) => {
          const input = createMockGameState('game-over', playerCount);
          const originalPlayers = input.players.map(p => ({ id: p.id, name: p.name }));

          const output = computeGameReset(input);

          for (let i = 0; i < playerCount; i++) {
            expect(output.players[i].id).toBe(originalPlayers[i].id);
            expect(output.players[i].name).toBe(originalPlayers[i].name);
          }
        }),
        { numRuns: 50 }
      );
    });
  });

  describe('游戏记录清除', () => {
    it('重启后描述记录应该被清除', () => {
      const input = createMockGameState('game-over', 5);
      const output = computeGameReset(input);

      expect(output.descriptionsCleared).toBe(true);
    });

    it('重启后投票记录应该被清除', () => {
      const input = createMockGameState('game-over', 5);
      const output = computeGameReset(input);

      expect(output.votesCleared).toBe(true);
    });
  });

  describe('属性测试：重启一致性', () => {
    it('任何阶段重启后状态应该一致', () => {
      fc.assert(
        fc.property(
          fc.constantFrom<GamePhase>('waiting', 'word-reveal', 'description', 'voting', 'result', 'game-over'),
          fc.integer({ min: 3, max: 20 }),
          (phase, playerCount) => {
            const input = createMockGameState(phase, playerCount);
            const output = computeGameReset(input);

            // 房间状态一致性
            expect(output.room.phase).toBe('waiting');
            expect(output.room.civilian_word).toBeNull();
            expect(output.room.spy_word).toBeNull();
            expect(output.room.game_state).toBeNull();
            expect(output.room.current_turn).toBe(0);
            expect(output.room.round).toBe(1);

            // 玩家状态一致性
            expect(output.players.length).toBe(playerCount);
            for (const player of output.players) {
              expect(player.role).toBeNull();
              expect(player.is_alive).toBe(1);
            }

            // 记录清除一致性
            expect(output.descriptionsCleared).toBe(true);
            expect(output.votesCleared).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('多次重启后状态应该相同', () => {
      fc.assert(
        fc.property(fc.integer({ min: 3, max: 20 }), (playerCount) => {
          const input = createMockGameState('game-over', playerCount);

          const output1 = computeGameReset(input);
          const output2 = computeGameReset(input);

          // 两次重启结果应该相同
          expect(output1.room.phase).toBe(output2.room.phase);
          expect(output1.players.length).toBe(output2.players.length);

          for (let i = 0; i < playerCount; i++) {
            expect(output1.players[i].id).toBe(output2.players[i].id);
            expect(output1.players[i].role).toBe(output2.players[i].role);
            expect(output1.players[i].is_alive).toBe(output2.players[i].is_alive);
          }
        }),
        { numRuns: 50 }
      );
    });
  });

  describe('边界情况', () => {
    it('最小玩家数重启', () => {
      const input = createMockGameState('game-over', 3);
      const output = computeGameReset(input);

      expect(output.players.length).toBe(3);
      expect(output.room.phase).toBe('waiting');
    });

    it('最大玩家数重启', () => {
      const input = createMockGameState('game-over', 20);
      const output = computeGameReset(input);

      expect(output.players.length).toBe(20);
      expect(output.room.phase).toBe('waiting');
    });

    it('所有玩家都被淘汰后重启', () => {
      const input = createMockGameState('game-over', 5);
      // 所有玩家都被淘汰
      for (const player of input.players) {
        player.is_alive = 0;
      }

      const output = computeGameReset(input);

      // 所有玩家应该恢复存活
      for (const player of output.players) {
        expect(player.is_alive).toBe(1);
      }
    });
  });
});

// 辅助函数
function createMockGameState(phase: GamePhase, playerCount: number): GameResetInput {
  const room: RoomRow = {
    id: 'room-1',
    code: '123456',
    password_hash: 'hash',
    phase,
    host_id: 'player-0',
    settings: JSON.stringify({ spyCount: 1, minPlayers: 3, maxPlayers: 20 }),
    game_state: JSON.stringify({ eliminatedPlayers: [], spyIds: ['player-0'] }),
    civilian_word: '苹果',
    spy_word: '梨子',
    current_turn: 2,
    round: 3,
    created_at: Date.now(),
    updated_at: Date.now(),
  };

  const players: PlayerRow[] = Array.from({ length: playerCount }, (_, i) => ({
    id: `player-${i}`,
    room_id: 'room-1',
    token: `token-${i}`,
    name: `玩家${i + 1}`,
    role: i === 0 ? 'spy' : 'civilian',
    is_alive: i < playerCount - 1 ? 1 : 0, // 最后一个玩家被淘汰
    is_online: 1,
    word_confirmed: 1,
    last_seen: Date.now(),
    join_order: i,
    is_bot: 0,
  }));

  return { room, players };
}
