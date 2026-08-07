import type { Request, Response } from 'express';

export interface WebhookMessageItem {
  id: string;
  phone: string;
  message: string;
  direction: 'incoming' | 'outgoing';
  timestamp: string;
  deviceId?: string;
  account?: string;
  status?: string;
  raw?: any;
}

// In-memory buffer of recent webhook messages (both incoming & mobile sent)
let recentWebhookMessages: WebhookMessageItem[] = [];

export function getInboundMessages() {
  return recentWebhookMessages;
}

export function addWebhookMessage(msg: {
  phone: string;
  message: string;
  direction?: 'incoming' | 'outgoing';
  deviceId?: string;
  account?: string;
  status?: string;
  timestamp?: string;
}) {
  const direction = msg.direction || 'incoming';
  const status = msg.status || (direction === 'outgoing' ? 'SENT' : 'RECEIVED');
  const cleanPhone = msg.phone;
  const cleanMessage = msg.message;

  // Check if we already have a matching message recently (e.g. updating status of an outgoing message)
  if (direction === 'outgoing' && (status === 'DELIVERED' || status === 'FAILED' || status === 'SENT')) {
    const existing = recentWebhookMessages.find(
      (m) => m.direction === 'outgoing' && m.phone === cleanPhone && m.message === cleanMessage
    );
    if (existing) {
      existing.status = status;
      if (msg.timestamp) existing.timestamp = msg.timestamp;
      return existing;
    }
  }

  const item: WebhookMessageItem = {
    id: `wh_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
    phone: cleanPhone,
    message: cleanMessage,
    direction,
    timestamp: msg.timestamp || new Date().toISOString(),
    deviceId: msg.deviceId,
    account: msg.account,
    status,
  };
  recentWebhookMessages.unshift(item);
  // Keep max 300
  if (recentWebhookMessages.length > 300) {
    recentWebhookMessages = recentWebhookMessages.slice(0, 300);
  }
  return item;
}

function parsePayloadItem(rawPayload: any): {
  phone: string;
  message: string;
  direction: 'incoming' | 'outgoing';
  status: string;
  deviceId?: string;
  account?: string;
  timestamp?: string;
} | null {
  if (!rawPayload || typeof rawPayload !== 'object') return null;

  // Unwrap nested payload, data, or body objects (common in sms-gate.app and webhooks)
  const nested = (typeof rawPayload.payload === 'object' && rawPayload.payload ? rawPayload.payload : {}) ||
                 (typeof rawPayload.data === 'object' && rawPayload.data ? rawPayload.data : {});

  const payload = { ...rawPayload, ...nested };

  const eventStr = String(
    payload.event ||
    payload.event_type ||
    payload.action ||
    payload.type ||
    payload.direction ||
    payload.status ||
    ''
  ).toLowerCase();

  const isOutgoing =
    eventStr.includes('sent') ||
    eventStr.includes('outgoing') ||
    eventStr.includes('dispatch') ||
    eventStr.includes('deliver') ||
    eventStr.includes('fail') ||
    eventStr.includes('tx') ||
    payload.direction === 'outgoing' ||
    payload.type === 'sent';

  const direction: 'incoming' | 'outgoing' = isOutgoing ? 'outgoing' : 'incoming';

  let status = direction === 'outgoing' ? 'SENT' : 'RECEIVED';
  if (eventStr.includes('deliver') || (payload.status && String(payload.status).toLowerCase().includes('deliver'))) {
    status = 'DELIVERED';
  } else if (eventStr.includes('fail') || eventStr.includes('error') || (payload.status && String(payload.status).toLowerCase().includes('fail'))) {
    status = 'FAILED';
  } else if (eventStr.includes('sent') || (payload.status && String(payload.status).toLowerCase().includes('sent'))) {
    status = 'SENT';
  } else if (eventStr.includes('receive') || (payload.status && String(payload.status).toLowerCase().includes('receive'))) {
    status = 'RECEIVED';
  }

  let phone = '';
  if (isOutgoing) {
    phone =
      payload.to ||
      payload.recipient ||
      payload.destination ||
      payload.dest ||
      payload.phoneNumber ||
      payload.phone ||
      payload.address ||
      payload.from ||
      '';
  } else {
    phone =
      payload.from ||
      payload.sender ||
      payload.address ||
      payload.phoneNumber ||
      payload.phone ||
      payload.to ||
      payload.recipient ||
      '';
  }

  const message =
    payload.message ||
    payload.text ||
    payload.body ||
    payload.content ||
    payload.msg ||
    payload.sms ||
    '';

  const deviceId = payload.deviceId || payload.sim || payload.device || payload.simId || '';
  const account = payload.account || payload.user || payload.apiAccount || payload.gateway || '';
  const timestamp = payload.timestamp || payload.time || payload.date || payload.created_at || new Date().toISOString();

  if (!phone && !message) return null;

  return {
    phone: String(phone).trim(),
    message: String(message).trim(),
    direction,
    status,
    deviceId: String(deviceId),
    account: String(account),
    timestamp: String(timestamp),
  };
}

export default async function handler(req: Request, res: Response) {
  res.setHeader('Content-Type', 'application/json');

  // GET: Return recent messages OR record quick query params
  if (req.method === 'GET') {
    const queryPhone = req.query.phone || req.query.from || req.query.to;
    const queryMsg = req.query.message || req.query.text || req.query.body;
    if (queryPhone && queryMsg) {
      const parsed = parsePayloadItem(req.query);
      if (parsed) {
        addWebhookMessage(parsed);
      }
    }

    return res.status(200).json({
      success: true,
      count: recentWebhookMessages.length,
      messages: recentWebhookMessages,
    });
  }

  // POST: Webhook receiver for incoming & outgoing mobile SMS
  if (req.method === 'POST') {
    try {
      const body = req.body || {};
      const addedItems: WebhookMessageItem[] = [];

      // Handle array of messages or wrapped array in body
      const rawList = Array.isArray(body)
        ? body
        : Array.isArray(body.messages)
        ? body.messages
        : Array.isArray(body.data)
        ? body.data
        : Array.isArray(body.events)
        ? body.events
        : [body];

      for (const item of rawList) {
        const parsed = parsePayloadItem(item);
        if (parsed && (parsed.phone || parsed.message)) {
          const added = addWebhookMessage(parsed);
          addedItems.push(added);
        }
      }

      if (addedItems.length === 0) {
        return res.status(400).json({ error: 'Invalid webhook payload: phone or message required' });
      }

      return res.status(200).json({
        success: true,
        received: true,
        count: addedItems.length,
        messages: addedItems,
      });
    } catch (err: any) {
      return res.status(500).json({ error: err.message || 'Webhook processing failed' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}

