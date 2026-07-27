export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { account, password, message, phoneNumbers, withDeliveryReport } = req.body || {};

    if (!account || !password) {
      return res.status(400).json({ error: 'Missing account credentials (username and password)' });
    }

    if (!message || !phoneNumbers || !Array.isArray(phoneNumbers) || phoneNumbers.length === 0) {
      return res.status(400).json({ error: 'Invalid payload: message and phoneNumbers array are required' });
    }

    const authHeader = 'Basic ' + Buffer.from(`${account}:${password}`).toString('base64');

    const response = await fetch('https://api.sms-gate.app/3rdparty/v1/message', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authHeader,
      },
      body: JSON.stringify({
        message,
        phoneNumbers,
        withDeliveryReport: withDeliveryReport ?? true,
      }),
    });

    const data = await response.json().catch(() => ({}));

    if (response.status === 202) {
      return res.status(200).json({
        success: true,
        id: data.id || null,
        status: response.status,
      });
    } else {
      return res.status(response.status).json({
        success: false,
        status: response.status,
        error: data.message || data.error || `Gateway returned HTTP ${response.status}`,
      });
    }
  } catch (err: any) {
    console.error('SMS Send Proxy Error:', err);
    return res.status(500).json({ error: err.message || 'Failed to dispatch SMS' });
  }
}
