const { getPool, initDatabase } = require('./_lib/db');

module.exports = async function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ ok: false, message: 'Method not allowed' });
    }

    try {
        await initDatabase();
        const result = await getPool().query('SELECT NOW() AS server_time');
        return res.status(200).json({ ok: true, databaseTime: result.rows[0].server_time });
    } catch (error) {
        console.error('Health check failed:', error);
        return res.status(500).json({ ok: false, message: 'Database connection failed' });
    }
};
