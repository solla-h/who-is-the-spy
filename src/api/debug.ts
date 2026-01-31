/**
 * AI Debug API - 查询 LLM 交互日志
 */

import { Env } from '../index';

interface DebugLogsQuery {
    roomId?: string;
    botId?: string;
    status?: string;
    limit?: number;
    offset?: number;
}

interface AILogRow {
    id: string;
    room_id: string;
    bot_id: string;
    bot_name: string | null;
    action_type: string;
    provider: string | null;
    model: string | null;
    system_prompt: string | null;
    user_prompt: string | null;
    raw_response: string | null;
    cleaned_response: string | null;
    status: string;
    error_message: string | null;
    duration_ms: number | null;
    round: number | null;
    created_at: number;
}

/**
 * 获取 AI 日志列表
 */
export async function getAILogs(env: Env, query: DebugLogsQuery) {
    const { roomId, botId, status, limit = 50, offset = 0 } = query;

    let sql = `
        SELECT 
            l.*,
            p.name as bot_display_name,
            r.code as room_code
        FROM ai_logs l
        LEFT JOIN players p ON l.bot_id = p.id
        LEFT JOIN rooms r ON l.room_id = r.id
        WHERE 1=1
    `;
    const params: (string | number)[] = [];

    if (roomId) {
        sql += ` AND l.room_id = ?`;
        params.push(roomId);
    }
    if (botId) {
        sql += ` AND l.bot_id = ?`;
        params.push(botId);
    }
    if (status) {
        sql += ` AND l.status = ?`;
        params.push(status);
    }

    sql += ` ORDER BY l.created_at DESC LIMIT ? OFFSET ?`;
    params.push(limit, offset);

    const result = await env.DB.prepare(sql).bind(...params).all<AILogRow>();
    return { success: true, logs: result.results || [] };
}

/**
 * 获取 AI 日志统计
 */
export async function getAILogStats(env: Env, roomId?: string) {
    let sql = `
        SELECT 
            status,
            COUNT(*) as count,
            AVG(duration_ms) as avg_duration,
            MAX(duration_ms) as max_duration,
            MIN(duration_ms) as min_duration
        FROM ai_logs
    `;
    const params: string[] = [];

    if (roomId) {
        sql += ` WHERE room_id = ?`;
        params.push(roomId);
    }
    sql += ` GROUP BY status`;

    const result = roomId
        ? await env.DB.prepare(sql).bind(roomId).all()
        : await env.DB.prepare(sql).all();

    return { success: true, stats: result.results || [] };
}

/**
 * 清理过期日志（可选：用于定期清理）
 * @param daysToKeep 保留天数
 */
export async function cleanupOldLogs(env: Env, daysToKeep: number = 7) {
    const cutoffTime = Date.now() - (daysToKeep * 24 * 60 * 60 * 1000);

    const result = await env.DB.prepare(`
        DELETE FROM ai_logs WHERE created_at < ?
    `).bind(cutoffTime).run();

    return {
        success: true,
        deletedCount: result.meta.changes
    };
}
