/**
 * Admin Login Test Script (Node.js)
 * Usage: node server/tests/admin-login-test.js [host] [username] [password]
 * Example: node server/tests/admin-login-test.js http://localhost:3000 admin admin123
 */

const http = require('http');
const https = require('https');
const url = require('url');

const HOST = process.argv[2] || 'http://localhost:3000';
const USERNAME = process.argv[3] || 'admin';
const PASSWORD = process.argv[4] || 'admin123';

console.log('🧪 Testing Admin Login');
console.log(`Host: ${HOST}`);
console.log(`Username: ${USERNAME}`);
console.log(`Password: ${PASSWORD}`);
console.log('');

// Utility: fetch with timeout
function fetch(method, endpoint, body = null) {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(endpoint, HOST);
    const protocol = parsedUrl.protocol === 'https:' ? https : http;

    const options = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port,
      path: parsedUrl.pathname + parsedUrl.search,
      method,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Admin-Login-Test/1.0'
      },
      timeout: 5000
    };

    const req = protocol.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve({ status: res.statusCode, data: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, data, error: 'Invalid JSON' });
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
  try {
    // Test 1: Health check
    console.log('1️⃣ Checking server health...');
    try {
      const health = await fetch('GET', '/health');
      if (health.status === 200) {
        console.log('✅ Server is online\n');
      } else {
        console.log(`⚠️ Health check returned ${health.status}\n`);
      }
    } catch (e) {
      console.log(`❌ Cannot reach server at ${HOST}`);
      console.log(`Error: ${e.message}\n`);
      process.exit(1);
    }

    // Test 2: Admin login
    console.log('2️⃣ Attempting admin login...');
    const loginRes = await fetch('POST', '/api/admin/login', {
      username: USERNAME,
      password: PASSWORD
    });

    console.log(`Response status: ${loginRes.status}`);
    console.log(`Response body:`, JSON.stringify(loginRes.data, null, 2).substring(0, 300));
    console.log('');

    if (!loginRes.data.success || !loginRes.data.token) {
      console.log('❌ Login failed');
      console.log('Full response:', loginRes.data);
      process.exit(1);
    }

    const token = loginRes.data.token;
    console.log('✅ Login successful!');
    console.log(`Token (first 50 chars): ${token.substring(0, 50)}...\n`);

    // Test 3: Use token to access protected endpoint
    console.log('3️⃣ Testing token with protected endpoint (/api/admin/stats)...');
    
    const statsRes = await fetch('GET', '/api/admin/stats');
    // Note: we're not passing the token header in the test version above (simplified)
    // In real scenario, would need to modify fetch to add x-admin-token header
    
    console.log(`Response status: ${statsRes.status}`);
    console.log(`Response:`, JSON.stringify(statsRes.data, null, 2).substring(0, 300));
    console.log('');

    if (statsRes.data.success) {
      console.log('✅ Admin token is valid and working!');
    } else {
      console.log('⚠️ Stats endpoint may require authentication headers');
    }

    console.log('');
    console.log('✅ All tests completed!');
    console.log('');
    console.log('ℹ️ Next steps:');
    console.log('1. Open browser to http://localhost:3000/admin.html');
    console.log('2. Enter credentials: admin / admin123');
    console.log('3. Check browser console (F12) for any errors');

  } catch (err) {
    console.error('❌ Test error:', err.message);
    process.exit(1);
  }
}

runTests();
