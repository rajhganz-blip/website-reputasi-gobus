/**
 * Production Validation Check Script
 * Run this to verify all critical APIs & pages work correctly
 * 
 * Usage: node server/tests/production-check.js
 */

const http = require('http');
const https = require('https');

const BASE_URL = process.env.TEST_URL || 'http://localhost:3000';
const ADMIN_USER = 'admin';
const ADMIN_PASS = 'admin123';
const TEST_USER = 'testuser';
const TEST_EMAIL = `test-${Date.now()}@gobus.local`;

let adminToken = null;
let userToken = null;
let testBookingCode = null;

console.log('🧪 GoBus Production Validation Check');
console.log(`Base URL: ${BASE_URL}`);
console.log('');

// Utility fetch
async function fetchAPI(method, path, body = null, token = null) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(path, BASE_URL);
    const isHttps = urlObj.protocol === 'https:';
    const client = isHttps ? https : http;

    const options = {
      hostname: urlObj.hostname,
      port: urlObj.port,
      path: urlObj.pathname + urlObj.search,
      method,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Production-Check/1.0'
      },
      timeout: 5000
    };

    if (token) options.headers['Authorization'] = `Bearer ${token}`;
    if (adminToken) options.headers['x-admin-token'] = adminToken;

    const req = client.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, data });
        }
      });
    });

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });

    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

// Tests
async function runTests() {
  let passed = 0;
  let failed = 0;

  const test = async (name, fn) => {
    try {
      await fn();
      console.log(`✅ ${name}`);
      passed++;
    } catch (err) {
      console.log(`❌ ${name}`);
      console.log(`   Error: ${err.message}`);
      failed++;
    }
  };

  // 1. Health check
  await test('1. Server health check', async () => {
    const res = await fetchAPI('GET', '/health');
    if (res.status !== 200) throw new Error(`Status ${res.status}`);
  });

  // 2. Admin login
  await test('2. Admin login endpoint', async () => {
    const res = await fetchAPI('POST', '/api/admin/login', {
      username: ADMIN_USER,
      password: ADMIN_PASS
    });
    if (!res.data.success || !res.data.token) throw new Error('Invalid response');
    adminToken = res.data.token;
  });

  // 3. Get admin stats
  await test('3. Admin dashboard stats', async () => {
    const res = await fetchAPI('GET', '/api/admin/stats', null, adminToken);
    if (res.status !== 200) throw new Error(`Status ${res.status}`);
    if (!res.data.stats) throw new Error('No stats returned');
  });

  // 4. User registration
  await test('4. User registration', async () => {
    const res = await fetchAPI('POST', '/api/auth/register', {
      name: 'Test User',
      username: TEST_USER,
      email: TEST_EMAIL,
      phone: '081234567890',
      password: 'TestPass123!'
    });
    if (!res.data.success) throw new Error(res.data.message);
  });

  // 5. User login
  await test('5. User login', async () => {
    const res = await fetchAPI('POST', '/api/auth/login', {
      username: TEST_USER,
      password: 'TestPass123!'
    });
    if (!res.data.success || !res.data.data.accessToken) throw new Error('Login failed');
    userToken = res.data.data.accessToken;
  });

  // 6. Get schedules
  await test('6. Search bus schedules', async () => {
    const res = await fetchAPI('GET', '/api/schedules?page=1&limit=10');
    if (res.status !== 200) throw new Error(`Status ${res.status}`);
    if (!Array.isArray(res.data.data)) throw new Error('Invalid schedules format');
  });

  // 7. Search with filters
  await test('7. Search with origin/destination', async () => {
    const res = await fetchAPI('GET', '/api/search?origin=Jakarta&destination=Bandung&date=2026-05-25');
    if (res.status !== 200) throw new Error(`Status ${res.status}`);
  });

  // 8. Get seats for schedule
  await test('8. Get seats for schedule', async () => {
    const res = await fetchAPI('GET', '/api/schedules?page=1&limit=1');
    if (res.data.data.length === 0) throw new Error('No schedules found');
    const scheduleId = res.data.data[0].id;
    const seatsRes = await fetchAPI('GET', `/api/seats/${scheduleId}`);
    if (seatsRes.status !== 200) throw new Error(`Status ${seatsRes.status}`);
  });

  // 9. Get promos
  await test('9. Get available promos', async () => {
    const res = await fetchAPI('GET', '/api/promos');
    if (res.status !== 200) throw new Error(`Status ${res.status}`);
    if (!Array.isArray(res.data.data)) throw new Error('Invalid promos format');
  });

  // 10. Get bookings (auth required)
  await test('10. Get user bookings', async () => {
    const res = await fetchAPI('GET', '/api/bookings/my-bookings', null, userToken);
    if (res.status !== 200 && res.status !== 401) throw new Error(`Unexpected status ${res.status}`);
  });

  // 11. Admin bookings list
  await test('11. Admin get all bookings', async () => {
    const res = await fetchAPI('GET', '/api/admin/bookings', null, adminToken);
    if (res.status !== 200) throw new Error(`Status ${res.status}`);
  });

  // 12. Contact form
  await test('12. Contact form submission', async () => {
    const res = await fetchAPI('POST', '/api/contact', {
      name: 'Test',
      email: TEST_EMAIL,
      subject: 'Test',
      message: 'Test message'
    });
    if (!res.data.success && res.data.success !== undefined) throw new Error('Unexpected response');
  });

  // 13. Routes list
  await test('13. Get routes list', async () => {
    const res = await fetchAPI('GET', '/api/routes');
    if (res.status !== 200) throw new Error(`Status ${res.status}`);
  });

  // 14. Buses list
  await test('14. Get buses list', async () => {
    const res = await fetchAPI('GET', '/api/buses');
    if (res.status !== 200) throw new Error(`Status ${res.status}`);
  });

  // 15. Invalid token should fail
  await test('15. Unauthorized access protection', async () => {
    const res = await fetchAPI('GET', '/api/admin/stats', null, 'invalid-token');
    if (res.status !== 401) throw new Error(`Expected 401, got ${res.status}`);
  });

  console.log('');
  console.log(`Results: ${passed} passed, ${failed} failed`);
  console.log(`Total: ${passed + failed} tests`);

  if (failed > 0) {
    console.log('');
    console.log('⚠️ Some tests failed. Please fix before deploying!');
    process.exit(1);
  } else {
    console.log('');
    console.log('✅ All tests passed! Ready for production.');
    process.exit(0);
  }
}

runTests().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
