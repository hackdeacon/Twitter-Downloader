const fetch = require('node-fetch');

module.exports = async (req, res) => {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Cors', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { url } = req.body;

        if (!url) {
            return res.status(400).json({ error: 'URL is required' });
        }

        const tweetId = extractTweetId(url);

        if (!tweetId) {
            return res.status(400).json({ error: 'Invalid Twitter URL' });
        }

        const videoData = await getTwitterVideoData(tweetId);

        res.json({
            success: true,
            data: videoData
        });

    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to fetch video'
        });
    }
};

function extractTweetId(url) {
    const patterns = [
        /twitter\.com\/\w+\/status\/(\d+)/i,
        /x\.com\/\w+\/status\/(\d+)/i
    ];

    for (const pattern of patterns) {
        const match = url.match(pattern);
        if (match) return match[1];
    }
    return null;
}

async function getTwitterVideoData(tweetId) {
    try {
        const syndicationUrl = `https://cdn.syndication.twimg.com/tweet-result?id=${tweetId}&lang=en&token=`;

        const response = await fetch(syndicationUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });

        if (!response.ok) {
            throw new Error('Failed to fetch tweet data');
        }

        const data = await response.json();

        if (!data || !data.mediaDetails || data.mediaDetails.length === 0) {
            throw new Error('No media found in tweet');
        }

        const media = data.mediaDetails.find(m => m.type === 'video' || m.type === 'animated_gif');

        if (!media || !media.video_info) {
            throw new Error('No video found in tweet');
        }

        const variants = media.video_info.variants
            .filter(v => v.content_type === 'video/mp4')
            .map(v => ({
                url: v.url,
                bitrate: v.bitrate || 0,
                quality: determineQuality(v.bitrate)
            }))
            .sort((a, b) => b.bitrate - a.bitrate);

        return {
            title: data.text || 'Twitter Video',
            author: `@${data.user.screen_name}`,
            authorName: data.user.name,
            thumbnail: media.media_url_https,
            duration: formatDuration(media.video_info.duration_millis),
            qualities: variants
        };
    } catch (error) {
        console.error('Syndication API error:', error);
        return await getTwitterVideoDataFallback(tweetId);
    }
}

async function getTwitterVideoDataFallback(tweetId) {
    try {
        const url = `https://api.fxtwitter.com/status/${tweetId}`;

        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });

        if (!response.ok) {
            throw new Error('Failed to fetch from fallback API');
        }

        const data = await response.json();

        if (!data.tweet || !data.tweet.media || !data.tweet.media.videos) {
            throw new Error('No video found');
        }

        const videos = data.tweet.media.videos;
        const variants = videos.map((v, index) => ({
            url: v.url,
            bitrate: (videos.length - index) * 1000000,
            quality: index === 0 ? 'HD' : index === 1 ? 'SD' : 'Low'
        }));

        return {
            title: data.tweet.text || 'Twitter Video',
            author: `@${data.tweet.author.screen_name}`,
            authorName: data.tweet.author.name,
            thumbnail: data.tweet.media.photos?.[0]?.url || '',
            duration: '0:00',
            qualities: variants
        };
    } catch (error) {
        console.error('Fallback API error:', error);
        throw new Error('Unable to fetch video from all sources');
    }
}

function determineQuality(bitrate) {
    if (!bitrate) return 'Unknown';
    if (bitrate >= 2000000) return '1080p';
    if (bitrate >= 1000000) return '720p';
    if (bitrate >= 500000) return '480p';
    if (bitrate >= 250000) return '360p';
    return 'Low';
}

function formatDuration(ms) {
    if (!ms) return '0:00';
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
}
