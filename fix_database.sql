-- Fix missing columns in players table
ALTER TABLE players ADD COLUMN is_bot INTEGER DEFAULT 0;
ALTER TABLE players ADD COLUMN word_confirmed INTEGER DEFAULT 0;

-- Create llm_providers table if not exists
CREATE TABLE IF NOT EXISTS llm_providers (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    api_type TEXT NOT NULL,
    base_url TEXT NOT NULL,
    default_model TEXT NOT NULL,
    api_key_env TEXT NOT NULL,
    enabled INTEGER DEFAULT 1,
    sort_order INTEGER DEFAULT 0
);

-- Insert default providers
INSERT OR IGNORE INTO llm_providers (id, name, api_type, base_url, default_model, api_key_env, enabled, sort_order) VALUES
('openai', 'OpenAI (GPT-4o)', 'openai_compatible', 'https://api.openai.com/v1', 'gpt-4o', 'OPENAI_API_KEY', 1, 10),
('deepseek', 'DeepSeek', 'openai_compatible', 'https://api.deepseek.com', 'deepseek-chat', 'DEEPSEEK_API_KEY', 1, 20),
('gemini', 'Google Gemini', 'gemini_native', 'https://generativelanguage.googleapis.com', 'gemini-1.5-flash', 'GEMINI_API_KEY', 1, 30),
('claude', 'Anthropic Claude', 'claude_native', 'https://api.anthropic.com', 'claude-3-5-sonnet-20240620', 'CLAUDE_API_KEY', 1, 40);
