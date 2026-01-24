import { Env } from '../index';
import { authenticateAction } from '../utils/auth';
import { ErrorCode, PlayerRow } from '../types';

export interface AddBotResult {
    success: boolean;
    error?: string;
    code?: ErrorCode;
    botId?: string;
}

export async function addBot(
    roomId: string,
    playerToken: string,
    env: Env,
    config: any = {}
): Promise<AddBotResult> {
    try {
        // Authenticate host
        const auth = await authenticateAction(roomId, playerToken, env, {
            requireHost: true,
            allowedPhases: ['waiting'],
        });

        if (!auth.success || !auth.context) {
            if (auth.code === ErrorCode.NOT_AUTHORIZED) {
                return { success: false, error: 'Only host can add bots', code: auth.code };
            }
            return { success: false, error: auth.error, code: auth.code };
        }

        const { room } = auth.context;

        // Generate Bot ID and Token
        const botId = crypto.randomUUID();
        const botToken = 'bot_' + crypto.randomUUID(); // Prefix for easier debugging
        // Random name or provided name
        const botName = config.name || `AI-Bot-${Math.floor(Math.random() * 1000)}`;

        // Get current players to determine join order
        const playersResult = await env.DB.prepare(`
          SELECT COUNT(*) as count FROM players WHERE room_id = ?
        `).bind(roomId).first<{ count: number }>();

        const joinOrder = (playersResult?.count || 0) + 1;
        const timestamp = Date.now();

        // Prepare config to store (provider, persona, etc.)
        // Ensure defaults
        const storageConfig = {
            provider: config.provider || 'openai',
            persona: config.persona || '',
            ...config
        };

        // Insert bot into players table
        await env.DB.prepare(`
          INSERT INTO players (id, room_id, token, name, role, is_alive, is_online, word_confirmed, last_seen, join_order, is_bot, bot_config)
          VALUES (?, ?, ?, ?, NULL, 1, 1, 0, ?, ?, 1, ?)
        `).bind(botId, roomId, botToken, botName, timestamp, joinOrder, JSON.stringify(storageConfig)).run();

        // Update room updated_at
        await env.DB.prepare(`
      UPDATE rooms SET updated_at = ? WHERE id = ?
    `).bind(timestamp, roomId).run();

        return { success: true, botId };

    } catch (error) {
        console.error('Add bot error:', error);
        return { success: false, error: 'Failed to add bot', code: ErrorCode.DATABASE_ERROR };
    }
}
