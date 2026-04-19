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
