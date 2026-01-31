/**
 * AI Debug Logger - 记录 LLM 交互日志用于调试
 * 使用 ctx.waitUntil 异步写入，不阻塞主流程
 */

import { Env } from '../index';

// 日志条目接口
export interface AILogEntry {
    roomId: string;
    botId: string;
    botName?: string;
    actionType: 'description' | 'vote';
    provider?: string;
    model?: string;
    systemPrompt?: string;
    userPrompt?: string;
    rawResponse?: string;
    cleanedResponse?: string;
    status: 'success' | 'error' | 'timeout';
    errorMessage?: string;
    durationMs?: number;
    round?: number;
}

// 截断文本以节省存储空间
const MAX_PROMPT_LENGTH = 2000;
const MAX_RESPONSE_LENGTH = 2000;

function truncate(text: string | undefined, maxLength: number): string | null {
    if (!text) return null;
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '... [truncated]';
}

/**
 * 记录 AI 交互日志
 * @param env - Cloudflare 环境
 * @param entry - 日志条目
 * @param ctx - ExecutionContext，用于 waitUntil 异步写入
 */
export function logAIInteraction(
    env: Env,
    entry: AILogEntry,
    ctx?: ExecutionContext
): void {
    const id = crypto.randomUUID();
    const timestamp = Date.now();

    const promise = env.DB.prepare(`
        INSERT INTO ai_logs (
            id, room_id, bot_id, bot_name, action_type, provider, model,
            system_prompt, user_prompt, raw_response, cleaned_response,
            status, error_message, duration_ms, round, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
        id,
        entry.roomId,
        entry.botId,
        entry.botName || null,
        entry.actionType,
        entry.provider || null,
        entry.model || null,
        truncate(entry.systemPrompt, MAX_PROMPT_LENGTH),
        truncate(entry.userPrompt, MAX_PROMPT_LENGTH),
        truncate(entry.rawResponse, MAX_RESPONSE_LENGTH),
        entry.cleanedResponse || null,
        entry.status,
        entry.errorMessage || null,
        entry.durationMs || null,
        entry.round || null,
        timestamp
    ).run();

    // 使用 waitUntil 异步写入，不阻塞主流程
    if (ctx) {
        ctx.waitUntil(
            promise.catch(err => {
                console.error('[AILogger] Failed to log:', err);
            })
        );
    } else {
        // 没有 ctx 时直接忽略结果（极少情况）
        promise.catch(err => {
            console.error('[AILogger] Failed to log (no ctx):', err);
        });
    }
}
