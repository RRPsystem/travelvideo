// Storyblocks Video Search API Route
// Proxies requests to Storyblocks API using server-side API key

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

  const apiKey = process.env.STORYBLOCKS_PUBLIC_KEY;

  if (!apiKey) {
    console.error('[Storyblocks API] STORYBLOCKS_PUBLIC_KEY not found in environment variables');
    return res.status(500).json({ error: 'API key not configured' });
  }

  try {
    // Storyblocks API endpoint (original working version)
    const url = `https://api.graphicstock.com/api/v2/videos/search?keywords=${encodeURIComponent(query)}&page=${page}&results_per_page=20`;
    
    console.log('[Storyblocks API] Searching:', query, 'page:', page);

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
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
        url: url.replace(apiKey, 'HIDDEN')
      });
    }

    const data = await response.json();
    console.log('[Storyblocks API] Success:', data.info?.total_results || 0, 'results');
    
    // Filter out irrelevant results based on search context
    // If searching for European/Western cities, filter out Asian content
    const originalQuery = query.toLowerCase();
    const europeanCities = ['belfast', 'dublin', 'london', 'paris', 'amsterdam', 'rome', 'barcelona', 'lisbon', 'prague', 'vienna', 'berlin', 'munich', 'brussels', 'copenhagen', 'stockholm', 'oslo', 'helsinki', 'edinburgh', 'glasgow', 'cork', 'galway', 'reykjavik'];
    const isEuropeanSearch = europeanCities.some(city => originalQuery.includes(city));
    
    // Keywords that indicate Asian/irrelevant content for European searches
    const asianKeywords = ['thailand', 'thai', 'vietnam', 'vietnamese', 'cambodia', 'indonesia', 'bali', 'philippines', 'malaysia', 'singapore', 'china', 'chinese', 'japan', 'japanese', 'korea', 'korean', 'india', 'indian', 'asia', 'asian', 'tropical island', 'limestone', 'karst', 'halong', 'phuket', 'krabi', 'phang nga', 'james bond island'];
    
    let filteredResults = data.results || [];
    
    if (isEuropeanSearch && filteredResults.length > 0) {
      const beforeCount = filteredResults.length;
      filteredResults = filteredResults.filter(video => {
        // Check title, description, and keywords for Asian content
        const title = (video.title || '').toLowerCase();
        const description = (video.description || '').toLowerCase();
        const keywords = (video.keywords || []).map(k => k.toLowerCase()).join(' ');
        const allText = `${title} ${description} ${keywords}`;
        
        // Filter out if contains Asian keywords
        const isAsian = asianKeywords.some(keyword => allText.includes(keyword));
        return !isAsian;
      });
      
      console.log(`[Storyblocks API] Filtered ${beforeCount - filteredResults.length} irrelevant results for European search`);
    }
    
    // Return filtered data
    return res.status(200).json({
      ...data,
      results: filteredResults,
      info: {
        ...data.info,
        filtered_count: (data.results?.length || 0) - filteredResults.length
      }
    });

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
