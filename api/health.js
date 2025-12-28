module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Cors', '*');

    res.json({
        status: 'ok',
        timestamp: new Date().toISOString()
    });
};
