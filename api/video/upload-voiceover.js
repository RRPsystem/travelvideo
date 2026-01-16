// Vercel Serverless Function: POST /api/video/upload-voiceover
import { put } from '@vercel/blob';

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req, res) {
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
    const chunks = [];
    for await (const chunk of req) {
      chunks.push(chunk);
    }
    const buffer = Buffer.concat(chunks);

    const timestamp = Date.now();
    const filename = `voiceovers/voiceover-${timestamp}.mp3`;

    const blobToken = process.env.BLOB_READ_WRITE_TOKEN;
    
    if (!blobToken) {
      return res.status(200).json({
        success: true,
        message: 'Voice-over ontvangen (geen cloud storage)',
        url: null
      });
    }

    const blob = await put(filename, buffer, {
      access: 'public',
      contentType: 'audio/mpeg',
      token: blobToken,
    });

    return res.status(200).json({
      success: true,
      message: 'Voice-over geüpload',
      url: blob.url,
      size: buffer.length
    });

  } catch (error) {
    console.error('[VoiceoverUpload] Error:', error);
    return res.status(500).json({ 
      error: 'Upload mislukt', 
      detail: error.message 
    });
  }
}
