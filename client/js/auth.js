let isRegisterMode = false;

function initAuth() {
    const urlParams = new URLSearchParams(window.location.search);
    const connectionId = urlParams.get('connectionId');
    
    if (connectionId) {
        // Client mode
        state.userType = 'client';
        state.connectionId = connectionId;
        loadClientConnection();
    } else {
        // Hoster mode - show login
        showAuthModal();
    }
    
    document.getElementById('authToggle').querySelector('span').addEventListener('click', toggleAuthMode);
    document.getElementById('authForm').addEventListener('submit', handleAuth);
    document.getElementById('logoutBtn').addEventListener('click', logout);
}

function showAuthModal() {
    document.getElementById('authModal').classList.remove('hidden');
}

function hideAuthModal() {
    document.getElementById('authModal').classList.add('hidden');
}

function toggleAuthMode() {
    isRegisterMode = !isRegisterMode;
    const title = document.getElementById('authTitle');
    const submit = document.getElementById('authSubmit');
    const toggle = document.getElementById('authToggle');
    
    if (isRegisterMode) {
        title.textContent = 'Hoster Registration';
        submit.textContent = 'Register';
        toggle.innerHTML = 'Already have an account? <span>Login</span>';
    } else {
        title.textContent = 'Hoster Login';
        submit.textContent = 'Login';
        toggle.innerHTML = 'Don\'t have an account? <span>Register</span>';
    }
    
    document.getElementById('authToggle').querySelector('span').addEventListener('click', toggleAuthMode);
}

async function handleAuth(e) {
    e.preventDefault();
    
    const email = document.getElementById('authEmail').value;
    const password = document.getElementById('authPassword').value;
    
    const endpoint = isRegisterMode ? '/api/hoster/register' : '/api/hoster/login';
    
    try {
        const response = await fetch(SERV_ADDRESS + endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        
        const data = await response.json();
        
        if (data.success) {
            state.userType = 'hoster';
            state.hoster = data.hoster;
            hideAuthModal();
            initHosterUI();
        } else {
            alert(data.error);
        }
    } catch (error) {
        alert('Authentication failed: ' + error.message);
    }
}

async function loadClientConnection() {
    try {
        const response = await fetch(`${SERV_ADDRESS}/api/client/connection/${state.connectionId}`);
        const data = await response.json();
        
        if (data.success) {
            state.connection = data.connection;
            hideAuthModal();
            initClientUI();
        } else {
            alert('Invalid connection link');
        }
    } catch (error) {
        alert('Failed to load connection: ' + error.message);
    }
}

function logout() {
    state.userType = null;
    state.hoster = null;
    state.connectionId = null;
    state.connection = null;
    
    document.getElementById('app').classList.add('hidden');
    showAuthModal();
    
    // Clear form
    document.getElementById('authEmail').value = '';
    document.getElementById('authPassword').value = '';
}