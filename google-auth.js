const fs = require('fs');
const path = require('path');
const { app, shell } = require('electron');
const { OAuth2Client } = require('google-auth-library');
const { createTokenStore, createLoopbackAuthServer } = require('./util');

// gmail.modify explicitly excludes permanent delete ("bypassing Trash") —
// Delete Permanently in the Trash view needs the full scope instead.
const SCOPES = ['https://mail.google.com/'];

function configPath() {
  return path.join(__dirname, 'oauth-config.json');
}

const tokenStore = createTokenStore(path.join(app.getPath('userData'), 'tokens.enc'));

// The config used to be a flat { client_id, client_secret } object holding
// only Google's credentials. It's now nested per-provider ({ google: {...},
// microsoft: {...} }) so a second provider can live alongside it — the flat
// shape is still accepted so existing users don't need to touch their file.
function loadClientConfig() {
  const p = configPath();
  if (!fs.existsSync(p)) {
    throw new Error(
      'Missing oauth-config.json. Copy oauth-config.example.json to oauth-config.json and fill in ' +
      'the client_id / client_secret from your Google Cloud OAuth "Desktop app" credentials.'
    );
  }
  const raw = JSON.parse(fs.readFileSync(p, 'utf8'));
  const google = raw.google || raw;
  if (!google.client_id || !google.client_secret) {
    throw new Error('oauth-config.json is missing google.client_id or google.client_secret.');
  }
  return google;
}

let client = null;

function getClient() {
  if (client) return client;
  const cfg = loadClientConfig();
  client = new OAuth2Client({ clientId: cfg.client_id, clientSecret: cfg.client_secret });
  client.on('tokens', (tokens) => {
    tokenStore.save({ ...(tokenStore.read() || {}), ...tokens });
  });
  return client;
}

async function restoreSession() {
  const tokens = tokenStore.read();
  if (!tokens || !tokens.refresh_token) return null;
  const c = getClient();
  c.setCredentials(tokens);
  try {
    await c.getAccessToken();
    return c;
  } catch (e) {
    tokenStore.clear();
    return null;
  }
}

async function login() {
  const c = getClient();
  const loopback = createLoopbackAuthServer('/oauth2callback');
  const { redirectUri } = await loopback.start();

  const authUrl = c.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    redirect_uri: redirectUri,
    prompt: 'consent',
  });

  await shell.openExternal(authUrl);

  let code;
  try {
    code = await loopback.waitForCode();
  } finally {
    loopback.close();
  }

  const { tokens } = await c.getToken({ code, redirect_uri: redirectUri });
  c.setCredentials(tokens);
  tokenStore.save(tokens);
  return c;
}

function logout() {
  tokenStore.clear();
  client = null;
}

module.exports = { login, logout, restoreSession, getClient };
