import { Env } from '../index';
import { getRoomState } from '../api/state';
import { submitDescription, submitVote } from '../api/game';
import { SYSTEM_PROMPT, DESC_PROMPT, VOTE_PROMPT } from './prompts';
import { PlayerRow } from '../types';

try {
    // 1. Get Context
    // Fetch bot token and config
    const bot = await env.DB.prepare('SELECT token, bot_config FROM players WHERE id = ?').bind(botId).first<PlayerRow>();
    if (!bot) throw new Error(`Bot ${botId} not found`);
    const botToken = bot.token;

    let botConfig: any = { provider: 'openai', persona: '' };
    if (bot.bot_config) {
        try {
            // Try parsing as JSON first
            botConfig = JSON.parse(bot.bot_config);
        } catch (e) {
            // Fallback for legacy plain strings
            botConfig = { provider: bot.bot_config, persona: '' };
        }
    }

    const stateResult = await getRoomState(roomId, botToken, env);
    if (!stateResult.success || !stateResult.state) {
        throw new Error(`Failed to get state for bot ${botId}: ${stateResult.error}`);
    }
    const state = stateResult.state;

    // Check if it's actually my turn (double check to avoid race conditions is handled by API)

    if (state.phase === 'description') {
        await handleDescriptionPhase(env, roomId, botToken, botId, state, botConfig);
    } else if (state.phase === 'voting') {
        await handleVotingPhase(env, roomId, botToken, botId, state, botConfig);
    }
} catch (error) {
    console.error(`[Bot Error] Room ${roomId} Bot ${botId}:`, error);
}
}

async function handleDescriptionPhase(env: Env, roomId: string, botToken: string, botId: string, state: any, botConfig: any) {
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

    const systemPromptBase = SYSTEM_PROMPT.replace('{{MY_WORD}}', state.myWord || 'Unknown');
    const systemPrompt = botConfig.persona
        ? `${systemPromptBase}\n\n## YOUR PERSONA\n${botConfig.persona}`
        : systemPromptBase;

    const response = await callLLM(env, systemPrompt, userPrompt, botConfig.provider);
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

async function handleVotingPhase(env: Env, roomId: string, botToken: string, botId: string, state: any, botConfig: any) {
    // Check if already voted
    const hasVoted = state.players.find((p: any) => p.id === botId)?.hasVoted;
    if (hasVoted) return;

    const historyText = state.descriptions.map((d: any) => `${d.playerName}: ${d.text}`).join('\n');

    const userPrompt = VOTE_PROMPT
        .replace('{{ROUND}}', String(state.round))
        .replace('{{MY_WORD}}', state.myWord || 'Unknown')
        .replace('{{FULL_HISTORY}}', historyText)
        .replace('{{MY_ID}}', botId);

    const systemPromptBase = SYSTEM_PROMPT.replace('{{MY_WORD}}', state.myWord || 'Unknown');
    const systemPrompt = botConfig.persona
        ? `${systemPromptBase}\n\n## YOUR PERSONA\n${botConfig.persona}`
        : systemPromptBase;

    const response = await callLLM(env, systemPrompt, userPrompt, botConfig.provider);
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

async function callLLM(env: Env, system: string, user: string, botConfig: string = 'openai'): Promise<string> {
    // 1. OpenAI Compatible (Default)
    if (botConfig === 'openai') {
        const apiKey = env.OPENAI_API_KEY;
        const baseUrl = env.OPENAI_BASE_URL || 'https://api.openai.com';
        const model = env.OPENAI_MODEL || 'gpt-3.5-turbo';

        if (!apiKey) throw new Error("Missing OPENAI_API_KEY");

        const resp = await fetch(`${baseUrl}/v1/chat/completions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
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

        if (!resp.ok) throw new Error(`OpenAI API Error: ${resp.status} ${await resp.text()}`);
        const data = await resp.json() as any;
        return data.choices?.[0]?.message?.content || "{}";
    }

    // 2. Google Gemini (via OpenAI-compatible endpoint or native)
    // Cloudflare AI Gateway or direct REST. Using direct REST for v1beta.
    if (botConfig === 'gemini') {
        const apiKey = env.GEMINI_API_KEY;
        const model = env.GEMINI_MODEL || 'gemini-1.5-flash';

        if (!apiKey) throw new Error("Missing GEMINI_API_KEY");

        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
        const resp = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{
                    role: "user",
                    parts: [{ text: system + "\n\n" + user }] // Gemini system prompt handling varies, simple concat works well
                }],
                generationConfig: { responseMimeType: "application/json" }
            })
        });

        if (!resp.ok) throw new Error(`Gemini API Error: ${resp.status} ${await resp.text()}`);
        const data = await resp.json() as any;
        return data.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
    }

    // 3. Anthropic Claude
    if (botConfig === 'claude') {
        const apiKey = env.CLAUDE_API_KEY;
        const model = env.CLAUDE_MODEL || 'claude-3-haiku-20240307';

        if (!apiKey) throw new Error("Missing CLAUDE_API_KEY");

        const resp = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
                'x-api-key': apiKey,
                'anthropic-version': '2023-06-01',
                'content-type': 'application/json'
            },
            body: JSON.stringify({
                model: model,
                max_tokens: 1024,
                system: system,
                messages: [{ role: 'user', content: user }]
            })
        });

        if (!resp.ok) throw new Error(`Claude API Error: ${resp.status} ${await resp.text()}`);
        const data = await resp.json() as any;
        return data.content?.[0]?.text || "{}";
    }

    throw new Error(`Unsupported bot config: ${botConfig}`);
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
