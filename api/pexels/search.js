// Vercel Serverless Function: GET /api/pexels/search
// Search Pexels videos using server-side API key

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
    const { query, page = 1, per_page = 20, orientation = 'landscape' } = req.query;

    if (!query) {
      return res.status(400).json({ error: 'Query parameter is required' });
    }

    // Get API key from environment
    const apiKey = process.env.PEXELS_API_KEY;
    
    if (!apiKey) {
      console.error('[PexelsSearch] PEXELS_API_KEY not configured');
      return res.status(500).json({ 
        error: 'Pexels API niet geconfigureerd',
        detail: 'Voeg PEXELS_API_KEY toe aan Vercel environment variables'
      });
    }

    // Enhance city searches with country context for better geographic results
    let searchQuery = query.trim();
    
    // Map of cities to their countries for better search context
    const cityCountryMap = {
      'belfast': 'Belfast Northern Ireland',
      'dublin': 'Dublin Ireland',
      'amsterdam': 'Amsterdam Netherlands Holland',
      'paris': 'Paris France',
      'london': 'London England United Kingdom',
      'rome': 'Rome Italy',
      'barcelona': 'Barcelona Spain',
      'lisbon': 'Lisbon Portugal',
      'prague': 'Prague Czech Republic',
      'vienna': 'Vienna Austria',
      'berlin': 'Berlin Germany',
      'munich': 'Munich Germany Bavaria',
      'brussels': 'Brussels Belgium',
      'copenhagen': 'Copenhagen Denmark',
      'stockholm': 'Stockholm Sweden',
      'oslo': 'Oslo Norway',
      'helsinki': 'Helsinki Finland',
      'reykjavik': 'Reykjavik Iceland',
      'edinburgh': 'Edinburgh Scotland',
      'glasgow': 'Glasgow Scotland',
      'cork': 'Cork Ireland',
      'galway': 'Galway Ireland',
      'new york': 'New York City USA Manhattan',
      'los angeles': 'Los Angeles California USA',
      'tokyo': 'Tokyo Japan',
      'sydney': 'Sydney Australia',
      'bangkok': 'Bangkok Thailand',
      'singapore': 'Singapore city',
      'hong kong': 'Hong Kong China',
      'dubai': 'Dubai UAE Emirates'
    };
    
    // Check if query contains a known city and enhance it
    const queryLower = searchQuery.toLowerCase();
    for (const [city, enhanced] of Object.entries(cityCountryMap)) {
      if (queryLower.includes(city)) {
        // Check if country is already in query
        const enhancedWords = enhanced.toLowerCase().split(' ');
        const alreadyHasCountry = enhancedWords.some(word => 
          word.length > 3 && queryLower.includes(word) && word !== city
        );
        
        if (!alreadyHasCountry) {
          // Replace city name with enhanced version
          searchQuery = searchQuery.replace(new RegExp(city, 'i'), enhanced);
          break;
        }
      }
    }
    
    console.log('[PexelsSearch] Enhanced query:', searchQuery);

    // Call Pexels API
    const pexelsUrl = `https://api.pexels.com/videos/search?query=${encodeURIComponent(searchQuery)}&per_page=${per_page}&page=${page}&orientation=${orientation}`;
    
    const response = await fetch(pexelsUrl, {
      headers: {
        'Authorization': apiKey
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[PexelsSearch] Pexels API error:', response.status, errorText);
      return res.status(response.status).json({ 
        error: 'Pexels API error',
        detail: errorText
      });
    }

    const data = await response.json();

    console.log('[PexelsSearch] Found', data.total_results, 'results');

    return res.status(200).json({
      success: true,
      videos: data.videos || [],
      total_results: data.total_results || 0,
      page: data.page || 1,
      per_page: data.per_page || per_page,
      next_page: data.next_page || null
    });

  } catch (error) {
    console.error('[PexelsSearch] Error:', error);
    return res.status(500).json({ 
      error: 'Zoeken mislukt', 
      detail: error.message 
    });
  }
}
