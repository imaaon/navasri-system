// ═══════════════════════════════════════════════════════════════
// 📱 Bottom Tab Bar (Mobile-only)
// แสดง 5 ช่อง: 4 page-shortcuts + ☰ More
// ผู้ใช้ปรับ 4 ช่องแรกได้เอง (เก็บใน app_users.tab_bar_pages)
// ═══════════════════════════════════════════════════════════════

// Default mapping per role (4 pages — ช่องที่ 5 = More)
var BOTTOM_TAB_DEFAULTS = {
  admin:              ['dashboard', 'patients', 'stock', 'billing'],
  manager:            ['dashboard', 'patients', 'stock', 'billing'],
  officer:            ['dashboard', 'patients', 'requisition', 'billing'],
  nurse:              ['dashboard', 'patients', 'rooms', 'requisition'],
  parttime_nurse:     ['dashboard', 'patients', 'rooms', 'requisition'],
  caregiver:          ['dashboard', 'patients', 'requisition', 'history'],
  doctor:             ['dashboard', 'patients'],
  physical_therapist: ['dashboard', 'patients', 'requisition', 'history'],
  dietitian:          ['dashboard', 'patients', 'dietary', 'requisition'],
  warehouse:          ['dashboard', 'stock', 'requisition', 'history'],
  supervisor:         ['dashboard', 'patients', 'rooms', 'requisition']
};

// Icon + label สำหรับแต่ละ page
var BOTTOM_TAB_META = {
  dashboard:        { icon: '📊', label: 'Dashboard' },
  patients:         { icon: '👥', label: 'Patients' },
  stock:            { icon: '📦', label: 'Stock' },
  billing:          { icon: '💰', label: 'Billing' },
  requisition:      { icon: '📋', label: 'เบิกของ' },
  history:          { icon: '📜', label: 'ประวัติ' },
  rooms:            { icon: '🏠', label: 'Rooms' },
  staff:            { icon: '👥', label: 'Staff' },
  dietary:          { icon: '🥦', label: 'โภชนา' },
  incident:         { icon: '🚨', label: 'อุบัติเหตุ' },
  deposits:         { icon: '💰', label: 'มัดจำ' },
  assets:           { icon: '🪑', label: 'ทรัพย์สิน' },
  expenses:         { icon: '💸', label: 'ค่าใช้จ่าย' },
  report:           { icon: '📊', label: 'รายงาน' },
  healthreport:     { icon: '🏥', label: 'รายงานสุขภาพ' },
  items:            { icon: '🏷️', label: 'สินค้า' },
  suppliers:        { icon: '🚚', label: 'ซัพพลาย' },
  purchasehistory:  { icon: '📜', label: 'ซื้อ' },
  purchaserequests: { icon: '📝', label: 'PR' },
  supplierinvoices: { icon: '📄', label: 'Inv' },
  stockreport:      { icon: '📊', label: 'Stock Rep' },
  accounts:         { icon: '📒', label: 'บัญชี' },
  audit:            { icon: '📋', label: 'Audit' },
  bi:               { icon: '📈', label: 'BI' },
  settings:         { icon: '⚙️', label: 'ตั้งค่า' },
  'billing-settings': { icon: '⚙️', label: 'ตั้งค่าบิล' }
};

function _getCurrentPage() {
  // ใช้ hash หรือ active sidebar item
  var activeEl = document.querySelector('.nav-item.active');
  return activeEl ? activeEl.getAttribute('data-page') : (location.hash.replace('#', '') || 'dashboard');
}

function _getMyTabBarPages() {
  if (!currentUser) return [];
  // ใช้ custom ถ้ามี · ใช้ default ถ้าไม่มี
  var pages = currentUser.tabBarPages && currentUser.tabBarPages.length > 0
    ? currentUser.tabBarPages
    : (BOTTOM_TAB_DEFAULTS[currentUser.role] || ['dashboard']);
  // กรองเฉพาะ pages ที่ role เห็น
  var allowed = ROLE_PAGES[currentUser.role] || [];
  return pages.filter(function(p) { return allowed.indexOf(p) >= 0; }).slice(0, 4);
}

function renderBottomTabBar() {
  // ลบของเดิมก่อน
  var oldBar = document.getElementById('bottom-tab-bar');
  if (oldBar) oldBar.remove();

  if (!currentUser) return;

  var pages = _getMyTabBarPages();
  if (pages.length === 0) return;

  var currentPage = _getCurrentPage();
  var bar = document.createElement('div');
  bar.id = 'bottom-tab-bar';
  bar.className = 'bottom-tab-bar';

  var hasMore = (ROLE_PAGES[currentUser.role] || []).length > pages.length;
  var totalTabs = pages.length + (hasMore ? 1 : 0);
  bar.style.gridTemplateColumns = 'repeat(' + totalTabs + ', 1fr)';

  // 4 page tabs
  pages.forEach(function(p) {
    var meta = BOTTOM_TAB_META[p] || { icon: '📄', label: p };
    var tab = document.createElement('div');
    tab.className = 'bottom-tab-item' + (currentPage === p ? ' active' : '');
    tab.innerHTML = '<span class="tab-icon">' + meta.icon + '</span><span class="tab-label">' + meta.label + '</span>';
    tab.addEventListener('click', function() {
      if (typeof showPage === 'function') showPage(p);
      else location.hash = '#' + p;
      renderBottomTabBar();
    });
    bar.appendChild(tab);
  });

  // More button
  if (hasMore) {
    var more = document.createElement('div');
    more.className = 'bottom-tab-item';
    more.innerHTML = '<span class="tab-icon">☰</span><span class="tab-label">More</span>';
    more.addEventListener('click', _openMoreMenu);
    bar.appendChild(more);
  }

  document.body.appendChild(bar);
}

function _openMoreMenu() {
  // ลบ overlay เดิม
  var old = document.getElementById('bottom-more-overlay');
  if (old) old.remove();

  var pinnedPages = _getMyTabBarPages();
  var allowed = ROLE_PAGES[currentUser.role] || [];
  var otherPages = allowed.filter(function(p) { return pinnedPages.indexOf(p) < 0; });

  var overlay = document.createElement('div');
  overlay.id = 'bottom-more-overlay';
  overlay.className = 'bottom-more-overlay';
  overlay.addEventListener('click', function(e) {
    if (e.target === overlay) overlay.remove();
  });

  var panel = document.createElement('div');
  panel.className = 'bottom-more-panel';

  var header = document.createElement('div');
  header.className = 'bottom-more-header';
  header.innerHTML = '<div style="font-size:14px;font-weight:700;color:var(--green-dark);">📋 หน้าอื่นๆ ทั้งหมด</div>' +
    '<button class="btn btn-ghost btn-sm" onclick="document.getElementById(\'bottom-more-overlay\').remove();" style="font-size:18px;line-height:1;">✕</button>';
  panel.appendChild(header);

  var grid = document.createElement('div');
  grid.className = 'bottom-more-grid';
  otherPages.forEach(function(p) {
    var meta = BOTTOM_TAB_META[p] || { icon: '📄', label: p };
    var item = document.createElement('div');
    item.className = 'bottom-more-item';
    item.innerHTML = '<span class="icon">' + meta.icon + '</span><span class="label">' + meta.label + '</span>';
    item.addEventListener('click', function() {
      if (typeof showPage === 'function') showPage(p);
      else location.hash = '#' + p;
      overlay.remove();
      setTimeout(renderBottomTabBar, 50);
    });
    grid.appendChild(item);
  });
  panel.appendChild(grid);

  // Settings link — เลือกปักหมุดเอง
  var settingsLink = document.createElement('div');
  settingsLink.className = 'bottom-more-footer';
  settingsLink.innerHTML = '<button class="btn btn-ghost btn-sm" style="font-size:12px;width:100%;" onclick="openTabBarSettings();">⚙️ ปรับแต่ง Bottom Tab Bar</button>';
  panel.appendChild(settingsLink);

  overlay.appendChild(panel);
  document.body.appendChild(overlay);
}

// Re-render เมื่อเปลี่ยน page
window.addEventListener('hashchange', renderBottomTabBar);

// ─────────────────────────────────────────────────────────────
// 📱 Patient Info Modal (Mobile) — ดูข้อมูลด้านซ้ายของ desktop ในรูป popup
// ─────────────────────────────────────────────────────────────
window._openPatientInfoModal = function(patientId) {
  var leftCol = document.querySelector('.patprofile-left-col');
  if (!leftCol) return;

  var overlay = document.createElement('div');
  overlay.className = 'modal-overlay open patient-info-modal-overlay';
  overlay.style.cssText = 'display:flex;align-items:center;justify-content:center;position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.55);z-index:300;';
  
  var modal = document.createElement('div');
  modal.style.cssText = 'background:white;border-radius:14px;padding:0;width:92%;max-width:480px;max-height:88vh;overflow-y:auto;box-shadow:0 8px 30px rgba(0,0,0,0.3);';
  
  // Header
  var header = document.createElement('div');
  header.style.cssText = 'display:flex;justify-content:space-between;align-items:center;padding:14px 16px;border-bottom:1px solid var(--border);position:sticky;top:0;background:white;z-index:1;';
  header.innerHTML = '<div style="font-size:15px;font-weight:700;color:var(--green-dark);">ℹ️ ข้อมูลผู้รับบริการ</div>' +
    '<button class="btn btn-ghost btn-sm" style="font-size:18px;line-height:1;padding:4px 10px;" onclick="this.closest(\'.modal-overlay\').remove();">✕</button>';
  modal.appendChild(header);

  // Body — clone left col content
  var body = document.createElement('div');
  body.style.cssText = 'padding:14px;';
  body.innerHTML = leftCol.innerHTML;  // clone HTML (event listeners ไม่ถูก clone — แต่ใช้ inline onclick อยู่แล้ว)
  modal.appendChild(body);

  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  // Click outside → close
  overlay.addEventListener('click', function(e) {
    if (e.target === overlay) overlay.remove();
  });
};
