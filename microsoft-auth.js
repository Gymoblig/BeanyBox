const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { app, shell } = require('electron');
const { createTokenStore, createLoopbackAuthServer } = require('./util');

const AUTHORITY = 'https://login.microsoftonline.com/common';
const AUTHORIZE_URL = `${AUTHORITY}/oauth2/v2.0/authorize`;
const TOKEN_URL = `${AUTHORITY}/oauth2/v2.0/token`;
const SCOPES = ['offline_access', 'Mail.ReadWrite', 'Mail.Send', 'User.Read'];

function configPath() {
  return path.join(__dirname, 'oauth-config.json');
}

const tokenStore = createTokenStore(path.join(app.getPath('userData'), 'tokens-microsoft.enc'));

function loadClientConfig() {
  const p = configPath();
  if (!fs.existsSync(p)) {
    throw new Error(
      'Missing oauth-config.json. Copy oauth-config.example.json to oauth-config.json and fill in ' +
      'microsoft.client_id from your Azure app registration.'
    );
  }
  const raw = JSON.parse(fs.readFileSync(p, 'utf8'));
  if (!raw.microsoft || !raw.microsoft.client_id) {
    throw new Error('oauth-config.json is missing microsoft.client_id.');
  }
  return raw.microsoft;
}

function base64url(buf) {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// Azure "Mobile and desktop applications" registrations are public clients
// (no secret) — PKCE proves the code exchange came from the same process
// that started the auth request, standing in for a client secret.
function generatePkce() {
  const verifier = base64url(crypto.randomBytes(32));
  const challenge = base64url(crypto.createHash('sha256').update(verifier).digest());
  return { verifier, challenge };
}

async function requestToken(params) {
  const cfg = loadClientConfig();
  const body = new URLSearchParams({ client_id: cfg.client_id, ...params });
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error_description || data.error || 'Microsoft token request failed');
  }
  return data;
}

function persistTokenResponse(data) {
  const tokens = {
    access_token: data.access_token,
    // A refresh may not return a new refresh_token — keep the previous one.
    refresh_token: data.refresh_token || (tokenStore.read() || {}).refresh_token,
    expires_at: Date.now() + (data.expires_in || 0) * 1000,
  };
  tokenStore.save(tokens);
  return tokens;
}

// The object handed to OutlookClient — it only ever needs a valid access
// token and doesn't care whether one was just refreshed.
function makeClient(initialTokens) {
  let tokens = initialTokens;
  return {
    async getAccessToken() {
      if (!tokens.expires_at || tokens.expires_at - Date.now() < 120000) {
        if (!tokens.refresh_token) throw new Error('No Microsoft refresh token available');
        const data = await requestToken({
          grant_type: 'refresh_token',
          refresh_token: tokens.refresh_token,
          scope: SCOPES.join(' '),
        });
        tokens = persistTokenResponse(data);
      }
      return tokens.access_token;
    },
  };
}

async function restoreSession() {
  const tokens = tokenStore.read();
  if (!tokens || !tokens.refresh_token) return null;
  const c = makeClient(tokens);
  try {
    await c.getAccessToken();
    return c;
  } catch (e) {
    tokenStore.clear();
    return null;
  }
}

async function login() {
  const cfg = loadClientConfig();
  const loopback = createLoopbackAuthServer('/oauth2callback');
  const { redirectUri } = await loopback.start();
  const { verifier, challenge } = generatePkce();

  const authUrl = new URL(AUTHORIZE_URL);
  authUrl.searchParams.set('client_id', cfg.client_id);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('redirect_uri', redirectUri);
  authUrl.searchParams.set('response_mode', 'query');
  authUrl.searchParams.set('scope', SCOPES.join(' '));
  authUrl.searchParams.set('code_challenge', challenge);
  authUrl.searchParams.set('code_challenge_method', 'S256');
  authUrl.searchParams.set('prompt', 'select_account');

  await shell.openExternal(authUrl.toString());

  let code;
  try {
    code = await loopback.waitForCode();
  } finally {
    loopback.close();
  }

  const data = await requestToken({
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirectUri,
    code_verifier: verifier,
    scope: SCOPES.join(' '),
  });
  return makeClient(persistTokenResponse(data));
}

function logout() {
  tokenStore.clear();
}

module.exports = { login, logout, restoreSession };
