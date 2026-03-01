/**
 * Firebase Service Module for ESL Quiz Game
 * Handles Firebase init, anonymous auth, and RTDB operations.
 * 
 * SETUP: Replace the firebaseConfig object below with your
 * Firebase project credentials from the Firebase Console.
 */

const FirebaseService = (() => {
    // ========== CONFIGURATION ==========
    // Replace with your Firebase project config
    const firebaseConfig = {
        apiKey: "YOUR_API_KEY",
        authDomain: "YOUR_PROJECT.firebaseapp.com",
        databaseURL: "https://YOUR_PROJECT-default-rtdb.firebaseio.com",
        projectId: "YOUR_PROJECT_ID",
        storageBucket: "YOUR_PROJECT.appspot.com",
        messagingSenderId: "YOUR_SENDER_ID",
        appId: "YOUR_APP_ID"
    };

    let db = null;
    let auth = null;
    let currentUser = null;
    let initialized = false;

    // ========== INITIALIZATION ==========
    function init() {
        if (initialized) return Promise.resolve(currentUser);
        if (firebaseConfig.apiKey === "YOUR_API_KEY") {
            console.warn('[FirebaseService] Using DEMO mode — Firebase not configured.');
            initialized = true;
            currentUser = { uid: 'demo_' + Math.random().toString(36).substr(2, 9) };
            return Promise.resolve(currentUser);
        }
        try {
            if (!firebase.apps.length) {
                firebase.initializeApp(firebaseConfig);
            }
            db = firebase.database();
            auth = firebase.auth();
            initialized = true;
            return signInAnonymously();
        } catch (e) {
            console.error('[FirebaseService] Init failed:', e);
            initialized = true;
            currentUser = { uid: 'fallback_' + Date.now() };
            return Promise.resolve(currentUser);
        }
    }

    function signInAnonymously() {
        return auth.signInAnonymously().then(cred => {
            currentUser = cred.user;
            return currentUser;
        }).catch(err => {
            console.error('[FirebaseService] Auth error:', err);
            currentUser = { uid: 'anon_' + Date.now() };
            return currentUser;
        });
    }

    function getUid() {
        return currentUser ? currentUser.uid : null;
    }

    function isDemo() {
        return db === null;
    }

    // ========== SESSION OPERATIONS ==========
    function generateGameCode() {
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        let code = '';
        for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
        return code;
    }

    function createSession(config, questions) {
        const code = generateGameCode();
        const session = {
            hostId: getUid(),
            status: 'lobby',
            config: config,
            questions: questions,
            currentQuestion: -1,
            questionStartedAt: 0,
            players: {},
            createdAt: Date.now()
        };
        if (isDemo()) {
            window._demoSession = { code, ...session };
            return Promise.resolve(code);
        }
        return db.ref('sessions/' + code).set(session).then(() => code);
    }

    function joinSession(code, playerName) {
        const uid = getUid();
        const playerData = {
            name: playerName,
            score: 0,
            streak: 0,
            currentAnswer: null,
            joinedAt: Date.now()
        };
        if (isDemo()) {
            if (!window._demoSession) return Promise.reject('Session not found');
            if (!window._demoSession.players) window._demoSession.players = {};
            window._demoSession.players[uid] = playerData;
            return Promise.resolve(playerData);
        }
        return db.ref('sessions/' + code).once('value').then(snap => {
            if (!snap.exists()) throw new Error('Session not found');
            return db.ref('sessions/' + code + '/players/' + uid).set(playerData);
        }).then(() => playerData);
    }

    function updateSessionField(code, field, value) {
        if (isDemo()) {
            const parts = field.split('/');
            let obj = window._demoSession;
            for (let i = 0; i < parts.length - 1; i++) {
                if (!obj[parts[i]]) obj[parts[i]] = {};
                obj = obj[parts[i]];
            }
            obj[parts[parts.length - 1]] = value;
            return Promise.resolve();
        }
        return db.ref('sessions/' + code + '/' + field).set(value);
    }

    function getSession(code) {
        if (isDemo()) {
            return Promise.resolve(window._demoSession || null);
        }
        return db.ref('sessions/' + code).once('value').then(s => s.val());
    }

    // ========== REAL-TIME LISTENERS ==========
    function onSessionValue(code, callback) {
        if (isDemo()) return () => { };
        const ref = db.ref('sessions/' + code);
        ref.on('value', snap => callback(snap.val()));
        return () => ref.off('value');
    }

    function onFieldChange(code, field, callback) {
        if (isDemo()) return () => { };
        const ref = db.ref('sessions/' + code + '/' + field);
        ref.on('value', snap => callback(snap.val()));
        return () => ref.off('value');
    }

    function onPlayersChange(code, callback) {
        return onFieldChange(code, 'players', callback);
    }

    function onChildAdded(code, field, callback) {
        if (isDemo()) return () => { };
        const ref = db.ref('sessions/' + code + '/' + field);
        ref.on('child_added', snap => callback(snap.key, snap.val()));
        return () => ref.off('child_added');
    }

    // ========== PLAYER OPERATIONS ==========
    function submitAnswer(code, answerIndex) {
        const uid = getUid();
        const data = { index: answerIndex, timestamp: Date.now() };
        return updateSessionField(code, 'players/' + uid + '/currentAnswer', data);
    }

    function updatePlayerScore(code, uid, score, streak) {
        if (isDemo()) {
            if (window._demoSession && window._demoSession.players[uid]) {
                window._demoSession.players[uid].score = score;
                window._demoSession.players[uid].streak = streak;
            }
            return Promise.resolve();
        }
        return db.ref('sessions/' + code + '/players/' + uid).update({ score, streak });
    }

    function clearAllAnswers(code, players) {
        if (isDemo()) {
            if (window._demoSession) {
                Object.keys(window._demoSession.players || {}).forEach(uid => {
                    window._demoSession.players[uid].currentAnswer = null;
                });
            }
            return Promise.resolve();
        }
        const updates = {};
        Object.keys(players || {}).forEach(uid => {
            updates['players/' + uid + '/currentAnswer'] = null;
        });
        return db.ref('sessions/' + code).update(updates);
    }

    function setupDisconnect(code) {
        if (isDemo()) return;
        const uid = getUid();
        db.ref('sessions/' + code + '/players/' + uid).onDisconnect().remove();
    }

    function deleteSession(code) {
        if (isDemo()) {
            window._demoSession = null;
            return Promise.resolve();
        }
        return db.ref('sessions/' + code).remove();
    }

    // ========== PUBLIC API ==========
    return {
        init,
        getUid,
        isDemo,
        generateGameCode,
        createSession,
        joinSession,
        updateSessionField,
        getSession,
        onSessionValue,
        onFieldChange,
        onPlayersChange,
        onChildAdded,
        submitAnswer,
        updatePlayerScore,
        clearAllAnswers,
        setupDisconnect,
        deleteSession
    };
})();
