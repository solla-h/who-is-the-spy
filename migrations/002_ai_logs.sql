-- AI Debug 日志表迁移脚本
-- 运行方式: npx wrangler d1 execute DB --file=migrations/002_ai_logs.sql --remote

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
