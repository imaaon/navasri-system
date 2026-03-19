// ===== ACCOUNTS MODULE =====

// ===== ACCOUNT MANAGEMENT =====
const ROLE_LABELS = {
  admin:             '👑 admin',
  manager:           '🏆 ผู้บริหาร (Executive)',
  officer:           '📋 ธุรการ (Officer)',
  accounting:        '💰 บัญชี (Accounting)',
  nurse:             '🏥 พยาบาล',
  caregiver:         '👤 ผู้ดูแล / บริบาล',
  physical_therapist:'🤸 นักกายภาพบำบัด',
  supervisor:        '📋 หัวหน้า',
  warehouse:         '🏪 คลังสินค้า',
};
const ROLE_BADGE = {
  admin:'badge-red', manager:'badge-red', officer:'badge-purple',
  accounting:'badge-orange', nurse:'badge-blue',
  caregiver:'badge-green', physical_therapist:'badge-green',
  supervisor:'badge-purple', warehouse:'badge-orange',
};

function renderAccounts() {
  if (!db.users) db.users = {};
  const allAccounts = [
    ...Object.entries(BUILTIN_ACCOUNTS).map(([u,a]) => ({ username:u, ...a, builtin:true })),
    ...Object.entries(db.users).map(([u,a]) => ({ username:u, ...a, builtin:false })),
  ];
  document.getElementById('accTableTitle').textContent = `รายการ Account ทั้งหมด (${allAccounts.length} account)`;
  const tb = document.getElementById('accTable');
  tb.innerHTML = allAccounts.map((a, i) => `<tr>
    <td class="number" style="color:var(--text3);">${i+1}</td>
    <td style="font-weight:700;font-family:monospace;">${a.username}${a.builtin ? ' <span style="font-size:10px;color:var(--text3);font-family:sans-serif;">(built-in)</span>' : ''}</td>
    <td>${a.displayName}</td>
    <td><span class="badge ${ROLE_BADGE[a.role]||'badge-gray'}">${ROLE_LABELS[a.role]||a.role}</span></td>
    <td style="font-size:12px;color:var(--text2);">${a.position||'-'}</td>
    <td class="number" style="font-size:12px;color:var(--text2);">${a.createdAt ? a.createdAt.slice(0,10) : '-'}</td>
    <td class="number" style="font-size:12px;color:var(--text2);">${a.lastLogin ? a.lastLogin.slice(0,10) : '-'}</td>
    <td style="white-space:nowrap;">
      <button class="btn btn-ghost btn-sm" onclick="editAccount('${a.username}')">✏️</button>
      ${!a.builtin ? `<button class="btn btn-ghost btn-sm" onclick="deleteAccount('${a.username}')" style="color:#e74c3c;">🗑️</button>` : ''}
    </td>
  </tr>`).join('');
}

function openAddAccountModal() {
  document.getElementById('acc-edit-username').value = '';
  document.getElementById('acc-username').value = '';
  document.getElementById('acc-username').disabled = false;
  document.getElementById('acc-displayname').value = '';
  document.getElementById('acc-role').value = '';
  document.getElementById('acc-position').value = '';
  document.getElementById('acc-password').value = '';
  document.getElementById('acc-password2').value = '';
  document.getElementById('acc-pass-label').innerHTML = 'Password <span class="required">*</span>';
  document.getElementById('acc-pass-hint').style.display = 'none';
  document.getElementById('acc-confirm-req').style.display = '';
  document.getElementById('modal-addAccount-title').textContent = 'เพิ่ม Account';
  openModal('modal-addAccount');
}

function editAccount(username) {
  const allAccounts = { ...BUILTIN_ACCOUNTS, ...(db.users||{}) };
  const a = allAccounts[username];
  if (!a) return;
  document.getElementById('acc-edit-username').value = username;
  document.getElementById('acc-username').value = username;
  document.getElementById('acc-username').disabled = true;
  document.getElementById('acc-displayname').value = a.displayName || '';
  document.getElementById('acc-role').value = a.role || '';
  document.getElementById('acc-position').value = a.position || '';
  document.getElementById('acc-password').value = '';
  document.getElementById('acc-password2').value = '';
  document.getElementById('acc-pass-label').innerHTML = 'Password';
  document.getElementById('acc-pass-hint').style.display = '';
  document.getElementById('acc-confirm-req').style.display = 'none';
  document.getElementById('modal-addAccount-title').textContent = `แก้ไข Account: ${username}`;
  openModal('modal-addAccount');
}

function saveAccount() {
  const editUsername = document.getElementById('acc-edit-username').value;
  const username     = document.getElementById('acc-username').value.trim().toLowerCase().replace(/\s+/g,'');
  const displayName  = document.getElementById('acc-displayname').value.trim();
  const role         = document.getElementById('acc-role').value;
  const position     = document.getElementById('acc-position').value.trim();
  const pass1        = document.getElementById('acc-password').value;
  const pass2        = document.getElementById('acc-password2').value;

  if (!username)     { toast('กรุณาระบุ Username','warning'); return; }
  if (!displayName)  { toast('กรุณาระบุชื่อ','warning'); return; }
  if (!role)         { toast('กรุณาเลือก Role','warning'); return; }
  if (!editUsername && !pass1) { toast('กรุณาตั้ง Password','warning'); return; }
  if (pass1 && pass1 !== pass2) { toast('Password ไม่ตรงกัน','error'); return; }
  if (pass1 && pass1.length < 6) { toast('Password ต้องมีอย่างน้อย 6 ตัวอักษร','warning'); return; }

  if (!db.users) db.users = {};

  // Check duplicate username (new only)
  if (!editUsername) {
    const all = { ...BUILTIN_ACCOUNTS, ...db.users };
    if (all[username]) { toast('Username นี้มีอยู่แล้ว','error'); return; }
  }

  const targetUsername = editUsername || username;
  const existing = db.users[targetUsername] || {};
  db.users[targetUsername] = {
    ...existing,
    displayName,
    role,
    position,
    password: pass1 || existing.password,
    createdAt: existing.createdAt || new Date().toISOString(),
  };

  saveDB();
  toast(editUsername ? 'แก้ไข Account เรียบร้อย' : 'เพิ่ม Account เรียบร้อย', 'success');
  closeModal('modal-addAccount');
  renderAccounts();
}

function deleteAccount(username) {
  if (!confirm(`ลบ Account "${username}" หรือไม่?`)) return;
  if (db.users && db.users[username]) {
    delete db.users[username];
    saveDB();
    toast('ลบ Account เรียบร้อย', 'success');
    renderAccounts();
  }
}

function pickStaffForAccount() {
  renderPickStaffList();
  openModal('modal-pickStaff');
}

function renderPickStaffList() {
  const search = (document.getElementById('pickStaffSearch')?.value || '').toLowerCase();
  let list = db.staff.filter(s => !search || s.name.toLowerCase().includes(search) || (s.nickname||'').toLowerCase().includes(search));
  const el = document.getElementById('pickStaffList');
  el.innerHTML = list.map(s => `
    <div style="padding:10px 16px;cursor:pointer;border-bottom:1px solid var(--border);display:flex;align-items:center;gap:10px;"
         onmouseover="this.style.background='var(--sage-light)'" onmouseout="this.style.background=''"
         onclick="selectStaffForAccount('${s.name.replace(/'/g,"\'")}','${(s.position||'').replace(/'/g,"\'")}')">
      <div style="width:32px;height:32px;border-radius:50%;background:var(--sage-light);border:1px solid var(--border);display:flex;align-items:center;justify-content:center;font-size:14px;flex-shrink:0;">👤</div>
      <div>
        <div style="font-weight:600;font-size:13px;">${s.name}</div>
        <div style="font-size:11px;color:var(--text2);">${s.nickname ? '('+s.nickname+') ' : ''}${s.position||''}</div>
      </div>
    </div>`).join('') || '<div style="padding:24px;text-align:center;color:var(--text3);">ไม่พบพนักงาน</div>';
}

function selectStaffForAccount(name, position) {
  document.getElementById('acc-displayname').value = name;
  if (!document.getElementById('acc-position').value) {
    document.getElementById('acc-position').value = position;
  }
  closeModal('modal-pickStaff');
}

// Track last login time when user logs in
function recordLastLogin(username) {
  if (!db.users) db.users = {};
  if (db.users[username]) {
    db.users[username].lastLogin = new Date().toISOString();
    saveDB();
  }
}