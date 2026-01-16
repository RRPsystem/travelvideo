// Vercel Serverless Function: DELETE /api/videos/delete
// Delete a video from Vercel Blob Storage

import { del } from '@vercel/blob';

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'DELETE, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'DELETE' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { videoUrl, videoId } = req.body;

    if (!videoUrl) {
      return res.status(400).json({ error: 'videoUrl is required' });
    }

    // Check if BLOB_READ_WRITE_TOKEN is configured
    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      console.error('[VideoDelete] BLOB_READ_WRITE_TOKEN not configured');
      return res.status(500).json({ 
        error: 'Blob Storage niet geconfigureerd',
        detail: 'Voeg BLOB_READ_WRITE_TOKEN toe aan Vercel environment variables'
      });
    }

    console.log('[VideoDelete] Deleting video:', videoUrl);

    // Delete from Vercel Blob Storage
    await del(videoUrl, {
      token: process.env.BLOB_READ_WRITE_TOKEN,
    });

    // Also try to delete thumbnail if it exists
    const thumbnailUrl = videoUrl.replace('/videos/', '/thumbnails/').replace('.mp4', '.jpg');
    try {
      await del(thumbnailUrl, {
        token: process.env.BLOB_READ_WRITE_TOKEN,
      });
    } catch (e) {
      // Thumbnail might not exist, ignore error
    }

    console.log('[VideoDelete] Video deleted successfully');

    return res.status(200).json({
      success: true,
      message: 'Video verwijderd',
      deletedUrl: videoUrl,
    });

  } catch (error) {
    console.error('[VideoDelete] Error:', error);
    return res.status(500).json({ 
      error: 'Verwijderen mislukt', 
      detail: error.message 
    });
  }
}
