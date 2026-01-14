# 谁是卧底 - API 文档

## 概述

本文档描述了"谁是卧底"游戏的后端 API 规范。所有 API 返回 JSON 格式数据。

## 通用响应格式

### 成功响应
```json
{
  "success": true,
  // ... 其他数据字段
}
```

### 错误响应
```json
{
  "success": false,
  "error": "错误描述信息",
  "code": "ERROR_CODE"
}
```

### 错误码 (ErrorCode)
| 错误码 | 说明 | HTTP 状态码 |
|--------|------|-------------|
| `INVALID_INPUT` | 输入格式不正确 | 400 |
| `ROOM_NOT_FOUND` | 房间不存在 | 404 |
| `WRONG_PASSWORD` | 密码错误 | 401 |
| `GAME_IN_PROGRESS` | 游戏已开始，无法加入 | 409 |
| `NOT_AUTHORIZED` | 只有房主可以执行此操作 | 401 |
| `INVALID_ACTION` | 当前状态不允许此操作 | 409 |
| `PLAYER_NOT_FOUND` | 玩家不存在 | 404 |
| `DUPLICATE_NAME` | 该昵称已被使用 | 409 |
| `INVALID_PHASE` | 当前游戏阶段不允许此操作 | 409 |
| `DATABASE_ERROR` | 服务器错误 | 500 |

---

## API 端点

### 1. 创建房间

**POST** `/api/room/create`

创建一个新的游戏房间，创建者自动成为房主。

#### 请求体
```json
{
  "playerName": "玩家昵称"  // 2-10个非空白字符
}
```

#### 成功响应
```json
{
  "success": true,
  "roomCode": "123456",      // 6位数字房间号
  "roomId": "uuid",          // 房间唯一ID
  "roomPassword": "abcd",    // 4位自动生成的房间密码
  "playerToken": "uuid"      // 玩家身份令牌
}
```

#### 错误响应
```json
{
  "success": false,
  "error": "昵称必须是2-10个非空白字符",
  "code": "INVALID_INPUT"
}
```

---

### 2. 加入房间

**POST** `/api/room/join`

加入一个已存在的房间，或使用已有 token 重连。

#### 请求体
```json
{
  "roomCode": "123456",      // 6位数字房间号
  "password": "abcd",        // 4-8位房间密码
  "playerName": "玩家昵称",  // 2-10个非空白字符
  "playerToken": "uuid"      // 可选，用于重连
}
```

#### 成功响应
```json
{
  "success": true,
  "roomId": "uuid",          // 房间唯一ID
  "playerToken": "uuid",     // 玩家身份令牌
  "isReconnect": false       // 是否为重连
}
```

#### 错误响应示例
```json
{
  "success": false,
  "error": "房间不存在",
  "code": "ROOM_NOT_FOUND"
}
```

---

### 3. 获取房间状态

**GET** `/api/room/:roomId/state?token=:playerToken`

获取当前房间的完整状态。

#### URL 参数
- `roomId`: 房间唯一ID
- `token`: 玩家身份令牌 (query parameter)

#### 成功响应
```json
{
  "success": true,
  "state": {
    "roomId": "uuid",
    "roomCode": "123456",
    "phase": "waiting",           // 游戏阶段
    "players": [                  // 玩家列表
      {
        "id": "uuid",
        "name": "玩家1",
        "isHost": true,
        "isAlive": true,
        "isOnline": true,
        "hasVoted": false,
        "hasDescribed": false,
        "role": "civilian"        // 仅在 game-over 阶段显示
      }
    ],
    "currentTurn": 0,             // 当前轮到的玩家索引
    "round": 1,                   // 当前回合数
    "descriptions": [             // 描述记录
      {
        "playerId": "uuid",
        "playerName": "玩家1",
        "text": "描述内容",
        "round": 1
      }
    ],
    "votes": [                    // 投票记录 (仅在 result/game-over 阶段显示)
      {
        "voterId": "uuid",         // 投票者ID
        "targetId": "uuid",        // 被投票者ID
        "round": 1
      }
    ],
    "settings": {
      "spyCount": 1,
      "minPlayers": 3,
      "maxPlayers": 20
    },
    "myPlayerId": "uuid",         // 当前玩家的ID
    "isHost": true,               // 当前玩家是否为房主
    "myWord": "苹果",             // 当前玩家的词语 (非 waiting 阶段)
    "myRole": "civilian",         // 当前玩家的角色 (非 waiting 阶段)
    "result": {                   // 结果信息 (result/game-over 阶段)
      "eliminatedPlayerIds": ["uuid1", "uuid2"],  // 本轮被淘汰的玩家ID数组（平票时有多个）
      "winner": "civilian"
    },
    "civilianWord": "苹果",       // 平民词语 (仅 game-over 阶段)
    "spyWord": "梨子"             // 卧底词语 (仅 game-over 阶段)
  }
}
```

#### 游戏阶段 (phase)
| 阶段 | 说明 |
|------|------|
| `waiting` | 等待玩家加入 |
| `word-reveal` | 查看词语阶段 |
| `description` | 描述阶段 |
| `voting` | 投票阶段 |
| `result` | 投票结果展示 |
| `game-over` | 游戏结束 |

---

### 4. 执行游戏动作

**POST** `/api/room/:roomId/action`

执行各种游戏动作。

#### URL 参数
- `roomId`: 房间唯一ID

#### 请求体通用格式
```json
{
  "token": "playerToken",
  "action": {
    "type": "action-type",
    // ... 动作特定参数
  }
}
```

#### 通用成功响应
```json
{
  "success": true
}
```

---

#### 4.1 开始游戏 (start-game)

仅房主可执行，需要至少3名玩家。

```json
{
  "token": "playerToken",
  "action": {
    "type": "start-game"
  }
}
```

---

#### 4.2 确认词语 (confirm-word)

在 word-reveal 阶段确认已查看词语。

```json
{
  "token": "playerToken",
  "action": {
    "type": "confirm-word"
  }
}
```

---

#### 4.3 提交描述 (submit-description)

在 description 阶段提交描述。

```json
{
  "token": "playerToken",
  "action": {
    "type": "submit-description",
    "text": "描述内容"           // 2-50个字符，不能包含自己的词语
  }
}
```

---

#### 4.4 跳过玩家 (next-player)

仅房主可执行，跳过当前玩家的描述。

```json
{
  "token": "playerToken",
  "action": {
    "type": "next-player"
  }
}
```

---

#### 4.5 开始投票 (start-voting)

仅房主可执行，从描述阶段进入投票阶段。

```json
{
  "token": "playerToken",
  "action": {
    "type": "start-voting"
  }
}
```

---

#### 4.6 投票 (vote)

在 voting 阶段投票。

```json
{
  "token": "playerToken",
  "action": {
    "type": "vote",
    "targetId": "目标玩家ID"     // 不能投自己，不能投已淘汰玩家
  }
}
```

---

#### 4.7 结束投票 (finalize-voting)

仅房主可执行，结束投票并计算结果。

```json
{
  "token": "playerToken",
  "action": {
    "type": "finalize-voting"
  }
}
```

---

#### 4.8 继续游戏 (continue-game)

仅房主可执行，从 result 阶段继续下一轮。

```json
{
  "token": "playerToken",
  "action": {
    "type": "continue-game"
  }
}
```

---

#### 4.9 重新开始 (restart-game)

仅房主可执行，重置游戏回到等待阶段。

```json
{
  "token": "playerToken",
  "action": {
    "type": "restart-game"
  }
}
```

---

#### 4.10 更新设置 (update-settings)

仅房主可执行，仅在 waiting 阶段可用。

```json
{
  "token": "playerToken",
  "action": {
    "type": "update-settings",
    "settings": {
      "spyCount": 2              // 卧底数量，至少为1
    }
  }
}
```

---

#### 4.11 踢出玩家 (kick-player)

仅房主可执行，仅在 waiting 阶段可用。

```json
{
  "token": "playerToken",
  "action": {
    "type": "kick-player",
    "playerId": "目标玩家ID"     // 不能踢自己
  }
}
```

---

## 数据类型定义

### PlayerInfo
```typescript
interface PlayerInfo {
  id: string;
  name: string;
  isHost: boolean;
  isAlive: boolean;
  isOnline: boolean;
  role?: 'civilian' | 'spy';    // 仅 game-over 阶段
  hasVoted?: boolean;
  hasDescribed?: boolean;
}
```

### GameSettings
```typescript
interface GameSettings {
  spyCount: number;
  minPlayers: number;
  maxPlayers: number;
}
```

### RoomStateResponse
```typescript
interface RoomStateResponse {
  roomId: string;
  roomCode: string;
  phase: 'waiting' | 'word-reveal' | 'description' | 'voting' | 'result' | 'game-over';
  players: PlayerInfo[];
  currentTurn: number;
  round: number;
  descriptions: { playerId: string; playerName: string; text: string; round: number }[];
  votes: { voterId: string; targetId: string; round: number }[];
  settings: GameSettings;
  isHost: boolean;
  myWord?: string;
  myRole?: 'civilian' | 'spy';
  result?: {
    eliminatedPlayerId?: string;
    winner?: 'civilian' | 'spy';
  };
  civilianWord?: string;
  spyWord?: string;
}
```

---

## 注意事项

1. **响应结构**: 所有 API 响应都包含 `success` 字段。获取房间状态时，实际状态数据在 `state` 字段中。

2. **Token 管理**: 玩家 token 应保存在 localStorage 中，用于重连和身份验证。

3. **轮询**: 前端应每 2 秒轮询一次 `/api/room/:roomId/state` 以获取最新状态。

4. **错误处理**: 连续 3 次请求失败应视为断线，需要提示用户。
