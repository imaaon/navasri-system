// ===== SHARED UTILS =====

// ===== MODAL HELPERS =====
function openModal(id) { const el = document.getElementById(id); if (el) el.classList.add('open'); else console.warn('openModal: not found:', id); }
function closeModal(id) { const el = document.getElementById(id); if (el) el.classList.remove('open'); }

// [R27-P3C 15พค69] ตรวจว่า modal มี form ที่ผู้ใช้กรอกข้อมูลแล้วหรือไม่
//   ใช้ตัดสินว่าตอน ESC จะปิดทันที หรือต้อง confirm ก่อน
function _modalHasUserInput(modalEl) {
  if (!modalEl) return false;
  const inputs = modalEl.querySelectorAll('input, textarea, select');
  for (const el of inputs) {
    // skip hidden + readonly + disabled
    if (el.type === 'hidden' || el.readOnly || el.disabled) continue;
    if (el.type === 'checkbox' || el.type === 'radio') {
      if (el.checked !== el.defaultChecked) return true;
    } else if (el.tagName === 'SELECT') {
      // เลือก option ที่ไม่ใช่ default (index 0)
      if (el.selectedIndex > 0) return true;
    } else {
      const v = (el.value || '').trim();
      if (v && v !== (el.defaultValue || '').trim()) return true;
    }
  }
  return false;
}

// [R27-P3C 15พค69] หา modal ที่เปิดอยู่บนสุด (z-index สูงสุด)
function _findTopMostOpenModal() {
  const open = document.querySelectorAll('.modal-overlay.open');
  if (open.length === 0) return null;
  if (open.length === 1) return open[0];
  // หา modal ที่ z-index สูงสุด (stacked modal pattern)
  let top = open[0];
  let topZ = parseInt(getComputedStyle(top).zIndex) || 0;
  for (let i = 1; i < open.length; i++) {
    const z = parseInt(getComputedStyle(open[i]).zIndex) || 0;
    if (z >= topZ) { top = open[i]; topZ = z; }
  }
  return top;
}

// Modal click-outside ต้องรัน หลัง DOM โหลด (ถูกเรียกจาก loadHTMLPartials แล้ว)
function initModalClickOutside() {
  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', e => { if (e.target === overlay) overlay.classList.remove('open'); });
  });

  // [R27-P3C 15พค69] Global ESC key handler — ปิด modal บนสุด
  //   ถ้าฟอร์มเปล่า → ปิดทันที
  //   ถ้าฟอร์มมีข้อมูล → ถาม confirm ก่อน (ป้องกัน data loss)
  if (!window._escModalHandlerInstalled) {
    document.addEventListener('keydown', async function(e) {
      if (e.key !== 'Escape') return;
      // ไม่ block ถ้ามี customConfirm/customAlert เปิดอยู่ (พวกนี้มี handler ของตัวเอง)
      const cc = document.getElementById('modal-customConfirm');
      const ca = document.getElementById('modal-customAlert');
      if ((cc && cc.classList.contains('open')) || (ca && ca.classList.contains('open'))) return;

      const top = _findTopMostOpenModal();
      if (!top) return;

      e.preventDefault();
      e.stopPropagation();

      if (_modalHasUserInput(top)) {
        // มีข้อมูลกรอกแล้ว → ถาม confirm
        if (typeof customConfirm === 'function') {
          const ok = await customConfirm('ยกเลิกการแก้ไข? ข้อมูลที่กรอกจะหายไป');
          if (ok) top.classList.remove('open');
        } else {
          // fallback: ใช้ native confirm
          if (confirm('ยกเลิกการแก้ไข? ข้อมูลที่กรอกจะหายไป')) top.classList.remove('open');
        }
      } else {
        // ฟอร์มเปล่า → ปิดทันที
        top.classList.remove('open');
      }
    });
    window._escModalHandlerInstalled = true;
  }
}

// ===== TOAST =====
function toast(msg, type = '') {
  const tc = document.getElementById('toastContainer');
  if (!tc) { console.warn('toast:', msg); return; }
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  t.innerHTML = `<span>${type === 'success' ? '✓' : type === 'warning' ? '⚠' : type === 'error' ? '✕' : 'ℹ'}</span><span>${msg}</span>`;
  tc.appendChild(t);
  setTimeout(() => { t.style.animation = 'none'; t.style.opacity = '0'; t.style.transform = 'translateX(100%)'; t.style.transition = 'all 0.3s'; setTimeout(() => t.remove(), 300); }, 3000);
}

// ===== CLOCK =====
function updateClock() {
  const now = new Date();
  const clockEl = document.getElementById('clock');
  const dateEl  = document.getElementById('todayDate');
  if (clockEl) clockEl.textContent = now.toLocaleTimeString('th-TH', {hour:'2-digit',minute:'2-digit',second:'2-digit'});
  const days   = ['อาทิตย์','จันทร์','อังคาร','พุธ','พฤหัส','ศุกร์','เสาร์'];
  const months = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
  if (dateEl) dateEl.textContent = `${days[now.getDay()]} ${now.getDate()} ${months[now.getMonth()]} ${now.getFullYear() + 543}`;
}
function startClock() {
  updateClock();
  setInterval(updateClock, 1000);
}
// ── Excel Download Helper ─────────────────────────────────────
function _xlsxDownload(rows, sheetName, filename) {
  if (typeof XLSX === 'undefined') { toast('ไม่พบ SheetJS กรุณา refresh หน้า', 'error'); return; }
  const ws = XLSX.utils.aoa_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.writeFile(wb, filename + '.xlsx');
  toast('ดาวน์โหลด Excel แล้ว ✅', 'success');
}

// ════════════════════════════════════════════════════════════════════
// Phase 4C: customConfirm + customAlert (แทน native confirm/alert)
// ────────────────────────────────────────────────────────────────────
// Usage:
//   const ok = await customConfirm('ลบรายการนี้?');
//   if (!ok) return;
//
//   await customAlert('บันทึกเรียบร้อย', { type: 'success' });
//
// Options (สำหรับทั้ง 2 functions):
//   - title: หัวข้อ modal (default: "ยืนยัน" / "แจ้งเตือน")
//   - icon:  emoji icon (default: ❓ / ℹ️)
//   - type:  'info'|'success'|'warning'|'error' → auto-set icon ถ้าไม่ระบุ
//   - okText: ข้อความปุ่ม OK (default: "ยืนยัน" / "ตกลง")
//   - cancelText: ข้อความปุ่ม Cancel (เฉพาะ confirm, default: "ยกเลิก")
//   - danger: true → ปุ่ม OK เป็นสีแดง (สำหรับลบ)
// ════════════════════════════════════════════════════════════════════

let _customConfirmResolveFn = null;
function _customConfirmResolve(value) {
  const modal = document.getElementById('modal-customConfirm');
  if (modal) modal.style.display = 'none';
  document.removeEventListener('keydown', _customConfirmKeyHandler);
  if (_customConfirmResolveFn) {
    const fn = _customConfirmResolveFn;
    _customConfirmResolveFn = null;
    fn(value);
  }
}
function _customConfirmKeyHandler(e) {
  if (e.key === 'Escape') _customConfirmResolve(false);
  else if (e.key === 'Enter') _customConfirmResolve(true);
}

function customConfirm(message, opts) {
  opts = opts || {};
  return new Promise((resolve) => {
    const modal = document.getElementById('modal-customConfirm');
    if (!modal) {
      // Fallback ถ้า modal ยังไม่ถูก inject — ใช้ native
      console.warn('customConfirm: modal-customConfirm not in DOM, falling back to native');
      resolve(window.confirm(message));
      return;
    }
    
    // Auto icon ตาม type ถ้าไม่ระบุ icon
    const typeIconMap = { info: 'ℹ️', success: '✅', warning: '⚠️', error: '❌', danger: '🗑️' };
    const icon = opts.icon || typeIconMap[opts.type] || (opts.danger ? '🗑️' : '❓');
    const title = opts.title || (opts.danger ? 'ยืนยันการลบ' : 'ยืนยัน');
    const okText = opts.okText || (opts.danger ? 'ลบ' : 'ยืนยัน');
    const cancelText = opts.cancelText || 'ยกเลิก';
    
    document.getElementById('customConfirmIcon').textContent = icon;
    document.getElementById('customConfirmTitleText').textContent = title;
    document.getElementById('customConfirmMessage').textContent = message;
    
    const okBtn = document.getElementById('customConfirmOk');
    okBtn.textContent = okText;
    okBtn.className = opts.danger ? 'btn btn-danger' : 'btn btn-primary';
    okBtn.style.cssText = opts.danger ? 'background:var(--danger);border-color:var(--danger);color:white;' : '';
    
    document.getElementById('customConfirmCancel').textContent = cancelText;
    
    modal.style.display = 'flex';
    
    // Focus + keyboard handlers
    setTimeout(() => okBtn.focus(), 50);
    _customConfirmResolveFn = resolve;
    document.addEventListener('keydown', _customConfirmKeyHandler);
  });
}

let _customAlertResolveFn = null;
function _customAlertResolve() {
  const modal = document.getElementById('modal-customAlert');
  if (modal) modal.style.display = 'none';
  document.removeEventListener('keydown', _customAlertKeyHandler);
  if (_customAlertResolveFn) {
    const fn = _customAlertResolveFn;
    _customAlertResolveFn = null;
    fn();
  }
}
function _customAlertKeyHandler(e) {
  if (e.key === 'Escape' || e.key === 'Enter') _customAlertResolve();
}

function customAlert(message, opts) {
  opts = opts || {};
  return new Promise((resolve) => {
    const modal = document.getElementById('modal-customAlert');
    if (!modal) {
      console.warn('customAlert: modal-customAlert not in DOM, falling back to native');
      window.alert(message);
      resolve();
      return;
    }
    
    const typeIconMap = { info: 'ℹ️', success: '✅', warning: '⚠️', error: '❌' };
    const typeTitleMap = { info: 'แจ้งเตือน', success: 'สำเร็จ', warning: 'คำเตือน', error: 'เกิดข้อผิดพลาด' };
    const icon = opts.icon || typeIconMap[opts.type] || 'ℹ️';
    const title = opts.title || typeTitleMap[opts.type] || 'แจ้งเตือน';
    const okText = opts.okText || 'ตกลง';
    
    document.getElementById('customAlertIcon').textContent = icon;
    document.getElementById('customAlertTitleText').textContent = title;
    document.getElementById('customAlertMessage').textContent = message;
    document.getElementById('customAlertOk').textContent = okText;
    
    modal.style.display = 'flex';
    
    setTimeout(() => document.getElementById('customAlertOk').focus(), 50);
    _customAlertResolveFn = resolve;
    document.addEventListener('keydown', _customAlertKeyHandler);
  });
}

// ===== INPUT VALIDATORS =====
// คืน null = OK, คืน string = error message ภาษาไทย

function validateThaiIdCard(idcard) {
  if (!idcard) return null; // ว่างได้ (optional field)
  const cleaned = String(idcard).replace(/[-\s]/g, '');
  if (!/^\d{13}$/.test(cleaned)) {
    return 'เลขบัตรประชาชนต้องเป็นตัวเลข 13 หลัก';
  }
  return null;
}

function validatePhone(phone) {
  if (!phone) return null; // ว่างได้
  const cleaned = String(phone).replace(/[-\s()]/g, '');
  if (!/^\d{9,10}$/.test(cleaned)) {
    return 'เบอร์โทรต้องเป็นตัวเลข 9-10 หลัก';
  }
  return null;
}

function validateDateOrder(startDate, endDate, startLabel, endLabel) {
  // ถ้าตัวใดตัวหนึ่งว่าง ผ่านได้
  if (!startDate || !endDate) return null;
  if (new Date(endDate) < new Date(startDate)) {
    return `${endLabel||'วันสิ้นสุด'} ต้องอยู่หลังหรือเท่ากับ ${startLabel||'วันเริ่มต้น'}`;
  }
  return null;
}

function validatePositiveAmount(amount, label) {
  const n = parseFloat(amount);
  if (isNaN(n)) return `${label||'จำนวนเงิน'} ต้องเป็นตัวเลข`;
  if (n < 0) return `${label||'จำนวนเงิน'} ต้องไม่ติดลบ`;
  return null;
}
