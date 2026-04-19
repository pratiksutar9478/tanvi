const { getPool, initDatabase } = require('./_lib/db');

module.exports = async function handler(req, res) {
    try {
        await initDatabase();

        if (req.method === 'POST') {
            const {
                userEmail,
                username,
                date,
                task,
                durationMinutes,
                notes,
                confidence,
                clarity,
                fluency
            } = req.body || {};

            if (!userEmail || !username || !date || !task || !durationMinutes || !notes) {
                return res.status(400).json({ ok: false, message: 'Missing required fields' });
            }

            await getPool().query(
                `INSERT INTO practice_sessions
                (user_email, username, session_date, task, duration_minutes, notes, confidence, clarity, fluency)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
                [
                    userEmail,
                    username,
                    date,
                    task,
                    durationMinutes,
                    notes,
                    confidence ?? 0,
                    clarity ?? 0,
                    fluency ?? 0
                ]
            );

            return res.status(201).json({ ok: true });
        }

        if (req.method === 'GET') {
            const userEmail = req.query.userEmail;
            if (!userEmail) {
                return res.status(400).json({ ok: false, message: 'Missing userEmail query parameter' });
            }

            const result = await getPool().query(
                `SELECT session_date, task, duration_minutes, notes, confidence, clarity, fluency, created_at
                 FROM practice_sessions
                 WHERE user_email = $1
                 ORDER BY created_at DESC
                 LIMIT 100`,
                [userEmail]
            );

            return res.status(200).json({ ok: true, sessions: result.rows });
        }

        return res.status(405).json({ ok: false, message: 'Method not allowed' });
    } catch (error) {
        console.error('Practice sessions handler failed:', error);
        return res.status(500).json({ ok: false, message: 'Database request failed' });
    }
};
