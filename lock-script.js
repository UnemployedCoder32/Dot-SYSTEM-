/**
 * lock-script.js
 * Logic for the DOT System Multi-Step Cloud Login.
 */

let selectedUser = null;
let currentPin = "";
const CORRECT_PIN = "1977";
const MAX_PIN_LENGTH = 4;
const AUTH_DATA_KEY = 'dotsystem_auth_data';

const dots = document.querySelectorAll('.dot');
const step1Card = document.getElementById('step1Card');
const step2Card = document.getElementById('step2Card');
const identityGrid = document.getElementById('identityGrid');
const passwordSection = document.getElementById('passwordSection');
const passLabel = document.getElementById('passLabel');
const passwordInput = document.getElementById('userPass');

// --- Initialization ---
document.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('step') === '2') {
        goToStep2();
    }
});

// --- Step 1 Login Flow ---
window.handleLogin = (name) => {
    selectedUser = name;
    
    // Define Roles (Hardcoded for speed, backed by DataController)
    const isAdmin = (name === 'Shashikant' || name === 'Prajakta');
    const role = isAdmin ? 'admin' : 'staff';

    const authData = {
        name: name,
        role: role,
        loggedInAt: new Date().toISOString(),
        twoStepVerified: false
    };
    
    localStorage.setItem(AUTH_DATA_KEY, JSON.stringify(authData));

    if (isAdmin) {
        goToStep2();
    } else {
        // Staff users (Sudipto, Pankaj) log in instantly
        if (window.showToast) showToast(`Welcome back, ${name}`, "success");
        setTimeout(() => {
            window.location.href = 'index.html';
        }, 300);
    }
};

// --- Step 2 PIN Flow ---
function goToStep2() {
    step1Card.style.display = 'none';
    step2Card.style.display = 'flex';
}

function updateDots() {
    dots.forEach((dot, index) => {
        if (index < currentPin.length) dot.classList.add('active');
        else dot.classList.remove('active');
    });
}

window.appendPin = (num) => {
    if (currentPin.length < MAX_PIN_LENGTH) {
        currentPin += num;
        updateDots();
        if (currentPin.length === MAX_PIN_LENGTH) {
            setTimeout(validatePin, 300);
        }
    }
};

window.deletePin = () => {
    if (currentPin.length > 0) {
        currentPin = currentPin.slice(0, -1);
        updateDots();
    }
};

window.clearPin = () => {
    currentPin = "";
    updateDots();
    dots.forEach(dot => dot.classList.remove('error'));
};

function validatePin() {
    if (currentPin === CORRECT_PIN) {
        const authData = JSON.parse(localStorage.getItem(AUTH_DATA_KEY));
        if (!authData) return;
        
        authData.twoStepVerified = true;
        localStorage.setItem(AUTH_DATA_KEY, JSON.stringify(authData));

        // Success Feedback
        if (window.DataController) {
            DataController.logActivity('Admin Login', `Validated session for ${authData.name}`, 'auth');
        }

        dots.forEach(dot => {
            dot.style.backgroundColor = '#10b981';
            dot.style.boxShadow = '0 0 15px #10b981';
        });

        setTimeout(() => {
            window.location.href = 'index.html';
        }, 500);
    } else {
        step2Card.classList.add('shake');
        dots.forEach(dot => dot.classList.add('error'));
        if (navigator.vibrate) navigator.vibrate(200);
        setTimeout(() => {
            step2Card.classList.remove('shake');
            clearPin();
        }, 600);
    }
}

// Keyboard support
passwordInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') handleLogin();
});

document.addEventListener('keydown', (e) => {
    if (step2Card && step2Card.style.display !== 'none') {
        if (e.key >= '0' && e.key <= '9') appendPin(e.key);
        else if (e.key === 'Backspace') deletePin();
        else if (e.key === 'Escape') clearPin();
    }
});
