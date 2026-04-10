/**
 * lock-script.js
 * Logic for the DOT System lock screen.
 */

let currentPin = "";
const CORRECT_PIN = "1977";
const MAX_PIN_LENGTH = 4;

const dots = document.querySelectorAll('.dot');
const card = document.getElementById('lockCard');

function updateDots() {
    dots.forEach((dot, index) => {
        if (index < currentPin.length) {
            dot.classList.add('active');
        } else {
            dot.classList.remove('active');
        }
    });
}

function appendPin(num) {
    if (currentPin.length < MAX_PIN_LENGTH) {
        currentPin += num;
        updateDots();
        
        // Check if PIN is complete
        if (currentPin.length === MAX_PIN_LENGTH) {
            setTimeout(validatePin, 300);
        }
    }
}

function deletePin() {
    if (currentPin.length > 0) {
        currentPin = currentPin.slice(0, -1);
        updateDots();
    }
}

function clearPin() {
    currentPin = "";
    updateDots();
    dots.forEach(dot => dot.classList.remove('error'));
}

function validatePin() {
    if (currentPin === CORRECT_PIN) {
        // Success
        localStorage.setItem('dotsystem_auth', 'authorized');
        
        // Success animation (Green dots)
        dots.forEach(dot => {
            dot.style.backgroundColor = '#10b981';
            dot.style.boxShadow = '0 0 15px #10b981';
        });

        setTimeout(() => {
            window.location.href = 'index.html';
        }, 500);
    } else {
        // Failure
        card.classList.add('shake');
        dots.forEach(dot => dot.classList.add('error'));
        
        // Haptic-like visual feedback
        if (navigator.vibrate) navigator.vibrate(200);

        setTimeout(() => {
            card.classList.remove('shake');
            clearPin();
        }, 600);
    }
}

// Keyboard support
document.addEventListener('keydown', (e) => {
    if (e.key >= '0' && e.key <= '9') {
        appendPin(e.key);
    } else if (e.key === 'Backspace') {
        deletePin();
    } else if (e.key === 'Escape') {
        clearPin();
    }
});
