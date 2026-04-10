// ============================================================
// Firebase Configuration — DOT System
// ============================================================
const firebaseConfig = {
    apiKey: "AIzaSyAGDe2j5tJnQWd3Ra6epPKNtHFEbgaSq1k",
    authDomain: "dotsystem-inventory.firebaseapp.com",
    databaseURL: "https://dotsystem-inventory-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "dotsystem-inventory",
    storageBucket: "dotsystem-inventory.firebasestorage.app",
    messagingSenderId: "33686820106",
    appId: "1:33686820106:web:86deadd08fca37e58316f3"
};

// ============================================================
// Initialize Firebase using the Compat SDK
// ============================================================
(function initFirebase() {
    if (typeof firebase === 'undefined') {
        window.isFirebaseReady = false;
        console.error("❌ Firebase SDKs not loaded! Check that firebase-app-compat.js and firebase-database-compat.js are loaded BEFORE firebase-config.js.");
        return;
    }

    try {
        // Prevent double-initialization on hot reloads
        if (!firebase.apps.length) {
            firebase.initializeApp(firebaseConfig);
        }

        const database = firebase.database();

        // Quick connectivity diagnostic — tests read permission immediately
        database.ref('.info/connected').on('value', (snap) => {
            if (snap.val() === true) {
                console.log('✅ Firebase: Connected to Realtime Database.');
            } else {
                console.warn('⚠️ Firebase: Currently offline or disconnected.');
            }
        });

        // Run a silent permission check to surface rule errors early
        database.ref('/').limitToFirst(1).once('value')
            .then(() => {
                console.log('✅ Firebase: Read permission confirmed.');
            })
            .catch((err) => {
                if (err.code === 'PERMISSION_DENIED') {
                    console.error('🔒 FIREBASE RULES ERROR: Read permission denied on root.');
                    console.error('👉 FIX: Go to Firebase Console → Realtime Database → Rules and set:');
                    console.error('   { "rules": { ".read": true, ".write": true } }');
                    console.error('   (For development only — apply auth rules before production)');
                } else {
                    console.error('🔥 Firebase Connection Error:', err.message);
                }
            });

        // Make db available globally to data-controller
        window.FirebaseDB = { database };
        window.isFirebaseReady = true;

        // Signal data-controller.js that Firebase is ready
        window.dispatchEvent(new CustomEvent('firebaseConnected'));
        console.log('🔥 Firebase: Initialized & Ready.');

    } catch (err) {
        window.isFirebaseReady = false;
        console.error('❌ Firebase Initialization Failed:', err.message);
    }
})();
