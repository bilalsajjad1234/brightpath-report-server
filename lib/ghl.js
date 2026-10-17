'use strict';

// Minimal GoHighLevel API v2 client for what this server needs.
// Docs: https://marketplace.gohighlevel.com/docs/ghl/conversations/send-a-new-message/index.html

const BASE_URL = 'https://services.leadconnectorhq.com';
const VERSION_CONVERSATIONS = '2021-04-15';
const VERSION_CONTACTS = '2021-07-28';

class GhlError extends Error {
  constructor(message, status, data) {
    super(message);
    this.status = status;
    this.data = data;
  }
}

function apiMessage(data) {
  if (!data) return '';
  const m = data.message || data.msg || data.error || data.raw || '';
  if (Array.isArray(m)) return m.join('; ');
  return typeof m === 'string' ? m : JSON.stringify(m);
}

function firstUrl(value) {
  if (!value) return null;
  if (typeof value === 'string') return /^https?:\/\//i.test(value) ? value : null;
  const list = Array.isArray(value) ? value : typeof value === 'object' ? Object.values(value) : [];
  for (const item of list) {
    const url = firstUrl(item);
    if (url) return url;
  }
  return null;
}

function createClient({ token, versionOverride, timeoutMs = 20000 }) {
  async function call(method, path, { version, json, form, query } = {}) {
    const url = new URL(BASE_URL + path);
    for (const [k, v] of Object.entries(query || {})) {
      if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, String(v));
    }
    const headers = {
      Authorization: 'Bearer ' + token,
      Version: versionOverride || version,
      Accept: 'application/json'
    };
    let body;
    if (json !== undefined) {
      headers['Content-Type'] = 'application/json';
      body = JSON.stringify(json);
    } else if (form) {
      body = form; // fetch sets the multipart boundary itself
    }

    let res;
    try {
      res = await fetch(url, { method, headers, body, signal: AbortSignal.timeout(timeoutMs) });
    } catch (err) {
      throw new GhlError('GHL ' + method + ' ' + path + ' failed: ' + err.message, 0, null);
    }
    const text = await res.text();
    let data = null;
    if (text) {
      try {
        data = JSON.parse(text);
      } catch (err) {
        data = { raw: text.slice(0, 500) };
      }
    }
    if (!res.ok) {
      throw new GhlError(('GHL ' + method + ' ' + path + ' -> ' + res.status + ' ' + apiMessage(data)).trim(), res.status, data);
    }
    return data || {};
  }

  return {
    async getContact(contactId) {
      const data = await call('GET', '/contacts/' + encodeURIComponent(contactId), { version: VERSION_CONTACTS });
      return data.contact || data;
    },

    async getCustomFields(locationId) {
      const data = await call('GET', '/locations/' + encodeURIComponent(locationId) + '/customFields', { version: VERSION_CONTACTS });
      return data.customFields || [];
    },

    async findConversation(locationId, contactId) {
      const data = await call('GET', '/conversations/search', {
        version: VERSION_CONVERSATIONS,
        query: { locationId, contactId, limit: 1 }
      });
      const first = (data.conversations || [])[0];
      return first ? first.id : null;
    },

    async createConversation(locationId, contactId) {
      try {
        const data = await call('POST', '/conversations/', { version: VERSION_CONVERSATIONS, json: { locationId, contactId } });
        return (data.conversation && data.conversation.id) || data.id || null;
      } catch (err) {
        // "Conversation already exists" comes back with the existing id.
        const id = err.data && (err.data.conversationId || (err.data.conversation && err.data.conversation.id));
        if (id) return id;
        throw err;
      }
    },

    // Uploads the PDF to GHL's own file storage and returns its URL.
    async uploadAttachment({ locationId, contactId, conversationId, buffer, fileName }) {
      const form = new FormData();
      form.append('fileAttachment', new Blob([buffer], { type: 'application/pdf' }), fileName);
      form.append('locationId', locationId);
      form.append('contactId', contactId);
      if (conversationId) form.append('conversationId', conversationId);
      const data = await call('POST', '/conversations/messages/upload', { version: VERSION_CONVERSATIONS, form });
      return firstUrl(data.uploadedFiles) || firstUrl(data.urls) || null;
    },

    // Sends the email through the sub-account's normal GHL email sending, so
    // it shows in the contact's conversation like any other email. Retries
    // once without optional fields the API says it does not accept.
    async sendEmail({ contactId, subject, html, attachments, emailFrom }) {
      let payload = { type: 'Email', contactId, subject, html };
      if (attachments && attachments.length) payload.attachments = attachments;
      if (emailFrom) payload.emailFrom = emailFrom;

      for (let attempt = 0; ; attempt++) {
        try {
          return await call('POST', '/conversations/messages', { version: VERSION_CONVERSATIONS, json: payload });
        } catch (err) {
          if (attempt >= 3 || !(err.status === 400 || err.status === 422)) throw err;
          const msg = apiMessage(err.data).toLowerCase();
          const next = { ...payload };
          if (/\bstatus\b/.test(msg) && !next.status) next.status = 'pending';
          if (next.emailFrom && /from/.test(msg)) {
            // "Name <email>" refused -> try the bare address, then GHL's default sender.
            const bare = next.emailFrom.match(/<([^>]+)>/);
            if (bare) next.emailFrom = bare[1].trim();
            else delete next.emailFrom;
          }
          if (JSON.stringify(next) === JSON.stringify(payload)) throw err;
          payload = next;
        }
      }
    }
  };
}

// Gets the PDF into GHL and emails it. The PDF goes up to GHL's file storage
// first (exactly what the Conversations screen does for attachments). If the
// upload is refused, the email attaches the PDF from this server's own link.
async function deliverReport(client, { locationId, contactId, pdf, fileName, hostedUrl, subject, html, emailFrom, attachMode }) {
  const notes = [];
  let attachmentUrl = null;

  if (attachMode !== 'link') {
    let conversationId = null;
    try {
      conversationId = await client.findConversation(locationId, contactId);
      if (!conversationId) conversationId = await client.createConversation(locationId, contactId);
    } catch (err) {
      notes.push('conversation: ' + err.message);
    }
    try {
      attachmentUrl = await client.uploadAttachment({ locationId, contactId, conversationId, buffer: pdf, fileName });
      if (!attachmentUrl) notes.push('upload: no file URL in the response');
    } catch (err) {
      if (attachMode === 'upload') throw err;
      notes.push('upload: ' + err.message);
    }
  }

  const attachedFrom = attachmentUrl ? 'ghl-storage' : 'report-link';
  const sent = await client.sendEmail({
    contactId,
    subject,
    html,
    attachments: [attachmentUrl || hostedUrl],
    emailFrom
  });

  return {
    messageId: sent.messageId || null,
    conversationId: sent.conversationId || null,
    attachedFrom,
    notes
  };
}

module.exports = { createClient, deliverReport, GhlError };
