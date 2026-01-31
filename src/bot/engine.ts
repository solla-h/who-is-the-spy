import { Env } from '../index';
import { getRoomState } from '../api/state';
import { getProviderById } from '../api/providers';
import { submitDescription, submitVote } from '../api/game';
import { SYSTEM_PROMPT, DESC_PROMPT, VOTE_PROMPT } from './prompts';
import { getPersonaById } from './personas';
import { PlayerRow, LLMProviderRow } from '../types';

export async function runBotTurn(
    env: Env,
    roomId: string,
    botId: string,
    origin: string,
    ctx?: ExecutionContext  // 新增参数：用于链式触发下一个 Bot
) {
    console.log(`[Bot ${botId}] === START runBotTurn ===`);
    try {
        // 1. Get Context
        // Fetch bot token and config
        console.log(`[Bot ${botId}] Running turn with origin: ${origin}`);
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
            console.error(`[Bot] Provider "${botConfig.provider}" not found, using openai`);
            // Fallback to a default
            botConfig.provider = 'openai';
        }

        const stateResult = await getRoomState(roomId, botToken, env);
        if (!stateResult.success || !stateResult.state) {
            throw new Error(`Failed to get state: ${stateResult.error}`);
        }
        const state = stateResult.state;
        console.log(`[Bot ${botId}] Phase: ${state.phase}, Round: ${state.round}, CurrentTurn: ${state.currentTurn}`);

        if (state.phase === 'description') {
            await handleDescriptionPhase(env, roomId, botToken, botId, state, botConfig, providerConfig, origin, ctx);
        } else if (state.phase === 'voting') {
            await handleVotingPhase(env, roomId, botToken, botId, state, botConfig, providerConfig, origin);
        }
    } catch (error) {
        console.error(`[Bot Error] Room ${roomId} Bot ${botId}:`, error);
    }
    console.log(`[Bot ${botId}] === END runBotTurn ===`);
}

async function handleDescriptionPhase(
    env: Env, roomId: string, botToken: string, botId: string,
    state: any, botConfig: any, providerConfig: LLMProviderRow | null, origin: string,
    ctx?: ExecutionContext  // 新增参数：用于链式触发
) {
    console.log(`[Bot ${botId}] Starting description phase handler`);

    // === 预检查 #1：是否轮到自己 ===
    const alivePlayers = state.players.filter((p: any) => p.isAlive);
    const currentTurnIndex = state.currentTurn % alivePlayers.length;
    const currentPlayer = alivePlayers[currentTurnIndex];

    if (!currentPlayer || currentPlayer.id !== botId) {
        console.log(`[Bot ${botId}] Not my turn, skipping. Expected: ${currentPlayer?.id}, Me: ${botId}`);
        return;
    }

    // === 预检查 #2：是否已经描述过 ===
    const meInState = state.players.find((p: any) => p.id === botId);
    if (meInState?.hasDescribed) {
        console.log(`[Bot ${botId}] Already described this round, skipping.`);
        return;
    }

    console.log(`[Bot ${botId}] Passed pre-checks, proceeding to generate description.`);

    let description = "";

    try {
        // Filter history
        const historyText = state.descriptions.length > 0
            ? state.descriptions.map((d: any) => `${d.playerName}: ${d.text}`).join('\n')
            : "(No one has spoken yet in this round)";

        const aliveCount = alivePlayers.length;

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

        console.log(`[Bot ${botId}] Calling LLM (${botConfig.provider})...`);
        const response = await callLLM(env, systemPrompt, userPrompt, providerConfig);
        console.log(`[Bot ${botId}] LLM response received, length: ${response.length}`);
        console.log(`[Bot ${botId}] Raw response (first 100 chars): ${response.substring(0, 100)}...`);

        // Clean the response (Plain Text Strategy)
        description = cleanResponse(response);
        console.log(`[Bot ${botId}] Cleaned description: "${description}"`);

        // Basic safety checks
        if (!description) description = "让我想想...";

        if (state.myWord && description.includes(state.myWord)) {
            console.warn(`[Bot ${botId}] Bot tried to say proper noun! Fallback.`);
            description = "这个东西很有趣...";
        }
    } catch (error: any) {
        console.error(`[Bot ${botId}] Generation failed:`, error);
        // Fallback description with error info to alert users
        const errorMsg = error.message || "Unknown error";
        if (errorMsg.includes("Missing API key")) {
            description = "[AI Error] 未配置 API Key，请联系房主。";
        } else {
            description = `(思考短路) ${error.message?.substring(0, 20) || 'Unknown'}`;
        }
    }

    // === 核心修复：直接调用 submitDescription，传入 ctx 以支持链式触发 ===
    console.log(`[Bot ${botId}] Submitting description: "${description}"`);
    try {
        const result = await submitDescription(roomId, botToken, description, env, ctx, origin);
        console.log(`[Bot ${botId}] Submit result: ${JSON.stringify(result)}`);

        if (!result.success) {
            console.error(`[Bot ${botId}] Submit failed:`, result.error);
        }
    } catch (submitError) {
        console.error(`[Bot ${botId}] Direct submission failed:`, submitError);
    }
}



async function handleVotingPhase(
    env: Env, roomId: string, botToken: string, botId: string,
    state: any, botConfig: any, providerConfig: LLMProviderRow | null, origin: string
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

// LLM 调用超时时间（毫秒）- 留 5 秒余量给 Workers 的 30 秒限制
const LLM_TIMEOUT_MS = 25000;

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

    // 创建超时控制器
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
        console.warn(`[LLM] Request timeout after ${LLM_TIMEOUT_MS}ms, aborting...`);
        controller.abort();
    }, LLM_TIMEOUT_MS);

    try {
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
                    temperature: 0.9,
                    max_tokens: 32000 //Increased for DeepSeek R1 thinking process
                }),
                signal: controller.signal  // 添加超时信号
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
                    }]
                }),
                signal: controller.signal  // 添加超时信号
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
                }),
                signal: controller.signal  // 添加超时信号
            });

            if (!resp.ok) throw new Error(`Claude API Error: ${resp.status} ${await resp.text()}`);
            const data = await resp.json() as any;
            return data.content?.[0]?.text || "{}";
        }

        throw new Error(`Unsupported api_type: ${api_type}`);
    } catch (error: any) {
        // 处理超时错误
        if (error.name === 'AbortError') {
            throw new Error(`LLM request timeout after ${LLM_TIMEOUT_MS / 1000}s`);
        }
        throw error;
    } finally {
        clearTimeout(timeoutId);  // 清理超时定时器
    }
}

function cleanResponse(text: string): string {
    // 1. Remove <think> blocks (DeepSeek style)
    let cleaned = text.replace(/<think>[\s\S]*?<\/think>/gi, '');

    // 2. Remove "thought:" lines if mixed
    cleaned = cleaned.replace(/^thought:.*$/gim, '');

    // 3. Remove "Description:" prefix
    cleaned = cleaned.replace(/^Description:\s*/i, '');
    cleaned = cleaned.replace(/^描述[:：]\s*/i, '');

    // 4. Remove surrounding quotes
    cleaned = cleaned.replace(/^["']|["']$/g, '');

    // 5. Remove JSON artifacts if model failed to follow instructions
    if (cleaned.trim().startsWith('{') || cleaned.trim().startsWith('```')) {
        // Fallback to extraction if it looks like JSON
        const json = extractJSON(text); // Reuse existing robust extractor
        return json.description || cleaned;
    }

    return cleaned.trim().substring(0, 66); // Hard limit 66 chars
}

function extractJSON(text: string): any {
    // Try multiple extraction strategies
    try {
        // Strategy 1: Direct JSON parse (if response is pure JSON)
        return JSON.parse(text);
    } catch (e1) {
        // Strategy 2: Extract JSON from markdown code block
        const codeBlockMatch = text.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
        if (codeBlockMatch) {
            try {
                return JSON.parse(codeBlockMatch[1]);
            } catch (e2) {
                console.warn("[extractJSON] Code block JSON parse failed");
            }
        }

        // Strategy 3: Find first { and last } and parse
        const start = text.indexOf('{');
        const end = text.lastIndexOf('}');
        if (start !== -1 && end !== -1 && end > start) {
            try {
                return JSON.parse(text.slice(start, end + 1));
            } catch (e3) {
                console.warn("[extractJSON] Bracket extraction failed");
            }
        }

        // Fallback: Return raw text (or partial) for voting if JSON fails
        return { description: "...", vote_target_id: "" };
    }
}
