/**
 * Admin API for managing LLM Providers
 */

import type { Env } from '../index';
import { LLMProviderRow } from '../types';

// Simple admin auth check using environment variable
function checkAdminAuth(request: Request, env: Env): boolean {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) return false;

    const token = authHeader.slice(7);
    const adminToken = env.ADMIN_TOKEN as string | undefined;

    if (!adminToken) {
        console.warn('[Admin] ADMIN_TOKEN not set, denying access');
        return false;
    }

    return token === adminToken;
}

/**
 * Get all providers (including disabled ones)
 */
export async function getAllProviders(request: Request, env: Env): Promise<{ success: boolean; providers?: LLMProviderRow[]; error?: string }> {
    if (!checkAdminAuth(request, env)) {
        return { success: false, error: 'Unauthorized' };
    }

    try {
        const { results } = await env.DB.prepare(`
            SELECT id, name, api_type, base_url, default_model, api_key_env, enabled, sort_order
            FROM llm_providers
            ORDER BY sort_order ASC
        `).all<LLMProviderRow>();

        return { success: true, providers: results || [] };
    } catch (error) {
        console.error('[Admin] getAllProviders error:', error);
        return { success: false, error: 'Database error' };
    }
}

/**
 * Add a new provider
 */
export async function addProvider(request: Request, env: Env): Promise<{ success: boolean; provider?: LLMProviderRow; error?: string }> {
    if (!checkAdminAuth(request, env)) {
        return { success: false, error: 'Unauthorized' };
    }

    try {
        const body = await request.json() as Partial<LLMProviderRow>;

        // Validate required fields
        if (!body.id || !body.name || !body.api_type || !body.base_url || !body.default_model || !body.api_key_env) {
            return { success: false, error: 'Missing required fields' };
        }

        // Validate api_type
        if (!['openai_compatible', 'gemini_native', 'claude_native'].includes(body.api_type)) {
            return { success: false, error: 'Invalid api_type' };
        }

        await env.DB.prepare(`
            INSERT INTO llm_providers (id, name, api_type, base_url, default_model, api_key_env, enabled, sort_order)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
            body.id,
            body.name,
            body.api_type,
            body.base_url,
            body.default_model,
            body.api_key_env,
            body.enabled ?? 1,
            body.sort_order ?? 99
        ).run();

        return { success: true, provider: body as LLMProviderRow };
    } catch (error: any) {
        console.error('[Admin] addProvider error:', error);
        if (error.message?.includes('UNIQUE constraint')) {
            return { success: false, error: 'Provider ID already exists' };
        }
        return { success: false, error: 'Database error' };
    }
}

/**
 * Update an existing provider
 */
export async function updateProvider(request: Request, env: Env, providerId: string): Promise<{ success: boolean; error?: string }> {
    if (!checkAdminAuth(request, env)) {
        return { success: false, error: 'Unauthorized' };
    }

    try {
        const body = await request.json() as Partial<LLMProviderRow>;

        // Build dynamic update query
        const updates: string[] = [];
        const values: any[] = [];

        if (body.name !== undefined) { updates.push('name = ?'); values.push(body.name); }
        if (body.api_type !== undefined) { updates.push('api_type = ?'); values.push(body.api_type); }
        if (body.base_url !== undefined) { updates.push('base_url = ?'); values.push(body.base_url); }
        if (body.default_model !== undefined) { updates.push('default_model = ?'); values.push(body.default_model); }
        if (body.api_key_env !== undefined) { updates.push('api_key_env = ?'); values.push(body.api_key_env); }
        if (body.enabled !== undefined) { updates.push('enabled = ?'); values.push(body.enabled); }
        if (body.sort_order !== undefined) { updates.push('sort_order = ?'); values.push(body.sort_order); }

        if (updates.length === 0) {
            return { success: false, error: 'No fields to update' };
        }

        values.push(providerId);

        await env.DB.prepare(`
            UPDATE llm_providers SET ${updates.join(', ')} WHERE id = ?
        `).bind(...values).run();

        return { success: true };
    } catch (error) {
        console.error('[Admin] updateProvider error:', error);
        return { success: false, error: 'Database error' };
    }
}

/**
 * Delete a provider
 */
export async function deleteProvider(request: Request, env: Env, providerId: string): Promise<{ success: boolean; error?: string }> {
    if (!checkAdminAuth(request, env)) {
        return { success: false, error: 'Unauthorized' };
    }

    try {
        await env.DB.prepare('DELETE FROM llm_providers WHERE id = ?').bind(providerId).run();
        return { success: true };
    } catch (error) {
        console.error('[Admin] deleteProvider error:', error);
        return { success: false, error: 'Database error' };
    }
}
