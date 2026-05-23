// GoBus Client Authentication & Global Script
// ------------------------------------------

document.addEventListener('DOMContentLoaded', () => {
  // Inject Auth Modal & CSS Styles dynamically
  injectAuthStyles();
  injectAuthModal();

  // Initialize navbar links based on auth state
  checkUserState();

  // Bind login / register click events globally
  bindAuthTriggers();
});

// Toast Helper
function toast(msg, type = 'success') {
  const container = document.getElementById('toastContainer');
  if (!container) {
    // Create container if not exists
    const c = document.createElement('div');
    c.id = 'toastContainer';
    c.className = 'toast-container';
    document.body.appendChild(c);
  }
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  const icons = { success: '✅', error: '❌', info: 'ℹ️', warning: '⚠️' };
  t.innerHTML = `<span>${icons[type] || 'ℹ️'} ${msg}</span>`;
  document.getElementById('toastContainer').appendChild(t);
  
  setTimeout(() => {
    t.style.animation = 'slideOut .3s ease forwards';
    setTimeout(() => t.remove(), 300);
  }, 3500);
}

// ─── AUTH STATE CHECK ────────────────────────────────────────
function checkUserState() {
  const userStr = localStorage.getItem('gobus_user');
  const navRight = document.querySelector('.nav-right');
  if (!navRight) return;

  if (userStr) {
    const user = JSON.parse(userStr);
    // Replace login & register links with greeting and logout button
    navRight.innerHTML = `
      <span style="font-weight: 700; color: var(--primary); font-size: 0.95rem; display: flex; align-items: center; gap: 0.25rem;">
        👤 Hai, ${user.name}
      </span>
      <a href="#" class="btn btn-secondary btn-sm" onclick="logoutUser(event)" style="padding: 0.4rem 1rem; border-radius: 20px; font-weight: 600;">Keluar</a>
    `;
  } else {
    // Restore default buttons
    navRight.innerHTML = `
      <a href="#" class="btn-login" onclick="openAuthModal('login', event)">Masuk</a>
      <a href="#" class="btn btn-nav" onclick="openAuthModal('register', event)">Daftar</a>
    `;
  }
}

function logoutUser(e) {
  if (e) e.preventDefault();
  localStorage.removeItem('gobus_user');
  localStorage.removeItem('gobus_user_token');
  toast('Anda berhasil keluar.', 'info');
  setTimeout(() => {
    window.location.reload();
  }, 800);
}

// ─── EVENT BINDING ───────────────────────────────────────────
function bindAuthTriggers() {
  document.body.addEventListener('click', (e) => {
    // Scan for Masuk / Login clicks
    if (e.target.classList.contains('btn-login') || e.target.textContent === 'Masuk' || e.target.textContent === 'Login / Register') {
      if (!localStorage.getItem('gobus_user')) {
        e.preventDefault();
        openAuthModal('login');
      }
    }
    // Scan for Daftar / Register clicks
    if (e.target.textContent === 'Daftar') {
      if (!localStorage.getItem('gobus_user')) {
        e.preventDefault();
        openAuthModal('register');
      }
    }
  });
}

// ─── OPEN / CLOSE MODAL ──────────────────────────────────────
function openAuthModal(tab = 'login', e) {
  if (e) e.preventDefault();
  const overlay = document.getElementById('globalAuthOverlay');
  if (!overlay) return;

  overlay.style.display = 'flex';
  switchTab(tab);
}

function closeAuthModal() {
  const overlay = document.getElementById('globalAuthOverlay');
  if (overlay) overlay.style.display = 'none';
}

function switchTab(tab) {
  const loginForm = document.getElementById('modalLoginForm');
  const registerForm = document.getElementById('modalRegisterForm');
  const loginTabBtn = document.getElementById('tabBtnLogin');
  const registerTabBtn = document.getElementById('tabBtnRegister');

  if (tab === 'login') {
    loginForm.style.display = 'block';
    registerForm.style.display = 'none';
    loginTabBtn.classList.add('active');
    registerTabBtn.classList.remove('active');
  } else {
    loginForm.style.display = 'none';
    registerForm.style.display = 'block';
    loginTabBtn.classList.remove('active');
    registerTabBtn.classList.add('active');
  }
}

// ─── AUTH ACTIONS ────────────────────────────────────────────
async function handleUserLogin(e) {
  e.preventDefault();
  const usernameVal = document.getElementById('authLoginUsername').value.trim();
  const passwordVal = document.getElementById('authLoginPassword').value.trim();

  if (!usernameVal || !passwordVal) {
    toast('Semua kolom wajib diisi!', 'warning');
    return;
  }

  try {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: usernameVal, password: passwordVal })
    });
    
    const res = await response.json();
    if (res.success) {
      const token = res.data?.accessToken || res.token;
      const user = res.data?.user || res.user;
      localStorage.setItem('gobus_user_token', token);
      localStorage.setItem('gobus_user', JSON.stringify(user));
      toast(`Selamat datang kembali, ${user.name}!`, 'success');
      closeAuthModal();
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    } else {
      toast(res.message || 'Login gagal!', 'error');
    }
  } catch (err) {
    toast('Gagal terhubung ke server. Periksa koneksi internet Anda!', 'error');
  }
}

async function handleUserRegister(e) {
  e.preventDefault();
  const name = document.getElementById('authRegName').value.trim();
  const username = document.getElementById('authRegUsername').value.trim();
  const email = document.getElementById('authRegEmail').value.trim();
  const phone = document.getElementById('authRegPhone').value.trim();
  const password = document.getElementById('authRegPassword').value.trim();

  if (!name || !username || !email || !password) {
    toast('Silakan lengkapi seluruh kolom wajib!', 'warning');
    return;
  }

  try {
    const response = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, username, email, phone, password })
    });
    
    const res = await response.json();
    if (res.success) {
      toast('Registrasi berhasil! Silakan masuk dengan akun Anda.', 'success');
      switchTab('login');
    } else {
      toast(res.message || 'Registrasi gagal!', 'error');
    }
  } catch (err) {
    toast('Gagal melakukan pendaftaran. Silakan coba kembali!', 'error');
  }
}

// ─── DYNAMIC STYLES AND DOM INJECTION ────────────────────────
function injectAuthModal() {
  if (document.getElementById('globalAuthOverlay')) return;

  const overlay = document.createElement('div');
  overlay.id = 'globalAuthOverlay';
  overlay.className = 'global-auth-overlay';
  overlay.innerHTML = `
    <div class="auth-modal-card">
      <button class="auth-close-btn" onclick="closeAuthModal()">✕</button>
      
      <div class="auth-tabs">
        <button id="tabBtnLogin" class="auth-tab-btn active" onclick="switchTab('login')">Masuk</button>
        <button id="tabBtnRegister" class="auth-tab-btn" onclick="switchTab('register')">Daftar</button>
      </div>

      <!-- LOGIN FORM -->
      <form id="modalLoginForm" onsubmit="handleUserLogin(event)" style="display:block;">
        <div class="auth-group">
          <label>Username</label>
          <input type="text" id="authLoginUsername" placeholder="Masukkan username" required>
        </div>
        <div class="auth-group">
          <label>Password</label>
          <input type="password" id="authLoginPassword" placeholder="Masukkan password" required>
        </div>
        <button type="submit" class="btn btn-primary" style="width:100%; margin-top:1rem;">Masuk Akun</button>
        <div style="margin-top: 1rem; font-size: 0.8rem; color: var(--text-muted);">
          Demo Akun: <strong style="color:var(--primary)">user</strong> / <strong style="color:var(--primary)">user123</strong>
        </div>
      </form>

      <!-- REGISTER FORM -->
      <form id="modalRegisterForm" onsubmit="handleUserRegister(event)" style="display:none;">
        <div class="auth-group">
          <label>Nama Lengkap *</label>
          <input type="text" id="authRegName" placeholder="Nama sesuai KTP" required>
        </div>
        <div class="auth-group">
          <label>Username *</label>
          <input type="text" id="authRegUsername" placeholder="Pilih username unik" required>
        </div>
        <div class="auth-group">
          <label>Email *</label>
          <input type="email" id="authRegEmail" placeholder="nama@email.com" required>
        </div>
        <div class="auth-group">
          <label>Nomor Telepon</label>
          <input type="text" id="authRegPhone" placeholder="Contoh: 08123456789">
        </div>
        <div class="auth-group">
          <label>Password *</label>
          <input type="password" id="authRegPassword" placeholder="Minimal 6 karakter" required>
        </div>
        <button type="submit" class="btn btn-primary" style="width:100%; margin-top:1rem;">Daftar Akun Baru</button>
      </form>
    </div>
  `;
  document.body.appendChild(overlay);
}

function injectAuthStyles() {
  if (document.getElementById('authStyles')) return;
  const style = document.createElement('style');
  style.id = 'authStyles';
  style.textContent = `
    .global-auth-overlay {
      position: fixed;
      inset: 0;
      background-color: rgba(15, 23, 42, 0.6);
      backdrop-filter: blur(4px);
      z-index: 10000;
      display: none;
      align-items: center;
      justify-content: center;
      padding: 1.5rem;
      animation: fadeIn 0.25s ease-out;
    }
    .auth-modal-card {
      background: #ffffff;
      border-radius: 16px;
      width: 100%;
      max-width: 420px;
      padding: 2.5rem 2rem 2rem;
      box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
      position: relative;
      border: 1px solid #e2e8f0;
      animation: scaleIn 0.25s cubic-bezier(0.16, 1, 0.3, 1);
    }
    .auth-close-btn {
      position: absolute;
      top: 1rem;
      right: 1.25rem;
      background: none;
      border: none;
      font-size: 1.25rem;
      cursor: pointer;
      color: #94a3b8;
      transition: color 0.2s;
    }
    .auth-close-btn:hover {
      color: #1e293b;
    }
    .auth-tabs {
      display: grid;
      grid-template-columns: 1fr 1fr;
      border-bottom: 2px solid #f1f5f9;
      margin-bottom: 1.75rem;
    }
    .auth-tab-btn {
      background: none;
      border: none;
      padding: 0.75rem 0;
      font-weight: 700;
      font-size: 1rem;
      color: #94a3b8;
      cursor: pointer;
      border-bottom: 2px solid transparent;
      margin-bottom: -2px;
      transition: all 0.2s;
      font-family: inherit;
    }
    .auth-tab-btn.active {
      color: var(--primary);
      border-bottom-color: var(--primary);
    }
    .auth-group {
      display: flex;
      flex-direction: column;
      gap: 0.4rem;
      margin-bottom: 1.15rem;
    }
    .auth-group label {
      font-size: 0.8rem;
      font-weight: 600;
      color: #64748b;
    }
    .auth-group input {
      width: 100%;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      color: #1e293b;
      padding: 0.75rem 1rem;
      border-radius: 8px;
      font-size: 0.9rem;
      outline: none;
      transition: all 0.2s;
      font-family: inherit;
    }
    .auth-group input:focus {
      border-color: var(--primary);
      background: #ffffff;
      box-shadow: 0 0 0 3px rgba(16, 96, 234, 0.1);
    }
    @keyframes fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }
    @keyframes scaleIn {
      from { transform: scale(0.95); opacity: 0; }
      to { transform: scale(1); opacity: 1; }
    }
  `;
  document.head.appendChild(style);
}

// -------------------------------------------------
// PUBLIC DATA FETCHERS (used by user pages)
// -------------------------------------------------

// Fetch all active routes and populate a <select id="routeSelect">
async function loadAllRoutes() {
  try {
    const res = await fetch('/api/routes');
    const json = await res.json();
    if (!json.success) throw new Error('Gagal ambil rute');
    const select = document.getElementById('routeSelect');
    if (!select) return;
    select.innerHTML = json.data
      .map(r => `<option value="${r.id}">${r.origin} → ${r.destination} (${r.distance_km} km)</option>`)
      .join('');
  } catch (e) {
    console.error(e);
    toast(e.message, 'error');
  }
}

// Fetch active discounts and populate a <select id="discountSelect">
async function loadActiveDiscounts() {
  try {
    const res = await fetch('/api/discounts');
    const json = await res.json();
    if (!json.success) throw new Error('Gagal ambil promo');
    const select = document.getElementById('discountSelect');
    if (!select) return;
    select.innerHTML = json.data
      .map(d => `<option value="${d.code}">${d.code} – ${d.description}</option>`)
      .join('');
  } catch (e) {
    console.error(e);
    toast(e.message, 'error');
  }
}

// Call appropriate loaders depending on page
document.addEventListener('DOMContentLoaded', () => {
  if (document.getElementById('routeSelect')) loadAllRoutes();
  if (document.getElementById('discountSelect')) loadActiveDiscounts();
});
