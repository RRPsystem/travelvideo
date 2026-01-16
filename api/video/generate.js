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
      clips = [],
      title = 'Jouw Reis',
      voiceoverUrl = null,
      clipDuration = 7,
      clipsPerDestination = 2,  // Aantal clips per bestemming (1-3)
      travelData = null,        // Full Travel Compositor data for overlays
      showHotelOverlay = true,  // Show hotel info overlay
      showFlightOverlay = true, // Show flight info overlay
      overlayDuration = 0.4     // Overlay shows for 40% of clip duration (max 50%)
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

    // Step 2: Create timeline with travel data overlays
    const timeline = createTimeline(validClips, title, clipDuration, voiceoverUrl, {
      travelData,
      showHotelOverlay,
      showFlightOverlay,
      overlayDuration: Math.min(overlayDuration, 0.5) // Max 50%
    });

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

function createTimeline(clips, title, clipDuration, voiceoverUrl, options = {}) {
  const { 
    travelData = null, 
    showHotelOverlay = true, 
    showFlightOverlay = true,
    overlayDuration = 0.4 
  } = options;
  
  const tracks = [];
  let currentTime = 0;
  const overlayLength = clipDuration * overlayDuration; // Overlay duration (e.g., 40% of clip)

  // Extract hotels and flights from travel data
  const hotels = travelData?.hotels || [];
  const flights = travelData?.flights || [];
  const destinations = travelData?.destinations || [];

  // Helper: Find hotel for a destination
  function findHotelForDestination(destName) {
    if (!destName || hotels.length === 0) return null;
    const destLower = destName.toLowerCase();
    return hotels.find(h => {
      const hotelCity = (h.city || h.location || h.destination || '').toLowerCase();
      return hotelCity.includes(destLower) || destLower.includes(hotelCity);
    });
  }

  // Helper: Find flight for destination (outbound or return)
  function findFlightForDestination(destName, isFirst, isLast) {
    if (!destName || flights.length === 0) return null;
    const destLower = destName.toLowerCase();
    
    // For first destination, show outbound flight
    if (isFirst && flights.length > 0) {
      return flights[0];
    }
    // For last destination, show return flight
    if (isLast && flights.length > 1) {
      return flights[flights.length - 1];
    }
    return null;
  }

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

  // Track 2: Title overlay (intro)
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

  // Track 3: Destination name overlays (bottom left, brief)
  const destNameClips = clips.map((clip, index) => {
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
      length: overlayLength, // Only show for part of clip
      offset: {
        x: 0.05,
        y: -0.1
      },
      transition: {
        in: 'slideLeft',
        out: 'fade'
      }
    };
  });

  tracks.push({ clips: destNameClips });

  // Track 4: Hotel info overlays (bottom right, after destination name fades)
  if (showHotelOverlay && hotels.length > 0) {
    const hotelClips = [];
    
    clips.forEach((clip, index) => {
      const hotel = findHotelForDestination(clip.destination);
      if (hotel) {
        // Build hotel text
        const hotelName = hotel.name || hotel.title || 'Hotel';
        const stars = hotel.stars ? '★'.repeat(hotel.stars) : '';
        const checkIn = hotel.checkIn || hotel.startDate || '';
        const checkOut = hotel.checkOut || hotel.endDate || '';
        const nights = hotel.nights || '';
        
        let hotelText = `🏨 ${hotelName}`;
        if (stars) hotelText += ` ${stars}`;
        if (nights) hotelText += `\n${nights} nachten`;
        else if (checkIn && checkOut) hotelText += `\n${checkIn} - ${checkOut}`;
        
        hotelClips.push({
          asset: {
            type: 'html',
            html: `<div style="font-family: Arial, sans-serif; background: rgba(0,0,0,0.7); padding: 12px 20px; border-radius: 8px; border-left: 4px solid #8b5cf6;">
              <div style="color: #a78bfa; font-size: 12px; margin-bottom: 4px;">ACCOMMODATIE</div>
              <div style="color: white; font-size: 16px; font-weight: bold;">${hotelName} ${stars}</div>
              ${nights ? `<div style="color: #94a3b8; font-size: 14px; margin-top: 4px;">${nights} nachten</div>` : ''}
            </div>`,
            width: 350,
            height: 100
          },
          start: (index * clipDuration) + overlayLength, // Start after destination name
          length: overlayLength,
          position: 'bottomRight',
          offset: {
            x: -0.05,
            y: -0.1
          },
          transition: {
            in: 'fade',
            out: 'fade'
          }
        });
      }
    });
    
    if (hotelClips.length > 0) {
      tracks.push({ clips: hotelClips });
    }
  }

  // Track 5: Flight info overlays (top, only for first/last destination)
  if (showFlightOverlay && flights.length > 0) {
    const flightClips = [];
    
    clips.forEach((clip, index) => {
      const isFirst = index === 0;
      const isLast = index === clips.length - 1;
      
      if (isFirst || isLast) {
        const flight = findFlightForDestination(clip.destination, isFirst, isLast);
        if (flight) {
          const airline = flight.airline || flight.carrier || '';
          const flightNum = flight.flightNumber || flight.number || '';
          const departure = flight.departureTime || flight.departure || '';
          const arrival = flight.arrivalTime || flight.arrival || '';
          const from = flight.from || flight.origin || '';
          const to = flight.to || flight.destination || '';
          
          let flightText = isFirst ? '✈️ HEENVLUCHT' : '✈️ TERUGVLUCHT';
          if (airline) flightText += ` • ${airline}`;
          if (flightNum) flightText += ` ${flightNum}`;
          
          flightClips.push({
            asset: {
              type: 'html',
              html: `<div style="font-family: Arial, sans-serif; background: rgba(0,0,0,0.7); padding: 12px 20px; border-radius: 8px; border-left: 4px solid #ec4899;">
                <div style="color: #f472b6; font-size: 12px; margin-bottom: 4px;">${isFirst ? 'HEENVLUCHT' : 'TERUGVLUCHT'}</div>
                <div style="color: white; font-size: 16px; font-weight: bold;">${airline} ${flightNum}</div>
                ${from && to ? `<div style="color: #94a3b8; font-size: 14px; margin-top: 4px;">${from} → ${to}</div>` : ''}
              </div>`,
              width: 350,
              height: 100
            },
            start: index * clipDuration,
            length: overlayLength,
            position: 'topRight',
            offset: {
              x: -0.05,
              y: 0.1
            },
            transition: {
              in: 'fade',
              out: 'fade'
            }
          });
        }
      }
    });
    
    if (flightClips.length > 0) {
      tracks.push({ clips: flightClips });
    }
  }

  // Track 6: Voice-over
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
