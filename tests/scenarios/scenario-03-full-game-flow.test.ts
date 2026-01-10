/**
 * 场景3 (⭐⭐ 简单级): 完整3人游戏流程
 * 
 * 测试目标：验证最小规模的完整游戏流程
 * - 3人游戏（2平民 + 1卧底）
 * - 完整的阶段转换
 * - 描述和投票流程
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { validateGameStart, selectSpies, selectFirstPlayer, validateDescription, isPlayerTurn, getNextTurn, tallyVotes, checkVictoryCondition } from '../../src/api/game';
import { PlayerRow } from '../../src/types';

describe('场景3: 完整3人游戏流程', () => {
  
  describe('游戏开始验证', () => {
    it('3人1卧底应该是有效配置', () => {
      const result = validateGameStart(3, 1);
      expect(result.valid).toBe(true);
    });

    it('少于3人应该无法开始', () => {
      fc.assert(
        fc.property(fc.integer({ min: 1, max: 2 }), (playerCount) => {
          const result = validateGameStart(playerCount, 1);
          expect(result.valid).toBe(false);
        }),
        { numRuns: 10 }
      );
    });

    it('卧底数量不能大于等于玩家数', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 3, max: 10 }),
          (playerCount) => {
            // 卧底数等于玩家数
            const result1 = validateGameStart(playerCount, playerCount);
            expect(result1.valid).toBe(false);
            
            // 卧底数大于玩家数
            const result2 = validateGameStart(playerCount, playerCount + 1);
            expect(result2.valid).toBe(false);
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  describe('角色分配', () => {
    it('3人游戏应该有1个卧底和2个平民', () => {
      const playerIds = ['p1', 'p2', 'p3'];
      const spyIds = selectSpies(playerIds, 1);
      
      expect(spyIds.length).toBe(1);
      expect(playerIds.filter(id => !spyIds.includes(id)).length).toBe(2);
    });

    it('卧底应该从玩家列表中选择', () => {
      fc.assert(
        fc.property(fc.integer({ min: 3, max: 20 }), (playerCount) => {
          const playerIds = Array.from({ length: playerCount }, (_, i) => `player-${i}`);
          const spyIds = selectSpies(playerIds, 1);
          
          expect(playerIds).toContain(spyIds[0]);
        }),
        { numRuns: 100 }
      );
    });
  });

  describe('描述阶段', () => {
    it('应该正确判断玩家回合', () => {
      const players = createMockPlayers(3);
      
      // 第一个玩家的回合
      expect(isPlayerTurn(players, 0, players[0].id)).toBe(true);
      expect(isPlayerTurn(players, 0, players[1].id)).toBe(false);
      
      // 第二个玩家的回合
      expect(isPlayerTurn(players, 1, players[1].id)).toBe(true);
      expect(isPlayerTurn(players, 1, players[0].id)).toBe(false);
    });

    it('应该正确计算下一个回合', () => {
      const players = createMockPlayers(3);
      
      expect(getNextTurn(players, 0)).toBe(1);
      expect(getNextTurn(players, 1)).toBe(2);
      expect(getNextTurn(players, 2)).toBe(0); // 循环回第一个
    });

    it('描述长度应该在5-50字符之间', () => {
      // 有效描述
      expect(validateDescription('这是一个有效的描述', '苹果').valid).toBe(true);
      
      // 太短
      expect(validateDescription('短', '苹果').valid).toBe(false);
      
      // 太长 (超过50个字符)
      const longDesc = '这是一个非常非常非常非常非常非常非常非常非常非常非常非常非常非常非常非常非常非常非常非常非常非常长的描述啊';
      expect(longDesc.length).toBeGreaterThan(50);
      expect(validateDescription(longDesc, '苹果').valid).toBe(false);
    });

    it('描述不能包含自己的词语', () => {
      const result = validateDescription('我觉得苹果很好吃', '苹果');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('词语');
    });
  });

  describe('投票阶段', () => {
    it('应该正确统计票数', () => {
      const votes = [
        { targetId: 'p1' },
        { targetId: 'p1' },
        { targetId: 'p2' },
      ];
      
      const result = tallyVotes(votes);
      expect(result.voteCounts.get('p1')).toBe(2);
      expect(result.voteCounts.get('p2')).toBe(1);
      expect(result.maxVotes).toBe(2);
      expect(result.eliminatedPlayerIds).toContain('p1');
    });
  });

  describe('胜利条件', () => {
    it('所有卧底被淘汰时平民胜利', () => {
      const alivePlayers = [
        { id: 'p1', role: 'civilian' },
        { id: 'p2', role: 'civilian' },
      ];
      const spyIds = ['p3']; // p3是卧底但已被淘汰
      
      const result = checkVictoryCondition(alivePlayers, spyIds);
      expect(result.gameOver).toBe(true);
      expect(result.winner).toBe('civilian');
    });

    it('卧底数量>=平民数量时卧底胜利', () => {
      const alivePlayers = [
        { id: 'p1', role: 'civilian' },
        { id: 'p3', role: 'spy' },
      ];
      const spyIds = ['p3'];
      
      const result = checkVictoryCondition(alivePlayers, spyIds);
      expect(result.gameOver).toBe(true);
      expect(result.winner).toBe('spy');
    });

    it('游戏继续当平民数量>卧底数量', () => {
      const alivePlayers = [
        { id: 'p1', role: 'civilian' },
        { id: 'p2', role: 'civilian' },
        { id: 'p3', role: 'spy' },
      ];
      const spyIds = ['p3'];
      
      const result = checkVictoryCondition(alivePlayers, spyIds);
      expect(result.gameOver).toBe(false);
    });
  });
});

// 辅助函数
function createMockPlayers(count: number): PlayerRow[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `player-${i}`,
    room_id: 'room-1',
    token: `token-${i}`,
    name: `玩家${i + 1}`,
    role: i === 0 ? 'spy' : 'civilian',
    is_alive: 1,
    is_online: 1,
    last_seen: Date.now(),
    join_order: i,
  }));
}
