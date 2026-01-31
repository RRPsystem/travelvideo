// Vercel Serverless Function: POST /api/videos/get-upload-url
// Generate a client upload token for direct Blob upload

const { handleUpload } = require('@vercel/blob/client');

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
    const body = await handleUpload({
      body: req.body,
      request: req,
      onBeforeGenerateToken: async (pathname) => {
        // Validate the upload path
        return {
          allowedContentTypes: ['video/mp4', 'video/webm', 'video/quicktime'],
          maximumSizeInBytes: 500 * 1024 * 1024, // 500MB max
          tokenPayload: JSON.stringify({
            uploadedAt: new Date().toISOString(),
          }),
        };
      },
      onUploadCompleted: async ({ blob, tokenPayload }) => {
        console.log('[BlobUpload] Upload completed:', blob.url);
      },
    });

    return res.status(200).json(body);
  } catch (error) {
    console.error('[GetUploadUrl] Error:', error);
    return res.status(500).json({ 
      error: 'Token generatie mislukt', 
      detail: error.message 
    });
  }
}
