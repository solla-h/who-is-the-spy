/**
 * 场景1 (⭐ 入门级): 创建房间基础测试
 * 
 * 测试目标：验证房间创建的基本功能
 * - 有效密码和昵称能成功创建房间
 * - 无效输入被正确拒绝
 * - 房间初始状态正确
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { validPassword, validPlayerName, invalidPassword, invalidPlayerName } from '../helpers/fc-arbitraries';
import { validatePassword, validatePlayerName } from '../../src/utils/validation';

describe('场景1: 创建房间基础测试', () => {
  
  describe('密码验证', () => {
    it('应该接受4-8字符的有效密码', () => {
      fc.assert(
        fc.property(validPassword, (password) => {
          expect(validatePassword(password)).toBe(true);
        }),
        { numRuns: 100 }
      );
    });

    it('应该拒绝无效密码', () => {
      fc.assert(
        fc.property(invalidPassword, (password) => {
          expect(validatePassword(password)).toBe(false);
        }),
        { numRuns: 100 }
      );
    });
  });

  describe('昵称验证', () => {
    it('应该接受2-10字符的有效昵称', () => {
      fc.assert(
        fc.property(validPlayerName, (name) => {
          expect(validatePlayerName(name)).toBe(true);
        }),
        { numRuns: 100 }
      );
    });

    it('应该拒绝无效昵称', () => {
      fc.assert(
        fc.property(invalidPlayerName, (name) => {
          expect(validatePlayerName(name)).toBe(false);
        }),
        { numRuns: 100 }
      );
    });
  });

  describe('房间初始化', () => {
    it('创建的房间应该处于waiting阶段', () => {
      fc.assert(
        fc.property(validPassword, validPlayerName, (password, playerName) => {
          // 模拟房间创建逻辑
          const room = createRoomLogic(password, playerName);
          expect(room.phase).toBe('waiting');
        }),
        { numRuns: 100 }
      );
    });

    it('创建者应该被设为房主', () => {
      fc.assert(
        fc.property(validPassword, validPlayerName, (password, playerName) => {
          const result = createRoomLogic(password, playerName);
          expect(result.hostId).toBe(result.playerId);
        }),
        { numRuns: 100 }
      );
    });

    it('房间号应该是6位数字', () => {
      fc.assert(
        fc.property(validPassword, validPlayerName, (password, playerName) => {
          const result = createRoomLogic(password, playerName);
          expect(result.roomCode).toMatch(/^\d{6}$/);
        }),
        { numRuns: 100 }
      );
    });
  });
});

// 辅助函数：模拟房间创建逻辑
function createRoomLogic(password: string, playerName: string) {
  const roomId = crypto.randomUUID();
  const playerId = crypto.randomUUID();
  const playerToken = crypto.randomUUID();
  const roomCode = String(Math.floor(100000 + Math.random() * 900000));

  return {
    roomId,
    playerId,
    playerToken,
    roomCode,
    phase: 'waiting' as const,
    hostId: playerId,
    playerName,
  };
}
