# 谁是卧底 AI 玩家功能设计说明书 (Linus Edition)

## 1. 核心理念 (Philosophy)

**"Code should be simple, not smart."**

AI 玩家本质上就是一个**函数调用**。
它不是什么"智能体"，不是什么"服务"。它只是一个接受游戏状态输入，返回 API 调用参数的函数。

**No State on Bot.** Status is in the Database.
**No OOP Bloat.** Just plain functions.
**No Runtime I/O.** Prompts are code.

---

## 2. 参与流程 (Workflow)

简单直接，不搞特殊化：

1.  **Inject**: 房主点一下 -> `DB.players` 加一行 `is_bot=1`。
2.  **Trigger**: 轮到某人 -> 检查 `is_bot` -> 若是，触发后台任务。
3.  **Action**: 后台任务 -> 读 DB -> 拼 Prompt -> 调 LLM -> 写 DB。
4.  **Wait**: 全程 `ctx.waitUntil`，不阻塞主线程，不让用户等待。

---

## 3. 极简架构 (Architecture)

```
[ Worker Event ] -> [ Bot Trigger ]
                          |
                          v
                  [ Context Builder ] (Read DB)
                          |
                          v
                  [ Prompt Template ] (String Interpolation)
                          |
                          v
                  [ LLM Caller ] (Fetch)
                          |
                          v
                  [ Game API ] (Write DB)
```

**Deleted:** `BotService`, `LLMAdapter` interfaces, `PromptLoader` classes. 
**Added:** `src/bot/*.ts` (Just functions).

---

## 4. 数据结构 (Data Structures)

### Database
仅修改 `players` 表：
```sql
ALTER TABLE players ADD COLUMN is_bot INTEGER DEFAULT 0;
```

### Configuration (Environment)
`wrangler.toml` [vars]:
- `BOT_LLM_PROVIDER`: "openai", "gemini", "claude"
- `BOT_LLM_BASE_URL`: "https://api.deepseek.com"
- `BOT_LLM_MODEL`: "deepseek-chat"
- `BOT_LLM_API_KEY`: (Secret)

---

## 5. 核心逻辑 (Implementation)

不要写那些又臭又长的类。我们只需要三个文件。

### 5.1 `src/bot/prompts.ts` (The Brain)

Prompt 就是字符串常量。构建时直接加载，运行时直接替换。

```typescript
export const SYSTEM_PROMPT = `
You are playing "Who is the Spy".
...
RULES:
1. You only know your word: {{MY_WORD}}.
2. You DON'T know your role (Civilian/Spy).
3. Infer your identity from others' descriptions.
...
Output strictly JSON.
`;

export const DESC_PROMPT = `
Round: {{ROUND}}
Alive: {{ALIVE_COUNT}} ({{SPY_COUNT}} Spies)
History:
{{HISTORY}}

Task: Describe {{MY_WORD}} without saying it.
Output JSON: { "thought": "...", "description": "..." }
`;

export const VOTE_PROMPT = `
Round: {{ROUND}}
My Word: {{MY_WORD}}
History:
{{FULL_HISTORY}}

Task: Vote for the most suspicious player.
Output JSON: { "thought": "...", "target_id": "..." }
`;
```

### 5.2 `src/bot/engine.ts` (The Muscle)

这里处理所有的脏活：Context 获取、LLM 调用、结果解析。

```typescript
import { SYSTEM_PROMPT, DESC_PROMPT, VOTE_PROMPT } from './prompts';

export async function runBotTurn(env: Env, roomId: string, botId: string) {
    // 1. Get Context (Reuse existing queries)
    const state = await getRoomState(env.DB, roomId, botId); 
    
    // 2. Build Prompt
    const system = SYSTEM_PROMPT.replace('{{MY_WORD}}', state.myWord);
    const user = DESC_PROMPT
        .replace('{{ROUND}}', state.round)
        .replace('{{HISTORY}}', formatHistory(state.descriptions));

    // 3. Call LLM (Simple Switch)
    const response = await callLLM(env, system, user);

    // 4. Parse & Validate (Robustness is key)
    const json = extractJSON(response); // Must handle markdown blocks
    if (json.description.includes(state.myWord)) throw new Error("Bot Cheated");

    // 5. Submit
    await submitDescription(env, roomId, botId, json.description);
}

// Just a helper, not a class heirarchy
async function callLLM(env: Env, sys: string, user: string) {
    const { BOT_LLM_PROVIDER, BOT_LLM_BASE_URL, BOT_LLM_API_KEY, BOT_LLM_MODEL } = env;
    
    // Simple fetch wrapper
    switch (BOT_LLM_PROVIDER) {
        case 'openai': return fetchOpenAI(...);
        case 'gemini': return fetchGemini(...);
        case 'claude': return fetchClaude(...);
        default: throw new Error("Unknown Provider");
    }
}

// Critical: Handle LLM garbage output
function extractJSON(text: string) {
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start === -1 || end === -1) throw new Error("No JSON found");
    return JSON.parse(text.slice(start, end + 1));
}
```

### 5.3 `src/api/game.ts` (The Trigger)

在 `nextTurn` 逻辑里插入 **Fire-and-Forget** 触发器。

```typescript
// ... inside rotateTurn()
const nextPlayer = players[nextIndex];
if (nextPlayer.is_bot) {
    // DON'T AWAIT. Let it run in background.
    ctx.waitUntil(
        // Add random delay to mimic human (2-5s)
        new Promise(r => setTimeout(r, 2000 + Math.random() * 3000))
            .then(() => runBotTurn(env, roomId, nextPlayer.id))
            .catch(err => console.error("Bot Failed:", err))
    );
}
```

---

## 6. 上下文与安全 (Context & Security)

**Rule #1: Isolation**
AI 只能看到 `getRoomState` 给它的数据。
- 描述阶段：只能看到`index < myIndex` 的发言。
- 投票阶段：能看到所有人发言。

**Rule #2: Validation**
绝不信任 LLM 的输出。
- 输出不能包含 `my_word` (甚至不能包含其中任一字符)。
- 投票不能投自己，不能投死人。

---

## 7. 开发与调试 (Dev Tooling)

为了在不污染生产代码的前提下灵活调整 Prompt，我们使用独立的 CLI 脚本。

### 7.1 Prompt 调试脚本 (`scripts/debug-bot.ts`)

该脚本直接引用生产环境的 Prompt 常量，通过 Mock 数据进行渲染测试。

```typescript
// scripts/debug-bot.ts
import { SYSTEM_PROMPT, DESC_PROMPT } from '../src/bot/prompts';

// Mock context that mimics DB state
const mockState = {
    myWord: "苹果",
    round: 1,
    aliveCount: 5,
    spyCount: 1,
    history: [
        { name: "PlayerA", text: "红色的" },
        { name: "PlayerB", text: "圆的" }
    ]
};

// 1. Render Prompt Logic (Duplicate logic from engine.ts or import helper)
const finalPrompt = DESC_PROMPT
    .replace('{{MY_WORD}}', mockState.myWord)
    .replace('{{ROUND}}', String(mockState.round))
    .replace('{{ALIVE_COUNT}}', String(mockState.aliveCount))
    .replace('{{SPY_COUNT}}', String(mockState.spyCount))
    .replace('{{HISTORY}}', mockState.history.map(h => `${h.name}: ${h.text}`).join('\n'));

console.log("=== FINAL PROMPT ===");
console.log(finalPrompt);

// 2. (Optional) Real LLM Test
if (process.env.TEST_LLM_KEY) {
    console.log("\n=== WAITING FOR LLM response... ===");
    // fetch(...)
}
```

### 7.2 工作流

1.  修改 `src/bot/prompts.ts`。
2.  运行 `npx tsx scripts/debug-bot.ts` 验证输出 (需安装 `tsx`)。
3.  满意后提交。

---

## 8. 文件清单 (File List)

Delete all the fluff. Keep it lean.

```
who-is-the-spy/
├── src/
│   ├── bot/
│   │   ├── engine.ts       # 核心逻辑 + LLM 调用 + JSON 解析
│   │   └── prompts.ts      # 纯字符串 Prompts (Source of Truth)
│   ├── api/
│   │   └── game.ts         # 修改：添加触发点
│   └── types.ts            # 修改：增加 is_bot
├── schema.sql              # 修改：增加 is_bot
├── wrangler.toml           # 修改：增加 ENV
└── scripts/
    └── debug-bot.ts        # 新增：开发调试工具
```
