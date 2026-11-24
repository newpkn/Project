const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');
const crypto = require('crypto');

const PORT = 3000;
const DATA_FILE = path.join(__dirname, 'data', 'profile.json');
const PUBLIC_DIR = path.join(__dirname, 'public');

// ══════════════════════════════════════════
//  🔐  ตั้งรหัสผ่านแอดมินตรงนี้
// ══════════════════════════════════════════
const ADMIN_PASSWORD = 'admin1234';
// ══════════════════════════════════════════

// Active tokens (in-memory; logout on server restart)
const activeTokens = new Set();

// MIME types
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

// Read profile data
function readData() {
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
  } catch {
    const defaults = {
      name: 'ชื่อของคุณ',
      title: 'ตำแหน่ง / สาขาวิชา',
      bio: 'เขียนแนะนำตัวเองสั้น ๆ ที่นี่',
      email: 'email@example.com',
      phone: '',
      github: '',
      linkedin: '',
      avatar: '',
      works: []
    };
    fs.writeFileSync(DATA_FILE, JSON.stringify(defaults, null, 2), 'utf-8');
    return defaults;
  }
}

// Save profile data
function saveData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf-8');
}

// Parse JSON body
function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try { resolve(JSON.parse(body)); }
      catch { reject(new Error('Invalid JSON')); }
    });
  });
}

// Send JSON response
function json(res, statusCode, data) {
  res.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(data));
}

// Check auth token from Authorization header
function isAuthed(req) {
  const auth = req.headers['authorization'] || '';
  const token = auth.replace('Bearer ', '');
  return activeTokens.has(token);
}

// Reject unauthorized
function unauthorized(res) {
  return json(res, 401, { error: 'กรุณาเข้าสู่ระบบก่อน' });
}

const server = http.createServer(async (req, res) => {
  const parsed = url.parse(req.url, true);
  const pathname = parsed.pathname;

  // ─── Auth routes (no token needed) ───

  // Login
  if (pathname === '/api/login' && req.method === 'POST') {
    try {
      const body = await parseBody(req);
      if (body.password === ADMIN_PASSWORD) {
        const token = crypto.randomBytes(32).toString('hex');
        activeTokens.add(token);
        return json(res, 200, { token });
      } else {
        return json(res, 401, { error: 'รหัสผ่านไม่ถูกต้อง' });
      }
    } catch { return json(res, 400, { error: 'Invalid request' }); }
  }

  // Logout
  if (pathname === '/api/logout' && req.method === 'POST') {
    const auth = (req.headers['authorization'] || '').replace('Bearer ', '');
    activeTokens.delete(auth);
    return json(res, 200, { success: true });
  }

  // Check login status
  if (pathname === '/api/auth-status' && req.method === 'GET') {
    return json(res, 200, { loggedIn: isAuthed(req) });
  }

  // ─── Public read (no auth) ───
  if (pathname === '/api/profile' && req.method === 'GET') {
    return json(res, 200, readData());
  }

  // ─── Protected write routes (require auth) ───

  if (pathname === '/api/profile' && req.method === 'PUT') {
    if (!isAuthed(req)) return unauthorized(res);
    try {
      const body = await parseBody(req);
      const data = readData();
      data.name = body.name ?? data.name;
      data.title = body.title ?? data.title;
      data.bio = body.bio ?? data.bio;
      data.email = body.email ?? data.email;
      data.phone = body.phone ?? data.phone;
      data.github = body.github ?? data.github;
      data.linkedin = body.linkedin ?? data.linkedin;
      data.avatar = body.avatar ?? data.avatar;
      saveData(data);
      return json(res, 200, data);
    } catch { return json(res, 400, { error: 'Invalid request' }); }
  }

  // Add work
  if (pathname === '/api/works' && req.method === 'POST') {
    if (!isAuthed(req)) return unauthorized(res);
    try {
      const body = await parseBody(req);
      const data = readData();
      const work = {
        id: Date.now().toString(),
        title: body.title || 'ผลงานใหม่',
        description: body.description || '',
        link: body.link || '',
        image: body.image || '',
        tags: body.tags || [],
        createdAt: new Date().toISOString()
      };
      data.works.push(work);
      saveData(data);
      return json(res, 201, work);
    } catch { return json(res, 400, { error: 'Invalid request' }); }
  }

  // Update work
  if (pathname.startsWith('/api/works/') && req.method === 'PUT') {
    if (!isAuthed(req)) return unauthorized(res);
    try {
      const id = pathname.split('/').pop();
      const body = await parseBody(req);
      const data = readData();
      const idx = data.works.findIndex(w => w.id === id);
      if (idx === -1) return json(res, 404, { error: 'Not found' });
      data.works[idx] = { ...data.works[idx], ...body, id };
      saveData(data);
      return json(res, 200, data.works[idx]);
    } catch { return json(res, 400, { error: 'Invalid request' }); }
  }

  // Delete work
  if (pathname.startsWith('/api/works/') && req.method === 'DELETE') {
    if (!isAuthed(req)) return unauthorized(res);
    const id = pathname.split('/').pop();
    const data = readData();
    data.works = data.works.filter(w => w.id !== id);
    saveData(data);
    return json(res, 200, { success: true });
  }

  // ─── Static files ───
  let filePath = pathname === '/' ? '/index.html' : pathname;
  filePath = path.join(PUBLIC_DIR, filePath);

  try {
    const stat = fs.statSync(filePath);
    if (stat.isFile()) {
      const ext = path.extname(filePath);
      res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
      fs.createReadStream(filePath).pipe(res);
    } else {
      json(res, 404, { error: 'Not found' });
    }
  } catch {
    json(res, 404, { error: 'Not found' });
  }
});

server.listen(PORT, () => {
  console.log('╔══════════════════════════════════════════╗');
  console.log('║   🌐  เว็บ Profile พร้อมใช้งานแล้ว!     ║');
  console.log(`║   👉  เปิดเบราว์เซอร์ไปที่:              ║`);
  console.log(`║       http://localhost:${PORT}             ║`);
  console.log('║                                          ║');
  console.log(`║   🔐  รหัสแอดมิน: ${ADMIN_PASSWORD}            ║`);
  console.log('║   ❌  กด Ctrl+C เพื่อหยุดเซิร์ฟเวอร์     ║');
  console.log('╚══════════════════════════════════════════╝');
});
