/**
 * 场景4 (⭐⭐ 简单级): 投票淘汰测试
 * 
 * 测试目标：验证投票和淘汰机制
 * - 投票验证规则
 * - 票数统计正确性
 * - 淘汰逻辑
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { validateVote, tallyVotes } from '../../src/api/game';

describe('场景4: 投票淘汰测试', () => {
  
  describe('投票验证', () => {
    it('存活玩家可以投票给其他存活玩家', () => {
      const result = validateVote('voter1', 'target1', true, true, false);
      expect(result.valid).toBe(true);
    });

    it('已淘汰玩家不能投票', () => {
      const result = validateVote('voter1', 'target1', false, true, false);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('淘汰');
    });

    it('不能投票给自己', () => {
      const result = validateVote('player1', 'player1', true, true, false);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('自己');
    });

    it('不能投票给已淘汰的玩家', () => {
      const result = validateVote('voter1', 'target1', true, false, false);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('淘汰');
    });

    it('每轮只能投一次票', () => {
      const result = validateVote('voter1', 'target1', true, true, true);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('已经投过票');
    });
  });

  describe('票数统计', () => {
    it('应该正确统计每个玩家的票数', () => {
      fc.assert(
        fc.property(
          fc.array(fc.integer({ min: 0, max: 4 }), { minLength: 1, maxLength: 20 }),
          (voteIndices) => {
            const playerIds = ['p0', 'p1', 'p2', 'p3', 'p4'];
            const votes = voteIndices.map(idx => ({ targetId: playerIds[idx] }));
            
            // 手动计算期望票数
            const expectedCounts = new Map<string, number>();
            for (const vote of votes) {
              expectedCounts.set(vote.targetId, (expectedCounts.get(vote.targetId) || 0) + 1);
            }
            
            const result = tallyVotes(votes);
            
            // 验证票数
            for (const [playerId, count] of expectedCounts) {
              expect(result.voteCounts.get(playerId)).toBe(count);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('最高票数玩家应该被淘汰', () => {
      const votes = [
        { targetId: 'p1' },
        { targetId: 'p1' },
        { targetId: 'p1' },
        { targetId: 'p2' },
        { targetId: 'p3' },
      ];
      
      const result = tallyVotes(votes);
      expect(result.eliminatedPlayerIds).toEqual(['p1']);
      expect(result.maxVotes).toBe(3);
    });

    it('没有投票时不应该淘汰任何人', () => {
      const result = tallyVotes([]);
      expect(result.eliminatedPlayerIds).toHaveLength(0);
      expect(result.maxVotes).toBe(0);
    });
  });

  describe('淘汰后状态', () => {
    it('被淘汰玩家应该从存活列表中移除', () => {
      // 模拟淘汰逻辑
      const players = [
        { id: 'p1', isAlive: true },
        { id: 'p2', isAlive: true },
        { id: 'p3', isAlive: true },
      ];
      
      const eliminatedId = 'p2';
      
      // 执行淘汰
      const updatedPlayers = players.map(p => ({
        ...p,
        isAlive: p.id === eliminatedId ? false : p.isAlive,
      }));
      
      expect(updatedPlayers.find(p => p.id === 'p2')?.isAlive).toBe(false);
      expect(updatedPlayers.filter(p => p.isAlive).length).toBe(2);
    });

    it('淘汰后回合应该跳过被淘汰玩家', () => {
      // 模拟3人游戏，p2被淘汰
      const alivePlayers = [
        { id: 'p1', joinOrder: 0 },
        { id: 'p3', joinOrder: 2 },
      ];
      
      // 回合应该在存活玩家间循环
      const currentTurn = 0;
      const nextTurn = (currentTurn + 1) % alivePlayers.length;
      
      expect(nextTurn).toBe(1);
      expect(alivePlayers[nextTurn].id).toBe('p3');
    });
  });

  describe('属性测试：投票一致性', () => {
    it('总票数应该等于投票次数', () => {
      fc.assert(
        fc.property(
          fc.array(fc.uuid(), { minLength: 0, maxLength: 50 }),
          (targetIds) => {
            const votes = targetIds.map(id => ({ targetId: id }));
            const result = tallyVotes(votes);
            
            let totalVotes = 0;
            for (const count of result.voteCounts.values()) {
              totalVotes += count;
            }
            
            expect(totalVotes).toBe(votes.length);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('被淘汰玩家的票数应该等于最高票数', () => {
      fc.assert(
        fc.property(
          fc.array(fc.integer({ min: 0, max: 9 }), { minLength: 1, maxLength: 30 }),
          (voteIndices) => {
            const playerIds = Array.from({ length: 10 }, (_, i) => `p${i}`);
            const votes = voteIndices.map(idx => ({ targetId: playerIds[idx] }));
            
            const result = tallyVotes(votes);
            
            for (const eliminatedId of result.eliminatedPlayerIds) {
              expect(result.voteCounts.get(eliminatedId)).toBe(result.maxVotes);
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
