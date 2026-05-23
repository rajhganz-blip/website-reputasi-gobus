const API = '';
let token = localStorage.getItem('gobus_admin_token');

// ─── UTILS ───────────────────────────────────────────────────
function toast(msg, type = 'info') {
  const c = document.getElementById('toastContainer');
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  t.innerHTML = msg;
  c.appendChild(t);
  setTimeout(() => { t.style.animation = 'slideOut .3s ease forwards'; setTimeout(() => t.remove(), 300); }, 3500);
}
function fmt(n) { return 'Rp' + Number(n).toLocaleString('id-ID'); }
function fmtDate(d) { return d ? new Date(d).toLocaleDateString('id-ID', {day:'numeric',month:'short',year:'numeric'}) : '-'; }
function toLocalYYYYMMDD(dStr) {
  if (!dStr) return '';
  const dateObj = new Date(dStr);
  const year = dateObj.getFullYear();
  const month = String(dateObj.getMonth() + 1).padStart(2, '0');
  const day = String(dateObj.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
function getStatusBadge(status) {
  const map = { pending: 'Menunggu', paid: 'Lunas', failed: 'Batal' };
  return `<span class="badge ${status}">${map[status] || status}</span>`;
}

async function api(method, path, body, isForm) {
  const opts = { method, headers: {} };
  if (token) {
    opts.headers['x-admin-token'] = token;
    opts.headers['Authorization'] = 'Bearer ' + token;
  }
  
  if (isForm) { opts.body = body; }
  else if (body) { opts.headers['Content-Type'] = 'application/json'; opts.body = JSON.stringify(body); }
  
  const res = await fetch(API + path, opts);
  if (res.status === 401) { logout(); throw new Error('Unauthorized'); }
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.message || `HTTP Error ${res.status}`);
  }
  return res.json();
}

// ─── AUTH ────────────────────────────────────────────────────
function checkAuth() {
  if (!token) {
    document.getElementById('loginOverlay').style.display = 'flex';
  } else {
    document.getElementById('loginOverlay').style.display = 'none';
    loadDashboard();
  }
}

async function handleLogin(e) {
  e.preventDefault();
  const u = document.getElementById('username').value;
  const p = document.getElementById('password').value;
  try {
    const res = await api('POST', '/api/admin/login', { username: u, password: p });
    if (res.success) {
      token = res.token;
      localStorage.setItem('gobus_admin_token', token);
      document.getElementById('adminName').textContent = res.admin.name;
      checkAuth();
      toast('Login berhasil', 'success');
    } else {
      toast(res.message, 'error');
    }
  } catch (err) { toast(err.message, 'error'); }
}

function logout() {
  token = null;
  localStorage.removeItem('gobus_admin_token');
  checkAuth();
}

// ─── NAVIGATION ──────────────────────────────────────────────
function switchTab(tabId, el) {
  document.querySelectorAll('.tab-content').forEach(c => c.classList.add('hidden'));
  document.getElementById('tab-' + tabId).classList.remove('hidden');
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  el.classList.add('active');
  
  const titles = { dashboard: 'Dashboard', bookings: 'Manajemen Pesanan', routes: 'Rute', schedules: 'Jadwal', discounts: 'Promo', revenue: 'Laporan Pendapatan', settings: 'Pengaturan' };
  document.getElementById('pageTitle').textContent = titles[tabId];
  
  if (tabId === 'dashboard') loadDashboard();
  if (tabId === 'bookings') loadBookings();
  if (tabId === 'routes') loadRoutes();
  if (tabId === 'schedules') loadSchedules();
  if (tabId === 'discounts') loadDiscounts();
  if (tabId === 'revenue') loadRevenue();
}

// ─── DASHBOARD ───────────────────────────────────────────────
async function loadDashboard() {
  try {
    const res = await api('GET', '/api/admin/stats');
    if (!res.success) return;
    document.getElementById('statTodayRev').textContent = fmt(res.stats?.todayRevenue ?? 0);
    document.getElementById('statTotalRev').textContent = fmt(res.stats?.totalRevenue ?? 0);
    document.getElementById('statPending').textContent = res.stats?.pendingBookings ?? 0;
    document.getElementById('statSchedules').textContent = res.stats?.todaySchedules ?? 0;
    
    const bookings = res.recentBookings || [];
    document.getElementById('recentBookingsTbody').innerHTML = bookings.length === 0
      ? '<tr><td colspan="5" style="text-align:center;color:var(--muted)">Belum ada data pemesanan</td></tr>'
      : bookings.map(b => `
        <tr>
          <td style="font-family:monospace">${b.booking_code}</td>
          <td>${b.passenger_name}</td>
          <td>${b.origin} → ${b.destination}</td>
          <td style="font-weight:600">${fmt(b.total_price)}</td>
          <td>${getStatusBadge(b.payment_status)}</td>
        </tr>
      `).join('');
  } catch (err) { toast('Gagal memuat dashboard. Silakan refresh halaman!', 'error'); }
}

// ─── BOOKINGS ────────────────────────────────────────────────
async function loadBookings() {
  try {
    const search = document.getElementById('searchBooking').value;
    const status = document.getElementById('filterStatus').value;
    let url = `/api/admin/bookings?1=1`;
    if (search) url += `&search=${encodeURIComponent(search)}`;
    if (status) url += `&status=${encodeURIComponent(status)}`;
    
    const res = await api('GET', url);
    if (!res.success) return;
    
    const data = res.data || [];
    document.getElementById('bookingsTbody').innerHTML = data.length === 0
      ? '<tr><td colspan="8" style="text-align:center;color:var(--muted)">Belum ada data pemesanan</td></tr>'
      : data.map(b => `
        <tr>
          <td style="font-family:monospace; font-weight:700">${b.booking_code}</td>
          <td>${fmtDate(b.booking_date)}</td>
          <td>${b.passenger_name}</td>
          <td>${b.origin} → ${b.destination}<br><span style="font-size:0.8rem;color:var(--muted)">${fmtDate(b.travel_date)}</span></td>
          <td style="font-weight:700; color:var(--primary)">${fmt(b.total_price)}</td>
          <td>${b.payment_proof ? `<button class="btn btn-secondary btn-sm" onclick="viewProof('${b.payment_proof}', '${b.booking_code}')">Lihat</button>` : '-'}</td>
          <td>${getStatusBadge(b.payment_status)}</td>
          <td>
            ${b.payment_status === 'pending' ? `
              <button class="btn btn-success btn-sm" onclick="confirmPayment('${b.booking_code}', 'confirm')" title="Terima">✓</button>
              <button class="btn btn-danger btn-sm" onclick="confirmPayment('${b.booking_code}', 'reject')" title="Tolak">✕</button>
            ` : '-'}
          </td>
        </tr>
      `).join('');
  } catch (err) { toast('Gagal memuat pemesanan. Silakan coba lagi!', 'error'); }
}

function viewProof(url, code) {
  document.getElementById('proofImageFull').src = url;
  document.getElementById('btnConfirmPayment').onclick = () => {
    confirmPayment(code, 'confirm');
    document.getElementById('proofModal').classList.add('hidden');
  };
  document.getElementById('btnRejectPayment').onclick = () => {
    confirmPayment(code, 'reject');
    document.getElementById('proofModal').classList.add('hidden');
  };
  document.getElementById('proofModal').classList.remove('hidden');
}

async function confirmPayment(code, action) {
  if (!confirm(`Yakin ingin ${action === 'confirm' ? 'MENGKONFIRMASI' : 'MENOLAK'} pembayaran ini?`)) return;
  try {
    const res = await api('POST', '/api/admin/confirm-payment', { booking_code: code, action });
    if (res.success) {
      toast(res.message, 'success');
      loadBookings();
      loadDashboard();
    } else {
      toast(res.message, 'error');
    }
  } catch (err) { toast(err.message, 'error'); }
}

// ─── SETTINGS (QRIS) ──────────────────────────────────────────
async function uploadAdminQris(input) {
  const file = input.files[0];
  if (!file) return;
  const form = new FormData();
  form.append('qris', file);
  
  try {
    const res = await api('POST', '/api/admin/qris', form, true);
    if (res.success) {
      toast('QRIS berhasil diupload', 'success');
      document.getElementById('globalQrisPreview').innerHTML = `<img src="${res.qris_url}" style="width:200px; border-radius:12px; border:2px solid var(--primary);">`;
    } else {
      toast(res.message, 'error');
    }
  } catch (err) { toast(err.message, 'error'); }
}

// ─── ROUTES ──────────────────────────────────────────────────


function toggleRouteForm(show = true) {
  const card = document.getElementById('routeFormCard');
  if (show === true || show.type === 'click') {
    card.classList.remove('hidden');
    document.getElementById('formRouteId').value = '';
    document.getElementById('routeOrigin').value = '';
    document.getElementById('routeDestination').value = '';
    document.getElementById('routeDistance').value = '';
    document.getElementById('routeActive').value = '1';
    document.getElementById('routeDescription').value = '';
    document.getElementById('routeFormTitle').textContent = 'Tambah Rute Baru';
  } else {
    card.classList.add('hidden');
  }
}

function editRoute(id) {
  const r = routesList.find(item => item.id === id);
  if (!r) return;
  
  toggleRouteForm(true);
  document.getElementById('formRouteId').value = r.id;
  document.getElementById('routeOrigin').value = r.origin;
  document.getElementById('routeDestination').value = r.destination;
  document.getElementById('routeDistance').value = r.distance_km;
  document.getElementById('routeActive').value = r.is_active ? '1' : '0';
  document.getElementById('routeDescription').value = r.description || '';
  document.getElementById('routeFormTitle').textContent = 'Edit Rute #' + r.id;
}

async function handleSaveRoute(e) {
  e.preventDefault();
  const id = document.getElementById('formRouteId').value;
  const origin = document.getElementById('routeOrigin').value.trim();
  const destination = document.getElementById('routeDestination').value.trim();
  const distance_km = document.getElementById('routeDistance').value;
  const is_active = document.getElementById('routeActive').value === '1' ? 1 : 0;
  const description = document.getElementById('routeDescription').value.trim();

  const payload = { origin, destination, distance_km, description, is_active };
  
  try {
    let res;
    if (id) {
      res = await api('PUT', `/api/admin/routes/${id}`, payload);
    } else {
      res = await api('POST', '/api/admin/routes', payload);
    }
    
    if (res.success) {
      toast('Rute berhasil disimpan', 'success');
      toggleRouteForm(false);
      loadRoutes();
    } else {
      toast(res.message, 'error');
    }
  } catch (err) { toast(err.message, 'error'); }
}

async function deleteRoute(id) {
  if (!confirm('Apakah Anda yakin ingin menonaktifkan rute ini?')) return;
  try {
    const res = await api('DELETE', `/api/admin/routes/${id}`);
    if (res.success) {
      toast('Rute berhasil dinonaktifkan', 'success');
      loadRoutes();
    } else {
      toast(res.message, 'error');
    }
  } catch (err) { toast(err.message, 'error'); }
}

// ─── SCHEDULES ───────────────────────────────────────────────
let schedulesList = [];
async function loadSchedules() {
  try {
    const res = await api('GET', '/api/admin/schedules');
    if (!res.success) return;
    schedulesList = res.data || [];
    
    document.getElementById('schedulesTbody').innerHTML = schedulesList.map(s => `
      <tr>
        <td>${s.id}</td>
        <td style="font-weight:700">${s.bus_name}<br><span style="font-size:0.8rem;color:var(--muted)">${s.bus_class}</span></td>
        <td style="font-weight:600">${s.origin} ➔ ${s.destination}</td>
        <td>${fmtDate(s.travel_date)}<br><span style="font-family:monospace;font-size:0.8rem;color:var(--muted)">${s.departure_time.substring(0,5)} - ${s.arrival_time.substring(0,5)}</span></td>
        <td style="font-weight:700;color:var(--primary)">${fmt(s.base_price)}</td>
        <td>${s.available_seats} / ${s.total_seats || 40} Kursi</td>
        <td><span class="badge ${s.status === 'active' ? 'paid' : 'failed'}">${s.status === 'active' ? 'Aktif' : s.status}</span></td>
        <td>
          <button class="btn btn-secondary btn-sm" onclick="editSchedule(${s.id})">✏️</button>
          <button class="btn btn-danger btn-sm" onclick="deleteSchedule(${s.id})" title="Batalkan">✕</button>
        </td>
      </tr>
    `).join('');
  } catch (err) { toast('Gagal memuat jadwal. Silakan coba lagi!', 'error'); }
}

async function populateScheduleDropdowns() {
  try {
    const rRes = await api('GET', '/api/routes');
    if (rRes.success) {
      document.getElementById('schedRouteId').innerHTML = (rRes.data || []).map(r => `
        <option value="${r.id}">${r.origin} ➔ ${r.destination} (${r.distance_km} Km)</option>
      `).join('');
    }
    
    const bRes = await api('GET', '/api/admin/buses');
    if (bRes.success) {
      document.getElementById('schedBusId').innerHTML = (bRes.data || []).map(b => `
        <option value="${b.id}">${b.name} (${b.bus_class})</option>
      `).join('');
    }
  } catch (err) { console.error(err); }
}

async function toggleScheduleForm(show = true) {
  const card = document.getElementById('scheduleFormCard');
  if (show === true || show.type === 'click') {
    await populateScheduleDropdowns();
    card.classList.remove('hidden');
    document.getElementById('formScheduleId').value = '';
    document.getElementById('schedDate').value = '';
    document.getElementById('schedDepTime').value = '';
    document.getElementById('schedArrTime').value = '';
    document.getElementById('schedPrice').value = '';
    document.getElementById('schedStatus').value = 'active';
    document.getElementById('scheduleFormTitle').textContent = 'Tambah Jadwal Baru';
  } else {
    card.classList.add('hidden');
  }
}

async function editSchedule(id) {
  const s = schedulesList.find(item => item.id === id);
  if (!s) return;
  
  await toggleScheduleForm(true);
  document.getElementById('formScheduleId').value = s.id;
  document.getElementById('schedRouteId').value = s.route_id;
  document.getElementById('schedBusId').value = s.bus_id;
  
  const dVal = toLocalYYYYMMDD(s.travel_date);
  document.getElementById('schedDate').value = dVal;
  document.getElementById('schedDepTime').value = s.departure_time.substring(0, 5);
  document.getElementById('schedArrTime').value = s.arrival_time.substring(0, 5);
  document.getElementById('schedPrice').value = s.base_price;
  document.getElementById('schedStatus').value = s.status;
  document.getElementById('scheduleFormTitle').textContent = 'Edit Jadwal #' + s.id;
}

async function handleSaveSchedule(e) {
  e.preventDefault();
  const id = document.getElementById('formScheduleId').value;
  const route_id = document.getElementById('schedRouteId').value;
  const bus_id = document.getElementById('schedBusId').value;
  const travel_date = document.getElementById('schedDate').value;
  const departure_time = document.getElementById('schedDepTime').value;
  const arrival_time = document.getElementById('schedArrTime').value;
  const base_price = document.getElementById('schedPrice').value;
  const status = document.getElementById('schedStatus').value;

  const payload = { route_id, bus_id, travel_date, departure_time, arrival_time, base_price, status };
  
  try {
    let res;
    if (id) {
      res = await api('PUT', `/api/admin/schedules/${id}`, payload);
    } else {
      res = await api('POST', '/api/admin/schedules', payload);
    }
    
    if (res.success) {
      toast('Jadwal keberangkatan berhasil disimpan', 'success');
      toggleScheduleForm(false);
      loadSchedules();
    } else {
      toast(res.message, 'error');
    }
  } catch (err) { toast(err.message, 'error'); }
}

async function deleteSchedule(id) {
  if (!confirm('Apakah Anda yakin ingin membatalkan jadwal ini?')) return;
  try {
    const res = await api('DELETE', `/api/admin/schedules/${id}`);
    if (res.success) {
      toast('Jadwal berhasil dibatalkan', 'success');
      loadSchedules();
    } else {
      toast(res.message, 'error');
    }
  } catch (err) { toast(err.message, 'error'); }
}

// ─── DISCOUNTS ───────────────────────────────────────────────
let discountsList = [];
async function loadDiscounts() {
  try {
    const res = await api('GET', '/api/admin/discounts');
    if (!res.success) return;
    discountsList = res.data || [];
    
    document.getElementById('discountsTbody').innerHTML = discountsList.map(d => `
      <tr>
        <td style="font-family:monospace;font-weight:800;color:var(--accent)">${d.code}</td>
        <td>${d.discount_type === 'percentage' ? 'Persen (%)' : 'Tetap (Rp)'}</td>
        <td style="font-weight:700">${d.discount_type === 'percentage' ? d.discount_value + '%' : fmt(d.discount_value)}</td>
        <td>${fmt(d.min_purchase)}</td>
        <td>${d.used_count} / ${d.max_uses}</td>
        <td>${fmtDate(d.valid_from)} - ${fmtDate(d.valid_until)}</td>
        <td><span class="badge ${d.is_active ? 'paid' : 'failed'}">${d.is_active ? 'Aktif' : 'Non-Aktif'}</span></td>
        <td>
          <button class="btn btn-secondary btn-sm" onclick="editDiscount(${d.id})">✏️</button>
        </td>
      </tr>
    `).join('');
  } catch (err) { console.error(err); }
}

function toggleDiscountForm(show = true) {
  const card = document.getElementById('discountFormCard');
  if (show === true || show.type === 'click') {
    card.classList.remove('hidden');
    document.getElementById('formDiscountId').value = '';
    document.getElementById('discCode').value = '';
    document.getElementById('discType').value = 'percentage';
    document.getElementById('discValue').value = '';
    document.getElementById('discMinPurchase').value = '0';
    document.getElementById('discMaxUses').value = '100';
    document.getElementById('discFrom').value = '';
    document.getElementById('discUntil').value = '';
    document.getElementById('discActive').value = '1';
    document.getElementById('discDescription').value = '';
    document.getElementById('discountFormTitle').textContent = 'Tambah Promo Baru';
  } else {
    card.classList.add('hidden');
  }
}

function editDiscount(id) {
  const d = discountsList.find(item => item.id === id);
  if (!d) return;
  
  toggleDiscountForm(true);
  document.getElementById('formDiscountId').value = d.id;
  document.getElementById('discCode').value = d.code;
  document.getElementById('discType').value = d.discount_type;
  document.getElementById('discValue').value = d.discount_value;
  document.getElementById('discMinPurchase').value = d.min_purchase;
  document.getElementById('discMaxUses').value = d.max_uses;
  
  const fromVal = toLocalYYYYMMDD(d.valid_from);
  const untilVal = toLocalYYYYMMDD(d.valid_until);
  document.getElementById('discFrom').value = fromVal;
  document.getElementById('discUntil').value = untilVal;
  document.getElementById('discActive').value = d.is_active ? '1' : '0';
  document.getElementById('discDescription').value = d.description || '';
  document.getElementById('discountFormTitle').textContent = 'Edit Promo: ' + d.code;
}

async function handleSaveDiscount(e) {
  e.preventDefault();
  const id = document.getElementById('formDiscountId').value;
  const code = document.getElementById('discCode').value.trim().toUpperCase();
  const discount_type = document.getElementById('discType').value;
  const discount_value = document.getElementById('discValue').value;
  const min_purchase = document.getElementById('discMinPurchase').value;
  const max_uses = document.getElementById('discMaxUses').value;
  const valid_from = document.getElementById('discFrom').value;
  const valid_until = document.getElementById('discUntil').value;
  const is_active = document.getElementById('discActive').value === '1' ? 1 : 0;
  const description = document.getElementById('discDescription').value.trim();

  const payload = { code, discount_type, discount_value, min_purchase, max_uses, valid_from, valid_until, is_active, description };
  
  try {
    let res;
    if (id) {
      res = await api('PUT', `/api/admin/discounts/${id}`, payload);
    } else {
      res = await api('POST', '/api/admin/discounts', payload);
    }
    
    if (res.success) {
      toast('Promo berhasil disimpan', 'success');
      toggleDiscountForm(false);
      loadDiscounts();
    } else {
      toast(res.message, 'error');
    }
  } catch (err) { toast(err.message, 'error'); }
}

// ─── REVENUE ─────────────────────────────────────────────────
async function loadRevenue() {
  try {
    const res = await api('GET', '/api/admin/revenue');
    if (!res.success) return;
    
    const monthly = res.monthly || [];
    const byRoute = res.byRoute || [];

    // Monthly Table
    document.getElementById('revenueMonthlyTbody').innerHTML = monthly.length === 0
      ? '<tr><td colspan="3" style="text-align:center;color:var(--muted)">Belum ada data pendapatan</td></tr>'
      : monthly.map(m => `
        <tr>
          <td style="font-weight:600">${m.month}</td>
          <td>${m.count} Tiket</td>
          <td style="font-weight:700; color:var(--primary)">${fmt(m.revenue)}</td>
        </tr>
      `).join('');
    
    // Route Table
    document.getElementById('revenueRouteTbody').innerHTML = byRoute.length === 0
      ? '<tr><td colspan="3" style="text-align:center;color:var(--muted)">Belum ada data per rute</td></tr>'
      : byRoute.map(r => `
        <tr>
          <td style="font-weight:600">${r.origin} ➔ ${r.destination}</td>
          <td>${r.bookings} Kali</td>
          <td style="font-weight:700; color:var(--accent)">${fmt(r.revenue)}</td>
        </tr>
      `).join('');
  } catch (err) { console.error('loadRevenue error:', err); toast('Gagal memuat pendapatan: ' + err.message, 'error'); }
}

// INIT
checkAuth();

