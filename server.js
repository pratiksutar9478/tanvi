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

// ===== GROQ AI ENDPOINTS =====
const hasGroqKey = Boolean(process.env.GROQ_API_KEY && process.env.GROQ_API_KEY.trim());

async function callGroqAPI(messages) {
    try {
        if (!hasGroqKey) {
            throw new Error('GROQ_API_KEY missing');
        }

        const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: 'llama-3.3-70b-versatile',
                messages: messages,
                max_tokens: 500,
                temperature: 0.7
            })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error?.message || 'Groq API error');
        }

        const data = await response.json();
        return data.choices[0].message.content;
    } catch (error) {
        console.error('Groq API error:', error);
        throw error;
    }
}

app.post('/api/analyze-speech', async (req, res) => {
    try {
        const { speechText, taskText } = req.body;

        if (!speechText || !taskText) {
            return res.status(400).json({ ok: false, message: 'Missing speechText or taskText' });
        }

        if (!hasGroqKey) {
            return res.json({
                ok: true,
                analysis: {
                    overallScore: 72,
                    clarityScore: 74,
                    confidenceScore: 68,
                    fluencyScore: 73,
                    strengths: ['Clear attempt to stay on topic', 'Good effort and consistency'],
                    improvements: ['Add more pauses to reduce filler words', 'Use stronger opening and closing lines'],
                    tips: ['Practice 2 minutes daily with a timer', 'Record and replay to spot pacing issues']
                },
                source: 'fallback-no-groq-key'
            });
        }

        const prompt = `You are a professional speaking coach. Analyze this speech and provide feedback. 
        
Task: ${taskText}
Speech: "${speechText}"

Provide detailed analysis with:
1. Overall score (0-100)
2. Clarity score (0-100) - how clear and understandable
3. Confidence score (0-100) - how confident the speaker sounds
4. Fluency score (0-100) - how smoothly the speech flows
5. Key strengths (2-3 bullet points)
6. Areas for improvement (2-3 bullet points)
7. Specific actionable tips

Format your response as JSON with these exact keys: overallScore, clarityScore, confidenceScore, fluencyScore, strengths (array), improvements (array), tips (array)`;

        const analysis = await callGroqAPI([
            { role: 'user', content: prompt }
        ]);

        // Parse the response (handle both JSON and text formats)
        let parsedAnalysis;
        try {
            const jsonMatch = analysis.match(/\{[\s\S]*\}/);
            parsedAnalysis = jsonMatch ? JSON.parse(jsonMatch[0]) : JSON.parse(analysis);
        } catch (e) {
            console.error('Failed to parse Groq response:', e);
            // Fallback to basic structure if parsing fails
            parsedAnalysis = {
                overallScore: 75,
                clarityScore: 75,
                confidenceScore: 70,
                fluencyScore: 75,
                strengths: ['Good effort', 'Clear articulation'],
                improvements: ['Practice more regularly', 'Work on pacing'],
                tips: ['Record yourself for feedback', 'Practice in front of mirror']
            };
        }

        res.json({ ok: true, analysis: parsedAnalysis });
    } catch (error) {
        console.error('Speech analysis failed:', error);
        res.status(500).json({ ok: false, message: 'Failed to analyze speech', error: error.message });
    }
});

app.post('/api/chatbot', async (req, res) => {
    try {
        const { message, conversationHistory = [] } = req.body;

        if (!message) {
            return res.status(400).json({ ok: false, message: 'Missing message' });
        }

        if (!hasGroqKey) {
            return res.json({
                ok: true,
                response: 'I can still coach you without cloud AI. Try this: speak for 60 seconds on one topic, avoid filler words, and end with one strong summary sentence.',
                source: 'fallback-no-groq-key'
            });
        }

        const systemPrompt = `You are SpeakBoost Coach, an AI speaking coach assistant. You help users improve their public speaking, presentation skills, confidence, and communication abilities. You're friendly, encouraging, and provide practical tips.

Provide helpful, concise responses focused on speaking improvement. If asked about topics unrelated to speaking, politely redirect to speaking skills.`;

        const messages = [
            { role: 'system', content: systemPrompt },
            ...conversationHistory,
            { role: 'user', content: message }
        ];

        const response = await callGroqAPI(messages);

        res.json({ ok: true, response: response });
    } catch (error) {
        console.error('Chatbot failed:', error);
        res.status(500).json({ ok: false, message: 'Failed to process message', error: error.message });
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
        if (!hasGroqKey) {
            console.warn('GROQ_API_KEY is not set. Chatbot and AI analysis will use local fallback responses.');
        }
        startServer(PORT);
    })
    .catch((error) => {
        console.error('Database initialization failed:', error);
        process.exit(1);
    });
