// Vercel Serverless Function: GET /api/ideas/[id]
// Proxies Travel Compositor idea detail using env credentials (Bearer auth).

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  console.log('[TC API] Function invoked!');
  console.log('[TC API] req.query:', req.query);
  
  try {
    const {
      TC_API_URL = '',
      TC_MICROSITE_ID = '',
      TC_USERNAME = '',
      TC_PASSWORD = '',
      TC_MICROSITE_ID_2 = '',
      TC_USERNAME_2 = '',
      TC_PASSWORD_2 = ''
    } = process.env;
    
    console.log('[TC API] Environment check:', {
      hasApiUrl: !!TC_API_URL,
      hasMicrositeId: !!TC_MICROSITE_ID,
      hasUsername: !!TC_USERNAME,
      hasPassword: !!TC_PASSWORD
    });

    const { id } = req.query || {};
    
    if (!id) {
      return res.status(400).json({ error: 'Missing id' });
    }
    
    // Determine which microsite credentials to use
    const micrositeId = String(req.query?.micrositeId || TC_MICROSITE_ID);
    let username = TC_USERNAME;
    let password = TC_PASSWORD;
    
    // Check if this is microsite 2
    if (TC_MICROSITE_ID_2 && micrositeId === TC_MICROSITE_ID_2) {
      username = TC_USERNAME_2 || username;
      password = TC_PASSWORD_2 || password;
    }

    if (!TC_API_URL) {
      return res.status(500).json({ error: 'Missing TC_API_URL environment variable' });
    }
    if (!micrositeId || !username || !password) {
      return res.status(500).json({ error: 'Missing TC credentials' });
    }

    // Remove trailing slash and /resources if present (we add it in paths)
    let base = TC_API_URL.replace(/\/$/, '');
    if (base.endsWith('/resources')) {
      base = base.replace(/\/resources$/, '');
    }
    const AUTH_PATH = '/resources/authentication/authenticate';
    const IDEAS_PATH = '/resources/travelidea';

    // Query params
    const { language = 'NL', currency = 'EUR', adults = '2' } = req.query || {};
    const params = new URLSearchParams();
    params.set('language', String(language));
    params.set('lang', String(language));
    params.set('currency', String(currency));
    if (adults) params.set('adults', String(adults));

    // Authenticate
    const authBody = { 
      username, 
      password, 
      micrositeId: parseInt(micrositeId) || micrositeId
    };
    
    console.log('[TC API] Authenticating with microsite:', micrositeId);
    
    console.log('[TC API] Auth URL:', `${base}${AUTH_PATH}`);
    console.log('[TC API] Auth body:', JSON.stringify(authBody));
    
    const authRes = await fetch(`${base}${AUTH_PATH}`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json', 
        'Accept': 'application/json'
      },
      body: JSON.stringify(authBody)
    });
    
    const authText = await authRes.text();
    console.log('[TC API] Auth response status:', authRes.status);
    console.log('[TC API] Auth response text:', authText.substring(0, 500));
    
    let authJson;
    try { authJson = JSON.parse(authText); } catch (e) { authJson = null; }
    
    if (!authRes.ok || !authJson?.token) {
      console.error('[TC API] Auth failed:', authRes.status, authText);
      return res.status(authRes.status || 500).json({ 
        error: 'Auth failed', 
        status: authRes.status,
        detail: authJson || authText,
        authUrl: `${base}${AUTH_PATH}`,
        micrositeId: micrositeId,
        hasUsername: !!username,
        hasPassword: !!password
      });
    }
    
    const bearer = authJson.token;
    console.log('[TC API] Auth successful');

    // Fetch travel idea
    const path = `${IDEAS_PATH}/${encodeURIComponent(micrositeId)}/${encodeURIComponent(id)}`;
    const upstreamUrl = `${base}${path}?${params.toString()}`;

    const r = await fetch(upstreamUrl, { 
      headers: { 
        'Accept': 'application/json',
        'auth-token': bearer 
      } 
    });
    
    const status = r.status;
    const text = await r.text();
    let data;
    try { data = JSON.parse(text); } catch (e) { data = null; }
    
    if (!r.ok) {
      return res.status(status).json({ 
        error: 'Upstream error', 
        status, 
        detail: data || text 
      });
    }

    res.setHeader('Cache-Control', 'public, max-age=60');
    return res.status(200).json(data);
  } catch (e) {
    console.error('[TC API] Error:', e);
    return res.status(500).json({ error: 'Proxy failure', detail: e?.message || String(e) });
  }
}
