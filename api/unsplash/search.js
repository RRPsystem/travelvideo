// Vercel Serverless Function: GET /api/unsplash/search
// Search Unsplash images using server-side API key

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { query, page = 1, per_page = 12, orientation = 'landscape' } = req.query;

    if (!query) {
      return res.status(400).json({ error: 'Query parameter is required' });
    }

    // Get API key from environment (try multiple possible names)
    const apiKey = process.env.UNSPLASH_ACCESS_KEY || process.env.UNSPLASH_API_KEY;
    
    if (!apiKey) {
      console.error('[UnsplashSearch] UNSPLASH_ACCESS_KEY not configured');
      return res.status(500).json({ 
        error: 'Unsplash API niet geconfigureerd',
        detail: 'Voeg UNSPLASH_ACCESS_KEY toe aan Vercel environment variables'
      });
    }

    console.log('[UnsplashSearch] Searching for:', query);

    // Call Unsplash API
    const unsplashUrl = `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=${per_page}&page=${page}&orientation=${orientation}`;
    
    const response = await fetch(unsplashUrl, {
      headers: {
        'Authorization': `Client-ID ${apiKey}`
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[UnsplashSearch] Unsplash API error:', response.status, errorText);
      return res.status(response.status).json({ 
        error: 'Unsplash API error',
        detail: errorText
      });
    }

    const data = await response.json();

    console.log('[UnsplashSearch] Found', data.total, 'results');

    return res.status(200).json({
      success: true,
      results: data.results || [],
      total: data.total || 0,
      total_pages: data.total_pages || 0,
      page: page,
      per_page: per_page
    });

  } catch (error) {
    console.error('[UnsplashSearch] Error:', error);
    return res.status(500).json({ 
      error: 'Zoeken mislukt', 
      detail: error.message 
    });
  }
}
