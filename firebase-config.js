// Firebase Configuration
const firebaseConfig = {
    apiKey: "AIzaSyAGDe2j5tJnQWd3Ra6epPKNtHFEbgaSq1k",
    authDomain: "dotsystem-inventory.firebaseapp.com",
    databaseURL: "https://dotsystem-inventory-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "dotsystem-inventory",
    storageBucket: "dotsystem-inventory.firebasestorage.app",
    messagingSenderId: "33686820106",
    appId: "1:33686820106:web:86deadd08fca37e58316f3"
};

// Initialize Firebase using the Compat SDK
if (typeof firebase !== 'undefined') {
    firebase.initializeApp(firebaseConfig);
    const database = firebase.database();

    // Make db available globally to data-controller
    window.FirebaseDB = {
        database: database
    };

    window.isFirebaseReady = true;
    console.log("🔥 Firebase Configuration Initialized.");
    
    // Dispatch a custom event to notify scripts that Firebase is ready
    window.dispatchEvent(new CustomEvent('firebaseConnected'));
} else {
    window.isFirebaseReady = false;
    console.error("🔥 Firebase SDKs not loaded!");
}
