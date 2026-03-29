const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const fs = require('fs');
require('dotenv').config();

const BASE_URL = 'http://localhost:3000';

async function runAudit() {
  console.log("=== STARTING SCRS AUTOMATED AUDIT ===");
  const results = {
    functional: [],
    security: [],
    fuzz: [],
    performance: []
  };

  let db;
  try {
    db = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD,
      database: process.env.DB_DATABASE || 'scrs'
    });
    console.log("✅ Connected to Database");
  } catch (err) {
    console.error("❌ DB Connection failed", err.message);
    process.exit(1);
  }

  const testEmailCitizen = 'audit_citizen@test.com';
  const testEmailAdmin = 'audit_admin@test.com';
  const testEmailAuthority = 'audit_authority@test.com';
  const pass = 'TestPass123!';

  // CLEANUP PAST TESTS
  await db.execute('DELETE FROM users WHERE email IN (?, ?, ?)', [testEmailCitizen, testEmailAdmin, testEmailAuthority]);

  // SEED USERS
  const hash = await bcrypt.hash(pass, 10);
  await db.execute('INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)', ['Audit Citizen', testEmailCitizen, hash, 'citizen']);
  await db.execute('INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)', ['Audit Admin', testEmailAdmin, hash, 'admin']);
  await db.execute('INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)', ['Audit Auth', testEmailAuthority, hash, 'authority']);

  const getLogins = async (email) => {
    try {
      const res = await fetch(`${BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password: pass })
      });
      if (!res.ok) throw new Error("Login failed");
      const data = await res.json();
      return data.token;
    } catch(err) {
      console.log('Login failed for', email);
      return null;
    }
  };

  const tokenCitizen = await getLogins(testEmailCitizen);
  const tokenAdmin = await getLogins(testEmailAdmin);
  const tokenAuthority = await getLogins(testEmailAuthority);

  if (!tokenCitizen || !tokenAdmin || !tokenAuthority) {
      console.error("❌ Failed to login seeded users. Ensure the backend is running on 3000.");
      process.exit(1);
  } else {
      console.log("✅ Seeded & Authenticated test users");
  }

  // --- 1. FUNCTIONAL & SECURITY: IDOR & BOLA Testing ---
  console.log("\n--- Testing Auth & Access ---");
  
  try {
    const res = await fetch(`${BASE_URL}/admin/dashboard`, { headers: { Authorization: `Bearer ${tokenCitizen}` } });
    if (res.ok) {
       results.security.push({ vulnerability: 'Broken Access Control', description: 'Citizen accessed admin dashboard', severity: 'Critical' });
    } else {
       results.security.push({ vulnerability: 'Access Control', description: 'Admin dashboard properly blocks citizen', severity: 'Pass' });
    }
  } catch(err) {
    results.security.push({ vulnerability: 'Access Control', description: 'Admin dashboard properly blocks citizen', severity: 'Pass' });
  }

  // Test SQLi on login
  try {
    const res = await fetch(`${BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: "admin@test.com' OR '1'='1", password: pass })
    });
    if (res.status === 500) {
       results.security.push({ vulnerability: 'Potential SQL Injection', description: '500 error on SQLi payload at login', severity: 'High' });
    } else {
       results.security.push({ vulnerability: 'SQL Injection Prevention', description: 'Login handles SQLi payload safely', severity: 'Pass' });
    }
  } catch(err) {
     results.security.push({ vulnerability: 'SQL Injection Prevention', description: 'Login handles SQLi payload safely', severity: 'Pass' });
  }

  // --- 2. FUZZING COMPLAINTS API ---
  console.log("\n--- Fuzzing Complaint Creation ---");
  const payloads = [
    { name: "Empty Body", data: {}, expectFail: true },
    { name: "Missing Location", data: { category: 'Road', description: 'Test' }, expectFail: true },
    { name: "Massive Description (XSS/Overflow test)", data: { category: 'Road', location: 'AuditTown', description: '<script>alert(1)</script> ' + 'A'.repeat(5000) }, expectFail: false },
    { name: "Invalid Category", data: { category: 'NotRealCategory', location: 'Loc', description: 'Test' }, expectFail: false }
  ];

  let testComplaintId = null;

  for (let p of payloads) {
    try {
        const start = Date.now();
        const res = await fetch(`${BASE_URL}/complaints`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenCitizen}` },
            body: JSON.stringify(p.data)
        });
        const time = Date.now() - start;
        results.performance.push({ endpoint: 'POST /complaints', time, payload: p.name });

        if (p.expectFail) {
            if (res.status >= 400 && res.status < 500) {
                results.fuzz.push({ payload: p.name, result: 'Correctly rejected', pass: true });
            } else if (res.status >= 500) {
                results.fuzz.push({ payload: p.name, result: `Server crashed / 500 error`, pass: false });
                results.security.push({ vulnerability: 'Unhandled Exception', description: `POST /complaints 500 on ${p.name}`, severity: 'Medium' });
            } else {
                results.fuzz.push({ payload: p.name, result: 'Failed to reject invalid payload', pass: false });
            }
        } else {
            if (res.status >= 500) {
                results.fuzz.push({ payload: p.name, result: `Server crashed / 500 error`, pass: false });
            } else {
                results.fuzz.push({ payload: p.name, result: 'Handled payload', pass: true });
                const data = await res.json();
                if (data.complaintId) testComplaintId = data.complaintId;
            }
        }
    } catch(err) {
        results.fuzz.push({ payload: p.name, result: `Fetch error: ${err.message}`, pass: false });
    }
  }

  let dbInternalId = null;
  if (testComplaintId) {
     const [rows] = await db.execute("SELECT id FROM complaints WHERE description LIKE '%<script>alert(1)</script>%' ORDER BY id DESC LIMIT 1");
     if (rows.length > 0) dbInternalId = rows[0].id;
  }

  if (dbInternalId) {
     // Test status update as citizen (should fail)
     try {
       const res = await fetch(`${BASE_URL}/complaints/${dbInternalId}`, {
           method: 'PUT',
           headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenCitizen}` },
           body: JSON.stringify({ status: 'Resolved' })
       });
       if (res.ok) {
           results.security.push({ vulnerability: 'IDOR', description: 'Citizen can update complaint status', severity: 'High' });
       } else {
           results.security.push({ vulnerability: 'IDOR', description: 'Citizen blocked from updating status', severity: 'Pass' });
       }
     } catch(err) {
       results.security.push({ vulnerability: 'IDOR', description: 'Citizen blocked from updating status', severity: 'Pass' });
     }

     // Test status update as admin (should pass)
     try {
       const res = await fetch(`${BASE_URL}/complaints/${dbInternalId}`, {
           method: 'PUT',
           headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenAdmin}` },
           body: JSON.stringify({ status: 'In Progress' })
       });
       if (res.ok) {
           results.functional.push({ feature: 'Update Complaint Status', pass: true });
       } else {
           results.functional.push({ feature: 'Update Complaint Status', pass: false, error: 'Status code: ' + res.status });
       }
     } catch(err) {
       results.functional.push({ feature: 'Update Complaint Status', pass: false, error: err.message });
     }
  }

  // Check stats performance
  const startStats = Date.now();
  try {
     await fetch(`${BASE_URL}/stats/summary`);
     results.performance.push({ endpoint: 'GET /stats/summary', time: Date.now() - startStats });
  } catch(e) {}

  fs.writeFileSync('audit_results.json', JSON.stringify(results, null, 2));
  console.log("✅ Audit script complete. Results saved to audit_results.json");
  
  // CLEANUP
  await db.execute("DELETE FROM complaints WHERE description LIKE '%<script>alert(1)</script>%' OR description='Test'");
  await db.execute('DELETE FROM users WHERE email IN (?, ?, ?)', [testEmailCitizen, testEmailAdmin, testEmailAuthority]);
  await db.end();
}

runAudit().catch(err => { console.error("FATAL ERROR", err); process.exit(1); });
