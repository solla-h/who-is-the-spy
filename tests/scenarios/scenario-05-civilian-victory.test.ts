/**
 * 场景5 (⭐⭐⭐ 中等级): 平民胜利条件测试
 * 
 * 测试目标：验证平民胜利的各种场景
 * - 单卧底被淘汰
 * - 多卧底全部被淘汰
 * - 边界情况处理
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { checkVictoryCondition, selectSpies } from '../../src/api/game';

describe('场景5: 平民胜利条件测试', () => {
  
  describe('单卧底场景', () => {
    it('3人游戏淘汰卧底后平民胜利', () => {
      // 初始: 2平民 + 1卧底
      // 淘汰卧底后: 2平民存活
      const alivePlayers = [
        { id: 'p1', role: 'civilian' },
        { id: 'p2', role: 'civilian' },
      ];
      const spyIds = ['p3']; // p3是卧底，已被淘汰
      
      const result = checkVictoryCondition(alivePlayers, spyIds);
      expect(result.gameOver).toBe(true);
      expect(result.winner).toBe('civilian');
    });

    it('5人游戏淘汰卧底后平民胜利', () => {
      const alivePlayers = [
        { id: 'p1', role: 'civilian' },
        { id: 'p2', role: 'civilian' },
        { id: 'p3', role: 'civilian' },
        { id: 'p4', role: 'civilian' },
      ];
      const spyIds = ['p5'];
      
      const result = checkVictoryCondition(alivePlayers, spyIds);
      expect(result.gameOver).toBe(true);
      expect(result.winner).toBe('civilian');
    });
  });

  describe('多卧底场景', () => {
    it('2卧底全部被淘汰后平民胜利', () => {
      // 初始: 5人游戏，3平民 + 2卧底
      // 两个卧底都被淘汰
      const alivePlayers = [
        { id: 'p1', role: 'civilian' },
        { id: 'p2', role: 'civilian' },
        { id: 'p3', role: 'civilian' },
      ];
      const spyIds = ['p4', 'p5']; // 两个卧底都被淘汰
      
      const result = checkVictoryCondition(alivePlayers, spyIds);
      expect(result.gameOver).toBe(true);
      expect(result.winner).toBe('civilian');
    });

    it('3卧底全部被淘汰后平民胜利', () => {
      // 10人游戏，7平民 + 3卧底
      const alivePlayers = Array.from({ length: 7 }, (_, i) => ({
        id: `civilian-${i}`,
        role: 'civilian',
      }));
      const spyIds = ['spy-1', 'spy-2', 'spy-3'];
      
      const result = checkVictoryCondition(alivePlayers, spyIds);
      expect(result.gameOver).toBe(true);
      expect(result.winner).toBe('civilian');
    });
  });

  describe('属性测试：平民胜利条件', () => {
    it('当所有卧底被淘汰时，平民必定胜利', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 3, max: 20 }), // 总玩家数
          fc.integer({ min: 1, max: 10 }), // 卧底数（会被限制）
          (totalPlayers, rawSpyCount) => {
            const spyCount = Math.min(rawSpyCount, totalPlayers - 2);
            const civilianCount = totalPlayers - spyCount;
            
            // 生成玩家ID
            const spyIds = Array.from({ length: spyCount }, (_, i) => `spy-${i}`);
            
            // 所有卧底被淘汰，只剩平民
            const alivePlayers = Array.from({ length: civilianCount }, (_, i) => ({
              id: `civilian-${i}`,
              role: 'civilian',
            }));
            
            const result = checkVictoryCondition(alivePlayers, spyIds);
            
            // 所有卧底被淘汰 = 平民胜利
            expect(result.gameOver).toBe(true);
            expect(result.winner).toBe('civilian');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('只要有卧底存活且平民数量更多，游戏继续', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 2, max: 10 }), // 存活平民数
          fc.integer({ min: 1, max: 5 }),  // 存活卧底数
          (civilianCount, spyCount) => {
            // 确保平民数量严格大于卧底数量
            fc.pre(civilianCount > spyCount);
            
            const spyIds = Array.from({ length: spyCount }, (_, i) => `spy-${i}`);
            const alivePlayers = [
              ...Array.from({ length: civilianCount }, (_, i) => ({
                id: `civilian-${i}`,
                role: 'civilian',
              })),
              ...spyIds.map(id => ({ id, role: 'spy' })),
            ];
            
            const result = checkVictoryCondition(alivePlayers, spyIds);
            
            // 平民更多，游戏继续
            expect(result.gameOver).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('边界情况', () => {
    it('最小胜利场景：2平民淘汰1卧底', () => {
      const alivePlayers = [
        { id: 'p1', role: 'civilian' },
        { id: 'p2', role: 'civilian' },
      ];
      const spyIds = ['p3'];
      
      const result = checkVictoryCondition(alivePlayers, spyIds);
      expect(result.gameOver).toBe(true);
      expect(result.winner).toBe('civilian');
    });

    it('大规模游戏：19平民淘汰1卧底', () => {
      const alivePlayers = Array.from({ length: 19 }, (_, i) => ({
        id: `civilian-${i}`,
        role: 'civilian',
      }));
      const spyIds = ['spy-0'];
      
      const result = checkVictoryCondition(alivePlayers, spyIds);
      expect(result.gameOver).toBe(true);
      expect(result.winner).toBe('civilian');
    });
  });
});
