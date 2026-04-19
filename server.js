const path = require('path');
const express = require('express');
const { Pool } = require('pg');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;
const MAX_PORT_ATTEMPTS = 20;

if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL is missing. Create a .env file with your Neon PostgreSQL connection string.');
    process.exit(1);
}

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
});

async function initDatabase() {
    await pool.query(`
        CREATE TABLE IF NOT EXISTS accounts (
            id SERIAL PRIMARY KEY,
            email TEXT UNIQUE NOT NULL,
            username TEXT NOT NULL,
            password TEXT NOT NULL,
            user_data JSONB DEFAULT '{}',
            created_at TIMESTAMP DEFAULT NOW()
        )
    `);

    await pool.query(`
        CREATE INDEX IF NOT EXISTS idx_accounts_email
        ON accounts(email)
    `);

    await pool.query(`
        CREATE TABLE IF NOT EXISTS practice_sessions (
            id SERIAL PRIMARY KEY,
            user_email TEXT NOT NULL,
            username TEXT NOT NULL,
            session_date DATE NOT NULL,
            task TEXT NOT NULL,
            duration_minutes INTEGER NOT NULL,
            notes TEXT NOT NULL,
            confidence INTEGER NOT NULL,
            clarity INTEGER NOT NULL,
            fluency INTEGER NOT NULL,
            created_at TIMESTAMP DEFAULT NOW()
        )
    `);

    await pool.query(`
        CREATE INDEX IF NOT EXISTS idx_practice_sessions_user_email
        ON practice_sessions(user_email)
    `);
}

app.use(express.json());
app.use(express.static(path.join(__dirname)));

app.get('/api/health', async (req, res) => {
    try {
        const result = await pool.query('SELECT NOW() AS server_time');
        res.json({ ok: true, databaseTime: result.rows[0].server_time });
    } catch (error) {
        console.error('Health check failed:', error);
        res.status(500).json({ ok: false, message: 'Database connection failed' });
    }
});

// ===== AUTHENTICATION ENDPOINTS =====
app.post('/api/signup', async (req, res) => {
    try {
        const { email, username, password, userData } = req.body;

        if (!email || !username || !password) {
            return res.status(400).json({ ok: false, message: 'Missing required fields' });
        }

        // Check if account exists
        const existing = await pool.query('SELECT id FROM accounts WHERE email = $1', [email]);
        if (existing.rows.length > 0) {
            return res.status(400).json({ ok: false, message: 'Account already exists' });
        }

        // Insert new account
        const defaultUserData = userData || {
            stats: { streak: 0, retention: 0, confidence: 0, totalPracticeMinutes: 0, lastPracticeDate: null },
            practiceSessions: [],
            goal: { type: 'Confidence', focus: 'Fluency', duration: 14, startDate: new Date().toISOString() },
            unlockedAchievements: []
        };

        await pool.query(
            'INSERT INTO accounts (email, username, password, user_data) VALUES ($1, $2, $3, $4)',
            [email, username, password, JSON.stringify(defaultUserData)]
        );

        res.status(201).json({ ok: true, message: 'Signup successful' });
    } catch (error) {
        console.error('Signup failed:', error);
        res.status(500).json({ ok: false, message: 'Signup failed' });
    }
});

app.post('/api/login', async (req, res) => {
    try {
        const { email, username, password } = req.body;

        if (!email || !username || !password) {
            return res.status(400).json({ ok: false, message: 'Missing required fields' });
        }

        const result = await pool.query(
            'SELECT * FROM accounts WHERE email = $1',
            [email]
        );

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

        res.json({ 
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
        res.status(500).json({ ok: false, message: 'Login failed' });
    }
});

app.get('/api/user/:email', async (req, res) => {
    try {
        const { email } = req.params;

        const result = await pool.query(
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

        res.json({ 
            ok: true, 
            user: {
                email: account.email,
                username: account.username,
                ...userData
            }
        });
    } catch (error) {
        console.error('Failed to fetch user:', error);
        res.status(500).json({ ok: false, message: 'Failed to fetch user' });
    }
});

app.post('/api/user/:email', async (req, res) => {
    try {
        const { email } = req.params;
        const { userData } = req.body;

        if (!userData) {
            return res.status(400).json({ ok: false, message: 'Missing userData' });
        }

        await pool.query(
            'UPDATE accounts SET user_data = $1 WHERE email = $2',
            [JSON.stringify(userData), email]
        );

        res.json({ ok: true, message: 'User data updated' });
    } catch (error) {
        console.error('Failed to update user:', error);
        res.status(500).json({ ok: false, message: 'Failed to update user' });
    }
});

app.post('/api/practice-sessions', async (req, res) => {
    try {
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
        } = req.body;

        if (!userEmail || !username || !date || !task || !durationMinutes || !notes) {
            return res.status(400).json({ ok: false, message: 'Missing required fields' });
        }

        await pool.query(
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
                confidence,
                clarity,
                fluency
            ]
        );

        res.status(201).json({ ok: true });
    } catch (error) {
        console.error('Failed to save practice session:', error);
        res.status(500).json({ ok: false, message: 'Failed to save practice session' });
    }
});

app.get('/api/practice-sessions/:userEmail', async (req, res) => {
    try {
        const { userEmail } = req.params;

        const result = await pool.query(
            `SELECT session_date, task, duration_minutes, notes, confidence, clarity, fluency, created_at
             FROM practice_sessions
             WHERE user_email = $1
             ORDER BY created_at DESC
             LIMIT 100`,
            [userEmail]
        );

        res.json({ ok: true, sessions: result.rows });
    } catch (error) {
        console.error('Failed to fetch practice sessions:', error);
        res.status(500).json({ ok: false, message: 'Failed to fetch practice sessions' });
    }
});

app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

function startServer(preferredPort, attempts = 0) {
    const portToTry = Number(preferredPort) + attempts;
    const server = app.listen(portToTry, () => {
        console.log(`Server running on http://localhost:${portToTry}`);
    });

    server.on('error', (error) => {
        if (error.code === 'EADDRINUSE' && attempts < MAX_PORT_ATTEMPTS) {
            console.warn(`Port ${portToTry} in use, trying ${portToTry + 1}...`);
            startServer(preferredPort, attempts + 1);
            return;
        }

        console.error('Server failed to start:', error);
        process.exit(1);
    });
}

initDatabase()
    .then(() => {
        startServer(PORT);
    })
    .catch((error) => {
        console.error('Database initialization failed:', error);
        process.exit(1);
    });
