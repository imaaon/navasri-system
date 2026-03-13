// ===== AUTH & LOGIN =====

// ===== AUTO-LOGOUT (15 นาที ไม่มีการใช้งาน) =====
let _idleTimer = null;
const IDLE_MINUTES = 15;

function resetIdleTimer() {
  if (!currentUser) return;
  clearTimeout(_idleTimer);
  _idleTimer = setTimeout(async () => {
    await supa.auth.signOut();
    currentUser = null;
    try { sessionStorage.removeItem('navasri_user'); } catch(e) {}
    document.getElementById('loginScreen').style.display = 'flex';
    document.getElementById('loginUser').value = '';
    document.getElementById('loginPass').value = '';
    document.getElementById('loginError').style.display = 'none';
    toast('⏱️ ระบบออกจากการเข้าใช้งานอัตโนมัติเนื่องจากไม่มีการใช้งานเกิน ' + IDLE_MINUTES + ' นาที', 'warning');
  }, IDLE_MINUTES * 60 * 1000);
}

// ดักจับทุก event ที่แสดงว่ายังใช้งานอยู่
['mousemove','mousedown','keypress','touchstart','scroll','click'].forEach(evt => {
  document.addEventListener(evt, resetIdleTimer, { passive: true });
});

// ===== AUTH / LOGIN =====

let currentUser = null; // { username, displayName, role, position }

async function doLogin() {
  const u = document.getElementById('loginUser').value.trim();
  const p = document.getElementById('loginPass').value;
  const err = document.getElementById('loginError');
  const btn = document.querySelector('#loginScreen button');
  err.style.display = 'none';

  if (!u || !p) {
    err.textContent = 'กรุณากรอก username และ password';
    err.style.display = 'block';
    return;
  }

  // แสดง loading
  if (btn) { btn.disabled = true; btn.textContent = '⏳ กำลังตรวจสอบ...'; }

  try {
    // ใช้ Supabase Auth — ยิงไปถาม server โดยตรง (ปลอดภัย 100%)
    const email = u + '@navasri.local';
    const { data, error } = await supa.auth.signInWithPassword({ email, password: p });

    if (error) {
      err.textContent = 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง';
      err.style.display = 'block';
      document.getElementById('loginPass').value = '';
      document.getElementById('loginPass').focus();
      return;
    }

    // ดึงข้อมูล user profile จาก app_users (เฉพาะ record ของตัวเอง)
    const { data: profile } = await supa.from('app_users')
      .select('username, display_name, name, role, position')
      .eq('username', u)
      .single();

    const displayName = profile?.display_name || profile?.name || u;
    const role = profile?.role || 'staff';
    const position = profile?.position || '';

    currentUser = { username: u, displayName, role, position };
    try { sessionStorage.setItem('navasri_user', JSON.stringify(currentUser)); } catch(e) {}

    // Update UI
    const initials = displayName.replace(/^(นาย|นาง|น\.ส\.|ม\.ร\.ว\.|น\.ส|นส)\s*/,'').trim().slice(0,2);
    document.getElementById('userAvatar').textContent = initials;
    document.getElementById('userDisplayName').textContent = displayName.replace(/^(น\.ส\.|นาง|นาย)/,'').trim().split(' ')[0] || displayName;

    // โหลดข้อมูลหลัง login สำเร็จเท่านั้น!
    document.getElementById('loginScreen').style.display = 'none';
    await loadDB();
    updateSidebarForRole();
    recordLastLogin(u);
    showPage('dashboard');

  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'เข้าสู่ระบบ'; }
  }
}

async function doLogout() {
  if (!confirm('ต้องการออกจากระบบหรือไม่?')) return;
  await supa.auth.signOut();
  currentUser = null;
  db = { items:[], patients:[], staff:[], requisitions:[], purchases:[], itemLots:[], rooms:[], beds:[], contracts:[], payments:[], approvalLogs:[], returnItems:[], appointments:[], belongings:[], patientConsents:[], invoices:[], expenses:[], users:{}, incidents:[], wounds:[], diets:[], tubeFeeds:[], deposits:[] };
  try { sessionStorage.removeItem('navasri_user'); } catch(e) {}
  document.getElementById('loginScreen').style.display = 'flex';
  document.getElementById('loginUser').value = '';
  document.getElementById('loginPass').value = '';
  document.getElementById('loginError').style.display = 'none';
}