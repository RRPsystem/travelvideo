// Vercel Serverless Function: POST /api/videos/upload-direct
// Direct upload using FormData (bypasses JSON payload limit)

const { put } = require('@vercel/blob');

// Disable body parser to handle raw stream
module.exports.config = {
  api: {
    bodyParser: false,
  },
};

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
    // Check if BLOB_READ_WRITE_TOKEN is configured
    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      console.error('[VideoUploadDirect] BLOB_READ_WRITE_TOKEN not configured');
      return res.status(500).json({ 
        error: 'Blob Storage niet geconfigureerd',
        detail: 'Voeg BLOB_READ_WRITE_TOKEN toe aan Vercel environment variables'
      });
    }

    // Collect chunks from the request stream
    const chunks = [];
    for await (const chunk of req) {
      chunks.push(chunk);
    }
    const buffer = Buffer.concat(chunks);

    // Parse multipart form data manually (simple implementation)
    const contentType = req.headers['content-type'] || '';
    const boundaryMatch = contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/i);
    
    if (!boundaryMatch) {
      return res.status(400).json({ error: 'Invalid content type - boundary not found' });
    }

    const boundary = boundaryMatch[1] || boundaryMatch[2];
    const parts = buffer.toString('binary').split('--' + boundary);
    
    let fileBuffer = null;
    let filename = 'video.mp4';

    for (const part of parts) {
      if (part.includes('Content-Disposition: form-data')) {
        const filenameMatch = part.match(/filename="([^"]+)"/);
        if (filenameMatch) {
          filename = filenameMatch[1];
        }

        // Find the start of file content (after double CRLF)
        const headerEnd = part.indexOf('\r\n\r\n');
        if (headerEnd !== -1) {
          const content = part.substring(headerEnd + 4);
          // Remove trailing CRLF
          const cleanContent = content.replace(/\r\n$/, '');
          fileBuffer = Buffer.from(cleanContent, 'binary');
        }
      }
    }

    if (!fileBuffer || fileBuffer.length === 0) {
      return res.status(400).json({ error: 'Geen video bestand gevonden' });
    }

    console.log('[VideoUploadDirect] Uploading:', {
      filename,
      size: fileBuffer.length
    });

    // Upload to Vercel Blob Storage
    const blob = await put(filename, fileBuffer, {
      access: 'public',
      contentType: 'video/mp4',
      token: process.env.BLOB_READ_WRITE_TOKEN,
    });

    const timestamp = Date.now();
    const videoMetadata = {
      id: `vid_${timestamp}`,
      title: filename.replace(/^\d+-/, '').replace(/\.mp4$/, '').replace(/-/g, ' '),
      videoUrl: blob.url,
      size: fileBuffer.length,
      createdAt: new Date().toISOString(),
    };

    console.log('[VideoUploadDirect] Upload successful:', videoMetadata.id);

    return res.status(200).json({
      success: true,
      video: videoMetadata,
    });

  } catch (error) {
    console.error('[VideoUploadDirect] Error:', error);
    return res.status(500).json({ 
      error: 'Upload mislukt', 
      detail: error.message 
    });
  }
}
