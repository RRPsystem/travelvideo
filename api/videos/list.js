// Vercel Serverless Function: GET /api/videos/list
// List all uploaded videos from Vercel Blob Storage

import { list } from '@vercel/blob';

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
    // Check if BLOB_READ_WRITE_TOKEN is configured
    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      console.error('[VideoList] BLOB_READ_WRITE_TOKEN not configured');
      return res.status(500).json({ 
        error: 'Blob Storage niet geconfigureerd',
        detail: 'Voeg BLOB_READ_WRITE_TOKEN toe aan Vercel environment variables'
      });
    }

    // List all videos from Blob Storage
    const { blobs } = await list({
      prefix: 'videos/',
      token: process.env.BLOB_READ_WRITE_TOKEN,
    });

    console.log('[VideoList] Found', blobs.length, 'videos');

    // Transform blob data to video metadata
    const videos = blobs.map(blob => {
      // Extract filename without path
      const filename = blob.pathname.split('/').pop();
      const nameWithoutExt = filename.replace('.mp4', '');
      
      // Try to extract timestamp and title
      const parts = nameWithoutExt.split('-');
      const timestamp = parts[0];
      const title = parts.slice(1).join(' ') || 'Untitled Video';

      return {
        id: `vid_${timestamp}`,
        title: title.charAt(0).toUpperCase() + title.slice(1),
        type: 'generated',
        videoUrl: blob.url,
        thumbnail: blob.url.replace('/videos/', '/thumbnails/').replace('.mp4', '.jpg'),
        size: blob.size,
        uploadedAt: blob.uploadedAt,
        createdAt: blob.uploadedAt,
      };
    });

    // Sort by upload date (newest first)
    videos.sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt));

    return res.status(200).json({
      success: true,
      videos,
      count: videos.length,
    });

  } catch (error) {
    console.error('[VideoList] Error:', error);
    return res.status(500).json({ 
      error: 'Ophalen mislukt', 
      detail: error.message 
    });
  }
}
