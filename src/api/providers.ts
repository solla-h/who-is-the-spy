/**
 * LLM Provider API
 * 获取可用的 LLM Provider 列表
 */

import type { Env } from '../index';
import { LLMProviderRow } from '../types';

/**
 * 获取所有启用的 Provider 列表
 */
export async function getProviders(env: Env): Promise<{ success: boolean; providers?: LLMProviderRow[]; error?: string }> {
    try {
        const { results } = await env.DB.prepare(`
            SELECT id, name, api_type, base_url, default_model, api_key_env, enabled, sort_order
            FROM llm_providers
            WHERE enabled = 1
            ORDER BY sort_order ASC
        `).all<LLMProviderRow>();

        return { success: true, providers: results || [] };
    } catch (error) {
        console.error('[getProviders] Error:', error);
        return { success: false, error: 'Failed to fetch providers' };
    }
}

/**
 * 根据 ID 获取单个 Provider 配置
 */
export async function getProviderById(env: Env, providerId: string): Promise<LLMProviderRow | null> {
    try {
        const provider = await env.DB.prepare(`
            SELECT id, name, api_type, base_url, default_model, api_key_env, enabled, sort_order
            FROM llm_providers
            WHERE id = ?
        `).bind(providerId).first<LLMProviderRow>();

        return provider || null;
    } catch (error) {
        console.error('[getProviderById] Error:', error);
        return null;
    }
}

/**
 * 初始化默认 Provider 数据（如果表为空）
 */
export async function syncLLMProviders(db: D1Database): Promise<void> {
    try {
        // Check if table has data
        const { results } = await db.prepare('SELECT COUNT(*) as count FROM llm_providers').all<{ count: number }>();
        if (results && results[0] && results[0].count > 0) {
            return; // Already has data
        }

        // Insert default providers
        const defaultProviders = [
            { id: 'openai', name: 'OpenAI (GPT-4o)', api_type: 'openai_compatible', base_url: 'https://api.openai.com', default_model: 'gpt-4o-mini', api_key_env: 'OPENAI_API_KEY', sort_order: 1 },
            { id: 'deepseek', name: 'DeepSeek', api_type: 'openai_compatible', base_url: 'https://api.deepseek.com', default_model: 'deepseek-chat', api_key_env: 'DEEPSEEK_API_KEY', sort_order: 2 },
            { id: 'gemini', name: 'Google Gemini', api_type: 'gemini_native', base_url: 'https://generativelanguage.googleapis.com/v1beta', default_model: 'gemini-2.0-flash', api_key_env: 'GEMINI_API_KEY', sort_order: 3 },
            { id: 'claude', name: 'Anthropic Claude', api_type: 'claude_native', base_url: 'https://api.anthropic.com', default_model: 'claude-3-5-haiku-latest', api_key_env: 'CLAUDE_API_KEY', sort_order: 4 },
            { id: 'qwen', name: '通义千问 Qwen', api_type: 'openai_compatible', base_url: 'https://dashscope.aliyuncs.com/compatible-mode/v1', default_model: 'qwen-turbo', api_key_env: 'QWEN_API_KEY', sort_order: 5 },
            { id: 'moonshot', name: 'Moonshot (月之暗面)', api_type: 'openai_compatible', base_url: 'https://api.moonshot.cn/v1', default_model: 'moonshot-v1-8k', api_key_env: 'MOONSHOT_API_KEY', sort_order: 6 },
        ];

        for (const p of defaultProviders) {
            await db.prepare(`
                INSERT OR IGNORE INTO llm_providers (id, name, api_type, base_url, default_model, api_key_env, enabled, sort_order)
                VALUES (?, ?, ?, ?, ?, ?, 1, ?)
            `).bind(p.id, p.name, p.api_type, p.base_url, p.default_model, p.api_key_env, p.sort_order).run();
        }

        console.log('[syncLLMProviders] Default providers initialized');
    } catch (error) {
        // Table might not exist yet, that's fine
        console.log('[syncLLMProviders] Skipped (table may not exist):', error);
    }
}
