/**
 * 场景10 (⭐⭐⭐⭐⭐ 地狱级): 极端边界条件综合测试
 * 
 * 测试目标：验证各种极端和边界情况
 * - 最大/最小玩家数
 * - 特殊字符输入
 * - 并发操作模拟
 * - 状态转换边界
 * - 数据一致性
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import {
  validateGameStart,
  selectSpies,
  validateDescription,
  validateVote,
  tallyVotes,
  checkVictoryCondition,
  isPlayerTurn,
  getNextTurn
} from '../../src/api/game';
import { validatePassword, validatePlayerName, validateRoomCode } from '../../src/utils/validation';
import { PlayerRow } from '../../src/types';

describe('场景10: 极端边界条件综合测试', () => {

  describe('输入边界测试', () => {
    it('密码边界：正好4字符和8字符', () => {
      expect(validatePassword('abcd')).toBe(true);    // 最小
      expect(validatePassword('abcdefgh')).toBe(true); // 最大
      expect(validatePassword('abc')).toBe(false);     // 太短
      expect(validatePassword('abcdefghi')).toBe(false); // 太长
    });

    it('昵称边界：正好2字符和10字符', () => {
      expect(validatePlayerName('张三')).toBe(true);      // 最小
      expect(validatePlayerName('张三李四王五赵六周七')).toBe(true); // 最大
      expect(validatePlayerName('张')).toBe(false);       // 太短
      expect(validatePlayerName('张三李四王五赵六周七钱')).toBe(false); // 太长
    });

    it('房间号边界：正好6位数字', () => {
      expect(validateRoomCode('000000')).toBe(true);
      expect(validateRoomCode('999999')).toBe(true);
      expect(validateRoomCode('12345')).toBe(false);
      expect(validateRoomCode('1234567')).toBe(false);
    });

    it('描述边界：正好5字符和50字符', () => {
      expect(validateDescription('12345', '词语').valid).toBe(true); // 最小
      expect(validateDescription('这是一个正好五十个字符的描述文本用来测试边界条件是否正确处理了最大长度限制情况', '词语').valid).toBe(true); // 50字符
      expect(validateDescription('1234', '词语').valid).toBe(false); // 太短
    });
  });

  describe('玩家数量边界', () => {
    it('最小玩家数：3人游戏', () => {
      const result = validateGameStart(3, 1);
      expect(result.valid).toBe(true);
    });

    it('最大玩家数：20人游戏', () => {
      const result = validateGameStart(20, 5);
      expect(result.valid).toBe(true);
    });

    it('边界外：2人游戏应该失败', () => {
      const result = validateGameStart(2, 1);
      expect(result.valid).toBe(false);
    });

    it('最大卧底配置：N-2个卧底', () => {
      fc.assert(
        fc.property(fc.integer({ min: 4, max: 20 }), (playerCount) => {
          const maxSpyCount = playerCount - 2;
          const result = validateGameStart(playerCount, maxSpyCount);
          expect(result.valid).toBe(true);
        }),
        { numRuns: 50 }
      );
    });
  });

  describe('特殊字符处理', () => {
    it('昵称包含特殊字符', () => {
      // 有效的特殊字符昵称
      expect(validatePlayerName('玩家①')).toBe(true);
      expect(validatePlayerName('Player1')).toBe(true);
      expect(validatePlayerName('测试_用户')).toBe(true);
    });

    it('纯空白昵称应该被拒绝', () => {
      expect(validatePlayerName('   ')).toBe(false);
      expect(validatePlayerName('\t\t')).toBe(false);
      expect(validatePlayerName('\n\n')).toBe(false);
    });

    it('描述包含词语应该被拒绝', () => {
      const word = '苹果';
      expect(validateDescription(`我觉得${word}很好`, word).valid).toBe(false);
      expect(validateDescription(`${word}是红色的`, word).valid).toBe(false);
      expect(validateDescription(`这个${word}很甜`, word).valid).toBe(false);
    });
  });

  describe('回合管理边界', () => {
    it('单人存活时的回合处理', () => {
      const players: PlayerRow[] = [
        createMockPlayer('p1', true),
      ];

      expect(isPlayerTurn(players, 0, 'p1')).toBe(true);
      expect(getNextTurn(players, 0)).toBe(0); // 只有一人，回到自己
    });

    it('所有人被淘汰时的回合处理', () => {
      const players: PlayerRow[] = [
        createMockPlayer('p1', false),
        createMockPlayer('p2', false),
        createMockPlayer('p3', false),
      ];

      expect(isPlayerTurn(players, 0, 'p1')).toBe(false);
      expect(getNextTurn(players, 0)).toBe(0);
    });

    it('大量玩家的回合循环', () => {
      const players: PlayerRow[] = Array.from({ length: 20 }, (_, i) =>
        createMockPlayer(`p${i}`, true)
      );

      // 验证回合正确循环
      for (let turn = 0; turn < 20; turn++) {
        expect(isPlayerTurn(players, turn, `p${turn}`)).toBe(true);
      }

      // 验证回合循环
      expect(getNextTurn(players, 19)).toBe(0);
    });
  });

  describe('投票边界情况', () => {
    it('所有人投同一个人', () => {
      const votes = Array.from({ length: 19 }, () => ({ targetId: 'target' }));
      const result = tallyVotes(votes);

      expect(result.maxVotes).toBe(19);
      expect(result.eliminatedPlayerIds).toEqual(['target']);
    });

    it('每人各得一票（全员平票）', () => {
      const playerIds = Array.from({ length: 10 }, (_, i) => `p${i}`);
      const votes = playerIds.map(id => ({ targetId: id }));

      const result = tallyVotes(votes);

      expect(result.maxVotes).toBe(1);
      expect(result.eliminatedPlayerIds.length).toBe(10);
    });

    it('大量投票统计', () => {
      fc.assert(
        fc.property(
          fc.array(fc.integer({ min: 0, max: 99 }), { minLength: 100, maxLength: 1000 }),
          (voteIndices) => {
            const playerIds = Array.from({ length: 100 }, (_, i) => `p${i}`);
            const votes = voteIndices.map(idx => ({ targetId: playerIds[idx] }));

            const result = tallyVotes(votes);

            // 验证总票数
            let totalVotes = 0;
            for (const count of result.voteCounts.values()) {
              totalVotes += count;
            }
            expect(totalVotes).toBe(votes.length);

            // 验证被淘汰者票数
            for (const eliminatedId of result.eliminatedPlayerIds) {
              expect(result.voteCounts.get(eliminatedId)).toBe(result.maxVotes);
            }
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  describe('胜利条件边界', () => {
    it('1v1 = 卧底胜利', () => {
      const alivePlayers = [
        { id: 'c1', role: 'civilian' },
        { id: 's1', role: 'spy' },
      ];
      const spyIds = ['s1'];

      const result = checkVictoryCondition(alivePlayers, spyIds);
      expect(result.gameOver).toBe(true);
      expect(result.winner).toBe('spy');
    });

    it('只剩平民 = 平民胜利', () => {
      fc.assert(
        fc.property(fc.integer({ min: 1, max: 19 }), (civilianCount) => {
          const alivePlayers = Array.from({ length: civilianCount }, (_, i) => ({
            id: `c${i}`,
            role: 'civilian',
          }));
          const spyIds = ['s1']; // 卧底已被淘汰

          const result = checkVictoryCondition(alivePlayers, spyIds);
          expect(result.gameOver).toBe(true);
          expect(result.winner).toBe('civilian');
        }),
        { numRuns: 50 }
      );
    });

    it('只剩卧底 = 卧底胜利', () => {
      fc.assert(
        fc.property(fc.integer({ min: 1, max: 10 }), (spyCount) => {
          const spyIds = Array.from({ length: spyCount }, (_, i) => `s${i}`);
          const alivePlayers = spyIds.map(id => ({ id, role: 'spy' }));

          const result = checkVictoryCondition(alivePlayers, spyIds);
          expect(result.gameOver).toBe(true);
          expect(result.winner).toBe('spy');
        }),
        { numRuns: 50 }
      );
    });
  });

  describe('角色分配边界', () => {
    it('最小配置：3人1卧底', () => {
      const playerIds = ['p1', 'p2', 'p3'];
      const spyIds = selectSpies(playerIds, 1);

      expect(spyIds.length).toBe(1);
      expect(playerIds).toContain(spyIds[0]);
    });

    it('最大配置：20人18卧底', () => {
      const playerIds = Array.from({ length: 20 }, (_, i) => `p${i}`);
      const spyIds = selectSpies(playerIds, 18);

      expect(spyIds.length).toBe(18);
      expect(new Set(spyIds).size).toBe(18); // 无重复

      for (const spyId of spyIds) {
        expect(playerIds).toContain(spyId);
      }
    });

    it('角色分配的随机性验证', () => {
      const playerIds = Array.from({ length: 10 }, (_, i) => `p${i}`);
      const spySelections = new Set<string>();

      // 多次选择，验证随机性
      for (let i = 0; i < 100; i++) {
        const spyIds = selectSpies(playerIds, 1);
        spySelections.add(spyIds[0]);
      }

      // 应该有多个不同的玩家被选为卧底
      expect(spySelections.size).toBeGreaterThan(1);
    });
  });

  describe('数据一致性验证', () => {
    it('投票验证的完整性', () => {
      fc.assert(
        fc.property(
          fc.uuid(),
          fc.uuid(),
          fc.boolean(),
          fc.boolean(),
          fc.boolean(),
          (voterId, targetId, voterAlive, targetAlive, hasVoted) => {
            const result = validateVote(voterId, targetId, voterAlive, targetAlive, hasVoted);

            // 验证所有无效情况都被正确处理
            if (!voterAlive) {
              expect(result.valid).toBe(false);
            } else if (voterId === targetId) {
              expect(result.valid).toBe(false);
            } else if (!targetAlive) {
              expect(result.valid).toBe(false);
            } else if (hasVoted) {
              expect(result.valid).toBe(false);
            } else {
              expect(result.valid).toBe(true);
            }
          }
        ),
        { numRuns: 200 }
      );
    });

    it('游戏配置验证的完整性', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 30 }),
          fc.integer({ min: 0, max: 30 }),
          (playerCount, spyCount) => {
            const result = validateGameStart(playerCount, spyCount);

            // 验证所有无效情况
            if (playerCount < 3) {
              expect(result.valid).toBe(false);
            } else if (spyCount < 1) {
              expect(result.valid).toBe(false);
            } else if (spyCount >= playerCount - 1) {
              expect(result.valid).toBe(false);
            } else {
              expect(result.valid).toBe(true);
            }
          }
        ),
        { numRuns: 200 }
      );
    });
  });
});

// 辅助函数
function createMockPlayer(id: string, isAlive: boolean): PlayerRow {
  return {
    id,
    room_id: 'room-1',
    token: `token-${id}`,
    name: `玩家${id}`,
    role: 'civilian',
    is_alive: isAlive ? 1 : 0,
    is_online: 1,
    word_confirmed: 1,
    last_seen: Date.now(),
    join_order: 0,
    is_bot: 0,
  };
}
