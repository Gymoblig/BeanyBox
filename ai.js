const path = require('path');
const { app } = require('electron');
const { createTokenStore } = require('./util');

// Encrypted at rest (same DPAPI-backed safeStorage mechanism as OAuth
// tokens), kept in the main process only — the API key never crosses the
// IPC bridge to the renderer.
const store = createTokenStore(path.join(app.getPath('userData'), 'ai-config.enc'));

const DEFAULT_MODELS = {
  openai: 'gpt-4o-mini',
  anthropic: 'claude-3-5-haiku-20241022',
};

function getConfig() {
  return store.read() || { provider: '', apiKey: '', model: '' };
}

function saveConfig({ provider, apiKey, model }) {
  const current = getConfig();
  store.save({
    provider: provider !== undefined ? provider : current.provider,
    apiKey: apiKey !== undefined && apiKey !== '' ? apiKey : current.apiKey,
    model: model !== undefined ? model : current.model,
  });
}

function clearConfig() {
  store.clear();
}

function status() {
  const cfg = getConfig();
  return { configured: !!(cfg.provider && cfg.apiKey), provider: cfg.provider || '' };
}

// { provider, model, hasKey } — never the actual key, so the renderer can
// show "key saved" without ever holding the secret itself.
function publicConfig() {
  const cfg = getConfig();
  return { provider: cfg.provider || '', model: cfg.model || '', hasKey: !!cfg.apiKey };
}

async function callOpenAI(apiKey, model, prompt) {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 500,
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`OpenAI API error (${res.status}): ${body.slice(0, 200)}`);
  }
  const data = await res.json();
  return (data.choices && data.choices[0] && data.choices[0].message.content || '').trim();
}

async function callAnthropic(apiKey, model, prompt) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      max_tokens: 500,
      messages: [{ role: 'user', content: prompt }],
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Anthropic API error (${res.status}): ${body.slice(0, 200)}`);
  }
  const data = await res.json();
  return (data.content && data.content[0] && data.content[0].text || '').trim();
}

// context = the original message's body when drafting a reply, empty for a
// fresh compose — either way we only ask for body text, never a subject
// line or signature, so it drops straight into the compose textarea.
async function draftFromSubject({ subject, context }) {
  const cfg = getConfig();
  if (!cfg.provider || !cfg.apiKey) {
    throw new Error('No AI provider configured — add an API key in Settings.');
  }
  const model = cfg.model || DEFAULT_MODELS[cfg.provider];
  const prompt = context
    ? `Write a concise, friendly email reply. Only output the reply body text — no subject line, no signature, no placeholders like [Your Name].\n\nOriginal message:\n"""\n${context}\n"""\n\nReply subject: ${subject}`
    : `Write a concise, friendly email based on this subject line. Only output the email body text — no subject line, no signature, no placeholders like [Your Name].\n\nSubject: ${subject}`;

  if (cfg.provider === 'openai') return callOpenAI(cfg.apiKey, model, prompt);
  if (cfg.provider === 'anthropic') return callAnthropic(cfg.apiKey, model, prompt);
  throw new Error(`Unknown AI provider: ${cfg.provider}`);
}

module.exports = { getConfig, saveConfig, clearConfig, status, publicConfig, draftFromSubject };
