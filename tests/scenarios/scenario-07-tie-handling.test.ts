/**
 * 场景7 (⭐⭐⭐⭐ 困难级): 平票处理测试
 * 
 * 测试目标：验证投票平局的各种场景
 * - 两人平票
 * - 多人平票
 * - 平票后的胜利条件判断
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { tallyVotes, checkVictoryCondition } from '../../src/api/game';

describe('场景7: 平票处理测试', () => {
  
  describe('两人平票', () => {
    it('两人各得2票应该同时被淘汰', () => {
      const votes = [
        { targetId: 'p1' },
        { targetId: 'p1' },
        { targetId: 'p2' },
        { targetId: 'p2' },
      ];
      
      const result = tallyVotes(votes);
      expect(result.maxVotes).toBe(2);
      expect(result.eliminatedPlayerIds).toHaveLength(2);
      expect(result.eliminatedPlayerIds).toContain('p1');
      expect(result.eliminatedPlayerIds).toContain('p2');
    });

    it('两人各得1票应该同时被淘汰', () => {
      const votes = [
        { targetId: 'p1' },
        { targetId: 'p2' },
      ];
      
      const result = tallyVotes(votes);
      expect(result.maxVotes).toBe(1);
      expect(result.eliminatedPlayerIds).toHaveLength(2);
    });
  });

  describe('多人平票', () => {
    it('三人各得2票应该全部被淘汰', () => {
      const votes = [
        { targetId: 'p1' },
        { targetId: 'p1' },
        { targetId: 'p2' },
        { targetId: 'p2' },
        { targetId: 'p3' },
        { targetId: 'p3' },
      ];
      
      const result = tallyVotes(votes);
      expect(result.maxVotes).toBe(2);
      expect(result.eliminatedPlayerIds).toHaveLength(3);
      expect(result.eliminatedPlayerIds).toContain('p1');
      expect(result.eliminatedPlayerIds).toContain('p2');
      expect(result.eliminatedPlayerIds).toContain('p3');
    });

    it('四人各得1票应该全部被淘汰', () => {
      const votes = [
        { targetId: 'p1' },
        { targetId: 'p2' },
        { targetId: 'p3' },
        { targetId: 'p4' },
      ];
      
      const result = tallyVotes(votes);
      expect(result.maxVotes).toBe(1);
      expect(result.eliminatedPlayerIds).toHaveLength(4);
    });
  });

  describe('属性测试：平票一致性', () => {
    it('所有最高票玩家都应该被淘汰', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 2, max: 5 }),  // 平票玩家数
          fc.integer({ min: 1, max: 5 }),  // 每人票数
          fc.integer({ min: 0, max: 5 }),  // 其他玩家数
          (tiedCount, votesPerTied, otherCount) => {
            const votes: { targetId: string }[] = [];
            
            // 平票玩家
            for (let i = 0; i < tiedCount; i++) {
              for (let j = 0; j < votesPerTied; j++) {
                votes.push({ targetId: `tied-${i}` });
              }
            }
            
            // 其他玩家（票数更少）
            for (let i = 0; i < otherCount; i++) {
              for (let j = 0; j < votesPerTied - 1; j++) {
                votes.push({ targetId: `other-${i}` });
              }
            }
            
            const result = tallyVotes(votes);
            
            // 所有平票玩家都应该被淘汰
            expect(result.eliminatedPlayerIds.length).toBe(tiedCount);
            for (let i = 0; i < tiedCount; i++) {
              expect(result.eliminatedPlayerIds).toContain(`tied-${i}`);
            }
            
            // 其他玩家不应该被淘汰
            for (let i = 0; i < otherCount; i++) {
              expect(result.eliminatedPlayerIds).not.toContain(`other-${i}`);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('平票玩家的票数应该相等且为最大值', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 2, max: 10 }), // 平票玩家数
          fc.integer({ min: 1, max: 10 }), // 每人票数
          (tiedCount, votesPerTied) => {
            const votes: { targetId: string }[] = [];
            
            for (let i = 0; i < tiedCount; i++) {
              for (let j = 0; j < votesPerTied; j++) {
                votes.push({ targetId: `player-${i}` });
              }
            }
            
            const result = tallyVotes(votes);
            
            // 所有被淘汰玩家票数相等
            for (const eliminatedId of result.eliminatedPlayerIds) {
              expect(result.voteCounts.get(eliminatedId)).toBe(result.maxVotes);
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('平票后的胜利条件', () => {
    it('平票淘汰两个平民后卧底可能胜利', () => {
      // 初始: 3平民 + 1卧底
      // 平票淘汰2个平民后: 1平民 + 1卧底 = 卧底胜利
      const alivePlayers = [
        { id: 'civilian-1', role: 'civilian' },
        { id: 'spy-1', role: 'spy' },
      ];
      const spyIds = ['spy-1'];
      
      const result = checkVictoryCondition(alivePlayers, spyIds);
      expect(result.gameOver).toBe(true);
      expect(result.winner).toBe('spy');
    });

    it('平票淘汰卧底和平民后可能平民胜利', () => {
      // 初始: 3平民 + 1卧底
      // 平票淘汰1平民和1卧底后: 2平民 = 平民胜利
      const alivePlayers = [
        { id: 'civilian-1', role: 'civilian' },
        { id: 'civilian-2', role: 'civilian' },
      ];
      const spyIds = ['spy-1']; // 卧底已被淘汰
      
      const result = checkVictoryCondition(alivePlayers, spyIds);
      expect(result.gameOver).toBe(true);
      expect(result.winner).toBe('civilian');
    });

    it('平票淘汰后游戏可能继续', () => {
      // 初始: 5平民 + 1卧底
      // 平票淘汰2平民后: 3平民 + 1卧底 = 游戏继续
      const alivePlayers = [
        { id: 'civilian-1', role: 'civilian' },
        { id: 'civilian-2', role: 'civilian' },
        { id: 'civilian-3', role: 'civilian' },
        { id: 'spy-1', role: 'spy' },
      ];
      const spyIds = ['spy-1'];
      
      const result = checkVictoryCondition(alivePlayers, spyIds);
      expect(result.gameOver).toBe(false);
    });
  });

  describe('极端平票场景', () => {
    it('所有玩家都得到相同票数', () => {
      // 5人游戏，每人得1票
      const votes = [
        { targetId: 'p1' },
        { targetId: 'p2' },
        { targetId: 'p3' },
        { targetId: 'p4' },
        { targetId: 'p5' },
      ];
      
      const result = tallyVotes(votes);
      expect(result.maxVotes).toBe(1);
      expect(result.eliminatedPlayerIds).toHaveLength(5);
    });

    it('大规模平票：10人各得3票', () => {
      const votes: { targetId: string }[] = [];
      for (let i = 0; i < 10; i++) {
        for (let j = 0; j < 3; j++) {
          votes.push({ targetId: `player-${i}` });
        }
      }
      
      const result = tallyVotes(votes);
      expect(result.maxVotes).toBe(3);
      expect(result.eliminatedPlayerIds).toHaveLength(10);
    });
  });
});
