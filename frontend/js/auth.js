// Check if user is logged in
async function checkAuth() {
    const token = localStorage.getItem('token');
    
    // If no token, redirect to login (but not if already on login page)
    if (!token) {
        if (!window.location.pathname.includes('login')) {
            window.location.href = '/login';
        }
        return false;
    }
    
    try {
        // Verify token
        const response = await fetch('/api/auth/verify', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (!response.ok) {
            throw new Error('Invalid token');
        }
        
        const data = await response.json();
        
        // Store user info
        localStorage.setItem('user', JSON.stringify(data.user));
        return true;
        
    } catch (error) {
        console.error('Auth verification failed:', error);
        // Token is invalid, clear storage and redirect to login
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        
        if (!window.location.pathname.includes('login')) {
            window.location.href = '/login';
        }
        return false;
    }
}

// Add auth header to all API requests
function getAuthHeaders() {
    const token = localStorage.getItem('token');
    return {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
    };
}

// Login form handler
if (document.getElementById('login-form')) {
    document.getElementById('login-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;
        const errorDiv = document.getElementById('error-message');
        const submitBtn = e.target.querySelector('button[type="submit"]');
        
        // Disable submit button during login
        submitBtn.disabled = true;
        submitBtn.textContent = 'Signing in...';
        
        try {
            const response = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });
            
            const data = await response.json();
            
            if (!response.ok) {
                errorDiv.textContent = data.error || 'Login failed';
                errorDiv.classList.remove('d-none');
                return;
            }
            
            // Store token and user info
            localStorage.setItem('token', data.token);
            localStorage.setItem('user', JSON.stringify(data.user));
            
            // Hide error message if visible
            errorDiv.classList.add('d-none');
            
            // Redirect based on role
            if (data.user.role === 'admin') {
                window.location.href = '/backoffice';
            } else {
                window.location.href = '/';
            }
            
        } catch (error) {
            console.error('Login error:', error);
            errorDiv.textContent = 'Connection error. Please try again.';
            errorDiv.classList.remove('d-none');
        } finally {
            // Re-enable submit button
            submitBtn.disabled = false;
            submitBtn.textContent = 'Sign in';
        }
    });
}

// Logout function
function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/login';
}

// Initialize auth check
document.addEventListener('DOMContentLoaded', async () => {
    // Skip auth check on login page
    if (window.location.pathname.includes('login')) {
        // If user is already logged in, redirect to appropriate page
        const token = localStorage.getItem('token');
        if (token) {
            try {
                const response = await fetch('/api/auth/verify', {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                
                if (response.ok) {
                    const data = await response.json();
                    // User is already logged in, redirect
                    if (data.user.role === 'admin') {
                        window.location.href = '/backoffice';
                    } else {
                        window.location.href = '/';
                    }
                    return;
                }
            } catch (error) {
                // Token is invalid, clear it and stay on login page
                localStorage.removeItem('token');
                localStorage.removeItem('user');
            }
        }
        return; // Stay on login page
    }
    
    // For all other pages, check authentication
    await checkAuth();
});