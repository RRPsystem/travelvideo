// Server-side handler for video status check
const axios = require('axios');

module.exports = async function(req, res) {
  try {
    const {
      SHOTSTACK_API_KEY = '',
      SHOTSTACK_ENV = 'stage'
    } = process.env;

    if (!SHOTSTACK_API_KEY) {
      return res.status(500).json({ error: 'Missing SHOTSTACK_API_KEY' });
    }

    const { id } = req.query;
    
    if (!id) {
      return res.status(400).json({ error: 'Missing render ID' });
    }

    const baseUrl = SHOTSTACK_ENV === 'v1' 
      ? 'https://api.shotstack.io/v1' 
      : 'https://api.shotstack.io/stage';
    
    const url = `${baseUrl}/render/${id}`;
    
    const response = await axios.get(url, {
      headers: {
        'x-api-key': SHOTSTACK_API_KEY
      }
    });

    const data = response.data.response;

    const statusMessages = {
      'queued': 'Video staat in de wachtrij...',
      'fetching': 'Video clips worden opgehaald...',
      'rendering': 'Video wordt gegenereerd...',
      'saving': 'Video wordt opgeslagen...',
      'done': 'Video is klaar!',
      'failed': 'Video generatie mislukt'
    };

    return res.status(200).json({
      id: data.id,
      status: data.status,
      message: statusMessages[data.status] || data.status,
      progress: data.status === 'done' ? 100 : 
                data.status === 'rendering' ? 75 :
                data.status === 'fetching' ? 50 :
                data.status === 'queued' ? 25 : 0,
      url: data.url || null,
      thumbnail: data.thumbnail || null,
      duration: data.duration || null,
      error: data.error || null,
      created: data.created,
      updated: data.updated
    });

  } catch (error) {
    console.error('[VideoStatus] Error:', error);
    return res.status(500).json({ 
      error: 'Status check mislukt', 
      detail: error.message 
    });
  }
};
