const http = require('http');
const fs = require('fs');
const path = require('path');
const { app, shell, safeStorage } = require('electron');
const { OAuth2Client } = require('google-auth-library');

// gmail.modify explicitly excludes permanent delete ("bypassing Trash") —
// Delete Permanently in the Trash view needs the full scope instead.
const SCOPES = ['https://mail.google.com/'];

function configPath() {
  return path.join(__dirname, 'oauth-config.json');
}

function tokenPath() {
  return path.join(app.getPath('userData'), 'tokens.enc');
}

function loadClientConfig() {
  const p = configPath();
  if (!fs.existsSync(p)) {
    throw new Error(
      'Missing oauth-config.json. Copy oauth-config.example.json to oauth-config.json and fill in ' +
      'the client_id / client_secret from your Google Cloud OAuth "Desktop app" credentials.'
    );
  }
  const raw = JSON.parse(fs.readFileSync(p, 'utf8'));
  if (!raw.client_id || !raw.client_secret) {
    throw new Error('oauth-config.json is missing client_id or client_secret.');
  }
  return raw;
}

function saveTokens(tokens) {
  const json = JSON.stringify(tokens);
  const data = safeStorage.isEncryptionAvailable()
    ? safeStorage.encryptString(json)
    : Buffer.from(json, 'utf8');
  fs.writeFileSync(tokenPath(), data);
}

function readTokens() {
  const p = tokenPath();
  if (!fs.existsSync(p)) return null;
  const data = fs.readFileSync(p);
  try {
    const json = safeStorage.isEncryptionAvailable()
      ? safeStorage.decryptString(data)
      : data.toString('utf8');
    return JSON.parse(json);
  } catch (e) {
    return null;
  }
}

function clearTokens() {
  const p = tokenPath();
  if (fs.existsSync(p)) fs.unlinkSync(p);
}

let client = null;

function getClient() {
  if (client) return client;
  const cfg = loadClientConfig();
  client = new OAuth2Client({ clientId: cfg.client_id, clientSecret: cfg.client_secret });
  client.on('tokens', (tokens) => {
    const merged = { ...(readTokens() || {}), ...tokens };
    saveTokens(merged);
  });
  return client;
}

async function restoreSession() {
  const tokens = readTokens();
  if (!tokens || !tokens.refresh_token) return null;
  const c = getClient();
  c.setCredentials(tokens);
  try {
    await c.getAccessToken();
    return c;
  } catch (e) {
    clearTokens();
    return null;
  }
}

function waitForCode(server) {
  return new Promise((resolve, reject) => {
    server.on('request', (req, res) => {
      const url = new URL(req.url, 'http://127.0.0.1');
      if (url.pathname !== '/oauth2callback') {
        res.writeHead(404).end();
        return;
      }
      const code = url.searchParams.get('code');
      const error = url.searchParams.get('error');
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(
        '<html><body style="font-family:sans-serif;background:#0b0b0c;color:#c9c9c9;' +
        'display:flex;align-items:center;justify-content:center;height:100vh;margin:0;">' +
        '<div>' + (error ? 'Sign-in failed. You can close this window.' :
          'Signed in. You can close this window and return to BeanyBox.') + '</div></body></html>'
      );
      if (error) reject(new Error(error));
      else if (code) resolve(code);
      else reject(new Error('No code returned'));
    });
  });
}

async function login() {
  const c = getClient();
  const server = http.createServer();
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  const redirectUri = `http://127.0.0.1:${port}/oauth2callback`;

  const authUrl = c.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    redirect_uri: redirectUri,
    prompt: 'consent',
  });

  await shell.openExternal(authUrl);

  let code;
  try {
    code = await waitForCode(server);
  } finally {
    server.close();
  }

  const { tokens } = await c.getToken({ code, redirect_uri: redirectUri });
  c.setCredentials(tokens);
  saveTokens(tokens);
  return c;
}

function logout() {
  clearTokens();
  client = null;
}

module.exports = { login, logout, restoreSession, getClient };
