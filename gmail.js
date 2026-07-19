const { google } = require('googleapis');
const { mapLimit } = require('./util');
const { stripHtml, extractImgSrcs, sanitizeForRender } = require('./mail-html');

function b64urlDecode(str) {
  return Buffer.from(str.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');
}

function b64urlEncode(str) {
  return Buffer.from(str, 'utf8')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function getHeader(headers, name) {
  const h = (headers || []).find((x) => x.name.toLowerCase() === name.toLowerCase());
  return h ? h.value : '';
}

// Images referenced inline via cid: (e.g. photos embedded directly in a
// personal email) live in their own MIME part with a Content-ID header.
// Resolving these needs no extra network request beyond the message itself,
// so unlike remote http(s) images they're safe to render immediately.
function extractInlinePartsByCid(payload) {
  const map = {};
  function walk(part) {
    if (!part) return;
    const cidHeader = (part.headers || []).find((h) => h.name.toLowerCase() === 'content-id');
    if (cidHeader && part.body) {
      const cid = cidHeader.value.replace(/^<|>$/g, '');
      map[cid] = {
        mimeType: part.mimeType || 'application/octet-stream',
        attachmentId: part.body.attachmentId || null,
        data: part.body.attachmentId ? null : part.body.data,
      };
    }
    if (part.parts) part.parts.forEach(walk);
  }
  walk(payload);
  return map;
}

function extractBody(payload) {
  let plain = null;
  let html = null;

  function walk(part) {
    if (!part) return;
    if (part.filename) return; // attachments handled separately
    if (part.mimeType === 'text/plain' && part.body && part.body.data && !plain) {
      plain = b64urlDecode(part.body.data);
    } else if (part.mimeType === 'text/html' && part.body && part.body.data && !html) {
      html = b64urlDecode(part.body.data);
    }
    if (part.parts) part.parts.forEach(walk);
  }
  walk(payload);

  // Plain-text-only messages (no HTML part) keep the old monospace reader.
  // Messages with an HTML part render as real HTML (sandboxed iframe) so
  // styled mail actually looks like it's supposed to — `text` is kept
  // around too, just for reply-quoting.
  if (html) {
    return {
      text: stripHtml(html),
      html: sanitizeForRender(html),
      imageSrcs: extractImgSrcs(html),
    };
  }
  if (plain) return { text: plain, html: null, imageSrcs: [] };
  return { text: '(no body)', html: null, imageSrcs: [] };
}

function resolveImages(imageSrcs, inlineCidMap) {
  return imageSrcs
    .map((src) => {
      if (/^cid:/i.test(src)) {
        const cid = src.slice(4);
        const part = inlineCidMap[cid];
        if (!part) return null;
        return { type: 'inline', cid, mimeType: part.mimeType, attachmentId: part.attachmentId, inlineData: part.data };
      }
      if (/^https?:\/\//i.test(src)) return { type: 'remote', src };
      return null; // data: URIs and anything else we can't safely resolve
    })
    .filter(Boolean);
}

function extractAttachments(payload) {
  const out = [];
  function walk(part) {
    if (!part) return;
    if (part.filename && part.body && (part.body.attachmentId || part.body.data)) {
      out.push({
        filename: part.filename,
        mimeType: part.mimeType || 'application/octet-stream',
        size: part.body.size || 0,
        attachmentId: part.body.attachmentId || null,
        inlineData: part.body.attachmentId ? null : part.body.data,
      });
    }
    if (part.parts) part.parts.forEach(walk);
  }
  walk(payload);
  return out;
}

function sanitizeHeaderValue(str) {
  return String(str || '').replace(/[\r\n]+/g, ' ').trim();
}

function wrapBase64(b64) {
  const lines = [];
  for (let i = 0; i < b64.length; i += 76) lines.push(b64.slice(i, i + 76));
  return lines.join('\r\n');
}

function parseMessage(msg) {
  const headers = msg.payload ? msg.payload.headers : [];
  const from = getHeader(headers, 'From');
  const nameMatch = from.match(/^"?([^"<]*)"?\s*(<.*>)?$/);
  const senderName = (nameMatch && nameMatch[1].trim()) || from;
  const emailMatch = from.match(/<([^>]+)>/);
  const senderEmail = emailMatch ? emailMatch[1] : from;

  const bodyResult = msg.payload ? extractBody(msg.payload) : { text: '', html: null, imageSrcs: [] };
  const images = msg.payload
    ? resolveImages(bodyResult.imageSrcs, extractInlinePartsByCid(msg.payload))
    : [];

  return {
    id: msg.id,
    threadId: msg.threadId,
    labelIds: msg.labelIds || [],
    unread: (msg.labelIds || []).includes('UNREAD'),
    sender: senderName || senderEmail,
    email: senderEmail,
    subject: getHeader(headers, 'Subject') || '(no subject)',
    date: getHeader(headers, 'Date'),
    to: getHeader(headers, 'To'),
    messageIdHeader: getHeader(headers, 'Message-ID'),
    references: getHeader(headers, 'References'),
    snippet: msg.snippet || '',
    body: bodyResult.text,
    bodyHtml: bodyResult.html,
    images,
    attachments: msg.payload ? extractAttachments(msg.payload) : [],
  };
}

// Gmail has no real "Archived" label — archiving just strips INBOX, and the
// message keeps living wherever it already was. This pseudo-folder emulates
// it with a search query instead of a labelId.
const ARCHIVE_ID = '__ARCHIVE__';
const ARCHIVE_QUERY = '-in:inbox -in:sent -in:draft -in:trash -in:spam';

class GmailClient {
  constructor(authClient) {
    this.api = google.gmail({ version: 'v1', auth: authClient });
  }

  async getProfile() {
    const res = await this.api.users.getProfile({ userId: 'me' });
    return res.data;
  }

  async listLabels() {
    const res = await this.api.users.labels.list({ userId: 'me' });
    const labels = res.data.labels || [];

    const wanted = ['INBOX', 'SENT', 'DRAFT', 'STARRED', 'TRASH'];
    const userLabels = labels.filter((l) => l.type === 'user');
    const systemLabels = wanted
      .map((id) => labels.find((l) => l.id === id))
      .filter(Boolean);

    const ordered = [
      systemLabels[0],
      { id: ARCHIVE_ID, name: 'Archived' },
      ...userLabels,
      ...systemLabels.slice(1),
    ].filter(Boolean);

    const withCounts = await Promise.all(
      ordered.map(async (l) => {
        if (l.id === ARCHIVE_ID) {
          try {
            const r = await this.api.users.messages.list({
              userId: 'me', q: `${ARCHIVE_QUERY} is:unread`, maxResults: 1,
            });
            return { id: l.id, name: l.name, unread: r.data.resultSizeEstimate || 0 };
          } catch (e) {
            return { id: l.id, name: l.name, unread: 0 };
          }
        }
        try {
          const detail = await this.api.users.labels.get({ userId: 'me', id: l.id });
          return {
            id: l.id,
            name: l.type === 'system' ? titleCase(l.id) : l.name,
            unread: detail.data.messagesUnread || 0,
          };
        } catch (e) {
          return { id: l.id, name: l.name, unread: 0 };
        }
      })
    );
    return withCounts;
  }

  async listMessages(labelId, maxResults = 30, pageToken) {
    const listRes = await this.api.users.messages.list({
      userId: 'me',
      ...(labelId === ARCHIVE_ID ? { q: ARCHIVE_QUERY } : { labelIds: [labelId] }),
      maxResults,
      pageToken,
    });
    const refs = listRes.data.messages || [];
    const full = await mapLimit(refs, 15, (r) =>
      this.api.users.messages.get({
        userId: 'me',
        id: r.id,
        format: 'metadata',
        metadataHeaders: ['From', 'Subject', 'Date', 'To'],
      })
    );
    return { messages: full.map((r) => parseMessage(r.data)), nextPageToken: listRes.data.nextPageToken || null };
  }

  async searchMessages(query, maxResults = 30, pageToken) {
    const listRes = await this.api.users.messages.list({ userId: 'me', q: query, maxResults, pageToken });
    const refs = listRes.data.messages || [];
    const full = await mapLimit(refs, 15, (r) =>
      this.api.users.messages.get({
        userId: 'me',
        id: r.id,
        format: 'metadata',
        metadataHeaders: ['From', 'Subject', 'Date', 'To'],
      })
    );
    return { messages: full.map((r) => parseMessage(r.data)), nextPageToken: listRes.data.nextPageToken || null };
  }

  async getMessage(id) {
    const res = await this.api.users.messages.get({ userId: 'me', id, format: 'full' });
    return parseMessage(res.data);
  }

  async getAttachmentData(messageId, attachmentId) {
    const res = await this.api.users.messages.attachments.get({
      userId: 'me',
      messageId,
      id: attachmentId,
    });
    return res.data.data; // base64url string
  }

  async markRead(id) {
    await this.api.users.messages.modify({
      userId: 'me',
      id,
      requestBody: { removeLabelIds: ['UNREAD'] },
    });
  }

  async archive(id) {
    await this.api.users.messages.modify({
      userId: 'me',
      id,
      requestBody: { removeLabelIds: ['INBOX'] },
    });
  }

  async trash(id) {
    await this.api.users.messages.trash({ userId: 'me', id });
  }

  async untrash(id) {
    await this.api.users.messages.untrash({ userId: 'me', id });
  }

  async emptyTrash() {
    let ids = [];
    let pageToken;
    do {
      const res = await this.api.users.messages.list({
        userId: 'me', labelIds: ['TRASH'], maxResults: 500, pageToken,
      });
      ids = ids.concat((res.data.messages || []).map((m) => m.id));
      pageToken = res.data.nextPageToken;
    } while (pageToken);

    for (let i = 0; i < ids.length; i += 1000) {
      const chunk = ids.slice(i, i + 1000);
      await this.api.users.messages.batchDelete({ userId: 'me', requestBody: { ids: chunk } });
    }
    return ids.length;
  }

  async listAllLabelsRaw() {
    const res = await this.api.users.labels.list({ userId: 'me' });
    return (res.data.labels || []).map((l) => ({ id: l.id, name: l.name, type: l.type }));
  }

  async createLabel(name) {
    const res = await this.api.users.labels.create({
      userId: 'me',
      requestBody: { name, labelListVisibility: 'labelShow', messageListVisibility: 'show' },
    });
    return { id: res.data.id, name: res.data.name, type: res.data.type };
  }

  async modifyLabels(id, addLabelIds, removeLabelIds) {
    await this.api.users.messages.modify({
      userId: 'me',
      id,
      requestBody: { addLabelIds: addLabelIds || [], removeLabelIds: removeLabelIds || [] },
    });
  }

  async markAllRead(labelId) {
    let ids = [];
    let pageToken;
    do {
      const res = await this.api.users.messages.list({
        userId: 'me',
        ...(labelId === ARCHIVE_ID
          ? { q: `${ARCHIVE_QUERY} is:unread` }
          : { labelIds: [labelId, 'UNREAD'] }),
        maxResults: 500,
        pageToken,
      });
      ids = ids.concat((res.data.messages || []).map((m) => m.id));
      pageToken = res.data.nextPageToken;
    } while (pageToken);

    for (let i = 0; i < ids.length; i += 1000) {
      const chunk = ids.slice(i, i + 1000);
      await this.api.users.messages.batchModify({
        userId: 'me',
        requestBody: { ids: chunk, removeLabelIds: ['UNREAD'] },
      });
    }
    return ids.length;
  }

  async send({ to, subject, body, threadId, inReplyTo, references, attachments }) {
    const headerLines = [
      `To: ${sanitizeHeaderValue(to)}`,
      `Subject: ${sanitizeHeaderValue(subject)}`,
      'MIME-Version: 1.0',
    ];
    if (inReplyTo) headerLines.push(`In-Reply-To: ${sanitizeHeaderValue(inReplyTo)}`);
    if (references) headerLines.push(`References: ${sanitizeHeaderValue(references)}`);

    let message;
    if (attachments && attachments.length) {
      const boundary = `beanybox_${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`;
      headerLines.push(`Content-Type: multipart/mixed; boundary="${boundary}"`);
      const parts = [
        `--${boundary}`,
        'Content-Type: text/plain; charset="UTF-8"',
        'Content-Transfer-Encoding: 7bit',
        '',
        body,
      ];
      for (const att of attachments) {
        const safeName = sanitizeHeaderValue(att.filename).replace(/"/g, "'");
        parts.push(
          `--${boundary}`,
          `Content-Type: ${att.mimeType || 'application/octet-stream'}; name="${safeName}"`,
          `Content-Disposition: attachment; filename="${safeName}"`,
          'Content-Transfer-Encoding: base64',
          '',
          wrapBase64(att.data)
        );
      }
      parts.push(`--${boundary}--`);
      message = headerLines.join('\r\n') + '\r\n\r\n' + parts.join('\r\n');
    } else {
      headerLines.push('Content-Type: text/plain; charset="UTF-8"');
      message = headerLines.join('\r\n') + '\r\n\r\n' + body;
    }

    const raw = b64urlEncode(message);
    const requestBody = { raw };
    if (threadId) requestBody.threadId = threadId;

    await this.api.users.messages.send({ userId: 'me', requestBody });
  }
}

function titleCase(id) {
  const map = { INBOX: 'Inbox', SENT: 'Sent', DRAFT: 'Drafts', STARRED: 'Starred', TRASH: 'Trash' };
  return map[id] || id;
}

module.exports = { GmailClient };
