import { Env } from '../index';
import { getRoomState } from '../api/state';
import { submitDescription, submitVote } from '../api/game';
import { SYSTEM_PROMPT, DESC_PROMPT, VOTE_PROMPT } from './prompts';
import { PlayerRow } from '../types';

export async function runBotTurn(env: Env, roomId: string, botId: string) {
    try {
        // 1. Get Context
        const result = await getRoomState(roomId, "bot_token_" + botId, env);
        // Wait, getRoomState requires a valid token. 
        // We need to fetch the bot's real token first.

        const bot = await env.DB.prepare('SELECT token FROM players WHERE id = ?').bind(botId).first<PlayerRow>();
        if (!bot) throw new Error(`Bot ${botId} not found`);
        const botToken = bot.token;

        const stateResult = await getRoomState(roomId, botToken, env);
        if (!stateResult.success || !stateResult.state) {
            throw new Error(`Failed to get state for bot ${botId}: ${stateResult.error}`);
        }
        const state = stateResult.state;

        // Check if it's actually my turn (double check to avoid race conditions is handled by API)

        if (state.phase === 'description') {
            await handleDescriptionPhase(env, roomId, botToken, botId, state);
        } else if (state.phase === 'voting') {
            await handleVotingPhase(env, roomId, botToken, botId, state);
        }
    } catch (error) {
        console.error(`[Bot Error] Room ${roomId} Bot ${botId}:`, error);
    }
}

async function handleDescriptionPhase(env: Env, roomId: string, botToken: string, botId: string, state: any) {
    // Check if it is my turn
    // state.currentTurn is index.
    // getRoomState doesn't explicitly tell if it is MY turn, but we can verify.
    // Actually submitDescription checks it.

    // Filter history
    const historyText = state.descriptions.length > 0
        ? state.descriptions.map((d: any) => `${d.playerName}: ${d.text}`).join('\n')
        : "(No one has spoken yet in this round)";

    const aliveCount = state.players.filter((p: any) => p.isAlive).length;

    const userPrompt = DESC_PROMPT
        .replace('{{ROUND}}', String(state.round))
        .replace('{{ALIVE_COUNT}}', String(aliveCount))
        .replace('{{SPY_COUNT}}', String(state.settings.spyCount))
        .replace('{{MY_WORD}}', state.myWord || 'Unknown')
        .replace('{{HISTORY}}', historyText);

    const systemPrompt = SYSTEM_PROMPT.replace('{{MY_WORD}}', state.myWord || 'Unknown');

    const response = await callLLM(env, systemPrompt, userPrompt);
    const json = extractJSON(response);

    // Validate description
    const description = json.description?.trim();
    if (!description) throw new Error("Bot generated empty description");

    // Basic safety check
    if (state.myWord && description.includes(state.myWord)) {
        console.warn("Bot tried to say the word! Fallback.");
        await submitDescription(roomId, botToken, "It's hard to describe...", env);
        return;
    }

    await submitDescription(roomId, botToken, description, env);
}

async function handleVotingPhase(env: Env, roomId: string, botToken: string, botId: string, state: any) {
    // Check if already voted
    const hasVoted = state.players.find((p: any) => p.id === botId)?.hasVoted;
    if (hasVoted) return;

    const historyText = state.descriptions.map((d: any) => `${d.playerName}: ${d.text}`).join('\n');

    const userPrompt = VOTE_PROMPT
        .replace('{{ROUND}}', String(state.round))
        .replace('{{MY_WORD}}', state.myWord || 'Unknown')
        .replace('{{FULL_HISTORY}}', historyText)
        .replace('{{MY_ID}}', botId);

    const systemPrompt = SYSTEM_PROMPT.replace('{{MY_WORD}}', state.myWord || 'Unknown');

    const response = await callLLM(env, systemPrompt, userPrompt);
    const json = extractJSON(response);

    const targetId = json.vote_target_id;

    // Validate target
    const target = state.players.find((p: any) => p.id === targetId);
    if (!target || !target.isAlive || target.id === botId) {
        // Fallback: Vote randomly
        const aliveOthers = state.players.filter((p: any) => p.isAlive && p.id !== botId);
        if (aliveOthers.length > 0) {
            const randomTarget = aliveOthers[Math.floor(Math.random() * aliveOthers.length)];
            await submitVote(roomId, botToken, randomTarget.id, env);
        }
        return;
    }

    await submitVote(roomId, botToken, targetId, env);
}

// --- Helpers ---

async function callLLM(env: Env, system: string, user: string): Promise<string> {
    const { BOT_LLM_PROVIDER, BOT_LLM_BASE_URL, BOT_LLM_API_KEY, BOT_LLM_MODEL } = env;

    if (!BOT_LLM_API_KEY) {
        // Fallback/Mock for development if no key provided
        console.warn("Missing BOT_LLM_API_KEY. Using mock response.");
        return JSON.stringify({
            description: "I am a bot.",
            vote_target_id: "unknown",
            thought: "I have no brain."
        });
    }

    // Default to 'openai' compatible if not specified or 'openai' or 'deepseek'
    // DeepSeek is OpenAI compatible.

    const baseUrl = BOT_LLM_BASE_URL || 'https://api.openai.com';
    const model = BOT_LLM_MODEL || 'gpt-3.5-turbo';

    const resp = await fetch(`${baseUrl}/v1/chat/completions`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${BOT_LLM_API_KEY}`
        },
        body: JSON.stringify({
            model: model,
            messages: [
                { role: 'system', content: system },
                { role: 'user', content: user }
            ],
            temperature: 0.7
        })
    });

    if (!resp.ok) {
        const txt = await resp.text();
        throw new Error(`LLM API Error: ${resp.status} ${txt}`);
    }

    const data = await resp.json() as any;
    return data.choices?.[0]?.message?.content || "{}";
}

function extractJSON(text: string): any {
    try {
        const start = text.indexOf('{');
        const end = text.lastIndexOf('}');
        if (start !== -1 && end !== -1) {
            return JSON.parse(text.slice(start, end + 1));
        }
        return JSON.parse(text);
    } catch (e) {
        console.error("Failed to parse JSON from LLM:", text);
        return { description: "...", vote_target_id: "" };
    }
}
