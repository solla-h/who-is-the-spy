/**
 * 场景8 (⭐⭐⭐⭐ 困难级): 多卧底游戏测试
 * 
 * 测试目标：验证多卧底配置的各种场景
 * - 角色分配正确性
 * - 胜利条件计算
 * - 边界配置验证
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { validateGameStart, selectSpies, checkVictoryCondition } from '../../src/api/game';

describe('场景8: 多卧底游戏测试', () => {
  
  describe('游戏配置验证', () => {
    it('5人2卧底是有效配置', () => {
      const result = validateGameStart(5, 2);
      expect(result.valid).toBe(true);
    });

    it('10人3卧底是有效配置', () => {
      const result = validateGameStart(10, 3);
      expect(result.valid).toBe(true);
    });

    it('20人5卧底是有效配置', () => {
      const result = validateGameStart(20, 5);
      expect(result.valid).toBe(true);
    });

    it('卧底数量不能等于玩家数量', () => {
      fc.assert(
        fc.property(fc.integer({ min: 3, max: 20 }), (playerCount) => {
          const result = validateGameStart(playerCount, playerCount);
          expect(result.valid).toBe(false);
        }),
        { numRuns: 50 }
      );
    });

    it('卧底数量不能大于玩家数量-1', () => {
      fc.assert(
        fc.property(fc.integer({ min: 3, max: 20 }), (playerCount) => {
          const result = validateGameStart(playerCount, playerCount - 1);
          expect(result.valid).toBe(false);
        }),
        { numRuns: 50 }
      );
    });
  });

  describe('多卧底角色分配', () => {
    it('应该正确分配指定数量的卧底', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 4, max: 20 }), // 玩家数
          fc.integer({ min: 2, max: 10 }), // 卧底数（会被限制）
          (playerCount, rawSpyCount) => {
            const spyCount = Math.min(rawSpyCount, playerCount - 2);
            const playerIds = Array.from({ length: playerCount }, (_, i) => `player-${i}`);
            
            const spyIds = selectSpies(playerIds, spyCount);
            
            expect(spyIds.length).toBe(spyCount);
            
            // 所有卧底ID都应该在玩家列表中
            for (const spyId of spyIds) {
              expect(playerIds).toContain(spyId);
            }
            
            // 卧底ID应该唯一
            const uniqueSpyIds = new Set(spyIds);
            expect(uniqueSpyIds.size).toBe(spyCount);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('平民数量应该等于总人数减去卧底数', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 4, max: 20 }),
          fc.integer({ min: 2, max: 10 }),
          (playerCount, rawSpyCount) => {
            const spyCount = Math.min(rawSpyCount, playerCount - 2);
            const playerIds = Array.from({ length: playerCount }, (_, i) => `player-${i}`);
            
            const spyIds = selectSpies(playerIds, spyCount);
            const spyIdSet = new Set(spyIds);
            const civilianIds = playerIds.filter(id => !spyIdSet.has(id));
            
            expect(civilianIds.length).toBe(playerCount - spyCount);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('多卧底胜利条件', () => {
    it('2卧底全部被淘汰 = 平民胜利', () => {
      const alivePlayers = [
        { id: 'c1', role: 'civilian' },
        { id: 'c2', role: 'civilian' },
        { id: 'c3', role: 'civilian' },
      ];
      const spyIds = ['s1', 's2']; // 两个卧底都被淘汰
      
      const result = checkVictoryCondition(alivePlayers, spyIds);
      expect(result.gameOver).toBe(true);
      expect(result.winner).toBe('civilian');
    });

    it('2卧底存活 vs 2平民 = 卧底胜利', () => {
      const alivePlayers = [
        { id: 'c1', role: 'civilian' },
        { id: 'c2', role: 'civilian' },
        { id: 's1', role: 'spy' },
        { id: 's2', role: 'spy' },
      ];
      const spyIds = ['s1', 's2'];
      
      const result = checkVictoryCondition(alivePlayers, spyIds);
      expect(result.gameOver).toBe(true);
      expect(result.winner).toBe('spy');
    });

    it('1卧底被淘汰，1卧底存活 vs 2平民 = 游戏继续', () => {
      const alivePlayers = [
        { id: 'c1', role: 'civilian' },
        { id: 'c2', role: 'civilian' },
        { id: 's1', role: 'spy' },
      ];
      const spyIds = ['s1', 's2']; // s2已被淘汰
      
      const result = checkVictoryCondition(alivePlayers, spyIds);
      expect(result.gameOver).toBe(false);
    });

    it('3卧底存活 vs 2平民 = 卧底胜利', () => {
      const alivePlayers = [
        { id: 'c1', role: 'civilian' },
        { id: 'c2', role: 'civilian' },
        { id: 's1', role: 'spy' },
        { id: 's2', role: 'spy' },
        { id: 's3', role: 'spy' },
      ];
      const spyIds = ['s1', 's2', 's3'];
      
      const result = checkVictoryCondition(alivePlayers, spyIds);
      expect(result.gameOver).toBe(true);
      expect(result.winner).toBe('spy');
    });
  });

  describe('属性测试：多卧底游戏一致性', () => {
    it('卧底全部被淘汰时平民必定胜利', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 2, max: 10 }), // 存活平民数
          fc.integer({ min: 1, max: 5 }),  // 被淘汰卧底数
          (civilianCount, eliminatedSpyCount) => {
            const spyIds = Array.from({ length: eliminatedSpyCount }, (_, i) => `spy-${i}`);
            const alivePlayers = Array.from({ length: civilianCount }, (_, i) => ({
              id: `civilian-${i}`,
              role: 'civilian',
            }));
            
            const result = checkVictoryCondition(alivePlayers, spyIds);
            
            expect(result.gameOver).toBe(true);
            expect(result.winner).toBe('civilian');
          }
        ),
        { numRuns: 100 }
      );
    });

    it('存活卧底数>=存活平民数时卧底必定胜利', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 10 }), // 存活卧底数
          fc.integer({ min: 1, max: 10 }), // 存活平民数
          (aliveSpyCount, aliveCivilianCount) => {
            fc.pre(aliveSpyCount >= aliveCivilianCount);
            
            const spyIds = Array.from({ length: aliveSpyCount }, (_, i) => `spy-${i}`);
            const alivePlayers = [
              ...Array.from({ length: aliveCivilianCount }, (_, i) => ({
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
  });

  describe('边界配置', () => {
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

    it('超过最大卧底配置应该失败', () => {
      fc.assert(
        fc.property(fc.integer({ min: 3, max: 20 }), (playerCount) => {
          const invalidSpyCount = playerCount - 1;
          const result = validateGameStart(playerCount, invalidSpyCount);
          expect(result.valid).toBe(false);
        }),
        { numRuns: 50 }
      );
    });
  });
});
