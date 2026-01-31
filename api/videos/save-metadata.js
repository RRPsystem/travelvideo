// Vercel Serverless Function: POST /api/videos/save-metadata
// Save video metadata with external URL (no file upload needed)

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { title, videoUrl, type, duration, userId } = req.body;

    if (!videoUrl) {
      return res.status(400).json({ error: 'Geen video URL' });
    }

    const timestamp = Date.now();
    const videoMetadata = {
      id: `vid_${timestamp}`,
      title: title || 'Untitled Video',
      type: type || 'ai-generated',
      videoUrl: videoUrl, // Shotstack URL or any external URL
      duration: duration || 0,
      createdAt: new Date().toISOString(),
      userId: userId || null,
    };

    console.log('[SaveMetadata] Video saved:', videoMetadata.id, videoMetadata.title);

    return res.status(200).json({
      success: true,
      video: videoMetadata,
    });

  } catch (error) {
    console.error('[SaveMetadata] Error:', error);
    return res.status(500).json({ 
      error: 'Opslaan mislukt', 
      detail: error.message 
    });
  }
}
