// Pixabay Video Search API Route
// Proxies requests to Pixabay API using server-side API key

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

  const { query, page = 1, per_page = 20 } = req.query;

  if (!query) {
    return res.status(400).json({ error: 'Query parameter required' });
  }

  const apiKey = process.env.PIXABAY_API_KEY;

  if (!apiKey) {
    console.error('[Pixabay API] PIXABAY_API_KEY not found in environment variables');
    return res.status(500).json({ error: 'API key not configured' });
  }

  try {
    // Enhance city searches with country context for better results
    let searchQuery = query.trim();
    
    // Map of cities to their countries for better search context
    const cityCountryMap = {
      'belfast': 'Belfast Northern Ireland',
      'dublin': 'Dublin Ireland',
      'amsterdam': 'Amsterdam Netherlands',
      'paris': 'Paris France',
      'london': 'London England',
      'rome': 'Rome Italy',
      'barcelona': 'Barcelona Spain',
      'lisbon': 'Lisbon Portugal',
      'prague': 'Prague Czech',
      'vienna': 'Vienna Austria',
      'berlin': 'Berlin Germany',
      'munich': 'Munich Germany',
      'brussels': 'Brussels Belgium',
      'copenhagen': 'Copenhagen Denmark',
      'stockholm': 'Stockholm Sweden',
      'oslo': 'Oslo Norway',
      'helsinki': 'Helsinki Finland',
      'reykjavik': 'Reykjavik Iceland',
      'edinburgh': 'Edinburgh Scotland',
      'glasgow': 'Glasgow Scotland',
      'cork': 'Cork Ireland',
      'galway': 'Galway Ireland'
    };
    
    // Check if query contains a known city and enhance it
    const queryLower = searchQuery.toLowerCase();
    for (const [city, enhanced] of Object.entries(cityCountryMap)) {
      if (queryLower.includes(city)) {
        const enhancedWords = enhanced.toLowerCase().split(' ');
        const alreadyHasCountry = enhancedWords.some(word => 
          word.length > 3 && queryLower.includes(word) && word !== city
        );
        
        if (!alreadyHasCountry) {
          searchQuery = searchQuery.replace(new RegExp(city, 'i'), enhanced);
          break;
        }
      }
    }
    
    console.log('[Pixabay API] Searching:', searchQuery, 'page:', page);

    // Pixabay Video API endpoint
    const url = `https://pixabay.com/api/videos/?key=${apiKey}&q=${encodeURIComponent(searchQuery)}&page=${page}&per_page=${per_page}&safesearch=true&video_type=film`;
    
    const response = await fetch(url);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[Pixabay API] Error response:', errorText);
      return res.status(response.status).json({ 
        error: 'Pixabay API error',
        status: response.status,
        details: errorText
      });
    }

    const data = await response.json();
    console.log('[Pixabay API] Success:', data.totalHits || 0, 'results');

    // Transform to consistent format
    const videos = (data.hits || []).map(video => ({
      id: video.id,
      title: video.tags || '',
      thumbnail: video.videos?.tiny?.thumbnail || video.videos?.small?.thumbnail || `https://i.vimeocdn.com/video/${video.picture_id}_295x166.jpg`,
      duration: video.duration || 0,
      width: video.videos?.large?.width || video.videos?.medium?.width || 1920,
      height: video.videos?.large?.height || video.videos?.medium?.height || 1080,
      // Video URLs by quality
      preview_url: video.videos?.tiny?.url || video.videos?.small?.url,
      download_url: video.videos?.large?.url || video.videos?.medium?.url || video.videos?.small?.url,
      // All available qualities
      videos: video.videos,
      user: video.user,
      user_url: video.userImageURL,
      page_url: video.pageURL,
      tags: video.tags
    }));

    return res.status(200).json({
      success: true,
      videos: videos,
      total_results: data.totalHits || 0,
      page: parseInt(page),
      per_page: parseInt(per_page)
    });

  } catch (error) {
    console.error('[Pixabay API] Exception:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      message: error.message
    });
  }
}
