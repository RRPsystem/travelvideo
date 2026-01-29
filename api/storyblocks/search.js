// Storyblocks Video Search API Route
// Proxies requests to Storyblocks API using server-side HMAC authentication

import crypto from 'crypto';

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { query, page = 1 } = req.query;

  if (!query) {
    return res.status(400).json({ error: 'Query parameter required' });
  }

  const publicKey = process.env.STORYBLOCKS_PUBLIC_KEY;
  const privateKey = process.env.STORYBLOCKS_PRIVATE_KEY;

  if (!publicKey || !privateKey) {
    console.error('[Storyblocks API] API keys not found in environment variables');
    return res.status(500).json({ error: 'API keys not configured' });
  }

  try {
    // Generate HMAC authentication
    const expires = Math.floor(Date.now() / 1000) + 3600; // 1 hour from now
    const resource = '/api/v2/videos/search';
    const hmacBuilder = crypto.createHmac('sha256', privateKey + expires);
    hmacBuilder.update(resource);
    const hmac = hmacBuilder.digest('hex');

    // Build URL with proper authentication and search parameters
    // Enhance city searches with country context for better results
    let searchQuery = query.trim();
    
    // Map of cities to their countries for better search context
    const cityCountryMap = {
      'belfast': 'Belfast Northern Ireland UK',
      'dublin': 'Dublin Ireland',
      'amsterdam': 'Amsterdam Netherlands',
      'paris': 'Paris France',
      'london': 'London England UK',
      'rome': 'Rome Italy',
      'barcelona': 'Barcelona Spain',
      'lisbon': 'Lisbon Portugal',
      'prague': 'Prague Czech Republic',
      'vienna': 'Vienna Austria',
      'berlin': 'Berlin Germany',
      'munich': 'Munich Germany',
      'brussels': 'Brussels Belgium',
      'copenhagen': 'Copenhagen Denmark',
      'stockholm': 'Stockholm Sweden',
      'oslo': 'Oslo Norway',
      'helsinki': 'Helsinki Finland',
      'reykjavik': 'Reykjavik Iceland',
      'edinburgh': 'Edinburgh Scotland UK',
      'glasgow': 'Glasgow Scotland UK',
      'cork': 'Cork Ireland',
      'galway': 'Galway Ireland'
    };
    
    // Check if query contains a known city and enhance it
    const queryLower = searchQuery.toLowerCase();
    for (const [city, enhanced] of Object.entries(cityCountryMap)) {
      if (queryLower.includes(city) && !queryLower.includes('ireland') && !queryLower.includes('uk') && !queryLower.includes('netherlands')) {
        // Replace city name with enhanced version, keeping other words
        searchQuery = searchQuery.replace(new RegExp(city, 'i'), enhanced);
        break;
      }
    }
    
    console.log('[Storyblocks API] Enhanced query:', searchQuery);
    
    const params = new URLSearchParams({
      APIKEY: publicKey,
      EXPIRES: expires.toString(),
      HMAC: hmac,
      keywords: searchQuery,
      page: page.toString(),
      results_per_page: '20',
      user_id: 'travelvideo-user',
      project_id: 'travelvideo-project',
      sort_by: 'most_relevant',  // Sort by relevance
      content_type: 'footage',   // Only footage, not templates
      quality: 'all'
    });

    const url = `https://api.storyblocks.com${resource}?${params.toString()}`;
    
    console.log('[Storyblocks API] Searching:', searchQuery, 'page:', page);

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    });

    console.log('[Storyblocks API] Response status:', response.status);
    console.log('[Storyblocks API] Response headers:', Object.fromEntries(response.headers.entries()));

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[Storyblocks API] Error response:', errorText);
      
      // Try to parse error as JSON
      let errorDetails = errorText;
      try {
        errorDetails = JSON.parse(errorText);
      } catch (e) {
        // Not JSON, use as-is
      }
      
      return res.status(response.status).json({ 
        error: 'Storyblocks API error',
        status: response.status,
        details: errorDetails,
        url: url.replace(publicKey, 'HIDDEN')
      });
    }

    const data = await response.json();
    console.log('[Storyblocks API] Success:', data.info?.total_results || 0, 'results');
    console.log('[Storyblocks API] Response structure:', Object.keys(data));

    return res.status(200).json(data);

  } catch (error) {
    console.error('[Storyblocks API] Exception:', error);
    console.error('[Storyblocks API] Stack:', error.stack);
    return res.status(500).json({ 
      error: 'Internal server error',
      message: error.message,
      type: error.name
    });
  }
}
