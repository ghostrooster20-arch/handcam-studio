import type { AiProviderConfig, AiProviderId } from '../types';
import { pushLog } from '../lib/logger';

const STORAGE_KEY = 'handcam.ai.providers.v1';

const DEFAULTS: Record<AiProviderId, AiProviderConfig> = {
  openai: { provider: 'openai', model: 'gpt-4.1-mini', key: '', baseUrl: 'https://api.openai.com/v1' },
  gemini: { provider: 'gemini', model: 'gemini-2.5-flash', key: '', baseUrl: 'https://generativelanguage.googleapis.com/v1beta' },
  opencode: { provider: 'opencode', model: 'gpt-4.1-mini', key: '', baseUrl: 'https://api.example.com/v1' },
};

export function loadProviderConfigs(): Record<AiProviderId, AiProviderConfig> {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return structuredClone(DEFAULTS);
    const parsed = JSON.parse(stored) as Partial<Record<AiProviderId, AiProviderConfig>>;
    return {
      openai: { ...DEFAULTS.openai, ...(parsed.openai ?? {}) },
      gemini: { ...DEFAULTS.gemini, ...(parsed.gemini ?? {}) },
      opencode: { ...DEFAULTS.opencode, ...(parsed.opencode ?? {}) },
    };
  } catch (error) {
    pushLog('warn', 'ai', 'Could not read provider configs; using defaults', error);
    return structuredClone(DEFAULTS);
  }
}

export function saveProviderConfigs(configs: Record<AiProviderId, AiProviderConfig>) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(configs));
  pushLog('info', 'ai', 'AI provider configuration saved locally');
}

export function clearProviderKeys() {
  const configs = loadProviderConfigs();
  for (const key of Object.keys(configs) as AiProviderId[]) configs[key].key = '';
  saveProviderConfigs(configs);
  pushLog('info', 'ai', 'AI keys cleared from localStorage');
  return configs;
}

interface CompletionRequest {
  system: string;
  user: string;
  json?: boolean;
}

async function openAiLike(config: AiProviderConfig, { system, user, json }: CompletionRequest): Promise<string> {
  if (!config.key.trim()) throw new Error(`Missing API key for ${config.provider}`);
  const endpoint = `${config.baseUrl.replace(/\/$/, '')}/chat/completions`;
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${config.key}`,
    },
    body: JSON.stringify({
      model: config.model || DEFAULTS[config.provider].model,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      temperature: 0.35,
      max_tokens: 1200,
      ...(json ? { response_format: { type: 'json_object' } } : {}),
    }),
  });
  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`${config.provider} request failed (${response.status}): ${text.slice(0, 500)}`);
  }
  const body = await response.json();
  const content = body?.choices?.[0]?.message?.content;
  if (typeof content !== 'string') throw new Error(`${config.provider} returned an unexpected response`);
  return content;
}

async function gemini(config: AiProviderConfig, { system, user, json }: CompletionRequest): Promise<string> {
  if (!config.key.trim()) throw new Error('Missing Gemini API key');
  const endpoint = `${config.baseUrl.replace(/\/$/, '')}/models/${encodeURIComponent(config.model || DEFAULTS.gemini.model)}:generateContent`;
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-goog-api-key': config.key,
    },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: 'user', parts: [{ text: user }] }],
      generationConfig: {
        temperature: 0.35,
        maxOutputTokens: 1400,
        ...(json ? { responseMimeType: 'application/json' } : {}),
      },
    }),
  });
  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`Gemini request failed (${response.status}): ${text.slice(0, 500)}`);
  }
  const body = await response.json();
  const content = body?.candidates?.[0]?.content?.parts?.map((part: { text?: string }) => part.text ?? '').join('') ?? '';
  if (!content.trim()) throw new Error('Gemini returned an empty response');
  return content;
}

export async function completeJson<T>(config: AiProviderConfig, request: CompletionRequest & { json: true }): Promise<T> {
  const content = config.provider === 'gemini'
    ? await gemini(config, request)
    : await openAiLike(config, request);
  const unfenced = content.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim();
  try {
    return JSON.parse(unfenced) as T;
  } catch (error) {
    pushLog('error', 'ai', 'AI JSON parse failed', { error: String(error), content: content.slice(0, 1000) });
    throw new Error('The AI response was not valid JSON. Check the selected model and try again.');
  }
}

export async function completeText(config: AiProviderConfig, request: CompletionRequest): Promise<string> {
  const content = config.provider === 'gemini'
    ? await gemini(config, request)
    : await openAiLike(config, request);
  return content.trim();
}
