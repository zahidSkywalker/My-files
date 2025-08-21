// Authentication JavaScript for Royal Casino
class CasinoAuth {
    constructor() {
        this.baseURL = '/api';
        this.token = localStorage.getItem('casinoToken');
        this.user = JSON.parse(localStorage.getItem('casinoUser'));
        
        this.init();
    }
    
    init() {
        this.bindEvents();
        this.updateUI();
        this.checkAuthStatus();
    }
    
    bindEvents() {
        // Login form
        const loginForm = document.getElementById('loginForm');
        if (loginForm) {
            loginForm.addEventListener('submit', (e) => this.handleLogin(e));
        }
        
        // Register form
        const registerForm = document.getElementById('registerForm');
        if (registerForm) {
            registerForm.addEventListener('submit', (e) => this.handleRegister(e));
        }
        
        // Logout button (if exists)
        const logoutBtn = document.querySelector('.logout-btn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => this.logout());
        }
    }
    
    async handleLogin(e) {
        e.preventDefault();
        
        const form = e.target;
        const submitBtn = form.querySelector('button[type="submit"]');
        const loadingState = addLoadingState(submitBtn);
        
        try {
            const formData = new FormData(form);
            const data = {
                username: formData.get('username'),
                password: formData.get('password')
            };
            
            const response = await fetch(`${this.baseURL}/auth/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(data)
            });
            
            const result = await response.json();
            
            if (response.ok) {
                this.setAuthData(result.token, result.user);
                this.showToast('Login successful!', 'success');
                closeModal('loginModal');
                this.updateUI();
                
                // Redirect to games or refresh page
                setTimeout(() => {
                    if (window.location.pathname === '/') {
                        window.location.href = '/games';
                    } else {
                        window.location.reload();
                    }
                }, 1000);
            } else {
                this.showToast(result.error || 'Login failed', 'error');
            }
        } catch (error) {
            console.error('Login error:', error);
            this.showToast('Network error. Please try again.', 'error');
        } finally {
            loadingState();
        }
    }
    
    async handleRegister(e) {
        e.preventDefault();
        
        const form = e.target;
        const submitBtn = form.querySelector('button[type="submit"]');
        const loadingState = addLoadingState(submitBtn);
        
        try {
            const formData = new FormData(form);
            const data = {
                username: formData.get('username'),
                email: formData.get('email'),
                password: formData.get('password'),
                firstName: formData.get('firstName'),
                lastName: formData.get('lastName'),
                dateOfBirth: formData.get('dateOfBirth')
            };
            
            // Validate date of birth
            const birthDate = new Date(data.dateOfBirth);
            const age = Math.floor((Date.now() - birthDate.getTime()) / (365.25 * 24 * 60 * 60 * 1000));
            
            if (age < 18) {
                this.showToast('You must be at least 18 years old to register', 'error');
                loadingState();
                return;
            }
            
            const response = await fetch(`${this.baseURL}/auth/register`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(data)
            });
            
            const result = await response.json();
            
            if (response.ok) {
                this.setAuthData(result.token, result.user);
                this.showToast('Registration successful! Welcome to Royal Casino!', 'success');
                closeModal('registerModal');
                this.updateUI();
                
                // Redirect to games or refresh page
                setTimeout(() => {
                    if (window.location.pathname === '/') {
                        window.location.href = '/games';
                    } else {
                        window.location.reload();
                    }
                }, 1000);
            } else {
                this.showToast(result.error || 'Registration failed', 'error');
            }
        } catch (error) {
            console.error('Registration error:', error);
            this.showToast('Network error. Please try again.', 'error');
        } finally {
            loadingState();
        }
    }
    
    async logout() {
        try {
            if (this.token) {
                await fetch(`${this.baseURL}/auth/logout`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${this.token}`
                    }
                });
            }
        } catch (error) {
            console.error('Logout error:', error);
        } finally {
            this.clearAuthData();
            this.updateUI();
            
            // Redirect to home page
            if (window.location.pathname !== '/') {
                window.location.href = '/';
            } else {
                window.location.reload();
            }
        }
    }
    
    setAuthData(token, user) {
        this.token = token;
        this.user = user;
        localStorage.setItem('casinoToken', token);
        localStorage.setItem('casinoUser', JSON.stringify(user));
    }
    
    clearAuthData() {
        this.token = null;
        this.user = null;
        localStorage.removeItem('casinoToken');
        localStorage.removeItem('casinoUser');
    }
    
    updateUI() {
        const navAuth = document.querySelector('.nav-auth');
        if (!navAuth) return;
        
        if (this.isAuthenticated()) {
            navAuth.innerHTML = `
                <div class="user-info">
                    <span class="username">${this.user.username}</span>
                    <span class="balance">$${this.user.balance.toFixed(2)}</span>
                </div>
                <div class="user-menu">
                    <button class="btn btn-outline" onclick="window.location.href='/profile'">
                        <i class="fas fa-user"></i> Profile
                    </button>
                    <button class="btn btn-primary" onclick="casinoAuth.logout()">
                        <i class="fas fa-sign-out-alt"></i> Logout
                    </button>
                </div>
            `;
        } else {
            navAuth.innerHTML = `
                <button class="btn btn-outline" onclick="openModal('loginModal')">Login</button>
                <button class="btn btn-primary" onclick="openModal('registerModal')">Register</button>
            `;
        }
    }
    
    isAuthenticated() {
        return !!(this.token && this.user);
    }
    
    async checkAuthStatus() {
        if (!this.token) return;
        
        try {
            const response = await fetch(`${this.baseURL}/auth/profile`, {
                headers: {
                    'Authorization': `Bearer ${this.token}`
                }
            });
            
            if (response.ok) {
                const result = await response.json();
                this.user = result.user;
                localStorage.setItem('casinoUser', JSON.stringify(result.user));
                this.updateUI();
            } else {
                // Token expired or invalid
                this.clearAuthData();
                this.updateUI();
            }
        } catch (error) {
            console.error('Auth check error:', error);
            this.clearAuthData();
            this.updateUI();
        }
    }
    
    async refreshToken() {
        if (!this.token) return false;
        
        try {
            const response = await fetch(`${this.baseURL}/auth/refresh`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.token}`
                }
            });
            
            if (response.ok) {
                const result = await response.json();
                this.token = result.token;
                localStorage.setItem('casinoToken', result.token);
                return true;
            }
        } catch (error) {
            console.error('Token refresh error:', error);
        }
        
        return false;
    }
    
    getAuthHeaders() {
        return {
            'Authorization': `Bearer ${this.token}`,
            'Content-Type': 'application/json'
        };
    }
    
    showToast(message, type = 'info') {
        if (window.showToast) {
            window.showToast(message, type);
        } else {
            // Fallback alert
            alert(message);
        }
    }
}

// Form validation
function validateForm(form) {
    const inputs = form.querySelectorAll('input[required]');
    let isValid = true;
    
    inputs.forEach(input => {
        if (!input.value.trim()) {
            showFieldError(input, 'This field is required');
            isValid = false;
        } else {
            clearFieldError(input);
        }
    });
    
    // Email validation
    const emailInput = form.querySelector('input[type="email"]');
    if (emailInput && emailInput.value) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(emailInput.value)) {
            showFieldError(emailInput, 'Please enter a valid email address');
            isValid = false;
        }
    }
    
    // Password validation
    const passwordInput = form.querySelector('input[name="password"]');
    if (passwordInput && passwordInput.value) {
        if (passwordInput.value.length < 6) {
            showFieldError(passwordInput, 'Password must be at least 6 characters long');
            isValid = false;
        }
    }
    
    // Username validation
    const usernameInput = form.querySelector('input[name="username"]');
    if (usernameInput && usernameInput.value) {
        if (usernameInput.value.length < 3) {
            showFieldError(usernameInput, 'Username must be at least 3 characters long');
            isValid = false;
        }
        if (!/^[a-zA-Z0-9_]+$/.test(usernameInput.value)) {
            showFieldError(usernameInput, 'Username can only contain letters, numbers, and underscores');
            isValid = false;
        }
    }
    
    return isValid;
}

function showFieldError(input, message) {
    clearFieldError(input);
    
    const errorDiv = document.createElement('div');
    errorDiv.className = 'field-error';
    errorDiv.textContent = message;
    errorDiv.style.cssText = `
        color: var(--danger-color);
        font-size: 0.875rem;
        margin-top: 0.25rem;
        animation: fadeIn 0.3s ease;
    `;
    
    input.parentNode.appendChild(errorDiv);
    input.classList.add('error');
}

function clearFieldError(input) {
    const existingError = input.parentNode.querySelector('.field-error');
    if (existingError) {
        existingError.remove();
    }
    input.classList.remove('error');
}

// Add error styles to form inputs
const formStyles = document.createElement('style');
formStyles.textContent = `
    .form-group input.error {
        border-color: var(--danger-color);
        box-shadow: 0 0 0 2px rgba(220, 53, 69, 0.2);
    }
    
    .form-group input.error:focus {
        border-color: var(--danger-color);
        box-shadow: 0 0 0 2px rgba(220, 53, 69, 0.2);
    }
    
    .user-info {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 0.25rem;
        margin-right: 1rem;
    }
    
    .username {
        font-weight: 600;
        color: var(--accent-color);
    }
    
    .balance {
        font-size: 0.875rem;
        color: var(--success-color);
        font-weight: 500;
    }
    
    .user-menu {
        display: flex;
        gap: 0.5rem;
    }
    
    @media (max-width: 768px) {
        .user-info {
            margin-right: 0;
            margin-bottom: 0.5rem;
        }
        
        .user-menu {
            flex-direction: column;
            width: 100%;
        }
        
        .user-menu .btn {
            width: 100%;
            justify-content: center;
        }
    }
`;

document.head.appendChild(formStyles);

// Enhanced form handling with validation
document.addEventListener('DOMContentLoaded', function() {
    const forms = document.querySelectorAll('.auth-form');
    
    forms.forEach(form => {
        const inputs = form.querySelectorAll('input');
        
        inputs.forEach(input => {
            // Real-time validation
            input.addEventListener('blur', () => {
                validateField(input);
            });
            
            // Clear error on input
            input.addEventListener('input', () => {
                if (input.classList.contains('error')) {
                    clearFieldError(input);
                }
            });
        });
        
        // Enhanced form submission
        form.addEventListener('submit', (e) => {
            if (!validateForm(form)) {
                e.preventDefault();
                return false;
            }
        });
    });
});

function validateField(input) {
    const value = input.value.trim();
    
    if (input.hasAttribute('required') && !value) {
        showFieldError(input, 'This field is required');
        return false;
    }
    
    if (input.type === 'email' && value) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(value)) {
            showFieldError(input, 'Please enter a valid email address');
            return false;
        }
    }
    
    if (input.name === 'password' && value) {
        if (value.length < 6) {
            showFieldError(input, 'Password must be at least 6 characters long');
            return false;
        }
    }
    
    if (input.name === 'username' && value) {
        if (value.length < 3) {
            showFieldError(input, 'Username must be at least 3 characters long');
            return false;
        }
        if (!/^[a-zA-Z0-9_]+$/.test(value)) {
            showFieldError(input, 'Username can only contain letters, numbers, and underscores');
            return false;
        }
    }
    
    clearFieldError(input);
    return true;
}

// Initialize authentication
const casinoAuth = new CasinoAuth();

// Export for global use
window.casinoAuth = casinoAuth;

// Auto-login if token exists
if (casinoAuth.isAuthenticated()) {
    casinoAuth.checkAuthStatus();
}