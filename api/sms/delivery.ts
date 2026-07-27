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

    const response = await fetch(`https://api.sms-gate.app/3rdparty/v1/messages/${messageId}`, {
      method: 'GET',
      headers: {
        'Authorization': authHeader,
      },
    });

    if (!response.ok) {
      return res.status(response.status).json({
        error: `Gateway status check failed HTTP ${response.status}`,
      });
    }

    const data = await response.json();
    let state = (data.state || '').toUpperCase();
    let reason = '';

    if (Array.isArray(data.recipients) && data.recipients.length > 0) {
      const r0 = data.recipients[0];
      state = (r0.state || state).toUpperCase();
      reason = r0.error || '';
    }

    return res.status(200).json({
      success: true,
      state,
      reason,
      raw: data,
    });
  } catch (err: any) {
    console.error('Delivery status check error:', err);
    return res.status(500).json({ error: err.message || 'Delivery check error' });
  }
}
