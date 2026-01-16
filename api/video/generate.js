// Server-side handler for video generation
const axios = require('axios');

module.exports = async function(req, res) {
  try {
    const {
      PEXELS_API_KEY = '',
      SHOTSTACK_API_KEY = '',
      SHOTSTACK_ENV = 'stage'
    } = process.env;

    if (!PEXELS_API_KEY) {
      return res.status(500).json({ 
        error: 'Missing PEXELS_API_KEY',
        message: 'Voeg PEXELS_API_KEY toe aan server/.env (gratis op pexels.com/api)'
      });
    }

    if (!SHOTSTACK_API_KEY) {
      return res.status(500).json({ 
        error: 'Missing SHOTSTACK_API_KEY',
        message: 'Voeg SHOTSTACK_API_KEY toe aan server/.env (gratis trial op shotstack.io)'
      });
    }

    const { 
      destinations = [], 
      title = 'Jouw Reis',
      voiceoverUrl = null,
      duration = 3,
      clipsPerDestination = 2  // Aantal clips per bestemming (1-3)
    } = req.body;

    if (!destinations || destinations.length === 0) {
      return res.status(400).json({ error: 'Geen bestemmingen opgegeven' });
    }

    console.log('[VideoGen] Generating video for:', { title, destinations: destinations.length });

    // Step 1: Search video clips (multiple per destination)
    const clipPromises = destinations.map(dest => 
      searchMultipleVideoClips(dest.name || dest, PEXELS_API_KEY, clipsPerDestination)
    );
    const clipsPerDest = await Promise.all(clipPromises);
    const validClips = clipsPerDest.flat().filter(c => c !== null);
    
    if (validClips.length === 0) {
      return res.status(404).json({ error: 'Geen video clips gevonden' });
    }

    console.log('[VideoGen] Found clips:', validClips.length);

    // Step 2: Create timeline
    const timeline = createTimeline(validClips, title, duration, voiceoverUrl);

    // Step 3: Submit to Shotstack
    const renderResponse = await submitToShotstack(timeline, SHOTSTACK_API_KEY, SHOTSTACK_ENV);

    console.log('[VideoGen] Render submitted:', renderResponse.id);

    return res.status(200).json({
      success: true,
      renderId: renderResponse.id,
      status: renderResponse.status,
      message: 'Video wordt gegenereerd. Dit kan 1-2 minuten duren.',
      clips: validClips.map(c => ({ destination: c.destination, url: c.url })),
      statusUrl: `/api/video/status/${renderResponse.id}`
    });

  } catch (error) {
    console.error('[VideoGen] Error:', error);
    return res.status(500).json({ 
      error: 'Video generatie mislukt', 
      detail: error.message 
    });
  }
};

// Search multiple video clips per destination for more variety
async function searchMultipleVideoClips(destination, apiKey, count = 2) {
  try {
    const maxClips = Math.min(Math.max(1, count), 3); // Limit 1-3 clips
    const query = `${destination} travel aerial city`;
    const url = `https://api.pexels.com/videos/search?query=${encodeURIComponent(query)}&per_page=${maxClips * 2}&orientation=landscape`;
    
    const response = await axios.get(url, {
      headers: { 'Authorization': apiKey }
    });

    if (response.data.videos && response.data.videos.length > 0) {
      const clips = [];
      const videos = response.data.videos.slice(0, maxClips);
      
      for (const video of videos) {
        const hdFile = video.video_files.find(f => f.quality === 'hd' && f.width >= 1280) 
                       || video.video_files[0];
        
        if (hdFile) {
          clips.push({
            destination,
            url: hdFile.link,
            width: hdFile.width,
            height: hdFile.height,
            duration: video.duration,
            thumbnail: video.image
          });
        }
      }
      
      console.log(`[VideoGen] Found ${clips.length} clips for: ${destination}`);
      return clips;
    }
    
    console.warn(`[VideoGen] No clips found for: ${destination}`);
    return [];
  } catch (error) {
    console.error(`[VideoGen] Pexels search failed for ${destination}:`, error.message);
    return [];
  }
}

// Legacy function for backward compatibility
async function searchVideoClip(destination, apiKey) {
  const clips = await searchMultipleVideoClips(destination, apiKey, 1);
  return clips.length > 0 ? clips[0] : null;
}

function createTimeline(clips, title, clipDuration, voiceoverUrl) {
  const tracks = [];
  let currentTime = 0;

  // Track 1: Video clips
  const videoClips = clips.map((clip, index) => {
    const start = currentTime;
    currentTime += clipDuration;
    
    return {
      asset: {
        type: 'video',
        src: clip.url,
        trim: 0
      },
      start: start,
      length: clipDuration,
      fit: 'cover',
      scale: 1,
      transition: {
        in: 'fade',
        out: 'fade'
      }
    };
  });

  tracks.push({ clips: videoClips });

  // Track 2: Title overlay
  tracks.push({
    clips: [{
      asset: {
        type: 'title',
        text: title,
        style: 'future',
        color: '#ffffff',
        size: 'large',
        background: 'rgba(0,0,0,0.5)',
        position: 'center'
      },
      start: 0,
      length: 3,
      transition: {
        in: 'fade',
        out: 'fade'
      }
    }]
  });

  // Track 3: Destination overlays
  const textClips = clips.map((clip, index) => {
    return {
      asset: {
        type: 'title',
        text: clip.destination,
        style: 'minimal',
        color: '#ffffff',
        size: 'medium',
        background: 'rgba(0,0,0,0.6)',
        position: 'bottomLeft'
      },
      start: index * clipDuration,
      length: clipDuration,
      offset: {
        x: 0.05,
        y: -0.1
      },
      transition: {
        in: 'slideLeft',
        out: 'slideLeft'
      }
    };
  });

  tracks.push({ clips: textClips });

  // Track 4: Voice-over
  if (voiceoverUrl) {
    tracks.push({
      clips: [{
        asset: {
          type: 'audio',
          src: voiceoverUrl,
          volume: 1
        },
        start: 0,
        length: currentTime
      }]
    });
  }

  return {
    timeline: {
      background: '#000000',
      tracks: tracks
    },
    output: {
      format: 'mp4',
      resolution: 'hd',
      aspectRatio: '16:9',
      size: {
        width: 1280,
        height: 720
      },
      fps: 25,
      scaleTo: 'preview'
    }
  };
}

async function submitToShotstack(timeline, apiKey, env) {
  const baseUrl = env === 'v1' 
    ? 'https://api.shotstack.io/v1' 
    : 'https://api.shotstack.io/stage';
  
  const url = `${baseUrl}/render`;
  
  const response = await axios.post(url, timeline, {
    headers: {
      'x-api-key': apiKey,
      'Content-Type': 'application/json'
    }
  });

  return {
    id: response.data.response.id,
    status: response.data.response.status,
    message: response.data.response.message
  };
}
