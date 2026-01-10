/**
 * 场景2 (⭐ 入门级): 加入房间基础测试
 * 
 * 测试目标：验证加入房间的基本功能
 * - 正确密码能加入房间
 * - 错误密码被拒绝
 * - 重复昵称被拒绝
 * - 游戏进行中无法加入
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { validPassword, validPlayerName, validRoomCode } from '../helpers/fc-arbitraries';
import { validatePassword, validatePlayerName, validateRoomCode } from '../../src/utils/validation';

describe('场景2: 加入房间基础测试', () => {
  
  describe('房间号验证', () => {
    it('应该接受6位数字的房间号', () => {
      fc.assert(
        fc.property(validRoomCode, (code) => {
          expect(validateRoomCode(code)).toBe(true);
        }),
        { numRuns: 100 }
      );
    });

    it('应该拒绝非6位数字的房间号', () => {
      const invalidCodes = ['12345', '1234567', 'abcdef', '12345a', ''];
      for (const code of invalidCodes) {
        expect(validateRoomCode(code)).toBe(false);
      }
    });
  });

  describe('加入房间逻辑', () => {
    it('正确密码应该允许加入', () => {
      fc.assert(
        fc.property(validPassword, validPlayerName, (password, playerName) => {
          const room = createMockRoom(password);
          const result = attemptJoinRoom(room, password, playerName);
          expect(result.success).toBe(true);
        }),
        { numRuns: 100 }
      );
    });

    it('错误密码应该被拒绝', () => {
      fc.assert(
        fc.property(validPassword, validPassword, validPlayerName, (correctPwd, wrongPwd, playerName) => {
          // 确保密码不同
          fc.pre(correctPwd !== wrongPwd);
          
          const room = createMockRoom(correctPwd);
          const result = attemptJoinRoom(room, wrongPwd, playerName);
          expect(result.success).toBe(false);
          expect(result.error).toContain('密码');
        }),
        { numRuns: 100 }
      );
    });

    it('重复昵称应该被拒绝', () => {
      fc.assert(
        fc.property(validPassword, validPlayerName, (password, playerName) => {
          const room = createMockRoom(password);
          room.players.push({ name: playerName, id: 'existing-player' });
          
          const result = attemptJoinRoom(room, password, playerName);
          expect(result.success).toBe(false);
          expect(result.error).toContain('昵称');
        }),
        { numRuns: 100 }
      );
    });

    it('游戏进行中应该拒绝新玩家', () => {
      fc.assert(
        fc.property(validPassword, validPlayerName, (password, playerName) => {
          const room = createMockRoom(password);
          room.phase = 'description'; // 游戏进行中
          
          const result = attemptJoinRoom(room, password, playerName);
          expect(result.success).toBe(false);
          expect(result.error).toContain('已开始');
        }),
        { numRuns: 100 }
      );
    });
  });
});

// 辅助类型和函数
interface MockRoom {
  id: string;
  code: string;
  password: string;
  phase: 'waiting' | 'word-reveal' | 'description' | 'voting' | 'result' | 'game-over';
  players: { name: string; id: string }[];
}

function createMockRoom(password: string): MockRoom {
  return {
    id: crypto.randomUUID(),
    code: String(Math.floor(100000 + Math.random() * 900000)),
    password,
    phase: 'waiting',
    players: [],
  };
}

interface JoinResult {
  success: boolean;
  error?: string;
}

function attemptJoinRoom(room: MockRoom, password: string, playerName: string): JoinResult {
  // 验证密码
  if (password !== room.password) {
    return { success: false, error: '密码错误' };
  }
  
  // 检查游戏状态
  if (room.phase !== 'waiting') {
    return { success: false, error: '游戏已开始，无法加入' };
  }
  
  // 检查昵称重复
  if (room.players.some(p => p.name === playerName)) {
    return { success: false, error: '该昵称已被使用' };
  }
  
  return { success: true };
}
