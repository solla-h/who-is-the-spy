/**
 * 场景6 (⭐⭐⭐ 中等级): 卧底胜利条件测试
 * 
 * 测试目标：验证卧底胜利的各种场景
 * - 卧底数量等于平民数量
 * - 卧底数量大于平民数量
 * - 边界情况处理
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { checkVictoryCondition } from '../../src/api/game';

describe('场景6: 卧底胜利条件测试', () => {
  
  describe('卧底数量等于平民数量', () => {
    it('1卧底 vs 1平民 = 卧底胜利', () => {
      const alivePlayers = [
        { id: 'civilian-1', role: 'civilian' },
        { id: 'spy-1', role: 'spy' },
      ];
      const spyIds = ['spy-1'];
      
      const result = checkVictoryCondition(alivePlayers, spyIds);
      expect(result.gameOver).toBe(true);
      expect(result.winner).toBe('spy');
    });

    it('2卧底 vs 2平民 = 卧底胜利', () => {
      const alivePlayers = [
        { id: 'civilian-1', role: 'civilian' },
        { id: 'civilian-2', role: 'civilian' },
        { id: 'spy-1', role: 'spy' },
        { id: 'spy-2', role: 'spy' },
      ];
      const spyIds = ['spy-1', 'spy-2'];
      
      const result = checkVictoryCondition(alivePlayers, spyIds);
      expect(result.gameOver).toBe(true);
      expect(result.winner).toBe('spy');
    });

    it('3卧底 vs 3平民 = 卧底胜利', () => {
      const alivePlayers = [
        { id: 'civilian-1', role: 'civilian' },
        { id: 'civilian-2', role: 'civilian' },
        { id: 'civilian-3', role: 'civilian' },
        { id: 'spy-1', role: 'spy' },
        { id: 'spy-2', role: 'spy' },
        { id: 'spy-3', role: 'spy' },
      ];
      const spyIds = ['spy-1', 'spy-2', 'spy-3'];
      
      const result = checkVictoryCondition(alivePlayers, spyIds);
      expect(result.gameOver).toBe(true);
      expect(result.winner).toBe('spy');
    });
  });

  describe('卧底数量大于平民数量', () => {
    it('2卧底 vs 1平民 = 卧底胜利', () => {
      const alivePlayers = [
        { id: 'civilian-1', role: 'civilian' },
        { id: 'spy-1', role: 'spy' },
        { id: 'spy-2', role: 'spy' },
      ];
      const spyIds = ['spy-1', 'spy-2'];
      
      const result = checkVictoryCondition(alivePlayers, spyIds);
      expect(result.gameOver).toBe(true);
      expect(result.winner).toBe('spy');
    });

    it('3卧底 vs 1平民 = 卧底胜利', () => {
      const alivePlayers = [
        { id: 'civilian-1', role: 'civilian' },
        { id: 'spy-1', role: 'spy' },
        { id: 'spy-2', role: 'spy' },
        { id: 'spy-3', role: 'spy' },
      ];
      const spyIds = ['spy-1', 'spy-2', 'spy-3'];
      
      const result = checkVictoryCondition(alivePlayers, spyIds);
      expect(result.gameOver).toBe(true);
      expect(result.winner).toBe('spy');
    });
  });

  describe('属性测试：卧底胜利条件', () => {
    it('当卧底数量>=平民数量时，卧底必定胜利', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 10 }), // 存活卧底数
          fc.integer({ min: 1, max: 10 }), // 存活平民数
          (spyCount, civilianCount) => {
            // 确保卧底数量 >= 平民数量
            fc.pre(spyCount >= civilianCount);
            
            const spyIds = Array.from({ length: spyCount }, (_, i) => `spy-${i}`);
            const alivePlayers = [
              ...Array.from({ length: civilianCount }, (_, i) => ({
                id: `civilian-${i}`,
                role: 'civilian',
              })),
              ...spyIds.map(id => ({ id, role: 'spy' })),
            ];
            
            const result = checkVictoryCondition(alivePlayers, spyIds);
            
            expect(result.gameOver).toBe(true);
            expect(result.winner).toBe('spy');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('卧底胜利时游戏必定结束', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 5 }), // 卧底数
          (spyCount) => {
            // 平民数量 <= 卧底数量
            const civilianCount = spyCount;
            
            const spyIds = Array.from({ length: spyCount }, (_, i) => `spy-${i}`);
            const alivePlayers = [
              ...Array.from({ length: civilianCount }, (_, i) => ({
                id: `civilian-${i}`,
                role: 'civilian',
              })),
              ...spyIds.map(id => ({ id, role: 'spy' })),
            ];
            
            const result = checkVictoryCondition(alivePlayers, spyIds);
            
            expect(result.gameOver).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('游戏进行中场景', () => {
    it('2平民 vs 1卧底 = 游戏继续', () => {
      const alivePlayers = [
        { id: 'civilian-1', role: 'civilian' },
        { id: 'civilian-2', role: 'civilian' },
        { id: 'spy-1', role: 'spy' },
      ];
      const spyIds = ['spy-1'];
      
      const result = checkVictoryCondition(alivePlayers, spyIds);
      expect(result.gameOver).toBe(false);
    });

    it('5平民 vs 2卧底 = 游戏继续', () => {
      const alivePlayers = [
        { id: 'civilian-1', role: 'civilian' },
        { id: 'civilian-2', role: 'civilian' },
        { id: 'civilian-3', role: 'civilian' },
        { id: 'civilian-4', role: 'civilian' },
        { id: 'civilian-5', role: 'civilian' },
        { id: 'spy-1', role: 'spy' },
        { id: 'spy-2', role: 'spy' },
      ];
      const spyIds = ['spy-1', 'spy-2'];
      
      const result = checkVictoryCondition(alivePlayers, spyIds);
      expect(result.gameOver).toBe(false);
    });
  });

  describe('边界情况', () => {
    it('只剩1个卧底存活（所有平民被淘汰）= 卧底胜利', () => {
      const alivePlayers = [
        { id: 'spy-1', role: 'spy' },
      ];
      const spyIds = ['spy-1'];
      
      const result = checkVictoryCondition(alivePlayers, spyIds);
      expect(result.gameOver).toBe(true);
      expect(result.winner).toBe('spy');
    });

    it('多个卧底存活，0平民 = 卧底胜利', () => {
      const alivePlayers = [
        { id: 'spy-1', role: 'spy' },
        { id: 'spy-2', role: 'spy' },
        { id: 'spy-3', role: 'spy' },
      ];
      const spyIds = ['spy-1', 'spy-2', 'spy-3'];
      
      const result = checkVictoryCondition(alivePlayers, spyIds);
      expect(result.gameOver).toBe(true);
      expect(result.winner).toBe('spy');
    });
  });
});
