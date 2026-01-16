// Vercel Serverless Function: POST /api/videos/upload
// Upload generated video to Vercel Blob Storage

import { put } from '@vercel/blob';

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '100mb', // Max video size
    },
  },
  maxDuration: 60, // 60 seconds max execution time
};

export default async function handler(req, res) {
  // CORS headers
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
    const { videoData, title, type, duration, width, height, thumbnail } = req.body;

    if (!videoData) {
      return res.status(400).json({ error: 'Geen video data' });
    }

    // Check if BLOB_READ_WRITE_TOKEN is configured
    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      console.error('[VideoUpload] BLOB_READ_WRITE_TOKEN not configured');
      return res.status(500).json({ 
        error: 'Blob Storage niet geconfigureerd',
        detail: 'Voeg BLOB_READ_WRITE_TOKEN toe aan Vercel environment variables'
      });
    }

    // Convert base64 to buffer
    const base64Data = videoData.replace(/^data:video\/\w+;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');

    // Generate unique filename
    const timestamp = Date.now();
    const filename = `videos/${timestamp}-${title?.replace(/[^a-z0-9]/gi, '-').toLowerCase() || 'video'}.mp4`;

    console.log('[VideoUpload] Uploading to Blob Storage:', {
      filename,
      size: buffer.length,
      title
    });

    // Upload to Vercel Blob Storage
    const blob = await put(filename, buffer, {
      access: 'public',
      contentType: 'video/mp4',
      token: process.env.BLOB_READ_WRITE_TOKEN,
    });

    // Upload thumbnail if provided
    let thumbnailUrl = null;
    if (thumbnail) {
      const thumbBase64 = thumbnail.replace(/^data:image\/\w+;base64,/, '');
      const thumbBuffer = Buffer.from(thumbBase64, 'base64');
      const thumbFilename = `thumbnails/${timestamp}-${title?.replace(/[^a-z0-9]/gi, '-').toLowerCase() || 'thumb'}.jpg`;
      
      const thumbBlob = await put(thumbFilename, thumbBuffer, {
        access: 'public',
        contentType: 'image/jpeg',
        token: process.env.BLOB_READ_WRITE_TOKEN,
      });
      
      thumbnailUrl = thumbBlob.url;
    }

    // Store metadata (in production, use a database)
    // For now, we'll return the data and let the client store it
    const videoMetadata = {
      id: `vid_${timestamp}`,
      title: title || 'Untitled Video',
      type: type || 'generated',
      videoUrl: blob.url,
      thumbnail: thumbnailUrl,
      duration: duration || 0,
      width: width || 1920,
      height: height || 1080,
      size: buffer.length,
      createdAt: new Date().toISOString(),
    };

    console.log('[VideoUpload] Upload successful:', videoMetadata.id);

    return res.status(200).json({
      success: true,
      video: videoMetadata,
    });

  } catch (error) {
    console.error('[VideoUpload] Error:', error);
    return res.status(500).json({ 
      error: 'Upload mislukt', 
      detail: error.message 
    });
  }
}
