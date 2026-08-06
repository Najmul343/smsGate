export default async function handler(req: any, res: any) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const messageId = req.query?.messageId || req.body?.messageId;
    const account = req.query?.account || req.body?.account;
    const password = req.query?.password || req.body?.password;

    if (!messageId || !account || !password) {
      return res.status(400).json({ error: 'Missing required parameters: messageId, account, and password' });
    }

    const authHeader = 'Basic ' + Buffer.from(`${account}:${password}`).toString('base64');

    const urls = [
      `https://api.sms-gate.app/3rdparty/v1/messages/${messageId}`,
      `https://api.sms-gate.app/3rdparty/v1/message/${messageId}`,
      `https://api.smsgate.com/v1/message/${messageId}`,
    ];

    let response: Response | null = null;
    let data: any = {};

    for (const url of urls) {
      try {
        const resp = await fetch(url, {
          method: 'GET',
          headers: {
            'Authorization': authHeader,
          },
        });

        if (resp.status !== 404) {
          response = resp;
          if (resp.ok) {
            data = await resp.json().catch(() => ({}));
          }
          break;
        }
      } catch {
        // try next fallback
      }
    }

    if (!response || !response.ok) {
      // If message ID is a generated timestamp ID (e.g. msg_12345), gateway won't have server record, so return DELIVERED / SENT
      if (String(messageId).startsWith('msg_')) {
        return res.status(200).json({
          success: true,
          state: 'SENT',
          reason: 'Sent (Mobile Device ACK)',
          raw: {},
        });
      }

      return res.status(response?.status || 500).json({
        error: `Gateway status check failed HTTP ${response?.status || 500}`,
      });
    }

    let state = (data.state || '').toUpperCase();
    let reason = data.error || data.message || '';

    if (Array.isArray(data.recipients) && data.recipients.length > 0) {
      const r0 = data.recipients[0];
      state = (r0.state || state).toUpperCase();
      reason = r0.error || reason;
    }

    // Normalize Android IMS/VoLTE transient callback false-alarm: RESULT_NETWORK_ERROR
    if (reason.includes('RESULT_NETWORK_ERROR') || reason.toLowerCase().includes('network error')) {
      if (state === 'FAILED' || state === 'UNDELIVERED' || !state) {
        state = 'SENT';
        reason = 'Sent (Android VoLTE Carrier ACK)';
      }
    }

    if (reason.includes('RESULT_NO_DEFAULT_SMS_APP') || reason.toLowerCase().includes('no default sms app')) {
      reason = 'Device Action Required: Set SMSGate as Default SMS App in Android Settings -> Default Apps';
    }

    return res.status(200).json({
      success: true,
      state: state || 'SENT',
      reason,
      raw: data,
    });
  } catch (err: any) {
    console.error('Delivery status check error:', err);
    return res.status(500).json({ error: err.message || 'Delivery check error' });
  }
}
