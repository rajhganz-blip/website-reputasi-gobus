const API = '';
let selectedSchedule = null, selectedSeats = [], bookingData = null, discountData = null;

// ─── UTILS ───────────────────────────────────────────────────
function toast(msg, type = 'info') {
  const c = document.getElementById('toastContainer');
  const icons = { success: '✅', error: '❌', info: 'ℹ️', warning: '⚠️' };
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  t.innerHTML = `${icons[type]} ${msg}`;
  c.appendChild(t);
  setTimeout(() => { t.style.animation = 'slideOut .3s ease forwards'; setTimeout(() => t.remove(), 300); }, 3500);
}
function fmt(n) { return 'Rp' + Number(n).toLocaleString('id-ID'); }
function fmtTime(t) { return t ? t.slice(0, 5) : '-'; }
function fmtDate(d) { if (!d) return '-'; const dt = new Date(d); return dt.toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }); }
function openModal(id) { document.getElementById(id).classList.remove('hidden'); document.body.style.overflow = 'hidden'; }
function closeModal(id) { document.getElementById(id).classList.add('hidden'); document.body.style.overflow = ''; }
async function api(method, path, body, isForm) {
  const opts = { method, headers: {} };
  if (isForm) { opts.body = body; }
  else if (body) { opts.headers['Content-Type'] = 'application/json'; opts.body = JSON.stringify(body); }
  const res = await fetch(API + path, opts);
  return res.json();
}

// ─── INIT ─────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  const today = new Date().toISOString().split('T')[0];
  document.getElementById('searchDate').value = today;
  document.getElementById('searchDate').min = today;
  loadPopularRoutes();
});

// ─── SWAP CITIES ──────────────────────────────────────────────
function swapCities() {
  const o = document.getElementById('searchOrigin');
  const d = document.getElementById('searchDestination');
  [o.value, d.value] = [d.value, o.value];
}

// ─── SEARCH ───────────────────────────────────────────────────
async function searchBuses() {
  const origin = document.getElementById('searchOrigin').value.trim();
  const dest = document.getElementById('searchDestination').value.trim();
  const date = document.getElementById('searchDate').value;
  if (!origin || !dest || !date) { toast('Lengkapi semua field pencarian', 'warning'); return; }
  if (origin.toLowerCase() === dest.toLowerCase()) { toast('Kota asal dan tujuan tidak boleh sama', 'warning'); return; }
  const section = document.getElementById('resultsSection');
  const container = document.getElementById('resultsContainer');
  section.style.display = 'block';
  container.innerHTML = '<div class="loader"><div class="spinner"></div><span>Mencari bus...</span></div>';
  document.getElementById('resultsTitle').textContent = `${origin} → ${dest}`;
  document.getElementById('resultsCount').textContent = fmtDate(date);
  section.scrollIntoView({ behavior: 'smooth' });
  const data = await api('GET', `/api/search?origin=${origin}&destination=${dest}&date=${date}`);
  if (!data.success || !data.data.length) {
    container.innerHTML = '<div class="no-results"><div class="icon">😔</div><p>Tidak ada jadwal tersedia untuk rute ini</p><p style="font-size:.85rem;margin-top:.3rem;color:var(--muted)">Coba ganti tanggal atau rute</p></div>';
    return;
  }
  document.getElementById('resultsCount').textContent = `${data.data.length} jadwal • ${fmtDate(date)}`;
  container.innerHTML = data.data.map(s => `
    <div class="bus-card" onclick="selectSchedule(${JSON.stringify(s).replace(/"/g, '&quot;')})">
      <div class="bus-info">
        <div class="bus-class-badge">🚌 ${s.bus_class}</div>
        <h3>${s.bus_name}</h3>
        <div class="bus-facilities">${(s.facilities || '').split(',').map(f => `<span class="facility-tag">${f.trim()}</span>`).join('')}</div>
      </div>
      <div class="time-info">
        <div class="time-big">${fmtTime(s.departure_time)}</div>
        <div class="time-label">Berangkat</div>
        <div class="duration">${s.distance_km} km</div>
      </div>
      <div class="time-info">
        <div class="time-big">${fmtTime(s.arrival_time)}</div>
        <div class="time-label">Tiba</div>
      </div>
      <div class="seat-info">
        <div class="seat-count">${s.available_seats}</div>
        <div class="seat-label">Kursi tersedia</div>
        <div class="seat-label" style="margin-top:.3rem">${s.total_seats} total</div>
      </div>
      <div class="price-info">
        <div class="price-amount">${fmt(s.base_price)}</div>
        <div class="price-per">/kursi</div>
        <button class="btn btn-primary btn-sm">Pilih Kursi →</button>
      </div>
    </div>`).join('');
}

// ─── SELECT SCHEDULE & SEAT ────────────────────────────────────
async function selectSchedule(s) {
  selectedSchedule = s;
  selectedSeats = [];
  document.getElementById('seatScheduleInfo').innerHTML = `
    <strong>${s.bus_name}</strong> (${s.bus_class}) • ${s.origin} → ${s.destination}<br>
    🕐 ${fmtTime(s.departure_time)} – ${fmtTime(s.arrival_time)} • ${fmtDate(s.travel_date)} • <span style="color:var(--primary)">${fmt(s.base_price)}/kursi</span>`;
  const res = await api('GET', `/api/seats/${s.id}`);
  const booked = res.booked || [];
  renderSeatMap(s.total_seats, booked, s.bus_class);
  openModal('seatModal');
}

function renderSeatMap(total, booked, cls) {
  const grid = document.getElementById('seatGrid');
  const rows = Math.ceil(total / 4);
  const cols = cls === 'Super Executive' ? 3 : 4;
  let html = '';
  for (let r = 0; r < rows; r++) {
    html += '<div class="seat-row">';
    for (let c = 0; c < cols; c++) {
      if (cols === 4 && c === 2) html += '<div class="seat aisle"></div>';
      const num = r * cols + c + 1;
      if (num > total) { html += '<div class="seat" style="visibility:hidden"></div>'; continue; }
      const id = `S${num}`;
      const isBooked = booked.includes(id);
      html += `<div class="seat ${isBooked ? 'booked' : 'available'}" id="seat-${id}" onclick="toggleSeat('${id}',${isBooked})">${id}</div>`;
    }
    html += '</div>';
  }
  grid.innerHTML = html;
  updateSeatContinueBtn();
}

function toggleSeat(id, isBooked) {
  if (isBooked) return;
  const el = document.getElementById(`seat-${id}`);
  const idx = selectedSeats.indexOf(id);
  if (idx > -1) { selectedSeats.splice(idx, 1); el.classList.remove('selected'); el.classList.add('available'); }
  else { selectedSeats.push(id); el.classList.remove('available'); el.classList.add('selected'); }
  updateSeatInfo();
  updateSeatContinueBtn();
}

function updateSeatInfo() {
  const info = document.getElementById('selectedSeatsInfo');
  if (!selectedSeats.length) { info.classList.add('hidden'); return; }
  info.classList.remove('hidden');
  const total = selectedSchedule.base_price * selectedSeats.length;
  info.innerHTML = `✅ Kursi dipilih: <strong>${selectedSeats.join(', ')}</strong> &nbsp;|&nbsp; Total: <strong style="color:var(--primary)">${fmt(total)}</strong>`;
}

function updateSeatContinueBtn() {
  const btn = document.getElementById('seatContinueBtn');
  btn.disabled = selectedSeats.length === 0;
}

// ─── BOOKING FORM ─────────────────────────────────────────────
function openBookingForm() {
  discountData = null;
  document.getElementById('discountCode').value = '';
  document.getElementById('discountResult').innerHTML = '';
  updatePriceBreakdown();
  closeModal('seatModal');
  openModal('bookingModal');
}

function updatePriceBreakdown() {
  const base = selectedSchedule.base_price * selectedSeats.length;
  const disc = discountData ? discountData.amount : 0;
  const total = base - disc;
  document.getElementById('priceBreakdown').innerHTML = `
    <div class="price-row"><span>Harga (${selectedSeats.length} kursi × ${fmt(selectedSchedule.base_price)})</span><span>${fmt(base)}</span></div>
    ${disc > 0 ? `<div class="price-row" style="color:var(--success)"><span>Diskon (${discountData.discount.code})</span><span>-${fmt(disc)}</span></div>` : ''}
    <div class="price-row total"><span>Total Pembayaran</span><span>${fmt(total)}</span></div>`;
}

async function applyDiscount() {
  const code = document.getElementById('discountCode').value.trim().toUpperCase();
  if (!code) return;
  const base = selectedSchedule.base_price * selectedSeats.length;
  const res = await api('POST', '/api/discount/validate', { code, amount: base });
  const el = document.getElementById('discountResult');
  if (res.success) {
    discountData = res;
    el.innerHTML = `<div class="discount-applied">✅ Hemat ${fmt(res.amount)} dengan kode <strong>${code}</strong></div>`;
    toast('Kode promo berhasil diterapkan!', 'success');
  } else {
    discountData = null;
    el.innerHTML = `<div style="color:var(--danger);font-size:.85rem;margin-top:.3rem">❌ ${res.message}</div>`;
  }
  updatePriceBreakdown();
}

async function submitBooking() {
  const name = document.getElementById('passengerName').value.trim();
  const phone = document.getElementById('passengerPhone').value.trim();
  const email = document.getElementById('passengerEmail').value.trim();
  if (!name || !phone || !email) { toast('Nama, HP, dan Email wajib diisi', 'warning'); return; }
  if (!email.includes('@')) { toast('Format email tidak valid', 'warning'); return; }
  const body = {
    schedule_id: selectedSchedule.id,
    passenger_name: name, passenger_phone: phone, passenger_email: email,
    passenger_id_number: document.getElementById('passengerIdNumber').value.trim(),
    seat_numbers: selectedSeats.join(','),
    discount_code: discountData ? document.getElementById('discountCode').value.trim().toUpperCase() : ''
  };
  const res = await api('POST', '/api/booking', body);
  if (!res.success) { toast(res.message, 'error'); return; }
  bookingData = { ...res, ...body };
  closeModal('bookingModal');
  document.getElementById('paymentAmount').textContent = fmt(res.total_price);
  document.getElementById('paymentCode').textContent = res.booking_code;
  loadQris(res.booking_code);
  openModal('paymentModal');
}

// ─── PAYMENT ──────────────────────────────────────────────────
async function loadQris(code) {
  const res = await api('GET', `/api/qris/${code}`);
  const container = document.getElementById('qrisImageContainer');
  if (res.success && res.data.qris_image) {
    container.innerHTML = `<img src="${res.data.qris_image}" class="qris-img" alt="QRIS GoBus">`;
  } else {
    container.innerHTML = `<div class="qris-placeholder"><span>📲</span><p>QRIS sedang disiapkan admin</p><p style="font-size:.75rem;margin-top:.3rem">Klik Refresh untuk memperbarui</p></div>`;
  }
}

function refreshQris() { if (bookingData) loadQris(bookingData.booking_code); }

function previewProof(input) {
  const file = input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    document.getElementById('proofPreview').innerHTML = `<img src="${e.target.result}" style="max-width:100%;max-height:150px;border-radius:8px;margin-top:.5rem">`;
  };
  reader.readAsDataURL(file);
}

async function submitPaymentProof() {
  const file = document.getElementById('proofFile').files[0];
  if (!file) { toast('Pilih foto bukti pembayaran terlebih dahulu', 'warning'); return; }
  const form = new FormData();
  form.append('proof', file);
  form.append('booking_code', bookingData.booking_code);
  const res = await api('POST', '/api/payment/proof', form, true);
  if (!res.success) { toast(res.message, 'error'); return; }
  toast('Bukti pembayaran berhasil dikirim! Menunggu konfirmasi admin.', 'success');
  closeModal('paymentModal');
  showTicket(bookingData.booking_code);
}

// ─── TICKET ───────────────────────────────────────────────────
async function showTicket(code) {
  const res = await api('GET', `/api/ticket/${code}`);
  if (!res.success) { toast('Tiket tidak ditemukan', 'error'); return; }
  const t = res.data;
  const statusEl = t.payment_status === 'paid'
    ? `<div class="ticket-status-paid">✅ PEMBAYARAN DIKONFIRMASI</div>`
    : `<div class="ticket-status-pending">⏳ MENUNGGU KONFIRMASI ADMIN</div>`;
  document.getElementById('eticketContent').innerHTML = `
    <div class="eticket">
      <div class="ticket-header">
        <div class="ticket-logo">🚌 GoBus</div>
        <div class="ticket-code">${t.booking_code}</div>
      </div>
      ${statusEl}
      <div class="ticket-route">
        <div><div class="ticket-city">${t.origin}</div><div class="ticket-time">${fmtTime(t.departure_time)}</div></div>
        <div class="ticket-arrow">✈ ──────</div>
        <div><div class="ticket-city">${t.destination}</div><div class="ticket-time">${fmtTime(t.arrival_time)}</div></div>
      </div>
      <div class="ticket-details">
        <div class="ticket-detail-item"><label>Tanggal</label><p>${fmtDate(t.travel_date)}</p></div>
        <div class="ticket-detail-item"><label>Bus</label><p>${t.bus_name}</p></div>
        <div class="ticket-detail-item"><label>Kelas</label><p>${t.bus_class}</p></div>
        <div class="ticket-detail-item"><label>Kursi</label><p>${t.seat_numbers}</p></div>
        <div class="ticket-detail-item"><label>Penumpang</label><p>${t.passenger_name}</p></div>
        <div class="ticket-detail-item"><label>HP</label><p>${t.passenger_phone}</p></div>
        <div class="ticket-detail-item"><label>Fasilitas</label><p>${(t.facilities || '-').replace(/,/g, ', ')}</p></div>
        <div class="ticket-detail-item"><label>Total Bayar</label><p style="color:var(--primary)">${fmt(t.total_price)}</p></div>
      </div>
    </div>`;
  openModal('ticketModal');
}

async function checkTicket() {
  const code = document.getElementById('ticketCode').value.trim().toUpperCase();
  if (!code) { toast('Masukkan kode booking', 'warning'); return; }
  const res = await api('GET', `/api/ticket/${code}`);
  const el = document.getElementById('ticketResult');
  if (!res.success) { el.innerHTML = `<p style="color:var(--danger)">❌ ${res.message}</p>`; return; }
  const t = res.data;
  const statusColor = t.payment_status === 'paid' ? 'var(--success)' : t.payment_status === 'failed' ? 'var(--danger)' : 'var(--warning)';
  const statusText = { paid: '✅ Dikonfirmasi', pending: '⏳ Menunggu Konfirmasi', failed: '❌ Ditolak', refunded: '↩ Refunded' };
  el.innerHTML = `
    <div style="background:var(--bg);border-radius:12px;padding:1rem;font-size:.9rem">
      <div style="display:flex;justify-content:space-between;margin-bottom:.8rem;align-items:center">
        <strong style="font-size:1.1rem">${t.origin} → ${t.destination}</strong>
        <span style="color:${statusColor};font-weight:700">${statusText[t.payment_status] || t.payment_status}</span>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:.4rem;color:var(--muted)">
        <span>Penumpang: <strong style="color:var(--text)">${t.passenger_name}</strong></span>
        <span>Kursi: <strong style="color:var(--text)">${t.seat_numbers}</strong></span>
        <span>Tanggal: <strong style="color:var(--text)">${fmtDate(t.travel_date)}</strong></span>
        <span>Bus: <strong style="color:var(--text)">${t.bus_name}</strong></span>
        <span>Keberangkatan: <strong style="color:var(--text)">${fmtTime(t.departure_time)}</strong></span>
        <span>Total: <strong style="color:var(--primary)">${fmt(t.total_price)}</strong></span>
      </div>
      <button class="btn btn-primary btn-sm" style="margin-top:1rem" onclick="showTicket('${t.booking_code}')">Lihat E-Tiket Lengkap</button>
    </div>`;
}

// ─── POPULAR ROUTES ────────────────────────────────────────────
async function loadPopularRoutes() {
  const res = await api('GET', '/api/routes/popular');
  const grid = document.getElementById('popularRoutesGrid');
  if (!res.success || !res.data.length) { grid.innerHTML = '<p style="color:var(--muted);text-align:center">Belum ada rute tersedia</p>'; return; }
  const icons = ['🏙️', '🌄', '⛩️', '🌊', '🏝️', '🌋'];
  grid.innerHTML = res.data.map((r, i) => `
    <div class="route-card" onclick="quickSearch('${r.origin}','${r.destination}')">
      <div class="route-icon">${icons[i % icons.length]}</div>
      <div class="route-cities"><span>${r.origin}</span><span class="arrow">→</span><span>${r.destination}</span></div>
      <div class="route-price">${r.min_price ? fmt(r.min_price) : 'Cek Harga'}</div>
      <div class="route-from">mulai dari</div>
      <div class="route-meta"><span>📍 ${r.distance_km} km</span><span>🕐 ${r.schedule_count || 0} jadwal</span></div>
    </div>`).join('');
}

function quickSearch(origin, dest) {
  document.getElementById('searchOrigin').value = origin;
  document.getElementById('searchDestination').value = dest;
  searchBuses();
  document.querySelector('.search-section').scrollIntoView({ behavior: 'smooth' });
}
