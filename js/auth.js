/**
 * auth.js
 * Handles Admin Authentication (Client-side simulation).
 */

const ADMIN_CREDENTIALS = {
    username: 'admin',
    password: 'password123'
};

const SESSION_KEY = 'admin_session';
const TOKEN_KEY = 'auth_token';

// Helper to get auth headers
window.getAuthHeaders = function() {
    const token = localStorage.getItem(TOKEN_KEY);
    return {
        'Content-Type': 'application/json',
        'Authorization': token ? `Bearer ${token}` : ''
    };
};

document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('login-form');

    // Check if already logged in (for login page)
    if (loginForm && localStorage.getItem(SESSION_KEY)) {
        window.location.href = 'admin-dashboard.html';
    }

    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const usernameInput = document.getElementById('username').value;
            const passwordInput = document.getElementById('password').value;
            const errorMsg = document.getElementById('error-msg');

            try {
                const response = await fetch('http://localhost:3000/api/admin/login', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ username: usernameInput, password: passwordInput })
                });

                const data = await response.json();

                if (data.success) {
                    localStorage.setItem(SESSION_KEY, 'true');
                    if (data.token) {
                        localStorage.setItem(TOKEN_KEY, data.token);
                    }
                    window.location.href = 'admin-dashboard.html';
                } else {
                    errorMsg.style.display = 'block';
                    errorMsg.textContent = data.message || 'Invalid credentials';
                }
            } catch (error) {
                console.error('Error:', error);
                errorMsg.style.display = 'block';
                errorMsg.textContent = 'Server error. Please try again.';
            }
        });
    }

    // Logout Functionality
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', (e) => {
            e.preventDefault();
            localStorage.removeItem(SESSION_KEY);
            localStorage.removeItem(TOKEN_KEY);
            window.location.href = 'admin-login.html';
        });
    }
});

// Protect Admin Pages
function checkAuth() {
    if ((!localStorage.getItem(SESSION_KEY) || !localStorage.getItem(TOKEN_KEY)) && !window.location.href.includes('admin-login.html')) {
        window.location.href = 'admin-login.html';
    }
}
