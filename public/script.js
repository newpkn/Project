// ─── State ───
let profileData = {};
let authToken = localStorage.getItem('adminToken') || '';

// ─── Load on start ───
document.addEventListener('DOMContentLoaded', async () => {
  await checkAuth();
  await loadProfile();
});

// ─── Auth helpers ───
function authHeaders() {
  return authToken ? { 'Authorization': 'Bearer ' + authToken, 'Content-Type': 'application/json' } : { 'Content-Type': 'application/json' };
}

async function checkAuth() {
  if (!authToken) { updateUI(false); return; }
  try {
    const res = await fetch('/api/auth-status', { headers: { 'Authorization': 'Bearer ' + authToken } });
    const data = await res.json();
    updateUI(data.loggedIn);
    if (!data.loggedIn) { authToken = ''; localStorage.removeItem('adminToken'); }
  } catch {
    updateUI(false);
  }
}

function updateUI(loggedIn) {
  const adminEls = document.querySelectorAll('.admin-only');
  const loginBtn = document.getElementById('loginBtn');

  if (loggedIn) {
    adminEls.forEach(el => el.style.display = '');
    loginBtn.textContent = '🚪 ออกจากระบบ';
    loginBtn.onclick = doLogout;
    loginBtn.classList.add('logged-in');
  } else {
    adminEls.forEach(el => el.style.display = 'none');
    loginBtn.textContent = '🔐 เข้าสู่ระบบแอดมิน';
    loginBtn.onclick = () => openLoginModal();
    loginBtn.classList.remove('logged-in');
  }
}

// ─── Login ───
function openLoginModal() {
  document.getElementById('loginPassword').value = '';
  document.getElementById('loginError').style.display = 'none';
  openModal('loginModal');
  setTimeout(() => document.getElementById('loginPassword').focus(), 100);
}

async function doLogin() {
  const pw = document.getElementById('loginPassword').value;
  const errEl = document.getElementById('loginError');
  if (!pw) { errEl.textContent = 'กรุณากรอกรหัสผ่าน'; errEl.style.display = 'block'; return; }

  try {
    const res = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: pw }),
    });
    const data = await res.json();
    if (res.ok && data.token) {
      authToken = data.token;
      localStorage.setItem('adminToken', authToken);
      closeModal('loginModal');
      updateUI(true);
      renderWorks(); // re-render to show edit/delete buttons
    } else {
      errEl.textContent = data.error || 'รหัสผ่านไม่ถูกต้อง';
      errEl.style.display = 'block';
    }
  } catch (err) {
    errEl.textContent = 'เกิดข้อผิดพลาด: ' + err.message;
    errEl.style.display = 'block';
  }
}

async function doLogout() {
  try {
    await fetch('/api/logout', { method: 'POST', headers: authHeaders() });
  } catch { /* ignore */ }
  authToken = '';
  localStorage.removeItem('adminToken');
  updateUI(false);
  renderWorks(); // re-render to hide edit/delete buttons
}

// ─── Load Profile ───
async function loadProfile() {
  try {
    const res = await fetch('/api/profile');
    profileData = await res.json();
    renderProfile();
    renderWorks();
  } catch (err) {
    console.error('โหลดข้อมูลไม่สำเร็จ:', err);
  }
}

// ─── Render Profile ───
function renderProfile() {
  const d = profileData;
  document.getElementById('profileName').textContent = d.name;
  document.getElementById('profileTitle').textContent = d.title;
  document.getElementById('profileBio').textContent = d.bio;

  const wrap = document.getElementById('avatarWrap');
  if (d.avatar) {
    wrap.innerHTML = `<img src="${escHtml(d.avatar)}" alt="avatar">`;
  } else {
    wrap.textContent = d.name ? d.name.charAt(0).toUpperCase() : '?';
  }

  const row = document.getElementById('contactRow');
  let html = '';
  if (d.email) html += `<a href="mailto:${escHtml(d.email)}">📧 ${escHtml(d.email)}</a>`;
  if (d.phone) html += `<span>📱 ${escHtml(d.phone)}</span>`;
  if (d.github) html += `<a href="${escHtml(d.github)}" target="_blank">🐙 GitHub</a>`;
  if (d.linkedin) html += `<a href="${escHtml(d.linkedin)}" target="_blank">💼 LinkedIn</a>`;
  row.innerHTML = html;
}

// ─── Render Works ───
function renderWorks() {
  const grid = document.getElementById('worksGrid');
  const empty = document.getElementById('emptyState');
  const works = profileData.works || [];
  const isAdmin = !!authToken;

  if (works.length === 0) {
    grid.innerHTML = '';
    empty.style.display = 'block';
    empty.querySelector('p').textContent = isAdmin
      ? 'ยังไม่มีผลงาน — กดปุ่ม "เพิ่มผลงาน" เพื่อเริ่มต้น!'
      : 'ยังไม่มีผลงาน';
    return;
  }
  empty.style.display = 'none';

  grid.innerHTML = works.map(w => `
    <div class="work-card">
      <div class="work-thumb">
        ${w.image ? `<img src="${escHtml(w.image)}" alt="${escHtml(w.title)}">` : '📄'}
        ${isAdmin ? `
          <div class="work-actions">
            <button class="btn btn-ghost" style="padding:0.2rem 0.5rem;font-size:0.8rem;background:rgba(255,255,255,0.9);" onclick="editWork('${w.id}')">✏️</button>
            <button class="btn btn-danger" onclick="deleteWork('${w.id}')">🗑️</button>
          </div>
        ` : ''}
      </div>
      <div class="work-body">
        <h4>${escHtml(w.title)}</h4>
        <p>${escHtml(w.description)}</p>
        ${w.tags && w.tags.length ? `
          <div class="work-tags">
            ${w.tags.map(t => `<span class="tag">${escHtml(t)}</span>`).join('')}
          </div>
        ` : ''}
      </div>
      ${w.link ? `<a class="work-link" href="${escHtml(w.link)}" target="_blank">🔗 ดูรายละเอียดผลงาน →</a>` : ''}
    </div>
  `).join('');
}

// ─── Profile Modal ───
function openProfileModal() {
  const d = profileData;
  document.getElementById('fName').value = d.name || '';
  document.getElementById('fTitle').value = d.title || '';
  document.getElementById('fBio').value = d.bio || '';
  document.getElementById('fEmail').value = d.email || '';
  document.getElementById('fPhone').value = d.phone || '';
  document.getElementById('fGithub').value = d.github || '';
  document.getElementById('fLinkedin').value = d.linkedin || '';
  document.getElementById('fAvatar').value = d.avatar || '';
  openModal('profileModal');
}

async function saveProfile() {
  const body = {
    name: document.getElementById('fName').value.trim(),
    title: document.getElementById('fTitle').value.trim(),
    bio: document.getElementById('fBio').value.trim(),
    email: document.getElementById('fEmail').value.trim(),
    phone: document.getElementById('fPhone').value.trim(),
    github: document.getElementById('fGithub').value.trim(),
    linkedin: document.getElementById('fLinkedin').value.trim(),
    avatar: document.getElementById('fAvatar').value.trim(),
  };
  try {
    const res = await fetch('/api/profile', { method: 'PUT', headers: authHeaders(), body: JSON.stringify(body) });
    if (res.status === 401) { alert('กรุณาเข้าสู่ระบบก่อนแก้ไข'); return; }
    profileData = await res.json();
    renderProfile();
    closeModal('profileModal');
  } catch (err) { alert('บันทึกไม่สำเร็จ: ' + err.message); }
}

// ─── Work Modal ───
function openWorkModal() {
  document.getElementById('wId').value = '';
  document.getElementById('wTitle').value = '';
  document.getElementById('wDesc').value = '';
  document.getElementById('wLink').value = '';
  document.getElementById('wImage').value = '';
  document.getElementById('wTags').value = '';
  document.getElementById('workModalTitle').textContent = '➕ เพิ่มผลงาน';
  openModal('workModal');
}

function editWork(id) {
  const w = profileData.works.find(x => x.id === id);
  if (!w) return;
  document.getElementById('wId').value = w.id;
  document.getElementById('wTitle').value = w.title || '';
  document.getElementById('wDesc').value = w.description || '';
  document.getElementById('wLink').value = w.link || '';
  document.getElementById('wImage').value = w.image || '';
  document.getElementById('wTags').value = (w.tags || []).join(', ');
  document.getElementById('workModalTitle').textContent = '✏️ แก้ไขผลงาน';
  openModal('workModal');
}

async function saveWork() {
  const id = document.getElementById('wId').value;
  const body = {
    title: document.getElementById('wTitle').value.trim(),
    description: document.getElementById('wDesc').value.trim(),
    link: document.getElementById('wLink').value.trim(),
    image: document.getElementById('wImage').value.trim(),
    tags: document.getElementById('wTags').value.split(',').map(t => t.trim()).filter(Boolean),
  };
  if (!body.title) { alert('กรุณากรอกชื่อผลงาน'); return; }

  try {
    const url = id ? `/api/works/${id}` : '/api/works';
    const method = id ? 'PUT' : 'POST';
    const res = await fetch(url, { method, headers: authHeaders(), body: JSON.stringify(body) });
    if (res.status === 401) { alert('กรุณาเข้าสู่ระบบก่อนแก้ไข'); return; }
    closeModal('workModal');
    await loadProfile();
  } catch (err) { alert('บันทึกไม่สำเร็จ: ' + err.message); }
}

async function deleteWork(id) {
  if (!confirm('ต้องการลบผลงานนี้หรือไม่?')) return;
  try {
    const res = await fetch(`/api/works/${id}`, { method: 'DELETE', headers: authHeaders() });
    if (res.status === 401) { alert('กรุณาเข้าสู่ระบบก่อนลบ'); return; }
    await loadProfile();
  } catch (err) { alert('ลบไม่สำเร็จ: ' + err.message); }
}

// ─── Modal Helpers ───
function openModal(id) { document.getElementById(id).classList.add('active'); }
function closeModal(id) { document.getElementById(id).classList.remove('active'); }

document.querySelectorAll('.modal-overlay').forEach(el => {
  el.addEventListener('click', e => { if (e.target === el) el.classList.remove('active'); });
});

// ─── Utility ───
function escHtml(str) {
  const div = document.createElement('div');
  div.textContent = str || '';
  return div.innerHTML;
}
