const { callGroqAPI } = require('./_lib/groq');

module.exports = async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ ok: false, message: 'Method not allowed' });
    }

    try {
        const { speechText, taskText } = req.body || {};

        if (!speechText || !taskText) {
            return res.status(400).json({ ok: false, message: 'Missing speechText or taskText' });
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

        const analysis = await callGroqAPI([{ role: 'user', content: prompt }]);

        let parsedAnalysis;
        try {
            const jsonMatch = analysis.match(/\{[\s\S]*\}/);
            parsedAnalysis = jsonMatch ? JSON.parse(jsonMatch[0]) : JSON.parse(analysis);
        } catch (error) {
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

        return res.status(200).json({ ok: true, analysis: parsedAnalysis });
    } catch (error) {
        console.error('Analyze speech failed:', error);
        return res.status(500).json({ ok: false, message: 'Failed to analyze speech', error: error.message });
    }
};
