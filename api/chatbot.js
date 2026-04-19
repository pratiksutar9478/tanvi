const { callGroqAPI } = require('./_lib/groq');

module.exports = async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ ok: false, message: 'Method not allowed' });
    }

    try {
        const { message, conversationHistory = [] } = req.body || {};

        if (!message) {
            return res.status(400).json({ ok: false, message: 'Missing message' });
        }

        const systemPrompt = `You are SpeakBoost Coach, an AI speaking coach assistant. You help users improve their public speaking, presentation skills, confidence, and communication abilities. You're friendly, encouraging, and provide practical tips.

Provide helpful, concise responses focused on speaking improvement. If asked about topics unrelated to speaking, politely redirect to speaking skills.`;

        const messages = [
            { role: 'system', content: systemPrompt },
            ...conversationHistory,
            { role: 'user', content: message }
        ];

        const response = await callGroqAPI(messages);
        return res.status(200).json({ ok: true, response });
    } catch (error) {
        console.error('Chatbot failed:', error);
        return res.status(500).json({ ok: false, message: 'Failed to process message', error: error.message });
    }
};
