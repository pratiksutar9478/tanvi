const { Pool } = require('pg');

let pool;
let initPromise;

function getPool() {
    if (!pool) {
        if (!process.env.DATABASE_URL) {
            throw new Error('DATABASE_URL is missing. Configure it in Vercel environment variables.');
        }
        pool = new Pool({
            connectionString: process.env.DATABASE_URL,
            ssl: {
                rejectUnauthorized: false
            }
        });
    }

    return pool;
}

async function initDatabase() {
    if (initPromise) return initPromise;

    const db = getPool();
    initPromise = (async () => {
        await db.query(`
            CREATE TABLE IF NOT EXISTS accounts (
                id SERIAL PRIMARY KEY,
                email TEXT UNIQUE NOT NULL,
                username TEXT NOT NULL,
                password TEXT NOT NULL,
                user_data JSONB DEFAULT '{}',
                created_at TIMESTAMP DEFAULT NOW()
            )
        `);

        await db.query(`
            CREATE INDEX IF NOT EXISTS idx_accounts_email
            ON accounts(email)
        `);

        await db.query(`
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

        await db.query(`
            CREATE INDEX IF NOT EXISTS idx_practice_sessions_user_email
            ON practice_sessions(user_email)
        `);
    })();

    return initPromise;
}

module.exports = {
    getPool,
    initDatabase
};
