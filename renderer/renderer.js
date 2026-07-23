(() => {
  const root = document.getElementById('root');
  const modalRoot = document.getElementById('modal-root');
  const titlebarLabel = document.getElementById('titlebar-label');
  const ARCHIVE_FOLDER_ID = '__ARCHIVE__';

  document.getElementById('btn-min').addEventListener('click', () => window.api.minimize());
  document.getElementById('btn-max').addEventListener('click', () => window.api.maximize());
  document.getElementById('btn-close').addEventListener('click', () => window.api.close());

  const AVATAR_COLORS = ['#ff5c5c', '#e8a13a', '#5ac8ff', '#8ad86a', '#c98aff', '#ff8ac2', '#5ae0c0'];
  function avatarColor(name) {
    let h = 0;
    for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
    return AVATAR_COLORS[h % AVATAR_COLORS.length];
  }

  const ACCENTS = [
    { id: 'red', name: 'Red', value: '#ff5c5c' },
    { id: 'orange', name: 'Orange', value: '#ff9d42' },
    { id: 'amber', name: 'Amber', value: '#ffcc4d' },
    { id: 'green', name: 'Green', value: '#5ce87a' },
    { id: 'cyan', name: 'Cyan', value: '#5ae0c0' },
    { id: 'blue', name: 'Blue', value: '#5ac8ff' },
    { id: 'purple', name: 'Purple', value: '#b58aff' },
    { id: 'pink', name: 'Pink', value: '#ff8ac2' },
  ];
  const PAGE_SIZES = [10, 20, 30, 50, 100];

  const SVG_ICON_ATTRS = 'viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"';
  const ICON_ARCHIVE = `<svg ${SVG_ICON_ATTRS}><polyline points="21 8 21 21 3 21 3 8"></polyline><rect x="1" y="3" width="22" height="5"></rect><line x1="10" y1="12" x2="14" y2="12"></line></svg>`;
  const ICON_TRASH = `<svg ${SVG_ICON_ATTRS}><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"></path><path d="M10 11v6"></path><path d="M14 11v6"></path><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"></path></svg>`;
  const ICON_RESTORE = `<svg ${SVG_ICON_ATTRS}><polyline points="1 4 1 10 7 10"></polyline><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"></path></svg>`;

  // Pure-JS MD5 (public-domain algorithm) so we can look up Gravatar photos by email hash.
  function md5(str) {
    function rotl(x, c) { return (x << c) | (x >>> (32 - c)); }
    const K = new Uint32Array([
      0xd76aa478,0xe8c7b756,0x242070db,0xc1bdceee,0xf57c0faf,0x4787c62a,0xa8304613,0xfd469501,
      0x698098d8,0x8b44f7af,0xffff5bb1,0x895cd7be,0x6b901122,0xfd987193,0xa679438e,0x49b40821,
      0xf61e2562,0xc040b340,0x265e5a51,0xe9b6c7aa,0xd62f105d,0x02441453,0xd8a1e681,0xe7d3fbc8,
      0x21e1cde6,0xc33707d6,0xf4d50d87,0x455a14ed,0xa9e3e905,0xfcefa3f8,0x676f02d9,0x8d2a4c8a,
      0xfffa3942,0x8771f681,0x6d9d6122,0xfde5380c,0xa4beea44,0x4bdecfa9,0xf6bb4b60,0xbebfbc70,
      0x289b7ec6,0xeaa127fa,0xd4ef3085,0x04881d05,0xd9d4d039,0xe6db99e5,0x1fa27cf8,0xc4ac5665,
      0xf4292244,0x432aff97,0xab9423a7,0xfc93a039,0x655b59c3,0x8f0ccc92,0xffeff47d,0x85845dd1,
      0x6fa87e4f,0xfe2ce6e0,0xa3014314,0x4e0811a1,0xf7537e82,0xbd3af235,0x2ad7d2bb,0xeb86d391,
    ]);
    const S = [
      7,12,17,22, 7,12,17,22, 7,12,17,22, 7,12,17,22,
      5, 9,14,20, 5, 9,14,20, 5, 9,14,20, 5, 9,14,20,
      4,11,16,23, 4,11,16,23, 4,11,16,23, 4,11,16,23,
      6,10,15,21, 6,10,15,21, 6,10,15,21, 6,10,15,21,
    ];
    const msg = new TextEncoder().encode(str);
    const origLenBits = msg.length * 8;
    const withOne = new Uint8Array(((msg.length + 8) >> 6) * 64 + 64);
    withOne.set(msg);
    withOne[msg.length] = 0x80;
    const totalLen = withOne.length;
    const dv = new DataView(withOne.buffer);
    dv.setUint32(totalLen - 8, origLenBits >>> 0, true);
    dv.setUint32(totalLen - 4, Math.floor(origLenBits / 0x100000000), true);

    let a0 = 0x67452301, b0 = 0xefcdab89, c0 = 0x98badcfe, d0 = 0x10325476;
    for (let chunkStart = 0; chunkStart < totalLen; chunkStart += 64) {
      const M = new Uint32Array(16);
      for (let j = 0; j < 16; j++) M[j] = dv.getUint32(chunkStart + j * 4, true);
      let A = a0, B = b0, C = c0, D = d0;
      for (let i = 0; i < 64; i++) {
        let F, g;
        if (i < 16) { F = (B & C) | (~B & D); g = i; }
        else if (i < 32) { F = (D & B) | (~D & C); g = (5 * i + 1) % 16; }
        else if (i < 48) { F = B ^ C ^ D; g = (3 * i + 5) % 16; }
        else { F = C ^ (B | ~D); g = (7 * i) % 16; }
        F = (F + A + K[i] + M[g]) >>> 0;
        A = D; D = C; C = B;
        B = (B + rotl(F, S[i])) >>> 0;
      }
      a0 = (a0 + A) >>> 0; b0 = (b0 + B) >>> 0; c0 = (c0 + C) >>> 0; d0 = (d0 + D) >>> 0;
    }
    function toHexLE(n) {
      const buf = new Uint8Array(4);
      new DataView(buf.buffer).setUint32(0, n, true);
      return Array.from(buf).map((b) => b.toString(16).padStart(2, '0')).join('');
    }
    return toHexLE(a0) + toHexLE(b0) + toHexLE(c0) + toHexLE(d0);
  }

  function gravatarUrl(email) {
    const hash = md5(String(email || '').trim().toLowerCase());
    return `https://www.gravatar.com/avatar/${hash}?s=64&d=404`;
  }

  // Naive eTLD+1: good enough for ordinary .com/.sk/etc senders, not compound
  // TLDs like .co.uk — collapses mail/marketing subdomains (e.g.
  // e.nvidianews.nvidia.com) down to the brand's real registrable domain
  // (nvidia.com) so its actual site icon is used instead of nothing.
  function rootDomain(host) {
    const parts = String(host || '').split('.').filter(Boolean);
    return parts.length <= 2 ? parts.join('.') : parts.slice(-2).join('.');
  }

  function faviconUrl(email) {
    const domain = rootDomain(String(email || '').split('@')[1] || '');
    return `https://icons.duckduckgo.com/ip3/${encodeURIComponent(domain)}.ico`;
  }

  // DuckDuckGo's icon service returns a generic placeholder (not a 404) for
  // domains it has no real favicon for — that's the "star" Alza.sk keeps
  // showing. We can't get a clean error signal for that, so instead we hash
  // a known-bogus domain's response once and compare every favicon against
  // it; a match means "this is the placeholder", not a real icon.
  let ddgPlaceholderHashPromise = null;
  let ddgHashBroken = false;

  function hashImageEl(img) {
    const c = document.createElement('canvas');
    c.width = 8; c.height = 8;
    const ctx = c.getContext('2d');
    ctx.drawImage(img, 0, 0, 8, 8);
    return ctx.getImageData(0, 0, 8, 8).data.join(',');
  }

  function ddgPlaceholderHash() {
    if (ddgHashBroken) return Promise.resolve(null);
    if (!ddgPlaceholderHashPromise) {
      ddgPlaceholderHashPromise = new Promise((resolve) => {
        const probe = new Image();
        probe.onload = () => {
          try { resolve(hashImageEl(probe)); }
          catch (e) { ddgHashBroken = true; resolve(null); }
        };
        probe.onerror = () => resolve(null);
        probe.src = 'https://icons.duckduckgo.com/ip3/zzz-beanybox-placeholder-probe.invalid.ico';
      });
    }
    return ddgPlaceholderHashPromise;
  }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[c]));
  }

  // Shared by every place a time-of-day gets rendered, so the 12h/24h
  // setting applies consistently everywhere instead of just some displays.
  function formatHourMinute(d, { full } = {}) {
    const m = String(d.getMinutes()).padStart(2, '0');
    if (state.settings.timeFormat === '24h') {
      return `${String(d.getHours()).padStart(2, '0')}:${m}`;
    }
    let h = d.getHours();
    const ap = h >= 12 ? (full ? 'PM' : 'p') : (full ? 'AM' : 'a');
    h = h % 12; if (h === 0) h = 12;
    return full ? `${h}:${m} ${ap}` : `${h}:${m}${ap}`;
  }

  function formatRelative(dateStr) {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '';
    const now = new Date();
    const startOf = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate());
    const diffDays = Math.round((startOf(now) - startOf(d)) / 86400000);
    if (diffDays === 0) return formatHourMinute(d, { full: true });
    if (diffDays === 1) return 'Yest';
    const WD = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    if (diffDays > 1 && diffDays < 7) return WD[d.getDay()];
    const MO = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${MO[d.getMonth()]} ${d.getDate()}`;
  }

  // The raw email Date header (e.g. "Sat, 18 Jul 2026 19:39:29 +0200 (CEST)")
  // is noisy — reformat to local time without the numeric offset/tz abbreviation.
  function formatFullDate(dateStr) {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const WD = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const MO = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${WD[d.getDay()]}, ${MO[d.getMonth()]} ${d.getDate()} ${d.getFullYear()}, ${formatHourMinute(d, { full: true })}`;
  }

  function clockLabel() {
    return formatHourMinute(new Date(), { full: true });
  }

  function formatSize(bytes) {
    if (!bytes) return '';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return Math.round(bytes / 1024) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }

  function b64urlToB64(s) {
    s = String(s || '').replace(/-/g, '+').replace(/_/g, '/');
    while (s.length % 4) s += '=';
    return s;
  }

  function labelName(id) {
    const l = state.allLabels.find((x) => x.id === id);
    return l ? l.name : id;
  }

  function userTagsFor(labelIds) {
    return (labelIds || [])
      .map((id) => state.allLabels.find((l) => l.id === id && l.type === 'user'))
      .filter(Boolean);
  }

  function availableTagsFor(labelIds) {
    const applied = new Set(labelIds || []);
    return state.allLabels.filter((l) => l.type === 'user' && !applied.has(l.id));
  }

  function emptyCompose() {
    return { to: '', subject: '', body: '', threadId: null, inReplyTo: null, references: null, attachments: [], replyContext: '' };
  }

  const state = {
    screen: 'loading', // loading | login | app
    loginBusy: false,
    loginError: '',
    email: '',
    folders: [],
    activeFolderId: null,
    activeFolderName: '',
    isSearch: false,
    searchQuery: '',
    messages: [],
    selectionByFolder: {},
    current: null,
    currentLoading: false,
    mode: 'read', // read | compose
    compose: emptyCompose(),
    listLoading: false,
    statusRight: '',
    searchOpen: false,
    allLabels: [],
    tagPickerOpen: false,
    tagInput: '',
    pageSize: Number(localStorage.getItem('beanybox_pageSize')) || 30,
    nextPageToken: null,
    loadingMore: false,
    confirmModal: null, // { title, message, confirmLabel, dontAskKey, dontAskChecked, onConfirm }
    settingsOpen: false,
    settings: {
      theme: localStorage.getItem('beanybox_theme') || 'system', // dark | light | system
      accent: localStorage.getItem('beanybox_accent') || 'red',
      density: localStorage.getItem('beanybox_density') || 'comfortable', // comfortable | compact
      timeFormat: localStorage.getItem('beanybox_timeFormat') || '12h', // 12h | 24h
    },
    ai: { provider: '', model: '', hasKey: false }, // mirrors main-process config; never holds the actual key
    aiKeyInput: '',
    aiBusy: false,
    // Google OAuth client (client_id/client_secret) — bring-your-own, entered
    // on the login screen or in Settings. Mirrors main-process config; the
    // secret never round-trips back once saved.
    googleConfig: { client_id: '', hasSecret: false, hasConfig: false },
    googleConfigInput: { clientId: '', clientSecret: '' },
  };

  function effectiveTheme() {
    if (state.settings.theme === 'system') {
      return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
    }
    return state.settings.theme;
  }

  function applyThemeVars() {
    document.documentElement.dataset.theme = effectiveTheme();
    document.documentElement.dataset.density = state.settings.density;
    const accent = ACCENTS.find((a) => a.id === state.settings.accent) || ACCENTS[0];
    document.documentElement.style.setProperty('--accent', accent.value);
  }

  window.matchMedia('(prefers-color-scheme: light)').addEventListener('change', () => {
    if (state.settings.theme === 'system') { applyThemeVars(); render(); }
  });

  function setTheme(theme) {
    state.settings.theme = theme;
    localStorage.setItem('beanybox_theme', theme);
    applyThemeVars();
    render();
  }

  function setAccent(accent) {
    state.settings.accent = accent;
    localStorage.setItem('beanybox_accent', accent);
    applyThemeVars();
    render();
  }

  function setDensity(density) {
    state.settings.density = density;
    localStorage.setItem('beanybox_density', density);
    applyThemeVars();
    render();
  }

  function setTimeFormat(format) {
    state.settings.timeFormat = format;
    localStorage.setItem('beanybox_timeFormat', format);
    render();
  }

  function setPageSize(n) {
    if (state.pageSize === n) return;
    state.pageSize = n;
    localStorage.setItem('beanybox_pageSize', String(n));
    render();
    if (state.isSearch) runSearch(state.searchQuery);
    else if (state.activeFolderId) loadMessages(state.activeFolderId);
  }

  function resetConfirmations() {
    Object.keys(localStorage)
      .filter((k) => k.startsWith('beanybox_skip_confirm_'))
      .forEach((k) => localStorage.removeItem(k));
    state.statusRight = 'confirmations reset';
    render();
  }

  async function openSettings() {
    state.settingsOpen = true;
    state.aiKeyInput = '';
    state.googleConfigInput.clientSecret = '';
    render();
    state.ai = await window.api.aiGetConfig();
    await loadGoogleConfig();
    render();
  }

  function closeSettings() {
    state.settingsOpen = false;
    render();
  }

  function setAiProvider(provider) {
    state.ai.provider = provider;
    render();
  }

  async function saveAiConfig() {
    const payload = { provider: state.ai.provider, model: state.ai.model };
    if (state.aiKeyInput.trim()) payload.apiKey = state.aiKeyInput.trim();
    await window.api.aiSaveConfig(payload);
    state.aiKeyInput = '';
    state.ai = await window.api.aiGetConfig();
    state.statusRight = 'AI settings saved';
    render();
  }

  async function clearAiConfig() {
    await window.api.aiClearConfig();
    state.aiKeyInput = '';
    state.ai = await window.api.aiGetConfig();
    state.statusRight = 'AI settings cleared';
    render();
  }

  async function loadGoogleConfig() {
    state.googleConfig = await window.api.googleGetConfig();
    state.googleConfigInput.clientId = state.googleConfig.client_id;
  }

  async function saveGoogleConfig() {
    const payload = {};
    if (state.googleConfigInput.clientId.trim()) payload.client_id = state.googleConfigInput.clientId.trim();
    if (state.googleConfigInput.clientSecret.trim()) payload.client_secret = state.googleConfigInput.clientSecret.trim();
    await window.api.googleSaveConfig(payload);
    state.googleConfigInput.clientSecret = '';
    await loadGoogleConfig();
    if (state.screen === 'app') {
      // The signed-in session belongs to whichever client it was issued to —
      // switching clients mid-session would just fail on the next API call.
      closeSettings();
      await doLogout();
    }
    state.statusRight = 'Google OAuth client saved';
    render();
  }

  async function clearGoogleConfig() {
    await window.api.googleClearConfig();
    state.googleConfigInput = { clientId: '', clientSecret: '' };
    await loadGoogleConfig();
    state.statusRight = 'Google OAuth client cleared';
    render();
  }

  applyThemeVars();

  function selectedId() {
    return state.selectionByFolder[state.activeFolderId] || (state.messages[0] && state.messages[0].id) || null;
  }

  function selectedIndex() {
    const id = selectedId();
    const i = state.messages.findIndex((m) => m.id === id);
    return i < 0 ? 0 : i;
  }

  // ---------- rendering ----------

  function render() {
    renderModals();
    if (state.screen === 'loading') {
      root.innerHTML = '<div class="center-msg">loading…</div>';
      titlebarLabel.textContent = 'BeanyBox - TerMAIL';
      return;
    }
    if (state.screen === 'login') {
      renderLogin();
      titlebarLabel.textContent = 'BeanyBox - TerMAIL';
      return;
    }
    renderApp();
    titlebarLabel.textContent = 'BeanyBox - TerMAIL';
  }

  function showConfirm({ title, message, confirmLabel, dontAskKey, onConfirm }) {
    if (dontAskKey && localStorage.getItem('beanybox_skip_confirm_' + dontAskKey) === '1') {
      onConfirm();
      return;
    }
    state.confirmModal = { title, message, confirmLabel: confirmLabel || 'Confirm', dontAskKey, dontAskChecked: false, onConfirm };
    render();
  }

  function closeConfirm() {
    state.confirmModal = null;
    render();
  }

  function confirmModalAccept() {
    const m = state.confirmModal;
    if (!m) return;
    if (m.dontAskKey && m.dontAskChecked) {
      localStorage.setItem('beanybox_skip_confirm_' + m.dontAskKey, '1');
    }
    state.confirmModal = null;
    m.onConfirm();
  }

  function renderModals() {
    const m = state.confirmModal;
    const confirmHtml = !m ? '' : `
      <div class="modal-overlay" id="modal-overlay">
        <div class="modal-box">
          <div class="modal-title">&#10095; ${esc(m.title)}</div>
          <div class="modal-message">${esc(m.message)}</div>
          <label class="modal-checkbox">
            <input type="checkbox" id="modal-dontask">
            <span>Don't ask again</span>
          </label>
          <div class="modal-actions">
            <div class="act-btn" id="modal-cancel">[Esc] Cancel</div>
            <div class="act-btn primary" id="modal-confirm">${esc(m.confirmLabel)}</div>
          </div>
        </div>
      </div>`;

    modalRoot.innerHTML = confirmHtml + (state.settingsOpen ? settingsModalHtml() : '');

    if (m) {
      document.getElementById('modal-overlay').addEventListener('click', (e) => {
        if (e.target.id === 'modal-overlay') closeConfirm();
      });
      document.getElementById('modal-cancel').addEventListener('click', closeConfirm);
      document.getElementById('modal-confirm').addEventListener('click', confirmModalAccept);
      document.getElementById('modal-dontask').addEventListener('change', (e) => {
        state.confirmModal.dontAskChecked = e.target.checked;
      });
    }
    if (state.settingsOpen) wireSettingsModal();
  }

  function settingsModalHtml() {
    const s = state.settings;
    return `
      <div class="modal-overlay" id="settings-overlay">
        <div class="modal-box settings-box">
          <div class="modal-title">&#10095; Settings</div>

          <div class="settings-section">
            <div class="settings-label">Theme</div>
            <div class="option-row">
              <div class="option-btn ${s.theme === 'dark' ? 'active' : ''}" data-theme-opt="dark">Dark</div>
              <div class="option-btn ${s.theme === 'light' ? 'active' : ''}" data-theme-opt="light">Light</div>
              <div class="option-btn ${s.theme === 'system' ? 'active' : ''}" data-theme-opt="system">System</div>
            </div>
          </div>

          <div class="settings-section">
            <div class="settings-label">Accent color</div>
            <div class="swatch-row">
              ${ACCENTS.map((a) => `
                <div class="swatch ${s.accent === a.id ? 'active' : ''}" data-accent="${a.id}" style="background:${a.value};" title="${esc(a.name)}"></div>`).join('')}
            </div>
          </div>

          <div class="settings-section">
            <div class="settings-label">Density</div>
            <div class="option-row">
              <div class="option-btn ${s.density === 'comfortable' ? 'active' : ''}" data-density-opt="comfortable">Comfortable</div>
              <div class="option-btn ${s.density === 'compact' ? 'active' : ''}" data-density-opt="compact">Compact</div>
            </div>
          </div>

          <div class="settings-section">
            <div class="settings-label">Time format</div>
            <div class="option-row">
              <div class="option-btn ${s.timeFormat === '12h' ? 'active' : ''}" data-timeformat-opt="12h">12-hour</div>
              <div class="option-btn ${s.timeFormat === '24h' ? 'active' : ''}" data-timeformat-opt="24h">24-hour</div>
            </div>
          </div>

          <div class="settings-section">
            <div class="settings-label">Messages per page</div>
            <div class="option-row">
              ${PAGE_SIZES.map((n) => `
                <div class="option-btn ${state.pageSize === n ? 'active' : ''}" data-pagesize="${n}">${n}</div>`).join('')}
            </div>
          </div>

          <div class="settings-section">
            <div class="settings-label">Google OAuth client</div>
            <div class="settings-hint">The Client ID and Secret that identify this app to Google when signing
              in — from your own <a href="https://console.cloud.google.com/" target="_blank">Google Cloud</a>
              OAuth "Desktop app" credentials, not a Google account password. Stored encrypted on this
              machine only. Changing this signs you out.</div>
            <div class="ai-key-row">
              <input type="text" id="google-client-id-input" placeholder="Client ID (…apps.googleusercontent.com)" value="${esc(state.googleConfigInput.clientId)}">
            </div>
            <div class="ai-key-row">
              <input type="password" id="google-client-secret-input" placeholder="${state.googleConfig.hasSecret ? 'Client Secret saved — leave blank to keep it' : 'Client Secret'}" value="${esc(state.googleConfigInput.clientSecret)}">
            </div>
            <div class="option-row" style="margin-top:8px;">
              <div class="act-btn primary" id="google-config-save-btn">Save</div>
              ${state.googleConfig.hasConfig ? '<div class="act-btn" id="google-config-clear-btn">Clear</div>' : ''}
            </div>
          </div>

          <div class="settings-section">
            <div class="settings-label">AI draft assist</div>
            <div class="settings-hint">Add an API key to get a [ AI ] button next to Subject in
              compose — click it to draft a message from the subject (or a reply, using the
              original message as context). The key is stored encrypted and never leaves this
              machine except to call the provider you pick below.</div>
            <div class="option-row">
              <div class="option-btn ${state.ai.provider === 'openai' ? 'active' : ''}" data-ai-provider="openai">OpenAI</div>
              <div class="option-btn ${state.ai.provider === 'anthropic' ? 'active' : ''}" data-ai-provider="anthropic">Claude (Anthropic)</div>
            </div>
            <div class="ai-key-row">
              <input type="password" id="ai-key-input" placeholder="${state.ai.hasKey ? 'saved — leave blank to keep it' : 'API key'}" value="${esc(state.aiKeyInput)}">
            </div>
            <div class="ai-key-row">
              <input type="text" id="ai-model-input" placeholder="model (optional — e.g. gpt-4o-mini)" value="${esc(state.ai.model)}">
            </div>
            <div class="option-row" style="margin-top:8px;">
              <div class="act-btn primary" id="ai-save-btn">Save</div>
              ${state.ai.hasKey || state.ai.provider ? '<div class="act-btn" id="ai-clear-btn">Clear</div>' : ''}
            </div>
          </div>

          <div class="settings-section">
            <div class="settings-label">Confirmations</div>
            <div class="settings-hint">Reset any "don't ask again" dialogs you've dismissed (e.g. Empty Trash).</div>
            <div class="act-btn" id="settings-reset-confirms">Reset confirmations</div>
          </div>

          <div class="modal-actions">
            <div class="act-btn primary" id="settings-close">[Esc] Close</div>
          </div>
        </div>
      </div>`;
  }

  function wireSettingsModal() {
    document.getElementById('settings-overlay').addEventListener('click', (e) => {
      if (e.target.id === 'settings-overlay') closeSettings();
    });
    document.getElementById('settings-close').addEventListener('click', closeSettings);
    document.getElementById('settings-reset-confirms').addEventListener('click', resetConfirmations);
    modalRootAll('[data-theme-opt]').forEach((el) => {
      el.addEventListener('click', () => setTheme(el.dataset.themeOpt));
    });
    modalRootAll('[data-accent]').forEach((el) => {
      el.addEventListener('click', () => setAccent(el.dataset.accent));
    });
    modalRootAll('[data-density-opt]').forEach((el) => {
      el.addEventListener('click', () => setDensity(el.dataset.densityOpt));
    });
    modalRootAll('[data-timeformat-opt]').forEach((el) => {
      el.addEventListener('click', () => setTimeFormat(el.dataset.timeformatOpt));
    });
    modalRootAll('[data-pagesize]').forEach((el) => {
      el.addEventListener('click', () => setPageSize(Number(el.dataset.pagesize)));
    });
    modalRootAll('[data-ai-provider]').forEach((el) => {
      el.addEventListener('click', () => setAiProvider(el.dataset.aiProvider));
    });
    const aiKeyInput = document.getElementById('ai-key-input');
    if (aiKeyInput) aiKeyInput.addEventListener('input', () => { state.aiKeyInput = aiKeyInput.value; });
    const aiModelInput = document.getElementById('ai-model-input');
    if (aiModelInput) aiModelInput.addEventListener('input', () => { state.ai.model = aiModelInput.value; });
    const aiSaveBtn = document.getElementById('ai-save-btn');
    if (aiSaveBtn) aiSaveBtn.addEventListener('click', saveAiConfig);
    const aiClearBtn = document.getElementById('ai-clear-btn');
    if (aiClearBtn) aiClearBtn.addEventListener('click', clearAiConfig);

    const googleClientIdInput = document.getElementById('google-client-id-input');
    if (googleClientIdInput) googleClientIdInput.addEventListener('input', () => { state.googleConfigInput.clientId = googleClientIdInput.value; });
    const googleClientSecretInput = document.getElementById('google-client-secret-input');
    if (googleClientSecretInput) googleClientSecretInput.addEventListener('input', () => { state.googleConfigInput.clientSecret = googleClientSecretInput.value; });
    const googleConfigSaveBtn = document.getElementById('google-config-save-btn');
    if (googleConfigSaveBtn) googleConfigSaveBtn.addEventListener('click', saveGoogleConfig);
    const googleConfigClearBtn = document.getElementById('google-config-clear-btn');
    if (googleConfigClearBtn) googleConfigClearBtn.addEventListener('click', clearGoogleConfig);
  }

  function modalRootAll(sel) {
    return Array.from(modalRoot.querySelectorAll(sel));
  }

  function renderLogin() {
    if (!state.googleConfig.hasConfig) {
      root.innerHTML = `
        <div class="login-wrap">
          <div class="login-box">
            <div class="login-title">&#10095; BeanyBox setup</div>
            <div class="login-sub">Gmail &middot; GreenyBeany's TUI client v1.1.0</div>
            <div class="login-desc">First time here: BeanyBox needs its own Google OAuth client so it can
              ask Google for permission to read your mail — free, and takes about 5 minutes. Create one at
              <a href="https://console.cloud.google.com/" target="_blank">console.cloud.google.com</a>
              (OAuth consent screen + a "Desktop app" credential under APIs &amp; Services &rarr; Credentials),
              then paste the Client ID and Client Secret below. See the
              <a href="https://github.com/Gymoblig/BeanyBox#google-cloud-setup-one-time-5-minutes" target="_blank">README</a>
              for the full walkthrough.</div>
            <div class="ai-key-row">
              <input type="text" id="login-google-client-id" placeholder="Client ID (…apps.googleusercontent.com)" value="${esc(state.googleConfigInput.clientId)}">
            </div>
            <div class="ai-key-row">
              <input type="password" id="login-google-client-secret" placeholder="Client Secret" value="${esc(state.googleConfigInput.clientSecret)}">
            </div>
            <div class="login-btn" id="login-setup-save-btn" style="margin-top:14px;">Save &amp; continue</div>
          </div>
        </div>`;
      const clientIdInput = document.getElementById('login-google-client-id');
      clientIdInput.addEventListener('input', () => { state.googleConfigInput.clientId = clientIdInput.value; });
      const clientSecretInput = document.getElementById('login-google-client-secret');
      clientSecretInput.addEventListener('input', () => { state.googleConfigInput.clientSecret = clientSecretInput.value; });
      document.getElementById('login-setup-save-btn').addEventListener('click', async () => {
        await saveGoogleConfig();
        render();
      });
      return;
    }

    root.innerHTML = `
      <div class="login-wrap">
        <div class="login-box">
          <div class="login-title">&#10095; BeanyBox login</div>
          <div class="login-sub">Gmail &middot; GreenyBeany's TUI client v1.1.0</div>
          <div class="login-desc">A browser window opens for Google's real sign-in and consent screen —
            BeanyBox never sees your password. [Enter] sign in.</div>
          ${state.loginError ? `<div class="login-error">! ${esc(state.loginError)}</div>` : ''}
          <div class="login-btn selected ${state.loginBusy ? 'busy' : ''}" id="login-btn-google">
            ${state.loginBusy ? 'Waiting for browser…' : 'Sign in with Google'}
          </div>
          <div class="settings-hint" style="margin-top:14px;">Wrong OAuth client? <span class="signout-btn" id="login-change-client-btn">change it</span></div>
        </div>
      </div>`;
    document.getElementById('login-btn-google').addEventListener('click', doLogin);
    document.getElementById('login-change-client-btn').addEventListener('click', async () => {
      await clearGoogleConfig();
      render();
    });
  }

  function renderApp() {
    const folderLabel = state.isSearch ? `Search: ${state.searchQuery}` : state.activeFolderName;
    const unreadTotal = state.folders.reduce((s, f) => s + (f.unread || 0), 0);
    const isTrash = !state.isSearch && state.activeFolderId === 'TRASH';

    // root.innerHTML gets fully rebuilt below on every render — including
    // ones triggered by things unrelated to scrolling, like the message
    // detail finishing its async load — which would otherwise reset the
    // list's scroll position back to the top every time.
    const prevMsgList = document.getElementById('msg-list');
    const prevScrollTop = prevMsgList ? prevMsgList.scrollTop : 0;

    root.innerHTML = `
      <div class="statusbar-top">
        <div class="left">
          <span class="acct">&#9670; ${esc(state.email)}</span>
          <span class="signout-btn" id="signout-btn">[sign out]</span>
          <span class="settings-btn" id="settings-btn" title="Settings (,)">[settings]</span>
          <span>${esc(folderLabel)}</span>
        </div>
        <div>${clockLabel()}</div>
      </div>
      ${state.searchOpen ? `
        <div class="search-bar">
          <span class="slabel">/</span>
          <input id="search-input" placeholder="search mail… (Enter to run, Esc to close)" value="${esc(state.searchQuery)}">
        </div>` : ''}
      <div class="main">
        <div class="sidebar">
          <div class="sidebar-title">Folders</div>
          ${state.folders.map((f) => `
            <div class="folder-row" data-folder="${esc(f.id)}">
              <span class="name ${!state.isSearch && f.id === state.activeFolderId ? 'active' : ''}">${esc(f.name)}</span>
              <span class="folder-count ${!state.isSearch && f.id === state.activeFolderId ? 'active' : ''}">${f.unread || ''}</span>
            </div>`).join('')}
          <div class="sidebar-footer">v1.1.0-tui &middot; ${state.listLoading ? 'syncing…' : 'sync ok'}</div>
        </div>

        <div class="list-pane">
          <div class="list-header">
            <span class="label">${esc(folderLabel)} — ${state.messages.length} messages</span>
            ${isTrash
              ? '<div class="new-msg-btn" id="empty-trash-btn">Empty Trash</div>'
              : '<div class="new-msg-btn" id="new-msg-btn">[+] New Message</div>'}
          </div>
          <div class="msg-list" id="msg-list">
            ${renderMessageListItems()}
            ${state.nextPageToken ? `<div class="load-more-row" id="load-more-btn">${state.loadingMore ? 'loading…' : '[+] Load more'}</div>` : ''}
          </div>
        </div>

        <div class="reader-pane" id="reader-pane">
          ${state.mode === 'compose' ? renderCompose() : renderReader()}
        </div>
      </div>

      <div class="statusbar-bottom">
        <div class="left">
          <span class="mode-tag">${state.mode === 'compose' ? 'COMPOSE' : 'NORMAL'}</span>
          <span>[j/k] move</span><span>|</span><span>[c] compose</span><span>|</span><span>[r] reply</span><span>|</span>
          <span>[a] archive</span><span>|</span><span>[d] delete</span><span>|</span><span>[u] restore</span><span>|</span>
          <span>[t] tag</span><span>|</span><span>[w] read-all</span><span>|</span>
          <span>[Ctrl+Space] search</span><span>|</span><span>[,] settings</span><span>|</span><span>[q] quit</span>
        </div>
        <div>${state.statusRight || unreadTotal + ' unread'}</div>
      </div>
    `;

    const newMsgList = document.getElementById('msg-list');
    if (newMsgList) newMsgList.scrollTop = prevScrollTop;

    document.getElementById('signout-btn').addEventListener('click', doLogout);
    document.getElementById('settings-btn').addEventListener('click', openSettings);
    const newMsgBtn = document.getElementById('new-msg-btn');
    if (newMsgBtn) newMsgBtn.addEventListener('click', () => openCompose());
    const emptyTrashBtn = document.getElementById('empty-trash-btn');
    if (emptyTrashBtn) emptyTrashBtn.addEventListener('click', doEmptyTrash);
    const loadMoreBtn = document.getElementById('load-more-btn');
    if (loadMoreBtn) loadMoreBtn.addEventListener('click', loadMoreMessages);
    root.querySelectorAll('.folder-row').forEach((el) => {
      el.addEventListener('click', () => selectFolder(el.dataset.folder));
    });
    root.querySelectorAll('.msg-row').forEach((el) => {
      el.addEventListener('click', () => selectMessage(el.dataset.id));
    });
    root.querySelectorAll('.avatar-img').forEach((img) => {
      img.addEventListener('load', async () => {
        const letter = img.previousElementSibling;
        if (letter) letter.style.display = 'none'; // hide fallback letter once a real icon shows

        if (img.dataset.stage === 'favicon') {
          const placeholder = await ddgPlaceholderHash();
          if (placeholder) {
            try {
              if (hashImageEl(img) === placeholder) {
                if (letter) letter.style.display = '';
                img.remove();
              }
            } catch (e) { /* cross-origin canvas read blocked — can't verify, keep the icon */ }
          }
        }
      });
      img.addEventListener('error', () => {
        if (img.dataset.stage === 'gravatar') {
          img.dataset.stage = 'favicon';
          img.src = faviconUrl(img.dataset.email);
        } else {
          img.remove();
        }
      });
    });

    if (state.searchOpen) {
      const si = document.getElementById('search-input');
      si.focus();
      si.setSelectionRange(si.value.length, si.value.length);
      si.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          state.searchQuery = si.value;
          runSearch(si.value);
        } else if (e.key === 'Escape') {
          state.searchOpen = false;
          render();
        }
      });
    }

    if (state.mode === 'compose') wireCompose();
    else wireReader();
  }

  function renderMessageListItems() {
    if (state.listLoading) return '<div class="msg-empty">loading…</div>';
    if (state.messages.length === 0) return '<div class="msg-empty">(no messages)</div>';
    const selId = selectedId();
    const compact = state.settings.density === 'compact';
    return state.messages.map((m) => {
      const active = m.id === selId;
      const senderColor = active ? 'var(--accent)' : (m.unread ? 'var(--text-bright)' : 'var(--text-dim)');
      const subjColor = active ? 'var(--text-bright)' : (m.unread ? 'var(--text)' : 'var(--text-dim)');
      const weight = m.unread ? 600 : 400;
      const mark = m.unread ? '● ' : '○ ';

      if (compact) {
        return `
        <div class="msg-row compact ${active ? 'active' : ''}" data-id="${esc(m.id)}">
          <span class="msg-compact-line" style="color:${senderColor};font-weight:${weight};">
            ${mark}${esc(m.sender)}<span class="msg-compact-sep">&mdash;</span><span style="color:${subjColor};">${esc(m.subject)}</span>
          </span>
          <span class="msg-date">${esc(formatRelative(m.date))}</span>
        </div>`;
      }

      const color = avatarColor(m.sender || m.email || '?');
      const tags = userTagsFor(m.labelIds);
      return `
        <div class="msg-row ${active ? 'active' : ''}" data-id="${esc(m.id)}">
          <div class="msg-avatar" style="border-color:${color};color:${color};">
            <span class="avatar-letter">${esc((m.sender || '?').charAt(0).toUpperCase())}</span>
            <img class="avatar-img" data-stage="gravatar" data-email="${esc(m.email)}" src="${esc(gravatarUrl(m.email))}" alt="">
          </div>
          <div class="msg-body">
            <div class="msg-line1">
              <span style="color:${senderColor};font-weight:${weight};">${mark}${esc(m.sender)}</span>
              <span class="msg-date">${esc(formatRelative(m.date))}</span>
            </div>
            <div class="msg-subject" style="color:${subjColor};font-weight:${weight};">${esc(m.subject)}</div>
            <div class="msg-preview">${esc(m.snippet)}</div>
            ${tags.length ? `<div class="msg-tags">${tags.map((t) => `<span class="tag-chip" style="border-color:${avatarColor(t.name)};color:${avatarColor(t.name)};">${esc(t.name)}</span>`).join('')}</div>` : ''}
          </div>
        </div>`;
    }).join('');
  }

  // Builds the full document injected into the reader's sandboxed iframe.
  // cid: inline images resolve to data URIs directly. A soft "invert twice"
  // trick darkens the email's own light background/text without touching
  // photos: the whole page gets inverted, then media elements get the same
  // filter applied a second time, which cancels back out to their real
  // colors (two inversions = identity) while text/background stay dark.
  function buildRenderableHtml(c) {
    let html = c.bodyHtml || '';

    (c.images || []).filter((i) => i.type === 'inline').forEach((img) => {
      const re = new RegExp(`cid:${img.cid.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'gi');
      html = html.replace(re, img.inlineData ? `data:${img.mimeType};base64,${b64urlToB64(img.inlineData)}` : '');
    });

    // In dark mode the email's own light background/text gets darkened via a
    // soft "invert twice" trick: the whole page is inverted, then media
    // elements get the same filter applied a second time, which cancels back
    // out to their real colors (two inversions = identity) while text/background
    // stay dark. In light mode the email already looks native, so skip it.
    const dark = effectiveTheme() === 'dark';
    const style = dark
      ? `html { background: #1a1a1a; }
         body { margin: 0; padding: 16px; font-family: -apple-system, "Segoe UI", Arial, sans-serif; word-wrap: break-word; background: #fff !important; filter: invert(0.9) hue-rotate(180deg) !important; }
         img, svg, video, picture { filter: invert(0.9) hue-rotate(180deg) !important; }
         img { max-width: 100%; }
         a { color: #1a73e8; }`
      : `html { background: #fff; }
         body { margin: 0; padding: 16px; font-family: -apple-system, "Segoe UI", Arial, sans-serif; word-wrap: break-word; }
         img { max-width: 100%; }
         a { color: #1a73e8; }`;

    return `<!DOCTYPE html><html><head><meta charset="utf-8"><base target="_blank">
      <style>${style}</style></head><body>${html}</body></html>`;
  }

  function renderHtmlBody(c) {
    return `<iframe class="reader-html" sandbox="allow-popups" srcdoc="${esc(buildRenderableHtml(c))}"></iframe>`;
  }

  function renderReader() {
    if (state.currentLoading) return '<div class="center-msg">loading message…</div>';
    const c = state.current;
    if (!c) return '<div class="center-msg">(no message selected)</div>';
    const tags = userTagsFor(c.labelIds);
    const available = availableTagsFor(c.labelIds);
    const restoreCtx = !state.isSearch && (state.activeFolderId === 'TRASH' || state.activeFolderId === ARCHIVE_FOLDER_ID);
    const headerIcons = restoreCtx
      ? `<div class="reader-header-actions">
           <div class="reader-icon-btn" id="icon-restore" title="${state.activeFolderId === 'TRASH' ? 'Restore' : 'Move to Inbox'}">${ICON_RESTORE}</div>
         </div>`
      : `<div class="reader-header-actions">
           <div class="reader-icon-btn" id="icon-archive" title="Archive">${ICON_ARCHIVE}</div>
           <div class="reader-icon-btn" id="icon-trash" title="Delete">${ICON_TRASH}</div>
         </div>`;
    return `
      <div class="reader-header">
        ${headerIcons}
        <div class="reader-subject">${esc(c.subject)}</div>
        <div class="reader-meta">
          <div><span class="k">From:</span> ${esc(c.sender)} &lt;${esc(c.email)}&gt;</div>
          <div><span class="k">To:</span> ${esc(state.email)}</div>
          <div><span class="k">Date:</span> ${esc(formatFullDate(c.date))}</div>
        </div>
        <div class="reader-labels">
          ${tags.map((t) => `
            <span class="label-chip" style="border-color:${avatarColor(t.name)};color:${avatarColor(t.name)};">
              ${esc(t.name)} <span class="label-remove" data-id="${esc(t.id)}">&times;</span>
            </span>`).join('')}
          <span class="tag-toggle" id="tag-toggle">[t] + tag</span>
        </div>
        ${state.tagPickerOpen ? `
          <div class="tag-picker">
            ${available.map((l) => `<div class="tag-picker-row" data-id="${esc(l.id)}">${esc(l.name)}</div>`).join('')}
            ${available.length === 0 ? '<div class="tag-picker-empty">(no more existing labels)</div>' : ''}
            <div class="tag-picker-new">
              <span>+</span>
              <input id="tag-new-input" placeholder="new tag name… (Enter to create + apply)" value="${esc(state.tagInput)}">
            </div>
          </div>` : ''}
      </div>
      ${c.bodyHtml ? renderHtmlBody(c) : `<div class="reader-body">${esc(c.body)}</div>`}
      ${c.attachments && c.attachments.length ? `
        <div class="reader-attachments">
          <div class="attach-title">Attachments</div>
          ${c.attachments.map((a, i) => `
            <div class="attachment-row" data-idx="${i}">
              <span>&#128206; ${esc(a.filename)}</span>
              <span class="attach-size">${esc(formatSize(a.size))}</span>
              <span class="attach-save">[s] Save</span>
            </div>`).join('')}
        </div>` : ''}
      ${(() => {
        if (restoreCtx) {
          const label = state.activeFolderId === 'TRASH' ? '[u] Restore' : '[u] Move to Inbox';
          return `
      <div class="reader-actions">
        <div class="act-btn primary" id="btn-reply">[r] Reply</div>
        <div class="act-btn" id="btn-restore">${label}</div>
      </div>`;
        }
        return `
      <div class="reader-actions">
        <div class="act-btn primary" id="btn-reply">[r] Reply</div>
        <div class="act-btn" id="btn-archive">[a] Archive</div>
        <div class="act-btn" id="btn-delete">[d] Delete</div>
      </div>`;
      })()}`;
  }

  function renderCompose() {
    const cm = state.compose;
    return `
      <div class="compose-header">New Message</div>
      <div class="compose-fields">
        <div class="compose-field">
          <span class="flabel">To:</span>
          <input id="compose-to" value="${esc(cm.to)}">
        </div>
        <div class="compose-field">
          <span class="flabel">Subject:</span>
          <input id="compose-subject" value="${esc(cm.subject)}">
          ${cm.subject.trim() ? `<span class="ai-icon ${state.aiBusy ? 'busy' : ''}" id="ai-draft-btn" title="Draft with AI">${state.aiBusy ? '[ ... ]' : '[ AI ]'}</span>` : ''}
        </div>
        <textarea id="compose-body" class="compose-body">${esc(cm.body)}</textarea>
        ${cm.attachments.length ? `
          <div class="compose-attachments">
            ${cm.attachments.map((a, i) => `
              <div class="attach-chip" data-idx="${i}">
                <span>&#128206; ${esc(a.name)} <span class="attach-size">${esc(formatSize(a.size))}</span></span>
                <span class="attach-remove" data-idx="${i}">&times;</span>
              </div>`).join('')}
          </div>` : ''}
      </div>
      <div class="reader-actions">
        <div class="act-btn primary" id="btn-send" style="background:var(--accent);color:var(--btn-fg-on-accent);">[Ctrl+S] Send</div>
        <div class="act-btn" id="btn-attach">[+] Attach</div>
        <div class="act-btn" id="btn-discard">[Esc] Discard</div>
      </div>`;
  }

  function wireReader() {
    const reply = document.getElementById('btn-reply');
    const archive = document.getElementById('btn-archive');
    const del = document.getElementById('btn-delete');
    const restore = document.getElementById('btn-restore');
    if (reply) reply.addEventListener('click', doReply);
    if (archive) archive.addEventListener('click', doArchive);
    if (del) del.addEventListener('click', doDelete);
    if (restore) restore.addEventListener('click', doRestore);
    const iconArchive = document.getElementById('icon-archive');
    const iconTrash = document.getElementById('icon-trash');
    const iconRestore = document.getElementById('icon-restore');
    if (iconArchive) iconArchive.addEventListener('click', doArchive);
    if (iconTrash) iconTrash.addEventListener('click', doDelete);
    if (iconRestore) iconRestore.addEventListener('click', doRestore);
    root.querySelectorAll('.attachment-row').forEach((el) => {
      el.addEventListener('click', () => saveAttachment(Number(el.dataset.idx)));
    });

    const tagToggle = document.getElementById('tag-toggle');
    if (tagToggle) tagToggle.addEventListener('click', toggleTagPicker);
    root.querySelectorAll('.label-remove').forEach((el) => {
      el.addEventListener('click', (ev) => {
        ev.stopPropagation();
        removeTag(el.dataset.id);
      });
    });
    root.querySelectorAll('.tag-picker-row').forEach((el) => {
      el.addEventListener('click', () => applyTag(el.dataset.id));
    });
    const tagInput = document.getElementById('tag-new-input');
    if (tagInput) {
      tagInput.focus();
      tagInput.addEventListener('input', () => { state.tagInput = tagInput.value; });
      tagInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && tagInput.value.trim()) createAndApplyTag(tagInput.value.trim());
        else if (e.key === 'Escape') { state.tagPickerOpen = false; render(); }
      });
    }
  }

  function wireCompose() {
    const to = document.getElementById('compose-to');
    const subj = document.getElementById('compose-subject');
    const body = document.getElementById('compose-body');
    to.addEventListener('input', () => { state.compose.to = to.value; });
    subj.addEventListener('input', () => { state.compose.subject = subj.value; syncAiIcon(); });
    body.addEventListener('input', () => { state.compose.body = body.value; });
    document.getElementById('btn-send').addEventListener('click', doSend);
    document.getElementById('btn-discard').addEventListener('click', doDiscard);
    document.getElementById('btn-attach').addEventListener('click', pickAttachments);
    const aiBtn = document.getElementById('ai-draft-btn');
    if (aiBtn) aiBtn.addEventListener('click', doAiDraft);
    root.querySelectorAll('.attach-remove').forEach((el) => {
      el.addEventListener('click', (ev) => {
        ev.stopPropagation();
        state.compose.attachments.splice(Number(el.dataset.idx), 1);
        render();
      });
    });
    (cm_focus_target(state.compose) || to).focus();
  }

  function cm_focus_target(cm) {
    if (!cm.to) return document.getElementById('compose-to');
    if (!cm.subject) return document.getElementById('compose-subject');
    return document.getElementById('compose-body');
  }

  // Adds/removes the AI icon next to Subject as it goes from empty to
  // non-empty (and back), without a full re-render — a full render would
  // rebuild the compose pane and steal focus out of the field being typed in.
  function syncAiIcon() {
    const field = document.getElementById('compose-subject');
    if (!field) return;
    const shouldShow = state.compose.subject.trim().length > 0 && !state.aiBusy;
    let icon = document.getElementById('ai-draft-btn');
    if (shouldShow && !icon) {
      icon = document.createElement('span');
      icon.id = 'ai-draft-btn';
      icon.className = 'ai-icon';
      icon.title = 'Draft with AI';
      icon.textContent = '[ AI ]';
      icon.addEventListener('click', doAiDraft);
      field.insertAdjacentElement('afterend', icon);
    } else if (!shouldShow && icon) {
      icon.remove();
    }
  }

  async function doAiDraft() {
    if (state.aiBusy) return;
    const cm = state.compose;
    if (!cm.subject.trim()) return;
    const st = await window.api.aiStatus();
    if (!st.configured) {
      state.statusRight = 'No AI detected';
      render();
      return;
    }
    state.aiBusy = true;
    state.statusRight = 'asking AI…';
    render();
    try {
      const res = await window.api.aiDraft({ subject: cm.subject, context: cm.replyContext || '' });
      if (res.ok) {
        state.compose.body = res.text + (state.compose.body ? '\n\n' + state.compose.body : '');
        state.statusRight = 'AI draft added';
      } else {
        state.statusRight = 'AI draft failed: ' + res.error;
      }
    } catch (e) {
      state.statusRight = 'AI draft failed: ' + e.message;
    }
    state.aiBusy = false;
    render();
  }

  // ---------- actions ----------

  async function init() {
    render();
    await loadGoogleConfig();
    const status = state.googleConfig.hasConfig ? await window.api.authStatus() : { signedIn: false };
    if (status.signedIn) {
      state.email = status.email;
      state.screen = 'app';
      render();
      await loadFolders();
    } else {
      state.screen = 'login';
      render();
    }
  }

  async function doLogin() {
    if (state.loginBusy) return;
    state.loginBusy = true;
    state.loginError = '';
    render();
    const res = await window.api.login();
    state.loginBusy = false;
    if (res.ok) {
      state.email = res.email;
      state.screen = 'app';
      render();
      await loadFolders();
    } else {
      state.loginError = res.error || 'sign-in failed';
      render();
    }
  }

  async function doLogout() {
    await window.api.logout().catch(() => {});
    state.screen = 'login';
    state.email = '';
    state.folders = [];
    state.allLabels = [];
    state.activeFolderId = null;
    state.activeFolderName = '';
    state.isSearch = false;
    state.searchQuery = '';
    state.messages = [];
    state.selectionByFolder = {};
    state.current = null;
    state.mode = 'read';
    state.compose = emptyCompose();
    state.nextPageToken = null;
    render();
  }

  async function loadFolders() {
    state.listLoading = true;
    render();
    try {
      state.folders = await window.api.listLabels();
      if (!state.activeFolderId) {
        const inbox = state.folders.find((f) => f.id === 'INBOX');
        state.activeFolderId = inbox ? inbox.id : (state.folders[0] && state.folders[0].id);
        state.activeFolderName = inbox ? inbox.name : (state.folders[0] && state.folders[0].name) || '';
      }
      state.allLabels = await window.api.listAllLabels();
    } catch (e) {
      state.statusRight = 'error loading folders';
    }
    state.listLoading = false;
    await loadMessages(state.activeFolderId);
  }

  async function selectFolder(id) {
    if (state.mode === 'compose') return;
    const f = state.folders.find((x) => x.id === id);
    state.activeFolderId = id;
    state.activeFolderName = f ? f.name : id;
    state.isSearch = false;
    state.mode = 'read';
    await loadMessages(id);
  }

  async function loadMessages(id) {
    state.listLoading = true;
    state.current = null;
    state.nextPageToken = null;
    render();
    try {
      const res = await window.api.listMessages(id, state.pageSize);
      state.messages = res.messages;
      state.nextPageToken = res.nextPageToken;
    } catch (e) {
      state.messages = [];
      state.statusRight = 'error loading messages';
    }
    state.listLoading = false;
    render();
    await loadCurrentDetail();
  }

  async function runSearch(query) {
    if (!query.trim()) return;
    state.isSearch = true;
    state.searchQuery = query;
    state.searchOpen = false;
    state.listLoading = true;
    state.current = null;
    state.nextPageToken = null;
    render();
    try {
      const res = await window.api.searchMessages(query, state.pageSize);
      state.messages = res.messages;
      state.nextPageToken = res.nextPageToken;
    } catch (e) {
      state.messages = [];
    }
    state.listLoading = false;
    render();
    await loadCurrentDetail();
  }

  async function loadMoreMessages() {
    if (!state.nextPageToken || state.loadingMore) return;
    state.loadingMore = true;
    render();
    try {
      const res = state.isSearch
        ? await window.api.searchMessages(state.searchQuery, state.pageSize, state.nextPageToken)
        : await window.api.listMessages(state.activeFolderId, state.pageSize, state.nextPageToken);
      state.messages = state.messages.concat(res.messages);
      state.nextPageToken = res.nextPageToken;
    } catch (e) {
      state.statusRight = 'error loading more';
    }
    state.loadingMore = false;
    render();
  }

  async function selectMessage(id) {
    if (!state.isSearch) state.selectionByFolder[state.activeFolderId] = id;
    else state.selectionByFolder['__search__'] = id;
    state.mode = 'read';
    render();
    await loadCurrentDetail();
  }

  async function loadCurrentDetail() {
    const id = selectedId();
    if (!id) { state.current = null; render(); return; }
    state.currentLoading = true;
    const reader = document.getElementById('reader-pane');
    if (reader) reader.innerHTML = renderReader();
    try {
      const full = await window.api.getMessage(id);
      state.current = full;
      const stub = state.messages.find((m) => m.id === id);
      if (stub && stub.unread) {
        stub.unread = false;
        window.api.markRead(id).catch(() => {});
        const folder = state.folders.find((f) => f.id === state.activeFolderId);
        if (folder && folder.unread > 0) folder.unread -= 1;
      }
    } catch (e) {
      state.current = null;
    }
    state.currentLoading = false;
    render();
  }

  function openCompose(prefill) {
    state.mode = 'compose';
    state.compose = prefill ? { ...emptyCompose(), ...prefill } : emptyCompose();
    render();
  }

  function doReply() {
    const c = state.current;
    if (!c) return;
    const subject = /^re:/i.test(c.subject) ? c.subject : `Re: ${c.subject}`;
    const quoted = (c.body || '').split('\n').map((l) => `> ${l}`).join('\n');
    openCompose({
      to: c.email,
      subject,
      body: `\n\nOn ${formatFullDate(c.date)}, ${c.sender} wrote:\n${quoted}`,
      threadId: c.threadId,
      inReplyTo: c.messageIdHeader,
      references: [c.references, c.messageIdHeader].filter(Boolean).join(' '),
      replyContext: c.body || '',
    });
  }

  async function pickAttachments() {
    const picked = await window.api.pickAttachments();
    if (!picked || !picked.length) return;
    const existing = new Set(state.compose.attachments.map((a) => a.path));
    for (const p of picked) if (!existing.has(p.path)) state.compose.attachments.push(p);
    render();
  }

  async function saveAttachment(idx) {
    const c = state.current;
    if (!c || !c.attachments || !c.attachments[idx]) return;
    const a = c.attachments[idx];
    state.statusRight = 'saving…';
    render();
    try {
      const res = await window.api.downloadAttachment(c.id, a.attachmentId, a.inlineData, a.filename);
      state.statusRight = res.ok ? `saved ${a.filename}` : (res.canceled ? '' : 'save failed');
    } catch (e) {
      state.statusRight = 'save failed: ' + e.message;
    }
    render();
  }

  function inTrashOrArchived() {
    return !state.isSearch && (state.activeFolderId === 'TRASH' || state.activeFolderId === ARCHIVE_FOLDER_ID);
  }

  async function doArchive() {
    if (inTrashOrArchived()) return; // no "archive" concept there — use Restore instead
    const id = selectedId();
    if (!id) return;
    try { await window.api.archive(id); } catch (e) {}
    removeCurrentFromList();
  }

  async function doDelete() {
    if (!state.isSearch && state.activeFolderId === 'TRASH') return; // permanent delete is Empty Trash now
    const id = selectedId();
    if (!id) return;
    try { await window.api.trash(id); } catch (e) {}
    removeCurrentFromList();
  }

  async function doRestore() {
    if (!inTrashOrArchived()) return;
    const id = selectedId();
    if (!id) return;
    try {
      if (state.activeFolderId === 'TRASH') await window.api.untrash(id);
      else await window.api.modifyLabels(id, ['INBOX'], []);
    } catch (e) {
      state.statusRight = 'restore failed: ' + e.message;
      render();
      return;
    }
    removeCurrentFromList();
  }

  function doEmptyTrash() {
    showConfirm({
      title: 'Empty Trash?',
      message: 'This permanently deletes every message in Trash. This cannot be undone.',
      confirmLabel: 'Empty Trash',
      dontAskKey: 'empty_trash',
      onConfirm: emptyTrashConfirmed,
    });
  }

  async function emptyTrashConfirmed() {
    state.statusRight = 'emptying trash…';
    render();
    try {
      const n = await window.api.emptyTrash();
      state.statusRight = `emptied trash (${n})`;
      if (!state.isSearch && state.activeFolderId === 'TRASH') {
        state.messages = [];
        state.current = null;
      }
      const folder = state.folders.find((f) => f.id === 'TRASH');
      if (folder) folder.unread = 0;
    } catch (e) {
      state.statusRight = 'empty trash failed: ' + e.message;
    }
    render();
  }

  function removeCurrentFromList() {
    const id = selectedId();
    state.messages = state.messages.filter((m) => m.id !== id);
    delete state.selectionByFolder[state.activeFolderId];
    state.current = null;
    render();
    loadCurrentDetail();
  }

  function toggleTagPicker() {
    if (!state.current) return;
    state.tagPickerOpen = !state.tagPickerOpen;
    state.tagInput = '';
    render();
  }

  function syncLabelIdsInList(id, labelIds) {
    const stub = state.messages.find((m) => m.id === id);
    if (stub) stub.labelIds = labelIds;
  }

  async function applyTag(labelId) {
    const c = state.current;
    if (!c) return;
    try {
      await window.api.modifyLabels(c.id, [labelId], []);
      c.labelIds = [...(c.labelIds || []), labelId];
      syncLabelIdsInList(c.id, c.labelIds);
      state.tagPickerOpen = false;
    } catch (e) {
      state.statusRight = 'tag failed: ' + e.message;
    }
    render();
  }

  async function removeTag(labelId) {
    const c = state.current;
    if (!c) return;
    try {
      await window.api.modifyLabels(c.id, [], [labelId]);
      c.labelIds = (c.labelIds || []).filter((id) => id !== labelId);
      syncLabelIdsInList(c.id, c.labelIds);
    } catch (e) {
      state.statusRight = 'untag failed: ' + e.message;
    }
    render();
  }

  async function createAndApplyTag(name) {
    try {
      const existing = state.allLabels.find((l) => l.type === 'user' && l.name.toLowerCase() === name.toLowerCase());
      const label = existing || await window.api.createLabel(name);
      if (!existing) state.allLabels.push(label);
      const folder = state.folders.find((f) => f.id === label.id);
      if (!folder) state.folders.push({ id: label.id, name: label.name, unread: 0 });
      await applyTag(label.id);
    } catch (e) {
      state.statusRight = 'create tag failed: ' + e.message;
      render();
    }
  }

  async function markAllReadCurrentFolder() {
    if (state.isSearch || !state.activeFolderId) return;
    const folder = state.folders.find((f) => f.id === state.activeFolderId);
    if (!folder || !folder.unread) {
      state.statusRight = 'nothing unread here';
      render();
      return;
    }
    state.statusRight = 'marking all read…';
    render();
    try {
      await window.api.markAllRead(state.activeFolderId);
      state.messages.forEach((m) => { m.unread = false; });
      folder.unread = 0;
      state.statusRight = 'all read';
    } catch (e) {
      state.statusRight = 'mark-all-read failed: ' + e.message;
    }
    render();
  }

  async function doSend() {
    const cm = state.compose;
    if (!cm.to.trim() || !cm.subject.trim()) {
      state.statusRight = 'to/subject required';
      render();
      return;
    }
    state.statusRight = 'sending…';
    render();
    try {
      await window.api.send({
        to: cm.to, subject: cm.subject, body: cm.body,
        threadId: cm.threadId, inReplyTo: cm.inReplyTo, references: cm.references,
        attachments: cm.attachments,
      });
      state.statusRight = 'sent';
    } catch (e) {
      state.statusRight = 'send failed: ' + e.message;
    }
    state.mode = 'read';
    state.compose = emptyCompose();
    render();
  }

  function doDiscard() {
    state.mode = 'read';
    state.compose = emptyCompose();
    render();
  }

  function moveSelection(dir) {
    if (state.mode === 'compose' || state.messages.length === 0) return;
    const idx = selectedIndex();
    const next = Math.max(0, Math.min(state.messages.length - 1, idx + dir));
    const id = state.messages[next].id;
    if (!state.isSearch) state.selectionByFolder[state.activeFolderId] = id;
    else state.selectionByFolder['__search__'] = id;
    render();
    // render() rebuilds the whole message list from scratch every time, which
    // resets its scroll position — without this, the highlighted row moves
    // conceptually but can end up scrolled out of view (the list itself
    // never appears to follow the selection).
    const activeRow = document.querySelector('#msg-list .msg-row.active');
    if (activeRow) activeRow.scrollIntoView({ block: 'nearest' });
    loadCurrentDetail();
  }

  // ---------- global keyboard ----------

  window.addEventListener('keydown', (e) => {
    const tag = (e.target && e.target.tagName) || '';
    const inField = tag === 'INPUT' || tag === 'TEXTAREA';

    if (state.screen === 'login') {
      if (e.key === 'Enter' && state.googleConfig.hasConfig && !inField) doLogin();
      return;
    }
    if (state.screen !== 'app') return;

    if (state.confirmModal) {
      if (e.key === 'Escape') closeConfirm();
      return;
    }

    if (state.settingsOpen) {
      if (e.key === 'Escape') closeSettings();
      return;
    }

    if (inField) {
      if (state.mode === 'compose' && (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        doSend();
        return;
      }
      if (state.mode === 'compose' && e.key === 'Escape') {
        doDiscard();
        return;
      }
      return;
    }

    if (e.ctrlKey && e.code === 'Space') {
      e.preventDefault();
      state.searchOpen = !state.searchOpen;
      render();
      return;
    }

    if (state.mode === 'compose') {
      if (e.key === 'Escape') doDiscard();
      return;
    }

    if (e.key === 'j' || e.key === 'ArrowDown') { e.preventDefault(); moveSelection(1); }
    else if (e.key === 'k' || e.key === 'ArrowUp') { e.preventDefault(); moveSelection(-1); }
    else if (e.key === 'c') openCompose();
    else if (e.key === 'r') doReply();
    else if (e.key === 'a') doArchive();
    else if (e.key === 'd') doDelete();
    else if (e.key === 'u') doRestore();
    else if (e.key === 't') toggleTagPicker();
    else if (e.key === 'w') markAllReadCurrentFolder();
    else if (e.key === ',') openSettings();
    else if (e.key === 'q') window.api.close();
    else if (e.key === 'Escape' && state.tagPickerOpen) { state.tagPickerOpen = false; render(); }
    else if (e.key === 'Escape' && state.searchOpen) { state.searchOpen = false; render(); }
  });

  setInterval(() => { if (state.screen === 'app' && state.mode !== 'compose') render(); }, 30000);

  init();
})();
