const http = require('http');

const BASE = 'http://127.0.0.1:3005';

function requestJSON(method, path, token, body) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const u = new URL(path, BASE);
    const options = {
      method,
      hostname: u.hostname,
      port: u.port,
      path: u.pathname + u.search,
      headers: {}
    };
    if (data) {
      options.headers['Content-Type'] = 'application/json';
      options.headers['Content-Length'] = Buffer.byteLength(data);
    }
    if (token) options.headers['Authorization'] = 'Bearer ' + token;

    const req = http.request(options, (res) => {
      let buf = '';
      res.setEncoding('utf8');
      res.on('data', (c) => buf += c);
      res.on('end', () => {
        try { resolve(JSON.parse(buf)); } catch (e) { resolve(buf); }
      });
    });

    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

function openSSE(token, onData) {
  const u = new URL('/admin/stream', BASE);
  const options = {
    hostname: u.hostname,
    port: u.port,
    path: u.pathname + u.search,
    method: 'GET',
    headers: {
      'Authorization': 'Bearer ' + token,
      'Accept': 'text/event-stream'
    }
  };

  const req = http.request(options, (res) => {
    res.setEncoding('utf8');
    res.on('data', (chunk) => onData(chunk));
    res.on('end', () => console.log('SSE stream ended'));
  });

  req.on('error', (err) => console.error('SSE error', err));
  req.end();
  return req;
}

(async function main(){
  try {
    console.log('Logging in as admin...');
    const adminLogin = await requestJSON('POST','/auth/login', null, { email: 'admin@nivarahub.local', password: 'Admin@2796' });
    const adminToken = adminLogin && adminLogin.token;
    if (!adminToken) throw new Error('admin login failed');

    console.log('Opening SSE connection as admin...');
    let fullStream = '';
    const sseReq = openSSE(adminToken, (chunk) => {
      process.stdout.write('\n[SSE CHUNK] ' + chunk);
      fullStream += chunk;
    });

    // Give SSE a moment to connect
    await new Promise(r => setTimeout(r, 1000));

    console.log('\nLogging in as authority and assigning complaint 1 to admin 1...');
    const authLogin = await requestJSON('POST','/auth/login', null, { email: 'authority@nivarahub.gov', password: 'Authority@2796' });
    const authToken = authLogin && authLogin.token;
    if (!authToken) throw new Error('authority login failed');

    const assignResp = await requestJSON('PUT','/authority/complaints/1/assign', authToken, { admin_id: 1 });
    console.log('\nAssign response:', assignResp);

    // wait briefly for SSE to receive
    await new Promise(r => setTimeout(r, 2000));

    console.log('\nCaptured SSE stream content:\n', fullStream.slice(0, 2000));

    try { sseReq.abort(); } catch(e){}
    process.exit(0);
  } catch (err) {
    console.error('Test failed:', err);
    process.exit(2);
  }
})();
