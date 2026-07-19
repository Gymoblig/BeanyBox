const fs = require('fs');
const http = require('http');

async function mapLimit(items, limit, fn) {
  const results = new Array(items.length);
  let idx = 0;
  async function worker() {
    while (idx < items.length) {
      const cur = idx++;
      results[cur] = await fn(items[cur], cur);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

// Shared encrypted-at-rest token file, used by each provider's auth module
// (each keeps its own file path so signing into one provider never touches
// another's stored session).
function createTokenStore(filePath) {
  const { safeStorage } = require('electron');
  return {
    save(tokens) {
      const json = JSON.stringify(tokens);
      const data = safeStorage.isEncryptionAvailable()
        ? safeStorage.encryptString(json)
        : Buffer.from(json, 'utf8');
      fs.writeFileSync(filePath, data);
    },
    read() {
      if (!fs.existsSync(filePath)) return null;
      const data = fs.readFileSync(filePath);
      try {
        const json = safeStorage.isEncryptionAvailable()
          ? safeStorage.decryptString(data)
          : data.toString('utf8');
        return JSON.parse(json);
      } catch (e) {
        return null;
      }
    },
    clear() {
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    },
  };
}

// A local HTTP server on 127.0.0.1 that catches the OAuth redirect (the
// "loopback" pattern for native/desktop apps — no fixed redirect URI needed,
// the actual port is only known once we bind it). Shared by every provider's
// auth module since the dance (listen, open the system browser, wait for
// ?code=/?error= on `pathname`, hand back a small HTML page) is identical.
function createLoopbackAuthServer(pathname) {
  const server = http.createServer();
  const listening = new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const codePromise = new Promise((resolve, reject) => {
    server.on('request', (req, res) => {
      const url = new URL(req.url, 'http://127.0.0.1');
      if (url.pathname !== pathname) {
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
  return {
    async start() {
      await listening;
      const port = server.address().port;
      return { redirectUri: `http://127.0.0.1:${port}${pathname}` };
    },
    waitForCode: () => codePromise,
    close: () => server.close(),
  };
}

module.exports = { mapLimit, createTokenStore, createLoopbackAuthServer };
