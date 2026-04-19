// ========== SCRIPT.JS - Complete SpeakBoost Pro with Enhanced Chatbot ==========

// ============ AUTH SYSTEM ============
const USERS_KEY = 'speakboost_users_v2';
const CURRENT_USER_KEY = 'speakboost_current';

function getUsers() {
    try {
        return JSON.parse(localStorage.getItem(USERS_KEY) || '{}');
    } catch (error) {
        console.error('Failed to parse local users data:', error);
        localStorage.removeItem(USERS_KEY);
        return {};
    }
}
function saveUsers(users) { localStorage.setItem(USERS_KEY, JSON.stringify(users)); }
function getCurrentUser() { const users = getUsers(); const email = localStorage.getItem(CURRENT_USER_KEY); return email ? users[email] : null; }
function setCurrentUser(email) { localStorage.setItem(CURRENT_USER_KEY, email); }
function updateCurrentUser(updater) { const users = getUsers(); const email = localStorage.getItem(CURRENT_USER_KEY); if(email && users[email]) { users[email] = updater(users[email]); saveUsers(users); } }
function getCurrentUsername() { const u = getCurrentUser(); return u ? u.username : null; }

async function syncUserFromServer(email) {
    try {
        const response = await fetch(`/api/user/${email}`);
        if (response.ok) {
            const data = await response.json();
            if (data.ok && data.user) {
                let users = getUsers();
                users[email] = data.user;
                saveUsers(users);
                return data.user;
            }
        }
    } catch (error) {
        console.error('Failed to sync user from server:', error);
    }
    return null;
}

function showNotification(msg, type) { 
    const n = document.createElement('div'); 
    n.className = `notification ${type}`; 
    n.innerText = msg; 
    document.body.appendChild(n); 
    setTimeout(() => n.remove(), 3000); 
}

async function savePracticeSessionToServer(sessionPayload) {
    try {
        const response = await fetch('/api/practice-sessions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(sessionPayload)
        });

        if (!response.ok) {
            const body = await response.json().catch(() => ({}));
            throw new Error(body.message || 'Failed to save to server');
        }

        return true;
    } catch (error) {
        console.error('Remote save failed:', error);
        showNotification('⚠️ Saved locally, but cloud sync failed.', 'error');
        return false;
    }
}

// ============ TASK DATABASE ============
const taskDatabase = {
    Fluency: { 
        speaking: ["Describe your morning routine in detail", "Explain how to make your favorite dish", "Talk about your dream vacation", "Describe a person you admire", "Explain a hobby you enjoy"], 
        situation: ["Roleplay: Ordering food at restaurant", "Roleplay: Job interview", "Roleplay: Networking event"], 
        challenge: ["Record yourself and count filler words", "Speak without stopping for 3 minutes", "Practice in front of mirror"] 
    },
    Confidence: { 
        speaking: ["Speak about your biggest achievement", "Introduce yourself to imaginary audience", "Talk about favorite movie confidently", "Pretend you're giving a TED talk", "Describe your strengths"], 
        situation: ["Roleplay: Networking introduction", "Roleplay: Presentation to executives", "Roleplay: Dream job interview"], 
        challenge: ["Speak in mirror for 5 minutes", "Record video and watch it", "Speak with power poses"] 
    },
    Clarity: { 
        speaking: ["Pronounce difficult words clearly", "Read paragraph with clear enunciation", "Explain complex idea simply", "Practice tongue twisters"], 
        situation: ["Roleplay: Leaving voicemail", "Roleplay: Giving dictation", "Roleplay: Announcing event details"], 
        challenge: ["Record and check pronunciation", "Practice 'th' sounds", "Read something backwards"] 
    }
};

// ============ TIPS DATABASE ============
const tipsDatabase = [
    { title: "🎯 Pause for Power", tip: "Pause 2-3 seconds between key points. It makes you sound more confident and gives listeners time to absorb your message." },
    { title: "👀 Eye Contact Mastery", tip: "Hold eye contact for 3-5 seconds per person. It builds trust and shows confidence." },
    { title: "🎤 Voice Projection", tip: "Speak from your diaphragm, not your throat. Place hand on stomach - it should move outward when you speak." },
    { title: "🔇 Eliminate Filler Words", tip: "Replace 'um', 'uh', 'like', 'actually' with a pause. Record yourself to identify your filler words." },
    { title: "✋ Hand Gestures", tip: "Use gestures that match your words. Open palms = honesty, pointing = emphasis." },
    { title: "🌬️ Breathing Technique", tip: "Take a deep belly breath before speaking. It calms nerves and fills your voice with power." },
    { title: "🧍 Posture Power", tip: "Stand straight, shoulders back, feet shoulder-width apart. Good posture opens your airways." },
    { title: "⏱️ Pacing Control", tip: "Vary your speed. Slow down for important points, speed up for excitement." }
];

// ============ ACHIEVEMENTS DATABASE ============
const achievementsList = [
    { name: "First Steps", icon: "🌱", requirement: "Complete first practice", category: "streak" },
    { name: "Week Warrior", icon: "🔥", requirement: "7 day streak", category: "streak" },
    { name: "Dedicated", icon: "⚡", requirement: "14 day streak", category: "streak" },
    { name: "Elite Speaker", icon: "🏆", requirement: "90%+ retention", category: "quality" },
    { name: "Practice Pro", icon: "📈", requirement: "30 total sessions", category: "practice" }
];

// ============ DOM ELEMENTS ============
const navBar = document.getElementById('navBar');
const loginView = document.getElementById('loginView');
const goalView = document.getElementById('goalView');
const dashboardView = document.getElementById('dashboardView');
const practiceView = document.getElementById('practiceView');
const analyticsView = document.getElementById('analyticsView');
const tipsView = document.getElementById('tipsView');
const achievementsView = document.getElementById('achievementsView');
const logView = document.getElementById('logView');
const completionView = document.getElementById('completionView');

// ============ PAGE FUNCTIONS ============
function hideAllViews() {
    const views = [loginView, goalView, dashboardView, practiceView, analyticsView, tipsView, achievementsView, logView, completionView];
    views.forEach(v => { if (v) v.classList.add('hidden'); });
}

function showPage(page) {
    hideAllViews();
    navBar.classList.remove('hidden');
    document.querySelectorAll('.nav-btn[data-page]').forEach(btn => {
        btn.classList.toggle('active', btn.getAttribute('data-page') === page);
    });
    if (page === 'dashboard') { dashboardView.classList.remove('hidden'); refreshDashboard(); }
    else if (page === 'practice') { practiceView.classList.remove('hidden'); resetPractice(); }
    else if (page === 'analytics') { analyticsView.classList.remove('hidden'); refreshAnalytics(); }
    else if (page === 'tips') { tipsView.classList.remove('hidden'); renderTips(); }
    else if (page === 'achievements') { achievementsView.classList.remove('hidden'); renderAchievements(); }
    else if (page === 'log') { logView.classList.remove('hidden'); refreshLog(); }
}

function showDashboard() { showPage('dashboard'); }
function showLoginPage() { hideAllViews(); loginView.classList.remove('hidden'); navBar.classList.add('hidden'); }
function showGoal() { hideAllViews(); goalView.classList.remove('hidden'); navBar.classList.add('hidden'); }

// ============ LOGIN/SIGNUP HANDLERS ============
document.getElementById('showLoginTab').onclick = () => {
    document.getElementById('loginFormContainer').classList.remove('hidden');
    document.getElementById('signupFormContainer').classList.add('hidden');
    document.getElementById('showLoginTab').classList.add('active');
    document.getElementById('showSignupTab').classList.remove('active');
};

document.getElementById('showSignupTab').onclick = () => {
    document.getElementById('loginFormContainer').classList.add('hidden');
    document.getElementById('signupFormContainer').classList.remove('hidden');
    document.getElementById('showSignupTab').classList.add('active');
    document.getElementById('showLoginTab').classList.remove('active');
};

document.getElementById('signupBtn').onclick = async () => {
    const email = document.getElementById('signupEmail').value.trim();
    const username = document.getElementById('signupUsername').value.trim();
    const password = document.getElementById('signupPassword').value.trim();
    if (!email || !username || !password) { showNotification("❌ All fields required!", "error"); return; }
    if (!email.includes('@')) { showNotification("❌ Valid email required", "error"); return; }
    
    try {
        const response = await fetch('/api/signup', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: email,
                username: username,
                password: password,
                userData: {
                    stats: { streak: 0, retention: 0, confidence: 0, totalPracticeMinutes: 0, lastPracticeDate: null },
                    practiceSessions: [],
                    goal: { type: 'Confidence', focus: 'Fluency', duration: 14, startDate: new Date().toISOString() },
                    unlockedAchievements: []
                }
            })
        });

        const data = await response.json();
        if (!response.ok) {
            showNotification(`❌ ${data.message}`, "error");
            return;
        }

        showNotification("✅ Signup successful! Please login.", "success");
        document.getElementById('showLoginTab').click();
        document.getElementById('loginEmail').value = email;
        document.getElementById('loginUsernameField').value = username;
        document.getElementById('loginPasswordField').value = password;
    } catch (error) {
        console.error('Signup error:', error);
        showNotification("❌ Signup failed", "error");
    }
};

document.getElementById('loginBtn').onclick = async () => {
    const email = document.getElementById('loginEmail').value.trim();
    const username = document.getElementById('loginUsernameField').value.trim();
    const password = document.getElementById('loginPasswordField').value.trim();
    if (!email || !username || !password) { showNotification("❌ All fields required", "error"); return; }
    
    try {
        const response = await fetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: email,
                username: username,
                password: password
            })
        });

        const data = await response.json();
        if (!response.ok) {
            showNotification(`❌ ${data.message}`, "error");
            return;
        }

        // Store user info locally and set as current user
        let users = getUsers();
        users[email] = data.user;
        saveUsers(users);
        setCurrentUser(email);
        
        showNotification(`✅ Welcome ${username}!`, "success");
        showDashboard();
    } catch (error) {
        console.error('Login error:', error);
        showNotification("❌ Login failed", "error");
    }
};

document.getElementById('logoutBtn').onclick = () => {
    localStorage.removeItem(CURRENT_USER_KEY);
    if (recognition) stopVoiceRecognition();
    showLoginPage();
};

document.getElementById('saveGoalBtn').onclick = async () => {
    updateCurrentUser(u => {
        u.goal = {
            type: document.getElementById('goalType').value,
            focus: document.getElementById('focusArea').value,
            duration: parseInt(document.getElementById('duration').value),
            startDate: new Date().toISOString()
        };
        return u;
    });
    
    // Sync with server
    const user = getCurrentUser();
    const email = localStorage.getItem(CURRENT_USER_KEY);
    if (user && email) {
        try {
            await fetch(`/api/user/${email}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userData: user })
            });
        } catch (error) {
            console.error('Failed to sync goal:', error);
        }
    }
    
    showDashboard();
};

// ============ DASHBOARD REFRESH ============
async function refreshDashboard() {
    const email = localStorage.getItem(CURRENT_USER_KEY);
    if (!email) {
        showLoginPage();
        return;
    }
    
    // Sync with server to get latest data
    await syncUserFromServer(email);
    
    const user = getCurrentUser();
    if (!user) {
        showLoginPage();
        return;
    }
    document.getElementById('displayUsername').innerText = user.username;
    document.getElementById('displayStreak').innerText = user.stats?.streak || 0;
    document.getElementById('displayRetention').innerText = user.stats?.retention || 0;
    document.getElementById('displayConfidence').innerText = (user.stats?.confidence || 0).toFixed(1);
    
    const goal = user.goal || {};
    document.getElementById('goalNameDisplay').innerText = `${goal.type || 'Confidence'} / ${goal.focus || 'Fluency'}`;
    
    if (goal.startDate && goal.duration) {
        const daysPassed = Math.floor((new Date() - new Date(goal.startDate)) / 86400000);
        const left = Math.max(0, goal.duration - daysPassed);
        document.getElementById('daysLeft').innerText = left;
        const progress = Math.min(100, Math.floor((daysPassed / goal.duration) * 100));
        document.getElementById('goalProgressFill').style.width = `${progress}%`;
    }
    
    const focus = user.goal?.focus || 'Fluency';
    const db = taskDatabase[focus] || taskDatabase.Fluency;
    document.getElementById('speakingTask').innerHTML = `🔹 ${db.speaking[Math.floor(Math.random() * db.speaking.length)]}`;
    document.getElementById('situationTask').innerHTML = `🔸 ${db.situation[Math.floor(Math.random() * db.situation.length)]}`;
    document.getElementById('challengeTask').innerHTML = `⚡ ${db.challenge[Math.floor(Math.random() * db.challenge.length)]}`;
    refreshLog();
}

// ============ PRACTICE TIMER ==========
let timerInterval = null;
let timerSeconds = 0;
let timerTarget = 0;

function resetPractice() {
    if (timerInterval) clearInterval(timerInterval);
    timerSeconds = 0;
    timerTarget = 0;
    document.getElementById('timerDisplay').innerText = '00:00';
    document.getElementById('timerFill').style.width = '0%';
    document.getElementById('reflectionField').value = '';
    document.getElementById('ratingConf').value = 5;
    document.getElementById('ratingClarity').value = 5;
    document.getElementById('ratingFluency').value = 5;
    document.getElementById('confVal').innerText = '5';
    document.getElementById('clarityVal').innerText = '5';
    document.getElementById('fluencyVal').innerText = '5';
    const task = document.getElementById('speakingTask')?.innerText.replace('🔹 ', '') || 'Practice speaking';
    document.getElementById('practiceTaskDisplay').innerHTML = task;
    document.getElementById('activeTaskName').innerHTML = task;
    if (recognition) stopVoiceRecognition();
    document.getElementById('voiceInput').value = '';
    document.getElementById('feedbackSection').classList.add('hidden');
}

function startTimer(sec) {
    if (timerInterval) clearInterval(timerInterval);
    timerSeconds = 0;
    timerTarget = sec;
    document.querySelectorAll('.timer-btn').forEach(btn => {
        btn.classList.toggle('active', parseInt(btn.dataset.time) === sec);
    });
    const update = () => {
        const mins = Math.floor(timerSeconds / 60);
        const secs = timerSeconds % 60;
        document.getElementById('timerDisplay').innerText = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
        if (timerTarget) document.getElementById('timerFill').style.width = `${(timerSeconds / timerTarget) * 100}%`;
    };
    update();
    timerInterval = setInterval(() => {
        if (timerSeconds < timerTarget) {
            timerSeconds++;
            update();
        } else {
            clearInterval(timerInterval);
            alert('⏰ Time is up! Great job!');
        }
    }, 1000);
}

document.querySelectorAll('.timer-btn').forEach(btn => btn.addEventListener('click', () => startTimer(parseInt(btn.dataset.time))));

document.getElementById('ratingConf').oninput = e => document.getElementById('confVal').innerText = e.target.value;
document.getElementById('ratingClarity').oninput = e => document.getElementById('clarityVal').innerText = e.target.value;
document.getElementById('ratingFluency').oninput = e => document.getElementById('fluencyVal').innerText = e.target.value;

// ============ REAL VOICE DETECTION ==========
let recognition = null;
let isListening = false;
const voiceBtn = document.getElementById('voiceBtn');
const voiceInput = document.getElementById('voiceInput');
const voiceStatus = document.getElementById('voiceStatus');

function startRealVoiceRecognition() {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
        voiceStatus.innerHTML = "❌ Your browser doesn't support Voice Recognition. Please use Google Chrome.";
        showNotification("❌ Voice recognition not supported! Use Chrome.", "error");
        return;
    }
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    recognition = new SpeechRecognition();
    recognition.lang = 'en-US';
    recognition.continuous = true;
    recognition.interimResults = true;
    
    let finalTranscript = '';
    
    recognition.onstart = () => {
        isListening = true;
        voiceBtn.classList.add('listening');
        voiceBtn.innerHTML = "🔴 LISTENING... (Click to stop)";
        voiceStatus.innerHTML = "🎙️ SPEAK NOW! Your words will appear below...";
        voiceInput.value = '';
        finalTranscript = '';
        showNotification("🎤 Voice detection active! Speak clearly...", "success");
    };
    
    recognition.onresult = (event) => {
        let interimTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
            const transcript = event.results[i][0].transcript;
            if (event.results[i].isFinal) {
                finalTranscript += transcript + ' ';
            } else {
                interimTranscript += transcript;
            }
        }
        voiceInput.value = finalTranscript + interimTranscript;
        voiceStatus.innerHTML = "🎙️ Listening... (speaking detected)";
    };
    
    recognition.onerror = (event) => {
        let errorMsg = "❌ Error: ";
        if (event.error === 'not-allowed') errorMsg += "Microphone access denied!";
        else if (event.error === 'no-speech') errorMsg += "No speech detected.";
        else errorMsg += event.error;
        voiceStatus.innerHTML = errorMsg;
        stopVoiceRecognition();
        showNotification(errorMsg, "error");
    };
    
    recognition.onend = () => {
        stopVoiceRecognition();
        if (voiceInput.value.trim() === "") {
            voiceStatus.innerHTML = "⏹️ No speech captured. Click the button again.";
        } else {
            voiceStatus.innerHTML = "✅ Voice captured successfully! Click 'Get AI Feedback' to analyze.";
            showNotification("✅ Voice captured!", "success");
        }
    };
    
    recognition.start();
}

function stopVoiceRecognition() {
    if (recognition) {
        try { recognition.stop(); } catch(e) {}
        recognition = null;
    }
    isListening = false;
    voiceBtn.classList.remove('listening');
    voiceBtn.innerHTML = "🎤 START VOICE RECOGNITION";
}

voiceBtn.addEventListener('click', () => {
    if (isListening) stopVoiceRecognition();
    else startRealVoiceRecognition();
});

// ============ AI FEEDBACK ANALYSIS ==========
function analyzeSpeech(text, taskText) {
    const lowerText = text.toLowerCase();
    const words = lowerText.split(/\s+/).filter(w => w.length > 0);
    const wordCount = words.length;
    const fillerWords = ['um', 'uh', 'like', 'actually', 'basically', 'literally', 'so', 'you know'];
    let fillerCount = 0;
    fillerWords.forEach(fw => { if (lowerText.includes(fw)) fillerCount++; });
    
    let clarityScore = 70, confidenceScore = 65, fluencyScore = 70;
    if (fillerCount > 5) fluencyScore -= 25;
    else if (fillerCount > 2) fluencyScore -= 12;
    else if (fillerCount === 0) fluencyScore += 15;
    
    if (wordCount < 15) fluencyScore -= 20;
    else if (wordCount > 50) fluencyScore += 10;
    
    let relevance = 70;
    const taskLower = taskText.toLowerCase();
    const taskWords = taskLower.split(' ');
    taskWords.forEach(tw => { if (tw.length > 3 && lowerText.includes(tw)) relevance += 5; });
    relevance = Math.min(100, relevance);
    
    if (relevance < 40) { clarityScore -= 20; confidenceScore -= 20; fluencyScore -= 20; }
    
    clarityScore = Math.min(100, Math.max(0, clarityScore));
    confidenceScore = Math.min(100, Math.max(0, confidenceScore));
    fluencyScore = Math.min(100, Math.max(0, fluencyScore));
    const overallScore = Math.round((clarityScore + confidenceScore + fluencyScore) / 3);
    
    let feedback = `<div style="text-align:center;"><span class="feedback-score ${overallScore >= 70 ? 'score-high' : (overallScore >= 50 ? 'score-mid' : 'score-low')}">🎯 Overall Score: ${overallScore}/100</span></div>`;
    feedback += `<div style="display:flex; justify-content:center; gap:10px; margin:10px 0;">
        <span class="feedback-score ${clarityScore >= 70 ? 'score-high' : 'score-mid'}">Clarity: ${clarityScore}%</span>
        <span class="feedback-score ${confidenceScore >= 70 ? 'score-high' : 'score-mid'}">Confidence: ${confidenceScore}%</span>
        <span class="feedback-score ${fluencyScore >= 70 ? 'score-high' : 'score-mid'}">Fluency: ${fluencyScore}%</span>
    </div>`;
    feedback += `<div><strong>📊 Detailed Analysis:</strong><br>• Words spoken: ${wordCount}<br>• Filler words detected: ${fillerCount}<br>• Topic relevance: ${relevance}%</div>`;
    
    if (fillerCount > 3) feedback += `<div class="offtopic" style="margin-top:8px;">⚠️ Too many filler words! Try pausing instead.</div>`;
    if (wordCount < 20) feedback += `<div>💡 Tip: Speak more to build fluency. Aim for 30+ words.</div>`;
    if (overallScore >= 80) feedback += `<div style="margin-top:8px; color:#00ff00;">🌟 Excellent! You're speaking like a pro!</div>`;
    else if (overallScore >= 60) feedback += `<div style="margin-top:8px; color:#ffaa00;">📈 Good effort! Keep practicing daily.</div>`;
    else feedback += `<div style="margin-top:8px;">🎯 Keep going! Every practice makes you better.</div>`;
    
    return feedback;
}

async function getAIFeedback(text, taskText) {
    try {
        const response = await fetch('/api/analyze-speech', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                speechText: text,
                taskText: taskText
            })
        });

        if (!response.ok) {
            throw new Error('Failed to get AI feedback');
        }

        const data = await response.json();
        const analysis = data.analysis;

        let feedback = `<div style="text-align:center;"><span class="feedback-score ${analysis.overallScore >= 70 ? 'score-high' : (analysis.overallScore >= 50 ? 'score-mid' : 'score-low')}">🎯 AI Analysis - Overall Score: ${analysis.overallScore}/100</span></div>`;
        feedback += `<div style="display:flex; justify-content:center; gap:10px; margin:10px 0;">
            <span class="feedback-score ${analysis.clarityScore >= 70 ? 'score-high' : 'score-mid'}">Clarity: ${analysis.clarityScore}%</span>
            <span class="feedback-score ${analysis.confidenceScore >= 70 ? 'score-high' : 'score-mid'}">Confidence: ${analysis.confidenceScore}%</span>
            <span class="feedback-score ${analysis.fluencyScore >= 70 ? 'score-high' : 'score-mid'}">Fluency: ${analysis.fluencyScore}%</span>
        </div>`;
        
        feedback += `<div><strong>✨ Strengths:</strong><br>`;
        (analysis.strengths || []).forEach(s => { feedback += `• ${s}<br>`; });
        feedback += `</div>`;
        
        feedback += `<div><strong>🎯 Areas to Improve:</strong><br>`;
        (analysis.improvements || []).forEach(i => { feedback += `• ${i}<br>`; });
        feedback += `</div>`;
        
        feedback += `<div><strong>💡 Tips:</strong><br>`;
        (analysis.tips || []).forEach(t => { feedback += `• ${t}<br>`; });
        feedback += `</div>`;

        return feedback;
    } catch (error) {
        console.error('Failed to get AI feedback:', error);
        return analyzeSpeech(text, taskText); // Fallback to local analysis
    }
}

document.getElementById('analyzeVoiceBtn').addEventListener('click', async () => {
    const text = document.getElementById('voiceInput').value.trim();
    if (!text) { showNotification("❌ Please speak something first!", "error"); return; }
    const taskText = document.getElementById('activeTaskName').innerText;
    
    showNotification("⏳ Analyzing your speech with AI...", "success");
    const feedback = await getAIFeedback(text, taskText);
    document.getElementById('feedbackContent').innerHTML = feedback;
    document.getElementById('feedbackSection').classList.remove('hidden');
    showNotification("🤖 AI Analysis complete!", "success");
});

// ============ SUBMIT PRACTICE ==========
document.getElementById('submitPracticeBtn').addEventListener('click', async () => {
    const reflection = document.getElementById('reflectionField').value.trim();
    if (!reflection || timerTarget === 0) { alert("Complete timer & write reflection first!"); return; }
    const user = getCurrentUser();
    if (!user) {
        showNotification('❌ Please login first.', 'error');
        return;
    }

    const today = new Date().toISOString().split('T')[0];
    const selectedTask = document.getElementById('practiceTaskDisplay').innerHTML;
    const confidence = parseInt(document.getElementById('ratingConf').value);
    const clarity = parseInt(document.getElementById('ratingClarity').value);
    const fluency = parseInt(document.getElementById('ratingFluency').value);
    const durationMinutes = timerTarget / 60;

    savePracticeSessionToServer({
        userEmail: user.email,
        username: user.username,
        date: today,
        task: selectedTask,
        durationMinutes,
        notes: reflection,
        confidence,
        clarity,
        fluency
    });
    
    updateCurrentUser(u => {
        const lastDate = u.stats?.lastPracticeDate;
        const currentStreak = u.stats?.streak || 0;

        let nextStreak = currentStreak;
        if (!lastDate) {
            nextStreak = 1;
        } else {
            const dayDiff = Math.floor((new Date(today) - new Date(lastDate)) / 86400000);
            if (dayDiff === 0) nextStreak = currentStreak;
            else if (dayDiff === 1) nextStreak = currentStreak + 1;
            else nextStreak = 1;
        }

        u.stats.streak = nextStreak;
        u.practiceSessions = u.practiceSessions || [];
        u.practiceSessions.push({
            date: today,
            task: selectedTask,
            duration: timerTarget / 60 + ' min',
            notes: reflection,
            ratings: {
                confidence,
                clarity,
                fluency
            }
        });
        u.stats.totalPracticeMinutes = (u.stats.totalPracticeMinutes || 0) + durationMinutes;
        u.stats.retention = Math.min(100, (u.stats.retention || 0) + 5);
        u.stats.confidence = ((u.stats.confidence || 0) + 
            (confidence + clarity + fluency) / 3) / 2;
        u.stats.lastPracticeDate = today;

        u.unlockedAchievements = u.unlockedAchievements || [];
        if (u.practiceSessions.length === 1 && !u.unlockedAchievements.includes("First Steps")) {
            u.unlockedAchievements.push("First Steps");
        }
        if (u.stats.streak >= 7 && !u.unlockedAchievements.includes("Week Warrior")) {
            u.unlockedAchievements.push("Week Warrior");
        }
        if (u.stats.streak >= 14 && !u.unlockedAchievements.includes("Dedicated")) {
            u.unlockedAchievements.push("Dedicated");
        }
        if (u.stats.retention >= 90 && !u.unlockedAchievements.includes("Elite Speaker")) {
            u.unlockedAchievements.push("Elite Speaker");
        }
        if (u.practiceSessions.length >= 30 && !u.unlockedAchievements.includes("Practice Pro")) {
            u.unlockedAchievements.push("Practice Pro");
        }
        return u;
    });
    
    // Sync user data with server
    const updatedUser = getCurrentUser();
    const email = localStorage.getItem(CURRENT_USER_KEY);
    if (updatedUser && email) {
        try {
            await fetch(`/api/user/${email}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userData: updatedUser })
            });
        } catch (error) {
            console.error('Failed to sync user data:', error);
        }
    }
    
    showNotification("✅ Practice submitted! +5% retention!", "success");
    showDashboard();
});

// ============ ANALYTICS ==========
function refreshAnalytics() {
    const user = getCurrentUser();
    if (!user) return;
    document.getElementById('avgConfidence').innerText = (user.stats?.confidence || 0).toFixed(1);
    document.getElementById('totalPracticeTime').innerText = Math.round(user.stats?.totalPracticeMinutes || 0);
    document.getElementById('retentionPerc').innerText = user.stats?.retention || 0;
    document.getElementById('totalSessions').innerText = user.practiceSessions?.length || 0;
    
    const conf = user.stats?.confidence || 0;
    if (conf < 3) document.getElementById('masteryLevel').innerText = "Beginner";
    else if (conf < 5) document.getElementById('masteryLevel').innerText = "Developing";
    else if (conf < 7) document.getElementById('masteryLevel').innerText = "Intermediate";
    else if (conf < 9) document.getElementById('masteryLevel').innerText = "Advanced";
    else document.getElementById('masteryLevel').innerText = "Elite";
    
    const weeklyGraph = document.getElementById('weeklyGraph');
    if (weeklyGraph) {
        weeklyGraph.innerHTML = '';
        const sessions = user.practiceSessions || [];
        const weeklyData = [0, 0, 0, 0, 0, 0, 0];
        const labels = [];
        for (let i = 6; i >= 0; i--) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            labels.push(d.toLocaleDateString(undefined, { weekday: 'short' }));
        }
        sessions.forEach(s => {
            const daysAgo = Math.floor((new Date() - new Date(s.date)) / 86400000);
            if (daysAgo < 7) weeklyData[6 - daysAgo] += parseFloat(s.duration) || 0;
        });
        const maxVal = Math.max(...weeklyData, 1);
        weeklyData.forEach((val, i) => {
            const height = (val / maxVal) * 150;
            const bar = document.createElement('div');
            bar.className = 'bar-wrapper';
            bar.innerHTML = `<div class="bar" style="height: ${height}px"></div><div class="bar-label">${labels[i]}<br>${Math.round(val)}</div>`;
            weeklyGraph.appendChild(bar);
        });
    }
}

// ============ TIPS ==========
function renderTips() {
    const container = document.getElementById('tipsContainer');
    if (container) {
        container.innerHTML = tipsDatabase.map(tip => `<div class="card"><h3 style="color:#00c3ff">${tip.title}</h3><p>${tip.tip}</p></div>`).join('');
    }
}

// ============ ACHIEVEMENTS ==========
function renderAchievements() {
    const user = getCurrentUser();
    const unlocked = user?.unlockedAchievements || [];
    const container = document.getElementById('achievementsContainer');
    if (container) {
        container.innerHTML = achievementsList.map(ach => {
            const isUnlocked = unlocked.includes(ach.name);
            return `<div class="card" style="${isUnlocked ? 'border-color: gold; background: linear-gradient(135deg, #1a3a2a, #0e2a1a);' : 'opacity: 0.7;'}">
                <div style="font-size: 2.5rem;">${ach.icon}</div>
                <h3>${ach.name}</h3>
                <p class="text-small">${ach.requirement}</p>
                ${isUnlocked ? '<p style="color: gold; margin-top: 8px;">✓ UNLOCKED</p>' : '<p style="color: #666; margin-top: 8px;">🔒 LOCKED</p>'}
            </div>`;
        }).join('');
    }
}

// ============ HISTORY LOG ==========
function refreshLog() {
    const user = getCurrentUser();
    const container = document.getElementById('logEntries');
    if (!container) return;
    if (!user?.practiceSessions || user.practiceSessions.length === 0) {
        container.innerHTML = '<div class="card">📭 No practice sessions yet. Complete a practice to see it here!</div>';
        return;
    }
    const sessions = [...user.practiceSessions].reverse();
    container.innerHTML = sessions.map(s => `
        <div class="card" style="margin-bottom: 10px;">
            <div style="display: flex; justify-content: space-between; flex-wrap: wrap;">
                <span style="color: #00c3ff;">📅 ${s.date}</span>
                <span>⏱️ ${s.duration}</span>
            </div>
            <p style="margin: 8px 0;"><strong>${s.task}</strong></p>
            <p class="text-small">📝 ${s.notes.substring(0, 100)}${s.notes.length > 100 ? '...' : ''}</p>
            <div style="display: flex; gap: 15px; margin-top: 8px; font-size: 0.8rem;">
                <span>Conf: ${s.ratings?.confidence || 5}/10</span>
                <span>Clarity: ${s.ratings?.clarity || 5}/10</span>
                <span>Fluency: ${s.ratings?.fluency || 5}/10</span>
            </div>
        </div>
    `).join('');
}

// ============ ENHANCED CHATBOT WITH MANY QUESTIONS ==========
const chatbotResponses = {
    // Greetings
    "hello": "👋 Hello! I'm your speaking coach. How can I help you today?",
    "hi": "👋 Hi there! Ready to improve your speaking skills?",
    "hey": "👋 Hey! Ask me for tips, motivation, or practice advice!",
    
    // Motivation
    "motivation": "🔥 You're doing great! Every master was once a beginner. Keep showing up daily!",
    "motivate": "💪 Remember: The only way to speak better is to speak more. You've got this!",
    "inspiring": "✨ Your voice matters. Every practice session makes you 1% better!",
    
    // Tips
    "tip": "💡 Pro Tip: Pause 2-3 seconds between key points. It makes you sound more confident!",
    "tips": "📚 Here's a tip: Record yourself speaking and listen back. You'll notice habits you didn't know you had!",
    
    // Confidence
    "confidence": "🎯 Confidence tip: Replace 'I think' with 'I know'. Strong language = confident speaker!",
    "confident": "💪 Stand tall, shoulders back, and speak from your diaphragm. Power pose before speaking!",
    
    // Filler words
    "filler": "🔇 Replace 'um', 'uh', 'like' with a pause. Record yourself to identify them!",
    "filler words": "🔇 Filler words like 'um', 'uh', 'actually' make you sound unsure. Practice pausing instead!",
    
    // Body language
    "body language": "🪞 Open palms show honesty, eye contact builds trust, and good posture projects confidence!",
    "gestures": "✋ Use hand gestures that match your words. Open palms = honesty, pointing = emphasis.",
    
    // Practice
    "practice": "🎤 Practice for 5-10 minutes daily. Consistency beats intensity! Use our voice detection feature.",
    "how to practice": "📅 Set a daily goal, use the timer, speak about random topics, and record yourself!",
    
    // Stage fright
    "nervous": "😰 It's normal to be nervous! Take deep breaths, visualize success, and start with small audiences.",
    "stage fright": "🎭 Power pose for 2 minutes before speaking (hands on hips, chest out). It boosts confidence!",
    "anxiety": "🧘 Breathe deeply - inhale for 4 seconds, hold for 4, exhale for 4. Calms nerves instantly!",
    
    // Vocabulary
    "vocabulary": "📖 Learn 5 new words daily and use them in conversation. Read aloud to improve fluency!",
    "words": "📚 Try learning synonyms for common words. Instead of 'good', say 'excellent', 'fantastic', 'remarkable'!",
    
    // Storytelling
    "story": "📖 Start with a hook, build tension, end with a lesson. Personal stories connect best with audiences!",
    "storytelling": "🎬 Use the rule of three: beginning, middle, end. Add emotions to make stories memorable!",
    
    // Public speaking
    "public speaking": "🎙️ Know your audience, start strong, use pauses, and end with a clear call to action!",
    "speech": "📝 Outline your speech with bullet points, not full scripts. It sounds more natural!",
    
    // Eye contact
    "eye contact": "👀 Hold eye contact for 3-5 seconds per person. It builds trust and shows confidence!",
    
    // Voice
    "voice": "🎤 Speak from your diaphragm, not your throat. Warm up with humming or lip trills!",
    "projection": "🔊 Imagine you're speaking to the person farthest in the room. That's your volume!",
    
    // Help
    "help": "💡 I can help with: tips, motivation, confidence, filler words, body language, stage fright, vocabulary, storytelling, and more! Just ask!",
    
    // Default
    "default": "💬 I'm here to help! Try asking: 'motivation', 'tips', 'confidence', 'filler words', 'body language', 'stage fright', or 'help'!"
};

async function getChatbotResponse(message) {
    try {
        const response = await fetch('/api/chatbot', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                message: message,
                conversationHistory: []
            })
        });

        if (!response.ok) {
            throw new Error('Failed to get chatbot response');
        }

        const data = await response.json();
        return data.response;
    } catch (error) {
        console.error('Chatbot error:', error);
        // Fallback to basic responses
        const lowerMsg = message.toLowerCase().trim();
        if (lowerMsg.includes("hello") || lowerMsg.includes("hi")) {
            return "👋 Hello! I'm your speaking coach. How can I help you today?";
        }
        if (lowerMsg.includes("motivation")) {
            return "🔥 You're doing great! Every master was once a beginner. Keep showing up daily!";
        }
        if (lowerMsg.includes("tip")) {
            return "💡 Pro Tip: Pause 2-3 seconds between key points. It makes you sound more confident!";
        }
        return "💬 I'm having trouble connecting to the AI. Please try again!";
    }
}

async function sendChatMessage() {
    const input = document.getElementById('chatInput');
    const message = input.value.trim();
    if (!message) return;
    
    const chatMessages = document.getElementById('chatMessages');
    chatMessages.innerHTML += `<div class="user-msg">${escapeHtml(message)}</div>`;
    
    // Show loading indicator
    chatMessages.innerHTML += `<div class="bot-msg">⏳ Thinking...</div>`;
    chatMessages.scrollTop = chatMessages.scrollHeight;
    input.value = '';
    
    try {
        const reply = await getChatbotResponse(message);
        chatMessages.innerHTML = chatMessages.innerHTML.replace('<div class="bot-msg">⏳ Thinking...</div>', `<div class="bot-msg">${reply}</div>`);
    } catch (error) {
        chatMessages.innerHTML = chatMessages.innerHTML.replace('<div class="bot-msg">⏳ Thinking...</div>', `<div class="bot-msg">Sorry, I encountered an error. Please try again!</div>`);
    }
    
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

window.sendChatMessage = sendChatMessage;

// Chatbot Minimize
document.getElementById('minimizeChatBtn')?.addEventListener('click', () => {
    document.getElementById('chatbotBody').classList.toggle('minimized');
});

document.getElementById('chatbotHeader')?.addEventListener('click', (event) => {
    if (event.target && event.target.id === 'minimizeChatBtn') return;
    document.getElementById('chatbotBody').classList.toggle('minimized');
});

document.getElementById('chatInput')?.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
        event.preventDefault();
        sendChatMessage();
    }
});

// ============ NAVIGATION SETUP ==========
document.querySelectorAll('.nav-btn[data-page]').forEach(btn => {
    btn.addEventListener('click', () => showPage(btn.getAttribute('data-page')));
});

document.getElementById('quickPracticeBtn')?.addEventListener('click', () => showPage('practice'));
document.getElementById('viewTipsBtn')?.addEventListener('click', () => showPage('tips'));
document.getElementById('backFromAnalytics')?.addEventListener('click', showDashboard);
document.getElementById('backFromTips')?.addEventListener('click', showDashboard);
document.getElementById('backFromAchievements')?.addEventListener('click', showDashboard);
document.getElementById('backFromLog')?.addEventListener('click', showDashboard);
document.getElementById('backToDashboard')?.addEventListener('click', showDashboard);

// ============ INITIAL LOAD ==========
if (getCurrentUser()) {
    const activeUser = getCurrentUser();
    if (!activeUser.goal) showGoal();
    else showDashboard();
} else {
    showLoginPage();
}