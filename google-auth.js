const path = require('path');
const { app, shell } = require('electron');
const { OAuth2Client } = require('google-auth-library');
const { createTokenStore, createLoopbackAuthServer } = require('./util');

// gmail.modify explicitly excludes permanent delete ("bypassing Trash") —
// Delete Permanently in the Trash view needs the full scope instead.
const SCOPES = ['https://mail.google.com/'];

const tokenStore = createTokenStore(path.join(app.getPath('userData'), 'tokens.enc'));

// The OAuth client_id/client_secret used to ship in a bundled
// oauth-config.json — fine for running from source, but it meant anyone's
// built .exe carried the same (real) credentials. Each user now brings
// their own, entered on the login screen or in Settings, encrypted at rest
// the same way as the mail tokens and the AI API key.
const configStore = createTokenStore(path.join(app.getPath('userData'), 'google-oauth-config.enc'));

function getConfig() {
  return configStore.read() || { client_id: '', client_secret: '' };
}

function hasConfig() {
  const cfg = getConfig();
  return !!(cfg.client_id && cfg.client_secret);
}

function saveConfig({ client_id, client_secret }) {
  const current = getConfig();
  configStore.save({
    client_id: client_id !== undefined ? client_id.trim() : current.client_id,
    client_secret: client_secret !== undefined && client_secret !== '' ? client_secret.trim() : current.client_secret,
  });
  client = null;
}

function clearConfig() {
  configStore.clear();
  client = null;
}

// { client_id, hasSecret } — the client_id isn't very sensitive (it's
// visible in the browser's address bar during sign-in anyway) but the
// secret never round-trips back to the renderer once saved.
function publicConfig() {
  const cfg = getConfig();
  return { client_id: cfg.client_id || '', hasSecret: !!cfg.client_secret, hasConfig: hasConfig() };
}

function loadClientConfig() {
  const cfg = getConfig();
  if (!cfg.client_id || !cfg.client_secret) {
    throw new Error('No Google OAuth client configured — add your Client ID and Client Secret first.');
  }
  return cfg;
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

module.exports = { login, logout, restoreSession, getClient, hasConfig, publicConfig, saveConfig, clearConfig };
