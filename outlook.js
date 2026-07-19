const { mapLimit } = require('./util');
const { stripHtml, extractImgSrcs, sanitizeForRender } = require('./mail-html');

const GRAPH_BASE = 'https://graph.microsoft.com/v1.0';

// Gmail's system labels double as both sidebar folders and Graph API ids
// ('INBOX', 'TRASH') that renderer.js/main.js hardcode-compare against, plus
// a synthetic '__ARCHIVE__' pseudo-folder since Gmail has no real archive.
// Outlook actually has a real Archive folder, and Graph addresses standard
// folders by well-known name directly (no id lookup needed) — so instead of
// touching anything above this file, we alias those same literal ids to the
// matching well-known Graph folder name here. Only these 5 standard folders
// are shown; arbitrary custom Outlook folders are out of scope.
const FOLDERS = [
  { id: 'INBOX', graph: 'inbox', name: 'Inbox' },
  { id: '__ARCHIVE__', graph: 'archive', name: 'Archived' },
  { id: 'sentitems', graph: 'sentitems', name: 'Sent' },
  { id: 'drafts', graph: 'drafts', name: 'Drafts' },
  { id: 'TRASH', graph: 'deleteditems', name: 'Trash' },
];

const MESSAGE_SELECT = 'id,subject,from,receivedDateTime,bodyPreview,isRead,categories,internetMessageId';

function toGraphFolder(id) {
  const f = FOLDERS.find((x) => x.id === id);
  return f ? f.graph : id;
}

// Outlook categories (message.categories: string[], identified by display
// name) stand in for Gmail's taggable user labels — they're not folders, so
// unlike Gmail's labelIds they never influence which folder a message is in.
function parseGraphMessage(msg, attachments) {
  const list = attachments || [];
  const from = (msg.from && msg.from.emailAddress) || {};
  const fileAttachments = list.filter((a) => a.contentBytes != null);

  const inlineByContentId = {};
  fileAttachments.forEach((a) => {
    if (a.isInline && a.contentId) {
      inlineByContentId[a.contentId] = { mimeType: a.contentType || 'application/octet-stream', data: a.contentBytes };
    }
  });

  let bodyText = '';
  let bodyHtml = null;
  let images = [];
  const content = msg.body && msg.body.content;
  if (msg.body && msg.body.contentType === 'html' && content) {
    bodyHtml = sanitizeForRender(content);
    bodyText = stripHtml(content);
    images = extractImgSrcs(content)
      .map((src) => {
        if (/^cid:/i.test(src)) {
          const part = inlineByContentId[src.slice(4)];
          return part ? { type: 'inline', cid: src.slice(4), mimeType: part.mimeType, attachmentId: null, inlineData: part.data } : null;
        }
        if (/^https?:\/\//i.test(src)) return { type: 'remote', src };
        return null;
      })
      .filter(Boolean);
  } else if (content) {
    bodyText = content;
  } else {
    bodyText = msg.bodyPreview || '(no body)';
  }

  return {
    id: msg.id,
    threadId: msg.id,
    labelIds: msg.categories || [],
    unread: msg.isRead === false,
    sender: from.name || from.address || '',
    email: from.address || '',
    subject: msg.subject || '(no subject)',
    date: msg.receivedDateTime || '',
    to: '',
    messageIdHeader: msg.internetMessageId || '',
    references: null,
    snippet: msg.bodyPreview || '',
    body: bodyText,
    bodyHtml,
    images,
    attachments: fileAttachments
      .filter((a) => !a.isInline)
      .map((a) => ({
        filename: a.name,
        mimeType: a.contentType || 'application/octet-stream',
        size: a.size || 0,
        attachmentId: a.id,
        inlineData: a.contentBytes || null,
      })),
  };
}

class OutlookClient {
  constructor(authClient) {
    this.auth = authClient; // { getAccessToken() }
  }

  async request(pathOrUrl, options = {}) {
    const url = pathOrUrl.startsWith('http') ? pathOrUrl : `${GRAPH_BASE}${pathOrUrl}`;
    const token = await this.auth.getAccessToken();
    const res = await fetch(url, {
      ...options,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        ...(options.headers || {}),
      },
    });
    const text = await res.text();
    const data = text ? JSON.parse(text) : null;
    if (!res.ok) {
      throw new Error((data && data.error && data.error.message) || `Graph request failed (${res.status})`);
    }
    return data;
  }

  async listAllMessageIds(graphFolder, filter) {
    let ids = [];
    let url = `/me/mailFolders/${graphFolder}/messages?$top=200&$select=id${filter ? `&$filter=${encodeURIComponent(filter)}` : ''}`;
    while (url) {
      const data = await this.request(url);
      ids = ids.concat((data.value || []).map((m) => m.id));
      url = data['@odata.nextLink'] || null;
    }
    return ids;
  }

  async getProfile() {
    const me = await this.request('/me?$select=mail,userPrincipalName');
    return { emailAddress: me.mail || me.userPrincipalName };
  }

  async listLabels() {
    return mapLimit(FOLDERS, 5, async (f) => {
      try {
        const folder = await this.request(`/me/mailFolders/${f.graph}`);
        return { id: f.id, name: f.name, unread: folder.unreadItemCount || 0 };
      } catch (e) {
        return { id: f.id, name: f.name, unread: 0 };
      }
    });
  }

  async listMessages(labelId, maxResults = 30, pageToken) {
    const data = pageToken
      ? await this.request(pageToken)
      : await this.request(`/me/mailFolders/${toGraphFolder(labelId)}/messages?$top=${maxResults}&$orderby=receivedDateTime desc&$select=${MESSAGE_SELECT}`);
    return { messages: (data.value || []).map((m) => parseGraphMessage(m)), nextPageToken: data['@odata.nextLink'] || null };
  }

  async searchMessages(query, maxResults = 30, pageToken) {
    if (pageToken) {
      const data = await this.request(pageToken);
      return { messages: (data.value || []).map((m) => parseGraphMessage(m)), nextPageToken: data['@odata.nextLink'] || null };
    }
    const params = new URLSearchParams();
    params.set('$search', `"${query.replace(/"/g, '\\"')}"`);
    params.set('$top', String(maxResults));
    params.set('$select', MESSAGE_SELECT);
    const data = await this.request(`/me/messages?${params.toString()}`);
    return { messages: (data.value || []).map((m) => parseGraphMessage(m)), nextPageToken: data['@odata.nextLink'] || null };
  }

  async getMessage(id) {
    const [msg, attachmentsRes] = await Promise.all([
      this.request(`/me/messages/${id}?$select=${MESSAGE_SELECT},body`),
      this.request(`/me/messages/${id}/attachments`).catch(() => ({ value: [] })),
    ]);
    return parseGraphMessage(msg, attachmentsRes.value || []);
  }

  async getAttachmentData(messageId, attachmentId) {
    const res = await this.request(`/me/messages/${messageId}/attachments/${attachmentId}`);
    return res.contentBytes; // standard base64 — the base64url replace main.js applies is a harmless no-op here
  }

  async markRead(id) {
    await this.request(`/me/messages/${id}`, { method: 'PATCH', body: JSON.stringify({ isRead: true }) });
  }

  async archive(id) {
    await this.request(`/me/messages/${id}/move`, { method: 'POST', body: JSON.stringify({ destinationId: 'archive' }) });
  }

  async trash(id) {
    await this.request(`/me/messages/${id}/move`, { method: 'POST', body: JSON.stringify({ destinationId: 'deleteditems' }) });
  }

  async untrash(id) {
    await this.request(`/me/messages/${id}/move`, { method: 'POST', body: JSON.stringify({ destinationId: 'inbox' }) });
  }

  // No Graph $batch support here (unlike Gmail's real batchDelete/
  // batchModify, one call for up to 1000 ids) — bulk ops fan out
  // concurrency-limited individual requests instead. Fine for ordinary
  // mailbox sizes, slower for very large trash/unread counts.
  async emptyTrash() {
    const ids = await this.listAllMessageIds('deleteditems');
    await mapLimit(ids, 8, (id) => this.request(`/me/messages/${id}`, { method: 'DELETE' }));
    return ids.length;
  }

  async listAllLabelsRaw() {
    const data = await this.request('/me/outlook/masterCategories');
    return (data.value || []).map((c) => ({ id: c.displayName, name: c.displayName, type: 'user' }));
  }

  async createLabel(name) {
    const preset = `preset${Math.floor(Math.random() * 25)}`;
    const cat = await this.request('/me/outlook/masterCategories', {
      method: 'POST',
      body: JSON.stringify({ displayName: name, color: preset }),
    });
    return { id: cat.displayName, name: cat.displayName, type: 'user' };
  }

  // Categories are a flat string array on the message, not addressable
  // individually like Gmail label ids — read-modify-write.
  async modifyLabels(id, addLabelIds, removeLabelIds) {
    const msg = await this.request(`/me/messages/${id}?$select=categories`);
    const current = new Set(msg.categories || []);
    (addLabelIds || []).forEach((c) => current.add(c));
    (removeLabelIds || []).forEach((c) => current.delete(c));
    await this.request(`/me/messages/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ categories: Array.from(current) }),
    });
  }

  async markAllRead(labelId) {
    const ids = await this.listAllMessageIds(toGraphFolder(labelId), 'isRead eq false');
    await mapLimit(ids, 8, (id) =>
      this.request(`/me/messages/${id}`, { method: 'PATCH', body: JSON.stringify({ isRead: true }) })
    );
    return ids.length;
  }

  // Graph's sendMail takes a plain JSON message — no raw MIME construction
  // needed. inReplyTo/references (Gmail Message-ID header values) don't
  // carry over; the quoted-reply body built by the renderer still does.
  async send({ to, subject, body, attachments }) {
    const message = {
      subject,
      body: { contentType: 'Text', content: body },
      toRecipients: String(to || '')
        .split(',')
        .map((addr) => addr.trim())
        .filter(Boolean)
        .map((address) => ({ emailAddress: { address } })),
    };
    if (attachments && attachments.length) {
      message.attachments = attachments.map((a) => ({
        '@odata.type': '#microsoft.graph.fileAttachment',
        name: a.filename,
        contentType: a.mimeType || 'application/octet-stream',
        contentBytes: a.data,
      }));
    }
    await this.request('/me/sendMail', { method: 'POST', body: JSON.stringify({ message, saveToSentItems: true }) });
  }
}

module.exports = { OutlookClient };
