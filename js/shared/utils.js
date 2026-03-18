// ===== SHARED UTILS =====

// ===== MODAL HELPERS =====
function openModal(id) { const el = document.getElementById(id); if (el) el.classList.add('open'); else console.warn('openModal: not found:', id); }
function closeModal(id) { const el = document.getElementById(id); if (el) el.classList.remove('open'); }
// Modal click-outside ต้องรัน หลัง DOM โหลด (ถูกเรียกจาก loadHTMLPartials แล้ว)
function initModalClickOutside() {
  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', e => { if (e.target === overlay) overlay.classList.remove('open'); });
  });
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
