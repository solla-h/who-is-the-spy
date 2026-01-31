-- 谁是卧底 (Who is the Spy) Database Schema

-- 房间表
CREATE TABLE IF NOT EXISTS rooms (
  id TEXT PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  phase TEXT NOT NULL DEFAULT 'waiting',
  host_id TEXT NOT NULL,
  settings TEXT NOT NULL DEFAULT '{"spyCount":1,"minPlayers":3,"maxPlayers":20}',
  game_state TEXT DEFAULT NULL,
  civilian_word TEXT DEFAULT NULL,
  spy_word TEXT DEFAULT NULL,
  current_turn INTEGER DEFAULT 0,
  round INTEGER DEFAULT 1,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

-- 玩家表
CREATE TABLE IF NOT EXISTS players (
  id TEXT PRIMARY KEY,
  room_id TEXT NOT NULL,
  token TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  role TEXT DEFAULT NULL,
  is_alive INTEGER DEFAULT 1,
  is_online INTEGER DEFAULT 1,
  word_confirmed INTEGER DEFAULT 0,
  last_seen INTEGER NOT NULL,
  join_order INTEGER NOT NULL,
  is_bot INTEGER DEFAULT 0,
  bot_config TEXT,
  FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE
);

-- 描述记录表
CREATE TABLE IF NOT EXISTS descriptions (
  id TEXT PRIMARY KEY,
  room_id TEXT NOT NULL,
  player_id TEXT NOT NULL,
  round INTEGER NOT NULL,
  text TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE,
  FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE,
  UNIQUE(room_id, player_id, round)
);

-- 投票记录表
CREATE TABLE IF NOT EXISTS votes (
  id TEXT PRIMARY KEY,
  room_id TEXT NOT NULL,
  voter_id TEXT NOT NULL,
  target_id TEXT NOT NULL,
  round INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE,
  UNIQUE(room_id, voter_id, round)
);

-- 词语对表
CREATE TABLE IF NOT EXISTS word_pairs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  civilian_word TEXT NOT NULL,
  spy_word TEXT NOT NULL,
  category TEXT DEFAULT 'general',
  UNIQUE(civilian_word, spy_word)
);

-- LLM Provider 配置表 (支持热更新)
CREATE TABLE IF NOT EXISTS llm_providers (
    id TEXT PRIMARY KEY,             -- 唯一标识 e.g. 'openai', 'deepseek'
    name TEXT NOT NULL,              -- 显示名称 e.g. 'OpenAI (GPT-4o)'
    api_type TEXT NOT NULL,          -- 'openai_compatible' | 'gemini_native' | 'claude_native'
    base_url TEXT NOT NULL,          -- API 端点基础 URL
    default_model TEXT NOT NULL,     -- 默认模型名
    api_key_env TEXT NOT NULL,       -- 对应的环境变量名 e.g. 'OPENAI_API_KEY'
    enabled INTEGER DEFAULT 1,       -- 是否启用
    sort_order INTEGER DEFAULT 0     -- 前端显示排序
);

-- 索引优化查询性能
CREATE INDEX IF NOT EXISTS idx_rooms_code ON rooms(code);
CREATE INDEX IF NOT EXISTS idx_rooms_updated ON rooms(updated_at);
CREATE INDEX IF NOT EXISTS idx_players_room ON players(room_id);
CREATE INDEX IF NOT EXISTS idx_players_token ON players(token);
CREATE INDEX IF NOT EXISTS idx_descriptions_room_round ON descriptions(room_id, round);
CREATE INDEX IF NOT EXISTS idx_votes_room_round ON votes(room_id, round);

-- AI Debug 日志表 (用于调试 LLM 交互)
CREATE TABLE IF NOT EXISTS ai_logs (
    id TEXT PRIMARY KEY,
    room_id TEXT NOT NULL,
    bot_id TEXT NOT NULL,
    bot_name TEXT,
    
    -- 请求信息
    action_type TEXT NOT NULL,      -- 'description' | 'vote'
    provider TEXT,                  -- 'openai' | 'deepseek' | 'gemini' | 'claude'
    model TEXT,
    
    -- Prompt 信息 (截断以节省空间)
    system_prompt TEXT,
    user_prompt TEXT,
    
    -- 响应信息
    raw_response TEXT,              -- 限制 2000 字符
    cleaned_response TEXT,
    
    -- 状态信息
    status TEXT NOT NULL,           -- 'success' | 'error' | 'timeout'
    error_message TEXT,
    
    -- 性能指标
    duration_ms INTEGER,            -- LLM 调用耗时
    
    -- 游戏上下文
    round INTEGER,
    
    created_at INTEGER NOT NULL,
    
    FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE,
    FOREIGN KEY (bot_id) REFERENCES players(id) ON DELETE CASCADE
);

-- AI 日志索引
CREATE INDEX IF NOT EXISTS idx_ai_logs_room ON ai_logs(room_id);
CREATE INDEX IF NOT EXISTS idx_ai_logs_bot ON ai_logs(bot_id);
CREATE INDEX IF NOT EXISTS idx_ai_logs_created ON ai_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_logs_status ON ai_logs(status);
