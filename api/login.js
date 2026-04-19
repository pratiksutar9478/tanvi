const { getPool, initDatabase } = require('./_lib/db');

module.exports = async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ ok: false, message: 'Method not allowed' });
    }

    try {
        await initDatabase();

        const { email, username, password } = req.body || {};

        if (!email || !username || !password) {
            return res.status(400).json({ ok: false, message: 'Missing required fields' });
        }

        const result = await getPool().query('SELECT * FROM accounts WHERE email = $1', [email]);
        if (result.rows.length === 0) {
            return res.status(401).json({ ok: false, message: 'No account found' });
        }

        const account = result.rows[0];
        if (account.password !== password) {
            return res.status(401).json({ ok: false, message: 'Wrong password' });
        }

        if (account.username !== username) {
            return res.status(401).json({ ok: false, message: 'Username mismatch' });
        }

        const userData = typeof account.user_data === 'string'
            ? JSON.parse(account.user_data)
            : account.user_data;

        return res.status(200).json({
            ok: true,
            message: 'Login successful',
            user: {
                email: account.email,
                username: account.username,
                ...userData
            }
        });
    } catch (error) {
        console.error('Login failed:', error);
        return res.status(500).json({ ok: false, message: 'Login failed' });
    }
};
