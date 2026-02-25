// Vercel Serverless Function: POST /api/videos/upload-blob
// Upload video file to Vercel Blob Storage using FormData

const { put } = require('@vercel/blob');

// Vercel serverless config for file uploads
module.exports.config = {
  api: {
    bodyParser: false, // Disable default body parser for file uploads
  },
};

module.exports = async function handler(req, res) {
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
    // Check if BLOB_READ_WRITE_TOKEN is configured
    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      console.error('[VideoUploadBlob] BLOB_READ_WRITE_TOKEN not configured');
      return res.status(500).json({ 
        error: 'Blob Storage niet geconfigureerd',
        detail: 'Voeg BLOB_READ_WRITE_TOKEN toe aan Vercel environment variables'
      });
    }

    // Parse multipart form data
    const chunks = [];
    for await (const chunk of req) {
      chunks.push(chunk);
    }
    const buffer = Buffer.concat(chunks);

    // Parse multipart boundary
    const contentType = req.headers['content-type'] || '';
    const boundaryMatch = contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/i);
    if (!boundaryMatch) {
      return res.status(400).json({ error: 'Invalid multipart request' });
    }
    const boundary = boundaryMatch[1] || boundaryMatch[2];

    // Simple multipart parser
    const parts = parseMultipart(buffer, boundary);
    
    const videoFile = parts.find(p => p.name === 'video');
    const title = parts.find(p => p.name === 'title')?.value || 'Untitled Video';
    const userId = parts.find(p => p.name === 'userId')?.value || '';
    const duration = parseInt(parts.find(p => p.name === 'duration')?.value || '0', 10);

    if (!videoFile || !videoFile.data) {
      return res.status(400).json({ error: 'Geen video bestand ontvangen' });
    }

    // Generate unique filename with user isolation
    const timestamp = Date.now();
    const safeTitle = title.replace(/[^a-z0-9]/gi, '-').toLowerCase();
    const basePath = userId ? `videos/${userId}` : 'videos/public';
    const filename = `${basePath}/${timestamp}-${safeTitle}.mp4`;

    console.log('[VideoUploadBlob] Uploading:', {
      filename,
      size: videoFile.data.length,
      title,
      userId
    });

    // Upload to Vercel Blob Storage
    const blob = await put(filename, videoFile.data, {
      access: 'public',
      contentType: 'video/mp4',
      token: process.env.BLOB_READ_WRITE_TOKEN,
    });

    const videoMetadata = {
      id: `vid_${timestamp}`,
      title: title,
      type: 'ai-generated',
      videoUrl: blob.url,
      thumbnail: blob.url, // Use video URL as thumbnail for now
      duration: duration,
      size: videoFile.data.length,
      createdAt: new Date().toISOString(),
      userId: userId || null,
    };

    console.log('[VideoUploadBlob] Upload successful:', videoMetadata.id);

    return res.status(200).json({
      success: true,
      video: videoMetadata,
    });

  } catch (error) {
    console.error('[VideoUploadBlob] Error:', error);
    return res.status(500).json({ 
      error: 'Upload mislukt', 
      detail: error.message 
    });
  }
};

// Simple multipart parser
function parseMultipart(buffer, boundary) {
  const parts = [];
  const boundaryBuffer = Buffer.from(`--${boundary}`);
  const endBoundary = Buffer.from(`--${boundary}--`);
  
  let start = buffer.indexOf(boundaryBuffer);
  
  while (start !== -1) {
    const nextBoundary = buffer.indexOf(boundaryBuffer, start + boundaryBuffer.length);
    if (nextBoundary === -1) break;
    
    const partData = buffer.slice(start + boundaryBuffer.length, nextBoundary);
    const headerEnd = partData.indexOf('\r\n\r\n');
    
    if (headerEnd !== -1) {
      const headers = partData.slice(0, headerEnd).toString();
      const content = partData.slice(headerEnd + 4);
      
      // Remove trailing \r\n
      const cleanContent = content.slice(0, content.length - 2);
      
      // Parse Content-Disposition
      const nameMatch = headers.match(/name="([^"]+)"/);
      const filenameMatch = headers.match(/filename="([^"]+)"/);
      
      if (nameMatch) {
        const part = {
          name: nameMatch[1],
          filename: filenameMatch ? filenameMatch[1] : null,
        };
        
        if (filenameMatch) {
          part.data = cleanContent;
        } else {
          part.value = cleanContent.toString();
        }
        
        parts.push(part);
      }
    }
    
    start = nextBoundary;
  }
  
  return parts;
}
