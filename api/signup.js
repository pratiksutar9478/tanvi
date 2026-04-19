const { getPool, initDatabase } = require('./_lib/db');

module.exports = async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ ok: false, message: 'Method not allowed' });
    }

    try {
        await initDatabase();

        const { email, username, password, userData } = req.body || {};

        if (!email || !username || !password) {
            return res.status(400).json({ ok: false, message: 'Missing required fields' });
        }

        const existing = await getPool().query('SELECT id FROM accounts WHERE email = $1', [email]);
        if (existing.rows.length > 0) {
            return res.status(400).json({ ok: false, message: 'Account already exists' });
        }

        const defaultUserData = userData || {
            stats: { streak: 0, retention: 0, confidence: 0, totalPracticeMinutes: 0, lastPracticeDate: null },
            practiceSessions: [],
            goal: { type: 'Confidence', focus: 'Fluency', duration: 14, startDate: new Date().toISOString() },
            unlockedAchievements: []
        };

        await getPool().query(
            'INSERT INTO accounts (email, username, password, user_data) VALUES ($1, $2, $3, $4)',
            [email, username, password, JSON.stringify(defaultUserData)]
        );

        return res.status(201).json({ ok: true, message: 'Signup successful' });
    } catch (error) {
        console.error('Signup failed:', error);
        return res.status(500).json({ ok: false, message: 'Signup failed' });
    }
};
