import { Env } from '../index';
import { getRoomState } from '../api/state';
import { getProviderById } from '../api/providers';
import { submitDescription, submitVote } from '../api/game';
import { SYSTEM_PROMPT, DESC_PROMPT, VOTE_PROMPT } from './prompts';
import { getPersonaById } from './personas';
import { PlayerRow, LLMProviderRow } from '../types';

export async function runBotTurn(env: Env, roomId: string, botId: string) {
    try {
        // 1. Get Context
        // Fetch bot token and config
        const bot = await env.DB.prepare('SELECT token, bot_config FROM players WHERE id = ?').bind(botId).first<PlayerRow>();
        if (!bot) throw new Error(`Bot ${botId} not found`);
        const botToken = bot.token;

        let botConfig: any = { provider: 'openai', personaId: 'default', persona: '' };
        if (bot.bot_config) {
            try {
                // Try parsing as JSON first
                botConfig = JSON.parse(bot.bot_config);
            } catch (e) {
                // Fallback for legacy plain strings
                botConfig = { provider: bot.bot_config, personaId: 'default', persona: '' };
            }
        }

        // Resolve persona prompt from ID if personaId is specified
        if (botConfig.personaId && !botConfig.persona) {
            const preset = getPersonaById(botConfig.personaId);
            if (preset) {
                botConfig.persona = preset.prompt;
            }
        }

        // 2. Get Provider config from database
        const providerConfig = await getProviderById(env, botConfig.provider);
        if (!providerConfig) {
            console.error(`[Bot] Provider "${botConfig.provider}" not found in database, falling back to openai`);
            // Fallback to a default
            botConfig.provider = 'openai';
        }

        const stateResult = await getRoomState(roomId, botToken, env);
        if (!stateResult.success || !stateResult.state) {
            throw new Error(`Failed to get state for bot ${botId}: ${stateResult.error}`);
        }
        const state = stateResult.state;

        // Check if it's actually my turn (double check to avoid race conditions is handled by API)

        if (state.phase === 'description') {
            await handleDescriptionPhase(env, roomId, botToken, botId, state, botConfig, providerConfig);
        } else if (state.phase === 'voting') {
            await handleVotingPhase(env, roomId, botToken, botId, state, botConfig, providerConfig);
        }
    } catch (error) {
        console.error(`[Bot Error] Room ${roomId} Bot ${botId}:`, error);
    }
}

async function handleDescriptionPhase(
    env: Env, roomId: string, botToken: string, botId: string,
    state: any, botConfig: any, providerConfig: LLMProviderRow | null
) {
    let description = "";

    try {
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

        const response = await callLLM(env, systemPrompt, userPrompt, providerConfig);
        const json = extractJSON(response);

        // Validate description
        description = json.description?.trim();

        if (!description) throw new Error("Bot generated empty description");

        // Basic safety check
        if (state.myWord && description.includes(state.myWord)) {
            console.warn("Bot tried to say the word! Fallback.");
            description = "It's hard to describe...";
        }
    } catch (error: any) {
        console.error(`[Bot] Description generation failed for ${botId}:`, error);
        // Fallback description with error info to alert users
        const errorMsg = error.message || "Unknown error";
        if (errorMsg.includes("Missing API key")) {
            description = "[AI Error] 未配置 API Key，请联系房主。";
        } else {
            // Show more error details for debugging (50 chars instead of 20)
            description = `[AI Error] 思考卡壳了 (${errorMsg.substring(0, 50)})`;
        }
    }

    try {
        await submitDescription(roomId, botToken, description, env);
    } catch (submitError) {
        console.error(`[Bot] Failed to submit description for ${botId}:`, submitError);
    }
}

async function handleVotingPhase(
    env: Env, roomId: string, botToken: string, botId: string,
    state: any, botConfig: any, providerConfig: LLMProviderRow | null
) {
    // Check if already voted
    const hasVoted = state.players.find((p: any) => p.id === botId)?.hasVoted;
    if (hasVoted) return;

    let targetId = "";

    try {
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

        const response = await callLLM(env, systemPrompt, userPrompt, providerConfig);
        const json = extractJSON(response);

        targetId = json.vote_target_id;
    } catch (error) {
        console.error(`[Bot] Vote generation failed for ${botId}:`, error);
        // Will fall through to random vote below
    }

    // Validate target or perform random fallback
    const target = state.players.find((p: any) => p.id === targetId);

    if (!target || !target.isAlive || target.id === botId) {
        console.warn(`[Bot] Invalid or missing vote target for ${botId}. Performing random fallback.`);
        // Fallback: Vote randomly
        const aliveOthers = state.players.filter((p: any) => p.isAlive && p.id !== botId);
        if (aliveOthers.length > 0) {
            const randomTarget = aliveOthers[Math.floor(Math.random() * aliveOthers.length)];
            try {
                await submitVote(roomId, botToken, randomTarget.id, env);
            } catch (err) {
                console.error(`[Bot] Failed to submit random vote for ${botId}:`, err);
            }
        }
        return;
    }

    try {
        await submitVote(roomId, botToken, targetId, env);
    } catch (err) {
        console.error(`[Bot] Failed to submit vote for ${botId}:`, err);
    }
}

// --- LLM Caller with Dynamic Provider Config ---

async function callLLM(
    env: Env,
    system: string,
    user: string,
    providerConfig: LLMProviderRow | null
): Promise<string> {
    // Default fallback if no config
    if (!providerConfig) {
        providerConfig = {
            id: 'openai',
            name: 'OpenAI',
            api_type: 'openai_compatible',
            base_url: 'https://api.openai.com',
            default_model: 'gpt-4o-mini',
            api_key_env: 'OPENAI_API_KEY',
            enabled: 1,
            sort_order: 0
        };
    }

    // Get API key: prefer database storage, fallback to environment variable
    let apiKey = providerConfig.api_key;
    if (!apiKey && providerConfig.api_key_env) {
        apiKey = env[providerConfig.api_key_env] as string | undefined;
    }
    if (!apiKey) {
        throw new Error(`Missing API key for ${providerConfig.id}. Configure it in Admin page.`);
    }

    const { api_type, base_url, default_model } = providerConfig;

    // 1. OpenAI Compatible (Default, works with DeepSeek, Qwen, Moonshot, etc.)
    // Note: Some proxies have issues with 'system' role, so we embed system prompt into user message
    if (api_type === 'openai_compatible') {
        const combinedUserMessage = `[System Instructions]\n${system}\n\n[Your Task]\n${user}`;

        const resp = await fetch(`${base_url}/v1/chat/completions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: default_model,
                messages: [
                    { role: 'user', content: combinedUserMessage }
                ],
                temperature: 0.7,
                max_tokens: 256  // Required by some proxies to avoid timeout
            })
        });

        if (!resp.ok) {
            const errorBody = await resp.text();
            throw new Error(`${providerConfig.id} API Error: ${resp.status} - ${errorBody.substring(0, 100)}`);
        }
        const data = await resp.json() as any;
        return data.choices?.[0]?.message?.content || "{}";
    }

    // 2. Google Gemini (native REST API)
    if (api_type === 'gemini_native') {
        const url = `${base_url}/models/${default_model}:generateContent?key=${apiKey}`;
        const resp = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{
                    role: "user",
                    parts: [{ text: system + "\n\n" + user }]
                }],
                generationConfig: { responseMimeType: "application/json" }
            })
        });

        if (!resp.ok) throw new Error(`Gemini API Error: ${resp.status} ${await resp.text()}`);
        const data = await resp.json() as any;
        return data.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
    }

    // 3. Anthropic Claude
    if (api_type === 'claude_native') {
        const resp = await fetch(`${base_url}/v1/messages`, {
            method: 'POST',
            headers: {
                'x-api-key': apiKey,
                'anthropic-version': '2023-06-01',
                'content-type': 'application/json'
            },
            body: JSON.stringify({
                model: default_model,
                max_tokens: 1024,
                system: system,
                messages: [{ role: 'user', content: user }]
            })
        });

        if (!resp.ok) throw new Error(`Claude API Error: ${resp.status} ${await resp.text()}`);
        const data = await resp.json() as any;
        return data.content?.[0]?.text || "{}";
    }

    throw new Error(`Unsupported api_type: ${api_type}`);
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
