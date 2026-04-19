const { getPool, initDatabase } = require('../_lib/db');

module.exports = async function handler(req, res) {
    try {
        await initDatabase();

        const { email } = req.query;
        if (!email) {
            return res.status(400).json({ ok: false, message: 'Missing email' });
        }

        if (req.method === 'GET') {
            const result = await getPool().query(
                'SELECT email, username, user_data FROM accounts WHERE email = $1',
                [email]
            );

            if (result.rows.length === 0) {
                return res.status(404).json({ ok: false, message: 'User not found' });
            }

            const account = result.rows[0];
            const userData = typeof account.user_data === 'string'
                ? JSON.parse(account.user_data)
                : account.user_data;

            return res.status(200).json({
                ok: true,
                user: {
                    email: account.email,
                    username: account.username,
                    ...userData
                }
            });
        }

        if (req.method === 'POST') {
            const { userData } = req.body || {};
            if (!userData) {
                return res.status(400).json({ ok: false, message: 'Missing userData' });
            }

            await getPool().query(
                'UPDATE accounts SET user_data = $1 WHERE email = $2',
                [JSON.stringify(userData), email]
            );

            return res.status(200).json({ ok: true, message: 'User data updated' });
        }

        return res.status(405).json({ ok: false, message: 'Method not allowed' });
    } catch (error) {
        console.error('User handler failed:', error);
        return res.status(500).json({ ok: false, message: 'Request failed' });
    }
};
