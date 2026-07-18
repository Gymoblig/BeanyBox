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

  function formatRelative(dateStr) {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '';
    const now = new Date();
    const startOf = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate());
    const diffDays = Math.round((startOf(now) - startOf(d)) / 86400000);
    if (diffDays === 0) {
      let h = d.getHours();
      const m = String(d.getMinutes()).padStart(2, '0');
      const ap = h >= 12 ? 'p' : 'a';
      h = h % 12; if (h === 0) h = 12;
      return `${h}:${m}${ap}`;
    }
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
    let h = d.getHours();
    const m = String(d.getMinutes()).padStart(2, '0');
    const ap = h >= 12 ? 'PM' : 'AM';
    h = h % 12; if (h === 0) h = 12;
    return `${WD[d.getDay()]}, ${MO[d.getMonth()]} ${d.getDate()} ${d.getFullYear()}, ${h}:${m} ${ap}`;
  }

  function clockLabel() {
    const d = new Date();
    return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
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
    return { to: '', subject: '', body: '', threadId: null, inReplyTo: null, references: null, attachments: [] };
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
  };

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
    renderModal();
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

  function renderModal() {
    const m = state.confirmModal;
    if (!m) { modalRoot.innerHTML = ''; return; }
    modalRoot.innerHTML = `
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
    document.getElementById('modal-overlay').addEventListener('click', (e) => {
      if (e.target.id === 'modal-overlay') closeConfirm();
    });
    document.getElementById('modal-cancel').addEventListener('click', closeConfirm);
    document.getElementById('modal-confirm').addEventListener('click', confirmModalAccept);
    document.getElementById('modal-dontask').addEventListener('change', (e) => {
      state.confirmModal.dontAskChecked = e.target.checked;
    });
  }

  function renderLogin() {
    root.innerHTML = `
      <div class="login-wrap">
        <div class="login-box">
          <div class="login-title">&#10095; BeanyBox login</div>
          <div class="login-sub">Gmail &middot; GreenyBeany's TUI client v1.0.0</div>
          <div class="login-desc">Sign in with your Google account. A browser window will open for Google's sign-in and consent screen — BeanyBox never sees your password.</div>
          ${state.loginError ? `<div class="login-error">! ${esc(state.loginError)}</div>` : ''}
          <div class="login-btn ${state.loginBusy ? 'busy' : ''}" id="login-btn">
            ${state.loginBusy ? 'Waiting for browser…' : '[Enter] Sign in with Google'}
          </div>
        </div>
      </div>`;
    const btn = document.getElementById('login-btn');
    btn.addEventListener('click', doLogin);
  }

  function renderApp() {
    const folderLabel = state.isSearch ? `Search: ${state.searchQuery}` : state.activeFolderName;
    const unreadTotal = state.folders.reduce((s, f) => s + (f.unread || 0), 0);
    const isTrash = !state.isSearch && state.activeFolderId === 'TRASH';

    root.innerHTML = `
      <div class="statusbar-top">
        <div class="left">
          <span class="acct">&#9670; ${esc(state.email)}</span>
          <span class="signout-btn" id="signout-btn">[sign out]</span>
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
          <div class="sidebar-footer">v1.0.0-tui &middot; ${state.listLoading ? 'syncing…' : 'sync ok'}</div>
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
          <span>[Ctrl+Space] search</span><span>|</span><span>[q] quit</span>
        </div>
        <div>${state.statusRight || unreadTotal + ' unread'}</div>
      </div>
    `;

    document.getElementById('signout-btn').addEventListener('click', doLogout);
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
    return state.messages.map((m) => {
      const active = m.id === selId;
      const color = avatarColor(m.sender || m.email || '?');
      const senderColor = active ? '#ff5c5c' : (m.unread ? '#e8e8e8' : '#9a9a9a');
      const subjColor = active ? '#e8e8e8' : (m.unread ? '#d0d0d0' : '#8a8a8a');
      const weight = m.unread ? 600 : 400;
      const mark = m.unread ? '● ' : '○ ';
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

    return `<!DOCTYPE html><html><head><meta charset="utf-8"><base target="_blank">
      <style>
        html { background: #1a1a1a; }
        body { margin: 0; padding: 16px; font-family: -apple-system, "Segoe UI", Arial, sans-serif; word-wrap: break-word; background: #fff !important; filter: invert(0.9) hue-rotate(180deg) !important; }
        img, svg, video, picture { filter: invert(0.9) hue-rotate(180deg) !important; }
        img { max-width: 100%; }
        a { color: #1a73e8; }
      </style></head><body>${html}</body></html>`;
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
    return `
      <div class="reader-header">
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
        const restoreCtx = !state.isSearch && (state.activeFolderId === 'TRASH' || state.activeFolderId === ARCHIVE_FOLDER_ID);
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
        <div class="act-btn primary" id="btn-send" style="background:#ff5c5c;color:#000;">[Ctrl+S] Send</div>
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
    subj.addEventListener('input', () => { state.compose.subject = subj.value; });
    body.addEventListener('input', () => { state.compose.body = body.value; });
    document.getElementById('btn-send').addEventListener('click', doSend);
    document.getElementById('btn-discard').addEventListener('click', doDiscard);
    document.getElementById('btn-attach').addEventListener('click', pickAttachments);
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

  // ---------- actions ----------

  async function init() {
    render();
    const status = await window.api.authStatus();
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
    loadCurrentDetail();
  }

  // ---------- global keyboard ----------

  window.addEventListener('keydown', (e) => {
    const tag = (e.target && e.target.tagName) || '';
    const inField = tag === 'INPUT' || tag === 'TEXTAREA';

    if (state.screen === 'login') {
      if (e.key === 'Enter') doLogin();
      return;
    }
    if (state.screen !== 'app') return;

    if (state.confirmModal) {
      if (e.key === 'Escape') closeConfirm();
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
    else if (e.key === 'q') window.api.close();
    else if (e.key === 'Escape' && state.tagPickerOpen) { state.tagPickerOpen = false; render(); }
    else if (e.key === 'Escape' && state.searchOpen) { state.searchOpen = false; render(); }
  });

  setInterval(() => { if (state.screen === 'app' && state.mode !== 'compose') render(); }, 30000);

  init();
})();
