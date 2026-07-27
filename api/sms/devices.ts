export default async function handler(req: any, res: any) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const account = req.query?.account || req.body?.account;
    const password = req.query?.password || req.body?.password;

    if (!account || !password) {
      return res.status(400).json({ error: 'Missing account credentials' });
    }

    const authHeader = 'Basic ' + Buffer.from(`${account}:${password}`).toString('base64');

    const response = await fetch('https://api.sms-gate.app/3rdparty/v1/devices', {
      method: 'GET',
      headers: {
        'Authorization': authHeader,
      },
    });

    if (!response.ok) {
      return res.status(200).json({
        online: null,
        error: `API_${response.status}`,
        devices: [],
      });
    }

    const devices = await response.json();
    const parsed: any[] = [];
    let onlineAny = false;

    for (const d of devices || []) {
      const lastSeenRaw = d.lastSeen;
      let minutesAgo: number | null = null;
      let isOnline = false;

      if (lastSeenRaw) {
        try {
          const lastSeenDate = new Date(lastSeenRaw);
          const diffMs = Date.now() - lastSeenDate.getTime();
          minutesAgo = Math.floor(diffMs / (1000 * 60));
          isOnline = minutesAgo <= 20;
        } catch {
          // ignore
        }
      }

      if (isOnline) onlineAny = true;

      parsed.push({
        name: d.name || 'Device',
        lastSeen: lastSeenRaw,
        minutesAgo,
        online: isOnline,
      });
    }

    return res.status(200).json({
      online: (devices && devices.length > 0) ? onlineAny : null,
      error: null,
      devices: parsed,
    });
  } catch (err: any) {
    console.error('Device status check error:', err);
    return res.status(200).json({
      online: null,
      error: err.message || 'Error',
      devices: [],
    });
  }
}
