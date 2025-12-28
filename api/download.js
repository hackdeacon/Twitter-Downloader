const fetch = require('node-fetch');

module.exports = async (req, res) => {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Cors', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { url, preview } = req.query;

        if (!url) {
            return res.status(400).json({ error: 'URL parameter is required' });
        }

        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Referer': 'https://twitter.com/'
            }
        });

        if (!response.ok) {
            throw new Error('Failed to fetch video');
        }

        const contentLength = response.headers.get('content-length');

        res.setHeader('Content-Type', 'video/mp4');
        res.setHeader('Accept-Ranges', 'bytes');

        if (contentLength) {
            res.setHeader('Content-Length', contentLength);
        }

        if (preview !== 'true') {
            res.setHeader('Content-Disposition', `attachment; filename="twitter-video-${Date.now()}.mp4"`);
        }

        response.body.pipe(res);

    } catch (error) {
        console.error('Download error:', error);
        res.status(500).json({ error: 'Failed to download video' });
    }
};
